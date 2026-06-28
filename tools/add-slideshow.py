#!/usr/bin/env python3
"""Add a slideshow track: stills that change in sync with the audio.

Unlike add-content.py (one static icon), this downloads the video, detects every
scene cut, and stores one frame per scene with its timestamp. The player swaps
the still as the song plays. See docs/superpowers/specs/2026-06-28-timed-slideshow-tracks-design.md

Usage:
  tools/add-slideshow.py <taal> <sectie> <youtube-url> "<title>" [--threshold 0.3] [--no-push] [--no-commit]

  taal       papa | mama | klas
  sectie     liedjes | boeken | verhalen
  threshold  scene-detection sensitivity (lower = more frames). default 0.3

Example:
  tools/add-slideshow.py klas liedjes "https://www.youtube.com/watch?v=DkW9Gin8W1o" "Animal Sounds"

Auto-numbers the track, extracts audio + per-scene frames, builds the `frames`
array, runs render.py, commits, pushes. Reports the detected frame count.
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

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


def download_video(url: str, dst: Path):
    info(f"yt-dlp → {dst.name} (≤720p, muxed)")
    run([
        "yt-dlp", "--no-update",
        "-f", "bv*[height<=720]+ba/b[height<=720]/b",
        "--merge-output-format", "mp4",
        "-o", str(dst),
        url,
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if not dst.exists():
        fail("yt-dlp produced no file")


def extract_audio(video: Path, dst: Path):
    dst.parent.mkdir(parents=True, exist_ok=True)
    info(f"ffmpeg audio → {dst.name}")
    run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(video), "-vn", "-ac", "1", "-ar", "44100", "-b:a", "96k",
        str(dst),
    ])


def extract_frames(video: Path, frames_dir: Path, threshold: float):
    """One ffmpeg pass: select frame 0 + every scene cut, scale to 640w, log times.

    Returns the list of timestamps (seconds); frame i -> timestamps[i].
    """
    frames_dir.mkdir(parents=True, exist_ok=True)
    log_path = frames_dir.parent / "_scene.log"
    vf = f"select='eq(n\\,0)+gt(scene\\,{threshold})',showinfo,scale=640:-2"
    info(f"ffmpeg scene-detect (threshold={threshold}) → {frames_dir.name}/")
    with open(log_path, "w") as logf:
        subprocess.run([
            "ffmpeg", "-y", "-hide_banner",
            "-i", str(video),
            "-vf", vf, "-vsync", "vfr", "-q:v", "3",
            str(frames_dir / "%04d.jpg"),
        ], stdout=subprocess.DEVNULL, stderr=logf, check=True)
    log = log_path.read_text()
    times = [float(m) for m in re.findall(r"pts_time:([0-9.]+)", log)]
    log_path.unlink(missing_ok=True)
    jpgs = sorted(frames_dir.glob("*.jpg"))
    if not jpgs:
        fail("no frames extracted")
    # showinfo emits one pts_time per selected (=extracted) frame, in order.
    if len(times) != len(jpgs):
        info(f"warn: {len(times)} timestamps vs {len(jpgs)} frames; truncating to min")
    n = min(len(times), len(jpgs))
    # Guarantee a frame at t=0 even if the first scene time drifted.
    times = times[:n]
    if times:
        times[0] = 0.0
    return jpgs[:n], times


def make_icon(frame: Path, icon_dst: Path):
    icon_dst.parent.mkdir(parents=True, exist_ok=True)
    info(f"ffmpeg square icon → {icon_dst.name}")
    run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(frame),
        "-vf", "crop='min(iw,ih)':'min(iw,ih)',scale=512:512",
        "-q:v", "3", str(icon_dst),
    ])


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("taal", choices=sorted(TALEN))
    p.add_argument("sectie", choices=sorted(SECTIES))
    p.add_argument("url", help="YouTube URL")
    p.add_argument("title", help="Track title shown in the app")
    p.add_argument("--threshold", type=float, default=0.3, help="scene-detection sensitivity (default 0.3)")
    p.add_argument("--no-push", action="store_true")
    p.add_argument("--no-commit", action="store_true")
    args = p.parse_args()

    manifest_path = ROOT / f"tracks/{args.taal}-{args.sectie}.json"
    if not manifest_path.exists():
        fail(f"Manifest not found: {manifest_path}")

    n = next_track_number(manifest_path)
    base = ROOT / args.taal / args.sectie
    audio_dst = base / "audio" / f"{n:02d}.mp3"
    icon_dst = base / "icons" / f"{n:02d}.jpg"
    frames_dir = base / "frames" / f"{n:02d}"

    if audio_dst.exists() or frames_dir.exists():
        fail(f"Target already exists for track #{n} in {args.taal}/{args.sectie}")

    with tempfile.TemporaryDirectory() as td:
        video = Path(td) / "video.mp4"
        download_video(args.url, video)
        extract_audio(video, audio_dst)
        jpgs, times = extract_frames(video, frames_dir, args.threshold)

    # Rename frames to clean 1-based sequence and build the frames array.
    frames = []
    for i, (jpg, t) in enumerate(zip(jpgs, times), start=1):
        final = frames_dir / f"{i:04d}.jpg"
        if jpg != final:
            jpg.rename(final)
        frames.append({"t": round(t, 2), "src": f"{args.sectie}/frames/{n:02d}/{i:04d}.jpg"})
    # Drop any leftover jpgs beyond n (if timestamps were fewer than frames).
    for leftover in frames_dir.glob("*.jpg"):
        if leftover.name not in {f"{i:04d}.jpg" for i in range(1, len(frames) + 1)}:
            leftover.unlink()

    make_icon(frames_dir / "0001.jpg", icon_dst)
    ok(f"{len(frames)} frames detected for track #{n}")

    # Update manifest
    data = json.loads(manifest_path.read_text())
    data.setdefault("tracks", []).append({
        "n": n,
        "title": args.title,
        "audio": f"{args.sectie}/audio/{n:02d}.mp3",
        "icon": f"{args.sectie}/icons/{n:02d}.jpg",
        "frames": frames,
    })
    manifest_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    ok(f"manifest updated: track #{n} in {args.taal}/{args.sectie}")

    info("render.py …")
    run(["python3", "render.py", args.taal], cwd=ROOT, stdout=subprocess.DEVNULL)
    ok("rendered")

    if args.no_commit:
        ok("done (no commit)")
        return

    run(["git", "add",
         f"{args.taal}/{args.sectie}/audio/{n:02d}.mp3",
         f"{args.taal}/{args.sectie}/icons/{n:02d}.jpg",
         f"{args.taal}/{args.sectie}/frames/{n:02d}/",
         str(manifest_path.relative_to(ROOT)),
         f"{args.taal}/"], cwd=ROOT)
    msg = f"feat({args.taal}/{args.sectie}): add slideshow '{args.title}' ({len(frames)} scenes)"
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
