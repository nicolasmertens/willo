#!/usr/bin/env python3
"""
Uniform tile images from raw photos:
  1. EXIF auto-rotate.
  2. Optional manual rotation override (per stem).
  3. Auto-crop borders (table/desk dark strips around the page).
  4. Center on a square canvas (white pad) at fixed size.

We keep the page content as-is — the original icon + word stays visible
exactly like in the book. Only the framing is uniformised.
"""
import sys
import json
import colorsys
from pathlib import Path
from PIL import Image, ImageOps
import numpy as np

RAW_DIR = Path(__file__).parent / "raw"
OUT_DIR = Path(__file__).parent / "icons"
OUT_DIR.mkdir(exist_ok=True)

CANVAS = 800
PAD_RATIO = 0.04
DARK_BORDER_LUM = 70   # luminance below this is "table/desk" border to crop

# Manual rotation override (degrees clockwise) applied AFTER EXIF transpose.
MANUAL_ROTATE = {}


def autocrop_dark_borders(img):
    """Remove dark table/desk strips on the edges by row/column scanning.
    A row/col is 'border' if its mean luminance < DARK_BORDER_LUM."""
    arr = np.array(img.convert("RGB"))
    lum = arr.mean(axis=2)
    h, w = lum.shape

    row_mean = lum.mean(axis=1)
    col_mean = lum.mean(axis=0)

    top = 0
    while top < h and row_mean[top] < DARK_BORDER_LUM:
        top += 1
    bot = h
    while bot > top and row_mean[bot-1] < DARK_BORDER_LUM:
        bot -= 1
    left = 0
    while left < w and col_mean[left] < DARK_BORDER_LUM:
        left += 1
    right = w
    while right > left and col_mean[right-1] < DARK_BORDER_LUM:
        right -= 1

    if right - left < 10 or bot - top < 10:
        return img  # nothing meaningful to crop
    return img.crop((left, top, right, bot))


def dominant_panel_color(img):
    """Find the dominant *colored* panel hex (skipping near-white panel and
    near-black outlines). k-means with k=4, pick cluster with highest
    saturation among those that aren't almost-white or almost-black."""
    arr = np.array(img.convert("RGB")).reshape(-1, 3).astype(np.float32)
    if len(arr) > 20000:
        idx = np.random.RandomState(0).choice(len(arr), 20000, replace=False)
        arr = arr[idx]

    # k-means k=4
    K = 4
    rng = np.random.RandomState(0)
    centers = arr[rng.choice(len(arr), K, replace=False)].copy()
    for _ in range(15):
        d = ((arr[:, None, :] - centers[None, :, :]) ** 2).sum(axis=2)
        assign = d.argmin(axis=1)
        for k in range(K):
            mask = assign == k
            if mask.any():
                centers[k] = arr[mask].mean(axis=0)

    sizes = np.array([(assign == k).sum() for k in range(K)])

    # Score each cluster: saturation * size, but reject near-white / near-black
    best = None
    best_score = -1.0
    for k in range(K):
        r, g, b = centers[k] / 255.0
        h, l, s = colorsys.rgb_to_hls(r, g, b)
        # reject near-white (very light) and near-black (very dark / outline)
        if l > 0.92 or l < 0.18:
            continue
        if s < 0.10:
            continue
        score = s * (sizes[k] ** 0.5)  # weighted: prefer saturated AND large
        if score > best_score:
            best_score = score
            best = centers[k]

    if best is None:
        # fallback: largest non-white cluster
        order = np.argsort(-sizes)
        for k in order:
            r, g, b = centers[k] / 255.0
            _, l, _ = colorsys.rgb_to_hls(r, g, b)
            if l < 0.92:
                best = centers[k]
                break
        if best is None:
            best = centers[sizes.argmax()]

    rgb = tuple(int(round(c)) for c in best)
    return "#{:02x}{:02x}{:02x}".format(*rgb)


def fit_on_canvas(img, canvas=CANVAS, pad_ratio=PAD_RATIO):
    inner = int(canvas * (1 - 2 * pad_ratio))
    w, h = img.size
    scale = inner / max(w, h)
    new_w, new_h = max(1, int(w * scale)), max(1, int(h * scale))
    img = img.resize((new_w, new_h), Image.LANCZOS).convert("RGB")

    out = Image.new("RGB", (canvas, canvas), (255, 255, 255))
    out.paste(img, ((canvas - new_w) // 2, (canvas - new_h) // 2))
    return out


def process(path: Path, colors: dict):
    stem = path.stem
    img = Image.open(path)
    img = ImageOps.exif_transpose(img)

    if stem in MANUAL_ROTATE:
        img = img.rotate(-MANUAL_ROTATE[stem], expand=True)

    img = autocrop_dark_borders(img)
    color_hex = dominant_panel_color(img)
    colors[stem] = color_hex

    img = fit_on_canvas(img)

    out_path = OUT_DIR / f"{stem}.jpg"
    img.save(out_path, "JPEG", quality=85, optimize=True)
    print(f"{stem}: {out_path.name}  bg={color_hex}")


def main():
    # Clean stale PNGs from earlier attempts
    for old in OUT_DIR.glob("*.png"):
        old.unlink()

    files = sorted(RAW_DIR.glob("*.jpeg"))
    if len(sys.argv) > 1:
        wanted = set(sys.argv[1:])
        files = [f for f in files if f.stem in wanted]

    colors_path = OUT_DIR / "colors.json"
    colors = {}
    if colors_path.exists():
        try:
            colors = json.loads(colors_path.read_text())
        except Exception:
            colors = {}

    for f in files:
        try:
            process(f, colors)
        except Exception as e:
            print(f"{f.name}: ERROR {e}")

    colors_path.write_text(json.dumps(colors, indent=2, sort_keys=True))
    print(f"wrote {colors_path}")


if __name__ == "__main__":
    main()
