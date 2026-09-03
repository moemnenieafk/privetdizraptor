# Дамп Unity TerrainData карты EFT прямо из клиента — без Unity и без AssetRipper.
# Заменяет batch-экспортёр TerrainExporter.cs: пишет байт-в-байт тот же формат.
#
# Вход:  sharedassetsN.assets (сами TerrainData) + levelN (иерархия сцены с позициями слайсов)
# Выход: <outdir>/<map>-terrain.bin  — имя, мировая позиция, size, res, высоты 0..1 [row=Z][col=X]
#        <outdir>/splat_<terrain>.bin — aw/ah/al, имена слоёв, веса 0..1 [row][col][layer]
#
# Запуск: python scripts/eft-terrain/dump-terrain.py <sharedassets> <level> <outdir> <map> [orient-override]
#         пятый аргумент — литерал orient-override: снимает отказ по «зеркало ложится лучше»
#         (проверка ориентации статистическая; сверили с растром глазами — можно продавить).
#
# Код возврата 0 — только если каждая террейн-нода этого файла ассетов учтена, привязка сошлась
# с сеткой 700 м, имена слоёв прочитаны и ориентация splat не опровергнута. Иначе ненулевой код:
# дальше по конвейеру ехать нельзя.
# Сверка с эталоном Unity: python scripts/eft-terrain/verify-terrain-bin.py <эталон.bin> <наш.bin>

import sys, os, re, struct
import numpy as np
import UnityPy

# консоль Windows по умолчанию cp1251 — не роняем прогон на непечатаемом символе
try:
    sys.stdout.reconfigure(errors='replace')
except Exception:
    pass

shared_path, level_path, outdir, map_id = sys.argv[1:5]
orient_override = len(sys.argv) > 5 and sys.argv[5] == 'orient-override'
os.makedirs(outdir, exist_ok=True)

# Unity нормализует 16-битные высоты террейна на 32766 (не 32767 и не 32768) —
# проверено на эталоне Таможни: max|наше - Unity| = 3.2e-08. Сырое значение выше делителя
# означало бы другую нормализацию — это отказ, а не повод обрезать.
HEIGHT_DIV = 32766.0
GRID_STEP = 700.0          # шаг сетки слайсов Slice_<ряд>_<кол> в метрах
# 'AI' — отдельный токен: границы обязательны С ОБЕИХ сторон (начало/конец имени или '_').
# Ловит AI_Terrain_Custom_2, Terrain_AI_1_1. НЕ ловит AIRPORT_1_1, Slice_SHANGHAI_1_2,
# Slice_AIrport_2_3 — такие дубли, если они дубли, отсеются по layers == 0.
AI_NAME = re.compile(r'(?:^|_)AI(?:_|$)')
SLICE_NAME = re.compile(r'^.*?_(\d+)_(\d+)$')
ORIENT_MIN = 0.005         # ниже этого сигнал слишком слаб, чтобы что-то утверждать
ORIENT_MARGIN = 1.2        # во сколько раз верная ориентация должна обыгрывать зеркальную

written = errors = 0
drop_name = drop_layers = drop_nonode = 0
weak_orient = mirror_orient = 0
layer_fallbacks = []


class Fatal(Exception):
    """Отказ, после которого писать .bin нельзя: шов уехал бы молча."""


# --- иерархия сцены: мировые позиции слайсов ---------------------------------
lvl = UnityPy.load(level_path)
lvl_objs = {o.path_id: o for o in lvl.objects}
lvl_file = next(iter(lvl.files.values()))
# m_FileID: 0 — свой файл, N — externals[N-1]
lvl_externals = [os.path.basename(e.path) for e in lvl_file.externals]


def ext_name(file_id):
    if file_id == 0:
        return os.path.basename(level_path)
    i = file_id - 1
    return lvl_externals[i] if 0 <= i < len(lvl_externals) else f'fileID_{file_id}'


def qmul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return (aw * bx + ax * bw + ay * bz - az * by,
            aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw,
            aw * bw - ax * bx - ay * by - az * bz)


