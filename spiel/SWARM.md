# Stadtpuls – Schwarm-Briefing (Ausbau 2.0)

Dieses Dokument ist für die Agenten, die Stadtpuls parallel ausbauen. Jeder Agent liest es vollständig, bevor er anfängt.

## 1. Auftrag

Der Nutzer will das Spiel **„ungefähr 1000-mal detailreicher, mit viel mehr Features, viel mehr Spielerlebnis, richtigen Gebäuden und richtigen Grafiken – nicht billig aussehend"**. Maßstab sind Cities: Skylines (I/II) und Mini Metro. Das Spiel bleibt ein Browser-Spiel (Three.js r160, WebGL2), weil es so sofort in der Claude-App und auf dem Handy spielbar ist.

**Qualitätsmaßstab:** Ein Screenshot aus Nahsicht soll nach einem liebevoll gestalteten, modernen Städtebauspiel aussehen – nicht nach Kisten. Gebäude haben erkennbare Architektur (Sockel, Gesimse, echte Fensterrahmen, Türen, Balkone, Dachformen, Dachaufbauten, Vorgärten). Materialien haben Struktur (Putz, Ziegel, Beton, Glas mit Spiegelung). Licht hat Tiefe (Umgebungsverdeckung, weiche Schatten, Himmel, Nebel, Bloom bei Nacht). Die Stadt lebt (Fußgänger, Autos mit Licht, Busse, Vögel, Boote, Rauch). Jedes System hat spürbare Spielwirkung und eine verständliche Oberfläche.

Alles wird **prozedural** erzeugt: keine heruntergeladenen Modelle, Texturen, Bilder oder Klänge (Netzwerkzugriff ist ohnehin gesperrt). Texturen entstehen zur Laufzeit auf Canvas, Modelle aus dem Baukasten, Klänge mit WebAudio.

## 2. Bildsprache (Art Direction)

- **Stilisierter Realismus, europäische Stadt.** Proportionen realistisch, Formen klar und leicht vereinfacht, liebevolle Details. Vorbild-Mischung: Cities: Skylines II (Maßstab, Licht), Townscaper (Charme, Farbigkeit), deutsche Städte (Satteldächer mit roten Ziegeln, Gründerzeit-Häuser mit Stuckgesims, Backstein-Fabriken mit Sägezahndach, Plattenbau, moderne Glasbüros, Fachwerk in Dörfern).
- **Farbe:** warme Pastelltöne für Putz, satte Ziegelrottöne, Anthrazit und Schiefer für Dächer, kühles Glas. Keine reinen Primärfarben außer bei Schildern und ÖPNV-Linien.
- **Licht:** Tag mit warmem Sonnenlicht und blauem Himmelslicht, langen Schatten am Morgen und Abend; Nacht dunkelblau mit warmen Fenstern, Laternen und Leuchtreklamen (Bloom).
- **Lesbarkeit geht vor:** Zonenfarben (Wohnen grün, Gewerbe blau, Industrie gelb, Büro violett) und Infoansichten bleiben klar erkennbar. Effekte dürfen das Bauen nie behindern.
- **Das Diorama** (schwebende Erdscholle) bleibt als Markenzeichen, darf aber durch eine Umgebungslandschaft im Dunst ergänzt werden (Agent G6).

## 3. Maßstab und Koordinaten

- 1 Welteinheit = **1 Feld = 10 m**. `M = 0.1` (ein Meter), Geschosshöhe `FLOOR = 0.3` (3 m). Beides in `src/render/arch/kit.js`.
- Welt: Feld (x, y) liegt bei `x + 0.5 − W/2`, `z = y + 0.5 − H/2`. +y ist oben.
- Gebäudemodelle: Ursprung = Mitte der Grundfläche auf Bodenhöhe, **Front (Straßenseite) zeigt nach +z**. Die Ansicht dreht nach `b.rot`.
- Straßenbreiten und Fahrspuren: `ROAD_GEOM` in `src/config.js` (Vertrag zwischen Straßen und Fahrzeugen).
- Menschen ≈ 1,75 m (0,175), Autos ≈ 4,5 × 1,8 m, Busse 12 m, Bäume 6–15 m.

## 4. Architektur des Codes

```
src/
  config.js            Grunddaten (Zonen, Stufen, Straßen, Gebäude-Grundliste, Meilensteine)
  registry.js          Erweiterungspunkte (Systeme, Ansichten, Panels, Werkzeuge, Overlays, Symbole …)
  content/             zusätzliche Gebäude, Karten, Ereignisse, Stadtfunk (werden beim Import registriert)
  sim/                 Simulation (headless lauffähig, keine Imports aus render/ oder ui/)
    game.js            Zustand, Aktionen, Zeit, Speichern – ruft System-Hooks auf
    city.js services.js economy.js traffic.js transit.js network.js world.js progress.js
    systems/           Erweiterungssysteme (je Agent eine Datei)
  render/              Three.js-Darstellung
    scene.js           Engine: Renderer, Licht, Himmel, Bild-Schleife, ruft Ansichten auf
    matlib.js          Materialbibliothek (Namen → Material)
    arch/kit.js        Baukasten für Gebäude (eingefroren, siehe 6.2)
    arch/*.js          Architektur-Bausteine pro Gebäudeart
    protos.js          Prototyp-Instanzierung
    buildings.js roads.js terrain.js agents.js overlay.js effects.js camera.js
    views/             zusätzliche Ansichten (je Agent eine Datei)
    gallery.js         Galerie zum Prüfen von Modellen (index.html?gallery=…)
  ui/                  Oberfläche (ui.js, menu.js, panels/ je Agent eine Datei)
  input.js input/      Werkzeuge
  audio.js
tools/shot.mjs         Screenshots & Statistik (headless Chromium)
test/sim-test.mjs      Simulationstest ohne Browser
```

