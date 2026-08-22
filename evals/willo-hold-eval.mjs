#!/usr/bin/env node
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const H = require(join(root, "scripts/willo-hold.js"));

const fails = [];
let checks = 0;
function ok(name, cond, extra) {
  checks += 1;
  if (!cond) fails.push(name + (extra ? " " + extra : ""));
}

ok("HOLD_MS is 2000", H.HOLD_MS === 2000);

ok("hold at 2000 without end", H.decide([
  { type: "start", t: 0, x: 10, y: 10 },
  { type: "tick", t: 2000 },
]) === "hold");

ok("safari cancel after hold still hold", H.decide([
  { type: "start", t: 0, x: 10, y: 10 },
  { type: "tick", t: 2000 },
  { type: "cancel", t: 2050 },
]) === "hold");

ok("no touchend still hold", H.decide([
  { type: "start", t: 0, x: 10, y: 10 },
  { type: "tick", t: 2000 },
]) === "hold");

ok("short tap", H.decide([
  { type: "start", t: 0, x: 10, y: 10 },
  { type: "end", t: 200 },
]) === "tap");

ok("too short", H.decide([
  { type: "start", t: 0, x: 10, y: 10 },
  { type: "end", t: 40 },
]) === "cancel");

ok("jitter 10px still hold", H.decide([
  { type: "start", t: 0, x: 10, y: 10 },
  { type: "move", t: 400, x: 18, y: 14 },
  { type: "tick", t: 2000 },
]) === "hold");

ok("big drift cancels", H.decide([
  { type: "start", t: 0, x: 10, y: 10 },
  { type: "move", t: 300, x: 80, y: 10 },
  { type: "tick", t: 2000 },
]) === "cancel");

ok("ios cancel before 2s keeps holding", H.decide([
  { type: "start", t: 0, x: 10, y: 10 },
  { type: "cancel", t: 500 },
]) === "holding");

ok("ios cancel then tick is hold", H.decide([
  { type: "start", t: 0, x: 10, y: 10 },
  { type: "cancel", t: 500 },
  { type: "tick", t: 2000 },
]) === "hold");

ok("tick 1999 still holding", H.decide([
  { type: "start", t: 0, x: 10, y: 10 },
  { type: "tick", t: 1999 },
]) === "holding");

