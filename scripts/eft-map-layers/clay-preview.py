# -*- coding: utf-8 -*-
"""Превью ВИДА 3D clay-карты — статичный кадр, чтобы V4DYA увидел язык до стройки.

Зачем. Решение `docs/decisions/3D/3d-clay-map-rendering.md` набрало 33 пункта про то,
КАК будет выглядеть карта, но вида никто не видел. Полная веха 1 (three.js, роутинг,
гейтинг) — это дни; здесь один кадр из Blender, который отвечает на вопрос «как это
смотрится» за час и позволяет зарубить или подтвердить решения, пока они дёшевы.

Что делает. Берёт контуры этажа из наших SVG-слоёв (`gen/<карта>/walls|obstacles`),
фильтрует мелочь, упрощает Дугласом-Пекером, выдавливает призмы, красит по лестнице
NIGHTFALL, ставит орто-камеру под 45°, включает Freestyle-контур и рисует светящийся
маршрут цветом `--primary`. Итог — PNG.

Это НЕ прототип и не заготовка кода: рендер офлайновый, three.js тут ни при чём.
Единственная его задача — показать вид.

usage:
  python clay-preview.py [карта] [слой] [--out FILE] [--px 1600] [--no-route]
  python clay-preview.py customs floor0
"""
import importlib.util
import json
import re
import math
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
EXPORT = os.environ.get('EFT_EXPORT', r'D:\eft-export')


def _load(name, path):
    """Импорт модуля, у которого в имени файла дефис (обычный import не умеет)."""
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# Переиспользуем разбор контуров и Дугласа-Пекера из скрипта замера — методика
# должна совпадать один в один, иначе превью покажет не ту геометрию, что мерили.
INV = _load('inventory_buildings',
            os.path.join(HERE, 'inventory-buildings.py'))
BLENDER = os.environ.get(
    'BLENDER', r'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe')

for _s in (sys.stdout, sys.stderr):
    if hasattr(_s, 'reconfigure'):
        _s.reconfigure(encoding='utf-8', errors='replace')

t0 = time.time()


def log(m):
    print('[%6.1fs] %s' % (time.time() - t0, m), flush=True)


def opt(flag, default=None):
    return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else default


POLY_RX = None


def room_polygons(m, layer, aff):
    """Полигоны помещений из `rooms/*.svg` (группа `rooms`) в игровых метрах.

    Зачем отдельно от walls. Слой `walls` — это СЕЧЕНИЕ стен на высоте земля+1.2 м:
    24 225 мелких обрезков, из которых крупнее 20 м² всего 246. Экструзия таких
    обрезков даёт россыпь плашек, а не здания — на первом превью это и получилось.
    Полигоны комнат дают реальные очертания помещений, и выдавленные вверх они
    читаются как корпуса.
    """
    import re as _re
    path = os.path.join(INV.GEN, m, 'rooms', '%s-rooms-%s.svg' % (m, layer))
    if not os.path.exists(path):
        return []
    src = open(path, encoding='utf-8').read()
    grp = _re.search(r'<g id="rooms".*?>(.*?)</g>', src, _re.S)
    if not grp:
        return []
    ax, az = aff['px_from_x'], aff['py_from_z']
    out = []
    for pts_s in _re.findall(r'points="([^"]+)"', grp.group(1)):
        nums = _re.findall(r'(-?\d+(?:\.\d+)?)[ ,]+(-?\d+(?:\.\d+)?)', pts_s)
        if len(nums) < 3:
            continue
        pts = [((float(a) - ax[0]) / ax[1], (float(b) - az[0]) / az[1]) for a, b in nums]
        s2 = 0.0
        for i in range(len(pts)):
            x1, y1 = pts[i]
            x2, y2 = pts[(i + 1) % len(pts)]
            s2 += x1 * y2 - x2 * y1
        out.append((pts, abs(s2) / 2, 0, 0))
    return out


