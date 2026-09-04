# Дамп «внутренней разметки» локации EFT прямо из сцен клиента: комнаты, проёмы,
# двери, выходы, indoor-объёмы и габариты зданий — в один нормализованный JSON.
#
# Откуда что берётся (Unity IL2CPP: типтри у MonoBehaviour НЕТ, payload разбирается сигнатурой):
#   комнаты  SpatialAudioRoom из ЗВУКОВОЙ сцены карты (*_Sound). BSG держит там готовый граф
#            помещений: комната = набор ориентированных боксов. Байтовая раскладка payload:
#              [volume][aabbCenter xyz][aabbExtent xyz][count:int]{[center xyz][quat xyzw][half xyz]}*count
#            Смещение подбирается сканом с тремя проверками (|q|=1, half>=0, центр бокса внутри AABB) —
#            поэтому патч BSG, сдвинувший поля, даст не мусор, а честный отказ разбора.
#   проёмы   Audio.SpatialSystem.SpatialAudioPortal — это плоский Quad, вся геометрия лежит
#            в Transform (позиция + кватернион + scale = ширина×высота, z=0). Байты не нужны.
#   двери    EFT.Interactive.Door / ExfiltrationDoor по всем геометрическим сценам; KeyId —
#            24-символьная hex-строка BSG-id ключа в сыром payload.
#   выходы   EFT.Interactive.ExfiltrationPoint / ScavExfiltrationPoint (+ BoxCollider = объём выхода).
#   indoor   EFT.EnvironmentEffect.IndoorTrigger — объёмы «под крышей».
#   здания   AABB поддерева узлов SOO_LOD0/BUILDING(S) через MeshFilter.m_Mesh -> Mesh.m_LocalAABB
#            (m_Center + m_Extent). Вершины НЕ разбираются: AABB меша уже посчитан Unity.
#
# Соответствие карта <-> сцены берётся из docs/registry/eft-scenes.json. Террейн-сцена
# (levelN на 65 МБ у Таможни) для этой задачи не нужна и пропускается по имени.
#
# СМОУК-ТЕСТ НА СЧЁТЧИКАХ: для карт из EXPECT счётчики сверяются с эталоном и при расхождении
# скрипт ГРОМКО ругается и возвращает 1 (JSON при этом всё равно пишется). Это единственная
# защита от того, что патч BSG тихо сдвинет байтовый формат и мы получим правдоподобный мусор.
#
# Вход:  <EscapeFromTarkov_Data>  каталог клиента (…/Escape from Tarkov/EscapeFromTarkov_Data)
#        <map>                    id карты портала (customs, lighthouse, woods, …)
#        <outdir>                 куда положить <map>-rooms.json
# Выход: <outdir>/<map>-rooms.json — всё вышеперечисленное в МИРОВЫХ игровых координатах (метры)
#
# Запуск: python scripts/eft-rooms/dump-rooms.py "D:/Games/Escape from Tarkov/EscapeFromTarkov_Data" customs D:/eft-export/customs
#
# Зависимости: UnityPy (новых не заводится).

import sys, os, re, json, struct, collections, time

import UnityPy

if len(sys.argv) < 4:
    sys.exit('использование: python scripts/eft-rooms/dump-rooms.py <EscapeFromTarkov_Data> <map> <outdir>')

DATA, MAP_ID, OUTDIR = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUTDIR, exist_ok=True)

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCENES_JSON = os.path.join(REPO, 'docs', 'registry', 'eft-scenes.json')

# id карты портала -> ключ группы сцен в docs/registry/eft-scenes.json.
# Ключи реестра — как их назвала BSG, включая опечатку shorline.
MAP2GROUP = {
    'customs': 'Custom',
    'factory': 'Factory',
    'woods': 'Woods',
    'shoreline': 'shorline',
    'lighthouse': 'Lighthouse',
    'interchange': 'Shopping_Mall',
    'reserve': 'Reserve_Base',
    'the-lab': 'Laboratory',
    'streets-of-tarkov': 'City',
    'ground-zero': 'Sandbox',
    'labyrinth': 'Labyrinth',
    'terminal': 'Terminal',
    'icebreaker': 'Icebreaker',
}

