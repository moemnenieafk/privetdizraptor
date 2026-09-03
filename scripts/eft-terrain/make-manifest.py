# Синтез manifest.json карты из EFT_MAP_CONFIG — фолбэк, когда растра карты нет.
#
# Штатно манифест пишет scripts/fetch-tiles.mjs, но он умеет только карты с тайлами
# в maps.json the-hideout. У части карт (Маяк) тайлов там нет — есть только SVG,
# и fetch-tiles.mjs честно отвечает «карта не найдена». Тогда четыре поля, которые
# реально читают terrain-скрипты (boundsFromConfig, coordinateRotation,
# crop.width, crop.height), берутся из нашего же src/data/eft-map-config.ts.
#
# Три отказа вместо тихой порчи данных (все — до записи, с ненулевым кодом возврата):
#   1. bounds не в игровых метрах: у карты есть tileBase/staticMap/worldTransform
#      (промоут на тайлы) или начало границ ровно [0,0] без отрицательных координат
#      (canvas/SVG). Размер границ — только дополнительный сигнал, сам не блокирует;
#   2. каталог карты называется на диске иначе, чем ключ в конфиге (labyrinth ↔
#      the-labyrinth) — иначе рядом с эталоном вырос бы синтетический двойник;
#   3. на месте уже лежит манифест без "synthetic": true — это эталон, собранный
#      из настоящего растра, он не перезаписывается ни при каком исходе.
#
# Вход:  src/data/eft-map-config.ts (только читается), ключ карты
# Выход: <outdir>/<map>/manifest.json того же формата, что у fetch-tiles.mjs,
#        плюс честные "synthetic": true и "source": "EFT_MAP_CONFIG"
#
# Запуск: python scripts/eft-terrain/make-manifest.py <map> <outdir> [longSide=16384]
#   пример: python scripts/eft-terrain/make-manifest.py lighthouse D:/Games/raster

import sys, os, json, re
from datetime import datetime, timezone

if len(sys.argv) < 3:
    sys.exit('использование: python scripts/eft-terrain/make-manifest.py <map> <outdir> [longSide=16384]')

map_id = sys.argv[1]
outroot = sys.argv[2]
LONG_SIDE = int(sys.argv[3]) if len(sys.argv) > 3 else 16384

# Путь к конфигу — от корня репозитория (скрипт лежит в scripts/eft-terrain/).
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CFG = os.path.join(REPO, 'src', 'data', 'eft-map-config.ts')

src = open(CFG, encoding='utf-8').read()

# ─────────────────────────────────────────── мини-разбор TS-объекта
# Полноценный парсер не нужен, но regex недостаточно: в конфиге есть комментарии
# со словом bounds (блок factory), URL-ы с // внутри строк и пути тайлов вида
# "…/{z}/{x}/{y}.jpg" — последние собьют любой счётчик скобок, если не пропускать
# строковые литералы. Поэтому всё ниже строкам не верит и проходит их целиком.

QUOTES = chr(34) + chr(39) + chr(96)   # " ' `
BSL = chr(92)


def skip_string(text, i):
    """Индекс сразу за закрывающим литералом; text[i] — открывающая кавычка."""
    q = text[i]
    i += 1
    while i < len(text):
        c = text[i]
        if c == BSL:
            i += 2
            continue
        if c == q:
            return i + 1
        i += 1
    raise SystemExit('незакрытый строковый литерал в конфиге')


def strip_comments(text):
    """Вырезает // и /* */ вне строковых литералов."""
    out, i, n = [], 0, len(text)
    while i < n:
        c = text[i]
        if c in QUOTES:
            j = skip_string(text, i)
            out.append(text[i:j]); i = j; continue
        if c == '/' and i + 1 < n and text[i + 1] == '/':
            while i < n and text[i] != '\n':
                i += 1
            continue
        if c == '/' and i + 1 < n and text[i + 1] == '*':
            i += 2
            while i + 1 < n and not (text[i] == '*' and text[i + 1] == '/'):
                i += 1
            i += 2; continue
        out.append(c); i += 1
    return ''.join(out)


def skip_ws(text, i, commas=True):
    stop = ' \t\r\n' + (',' if commas else '')
    while i < len(text) and text[i] in stop:
        i += 1
    return i


def skip_value(text, i):
    """Конец значения — запятая или закрывающая скобка на глубине 0."""
    depth = 0
    while i < len(text):
        c = text[i]
        if c in QUOTES:
            i = skip_string(text, i); continue
        if c in '{[(':
            depth += 1
        elif c in '}])':
            if depth == 0:
                return i
            depth -= 1
        elif c == ',' and depth == 0:
            return i
        i += 1
    raise SystemExit('незакрытый объект в конфиге')


