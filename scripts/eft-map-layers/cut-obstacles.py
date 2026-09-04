# -*- coding: utf-8 -*-
# Слой 7 «ПРЕПЯТСТВИЯ ВЫШЕ 1 М» карты EFT прямо из сцен клиента — ОДИН слой, рез по РЕЛЬЕФУ.
#
# ЧЕМ ЭТО ОТЛИЧАЕТСЯ ОТ СЛОЯ СТЕН (cut-walls.py). Стены режутся ПЛОСКОСТЬЮ на этаж: пять
# файлов, пояс 1.2 м над полом этажа. Здесь режется ПОВЕРХНОСТЬЮ «земля + 1 м»: один файл,
# порог считается ПОВЕРШИННО из карты высот, поэтому длинный забор на склоне и здание на
# косогоре режутся на одной высоте над землёй по всей длине, а не по одной плоскости.
# Раньше содержимое слоя 7 выпадало даром — группой `props` внутри поэтажных SVG стен;
# это было содержимое без формы. Здесь форма заказанная: один слой, рез 1 м от земли.
#
# ЧТО СЧИТАЕТСЯ ПРЕПЯТСТВИЕМ: всё, что стоит на земле и пересекает поверхность реза —
# стены зданий, полотна дверей и рамы окон, заборы, реквизит (машины, контейнеры, бочки,
# стеллажи) и камни. Ничего короче метра сюда не попадает ПО ПОСТРОЕНИЮ: не пересекает —
# не режется. Фильтр по высоте не нужен и не заводится.
#
# ЗАЛИВКА, А НЕ ТОЛЬКО КОНТУР. Силуэт на высоте пояса читается глазом мгновенно, контур —
# нет. Заливка считается ПОЭКЗЕМПЛЯРНО правилом чёт-нечет (дырки внутри одного меша —
# полости, они вычитаются), а экземпляры объединяются по ИЛИ. Так пересечение двух объектов
# остаётся закрашенным, а не выедается в дырку, как было бы при чёт-нечет на всю карту.
#
# ГРАБЛИ — ОБЩИЕ С ОСТАЛЬНЫМИ СЛОЯМИ, ЛЕЖАТ В mapgeom.py
#   1) UnityPy Mesh.export() зеркалит X — вершины только через MeshHandler.
#   2) LOD-дубли: свой MeshFilter = LOD0, иначе дети lod[0]; SHADOW/COLLIDER/BALLISTIC — вон.
#   3) `coordinateRotation: 180` — это ОТРАЖЕНИЕ по X, а не поворот.
# Своё здесь: GARLANDS (провода поперёк карты на высоте пояса), OO/LIGHT, OO/EFFECTS,
# дорожное полотно (плоское, порог не пересекает) и декали плитки — не препятствия.
#
# КООРДИНАТЫ. Аффина из manifest.json СВЕРЯЕТСЯ с эталонной рамкой комнат
# (…/rooms/<map>-rooms-frame.json); расхождение > 0.01 px = падение.
#
# Вход:  <EscapeFromTarkov_Data>  каталог клиента
#        <map>                    id карты портала (customs, lighthouse, …)
#        <manifest>               manifest.json карты (crop, boundsFromConfig)
#        <outdir>                 куда писать
#        [--height <npy>]         карта высот; по умолчанию ../ground/<map>-height-meters.npy
#        [--zone <png>]           маска игровой зоны; по умолчанию ../zone/<map>-zone-mask.png
#        [--cut 1.0]              высота реза над землёй, м
#        [--no-fill]              только контуры (быстрее, без растра силуэтов)
# Выход: <map>-obstacles.png        рамка растра, RGBA: заливка силуэтов + контур, по классам
#        <map>-obstacles.svg        тот же слой вектором, группы по классам (+ «-outside»)
#        <map>-obstacles-check.jpg  наложение на наш HD-арт (глазная проверка)
#        <map>-obstacles.json       сводка: рез, счётчики, площадь по классам, самопроверки
#
# Запуск:
#   python scripts/eft-map-layers/cut-obstacles.py "D:/Games/Escape from Tarkov/EscapeFromTarkov_Data" \
#          customs D:/Games/raster/customs/manifest.json map-exports/OBJECTS-MAPS/gen/customs/obstacles
#
# Зависимости: UnityPy 1.25, numpy, Pillow. Новых не заводится.

import sys, os, re, json, time, collections

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


def opt(flag, default=None):
    global argv
    if flag in argv:
        i = argv.index(flag)
        v = argv[i + 1]
        del argv[i:i + 2]
        return v
    return default


HEIGHT_ARG = opt('--height')
ZONE_ARG = opt('--zone')
CUT = float(opt('--cut', '1.0'))
WANT_FLOORS = True
if '--no-floors' in argv:                 # одна карта вместо поэтажной раскладки
    WANT_FLOORS = False
    argv.remove('--no-floors')
WANT_FILL = True
if '--no-fill' in argv:
    WANT_FILL = False
    argv.remove('--no-fill')
if len(argv) < 4:
    sys.exit('использование: python scripts/eft-map-layers/cut-obstacles.py '
             '<EscapeFromTarkov_Data> <map> <manifest> <outdir> '
             '[--height <npy>] [--zone <png>] [--cut 1.0] [--no-fill] [--no-floors]')