# Эталонные счётчики. Расхождение = формат поехал (или сцены поехали) — падаем с кодом 1.
# Двери: 224, а не 220 из разведки. Разница ровно в сцене level7 (custom_AZS_Old, 4 двери) —
# разведка её просто не сканировала. Сцена живая, а не легаси: её геометрия стоит на x≈310,
# z≈−180…−200, вплотную к выходу exit_scav_oldazsgate (300.5, −198.5), и с новой заправкой
# (level6, x≈415, z≈+20) не пересекается. Это Старая заправка Таможни.
EXPECT = {
    'customs': {'rooms': 398, 'portals': 1347, 'doors': 224, 'exits': 26},
}

DOOR_SCRIPTS = ('EFT.Interactive.Door', 'EFT.Interactive.ExfiltrationDoor')
EXIT_SCRIPTS = ('EFT.Interactive.ExfiltrationPoint', 'EFT.Interactive.ScavExfiltrationPoint')
INDOOR_SCRIPTS = ('EFT.EnvironmentEffect.IndoorTrigger',)
ROOM_SCRIPTS = ('SpatialAudioRoom', 'Audio.SpatialSystem.SpatialAudioRoom')
PORTAL_SCRIPTS = ('Audio.SpatialSystem.SpatialAudioPortal',)

BUILDING_NODES = ('BUILDING', 'BUILDINGS')
BUILDING_MIN_AREA = 20.0     # м² следа: меньше — это не здание, а будка/забор
# Верхний предел следа: в сцене custom_background лежат ДЕКОРАЦИИ ГОРИЗОНТА — «здания» размером
# 1367×1996 м (Termianal_sandbox_background, shopping_mall_outdoor_background, Oil_storages).
# Это не постройки локации, а задник; в оверлее они дают прямоугольники на пол-карты.
BUILDING_MAX_AREA = 20000.0
BUILDING_SKIP_NAME = ('background',)
SKIP_MESH_NAMES = ('SHADOW', 'BALLISTIC')   # прокси-геометрия, габариты завышает

HEX24 = re.compile(r'^[0-9a-f]{24}$')
ASCII_RUN = re.compile(rb'[ -~]{4,}')

# ─────────────────────────────────────────────── реестр сцен

groups = json.load(open(SCENES_JSON, encoding='utf-8'))
group = MAP2GROUP.get(MAP_ID)
if group is None or group not in groups:
    sys.exit(f'карта {MAP_ID}: нет группы сцен в {SCENES_JSON} (известны {sorted(MAP2GROUP)})')

# ⚠️ ОДНА СЦЕНА МОЖЕТ БЫТЬ В BuildSettings ДВАЖДЫ. У Терминала клиент везёт КАЖДУЮ
# из 36 сцен в двух копиях (level600-635 и level651-686, +51): имена и содержимое
# совпадают, объекты стоят в тех же координатах. Без отсева по имени всё удваивается —
# 208 «комнат» вместо 104, силуэты ложатся друг на друга, работа делается дважды.
# Картинка при этом выглядит правильной, врут только счётчики.
_seen = set()
scenes = [(f"level{e['level']}", e['scene']) for e in groups[group]
          if not (e['scene'] in _seen or _seen.add(e['scene']))]
scenes = [(lvl, nm) for lvl, nm in scenes if os.path.exists(os.path.join(DATA, lvl))]
if not scenes:
    sys.exit(f'карта {MAP_ID}: ни одного levelN не нашлось в {DATA}')

sound_scenes = [lvl for lvl, nm in scenes if 'sound' in nm.lower()]
# Террейн весит десятки МБ и ничего из нужного не содержит.
geo_scenes = [lvl for lvl, nm in scenes if 'terrain' not in nm.lower()]

print(f'карта {MAP_ID} (группа {group}): сцен на диске {len(scenes)}, '
      f'звуковых {len(sound_scenes)} {sound_scenes}, геометрических {len(geo_scenes)}')

# ─────────────────────────────────────────────── чтение сцены

_ms_index = {}