### 4.1 Erweiterungspunkte (`src/registry.js`)

| Register | Form | Wer liest es |
|---|---|---|
| `registerSystem({ id, init(g), step(g, min), hourly(g, h), daily(g, tag), weekly(g), serialize(g), load(g, d), renderables(g) })` | Zustand in `g.ext[id]` | `sim/game.js` |
| `HAPPINESS_FACTORS.push((g, b, i) => [label, wert] \| null)` | Glücksfaktor, erscheint im Inspektor | `services.js` |
| `LANDVALUE_TERMS.push((g, i) => wert)` | zusätzlicher Bodenwert pro Feld | `services.js` |
| `DEMAND_MODIFIERS.push((g, d) => { d[1] += … })` | Nachfrage W/G/I/B | `city.js` |
| `CAPACITY_MODIFIERS.push((g, b, cap) => neueCap)` | Bewohner/Jobs pro Gebäude | `city.js` |
| `BUDGET_LINES.push({ id, label, kind: 'income'\|'expense', amount(g) })` | € pro Tag | `economy.js` |
| `registerServiceType('deathcare')` | neue Abdeckungsart → `g.cov[typ]`, `BUILDINGS[x].service.type` | `services.js` |
| `BUILDING_PROBLEMS.push((g, b) => iconId \| null)` + `registerIcon({ id, color, draw(ctx, cx, cy, r) })` | Problemsymbol über Gebäuden | `effects.js` |
| `registerView(class { constructor(engine); frame(dt, simDt, time, night); dispose() })` | eigene 3D-Ansicht | `scene.js` |
| `registerOverlay({ id, name, icon, bad, text, field(g) → Float32Array(0..1) \| building(g, b) → hex })` | Infoansicht | `overlay.js`, `ui.js` |
| `registerPanel({ id, title, icon, order, render(ui) → html, click(ui, act, el), afterRender(ui) })` | Panel + Knopf oben rechts | `ui.js` |
| `registerTool(kind, { down, move, up, hover, cancel, key })` | Werkzeug | `input.js` |
| `TRAY_ITEMS.push({ cat, item(g) → { kind: 'tool', key: kind, name, cost, desc, color, locked } })` | Eintrag in der Werkzeugleiste | `ui.js` |
| `INSPECTORS.push((ui, sel) => html \| null)` | Zusatz im Inspektor | `ui.js` |
| `MENU_SECTIONS.push({ render(menu) → html, click(menu, act, el) → true wenn behandelt })` | Hauptmenü | `menu.js` |
| `on(ev, fn)` / `emit(ev, …)` | lose Ereignisse zwischen Systemen und Ansichten | alle |

Inhalte erweitern: `Object.assign(BUILDINGS, {...})`, `CATEGORIES.push(...)`, `POLICIES.push(...)` (config.js), `CARDS.push(...)`, `EVENTS.push(...)`, `CHATTER.push(...)` (sim/progress.js). Die Simulation ruft `g.isUnlocked`, `g.buildingCost`, `checkPlace` usw. generisch für jeden Schlüssel auf – neue Gebäude sind sofort platzierbar.

### 4.2 Wichtige Felder der Simulation

- `g.W, g.H, g.N`, Raster: `g.road, g.zone, g.bld (Gebäude-ID), g.rubble, g.stationAt, g.trackCount, g.roadComp, g.access`, Felder `g.fields.{pollution, noise, crime, landValue}`, Abdeckung `g.cov.{police, fire, health, garbage, edu, park, transit, …}`, `g.trafficLoad, g.congestion`, Welt `g.world.{terrain, trees, resource, vh (Eckpunkthöhen), waterDist, forest, highway…}`.
- Gebäude `b`: `id, key ('zone' oder Gebäudeschlüssel), zone (1–4 oder 0), spec ('farm'|'mine'|'forest'|'oil'|null), x, y, w, h, rot (0–3), level (1–5), cap, occ, happy, edu, commute, powered, watered, construct (0..1), abandoned, burning, variant, access, comp, connected`.
- Zonengebäude können jetzt **mehrere Felder** belegen (2×1, 1×2, 2×2). `frontFootprint(b)` in `arch/index.js` liefert Breite × Tiefe relativ zur Front.
- Zeit: `g.time` (Minuten), `g.hour()`, `g.day()`, `g.speed`, `GAME_MIN_PER_SEC = 48` (ein Tag = 30 s bei 1×).
- Ereignisse der Simulation (Emitter `g.on`): `buildingAdded, buildingRebuilt, buildingUpdated, buildingRemoved, roadsChanged, zonesChanged, treesChanged, rubbleChanged, transitChanged, news, milestone, cards, event, step, hour, day, week`.

