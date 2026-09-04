# Слой «граница игровой зоны» карты EFT прямо из сцен клиента: замкнутый полигон
# играбельной территории + мягкие границы (минные поля, снайперские зоны).
#
# Откуда что берётся:
#   жёсткая граница  корень <Карта>_LevelBorders в сцене <Карта>_Scripts (у Таможни это
#                    Custom_LevelBorders в level15, у Маяка Lighthouse_LevelBorders в level196).
#                    Внутри — сотни тонких панелей BoxCollider+MeshRenderer с невидимым
#                    материалом: невидимые стены, которыми BSG огораживает локацию.
#                    Панель -> ориентированный прямоугольник в плане XZ (длина x толщина).
#   мягкая граница   MonoBehaviour EFT.Interactive.Minefield и EFT.Interactive.SniperFiringZone
#                    из сцены <Карта>_DesignMain (+ соседние *_Design*/*_Scripts, если там пусто).
#                    Типтри у MonoBehaviour в IL2CPP-сборке нет, поэтому имя скрипта читается
#                    сырым разбором m_Script, а геометрия — из BoxCollider на том же GameObject.
#
# ЧТО ОТСЕИВАЕТСЯ И ПОЧЕМУ (главное слабое место слоя — см. отчёт скрипта):
#   1. плиты и триггеры: BLOCKER_FAKE_FLOOR (горизонтальная плита 1115x836 м на Y=-143) и
#      trigger_hurt_fire (убивает провалившегося под карту) — к плановой границе отношения не имеют.
#      Формально: минимальный размер в плане > PLATE_M, либо m_IsTrigger.
#   2. НЕ приземные панели: блокираторы на крышах (Dorms_blocker на общагах, козырёк заправки)
#      и стены подземных объёмов. Их нельзя отличить от «стены на холме» по абсолютному Y —
#      поэтому берётся ВЫСОТА ЗЕМЛИ под панелью. Если рядом лежит готовый террейн слоя ground
#      (<map>-height-meters.npy), высота берётся оттуда: панель считается приземной, когда
#      её низ ниже (земля + STAND_LO), а верх выше (земля + STAND_HI) — то есть она реально
#      перекрывает стоящего человека. Террейна нет -> честный фолбэк: уровень, который
#      пересекает наибольшее число панелей (та самая «завеса» вдоль земли), и та же проверка
#      по нему; фолбэк глобальный, на рельефной карте он слабее, о чём скрипт пишет вслух.
#
# Как получается полигон:
#   панели -> растр 0.5 м -> заливка ИЗВНЕ (от рамки холста) -> зона = «не снаружи» минус
#   запертые карманы (наглухо закрытые дворы/здания = дыры полигона). Одиночная панель
#   внутри зоны при таком порядке поглощается и не даёт разреза-иглы в контуре.
#   Контур обходится по рёбрам клеток (интерьер слева), потом упрощается Дугласом-Пекером.
#
# Вход:  <EscapeFromTarkov_Data>  каталог клиента
#        <map>                    id карты портала (customs, lighthouse, ...)
#        <manifest>               manifest.json карты (boundsFromConfig, coordinateRotation, crop)
#        <outdir>                 куда писать
#        [--height <npy>]         явный путь к террейну; по умолчанию ищется ../ground/<map>-height-meters.npy
# Выход: <outdir>/<map>-zone.svg    полигон зоны + минные поля + снайперские зоны, в рамке растра
#        <outdir>/<map>-zone-mask.png  маска заливки зоны той же сетки (для клипа соседних слоёв)
#        <outdir>/<map>-zone.json   полигон в мировых метрах + площадь + bbox + привязка
#        <outdir>/<map>-zone-check.jpg  контур поверх нашего арта (глазная проверка)
#
# Запуск: python scripts/eft-map-layers/dump-zone.py "D:/Games/Escape from Tarkov/EscapeFromTarkov_Data" \
#           customs D:/Games/raster/customs/manifest.json map-exports/OBJECTS-MAPS/gen/customs/zone
#
# Зависимости: UnityPy, numpy, Pillow (новых не заводится).

import sys, os, re, json, math, struct, collections, time
from datetime import datetime, timezone

import numpy as np
import UnityPy
from PIL import Image, ImageDraw

Image.MAX_IMAGE_PIXELS = None

# ─────────────────────────────────────────── аргументы

argv = sys.argv[1:]
HEIGHT_ARG = None
if '--height' in argv:
    i = argv.index('--height')
    HEIGHT_ARG = argv[i + 1]
    del argv[i:i + 2]
if len(argv) < 4:
    sys.exit('использование: python scripts/eft-map-layers/dump-zone.py '
             '<EscapeFromTarkov_Data> <map> <manifest> <outdir> [--height <npy>]')

DATA, MAP_ID, MAN_PATH, OUTDIR = argv[0], argv[1], argv[2], argv[3]
os.makedirs(OUTDIR, exist_ok=True)

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCENES_JSON = os.path.join(REPO, 'docs', 'registry', 'eft-scenes.json')

