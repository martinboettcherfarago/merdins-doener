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
1. **Einstellungen:** Schalter „Bauen bestätigen" für `app.settings.confirmPlace` mit drei Werten:
   `'auto'` „Bei Touch (Standard)", `'always'` „Immer", `'never'` „Nie – sofort bauen". Danach `app.saveSettings()`.
   Fehlt der Wert, gilt `'auto'` (input.js liest `settings.confirmPlace || 'auto'`, kein Eintrag in `main.js` nötig).
2. **Werkzeug-Hinweis** (`ui.js`, `renderToolHint`): Auf Touch passen „Ziehen zum Bauen" / „Fläche aufziehen" /
   „Rechtsklick oder Enter beendet" nicht mehr. Vorschlag: wenn `this.app.input.lastType !== 'mouse'` (bzw. `this.mobile()`):
   ```js
   const touch = input && input.lastType && input.lastType !== 'mouse';
   // road:  hint = touch ? 'Start und Ziel antippen · ✓ baut' : 'Ziehen zum Bauen';
   // zone/dezone/bulldoze: hint = touch ? 'Fläche antippen, Griffe ziehen · ✓' : 'Fläche aufziehen';
   // place: hint = touch ? 'Antippen: Vorschau · ✓ baut' : …;   line: touch ? 'Stationen antippen · Fertig' : '… Rechtsklick oder Enter beendet'
   ```
   Die Knöpfe „Drehen"/„Fertig" im Hinweis dürfen bleiben (sie wirken auch auf die Vorschau), können aber ausgeblendet werden,
   solange `this.app.input.bar.visible` ist – die Leiste hat dieselben Knöpfe.
   Ein Neuzeichnen nach dem Antippen auslösen: `input.js` ruft bei Werkzeugwechsel ohnehin `ui.toolChanged`; für die Stationszahl
   der Linie reicht das bisherige Verhalten.
3. **`ui.tourTarget(id)`** sucht nur in `#hud`. Die Leiste hängt (wegen `zoom` auf `#hud`) direkt an `document.body`.
   Bitte als Rückfall: `if (!el) el = vis(document.querySelector('.placebar ' + sel(id)));` – dann kann EINSTIEG auf
   `place-ok` zeigen.
4. **Tastenhilfe** (`keys.js`, Zeile „Auf dem Handy: …"): bitte ergänzen: „Antippen setzt eine Vorschau, ✓ baut, ✕ verwirft.
   Ziehen verschiebt die Karte, die Vorschau oder die Griffe."
5. Look: Die Leiste nutzt `--accent`, `--accent-ink`, `--accent-soft`, `--cta`, `--cta-2`, `--cta-edge`, `--card`, `--f-ui`, `--bad`
   (alle mit Rückfallwerten). Sie liegt mit `z-index: 47` über Panels, Werkzeugleiste, Meldungen (40) und der Einführungskarte
   (`#ob-layer` 46), unter Dialogen (60); die Griffe liegen bei 27. Sie hält 64 px Abstand nach oben und 86 px nach unten
   (Kopfzeile/Werkzeugleiste) und weicht `#ob-layer .ob-card` und `#ob-guide` aus. Linienentwürfe docken unten mittig an.

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
