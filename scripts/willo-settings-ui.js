/** Parent sheet for Willo. Requires WilloSettings. */
(function (root) {
  const S = root.WilloSettings;
  if (!S) return;
  const DB = "willo-photos";
  const STORE = "faces";

  function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function photoGet(lang) {
    try {
      const db = await idb();
      return await new Promise((res, rej) => {
        const q = db.transaction(STORE).objectStore(STORE).get(lang);
        q.onsuccess = () => res(q.result || "");
        q.onerror = () => rej(q.error);
      });
    } catch (e) { return ""; }
  }
  async function photoSet(lang, dataUrl) {
    const db = await idb();
    return new Promise((res, rej) => {
      const q = db.transaction(STORE, "readwrite").objectStore(STORE).put(dataUrl, lang);
      q.onsuccess = () => res();
      q.onerror = () => rej(q.error);
    });
  }
  async function allPhotos() {
    const out = {};
    for (const l of S.LANGS) out[l] = await photoGet(l);
    return out;
  }

  const LANG_LABEL = { mama: "Mama", papa: "Papa", klas: "Klas" };
  const KID_API = "https://liedjes-logger.super-mud-e2ef.workers.dev";
  const KID_ID_KEY = "willo_kid_icon_id";
  let sessionOk = false;
  let pendingAfterPin = "";
  let continuedThisLoad = false;

  async function applyFaceImages() {
    for (const l of S.LANGS) {
      const data = await photoGet(l);
      document.querySelectorAll(`img[data-face="${l}"], img[src*="home/${l}.jpg"]`).forEach((img) => {
        if (data) {
          img.src = data;
          img.classList.remove("missing");
        } else {
          img.removeAttribute("src");
          img.classList.add("missing");
        }
      });
    }
  }

  function css() {
    return `
    .willo-mask{position:fixed;inset:0;z-index:400;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;}
    .willo-sheet{background:#fff7e6;width:100%;max-width:560px;max-height:92dvh;overflow:auto;border-radius:22px 22px 0 0;padding:18px 16px 28px;font-family:inherit;color:#2b2b2b;}
    .willo-sheet h3{margin:16px 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:rgba(0,0,0,.45);}
    .willo-sheet h2{margin:0 0 8px;font-size:22px;}
    .willo-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid rgba(0,0,0,.06);}
    .willo-row label{font-weight:700;}
    .willo-row small{display:block;font-weight:500;color:rgba(0,0,0,.45);}
    .willo-sheet input[type=date]{font:inherit;padding:8px;border-radius:10px;border:1px solid #ddd;}
    .willo-pins{display:flex;gap:8px;justify-content:center;margin:12px 0;}
    .willo-mask,.willo-sheet,.willo-sheet button{touch-action:manipulation;}
    .willo-pins button{width:64px;height:52px;border-radius:12px;border:0;background:#fff;font-weight:800;font-size:18px;box-shadow:0 3px 0 rgba(0,0,0,.1);touch-action:manipulation;}
    .willo-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;}
    .willo-actions button,.willo-sheet .willo-go{border:0;border-radius:14px;padding:12px 14px;font-weight:800;background:#fff;box-shadow:0 3px 0 rgba(0,0,0,.1);}
    .willo-err{color:#c0392b;font-weight:700;min-height:1.2em;text-align:center;}
    .willo-hint{font-size:14px;color:rgba(0,0,0,.5);margin:8px 0;}
    .willo-face-lab{display:flex;align-items:center;min-height:44px;}
    .willo-face-dot{width:44px;height:44px;border-radius:14px;object-fit:cover;background:#ffe0b2;}
    .willo-face-dot.missing{opacity:.7;}
    .willo-drill{width:100%;text-align:left;border:0;background:#fff;border-radius:14px;padding:14px;font-weight:800;box-shadow:0 3px 0 rgba(0,0,0,.1);margin:6px 0;display:flex;justify-content:space-between;align-items:center;}
    .willo-back{border:0;background:transparent;font-weight:800;padding:8px 0;color:#5a4632;}
    `;
  }

  function toggle(on) {
    return `<input type="checkbox" ${on ? "checked" : ""}>`;
  }

  let pinBuf = "";
  let mode = "gate";
  let sheetView = "root";
  let sheetSec = "";
  const SEC_LABEL = { boeken: "Boeken", games: "Spelen", liedjes: "Liedjes", verhalen: "Verhalen" };

  function close() {
    const el = document.getElementById("willo-mask");
    if (el) el.remove();
    pinBuf = "";
    mode = "gate";
    sessionOk = false;
    pendingAfterPin = "";
  }

  function renderGate() {
    const st = S.load();
    const first = !st.pinHash;
    return `
      <h2>${first ? "Kies een PIN" : "PIN"}</h2>
      <p class="willo-hint">${first ? "Vier cijfers. Alleen voor ouders." : "Twee seconden indrukken opent dit."}</p>
      <div class="willo-err" id="willo-err"></div>
      <div class="willo-pins" id="willo-dots"><b>${"• ".repeat(pinBuf.length)}${"○ ".repeat(4 - pinBuf.length)}</b></div>
      <div class="willo-pins" style="flex-wrap:wrap;max-width:240px;margin:0 auto;">
        ${[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((n) =>
          n === "" ? "<span style='width:64px'></span>" :
          `<button type="button" data-k="${n}">${n}</button>`
        ).join("")}
      </div>
      <div class="willo-actions"><button type="button" data-close>Sluiten</button></div>
    `;
  }

  function catalog() {
    return root.WILLO_CATALOG || [];
  }

  function renderSheet() {
    if (sheetView === "section") return renderSection(sheetSec);
    if (sheetView === "faces") return renderFaces();
    return renderRoot();
  }

  function renderRoot() {
    const st = S.load();
    const months = S.ageMonths(st.birth);
    const stage = S.stageFor(months);
    const standalone = !!(navigator.standalone || matchMedia("(display-mode: standalone)").matches);
    return `
      <h2>Willo</h2>
      <p class="willo-hint">${standalone ? "Op het beginscherm." : "Zet op beginscherm via Delen in Safari."}</p>
      <h3>Kind</h3>
      <div class="willo-row"><label>Geboorte</label><input type="date" id="willo-birth" value="${st.birth || ""}"></div>
      <div class="willo-hint">${months == null ? "Nog geen leeftijd." : months + " maanden · emmer " + (stage ? stage.id : "?")}</div>
      <h3>Wat speelt hij?</h3>
      ${S.SECTIONS.map((sec) => `<button type="button" class="willo-drill" data-drill="${sec}"><span>${SEC_LABEL[sec] || sec}</span><span>›</span></button>`).join("")}
      <button type="button" class="willo-drill" data-drill-faces><span>Wie is erbij?</span><span>›</span></button>
      <div class="willo-actions">
        <button type="button" data-export>Exporteer</button>
        <button type="button" data-import>Importeer</button>
        <button type="button" data-refresh>Vernieuw app</button>
        <input type="file" accept="application/json,.json" id="willo-import" hidden>
        <button type="button" data-close>Klaar</button>
      </div>
      <p class="willo-hint">v17</p>
    `;
  }

  function renderFaces() {
    const st = S.load();
    return `
      <button type="button" class="willo-back" data-back>‹ Terug</button>
      <h2>Wie is erbij?</h2>
      <p class="willo-hint">Foto erbij, dan aan.</p>
      ${S.LANGS.map((l) => `<div class="willo-row"><label class="willo-face-lab"><img data-face="${l}" alt="" class="willo-face-dot missing"><input type="file" accept="image/*" data-photo="${l}"></label>${toggle(S.isLangOn(st, l)).replace(">", ` data-lang="${l}">`)}</div>`).join("")}
    `;
  }

  function renderSection(sec) {
    const st = S.load();
    const groups = S.groupItems(sec, catalog());
    const anyPack = S.LANGS.some((l) => S.isLangOn(st, l));
    const rows = groups.map((g) => {
      const inner = g.items.map((t) => {
        const track = { n: t.n, _section: t.section, fromMonth: t.fromMonth };
        const on = S.isItemOn(st, track, t.pack);
        const age = t.fromMonth ? "vanaf " + t.fromMonth + " m" : "";
        return `<div class="willo-row"><label class="willo-face-lab"><img data-face="${t.pack}" alt="" class="willo-face-dot missing"><span>${t.title}${age ? "<small>" + age + "</small>" : ""}</span></label>${toggle(on).replace(">", ` data-item="${t.pack}:${t.section}:${t.n}">`)}</div>`;
      }).join("");
      if (g.items.length === 1) return inner;
      return `<h3>${g.title}</h3>` + inner;
    }).join("");
    return `
      <button type="button" class="willo-back" data-back>‹ Terug</button>
      <h2>${SEC_LABEL[sec] || sec}</h2>
      <div class="willo-row"><label>Alles in ${SEC_LABEL[sec] || sec}</label>${toggle(S.isSectionOn(st, sec)).replace(">", ` data-sec="${sec}">`)}</div>
      ${anyPack ? rows : `<p class="willo-hint">Zet eerst iemand aan.</p><button type="button" class="willo-drill" data-drill-faces>Wie is erbij? ›</button>`}
    `;
  }

  function mount(html) {
    let mask = document.getElementById("willo-mask");
    if (!mask) {
      if (!document.getElementById("willo-css")) {
        const s = document.createElement("style");
        s.id = "willo-css";
        s.textContent = css();
        document.head.appendChild(s);
      }
      mask = document.createElement("div");
      mask.id = "willo-mask";
      mask.className = "willo-mask";
      document.body.appendChild(mask);
    }
    mask.innerHTML = `<div class="willo-sheet">${html}</div>`;
    bind(mask);
    applyFaceImages();
  }

  function bindTap(el, fn) {
    let armed = null;
    let usedPointer = false;
    el.addEventListener("pointerdown", (e) => {
      if (e.isPrimary === false) return;
      armed = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now() };
    });
    el.addEventListener("pointerup", (e) => {
      if (!armed || armed.id !== e.pointerId) return;
      const dx = e.clientX - armed.x;
      const dy = e.clientY - armed.y;
      const dt = Date.now() - armed.t;
      armed = null;
      if (Math.hypot(dx, dy) > 28 || dt > 1500) return;
      usedPointer = true;
      e.preventDefault();
      fn();
    });
    el.addEventListener("pointercancel", () => { armed = null; });
    el.addEventListener("click", (e) => {
      if (usedPointer) {
        e.preventDefault();
        return;
      }
      fn();
    });
  }

  function bind(mask) {
    if (!mask.dataset.bound) {
      mask.dataset.bound = "1";
      mask.addEventListener("click", (e) => { if (e.target === mask) close(); });
    }
    mask.querySelectorAll("[data-close]").forEach((b) => bindTap(b, close));
    mask.querySelectorAll("[data-k]").forEach((b) => bindTap(b, () => digit(b.getAttribute("data-k"))));
    mask.querySelectorAll("[data-drill]").forEach((b) => bindTap(b, () => {
      sheetView = "section";
      sheetSec = b.getAttribute("data-drill");
      mount(renderSheet());
    }));
    mask.querySelectorAll("[data-drill-faces]").forEach((b) => bindTap(b, () => {
      sheetView = "faces";
      mount(renderSheet());
    }));
    mask.querySelectorAll("[data-back]").forEach((b) => bindTap(b, () => {
      sheetView = "root";
      mount(renderSheet());
    }));
    mask.querySelectorAll("[data-lang]").forEach((el) => el.addEventListener("change", () => {
      const r = S.setLang(S.load(), el.getAttribute("data-lang"), el.checked);
      if (!r.ok) { el.checked = !el.checked; return; }
      S.save(r.state); applyLangs(); mount(renderSheet());
    }));
    mask.querySelectorAll("[data-add-lang]").forEach((b) => bindTap(b, () => {
      const lang = b.getAttribute("data-add-lang");
      const r = S.setLang(S.load(), lang, true);
      if (r.ok) S.save(r.state);
      close();
      applyLangs();
    }));
    mask.querySelectorAll("[data-sec]").forEach((el) => el.addEventListener("change", () => {
      const r = S.setSection(S.load(), el.getAttribute("data-sec"), el.checked);
      S.save(r.state); applyCatalog(); mount(renderSheet());
    }));
    mask.querySelectorAll("[data-item]").forEach((el) => el.addEventListener("change", () => {
      const [taal, sec, n] = el.getAttribute("data-item").split(":");
      const r = S.setItem(S.load(), taal, sec, Number(n), el.checked);
      S.save(r.state); applyCatalog(); mount(renderSheet());
    }));
    const birth = mask.querySelector("#willo-birth");
    if (birth) birth.addEventListener("change", () => {
      const r = S.setBirth(S.load(), birth.value);
      if (r.ok) { S.save(r.state); mount(renderSheet()); applyCatalog(); }
    });
    mask.querySelectorAll("[data-photo]").forEach((el) => el.addEventListener("change", async () => {
      const f = el.files && el.files[0];
      if (!f) return;
      const url = await fileToData(f);
      await photoSet(el.getAttribute("data-photo"), url);
      await applyFaceImages();
    }));
    const exp = mask.querySelector("[data-export]");
    if (exp) exp.addEventListener("click", doExport);
    const refresh = mask.querySelector("[data-refresh]");
    if (refresh) bindTap(refresh, () => {
      Promise.resolve()
        .then(() => window.caches ? caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))) : null)
        .then(() => navigator.serviceWorker && navigator.serviceWorker.getRegistrations
          ? navigator.serviceWorker.getRegistrations().then((rs) => Promise.all(rs.map((r) => r.unregister())))
          : null)
        .then(() => { location.reload(); })
        .catch(() => { location.reload(); });
    });
    const imp = mask.querySelector("[data-import]");
    const file = mask.querySelector("#willo-import");
    if (imp && file) {
      imp.addEventListener("click", () => file.click());
      file.addEventListener("change", () => { if (file.files[0]) doImport(file.files[0]); });
    }
  }

  function fileToData(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  async function doExport() {
    const photos = await allPhotos();
    const payload = S.exportPayload(S.load(), photos);
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    const file = new File([blob], "willo-settings.json", { type: "application/json" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Willo" });
        return;
      }
    } catch (e) {}
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "willo-settings.json";
    a.click();
  }

  async function doImport(file) {
    const text = await file.text();
    const r = S.importPayload(text);
    if (!r.ok) return;
    S.save(r.state);
    for (const l of S.LANGS) {
      if (r.photos && r.photos[l]) await photoSet(l, r.photos[l]);
    }
    applyLangs();
    applyCatalog();
    await applyFaceImages();
    renderHome();
    mount(renderSheet());
  }

  function digit(k) {
    if (typeof tel === "function") tel("pin_tap", { k: String(k), n: pinBuf.length });
    if (k === "⌫") { pinBuf = pinBuf.slice(0, -1); mount(renderGate()); return; }
    if (!/^\d$/.test(k) || pinBuf.length >= 4) return;
    pinBuf += k;
    mount(renderGate());
    if (pinBuf.length < 4) return;
    const st = S.load();
    if (!st.pinHash) {
      const r = S.setPin(st, pinBuf);
      if (r.ok) S.save(r.state);
      pinBuf = "";
      sessionOk = true;
      afterPin();
      return;
    }
    const chk = S.checkPin(st, pinBuf);
    pinBuf = "";
    if (!chk.ok) {
      mount(renderGate());
      const err = document.getElementById("willo-err");
      if (err) err.textContent = "Fout";
      return;
    }
    sessionOk = true;
    afterPin();
  }

  function afterPin() {
    if (pendingAfterPin === "add") {
      pendingAfterPin = "";
      mode = "add";
      mount(renderAddLang());
      return;
    }
    mode = "sheet";
    mount(renderSheet());
  }

  function renderAddLang() {
    const st = S.load();
    const off = S.LANGS.filter((l) => !S.isLangOn(st, l));
    if (!off.length) {
      return `<h2>Inhoud</h2><p class="willo-hint">Alles staat al aan.</p><div class="willo-actions"><button type="button" data-close>Klaar</button></div>`;
    }
    return `
      <h2>Toevoegen</h2>
      <p class="willo-hint">Zet aan. Foto kan later.</p>
      <div class="willo-actions" style="flex-direction:column">
        ${off.map((l) => `<button type="button" class="willo-go" data-add-lang="${l}">${LANG_LABEL[l] || l}</button>`).join("")}
      </div>
      <div class="willo-actions"><button type="button" data-close>Sluiten</button></div>
    `;
  }

  function isStandalone() {
    return !!(navigator.standalone || matchMedia("(display-mode: standalone)").matches);
  }
  function iosProbe() {
    return {
      ua: navigator.userAgent || "",
      platform: navigator.platform || "",
      maxTouchPoints: navigator.maxTouchPoints || 0,
      coarse: !!(window.matchMedia && matchMedia("(pointer: coarse)").matches),
    };
  }
  function surfaceNow() {
    const st = S.load();
    const n = S.LANGS.filter((l) => S.isLangOn(st, l)).length;
    let showInstall = continuedThisLoad;
    try {
      if (S.wantsA2hs(location.search)) showInstall = true;
    } catch (e) {}
    return S.homeSurface(isStandalone(), n, Object.assign(iosProbe(), {
      hasChild: S.hasChild(st),
      showInstall: showInstall,
    }));
  }

  const SVG_SHARE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.2 8.5H7A2.5 2.5 0 0 0 4.5 11v8A2.5 2.5 0 0 0 7 21.5h10a2.5 2.5 0 0 0 2.5-2.5v-8A2.5 2.5 0 0 0 17 8.5h-1.2"/><path d="M12 15.5V3.5"/><path d="M8 7l4-4 4 4"/></svg>';
  const SVG_DOTS = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="6" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18" cy="12" r="1.8"/></svg>';
  const SVG_ADD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';

  function paintChild() {
    const el = document.getElementById("child-card");
    if (!el) return;
    const copy = S.childCopy(navigator.language || document.documentElement.lang || "nl");
    const st = S.load();
    el.innerHTML = `
      <p class="stage-kicker">Willo</p>
      <h1>${copy.title}</h1>
      <label class="stage-field" for="child-name"><span>${copy.name}</span>
        <input id="child-name" type="text" enterkeyhint="done" autocomplete="nickname" maxlength="24" value="${st.childName || ""}" placeholder=" ">
      </label>
      <label class="stage-field" for="child-birth"><span>${copy.birth}</span>
        <input id="child-birth" type="date">
      </label>
      <label class="stage-sleeve">
        <input id="child-photo" type="file" accept="image/*">
        <img id="child-photo-preview" alt="" hidden>
        <span class="stage-sleeve-hint">${copy.pick}</span>
      </label>
      <p class="willo-err" id="child-err"></p>
      <button type="button" id="child-go">${copy.go}</button>
    `;
    const birth = el.querySelector("#child-birth");
    if (birth && st.birth) birth.value = st.birth;
    const file = el.querySelector("#child-photo");
    const prev = el.querySelector("#child-photo-preview");
    if (file && prev) file.addEventListener("change", () => {
      const f = file.files && file.files[0];
      if (!f) return;
      prev.src = URL.createObjectURL(f);
      prev.hidden = false;
    });
    const go = el.querySelector("#child-go");
    if (go) go.addEventListener("click", submitChild);
    photoGet("child").then((data) => {
      if (!data || !prev) return;
      if (file && file.files && file.files[0]) return;
      prev.src = data;
      prev.hidden = false;
    });
    document.body.classList.add("onboard");
  }

  function squareBlob(src, size) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const ctx = c.getContext("2d");
        const s = Math.min(img.width, img.height);
        const sx = (img.width - s) / 2;
        const sy = (img.height - s) / 2;
        ctx.fillStyle = "#fff7e6";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
        c.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/png");
      };
      img.onerror = () => rej(new Error("img"));
      img.src = src;
    });
  }

  async function cacheKidIcon(blob, file) {
    const cache = await caches.open("willo-kid-icon-v1");
    const abs = new URL(file, location.href);
    abs.search = "";
    const resp = new Response(blob, { headers: { "Content-Type": "image/png", "Cache-Control": "no-cache" } });
    await cache.put(abs.href, resp);
    return abs.href;
  }

  function tellWorkerKid(name) {
    try {
      if (!navigator.serviceWorker) return;
      const send = (w) => { if (w) w.postMessage({ type: "willo-kid", name: name || "" }); };
      if (navigator.serviceWorker.controller) send(navigator.serviceWorker.controller);
      navigator.serviceWorker.ready.then((reg) => send(reg.active)).catch(() => {});
    } catch (e) {}
  }

  function blobToData(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }

  function dropStockIcons(paths) {
    document.querySelectorAll("link[rel='apple-touch-icon'], link[rel='icon'], link[rel='manifest']").forEach((el) => {
      if (el.rel === "manifest") {
        el.remove();
        return;
      }
      const href = String(el.getAttribute("href") || "");
      if (paths.some((p) => href.indexOf(p) !== -1)) el.remove();
    });
  }

  function ensureTouchIcon(id) {
    let el = document.getElementById(id);
    if (el) return el;
    el = document.createElement("link");
    el.id = id;
    el.rel = "apple-touch-icon";
    el.setAttribute("sizes", "180x180");
    document.head.appendChild(el);
    return el;
  }

  function setTouchHref(href) {
    if (!href || String(href).indexOf("data:") === 0) return;
    const icon = ensureTouchIcon("willo-touch-icon");
    icon.rel = "apple-touch-icon";
    icon.setAttribute("sizes", "180x180");
    icon.href = href;
    let pre = document.getElementById("willo-touch-icon-pre");
    if (!pre) {
      pre = document.createElement("link");
      pre.id = "willo-touch-icon-pre";
      pre.rel = "apple-touch-icon-precomposed";
      pre.setAttribute("sizes", "180x180");
      document.head.appendChild(pre);
    }
    pre.href = href;
    let fav = document.querySelector("link[rel='icon']");
    if (!fav) {
      fav = document.createElement("link");
      fav.rel = "icon";
      fav.type = "image/png";
      document.head.appendChild(fav);
    }
    fav.href = href;
  }

  function kidPublicUrl(id) {
    return KID_API + "/kid/" + id + ".png";
  }

  async function probeKid(id) {
    if (!id) return false;
    try {
      const resp = await withTimeout(fetch(kidPublicUrl(id), { method: "GET", cache: "no-store" }), 4000);
      if (!resp.ok) return false;
      const t = String(resp.headers.get("content-type") || "");
      return t.indexOf("png") !== -1;
    } catch (e) {
      return false;
    }
  }

  function saveKidId(id) {
    try { localStorage.setItem(KID_ID_KEY, id || ""); } catch (e) {}
  }

  function loadKidId() {
    try { return localStorage.getItem(KID_ID_KEY) || ""; } catch (e) { return ""; }
  }

  function withTimeout(p, ms) {
    return Promise.race([
      p,
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
    ]);
  }

  async function uploadKidIcon(blob) {
    const resp = await withTimeout(fetch(KID_API + "/kid", {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: blob,
    }), 4000);
    if (!resp.ok) throw new Error("kid-up");
    const data = await resp.json();
    if (!data || !data.url || !data.id) throw new Error("kid-up");
    saveKidId(data.id);
    return data;
  }

  function stampChildUrl(state, extra) {
    try {
      const u = new URL(location.href);
      u.searchParams.set("n", S.springboardName(state.childName));
      u.searchParams.set("b", state.birth);
      u.searchParams.set("f", "1");
      if (extra && extra.k) u.searchParams.set("k", extra.k);
      if (extra && extra.a2hs) u.searchParams.set("a2hs", "1");
      const next = u.pathname + "?" + u.searchParams.toString();
      history.replaceState({}, "", next);
      return next;
    } catch (e) {
      return "";
    }
  }

  async function forgetKidIcon() {
    const id = loadKidId();
    if (!id) return;
    try {
      await fetch(KID_API + "/kid/" + id, { method: "DELETE" });
    } catch (e) {}
    saveKidId("");
  }

  async function applySpringboard(name, dataUrl, opts) {
    const tags = S.springboardTags(name);
    let title = document.querySelector("meta[name='apple-mobile-web-app-title']");
    if (!title) {
      title = document.createElement("meta");
      title.setAttribute("name", "apple-mobile-web-app-title");
      document.head.appendChild(title);
    }
    title.setAttribute("content", tags.title);
    document.title = tags.title;
    if (tags.detachManifest) dropStockIcons(tags.stockIconPaths);
    tellWorkerKid(tags.title);
    const allowUpload = !(opts && opts.allowUpload === false);
    let id = loadKidId() || S.kidIdFromSearch(location.search);
    if (id && await probeKid(id)) {
      setTouchHref(kidPublicUrl(id));
      saveKidId(id);
      return id;
    }
    if (!allowUpload || !dataUrl) return "";
    const b180 = await squareBlob(dataUrl, 180);
    try { await cacheKidIcon(b180, "kid-icon-180.png"); } catch (e) {}
    const extra = document.getElementById("willo-touch-icon-file");
    if (extra) extra.remove();
    const up = await uploadKidIcon(b180);
    if (!up || !up.id || !(await probeKid(up.id))) throw new Error("kid-get");
    setTouchHref(kidPublicUrl(up.id));
    tellWorkerKid(tags.title);
    return up.id;
  }

  async function submitChild() {
    const nameEl = document.getElementById("child-name");
    const birthEl = document.getElementById("child-birth");
    const photoEl = document.getElementById("child-photo");
    const err = document.getElementById("child-err");
    const file = photoEl && photoEl.files && photoEl.files[0];
    const r = S.setChild(S.load(), nameEl ? nameEl.value : "", birthEl ? birthEl.value : "");
    if (!r.ok) {
      if (err) err.textContent = "!";
      return;
    }
    const existing = await photoGet("child");
    if (!file && !existing && !r.state.childFace) {
      if (err) err.textContent = "!";
      return;
    }
    const go = document.getElementById("child-go");
    if (go) go.disabled = true;
    r.state.childFace = true;
    S.save(r.state);
    stampChildUrl(r.state);
    let kidId = "";
    try {
      let dataUrl = "";
      if (file) {
        dataUrl = await withTimeout(fileToData(file), 8000);
        try { await withTimeout(photoSet("child", dataUrl), 2500); } catch (e) {}
      } else {
        dataUrl = existing;
      }
      if (!dataUrl) throw new Error("photo");
      kidId = await withTimeout(applySpringboard(r.state.childName, dataUrl, { allowUpload: true }), 12000);
    } catch (e) {
      if (err) err.textContent = "!";
      if (go) go.disabled = false;
      return;
    }
    if (!kidId) {
      if (err) err.textContent = "!";
      if (go) go.disabled = false;
      return;
    }
    continuedThisLoad = true;
    try {
      const u = new URL(location.href);
      u.searchParams.set("n", S.springboardName(r.state.childName));
      u.searchParams.set("b", r.state.birth);
      u.searchParams.set("f", "1");
      u.searchParams.set("k", kidId);
      u.searchParams.set("a2hs", "1");
      const next = u.pathname + "?" + u.searchParams.toString();
      const same = S.wantsA2hs(location.search) && S.kidIdFromSearch(location.search) === kidId;
      if (same) {
        history.replaceState({}, "", next);
        if (go) go.disabled = false;
        renderHome();
        return;
      }
      location.replace(next);
    } catch (e) {
      if (go) go.disabled = false;
      renderHome();
    }
  }

  function installSessionFlags() {
    let left = false;
    let again = false;
    try {
      left = sessionStorage.getItem("willo_install_left") === "1";
      again = sessionStorage.getItem("willo_install_again") === "1";
    } catch (e) {}
    return { left: left, again: again };
  }

  function fillInstallFace() {
    photoGet("child").then((data) => {
      if (!data) return;
      document.querySelectorAll("#install-face, #install-open-face").forEach((img) => {
        img.src = data;
        img.hidden = false;
      });
    });
  }

  function installIconImg(step) {
    if (step.id === "open") {
      return `<img class="install-ico install-ico-face" id="install-open-face" alt="" hidden>`;
    }
    const file = step.icon ? "icons/safari/" + step.icon + ".png?v=27" : "";
    if (!file) return "";
    return `<img class="install-ico" alt="" src="${file}">`;
  }

  function paintInstall() {
    const el = document.getElementById("install-card");
    if (!el) return;
    const probe = Object.assign(iosProbe(), { width: window.innerWidth, height: window.innerHeight });
    const at = S.installShareAt(probe);
    const browser = S.installBrowser(probe.ua);
    const loc = navigator.language || document.documentElement.lang || "en";
    const copy = S.installCopy(loc);
    const flags = installSessionFlags();
    const coach = S.installCoachMode({
      standalone: isStandalone(),
      leftAndReturned: flags.left,
      forceSteps: flags.again,
    });
    const who = S.springboardName((S.load() || {}).childName) || "";
    el.dataset.at = at;
    el.dataset.browser = browser;
    el.dataset.coach = coach;
    document.documentElement.lang = String(loc).slice(0, 2);
    if (coach === "none") return;
    if (coach === "open") {
      el.innerHTML = `
        <img class="install-hero" id="install-face" alt="" hidden>
        <p class="install-who">${who}</p>
        <p class="install-open">${S.openIconLabel(loc, who)}</p>
        <button type="button" class="install-again" data-install-again>${copy.again}</button>
      `;
      const again = el.querySelector("[data-install-again]");
      if (again) {
        const showSteps = (e) => {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          try {
            sessionStorage.setItem("willo_install_again", "1");
            sessionStorage.removeItem("willo_install_left");
          } catch (err) {}
          paintInstall();
        };
        again.onclick = showSteps;
        again.ontouchend = showSteps;
        bindTap(again, () => showSteps());
      }
      fillInstallFace();
      return;
    }
    const steps = S.installSteps(probe, loc, who);
    const chrome = steps.filter((s) => s.id !== "open");
    const openStep = steps.filter((s) => s.id === "open")[0];
    const step1icon = browser === "safari" ? SVG_SHARE : SVG_DOTS;
    const aim = at === "none" ? "" : `<div class="install-aim">${step1icon}</div>`;
    const rows = chrome.map((s) =>
      `<div class="install-row" data-step="${s.id}">${installIconImg(s)}<span>${s.label}</span></div>`
    ).join("");
    const then = openStep
      ? `<p class="install-then">${copy.then}</p><div class="install-row" data-step="open">${installIconImg(openStep)}<span>${openStep.label}</span></div>`
      : "";
    el.innerHTML = `
      <img class="install-hero" id="install-face" alt="" hidden>
      <p class="install-who">${who}</p>
      <p class="install-through">${copy.through}</p>
      ${aim}
      ${rows}
      ${then}
    `;
    fillInstallFace();
  }

  function paintHold() {
    const el = document.getElementById("hold-card");
    if (!el) return;
    const loc = navigator.language || document.documentElement.lang || "nl";
    const copy = S.holdCopy(loc);
    el.innerHTML = `
      <p class="stage-kicker">${copy.kicker}</p>
      <p class="hold-hint">${copy.hint}</p>
    `;
    if (!window.WilloHold) return;
    if (el.dataset.willoHold !== "1") {
      el.dataset.willoHold = "1";
      WilloHold.attach(el, {
        onHold() { openUnlock(); },
        onTap() {},
      });
    }
    const body = document.body;
    if (body.dataset.willoHold !== "1") {
      body.dataset.willoHold = "1";
      WilloHold.attach(body, {
        shouldStart(e) {
          if (document.body.dataset.stage !== "hold") return false;
          const t = e && e.target;
          if (t && t.closest && t.closest("#hold-card")) return false;
          if (t && t.closest && t.closest(".willo-mask")) return false;
          return true;
        },
        onHold() { openUnlock(); },
        onTap() {},
      });
    }
  }

  function openAddLang() {
    if (surfaceNow() === "install") return;
    const st = S.load();
    const off = S.LANGS.filter((l) => !S.isLangOn(st, l));
    if (!off.length) return;
    if (st.pinHash && !sessionOk) {
      pendingAfterPin = "add";
      openUnlock();
      return;
    }
    mode = "add";
    mount(renderAddLang());
  }

  function paintHint(text) {
    const hint = document.getElementById("home-hint");
    if (!hint) return;
    if (!text) {
      hint.hidden = true;
      hint.textContent = "";
      return;
    }
    hint.hidden = false;
    hint.textContent = text;
  }

  function enableLang(lang) {
    const r = S.setLang(S.load(), lang, true);
    if (r.ok) S.save(r.state);
    renderHome();
  }

  function renderHome() {
    const grid = document.getElementById("home-grid");
    const install = document.getElementById("install-card");
    if (!grid) return;
    const surface = surfaceNow();
    const child = document.getElementById("child-card");
    const hold = document.getElementById("hold-card");
    if (child) child.hidden = surface !== "child";
    if (install) install.hidden = surface !== "install";
    if (hold) hold.hidden = surface !== "hold";
    const staged = surface === "install" || surface === "child" || surface === "hold";
    grid.hidden = staged;
    const blank = document.getElementById("home-blank");
    if (blank && staged) blank.hidden = true;
    document.body.classList.toggle("onboard", staged);
    document.body.dataset.stage = surface;
    const loc = navigator.language || document.documentElement.lang || "nl";
    if (surface === "child") {
      grid.innerHTML = "";
      paintHint("");
      paintChild();
      return;
    }
    if (surface === "install") {
      grid.innerHTML = "";
      paintHint("");
      paintInstall();
      return;
    }
    if (surface === "hold") {
      grid.innerHTML = "";
      paintHint("");
      paintHold();
      return;
    }
    const st = S.load();
    const on = S.LANGS.filter((l) => S.isLangOn(st, l));
    const chrome = S.homeChrome(on.length);
    const pickLangs = on;
    grid.classList.toggle("home-empty", pickLangs.length === 1);
    grid.classList.toggle("home-pick", !!chrome.firstPick);
    const tiles = pickLangs.map((l) => `
      <button class="tile" data-href="/willo/${l}/" data-label="${l}" aria-label="${l}">
        <img data-face="${l}" alt="" class="missing">
        <div class="text-fallback" aria-hidden="true"></div>
      </button>`).join("");
    grid.innerHTML = tiles;
    if (blank) {
      blank.hidden = false;
      blank.textContent = S.holdHintCopy(loc);
      if (window.WilloHold && blank.dataset.willoHold !== "1") {
        blank.dataset.willoHold = "1";
        WilloHold.attach(blank, {
          onHold() { openUnlock(); },
          onTap() {},
        });
      }
    }
    if (window.WilloHold && document.body.dataset.willoHold !== "1") {
      document.body.dataset.willoHold = "1";
      WilloHold.attach(document.body, {
        shouldStart(e) {
          if (document.body.dataset.stage !== "home") return false;
          const t = e && e.target;
          if (t && t.closest && t.closest("button.tile, .willo-mask, #install-card, #child-card")) return false;
          return true;
        },
        onHold() { openUnlock(); },
        onTap() {},
      });
    }
    paintHint("");
    grid.querySelectorAll("button.tile").forEach((btn) => {
      const pick = btn.dataset.pick === "1";
      btn.addEventListener("click", () => {
        if (pick) enableLang(btn.dataset.label);
        else if (btn.dataset.href) window.location = btn.dataset.href;
      });
    });
    applyFaceImages();
  }

  function applyLangs() {
    const st = S.load();
    S.LANGS.forEach((l) => {
      const on = S.isLangOn(st, l);
      document.querySelectorAll(`button.tile[data-label="${l}"]`).forEach((b) => {
        b.style.display = on ? "" : "none";
      });
      const nav = document.getElementById("nav-" + l);
      if (nav) nav.style.display = on ? "" : "none";
    });
    const PAGE = document.body.dataset && document.body.dataset.page;
    if (PAGE && S.LANGS.indexOf(PAGE) !== -1 && !S.isLangOn(st, PAGE)) {
      window.location = "/willo/";
    }
    renderHome();
  }

  function applyCatalog() {
    if (typeof build !== "function") return;
    document.querySelectorAll("[data-grid]").forEach((g) => { g.innerHTML = ""; });
    document.querySelectorAll("section.taal-section").forEach((s) => s.classList.remove("empty"));
    document.body.classList.remove("has-games");
    build();
    if (typeof refreshLiedjesOverflow === "function") refreshLiedjesOverflow();
    const st = S.load();
    S.SECTIONS.forEach((sec) => {
      const el = document.querySelector(`section[data-section="${sec}"]`);
      if (el && !S.isSectionOn(st, sec)) el.classList.add("empty");
    });
  }

  function openUnlock() {
    const surface = surfaceNow();
    if (surface === "install" || surface === "child") return;
    pinBuf = "";
    mode = "gate";
    sheetView = "root";
    sheetSec = "";
    if (typeof tel === "function") tel("pin_gate", { surface: surface });
    mount(renderGate());
  }

  function wantsReset() {
    try {
      return new URLSearchParams(location.search).get("reset") === "1";
    } catch (e) {
      return false;
    }
  }

  function wipeLocal() {
    try { localStorage.removeItem(S.KEY); } catch (e) {}
    try { localStorage.removeItem(KID_ID_KEY); } catch (e) {}
    try { sessionStorage.removeItem("willo_show_install"); } catch (e) {}
    try { sessionStorage.removeItem("willo_install_left"); } catch (e) {}
    try { sessionStorage.removeItem("willo_install_again"); } catch (e) {}
    try { document.cookie = "willo_bridge=;path=/;max-age=0;SameSite=Lax"; } catch (e) {}
    try { indexedDB.deleteDatabase("willo-photos"); } catch (e) {}
  }

  async function resetIfAsked() {
    if (!wantsReset()) return false;
    await forgetKidIcon();
    wipeLocal();
    try {
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => String(k).indexOf("willo") === 0).map((k) => caches.delete(k)));
      }
    } catch (e) {}
    location.replace(location.pathname + location.hash);
    return true;
  }

  async function boot() {
    document.body.classList.add("booted");
    const fallback = document.getElementById("boot-fallback");
    if (fallback) fallback.hidden = true;
    try { sessionStorage.removeItem("willo_show_install"); } catch (e) {}
    continuedThisLoad = false;
    if (await resetIfAsked()) return;
    if (isStandalone()) forgetKidIcon();
    applyLangs();
    applyCatalog();
    applyFaceImages();
    const st = S.load();
    if (!isStandalone() && S.hasChild(st)) {
      photoGet("child").then((data) => applySpringboard(st.childName, data, {
        allowUpload: S.wantsA2hs(location.search),
      }));
    }
    const relayout = () => { if (document.getElementById("install-card") && surfaceNow() === "install") paintInstall(); };
    window.addEventListener("resize", relayout);
    window.addEventListener("orientationchange", () => setTimeout(relayout, 250));
    const watchingInstall = () => {
      if (isStandalone()) return false;
      if (surfaceNow() === "install") return true;
      try { return S.wantsA2hs(location.search); } catch (e) { return false; }
    };
    const markInstallLeft = () => {
      if (!watchingInstall()) return;
      try {
        sessionStorage.setItem("willo_install_left", "1");
        sessionStorage.removeItem("willo_install_again");
      } catch (e) {}
    };
    const resumeInstallCoach = () => {
      if (!watchingInstall()) return;
      if (surfaceNow() === "install") paintInstall();
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") markInstallLeft();
      else resumeInstallCoach();
    });
    window.addEventListener("pagehide", markInstallLeft);
    window.addEventListener("pageshow", resumeInstallCoach);
  }

  root.WilloUI = { openUnlock, openAddLang, boot, applyFaceImages, applyLangs, applyCatalog, renderHome, applySpringboard, forgetKidIcon };
})(typeof globalThis !== "undefined" ? globalThis : this);
