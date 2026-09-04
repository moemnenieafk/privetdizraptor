# -*- coding: utf-8 -*-
"""Общее ядро слоёв карты EFT: сцены, меши, рамка, земля, сечение, сшивка.

ЗАЧЕМ ОТДЕЛЬНЫЙ МОДУЛЬ. Три грабли конвейера (зеркалящий X `Mesh.export()`, LOD-дубли,
`coordinateRotation: 180` = отражение) обязаны иметь ОДИН дом. Пока код жил только внутри
`cut-walls.py`, второй потребитель (слой 7) означал копипаст — и расхождение при первой же
правке. Здесь то, что у слоёв общее; словари имён и классы остаются у каждого слоя свои.

Потребители: `cut-walls.py` (стены по этажам), `cut-obstacles.py` (препятствия выше 1 м).

Что даёт:
    Frame      манифест -> аффина мир->пиксель + сверка с эталонной рамкой комнат
    Ground     карта высот .npy -> высота земли в точке (билинейно, векторно)
    Scene      сцена levelN: иерархия, мировой TRS, пути, ссылки на меши
    MeshCache  чтение мешей и m_LocalAABB без Mesh.export()
    collect_meshes / world_xyz / slice_field / stitch / rdp / plen
"""

import os, re, json, math, collections

import numpy as np
import UnityPy
from UnityPy.helpers.MeshHelper import MeshHandler

# id карты портала -> папка группы сцен в docs/registry/eft-scenes.json
MAP2GROUP = {
    'customs': 'Custom', 'factory': 'Factory', 'woods': 'Woods', 'shoreline': 'shorline',
    'lighthouse': 'Lighthouse', 'interchange': 'Shopping_Mall', 'reserve': 'Reserve_Base',
    'the-lab': 'Laboratory', 'streets-of-tarkov': 'City', 'ground-zero': 'Sandbox',
    'labyrinth': 'Labyrinth', 'terminal': 'Terminal', 'icebreaker': 'Icebreaker',
}

# Прокси-геометрия: тень, коллайдер, баллистика, дальние LOD. Отсев БЕЗУСЛОВНЫЙ — пни
# подсовывают `stump01_SHADOW_LOD0`, у которого имя кончается на «правильный» _LOD0.
# ⚠️ `BALL?ISTIC` — не опечатка здесь, а опечатка У BSG: узел `SOO_LOD0/OUTDOOR/balistic`
# написан с одной «л» и мимо строгого `BALLISTIC` проходил как реквизит (793 м² силуэта
# на Таможне). Вторая находка того же сорта, что `_Aldebo` в шейдере камней.
SKIP_MESH_RX = re.compile(r'(_LOD[123]\b|SHADOW|BALL?ISTIC|COLLIDER)', re.I)


def fmt(v):
    return f'{v:,.0f}'.replace(',', ' ')


# ═══════════════════════════════════════════════════════ рамка растра

class Frame:
    """Мир (метры) -> пиксель растра карты. Единственный источник аффины на все слои."""

    def __init__(self, manifest_path):
        self.path = manifest_path
        man = json.load(open(manifest_path, encoding='utf-8'))
        self.man = man
        (ax, az), (bx, bz) = man['boundsFromConfig']
        self.XMIN, self.XMAX = min(ax, bx), max(ax, bx)
        self.ZMIN, self.ZMAX = min(az, bz), max(az, bz)
        self.W = man['crop']['width']
        self.H = man['crop']['height']
        # `coordinateRotation: 180` у BSG — это ОТРАЖЕНИЕ по X (a1 < 0), а не поворот на 180.
        self.mirror_x = (man.get('coordinateRotation', 0) == 180)
        sx = (self.W - 1) / (self.XMAX - self.XMIN)
        sz = (self.H - 1) / (self.ZMAX - self.ZMIN)
        self.affine = dict(
            px_from_x=[(self.W - 1) + self.XMIN * sx, -sx] if self.mirror_x else [-self.XMIN * sx, sx],
            py_from_z=[-self.ZMIN * sz, sz])
        self.a0, self.a1 = self.affine['px_from_x']
        self.b0, self.b1 = self.affine['py_from_z']
        self.mpp = (self.XMAX - self.XMIN) / (self.W - 1)

    def layers(self):
        return list(self.man.get('layers') or [])

    def to_px(self, P):
        """(N,2) мировые (x, z) -> (N,2) пиксели."""
        P = np.asarray(P, dtype=np.float64)
        return np.stack([self.a0 + self.a1 * P[:, 0], self.b0 + self.b1 * P[:, 1]], axis=1)

    def verify(self, frame_json):
        """Сверка с эталонной аффиной слоя комнат. Расхождение > 0.01 px — падение.

        Эталон проверен независимо: двери клиента против наших замков, 33/34 в пределах 5 см.
        Возвращает строку-отчёт; при расхождении бросает SystemExit.
        """
        if not os.path.exists(frame_json):
            return f'! эталонной аффины {frame_json} нет — сверить не с чем'
        ref = json.load(open(frame_json, encoding='utf-8')).get('affine') or {}
        bad = [k for k in ('px_from_x', 'py_from_z')
               if k in ref and max(abs(a - b) for a, b in zip(ref[k], self.affine[k])) > 0.01]
        if bad:
            raise SystemExit(f'привязка разошлась с {frame_json}: {bad} — слой резать нельзя')
        return f'привязка сверена с {os.path.basename(frame_json)}: совпадает'


