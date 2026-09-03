# Проверка привязки ground-подложки к рамке карты — числом, а не глазами.
#
# Отвечает на один вопрос: та ли ОРИЕНТАЦИЯ у артефакта, что у арта карты. Перебирает всю
# осевую группу — «как есть», зеркало X, зеркало Z, поворот 180°. Поворотов на 90° в переборе
# нет намеренно: рамка карты неквадратная, они исключены формой.
#
# Три правила, без которых проверка доказывала бы меньше, чем кажется:
#   1. Сетка остаточных сдвигов применяется к КАЖДОЙ гипотезе, а не только к победителю —
#      иначе гипотеза, выигрывающая после сдвига в 6 м, шанса не получает.
#   2. Вердикт снимается на ВСЁМ допустимом диапазоне масштабов сравнения (EVAL_GRID), а не
#      в одной точке — иначе «выбранный масштаб» неотличим от «масштаба, где нужный ответ
#      выигрывает». Победитель обязан быть один и тот же во всех точках. Границу диапазона
#      задаёт сама карта: шаг её сетки высот читается из <map>-terrain.bin, а не зашит числом.
#      У карты с грубой сеткой (слайс 1000 м при res 513 — это 1.95 м/px) фиксированные
#      768 и 1024 px оказались бы мельче исходных данных и внесли бы в «единогласие»
#      два замера из шума — ровно тот режим, который это правило объявляет недопустимым.
#   3. Порог маски и сетка сдвигов — константы, объявленные ДО перебора и общие для всех
#      четырёх гипотез: подобрать победителя порогом нельзя.
#
# Вход:  <grounddir>   каталог артефактов map-exports/.../gen/<map>/ground
#        <terrainbin>  <map>-terrain.bin — из него берётся шаг сетки высот sizeX/(res-1)
#        <manifest>    manifest.json карты (нужен boundsFromConfig)
#        <map>         id карты
#        <эталон>      арт карты в той же рамке: .png (растр z6) или .svg (наш вектор)
#        <режим>       landsea | gradient
#        [картинка]    необязательный: куда положить наложение рельефа на арт
# Выход: таблица по каждой гипотезе на каждом масштабе + итоговый вердикт.
#        exit 1, если победитель не «как есть» или меняется по масштабам.
#
# Запуск:
#   python scripts/eft-terrain/verify-alignment.py \
#     map-exports/OBJECTS-MAPS/gen/lighthouse/ground \
#     D:/eft-export/lighthouse/lighthouse-terrain.bin D:/Games/raster/lighthouse/manifest.json \
#     lighthouse map-exports/lighthouse.svg landsea
#   python scripts/eft-terrain/verify-alignment.py \
#     map-exports/OBJECTS-MAPS/gen/customs/ground \
#     D:/eft-export/customs-terrain.bin D:/Games/raster/customs/manifest.json \
#     customs D:/Games/raster/customs/customs-main-z6.png gradient
#
# .svg растеризуется через sharp из node_modules проекта (новых зависимостей не ставится).

import sys, os, json, struct, subprocess, tempfile
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

# --- константы проверки: заданы ДО перебора и общие для всех четырёх гипотез ---
# Масштабы сравнения строятся из ФАКТИЧЕСКОГО шага сетки высот карты (см. ниже): мельче шага
# сравнивать нечему — у отмывки там микрорельеф, которого нет в арте, у арта — кроны и текстура,
# которых нет в рельефе, и корреляция вырождается в шум для ЛЮБОЙ гипотезы. Здесь — только доли
# этого предела, они от карты не зависят.
SCALE_DIVISORS = (4, 3, 2, 1)   # предел / 4, / 3, / 2 и сам предел
SCALE_ROUND = 32                # ширины округляются ВНИЗ до кратного: вверх — перешли бы предел
LAND_LEVEL_M = 0.0              # выше этой мировой высоты — суша; нет данных террейна — море
SEA_RGB = ((74, 107, 150),      # .water вектора Shebuka
           (26, 38, 50))        # глубокая вода
