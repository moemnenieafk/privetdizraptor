# Растительность карты EFT из Unity TerrainData: деревья/кусты поштучно + плотность травы.
# Читает sharedassetsN.assets напрямую (UnityPy) — Unity и AssetRipper не нужны.
#
# Запуск: python scripts/eft-terrain/extract-vegetation.py <sharedassets> <terrainbin> <manifest> <outdir> <map>
#
# Выход:
#   <map>-vegetation.json  — экземпляры: мировые X/Z, пиксели растра, вид, поворот, масштаб
#   <map>-vegetation.csv   — то же плоско (для Figma/скриптов)
#   <map>-veg-density.png  — растровая плотность (для скаттера/подложки)

import sys, os, json, struct, math, zlib
import numpy as np
import UnityPy

shared, terrbin, man_path, outdir, map_id = sys.argv[1:6]
os.makedirs(outdir, exist_ok=True)

# --- позиции террейнов (из TerrainExporter .bin) -----------------------------
pos_by_name = {}
data = open(terrbin, 'rb').read(); off = 0
while off < len(data):
    (nl,) = struct.unpack_from('<i', data, off); off += 4
    name = data[off:off + nl].decode('utf-8'); off += nl
    px, py, pz, sx, sy, sz = struct.unpack_from('<6f', data, off); off += 24
    (res,) = struct.unpack_from('<i', data, off); off += 4
    off += res * res * 4
    pos_by_name[name] = dict(pos=(px, py, pz), size=(sx, sy, sz))

# --- границы карты -----------------------------------------------------------
man = json.load(open(man_path, encoding='utf-8'))
(ax, az), (bx, bz) = man['boundsFromConfig']
XMIN, XMAX = min(ax, bx), max(ax, bx)
ZMIN, ZMAX = min(az, bz), max(az, bz)
ROT = man.get('coordinateRotation', 0)
RW, RH = man['crop']['width'], man['crop']['height']

env = UnityPy.load(shared)
objs = {o.path_id: o for o in env.objects}

def proto_name(path_id):
    """pathID префаба → человеческое имя (GameObject/Mesh в том же файле)."""
    o = objs.get(path_id)
    if o is None:
        return f'proto_{path_id}'
    try:
        t = o.read_typetree()
        n = t.get('m_Name')
        if n:
            return n
    except Exception:
        pass
    return f'{o.type.name}_{path_id}'

def group_of(name):
    """Группа для скаттера. Имена — реальные из клиента EFT (pine01, filbert_big01, brush_dry01…)."""
    n = name.lower()
    if any(k in n for k in ('grass', 'weed', 'trava')):
        return 'grass'
    if any(k in n for k in ('bush', 'brush', 'kust', 'shrub', 'plant_', 'wolf', 'fern', 'nettle')):
        return 'bush'
    if any(k in n for k in ('pine', 'spruce', 'fir', 'el_', 'sosna', 'elka')):
        return 'conifer'
    if any(k in n for k in ('birch', 'oak', 'aspen', 'maple', 'filbert', 'tree', 'derevo')):
        return 'broadleaf'
    return 'other'


instances = []
summary = {}
for o in env.objects:
    if o.type.name != 'TerrainData':
        continue
    d = o.read_typetree()
    tname = d.get('m_Name')
    if tname not in pos_by_name:
        print(f'  {tname}: нет позиции в .bin, пропуск'); continue
    P = pos_by_name[tname]; (px, py, pz) = P['pos']; (sx, sy, sz) = P['size']
    dd = d.get('m_DetailDatabase', {})
    protos = dd.get('m_TreePrototypes') or []
    names = [proto_name(p.get('prefab', {}).get('m_PathID')) for p in protos]
    trees = dd.get('m_TreeInstances') or []
    print(f'{tname}: деревьев {len(trees)}, видов {len(protos)}')
    for t in trees:
        p = t['position']
        wx = px + p['x'] * sx
        wz = pz + p['z'] * sz
        wy = py + p['y'] * sy
        idx = t.get('index', 0)
        nm = names[idx] if idx < len(names) else f'proto_{idx}'
        instances.append(dict(
            slice=tname, kind=nm, group=group_of(nm),
            x=round(wx, 2), z=round(wz, 2), y=round(wy, 2),
            rot=round(math.degrees(t.get('rotation', 0.0)) % 360, 1),
            scaleW=round(t.get('widthScale', 1.0), 3),
            scaleH=round(t.get('heightScale', 1.0), 3),
        ))
        summary[nm] = summary.get(nm, 0) + 1

