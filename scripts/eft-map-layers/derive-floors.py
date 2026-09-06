# -*- coding: utf-8 -*-
"""Этажи карты ИЗ ГЕОМЕТРИИ: где на самом деле лежат полы, включая подземные.

Зачем. Полосы этажности до сих пор задавались руками и от этого врут: у Маяка полоса
ровно одна и без высот, у Резерва и Улиц вся подземка слита в ОДНУ полосу, у Таможни
полосы перекрываются (`2nd [2.7, 6.5]` и `3rd [5.7, 1000]`). Здесь они выводятся
из клиента: плиты пола кластеризуются по высоте, и каждый населённый пик — этаж.

Метод. Берутся НИЗЫ мировых габаритов всех мешей сцены (m_LocalAABB, вершины не читаем)
и строится гистограмма с шагом `--bin`. Пик = уровень, на котором стоит много всего.
Считается два веса сразу:
  * ЧИСЛО мешей — ловит населённость (реквизит стоит на полу);
  * ПЛОЩАДЬ горизонтальной проекции — ловит сами плиты пола, которых мало, но они большие.
Пик, сильный только по числу, — это склад ящиков; сильный по площади — перекрытие.

⚠️ РАМКА НЕ НУЖНА. Высоты берутся из мировых координат и от привязки растра не зависят,
поэтому карты, у которых рамка сломана (Таможня и Лаборатория с `coordinateRotation=0`),
здесь всё равно анализируются.

usage: python derive-floors.py <EscapeFromTarkov_Data> <map> [--bin 0.25] [--min-share 0.005]
                               [--json <файл>] [--below N] [--scene-filter RX]
"""
import json
import os
import re
import sys
import time
from collections import defaultdict

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapgeom as mg                                                  # noqa: E402

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

t0 = time.time()


def log(m):
    print('[%6.1fs] %s' % (time.time() - t0, m), flush=True)


def opt(flag, default=None):
    return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else default


ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
if len(ARGS) < 2:
    sys.exit('usage: derive-floors.py <EscapeFromTarkov_Data> <map> [--bin 0.25] …')
DATA, MAP_ID = ARGS[0], ARGS[1]
BIN = float(opt('--bin', 0.25))
MIN_SHARE = float(opt('--min-share', 0.005))
OUT_JSON = opt('--json')
SCENE_FILTER = opt('--scene-filter')
HEIGHT_NPY = opt('--height')
MANIFEST = opt('--manifest')

SKIP_SCENE = re.compile(r'(terrain|sound|culling|background)', re.I)

# ⚠️ ПОЛ — ЭТО ТО, НА ЧЁМ СТОИТ ПЕРСОНАЖ (правило V4DYA, 06.09).
# Низы ВСЕХ мешей дают ложные уровни: лампы, вентиляция и потолочные модули висят
# и кластеризуются на своей высоте. У Лаборатории так получились «этажи» -1.62 и -0.88 —
# это `lab_lamp_lum_ceiling` и `Ventilation_grate`, то есть ПОТОЛКИ.
# Подвесное из опоры на пол исключаем.
HANGING_RX = re.compile(
    r'(lamp|light|chandelier|downlight|luminaire|armstrong|ceiling|potolok|'
    r'vent(ilation)?|air_cond|grate|duct|pipe_holder|cable|wire|banner|sign_|'
    r'smoke_detector|sprinkler|projector)', re.I)
# Мебель и тара — надёжные свидетели пола: они физически на нём стоят.
STANDING_RX = re.compile(
    r'(table|desk|chair|stool|shelf|rack|cabinet|locker|box\d|box_|crate|pallete|pallet|'
    r'barrel|container|bed|sofa|couch|safe|toolbox|folder|card_file|stove|fridge|'
    r'washstand|sink|wardrobe|nightstand)', re.I)
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCENES_JSON = os.path.join(REPO, 'docs', 'registry', 'eft-scenes.json')


def classify(path, name):
    return 'any'


SCENES, skipped = mg.scene_list(SCENES_JSON, MAP_ID, DATA, SKIP_SCENE)
if SCENE_FILTER:
    rx = re.compile(SCENE_FILTER, re.I)
    SCENES = [(lvl, nm) for lvl, nm in SCENES if rx.search(nm)]
log('сцен к разбору: %d' % len(SCENES))

