# Genre-Analyse: Städtebau- und Verkehrssimulationen aus der Gottperspektive

Begleitdokument zum Projekt „Stadtpuls“ · Stand: Oktober 2026

> **Zweck.** Dieses Dokument zerlegt die wichtigsten Vertreter des Genres in ihre Systeme, leitet daraus Kernsäulen ab und sammelt typische Designprobleme samt bekannter Lösungen. Es beschreibt bewusst noch kein eigenes Spiel; das übernimmt das Spielkonzept.
>
> **Zur Faktenlage.** Studios, Jahreszahlen und zentrale Mechaniken wurden per Websuche gegengeprüft (Quellen am Ende). Wo Quellen auseinandergehen oder ein Detail nicht eindeutig belegt war, ist das vermerkt oder vorsichtig formuliert. Angaben wie „typische Sitzungslänge“ sind Einschätzungen, keine Messwerte.

## Inhalt

1. Einleitung: Was das Genre ausmacht
2. Die Spiele im Detail
   - 2.1 Cities: Skylines und Cities: Skylines II
   - 2.2 Mini Metro
   - 2.3 Mini Motorways
   - 2.4 SimCity (Klassiker und SimCity 2013)
   - 2.5 Anno-Reihe
   - 2.6 Transport Tycoon und OpenTTD
   - 2.7 Frostpunk
   - 2.8 Banished
   - 2.9 Islanders
   - 2.10 Townscaper
   - 2.11 Dorfromantik
   - 2.12 Tropico
   - 2.13 Timberborn
   - 2.14 Against the Storm
   - 2.15 Kurzporträts: Workers & Resources, Factorio, Manor Lords, Pocket City
3. Vergleichstabelle
4. Kernsäulen des Genres
5. Typische Designprobleme und wie Spiele sie lösen
6. Fazit
7. Quellen

---

## 1. Einleitung: Was das Genre ausmacht

Städtebau- und Verkehrssimulationen aus der Gottperspektive teilen eine Grundsituation: Man steuert keine Figur, sondern eine Umgebung. Man legt Straßen, Zonen, Linien oder Gebäude an, und ein simuliertes System – Bürger, Fahrgäste, Waren, Wasser, Geld – reagiert darauf. Gespielt wird indirekt. Der Reiz entsteht aus der Lücke zwischen Absicht und Ergebnis: Man plant eine Kreuzung, und erst die Simulation zeigt, ob der Plan trägt.

Vier Eigenschaften teilen fast alle Vertreter:

- **Räumliche Entscheidungen mit Folgewirkung.** Wo etwas steht, bestimmt, wie gut es funktioniert: Abdeckung, Nachbarschaft, Wege, Lärm.
- **Flüsse durch Netzwerke.** Menschen, Fahrzeuge, Güter, Strom oder Wärme bewegen sich durch Strukturen, die man selbst gebaut hat. Engpässe sind das zentrale Problem.
- **Rückkopplung.** Wachstum erzeugt neue Nachfrage, neue Nachfrage erzeugt neue Engpässe. Daraus entsteht ein Rhythmus aus „Problem erkennen – umbauen – beobachten“.
- **Lesbarkeit als Mechanik.** Weil man nicht direkt eingreift, sind Overlays, Warnsymbole und Statistiken kein Zusatz, sondern Teil des Spiels. Wer den Zustand nicht lesen kann, kann nicht spielen.

Innerhalb dieses Rahmens spannt sich ein Spektrum auf. Am einen Ende stehen simulationsschwere Sandkästen wie Cities: Skylines, die eine glaubwürdige Stadt mit Zehntausenden Agenten nachbilden und kaum Scheitern kennen. Am anderen Ende stehen abstrakte Netzwerk-Puzzles wie Mini Metro, die ein einziges System – den Fahrgastfluss – in Reinform zeigen, knappe Ressourcen vorgeben und jede Partie mit dem Zusammenbruch enden lassen. Dazwischen liegen Aufbau- und Wirtschaftsspiele (Anno), Survival-Städtebauer (Frostpunk, Banished, Timberborn, Against the Storm), Transport-Tycoons (OpenTTD), politische Satiren (Tropico) und eine wachsende Gruppe kleiner, ruhiger Bauspiele (Islanders, Townscaper, Dorfromantik).

Zur Abgrenzung: „Gottperspektive“ meint hier Kameraposition und indirekte Steuerung, nicht das Göttersimulations-Genre im engeren Sinn (etwa Populous), in dem man als Gottheit Wunder wirkt.

---

## 2. Die Spiele im Detail

Die beiden Referenzspiele für „Stadtpuls“ – Cities: Skylines und Mini Metro – werden ausführlich in Unterabschnitten behandelt. Die übrigen Titel folgen einem kompakten Raster: Studio/Jahr, Kernschleife, Systeme, Ressourcen, Fortschritt, Druck und Scheitern, Feedback, Steuerung, Präsentation, Stärken, Schwächen und eine abgeleitete Lektion.

### 2.1 Cities: Skylines (2015) und Cities: Skylines II (2023)

| | Cities: Skylines (im Folgenden „C:S I“) | Cities: Skylines II („CS2“) |
|---|---|---|
| Studio / Publisher | Colossal Order (Finnland) / Paradox Interactive | Colossal Order / Paradox Interactive; ab Anfang 2026 Iceflake Studios (Paradox-intern, Tampere) |
| Erscheinen | 10. März 2015 (PC, Mac, Linux), später Konsolen | 24. Oktober 2023 (Windows); Konsolenfassungen auf unbestimmte Zeit verschoben |
| Technik | Unity | Unity, Simulation vollständig auf DOTS (ECS, Job-System, Burst-Compiler) |
| Kartengröße | 25 Kacheln, davon 9 im Grundspiel bebaubar (ca. 33 km²); per Mod mehr | 441 kleinere Kacheln, laut Entwickler ca. 159 km² spielbare Fläche, etwa fünfmal so viel |
| Erweiterungsmodell | viele kostenpflichtige Erweiterungen, Content-Packs und Radiosender, parallel kostenlose Updates | Erweiterungen (erste große: „Bridges & Ports“, Ende Oktober 2025), Content-Packs, kostenlose Updates |

C:S I füllte die Lücke, die das misslungene SimCity von 2013 hinterlassen hatte, und verkaufte sich laut Paradox im ersten Monat über eine Million Mal. CS2 sollte Simulation und Maßstab deutlich vertiefen, kämpfte aber seit dem Start mit Leistungs- und Balancing-Problemen. Im November 2025 gaben Paradox und Colossal Order ihre Trennung bekannt; Iceflake Studios verantwortet seit Anfang 2026 Updates, Editor, Konsolenfassungen und weitere Erweiterungen.

#### 2.1.1 Kernschleife

1. Straßen ziehen und entlang der Straßen Zonen ausweisen.
2. Versorgung (Strom, Wasser, Abwasser, Müll) und Dienste anschließen.
3. Gebäude wachsen von selbst, Einwohner ziehen ein, Steuern fließen.
4. Wachstum erzeugt Probleme: Stau, Verschmutzung, Arbeitskräftemangel, Lücken in der Abdeckung.
5. Über Infoansichten und Warnsymbole diagnostizieren, umbauen, optimieren. Meilensteine schalten neue Werkzeuge und Kartenkacheln frei.

Der Kern ist ein Wechsel aus Bauen und Diagnostizieren. Die eigentliche Herausforderung ist selten das Geld, sondern die Tatsache, dass fast alle Systeme über dasselbe Straßennetz laufen: Müllwagen, Feuerwehr, Leichenwagen, Pendler und Lieferverkehr teilen sich die Fahrbahnen. Verkehr ist deshalb das System, an dem sich die Fehler aller anderen Systeme zeigen.

#### 2.1.2 Zonen und RCI-Nachfrage

- Das Zonensystem folgt dem SimCity-Prinzip RCI (Residential, Commercial, Industrial): Man weist Flächen aus, die Simulation entscheidet, was dort wächst. C:S I kennt Wohnen und Gewerbe jeweils in niedriger und hoher Dichte, dazu Industrie und Büros.
- Drei Nachfragebalken zeigen, welcher Zonentyp gerade gebraucht wird. Die Nachfrage entsteht aus gegenseitiger Abhängigkeit: Einwohner brauchen Jobs und Läden, Gewerbe braucht Kunden und Waren, Industrie braucht Arbeitskräfte und Abnehmer.
- Gebäude steigen in Stufen auf, wenn Bodenwert, Dienste und Bildung stimmen. Fortschritt wird so im Stadtbild sichtbar.
- CS2 differenziert stärker: Wohnen in niedriger, mittlerer (Reihenhäuser) und hoher Dichte, Mischnutzung mit Läden im Erdgeschoss, Wohnen mit niedrigen Mieten sowie Gewerbe, Industrie und Büros. Spezialisierte Industrie (Land- und Forstwirtschaft, Erz, Öl) wird über Flächenwerkzeuge angelegt.
- Zonen sind ein Abstraktionsgewinn: Man plant Nutzungen, nicht einzelne Häuser. Der damit verbundene Kontrollverlust ist gewollt – man „gärtnert“ eine Stadt eher, als dass man sie Stein für Stein baut.

#### 2.1.3 Straßenhierarchie und Verkehrs-KI

- Straßen gibt es in Stufen von der zweispurigen Wohnstraße über vier- und sechsspurige Hauptstraßen bis zur Autobahn, dazu Einbahnstraßen, Alleen, Brücken und Tunnel. Ein Upgrade-Werkzeug tauscht den Straßentyp, ohne die angrenzenden Zonen zu löschen.
- Gute Netze folgen einer Hierarchie: Wohnstraßen sammeln, Hauptstraßen verteilen, Schnellstraßen verbinden Stadtteile und Außenanschlüsse. Wer Durchgangsverkehr durch Wohngebiete leitet oder Kreuzungen zu dicht setzt, erzeugt Stau.
- Verkehr ist agentenbasiert: Bürger haben Wohnung und Arbeitsplatz und fahren tatsächlich, ebenso Liefer- und Dienstfahrzeuge. Die Wegsuche findet auf dem gebauten Netz statt.
- Eine bekannte Schwäche von C:S I ist die Spurwahl: Fahrzeuge ordnen sich früh auf die Spur ein, die sie am Ende brauchen, und lassen andere Spuren leer. Die Community reagierte mit Mods wie *Traffic Manager: President Edition* (TM:PE), die bessere Spurnutzung, Spurpfeile, Spurverbindungen, Vorfahrtsregeln und Parkverhalten nachrüsten. Dass ein Mod für viele zur Grundausstattung wurde, zeigt, wie stark das Verkehrssystem die Wahrnehmung des ganzen Spiels prägt.
- CS2 ersetzt die reine Kürzester-Weg-Logik durch Pfadkosten aus vier Faktoren: Zeit, Komfort, Geld (einschließlich Parkplatzverfügbarkeit) und Verhalten. Agenten wechseln Spuren, um den Fluss zu verbessern, und planen bei Ereignissen wie Unfällen neu. Laut Entwicklern berücksichtigen Dienste ihre Ziele nun über das tatsächliche Netz statt über Luftlinie.
- **Lektion:** Agentenverkehr ist anschaulich und erzeugt glaubwürdige Staus – aber nur, wenn das Verhalten nachvollziehbar bleibt. Unplausible Einzelentscheidungen (alle auf einer Spur, absurde Umwege) werden sofort als Fehler des Spiels gelesen, nicht als eigenes Planungsversagen.

#### 2.1.4 Versorgung: Strom, Wasser, Abwasser, Müll, Heizung

