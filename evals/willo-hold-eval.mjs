#!/usr/bin/env node
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const H = require(join(root, "scripts/willo-hold.js"));

const fails = [];
function ok(name, cond, extra) {
  if (!cond) fails.push(name + (extra ? " " + extra : ""));
}

ok("hold at 1800 without end", H.decide([
  { type: "start", t: 0, x: 10, y: 10 },
  { type: "tick", t: 1800 },
]) === "hold");

ok("safari cancel after hold still hold", H.decide([
  { type: "start", t: 0, x: 10, y: 10 },
  { type: "tick", t: 1800 },
  { type: "cancel", t: 1850 },
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
  { type: "tick", t: 1800 },
]) === "hold");

ok("big drift cancels", H.decide([
  { type: "start", t: 0, x: 10, y: 10 },
  { type: "move", t: 300, x: 80, y: 10 },
  { type: "tick", t: 1800 },
]) === "cancel");

ok("cancel before 2s is cancel", H.decide([
  { type: "start", t: 0, x: 10, y: 10 },
  { type: "cancel", t: 500 },
]) === "cancel");

ok("tick 1799 still holding", H.decide([
  { type: "start", t: 0, x: 10, y: 10 },
  { type: "tick", t: 1799 },
]) === "holding");

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

if (fails.length) {
  console.log("FAIL", fails.length, fails.join(" | "));
  process.exit(1);
}
console.log("PASS 11/11");
