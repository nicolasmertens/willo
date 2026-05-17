# Multi-taal foto-router + full-screen still playback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `nicolasmertens/liedjes` from a 2-boek root menu to a 3-foto language router (mama/papa/klas) with Boeken/Liedjes/Verhalen sub-categories per taal, and replace pulsing-tile playback with full-screen still + audio + tap-anywhere-to-stop.

**Architecture:** Single Python `render.py` generates all 11+ grid HTML pages + service workers from one `templates/grid.html` + per-grid `tracks/<name>.json`. Existing `/eendjes/` and `/rhymes/` URLs preserved (regenerated via template). New paths under `/mama/`, `/papa/`, `/klas/` for landing + category pages. Toddler-tuned tap detection (`MIN_TAP_MS=65`, drift cancel) preserved unchanged.

**Tech Stack:** Static HTML/CSS/JS, Python 3 (render only), yt-dlp + Whisper + ffmpeg (content pipeline), Cloudflare Worker (telemetry, already deployed), GitHub Pages (hosting), service-worker prefetch + cache.

**Spec:** `docs/superpowers/specs/2026-05-17-multilang-photo-router-design.md`

---

## File structure

```
~/code/liedjes/
├── index.html                       MODIFY: 3-tile home (was 2 boeken)
├── home/
│   ├── mama.jpg                     ✅ already committed
│   ├── papa.jpg                     ✅
│   └── klas.jpg                     pending (Nick aanlevert later)
├── templates/
│   ├── grid.html                    CREATE: canonical grid template
│   ├── service-worker.js            CREATE: canonical SW template
│   ├── landing.html                 CREATE: 3-category landing template
│   └── manifest.json                CREATE: shared PWA manifest template
├── tracks/
│   ├── rhymes.json                  CREATE: 17 EN tracks (10 existing + 7 new)
│   ├── eendjes.json                 CREATE: 26 NL tracks (extracted)
│   ├── papa-liedjes.json            CREATE: 8-12 VL classics
│   ├── papa-verhalen.json           CREATE: 2 VL stories
│   ├── papa-boeken.json             CREATE: 1 tile → /eendjes/
│   ├── mama-liedjes.json            CREATE: 8-12 FR comptines
│   ├── mama-verhalen.json           CREATE: 2 FR stories
│   ├── mama-boeken.json             CREATE: empty + "Binnenkort"
│   ├── klas-verhalen.json           CREATE: 2 EN stories
│   └── klas-boeken.json             CREATE: empty + "Binnenkort"
├── render.py                        CREATE: build all grids + landings
├── tools/
│   ├── find_verse_bounds.py         CREATE: copy from /tmp/liedjes_rhymes/
│   └── trim_track.sh                CREATE: one-track ffmpeg wrapper
├── mama/                            CREATE
│   ├── index.html                       generated landing
│   ├── liedjes/                         {index.html, sw.js, popularity.json, manifest.json, audio/, icons/}
│   ├── verhalen/
│   └── boeken/index.html (empty grid + "Binnenkort")
├── papa/                            CREATE (same shape; boeken/ tile → /eendjes/)
├── klas/                            CREATE
│   ├── index.html                       landing (klasfoto = tekst-tile)
│   ├── liedjes/                         tile zelf links naar /rhymes/ — geen sub-dir nodig
│   ├── verhalen/
│   └── boeken/
├── eendjes/                         REGENERATE via template (URL ongewijzigd, UX nieuw)
├── rhymes/                          REGENERATE via template + 7 nieuwe tracks
└── docs/superpowers/{specs,plans}/  ✅ committed
```

**Reasoning:** Splitting render.py + templates + tracks/ separates concerns — UX/styling lives in one place (`templates/`), per-page content in JSON, build glue in `render.py`. Adding a 14e papa-liedje later = edit one JSON + re-run render. The existing `/eendjes/process.py` (book-photo cropper) stays untouched; it solves a different problem (uniform tile icons from raw book scans).

---

## Phase 1 — Render foundation

Foundation produces a working renderer that regenerates `/rhymes/` byte-equivalent (or functionally equivalent) to the current page, before we touch any new content.

### Task 1: Tooling sanity check

**Files:** none (verification only)

- [ ] **Step 1: Verify required tools present**

Run:
```bash
which python3 yt-dlp ffmpeg && python3 --version
```

Expected: paths for `/usr/bin/python3` (or homebrew variant), `~/.local/bin/yt-dlp`, `/opt/homebrew/bin/ffmpeg`, Python 3.10+.

- [ ] **Step 2: Install Whisper (Python package)**

Run:
```bash
python3 -m pip install --user --upgrade openai-whisper
```

Verify:
```bash
python3 -c "import whisper; print(whisper.__version__)"
```

Expected: prints version number (e.g., `20240930`). No `ModuleNotFoundError`.

- [ ] **Step 3: Smoke-test Whisper end-to-end on a 5s clip**

Run (extracts 5s from an existing rhymes track and transcribes):
```bash
cd ~/code/liedjes
ffmpeg -y -hide_banner -loglevel error -t 5 -i rhymes/audio/01.mp3 /tmp/whisper_smoke.wav
python3 -c "import whisper; m=whisper.load_model('tiny.en'); print(m.transcribe('/tmp/whisper_smoke.wav')['text'][:60])"
```

Expected: prints first ~60 chars of "Twinkle, Twinkle, Little Star" lyrics. No errors.

No commit (verification only).

### Task 2: Copy verse-bound finder into repo

**Files:**
- Create: `~/code/liedjes/tools/find_verse_bounds.py`

- [ ] **Step 1: Copy script from /tmp/ and adapt paths**

Run:
```bash
mkdir -p ~/code/liedjes/tools
cp /tmp/liedjes_rhymes/find_verse_bounds.py ~/code/liedjes/tools/find_verse_bounds.py
```

- [ ] **Step 2: Generalize WHISPER_DIR to CLI argument**

Edit `~/code/liedjes/tools/find_verse_bounds.py`. Replace the line:

```python
WHISPER_DIR = Path("/tmp/liedjes_rhymes/whisper")
```

With:

```python
import argparse

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--whisper-dir", required=True, type=Path,
                   help="Directory containing <track>.json whisper outputs")
    p.add_argument("--track", required=True,
                   help="Track stem (e.g., 'papa-01') — reads <whisper-dir>/<track>.json")
    args = p.parse_args()
    data = json.loads((args.whisper_dir / f"{args.track}.json").read_text())
    bounds = find_bounds(data["segments"], data.get("duration", 0))
    if bounds[0] is None:
        sys.exit(f"no bounds found for {args.track}: {bounds[2]}")
    start, dur, _ = bounds
    print(f"{start:.2f} {dur:.2f}")

if __name__ == "__main__":
    main()
```

Keep `find_bounds()` and `is_real_segment()` unchanged from the /tmp/ copy.

- [ ] **Step 3: Verify script runs against an existing rhymes whisper file**

Run:
```bash
python3 ~/code/liedjes/tools/find_verse_bounds.py \
  --whisper-dir /tmp/liedjes_rhymes/whisper \
  --track 01
```

Expected output: two floats like `17.60 35.18` (start + dur for Twinkle Twinkle, matches the bounds in `rhymes/SOURCES.md`).

- [ ] **Step 4: Commit**

```bash
cd ~/code/liedjes
git add tools/find_verse_bounds.py
git commit -m "tools: vendored find_verse_bounds.py with CLI args

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 3: Trim-track wrapper script

**Files:**
- Create: `~/code/liedjes/tools/trim_track.sh`

- [ ] **Step 1: Write the wrapper**

Create `~/code/liedjes/tools/trim_track.sh`:

```bash
#!/usr/bin/env bash
# Trim a single source wav into a 96 kbps mono mp3 with fade-out.
# Usage: trim_track.sh <src.wav> <out.mp3> <start_sec> <dur_sec> [fade_sec]

set -euo pipefail

src="$1"
out="$2"
start="$3"
dur="$4"
fade="${5:-0.6}"

fade_start=$(python3 -c "print($dur - $fade)")

mkdir -p "$(dirname "$out")"
ffmpeg -y -hide_banner -loglevel error \
  -ss "$start" -t "$dur" -i "$src" \
  -ac 1 -ar 44100 -b:a 96k \
  -af "afade=t=out:st=${fade_start}:d=${fade}" \
  "$out"

dur_actual=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out")
size=$(ls -la "$out" | awk '{print $5}')
printf "%s  %ss  %sB\n" "$out" "$dur_actual" "$size"
```

- [ ] **Step 2: Make executable and smoke-test**

Run:
```bash
chmod +x ~/code/liedjes/tools/trim_track.sh
~/code/liedjes/tools/trim_track.sh \
  /tmp/liedjes_rhymes/yt/01.wav \
  /tmp/trim_smoke.mp3 \
  17.60 35.18
```

Expected: prints `/tmp/trim_smoke.mp3  ~35.18s  ~XXXXXB`. No errors. File exists.

- [ ] **Step 3: Commit**

```bash
cd ~/code/liedjes
git add tools/trim_track.sh
git commit -m "tools: trim_track.sh wrapper for ffmpeg verse-bound clipping

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 4: Extract existing rhymes content into tracks/rhymes.json

**Files:**
- Create: `~/code/liedjes/tracks/rhymes.json`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p ~/code/liedjes/tracks
```

- [ ] **Step 2: Write rhymes.json with all 10 existing tracks**

Create `~/code/liedjes/tracks/rhymes.json`:

```json
{
  "title": "Rhymes",
  "lang": "en",
  "parent_photo": "/home/klas.jpg",
  "parent_href": "/",
  "app_version": "rhymes-v2",
  "storage_prefix": "rhymes",
  "cache_name": "rhymes-v10",
  "mp3_cache_name": "rhymes-mp3-v10",
  "manifest_name": "Rhymes",
  "seed_order": [1, 6, 2, 7, 4],
  "tracks": [
    {"n":  1, "title": "Twinkle, Twinkle, Little Star",              "audio": "audio/01.mp3", "icon": "icons/01.jpg"},
    {"n":  2, "title": "Hey Diddle Diddle",                          "audio": "audio/02.mp3", "icon": "icons/02.jpg"},
    {"n":  3, "title": "Hickory Dickory Dock",                       "audio": "audio/03.mp3", "icon": "icons/03.jpg"},
    {"n":  4, "title": "Mary Had a Little Lamb",                     "audio": "audio/04.mp3", "icon": "icons/04.jpg"},
    {"n":  5, "title": "Humpty Dumpty",                              "audio": "audio/05.mp3", "icon": "icons/05.jpg"},
    {"n":  6, "title": "The Itsy Bitsy Spider",                      "audio": "audio/06.mp3", "icon": "icons/06.jpg"},
    {"n":  7, "title": "Jack and Jill",                              "audio": "audio/07.mp3", "icon": "icons/07.jpg"},
    {"n":  8, "title": "Little Bo-Peep",                             "audio": "audio/08.mp3", "icon": "icons/08.jpg"},
    {"n":  9, "title": "There Was an Old Woman Who Lived in a Shoe", "audio": "audio/09.mp3", "icon": "icons/09.jpg"},
    {"n": 10, "title": "This Little Piggy",                          "audio": "audio/10.mp3", "icon": "icons/10.jpg"}
  ]
}
```

Note: `parent_photo: "/home/klas.jpg"` even though the file doesn't exist yet. The template's hoek-cirkel-knop renders a tekst-fallback when the image fails to load (see Task 8). Once Nick commits `home/klas.jpg`, it auto-appears.

- [ ] **Step 3: Commit**

```bash
cd ~/code/liedjes
git add tracks/rhymes.json
git commit -m "tracks: extract rhymes.json from existing /rhymes/index.html

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 5: Create grid.html template