# id карты портала -> ключ группы сцен в реестре (ключи — как их назвала BSG, с опечаткой shorline)
MAP2GROUP = {
    'customs': 'Custom', 'factory': 'Factory', 'woods': 'Woods', 'shoreline': 'shorline',
    'lighthouse': 'Lighthouse', 'interchange': 'Shopping_Mall', 'reserve': 'Reserve_Base',
    'the-lab': 'Laboratory', 'streets-of-tarkov': 'City', 'ground-zero': 'Sandbox',
    'labyrinth': 'Labyrinth', 'terminal': 'Terminal', 'icebreaker': 'Icebreaker',
}

# ─────────────────────────────────────────── настройки алгоритма

CELL = 0.5          # м на клетку рабочего растра заливки
MARGIN = 24.0       # м запаса вокруг объединённого bbox (рамка карты + панели)
PLATE_M = 40.0      # мин. размер в плане, выше которого объект — плита, а не стена
MIN_THICK = 1.2     # м: тонкие панели утолщаются, иначе растр даёт дыры на стыках
STAND_LO = 0.3      # м над землёй: низ приземной панели должен быть НИЖЕ этого
STAND_HI = 1.5      # м над землёй: верх приземной панели должен быть ВЫШЕ этого
POCKET_MIN_M2 = 40.0    # карманы мельче — растровый шум, вливаются в зону, а не в дыры
SIMPLIFY_M = 0.9    # допуск Дугласа-Пекера в метрах


try:                      # консоль Windows по умолчанию cp1251 и давится на «м²»
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass


def log(*a):
    print(*a, flush=True)


# ─────────────────────────────────────────── кадр: game (метры) -> пиксель растра
# Формула та же, что в scripts/eft-rooms/render-rooms.py, и она уже проверена независимо
# (двери клиента против наших замков, 33/34 в пределах 5 см). coordinateRotation=180 —
# это ОТРАЖЕНИЕ по X, а не поворот: Unity левосторонняя, вид сверху даёт зеркало.

man = json.load(open(MAN_PATH, encoding='utf-8'))
(_ax, _az), (_bx, _bz) = man['boundsFromConfig']
XMIN, XMAX = min(_ax, _bx), max(_ax, _bx)
ZMIN, ZMAX = min(_az, _bz), max(_az, _bz)
FW = man['crop']['width']
FH = man['crop']['height']
ROT = man.get('coordinateRotation', 0)
MIRROR_X = (ROT == 180)
SX = (FW - 1) / (XMAX - XMIN)
SZ = (FH - 1) / (ZMAX - ZMIN)
AFF = dict(px_from_x=[(FW - 1) + XMIN * SX, -SX] if MIRROR_X else [-XMIN * SX, SX],
           py_from_z=[-ZMIN * SZ, SZ])
M_PER_PX = (XMAX - XMIN) / (FW - 1)


def to_px(x, z):
    return AFF['px_from_x'][0] + AFF['px_from_x'][1] * x, AFF['py_from_z'][0] + AFF['py_from_z'][1] * z


log(f'кадр {MAP_ID}: X[{XMIN:.0f},{XMAX:.0f}] Z[{ZMIN:.0f},{ZMAX:.0f}] -> {FW}x{FH} px, '
    f'{M_PER_PX:.4f} м/px, отражение по X: {"да" if MIRROR_X else "нет"}')
log(f'  px = {AFF["px_from_x"][0]:.3f} {AFF["px_from_x"][1]:+.4f}*gx     '
    f'py = {AFF["py_from_z"][0]:.3f} {AFF["py_from_z"][1]:+.4f}*gz')

# сверка с эталонной аффиной слоя комнат, если она рядом — привязка обязана совпасть до 0.01 px
_frame = os.path.join(os.path.dirname(os.path.abspath(OUTDIR)), 'rooms', f'{MAP_ID}-rooms-frame.json')
if os.path.exists(_frame):
    ref = json.load(open(_frame, encoding='utf-8')).get('affine') or {}
    bad = [k for k in ('px_from_x', 'py_from_z')
           if k in ref and max(abs(a - b) for a, b in zip(ref[k], AFF[k])) > 0.01]
    if bad:
        sys.exit(f'привязка разошлась с {_frame}: {bad} — считать зону нельзя')
    log(f'  привязка сверена с {os.path.basename(_frame)}: совпадает')

# ─────────────────────────────────────────── чтение сцен Unity

_scene_cache = {}


def qmul(a, b):
    ax, ay, az, aw = a; bx, by, bz, bw = b
    return (aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz)


def qrot(q, v):
    x, y, z, w = q; vx, vy, vz = v
    tx, ty, tz = 2 * (y * vz - z * vy), 2 * (z * vx - x * vz), 2 * (x * vy - y * vx)
    return (vx + w * tx + y * tz - z * ty, vy + w * ty + z * tx - x * tz, vz + w * tz + x * ty - y * tx)


