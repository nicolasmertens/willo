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
  let sessionOk = false;
  let pendingAfterPin = "";

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
    .willo-pins button{width:64px;height:48px;border-radius:12px;border:0;background:#fff;font-weight:800;font-size:18px;box-shadow:0 3px 0 rgba(0,0,0,.1);}
    .willo-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;}
    .willo-actions button,.willo-sheet .willo-go{border:0;border-radius:14px;padding:12px 14px;font-weight:800;background:#fff;box-shadow:0 3px 0 rgba(0,0,0,.1);}
    .willo-err{color:#c0392b;font-weight:700;min-height:1.2em;text-align:center;}
    .willo-hint{font-size:14px;color:rgba(0,0,0,.5);margin:8px 0;}
    `;
  }

  function toggle(on) {
    return `<input type="checkbox" ${on ? "checked" : ""}>`;
  }

  let pinBuf = "";
  let mode = "gate";

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

  function renderSheet() {
    const st = S.load();
    const months = S.ageMonths(st.birth);
    const stage = S.stageFor(months);
    const standalone = !!(navigator.standalone || matchMedia("(display-mode: standalone)").matches);
    const PAGE = (document.body.dataset && document.body.dataset.page) || "";
    const tracks = (root.ALL_TRACKS || []).filter((t) => t._section);
    const groups = { boeken: [], games: [], liedjes: [], verhalen: [] };
    tracks.forEach((t) => { if (groups[t._section]) groups[t._section].push(t); });
    Object.keys(groups).forEach((g) => {
      groups[g].sort((a, b) => (a.fromMonth || 0) - (b.fromMonth || 0) || a.n - b.n);
    });
    const labels = { boeken: "Boeken", games: "Spelen", liedjes: "Liedjes", verhalen: "Verhalen" };
    return `
      <h2>Willo</h2>
      <p class="willo-hint">${standalone ? "Op het beginscherm." : "Zet op beginscherm via Delen in Safari."}</p>
      <h3>Kind</h3>
      <div class="willo-row"><label>Geboorte</label><input type="date" id="willo-birth" value="${st.birth || ""}"></div>
      <div class="willo-hint">${months == null ? "Nog geen leeftijd." : months + " maanden · emmer " + (stage ? stage.id : "?")}</div>
      <h3>Mama, papa, klas</h3>
      ${S.LANGS.map((l) => `<div class="willo-row"><label>${LANG_LABEL[l] || l}</label>${toggle(S.isLangOn(st, l)).replace(">", ` data-lang="${l}">`)}</div>`).join("")}
      <h3>Secties</h3>
      ${S.SECTIONS.map((sec) => `<div class="willo-row"><label>${labels[sec] || sec}</label>${toggle(S.isSectionOn(st, sec)).replace(">", ` data-sec="${sec}">`)}</div>`).join("")}
      ${PAGE && tracks.length ? `<h3>Tegels (${PAGE})</h3>` + S.SECTIONS.map((sec) => {
        if (!groups[sec].length) return "";
        return `<h3 style="margin-top:8px">${labels[sec]}</h3>` + groups[sec].map((t) => {
          const on = S.isItemOn(st, t, PAGE);
          return `<div class="willo-row"><label>${t.title}<small>vanaf ${t.fromMonth || 0} m</small></label>${toggle(on).replace(">", ` data-item="${PAGE}:${sec}:${t.n}">`)}</div>`;
        }).join("");
      }).join("") : ""}
      <h3>Foto’s</h3>
      ${S.LANGS.map((l) => `<div class="willo-row"><label>${l}</label><input type="file" accept="image/*" data-photo="${l}"></div>`).join("")}
      <div class="willo-actions">
        <button type="button" data-export>Exporteer</button>
        <button type="button" data-import>Importeer</button>
        <input type="file" accept="application/json,.json" id="willo-import" hidden>
        <button type="button" data-close>Klaar</button>
      </div>
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
  }

  function bind(mask) {
    mask.addEventListener("click", (e) => { if (e.target === mask) close(); });
    mask.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
    mask.querySelectorAll("[data-k]").forEach((b) => b.addEventListener("click", () => digit(b.getAttribute("data-k"))));
    mask.querySelectorAll("[data-lang]").forEach((el) => el.addEventListener("change", () => {
      const r = S.setLang(S.load(), el.getAttribute("data-lang"), el.checked);
      if (!r.ok) { el.checked = !el.checked; return; }
      S.save(r.state); applyLangs();
    }));
    mask.querySelectorAll("[data-add-lang]").forEach((b) => b.addEventListener("click", () => {
      const lang = b.getAttribute("data-add-lang");
      const r = S.setLang(S.load(), lang, true);
      if (r.ok) S.save(r.state);
      close();
      applyLangs();
    }));
    mask.querySelectorAll("[data-sec]").forEach((el) => el.addEventListener("change", () => {
      const r = S.setSection(S.load(), el.getAttribute("data-sec"), el.checked);
      S.save(r.state); applyCatalog();
    }));
    mask.querySelectorAll("[data-item]").forEach((el) => el.addEventListener("change", () => {
      const [taal, sec, n] = el.getAttribute("data-item").split(":");
      const r = S.setItem(S.load(), taal, sec, Number(n), el.checked);
      S.save(r.state); applyCatalog();
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
      return `<h2>Mama, papa, klas</h2><p class="willo-hint">Mama, papa en klas staan al aan.</p><div class="willo-actions"><button type="button" data-close>Klaar</button></div>`;
    }
    return `
      <h2>Toevoegen</h2>
      <p class="willo-hint">Kies mama, papa of klas. Foto kan later in instellingen.</p>
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
    return S.homeSurface(isStandalone(), n, Object.assign(iosProbe(), { hasChild: S.hasChild(st) }));
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
      <h1>${copy.title}</h1>
      <label for="child-name">${copy.name}</label>
      <input id="child-name" type="text" enterkeyhint="done" autocomplete="nickname" maxlength="24" value="${st.childName || ""}">
      <label for="child-birth">${copy.birth}</label>
      <input id="child-birth" type="date">
      <label>${copy.photo}</label>
      <div class="photo-well">
        <input id="child-photo" type="file" accept="image/*">
        <img id="child-photo-preview" alt="" hidden>
        <span>${copy.pick}</span>
      </div>
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

  async function applySpringboard(name, dataUrl) {
    const label = S.springboardName(name) || "Willo";
    let title = document.querySelector("meta[name='apple-mobile-web-app-title']");
    if (!title) {
      title = document.createElement("meta");
      title.setAttribute("name", "apple-mobile-web-app-title");
      document.head.appendChild(title);
    }
    title.setAttribute("content", label);
    document.title = label;
    const man = document.getElementById("willo-manifest");
    if (man && String(man.href || "").indexOf("blob:") === 0) man.href = "manifest.json";
    tellWorkerKid(label);
    if (!dataUrl) return;
    try {
      const b180 = await squareBlob(dataUrl, 180);
      const b512 = await squareBlob(dataUrl, 512);
      await cacheKidIcon(b180, "kid-icon-180.png");
      await cacheKidIcon(b512, "kid-icon-512.png");
      const stamp = Date.now();
      const icon180 = document.getElementById("willo-touch-icon");
      if (icon180) icon180.href = "apple-touch-icon.png?v=" + stamp;
      document.querySelectorAll("link[rel='icon']").forEach((l) => { l.href = "icon-192.png?v=" + stamp; });
      tellWorkerKid(label);
    } catch (e) {}
  }

  async function submitChild() {
    const nameEl = document.getElementById("child-name");
    const birthEl = document.getElementById("child-birth");
    const photoEl = document.getElementById("child-photo");
    const err = document.getElementById("child-err");
    const file = photoEl && photoEl.files && photoEl.files[0];
    const r = S.setChild(S.load(), nameEl ? nameEl.value : "", birthEl ? birthEl.value : "");
    if (!r.ok || !file) {
      if (err) err.textContent = "!";
      return;
    }
    const dataUrl = await fileToData(file);
    await photoSet("child", dataUrl);
    r.state.childFace = true;
    S.save(r.state);
    if (navigator.serviceWorker) await navigator.serviceWorker.ready;
    await applySpringboard(r.state.childName, dataUrl);
    renderHome();
  }

  function paintInstall() {
    const el = document.getElementById("install-card");
    if (!el) return;
    const probe = Object.assign(iosProbe(), { width: window.innerWidth, height: window.innerHeight });
    const at = S.installShareAt(probe);
    const browser = S.installBrowser(probe.ua);
    const copy = S.installCopy(navigator.language || document.documentElement.lang || "en");
    const step1icon = browser === "safari" ? SVG_SHARE : SVG_DOTS;
    const step1text = browser === "safari" ? copy.share : copy.menu;
    el.dataset.at = at;
    el.dataset.browser = browser;
    el.innerHTML = `
      <div class="install-aim">${step1icon}</div>
      <div class="install-row"><span class="install-n">1</span>${step1icon}<span>${step1text}</span></div>
      <div class="install-row"><span class="install-n">2</span>${SVG_ADD}<span>${copy.add}</span></div>
    `;
    document.documentElement.lang = (navigator.language || "en").slice(0, 2);
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
    if (child) child.hidden = surface !== "child";
    if (install) install.hidden = surface !== "install";
    grid.hidden = surface === "install" || surface === "child";
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
    const st = S.load();
    const on = S.LANGS.filter((l) => S.isLangOn(st, l));
    const chrome = S.homeChrome(on.length);
    const pickLangs = chrome.firstPick ? S.LANGS.slice() : on;
    grid.classList.toggle("home-empty", pickLangs.length === 1);
    grid.classList.toggle("home-pick", !!chrome.firstPick);
    const tiles = pickLangs.map((l) => `
      <button class="tile" data-href="/willo/${l}/" data-label="${l}" data-pick="${chrome.firstPick ? "1" : ""}" aria-label="${LANG_LABEL[l] || l}">
        <img data-face="${l}" alt="" class="missing">
        <div class="text-fallback">${LANG_LABEL[l] || l}</div>
        <div class="label">${LANG_LABEL[l] || l}</div>
      </button>`).join("");
    grid.innerHTML = tiles;
    paintHint(chrome.firstPick ? S.firstPickCopy(loc).hint : (chrome.holdHint ? S.holdHintCopy(loc) : ""));
    grid.querySelectorAll("button.tile").forEach((btn) => {
      const pick = btn.dataset.pick === "1";
      if (window.WilloHold) {
        WilloHold.attach(btn, {
          onTap() {
            if (pick) enableLang(btn.dataset.label);
            else if (btn.dataset.href) window.location = btn.dataset.href;
          },
          onHold() { openUnlock(); },
        });
      }
      btn.addEventListener("click", (e) => {
        if ("ontouchstart" in window) return;
        if (e.detail === 0) return;
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
    mount(renderGate());
  }

  function boot() {
    applyLangs();
    applyCatalog();
    applyFaceImages();
    const st = S.load();
    if (S.hasChild(st)) photoGet("child").then((data) => applySpringboard(st.childName, data));
    const relayout = () => { if (document.getElementById("install-card") && surfaceNow() === "install") paintInstall(); };
    window.addEventListener("resize", relayout);
    window.addEventListener("orientationchange", () => setTimeout(relayout, 250));
  }

  root.WilloUI = { openUnlock, openAddLang, boot, applyFaceImages, applyLangs, applyCatalog, renderHome };
})(typeof globalThis !== "undefined" ? globalThis : this);