## 5. Datei-Besitz (streng)

Jeder Agent arbeitet in einem **eigenen Git-Worktree** und ändert **nur seine eigenen Dateien**. Neue Dateien legt er nur in seinem Bereich an. Braucht er etwas in einer fremden Datei, schreibt er die Bitte (mit genauem Vorschlag) in `spiel/swarm/requests/<agent-id>.md` und baut, wenn möglich, eine Übergangslösung in seinen eigenen Dateien. Gemeinsame Dateien (`registry.js`, `config.js`, `sim/game.js`, `sim/city.js`, `sim/services.js`, `sim/economy.js`, `sim/network.js`, `sim/world.js`, `arch/kit.js`, `arch/index.js`, `protos.js`-Schnittstelle, alle `*/index.js`) sind **eingefroren**.

| ID | Rolle | Eigene Dateien |
|---|---|---|
| G1 | Licht, Atmosphäre, Effekte | `render/scene.js`, `render/materials.js`, `render/post.js`*, `render/sky.js`*, `render/effects.js`, `render/camera.js`, `render/views/weatherfx.js` |
| G2 | Materialien & Texturen | `render/matlib.js`, `render/atlas.js`, `render/textures.js`* (+ weitere `render/tex_*.js`*) |
| G3 | Architektur Wohnen & Gewerbe | `render/arch/residential.js`, `render/arch/commercial.js`, `render/arch/rescom_*.js`* |
| G4 | Architektur Industrie & Büro | `render/arch/industrial.js`, `render/arch/office.js`, `render/arch/indoff_*.js`* |
| G5 | Architektur Dienste & Versorgung | `render/arch/services.js`, `render/arch/svc_*.js`* |
| G6 | Architektur Wahrzeichen & Verkehrsbauten | `render/arch/landmarks.js`, `render/arch/transport.js`, `render/arch/lm_*.js`* |
| G7 | Gelände, Wasser & Natur | `render/terrain.js`, `render/vegetation.js`*, `render/water.js`* |
| G8 | Straßen & Stadtmobiliar | `render/roads.js`, `render/streetprops.js`* |
| G9 | Gebäude-Renderer | `render/buildings.js`, `render/protos.js` (Schnittstelle `get/alloc/set/release/flush/stats` bleibt) |
| G10 | Fahrzeuge & Leben | `render/agents.js`, `render/views/life.js`, `render/vehicles_*.js`* |
| S1 | Wirtschaft & Industrie | `sim/systems/industry.js`, `content/industry.js`, `ui/panels/economy.js` |
| S2 | Bürger, Dienste & Bezirke | `sim/systems/citizens.js`, `sim/systems/districts.js`, `content/services.js`, `ui/panels/citizens.js`, `ui/panels/districts.js`, `render/views/districts.js`, `input/districts.js` |
| S3 | Verkehr & ÖPNV | `sim/systems/transport.js`, `content/transport.js`, `ui/panels/transport.js`, `render/views/transport.js`, `input/buslines.js` |
| S4 | Wetter, Jahreszeiten & Katastrophen | `sim/systems/weather.js`, `sim/systems/disasters.js`, `content/safety.js`, `render/views/disasterfx.js`, `ui/panels/weather.js` |
| S5 | Fortschritt & Inhalte | `sim/systems/progression.js`, `content/cards.js`, `content/events.js`, `content/chatter.js`, `ui/panels/progression.js` |
| U1 | Oberfläche & Bedienung | `ui/ui.js`, `ui/menu.js`, `ui/icons.js`, `ui/charts.js`, `ui/*.js`* (außer panels), `style.css`, `index.html`, `input.js` |
| U2 | Klang | `audio.js`, `audio/*.js`* |

`*` = neue Datei, die der Agent anlegen darf. Wer eine neue Datei anlegt, importiert sie aus einer eigenen Datei (nicht aus fremden `index.js`).

## 6. Verträge zwischen den Agenten

### 6.1 Materialien (`render/matlib.js`)
`getMaterial(name)` liefert ein Three.js-Material. Die Namen in `MATERIAL_DEFS` sind der Vertrag: Architektur-, Straßen- und Gelände-Agenten benutzen **nur diese Namen**. G2 darf Namen ergänzen, aber keine entfernen oder umbenennen, und ersetzt die Farb-Materialien durch prozedurale PBR-Texturen (`map`, `normalMap`, `roughnessMap`, ggf. `aoMap`), die zu den **weltbezogenen UVs** des Baukastens passen (1 UV-Einheit = 4 m). Glas (`glass_*`, `lod_windows`) behält die Nacht-Beleuchtung über das Attribut `aLit` und die Instanzposition. Alle Materialien reagieren auf `shared.uSnow` (Schnee auf nach oben zeigenden Flächen) und `shared.uWet` (dunkler, glänzender bei Regen). `shared` liegt in `render/materials.js` (G1 setzt die Werte jedes Bild aus `g.ext.weather`).

