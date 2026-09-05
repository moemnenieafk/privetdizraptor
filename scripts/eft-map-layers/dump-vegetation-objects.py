# -*- coding: utf-8 -*-
# Растительность карты EFT из ОБЪЕКТОВ СЦЕНЫ — для карт, где её нет в террейне.
#
# ЗАЧЕМ ОТДЕЛЬНЫЙ СКРИПТ. Штатный `scripts/eft-terrain/extract-vegetation.py` берёт деревья
# из `TerrainData`: Unity хранит там список экземпляров с позицией, поворотом и масштабом.
# Но у Улиц Таркова, Терминала, Завода, Лаборатории и Ледокола ТЕРРЕЙНА НЕТ ВООБЩЕ — ни одной
# terrain-ноды в сценах, — и растительность там расставлена обычными объектами. У Улиц это
# 4 000+ узлов, у Терминала около 20 600. Без этого скрипта такие карты остаются без слоя.
#
# ЧТО СЧИТАЕТСЯ РАСТИТЕЛЬНОСТЬЮ. Словарь ИМЁН (см. VEG_RX) — как у камней в dump-stones.py.
# Прокси-геометрия (`SHADOW`, `COLLIDER`, `BALL?ISTIC`, `_LOD1/2/3`) отсеивается безусловно,
# LOD-политика общая: свой MeshFilter = LOD0, иначе только дети `lod[0]`.
#
# РАДИУС КРОНЫ — НЕ константа, а половина большей горизонтальной стороны мирового габарита
# меша (`m_LocalAABB` в мировом TRS). Поэтому куст и сосна на карте отличаются размером,
# и по кругам можно обводить настоящие пятна крон, а не ставить точки одного размера.
#
# ⚠️ ПОВОРОТ И МАСШТАБ ПИШУТСЯ НАСТОЯЩИЕ (`quat`, `scale`, пивот `ox/oy/oz`). Поля
# `rot/scaleW/scaleH` формата террейна остаются нулевыми — они описывают ТОЛЬКО рыскание и
# единый масштаб, а объекту сцены этого мало. Без настоящих величин рендер клал бы 750+
# живых изгородей Улиц (`privet_hedge`, `fibert_hedge_*`) поперёк улиц вместо вдоль, а
# позиция уезжала бы на смещение пивота от центра габарита.
#
# ⚠️ ГОЧА: у карты может не быть ни одного дерева в НЕПРОПУЩЕННЫХ сценах, зато сотни в
# `*_Background` — сцене декораций горизонта, которую все слои пропускают. У Терминала там
# 13 124 узла из 20 600. Скрипт считает их отдельно и печатает вслух, а не молчит.
#
# Вход:  <EscapeFromTarkov_Data> <map> <manifest> <outdir>
#        [--all-scenes]  считать и пропускаемые сцены (фон/культинг) — по умолчанию нет
# Выход: <map>-vegetation.json  формат ОДИН В ОДИН с extract-vegetation.py (instances/kinds/
#                               groups) — его читает рендер объектов
#        <map>-vegetation.csv   то же плоским списком
#        <map>-vegetation.svg   круги крон в рамке растра, группы conifer/broadleaf/bush/other
#        <map>-veg-density.png  плотность (заливка кругами) — быстрый взгляд, где лес
#
# Запуск:
#   python scripts/eft-map-layers/dump-vegetation-objects.py \
#     "D:/Games/Escape from Tarkov/EscapeFromTarkov_Data" streets-of-tarkov \
#     D:/Games/raster/streets-of-tarkov/manifest.json \
#     map-exports/OBJECTS-MAPS/gen/streets-of-tarkov/ground
#
# Зависимости: UnityPy, numpy, Pillow. Ядро — scripts/eft-map-layers/mapgeom.py.

import sys, os, re, json, csv, time, collections, math

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapgeom as mg

Image.MAX_IMAGE_PIXELS = None

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

argv = sys.argv[1:]
ALL_SCENES = '--all-scenes' in argv
if ALL_SCENES:
    argv.remove('--all-scenes')