COLOR_TOL = 24                  # допуск подбора цвета вектора (сумма |dR|+|dG|+|dB|)
SHIFT_MAX_M = 30                # сетка остаточных сдвигов: ±30 м …
SHIFT_STEP_M = 6                # … с шагом 6 м, по обеим осям, для КАЖДОЙ гипотезы

grounddir, terrbin, man_path, map_id, ref_path, mode = sys.argv[1:7]
overlay_out = sys.argv[7] if len(sys.argv) > 7 else None
if mode not in ('landsea', 'gradient'):
    sys.exit('режим: landsea | gradient')

man = json.load(open(man_path, encoding='utf-8'))
(ax, az), (bx, bz) = man['boundsFromConfig']
XMIN, XMAX = min(ax, bx), max(ax, bx)
ZMIN, ZMAX = min(az, bz), max(az, bz)
ASPECT = (ZMAX - ZMIN) / (XMAX - XMIN)

HM_PATH = f'{grounddir}/{map_id}-height-meters.npy'
HS_PATH = f'{grounddir}/{map_id}-hillshade.png'


def terrain_step_m(path):
    """Шаг сетки высот карты, м/ячейку = sizeX/(res-1) из <map>-terrain.bin.
    Слайсы могут различаться разрешением — берём САМЫЙ ГРУБЫЙ: данные в целом надёжны только
    на нём, он и ограничивает осмысленную мелкость сравнения."""
    d = open(path, 'rb').read()
    off, steps = 0, []
    while off < len(d):
        (nl,) = struct.unpack_from('<i', d, off); off += 4
        off += nl
        sx = struct.unpack_from('<6f', d, off)[3]; off += 24
        (res,) = struct.unpack_from('<i', d, off); off += 4
        off += res * res * 4
        steps.append(sx / (res - 1))
    if not steps:
        sys.exit(f'в {path} нет ни одного террейна — шаг сетки не из чего вывести')
    return max(steps), len(steps)