def object_fields(text, open_pos=0):
    """Поля объекта: ключ → текст значения. text[open_pos] == '{'.

    Ключ берётся и незакавыченный (customs), и закавыченный ("ground-zero",
    "streets-of-tarkov", "the-lab") — в TS ключи с дефисом иначе не записать.
    """
    if open_pos >= len(text) or text[open_pos] != '{':
        raise SystemExit('ожидался объект { … }')
    i, fields = open_pos + 1, {}
    while True:
        i = skip_ws(text, i)
        if i >= len(text):
            raise SystemExit('незакрытый объект в конфиге')
        if text[i] == '}':
            return fields
        if text[i] in QUOTES:
            j = skip_string(text, i)
            key = text[i + 1:j - 1]; i = j
        else:
            m = re.match(r'[A-Za-z_$][A-Za-z0-9_$]*', text[i:])
            if not m:
                raise SystemExit(f'не разобрал ключ объекта возле: {text[i:i + 40]!r}')
            key = m.group(0); i += m.end()
        i = skip_ws(text, i, commas=False)
        if i >= len(text) or text[i] != ':':
            raise SystemExit(f'после ключа "{key}" нет двоеточия')
        i = skip_ws(text, i + 1, commas=False)
        v0 = i
        i = skip_value(text, i)
        fields[key] = text[v0:i].strip()


# ─────────────────────────────────────────── достаём блок карты
clean = strip_comments(src)
decl = re.search(r'\bEFT_MAP_CONFIG\b[^=]*=', clean)
if not decl:
    raise SystemExit(f'в {CFG} не найдено объявление EFT_MAP_CONFIG')
maps = object_fields(clean, clean.index('{', decl.end()))

if map_id not in maps:
    raise SystemExit(f'карта "{map_id}" не найдена в {CFG}; известны: {", ".join(sorted(maps))}')
raw = maps[map_id]
if not raw.startswith('{'):
    raise SystemExit(f'значение карты "{map_id}" — не объект, а {raw[:40]!r}')
fields = object_fields(raw)


def literal_number(name, default):
    """Числовой литерал прямо из значения поля — не «первое число дальше по блоку»."""
    if name not in fields:
        return default
    t = fields[name]
    if not re.fullmatch(r'-?\d+(?:\.\d+)?', t):
        raise SystemExit(f'{name} карты "{map_id}" = {t!r} — не числовой литерал, разобрать нечем')
    return float(t)


if 'bounds' not in fields:
    raise SystemExit(f'у карты "{map_id}" нет поля bounds — манифест не из чего собрать')
btxt = fields['bounds']
if not btxt.startswith('['):
    raise SystemExit(f'bounds карты "{map_id}" = {btxt!r} — не литерал-массив '
                     f'(null или вычисляемое значение), манифест синтезировать нечем')
try:
    bounds = json.loads(re.sub(r',\s*([\]\}])', r'\1', btxt))   # снимаем trailing-запятые TS
except ValueError as e:
    raise SystemExit(f'bounds карты "{map_id}" не разобрались как JSON: {e}')
ok = (isinstance(bounds, list) and len(bounds) == 2
      and all(isinstance(p, list) and len(p) == 2
              and all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in p)
              for p in bounds))
if not ok:
    raise SystemExit(f'bounds карты "{map_id}" = {bounds!r} — ожидалось [[x,z],[x,z]]')
(ax, az), (bx, bz) = bounds

rot = int(literal_number('coordinateRotation', 0))
zoom = int(literal_number('maxZoom', 6))

# ─────────────────────────────────────────── crop из соотношения сторон границ
# Потребители трактуют пару как (X, Z): build-heightmap.py делает
# `(ax, az), (bx, bz) = man['boundsFromConfig']`, а extract-vegetation.py
# кладёт X на crop.width, Z на crop.height. Сохраняем ту же ось.
span_x = abs(ax - bx)
span_z = abs(az - bz)
if not span_x or not span_z:
    raise SystemExit(f'вырожденные границы карты "{map_id}": X={span_x}, Z={span_z}')
if span_x >= span_z:
    width = LONG_SIDE
    height = int(round(LONG_SIDE * span_z / span_x))
else:
    height = LONG_SIDE
    width = int(round(LONG_SIDE * span_x / span_z))

# ─────────────────────────────────────────── отказы, все ДО записи
# 1. bounds карты — не игровые метры. Три сигнала, от точного к приблизительному.
#
#    (а) явные поля промоута: у карты, переведённой на тайлы или на статик-подложку,
#        в блоке конфига стоят tileBase / staticMap / worldTransform, а bounds
#        становятся canvas-координатами (Таможня: [[0,0],[256,256]]);
#    (б) начало ровно [0,0] и ни одной отрицательной координаты — так выглядят
#        SVG-координаты (Ледокол [[0,0],[5000,8400]], Лабиринт [[0,0],[3300,3200]]).
#        Проверено на всех 13 картах конфига: у каждой метровой хотя бы одна
#        координата отрицательна, у каждой неметровой — начало [0,0];
#    (в) размерная эвристика (компактно и без отрицательных координат) — только
#        дополнительный сигнал: сам по себе он не блокирует, иначе маленькая
#        метровая карта в положительных координатах оказалась бы заперта.
promoted = [k for k in ('tileBase', 'staticMap', 'worldTransform') if k in fields]
zero_origin = (min(ax, bx) >= 0 and min(az, bz) >= 0
               and ((ax, az) == (0, 0) or (bx, bz) == (0, 0)))