def load_scene(level):
    """Индексы одной сцены: типтри, мировые TRS, компоненты, имена, путь в иерархии."""
    if level in _scene_cache:
        return _scene_cache[level]
    env = UnityPy.load(os.path.join(DATA, level))
    f = next(iter(env.files.values()))
    ext = [os.path.basename(x.path) for x in f.externals]
    objs = {o.path_id: o for o in env.objects}
    tt = {}

    def T(p):
        if p not in tt:
            tt[p] = objs[p].read_typetree()
        return tt[p]

    cache = {}

    def trs(p):
        if p in cache:
            return cache[p]
        t = T(p); pp = t['m_LocalPosition']; r = t['m_LocalRotation']; s = t['m_LocalScale']
        lp = (pp['x'], pp['y'], pp['z']); lr = (r['x'], r['y'], r['z'], r['w']); ls = (s['x'], s['y'], s['z'])
        fa = t['m_Father']['m_PathID']
        if fa == 0 or fa not in objs:
            res = (lp, lr, ls)
        else:
            fp, fr, fs = trs(fa)
            rp = qrot(fr, (lp[0] * fs[0], lp[1] * fs[1], lp[2] * fs[2]))
            res = ((fp[0] + rp[0], fp[1] + rp[1], fp[2] + rp[2]), qmul(fr, lr),
                   (fs[0] * ls[0], fs[1] * ls[1], fs[2] * ls[2]))
        cache[p] = res
        return res

    go_tr = {}
    go_comps = collections.defaultdict(list)
    for o in env.objects:
        if o.type.name != 'GameObject':
            continue
        t = o.read_typetree()
        for c in t['m_Component']:
            pid = c['component']['m_PathID']
            co = objs.get(pid)
            if co is None:
                continue
            go_comps[o.path_id].append((co.type.name, pid))
            if co.type.name in ('Transform', 'RectTransform'):
                go_tr[o.path_id] = pid
    go_name = {o.path_id: o.read_typetree()['m_Name'] for o in env.objects if o.type.name == 'GameObject'}

    def path(go):
        parts = []; cur = go; guard = 0
        while cur is not None and guard < 64:
            parts.append(go_name.get(cur, '?')); guard += 1
            trp = go_tr.get(cur)
            if trp is None:
                break
            fa = T(trp)['m_Father']['m_PathID']
            cur = T(fa)['m_GameObject']['m_PathID'] if (fa and fa in objs) else None
        return '/'.join(reversed(parts))

    kids = collections.defaultdict(list)          # GameObject -> [(child GO, child Transform)]
    for g, tp in go_tr.items():
        for ch in T(tp).get('m_Children', []):
            ctp = ch['m_PathID']
            if ctp in objs:
                cg = T(ctp)['m_GameObject']['m_PathID']
                if cg:
                    kids[g].append((cg, ctp))

    res = dict(env=env, ext=ext, objs=objs, T=T, trs=trs, go_tr=go_tr, kids=kids,
               go_comps=go_comps, go_name=go_name, path=path, level=level)
    _scene_cache[level] = res
    return res


_ms_idx = {}
_script_name = {}


def script_of(raw, ext, self_name):
    """Имя класса MonoBehaviour сырым разбором m_Script (типтри в IL2CPP-сборке нет)."""
    fid = struct.unpack_from('<i', raw, 16)[0]
    pid = struct.unpack_from('<q', raw, 20)[0]
    key = (fid, pid)
    if key in _script_name:
        return _script_name[key]
    fn = ext[fid - 1] if fid > 0 else self_name
    nm = f'?{fn}#{pid}'
    try:
        if fn not in _ms_idx:
            e = UnityPy.load(os.path.join(DATA, fn))
            _ms_idx[fn] = {o.path_id: o for o in e.objects if o.type.name == 'MonoScript'}
        o = _ms_idx[fn].get(pid)
        if o is not None:
            t = o.read_typetree()
            ns = t.get('m_Namespace') or ''
            nm = (ns + '.' if ns else '') + t.get('m_ClassName', '?')
    except Exception as ex:
        nm = f'<err {ex}>'
    _script_name[key] = nm
    return nm


# ─────────────────────────────────────────── сцены карты

scenes = json.load(open(SCENES_JSON, encoding='utf-8'))
group = MAP2GROUP.get(MAP_ID)
if group not in scenes:
    sys.exit(f'карта {MAP_ID}: группы сцен нет в {SCENES_JSON}')
entries = scenes[group]


def find_scene(suffix_rx):
    for e in entries:
        base = e['scene'].split('/')[-1]
        if re.search(suffix_rx, base, re.I):
            return f"level{e['level']}", base
    return None, None


SCRIPTS_LEVEL, SCRIPTS_NAME = find_scene(r'_scripts$')
if SCRIPTS_LEVEL is None:
    sys.exit(f'карта {MAP_ID}: сцены *_Scripts в реестре нет — границу брать неоткуда')
log(f'\nсцена границ: {SCRIPTS_NAME} ({SCRIPTS_LEVEL})')

# ─────────────────────────────────────────── панели границы

S = load_scene(SCRIPTS_LEVEL)
roots = sorted({nm for nm in S['go_name'].values() if nm and re.search(r'levelborders', nm, re.I)})
if not roots:
    sys.exit(f'{SCRIPTS_NAME}: корня *_LevelBorders нет')
ROOT = roots[0]
log(f'корень границы: {ROOT}' + (f' (ещё найдены: {roots[1:]})' if len(roots) > 1 else ''))