print(f'\nвсего экземпляров: {len(instances)}')
inzone = [i for i in instances if XMIN <= i['x'] <= XMAX and ZMIN <= i['z'] <= ZMAX]
print(f'внутри границ карты: {len(inzone)}')

# --- пиксели растра ----------------------------------------------------------
for i in inzone:
    u = (i['x'] - XMIN) / (XMAX - XMIN)
    v = (i['z'] - ZMIN) / (ZMAX - ZMIN)
    if ROT == 180:
        u, v = 1 - u, 1 - v
    i['px'] = round(u * RW)
    i['py'] = round(v * RH)

groups = {}
for i in inzone:
    groups[i['group']] = groups.get(i['group'], 0) + 1
print(f'по группам: {groups}')
print('топ видов:', sorted(summary.items(), key=lambda x: -x[1])[:10])

json.dump(dict(map=map_id, bounds=[XMIN, XMAX, ZMIN, ZMAX], raster=[RW, RH],
               groups=groups, kinds=summary, instances=inzone),
          open(f'{outdir}/{map_id}-vegetation.json', 'w', encoding='utf-8'), ensure_ascii=False)

with open(f'{outdir}/{map_id}-vegetation.csv', 'w', encoding='utf-8') as f:
    f.write('kind,group,x,z,y,rot,scaleW,scaleH,px,py\n')
    for i in inzone:
        f.write(f"{i['kind']},{i['group']},{i['x']},{i['z']},{i['y']},{i['rot']},"
                f"{i['scaleW']},{i['scaleH']},{i['px']},{i['py']}\n")

# --- растр плотности ---------------------------------------------------------
W = 2048
H = int(round(W * (ZMAX - ZMIN) / (XMAX - XMIN)))
dens = np.zeros((H, W), np.float32)
for i in inzone:
    u = (i['x'] - XMIN) / (XMAX - XMIN); v = (i['z'] - ZMIN) / (ZMAX - ZMIN)
    if ROT == 180:
        u, v = 1 - u, 1 - v
    xx = min(W - 1, max(0, int(u * (W - 1)))); yy = min(H - 1, max(0, int(v * (H - 1))))
    dens[yy, xx] += 1.0

# мягкое размытие (box 15px, разделимое)
def blur(a, r):
    k = 2 * r + 1
    c = np.cumsum(np.pad(a, ((0, 0), (r + 1, r)), 'constant'), axis=1)
    a = (c[:, k:] - c[:, :-k]) / k
    c = np.cumsum(np.pad(a, ((r + 1, r), (0, 0)), 'constant'), axis=0)
    return (c[k:, :] - c[:-k, :]) / k

d2 = blur(dens, 7)
d2 = d2 / (d2.max() or 1)
img = (np.clip(d2 * 2.2, 0, 1) * 255).astype(np.uint8)

def png8(path, arr):
    hh, ww = arr.shape
    raw = b''.join(b'\x00' + arr[i].tobytes() for i in range(hh))
    def ch(t, dt):
        c = t + dt
        return struct.pack('>I', len(dt)) + c + struct.pack('>I', zlib.crc32(c))
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n'
                           + ch(b'IHDR', struct.pack('>IIBBBBB', ww, hh, 8, 0, 0, 0, 0))
                           + ch(b'IDAT', zlib.compress(raw, 6)) + ch(b'IEND', b''))

png8(f'{outdir}/{map_id}-veg-density.png', img)
print(f'записано: {map_id}-vegetation.json / .csv, {map_id}-veg-density.png ({W}x{H})')