# ═══════════════════════════════════════════════════════ земля

class Ground:
    """Карта высот слоя ground в метрах: высота земли в мировой точке.

    Сетка лежит в ориентации растра карты (то есть с тем же отражением по X, что и рамка),
    поэтому пересчёт мир->индекс идёт через ту же рамку, а не выводится заново.
    """

    def __init__(self, npy_path, frame):
        self.path = npy_path
        self.frame = frame
        self.G = np.load(npy_path)
        self.gh, self.gw = self.G.shape
        self.has_nan = bool(np.isnan(self.G).any())

    def __repr__(self):
        return (f'{os.path.basename(self.path)} {self.G.shape}, '
                f'{np.nanmin(self.G):.1f}..{np.nanmax(self.G):.1f} м')

    def _uv(self, X, Z):
        f = self.frame
        u = (np.asarray(X, dtype=np.float64) - f.XMIN) / (f.XMAX - f.XMIN) * (self.gw - 1)
        if f.mirror_x:
            u = (self.gw - 1) - u
        v = (np.asarray(Z, dtype=np.float64) - f.ZMIN) / (f.ZMAX - f.ZMIN) * (self.gh - 1)
        return u, v

    def at(self, x, z):
        """Ближайший узел; вне сетки — nan. Точечный вариант (как в слое стен)."""
        u, v = self._uv(x, z)
        c, r = int(round(float(u))), int(round(float(v)))
        if not (0 <= c < self.gw and 0 <= r < self.gh):
            return float('nan')
        return float(self.G[r, c])

    def sample(self, X, Z):
        """Билинейно, векторно. Вне сетки — край. NaN сохраняется (дыры покрытия)."""
        u, v = self._uv(X, Z)
        u = np.clip(u, 0, self.gw - 1)
        v = np.clip(v, 0, self.gh - 1)
        u0 = np.floor(u).astype(np.int64)
        v0 = np.floor(v).astype(np.int64)
        u1 = np.minimum(u0 + 1, self.gw - 1)
        v1 = np.minimum(v0 + 1, self.gh - 1)
        fu = u - u0
        fv = v - v0
        g00 = self.G[v0, u0]
        g01 = self.G[v0, u1]
        g10 = self.G[v1, u0]
        g11 = self.G[v1, u1]
        top = g00 + (g01 - g00) * fu
        bot = g10 + (g11 - g10) * fu
        return top + (bot - top) * fv

    def box_range(self, xlo, zlo, xhi, zhi, n=3):
        """Мин/макс земли под габаритом (сетка n x n). Для предварительного отбора."""
        XX, ZZ = np.meshgrid(np.linspace(xlo, xhi, n), np.linspace(zlo, zhi, n))
        g = self.sample(XX.ravel(), ZZ.ravel())
        if np.isnan(g).all():
            return float('nan'), float('nan')
        return float(np.nanmin(g)), float(np.nanmax(g))


# ═══════════════════════════════════════════════════════ сцены