DATA, MAP_ID, MAN_PATH, OUTDIR = argv[0], argv[1], argv[2], argv[3]
os.makedirs(OUTDIR, exist_ok=True)

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCENES_JSON = os.path.join(REPO, 'docs', 'registry', 'eft-scenes.json')
GEN = os.path.dirname(os.path.abspath(OUTDIR))

# ─────────────────────────────────────────── настройки

WELD = 0.01           # м: допуск сшивки концов отрезков в полилинии
SIMPLIFY = 0.03       # м: допуск Дугласа-Пекера (крупнее, чем у стен: слой и так тяжёлый)
MIN_LEN = 0.25        # м: открытые цепи короче — осколки триангуляции, не препятствия
MIN_AREA = 0.02       # м²: замкнутые контуры мельче (14x14 см) — тоже осколки

# Классы. Порядок = приоритет отрисовки в растре: следующий перекрывает предыдущий.
# `plant` стоит ПЕРВЫМ (самый низкий приоритет отрисовки): на верхних этажах кроны высоких
# деревьев пересекают плоскость реза и лезут «звёздочками» поверх планировки. Отдельный
# класс даёт их выключить одним кликом, не теряя данные.
CLASSES = ['plant', 'props', 'stone', 'fence', 'openings', 'building']
CID = {c: i + 1 for i, c in enumerate(CLASSES)}
COLORS = {'building': (255, 255, 255), 'openings': (0, 208, 255), 'fence': (124, 255, 90),
          'props': (255, 59, 107), 'stone': (255, 176, 32), 'plant': (86, 160, 74)}
TITLES = {'building': 'стены и колонны', 'openings': 'полотна дверей и рамы окон',
          'fence': 'заборы и бетонные блоки', 'props': 'реквизит: машины, контейнеры, стеллажи',
          'stone': 'камни и скалы', 'plant': 'растительность: кроны и кусты'}
FILL_ALPHA = 110      # прозрачность заливки силуэта; контур рисуется непрозрачным
# Предохранитель от протечки заливки на НОВОЙ карте, где словарь имён другой: один экземпляр
# не может быть препятствием размером в полтора процента карты. Купол неба на Таможне давал
# 578 000 м² (97 % рамки) и виден был только по этому счётчику — глазом PNG «просто залит».
MAX_FILL_FRAC = 0.015

# Ветки, которые препятствиями не являются. Проверяются по ПУТИ, сверху вниз.
DROP_RULES = [
    r'/GARLANDS/',                    # новогодние провода поперёк всей карты на высоте пояса
    r'/OO/LIGHT(/|$)',
    r'/OO/INTERACTIVE_light(/|$)',
    r'/OO/EFFECTS(/|$)',
    r'/OO/ROAD(/|$)',                 # полотно плоское — поверхность реза не пересекает
    r'_TILE(_|\b)',                   # декали плитки на стенах
    r'Sky ?Dome',                     # КУПОЛ НЕБА: сфера размером с карту, пересекает ЛЮБОЙ рез
                                      # и заливает 97 % рамки. Три штуки: Space, Clear, Atmosphere
    r'stencil',                       # стенсил-геометрия рендера: прямоугольники в пол-локации
    r'decal',                         # декали — плоские накладки на поверхности, не препятствия
]
DROP_RULES = [re.compile(rx, re.I) for rx in DROP_RULES]

# Классы по ветке иерархии — тот же словарь, что у слоя стен: расхождение классов между
# слоями хуже, чем неидеальный словарь.
BRANCH_RULES = [
    (r'/SOO_LOD0/(BUILDING|BUILDINGS|COLUMNS)(/|$)', 'building'),
    (r'/OO/BUILDING(/|$)', 'building'),
    (r'/SOO_LOD0/(DOORS|WINDOWS)(/|$)', 'openings'),
    (r'/OO/DOORS(/|$)', 'openings'),
    (r'/SOO_LOD0/(Fence|ConcreteBlocks)', 'fence'),
    (r'.', 'props'),
]
BRANCH_RULES = [(re.compile(rx, re.I), cls) for rx, cls in BRANCH_RULES]

# Камни: словарь ИМЁН из dump-stones.py (там он выверен на двух картах), а не веток.
STONE_RX = re.compile(r'stone|rock|kamen|boulder|cliff', re.I)
STONE_NOT_RX = re.compile(r'rocket|rockwool|tombstone', re.I)
# Растительность: словарь тот же, что в dump-vegetation-objects.py.
PLANT_RX = re.compile(r'(?<![A-Za-z])(tree|bush|pine|spruce|birch|oak|maple|fir|shrub|foliage|'
                      r'leaf|leaves|vetk|kust|derev|palm|reed|fern|hedge|plant|nettle|burdock|'
                      r'wolf|sapling)(?![A-Za-z])', re.I)
PLANT_NOT_RX = re.compile(r'(planter|plantation|plant_pot|power_?plant|plant_station)', re.I)

SKIP_SCENE = re.compile(r'(terrain|sound|culling|background)', re.I)

t_start = time.time()


def log(*a):
    print(f'[{time.time() - t_start:6.1f}s]', *a, flush=True)


