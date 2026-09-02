# Сшивка Unity-террейнов EFT в карту высот, привязанную к растру карты портала.
# Вход: customs-terrain.bin (TerrainExporter.cs) + manifest.json карты.
# Выход: 16-битный PNG высот, hillshade, и .npy с метрами.
#
# Запуск: python scripts/eft-terrain/build-heightmap.py <bin> <manifest> <outdir> <map> [width]

import struct, sys, json, zlib, numpy as np, os

bin_path, man_path, outdir, map_id = sys.argv[1:5]
OUT_W = int(sys.argv[5]) if len(sys.argv) > 5 else 4096
os.makedirs(outdir, exist_ok=True)

# --- читаем террейны ---------------------------------------------------------
terrains = []
with open(bin_path, 'rb') as f:
    data = f.read()
off = 0
while off < len(data):
    (nl,) = struct.unpack_from('<i', data, off); off += 4
    name = data[off:off + nl].decode('utf-8'); off += nl
    px, py, pz, sx, sy, sz = struct.unpack_from('<6f', data, off); off += 24
    (res,) = struct.unpack_from('<i', data, off); off += 4
    h = np.frombuffer(data, dtype='<f4', count=res * res, offset=off).reshape(res, res); off += res * res * 4
    terrains.append(dict(name=name, pos=(px, py, pz), size=(sx, sy, sz), res=res, h=h))
    print(f'{name:16s} res={res} pos=({px:.1f},{py:.1f},{pz:.1f}) size=({sx:.0f},{sy:.0f},{sz:.0f}) '
          f'высоты=[{py + h.min() * sy:.1f},{py + h.max() * sy:.1f}] м шаг={sx / (res - 1):.2f} м')

# дубли (AITerrain_* повторяют Slice_*) — берём по уникальной позиции
seen, uniq = set(), []
for t in terrains:
    key = (round(t['pos'][0], 1), round(t['pos'][2], 1))
    if key in seen:
        print(f"  пропуск дубля: {t['name']}"); continue
    seen.add(key); uniq.append(t)

# --- целевая сетка по границам карты ------------------------------------------
man = json.load(open(man_path, encoding='utf-8'))
(ax, az), (bx, bz) = man['boundsFromConfig']
XMIN, XMAX = min(ax, bx), max(ax, bx)
ZMIN, ZMAX = min(az, bz), max(az, bz)
W = OUT_W
H = int(round(W * (ZMAX - ZMIN) / (XMAX - XMIN)))
print(f'\nкарта: X[{XMIN:.0f},{XMAX:.0f}] Z[{ZMIN:.0f},{ZMAX:.0f}]  {W}x{H} px '
      f'({(XMAX - XMIN) / W:.3f} м/px)')

gx = np.linspace(XMIN, XMAX, W, dtype=np.float64)
gz = np.linspace(ZMIN, ZMAX, H, dtype=np.float64)
GX, GZ = np.meshgrid(gx, gz)
OUT = np.full((H, W), np.nan, np.float32)

for t in uniq:
    px, py, pz = t['pos']; sx, sy, sz = t['size']; res = t['res']; h = t['h']
    u = (GX - px) / sx * (res - 1)     # колонка (X)
    v = (GZ - pz) / sz * (res - 1)     # строка (Z)
    m = (u >= 0) & (u <= res - 1) & (v >= 0) & (v <= res - 1)
    if not m.any():
        continue
    u0 = np.clip(np.floor(u).astype(int), 0, res - 2); v0 = np.clip(np.floor(v).astype(int), 0, res - 2)
    fu = (u - u0); fv = (v - v0)
    a = h[v0, u0]; b = h[v0, u0 + 1]; c = h[v0 + 1, u0]; d = h[v0 + 1, u0 + 1]
    bil = a * (1 - fu) * (1 - fv) + b * fu * (1 - fv) + c * (1 - fu) * fv + d * fu * fv
    world = py + bil * sy                                   # метры
    OUT[m] = world[m]
    print(f"  {t['name']}: покрыл {100 * m.mean():.1f}% кадра")

fill = np.isfinite(OUT)
print(f'\nпокрытие карты: {100 * fill.mean():.1f}%')
if not fill.any():
    sys.exit('нет данных')
print(f'высоты: {OUT[fill].min():.1f} .. {OUT[fill].max():.1f} м (перепад {OUT[fill].max() - OUT[fill].min():.1f} м)')

# ориентация растра карты: coordinateRotation=180 → разворот обеих осей
rot = man.get('coordinateRotation', 0)
if rot == 180:
    OUT = OUT[::-1, ::-1]
    print('применён разворот 180° (coordinateRotation)')

np.save(f'{outdir}/{map_id}-height-meters.npy', OUT)

# --- PNG 16 бит + hillshade ---------------------------------------------------
def png16(path, arr):
    hh, ww = arr.shape
    raw = b''.join(b'\x00' + arr[i].astype('>u2').tobytes() for i in range(hh))
    def ch(t, d):
        c = t + d
        return struct.pack('>I', len(d)) + c + struct.pack('>I', zlib.crc32(c))
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n'
                           + ch(b'IHDR', struct.pack('>IIBBBBB', ww, hh, 16, 0, 0, 0, 0))
                           + ch(b'IDAT', zlib.compress(raw, 6)) + ch(b'IEND', b''))

flat = np.nan_to_num(OUT, nan=float(np.nanmin(OUT)))
lo, hi = float(np.nanmin(OUT)), float(np.nanmax(OUT))
png16(f'{outdir}/{map_id}-height-16bit.png', np.clip((flat - lo) / (hi - lo), 0, 1) * 65535)

step_m = (XMAX - XMIN) / W
gy, gxg = np.gradient(flat, step_m)
slope = np.arctan(np.hypot(gxg, gy))
aspect = np.arctan2(-gxg, gy)
az_r, alt_r = np.deg2rad(315), np.deg2rad(45)
hs = np.clip(np.sin(alt_r) * np.cos(slope) + np.cos(alt_r) * np.sin(slope) * np.cos(az_r - aspect), 0, 1)
png16(f'{outdir}/{map_id}-hillshade.png', hs * 65535)
print(f'записано: {map_id}-height-16bit.png, {map_id}-hillshade.png, {map_id}-height-meters.npy '
      f'(мин {lo:.1f} м, макс {hi:.1f} м)')
