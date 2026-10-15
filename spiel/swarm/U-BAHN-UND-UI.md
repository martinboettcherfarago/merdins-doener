# Stadtpuls – Runde 3: U-Bahn, klare Oberfläche, leichter Einstieg

**Wunsch des Spielers (wörtlich):** „Das Spiel ist an sich gut. Du sollst nur ändern, dass das User-Interface viel cleaner
und schöner ist und das Spiel insgesamt viel einfacher verständlich ist und die U-Bahn soll wirklich unter der Erde fahren."

Das heißt: **keine neuen Systeme**. Was da ist, wird klarer, ruhiger und verständlicher. Die Pulsbahn (bisher Hochbahn auf
Stelzen) wird zur **echten U-Bahn**. Der Name „Pulsbahn" bleibt als Markenname der U-Bahn („Pulsbahn – die U-Bahn der Stadt"),
überall wo bisher Hochbahn/Trasse/Pfeiler/Stelzen steht, heißt es jetzt U-Bahn/Tunnel/Bahnhof/Eingang.

Lies zuerst `spiel/SWARM.md` (Architektur, Maßstab, Register) und `spiel/swarm/QA.md` (Werkzeuge, Qualitätsmaßstab).

## Start (Pflicht)
1. Dein Worktree kann auf einem alten Stand liegen. Prüfe `git log --oneline -1`. Solange du keine eigenen Commits hast:
   `git reset --hard claude/custom-3d-strategy-game-rl03fz` (der Stand mit diesem Briefing).
2. `ln -s /home/user/merdins-doener/spiel/node_modules spiel/node_modules`
3. `cd spiel && node build.mjs && node test/sim-test.mjs 20` muss laufen.

## Rollen und Datei-Besitz (streng)
| Rolle | Besitz |
|---|---|
| **UBAHN** – U-Bahn unter der Erde | `src/sim/transit.js`, in `src/sim/city.js` nur die Höhenbegrenzung unter der Trasse (`maxLevelUnderTrack`), in `src/config.js` **nur** der Block `TRANSIT` und die Gebäudeeinträge `station`/`metro_hub` (falls dort), `src/render/agents.js`, `src/render/vehicles_rail.js`, `src/render/arch/lm_transit.js`, neu `src/render/underground.js`, in `src/render/buildings.js`, `overlay.js`, `roads.js`, `scene.js`, `post.js` nur das, was die U-Bahn braucht, `src/audio/**` (nur U-Bahn-Klänge) |
| **OBERFLAECHE** – klare, schöne Oberfläche | `src/ui/**` **außer** `onboarding.js`, `help.js`, `advisor.js`, `tips.js`; `style.css`; `index.html`; `src/input.js`; `src/input/**` |
| **EINSTIEG** – leicht verständlich | `src/ui/onboarding.js`, `src/ui/help.js`, `src/ui/advisor.js`, `src/ui/tips.js`; `src/config.js` außer `TRANSIT`; `src/content/**`; Texte (nur Texte!) in `src/sim/**`; `test/**`, falls Freischaltungen Tests verschieben |

Änderungswünsche an fremde Dateien: nach `spiel/swarm/r3/<ROLLE>-bitten.md` (mit Code-Vorschlag). Die Leitung führt zusammen.

## Verträge
### V1 – Untergrund-Ansicht (UBAHN liefert, OBERFLAECHE nutzt)
- `engine.setUnderground(on: boolean)` und `engine.undergroundActive` (lesen).
- Aktiv: Die Oberwelt tritt zurück (entsättigt, abgedunkelt bzw. durchscheinend), Tunnel, Bahnsteige und fahrende Züge
  werden sichtbar, in Linienfarben, gut lesbar wie ein Netzplan. Weich ein- und ausblenden.
- OBERFLAECHE schaltet sie ein, solange das Linien-Werkzeug (`tool.kind === 'line'`) oder das Pulsbahn-Panel offen ist,
  und bietet zusätzlich einen Schalter „Untergrund" in den Ansichten.