def qmul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return (aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz)


def qrot(q, v):
    x, y, z, w = q
    vx, vy, vz = v
    tx, ty, tz = 2 * (y * vz - z * vy), 2 * (z * vx - x * vz), 2 * (x * vy - y * vx)
    return (vx + w * tx + y * tz - z * ty, vy + w * ty + z * tx - x * tz, vz + w * tz + x * ty - y * tx)


class Scene:
    """Сцена levelN: иерархия, мировой TRS, компоненты, ссылки на меши."""

    def __init__(self, data_dir, level):
        self.data = data_dir
        self.level = level
        self.env = UnityPy.load(os.path.join(data_dir, level))
        f = next(iter(self.env.files.values()))
        self.ext = [os.path.basename(x.path) for x in f.externals]
        self.objs = {o.path_id: o for o in self.env.objects}
        self._tt = {}
        self._trs = {}
        self._path = {}
        self.go_tr = {}
        self.go_comps = collections.defaultdict(list)
        self.go_name = {}
        for o in self.env.objects:
            if o.type.name != 'GameObject':
                continue
            t = o.read_typetree()
            self.go_name[o.path_id] = t['m_Name']
            for c in t['m_Component']:
                pid = c['component']['m_PathID']
                co = self.objs.get(pid)
                if co is None:
                    continue
                self.go_comps[o.path_id].append((co.type.name, pid))
                if co.type.name in ('Transform', 'RectTransform'):
                    self.go_tr[o.path_id] = pid

    def T(self, pid):
        if pid not in self._tt:
            self._tt[pid] = self.objs[pid].read_typetree()
        return self._tt[pid]

    def parent_go(self, go):
        trp = self.go_tr.get(go)
        if trp is None:
            return None
        fa = self.T(trp)['m_Father']['m_PathID']
        return self.T(fa)['m_GameObject']['m_PathID'] if (fa and fa in self.objs) else None

    def trs(self, pid):
        if pid in self._trs:
            return self._trs[pid]
        t = self.T(pid)
        p, r, s = t['m_LocalPosition'], t['m_LocalRotation'], t['m_LocalScale']
        lp = (p['x'], p['y'], p['z'])
        lr = (r['x'], r['y'], r['z'], r['w'])
        ls = (s['x'], s['y'], s['z'])
        fa = t['m_Father']['m_PathID']
        if fa == 0 or fa not in self.objs:
            res = (lp, lr, ls)
        else:
            fp, fr, fs = self.trs(fa)
            rp = qrot(fr, (lp[0] * fs[0], lp[1] * fs[1], lp[2] * fs[2]))
            res = ((fp[0] + rp[0], fp[1] + rp[1], fp[2] + rp[2]), qmul(fr, lr),
                   (fs[0] * ls[0], fs[1] * ls[1], fs[2] * ls[2]))
        self._trs[pid] = res
        return res

    def path(self, go):
        if go in self._path:
            return self._path[go]
        parts, cur, guard = [], go, 0
        while cur is not None and guard < 64:
            parts.append(self.go_name.get(cur, '?'))
            guard += 1
            cur = self.parent_go(cur)
        res = '/'.join(reversed(parts))
        self._path[go] = res
        return res

    def mesh_ref(self, go):
        """PPtr меша GameObject-а -> (файл, path_id) в терминах внешних ссылок сцены."""
        for tn, pid in self.go_comps.get(go, []):
            if tn == 'MeshFilter':
                m = self.T(pid)['m_Mesh']
                fid, mp = m['m_FileID'], m['m_PathID']
                if mp == 0:
                    return None
                return (self.ext[fid - 1] if fid else self.level, mp)
        return None


LOD_RE = re.compile(r'^(?:\w+\[(\d+)\]\s+)?lod\[(\d+)\]$', re.I)


