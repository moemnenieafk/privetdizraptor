# -*- coding: utf-8 -*-
"""Инвентаризация ЗАСТРОЙКИ карт и замер цены «знакового здания» в треугольниках.

Зачем. Мы строим 3D-карту гибридом: массовая застройка — экструзия наших 2D-силуэтов
(дёшево), а десяток знаковых строений на карту — реальной геометрией клиента (дорого).
Экструзию уже померили (docs/research/deep-research-3d-clay-maps.md). Здесь меряется
вторая половина: СКОЛЬКО построек вообще есть, какие из них крупные (кандидаты в знаковые)
и во что обходится одна такая постройка настоящими треугольниками против её же призмы.

Откуда данные — только готовые артефакты, конвейер не перезапускается:
  · D:/eft-export/<map>/<map>-rooms.json  — здания с ИМЕНЕМ BSG, путём в иерархии и AABB
    в игровых метрах (пишет scripts/eft-rooms/dump-rooms.py). ВНИМАНИЕ: вопреки ходившему
    по проекту утверждению «имён зданий в артефактах нет» — они есть именно здесь;
    в SVG из gen/ их действительно нет, там остаются безымянные <rect>.
  · gen/<map>/rooms/<map>-rooms-<layer>.svg — те же здания как <rect> в пикселях,
    используются ПЕРЕКРЁСТНОЙ ПРОВЕРКОЙ (rooms.json -> аффина -> rect должен совпасть).
  · D:/eft-export/<map>/render-objects/<map>-occluders.json — вся геометрия сцены
    экземплярами (mesh/x/y/z/quat/scale) + прототипы с полем `tris`
    (пишет scripts/eft-map-layers/dump-occluders.py). Это и есть источник честного
    замера «сколько треугольников внутри пятна здания».

usage:
  python inventory-buildings.py inventory [карта ...]   — таблицы + топ-30 (json на stdout)
  python inventory-buildings.py cost <карта> [--top 30] — треугольники в пятне здания
"""
import json
import os
import re
import sys
import math

GEN = r'C:/cta-project/map-exports/OBJECTS-MAPS/gen'
EXP = r'D:/eft-export'
MAPS = ['customs', 'reserve', 'streets-of-tarkov', 'ground-zero', 'terminal',
        'shoreline', 'woods', 'interchange', 'lighthouse', 'icebreaker']

_SVG_CACHE = {}


def rooms_json(m):
    p = os.path.join(EXP, m, '%s-rooms.json' % m)
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else None


def frame_json(m):
    p = os.path.join(GEN, m, 'rooms', '%s-rooms-frame.json' % m)
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else None


def svg_building_rects(m, layer):
    """<rect> из группы buildings конкретного этажного SVG — второй источник для сверки."""
    key = (m, layer)
    if key in _SVG_CACHE:
        return _SVG_CACHE[key]
    p = os.path.join(GEN, m, 'rooms', '%s-rooms-%s.svg' % (m, layer))
    if not os.path.exists(p):
        _SVG_CACHE[key] = None
        return None
    s = open(p, encoding='utf-8').read()
    g = re.search(r'<g id="buildings".*?>(.*?)</g>', s, re.S)
    out = []
    if g:
        for r in re.finditer(
                r'<rect x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)"',
                g.group(1)):
            out.append(tuple(float(v) for v in r.groups()))
    _SVG_CACHE[key] = out
    return out


def buildings(m):
    """Уникальные здания карты: имя, путь, AABB в игровых метрах, площадь пятна."""
    d = rooms_json(m)
    if not d:
        return []
    out = []
    for b in d['buildings']:
        lo, hi = b['min'], b['max']
        w, dp, h = hi[0] - lo[0], hi[2] - lo[2], hi[1] - lo[1]
        out.append(dict(name=b['name'], path=b['path'], scene=b['scene'], meshes=b['meshes'],
                        lo=lo, hi=hi, w=w, d=dp, h=h, area=w * dp,
                        cx=(lo[0] + hi[0]) / 2, cy=(lo[1] + hi[1]) / 2, cz=(lo[2] + hi[2]) / 2))
    return out


def buildings_in_frame(m):
    """Здания, чей центр лежит внутри рамки карты. Фоновые силуэты города и импостеры
    (Tarkov_State_Building, *_BG, *_LODLAST) лежат снаружи и в топ по площади лезут
    первыми — на Береге ими оказались ВСЕ 30 первых, на Ground Zero 20 из 30."""
    fr = frame_json(m)
    B = buildings(m)
    if not fr:
        return B
    (x0, z0), (x1, z1) = fr['bounds']
    return [b for b in B if x0 <= b['cx'] <= x1 and z0 <= b['cz'] <= z1]


