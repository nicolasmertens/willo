"""Detect (trim_start, trim_dur) per track by finding the natural end of
the first sung verse.

Strategy: end of verse 1 = first inter-segment gap >= GAP_THRESHOLD after
at least MIN_VERSE_LEN of vocal content. Pre-roll PRE_ROLL_SEC before the
first vocal segment, tail TAIL_FADE_SEC after the last segment of verse 1.

Falls back to the last "real" segment if no gap is found (caps at
MAX_DUR seconds to avoid running into hallucinated outros).
"""

import json
import sys
from pathlib import Path
import argparse

PRE_ROLL_SEC = 2.0
TAIL_FADE_SEC = 0.6
GAP_THRESHOLD = 1.3         # seconds of silence that marks a verse break
MIN_VERSE_LEN = 8.0         # don't bail on a gap before this much singing has elapsed
MAX_DUR = 60.0              # safety cap

# Whisper sometimes hallucinates at the end of audio — cluster of tiny-duration
# words past the actual content. Filter segments whose mean word duration is
# below this threshold.
MIN_WORD_DUR = 0.05


def is_real_segment(seg):
    words = seg.get("words", [])
    if not words:
        return True  # no word-level info, assume real
    durs = [w["end"] - w["start"] for w in words if w["end"] > w["start"]]
    if not durs:
        return False
    return (sum(durs) / len(durs)) >= MIN_WORD_DUR


def normalize_words(text):
    import re
    return [w for w in re.sub(r"[^a-z0-9 ]+", " ", text.lower()).split() if w]


def find_bounds(segments, track_dur):
    real = [s for s in segments if is_real_segment(s)]
    if not real:
        return None, None, "no real segments"

    # Skip leading "channel intro" segments — short voiceover followed by a
    # large gap (>= 8s) before the actual song begins.
    while len(real) >= 2 and (float(real[1]["start"]) - float(real[0]["end"])) >= 8.0:
        real = real[1:]

    first = real[0]
    vocal_start = float(first["start"])
    prev_end = float(first["end"])

    # Opening phrase = first 3 distinct content words of the first segment(s).
    opening = []
    for s in real:
        for w in normalize_words(s["text"]):
            if w in {"the", "a", "an", "and", "to", "of"}:
                continue
            if w not in opening:
                opening.append(w)
            if len(opening) >= 3:
                break
        if len(opening) >= 3:
            break

    end_time = None
    reason = ""

    # Strategy 1: first inter-segment gap >= GAP_THRESHOLD after MIN_VERSE_LEN.
    for s in real[1:]:
        st = float(s["start"])
        if (st - prev_end) >= GAP_THRESHOLD and (prev_end - vocal_start) >= MIN_VERSE_LEN:
            end_time = prev_end
            reason = f"gap {st - prev_end:.2f}s after {prev_end:.2f}s"
            break
        prev_end = float(s["end"])

    # Strategy 2: first re-appearance of opening 3-word phrase after MIN_VERSE_LEN.
    if end_time is None and len(opening) >= 3:
        for i, s in enumerate(real[1:], start=1):
            st = float(s["start"])
            if (st - vocal_start) < MIN_VERSE_LEN:
                continue
            seg_words = normalize_words(s["text"])
            # check if all 3 opening words appear (any order) in this segment's text
            if all(o in seg_words for o in opening[:3]):
                end_time = float(real[i - 1]["end"])
                reason = f"opening phrase {opening[:3]} reappears at {st:.2f}s"
                break

    # Strategy 3: cap at MAX_DUR or use last real segment.
    if end_time is None:
        last_end = float(real[-1]["end"])
        end_time = min(last_end, vocal_start + MAX_DUR)
        reason = "no gap or repeat, last real seg or MAX_DUR"

    trim_start = max(0.0, vocal_start - PRE_ROLL_SEC)
    trim_dur = (end_time + TAIL_FADE_SEC) - trim_start
    return trim_start, trim_dur, reason


def main():
    p = argparse.ArgumentParser(
        description="Find verse bounds for a single track in a whisper JSON."
    )
    p.add_argument("--whisper-dir", required=True, type=Path,
                   help="Directory containing <track>.json whisper outputs")
    p.add_argument("--track", required=True,
                   help="Track stem (e.g., 'papa-01' or '01') — reads <whisper-dir>/<track>.json")
    args = p.parse_args()

    jpath = args.whisper_dir / f"{args.track}.json"
    try:
        data = json.loads(jpath.read_text())
    except FileNotFoundError:
        sys.exit(f"File not found: {jpath}")
    except json.JSONDecodeError as e:
        sys.exit(f"Invalid JSON in {jpath}: {e}")

    segments = data.get("segments", [])
    track_dur = data.get("duration", 0)
    if not track_dur and segments:
        track_dur = max(float(s["end"]) for s in segments)

    trim_start, trim_dur, reason = find_bounds(segments, track_dur)
    if trim_start is None:
        sys.exit(f"no bounds found for {args.track}: {reason}")

    print(f"{trim_start:.2f} {trim_dur:.2f}")


if __name__ == "__main__":
    main()