- **C:S I:** Strom läuft über Leitungen; aneinandergrenzende Gebäude leiten weiter. Wasser und Abwasser fließen durch ein unterirdisches Rohrnetz, Pumpen und Auslässe stehen an Gewässern. Wer Abwasser flussaufwärts der eigenen Pumpe einleitet, vergiftet die Versorgung – ein Klassiker der Lernkurve. Müll wird von Fahrzeugen zu Deponien oder Verbrennungsanlagen gebracht und belastet damit wiederum das Straßennetz.
- **Heizung in C:S I:** Die Erweiterung *Snowfall* (Februar 2016) brachte auf Winterkarten ein wasserbasiertes Heiznetz. Rohre werden zu Heizungsrohren aufgewertet und an Heizkessel oder Geothermiekraftwerke angeschlossen. Die Anlagen sind teuer und werden spät freigeschaltet, sodass man die ersten Kälteperioden überbrücken muss.
- **CS2:** Strom unterscheidet Nieder- und Hochspannung. Niederspannung läuft über in Straßen verlegte Kabel, Hochspannung über Freileitungen zu Umspannwerken. Der Bedarf schwankt mit der Temperatur: Hitze (Klimaanlagen) und Kälte (Heizen) erhöhen den Verbrauch, Notfall-Batteriespeicher puffern Spitzen. Ein eigenes Heiznetz wie in Snowfall nennen die gesichteten Quellen nicht; Heizen ist in den Strombedarf eingepreist. Wasser kann zusätzlich aus Grundwasser gefördert werden, das sich nur langsam erneuert und durch Bodenverschmutzung verdirbt. Abwasser wird über Auslässe in offene Gewässer geleitet oder in Kläranlagen gereinigt und zurück ins Frischwassernetz gespeist.
- Unterversorgung wirkt abgestuft: Fehlender Strom oder fehlendes Wasser senken das Wohlbefinden, Abwasserrückstau schadet zusätzlich der Gesundheit, Betriebe und Dienstgebäude verlieren Effizienz.

#### 2.1.5 Dienste mit Abdeckungsradius

- Polizei, Feuerwehr, Gesundheit, Bestattung, Bildung, Parks und Müllabfuhr wirken über einen Einflussbereich, der beim Platzieren als eingefärbte Straßen- oder Kreisfläche angezeigt wird.
- Entscheidend: Die Abdeckung ist nicht rein geometrisch. Einsatzfahrzeuge müssen das Ziel über das Straßennetz erreichen. Eine Feuerwache mit perfektem Radius nützt nichts, wenn die Zufahrt im Stau steht. So koppelt das Spiel scheinbar unabhängige Systeme an den Verkehr.
- Gebäude haben Kapazitäten (Betten, Schulplätze, Fahrzeuge). Über Budgetregler lässt sich in C:S I die Leistung eines Diensttyps stadtweit hoch- oder herunterfahren, mit Wirkung auf Abdeckung und Unterhalt.

#### 2.1.6 Öffentlicher Nahverkehr

- Linien entstehen, indem man nacheinander Haltestellen anklickt, bis die Schleife geschlossen ist. C:S I startet mit Bus, U-Bahn, Zug sowie Flughafen und Hafen; Erweiterungen ergänzten Taxis (*After Dark*), Straßenbahn (*Snowfall*) sowie Fähren, Einschienenbahn, Seilbahn und Luftschiffe (*Mass Transit*).
- Jede Linie zeigt Fahrgastzahlen und Fahrzeugeinsatz; Umsteigeknoten entstehen dort, wo Linien sich berühren.
- ÖPNV ist die wichtigste Antwort auf Verkehrsprobleme und damit ein eigenes Netzwerk-Puzzle innerhalb des Städtebaus. Hier liegt die engste Verbindung zu Mini Metro: Auch in Cities: Skylines entscheiden Linienführung, Umsteigepunkte und Takt über Erfolg – nur ohne harte Ressourcenknappheit, weil Geld im mittleren Spiel selten fehlt.

#### 2.1.7 Bodenwert, Verschmutzung und Lärm

- Bodenwert steigt mit Diensten, Parks, Wasserlage und Erreichbarkeit und sinkt mit Verschmutzung und Lärm. Er treibt die Gebäudestufen und damit die Steuereinnahmen.
- C:S I kennt Bodenverschmutzung (vor allem durch Industrie), Wasserverschmutzung und Lärm (Hauptstraßen, Gewerbe, Flughäfen). CS2 unterscheidet Boden-, Luft-, Wasser- und Lärmbelastung.
- Diese Werte sind räumliche Felder, die als Heatmap sichtbar werden. Sie erzwingen die Trennung von Nutzungen und erzeugen die typischen Pufferzonen aus Parks, Büros und Gewerbe zwischen Industrie und Wohnen.

#### 2.1.8 Bildung und Arbeitskräfte

- Einwohner durchlaufen Grundschule, weiterführende Schule und Universität und erreichen so Bildungsstufen. Arbeitsplätze verlangen bestimmte Stufen: Industrie braucht viele gering Qualifizierte, Büros höher Qualifizierte.
- Daraus entsteht ein bekanntes Paradox: Eine sehr gut ausgebaute Bildung kann die Industrie in den Arbeitskräftemangel treiben, weil hoch Gebildete einfache Jobs meiden. Bildungspolitik und Wirtschaftsstruktur müssen aufeinander abgestimmt werden.
- CS2 ergänzt Altersstruktur und Lebenswege und macht sie im *Lifepath Journal* einzelner Bürger sichtbar: Dort steht, was der Person im Lauf ihres Lebens widerfahren ist, samt Zufriedenheit und Chirper-Beiträgen.

#### 2.1.9 Distrikte und Verordnungen

- Distrikte werden mit einem Pinsel über die Stadt gemalt. Sie tragen Namen und erlauben Verordnungen für genau dieses Gebiet – etwa Rauchmelder, Recycling, Hochhausverbot oder Schwerverkehrsverbot – sowie Spezialisierungen (Forst, Landwirtschaft, Erz, Öl). Distrikte und Verordnungen werden über Meilensteine freigeschaltet.
- Die Erweiterung *Industries* (2018) baute das zu eigenen Industriegebieten mit Produktionsketten aus, die aufsteigen, wenn Produktions- und Personalziele erreicht sind.
- Distrikte geben Feinsteuerung, ohne neue Gebäude zu verlangen, und sie machen die Stadt benennbar – ein unterschätzter Beitrag zur emotionalen Bindung. In CS2 kritisierten Spieler die geringe Zahl an Distriktverordnungen.

#### 2.1.10 Haushalt, Steuern und Kredite

- Steuersätze werden pro Zonentyp eingestellt; zu hohe Steuern senken Zufriedenheit und Nachfrage.
- Ausgaben entstehen durch Unterhalt von Straßen, Diensten und ÖPNV. In C:S I lassen sich Budgets je Dienst in Prozent regeln, seit dem Update zu *After Dark* getrennt für Tag und Nacht.
- Kredite mit festen Laufzeiten überbrücken teure Anfangsinvestitionen.
- **Problem in C:S I:** Ab einer gewissen Größe wird Geld bedeutungslos, weil Einnahmen die Ausgaben deutlich übersteigen. Das Spiel verliert damit einen seiner wenigen Druckfaktoren.
- **CS2:** Die Wirtschaft sollte strenger und tiefer sein (Firmen, Ressourcenflüsse, Haushaltsvermögen), wurde zum Start aber als undurchsichtig und teils fehlerhaft empfunden. Das Update „Economy 2.0“ (Patch 1.1.5f1, Mitte 2024) entfernte unter anderem staatliche Subventionen, um die Wirtschaft herausfordernder und transparenter zu machen, und überarbeitete Unterhaltskosten und Nachfrageberechnung.

#### 2.1.11 Fortschritt: Meilensteine

- **C:S I:** Meilensteine hängen an der Einwohnerzahl. Jeder schaltet Dienste, Verordnungen, Zonentypen oder Kartenkacheln frei. Daneben gibt es einzigartige Gebäude mit eigenen Freischaltbedingungen und Monumente, die mehrere solcher Bedingungen voraussetzen – ein zweiter, zielorientierter Fortschrittsstrang.
- **CS2:** Meilensteine hängen an Erfahrungspunkten (XP). Passiv entstehen XP durch Bevölkerungs- und Zufriedenheitswachstum, aktiv durch Bauen (Dienstgebäude platzieren oder ausbauen, Wahrzeichen errichten, das Straßennetz erweitern). 20 Meilensteine, gruppiert in fünf große Stufen bis „Megalopolis“, liefern Geld, Erweiterungsgenehmigungen für neue Kacheln und Entwicklungspunkte. Letztere werden in Entwicklungsbäumen je Dienst ausgegeben; am Ende ist alles freischaltbar, der Spieler wählt nur die Reihenfolge.
- **Lektion:** Freischaltungen dienen in diesem Genre vor allem der Dosierung von Komplexität. Sie verhindern, dass Neulinge sofort den vollen Werkzeugkasten sehen, und gliedern Wachstum in Etappen. Die XP-Variante belohnt Aktivität statt nur Größe – mit dem Risiko, dass Bauen um des Bauens willen belohnt wird.

#### 2.1.12 Infoansichten und Benachrichtigungen

- Infoansichten färben die Stadt nach genau einem Merkmal ein: Strom, Wasser, Müll, Verschmutzung, Lärm, Bodenwert, Zufriedenheit, Gesundheit, Kriminalität, Bildung, Verkehrsfluss, ÖPNV, Tourismus und weitere. Gebäude mit Problemen tragen Warnsymbole (kein Strom, kein Wasser, Müll, keine Kunden, keine Arbeitskräfte).
- Eine später ergänzte Routenansicht zeigt, woher die Fahrzeuge auf einem Straßenabschnitt kommen und wohin sie fahren. Für die Verkehrsdiagnose ist das wertvoller als jede Farbskala, weil es die Frage „wer verursacht diesen Stau?“ beantwortet.
- Das Prinzip: Die Welt bleibt detailreich, aber man schaltet jeweils auf eine einzige Frage um. Das ist der wichtigste Mechanismus, mit dem das Spiel seine Komplexität beherrschbar hält.

#### 2.1.13 Chirper

- Chirper parodiert Twitter: Bürger posten Kurzmeldungen über Probleme (Abwasser, Lärm, Stau) und Erfolge. Gedacht ist das als Frühwarnung, bevor die Zufriedenheit sinkt.
- In CS2 kann man einzelnen Bürgern folgen, und Likes zeigen, wie viele Menschen ein Anliegen teilen. Das ist eine gute Idee: Die Zahl der Zustimmungen übersetzt eine Anekdote in eine Größenordnung.
- Kritik an beiden Teilen: Chirper ist oft repetitiv, manchmal widersprüchlich (Forderungen nach mehr Polizei trotz ausreichender Abdeckung) und wurde in C:S I von vielen stummgeschaltet. Erzählerisches Feedback funktioniert nur, wenn es präzise, selten und handlungsrelevant ist.

#### 2.1.14 Modding

- C:S I enthält Karten-, Asset- und Theme-Editor und ist an den Steam Workshop angebunden. Eine riesige Menge an Gebäuden, Fahrzeugen, Karten und Code-Mods (TM:PE, Move It und viele andere) hat das Spiel über Jahre lebendig gehalten. Modding ist dort Teil des Produkts, nicht Beiwerk.
- CS2 startete ohne vollständige Mod-Unterstützung. Mods kamen später über die Plattform Paradox Mods; Editor und Asset-Mods sollten laut der Ankündigung vom November 2025 vor dem Studiowechsel noch als Beta erscheinen, die weitere Arbeit am Editor liegt bei Iceflake.

#### 2.1.15 Tag/Nacht, Jahreszeiten und Zeit

- Mit *After Dark* (24. September 2015) bekam C:S I einen Tag-Nacht-Zyklus, den alle Spieler über ein kostenloses Update erhielten; Nachtleben-Inhalte gehörten zur Erweiterung. Nachts ändern sich Verkehr und Kriminalität, Straßenbeleuchtung kostet Geld.
- CS2 bringt Jahreszeiten und ein kartenabhängiges Klima, das über Temperatur und Niederschlag auf Systeme wie den Strombedarf zurückwirkt.
- Die Zeit läuft in mehreren Geschwindigkeiten und lässt sich pausieren; gebaut wird auch in der Pause.

#### 2.1.16 Steuerung und UX

- Das Straßenwerkzeug bietet gerade, gekrümmte und freie Segmente, Einrasten an Winkeln und Bestandsstraßen sowie ein Upgrade-Werkzeug. CS2 ergänzt komfortablere Werkzeuge, etwa für parallele Straßen und Raster.
- Die Bauleiste ist nach Kategorien gegliedert (Straßen, Zonen, Versorgung, Dienste, ÖPNV, Parks); Untermenüs zeigen Varianten mit Bau- und Unterhaltskosten.
- Die freie 3D-Kamera reicht vom Kartenblick bis auf Straßenhöhe; man kann einzelnen Bürgern oder Fahrzeugen folgen. Dieses Hineinzoomen in die eigene Schöpfung ist ein wichtiger emotionaler Lohn.

#### 2.1.17 Präsentation und Audio

- Realistisch-modellhafte Optik: aus großer Höhe fast eine Karte, aus der Nähe ein Modellbau. Musik bleibt im Hintergrund; Radiosender kamen bei C:S I als Zusatzinhalte hinzu, CS2 bringt ein integriertes Radio mit.
- Umgebungsgeräusche (Verkehr, Baustellen, Natur) hängen am Zoom; das Hören vermittelt Dichte.

