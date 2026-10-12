# Stadtpuls – Spielkonzept

*Ein 3D-Städtebau- und Verkehrsspiel aus der Gottperspektive. Läuft im Browser, ohne Installation.*

Dieses Dokument beschreibt das eigene Spiel. Die Zerlegung der Vorbilder (Cities: Skylines, Mini Metro und viele andere) steht in [GENRE-ANALYSE.md](GENRE-ANALYSE.md). Hier geht es darum, was Stadtpuls daraus macht, wie die Systeme ineinandergreifen und mit welchen Zahlen sie arbeiten.

---

## 1. Die Idee in einem Satz

**Baue eine Stadt mit dem Systemtiefgang von Cities: Skylines – und verbinde sie mit einer Hochbahn, die so knapp, lesbar und musikalisch ist wie Mini Metro.**

Die Genre-Analyse zeigt eine Lücke: Tiefe Städtebausimulationen kennen kaum echten Druck, und abstrakte Netzwerkspiele haben keine lebende Stadt darunter. Stadtpuls setzt genau dort an:

- Unten wächst eine **echte Stadt** aus Zonen, Versorgung, Diensten, Bodenwert und Verkehr.
- Darüber fährt die **Pulsbahn**, ein Hochbahnnetz nach Mini-Metro-Regeln: Fahrgäste mit Zielformen, begrenzte Linien, Überfüllungsring.
- Jede **Woche** gibt es eine Wahl aus drei Karten. Sie strukturiert die Partie wie ein Taktgeber.
- Jede **Zugankunft spielt einen Ton**. Je besser das Netz läuft, desto dichter wird die Musik. Daher der Name: Die Stadt hat einen Puls, den man hören kann.

## 2. Gestaltungsprinzipien

| Prinzip | Was es heißt | Woher es kommt |
|---|---|---|
| Lesbar vor realistisch | Jede Ursache ist sichtbar: Problemsymbole über Gebäuden, Glücksfaktoren im Inspektor, Infoansichten mit genau einer Frage pro Karte. | Mini Metro, Lehren aus SimCity 2013 |
| Knappheit erzeugt Entscheidungen | Pulsbahn-Linien sind abzählbar (Meilensteine und Karten), Züge und Waggons kosten. Kein Ressourcenüberfluss durch eine einzige Währung. | Mini Metro |
| Rhythmus statt Leerlauf | Wochenkarten, Ereignisse mit Entscheidung, Meilensteine mit Freischaltungen. Gegen die Mid-Game-Leere. | Mini Metro, Against the Storm, Anno |
| Spielzeug-Gefühl | Ein schwebendes Diorama mit weichen Pastellfarben, Bauanimation, Tag-Nacht-Wechsel, beleuchtete Fenster und Laternen. Bauen soll sich auch ohne Ziel gut anfühlen. | Townscaper, Islanders, Dorfromantik |
| Fehler sind korrigierbar | Abriss erstattet einen Teil, Linien lassen sich verlängern und löschen, Züge wandern ins Depot zurück. Pause ist jederzeit möglich. | Mini Metro, Cities: Skylines |
| Simulation im richtigen Maßstab | Sichtbare Fahrzeuge sind Agenten mit echter Wegesuche. Wirtschaft und Bevölkerung laufen statistisch. So bleibt die Stadt auch mit Zehntausenden Einwohnern flüssig. | Lehre aus SimCity 2013 und CS2 |

## 3. Eigener Stil

**Das Diorama.** Die Karte ist eine schwebende Erdscholle mit sichtbaren Bodenschichten an den Rändern. Wasser zeigt an den Kanten einen Querschnitt wie in einem Aquarium. Die Autobahn läuft als Viadukt in den Dunst hinaus – die einzige Verbindung zur Außenwelt.

**Low-Poly mit Licht.** Alle Gebäude werden prozedural aus wenigen Bauteilen zusammengesetzt (Kisten, Satteldächer, Zylinder, Kuppeln). Ein eigener Shader zeichnet Fenster auf jede Fassade. Nachts gehen sie zufällig an, je nach Gebäudetyp in warmem oder kühlem Licht. Dazu kommen Straßenlaternen, Scheinwerfer und Blaulicht.

