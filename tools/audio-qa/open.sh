#!/bin/bash
# Start local audio-qa server (if needed) and open the page in Safari.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT="${LIEDJES_AUDIO_QA_PORT:-18787}"
URL="http://127.0.0.1:${PORT}/tools/audio-qa/?v=$(date +%s)"

if ! curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
  echo "starting audio-qa server on :${PORT}…"
  nohup python3 "$ROOT/tools/audio-qa/server.py" \
    >>"$ROOT/tools/audio-qa/server.log" 2>&1 &
  # wait until healthy
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
      break
    fi
    sleep 0.3
  done
fi

curl -sf "http://127.0.0.1:${PORT}/api/health" | python3 -m json.tool || {
  echo "server failed to start — see tools/audio-qa/server.log" >&2
  exit 1
}

open -a Safari "$URL"
echo "$URL"
printf '%s' "$URL" | pbcopy 2>/dev/null || true