**Draw Calls sind der Engpass.** Ein Prototyp mit sieben Materialien kostet sieben Draw Calls pro Variante – bei Hunderten Varianten zu viel. Deshalb gibt es `render/atlas.js` (Besitzer G2): `ATLAS_INDEX`, `isAtlasMaterial(name)`, `getAtlasMaterial()` – ein einziges Material für alle undurchsichtigen Baustoffe, gesteuert über das Vertex-Attribut `aMat`. G9 fasst beim Laden eines Prototyps alle Atlas-Teile zu einer Geometrie zusammen (Attribut `aMat` setzen) und behält nur Glas, Leuchtendes und `lod_windows` getrennt (Ziel: ≤ 4 Draw Calls pro Prototyp). G2 macht aus der Startfassung (nur Farbe/Rauheit) einen echten Textur-Atlas mit denselben Namen.

### 6.2 Baukasten und Architektur-Bausteine
- `registerArch(key, { variants: 6, build(ctx) })` in der eigenen `arch/*.js`. `ctx = { key, level, variant, fw, fd, rng, kit, M, FLOOR, detail, zone, spec }`. `fw` × `fd` = Grundfläche in Feldern (Breite an der Straße × Tiefe). Rückgabe: `kit.build()`.
- Zonen-Schlüssel: `res`, `com`, `ind`, `off` und Spezialisierungen `farm`, `mine`, `forest`, `oil` (Industrie). Grundflächen 1×1, 2×1, 1×2, 2×2. Stufen 1–5.
- Alle anderen Gebäude: Schlüssel aus `BUILDINGS` mit `size: [breite, tiefe]`. Zuständigkeit: G5 = Kategorien `power, water, garbage, services, education, parks, industry, safety`; G6 = `landmarks, transport, transit` (inkl. `station` = Pulsbahn-Station als Hochbahnsteig, Höhe `TRANSIT.trackHeight`).
- `kit.detail`: 2 = Nahsicht (volle Details), 1 = mittlere Entfernung (ohne Kleinteile), 0 = Fernansicht (Fenster nur als `lod_windows`-Flächen). Bausteine respektieren `ctx.detail` (Kleinteile wie Geländer, Lampen, Mülltonnen, Briefkästen nur bei 2).
- `kit.js` ist eingefroren. Eigene Hilfsfunktionen in eigene Dateien (z. B. `arch/rescom_parts.js`).
- **Dreiecks-Budget pro Modell (Detail 2):** Wohnen/Gewerbe Stufe 1–2 ≤ 5 000, Stufe 3 ≤ 9 000, Stufe 4 ≤ 14 000, Stufe 5 ≤ 22 000; Industrie/Büro ≤ 16 000 (Türme ≤ 24 000); Dienste ≤ 16 000; Wahrzeichen ≤ 45 000. Detail 0 ≤ 8 % davon.
- Rauch/Dampf: `kit.smoke(x, y, z, 'smoke'|'steam', menge)`; Nachtlichter: `kit.light(x, y, z, farbe, größe)`.
- Animierte Teile (Windräder, Riesenrad, Dönerspieß …): Bausteine dürfen `res.anim = [{ geometry, material, pivot: [x, y, z], axis: 'x'|'y'|'z', speed }]` an das Ergebnis von `kit.build()` hängen. G9 dreht sie.

### 6.3 Fahrzeuge und bewegliche Objekte
Systeme liefern über `renderables(g)` pro Bild eine Liste `{ kind, x, y, z, yaw, pitch?, color?, len?, lights? }`. G10 zeichnet alle Arten: `car, van, truck, bus, tram, taxi, police, fire, ambulance, garbage, hearse, snowplow, tanker, train_loco, train_wagon, cargo_wagon, ship_cargo, ferry, boat, plane, helicopter, ship_cruise`. Straßenautos kommen weiterhin aus `g.traffic.cars` (Typen siehe `sim/traffic.js`).

### 6.4 Wetter (`g.ext.weather`, gesetzt von S4)
`{ season: 'spring'|'summer'|'autumn'|'winter', yearT: 0..1, temp: °C, rain: 0..1, snow: 0..1 (fällt), snowCover: 0..1 (liegt), cloud: 0..1, fog: 0..1, wind: 0..1, windDir: rad, lightning: 0..1 (Blitz in diesem Moment), storm: bool }`. Fehlt der Zustand, nehmen alle Ansichten Sommer und klares Wetter an. G1 zeichnet Himmel, Wolken, Regen, Schnee, Nebel und Blitze und setzt `shared.uSnow/uWet/uSeason/uAutumn`. G7 färbt Gelände und Bäume nach Jahreszeit.