MESHES = mg.MeshCache(DATA, keep=3)
bottoms, areas, tops, names = [], [], [], []
cxs, czs = [], []
kinds, thick = [], []      # 0 = подвесное, 1 = прочее, 2 = стоящее на полу
per_scene = defaultdict(int)
for lvl, nm in SCENES:
    try:
        sc = mg.Scene(DATA, lvl)
    except Exception as ex:
        log('  %s (%s): ОШИБКА чтения — %s' % (lvl, nm, ex))
        continue
    got = mg.collect_meshes(sc, classify)
    n_ok = 0
    for src, pid, pos, rot, scl, cls, name, br in got:
        a = MESHES.aabb(src, pid)
        if a is None:
            continue
        b = mg.world_box(a, pos, rot, scl)
        dx, dz = b[3] - b[0], b[5] - b[2]
        # мусор и вырожденные габариты (FLT_MAX у RainFall и подобных) отбрасываем
        if not np.isfinite(b).all() or dx > 5000 or dz > 5000:
            continue
        bottoms.append(b[1])
        tops.append(b[4])
        kinds.append(2 if STANDING_RX.search(name) else (0 if HANGING_RX.search(name) else 1))
        thick.append(b[4] - b[1])
        cxs.append((b[0] + b[3]) / 2.0)
        czs.append((b[2] + b[5]) / 2.0)
        areas.append(min(dx * dz, 10000.0))
        names.append(name)
        n_ok += 1
    per_scene[nm] = n_ok
    log('  %-9s %-44s мешей с габаритом %6d' % (lvl, nm, n_ok))
    del sc

if not bottoms:
    sys.exit('ОТКАЗ: ни одного меша с габаритом — проверь карту в реестре сцен')

B = np.asarray(bottoms, dtype=np.float64)
A = np.asarray(areas, dtype=np.float64)
T = np.asarray(tops, dtype=np.float64)
CX = np.asarray(cxs, dtype=np.float64)
CZ = np.asarray(czs, dtype=np.float64)
log('мешей всего %d; низы %.1f..%.1f м, верхи до %.1f м'
    % (len(B), B.min(), B.max(), T.max()))

# ⚠️ НА КАРТЕ С РЕЛЬЕФОМ АБСОЛЮТНАЯ ВЫСОТА ЭТАЖЕЙ НЕ ПОКАЗЫВАЕТ.
# У Маяка перепад рельефа 92.8 м: дом на отметке 5 м и дом на отметке 20 м дают
# свой первый этаж в РАЗНЫХ абсолютных высотах, и гистограмма размазывается по рельефу,
# а не по этажам. Поэтому при наличии карты высот считаем ПРЕВЫШЕНИЕ НАД ЗЕМЛЁЙ —
# тогда полы кластеризуются у 0, ~3, ~6 м независимо от того, где стоит здание.
REL = False
if HEIGHT_NPY and MANIFEST:
    if not os.path.exists(HEIGHT_NPY):
        sys.exit('ОТКАЗ: карты высот нет: %s' % HEIGHT_NPY)
    fr = mg.Frame(MANIFEST)
    gnd = mg.Ground(HEIGHT_NPY, fr)
    u, v = gnd._uv(CX, CZ)
    c = np.clip(np.round(u).astype(int), 0, gnd.gw - 1)
    r = np.clip(np.round(v).astype(int), 0, gnd.gh - 1)
    G = gnd.G[r, c].astype(np.float64)
    inside = (u >= 0) & (u <= gnd.gw - 1) & (v >= 0) & (v <= gnd.gh - 1) & np.isfinite(G)
    log('земля: %s; под сеткой оказалось %d из %d мешей'
        % (os.path.basename(HEIGHT_NPY), int(inside.sum()), len(B)))
    NM = np.asarray(names, dtype=object)[inside]
    K = np.asarray(kinds)[inside]
    TH = np.asarray(thick)[inside]
    B = (B - G)[inside]
    A = A[inside]
    T = (T - G)[inside]
    REL = True
    log('режим ПРЕВЫШЕНИЕ НАД ЗЕМЛЁЙ: %.1f..%.1f м' % (B.min(), B.max()))
    # хвосты по краям карты и мусор режем, иначе гистограмма растянута на километр
    keep = (B > -60) & (B < 80)
    B, A, T, NM, K, TH = B[keep], A[keep], T[keep], NM[keep], K[keep], TH[keep]
    log('в рабочем окне [-60, 80] м осталось %d мешей' % len(B))

