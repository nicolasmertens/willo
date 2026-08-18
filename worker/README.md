# liedjes-logger

Cloudflare Worker that receives behavioural-log batches from the Liedjes PWA
and commits them as JSONL files into `logs/<date>/<time>-<rand>.jsonl` in
this repo.

## Endpoints

- `POST /log` telemetry JSONL
- `POST /kid` PNG, origin `https://nicolasmertens.github.io` → `{ id, url }` (KV, 24h)
- `GET /kid/:id.png` public, for iOS Add to Home Screen
- `DELETE /kid/:id` origin-gated, after first standalone open

`POST https://liedjes-logger.super-mud-e2ef.workers.dev/log`

Body:

```json
{
  "events":     [ {"t": 1234567890, "type": "touchend", "n": 4, ...}, ... ],
  "session_id": "<uuid>",
  "device_id":  "<uuid, persistent>",
  "app_version": "v3"
}
```

Origin gate: only `https://nicolasmertens.github.io` is allowed; every other
origin returns 403.

## Deploy

```bash
cd worker
# CLOUDFLARE_API_TOKEN must be exported (or sourced from ~/dev/secrets/secrets.env)
wrangler deploy

# Initial setup: set the GitHub PAT used to commit log files.
gh auth token | wrangler secret put GH_TOKEN
```

The PAT only needs `Contents: write` on this repo. Currently set to the
default `gh auth token` (broad scope); replace with a fine-grained PAT
when rotating.

## Analysing logs

Each batch is a separate `.jsonl` file. To concatenate everything:

```bash
find logs -name '*.jsonl' -exec cat {} + > all-events.jsonl
```

Each line has the original event fields plus ingestion metadata
(`_ingested_at`, `_session_id`, `_device_id`, `_app_version`, `_ua`,
`_ip`, `_country`).
