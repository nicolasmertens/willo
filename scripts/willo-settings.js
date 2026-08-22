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
    if (!installPad(info)) return "none";
    return "top-right";
  }

  function installCopy(lang) {
    const l = String(lang || "en").toLowerCase().slice(0, 2);
    const table = {
      nl: {
        share: "Deel",
        add: "Zet op beginscherm",
        menu: "Menu",
        more: "Toon meer",
        pageMenu: "Tik dit",
        through: "Tik deze stappen",
        then: "Daarna",
        open: "Open {name} vanaf het beginscherm",
        again: "Toon opnieuw hoe ik het toevoeg",
      },
      fr: {
        share: "Partager",
        add: "Sur l'écran d'accueil",
        menu: "Menu",
        more: "Voir plus",
        pageMenu: "Touche ceci",
        through: "Passe par ces étapes",
        then: "Ensuite",
        open: "Ouvre {name} depuis l'écran d'accueil",
        again: "Montre-moi comment l'ajouter à nouveau",
      },
      de: {
        share: "Teilen",
        add: "Zum Home-Bildschirm",
        menu: "Menü",
        more: "Mehr anzeigen",
        pageMenu: "Tippe hier",
        through: "Tippe diese Schritte",
        then: "Danach",
        open: "Öffne {name} vom Home-Bildschirm",
        again: "Zeig mir nochmal, wie ich es hinzufüge",
      },
      en: {
        share: "Share",
        add: "Add to Home Screen",
        menu: "Menu",
        more: "View More",
        pageMenu: "Tap this",
        through: "Tap through these steps",
        then: "Then",
        open: "Open {name} from the Home Screen",
        again: "Show me how to add it again",
      },
    };
    return table[l] || table.en;
  }

  function openIconLabel(lang, name) {
    const copy = installCopy(lang);
    const n = springboardName(name) || "Willo";
    return String(copy.open || "").replace("{name}", n);
  }

  function installStepIcon(id) {
    const map = {
      "page-menu": "line-3-horizontal",
      share: "square-and-arrow-up",
      "view-more": "view-more",
      add: "plus-square",
      menu: "ellipsis",
      open: "open",
    };
    return map[id] || "";
  }

  function installSteps(info, lang, name) {
    const copy = installCopy(lang);
    const browser = installBrowser((info && info.ua) || "");
    const pad = installPad(info);
    const open = openIconLabel(lang, name);
    const steps = [];
    function push(id, label) {
      steps.push({ id: id, label: label, icon: installStepIcon(id) });
    }
    if (browser === "safari") {
      if (!pad) push("page-menu", copy.pageMenu);
      push("share", copy.share);
      push("view-more", copy.more);
      push("add", copy.add);
    } else {
      push("menu", copy.menu);
      push("add", copy.add);
    }
    push("open", open);
    return steps;
  }

  function installCoachMode(opts) {
    opts = opts || {};
    if (opts.standalone) return "none";
    if (opts.forceSteps) return "steps";
    if (opts.leftAndReturned) return "open";
    return "steps";
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
    if (iosBrowser && !standalone) {
      return opts && opts.showInstall ? "install" : "child";
    }
    return "home";
  }

  function homeChrome(langOnCount) {
    return {
      firstPick: false,
      showPlus: false,
      holdHint: true,
      holdCoach: false,
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
      nl: { kicker: "Instellingen", title: "", hint: "Op het beginscherm opent 2 seconden drukken in de lege ruimte de instellingenpagina." },
      fr: { kicker: "Réglages", title: "", hint: "Sur l'écran d'accueil, rester appuyé 2 secondes dans le vide ouvre la page des réglages." },
      de: { kicker: "Einstellungen", title: "", hint: "Auf dem Startbildschirm öffnet 2 Sekunden Drücken im leeren Bereich die Einstellungsseite." },
      en: { kicker: "Settings", title: "", hint: "On the Home Screen, pressing empty space for 2 seconds opens the settings page." },
    };
    return table[l] || table.en;
  }

  function holdHintCopy(lang) {
    const l = String(lang || "en").toLowerCase().slice(0, 2);
    const table = {
      nl: "Houd 2 seconden in de lege ruimte.",
      fr: "Reste appuyé 2 secondes dans le vide.",
      de: "Leeren Bereich 2 Sekunden halten.",
      en: "Press empty space 2 seconds for settings.",
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

  function fromChildQuery(search) {
    let q = search;
    if (typeof search === "string") {
      if (search.charAt(0) === "?") search = search.slice(1);
      q = new URLSearchParams(search);
    }
    if (!q || typeof q.get !== "function") return null;
    const n = springboardName(q.get("n") || "");
    const b = String(q.get("b") || "");
    if (!n || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return null;
    return { childName: n, birth: b, childFace: q.get("f") !== "0" };
  }

  const KID_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function kidIdFromSearch(search) {
    let q = search;
    if (typeof search === "string") {
      if (search.charAt(0) === "?") search = search.slice(1);
      q = new URLSearchParams(search);
    }
    if (!q || typeof q.get !== "function") return "";
    const k = String(q.get("k") || "").toLowerCase();
    return KID_ID_RE.test(k) ? k : "";
  }

  function wantsA2hs(search) {
    let q = search;
    if (typeof search === "string") {
      if (search.charAt(0) === "?") search = search.slice(1);
      q = new URLSearchParams(search);
    }
    if (!q || typeof q.get !== "function") return false;
    return q.get("a2hs") === "1";
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
      document.cookie = "willo_bridge=" + encodeURIComponent(JSON.stringify(slim)) + ";path=/;max-age=31536000;SameSite=Lax;Secure";
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

  function gameLeaf(href) {
    const m = String(href || "").match(/\/games\/([^/]+)\//);
    return m ? m[1] : "";
  }

  function groupItems(section, catalog) {
    const rows = (catalog || []).filter((t) => t && t.section === section);
    if (section === "games") {
      const map = {};
      const order = [];
      rows.forEach((t) => {
        const leaf = gameLeaf(t.href) || (t.pack + "-" + t.n);
        if (!map[leaf]) {
          map[leaf] = { id: leaf, title: t.title, items: [] };
          order.push(leaf);
        }
        map[leaf].items.push(t);
      });
      return order.map((k) => {
        const g = map[k];
        const papa = g.items.filter((i) => i.pack === "papa")[0];
        if (papa) g.title = papa.title;
        return g;
      });
    }
    return rows.map((t) => ({
      id: t.pack + ":" + t.n,
      title: t.title,
      items: [t],
    }));
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
      if (!raw) {
        let st = mergeBridge(defaultState(), readBridgeCookie());
        if (!hasChild(st) && typeof location !== "undefined") {
          st = mergeBridge(st, fromChildQuery(location.search));
        }
        return st;
      }
      const parsed = JSON.parse(raw);
      const merged = defaultState();
      const fromStore = Object.assign(merged, parsed, {
        langs: Object.assign(defaultState().langs, parsed.langs || {}),
        sections: Object.assign(defaultState().sections, parsed.sections || {}),
        items: parsed.items || {},
      });
      if (hasChild(fromStore)) return fromStore;
      let st = mergeBridge(fromStore, readBridgeCookie());
      if (!hasChild(st) && typeof location !== "undefined") {
        st = mergeBridge(st, fromChildQuery(location.search));
      }
      return st;
    } catch (e) {
      let st = mergeBridge(defaultState(), readBridgeCookie());
      if (typeof location !== "undefined") st = mergeBridge(st, fromChildQuery(location.search));
      return st;
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
    firstPickCopy, holdCopy, holdHintCopy, slimBridge, mergeBridge, fromChildQuery, kidIdFromSearch, wantsA2hs,
    isIosBrowser, installBrowser, installPad, installShareAt, installCopy,
    installSteps, installStepIcon, installCoachMode, openIconLabel,
    defaultState, hashPin, ageMonths, stageFor, itemKey,
    isLangOn, isSectionOn, isItemOn,
    setLang, setSection, setItem, setBirth, setPin, checkPin,
    gameLeaf, groupItems,
    exportPayload, importPayload, load, save,
  };

  root.WilloSettings = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