def qrot(q, v):
    x, y, z, w = q
    vx, vy, vz = v
    # v + 2w(q x v) + 2q x (q x v)
    tx, ty, tz = 2 * (y * vz - z * vy), 2 * (z * vx - x * vz), 2 * (x * vy - y * vx)
    return (vx + w * tx + y * tz - z * ty,
            vy + w * ty + z * tx - x * tz,
            vz + w * tz + x * ty - y * tx)


_trs_cache = {}


def trs(tr_pid):
    """Мировые (позиция, поворот, масштаб) трансформа — с учётом всей цепочки родителей."""
    if tr_pid in _trs_cache:
        return _trs_cache[tr_pid]
    t = lvl_objs[tr_pid].read_typetree()
    p = t['m_LocalPosition']; r = t['m_LocalRotation']; s = t['m_LocalScale']
    lp = (p['x'], p['y'], p['z'])
    lr = (r['x'], r['y'], r['z'], r['w'])
    ls = (s['x'], s['y'], s['z'])
    father = t['m_Father']['m_PathID']
    if father == 0:
        res = (lp, lr, ls)
    else:
        (fp, fr, fs) = trs(father)
        scaled = (lp[0] * fs[0], lp[1] * fs[1], lp[2] * fs[2])
        rp = qrot(fr, scaled)
        res = ((fp[0] + rp[0], fp[1] + rp[1], fp[2] + rp[2]),
               qmul(fr, lr),
               (fs[0] * ls[0], fs[1] * ls[1], fs[2] * ls[2]))
    _trs_cache[tr_pid] = res
    return res


def go_name(go_pid):
    return lvl_objs[go_pid].read_typetree()['m_Name']


# Нода сцены на каждый TerrainData. Ключ учёта — (файл ассетов, pathID): он уникален,
# в отличие от имени, по которому две одноимённые ноды схлопнулись бы молча.
nodes, nodes_by_ref, nodes_by_name, by_name_all = [], {}, {}, {}
for o in lvl.objects:
    if o.type.name != 'Terrain':
        continue
    t = o.read_typetree()
    go_pid = t['m_GameObject']['m_PathID']
    tr_pid = None
    for c in lvl_objs[go_pid].read_typetree()['m_Component']:
        pid = c['component']['m_PathID']
        if lvl_objs[pid].type.name == 'Transform':
            tr_pid = pid
            break
    if tr_pid is None:
        raise SystemExit(f'ОТКАЗ: у GameObject {go_pid} с компонентом Terrain нет Transform')
    pos, _rot, _sc = trs(tr_pid)
    father = lvl_objs[tr_pid].read_typetree()['m_Father']['m_PathID']
    root = trs(father)[0] if father else (0.0, 0.0, 0.0)
    td = t['m_TerrainData']
    node = dict(name=go_name(go_pid), pos=pos, root=root,
                ref=(ext_name(td['m_FileID']), td['m_PathID']))
    nodes.append(node)
    nodes_by_ref[node['ref']] = node
    by_name_all.setdefault(node['name'], []).append(node)
    nodes_by_name.setdefault(node['name'], node)

print(f'сцена {os.path.basename(level_path)}: террейн-нод {len(nodes)}')
for nm, group in by_name_all.items():
    if len(group) > 1:
        # формат .bin адресует террейны по имени (build-material берёт имя из basename splat-файла)
        refs = ', '.join(f'{n["ref"][0]}#{n["ref"][1]}' for n in group)
        print(f'  ОШИБКА: в сцене {len(group)} нод с именем {nm} ({refs}) — '
              f'в .bin и в splat_{nm}.bin они перетёрли бы друг друга')
        errors += 1


# --- файлы ассетов: свой + внешние, куда уходят PPtr'ы ------------------------
shared_base = os.path.basename(shared_path)
shared_dir = os.path.dirname(os.path.abspath(shared_path))
_files = {}     # basename -> (индекс объектов, список externals)


def load_assets(path):
    base = os.path.basename(path)
    if base not in _files:
        e = UnityPy.load(path)
        f = next(iter(e.files.values()))
        _files[base] = ({o.path_id: o for o in e.objects},
                        [os.path.basename(x.path) for x in f.externals])
    return _files[base]


