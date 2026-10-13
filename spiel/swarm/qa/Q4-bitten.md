# Bitten von Q4 (Kern, Robustheit & Spielstände)

Neu im Kern (alles rückwärtskompatibel, Doku in `src/registry.js` oben):

| Schnittstelle | Wirkung |
|---|---|
| `g.traffic.freightShare` (Standard 0,28) | Gewicht des pauschalen Lkw-Verkehrs in `spawnTrip`; 0 = ein System fährt seinen Güterverkehr selbst |
| `g.eff('roadSpeed')` | Tempo aller Fahrzeuge auf Straßen (−0,3 = 30 % langsamer, Untergrenze 15 %) |
| `g.tileDelay` (Float32Array N) | zusätzliche Fahrzeit-Anteile pro Straßenfeld (0,27 = 27 % langsamer); wirkt in `tileCost` (Wegesuche), `advance` (Autos) und im Verkehrsfluss. Der Kern setzt es **nie** zurück – wer schreibt, setzt selbst zurück (z. B. `g.tileDelay.fill(0)` am Anfang des eigenen Stundentakts) |
| `g.eff('powerUse')` | Mehrverbrauch Strom aller Gebäude (+0,2 = 20 % mehr) |
| `POWER_MODIFIERS.push((g, b, leistung) => neueLeistung)` | Leistung einzelner Kraftwerke (Solar nach Sonne, Wind nach Wind), angewendet in `computeUtilities` je Netz |
| `g.traffic.rng` | reproduzierbarer Zufall (statt `Math.random`), Zustand wird gespeichert |
| `g.isRepairing(b)` | Gebäude wird nach einer Katastrophe repariert (`g.ext.disasters.repairs[b.id]`) |
| Symbol `'repair'` | Schraubenschlüssel, registriert in `main.js` (`registerIcon`) |
| `g.year()` | 112-Tage-Jahr; nimmt `g.ext.weather.year`, wenn vorhanden |
| `offBoost` | Kern zählt `offBoost × 0,5` aller versorgten Gebäude zur Büro-Nachfrage – außer `research`, solange das Bürger-System läuft (S2 zählt das selbst) |
| `SPEC_MAX_LEVEL` (config.js, 5) | Spezialindustrie wächst jetzt bis Stufe 5 (vorher fest 3) |
| `g.errors`, `on('simError')` | abgefangene Fehler aus Systemen/Ereignissen `{ where, msg, day }`; das Spiel läuft weiter (einmalige `console.warn` je Stelle) |
| `Game.fromSave(objekt \| text)` | prüft und bereinigt; unbrauchbar → `SaveError` mit deutscher Meldung; Hinweise in `g.loadNotes` |
| `app.loadData(data, { quiet: true })` | lädt ohne Toast (U1-Bitte); gibt `true`/`false` zurück, ebenso `app.loadSlot(k)` und `app.save(k)` |
| `LANDVALUE_FIELDS.push((g) => Float32Array(N) \| null)` | zusätzlicher Bodenwert als ganzes Feld, ein Aufruf pro Durchlauf (statt `LANDVALUE_TERMS` pro Feld). `LANDVALUE_TERMS` mit nur einem Parameter `(g) => …` wertet der Kern jetzt einmal pro Durchlauf aus |

## Q1 – Grafik (`render/effects.js`)

1. **Reparatur-Symbol** (S4-Bitte): `updateIcons` überspringt `construct < 1`. Vorschlag:
   ```js
   if (b.construct < 1) { if (g.isRepairing && g.isRepairing(b) && ICON_INDEX.repair !== undefined) put(b, ICON_INDEX.repair); continue; }
   ```
   Das Symbol `repair` ist registriert (orange Schraubenschlüssel); `ICONS.slice(0, 24)` reicht (zurzeit 10 registrierte Symbole).

## Q2 – Simulation (`sim/systems/**`)