#### 2.1.18 Was es besonders gut macht

- Verkehr als verbindendes System, an dem alle anderen Fehler sichtbar werden.
- Große Gestaltungsfreiheit (geschwungene Straßen, Distrikte, Mods), die Städte zu persönlichen Werken macht.
- Infoansichten als präzises Diagnosewerkzeug; fließender Wechsel zwischen Planer- und Bewohnerperspektive.
- Langfristige Bindung durch Modding und Erweiterungen.

#### 2.1.19 Schwächen

- Kaum Druck und kaum Scheitern; Geld wird in C:S I früh bedeutungslos, das Spätspiel ist für viele reine Gestaltung.
- Spurwahl und Wegsuche in C:S I, deren Reparatur Mods überlassen wurde.
- Obergrenzen für gleichzeitig simulierte Agenten und Leistungseinbrüche in großen Städten. CS2 hatte zum Start schwere Leistungsprobleme; eine viel beachtete Analyse brachte sie unter anderem mit dem Einsatz von Unitys damals junger DOTS-Technik in Verbindung, andere Stimmen verwiesen auf mangelnde Optimierung.
- Fragmentierung durch viele Erweiterungen: Grundspiel und „Vollausstattung“ fühlen sich wie zwei verschiedene Spiele an.
- Bei CS2 zusätzlich: undurchsichtige Wirtschaft zum Start, verspätete Editor- und Konsolenfassungen, schließlich der Studiowechsel.

---

### 2.2 Mini Metro (2015)

| | |
|---|---|
| Studio | Dinosaur Polo Club (Wellington, Neuseeland; Brüder Robert und Peter Curry) |
| Entstehung | Prototyp beim Game Jam Ludum Dare 26 (2013), damals „Mind the Gap“ |
| Erscheinen | 6./7. November 2015 für Windows, macOS, Linux (Datum je nach Zeitzone); Mobil 2016, Nintendo Switch 2018, PlayStation 4 2019 |
| Musik und Klang | Disasterpeace (Rich Vreeland), generatives Musiksystem |

#### 2.2.1 Kernschleife

1. Stationen erscheinen nach und nach auf der Karte.
2. Man verbindet sie mit Linien; Züge fahren automatisch.
3. Fahrgäste erscheinen an Stationen und wollen zu einer Station einer bestimmten Form.
4. Jede Woche kommen neue Ressourcen hinzu – aber die Stadt wächst schneller als das Netz.
5. Man baut um, bis eine Station überfüllt ist und die Partie endet. Die Punktzahl ist die Zahl beförderter Fahrgäste.

Zugespitzt: Mini Metro ist ein Spiel über den Moment, in dem ein gutes Netz nicht mehr gut genug ist.

#### 2.2.2 Stationsformen und Fahrgastziele

- Stationen haben Formen. Kreis, Dreieck und Quadrat sind die Grundformen, seltener kommen Sonderformen wie Kreuz, Stern oder Fünfeck hinzu. Fahrgäste tragen ebenfalls eine Form und wollen zu *irgendeiner* Station dieser Form – nicht zu einem bestimmten Ort.
- Diese Abstraktion ist der Kern des Designs. Sie ersetzt eine Ursprung-Ziel-Matrix durch eine Regel, die man in Sekunden versteht, und erzeugt trotzdem echte Planungsfragen: Jede Linie sollte möglichst viele verschiedene Formen bedienen, seltene Formen werden zu natürlichen Knotenpunkten.
- Die Formen sind ungleich verteilt: Kreise sind häufig, Quadrate deutlich seltener, Sonderformen rar. Wo neue Stationen auftauchen und welche Form sie haben, ist nicht vorhersehbar, folgt nach Beobachtung von Spielern aber auch keinem völlig gleichmäßigen Zufall. Jede Partie bekommt so ihre eigene Geografie.
- Fahrgäste steigen um, wenn ihr Ziel nur über eine andere Linie erreichbar ist. Fehlt eine Verbindung zu ihrer Form, warten sie.

#### 2.2.3 Linien ziehen

- Eine Linie entsteht, indem man von einer Station zur nächsten zieht. Enden lassen sich verlängern, Zwischenstationen durch Ziehen an einem Segment einfügen, Ringe durch Verbinden beider Enden schließen.
- Die Linien folgen 45°- und 90°-Winkeln wie auf einem schematischen U-Bahn-Plan.
- Umbauen ist günstig: Segmente lassen sich entfernen und neu legen, Züge zwischen Linien verschieben. Züge auf entfernten Abschnitten liefern ihre Fahrgäste noch ab. Fehler sind also korrigierbar, aber nicht folgenlos, weil währenddessen Fahrgäste weiter warten.
- Gewässer können nur mit Tunneln bzw. Brücken überquert werden, und die sind knapp. Die Geografie jeder Stadt wird dadurch zum Teil des Puzzles.

#### 2.2.4 Begrenzte Ressourcen

Mini Metro hat kein Geld. Stattdessen gibt es ein abzählbares Kontingent an Bauteilen:

| Ressource | Wirkung | Designfunktion |
|---|---|---|
| Linien | Anzahl farbiger Linien | begrenzt die Netzstruktur; jede neue Linie ist ein strategisches Ereignis |
| Lokomotiven | Züge auf einer Linie | erhöhen den Takt |
| Waggons | werden an Züge gehängt | erhöhen die Kapazität ohne zusätzlichen Takt |
| Tunnel / Brücken | Querung von Gewässern | machen Geografie zum Engpass |
| Umsteigebahnhöfe | werten eine Station auf | höhere Kapazität und schnelleres Umsteigen; machen einzelne Knoten robust |

Weil alles abzählbar ist, ist jede Entscheidung eine Abwägung zwischen klar benannten Optionen. Es gibt keinen Wechselkurs, den man im Kopf ausrechnen müsste, und keinen Überschuss, der Entscheidungen bedeutungslos macht.

#### 2.2.5 Wöchentliche Upgrade-Wahl

- Am Ende jeder Spielwoche gibt es eine neue Lokomotive und die Wahl zwischen zwei Belohnungen, etwa einer zusätzlichen Linie, einem Waggon, Tunneln/Brücken oder einem Umsteigebahnhof. Die Auswahl unterscheidet sich je nach Stadt.
- Die Wahl ist der Taktgeber des Spiels. Sie erzwingt in festen Abständen eine bewusste Entscheidung und gibt das Gefühl, auf die Lage zu reagieren. Gleichzeitig verhindert sie Ressourcen-Horten, weil das Angebot nie alles enthält, was man bräuchte.
- Die Spieluhr (Stunden, Tage, Wochen) ist sichtbar. Man weiß, wann die nächste Wahl kommt, und kann darauf hinplanen – eine einfache, aber wirksame Form von Vorfreude und Spannung.

#### 2.2.6 Überfüllung als Scheitern

- Jede Station fasst nur eine Handvoll wartender Fahrgäste. Wird es mehr, füllt sich ein Ring um die Station. Sinkt die Zahl, läuft der Ring zurück; ist er voll, endet die Partie.
- Das Scheitern ist lokal, sichtbar und angekündigt: Man sieht, welche Station kippt, und hat Zeit zu reagieren. Der Untergang wirkt nicht willkürlich, sondern als Folge eigener Entscheidungen.
- Weil die Stadt unbegrenzt wächst und die Ressourcen begrenzt sind, ist das Ende im Normalmodus unvermeidlich. Die Frage ist nicht, *ob* das Netz zusammenbricht, sondern *wann*. Das verschiebt das Ziel von „gewinnen“ zu „länger durchhalten als beim letzten Mal“.

#### 2.2.7 Pausieren und Umplanen

- Das Spiel lässt sich jederzeit pausieren, und Linien und Züge können in der Pause umgebaut werden. Dazu gibt es eine schnellere Spielgeschwindigkeit.
- Pausieren macht aus einem Echtzeitspiel ein Planungsspiel unter Echtzeitdruck. Der Druck entsteht nicht aus Reaktionsgeschwindigkeit, sondern aus Einsicht. Das ist ein wesentlicher Grund für die breite Zugänglichkeit.

#### 2.2.8 Minimalistischer Stil

- Die Karte ist eine schematische Fläche mit wenigen Farben, Gewässer sind einfache Formen, Linien leuchten in kräftigen Farben. Das Erscheinungsbild erinnert bewusst an schematische Netzpläne wie den Londoner Tube-Plan. Mit wachsender Stadt zoomt die Ansicht heraus.
- Jedes sichtbare Element ist spielrelevant; es gibt keine Dekoration, die man erst herausfiltern müsste. Formen, Linienfarben und Überfüllungsringe sind auf einen Blick lesbar. Die Klarheit trägt die Mechanik.
- Die Karten basieren auf realen Städten wie London, Paris, New York oder Berlin, deren Flussverläufe die Geografie bestimmen; einige Städte haben Sonderregeln.

#### 2.2.9 Generative Musik und Klang (Disasterpeace)

- Rich Vreeland komponierte keine Musikstücke, sondern ein Musiksystem. Fast alle Klänge sind Samples, die in Echtzeit durch Spielereignisse ausgelöst werden: neue Stationen, fahrende Züge, erscheinende Fahrgäste.
- Vreeland beschrieb den Ansatz in einem GDC-Vortrag 2018 als Verbindung von Sonifikation – Spieldaten werden hörbar gemacht – mit Serialismus, also dem Anordnen von Datenfolgen auf Achsen wie Tonhöhe, Lautstärke und Rhythmus. Geloopte Musikstücke sollten ganz vermieden werden. Die Spieluhr aus Stunden, Tagen und Wochen liefert die zeitliche Struktur.
- Wirkung: Die Musik wird mit dem Netz dichter und komplexer und ist damit selbst eine Zustandsanzeige. Gleichzeitig wirkt sie ruhig und hypnotisch und soll ausdrücklich den Stress ausbalancieren, den das Spiel erzeugt.

#### 2.2.10 Modi

- **Normal:** gewertete Partie bis zur Überfüllung.
- **Endlos:** kein Scheitern, stressfreies Bauen.
- **Extrem:** Einmal gelegte Linien sind endgültig. Das Umplanen fällt weg, und das Spiel wird zu einem reinen Vorausplanungsspiel.
- **Kreativ:** freier Baukasten.
- **Tägliche Herausforderung:** eine festgelegte Partie pro Tag mit weltweitem Vergleich.
- Weitere Städte werden nach und nach über erreichte Fahrgastzahlen freigeschaltet, was der Highscore-Jagd eine leichte Fortschrittsstruktur gibt.

#### 2.2.11 Was es besonders gut macht

- Ein einziges System, vollständig lesbar und trotzdem tief.
- Knappheit als Motor: Jede Ressource ist zählbar, jede Woche erzwingt eine Wahl.
- Scheitern ist lokal, angekündigt und selbst verschuldet – und deshalb motivierend statt frustrierend.
- Präsentation und Klang sind Teil der Informationsvermittlung, nicht Verpackung.
- Kurze, sofort verständliche Partien mit hoher Wiederspielbarkeit.

#### 2.2.12 Schwächen

- Wenig langfristige Struktur jenseits der Highscore-Jagd; es entsteht keine Stadt, die man „besitzt“ und weiterentwickelt.
- Die Abstraktion schließt viele Fantasien aus: keine Stadtentwicklung, kein Wirtschaftsmodell, keine Bürger mit Geschichten.
- Ungünstige Stationsplatzierung kann Partien früh vorentscheiden.
- Im Spätspiel verwaltet man oft nur noch den unvermeidlichen Untergang; das kann sich ausweglos anfühlen.

---

### 2.3 Mini Motorways (2019/2021)