fmt = mg.fmt


DROPPED = collections.Counter()      # что отсеяно и каким правилом — в лог и в JSON


def classify(path, name):
    for rx in DROP_RULES:
        if rx.search(path):
            DROPPED[rx.pattern] += 1
            return None
    if PLANT_RX.search(name) and not PLANT_NOT_RX.search(path):
        return 'plant'
    if STONE_RX.search(name) and not STONE_NOT_RX.search(name):
        return 'stone'
    for rx, cls in BRANCH_RULES:
        if rx.search(path):
            return cls
    return None


# ─────────────────────────────────────────── рамка и земля

FR = mg.Frame(MAN_PATH)
RW, RH = FR.W, FR.H
log(f'рамка {MAP_ID}: {RW}x{RH} px, {FR.mpp * 100:.2f} см/px, отражение по X: '
    f'{"да" if FR.mirror_x else "нет"}')
log('  ' + FR.verify(os.path.join(GEN, 'rooms', f'{MAP_ID}-rooms-frame.json')))

# ЗЕМЛЯ. На карте с террейном рез следует рельефу. У Завода, Лаборатории, Лабиринта, Терминала
# и Ледокола террейна НЕТ вообще — там «земля» это ПОЛ, и он плоский. Отказываться на таких
# картах значит не собрать слой там, где он собирается тривиально; поэтому вместо отказа —
# честная плоскость с оценкой уровня пола, и об оценке говорится вслух.
HEIGHT_NPY = HEIGHT_ARG or os.path.join(GEN, 'ground', f'{MAP_ID}-height-meters.npy')
GROUND = mg.Ground(HEIGHT_NPY, FR) if os.path.exists(HEIGHT_NPY) else None
FLAT = None                   # уровень пола, если карты высот нет (метры игрового мира)
if GROUND is not None:
    log(f'земля: {GROUND}; рез = земля + {CUT:.2f} м')
else:
    log(f'! карты высот {os.path.basename(HEIGHT_NPY)} нет — карта без террейна, '
        f'земля будет ПЛОСКОЙ (уровень оценится по низам геометрии)')

ZONE_PNG = ZONE_ARG or os.path.join(GEN, 'zone', f'{MAP_ID}-zone-mask.png')
ZONE = None
if os.path.exists(ZONE_PNG):
    z = Image.open(ZONE_PNG).convert('L')
    if z.size != (RW, RH):
        z = z.resize((RW, RH), Image.NEAREST)
    ZONE = np.array(z) > 127
    del z
    log(f'зона: {os.path.basename(ZONE_PNG)}, {ZONE.mean() * 100:.1f} % рамки')
else:
    log(f'! маски зоны {ZONE_PNG} нет — деление на «в зоне / снаружи» не будет')

# ─────────────────────────────────────────── экземпляры из сцен

SCENES, skipped_scenes = mg.scene_list(SCENES_JSON, MAP_ID, DATA, SKIP_SCENE)
inst = []
for lvl, nm in SCENES:
    try:
        sc = mg.Scene(DATA, lvl)
    except Exception as ex:
        log(f'  {lvl} ({nm}): ОШИБКА чтения — {ex}')
        continue
    got = mg.collect_meshes(sc, classify)
    inst += got
    by = collections.Counter(g[5] for g in got)
    log(f'  {lvl:9s} {nm:48s} экземпляров {len(got):6d}  ' +
        ' '.join(f'{k}={v}' for k, v in sorted(by.items())))
    del sc
log(f'сцен пропущено: {len(skipped_scenes)} {skipped_scenes}')
log('отсеяно правилами (не препятствия): ' +
    ', '.join(f'{rx}={fmt(n)}' for rx, n in DROPPED.most_common()))
by_cls = collections.Counter(g[5] for g in inst)
log(f'экземпляров всего {fmt(len(inst))}: ' + ', '.join(f'{k}={fmt(v)}' for k, v in sorted(by_cls.items())))

MESHES = mg.MeshCache(DATA, keep=3)

# ─────────────────────────────────────────── отбор: чей габарит достаёт до поверхности реза

log('считаю габариты по m_LocalAABB и отбираю кандидатов…')
boxes = np.full((len(inst), 6), np.nan, dtype=np.float64)
for i, (src, pid, pos, rot, sc, cls, name, br) in enumerate(inst):
    a = MESHES.aabb(src, pid)
    if a is not None:
        boxes[i] = mg.world_box(a, pos, rot, sc)
    if i and i % 20000 == 0:
        log(f'  {fmt(i)} / {fmt(len(inst))}')
ok_box = ~np.isnan(boxes[:, 0])
log(f'габариты есть у {fmt(int(ok_box.sum()))} из {fmt(len(inst))}')

