# Слой «камни и скалы» карты EFT: экземпляры камней/скал из levelN прямо из клиента.
# Unity и AssetRipper не нужны — UnityPy читает сцены напрямую.
#
# Запуск: python scripts/eft-map-layers/dump-stones.py <EscapeFromTarkov_Data> <map> <manifest> <outdir>
#   <EscapeFromTarkov_Data> — каталог клиента (там globalgamemanagers и levelN)
#   <map>                   — id карты портала: customs, lighthouse, …
#   <manifest>              — manifest.json растра карты (boundsFromConfig, crop, coordinateRotation)
#   <outdir>                — каталог выхода
#
# Выход:
#   <map>-stones.json  — экземпляры поштучно: мировые X/Y/Z, кватернион + yaw, масштаб,
#                        габарит в плане (с учётом поворота), вид, класс размера + ЧЕМ он задан
#                        (classSource: group | name | size), пиксели растра и два охвата:
#                        inFrame (рамка растра) и inGameZone (маска слоя «зона», если собрана)
#   <map>-stones.svg   — в рамке растра, прозрачный фон, ГРУППЫ ПО КЛАССУ размера
#   <map>-stones.png   — та же сетка, палитровый PNG с прозрачным фоном
#
# КАК УСТРОЕН КАМЕНЬ В СЦЕНЕ (шаблон жёсткий, проверен на Таможне и Маяке):
#   Stone_03 (17)                  ← корень экземпляра, LODGroup, мировой TRS
#   ├── Stone_03_LOD0              ← MeshFilter/MeshRenderer, отсюда m_LocalAABB
#   ├── Stone_03_SHADOW_LOD0       ← отбросить
#   ├── Stone_03_COLLIDER          ← отбросить
#   └── Stone_03_BALLISTIC_Stone   ← отбросить
# Единого родителя в иерархии НЕТ — ловим по имени, не по ветке.
# Ballistic-материал как признак камня НЕ ГОДИТСЯ: у Stone_01/02/04/05 он 'concrete'.
#
# ДЕКАЛИ. Щебень (garbage_stone1/2/3, Bonfire_stones) — плоские пятна высотой 0.1–0.5 м,
# фактически декали, а не камни. Режутся порогом высоты MIN_HEIGHT_M.
#
# Код возврата 0 — только если сцены карты найдены, экземпляры есть и аффина сошлась с
# проверенной рамкой комнат (если та лежит рядом). Иначе ненулевой код.

import sys, os, re, json, math

from PIL import Image, ImageDraw

Image.MAX_IMAGE_PIXELS = None

try:
    sys.stdout.reconfigure(errors='replace')
except Exception:
    pass

# --- КЛАСС РАЗМЕРА: приоритет «слово автора» > «габарит» ---------------------
# Класс берётся по трём источникам, в порядке убывания доверия; какой сработал — пишется
# в JSON полем classSource, чтобы было видно, чему верить.
#   group — говорящий узел-группа BSG в иерархии («…Stones_cliffs» → скала);
#   name  — размер зашит в имя самого ассета (Маяк: AM_Rock_Big / _Middle / _Small, *_cliff);
#   size  — ни группы, ни слова: остаётся габарит в плане.
#
# ПОРОГИ ГАБАРИТА ОТКАЛИБРОВАНЫ ПО СЛОВАРЮ САМОЙ BSG (Маяк, 2043 экземпляра, габарит в плане):
#   *_Small  n=290  p75  4.1 м   |  *_Middle n=565  p25  5.8 м  → граница декор/препятствие ≈ 4.5 м
#   *_Middle p75 14.3 м          |  *_Big    n=409  p25 15.7 м  → граница препятствие/скала ≈ 15 м
#   *_cliff  n=185  min 19.4 м, медиана 46.8 м — это уже отдельное семейство, не ступень размера.
# То есть 4.5 и 15 — не наш вкус, а измеренные границы между словами Small/Middle/Big.
MIN_HEIGHT_M = 0.6      # ниже — декаль щебня, не камень (медиана garbage_stone* 0.15–0.28 м)
DECOR_MAX_M = 4.5       # декор: перешагиваешь, читается как деталь
CLIFF_MIN_M = 15.0      # скала: формообразующий массив, обходишь издалека
                        # между ними — «препятствие»: укрытие в рост, обходишь вплотную