- **Studio / Jahr:** Dinosaur Polo Club. Apple Arcade am 19. September 2019, Steam am 20. Juli 2021 (mit Kreisverkehren und neuen Karten), Nintendo Switch im Mai 2022. Klang erneut von Disasterpeace.
- **Kernschleife:** Häuser einer Farbe schicken Autos zu Zielgebäuden derselben Farbe und zurück. Man verbindet beide mit Straßen, die Kachel für Kachel aus einem begrenzten Vorrat gelegt werden. Neue Häuser und Ziele erscheinen, die Karte wächst.
- **Systeme und Ressourcen:** Straßenkacheln, Brücken, Tunnel, Autobahnen (eine Direktverbindung über fast alles hinweg außer Berge), Ampeln und Kreisverkehre (3×3, ohne Straßenkachelverbrauch). Wöchentlich wählt man zwischen zwei Paketen, etwa vielen Straßenkacheln oder weniger Kacheln plus einem Sonderbauteil.
- **Druck und Scheitern:** Zielgebäude sammeln unerfüllte Nachfrage. Staut sich zu viel, läuft ein Timer; ist er abgelaufen, endet die Partie. Gezählt werden erfolgreiche Fahrten.
- **Feedback:** Nachfrage als Symbole an den Zielen; Staus sind direkt sichtbar, weil jedes Auto zu sehen ist.
- **Präsentation:** Draufsicht in gedeckten Farben, je Stadt eigene Farbpalette. Der Klang wird aus Verkehrsgeräuschen musikalisch geformt.
- **Stärken:** Überträgt die Mini-Metro-Formel auf Autoverkehr, den jeder aus dem Alltag kennt. Straßen als abzählbare Kacheln machen Platz und Wegeführung spürbar.
- **Schwächen:** Verkehr ist schwerer vorherzusagen als Fahrgastflüsse, weil Autos sich gegenseitig blockieren. Ampeln wurden als oft nutzlos oder kontraproduktiv kritisiert.
- **Lektion:** Individualverkehr in Reinform ist ein schwierigeres und undurchsichtigeres Puzzle als ÖPNV. Je mehr Agenten sich gegenseitig behindern, desto wichtiger werden Diagnosewerkzeuge.

---

### 2.4 SimCity (Klassiker und SimCity 2013)

**Die Klassiker (kurz):**

- **SimCity (1989, Maxis, Will Wright):** Draufsicht, Zonen nach RCI, Straßen, Schienen, Stromleitungen, Steuern, Katastrophen und Szenarien. Kein festes Spielziel; Wright verstand seine Spiele eher als Software-Spielzeuge. Die Simulation arbeitet mit Feldern und Statistiken, nicht mit individuellen Agenten.
- **SimCity 2000 (1993):** isometrische Ansicht, unterirdische Ebene für Wasserleitungen und U-Bahn, Höhenstufen und Terraforming, ein echtes Haushaltsfenster mit Anleihen.
- **SimCity 3000 (1999):** u. a. Müllentsorgung als eigenes System und Abkommen mit Nachbarstädten.
- **SimCity 4 (2003):** Regionen aus mehreren Städten, die Nachfrage und Pendler teilen; Regionen ließen sich mit anderen Spielern teilen. Die Erweiterung *Rush Hour* (September 2003) stellte den Verkehr stärker in den Mittelpunkt.

**SimCity (2013):**

- **Studio / Jahr:** Maxis Emeryville / Electronic Arts, 5. März 2013 (Nordamerika). Engine: GlassBox.
- **Ansatz:** GlassBox sollte jedes Element der Stadt sichtbar simulieren; Maxis sprach von bis zu 100.000 einzelnen Sims pro Stadt. Städte waren Teil einer Region mit Spezialisierungen und Handel untereinander; Straßen konnten geschwungen sein, und der Straßentyp bestimmte die mögliche Dichte.
- **Probleme:** Online-Zwang und ein von technischen Störungen geprägter Start. Die Stadtflächen waren sehr klein, was mit der Rechenlast der Simulation begründet wurde. Ein Offline-Modus kam erst mit dem zehnten Update. Spieler fanden heraus, dass Sims keine festen Wohnungen und Arbeitsplätze hatten, sondern jeweils den nächstgelegenen freien Job oder das nächste passende Heim ansteuerten; Polizeiwagen fuhren gemeinsam zum selben Einsatz. Kommentatoren folgerten, man müsse Städte um die Schwächen der Algorithmen herum bauen. Das Studio in Emeryville wurde im März 2015 geschlossen.
- **Stärken der Reihe:** Erfindung des Genres, RCI als universell verständliches Modell, Katastrophen und Szenarien als Druck, Regionen als Maßstabserweiterung.
- **Lektion aus 2013:** Sichtbare Agenten wecken einen Anspruch auf Plausibilität. Vereinfachungen, die nur nach Simulation *aussehen*, fliegen auf, sobald man einem Agenten folgt. Und wer den Maßstab zugunsten einer aufwendigen Simulation beschneidet, nimmt dem Spieler genau das, was er sucht: Raum.

---

### 2.5 Anno-Reihe (seit 1998)

- **Studio / Jahr:** Anno 1602 (1998, Max Design, Österreich) begründete die Reihe; spätere Teile kamen von Related Designs und Ubisoft Blue Byte. Anno 1800 (2019) entstand bei Ubisoft Blue Byte in Mainz, Anno 117: Pax Romana (13. November 2025) bei Ubisoft Mainz.
- **Kernschleife:** Siedlung gründen → Bedürfnisse der Bewohner mit Waren decken → Häuser steigen auf → höhere Stufen verlangen neue, komplexere Waren → neue Inseln oder Regionen erschließen, Handelsrouten aufbauen.
- **Bedürfnisstufen:** In Anno 1800 gibt es in der Alten Welt fünf Stufen (Bauern, Arbeiter, Handwerker, Ingenieure, Investoren) und in der Neuen Welt zwei (Jornaleros, Obreros). Grundbedürfnisse bestimmen, wie viele Menschen in einem Haus leben, Luxusbedürfnisse heben Zufriedenheit und Steuern. Der Aufstieg verlangt Waren im Lager und Dienste in der Nähe, etwa Schulen.
- **Produktionsketten:** mehrstufige Ketten von Rohstoff über Zwischenprodukt zum Endprodukt. Jedes Produktionsgebäude braucht eine bestimmte Arbeiterschicht, deshalb müssen alle Stufen parallel bestehen bleiben – Aufstieg heißt nicht Ersetzen. Inseln haben unterschiedliche Fruchtbarkeiten; nicht jede Pflanze wächst überall, was Expansion und Handel erzwingt.
- **Ressourcen:** Geld (laufende Bilanz), Waren in Lagern, Arbeitskräfte je Stufe, Fläche, in Anno 1800 zusätzlich Einfluss.
- **Fortschritt:** Freischaltungen durch Bevölkerungszahlen je Stufe; neue Regionen öffnen neue Ketten.
- **Druck und Scheitern:** negative Bilanz, Unzufriedenheit bis zu Unruhen, Brände und Krankheiten, Konkurrenten, Piraten und militärische Konflikte; im freien Spiel selten hartes Scheitern.
- **Feedback:** Bedarfsanzeigen beim Anklicken von Häusern, Produktionsbilanzen (Erzeugung gegen Verbrauch), Einflussbereiche von Marktplätzen und Diensten, Warnsymbole bei fehlenden Rohstoffen.
- **Steuerung / UX:** rasterbasiertes Platzieren mit Einzugsradien; in Anno 1800 ein Blaupausenmodus zum Vorplanen.
- **Präsentation:** detailreiche Wimmelbilder mit sichtbaren Bürgern und Karren, historische Settings, orchestrale Musik.
- **Stärken:** Produktionsketten als lesbares Puzzle; Bedürfnisstufen als natürliche Fortschrittsleiter, die Wachstum mit wachsender Komplexität koppelt; Erfolg sichtbar im Stadtbild.
- **Schwächen:** Das Spätspiel wird zur Logistikverwaltung über mehrere Regionen; hohe Einstiegshürde; großer Zusatzinhaltekatalog.
- **Lektion:** Bedürfnisstufen verändern Nachfrage *qualitativ*, nicht nur quantitativ. Wachstum bedeutet dann nicht „mehr vom Gleichen“, sondern „etwas Neues“.

---

### 2.6 Transport Tycoon (1994) und OpenTTD (2004)

- **Studio / Jahr:** Transport Tycoon von Chris Sawyer, 1994 bei MicroProse erschienen, 1995 als Transport Tycoon Deluxe erweitert. OpenTTD ist eine quelloffene Neuumsetzung auf Basis eines Reverse-Engineerings von Transport Tycoon Deluxe durch Ludvig Strigeus; erste öffentliche Version im März 2004, seit 2018 auf GitHub, seit April 2021 auch auf Steam.
- **Kernschleife:** Industrien und Städte mit Fahrzeugen verbinden → Fracht und Passagiere transportieren → Einnahmen → in Strecken, Bahnhöfe und Fahrzeuge reinvestieren.
- **Systeme:** Schiene mit Signalen und Blockabschnitten, Straße, Schiff, Flugzeug; Güterketten (etwa Kohle zum Kraftwerk, Holz zum Sägewerk, Waren in die Stadt); Städte wachsen mit guter Anbindung; Konkurrenzfirmen (KI oder Mitspieler); Fahrzeugalterung, Pannen, technologische Zeitachse mit neuen Modellen.
- **Ressourcen:** Geld, Kredit, Fahrzeuge, Bahnhofskapazität. Die Bezahlung hängt von Menge, Geschwindigkeit und Verderblichkeit ab – Passagiere müssen schneller ankommen als Kohle, um gutes Geld zu bringen.
- **Fortschritt:** Zeitachse über Jahrzehnte statt Freischaltungen durch Erfolg.
- **Druck und Scheitern:** Bankrott, laufende Kosten (optional mit Infrastrukturunterhalt), Bewertung durch die Gemeinden, Bahnhofsbewertung. Bahnhöfe mit hoher Bewertung erhalten mehr Fracht; schnelle Fahrzeuge, häufige Abholung und wenig wartende Fracht verbessern sie.
- **Feedback:** Bahnhofsbewertungen in Prozent, Fahrzeuglisten mit Gewinn pro Fahrzeug, Diagramme zu Einnahmen und Fracht.
- **Steuerung / UX:** dichte, fensterbasierte Oberfläche mit sehr vielen Optionen; steile Lernkurve.
- **Präsentation:** Pixel-Isometrie, die seit drei Jahrzehnten lesbar bleibt; Grafik- und Fahrzeugerweiterungen über NewGRF-Pakete.
- **Stärken:** Netzwerkdesign mit klaren, lernbaren Regeln (Signale); jede Route hat eine eigene, messbare Bilanz; enorme Langlebigkeit durch Offenheit.
- **Schwächen:** gealterte Oberfläche; im Spätspiel wird Automatisierung (automatischer Fahrzeugersatz) zur Verwaltung; Städte sind eher Kulisse als Mitspieler.
- **Lektion:** Transport trägt ein ganzes Spiel, wenn jede Verbindung eine eigene, ablesbare Erfolgskennzahl hat.

---

### 2.7 Frostpunk (2018) und Frostpunk 2 (2024)

- **Studio / Jahr:** 11 bit studios (Polen). Frostpunk 2018, Frostpunk 2 am 20. September 2024.
- **Kernschleife:** Ein Generator im Zentrum heizt die Stadt → Kohle beschaffen, Gebäude im Wärmeradius anordnen → Arbeitskräfte zuteilen → Gesetze erlassen → bis zum Ende des Szenarios überleben, das meist auf einen großen Kältesturm zuläuft.
- **Systeme:** Wärme (Generatorstufen, Überlastung, Heizer), Temperaturvorhersage, Arbeitskräfte (Arbeiter, Ingenieure, Kinder), Gesundheit, Forschung, Erkundung. Das Gesetzbuch besteht aus den Bäumen „Anpassung“ und „Zweck“; Letzterer teilt sich in die sich ausschließenden Wege Glaube und Ordnung. Gesetze sind nicht zurücknehmbar, und nach jedem Gesetz gilt eine Wartezeit (rund 18 Spielstunden).
- **Ressourcen:** Kohle, Holz, Stahl, Nahrung, Dampfkerne – dazu die Stimmungswerte Hoffnung und Unzufriedenheit.
- **Druck und Scheitern:** Fällt die Hoffnung zu tief oder steigt die Unzufriedenheit zu hoch, wird man aus der Stadt verstoßen. Kälte tötet. Szenarien haben klare Spannungsbögen mit Ende.
- **Feedback:** Wärmeansicht, Temperaturprognose, Stimmungsbalken; Forderungen der Bevölkerung, die man als Versprechen annehmen oder ablehnen kann.
- **Präsentation:** düsterer Steampunk, kreisförmige Stadtanlage, stark atmosphärischer Ton.
- **Stärken:** Moral als Mechanik – jede Effizienzsteigerung hat einen menschlichen Preis. Erzählung entsteht aus Systemen. Klare Dramaturgie mit Ende statt endlosem Sandkasten.
- **Schwächen:** stark geskriptete Szenarien, begrenzter Wiederspielwert; hat man eine tragfähige Strategie gefunden, verliert der Druck an Wirkung.
- **Frostpunk 2:** Der Maßstab wächst von Gebäuden zu Distrikten. Fraktionen (etwa Icebloods und Technokraten) ringen um Einfluss, Gesetze werden in einem Rat abgestimmt; der Spieler wird zum Vermittler.
- **Lektion:** Ein zentraler, physisch sichtbarer Druckfaktor (der Generator) plus irreversible Entscheidungen erzeugen Bedeutung. Irreversibilität funktioniert, wenn sie Thema des Spiels ist.

