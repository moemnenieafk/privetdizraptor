# Оверлей внутренней разметки локации поверх нашего HD-арта: комнаты, проёмы, двери,
# выходы, здания — в ТОЧНОЙ пиксельной сетке растра карты, слоем в PSD и в SVG для Figma.
#
# ⚠️ КООРДИНАТНАЯ ПРИВЯЗКА — та же, что у отмывки рельефа (scripts/eft-terrain/build-heightmap.py),
# пиксель в пиксель, иначе слой не сойдётся с уже лежащими в PSD артефактами террейна:
#   границы кадра — manifest.boundsFromConfig (игровые метры),
#   coordinateRotation = 180 — это ОТРАЖЕНИЕ ПО X, а не поворот на 180°: Unity левосторонняя,
#   и вид сверху на игровые координаты даёт зеркало. Строки (Z) не трогаем.
#   (build-heightmap делает это как OUT[:, ::-1]; здесь то же самое, но на координате: u -> 1-u.)
# Своего преобразования тут не изобретается. Проверка — сверка дверей из клиента с замками
# tarkov.dev (см. ниже): совпадение по мировым координатам замыкает рамку.
#
# Разбивка по этажам — по ПОЛОСАМ ВЫСОТ САМОГО МАНИФЕСТА (manifest.layers[].heights), чтобы файлы
# оверлея совпали со слоями арта один в один. Полосы у BSG-этажей перекрываются намеренно
# (main = −1000…1000 ловит всё), поэтому объект может попасть в несколько слоёв — так же, как
# гейтятся маркеры в самом приложении. Комната, дверь, выход И ЗДАНИЕ кладутся по Y своего центра.
# Для здания сперва пробовалось пересечение размаха с полосой — но у почти любой постройки
# фундамент уходит ниже 0.5 м, и полоса underground собирала 57 зданий из 129 поверх пустого
# подземного арта. Центр честнее: в подземный слой попадают только реальные подвалы.
#
# Стиль намеренно без заливок: заливка закроет арт, а сверять надо именно с ним.
#
# Вход:  <rooms.json>  выход scripts/eft-rooms/dump-rooms.py
#        <manifest>    manifest.json карты (boundsFromConfig, coordinateRotation, crop, layers)
#        <outdir>      куда положить оверлеи
#        <map>         id карты
#        [locks.json]  необязательно: замки карты из зеркала (сверка привязки числом)
# Выход: <outdir>/<map>-rooms-<layer>.png  — RGBA-палитра, прозрачный фон, ровно crop.width×crop.height
#        <outdir>/<map>-rooms-<layer>.svg  — те же координаты, с подписями комнат
#        <outdir>/<map>-rooms-frame.json   — само преобразование game -> пиксель, числами
#        <outdir>/<map>-rooms-check-<layer>.jpg — превью «оверлей поверх арта» для глаза
#
# Запуск: python scripts/eft-rooms/render-rooms.py D:/eft-export/customs-rooms/customs-rooms.json \
#           D:/Games/raster/customs/manifest.json map-exports/OBJECTS-MAPS/gen/customs/rooms customs \
#           .tmp-customs/locks-56f40101d2720b2a4d8b45d6.json

import sys, os, json, math, html

from PIL import Image, ImageDraw, ImageFont

Image.MAX_IMAGE_PIXELS = None

if len(sys.argv) < 5:
    sys.exit('использование: python scripts/eft-rooms/render-rooms.py <rooms.json> <manifest> <outdir> <map> [locks.json]')

rooms_path, man_path, OUTDIR, MAP_ID = sys.argv[1:5]
locks_path = sys.argv[5] if len(sys.argv) > 5 else None
os.makedirs(OUTDIR, exist_ok=True)

D = json.load(open(rooms_path, encoding='utf-8'))
man = json.load(open(man_path, encoding='utf-8'))

# ─────────────────────────────────────────── кадр: game (метры) -> пиксель растра