# Слово-размер в ИМЕНИ ассета. Порядок важен: cliff проверяется раньше остальных.
NAME_CLASS = [
    (re.compile(r'cliff', re.I), 'cliff'),
    (re.compile(r'(?:^|[_\- ])(?:big|large|huge)(?:$|[_\- 0-9])', re.I), 'cliff'),
    (re.compile(r'(?:^|[_\- ])(?:middle|medium|mid)(?:$|[_\- 0-9])', re.I), 'obstacle'),
    (re.compile(r'(?:^|[_\- ])(?:small|little|tiny)(?:$|[_\- 0-9])', re.I), 'decor'),
]
# Говорящий УЗЕЛ-ГРУППА. Условие: узел называет камни (stone|rock) И несёт слово-размер.
# ⚠️ Слово, приклеенное к «group», описывает ГРУППУ, а не камень, и в классификацию не идёт:
# Stones_smallgroup на Таможне — это камни 5.2–10.8 м (крупнее медианы «cliffs»-группы 6.3 м),
# а LEP_Small_group держит Stone_06 в 25.5 м. Проверено числами, не на слух.
GROUP_STONE_RX = re.compile(r'stone|rock', re.I)
GROUP_GLUED_RX = re.compile(r'(?:big|large|small|little|middle|medium)group', re.I)

NAME_RX = re.compile(r'stone|rock|kamen|boulder|cliff', re.I)
# «rock» ловит и ракету фейерверка, «stone» — надгробие: и то и другое не камень.
DROP_RX = re.compile(r'SHADOW|COLLIDER|BALLISTIC|_LOD[1-9]|rocket|rockwool|tombstone', re.I)
INST_RX = re.compile(r'(?:\s*\(\d+\)|\(Clone\))+\s*$')   # «Stone_03 (17)», «Rock_01(Clone)»
LOD0_RX = re.compile(r'_LOD0$', re.I)

# id карты портала -> папка локации в Assets/Content/Locations/<...>/. Это ТА ЖЕ таблица, что
# группа сцен в реестре (значения совпадали во всех восьми записях), поэтому копия убрана:
# четвёртая копия одного словаря — это четыре места, где забудут добавить новую карту.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mapgeom import MAP2GROUP as MAP_LOCATION

CLASS_ORDER = ['cliff', 'obstacle', 'decor']
CLASS_STYLE = {                       # svg-заливка/обводка и индекс палитры png
    'cliff':    dict(fill='#8c5a3c', stroke='#f0a868', idx=1),
    'obstacle': dict(fill='#6b6f73', stroke='#c8d0d6', idx=2),
    'decor':    dict(fill='#4a4f52', stroke='#8b9296', idx=3),
}


def die(msg):
    sys.exit('ОТКАЗ: ' + msg)


def classify(kind, path, foot):
    """Класс размера и источник класса. Приоритет: группа BSG > имя ассета > габарит."""
    # 1) говорящий узел-группа — ищем от ближайшего родителя к корню сцены
    nodes = path.split('/')[:-2]        # без самого меша и без корня экземпляра
    for node in reversed(nodes):
        if not GROUP_STONE_RX.search(node) or GROUP_GLUED_RX.search(node):
            continue
        for rx, cls in NAME_CLASS:
            if rx.search(node):
                return cls, 'group'
    # 2) размер зашит в имя ассета
    for rx, cls in NAME_CLASS:
        if rx.search(kind):
            return cls, 'name'
    # 3) остаётся габарит
    if foot < DECOR_MAX_M:
        return 'decor', 'size'
    if foot >= CLIFF_MIN_M:
        return 'cliff', 'size'
    return 'obstacle', 'size'


# --- геометрия ---------------------------------------------------------------
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
    tx, ty, tz = 2 * (y * vz - z * vy), 2 * (z * vx - x * vz), 2 * (x * vy - y * vx)
    return (vx + w * tx + y * tz - z * ty,
            vy + w * ty + z * tx - x * tz,
            vz + w * tz + x * ty - y * tx)


def yaw_deg(q):
    """Поворот вокруг Y в градусах 0..360 — то же 'rot', что у слоя растительности."""
    fx, _, fz = qrot(q, (0.0, 0.0, 1.0))
    return math.degrees(math.atan2(fx, fz)) % 360.0


