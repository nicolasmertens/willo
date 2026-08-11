#!/usr/bin/env python3
"""Install audio-qa downloads into the liedjes repo as mp3.

Expects files named like:
  liedjes-rec__papa__games__name__01.m4a
  liedjes-rec__klas__games__fx__jaaa.webm

→  papa/games/name/01.mp3
→  klas/games/fx/jaaa.mp3

Usage:
  python3 tools/audio-qa/install-recordings.py
  python3 tools/audio-qa/install-recordings.py ~/Downloads
  python3 tools/audio-qa/install-recordings.py --dry-run
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PREFIX = "liedjes-rec__"
AUDIO_EXT = {".m4a", ".mp4", ".webm", ".ogg", ".wav", ".mp3", ".aac", ".caf"}


def decode_target(name: str) -> Path | None:
    """liedjes-rec__papa__games__name__01.m4a → papa/games/name/01.mp3"""
    stem = Path(name).stem  # drop ext
    if not stem.startswith(PREFIX):
        return None
    body = stem[len(PREFIX) :]
    parts = body.split("__")
    if len(parts) < 2:
        return None
    # last part is filename stem; rest is directories
    *dirs, file_stem = parts
    rel = Path(*dirs) / f"{file_stem}.mp3"
    # safety: only under known game trees
    allowed_roots = {"klas", "mama", "papa"}
    if not dirs or dirs[0] not in allowed_roots:
        return None
    if ".." in rel.parts:
        return None
    return rel


def to_mp3(src: Path, dest: Path, dry: bool) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dry:
        print(f"[dry] {src.name} → {dest}")
        return
    if src.suffix.lower() == ".mp3":
        shutil.copy2(src, dest)
        print(f"[copy] {src.name} → {dest}")
        return
    cmd = [
        "ffmpeg", "-y", "-i", str(src),
        "-codec:a", "libmp3lame", "-qscale:a", "4",
        str(dest),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    print(f"[mp3]  {src.name} → {dest}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "folder",
        nargs="?",
        default=str(Path.home() / "Downloads"),
        help="Folder with liedjes-rec__* downloads (default: ~/Downloads)",
    )
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    folder = Path(args.folder).expanduser()
    if not folder.is_dir():
        print(f"Not a folder: {folder}", file=sys.stderr)
        return 1

    found = sorted(
        p for p in folder.iterdir()
        if p.is_file() and p.name.startswith(PREFIX) and p.suffix.lower() in AUDIO_EXT
    )
    if not found:
        print(f"No {PREFIX}* audio files in {folder}")
        return 0

    ok = 0
    for src in found:
        rel = decode_target(src.name)
        if not rel:
            print(f"[skip] cannot parse: {src.name}")
            continue
        dest = ROOT / rel
        try:
            to_mp3(src, dest, args.dry_run)
            ok += 1
        except subprocess.CalledProcessError as e:
            print(f"[err]  {src.name}: ffmpeg failed", file=sys.stderr)
            if e.stderr:
                print(e.stderr.decode("utf-8", "replace")[:400], file=sys.stderr)
        except Exception as e:
            print(f"[err]  {src.name}: {e}", file=sys.stderr)

    print(f"Done: {ok}/{len(found)} installed under {ROOT}")
    if ok and not args.dry_run:
        print("Next: commit + push, or tell the agent to ship the new clips.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
