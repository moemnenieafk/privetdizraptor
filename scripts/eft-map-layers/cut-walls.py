# -*- coding: utf-8 -*-
# Слой «стены зданий по этажам» карты EFT прямо из сцен клиента: ГОРИЗОНТАЛЬНОЕ СЕЧЕНИЕ
# мешей плоскостью y = const на высоте пояса (≈1.2 м над полом этажа) — в рамке нашего HD-растра.
#
# ПОЧЕМУ ИМЕННО СЕЧЕНИЕ. Проекция сверху даёт кашу из крыш и козырьков, а m_LocalAABB —
# только коробки-габариты (они уже сделаны в scripts/eft-rooms/dump-rooms.py и планировку
# не показывают). Рез плоскостью даёт настоящий план: каждый треугольник, пересекающий
# плоскость, отдаёт отрезок; дверные и оконные проёмы становятся разрывами САМИ, без эвристик.
#
# ТРИ ГРАБЛИ, НА КОТОРЫЕ ЗДЕСЬ УЖЕ НАСТУПИЛИ
#   1) UnityPy Mesh.export() ЗЕРКАЛИТ X (пишет `-pos[0]` — конверсия в правую систему OBJ).
#      Через export()/OBJ читать НЕЛЬЗЯ: весь слой ляжет отражённым, и заметно это не сразу.
#      Здесь вершины берутся из MeshHandler напрямую, в родных координатах Unity.
#   2) LOD-дубли. У сущности со СВОИМ MeshFilter дети `lod[*]` лишние (иначе тройные контуры);
#      `lod[0]` берётся только там, где своего меша нет. Плюс отсев по имени `_LOD1/2/3`,
#      `*_SHADOW*`, `*_BALLISTIC*` — это прокси-геометрия.
#   3) Ветка GARLANDS. У Таможни 18 514 меш-узлов — новогодние гирлянды (`XMAS_WIRE_big/small`),
#      провода поперёк всей карты на высоте пояса. В стены их пускать нельзя, отсеиваются.
#      Туда же: OO/LIGHT, OO/EFFECTS, декали плитки `*_TILE*`, и вся сцена *_background
#      (декорации горизонта размером 1367x1996 м).
#
# КЛАССЫ ОТРЕЗКОВ (источник сохраняется — слой 7 «препятствия выше 1 м» получается
# разложением этого выхода, без пересборки):
#   building  SOO_LOD0/BUILDING(S), OO/BUILDING, COLUMNS  — собственно стены и колонны
#   openings  SOO_LOD0/DOORS, WINDOWS, OO/DOORS           — полотна дверей и рамы окон
#   fence     SOO_LOD0/Fence*, ConcreteBlocks             — заборы и бетонные блоки
#   props     OO/PROPS, LOOTABLE, OUTDOOR и прочее        — шум: стеллажи, шкафы, машины
# building дополнительно делится на НАРУЖНЫЕ и ВНУТРЕННИЕ: контур, до которого дотягивается
# заливка снаружи карты — наружный, остальное — внутренние перегородки.
#
# ВЫСОТА РЕЗА. Полосы этажей берутся из manifest.json карты (layers[].heights):
#   рез = низ полосы + 1.2 м. Два особых случая:
#     main         низ полосы -1000 (это «всё») -> рез = ЗЕМЛЯ ПОД СУЩНОСТЬЮ + 1.2, то есть
#                  плоскость не одна, а своя у каждого здания (карта высот слоя ground).
#     underground  низ полосы -1000 -> уровень пола оценивается по МОДЕ нижних граней
#                  building-геометрии, целиком лежащей ниже верха полосы; рез = мода + 1.2.
#                  Это оценка, а не факт из клиента — скрипт печатает её вслух.
#
# КООРДИНАТЫ. Мир -> пиксель считается из manifest.json и СВЕРЯЕТСЯ с эталонной аффиной слоя
#   комнат (…/rooms/<map>-rooms-frame.json); расхождение > 0.01 px = падение. Та аффина
#   проверена независимо (двери клиента против наших замков, 33/34 в пределах 5 см).
#   `coordinateRotation: 180` у BSG — это ОТРАЖЕНИЕ по X (a1 отрицательный), а не поворот.
#
# Вход:  <EscapeFromTarkov_Data>  каталог клиента
#        <map>                    id карты портала (customs, lighthouse, …)
#        <manifest>               manifest.json карты (crop, boundsFromConfig, layers[].heights)
#        <outdir>                 куда писать
#        [--height <npy>]         карта высот; по умолчанию ../ground/<map>-height-meters.npy
#        [--no-props]             не резать ветку props (только стены) — быстрый прогон
# Выход: <map>-walls-<layer>.svg        рамка растра, группы walls-outer/walls-inner/openings/fence/props
#        <map>-walls-<layer>-check.jpg  наложение на наш HD-арт (глазная проверка)
#        <map>-walls.json               сводка: высоты реза, счётчики по классам, состав шума
#
# Запуск:
#   python scripts/eft-map-layers/cut-walls.py "D:/Games/Escape from Tarkov/EscapeFromTarkov_Data" \
#          customs D:/Games/raster/customs/manifest.json map-exports/OBJECTS-MAPS/gen/customs/walls
#
# Зависимости: UnityPy 1.25, numpy, Pillow. Новых не заводится.