**Files:**
- Create: `~/code/liedjes/templates/grid.html`

- [ ] **Step 1: Write the template based on rhymes/index.html, with placeholders**

This is the canonical grid page. It uses these placeholders that `render.py` replaces:

| Placeholder | Type | Example |
|---|---|---|
| `__GRID_TITLE__` | string | `Rhymes`, `Liedjes`, `Verhalen` |
| `__HTML_LANG__` | `en\|nl\|fr` | `nl` |
| `__PARENT_PHOTO__` | URL | `/home/papa.jpg` |
| `__PARENT_HREF__` | URL | `/` |
| `__APP_VERSION__` | string | `papa-liedjes-v1` |
| `__STORAGE_PREFIX__` | identifier (no dashes) | `papa_liedjes` |
| `__TRACKS_JSON__` | inline JSON | `[{"n":1,"title":"...","audio":"...","icon":"..."}]` |
| `__SEED_ORDER__` | inline JSON array | `[1,4,12]` |
| `__MANIFEST_NAME__` | string | `Papa Liedjes` |

Create `~/code/liedjes/templates/grid.html`:

```html
<!doctype html>
<html lang="__HTML_LANG__">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="__GRID_TITLE__">
<meta name="theme-color" content="#fff7e6">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">
<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">
<link rel="manifest" href="manifest.json">
<title>__GRID_TITLE__</title>
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; user-select: none; -webkit-user-select: none; touch-action: pan-y; }
  html, body { margin: 0; padding: 0; background: #fff7e6; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Rounded", "Avenir Next", system-ui, sans-serif; overscroll-behavior: none; overflow-x: hidden; -webkit-text-size-adjust: 100%; }
  body { min-height: 100vh; min-height: 100dvh; padding: 16px; padding-top: max(16px, env(safe-area-inset-top)); padding-bottom: max(16px, env(safe-area-inset-bottom)); }

  /* --- Grid --- */
  .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; max-width: 1200px; margin: 0 auto; transition: opacity .2s ease; }
  @media (max-width: 900px) { .grid { grid-template-columns: repeat(2, 1fr); gap: 18px; max-width: 760px; } }
  .grid.dim { opacity: 0; pointer-events: none; }
  .tile { aspect-ratio: 1 / 1; border: 4px solid transparent; border-radius: 26px; padding: 0; background: #fff; cursor: pointer; overflow: hidden; position: relative; box-shadow: 0 4px 0 rgba(0,0,0,0.12), 0 8px 18px rgba(0,0,0,0.08); transition: transform .08s ease, box-shadow .08s ease; font-family: inherit; }
  .tile:active { transform: translateY(2px); box-shadow: 0 2px 0 rgba(0,0,0,0.12), 0 4px 10px rgba(0,0,0,0.08); }
  .tile img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
  .tile .num { position: absolute; top: 8px; left: 14px; font-size: clamp(28px, 4vw, 40px); font-weight: 900; color: #fff; text-shadow: 0 2px 8px rgba(0,0,0,0.7), 0 0 3px rgba(0,0,0,0.9); letter-spacing: -0.02em; pointer-events: none; }
  .tile.pressing { transform: scale(0.94); filter: brightness(1.12); }

  /* --- Foto-cirkel-hoek-knop (rechtsboven, op alle sub-paginas) --- */
  .home-btn { position: fixed; top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right)); width: 64px; height: 64px; border-radius: 50%; border: 3px solid #fff; overflow: hidden; padding: 0; cursor: pointer; background: #fff7e6; box-shadow: 0 2px 8px rgba(0,0,0,0.18); z-index: 100; }
  .home-btn:active { transform: scale(0.92); }
  .home-btn img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .home-btn .fallback { display: none; width: 100%; height: 100%; align-items: center; justify-content: center; font-weight: 900; font-size: 14px; color: #2b2b2b; }
  .home-btn img.missing + .fallback { display: flex; }

  /* --- Full-screen still playback overlay --- */
  .player { position: fixed; inset: 0; background: #000; display: none; z-index: 50; cursor: pointer; }
  .player.visible { display: block; }
  .player img { width: 100%; height: 100%; object-fit: contain; display: block; }
</style>
</head>
<body>
  <button class="home-btn" id="homebtn" aria-label="terug naar home">
    <img src="__PARENT_PHOTO__" alt="" onerror="this.classList.add('missing')">
    <div class="fallback">__GRID_TITLE__</div>
  </button>
  <main class="grid" id="grid"></main>
  <div class="player" id="player"><img id="player-img" alt=""></div>

<script>
// --- Service worker ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      .then(() => schedulePrefetch())
      .catch(() => {});
  });
}

// --- Toddler-proofing: kill all browser gestures ---
document.addEventListener("gesturestart", e => e.preventDefault(), { passive: false });
document.addEventListener("gesturechange", e => e.preventDefault(), { passive: false });
document.addEventListener("gestureend", e => e.preventDefault(), { passive: false });

let lastTouchEnd = 0;
document.addEventListener("touchend", e => {
  const now = Date.now();
  if (now - lastTouchEnd <= 350) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });

document.addEventListener("touchstart", e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener("touchmove", e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener("contextmenu", e => e.preventDefault());
document.addEventListener("dblclick", e => e.preventDefault());

const TRACKS = __TRACKS_JSON__;
const SEED_ORDER = __SEED_ORDER__;
const PARENT_HREF = "__PARENT_HREF__";
const STORAGE_PREFIX = "__STORAGE_PREFIX__";
const APP_VERSION = "__APP_VERSION__";

const audio = new Audio();
audio.preload = "none";
audio.playsInline = true;
let currentTile = null;
let currentTrack = null;

// --- Popularity tracking ---
const POP_KEY = STORAGE_PREFIX + "_plays_v1";
const POP_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function loadPlays() { try { return JSON.parse(localStorage.getItem(POP_KEY) || "[]"); } catch { return []; } }
function savePlays(arr) { try { localStorage.setItem(POP_KEY, JSON.stringify(arr)); } catch {} }
function recordPlay(n) {
  const now = Date.now(); const cutoff = now - POP_WINDOW_MS;
  const arr = loadPlays().filter(e => e.t >= cutoff);
  arr.push({ n, t: now }); savePlays(arr);
}
function downloadOrder() {
  const cutoff = Date.now() - POP_WINDOW_MS;
  const arr = loadPlays().filter(e => e.t >= cutoff);
  savePlays(arr);
  const counts = {}; for (const e of arr) counts[e.n] = (counts[e.n] || 0) + 1;
  const seedRank = {}; SEED_ORDER.forEach((n, i) => { seedRank[n] = i; });
  const all = TRACKS.map(s => s.n);
  all.sort((a, b) => {
    const ca = counts[a] || 0, cb = counts[b] || 0;
    if (cb !== ca) return cb - ca;
    const sa = seedRank[a] ?? 999, sb = seedRank[b] ?? 999;
    if (sa !== sb) return sa - sb;
    return a - b;
  });
  return all;
}
function trackByNum(n) { return TRACKS.find(s => s.n === n); }

// --- Telemetry ---
const TEL_URL = "https://liedjes-logger.super-mud-e2ef.workers.dev/log";
const TEL_BUFFER_KEY = STORAGE_PREFIX + "_tel_buffer_v1";
const TEL_DEVICE_KEY = STORAGE_PREFIX + "_device_id_v1";
const TEL_FLUSH_INTERVAL_MS = 30000;
const TEL_MAX_BUFFER = 2000;

const SESSION_ID = ((crypto.randomUUID && crypto.randomUUID()) || (Date.now() + "-" + Math.random())).slice(0, 36);
let DEVICE_ID = "";
try {
  DEVICE_ID = localStorage.getItem(TEL_DEVICE_KEY) || "";
  if (!DEVICE_ID) { DEVICE_ID = (crypto.randomUUID && crypto.randomUUID()) || (Date.now() + "-" + Math.random()); localStorage.setItem(TEL_DEVICE_KEY, DEVICE_ID); }
} catch {}

let telBuffer = [];
try { telBuffer = JSON.parse(localStorage.getItem(TEL_BUFFER_KEY) || "[]"); } catch {}
function saveTelBuffer() { try { localStorage.setItem(TEL_BUFFER_KEY, JSON.stringify(telBuffer)); } catch {} }
function tel(type, payload) {
  telBuffer.push({ t: Date.now(), type, ...(payload || {}) });
  if (telBuffer.length > TEL_MAX_BUFFER) telBuffer.splice(0, telBuffer.length - TEL_MAX_BUFFER);
  saveTelBuffer();
}

let telFlushing = false;
async function flushTel(useKeepalive) {
  if (telFlushing || telBuffer.length === 0) return;
  telFlushing = true;
  const batchLen = telBuffer.length;
  const batch = telBuffer.slice(0, batchLen);
  try {
    const resp = await fetch(TEL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch, session_id: SESSION_ID, device_id: DEVICE_ID, app_version: APP_VERSION }),
      keepalive: !!useKeepalive,
    });
    if (resp && resp.ok) { telBuffer.splice(0, batchLen); saveTelBuffer(); }
  } catch {}
  telFlushing = false;
}
setInterval(() => flushTel(false), TEL_FLUSH_INTERVAL_MS);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushTel(true); });
window.addEventListener("pagehide", () => flushTel(true));
tel("session_start", { ua: navigator.userAgent, vw: window.innerWidth, vh: window.innerHeight, dpr: window.devicePixelRatio || 1, standalone: !!(navigator.standalone || window.matchMedia("(display-mode: standalone)").matches) });

// --- Prefetch ---
async function schedulePrefetch() {
  let worker = navigator.serviceWorker.controller;
  if (!worker) { try { const reg = await navigator.serviceWorker.ready; worker = navigator.serviceWorker.controller || reg.active; } catch {} }
  if (!worker) return;
  const order = downloadOrder();
  const urls = order.map(n => { const s = trackByNum(n); return s ? encodeURI(s.audio) : null; }).filter(Boolean);
  worker.postMessage({ type: "prefetch-mp3s", urls });
}

// --- Full-screen still playback ---
const grid = document.getElementById("grid");
const player = document.getElementById("player");
const playerImg = document.getElementById("player-img");

function showPlayer(track) {
  playerImg.src = encodeURI(track.icon);
  player.classList.add("visible");
  grid.classList.add("dim");
}
function hidePlayer() {
  player.classList.remove("visible");
  grid.classList.remove("dim");
  playerImg.src = "";
}

let currentSongNum = null;
let lastProgressLog = 0;

function emitPlayEnd(reason) {
  if (currentSongNum == null) return;
  const dur = audio.duration || 0;
  const cur = audio.currentTime || 0;
  const pct = dur > 0 ? +(cur / dur).toFixed(3) : 0;
  tel("play_end", { n: currentSongNum, elapsed_ms: Math.round(cur * 1000), duration_ms: Math.round(dur * 1000), pct, reason, real_tap: pct >= 0.4 });
  currentSongNum = null;
}

function stop() {
  emitPlayEnd("stop");
  audio.pause();
  audio.currentTime = 0;
  currentTrack = null;
  currentTile = null;
  hidePlayer();
}

function play(track, tile) {
  if (currentTrack === track) { stop(); return; }
  emitPlayEnd("replaced");
  audio.src = encodeURI(track.audio);
  audio.play().then(() => {
    currentTile = tile;
    currentTrack = track;
    currentSongNum = track.n;
    showPlayer(track);
    recordPlay(track.n);
    tel("play_start", { n: track.n });
  }).catch((err) => {
    hidePlayer();
    tel("play_fail", { n: track.n, err: String(err && err.message || err).slice(0, 120) });
  });
}

audio.addEventListener("ended", () => { emitPlayEnd("ended"); hidePlayer(); currentTrack = null; });
audio.addEventListener("timeupdate", () => {
  const now = Date.now();
  if (now - lastProgressLog < 2000 || currentSongNum == null) return;
  lastProgressLog = now;
  const dur = audio.duration || 0, cur = audio.currentTime || 0;
  tel("play_progress", { n: currentSongNum, elapsed_ms: Math.round(cur * 1000), duration_ms: Math.round(dur * 1000), pct: dur > 0 ? +(cur / dur).toFixed(3) : 0 });
});

// Tap-anywhere on player = stop. Tap on home button = also stop (and go home).
player.addEventListener("click", stop, { passive: true });
player.addEventListener("touchend", e => { e.preventDefault(); stop(); }, { passive: false });

// --- Tile tap detection (toddler-tuned, unchanged from rhymes/) ---
const MIN_TAP_MS = 65;
const MAX_TAP_MS = 1500;
const MAX_TAP_DRIFT_PX = 50;

function attachTileHandlers(btn, track) {
  const candidates = new Map();

  btn.addEventListener("touchstart", e => {
    for (const t of e.changedTouches) {
      const r0 = Math.max(t.radiusX || 0, t.radiusY || 0);
      candidates.set(t.identifier, { t0: Date.now(), x0: t.clientX, y0: t.clientY, r0, maxDrift: 0, drifted: false });
      btn.classList.add("pressing");
      tel("touchstart", { n: track.n, x: Math.round(t.clientX), y: Math.round(t.clientY), r: Math.round(r0), touches: e.touches.length });
    }
  }, { passive: true });

  btn.addEventListener("touchmove", e => {
    for (const t of e.changedTouches) {
      const c = candidates.get(t.identifier);
      if (!c) continue;
      const d = Math.hypot(t.clientX - c.x0, t.clientY - c.y0);
      if (d > c.maxDrift) c.maxDrift = d;
      if (!c.drifted && d > MAX_TAP_DRIFT_PX) c.drifted = true;
    }
  }, { passive: true });

  btn.addEventListener("touchend", e => {
    for (const t of e.changedTouches) {
      const c = candidates.get(t.identifier);
      candidates.delete(t.identifier);
      if (candidates.size === 0) btn.classList.remove("pressing");
      if (!c) continue;
      const dur = Date.now() - c.t0;
      const r = Math.max(t.radiusX || 0, t.radiusY || 0);
      const el = document.elementFromPoint(t.clientX, t.clientY);
      const onTile = el === btn || btn.contains(el);

      let decision;
      if (c.drifted)              decision = "drifted";
      else if (!onTile)           decision = "off_tile";
      else if (dur < MIN_TAP_MS)  decision = "too_short";
      else if (dur > MAX_TAP_MS)  decision = "too_long";
      else                        decision = "play";

      tel("touchend", { n: track.n, dur_ms: dur, r_start: Math.round(c.r0), r_end: Math.round(r), drift_max: Math.round(c.maxDrift), on_tile: onTile, decision });

      if (decision === "play") { e.preventDefault(); play(track, btn); return; }
    }
  }, { passive: false });

  btn.addEventListener("touchcancel", e => {
    for (const t of e.changedTouches) {
      const c = candidates.get(t.identifier);
      candidates.delete(t.identifier);
      tel("touchcancel", { n: track.n, dur_ms: c ? Date.now() - c.t0 : null, drift_max: c ? Math.round(c.maxDrift) : null });
    }
    if (candidates.size === 0) btn.classList.remove("pressing");
  }, { passive: true });

  btn.addEventListener("click", e => {
    if ("ontouchstart" in window) return;
    if (e.detail === 0) return;
    tel("click", { n: track.n });
    play(track, btn);
  });
}

function build() {
  TRACKS.forEach(track => {
    const btn = document.createElement("button");
    btn.className = "tile";
    btn.setAttribute("aria-label", `${track.n}. ${track.title}`);
    btn.innerHTML = `<img src="${encodeURI(track.icon)}" alt=""><div class="num">${track.n}</div>`;
    attachTileHandlers(btn, track);
    grid.appendChild(btn);
  });
}

// Home button → navigate to parent (configured per-grid)
document.getElementById("homebtn").addEventListener("click", () => {
  stop();
  window.location = PARENT_HREF;
});

build();
</script>
</body>
</html>
```