def building_masses(m, layer, aff):
    """Габаритные массы зданий из группы `buildings` (rect) слоя комнат.

    Зачем. Экструзия одних лишь помещений оставляет чёрные провалы там, где между
    комнатами коридоры, лестницы и дворы — на превью это читалось как «дыры в
    зданиях». Масса под комнатами закрывает промежутки и даёт зданию цельный
    корпус, а комнаты сверху дают ему рельеф.
    """
    rects = INV.svg_building_rects(m, layer) or []
    ax, az = aff['px_from_x'], aff['py_from_z']
    out = []
    for (x, y, w, h) in rects:
        x0 = (x - ax[0]) / ax[1]
        x1 = (x + w - ax[0]) / ax[1]
        z0 = (y - az[0]) / az[1]
        z1 = (y + h - az[0]) / az[1]
        pts = [(min(x0, x1), min(z0, z1)), (max(x0, x1), min(z0, z1)),
               (max(x0, x1), max(z0, z1)), (min(x0, x1), max(z0, z1))]
        out.append((pts, abs((x1 - x0) * (z1 - z0)), 0, 0))
    return out


def client_meshes(m, name_rx, pad=0.6, near=None, radius=60.0, ball=None):
    """Настоящая геометрия клиента для объектов, чьё имя подходит под маску.

    Зачем. Замечание V4DYA: «металлических лестниц не видно». Причина не в пороге
    шума — `walls` это СЕЧЕНИЕ на одной высоте, и маршевая лестница пересекает
    плоскость реза в одном месте, оставляя огрызок. Никакой порог её не вернёт.
    А в дампе окклюдеров она есть целиком: у `Hostel_02_hallway_ladder_01`
    (6.9×3.4×5.8 м) внутри габарита 190 мешей.

    Это ровно случай части C гибрида: массовая застройка идёт экструзией, а то,
    что экструзией не выражается, — реальной геометрией.
    """
    import numpy as np
    rx = re.compile(name_rx, re.I)
    rj = os.path.join(EXPORT, m, '%s-rooms.json' % m)
    oj = os.path.join(EXPORT, m, 'render-objects', '%s-occluders.json' % m)
    if not (os.path.exists(rj) and os.path.exists(oj)):
        return None
    # Явный шар вокруг точки — обход именованного отбора целиком.
    # Зачем: коробки комнат крошечные (extent 1-3 м), и крупная конструкция
    # в них не помещается. Чтобы отличить «в дампе нет» от «выборка не добрала»,
    # нужен способ взять ВСЁ в радиусе и посмотреть глазами.
    if ball is not None:
        bx, bz, br = ball
        boxes = [(bx - br, -1e9, bz - br, bx + br, 1e9, bz + br)]
        names = ['ball(%.0f,%.0f,r=%.0f)' % (bx, bz, br)]
        doc = None
    else:
        doc = json.load(open(rj, encoding='utf-8'))
        blds = [b for b in doc.get('buildings') or [] if rx.search(b['name'])]
        boxes = [(b['min'][0] - pad, b['min'][1] - pad, b['min'][2] - pad,
                  b['max'][0] + pad, b['max'][1] + pad, b['max'][2] + pad)
                 for b in blds]
        names = [b['name'] for b in blds]

    # 🔴 ПОЧЕМУ НЕ ТОЛЬКО ПОСТРОЙКИ. Маска по `buildings` — тупик: на Таможне
    # их 129 и они грубые, это наборы уровня Hostel_01_indoor_set и
    # Construction_factory. Под маску лестниц подходит РОВНО ОДНА постройка,
    # а все железные лестницы общаг спрятаны внутри наборов и по имени постройки
    # недостижимы. Имена самих мешей не спасают: в occl-meshes они обезличены
    # (occl_level14_101.npz, 6564 файла).
    # Настоящий handle — КОМНАТЫ: 398 на Таможне, имена от BSG подробные и несут
    # этаж прямо в себе (obsh_2_stairs_f1, lab_stairs_f2, basement_stairs).
    # По той же маске: 1 попадание по постройкам против 68 по комнатам,
    # 13 отдельных лестничных мест на карте вместо одного.
    # Комнаты с нулевым extent — точечные аудио-маркеры (28 из 68), у них нет
    # объёма: берём вокруг них куб в `point_pad` метров, иначе они дают пустоту.
        point_pad = 2.5
        for r in doc.get('rooms') or []:
            if not rx.search(r.get('name', '')):
                continue
            c, e = r.get('center'), r.get('extent')
            if not c:
                continue
            ex = [max(float(v), point_pad) if e else point_pad
                  for v in (e or [0, 0, 0])]
            boxes.append((c[0] - ex[0] - pad, c[1] - ex[1] - pad, c[2] - ex[2] - pad,
                          c[0] + ex[0] + pad, c[1] + ex[1] + pad, c[2] + ex[2] + pad))
            names.append(r['name'])
    # 🔴 ОГРАНИЧЕНИЕ ПО МЕСТУ. Переход с построек на комнаты поднял число
    # попаданий с 1 до 68 — и сбор мешей взорвался: маска ловит ВСЕ лестничные
    # места карты, а не то, что в кадре. Замер: job вырос 7.6 МБ → 96 МБ,
    # Blender съел 8 ГБ и не досчитал. Поэтому при заданном центре берём только
    # коробки в радиусе кадра. Без центра собираем всё, но честно предупреждаем.
    if near is not None and ball is None:
        nx, nz = near
        sel = [(b, n) for b, n in zip(boxes, names)
               if abs((b[0] + b[3]) / 2 - nx) <= radius
               and abs((b[2] + b[5]) / 2 - nz) <= radius]
        log('коробки мешей: %d из %d в радиусе %.0f м от (%.0f, %.0f)'
            % (len(sel), len(boxes), radius, nx, nz))
        boxes = [b for b, _ in sel]
        names = [n for _, n in sel]
    elif len(boxes) > 8:
        log('⚠ коробок мешей %d по всей карте, центр не задан — сбор будет тяжёлым'
            % len(boxes))
    if not boxes:
        return None
    occ = json.load(open(oj, encoding='utf-8'))
    protos, cache = occ['protos'], {}
    V, T, off, kept = [], [], 0, 0
    for it in occ['instances']:
        x, y, z = it['x'], it['y'], it['z']
        if not any(x0 <= x <= x1 and y0 <= y <= y1 and z0 <= z <= z1
                   for x0, y0, z0, x1, y1, z1 in boxes):
            continue
        mesh = it['mesh']
        if mesh not in cache:
            zz = np.load(protos[mesh]['npz'])
            cache[mesh] = (zz['v'].astype(np.float64), zz['t0'].astype(np.int64))
        v, t = cache[mesh]
        q = it['quat']
        n2 = sum(c * c for c in q) or 1.0
        sx, sy, sz_, w = q
        s2 = 2.0 / n2
        xx, yy, zz2 = sx * sx * s2, sy * sy * s2, sz_ * sz_ * s2
        xy, xz, yz = sx * sy * s2, sx * sz_ * s2, sy * sz_ * s2
        wx, wy, wz = w * sx * s2, w * sy * s2, w * sz_ * s2
        R = np.array([[1 - (yy + zz2), xy - wz, xz + wy],
                      [xy + wz, 1 - (xx + zz2), yz - wx],
                      [xz - wy, yz + wx, 1 - (xx + yy)]])
        sc = np.array(it.get('scale', [1, 1, 1]), dtype=np.float64)
        V.append((v * sc) @ R.T + np.array([x, y, z]))
        T.append(t + off)
        off += len(v)
        kept += 1
    if not V:
        return None
    V = np.vstack(V)
    T = np.vstack(T)
    return {'tag': 'clientmesh', 'floor': 'meshes', 'z0': 0.0, 'height': 0.0,
            'verts': V.tolist(), 'tris': T.tolist(),
            'names': names, 'instances': kept}


