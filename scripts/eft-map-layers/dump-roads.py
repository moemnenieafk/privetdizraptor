# -*- coding: utf-8 -*-
# Слой «дороги» карты EFT прямо из сцен клиента: асфальтовое полотно, разметка,
# площадки/парковки и тротуары — в рамке нашего HD-растра (SVG + PNG + JSON).
#
# ОТКУДА ЧТО БЕРЁТСЯ
#   Дороги живут в ОТДЕЛЬНОЙ сцене карты (у Таможни — custom_Road = level14,
#   у Маяка — Lighthouse_Roads = level195). Соответствие «карта -> сцены» читается из
#   docs/registry/eft-scenes.json; нужная сцена выбирается по имени (см. MAPS ниже).
#   Меши ЗАПЕЧЕНЫ и лежат инлайн (m_MeshCompression=0, m_StreamData пуст) — Unity не нужен,
#   UnityPy читает вершины и индексы напрямую.
#
# ЧЕТЫРЕ ГРАБЛИ, НА КОТОРЫЕ ЗДЕСЬ УЖЕ НАСТУПИЛИ
#   1) LOD. Сплайновый генератор BSG кладёт под каждый участок детей `lod[N]` и
#      `road[K]  lod[N]`. Взять всё подряд — посчитать одну и ту же дорогу до 20 раз
#      (423 меша против ~165 реальных). Правило: если у узла-сущности есть СВОЙ MeshFilter —
#      это LOD0, берём его и игнорируем детей lod[*]; если своего меша нет — берём только
#      детей `lod[0]` (их бывает несколько: `road[0] lod[0]`, `road[1] lod[0]` — это куски
#      одного сплайна, а не дубли).
#   2) UnityPy Mesh.export() ЗЕРКАЛИТ X (пишет `-pos[0]` — конверсия в правую систему OBJ).
#      Через OBJ читать нельзя: каждый несимметричный кусок ляжет отражённым. Здесь вершины
#      берутся из MeshHandler напрямую, в родных координатах Unity.
#   3) Реквизит. В сцене дорог половина объектов — `OO/PROPS` (мусор, бордюры, колёса).
#      Отдельная ловушка вне этой сцены: `road_group1..5` в level6/level18 — это НЕ дороги,
#      а Transform-группы реквизита (внутри `road_group4` 96 автомобильных колёс), равно как
#      `factory_parking_group*` и `steamshop_big_parking`. Полотно только под `OO/ROAD`.
#   4) Дубли поверх полотна: `* puddle`, `*_puddle`, `*_water` — лужи и вода координата
#      в координату поверх асфальта (`road_factory4_water` — полный клон `road_factory4`).
#
# КООРДИНАТЫ. Мир -> пиксель берётся ГОТОВОЙ аффиной из манифеста рамки
#   (map-exports/OBJECTS-MAPS/gen/customs/rooms/customs-rooms-frame.json):
#     px = a0 + a1*gx,  py = b0 + b1*gz.
#   Она проверена независимо (двери клиента против наших замков, 33/34 в пределах 5 см)
#   и здесь НЕ выводится заново. `coordinateRotation: 180` у BSG — это ОТРАЖЕНИЕ по X
#   (a1 отрицательный), а не поворот.
#
# КЛИП ПО ЗОНЕ. Заметная доля асфальта — фоновое шоссе ЗА игровой зоной (уходит до X ≈ -1251).
#   Маска зоны берётся из аргумента (её делает слой «зона»), а если её ещё нет —
#   считается тут же по границе уровня: BoxCollider-панели корня Custom_LevelBorders
#   из сцены скриптов + заливка от центра карты. Пишутся ОБА варианта — клипованный и полный.
#
# ВХОД:  <EscapeFromTarkov_Data>  каталог клиента
#        <map>                    id карты портала (customs, lighthouse, …)
#        <manifest>               JSON рамки растра: width/height/affine (…-rooms-frame.json)
#        <outdir>                 куда писать
#        [zone-mask.png]          необяз.: готовая маска игровой зоны (белое = внутри)
# ВЫХОД: <map>-roads.svg / -roads-full.svg   контуры в рамке растра, 4 группы
#        <map>-roads.png / -roads-full.png   заливка той же сетки (полотно 255, разметка 200,
#                                            площадки 170, тротуары 90)
#        <map>-roads.json                    план-геометрия в мировых метрах + классификация
#        <map>-roads-check.jpg               наложение на наш HD-арт (если арт найден)
#
# Запуск:
#   python scripts/eft-map-layers/dump-roads.py "D:/Games/Escape from Tarkov/EscapeFromTarkov_Data" \
#          customs map-exports/OBJECTS-MAPS/gen/customs/rooms/customs-rooms-frame.json \
#          map-exports/OBJECTS-MAPS/gen/customs/roads
#
# Зависимости: UnityPy 1.25, numpy, Pillow. Новых не заводится.

import sys, os, re, json, math, time, collections

import numpy as np
from PIL import Image, ImageDraw
import UnityPy
from UnityPy.helpers.MeshHelper import MeshHandler

Image.MAX_IMAGE_PIXELS = None

if len(sys.argv) < 5:
    sys.exit('использование: python scripts/eft-map-layers/dump-roads.py '
             '<EscapeFromTarkov_Data> <map> <manifest> <outdir> [zone-mask.png]')

DATA     = sys.argv[1]
MAP_ID   = sys.argv[2]
MANIFEST = sys.argv[3]
OUTDIR   = sys.argv[4]
ZONE_PNG = sys.argv[5] if len(sys.argv) > 5 else None

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCENES_JSON = os.path.join(REPO, 'docs', 'registry', 'eft-scenes.json')
os.makedirs(OUTDIR, exist_ok=True)

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