### 6.5 Katastrophen
S4 meldet `emit('disaster', { type, phase: 'warn'|'start'|'update'|'end', x, y, radius, intensity })` aus `registry.js` und zerstört/beschädigt Gebäude über die Spielfunktionen. S4 zeichnet die Effekte selbst in `render/views/disasterfx.js`.

### 6.6 Bezirke und ÖPNV
- `g.ext.districts = { map: Uint8Array(N) (0 = kein Bezirk), list: [{ id, name, color, policies: [] }] }` (S2).
- `g.ext.transport = { stops: [{ id, tile, side, lines }], lines: [...] , … }` (S3). G8 zeichnet Haltestellenhäuschen an `stops` (falls vorhanden); S3 zeichnet Linienwege und Gleise selbst.

### 6.7 Einstellungen (`app.settings`, Oberfläche von U1)
`quality: 'low'|'medium'|'high'|'ultra'`, `postfx: bool`, `ao: bool`, `bloom: bool`, `shadows: 'off'|'low'|'high'`, `alwaysDay`, `volume, music, sfx, muted`, `tutorialDone`. Die Engine bekommt `settings` im Konstruktor (`engine.settings`); G1 baut die Qualitätsstufen, U1 die Bedienelemente.

## 7. Arbeitsweise

1. **Worktree vorbereiten:** Im Worktree-Wurzelverzeichnis `ln -s /home/user/merdins-doener/spiel/node_modules spiel/node_modules`. Arbeitsverzeichnis für Befehle ist `spiel/`.
2. **Bauen:** `node build.mjs` (esbuild, < 1 s). Fehler sofort beheben.
3. **Simulation testen:** `node test/sim-test.mjs 40` muss fehlerfrei durchlaufen (Systemagenten zusätzlich mit eigenen Prüfungen).
4. **Sehen, was man baut:** `node tools/shot.mjs --scenario city|night|closeup|street|overview|menu|mobile --out /tmp/swarm/<ID>/x.png` und Architektur mit `--scenario gallery --gallery "res&fp=1x1,2x1,2x2&variants=4"` (weitere Parameter: `levels=1,2`, `detail=0|1|2`, `night=1`, `zoom=1.5`, `yaw`, `pitch`). Bilder mit dem Read-Werkzeug ansehen und **kritisch** beurteilen. Höchstens zwei Browser laufen gleichzeitig (Sperre); Wartezeit ist normal. Der Software-Renderer ist langsam – Bildraten sagen nichts, Draw Calls und Dreiecke schon (`Statistik:`-Zeile).
5. **Budget Gesamtszene** (Szenario `overview`, Qualität medium): ≤ 700 Draw Calls, ≤ 3 Mio. Dreiecke. Texturerzeugung beim Start ≤ 2 s.
6. **Keine Fehler:** Das Werkzeug meldet `PAGEERROR`-Zeilen und endet mit Code 1 – die müssen weg.
7. **Alle Texte, Kommentare und Namen im Spiel auf Deutsch.** Code-Stil wie im Bestand (ES-Module, 2 Leerzeichen, keine Semikolon-Diskussionen).
8. **Commit:** Nur eigene Dateien (und `swarm/requests/<ID>.md`). **`dist/` nie committen** (ist in `.gitignore`). Aussagekräftige Commit-Nachricht auf Deutsch. Mehrere Commits sind gut.
9. **Abschluss-Bericht** (deine letzte Antwort): Worktree-Pfad und Branch, Liste der geänderten/neuen Dateien, was gebaut wurde, Screenshot-Pfade der besten Bilder, Zahlen (Dreiecke, Draw Calls), offene Punkte und Bitten an andere Agenten.

## 8. Rollen im Detail

### G1 – Licht, Atmosphäre, Effekte
Nachbearbeitung mit `EffectComposer` (`three/examples/jsm/postprocessing/*`): Umgebungsverdeckung (GTAO oder SAO), Bloom (nur Helles, für Fenster, Laternen, Neon), Farbkorrektur/Tonwert (leichte Wärme, Kontrast, Vignette), Kantenglättung (SMAA/FXAA) – abschaltbar nach `settings`. Physikalischer Himmel (`three/examples/jsm/objects/Sky.js` oder eigener Shader) mit Sonne, Dämmerung, Sternen, Mond; daraus eine Umgebungskarte (PMREM) für Spiegelungen auf Glas und Wasser, nachts abgedunkelt. Schatten: eng an die Kamera gekoppelt, weich, stabil (kein Flimmern beim Schwenken), Qualitätsstufen. Nebel/Dunst mit Höhe. Wolken (Schichten oder Billboard-Wolken mit Schatten), Regen, Schnee, Gewitter mit Blitzen, Wind – gesteuert über `g.ext.weather` (Ansicht `views/weatherfx.js`). Effekte (`effects.js`): bessere Rauch-/Dampf-/Feuer-Partikel, Funken, Baustaub, Problem-Symbole schön und lesbar. Kamera: Zoom-abhängige Neigung (nah flacher, fern steiler), sanfte Kanten, Kamerafahrt beim Spielstart.

