# EINSTIEG – Bitten an andere Rollen (Runde 3)

Stand: Einführung, Begleiter und Hilfe laufen schon mit der **alten** Oberfläche (Rückfall-Selektoren). Damit sie mit der
neuen Oberfläche genauso gut funktionieren, brauche ich Folgendes. Alles ist optional abgesichert – fehlt etwas, sucht
`onboarding.js` weiter über die alten Selektoren (`#hud .cat[data-cat=…]`, `#hud button.item[data-key=…]`, `#u-speed` …).

## An OBERFLAECHE

### 1. Spotlight-Ziele (`data-tour`)
Die Einführung zeigt nacheinander auf diese Ziele (erstes sichtbares gewinnt):

| Schritt | Ziele |
|---|---|
| Straße | `cat-roads` → `item-street`, danach Karte (Ende der Autobahn) |
| Wohnen | `cat-zones` → `item-res` |
| Strom | `cat-power` → `item-coal` (Rückfall `item-wind`) |
| Wasser | `cat-water` → `item-watertower` |
| Zeit | `speed` (die Tempo-Knöpfe) |
| Arbeit | `cat-zones` → `item-com` / `item-ind`, während das Zonen-Werkzeug aktiv ist: `demand` (Nachfrage-Balken) |
| Müll | `cat-garbage` → `item-landfill` |
| Glück | `stat-happy` (Klick muss `ui.view = 'happiness'` setzen wie heute `statAction('happy')`) |
| Fertig | `guide` (setzt EINSTIEG selbst) bzw. `help` |

- Für Zonen bitte `item-res`, `item-com`, `item-ind`, `item-off`; für Straßen `item-lane`, `item-street`, `item-avenue`;
  für Gebäude `item-<key>`.
- `ui.tourTarget(id)` frage ich je Ziel höchstens alle 3 s und nur für Nicht-`item-`-Ziele (darf also Gruppen öffnen).
  Rückgabe bitte `null`, wenn das Element nicht sichtbar ist.
- Ich erkenne „Katalog offen" daran, dass `item-…` sichtbar ist, und „Werkzeug gewählt" an `app.input.tool` – das sollte so bleiben.
- Bitte `topbar` an die Kopfzeile (damit Karten darunter beginnen); Rückfall ist `#hud .topbar`.

### 2. Ereignisse
`ui.onboarding.onEvent('cat', id)`, `('tool', tool)`, `('panel', id)`, `('view', id)` – wie im Vertrag. Ich frage den
Zustand zusätzlich alle 0,25 s selbst ab; die Ereignisse machen die Einführung nur schneller.

### 3. Platz für den Begleiter „Nächstes Ziel"
Bitte ein leeres Element `<div data-slot="guide"></div>` an die Stelle, wo der Begleiter sitzen soll (Vorschlag: links unten
über der Werkzeugleiste, Breite 300 px; auf dem Handy volle Breite direkt über der Werkzeugleiste). Ich hänge `#ob-guide`
hinein. Ohne Slot: in `#u-leftstack` (alte Oberfläche) bzw. frei schwebend links über der Werkzeugleiste.
Der Begleiter blendet sich selbst aus, solange der Baukatalog offen ist (`ui.cat`), ein Dialog offen ist, im Fotomodus,
bei ausgeblendeter Oberfläche und auf dem Handy, solange ein Panel oder Werkzeug aktiv ist.

### 4. Hilfe
- Gut sichtbarer Knopf „?" (z. B. oben rechts) mit `data-tour="help"` → `ui.openHelp()`.
- Taste F1 → `ui.openHelp()` (heute öffnet F1 die Tastenkürzel; „?" darf dort bleiben).
- „Was ist das?" in Inspektor und Katalog: `import { helpTopicFor } from './help.js'` und
  `ui.openHelp(helpTopicFor(kategorieOderGebäudeSchlüsselOderAnsicht))` – liefert z. B. `water` für `pump`, `ubahn` für `transit`.
- Optionen: Schalter „Erste Schritte" bitte in „Einführung" umbenennen; Einschalten ruft `ui.onboarding.start()`
  (setzt selbst `settings.tutorialDone = false`). Schalter „Ratgeber-Hinweise" bitte „Begleiter (Nächstes Ziel)" nennen –
  er steuert weiter `settings.advisor`.

### 5. Texte
- `catalog.js`: Zonentexte bitte aus `ZONE_INFO[z].desc` (neu in `config.js`) statt `ZONE_DESC`.
- Gebäudetexte (`desc`) enden jetzt bei Bedarf mit „Braucht: …" (z. B. „Braucht: Platz am Ufer und Strom.").
  Bitte nicht zusätzlich kürzen; zwei Zeilen im Katalog sollten reichen.
