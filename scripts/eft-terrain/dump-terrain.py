# Дамп Unity TerrainData карты EFT прямо из клиента — без Unity и без AssetRipper.
# Заменяет batch-экспортёр TerrainExporter.cs: пишет байт-в-байт тот же формат.
#
# Вход:  sharedassetsN.assets (сами TerrainData) + levelN (иерархия сцены с позициями слайсов)
# Выход: <outdir>/<map>-terrain.bin  — имя, мировая позиция, size, res, высоты 0..1 [row=Z][col=X]
#        <outdir>/splat_<terrain>.bin — aw/ah/al, имена слоёв, веса 0..1 [row][col][layer]
#
# Запуск: python scripts/eft-terrain/dump-terrain.py <sharedassets> <level> <outdir> <map> [флаги...]
#         orient-override  — снимает отказ по «зеркало ложится лучше»
#                            (проверка ориентации статистическая; сверили с растром глазами —
#                            можно продавить).
#         with-neighbours  — забрать и соседние слайсы общей мировой сетки EFT: ноды, чей
#                            TerrainData лежит в ЧУЖОМ sharedassets (у Маяка — 140 и 25).
#                            Позиции всё равно берутся из иерархии поданного levelN, поэтому
#                            контроль сетки остаётся тем же. Без флага такие ноды, как и
#                            раньше, только печатаются строкой лога — поведение по умолчанию
#                            не меняется байт-в-байт (D08).
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
FLAGS = {'orient-override', 'with-neighbours'}
flags = set(sys.argv[5:])
unknown = flags - FLAGS
if unknown:
    sys.exit(f'ОТКАЗ: неизвестные флаги {", ".join(sorted(unknown))}; '
             f'допустимы {", ".join(sorted(FLAGS))}')
orient_override = 'orient-override' in flags
with_neighbours = 'with-neighbours' in flags
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
ORIENT_MIN = 0.005         # ниже этого лучший из баллов — шум: вердикта нет ни в одну сторону
ORIENT_MARGIN = 1.2        # во сколько раз победившая ориентация должна обыгрывать проигравшую
                           # (порог симметричен: и для «подтверждена», и для «зеркало лучше»)
# Фатальный вердикт стоит дороже предупреждения, поэтому от балла зеркала требуется не «коснуться»
# ORIENT_MIN, а обойти его тем же запасом. Иначе при mine <= 0 множитель применяется к нулю
# и вся защита сводится к одному ORIENT_MIN: 0.0041 проезжает, 0.0051 роняет конвейер в .bad,
# хотя разница внутри погрешности порога, откалиброванного на одной карте.
# ⚠️ ORIENT_MIRROR_MIN обязан остаться ПРОИЗВОДНЫМ от ORIENT_MIN. На этом стоит честность
# проверки check-orientation-gate.py: она сдвигает ORIENT_MIN и ждёт, что фатальный порог
# уедет вместе с ним. Зашитое сюда число оставит проверку зелёной, но проверять она будет
# уже не тот код.
ORIENT_MIRROR_MIN = ORIENT_MIN * ORIENT_MARGIN

