"""Собрать геометрию клэй-карты для веба: контуры этажей + лестницы инстансингом.

ФОРМАТ ВЫБРАН ЗАМЕРОМ, не рассуждением (спека 3d-clay-web-milestone1.md):

    контуры  1 110 полигонов / 6 804 вершины → JSON 93 КБ → 23 КБ gzip
    лестницы запечь все экземпляры            → 691 КБ
    лестницы прототипы + матрицы (инстансинг) → 313 КБ  (×2.2 выигрыш)
    итого                                     → ~336 КБ при бюджете 1 МБ

Поэтому: контуры отдаём полигонами и выдавливаем В БРАУЗЕРЕ, лестницы —
прототипами с матрицами экземпляров. Единый glTF отпадает по требованию
V4DYA «этажи + клики»: запечённая сцена закрыла бы обе фичи.

ОСИ. Игра и three.js обе с Y вверх, поэтому перекладок НЕТ:
контур (gx, gz) → three (x = gx, y = высота, z = gz); вершина меша как есть.
В Blender-превью была перестановка (x, z, y) — здесь она была бы ошибкой.

ТРАНСФОРМ ЭКЗЕМПЛЯРА отдаём как позиция + кватернион + масштаб, а НЕ матрицей.
Матрица потребовала бы договориться о порядке хранения (three держит элементы
по столбцам), а это ровно тот класс ошибок, который потом ищут полдня в чёрном
кадре. Компоновку делает `Matrix4.compose` на стороне JS.

usage: python export-clay-web.py [карта] [--district dorms] [--out <dir>]
"""
import importlib.util
import json
import os
import struct
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
EXPORT = os.environ.get('EFT_EXPORT', r'D:\eft-export')


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


INV = _load('inv', os.path.join(HERE, 'inventory-buildings.py'))
CP = _load('clay_preview', os.path.join(HERE, 'clay-preview.py'))

# Районы — именованные окна в игровых метрах. Срез вехи 1 это «общаги».
DISTRICTS = {
    # `skip` — этажи, которых у района ФАКТИЧЕСКИ нет.
    #
    # У общаг Таможни нет подвала (замечание V4DYA), а слой `underground` даёт
    # там 284 контура. Проверка показала, что они лежат ВНУТРИ тех же построек
    # и распределены по ним почти как наземный этаж (94/78, 38/33, 26/22
    # контура по одним и тем же корпусам). Значит это не подвал, а тот же
    # корпус, срезанный ниже отметки. В объёме он давал ложный этаж под домом.
    #
    # Убираем данные, а НЕ переключатель: механизм этажей общий и нужен другим
    # районам, где подвалы настоящие (у Таможни это, например, Лаборатория).
    'dorms': dict(map='customs', box=(158.0, 118.0, 250.0, 196.0),
                  label='Общаги', skip=('underground',)),
}

STOREY = 3.2          # шаг этажа, замерен по геометрии и парам замков
WALL_H = 2.75         # высота объёма стен внутри этажа
PLATE_H = 0.18        # толщина плиты пола
PLATE_INFLATE = 0.25  # раздутие контура комнаты: смыкает зазоры в толщину стены
FLOORS = [('underground', -1), ('main', 0), ('2nd', 1), ('3rd', 2), ('4th', 3)]


def log(m):
    print('[export-clay-web] %s' % m, flush=True)


def opt(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


def merge_plates(polys, cell=0.15):
    """Слить полигоны комнат в НЕПЕРЕКРЫВАЮЩИЙСЯ силуэт пола.

    🔴 ЗАЧЕМ. Комнаты в разметке BSG — повёрнутые прямоугольники, и они густо
    налезают друг на друга: замер по наземному этажу общаг дал **4 514 пар**
    перекрывающихся плит из 256. Все они лежат в ОДНОЙ плоскости, поэтому в
    сцене начинается драка за глубину (z-fighting): пол покрывается рваными
    пятнами и полосами, и выглядит это как «плиты лежат неправильно».
    Раздутие контуров на полтолщины стены добавляет наложений ещё.

    Убрать перекрытия можно только объединением. Честный булев union потребовал
    бы shapely, которой в проекте нет, поэтому объединяем растром: заливаем все
    полигоны в битовую маску, затем собираем её обратно прямоугольниками
    (greedy meshing). На выходе покрытие то же, а пересечений НЕТ ни одного.

    Цена — ступенька `cell` на косых краях. При 0.15 м на масштабе района она
    не читается, а z-fighting читался сразу.
    """
    if not polys:
        return []
    from PIL import Image, ImageDraw
    xs = [q[0] for poly in polys for q in poly]
    zs = [q[1] for poly in polys for q in poly]
    x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs)
    W = int((x1 - x0) / cell) + 2
    H = int((z1 - z0) / cell) + 2
    img = Image.new('1', (W, H), 0)
    dr = ImageDraw.Draw(img)
    for poly in polys:
        dr.polygon([((q[0] - x0) / cell, (q[1] - z0) / cell) for q in poly], fill=1)
    return _greedy_rects(np.array(img, dtype=bool), x0, z0, cell)


