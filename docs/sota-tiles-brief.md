# Brief: SOTA tiles for William (iPad PWA)

Date: 2026-08-16
Surface: live tile 154px, CSS radius 22px, cream page `#fff7e6`. Liedjes section green wash. Design for the TAP, not Finder.

## Locks Nick already made
- He looks for **a shark**, not Pinkfong merch.
- No CSS mock drawings as the product.
- Playful overflow: trunk / fin / snout go **over the CSS tile**, not a painted iOS bezel inside the jpg.
- Books: **integrity first**. The real cover he already owns. Cleanup only (crop, straighten, kill table). Do not redraw Marjolein Pottie or Clara Suetens.
- Memory vs Geluiden currently read as the same 3x3 animal-face poster. They must become two different jobs at a glance.

## Three tracks (do not mix files)

### A — Liedjes overflow + house shark
Files: `templates/taal.html` (CSS + tile markup only as needed), `papa/liedjes/icons/06.jpg` (and png if needed), `tracks/papa-liedjes.json` irev bump.
Lead look: full-bleed object, one subject, no text. Shark is a shark. Fin actually leaves the rounded tile via CSS `overflow: visible` + transparent art or a larger img over a `.tile-face`.
Do not restyle books or games.

### B — Games heroes
Files only: `klas/games/hero-memory.jpg`, `klas/games/hero-sounds.jpg`.
Same cute animal language he already knows. Different **job**:
- Memory = cards / pairs / flip.
- Geluiden = sound (one animal singing, rings, mouth open). Not another 3x3 head grid.
No text in the art. Label stays CSS ("Memory" / "Geluiden").

### C — Book covers
Files only: `eendjes/cover-tile.jpg`, `huppel/cover-tile.jpg`.
Photograph of the physical book. Straighten, square crop, fill the tile, drop brown table and empty cream. Keep title lettering, duck kids, rabbit at piano exactly. No Imagine redraw of the cover.

## Quality bar
Imagine: several takes, keep only the one that reads at 154px. Kill text, watermarks, extra hands, icon-in-icon frames.
