#!/usr/bin/env python3
"""Tiny eval: liedjes tiles must stay 154px and never use img width/height auto."""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
tmpl = (ROOT / "templates/taal.html").read_text()
fails = []

if "width: auto" in tmpl and "tile-audio img" in tmpl:
    # only fail if the tile-audio img block still sets auto
    m = re.search(r"\.tile\.tile-audio img \{([^}]+)\}", tmpl)
    if m and re.search(r"width:\s*auto", m.group(1)):
        fails.append("tile-audio img still has width:auto (native px smash)")
    if m and re.search(r"height:\s*auto", m.group(1)):
        fails.append("tile-audio img still has height:auto")

if ".grid { display: grid; grid-template-columns: repeat(auto-fill, 154px);" not in tmpl:
    fails.append("grid track is not 154px")

# rendered papa page must inherit the fix
papa = (ROOT / "papa/index.html").read_text()
m = re.search(r"\.tile\.tile-audio img \{([^}]+)\}", papa)
if not m:
    fails.append("papa/index.html missing tile-audio img rule")
else:
    if re.search(r"width:\s*auto", m.group(1)):
        fails.append("papa rendered CSS still width:auto")
    if not re.search(r"width:\s*100%", m.group(1)):
        fails.append("papa tile-audio img is not width 100%")

print(f"checks: 4  fails: {len(fails)}")
for f in fails:
    print("FAIL", f)
if fails:
    sys.exit(1)
print("PASS tile layout")
