# EINSTIEG – Bitten an andere Rollen (Runde 3)

Stand nach dem Merge der neuen Oberfläche: Einführung, Begleiter und Hilfe laufen mit der **neuen** Oberfläche
(`data-tour`, Gruppen `group-…`, `ui.tourTarget`, `onEvent`, „?"/F1 → `ui.openHelp()`). Die Rückfall-Selektoren der
alten Oberfläche bleiben drin, schaden aber nicht.

## Erledigt (danke, OBERFLAECHE)
- `data-tour`-Ziele, `ui.tourTarget`, `onEvent('cat'|'tool'|'panel'|'view'|'pop')`, Hilfe-Knopf, F1, `replacesTutorial`.
- Deine Bitten an mich: Hilfe-Themen heißen jetzt `start`, `roads`, `zones`, `demand`, `power`, `water`, `garbage`,
  `services`, `happiness`, `money`, `ubahn`, `cards`, `disasters`, `controls`; zusätzlich gibt es
  `helpTopicFor(hinweis)` in `help.js` (Kategorie, Gebäude-Schlüssel oder Infoansicht → Thema). Tooltip-Gnadenfrist
  (600 ms) in `tips.js`. „H: Ratgeberin" kommt in meinen Texten nicht vor.

## Wie die Einführung die Oberfläche benutzt
- Sie zeigt den Weg **Gruppe → Reiter → Eintrag**: erstes sichtbares Ziel aus `item-<key>`, `cat-<id>`, `group-<id>`
  gewinnt, der Text passt sich an („Klicke unten auf „Versorgung"" → „Klicke auf „Strom"" → „Wähle das Kohlekraftwerk").
- `ui.tourTarget` frage ich **nicht** für `cat-…`/`item-…` (das würde den Katalog ungefragt öffnen), sondern nur für
  andere Ziele und höchstens alle 3 s je Ziel.
- Ist das passende Werkzeug gewählt, klappt die Einführung den Katalog einmal mit `ui.closeTray()` zu, damit die Karte
  frei ist (das Werkzeug bleibt aktiv). Bitte `closeTray()` so lassen (Werkzeug nicht zurücksetzen).
- `ui.refreshTutorial()` rufe ich beim Start und Ende der Einführung, damit `#hud.tour-on` stimmt.
- Begleiter „Nächstes Ziel" (`#ob-guide`) sitzt in `#u-leftstack` (Desktop) bzw. frei über der Werkzeugleiste (Handy).
  Ein eigener Platz `[data-slot="guide"]` hätte Vorrang, falls du ihn lieber woanders willst.

## Noch offen an OBERFLAECHE
1. `catalog.js`: Zonentexte bitte aus `ZONE_INFO[z].desc` (neu in `config.js`, mit „Braucht: …") statt `ZONE_DESC`:
   ```js
   desc: ZONE_INFO[z].desc || ZONE_DESC[z],
   ```
2. `settings.js`: Schalter „Erste Schritte" → „Einführung", Beschreibung „Die geführte Einführung für neue Städte."
   Beim Einschalten zusätzlich `ctx.ui && ctx.ui.onboarding && ctx.ui.onboarding.start()`.
   Schalter „Ratgeber-Hinweise" → „Begleiter (Nächstes Ziel)" – er steuert weiter `settings.advisor`.
3. Freischaltung (fortgeschrittene Werkzeuge erst ab „Kleinstadt"):
   - `src/input/districts.js`:
     ```js
     const lockText = (g) => (g.sandbox || g.milestone >= 2 ? null : `Ab „${MILESTONES[2].name}" (${MILESTONES[2].pop} Einwohner)`);
     ```
   - `src/ui/panels/economy.js`, Katalog-Eintrag „Wirtschaft & Handel": `locked: g.sandbox || g.milestone >= 2 ? null : 'Ab „Kleinstadt" (500 Einwohner)'`.
4. Die Sprechblase `#u-bubble` wird nicht mehr gefüllt (`advisor.showBubble` ist leer) und kann entfallen.

## Freischaltungen jetzt (für Katalog, Meilenstein-Dialog, Tests)
- **Weiler (Start):** Gasse, Straße, Wohnen, Gewerbe, Industrie, Kohle, Wind, Wasserturm, Pumpwerk, Abwasserauslass, Deponie, Park.
- **Dorf (150):** Polizei, Feuerwehr, Arztpraxis, Schule, Kita, Spielplatz, Brunnenplatz, Verordnungen.
- **Kleinstadt (500):** U-Bahn, Büros, Alleen, Kredite, Bibliothek, Stadtpark, Sportplatz, Rathaus, Friedhof, Kläranlage,
  Heizkraftwerk, Busdepot, Wetterstation, Skatepark, Hundewiese, Kleingärten, Warnsirene, Winterdienst, Hochwasserschutz, Fähranleger.
- **Stadt (1.500):** zusätzlich Seniorenheim, Parkhaus, Taxizentrale, Lagerhalle, Markthalle, Teichpark, Freibad,
  Tennisplätze, Strandbad (alle vorher Kleinstadt).

## An UBAHN
- `config.js` `station` und `content/transport.js` `metro_hub` gehören dir: Name und Text bitte im neuen Stil, z. B.
  „U-Bahn-Station" – „Eingang mit Treppe, die Bahnsteige liegen im Tunnel. Fahrgäste aus 4 Feldern Umkreis steigen hier
  ein. Auch auf Straßen baubar." Kommentar über `TRANSIT` („Pulsbahn (Hochbahn)") ebenfalls.
- Die Wagen-Plätze in Karten/Ratschlägen lese ich aus `TRANSIT.wagonCapacity` – wenn du die Kapazität änderst, stimmen die Texte von selbst.