# Пол оценивается ВСЕГДА, даже когда террейн есть: у Резерва слайсы покрывают лишь часть
# рамки, и под 78 411 объектами из 88 715 земли не было — без запасного уровня они просто
# выпадали из слоя. Оценка — МОДА низов геометрии: плиты пола кластеризуются на одном уровне,
# и это самый населённый полуметровый бин. Не медиана — медиану утаскивают этажи и подвалы.
if True:
    lows = boxes[ok_box, 1]
    lows = lows[(lows > -200) & (lows < 200)]
    hist, edges = np.histogram(lows, bins=np.arange(-200, 200.5, 0.5))
    FLOOR = float(edges[int(np.argmax(hist))])
    FLAT = FLOOR + CUT
    band = next((L for L in FR.layers() if L.get('isMain') and L.get('heights')), None)
    note = f'мода низов {fmt(len(lows))} мешей'
    if band and band['heights'][0] > -900:
        d = abs(band['heights'][0] - FLOOR)
        note += f'; полоса «{band["id"]}» манифеста даёт {band["heights"][0]:.1f} м (расхождение {d:.1f} м)'
        if d > 2.0:
            log(f'  ⚠ оценка пола расходится с манифестом на {d:.1f} м — проверить глазами')
    log(f'пол оценён в {FLOOR:.2f} м ({note}); плоский рез = {FLAT:.2f} м' +
        ('' if GROUND is None else ' — запасной уровень там, где террейна под объектом нет'))

# ─────────────────────────────────────────── ЭТАЖИ: полосы высот и правило реза

# Слой 7 умеет два режима, и различие в том, ОТКУДА берётся уровень пола:
#   • одна карта («земля + 1 м») — рез следует рельефу, порог считается повершинно;
#   • ПОЭТАЖНО — на каждую полосу `layers[].heights` манифеста своя плоскость.
# Полоса — это НЕ пол: у Улиц наземная полоса [-6, 10] описывает диапазон для фильтра
# маркеров, а пол там около 3.5 м. Поэтому уровень пола каждого этажа ОЦЕНИВАЕТСЯ по
# данным: мода низов геометрии, попадающей в полосу. Ровно тот же приём, которым слой
# стен угадывает пол подземки, — и он печатается вслух как оценка, а не как факт.
BANDS = []
for L in FR.layers():
    h = L.get('heights') or [-1e9, 1e9]
    BANDS.append(dict(id=L['id'], name=L.get('name') or L['id'],
                      lo=float(h[0]), hi=float(h[1]), main=bool(L.get('isMain'))))
if not BANDS:
    BANDS = [dict(id='all', name='вся карта', lo=-1e9, hi=1e9, main=True)]
if not WANT_FLOORS:
    BANDS = [b for b in BANDS if b['main']] or BANDS[:1]

for b in BANDS:
    sel = ok_box & (boxes[:, 1] >= b['lo']) & (boxes[:, 1] <= b['hi'])
    vals = boxes[sel, 1]
    if b['main'] and GROUND is not None:
        b['cut'] = None                      # рез по рельефу, плоскости нет
        b['rule'] = 'земля под вершиной + рез (билинейно по карте высот)'
    elif len(vals) >= 50:
        lo_edge = max(b['lo'], -300.0)
        hi_edge = min(b['hi'], 300.0)
        hist, edges = np.histogram(vals, bins=np.arange(lo_edge, hi_edge + 0.5, 0.5))
        floor = float(edges[int(np.argmax(hist))])
        b['cut'] = floor + CUT
        b['rule'] = (f'ОЦЕНКА: мода низов {fmt(len(vals))} мешей в полосе '
                     f'[{b["lo"]:.0f}, {b["hi"]:.0f}] -> пол {floor:.2f} + {CUT} м')
    else:
        b['cut'] = (FLOOR if b['main'] else b['lo']) + CUT
        b['rule'] = (f'мешей в полосе всего {len(vals)} — пол взят '
                     + ('из общей моды низов' if b['main'] else 'от низа полосы'))
    b['floorM'] = None if b['cut'] is None else round(b['cut'] - CUT, 2)

print()
log('ЭТАЖИ И ВЫСОТЫ РЕЗА:')
for b in BANDS:
    cut = 'рельеф+%.1f' % CUT if b['cut'] is None else '%.2f м' % b['cut']
    log(f'  {b["id"]:12s} полоса [{b["lo"]:.0f}, {b["hi"]:.0f}]  рез {cut:>12s}   [{b["rule"]}]')
print()

# ─────────────────────────────────────────── что резать и на какой высоте

def band_h(b, i):
    """Высота плоскости реза для экземпляра i в полосе b; None — рез по рельефу."""
    if b['cut'] is not None:
        return b['cut']
    glo, ghi = GROUND.box_range(boxes[i, 0], boxes[i, 2], boxes[i, 3], boxes[i, 5])
    return None if not np.isnan(glo) else FLOOR + CUT


tasks = collections.defaultdict(list)        # (src,pid) -> [(индекс экземпляра, id полосы)]
n_nan_ground = 0
per_band_cand = collections.Counter()
for i in range(len(inst)):
    for b in BANDS:
        if ok_box[i]:
            if b['cut'] is not None:
                if not (boxes[i, 1] <= b['cut'] <= boxes[i, 4]):
                    continue
            else:
                glo, ghi = GROUND.box_range(boxes[i, 0], boxes[i, 2], boxes[i, 3], boxes[i, 5])
                if np.isnan(glo):
                    n_nan_ground += 1
                    glo = ghi = FLOOR
                if not (boxes[i, 1] <= ghi + CUT and boxes[i, 4] >= glo + CUT):
                    continue
        tasks[(inst[i][0], inst[i][1])].append((i, b['id']))
        per_band_cand[b['id']] += 1