panels = []
skipped = collections.Counter()
for go, nm in S['go_name'].items():
    p = S['path'](go)
    if not p.startswith(ROOT + '/') and p != ROOT:
        continue
    trp = S['go_tr'].get(go)
    if trp is None:
        continue
    pos, rot, sc = S['trs'](trp)
    box = None
    for tn, pid in S['go_comps'].get(go, []):
        if tn == 'BoxCollider':
            box = S['T'](pid)
            break
    if box is None:
        skipped['без BoxCollider (корень, столбы-капсулы)'] += 1
        continue
    sz = box['m_Size']; ce = box['m_Center']
    w = abs(sz['x'] * sc[0]); hgt = abs(sz['y'] * sc[1]); t = abs(sz['z'] * sc[2])
    co = qrot(rot, (ce['x'] * sc[0], ce['y'] * sc[1], ce['z'] * sc[2]))
    C = (pos[0] + co[0], pos[1] + co[1], pos[2] + co[2])
    # длинная ось панели в плане
    if w >= t:
        d = qrot(rot, (w / 2, 0, 0)); n = qrot(rot, (0, 0, t / 2)); L, TH = w, t
    else:
        d = qrot(rot, (0, 0, t / 2)); n = qrot(rot, (w / 2, 0, 0)); L, TH = t, w
    panels.append(dict(
        name=nm, kind='box', trigger=bool(box['m_IsTrigger']),
        c=(C[0], C[2]), y=(C[1] - hgt / 2, C[1] + hgt / 2),
        d=(d[0], d[2]), n=(n[0], n[2]), length=L, thick=TH, height=hgt))

log(f'объектов под корнем с BoxCollider: {len(panels)}; без коллайдера пропущено: '
    f'{skipped["без BoxCollider (корень, столбы-капсулы)"]}')

# ─────────────────────────────────────────── отсев 1: плиты и триггеры

drop_plate = [p for p in panels if min(p['length'], p['thick']) > PLATE_M or p['trigger']]
_plate_ids = {id(p) for p in drop_plate}
panels = [p for p in panels if id(p) not in _plate_ids]
for p in drop_plate:
    log(f'  отброшено (плита/триггер): {p["name"]} {p["length"]:.0f}x{p["thick"]:.0f} м '
        f'Y[{p["y"][0]:.0f},{p["y"][1]:.0f}]' + (' [trigger]' if p['trigger'] else ''))

# ─────────────────────────────────────────── отсев 2: не приземные (крыши и подземка)

HEIGHT_NPY = HEIGHT_ARG or os.path.join(os.path.dirname(os.path.abspath(OUTDIR)), 'ground',
                                        f'{MAP_ID}-height-meters.npy')
ground_src = None
Hgrid = None
if os.path.exists(HEIGHT_NPY):
    Hgrid = np.load(HEIGHT_NPY)
    ground_src = HEIGHT_NPY
    log(f'\nземля: {os.path.basename(HEIGHT_NPY)} {Hgrid.shape}, '
        f'{np.nanmin(Hgrid):.1f}..{np.nanmax(Hgrid):.1f} м')


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


def sample_ground(p):
    """Медиана земли вдоль панели: точечная выборка на склоне обманчива."""
    vals = []
    for t in (-0.5, -0.25, 0.0, 0.25, 0.5):
        x = p['c'][0] + p['d'][0] * 2 * t
        z = p['c'][1] + p['d'][1] * 2 * t
        g = ground_at(x, z)
        if math.isfinite(g):
            vals.append(g)
    return float(np.median(vals)) if vals else float('nan')


# фолбэк-уровень: Y, который пересекает наибольшее число панелей — это и есть «завеса» вдоль земли
lv = np.arange(-60.0, 60.0, 0.25)
cnt = np.zeros_like(lv)
for p in panels:
    cnt += (lv >= p['y'][0]) & (lv <= p['y'][1])
FALLBACK_Y = float(lv[int(np.argmax(cnt))])
log(f'фолбэк-уровень «завесы»: Y={FALLBACK_Y:.2f} м (его пересекают {int(cnt.max())} панелей из {len(panels)})')

kept, dropped = [], []
for p in panels:
    g = sample_ground(p) if Hgrid is not None else float('nan')
    if not math.isfinite(g):
        g = FALLBACK_Y
        p['gsrc'] = 'фолбэк'
    else:
        p['gsrc'] = 'террейн'
    p['ground'] = g
    if p['y'][0] <= g + STAND_LO and p['y'][1] >= g + STAND_HI:
        kept.append(p)
    else:
        p['why'] = 'над землёй (крыша/навес)' if p['y'][0] > g + STAND_LO else 'под землёй'
        dropped.append(p)

log(f'\nприземных панелей: {len(kept)}; отсеяно не приземных: {len(dropped)}')
by_why = collections.Counter((d['why'], d['name'].split(' (')[0]) for d in dropped)
for (why, nm), n in sorted(by_why.items(), key=lambda kv: -kv[1]):
    log(f'  {n:4d}  {nm:<22} — {why}')
