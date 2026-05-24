// liedjes-logger
// Receives batched behaviour-log events from the Liedjes PWA and commits
// them as a new JSONL file in nicolasmertens/liedjes under logs/<date>/
// on the orphan `logs` branch (kept off main so telemetry commits don't
// trigger GH Pages builds).
//
// Each batch produces its own file so concurrent writes never race.
// GitHub PAT lives only in env.GH_TOKEN (Worker secret).
//
// Endpoint:
//   POST /log    body: { events: [...], session_id, device_id, app_version }
//   GET  /       health probe

const REPO_OWNER = "nicolasmertens";
const REPO_NAME = "liedjes";
const ALLOWED_ORIGIN = "https://nicolasmertens.github.io";
const MAX_EVENTS_PER_BATCH = 5000;
const MAX_BODY_BYTES = 1_000_000; // 1 MB

function corsHeaders(originAllowed) {
  return {
    "Access-Control-Allow-Origin": originAllowed ? ALLOWED_ORIGIN : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonResp(obj, status, originAllowed) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders(originAllowed), "Content-Type": "application/json" },
  });
}

function toBase64Utf8(s) {
  const bytes = new TextEncoder().encode(s);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function pad(n) { return n < 10 ? "0" + n : "" + n; }

function pathForBatch(rand) {
  const now = new Date();
  const date = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
  const time = `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  return `logs/${date}/${time}-${rand}.jsonl`;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin") || "";
    const originAllowed = origin === ALLOWED_ORIGIN;

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(originAllowed) });
    }

    if (req.method === "GET" && url.pathname === "/") {
      return jsonResp({ ok: true, service: "liedjes-logger" }, 200, originAllowed);
    }

    if (req.method !== "POST" || url.pathname !== "/log") {
      return jsonResp({ error: "not found" }, 404, originAllowed);
    }

    // Origin gate — filters drive-by bots without browsers
    if (!originAllowed) {
      return jsonResp({ error: "origin not allowed" }, 403, originAllowed);
    }

    // Body-size guard before parsing
    const cl = parseInt(req.headers.get("Content-Length") || "0", 10);
    if (cl > MAX_BODY_BYTES) {
      return jsonResp({ error: "payload too large" }, 413, originAllowed);
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResp({ error: "bad json" }, 400, originAllowed);
    }

    const events = body?.events;
    if (!Array.isArray(events) || events.length === 0) {
      return jsonResp({ error: "no events" }, 400, originAllowed);
    }
    if (events.length > MAX_EVENTS_PER_BATCH) {
      return jsonResp({ error: "too many events" }, 413, originAllowed);
    }

    const ip = req.headers.get("CF-Connecting-IP") || "";
    const country = req.headers.get("CF-IPCountry") || "";
    const ua = req.headers.get("User-Agent") || "";
    const ingestedAt = Date.now();

    // Wrap each event with ingestion metadata; one JSON object per line
    const lines = events.map((e) =>
      JSON.stringify({
        ...e,
        _ingested_at: ingestedAt,
        _session_id: body.session_id || null,
        _device_id: body.device_id || null,
        _app_version: body.app_version || null,
        _ua: ua,
        _ip: ip,
        _country: country,
      })
    );
    const content = lines.join("\n") + "\n";

    const rand = crypto.randomUUID().slice(0, 8);
    const path = pathForBatch(rand);
    const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;

    const ghResp = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${env.GH_TOKEN}`,
        "User-Agent": "liedjes-logger",
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `log: ${events.length} events (${body.session_id || "no-sid"})`,
        content: toBase64Utf8(content),
        branch: "logs",
      }),
    });

    if (!ghResp.ok) {
      const text = await ghResp.text();
      return jsonResp({ error: "github failed", status: ghResp.status, detail: text.slice(0, 300) }, 502, originAllowed);
    }

    return jsonResp({ ok: true, path, count: events.length }, 200, originAllowed);
  },
};