if len(argv) < 4:
    sys.exit('использование: python scripts/eft-map-layers/dump-vegetation-objects.py '
             '<EscapeFromTarkov_Data> <map> <manifest> <outdir> [--all-scenes]')
DATA, MAP_ID, MAN_PATH, OUTDIR = argv[0], argv[1], argv[2], argv[3]
os.makedirs(OUTDIR, exist_ok=True)
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCENES_JSON = os.path.join(REPO, 'docs', 'registry', 'eft-scenes.json')
GEN = os.path.dirname(os.path.abspath(OUTDIR))

# ─────────────────────────────────────────── словари

VEG_RX = re.compile(r'(?<![A-Za-z])(tree|bush|pine|spruce|birch|oak|maple|fir|shrub|foliage|'
                    r'leaf|leaves|vetk|kust|derev|palm|reed|fern|hedge|plant|grass|nettle|'
                    r'burdock|wolf|sapling|stump)(?![A-Za-z])', re.I)
# `plant_wolf*` у BSG — куст (лопух), `grass_*` — трава-карточка; оба ловятся словарём выше.
VEG_NOT_RX = re.compile(r'(planter|plantation|plant_pot|grassland_decal|treeh?ouse|'
                        r'plant_station|power_?plant)', re.I)
# ⚠️ Отдельный словарь ПО ИМЕНИ узла, а не по пути. Дописать эти слова в VEG_NOT_RX выше
# НЕЛЬЗЯ: он проверяется по ПУТИ, и `door` выкосил бы всё в ветках `*_indoor_*`/`*_outdoor_*`.
#
# Что ловим (замерено на Улицах, 532 экземпляра из 3 492 — 15 %):
#  • `leaf` у BSG — это СТВОРКА окна и раздвижной двери, а не лист: `Window_wood_03-…_leaf_
#    glass_A`, `TD_Klimova_sliding_door_01_leaf_left`. 164 штуки, медиана высоты 2.11 м —
#    вертикальные плоскости в проёмах, на карте кроны рисовать нечем.
#  • Декали: `palm_plant_01_ground_decal`, `Ground_Decal_2_leaves_corner_*`. 173 штуки,
#    медиана высоты 0.00 м — пыль и тень под пальмой, плоскость на земле.
#  • `Scattered_Leaves_*` — опавшая листва, в том числе НА МАШИНАХ (`…_Car_Cruze_Glass`).
#    195 штук, медиана высоты 0.01 м. Это подстилка, а не растение с кроной.
VEG_NOT_NAME_RX = re.compile(r'(window|sliding_door|decal|scattered_leaves)', re.I)
GROUP_RX = [
    (re.compile(r'(pine|spruce|fir|conifer|ель|сосн)', re.I), 'conifer'),
    (re.compile(r'(birch|oak|maple|filbert|tree|derev|palm)', re.I), 'broadleaf'),
    (re.compile(r'(bush|shrub|kust|wolf|nettle|burdock|fern|reed|hedge|plant|sapling)', re.I), 'bush'),
]
GROUP_COLORS = {'conifer': '#2f7d4f', 'broadleaf': '#63a83a', 'bush': '#8fbf5a', 'other': '#6f7f5a'}
SKIP_SCENE = re.compile(r'(terrain|sound|culling|background)', re.I)
MIN_R = 0.25          # м: меньше — трава-карточка, в карту крон не идёт
MAX_R = 25.0          # м: больше — не дерево, а декорация горизонта
# Гарда на ПЛОСКОЕ. Порогом высоты одни декали не отсечь — они дотягиваются до 0.64 м, а
# настоящий `ash_bush01` начинается с 0.25 м, диапазоны пересекаются. Поэтому здесь только
# заведомо плоское (медиана декалей 0.00 м), а точную работу делает VEG_NOT_NAME_RX.
MIN_H = 0.2           # м

t0 = time.time()


def log(*a):
    print(f'[{time.time() - t0:6.1f}s]', *a, flush=True)


fmt = mg.fmt


def group_of(name):
    for rx, g in GROUP_RX:
        if rx.search(name):
            return g
    return 'other'