def floors_of(m, b, fr):
    """В скольких этажных слоях здание нарисовано. Слой засчитан, если в его SVG есть
    <rect> с тем же левым верхним углом (аффина слоя = аффина карты, проверено).
    ⚠️ Это НЕ этажность: render-rooms.py кладёт здание в слой по ЦЕНТРУ его AABB,
    поэтому >1 бывает только там, где полосы этажей перекрываются. Настоящая этажность
    считается в storeys_of()."""
    if not fr:
        return 0
    ax = fr['affine']['px_from_x']
    az = fr['affine']['py_from_z']
    px = ax[0] + ax[1] * (b['lo'][0] if ax[1] > 0 else b['hi'][0])
    py = az[0] + az[1] * (b['lo'][2] if az[1] > 0 else b['hi'][2])
    n = 0
    for L in fr['layers']:
        rects = svg_building_rects(m, L['layer'])
        if not rects:
            continue
        if any(abs(r[0] - px) < 1.5 and abs(r[1] - py) < 1.5 for r in rects):
            n += 1
    return n


def storeys_of(b, rooms, gap=2.2):
    """Этажность из КОМНАТ звуковой сцены: берём комнаты, чей центр лежит в пятне
    здания, и считаем, на сколько уровней по высоте они разбиваются (разрыв > gap м —
    новый уровень). Это независимый от полос манифеста признак многоэтажности."""
    ys = [r['center'][1] for r in rooms
          if b['lo'][0] <= r['center'][0] <= b['hi'][0]
          and b['lo'][2] <= r['center'][2] <= b['hi'][2]]
    if not ys:
        return 0, 0
    ys.sort()
    lv = 1
    for a, c in zip(ys, ys[1:]):
        if c - a > gap:
            lv += 1
    return len(ys), lv


FLOOR_RX = re.compile(r'(?:^|_)(f[1-9]|floor_?[1-9]|stage_[1-9]|basement|podval)(?:_|)', re.I)


def floors_from_names(b, rooms):
    """Этажность из ИМЁН комнат BSG: суффиксы _f1.._f9, stage_N, basement.
    Это источник уровня «файлы игры», в отличие от кластеризации по высоте,
    которая на плотной застройке (общаги Таможни) склеивает все этажи в один кластер."""
    lv = set()
    for r in rooms:
        c = r['center']
        if not (b['lo'][0] <= c[0] <= b['hi'][0] and b['lo'][2] <= c[2] <= b['hi'][2]):
            continue
        m = FLOOR_RX.search(r['name'] or '')
        if m:
            lv.add(m.group(1).lower().replace('floor', 'f').replace('_', '').replace('stage', 'f'))
    return len(lv), ','.join(sorted(lv))


def pct(vals, q):
    if not vals:
        return 0.0
    v = sorted(vals)
    k = (len(v) - 1) * q
    f = int(math.floor(k))
    c = min(f + 1, len(v) - 1)
    return v[f] + (v[c] - v[f]) * (k - f)


# ───────────────────────────────────────────── цена здания в треугольниках

def occluders(m):
    p = os.path.join(EXP, m, 'render-objects', '%s-occluders.json' % m)
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else None


def proto_spans(occ, cache_path=None):
    """Габарит каждого прототипа-резака из его npz. Нужен, чтобы отделить ОБОЛОЧКУ
    здания (крупные меши стен/крыш/каркаса) от НАЧИНКИ (мебель, трубы, лут, ящики):
    в occluders.json имён нет, а размер — надёжный разделитель. Кэшируется в json."""
    import numpy as np
    if cache_path and os.path.exists(cache_path):
        return json.load(open(cache_path, encoding='utf-8'))
    out = {}
    for k, p in occ['protos'].items():
        try:
            v = np.load(p['npz'])['v']
            lo = v.min(axis=0)
            hi = v.max(axis=0)
            out[k] = [float(hi[0] - lo[0]), float(hi[1] - lo[1]), float(hi[2] - lo[2])]
        except Exception:
            out[k] = [0.0, 0.0, 0.0]
    if cache_path:
        json.dump(out, open(cache_path, 'w', encoding='utf-8'))
    return out


def is_shell(span, scale, min_horiz=6.0, min_vert=4.0):
    """Структурный элемент: в мире шире 6 м по горизонтали или выше 4 м."""
    sx = span[0] * abs(scale[0])
    sy = span[1] * abs(scale[1])
    sz = span[2] * abs(scale[2])
    return max(sx, sz) >= min_horiz or sy >= min_vert


