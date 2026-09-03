# -*- coding: utf-8 -*-
# Слой «камни и растительность как РЕНДЕР» карты EFT: ортографический вид сверху,
# настоящая геометрия LOD0 с текстурами и светом, прозрачный фон — кладётся поверх HD-арта.
#
# Это НЕ обводки и НЕ габариты (их дают dump-stones.py / extract-vegetation.py).
# Трансформы экземпляров берутся ГОТОВЫМИ из их JSON, здесь добавляются только
# меши прототипов, материалы, текстуры и сам рендер.
#
# Запуск (весь конвейер):
#   python scripts/eft-map-layers/render-objects.py all \
#       --client "D:/Games/Escape from Tarkov/EscapeFromTarkov_Data" --map customs
# Подкоманды по отдельности: extract | probe | render
#
# ГРАБЛИ, ОПЛАЧЕННЫЕ ДО НАС (все три обойдены здесь же):
#  1. UnityPy Mesh.export() пишет -pos[0] — ЗЕРКАЛИТ X. Вершины берутся ТОЛЬКО из MeshHandler.
#  2. LOD-дубли: у прототипа берём LOD0, режем *_LOD1/2/3, *_SHADOW*, *_BALLISTIC*, *COLLIDER*.
#  3. PPtr резолвится сквозь externals ВЛАДЕЛЬЦА ссылки, а не сцены: материал лежит в
#     sharedassetsN, и его m_FileID считается по таблице ЭТОГО файла. Иначе _MainTex уезжает
#     в чужой файл и приходит «GameObject model» вместо Texture2D (проверено на stone03).
#
# СИСТЕМА КООРДИНАТ. Unity (лев. тройка, Y вверх) -> Blender (прав. тройка, Z вверх)
# отражением M: (x,y,z) -> (x,z,y). Отражение переворачивает обход треугольников — обход
# инвертируется. coordinateRotation=180 у растра — это НЕ поворот геометрии, а РОЛЛ камеры
# на 180 градусов: вид сверху с роллом pi даёт «вправо = -X, вниз = +Z», ровно как в аффине
# рамки комнат (px = A + B*gx при B<0, py = C + D*gz при D>0). Совпадение проверяется
# численно, при расхождении > 0.75 px прогон падает.

import argparse, json, math, os, re, subprocess, sys

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

try:
    sys.stdout.reconfigure(errors='replace')
except Exception:
    pass

DROP_NODE_RX = re.compile(r'SHADOW|COLLIDER|BALLISTIC|Impostor|_LOD[1-9]', re.I)
LOD0_RX = re.compile(r'_LOD0$', re.I)
SAFE_RX = re.compile(r'[^A-Za-z0-9_.-]+')

# Порог очереди отрисовки, за которым материал считается alpha-tested (листва, трава).
# stone03 = 2000 (Geometry) -> непрозрачный; листва EFT сидит на 2450/2500 (AlphaTest).
ALPHA_QUEUE = 2400


def die(msg):
    sys.exit('ОТКАЗ: ' + msg)


def safe(name):
    return SAFE_RX.sub('_', str(name))


# --- доступ к ассетам клиента ------------------------------------------------
class Client:
    """Файлы клиента с кэшем и ЧЕСТНЫМ разбором PPtr: m_FileID берётся по таблице
    externals того файла, В КОТОРОМ лежит сама ссылка (грабля 3)."""

    def __init__(self, data_dir):
        self.dir = data_dir
        self.files = {}
        self._tt = {}

    def load(self, base):
        if base not in self.files:
            import UnityPy
            p = os.path.join(self.dir, base)
            if not os.path.exists(p):
                self.files[base] = ({}, [])
                return self.files[base]
            env = UnityPy.load(p)
            fl = next(iter(env.files.values()))
            self.files[base] = ({o.path_id: o for o in env.objects},
                                [os.path.basename(x.path) for x in fl.externals])
            print('    ассеты: %s (объектов %d)' % (base, len(self.files[base][0])))
        return self.files[base]

    def resolve(self, pptr, owner):
        pid = (pptr or {}).get('m_PathID', 0)
        if not pid:
            return None, None
        objs, ext = self.load(owner)
        fid = pptr.get('m_FileID', 0)
        fname = owner
        if fid:
            i = fid - 1
            if not (0 <= i < len(ext)):
                return None, None
            fname = ext[i]
            objs, _ = self.load(fname)
        return objs.get(pid), fname

    def tt(self, obj):
        k = id(obj)
        if k not in self._tt:
            self._tt[k] = obj.read_typetree()
        return self._tt[k]

    def components(self, go, owner):
        out = {}
        for c in self.tt(go).get('m_Component', []):
            co, own = self.resolve(c['component'], owner)
            if co is not None:
                out.setdefault(co.type.name, []).append((co, own))
        return out


