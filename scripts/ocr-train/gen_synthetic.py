#!/usr/bin/env python3
"""
Синтетический датасет для дообучения Tesseract на шрифте барахолки EFT (Bender).
Рендерит цены/использования как в игре → пары {png, gt.txt} в формате tesstrain.
Решает корневой баг: у Bender перечёркнутый ноль → tesseract путает 0↔6 (и 3↔5).

Запуск:  python scripts/ocr-train/gen_synthetic.py --n 6000 --out scripts/ocr-train/data
Шрифты положить в scripts/ocr-train/fonts/ (Bender-Regular/Bold/Black .otf из Windows/Fonts).
Датасет НЕ коммитить (в .gitignore) — генерится на месте.
"""
import argparse, os, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONTS_DIR = os.path.join(os.path.dirname(__file__), "fonts")
WEIGHTS = ["Bender-Regular.otf", "Bender-Bold.otf", "Bender-Black.otf"]

def group_ru(n: int) -> str:
    """11000000 -> '11 000 000' (как в игре: разряды через пробел)."""
    s = str(n)
    out = ""
    for i, ch in enumerate(reversed(s)):
        if i and i % 3 == 0:
            out = " " + out
        out = ch + out
    return out

def rand_price() -> int:
    # реалистичное распределение: побольше 4-8 значных, включая миллионы (боль OCR)
    mag = random.choices([3,4,5,6,7,8], weights=[10,25,25,20,12,8])[0]
    lo, hi = 10**mag, 10**(mag+1) - 1
    return random.randint(lo, hi)

def make_line() -> str:
    kind = random.random()
    if kind < 0.72:                    # цена
        p = rand_price()
        s = group_ru(p)
        if random.random() < 0.5:      # иногда с валютой (учим ₽/$/€ ≠ цифра)
            s += " " + random.choice(["₽","$","€"])
        return s
    elif kind < 0.9:                   # использования X/Y (ключи/износ)
        y = random.choice([10,20,30,40,60])
        x = random.randint(1, y)
        return f"{x}/{y}"
    else:                              # "Всего N  X/Y" (полная строка предложения)
        y = random.choice([10,20,40]); x = random.randint(1,y)
        return f"Всего {random.randint(1,10)}  {x}/{y}"

def render(text: str, font: ImageFont.FreeTypeFont) -> Image.Image:
    tmp = Image.new("L", (10,10)); d = ImageDraw.Draw(tmp)
    bbox = d.textbbox((0,0), text, font=font); tw = bbox[2]-bbox[0]; th = bbox[3]-bbox[1]
    padx, pady = random.randint(6,16), random.randint(4,10)
    W, H = tw+2*padx, th+2*pady
    bg = random.randint(28, 55)                    # тёмный фон барахолки
    im = Image.new("L", (W,H), bg)
    d = ImageDraw.Draw(im)
    fg = random.randint(205, 240)                  # светлый текст
    d.text((padx-bbox[0], pady-bbox[1]), text, font=font, fill=fg)
    if random.random() < 0.35:                     # лёгкий блюр/шум под реальный рендер
        im = im.applyfilter(ImageFilter.GaussianBlur(0.5)) if False else im.filter(ImageFilter.GaussianBlur(random.uniform(0.3,0.7)))
    return im

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=6000)
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "data"))
    ap.add_argument("--size-min", type=int, default=34)
    ap.add_argument("--size-max", type=int, default=46)
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    fonts = {}
    for w in WEIGHTS:
        p = os.path.join(FONTS_DIR, w)
        if os.path.exists(p): fonts[w] = p
    if not fonts:
        raise SystemExit(f"нет шрифтов в {FONTS_DIR} — положи Bender-*.otf")
    for i in range(args.n):
        text = make_line()
        w = random.choice(list(fonts.values()))
        font = ImageFont.truetype(w, random.randint(args.size_min, args.size_max))
        im = render(text, font)
        base = os.path.join(args.out, f"flea_{i:06d}")
        im.save(base + ".png")
        with open(base + ".gt.txt", "w", encoding="utf-8") as f:
            f.write(text)
    print(f"сгенерировано {args.n} пар в {args.out} (шрифты: {list(fonts.keys())})")

if __name__ == "__main__":
    main()