### G2 – Materialien & Texturen
Prozedurale Texturen (Canvas oder WebGL-Rendertarget) für jeden Materialnamen: Putz (feine Körnung, leichte Flecken), Ziegel (Verband mit Fugen, Farbvariation pro Stein), Beton (Schalungsfugen), Naturstein, Holz, Metallbleche/Wellblech, Dachziegel (Biberschwanz/Pfanne), Schiefer, Kies-Flachdach, Asphalt (Körnung, Flicken), Pflaster, Gras, Erde, Sand, Felder. Jeweils Normal- und Rauheitskarte (aus Höhenbild abgeleitet). Glas mit Umgebungsspiegelung (`envMap` kommt von G1 über `scene.environment`), Fenster nachts wie bisher. Schnee/Nässe über `shared`. Texturen kachelbar, ≤ 512² (Gelände ≤ 1024²), mit Mipmaps und Anisotropie. Stell G7 und G8 Funktionen bereit (z. B. `getTexture('grass')`), dokumentiert im Dateikopf. Erzeugung schnell (Ziel < 1,5 s gesamt) und zwischengespeichert. `setMaterialFactory` ist dein Einstieg.

### G3 – Wohnen & Gewerbe (Zonen `res`, `com`)
Je Stufe 1–5 mindestens 6 deutlich verschiedene Varianten pro Grundfläche (1×1, 2×1, 1×2, 2×2). Wohnen: Einfamilienhaus mit Garten, Doppelhaus, Fachwerkhaus, Bungalow, Stadtvilla, Reihenhauszeile (2×1), Gründerzeit-Mehrfamilienhaus mit Stuck und Erkern, Mehrfamilienhaus mit Laubengängen, Plattenbau, moderner Wohnblock mit Loggien, Wohnturm mit Staffelgeschossen, Wohnhochhaus. Gewerbe: Kiosk, Bäckerei/Café mit Markise und Außenbestuhlung, Ladenzeile mit Schaufenstern und Werbeschildern, Supermarkt mit Parkplatz (2×2), Kaufhaus, Einkaufszentrum mit Glasdach (2×2), Hotel, Geschäftshaus, Einkaufsturm. Erdgeschosse mit Schaufenstern, Schildern (`sign_white`, `neon_*`), Markisen. Abends leuchtende Schaufenster.

### G4 – Industrie & Büro (`ind`, `farm`, `mine`, `forest`, `oil`, `off`)
Industrie: Werkstatt, Lagerhalle mit Laderampen und Rolltoren, Backstein-Fabrik mit Sägezahndach und Schornstein, Chemiewerk mit Tanks und Rohrbrücken, Gießerei, Hightech-Fabrik mit Solardach; Lkw-Stellplätze, Zäune, Container. Bauernhof (Felder mit Reihen, Scheune, Silo, Traktor), Bergwerk (Förderturm, Halde, Förderband), Forst (Holzstapel, Sägehalle, Kran), Ölfeld (Pumpenböcke, Tanks). Büro: Bürohaus mit Bandfenstern, Glasbüro, Bürokomplex mit Innenhof (2×2), Büroturm mit Staffeln, Wolkenkratzer mit Krone und Lichtbändern, Glas in mehreren Tönen. Rauch über `kit.smoke`.

### G5 – Dienste & Versorgung
Alle Gebäude der Kategorien `power, water, garbage, services, education, parks, industry, safety` (Schlüssel siehe `config.js` und `content/*.js`). Jedes Gebäude erkennbar: Kohlekraftwerk mit Kühltürmen, Windräder (animiert), Solarpark, Gaskraftwerk, Fusion, Wasserkraft, Kernkraft, Geothermie, Batteriespeicher, Wasserturm, Pumpwerk, Wasserwerk, Kläranlage, Deponie, Müllverbrennung, Recyclinghof, Polizei, Präsidium, Feuerwache mit Toren und Schlauchturm, Feuerwehrzentrale, Arztpraxis, Krankenhaus mit Hubschrauberlandeplatz, Kita, Schule mit Schulhof, Gymnasium, Universität-Campus, Bibliothek, Forschungszentrum, Seniorenheim, Friedhof mit Kapelle und Gräbern, Krematorium, Gefängnis, Rathaus, Parks (Bäume, Wege, Bänke, Brunnen, Spielgeräte, Teich mit Steg), Sport- und Freibad, Kleingärten, Logistik (Lagerhalle, Fabriken, Güterbahnhof, Frachthafen mit Kränen und Containern, Markthalle), Katastrophenschutz, Notunterkunft, Sirene, Wetterstation, Winterdienst, Hochwasserschutz.