(ax, az), (bx, bz) = man['boundsFromConfig']
XMIN, XMAX = min(ax, bx), max(ax, bx)
ZMIN, ZMAX = min(az, bz), max(az, bz)
ROT = man.get('coordinateRotation', 0)
W = man['crop']['width']
H = man['crop']['height']
MIRROR_X = (ROT == 180)

SX = (W - 1) / (XMAX - XMIN)
SZ = (H - 1) / (ZMAX - ZMIN)


def to_px(x, z):
    u = (x - XMIN) * SX
    if MIRROR_X:
        u = (W - 1) - u
    return u, (z - ZMIN) * SZ


# та же привязка, записанная как аффинное преобразование — чтобы её можно было проверить руками
AFF = dict(px_from_x=[(W - 1) + XMIN * SX, -SX] if MIRROR_X else [-XMIN * SX, SX],
           py_from_z=[-ZMIN * SZ, SZ])
M_PER_PX = (XMAX - XMIN) / (W - 1)
print(f'кадр {MAP_ID}: X[{XMIN:.0f},{XMAX:.0f}] Z[{ZMIN:.0f},{ZMAX:.0f}] -> {W}x{H} px, '
      f'{M_PER_PX:.4f} м/px, отражение по X: {"да (coordinateRotation=180)" if MIRROR_X else "нет"}')
print(f'  px = {AFF["px_from_x"][0]:.1f} {AFF["px_from_x"][1]:+.4f}*gx     '
      f'py = {AFF["py_from_z"][0]:.1f} {AFF["py_from_z"][1]:+.4f}*gz')

# ─────────────────────────────────────────── независимая проверка привязки: двери против замков

if locks_path is None:
    guess = os.path.join('.tmp-customs', 'locks-56f40101d2720b2a4d8b45d6.json')
    if MAP_ID == 'customs' and os.path.exists(guess):
        locks_path = guess

check = None
if locks_path and os.path.exists(locks_path):
    locks = json.load(open(locks_path, encoding='utf-8'))
    doors = D['doors']
    hits, worst = 0, []
    for L in locks:
        p = (L['x'], L['y'], L['z'])
        best = min(doors, key=lambda d: sum((d['pos'][i] - p[i]) ** 2 for i in range(3)))
        dist = math.dist(best['pos'], p)
        if dist <= 0.05:
            hits += 1
        else:
            worst.append((dist, L.get('label'), best.get('go')))
    check = dict(locks=len(locks), within5cm=hits)
    print(f'\nсверка привязки: дверей клиента совпало с замками зеркала {hits}/{len(locks)} '
          f'в пределах 5 см')
    for dist, lab, go in sorted(worst, reverse=True):
        print(f'  не совпал: {dist:.1f} м — «{lab}» (ближайшая дверь {go})')
else:
    print('\nсверка привязки: файл замков не задан и не найден — пропущено')

# ─────────────────────────────────────────── этажи из манифеста

layers = [dict(id=l['id'], name=l.get('name', l['id']), lo=l['heights'][0], hi=l['heights'][1],
               art=(l.get('files') or {}).get('8192') or (l.get('files') or {}).get('z6'))
          for l in man.get('layers', [])] or [dict(id='all', name='All', lo=-1e9, hi=1e9, art=None)]

# ─────────────────────────────────────────── палитра (индексы; 0 = прозрачный)

PAL = {
    'bg':        (0, (0, 0, 0)),
    'room':      (1, (55, 232, 255)),      # комнаты — голубой
    'roomlabel': (2, (150, 245, 255)),
    'building':  (3, (255, 176, 0)),       # здания — янтарь
    'portal':    (4, (255, 79, 216)),      # проёмы — маджента
    'door':      (5, (235, 235, 235)),     # двери — белый
    'doorkey':   (6, (255, 226, 74)),      # дверь с ключом — жёлтый
    'exit':      (7, (76, 255, 128)),      # выходы — зелёный
    'indoor':    (8, (120, 140, 190)),     # indoor-объёмы — приглушённый синий
}
palette = [0] * 768
for _, (idx, rgb) in PAL.items():
    palette[idx * 3:idx * 3 + 3] = list(rgb)