import sys, os, re, json, math, time, collections

import numpy as np
from PIL import Image, ImageDraw
import UnityPy
from UnityPy.helpers.MeshHelper import MeshHandler

Image.MAX_IMAGE_PIXELS = None

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

# ─────────────────────────────────────────── аргументы

argv = sys.argv[1:]
HEIGHT_ARG = None
if '--height' in argv:
    i = argv.index('--height')
    HEIGHT_ARG = argv[i + 1]
    del argv[i:i + 2]
WANT_PROPS = True
if '--no-props' in argv:
    WANT_PROPS = False
    argv.remove('--no-props')
if len(argv) < 4:
    sys.exit('использование: python scripts/eft-map-layers/cut-walls.py '
             '<EscapeFromTarkov_Data> <map> <manifest> <outdir> [--height <npy>] [--no-props]')

DATA, MAP_ID, MAN_PATH, OUTDIR = argv[0], argv[1], argv[2], argv[3]
os.makedirs(OUTDIR, exist_ok=True)

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCENES_JSON = os.path.join(REPO, 'docs', 'registry', 'eft-scenes.json')

MAP2GROUP = {
    'customs': 'Custom', 'factory': 'Factory', 'woods': 'Woods', 'shoreline': 'shorline',
    'lighthouse': 'Lighthouse', 'interchange': 'Shopping_Mall', 'reserve': 'Reserve_Base',
    'the-lab': 'Laboratory', 'streets-of-tarkov': 'City', 'ground-zero': 'Sandbox',
    'labyrinth': 'Labyrinth', 'terminal': 'Terminal',
}

# ─────────────────────────────────────────── настройки

BELT = 1.2            # м над полом этажа: высота пояса, на которой режем
WELD = 0.01           # м: допуск сшивки концов отрезков в полилинии (1 см)
SIMPLIFY = 0.02       # м: допуск Дугласа-Пекера при упрощении полилинии
MIN_LEN = 0.12        # м: полилинии короче выбрасываются (осколки триангуляции)
OUTER_SCALE = 2       # во сколько раз мельче рабочий растр для теста «наружная/внутренняя»
OUTER_FRAC = 0.25     # доля точек полилинии, касающихся внешней области -> наружная стена
DOOR_CLOSE = 1.1      # м: на время теста стены утолщаются на столько, чтобы дверные проёмы
                      # закрылись и заливка снаружи не протекала внутрь здания

CLASSES = ['building', 'openings', 'fence', 'props']
# Ветка иерархии (второй/третий уровень пути) -> класс. Порядок проверки — сверху вниз.
BRANCH_RULES = [
    (r'/GARLANDS/', None),                       # новогодние провода поперёк карты
    (r'/OO/LIGHT(/|$)', None),
    (r'/OO/INTERACTIVE_light(/|$)', None),
    (r'/OO/EFFECTS(/|$)', None),
    (r'/OO/ROAD(/|$)', None),
    (r'_TILE(_|\b)', None),                      # декали плитки на стенах
    (r'/SOO_LOD0/(BUILDING|BUILDINGS|COLUMNS)(/|$)', 'building'),
    (r'/OO/BUILDING(/|$)', 'building'),
    (r'/SOO_LOD0/(DOORS|WINDOWS)(/|$)', 'openings'),
    (r'/OO/DOORS(/|$)', 'openings'),
    (r'/SOO_LOD0/(Fence|ConcreteBlocks)', 'fence'),
    (r'.', 'props'),
]
BRANCH_RULES = [(re.compile(rx, re.I), cls) for rx, cls in BRANCH_RULES]
SKIP_MESH = re.compile(r'(_LOD[123]\b|SHADOW|BALLISTIC|COLLIDER)', re.I)
SKIP_SCENE = re.compile(r'(terrain|sound|culling|background)', re.I)

COLORS = {'walls-outer': '#ffffff', 'walls-inner': '#ff8a00',
          'openings': '#00d0ff', 'fence': '#7cff5a', 'props': '#ff3b6b'}
GROUP_ORDER = ['props', 'fence', 'openings', 'walls-inner', 'walls-outer']

t_start = time.time()


def log(*a):
    print(f'[{time.time() - t_start:6.1f}s]', *a, flush=True)


