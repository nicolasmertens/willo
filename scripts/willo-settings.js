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

  function homeSurface(standalone, langOnCount, opts) {
    const iosBrowser = !!(opts && opts.iosBrowser);
    if (iosBrowser && !standalone) return "install";
    if (!langOnCount) return "plus";
    return "home";
  }

  function defaultState() {
    return {
      pinHash: "",
      birth: "",
      langs: { mama: false, papa: false, klas: false },
      sections: { boeken: true, games: true, liedjes: true, verhalen: true },
      items: {},
    };
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
    LANGS.forEach((l) => { if (s.langs && typeof s.langs[l] === "boolean") base.langs[l] = s.langs[l]; });
    SECTIONS.forEach((sec) => { if (s.sections && typeof s.sections[sec] === "boolean") base.sections[sec] = s.sections[sec]; });
    if (s.items && typeof s.items === "object") base.items = s.items;
    return { ok: true, state: base, photos: data.photos || {} };
  }

  function load() {
    try {
      const raw = root.localStorage && root.localStorage.getItem(KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const merged = defaultState();
      return Object.assign(merged, parsed, {
        langs: Object.assign(defaultState().langs, parsed.langs || {}),
        sections: Object.assign(defaultState().sections, parsed.sections || {}),
        items: parsed.items || {},
      });
    } catch (e) {
      return defaultState();
    }
  }

  function save(state) {
    try {
      if (root.localStorage) root.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {}
    return state;
  }

  const api = {
    KEY, LANGS, SECTIONS, STAGES,
    homeSurface, defaultState, hashPin, ageMonths, stageFor, itemKey,
    isLangOn, isSectionOn, isItemOn,
    setLang, setSection, setItem, setBirth, setPin, checkPin,
    exportPayload, importPayload, load, save,
  };

  root.WilloSettings = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
