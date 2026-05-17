# Liedjes app — multi-taal foto-router + Liedjes/Verhalen/Boeken per taal

**Date:** 2026-05-17
**Repo:** `nicolasmertens/liedjes`
**Author:** Nick (design captured by Claude)
**Target user:** William (born 2024-09-24, ~20 months old at time of writing)

---

## Why

William is op een leeftijd waar YouTube-video's (CoComelon, Super Simple Songs,
Blippi) hyperstimulerend werken — snel-snijdende beelden, oververzadigde kleuren,
constante saliency-shifts. De peer-reviewed evidence dat dit "schadelijk" is, is
dun, maar klinici en ouders rapporteren regulatie-issues en intolerantie voor
trager tempo bij chronische blootstelling. Tegelijk is muziek/liedjes zelf
(rijm, herhaling, melodie) **netto positief** voor fonologisch bewustzijn en
woordenschat.

De huidige app (`/eendjes/` Standaard NL-boek + `/rhymes/` EN nursery rhymes)
heeft de video al gestript. Deze update voegt twee dingen toe:

1. **Drie talen** (FR / VL / EN), gekozen via foto van mama / papa / klas — een
   20-maand-oude kent geen vlagjes maar herkent gezichten. Past bij het
   Brusselse FR-mama + Antwerpse VL-papa + NY-EN-daycare gezin.
2. **Zachtere playback-UX**: bij tap op een liedje opent full-screen één
   stilstaand beeld (cover) + audio + tap-anywhere-to-stop. Geen tegel-grid op
   de achtergrond, geen pulserende animatie tijdens spelen.

---

## Wat wel & wat niet (scope)

**In scope v1:**
- Nieuwe home (3 foto-tiles)
- Drie taal-landings (`/mama/`, `/papa/`, `/klas/`) elk met 3 categorie-tiles
- Vlaamse + Franse `/liedjes/` grids (nieuwe content uit YouTube)
- Uitbreiding van EN `/rhymes/` met de 5-7 nieuwe SSS-liedjes Nick aanleverde
- Eén verhaal per taal (klassieker)
- Full-screen still-image playback-modus, geldt voor álle nieuwe liedjes-grids
  én voor de bestaande `/rhymes/`/`/eendjes/`
- Cirkel-foto-hoek-knop op elke sub-pagina (terug naar home)

**Out of scope v1 (later):**
- Een tweede boek per taal (alleen 1 boek-tile per taal in v1)
- Meer dan 2 verhalen per taal
- Telemetrie-aggregatie naar dashboard (huidige Cloudflare Worker blijft loggen,
  geen extra views)
- Auto-discovery van nieuwe YouTube-liedjes
- Migratie van `/eendjes/` of `/rhymes/` URLs (blijven op huidige paden om
  bestaande sessies + Worker-logs niet te breken)

---

## Architectuur

### URL-structuur

```
/                          Home: 3 foto-tiles [mama] [papa] [klas]
                           Geen service worker. Geen telemetrie.

/mama/                     FR landing: 3 categorie-tiles
  /mama/boeken/            FR-boeken grid (v1: lege grid + "Binnenkort" tekst)
  /mama/liedjes/           FR-liedjes grid (NIEUW, YouTube-stripped)
  /mama/verhalen/          FR-verhalen grid (Trois Petits Cochons + Petit Chaperon Rouge)

/papa/                     VL landing: 3 categorie-tiles
  /papa/boeken/            VL-boeken grid. 1 tile = "Alle Eendjes" → /eendjes/
  /papa/liedjes/           VL-liedjes grid (NIEUW)
  /papa/verhalen/          VL-verhalen grid (Drie Biggetjes + Roodkapje)

/klas/                     EN landing: 3 categorie-tiles (v1: tile zonder klasfoto = tekst-placeholder)
  /klas/boeken/            EN-boeken grid (v1: lege grid + "Binnenkort" tekst)
  /klas/liedjes/           Redirect → /rhymes/ (canonical blijft /rhymes/)
  /klas/verhalen/          EN-verhalen grid (Three Little Pigs + Little Red Riding Hood)

/eendjes/                  Ongewijzigd. Gelinkt vanuit /papa/boeken/.
/rhymes/                   Ongewijzigd qua URL. Inhoud uitgebreid met 5-7
                           nieuwe SSS-liedjes. Playback-UX vervangen door
                           full-screen still.
```

### Tap-pad