if not kept:
    sys.exit('приземных панелей не осталось — фильтр неверен, зону строить не из чего')

# ─────────────────────────────────────────── растр заливки

pxs = [p['c'][0] + s1 * p['d'][0] + s2 * p['n'][0] for p in kept for s1 in (-1, 1) for s2 in (-1, 1)]
pzs = [p['c'][1] + s1 * p['d'][1] + s2 * p['n'][1] for p in kept for s1 in (-1, 1) for s2 in (-1, 1)]
GX0 = min(XMIN, min(pxs)) - MARGIN
GX1 = max(XMAX, max(pxs)) + MARGIN
GZ0 = min(ZMIN, min(pzs)) - MARGIN
GZ1 = max(ZMAX, max(pzs)) + MARGIN
GW = int(math.ceil((GX1 - GX0) / CELL))
GH = int(math.ceil((GZ1 - GZ0) / CELL))
log(f'\nрабочий растр {GW}x{GH} клеток по {CELL} м: X[{GX0:.0f},{GX1:.0f}] Z[{GZ0:.0f},{GZ1:.0f}]')


def to_cell(x, z):
    return (x - GX0) / CELL, (z - GZ0) / CELL


wimg = Image.new('1', (GW, GH), 0)
wd = ImageDraw.Draw(wimg)
wall_len = 0.0
for p in kept:
    k = max(1.0, MIN_THICK / max(p['thick'], 1e-6)) if p['thick'] < MIN_THICK else 1.0
    nx, nz = p['n'][0] * k, p['n'][1] * k
    pts = []
    for s1, s2 in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        pts.append(to_cell(p['c'][0] + s1 * p['d'][0] + s2 * nx, p['c'][1] + s1 * p['d'][1] + s2 * nz))
    wd.polygon(pts, fill=1)
    wall_len += p['length']
wall = np.array(wimg, dtype=bool)
log(f'стен в плане: {wall_len:.0f} м, клеток стены {int(wall.sum())}')

# ─────────────────────────────────────────── заливка: снаружи -> зона -> карманы

free = ~wall
lab = np.zeros((GH, GW), np.int32)


def flood(seed_r, seed_c, mark):
    """Построчная заливка (спанами): по-клеточный BFS на 2 млн клеток в питоне слишком долог."""
    n = 0
    stack = [(seed_r, seed_c)]
    lab[seed_r, seed_c] = mark
    while stack:
        r, c = stack.pop()
        # разгон спана влево-вправо
        c0 = c
        while c0 > 0 and free[r, c0 - 1] and not lab[r, c0 - 1]:
            c0 -= 1; lab[r, c0] = mark
        c1 = c
        while c1 < GW - 1 and free[r, c1 + 1] and not lab[r, c1 + 1]:
            c1 += 1; lab[r, c1] = mark
        n += c1 - c0 + 1
        for rr in (r - 1, r + 1):
            if rr < 0 or rr >= GH:
                continue
            cc = c0
            while cc <= c1:
                if free[rr, cc] and not lab[rr, cc]:
                    lab[rr, cc] = mark
                    stack.append((rr, cc))
                    while cc <= c1 and free[rr, cc]:
                        cc += 1
                cc += 1
    return n


t0 = time.time()
OUT_MARK = 1
outside_n = 0
for c in range(GW):
    for r in (0, GH - 1):
        if free[r, c] and not lab[r, c]:
            outside_n += flood(r, c, OUT_MARK)
for r in range(GH):
    for c in (0, GW - 1):
        if free[r, c] and not lab[r, c]:
            outside_n += flood(r, c, OUT_MARK)
log(f'снаружи залито {outside_n} клеток = {outside_n * CELL * CELL / 1e4:.1f} га ({time.time() - t0:.1f} с)')

# оставшиеся свободные компоненты: самая большая — играбельная зона, прочие — запертые карманы
comps = []
mark = 1
ys, xs = np.nonzero(free & (lab == 0))
for r, c in zip(ys, xs):
    if lab[r, c]:
        continue
    mark += 1
    comps.append((mark, flood(int(r), int(c), mark)))
comps.sort(key=lambda kv: -kv[1])
if not comps:
    sys.exit('внутри границы пусто — панели не образуют замкнутого контура')
ZONE_MARK, zone_free = comps[0]
log(f'внутренних свободных областей: {len(comps)}; наибольшая {zone_free * CELL * CELL / 1e4:.1f} га')

pockets = [(m, n) for m, n in comps[1:] if n * CELL * CELL >= POCKET_MIN_M2]
noise = len(comps) - 1 - len(pockets)
log(f'запертых карманов (станут дырами): {len(pockets)}; растрового шума влито в зону: {noise}')
for m, n in pockets:
    log(f'    карман {n * CELL * CELL:8.0f} кв.м')

zone = (lab != OUT_MARK)                      # всё, что не снаружи: зона + стены + карманы
for m, _ in pockets:
    zone &= (lab != m)
area_cells = int(zone.sum())
AREA = area_cells * CELL * CELL
log(f'площадь зоны (со стенами, без запертых карманов): {AREA:.0f} м² = {AREA / 1e4:.2f} га')

