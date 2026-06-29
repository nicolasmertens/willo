/* Shared telemetry for the klas kids mini-apps.
   Same endpoint + device id as the main app so events correlate per device.
   Each page sets window.TEL_APP (e.g. "klas-soundboard-v1") BEFORE loading this. */
(function () {
  var APP = window.TEL_APP || "klas-game";
  var TEL_URL = "https://liedjes-logger.super-mud-e2ef.workers.dev/log";
  var DEVICE_KEY = "klas_device_id_v1";          // shared with the klas app
  var BUFFER_KEY = "klasgames_tel_buffer_v1";
  var FLUSH_MS = 30000, MAX_BUFFER = 2000;
  function uuid() { return (crypto.randomUUID && crypto.randomUUID()) || (Date.now() + "-" + Math.random()); }
  var SESSION_ID = uuid().slice(0, 36);
  var DEVICE_ID = "";
  try { DEVICE_ID = localStorage.getItem(DEVICE_KEY) || ""; if (!DEVICE_ID) { DEVICE_ID = uuid(); localStorage.setItem(DEVICE_KEY, DEVICE_ID); } } catch (e) {}
  var buf = [];
  try { buf = JSON.parse(localStorage.getItem(BUFFER_KEY) || "[]"); } catch (e) {}
  function save() { try { localStorage.setItem(BUFFER_KEY, JSON.stringify(buf)); } catch (e) {} }
  function tel(type, payload) {
    buf.push(Object.assign({ t: Date.now(), type: type }, payload || {}));
    if (buf.length > MAX_BUFFER) buf.splice(0, buf.length - MAX_BUFFER);
    save();
  }
  var flushing = false;
  async function flush(keepalive) {
    if (flushing || buf.length === 0) return;
    flushing = true;
    var n = buf.length, batch = buf.slice(0, n);
    try {
      var r = await fetch(TEL_URL, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: batch, session_id: SESSION_ID, device_id: DEVICE_ID, app_version: APP }), keepalive: !!keepalive });
      if (r && r.ok) { buf.splice(0, n); save(); }
    } catch (e) {}
    flushing = false;
  }
  setInterval(function () { flush(false); }, FLUSH_MS);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") flush(true); });
  window.addEventListener("pagehide", function () { flush(true); });
  window.tel = tel;
  window.telFlush = flush;
  tel("session_start", { ua: navigator.userAgent, vw: window.innerWidth, vh: window.innerHeight,
    dpr: window.devicePixelRatio || 1, standalone: !!(navigator.standalone || matchMedia("(display-mode: standalone)").matches) });
})();