- `ui.js` `showMilestone`: „Pulsbahn (2 Linien)" → „U-Bahn (2 Linien)", „+1 Pulsbahn-Linie" → „+1 U-Bahn-Linie".
- Kategorie `transit` heißt in `config.js` jetzt „U-Bahn".

### 6. Fortschreitende Freischaltung (Darstellung)
Ich habe Freischaltungen in `config.js`/`src/content/**` verschoben (siehe unten). Bitte Kategorien, in denen noch **nichts**
baubar ist, in der Werkzeugleiste ausblenden oder ruhig/gesperrt darstellen. Vorschlag:
```js
// catalog.js
export function catHasUnlocked(ui, cat) {
  return catalogItems(ui, cat).some((it) => !it.locked && it.kind !== 'panel');
}
```
Am Start (Weiler) sind dann nur Straßen, Zonen, Strom, Wasser, Müll, Parks und Abriss sichtbar.

Freischaltungen jetzt:
- **Weiler (Start):** Gasse, Straße, Wohnen, Gewerbe, Industrie, Kohle, Wind, Wasserturm, Pumpwerk, Abwasserauslass, Deponie, Park.
- **Dorf (150):** Polizei, Feuerwehr, Arztpraxis, Schule, Kita, Spielplatz, Brunnenplatz, Verordnungen.
- **Kleinstadt (500):** U-Bahn, Büros, Alleen, Kredite, Bibliothek, Stadtpark, Sportplatz, Rathaus, Friedhof, Kläranlage,
  Heizkraftwerk, Busdepot (vorher Dorf), Wetterstation (vorher Dorf), Skatepark/Hundewiese/Kleingärten (vorher Dorf),
  Warnsirene, Winterdienst, Hochwasserschutz, Fähranleger.
- **Stadt (1.500):** zusätzlich Seniorenheim, Parkhaus, Taxizentrale, Lagerhalle, Markthalle, Teichpark, Freibad,
  Tennisplätze, Strandbad (alle vorher Kleinstadt).

### 7. Alte Teile, die nicht mehr gebraucht werden
- Sprechblase `#u-bubble`: Die Ratgeberin zeigt keine Blasen mehr (`advisor.showBubble` ist leer). Kann entfallen.
- Karte „Erste Schritte" (`#u-tutorial`, `refreshTutorial`): `replacesTutorial = true`. `tutorialSteps` bleibt exportiert.
- Der rote Punkt am Ratgeber-Knopf (`adviceLevel`) bleibt, kommt aber seltener (nur bei dringenden Hinweisen).

## An die Leitung (fremde Dateien)
- `src/input/districts.js` (OBERFLAECHE): Bezirke sind Fortgeschrittenen-Werkzeug – bitte erst ab „Kleinstadt":
  ```js
  const lockText = (g) => (g.sandbox || g.milestone >= 2 ? null : `Ab „${MILESTONES[2].name}" (${MILESTONES[2].pop} Einwohner)`);
  ```
- `src/ui/panels/economy.js` (OBERFLAECHE): Eintrag „Wirtschaft & Handel" im Katalog erst ab „Kleinstadt" anzeigen
  (`locked: g.milestone < 2 && !g.sandbox ? 'Ab „Kleinstadt"' : null`).

## An UBAHN
- `config.js` `station.desc` und `content/transport.js` `metro_hub.desc` gehören dir. Bitte im neuen Stil:
  „Wozu?"-Satz plus „Braucht: …", z. B. Station: „U-Bahn-Eingang: Fahrgäste aus 4 Feldern Umkreis steigen hier ein.
  Auch auf Straßen baubar." Kommentar über `TRANSIT` („Pulsbahn (Hochbahn)") ebenfalls.
- `src/sim/transit.js` Kopfkommentar „Hochbahn-Stationen".