---

### 2.8 Banished (2014)

- **Studio / Jahr:** Shining Rock Software, 18. Februar 2014; entwickelt von Luke Hodorowicz allein.
- **Kernschleife:** Eine Gruppe Verbannter sammelt Holz, Stein und Nahrung → Häuser bauen → Familien gründen → Bevölkerung wächst → mehr Arbeit, mehr Bedarf → den Winter überstehen.
- **Systeme:** Bürger sind die zentrale Ressource: Sie werden geboren, altern, arbeiten und sterben. Jahreszeiten, Felder, Obstgärten, Fischerei und Jagd; Kleidung und Brennholz gegen Kälte; Gesundheit und Krankheiten; Nomaden als Zuzug; Handelsposten mit Tauschhandel. Kein Geld, kein Technologiebaum, kein Militär.
- **Ressourcen:** Güter und Arbeitskraft.
- **Druck und Scheitern:** Hungersnot, Erfrieren, Seuchen und demografische Wellen, wenn eine ganze Generation gleichzeitig altert und wegstirbt.
- **Feedback:** Statistikfenster existieren, die Rückmeldung auf eigene Aktionen wurde aber zum Start als schwach kritisiert.
- **Präsentation:** zurückhaltender Realismus, ruhige Musik.
- **Stärken:** Demografie als Systemdruck; ernsthaftes Überleben in der Anfangsphase.
- **Schwächen:** Wächst die Stadt, sinkt der Überlebensdruck spürbar; kein Ziel jenseits von Erfolgen.
- **Lektion:** Bevölkerung als Ressource statt als Punktestand. Zeitverzögerte Effekte (Kinder werden erst später zu Arbeitskräften) erzeugen Planungstiefe, verlangen aber gute Vorhersageanzeigen.

---

### 2.9 Islanders (2019)

- **Studio / Jahr:** Grizzly Games aus Berlin (Friedemann Allmenröder, Jonas Tyroller, Paul Schnepf; entstanden während des Studiums an der HTW Berlin), 4. April 2019 für PC, Konsolen 2021. Der Nachfolger *Islanders: New Shores* erschien am 10. Juli 2025, entwickelt von The Station und veröffentlicht von Coatsink.
- **Kernschleife:** Gebäude aus einem Vorrat auf eine prozedural erzeugte Insel setzen → jedes Gebäude bringt Punkte abhängig von seiner Nachbarschaft → Punkte füllen den Vorrat mit neuen Gebäudepaketen → mit genug Punkten geht es auf eine neue Insel.
- **Ressourcen:** nur Punkte und Gebäudevorrat; keine Wirtschaft, keine Agenten.
- **Druck und Scheitern:** Die Partie endet, wenn der Vorrat leer ist und die Punkte für ein neues Paket nicht reichen.
- **Feedback:** Vor dem Platzieren zeigt das Spiel, wie viele Punkte die Position bringt und welche Nachbarn sie beeinflussen. Man sieht die Folge jeder Entscheidung vor der Entscheidung.
- **Präsentation:** Low-Poly, Pastellfarben, ruhige Musik.
- **Stärken:** Platzierung in Reinform; die perfekte Vorschau macht jede Entscheidung lesbar; überschaubare Partien.
- **Schwächen:** wenig Tiefe über die Zeit – Gebäude verändern sich nach dem Platzieren nicht mehr. New Shores ergänzt deshalb einmalige Boni und einen Sandkastenmodus.
- **Lektion:** Eine Vorschau der Konsequenzen („wenn du hier baust, passiert X“) ist das stärkste Mittel, räumliche Entscheidungen verständlich zu machen.

---

### 2.10 Townscaper (2020/2021)

- **Studio / Jahr:** Oskar Stålberg, veröffentlicht von Raw Fury; Early Access 2020, Vollversion sowie Switch- und Mobilfassungen 2021.
- **Kernschleife:** Farbige Blöcke auf ein unregelmäßiges Gitter setzen → ein Algorithmus formt aus der Anordnung Häuser, Bögen, Treppen, Brücken und Gärten → betrachten, weiterbauen.
- **Systeme:** regelbasierte, nachbarschaftsabhängige Formgebung; sie wird oft mit Constraint-Verfahren in der Art von „Wave Function Collapse“ in Verbindung gebracht, die gesichteten Quellen benennen das Verfahren aber nicht.
- **Ressourcen, Fortschritt, Scheitern:** keine. Stålberg bezeichnete es selbst eher als Spielzeug denn als Spiel.
- **Feedback:** rein ästhetisch und unmittelbar; jede Eingabe hat eine überraschende, aber stimmige Folge.
- **Präsentation:** Pastell, Wasser, Möwen, sanfte Klänge.
- **Stärken:** Taktile Freude am Bauen. Zeigt, wie viel Vergnügen bereits im Werkzeug selbst stecken kann, wenn einfache Eingaben automatisch zu reichen Ergebnissen veredelt werden.
- **Schwächen:** Ohne Ziele kaum Langzeitbindung.
- **Lektion:** Das Bauen selbst muss sich gut anfühlen – Animation, Klang, automatische Detailanpassung. Dieser „Spielzeugkern“ trägt auch dann, wenn die Systeme gerade nichts verlangen.

---

### 2.11 Dorfromantik (2021/2022)

- **Studio / Jahr:** Toukana Interactive (Berlin). Early Access am 25. März 2021, Vollversion am 28. April 2022. Beim Deutschen Computerspielpreis 2021 ausgezeichnet für bestes Game Design und bestes Debüt; die Brettspieladaption wurde 2023 „Spiel des Jahres“.
- **Kernschleife:** Sechseckkacheln aus einem Stapel anlegen → passende Kanten (Wald an Wald, Fluss an Fluss) bringen Punkte → Aufträge (etwa ein Waldgebiet bestimmter Größe) bringen neue Kacheln → die Partie endet, wenn der Stapel leer ist.
- **Systeme:** Kantenpassung, Aufträge, Bonus für perfekte Platzierung, Flüsse und Schienen als durchgehende Netze, die nicht unterbrochen werden dürfen.
- **Ressourcen:** Der Kachelstapel ist Zeitbudget und Lebensleiste zugleich.
- **Druck und Scheitern:** sanft; das Ende kommt durch Erschöpfung des Stapels, nicht durch Katastrophe.
- **Feedback:** Vorschau gültiger Positionen, Zahlen an offenen Aufträgen, Klangsignale bei guten Platzierungen.
- **Präsentation:** weiche, malerische Optik, entspannte Musik, Natur- und Tiergeräusche.
- **Stärken:** Ein einziger, verständlicher Druckmechanismus. Aufträge verbinden kurzfristige Ziele mit räumlicher Planung.
- **Schwächen:** wenig Abwechslung in langen Partien; Optimierungsdruck kann die Entspannung verdrängen.
- **Lektion:** Eine Lebensleiste, die durch gutes Spiel aufgefüllt wird statt durch Zeit oder Geld, verbindet Belohnung und Überleben elegant.

---

### 2.12 Tropico (seit 2001)

- **Studio / Jahr:** Tropico (2001, PopTop Software, Phil Steinmeyer); Tropico 3 bis 5 (2009–2014) von Haemimont Games im Auftrag von Kalypso Media; Tropico 6 (2019) von Limbic Entertainment, Zusatzinhalte später von Kalypsos internem Studio Realmforge.
- **Kernschleife:** Als „El Presidente“ eine Inselrepublik aufbauen → Exportwirtschaft (Plantagen, Minen, Fabriken, Tourismus) entwickeln → Bürgerbedürfnisse und Fraktionen ausbalancieren → Wahlen gewinnen, manipulieren oder vermeiden.
- **Systeme:** Fraktionen mit Gegensätzen (Kapitalisten und Kommunisten, Religiöse und Militaristen, Konservative und Intellektuelle, Industrielle und Umweltschützer), Erlasse, Verfassung, Wahlen, Rebellen und Putschgefahr, Epochen von der Kolonialzeit bis zur Moderne (seit Tropico 5), ein Schweizer Konto für das Privatvermögen.
- **Ressourcen:** Staatskasse, Schweizer Konto, Zustimmung der Fraktionen, Ansehen.
- **Druck und Scheitern:** Wahlniederlage, Revolution, Militärputsch, Bankrott; Missionen mit konkreten Zielen.
- **Feedback:** Bürger einzeln anklickbar mit Gedanken und Meinungen; Fraktionsübersichten; Berater und ein Radio mit satirischen Kommentaren.
- **Präsentation:** Karibik-Setting, lateinamerikanische Musik, satirischer Ton.
- **Stärken:** Politik als System; Humor über Erzählerstimmen; jede Entscheidung hat Gewinner und Verlierer.
- **Schwächen:** Stadtsimulation und Verkehr eher flach; Strategien wiederholen sich über Missionen.
- **Lektion:** Interessengruppen machen aus reinen Optimierungsentscheidungen echte Abwägungen.

---

### 2.13 Timberborn (2021/2026)

- **Studio / Jahr:** Mechanistry (Polen). Early Access am 15. September 2021, Version 1.0 am 12. März 2026 (ursprünglich für den 5. März angekündigt).
- **Kernschleife:** Eine Biberkolonie ernähren und mit Wasser versorgen → Dämme, Deiche und Schleusen bauen, um Wasser für Dürren zu speichern → Holz, Nahrung und Wissenschaft erwirtschaften → in die Höhe bauen.
- **Systeme:** physikbasierte Wassersimulation (seit dem Update „Wonders of Water“ im Oktober 2024 dreidimensional), Dürren, die mit der Zeit länger werden, „Badtides“ mit giftigem Wasser, zwei Fraktionen (Folktails vermehren sich natürlich, Iron Teeth kommen aus Klontanks), Terraforming, vertikales Bauen, mechanische Energie.
- **Ressourcen:** Güter, Wasser, Wissenschaftspunkte, Wohlbefinden; kein Geld.
- **Druck und Scheitern:** Dürre, verseuchtes Wasser und Hunger; die Kolonie kann aussterben.
- **Feedback:** sichtbare Wasserstände, Ankündigung der nächsten Trockenzeit, Bedürfnisanzeigen.
- **Präsentation:** selbst ernannter „Lumberpunk“, Cartoon-Biber, Holztechnik.
- **Stärken:** Wasser als Gelände-System: Man baut nicht nur auf der Landschaft, man formt, wie eine Ressource über sie fließt. Saisonale Bedrohung mit Vorlaufzeit.
- **Schwächen:** Mikromanagement in großen Kolonien; im Spätspiel kommen kaum neue Bedrohungen hinzu.
- **Lektion:** Ein physikalisches Flusssystem kann ein ganzes Spiel tragen, wenn es vorhersagbar ist und in einen saisonalen Rhythmus eingebettet wird.

---

### 2.14 Against the Storm (2022/2023)

- **Studio / Jahr:** Eremite Games (Polen), veröffentlicht von Hooded Horse; Early Access ab 2022, Version 1.0 am 8. Dezember 2023.
- **Kernschleife:** Von der Hauptstadt aus Siedlungen gründen → jede Siedlung ist ein abgeschlossener Durchlauf → Ruf sammeln, bevor die Ungeduld der Königin voll ist → zurückkehren und Meta-Fortschritt investieren.
- **Systeme:** fünf spielbare Völker mit eigenen Bedürfnissen und Vorlieben (u. a. Menschen, Biber, Echsen); Moral („Resolve“); Jahreszeiten aus Nieselregen, Aufklaren und Sturm; Lichtungen, die Ressourcen und Gefahrenereignisse bringen und die Feindseligkeit erhöhen; jährlich angebotene „Ecksteine“ als Modifikatoren; Aufträge; Seuchenbefall. Gebäudebaupläne werden zufällig angeboten.
- **Ressourcen:** Rohstoffe und Waren, Ruf, Ungeduld, Handelswährung, Meta-Währungen.
- **Druck und Scheitern:** Die Ungeduld der Königin wirkt als Zeitlimit; Ruf entsteht vor allem durch Aufträge, Lichtungsereignisse und zufriedene Völker. Wer zu langsam ist, verliert die Siedlung.
- **Feedback:** Ruf- und Ungeduldsleiste prominent am Bildschirmrand; Bedürfnisse je Volk; Produktionsübersichten.
- **Stärken:** Löst das Spätspiel-Problem radikal – nach dem Erfolg ist die Siedlung vorbei. Zufällige Baupläne und Ecksteine verhindern Einheitslösungen.
- **Schwächen:** hohe Komplexität; Meta-Fortschritt kann sich wie Pflicht anfühlen; es gibt keine dauerhaft wachsende Stadt.
- **Lektion:** Durchlaufstruktur plus zufälliges Angebot ergibt Städtebau mit Wiederspielwert ohne Mid-Game-Leere.

