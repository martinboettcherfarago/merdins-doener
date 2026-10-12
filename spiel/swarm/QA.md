# Stadtpuls 2.0 – QA-Schwarm (Phase 2)

Alle 17 Bau-Agenten sind fertig und im Branch `claude/custom-3d-strategy-game-rl03fz` zusammengeführt.
Jetzt prüft ein kleiner QA-Schwarm das **Gesamtspiel** und behebt Fehler. Ziel: ein Spiel, das sich
rund, hochwertig und fehlerfrei anfühlt – vom Hauptmenü bis zur Großstadt.

Lies zuerst `spiel/SWARM.md` (Architektur, Maßstab, Verträge 6.1–6.7, Budgets) und dann die
Bitten-Dateien `spiel/swarm/requests/*.md`. Viele offene Bitten betreffen jetzt deinen Bereich.

## Start (Pflicht)
1. Dein Worktree kann auf einem alten Stand liegen. Prüfe `git log --oneline -1`. Wenn `spiel/src/registry.js`
   fehlt oder der Stand älter ist als `claude/custom-3d-strategy-game-rl03fz`:
   `git merge --ff-only claude/custom-3d-strategy-game-rl03fz` (oder `git reset --hard claude/custom-3d-strategy-game-rl03fz`,
   solange du noch keine eigenen Commits hast).
2. `ln -s /home/user/merdins-doener/spiel/node_modules spiel/node_modules`
3. `cd spiel && node build.mjs && node test/sim-test.mjs 30` muss laufen.

## Werkzeuge
- Build: `node build.mjs` (schreibt `dist/stadtpuls.js`, nie committen).
- Screenshots: `node tools/shot.mjs --scenario city|closeup|street|night|overview|mobile|menu|gallery --out <png>`
  (höchstens 2 Browser gleichzeitig, die Sperre regelt das; eigene Prüfskripte über `--eval datei.mjs`,
  Signatur `export default async (page, h) => {...}`). Bilder im Scratchpad unter einem eigenen Unterordner ablegen.
- Prüfstände: `test/sim-test.mjs`, `industry-test.mjs`, `citizens-test.mjs`, `transport-test.mjs`,
  `weather-test.mjs`, `progression-test.mjs`, `src/audio/logiktest.js`.
- Debug im Browser: `window.__stadtpuls` (app), `app.game`, `app.engine`, `app.debug.buildDemoCity(g)`.

## Rollen und Datei-Besitz (streng – nur eigene Dateien ändern)
| Rolle | Besitz |
|---|---|
| **Q1 Grafik & Leistung** | `src/render/**` außer `src/render/views/*.js` (inklusive `render/arch/**`, `gallery.js`, `scene.js`, `effects.js`, `post.js`, `sky.js`) |
| **Q2 Spielbalance & Simulation** | `src/sim/systems/**`, `src/content/**`, `test/**` |
| **Q3 Bedienung, Oberfläche & Klang** | `src/ui/**`, `style.css`, `index.html`, `src/input.js`, `src/input/**`, `src/audio.js`, `src/audio/**`, `src/render/views/*.js` (nur Darstellung von Infoansichten/Effekten der Systeme) |
| **Q4 Kern, Robustheit & Spielstände** | `src/sim/*.js` (game, city, services, economy, network, world, traffic, demo), `src/main.js`, `src/registry.js`, `src/config.js`, `tools/**`, `build.mjs` |

Brauchst du eine Änderung in fremden Dateien, schreibe sie nach `spiel/swarm/qa/<ROLLE>-bitten.md`
(mit Code-Vorschlag) und arbeite weiter. Die Leitung führt am Ende zusammen.

## Qualitätsmaßstab
- **Keine** `PAGEERROR`, keine Konsolen-Fehler, keine Fehlerdialoge – in allen Szenarien und im Hauptmenü.
- Draw Calls Gesamtszene ≤ 700 (aktuell ~150–220), Dreiecke ≤ 3 Mio., Spieltag-Simulation auf 128er-Karte flüssig.
- Ein neues Spiel (nicht Sandkasten, Schwierigkeit normal) muss für einen Menschen gut spielbar und gewinnbar sein:
  erste 30 Spielminuten ohne Frust, klare Ziele, keine Todesspirale ohne Warnung.
- Alles auf Deutsch, Texte ohne Tippfehler, Zahlen mit deutschem Format.

