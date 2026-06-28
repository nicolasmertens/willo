# Animal Sounds slideshow pipeline (klas track #9)

Reproducible recipe for the timed AI-illustration slideshow.

- `animals.tsv` — the 50 animals in song order: `n<TAB>t_seconds<TAB>NAME`
  (timestamps = when each name card appears in the TinyJoy "50 Animal Sounds"
  video DkW9Gin8W1o, extracted by OCR'ing the cards with tesseract).
- `styleprompt.txt` — single fixed FLUX style prompt (ANIMAL is substituted).
- `headprompt.txt` — head close-up prompt used for the fan-of-heads hero.
- `gen2.sh <listfile> <local|remote> <logfile>` — batch-generate via
  draw-things-cli (FLUX.1-schnell, Apache-2.0). `local` = this Mac,
  `remote` = ssh nicbook. Resumable (skips existing). Split across both
  machines for ~2x by feeding disjoint sublists.
- `assemble_frames.py` — turns gen PNGs into klas/liedjes/frames/09/*.jpg +
  rewrites the track `frames` array with the timestamps. Audio untouched.
- `fan.sh` — builds the hero tile (5 head cutouts on white discs, fanned arch).

NOTE: scripts use absolute scratchpad paths from the build session; adjust the
`SP=` line before re-running. Model used: `flux_1_schnell_q8p.ckpt` (commercial
OK, output owned by user, generated locally/offline).