def cost_in_box(occ, lo, hi, pad=0.0):
    """Сумма треугольников экземпляров, чей ПИВОТ лежит в пятне здания.
    Пивот, а не полный AABB меша: точный тест потребовал бы прочитать тысячи npz —
    приближение честно помечено в отчёте."""
    protos = occ['protos']
    spans = occ.get('_spans')
    tris = n = shell_t = shell_n = 0
    x0, x1 = lo[0] - pad, hi[0] + pad
    z0, z1 = lo[2] - pad, hi[2] + pad
    y0, y1 = lo[1] - 3.0, hi[1] + 3.0
    for it in occ['instances']:
        if x0 <= it['x'] <= x1 and z0 <= it['z'] <= z1 and y0 <= it['y'] <= y1:
            p = protos.get(it['mesh'])
            if not p:
                continue
            tris += p['tris']
            n += 1
            if spans and is_shell(spans.get(it['mesh'], (0, 0, 0)), it['scale']):
                shell_t += p['tris']
                shell_n += 1
    return tris, n, shell_t, shell_n


# ───────────────────────────────────────────── цена ЭКСТРУЗИИ того же пятна

PATH_RX = re.compile(r'<path d="([^"]+)"')
NUM_RX = re.compile(r'(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)')


def _rdp(pts, eps):
    if len(pts) < 3:
        return pts
    x0, y0 = pts[0]
    x1, y1 = pts[-1]
    dx, dy = x1 - x0, y1 - y0
    nn = math.hypot(dx, dy)
    imax, dmax = 0, -1.0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        if nn == 0:
            d = math.hypot(px - x0, py - y0)
        else:
            d = abs(dy * px - dx * py + x1 * y0 - y1 * x0) / nn
        if d > dmax:
            imax, dmax = i, d
    if dmax > eps:
        return _rdp(pts[:imax + 1], eps)[:-1] + _rdp(pts[imax:], eps)
    return [pts[0], pts[-1]]


