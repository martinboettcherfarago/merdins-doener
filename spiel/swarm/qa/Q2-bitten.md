# Bitten von Q2 (Spielbalance & Simulation)

Gemessen mit dem Bot-Prüfstand `test/playthrough-test.mjs` (normales Spiel, Flusstal und Küste, Saat 7 und 11)
und `test/scenario-test.mjs` (alle Szenarien außer Inselbrücken und Metro).

## Q4 – Kern (`src/config.js`, `src/sim/transit.js`, `src/sim/game.js`, `src/sim/demo.js`)

### 1. Absturz: Pulsbahn-Linie mit doppelter Station (hoch)
`game.createLine([4, 4], false)` wirft in `transit.js` `linePose` einen `TypeError` (alle Punkte der Linie liegen
übereinander, `pts.length === 1`). Die Oberfläche verhindert das vermutlich, Skripte und Szenarien nicht.
```js
// game.js, createLine – nach der Prüfung auf stops.length < 2
if (new Set(stops).size !== stops.length) return { ok: false, msg: 'Jede Station nur einmal pro Linie.' };
```

### 2. Pulsbahn: zu wenig Fahrgäste, dauernd überfüllt (hoch, Kern der Bekannten Punkte)
**Ursache:** Züge fahren in echten Sekunden (`TRANSIT.speed` 3,2 Felder/s bei 1×), Fahrgäste entstehen aber pro Spielminute.
Ein Spieltag dauert 30 s → ein Zug schafft auf einer 25–30 Felder langen Linie nur etwa drei Fahrten pro Spieltag
(eine Rushhour ist kürzer als eine Fahrt). Gemessen (Verkehrsinfarkt, Tag 30): **14 Züge mit 37 Waggons = ≈ 450 Fahrgäste/Tag**,
**4 Buslinien mit je 2 Bussen (S3) = ≈ 1.800 Fahrgäste/Tag**. Die Pulsbahn ist pro Fahrzeug 15-mal schwächer als der Bus.
Gleichzeitig liegen im Mittel **13–24 % aller Wohnhäuser** im Umkreis einer überfüllten Station (−10 Glück, `services.js`).
Gemessen mit `TRANSIT.baseCapacity = wagonCapacity = 12` (statt 6) und `stationCapacity = 24`:
Fahrgäste/Tag 145 → 271, 88 → 674, 201 → 547 (Bot, Tag 75), Überfüllung unverändert 16–28 %.
**Vorschlag** (eins davon reicht, 2a ist am einfachsten):
- 2a. `TRANSIT.baseCapacity: 12, wagonCapacity: 12` (Züge fassen 12/24/36/48).
- 2b. Ein Wartesymbol steht für mehrere Fahrgäste: `TRANSIT.paxPerIcon = 6` und in `arrive()` `deliveredToday += TRANSIT.paxPerIcon`,
  `faresToday += TRANSIT.fare * TRANSIT.paxPerIcon` (Metro-Modus mit 1).
- Überfüllung: in `spawnPassengers` außerhalb des Metro-Modus keine neuen Fahrgäste, wenn `st.waiting.length >= TRANSIT.stationCapacity`
  (die Leute nehmen dann das Auto) – oder `services.js` „Überfüllte Station" −10 → −5.
Falls 2a/2b kommt: Q2 passt die Fahrgastziele an (Inselbrücken nutzt `G.riders(100)`). Verkehrsinfarkt zählt jetzt ÖPNV gesamt.

### 3. `placeAtShore` (demo.js) baut Straßen, bevor geprüft ist, ob das Gebäude passt (mittel)
Für 2×2-Gebäude (Kläranlage) wird nur das Feld oben links auf Wassernähe geprüft, Drehungen gar nicht; `checkPlace` scheitert
dann oft – die Zufahrtsstraße ist aber schon gebaut und bezahlt. Darum findet die Kläranlage in der Teststadt keinen Platz.
Vorlage, die zuverlässig klappt: `shorePlace()` in `test/bot.mjs` (Grundstück samt Drehung prüfen, Wasser an einer Kante,
Zufahrt per Breitensuche bis ans Netz, erst dann bauen).

### 4. Zufall im Verkehr – erledigt
Mit Q4s `g.traffic.rng` und Q2s Umstellung in `industry.js` ist die Simulation reproduzierbar (zwei Läufe gleicher Saat sind identisch).

### 4b. Müllabfuhr (Hinweis, erledigt bei Q2)
Ursache der vielen Müll-Symbole in Beispiel- und Teststadt: Beide Deponien liegen südlich der Hauptstraße, die Abdeckung (15 Felder
vom Mittelpunkt) erreicht die nördlichen Wohnreihen nicht (Beispielstadt: 21 von 98 Häusern ohne Abdeckung, Deponien zu 7–13 % ausgelastet).
Q2 hat die Reichweite in `content/services.js` angehoben (Deponie 20, Verbrennung 24, Recycling 22) → 0 Problemhäuser bei 2.000 Einwohnern.
Optional für `demo.js`: zweite Deponie nördlich (`place('landfill', x0 + 29, hy - 13)`).

## Q3 – Oberfläche

### 5. Pumpwerk neben Abwasserauslass (mittel)
Ein Pumpwerk bis etwa 20 Felder Wasserweg vom Auslass liefert verschmutztes Trinkwasser (bis −16 Glück und Krankheit für die ganze Stadt).
Ein Mensch baut beides billig nebeneinander. Bitte beim Platzieren von `pump`/`waterworks` und `sewage_outlet` einen Hinweis im
Tooltip zeigen, wenn `g.ext.citizens.waterPol` am Bauplatz > 0,1 ist (bzw. ein Pumpwerk näher als 20 Felder steht):
„Achtung: Hier ist das Wasser verschmutzt." (Texte in `content/services.js` und im Ratgeber sind angepasst.)