n_tasks = sum(len(v) for v in tasks.values())
log(f'резов запланировано {fmt(n_tasks)} на {fmt(len(tasks))} уникальных мешей: '
    + ', '.join(f'{k}={fmt(v)}' for k, v in per_band_cand.items())
    + (f'; без земли под габаритом {n_nan_ground}' if n_nan_ground else ''))

# ─────────────────────────────────────────── сечение поверхностью «земля + рез»

def cut_instance(V, F, i, plane=None):
    """Экземпляр -> ([замкнутые контуры], [открытые цепи]) в МИРОВЫХ метрах.

    Поле реза считается ПОВЕРШИННО: D = y вершины − (земля под ней + рез). Поэтому
    поверхность реза следует рельефу, а не является плоскостью на весь объект — забор
    в двести метров по склону режется на метре от земли по всей длине.
    """
    src, pid, pos, rot, sc, cls, name, br = inst[int(i)]
    wx, wy, wz = mg.world_xyz(V, pos, rot, sc)
    if plane is not None:
        h = plane                             # поэтажный рез: плоскость этажа
    elif GROUND is None:
        h = FLAT                              # карта без террейна: пол плоский
    else:
        g = GROUND.sample(wx, wz).astype(np.float64)
        if np.isnan(g).any():
            med = np.nanmedian(g)
            if np.isnan(med):
                n_flat[0] += 1        # террейна под объектом нет вовсе — плоский пол
                g = np.full(g.shape, FLOOR)
            else:
                g = np.where(np.isnan(g), med, g)
        h = g + CUT
    # float64 сознательно: в float32 вершина, лежащая ровно на резе, схлопывается в 0
    S = mg.slice_field(wx, wz, np.asarray(wy, dtype=np.float64) - h, F)
    if S is None:
        return None, None
    closed, opens = [], []
    for P, is_closed in mg.stitch(S, WELD, flags=True):
        Q = mg.rdp(P, SIMPLIFY)
        if len(Q) < 2:
            continue
        if is_closed and len(Q) >= 4:
            if abs(mg.parea(Q)) >= MIN_AREA:
                closed.append(Q)
        elif mg.plen(Q) >= MIN_LEN:
            opens.append(Q)
    return closed, opens


# ─────────────────────────────────────────── растр силуэтов

MAX_FILL_PX = MAX_FILL_FRAC * RW * RH


def fill_even_odd(loops, ox, oy, w, h):
    """Замкнутые контуры (в пикселях) -> залитая маска локальной рамки, правило чёт-нечет.

    Векторная развёртка по строкам: каждое ребро отдаёт пересечения со строками растра,
    дальше чётность вдоль строки. Чёт-нечет здесь ПОЭКЗЕМПЛЯРНЫЙ — полости внутри одного
    меша вычитаются, а объекты объединяются снаружи по ИЛИ.
    """
    rows, cols = [], []
    for P in loops:
        x0 = P[:-1, 0] - ox; y0 = P[:-1, 1] - oy
        x1 = P[1:, 0] - ox;  y1 = P[1:, 1] - oy
        m = y0 != y1
        if not m.any():
            continue
        x0, y0, x1, y1 = x0[m], y0[m], x1[m], y1[m]
        r0 = np.clip(np.ceil(np.minimum(y0, y1) - 0.5), 0, h).astype(np.int64)
        r1 = np.clip(np.ceil(np.maximum(y0, y1) - 0.5), 0, h).astype(np.int64)
        cnt = r1 - r0
        k = cnt > 0
        if not k.any():
            continue
        cnt = cnt[k]
        idx = np.repeat(np.nonzero(k)[0], cnt)
        base = np.repeat(np.cumsum(cnt) - cnt, cnt)
        rr = np.repeat(r0[k], cnt) + (np.arange(int(cnt.sum())) - base)
        t = ((rr + 0.5) - y0[idx]) / (y1[idx] - y0[idx])
        rows.append(rr)
        cols.append(np.ceil(x0[idx] + t * (x1[idx] - x0[idx]) - 0.5).astype(np.int64))
    if not rows:
        return None
    rr = np.concatenate(rows)
    cc = np.clip(np.concatenate(cols), 0, w)
    acc = np.zeros((h, w + 1), dtype=np.int32)
    np.add.at(acc, (rr, cc), 1)
    return (np.cumsum(acc[:, :w], axis=1) & 1).astype(bool)