- Een liedje spelen: `Home → taal → liedjes → 🎵` = 3 taps eerste keer, 1 tap
  voor herhalingen (William blijft in de liedjes-grid).
- Naar andere taal: tap foto-cirkel-hoek = terug naar home (1 tap), tap nieuwe
  foto (1 tap), tap categorie (1 tap), tap liedje (1 tap) = 4 taps.
- Bestaande `/eendjes/` flow: `Home → papa → boeken → Alle Eendjes → 🎵` = 4
  taps eerste keer (één meer dan voor de update). Acceptabel, want het boek
  blijft een aparte ervaring met covers per liedje.

### Foto-cirkel hoek-knop

Op elke pagina onder een taal (`/mama/`, `/papa/liedjes/`, etc.):
- **Rechtsboven**: ronde knop, 64×64 px, bevat dezelfde foto als op de
  home-tile (mama / papa / klas). Pad: `position: fixed; top: env(safe-area-inset-top, 12px); right: 12px;` zodat de notch op iPhone niets afdekt.
- Tap = `window.location = "/"` (naar home).
- Geen "back" pijl, geen tekst — alleen het gezicht, want William herkent dat
  visueel.
- Op de **landing** (`/papa/`) is de cirkel-knop ook aanwezig en doet hetzelfde
  (terug naar home). Consistent gedrag betekent één leerregel: "tap gezicht =
  ga weg".

### Full-screen still playback-modus

Geldt voor alle liedjes-grids (mama/papa/klas + bestaande /rhymes/ + /eendjes/).
Bij tap op een liedje-tile:

1. Tile-grid fadet weg (200ms).
2. Cover-image van dat liedje wordt full-screen getoond, `object-fit: contain`,
   gecentreerd, zwarte achtergrond.
3. Audio start (huidige pipeline: HTMLAudioElement, prefetched mp3).
4. Rechtsboven blijft de foto-cirkel-hoek-knop staan (terug naar home + stop).
5. Een tap *anywhere* op het scherm = stop audio + fade terug naar grid (200ms).
6. Bij natural end van het liedje: same — fade terug naar grid.

Geen pulserende animatie, geen progress bar, geen play-icoon. Alleen één beeld
en geluid. Dit is de "zachtere variant" die Nick beschreef.

### Telemetrie

Bestaand systeem blijft werken:
- Per-grid: touch lifecycle events + audio events → buffer → flush naar
  Cloudflare Worker → JSONL in `logs/<date>/`.
- Nieuwe grids (`/mama/liedjes/`, `/papa/liedjes/`, etc.) erven dezelfde
  `index.html` template inclusief telemetrie-code.
- Worker accepteert al alle paths onder `nicolasmertens.github.io/liedjes/`.
- `_app_version` veld in events bumpen naar `v2-multilang` zodat analyses
  pre/post-update kunnen splitten.

---

## Componenten

### Shared template

Eén HTML-template `templates/grid.html` (build-step of copy-paste) voor alle
liedjes/verhalen/boeken grids. Verschillen per pagina:

- `LANG`: `nl` | `fr` | `en` (bepaalt `<html lang>`)
- `TITLE`: "Liedjes" / "Verhalen" / "Boeken"
- `PARENT_PHOTO`: pad naar mama/papa/klas foto voor de hoek-knop
- `TRACKS`: JSON array van `{n, title, mp3, cover, popularity_seed}`

De huidige `/rhymes/index.html` is bijna deze template — we extraheren de
hardcoded parts naar variabelen en hergebruiken.

### Build/render

**Gekozen: optie 1 — Python `render.py` script** (Nick liet de keuze aan
implementatie over).

Eén script in repo-root dat:
- `templates/grid.html` (één canonieke template) leest
- `tracks/<lang>-<category>.json` (één per grid-pagina) leest
- Schrijft naar `<lang>/<category>/index.html`
- Schrijft een matched `<lang>/<category>/service-worker.js`

Geactiveerd handmatig vóór commit (`python render.py`). Geen CI/CD
build-pipeline — Nick draait het lokaal en pusht de gerenderde HTML mee.

Reden voor keuze boven copy-paste: we voegen 9+ grid-paginas toe en de
playback-UX, foto-cirkel-knop, en SW-prefetch-logica moeten 1:1 identiek
zijn over alle pagina's. Drift van handmatige copies wordt na 3 UX-tweaks
onbeheersbaar. 80-regel script is goedkoper dan 9× synchroon houden.

