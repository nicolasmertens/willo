#!/usr/bin/env node
/** WebKit (Safari engine) tap test for the A2HS "show steps again" button. Not Chrome. */
import { createRequire } from "module";
import { existsSync, readdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

function loadPlaywright() {
  const npx = join(homedir(), ".npm/_npx");
  if (!existsSync(npx)) throw new Error("no npx cache");
  for (const d of readdirSync(npx)) {
    const entry = join(npx, d, "node_modules/playwright/index.js");
    if (!existsSync(entry)) continue;
    try {
      return createRequire(entry)("playwright");
    } catch (e) {}
  }
  throw new Error("playwright module not found");
}

const { webkit, devices } = loadPlaywright();
const iphone = devices["iPhone 15"] || devices["iPhone 13"];
const url = process.env.WILLO_URL || "http://127.0.0.1:8765/index.html?a2hs=1&n=Test3&b=2024-08-20&f=1&v=28";

const fails = [];
function ok(name, cond, extra) {
  if (!cond) fails.push(name + (extra ? " " + extra : ""));
}

const browser = await webkit.launch({ headless: true });
const context = await browser.newContext({
  ...iphone,
  hasTouch: true,
  isMobile: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
});
await context.addInitScript(() => {
  try {
    localStorage.setItem("willo_settings_v2", JSON.stringify({
      childName: "Test3",
      birth: "2024-08-20",
      childFace: true,
      langs: { mama: false, papa: false, klas: false },
      sections: { boeken: true, games: true, liedjes: true, verhalen: true },
      items: {},
      pinHash: "",
    }));
    sessionStorage.setItem("willo_install_left", "1");
  } catch (e) {}
});
const page = await context.newPage();
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForSelector("#install-card:not([hidden])", { timeout: 8000 });

const again = page.locator("[data-install-again]");
ok("again visible", await again.isVisible());
const box = await again.boundingBox();
ok("again height >= 44", box && box.height >= 44, box ? String(box.height) : "no box");
ok("again width >= 200", box && box.width >= 200, box ? String(box.width) : "no box");

const hit = await page.evaluate(() => {
  const btn = document.querySelector("[data-install-again]");
  if (!btn) return { ok: false, reason: "missing" };
  const r = btn.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const top = document.elementFromPoint(x, y);
  return {
    ok: !!(top && (top === btn || btn.contains(top))),
    tag: top && top.tagName,
    cls: top && top.className,
    x: x,
    y: y,
  };
});
ok("elementFromPoint is the button", hit.ok, JSON.stringify(hit));

await again.tap();
await page.waitForTimeout(200);
const after = await page.evaluate(() => ({
  through: !!(document.querySelector(".install-through")),
  share: !!document.querySelector('[data-step="share"]'),
  againGone: !document.querySelector("[data-install-again]"),
  coach: document.getElementById("install-card") && document.getElementById("install-card").dataset.coach,
}));
ok("after tap shows steps", after.through && after.share, JSON.stringify(after));
ok("after tap leaves open coach", after.coach === "steps" || after.share, after.coach);

await browser.close();

if (fails.length) {
  console.log("FAIL", fails.length, fails.join(" | "));
  process.exit(1);
}
console.log("PASS willo again tap (webkit)");