edge = int(zone[0, :].sum() + zone[-1, :].sum() + zone[:, 0].sum() + zone[:, -1].sum())
if edge:
    log(f'⚠ зона касается края рабочего растра в {edge} клетках — контур мог утечь наружу')

# ─────────────────────────────────────────── контуры: обход рёбер клеток (интерьор слева)

def trace_rings(m):
    h, w = m.shape
    pad = np.zeros((h + 2, w + 2), bool)
    pad[1:-1, 1:-1] = m
    edges = collections.defaultdict(list)
    rs, cs = np.nonzero(pad)
    for r, c in zip(rs, cs):
        if not pad[r - 1, c]:
            edges[(c + 1, r)].append((c, r))          # верх: вправо-налево
        if not pad[r + 1, c]:
            edges[(c, r + 1)].append((c + 1, r + 1))  # низ
        if not pad[r, c - 1]:
            edges[(c, r)].append((c, r + 1))          # слева: вниз
        if not pad[r, c + 1]:
            edges[(c + 1, r + 1)].append((c + 1, r))  # справа: вверх
    rings = []
    for start in list(edges.keys()):
        while edges.get(start):
            ring = [start]
            cur = start
            prev_d = None
            while True:
                outs = edges.get(cur)
                if not outs:
                    break
                if len(outs) == 1 or prev_d is None:
                    nxt = outs.pop(0)
                else:
                    # Развилка бывает только на диагональном касании двух дыр. Берём самый левый
                    # поворот: тогда дыры остаются РАЗНЫМИ кольцами (правый склеивает их в восьмёрку,
                    # проверено на синтетике). Обратная сторона — диагональное касание двух кусков
                    # заливки склеится в одно кольцо с нулевой перемычкой; зона у нас связная, так
                    # что этот случай не наступает.
                    def turn(p):
                        d = (p[0] - cur[0], p[1] - cur[1])
                        return math.atan2(prev_d[0] * d[1] - prev_d[1] * d[0],
                                          prev_d[0] * d[0] + prev_d[1] * d[1])
                    nxt = max(outs, key=turn)
                    outs.remove(nxt)
                if not edges[cur]:
                    del edges[cur]
                prev_d = (nxt[0] - cur[0], nxt[1] - cur[1])
                cur = nxt
                if cur == start:
                    break
                ring.append(cur)
            if len(ring) >= 4:
                rings.append(ring)
    return rings


def shoelace(ring):
    a = 0.0
    for i in range(len(ring)):
        x0, y0 = ring[i]; x1, y1 = ring[(i + 1) % len(ring)]
        a += x0 * y1 - x1 * y0
    return a / 2


rings = trace_rings(zone)
rings.sort(key=lambda r: -abs(shoelace(r)))
raw_v = sum(len(r) for r in rings)
outer_sign = math.copysign(1, shoelace(rings[0]))
holes_raw = [r for r in rings[1:]
             if math.copysign(1, shoelace(r)) != outer_sign and abs(shoelace(r)) * CELL * CELL >= POCKET_MIN_M2]
log(f'\nконтуров: {len(rings)} (внешний {len(rings[0])} вершин, дыр {len(holes_raw)}), '
    f'всего вершин до упрощения {raw_v}')
for h in holes_raw:
    log(f'    дыра {abs(shoelace(h)) * CELL * CELL:8.0f} кв.м, {len(h)} вершин')
if len(holes_raw) != len(pockets):
    log(f'⚠ дыр {len(holes_raw)}, а запертых карманов {len(pockets)}: '
        f'часть карманов слилась с контуром зоны')


def cell_to_world(ring):
    # -1 — компенсация паддинга в trace_rings; узел решётки, не центр клетки
    return [((c - 1) * CELL + GX0, (r - 1) * CELL + GZ0) for c, r in ring]


def dp(points, tol):
    """Дуглас–Пекер без рекурсии; points — открытая ломаная."""
    n = len(points)
    if n < 3:
        return list(range(n))
    P = np.asarray(points, float)
    keep = np.zeros(n, bool); keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        a, b = P[i], P[j]
        seg = b - a
        L2 = float(seg @ seg)
        rel = P[i + 1:j] - a
        if L2 == 0:
            d = np.hypot(rel[:, 0], rel[:, 1])
        else:
            t = np.clip((rel @ seg) / L2, 0, 1)
            proj = np.outer(t, seg)
            d = np.hypot(*(rel - proj).T)
        k = int(np.argmax(d))
        if d[k] > tol:
            k += i + 1
            keep[k] = True
            stack.append((i, k)); stack.append((k, j))
    return np.nonzero(keep)[0].tolist()


def simplify_ring(ring_w, tol):
    """Замкнутое кольцо: режем в двух дальних друг от друга точках, чтобы не срезать угол на стыке."""
    P = np.asarray(ring_w, float)
    n = len(P)
    if n < 8:
        return [tuple(p) for p in P]
    i0 = int(np.argmin(P[:, 0] + P[:, 1]))
    P = np.roll(P, -i0, axis=0)
    i1 = int(np.argmax(np.hypot(P[:, 0] - P[0, 0], P[:, 1] - P[0, 1])))
    a = list(map(tuple, P[:i1 + 1]))
    b = list(map(tuple, np.vstack([P[i1:], P[:1]])))
    out = [a[i] for i in dp(a, tol)] + [b[i] for i in dp(b, tol)][1:-1]
    return out