def hull2d(pts):
    """Выпуклая оболочка (монотонная цепь Эндрю). На входе 8 углов, на выходе 4–6 точек."""
    pts = sorted(set((round(p[0], 4), round(p[1], 4)) for p in pts))
    if len(pts) < 3:
        return pts

    def half(seq):
        out = []
        for p in seq:
            while len(out) >= 2:
                ox, oy = out[-2]
                axx, ayy = out[-1]
                if (axx - ox) * (p[1] - oy) - (ayy - oy) * (p[0] - ox) > 0:
                    break
                out.pop()
            out.append(p)
        return out[:-1]

    return half(pts) + half(list(reversed(pts)))


def poly_area(poly):
    s = 0.0
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2.0


def world_corners(center, extent, scale, rot, pos):
    """8 углов m_LocalAABB меша в мировых координатах — масштаб, поворот, перенос."""
    out = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                v = ((center[0] + sx * extent[0]) * scale[0],
                     (center[1] + sy * extent[1]) * scale[1],
                     (center[2] + sz * extent[2]) * scale[2])
                r = qrot(rot, v)
                out.append((pos[0] + r[0], pos[1] + r[1], pos[2] + r[2]))
    return out


# --- сцены карты -------------------------------------------------------------
def map_levels(data_dir, map_id):
    """levelN карты из BuildSettings: Assets/Content/Locations/<папка>/<сцена>.unity."""
    import UnityPy
    loc = MAP_LOCATION.get(map_id)
    if not loc:
        die('карта «%s» не в таблице MAP_LOCATION; допиши папку локации '
            'из Assets/Content/Locations/' % map_id)
    ggm = os.path.join(data_dir, 'globalgamemanagers')
    if not os.path.exists(ggm):
        die('нет ' + ggm)
    scenes = None
    for o in UnityPy.load(ggm).objects:
        if o.type.name == 'BuildSettings':
            scenes = o.read_typetree()['scenes']
            break
    if not scenes:
        die('BuildSettings без списка сцен — клиент нестандартный')
    pref = 'assets/content/locations/%s/' % loc.lower()
    out = []
    for i, s in enumerate(scenes):
        if s.lower().startswith(pref):
            p = os.path.join(data_dir, 'level%d' % i)
            if os.path.exists(p):
                out.append((i, os.path.basename(s)[:-6], p))
    if not out:
        die('для «%s» (папка %s) не нашлось ни одного levelN' % (map_id, loc))
    return out