def floor_from_walls(wall_polys, room_polys, cell=0.15, close_m=1.0):
    """Пол = область, ОГРАНИЧЕННАЯ СТЕНАМИ ЭТОГО ЖЕ ЭТАЖА.

    🔴 ЗАЧЕМ ИМЕННО ТАК. Раньше пол строился из контуров комнат, а стены — из
    слоя сечений. Два разных источника: края не совпадают, между полом и стеной
    остаётся щель, а вдоль здания идут две-три параллельные линии. Замечание
    V4DYA: «дублирование пола, зазоры, пол не по зданию».

    Если залить область внутри стен, край пола совпадает с линией стены ПО
    ПОСТРОЕНИЮ — согласовывать два источника больше не нужно.

    Как: стены в маску → морфологическое ЗАМЫКАНИЕ (проёмы дверей это разрывы
    в стене, через них заливка утекла бы наружу) → заливка от края кадра →
    всё, куда заливка не дошла, и есть внутреннее. Пол включает и сами стены,
    поэтому под стеной он не обрывается.

    ⚠️ ПРИЁМКА. Если периметр всё же дырявый, заливка утекает и пол выходит
    пустым — молча отдавать пустоту нельзя. Сверяем площадь с площадью комнат
    и при провале честно откатываемся на объединение комнат, сказав об этом.
    """
    from PIL import Image, ImageDraw, ImageFilter
    src = wall_polys + room_polys
    if not src:
        return [], 'нет данных'
    xs = [q[0] for poly in src for q in poly]
    zs = [q[1] for poly in src for q in poly]
    pad = 2.0
    x0, x1 = min(xs) - pad, max(xs) + pad
    z0, z1 = min(zs) - pad, max(zs) + pad
    W = int((x1 - x0) / cell) + 2
    H = int((z1 - z0) / cell) + 2

    def px(poly):
        return [((q[0] - x0) / cell, (q[1] - z0) / cell) for q in poly]

    walls = Image.new('L', (W, H), 0)
    dw = ImageDraw.Draw(walls)
    for poly in wall_polys:
        dw.polygon(px(poly), fill=255)
    # Замыкание: расширить и сжать обратно — закрывает дверные проёмы,
    # не раздувая сами стены.
    k = max(3, int(close_m / cell) | 1)
    closed = walls.filter(ImageFilter.MaxFilter(k)).filter(ImageFilter.MinFilter(k))

    fill = closed.copy()
    ImageDraw.floodfill(fill, (0, 0), 128)
    a = np.array(fill)
    inside = a != 128           # стены (255) + запертые пустоты (0)

    rooms_mask = Image.new('L', (W, H), 0)
    dr = ImageDraw.Draw(rooms_mask)
    for poly in room_polys:
        dr.polygon(px(poly), fill=255)
    rm = np.array(rooms_mask) > 0

    cell_area = cell * cell
    inside_area = int(inside.sum()) * cell_area
    rooms_area = int(rm.sum()) * cell_area
    if rooms_area > 0 and inside_area < rooms_area * 0.55:
        return [], ('заливка утекла: внутри %.0f м² против %.0f м² комнат'
                    % (inside_area, rooms_area))
    return _greedy_rects(inside, x0, z0, cell), ('по стенам, %.0f м²' % inside_area)


