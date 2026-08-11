# Audio QA — auto-sync library

## Why not GH Pages alone?

A browser on GitHub Pages **cannot write your git repo**. That is a browser security boundary, not a missing checkbox. So the integral path is:

1. Local server on your Mac (`server.py`)
2. Page records → **POST /api/recording**
3. Server writes mp3 under `papa|mama|klas/games/...`
4. Server **git commit + push**

Memory / Which One / soundboard all read those files.

## Always open like this

```bash
cd ~/dev/code/liedjes
./tools/audio-qa/open.sh
```

Safari → `http://127.0.0.1:18787/tools/audio-qa/`  
Banner must say **Auto-sync aan**.

## Env

| Var | Default |
|-----|---------|
| `LIEDJES_AUDIO_QA_PORT` | `18787` |
| `LIEDJES_AUDIO_QA_GIT` | `1` (set `0` to skip push) |