def ms_index(fn):
    """MonoScript-ы внешнего файла: path_id -> объект (нужны, чтобы узнать имя класса)."""
    if fn not in _ms_index:
        try:
            e = UnityPy.load(os.path.join(DATA, fn))
            _ms_index[fn] = {o.path_id: o for o in e.objects if o.type.name == 'MonoScript'}
        except Exception:
            _ms_index[fn] = {}
    return _ms_index[fn]


_script_name = {}


def script_of(raw, ext, self_name):
    """Полное имя класса MonoBehaviour по сырому m_Script (typetree'ев нет — IL2CPP)."""
    fid = struct.unpack_from('<i', raw, 16)[0]
    pid = struct.unpack_from('<q', raw, 20)[0]
    key = (fid, pid, self_name if fid == 0 else '')
    if key in _script_name:
        return _script_name[key]
    fn = ext[fid - 1] if fid > 0 and fid - 1 < len(ext) else self_name
    nm = ''
    try:
        o = ms_index(fn).get(pid)
        if o is not None:
            tt = o.read_typetree()
            ns = tt.get('m_Namespace') or ''
            nm = (ns + '.' if ns else '') + (tt.get('m_ClassName') or '?')
    except Exception:
        nm = ''
    _script_name[key] = nm
    return nm


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
    return (vx + w * tx + y * tz - z * ty, vy + w * ty + z * tx - x * tz, vz + w * tz + x * ty - y * tx)


class Scene:
    """Индекс одной сцены: типтри-кэш, мировые TRS, дети, компоненты, пути в иерархии."""

    def __init__(self, level):
        self.level = level
        self.env = UnityPy.load(os.path.join(DATA, level))
        f = next(iter(self.env.files.values()))
        self.ext = [os.path.basename(x.path) for x in f.externals]
        self.objs = {o.path_id: o for o in self.env.objects}
        self._tt = {}
        self._trs = {}
        self.go_tr = {}
        self.go_comps = collections.defaultdict(list)
        self.go_name = {}
        for o in self.env.objects:
            if o.type.name != 'GameObject':
                continue
            t = o.read_typetree()
            self.go_name[o.path_id] = t['m_Name']
            for c in t['m_Component']:
                pid = c['component']['m_PathID']
                co = self.objs.get(pid)
                if co is None:
                    continue
                self.go_comps[o.path_id].append((co.type.name, pid))
                if co.type.name in ('Transform', 'RectTransform'):
                    self.go_tr[o.path_id] = pid
        self.children = collections.defaultdict(list)
        for go, trp in self.go_tr.items():
            self.children[self.parent_go(go)].append(go)

    def T(self, p):
        if p not in self._tt:
            self._tt[p] = self.objs[p].read_typetree()
        return self._tt[p]

    def parent_go(self, go):
        fa = self.T(self.go_tr[go])['m_Father']['m_PathID']
        return self.T(fa)['m_GameObject']['m_PathID'] if (fa and fa in self.objs) else None

    def trs(self, p):
        """Мировые позиция / кватернион / масштаб трансформа."""
        if p in self._trs:
            return self._trs[p]
        t = self.T(p)
        pp, r, s = t['m_LocalPosition'], t['m_LocalRotation'], t['m_LocalScale']
        lp = (pp['x'], pp['y'], pp['z'])
        lr = (r['x'], r['y'], r['z'], r['w'])
        ls = (s['x'], s['y'], s['z'])
        fa = t['m_Father']['m_PathID']
        if fa == 0 or fa not in self.objs:
            res = (lp, lr, ls)
        else:
            fp, fr, fs = self.trs(fa)
            rp = qrot(fr, (lp[0] * fs[0], lp[1] * fs[1], lp[2] * fs[2]))
            res = ((fp[0] + rp[0], fp[1] + rp[1], fp[2] + rp[2]),
                   qmul(fr, lr), (fs[0] * ls[0], fs[1] * ls[1], fs[2] * ls[2]))
        self._trs[p] = res
        return res

    def world(self, go):
        trp = self.go_tr.get(go)
        return self.trs(trp) if trp else ((0.0, 0.0, 0.0), (0.0, 0.0, 0.0, 1.0), (1.0, 1.0, 1.0))

    def path(self, go):
        parts, cur, guard = [], go, 0
        while cur is not None and guard < 64:
            parts.append(self.go_name.get(cur, '?'))
            guard += 1
            if cur not in self.go_tr:
                break
            cur = self.parent_go(cur)
        return '/'.join(reversed(parts))

    def monos(self, want):
        """(raw, go) всех MonoBehaviour с именем класса из want."""
        for o in self.env.objects:
            if o.type.name != 'MonoBehaviour':
                continue
            try:
                raw = o.get_raw_data()
            except Exception:
                continue
            if len(raw) < 28:
                continue
            if script_of(raw, self.ext, self.level) not in want:
                continue
            yield raw, struct.unpack_from('<q', raw, 4)[0]

    def box_collider(self, go):
        for tn, pid in self.go_comps.get(go, []):
            if tn == 'BoxCollider':
                b = self.T(pid)
                sc = self.world(go)[2]
                return dict(size=[round(b['m_Size']['x'] * sc[0], 3),
                                  round(b['m_Size']['y'] * sc[1], 3),
                                  round(b['m_Size']['z'] * sc[2], 3)],
                            center=[round(b['m_Center'][k], 3) for k in 'xyz'])
        return None