def contours(m, kind, layer, affine):
    """Контуры слоя в ИГРОВЫХ МЕТРАХ: [(вершины, площадь, cx, cz)]."""
    p = os.path.join(GEN, m, kind, '%s-%s-%s.svg' % (m, kind, layer))
    if not os.path.exists(p):
        return []
    ax, az = affine['px_from_x'], affine['py_from_z']
    out = []
    for d in PATH_RX.findall(open(p, encoding='utf-8').read()):
        pts = [((float(a) - ax[0]) / ax[1], (float(b) - az[0]) / az[1])
               for a, b in NUM_RX.findall(d)]
        if len(pts) < 3:
            continue
        s = 0.0
        for i in range(len(pts)):
            x1, y1 = pts[i]
            x2, y2 = pts[(i + 1) % len(pts)]
            s += x1 * y2 - x2 * y1
        xs = [q[0] for q in pts]
        ys = [q[1] for q in pts]
        out.append((pts, abs(s) / 2, (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2))
    return out


def extrusion_tris(cont, min_area=0.5, rdp=0.15):
    """3V−2 треугольника на контур после фильтра площади и упрощения — та же
    методика, что в deep-research-3d-clay-maps.md §0.1, чтобы числа были сравнимы."""
    n = v = 0
    for pts, a, _, _ in cont:
        if a < min_area:
            continue
        q = _rdp(pts, rdp)
        n += 1
        v += len(q)
    return n, v, 3 * v - 2 * n


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'inventory'
    args = [a for a in sys.argv[2:] if not a.startswith('--')]

    if cmd == 'inventory':
        ms = args or MAPS
        res = {}
        for m in ms:
            B = buildings(m)
            fr = frame_json(m)
            # ⚠️ ЛОВУШКА, пойманная на Береге и Ground Zero: в верх списка по площади
            # лезут ФОНОВЫЕ силуэты города (Tarkov_State_Building, *_BG, *_LODLAST,
            # *_imposter*) — они лежат ВНЕ рамки карты и в слоях walls/obstacles их нет
            # вовсе (у Берега такими оказались ВСЕ 30 первых). Фильтруем по рамке.
            bnds = fr['bounds'] if fr else None
            if bnds:
                (bx0, bz0), (bx1, bz1) = bnds
                for b in B:
                    b['inFrame'] = (bx0 <= b['cx'] <= bx1) and (bz0 <= b['cz'] <= bz1)
            else:
                for b in B:
                    b['inFrame'] = True
            outside = sum(1 for b in B if not b['inFrame'])
            B = [b for b in B if b['inFrame']]
            areas = [b['area'] for b in B]
            rj = rooms_json(m) or {'rooms': []}
            for b in B:
                b['floors'] = floors_of(m, b, fr)
                b['rooms'], b['storeys'] = storeys_of(b, rj['rooms'])
                b['nFloors'], b['floorTags'] = floors_from_names(b, rj['rooms'])
            B.sort(key=lambda b: -b['area'])
            res[m] = dict(
                total=len(B), outsideFrame=outside,
                svgLayers=dict((L['layer'], L['buildings']) for L in (fr['layers'] if fr else [])),
                svgSum=sum(L['buildings'] for L in (fr['layers'] if fr else [])),
                area=dict(sum=round(sum(areas), 1),
                          p50=round(pct(areas, .5), 1), p75=round(pct(areas, .75), 1),
                          p90=round(pct(areas, .9), 1), p99=round(pct(areas, .99), 1),
                          max=round(max(areas), 1) if areas else 0),
                over=dict((t, sum(1 for a in areas if a >= t))
                          for t in (100, 500, 1000, 2000, 5000)),
                multiFloor=sum(1 for b in B if b['floors'] >= 2),
                multiStorey=sum(1 for b in B if b['storeys'] >= 2),
                tall=sum(1 for b in B if b['h'] >= 8),
                top=[dict(name=b['name'], area=round(b['area'], 1),
                          w=round(b['w'], 1), d=round(b['d'], 1), h=round(b['h'], 1),
                          cx=round(b['cx'], 1), cz=round(b['cz'], 1),
                          meshes=b['meshes'], floors=b['floors'],
                          rooms=b['rooms'], storeys=b['storeys'],
                          nFloors=b['nFloors'], floorTags=b['floorTags'], scene=b['scene'])
                     for b in B[:30]])
        print(json.dumps(res, ensure_ascii=False, indent=1))

    elif cmd == 'cost':
        m = args[0]
        top = int(sys.argv[sys.argv.index('--top') + 1]) if '--top' in sys.argv else 30
        occ = occluders(m)
        if not occ:
            print('НЕТ occluders.json для %s' % m, file=sys.stderr)
            sys.exit(2)
        occ['_spans'] = proto_spans(
            occ, os.path.join(GEN, '..', '..', '..', '.tmp-3d', '%s-spans.json' % m)
            if os.path.isdir(os.path.join(GEN, '..', '..', '..', '.tmp-3d')) else None)
        B = sorted(buildings_in_frame(m), key=lambda b: -b['area'])[:top]
        out = []
        for b in B:
            t, n, st, sn = cost_in_box(occ, b['lo'], b['hi'])
            out.append(dict(name=b['name'], area=round(b['area'], 1), h=round(b['h'], 1),
                            cx=round(b['cx'], 1), cz=round(b['cz'], 1),
                            instances=n, tris=t, shellInstances=sn, shellTris=st))
        sp = occ['_spans']
        tot = dict(protos=len(occ['protos']),
                   instances=len(occ['instances']),
                   trisAll=sum(occ['protos'][i['mesh']]['tris'] for i in occ['instances']
                               if i['mesh'] in occ['protos']),
                   trisShell=sum(occ['protos'][i['mesh']]['tris'] for i in occ['instances']
                                 if i['mesh'] in occ['protos']
                                 and is_shell(sp.get(i['mesh'], (0, 0, 0)), i['scale'])))
        print(json.dumps(dict(map=m, scene=tot, buildings=out), ensure_ascii=False, indent=1))

    elif cmd == 'extrusion':
        m = args[0]
        top = int(sys.argv[sys.argv.index('--top') + 1]) if '--top' in sys.argv else 30
        fr = frame_json(m)
        aff = fr['affine']
        allc = []
        for kind in ('walls', 'obstacles'):
            for L in fr['layers']:
                allc += contours(m, kind, L['layer'], aff)
        gn, gv, gt = extrusion_tris(allc)
        B = sorted(buildings_in_frame(m), key=lambda b: -b['area'])[:top]
        out = []
        for b in B:
            inside = [c for c in allc
                      if b['lo'][0] <= c[2] <= b['hi'][0] and b['lo'][2] <= c[3] <= b['hi'][2]]
            n, v, t = extrusion_tris(inside)
            out.append(dict(name=b['name'], area=round(b['area'], 1),
                            contours=n, verts=v, tris=t))
        print(json.dumps(dict(map=m, whole=dict(contoursRaw=len(allc), contours=gn,
                                                verts=gv, tris=gt),
                              buildings=out), ensure_ascii=False, indent=1))

    elif cmd == 'affines':
        for m in (args or MAPS):
            fr = frame_json(m)
            if not fr:
                print('%-18s НЕТ frame.json' % m)
                continue
            ref = fr['affine']
            row = []
            for kind, fn in (('walls', 'walls'), ('obstacles', 'obstacles'),
                             ('stones', 'stones'), ('zone', 'zone'), ('roads', 'roads')):
                p = os.path.join(GEN, m, kind, '%s-%s.json' % (m, fn))
                if not os.path.exists(p):
                    row.append('%s:—' % kind)
                    continue
                d = json.load(open(p, encoding='utf-8'))
                a = (d.get('frame') or d).get('affine')
                row.append('%s:%s' % (kind, 'ok' if a == ref else 'РАСХОД %s' % a))
            print('%-18s %s' % (m, '  '.join(row)))
