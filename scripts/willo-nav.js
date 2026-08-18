/** Hide off langs on game chrome. Browser + Node (evals). */
(function (root) {
  const S = root.WilloSettings;

  function langFromBtn(btn) {
    const href = (btn && (btn.getAttribute("data-href") || btn.dataset && btn.dataset.href)) || "";
    const m = String(href).match(/\/willo\/(mama|papa|klas)\//);
    if (m) return m[1];
    const a = String((btn && btn.getAttribute("aria-label")) || "").toLowerCase();
    if (S && S.LANGS && S.LANGS.indexOf(a) !== -1) return a;
    return "";
  }

  function applyBar(bar, state) {
    if (!bar || !S) return { shown: 0 };
    const vis = S.navVisibility(state || S.load());
    let shown = 0;
    const tiles = bar.querySelectorAll ? bar.querySelectorAll(".navtile") : [];
    Array.prototype.forEach.call(tiles, (btn) => {
      const lang = langFromBtn(btn);
      const on = !!(lang && vis[lang]);
      if (btn.style) btn.style.display = on ? "" : "none";
      if (on) shown += 1;
    });
    const stop = bar.querySelector && bar.querySelector(".stopbtn") ? 1 : 0;
    if (bar.style && shown + stop > 0) {
      bar.style.gridTemplateColumns = "repeat(" + (shown + stop) + ", 1fr)";
    }
    return { shown: shown, stop: stop };
  }

  function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open("willo-photos", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("faces");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  async function applyFaces(bar) {
    if (!bar || typeof indexedDB === "undefined") return;
    try {
      const db = await idb();
      const langs = (S && S.LANGS) || ["mama", "papa", "klas"];
      for (let i = 0; i < langs.length; i++) {
        const lang = langs[i];
        const data = await new Promise((res, rej) => {
          const q = db.transaction("faces").objectStore("faces").get(lang);
          q.onsuccess = () => res(q.result || "");
          q.onerror = () => rej(q.error);
        });
        if (!data) continue;
        const tiles = bar.querySelectorAll(".navtile");
        Array.prototype.forEach.call(tiles, (btn) => {
          if (langFromBtn(btn) !== lang) return;
          const img = btn.querySelector("img");
          if (img) img.src = data;
        });
      }
    } catch (e) {}
  }

  function apply() {
    const bar = typeof document !== "undefined" ? document.querySelector(".bottombar") : null;
    if (!bar) return;
    applyBar(bar);
    applyFaces(bar);
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
    else apply();
  }

  const api = { langFromBtn, applyBar, apply };
  root.WilloNav = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