def font(size):
    for f in ('arial.ttf', 'C:/Windows/Fonts/arial.ttf', 'DejaVuSans.ttf'):
        try:
            return ImageFont.truetype(f, size)
        except Exception:
            continue
    return ImageFont.load_default()


F_ROOM = font(34)
F_EXIT = font(46)

# ─────────────────────────────────────────── геометрия

def qrot(q, v):
    x, y, z, w = q
    vx, vy, vz = v
    tx, ty, tz = 2 * (y * vz - z * vy), 2 * (z * vx - x * vz), 2 * (x * vy - y * vx)
    return (vx + w * tx + y * tz - z * ty, vy + w * ty + z * tx - x * tz, vz + w * tz + x * ty - y * tx)


def hull(pts):
    """Выпуклая оболочка (Эндрю): проекция ориентированного бокса на XZ — от 4 до 6 углов."""
    pts = sorted(set(pts))
    if len(pts) < 3:
        return pts

    def half(seq):
        out = []
        for p in seq:
            while len(out) >= 2 and ((out[-1][0] - out[-2][0]) * (p[1] - out[-2][1])
                                     - (out[-1][1] - out[-2][1]) * (p[0] - out[-2][0])) <= 0:
                out.pop()
            out.append(p)
        return out[:-1]

    return half(pts) + half(pts[::-1])


def box_poly(b):
    """Ориентированный бокс комнаты -> многоугольник в пикселях (вид сверху)."""
    c, q, h = b['c'], b['q'], b['h']
    pts = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                r = qrot(q, (sx * h[0], sy * h[1], sz * h[2]))
                pts.append(to_px(c[0] + r[0], c[2] + r[2]))
    return hull([(round(x, 2), round(y, 2)) for x, y in pts])


# Боксы размером в четверть карты — это уличные звуковые объёмы (Outdoor, outdoor1, dorms_outdoor,
# SpatialAudioRoom_outdoor). Геометрия честная, но для сверки зданий это линии через весь кадр,
# поэтому в PNG-слой такие боксы не идут, а в SVG лежат отдельной приглушённой группой.
# Порог с запасом: самый большой НАСТОЯЩИЙ интерьер Таможни — склад терминала, 44×98 = 4.3 тыс. м²,
# ближайший уличный объём — 43 тыс. м²; между ними пусто, 20 тыс. режет посередине.
OUTDOOR_AREA_M2 = 20000


def is_outdoor(b):
    return (2 * b['h'][0]) * (2 * b['h'][2]) > OUTDOOR_AREA_M2


def in_band(y, lo, hi):
    return lo <= y <= hi


# ─────────────────────────────────────────── отрисовка одного этажа

def collect(lay):
    R = [r for r in D['rooms'] if in_band(r['center'][1], lay['lo'], lay['hi'])]
    P = [p for p in D['portals'] if in_band(p['pos'][1], lay['lo'], lay['hi'])]
    DR = [d for d in D['doors'] if in_band(d['pos'][1], lay['lo'], lay['hi'])]
    EX = [e for e in D['exits'] if in_band(e['pos'][1], lay['lo'], lay['hi'])]
    B = [b for b in D['buildings']
         if in_band((b['min'][1] + b['max'][1]) / 2, lay['lo'], lay['hi'])]
    return R, P, DR, EX, B