def fmt(v):
    return f'{v:,.0f}'.replace(',', ' ')


# ─────────────────────────────────────────── кадр: мир (метры) -> пиксель растра

man = json.load(open(MAN_PATH, encoding='utf-8'))
(_ax, _az), (_bx, _bz) = man['boundsFromConfig']
XMIN, XMAX = min(_ax, _bx), max(_ax, _bx)
ZMIN, ZMAX = min(_az, _bz), max(_az, _bz)
RW = man['crop']['width']
RH = man['crop']['height']
MIRROR_X = (man.get('coordinateRotation', 0) == 180)
SX = (RW - 1) / (XMAX - XMIN)
SZ = (RH - 1) / (ZMAX - ZMIN)
AFF = dict(px_from_x=[(RW - 1) + XMIN * SX, -SX] if MIRROR_X else [-XMIN * SX, SX],
           py_from_z=[-ZMIN * SZ, SZ])
A0, A1 = AFF['px_from_x']
B0, B1 = AFF['py_from_z']
MPP = (XMAX - XMIN) / (RW - 1)

log(f'рамка {MAP_ID}: {RW}x{RH} px, {MPP * 100:.2f} см/px, отражение по X: '
    f'{"да" if MIRROR_X else "нет"}')
log(f'  px = {A0:.3f}{A1:+.6f}*gx     py = {B0:.3f}{B1:+.6f}*gz')

# сверка с эталонной аффиной слоя комнат — привязка обязана совпасть до 0.01 px
_frame = os.path.join(os.path.dirname(os.path.abspath(OUTDIR)), 'rooms', f'{MAP_ID}-rooms-frame.json')
if os.path.exists(_frame):
    ref = json.load(open(_frame, encoding='utf-8')).get('affine') or {}
    bad = [k for k in ('px_from_x', 'py_from_z')
           if k in ref and max(abs(a - b) for a, b in zip(ref[k], AFF[k])) > 0.01]
    if bad:
        sys.exit(f'привязка разошлась с {_frame}: {bad} — резать стены нельзя')
    log(f'  привязка сверена с {os.path.basename(_frame)}: совпадает')
else:
    log(f'  ! эталонной аффины {_frame} нет — сверить не с чем')


# ─────────────────────────────────────────── чтение сцен

def qmul(a, b):
    ax, ay, az, aw = a; bx, by, bz, bw = b
    return (aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz)


def qrot(q, v):
    x, y, z, w = q; vx, vy, vz = v
    tx, ty, tz = 2 * (y * vz - z * vy), 2 * (z * vx - x * vz), 2 * (x * vy - y * vx)
    return (vx + w * tx + y * tz - z * ty, vy + w * ty + z * tx - x * tz, vz + w * tz + x * ty - y * tx)


class Scene:
    """Сцена levelN: иерархия, мировой TRS, компоненты, ссылки на меши."""

    def __init__(self, level):
        self.level = level
        self.env = UnityPy.load(os.path.join(DATA, level))
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


def classify(path):
    for rx, cls in BRANCH_RULES:
        if rx.search(path):
            return cls
    return None


def collect(scene):
    """Меш-узлы сцены после разбора LOD -> список экземпляров с мировым TRS и классом."""
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
        if SKIP_MESH.search(p):
            continue
        cls = classify(p)
        if cls is None or (cls == 'props' and not WANT_PROPS):
            continue
        trp = scene.go_tr.get(go)
        if trp is None:
            continue
        pos, rot, sc = scene.trs(trp)
        name = scene.go_name.get(go) or ''
        if LOD_RE.match(name):
            name = scene.go_name.get(scene.parent_go(go)) or name
        src, pid = own[go]
        out.append((src, pid, pos, rot, sc, cls, name, p.split('/')[1:3]))
    return out


groups = json.load(open(SCENES_JSON, encoding='utf-8'))
group = MAP2GROUP.get(MAP_ID)
if group is None or group not in groups:
    sys.exit(f'карта {MAP_ID}: группы сцен нет в {SCENES_JSON}')

inst = []
skipped_scenes = []
for e in groups[group]:
    lvl, nm = f"level{e['level']}", e['scene']
    if not os.path.exists(os.path.join(DATA, lvl)):
        continue
    if SKIP_SCENE.search(nm):
        skipped_scenes.append(f'{lvl} ({nm})')
        continue
    try:
        sc = Scene(lvl)
    except Exception as ex:
        log(f'  {lvl} ({nm}): ОШИБКА чтения — {ex}')
        continue
    got = collect(sc)
    inst += got
    by = collections.Counter(g[5] for g in got)
    log(f'  {lvl:9s} {nm:48s} экземпляров {len(got):6d}  ' +
        ' '.join(f'{k}={v}' for k, v in sorted(by.items())))
    del sc