- Normale Ansicht: Oberirdisch sieht man nur die U-Bahn-Eingänge (blaues „U", Treppe mit Glasdach) und – dezent – den
  Linienverlauf (z. B. feine farbige Linie oder leichte Spur), damit das Netz nicht unsichtbar wird. Wartende Fahrgäste
  erscheinen weiter als Symbole über dem Eingang.

### V2 – Einführung und Hilfe (EINSTIEG liefert, OBERFLAECHE bindet ein)
- `src/ui/onboarding.js`: `class Onboarding { constructor(ui); update(dt); onEvent(name, data); active(); dispose() }`
  ist bereits eingebunden (Konstruktor, `update`, `dispose` in `ui.js`).
  OBERFLAECHE ruft zusätzlich `ui.onboarding.onEvent('cat', id)`, `('tool', tool)`, `('panel', id)`, `('view', id)` auf,
  wenn der Spieler eine Kategorie, ein Werkzeug, ein Panel oder eine Ansicht öffnet.
- Setzt EINSTIEG `ui.onboarding.replacesTutorial = true`, blendet OBERFLAECHE die alte Karte „Erste Schritte" aus.
- `src/ui/help.js`: `openHelp(ui, topicId?)`, `helpTopics()`. In `ui.js` verfügbar als `ui.openHelp(topic)`.
  OBERFLAECHE gibt der Hilfe einen gut sichtbaren Knopf (z. B. „?" oben rechts) und Einstiegspunkte („Was ist das?" in Inspektor/Katalog).
- Spotlight-Ziele: OBERFLAECHE versieht diese Elemente mit `data-tour="…"`:
  `toolbar`, `cat-<id>` für jede Kategorie der Werkzeugleiste (z. B. `cat-roads`, `cat-zones`, `cat-power`, `cat-water`,
  `cat-garbage`, `cat-transit`, `cat-bulldoze`), `tray` (Baukatalog), `item-<key>` (Eintrag im Katalog, z. B. `item-coal`,
  `item-street`, `item-res`). Fasst OBERFLAECHE Kategorien zu Hauptgruppen zusammen, bekommt jede Gruppe
  `data-tour="group-<id>"`, und `ui.tourTarget('cat-power')` öffnet bei Bedarf die passende Gruppe und liefert das Element
  (OBERFLAECHE stellt diese Hilfsfunktion bereit; Rückgabe `null`, wenn nicht sichtbar). Weitere Ziele: `stat-pop`, `stat-money`, `stat-happy`, `demand`, `time`, `speed`, `views`, `city`
  (Zugang zu den Stadt-Panels), `notes`, `help`, `settings`.
- Styles von EINSTIEG werden per JS-injiziertem `<style>` aus den eigenen Dateien gesetzt und nutzen die CSS-Variablen aus `style.css`.

### V3 – Texte
Jede Rolle passt in ihren Dateien alle Texte an: Hochbahn → U-Bahn, Trasse → Tunnel/Strecke, Pfeiler/Stelzen entfallen.
Der Untertitel im Hauptmenü („Städtebau im Takt der Hochbahn") wird z. B. „Städtebau im Takt der U-Bahn" (OBERFLAECHE).

## Leitlinien
**UBAHN**
- Simulation: Strecken liegen im Tunnel. Die Höhenbegrenzung für Gebäude unter der Strecke entfällt. Stationen belegen
  oberirdisch nur ein Eingangsfeld. Kosten dürfen etwas steigen (Tunnelbau), das Spiel muss aber gleich gut spielbar bleiben.
  Alte Spielstände (mit Hochbahn) laden weiter und werden einfach unterirdisch.
- Darstellung: Keine Viadukte, Pfeiler oder Hochbahnsteige mehr. U-Bahn-Eingänge als Modelle (Detailstufen 0–2),
  `metro_hub` als großer Umsteigebahnhof mit Eingangshalle. Tunnel mit Röhre/Gleisbett, Bahnsteighallen unter den Stationen,
  Züge mit Licht. Die Untergrund-Ansicht muss in Übersicht, Stadt und Nahsicht gut aussehen und darf das Budget nicht sprengen.
- Fahrgast-Symbole, Linienfarben und die Töne bei Zugankunft bleiben (der Takt ist das Markenzeichen).

**OBERFLAECHE** (lade vorher die Skills `anthropic-skills:frontend-design` und `anthropic-skills:emil-design-eng`)
- Weniger ist mehr: Heute stehen gleichzeitig eine Kopfzeile aus 5 Karten, eine linke Leiste mit ~14 Symbolen ohne Text,
  eine rechte Leiste mit ~11 Symbolen ohne Text, eine Minikarte, eine Werkzeugleiste mit 16 Stationen, ein Laufband,
  eine Tutorial-Karte und Problem-Chips auf dem Bildschirm. Ziel: **ruhiger Bildschirm, die Stadt steht im Mittelpunkt.**
- Vorschlag (du entscheidest das Detail):
  - eine schlanke Kopfzeile (Stadt, Einwohner, Geld, Glück, Zeit und Tempo, Menü),
  - eine Werkzeugleiste mit wenigen beschrifteten Hauptgruppen (z. B. Straßen, Zonen, Versorgung, Dienste, Freizeit,
    U-Bahn & Verkehr, Abriss), die Unterpunkte im Katalog darüber,
  - Ansichten und Stadt-Panels hinter je einem beschrifteten Knopf (Menü/Popover mit Text statt Symbol-Wand),
  - Minikarte standardmäßig klein bzw. eingeklappt, Meldungen gebündelt (eine Glocke, höchstens 1–2 Toasts),
  - Probleme als ein „Stadt-Check"-Knopf mit Zähler statt vieler Chips.
- Fortschreitende Enthüllung: Was noch nicht freigeschaltet oder noch nicht relevant ist, nimmt keinen Platz weg
  (Panels für Wirtschaft, Bezirke, Verkehr, Wetter erscheinen erst, wenn sie gebraucht werden).
- Einheitliche Sprache: gleiche Abstände, Radien, Schriftgrößen, Schatten, Farben und Symbole überall, auch in den Panels
  der anderen Systeme. Lesbar, ruhige Flächen, klare Hierarchie, gute Kontraste, keine abgeschnittenen Texte.
- Jeder Knopf hat einen Tooltip mit Namen und einem kurzen Satz, wofür er da ist.
- Muss auf Desktop (1280–1920 px) und Handy (400×820) gut funktionieren.

**EINSTIEG**
- Geführte Einführung für neue Spieler (nicht im Sandkasten, abschaltbar, später wieder aufrufbar): kurze Schritte mit
  Spotlight auf das richtige Bedienelement („Klicke hier auf Straßen"), der Schritt erkennt selbst, wann er erledigt ist.
  Inhalt etwa: Straße ziehen → Wohnzone → Strom → Wasser → Zeit laufen lassen → Gewerbe/Industrie → Müll → Glück verstehen.
- Danach ein ruhiger Begleiter: immer genau **ein** nächstes Ziel bzw. der wichtigste Tipp („Deine Stadt braucht Wasser: Baue einen
  Wasserturm."), mit Knopf, der direkt das richtige Werkzeug öffnet.
- „So funktioniert's" (Hilfe): kurze Themen mit einfachen Sätzen und kleinen Skizzen (SVG), z. B. Straßen, Zonen, Nachfrage,
  Strom/Wasser/Abwasser, Müll, Dienste, Glück, Geld/Steuern, U-Bahn, Wochenkarten, Katastrophen.
- Klare Sprache in allen Gebäude- und Zonentexten: ein Satz „Wozu?" und, falls nötig, „Braucht: …". Keine Fachwörter ohne Erklärung.
- Fortschreitende Freischaltung: Am Anfang wenige Möglichkeiten, Fortgeschrittenes (Bezirke, Wirtschaft im Detail, Katastrophenschutz …)
  kommt mit den Meilensteinen. Achtung: Freischaltungen wirken auf den Spiel-Bot und die Szenarien – `sh test/run-all.sh` muss grün bleiben.

## Qualität und Abschluss
- Keine Konsolenfehler: `tools/shot.mjs --scenario menu|city|closeup|night|mobile --strict` mit Exit 0.
- `sh test/run-all.sh` grün.
- Mindestens drei Runden prüfen → verbessern → prüfen, mit Vorher/Nachher-Screenshots in einem eigenen Unterordner des Scratchpads.
- Häufig committen, nur eigene Dateien, nie `dist/` oder `node_modules`.
- Sparsam mit Tokens: Das Nutzungslimit teilen sich alle Agenten.
- Abschlussbericht: Worktree, Branch, was geändert wurde (Ursache → Lösung), Dateien, beste Screenshots, offene Punkte, Bitten.
