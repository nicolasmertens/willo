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

  async function applyFaceImages() {
    for (const l of S.LANGS) {
      const data = await photoGet(l);
      if (!data) continue;
      document.querySelectorAll(`img[src*="home/${l}.jpg"], img[data-face="${l}"]`).forEach((img) => {
        img.src = data;
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
  }

  function renderGate() {
    const st = S.load();
    const first = !st.pinHash;
    return `
      <h2>${first ? "Kies een PIN" : "PIN"}</h2>
      <p class="willo-hint">${first ? "Vier cijfers. Alleen voor ouders." : "Lang drukken op stop opent dit."}</p>
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
      <h3>Talen</h3>
      ${S.LANGS.map((l) => `<div class="willo-row"><label>${l}</label>${toggle(S.isLangOn(st, l)).replace(">", ` data-lang="${l}">`)}</div>`).join("")}
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
      if (!r.ok) { el.checked = true; return; }
      S.save(r.state); applyLangs();
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
      mode = "sheet";
      mount(renderSheet());
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
    mode = "sheet";
    mount(renderSheet());
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
    pinBuf = "";
    mode = "gate";
    mount(renderGate());
  }

  function boot() {
    applyLangs();
    applyCatalog();
    applyFaceImages();
  }

  root.WilloUI = { openUnlock, boot, applyFaceImages, applyLangs, applyCatalog };
})(typeof globalThis !== "undefined" ? globalThis : this);