objs, _ = load_assets(shared_path)


def resolve(pptr, owner, what):
    """PPtr → объект, сквозь внешние файлы. owner — basename файла, в котором лежит сам PPtr.
    Внешние .assets EFT лежат в одном каталоге с sharedassets, ищем там."""
    if not pptr or pptr.get('m_PathID', 0) == 0:
        raise Fatal(f'{what}: пустая ссылка')
    o_objs, o_ext = _files[owner]
    fid = pptr.get('m_FileID', 0)
    if fid == 0:
        target, fname = o_objs, owner
    else:
        i = fid - 1
        if not (0 <= i < len(o_ext)):
            raise Fatal(f'{what}: m_FileID={fid}, а в {owner} externals только {len(o_ext)}')
        fname = o_ext[i]
        p = os.path.join(shared_dir, fname)
        if not os.path.exists(p):
            raise Fatal(f'{what}: нужен внешний файл ассетов {fname}, рядом с {shared_base} его нет')
        if fname not in _files:
            print(f'  подгружен внешний файл ассетов: {fname} (за ним ушла ссылка {what})')
        target, _ = load_assets(p)
    obj = target.get(pptr['m_PathID'])
    if obj is None:
        raise Fatal(f'{what}: объект pathID={pptr["m_PathID"]} не найден в {fname}')
    return obj, fname


def layer_names(layer_ptrs, tname):
    """Имя слоя = имя diffuse-текстуры (как в TerrainExporter.cs).
    build-material.py сопоставляет семейства палитры ПО ИМЕНАМ — заглушку '?' в шов не пишем,
    а подстановку имени TerrainLayer (microsplat_layer_…) считаем и выносим в итог."""
    out = []
    for i, p in enumerate(layer_ptrs):
        what = f'{tname}: слой {i}'
        lo, lfile = resolve(p, shared_base, what)
        lt = lo.read_typetree()
        dif = lt.get('m_DiffuseTexture') or {}
        if dif.get('m_PathID', 0):
            tex, _ = resolve(dif, lfile, f'{what} (diffuse-текстура)')
            n = tex.read_typetree().get('m_Name')
            if not n:
                raise Fatal(f'{what}: у diffuse-текстуры нет m_Name')
            out.append(n)
            continue
        n = lt.get('m_Name')
        if not n:
            raise Fatal(f'{what}: нет ни diffuse-текстуры, ни имени TerrainLayer')
        print(f'  ВНИМАНИЕ {what}: diffuse-текстуры нет, имя взято у TerrainLayer ({n})')
        layer_fallbacks.append(f'{tname}[{i}]={n}')
        out.append(n)
    return out


def heights01(hm, res, tname):
    """m_Heights → float32 0..1, [row=Z][col=X]. Бывает int16-упакованным и float."""
    raw = np.asarray(hm['m_Heights'])
    if raw.size != res * res:
        raise Fatal(f'{tname}: высот {raw.size}, ожидалось {res * res}')
    if np.issubdtype(raw.dtype, np.floating):
        h = raw.astype(np.float32)
        if h.min() < -1e-6 or h.max() > 1.0 + 1e-6:
            raise Fatal(f'{tname}: float-высоты вне 0..1: [{h.min()}, {h.max()}]')
    else:
        lo, hi = int(raw.min()), int(raw.max())
        if lo < 0 or hi > HEIGHT_DIV:
            raise Fatal(f'{tname}: сырые высоты [{lo},{hi}] не укладываются в делитель '
                        f'{HEIGHT_DIV:.0f} — нормализация в этой версии Unity другая')
        h = (raw.astype(np.float64) / HEIGHT_DIV).astype(np.float32)
    return h.reshape(res, res)


