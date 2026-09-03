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
# Общее с другими слоями (сцены, меши, рамка, земля, сечение, сшивка) — в `mapgeom.py`.

import sys, os, re, json, math, time, collections

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapgeom as mg

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


fmt = mg.fmt


# ─────────────────────────────────────────── кадр: мир (метры) -> пиксель растра

FR = mg.Frame(MAN_PATH)
man = FR.man
XMIN, XMAX, ZMIN, ZMAX = FR.XMIN, FR.XMAX, FR.ZMIN, FR.ZMAX
RW, RH, MIRROR_X, MPP, AFF = FR.W, FR.H, FR.mirror_x, FR.mpp, FR.affine
A0, A1 = AFF['px_from_x']
B0, B1 = AFF['py_from_z']

log(f'рамка {MAP_ID}: {RW}x{RH} px, {MPP * 100:.2f} см/px, отражение по X: '
    f'{"да" if MIRROR_X else "нет"}')
log(f'  px = {A0:.3f}{A1:+.6f}*gx     py = {B0:.3f}{B1:+.6f}*gz')

# сверка с эталонной аффиной слоя комнат — привязка обязана совпасть до 0.01 px
_frame = os.path.join(os.path.dirname(os.path.abspath(OUTDIR)), 'rooms', f'{MAP_ID}-rooms-frame.json')
log('  ' + FR.verify(_frame))


# ─────────────────────────────────────────── чтение сцен

def classify(path, name):
    for rx, cls in BRANCH_RULES:
        if rx.search(path):
            return None if cls is None else (None if (cls == 'props' and not WANT_PROPS) else cls)
    return None


SCENES, skipped_scenes = mg.scene_list(SCENES_JSON, MAP_ID, DATA, SKIP_SCENE)

inst = []
for lvl, nm in SCENES:
    try:
        sc = mg.Scene(DATA, lvl)
    except Exception as ex:
        log(f'  {lvl} ({nm}): ОШИБКА чтения — {ex}')
        continue
    got = mg.collect_meshes(sc, classify, SKIP_MESH)
    inst += got
    by = collections.Counter(g[5] for g in got)
    log(f'  {lvl:9s} {nm:48s} экземпляров {len(got):6d}  ' +
        ' '.join(f'{k}={v}' for k, v in sorted(by.items())))
    del sc
log(f'сцен пропущено: {len(skipped_scenes)} {skipped_scenes}')
by_cls = collections.Counter(g[5] for g in inst)
log(f'экземпляров всего {fmt(len(inst))}: ' + ', '.join(f'{k}={fmt(v)}' for k, v in sorted(by_cls.items())))

MESHES = mg.MeshCache(DATA, keep=3)
load_mesh = MESHES.mesh
local_aabb = MESHES.aabb

log('считаю габариты экземпляров по m_LocalAABB…')
boxes = np.full((len(inst), 6), np.nan, dtype=np.float64)   # xlo,ylo,zlo,xhi,yhi,zhi
for i, (src, pid, pos, rot, sc, cls, name, br) in enumerate(inst):
    a = local_aabb(src, pid)
    if a is None:
        continue
    boxes[i] = mg.world_box(a, pos, rot, sc)
    if i and i % 20000 == 0:
        log(f'  {fmt(i)} / {fmt(len(inst))}')
ok_box = ~np.isnan(boxes[:, 0])
log(f'габариты есть у {fmt(int(ok_box.sum()))} из {fmt(len(inst))}')

# ─────────────────────────────────────────── карта высот (этаж main)

HEIGHT_NPY = HEIGHT_ARG or os.path.join(os.path.dirname(os.path.abspath(OUTDIR)), 'ground',
                                        f'{MAP_ID}-height-meters.npy')
GROUND = mg.Ground(HEIGHT_NPY, FR) if os.path.exists(HEIGHT_NPY) else None
Hgrid = GROUND.G if GROUND is not None else None
if GROUND is not None:
    log(f'земля: {GROUND}')
else:
    log(f'! карты высот {HEIGHT_NPY} нет — этаж main будет резаться по медиане низов зданий')


def ground_at(x, z):
    """Высота земли по террейну слоя ground (та же рамка карты, но с отражением по X)."""
    return GROUND.at(x, z)


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
    """Отрезки пересечения мировой геометрии с плоскостью y = h. -> (M,4) [x0,z0,x1,z1]."""
    wx, wy, wz = mg.world_xyz(V, pos, rot, sc)
    return mg.slice_plane(wx, wy, wz, F, h)


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
    MESHES.evict(key[0])

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
    return mg.stitch(S, weld)


rdp = mg.rdp
plen = mg.plen


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

to_px = FR.to_px


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
