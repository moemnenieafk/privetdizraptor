"""Найти лестничные марши карты в дампе клиента и записать их в сайдкар.

ЗАЧЕМ. Лестница — главный случай части C гибрида: экструзия её физически не
выражает. `walls` — это СЕЧЕНИЕ на одной высоте, от марша в нём остаётся след
косоуров, и выдавливание превращает след в вертикальную стойку. Понижение порога
шума не помогает и не может помочь: замер по Таможне — контуров на этаже втрое
больше (4 929 → 15 091), маршей нет, зато вокруг здания вырастает частокол.
Значит марши берутся настоящей геометрией, и их надо уметь НАХОДИТЬ.

ПОЧЕМУ НЕ ПО ИМЕНАМ. Имён нет. Меши в `occl-meshes/` обезличены
(`occl_level14_101.npz`, 6 564 файла). Имена построек грубые: на Таможне 129
наборов уровня `Hostel_01_indoor_set`, под маску лестниц подходит РОВНО ОДИН.
Имена комнат подробнее (68 попаданий), но дают МЕСТО, а не геометрию: коробка
комнаты 1–3 м, марш в неё не влезает — набираются двери, окна и бумажки.

ЧЕМ ОТЛИЧАЕТСЯ МАРШ. Тремя признаками сразу, поодиночке каждый врёт:

  1. ФОРМА — вытянут, узок, высотой в этаж и больше.
  2. СТУПЕНИ — вершины ложатся на равномерные полки с шагом 8–35 см.
  3. НАКЛОН — высота монотонно растёт вдоль длинной горизонтальной оси.

Третий признак решающий. Замер по Таможне:

    наклон 0.96   марш общаги-1 (occl_sharedassets10_293)
    наклон 0.98   его второй прототип
    наклон 0.88   внутренний марш общаги-2
    наклон 0.05   россыпь плашек — проходит признаки 1 и 2
    наклон 0.03   ребристая мелочь (радиаторы, жалюзи)

Без наклона отбор по «ступеням» даёт сотни ложных: у радиатора рёбра стоят
ровно теми же полками. А `occl_sharedassets5_2193` (7.1×1.1×6.1 м, «17 ступеней»)
оказался россыпью отдельных плашек и прошёл бы фильтр по форме.

СВЯЗНОСТЬ НЕ РАБОТАЕТ — проверено и отброшено. У настоящего марша 44 несвязных
компоненты (каждая ступень отдельным куском), у россыпи 187. Нормировка на число
треугольников тоже не разделяет: 0.23 против 0.31.

usage: python find-stairs.py <карта> [--out <файл>] [--gap 2.0]
"""
import json
import os
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
EXPORT = os.environ.get('EFT_EXPORT', r'D:\eft-export')

# Форма марша. Границы широкие намеренно: отсев делает наклон, а форма только
# отбрасывает заведомо не-лестницы, чтобы не читать 6.5 тыс. файлов зря.
MIN_LEN, MAX_LEN = 1.5, 12.0     # длинная горизонтальная ось
# Нижняя граница ширины НУЛЕВАЯ намеренно. Часть маршей приходит плоскими:
# у внутренней лестницы общаги-2 (occl_sharedassets11_218) габарит по X ровно
# 0.0 м, и порог 0.5 м её молча выбрасывал. Отсев держит наклон, а не ширина.
MIN_WID, MAX_WID = 0.0, 4.0      # короткая горизонтальная ось
MIN_HGT, MAX_HGT = 1.2, 8.0      # высота
MIN_SHELVES = 5                  # равномерных полок-ступеней
MIN_RAMP = 0.60                  # корреляция «вдоль оси → вверх»


def log(m):
    print('[find-stairs] %s' % m, flush=True)


