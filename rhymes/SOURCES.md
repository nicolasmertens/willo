# Audio sources — rhymes/

Each tile is a YouTube nursery-rhyme video, downloaded via `yt-dlp` and
re-encoded to 96 kbps mono mp3. Trim bounds (`start` + `dur` in seconds)
were chosen via Whisper transcription: `start = first vocal word − 2 s`
(pre-roll) and `dur = first natural verse-end − start + 0.6 s` (tail
fade). Verse end is the first inter-segment gap ≥ 1.3 s after at least
8 s of vocals.

| # | Rhyme                          | Channel              | YouTube ID     | start | dur   |
|---|--------------------------------|----------------------|----------------|-------|-------|
| 01 | Twinkle, Twinkle, Little Star  | Super Simple Songs   | yCjJyiqpAuU    | 17.60 | 35.18 |
| 02 | Hey Diddle Diddle              | Little Baby Bum      | sJiw-edttDY    | 25.00 | 75.00 |
| 03 | Hickory Dickory Dock           | Super Simple Songs   | HGgsklW-mtg    |  4.64 | 24.60 |
| 04 | Mary Had a Little Lamb         | Emma And Joey        | JR40Zr0y7Nw    |  7.00 | 63.00 |
| 05 | Humpty Dumpty                  | Super Simple Songs   | nrv495corBc    |  8.84 | 11.86 |
| 06 | The Itsy Bitsy Spider          | Twinkle Little Songs | w_lCi8U49mY    |  2.72 | 22.66 |
| 07 | Jack and Jill                  | Super Simple Songs   | EFj0K38sPmA    |  6.38 | 18.86 |
| 08 | Little Bo-Peep                 | Dave and Ava         | w0eJJUv9BEQ    | 55.00 | 29.00 |
| 09 | There Was an Old Woman         | Sunbeam Publishers   | taHSyGBOPlo    | 14.00 | 26.29 |
| 10 | This Little Piggy              | Bounce Patrol        | 5bdTKxLAoos    | 28.00 | 26.16 |
| 11 | Vroom Vroom                    | Super Simple Songs   | B1u-ylQR6Fo    |  0.10 | 25.50 |
| 12 | I Love My Garbage Truck        | Super Simple Songs   | YEmFhRK-dTg    | 14.40 | 31.40 |
| 13 | Driving In My Car              | Super Simple Songs   | YEmFhRK-dTg    | 173.30 | 50.10 |
| 14 | Here Comes The Firetruck       | Super Simple Songs   | YEmFhRK-dTg    | 1472.70 | 60.30 |
| 15 | Baby Shark                     | Super Simple Songs   | GR2o6k8aPlI    |  0.00 | 45.00 |
| 16 | One Little Finger              | Super Simple Songs   | eBVqcTEC3zQ    |  1.60 | 35.00 |
| 17 | The Wheels On The Bus          | Super Simple Songs   | yWirdnSDsV4    | 26.58 | 28.10 |

## Re-render pipeline

1. Source wavs live in `/tmp/liedjes_rhymes/yt/NN.wav` on maxbook (kept
   between runs so Whisper + ffmpeg don't re-download).
2. `/tmp/liedjes_rhymes/find_verse_bounds.py` reads Whisper word-level
   transcripts from `/tmp/liedjes_rhymes/whisper/NN.json` and prints
   `(start, dur)` per track.
3. `/tmp/liedjes_rhymes/yt_rerender.sh` paste those values into a bash
   array and renders mp3s into `rhymes/audio/`.

## Notes

- All 10 are commercial recordings used here on a single child's home
  tablet. Repo is public for telemetry tooling convenience — if
  redistribution becomes a concern, either flip the repo to private (GH
  Pages still works on private repos with Pro) or replace with
  public-domain renditions.
