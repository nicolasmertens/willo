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
ok("ios tab with child is form until continue", S.homeSurface(false, 0, { ua: ipadDesktop, maxTouchPoints: 5, hasChild: true }) === "child");
ok("ios tab after continue is install", S.homeSurface(false, 0, { ua: ipadDesktop, maxTouchPoints: 5, hasChild: true, showInstall: true }) === "install");
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
const criosPhone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.0.0 Mobile/15E148 Safari/604.1";
ok("iphone safari aim none", S.installShareAt({ ua: iphoneUa, width: 390, height: 844, maxTouchPoints: 5 }) === "none");
ok("iphone safari not bottom share", S.installShareAt({ ua: iphoneUa, width: 390, height: 844, maxTouchPoints: 5 }) !== "bottom-center");
ok("ipad safari share top", S.installShareAt({ ua: ipadDesktop, width: 1180, height: 820, maxTouchPoints: 5 }) === "top-right");
ok("ipad portrait still top", S.installShareAt({ ua: ipadDesktop, width: 820, height: 1180, maxTouchPoints: 5 }) === "top-right");
ok("chrome ipad share top", S.installShareAt({ ua: crios, width: 1180, height: 820, maxTouchPoints: 5 }) === "top-right");
ok("iphone chrome aim none", S.installShareAt({ ua: criosPhone, width: 390, height: 844, maxTouchPoints: 5 }) === "none");
ok("browser safari", S.installBrowser(iphoneUa) === "safari");
ok("browser chrome", S.installBrowser(crios) === "chrome");
ok("copy nl add", S.installCopy("nl-BE").add === "Zet op beginscherm");
ok("copy en add", S.installCopy("en-US").add === "Add to Home Screen");
ok("copy fr add", S.installCopy("fr-FR").add === "Sur l'écran d'accueil");
ok("copy en view more", S.installCopy("en").more === "View More");
ok("copy nl view more", S.installCopy("nl").more === "Toon meer");
ok("copy en through", S.installCopy("en").through === "Tap through these steps");
ok("copy nl through", S.installCopy("nl").through.indexOf("stappen") !== -1);
ok("copy en then", S.installCopy("en").then === "Then");
ok("copy en tap this not page menu", S.installCopy("en").pageMenu === "Tap this");
ok("copy en open name", S.installCopy("en").open.indexOf("{name}") !== -1);
ok("copy nl open name", S.installCopy("nl").open.indexOf("{name}") !== -1);
ok("copy en again", S.installCopy("en").again.toLowerCase().indexOf("again") !== -1);
ok("copy nl again", S.installCopy("nl").again.toLowerCase().indexOf("opnieuw") !== -1);

