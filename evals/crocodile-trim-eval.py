#!/usr/bin/env python3
"""Tiny eval: mama crocodile mp3 is only the crocodile song.

Pass bar: all checks pass.
  duration 87–91s
  full transcript names crocodile + closing licorne
  full transcript has none of the next-song / host tokens
  cache-bust rev is in tracks json and mama/index.html
"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
fails = []

AUDIO = ROOT / "mama/liedjes/audio/03.mp3"
TRACKS = ROOT / "tracks/mama-liedjes.json"
INDEX = ROOT / "mama/index.html"

FORBIDDEN = (
    "souris",
    "herbe",
    "petit loup",
    "autre chanson",
    "escargot",
    "culotte",
)
REQUIRED = ("crocodile", "crocodiles")


def ffprobe_dur(path: Path) -> float:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        text=True,
    ).strip()
    return float(out)


def whisper(path: Path, name: str, out_dir: Path) -> str:
    subprocess.check_call(
        [
            "mlx_whisper",
            "--language", "fr",
            "--model", "mlx-community/whisper-large-v3-turbo",
            "--output-dir", str(out_dir),
            "--output-name", name,
            "--output-format", "txt",
            "--verbose", "False",
            "--condition-on-previous-text", "False",
            str(path),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return (out_dir / f"{name}.txt").read_text(encoding="utf-8").lower()


if not AUDIO.exists():
    fails.append("missing 03.mp3")
else:
    dur = ffprobe_dur(AUDIO)
    if not (87.0 <= dur <= 91.0):
        fails.append(f"duration {dur:.1f}s not 87-91s (crocodile-only)")
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        txt = whisper(AUDIO, "full", td)
        if not any(tok in txt for tok in REQUIRED):
            fails.append(f"transcript missing crocodile: {txt[:180]!r}")
        hit = [tok for tok in FORBIDDEN if tok in txt]
        if hit:
            fails.append(f"transcript leaked next song {hit}: {txt[:240]!r}")
        if "licorne" not in txt:
            fails.append(f"transcript missing closing licorne: {txt[-180:]!r}")

manifest = json.loads(TRACKS.read_text())
track = next((t for t in manifest["tracks"] if t.get("n") == 3), None)
if not track:
    fails.append("track n=3 missing")
else:
    if track.get("title") != "Il y avait de gros crocodiles":
        fails.append(f"title {track.get('title')!r}")
    if track.get("rev") is None:
        fails.append("missing audio rev (cache bust)")

html = INDEX.read_text()
if "Il y avait de gros crocodiles" not in html:
    fails.append("mama index missing title")
blob = re.search(r"\{[^{}]*Il y avait de gros crocodiles[^{}]*\}", html)
if not blob or not re.search(r'"rev":\s*2', blob.group(0)):
    fails.append("mama index crocodile track missing rev cache bust")

print(f"checks: 6  fails: {len(fails)}")
for f in fails:
    print("FAIL", f)
if fails:
    sys.exit(1)
print("PASS crocodile-trim")