log(f'сцен пропущено: {len(skipped_scenes)} {skipped_scenes}')
by_cls = collections.Counter(g[5] for g in inst)
log(f'экземпляров всего {fmt(len(inst))}: ' + ', '.join(f'{k}={fmt(v)}' for k, v in sorted(by_cls.items())))

# ─────────────────────────────────────────── меши: чтение без export()

_mesh_files = {}


def load_mesh(src, pid):
    """(верш. Nx3 float32 в ЛОКАЛЬНЫХ координатах Unity, треуг. Mx3 int32).

    Читается MeshHandler-ом напрямую. Mesh.export() здесь НЕ используется сознательно:
    он пишет -pos[0] и зеркалит X у каждого меша по отдельности.
    """
    if src not in _mesh_files:
        try:
            _mesh_files[src] = {o.path_id: o for o in UnityPy.load(os.path.join(DATA, src)).objects
                                if o.type.name == 'Mesh'}
        except Exception:
            _mesh_files[src] = {}
    o = _mesh_files[src].get(pid)
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


_aabb = {}


def local_aabb(src, pid):
    """m_LocalAABB меша: (центр, полуразмер). Вершины не читаем — Unity уже посчитала."""
    key = (src, pid)
    if key in _aabb:
        return _aabb[key]
    r = None
    if src not in _mesh_files:
        try:
            _mesh_files[src] = {o.path_id: o for o in UnityPy.load(os.path.join(DATA, src)).objects
                                if o.type.name == 'Mesh'}
        except Exception:
            _mesh_files[src] = {}
    o = _mesh_files[src].get(pid)
    if o is not None:
        try:
            a = o.read_typetree()['m_LocalAABB']
            r = ((a['m_Center']['x'], a['m_Center']['y'], a['m_Center']['z']),
                 (a['m_Extent']['x'], a['m_Extent']['y'], a['m_Extent']['z']))
        except Exception:
            r = None
    _aabb[key] = r
    return r


log('считаю габариты экземпляров по m_LocalAABB…')
boxes = np.full((len(inst), 6), np.nan, dtype=np.float64)   # xlo,ylo,zlo,xhi,yhi,zhi
for i, (src, pid, pos, rot, sc, cls, name, br) in enumerate(inst):
    a = local_aabb(src, pid)
    if a is None:
        continue
    (cx, cy, cz), (ex, ey, ez) = a
    lo = [1e18] * 3
    hi = [-1e18] * 3
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                r = qrot(rot, ((cx + sx * ex) * sc[0], (cy + sy * ey) * sc[1], (cz + sz * ez) * sc[2]))
                for k, v in enumerate((pos[0] + r[0], pos[1] + r[1], pos[2] + r[2])):
                    lo[k] = min(lo[k], v)
                    hi[k] = max(hi[k], v)
    boxes[i, :3] = lo
    boxes[i, 3:] = hi
    if i and i % 20000 == 0:
        log(f'  {fmt(i)} / {fmt(len(inst))}')
ok_box = ~np.isnan(boxes[:, 0])
log(f'габариты есть у {fmt(int(ok_box.sum()))} из {fmt(len(inst))}')

# ─────────────────────────────────────────── карта высот (этаж main)

HEIGHT_NPY = HEIGHT_ARG or os.path.join(os.path.dirname(os.path.abspath(OUTDIR)), 'ground',
                                        f'{MAP_ID}-height-meters.npy')
Hgrid = np.load(HEIGHT_NPY) if os.path.exists(HEIGHT_NPY) else None
if Hgrid is not None:
    log(f'земля: {os.path.basename(HEIGHT_NPY)} {Hgrid.shape}, '
        f'{np.nanmin(Hgrid):.1f}..{np.nanmax(Hgrid):.1f} м')
else:
    log(f'! карты высот {HEIGHT_NPY} нет — этаж main будет резаться по медиане низов зданий')


def ground_at(x, z):
    """Высота земли по террейну слоя ground (та же рамка карты, но с отражением по X)."""
    gh, gw = Hgrid.shape
    u = (x - XMIN) / (XMAX - XMIN) * (gw - 1)
    if MIRROR_X:
        u = (gw - 1) - u
    v = (z - ZMIN) / (ZMAX - ZMIN) * (gh - 1)
    c = int(round(u)); r = int(round(v))
    if not (0 <= c < gw and 0 <= r < gh):
        return float('nan')
    return float(Hgrid[r, c])


# ─────────────────────────────────────────── высоты реза по этажам

cls_arr = np.array([g[5] for g in inst])
LAYERS = []
for L in man['layers']:
    lo, hi = L['heights']
    LAYERS.append(dict(id=L['id'], lo=float(lo), hi=float(hi)))