# --- матрицы -----------------------------------------------------------------
M4 = np.array([[1, 0, 0, 0],
               [0, 0, 1, 0],
               [0, 1, 0, 0],
               [0, 0, 0, 1]], dtype=np.float64)   # Unity <-> Blender, отражение y/z


def quat_matrix(q):
    x, y, z, w = q
    n = math.sqrt(x * x + y * y + z * z + w * w) or 1.0
    x, y, z, w = x / n, y / n, z / n, w / n
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]], dtype=np.float64)


def trs_unity(pos, quat, scale):
    m = np.eye(4)
    m[:3, :3] = quat_matrix(quat) @ np.diag(scale)
    m[:3, 3] = pos
    return m


def to_blender(m_unity):
    """Матрица объекта в Blender: M * TRS_unity * M (вершины прототипа уже в Blender-осях)."""
    return M4 @ m_unity @ M4


# --- геометрия прототипа -----------------------------------------------------
def read_mesh(mesh_obj):
    """Вершины/нормали/UV/треугольники меша. ТОЛЬКО через MeshHandler (грабля 1)."""
    from UnityPy.helpers.MeshHelper import MeshHandler
    h = MeshHandler(mesh_obj.read())
    h.process()
    nv = int(h.m_VertexCount)

    def chan(raw, want):
        """Канал вершинных данных. MeshHandler отдаёт список ПО ВЕРШИНАМ, но ширина строки
        НЕ константа: у части мешей EFT нормали идут по 4 компонента на вершину
        (6088 = 1522x4). Поэтому форма выводится из массива, а не подставляется наугад."""
        if raw is None or not len(raw):
            return None
        a = np.asarray(raw, dtype=np.float32)
        if a.ndim == 1:
            if nv <= 0 or len(a) % nv:
                return None
            a = a.reshape(nv, len(a) // nv)
        if a.ndim != 2 or a.shape[1] < want or a.shape[0] != nv:
            return None
        return a[:, :want].copy()

    V = chan(h.m_Vertices, 3)
    if V is None:
        return np.zeros((0, 3), np.float32), None, None, []
    N = chan(h.m_Normals, 3)
    UV = chan(h.m_UV0, 2)
    subs = [np.asarray(s, dtype=np.int32).reshape(-1, 3) for s in h.get_triangles()]
    return V, N, UV, subs


def bake_local(V, N, mat_local):
    """Локальный TRS ребёнка префаба вшивается в вершины — тогда экземпляр несёт только свой TRS."""
    if mat_local is None:
        return V, N
    R = mat_local[:3, :3]
    V = (V @ R.T + mat_local[:3, 3]).astype(np.float32)
    if N is not None:
        Rn = np.linalg.inv(R).T
        n = N @ Rn.T
        ln = np.linalg.norm(n, axis=1, keepdims=True)
        N = (n / np.where(ln == 0, 1, ln)).astype(np.float32)
    return V, N


def unity_to_blender_mesh(V, N, subs):
    """Отражение осей + инверсия обхода треугольников (иначе нормали смотрят внутрь)."""
    Vb = np.stack([V[:, 0], V[:, 2], V[:, 1]], axis=1).astype(np.float32)
    Nb = (np.stack([N[:, 0], N[:, 2], N[:, 1]], axis=1).astype(np.float32)
          if N is not None else None)
    sb = [s[:, ::-1].copy() for s in subs]
    return Vb, Nb, sb


# --- материалы и текстуры ----------------------------------------------------
def _pairs(seq):
    for entry in seq or []:
        if isinstance(entry, (list, tuple)):
            yield entry[0], entry[1]
        elif isinstance(entry, dict):
            yield entry.get('first'), entry.get('second')


# Имена свойств текстур. Игра на IL2CPP, шейдеры кастомные, единого «_MainTex» НЕТ: у камня
# Rock_01 диффуз лежит в `_Aldebo` (опечатка BSG в слове Albedo), нормаль — в `_Normalmap`.
# Порядок = приоритет, берётся первое НЕПУСТОЕ свойство.
BASE_PROPS = ('_MainTex', '_Aldebo', '_Albedo', '_AlbedoMap', '_BaseMap', '_BaseColorMap',
              '_Diffuse', '_DiffuseMap', '_DiffuseTex', '_Tex')
NORMAL_PROPS = ('_BumpMap', '_Normalmap', '_NormalMap', '_Normal', '_NormalTex', '_NormalMapTex')


def tex_prop(md, keys):
    """Первое непустое свойство-текстура из списка имён (или из одного имени строкой)."""
    if isinstance(keys, str):
        keys = (keys,)
    env = dict(_pairs(md.get('m_SavedProperties', {}).get('m_TexEnvs')))
    for k in keys:
        t = (env.get(k) or {}).get('m_Texture')
        if t and t.get('m_PathID'):
            return t
    return None


def color_prop(md, key):
    for name, val in _pairs(md.get('m_SavedProperties', {}).get('m_Colors')):
        if name == key and isinstance(val, dict):
            return [val.get('r', 1.0), val.get('g', 1.0), val.get('b', 1.0), val.get('a', 1.0)]
    return None


def float_prop(md, key):
    for name, val in _pairs(md.get('m_SavedProperties', {}).get('m_Floats')):
        if name == key:
            return val
    return None


class TexBank:
    def __init__(self, outdir, max_side):
        self.dir = outdir
        self.max = max_side
        self.done = {}
        os.makedirs(outdir, exist_ok=True)

    def save(self, tex_obj, kind, keep_alpha):
        """Texture2D -> PNG. kind: 'base' | 'normal'. Возвращает (путь, доля прозрачных)."""
        key = (tex_obj.path_id, kind, bool(keep_alpha))
        if key in self.done:
            return self.done[key]
        try:
            img = tex_obj.read().image
        except Exception as e:
            print('  ! текстура %s не декодируется (%s)' % (tex_obj.path_id, type(e).__name__))
            img = None
        if img is None:
            self.done[key] = (None, 0.0)
            return self.done[key]
        img = img.convert('RGBA')
        if max(img.size) > self.max:
            k = self.max / max(img.size)
            img = img.resize((max(1, int(img.size[0] * k)), max(1, int(img.size[1] * k))),
                             Image.LANCZOS)
        a = np.asarray(img, dtype=np.uint8)
        frac = float((a[:, :, 3] < 128).mean())
        name = '%s_%s_%s.png' % (safe(tex_obj.peek_name() or 'tex'), kind, tex_obj.path_id)
        path = os.path.join(self.dir, name)
        if kind == 'normal':
            f = a.astype(np.float32) / 255.0
            # DXT5nm (X в альфе, Y в зелёном) против прямого RGB — по «мёртвому» красному каналу
            if f[:, :, 0].mean() > 0.96:
                nx, ny = f[:, :, 3] * 2 - 1, f[:, :, 1] * 2 - 1
            else:
                nx, ny = f[:, :, 0] * 2 - 1, f[:, :, 1] * 2 - 1
            nz = np.sqrt(np.clip(1.0 - nx * nx - ny * ny, 0.0, 1.0))
            out = np.stack([(nx + 1) / 2, (ny + 1) / 2, (nz + 1) / 2], axis=-1)
            Image.fromarray((out * 255).astype(np.uint8), 'RGB').save(path, optimize=True)
        elif keep_alpha:
            img.save(path, optimize=True)
        else:
            img.convert('RGB').save(path, optimize=True)
        self.done[key] = (path, frac)
        return self.done[key]


def build_material(client, mat_pptr, owner, bank):
    mo, mown = client.resolve(mat_pptr, owner)
    if mo is None or mo.type.name != 'Material':
        return dict(name='missing', base=None, normal=None, color=[0.5, 0.5, 0.5, 1.0],
                    alphaClip=False, cutoff=0.5, queue=-1, resolved=False)
    md = client.tt(mo)
    queue = md.get('m_CustomRenderQueue', -1)
    alpha_clip = queue is not None and queue >= ALPHA_QUEUE
    base_path = normal_path = None
    tp = tex_prop(md, BASE_PROPS)
    if tp:
        to, town = client.resolve(tp, mown)
        if to is not None and to.type.name == 'Texture2D':
            base_path, frac = bank.save(to, 'base', alpha_clip)
            if alpha_clip and frac < 0.01:
                alpha_clip = False       # очередь врёт: прозрачных пикселей нет
    npp = tex_prop(md, NORMAL_PROPS)
    if npp:
        no, nown = client.resolve(npp, mown)
        if no is not None and no.type.name == 'Texture2D':
            normal_path, _ = bank.save(no, 'normal', True)
    col = color_prop(md, '_Color') or [1.0, 1.0, 1.0, 1.0]
    cut = float_prop(md, '_Cutoff')
    return dict(name=md.get('m_Name'), base=base_path, normal=normal_path,
                color=col, alphaClip=bool(alpha_clip),
                cutoff=float(cut) if cut is not None else 0.5,
                queue=queue, resolved=base_path is not None)


# --- прототипы: камни --------------------------------------------------------
def all_levels(client):
    import UnityPy
    ggm = os.path.join(client.dir, 'globalgamemanagers')
    scenes = None
    for o in UnityPy.load(ggm).objects:
        if o.type.name == 'BuildSettings':
            scenes = o.read_typetree()['scenes']
            break
    if not scenes:
        die('BuildSettings без списка сцен')
    out = {}
    for i, s in enumerate(scenes):
        p = os.path.join(client.dir, 'level%d' % i)
        if os.path.exists(p):
            out[os.path.basename(s)[:-6]] = p
    return out


def stone_prototypes(client, stones, protodir, bank):
    """Для каждого уникального меша камня — геометрия LOD0 и материалы из сцены levelN."""
    # ⚠️ Имя УЗЛА и имя МЕША не одно и то же: у Rock_01 узел зовётся «Rock_01(Clone)», а меш —
    # «polySurface120». Ищем по имени узла (последний сегмент path), кладём по имени меша —
    # именно им экземпляр ссылается на прототип.
    node2mesh = {}
    votes = {}
    for r in stones:
        node2mesh[r['path'].split('/')[-1]] = r['mesh']
        votes[r['level']] = votes.get(r['level'], 0) + 1
    need_meshes = set(node2mesh.values())
    lvl_files = all_levels(client)
    out = {}
    for lvl in sorted(votes, key=lambda L: -votes[L]):
        left = {n: m for n, m in node2mesh.items() if m not in out}
        if not left:
            break
        path = lvl_files.get(lvl)
        if not path:
            continue
        base = os.path.basename(path)
        objs, _ = client.load(base)
        for pid, o in objs.items():
            if o.type.name != 'GameObject':
                continue
            try:
                n = o.peek_name()
            except Exception:
                continue
            want = left.get(n)
            if want is None or want in out:
                continue
            cs = client.components(o, base)
            if 'MeshFilter' not in cs or 'MeshRenderer' not in cs:
                continue
            rec = extract_renderer(client, cs, base, want, protodir, bank, None)
            if rec:
                rec['source'] = base
                out[want] = rec
                print('  камень %-24s узел %-22s меш %-20s v=%-6d submesh=%d'
                      % (want, n, rec['mesh'], rec['verts'], len(rec['materials'])))
    missing = [m for m in need_meshes if m not in out]
    if missing:
        print('  ! не найдены меши камней: %s' % ', '.join(missing))
    return out


# --- прототипы: растительность ----------------------------------------------
def veg_prototypes(client, assets_bases, kinds, protodir, bank):
    """m_TreePrototypes у TerrainData -> префаб вида -> его узел *_LOD0 (грабля 2)."""
    found = {}
    for base in assets_bases:
        objs, _ = client.load(base)
        for pid, o in list(objs.items()):
            if o.type.name != 'TerrainData':
                continue
            d = client.tt(o)
            for p in d.get('m_DetailDatabase', {}).get('m_TreePrototypes') or []:
                go, gown = client.resolve(p.get('prefab'), base)
                if go is None or go.type.name != 'GameObject':
                    continue
                try:
                    nm = go.peek_name()
                except Exception:
                    continue
                if nm in kinds and nm not in found:
                    found[nm] = (go, gown)
    out = {}
    for nm in sorted(found):
        go, gown = found[nm]
        node = pick_lod0(client, go, gown)
        if node is None:
            print('  ! %s: узла _LOD0 с мешем не нашлось' % nm)
            continue
        child, cown, local = node
        cs = client.components(child, cown)
        rec = extract_renderer(client, cs, cown, nm, protodir, bank, local)
        if rec:
            rec['source'] = gown
            out[nm] = rec
            print('  вид    %-24s меш %-22s v=%-6d submesh=%d'
                  % (nm, rec['mesh'], rec['verts'], len(rec['materials'])))
    for nm in sorted(kinds):
        if nm not in out:
            print('  ! вид %s: прототип не разрешился' % nm)
    return out


def pick_lod0(client, root, owner):
    """Обход префаба: узел с MeshFilter+MeshRenderer, имя *_LOD0 (иначе ближайший к корню),
    плюс накопленная локальная матрица от корня префаба."""
    best = None
    stack = [(root, owner, np.eye(4), 0)]
    while stack:
        go, own, mat, depth = stack.pop()
        try:
            nm = go.peek_name() or ''
        except Exception:
            nm = ''
        # ⚠️ Проверка «а вдруг это всё-таки LOD0» здесь БЫЛА и была ошибкой: у пней BSG
        # теневой прокси называется stump01_SHADOW_LOD0 и проползал в прототип — без UV и
        # без текстуры. SHADOW/COLLIDER/BALLISTIC режутся безусловно.
        if DROP_NODE_RX.search(nm):
            continue
        cs = client.components(go, own)
        if ('MeshFilter' in cs and 'MeshRenderer' in cs
                and not re.search(r'collider|cylinder', nm, re.I)):
            mfd = client.tt(cs['MeshFilter'][0][0])
            mo, _ = client.resolve(mfd.get('m_Mesh') or {}, cs['MeshFilter'][0][1])
            if mo is not None and mo.type.name == 'Mesh':
                score = (2 if LOD0_RX.search(nm) else 1, -depth)
                if best is None or score > best[0]:
                    best = (score, go, own, mat)
        trs = cs.get('Transform') or cs.get('RectTransform')
        if not trs or depth >= 4:
            continue
        for ch in client.tt(trs[0][0]).get('m_Children', []):
            co, cown = client.resolve(ch, trs[0][1])
            if co is None:
                continue
            cd = client.tt(co)
            lm = trs_unity((cd['m_LocalPosition']['x'], cd['m_LocalPosition']['y'],
                            cd['m_LocalPosition']['z']),
                           (cd['m_LocalRotation']['x'], cd['m_LocalRotation']['y'],
                            cd['m_LocalRotation']['z'], cd['m_LocalRotation']['w']),
                           (cd['m_LocalScale']['x'], cd['m_LocalScale']['y'],
                            cd['m_LocalScale']['z']))
            cgo, cgown = client.resolve(cd['m_GameObject'], cown)
            if cgo is not None:
                stack.append((cgo, cgown, mat @ lm, depth + 1))
    if best is None:
        return None
    return best[1], best[2], best[3]


def extract_renderer(client, cs, owner, name, protodir, bank, local_mat):
    mf, mfown = cs['MeshFilter'][0]
    mr, mrown = cs['MeshRenderer'][0]
    mo, _ = client.resolve(client.tt(mf).get('m_Mesh') or {}, mfown)
    if mo is None or mo.type.name != 'Mesh':
        return None
    V, N, UV, subs = read_mesh(mo)
    if len(V) == 0 or not subs:
        return None
    V, N = bake_local(V, N, local_mat)
    Vb, Nb, sb = unity_to_blender_mesh(V, N, subs)
    npz = os.path.join(protodir, safe(name) + '.npz')
    arrs = dict(v=Vb)
    if Nb is not None and len(Nb) == len(Vb):
        arrs['n'] = Nb
    if UV is not None and len(UV) == len(Vb):
        arrs['uv'] = UV.astype(np.float32)
    for i, s in enumerate(sb):
        arrs['t%d' % i] = s
    np.savez_compressed(npz, **arrs)
    mats = []
    mrd = client.tt(mr)
    slots = mrd.get('m_Materials', []) or []
    for i in range(len(sb)):
        mp = slots[i] if i < len(slots) else (slots[-1] if slots else None)
        mats.append(build_material(client, mp or {}, mrown, bank))
    return dict(name=name, mesh=mo.peek_name(), npz=npz, verts=int(len(Vb)),
                submeshes=len(sb), materials=mats,
                bbox=[[float(x) for x in Vb.min(0)], [float(x) for x in Vb.max(0)]],
                hasUV='uv' in arrs, hasNormals='n' in arrs)


# --- рамка растра ------------------------------------------------------------
def load_frame(manifest, frame_path):
    man = json.load(open(manifest, encoding='utf-8'))
    (ax, az), (bx, bz) = man['boundsFromConfig']
    XMIN, XMAX = min(ax, bx), max(ax, bx)
    ZMIN, ZMAX = min(az, bz), max(az, bz)
    W, H = man['crop']['width'], man['crop']['height']
    if man.get('coordinateRotation', 0) != 180:
        die('coordinateRotation=%s не проверен (для 180 это ролл камеры на 180 градусов)'
            % man.get('coordinateRotation'))
    fr = json.load(open(frame_path, encoding='utf-8'))
    A, B = fr['affine']['px_from_x']
    C, D = fr['affine']['py_from_z']
    if B >= 0 or D <= 0:
        die('аффина рамки не та, что ожидалась (B<0, D>0): B=%s D=%s' % (B, D))
    if (fr['width'], fr['height']) != (W, H):
        die('рамка комнат %sx%s против растра %sx%s' % (fr['width'], fr['height'], W, H))
    return dict(A=A, B=B, C=C, D=D, W=W, H=H, XMIN=XMIN, XMAX=XMAX, ZMIN=ZMIN, ZMAX=ZMAX)


def check_affine(fr, samples, tol, what):
    """Падаем, если наша проекция расходится с px/py, уже записанными в слое.

    ⚠️ ДОПУСКИ РАЗНЫЕ, И ЭТО НЕ ПОДКРУТКА. Канон — аффина рамки комнат (двери клиента сошлись
    с замками 33/34 в пределах 5 см), она масштабирует на W-1/H-1. Слой камней считан ею же,
    поэтому там расхождение только от округления: 0.06 px. Слой растительности считал пиксели
    сам, нормировкой u*W (не W-1), и по построению уезжает на W/(W-1) ≈ 1 px на всю ширину
    16384. Это разница конвенций, а не рассинхрон данных: мировые X/Z у обоих слоёв одни и те
    же, и рендер берёт именно их. Поэтому камням допуск 0.75 px, растительности — 2 px, и
    число печатается в лог, чтобы дрейф сверх конвенции сразу было видно."""
    worst = 0.0
    for r in samples:
        if 'px' not in r:
            continue
        px = fr['A'] + fr['B'] * r['x']
        py = fr['C'] + fr['D'] * r['z']
        worst = max(worst, abs(px - r['px']), abs(py - r['py']))
    if worst > tol:
        die('аффина расходится с px/py слоя «%s» на %.3f px (допуск %.2f) — '
            'сначала разобраться, чей канон' % (what, worst, tol))
    return worst


def hull_hits(r, fr, pad=64):
    hp = r.get('hullPx') or [[r.get('px', 0), r.get('py', 0)]]
    xs = [p[0] for p in hp]
    ys = [p[1] for p in hp]
    return not (max(xs) < -pad or min(xs) > fr['W'] + pad
                or max(ys) < -pad or min(ys) > fr['H'] + pad)


# --- задание для Blender -----------------------------------------------------
def build_job(fr, protos, instances, cfg, layer):
    ppm_x, ppm_y = -fr['B'], fr['D']
    tiles = []
    tw, th = cfg['tile']
    for j in range(0, fr['H'], th):
        for i in range(0, fr['W'], tw):
            w = min(tw, fr['W'] - i)
            h = min(th, fr['H'] - j)
            cx_px, cy_px = i + w / 2.0, j + h / 2.0
            tiles.append(dict(
                file='%s-%05d-%05d.png' % (layer, j, i), x=i, y=j, w=w, h=h,
                camX=(cx_px - fr['A']) / fr['B'],        # мировой gx центра плитки
                camY=(cy_px - fr['C']) / fr['D'],        # мировой gz центра плитки
                orthoW=w / ppm_x))
    return dict(layer=layer, protos=protos, instances=instances, tiles=tiles,
                pixelAspectY=ppm_x / ppm_y, engine=cfg['engine'], samples=cfg['samples'],
                sunAzimuth=315.0, sunElevation=45.0, sunEnergy=cfg['sun'],
                ambient=cfg['ambient'], tiledir=cfg['tiledir'])


def run_blender(blender, job_path):
    here = os.path.dirname(os.path.abspath(__file__))
    script = os.path.join(here, 'render-objects-blender.py')
    cmd = [blender, '--background', '--factory-startup', '--python', script, '--', job_path]
    print('  > blender --background ... %s' % os.path.basename(job_path))
    p = subprocess.run(cmd, capture_output=True, text=True, errors='replace')
    for line in (p.stdout or '').strip().splitlines()[-45:]:
        print('  | ' + line)
    if p.returncode != 0:
        print((p.stderr or '')[-4000:])
        die('Blender вернул код %d' % p.returncode)
    return p.stdout


def stitch(tiledir, layer, W, H, out_png):
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    n = 0
    pref = layer + '-'
    for fn in sorted(os.listdir(tiledir)):
        if not fn.startswith(pref) or not fn.endswith('.png'):
            continue
        j = int(fn[len(pref):len(pref) + 5])
        i = int(fn[len(pref) + 6:len(pref) + 11])
        t = Image.open(os.path.join(tiledir, fn)).convert('RGBA')
        canvas.alpha_composite(t, (i, j))
        n += 1
    canvas.save(out_png, optimize=False)
    print('  сшито плиток: %d -> %s' % (n, out_png))
    return canvas


def preview(canvas, base_art, out_jpg):
    if os.path.exists(base_art):
        bg = Image.open(base_art).convert('RGBA')
    else:
        print('  подложки %s нет — превью на плашке' % base_art)
        bg = Image.new('RGBA', (canvas.width // 2, canvas.height // 2), (22, 24, 26, 255))
    ov = canvas.resize(bg.size, Image.LANCZOS)
    bg.alpha_composite(ov)
    bg.convert('RGB').save(out_jpg, quality=88, optimize=True)
    print('  превью -> %s' % out_jpg)


# --- команды -----------------------------------------------------------------
def cmd_extract(a):
    client = Client(a.client)
    protodir = os.path.join(a.work, 'protos')
    os.makedirs(protodir, exist_ok=True)
    bank = TexBank(os.path.join(a.work, 'tex'), a.tex_max)

    fr = load_frame(a.manifest, a.frame)
    stones = json.load(open(a.stones, encoding='utf-8'))
    veg = json.load(open(a.veg, encoding='utf-8'))
    d1 = check_affine(fr, stones['instances'], 0.75, 'камни')
    d2 = check_affine(fr, veg['instances'], 2.0, 'растительность')
    print('аффина рамки комнат сошлась со слоями: камни %.3f px (допуск 0.75), '
          'растительность %.3f px (допуск 2.0, конвенция W против W-1)' % (d1, d2))

    keep = [r for r in stones['instances'] if hull_hits(r, fr)]
    print('камней в кадре: %d из %d' % (len(keep), len(stones['instances'])))
    print('прототипы камней:')
    sp = stone_prototypes(client, keep, protodir, bank)

    kinds = sorted(set(r['kind'] for r in veg['instances']))
    print('прототипы растительности (%d видов):' % len(kinds))
    vp = veg_prototypes(client, [b for b in a.veg_assets.split(',') if b], set(kinds),
                        protodir, bank)

    pj = os.path.join(a.work, 'prototypes.json')
    json.dump(dict(map=a.map, stones=sp, veg=vp, frame=fr, texMax=a.tex_max),
              open(pj, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    allp = list(sp.values()) + list(vp.values())
    withtex = sum(1 for r in allp if any(m['resolved'] for m in r['materials']))
    print('\nпрототипов всего %d (камни %d + виды %d), с текстурой %d, без текстуры %d'
          % (len(allp), len(sp), len(vp), withtex, len(allp) - withtex))
    for r in allp:
        if not any(m['resolved'] for m in r['materials']):
            print('  ! без текстуры: %s' % r['name'])
    print('-> %s' % pj)
    return pj


def instances_for(key, a, fr, protos):
    out, skipped = [], 0
    if key == 'stones':
        for r in json.load(open(a.stones, encoding='utf-8'))['instances']:
            if not hull_hits(r, fr):
                continue
            if r['mesh'] not in protos['stones']:
                skipped += 1
                continue
            m = trs_unity((r['x'], r['y'], r['z']), r['quat'], r['scale'])
            out.append(dict(p=r['mesh'], m=[round(v, 6) for v in to_blender(m).ravel().tolist()]))
    else:
        for r in json.load(open(a.veg, encoding='utf-8'))['instances']:
            if r['kind'] not in protos['veg']:
                skipped += 1
                continue
            ang = math.radians(r['rot'])
            q = (0.0, math.sin(ang / 2), 0.0, math.cos(ang / 2))
            m = trs_unity((r['x'], r['y'], r['z']), q, (r['scaleW'], r['scaleH'], r['scaleW']))
            out.append(dict(p=r['kind'], m=[round(v, 6) for v in to_blender(m).ravel().tolist()]))
    return out, skipped


def cmd_probe(a):
    protos = json.load(open(os.path.join(a.work, 'prototypes.json'), encoding='utf-8'))
    sel = {}
    for src, want in (('stones', a.probe_stone), ('veg', a.probe_tree)):
        if want in protos[src]:
            sel[want] = protos[src][want]
        elif protos[src]:
            k = next(iter(protos[src]))
            sel[k] = protos[src][k]
    tiledir = os.path.join(a.work, 'tiles')
    os.makedirs(tiledir, exist_ok=True)
    # Масштаб берём НАСТОЯЩИЙ, медианный по экземплярам: меши прототипов почти единичные,
    # весь размер камня живёт в scale экземпляра (Stone_02 = x73), и без него проба врёт.
    st_scales = [r['scale'] for r in json.load(open(a.stones, encoding='utf-8'))['instances']
                 if r['mesh'] == a.probe_stone]
    vg_scales = [r['scaleW'] for r in json.load(open(a.veg, encoding='utf-8'))['instances']
                 if r['kind'] == a.probe_tree]
    inst, x, half = [], 0.0, 0.0
    for nm in sel:
        if nm in protos['stones'] and st_scales:
            s = sorted(st_scales, key=lambda v: v[0])[len(st_scales) // 2]
        elif vg_scales:
            v = sorted(vg_scales)[len(vg_scales) // 2]
            s = [v, v, v]
        else:
            s = [1.0, 1.0, 1.0]
        b = sel[nm]['bbox']
        w = max((b[1][0] - b[0][0]) * s[0], (b[1][1] - b[0][1]) * s[2])
        x += w * 0.75
        m = trs_unity((x, 0.0, 0.0), (0, 0, 0, 1), s)
        inst.append(dict(p=nm, m=[round(vv, 6) for vv in to_blender(m).ravel().tolist()]))
        x += w * 0.75
        half = max(half, max((b[1][2] - b[0][2]) * s[1], w))
    ortho = x + half * 0.4
    job = dict(layer='probe', protos=sel, instances=inst,
               tiles=[dict(file='probe-00000-00000.png', x=0, y=0, w=1400, h=700,
                           camX=x / 2.0, camY=0.0, orthoW=ortho)],
               pixelAspectY=1.0, engine=a.engine, samples=max(a.samples, 64),
               sunAzimuth=315.0, sunElevation=45.0, sunEnergy=a.sun, ambient=a.ambient,
               tiledir=tiledir, probe=True)
    jp = os.path.join(a.work, 'job-probe.json')
    json.dump(job, open(jp, 'w', encoding='utf-8'), ensure_ascii=False)
    run_blender(a.blender, jp)
    print('-> %s' % os.path.join(tiledir, 'probe-00000-00000.png'))


def cmd_render(a):
    protos = json.load(open(os.path.join(a.work, 'prototypes.json'), encoding='utf-8'))
    fr = protos['frame']
    os.makedirs(a.out, exist_ok=True)
    tiledir = os.path.join(a.work, 'tiles')
    os.makedirs(tiledir, exist_ok=True)
    cfg = dict(tile=(a.tile, a.tile_h), engine=a.engine, samples=a.samples,
               sun=a.sun, ambient=a.ambient, tiledir=tiledir)
    for layer in [s for s in a.layers.split(',') if s]:
        key = 'stones' if layer == 'stones' else 'veg'
        inst, skipped = instances_for(key, a, fr, protos)
        print('слой %s: экземпляров %d (пропущено без прототипа %d)' % (layer, len(inst), skipped))
        for fn in os.listdir(tiledir):
            if fn.startswith(layer + '-'):
                os.remove(os.path.join(tiledir, fn))
        job = build_job(fr, protos[key], inst, cfg, layer)
        jp = os.path.join(a.work, 'job-%s.json' % layer)
        json.dump(job, open(jp, 'w', encoding='utf-8'), ensure_ascii=False)
        print('  плиток: %d по %dx%d' % (len(job['tiles']), a.tile, a.tile_h))
        run_blender(a.blender, jp)
        out_png = os.path.join(a.out, '%s-%s-render.png' % (a.map, layer))
        canvas = stitch(tiledir, layer, fr['W'], fr['H'], out_png)
        preview(canvas, a.base_art, out_png[:-4] + '-preview.jpg')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['extract', 'probe', 'render', 'all'])
    ap.add_argument('--client', default=r'D:/Games/Escape from Tarkov/EscapeFromTarkov_Data')
    ap.add_argument('--map', default='customs')
    ap.add_argument('--manifest', default='D:/Games/raster/customs/manifest.json')
    ap.add_argument('--frame',
                    default='map-exports/OBJECTS-MAPS/gen/customs/rooms/customs-rooms-frame.json')
    ap.add_argument('--stones',
                    default='map-exports/OBJECTS-MAPS/gen/customs/stones/customs-stones.json')
    ap.add_argument('--veg',
                    default='map-exports/OBJECTS-MAPS/gen/customs/ground/customs-vegetation.json')
    ap.add_argument('--veg-assets', default='sharedassets17.assets')
    ap.add_argument('--work', default='D:/eft-export/render-objects')
    ap.add_argument('--out', default='map-exports/OBJECTS-MAPS/gen/customs/render')
    ap.add_argument('--base-art', default='D:/Games/raster/customs/customs-main-8192.webp')
    ap.add_argument('--blender',
                    default=r'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe')
    ap.add_argument('--engine', default='eevee', choices=['eevee', 'cycles'])
    ap.add_argument('--samples', type=int, default=32)
    ap.add_argument('--sun', type=float, default=4.0)
    ap.add_argument('--ambient', type=float, default=0.42)
    ap.add_argument('--tex-max', type=int, default=1024)
    ap.add_argument('--tile', type=int, default=2048)
    ap.add_argument('--tile-h', type=int, default=2069)
    ap.add_argument('--layers', default='stones,vegetation')
    ap.add_argument('--probe-stone', default='Stone_03_LOD0')
    ap.add_argument('--probe-tree', default='pine01')
    a = ap.parse_args()
    os.makedirs(a.work, exist_ok=True)
    if a.cmd in ('extract', 'all'):
        cmd_extract(a)
    if a.cmd == 'probe':
        cmd_probe(a)
    if a.cmd in ('render', 'all'):
        cmd_render(a)


if __name__ == '__main__':
    main()
