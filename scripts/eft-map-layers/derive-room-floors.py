# -*- coding: utf-8 -*-
"""Этаж и пол КАЖДОЙ комнаты карты — из разметки самого клиента.

Зачем. Полоса высот не может разделить этажи, если здания стоят на разной отметке:
у Маяка пол `_f1` гуляет от 0.1 до 36.6 м, а `_f2` от 4.6 до 41.4 — первый этаж одного
дома физически НИЖЕ второго у соседнего. У Резерва 178 комнат `basement` размазаны
на 22 метра по глубине. Поэтому этаж берётся не из диапазона высот, а у комнаты.

Что на выходе. `<карта>-room-floors.json`: у каждой комнаты метка этажа, ЧЕСТНЫЙ пол
(`center.y − extent.y`, без оценки) и ориентированный бокс для проверки попадания.
Слой = метка этажа и собирает комнаты С РАЗНЫХ абсолютных высот.

Комнаты без метки (у Улиц таких 89 %) получают этаж ВНУТРИ своей постройки:
полы комнат постройки кластеризуются, и уровень называется по порядку снизу вверх.
Если в постройке есть помеченные комнаты, непомеченные примыкают к ближайшему
известному уровню — так нумерация остаётся BSG-шной, а не изобретённой.

usage: python derive-room-floors.py <map> [--rooms <rooms.json>] [--out <файл>]
                                   [--gap 2.2]
"""
import json
import os
import re
import sys
from collections import defaultdict

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass


def opt(flag, default=None):
    return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else default


ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
if not ARGS:
    sys.exit('usage: derive-room-floors.py <map> [--rooms …] [--out …] [--gap 2.2]')
MAP_ID = ARGS[0]
ROOMS = opt('--rooms', 'D:/eft-export/%s/%s-rooms.json' % (MAP_ID, MAP_ID))
OUT = opt('--out', 'map-exports/OBJECTS-MAPS/_floors/%s-room-floors.json' % MAP_ID)
GAP = float(opt('--gap', 2.2))          # минимальный зазор между уровнями, м

# Метки этажа в именах BSG. Порядок важен: `basement` и `roof` сильнее цифры,
# потому что встречаются вместе (`Bunker_f1` — это подвал, а не первый этаж).
WORD = [(r'basement|podval|cellar|bunker|underground', 'basement'),
        (r'roof|attic', 'roof'),
        (r'GroundFloor', 'f0'), (r'FirstFloor', 'f1'), (r'SecondFloor', 'f2'),
        (r'ThirdFloor', 'f3'), (r'FourthFloor', 'f4'), (r'FifthFloor', 'f5')]


def label_of(name, path):
    s = '%s %s' % (name, path)
    for rx, lab in WORD:
        if re.search(rx, s, re.I):
            return lab
    m = re.search(r'_f(\d)', s, re.I)
    if m:
        return 'f%s' % m.group(1)
    m = re.search(r'LastFloor', s, re.I)
    return 'top' if m else None


d = json.load(open(ROOMS, encoding='utf-8'))
rooms = d.get('rooms') or []
builds = d.get('buildings') or []
print('карта %s: комнат %d, построек %d' % (MAP_ID, len(rooms), len(builds)))

out = []
for i, r in enumerate(rooms):
    c, e = r.get('center'), r.get('extent')
    if not c or not e:
        continue
    out.append(dict(idx=i, name=r.get('name') or '', path=r.get('path') or '',
                    label=label_of(str(r.get('name') or ''), str(r.get('path') or '')),
                    floor=round(float(c[1]) - float(e[1]), 3),
                    top=round(float(c[1]) + float(e[1]), 3),
                    center=[round(float(v), 3) for v in c],
                    extent=[round(float(v), 3) for v in e],
                    boxes=r.get('boxes') or [], building=None))

# ── привязка комнат к постройкам (по центру внутри габарита) ──────────────────
for b in builds:
    b['_lo'], b['_hi'] = b['min'], b['max']
