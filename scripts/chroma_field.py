#!/usr/bin/env python3
"""Flood-fill field color from corners → transparent PNG for tile-pop."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


def dist2(a, b):
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2


def flood_alpha(im: Image.Image, thresh: int = 48) -> Image.Image:
    rgba = im.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    samples = [px[2, 2][:3], px[w - 3, 2][:3], px[2, h - 3][:3], px[w - 3, h - 3][:3]]
    field = tuple(sum(c[i] for c in samples) // 4 for i in range(3))
    t2 = thresh * thresh
    seen = bytearray(w * h)
    stack = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (0, h // 2), (w - 1, h // 2), (w // 2, h - 1)]
    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        r, g, b, a = px[x, y]
        if dist2((r, g, b), field) > t2:
            continue
        px[x, y] = (r, g, b, 0)
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    # soften a 1px fringe next to transparent
    src = rgba.copy()
    sp = src.load()
    for y in range(h):
        for x in range(w):
            if sp[x, y][3] != 0:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and sp[nx, ny][3] > 0:
                    r, g, b, a = px[nx, ny]
                    if a > 0:
                        px[nx, ny] = (r, g, b, min(a, 180))
    return rgba


def main():
    if len(sys.argv) < 3:
        print("usage: chroma_field.py IN.jpg OUT.png [thresh]", file=sys.stderr)
        sys.exit(2)
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    thresh = int(sys.argv[3]) if len(sys.argv) > 3 else 48
    im = Image.open(src)
    out = flood_alpha(im, thresh)
    out.thumbnail((512, 512), Image.Resampling.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst, "PNG")
    print(f"wrote {dst} {out.size} thresh={thresh}")


if __name__ == "__main__":
    main()