def collect_meshes(scene, classify, skip_mesh=SKIP_MESH_RX):
    """Меш-узлы сцены после разбора LOD -> экземпляры
    (src, pid, pos, rot, scale, cls, name, branch).

    `classify(path, name)` -> класс или None (None = выбросить).
    LOD-политика: у сущности со СВОИМ MeshFilter дети `lod[*]` лишние (иначе тройные контуры),
    `lod[0]` берётся только там, где своего меша нет.
    """
    own = {}
    for go in scene.go_name:
        mr = scene.mesh_ref(go)
        if mr:
            own[go] = mr

    lod_kids = collections.defaultdict(list)
    plain = []
    for go in own:
        m = LOD_RE.match(scene.go_name.get(go) or '')
        if m:
            lod_kids[scene.parent_go(go)].append((int(m.group(2)), go))
        else:
            plain.append(go)
    plain_set = set(plain)
    take = list(plain)
    for par, kids in lod_kids.items():
        if par in plain_set:
            continue                 # у сущности есть свой (полный) меш — дети lod лишние
        take += [go for lvl, go in kids if lvl == 0]

    out = []
    for go in take:
        p = scene.path(go)
        if skip_mesh.search(p):
            continue
        name = scene.go_name.get(go) or ''
        if LOD_RE.match(name):
            name = scene.go_name.get(scene.parent_go(go)) or name
        cls = classify(p, name)
        if cls is None:
            continue
        trp = scene.go_tr.get(go)
        if trp is None:
            continue
        pos, rot, sc = scene.trs(trp)
        src, pid = own[go]
        out.append((src, pid, pos, rot, sc, cls, name, p.split('/')[1:3]))
    return out


def scene_list(registry_json, map_id, data_dir, skip_scene=None):
    """Сцены карты из реестра: ([(level, имя)], [отсеянные])."""
    groups = json.load(open(registry_json, encoding='utf-8'))
    group = MAP2GROUP.get(map_id)
    if group is None or group not in groups:
        raise SystemExit(f'карта {map_id}: группы сцен нет в {registry_json}')
    keep, skipped = [], []
    for e in groups[group]:
        lvl, nm = f"level{e['level']}", e['scene']
        if not os.path.exists(os.path.join(data_dir, lvl)):
            continue
        if skip_scene is not None and skip_scene.search(nm):
            skipped.append(f'{lvl} ({nm})')
            continue
        keep.append((lvl, nm))
    return keep, skipped


# ═══════════════════════════════════════════════════════ меши

class MeshCache:
    """Чтение мешей и габаритов. Держит открытыми не больше `keep` файлов: шаренные
    .assets весят сотни МБ, перечитывать их накладно, а держать все — некуда."""

    def __init__(self, data_dir, keep=3):
        self.data = data_dir
        self.keep = keep
        self._files = {}
        self._aabb = {}

    def _objs(self, src):
        if src not in self._files:
            try:
                self._files[src] = {o.path_id: o for o in
                                    UnityPy.load(os.path.join(self.data, src)).objects
                                    if o.type.name == 'Mesh'}
            except Exception:
                self._files[src] = {}
        return self._files[src]

    def evict(self, keep_src=None):
        if len(self._files) > self.keep:
            k = {keep_src: self._files[keep_src]} if keep_src in self._files else {}
            self._files.clear()
            self._files.update(k)

    def mesh(self, src, pid):
        """(вершины Nx3 float32 в ЛОКАЛЬНЫХ координатах Unity, треугольники Mx3 int32).

        Через MeshHandler напрямую. `Mesh.export()` здесь НЕ используется сознательно:
        он пишет -pos[0] и зеркалит X у каждого меша по отдельности.
        """
        o = self._objs(src).get(pid)
        if o is None:
            return None
        try:
            h = MeshHandler(o.read())
            h.process()
            V = np.asarray(h.m_Vertices, dtype=np.float32).reshape(-1, 3)
            F = [t for sub in h.get_triangles() for t in sub]
            if not len(F) or not len(V):
                return None
            return V, np.asarray(F, dtype=np.int32).reshape(-1, 3)
        except Exception:
            return None

    def aabb(self, src, pid):
        """m_LocalAABB меша: (центр, полуразмер). Вершины не читаем — Unity уже посчитала."""
        key = (src, pid)
        if key in self._aabb:
            return self._aabb[key]
        r = None
        o = self._objs(src).get(pid)
        if o is not None:
            try:
                a = o.read_typetree()['m_LocalAABB']
                r = ((a['m_Center']['x'], a['m_Center']['y'], a['m_Center']['z']),
                     (a['m_Extent']['x'], a['m_Extent']['y'], a['m_Extent']['z']))
            except Exception:
                r = None
        self._aabb[key] = r
        return r


