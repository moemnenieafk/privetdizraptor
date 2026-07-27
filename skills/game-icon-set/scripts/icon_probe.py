#!/usr/bin/env python3
"""Read a tiny source icon that is too small to see.

Prints luminance, saturation and hue as character grids, plus connected-component
analysis. Use this before guessing what a 16-48px reference depicts — a wrong
guess costs several generation rounds.

Usage:
  python icon_probe.py icon.png
  python icon_probe.py icon.png --crop      # auto-trim a grey frame first
  python icon_probe.py icon.png --masks out/  # export components as masks

How to read the output:
  saturation all 0-1     -> tintable monochrome glyph; colour comes from the UI,
                            do not bake the observed colour into the set
  bright rows top/bottom -> dark symbol on a light field (check before generating
                            a dark object on a dark plate)
  alternating light/dark -> concentric rings or a spiral
    along a centre scan
  N separate components  -> source may already be segmented; export as masks and
                            treat the segmentation as authoritative geometry

Requires: pip install pillow numpy scipy
"""
import argparse
import colorsys
import os

import numpy as np
from PIL import Image


GRID_MAX = 56  # character grids are unreadable beyond this


def grids(a, alpha):
    h, w = alpha.shape
    print(f"size {w}x{h}\n")

    print("luminance 0-9 ('.' = transparent)")
    for y in range(h):
        row = ""
        for x in range(w):
            if alpha[y, x] < 0.15:
                row += "."
            else:
                lum = a[y, x] @ np.array([0.299, 0.587, 0.114])
                row += str(min(int(lum * 10), 9))
        print("  " + row)

    print("\nsaturation 0-9 (0 = grey/white)")
    for y in range(h):
        row = ""
        for x in range(w):
            if alpha[y, x] < 0.15:
                row += "."
            else:
                mx, mn = a[y, x].max(), a[y, x].min()
                row += "0" if mx == 0 else str(min(int((mx - mn) / mx * 10), 9))
        print("  " + row)

    print("\nhue  R=red O=orange Y=yellow G=green C=cyan B=blue M=magenta g=grey")
    for y in range(h):
        row = ""
        for x in range(w):
            if alpha[y, x] < 0.15:
                row += "."
                continue
            r, g, b = a[y, x]
            if max(r, g, b) - min(r, g, b) < 0.09:
                row += "g"
                continue
            d = colorsys.rgb_to_hsv(r, g, b)[0] * 360
            row += ("R" if d < 15 or d >= 345 else "O" if d < 40 else
                    "Y" if d < 70 else "G" if d < 165 else
                    "C" if d < 195 else "B" if d < 255 else "M")
        print("  " + row)


def components(a, alpha, out_dir=None):
    try:
        from scipy import ndimage
    except ImportError:
        print("\n(install scipy for component analysis)")
        return
    if alpha.min() > 0.99:
        # fully opaque: segment on brightness instead of alpha
        lum = a @ np.array([0.299, 0.587, 0.114])
        mask = lum > 0.5
        print("\n(opaque image — segmenting on luminance, not alpha)")
    else:
        mask = alpha > 0.5
    lab, n = ndimage.label(mask)
    print(f"\nconnected components: {n}")
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        print(f"  {i}: px={len(xs):>7}  "
              f"x[{xs.min()}-{xs.max()}] y[{ys.min()}-{ys.max()}]")
    if out_dir and n > 1:
        os.makedirs(out_dir, exist_ok=True)
        for i in range(1, n + 1):
            m = lab == i
            rgba = np.zeros((*m.shape, 4), np.uint8)
            rgba[..., :3] = 255
            rgba[..., 3] = m * 255
            Image.fromarray(rgba, "RGBA").save(f"{out_dir}/component-{i:02d}.png")
        print(f"  -> {n} masks written to {out_dir}/")


def autocrop_frame(im):
    """Trim an achromatic border, keeping the coloured content box."""
    a = np.asarray(im.convert("RGBA"), np.float32) / 255.0
    rgb, al = a[..., :3], a[..., 3]
    coloured = ((rgb.max(axis=2) - rgb.min(axis=2)) > 0.12) & (al > 0.15)
    if not coloured.any():
        return im
    ys, xs = np.where(coloured)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("src")
    p.add_argument("--crop", action="store_true", help="trim achromatic frame first")
    p.add_argument("--masks", default=None, help="export components to this dir")
    args = p.parse_args()

    im = Image.open(args.src)
    if args.crop:
        before = im.size
        im = autocrop_frame(im)
        print(f"cropped {before} -> {im.size}\n")

    im = im.convert("RGBA")
    full = np.asarray(im, np.float32) / 255.0

    small = im
    if max(im.size) > GRID_MAX:
        scale = GRID_MAX / max(im.size)
        small = im.resize((max(int(im.width * scale), 1),
                           max(int(im.height * scale), 1)), Image.NEAREST)
        print(f"note: downsampled {im.size} -> {small.size} for the grids; "
              f"component analysis still uses full resolution\n")
    sa = np.asarray(small, np.float32) / 255.0
    grids(sa[..., :3], sa[..., 3])
    components(full[..., :3], full[..., 3], args.masks)


if __name__ == "__main__":
    main()