# ───────────────────────────── конфиг карт ─────────────────────────────
# Единого словаря имён между картами у BSG нет — общая только «отдельная сцена дорог».
# Поэтому под каждую карту свои регулярки; всё остальное (LOD, дубли, клип) универсально.
GENERIC = dict(
    road_scene   = r'road',                    # имя сцены дорог в реестре
    road_root    = r'(^|/)ROAD(/|$)',          # поддерево полотна внутри сцены
    props_drop   = r'(^|/)PROPS(/|$)',         # реквизит внутри той же сцены
    extra_scenes = [],                         # доп. сцены (тротуары и т.п.)
    marking      = r'(_line\d|_mark|_solid)',
    lot          = r'(parking|bus_ring|trailer_park|square_kotelnaya|fuel_road|garage0)',
    sidewalk     = r'(sidewalk|side_walk|troto)',
    drop         = r'(puddle|_water(\b|$|\d|\s))',
    border_scene = r'scripts',
    border_root  = r'LevelBorders',
)
MAPS = {
    'customs': dict(GENERIC,
        group='Custom',
        road_scene=r'^custom_Road$',
        extra_scenes=[r'^custom_Tamozhnya$'],   # тротуары sideWalk_10m живут здесь
        border_scene=r'^custom_Scripts$',
        border_root=r'^Custom_LevelBorders'),
    'lighthouse': dict(GENERIC,
        group='Lighthouse',
        road_scene=r'^Lighthouse_Roads$',
        # У Маяка нет узла OO/ROAD — в сцене лежит всё подряд (12 369 GO: контейнеры,
        # коллайдеры, тени). Отбор по ИМЕНАМ полотна: Lighthouse_main_road_*,
        # serpentine_road_*, Road_to_*. Порог отбора ещё не проверен глазами — при
        # первом прогоне Маяка сверить и уточнить, как это сделано для Таможни.
        road_root=r'(road|serpentine|asphalt)',
        border_scene=r'Scripts',
        border_root=r'LevelBorders'),
    'woods':             dict(GENERIC, group='Woods'),
    'shoreline':         dict(GENERIC, group='shorline'),
    'interchange':       dict(GENERIC, group='Shopping_Mall'),
    'reserve':           dict(GENERIC, group='Reserve_Base'),
    'streets-of-tarkov': dict(GENERIC, group='City'),
    'ground-zero':       dict(GENERIC, group='Sandbox'),
    'factory':           dict(GENERIC, group='Factory'),
}
if MAP_ID not in MAPS:
    sys.exit(f'карта «{MAP_ID}» не описана; известны: {", ".join(sorted(MAPS))}')
CFG = MAPS[MAP_ID]

# Геометрический разделитель для имён, по которым «полотно или двор» не читается
# (road_tamojnia1..4, road_factory1..11, безымянные GameObject).
# Габарит (OBB) для этого НЕ ГОДИТСЯ: у кольцевой дороги вокруг завода OBB 830×616 м,
# у дуги моста — 179×79 м, и обе улетают в «площадки». Поэтому ширина считается
# эффективной: w = 2·площадь/периметр плоской проекции. Для ленты w×L это ровно w
# (хоть прямой, хоть гнутой), для квадрата со стороной s — s/2.
LOT_MIN_WIDTH  = 12.0   # м эффективной ширины: уже — точно проезжая часть
LOT_MAX_ASPECT = 8.0    # длина OBB / эфф. ширина: больше — это лента, а не площадка

CLASSES   = ['полотно', 'разметка', 'площадки-парковки', 'тротуары']
DRAWORDER = ['тротуары', 'площадки-парковки', 'полотно', 'разметка']
COLORS    = {'полотно': '#ff8a00', 'разметка': '#ffffff',
             'площадки-парковки': '#00d0ff', 'тротуары': '#7cff5a'}
PNGLEVEL  = {'полотно': 255, 'разметка': 200, 'площадки-парковки': 170, 'тротуары': 90}

t_start = time.time()
def log(*a):
    print(f'[{time.time()-t_start:6.1f}s]', *a, flush=True)

def fmt(v):
    return f'{v:,.0f}'.replace(',', ' ')

# ───────────────────────────── граф сцены ─────────────────────────────
def qmul(a, b):
    ax, ay, az, aw = a; bx, by, bz, bw = b
    return (aw*bx + ax*bw + ay*bz - az*by, aw*by - ax*bz + ay*bw + az*bx,
            aw*bz + ax*by - ay*bx + az*bw, aw*bw - ax*bx - ay*by - az*bz)

def qrot(q, v):
    x, y, z, w = q; vx, vy, vz = v
    tx, ty, tz = 2*(y*vz - z*vy), 2*(z*vx - x*vz), 2*(x*vy - y*vx)
    return (vx + w*tx + y*tz - z*ty, vy + w*ty + z*tx - x*tz, vz + w*tz + x*ty - y*tx)