def classify(path, name):
    if VEG_NOT_RX.search(path) or VEG_NOT_NAME_RX.search(name):
        return None
    return 'veg' if VEG_RX.search(name) else None


# ─────────────────────────────────────────── рамка

FR = mg.Frame(MAN_PATH)
RW, RH = FR.W, FR.H
log(f'рамка {MAP_ID}: {RW}x{RH} px, {FR.mpp * 100:.2f} см/px')
log('  ' + FR.verify(os.path.join(GEN, 'rooms', f'{MAP_ID}-rooms-frame.json')))

# ─────────────────────────────────────────── сбор экземпляров

skip = None if ALL_SCENES else SKIP_SCENE
SCENES, skipped = mg.scene_list(SCENES_JSON, MAP_ID, DATA, skip)
MESHES = mg.MeshCache(DATA, keep=3)
rows = []
per_scene = collections.Counter()
for lvl, nm in SCENES:
    try:
        sc = mg.Scene(DATA, lvl)
    except Exception as ex:
        log(f'  {lvl} ({nm}): ОШИБКА чтения — {ex}')
        continue
    got = mg.collect_meshes(sc, classify, with_go=True)
    for src, pid, pos, rot, scl, cls, name, br, go in got:
        a = MESHES.aabb(src, pid)
        if a is None:
            continue
        b = mg.world_box(a, pos, rot, scl)
        r = max(b[3] - b[0], b[5] - b[2]) / 2.0
        if r < MIN_R or r > MAX_R or (b[4] - b[1]) < MIN_H:
            continue
        kind = re.sub(r'(\s*\(\d+\)|\(Clone\))+\s*$', '', name).strip()
        kind = re.sub(r'_LOD0$', '', kind, flags=re.I)
        rows.append(dict(scene=nm, kind=kind, group=group_of(kind),
                         x=round((b[0] + b[3]) / 2, 2), z=round((b[2] + b[5]) / 2, 2),
                         y=round(b[1], 2), height=round(b[4] - b[1], 2), radius=round(r, 2),
                         rot=0.0, scaleW=1.0, scaleH=1.0,
                         # НАСТОЯЩИЙ мировой TRS узла — для рендера, см. блок ниже.
                         ox=round(pos[0], 3), oy=round(pos[1], 3), oz=round(pos[2], 3),
                         quat=[round(v, 5) for v in rot],
                         scale=[round(v, 4) for v in scl],
                         level=lvl, go=int(go)))
    per_scene[nm] += len(got)
    del sc
    MESHES.evict()
log(f'сцен прочитано {len(SCENES)}, пропущено {len(skipped)}')
if not rows:
    sys.exit('ОТКАЗ: ни одного узла растительности — проверь VEG_RX и группу сцен')

for r in rows:
    p = FR.to_px(np.array([[r['x'], r['z']]]))[0]
    r['px'], r['py'] = int(round(p[0])), int(round(p[1]))
groups = collections.Counter(r['group'] for r in rows)
kinds = collections.Counter(r['kind'] for r in rows)
in_frame = sum(1 for r in rows if 0 <= r['px'] < RW and 0 <= r['py'] < RH)
log(f'растительности {fmt(len(rows))}: ' + ', '.join(f'{k}={fmt(v)}' for k, v in groups.most_common())
    + f'; в рамке {fmt(in_frame)}; видов {len(kinds)}')
log('  топ видов: ' + ', '.join(f'{k} x{v}' for k, v in kinds.most_common(8)))

# фоновая сцена считается отдельно и НАЗЫВАЕТСЯ вслух: там может лежать больше, чем в карте
if not ALL_SCENES:
    bg = [s for s in skipped if 'background' in s.lower()]
    if bg:
        log(f'  ⚠ вне подсчёта остались сцены-декорации: {", ".join(bg[:3])} — '
            f'прогнать с --all-scenes, если они нужны')

# ─────────────────────────────────────────── выход