**Netzplan-Oberfläche.** Die Bedienoberfläche erinnert an Bahnhofsbeschilderung: Papier-Schilder, eine schmale Grotesk für Zahlen (wie auf Abfahrtstafeln) und eine breite Display-Schrift für Titel. Die Werkzeugleiste ist selbst eine Bahnlinie, an der die Kategorien als Haltestellen sitzen. Wochenkarten sehen aus wie Fahrkarten mit Perforation und Stempel. Ereignisse erscheinen als Meldung im „Anzeiger" der eigenen Stadt.

**Klang.** Ein ruhiger Flächenklang wechselt alle paar Sekunden den Akkord (I – vi – IV – V in Dur). Zugankünfte zupfen Töne aus der Pentatonik, gefärbt nach Linie und Station, mit Echo und Hall. Bauen, Abreißen, Meilensteine und Fehler haben eigene kurze Klänge. Alles wird live mit WebAudio erzeugt, es gibt keine Audiodateien.

## 4. Die Kernschleife

```
 Straßen ziehen ──► Zonen ausweisen ──► Nachfrage (W·G·I·B) lässt Gebäude entstehen
       ▲                                              │
       │                                              ▼
 Geld aus Steuern ◄── Bewohner & Jobs ◄── Strom, Wasser, Müll, Dienste, Bodenwert
       │                                              │
       ▼                                              ▼
 Pulsbahn bauen ──► weniger Stau, höherer Bodenwert ──► Gebäude steigen auf (Stufe 1–5)
       │
       ▼
 Montag: Wochenkarte wählen · ab und zu: Ereignis entscheiden · Meilenstein: neue Gebäude
```

Eine Partie beginnt am Ende einer Autobahn im Westen der Karte. Alles, was danach passiert, baut der Spieler: Straßen, Zonen, Versorgung, Dienste, Parks und schließlich das Bahnnetz.

## 5. Systeme im Detail

### 5.1 Karte und Gelände

- Prozedural aus einem Startwert. Fünf Landschaften: **Flusstal, Küste, Seenplatte, Inselreich, Bergland**. Drei Größen: 64², 96², 128² Felder.
- Geländetypen: Wiese, Strand, Wasser, Fels (nicht bebaubar). Wälder kosten beim Bebauen etwas Rodung.
- Rohstoffe: **fruchtbarer Boden** und **Erz**. Industrie auf diesen Feldern wird zum Bauernhof (fast keine Abgase) oder Bergwerk (mehr Abgase), jeweils mit 20 % mehr Arbeitsplätzen.

### 5.2 Straßen

| Typ | Kosten/Feld | Unterhalt/Tag | Kapazität (Fahrten/h) | Tempo | Besonderheit |
|---|---:|---:|---:|---:|---|
| Gasse | 8 € | 0,12 € | 260 | 0,75 | günstig, leise |
| Straße | 16 € | 0,25 € | 650 | 1,0 | Standard |
| Allee | 40 € | 0,60 € | 1.400 | 1,2 | Bäume, +7 Bodenwert an den Rändern, ab „Kleinstadt" |
| Autobahn | – | – | 3.200 | 1,7 | nur die Anbindung ans Umland |

Straßen werden per Ziehen als L-Form gebaut. Über Wasser entstehen automatisch Brücken (fünffacher Preis, dreifacher Unterhalt). Die Straßentexturen werden zur Laufzeit für alle 16 Verbindungsarten gezeichnet, inklusive Mittellinien, Zebrastreifen und Wendehämmern.

### 5.3 Zonen, Nachfrage und Wachstum