class Scene:
    """Сцена levelN: иерархия, мировой TRS, компоненты, ссылки на меши."""

    def __init__(self, data_dir, level):
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
        for o in self.env.objects:
            if o.type.name != 'GameObject':
                continue
            for c in o.read_typetree()['m_Component']:
                pid = c['component']['m_PathID']
                co = self.objs.get(pid)
                if co is None:
                    continue
                self.go_comps[o.path_id].append((co.type.name, pid))
                if co.type.name in ('Transform', 'RectTransform'):
                    self.go_tr[o.path_id] = pid
        self.go_name = {o.path_id: o.read_typetree()['m_Name']
                        for o in self.env.objects if o.type.name == 'GameObject'}

    def T(self, pid):
        if pid not in self._tt:
            self._tt[pid] = self.objs[pid].read_typetree()
        return self._tt[pid]

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
            rp = qrot(fr, (lp[0]*fs[0], lp[1]*fs[1], lp[2]*fs[2]))
            res = ((fp[0]+rp[0], fp[1]+rp[1], fp[2]+rp[2]), qmul(fr, lr),
                   (fs[0]*ls[0], fs[1]*ls[1], fs[2]*ls[2]))
        self._trs[pid] = res
        return res

    def parent_go(self, go):
        trp = self.go_tr.get(go)
        if trp is None:
            return None
        fa = self.T(trp)['m_Father']['m_PathID']
        if not fa or fa not in self.objs:
            return None
        return self.T(fa)['m_GameObject']['m_PathID']

    def path(self, go):
        if go in self._path:
            return self._path[go]
        parts = []
        cur = go
        guard = 0
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
                return (self.ext[fid-1] if fid else self.level, mp)
        return None


# ───────────────────────────── меши ─────────────────────────────
_mesh_files = {}
_mesh_cache = {}


def read_mesh(src, pid):
    """(verts Nx3 в ЛОКАЛЬНЫХ координатах Unity, faces Mx3). Без зеркала X — не через OBJ."""
    key = (src, pid)
    if key in _mesh_cache:
        return _mesh_cache[key]
    if src not in _mesh_files:
        _mesh_files[src] = {o.path_id: o for o in UnityPy.load(os.path.join(DATA, src)).objects}
    res = None
    o = _mesh_files[src].get(pid)
    if o is not None and o.type.name == 'Mesh':
        try:
            h = MeshHandler(o.read())
            h.process()
            V = np.asarray(h.m_Vertices, dtype=np.float32).reshape(-1, 3)
            F = [t for sub in h.get_triangles() for t in sub]
            if len(F) and len(V):
                res = (V, np.asarray(F, dtype=np.int32).reshape(-1, 3))
        except Exception as e:
            log('  ! меш', src, pid, 'не прочитан:', e)
    _mesh_cache[key] = res
    return res


# ───────────────────────────── сбор узлов ─────────────────────────────
LOD_RE = re.compile(r'^(?:road\[(\d+)\]\s+)?lod\[(\d+)\]$', re.I)


def collect(scene, want_root, drop_root, tag):
    """Меш-узлы сцены после разбора LOD."""
    want = re.compile(want_root, re.I) if want_root else None
    drop = re.compile(drop_root, re.I) if drop_root else None

    own_mesh = {}
    for go in scene.go_name:
        mr = scene.mesh_ref(go)
        if mr:
            own_mesh[go] = mr

    lod_children = collections.defaultdict(list)   # parent go -> [(уровень, go)]
    plain = []
    for go in own_mesh:
        m = LOD_RE.match(scene.go_name.get(go) or '')
        if m:
            lod_children[scene.parent_go(go)].append((int(m.group(2)), go))
        else:
            plain.append(go)

    plain_set = set(plain)
    take = list(plain)
    for par, kids in lod_children.items():
        if par in plain_set:
            continue          # у сущности есть свой (полный) меш — дети lod лишние
        take += [go for lvl, go in kids if lvl == 0]

    rows = []
    for go in take:
        p = scene.path(go)
        if drop and drop.search(p):
            continue
        # корень сцены из отбора выкидываем: он у всех карт содержит слово Road
        # (SBG_Custom_Road, Lighthouse_Roads) и иначе матчит вообще всё
        if want and not want.search(p.split('/', 1)[1] if '/' in p else p):
            continue
        trp = scene.go_tr.get(go)
        if trp is None:
            continue
        pos, rot, sc = scene.trs(trp)
        src, pid = own_mesh[go]
        name = scene.go_name.get(go) or ''
        if LOD_RE.match(name):                       # у узла lod[0] имени нет — берём родителя
            name = scene.go_name.get(scene.parent_go(go)) or name
        rows.append(dict(go=go, name=name, path=p, scene=scene.level, tag=tag,
                         pos=pos, rot=rot, scale=sc, src=src, pid=pid))
    return rows


# ───────────────────────────── классификация ─────────────────────────────
RE_MARK = re.compile(CFG['marking'], re.I)
RE_LOT  = re.compile(CFG['lot'], re.I)
RE_SW   = re.compile(CFG['sidewalk'], re.I)
RE_DROP = re.compile(CFG['drop'], re.I)


def classify(row):
    p, n = row['path'], row['name']
    if row['tag'] == 'sidewalk' or RE_SW.search(p) or RE_SW.search(n):
        return 'тротуары', 'имя'
    if RE_MARK.search(n):
        return 'разметка', 'имя'
    if RE_LOT.search(p) or RE_LOT.search(n):
        return 'площадки-парковки', 'имя'
    return 'полотно', 'по умолчанию'


def plan_obb(P):
    """Ориентированный габарит облака точек в плане: (длина, ширина, угол°)."""
    if len(P) < 3:
        return 0.0, 0.0, 0.0
    C = P - P.mean(0)
    S = C
    if len(C) > 4000:
        S = C[np.linspace(0, len(C)-1, 4000).astype(np.int64)]
    try:
        _, _, Vt = np.linalg.svd(S, full_matrices=False)
    except np.linalg.LinAlgError:
        return 0.0, 0.0, 0.0
    proj = C @ Vt.T
    e = proj.max(0) - proj.min(0)
    return float(max(e)), float(min(e)), math.degrees(math.atan2(Vt[0][1], Vt[0][0]))


