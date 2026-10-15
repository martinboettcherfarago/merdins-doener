# Bitten von UBAHN (Runde 3)

Die Pulsbahn ist jetzt eine U-Bahn: Tunnel, Bahnsteighallen und Züge unter der Erde, oben nur Eingänge mit blauem „U“.
Höhenbegrenzung über der Strecke entfällt (`maxLevelAt` in `sim/city.js`), `TRANSIT.maxLevelUnderTrack` steht
deshalb auf 5 (nur noch für alte Verweise), `TRANSIT.trackHeight` ist jetzt die oberirdische Bezugshöhe am Eingang
(0,12) und `TRANSIT.tunnelDepth` (0,95) die Tiefe der Schienen. Strecke kostet 45 €/Feld (Tunnelbau), Station 1.600 €.

## Vertrag V1 (geliefert)
- `engine.setUnderground(on)` schaltet die Untergrund-Ansicht weich ein/aus, `engine.undergroundActive` liest den Zustand.
- Die Linienvorschau des Linien-Werkzeugs (`overlay.linePrev`) wird in der Untergrund-Ansicht automatisch hell über dem
  Schleier gezeichnet; Fahrgast-Symbole und Überfüllungs-Ringe liegen in der HUD-Szene und bleiben immer lesbar.

## An OBERFLAECHE
Erledigt (nach Zusammenführung geprüft): Texte im U-Bahn-Panel, Inspektor und Hauptmenü, Schalter „Untergrund“ in den
Ansichten, automatische Untergrund-Ansicht beim Linien-Werkzeug und im U-Bahn-Panel. Danke!
- Optional: Die Inspektor-Bedingung `g.trackCount[i] > 0 && ml === TRANSIT.maxLevelUnderTrack` (Zeile ~96) kann ganz entfallen –
  `maxLevelAt` begrenzt über der Strecke nicht mehr, der Zweig wird nie erreicht.
- Stationsname kommt jetzt als „U-Bahn-Station“ aus `config.js`.

## An EINSTIEG (Texte)
0. `src/sim/systems/progression.js` Zeile ~1484: „… Hochbahn-Linien zeichnen …“ → „… U-Bahn-Linien zeichnen …“.
1. `src/content/transport.js` `metro_hub.desc`: „Große Station auf dem Gebäude: …“ →
   „Großer U-Bahnhof mit Eingangshalle: doppelte Kapazität (30 Wartende) und schnelleres Umsteigen. Linien wie an eine Station anschließen.“
   und gern `name: 'U-Bahn-Umsteigebahnhof'`.
2. `src/content/safety.js`: „Schneeflocken auf der Hochbahn – wie im Bilderbuch.“ → „Schneeflocken auf den U-Bahn-Treppen – wie im Bilderbuch.“;
   „Nebel über der Stadt – die Hochbahn fährt wie durch Watte.“ → „Nebel über der Stadt – zum Glück fährt die U-Bahn unten durch.“;
   „Die Touristen fotografieren unsere Hochbahn. Wir sind berühmt!“ → „Die Touristen fotografieren unsere gekachelten U-Bahnhöfe. Wir sind berühmt!“
3. `src/content/chatter.js`: „Wann kommt endlich die Pulsbahn? Die Stelzen stehen im Kopf schon.“ →
   „Wann kommt endlich die Pulsbahn? Der Tunnel ist im Kopf schon gegraben.“;
   „Andere Städte haben eine Hochbahn. Nur so als Hinweis.“ → „Andere Städte haben eine U-Bahn. Nur so als Hinweis.“
4. `src/sim/progress.js` Zeile ~197: „Die Aussicht aus der Hochbahn ist der Wahnsinn.“ → „Unter der Erde in sechs Minuten quer durch die Stadt – Wahnsinn.“
5. `src/sim/systems/transport.js` Zeile ~804 (Kommentar): „Hochbahnsteig auf dem Umsteigebahnhof“ → „unterirdischer Bahnsteig unter dem Umsteigebahnhof“.
6. Hilfe-Thema „U-Bahn“: Strecken liegen im Tunnel, darüber darf hoch gebaut werden; die Untergrund-Ansicht zeigt Tunnel,
   Bahnsteige und Züge; die gestrichelte Linie am Boden zeigt den Verlauf in der normalen Ansicht.
7. Falls Tests Kosten der Pulsbahn erwarten: Strecke jetzt 45 €/Feld statt 35, Station 1.600 € statt 1.400.