def stamp(closed_px, open_px, cid, CLS):
    """Силуэт экземпляра в общий растр классов. Приоритет = номер класса (np.maximum)."""
    pts = closed_px + open_px
    xs = np.concatenate([p[:, 0] for p in pts])
    ys = np.concatenate([p[:, 1] for p in pts])
    ox = int(np.floor(xs.min())) - 1
    oy = int(np.floor(ys.min())) - 1
    x1 = int(np.ceil(xs.max())) + 2
    y1 = int(np.ceil(ys.max())) + 2
    ox, oy = max(ox, 0), max(oy, 0)
    x1, y1 = min(x1, RW), min(y1, RH)
    w, h = x1 - ox, y1 - oy
    if w <= 0 or h <= 0:
        return 0
    loc = fill_even_odd(closed_px, ox, oy, w, h) if closed_px else None
    if loc is None:
        loc = np.zeros((h, w), dtype=bool)
    # обводка поверх заливки: тонкая геометрия (панель забора в 1.5 px) иначе теряется
    im = Image.new('L', (w, h), 0)
    dr = ImageDraw.Draw(im)
    for P in pts:
        if len(P) >= 2:
            dr.line([(float(a - ox), float(b - oy)) for a, b in P], fill=255, width=1)
    loc |= np.array(im) > 0
    n = int(loc.sum())
    if n > MAX_FILL_PX:
        return -n                     # протечка: в растр НЕ пускаем, зовущий разберётся
    sub = CLS[oy:y1, ox:x1]
    np.maximum(sub, np.where(loc, cid, 0).astype(np.uint8), out=sub)
    return n


# ─────────────────────────────────────────── прогон: меш читается ОДИН раз на все этажи

BY = {b['id']: b for b in BANDS}
paths = {b['id']: {c: {'in': [], 'out': []} for c in CLASSES} for b in BANDS}
stat = {b['id']: {c: dict(instances=0, loops=0, chains=0, lengthM=0.0, outside=0) for c in CLASSES}
        for b in BANDS}
big, oversized = [], []
n_hit = n_miss = n_fail = 0
tri_total = 0
n_flat = [0]
order = sorted(tasks.items(), key=lambda kv: (kv[0][0], kv[0][1]))
t_cut = time.time()
done = 0
for k, (key, jobs) in enumerate(order):
    m = MESHES.mesh(key[0], key[1])
    if m is None:
        n_fail += len(jobs)
        MESHES.evict(key[0])
        continue
    V, F = m
    for i, bid in jobs:
        done += 1
        cls = inst[i][5]
        closed, opens = cut_instance(V, F, i, band_h(BY[bid], i))
        tri_total += len(F)
        if not closed and not opens:
            n_miss += 1
            continue
        n_hit += 1
        cpx = [FR.to_px(P) for P in closed]
        opx = [FR.to_px(P) for P in opens]
        cx = float(np.mean([p[:, 0].mean() for p in (cpx + opx)]))
        cy = float(np.mean([p[:, 1].mean() for p in (cpx + opx)]))
        where = 'in'
        if ZONE is not None:
            r, c = int(round(cy)), int(round(cx))
            if not (0 <= r < RH and 0 <= c < RW and ZONE[r, c]):
                where = 'out'
                stat[bid][cls]['outside'] += 1
        paths[bid][cls][where].append((cpx, opx))
        s = stat[bid][cls]
        s['instances'] += 1
        s['loops'] += len(closed)
        s['chains'] += len(opens)
        s['lengthM'] += sum(mg.plen(P) for P in closed) + sum(mg.plen(P) for P in opens)
    if k and k % 250 == 0:
        log(f'  сечение {fmt(done)} / {fmt(n_tasks)}, пересекли {fmt(n_hit)} '
            f'[{time.time() - t_cut:.0f}s]')
    MESHES.evict(key[0])
if n_flat[0]:
    log(f'запасной плоский уровень применён к {fmt(n_flat[0])} экземплярам — '
        f'террейн под ними не покрывает рамку')
log(f'сечение готово за {time.time() - t_cut:.0f}s: пересекли {fmt(n_hit)}, мимо {fmt(n_miss)}, '
    f'меш не прочитан {n_fail}; треугольников {fmt(tri_total)}')

# ─────────────────────────────────────────── растр, запись и самопроверки — ПО ЭТАЖАМ

# Растр держится по ОДНОМУ за раз: у Улиц рамка 11946x16384 = 196 Мпикс, шесть этажей
# одновременно съели бы больше гигабайта только на масках классов.
files = []
summary = {}
checks = {}
STONE_TALL_M = 4.5
stones_json = os.path.join(GEN, 'stones', f'{MAP_ID}-stones.json')
stones_tall = []
if os.path.exists(stones_json):
    st = json.load(open(stones_json, encoding='utf-8'))['instances']
    stones_tall = [s for s in st if s.get('inGameZone') and s.get('height', 0) > STONE_TALL_M
                   and SKIP_SCENE.search(s.get('level', '')) is None and s.get('hullPx')]

_rast = os.path.dirname(MAN_PATH)
_main = (next((L for L in FR.layers() if L.get('isMain')), None)
         or (FR.layers()[0] if FR.layers() else None))


def art_for(bid):
    """Подложка этажа: файл слоя из манифеста, иначе главный слой, иначе шаблон «-main-»."""
    cand = []
    for L in FR.layers():
        if L.get('id') == bid:
            cand += list((L.get('files') or {}).values())
    cand += list(((_main or {}).get('files') or {}).values())
    cand += [f'{MAP_ID}-{bid}-8192.webp', f'{MAP_ID}-main-8192.webp', f'{MAP_ID}-main-z6.png']
    for f in cand:
        p = f if os.path.isabs(f) else os.path.join(_rast, f)
        if os.path.exists(p):
            return p
    return None


