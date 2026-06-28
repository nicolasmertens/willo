# Timed slideshow tracks (synced stills per scene)

Date: 2026-06-28
Status: approved (approach), implementing

## Problem

The player shows ONE static still (`track.icon`) for the whole song. For songs
that walk through many distinct scenes, e.g. "50 Animal Sounds for Kids" (9:02,
50 animals), we want the still to change in sync with the audio: each animal's
image appears exactly when that animal is heard.

First target track: https://www.youtube.com/watch?v=DkW9Gin8W1o into `klas/liedjes`.

## Approach (chosen)

Auto scene-detection. Download the video once, run ffmpeg scene-change detection
to find every cut (each animal == one scene), grab one frame per scene with its
start timestamp. Faithful to the video, fully automatic. Verify the detected
count is sane (~50) and tune the threshold if needed.

Rejected: even-time sampling (lands mid-transition), embedding the YouTube video
(needs network/iframe, breaks the offline still-player model).

## Data model

A track gains an OPTIONAL `frames` array. No `frames` => current behaviour
(single `icon`), fully backward compatible.

```json
{
  "n": 9,
  "title": "Animal Sounds",
  "audio": "liedjes/audio/09.mp3",
  "icon": "liedjes/icons/09.jpg",
  "frames": [
    {"t": 0.0,  "src": "liedjes/frames/09/0001.jpg"},
    {"t": 11.3, "src": "liedjes/frames/09/0002.jpg"}
  ]
}
```

- `t` = seconds from start; frames sorted ascending; first frame at `t: 0.0`.
- `src` paths follow the existing section-relative convention.
- `icon` (grid tile) = square-cropped first frame.
- Slideshow frames keep native 16:9 (player CSS is `object-fit: contain`, so
  they letterbox cleanly).

## Player change (templates/taal.html, mirrored in grid.html)

- One persistent `audio.timeupdate` listener. When `currentTrack.frames` exists,
  compute the active frame index for `audio.currentTime` and update
  `playerImg.src` only when the index changes (no per-tick churn).
- `showPlayer(track)`: if `track.frames?.length`, preload all frame images via
  `new Image()` so swaps are instant, set `playerImg.src` to `frames[0].src`.
  Otherwise keep current `track.icon` behaviour.
- `hidePlayer()`/`stop()`: reset slideshow state.
- Frame `.jpg`s are cached automatically by the existing service-worker
  stale-while-revalidate path; no SW change required.

## Tooling: tools/add-slideshow.py

Parallels `add-content.py` but for slideshow tracks. Usage:

```
tools/add-slideshow.py <taal> <sectie> <youtube-url> "<title>" [--threshold 0.3] [--no-push]
```

Steps:
1. yt-dlp download a single muxed mp4 (video+audio) for frame/audio alignment.
2. Extract audio -> `<taal>/<sectie>/audio/<NN>.mp3`.
3. ffmpeg scene detect (`select='gt(scene,THRESH)'` + `showinfo`) -> timestamps;
   always include t=0. Extract one frame per timestamp ->
   `<taal>/<sectie>/frames/<NN>/<idx>.jpg` (scaled to 640w, q3).
4. Square-crop frame 1 -> `<taal>/<sectie>/icons/<NN>.jpg`.
5. Append the track (with `frames`) to `tracks/<taal>-<sectie>.json`.
6. `render.py <taal>`, commit, pull --rebase, push.

Report the detected frame count so we can sanity-check vs ~50 and re-run with a
different `--threshold` if way off.

## Out of scope (YAGNI)

- Manual per-frame timestamp editing UI.
- Transitions/animations between frames (hard cut is fine for this content).
- Retrofitting existing single-icon tracks.