## Arbeitsweise
- Mindestens drei Runden: prüfen → beheben → erneut prüfen. Belege mit Screenshots oder Testausgaben.
- Klein und sicher ändern; nichts umbauen, was funktioniert. Kein Feature ohne Prüfung.
- Häufig committen (nur eigene Dateien, nie `dist/`, nie `node_modules`).
- Sparsam mit Tokens: Screenshots gezielt, Ausgaben mit `tail`/`grep` kürzen. Das Nutzungslimit ist gemeinsam.

## Abschlussbericht
Worktree-Pfad, Branch, Liste der behobenen Fehler (je eine Zeile mit Ursache), geänderte Dateien,
Vorher/Nachher-Zahlen, beste Screenshots, offene Punkte und Bitten an andere Rollen.

## Bekannte Punkte zum Start (von der Leitung gesammelt)
**Q1 Grafik & Leistung**
- Stadtansicht: großes schraffiertes Gebilde oben links am Autobahn-Viadukt (vermutlich Pfeiler/Schilderbrücke bis y = −16) – prüfen, ob es gut aussieht.
- `gallery.js`: `res.anim` zeigen und eine Umgebungskarte setzen (Vorschläge in G4/G5/G6/G9-Bitten).
- G6: Dom-Bauzeit bis 800 ms, Freizeitpark 250 ms → Ruckler beim Heranzoomen; Bauzeit senken oder vorab im Leerlauf bauen.
- G2-Wünsche: `glass_railing`, `ivy`; Glas ohne Umgebungskarte zu dunkel (G1 setzt `scene.environment`?).
- Bildzeit auf dem Software-Renderer messen (Szenarien city/closeup/overview/night), Engpässe finden.

**Q2 Spielbalance & Simulation**
- Teststadt: Glücksfaktor „Müllabfuhr" bleibt bei −8 trotz zwei Deponien – Ursache finden (Reichweite, Lkw, Kapazität?).
- Pulsbahn-Fahrgäste in der Teststadt nur ~20/Tag (früher deutlich mehr) – prüfen, ob Busse/Zubringer oder Stationsmodell das drücken.
- Kläranlage findet in der Teststadt keinen Platz am Wasser (2×2) – nur Hinweis, ggf. Test anpassen.
- S5: Szenarien „Erzrausch" (Bot bleibt bei 1.042 von 1.500), „Boomtown" (8.500 von 10.000) und „Schuldenberg" auf Gewinnbarkeit prüfen; Startstädte in „Schuldenberg"/„Verkehrsinfarkt" sind größer als geplant.
- Ein normales neues Spiel (Flusstal, normal) 60 Tage mit einem vernünftigen Bot durchspielen: Geldkurve, Freischaltungen, Glück, Abwanderung.

**Q3 Bedienung, Oberfläche & Klang**
- Ganzer Ablauf mit Maus und auf dem Handy (400×820): Menü → neues Spiel → Straße → Zonen → Strom/Wasser → Panels → Speichern/Laden.
- U1-Restpunkte: Kopfzeile bei 1280 px einzeilig? Meilenstein-Knopf-Schrift? Katalog-Vorschau ruckelt beim ersten Öffnen?
- Verschiedene Systeme hängen sich direkt an `ui.el.insp` – auf das neue Register `INSPECTOR_ACTIONS` umstellen, wo sinnvoll.
- Tutorial „Erste Schritte" im Metro-Modus ausblenden (S5).
- Klang: `emit('sound', …)`-Wege prüfen, Lautstärke-Regler, Stummschalten.

**Q4 Kern, Robustheit & Spielstände**
- Kern-Bitten: `traffic.js` offizielles Feld `freightShare` (S1); `g.eff('powerUse')` und Registerpunkt Kraftwerksleistung (S4); `g.eff('roadSpeed')` im Verkehr (S4); `year()` rechnet 364 Tage, das Wetterjahr hat 112 (S4); Symbol für Gebäude in Reparatur (S4); `g.tileDelay` statt Schreiben in `g.congestion` (S3); `offBoost` für Pulsturm, Flughafen, Messe (S1); Spezialindustrie in `city.js` auf Stufe 3 begrenzt (G4 hat Modelle bis Stufe 5).
- Speichern/Laden mit allen Systemen (Wetter mitten im Hochwasser, Bezirke, Linien, Szenarien, Metro) und alte Spielstände (Version 1) laden.
- `Math.random` in der Kernsimulation (Verkehr) macht Tests nicht deterministisch – auf den Spiel-Zufall umstellen.
- Große Karte (128², viele Gebäude): Rechenzeit pro Spieltag messen und Engpässe beheben.
