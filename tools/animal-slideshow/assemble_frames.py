#!/usr/bin/env python3
"""Assemble the generated animal illustrations into klas track #9 frames.

Reads animals.tsv (n, t, ANIMAL) + gen/<NN>_<ANIMAL>.png, writes
klas/liedjes/frames/09/<NNNN>.jpg (640w) and rewrites the track's `frames`
array with the name-card timestamps. Audio (09.mp3) is left untouched.
"""
import json, subprocess, sys
from pathlib import Path

SP = Path("/private/tmp/claude-501/-Users-nico/704e902b-c061-486b-8ef5-292c7c10714d/scratchpad")
REPO = Path.home() / "code/liedjes"
FRAMES = REPO / "klas/liedjes/frames/09"
MANIFEST = REPO / "tracks/klas-liedjes.json"

rows = []
for line in (SP / "animals.tsv").read_text().splitlines():
    if not line.strip():
        continue
    n, t, animal = line.split("\t")
    rows.append((int(n), float(t), animal))

missing = [a for n, t, a in rows if not (SP / "gen" / f"{n:02d}_{a}.png").exists()]
if missing:
    print(f"MISSING {len(missing)} images: {missing}")
    sys.exit(1)

# clear old frames
if FRAMES.exists():
    for f in FRAMES.glob("*"):
        f.unlink()
FRAMES.mkdir(parents=True, exist_ok=True)

frames = []
for n, t, animal in rows:
    src = SP / "gen" / f"{n:02d}_{animal}.png"
    dst = FRAMES / f"{n:04d}.jpg"
    subprocess.run([
        "magick", str(src), "-resize", "640x640", "-background", "#fdf6d8",
        "-flatten", "-quality", "88", str(dst),
    ], check=True)
    frames.append({"t": t, "src": f"liedjes/frames/09/{n:04d}.jpg"})

data = json.loads(MANIFEST.read_text())
for tr in data["tracks"]:
    if tr["n"] == 9:
        tr["title"] = "Animal Sounds"
        tr["frames"] = frames
        tr["icon"] = "liedjes/icons/09.jpg"
        break
MANIFEST.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
print(f"wrote {len(frames)} frames; t {frames[0]['t']}..{frames[-1]['t']}")
