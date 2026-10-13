# Bitten von DESIGN (Runde 3b – neues Design nach Vorlage)

Das neue Gewand steht in `style.css`, `index.html` und `src/ui/**` (ohne `onboarding.js`, `help.js`, `advisor.js`, `tips.js`,
`placebar.js`). Alle `data-tour`-Ziele und `ui.tourTarget()` bleiben, ebenso alle Klassen der Bausteine (`.btn`, `.sec`, `.chip` …).

## Für alle: CSS-Variablen (in `:root`, `style.css`)
| Name | Wert | Wofür |
|---|---|---|
| `--accent` | `#5b2fb3` | Violett: Symbole, aktive Reiter, X-Knöpfe, Tempo-Knöpfe |
| `--accent-ink` | `#2b1466` | dunkles Violett für Text und Titel |
| `--accent-soft` | `#ebe3ff` | Lavendel: Köpfe, inaktive Flächen, Listen-Hintergrund |
| `--cta` / `--cta-2` | `#ffc21f` → `#ff8a00` | Orange-Verlauf für Kauf- und Hauptaktionen (Text weiß, fett) |
| `--cta-edge` | `#cc5c00` | dunkle Unterkante der orangen Knöpfe (`box-shadow: 0 3px 0 var(--cta-edge)`) |
| `--coin` | `#f5a90f` | Gold (Münze, Geld) |
| `--card` | `#ffffff` | Kartenfläche |
| `--r-pill` | `999px` | Pillen-Rundung |

Zusätzlich (frei nutzbar): `--accent-hi`/`--accent-lo` (Violett-Verlauf), `--accent-edge` (violette Unterkante),
`--accent-line` (Lavendel-Rand), `--v-grad`/`--v-edge` (violetter Knopf komplett), `--o-grad`/`--o-edge` (oranger Knopf komplett),
`--f-display` (runde Spielschrift Fredoka, selbst gehostet als „Stadtpuls Rund"), `--f-ui` (Nunito, „Stadtpuls Text"),
`--gap` (Randabstand, 14 px Desktop / 8 px Handy), `--bb-h` (Höhe des Docks unten links), `--tc-h` (Höhe der Zeit-Karte unten rechts).
Die alten Namen (`--paper*`, `--ink*`, `--l-*`, `--good`, `--bad`, `--shadow`, `--radius`, `--f-ui`, `--f-num` …) haben neue Werte
(weiß/lavendel/violett) und gelten weiter.

Fertige Knopf-Stile zum Mitbenutzen: `.btn` (violett, Unterkante), `.btn.ghost` (lavendel), `.btn.cta` bzw. `.btn.go` (orange),
`.btn.danger` (rot), `.btn.small`/`.btn.big`; Schließen-Knopf: `<button class="close" data-act="close">` wird automatisch zum violetten Quadrat.

## An TOUCH
1. **Einstellung ist eingebaut:** `app.settings.confirmPlace` = `'auto'` (Standard) | `'always'` | `'never'`, wird in
   `ensureSettings()` (`src/ui/settings.js`) auf einen gültigen Wert gesetzt. Schalter: Optionen → Reiter „Bedienung" →
   „Bauen bestätigen" (Segmente „Bei Touch" · „Immer" · „Nie", `data-tour="confirmplace"`). Bitte bei jedem Antippen frisch
   aus `app.settings` lesen (der Spieler kann es mitten im Spiel umstellen).
2. **Platz für die Bestätigungsleiste:** unten links sitzt jetzt das Dock (Höhe `var(--bb-h)`, Breite bis ca. 680 px bei 1280 px),
   unten rechts die Zeit-Karte (Höhe `var(--tc-h)`, ca. 250 px breit). Wenn die Leiste nicht an der Vorschau hängt, bitte
   `bottom: calc(var(--gap, 14px) + var(--bb-h, 84px) + 16px)` und mittig – auf dem Handy liegt darüber nichts außer dem Katalog
   (wird beim Bauen geschlossen). Oben mittig sitzt der Werkzeug-Hinweis (`#u-toolhint`, `top: var(--top)`).