def render_png(lay, R, P, DR, EX, B, path):
    im = Image.new('P', (W, H), 0)
    im.putpalette(palette)
    im.info['transparency'] = 0
    d = ImageDraw.Draw(im)
    d.fontmode = '1'          # без сглаживания: в палитре промежуточные индексы = чужие цвета

    for b in B:                                        # здания — прямоугольник AABB
        x0, y0 = to_px(b['min'][0], b['min'][2])
        x1, y1 = to_px(b['max'][0], b['max'][2])
        d.rectangle([min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)],
                    outline=PAL['building'][0], width=6)

    for r in R:                                        # комнаты — контуры их боксов
        for b in r['boxes']:
            if is_outdoor(b):
                continue
            poly = box_poly(b)
            if len(poly) >= 3:
                d.line(poly + [poly[0]], fill=PAL['room'][0], width=4, joint='curve')

    for p in P:                                        # проёмы — отрезок по ширине портала
        hw = p['size'][0] / 2.0
        v = qrot(p['rot'], (hw, 0.0, 0.0))
        a = to_px(p['pos'][0] - v[0], p['pos'][2] - v[2])
        b2 = to_px(p['pos'][0] + v[0], p['pos'][2] + v[2])
        d.line([a, b2], fill=PAL['portal'][0], width=5)

    for x in DR:                                       # двери — ромб, с ключом крупнее и жёлтый
        cx, cy = to_px(x['pos'][0], x['pos'][2])
        keyed = bool(x['keyId'])
        s = 22 if keyed else 12
        col = PAL['doorkey'][0] if keyed else PAL['door'][0]
        d.polygon([(cx, cy - s), (cx + s, cy), (cx, cy + s), (cx - s, cy)], outline=col, width=4)
        if keyed:
            d.ellipse([cx - s - 10, cy - s - 10, cx + s + 10, cy + s + 10], outline=col, width=4)

    for e in EX:                                       # выходы — окружность с подписью
        cx, cy = to_px(e['pos'][0], e['pos'][2])
        d.ellipse([cx - 34, cy - 34, cx + 34, cy + 34], outline=PAL['exit'][0], width=6)
        d.text((cx + 44, cy - 24), e.get('name') or '', fill=PAL['exit'][0], font=F_EXIT)

    # Подписи комнат в PNG намеренно НЕ рисуются: у общаги 30+ имён на здание, они сливаются
    # в кашу и закрывают ровно то, что надо сверять. Имена — в SVG, там слой выключается.

    im.save(path, optimize=True)
    return im


def render_svg(lay, R, P, DR, EX, B, path):
    def hexc(k):
        return '#%02x%02x%02x' % PAL[k][1]

    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
         f'<!-- {MAP_ID} / {lay["id"]}: game->px  px={AFF["px_from_x"][0]:.3f}{AFF["px_from_x"][1]:+.6f}*gx  '
         f'py={AFF["py_from_z"][0]:.3f}{AFF["py_from_z"][1]:+.6f}*gz -->',
         '<g fill="none" stroke-linejoin="round">']

    o.append(f'<g id="buildings" stroke="{hexc("building")}" stroke-width="6">')
    for b in B:
        x0, y0 = to_px(b['min'][0], b['min'][2])
        x1, y1 = to_px(b['max'][0], b['max'][2])
        o.append(f'<rect x="{min(x0, x1):.1f}" y="{min(y0, y1):.1f}" '
                 f'width="{abs(x1 - x0):.1f}" height="{abs(y1 - y0):.1f}"/>')
    o.append('</g>')

    for gid, sel in (('rooms', False), ('rooms-outdoor', True)):
        o.append(f'<g id="{gid}" stroke="{hexc("room")}" stroke-width="4"'
                 + (' opacity="0.4"' if sel else '') + '>')
        for r in R:
            for b in r['boxes']:
                if is_outdoor(b) != sel:
                    continue
                poly = box_poly(b)
                if len(poly) >= 3:
                    pts = ' '.join(f'{x:.1f},{y:.1f}' for x, y in poly)
                    o.append(f'<polygon points="{pts}"/>')
        o.append('</g>')

    o.append(f'<g id="portals" stroke="{hexc("portal")}" stroke-width="5">')
    for p in P:
        hw = p['size'][0] / 2.0
        v = qrot(p['rot'], (hw, 0.0, 0.0))
        x0, y0 = to_px(p['pos'][0] - v[0], p['pos'][2] - v[2])
        x1, y1 = to_px(p['pos'][0] + v[0], p['pos'][2] + v[2])
        o.append(f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}"/>')
    o.append('</g>')

    o.append('<g id="doors" stroke-width="4">')
    for x in DR:
        cx, cy = to_px(x['pos'][0], x['pos'][2])
        keyed = bool(x['keyId'])
        s, col = (22, hexc('doorkey')) if keyed else (12, hexc('door'))
        o.append(f'<polygon stroke="{col}" points="{cx:.1f},{cy - s:.1f} {cx + s:.1f},{cy:.1f} '
                 f'{cx:.1f},{cy + s:.1f} {cx - s:.1f},{cy:.1f}"/>')
        if keyed:
            o.append(f'<circle stroke="{col}" cx="{cx:.1f}" cy="{cy:.1f}" r="{s + 10}"/>'
                     f'<title>{html.escape(str(x["keyId"]))}</title>')
    o.append('</g>')

    o.append(f'<g id="exits" stroke="{hexc("exit")}" stroke-width="6">')
    for e in EX:
        cx, cy = to_px(e['pos'][0], e['pos'][2])
        o.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="34"/>'
                 f'<text x="{cx + 44:.1f}" y="{cy + 16:.1f}" fill="{hexc("exit")}" stroke="none" '
                 f'font-size="46" font-family="sans-serif">{html.escape(e.get("name") or "")}</text>')
    o.append('</g>')

    o.append(f'<g id="room-labels" fill="{hexc("roomlabel")}" stroke="none" '
             f'font-size="34" font-family="sans-serif">')
    for r in R:
        cx, cy = to_px(r['center'][0], r['center'][2])
        o.append(f'<text x="{cx + 6:.1f}" y="{cy + 12:.1f}">{html.escape(r.get("name") or "")}</text>')
    o.append('</g>')

    o.append('</g></svg>')
    open(path, 'w', encoding='utf-8').write('\n'.join(o))


