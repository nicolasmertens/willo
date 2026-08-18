// One Willo worker for /willo/. Does not wipe per-taal caches.
const CORE_CACHE = "willo-core-v12";
const MP3_CACHE = "willo-mp3-v1";
const KID_CACHE = "willo-kid-icon-v1";

const CORE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./willo-mark.png",
  "./icon-192.png",
  "./icon-512.png",
  "./favicon-32.png",
  "./home/mama.jpg",
  "./home/papa.jpg",
  "./home/klas.jpg",
  "./scripts/willo-hold.js",
  "./scripts/willo-settings.js",
  "./scripts/willo-settings-ui.js",
  "./scripts/willo-nav.js",
  "./mama/",
  "./papa/",
  "./klas/",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CORE_CACHE).then((c) => c.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("willo-core-") && k !== CORE_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

function kidUrl(file) {
  return new URL("./" + file, self.location.href).href;
}

async function kidMeta() {
  try {
    const c = await caches.open(KID_CACHE);
    const r = await c.match(kidUrl("kid-meta.json"));
    if (!r) return { name: "" };
    return await r.json();
  } catch (err) {
    return { name: "" };
  }
}

async function kidPng(size) {
  const c = await caches.open(KID_CACHE);
  const file = size >= 512 ? "kid-icon-512.png" : "kid-icon-180.png";
  return (await c.match(kidUrl(file))) || null;
}

async function personalizedManifest() {
  const meta = await kidMeta();
  const name = (meta && meta.name) || "Willo";
  const spec = {
    name,
    short_name: name,
    id: "/willo/",
    start_url: "./",
    scope: "./",
    display: "standalone",
    background_color: "#fff7e6",
    theme_color: "#fff7e6",
    icons: [
      { src: "icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "willo-mark.png", sizes: "180x180", type: "image/png" },
    ],
  };
  return new Response(JSON.stringify(spec), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/manifest.json") || url.pathname.endsWith("manifest.json")) {
    e.respondWith(personalizedManifest());
    return;
  }
  if (/\/(apple-touch-icon|icon-192|icon-512)\.png$/.test(url.pathname)) {
    const size = /512/.test(url.pathname) ? 512 : 180;
    e.respondWith(
      kidPng(size).then((r) => r || caches.match(e.request).then((c) => c || fetch(e.request)))
    );
    return;
  }
  if (/kid-icon-\d+\.png$/.test(url.pathname)) {
    const bare = url.origin + url.pathname;
    e.respondWith(
      caches.open(KID_CACHE).then((c) =>
        c.match(bare).then((r) => r || caches.match("./willo-mark.png"))
      )
    );
    return;
  }

  const isHTML = e.request.mode === "navigate"
    || e.request.destination === "document"
    || url.pathname.endsWith("/")
    || url.pathname.endsWith(".html");

  if (isHTML) {
    e.respondWith(
      fetch(e.request).then((resp) => {
        const copy = resp.clone();
        caches.open(CORE_CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return resp;
      }).catch(() => caches.match(e.request).then((r) => r || caches.match("./")))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchAndCache = fetch(e.request).then((resp) => {
        if (resp && resp.status === 200) {
          const copy = resp.clone();
          caches.open(CORE_CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => cached);
      return cached || fetchAndCache;
    })
  );
});

let prefetching = false;
self.addEventListener("message", async (e) => {
  const msg = e.data;
  if (msg && msg.type === "willo-kid") {
    const name = String(msg.name || "").trim().slice(0, 12);
    const cache = await caches.open(KID_CACHE);
    await cache.put(
      kidUrl("kid-meta.json"),
      new Response(JSON.stringify({ name }), { headers: { "Content-Type": "application/json" } })
    );
    return;
  }
  if (!msg || msg.type !== "prefetch-mp3s" || !Array.isArray(msg.urls)) return;
  if (prefetching) return;
  prefetching = true;
  const cache = await caches.open(MP3_CACHE);
  const total = msg.urls.length;
  let done = 0, cached = 0;
  const post = (payload) => { if (e.source) e.source.postMessage(payload); };
  const CONCURRENCY = 4;
  let cursor = 0;
  async function worker() {
    while (cursor < total) {
      const idx = cursor++;
      const u = msg.urls[idx];
      try {
        const req = new Request(u, { mode: "no-cors", credentials: "omit" });
        const existing = await cache.match(req, { ignoreVary: true });
        if (!existing) { const resp = await fetch(req); await cache.put(req, resp); }
        cached++;
      } catch {}
      done++;
      post({ type: "prefetch-progress", done, total });
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker()));
  prefetching = false;
  post({ type: "prefetch-done", cached, total });
});