Bestaande `/eendjes/index.html` en `/rhymes/index.html` worden óók opnieuw
gerenderd uit dezelfde template (zodat de full-screen still playback overal
geldt). Hun bestaande URLs + content blijven, alleen de template
onderliggend uniformeert.

### Service workers

- Elke grid-pagina krijgt eigen SW (zoals nu `/eendjes/sw.js` en
  `/rhymes/sw.js`). Scope = die directory.
- SW prefetcht mp3s in popularity-volgorde (huidige logica blijft).
- Home (`/index.html`) krijgt géén SW — pure navigatie-pagina, geen audio.
- Taal-landings (`/mama/`, `/papa/`, `/klas/`) krijgen géén SW — pure
  navigatie.

### Foto's (mama/papa/klas)

**Status (2026-05-17):**
- `home/mama.jpg` — 374×374, gecrop't van Eline-portretfoto, gezicht-gericht ✅
- `home/papa.jpg` — 360×360, gecrop't van Nick+William-foto, beide gezichten ✅
- `home/klas.jpg` — **komt later**, Nick maakt foto in daycare

Resoluties zijn lager dan de oorspronkelijke "min 512×512" target omdat de
Photos Library derivatives op deze maat staan. Acceptabel voor v1 (tile is
max ~halve scherm op iPad portrait); higher-res master swap kan later
zonder code-changes.

Zelfde foto wordt gebruikt voor:
- Home-tile
- Hoek-cirkel-knop op alle pagina's onder die taal

Als William bv. mama-foto tapt, ziet hij dezelfde foto klein in de hoek
rechtsboven op elk subscherm tot hij terug naar home gaat. Visuele
continuïteit = "ik ben in mama's wereld".

**Klas-fallback tot foto er is:** home toont een 3e tile met tekst "Klas"
op effen achtergrond (vergelijkbaar kleurpalet als mama/papa tiles). De
subschermen `/klas/`, `/klas/liedjes/`, `/klas/verhalen/` werken normaal;
de cirkel-knop rechtsboven toont tekst "Klas" in cirkel-vorm i.p.v. foto.

---

## Content per taal

Per categorie hieronder: nu een **candidate-lijst**. Nick kruist aan welke
tracks meegaan in v1. Voor liedjes is 8-12 per taal een goede target (zoals
`/rhymes/` nu op 10).

### klas (EN) — `/rhymes/` uitbreiden

**Bestaand (10 tracks, blijven):**
Twinkle Twinkle · Hey Diddle Diddle · Hickory Dickory Dock · Mary Had A Little
Lamb · Humpty Dumpty · Itsy Bitsy Spider · Jack and Jill · Little Bo-Peep ·
There Was An Old Woman · This Little Piggy.