outer = simplify_ring(cell_to_world(rings[0]), SIMPLIFY_M)
holes = [simplify_ring(cell_to_world(h), SIMPLIFY_M) for h in holes_raw]
holes = [h for h in holes if len(h) >= 3]
simp_v = len(outer) + sum(len(h) for h in holes)
log(f'после упрощения (допуск {SIMPLIFY_M} м): внешний {len(outer)}, дыры {[len(h) for h in holes]}, '
    f'всего {simp_v} вершин')

bx0 = min(p[0] for p in outer); bx1 = max(p[0] for p in outer)
bz0 = min(p[1] for p in outer); bz1 = max(p[1] for p in outer)
log(f'bbox зоны: X[{bx0:.0f},{bx1:.0f}] Z[{bz0:.0f},{bz1:.0f}]')

# ─────────────────────────────────────────── мягкие границы: минные поля и снайперские зоны

SOFT = {'EFT.Interactive.Minefield': 'minefield', 'EFT.Interactive.SniperFiringZone': 'sniper'}
soft = {'minefield': [], 'sniper': []}
soft_scenes = []
cands = []
for e in entries:
    base = e['scene'].split('/')[-1]
    if re.search(r'_designmain$', base, re.I):
        cands.insert(0, (f"level{e['level']}", base))
    elif re.search(r'_design|_scripts$', base, re.I):
        cands.append((f"level{e['level']}", base))

for lvl, base in cands:
    try:
        Sc = load_scene(lvl)
    except Exception as ex:
        log(f'  сцена {base}: не читается ({ex})')
        continue
    found = 0
    for o in Sc['env'].objects:
        if o.type.name != 'MonoBehaviour':
            continue
        try:
            raw = o.get_raw_data()
        except Exception:
            continue
        if len(raw) < 28:
            continue
        cls = script_of(raw, Sc['ext'], lvl)
        kind = SOFT.get(cls)
        if not kind:
            continue
        go = struct.unpack_from('<q', raw, 4)[0]
        trp = Sc['go_tr'].get(go)
        if trp is None:
            continue
        pos, rot, sc = Sc['trs'](trp)
        boxes = []
        stack = [(go, trp)]
        seen = set()
        while stack:                      # бокс бывает и на детях зоны — собираем поддерево
            g, tp = stack.pop()
            if g in seen:
                continue
            seen.add(g)
            gp, gr, gs = Sc['trs'](tp)
            for tn, pid in Sc['go_comps'].get(g, []):
                if tn != 'BoxCollider':
                    continue
                b = Sc['T'](pid); szz = b['m_Size']; cee = b['m_Center']
                co = qrot(gr, (cee['x'] * gs[0], cee['y'] * gs[1], cee['z'] * gs[2]))
                cx, cy, cz = gp[0] + co[0], gp[1] + co[1], gp[2] + co[2]
                hx = qrot(gr, (abs(szz['x'] * gs[0]) / 2, 0, 0))
                hz = qrot(gr, (0, 0, abs(szz['z'] * gs[2]) / 2))
                boxes.append(dict(
                    center=[round(cx, 2), round(cy, 2), round(cz, 2)],
                    size=[round(abs(szz['x'] * gs[0]), 2), round(abs(szz['y'] * gs[1]), 2),
                          round(abs(szz['z'] * gs[2]), 2)],
                    polygon=[[round(cx + s1 * hx[0] + s2 * hz[0], 2), round(cz + s1 * hx[2] + s2 * hz[2], 2)]
                             for s1, s2 in ((-1, -1), (1, -1), (1, 1), (-1, 1))]))
            stack.extend(Sc['kids'].get(g, []))
        if not boxes:
            continue
        soft[kind].append(dict(name=Sc['go_name'].get(go), scene=base, script=cls,
                               pos=[round(v, 2) for v in pos], boxes=boxes))
        found += 1
    if found:
        soft_scenes.append(base)
        log(f'  мягкие границы в {base}: +{found}')
    if soft['minefield'] and soft['sniper']:
        break

log(f'минных полей {len(soft["minefield"])}, снайперских зон {len(soft["sniper"])}')
for k in ('minefield', 'sniper'):
    for s in soft[k]:
        b = s['boxes'][0]
        log(f'  {k:<9} {s["name"]:<28} центр {b["center"][0]:.1f}/{b["center"][2]:.1f} '
            f'бокс {b["size"][0]:.1f}x{b["size"][2]:.1f} м' + (f' (+{len(s["boxes"]) - 1} бокса)' if len(s['boxes']) > 1 else ''))

# ─────────────────────────────────────────── выход

STAMP = datetime.now(timezone.utc).isoformat(timespec='seconds')
base_out = os.path.join(OUTDIR, f'{MAP_ID}-zone')


def ring_px(ring):
    return [to_px(x, z) for x, z in ring]