const iphoneSteps = S.installSteps({ ua: iphoneUa, width: 390, height: 844, maxTouchPoints: 5 }, "en", "Test2");
const ipadSteps = S.installSteps({ ua: ipadDesktop, width: 1180, height: 820, maxTouchPoints: 5 }, "en", "Ada");
const chromeSteps = S.installSteps({ ua: crios, width: 1180, height: 820, maxTouchPoints: 5 }, "en", "Ada");
ok("iphone extra menu step", iphoneSteps.some((s) => s.id === "page-menu"));
ok("iphone view more", iphoneSteps.some((s) => s.id === "view-more" && s.label === "View More"));
ok("iphone share after menu", iphoneSteps[0].id === "page-menu" && iphoneSteps[1].id === "share");
ok("iphone add label", iphoneSteps.some((s) => s.id === "add" && s.label === "Add to Home Screen"));
ok("iphone open last", iphoneSteps[iphoneSteps.length - 1].id === "open" && iphoneSteps[iphoneSteps.length - 1].label.indexOf("Test2") !== -1);
ok("iphone page menu uses lines icon", iphoneSteps[0].icon === "line-3-horizontal");
ok("iphone share uses sf share", iphoneSteps[1].icon === "square-and-arrow-up");
ok("iphone view more icon", iphoneSteps.some((s) => s.id === "view-more" && s.icon === "view-more"));
ok("iphone add uses plus square", iphoneSteps.some((s) => s.id === "add" && s.icon === "plus-square"));
ok("chrome menu uses ellipsis", chromeSteps[0].icon === "ellipsis");
ok("step icon helper share", S.installStepIcon("share") === "square-and-arrow-up");
ok("ipad first is share", ipadSteps[0].id === "share" && ipadSteps[0].label === "Share");
ok("ipad has view more", ipadSteps.some((s) => s.id === "view-more"));
ok("ipad no page menu", ipadSteps.every((s) => s.id !== "page-menu"));
ok("chrome first is menu", chromeSteps[0].id === "menu" && chromeSteps[0].label === "Menu");
ok("chrome no share step", chromeSteps.every((s) => s.id !== "share"));
ok("chrome no page menu", chromeSteps.every((s) => s.id !== "page-menu"));
ok("nl iphone view more", S.installSteps({ ua: iphoneUa, width: 390, height: 844, maxTouchPoints: 5 }, "nl", "Test2").some((s) => s.id === "view-more" && s.label === "Toon meer"));
ok("open icon en", S.openIconLabel("en", "Test2") === "Open Test2 from the Home Screen");
ok("open icon nl", S.openIconLabel("nl", "Test2").indexOf("Test2") !== -1 && S.openIconLabel("nl", "Test2").indexOf("beginscherm") !== -1);
ok("coach first steps", S.installCoachMode({}) === "steps");
ok("coach after hide open", S.installCoachMode({ leftAndReturned: true }) === "open");
ok("coach again is steps", S.installCoachMode({ leftAndReturned: true, forceSteps: true }) === "steps");
ok("coach standalone none", S.installCoachMode({ standalone: true, leftAndReturned: true }) === "none");

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
ok("hold copy nl 2s", S.holdCopy("nl").hint.indexOf("2") !== -1);
ok("hold copy en Home Screen", S.holdCopy("en").hint.indexOf("Home Screen") !== -1);
ok("hold copy en 2 seconds", S.holdCopy("en").hint.indexOf("2 seconds") !== -1);
ok("hold copy en settings", S.holdCopy("en").hint.indexOf("settings") !== -1);
ok("hold copy omits mama papa klas", ["mama", "papa", "klas"].every((w) => S.holdCopy("nl").hint.toLowerCase().indexOf(w) === -1));
ok("no first pick after one", S.homeChrome(1).firstPick === false);
ok("hold hint after one", S.homeChrome(1).holdHint === true);
ok("nav hides off langs", S.navVisibility({ langs: { mama: true, papa: false, klas: false } }).papa === false);
ok("nav shows on lang", S.navVisibility({ langs: { mama: true, papa: false, klas: false } }).mama === true);
ok("krokodil one group", S.groupItems("liedjes", [
  { pack: "papa", section: "liedjes", n: 1, title: "En de krokodil" },
]).length === 1);
ok("memory three packs one group", (() => {
  const g = S.groupItems("games", [
    { pack: "mama", section: "games", n: 1, title: "Mémoire", href: "/willo/mama/games/memory/" },
    { pack: "papa", section: "games", n: 1, title: "Memory", href: "/willo/papa/games/memory/" },
    { pack: "klas", section: "games", n: 1, title: "Memory", href: "/willo/klas/games/memory/" },
  ]);
  return g.length === 1 && g[0].items.length === 3 && g[0].title === "Memory";
})());
ok("hold hint lege", S.holdHintCopy("nl").indexOf("lege") !== -1);
ok("child query parses", (() => {
  const b = S.fromChildQuery("v=20&n=William&b=2024-09-24&f=1");
  return b && b.childName === "William" && b.birth === "2024-09-24" && b.childFace === true;
})());
ok("child query keeps extra a2hs k", (() => {
  const b = S.fromChildQuery("n=William&b=2024-09-24&f=1&k=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee&a2hs=1");
  return b && b.childName === "William";
})());
ok("kid id from search", S.kidIdFromSearch("n=W&k=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee") === "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
ok("kid id rejects junk", S.kidIdFromSearch("k=nope") === "");
ok("wants a2hs", S.wantsA2hs("a2hs=1&n=William") === true);
ok("wants a2hs false", S.wantsA2hs("n=William") === false);
ok("child query rejects junk", S.fromChildQuery("v=20") == null);
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

const { readFileSync, existsSync } = require("fs");
const { execFileSync } = require("child_process");
try {
  execFileSync("node", ["--check", join(root, "scripts/willo-settings-ui.js")], { stdio: "pipe" });
  ok("ui parses", true);
} catch (e) {
  ok("ui parses", false, String(e.stderr || e));
}
const ui = readFileSync(join(root, "scripts/willo-settings-ui.js"), "utf8");
ok("openUnlock no const mode shadow", !/function openUnlock\(\) \{\s*const mode = surfaceNow/.test(ui));
ok("openUnlock uses surface", /function openUnlock\(\) \{\s*const surface = surfaceNow/.test(ui));
ok("no blob manifest", ui.indexOf("man.href = URL.createObjectURL") === -1);
ok("no plus taal tile", ui.indexOf("Taal toevoegen") === -1);
ok("settings heading not mama papa klas", ui.indexOf("<h3>Mama, papa, klas</h3>") === -1);
ok("pin uses pointerup", ui.indexOf("function bindTap") !== -1 && ui.indexOf("pointerup") !== -1);
ok("pin telemetry", ui.indexOf("pin_tap") !== -1);
ok("continue never waits on SW ready", ui.indexOf("await navigator.serviceWorker.ready") === -1);
ok("continue does not persist share", ui.indexOf("sessionStorage.setItem(\"willo_show_install\"") === -1);
ok("continue is this load only", ui.indexOf("continuedThisLoad") !== -1);
ok("a2hs never data icon", ui.indexOf("href = await blobToData") === -1);
ok("a2hs probes worker png", ui.indexOf("function probeKid") !== -1);
ok("a2hs reloads with k", ui.indexOf("u.searchParams.set(\"a2hs\", \"1\")") !== -1);
ok("a2hs fill opaque", ui.indexOf("ctx.fillStyle = \"#fff7e6\"") !== -1);
ok("a2hs detaches manifest", S.springboardTags("William").detachManifest === true);
ok("a2hs title first name", S.springboardTags("William Mertens").title === "William");
ok("a2hs lists stock W path", S.springboardTags("Ada").stockIconPaths.indexOf("apple-touch-icon.png") !== -1);
ok("applySpringboard drops manifest", ui.indexOf("el.rel === \"manifest\"") !== -1);
ok("applySpringboard not stock png", ui.indexOf("icon180.href = \"apple-touch-icon.png") === -1);
ok("applySpringboard no kid-icon file link", ui.indexOf("kid-icon-180.png?v=") === -1);
ok("install hide heuristic", ui.indexOf("visibilitychange") !== -1 && ui.indexOf("pagehide") !== -1 && ui.indexOf("pageshow") !== -1);
ok("install again control", ui.indexOf("data-install-again") !== -1);
ok("install icon steps not numbers", ui.indexOf("data-step=") !== -1 && ui.indexOf("install-ico") !== -1 && ui.indexOf("install-n") === -1);
ok("install through copy in ui", ui.indexOf("copy.through") !== -1);
ok("install safari icon files", ui.indexOf("icons/safari/") !== -1);
ok("install no web share path", ui.indexOf("function paintInstall") !== -1 && !/function paintInstall[\s\S]{0,2500}navigator\.share/.test(ui));
ok("install drops iphone aim", ui.indexOf('at === "none" ? ""') !== -1);

const index = readFileSync(join(root, "index.html"), "utf8");
ok("index first paint no manifest", index.indexOf("href=\"manifest.json\"") === -1);
ok("index first paint no W touch icon", index.indexOf("href=\"apple-touch-icon.png\"") === -1);
ok("index v27 scripts", index.indexOf("scripts/willo-settings.js?v=27") !== -1);
ok("index v27 retry", index.indexOf("index.html?v=27") !== -1);
ok("index no bottom-center aim", index.indexOf("bottom-center") === -1);
ok("index none card css", index.indexOf('#install-card[data-at="none"]') !== -1);
ok("index has icon css", index.indexOf(".install-ico") !== -1 && index.indexOf(".install-through") !== -1);
ok("sf share png", existsSync(join(root, "icons/safari/square-and-arrow-up.png")));
ok("sf lines png", existsSync(join(root, "icons/safari/line-3-horizontal.png")));
ok("view more png", existsSync(join(root, "icons/safari/view-more.png")));
ok("plus square png", existsSync(join(root, "icons/safari/plus-square.png")));
ok("ellipsis png", existsSync(join(root, "icons/safari/ellipsis.png")));

console.log("checks: " + checks + "  fails: " + fails.length);
fails.forEach((f) => console.log("FAIL", f));
if (fails.length) process.exit(1);
console.log("PASS willo settings");