Note key differences vs current `rhymes/index.html`:

1. **TRACKS + SEED_ORDER are injected as JSON literals** (not hardcoded JS arrays). `render.py` substitutes `__TRACKS_JSON__`.
2. **No more `.tile.playing` class / pulse animation / `.stopbar`** — replaced by `.player` full-screen overlay.
3. **`.home-btn` rechtsboven** — img with `onerror` fallback to text (for klas before photo arrives).
4. **Storage keys are prefixed** (`STORAGE_PREFIX + "_plays_v1"`) so multiple grids on the same domain don't collide in `localStorage`.
5. **Debug UI removed** (debug bar at bottom, `?debug=1` param). YAGNI for new grids; bring back if Nick wants it.
6. **`audio.icon` field** drives both tile image AND full-screen player image.

- [ ] **Step 2: Verify file is valid HTML**

Run:
```bash
mkdir -p ~/code/liedjes/templates
# (file written by Step 1)
python3 -c "
from pathlib import Path
content = Path('~/code/liedjes/templates/grid.html').expanduser().read_text()
assert '__TRACKS_JSON__' in content
assert '__PARENT_PHOTO__' in content
assert '__SEED_ORDER__' in content
print('OK', len(content), 'bytes')
"
```

Expected: prints `OK <bytes>` (somewhere around 13-15 KB).

- [ ] **Step 3: Commit**

```bash
cd ~/code/liedjes
git add templates/grid.html
git commit -m "templates: canonical grid.html with placeholders + full-screen player

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 6: Create service-worker.js template

**Files:**
- Create: `~/code/liedjes/templates/service-worker.js`

- [ ] **Step 1: Write the template**

The SW is functionally identical to `rhymes/service-worker.js` except cache names are placeholders. Create `~/code/liedjes/templates/service-worker.js`:

```javascript
// Generated by render.py from templates/service-worker.js
// Cache names per-grid so multiple grids on the same origin don't collide.

const CORE_CACHE = "__CACHE_NAME__";
const MP3_CACHE  = "__MP3_CACHE_NAME__";