def world_box(aabb, pos, rot, sc):
    """Мировой габарит экземпляра из m_LocalAABB: [xlo,ylo,zlo, xhi,yhi,zhi]."""
    (cx, cy, cz), (ex, ey, ez) = aabb
    lo = [1e18] * 3
    hi = [-1e18] * 3
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                r = qrot(rot, ((cx + sx * ex) * sc[0], (cy + sy * ey) * sc[1], (cz + sz * ez) * sc[2]))
                for k, v in enumerate((pos[0] + r[0], pos[1] + r[1], pos[2] + r[2])):
                    lo[k] = min(lo[k], v)
                    hi[k] = max(hi[k], v)
    return lo + hi


def world_xyz(V, pos, rot, sc):
    """Локальные вершины -> мировые (wx, wy, wz), векторно."""
    qx, qy, qz, qw = rot
    S = V * np.array(sc, dtype=np.float32)
    x, y, z = S[:, 0], S[:, 1], S[:, 2]
    tx = 2 * (qy * z - qz * y)
    ty = 2 * (qz * x - qx * z)
    tz = 2 * (qx * y - qy * x)
    return ((x + qw * tx + qy * tz - qz * ty) + pos[0],
            (y + qw * ty + qz * tx - qx * tz) + pos[1],
            (z + qw * tz + qx * ty - qy * tx) + pos[2])


def slice_field(wx, wz, D, F, want_dir=False):
    """Сечение геометрии поверхностью D = 0, где D — скалярное поле в вершинах.

    D = wy - h. Плоскость: h = const. Поверхность «земля + пояс»: h = ground(x,z) + пояс,
    и поле считается ПОВЕРШИННО — рез идёт по рельефу, а не плоскостью на всё здание.

    -> (M,4) [x0,z0,x1,z1]; при want_dir ещё (M,) знак обхода: у треугольника с одной
    вершиной сверху обход apex->o1->o2 сонаправлен намотке меша, с двумя — развёрнут.
    Знак нужен правилу ненулевого числа оборотов при заливке.
    """
    Dt = D[F]
    s = Dt > 0
    cnt = s.sum(1)
    sel = (cnt == 1) | (cnt == 2)
    if not sel.any():
        return (None, None) if want_dir else None
    Ft = F[sel]
    st = s[sel]
    dt = Dt[sel]
    one_up = st.sum(1) == 1
    apex = np.where(one_up[:, None], st, ~st).argmax(1)
    o1 = (apex + 1) % 3
    o2 = (apex + 2) % 3
    r = np.arange(len(Ft))
    ia, i1, i2 = Ft[r, apex], Ft[r, o1], Ft[r, o2]
    da, d1, d2 = dt[r, apex], dt[r, o1], dt[r, o2]
    e1 = d1 - da
    e2 = d2 - da
    e1 = np.where(np.abs(e1) < 1e-9, 1e-9, e1)
    e2 = np.where(np.abs(e2) < 1e-9, 1e-9, e2)
    t1 = np.clip((0.0 - da) / e1, 0.0, 1.0)
    t2 = np.clip((0.0 - da) / e2, 0.0, 1.0)
    xa, za = wx[ia], wz[ia]
    out = np.empty((len(Ft), 4), dtype=np.float64)
    out[:, 0] = xa + t1 * (wx[i1] - xa)
    out[:, 1] = za + t1 * (wz[i1] - za)
    out[:, 2] = xa + t2 * (wx[i2] - xa)
    out[:, 3] = za + t2 * (wz[i2] - za)
    keep = (np.abs(out[:, 0] - out[:, 2]) > 1e-6) | (np.abs(out[:, 1] - out[:, 3]) > 1e-6)
    if not keep.any():
        return (None, None) if want_dir else None
    if not want_dir:
        return out[keep]
    return out[keep], np.where(one_up, 1.0, -1.0)[keep]


