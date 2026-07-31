#!/usr/bin/env python3
"""
objectize.py — рендер Gemini -> плоский растр -> <symbol> для карты ЦТА.

Делает детерминированно то, что модель делает ненадёжно: постеризацию в палитру
NIGHTFALL. Модель отвечает за геометрию и ракурс, скрипт — за цвет и плоскость.

  python objectize.py render.png --id obj-container --metres 6.06 --base rust

На выходе:
  obj-container.flat.png    плоский растр, 7 цветов, для проверки глазами
  obj-container.symbol.svg  <symbol> с viewBox в метрах, готов к <use>
  отчёт в stdout: путей, цветов — сверять с приёмкой 25–60 / <=9
"""
import argparse, math, os, re, sys, collections
import numpy as np
from PIL import Image

# ---------------------------------------------------------------- палитра ---
RAMP = ["#141416", "#313135", "#52525B", "#747781", "#9CA3AF", "#C6C9D0"]
CLASS = ["v0", "v1", "v2", "v3", "v4", "v5"]
BASES = {
    "neutral": None,          # чистая нейтральная лестница
    "rust":    "#BB6D46",
    "blue":    "#3280B2",
    "green":   "#3C8460",
    "maroon":  "#873A40",
}
ACCENT = {"amber": "#E68E25", "danger": "#C24339"}

# id -> (длина, ширина, высота в метрах, базовый тон)
# Габариты нужны для проверки ракурса: по ним считается, каким обязан быть
# аспект объекта при взгляде почти сверху.
OBJECTS = {
    "obj-container":   (6.06, 2.44, 2.59, "rust"),
    "obj-block":       (3.00, 0.60, 0.90, "neutral"),
    "obj-cabin":       (6.00, 2.40, 2.50, "neutral"),
    "obj-car":         (4.50, 1.80, 1.50, "neutral"),
    "obj-van":         (5.50, 2.10, 2.60, "neutral"),
    "obj-bus":         (12.00, 2.50, 3.20, "neutral"),
    "obj-wagon-box":   (14.00, 3.10, 4.30, "maroon"),
    "obj-wagon-flat":  (14.00, 3.10, 1.30, "neutral"),
    "obj-wagon-tank":  (12.00, 3.00, 4.20, "neutral"),
    "obj-tanker":      (9.00, 2.50, 3.20, "neutral"),
    "obj-tank":        (12.00, 12.00, 14.00, "neutral"),
    "obj-crane":       (20.00, 6.00, 25.00, "neutral"),
}