def alphamaps(tex_ptrs, al, tname):
    """RGBA-текстуры → веса float32 (ah, aw, al). Текстура i, канал c → слой i*4+c.
    Unity хранит строки снизу вверх, UnityPy отдаёт картинку сверху вниз → разворот."""
    need = -(-al // 4)
    if len(tex_ptrs) < need:
        raise Fatal(f'{tname}: слоёв {al} → нужно {need} alpha-текстур, '
                    f'в m_AlphaTextures их {len(tex_ptrs)}')
    planes = []
    for i in range(need):
        o, _ = resolve(tex_ptrs[i], shared_base, f'{tname}: alpha-текстура {i}')
        planes.append(np.array(o.read().image.convert('RGBA'))[::-1])
    ah, aw = planes[0].shape[:2]
    for i, pl in enumerate(planes):
        if pl.shape[:2] != (ah, aw):
            raise Fatal(f'{tname}: alpha-текстура {i} имеет размер {pl.shape[:2]}, а не {(ah, aw)}')
    a = np.zeros((ah, aw, al), np.float32)
    for l in range(al):
        a[:, :, l] = planes[l // 4][:, :, l % 4].astype(np.float32) / 255.0
    return a, aw, ah


def orientation_note(a, h, tname):
    """Взаимная ориентация splat и высот — БЕЗ эталона.
    Границы материалов (дороги, скальные пятна, отсыпки) лежат по форме рельефа, поэтому
    у верной ориентации корреляция «край доминирующего слоя ~ уклон + кривизна» заметно выше,
    чем у зеркальной. На Таможне верный вариант обыгрывает зеркало по Z в 2.2 раза.
    Высоты берутся В ТЕХ ЖЕ мировых точках, что и ячейки splat (децимация res → aw/ah):
    без этого сравнивались бы пространственно несовпадающие массивы и запас ничего не значил бы.
    Возвращает (строка для лога, вердикт: ok | weak | mirror)."""
    ah, aw, _ = a.shape
    res = h.shape[0]
    if ah > res or aw > res or min(ah, aw) < 8:
        return 'ориентация=НЕ ВЕРИФИЦИРОВАНА (splat подробнее высот, сравнивать нечем)', 'weak'
    iy = np.minimum(((np.arange(ah) + 0.5) * (res - 1) / ah).astype(int), res - 1)
    ix = np.minimum(((np.arange(aw) + 0.5) * (res - 1) / aw).astype(int), res - 1)
    hh = h[np.ix_(iy, ix)].astype(np.float64)
    gy, gx = np.gradient(hh)
    slope = np.hypot(gx, gy)
    lap = np.abs(np.gradient(np.gradient(hh, axis=0), axis=0)
                 + np.gradient(np.gradient(hh, axis=1), axis=1))

    def corr(x, y):
        sx, sy = x.std(), y.std()
        if sx < 1e-12 or sy < 1e-12:
            return 0.0
        return float((((x - x.mean()) / sx) * ((y - y.mean()) / sy)).mean())

    def score(d):
        e = ((np.abs(np.gradient(d, axis=0)) + np.abs(np.gradient(d, axis=1))) > 0).astype(np.float64)
        return corr(e, slope) + corr(e, lap)

    D = a.argmax(axis=2).astype(np.float64)     # зеркалить D — то же, что зеркалить веса
    s = {'как есть': score(D), 'зеркало по Z': score(D[::-1]),
         'зеркало по X': score(D[:, ::-1]), 'зеркало по X и Z': score(D[::-1, ::-1])}
    mine = s['как есть']
    rival_key = max((k for k in s if k != 'как есть'), key=lambda k: s[k])
    rival = s[rival_key]
    if rival > mine:
        return (f'ориентация=ЗЕРКАЛО ЛОЖИТСЯ ЛУЧШЕ: «{rival_key}» {rival:.4f} против {mine:.4f}',
                'mirror')
    if mine < ORIENT_MIN:
        return (f'ориентация=НЕ ВЕРИФИЦИРОВАНА (сигнал слаб: {mine:.4f} — рельеф плоский '
                f'или материал однороден; сверить с растром карты вручную)', 'weak')
    if rival > 0 and mine < ORIENT_MARGIN * rival:
        return (f'ориентация=НЕ ВЕРИФИЦИРОВАНА (запас мал: {mine:.4f} против {rival:.4f} '
                f'у «{rival_key}») — сверить материал с растром карты', 'weak')
    ratio = f'{mine / rival:.1f}x' if rival > 0 else 'зеркала уходят в минус'
    return f'ориентация=подтверждена (запас {ratio}, {mine:.4f})', 'ok'


# --- дамп ---------------------------------------------------------------------
terrain_path = f'{outdir}/{map_id}-terrain.bin'
accounted_refs, made_splats = set(), []
out = open(terrain_path, 'wb')
try:
    for o in sorted((x for x in objs.values() if x.type.name == 'TerrainData'), key=lambda x: x.path_id):
        d = o.read_typetree()
        name = d.get('m_Name') or f'TerrainData_{o.path_id}'
        hm = d['m_Heightmap']
        sd = d.get('m_SplatDatabase', {})
        layer_ptrs = sd.get('m_TerrainLayers') or []

        # сперва привязка к сцене: имя ноды и имя TerrainData совпадают не всегда
        # (у Леса нода TerrainGrass_2_4 указывает на TerrainData AITerrainGrass_2_4)
        node = nodes_by_ref.get((shared_base, o.path_id))
        if node is not None:
            bind = f'привязка=по ссылке {shared_base}#{o.path_id}'
        else:
            node = nodes_by_name.get(name)
            bind = (f'привязка=ПО ИМЕНИ (ссылки на {shared_base}#{o.path_id} '
                    f'в сцене нет — externals сцены другие)')
        if node is None:
            print(f'  отброшен {name}: нет ноды в сцене {os.path.basename(level_path)}')
            drop_nonode += 1
            continue

        # отсев дублей-навигации: пустые слои и AI-имена (и у ассета, и у ноды сцены)
        reasons = []
        if AI_NAME.search(name) or AI_NAME.search(node['name']):
            reasons.append('имя вида AI_*/*_AI* (навигационный дубль)')
            drop_name += 1
        if not layer_ptrs:
            reasons.append('layers == 0 (нет слоёв поверхности)')
            drop_layers += 1
        if reasons:
            who = name if name == node['name'] else f'{name} (нода {node["name"]})'
            print(f'  отброшен {who}: ' + '; '.join(reasons))
            accounted_refs.add(node['ref'])
            continue

        res = hm['m_Resolution']
        sc = hm['m_Scale']
        sx, sy, sz = sc['x'] * (res - 1), sc['y'], sc['z'] * (res - 1)
        px, py, pz = node['pos']

        # всё, что может отказать, считаем ДО записи: полуфабрикат в шов не попадёт
        h = heights01(hm, res, node['name'])
        al = len(layer_ptrs)
        names = layer_names(layer_ptrs, node['name'])
        a, aw, ah = alphamaps(sd.get('m_AlphaTextures') or [], al, node['name'])
        orient, verdict = orientation_note(a, h, node['name'])
        if verdict == 'weak':
            weak_orient += 1
        elif verdict == 'mirror':
            mirror_orient += 1

        # контроль привязки: Slice_<ряд>_<кол> → x=(кол-1)*700, z=(ряд-1)*700 от корня
        m = SLICE_NAME.match(node['name'])
        grid_note = 'сетка=имя без ряда/колонки'
        if m:
            row, col = int(m.group(1)), int(m.group(2))
            ex = node['root'][0] + (col - 1) * GRID_STEP
            ez = node['root'][2] + (row - 1) * GRID_STEP
            dx, dz = abs(px - ex), abs(pz - ez)
            grid_note = f'сетка=ok (ряд {row}, кол {col}, d {max(dx, dz):.2f} м)'
            if dx > 1.0 or dz > 1.0:
                grid_note = f'сетка=РАСХОЖДЕНИЕ {max(dx, dz):.1f} м'
                print(f'  ОШИБКА привязки {node["name"]}: сетка ждёт ({ex:.1f},{ez:.1f}), '
                      f'иерархия дала ({px:.1f},{pz:.1f}), расхождение ({dx:.1f},{dz:.1f}) м')
                errors += 1

        nb = node['name'].encode('utf-8')
        out.write(struct.pack('<i', len(nb))); out.write(nb)
        out.write(struct.pack('<6f', px, py, pz, sx, sy, sz))
        out.write(struct.pack('<i', res))
        out.write(np.ascontiguousarray(h, '<f4').tobytes())

        sp = f'{outdir}/splat_{node["name"]}.bin'
        with open(sp, 'wb') as sf:
            sf.write(struct.pack('<3i', aw, ah, al))
            for n in names:
                b = n.encode('utf-8')
                sf.write(struct.pack('<i', len(b))); sf.write(b)
            sf.write(np.ascontiguousarray(a, '<f4').tobytes())
        made_splats.append(sp)

        print(f'{node["name"]:16s} res={res} pos=({px:.1f},{py:.1f},{pz:.1f}) '
              f'size=({sx:.0f},{sy:.0f},{sz:.0f}) '
              f'высоты=[{py + h.min() * sy:.1f},{py + h.max() * sy:.1f}] м шаг={sx / (res - 1):.2f} м')
        print(f'  {bind}; {grid_note}; {orient}')
        print(f'  SPLAT {node["name"]}: {aw}x{ah} слоёв={al} [{", ".join(names)}] -> {sp}')
        accounted_refs.add(node['ref'])
        written += 1
except Fatal as e:
    out.close()
    for p in made_splats + [terrain_path]:
        try:
            os.remove(p)
        except OSError:
            pass
    sys.exit(f'ОТКАЗ: {e}\n(выход удалён — на неполном дампе конвейер запускать нельзя)')
out.close()

# --- ни одна нода сцены не должна пропасть молча -------------------------------
# Соседние слайсы общей мировой сетки лежат в чужих sharedassets (у Маяка это 140 и 25):
# это раскладка BSG, а не недостача входа — строка в лог, но не ошибка.
foreign = 0
for node in nodes:
    if node['ref'] in accounted_refs:
        continue
    src = f'{node["ref"][0]}#{node["ref"][1]}'
    if node['ref'][0] != shared_base:
        print(f'  нода {node["name"]}: TerrainData в {src} — соседний слайс общей сетки, '
              f'не из {shared_base}')
        foreign += 1
        continue
    print(f'  ОШИБКА: нода сцены {node["name"]} не записана — её TerrainData {src} '
          f'подан на вход, но в дамп не попал')
    errors += 1

print(f'\nготово: {written} террейнов; нод сцены {len(nodes)}, из них в чужих файлах {foreign} '
      f'-> {terrain_path}')
print(f'отброшено: по AI-имени {drop_name}, по layers == 0 {drop_layers}, '
      f'без ноды в сцене {drop_nonode} (одна запись может попасть в оба первых счётчика)')
if layer_fallbacks:
    print(f'ВНИМАНИЕ: слоёв без diffuse-текстуры {len(layer_fallbacks)} '
          f'({", ".join(layer_fallbacks[:6])}) — build-material.py сопоставляет семейства '
          f'по именам, эти слои уедут в дефолтное семейство')
if weak_orient:
    print(f'ВНИМАНИЕ: ориентация splat не подтверждена у {weak_orient} террейнов — '
          f'сверить карту материала с растром карты глазами')
if mirror_orient:
    if orient_override:
        print(f'ВНИМАНИЕ: у {mirror_orient} террейнов зеркало ложится на рельеф лучше прямой '
              f'ориентации; отказ снят флагом orient-override')
    else:
        print(f'ОШИБКА: у {mirror_orient} террейнов зеркальная ориентация ложится на рельеф ЛУЧШЕ '
              f'прямой — материал, скорее всего, зеркальный по Z')
        errors += mirror_orient
if errors:
    for p in made_splats:
        try:
            os.remove(p)
        except OSError:
            pass
    bad = terrain_path + '.bad'
    try:
        os.replace(terrain_path, bad)
    except OSError:
        bad = terrain_path
    hint = (' Уверены в ориентации — перезапустите с пятым аргументом orient-override.'
            if mirror_orient and not orient_override else '')
    sys.exit(f'ОТКАЗ: ошибок {errors}; выход отложен в {bad}, splat-файлы удалены — '
             f'конвейер на этом дампе запускать нельзя.{hint}')
if written == 0:
    sys.exit('ОТКАЗ: ни одного террейна не записано')