for b in BANDS:
    bid = b['id']
    sfx = '' if len(BANDS) == 1 else f'-{bid}'
    R = paths[bid]
    n_inst = sum(stat[bid][c]['instances'] for c in CLASSES)
    if not n_inst:
        log(f'{bid}: ни одного силуэта — файлы не пишутся')
        summary[bid] = dict(band=[b['lo'], b['hi']], cutMeters=b['cut'], floorMeters=b['floorM'],
                            cutRule=b['rule'], classes={c: dict(stat[bid][c]) for c in CLASSES},
                            instances=0)
        continue

    area = {}
    cover = 0.0
    if WANT_FILL:
        CLS = np.zeros((RH, RW), dtype=np.uint8)
        drop = 0
        for c in CLASSES:
            for where in ('in', 'out'):
                for cpx, opx in R[c][where]:
                    npx = stamp(cpx, opx, CID[c], CLS)
                    if npx < 0:
                        drop += 1
                        oversized.append((round(abs(npx) * FR.mpp ** 2), bid, c))
                    elif abs(npx) * FR.mpp ** 2 > 200:
                        big.append((abs(npx) * FR.mpp ** 2, bid, c))
        area = {c: round(float((CLS == CID[c]).sum()) * FR.mpp ** 2, 1) for c in CLASSES}
        covered = float((CLS > 0).sum())
        cover = round(covered / (RW * RH) * 100, 3)
        if drop:
            log(f'  {bid}: предохранитель выбросил {drop} экземпляров крупнее '
                f'{MAX_FILL_FRAC * 100:.1f} % рамки')
        if n_hit > 100 and covered < 0.0001 * RW * RH and b['main']:
            log(f'  ⚠️ {bid}: СЛОЙ ЛЁГ МИМО РАМКИ — силуэтов {n_inst}, закрашено {covered:.0f} px')
            checks['outsideFrame'] = dict(band=bid, coverPercent=cover)
        if stones_tall and b['main']:
            hit = 0
            for s in stones_tall:
                xs = [p[0] for p in s['hullPx']]; ys = [p[1] for p in s['hullPx']]
                c0, c1 = max(0, int(min(xs))), min(RW, int(max(xs)) + 1)
                r0, r1 = max(0, int(min(ys))), min(RH, int(max(ys)) + 1)
                if r0 < r1 and c0 < c1 and (CLS[r0:r1, c0:c1] > 0).mean() > 0.02:
                    hit += 1
            checks['stonesCovered'] = dict(total=len(stones_tall), hit=hit, minHeightM=STONE_TALL_M,
                                           _='камни слоя 9 выше порога: под габаритом обводки есть '
                                             'силуэт наземного этажа (центр камня не годится — '
                                             'pivot лежит мимо сечения)')
            log(f'  самопроверка камнями: под {hit} из {len(stones_tall)} камней есть силуэт')

        rgba = np.zeros((RH, RW, 4), dtype=np.uint8)
        for c in CLASSES:
            mk = CLS == CID[c]
            if not mk.any():
                continue
            e = np.zeros_like(mk)
            e[1:, :] |= mk[1:, :] & ~mk[:-1, :]
            e[:-1, :] |= mk[:-1, :] & ~mk[1:, :]
            e[:, 1:] |= mk[:, 1:] & ~mk[:, :-1]
            e[:, :-1] |= mk[:, :-1] & ~mk[:, 1:]
            col = COLORS[c]
            for ch in range(3):
                rgba[..., ch][mk] = col[ch]
            rgba[..., 3][mk] = FILL_ALPHA
            rgba[..., 3][e] = 255
            del mk, e
        p_png = os.path.join(OUTDIR, f'{MAP_ID}-obstacles{sfx}.png')
        Image.fromarray(rgba, 'RGBA').save(p_png)
        files.append(p_png)
        del rgba

        art = art_for(bid)
        if art:
            base = Image.open(art).convert('RGBA')
            bw, bh = base.size
            small = np.array(Image.fromarray(CLS, 'L').resize((bw, bh), Image.NEAREST))
            ov = np.zeros((bh, bw, 4), dtype=np.uint8)
            for c in CLASSES:
                mk = small == CID[c]
                if not mk.any():
                    continue
                col = COLORS[c]
                for ch in range(3):
                    ov[..., ch][mk] = col[ch]
                ov[..., 3][mk] = 150
            p_jpg = os.path.join(OUTDIR, f'{MAP_ID}-obstacles{sfx}-check.jpg')
            Image.alpha_composite(base, Image.fromarray(ov, 'RGBA')).convert('RGB').save(
                p_jpg, quality=88)
            files.append(p_jpg)
            del base, ov, small
        del CLS

    parts = ['<?xml version="1.0" encoding="UTF-8"?>',
             f'<svg xmlns="http://www.w3.org/2000/svg" width="{RW}" height="{RH}" '
             f'viewBox="0 0 {RW} {RH}">',
             f'<title>{MAP_ID}: препятствия выше {CUT:.1f} м, этаж «{b["name"]}» '
             f'({"рельеф" if b["cut"] is None else "%.2f м" % b["cut"]})</title>']
    for c in CLASSES:
        col = '#%02x%02x%02x' % COLORS[c]
        for where in ('in', 'out'):
            items = R[c][where]
            if not items:
                continue
            gid = c if where == 'in' else f'{c}-outside'
            parts.append(f'<g id="{gid}" data-title="{TITLES[c]}" fill="{col}" fill-opacity="0.35" '
                         f'fill-rule="evenodd" stroke="{col}" stroke-width="1.5" '
                         f'stroke-linejoin="round" stroke-linecap="round"'
                         + (' opacity="0.4"' if where == 'out' else '') + '>')
            for cpx, opx in items:
                if cpx:
                    d = ' '.join('M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in P) + ' Z'
                                 for P in cpx)
                    parts.append(f'<path d="{d}"/>')
                if opx:
                    d = ' '.join('M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in P) for P in opx)
                    parts.append(f'<path fill="none" d="{d}"/>')
            parts.append('</g>')
    parts.append('</svg>')
    p_svg = os.path.join(OUTDIR, f'{MAP_ID}-obstacles{sfx}.svg')
    open(p_svg, 'w', encoding='utf-8').write('\n'.join(parts))
    files.append(p_svg)
    del parts

    summary[bid] = dict(band=[b['lo'], b['hi']], cutMeters=b['cut'], floorMeters=b['floorM'],
                        cutRule=b['rule'], instances=n_inst,
                        classes={c: dict(stat[bid][c], lengthM=round(stat[bid][c]['lengthM'], 1))
                                 for c in CLASSES},
                        areaM2=area, coverPercent=cover)
    log(f'{bid}: экземпляров {fmt(n_inst)}, покрытие {cover:.2f} % -> '
        f'{os.path.basename(p_svg)}')

# ─────────────────────────────────────────── сводка

noise = collections.Counter()
for i in range(len(inst)):
    if inst[i][5] == 'props':
        noise['/'.join(inst[i][7])] += 1

doc = dict(
    _='Слой 7 «препятствия выше 1 м» карты EFT: сечение геометрии на метре над полом. '
      'На карте с террейном наземный этаж режется ПОВЕРХНОСТЬЮ «земля + рез» (порог '
      'повершинно, рез следует рельефу); остальные этажи — плоскостью, уровень пола каждого '
      'ОЦЕНИВАЕТСЯ модой низов геометрии в полосе высот (полоса из манифеста — это диапазон '
      'для фильтра, а не пол). Ничего ниже реза не попадает по построению. Заливка — правило '
      'чёт-нечет поэкземплярно (полости вычитаются), объединение экземпляров по ИЛИ. '
      'В пиксель растра: px = frame.affine.px_from_x[0] + [1]*X, py = ...py_from_z...',
    map=MAP_ID, generated=time.strftime('%Y-%m-%d'),
    source=dict(client=DATA, registry='docs/registry/eft-scenes.json',
                skippedScenes=skipped_scenes, manifest=MAN_PATH.replace(chr(92), '/'),
                heightMap=HEIGHT_NPY.replace(chr(92), '/') if GROUND is not None else None,
                zoneMask=ZONE_PNG.replace(chr(92), '/') if ZONE is not None else None),
    frame=dict(width=RW, height=RH, affine=FR.affine, metersPerPixel=FR.mpp,
               coordinateRotation=FR.man.get('coordinateRotation', 0), mirrorX=FR.mirror_x),
    method=dict(cutMeters=CUT, floors=WANT_FLOORS, flatFloorEstimateM=round(FLOOR, 2),
                weld=WELD, simplify=SIMPLIFY, minLen=MIN_LEN, minAreaM2=MIN_AREA,
                meshReader='UnityPy MeshHandler (Mesh.export() НЕ используется: зеркалит X)',
                lodPolicy='свой MeshFilter = LOD0; иначе только дети lod[0]; '
                          'отсев _LOD1/2/3, SHADOW, BALLISTIC, COLLIDER',
                dropped={rx.pattern: DROPPED.get(rx.pattern, 0) for rx in DROP_RULES}),
    instances={c: int(by_cls.get(c, 0)) for c in CLASSES},
    floors=summary,
    meshesCrossed=n_hit, meshesMissed=n_miss, meshesFailed=n_fail,
    trianglesProcessed=int(tri_total),
    checks=checks, oversizedDropped=sorted(oversized, reverse=True)[:20],
    propBranches=noise.most_common(40),
)
p_json = os.path.join(OUTDIR, f'{MAP_ID}-obstacles.json')
json.dump(doc, open(p_json, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
files.append(p_json)

print()
print(f'=== ПРЕПЯТСТВИЯ ВЫШЕ {CUT:.1f} М — {MAP_ID} ' + '=' * 34)
for b in BANDS:
    sm = summary.get(b['id']) or {}
    cut = 'рельеф' if b['cut'] is None else '%.2f м' % b['cut']
    line = (f'  {b["id"]:12s} {b["name"][:22]:22s} рез {cut:>9s} | '
            f'экземпляров {fmt(sm.get("instances", 0)):>7s}')
    if sm.get('coverPercent') is not None:
        line += f' | покрытие {sm["coverPercent"]:5.2f} %'
    print(line)
if 'stonesCovered' in checks:
    k = checks['stonesCovered']
    print(f'  самопроверка камнями: под {k["hit"]} из {k["total"]} камней выше '
          f'{k["minHeightM"]} м есть силуэт')
print(f'  файлов записано: {len(files)}')
for f in files:
    print('   ', f)