# ─────────────────────────────────────────────── комнаты: разбор payload сигнатурой

def parse_room(raw):
    """[volume][aabbC xyz][aabbE xyz][count:int]{[c xyz][q xyzw][half xyz]}*count — смещение сканом."""
    n = (len(raw) - 28) // 4
    if n < 20:
        return None
    f = struct.unpack_from('<%df' % n, raw, 28)
    I = struct.unpack_from('<%di' % n, raw, 28)
    best = None
    for i in range(0, n - 17):
        cnt = I[i + 7]
        if not (1 <= cnt <= 64) or i + 8 + cnt * 10 > n:
            continue
        ac, ae = f[i + 1:i + 4], f[i + 4:i + 7]
        if not all(0 <= v < 5000 for v in ae) or not all(abs(v) < 6000 for v in ac):
            continue
        boxes, ok = [], True
        for b in range(cnt):
            j = i + 8 + b * 10
            c, q, h = f[j:j + 3], f[j + 3:j + 7], f[j + 7:j + 10]
            if abs(sum(v * v for v in q) - 1.0) > 1e-3 or not all(0 <= v < 5000 for v in h):
                ok = False
                break
            if not all(abs(c[k] - ac[k]) <= ae[k] + 0.5 for k in range(3)):
                ok = False
                break
            boxes.append(dict(c=[round(v, 3) for v in c], q=[round(v, 6) for v in q],
                              h=[round(v, 3) for v in h]))
        if ok:
            best = dict(volume=round(f[i], 2), center=[round(v, 3) for v in ac],
                        extent=[round(v, 3) for v in ae], boxes=boxes)
    return best


PORTAL_NAME = re.compile(r'FROM_(.+?)_TO_(.+)$')

t0 = time.time()
rooms, portals = [], []
for lvl in sound_scenes:
    sc = Scene(lvl)
    miss = 0
    for raw, go in sc.monos(ROOM_SCRIPTS):
        sh = parse_room(raw)
        if sh is None:
            miss += 1
            continue
        rooms.append(dict(scene=lvl, name=sc.go_name.get(go), path=sc.path(go), **sh))
    for raw, go in sc.monos(PORTAL_SCRIPTS):
        pos, rot, scl = sc.world(go)
        nm = sc.go_name.get(go) or ''
        m = PORTAL_NAME.search(nm)
        portals.append(dict(scene=lvl, name=nm, path=sc.path(go),
                            pos=[round(v, 3) for v in pos], rot=[round(v, 6) for v in rot],
                            size=[round(abs(scl[0]), 3), round(abs(scl[1]), 3)],
                            **({'from': m.group(1), 'to': m.group(2)} if m else {})))
    print(f'  {lvl}: комнат {len([r for r in rooms if r["scene"] == lvl])} '
          f'(боксов {sum(len(r["boxes"]) for r in rooms if r["scene"] == lvl)}), '
          f'проёмов {len([p for p in portals if p["scene"] == lvl])}'
          + (f', НЕ РАЗОБРАНО комнат {miss}' if miss else ''))
    if miss:
        print(f'  !! {lvl}: {miss} SpatialAudioRoom не разобрались — байтовый формат мог поехать')