---

### 2.15 Kurzporträts

**Workers & Resources: Soviet Republic** (3Division, veröffentlicht von Hooded Horse; Early Access 2019, Version 1.0 am 20. Juni 2024). Fast alles ist physisch simuliert: Baumaterial muss zur Baustelle gefahren werden, Arbeiter pendeln, Güter werden über Straße, Schiene und Förderanlagen bewegt. Referenz für radikale Simulationstreue – und für ihren Preis: eine sehr steile Lernkurve und viel Logistik, bevor die Stadt überhaupt entsteht.

**Factorio** (Wube Software, Prag; Early Access Februar 2016, Version 1.0 am 14. August 2020, Erweiterung *Space Age* am 21. Oktober 2024). Nur als Logistik-Referenz: Durchsatz, Förderbänder, Mengenverhältnisse und Zugnetze mit Signalen. Engpässe sind physisch sichtbar, weil sich Waren auf Bändern stauen; Produktionsstatistiken zeigen Erzeugung und Verbrauch. Lehre: Wenn ein Engpass *sichtbar* ist, wird Fehlersuche selbst zum Spielspaß.

**Manor Lords** (Slavic Magic, im Wesentlichen ein Einzelentwickler; veröffentlicht von Hooded Horse; Early Access am 26. April 2024). Organische Platzierung: Wohngrundstücke entstehen entlang frei gezogener Wege und lassen sich in Form und Größe anpassen, Hinterhöfe nehmen Gärten oder Werkstätten auf. Ausgebaute Grundstücke heben die Siedlungsstufe und bringen Entwicklungspunkte. Lehre: Platzierung jenseits starrer Raster erzeugt glaubwürdig gewachsene Siedlungen, verlangt aber gute Werkzeuge.

**Pocket City** (Codebrew Games, 2018; *Pocket City 2* am 8. April 2023). Premium-Städtebau für Mobilgeräte ohne Mikrotransaktionen; Zonen per Wischgeste, kurze Sitzungen. Der Nachfolger ist in 3D und lässt den Spieler als Bürgermeister durch die eigene Stadt laufen. Lehre: Touch-Bedienung zwingt zu Vereinfachung, die auch auf dem PC gut tut.

---

## 3. Vergleichstabelle

Legende: „Agenten“ = individuell simulierte Bürger, Fahrzeuge oder Fahrgäste. Sitzungslängen sind Einschätzungen.

| Spiel | Perspektive / 3D | Zonen vs. freie Platzierung | Netzwerkbau | Agenten-Simulation | Wirtschaft | Scheitern möglich | Typische Sitzung | Stil |
|---|---|---|---|---|---|---|---|---|
| Cities: Skylines | 3D, freie Kamera | Zonen + Einzelgebäude | Straßen, ÖPNV, Leitungen, Rohre | ja (Bürger, Fahrzeuge) | Steuern, Haushalt, Kredite | kaum | offen, viele Stunden | realistisch-modellhaft |
| Cities: Skylines II | 3D, freie Kamera | Zonen (mehr Typen) + Einzelgebäude | Straßen, ÖPNV, Hoch-/Niederspannung, Rohre | ja (kostenbasierte Wegwahl, Lebenswege) | Haushalt, Firmen, Ressourcenflüsse | kaum | offen, viele Stunden | realistisch |
| Mini Metro | 2D, schematisch | keine Platzierung von Stationen; nur Linien | Linien (Kern des Spiels) | einfach (Fahrgäste) | keine; Bauteil-Kontingent | ja (Überfüllung) | kurz | minimalistisch, Netzplan |
| Mini Motorways | 2D-Draufsicht | Straßenkacheln | Straßen (Kern des Spiels) | ja (Autos) | keine; Kachel-Kontingent | ja (Nachfrageüberlauf) | kurz | minimalistisch |
| SimCity 1989–4 | 2D / isometrisch | Zonen | Straßen, Schiene, Leitungen, ab 2000 U-Bahn | nein (aggregiert) | Steuern, Anleihen | Katastrophen, Szenarien, Bankrott | offen | klassisch |
| SimCity (2013) | 3D | Zonen entlang Straßen | Straßen, ÖPNV | ja (GlassBox) | Haushalt, Spezialisierung, Region | kaum | offen, kleine Karten | verspielt-modellhaft |
| Anno 1800 / 117 | 3D, isometrisch geprägt | freie Platzierung auf Raster | Straßen, Handelsrouten | eingeschränkt (Wimmelbild) | komplex: Waren, Geld, Arbeitskraft, Einfluss | Bilanz, Unruhen, Konflikte | lang | detailreich-historisch |
| Transport Tycoon / OpenTTD | 2D isometrisch | frei; Städte wachsen selbst | Schiene, Straße, Wasser, Luft | Fahrzeuge (Fracht aggregiert) | Geld, Kredit, Konkurrenz | Bankrott | lang | Pixel-Art |
| Frostpunk | 3D | frei, radial um Generator | Straßen, Wärmeradius | Bürger als Arbeitskräfte | Kohle, Holz, Stahl, Nahrung | ja (Verstoßung, Kältetod) | mittel (Szenario) | düsterer Steampunk |
| Banished | 3D | frei | Wege | ja (Lebenszyklus) | Güter, kein Geld | ja (Aussterben) | lang | zurückhaltend-realistisch |
| Islanders | 3D, Low-Poly | frei, Punkte nach Nachbarschaft | nein | nein | Punkte | ja (Vorrat erschöpft) | kurz bis mittel | minimalistisch |
| Townscaper | 3D | Zellen auf unregelmäßigem Gitter | nein | nein | keine | nein | beliebig | Spielzeug, Pastell |
| Dorfromantik | 3D, Hexfelder | Kachellegen | implizit (Flüsse, Schienen) | nein | Kachelstapel, Punkte | ja (Stapel leer) | mittel | malerisch, ruhig |
| Tropico | 3D | frei | Straßen | ja (Bedürfnisse, Meinungen) | Staatskasse, Export, Schweizer Konto | ja (Wahl, Putsch, Revolution) | mittel bis lang | satirisch, karibisch |
| Timberborn | 3D, kachelbasiert | frei, vertikal | Wege, Wasserbau, Energie | ja (Biber) | Güter, kein Geld | ja (Aussterben) | lang | Cartoon, „Lumberpunk“ |
| Against the Storm | 3D | frei auf Raster | Wege, Lagerreichweite | eingeschränkt | Waren, Ruf, Handel, Meta-Währung | ja (je Siedlung) | ca. eine bis zwei Stunden je Siedlung | Fantasy, düster |
| Workers & Resources | 3D | frei | Straße, Schiene, Leitungen, Förderanlagen | ja (sehr detailliert) | Planwirtschaft, Ressourcen | ja | sehr lang | realistisch |
| Factorio | 2D | frei | Bänder, Rohre, Schiene, Strom | eingeschränkt (Gegner) | Durchsatz, Ressourcen | ja (Angriffe, abschaltbar) | sehr lang | industriell |
| Manor Lords | 3D | organische Grundstücke | Wege | ja | Güter, Geld | ja | lang | realistisch-mittelalterlich |
| Pocket City | 2D bzw. 3D (Teil 2) | Zonen | Straßen, Leitungen | einfach | Geld | kaum | kurz bis mittel | farbenfroh, mobil |

**Muster, die die Tabelle zeigt:**

- Spiele mit **harter Ressourcenknappheit** (Mini Metro, Mini Motorways, Islanders, Dorfromantik, Against the Storm) haben fast immer ein **klar definiertes Ende** und kurze bis mittlere Sitzungen.
- Spiele mit **detaillierter Agentensimulation** (Cities: Skylines, Workers & Resources) kennen kaum Scheitern und setzen auf offene Sandkästen.
- **Netzwerkbau als Hauptspiel** findet sich entweder in sehr abstrakter (Mini Metro) oder sehr technischer (OpenTTD, Factorio) Form; die Mitte – ein systemisch tiefes, aber klar lesbares Verkehrsnetz in einer lebenden Stadt – ist dünn besetzt.

---

## 4. Kernsäulen des Genres

Aus der Zerlegung lassen sich zwölf Säulen ableiten. Nicht jedes Spiel bedient alle; die Kombination und Gewichtung bestimmt das Profil eines Titels.

### Säule 1: Räumliches Puzzle und Platzierung

**Definition.** Der Wert eines Bauteils hängt von seinem Ort ab: Nachbarschaft, Abdeckung, Erreichbarkeit, Belastung. Jede Platzierung ist eine Lösung für eine räumliche Gleichung mit mehreren Unbekannten.

**Beispiele.** Islanders (Punkte nach Nachbarschaft), Dorfromantik (Kantenpassung), Cities: Skylines (Lärm, Verschmutzung, Dienstradien), Anno (Einzugsbereiche von Marktplätzen), Frostpunk (Wärmeradius), Manor Lords (organische Grundstücke).

**Design-Fallen.** Ein optimales Raster, das man einmal findet und immer wiederholt; Platzierungsregeln, die man nicht vorab sehen kann; zu viele gleichzeitig wirksame Felder, sodass keine Platzierung mehr „gut“ oder „schlecht“ wirkt.

### Säule 2: Netzwerke und Flüsse

**Definition.** Etwas bewegt sich durch eine vom Spieler gebaute Struktur – Menschen, Fahrzeuge, Waren, Strom, Wasser, Wärme. Gespielt wird mit Kapazität, Verbindung und Engpass.

**Beispiele.** Mini Metro (Fahrgäste über Linien), OpenTTD (Fracht über Schienen und Signale), Cities: Skylines (Verkehr, Leitungen, ÖPNV), Timberborn (Wasser), Factorio (Förderbänder).

**Design-Fallen.** Engpässe, die man nicht lokalisieren kann; Fluss-Logik, die von der intuitiven Erwartung abweicht (Spurwahl in C:S I); Netze ohne Wahlmöglichkeit, in denen es nur eine richtige Verbindung gibt.

### Säule 3: Angebot-Nachfrage-Schleifen

**Definition.** Wachstum entsteht aus wechselseitigen Abhängigkeiten: Wohnen braucht Arbeit, Arbeit braucht Arbeitskräfte, Arbeitskräfte brauchen Wohnen. Der Spieler gleicht Ungleichgewichte aus und erzeugt dabei neue.

**Beispiele.** RCI-Balken in SimCity und Cities: Skylines, Bedürfnisstufen in Anno, Stationsformen in Mini Metro (Nachfrage nach Formen), Farben in Mini Motorways.

**Design-Fallen.** Nachfrage, die nur quantitativ wächst („mehr vom Gleichen“); Balken ohne erkennbare Ursache; Gleichgewichtszustände, in denen der Spieler nichts mehr tun muss.

### Säule 4: Wirtschaft, Haushalt und Ressourcenrahmen

**Definition.** Ein Rahmen, der Bauen begrenzt: Geld mit Einnahmen und laufenden Kosten, ein Bauteil-Kontingent oder physische Güter. Er macht aus Wünschen Entscheidungen.

**Beispiele.** Steuern und Budgetregler in Cities: Skylines; Bauteil-Kontingent in Mini Metro; Kachelstapel in Dorfromantik; Waren ohne Geld in Banished und Timberborn; Profit pro Route in OpenTTD.

**Design-Fallen.** Geldschwemme im mittleren Spiel (C:S I); undurchsichtige Bilanzen (CS2 zum Start); laufende Kosten, die nur bestrafen, aber keine Entscheidung erzeugen.

### Säule 5: Fortschritt und Freischaltungen

**Definition.** Neue Werkzeuge, Gebäude, Flächen oder Regeln werden schrittweise verfügbar. Fortschritt dosiert Komplexität und gibt Etappenziele.