- Vier Zonen: **Wohnen (W)**, **Gewerbe (G)**, **Industrie (I)**, **Büro (B, ab „Kleinstadt")**.
- Ein Zonenfeld wird nur bebaut, wenn eine Straße höchstens zwei Felder entfernt liegt und mit der Autobahn verbunden ist.
- Die **Nachfrage-Balken** oben links zeigen, was die Stadt braucht:
  - **W** steigt, wenn es mehr Jobs als Arbeitskräfte gibt, die Stadt glücklich ist und die Steuern niedrig sind. Leerstand bremst den Neubau.
  - **G** folgt der Kaufkraft der Bewohner und dem Tourismus.
  - **I** liefert Waren für das Gewerbe und für den Export.
  - **B** braucht gebildete Arbeitskräfte.
  - Fehlende Arbeitskräfte bremsen G, I und B. Hohe Arbeitslosigkeit treibt sie an, abhängig vom Bildungsniveau.
- Gebäude haben **fünf Stufen**. Ein Aufstieg braucht genug Bodenwert (Industrie: Infrastruktur), Bildung, Glück und eine gute Belegung. Die maximale Stufe hängt vom Meilenstein ab (bis „Dorf" 2, „Kleinstadt" 3, „Stadt" 4, ab „Großstadt" 5).
- Unter einer Hochbahn-Trasse wachsen Gebäude höchstens bis Stufe 4. Mit dem Hochhausverbot bleiben sie bei Stufe 3.

| Stufe | Wohnen (Bewohner) | Gewerbe (Jobs) | Industrie (Jobs) | Büro (Jobs) | Bodenwert nötig (W/G) |
|---:|---:|---:|---:|---:|---:|
| 1 | 8 | 5 | 8 | 10 | – |
| 2 | 18 | 10 | 16 | 22 | 25 |
| 3 | 36 | 20 | 28 | 44 | 40 |
| 4 | 70 | 36 | 44 | 80 | 55 |
| 5 | 140 | 64 | 64 | 140 | 70 |

**Verfall.** Fehlen Strom oder Wasser länger als sechs Tage, fehlt die Straßenverbindung oder ist ein Gebäude über eine Woche lang sehr unglücklich, wird es verlassen und nach einigen Tagen abgerissen. Die Zone bleibt erhalten.

### 5.4 Versorgung über das Straßennetz

Strom und Wasser fließen durch Leitungen unter den Straßen. **Jedes zusammenhängende Straßennetz ist ein eigenes Versorgungsnetz.** Reicht die Leistung nicht, bleibt ein entsprechender Anteil der Gebäude ohne Versorgung. Pumpwerke brauchen selbst Strom und müssen am Ufer stehen.

### 5.5 Dienste mit Abdeckung und Kapazität

Polizei, Feuerwehr, Gesundheit, Bildung und Müllabfuhr haben einen **Radius** und eine **Kapazität**. Jedes Gebäude wird der nächstgelegenen Einrichtung zugeordnet. Ist sie überlastet, sinkt ihre Wirkung für alle Zugeordneten. Ohne Strom arbeitet sie nur zu 45 %, ohne Straßenanschluss kaum.

- **Feuer.** Gebäude können brennen, je nach Stufe, Feuerwehrabdeckung und Verordnungen. Die nächste Feuerwache schickt ein Löschfahrzeug mit Blaulicht über das echte Straßennetz. Kommt keines, brennt das Gebäude nach neun Stunden nieder, und das Feuer kann überspringen.
- **Bildung** wächst langsam in den Wohngebäuden: Schulen bis 60 %, Bibliotheken bis 45 %, Universitäten bis 100 %. Hohe Wohnstufen und Büros brauchen sie.
- **Müllwagen** und **Streifenwagen** fahren sichtbar durch die Stadt.

### 5.6 Umweltfelder und Bodenwert

Auf dem ganzen Raster werden Felder berechnet und weichgezeichnet:

- **Verschmutzung**: Industrie, Kraftwerke, Deponien, dichter Verkehr
- **Lärm**: Straßen nach Auslastung, Industrie, Stadion
- **Kriminalität**: Arbeitslosigkeit, Unzufriedenheit, Dichte, abzüglich Polizei
- **Bodenwert** (0–100): Wassernähe, Parks, Dienste, Pulsbahn-Anbindung, Wahrzeichen, Alleen, abzüglich Abgase, Lärm, Kriminalität und Müll

### 5.7 Glück

Jedes Gebäude berechnet sein Glück aus nachvollziehbaren Faktoren, die der Inspektor einzeln anzeigt: Strom, Wasser, Müll, Gesundheit, Sicherheit, Bildungsangebot, Parks, Bodenwert, Abgase, Lärm, Steuern, Pendelzeit, Arbeitslosigkeit, Pulsbahn, Wahrzeichen, Verordnungen und Ereignisse. Der Wert nähert sich seinem Ziel langsam an, damit die Stadt nicht flackert.

### 5.8 Verkehr

- Fahrten entstehen nach Tageszeit: morgens zur Arbeit, mittags zum Einkaufen, abends nach Hause. Dazu kommen Lieferverkehr (Industrie → Gewerbe, Export und Import über die Autobahn), Umzugswagen von außerhalb, Müllabfuhr, Polizei und Feuerwehr.
- Jedes Fahrzeug sucht seinen Weg mit **A\*** über das Straßenraster. Die Kosten jedes Feldes hängen von Straßentyp und Stau ab, deshalb weichen Autos auf Umwege aus.
- Gefahren wird rechts, Kurven sind als Bézierkurven geglättet.
- Jedes sichtbare Fahrzeug steht für viele echte Fahrten. Daraus entstehen Auslastung, Stau, Lärm und Pendelzeit. Die Verkehrsansicht färbt die Straßen grün, gelb oder rot.
- Wohngebäude im Einzugsgebiet der Pulsbahn erzeugen 35 % weniger Autofahrten.

### 5.9 Die Pulsbahn

Die Hochbahn ist das Herz des Spiels und folgt den Regeln von Mini Metro, eingebettet in die echte Stadt.

| Regel | Umsetzung |
|---|---|
| Stationen | 1 400 €, auf freiem Land **oder über einer Straße**, Einzugsradius 4,5 Felder. Das Stationssymbol zeigt die vorherrschende Zone im Umkreis. |
| Linien zeichnen | Stationen nacheinander anklicken. Ein Klick auf ein leeres Feld setzt dort direkt eine Station. Ein Klick auf die erste Station schließt einen **Ring**. Die Trassen verlaufen **oktilinear** (0°/45°/90°) wie auf einem Netzplan. Parallel verlaufende Linien werden nebeneinander geführt. |
| Knappheit | Linienplätze sind begrenzt: 2 ab „Kleinstadt", je +1 bei „Stadt", „Großstadt" und „Metropole", dazu Wochenkarten (maximal 10). Züge (2 600 €) und Waggons (1 400 €) kosten Geld oder kommen über Karten ins Depot. |
| Fahrgäste | Werden aus Bewohnern und Jobs im Einzugsgebiet erzeugt, abhängig von der Tageszeit. Ihre **Form zeigt das Ziel**: ● nach Hause, ▲ Gewerbe, ■ Industrie, ◆ Büro. |
| Umsteigen | Jeder Fahrgast steigt in einen Zug, der ihn dem Ziel näher bringt (Breitensuche über das Liniennetz), und steigt um, wenn eine andere Linie schneller ans Ziel führt. |
| Kapazität | Zug 6 Plätze, je Waggon +6 (max. 3 Waggons, max. 6 Züge pro Linie). |
| Überfüllung | Ab 14 Wartenden füllt sich ein **roter Ring** um die Station. Ist er voll, gibt die Hälfte der Fahrgäste auf, und das Einzugsgebiet ist zwei Tage lang unzufrieden. |
| Wirkung | Ticket 4 € pro Fahrt, +9 Bodenwert und +5 Glück im Einzugsgebiet, weniger Autos auf den Straßen. |
| Musik | Jede Ankunft spielt einen Ton. Tonhöhe nach Linie und Station, Lautstärke nach Zahl der Umsteiger. |

### 5.10 Wirtschaft

- **Einnahmen pro Tag**: Steuern je Zone (Satz 0–25 %, Standard 10 %), Tourismus durch Wahrzeichen, Pulsbahn-Tickets.
- **Ausgaben pro Tag**: Unterhalt aller Einrichtungen, Straßen (Brücken dreifach), Pulsbahn, Verordnungen, Kreditzinsen.
- **Kredite** ab „Kleinstadt": 25 000 €, 60 000 € oder 150 000 €, getilgt wöchentlich mit Zinsen.
- **Bankrott**: Liegt die Kasse zehn Tage tief im Minus (Normal −25 000 €, Anspruchsvoll −10 000 €), übernimmt das Land. Man kann mit einem Rettungspaket und Glücksabzug weiterspielen.
- **Schwierigkeit**: Entspannt (80 000 € Start, Bauten 25 % günstiger), Normal (40 000 €), Anspruchsvoll (22 000 €, Bauten 25 % teurer), Sandkasten (unbegrenzt Geld, alles frei).

### 5.11 Verordnungen

| Verordnung | Wirkung | Kosten/Tag je 100 Einw. | Ab |
|---|---|---:|---|
| Rauchmelderpflicht | Brandrisiko −50 % | 0,35 € | Dorf |
| Tempo 30 | Lärm −40 %, Autos langsamer | 0,05 € | Dorf |
| Mülltrennung | Müll −30 % | 0,45 € | Kleinstadt |
| Fahrradstadt | 15 % weniger Autos, Glück +3 | 0,55 € | Kleinstadt |
| Kostenlose Pulsbahn | Fahrgäste +40 %, Glück +3, keine Tickets | – | Kleinstadt |
| Hochhausverbot | max. Stufe 3, Wohnglück +2 | – | Kleinstadt |
| Saubere Industrie | Industrie-Abgase −40 %, Industrie-Nachfrage −20 | 0,50 € | Stadt |
| Mieterschutz | Wohnglück +5, Wohnsteuer −10 % | – | Stadt |
| Bildungsoffensive | Bildung wächst 60 % schneller | 0,60 € | Stadt |
| Nachtruhe | Lärm −25 %, Gewerbesteuer −10 % | – | Stadt |

## 6. Fortschritt und Rhythmus

### 6.1 Meilensteine

| Meilenstein | Einwohner | Belohnung | Neu freigeschaltet (Auswahl) |
|---|---:|---:|---|
| Weiler | 0 | – | Straßen, Wohnen/Gewerbe/Industrie, Kohle, Wind, Wasser, Deponie, Parks |
| Dorf | 150 | 6 000 € | Polizei, Feuerwehr, Arztpraxis, Schule, Plätze, Verordnungen, **Wochenkarten** |
| Kleinstadt | 500 | 12 000 € | **Pulsbahn**, Büro-Zone, Alleen, Kredite, Bibliothek, Stadtpark, Rathaus, Gebäude bis Stufe 3 |
| Stadt | 1 500 | 25 000 € | Krankenhaus, Gas, Solar, Müllverbrennung, +1 Linie, Stufe 4 |
| Großstadt | 4 000 | 45 000 € | Universität, Präsidium, Feuerwehrzentrale, Wasserwerk, Recycling, +1 Linie, Stufe 5 |
| Metropole | 10 000 | 90 000 € | Fusionsreaktor, +1 Linie |
| Weltstadt | 25 000 | 160 000 € | – |
| Megastadt | 50 000 | 300 000 € | – |

### 6.2 Wochenkarten

Jeden Montag pausiert das Spiel und bietet **drei Fahrkarten** an, von denen man eine nimmt. Das Angebot passt sich der Lage an (Pulsbahn-Karten erst nach der Freischaltung, Wahrzeichen erst ab einem passenden Meilenstein).

- **Sofort:** Fördermittel (wächst mit der Stadt)
- **Pulsbahn:** neue Linie, zwei Züge, drei Waggons, Expresszüge (+20 % Tempo)
- **Für einige Tage:** Stadtfest (+8 Glück), Konjunktur (+25 % Steuern), Zuzugswelle, Investoren, Straßenbaukolonne (−50 %), Werbekampagne (+50 % Touristen)
- **Dauerhaft, begrenzt stapelbar:** Schlanke Verwaltung (−8 % Unterhalt), Smart Grid (+12 % Strom), Rohrsanierung (+12 % Wasser), Lehrkräfte (+30 % Bildung), Brandschutz (−30 %), Filteranlagen (−15 % Abgase)
- **Wahrzeichen:** schaltet ein Wahrzeichen früher und zum halben Preis frei

### 6.3 Ereignisse mit Entscheidung

Alle sechs bis zwölf Tage meldet der „Anzeiger" ein Ereignis mit zwei Antworten, zum Beispiel: eine Handelskette will Steuervorteile, ein Sturm bedroht die Stromleitungen, eine Hitzewelle, ein Open-Air-Konzert, ein Müllstreik, eine Städtepartnerschaft, eine Gründerszene, eine Bürgerinitiative für mehr Grün, eine Grippewelle, Stau-Beschwerden – und Mêrdîns Chili-Cheese-Döner-Festival.

### 6.4 Stadtfunk

Bürger kommentieren die Lage: Stromausfälle, Müllberge, Stau, hohe Steuern, fehlende Ärzte, überfüllte Stationen, aber auch Lob für Parks und die Aussicht aus der Hochbahn. Die Meldungen laufen als Ticker oben in der Mitte und sammeln sich im Stadtfunk-Panel. Wichtige Meldungen (Feuer, Überfüllung, Bankrottgefahr) erscheinen zusätzlich als Hinweis.

### 6.5 Wahrzeichen

| Wahrzeichen | Effekt |
|---|---|
| Riesenrad | dreht sich; Bodenwert +25 im Radius 12, 140 Touristen/Tag |
| Fernsehturm | weithin sichtbar; Bodenwert +20 im Radius 16 |
| Stadion | +8 Glück, 260 Touristen, aber Lärm |
| Opernhaus | Bodenwert +30 |
| Sternwarte | Bildung wächst in der ganzen Stadt schneller |
| Mêrdîn's Dönerpalast | Glück +7 und mehr Kundschaft im Umkreis; auf dem Dach dreht sich ein Dönerspieß |
| Leuchtturm | nur am Wasser; nachts kreist ein Lichtkegel |

## 7. Informationen und Bedienung

- **Infoansichten** (links): Strom, Wasser, Müll, Gesundheit, Polizei, Feuerwehr, Bildung, Bodenwert, Verschmutzung, Lärm, Kriminalität, Glück, Verkehr, Pulsbahn-Abdeckung, Rohstoffe. Jede Ansicht hat eine Legende mit einem Satz Erklärung.
- **Inspektor**: Klick auf ein Gebäude zeigt Belegung, Glück mit allen Faktoren, Bodenwert, Bildung, Pendelzeit und **was für die nächste Stufe fehlt**. Stationen zeigen wartende Fahrgäste nach Zielform und ihr Einzugsgebiet, Straßen ihre Auslastung.
- **Problemsymbole** schweben über Gebäuden: Blitz, Tropfen, Müll, Feuer, fehlende Straße, Unglück, verlassen, überfüllte Station.
- **Vorschau vor jeder Aktion**: Straßenkosten inklusive Brücken, Zonenfläche, Abrissumfang, Wirkungsradius beim Platzieren.
- **Erste Schritte**: Eine kleine Checkliste führt durch die ersten Minuten und hakt Schritte automatisch ab.
- **Statistik**: Verlaufsdiagramme (Einwohner, Kasse, Saldo, Glück, Fahrgäste, Verkehrsfluss), Versorgungsbilanz, Arbeitsmarkt, aktive Effekte.
- **Steuerung**: rechte Maus verschieben, mittlere Maus oder Alt+Links drehen und neigen, Mausrad zoomt zum Zeiger. WASD/Pfeile, Q/E drehen, Leertaste Pause, 1–3 Tempo, R dreht Gebäude, B Abriss, Esc bricht ab, Strg+S speichert, M schaltet den Ton, I blendet Symbole aus. Auf Touch-Geräten verschiebt ein Finger, zwei Finger zoomen und drehen.

## 8. Zeit

Ein Spieltag dauert bei 1× Tempo 30 Sekunden (2× 15 s, 4× 7,5 s), eine Woche also dreieinhalb Minuten. Der Tag-Nacht-Wechsel folgt der Uhr: Sonnenaufgang gegen halb sechs, Sonnenuntergang gegen neun. Er lässt sich in den Optionen abschalten. Solange eine Wochenkarte oder ein Ereignis auf eine Entscheidung wartet, steht die Zeit still.

## 9. Technik

- **Three.js** (r160) mit WebGL, gebündelt per esbuild in eine einzige Datei. Keine weiteren Laufzeitabhängigkeiten.
- **Getrennte Schichten**: Die Simulation (`src/sim/`) kennt keine Grafik und läuft auch headless in Node. Das nutzt der Balancing-Test in `test/sim-test.mjs`. Die Darstellung (`src/render/`) hört auf Ereignisse der Simulation.
- **Instanzierung**: Gebäude, Bäume, Fahrzeuge, Laternen und Fahrgastsymbole sind `InstancedMesh`-Pools. So kommt die Stadt mit wenigen Dutzend Draw Calls aus.
- **Shader-Erweiterungen**: prozedurale Fenster (Weltkoordinaten, Hash pro Feld), Wasserwellen, Himmelsverlauf, Punktwolken für Rauch, Feuer und Lichter, ein Symbol-Atlas als Point Sprites.
- **Spielstände**: Typed Arrays als Base64, Gebäude als kompakte Tupel. Automatisches Speichern jeden Spieltag in `localStorage`, drei Speicherplätze, Export und Import als JSON.

```
spiel/
├── index.html, style.css      Oberfläche
├── dist/stadtpuls.js          gebündeltes Spiel
├── src/
│   ├── config.js              alle Spieldaten
│   ├── sim/                   Simulation (headless lauffähig)
│   │   ├── world.js           Kartengenerator
│   │   ├── network.js         Straßennetz, A*
│   │   ├── city.js            Nachfrage, Wachstum, Stufen, Brände
│   │   ├── services.js        Versorgung, Abdeckung, Felder, Glück
│   │   ├── economy.js         Haushalt
│   │   ├── traffic.js         Fahrzeug-Agenten
│   │   ├── transit.js         Pulsbahn
│   │   ├── progress.js        Karten, Ereignisse, Stadtfunk
│   │   └── game.js            Zustand, Aktionen, Zeit, Speichern
│   ├── render/                Three.js-Darstellung
│   ├── ui/                    Oberfläche, Menü, Diagramme, Icons
│   ├── input.js, audio.js, main.js
└── test/sim-test.mjs          Balancing-Test ohne Browser
```

## 10. Ausblick

Ideen, die ins System passen, aber noch nicht umgesetzt sind:

- **Metro-Modus** als eigenständige Herausforderung: feste Stadt, nur Pulsbahn, Überfüllung beendet die Partie, Punktzahl = beförderte Fahrgäste.
- **Szenarien** mit Zielen und Zeitlimit (zum Beispiel „5 000 Einwohner in einem Jahr bei über 70 % Glück").
- **Distrikte** mit eigenen Verordnungen und Steuersätzen.
- **Busse** als günstiger Zubringer zur Pulsbahn.
- **Jahreszeiten** mit Schnee und Heizbedarf.
- **Wetter** und weitere Ereignisse (Hochwasser am Fluss, Hitzewelle mit sichtbaren Folgen).
- **Abwasser** als dritte Versorgung neben Strom und Wasser.
