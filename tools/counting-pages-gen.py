#!/usr/bin/env python3
"""Generate 10 counting pages + cover icon via Chrome headless screenshots.

Uses system Apple Color Emoji (rendered by Chrome on macOS) for crisp,
scalable emoji art. Outputs to shared/counting/ so all 3 talen can re-use.

Usage: python3 tools/counting-pages-gen.py
"""
import subprocess
from pathlib import Path

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "shared" / "counting"
TMP = ROOT / "shared" / "counting" / ".tmp"
OUT.mkdir(parents=True, exist_ok=True)
TMP.mkdir(parents=True, exist_ok=True)

PAGES = [
    (1, "\U0001F431"),  # cat
    (2, "\U0001F436"),  # dog
    (3, "\U0001F986"),  # duck
    (4, "\U0001F697"),  # car
    (5, "\U0001F34E"),  # red apple
    (6, "\U0001F41D"),  # honeybee
    (7, "\U0001F41F"),  # fish
    (8, "⭐"),       # star
    (9, "\U0001F388"),  # balloon
    (10, "\U0001F34C"), # banana
]

EMOJI_SIZE = {1: 640, 2: 420, 3: 330, 4: 330, 5: 280, 6: 280, 7: 230, 8: 230, 9: 230, 10: 190}

PAGE_HTML = """<!doctype html><html><head><meta charset="utf-8"><style>
html, body {{ margin: 0; padding: 0; }}
body {{ width: 1600px; height: 1200px; background: #fff7e6;
  display: flex; align-items: center; justify-content: center; gap: 80px;
  font-family: -apple-system, "SF Pro Rounded", system-ui; }}
.num {{ font-size: 720px; font-weight: 900; color: #ff7043; line-height: 0.85;
  font-variant-numeric: lining-nums; }}
.emojis {{ display: flex; flex-wrap: wrap; gap: 24px; max-width: 900px;
  justify-content: center; align-items: center; line-height: 1; }}
.emojis span {{ font-size: {sz}px; line-height: 1; }}
</style></head><body>
<div class="num">{n}</div>
<div class="emojis">{spans}</div>
</body></html>"""

COVER_HTML = """<!doctype html><html><head><meta charset="utf-8"><style>
html, body {{ margin: 0; padding: 0; }}
body {{ width: 1200px; height: 1200px; background: #fff7e6;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-family: -apple-system, "SF Pro Rounded", system-ui; }}
.nums {{ font-size: 450px; font-weight: 900; color: #ff7043; line-height: 1; letter-spacing: -12px; }}
.emojis {{ font-size: 230px; line-height: 1; margin-top: 40px; }}
</style></head><body>
<div class="nums">1·2·3</div>
<div class="emojis">\U0001F431\U0001F436\U0001F986</div>
</body></html>"""


def render(html, out_png, w, h):
    src = TMP / (out_png.stem + ".html")
    src.write_text(html, encoding="utf-8")
    subprocess.run(
        [CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
         f"--window-size={w},{h}",
         f"--screenshot={out_png}",
         "--virtual-time-budget=2000",
         f"file://{src}"],
        check=True, capture_output=True)


def to_jpg(png, jpg, quality=85):
    subprocess.run(["magick", str(png), "-quality", str(quality), str(jpg)], check=True)
    png.unlink()


for n, emoji in PAGES:
    spans = "".join(f"<span>{emoji}</span>" for _ in range(n))
    html = PAGE_HTML.format(n=n, sz=EMOJI_SIZE[n], spans=spans)
    png = OUT / f"page-{n:02d}.png"
    jpg = OUT / f"page-{n:02d}.jpg"
    render(html, png, 1600, 1200)
    to_jpg(png, jpg)
    print(f"  → {jpg.relative_to(ROOT)}")

cover_png = OUT / "cover.png"
cover_jpg = OUT / "cover.jpg"
render(COVER_HTML, cover_png, 1200, 1200)
# Downscale 1200 → 400 via magick (Chrome's min window-size > 400 makes direct render unreliable)
subprocess.run(["magick", str(cover_png), "-resize", "400x400", "-quality", "85", str(cover_jpg)], check=True)
cover_png.unlink()
print(f"  → {cover_jpg.relative_to(ROOT)}")

# Cleanup tmp HTMLs
for f in TMP.iterdir():
    f.unlink()
TMP.rmdir()
print("done")
