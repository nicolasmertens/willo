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

if (fails.length) {
  console.log("FAIL", fails.length, fails.join(" | "));
  process.exit(1);
}
console.log("PASS 9/9");
