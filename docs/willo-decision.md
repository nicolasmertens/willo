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

Settings live on this device. Long-press 2s + 4-digit PIN. Mama/papa/klas on/off, sections, per-tile toggles, birth date (Lovevery month buckets), face photos, export/import.

No App Store. Sister gets a clean Add-to-Home-Screen. Delete icon = fresh unless they import the backup file.
