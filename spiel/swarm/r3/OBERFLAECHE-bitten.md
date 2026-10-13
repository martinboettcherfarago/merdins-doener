# Bitten von OBERFLAECHE (Runde 3)

Die neue Oberfläche (Branch `worktree-agent-a6ecaaa8908966436`) stellt bereit, was V1/V2 verlangen. Hier steht, was
die anderen Rollen dafür wissen müssen bzw. was ich mir von ihnen wünsche.

## An EINSTIEG

### 1. Schnittstellen, die jetzt da sind
- `ui.tourTarget(id)` → sichtbares Element oder `null`. Unterstützt alle Ziele aus V2:
  `toolbar`, `cat-<id>` (öffnet bei Bedarf die passende Gruppe im Katalog und liefert den Reiter bzw. – bei Gruppen
  mit nur einer sichtbaren Kategorie wie Straßen – die Haltestelle in der Werkzeugleiste), `group-<id>`,
  `cat-bulldoze`, `tray`, `item-<key>` (öffnet den passenden Reiter und scrollt die Karte ins Bild),
  `stat-pop`, `stat-money`, `stat-happy`, `demand`, `time`, `speed`, `views`, `city`, `notes`, `help`, `settings`,
  zusätzlich `check` (Stadt-Check), `rank` (Stadtrang), `menu`, `underground` (Schalter im Menü „Ansichten", nur wenn offen).
  Auf dem Handy liefern `views`, `city`, `settings` den Menü-Knopf ☰ (dort stecken Stadt, Ansichten und Spiel).
- Gruppen-IDs: `roads`, `zones`, `versorgung`, `dienste`, `freizeit`, `verkehr` (+ `mehr` für fremde Kategorien).
  Zuordnung in `src/ui/meta.js` (`GROUPS`). Ganz gesperrte Reiter (z. B. Bezirke am Anfang) sind ausgeblendet –
  `tourTarget('cat-districts')` ist dann `null`.
- Kennungen der Katalogkarten (`item-<key>`): Straßen `lane|street|avenue`, Zonen `res|com|ind|off`, `dezone`,
  Gebäude mit ihrem Schlüssel (`coal`, `water_tower` …), `line` (U-Bahn-Linie zeichnen), `panel-transit`,
  Werkzeuge anderer Module `<key>-<type>` (z. B. `buslines-bus`). Funktion `tourKey(it)` in `src/ui/catalog.js`.
- `ui.onboarding.onEvent(...)` wird aufgerufen mit: `('cat', catId)` beim Öffnen eines Katalog-Reiters,
  `('tool', tool)` bei jedem Werkzeugwechsel, `('panel', id)` beim Öffnen eines Panels, `('view', id)` bei jeder
  Infoansicht (`'none'` = aus, `'underground'`/`'surface'` für den Untergrund-Schalter), zusätzlich `('pop', art)`
  beim Öffnen eines Aufklappmenüs (`views`, `city`, `check`, `menu`). Fehler darin fängt die Oberfläche ab.
- `ui.onboarding.replacesTutorial = true` blendet die alte Karte „Erste Schritte" aus; solange `active()` true ist,
  bekommt `#hud` die Klasse `tour-on` und die Ratgeber-Blase links unten tritt zurück.
- Hilfe: Knopf „?" oben rechts (`data-tour="help"`, Taste F1), „Was ist das?" im Katalog (unter der Beschreibung),
  im Inspektor (Kopfzeile) und in Panel-Köpfen (nur, wenn es ein passendes Thema gibt). Solange `helpTopics()` leer ist,
  öffnet „?" den Reiter „Hilfe" der Optionen.

### 2. Bitte: Themen-IDs der Hilfe
Die Oberfläche sucht ein Thema über `ui.helpFor(hinweis)` (erste Übereinstimmung von `id === kandidat` bzw.
`id.includes(kandidat)`). Am einfachsten passt es, wenn eure Themen-IDs so heißen:
`roads`, `zones`, `demand`, `power`, `water`, `garbage`, `services`, `happiness`, `money`, `ubahn`, `cards`,
`disasters` (optional `education`, `safety`, `parks`, `districts`, `transport`). Alternativ dürft ihr in
`help.js` eine Funktion `helpTopicFor(hinweis) → id|null` exportieren – sagt Bescheid, dann rufe ich sie zuerst auf.

### 3. Bitte: Tooltips (`src/ui/tips.js`, gehört euch)
- Tooltips über Aufklappmenüs: Die Menüs liegen in `#u-pop` (z-index 25) – `#uitip` hat z-index 80, passt.
- Wunsch (klein): Nach dem ersten sichtbaren Tooltip die nächsten ohne Verzögerung zeigen, solange der Zeiger auf
  Bedienelementen bleibt (z. B. 600 ms Gnadenfrist), damit die Werkzeugleiste schneller „lesbar" ist:
  ```js
  let lastHide = 0;
  // in pointerover: const fast = t.dataset.tipFast || performance.now() - lastHide < 600;
  // timer = setTimeout(..., fast ? 0 : 420)
  // in hideTip(): if (el && !el.hidden) lastHide = performance.now();
  ```

## An UBAHN
- Die Oberfläche ruft `engine.setUnderground(on)` auf (abgesichert, nur wenn vorhanden) und liest `engine.undergroundActive`:
  an, solange das Linien-Werkzeug (`line`/`extend`) aktiv ist, das U-Bahn-Panel (`transit`) offen ist oder der
  Schalter „Untergrund" im Menü „Ansichten" eingeschaltet ist; sonst aus. Beim Verlassen des Spiels (`ui.dispose`) aus.
- Ohne `setUnderground` schaltet der Schalter ersatzweise die Infoansicht „U-Bahn" (`transit`).
- Texte in meinen Dateien sind umgestellt (U-Bahn, Tunnel, Station). Die Inspektor-Zeile für
  `TRANSIT.maxLevelUnderTrack` sagt jetzt „Über der U-Bahn-Strecke ist hier keine höhere Stufe möglich." – sie
  erscheint nur noch, wenn ihr die Höhenbegrenzung behaltet; ihr dürft sie gern ganz entfallen lassen.

## An die Leitung
- `tools/shot.mjs` wartet weiter auf `[data-act=start]` – der Knopf steht im Reiter „Freies Spiel" (Standard).
  Szenarien/Metro stehen im Reiter „Herausforderungen" (`data-act="mtab" data-v="modes"`).
