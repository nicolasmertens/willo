/** Willo parent settings. Browser + Node (evals). */
(function (root) {
  const KEY = "willo_settings_v2";
  const LANGS = ["mama", "papa", "klas"];
  const SECTIONS = ["boeken", "games", "liedjes", "verhalen"];
  const STAGES = [
    { id: "0-2", from: 0, to: 2 },
    { id: "3-4", from: 3, to: 4 },
    { id: "5-6", from: 5, to: 6 },
    { id: "7-8", from: 7, to: 8 },
    { id: "9-10", from: 9, to: 10 },
    { id: "11-12", from: 11, to: 12 },
    { id: "13-15", from: 13, to: 15 },
    { id: "16-18", from: 16, to: 18 },
    { id: "19-21", from: 19, to: 21 },
    { id: "22-24", from: 22, to: 24 },
    { id: "25-27", from: 25, to: 27 },
    { id: "28-30", from: 28, to: 30 },
    { id: "31+", from: 31, to: 120 },
  ];

  function isIosBrowser(info) {
    info = info || {};
    const ua = String(info.ua || "");
    const platform = String(info.platform || "");
    const points = Number(info.maxTouchPoints || 0);
    const coarse = !!info.coarse;
    if (/iP(hone|ad|od)/.test(ua)) return true;
    const blob = ua + " " + platform;
    if (points > 1 && /Mac/.test(blob)) return true;
    const safari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|Android/.test(ua);
    if (safari && (points > 1 || coarse)) return true;
    return false;
  }

  function installBrowser(ua) {
    ua = String(ua || "");
    if (/CriOS|Chrome\//.test(ua) && !/Edg/.test(ua)) return "chrome";
    if (/FxiOS|Firefox/.test(ua)) return "firefox";
    if (/EdgiOS|Edg\//.test(ua)) return "edge";
    return "safari";
  }

  function installPad(info) {
    info = info || {};
    const ua = String(info.ua || "");
    const w = Number(info.width || 0);
    const h = Number(info.height || 0);
    const points = Number(info.maxTouchPoints || 0);
    if (/iPhone|iPod/.test(ua)) return false;
    if (/iPad/.test(ua)) return true;
    if (/Macintosh|MacIntel/.test(ua + " " + String(info.platform || "")) && points > 1) return true;
    const min = Math.min(w, h);
    const max = Math.max(w, h);
    return points > 1 && min >= 600 && max >= 900;
  }

  function installShareAt(info) {
    info = info || {};
    const browser = installBrowser(info.ua);
    if (!installPad(info) && browser === "safari") return "bottom-center";
    return "top-right";
  }

  function installCopy(lang) {
    const l = String(lang || "en").toLowerCase().slice(0, 2);
    const table = {
      nl: { share: "Deel", add: "Zet op beginscherm", menu: "Menu" },
      fr: { share: "Partager", add: "Sur l'écran d'accueil", menu: "Menu" },
      de: { share: "Teilen", add: "Zum Home-Bildschirm", menu: "Menü" },
      en: { share: "Share", add: "Add to Home Screen", menu: "Menu" },
    };
    return table[l] || table.en;
  }

  function childCopy(lang) {
    const l = String(lang || "en").toLowerCase().slice(0, 2);
    const table = {
      nl: { title: "Wie speelt er?", name: "Naam", birth: "Geboortedatum", photo: "Foto van het kind", pick: "Tik voor een foto", go: "Verder" },
      fr: { title: "Qui joue ?", name: "Prénom", birth: "Naissance", photo: "Photo de l'enfant", pick: "Touchez pour une photo", go: "Continuer" },
      de: { title: "Wer spielt?", name: "Name", birth: "Geburtstag", photo: "Foto vom Kind", pick: "Tippen für ein Foto", go: "Weiter" },
      en: { title: "Who is playing?", name: "Name", birth: "Birthday", photo: "Photo of the child", pick: "Tap to add a photo", go: "Continue" },
    };
    return table[l] || table.en;
  }

  function springboardName(name) {
    const n = String(name || "").trim().split(/\s+/)[0] || "";
    return n.slice(0, 12);
  }

  function springboardTags(name) {
    return {
      title: springboardName(name) || "Willo",
      detachManifest: true,
      stockIconPaths: ["apple-touch-icon.png", "icon-192.png", "icon-512.png", "favicon-32.png"],
    };
  }

  function hasChild(state) {
    return !!(state && springboardName(state.childName) && state.birth && state.childFace);
  }

  function homeSurface(standalone, langOnCount, opts) {
    const iosBrowser = opts && Object.prototype.hasOwnProperty.call(opts, "iosBrowser")
      ? !!opts.iosBrowser
      : isIosBrowser(opts);
    const child = opts && Object.prototype.hasOwnProperty.call(opts, "hasChild")
      ? !!opts.hasChild
      : false;
    if (!child) return "child";
    if (iosBrowser && !standalone) return "install";
    if (!langOnCount) return "hold";
    return "home";
  }

  function homeChrome(langOnCount) {
    const n = Number(langOnCount) || 0;
    return {
      firstPick: false,
      showPlus: false,
      holdHint: n > 0,
      holdCoach: n === 0,
    };
  }

  function navVisibility(state) {
    const out = {};
    LANGS.forEach((l) => { out[l] = isLangOn(state, l); });
    return out;
  }

  function firstPickCopy(lang) {
    const l = String(lang || "en").toLowerCase().slice(0, 2);
    const table = {
      nl: { title: "Kies", hint: "Houd daarna 2 seconden in voor instellingen." },
      fr: { title: "Choisis", hint: "Ensuite, reste appuyé 2 secondes pour les réglages." },
      de: { title: "Wählen", hint: "Danach 2 Sekunden halten für Einstellungen." },
      en: { title: "Choose", hint: "Then hold 2 seconds for settings." },
    };
    return table[l] || table.en;
  }

  function holdCopy(lang) {
    const l = String(lang || "en").toLowerCase().slice(0, 2);
    const table = {
      nl: { kicker: "Op het beginscherm", title: "Houd 2 seconden in", hint: "Zo open je instellingen. Mama, papa, klas." },
      fr: { kicker: "Sur l'écran d'accueil", title: "Reste appuyé 2 secondes", hint: "Ça ouvre les réglages. Maman, papa, classe." },
      de: { kicker: "Auf dem Home-Bildschirm", title: "2 Sekunden halten", hint: "So öffnest du Einstellungen. Mama, Papa, Klasse." },
      en: { kicker: "On the Home Screen", title: "Hold for 2 seconds", hint: "That opens settings. Mama, papa, class." },
    };
    return table[l] || table.en;
  }

  function holdHintCopy(lang) {
    const l = String(lang || "en").toLowerCase().slice(0, 2);
    const table = {
      nl: "Houd een tegel 2 seconden in voor instellingen.",
      fr: "Reste appuyé 2 secondes sur une tuile pour les réglages.",
      de: "Kachel 2 Sekunden halten für Einstellungen.",
      en: "Hold a tile 2 seconds for settings.",
    };
    return table[l] || table.en;
  }

  function slimBridge(state) {
    const s = state || defaultState();
    return {
      childName: s.childName || "",
      birth: s.birth || "",
      childFace: !!s.childFace,
      langs: Object.assign(defaultState().langs, s.langs || {}),
    };
  }

  function mergeBridge(state, bridge) {
    const next = clone(state || defaultState());
    if (!bridge || typeof bridge !== "object") return next;
    if (hasChild(next)) return next;
    if (bridge.childName) next.childName = springboardName(bridge.childName);
    if (bridge.birth) next.birth = String(bridge.birth);
    if (bridge.childFace) next.childFace = true;
    if (bridge.langs && typeof bridge.langs === "object") {
      LANGS.forEach((l) => {
        if (typeof bridge.langs[l] === "boolean") next.langs[l] = bridge.langs[l];
      });
    }
    return next;
  }

  function writeBridgeCookie(state) {
    try {
      if (typeof document === "undefined") return;
      const slim = slimBridge(state);
      document.cookie = "willo_bridge=" + encodeURIComponent(JSON.stringify(slim)) + ";path=/;max-age=31536000;SameSite=Lax";
    } catch (e) {}
  }

  function readBridgeCookie() {
    try {
      if (typeof document === "undefined") return null;
      const m = String(document.cookie || "").match(/(?:^|; )willo_bridge=([^;]*)/);
      if (!m) return null;
      return JSON.parse(decodeURIComponent(m[1]));
    } catch (e) {
      return null;
    }
  }

  function defaultState() {
    return {
      pinHash: "",
      birth: "",
      childName: "",
      childFace: false,
      langs: { mama: false, papa: false, klas: false },
      sections: { boeken: true, games: true, liedjes: true, verhalen: true },
      items: {},
    };
  }

  function setChild(state, name, birth) {
    const label = springboardName(name);
    if (!label) return { ok: false, reason: "bad-name" };
    if (!birth || !/^\d{4}-\d{2}-\d{2}$/.test(birth)) return { ok: false, reason: "bad-birth" };
    const next = clone(state);
    next.childName = label;
    next.birth = birth;
    return { ok: true, state: next };
  }

  function clone(s) {
    return JSON.parse(JSON.stringify(s));
  }

  function hashPin(pin) {
    const s = "willo:" + String(pin);
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
    return (h >>> 0).toString(16);
  }

  function ageMonths(birth, nowMs) {
    if (!birth || !/^\d{4}-\d{2}-\d{2}$/.test(birth)) return null;
    const now = nowMs == null ? Date.now() : nowMs;
    const b = new Date(birth + "T00:00:00");
    if (isNaN(b.getTime())) return null;
    const n = new Date(now);
    let m = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth());
    if (n.getDate() < b.getDate()) m -= 1;
    if (m < 0) return 0;
    return m;
  }

  function stageFor(months) {
    if (months == null) return null;
    for (let i = 0; i < STAGES.length; i++) {
      if (months >= STAGES[i].from && months <= STAGES[i].to) return STAGES[i];
    }
    return STAGES[STAGES.length - 1];
  }

  function itemKey(taal, section, n) {
    return taal + ":" + section + ":" + n;
  }

  function isLangOn(state, lang) {
    return !!(state && state.langs && state.langs[lang]);
  }

  function isSectionOn(state, section) {
    return !!(state && state.sections && state.sections[section]);
  }

  function isItemOn(state, track, taal) {
    if (!track) return false;
    const section = track._section;
    if (section && !isSectionOn(state, section)) return false;
    const k = itemKey(taal, section, track.n);
    if (state.items && Object.prototype.hasOwnProperty.call(state.items, k)) {
      return !!state.items[k];
    }
    const months = ageMonths(state.birth);
    const from = track.fromMonth == null ? 0 : Number(track.fromMonth);
    if (months == null) return from < 30;
    return from <= months;
  }

  function setLang(state, lang, on) {
    if (LANGS.indexOf(lang) === -1) return { ok: false, reason: "bad-lang" };
    const next = clone(state);
    next.langs[lang] = !!on;
    return { ok: true, state: next };
  }

  function setSection(state, section, on) {
    if (SECTIONS.indexOf(section) === -1) return { ok: false, reason: "bad-section" };
    const next = clone(state);
    next.sections[section] = !!on;
    return { ok: true, state: next };
  }

  function setItem(state, taal, section, n, on) {
    const next = clone(state);
    next.items[itemKey(taal, section, n)] = !!on;
    return { ok: true, state: next };
  }

  function setBirth(state, birth) {
    if (birth && !/^\d{4}-\d{2}-\d{2}$/.test(birth)) return { ok: false, reason: "bad-birth" };
    const next = clone(state);
    next.birth = birth || "";
    return { ok: true, state: next };
  }

  function setPin(state, pin) {
    if (!/^\d{4}$/.test(String(pin))) return { ok: false, reason: "bad-pin" };
    const next = clone(state);
    next.pinHash = hashPin(pin);
    return { ok: true, state: next };
  }

  function checkPin(state, pin) {
    if (!state.pinHash) return { ok: false, reason: "no-pin" };
    if (state.pinHash !== hashPin(pin)) return { ok: false, reason: "wrong-pin" };
    return { ok: true };
  }

  function exportPayload(state, photos) {
    return {
      v: 1,
      app: "willo",
      state: clone(state),
      photos: photos || {},
    };
  }

  function importPayload(raw) {
    let data = raw;
    if (typeof raw === "string") {
      try { data = JSON.parse(raw); } catch (e) { return { ok: false, reason: "bad-json" }; }
    }
    if (!data || data.app !== "willo" || !data.state) return { ok: false, reason: "bad-file" };
    const base = defaultState();
    const s = data.state;
    if (s.pinHash) base.pinHash = String(s.pinHash);
    if (s.birth) base.birth = String(s.birth);
    if (s.childName) base.childName = springboardName(s.childName);
    if (s.childFace) base.childFace = true;
    LANGS.forEach((l) => { if (s.langs && typeof s.langs[l] === "boolean") base.langs[l] = s.langs[l]; });
    SECTIONS.forEach((sec) => { if (s.sections && typeof s.sections[sec] === "boolean") base.sections[sec] = s.sections[sec]; });
    if (s.items && typeof s.items === "object") base.items = s.items;
    return { ok: true, state: base, photos: data.photos || {} };
  }

  function load() {
    try {
      const raw = root.localStorage && root.localStorage.getItem(KEY);
      if (!raw) return mergeBridge(defaultState(), readBridgeCookie());
      const parsed = JSON.parse(raw);
      const merged = defaultState();
      const fromStore = Object.assign(merged, parsed, {
        langs: Object.assign(defaultState().langs, parsed.langs || {}),
        sections: Object.assign(defaultState().sections, parsed.sections || {}),
        items: parsed.items || {},
      });
      if (hasChild(fromStore)) return fromStore;
      return mergeBridge(fromStore, readBridgeCookie());
    } catch (e) {
      return mergeBridge(defaultState(), readBridgeCookie());
    }
  }

  function save(state) {
    try {
      if (root.localStorage) root.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {}
    writeBridgeCookie(state);
    return state;
  }

  const api = {
    KEY, LANGS, SECTIONS, STAGES,
    homeSurface, homeChrome, navVisibility, hasChild, setChild, springboardName, springboardTags, childCopy,
    firstPickCopy, holdCopy, holdHintCopy, slimBridge, mergeBridge,
    isIosBrowser, installBrowser, installPad, installShareAt, installCopy,
    defaultState, hashPin, ageMonths, stageFor, itemKey,
    isLangOn, isSectionOn, isItemOn,
    setLang, setSection, setItem, setBirth, setPin, checkPin,
    exportPayload, importPayload, load, save,
  };

  root.WilloSettings = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
