#!/usr/bin/env python3
"""Tiny eval: overflow assigner is 1-2 sides, adjacent only, no neighbor clash."""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JS = ROOT / "scripts/overflow-assign.js"

FIXTURES = [
    {"name": "seven-wide", "n": 7, "cols": 7, "prefs": [
        ["right"], ["right", "left"], ["right", "bottom"],
        ["right", "bottom"], ["left"], ["top", "left"], ["right", "top"],
    ]},
    {"name": "four-col-wrap", "n": 7, "cols": 4, "prefs": [
        ["right"], ["right"], ["right"], ["left"],
        ["left"], ["top"], ["right"],
    ]},
    {"name": "three-col", "n": 7, "cols": 3, "prefs": [["right"]] * 7},
    {"name": "all-left", "n": 5, "cols": 5, "prefs": [["left"]] * 5},
    {"name": "all-right", "n": 5, "cols": 5, "prefs": [["right"]] * 5},
    {"name": "vertical-stack", "n": 4, "cols": 1, "prefs": [["top", "bottom"]] * 4},
    {"name": "single", "n": 1, "cols": 3, "prefs": [["right", "top"]]},
    {"name": "two-fight", "n": 2, "cols": 2, "prefs": [["right"], ["left"]]},
    {"name": "empty-prefs", "n": 4, "cols": 4, "prefs": [[], [], [], []]},
    {"name": "two-row-bottom-top", "n": 6, "cols": 3, "prefs": [
        ["bottom"], ["bottom"], ["bottom"],
        ["top"], ["top"], ["top"],
    ]},
    {"name": "seed-stable", "n": 7, "cols": 4, "prefs": [["right", "top"]] * 7, "twice": True},
    {"name": "narrow-2col", "n": 7, "cols": 2, "prefs": [
        ["right", "bottom"], ["left", "top"], ["right"], ["left"],
        ["bottom"], ["top"], ["right", "top"],
    ]},
    {"name": "pref-blocked-stays-in", "n": 2, "cols": 2, "prefs": [["right"], ["left"]]},
    {"name": "papa-3col-with-croc", "n": 7, "cols": 3, "prefs": [
        None,
        ["right", "left"],
        ["right", "bottom"],
        ["right", "bottom"],
        ["left"],
        ["top", "left"],
        ["right", "top"],
    ]},
    {"name": "papa-4col-with-croc", "n": 7, "cols": 4, "prefs": [
        None,
        ["right", "left"],
        ["right", "bottom"],
        ["right", "bottom"],
        ["left"],
        ["top", "left"],
        ["right", "top"],
    ]},
]


def run_assign(prefs, cols, seed=20260817):
    payload = json.dumps({"prefs": prefs, "cols": cols, "seed": seed})
    script = f"""
const {{ assignOverflow }} = require({json.dumps(str(JS))});
const j = JSON.parse({json.dumps(payload)});
process.stdout.write(JSON.stringify(assignOverflow(j.prefs, j.cols, j.seed)));
"""
    r = subprocess.run(["node", "-e", script], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr or r.stdout)
    return json.loads(r.stdout)


def clash(assigned, cols):
    n = len(assigned)
    for i, sides in enumerate(assigned):
        col, row = i % cols, i // cols
        if "right" in sides and col + 1 < cols and i + 1 < n and "left" in assigned[i + 1]:
            return f"tile {i} right vs {i+1} left"
        if "bottom" in sides and i + cols < n and "top" in assigned[i + cols]:
            return f"tile {i} bottom vs {i+cols} top"
        if "left" in sides and "right" in sides:
            return f"tile {i} opposite left+right"
        if "top" in sides and "bottom" in sides:
            return f"tile {i} opposite top+bottom"
        if len(sides) > 2:
            return f"tile {i} has {len(sides)} sides"
        if len(sides) == 2:
            a, b = sides
            adj = {("left", "top"), ("left", "bottom"), ("right", "top"), ("right", "bottom")}
            if tuple(sorted((a, b))) not in {(x, y) if x < y else (y, x) for x, y in [
                ("left", "top"), ("left", "bottom"), ("right", "top"), ("right", "bottom")
            ]}:
                if {a, b} not in [{"left", "top"}, {"left", "bottom"}, {"right", "top"}, {"right", "bottom"}]:
                    return f"tile {i} non-adjacent {sides}"
    return None


def main():
    fails = []
    if not JS.exists():
        print("FAIL missing scripts/overflow-assign.js")
        sys.exit(1)
    for fx in FIXTURES:
        prefs = fx["prefs"]
        if len(prefs) != fx["n"]:
            fails.append(f"{fx['name']} fixture length")
            continue
        got = run_assign(prefs, fx["cols"])
        if len(got) != fx["n"]:
            fails.append(f"{fx['name']} length {len(got)}")
            continue
        hit = clash(got, fx["cols"])
        if hit:
            fails.append(f"{fx['name']} {hit}")
        if any(len(s) < 1 for s in got) and fx["name"] not in ("empty-prefs",):
            # empty-prefs still should pick something
            pass
        if fx["name"] == "empty-prefs" and any(len(s) < 1 for s in got):
            fails.append("empty-prefs left a tile with no side")
        if fx.get("twice"):
            again = run_assign(prefs, fx["cols"])
            if again != got:
                fails.append("seed-stable not stable")
        if fx["name"] == "two-fight":
            if "right" in got[0] and "left" in got[1]:
                fails.append("two-fight still shares the gap")
        if fx["name"] == "pref-blocked-stays-in":
            if got[1]:
                fails.append(f"blocked pref invented {got[1]}")

    print(f"checks: {len(FIXTURES)}  fails: {len(fails)}")
    for f in fails:
        print("FAIL", f)
    if fails:
        sys.exit(1)
    print("PASS overflow assign")


if __name__ == "__main__":
    main()