def plan_raster(P, F, step=0.5, budget=30_000_000):
    """Плоская проекция одной сущности в свой маленький растр. -> (маска, шаг)."""
    x0, z0 = P.min(0)
    x1, z1 = P.max(0)
    while True:
        w = int((x1-x0)/step) + 3
        h = int((z1-z0)/step) + 3
        if w*h <= budget:
            break
        step *= 2
    im = Image.new('L', (w, h), 0)
    dr = ImageDraw.Draw(im)
    px = (P[:, 0]-x0)/step + 1
    py = (P[:, 1]-z0)/step + 1
    for a, b, c in F:
        dr.polygon([(px[a], py[a]), (px[b], py[b]), (px[c], py[c])], fill=255)
    return np.array(im, dtype=np.uint8) > 0, step


def eff_width(P, F):
    """Эффективная ширина 2·S/P: для ленты — её ширина, независимо от кривизны."""
    m, step = plan_raster(P, F)
    area = float(m.sum())*step*step
    per = float((m[:, :-1] != m[:, 1:]).sum() + (m[:-1, :] != m[1:, :]).sum())*step
    return (2*area/per if per > 0 else 0.0), area


# ───────────────────────────── рамка растра ─────────────────────────────
MF = json.load(open(MANIFEST, encoding='utf-8'))
RW, RH = int(MF['width']), int(MF['height'])
A0, A1 = MF['affine']['px_from_x']
B0, B1 = MF['affine']['py_from_z']
MPP = float(MF.get('metersPerPixel') or abs(1.0/A1))
PX_AREA = abs(1.0/A1) * abs(1.0/B1)          # м² в одном пикселе растра


def from_px(px, py):
    return (px - A0)/A1, (py - B0)/B1


log(f'рамка {RW}×{RH}, px = {A0:.3f}{A1:+.6f}·x, py = {B0:.3f}{B1:+.6f}·z, {MPP*100:.2f} см/px')

# ───────────────────────────── сцены ─────────────────────────────
SCENES = json.load(open(SCENES_JSON, encoding='utf-8'))
grp = SCENES.get(CFG['group']) or []


def pick(rx):
    r = re.compile(rx, re.I)
    return [f"level{s['level']}" for s in grp if r.search(s['scene'] or '')]


road_levels   = pick(CFG['road_scene'])
extra_levels  = [lv for rx in CFG['extra_scenes'] for lv in pick(rx)]
border_levels = pick(CFG['border_scene'])
if not road_levels:
    sys.exit(f'сцена дорог не найдена в реестре для группы {CFG["group"]} по «{CFG["road_scene"]}»')
log('сцена дорог:', road_levels, '| доп. сцены:', extra_levels, '| границы:', border_levels)

rows = []
for lv in road_levels:
    sc = Scene(DATA, lv)
    got = collect(sc, CFG['road_root'], CFG['props_drop'], 'road')
    rows += got
    log(f'  {lv}: GO {len(sc.go_name)}, меш-узлов полотна {len(got)}')
    del sc
for lv in extra_levels:
    sc = Scene(DATA, lv)
    got = collect(sc, CFG['sidewalk'], None, 'sidewalk')
    rows += got
    log(f'  {lv}: тротуаров {len(got)}')
    del sc

# отсев дублей поверх полотна (лужи/вода) и полных клонов по геометрии
dropped_name, dropped_clone, kept = [], [], []
seen = set()
for r in rows:
    if RE_DROP.search(r['name']) or RE_DROP.search(r['path']):
        dropped_name.append(r['name'])
        continue
    sig = (r['src'], r['pid'], round(r['pos'][0], 2), round(r['pos'][2], 2),
           round(r['scale'][0], 3), round(r['scale'][2], 3))
    if sig in seen:
        dropped_clone.append(r['name'])
        continue
    seen.add(sig)
    kept.append(r)
log(f'узлов {len(rows)} -> {len(kept)} (дубли по имени {len(dropped_name)}, клоны по геометрии {len(dropped_clone)})')

# ───────────────────────────── геометрия в плане ─────────────────────────────
log('читаю меши…')
ents = []
for r in kept:
    m = read_mesh(r['src'], r['pid'])
    if not m:
        continue
    V, F = m
    px, py, pz = r['pos']
    sx, sy, sz = r['scale']
    qx, qy, qz, qw = r['rot']
    S = V * np.array([sx, sy, sz], dtype=np.float32)
    x, y, z = S[:, 0], S[:, 1], S[:, 2]
    tx = 2*(qy*z - qz*y); ty = 2*(qz*x - qx*z); tz = 2*(qx*y - qy*x)
    wx = x + qw*tx + qy*tz - qz*ty
    wy = y + qw*ty + qz*tx - qx*tz
    wz = z + qw*tz + qx*ty - qy*tx
    P = np.stack([wx + px, wz + pz], axis=1).astype(np.float64)     # план: (X, Z), метры
    yw = (wy + py).astype(np.float64)
    cls, why = classify(r)
    L, Wd, ang = plan_obb(P)
    we, ar = eff_width(P, F)
    ents.append(dict(row=r, P=P, F=F, cls=cls, why=why, L=L, W=Wd, ang=ang, ew=we, area=ar,
                     ymin=float(yw.min()), ymax=float(yw.max())))
log(f'сущностей {len(ents)}, треугольников {sum(len(e["F"]) for e in ents)}')

# геометрический разделитель для имён, по которым «полотно или двор» не читается
regeom = []
for e in ents:
    if e['cls'] != 'полотно':
        continue
    if e['ew'] >= LOT_MIN_WIDTH and (e['L'] / max(e['ew'], 1e-6)) <= LOT_MAX_ASPECT:
        e['cls'] = 'площадки-парковки'
        e['why'] = 'эфф.ширина'
        regeom.append((e['row']['name'], round(e['ew'], 1), round(e['L'], 1)))