**Beispiele.** Meilensteine in Cities: Skylines (Bevölkerung bzw. XP und Entwicklungsbäume), Bevölkerungsstufen in Anno, wöchentliche Upgrades in Mini Metro, Paketwahl in Islanders, Meta-Fortschritt in Against the Storm, Epochen in Tropico.

**Design-Fallen.** Freischaltungen, die nur „mehr“ und nicht „anders“ bringen; Grind bis zum nächsten Schritt; am Ende alles freigeschaltet und kein Grund mehr, weiterzuspielen.

### Säule 6: Informationsschichten und Feedback

**Definition.** Der Zustand der Simulation muss lesbar sein: Overlays, Warnsymbole, Vorschauen, Statistiken, Bürgerstimmen. Weil der Spieler indirekt handelt, ist Diagnose die halbe Spielzeit.

**Beispiele.** Infoansichten und Routenansicht in Cities: Skylines, Punktvorschau in Islanders, Überfüllungsring in Mini Metro, Bahnhofsbewertungen in OpenTTD, Wärmeansicht in Frostpunk, generative Musik als Zustandsanzeige in Mini Metro.

**Design-Fallen.** Zu viele gleichzeitige Warnungen; Overlays, die *was* zeigen, aber nicht *warum*; Feedback nur in Menüs statt in der Welt; Bürgerstimmen, die sich wiederholen oder widersprechen.

### Säule 7: Druck und Scheitern

**Definition.** Ein Faktor, der gegen den Spieler arbeitet und Fehler folgenreich macht: Zeit, Knappheit, Bedrohung, Erwartung. Scheitern kann hart (Spielende), weich (Verlust, Rückschlag) oder abwesend sein.

**Beispiele.** Überfüllung in Mini Metro, Hoffnung und Unzufriedenheit in Frostpunk, Ungeduld der Königin in Against the Storm, Dürren in Timberborn, Hungersnot in Banished, Wahlen in Tropico; in Cities: Skylines nahezu kein Druck.

**Design-Fallen.** Scheitern ohne Vorwarnung; Druck, der mit der Stadtgröße verschwindet; Abwärtsspiralen, aus denen es keinen Ausweg mehr gibt; Druck, der nur aus Zufall (Katastrophen) entsteht.

### Säule 8: Zeitsteuerung und Rhythmus

**Definition.** Der Spieler bestimmt das Tempo (Pause, Geschwindigkeiten), und das Spiel gibt einen eigenen Takt vor (Wochen, Jahreszeiten, Zyklen). Aus beidem entsteht der Rhythmus von Planung und Beobachtung.

**Beispiele.** Pausieren und Umbauen in Mini Metro, wöchentliche Wahl in Mini Metro und Mini Motorways, Jahreszeiten in Banished, Timberborn und CS2, Sturmzyklus in Against the Storm, Gesetzes-Wartezeit in Frostpunk.

**Design-Fallen.** Zu langsame Simulation, sodass man nur wartet; Echtzeitdruck, der Reaktionsgeschwindigkeit statt Einsicht belohnt; keine Taktgeber, sodass das Spiel ohne Höhepunkte dahinfließt.

### Säule 9: Emergente Agenten-Simulation

**Definition.** Individuelle Einheiten mit einfachen Regeln erzeugen in der Summe Muster wie Staus, Pendlerströme oder Arbeitskräftemangel. Der Spieler kann einer Einheit folgen und ihr Verhalten nachvollziehen.

**Beispiele.** Bürger und Fahrzeuge in Cities: Skylines (in CS2 mit Pfadkosten und Lebenswegen), GlassBox in SimCity 2013, Fahrgäste in Mini Metro, Autos in Mini Motorways, Arbeiter in Workers & Resources.

**Design-Fallen.** Implausibles Einzelverhalten, das beim Zuschauen auffällt (SimCity 2013, Spurwahl in C:S I); Rechenlast, die Kartengröße oder Bildrate begrenzt; Emergenz, die sich nicht beeinflussen lässt.

### Säule 10: „Spielzeug“-Gefühl und Ästhetik

**Definition.** Das Bauen selbst macht Freude, unabhängig von Zielen: Werkzeuge reagieren weich, Ergebnisse sehen gut aus, Klang belohnt Eingaben. Das Spiel bleibt auch dann angenehm, wenn die Systeme gerade nichts verlangen.

**Beispiele.** Townscaper (reines Spielzeug), Dorfromantik und Islanders (ruhige Ästhetik), Mini Metro (Klarheit und generative Musik), Cities: Skylines (Hineinzoomen in die eigene Stadt).

**Design-Fallen.** Schönheit auf Kosten der Lesbarkeit; Spielzeuggefühl ohne Systemtiefe (kein Grund, wiederzukommen); realistische Optik, die zu viel Detail ins Bild trägt.

### Säule 11: Erzählung durch Systeme

**Definition.** Geschichten entstehen aus Zuständen und Ereignissen der Simulation statt aus geschriebenen Handlungen: Bürgerstimmen, Forderungen, Gesetze, Biografien, Krisen.

**Beispiele.** Chirper und Lifepath Journal in Cities: Skylines, Gesetzbuch und Versprechen in Frostpunk, Fraktionen und Radio in Tropico, demografische Wellen in Banished, Lichtungsereignisse in Against the Storm.

**Design-Fallen.** Wiederholte Textbausteine; Erzählung, die nicht auf den tatsächlichen Zustand reagiert; Ereignisse, die Entscheidungen verlangen, ohne deren Folgen erkennbar zu machen.

### Säule 12: Umbau und Korrigierbarkeit

**Definition.** Wie leicht lassen sich Fehler rückgängig machen? Die Antwort bestimmt, ob ein Spiel Experimentieren oder Vorausplanen belohnt.

**Beispiele.** Mini Metro (Linien in der Pause beliebig umbauen) gegen Mini Metro Extrem (Linien endgültig); Frostpunk (Gesetze irreversibel, als Thema); Cities: Skylines (Abriss und Neubau kosten nur Geld, Zonen bleiben bei Straßen-Upgrades erhalten); Anno (Blaupausenmodus zum Vorplanen).

**Design-Fallen.** Umbau ohne jeden Preis (Entscheidungen werden beliebig); Umbau mit zu hohem Preis (Angst vor Experimenten); Werkzeuge, die bei Umbauten Nebenwirkungen verursachen, etwa gelöschte Zonen oder abgerissene Nachbargebäude.

---

## 5. Typische Designprobleme und wie Spiele sie lösen

### 5.1 Mid-Game-Leere und Spätspiel-Langeweile

**Problem.** Sobald die Grundsysteme stabil laufen, gibt es nichts mehr zu tun außer Wachsen. Der Druck sinkt, Entscheidungen werden Routine.

**Ursachen.** Einnahmen wachsen schneller als Kosten; Nachfrage verändert sich nur quantitativ; alle Werkzeuge sind freigeschaltet; es fehlt ein Ziel.

**Lösungen.**
- *Begrenzte Partie:* Mini Metro, Islanders und Dorfromantik enden zwangsläufig; Against the Storm schließt jede Siedlung nach Erfolg ab.
- *Dramaturgie mit Ende:* Frostpunk läuft auf einen Höhepunkt (den großen Sturm) zu.
- *Qualitativ neue Nachfrage:* Anno führt mit jeder Bevölkerungsstufe neue Waren und Ketten ein.
- *Zielstränge neben dem Wachstum:* einzigartige Gebäude und Monumente in Cities: Skylines.
- *Saisonale oder eskalierende Bedrohungen:* längere Dürren und Badtides in Timberborn.

### 5.2 Verkehrs-Frust

**Problem.** Verkehr ist das sichtbarste System und zugleich das schwerste. Staus entstehen an Stellen, deren Ursache der Spieler nicht versteht, oder durch Agentenverhalten, das unplausibel wirkt.

**Lösungen.**
- *Diagnose:* Routenansicht in Cities: Skylines (wer fährt hier woher und wohin?).
- *Bessere Agenten:* Pfadkosten aus Zeit, Komfort, Geld und Verhalten in CS2; Spurwechsel und Neuplanung bei Unfällen.
- *Werkzeuge für Eingriffe:* Spurpfeile, Spurverbindungen und Vorfahrtsregeln (in C:S I über den Mod TM:PE).
- *Klare, lernbare Regeln:* Signale und Blockabschnitte in OpenTTD.
- *Abstraktion:* Mini Metro ersetzt Autoverkehr durch Linien mit Kapazität und zeigt Überlast als einzelnen, lesbaren Ring.
- *Warnendes Gegenbeispiel:* SimCity 2013, dessen vereinfachte Agentenlogik zu Verhalten führte, das man nur noch „umbauen“, aber nicht verstehen konnte.

### 5.3 Informationsüberflutung

**Problem.** Je tiefer die Simulation, desto mehr Werte, Warnungen und Menüs. Der Spieler sieht alles und versteht nichts.

**Lösungen.**
- *Eine Frage pro Ansicht:* Infoansichten in Cities: Skylines färben die Stadt nach genau einem Merkmal.
- *Information in der Welt:* Warnsymbole über Gebäuden, Überfüllungsring in Mini Metro, Wärmeansicht in Frostpunk.
- *Vorschau statt Nachschau:* Punktvorschau in Islanders, gültige Positionen in Dorfromantik.
- *Gewichtung durch Masse:* Likes bei Chirper-Meldungen in CS2 zeigen, wie viele Menschen ein Problem betrifft.
- *Radikale Reduktion:* Mini Metro zeigt nur, was spielrelevant ist.
- *Kontrollierbarkeit:* Benachrichtigungen abschaltbar oder filterbar (in C:S I oft per Option oder Mod).

### 5.4 Snowballing und Geldüberfluss

**Problem.** Erfolg erzeugt mehr Erfolg. Große Städte sind reich, reiche Städte lösen jedes Problem mit Geld; Knappheit verschwindet.

**Lösungen.**
- *Kein Geld:* Mini Metro, Dorfromantik, Banished, Timberborn arbeiten mit Kontingenten oder physischen Gütern.
- *Wachsende Kosten und Ansprüche:* Anno koppelt höhere Stufen an teurere, komplexere Ketten.
- *Strengere Wirtschaft:* CS2 entfernte mit Economy 2.0 staatliche Subventionen.
- *Externe Gegenkraft:* Die Ungeduld der Königin in Against the Storm steigt unabhängig vom Erfolg.
- *Wachstum, das sich selbst überholt:* In Mini Metro wächst die Stadt schneller als jede Zahl an Zügen.

### 5.5 Performance bei großen Städten

**Problem.** Agentensimulation skaliert schlecht. Große Städte bedeuten mehr Agenten, längere Wege und mehr Pfadsuchen – Bildrate und Simulationsgeschwindigkeit brechen ein.

**Lösungen und Kompromisse.**
- *Obergrenzen:* C:S I begrenzt die Zahl gleichzeitig simulierter Einheiten.
- *Kleinere Karten:* SimCity 2013 beschränkte die Stadtgröße – mit großem Imageschaden.
- *Datenorientierte Technik:* CS2 setzt auf Unitys DOTS mit Mehrkernnutzung; zum Start blieben trotzdem erhebliche Leistungsprobleme.
- *Abstraktion:* Mini Metro und Mini Motorways simulieren wenige, einfache Agenten; SimCity bis Teil 4 arbeitete aggregiert.
- *Konsequenz:* Ein Spiel sollte früh festlegen, welche Ebene individuell simuliert werden muss (das, was der Spieler beobachtet und beeinflusst) und welche statistisch bleiben darf.

### 5.6 Undurchsichtige Ursachen

**Problem.** Der Spieler sieht ein Symptom (Unzufriedenheit, Leerstand, Abwanderung), aber nicht die Kette der Ursachen. Banished wurde zum Start genau dafür kritisiert, CS2 für seine Wirtschaft.

**Lösungen.** Begründete Stimmungswerte (Frostpunk zeigt, was Hoffnung und Unzufriedenheit verändert), Bedarfsanzeigen pro Haus (Anno), Biografien einzelner Bürger (Lifepath Journal in CS2), Profit pro Fahrzeug und Bahnhofsbewertungen (OpenTTD).

### 5.7 Dominante Strategien und Einheitslösungen

**Problem.** Hat man eine optimale Lösung gefunden (ein Raster, ein Kreuzungstyp, eine Gebäudeanordnung), wiederholt man sie für immer.