def _components(mask, min_cells=1):
    """Разметить связные области маски. Каждая — отдельный корпус.

    Своя разметка, а не заливка PIL: `ImageDraw.floodfill` на этой маске молча
    не заполняла ничего, и каждый пиксель становился «своей» пустой областью —
    249 компонент нулевой площади. Обход в ширину по строкам и предсказуем,
    и быстрее: сканлайн вместо попиксельной очереди.
    """
    H, W = mask.shape
    seen = np.zeros((H, W), dtype=bool)
    out = []
    ys, xs = np.nonzero(mask)
    for sy, sx in zip(ys.tolist(), xs.tolist()):
        if seen[sy, sx]:
            continue
        comp = np.zeros((H, W), dtype=bool)
        stack = [(sy, sx)]
        seen[sy, sx] = True
        while stack:
            y, x = stack.pop()
            # растягиваем горизонтальный отрезок целиком
            x0 = x
            while x0 > 0 and mask[y, x0 - 1] and not comp[y, x0 - 1]:
                x0 -= 1
            x1 = x
            while x1 + 1 < W and mask[y, x1 + 1] and not comp[y, x1 + 1]:
                x1 += 1
            comp[y, x0:x1 + 1] = True
            seen[y, x0:x1 + 1] = True
            for ny in (y - 1, y + 1):
                if ny < 0 or ny >= H:
                    continue
                row = mask[ny, x0:x1 + 1] & ~seen[ny, x0:x1 + 1]
                for off in np.nonzero(row)[0].tolist():
                    nx = x0 + off
                    if not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
        if comp.sum() >= min_cells:
            out.append(comp)
    return out


def _greedy_rects(mask, x0, z0, cell):
    """Собрать битовую маску обратно НЕПЕРЕКРЫВАЮЩИМИСЯ прямоугольниками."""
    H, W = mask.shape
    used = np.zeros_like(mask)
    out = []
    for y in range(H):
        x = 0
        while x < W:
            if not mask[y, x] or used[y, x]:
                x += 1
                continue
            x2 = x
            while x2 < W and mask[y, x2] and not used[y, x2]:
                x2 += 1
            y2 = y + 1
            while (y2 < H and mask[y2, x:x2].all() and not used[y2, x:x2].any()):
                y2 += 1
            used[y:y2, x:x2] = True
            out.append([
                (x0 + x * cell, z0 + y * cell),
                (x0 + x2 * cell, z0 + y * cell),
                (x0 + x2 * cell, z0 + y2 * cell),
                (x0 + x * cell, z0 + y2 * cell),
            ])
            x = x2
    return out


