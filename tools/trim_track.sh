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