**Lösungen.** Zufällige Geografie und Stationsformen (Mini Metro), zufällige Gebäudepakete und Inseln (Islanders), zufällige Baupläne und Ecksteine (Against the Storm), Gelände mit Folgen (Timberborn, Inseln mit Fruchtbarkeiten in Anno), Modi mit veränderten Regeln (Mini Metro Extrem).

### 5.8 Einstiegshürde

**Problem.** Tiefe Simulationen (Workers & Resources, OpenTTD, Anno) überfordern zu Beginn; einfache Spiele bieten auf Dauer zu wenig.

**Lösungen.** Freischaltungen dosieren Werkzeuge (Meilensteine in Cities: Skylines), Bevölkerungsstufen führen Systeme nacheinander ein (Anno), ein einziges Kernsystem ist in Sekunden verständlich und trägt trotzdem (Mini Metro), kurze Partien senken die Kosten eines Fehlstarts (Islanders, Dorfromantik).

### 5.9 Bestrafung gegen Korrigierbarkeit

**Problem.** Sind Fehler zu teuer, wird nicht experimentiert; sind sie kostenlos, wird nicht nachgedacht.

**Lösungen.** Mini Metro macht Umbau billig, aber nicht folgenlos (während des Umbaus warten Fahrgäste weiter). Frostpunk macht Irreversibilität zum Thema. Mini Metro Extrem bietet die harte Variante als Wahlmodus an, statt sie allen aufzuzwingen.

### 5.10 Inhaltsfragmentierung

**Problem.** Langlebige Spiele wachsen über Erweiterungen; das Grundspiel und die „Vollausstattung“ unterscheiden sich stark, Balancing und Bedienung leiden.

**Lösungen.** Kostenlose Grundsystem-Updates parallel zu Erweiterungen (Tag-Nacht-Zyklus in C:S I für alle), Modding als zweiter Inhaltsstrom, Erweiterungen, die neue Regeln bringen statt nur mehr Gebäude.

### Übersicht

| Problem | Häufige Ursache | Bewährte Gegenmittel (Beispiele) |
|---|---|---|
| Mid-Game-Leere | Geldüberschuss, rein quantitatives Wachstum | Partieende (Mini Metro), Durchläufe (Against the Storm), neue Bedürfnisstufen (Anno) |
| Verkehrs-Frust | unplausibles Agentenverhalten, fehlende Diagnose | Routenansicht (C:S), Pfadkosten (CS2), klare Regeln (OpenTTD), Abstraktion (Mini Metro) |
| Informationsflut | zu viele Werte gleichzeitig | Ein-Frage-Overlays (C:S), Vorschau (Islanders), Reduktion (Mini Metro) |
| Snowballing | Einnahmen wachsen schneller als Kosten | kein Geld (Mini Metro), externe Gegenkraft (Against the Storm), strengere Wirtschaft (CS2) |
| Performance | zu viele individuell simulierte Agenten | Obergrenzen, Abstraktion, datenorientierte Technik |
| Undurchsichtige Ursachen | Symptome ohne Kausalkette | Begründungen (Frostpunk), Bedarfsanzeigen (Anno), Biografien (CS2) |
| Einheitslösungen | deterministische, wiederholbare Optima | Zufallsangebote, Geografie, Modi |
| Einstiegshürde | voller Werkzeugkasten ab Minute eins | Meilensteine, Stufen, ein klarer Kern |

---

## 6. Fazit

Das Genre bewegt sich zwischen zwei Polen, die selten zusammenkommen. Cities: Skylines bietet Systemtiefe: Agenten mit Wohnung und Arbeit, Versorgungsnetze, Dienste, die über dasselbe Straßennetz fahren wie die Pendler, Bodenwert, Bildung und Distrikte. Diese Tiefe erzeugt glaubwürdige Städte, aber kaum Druck. Geld wird im mittleren Spiel bedeutungslos, Scheitern ist selten, und die Diagnose von Problemen verlangt Erfahrung mit vielen Overlays. Mini Metro bietet das Gegenteil: ein einziges, vollständig lesbares System, abzählbare Ressourcen, eine wöchentliche Wahl als Taktgeber und ein Scheitern, das lokal, angekündigt und selbst verschuldet ist. Dafür fehlen die Stadt, die man besitzt, und die Geschichten ihrer Bewohner.

Die Lücke zwischen beiden ist in der Vergleichstabelle gut zu sehen: Es gibt kaum Spiele, in denen ein systemisch tiefes Verkehrsnetz in einer lebenden Stadt mit echter Knappheit und klarer Lesbarkeit zusammenkommt. Interessant wird eine Kombination, die von Cities: Skylines das *Wechselspiel der Systeme* übernimmt – Verkehr als Bühne, auf der sich Versorgung, Dienste und Wirtschaft begegnen –, von Mini Metro aber die *Disziplin der Darstellung und der Knappheit*: wenige, abzählbare Bauteile statt eines unbegrenzten Budgets, periodische Wahlentscheidungen statt stetigen Geldflusses, Überlastung als lokal sichtbares, vorhersehbares Versagen statt als abstrakter Zufriedenheitswert, Pausieren und Umplanen als Kern statt als Notbremse.

Aus den übrigen Spielen lassen sich ergänzende Bausteine ableiten: Bedürfnisstufen nach dem Vorbild von Anno, damit Wachstum die Nachfrage qualitativ verändert; eine Vorschau der Folgen wie in Islanders, damit räumliche Entscheidungen vorab lesbar sind; eine klare Dramaturgie oder Durchlaufstruktur wie in Frostpunk und Against the Storm gegen die Mid-Game-Leere; Bürgerstimmen, die wie die Likes bei Chirper in CS2 eine Größenordnung transportieren, statt sich zu wiederholen; und ein Klangsystem, das wie bei Mini Metro den Zustand des Netzes hörbar macht.

Die größte Designfrage bleibt der Maßstab der Simulation. Das Beispiel SimCity 2013 zeigt, dass sichtbare Agenten einen Anspruch an Plausibilität wecken, den eine Simulation auch einlösen muss. CS2 zeigt, dass Tiefe ohne Lesbarkeit und ohne stabile Leistung nicht trägt. Ein neues Spiel sollte deshalb früh entscheiden, welche Ebene individuell simuliert wird – vermutlich genau die, die der Spieler beobachtet und mit seinen knappen Ressourcen beeinflusst – und welche statistisch bleiben darf. Wie das konkret aussehen soll, ist Aufgabe des Spielkonzepts.

---

## 7. Quellen

Alle Quellen wurden im Oktober 2026 über die Websuche gesichtet; aufgeführt sind nur URLs, die in Suchergebnissen erschienen und für dieses Dokument herangezogen wurden.

**Cities: Skylines und Cities: Skylines II**
- https://en.wikipedia.org/wiki/Cities:_Skylines
- https://en.wikipedia.org/wiki/Cities:_Skylines_II
- https://www.pcgamesn.com/cities-skylines-2/tiles
- https://www.thesixthaxis.com/2025/11/17/paradox-and-colossal-order-split-cities-skylines-2-development-moves-to-iceflake-studios/
- https://www.shacknews.com/article/146853/cities-skylines-series-new-developer?amphtml=1
- https://heise.de/-11083454
- https://www.paradoxinteractive.com/games/cities-skylines-ii/features/electricity-water
- https://colossalorder.fi/news/development-diary-6-electricity-water/
- https://colossalorder.fi/news/development-diary-10-game-progression/
- https://paradoxinteractive.com/games/cities-skylines-ii/features/traffic-ai
- https://techraptor.net/gaming/news/cities-skylines-2-gets-new-video-all-about-advanced-traffic-ai
- https://colossalorder.fi/news/
- https://www.shacknews.com/article/140113/cities-skylines-2-economy-2-teaser
- https://www.windowscentral.com/gaming/cities-skylines-ii-runs-horribly-a-deep-dive-into-unity-explains-why
- https://www.gamespot.com/articles/first-cities-skylines-expansion-adds-daynight-cycl/1100-6429556/
- https://www.thesixthaxis.com/2016/02/03/snowfall-comes-to-cities-skylines-on-february-18th/
- https://primagames.com/featured/cities-skylines-snowfall-review
- https://forum.paradoxplaza.com/forum/developer-diary/cities-skylines-dev-diary-8-districts-and-policies.831059/
- https://github.com/CitiesSkylinesMods/TMPE/wiki/Home
- https://www.techradar.com/gaming/consoles-pc/cities-skylines-2-has-created-my-arch-nemesis-and-its-made-me-love-the-game-more
- https://www.simplegamer.co.uk/cities-skylines-2-allows-you-to-follow-citizens-lives

**Mini Metro und Mini Motorways**
- https://en.wikipedia.org/wiki/Mini_Metro_(video_game)
- https://dinopoloclub.com/press/index.php
- https://store.steampowered.com/app/287980/Mini_Metro/
- https://giantbomb.com/wiki/Games/Mini_Metro
- https://www.untappedcities.com/build-your-own-subway-system-with-mini-metro-game/
- https://boingboing.net/2015/11/18/mini-metro-city.html/amp
- https://designingsound.org/2016/02/18/the-programmed-music-of-mini-metro-interview-with-rich-vreeland-disasterpeace
- https://www.killscreen.com/music-urban-commute-designing-mini-metros-soundtrack/
- https://en.wikipedia.org/wiki/Mini_Motorways
- https://dinopoloclub.com/press/mini-motorways/
- https://gamasutra.com/design/turning-road-noise-into-music-mini-motorways

**SimCity**
- https://en.wikipedia.org/wiki/SimCity
- https://en.wikipedia.org/wiki/SimCity_(2013_video_game)
- https://www.bgr.com/general/simcity-pr-nightmare-analysis-372284/
- https://www.techspot.com/news/59956-ea-closes-doors-imcity-developer-maxis.html

**Anno**
- https://insider-gaming.com/anno-117-pax-romana-release-date-start-time/
- https://anno1800.fandom.com/wiki/Population?oldid=3313

**Transport Tycoon und OpenTTD**
- https://en.wikipedia.org/wiki/OpenTTD
- https://wiki.openttd.org/en/Archive/OpenTTD/OpenTTD%20History
- https://wiki.openttd.org/en/Manual/Tips

**Frostpunk**
- https://www.pcgamesn.com/frostpunk-2/guide
- https://www.gamespot.com/articles/frostpunk-2-release-date-set-for-july-2024/1100-6521627/
- https://amostagreeablepastime.com/2018/05/08/review-frostpunk-pc/
- https://www.dreadcentral.com/reviews/280943/frostpunk-review-apocalypse-done-depressing

**Banished, Islanders, Townscaper, Dorfromantik**
- https://en.wikipedia.org/wiki/Banished_(video_game)
- https://en.wikipedia.org/wiki/Islanders_(video_game)
- https://islandersconsole.com/
- https://en.wikipedia.org/wiki/Islanders:_New_Shores
- https://www.gematsu.com/2025/06/islanders-new-shores-launches-july-10
- https://www.gog.com/en/game/townscaper
- https://www.nintendolife.com/news/2021/03/townscaper_is_an_idyllic_toy-like_game_thatll_melt_all_your_worries_away
- https://en.wikipedia.org/wiki/Dorfromantik
- https://gamepilgrim.com/2021/02/03/dorfromantik-draws-early-access-tile-for-march-25/
- https://www.gamepro.de/artikel/dorfromantik-brettspiel-ist-spiel-des-jahres-2023,3397614.html

**Tropico, Timberborn, Against the Storm**
- https://en.wikipedia.org/wiki/Tropico_(series)
- https://tropico.fandom.com/wiki/Constitution_(Tropico_6)
- https://en.wikipedia.org/wiki/Timberborn
- https://mechanistry.com/press/acclaimed-lumberpunk-city-builder-timberborn-shares-long-awaited-1-0-release-date-new-trailer
- https://www.galaxus.de/en/page/thank-goodness-for-beavers-even-deadly-droughts-are-fun-in-timberborn-41943
- https://gamespress.com/Against-the-Storm-1-0-out-now
- https://www.gamedeveloper.com/press-release/city-building-sensation-against-the-storm-hits-1-0-and-pc-game-pass-this-december
- https://wiki.hoodedhorse.com/Against_the_Storm/Season

**Kurzporträts**
- https://www.sovietrepublic.net/post/release-of-1-0
- https://gamespress.com/Workers-Resources-Soviet-Republic-1-0-release-date
- https://en.wikipedia.org/wiki/Factorio
- https://gamespress.com/Manor-Lords-out-now
- https://toucharcade.com/games/pocket-city-2
- https://www.androidpolice.com/pocket-city-2-release/
