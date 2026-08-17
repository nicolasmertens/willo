#!/usr/bin/env node
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const S = require(join(root, "scripts/willo-settings.js"));

const fails = [];
function ok(name, cond, extra) {
  if (!cond) fails.push(name + (extra ? " " + extra : ""));
}

const now = Date.parse("2026-08-17T12:00:00");
ok("age william 22", S.ageMonths("2024-09-24", now) === 22);
ok("age 0-2 stage", S.stageFor(1).id === "0-2");
ok("age 22-24 stage", S.stageFor(22).id === "22-24");
ok("age 23-24", S.stageFor(23).id === "22-24");

let st = S.defaultState();
ok("default all langs", S.LANGS.every((l) => S.isLangOn(st, l)));
ok("cannot kill last lang", S.setLang(S.setLang(S.setLang(st, "mama", false).state, "klas", false).state, "papa", false).ok === false);

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
ok("import empty langs repaired", (() => {
  const bad = S.exportPayload({ ...S.defaultState(), langs: { mama: false, papa: false, klas: false } });
  const r = S.importPayload(bad);
  return r.ok && S.LANGS.some((l) => r.state.langs[l]);
})());

console.log("checks: 23  fails: " + fails.length);
fails.forEach((f) => console.log("FAIL", f));
if (fails.length) process.exit(1);
console.log("PASS willo settings");
