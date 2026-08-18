/** Kid springboard icon store. Pure helpers + fetch handler. */

export const KID_TTL_SEC = 24 * 60 * 60;
export const KID_MAX_BYTES = 400000;
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function parseKidId(pathname) {
  const m = String(pathname || "").match(/^\/kid\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\.png)?$/i);
  return m ? m[1].toLowerCase() : "";
}

export function isPng(bytes) {
  if (!bytes || bytes.length < 8) return false;
  for (let i = 0; i < 8; i++) if (bytes[i] !== PNG[i]) return false;
  return true;
}

export function kidRoute(method, pathname) {
  const m = String(method || "").toUpperCase();
  if (m === "POST" && pathname === "/kid") return { op: "put" };
  const id = parseKidId(pathname);
  if (!id) return { op: "" };
  if (m === "GET") return { op: "get", id };
  if (m === "DELETE") return { op: "del", id };
  return { op: "" };
}

export function kidCors(originAllowed) {
  return {
    "Access-Control-Allow-Origin": originAllowed ? "https://nicolasmertens.github.io" : "null",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export async function handleKid(req, env, originAllowed) {
  const url = new URL(req.url);
  const route = kidRoute(req.method, url.pathname);
  const cors = kidCors(originAllowed);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (route.op === "get") {
    if (!env.KID) return new Response("no store", { status: 500 });
    const buf = await env.KID.get(route.id, { type: "arrayBuffer" });
    if (!buf) return new Response("gone", { status: 404 });
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  if (!originAllowed) {
    return new Response(JSON.stringify({ error: "origin" }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (route.op === "del") {
    if (env.KID) await env.KID.delete(route.id);
    return new Response(null, { status: 204, headers: cors });
  }

  if (route.op === "put") {
    const cl = parseInt(req.headers.get("Content-Length") || "0", 10);
    if (cl > KID_MAX_BYTES) {
      return new Response(JSON.stringify({ error: "too-large" }), {
        status: 413,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const buf = new Uint8Array(await req.arrayBuffer());
    if (buf.byteLength > KID_MAX_BYTES || !isPng(buf)) {
      return new Response(JSON.stringify({ error: "bad-png" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (!env.KID) {
      return new Response(JSON.stringify({ error: "no store" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const id = crypto.randomUUID();
    await env.KID.put(id, buf, { expirationTtl: KID_TTL_SEC });
    const publicUrl = new URL("/kid/" + id + ".png", url.origin).href;
    return new Response(JSON.stringify({ id, url: publicUrl }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "not found" }), {
    status: 404,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