### Leistung (gemessen mit `node tools/bench.mjs --profile`, 128², 8 275 Gebäude, alle Systeme)
Rechenzeit ≈ 2,3–3,0 s CPU pro Spieltag, davon **≈ 42 % allein `industry.js` `tick()`**, Spitzen am Stundenwechsel 170–800 ms
(ein Bild steht so lange). Kern-Anteil nach meinen Änderungen ≈ 11 ms pro Spielstunde.
1. **`industry.js` Zeile ~526** (Verteilung nach Entfernung): `for (const sh of shops) for (const [px, py, m] of pts) Math.hypot(...)` –
   Läden × Bezugsquellen (bei 1 300 × 1 300 ≈ 1,7 Mio. Abstände pro Stunde, mit Array-Destrukturierung). Vorschlag: einmal pro Stunde
   ein Abstandsfeld je Quellenart (Fabriken/Verarbeitung `m = 1`, Lager `0,5`, Umschlag `0,8`, Autobahn `1,2`) mit einem
   Zwei-Pass-Chamfer über das Raster (O(N), 128² = 16 384 Felder) und `sh.dist = min(m_c · D_c[feld])`; oder Quellen in ein
   8×8-Gitter einsortieren und nur Nachbarzellen prüfen. Zumindest `pts` als flaches `Float32Array` ohne Destrukturierung.
2. `citizens.js` `hourly`: `collectFacilities`, `sewageHourly`, `heatHourly` laufen je einmal über alle Gebäude (≈ 20 ms/Stunde) – in einen
   Durchlauf zusammenlegen oder Abwasser/Wärme nur alle 2–3 Stunden bzw. bei `g.netVersion`-Änderung neu rechnen.
3. `LANDVALUE_TERMS` mit `(g, i)` aus `citizens.js`, `districts.js`, `industry.js`, `transport.js` laufen pro Feld (4 × N Aufrufe alle
   2 Spielstunden; `computeFields` ist im `progression-test` mit 11 % Eigenzeit die teuerste Kernfunktion). Wer ein ganzes Feld hat
   (`T.lvField`, `C.lvWater`/`C.lvSew`), bitte auf `LANDVALUE_FIELDS.push((g) => T0(g)?.lvField || null)` umstellen.
3b. Viele kleine Rückgabe-Arrays (`HAPPINESS_FACTORS` → `['…', wert]`, `pts.push([x, y, m])`) erzeugen Müll; der Garbage Collector
   braucht 9–15 % der Zeit.

### Reproduzierbarkeit
4. `industry.js` Zeilen ~749/754: `Math.random()` und `end.sample(Math.random)` → bitte `g.traffic.rng` (oder `g.rng`) nehmen.
   Danach ist die ganze Simulation ohne Eingriff reproduzierbar (`test/save-test.mjs` meldet die Stelle als Hinweis).
   `progression.js` Zeile ~810: Metro-Startwert per `Math.random` ist ok (nur Menü), Tests geben `seed` vor.

### Speichern/Laden (gefunden mit `node test/save-test.mjs`, streng mit `STRICT=1`)
5. **`citizens.js`: `umlandCost` wird nicht gespeichert** → nach dem Laden fehlt der Haushaltsposten „Bestattung im Umland" bis zum
   nächsten Tag. Das lässt `industry-test` „Haushalt nach dem Laden gleich" scheitern (z. B. 2 060 / 2 240 €/Tag, Differenz = `czUmland`).
   Vorschlag: `umlandCost`, `umlandToday`, `collectedToday` in `serialize`/`load` aufnehmen.
6. `citizens.js` `ext.citizens.vals` ist nach Laden → Speichern nicht identisch (Quantisierung in `serialize` ist nicht idempotent
   oder `load` rechnet Werte um).
7. `transport.js`: `load` vergibt Fahrzeug-IDs neu (`next[2]` springt, z. B. 3 → 5) – harmlos, aber Fahrzeuge ändern bei jedem Laden ihre ID.
8. `disasters.js`: `displaced` und `dmg` werden in `load` neu berechnet und weichen vom gespeicherten Wert ab (z. B. 195 → 228).
9. `weather.js` `load` ruft `applyEffects` → die gleitende Stimmung `I.mood` macht einen Schritt, und „Wetter: Strombilanz" verliert beim
   Laden den Heizanteil (z. B. −10 % → +3 %) bis zur nächsten Stunde. Vorschlag: in `load` nur `exportForecast`, die Effekte liegen schon
   in `g.effects`; oder `applyEffects(g, { noSmooth: true })`.