# --- сбор экземпляров из одной сцены ----------------------------------------
def scan_level(data_dir, level_path, level_name):
    import UnityPy
    env = UnityPy.load(level_path)
    f = next(iter(env.files.values()))
    ext = [os.path.basename(x.path) for x in f.externals]
    objs = {o.path_id: o for o in env.objects}

    tt_cache = {}

    def T(pid):
        if pid not in tt_cache:
            tt_cache[pid] = objs[pid].read_typetree()
        return tt_cache[pid]

    trs_cache = {}

    def trs(pid):
        """Мировые (позиция, кватернион, масштаб) трансформа — рекурсивно по родителям."""
        if pid in trs_cache:
            return trs_cache[pid]
        t = T(pid)
        p, r, s = t['m_LocalPosition'], t['m_LocalRotation'], t['m_LocalScale']
        lp = (p['x'], p['y'], p['z'])
        lr = (r['x'], r['y'], r['z'], r['w'])
        ls = (s['x'], s['y'], s['z'])
        fa = t['m_Father']['m_PathID']
        if fa == 0 or fa not in objs:
            res = (lp, lr, ls)
        else:
            fp, fr, fs = trs(fa)
            rp = qrot(fr, (lp[0] * fs[0], lp[1] * fs[1], lp[2] * fs[2]))
            res = ((fp[0] + rp[0], fp[1] + rp[1], fp[2] + rp[2]),
                   qmul(fr, lr), (fs[0] * ls[0], fs[1] * ls[1], fs[2] * ls[2]))
        trs_cache[pid] = res
        return res

    ext_cache = {}

    def ext_objs(fid):
        if fid == 0:
            return objs
        fn = ext[fid - 1]
        if fn not in ext_cache:
            p = os.path.join(data_dir, fn)
            ext_cache[fn] = ({o.path_id: o for o in UnityPy.load(p).objects}
                             if os.path.exists(p) else {})
        return ext_cache[fn]

    mesh_cache = {}

    def mesh_aabb(pptr):
        k = (pptr['m_FileID'], pptr['m_PathID'])
        if k in mesh_cache:
            return mesh_cache[k]
        r = None
        try:
            o = ext_objs(k[0]).get(k[1])
            if o is not None and o.type.name == 'Mesh':
                t = o.read_typetree()
                c, e = t['m_LocalAABB']['m_Center'], t['m_LocalAABB']['m_Extent']
                r = (t.get('m_Name'), (c['x'], c['y'], c['z']), (e['x'], e['y'], e['z']))
        except Exception:
            r = None
        mesh_cache[k] = r
        return r

    def transform_of(go_pid):
        for c in T(go_pid)['m_Component']:
            cp = c['component']['m_PathID']
            co = objs.get(cp)
            if co is not None and co.type.name in ('Transform', 'RectTransform'):
                return cp
        return None

    def go_path(go_pid, limit=48):
        parts = []
        cur = go_pid
        for _ in range(limit):
            o = objs.get(cur)
            if o is None:
                break
            try:
                parts.append(o.peek_name() or '?')
            except Exception:
                parts.append('?')
            tr = transform_of(cur)
            if tr is None:
                break
            fa = T(tr)['m_Father']['m_PathID']
            if not fa or fa not in objs:
                break
            cur = T(fa)['m_GameObject']['m_PathID']
        return '/'.join(reversed(parts))

    # 1) дешёвый проход по именам (peek_name не разбирает typetree — доли секунды)
    hits = []
    for o in env.objects:
        if o.type.name != 'GameObject':
            continue
        try:
            n = o.peek_name()
        except Exception:
            continue
        if n and NAME_RX.search(n) and not DROP_RX.search(n):
            hits.append((o.path_id, n))

    # 2) только у совпавших смотрим компоненты и геометрию
    by_parent = {}
    for pid, name in hits:
        tr = None
        mf = None
        for c in T(pid)['m_Component']:
            cp = c['component']['m_PathID']
            co = objs.get(cp)
            if co is None:
                continue
            tn = co.type.name
            if tn in ('Transform', 'RectTransform'):
                tr = cp
            elif tn == 'MeshFilter':
                mf = cp
        if tr is None or mf is None:
            continue                      # корень экземпляра или группа культинга — геометрии нет
        mm = T(mf).get('m_Mesh')
        if not mm:
            continue
        info = mesh_aabb(mm)
        if info is None:
            continue
        pos, rot, sc = trs(tr)
        # ключ экземпляра — родительский трансформ (корень с LODGroup); если у одного корня
        # несколько мешей-кандидатов, берём самый крупный, чтобы не задвоить экземпляр
        fa = T(tr)['m_Father']['m_PathID']
        key = fa if fa else pid
        vol = abs(info[2][0] * sc[0] * info[2][1] * sc[1] * info[2][2] * sc[2])
        prev = by_parent.get(key)
        if prev is None or vol > prev[0]:
            by_parent[key] = (vol, dict(name=name, mesh=info, pos=pos, rot=rot,
                                        scale=sc, level=level_name), pid)

    rows = []
    for vol, rec, pid in by_parent.values():
        rec['path'] = go_path(pid)
        rows.append(rec)
    return rows


