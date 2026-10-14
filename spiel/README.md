# Cityscapes

*(früher „Stadtpuls")*

Ein 3D-Städtebau- und Verkehrsspiel aus der Gottperspektive, das komplett im Browser läuft.

Du baust Straßen, weist Wohn-, Gewerbe-, Industrie- und Bürozonen aus, versorgst die Stadt mit Strom, Wasser, Abwasser, Müllabfuhr, Fernwärme, Polizei, Feuerwehr, Krankenhäusern, Friedhöfen, Kitas, Schulen und Universitäten. Die Stadt verbindest du mit der **Pulsbahn**, einer U-Bahn nach Mini-Metro-Regeln, die im Tunnel unter der Stadt fährt (eigene Untergrund-Ansicht), dazu mit Bus- und Straßenbahnlinien, Fernzügen, Fähren und einem Flughafen. Jede Woche wählst du eine von drei Wochenkarten, und jede Zugankunft spielt einen Ton.

## Was Cityscapes ausmacht

Version 2.0 hat ein Schwarm aus 17 spezialisierten Agenten gebaut, danach haben 4 QA-Agenten das Gesamtspiel geprüft und poliert. Alles ist prozedural erzeugt, es gibt keine fremden Modelle oder Texturen.

**Grafik**
- **Echte Architektur:** Für jede Zone gibt es fünf Stufen, vier Grundflächen und sechs Varianten, vom Fachwerkhaus über Gründerzeit-Altbau, Plattenbau und Kaufhaus bis zum Wohn- und Glasturm. Fenster haben Laibungen, Sprossen und Balkone, Läden echte Schilder.
- **111 Gebäudetypen mit eigenem Modell:** darunter gotischer Dom, Barockschloss, Stadion, Freizeitpark mit Looping, Hauptbahnhof, Flughafen, Kraftwerke mit Kühltürmen, Kläranlage und Mêrdîn's Dönerpalast mit drehendem Dönerspieß.
- **Materialien:** 43 kachelbare Muster wie Putz, Ziegel, Dachpfannen, Schiefer, Asphalt und Pflaster, mit Schnee, Nässe und Herbstlaub.
- **Licht und Himmel:** HDR-Nachbearbeitung mit Kantenglättung, Umgebungsverdeckung, Bloom und Tonwertkurve. Der Himmel hat Sonnenlauf, Mondphasen, Sterne und Wolkenschatten und liefert die Spiegelung für Glas und Metall.
- **Gelände, Wasser, Pflanzen:** Hügel mit Schneegipfeln, Flüsse mit Strömung und Wasserfällen, Seen mit Ufer und Spiegelung. Zehn Baum- und Pflanzenarten wiegen im Wind und folgen den Jahreszeiten. Ein Umland liegt im Dunst.
- **Straßen:** Bordsteine, Kreuzungen, Zebrastreifen, Ampeln mit Phasen, Steinbogenbrücken, eine Autobahn mit Viadukt, Laternen, Bänke und Bushaltestellen.
- **Leben:** Pkw, Lkw, Sattelzüge, Busse, Straßenbahnen, Züge, Schiffe, Flugzeuge und Hubschrauber. Einsatzfahrzeuge fahren mit Blaulicht. Dazu Fußgänger, Radfahrer, Vogelschwärme, Boote und ab und zu ein Heißluftballon.
- **Leistung:** Der Gebäude-Renderer fasst Gebäude zu Bündeln zusammen und schaltet Detailstufen nach Entfernung. Eine ganze Stadt kommt so mit wenigen hundert Draw Calls aus.

**Spiel**
- **Wirtschaft:** Produktionsketten (Bauernhof, Forst, Bergwerk, Öl → Lebensmittel, Holz, Stahl, Kunststoff), Lagerhallen, Weltmarkt mit Exportpreisen, Konjunktur, Dienstbudgets und Dichte-Steuern.
- **Bürger:** 20 Altersgruppen und vier Bildungsstufen (Kita → Schule → Gymnasium → Universität). Dazu Krankheit, Krankenhausbetten, Bestattung, Abwasser, Fernwärme sowie Bezirke mit eigenen Namen, Verordnungen und Steuern.
- **Verkehr:** Bus- und Straßenbahnlinien mit Fahrgastmodell, Ampeln, Unfälle, Taxis, Parkhäuser, Hauptbahnhof mit Fernzügen, Flughafen und Fähren.
- **Wetter:** Vier Jahreszeiten mit Temperatur, Regen, Schnee, Nebel, Wind und Gewitter. Es gibt Winterdienst, Heizlast, Badewetter und Ernte.
- **Katastrophen:** Hochwasser, Orkan, Tornado, Erdbeben, Blitz, Waldbrand und Meteorit. Es gibt Vorwarnung, Vorbereitung, Rettung und Wiederaufbau. Die Häufigkeit ist einstellbar, auch ganz aus.
- **Fortschritt:**
  - 79 Erfolge und ein Bürgermeister-Rang.
  - 11 Szenarien mit Zielen und Sternen.
  - Metro-Modus mit Tageskarte und Bestenliste.
  - Bürgeraufträge, Ratgeber, über 100 Wochenkarten und Ereignisse sowie Hunderte Stadtfunk-Meldungen.
- **Oberfläche:**
  - Werkzeugleiste als Liniennetz und Baukatalog mit 3D-Vorschau und Suche.
  - Minikarte, Inspektor mit 3D-Porträt, Benachrichtigungszentrale und Ratgeberin „Frieda Puls".
  - Fotomodus mit Filtern und Tiefenschärfe, Handy-Layout.
- **Klang:** Generative Musik in Liedform mit Stimmungen für Tag, Nacht und Krise. Die Umgebung klingt je nach Kameraort: Verkehr, Vögel, Grillen, Regen, Glocken. Über 50 Effekte, alle im Akkord der Musik.

## Spielen

- **Direkt öffnen:** `spiel/index.html` im Browser öffnen (Doppelklick genügt, ein Server ist nicht nötig).
- **Über die Website:** Wird das Repository als statische Seite ausgeliefert, liegt das Spiel unter `/spiel/`.
- Nötig ist ein aktueller Browser mit WebGL 2 (Chrome, Edge, Firefox, Safari). Auf Tablets und Handys läuft es auch; mit Maus spielt es sich am besten. Die Grafikstufe „Automatisch“ (Standard) schätzt das Gerät beim Start ein und regelt danach Auflösung, Schatten und Effekte so nach, dass das Bild flüssig bleibt; wer mag, wählt in den Einstellungen fest Niedrig, Mittel, Hoch oder Ultra.

### Steuerung

| Eingabe | Wirkung |
|---|---|
| Linke Maus | Werkzeug benutzen (Straßen und Zonen ziehen, Gebäude setzen, anklicken) |
| Rechte Maus ziehen | Karte verschieben · Rechtsklick bricht ab bzw. beendet eine Linie |
| Mittlere Maus / Alt + Links | Drehen und neigen |
| Mausrad · + / − | Zoomen (zum Mauszeiger) |
| W A S D / Pfeiltasten · Q / E · Bild ↑/↓ | Kamera bewegen · drehen · neigen |
| Leertaste · 1 · 2 · 3 | Pause · Geschwindigkeit |
| G · Z · L | Straßen · Zonen · Pulsbahn-Linie |
| F | Baukatalog durchsuchen |
| R · B / Entf | Gebäude drehen · Abriss |
| Enter · Esc | Linie fertigstellen · Werkzeug abbrechen |
| V · N · H · K | Infoansicht aus · Meldungen · Ratgeber · Minikarte |
| P · U | Fotomodus · Oberfläche ausblenden |
| I · M | Problemsymbole · Ton an/aus |
| ? / F1 | Alle Tastenkürzel |
| Strg + S | Schnellspeichern |

Ein Spieltag dauert bei ×1 eine Minute. Unter Optionen → Bedienung → „Tageslänge“ lässt sich das auf 30 Sekunden (Normal) oder anderthalb Minuten (Sehr lang) stellen; Fahrzeuge fahren dabei immer gleich schnell. Der Metro-Modus nutzt fest 30 Sekunden, damit die Bestenliste vergleichbar bleibt.

Auf Handy und Tablet verschiebt ein Finger die Karte, zwei Finger zoomen und drehen. Beim Bauen setzt Antippen erst eine Vorschau (verschiebbar, bei Straßen und Zonen mit Griffen); gebaut wird erst mit ✓ in der Leiste. Das lässt sich in den Optionen unter „Bauen bestätigen“ einstellen.

### Erste Schritte

1. Ziehe vom Ende der Autobahn eine Straße ins Land.
2. Weise entlang der Straße Wohngebiet aus, mit etwas Abstand Gewerbe und Industrie.
3. Baue ein Kraftwerk und einen Wasserturm an einer Straße. Strom, Wasser und Abwasser fließen durch das Straßennetz.
4. Eine Deponie hält die Stadt sauber. Ein Abwasserauslass oder später eine Kläranlage entsorgt das Abwasser; das Pumpwerk dafür weit entfernt bauen.
5. Mit wachsender Stadt kommen Wochenkarten, Dienste, Friedhof, Schulen und die Pulsbahn dazu.

Eine geführte Einführung zeigt im Spiel Schritt für Schritt, wo du klicken musst; danach nennt der Begleiter immer das nächste Ziel. Die Hilfe „So funktioniert's" (Taste ? oder F1) erklärt alle Grundideen. Wer ein klares Ziel möchte, wählt im Hauptmenü ein Szenario oder den Metro-Modus.

## Entwicklung

```bash
cd spiel
npm install        # three, esbuild, playwright-core
npm run build      # erzeugt dist/stadtpuls.js
npm run watch      # baut bei jeder Änderung neu (unminifiziert)
npm test           # Balancing-Test der Simulation ohne Browser (node test/sim-test.mjs [Tage] [Karte])
sh test/run-all.sh # alle Prüfstände: Simulation, Wetter, Bürger, Wirtschaft, Verkehr, Fortschritt, Spielstände, Bot-Durchlauf, Szenarien
```

`dist/stadtpuls.js` ist eingecheckt, damit das Spiel ohne Build-Schritt läuft. Nach Änderungen in `src/` bitte neu bauen.

Weitere Werkzeuge:
- `node build.mjs --artifact <datei.html>` erzeugt eine eigenständige Einzelseite mit eingebettetem CSS und JavaScript.
- `node tools/shot.mjs --scenario city|closeup|street|night|overview|winter|rain|mobile|menu|gallery --out bild.png` macht Screenshots im kopflosen Chromium und gibt Draw Calls und Dreiecke aus. Mit `--strict` endet es bei Konsolenfehlern mit Code 1.
- `index.html?gallery=res&fp=1x1,2x1` zeigt alle Stufen und Varianten eines Architektur-Bausteins.
  Mit `variants=10&v0=6` erscheinen weitere Modelle (Wohnen, Gewerbe und Büro haben je Stufe 8 bis 13). Welches Modell ein Zonengebäude in der Stadt bekommt, wählt die Ansicht nach Lage (`src/render/arch/mix.js`): Nachbarn sehen verschieden aus, dicht bebaute Viertel bekommen höhere Türme.
- `node tools/bench.mjs` misst die Rechenzeit der Simulation auf einer großen Karte.

### Aufbau

| Bereich | Inhalt |
|---|---|
| `src/sim/` | Simulationskern ohne Grafik (Karte, Zonen, Netze, Verkehr, Haushalt, Spielstände) |
| `src/sim/systems/` | Erweiterungssysteme: Wirtschaft, Bürger, Bezirke, Verkehr, Wetter, Katastrophen, Fortschritt |
| `src/content/` | Gebäude, Wochenkarten, Ereignisse, Stadtfunk |
| `src/render/` | Three.js-Darstellung: Szene, Himmel, Nachbearbeitung, Gelände, Wasser, Pflanzen, Straßen, Gebäude, Fahrzeuge, Effekte |
| `src/render/arch/` | Prozedurale Architektur-Bausteine für alle Gebäude |
| `src/ui/`, `src/input/` | Oberfläche, Panels, Werkzeuge |
| `src/audio/` | Mischpult, Umgebung, generative Musik, Effekte |
| `src/registry.js` | Erweiterungspunkte, über die die Module zusammenspielen |

Wie der Agentenschwarm organisiert war (Rollen, Datei-Besitz, Verträge, Budgets), steht in [SWARM.md](SWARM.md) und [swarm/QA.md](swarm/QA.md). Die Bitten der Agenten untereinander liegen in `swarm/requests/` und `swarm/qa/`.

## Dokumentation

- [docs/GENRE-ANALYSE.md](docs/GENRE-ANALYSE.md) – Zerlegung von Cities: Skylines, Mini Metro, Mini Motorways, SimCity, Anno, Transport Tycoon, Frostpunk, Banished, Islanders, Townscaper, Dorfromantik, Tropico, Timberborn, Against the Storm und weiteren Spielen, mit Vergleichstabelle und den zwölf Kernsäulen des Genres.
- [docs/SPIELKONZEPT.md](docs/SPIELKONZEPT.md) – das eigene Konzept: Gestaltungsprinzipien, Stil, alle Systeme mit ihren Zahlen, Fortschritt, Technik und Ausblick.
