# Растительность карты EFT из Unity TerrainData: деревья/кусты поштучно + плотность травы.
# Читает sharedassetsN.assets напрямую (UnityPy) — Unity и AssetRipper не нужны.
#
# Запуск: python scripts/eft-terrain/extract-vegetation.py <sharedassets> <terrainbin> <manifest> <outdir> <map> [allow-unresolved]
#
# <sharedassets> — один файл ассетов ИЛИ несколько через запятую. Несколько нужны там, где
# в .bin попали соседние слайсы общей мировой сетки EFT: их TerrainData (а значит и деревья)
# лежат в ЧУЖИХ sharedassets — у Маяка это 140 и 25 (dump-terrain.py … with-neighbours).
# Позиции всё равно берутся из .bin, так что порядок файлов ни на что не влияет; TerrainData,
# которых нет в .bin, пропускаются как раньше. Один путь без запятой = прежнее поведение.
#
# Выход:
#   <map>-vegetation.json  — экземпляры: мировые X/Z, пиксели растра, вид, поворот, масштаб
#   <map>-vegetation.csv   — то же плоско (для Figma/скриптов)
#   <map>-veg-density.png  — растровая плотность (для скаттера/подложки)
#
# ОТКАЗ (как в dump-terrain.py): если хоть один вид не резолвится в имя, файлы НЕ пишутся и
# exit != 0 — полуфабрикат с заглушками proto_* до потребителей не доезжает. Шестой аргумент
# `allow-unresolved` снимает отказ осознанно: файлы пишутся, заглушки остаются, их счётчик
# уходит в JSON полем `unresolved`.

import sys, os, json, struct, math, zlib
import numpy as np
import UnityPy

shared_arg, terrbin, man_path, outdir, map_id = sys.argv[1:6]
shared_paths = [p for p in shared_arg.split(',') if p.strip()]
if not shared_paths:
    sys.exit('ОТКАЗ: не задан ни один файл ассетов')
shared = shared_paths[0]
ALLOW_UNRESOLVED = len(sys.argv) > 6 and sys.argv[6] == 'allow-unresolved'
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

shared_dir = os.path.dirname(os.path.abspath(shared))
shared_base = os.path.basename(shared)
_files = {}     # basename файла ассетов -> (индекс объектов по pathID, список externals)


def load_assets(path):
    """Файл ассетов → (объекты по pathID, имена внешних файлов). Кэш: файлы тяжёлые."""
    base = os.path.basename(path)
    if base not in _files:
        e = UnityPy.load(path)
        f = next(iter(e.files.values()))
        _files[base] = ({o.path_id: o for o in e.objects},
                        [os.path.basename(x.path) for x in f.externals])
    return _files[base]


envs = []       # (basename файла, объекты) — в порядке, как их подали
for p in shared_paths:
    base = os.path.basename(p)
    e = UnityPy.load(p)
    _files[base] = ({o.path_id: o for o in e.objects},
                    [os.path.basename(x.path) for x in next(iter(e.files.values())).externals])
    envs.append((base, list(e.objects)))
if len(envs) > 1:
    print(f'файлов ассетов: {len(envs)} ({", ".join(b for b, _ in envs)})')


UNRESOLVED = {}     # имя-заглушка -> причина, почему вид не получил настоящего имени


def fail(stub, why):
    """Вид не резолвится: запоминаем заглушку с причиной и возвращаем её."""
    if stub not in UNRESOLVED:
        print(f'  ⚠ вид не резолвится → {stub}: {why}')
    UNRESOLVED[stub] = why
    return stub


