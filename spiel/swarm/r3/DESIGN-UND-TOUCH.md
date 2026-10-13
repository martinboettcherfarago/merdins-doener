# Runde 3b: Neues Design nach Vorlage und sicheres Bauen per Touch

**Wünsche des Spielers (sinngemäß):**
1. „Auf dem Handy und iPad ist das Platzieren blöd: Man verrutscht schnell, und dann wird direkt gebaut. Ich möchte einen
   Mechanismus, z. B. doppelt tippen zum Platzieren oder anders, damit man nicht falsch baut und sich während des Platzierens
   auch bewegen (die Karte verschieben) kann."
2. „Die Oberfläche sieht schon gut aus, aber das ganze Design soll nochmal geändert werden – nach dieser Vorlage."
   → Vorlage: `spiel/swarm/r3/vorlage-design.png` (bitte mit dem Read-Werkzeug ansehen).

Basis: `spiel/swarm/U-BAHN-UND-UI.md` (Runde 3, Verträge V1–V3) und `spiel/swarm/QA.md` (Werkzeuge, Qualitätsmaßstab).
Die neue, aufgeräumte Struktur von OBERFLAECHE (Kopfzeile, 6 Hauptgruppen + Abriss, „Ansichten", „Stadt", „Stadt-Check",
Hilfe, Menü, Baukatalog mit Reitern) ist bereits im Branch und bleibt **funktional erhalten** – sie bekommt das neue Gewand.

## Start (Pflicht)
1. `git reset --hard claude/custom-3d-strategy-game-rl03fz`, solange du keine eigenen Commits hast (dein Worktree kann alt sein).
2. `ln -s /home/user/merdins-doener/spiel/node_modules spiel/node_modules`
3. `cd spiel && node build.mjs && node test/sim-test.mjs 20`

## Rollen und Datei-Besitz
| Rolle | Besitz |
|---|---|
| **DESIGN** – Gestaltung nach Vorlage | `style.css`, `index.html`, `src/ui/**` **außer** `onboarding.js`, `help.js`, `advisor.js`, `tips.js`, `placebar.js` |
| **TOUCH** – sicheres Bauen | `src/input.js`, `src/input/**`, neu `src/ui/placebar.js`, Vorschau-Darstellung beim Bauen (z. B. Geister-Modell, Griffe) in `src/render/overlay.js` bzw. dort, wo die Bauvorschau heute gezeichnet wird |

Parallel laufen noch **UBAHN** (U-Bahn unter der Erde, `render/**`, `sim/transit.js`) und **EINSTIEG** (`onboarding.js`, `help.js`,
`advisor.js`, `tips.js`, Texte in `config.js`/`content/**`). Fremde Dateien nicht ändern; Wünsche nach `spiel/swarm/r3/<ROLLE>-bitten.md`.

## Vorlage – was sie ausmacht (DESIGN)
- **Farben:** kräftiges Violett als Hauptfarbe (Symbole, aktive Reiter, Schließen-Knopf, Tempo-Knöpfe), helles Lavendel als
  Fläche hinter Listen und inaktiven Reitern, reines Weiß für Karten und Zeilen, **orange Verlaufs-Knöpfe** für Kauf- und
  Hauptaktionen (Preis in Weiß, fett), Goldmünze für Geld, Grün für „steigt", Rot für Warnungen und Zähler.
- **Formen:** große Rundungen (Karten ~16–20 px, Chips als Pillen), weiche, leicht violett getönte Schatten, „griffige" Knöpfe
  mit sichtbarer Unterkante (Spiel-Look, nicht Büro-Look).