cut_note = {}
for L in LAYERS:
    if L['lo'] > -900:
        L['cut'] = L['lo'] + BELT
        cut_note[L['id']] = f'низ полосы {L["lo"]:.1f} + {BELT} м'
        continue
    if L['id'] == 'underground' or L['hi'] < 900:
        # пол подземки в клиенте не размечен: берём МОДУ нижних граней building-геометрии,
        # целиком лежащей ниже верха полосы (плиты пола кластеризуются на одном уровне)
        sel = ok_box & (cls_arr == 'building') & (boxes[:, 4] <= L['hi']) & (boxes[:, 1] > -60)
        vals = boxes[sel, 1]
        if len(vals) >= 20:
            h, edges = np.histogram(vals, bins=np.arange(-60, L['hi'] + 0.5, 0.5))
            floor = float(edges[int(np.argmax(h))])
        else:
            floor = L['hi'] - 2.5
        L['cut'] = floor + BELT
        cut_note[L['id']] = (f'ОЦЕНКА: мода низов {len(vals)} building-мешей ниже {L["hi"]:.1f} '
                             f'-> пол {floor:.2f} + {BELT} м')
    else:
        L['cut'] = None      # main: своя плоскость у каждой сущности (земля + пояс)
        cut_note[L['id']] = f'ЗЕМЛЯ ПОД СУЩНОСТЬЮ + {BELT} м (карта высот слоя ground)'

if Hgrid is None:
    for L in LAYERS:
        if L['cut'] is None:
            sel = ok_box & (cls_arr == 'building')
            L['cut'] = float(np.median(boxes[sel, 1])) + BELT
            cut_note[L['id']] = f'фолбэк: медиана низов зданий + {BELT} м'