**Nieuwe candidates (uit Nick's links):**
| YouTube ID | Titel | Channel | Notes |
|---|---|---|---|
| B1u-ylQR6Fo | Vroom Vroom (Kids Vehicles Rock Song) | Super Simple Songs | |
| YEmFhRK-dTg | I Love My Garbage Truck | Super Simple Songs | **Splits in 3:** Garbage Truck + Driving In My Car + Here Comes The Firetruck. Whisper-trim per segment. |
| GR2o6k8aPlI | Baby Shark | Super Simple Songs | Korte song, trim makkelijk |
| eBVqcTEC3zQ | One Little Finger | Super Simple Songs | |
| yWirdnSDsV4 | The Wheels On The Bus | Super Simple Songs | |
| w_lCi8U49mY | Itsy Bitsy Spider | Twinkle Little Songs | **Reeds in /rhymes/ #06** — niet dubbel toevoegen |

Netto: +7 tracks (5 nieuwe video's + 2 extra uit de compilatie) → `/rhymes/`
van 10 naar 17. **Beslissing: dynamisch, geen cap** — alle 17 in de grid.
De grid-CSS is responsief (5 kolommen desktop, 2 kolommen mobile/iPad
portrait), dus 17 tiles = 9 rijen × 2 op iPad portrait, vereist scroll
maar past in het patroon.

### papa (VL) — `/papa/liedjes/` nieuw

**Aanpak (Nick koos "zoek bekende uitvoeringen"):** Claude doorzoekt YouTube
voor elke kandidaat-titel, kiest een uitvoering met goede audio-kwaliteit
(voorkeur: K3, Samson & Gert, Studio 100, of bekende kinderliedjes-kanalen
zoals "Kinderliedjes TV", "Klein Maar Dapper", "Junior Songs"). Per liedje:
yt-dlp → Whisper → trim → 96 kbps mono mp3. Mapping van titel naar YouTube-ID
+ trim-bounds gaat in `tracks/papa-liedjes.json`.

**Candidate-lijst** (klassieke Nederlandstalige kinderliedjes — alle 14
worden bekeken, finale 8-12 hangt af van vindbare kwaliteit):

- In de maneschijn
- Olifantje in het bos
- Schipper mag ik overvaren
- Klein, klein kleutertje
- Berend Botje
- Hop hop hop, paardje in galop
- Zeg roodborstje tikketak
- Slaap kindje slaap
- Op een grote paddenstoel
- Vader Jakob (NL Frère Jacques)
- Daar zat een sneeuwwit vogeltje
- Boer wat zeg je van mijn kippen
- Hoedje van papier
- Witte zwanen, zwarte zwanen

**Voor `/papa/boeken/`:** 1 tile in v1 = "Alle Eendjes" → `/eendjes/`.

### mama (FR) — `/mama/liedjes/` nieuw

**Aanpak (zoals papa):** Claude zoekt bekende FR-uitvoeringen op YouTube.
Voorkeurs-kanalen: "Le Monde des Titounis", "Hervé Cristiani", "Henri Dès",
"Comptines avec Pinpin et Lili", "Comptine TV".

**Candidate-lijst** (klassieke comptines — finale selectie 8-12):

- Frère Jacques
- Au clair de la lune
- Alouette
- Sur le pont d'Avignon
- Une souris verte
- Ainsi font font font les petites marionnettes
- Petit escargot
- Pirouette cacahuète (Il était un petit homme)
- Dans la ferme à Mathurin (FR Old MacDonald)
- Promenons-nous dans les bois
- Mon âne, mon âne
- Savez-vous planter les choux
- Bateau sur l'eau
- Une poule sur un mur

**Voor `/mama/boeken/`:** leeg in v1, of 1 boek als Nick een Frans boek heeft.

### Verhalen (2 per taal, v1)

**Beslissing: beide verhalen in alle 3 talen** (Nick: "biggetjes en roodkapje"):

| Taal | Verhaal 1 | Verhaal 2 |
|---|---|---|
| FR (`/mama/verhalen/`) | Les Trois Petits Cochons | Le Petit Chaperon Rouge |
| VL (`/papa/verhalen/`) | De Drie Biggetjes | Roodkapje |
| EN (`/klas/verhalen/`) | The Three Little Pigs | Little Red Riding Hood |

= 6 verhalen totaal. Claude zoekt per verhaal een YouTube-narratie met goede
audio-kwaliteit (voorkeur: officiële kinderboek-audioversies, Vlaamse/Belgische
publishers, of bekende narratie-kanalen). Trim-bounds via Whisper zoals
liedjes-pipeline. Verhaal-mp3s mogen 3-8 min duren — pre-fetch in SW dus
zwaarder (~3-6 MB per file), maar slechts 2 per grid.

---

## Data flow

### Bij ontwikkeling (Nick + Claude, lokaal)

```
YouTube video URL
   │
   ▼
yt-dlp → /tmp/liedjes/yt/<lang>-<NN>.wav    (kept tussen runs)
   │
   ▼
whisper.cpp → /tmp/liedjes/whisper/<lang>-<NN>.json
   │
   ▼
find_verse_bounds.py → (start, dur) per track
   │
   ▼
ffmpeg → <repo>/{mama,papa,klas}/{liedjes,verhalen}/audio/<NN>.mp3
                              (96 kbps mono)
   │
   ▼
Cover image (YouTube thumbnail of Nick's eigen) → audio/<NN>.jpg
   │
   ▼
tracks/<lang>-<category>.json bijgewerkt
   │
   ▼
render.py → <lang>/<category>/index.html + service-worker.js
   │
   ▼
git commit + push → GitHub Pages auto-deploy
```

### Bij gebruik (William op iPad)

```
Open https://nicolasmertens.github.io/liedjes/
   │
   ▼
Home: 3 foto-tiles
   │ (tap mama)
   ▼
/mama/: 3 categorie-tiles + foto-cirkel-hoek
   │ (tap liedjes)
   ▼
/mama/liedjes/: grid van liedje-tiles + foto-cirkel-hoek
   │ (tap een liedje)
   ▼
Full-screen cover-image + audio start + foto-cirkel-hoek blijft
   │ (tap anywhere of natural end)
   ▼
Fade terug naar grid
   │ (tap foto-cirkel)
   ▼
Home
```

---

## Error handling & edge cases

- **MP3 fetch faalt offline tijdens playback**: huidige gedrag (HTMLAudio
  `error` event → silently skip) blijft. Cover-image blijft staan, William
  tapt opnieuw of kiest andere tile.
- **Foto's ontbreken** (Nick heeft mama.jpg nog niet aangeleverd): home toont
  placeholder met tekst-label ("Mama" / "Papa" / "Klas") tot foto wordt
  ge-committed. Pagina werkt verder.
- **William tapt te kort/te lang op tile** (huidige `MIN_TAP_MS=65`,
  `MAX_TAP_MS=1500`, `MAX_TAP_DRIFT_PX=50` thresholds): blijft gelden, geldt
  ook voor de foto-cirkel-hoek-knop en categorie-tiles.
- **Compositie-video YEmFhRK-dTg trim**: 3 verse-bounds vinden i.p.v. 1.
  Whisper detecteert de stiltes tussen songs; `find_verse_bounds.py` aanpassen
  om alle 3 bounds te returnen i.p.v. eerste verse-end.
- **Auteursrechten**: alle YouTube-sourced content is voor 1 kind thuis,
  net als `/rhymes/` nu. Repo blijft public (voor telemetrie tooling
  convenience). Als redistributie ooit een issue wordt: repo private flippen
  (GitHub Pages werkt op private repos met Pro).
- **iOS PWA install**: huidige manifest.json per `/eendjes/` en `/rhymes/`.
  Voeg `/manifest.json` toe op root voor home-PWA met titel "Williams Boeken".
  Sub-PWAs blijven werken zoals nu.

---

## Testing

- **Visual smoke test** (Nick, op iPad): tap-test elke route minstens 1×, check
  dat foto-cirkel terug-naar-home werkt op elke pagina, check full-screen
  still bij playback.
- **Telemetry verification**: na deploy, één liedje per taal afspelen, check
  Worker logs (`gh repo clone && find logs -newer ...`) dat events binnenkomen
  met juiste `_app_version=v2-multilang` en path.
- **Audio length sanity check**: alle trimmed mp3s tussen 10s en 90s voor
  liedjes, tussen 3min en 8min voor verhalen. Te lang = trim opnieuw met
  hardere verse-bound.
- **Geen automatische tests** — single-child PWA, te kleine surface om unit-test
  infrastructuur te rechtvaardigen.

---

## Open punten — beslist (2026-05-17)

| # | Punt | Beslissing |
|---|---|---|
| 1 | Foto's | mama + papa gecrop't & opgeslagen; klasfoto komt later, tekst-placeholder tot dan |
| 2 | VL-liedjes selectie | Claude zoekt bekende uitvoeringen uit candidate-lijst |
| 3 | FR-liedjes selectie | Claude zoekt bekende uitvoeringen uit candidate-lijst |
| 4 | Verhalen selectie | Beide (Biggetjes + Roodkapje) in alle 3 talen — 6 verhalen totaal |
| 5 | Klas-grid maximum | Dynamisch (geen cap), alle 17 EN-tracks |
| 6 | Render-aanpak | Python `render.py` met `templates/grid.html` |
| 7 | Cirkel-hoek positie | Rechtsboven |

Nog wel afhankelijk van implementatie:
- Klas-fallback styling (achtergrond-kleur voor tekst-tile) — wordt in
  implementatie bepaald op basis van bestaande color palette.
- Trim-bounds per verhaal — vereist Whisper-run, gebeurt tijdens implementatie.

---

## Out of scope — bewust niet in v1

- **YouTube live-streaming/auto-ophalen**: alle content wordt manueel via
  yt-dlp gestript voor permanentie + offline gebruik.
- **Spotify/Apple Music integratie**: geen account-coupling met kid-tablet
  flow.
- **Speech-to-text op afspeling** (karaoke-style highlight): mooi maar
  20-maand-oud heeft hier niets aan.
- **Backend-database**: alle data is files in de repo (Git-versioned, no
  database).
- **Naar `/klas/liedjes/` migreren van `/rhymes/` URL**: zou bookmarks en
  Worker-logs breken; doe later in v3 als waarde duidelijk is.
