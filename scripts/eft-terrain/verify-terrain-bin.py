# Сверка двух дампов террейна: эталон Unity (TerrainExporter.cs) против нашего dump-terrain.py.
# Ожидаемые значения берутся ТОЛЬКО из эталонного .bin — не из кода дампера.
#
# Вход:  два <map>-terrain.bin; splat_<terrain>.bin ищутся рядом с каждым из них.
# Выход: построчный отчёт + максимальные расхождения; код возврата 1, если пороги превышены.
#
# Запуск: python scripts/eft-terrain/verify-terrain-bin.py <эталон.bin> <наш.bin>

import sys, os, struct
import numpy as np

# консоль Windows по умолчанию cp1251 — не роняем прогон на непечатаемом символе
try:
    sys.stdout.reconfigure(errors='replace')
except Exception:
    pass

ref_path, our_path = sys.argv[1:3]

EPS_POS = 0.01      # позиции и size — метры
EPS_H = 1e-5        # нормализованные высоты
EPS_W = 1e-5        # веса splat


def read_terrain(path):
    d = open(path, 'rb').read(); off = 0
    out = {}
    order = []
    while off < len(d):
        (nl,) = struct.unpack_from('<i', d, off); off += 4
        name = d[off:off + nl].decode('utf-8'); off += nl
        px, py, pz, sx, sy, sz = struct.unpack_from('<6f', d, off); off += 24
        (res,) = struct.unpack_from('<i', d, off); off += 4
        h = np.frombuffer(d, '<f4', res * res, off).reshape(res, res); off += res * res * 4
        out[name] = dict(pos=(px, py, pz), size=(sx, sy, sz), res=res, h=h)
        order.append(name)
    return out, order


def read_splat(path):
    d = open(path, 'rb').read()
    aw, ah, al = struct.unpack_from('<3i', d, 0); o = 12
    names = []
    for _ in range(al):
        (n,) = struct.unpack_from('<i', d, o); o += 4
        names.append(d[o:o + n].decode('utf-8')); o += n
    a = np.frombuffer(d, '<f4', aw * ah * al, o).reshape(ah, aw, al)
    return aw, ah, al, names, a


ref, ref_order = read_terrain(ref_path)
our, our_order = read_terrain(our_path)
fails = []

print(f'эталон: {ref_path}\nнаш:    {our_path}')
print(f'террейнов: эталон {len(ref)} / наш {len(our)}')
if set(ref) != set(our):
    fails.append(f'разный состав террейнов: эталон {sorted(ref)}, наш {sorted(our)}')
    print(f'  ! состав не совпал: только в эталоне {sorted(set(ref) - set(our))}, '
          f'только в нашем {sorted(set(our) - set(ref))}')

for name in ref_order:
    if name not in our:
        continue
    a, b = ref[name], our[name]
    print(f'\n{name}:')
    if a['res'] != b['res']:
        fails.append(f'{name}: res {a["res"]} != {b["res"]}')
        print(f'  ! res {a["res"]} != {b["res"]}')
        continue
    print(f'  res={a["res"]} (совпал)')
    dpos = max(abs(x - y) for x, y in zip(a['pos'], b['pos']))
    dsz = max(abs(x - y) for x, y in zip(a['size'], b['size']))
    print(f'  позиция: эталон ({a["pos"][0]:.3f},{a["pos"][1]:.3f},{a["pos"][2]:.3f}) '
          f'наш ({b["pos"][0]:.3f},{b["pos"][1]:.3f},{b["pos"][2]:.3f}) — max d {dpos:.6f} м')
    print(f'  size:    эталон {tuple(round(v, 3) for v in a["size"])} '
          f'наш {tuple(round(v, 3) for v in b["size"])} — max d {dsz:.6f} м')
    if dpos > EPS_POS:
        fails.append(f'{name}: позиция d {dpos:.4f} > {EPS_POS}')
    if dsz > EPS_POS:
        fails.append(f'{name}: size d {dsz:.4f} > {EPS_POS}')
    dh = float(np.abs(a['h'].astype(np.float64) - b['h'].astype(np.float64)).max())
    print(f'  высоты:  max |d| = {dh:.3e} (порог {EPS_H:g})')
    if dh > EPS_H:
        fails.append(f'{name}: высоты d {dh:.3e} > {EPS_H:g}')

    sp_a = os.path.join(os.path.dirname(os.path.abspath(ref_path)), f'splat_{name}.bin')
    sp_b = os.path.join(os.path.dirname(os.path.abspath(our_path)), f'splat_{name}.bin')
    # splat — половина шва (aw/ah/al, порядок и имена слоёв, веса). Нечем сверить — это провал,
    # а не пропуск: иначе прогон закончится «сошлось» с непроверенным главным утверждением.
    a_has, b_has = os.path.exists(sp_a), os.path.exists(sp_b)
    if not a_has and not b_has:
        fails.append(f'{name}: splat-файлов нет ни у эталона, ни у нас — слои и веса не сверены')
        print(f'  ! splat: нет ни {sp_a}, ни {sp_b} — сверять слои и веса нечем')
        continue
    if not a_has or not b_has:
        who = 'только у эталона' if a_has else 'только у нас'
        fails.append(f'{name}: splat есть {who} — пара для сверки не собралась')
        print(f'  ! splat есть {who}: {sp_a if a_has else sp_b}')
        continue
    aw1, ah1, al1, n1, w1 = read_splat(sp_a)
    aw2, ah2, al2, n2, w2 = read_splat(sp_b)
    print(f'  splat:   эталон {aw1}x{ah1}x{al1} / наш {aw2}x{ah2}x{al2}')
    if (aw1, ah1, al1) != (aw2, ah2, al2):
        fails.append(f'{name}: размеры splat {aw1}x{ah1}x{al1} != {aw2}x{ah2}x{al2}')
        continue
    if n1 != n2:
        fails.append(f'{name}: имена/порядок слоёв разошлись')
        print(f'  ! слои эталона: {n1}')
        print(f'  ! слои наши:    {n2}')
    else:
        print(f'  слои ({al1}): {", ".join(n1)} — порядок и имена совпали')
    dw = float(np.abs(w1.astype(np.float64) - w2.astype(np.float64)).max())
    print(f'  веса:    max |d| = {dw:.3e} (порог {EPS_W:g})')
    if dw > EPS_W:
        fails.append(f'{name}: веса d {dw:.3e} > {EPS_W:g}')

print('\n' + '=' * 60)
if fails:
    print('СВЕРКА НЕ СОШЛАСЬ:')
    for f in fails:
        print(f'  - {f}')
    sys.exit(1)
print('СВЕРКА СОШЛАСЬ: имена, res, позиции, size, высоты, слои и веса в пределах порогов')