def _span(pts):
    """Максимальный габарит контура в метрах — длина по большей стороне bbox."""
    xs = [p[0] for p in pts]
    zs = [p[1] for p in pts]
    return max(max(xs) - min(xs), max(zs) - min(zs))


def items_or(x):
    return x or []


def load_buildings(m):
    """bbox построек из дампа комнат — ГОТОВАЯ разметка «постройка / предмет».

    Находка: `<карта>-rooms.json` содержит `buildings` с именами и габаритами
    (129 штук на Таможне: KPP, Market_Small_01, obshezhitie_1/2…). Значит слой
    `obstacles` — где вперемешку лежат постройки, бочки, машины и штабели —
    делится не эвристикой по форме, а точно: контур внутри bbox постройки это
    здание, снаружи — предмет.

    Проверка осмысленности: доля построек растёт с этажом (main 202/313,
    3rd 68/25, 4th 42/11) и падает в подвале (49/201) — предметы стоят на земле
    и в подвалах, наверху остаются только конструкции.
    """
    path = os.path.join(EXPORT, m, '%s-rooms.json' % m)
    if not os.path.exists(path):
        return []
    d = json.load(open(path, encoding='utf-8'))
    out = []
    for b in d.get('buildings') or []:
        mn, mx = b['min'], b['max']
        out.append((mn[0], mn[2], mx[0], mx[2]))
    return out