for r in out:
    cx, cy, cz = r['center']
    best, bestv = None, None
    for k, b in enumerate(builds):
        lo, hi = b['_lo'], b['_hi']
        if lo[0] <= cx <= hi[0] and lo[2] <= cz <= hi[2] and lo[1] - 3 <= cy <= hi[1] + 3:
            v = (hi[0] - lo[0]) * (hi[2] - lo[2])
            if bestv is None or v < bestv:      # самая тесная постройка — вернее
                best, bestv = k, v
    r['building'] = best

# ⚠️ У Маяка в дампе НЕТ раздела `buildings` (0 построек), и без него 92 комнаты
# остаются без этажа. Запасной путь: сшить комнаты в псевдо-постройки по горизонтальной
# близости — дом это связная группа комнат, стоящих друг на друге и рядом.
if not builds:
    print('построек в дампе нет — сшиваю комнаты в группы по близости')
    R = 12.0                     # м: радиус связности по горизонтали
    parent = list(range(len(out)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    pts = [(r['center'][0], r['center'][2],
            max(r['extent'][0], r['extent'][2])) for r in out]
    for a in range(len(out)):
        xa, za, ea = pts[a]
        for b in range(a + 1, len(out)):
            xb, zb, eb = pts[b]
            if abs(xa - xb) <= ea + eb + R and abs(za - zb) <= ea + eb + R:
                union(a, b)
    groups = {}
    for i in range(len(out)):
        groups.setdefault(find(i), []).append(i)
    for gi, (root, idxs) in enumerate(sorted(groups.items(), key=lambda kv: -len(kv[1]))):
        for i in idxs:
            out[i]['building'] = gi
    print('  групп собрано: %d (крупнейшая %d комнат)'
          % (len(groups), max(len(v) for v in groups.values())))

known = sum(1 for r in out if r['label'])
print('с меткой BSG: %d из %d (%.0f %%); привязано к постройке: %d'
      % (known, len(out), 100.0 * known / max(1, len(out)),
         sum(1 for r in out if r['building'] is not None)))


def cluster(vals, gap):
    """Уровни: соседние полы ближе `gap` считаются одним этажом."""
    lv, cur = [], []
    for v in sorted(vals):
        if cur and v - cur[-1] > gap:
            lv.append(cur); cur = []
        cur.append(v)
    if cur:
        lv.append(cur)
    return [sum(c) / len(c) for c in lv]


# ── этаж для непомеченных: внутри своей постройки ─────────────────────────────
by_b = defaultdict(list)
for r in out:
    by_b[r['building']].append(r)

derived = 0
for bid, rs in by_b.items():
    if bid is None:
        continue
    levels = cluster([r['floor'] for r in rs], GAP)
    # известные уровни этой постройки: метка -> средний пол
    anchor = {}
    for r in rs:
        if r['label']:
            anchor.setdefault(r['label'], []).append(r['floor'])
    anchor = {k: sum(v) / len(v) for k, v in anchor.items()}
    for r in rs:
        if r['label']:
            continue
        if anchor:                      # примкнуть к ближайшему известному уровню
            lab = min(anchor, key=lambda k: abs(anchor[k] - r['floor']))
            if abs(anchor[lab] - r['floor']) <= GAP:
                r['label'] = lab
                r['labelSource'] = 'ближайший помеченный уровень постройки'
                derived += 1
                continue
        k = min(range(len(levels)), key=lambda j: abs(levels[j] - r['floor']))
        r['label'] = 'lvl%d' % k
        r['labelSource'] = 'порядок уровня внутри постройки'
        derived += 1

for r in out:
    if not r['label']:
        r['label'] = 'unassigned'
        r.setdefault('labelSource', 'ни метки, ни постройки')
    r.setdefault('labelSource', 'метка BSG')

stat = defaultdict(list)
for r in out:
    stat[r['label']].append(r['floor'])
print('выведено для непомеченных: %d' % derived)
print('\n%-12s %7s  %s' % ('этаж', 'комнат', 'полы, м'))
for k in sorted(stat, key=lambda k: -len(stat[k])):
    a = sorted(stat[k])
    print('%-12s %7d  от %7.1f до %7.1f (медиана %6.1f)'
          % (k, len(a), a[0], a[-1], a[len(a) // 2]))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(dict(map=MAP_ID, source=ROOMS, gap=GAP,
               counts={k: len(v) for k, v in stat.items()}, rooms=out),
          open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
print('\nзаписано: %s' % OUT)
