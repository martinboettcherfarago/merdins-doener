# Bitten von TOUCH (Runde 3b – sicheres Bauen per Touch)

Kurz, wie es jetzt läuft (für Texte, Einführung und Einstellungen):
- **Touch/Stift** (Einstellung `app.settings.confirmPlace`, Standard `'auto'`): Antippen setzt nur eine **Vorschau**.
  Gebaut wird erst mit **✓** in der schwebenden Leiste (`src/ui/placebar.js`, `.placebar`). Daneben **↻ Drehen** (Gebäude),
  **↶ Zurück** (Linien) und **✕ Abbrechen**. Ungültiger Platz: ✓ grau, darüber der Grund.
- Vorschau ziehen = verschieben; Ziehen auf freier Karte = Kamera; zwei Finger = Zoomen/Drehen; Finger kurz halten und ziehen =
  Vorschau bzw. Strecke direkt aufziehen.
- Straßen, Zonen, Abriss, Bezirke: Antippen = Startpunkt, zweites Antippen = Ziel, oder den Griff ziehen. Beide Enden haben Griffe.
- U-Bahn-, Bus- und Straßenbahnlinien: Stationen antippen (leichtes Verrutschen zählt als Tippen), **„Fertig"** in der Leiste
  schließt ab. Doppeltippen auf die letzte Station schließt per Touch **nicht** mehr ab.
- Maus: unverändert (Klick baut, Ziehen baut beim Loslassen). `'always'` = auch mit der Maus bestätigen, `'never'` = altes Verhalten
  auch auf Touch (Straßen/Zonen beim Loslassen, Gebäude beim zweiten Tippen).
- Schnittstelle: `app.input.pend` (null oder `{kind: 'point'|'rect'|'tap', …}`), `app.input.bar.visible`,
  `app.input.barAction('ok'|'cancel'|'rotate'|'undo')`. Knöpfe tragen `data-tour="place-ok" | "place-cancel" | "place-rotate"`.

## An DESIGN
0. Erledigt aus `DESIGN-bitten.md`: `confirmPlace` wird bei jedem Antippen frisch aus `app.settings` gelesen; Abstand unten
   rechnet mit `--gap` + `--bb-h` + 16 px (mal `--ui`); Stil nutzt `--card`, `--shadow-s`, `--f-display`, `--o-grad`/`--o-edge`
   (✓), `--v-grad`/`--v-edge` (✕), `--accent-soft`/`--accent` (↻, ↶, gesperrt mit `--ink-3`), Grund in `--bad`; Bezirke erst ab
   Stufe 2 (`lockText` in `src/input/districts.js`).
1. **Doppelte Knöpfe im Werkzeug-Hinweis:** Solange die Leiste steht, trägt `<html>` die Klasse **`placebar-on`**. Bitte dann
   `.th-b` („Drehen", „Fertig") im Hinweis ausblenden, z. B. `html.placebar-on .toolhint .th-b { display: none; }`.
2. **Hinweistexte auf Touch** (`renderToolHint`): „Ziehen zum Bauen" / „Fläche aufziehen" / „Rechtsklick oder Enter beendet"
   passen auf Touch nicht. Vorschlag:
   ```js
   const touch = input && input.lastType && input.lastType !== 'mouse';
   // road: touch ? 'Start und Ziel antippen · ✓ baut' : 'Ziehen zum Bauen'
   // zone/dezone/bulldoze: touch ? 'Antippen, Griffe ziehen · ✓' : 'Fläche aufziehen'
   // line: touch ? 'Stationen antippen · Fertig' : '… Rechtsklick oder Enter beendet'
   ```
3. **`ui.tourTarget(id)`** sucht nur in `#hud`. Die Leiste hängt (wegen `zoom` auf `#hud`) direkt an `document.body`.
   Bitte als Rückfall: `if (!el) el = vis(document.querySelector('.placebar ' + sel(id)));` – dann kann EINSTIEG auf
   `place-ok` zeigen.
4. **Tastenhilfe** (`keys.js`, Zeile „Auf dem Handy: …"): bitte ergänzen: „Antippen setzt eine Vorschau, ✓ baut, ✕ verwirft.
   Ziehen verschiebt die Karte, die Vorschau oder die Griffe."
5. Ebenen: Leiste `z-index: 47` (über Panels, Werkzeugleiste, Meldungen 40 und Einführungskarte `#ob-layer` 46, unter Dialogen 60),
   Griffe 27. Sie hält 64 px Abstand nach oben, unten das Dock-Maß, und weicht `#ob-layer .ob-card`, `#ob-guide` und `#u-legend`
   aus. Linienentwürfe docken unten mittig an.

## An EINSTIEG
0. Erledigt (eure Bitte): Die Leiste liegt nicht mehr unter `#ob-layer .ob-card` (z-index 47 und Ausweichen).
   Euer Text „Tippe … ziehe den Griff … prüfe die Vorschau, dann tippe auf ✓ Bauen" passt: Der Knopf heißt bei Gebäuden,
   Straßen **und Zonen** „Bauen" (bei Abriss „Abreißen", bei Linien „Fertig"). Gebaut wird über dieselben Spielfunktionen,
   eure Erkennung am Spielzustand greift also.
1. Einführungsschritte, die auf „Straße/Zone/Gebäude gebaut" warten, funktionieren weiter (gebaut wird über dieselben
   Spielfunktionen) – auf Touch braucht es nur einen Schritt mehr: **✓ tippen**. Bitte in den Texten für Touch erwähnen, z. B.
   „Tippe Start und Ziel an und dann auf ✓". Ziel für den Zeiger: `ui.tourTarget('place-ok')` (sobald DESIGN Bitte 3 umsetzt;
   bis dahin `document.querySelector('[data-tour=place-ok]')`). Ob gerade eine Vorschau wartet: `app.input.pend`.
2. Hilfe-Thema „Bauen auf dem Handy/Tablet" (Text siehe oben, „Kurz, wie es jetzt läuft").

## An UBAHN
- Das Linien-Werkzeug (`line`/`extend`) bleibt in `input.js`. Per Touch: Antippen ruft wie bisher `lineClick(t)` (baut die Station
  sofort), „Fertig" ruft `finishLine()`, „↶" entfernt nur die letzte Station aus `input.lineStops` (die Station bleibt stehen).
  Für die Leiste nutzt input.js `g.linePlanCost(stops, false)` und `g.transit.stations`. Wenn sich daran etwas ändert
  (z. B. andere Kostenfunktion oder Stationen unter der Erde mit anderer Lage), bitte hier melden.
- Geprüft nach eurem Merge (`test/touch-test.mjs`): Stationen antippen, leichtes Verrutschen, Kamera ziehen, ↶ und „Fertig"
  funktionieren in der Untergrund-Ansicht (Antippen trifft weiter die Bodenebene).
