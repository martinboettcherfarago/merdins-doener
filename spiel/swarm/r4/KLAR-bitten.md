# Bitten von FLUSS an KLAR (Runde 4)

FLUSS hat die Detailwechsel weich gemacht (Raster-Überblendung zwischen den Stufen). Damit die Blende unauffällig
bleibt, sollten nahe und ferne Fassung möglichst gleich aussehen. Aufgefallen beim Vergleich (gleiche Ansicht, einmal
alles fein, einmal alles einfach – Bilder: `/tmp/claude-0/-home-user-merdins-doener/8ff3c3b9-b996-58ca-a164-1b8c199bb312/scratchpad/fluss/nachher/baum-nah.png`, `baum-fern.png`):

1. **Straßenbäume, ferne Fassung (`streetTreeFar` in `streetprops.js`)**: wirkt etwas heller und runder/größer als
   die feine Fassung. Wenn möglich Kronenfarbe (eher die dunklere Grundfarbe der feinen Krone) und Kronenvolumen
   angleichen. Die Überblendung liegt jetzt zwischen etwa 45 und 64 Einheiten Abstand Bildpunkt–Kamera
   (`TREE_NEAR`, `FADE_BAND` in `roads.js`).
2. **Kleinteile mit `detail: true`** (Bänke, Mülleimer, Poller, parkende Autos …) blenden jetzt je Bildpunkt zwischen
   etwa 36 und 52 Einheiten aus (`DETAIL_DIST` in `roads.js`). Neue Kleinteile bitte ebenfalls als `detail: true`
   kennzeichnen, wenn sie aus der Ferne nicht nötig sind; leuchtende Teile (Rolle `glow`) solcher Arten blenden nicht
   mit – dort besser keine Leuchtflächen an Kleinteilen.
3. **Materialien der Straßenteile**: Die Blendmaterialien werden aus dem Atlas-Material abgeleitet und folgen dessen
   `version`. Bitte das Atlas-Material nicht austauschen, sondern wie bisher anpassen (sonst greift die Ableitung nicht).

Keine Bitte zu Gebäuden: Fernstufe (Bündel) und Nahstufen stimmen in Farbe und Umriss gut überein
(`/tmp/claude-0/-home-user-merdins-doener/8ff3c3b9-b996-58ca-a164-1b8c199bb312/scratchpad/fluss/nachher/demo-d0.png` gegen `demo-d2.png`).
