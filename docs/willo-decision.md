---
type: decision-lock
status: accepted
showpiece: none
wiki: none yet
---

# Willo (liedjes PWA)

Brand: **Willo**. Springboard name + icon = this child (not a stock Willo/William). Default repo icon is a generic W.

Public URL: `https://nicolasmertens.github.io/willo/`. Languages stay `/mama/`, `/papa/`, `/klas/`.

Order: (1) name + birth + child photo (2) then Add to Home Screen (3) open from the icon onto the Home Screen. Hold 2s on empty space (not a tile) opens settings. Safari always starts at the child form, even if William is leftover. Share is only after Continue on this page load. Fresh standalone with 0 packs is the empty Home Screen plus the hold hint, not a SETTINGS lecture card. No + Taal tile. Extra faces only in settings.

Springboard icon: POST the 180 PNG to the liedjes-logger worker `/kid` (KV, 24h TTL). Probe GET until it is image/png. Then reload with `k=` + `a2hs=1` so the first HTML paint has `<link rel="apple-touch-icon">` at that URL (iOS ignores data-URLs and late JS). On first standalone open, DELETE `/kid/:id`. If upload fails, stay on the child form. Never point apple-touch-icon at a data URL.

Hold 2s on **blank space** (not a tile) opens settings. PIN first.

Settings (iOS drill-in): Kind → **Wat speelt hij?** (Spelen / Liedjes / …) → second page with **Alles in Spelen** plus each game. Memory is three switches (mama/papa/klas), not one. A papa-only song is one row. **Wie is erbij?** is faces on/off, not first-run, not “Talen”. Home with 0 packs = empty hold coach. Packs on = face tiles only (no Mama/Papa/Klas words) plus a hold gutter.

No App Store. Sister gets a clean Add-to-Home-Screen. Delete icon = fresh unless they import the backup file.

## A2HS coach (2026-08-22)

iOS cannot programmatically Add to Home Screen, and cannot auto-open the new standalone icon from the Safari tab. `beforeinstallprompt` is Chromium, not iOS Safari. `navigator.standalone` / `display-mode: standalone` only becomes true after they launch from the icon.

Web Share (`navigator.share({ url })`) is not the install path. Apple documents A2HS only on Safari’s own Share sheet; WebKit requires a WKWebView activity item plus the web-browser entitlement (https://webkit.org/blog/13878/). A page-level share of a URL does not include that, so A2HS does not show. Do not wire an in-card Share button.

iPhone compact Safari (Nick dogfood): toolbar is back / tabs / URL pill / reload. Share is not there. Tap chrome → page menu (Ask Siri, Translate, Share…). Apple iOS 26: “Tap the More button, then tap Share” unless Tabs layout is Bottom or Top (https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios). After Share, Add to Home Screen is often behind View More. Coach lists: Page menu, Share, View More, Add to Home Screen, then open the named icon. No gold aim glyph at the URL pill (that was `bottom-center`).

iPad Safari: Share is still first (top-right aim). View More is included as a hint; Apple iPadOS 26 also has Share then More then Add to Home Screen. Not verified: iPad Chrome.

After the install card has been shown, hide (share sheet / home / app switch) then show again while still a Safari tab → switch copy to “Open {name} from the Home Screen”. Optional “show me how to add it again”. Standalone stays hold/home. Heuristic only; we cannot know they added the icon.