def building_boxes_3d(m):
    """bbox построек вместе с высотой — нужен, чтобы класть плиту пола только
    на те этажи, которые у здания реально есть. Иначе на одноэтажном сарае
    появляется пол четвёртого этажа."""
    path = os.path.join(EXPORT, m, '%s-rooms.json' % m)
    if not os.path.exists(path):
        return []
    d = json.load(open(path, encoding='utf-8'))
    out = []
    for b in d.get('buildings') or []:
        mn, mx = b['min'], b['max']
        out.append((mn[0], mn[1], mn[2], mx[0], mx[1], mx[2]))
    return out


def is_building(pts, boxes):
    cx = sum(p[0] for p in pts) / len(pts)
    cz = sum(p[1] for p in pts) / len(pts)
    return any(x0 <= cx <= x1 and z0 <= cz <= z1 for x0, z0, x1, z1 in boxes)


def inflate(poly, d):
    """Раздуть контур на d метров от его центроида.

    Зачем. Помещения выдавливаются отдельными призмами, и между соседними
    комнатами остаётся зазор в толщину стены. Сверху эти зазоры видны как чёрные
    щели до земли — на превью читались как «дыры в зданиях». Мы перебрали
    триангуляцию, нормали, ambient и Solidify — дело было не в них, а в том, что
    корпуса физически не сомкнуты. Раздутие на полтолщины стены смыкает их.

    Честная альтернатива — булев union полигонов, но он тянет геометрическую
    библиотеку ради превью, которое всё равно одноразовое.
    """
    n = len(poly)
    cx = sum(p[0] for p in poly) / n
    cy = sum(p[1] for p in poly) / n
    out = []
    for x, y in poly:
        dx, dy = x - cx, y - cy
        ln = math.hypot(dx, dy) or 1.0
        out.append((x + dx / ln * d, y + dy / ln * d))
    return out


