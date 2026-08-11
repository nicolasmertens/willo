# Audio QA — review + re-record library

Safari page: https://nicolasmertens.github.io/liedjes/tools/audio-qa/

## Why

Name clips (especially NL) were batch AI-generated and many sound off. Same files feed:

- Memory (flip reveal)
- Which One? (prompt + wrong-answer name)
- Soundboard (Noms / Namen toggle)

One good re-record updates all of those.

| Kind | Scope |
|------|--------|
| Naam EN / FR / NL | per taal (`klas|mama|papa/games/name/NN.mp3`) |
| Cri (dierengeluid) | 1× shared (`klas/games/sound/NN.mp3`) |
| FX | shared (`klas/games/fx/jaaa.mp3`, `neee.mp3`) |

## Workflow

1. Open the QA page → filter (e.g. NL names, or FX).
2. Play · leave **open** if bad · **✓** if good.
3. **Record** bad ones yourself (mic).
4. **Download alle opnames** (or ↓ per row) → `~/Downloads/liedjes-rec__…`
5. Install into the repo:

```bash
cd ~/dev/code/liedjes
python3 tools/audio-qa/install-recordings.py          # from ~/Downloads
python3 tools/audio-qa/install-recordings.py --dry-run
```

6. Commit / push (or ask the agent: “installeer opnames”).

## Marking

- **Checked = good**
- **Open = still needs work**