written = errors = 0
drop_name = drop_layers = drop_nonode = 0
weak_orient = mirror_orient = 0
mirror_axes = []           # (имя слайса, победившая ось) — сводка обязана назвать ТУ ось
slice_scores = []          # (имя, баллы 4 гипотез) — для вердикта ориентации ПО КАРТЕ
grid_res = []              # (имя, невязка X, невязка Z) — для контроля сетки ПО КАРТЕ
GRID_TOL = 1.0             # м: разброс невязок, внутри которого сетка считается целой
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
    Внешние .assets EFT лежат в одном каталоге с sharedassets, ищем там.

    ⚠️ ВТОРАЯ КОПИЯ ЭТОГО ПРАВИЛА — `proto_name()` в `extract-vegetation.py` (виды
    растительности у Маяка лежат в чужих sharedassets). Правишь разбор `m_FileID`/externals
    или политику отказа здесь — открой и её: расхождение копий уже стоило одного бага
    (виды схлопывались в `proto_<pathID>`). В общий модуль не сводим осознанно: это пачка
    автономных скриптов, а не библиотека; поводом станет третий потребитель."""
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


def layer_names(layer_ptrs, tname, owner):
    """Имя слоя = имя diffuse-текстуры (как в TerrainExporter.cs).
    build-material.py сопоставляет семейства палитры ПО ИМЕНАМ — заглушку '?' в шов не пишем,
    а подстановку имени TerrainLayer (microsplat_layer_…) считаем и выносим в итог.
    `owner` — файл, В КОТОРОМ лежит сам TerrainData: у соседнего слайса это не поданный
    sharedassets, и его m_FileID считаются по ЕГО таблице externals, а не по нашей."""
    out = []
    for i, p in enumerate(layer_ptrs):
        what = f'{tname}: слой {i}'
        lo, lfile = resolve(p, owner, what)
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
        # Выброс на шаг квантования выше делителя ≠ другая нормализация. У Леса (Slice_1_3)
        # таких значений 9 из 1 050 625 (0.0009 %), а хвост распределения гладкий:
        # 32764:3, 32765:1, 32766:4, 32767:9 — это край int16, а не иной масштаб. Отличаем
        # ДОЛЕЙ, а не порогом по максимуму: при другой нормализации выше делителя оказалась бы
        # заметная часть карты, а не девять точек.
        if lo < 0 or hi > 32767:
            raise Fatal(f'{tname}: сырые высоты [{lo},{hi}] вне int16 — формат не тот')
        if hi > HEIGHT_DIV:
            n_over = int((raw > HEIGHT_DIV).sum())
            frac = n_over / raw.size
            if frac > 1e-4:
                raise Fatal(f'{tname}: выше делителя {HEIGHT_DIV:.0f} лежит {n_over} значений '
                            f'({frac * 100:.3f} %) — это другая нормализация, а не выбросы')
            print(f'  ! {tname}: {n_over} значений ({frac * 100:.4f} %) на шаг выше делителя '
                  f'{HEIGHT_DIV:.0f} — подрезаю до 1.0', flush=True)
        h = np.clip(raw.astype(np.float64) / HEIGHT_DIV, 0.0, 1.0).astype(np.float32)
    return h.reshape(res, res)


def alphamaps(tex_ptrs, al, tname, owner):
    """RGBA-текстуры → веса float32 (ah, aw, al). Текстура i, канал c → слой i*4+c.
    Unity хранит строки снизу вверх, UnityPy отдаёт картинку сверху вниз → разворот."""
    need = -(-al // 4)
    if len(tex_ptrs) < need:
        raise Fatal(f'{tname}: слоёв {al} → нужно {need} alpha-текстур, '
                    f'в m_AlphaTextures их {len(tex_ptrs)}')
    planes = []
    for i in range(need):
        o, _ = resolve(tex_ptrs[i], owner, f'{tname}: alpha-текстура {i}')
        planes.append(np.array(o.read().image.convert('RGBA'))[::-1])
    ah, aw = planes[0].shape[:2]
    for i, pl in enumerate(planes):
        if pl.shape[:2] != (ah, aw):
            raise Fatal(f'{tname}: alpha-текстура {i} имеет размер {pl.shape[:2]}, а не {(ah, aw)}')
    a = np.zeros((ah, aw, al), np.float32)
    for l in range(al):
        a[:, :, l] = planes[l // 4][:, :, l % 4].astype(np.float32) / 255.0
    return a, aw, ah


def decimate_to_alpha(h, aw, ah):
    """Высоты в ТЕХ ЖЕ мировых точках, что центры ячеек splat. Отдельная функция, потому что
    это единственное место, где сравнение ориентации может разъехаться пространственно.

    Вывод: ячейка splat j из aw покрывает долю [j/aw, (j+1)/aw] стороны тайла, её центр —
    (j+0.5)/aw; сетка высот кладёт res отсчётов на ту же сторону с шагом 1/(res-1), значит центр
    ячейки в отсчётах высот = (j+0.5)*(res-1)/aw. При aw == res-1 это j+0.5 → отсчёт j, то есть
    тождество (все виденные карты); на любой другой сетке формула реально прореживает.
    Проверяется check-orientation-gate.py на res=9/aw=4, где ответ [1,3,5,7] выводится вручную:
    и потерянные +0.5, и res вместо res-1 дают там другие индексы."""
    res = h.shape[0]
    iy = np.minimum(((np.arange(ah) + 0.5) * (res - 1) / ah).astype(int), res - 1)
    ix = np.minimum(((np.arange(aw) + 0.5) * (res - 1) / aw).astype(int), res - 1)
    return h[np.ix_(iy, ix)].astype(np.float64)


def orientation_note(a, h, tname):
    """Взаимная ориентация splat и высот — БЕЗ эталона.
    Границы материалов (дороги, скальные пятна, отсыпки) лежат по форме рельефа, поэтому
    у верной ориентации корреляция «край доминирующего слоя ~ уклон + кривизна» заметно выше,
    чем у зеркальной. На Таможне верный вариант обыгрывает зеркало по Z в 2.2 раза.
    Высоты берутся В ТЕХ ЖЕ мировых точках, что и ячейки splat (децимация res → aw/ah):
    без этого сравнивались бы пространственно несовпадающие массивы и запас ничего не значил бы.

    Порядок проверок — сперва шумовой гейт, потом дуэль. Обратный порядок ронял прогон
    на плоском или морском слайсе: там оба балла — шум, зеркало выигрывает случайно,
    и `.bin` уезжал в `.bad` без содержательной причины. Утверждение выносится ТОЛЬКО когда
    сигнал выше ORIENT_MIN и разрыв выходит за ORIENT_MARGIN — и это одинаково строго
    для «подтверждена» и для «зеркало лучше». Между порогами — weak, то есть предупреждение.
    Возвращает (строка для лога, вердикт: ok | weak | mirror, победившая ось или None,
    словарь баллов всех четырёх гипотез). Баллы нужны вердикту ПО КАРТЕ: ориентация хранения
    splat — свойство формата, а не слайса, поэтому решение принимается по сумме, а не поштучно.
    Ось нужна сводке: чинить придётся именно ту симметрию, которая выиграла, — на Берегу это
    «зеркало по X», и спутать её с зеркалом по Z у потребителей будет дорого."""
    ah, aw, _ = a.shape
    res = h.shape[0]
    if ah > res or aw > res or min(ah, aw) < 8:
        return ('ориентация=НЕ ВЕРИФИЦИРОВАНА (splat подробнее высот, сравнивать нечем)',
                'weak', None, {})
    # Формула общая; при aw == ah == res-1 (все карты, виденные до сих пор) она вырождается
    # в тождество. Карта, которая её оживит, обязана быть видна в логе, а не проехать молча.
    if aw != res - 1 or ah != res - 1:
        print(f'  ВНИМАНИЕ {tname}: splat {aw}x{ah} при res={res} — на этой карте децимация '
              f'res -> alpha впервые НЕ тождественна: на одну ячейку splat приходится '
              f'{(res - 1) / aw:.3f} шага высот по X и {(res - 1) / ah:.3f} по Z. Вердикт '
              f'ориентации ниже посчитан на прореженной выборке, поэтому карту материала '
              f'этой локации надо сверить с растром глазами.')
    hh = decimate_to_alpha(h, aw, ah)
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
    duel = f'как есть {mine:.4f} против «{rival_key}» {rival:.4f}'

    def margin(top, low, digits=1):
        """Во сколько раз выигравший балл обходит проигравший. Отрицательный балл — не сигнал
        «против», а шум с минусом, поэтому проигравший поднимается до нуля и делить нечего.
        У вердикта mirror знаков больше: он роняет прогон, и «1.2x при пороге 1.2x» должно
        читаться как 1.25, а не как монетка."""
        return (f'{top / low:.{digits}f}x' if low > 1e-12
                else 'бесконечный (проигравший в минусе)')

    # Сила сигнала — ЛУЧШИЙ из баллов: если ни одна ориентация не набрала корреляции,
    # утверждать нечего ни в одну сторону. Этот гейт стоит ПЕРВЫМ.
    signal = max(mine, rival)
    if signal < ORIENT_MIN:
        return (f'ориентация=НЕ ВЕРИФИЦИРОВАНА (сигнал слаб: {duel}, лучший балл {signal:.4f} '
                f'ниже порога {ORIENT_MIN} — рельеф плоский или материал однороден; '
                f'сверить с растром карты вручную)', 'weak', None, s)
    mine_p, rival_p = max(mine, 0.0), max(rival, 0.0)
    if rival_p > ORIENT_MARGIN * mine_p:
        if rival_p <= ORIENT_MIRROR_MIN:
            # зеркало впереди, но его собственный балл едва отличим от шума — на таком
            # основании конвейер не роняем, это предупреждение
            return (f'ориентация=НЕ ВЕРИФИЦИРОВАНА (зеркало впереди, но само слабо: {duel}, '
                    f'балл зеркала {rival_p:.4f} не обошёл {ORIENT_MIRROR_MIN:.4f} '
                    f'= {ORIENT_MIN} x {ORIENT_MARGIN}) — сверить материал с растром карты',
                    'weak', rival_key, s)
        return (f'ориентация=ЗЕРКАЛО ЛОЖИТСЯ ЛУЧШЕ: {duel} '
                f'(запас зеркала {margin(rival_p, mine_p, 2)} при пороге {ORIENT_MARGIN}x, '
                f'балл зеркала {rival_p:.4f} > {ORIENT_MIRROR_MIN:.4f})', 'mirror', rival_key, s)
    if mine_p > ORIENT_MARGIN * rival_p:
        return (f'ориентация=подтверждена (запас {margin(mine_p, rival_p)}, {duel})', 'ok', None, s)
    return (f'ориентация=НЕ ВЕРИФИЦИРОВАНА (запас мал: {duel}, разрыв {margin(signal, min(mine_p, rival_p))} '
            f'не дотянул до {ORIENT_MARGIN}x) — сверить материал с растром карты',
            'weak', rival_key, s)


# --- очередь дампа: свой файл, при флаге — плюс соседи общей сетки ---------------
# Задание — пара (объект TerrainData, файл-владелец). Владелец нужен дальше: m_FileID внутри
# TerrainData считаются по таблице externals ЕГО файла, а не поданного sharedassets.
jobs = [(o, shared_base)
        for o in sorted((x for x in objs.values() if x.type.name == 'TerrainData'),
                        key=lambda x: x.path_id)]
neighbour_refs = sorted({n['ref'] for n in nodes if n['ref'][0] != shared_base})
if with_neighbours:
    for fname, pid in neighbour_refs:
        p = os.path.join(shared_dir, fname)
        if not os.path.exists(p):
            sys.exit(f'ОТКАЗ: соседний слайс просит {fname}, рядом с {shared_base} его нет')
        if fname not in _files:
            print(f'  подгружен внешний файл ассетов: {fname} (соседние слайсы общей сетки)')
        f_objs, _ = load_assets(p)
        fo = f_objs.get(pid)
        if fo is None:
            sys.exit(f'ОТКАЗ: соседний слайс {nodes_by_ref[(fname, pid)]["name"]}: '
                     f'TerrainData pathID={pid} не найден в {fname}')
        if fo.type.name != 'TerrainData':
            sys.exit(f'ОТКАЗ: {fname}#{pid} — не TerrainData, а {fo.type.name}')
        jobs.append((fo, fname))
    print(f'флаг with-neighbours: добрано соседних слайсов {len(neighbour_refs)} '
          f'из {", ".join(sorted({f for f, _ in neighbour_refs}))}')
elif neighbour_refs:
    print(f'соседних слайсов общей сетки в сцене {len(neighbour_refs)} — пропущены '
          f'(добрать: пятым аргументом with-neighbours)')

# --- дамп ---------------------------------------------------------------------
terrain_path = f'{outdir}/{map_id}-terrain.bin'
accounted_refs, made_splats = set(), []
neighbours_written = 0
out = open(terrain_path, 'wb')
try:
    for o, owner in jobs:
        d = o.read_typetree()
        name = d.get('m_Name') or f'TerrainData_{o.path_id}'
        hm = d['m_Heightmap']
        sd = d.get('m_SplatDatabase', {})
        layer_ptrs = sd.get('m_TerrainLayers') or []

        # сперва привязка к сцене: имя ноды и имя TerrainData совпадают не всегда
        # (у Леса нода TerrainGrass_2_4 указывает на TerrainData AITerrainGrass_2_4)
        node = nodes_by_ref.get((owner, o.path_id))
        if node is not None:
            bind = f'привязка=по ссылке {owner}#{o.path_id}'
        else:
            node = nodes_by_name.get(name)
            bind = (f'привязка=ПО ИМЕНИ (ссылки на {owner}#{o.path_id} '
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
        names = layer_names(layer_ptrs, node['name'], owner)
        a, aw, ah = alphamaps(sd.get('m_AlphaTextures') or [], al, node['name'], owner)
        orient, verdict, orient_axis, orient_scores = orientation_note(a, h, node['name'])
        if verdict == 'weak':
            weak_orient += 1
        elif verdict == 'mirror':
            mirror_orient += 1
            mirror_axes.append((node['name'], orient_axis))
        if orient_scores:
            slice_scores.append((node['name'], orient_scores))

        # Контроль привязки: Slice_<ряд>_<кол> → x=(кол-1)*700, z=(ряд-1)*700 от корня.
        # Проверяется ОТНОСИТЕЛЬНАЯ структура, а не абсолютный якорь: имена слайсов адресуют
        # ОБЩУЮ мировую сетку EFT, а корень группы у карты свой, поэтому карта целиком может
        # быть сдвинута относительно формулы. У Леса все четыре слайса промахиваются на ОДИН
        # И ТОТ ЖЕ вектор (2152.7, 959.1), а шаг между ними ровно 700 м — сетка цела, просто
        # якорь другой. Разъезд слайсов ОТНОСИТЕЛЬНО ДРУГ ДРУГА — вот это ошибка, и её
        # видно только после прохода по всем нодам (вывод ниже, после цикла).
        m = SLICE_NAME.match(node['name'])
        grid_note = 'сетка=имя без ряда/колонки'
        if m:
            row, col = int(m.group(1)), int(m.group(2))
            ex = node['root'][0] + (col - 1) * GRID_STEP
            ez = node['root'][2] + (row - 1) * GRID_STEP
            grid_res.append((node['name'], px - ex, pz - ez))
            grid_note = f'сетка=ряд {row}, кол {col} (невязка к формуле ниже, по всей карте)'

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
        if owner != shared_base:
            print(f'  соседний слайс общей сетки: данные из {owner}, позиция из '
                  f'{os.path.basename(level_path)}')
            neighbours_written += 1
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

print(f'\nготово: {written} террейнов (из них соседних слайсов {neighbours_written}); '
      f'нод сцены {len(nodes)}, из них в чужих файлах пропущено {foreign} -> {terrain_path}')
print(f'отброшено: по AI-имени {drop_name}, по layers == 0 {drop_layers}, '
      f'без ноды в сцене {drop_nonode} (одна запись может попасть в оба первых счётчика)')
if layer_fallbacks:
    print(f'ВНИМАНИЕ: слоёв без diffuse-текстуры {len(layer_fallbacks)} '
          f'({", ".join(layer_fallbacks[:6])}) — build-material.py сопоставляет семейства '
          f'по именам, эти слои уедут в дефолтное семейство')
# --- контроль сетки: ОТНОСИТЕЛЬНАЯ структура, а не абсолютный якорь -----------
if grid_res:
    rx = [r[1] for r in grid_res]
    rz = [r[2] for r in grid_res]
    spread = max(max(rx) - min(rx), max(rz) - min(rz))
    shift = (sum(rx) / len(rx), sum(rz) / len(rz))
    if spread <= GRID_TOL:
        if abs(shift[0]) > GRID_TOL or abs(shift[1]) > GRID_TOL:
            print(f'СЕТКА: все {len(grid_res)} слайсов смещены относительно формулы на ОДИН '
                  f'и тот же вектор ({shift[0]:.1f},{shift[1]:.1f}) м, разброс {spread:.2f} м '
                  f'— шаг между слайсами цел, у карты просто свой якорь. Это не ошибка: '
                  f'боевые позиции берутся из иерархии, формула — только контроль.')
        else:
            print(f'СЕТКА: все {len(grid_res)} слайсов на формуле, разброс {spread:.2f} м')
    else:
        print(f'ОШИБКА СЕТКИ: невязки слайсов расходятся между собой на {spread:.1f} м '
              f'(допуск {GRID_TOL} м) — слайсы разъехались ОТНОСИТЕЛЬНО ДРУГ ДРУГА, '
              f'а это уже не смещение якоря:')
        for n, dx, dz in grid_res:
            print(f'    {n:16s} невязка ({dx:9.1f},{dz:9.1f}) м')
        errors += len(grid_res)

# --- вердикт ориентации splat: ОДИН НА КАРТУ ---------------------------------
# Ориентация ХРАНЕНИЯ splat — свойство формата (версии Unity), а не отдельного слайса:
# внутри одной карты она обязана быть одинаковой. Поэтому вердикт выносится по СРЕДНЕМУ
# баллу всех слайсов, а не поштучно. У Леса три слайса из четырёх уверенно дают «как есть»
# (запасы 1.6x, 1.5x, 3.6x), а один — «зеркало по Z» с запасом 2.2x; поштучный отказ ронял
# прогон из-за одного слайса, тогда как сумма по карте говорит обратное. Агрегат не ослабляет
# защиту, а усиливает: настоящее зеркало проявилось бы на ВСЕХ слайсах сразу.
if slice_scores:
    keys = list(slice_scores[0][1])
    avg = {k: sum(max(sc.get(k, 0.0), 0.0) for _, sc in slice_scores) / len(slice_scores)
           for k in keys}
    mine = avg.get('как есть', 0.0)
    rival_key = max((k for k in avg if k != 'как есть'), key=lambda k: avg[k])
    rival = avg[rival_key]
    duel = (f'по карте ({len(slice_scores)} слайсов): как есть {mine:.4f} против '
            f'«{rival_key}» {rival:.4f}')
    if max(mine, rival) < ORIENT_MIN:
        print(f'ВНИМАНИЕ: ориентация splat НЕ ВЕРИФИЦИРОВАНА — {duel}, сигнал ниже '
              f'{ORIENT_MIN}: сверить карту материала с растром глазами')
    elif rival > ORIENT_MARGIN * mine and rival > ORIENT_MIRROR_MIN:
        if orient_override:
            print(f'ВНИМАНИЕ: {duel} — зеркало ложится лучше; отказ снят флагом orient-override')
        else:
            print(f'ОШИБКА: {duel} — зеркало ложится на рельеф ЛУЧШЕ прямой ориентации '
                  f'по КАРТЕ ЦЕЛИКОМ; материал отражён по оси: {rival_key}')
            errors += 1
    elif mine > ORIENT_MARGIN * rival:
        print(f'ОРИЕНТАЦИЯ: подтверждена по карте ({mine / max(rival, 1e-12):.1f}x), {duel}')
    else:
        print(f'ВНИМАНИЕ: ориентация splat не подтверждена по карте (запас мал), {duel} — '
              f'сверить карту материала с растром глазами')
    if mirror_orient:
        where = '; '.join(f'{n} -> {ax}' for n, ax in mirror_axes)
        print(f'  слайсов-диссидентов {mirror_orient} из {len(slice_scores)} ({where}) — '
              f'учтены в среднем, отдельного вердикта не выносят')
if weak_orient:
    print(f'ВНИМАНИЕ: ориентация splat не подтверждена у {weak_orient} террейнов поштучно — '
          f'вердикт по карте выше')
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
