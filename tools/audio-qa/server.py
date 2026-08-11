#!/usr/bin/env python3
"""Local audio-qa server: static repo + auto-install recordings into the library.

Why: Safari/GH Pages cannot write the git repo. This process binds localhost,
receives each take over HTTP, converts to mp3, writes the target path, and
commits + pushes so Memory / Which One / soundboard pick it up.

  python3 tools/audio-qa/server.py
  open http://127.0.0.1:18787/tools/audio-qa/

POST /api/recording
  Headers:
    X-Liedjes-Path: papa/games/name/01.mp3
    Content-Type: audio/wav | audio/mp4 | …
  Body: raw audio bytes

GET /api/health → { ok, root, auto_git }
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
HOST = "127.0.0.1"
PORT = int(os.environ.get("LIEDJES_AUDIO_QA_PORT", "18787"))
AUTO_GIT = os.environ.get("LIEDJES_AUDIO_QA_GIT", "1") not in ("0", "false", "no")
ALLOWED_ROOTS = {"klas", "mama", "papa"}
ALLOWED_PARTS = {"games"}
ALLOWED_LEAFS = {"name", "sound", "fx", "audio"}

_git_lock = threading.Lock()
_pending: list[Path] = []
_git_timer: threading.Timer | None = None


def log(msg: str) -> None:
    print(msg, flush=True)


def safe_rel_path(raw: str) -> Path | None:
    """papa/games/name/01.mp3 → Path under ROOT, or None if disallowed."""
    if not raw or ".." in raw or raw.startswith("/") or "\\" in raw:
        return None
    rel = Path(raw.strip().lstrip("./"))
    parts = rel.parts
    if len(parts) < 4:
        return None
    if parts[0] not in ALLOWED_ROOTS:
        return None
    if parts[1] != "games":
        return None
    if parts[2] not in ALLOWED_LEAFS:
        return None
    if rel.suffix.lower() not in {".mp3", ".wav", ".m4a", ".webm", ".ogg", ".mp4", ".aac", ".caf"}:
        # force destination to .mp3 always
        rel = rel.with_suffix(".mp3")
    else:
        rel = rel.with_suffix(".mp3")
    # filename like 01.mp3 or jaaa.mp3
    name = rel.name
    if not name or name.startswith("."):
        return None
    return rel


def to_mp3_bytes(data: bytes, src_suffix: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    suffix = src_suffix if src_suffix.startswith(".") else f".{src_suffix}"
    if suffix.lower() == ".mp3":
        dest.write_bytes(data)
        return
    with tempfile.TemporaryDirectory() as td:
        src = Path(td) / f"in{suffix or '.bin'}"
        src.write_bytes(data)
        cmd = [
            "ffmpeg", "-y", "-i", str(src),
            "-codec:a", "libmp3lame", "-qscale:a", "4",
            str(dest),
        ]
        subprocess.run(cmd, check=True, capture_output=True)


def schedule_git(paths: list[Path]) -> None:
    if not AUTO_GIT:
        return
    global _git_timer
    with _git_lock:
        _pending.extend(paths)
        if _git_timer is not None:
            _git_timer.cancel()
        _git_timer = threading.Timer(1.5, flush_git)
        _git_timer.daemon = True
        _git_timer.start()


def flush_git() -> None:
    with _git_lock:
        paths = list(dict.fromkeys(_pending))
        _pending.clear()
    if not paths:
        return
    try:
        rels = [str(p.relative_to(ROOT)) for p in paths if p.exists()]
        if not rels:
            return
        subprocess.run(["git", "add", "--"] + rels, cwd=ROOT, check=True, capture_output=True)
        # only commit if staged changes
        st = subprocess.run(
            ["git", "diff", "--cached", "--quiet"],
            cwd=ROOT,
            capture_output=True,
        )
        if st.returncode == 0:
            log("[git] nothing new to commit")
            return
        msg = "audio(qa): auto-install " + ", ".join(Path(r).name for r in rels[:8])
        if len(rels) > 8:
            msg += f" (+{len(rels) - 8})"
        subprocess.run(
            ["git", "commit", "-m", msg],
            cwd=ROOT,
            check=True,
            capture_output=True,
        )
        push = subprocess.run(
            ["git", "push", "origin", "HEAD"],
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        if push.returncode == 0:
            log(f"[git] committed+pushed {len(rels)} file(s)")
        else:
            log(f"[git] commit ok, push failed: {push.stderr.strip()[:300]}")
    except subprocess.CalledProcessError as e:
        err = (e.stderr or b"").decode("utf-8", "replace")[:400]
        log(f"[git] failed: {err or e}")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt: str, *args) -> None:
        log("%s - %s" % (self.address_string(), fmt % args))

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type, X-Liedjes-Path, X-Liedjes-Id, X-Liedjes-Label",
        )

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            body = json.dumps(
                {
                    "ok": True,
                    "root": str(ROOT),
                    "auto_git": AUTO_GIT,
                    "version": 1,
                }
            ).encode()
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path != "/api/recording":
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > 25 * 1024 * 1024:
            self._json(400, {"ok": False, "error": "bad Content-Length"})
            return

        raw_path = self.headers.get("X-Liedjes-Path") or ""
        rec_id = self.headers.get("X-Liedjes-Id") or ""
        label = self.headers.get("X-Liedjes-Label") or ""
        ctype = (self.headers.get("Content-Type") or "application/octet-stream").split(";")[0].strip()

        rel = safe_rel_path(raw_path)
        if not rel:
            self._json(400, {"ok": False, "error": f"disallowed path: {raw_path!r}"})
            return

        data = self.rfile.read(length)
        if not data:
            self._json(400, {"ok": False, "error": "empty body"})
            return

        # map content-type → temp suffix
        suffix = {
            "audio/wav": ".wav",
            "audio/wave": ".wav",
            "audio/x-wav": ".wav",
            "audio/mp4": ".m4a",
            "audio/aac": ".m4a",
            "audio/mpeg": ".mp3",
            "audio/mp3": ".mp3",
            "audio/webm": ".webm",
            "audio/ogg": ".ogg",
        }.get(ctype, ".bin")

        dest = ROOT / rel
        try:
            to_mp3_bytes(data, suffix, dest)
        except subprocess.CalledProcessError as e:
            err = (e.stderr or b"").decode("utf-8", "replace")[:300]
            self._json(500, {"ok": False, "error": f"ffmpeg failed: {err}"})
            return
        except Exception as e:
            self._json(500, {"ok": False, "error": str(e)})
            return

        log(f"[install] {rel}  ({len(data)} bytes {ctype}) id={rec_id!r} {label!r}")
        schedule_git([dest])

        self._json(
            200,
            {
                "ok": True,
                "path": str(rel),
                "bytes": dest.stat().st_size,
                "id": rec_id,
                "auto_git": AUTO_GIT,
            },
        )

    def _json(self, code: int, obj: dict) -> None:
        body = json.dumps(obj).encode()
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> int:
    os.chdir(ROOT)
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    log(f"liedjes audio-qa server  http://{HOST}:{PORT}/tools/audio-qa/")
    log(f"  root={ROOT}")
    log(f"  auto_git={AUTO_GIT}  (set LIEDJES_AUDIO_QA_GIT=0 to disable push)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        log("bye")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