def quat_matrix(q):
    sx, sy, sz, w = q
    n2 = sum(c * c for c in q) or 1.0
    s2 = 2.0 / n2
    xx, yy, zz = sx * sx * s2, sy * sy * s2, sz * sz * s2
    xy, xz, yz = sx * sy * s2, sx * sz * s2, sy * sz * s2
    wx, wy, wz = w * sx * s2, w * sy * s2, w * sz * s2
    return np.array([[1 - (yy + zz), xy - wz, xz + wy],
                     [xy + wz, 1 - (xx + zz), yz - wx],
                     [xz - wy, yz + wx, 1 - (xx + yy)]])


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    m = args[0] if args else 'customs'
    dname = opt('--district', 'dorms')
    D = DISTRICTS.get(dname)
    if not D:
        sys.exit('нет такого района: %s (есть: %s)' % (dname, ', '.join(DISTRICTS)))
    X0, Z0, X1, Z1 = D['box']
    # ⚠️ НЕ в `public/maps/` — там лежат тайловые пирамиды, и весь этот путь
    # закрыт .gitignore (тайлы живут на R2, в репозиторий не лезут). Геометрия
    # клэй-карты другого рода: 400 КБ, версионируется вместе с кодом и должна
    # уехать в деплой обычным путём. Поэтому отдельный каталог.
    outdir = opt('--out', os.path.join(REPO, 'public', 'clay', m))
    os.makedirs(outdir, exist_ok=True)
    t0 = time.time()

    fr = INV.frame_json(m)
    if not fr:
        sys.exit('нет рамки: %s' % m)
    aff = fr['affine']

    def inbox(p):
        cx = sum(q[0] for q in p) / len(p)
        cz = sum(q[1] for q in p) / len(p)
        return X0 <= cx <= X1 and Z0 <= cz <= Z1

    # ── этажи: стены (сечение) + плита пола (контур комнат) ───────────────────
    floors, n_w, n_p = [], 0, 0
    skip = set(D.get('skip') or ())
    for name, level in FLOORS:
        if name in skip:
            log('%-12s ПРОПУЩЕН — у района этого этажа нет' % name)
            continue
        wc = INV.contours(m, 'walls', name, aff)
        # Фильтр «площадь ИЛИ габарит»: по одной площади терялись лестничные
        # конструкции — узкие полоски косоуров меньше 0.4 м², но длиной 2–5 м.
        walls = [INV._rdp(p, 0.15) for p, a, _, _ in wc
                 if inbox(p) and (a >= 0.4 or CP._span(p) >= 1.4)]
        # Плита строится по КОНТУРУ этажа, не по габариту постройки: габарит
        # накрывал бы всё, ради чего нужен рентген. Обёртки (полигон больше
        # самого здания) отсеиваются — они есть на каждой карте.
        rc = CP.drop_envelopes(CP.room_polygons(m, name, aff))
        raw_plates = [CP.inflate(INV._rdp(p, 0.2), PLATE_INFLATE)
                      for p, a, _, _ in rc if a >= 1.0 and inbox(p)]
        if not walls and not raw_plates:
            continue          # этажа у района просто нет — молча дальше
        plates, how = floor_from_walls(walls, raw_plates)
        if not plates:
            log('  ⚠ пол по стенам не вышел (%s) — беру объединение комнат' % how)
            plates, how = merge_plates(raw_plates), 'по комнатам (резерв)'
        if not walls and not plates:
            continue
        floors.append(dict(
            name=name, level=level, z0=round(level * STOREY, 3),
            wallH=WALL_H, plateH=PLATE_H,
            walls=[[round(c, 3) for q in p for c in q] for p in walls],
            plates=[[round(c, 3) for q in p for c in q] for p in plates],
        ))
        n_w += len(walls)
        n_p += len(plates)
        log('%-12s стены %4d  пол: %4d плит (%s)'
            % (name, len(walls), len(plates), how))

    # ── лестницы: прототипы в бинарь, экземпляры трансформами ─────────────────
    sp = os.path.join(EXPORT, m, 'render-objects', '%s-stairs-set.json' % m)
    stairs = None
    if os.path.exists(sp):
        sd = json.load(open(sp, encoding='utf-8'))
        occ = json.load(open(os.path.join(
            EXPORT, m, 'render-objects', '%s-occluders.json' % m), encoding='utf-8'))
        protos_src = occ['protos']
        items = [i for i in sd['instances']
                 if i['attached'] and X0 <= i['x'] <= X1 and Z0 <= i['z'] <= Z1]
        keys = sorted({i['mesh'] for i in items})
        pos_buf, idx_buf, meta, pv, pi = [], [], [], 0, 0
        for k in keys:
            z = np.load(protos_src[k]['npz'])
            v = z['v'].astype(np.float32)
            t = z['t0'].astype(np.uint32)
            meta.append(dict(key=k, posOffset=pv, posCount=int(len(v)),
                             idxOffset=pi, idxCount=int(t.size)))
            pos_buf.append(v.reshape(-1))
            idx_buf.append(t.reshape(-1))
            pv += len(v)
            pi += int(t.size)
        pos = np.concatenate(pos_buf).astype('<f4') if pos_buf else np.zeros(0, '<f4')
        idx = np.concatenate(idx_buf).astype('<u4') if idx_buf else np.zeros(0, '<u4')
        binname = 'district-%s-stairs.bin' % dname
        with open(os.path.join(outdir, binname), 'wb') as f:
            f.write(struct.pack('<II', len(pos) // 3, len(idx)))
            f.write(pos.tobytes())
            f.write(idx.tobytes())
        order = {k: n for n, k in enumerate(keys)}
        inst = [dict(p=order[i['mesh']],
                     t=[round(i['x'], 3), round(i['y'], 3), round(i['z'], 3)],
                     q=[round(c, 5) for c in i['quat']],
                     s=[round(c, 4) for c in (i.get('scale') or [1, 1, 1])],
                     src=i.get('src'), name=i.get('name'))
                for i in items]
        stairs = dict(bin=binname, protos=meta, instances=inst)
        log('лестницы: %d экз., %d прототипов, %d вершин, %d индексов → %s (%.0f КБ)'
            % (len(items), len(keys), len(pos) // 3, len(idx), binname,
               os.path.getsize(os.path.join(outdir, binname)) / 1024))
    else:
        log('⚠ нет набора лестниц (%s) — сперва find-stairs.py' % sp)

    doc = dict(map=m, district=dname, label=D['label'],
               generated=time.strftime('%Y-%m-%dT%H:%M:%S'),
               source='export-clay-web.py',
               bounds=[X0, Z0, X1, Z1], storey=STOREY,
               floors=floors, stairs=stairs)
    jp = os.path.join(outdir, 'district-%s.json' % dname)
    json.dump(doc, open(jp, 'w', encoding='utf-8'), ensure_ascii=False,
              separators=(',', ':'))
    kb = os.path.getsize(jp) / 1024
    log('контуры: стен %d, плит %d → %s (%.0f КБ)' % (n_w, n_p, jp, kb))
    log('готово за %.1f с' % (time.time() - t0))


if __name__ == '__main__':
    main()
