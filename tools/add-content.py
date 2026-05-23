#!/usr/bin/env python3
"""Add a single track to a taal/sectie. One command, no questions asked.

Usage:
  tools/add-content.py <taal> <sectie> <source> "<title>" [--icon <path>] [--no-push]

  taal    papa | mama | klas
  sectie  liedjes | boeken | verhalen
  source  YouTube URL, direct mp3 URL, or local file path
  title   shown in the app

Examples:
  tools/add-content.py papa liedjes "https://youtube.com/watch?v=RYsBFdJ6XoA" "En de krokodil"
  tools/add-content.py mama verhalen ~/Desktop/conte.mp3 "Le Petit Chaperon Rouge"
  tools/add-content.py klas boeken https://example.com/x.mp3 "Story" --icon ~/cover.jpg

Auto-numbers the track, downloads audio + cover, runs render.py, commits, pushes.
"""

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
TALEN = {"papa", "mama", "klas"}
SECTIES = {"liedjes", "boeken", "verhalen"}


def fail(msg, code=1):
    print(f"\033[31m✗\033[0m {msg}", file=sys.stderr)
    sys.exit(code)


def ok(msg):
    print(f"\033[32m✓\033[0m {msg}")


def info(msg):
    print(f"  {msg}")


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, **kw)


def next_track_number(manifest_path: Path) -> int:
    data = json.loads(manifest_path.read_text())
    nums = [t.get("n", 0) for t in data.get("tracks", [])]
    return (max(nums) + 1) if nums else 1


def is_url(s: str) -> bool:
    return s.startswith(("http://", "https://"))


def is_youtube(url: str) -> bool:
    host = urlparse(url).hostname or ""
    return any(h in host for h in ("youtube.com", "youtu.be", "music.youtube.com"))


def download_youtube(url: str, audio_dst: Path, icon_dst: Path):
    audio_dst.parent.mkdir(parents=True, exist_ok=True)
    icon_dst.parent.mkdir(parents=True, exist_ok=True)
    stem = audio_dst.with_suffix("")
    info(f"yt-dlp → {audio_dst.name}")
    run([
        "yt-dlp", "-x", "--audio-format", "mp3", "--audio-quality", "0",
        "-o", f"{stem}.%(ext)s",
        "--write-thumbnail", "--convert-thumbnails", "jpg",
        url,
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    thumb = stem.with_suffix(".jpg")
    if thumb.exists():
        info(f"ffmpeg crop thumbnail → {icon_dst.name}")
        run([
            "ffmpeg", "-y", "-i", str(thumb),
            "-vf", "crop='min(iw,ih)':'min(iw,ih)',scale=512:512",
            "-q:v", "3", str(icon_dst),
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        thumb.unlink()
    else:
        info("(no thumbnail; generating placeholder icon)")
        generate_placeholder_icon(audio_dst.stem, icon_dst)


def download_direct(url: str, audio_dst: Path):
    audio_dst.parent.mkdir(parents=True, exist_ok=True)
    info(f"curl → {audio_dst.name}")
    run(["curl", "-fsSL", "-o", str(audio_dst), url])


def copy_local(src: Path, audio_dst: Path):
    audio_dst.parent.mkdir(parents=True, exist_ok=True)
    info(f"copy {src.name} → {audio_dst.name}")
    shutil.copy2(src, audio_dst)


def install_icon(icon_src: Path, icon_dst: Path):
    icon_dst.parent.mkdir(parents=True, exist_ok=True)
    info(f"ffmpeg crop icon → {icon_dst.name}")
    run([
        "ffmpeg", "-y", "-i", str(icon_src),
        "-vf", "crop='min(iw,ih)':'min(iw,ih)',scale=512:512",
        "-q:v", "3", str(icon_dst),
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def generate_placeholder_icon(label: str, icon_dst: Path):
    icon_dst.parent.mkdir(parents=True, exist_ok=True)
    letter = (label[0] if label else "?").upper()
    run([
        "magick", "-size", "512x512",
        "-define", "gradient:angle=135",
        "gradient:#ffd8a8-#ffa94d",
        "-gravity", "center",
        "-font", "/System/Library/Fonts/SFNS.ttf",
        "-pointsize", "280", "-fill", "#2b2b2b",
        "-annotate", "+0+0", letter,
        str(icon_dst),
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("taal", choices=sorted(TALEN))
    p.add_argument("sectie", choices=sorted(SECTIES))
    p.add_argument("source", help="YouTube URL, direct mp3 URL, or local file path")
    p.add_argument("title", help="Track title shown in the app")
    p.add_argument("--icon", help="Optional path to icon image (square, will be cropped to 512)")
    p.add_argument("--no-push", action="store_true", help="Skip git push (still commits)")
    p.add_argument("--no-commit", action="store_true", help="Skip git commit and push")
    args = p.parse_args()

    manifest_path = ROOT / f"tracks/{args.taal}-{args.sectie}.json"
    if not manifest_path.exists():
        fail(f"Manifest not found: {manifest_path}")

    n = next_track_number(manifest_path)
    base = ROOT / args.taal / args.sectie
    audio_dst = base / "audio" / f"{n:02d}.mp3"
    icon_dst = base / "icons" / f"{n:02d}.jpg"

    if audio_dst.exists():
        fail(f"Target already exists: {audio_dst} — bump up tracks/{args.taal}-{args.sectie}.json first")

    # Audio + (optional) auto-icon
    if is_url(args.source):
        if is_youtube(args.source):
            download_youtube(args.source, audio_dst, icon_dst)
        else:
            download_direct(args.source, audio_dst)
            if not args.icon and not icon_dst.exists():
                generate_placeholder_icon(args.title, icon_dst)
    else:
        src = Path(args.source).expanduser().resolve()
        if not src.exists():
            fail(f"Source file not found: {src}")
        copy_local(src, audio_dst)
        if not args.icon and not icon_dst.exists():
            generate_placeholder_icon(args.title, icon_dst)

    # Explicit icon override
    if args.icon:
        icon_src = Path(args.icon).expanduser().resolve()
        if not icon_src.exists():
            fail(f"Icon file not found: {icon_src}")
        install_icon(icon_src, icon_dst)

    # Update manifest
    data = json.loads(manifest_path.read_text())
    data.setdefault("tracks", []).append({
        "n": n,
        "title": args.title,
        "audio": f"{args.sectie}/audio/{n:02d}.mp3",
        "icon": f"{args.sectie}/icons/{n:02d}.jpg",
    })
    manifest_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    ok(f"manifest updated: track #{n} in {args.taal}/{args.sectie}")

    # Render
    info("render.py …")
    run(["python3", "render.py", args.taal], cwd=ROOT, stdout=subprocess.DEVNULL)
    ok("rendered")

    if args.no_commit:
        ok("done (no commit)")
        return

    # Git
    run(["git", "add",
         f"{args.taal}/{args.sectie}/audio/{n:02d}.mp3",
         f"{args.taal}/{args.sectie}/icons/{n:02d}.jpg",
         str(manifest_path.relative_to(ROOT)),
         f"{args.taal}/"], cwd=ROOT)
    msg = f"feat({args.taal}/{args.sectie}): add '{args.title}'"
    try:
        run(["git", "commit", "-m", msg], cwd=ROOT, stdout=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        fail("git commit failed (nothing staged?)")
    ok(f"committed: {msg}")

    if args.no_push:
        ok("done (no push)")
        return

    info("git pull --rebase + push …")
    run(["git", "pull", "--rebase"], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    run(["git", "push"], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    ok("pushed — GH Pages deploy ~30s, PWA auto-reloads on next focus")


if __name__ == "__main__":
    main()