print()
log('ВЫСОТЫ РЕЗА (абсолютные, метры игрового мира):')
for L in LAYERS:
    if L['cut'] is None:
        gs = []
        sel = np.nonzero(ok_box & (cls_arr == 'building'))[0]
        for i in sel[:: max(1, len(sel) // 2000)]:
            g = ground_at((boxes[i, 0] + boxes[i, 3]) / 2, (boxes[i, 2] + boxes[i, 5]) / 2)
            if not math.isnan(g):
                gs.append(g + BELT)
        rng = f'{min(gs):.2f} … {max(gs):.2f} (медиана {np.median(gs):.2f})' if gs else '—'
        log(f'  {L["id"]:12s} полоса [{L["lo"]:.1f}, {L["hi"]:.1f}]  рез = {rng}   [{cut_note[L["id"]]}]')
    else:
        log(f'  {L["id"]:12s} полоса [{L["lo"]:.1f}, {L["hi"]:.1f}]  рез = {L["cut"]:.2f} м   '
            f'[{cut_note[L["id"]]}]')
print()

# ─────────────────────────────────────────── план резов: что резать и на какой высоте

tasks = collections.defaultdict(list)     # (src,pid) -> [(idx экземпляра, layer_id, h)]
n_task = collections.Counter()
for L in LAYERS:
    lid = L['id']
    for i in np.nonzero(ok_box)[0]:
        if L['cut'] is None:
            g = ground_at((boxes[i, 0] + boxes[i, 3]) / 2, (boxes[i, 2] + boxes[i, 5]) / 2)
            if math.isnan(g):
                continue
            h = g + BELT
        else:
            h = L['cut']
        if boxes[i, 1] <= h <= boxes[i, 4]:
            tasks[(inst[i][0], inst[i][1])].append((int(i), lid, h))
            n_task[lid] += 1
log('резов запланировано: ' + ', '.join(f'{k}={fmt(v)}' for k, v in n_task.items()) +
    f'; уникальных мешей к чтению {fmt(len(tasks))}')


# ─────────────────────────────────────────── сечение меша плоскостью

def slice_mesh(V, F, pos, rot, sc, h):
    """Отрезки пересечения мировой геометрии с плоскостью y = h. -> (M,4) float64 [x0,z0,x1,z1]."""
    qx, qy, qz, qw = rot
    S = V * np.array(sc, dtype=np.float32)
    x, y, z = S[:, 0], S[:, 1], S[:, 2]
    tx = 2 * (qy * z - qz * y); ty = 2 * (qz * x - qx * z); tz = 2 * (qx * y - qy * x)
    wx = (x + qw * tx + qy * tz - qz * ty) + pos[0]
    wy = (y + qw * ty + qz * tx - qx * tz) + pos[1]
    wz = (z + qw * tz + qx * ty - qy * tx) + pos[2]

    Yt = wy[F]                                   # (n,3)
    s = Yt > h
    cnt = s.sum(1)
    sel = (cnt == 1) | (cnt == 2)
    if not sel.any():
        return None
    Ft = F[sel]
    st = s[sel]
    yt = Yt[sel]
    apex = np.where(st.sum(1)[:, None] == 1, st, ~st).argmax(1)
    o1 = (apex + 1) % 3
    o2 = (apex + 2) % 3
    r = np.arange(len(Ft))
    ia, i1, i2 = Ft[r, apex], Ft[r, o1], Ft[r, o2]
    ya, y1, y2 = yt[r, apex], yt[r, o1], yt[r, o2]
    d1 = y1 - ya
    d2 = y2 - ya
    d1 = np.where(np.abs(d1) < 1e-9, 1e-9, d1)
    d2 = np.where(np.abs(d2) < 1e-9, 1e-9, d2)
    t1 = np.clip((h - ya) / d1, 0.0, 1.0)
    t2 = np.clip((h - ya) / d2, 0.0, 1.0)
    xa, za = wx[ia], wz[ia]
    out = np.empty((len(Ft), 4), dtype=np.float64)
    out[:, 0] = xa + t1 * (wx[i1] - xa)
    out[:, 1] = za + t1 * (wz[i1] - za)
    out[:, 2] = xa + t2 * (wx[i2] - xa)
    out[:, 3] = za + t2 * (wz[i2] - za)
    keep = (np.abs(out[:, 0] - out[:, 2]) > 1e-6) | (np.abs(out[:, 1] - out[:, 3]) > 1e-6)
    return out[keep] if keep.any() else None


segs = {L['id']: {c: [] for c in CLASSES} for L in LAYERS}
n_read = n_fail = 0
tri_total = 0
t_slice = time.time()
# порядок по файлу мешей: шаренные .assets весят сотни МБ, перечитывать их накладно
order = sorted(tasks.items(), key=lambda kv: (kv[0][0], kv[0][1]))
for k, (key, jobs) in enumerate(order):
    m = load_mesh(key[0], key[1])
    if m is None:
        n_fail += 1
        continue
    V, F = m
    n_read += 1
    tri_total += len(F) * len(jobs)
    for i, lid, h in jobs:
        src, pid, pos, rot, sc, cls, name, br = inst[i]
        r = slice_mesh(V, F, pos, rot, sc, h)
        if r is not None:
            segs[lid][cls].append(r)
    if k and k % 2000 == 0:
        log(f'  сечение {fmt(k)} / {fmt(len(tasks))} мешей, '
            f'{fmt(sum(len(a) for d in segs.values() for v in d.values() for a in v))} блоков '
            f'[{time.time() - t_slice:.0f}s]')
    if len(_mesh_files) > 3:
        keep = {key[0]: _mesh_files[key[0]]} if key[0] in _mesh_files else {}
        _mesh_files.clear()
        _mesh_files.update(keep)

seg_arr = {}
for lid in segs:
    seg_arr[lid] = {}
    for c in CLASSES:
        v = segs[lid][c]
        seg_arr[lid][c] = np.concatenate(v) if v else np.zeros((0, 4))
    segs[lid] = None
n_seg = {lid: {c: len(seg_arr[lid][c]) for c in CLASSES} for lid in seg_arr}
log(f'мешей прочитано {fmt(n_read)} (не прочитано {n_fail}), треугольников обработано '
    f'{fmt(tri_total)}')
for lid in seg_arr:
    log(f'  {lid:12s} отрезков: ' + ', '.join(f'{c}={fmt(n_seg[lid][c])}' for c in CLASSES))


# ─────────────────────────────────────────── сшивка отрезков в полилинии

def stitch(S, weld=WELD):
    """Отрезки -> полилинии. Концы склеиваются по решётке `weld` с пробой соседей."""
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
        cur = prev_edge = None
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
                out.append(np.array([node_xy[c] for c in ch], dtype=np.float64))
    return out


def rdp(P, eps):
    """Рамер–Дуглас–Пекер, итеративно."""
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


paths = {lid: {c: [] for c in CLASSES} for lid in seg_arr}
for lid in seg_arr:
    for c in CLASSES:
        S = seg_arr[lid][c]
        if not len(S):
            continue
        t0 = time.time()
        ch = stitch(S)
        keep = []
        for P in ch:
            if plen(P) < MIN_LEN:
                continue
            Q = rdp(P, SIMPLIFY)
            if len(Q) >= 2:
                keep.append(Q)
        paths[lid][c] = keep
        log(f'  сшивка {lid}/{c}: {fmt(len(S))} отрезков -> {fmt(len(ch))} цепей -> '
            f'{fmt(len(keep))} путей ({time.time() - t0:.0f}s)')
    seg_arr[lid] = None


# ─────────────────────────────────────────── наружные / внутренние стены

def to_px(P):
    return np.stack([A0 + A1 * P[:, 0], B0 + B1 * P[:, 1]], axis=1)


def flood_runs(free, seed):
    """Заливка 4-связностью, векторно: чередуем строчные и столбцовые пробеги."""
    cur = seed & free
    for _ in range(400):
        before = int(cur.sum())
        for axis in (1, 0):
            f = free if axis == 1 else np.ascontiguousarray(free.T)
            c = cur if axis == 1 else np.ascontiguousarray(cur.T)
            h, w = f.shape
            gid = np.cumsum(~f, axis=1, dtype=np.int64) + (np.arange(h, dtype=np.int64)[:, None] * (w + 2))
            hit = np.zeros(int(gid.max()) + 2, dtype=bool)
            sel = c & f
            if sel.any():
                hit[gid[sel]] = True
            newc = f & hit[gid]
            cur = cur | (newc if axis == 1 else newc.T)
        if int(cur.sum()) == before:
            break
    return cur


def split_outer(plist, blockers=()):
    """building-полилинии -> (наружные, внутренние) по достижимости заливкой снаружи холста.

    В маску заливки кроме стен идут blockers (полотна дверей): проём в ветке BUILDING — это
    полная коробка ~1.1–1.4 м, само полотно лежит в классе openings, и без него заливка
    затекает в каждую комнату и всё становится «наружным».
    """
    if not plist:
        return [], []
    W, H = RW // OUTER_SCALE, RH // OUTER_SCALE
    cell = MPP * OUTER_SCALE                       # метров в клетке рабочего растра
    rad = max(1, int(round(DOOR_CLOSE / 2 / cell)))
    im = Image.new('L', (W + 2, H + 2), 0)
    dr = ImageDraw.Draw(im)
    for P in list(plist) + list(blockers):
        pp = to_px(P) / OUTER_SCALE + 1
        dr.line([(float(a), float(b)) for a, b in pp], fill=255, width=2 * rad + 1)
    wall = np.array(im, dtype=np.uint8) > 0
    free = ~wall
    seed = np.zeros_like(free)
    seed[0, :] = seed[-1, :] = True
    seed[:, 0] = seed[:, -1] = True
    outside = flood_runs(free, seed)
    # заливку отодвинуло утолщение — возвращаем её к осевой линии стены тем же радиусом (+1)
    near = outside
    for _ in range(rad + 1):
        n = near.copy()
        n[1:, :] |= near[:-1, :]
        n[:-1, :] |= near[1:, :]
        n[:, 1:] |= near[:, :-1]
        n[:, :-1] |= near[:, 1:]
        near = n
    outer, inner = [], []
    hh, ww = near.shape
    for P in plist:
        pp = to_px(P) / OUTER_SCALE + 1
        cx = np.clip(np.round(pp[:, 0]).astype(np.int64), 0, ww - 1)
        cy = np.clip(np.round(pp[:, 1]).astype(np.int64), 0, hh - 1)
        frac = float(near[cy, cx].mean())
        (outer if frac >= OUTER_FRAC else inner).append(P)
    return outer, inner


render = {}
for lid in paths:
    o, i = split_outer(paths[lid]['building'], paths[lid]['openings'])
    render[lid] = {'walls-outer': o, 'walls-inner': i,
                   'openings': paths[lid]['openings'], 'fence': paths[lid]['fence'],
                   'props': paths[lid]['props']}
    log(f'  {lid:12s} building {fmt(len(paths[lid]["building"]))} путей -> '
        f'наружных {fmt(len(o))}, внутренних {fmt(len(i))}')


# ─────────────────────────────────────────── запись SVG и превью

ART = [f'D:/Games/raster/{MAP_ID}/{MAP_ID}-{{}}-8192.webp',
       f'D:/Games/raster/{MAP_ID}/{MAP_ID}-{{}}-z6.png']
files = []
summary = {}

for L in LAYERS:
    lid = L['id']
    R = render[lid]
    parts = ['<?xml version="1.0" encoding="UTF-8"?>',
             f'<svg xmlns="http://www.w3.org/2000/svg" width="{RW}" height="{RH}" '
             f'viewBox="0 0 {RW} {RH}">',
             f'<title>{MAP_ID}: стены, этаж {lid}, рез '
             f'{("земля+%.1f м" % BELT) if L["cut"] is None else ("%.2f м" % L["cut"])}</title>']
    for g in GROUP_ORDER:
        src = ('BUILDING' if g.startswith('walls') else
               'SOO_LOD0/DOORS+WINDOWS' if g == 'openings' else
               'SOO_LOD0/Fence' if g == 'fence' else 'OO/PROPS и прочее (шум -> слой 7)')
        parts.append(f'<g id="{g}" data-source="{src}" fill="none" stroke="{COLORS[g]}" '
                     f'stroke-width="{2 if g.startswith("walls") else 1.5}" stroke-linejoin="round" '
                     f'stroke-linecap="round">')
        for P in R[g]:
            pp = to_px(P)
            parts.append('<path d="M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in pp) + '"/>')
        parts.append('</g>')
    parts.append('</svg>')
    p_svg = os.path.join(OUTDIR, f'{MAP_ID}-walls-{lid}.svg')
    open(p_svg, 'w', encoding='utf-8').write('\n'.join(parts))
    files.append(p_svg)

    art = next((t.format(lid) for t in ART if os.path.exists(t.format(lid))), None) \
        or next((t.format('main') for t in ART if os.path.exists(t.format('main'))), None)
    if art:
        base = Image.open(art).convert('RGBA')
        k = base.size[0] / RW
        ov = Image.new('RGBA', base.size, (0, 0, 0, 0))
        dr = ImageDraw.Draw(ov)
        for g in GROUP_ORDER:
            col = tuple(int(COLORS[g][j:j + 2], 16) for j in (1, 3, 5)) + (245,)
            wdt = 2 if g.startswith('walls') else 1
            for P in R[g]:
                pp = to_px(P) * k
                if len(pp) >= 2:
                    dr.line([(float(a), float(b)) for a, b in pp], fill=col, width=wdt)
        p_jpg = os.path.join(OUTDIR, f'{MAP_ID}-walls-{lid}-check.jpg')
        Image.alpha_composite(base, ov).convert('RGB').save(p_jpg, quality=88)
        files.append(p_jpg)
        del base, ov

    summary[lid] = dict(
        band=[L['lo'], L['hi']],
        cutMeters=L['cut'], cutRule=cut_note[lid],
        segments={c: n_seg[lid][c] for c in CLASSES},
        paths={g: len(R[g]) for g in GROUP_ORDER},
        lengthM={g: round(sum(plen(P) for P in R[g]), 1) for g in GROUP_ORDER})
    log(f'{lid}: ' + ', '.join(f'{g}={len(R[g])}' for g in GROUP_ORDER) + f' -> {p_svg}')

# ─────────────────────────────────────────── состав шума (для слоя 7)

noise = collections.Counter()
for i, g in enumerate(inst):
    if g[5] == 'props':
        noise['/'.join(g[7])] += 1

doc = dict(
    _='Слой «стены» карты EFT: горизонтальное сечение мешей плоскостью на высоте пояса. '
      'Группы SVG: walls-outer / walls-inner (ветка BUILDING), openings (DOORS+WINDOWS), '
      'fence, props (шум — сырьё для слоя 7 «препятствия выше 1 м»). '
      'В пиксель растра: px = frame.affine.px_from_x[0] + [1]*X, py = frame.affine.py_from_z[0] + [1]*Z.',
    map=MAP_ID, generated=time.strftime('%Y-%m-%d'),
    source=dict(client=DATA, registry='docs/registry/eft-scenes.json',
                skippedScenes=skipped_scenes, manifest=MAN_PATH.replace('\\', '/'),
                heightMap=HEIGHT_NPY.replace('\\', '/') if Hgrid is not None else None),
    frame=dict(width=RW, height=RH, affine=AFF, metersPerPixel=MPP,
               coordinateRotation=man.get('coordinateRotation', 0), mirrorX=MIRROR_X),
    method=dict(belt=BELT, weld=WELD, simplify=SIMPLIFY, minLen=MIN_LEN,
                meshReader='UnityPy MeshHandler (Mesh.export() НЕ используется: зеркалит X)',
                lodPolicy='свой MeshFilter = LOD0; иначе только дети lod[0]; '
                          'отсев _LOD1/2/3, SHADOW, BALLISTIC, COLLIDER'),
    instances={c: int(by_cls.get(c, 0)) for c in CLASSES},
    meshesRead=n_read, meshesFailed=n_fail, trianglesProcessed=int(tri_total),
    layers=summary,
    noiseBranches=noise.most_common(40),
)
p_json = os.path.join(OUTDIR, f'{MAP_ID}-walls.json')
json.dump(doc, open(p_json, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
files.append(p_json)

# ─────────────────────────────────────────── отчёт

print()
print(f'=== СТЕНЫ {MAP_ID} ' + '=' * 46)
for L in LAYERS:
    lid = L['id']
    s = summary[lid]
    cut = 'земля+%.1f' % BELT if L['cut'] is None else '%.2f' % L['cut']
    print(f'  {lid:12s} рез {cut:>10s} м | отрезков {fmt(sum(s["segments"].values())):>9s} | '
          + ' '.join(f'{g}={fmt(s["paths"][g])}' for g in GROUP_ORDER))
print(f'  мешей прочитано {fmt(n_read)}, треугольников {fmt(tri_total)}, '
      f'экземпляров {fmt(len(inst))}')
print('  состав шума (props), топ веток:')
for k, v in noise.most_common(10):
    print(f'    {fmt(v):>8s}  {k}')
print('  файлы:')
for f in files:
    print('   ', f)