# ─────────────────────────────────────────────── геометрические сцены

doors, exits, indoor, buildings = [], [], [], []
_mesh_aabb, _ext_cache = {}, {}


def ext_objects(sc, fid):
    if fid == 0:
        return sc.objs
    fn = sc.ext[fid - 1] if 0 < fid <= len(sc.ext) else None
    if fn is None:
        return {}
    if fn not in _ext_cache:
        try:
            e = UnityPy.load(os.path.join(DATA, fn))
            _ext_cache[fn] = {o.path_id: o for o in e.objects if o.type.name == 'Mesh'}
        except Exception:
            _ext_cache[fn] = {}
    return _ext_cache[fn]


def mesh_aabb(sc, pptr):
    """m_LocalAABB меша: (центр, полуразмер). Вершины не читаем — Unity уже посчитала."""
    fid, pid = pptr['m_FileID'], pptr['m_PathID']
    key = (sc.ext[fid - 1] if 0 < fid <= len(sc.ext) else sc.level, pid)
    if key in _mesh_aabb:
        return _mesh_aabb[key]
    r = None
    try:
        o = ext_objects(sc, fid).get(pid)
        if o is not None and o.type.name == 'Mesh':
            a = o.read_typetree()['m_LocalAABB']
            r = ((a['m_Center']['x'], a['m_Center']['y'], a['m_Center']['z']),
                 (a['m_Extent']['x'], a['m_Extent']['y'], a['m_Extent']['z']))
    except Exception:
        r = None
    _mesh_aabb[key] = r
    return r


def subtree(sc, go):
    st, out = [go], []
    while st:
        g = st.pop()
        out.append(g)
        st.extend(sc.children.get(g, []))
    return out


def subtree_aabb(sc, go):
    """Мировой AABB всех мешей поддерева. Возвращает (lo, hi, число мешей)."""
    lo, hi, nm = [1e9] * 3, [-1e9] * 3, 0
    for g in subtree(sc, go):
        name = sc.go_name.get(g) or ''
        if any(s in name for s in SKIP_MESH_NAMES):
            continue
        mf = [pid for tn, pid in sc.go_comps.get(g, []) if tn == 'MeshFilter']
        if not mf:
            continue
        a = mesh_aabb(sc, sc.T(mf[0])['m_Mesh'])
        if a is None:
            continue
        (cx, cy, cz), (ex, ey, ez) = a
        pos, rot, s = sc.world(g)
        for sx in (-1, 1):
            for sy in (-1, 1):
                for sz in (-1, 1):
                    r = qrot(rot, ((cx + sx * ex) * s[0], (cy + sy * ey) * s[1], (cz + sz * ez) * s[2]))
                    for i, v in enumerate((pos[0] + r[0], pos[1] + r[1], pos[2] + r[2])):
                        lo[i] = min(lo[i], v)
                        hi[i] = max(hi[i], v)
        nm += 1
    return lo, hi, nm