const CORE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./favicon-32.png",
  "./popularity.json",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CORE_CACHE).then(c => c.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CORE_CACHE && k !== MP3_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  const isHTML = e.request.mode === "navigate"
              || e.request.destination === "document"
              || url.pathname.endsWith("/")
              || url.pathname.endsWith(".html");

  if (isHTML) {
    e.respondWith(
      fetch(e.request).then(resp => {
        const copy = resp.clone();
        caches.open(CORE_CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return resp;
      }).catch(() => caches.match(e.request).then(r => r || caches.match("./")))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchAndCache = fetch(e.request).then(resp => {
        if (resp && resp.status === 200) {
          const copy = resp.clone();
          caches.open(CORE_CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => cached);
      return cached || fetchAndCache;
    })
  );
});

let prefetching = false;
self.addEventListener("message", async e => {
  const msg = e.data;
  if (!msg || msg.type !== "prefetch-mp3s" || !Array.isArray(msg.urls)) return;
  if (prefetching) return;
  prefetching = true;

  const cache = await caches.open(MP3_CACHE);
  const total = msg.urls.length;
  let done = 0, cached = 0;
  const post = (payload) => { if (e.source) e.source.postMessage(payload); };

  const CONCURRENCY = 4;
  let cursor = 0;
  async function worker() {
    while (cursor < total) {
      const idx = cursor++;
      const u = msg.urls[idx];
      try {
        const req = new Request(u, { mode: "no-cors", credentials: "omit" });
        const existing = await cache.match(req, { ignoreVary: true });
        if (!existing) { const resp = await fetch(req); await cache.put(req, resp); }
        cached++;
      } catch {}
      done++;
      post({ type: "prefetch-progress", done, total });
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));
  prefetching = false;
  post({ type: "prefetch-done", cached, total });
});
```

- [ ] **Step 2: Commit**

```bash
cd ~/code/liedjes
git add templates/service-worker.js
git commit -m "templates: service-worker.js with placeholder cache names

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 7: Create render.py

**Files:**
- Create: `~/code/liedjes/render.py`

- [ ] **Step 1: Write the render script**

Create `~/code/liedjes/render.py`:

```python
#!/usr/bin/env python3
"""Render grid + landing pages from templates/ + tracks/.

Usage:
  python render.py                # render everything
  python render.py rhymes papa-liedjes  # render named grids only
"""

import json
import sys
import shutil
from pathlib import Path

ROOT = Path(__file__).parent

# Grid pages = anything that lists tracks/songs/stories with tile playback.
# Each entry: tracks/<name>.json must define its own metadata + tracks array.
# out_dir is the relative path under repo root where files are written.
GRIDS = {
    "rhymes":         {"tracks": "tracks/rhymes.json",         "out_dir": "rhymes"},
    "eendjes":        {"tracks": "tracks/eendjes.json",        "out_dir": "eendjes"},
    "papa-liedjes":   {"tracks": "tracks/papa-liedjes.json",   "out_dir": "papa/liedjes"},
    "papa-verhalen":  {"tracks": "tracks/papa-verhalen.json",  "out_dir": "papa/verhalen"},
    "mama-liedjes":   {"tracks": "tracks/mama-liedjes.json",   "out_dir": "mama/liedjes"},
    "mama-verhalen":  {"tracks": "tracks/mama-verhalen.json",  "out_dir": "mama/verhalen"},
    "klas-verhalen":  {"tracks": "tracks/klas-verhalen.json",  "out_dir": "klas/verhalen"},
}

# Landing pages = 3-category tile pages per language.
LANDINGS = {
    "mama": {"out_dir": "mama", "lang": "fr", "photo": "/home/mama.jpg", "title_fallback": "Mama"},
    "papa": {"out_dir": "papa", "lang": "nl", "photo": "/home/papa.jpg", "title_fallback": "Papa"},
    "klas": {"out_dir": "klas", "lang": "en", "photo": "/home/klas.jpg", "title_fallback": "Klas"},
}


def render_grid(name, config):
    tracks_path = ROOT / config["tracks"]
    if not tracks_path.exists():
        print(f"[skip] {name}: {tracks_path} not found")
        return
    spec = json.loads(tracks_path.read_text())
    out_dir = ROOT / config["out_dir"]
    out_dir.mkdir(parents=True, exist_ok=True)

    # Render grid.html
    template = (ROOT / "templates/grid.html").read_text()
    html = (template
        .replace("__GRID_TITLE__",   spec["title"])
        .replace("__HTML_LANG__",    spec["lang"])
        .replace("__PARENT_PHOTO__", spec["parent_photo"])
        .replace("__PARENT_HREF__",  spec.get("parent_href", "/"))
        .replace("__APP_VERSION__",  spec["app_version"])
        .replace("__STORAGE_PREFIX__", spec["storage_prefix"])
        .replace("__TRACKS_JSON__",  json.dumps(spec["tracks"], ensure_ascii=False))
        .replace("__SEED_ORDER__",   json.dumps(spec.get("seed_order", [])))
    )
    (out_dir / "index.html").write_text(html, encoding="utf-8")

    # Render service-worker.js
    sw_template = (ROOT / "templates/service-worker.js").read_text()
    sw = (sw_template
        .replace("__CACHE_NAME__",     spec["cache_name"])
        .replace("__MP3_CACHE_NAME__", spec["mp3_cache_name"])
    )
    (out_dir / "service-worker.js").write_text(sw, encoding="utf-8")

    # Write popularity.json with the seed
    (out_dir / "popularity.json").write_text(
        json.dumps({"seed": spec.get("seed_order", []), "note": f"Generated by render.py for {name}"}, indent=2),
        encoding="utf-8",
    )

    # Write manifest.json
    manifest = {
        "name": spec.get("manifest_name", spec["title"]),
        "short_name": spec.get("manifest_name", spec["title"]),
        "start_url": "./",
        "display": "standalone",
        "background_color": "#fff7e6",
        "theme_color": "#fff7e6",
        "icons": [
            {"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"},
        ],
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(f"[ok]  {name} → {config['out_dir']}/  ({len(spec['tracks'])} tracks)")


def render_landing(name, config):
    template = (ROOT / "templates/landing.html").read_text()
    out_dir = ROOT / config["out_dir"]
    out_dir.mkdir(parents=True, exist_ok=True)

    html = (template
        .replace("__HTML_LANG__",     config["lang"])
        .replace("__PARENT_PHOTO__",  config["photo"])
        .replace("__TITLE_FALLBACK__", config["title_fallback"])
        .replace("__LANG_PATH__",     name)
    )
    (out_dir / "index.html").write_text(html, encoding="utf-8")
    print(f"[ok]  landing {name} → {config['out_dir']}/")


def main():
    selected = set(sys.argv[1:])
    for name, cfg in GRIDS.items():
        if not selected or name in selected:
            render_grid(name, cfg)
    for name, cfg in LANDINGS.items():
        if not selected or name in selected:
            render_landing(name, cfg)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Make executable + test against rhymes only**

Run:
```bash
chmod +x ~/code/liedjes/render.py
cd ~/code/liedjes
python3 render.py rhymes
```

Expected output:
```
[ok]  rhymes → rhymes/  (10 tracks)
```

- [ ] **Step 3: Verify rhymes/ regenerated correctly**

Run:
```bash
cd ~/code/liedjes
ls -la rhymes/index.html rhymes/service-worker.js rhymes/popularity.json rhymes/manifest.json
python3 -c "
import json
p = open('rhymes/popularity.json').read()
print('seed in popularity.json:', json.loads(p).get('seed'))
"
```

Expected: all 4 files present and recent mtimes. Seed = `[1, 6, 2, 7, 4]`.

- [ ] **Step 4: Local browser smoke test of regenerated rhymes**

Run:
```bash
cd ~/code/liedjes
python3 -m http.server 8765 &
SERVER_PID=$!
sleep 1
open http://localhost:8765/rhymes/
```

Manual checks (Nick performs):
- Grid renders with 10 tiles, numbered.
- Tap a tile → **full-screen image appears, song plays** (NEW behavior).
- Tap anywhere on player → returns to grid.
- Foto-cirkel rechtsboven shows fallback text "Rhymes" (klas.jpg doesn't exist yet) — tap = goes to `/`.

Stop server when done:
```bash
kill $SERVER_PID
```

- [ ] **Step 5: Commit render.py + regenerated rhymes**

```bash
cd ~/code/liedjes
git add render.py rhymes/index.html rhymes/service-worker.js rhymes/popularity.json rhymes/manifest.json
git commit -m "feat: render.py + regenerate /rhymes/ via template (full-screen player)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2 — Home + landings

### Task 8: New home with 3 photo tiles

**Files:**
- Modify: `~/code/liedjes/index.html`

- [ ] **Step 1: Replace home with 3 foto-tiles**

Overwrite `~/code/liedjes/index.html`:

```html
<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#fff7e6">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Williams">
<link rel="manifest" href="manifest.json">
<title>Williams</title>
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; user-select: none; -webkit-user-select: none; touch-action: pan-y; }
  html, body { margin: 0; padding: 0; background: #fff7e6; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Rounded", "Avenir Next", system-ui, sans-serif; min-height: 100vh; min-height: 100dvh; overscroll-behavior: none; }
  body { padding: 16px; padding-top: max(16px, env(safe-area-inset-top)); padding-bottom: max(16px, env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 14px; align-items: center; justify-content: center; }

  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; width: 100%; max-width: 900px; }
  @media (max-width: 640px) { .grid { grid-template-columns: 1fr; max-width: 480px; } }

  a.tile { display: block; aspect-ratio: 1 / 1; border-radius: 26px; overflow: hidden; position: relative; background: #fff; text-decoration: none; box-shadow: 0 4px 0 rgba(0,0,0,0.12), 0 8px 18px rgba(0,0,0,0.08); transition: transform .08s ease, box-shadow .08s ease; }
  a.tile:active { transform: translateY(2px); box-shadow: 0 2px 0 rgba(0,0,0,0.12), 0 4px 10px rgba(0,0,0,0.08); }
  a.tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
  a.tile .label { position: absolute; left: 0; right: 0; bottom: 0; padding: 14px 16px; background: linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0)); color: #fff; font-weight: 800; font-size: clamp(18px, 2.4vw, 22px); text-shadow: 0 2px 6px rgba(0,0,0,0.5); letter-spacing: -0.01em; }

  /* Klas fallback when home/klas.jpg doesn't exist yet */
  a.tile .text-fallback { display: none; width: 100%; height: 100%; align-items: center; justify-content: center; font-weight: 900; font-size: clamp(28px, 5vw, 48px); color: #2b2b2b; background: linear-gradient(135deg, #ffd8a8, #ffa94d); }
  a.tile img.missing { display: none; }
  a.tile img.missing + .text-fallback { display: flex; }
</style>
</head>
<body>
  <main class="grid">
    <a class="tile" href="/mama/" aria-label="Mama">
      <img src="home/mama.jpg" alt="" onerror="this.classList.add('missing')">
      <div class="text-fallback">Mama</div>
      <div class="label">Mama</div>
    </a>
    <a class="tile" href="/papa/" aria-label="Papa">
      <img src="home/papa.jpg" alt="" onerror="this.classList.add('missing')">
      <div class="text-fallback">Papa</div>
      <div class="label">Papa</div>
    </a>
    <a class="tile" href="/klas/" aria-label="Klas">
      <img src="home/klas.jpg" alt="" onerror="this.classList.add('missing')">
      <div class="text-fallback">Klas</div>
      <div class="label">Klas</div>
    </a>
  </main>
<script>
// Unregister any service worker still registered at the root scope.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => {
      if (r.scope.endsWith("/liedjes/") || r.scope.endsWith("nicolasmertens.github.io/")) {
        r.unregister().catch(() => {});
      }
    });
  }).catch(() => {});
}
</script>
</body>
</html>
```

- [ ] **Step 2: Visual smoke test**

Run:
```bash
cd ~/code/liedjes
python3 -m http.server 8765 &
SERVER_PID=$!
sleep 1
open http://localhost:8765/
```

Manual checks:
- 3 tiles render: mama (photo of Eline), papa (photo of Nick + William), klas (orange gradient + text "Klas").
- Tap mama → navigates to `/mama/` (will 404 until Task 9).
- Tap papa → navigates to `/papa/` (will 404).
- Tap klas → navigates to `/klas/` (will 404).

Stop:
```bash
kill $SERVER_PID
```

- [ ] **Step 3: Commit**

```bash
cd ~/code/liedjes
git add index.html
git commit -m "feat: new home with 3 foto-tiles (mama/papa/klas)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 9: Landing template + 3 landings

**Files:**
- Create: `~/code/liedjes/templates/landing.html`
- Create: `~/code/liedjes/mama/index.html`, `~/code/liedjes/papa/index.html`, `~/code/liedjes/klas/index.html` (via render.py)

- [ ] **Step 1: Write landing template**

Create `~/code/liedjes/templates/landing.html`:

```html
<!doctype html>
<html lang="__HTML_LANG__">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#fff7e6">
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; user-select: none; -webkit-user-select: none; touch-action: pan-y; }
  html, body { margin: 0; padding: 0; background: #fff7e6; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Rounded", "Avenir Next", system-ui, sans-serif; min-height: 100vh; min-height: 100dvh; overscroll-behavior: none; }
  body { padding: 16px; padding-top: max(16px, env(safe-area-inset-top)); padding-bottom: max(16px, env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 14px; align-items: center; justify-content: center; }

  .home-btn { position: fixed; top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right)); width: 64px; height: 64px; border-radius: 50%; border: 3px solid #fff; overflow: hidden; padding: 0; cursor: pointer; background: #fff7e6; box-shadow: 0 2px 8px rgba(0,0,0,0.18); z-index: 100; }
  .home-btn:active { transform: scale(0.92); }
  .home-btn img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .home-btn .fallback { display: none; width: 100%; height: 100%; align-items: center; justify-content: center; font-weight: 900; font-size: 14px; color: #2b2b2b; }
  .home-btn img.missing + .fallback { display: flex; }

  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; width: 100%; max-width: 900px; }
  @media (max-width: 640px) { .grid { grid-template-columns: 1fr; max-width: 480px; } }

  a.tile { display: flex; align-items: center; justify-content: center; aspect-ratio: 1 / 1; border-radius: 26px; background: #fff; text-decoration: none; color: #2b2b2b; font-weight: 900; font-size: clamp(28px, 4.5vw, 44px); letter-spacing: -0.02em; box-shadow: 0 4px 0 rgba(0,0,0,0.12), 0 8px 18px rgba(0,0,0,0.08); transition: transform .08s ease, box-shadow .08s ease; }
  a.tile:active { transform: translateY(2px); box-shadow: 0 2px 0 rgba(0,0,0,0.12), 0 4px 10px rgba(0,0,0,0.08); }

  a.tile-boeken   { background: linear-gradient(135deg, #ffe4a8, #ffc14d); }
  a.tile-liedjes  { background: linear-gradient(135deg, #c0e8b6, #5fc34c); }
  a.tile-verhalen { background: linear-gradient(135deg, #c9d6ff, #6c8cff); }
</style>
</head>
<body>
  <button class="home-btn" onclick="window.location='/'" aria-label="terug naar home">
    <img src="__PARENT_PHOTO__" alt="" onerror="this.classList.add('missing')">
    <div class="fallback">__TITLE_FALLBACK__</div>
  </button>
  <main class="grid">
    <a class="tile tile-boeken"   href="/__LANG_PATH__/boeken/">Boeken</a>
    <a class="tile tile-liedjes"  href="/__LANG_PATH__/liedjes/">Liedjes</a>
    <a class="tile tile-verhalen" href="/__LANG_PATH__/verhalen/">Verhalen</a>
  </main>
</body>
</html>
```

- [ ] **Step 2: Run render.py to generate the 3 landings**

Run:
```bash
cd ~/code/liedjes
python3 render.py mama papa klas
```

Expected output:
```
[ok]  landing mama → mama/
[ok]  landing papa → papa/
[ok]  landing klas → klas/
```

(GRIDS section skips because tracks/papa-liedjes.json etc. don't exist yet — this is normal.)

- [ ] **Step 3: Smoke-test the landings**

Run:
```bash
cd ~/code/liedjes
python3 -m http.server 8765 &
SERVER_PID=$!
sleep 1
open http://localhost:8765/mama/
```

Manual checks:
- Three category tiles (Boeken/Liedjes/Verhalen) with distinct gradient colors.
- Foto-cirkel rechtsboven shows Eline.
- Tap foto-cirkel → goes to `/`.
- Tap a category tile → 404 (categories not built yet, that's fine).

Repeat for `/papa/` (shows Nick+William in cirkel) and `/klas/` (shows "Klas" text in cirkel since no klas.jpg).

```bash
kill $SERVER_PID
```

- [ ] **Step 4: Commit**

```bash
cd ~/code/liedjes
git add templates/landing.html mama/index.html papa/index.html klas/index.html
git commit -m "feat: landing template + 3 taal-landings (mama/papa/klas)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 10: Empty Boeken pages for mama + klas, "Alle Eendjes" for papa

**Files:**
- Create: `~/code/liedjes/mama/boeken/index.html`
- Create: `~/code/liedjes/papa/boeken/index.html`
- Create: `~/code/liedjes/klas/boeken/index.html`

- [ ] **Step 1: Write mama/boeken/ as "Binnenkort" page**

Create `~/code/liedjes/mama/boeken/index.html`:

```html
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#fff7e6">
<title>Mama — Boeken</title>
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; touch-action: pan-y; }
  html, body { margin: 0; padding: 0; background: #fff7e6; font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; min-height: 100vh; min-height: 100dvh; overscroll-behavior: none; }
  body { padding: 16px; padding-top: max(16px, env(safe-area-inset-top)); display: flex; align-items: center; justify-content: center; min-height: 100dvh; }
  .home-btn { position: fixed; top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right)); width: 64px; height: 64px; border-radius: 50%; border: 3px solid #fff; overflow: hidden; padding: 0; background: #fff7e6; box-shadow: 0 2px 8px rgba(0,0,0,0.18); z-index: 100; }
  .home-btn img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .home-btn .fallback { display: none; width: 100%; height: 100%; align-items: center; justify-content: center; font-weight: 900; font-size: 14px; color: #2b2b2b; }
  .home-btn img.missing + .fallback { display: flex; }
  .coming { text-align: center; color: rgba(0,0,0,0.4); font-weight: 800; font-size: clamp(20px, 3vw, 32px); }
</style>
</head>
<body>
  <button class="home-btn" onclick="window.location='/'" aria-label="terug naar home">
    <img src="/home/mama.jpg" alt="" onerror="this.classList.add('missing')">
    <div class="fallback">Mama</div>
  </button>
  <div class="coming">📚 Binnenkort</div>
</body>
</html>
```

- [ ] **Step 2: Write papa/boeken/ pointing to /eendjes/**

Create `~/code/liedjes/papa/boeken/index.html`:

```html
<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#fff7e6">
<title>Papa — Boeken</title>
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; touch-action: pan-y; }
  html, body { margin: 0; padding: 0; background: #fff7e6; font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; min-height: 100vh; min-height: 100dvh; overscroll-behavior: none; }
  body { padding: 16px; padding-top: max(16px, env(safe-area-inset-top)); display: flex; align-items: center; justify-content: center; min-height: 100dvh; }
  .home-btn { position: fixed; top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right)); width: 64px; height: 64px; border-radius: 50%; border: 3px solid #fff; overflow: hidden; padding: 0; background: #fff7e6; box-shadow: 0 2px 8px rgba(0,0,0,0.18); z-index: 100; }
  .home-btn img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .grid { display: grid; grid-template-columns: 1fr; gap: 18px; max-width: 480px; width: 100%; }
  a.tile { display: block; aspect-ratio: 1 / 1; border-radius: 26px; overflow: hidden; position: relative; background: #fff; text-decoration: none; box-shadow: 0 4px 0 rgba(0,0,0,0.12), 0 8px 18px rgba(0,0,0,0.08); transition: transform .08s ease; }
  a.tile:active { transform: translateY(2px); }
  a.tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
  a.tile .label { position: absolute; left: 0; right: 0; bottom: 0; padding: 14px 16px; background: linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0)); color: #fff; font-weight: 800; font-size: clamp(18px, 2.4vw, 22px); text-shadow: 0 2px 6px rgba(0,0,0,0.5); }
</style>
</head>
<body>
  <button class="home-btn" onclick="window.location='/'" aria-label="terug naar home">
    <img src="/home/papa.jpg" alt="">
  </button>
  <main class="grid">
    <a class="tile" href="/eendjes/" aria-label="Alle Eendjes">
      <img src="/eendjes/cover-tile.jpg" alt="">
      <div class="label">Alle Eendjes</div>
    </a>
  </main>
</body>
</html>
```

- [ ] **Step 3: Write klas/boeken/ as "Binnenkort" page**

Create `~/code/liedjes/klas/boeken/index.html` — same as `mama/boeken/index.html` but `lang="en"`, `/home/klas.jpg`, fallback `Klas`.

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#fff7e6">
<title>Klas — Books</title>
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; touch-action: pan-y; }
  html, body { margin: 0; padding: 0; background: #fff7e6; font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; min-height: 100vh; min-height: 100dvh; overscroll-behavior: none; }
  body { padding: 16px; padding-top: max(16px, env(safe-area-inset-top)); display: flex; align-items: center; justify-content: center; min-height: 100dvh; }
  .home-btn { position: fixed; top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right)); width: 64px; height: 64px; border-radius: 50%; border: 3px solid #fff; overflow: hidden; padding: 0; background: #fff7e6; box-shadow: 0 2px 8px rgba(0,0,0,0.18); z-index: 100; }
  .home-btn img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .home-btn .fallback { display: none; width: 100%; height: 100%; align-items: center; justify-content: center; font-weight: 900; font-size: 14px; color: #2b2b2b; }
  .home-btn img.missing + .fallback { display: flex; }
  .coming { text-align: center; color: rgba(0,0,0,0.4); font-weight: 800; font-size: clamp(20px, 3vw, 32px); }
</style>
</head>
<body>
  <button class="home-btn" onclick="window.location='/'" aria-label="back to home">
    <img src="/home/klas.jpg" alt="" onerror="this.classList.add('missing')">
    <div class="fallback">Klas</div>
  </button>
  <div class="coming">📚 Coming soon</div>
</body>
</html>
```

- [ ] **Step 4: Visual smoke test all 3 boeken pages**

```bash
cd ~/code/liedjes && python3 -m http.server 8765 &
SERVER_PID=$!; sleep 1
open http://localhost:8765/mama/boeken/
open http://localhost:8765/papa/boeken/
open http://localhost:8765/klas/boeken/
```

Manual checks:
- mama/boeken/: foto-cirkel (Eline) + "📚 Binnenkort".
- papa/boeken/: foto-cirkel (Nick+William) + 1 tile "Alle Eendjes" with book cover; tap → `/eendjes/` opens.
- klas/boeken/: foto-cirkel (text "Klas") + "📚 Coming soon".

```bash
kill $SERVER_PID
```

- [ ] **Step 5: Commit**

```bash
cd ~/code/liedjes
git add mama/boeken/index.html papa/boeken/index.html klas/boeken/index.html
git commit -m "feat: boeken pages — papa→eendjes, mama+klas binnenkort

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 11: Klas → Liedjes redirect

**Files:**
- Create: `~/code/liedjes/klas/liedjes/index.html`

- [ ] **Step 1: Write meta-refresh redirect**

Create `~/code/liedjes/klas/liedjes/index.html`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=/rhymes/">
<title>Klas — Liedjes (redirect)</title>
</head>
<body>
<script>window.location.replace("/rhymes/");</script>
<p>Going to <a href="/rhymes/">/rhymes/</a>...</p>
</body>
</html>
```

- [ ] **Step 2: Verify redirect works**

```bash
cd ~/code/liedjes && python3 -m http.server 8765 &
SERVER_PID=$!; sleep 1
open http://localhost:8765/klas/liedjes/
```

Expected: page redirects to `/rhymes/` within 0-200ms.

```bash
kill $SERVER_PID
```

- [ ] **Step 3: Commit**

```bash
cd ~/code/liedjes
git add klas/liedjes/index.html
git commit -m "feat: /klas/liedjes/ → /rhymes/ redirect

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3 — EN content (extend /rhymes/)

### Task 12: Source + trim 5 new EN tracks (one batch)

Adds 7 new tracks to `/rhymes/`: 5 new YouTube videos + 2 extra from the truck-compilation.

**Files:**
- Create: `~/code/liedjes/rhymes/audio/11.mp3` through `17.mp3`
- Create: `~/code/liedjes/rhymes/icons/11.jpg` through `17.jpg`
- Modify: `~/code/liedjes/tracks/rhymes.json`

**Track plan:**

| # | Title | YouTube ID | Source video duration | Notes |
|---|---|---|---|---|
| 11 | Vroom Vroom | B1u-ylQR6Fo | ~2:00 | Single track, find verse bound |
| 12 | I Love My Garbage Truck | YEmFhRK-dTg | ~10:00 (compilation) | First segment, ~0:00–3:00 |
| 13 | Driving In My Car | YEmFhRK-dTg | (same compilation) | Second segment, ~3:00–6:00 |
| 14 | Here Comes The Firetruck | YEmFhRK-dTg | (same compilation) | Third segment, ~6:00–end |
| 15 | Baby Shark | GR2o6k8aPlI | ~2:00 | |
| 16 | One Little Finger | eBVqcTEC3zQ | ~2:30 | |
| 17 | The Wheels On The Bus | yWirdnSDsV4 | ~3:00 | |

- [ ] **Step 1: Download all 6 source videos as wav**

Run:
```bash
mkdir -p /tmp/liedjes/yt /tmp/liedjes/whisper
cd /tmp/liedjes/yt
for entry in "11:B1u-ylQR6Fo" "12:YEmFhRK-dTg" "15:GR2o6k8aPlI" "16:eBVqcTEC3zQ" "17:yWirdnSDsV4"; do
  n="${entry%:*}"; id="${entry#*:}"
  [ -f "$n.wav" ] && { echo "skip $n"; continue; }
  yt-dlp -x --audio-format wav --audio-quality 0 -o "$n.%(ext)s" "https://www.youtube.com/watch?v=$id"
done
ls -la /tmp/liedjes/yt/
```

Expected: `11.wav`, `12.wav`, `15.wav`, `16.wav`, `17.wav` in `/tmp/liedjes/yt/`. Each between 1-12 MB. Note: 13 + 14 don't get their own download — they're trimmed segments from `12.wav`.

- [ ] **Step 2: Run Whisper on each wav**

Run:
```bash
cd /tmp/liedjes/yt
for n in 11 12 15 16 17; do
  out=/tmp/liedjes/whisper/${n}.json
  [ -f "$out" ] && { echo "skip whisper $n"; continue; }
  python3 -c "
import whisper, json
m = whisper.load_model('base.en')
r = m.transcribe('${n}.wav', word_timestamps=True)
open('${out}', 'w').write(json.dumps(r))
print('${n}: done')
"
done
```

Expected: 5 JSON files in `/tmp/liedjes/whisper/`. Each ~5-50 KB. Tooltip: `base.en` is ~140 MB but accurate enough for kid songs; `tiny.en` (~75 MB) also works but more bound-finding errors.

- [ ] **Step 3: Find trim bounds per track**

Run:
```bash
for n in 11 15 16 17; do
  printf "%s: " "$n"
  python3 ~/code/liedjes/tools/find_verse_bounds.py --whisper-dir /tmp/liedjes/whisper --track "$n"
done
```

Expected: 4 lines like `11: 2.45 38.20`. Record these (start + dur) values.

For tracks 12/13/14 (the compilation), manual bound-finding is needed since `find_verse_bounds.py` only finds the FIRST verse end. Use whisper segments directly:

```bash
python3 <<'EOF'
import json
data = json.load(open('/tmp/liedjes/whisper/12.json'))
# Find ~3 large gaps (>5s) between segments = song boundaries
prev_end = 0
boundaries = []
for s in data['segments']:
    gap = s['start'] - prev_end
    if gap >= 5.0:
        boundaries.append((prev_end, s['start']))
    prev_end = s['end']
print('Inter-song gaps:')
for start, end in boundaries[:5]:
    print(f"  {start:.1f} → {end:.1f}  (gap {end-start:.1f}s)")
EOF
```

Use these gaps to manually define `(start_12, dur_12)`, `(start_13, dur_13)`, `(start_14, dur_14)` — each should isolate one song with 2s pre-roll and 0.6s tail fade.

- [ ] **Step 4: Trim all 7 tracks**

Run (substitute YOUR bounds from Step 3 + manual):
```bash
cd ~/code/liedjes
T=tools/trim_track.sh
# Example values — REPLACE with actual bounds from Step 3:
$T /tmp/liedjes/yt/11.wav rhymes/audio/11.mp3 <start_11> <dur_11>
$T /tmp/liedjes/yt/12.wav rhymes/audio/12.mp3 <start_12> <dur_12>
$T /tmp/liedjes/yt/12.wav rhymes/audio/13.mp3 <start_13> <dur_13>
$T /tmp/liedjes/yt/12.wav rhymes/audio/14.mp3 <start_14> <dur_14>
$T /tmp/liedjes/yt/15.wav rhymes/audio/15.mp3 <start_15> <dur_15>
$T /tmp/liedjes/yt/16.wav rhymes/audio/16.mp3 <start_16> <dur_16>
$T /tmp/liedjes/yt/17.wav rhymes/audio/17.mp3 <start_17> <dur_17>
ls -la rhymes/audio/{11,12,13,14,15,16,17}.mp3
```

Expected: 7 new mp3 files, each between 200KB-1MB, durations matching `dur` values.

- [ ] **Step 5: Get tile icons (YouTube thumbnails)**

Run:
```bash
cd ~/code/liedjes
for entry in "11:B1u-ylQR6Fo" "12:YEmFhRK-dTg" "13:YEmFhRK-dTg" "14:YEmFhRK-dTg" "15:GR2o6k8aPlI" "16:eBVqcTEC3zQ" "17:yWirdnSDsV4"; do
  n="${entry%:*}"; id="${entry#*:}"
  out="rhymes/icons/${n}.jpg"
  curl -sLo "/tmp/yt_thumb_${n}.jpg" "https://i.ytimg.com/vi/${id}/maxresdefault.jpg" \
    || curl -sLo "/tmp/yt_thumb_${n}.jpg" "https://i.ytimg.com/vi/${id}/hqdefault.jpg"
  magick "/tmp/yt_thumb_${n}.jpg" -gravity center -resize 400x400^ -extent 400x400 -quality 88 "$out"
  echo "${out}: $(ls -la $out | awk '{print $5}')B"
done
```

Expected: 7 square 400×400 jpg files in `rhymes/icons/`. Note: tracks 12/13/14 share the same source thumbnail; ideally Nick crops these to highlight the specific vehicle (garbage truck / car / firetruck) later, but YAGNI for v1.

- [ ] **Step 6: Update tracks/rhymes.json with new entries**

Edit `~/code/liedjes/tracks/rhymes.json`. Append to the `"tracks"` array (after the existing `{"n": 10, ...}` entry):

```json
    {"n": 11, "title": "Vroom Vroom",                                "audio": "audio/11.mp3", "icon": "icons/11.jpg"},
    {"n": 12, "title": "I Love My Garbage Truck",                    "audio": "audio/12.mp3", "icon": "icons/12.jpg"},
    {"n": 13, "title": "Driving In My Car",                          "audio": "audio/13.mp3", "icon": "icons/13.jpg"},
    {"n": 14, "title": "Here Comes The Firetruck",                   "audio": "audio/14.mp3", "icon": "icons/14.jpg"},
    {"n": 15, "title": "Baby Shark",                                 "audio": "audio/15.mp3", "icon": "icons/15.jpg"},
    {"n": 16, "title": "One Little Finger",                          "audio": "audio/16.mp3", "icon": "icons/16.jpg"},
    {"n": 17, "title": "The Wheels On The Bus",                      "audio": "audio/17.mp3", "icon": "icons/17.jpg"}
```

(JSON: don't forget the comma after the `{"n": 10, ...}` entry.)

Also bump the cache version (so the new SW invalidates old caches):

```json
"cache_name": "rhymes-v11",
"mp3_cache_name": "rhymes-mp3-v11",
```

- [ ] **Step 7: Re-render rhymes**

```bash
cd ~/code/liedjes
python3 render.py rhymes
```

Expected: `[ok]  rhymes → rhymes/  (17 tracks)`.

- [ ] **Step 8: Smoke test in browser**

```bash
cd ~/code/liedjes && python3 -m http.server 8765 &
SERVER_PID=$!; sleep 1
open http://localhost:8765/rhymes/
```

Manual checks:
- 17 tiles visible (9 rows × 2 on iPad portrait).
- Tap tile #11 (Vroom Vroom) → full-screen still + plays.
- Tap tile #13 (Driving In My Car) → plays middle section of compilation.

```bash
kill $SERVER_PID
```

- [ ] **Step 9: Update rhymes/SOURCES.md** (audit trail)

Append to `~/code/liedjes/rhymes/SOURCES.md` the table for tracks 11-17:

```markdown
| 11 | Vroom Vroom                    | Super Simple Songs   | B1u-ylQR6Fo    |  <s> |  <d> |
| 12 | I Love My Garbage Truck        | Super Simple Songs   | YEmFhRK-dTg    |  <s> |  <d> |
| 13 | Driving In My Car              | Super Simple Songs   | YEmFhRK-dTg    |  <s> |  <d> |
| 14 | Here Comes The Firetruck       | Super Simple Songs   | YEmFhRK-dTg    |  <s> |  <d> |
| 15 | Baby Shark                     | Super Simple Songs   | GR2o6k8aPlI    |  <s> |  <d> |
| 16 | One Little Finger              | Super Simple Songs   | eBVqcTEC3zQ    |  <s> |  <d> |
| 17 | The Wheels On The Bus          | Super Simple Songs   | yWirdnSDsV4    |  <s> |  <d> |
```

Replace `<s>` / `<d>` with the actual bounds used.

- [ ] **Step 10: Commit**

```bash
cd ~/code/liedjes
git add tracks/rhymes.json rhymes/audio/{11,12,13,14,15,16,17}.mp3 rhymes/icons/{11,12,13,14,15,16,17}.jpg rhymes/index.html rhymes/service-worker.js rhymes/popularity.json rhymes/SOURCES.md
git commit -m "rhymes: +7 tracks (Vroom Vroom, garbage truck compilation x3, Baby Shark, One Little Finger, Wheels On The Bus)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4 — VL content (/papa/liedjes/)

### Task 13: Source 10 VL classics → /papa/liedjes/

Same pipeline as Task 12, with VL content. The candidate list:

| Candidate (final selection 8-12 of these) |
|---|
| In de maneschijn · Olifantje in het bos · Schipper mag ik overvaren · Klein, klein kleutertje · Berend Botje · Hop hop hop paardje in galop · Zeg roodborstje tikketak · Slaap kindje slaap · Op een grote paddenstoel · Vader Jakob · Daar zat een sneeuwwit vogeltje · Boer wat zeg je van mijn kippen · Hoedje van papier · Witte zwanen, zwarte zwanen |

**Files:**
- Create: `~/code/liedjes/papa/liedjes/audio/{01..NN}.mp3` (NN = final count)
- Create: `~/code/liedjes/papa/liedjes/icons/{01..NN}.jpg`
- Create: `~/code/liedjes/tracks/papa-liedjes.json`

- [ ] **Step 1: Find YouTube URLs for each candidate**

For each candidate title, find a YouTube video with good audio quality. Use `yt-dlp --search 'ytsearch5:<title> kinderlied'` to get top 5 results per query, pick by listening (or by channel reputation — K3, Studio 100, Klein Maar Dapper, Kinderliedjes TV).

Run for each:
```bash
yt-dlp --no-warnings --print "%(channel)s | %(title)s | %(duration)ss | %(id)s" \
       "ytsearch5:Olifantje in het bos kinderlied"
```

Record IDs in a working file `/tmp/liedjes/papa-candidates.txt` with format:
```
01 | <title> | <youtube_id>
02 | <title> | <youtube_id>
...
```

- [ ] **Step 2: Download + Whisper for all candidates**

Loop the same yt-dlp + whisper block from Task 12 Step 1+2 over the candidate IDs, writing to `/tmp/liedjes/yt/papa-NN.wav` and `/tmp/liedjes/whisper/papa-NN.json`.

For Whisper on Dutch/French content, use multilingual model:

```bash
python3 -c "
import whisper, json
m = whisper.load_model('base')  # multilingual, not '.en'
r = m.transcribe('/tmp/liedjes/yt/papa-01.wav', word_timestamps=True, language='nl')
open('/tmp/liedjes/whisper/papa-01.json', 'w').write(json.dumps(r))
"
```

- [ ] **Step 3: Find bounds for each**

```bash
for n in 01 02 03 04 05 06 07 08 09 10; do
  printf "papa-%s: " "$n"
  python3 ~/code/liedjes/tools/find_verse_bounds.py --whisper-dir /tmp/liedjes/whisper --track "papa-${n}" 2>&1
done
```

Some may fail to find bounds (no clear verse end). For those, manually inspect Whisper JSON and pick bounds matching ~30-50s of one chorus or verse.

- [ ] **Step 4: Trim all tracks**

```bash
cd ~/code/liedjes
mkdir -p papa/liedjes/audio papa/liedjes/icons
for n in 01 02 03 04 05 06 07 08 09 10; do
  # READ bounds from /tmp/liedjes/whisper/papa-${n}.bounds (write during step 3)
  start=$(cut -d' ' -f1 /tmp/liedjes/whisper/papa-${n}.bounds)
  dur=$(cut -d' ' -f2 /tmp/liedjes/whisper/papa-${n}.bounds)
  tools/trim_track.sh "/tmp/liedjes/yt/papa-${n}.wav" "papa/liedjes/audio/${n}.mp3" "$start" "$dur"
done
```

- [ ] **Step 5: Generate tile icons from YouTube thumbnails**

Same pattern as Task 12 Step 5, using each candidate's YouTube ID. Output to `papa/liedjes/icons/NN.jpg`.

- [ ] **Step 6: Write tracks/papa-liedjes.json**

Create `~/code/liedjes/tracks/papa-liedjes.json`:

```json
{
  "title": "Liedjes",
  "lang": "nl",
  "parent_photo": "/home/papa.jpg",
  "parent_href": "/papa/",
  "app_version": "papa-liedjes-v1",
  "storage_prefix": "papa_liedjes",
  "cache_name": "papa-liedjes-v1",
  "mp3_cache_name": "papa-liedjes-mp3-v1",
  "manifest_name": "Papa Liedjes",
  "seed_order": [1, 2, 3, 4, 5],
  "tracks": [
    {"n": 1, "title": "<title 01>", "audio": "audio/01.mp3", "icon": "icons/01.jpg"},
    {"n": 2, "title": "<title 02>", "audio": "audio/02.mp3", "icon": "icons/02.jpg"},
    ...
  ]
}
```

Replace `<title NN>` with actual selected titles. `parent_href: "/papa/"` so the hoek-cirkel-knop goes back to the papa landing (not all the way to home — one tap less for repeat use).

- [ ] **Step 7: Render**

```bash
cd ~/code/liedjes
python3 render.py papa-liedjes
```

Expected: `[ok]  papa-liedjes → papa/liedjes/  (10 tracks)`.

- [ ] **Step 8: Smoke test**

```bash
cd ~/code/liedjes && python3 -m http.server 8765 &
SERVER_PID=$!; sleep 1
open http://localhost:8765/papa/liedjes/
```

Manual: tap a tile → full-screen + Vlaams kinderlied speelt → tap to stop.

```bash
kill $SERVER_PID
```

- [ ] **Step 9: Create SOURCES.md for papa-liedjes**

Create `~/code/liedjes/papa/liedjes/SOURCES.md` with same table format as `rhymes/SOURCES.md`, listing the 10 YouTube IDs + bounds used.

- [ ] **Step 10: Commit**

```bash
cd ~/code/liedjes
git add tracks/papa-liedjes.json papa/liedjes/
git commit -m "papa/liedjes: 10 VL kinderliedjes (YouTube → trimmed mp3)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 5 — FR content (/mama/liedjes/)

### Task 14: Source 10 FR comptines → /mama/liedjes/

Same pipeline as Task 13, with FR content + `language='fr'` for Whisper.

**Files:**
- Create: `~/code/liedjes/mama/liedjes/audio/{01..NN}.mp3`
- Create: `~/code/liedjes/mama/liedjes/icons/{01..NN}.jpg`
- Create: `~/code/liedjes/tracks/mama-liedjes.json`

**Candidate list** (final 8-12):

| Frère Jacques · Au clair de la lune · Alouette · Sur le pont d'Avignon · Une souris verte · Ainsi font font font · Petit escargot · Pirouette cacahuète · Dans la ferme à Mathurin · Promenons-nous dans les bois · Mon âne, mon âne · Savez-vous planter les choux · Bateau sur l'eau · Une poule sur un mur |

Steps:

- [ ] **Step 1**: Find YouTube URLs for each candidate (prefer Henri Dès, Comptines TV, Le Monde des Titounis, Pinpin et Lili). Record in `/tmp/liedjes/mama-candidates.txt`.

- [ ] **Step 2**: Download + Whisper with `language='fr'`. Write outputs to `/tmp/liedjes/yt/mama-NN.wav` + `/tmp/liedjes/whisper/mama-NN.json`.

- [ ] **Step 3**: Find bounds with `find_verse_bounds.py` (Whisper JSON format same regardless of language).

- [ ] **Step 4**: Trim using `tools/trim_track.sh` → `mama/liedjes/audio/NN.mp3`.

- [ ] **Step 5**: Fetch YouTube thumbnails → `mama/liedjes/icons/NN.jpg` (400×400 square).

- [ ] **Step 6**: Write `~/code/liedjes/tracks/mama-liedjes.json`:

```json
{
  "title": "Liedjes",
  "lang": "fr",
  "parent_photo": "/home/mama.jpg",
  "parent_href": "/mama/",
  "app_version": "mama-liedjes-v1",
  "storage_prefix": "mama_liedjes",
  "cache_name": "mama-liedjes-v1",
  "mp3_cache_name": "mama-liedjes-mp3-v1",
  "manifest_name": "Mama Liedjes",
  "seed_order": [1, 2, 3, 4, 5],
  "tracks": [
    {"n": 1, "title": "Frère Jacques",     "audio": "audio/01.mp3", "icon": "icons/01.jpg"},
    ...
  ]
}
```

- [ ] **Step 7**: `python3 render.py mama-liedjes` → smoke test → commit:

```bash
cd ~/code/liedjes
git add tracks/mama-liedjes.json mama/liedjes/
git commit -m "mama/liedjes: 10 FR comptines (YouTube → trimmed mp3)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 6 — Verhalen (2 per taal)

### Task 15: Source 6 verhalen → 3 verhalen grids

**Files:**
- Create: `~/code/liedjes/{mama,papa,klas}/verhalen/audio/{01,02}.mp3`
- Create: `~/code/liedjes/{mama,papa,klas}/verhalen/icons/{01,02}.jpg`
- Create: `~/code/liedjes/tracks/{mama,papa,klas}-verhalen.json`

**Content matrix:**

| Track # | mama (FR) | papa (NL) | klas (EN) |
|---|---|---|---|
| 01 | Les Trois Petits Cochons | De Drie Biggetjes | The Three Little Pigs |
| 02 | Le Petit Chaperon Rouge | Roodkapje | Little Red Riding Hood |

- [ ] **Step 1: Source YouTube narrations**

For each of the 6 verhalen, find a YouTube narration with good audio quality (clear voice, single narrator, no music interruptions). Suggested searches:

```bash
yt-dlp --no-warnings --print "%(channel)s | %(title)s | %(duration)ss | %(id)s" \
       "ytsearch5:Les Trois Petits Cochons histoire enfants"
yt-dlp --no-warnings --print "%(channel)s | %(title)s | %(duration)ss | %(id)s" \
       "ytsearch5:De Drie Biggetjes voor kinderen"
yt-dlp --no-warnings --print "%(channel)s | %(title)s | %(duration)ss | %(id)s" \
       "ytsearch5:The Three Little Pigs bedtime story"
yt-dlp --no-warnings --print "%(channel)s | %(title)s | %(duration)ss | %(id)s" \
       "ytsearch5:Petit Chaperon Rouge histoire enfants"
yt-dlp --no-warnings --print "%(channel)s | %(title)s | %(duration)ss | %(id)s" \
       "ytsearch5:Roodkapje voor kinderen verhaal"
yt-dlp --no-warnings --print "%(channel)s | %(title)s | %(duration)ss | %(id)s" \
       "ytsearch5:Little Red Riding Hood story for kids"
```

Pick 1 winner per language per story. Target: 3-8 min runtime. Record in `/tmp/liedjes/verhalen-candidates.txt`.

- [ ] **Step 2: Download as wav**

Same yt-dlp pattern as Tasks 12-14. Files: `/tmp/liedjes/yt/{mama,papa,klas}-verhaal-{01,02}.wav`.

- [ ] **Step 3: Skip Whisper bound-finding for verhalen**

Verhalen don't have "verse bounds" — keep full audio. Just need to trim leading/trailing silence + outro. Use ffmpeg's `silenceremove` filter:

```bash
for f in mama-verhaal-01 mama-verhaal-02 papa-verhaal-01 papa-verhaal-02 klas-verhaal-01 klas-verhaal-02; do
  ffmpeg -y -hide_banner -loglevel error \
    -i "/tmp/liedjes/yt/${f}.wav" \
    -af "silenceremove=start_periods=1:start_duration=0.3:start_threshold=-40dB,silenceremove=stop_periods=-1:stop_duration=2.0:stop_threshold=-40dB" \
    "/tmp/liedjes/yt/${f}-trimmed.wav"
done
```

This strips leading silence + everything after a 2s silence near the end (typically the "thank you for watching" outro).

- [ ] **Step 4: Encode to 96 kbps mono mp3**

```bash
cd ~/code/liedjes
mkdir -p mama/verhalen/audio papa/verhalen/audio klas/verhalen/audio
for src_lang in mama:1 mama:2 papa:1 papa:2 klas:1 klas:2; do
  lang="${src_lang%:*}"; n="${src_lang#*:}"
  nn=$(printf "%02d" "$n")
  ffmpeg -y -hide_banner -loglevel error \
    -i "/tmp/liedjes/yt/${lang}-verhaal-${nn}-trimmed.wav" \
    -ac 1 -ar 44100 -b:a 96k \
    -af "afade=t=out:st=$(ffprobe -v error -show_entries format=duration -of csv=p=0 /tmp/liedjes/yt/${lang}-verhaal-${nn}-trimmed.wav | awk '{print $1-0.6}'):d=0.6" \
    "${lang}/verhalen/audio/${nn}.mp3"
done
```

- [ ] **Step 5: Fetch YouTube thumbnails for tiles**

Same pattern as Task 12 Step 5 → `{mama,papa,klas}/verhalen/icons/{01,02}.jpg`.

- [ ] **Step 6: Write tracks JSONs**

Create `~/code/liedjes/tracks/papa-verhalen.json`:

```json
{
  "title": "Verhalen",
  "lang": "nl",
  "parent_photo": "/home/papa.jpg",
  "parent_href": "/papa/",
  "app_version": "papa-verhalen-v1",
  "storage_prefix": "papa_verhalen",
  "cache_name": "papa-verhalen-v1",
  "mp3_cache_name": "papa-verhalen-mp3-v1",
  "manifest_name": "Papa Verhalen",
  "seed_order": [1, 2],
  "tracks": [
    {"n": 1, "title": "De Drie Biggetjes", "audio": "audio/01.mp3", "icon": "icons/01.jpg"},
    {"n": 2, "title": "Roodkapje",         "audio": "audio/02.mp3", "icon": "icons/02.jpg"}
  ]
}
```

Same for `mama-verhalen.json` (FR titles) and `klas-verhalen.json` (EN titles).

- [ ] **Step 7: Render + smoke test**

```bash
cd ~/code/liedjes
python3 render.py papa-verhalen mama-verhalen klas-verhalen
python3 -m http.server 8765 &
SERVER_PID=$!; sleep 1
open http://localhost:8765/papa/verhalen/
open http://localhost:8765/mama/verhalen/
open http://localhost:8765/klas/verhalen/
```

Manual: tap each tile, listen for 30 sec, confirm verhaal speelt zonder distortion.

```bash
kill $SERVER_PID
```

- [ ] **Step 8: Commit**

```bash
cd ~/code/liedjes
git add tracks/{papa,mama,klas}-verhalen.json {papa,mama,klas}/verhalen/
git commit -m "feat: 6 verhalen (Biggetjes + Roodkapje in NL/FR/EN)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 7 — Eendjes migration to new template

### Task 16: Regenerate /eendjes/ via render.py

**Files:**
- Create: `~/code/liedjes/tracks/eendjes.json` (extracted from existing `eendjes/index.html`)
- Modify: `~/code/liedjes/eendjes/index.html`, `~/code/liedjes/eendjes/service-worker.js`

- [ ] **Step 1: Extract eendjes track list**

Read `eendjes/index.html` to find the song array (similar `songs = [...]` block). Each entry has `n`, `title`, and a URL on `standaarduitgeverij.be`.

Run:
```bash
python3 <<'EOF'
import re, json
content = open('/Users/nico/code/liedjes/eendjes/index.html').read()
# Find the songs array — adapt the regex if format differs
match = re.search(r'const\s+songs\s*=\s*(\[[\s\S]*?\]);', content)
if not match:
    raise SystemExit('songs array not found — inspect eendjes/index.html')
# Use eval-style parse (the JS is JSON-compatible)
songs_js = match.group(1)
# Convert to JSON: drop trailing comma, quote keys
print(songs_js)
EOF
```

Inspect output. Manually copy into `~/code/liedjes/tracks/eendjes.json`:

```json
{
  "title": "Alle Eendjes",
  "lang": "nl",
  "parent_photo": "/home/papa.jpg",
  "parent_href": "/papa/boeken/",
  "app_version": "eendjes-v2",
  "storage_prefix": "eendjes",
  "cache_name": "eendjes-v10",
  "mp3_cache_name": "eendjes-mp3-v10",
  "manifest_name": "Alle Eendjes",
  "seed_order": [1, 4, 12, 13, 17],
  "tracks": [
    {"n": 1, "title": "<song 1 title>", "audio": "https://www.standaarduitgeverij.be/wp-content/uploads/...mp3", "icon": "icons/01.jpg"},
    ...
  ]
}
```

`parent_href: "/papa/boeken/"` — back-button goes up one level (eendjes is under papa→boeken in the new menu hierarchy).

- [ ] **Step 2: Render**

```bash
cd ~/code/liedjes
python3 render.py eendjes
```

Expected: `[ok]  eendjes → eendjes/  (26 tracks)`.

- [ ] **Step 3: Verify cross-origin prefetch still works**

The `service-worker.js` template short-circuits cross-origin requests (`if (url.origin !== self.location.origin) return;`) for the fetch handler, but the **prefetch message handler** uses `mode: "no-cors"` explicitly so it CAN cache Standaard Uitgeverij mp3s. Smoke test:

```bash
cd ~/code/liedjes && python3 -m http.server 8765 &
SERVER_PID=$!; sleep 1
open http://localhost:8765/eendjes/
```

Open browser devtools → Application → Service Workers → check that SW registered. Then Cache Storage → `eendjes-mp3-v10` should be populating with `standaarduitgeverij.be/...` URLs. Tap a tile, full-screen still appears, audio plays.

```bash
kill $SERVER_PID
```

- [ ] **Step 4: Commit**

```bash
cd ~/code/liedjes
git add tracks/eendjes.json eendjes/index.html eendjes/service-worker.js eendjes/popularity.json eendjes/manifest.json
git commit -m "eendjes: migrate to render.py template (full-screen player, hoek-cirkel)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 8 — Verification + deploy

### Task 17: Telemetry round-trip verification

- [ ] **Step 1: Play one item per grid in browser**

Run:
```bash
cd ~/code/liedjes && python3 -m http.server 8765 &
SERVER_PID=$!; sleep 1
```

Open each URL in browser, tap any tile, let it play >5s:
```bash
open http://localhost:8765/rhymes/
open http://localhost:8765/eendjes/
open http://localhost:8765/papa/liedjes/
open http://localhost:8765/papa/verhalen/
open http://localhost:8765/mama/liedjes/
open http://localhost:8765/mama/verhalen/
open http://localhost:8765/klas/verhalen/
```

Wait 60s after the last play (telemetry flush interval is 30s).

```bash
kill $SERVER_PID
```

- [ ] **Step 2: Verify events landed in logs/**

```bash
cd ~/code/liedjes
git pull --rebase
ls -la logs/$(date +%Y-%m-%d)/ | head -20
```

Expected: new JSONL files dated today. Open one and verify `app_version` matches the grid you played (e.g., `rhymes-v2`, `papa-liedjes-v1`).

- [ ] **Step 3: Check Worker is happy**

```bash
curl -s https://liedjes-logger.super-mud-e2ef.workers.dev/ | head
```

Expected: 200 OK response (health check).

### Task 18: iPad device smoke test

- [ ] **Step 1: Push branch and wait for GitHub Pages deploy**

```bash
cd ~/code/liedjes
git push origin main
# GitHub Pages deploys within ~60s. Watch:
gh run watch
```

- [ ] **Step 2: Hard-refresh on iPad**

On William's iPad, in Safari (or installed PWA):
1. Pull-to-refresh on `https://nicolasmertens.github.io/liedjes/`.
2. If PWA installed, force-quit Safari/PWA + reopen.

- [ ] **Step 3: Run through full flow with toddler**

| Action | Expected |
|---|---|
| Home loads | 3 photo tiles (mama Eline / papa Nick+William / klas text) |
| Tap mama | Lands on `/mama/` with 3 colored category tiles, foto-cirkel rechtsboven |
| Tap Liedjes | FR liedjes grid, foto-cirkel rechtsboven (Eline) |
| Tap a tile | Full-screen image fills screen, audio plays |
| Tap anywhere on player | Player closes, returns to grid |
| Tap foto-cirkel | Back to `/mama/` (NOT all the way to home — parent_href = /mama/) |
| Tap foto-cirkel again | Back to home (mama landing's button goes to /) |
| Repeat for papa + klas |

- [ ] **Step 4: Verify hoek-cirkel works during playback**

While a song is playing (full-screen), tap the foto-cirkel rechtsboven (visible above the player). Expected: stops audio + navigates to parent_href. (Player overlay has lower z-index than home-btn — home-btn stays clickable.)

- [ ] **Step 5: Confirm no console errors**

Connect iPad to Mac via USB → Safari Develop menu → inspect iPad → check Console tab. Should be clean (no red errors).

### Task 19: Final commit + memory update

- [ ] **Step 1: Update liedjes-app memory entry**

Edit `~/.claude/projects/-Users-nico/memory/liedjes-app.md` to reflect the new structure. Update the "Architecture" section to mention:
- Home with 3 photo tiles
- Per-language landings with 3 categories
- render.py + templates approach
- Full-screen still playback UX

- [ ] **Step 2: Commit any final cleanup**

```bash
cd ~/code/liedjes
git status
# If anything stray: git add ... && git commit -m "..."
```

- [ ] **Step 3: Mark task complete in TaskList**

Use TaskUpdate to mark all plan-related tasks as completed.

---

## Open items (do NOT block v1)

| Item | When to act |
|---|---|
| Klas photo | When Nick takes one at daycare → drop `home/klas.jpg` in repo, commit. No code changes needed (text fallback auto-replaced by `<img onerror>`). |
| Bigger photos | If 374px crops look low-res on the iPad (Retina would prefer 1024px+), Nick can swap with higher-res versions. Same file paths, no code changes. |
| 2nd boek per taal | When Nick wants to add another book → create `<lang>/boeken/` as a real grid (replace the "Binnenkort" stub), add to `tracks/<lang>-boeken.json`, render. |
| Migrate `/rhymes/` → `/klas/liedjes/` | Defer to v3. Breaks bookmarks; do only if Nick wants URL consistency. |
| Debug bar | The old `?debug=1` UI was dropped from the template (YAGNI for new grids). If Nick wants it for tap-tuning, re-add to template. |
| Custom thumbnails for compilation splits (#13, #14) | Tracks 12/13/14 share the same YouTube thumbnail. Nick could crop unique ones from book photos later. |
