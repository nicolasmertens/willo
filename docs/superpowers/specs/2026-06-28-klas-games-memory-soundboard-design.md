# Klas "Games": Memory + Sound board (animal mini-apps)

Date: 2026-06-28
Status: approved, implementing

## Background

"Animal Sounds" was a liedjes track (song + synced slideshow). It is not a song.
We repurpose its 50 animal illustrations + audio into two toddler mini-apps in a
new **Games** category. Klas only for now (English); papa/mama later.

## Layout change (klas taal page)

- Top row becomes two half-width sections side by side: **Books** (left 50%) and
  **Games** (right 50%). Below: **Songs**, then **Stories** (full width as now).
- Responsive: on narrow screens (<=900px) the two halves stack full width.
- "Animal Sounds" is removed from the Songs section.

## Category & tiles

New section key `games` (label "Games" for en). It holds 2 link-tiles (no audio;
each has an `href` so the existing tap->navigate path launches it):

1. **Memory** -> `/liedjes/klas/games/memory/`
2. **Sounds** -> `/liedjes/klas/games/soundboard/`

Each tile icon = a 3x3 grid of frontal animal heads (generated). Memory and
Sounds use distinct accents/labels.

## Shared assets (under `klas/games/`)

- `img/NN.jpg` — the 50 animal illustrations (moved from the old frames/09).
- `audio/NN.mp3` — per-animal sound clip (~6-7s) cut from the old song audio
  using the OCR timestamps in tools/animal-slideshow/animals.tsv: clip i =
  `[t_i, min(t_i+7, t_{i+1}-0.3)]` with short fades.
- `animals.json` — `[{n, name, img:"img/NN.jpg", sound:"audio/NN.mp3"}]` x50.

After extraction, delete the orphaned `klas/liedjes/frames/09` and
`klas/liedjes/audio/09.mp3`.

## App 1: Sound board (`klas/games/soundboard/`)

Purpose: practice the animal sounds.
- LEFT (~70%): scrollable grid of all 50 animal illustrations (tap targets).
- RIGHT (~30%): on tap of an animal -> shows that animal big + its **name** +
  plays its sound clip. When nothing is selected, or the clip has finished ->
  a gray panel with a left-pointing arrow (prompt to pick on the left).
- One audio element; tapping another animal interrupts/replaces.

## App 2: Memory (`klas/games/memory/`)

Purpose: pairs game for a ~20-month-old who loves animals.
- Level chooser: 4 / 6 / 8 pairs (big buttons).
- Board: 2*pairs cards face down (animal-patterned back). Tap flips a card,
  shows the animal + plays its sound. Two flipped: match -> stay revealed +
  confetti/fireworks burst + cheer; no match -> flip both back after ~900ms.
- All matched -> full-screen celebration (big confetti) + "play again".
- Random subset of animals each game.
- Confetti: small self-contained canvas function (offline, no CDN).

## Tech / conventions

- Both apps are self-contained static pages (own HTML/CSS/JS), launched via the
  tile `href`; a top-left back arrow does `history.back()`.
- They load `../animals.json` (relative) for the animal set.
- Style matches the app (rounded tiles, warm palette, big touch targets, the
  palm-reject / tap-tuning niceties are nice-to-have, not required for v1).
- Added to the klas service-worker precache so they work offline / as PWA.
- render.py: add `games` to klas sections + the half-width row; SECTION_LABELS
  gets `games`. Other talen unchanged (no games section).

## Out of scope (v1)

- papa/mama games (no NL/FR sound clips yet).
- Localized animal names/sounds.
- Score/timer/leaderboard.