def slice_plane(wx, wy, wz, F, h, want_dir=False):
    """Частный случай: горизонтальная плоскость y = h.

    Поле считается в float64 сознательно: вершины приходят float32, и разность
    `wy - h` в float32 у вершины, лежащей ровно в плоскости реза, схлопывается в 0
    и вершина меняет сторону. На счётчиках это не видно (отрезков столько же),
    а вырожденные осколки появляются.
    """
    return slice_field(wx, wz, np.asarray(wy, dtype=np.float64) - h, F, want_dir=want_dir)


# ═══════════════════════════════════════════════════════ отрезки -> полилинии

def stitch(S, weld=0.01, flags=False):
    """Отрезки -> полилинии. Концы склеиваются по решётке `weld` с пробой соседей.

    При flags=True возвращает [(точки, замкнута)], иначе [точки]. Замкнутость нужна заливке:
    закрытый контур — силуэт объекта, открытая цепь — только штрих.
    """
    if len(S) == 0:
        return []
    q = np.round(S / weld).astype(np.int64)
    key = np.empty((len(S), 2), dtype=np.int64)
    pts = {}
    node_xy = []
    # словарь узлов: квантованная точка -> id; при промахе пробуем 8 соседей
    for col, (qa, qb) in enumerate(((q[:, 0], q[:, 1]), (q[:, 2], q[:, 3]))):
        for r in range(len(S)):
            a, b = int(qa[r]), int(qb[r])
            nid = pts.get((a, b))
            if nid is None:
                for da in (-1, 0, 1):
                    for db in (-1, 0, 1):
                        nid = pts.get((a + da, b + db))
                        if nid is not None:
                            break
                    if nid is not None:
                        break
            if nid is None:
                nid = len(node_xy)
                node_xy.append((S[r, 0 + 2 * col], S[r, 1 + 2 * col]))
                pts[(a, b)] = nid
            key[r, col] = nid

    adj = collections.defaultdict(list)
    for r in range(len(S)):
        a, b = int(key[r, 0]), int(key[r, 1])
        if a == b:
            continue
        adj[a].append((b, r))
        adj[b].append((a, r))
    used = np.zeros(len(S), bool)
    ptr = collections.defaultdict(int)

    def walk(start):
        chain = [start]
        cur = start
        while True:
            lst = adj[cur]
            i = ptr[cur]
            while i < len(lst) and used[lst[i][1]]:
                i += 1
            ptr[cur] = i
            if i >= len(lst):
                break
            nb, e = lst[i]
            used[e] = True
            chain.append(nb)
            cur = nb
        return chain

    order = sorted(adj.keys(), key=lambda n: len(adj[n]))   # сначала концы (степень 1)
    out = []
    for n in order:
        while True:
            lst = adj[n]
            i = ptr[n]
            while i < len(lst) and used[lst[i][1]]:
                i += 1
            ptr[n] = i
            if i >= len(lst):
                break
            ch = walk(n)
            if len(ch) >= 2:
                P = np.array([node_xy[c] for c in ch], dtype=np.float64)
                out.append((P, ch[0] == ch[-1]) if flags else P)
    return out


def rdp(P, eps):
    """Рамер-Дуглас-Пекер, итеративно."""
    n = len(P)
    if n <= 3:
        return P
    keep = np.zeros(n, bool)
    keep[0] = keep[-1] = True
    half = n // 2
    keep[half] = True
    stack = [(0, half), (half, n - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        a, b = P[i], P[j]
        d = b - a
        L2 = d[0] * d[0] + d[1] * d[1]
        seg = P[i + 1:j]
        if L2 < 1e-12:
            dist = np.hypot(seg[:, 0] - a[0], seg[:, 1] - a[1])
        else:
            dist = np.abs(d[0] * (a[1] - seg[:, 1]) - (a[0] - seg[:, 0]) * d[1]) / math.sqrt(L2)
        k = int(np.argmax(dist))
        if dist[k] > eps:
            k += i + 1
            keep[k] = True
            stack.append((i, k))
            stack.append((k, j))
    return P[keep]


def plen(P):
    return float(np.hypot(np.diff(P[:, 0]), np.diff(P[:, 1])).sum())


def parea(P):
    """Знаковая площадь замкнутого контура (формула шнурков), м^2."""
    x, y = P[:, 0], P[:, 1]
    return float(0.5 * np.sum(x[:-1] * y[1:] - x[1:] * y[:-1]))
