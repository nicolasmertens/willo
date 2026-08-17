#!/usr/bin/env python3
"""Tiny eval: liedjes tiles stay 154px, never smash, pop cannot overlap."""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
tmpl = (ROOT / "templates/taal.html").read_text()
papa = (ROOT / "papa/index.html").read_text()
tracks = (ROOT / "tracks/papa-liedjes.json").read_text()
fails = []


def css_block(src, selector):
    m = re.search(re.escape(selector) + r" \{([^}]+)\}", src)
    return m.group(1) if m else ""


def has_auto(block, prop):
    return bool(re.search(rf"{prop}:\s*auto", block))


# 1. grid track
if ".grid { display: grid; grid-template-columns: repeat(auto-fill, 154px);" not in tmpl:
    fails.append("grid track is not 154px")

# 2. tile-audio img must not be native-size
for label, src in (("template", tmpl), ("papa", papa)):
    block = css_block(src, ".tile.tile-audio img")
    if not block:
        fails.append(f"{label} missing tile-audio img rule")
        continue
    if has_auto(block, "width") or has_auto(block, "height"):
        fails.append(f"{label} tile-audio img uses auto (native px smash)")
    if "width: 100%" not in block:
        fails.append(f"{label} tile-audio img is not width 100%")

# 3. directional hang: 12px on 1-2 sides, never a 196px 4-side sticker
pop = css_block(tmpl, ".tile.tile-audio.tile-pop img")
if not pop:
    fails.append("missing tile-pop img rule")
else:
    if has_auto(pop, "width") or has_auto(pop, "height"):
        fails.append("tile-pop img uses auto")
    if "196px" in pop:
        fails.append("tile-pop still uses 196px 4-side hang")
    if "--hang: 12px" not in pop:
        fails.append("tile-pop hang is not 12px")
    if "154px" not in pop:
        fails.append("tile-pop base size is not 154px")
    gap_m = re.search(r"section\.liedjes \.grid \{[^}]*gap:\s*(\d+)px", tmpl)
    gap = int(gap_m.group(1)) if gap_m else 14
    if 12 > gap - 2:
        fails.append(f"12px hang exceeds liedjes gap {gap}px (smash if neighbor fights)")
    for side in ("over-right", "over-left", "over-top", "over-bottom"):
        if f".tile.tile-audio.tile-pop.{side} img" not in tmpl:
            fails.append(f"missing {side} CSS")
    if "assignOverflow" not in tmpl and "/*__OVERFLOW_ASSIGN__*/" not in tmpl:
        fails.append("template missing overflow assigner hook")

# 4. papa house: 6 overflow pngs + croc jpg
if tracks.count(".png") < 6:
    fails.append("papa-liedjes should have 6 overflow png icons")
if '"liedjes/icons/01.jpg"' not in tracks:
    fails.append("crocodile lead must stay 01.jpg")
if tracks.count('"face"') < 7:
    fails.append("every papa liedje needs a face color")

print(f"checks: 8  fails: {len(fails)}")
for f in fails:
    print("FAIL", f)
if fails:
    sys.exit(1)
print("PASS tile layout")