def opt(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


def shelves(y):
    """Сколько равномерных полок по высоте. Ступень — 8–35 см."""
    lv = np.round(y / 0.05) * 0.05
    vals, cnt = np.unique(lv, return_counts=True)
    sh = np.sort(vals[cnt >= 4])
    if len(sh) < 2:
        return 0
    d = np.diff(sh)
    d = d[(d > 0.08) & (d < 0.40)]
    return len(d)


def ramp(v):
    """Монотонность подъёма вдоль длинной горизонтальной оси, |корреляция|.

    Главный признак. У марша высота растёт вместе с продвижением вдоль оси,
    у россыпи и у ребристой мелочи связи нет.
    """
    sz = v.max(0) - v.min(0)
    ax = 0 if sz[0] >= sz[2] else 2
    x, y = v[:, ax], v[:, 1]
    if x.std() < 1e-6 or y.std() < 1e-6:
        return 0.0
    return abs(float(np.corrcoef(x, y)[0, 1]))


def quat_matrix(q):
    sx, sy, sz_, w = q
    n2 = sum(c * c for c in q) or 1.0
    s2 = 2.0 / n2
    xx, yy, zz = sx * sx * s2, sy * sy * s2, sz_ * sz_ * s2
    xy, xz, yz = sx * sy * s2, sx * sz_ * s2, sy * sz_ * s2
    wx, wy, wz = w * sx * s2, w * sy * s2, w * sz_ * s2
    return np.array([[1 - (yy + zz), xy - wz, xz + wy],
                     [xy + wz, 1 - (xx + zz), yz - wx],
                     [xz - wy, yz + wx, 1 - (xx + yy)]])


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    m = args[0] if args else 'customs'
    gap = float(opt('--gap', '2.0'))
    oj = os.path.join(EXPORT, m, 'render-objects', '%s-occluders.json' % m)
    rj = os.path.join(EXPORT, m, '%s-rooms.json' % m)
    if not os.path.exists(oj):
        sys.exit('нет дампа окклюдеров: %s' % oj)
    t0 = time.time()
    occ = json.load(open(oj, encoding='utf-8'))
    protos, inst = occ['protos'], occ['instances']
    log('прототипов %d, экземпляров %d' % (len(protos), len(inst)))

    # ── 1. какие прототипы вообще лестницы ────────────────────────────────────
    used = set(it['mesh'] for it in inst)
    stairs, seen, rejected = {}, 0, {'форма': 0, 'ступени': 0, 'наклон': 0}
    for k in used:
        p = protos.get(k)
        if not p:
            continue
        try:
            v = np.load(p['npz'])['v'].astype(np.float64)
        except Exception:
            continue
        seen += 1
        if seen % 1000 == 0:
            log('  прочитано %d / %d' % (seen, len(used)))
        sz = v.max(0) - v.min(0)
        L, W, H = max(sz[0], sz[2]), min(sz[0], sz[2]), sz[1]
        if not (MIN_LEN <= L <= MAX_LEN and MIN_WID <= W <= MAX_WID
                and MIN_HGT <= H <= MAX_HGT):
            rejected['форма'] += 1
            continue
        sh = shelves(v[:, 1])
        if sh < MIN_SHELVES:
            rejected['ступени'] += 1
            continue
        r = ramp(v)
        if r < MIN_RAMP:
            rejected['наклон'] += 1
            continue
        stairs[k] = dict(size=[round(float(x), 2) for x in (L, W, H)],
                         shelves=int(sh), ramp=round(r, 3),
                         tris=int(p['tris']),
                         aabb=[v.min(0).tolist(), v.max(0).tolist()])
    log('прототипов-маршей: %d (отсев — форма %d, ступени %d, наклон %d)'
        % (len(stairs), rejected['форма'], rejected['ступени'], rejected['наклон']))
    if not stairs:
        sys.exit('маршей не нашлось — проверь пороги')

    # ── 2. где они стоят и примыкают ли к застройке ───────────────────────────
    # Требование V4DYA: в набор идут лестницы, «которые так или иначе плотно
    # прилегают к зданию, стенам». Отдельно стоящие стремянки посреди поля нам
    # не нужны — но и молча их ронять нельзя, поэтому считаем и те и другие.
    #
    # ⚠️ ГОЧА: делить «внутри / снаружи периметра» по bbox постройки НЕЛЬЗЯ.
    # Габарит грубый: у двух общаг Таможни он накрывает и двор между ними, и
    # проверка «снаружи» дала НОЛЬ при живой наружной лестнице у торца.
    # Поэтому меряем ЗАЗОР до ближайшей постройки, а не попадание внутрь.
    blds = []
    if os.path.exists(rj):
        for b in json.load(open(rj, encoding='utf-8')).get('buildings') or []:
            blds.append((b['name'], b['min'], b['max']))
    log('построек для проверки примыкания: %d' % len(blds))

    out, attached = [], 0
    for it in inst:
        k = it['mesh']
        if k not in stairs:
            continue
        mn, mx = (np.array(x) for x in stairs[k]['aabb'])
        R = quat_matrix(it['quat'])
        sc = np.array(it.get('scale', [1, 1, 1]), dtype=np.float64)
        corners = np.array([[a, b, c] for a in (mn[0], mx[0])
                            for b in (mn[1], mx[1]) for c in (mn[2], mx[2])])
        W = (corners * sc) @ R.T + np.array([it['x'], it['y'], it['z']])
        lo, hi = W.min(0), W.max(0)
        best, best_name = 1e9, None
        for name, bmn, bmx in blds:
            dx = max(bmn[0] - hi[0], lo[0] - bmx[0], 0.0)
            dz = max(bmn[2] - hi[2], lo[2] - bmx[2], 0.0)
            dy = max(bmn[1] - hi[1], lo[1] - bmx[1], 0.0)
            d = max(dx, dz, dy)
            if d < best:
                best, best_name = d, name
        near = best <= gap
        attached += 1 if near else 0
        out.append(dict(mesh=k, x=it['x'], y=it['y'], z=it['z'],
                        quat=it['quat'], scale=it.get('scale', [1, 1, 1]),
                        attached=bool(near), building=best_name,
                        gap=round(float(best), 2)))
    log('экземпляров-маршей %d, из них примыкают к застройке (зазор ≤ %.1f м): %d'
        % (len(out), gap, attached))

    op = opt('--out', os.path.join(EXPORT, m, 'render-objects',
                                   '%s-stairs.json' % m))
    json.dump(dict(map=m, generated=time.strftime('%Y-%m-%dT%H:%M:%S'),
                   source='find-stairs.py — марши по форме+ступеням+наклону',
                   thresholds=dict(len=[MIN_LEN, MAX_LEN], wid=[MIN_WID, MAX_WID],
                                   hgt=[MIN_HGT, MAX_HGT],
                                   shelves=MIN_SHELVES, ramp=MIN_RAMP, gap=gap),
                   protos=stairs, instances=out),
              open(op, 'w', encoding='utf-8'), ensure_ascii=False)
    log('→ %s (%.1f МБ, %.0f с)'
        % (op, os.path.getsize(op) / 1e6, time.time() - t0))

    # короткая сводка, чтобы не открывать файл ради проверки
    for k, d in sorted(stairs.items(), key=lambda kv: -kv[1]['ramp'])[:12]:
        n = sum(1 for o in out if o['mesh'] == k)
        na = sum(1 for o in out if o['mesh'] == k and o['attached'])
        log('  %-28s %.1f×%.1f×%.1f м  ступ.%2d  наклон %.2f  экз.%3d (примык.%3d)'
            % (k, d['size'][0], d['size'][1], d['size'][2], d['shelves'],
               d['ramp'], n, na))


if __name__ == '__main__':
    main()
