#!/usr/bin/env python3
"""Split a verhaal voice-memo into per-page audio + stage images.

Usage:
    python3 tools/verhalen-import.py <input_dir> <taal> <slug>

Input dir must contain:
    audio.m4a (or .mp3 / .wav)  — single recording, ≥1s silence between pages
    page-01.jpg ... page-NN.jpg — page photos in reading order

Output (relative to repo root):
    <taal>/verhalen/<slug>/page-01.mp3 ... page-NN.mp3  (split + loudnorm)
    <taal>/verhalen/<slug>/page-01.jpg ... page-NN.jpg  (resized 1600px long edge)
    <taal>/verhalen/icons/<slug>.jpg                    (cover = first page, 400px square)

Prints a JSON entry stub for tracks/<taal>-verhalen.json.
"""
import sys, re, json, subprocess
from pathlib import Path

SILENCE_DB = -30
SILENCE_DUR_MIN = 0.8
LOUDNORM = "loudnorm=I=-16:TP=-1.5:LRA=11"
IMG_MAX_PX = 1600
JPEG_Q = 85
ICON_PX = 400
APP_ROOT = Path(__file__).resolve().parent.parent


def detect_silences(audio):
    cmd = ["ffmpeg", "-i", str(audio),
           "-af", f"silencedetect=noise={SILENCE_DB}dB:d={SILENCE_DUR_MIN}",
           "-f", "null", "-"]
    out = subprocess.run(cmd, capture_output=True, text=True).stderr
    silences, cur = [], None
    for line in out.split("\n"):
        m = re.search(r"silence_start: ([0-9.]+)", line)
        if m: cur = float(m.group(1))
        m = re.search(r"silence_end: ([0-9.]+)", line)
        if m and cur is not None:
            silences.append((cur, float(m.group(1))))
            cur = None
    return silences


def duration(audio):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(audio)],
        capture_output=True, text=True).stdout.strip()
    return float(out)


def sips_dims(p):
    out = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(p)],
                         capture_output=True, text=True).stdout
    w = int(re.search(r"pixelWidth: (\d+)", out).group(1))
    h = int(re.search(r"pixelHeight: (\d+)", out).group(1))
    return w, h


def main():
    if len(sys.argv) < 4:
        print(__doc__); sys.exit(1)
    in_dir = Path(sys.argv[1]).expanduser().resolve()
    taal = sys.argv[2]
    slug = sys.argv[3]
    if taal not in {"mama", "papa", "klas"}:
        sys.exit(f"taal must be mama|papa|klas, got: {taal}")
    if not in_dir.is_dir():
        sys.exit(f"Not a directory: {in_dir}")

    audio = next((p for p in sorted(in_dir.iterdir())
                  if p.suffix.lower() in {".m4a", ".mp3", ".wav"}), None)
    if not audio:
        sys.exit(f"No audio file (m4a/mp3/wav) in {in_dir}")

    pages = sorted(p for p in in_dir.iterdir()
                   if re.match(r"page-\d+\.(jpe?g|png)$", p.name, re.I))
    if not pages:
        sys.exit(f"No page-NN.jpg files in {in_dir}")
    n = len(pages)
    print(f"audio: {audio.name}")
    print(f"pages: {n}")

    sils = detect_silences(audio)
    total = duration(audio)
    print(f"audio length: {total:.1f}s")
    print(f"detected silences ≥{SILENCE_DUR_MIN}s @ {SILENCE_DB}dB: {len(sils)}")

    if len(sils) != n - 1:
        print(f"\nMismatch: {len(sils)} silences vs {n-1} expected page-breaks.")
        print("Try adjusting SILENCE_DB / SILENCE_DUR_MIN at top of script,")
        print("or insert clearer pauses while recording.")
        for s, e in sils:
            print(f"  silence {s:.2f}s → {e:.2f}s  ({e-s:.2f}s)")
        sys.exit(2)

    cuts = [0.0] + [(s + e) / 2 for s, e in sils] + [total]

    out_dir = APP_ROOT / taal / "verhalen" / slug
    out_dir.mkdir(parents=True, exist_ok=True)

    for i in range(n):
        start, end = cuts[i], cuts[i + 1]
        dur = end - start
        out_mp3 = out_dir / f"page-{i+1:02d}.mp3"
        subprocess.run(
            ["ffmpeg", "-y", "-ss", str(start), "-t", str(dur),
             "-i", str(audio), "-af", LOUDNORM,
             "-c:a", "libmp3lame", "-q:a", "4", str(out_mp3)],
            capture_output=True, check=True)
        print(f"  → {out_mp3.relative_to(APP_ROOT)} ({dur:.1f}s)")

    for i, p in enumerate(pages):
        out_img = out_dir / f"page-{i+1:02d}.jpg"
        subprocess.run(
            ["sips", "-s", "format", "jpeg", "-s", "formatOptions", str(JPEG_Q),
             "-Z", str(IMG_MAX_PX), str(p), "--out", str(out_img)],
            capture_output=True, check=True)
        print(f"  → {out_img.relative_to(APP_ROOT)}")

    icons_dir = APP_ROOT / taal / "verhalen" / "icons"
    icons_dir.mkdir(parents=True, exist_ok=True)
    icon = icons_dir / f"{slug}.jpg"
    first = out_dir / "page-01.jpg"
    w, h = sips_dims(first)
    s = min(w, h)
    subprocess.run(["sips", "-c", str(s), str(s), str(first), "--out", str(icon)],
                   capture_output=True)
    subprocess.run(["sips", "-z", str(ICON_PX), str(ICON_PX), str(icon), "--out", str(icon)],
                   capture_output=True)
    print(f"  → {icon.relative_to(APP_ROOT)}")

    entry = {
        "n": "???REPLACE???",
        "title": "???REPLACE???",
        "icon": f"verhalen/icons/{slug}.jpg",
        "pages": [
            {"img": f"verhalen/{slug}/page-{i+1:02d}.jpg",
             "audio": f"verhalen/{slug}/page-{i+1:02d}.mp3"}
            for i in range(n)
        ],
    }
    print(f"\nAppend to tracks/{taal}-verhalen.json (and set n + title):")
    print(json.dumps(entry, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
