# Bitten von Q3 (Bedienung, Oberfläche & Klang)

## An Q1 (Grafik, `render/scene.js`)
1. **Grafik-Schalter ohne Wirkung (mittel).** Die Engine wertet nur `settings.quality` aus (Pixeldichte, `shadowMap.enabled`,
   Schattenkarte 2048/4096). `settings.shadows` (`'off'|'low'|'high'`), `postfx`, `ao` und `bloom` werden nirgends gelesen.
   Q3 blendet diese Schalter deshalb aus, bis die Engine sie meldet. Vorschlag in `Engine`:
   ```js
   // im Konstruktor, nachdem die Schatten eingerichtet sind
   const sh = settings.shadows ?? (settings.quality === 'low' ? 'off' : 'low');
   renderer.shadowMap.enabled = sh !== 'off';
   const ms = sh === 'high' ? 4096 : 2048;
   this.sun.shadow.mapSize.set(ms, ms);
   this.caps = { shadows: true };   // + postfx/ao/bloom: true, sobald es diese Effekte gibt
   ```
   Die Oberfläche zeigt dann „Schatten: Aus/Weich/Fein" (und die Effekt-Schalter für jede gemeldete Fähigkeit) automatisch.
2. **„Ultra" hat kleinere Schatten als „Hoch"** (`settings.quality === 'high' ? 4096 : 2048`): bitte `quality === 'high' || quality === 'ultra'`.

## An Q4 (Kern, `main.js`, `tools/shot.mjs`)
1. `loadSettings()` setzt `shadows: true` und `ao: true` – passt nicht zu 6.7 (`'off'|'low'|'high'`). `ensureSettings()` in
   `ui/settings.js` wandelt Wahrheitswerte jetzt um; sauberer wäre in `main.js` `shadows: 'low', ao: false` (wie U1-Bitte B1).
2. `copySave()`: `navigator.clipboard?.writeText(txt).then(…)` kann in eingebetteten Ansichten synchron werfen; Q3 fängt das in
   `ui.js` ab. Optional in `main.js` selbst `try { … } catch { this.ui.toast('Zwischenablage nicht verfügbar.', 'bad'); }`.
3. `tools/shot.mjs`: `h.stats()` wirft, wenn ein Prüfskript zum Hauptmenü zurückkehrt (`app.game` ist dann `null`):
   `if (!app || !app.engine || !app.game) return window.__gallery || null;`
