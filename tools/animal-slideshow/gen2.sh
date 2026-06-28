#!/usr/bin/env bash
# gen2.sh <listfile> <local|remote> <logfile>
# local  = run draw-things-cli on this machine (maxbook)
# remote = ssh nicbook and run there
set -uo pipefail
SP="/private/tmp/claude-501/-Users-nico/704e902b-c061-486b-8ef5-292c7c10714d/scratchpad"
cd "$SP"
LIST="$1"; MODE="$2"; LOG="$3"
mkdir -p gen gen/seed
PROMPT_TMPL=$(cat styleprompt.txt)
: > "$LOG"
total=$(wc -l < "$LIST" | tr -d ' '); i=0
while IFS=$'\t' read -r n t animal; do
  i=$((i+1))
  out="gen/$(printf '%02d' "$n")_${animal}.png"
  if [ -s "$out" ]; then echo "[$i/$total] skip $animal" >> "$LOG"; continue; fi
  seed=7; [ -f "gen/seed/$n" ] && seed=$(cat "gen/seed/$n")
  prompt="${PROMPT_TMPL/ANIMAL/$animal}"
  if [ "$MODE" = local ]; then
    pf=$(mktemp); printf %s "$prompt" > "$pf"
    echo "[$i/$total] gen $animal (seed $seed, local)…" >> "$LOG"
    draw-things-cli generate --model flux_1_schnell_q8p.ckpt --prompt-file "$pf" \
      --width 768 --height 768 --steps 4 --seed "$seed" --output "$out" --disable-preview >>"$LOG" 2>&1
    rm -f "$pf"
  else
    b64=$(printf %s "$prompt" | base64)
    remote="set -e; d=\$(mktemp -d); printf %s '$b64' | base64 -d > \"\$d/p.txt\"; draw-things-cli generate --model flux_1_schnell_q8p.ckpt --prompt-file \"\$d/p.txt\" --width 768 --height 768 --steps 4 --seed $seed --output \"\$d/o.png\" --disable-preview 1>&2; base64 < \"\$d/o.png\"; rm -rf \"\$d\""
    echo "[$i/$total] gen $animal (seed $seed, remote)…" >> "$LOG"
    echo "$remote" | ssh -o ConnectTimeout=15 nicbook zsh -l 2>>"$LOG" | tr -d '[:space:]' | base64 -d > "$out" 2>>"$LOG"
  fi
  sz=$(ls -la "$out" 2>/dev/null | awk '{print $5}')
  if [ -z "$sz" ] || [ "$sz" -lt 10000 ]; then echo "[$i/$total] FAIL $animal (sz=$sz)" >> "$LOG"; rm -f "$out"; else echo "[$i/$total] ok $animal ($sz B)" >> "$LOG"; fi
done < "$LIST"
echo "DONE $LIST" >> "$LOG"
