#!/usr/bin/env node
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const fails = [];
let checks = 0;
function ok(name, cond, extra) {
  checks += 1;
  if (!cond) fails.push(name + (extra ? " " + extra : ""));
}

const kidPath = join(root, "worker/src/kid.js");
const src = readFileSync(kidPath, "utf8");
const { parseKidId, isPng, kidRoute } = await import(join(root, "worker/src/kid.js"));

ok("parse uuid png", parseKidId("/kid/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png") === "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
ok("parse uuid bare", parseKidId("/kid/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee") === "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
ok("reject short", parseKidId("/kid/nope") === "");
ok("reject other", parseKidId("/log") === "");
ok("route post", kidRoute("POST", "/kid").op === "put");
ok("route get", kidRoute("GET", "/kid/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png").op === "get");
ok("route del", kidRoute("DELETE", "/kid/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee").op === "del");
ok("png magic", isPng(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1])));
ok("not png", isPng(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8])) === false);
ok("ttl 24h", src.indexOf("24 * 60 * 60") !== -1);

const ui = readFileSync(join(root, "scripts/willo-settings-ui.js"), "utf8");
ok("ui posts kid", ui.indexOf('KID_API + "/kid"') !== -1);
ok("ui deletes on standalone", ui.indexOf("if (isStandalone()) forgetKidIcon()") !== -1);
ok("ui hold card", ui.indexOf("paintHold") !== -1);
ok("ui reset query", ui.indexOf("get(\"reset\") === \"1\"") !== -1);
ok("ui wipe settings key", ui.indexOf("localStorage.removeItem(S.KEY)") !== -1);
const index = readFileSync(join(root, "index.html"), "utf8");
ok("index inline reset", index.indexOf("willo_settings_v2") !== -1 && index.indexOf("get(\"reset\") !== \"1\"") !== -1);
ok("index sw no http cache", index.indexOf("updateViaCache: \"none\"") !== -1);
const sw = readFileSync(join(root, "sw.js"), "utf8");
ok("sw scripts network first", sw.indexOf("isScript") !== -1 && sw.indexOf("cache: \"no-store\"") !== -1);

if (fails.length) {
  console.log("FAIL", fails.length, fails.join(" | "));
  process.exit(1);
}
console.log("checks: " + checks + "  fails: 0");
console.log("PASS willo kid");