# --- сборка ------------------------------------------------------------------
def main():
    if len(sys.argv) != 5:
        die('нужно 4 аргумента: <EscapeFromTarkov_Data> <map> <manifest> <outdir>')
    data_dir, map_id, man_path, outdir = sys.argv[1:5]
    if not os.path.isdir(data_dir):
        die('нет каталога клиента ' + data_dir)
    os.makedirs(outdir, exist_ok=True)

    man = json.load(open(man_path, encoding='utf-8'))
    (ax, az), (bx, bz) = man['boundsFromConfig']
    XMIN, XMAX = min(ax, bx), max(ax, bx)
    ZMIN, ZMAX = min(az, bz), max(az, bz)
    W, H = man['crop']['width'], man['crop']['height']
    ROT = man.get('coordinateRotation', 0)
    if ROT != 180:
        die('coordinateRotation=%s не проверен; для 180 это ОТРАЖЕНИЕ по X '
            '(см. рамку комнат)' % ROT)

    # Аффина: та же, что у слоя комнат. Выводим из manifest, но если рядом лежит ПРОВЕРЕННАЯ
    # рамка комнат (двери клиента сошлись с замками 33/34 в пределах 5 см) — канон её числа,
    # вывод из manifest остаётся только сверкой.
    px_b = -(W / (XMAX - XMIN))
    px_a = XMAX * (W / (XMAX - XMIN))
    py_b = (H - 1) / (ZMAX - ZMIN)
    py_a = -ZMIN * py_b
    frame_path = os.path.join(os.path.dirname(os.path.abspath(outdir)),
                              'rooms', '%s-rooms-frame.json' % map_id)
    frame_used = None
    if os.path.exists(frame_path):
        af = json.load(open(frame_path, encoding='utf-8'))['affine']
        d = max(abs(af['px_from_x'][0] - px_a), abs(af['px_from_x'][1] - px_b),
                abs(af['py_from_z'][0] - py_a), abs(af['py_from_z'][1] - py_b))
        px_a, px_b = af['px_from_x']
        py_a, py_b = af['py_from_z']
        frame_used = frame_path
        print('аффина из рамки комнат %s (расхождение с выводом из manifest %.4f)'
              % (os.path.basename(frame_path), d))
        if d > 2.0:
            die('аффина рамки и manifest расходятся на %.3f — сначала разобраться, чей канон' % d)
    else:
        print('рамки комнат рядом нет — аффина выведена из manifest')

    def to_px(gx, gz):
        return px_a + px_b * gx, py_a + py_b * gz

    # маска игровой зоны (слой «зона»), если она уже собрана: 255 = внутри
    zone_path = os.path.join(os.path.dirname(os.path.abspath(outdir)),
                             'zone', '%s-zone-mask.png' % map_id)
    zone_px = None
    if os.path.exists(zone_path):
        zi = Image.open(zone_path).convert('L')
        if zi.size != (W, H):
            die('маска зоны %s имеет размер %s, а рамка растра %s' % (zone_path, zi.size, (W, H)))
        zone_px = zi.load()
        print('маска игровой зоны: ' + os.path.basename(zone_path))
    else:
        print('маски игровой зоны рядом нет — флаг inGameZone будет null')

    def in_game_zone(px, py):
        if zone_px is None:
            return None
        x, y = int(round(px)), int(round(py))
        if not (0 <= x < W and 0 <= y < H):
            return False
        return bool(zone_px[x, y])

    levels = map_levels(data_dir, map_id)
    print('карта %s: сцен %d' % (map_id, len(levels)))

    raw = []
    for idx, name, path in levels:
        rows = scan_level(data_dir, path, name)
        if rows:
            print('  level%-5d %-44s кандидатов %d' % (idx, name, len(rows)))
        raw.extend(rows)
    if not raw:
        die('ни одного кандидата — проверь NAME_RX и папку локации')

    inst = []
    decals = 0
    decal_kinds = {}
    for r in raw:
        mesh_name, c, e = r['mesh']
        cor = world_corners(c, e, r['scale'], r['rot'], r['pos'])
        ys = [p[1] for p in cor]
        height = max(ys) - min(ys)
        kind = INST_RX.sub('', LOD0_RX.sub('', r['name'])).strip()
        if height <= MIN_HEIGHT_M:
            decals += 1
            decal_kinds[kind] = decal_kinds.get(kind, 0) + 1
            continue
        hull = hull2d([(p[0], p[2]) for p in cor])
        xs = [p[0] for p in hull]
        zs = [p[1] for p in hull]
        plan_w, plan_d = max(xs) - min(xs), max(zs) - min(zs)
        foot = max(plan_w, plan_d)
        cls, cls_src = classify(kind, r['path'], foot)
        gx, gz = r['pos'][0], r['pos'][2]
        px, py = to_px(gx, gz)
        inst.append(dict(
            kind=kind, mesh=mesh_name, cls=cls, classSource=cls_src,
            level=r['level'], path=r['path'],
            x=round(gx, 3), y=round(r['pos'][1], 3), z=round(gz, 3),
            rot=round(yaw_deg(r['rot']), 2),
            quat=[round(v, 5) for v in r['rot']],
            scale=[round(v, 4) for v in r['scale']],
            height=round(height, 2), planW=round(plan_w, 2), planD=round(plan_d, 2),
            foot=round(foot, 2), area=round(poly_area(hull), 1),
            px=round(px, 1), py=round(py, 1),
            hull=[[round(a, 2), round(b, 2)] for a, b in hull],
            hullPx=[[round(v, 1) for v in to_px(a, b)] for a, b in hull],
            inFrame=bool(XMIN <= gx <= XMAX and ZMIN <= gz <= ZMAX),
            inGameZone=in_game_zone(px, py),
        ))

    inst.sort(key=lambda r: -r['foot'])
    inzone = [r for r in inst if r['inFrame']]
    ingame = [r for r in inst if r['inGameZone']]

    def tally(seq, key):
        out = {}
        for r in seq:
            out[r[key]] = out.get(r[key], 0) + 1
        return dict(sorted(out.items(), key=lambda kv: -kv[1]))

    stats = dict(
        total=len(inst), inFrame=len(inzone),
        inGameZone=(len(ingame) if zone_px is not None else None),
        decalsDropped=decals, decalKinds=decal_kinds,
        byClass=tally(inst, 'cls'), byClassInFrame=tally(inzone, 'cls'),
        byClassInGameZone=(tally(ingame, 'cls') if zone_px is not None else None),
        byClassSource=tally(inst, 'classSource'),
        byKind=tally(inst, 'kind'), byLevel=tally(inst, 'level'),
        footprintFrameM2=round(sum(r['area'] for r in inzone), 1),
        footprintGameZoneM2=(round(sum(r['area'] for r in ingame), 1)
                             if zone_px is not None else None),
    )

    out_json = os.path.join(outdir, '%s-stones.json' % map_id)
    json.dump(dict(
        map=map_id, bounds=[XMIN, XMAX, ZMIN, ZMAX], raster=[W, H],
        affine=dict(px_from_x=[px_a, px_b], py_from_z=[py_a, py_b]),
        affineSource=frame_used or man_path,
        thresholds=dict(minHeightM=MIN_HEIGHT_M, decorMaxM=DECOR_MAX_M, cliffMinM=CLIFF_MIN_M),
        stats=stats, instances=inst,
    ), open(out_json, 'w', encoding='utf-8'), ensure_ascii=False)

    # --- SVG: группы по классу размера --------------------------------------
    out_svg = os.path.join(outdir, '%s-stones.svg' % map_id)
    with open(out_svg, 'w', encoding='utf-8') as fh:
        fh.write('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" '
                 'viewBox="0 0 %d %d">\n' % (W, H, W, H))
        fh.write('<!-- %s: камни и скалы, %d шт в рамке растра; порог декали %s м, '
                 'декор < %s м, скала >= %s м -->\n'
                 % (map_id, len(inzone), MIN_HEIGHT_M, DECOR_MAX_M, CLIFF_MIN_M))
        for cls in CLASS_ORDER:
            st = CLASS_STYLE[cls]
            grp = [r for r in inzone if r['cls'] == cls]
            fh.write('<g id="stones-%s" fill="%s" fill-opacity="0.45" stroke="%s" '
                     'stroke-width="3" stroke-opacity="0.95">\n' % (cls, st['fill'], st['stroke']))
            for r in grp:
                pts = ' '.join('%s,%s' % (a, b) for a, b in r['hullPx'])
                fh.write('<polygon points="%s"><title>%s %s×%s×%s м</title></polygon>\n'
                         % (pts, r['kind'], r['planW'], r['planD'], r['height']))
            fh.write('</g><!-- %s: %d -->\n' % (cls, len(grp)))
        fh.write('</svg>\n')

    # --- PNG: та же сетка, палитра, прозрачный фон ---------------------------
    out_png = os.path.join(outdir, '%s-stones.png' % map_id)
    img = Image.new('P', (W, H), 0)
    pal = [0, 0, 0] * 256
    for cls, st in CLASS_STYLE.items():
        i = st['idx']
        pal[i * 3:i * 3 + 3] = [int(st['fill'][1:3], 16), int(st['fill'][3:5], 16),
                                int(st['fill'][5:7], 16)]
    img.putpalette(pal)
    d = ImageDraw.Draw(img)
    for cls in CLASS_ORDER:
        i = CLASS_STYLE[cls]['idx']
        for r in inzone:
            if r['cls'] == cls:
                d.polygon([tuple(p) for p in r['hullPx']], fill=i, outline=i)
    img.save(out_png, transparency=0, optimize=True)

    print('\nвсего %d, в рамке растра %d, в игровой зоне %s, отсеяно декалей %d'
          % (stats['total'], stats['inFrame'], stats['inGameZone'], decals))
    print('по классам (рамка):     ', stats['byClassInFrame'])
    print('по классам (игр. зона): ', stats['byClassInGameZone'])
    print('источник класса:        ', stats['byClassSource'])
    print('след в плане, м²: рамка %s, игровая зона %s'
          % (stats['footprintFrameM2'], stats['footprintGameZoneM2']))
    for p in (out_json, out_svg, out_png):
        print('->', p)


if __name__ == '__main__':
    main()
