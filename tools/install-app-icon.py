#!/usr/bin/env python3
"""Install a William photo (or any image) as the root PWA icon.

Usage:
  tools/install-app-icon.py <path/to/photo.jpg>

Generates icon-192.png, icon-512.png, apple-touch-icon.png (180x180),
favicon-32.png, all centered-square crops. Commits + pushes.
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

if len(sys.argv) != 2:
    print(__doc__, file=sys.stderr)
    sys.exit(1)

src = Path(sys.argv[1]).expanduser().resolve()
if not src.exists():
    print(f"✗ not found: {src}", file=sys.stderr)
    sys.exit(1)

# 512 PNG master from center-crop
master = ROOT / "icon-512.png"
subprocess.run([
    "ffmpeg", "-y", "-i", str(src),
    "-vf", "crop='min(iw,ih)':'min(iw,ih)',scale=512:512",
    "-q:v", "2", str(master),
], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

for name, size in [("icon-192.png", 192), ("apple-touch-icon.png", 180), ("favicon-32.png", 32)]:
    subprocess.run([
        "magick", str(master), "-resize", f"{size}x{size}", str(ROOT / name),
    ], check=True)

print(f"✓ installed icons from {src.name}")

# Commit + push
subprocess.run(["git", "add", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "favicon-32.png"],
               cwd=ROOT, check=True)
try:
    subprocess.run(["git", "commit", "-m", f"feat(root): install PWA icon from {src.name}"],
                   cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    subprocess.run(["git", "pull", "--rebase"], cwd=ROOT, check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run(["git", "push"], cwd=ROOT, check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("✓ committed + pushed — re-add PWA to home screen to pick up new icon")
except subprocess.CalledProcessError:
    print("(no changes to commit, or push deferred)")