# ------------------------------------------------------------- sRGB <-> Lab --
def _lin(c): return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def _unlin(c): return 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055
_M  = [[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]
_Mi = [[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]]
_Wn = (0.95047, 1.0, 1.08883)
def _f(t):  return t ** (1/3) if t > 0.008856 else (903.3 * t + 16) / 116
def _fi(t): return t ** 3 if t ** 3 > 0.008856 else (116 * t - 16) / 903.3

def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def hex2lab(h):
    rgb = [_lin(c / 255) for c in hex2rgb(h)]
    X, Y, Z = [sum(_M[i][j] * rgb[j] for j in range(3)) for i in range(3)]
    fx, fy, fz = _f(X/_Wn[0]), _f(Y/_Wn[1]), _f(Z/_Wn[2])
    return (116*fy - 16, 500*(fx - fy), 200*(fy - fz))

def lab2hex(L, a, b):
    fy = (L + 16) / 116; fx = fy + a / 500; fz = fy - b / 200
    X, Y, Z = _fi(fx)*_Wn[0], _fi(fy)*_Wn[1], _fi(fz)*_Wn[2]
    rgb = [sum(_Mi[i][j] * [X, Y, Z][j] for j in range(3)) for i in range(3)]
    return "#%02X%02X%02X" % tuple(max(0, min(255, round(_unlin(max(0, min(1, c))) * 255)))
                                   for c in rgb)

def tinted_ramp(base_hex):
    """Шесть ступеней в тоне базового цвета: светлота от RAMP, тон и хрома от базы.
    Хрома гасится к краям диапазона — так ведут себя реальные поверхности."""
    if base_hex is None:
        return list(RAMP)
    _, a, b = hex2lab(base_hex)
    C = math.hypot(a, b); H = math.atan2(b, a)
    out = []
    for h in RAMP:
        L = hex2lab(h)[0]
        k = 1 - abs(L - 50) / 60           # максимум хромы в середине
        c = C * max(0.25, k)
        out.append(lab2hex(L, c * math.cos(H), c * math.sin(H)))
    return out

# ------------------------------------------------------------------ шаги ----
def key_background(arr, tol):
    """Медиана трёх углов как цвет мата; всё дальше tol — объект."""
    h, w, _ = arr.shape
    p = 48
    corners = np.concatenate([arr[:p, :p].reshape(-1, 3),
                              arr[:p, -p:].reshape(-1, 3),
                              arr[-p:, :p].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    return np.linalg.norm(arr - bg, axis=2) > tol, bg

def posterize(arr, fg, ramp):
    """Яркость -> шесть корзин по перцентилям (равное наполнение, устойчиво
    к тому, что модель отдала слишком тёмный или слишком светлый рендер)."""
    lum = 0.2126*arr[..., 0] + 0.7152*arr[..., 1] + 0.0722*arr[..., 2]
    qs = np.percentile(lum[fg], np.linspace(0, 100, 7)[1:-1])
    idx = np.digitize(lum, qs)
    pal = np.array([hex2rgb(h) for h in ramp])
    return pal[idx], idx

def trace(png_path, svg_path, speckle):
    import vtracer
    vtracer.convert_image_to_svg_py(
        png_path, svg_path, colormode="color", hierarchical="stacked",
        mode="polygon", filter_speckle=speckle, color_precision=8,
        corner_threshold=70, path_precision=1)
    return open(svg_path, encoding="utf-8").read()

def to_symbol(svg, ramp, sym_id, metres, px_w, px_h):
    """Меняет fill на class, режет мат, оборачивает в <symbol> с viewBox в метрах."""
    pal = np.array([hex2rgb(h) for h in ramp])
    def nearest(hx):
        c = np.array(hex2rgb(hx))
        return int(np.argmin(((pal - c) ** 2).sum(1)))
    body = re.search(r"<svg[^>]*>(.*)</svg>", svg, re.S).group(1)
    used = collections.Counter()
    def repl(m):
        hx = m.group(1)
        if not hx.startswith("#"):
            return m.group(0)
        r, g, b = hex2rgb(hx)
        if g > 150 and r < 110 and b < 110:      # зелёный мат
            return 'fill="none" data-drop="1"'
        i = nearest(hx); used[CLASS[i]] += 1
        return f'class="{CLASS[i]}"'
    body = re.sub(r'fill="([^"]+)"', repl, body)
    body = re.sub(r"<(path|polygon)[^>]*data-drop=\"1\"[^>]*/>", "", body)
    h_m = metres * px_h / px_w
    sym = (f'<symbol id="{sym_id}" viewBox="0 0 {px_w} {px_h}" '
           f'data-metres-w="{metres:.2f}" data-metres-h="{h_m:.2f}">\n{body}\n</symbol>')
    return sym, used, h_m

# ------------------------------------------------------------------ main ----
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--id", required=True,
                    help="id символа; для известных габариты и тон подставятся сами")
    ap.add_argument("--metres", type=float, help="длина объекта, м (если id незнаком)")
    ap.add_argument("--base", choices=list(BASES), help="базовый тон")
    ap.add_argument("--speckle", type=int, default=40, help="фильтр крапа; выше = меньше путей")
    ap.add_argument("--tol", type=float, default=26, help="порог отделения от мата")
    ap.add_argument("--depth", type=float, help="ширина объекта, м — для проверки ракурса")
    ap.add_argument("--height", type=float, help="высота объекта, м — для проверки ракурса")
    ap.add_argument("--force", action="store_true",
                    help="записать символ даже при неверном ракурсе")
    ap.add_argument("--out", default=".")
    a = ap.parse_args()

    known = OBJECTS.get(a.id)
    if known:
        a.metres = a.metres or known[0]
        a.depth  = a.depth  or known[1]
        a.height = a.height or known[2]
        a.base   = a.base   or known[3]
    a.base = a.base or "neutral"
    if not a.metres:
        sys.exit(f"id '{a.id}' незнаком — укажи --metres, а лучше --depth и --height тоже.\n"
                 f"известные: {', '.join(sorted(OBJECTS))}")

    im = Image.open(a.image).convert("RGB")
    arr = np.asarray(im).astype(float)
    fg, bg = key_background(arr, a.tol)
    if fg.mean() < 0.02:
        sys.exit("объект не отделился от фона — подними --tol или проверь, что мат плоский")

    ys, xs = np.where(fg)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    arr = arr[y0:y1, x0:x1]; fg = fg[y0:y1, x0:x1]

    ramp = tinted_ramp(BASES[a.base])
    out, _ = posterize(arr, fg, ramp)
    out[~fg] = [0, 192, 0]

    os.makedirs(a.out, exist_ok=True)
    flat = os.path.join(a.out, f"{a.id}.flat.png")
    Image.fromarray(out.astype(np.uint8)).save(flat)

    raw = os.path.join(a.out, f"{a.id}.raw.svg")
    svg = trace(flat, raw, a.speckle)
    h, w = out.shape[:2]
    sym, used, h_m = to_symbol(svg, ramp, a.id, a.metres, w, h)
    sym_path = os.path.join(a.out, f"{a.id}.symbol.svg")
    open(sym_path, "w", encoding="utf-8").write(sym)
    os.remove(raw)

    paths = sym.count("<path") + sym.count("<polygon")
    print(f"кроп        {w}x{h} px  ->  {a.metres:.2f} x {h_m:.2f} м")
    if a.depth and a.height:
        exp = a.metres / (a.depth * math.cos(math.radians(15)) +
                          a.height * math.sin(math.radians(15)))
        got = w / h
        off = abs(got - exp) / exp
        verdict = "ok" if off < 0.18 else "РАКУРС НЕ ТОТ"
        print(f"аспект      ожидался {exp:.2f}, получен {got:.2f}  "
              f"(отклонение {off*100:.0f}%)   {verdict}")
        if verdict != "ok" and not a.force:
            os.remove(sym_path)
            sys.exit("\nСИМВОЛ НЕ ЗАПИСАН. Камера ушла в изометрию или в бок — след объекта\n"
                     "неверен, на карту он не ляжет. Перегенерируй с усиленным блоком CAMERA.\n"
                     f"Плоский растр оставлен для осмотра: {flat}\n"
                     "Записать всё равно: добавь --force")
    print(f"лестница    {' '.join(ramp)}")
    print(f"путей       {paths}   {'ok' if 25 <= paths <= 60 else 'ВНЕ ОКНА 25–60'}")
    print(f"классов     {len(used)}  " + "  ".join(f".{k}={v}" for k, v in sorted(used.items())))
    print(f"файлы       {flat}\n            {sym_path}")
    print(f"\nвставка:    <use href=\"#{a.id}\" x=\"…\" y=\"…\" "
          f"transform=\"rotate(deg cx cy)\"/>")

if __name__ == "__main__":
    main()