const holdSrc = readFileSync(join(root, "scripts/willo-hold.js"), "utf8");
ok("attach comment ignore cancel", holdSrc.indexOf("not a lift") !== -1);
ok("attach has pointerdown", holdSrc.indexOf("pointerdown") !== -1);
ok("attach has mousedown", holdSrc.indexOf("mousedown") !== -1);
ok("cancel listener is ignoreCancel", holdSrc.indexOf('addEventListener("touchcancel", ignoreCancel') !== -1 && holdSrc.indexOf('addEventListener("pointercancel", ignoreCancel') !== -1);
ok("attach does not wipe on touchcancel", !/addEventListener\("touchcancel"[\s\S]{0,80}wipe\(\)/.test(holdSrc));
ok("attach does not wipe on pointercancel", !/addEventListener\("pointercancel"[\s\S]{0,80}wipe\(\)/.test(holdSrc));

function fakeEl() {
  const listeners = {};
  return {
    listeners,
    addEventListener(type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    fire(type, ev) {
      (listeners[type] || []).forEach((fn) => fn(ev));
    },
  };
}

function withFakeTimers(fn) {
  const origSet = setTimeout;
  const origClear = clearTimeout;
  const jobs = [];
  let id = 0;
  globalThis.setTimeout = (cb, ms) => {
    const token = ++id;
    jobs.push({ token, cb, ms });
    return token;
  };
  globalThis.clearTimeout = (token) => {
    const i = jobs.findIndex((j) => j.token === token);
    if (i !== -1) jobs.splice(i, 1);
  };
  try {
    return fn({
      jobs,
      flush(ms) {
        jobs.filter((j) => j.ms === ms).slice().forEach((j) => j.cb());
      },
    });
  } finally {
    globalThis.setTimeout = origSet;
    globalThis.clearTimeout = origClear;
  }
}

const hadPointer = globalThis.PointerEvent;
delete globalThis.PointerEvent;
try {
  withFakeTimers(({ jobs, flush }) => {
    const el = fakeEl();
    let n = 0;
    H.attach(el, { onHold() { n += 1; } });
    el.fire("touchstart", {
      touches: { length: 1 },
      changedTouches: [{ clientX: 10, clientY: 10 }],
      preventDefault() {},
    });
    el.fire("touchcancel", {});
    ok("timer still armed after ios cancel", jobs.some((j) => j.ms === 2000));
    flush(2000);
    ok("attach cancel before 2s still hold", n === 1);
  });

  withFakeTimers(({ jobs, flush }) => {
    const el = fakeEl();
    let n = 0;
    H.attach(el, { onHold() { n += 1; } });
    el.fire("mousedown", { button: 0, clientX: 10, clientY: 10, preventDefault() {} });
    el.fire("mouseup", { button: 0, preventDefault() {} });
    ok("early mouseup clears timer", !jobs.some((j) => j.ms === 2000));
    flush(2000);
    ok("early mouseup is not hold", n === 0);
  });
} finally {
  if (hadPointer) globalThis.PointerEvent = hadPointer;
}

globalThis.PointerEvent = function PointerEvent() {};
try {
  withFakeTimers(({ jobs, flush }) => {
    const el = fakeEl();
    let n = 0;
    H.attach(el, { onHold() { n += 1; } });
    el.fire("pointerdown", { isPrimary: true, pointerId: 1, clientX: 10, clientY: 10, preventDefault() {} });
    el.fire("pointercancel", { pointerId: 1 });
    ok("pointer timer still armed after cancel", jobs.some((j) => j.ms === 2000));
    flush(2000);
    ok("pointer cancel before 2s still hold", n === 1);
  });
} finally {
  if (hadPointer) globalThis.PointerEvent = hadPointer;
  else delete globalThis.PointerEvent;
}

const S = require(join(root, "scripts/willo-settings.js"));
globalThis.WilloSettings = S;
const N = require(join(root, "scripts/willo-nav.js"));
function fakeBtn(href) {
  return { getAttribute(name) { return name === "data-href" ? href : ""; } };
}
ok("nav lang from href", N.langFromBtn(fakeBtn("/willo/mama/")) === "mama");
ok("nav bar hides two", (() => {
  const tiles = [
    { getAttribute(n) { return n === "data-href" ? "/willo/mama/" : ""; }, style: {} },
    { getAttribute(n) { return n === "data-href" ? "/willo/papa/" : ""; }, style: {} },
    { getAttribute(n) { return n === "data-href" ? "/willo/klas/" : ""; }, style: {} },
  ];
  const bar = {
    querySelectorAll() { return tiles; },
    querySelector(sel) { return sel === ".stopbtn" ? {} : null; },
    style: {},
  };
  const r = N.applyBar(bar, { langs: { mama: true, papa: false, klas: false } });
  return r.shown === 1 && tiles[1].style.display === "none" && tiles[2].style.display === "none" && tiles[0].style.display === "";
})());

const ui = readFileSync(join(root, "scripts/willo-settings-ui.js"), "utf8");
const paint = ui.slice(ui.indexOf("function paintHold"), ui.indexOf("function openAddLang"));
ok("paintHold no click shortcut", paint.indexOf('addEventListener("click"') === -1);
ok("paintHold no openUnlock on click", paint.indexOf("openUnlock") !== -1 && !/addEventListener\("click"[\s\S]*openUnlock/.test(paint));
ok("paintHold no hold-blank", paint.indexOf("hold-blank") === -1 && paint.indexOf("hold-pad") === -1);
ok("paintHold attaches body", paint.indexOf("document.body") !== -1);
ok("home attaches home-blank", /WilloHold\.attach\(blank/.test(ui));
ok("tiles do not hold-open settings", !/querySelectorAll\("button\.tile"\)[\s\S]{0,900}onHold\(\) \{ openUnlock/.test(ui));

const index = readFileSync(join(root, "index.html"), "utf8");
ok("index drops hold-blank css", index.indexOf("#hold-card .hold-blank") === -1);
ok("index hold touch-action none", index.indexOf('body[data-stage="hold"]') !== -1 && index.indexOf("touch-action: none") !== -1);

if (fails.length) {
  console.log("FAIL", fails.length + "/" + checks, fails.join(" | "));
  process.exit(1);
}
console.log("PASS " + checks + "/" + checks);
