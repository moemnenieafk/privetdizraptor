# -*- coding: utf-8 -*-
"""Слой ЛЕСТНИЦ карты: где подниматься между этажами.

Зачем. Лестницы физически теряются в слоях этажей: те строятся СЕЧЕНИЕМ плоскостью,
а лестница пересекает плоскость в одной точке и в контур не превращается (канон
из скилла map-3d-clay). Поэтому их берут отдельно — по именам, а не резом.

Два источника, оба от клиента:
  1. МЕШИ с «лестничными» именами (`stair`, `ladder`, `stepladder`, `escalator`…).
     Проверено на Резерве: 64 уникальных имени, 216 экземпляров.
  2. КОМНАТЫ BSG, названные лестничными (`stairs_L_enter_f_03` у Улиц) — это
     лестничные клетки целиком, они шире отдельного меша.

На выход: `<карта>-stairs.json` (мировые координаты + пиксели рамки) и SVG-метки.

usage: python dump-stairs.py <EscapeFromTarkov_Data> <map> <manifest> <outdir>
                             [--rooms <rooms.json>]
"""
import json
import os
import re
import sys
import time
from collections import Counter

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


def opt(f, d=None):
    return sys.argv[sys.argv.index(f) + 1] if f in sys.argv else d


A = [a for a in sys.argv[1:] if not a.startswith('--')]
if len(A) < 4:
    sys.exit('usage: dump-stairs.py <EscapeFromTarkov_Data> <map> <manifest> <outdir>')
DATA, MAP_ID, MAN, OUT = A[0], A[1], A[2], A[3]
ROOMS = opt('--rooms', 'D:/eft-export/%s/%s-rooms.json' % (MAP_ID, MAP_ID))

# Словарь выверен сканом Резерва и Улиц. `trap`/`ramp` НЕ берём: `trap` ловит
# `trap_door` вперемешку с `Trapeze`, `ramp` — въездные пандусы, это не лестницы.
STAIR_RX = re.compile(r'(stair|ladder|stepladder|lestn|escalator|steps_)', re.I)
# Мусор, который попадает по слову, но лестницей не является.
NOT_RX = re.compile(r'(decal|paintcrack|_wall|_walls|dirt|rust|blood|poster)', re.I)
SKIP_SCENE = re.compile(r'(terrain|sound|culling|background)', re.I)
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCENES_JSON = os.path.join(REPO, 'docs', 'registry', 'eft-scenes.json')

FR = mg.Frame(MAN)
log('рамка %s: %dx%d px, %.2f см/px' % (MAP_ID, FR.W, FR.H, FR.mpp * 100))

MESHES = mg.MeshCache(DATA, keep=3)
SCENES, _ = mg.scene_list(SCENES_JSON, MAP_ID, DATA, SKIP_SCENE)
items, kinds = [], Counter()
for lvl, nm in SCENES:
    try:
        sc = mg.Scene(DATA, lvl)
    except Exception as ex:
        log('  %s: ОШИБКА чтения — %s' % (lvl, ex))
        continue
    for src, pid, pos, rot, scl, cls, name, br in mg.collect_meshes(sc, lambda p, n: 'any'):
        if not STAIR_RX.search(name) or NOT_RX.search(name):
            continue
        a = MESHES.aabb(src, pid)
        if a is None:
            continue
        b = mg.world_box(a, pos, rot, scl)
        if not np.isfinite(b).all():
            continue
        h = b[4] - b[1]
        # ⚠️ Порог высоты. Без него в лестницы попадают декали и плоские накладки
        # со словом ladder в имени: они лежат на стене и никуда не ведут.
        if h < 1.2:
            continue
        items.append(dict(name=name, scene=nm, src=src, pid=int(pid),
                          x=round(float((b[0] + b[3]) / 2), 2),
                          y=round(float(b[1]), 2),
                          z=round(float((b[2] + b[5]) / 2), 2),
                          height=round(float(h), 2),
                          box=[round(float(v), 2) for v in b], source='mesh'))
        kinds[name] += 1
    del sc
log('лестничных мешей: %d экземпляров, %d уникальных имён' % (len(items), len(kinds)))

# ── лестничные КОМНАТЫ ────────────────────────────────────────────────────────
n_rooms = 0
if os.path.exists(ROOMS):
    rd = json.load(open(ROOMS, encoding='utf-8'))
    for r in rd.get('rooms') or []:
        nm = str(r.get('name') or '')
        if not STAIR_RX.search(nm) or NOT_RX.search(nm):
            continue
        c, e = r.get('center'), r.get('extent')
        if not c or not e:
            continue
        items.append(dict(name=nm, scene=r.get('scene'), src=None, pid=None,
                          x=round(float(c[0]), 2), y=round(float(c[1] - e[1]), 2),
                          z=round(float(c[2]), 2), height=round(float(e[1] * 2), 2),
                          box=[c[0] - e[0], c[1] - e[1], c[2] - e[2],
                               c[0] + e[0], c[1] + e[1], c[2] + e[2]],
                          source='room'))
        n_rooms += 1
    log('лестничных комнат BSG: %d' % n_rooms)
else:
    log('! разметки комнат нет (%s) — только меши' % os.path.basename(ROOMS))

# ── проекция в рамку ──────────────────────────────────────────────────────────
inside = 0
# to_px ждёт (N,2) = (x, z). Тройка [x,y,z] подсунула бы ВЫСОТУ вместо z
P = FR.to_px(np.array([[it['x'], it['z']] for it in items], dtype=np.float64))
for it, (px, py) in zip(items, P):
    it['px'], it['py'] = round(float(px), 1), round(float(py), 1)
    it['inFrame'] = bool(0 <= px <= FR.W and 0 <= py <= FR.H)
    inside += it['inFrame']
log('в рамке: %d из %d' % (inside, len(items)))

os.makedirs(OUT, exist_ok=True)
jp = os.path.join(OUT, '%s-stairs.json' % MAP_ID)
json.dump(dict(map=MAP_ID, generated=time.strftime('%Y-%m-%dT%H:%M:%S'),
               source='dump-stairs.py — меши с лестничными именами + лестничные комнаты BSG',
               frame=dict(W=FR.W, H=FR.H), counts=dict(mesh=len(items) - n_rooms,
               room=n_rooms, inFrame=inside), kinds=kinds.most_common(40), items=items),
          open(jp, 'w', encoding='utf-8'), ensure_ascii=False)

sp = os.path.join(OUT, '%s-stairs.svg' % MAP_ID)
R = max(6.0, 0.9 / FR.mpp)          # метка ~0.9 м в пикселях рамки
with open(sp, 'w', encoding='utf-8') as f:
    f.write('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" '
            'viewBox="0 0 %d %d">\n' % (FR.W, FR.H, FR.W, FR.H))
    f.write('<g id="stairs" fill="none" stroke="#FFCF00" stroke-width="%.1f">\n' % max(2.0, R / 4))
    for it in items:
        if not it['inFrame']:
            continue
        col = '#FFCF00' if it['source'] == 'mesh' else '#00D0FF'
        f.write('<circle cx="%.1f" cy="%.1f" r="%.1f" stroke="%s"/>\n'
                % (it['px'], it['py'], R, col))
    f.write('</g>\n</svg>\n')
log('ЗАПИСАНО: %s и %s' % (os.path.basename(jp), os.path.basename(sp)))
print('\nтоп имён:')
for n, c in kinds.most_common(12):
    print('   %-46s %4d' % (n[:46], c))