lo, hi = np.floor(B.min() / BIN) * BIN, np.ceil(B.max() / BIN) * BIN
edges = np.arange(lo, hi + BIN, BIN)
cnt, _ = np.histogram(B, bins=edges)
ar, _ = np.histogram(B, bins=edges, weights=A)
centers = edges[:-1] + BIN / 2


def peaks(w, min_share):
    """Локальные максимумы веса, отделённые провалом; возвращает индексы по убыванию веса."""
    tot = w.sum() or 1.0
    idx = []
    for i in range(len(w)):
        if w[i] / tot < min_share:
            continue
        a = w[max(0, i - 2):i].max() if i else 0
        b = w[i + 1:i + 3].max() if i + 1 < len(w) else 0
        if w[i] >= a and w[i] >= b:
            idx.append(i)
    return sorted(idx, key=lambda i: -w[i])


if not REL:
    NM = np.asarray(names, dtype=object)
    K = np.asarray(kinds)
    TH = np.asarray(thick)

# СИГНАЛ 1: верх плиты — поверхность, по которой ходят (большая площадь, малая толщина).
slab = (A >= 8.0) & (TH <= 1.2)
cnt_slab, _ = np.histogram(T[slab], bins=edges)
ar_slab, _ = np.histogram(T[slab], bins=edges, weights=A[slab])
# СИГНАЛ 2: низ мебели и тары — они физически стоят на полу.
stand = (K == 2)
cnt_stand, _ = np.histogram(B[stand], bins=edges)
log('плит (площадь>=8 м², толщина<=1.2 м): %d; стоящей мебели и тары: %d; подвесного: %d'
    % (int(slab.sum()), int(stand.sum()), int((K == 0).sum())))

pk_cnt = peaks(cnt.astype(float), MIN_SHARE)
pk_area = peaks(ar_slab, MIN_SHARE)
pk_stand = peaks(cnt_stand.astype(float), MIN_SHARE)
set_area = set(pk_area)
set_stand = set(pk_stand)

print('\n=== КАНДИДАТЫ В ЭТАЖИ — %s (шаг %.2f м) ===' % (MAP_ID, BIN))
print('%9s %9s %9s %11s  %-14s %s'
      % ('высота', 'плит', 'мебели', 'площадь м²', 'признак', 'что там'))
rows = []
for i in sorted(set_area | set_stand, key=lambda i: centers[i]):
    share_c = 100.0 * cnt[i] / len(B)
    share_a = 100.0 * ar[i] / (ar.sum() or 1)
    tag = []
    if i in set_area:
        tag.append('ПОЛ')
    if i in set_stand:
        tag.append('мебель')
    sel = (B >= edges[i]) & (B < edges[i + 1])
    from collections import Counter
    top = Counter(NM[sel]).most_common(4)
    who = ', '.join('%s x%d' % (n[:26], c) for n, c in top)
    print('%9.2f %9d %9d %11.0f  %-14s %s'
          % (centers[i], cnt_slab[i], cnt_stand[i], ar_slab[i], '+'.join(tag), who))
    rows.append(dict(height=round(float(centers[i]), 2), meshes=int(cnt[i]),
                     shareMeshes=round(share_c, 3), area=round(float(ar[i]), 1),
                     shareArea=round(share_a, 3), slab=i in set_area,
                     slabs=int(cnt_slab[i]), standing=int(cnt_stand[i]),
                     populated=i in set_stand, top=[[n, int(c)] for n, c in top]))

under = [r for r in rows if r['height'] < 0]
print('\nиз них НИЖЕ нуля: %d' % len(under))
for r in under:
    print('   %8.2f м  мешей %6d  площадь %9.0f м²  %s'
          % (r['height'], r['meshes'], r['area'],
             ', '.join('%s x%d' % (n[:24], c) for n, c in r['top'][:3])))

if OUT_JSON:
    json.dump(dict(map=MAP_ID, bin=BIN, minShare=MIN_SHARE,
                   relativeToGround=REL,
                   meshes=int(len(B)), zMin=float(B.min()), zMax=float(T.max()),
                   scenes={k: v for k, v in per_scene.items()}, candidates=rows),
              open(OUT_JSON, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    log('записано: %s' % OUT_JSON)