base = os.path.join(OUTDIR, f'{MAP_ID}-vegetation')
json.dump(dict(
    _='Растительность из ОБЪЕКТОВ СЦЕНЫ (у карты нет террейна). Формат НАДМНОЖЕСТВО '
      'extract-vegetation.py: те же поля плюс настоящий TRS и ссылка на прототип. radius — '
      'половина большей горизонтальной стороны мирового габарита меша, то есть настоящий '
      'размер кроны, а не константа.',
    fields='x/z — ЦЕНТР ГАБАРИТА (для кругов крон в SVG и плотности), ox/oy/oz — ПИВОТ узла; '
           'rot/scaleW/scaleH оставлены нулевыми ради совместимости формата, настоящие '
           'поворот и масштаб лежат в quat (x,y,z,w) и scale (три оси). level+go — файл сцены '
           'и path_id узла: по этой паре рендер достаёт прототип вида ТОЧНО, вместе с '
           'материалами. У карт с террейном этих полей нет, и рендер откатывается на rot/scaleW.',
    map=MAP_ID, generated=time.strftime('%Y-%m-%d'), source='объекты сцен клиента',
    bounds=[FR.XMIN, FR.XMAX, FR.ZMIN, FR.ZMAX], raster=[RW, RH],
    scenes=[nm for _, nm in SCENES], skippedScenes=skipped,
    groups=dict(groups), kinds=dict(kinds.most_common()),
    instances=rows, unresolved=[],
), open(base + '.json', 'w', encoding='utf-8'), ensure_ascii=False)

with open(base + '.csv', 'w', encoding='utf-8', newline='') as f:
    w = csv.DictWriter(f, fieldnames=['kind', 'group', 'x', 'z', 'y', 'height', 'radius',
                                      'px', 'py', 'scene'], extrasaction='ignore')
    w.writeheader()
    w.writerows(rows)

svg = ['<?xml version="1.0" encoding="UTF-8"?>',
       f'<svg xmlns="http://www.w3.org/2000/svg" width="{RW}" height="{RH}" '
       f'viewBox="0 0 {RW} {RH}">',
       f'<title>{MAP_ID}: растительность из объектов сцены, {len(rows)} экземпляров</title>']
for g in ('conifer', 'broadleaf', 'bush', 'other'):
    sel = [r for r in rows if r['group'] == g]
    if not sel:
        continue
    svg.append(f'<g id="{g}" fill="{GROUP_COLORS[g]}" fill-opacity="0.35" '
               f'stroke="{GROUP_COLORS[g]}" stroke-width="1.5">')
    for r in sel:
        svg.append(f'<circle cx="{r["px"]}" cy="{r["py"]}" r="{max(2, r["radius"] / FR.mpp):.0f}"/>')
    svg.append('</g>')
svg.append('</svg>')
open(base + '.svg', 'w', encoding='utf-8').write('\n'.join(svg))

im = Image.new('RGBA', (RW, RH), (0, 0, 0, 0))
dr = ImageDraw.Draw(im)
for g in ('conifer', 'broadleaf', 'bush', 'other'):
    col = tuple(int(GROUP_COLORS[g][i:i + 2], 16) for i in (1, 3, 5)) + (150,)
    for r in rows:
        if r['group'] != g:
            continue
        rr = max(2.0, r['radius'] / FR.mpp)
        dr.ellipse([r['px'] - rr, r['py'] - rr, r['px'] + rr, r['py'] + rr], fill=col)
im.save(base.replace('-vegetation', '-veg-density') + '.png')

print()
print(f'=== РАСТИТЕЛЬНОСТЬ {MAP_ID} ' + '=' * 40)
for g, n in groups.most_common():
    rs = [r['radius'] for r in rows if r['group'] == g]
    print(f'  {g:10s} {fmt(n):>7s}  радиус кроны медиана {np.median(rs):4.1f} м, '
          f'макс {max(rs):4.1f} м')
print(f'  всего {fmt(len(rows))}, в рамке {fmt(in_frame)}, видов {len(kinds)}')
for p in (base + '.json', base + '.csv', base + '.svg',
          base.replace('-vegetation', '-veg-density') + '.png'):
    print('   ', p)
