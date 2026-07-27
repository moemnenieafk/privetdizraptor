#!/usr/bin/env python3
"""Cut generated icons out of their background.

Three modes, matching the three background cases:

  chroma  - flat saturated matte  -> alpha key by colour distance
  achroma - grey/checkerboard bg  -> alpha key by saturation
  glow    - black bg, emissive    -> alpha from luminance (composite with Screen)

Usage:
  python chroma_key.py IN.png OUT.png --mode chroma --key 00C000
  python chroma_key.py IN.png OUT.png --mode achroma
  python chroma_key.py IN.png OUT.png --mode glow
  python chroma_key.py IN.png OUT.png --mode chroma --key C000C0 --crop-corner 0.10

--crop-corner trims a fraction off each side, to remove watermarks such as
Gemini's SynthID sparkle before keying.

Requires: pip install pillow numpy
"""
import argparse
import sys

import numpy as np
from PIL import Image


def smoothstep(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


def key_chroma(a, key_rgb, lo, hi):
    """Distance from a known matte colour."""
    d = np.linalg.norm(a - np.array(key_rgb, np.float32), axis=2) / np.sqrt(3)
    return smoothstep((d - lo) / max(hi - lo, 1e-6))


def key_achroma(a, lo, hi):
    """Saturation key: any grey is background. For checkerboards."""
    chroma = a.max(axis=2) - a.min(axis=2)
    return smoothstep((chroma - lo) / max(hi - lo, 1e-6))


def key_glow(a, lo, hi):
    """Luminance key for emissive subjects on black."""
    lum = a @ np.array([0.299, 0.587, 0.114], np.float32)
    return smoothstep((lum - lo) / max(hi - lo, 1e-6))


def decontaminate(a, alpha, bg_rgb):
    """Remove background colour bled into semi-transparent edge pixels."""
    bg = np.array(bg_rgb, np.float32)
    safe = np.maximum(alpha, 1e-4)[..., None]
    out = (a - (1.0 - alpha)[..., None] * bg) / safe
    return np.where(alpha[..., None] > 0.98, a, np.clip(out, 0.0, 1.0))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("src")
    p.add_argument("dst")
    p.add_argument("--mode", choices=["chroma", "achroma", "glow"], default="chroma")
    p.add_argument("--key", default="00C000", help="matte colour hex, chroma mode")
    p.add_argument("--lo", type=float, default=None)
    p.add_argument("--hi", type=float, default=None)
    p.add_argument("--crop-corner", type=float, default=0.0,
                   help="fraction to trim off each side before keying")
    args = p.parse_args()

    im = Image.open(args.src).convert("RGB")
    if args.crop_corner > 0:
        w, h = im.size
        dx, dy = int(w * args.crop_corner), int(h * args.crop_corner)
        im = im.crop((dx, dy, w - dx, h - dy))

    a = np.asarray(im, np.float32) / 255.0

    if args.mode == "chroma":
        kr = tuple(int(args.key[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
        lo = 0.18 if args.lo is None else args.lo
        hi = 0.34 if args.hi is None else args.hi
        alpha = key_chroma(a, kr, lo, hi)
        rgb = decontaminate(a, alpha, kr)
    elif args.mode == "achroma":
        lo = 0.06 if args.lo is None else args.lo
        hi = 0.16 if args.hi is None else args.hi
        alpha = key_achroma(a, lo, hi)
        rgb = decontaminate(a, alpha, (0.72, 0.72, 0.72))
    else:
        lo = 0.02 if args.lo is None else args.lo
        hi = 0.30 if args.hi is None else args.hi
        alpha = key_glow(a, lo, hi)
        rgb = a  # keep emissive falloff intact

    out = np.dstack([rgb, alpha])
    Image.fromarray((out * 255).astype(np.uint8), "RGBA").save(args.dst)

    solid = (alpha > 0.5).mean() * 100
    print(f"{args.dst}: {im.size[0]}x{im.size[1]}, solid {solid:.1f}% of frame")
    if solid < 2:
        print("  WARNING: almost nothing kept — wrong --key or wrong --mode?",
              file=sys.stderr)
    if solid > 90:
        print("  WARNING: almost nothing removed — background may not be flat.",
              file=sys.stderr)
    if args.mode == "glow":
        print("  composite with Screen or Add, not Normal")


if __name__ == "__main__":
    main()
