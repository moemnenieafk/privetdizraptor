# Карта материала поверхности из Unity-splatmap террейна (без нейросети).
# Вход: splat_<terrain>.bin (TerrainExporter.cs) + customs-terrain.bin (позиции) + manifest.
# Выход: PNG в палитре NIGHTFALL + карта индексов материалов (.npy) для трассировки.
#
# Запуск: python scripts/eft-terrain/build-material.py <splatdir> <terrainbin> <manifest> <outdir> <map> [width]

import struct, sys, json, zlib, os, glob
import numpy as np

splatdir, terrbin, man_path, outdir, map_id = sys.argv[1:6]
OUT_W = int(sys.argv[6]) if len(sys.argv) > 6 else 4096
os.makedirs(outdir, exist_ok=True)

# --- семейства палитры (default-тона) ---------------------------------------
FAM = {
    'soil':        '#415232',
    'dirt':        '#605248',
    'gravel-sand': '#928E73',
    'concrete':    '#777777',
    'water':       '#386E5B',
    'swamp':       '#333121',
    'rock':        '#565967',
}
ORDER = list(FAM)
RGB = np.array([[int(FAM[k][i:i + 2], 16) for i in (1, 3, 5)] for k in ORDER], np.uint8)

# слой террейна BSG → наше семейство
LAYER2FAM = {
    'Grass_summer_D': 'soil', 'Grassy_Ground_summer_D': 'soil',
    'Forest_Ground_summer_D': 'soil', 'Soil_Grass_summer_D': 'soil',
    'Ground_summer_D': 'dirt',
    'Gravel_Road_A_summer_D': 'gravel-sand', 'Gravel_Road_B_summer_D': 'gravel-sand',
    'Gravel_summer_D': 'gravel-sand', 'Sand_summer_D': 'gravel-sand',
    'Pebbles_Ground_summer_D': 'gravel-sand',
    'Stone_Ground_summer_D': 'rock', 'Rock_Ground_summer_D': 'rock',
}

# --- позиции террейнов из customs-terrain.bin -------------------------------
pos_by_name = {}
data = open(terrbin, 'rb').read(); off = 0
while off < len(data):
    (nl,) = struct.unpack_from('<i', data, off); off += 4
    name = data[off:off + nl].decode('utf-8'); off += nl
    px, py, pz, sx, sy, sz = struct.unpack_from('<6f', data, off); off += 24
    (res,) = struct.unpack_from('<i', data, off); off += 4
    off += res * res * 4
    pos_by_name[name] = (px, pz, sx, sz)

# --- читаем splat -------------------------------------------------------------
def read_splat(path):
    d = open(path, 'rb').read(); o = 0
    aw, ah, al = struct.unpack_from('<3i', d, o); o += 12
    names = []
    for _ in range(al):
        (n,) = struct.unpack_from('<i', d, o); o += 4
        names.append(d[o:o + n].decode('utf-8')); o += n
    a = np.frombuffer(d, dtype='<f4', count=aw * ah * al, offset=o).reshape(ah, aw, al)
    return names, a

# --- целевая сетка -------------------------------------------------------------
man = json.load(open(man_path, encoding='utf-8'))
(ax, az), (bx, bz) = man['boundsFromConfig']
XMIN, XMAX = min(ax, bx), max(ax, bx)
ZMIN, ZMAX = min(az, bz), max(az, bz)
W = OUT_W
H = int(round(W * (ZMAX - ZMIN) / (XMAX - XMIN)))
IDX = np.full((H, W), -1, np.int16)
gx = np.linspace(XMIN, XMAX, W); gz = np.linspace(ZMIN, ZMAX, H)
GX, GZ = np.meshgrid(gx, gz)
print(f'карта: {W}x{H} px, {(XMAX - XMIN) / W:.3f} м/px')

for f in sorted(glob.glob(f'{splatdir}/splat_*.bin')):
    tname = os.path.basename(f)[6:-4]
    if tname not in pos_by_name:
        print(f'  {tname}: нет позиции, пропуск'); continue
    px, pz, sx, sz = pos_by_name[tname]
    names, a = read_splat(f)
    ah, aw, al = a.shape
    # веса слоёв → индекс нашего семейства
    fam_idx = np.array([ORDER.index(LAYER2FAM.get(n, 'dirt')) for n in names], np.int16)
    unknown = [n for n in names if n not in LAYER2FAM]
    if unknown:
        print(f'  ⚠ неизвестные слои → dirt: {unknown}')
    # суммируем веса по семействам, берём максимум
    acc = np.zeros((ah, aw, len(ORDER)), np.float32)
    for l in range(al):
        acc[:, :, fam_idx[l]] += a[:, :, l]
    dom = acc.argmax(2).astype(np.int16)

    u = (GX - px) / sx * (aw - 1)
    v = (GZ - pz) / sz * (ah - 1)
    m = (u >= 0) & (u <= aw - 1) & (v >= 0) & (v <= ah - 1)
    if not m.any():
        continue
    ui = np.clip(np.round(u).astype(int), 0, aw - 1)
    vi = np.clip(np.round(v).astype(int), 0, ah - 1)
    IDX[m] = dom[vi[m], ui[m]]
    share = {ORDER[i]: round(100 * float((dom == i).mean()), 1) for i in range(len(ORDER)) if (dom == i).any()}
    print(f'  {tname}: покрыл {100 * m.mean():.1f}% кадра | доли {share}')

fill = IDX >= 0
print(f'\nпокрытие: {100 * fill.mean():.1f}%')
tot = {ORDER[i]: round(100 * float((IDX == i).mean()), 1) for i in range(len(ORDER)) if (IDX == i).any()}
print(f'материалы по карте: {tot}')

if man.get('coordinateRotation', 0) == 180:
    IDX = IDX[::-1, ::-1]
    print('разворот 180°')

np.save(f'{outdir}/{map_id}-material-index.npy', IDX)

img = np.zeros((H, W, 3), np.uint8)
for i in range(len(ORDER)):
    img[IDX == i] = RGB[i]

def png24(path, arr):
    hh, ww, _ = arr.shape
    raw = b''.join(b'\x00' + arr[i].tobytes() for i in range(hh))
    def ch(t, d):
        c = t + d
        return struct.pack('>I', len(d)) + c + struct.pack('>I', zlib.crc32(c))
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n'
                           + ch(b'IHDR', struct.pack('>IIBBBBB', ww, hh, 8, 2, 0, 0, 0))
                           + ch(b'IDAT', zlib.compress(raw, 6)) + ch(b'IEND', b''))

png24(f'{outdir}/{map_id}-material.png', img)
print(f'записано: {map_id}-material.png ({W}x{H}), {map_id}-material-index.npy')