compact = min(ax, bx) >= 0 and min(az, bz) >= 0 and max(span_x, span_z) <= 1024

signals = []
if promoted:
    signals.append(f'в блоке конфига есть {", ".join(promoted)} — карта промоучена на тайлы/статик')
if zero_origin:
    signals.append('начало границ ровно [0,0] и ни одной отрицательной координаты — '
                   'это canvas/SVG-координаты, а не метры')
if compact:
    signals.append(f'границы неотрицательны и компактны (X={span_x:g}, Z={span_z:g} ≤ 1024)')

if promoted or zero_origin:
    sys.exit(f'ОТКАЗ: bounds карты "{map_id}" = {bounds} — не игровые метры. '
             + ' | '.join(signals)
             + '. Для terrain-конвейера нужен растровый манифест от fetch-tiles.mjs, '
               'синтез запрещён. Ничего не записано.')
if compact:
    print(f'ВНИМАНИЕ: границы карты "{map_id}" неотрицательны и малы (X={span_x:g}, Z={span_z:g}). '
          f'Явных признаков промоута нет, считаю их метрами — но проверьте глазами.')

path = os.path.join(outroot, map_id, 'manifest.json')

# 2. Ключ конфига и каталог на диске могут расходиться (конфиг знает labyrinth,
#    fetch-tiles.mjs положил the-labyrinth). Синтез создал бы двойника рядом
#    с эталоном, а guard №3 не сработал бы — путь-то другой.
def norm_key(name):
    n = re.sub(r'[^a-z0-9]', '', name.lower())
    return n[3:] if n.startswith('the') and len(n) > 3 else n


if not os.path.isdir(os.path.dirname(path)) and os.path.isdir(outroot):
    for other in sorted(os.listdir(outroot)):
        if other == map_id or norm_key(other) != norm_key(map_id):
            continue
        twin = os.path.join(outroot, other, 'manifest.json')
        if os.path.isfile(twin):
            sys.exit(f'ОТКАЗ: каталога "{map_id}" в {outroot} нет, но рядом лежит '
                     f'{twin} — тот же ключ карты под другим именем '
                     f'(конфиг и fetch-tiles.mjs называют её по-разному). Синтез создал бы '
                     f'двойника рядом с эталоном. Ничего не записано; нужен именно синтетический — '
                     f'укажите другой outdir.')

# 3. Чужой манифест из настоящего растра не трогаем. Признак «наш» — synthetic: true.
if os.path.exists(path):
    try:
        cur = json.load(open(path, encoding='utf-8'))
    except Exception:
        cur = None
    if not (isinstance(cur, dict) and cur.get('synthetic') is True):
        sys.exit(f'ОТКАЗ: {path} уже существует и не помечен "synthetic": true — это эталон, '
                 f'собранный из настоящего растра. Перезапись запрещена. Ничего не записано.')

manifest = {
    'map': map_id,
    'zoom': zoom,
    'tileSize': 256,
    'coordinateRotation': rot,
    'boundsFromConfig': bounds,
    'crop': {'x0': 0, 'y0': 0, 'x1': width, 'y1': height, 'width': width, 'height': height},
    'generated': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
    'synthetic': True,
    'source': 'EFT_MAP_CONFIG',
    'note': 'Растра НЕ СУЩЕСТВУЕТ: у карты нет тайлов в maps.json the-hideout, fetch-tiles.mjs её '
            'не собирает. Границы и поворот взяты из src/data/eft-map-config.ts, crop синтезирован '
            'по соотношению сторон границ. Поля zoom, tileSize и layers — структурная заглушка для '
            'совместимости с форматом fetch-tiles.mjs: ни тайлов, ни слоёв за ними нет. '
            'Terrain-скрипты читают отсюда только boundsFromConfig, coordinateRotation, '
            'crop.width и crop.height.',
    'layers': [],
}

os.makedirs(os.path.dirname(path), exist_ok=True)
json.dump(manifest, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

print(f'{map_id}: bounds={bounds} rotation={rot} zoom={zoom}')
print(f'  игровые метры: X {min(ax, bx):.0f}..{max(ax, bx):.0f} ({span_x:g} м), '
      f'Z {min(az, bz):.0f}..{max(az, bz):.0f} ({span_z:g} м)')
print(f'  crop {width}x{height} px  ({span_x / width:.4f} м/px по X, {span_z / height:.4f} м/px по Z)')
print(f'записано: {path}')
