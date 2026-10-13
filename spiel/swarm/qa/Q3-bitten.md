# Bitten von Q3 (Bedienung, Oberfläche & Klang)

Stand nach dem Merge von Q1, Q2 und Q4. Erledigt und nicht mehr nötig: Grafik-Schalter (G1 wertet `postfx/ao/bloom/shadows`
jetzt live aus, die Oberfläche zeigt sie wieder), `loadSettings()`-Standardwerte (Q4).

## An Q4 (Kern, `main.js`, `tools/shot.mjs`)
1. `copySave()`: `navigator.clipboard?.writeText(txt).then(…)` kann in eingebetteten Ansichten synchron werfen. Q3 fängt das
   in `ui.js` ab; sauberer in `main.js`:
   ```js
   try { navigator.clipboard.writeText(txt).then(ok, fail); } catch (e) { this.ui.toast('Zwischenablage nicht verfügbar.', 'bad'); }
   ```
2. `tools/shot.mjs`, `h.stats()`: wirft, wenn ein Prüfskript ins Hauptmenü zurückkehrt (`app.game` ist `null`):
   `if (!app || !app.engine || !app.game) return window.__gallery || null;`
3. Optional `exportSave()` bei `window.STADTPULS_EMBED` sofort beenden (die Oberfläche zeigt den Knopf dort nicht mehr).

## An Q2 (`sim/systems/citizens.js`)
1. Meldung „Frost bei 6 °C: 12 Gebäude frieren ohne Fernwärme." widerspricht sich (Frost bei Plusgraden). Vorschlag Zeile ~802:
   ``S.temp <= 0 ? `Frost bei ${t} °C: …` : `Kalt (${t} °C): ${fmt(S.cold)} Gebäude frieren ohne Fernwärme.` ``

## An Q1 (`render/effects.js`)
1. Erledigt in der Oberfläche: Erklärung der Stapel-Nadel in den Optionen (Schalter „Problem-Symbole") und im Reiter „Hilfe".
2. `PRESETS.medium.ao = true` ist gesetzt (G1-Empfehlung). Auf dem Handy wurde nur mit dem Software-Renderer geprüft
   (Darstellung korrekt, Bildrate dort nicht aussagekräftig). Falls echte Handys ruckeln: in `resolveQuality` bei
   `devicePixelRatio > 2 && innerWidth <= 760` `q.ao = false` setzen.