def render_check(lay, overlay, path, width=4096):
    """Превью для глаза: оверлей поверх самого арта этажа, уменьшенный."""
    art_dir = os.path.dirname(os.path.abspath(man_path))
    art = os.path.join(art_dir, lay['art']) if lay.get('art') else None
    if not art or not os.path.exists(art):
        return None
    h = int(round(width * H / W))
    base = Image.open(art).convert('RGB').resize((width, h), Image.LANCZOS)
    ov = overlay.convert('RGBA').resize((width, h), Image.NEAREST)
    base.paste(ov, (0, 0), ov)
    base.save(path, quality=88)
    return path


# ─────────────────────────────────────────── прогон по этажам

made = []
for lay in layers:
    R, P, DR, EX, B = collect(lay)
    png = os.path.join(OUTDIR, f'{MAP_ID}-rooms-{lay["id"]}.png')
    svg = os.path.join(OUTDIR, f'{MAP_ID}-rooms-{lay["id"]}.svg')
    im = render_png(lay, R, P, DR, EX, B, png)
    render_svg(lay, R, P, DR, EX, B, svg)
    chk = render_check(lay, im, os.path.join(OUTDIR, f'{MAP_ID}-rooms-check-{lay["id"]}.jpg'))
    im.close()
    print(f'{lay["id"]:12s} [{lay["lo"]:>8.1f}..{lay["hi"]:<8.1f}] м  комнат {len(R):4d}  проёмов {len(P):5d}  '
          f'дверей {len(DR):4d}  выходов {len(EX):3d}  зданий {len(B):4d}  -> {os.path.basename(png)}'
          + (f' + превью' if chk else ''))
    made.append(dict(layer=lay['id'], png=png, svg=svg, check=chk,
                     rooms=len(R), portals=len(P), doors=len(DR), exits=len(EX), buildings=len(B)))

json.dump(dict(map=MAP_ID, width=W, height=H, bounds=[[XMIN, ZMIN], [XMAX, ZMAX]],
               coordinateRotation=ROT, mirrorX=MIRROR_X, metersPerPixel=M_PER_PX,
               affine=AFF, doorLockCheck=check, layers=made),
          open(os.path.join(OUTDIR, f'{MAP_ID}-rooms-frame.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print(f'\nготово: {len(made)} этажей в {OUTDIR} ({W}x{H} px каждый)')