log(f'переклассифицировано по эфф. ширине в площадки: {len(regeom)}')


# ───────────────────────────── маска игровой зоны ─────────────────────────────
def zone_from_png(path):
    im = Image.open(path).convert('L')
    if im.size != (RW, RH):
        log(f'  маска зоны {im.size} != рамка {(RW, RH)} — масштабирую')
        im = im.resize((RW, RH), Image.NEAREST)
    return np.array(im, dtype=np.uint8) > 127


def flood_runs(free, seed):
    """Заливка 4-связностью, векторно: чередуем «залить строчные пробеги» и «столбцовые»."""
    cur = seed & free
    for _ in range(300):
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


def zone_from_borders():
    if not border_levels:
        return None, 'сцена границ не найдена'
    sc = Scene(DATA, border_levels[0])
    rr = re.compile(CFG['border_root'], re.I)
    junk = re.compile(r'(floor|trigger|fake)', re.I)
    segs = []
    skipped_plates = 0
    for go in sc.go_name:
        p = sc.path(go)
        if not rr.search(p.split('/')[0]):
            continue
        if junk.search(p):                          # BLOCKER_FAKE_FLOOR, trigger_hurt_fire и т.п.
            continue
        trp = sc.go_tr.get(go)
        if trp is None:
            continue
        pos, rot, s = sc.trs(trp)
        for tn, pid in sc.go_comps.get(go, []):
            if tn != 'BoxCollider':
                continue
            b = sc.T(pid); sz = b['m_Size']; ce = b['m_Center']
            w = sz['x']*s[0]; th = sz['z']*s[2]; hh = sz['y']*s[1]
            co = qrot(rot, (ce['x']*s[0], ce['y']*s[1], ce['z']*s[2]))
            C = (pos[0]+co[0], pos[1]+co[1], pos[2]+co[2])
            if abs(w) >= abs(th):
                d = qrot(rot, (w/2, 0, 0)); thick = abs(th)
            else:
                d = qrot(rot, (0, 0, th/2)); thick = abs(w)
            # стенная панель ТОНКАЯ в плане; толстая в обеих осях — это плита-пол,
            # её проекция закрывает середину карты и делает заливку невозможной
            if thick > 6.0:
                skipped_plates += 1
                continue
            y0, y1 = C[1]-abs(hh)/2, C[1]+abs(hh)/2
            if y1 < -5 or y0 > 40:                 # не приземные панели (крыши/подвал) — мимо
                continue
            segs.append(((C[0]-d[0], C[2]-d[2]), (C[0]+d[0], C[2]+d[2]), max(thick, 1.5)))
    if not segs:
        return None, 'панелей границы не найдено'

    x0, z0 = from_px(RW, 0)
    x1, z1 = from_px(0, RH)
    x0, x1 = min(x0, x1) - 120, max(x0, x1) + 120
    z0, z1 = min(z0, z1) - 120, max(z0, z1) + 120
    ST = 0.5
    gw, gh = int((x1-x0)/ST), int((z1-z0)/ST)
    im = Image.new('L', (gw, gh), 0)
    dr = ImageDraw.Draw(im)
    for a, b, th in segs:
        dr.line([((a[0]-x0)/ST, (a[1]-z0)/ST), ((b[0]-x0)/ST, (b[1]-z0)/ST)],
                fill=255, width=max(2, int(round(th/ST)) + 2))
    wall = np.array(im, dtype=np.uint8) > 0
    free = ~wall
    # затравки: решётка внутри холста, по возрастанию расстояния от центра холста.
    # Одной точки мало — центр может угодить в стену или в закуток.
    cx0, cz0 = from_px(RW, 0)
    cx1, cz1 = from_px(0, RH)
    cxa, cxb = min(cx0, cx1), max(cx0, cx1)
    cza, czb = min(cz0, cz1), max(cz0, cz1)
    cands = [(cxa + (cxb-cxa)*u, cza + (czb-cza)*v)
             for u in (0.5, 0.35, 0.65, 0.2, 0.8, 0.5, 0.5)
             for v in (0.5, 0.35, 0.65, 0.2, 0.8)]
    cands.sort(key=lambda c: (c[0]-(cxa+cxb)/2)**2 + (c[1]-(cza+czb)/2)**2)
    best, best_n, tried, leaked = None, 0, 0, 0
    for sx, sz in cands:
        ipx, ipz = int((sx-x0)/ST), int((sz-z0)/ST)
        if not (0 <= ipx < gw and 0 <= ipz < gh) or wall[ipz, ipx]:
            continue
        if best is not None and best[ipz, ipx]:
            continue                                # уже внутри найденной области
        tried += 1
        seed = np.zeros_like(free)
        seed[ipz, ipx] = True
        got = flood_runs(free, seed)
        if int(got[0, :].sum() + got[-1, :].sum() + got[:, 0].sum() + got[:, -1].sum()):
            leaked += 1
            continue                                # утекло за сетку — не зона
        n = int(got.sum())
        if n > best_n:
            best, best_n = got, n
    if best is None:
        return None, f'замкнутой области не нашлось (проб {tried}, утечек {leaked})'
    inside = best | wall                            # сама стена — внутри
    gx = (np.arange(RW) - A0)/A1
    gz = (np.arange(RH) - B0)/B1
    ix = np.clip(((gx - x0)/ST).astype(np.int32), 0, gw-1)
    iz = np.clip(((gz - z0)/ST).astype(np.int32), 0, gh-1)
    return (inside[iz[:, None], ix[None, :]],
            f'по {len(segs)} панелям границы из {border_levels[0]} '
            f'(плит-полов пропущено {skipped_plates}, затравок {tried}, утечек {leaked})')


