#!/usr/bin/env python3
"""Tiny eval: Olifantje in het bos audio + overflow tree tile."""
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
fails = []

manifest = json.loads((ROOT / "tracks/papa-liedjes.json").read_text())
track = next((t for t in manifest["tracks"] if t.get("n") == 8), None)
if not track:
    fails.append("track 8 missing")
else:
    if track.get("title") != "Olifantje in het bos":
        fails.append(f"title {track.get('title')!r}")
    if track.get("icon") != "liedjes/icons/08.png":
        fails.append("icon not 08.png")
    if "top" not in (track.get("over") or []):
        fails.append("over missing top (tree)")
    if "right" not in (track.get("over") or []):
        fails.append("over missing right (trunk)")

audio = ROOT / "papa/liedjes/audio/08.mp3"
png_path = ROOT / "papa/liedjes/icons/08.png"
jpg_path = ROOT / "papa/liedjes/icons/08.jpg"
if not audio.exists():
    fails.append("missing 08.mp3")
else:
    dur = float(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "csv=p=0", str(audio),
    ], text=True).strip())
    if not (100 <= dur <= 110):
        fails.append(f"duration {dur:.1f}s not ~1:42-1:46")

if not png_path.exists():
    fails.append("missing 08.png")
else:
    im = Image.open(png_path).convert("RGBA")
    w, h = im.size
    if w != 512 or h != 512:
        fails.append(f"png size {im.size} not 512")
    tl = im.getpixel((2, 2))[3]
    tr = im.getpixel((w - 8, 8))
    if tl > 40:
        fails.append("top-left cream not transparent")
    if tr[3] < 200 or tr[1] < 100:
        fails.append("top-right tree not opaque green")

if not jpg_path.exists():
    fails.append("missing 08.jpg still")

papa = (ROOT / "papa/index.html").read_text()
if "Olifantje in het bos" not in papa:
    fails.append("papa index missing title")

print(f"checks: 6  fails: {len(fails)}")
for f in fails:
    print("FAIL", f)
if fails:
    sys.exit(1)
print("PASS olifantje")