def proto_name(pptr, owner):
    """PPtr на префаб вида → человеческое имя. `owner` — файл, В КОТОРОМ лежит сам PPtr:
    m_FileID считается по ЕГО таблице externals, у соседнего слайса она своя.
    m_FileID != 0 — ссылка НАРУЖУ, в соседний
    sharedassetsN.assets (externals[m_FileID-1], лежит в том же каталоге клиента). Игнорировать
    m_FileID нельзя: у Маяка все прототипы внешние, и по одному pathID виды схлопывались
    в proto_<pathID>.

    ⚠️ ВТОРАЯ КОПИЯ ЭТОГО ПРАВИЛА — `resolve()` в `dump-terrain.py`, там оно решено первым.
    Правишь разбор `m_FileID`/externals или политику отказа здесь — открой и её; ссылка стоит
    с обеих сторон нарочно. В общий модуль не сводим осознанно: это пачка автономных скриптов,
    а не библиотека; поводом станет третий потребитель.

    Политика отказа — та же, что у дампера: имя-заглушка не растворяется среди групп, а
    записывается в UNRESOLVED и в конце роняет прогон."""
    if not pptr:
        return fail('proto_?', 'пустой PPtr прототипа')
    path_id = pptr.get('m_PathID', 0)
    fid = pptr.get('m_FileID', 0)
    if path_id == 0:
        return fail('proto_0', 'm_PathID = 0')
    objs, ext = _files[owner]
    fname = owner
    if fid:
        i = fid - 1
        if not (0 <= i < len(ext)):
            return fail(f'proto_{fid}_{path_id}',
                        f'm_FileID={fid}, а в {owner} externals только {len(ext)}')
        fname = ext[i]
        path = os.path.join(shared_dir, fname)
        if not os.path.exists(path):
            return fail(f'proto_{fid}_{path_id}',
                        f'нужен внешний файл ассетов {fname}, рядом с {owner} его нет')
        if fname not in _files:
            print(f'  подгружен внешний файл ассетов: {fname} (за ним ушли виды растительности)')
        objs, _ = load_assets(path)
    o = objs.get(path_id)
    if o is None:
        return fail(f'proto_{path_id}', f'объект pathID={path_id} не найден в {fname}')
    try:
        t = o.read_typetree()
        n = t.get('m_Name')
        if n:
            return n
    except Exception as e:
        return fail(f'{o.type.name}_{path_id}', f'typetree не читается ({type(e).__name__})')
    return fail(f'{o.type.name}_{path_id}', f'у объекта из {fname} нет m_Name')


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
done = set()        # один и тот же слайс не должен посчитаться дважды из двух поданных файлов
for owner, objects in envs:
    for o in objects:
        if o.type.name != 'TerrainData':
            continue
        d = o.read_typetree()
        tname = d.get('m_Name')
        if tname not in pos_by_name:
            print(f'  {tname}: нет позиции в .bin, пропуск'); continue
        if tname in done:
            print(f'  {tname}: уже посчитан из другого файла ассетов, пропуск'); continue
        done.add(tname)
        P = pos_by_name[tname]; (px, py, pz) = P['pos']; (sx, sy, sz) = P['size']
        dd = d.get('m_DetailDatabase', {})
        protos = dd.get('m_TreePrototypes') or []
        names = [proto_name(p.get('prefab'), owner) for p in protos]
        trees = dd.get('m_TreeInstances') or []
        print(f'{tname}: деревьев {len(trees)}, видов {len(protos)}'
              + (f' (из {owner})' if len(envs) > 1 else ''))
        for t in trees:
            p = t['position']
            wx = px + p['x'] * sx
            wz = pz + p['z'] * sz
            wy = py + p['y'] * sy
            idx = t.get('index', 0)
            nm = (names[idx] if idx < len(names)
                  else fail(f'proto_idx{idx}', f'{tname}: index={idx}, а прототипов {len(names)}'))
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
    # coordinateRotation=180 — отражение по оси X, а не поворот (см. build-heightmap.py):
    # Unity левосторонняя, вид сверху даёт зеркало. Разворачивается только X.
    if ROT == 180:
        u = 1 - u
    i['px'] = round(u * RW)
    i['py'] = round(v * RH)

groups = {}
for i in inzone:
    groups[i['group']] = groups.get(i['group'], 0) + 1
print(f'по группам: {groups}')
print('топ видов:', sorted(summary.items(), key=lambda x: -x[1])[:10])

# --- нерезолвенные виды: отдельный счётчик и код возврата ---------------------
# Заглушка proto_* внешне неотличима от настоящего вида: она получает группу (обычно 'other'),
# попадает в разбивку и уезжает в JSON. Поэтому считаем её отдельно от групп и роняем прогон.
unres_kinds = {k: summary.get(k, 0) for k in UNRESOLVED}
unres_inzone = sum(1 for i in inzone if i['kind'] in UNRESOLVED)
print(f'нерезолвенных видов: {len(UNRESOLVED)} '
      f'({sum(unres_kinds.values())} экз., из них в границах карты {unres_inzone})')
for k, why in UNRESOLVED.items():
    print(f'  {k}: {unres_kinds[k]} экз. — {why}')
if UNRESOLVED and not ALLOW_UNRESOLVED:
    sys.exit('ОТКАЗ: виды не резолвятся, файлы не записаны — заглушки proto_* до потребителей '
             'не доезжают. Осознанно принять их: шестой аргумент allow-unresolved')

json.dump(dict(map=map_id, bounds=[XMIN, XMAX, ZMIN, ZMAX], raster=[RW, RH],
               groups=groups, kinds=summary, instances=inzone,
               unresolved={k: dict(count=unres_kinds[k], why=UNRESOLVED[k]) for k in UNRESOLVED}),
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
        u = 1 - u
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