def path_d(ring):
    pts = ring_px(ring)
    return 'M ' + ' L '.join(f'{x:.1f},{y:.1f}' for x, y in pts) + ' Z'


svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{FW}" height="{FH}" viewBox="0 0 {FW} {FH}">',
       f'<!-- {MAP_ID}: граница игровой зоны из {ROOT} ({SCRIPTS_NAME}). '
       f'game->px  px={AFF["px_from_x"][0]:.3f}{AFF["px_from_x"][1]:+.6f}*gx  '
       f'py={AFF["py_from_z"][0]:.3f}{AFF["py_from_z"][1]:+.6f}*gz -->',
       '<g id="zone" fill="#00e5ff" fill-opacity="0.08" fill-rule="evenodd" '
       'stroke="#00e5ff" stroke-width="6" stroke-linejoin="round">',
       '  <path d="' + ' '.join([path_d(outer)] + [path_d(h) for h in holes]) + '" />',
       '</g>']
svg.append('<g id="minefields" fill="#ff5252" fill-opacity="0.18" stroke="#ff5252" stroke-width="5">')
for s in soft['minefield']:
    for b in s['boxes']:
        svg.append(f'  <polygon data-name="{s["name"]}" points="' +
                   ' '.join(f'{x:.1f},{y:.1f}' for x, y in ring_px(b['polygon'])) + '" />')
svg.append('</g>')
svg.append('<g id="sniper-zones" fill="#ffb300" fill-opacity="0.14" stroke="#ffb300" stroke-width="5">')
for s in soft['sniper']:
    for b in s['boxes']:
        svg.append(f'  <polygon data-name="{s["name"]}" points="' +
                   ' '.join(f'{x:.1f},{y:.1f}' for x, y in ring_px(b['polygon'])) + '" />')
svg.append('</g>')
svg.append('</svg>')
open(base_out + '.svg', 'w', encoding='utf-8').write('\n'.join(svg))

# PNG-маска в сетке растра: белое — зона, чёрное — вне
mask = Image.new('1', (FW, FH), 0)
md = ImageDraw.Draw(mask)
md.polygon(ring_px(outer), fill=1)
for h in holes:
    md.polygon(ring_px(h), fill=0)
mask.save(base_out + '-mask.png', optimize=True)

json.dump(dict(
    map=MAP_ID, layer='zone', generated=STAMP,
    source=dict(scene=SCRIPTS_NAME, level=SCRIPTS_LEVEL, root=ROOT,
                panelsTotal=len(panels) + len(drop_plate), panelsUsed=len(kept),
                panelsDroppedPlate=len(drop_plate), panelsDroppedOffGround=len(dropped),
                groundSource=ground_src or f'фолбэк Y={FALLBACK_Y:.2f}',
                softScenes=soft_scenes),
    frame=dict(width=FW, height=FH, bounds=[[XMIN, ZMIN], [XMAX, ZMAX]],
               coordinateRotation=ROT, mirrorX=MIRROR_X, metersPerPixel=M_PER_PX, affine=AFF),
    zone=dict(areaM2=round(AREA, 1), areaHa=round(AREA / 1e4, 2),
              bbox=[[round(bx0, 1), round(bz0, 1)], [round(bx1, 1), round(bz1, 1)]],
              cellM=CELL, simplifyM=SIMPLIFY_M,
              verticesRaw=raw_v, verticesSimplified=simp_v,
              wallLengthM=round(wall_len, 1),
              outer=[[round(x, 2), round(z, 2)] for x, z in outer],
              holes=[[[round(x, 2), round(z, 2)] for x, z in h] for h in holes]),
    minefields=soft['minefield'], sniperZones=soft['sniper'],
), open(base_out + '.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# глазная проверка: контур поверх нашего арта, если он есть рядом с манифестом
art = None
for cand in (os.path.join(os.path.dirname(MAN_PATH), f'{MAP_ID}-main-8192.webp'),
             os.path.join(os.path.dirname(MAN_PATH), f'{MAP_ID}-main-8192.jpg')):
    if os.path.exists(cand):
        art = cand
        break
if art:
    im = Image.open(art).convert('RGB')
    k = im.size[0] / FW
    d = ImageDraw.Draw(im)
    for ring, col, wdt in ([(outer, (0, 229, 255), 4)] + [(h, (0, 229, 255), 3) for h in holes]):
        pts = [(x * k, y * k) for x, y in ring_px(ring)]
        d.line(pts + [pts[0]], fill=col, width=wdt)
    for s in soft['minefield']:
        for b in s['boxes']:
            pts = [(x * k, y * k) for x, y in ring_px(b['polygon'])]
            d.line(pts + [pts[0]], fill=(255, 82, 82), width=4)
    for s in soft['sniper']:
        for b in s['boxes']:
            pts = [(x * k, y * k) for x, y in ring_px(b['polygon'])]
            d.line(pts + [pts[0]], fill=(255, 179, 0), width=4)
    im.save(base_out + '-check.jpg', quality=82)
    log(f'проверочный кадр: {base_out}-check.jpg (арт {os.path.basename(art)})')

log(f'\nзаписано: {os.path.basename(base_out)}.svg / -mask.png / .json  в {OUTDIR}')
