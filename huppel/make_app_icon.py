#!/usr/bin/env python3
"""Generate app icons (apple-touch-icon + PWA manifest icons) from icon 01."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).parent
SRC = ROOT / "icons" / "01.jpg"

SIZES = [
    ("apple-touch-icon.png", 180),
    ("icon-192.png", 192),
    ("icon-512.png", 512),
    ("favicon-32.png", 32),
]

src = Image.open(SRC).convert("RGB")
for name, size in SIZES:
    img = src.resize((size, size), Image.LANCZOS)
    img.save(ROOT / name, "PNG", optimize=True)
    print(f"{name}: {size}x{size}")