### Prüfstände (`test/**`)
9b. `industry-test` „Bauernhöfe ernten im Winter weniger" (schon vor Q4 rot): Der Test setzt `g.ext.weather.season = 'winter'`, aber
    `weather.js` schreibt `w.season` in jedem Schritt aus dem Kalender zurück. Besser: `g.time` auf einen Wintertag setzen
    (Tag `28 · 3 − 3` = 81 ff.) oder `g.system('weather').force(…)`.
9b2. `transport-test` „Straßenbahnlinie auf der Hauptachse eröffnet" ist **wackelig** (1 von 4 Läufen rot: „Nicht genug Geld."): Der Bot prüft
    `g.money > 22000`, baut dann Depot und Linie nach einem weiteren Tag. Ursache des Zufalls ist `Math.random` in `industry.js` (Punkt 4);
    zusätzlich die Schwelle an die echten Kosten (`planLine(...).cost` + Depot) koppeln.
9c. `test/save-test.mjs` (neu, Q4) prüft Rundreisen, Version 1, beschädigte Daten, alle Karten, Reproduzierbarkeit; `STRICT=1` macht
    die offenen Systemdaten-Abweichungen (Punkte 5–9) zu Fehlern.

### Kern-Schnittstellen jetzt nutzen (Übergangslösungen ablösen)
10. S1: statt stündlich `g.traffic.lists.ind.total = 0` → `g.traffic.freightShare = 0` (einmal in `init`/`load` oder solange der Plan läuft).
11. S3: Ampel-Wartezeit über `g.tileDelay` statt `g.congestion` anheben (dann bleibt die Auslastungs-Infoansicht ehrlich);
    am Anfang von `adjustCongestion`: `g.tileDelay.fill(0)`, an Ampeln `g.tileDelay[i] = 0.27`, Unfälle `g.tileDelay[a.tile] = 1.5`.
12. S4: Heizen/Kühlen über `setEffect(g, 'powerUse', …)` statt Abschlag in `powerMul`; Solar/Wind über `POWER_MODIFIERS`;
    Schnee/Glätte/Hochwasser über `setEffect(g, 'roadSpeed', −…)` (z. B. `−0,35 · snowCover − 0,15 · glätte`).
13. S2: `offBoost` anderer Gebäude zählt jetzt der Kern; `research` zählt weiterhin `citizens.js` (Kern überspringt es, solange
    `g.ext.citizens` existiert). Wer es umstellen will: `C.offBoost` weglassen und die Bedingung in `city.js` `aggregate` entfernen.
14. S1/Balance: Spezialindustrie erreicht jetzt Stufe 4–5 (`SPEC_MAX_LEVEL`). Falls das zu stark ist, Wert in `config.js` senken.

## Q3 – Oberfläche

15. `g.loadNotes` (Hinweise beim Laden, z. B. „7 beschädigte Gebäude wurden entfernt.") zeigt `main.js` bereits als Toast.
    Optional: `on('simError', ({ where }) => ui.toast('Ein Spielteil hatte einen Fehler und läuft eingeschränkt weiter.', 'bad'))`.
16a. **Speichern meldet immer Erfolg**: `ui.js` Zeile ~67 und ~926 zeigen „Gespeichert in Platz …" unabhängig vom Ergebnis. `app.save(k)`
    gibt jetzt `false` zurück, wenn der Browser-Speicher voll ist (große Karten > 1 MB pro Platz, Grenze ≈ 5 MB) – `main.js` zeigt dann
    eine Warnung. Vorschlag: `if (app.save(k)) ui.toast('Gespeichert …', 'good');`
16. Einstellungen: `loadSettings()` in `main.js` liefert jetzt die Werte laut 6.7 (`ao: false`, `shadows: 'low'`, `minimap`, `advisor`,
    `tooltips`, `ambience`); alte gespeicherte `shadows: true/false` werden zu `'low'`/`'off'`. `ensureSettings()` kann bleiben.
