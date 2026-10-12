# Stadtpuls

Ein 3D-Städtebau- und Verkehrsspiel aus der Gottperspektive, das komplett im Browser läuft.

Du baust Straßen, weist Wohn-, Gewerbe-, Industrie- und Bürozonen aus, versorgst die Stadt mit Strom, Wasser, Müllabfuhr, Polizei, Feuerwehr, Ärzten und Schulen und verbindest sie mit der **Pulsbahn**, einer Hochbahn nach Mini-Metro-Regeln. Jede Woche wählst du eine von drei Wochenkarten, und jede Zugankunft spielt einen Ton.

## Spielen

- **Direkt öffnen:** `spiel/index.html` im Browser öffnen (Doppelklick genügt, ein Server ist nicht nötig).
- **Über die Website:** Wird das Repository als statische Seite ausgeliefert, liegt das Spiel unter `/spiel/`.
- Nötig ist ein aktueller Browser mit WebGL (Chrome, Edge, Firefox, Safari). Auf Tablets und Handys läuft es auch, am besten spielt es sich aber mit Maus.

### Steuerung

| Eingabe | Wirkung |
|---|---|
| Linke Maus | Werkzeug benutzen (Straßen und Zonen ziehen, Gebäude setzen, anklicken) |
| Rechte Maus ziehen | Karte verschieben · Rechtsklick bricht ab bzw. beendet eine Linie |
| Mittlere Maus / Alt + Links | Drehen und neigen |
| Mausrad | Zoomen (zum Mauszeiger) |
| W A S D / Pfeiltasten | Kamera bewegen |
| Q / E | Kamera drehen |
| Leertaste · 1 · 2 · 3 | Pause · Geschwindigkeit |
| R | Gebäude drehen |
| B / Entf | Abriss |
| Esc | Werkzeug abbrechen |
| Strg + S | Schnellspeichern |
| M · I | Ton an/aus · Problemsymbole an/aus |

### Erste Schritte

1. Ziehe vom Ende der Autobahn eine Straße ins Land.
2. Weise entlang der Straße Wohngebiet aus, mit etwas Abstand Gewerbe und Industrie.
3. Baue ein Kraftwerk und einen Wasserturm an einer Straße. Strom und Wasser fließen durch das Straßennetz.
4. Eine Deponie hält die Stadt sauber.
5. Ab 150 Einwohnern gibt es Wochenkarten und Dienste, ab 500 die Pulsbahn.

Die Checkliste „Erste Schritte" im Spiel führt durch diese Punkte.

## Entwicklung

```bash
cd spiel
npm install        # three + esbuild
npm run build      # erzeugt dist/stadtpuls.js
npm run watch      # baut bei jeder Änderung neu (unminifiziert)
npm test           # Balancing-Test der Simulation ohne Browser (node test/sim-test.mjs [Tage] [Karte])
```

`dist/stadtpuls.js` ist eingecheckt, damit das Spiel ohne Build-Schritt läuft. Nach Änderungen in `src/` bitte neu bauen.

`node build.mjs --artifact <datei.html>` erzeugt zusätzlich eine eigenständige Einzelseite mit eingebettetem CSS und JavaScript.

## Dokumentation

- [docs/GENRE-ANALYSE.md](docs/GENRE-ANALYSE.md) – Zerlegung von Cities: Skylines, Mini Metro, Mini Motorways, SimCity, Anno, Transport Tycoon, Frostpunk, Banished, Islanders, Townscaper, Dorfromantik, Tropico, Timberborn, Against the Storm und weiteren Spielen, mit Vergleichstabelle und den zwölf Kernsäulen des Genres.
- [docs/SPIELKONZEPT.md](docs/SPIELKONZEPT.md) – das eigene Konzept: Gestaltungsprinzipien, Stil, alle Systeme mit ihren Zahlen, Fortschritt, Technik und Ausblick.