zone, zone_src = None, ''
cand = [ZONE_PNG] if ZONE_PNG else []
cand += [os.path.join(os.path.dirname(OUTDIR.rstrip('/\\')), 'zone', n)
         for n in (f'{MAP_ID}-zone.png', f'{MAP_ID}-zone-mask.png', 'zone.png')]
ready = next((p for p in cand if p and os.path.exists(p)), None)
if ready:
    zone = zone_from_png(ready)
    zone_src = f'готовая маска {ready}'
else:
    zone, why = zone_from_borders()
    zone_src = f'своя, {why}' if zone is not None else f'НЕТ ({why}) — клип только по холсту'
log('зона:', zone_src, '' if zone is None else f'{fmt(float(zone.sum())*PX_AREA)} м²')


# ───────────────────────────── растеризация ─────────────────────────────
def rasterize(entities):
    im = Image.new('L', (RW, RH), 0)
    dr = ImageDraw.Draw(im)
    n = 0
    for e in entities:
        px = A0 + A1*e['P'][:, 0]
        py = B0 + B1*e['P'][:, 1]
        F = e['F']
        xs, ys = px[F], py[F]
        ok = ~((xs.max(1) < 0) | (xs.min(1) > RW) | (ys.max(1) < 0) | (ys.min(1) > RH))
        for a, b in zip(xs[ok], ys[ok]):
            dr.polygon([(a[0], b[0]), (a[1], b[1]), (a[2], b[2])], fill=255)
            n += 1
    return np.array(im, dtype=np.uint8) > 0, n


