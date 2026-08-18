#!/usr/bin/env node
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const S = require(join(root, "scripts/willo-settings.js"));

const fails = [];
let checks = 0;
function ok(name, cond, extra) {
  checks += 1;
  if (!cond) fails.push(name + (extra ? " " + extra : ""));
}

const ipadDesktop = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15";
const macSafari = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15";
ok("iphone ua", S.isIosBrowser({ ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" }));
ok("old ipad ua", S.isIosBrowser({ ua: "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)" }));
ok("ipad desktop ua + 5 points", S.isIosBrowser({ ua: ipadDesktop, platform: "", maxTouchPoints: 5 }));
ok("ipad desktop ua + coarse, 0 points", S.isIosBrowser({ ua: ipadDesktop, platform: "", maxTouchPoints: 0, coarse: true }));
ok("mac safari not ios", S.isIosBrowser({ ua: macSafari, platform: "MacIntel", maxTouchPoints: 0, coarse: false }) === false);
ok("no child is child form", S.homeSurface(false, 0, { ua: ipadDesktop, maxTouchPoints: 5 }) === "child");
ok("ios tab after child is install", S.homeSurface(false, 0, { ua: ipadDesktop, maxTouchPoints: 5, hasChild: true }) === "install");
ok("pwa empty after child is hold", S.homeSurface(true, 0, { ua: ipadDesktop, maxTouchPoints: 5, hasChild: true }) === "hold");
ok("pwa with lang is home", S.homeSurface(true, 1, { ua: ipadDesktop, maxTouchPoints: 5, hasChild: true }) === "home");
ok("desktop after child is hold", S.homeSurface(false, 0, { ua: macSafari, maxTouchPoints: 0, hasChild: true }) === "hold");
ok("springboard first name", S.springboardName("William Mertens") === "William");
ok("hasChild needs face", S.hasChild({ childName: "Ada", birth: "2024-09-24", childFace: false }) === false);
ok("hasChild ok", S.hasChild({ childName: "Ada", birth: "2024-09-24", childFace: true }));
ok("setChild ok", S.setChild(S.defaultState(), "Ada", "2024-09-24").ok);
ok("child copy nl", S.childCopy("nl").photo.indexOf("Foto") !== -1);
ok("child copy pick", !!S.childCopy("en").pick);

const iphoneUa = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const crios = "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.0.0 Mobile/15E148 Safari/604.1";
ok("iphone safari share bottom", S.installShareAt({ ua: iphoneUa, width: 390, height: 844, maxTouchPoints: 5 }) === "bottom-center");
ok("ipad safari share top", S.installShareAt({ ua: ipadDesktop, width: 1180, height: 820, maxTouchPoints: 5 }) === "top-right");
ok("ipad portrait still top", S.installShareAt({ ua: ipadDesktop, width: 820, height: 1180, maxTouchPoints: 5 }) === "top-right");
ok("chrome ipad share top", S.installShareAt({ ua: crios, width: 1180, height: 820, maxTouchPoints: 5 }) === "top-right");
ok("browser safari", S.installBrowser(iphoneUa) === "safari");
ok("browser chrome", S.installBrowser(crios) === "chrome");
ok("copy nl add", S.installCopy("nl-BE").add === "Zet op beginscherm");
ok("copy en add", S.installCopy("en-US").add === "Add to Home Screen");
ok("copy fr add", S.installCopy("fr-FR").add === "Sur l'écran d'accueil");

const now = Date.parse("2026-08-17T12:00:00");
ok("age william 22", S.ageMonths("2024-09-24", now) === 22);
ok("age 0-2 stage", S.stageFor(1).id === "0-2");
ok("age 22-24 stage", S.stageFor(22).id === "22-24");
ok("age 23-24", S.stageFor(23).id === "22-24");

let st = S.defaultState();
ok("default no langs", S.LANGS.every((l) => !S.isLangOn(st, l)));
ok("can add papa", S.setLang(st, "papa", true).ok && S.isLangOn(S.setLang(st, "papa", true).state, "papa"));
ok("can empty home", S.setLang(S.setLang(st, "papa", true).state, "papa", false).ok);

st = S.setLang(S.setLang(S.defaultState(), "papa", true).state, "klas", true).state;
st = S.setLang(st, "klas", false).state;
ok("klas off", !S.isLangOn(st, "klas") && S.isLangOn(st, "papa"));

st = S.setSection(st, "liedjes", false).state;
ok("songs off", !S.isSectionOn(st, "liedjes"));
ok("books still on", S.isSectionOn(st, "boeken"));
st = S.setSection(st, "liedjes", true).state;

const groot = { n: 4, title: "Big Small", _section: "games", fromMonth: 30 };
const bus = { n: 2, title: "Bus", _section: "liedjes", fromMonth: 12 };
st = S.setBirth(st, "2024-09-24").state;
ok("birth set", st.birth === "2024-09-24");
ok("bus on at 22mo", S.isItemOn(st, bus, "papa") === true);
ok("groot off at 22mo", S.isItemOn(st, groot, "klas") === false);
ok("groot off before birth set", S.isItemOn(S.defaultState(), groot, "klas") === false);

st = S.setItem(st, "klas", "games", 4, true).state;
ok("parent can force groot on", S.isItemOn(st, groot, "klas") === true);

st = S.setSection(st, "games", false).state;
ok("section off hides item", S.isItemOn(st, groot, "klas") === false);

let pin = S.setPin(S.defaultState(), "1234");
ok("pin set", pin.ok && pin.state.pinHash);
ok("pin reject", S.checkPin(pin.state, "0000").ok === false);
ok("pin accept", S.checkPin(pin.state, "1234").ok === true);
ok("pin not 4", S.setPin(st, "12").ok === false);

const packed = S.exportPayload(pin.state, { mama: "data:image/png;base64,xx" });
ok("export app", packed.app === "willo");
const back = S.importPayload(JSON.stringify(packed));
ok("import ok", back.ok && back.state.pinHash === pin.state.pinHash);
ok("import photo", back.photos.mama === "data:image/png;base64,xx");
ok("import garbage", S.importPayload("nope").ok === false);
ok("import empty langs stay empty", (() => {
  const bad = S.exportPayload({ ...S.defaultState(), langs: { mama: false, papa: false, klas: false } });
  const r = S.importPayload(bad);
  return r.ok && S.LANGS.every((l) => !r.state.langs[l]);
})());

ok("no plus tile", S.homeChrome(0).showPlus === false);
ok("no first pick when empty", S.homeChrome(0).firstPick === false);
ok("hold coach when empty", S.homeChrome(0).holdCoach === true);
ok("hold copy nl", S.holdCopy("nl").title.indexOf("2") !== -1);
ok("no first pick after one", S.homeChrome(1).firstPick === false);
ok("hold hint after one", S.homeChrome(1).holdHint === true);
ok("nav hides off langs", S.navVisibility({ langs: { mama: true, papa: false, klas: false } }).papa === false);
ok("nav shows on lang", S.navVisibility({ langs: { mama: true, papa: false, klas: false } }).mama === true);
ok("merge bridge fills child", S.hasChild(S.mergeBridge(S.defaultState(), { childName: "Ada", birth: "2024-09-24", childFace: true })));
ok("merge will not wipe existing", (() => {
  const have = S.mergeBridge(
    { ...S.defaultState(), childName: "Ada", birth: "2024-09-24", childFace: true },
    { childName: "Other", birth: "2020-01-01", childFace: true }
  );
  return have.childName === "Ada";
})());
ok("first pick copy not taal", S.firstPickCopy("nl").title.indexOf("Taal") === -1);
ok("slim bridge has langs", !!S.slimBridge(S.defaultState()).langs);

const { readFileSync } = require("fs");
const ui = readFileSync(join(root, "scripts/willo-settings-ui.js"), "utf8");
ok("openUnlock no const mode shadow", !/function openUnlock\(\) \{\s*const mode = surfaceNow/.test(ui));
ok("openUnlock uses surface", /function openUnlock\(\) \{\s*const surface = surfaceNow/.test(ui));
ok("no blob manifest", ui.indexOf("man.href = URL.createObjectURL") === -1);
ok("no plus taal tile", ui.indexOf("Taal toevoegen") === -1);
ok("a2hs detaches manifest", S.springboardTags("William").detachManifest === true);
ok("a2hs title first name", S.springboardTags("William Mertens").title === "William");
ok("a2hs lists stock W path", S.springboardTags("Ada").stockIconPaths.indexOf("apple-touch-icon.png") !== -1);
ok("applySpringboard drops manifest", ui.indexOf("el.rel === \"manifest\"") !== -1);
ok("applySpringboard not stock png", ui.indexOf("icon180.href = \"apple-touch-icon.png") === -1);
ok("applySpringboard no kid-icon file link", ui.indexOf("kid-icon-180.png?v=") === -1);

const index = readFileSync(join(root, "index.html"), "utf8");
ok("index first paint no manifest", index.indexOf("href=\"manifest.json\"") === -1);
ok("index first paint no W touch icon", index.indexOf("href=\"apple-touch-icon.png\"") === -1);

console.log("checks: " + checks + "  fails: " + fails.length);
fails.forEach((f) => console.log("FAIL", f));
if (fails.length) process.exit(1);
console.log("PASS willo settings");