def demo_route(groups):
    """Демонстрационный маршрут между двумя крупнейшими постройками.

    ⚠️ Это ЗАГЛУШКА ради картинки, а не фича. Настоящий маршрут строится по графу
    проёмов (решение №10) и идёт через этажи; здесь просто ломаная между центрами
    двух самых больших пятен, чтобы показать, как читается светящаяся линия
    поверх приглушённой застройки.
    """
    best = []
    for g in groups:
        if g['tag'] != 'building':
            continue
        for p in g['polys']:
            xs = [q[0] for q in p]
            zs = [q[1] for q in p]
            w, h = max(xs) - min(xs), max(zs) - min(zs)
            best.append((w * h, (min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2))
    if len(best) < 2:
        return []
    xs_all = sorted(b[1] for b in best)
    zs_all = sorted(b[2] for b in best)
    mx, mz = xs_all[len(xs_all) // 2], zs_all[len(zs_all) // 2]
    # только постройки рядом с медианным центром — иначе при зуме маршрут уходит
    # за кадр (первый прогон: пины оказались вне видимой области)
    near = [b for b in best if abs(b[1] - mx) < 160 and abs(b[2] - mz) < 160]
    near.sort(reverse=True)
    if len(near) < 2:
        near = sorted(best, reverse=True)
    (_, x0, z0), (_, x1, z1) = near[0], near[1]
    pts = []
    n = 14
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        z = z0 + (z1 - z0) * t
        # лёгкий изгиб поперёк, чтобы линия не выглядела линейкой
        nx, nz = -(z1 - z0), (x1 - x0)
        ln = math.hypot(nx, nz) or 1.0
        k = math.sin(t * math.pi) * 0.10 * math.hypot(x1 - x0, z1 - z0)
        pts.append([x + nx / ln * k, z + nz / ln * k])
    return pts


def main():
    # ГОЧА: наивный фильтр «всё, что не начинается с --» затягивал в позиционные
    # аргументы ЗНАЧЕНИЯ опций (из `--px 1400` прилетало «1400» как имя слоя).
    # Берём только то, что идёт до первой опции.
    args = []
    for a in sys.argv[1:]:
        if a.startswith('--'):
            break
        args.append(a)
    m = args[0] if args else 'customs'
    layer = args[1] if len(args) > 1 else 'floor0'
    px = int(opt('--px', '1600'))
    out = os.path.abspath(opt('--out', os.path.join(
        HERE, '..', '..', '.tmp-3d', 'preview', '%s-%s.png' % (m, layer))))
    os.makedirs(os.path.dirname(out), exist_ok=True)

    fr = INV.frame_json(m)
    if not fr:
        sys.exit('нет рамки: %s' % m)
    aff = fr['affine']
    log('аффина %s: px=%.1f%+.4f·x, py=%.1f%+.4f·z'
        % (m, aff['px_from_x'][0], aff['px_from_x'][1],
           aff['py_from_z'][0], aff['py_from_z'][1]))

    # Поэтажная сборка из `obstacles` (идея V4DYA).
    # Почему именно этот слой: `walls` — это СЕЧЕНИЕ стен на земля+1.2 м, оно даёт
    # 24 225 обрезков и в экструзии выглядит россыпью плашек. `obstacles` режется
    # ПОВЕРХНОСТЬЮ «земля+1 м» по рельефу и заливает силуэты — заливка выдавливается
    # в объём. И у него есть настоящая этажность: underground / main / 2nd / 3rd / 4th.
    #
    # Порог шума 2 м² выбран замером: отсекает 86 % контуров, сохраняя 89 % площади.
    # Шаг этажа: замеры дали 2.7–3.1 м по геометрии и по парам замков.
    # `--explode` растягивает промежутки между этажами, не трогая сами объёмы —
    # при взгляде сверху слои иначе накладываются и поэтажность не читается.
    STOREY = 3.2 * float(opt('--explode', '1.0'))
    FLOORS = [('underground', -1), ('main', 0), ('2nd', 1), ('3rd', 2), ('4th', 3)]
    want = opt('--floors')
    if want:
        keep_names = set(want.split(','))
        FLOORS = [f for f in FLOORS if f[0] in keep_names]

    (bx0, bz0), (bx1, bz1) = fr['bounds']

    def _inside(pts):
        return all(bx0 <= q[0] <= bx1 and bz0 <= q[1] <= bz1 for q in pts)

    min_area = float(opt('--min-area', '2.0'))
    wall_area = float(opt('--wall-area', '0.4'))
    wall_span = float(opt('--wall-span', '1.4'))
    boxes = load_buildings(m)
    log('разметка построек: %d bbox' % len(boxes))
    drop_props = '--no-props' in sys.argv
    focus_name = opt('--focus')
    groups = []
    for name, level in FLOORS:
        # ДВА РАЗНЫХ ИСТОЧНИКА, и это принципиально:
        #  · `walls` — сечение стен на этаже. В масштабе карты это россыпь
        #    обрезков, но в масштабе ЗДАНИЯ ровно оно даёт планировку этажа.
        #    Поэтажность там настоящая: у общаг main/2nd/3rd непустые, 4th пуст —
        #    то есть здание трёхэтажное, и слой это знает.
        #  · `obstacles` — залитые силуэты препятствий. Годится для отдельно
        #    стоящих предметов (бочки, машины, штабели), но ВНУТРИ зданий даёт
        #    крошки по 0.6 м², потому что там режутся тонкие перегородки.
        wc = INV.contours(m, 'walls', name, aff)
        # Фильтр «площадь ИЛИ габарит», а не только площадь.
        # Замечание V4DYA: металлические лестницы сбоку общаг пропадали. В сечении
        # лестница — это узкие полоски косоуров и ступеней: площадь у каждой меньше
        # 0.4 м², а длина 2–5 м. Порог по площади их выкашивал. Замер по общагам:
        # на 1-м этаже терялось 26 таких контуров, на 2-м — 41.
        walls_keep = [(INV._rdp(p, 0.15), a) for p, a, _, _ in wc
                      if _inside(p) and (a >= wall_area or _span(p) >= wall_span)]
        oc = INV.contours(m, 'obstacles', name, aff)
        keep = [(INV._rdp(p, 0.2), a) for p, a, _, _ in oc
                if a >= min_area and _inside(p)]
        builds = walls_keep
        props = [] if drop_props else [(p, a) for p, a in keep
                                       if not is_building(p, boxes)]
        if not builds and not props:
            log('%-12s пусто' % name)
            continue
        # Высота объёма не растягивается вместе с шагом: этаж остаётся этажом,
        # растёт только зазор между уровнями.
        wall_h = min(STOREY - 0.45, 2.75)
        for kind, items, h in (('build', items_or(builds), wall_h),
                               ('prop', items_or(props), 1.5)):
            if not items:
                continue
            groups.append({
                'tag': kind, 'floor': name, 'level': level,
                'z0': level * STOREY, 'height': h,
                'focus_on': focus_name,
                'polys': [[list(q) for q in p] for p, _ in items],
            })
        log('%-12s стены %5d→%4d (%.0f м²)   предметы %4d'
            % (name, len(wc), len(builds), sum(a for _, a in builds), len(props)))

    # ⬜ РЕЖИМ РЕНТГЕНА (заказ V4DYA): стены полупрозрачные, пол — непрозрачный.
    # Зачем: марши лестниц физически есть в сцене, но их закрывает собственная
    # застройка. Прозрачные стены показывают начинку, непрозрачный пол не даёт
    # зданию превратиться в стеклянный аквариум, где не читаются уровни.
    # Плита кладётся ПОД отметкой этажа и только тем зданиям, чья высота этот
    # этаж покрывает.
    if '--xray' in sys.argv:
        b3 = building_boxes_3d(m)
        for name, level in FLOORS:
            z0 = level * STOREY
            plates = []
            for x0, y0, zz0, x1, y1, zz1 in b3:
                if not (y0 - 1.0 <= z0 <= y1 + 0.5):
                    continue
                if x1 < bx0 or x0 > bx1 or zz1 < bz0 or zz0 > bz1:
                    continue
                plates.append([[x0, zz0], [x1, zz0], [x1, zz1], [x0, zz1]])
            if plates:
                groups.append({
                    'tag': 'plate', 'floor': name, 'level': level,
                    'z0': z0 - 0.18, 'height': 0.18, 'focus_on': focus_name,
                    'polys': plates,
                })
        log('рентген: плит пола %d'
            % sum(len(g['polys']) for g in groups if g['tag'] == 'plate'))

    mesh_rx = opt('--meshes')
    ball_opt = opt('--mesh-ball')
    ball = tuple(float(v) for v in ball_opt.split(',')) if ball_opt else None
    if ball:
        mesh_rx = mesh_rx or '.'
    if mesh_rx:
        ctr = opt('--center')
        near = tuple(float(v) for v in ctr.split(',')) if ctr else None
        g = client_meshes(m, mesh_rx, near=near, ball=ball,
                          radius=float(opt('--mesh-radius', '60')))
        if g:
            log('геометрия клиента по маске %r: объектов %d, экземпляров %d, '
                'треугольников %d'
                % (mesh_rx, len(g['names']), g['instances'], len(g['tris'])))
            groups.append(g)
        else:
            log('по маске %r геометрии не нашлось' % mesh_rx)

    if not groups:
        print('ОШИБКА: нечего рисовать — ни контуров, ни мешей (%s)' % m,
              file=sys.stderr)
        sys.exit(1)

    route = []
    if '--no-route' not in sys.argv:
        route = demo_route(groups)
        log('демо-маршрут: %d узлов' % len(route))

    job = {'out': out, 'px': px, 'groups': groups, 'route': route,
           'xray': '--xray' in sys.argv,
           'map': m, 'layer': layer, 'zoom': float(opt('--zoom', '1.0')),
           'az': float(opt('--az', '315')), 'el': float(opt('--el', '52')),
           'focus': opt('--focus'),
           'center': opt('--center')}
    jp = os.path.join(os.path.dirname(out), 'job-%s-%s.json' % (m, layer))
    json.dump(job, open(jp, 'w', encoding='utf-8'))
    log('job → %s (%.1f МБ)' % (jp, os.path.getsize(jp) / 1e6))

    script = os.path.join(HERE, 'clay-preview-blender.py')
    log('Blender: сборка сцены и рендер…')
    r = subprocess.run([BLENDER, '--background', '--factory-startup',
                        '--python', script, '--', jp],
                       capture_output=True, text=True,
                       encoding='utf-8', errors='replace')
    print((r.stdout or '')[-1800:])
    if r.returncode != 0:
        print((r.stderr or '')[-1500:], file=sys.stderr)
        sys.exit('Blender вернул %d' % r.returncode)
    log('готово: %s' % out)


if __name__ == '__main__':
    main()