# ───────────────────────────── контуры маски ─────────────────────────────
def rdp(P, eps):
    """Рамер–Дуглас–Пекер, итеративно; замкнутый контур режем пополам на две дуги."""
    n = len(P)
    if n <= 4:
        return P
    keep = np.zeros(n, bool)
    keep[0] = keep[-1] = True
    half = n // 2
    keep[half] = True
    stack = [(0, half), (half, n-1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        a, b = P[i], P[j]
        d = b - a
        L2 = d[0]*d[0] + d[1]*d[1]
        seg = P[i+1:j]
        if L2 < 1e-12:
            dist = np.hypot(seg[:, 0]-a[0], seg[:, 1]-a[1])
        else:
            dist = np.abs(d[0]*(a[1]-seg[:, 1]) - (a[0]-seg[:, 0])*d[1]) / math.sqrt(L2)
        k = int(np.argmax(dist))
        if dist[k] > eps:
            k += i + 1
            keep[k] = True
            stack.append((i, k))
            stack.append((k, j))
    return P[keep]


def mask_contours(mask, eps=1.5, min_pts=6):
    """Границы бинарной маски -> замкнутые полилинии (пиксельные координаты).

    Рёбра ориентируются так, что заполненная клетка всегда слева; тогда у каждой вершины
    входов столько же, сколько выходов, и цепочки собираются без разбора случаев.
    """
    H, W = mask.shape
    m = np.zeros((H+2, W+2), bool)
    m[1:H+1, 1:W+1] = mask
    VW = W + 3                                       # ширина решётки вершин (паддинг +2, +1)
    starts, ends = [], []
    L, R = m[:, :-1], m[:, 1:]
    ys, xs = np.nonzero(L & ~R)                      # слева заполнено -> идём вверх
    if len(ys):
        starts.append((ys+1).astype(np.int64)*VW + (xs+1)); ends.append(ys.astype(np.int64)*VW + (xs+1))
    ys, xs = np.nonzero(~L & R)                      # справа заполнено -> идём вниз
    if len(ys):
        starts.append(ys.astype(np.int64)*VW + (xs+1)); ends.append((ys+1).astype(np.int64)*VW + (xs+1))
    U, D = m[:-1, :], m[1:, :]
    ys, xs = np.nonzero(U & ~D)                      # сверху заполнено -> идём вправо
    if len(ys):
        starts.append((ys+1).astype(np.int64)*VW + xs); ends.append((ys+1).astype(np.int64)*VW + (xs+1))
    ys, xs = np.nonzero(~U & D)                      # снизу заполнено -> идём влево
    if len(ys):
        starts.append((ys+1).astype(np.int64)*VW + (xs+1)); ends.append((ys+1).astype(np.int64)*VW + xs)
    if not starts:
        return []
    S = np.concatenate(starts)
    E = np.concatenate(ends)
    order = np.argsort(S, kind='stable')
    S = S[order]
    E = E[order]
    uniq, first, cnt = np.unique(S, return_index=True, return_counts=True)
    vid = {int(v): i for i, v in enumerate(uniq.tolist())}
    ptr = first.astype(np.int64).copy()
    stop = ptr + cnt
    used = np.zeros(len(S), bool)
    Sl, El = S.tolist(), E.tolist()
    out = []
    for i0 in range(len(Sl)):
        if used[i0]:
            continue
        v = Sl[i0]
        pts = []
        while True:
            ui = vid.get(v)
            if ui is None:
                break
            j = int(ptr[ui])
            while j < stop[ui] and used[j]:
                j += 1
            ptr[ui] = j
            if j >= stop[ui]:
                break
            used[j] = True
            pts.append(v)
            v = El[j]
        if len(pts) < min_pts:
            continue
        P = np.empty((len(pts), 2), dtype=np.float64)
        a = np.asarray(pts, dtype=np.int64)
        P[:, 0] = (a % VW) - 1.0                      # снимаем паддинг
        P[:, 1] = (a // VW) - 1.0
        P = rdp(P, eps)
        if len(P) >= 3:
            out.append(P)
    return out


# ───────────────────────────── прогон по группам ─────────────────────────────
png_full = np.zeros((RH, RW), np.uint8)
png_clip = np.zeros((RH, RW), np.uint8)
cont_full, cont_clip = {}, {}
area_canvas, area_clip, tri_drawn = {}, {}, {}


def world_area(entities):
    tot = 0.0
    for e in entities:
        P, F = e['P'], e['F']
        a, b, c = P[F[:, 0]], P[F[:, 1]], P[F[:, 2]]
        tot += float(np.abs((b[:, 0]-a[:, 0])*(c[:, 1]-a[:, 1]) -
                            (c[:, 0]-a[:, 0])*(b[:, 1]-a[:, 1])).sum()/2)
    return tot


def union_area_world(entities, step=0.5):
    """Площадь ОБЪЕДИНЕНИЯ в мире (включая всё за холстом), без двойного счёта нахлёстов."""
    if not entities:
        return 0.0
    x0 = min(float(e['P'][:, 0].min()) for e in entities) - 2
    x1 = max(float(e['P'][:, 0].max()) for e in entities) + 2
    z0 = min(float(e['P'][:, 1].min()) for e in entities) - 2
    z1 = max(float(e['P'][:, 1].max()) for e in entities) + 2
    w, h = int((x1-x0)/step)+2, int((z1-z0)/step)+2
    im = Image.new('L', (w, h), 0)
    dr = ImageDraw.Draw(im)
    for e in entities:
        px = (e['P'][:, 0]-x0)/step
        py = (e['P'][:, 1]-z0)/step
        for a, b, c in e['F']:
            dr.polygon([(px[a], py[a]), (px[b], py[b]), (px[c], py[c])], fill=255)
    return float((np.array(im, dtype=np.uint8) > 0).sum())*step*step


area_tri = {c: world_area([e for e in ents if e['cls'] == c]) for c in CLASSES}
area_world = {c: union_area_world([e for e in ents if e['cls'] == c]) for c in CLASSES}
by_cls = collections.Counter(e['cls'] for e in ents)

for c in DRAWORDER:
    sub = [e for e in ents if e['cls'] == c]
    if not sub:
        cont_full[c] = cont_clip[c] = []
        area_canvas[c] = area_clip[c] = 0.0
        tri_drawn[c] = 0
        continue
    m, n = rasterize(sub)
    tri_drawn[c] = n
    area_canvas[c] = float(m.sum())*PX_AREA
    png_full[m] = PNGLEVEL[c]
    cont_full[c] = mask_contours(m)
    if zone is not None:
        m &= zone
    area_clip[c] = float(m.sum())*PX_AREA
    png_clip[m] = PNGLEVEL[c]
    cont_clip[c] = mask_contours(m)
    del m
    log(f'  «{c}»: сущностей {len(sub)}, треуг. в кадре {n}, холст {fmt(area_canvas[c])} м², '
        f'зона {fmt(area_clip[c])} м², колец {len(cont_clip[c])}')


# ───────────────────────────── запись ─────────────────────────────
def write_svg(path, cont, title):
    parts = ['<?xml version="1.0" encoding="UTF-8"?>',
             f'<svg xmlns="http://www.w3.org/2000/svg" width="{RW}" height="{RH}" '
             f'viewBox="0 0 {RW} {RH}">',
             f'<title>{title}</title>']
    for c in CLASSES:
        parts.append(f'<g id="{c}" fill="none" stroke="{COLORS[c]}" stroke-width="2" '
                     f'stroke-linejoin="round">')
        for l in cont.get(c, []):
            parts.append('<path d="M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in l) + ' Z"/>')
        parts.append('</g>')
    parts.append('</svg>')
    open(path, 'w', encoding='utf-8').write('\n'.join(parts))


out = {
    'svg_clip': os.path.join(OUTDIR, f'{MAP_ID}-roads.svg'),
    'svg_full': os.path.join(OUTDIR, f'{MAP_ID}-roads-full.svg'),
    'png_clip': os.path.join(OUTDIR, f'{MAP_ID}-roads.png'),
    'png_full': os.path.join(OUTDIR, f'{MAP_ID}-roads-full.png'),
    'json':     os.path.join(OUTDIR, f'{MAP_ID}-roads.json'),
    'check':    os.path.join(OUTDIR, f'{MAP_ID}-roads-check.jpg'),
}
write_svg(out['svg_clip'], cont_clip, f'{MAP_ID}: дороги (клип по игровой зоне)')
write_svg(out['svg_full'], cont_full, f'{MAP_ID}: дороги (полностью, с фоном за зоной)')
Image.fromarray(png_clip).save(out['png_clip'], optimize=True)
Image.fromarray(png_full).save(out['png_full'], optimize=True)
del png_full
log('SVG + PNG записаны')


# ───────────────────────────── JSON ─────────────────────────────
def ent_json(e):
    r = e['row']
    P = e['P']
    inside = None
    if zone is not None:
        cx = int(round(A0 + A1*P[:, 0].mean()))
        cy = int(round(B0 + B1*P[:, 1].mean()))
        inside = bool(0 <= cx < RW and 0 <= cy < RH and zone[cy, cx])
    return dict(
        name=r['name'], path=r['path'], scene=r['scene'],
        group=e['cls'], groupReason=e['why'],
        mesh=dict(src=r['src'], pathId=r['pid'], verts=int(len(P)), tris=int(len(e['F']))),
        world=dict(bbox=[round(float(P[:, 0].min()), 2), round(float(P[:, 1].min()), 2),
                         round(float(P[:, 0].max()), 2), round(float(P[:, 1].max()), 2)],
                   y=[round(e['ymin'], 2), round(e['ymax'], 2)],
                   lengthM=round(e['L'], 2), obbWidthM=round(e['W'], 2),
                   effWidthM=round(e['ew'], 2), angleDeg=round(e['ang'], 1),
                   areaM2=round(e['area'], 1)),
        insideZone=inside,
        plan=dict(verts=[[round(float(a), 2), round(float(b), 2)] for a, b in P],
                  tris=[[int(a), int(b), int(c)] for a, b, c in e['F']]),
    )


doc = dict(
    _='Слой «дороги» карты EFT: полотно / разметка / площадки-парковки / тротуары. '
      'plan.verts — МИРОВЫЕ метры игры (X, Z), вид сверху; plan.tris — индексы по verts. '
      'В пиксель растра: px = frame.affine.px_from_x[0] + [1]*X, py = frame.affine.py_from_z[0] + [1]*Z. '
      'Группы можно переразложить без пересборки: у каждой сущности group/groupReason и своя геометрия.',
    map=MAP_ID, generated=time.strftime('%Y-%m-%d'),
    source=dict(client=DATA, scenes=road_levels + extra_levels,
                registry='docs/registry/eft-scenes.json'),
    frame=dict(width=RW, height=RH, affine=MF['affine'], metersPerPixel=MPP,
               manifest=MANIFEST.replace('\\', '/')),
    zone=dict(source=zone_src, available=zone is not None,
              areaM2=round(float(zone.sum())*PX_AREA, 1) if zone is not None else None),
    rules=dict(
        lodPolicy='свой MeshFilter = LOD0; иначе только дети lod[0]',
        dropped=dict(byName=sorted(set(dropped_name)), byGeometry=sorted(set(dropped_clone))),
        lotSplit=dict(minWidthM=LOT_MIN_WIDTH, maxAspect=LOT_MAX_ASPECT,
                      reclassified=[dict(name=n, effWidthM=w, lengthM=l) for n, w, l in regeom])),
    stats=dict(
        entities={c: int(by_cls.get(c, 0)) for c in CLASSES},
        triangles={c: int(sum(len(e['F']) for e in ents if e['cls'] == c)) for c in CLASSES},
        areaM2=dict(worldUnion={c: round(area_world[c], 1) for c in CLASSES},
                    worldTriangles={c: round(area_tri[c], 1) for c in CLASSES},
                    canvas={c: round(area_canvas[c], 1) for c in CLASSES},
                    clipped={c: round(area_clip[c], 1) for c in CLASSES})),
    entities=[ent_json(e) for e in sorted(ents, key=lambda e: (e['cls'], e['row']['name']))],
)
json.dump(doc, open(out['json'], 'w', encoding='utf-8'), ensure_ascii=False)
log('JSON записан,', f"{os.path.getsize(out['json'])/1e6:.1f} МБ")

# ───────────────────────────── проверка глазами ─────────────────────────────
ART = [f'D:/Games/raster/{MAP_ID}/{MAP_ID}-main-8192.webp',
       f'D:/Games/raster/{MAP_ID}/{MAP_ID}-main-z6.png']
art = next((p for p in ART if os.path.exists(p)), None)
if art:
    base = Image.open(art).convert('RGBA')
    k = base.size[0] / RW
    ov = Image.new('RGBA', base.size, (0, 0, 0, 0))
    dr = ImageDraw.Draw(ov)
    for c in CLASSES:
        col = tuple(int(COLORS[c][i:i+2], 16) for i in (1, 3, 5)) + (235,)
        for l in cont_clip.get(c, []):
            pts = [(float(x)*k, float(y)*k) for x, y in l]
            dr.line(pts + [pts[0]], fill=col, width=2)
    Image.alpha_composite(base, ov).convert('RGB').save(out['check'], quality=88)
    log('наложение на арт:', out['check'])
else:
    out.pop('check')
    log('арт для наложения не найден — проверочный JPG не делаю')

# ───────────────────────────── отчёт ─────────────────────────────
print()
print(f'=== ДОРОГИ {MAP_ID} ' + '=' * 46)
for c in CLASSES:
    print(f'  {c:20s} сущн. {by_cls.get(c,0):4d}  треуг. {sum(len(e["F"]) for e in ents if e["cls"]==c):7d}  '
          f'мир {fmt(area_world[c]):>9s} м²  холст {fmt(area_canvas[c]):>9s} м²  зона {fmt(area_clip[c]):>9s} м²')
tb, tc, ta = sum(area_world.values()), sum(area_canvas.values()), sum(area_clip.values())
print(f'  {"ИТОГО":20s} сущн. {len(ents):4d}  треуг. {sum(len(e["F"]) for e in ents):7d}  '
      f'мир {fmt(tb):>9s} м²  холст {fmt(tc):>9s} м²  зона {fmt(ta):>9s} м²')
print(f'  клип срезал {100*(1-ta/max(tb, 1e-9)):.1f}% площади (мир -> игровая зона); зона: {zone_src}')
if dropped_name or dropped_clone:
    print('  дубли по имени:', ', '.join(sorted(set(dropped_name))) or '—')
    print('  клоны по геометрии:', ', '.join(sorted(set(dropped_clone))) or '—')
if regeom:
    print('  в площадки по эфф. ширине:', ', '.join(f'{n} (w{w} м, L{l} м)' for n, w, l in regeom))
print('  файлы:')
for v in out.values():
    print('   ', v)