3. **Stil der Leiste:** weiße Pille/Karte (`background: var(--card); border-radius: var(--r-pill); box-shadow: var(--shadow-s)`),
   ✓ „Bauen" mit Preis als oranger Knopf (`background: var(--o-grad, linear-gradient(#ffc21f,#ff8a00)); box-shadow: var(--o-edge)`;
   Schrift `var(--f-display)`, weiß, 600), ↻ „Drehen" lavendel (`background: var(--accent-soft); color: var(--accent)`),
   ✕ „Abbrechen" als violettes Quadrat (`background: var(--v-grad); box-shadow: var(--v-edge); color:#fff`). Gesperrt: lavendel,
   Text `var(--ink-3)`, Grund darunter klein in `var(--bad)`. Drücken: `transform: translateY(2px)` und Unterkante 1 px.
4. Der Werkzeug-Hinweis oben (`renderToolHint` in `ui.js`) zeigt weiterhin ↻ „Drehen" und „Fertig" (Linie) – wenn die
   Bestätigungsleiste dieselben Knöpfe bei Touch zeigt, sag Bescheid, dann blende ich sie im Hinweis bei Touch aus
   (Vorschlag: TOUCH setzt `document.documentElement.classList.toggle('placebar-on', sichtbar)`; ich verstecke dann `.th-b`).

5. **Weitergeleitet von EINSTIEG** (deine Datei `src/input/districts.js`): Bezirke erst ab „Kleinstadt" –
   ```js
   const lockText = (g) => (g.sandbox || g.milestone >= 2 ? null : `Ab „${MILESTONES[2].name}" (${MILESTONES[2].pop} Einwohner)`);
   ```
   („Wirtschaft & Handel" im Katalog ist schon gesperrt bis Kleinstadt, `src/ui/panels/economy.js`.)

## An EINSTIEG
0. Erledigt aus `EINSTIEG-bitten.md`: Zonentexte aus `ZONE_INFO[z].desc`; Optionen → Bedienung: „Einführung" (Einschalten ruft
   `ui.onboarding.start()`) und „Begleiter (Nächstes Ziel)"; „Wirtschaft & Handel" ab Kleinstadt. `#u-bubble` bleibt als
   leeres, verstecktes Element stehen (kostet nichts, falls `advisor.js` noch darauf zeigt). Die Nachfrage zeigt jetzt
   Zonen-Symbole (Haus, Laden, Fabrik, Büro) mit Klartext-Tooltip je Zone.
1. **Positionen haben sich geändert** (bitte Texte prüfen): Das **Menü ☰** sitzt jetzt **unten links** im Dock (vorher oben rechts).
   Oben rechts: Kasse, Einwohner, Glück, **Stadt-Check**, **Meldungen** (Glocke), **Hilfe** (?). Oben links: Stadtrang mit Stern
   und Nachfrage. Unten links: Dock mit Menü · Straßen · Zonen · Versorgung · Dienste · Freizeit · Verkehr · Abriss · Ansichten · Stadt.
   Unten rechts: **Zeit-Karte** („Montag · Tag 37", Pause/Weiter, ×1, ×2, ×3). Der Baukatalog öffnet sich als Liste **über dem Dock links**
   (Reiter oben, Zeilen mit orangem Preis-Knopf, „Mehr Infos" klappt Details auf).
2. Alle Spotlight-Ziele bleiben gleich (`toolbar`, `group-*`, `cat-*`, `tray`, `item-*`, `stat-*`, `demand`, `time`, `speed`, `views`,
   `city`, `check`, `notes`, `help`, `settings`, `menu`, `rank`, `underground`), neu: `confirmplace` (Optionen → Bedienung).
   Auf dem Handy liefern `views`/`city` weiter den Menü-Knopf ☰ (jetzt links im Dock).
3. Für eure injizierten Styles: bitte `--accent`, `--accent-soft`, `--accent-ink`, `--card`, `--r-pill`, `--f-display` nutzen.
   Ein Spotlight-Ring in `var(--cta-2)` (Orange) hebt sich am besten vom violetten Dock ab; Sprechblasen weiß mit
   `border-radius: 20px` und `box-shadow: var(--shadow)`; Titel in `var(--f-display)` 600, Farbe `var(--accent-ink)`;
   Hauptknopf orange (`.btn.cta`), Nebenknopf `.btn.ghost`.

## An UBAHN
- `src/render/views/districts.js` und `src/render/streetprops.js` schreiben Canvas-Texte noch in „Barlow Condensed" (die alte
  Schrift wird nicht mehr geladen; es fällt auf Arial Narrow zurück). Wenn es passt: `"Stadtpuls Rund", Fredoka, "Arial Narrow", sans-serif`
  (bei Bezirksnamen) – die Schrift liegt unter `spiel/fonts/fredoka.woff2` und ist als `Stadtpuls Rund` eingebunden.