STEP_M, N_SLICES = terrain_step_m(terrbin)
SPAN_M = XMAX - XMIN
# Предел: пиксель сравнения не мельче ячейки исходных данных. Округление ВНИЗ — вверх ушли бы за.
EW_LIMIT = (int(SPAN_M / STEP_M) // SCALE_ROUND) * SCALE_ROUND
if EW_LIMIT < SCALE_ROUND * 2:
    sys.exit(f'сетка карты слишком груба ({STEP_M:.2f} м): предел сравнения {EW_LIMIT} px')
EVAL_GRID = tuple(sorted({max(SCALE_ROUND, (EW_LIMIT // k // SCALE_ROUND) * SCALE_ROUND)
                          for k in SCALE_DIVISORS}))
PRIMARY_W = EVAL_GRID[-2] if len(EVAL_GRID) > 1 else EVAL_GRID[0]


def render_ref(path, w, h):
    """Эталон → RGBA-массив w×h. .svg растеризуется sharp'ом из node_modules проекта."""
    if path.lower().endswith('.svg'):
        tmp = os.path.join(tempfile.gettempdir(), f'{map_id}-ref-{w}x{h}.png')
        js = ("const sharp=require('sharp'),fs=require('fs');"
              f"sharp(fs.readFileSync({json.dumps(path)}),{{density:96}})"
              f".resize({w},{h},{{fit:'fill'}}).png().toFile({json.dumps(tmp)})"
              ".then(()=>0).catch(e=>{console.error(e.message);process.exit(1)});")
        subprocess.run(['node', '-e', js], check=True, cwd=os.getcwd())
        path = tmp
    return np.array(Image.open(path).convert('RGBA').resize((w, h), Image.BILINEAR))


def variants(a):
    """«как есть» — то, что реально лежит на диске; остальные три — его осевые варианты."""
    return {'как есть': a, 'зеркало X': a[:, ::-1], 'зеркало Z': a[::-1, :],
            'поворот 180°': a[::-1, ::-1]}


def evaluate(EW):
    """Сравнение на одном масштабе → {гипотеза: (балл без сдвига, лучший балл, dx м, dz м)}."""
    EH = int(round(EW * ASPECT))
    m_per_px = (XMAX - XMIN) / EW
    shifts = sorted({int(round(m / m_per_px))
                     for m in range(-SHIFT_MAX_M, SHIFT_MAX_M + 1, SHIFT_STEP_M)})
    REF = render_ref(ref_path, EW, EH)

    def to_eval(arr):
        h, w = arr.shape
        ri = (np.arange(EH) * (h - 1) / (EH - 1)).round().astype(int)
        ci = (np.arange(EW) * (w - 1) / (EW - 1)).round().astype(int)
        return arr[np.ix_(ri, ci)]

    def shifted(a, dx, dz, fill):
        out = np.full_like(a, fill)
        y0, y1 = max(0, dz), min(EH, EH + dz)
        x0, x1 = max(0, dx), min(EW, EW + dx)
        if y0 < y1 and x0 < x1:
            out[y0:y1, x0:x1] = a[y0 - dz:y1 - dz, x0 - dx:x1 - dx]
        return out

    res, extra = {}, {}
    if mode == 'landsea':
        rgb = REF[:, :, :3].astype(np.int16)
        opaque = REF[:, :, 3] > 128
        sea_v = np.zeros((EH, EW), bool)
        for c in SEA_RGB:
            sea_v |= np.abs(rgb - np.array(c)).sum(2) < COLOR_TOL
        land_v = opaque & ~sea_v
        n_dom = float(opaque.sum())
        HM = to_eval(np.load(HM_PATH))
        # Балл считается на домене «весь кадр карты»: он не зависит от гипотезы и потому
        # честен для сравнения. Домен «где есть данные» у каждой гипотезы свой — он идёт
        # в таблицу справкой, но победителя по нему не выбирают.
        for name, arr in variants(HM).items():
            land_h = np.isfinite(arr) & (arr > LAND_LEVEL_M)

            def sc(m):
                return float(((m == land_v) & opaque).sum()) / n_dom

            a0 = sc(land_h)
            best = max(((sc(shifted(land_h, dx, dz, False)), dx, dz)
                        for dz in shifts for dx in shifts), key=lambda t: t[0])
            res[name] = (a0, best[0], best[1] * m_per_px, best[2] * m_per_px)
            d2 = opaque & np.isfinite(arr)
            iou0 = (float((land_h & land_v & opaque).sum())
                    / max(float(((land_h | land_v) & opaque).sum()), 1.0))
            extra[name] = (iou0,
                           float(((land_h == land_v) & d2).sum()) / max(float(d2.sum()), 1.0),
                           float((land_h & land_v & d2).sum())
                           / max(float(((land_h | land_v) & d2).sum()), 1.0))
        extra['_шапка'] = (f'эталон: суша {100 * land_v.mean():.1f}%, '
                           f'море {100 * (opaque & sea_v).mean():.1f}%, '
                           f'вне рамки {100 * (~opaque).mean():.1f}%')
    else:
        def grad(a):
            gy, gx = np.gradient(a)
            return np.hypot(gx, gy)

        gr = grad(REF[:, :, :3].astype(np.float32).mean(2))
        gr = gr - gr.mean()
        gr_n = float(np.sqrt((gr * gr).sum()))
        hs = to_eval(np.array(Image.open(HS_PATH)).astype(np.float32))

        def corr(a):
            a = a - a.mean()
            d = float(np.sqrt((a * a).sum())) * gr_n
            return float((a * gr).sum() / d) if d else 0.0

        for name, arr in variants(hs).items():
            G = grad(arr)
            c0 = corr(G)
            best = max(((corr(shifted(G, dx, dz, 0.0)), dx, dz)
                        for dz in shifts for dx in shifts), key=lambda t: t[0])
            res[name] = (c0, best[0], best[1] * m_per_px, best[2] * m_per_px)
        extra['_шапка'] = ''
    return res, extra, EH, m_per_px


print(f'карта {map_id}: X[{XMIN:.0f},{XMAX:.0f}] Z[{ZMIN:.0f},{ZMAX:.0f}] | режим {mode}')
print(f'шаг сетки высот карты {STEP_M:.3f} м ({N_SLICES} слайсов, взят самый грубый) → '
      f'предел сравнения {EW_LIMIT} px на {SPAN_M:.0f} м')
print(f'константы: порог суши {LAND_LEVEL_M} м, сдвиги ±{SHIFT_MAX_M} м шагом {SHIFT_STEP_M} м '
      f'(применяются к КАЖДОЙ гипотезе), масштабы {", ".join(str(w) for w in EVAL_GRID)} px '
      f'(подробно на {PRIMARY_W})')

winners, table = {}, {}
for EW in EVAL_GRID:
    res, extra, EH, mpp = evaluate(EW)
    table[EW] = res
    winners[EW] = max(res.items(), key=lambda kv: kv[1][1])[0]
    if EW == PRIMARY_W:
        print(f'\n--- подробно на {EW}x{EH} px ({mpp:.2f} м/px) ---')
        if extra.get('_шапка'):
            print(extra['_шапка'])
        if mode == 'landsea':
            print('гипотеза       | весь кадр карты (по нему и выбор)       | где есть данные')
            print('               | без сдвига   лучший (dx,dz)     IoU     | согласие    IoU')
            for n, (a0, ab, dx, dz) in res.items():
                iou0, a2, i2 = extra[n]
                print(f'{n:14s} | {100 * a0:8.1f}% {100 * ab:8.1f}% ({dx:+.0f},{dz:+.0f})'
                      f' {100 * iou0:7.1f}% | {100 * a2:7.1f}% {100 * i2:7.1f}%')
        else:
            print('гипотеза       | корреляция градиентов: без сдвига  лучшая (dx,dz)')
            for n, (c0, cb, dx, dz) in res.items():
                print(f'{n:14s} | {c0:+18.3f} {cb:+13.3f} ({dx:+.0f},{dz:+.0f})')

print('\n--- устойчивость вердикта по масштабам (балл = лучший на сетке сдвигов) ---')
hyps = list(table[EVAL_GRID[0]])
print('EVAL_W | ' + ' '.join(f'{h:>14s}' for h in hyps) + ' | победитель')
for EW in EVAL_GRID:
    row = ' '.join(f'{table[EW][h][1]:>14.3f}' for h in hyps)
    print(f'{EW:6d} | {row} | {winners[EW]}')

if overlay_out:
    # Глазами: грани рельефа (|градиент| отмывки) красным поверх арта карты. Совпали дороги,
    # площадки зданий и берег — привязка верна; двоятся — нет.
    OW = 2400
    OH = int(round(OW * ASPECT))
    art = render_ref(ref_path, OW, OH)[:, :, :3].astype(np.float32)
    sh = np.array(Image.open(HS_PATH).resize((OW, OH), Image.BILINEAR)).astype(np.float32)
    sh = (sh - sh.min()) / max(sh.max() - sh.min(), 1)
    gy, gx = np.gradient(sh)
    e = np.clip(np.hypot(gx, gy) * 8, 0, 1)[..., None]
    img = art * (1 - e * 0.85) + np.array([255, 60, 40], np.float32) * e * 0.85
    Image.fromarray(img.astype(np.uint8)).save(overlay_out)
    print(f'картинка: {overlay_out} ({OW}x{OH})')

uniq = set(winners.values())
if len(uniq) > 1:
    print(f'\nОТКАЗ: вердикт неустойчив — победитель меняется по масштабам: {winners}')
    sys.exit(1)
win = uniq.pop()
d = table[PRIMARY_W][win]
print(f'\nпобедитель одинаков на всех {len(EVAL_GRID)} масштабах: {win}')
print(f'остаточный сдвиг победителя на {PRIMARY_W} px: dx {d[2]:+.0f} м, dz {d[3]:+.0f} м '
      f'(балл {d[1]:.3f}, без сдвига {d[0]:.3f})')
if win != 'как есть':
    print(f'\nОТКАЗ: артефакт на диске лежит хуже, чем его вариант «{win}» — '
          f'ориентация в пайплайне неверна')
    sys.exit(1)
print('\nОК: артефакт на диске лежит лучше всех своих осевых вариантов на всех масштабах')