- **Schrift:** runde, fette Spielschrift (z. B. *Nunito* 700–900 oder *Fredoka*/*Baloo 2* über Google Fonts; Fallback system-ui).
  Zahlen fett und groß.
- **Anordnung wie in der Vorlage:**
  - oben links ein Pillen-Chip für Rang bzw. Stufe (Stern mit Wert),
  - oben rechts Pillen-Chips für Geld (Münze, Betrag, Trendpfeil) und Einwohner (Figur, Zahl),
  - unten links eine Reihe weißer, abgerundeter Quadrat-Knöpfe mit violetten Symbolen (Menü und Bauwerkzeuge),
  - unten rechts eine Zeit-Karte („Montag · Tag 37") mit violetten Knöpfen für Pause/×1/×2/×3 und Wetter-Sonne an der Ecke,
  - Fenster und Panels als weiße Karte mit violetter Reiterleiste oben (aktiver Reiter weiß, inaktiv lavendel) und violettem
    quadratischem „X". Listen als weiße Zeilen auf Lavendel: Symbol links, Name fett, „Mehr Infos" klein in Violett,
    orangener Preis-Knopf rechts – so soll auch der **Baukatalog** aussehen.
- Das gilt **überall**: Kopfzeile, Werkzeugleiste, Katalog, alle Panels der Systeme, Menüs, Stadt-Check, Meldungen, Tooltips,
  Inspektor, Einstellungen, Dialoge, Hauptmenü, Ladebildschirm, Handy- und Tablet-Ansicht.
- Funktionen, `data-tour`-Ziele und `ui.tourTarget()` müssen erhalten bleiben (EINSTIEG baut darauf).
- **CSS-Variablen:** Die vorhandenen Namen (`--paper`, `--ink`, `--l-*`, `--good`, `--bad`, `--shadow`, `--radius`, `--f-ui` …)
  bleiben bestehen (andere Module nutzen sie), bekommen aber neue Werte. Neu bitte zusätzlich:
  `--accent` (Violett), `--accent-ink` (dunkles Violett für Text), `--accent-soft` (Lavendel), `--cta` und `--cta-2`
  (Orange-Verlauf), `--cta-edge` (dunkle Unterkante), `--coin` (Gold), `--card` (Weiß), `--r-pill`. TOUCH und EINSTIEG
  nutzen genau diese Namen.

## Sicheres Bauen per Touch (TOUCH)
- **Nur bei Touch/Stift** (`pointerType` `touch`/`pen`). Mit der Maus bleibt Klicken = Bauen. Eine Einstellung
  `app.settings.confirmPlace` (`'auto'` = Standard: Touch bestätigt, Maus nicht; `'always'`; `'never'`) bitte respektieren –
  den Schalter in den Einstellungen baut DESIGN ein (Wunsch über `DESIGN-bitten.md` bzw. diese Datei).
- **Ablauf beim Platzieren eines Gebäudes:**
  - Antippen setzt eine **Vorschau** (Geister-Modell mit Bauradius/Wirkung). Es wird noch nichts gebaut.
  - Die Vorschau lässt sich mit dem Finger **verschieben** (auf ihr ziehen) oder durch erneutes Antippen an anderer Stelle umsetzen.
  - Ziehen auf freier Karte **verschiebt die Kamera** – auch während eine Vorschau steht. Zwei Finger zoomen und drehen wie bisher.
  - Eine schwebende **Bestätigungsleiste** nahe der Vorschau (bzw. unten mittig, nie unter dem Finger) hat
    ✓ „Bauen" mit Preis (orange Knopf), ↻ „Drehen" und ✕ „Abbrechen".
  - Ist der Platz ungültig, ist ✓ gesperrt und zeigt den Grund.
- **Straßen, Zonen, Abriss, Bezirke:**
  - Antippen setzt den Startpunkt, Ziehen bzw. ein Ziehpunkt am Ende legt die Strecke oder Fläche fest. Beide Enden haben Griffe zum Nachjustieren.
  - Ziehen außerhalb der Griffe verschiebt die Kamera.
  - Gebaut wird erst mit ✓. Nach dem Bauen bleibt das Werkzeug aktiv.
- **U-Bahn-Linien:** Stationen per Antippen hinzufügen. Leichte Fingerbewegungen zählen als Tippen, echtes Ziehen verschiebt
  die Kamera. Der Abschluss geht über einen „Fertig"-Knopf in derselben Leiste.
- Versehentliches Bauen muss ausgeschlossen sein: Toleranz gegen Verrutschen, keine Aktion beim Loslassen nach einer Kamerabewegung.
- Die Leiste stylst du in `placebar.js` per injiziertem `<style>` mit den neuen CSS-Variablen (siehe oben, mit Rückfallwerten).

## Prüfung und Abschluss
- **DESIGN:** Vorher/Nachher-Screenshots der Szenarien `menu`, `city`, `closeup` und `mobile`, dazu Katalog, ein Panel, Menüs und Einstellungen.
- **TOUCH:** Prüfskripte mit Touch-Ereignissen (Playwright `hasTouch: true`, `page.touchscreen` bzw. Pointer-Events mit
  `pointerType: 'touch'`). Darin müssen gelingen: Bauen, Verrutschen ohne Bauen, Kamera verschieben mit Vorschau, Straße und Zone mit Griffen, Linie.
- `tools/shot.mjs --strict` ohne Fehler, `sh test/run-all.sh` grün.
- Mindestens drei Runden prüfen → verbessern → prüfen. Häufig committen, nur eigene Dateien, nie `dist/`.
- Sparsam mit Tokens: Das Nutzungslimit teilen sich alle Agenten.
- Abschlussbericht: Worktree, Branch, Änderungen (Ursache → Lösung), Dateien, beste Screenshots, offene Punkte, Bitten.
