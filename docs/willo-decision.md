---
type: decision-lock
status: accepted
showpiece: none
wiki: none yet
---

# Willo (liedjes PWA)

Brand: **Willo**. Springboard name + icon = this child (not a stock Willo/William). Default repo icon is a generic W.

Public URL: `https://nicolasmertens.github.io/willo/`. Languages stay `/mama/`, `/papa/`, `/klas/`.

Order: (1) name + birth + child photo (2) then Add to Home Screen (3) open from the icon, then hold 2s for settings. iOS tab after child is the share coach. Standalone with no mama/papa/klas is the hold coach. No + Taal tile. Extra faces only in settings.

Springboard icon: POST the 180 PNG to the liedjes-logger worker `/kid` (KV, 24h TTL). Point `apple-touch-icon` at that public URL. On first standalone open, DELETE `/kid/:id`. Fallback if the upload fails: data-URL only.

Hold 2s on **blank space** (not a tile) opens settings. PIN first.

Settings (iOS drill-in): Kind → **Wat speelt hij?** (Spelen / Liedjes / …) → second page with **Alles in Spelen** plus each game. Memory is three switches (mama/papa/klas), not one. A papa-only song is one row. **Wie is erbij?** is faces on/off, not first-run, not “Talen”. Home with 0 packs = empty hold coach. Packs on = face tiles only (no Mama/Papa/Klas words) plus a hold gutter.

No App Store. Sister gets a clean Add-to-Home-Screen. Delete icon = fresh unless they import the backup file.