for lvl in geo_scenes:
    if lvl in sound_scenes:
        continue          # звуковую сцену уже прочли выше; дверей и зданий в ней нет
    try:
        sc = Scene(lvl)
    except Exception as e:
        print(f'  {lvl}: ОШИБКА чтения сцены — {e}')
        continue
    nd = ne = ni = nb = 0
    for raw, go in sc.monos(DOOR_SCRIPTS):
        pos = sc.world(go)[0]
        strs = [m.group().decode('ascii', 'replace') for m in ASCII_RUN.finditer(raw)]
        key = next((x for x in strs if HEX24.match(x)), None)
        ident = next((x for x in strs if (x.startswith('door') or '_' in x) and not HEX24.match(x)), None)
        doors.append(dict(scene=lvl, id=ident, keyId=key, pos=[round(v, 3) for v in pos],
                          go=sc.go_name.get(go), path=sc.path(go)))
        nd += 1
    for raw, go in sc.monos(EXIT_SCRIPTS):
        pos, rot, scl = sc.world(go)
        strs = [m.group().decode('ascii', 'replace') for m in ASCII_RUN.finditer(raw[28:])]
        exits.append(dict(scene=lvl, name=sc.go_name.get(go), path=sc.path(go),
                          label=strs[0] if strs else None, pos=[round(v, 3) for v in pos],
                          box=sc.box_collider(go)))
        ne += 1
    for raw, go in sc.monos(INDOOR_SCRIPTS):
        pos = sc.world(go)[0]
        indoor.append(dict(scene=lvl, name=sc.go_name.get(go), path=sc.path(go),
                           pos=[round(v, 3) for v in pos], box=sc.box_collider(go)))
        ni += 1
    # здания: прямые дети узлов BUILDING/BUILDINGS (их всегда единицы-десятки, не тысячи)
    for node in [g for g, n in sc.go_name.items() if n in BUILDING_NODES]:
        kids = sc.children.get(node, []) or [node]
        for k in kids:
            lo, hi, nmesh = subtree_aabb(sc, k)
            if nmesh == 0:
                continue
            area = (hi[0] - lo[0]) * (hi[2] - lo[2])
            nm_k = (sc.go_name.get(k) or '').lower()
            if not (BUILDING_MIN_AREA <= area <= BUILDING_MAX_AREA):
                continue
            if any(t in nm_k for t in BUILDING_SKIP_NAME):
                continue
            buildings.append(dict(scene=lvl, name=sc.go_name.get(k), path=sc.path(k), meshes=nmesh,
                                  min=[round(v, 2) for v in lo], max=[round(v, 2) for v in hi]))
            nb += 1
    if nd or ne or ni or nb:
        print(f'  {lvl}: двери {nd}, выходы {ne}, indoor {ni}, здания {nb}')

# ─────────────────────────────────────────────── запись и смоук-тест

counts = dict(rooms=len(rooms), boxes=sum(len(r['boxes']) for r in rooms), portals=len(portals),
              doors=len(doors), doorsWithKey=sum(1 for d in doors if d['keyId']),
              exits=len(exits), indoor=len(indoor), buildings=len(buildings))

out = dict(map=MAP_ID, group=group, generated=time.strftime('%Y-%m-%dT%H:%M:%S'),
           source=DATA, soundScenes=sound_scenes, geoScenes=geo_scenes, counts=counts,
           rooms=rooms, portals=portals, doors=doors, exits=exits, indoor=indoor,
           buildings=buildings)
out_path = os.path.join(OUTDIR, f'{MAP_ID}-rooms.json')
json.dump(out, open(out_path, 'w', encoding='utf-8'), ensure_ascii=False)

print(f'\nитого: комнат {counts["rooms"]} (боксов {counts["boxes"]}), проёмов {counts["portals"]}, '
      f'дверей {counts["doors"]} (с ключом {counts["doorsWithKey"]}), выходов {counts["exits"]}, '
      f'indoor {counts["indoor"]}, зданий {counts["buildings"]}')
print(f'записано: {out_path}  ({os.path.getsize(out_path) / 1e6:.1f} МБ, {time.time() - t0:.1f} с)')

exp = EXPECT.get(MAP_ID)
if not exp:
    print(f'смоук-тест: эталонных счётчиков для карты {MAP_ID} нет — сверять не с чем')
    sys.exit(0)
bad = {k: (v, counts[k]) for k, v in exp.items() if counts[k] != v}
if bad:
    print('\n!!! СМОУК-ТЕСТ ПРОВАЛЕН — счётчики разошлись с эталоном:')
    for k, (want, got) in bad.items():
        print(f'!!!   {k}: ожидалось {want}, получено {got}')
    print('!!! Скорее всего патч BSG сдвинул байтовый формат или состав сцен. Данные НЕ доверять.')
    sys.exit(1)
print('смоук-тест: счётчики совпали с эталоном ' + ', '.join(f'{k}={v}' for k, v in exp.items()))