### G6 – Wahrzeichen & Verkehrsbauten
Alle `landmarks` (inkl. Dom, Schloss, Museum, Zoo, Halle, Botanischer Garten, Pulsturm, Stadttor, Windmühle, Freizeitpark, Messe, Riesenrad, Fernsehturm, Stadion, Oper, Sternwarte, Mêrdîn's Dönerpalast mit drehendem Spieß und gelbem „M", Leuchtturm) und `transport`/`transit` (Busdepot, Straßenbahndepot, Hauptbahnhof mit Bahnsteighalle und Gleisen, Flughafen mit Terminal, Tower, Vorfeld und Startbahn, Fähranleger, Parkhaus, Taxizentrale, Pulsbahn-Station `station` als Hochbahnsteig auf Stützen mit Dach, Treppen und Aufzug, `metro_hub`). Wahrzeichen dürfen aufwendig sein – sie sind die Postkartenmotive.

### G7 – Gelände, Wasser & Natur
Gelände mit Texturmischung (Gras, Wiese mit Blumen, Erde, Fels, Sand, Schnee) per Shader statt Kachelfarben, weiche Hügel und Felsklippen, natürliche Uferlinien mit Strand und Schilf. Wasser: Spiegelung (Umgebungskarte), Wellen-Normalen, Tiefenfarbe, Schaum am Ufer, sanfte Bewegung, Wasserfälle an Diorama-Kanten (optional). Vegetation (`vegetation.js`): mehrere Baumarten (Laub, Nadel, Birke, Pappel, Obstbaum), Büsche, Hecken, Felsen, Grasbüschel, Blumen – instanziert, mit Detailstufen und Wind-Wiegen im Shader, jahreszeitliche Farben (`shared.uAutumn`, `uSnow`). Wälder dicht und natürlich. Umgebung außerhalb der Karte im Dunst (Felder, Hügel, Berge) für Tiefe, das Diorama bleibt erkennbar.

### G8 – Straßen & Stadtmobiliar
Echte Straßengeometrie: Fahrbahn mit Markierungen, erhöhte Bordsteine, Gehwege, Kreuzungen mit Zebrastreifen, Haltelinien und **Ampeln** (Masten mit Lichtern, Phasen sichtbar), Kreisverkehr-Optik optional, Alleen mit Mittelstreifen und Bäumen, Gassen mit Pflaster, Autobahn mit Leitplanken und Schildern, Brücken mit Geländer, Pfeilern und Bögen. Stadtmobiliar (`streetprops.js`): Laternen (nachts mit Lichtkegel), Bänke, Mülleimer, Hydranten, Briefkästen, Fahrradständer, Verkehrsschilder, Bushaltestellen (aus `g.ext.transport.stops`), Bäume am Straßenrand, parkende Autos am Rand von Wohnstraßen. Instanziert, Detailstufen, ≤ 150 Draw Calls für Straßen gesamt.

### G9 – Gebäude-Renderer
`buildings.js`/`protos.js` weiterentwickeln: Detailstufen (Detail 2 nah, 1 mittel, 0 fern) mit Umschaltung nach Kameraabstand (gebündelt, nicht jedes Bild alles), Ersatzmodelle für alles ohne Baustein, **Baustellen** (Gerüst, Bauzaun, Baukran mit drehendem Ausleger, Staub), Abriss-Animation, Zustände (verlassen: verwittert, Fenster dunkel; brennend; ohne Strom: Fenster dunkel), animierte Teile (`res.anim`), Nachtlichter (`res.lights`), Höhe für Auswahl/Symbole (`heightOf`), Einfärbung für Infoansichten, Speicher sparen (Prototypen ohne Instanzen freigeben). Performance-Ziel siehe 7.5.

### G10 – Fahrzeuge & Leben
Detaillierte Fahrzeugmodelle (Karosserie, Fenster, Räder, Lichter) für alle Arten aus 6.3, instanziert, mit Detailstufen; Scheinwerfer und Rücklichter nachts (Bloom), Blaulicht, Blinker an Kreuzungen optional, Pulsbahn-Züge als schöne Hochbahnwagen mit Fenstern (in `agents.js`). Leben (`views/life.js`): Fußgänger auf Gehwegen (instanziert, einfache Laufanimation per Shader, mehr bei Tag, Dichte nach Bewohnern und Gewerbe), Radfahrer, Vogelschwärme, Boote und Segelboote auf Wasser, Flugzeuge mit Kondensstreifen am Himmel, Heißluftballon selten.

### S1 – Wirtschaft & Industrie
Produktionsketten: Spezialindustrie (`farm`, `forest`, `mine`, `oil`) liefert Rohstoffe, Verarbeitung (`food_factory`, `sawmill`, `steelworks`, `refinery`) macht Waren, Gewerbe braucht Waren (Mangel senkt Gewerbe-Glück und Stufen), Export über Autobahn/`cargo_rail`/`cargo_harbor` bringt Geld (schwankende Preise), Lager puffern. Lieferverkehr (Lkw-Anteil) passend zur Produktion. Dienstbudgets (`g.serviceBudget[kategorie]` 50–150 %) mit Bedienung im Panel, Steuern pro Zone und Dichte, Wirtschaftslage (Konjunktur) mit Ereignissen. Panel „Wirtschaft" mit Produktions- und Exportübersicht, Diagramme. Infoansicht „Waren". Ausgewogen: Test zeigt stabile Wirtschaft.

### S2 – Bürger, Dienste & Bezirke
Altersgruppen (Kinder, Jugendliche, Erwachsene, Senioren) mit Geburt, Altern, Sterben; Bildungsstufen (Kita → Schule → Gymnasium → Universität) mit Wirkung auf Arbeitsmarkt und Stufen; Gesundheit (Krankheit, Ärzte, Krankenhaus) und **Bestattung** (Friedhof, Krematorium – sonst Leichenwagen-Stau und Unglück); **Abwasser** als dritte Versorgung (Kläranlage/Auslass, Netz wie Wasser, Wasserverschmutzung am Auslass); Fernwärme im Winter (mit `g.ext.weather.temp`); Gefängnis. **Bezirke**: Werkzeug zum Malen (`input/districts.js`), Namen, Farben, Grenzen und Namen in 3D (`views/districts.js`), Verordnungen pro Bezirk, Bezirksstatistik. Panels „Bevölkerung" (Alterspyramide, Bildung, Gesundheit) und „Bezirke".

### S3 – Verkehr & ÖPNV
Buslinien (Busdepot, Haltestellen an Straßen per Werkzeug, Busse fahren über das Straßennetz und halten), Straßenbahn optional, Fernbahn (Hauptbahnhof bringt Pendler und Touristen, Züge fahren ein), Flughafen (Flugzeuge starten/landen, Tourismus), Fähren zwischen Anlegern, Taxis, Parkhäuser, Ampeln an großen Kreuzungen (leichter Zeitverlust, weniger Unfälle), Verkehrsstatistik. Alles als `renderables`. Panel „Verkehr" mit Linien, Fahrgastzahlen, Auslastung. Die Pulsbahn bleibt; `metro_hub` als großer Umsteigebahnhof (doppelte Kapazität).

### S4 – Wetter, Jahreszeiten & Katastrophen
Jahreszeiten (ein Spieljahr = 4 Wochen je Jahreszeit oder sinnvoller Takt), Temperatur, Regen, Schnee, Nebel, Wind, Gewitter – mit Spielwirkung (Wasser- und Stromverbrauch, Heizbedarf, Glück, Tourismus, Freibad im Sommer). Katastrophen (Hochwasser am Fluss, Sturm, Tornado, Erdbeben, Blitzeinschlag, Waldbrand, Meteorit – im Optionsmenü abschaltbar), mit Vorwarnung (Wetterstation, Sirenen), Schäden (Trümmer), Rettung und Wiederaufbau (Katastrophenschutz, Notunterkünfte, Hochwasserschutz). Effekte in `views/disasterfx.js`. Panel „Wetter" mit Vorhersage und Katastrophenschutz.

### S5 – Fortschritt & Inhalte
Erfolge (mind. 40, mit Fortschrittsanzeige), Szenarien (mind. 8, z. B. „Flusstal-Rettung", „Inselbrücken", „Grüne Stadt", „Metro-Modus" im Stil von Mini Metro mit Punktzahl und Überfüllung = Ende), Ratgeber-Hinweise, mindestens 40 neue Wochenkarten, 40 neue Ereignisse mit Entscheidungen, 200 neue Stadtfunk-Meldungen (abwechslungsreich, mit Humor, passend zu den neuen Systemen). Auswahl der Szenarien im Hauptmenü (`MENU_SECTIONS`), Panel „Erfolge".

### U1 – Oberfläche & Bedienung
Die Oberfläche auf das neue Niveau bringen: Panels/Werkzeuge/Overlays aus den Registern sauber einbinden (mehr Kategorien, gruppierte Werkzeugleiste), **Baukatalog mit 3D-Vorschaubildern** der Gebäude (aus dem Prototyp-System gerendert), Minikarte, Benachrichtigungszentrale, Ratgeber, Fotomodus (Oberfläche ausblenden, freie Kamera, Tiefenschärfe falls G1 es anbietet), Einstellungen für Grafik (6.7), Tastenkürzel-Hilfe, schönere Tooltips und Übergänge, Ladebildschirm mit Fortschritt (Texturen/Modelle). Netzplan-Stil beibehalten und verfeinern. Handy-Layout pflegen.

### U2 – Klang
Klanglandschaft: Stadtatmosphäre nach Zoom und Ort (Verkehr, Menschen, Baustellen, Industrie, Natur, Wasser, Vögel am Tag, Grillen nachts, Regen, Wind, Donner), generative Musik mit mehr Struktur (Abschnitte, Tag/Nacht-Stimmung, Jahreszeiten), die Pulsbahn-Töne bleiben, mehr und bessere Effektklänge. Alles mit WebAudio, Lautstärken aus `settings`.

## 9. Was „fertig" heißt
- Build läuft, Simulationstest läuft, keine `PAGEERROR`.
- Eigene Screenshots angesehen und mehrfach verbessert (mindestens drei Iterationen bei Grafik-Rollen).
- Budgets eingehalten.
- Commit(s) im eigenen Worktree-Branch.
- Abschluss-Bericht wie in 7.9.
