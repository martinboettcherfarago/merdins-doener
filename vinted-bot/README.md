# 🤖 Vinted-Deal-Bot

Der Bot beobachtet Vinted rund um die Uhr und schickt dir **frisch hochgeladene Teile weit unter Wert** aufs Handy, meist nur Sekunden nach dem Upload. Jede Meldung kommt mit Foto, Wert-Schätzung, Gewinn-Potenzial, Fake-Check und Kaufen-Button:

```
🔥💎 RARITÄT · 69% unter Wert · Score 100/100
Vintage Polo Sport Jacke 90s

💶 22,00 €  (mit Käuferschutz 23,80 €)
💰 Gewinn-Potenzial ca. +41,50 € (Weiterverkauf zum Marktpreis, nach Käuferschutz & Versand)
⚡ vor 8 s hochgeladen
💎 Rarität: vintage · 90er · Polo Sport
📊 69% unter geschätztem Wert (Ø 59 € · 8 ähnliche Ralph Lauren Jacken …)
📊 billigstes von 8 vergleichbaren Angeboten 🏆
🏷 Foto erkannt: Windbreaker · Nylon · dunkelblau/rot · 90er · Sportswear
🏷 Ralph Lauren · Gr. L · Gut
🔎 Suche: ⚡ Sniper

[ 🛒 Jetzt kaufen ] [ 👀 Ansehen ]
[ 💸 Preis vorschlagen ]
[ 👍 Guter Find ] [ 👎 Nicht mein Ding ]
```

---

## Inhalt
1. [Was er kann](#was-er-kann)
2. [Einrichten (Windows)](#einrichten-windows)
3. [So findet er Schnäppchen](#so-findet-er-schnäppchen)
4. [Telegram-Befehle](#telegram-befehle)
5. [Einstellungen](#einstellungen-configyaml)
6. [Bildmodell, Fake-Ampel, KI-Check](#bildmodell-fake-ampel-ki-check)
7. [Was aussortiert wird](#was-aussortiert-wird)
8. [Eigene Suchen, Kaufen & Angebote](#eigene-suchen-kaufen--angebote)
9. [Aktualisieren, Dauerbetrieb, Probleme](#aktualisieren)

---

## Was er kann

| | |
|---|---|
| ⚡ **Sniper** | alle ~4 s die neuesten Uploads auf ganz Vinted: nur deine Marken, Premium-Marken und Raritäten |
| ⏱ **Marken im eigenen Takt** | 77 eingebaute Marken & Trends (+ deine eigenen). Wo viel hochgeladen wird, schaut er alle 10–25 s nach, sonst alle 1–2 Min. |
| 💶 **Budget** | nur Teile bis 30 €, teure Marken (Luxus, Designer, Outdoor-Premium) bis 80 € |
| 🎚 **Auto-Stufe** | passt die Strenge so an, dass stetig 20–60 Schnäppchen pro Stunde kommen |
| 🔔 **Push nur für Sniper** | ⚡ Sniper-Treffer klingeln, alles andere kommt lautlos in den Chat (`/push`) |
| 💰 **Wert für fast alles** | über 400 Marken × rund 50 Kategorien × Zustand, lernt aus jedem gesehenen Preis |
| 💎 **Raritäten & Trends** | vintage, 90er, Y2K, Made in USA, Grails wie Carhartt Detroit oder Stone Island Ghost |
| 👗 **Mode-Bildmodell** (optional, Standard aus) | erkennt 123 Merkmale im Foto und lernt aus Vinted-Fotos – kostet Rechenleistung, darum nur mit `/modell an` |
| 🛡 **Fake-Ampel** | sofortiger Fake-Check: Marke × Preis, „1:1“, „AAA“, Katalogfoto … |
| 🤖 **KI-Bildcheck** (optional) | Claude prüft die Fotos auf Echtheit, Zustand, Look und Wert |
| 👍/👎 | lernt deinen Geschmack |
| 🛒 **Kaufen & Angebote** | ein Tipp öffnet den Kauf; Preisvorschläge per Button (experimentell) |

---

## Einrichten (Windows)

1. **Python** von [python.org/downloads](https://www.python.org/downloads/) installieren und dabei **„Add Python to PATH“ anhaken**.
2. **Telegram-Bot anlegen:** In Telegram **@BotFather** öffnen → `/newbot` → Namen ausdenken → den **Token** (`123456789:AAH…`) kopieren.
3. **Bot herunterladen:** [ZIP laden](https://github.com/martinboettcherfarago/merdins-doener/archive/refs/heads/claude/vinted-bot.zip) → Rechtsklick → „Alle extrahieren“ → Ordner `vinted-bot` öffnen.
4. **`start.bat`** doppelklicken. Beim ersten Mal richtet er Python ein und legt `config.yaml` an.
5. `config.yaml` mit dem **Editor** öffnen und bei `telegram → token` deinen Token eintragen.
6. **Chat-ID:** Im Ordner in die Adresszeile `cmd` tippen → `start.bat chat-id` → deinem Bot in Telegram `/start` schreiben → die angezeigte Zahl bei `chat_id` eintragen.
7. **`start.bat`** starten. Fertig: Telegram meldet „Vinted-Bot läuft“.
8. **Bildmodell (optional, Standard aus):** nur bei einem starken PC sinnvoll – **`ki-installieren.bat`** ausführen (ca. 400 MB), in Telegram `/modell an`, Bot neu starten, dann `/sammeln`.

Mac/Linux/Raspberry Pi: dasselbe mit `./start.sh` und `./ki-installieren.sh`.

---

## So findet er Schnäppchen

```
⚡ Sniper (alle ~4 s)  ─┐
                        ├─▶ Filter ─▶ Wert schätzen ─▶ Ziele der Stufe ─▶ Fake-Ampel ─▶ 📱 Meldung
⏱ Marken & Trends      ─┘   Größe, Kategorie, Budget, Kleinkram, 👎
   (eigener Takt je Marke)
```

**1. Abfragen.** Der **Sniper** holt alle ~4 Sekunden die neuesten Uploads auf ganz Vinted bis zu deinem Budget. Ist eine ganze Seite neu, blättert er sofort weiter, damit nichts durchrutscht. Daneben laufen die **Marken- und Trend-Suchen**. Jede hat ihr eigenes Tempo: Bei Marken mit vielen Uploads schaut er alle 10–25 s nach, bei ruhigen alle 1–2 Min. Insgesamt geht höchstens etwa eine Anfrage pro Sekunde an Vinted. `/status` zeigt den Takt.

**2. Filtern.** Gemeldet wird nur, was zu deinen Größen (Standard S, M, L) und Kategorien (Standard: keine Schuhe) passt, im Budget liegt und kein Kleinkram ist. Der Sniper nimmt außerdem nur **Marken aus deiner Liste, Premium-Marken und Raritäten**, kein Fast Fashion und kein No-Name.

**3. Wert schätzen.** Marke × Kategorie × Zustand, dazu Raritäten (+20–60 %) und Trends (+10 %). Er lernt aus jedem gesehenen Preis, getrennt nach Marke und Kategorie: Eine Carhartt-Mütze wird nie mit einer Carhartt-Jacke verglichen. Mit Bildmodell fließt auch der Wert ein, den er am Foto erkennt. Deine Werte bringst du ihm per `/preis carhartt jacken 90` bei.

**4. Ziele der Stufe:**

| Stufe | online max. | unter Wert | günstiger als | Gewinn mind.* |
|---|---|---|---|---|
| `locker` | 20 Min. | 30 % | 75 % der Vergleichsangebote | 10 € |
| `normal` | 10 Min. | 40 % | 90 % | 15 € |
| `streng` | 5 Min. | 50 % | 95 % | 20 € |
| `offen` | 20 Min. | 25 % | 60 % | 8 € |
| **`auto`** (Standard) | wechselt selbst zwischen den vieren (höchstens alle 15 Min.), damit stetig **20–60 Schnäppchen pro Stunde** kommen – lockert nur Preis-Ziele, der Zustand bleibt immer mind. „gut“ | | | |

\* Bei billigen Markenteilen reicht die Hälfte des Preises als Gewinn (8-€-Shirt: 4 €). Erst ab etwa 30 € gilt der volle Wert. Für Fast Fashion gilt immer der volle Wert.

Nachgeholfen wird bei: 😎 cooler Foto-Look (90er, Sportswear, Fellkragen …), 😍 „passt zu deinem Geschmack“ und 🔥 „sieht begehrt aus“. Dann reicht bis zu 15 Prozentpunkte weniger Rabatt, nie aber unter 25 %. Eigene Regeln pro Marke (`/marke stone island rabatt 60`) gelten überall, auch im Sniper.

**5. Fake-Ampel, dann Meldung.** 🔴 wird nicht gemeldet (mit KI-Check: nur, wenn Claude es für echt hält). 🟡 kommt mit Warnung.

**Probelauf ohne Vinted:** `/probelauf` (oder `probelauf.bat`) spielt einen künstlichen Markt mit rund 800 Angeboten, 13 echten Funden und 17 Fallen (Fakes, Patches, Bücher, Kindergrößen, Suchanzeigen …) durch. Mit den Standardeinstellungen erkennt er in 30 Zufalls-Märkten **alle 330 Funde im Budget** und meldet **keine der 510 Fallen**.

---

## Telegram-Befehle

| Befehl | Wirkung |
|---|---|
| **Schnäppchen-Radar** | |
| `/stufe auto` · `offen` · `locker` · `normal` · `streng` | wie streng gefiltert wird |
| `/budget 30` · `/budget marken 80` | Höchstpreis pro Teil / für teure Marken |
| `/radar an` · `/radar aus` · `/radar an <Vinted-Link>` | ⚡ Sniper; mit Link nur für deine angehakten Marken oder eine Kategorie |
| `/trends` · `/trends plus jacquemus, vintage lederjacke` · `/trends minus nike` | deine Marken- & Trend-Liste |
| `/marke carhartt bis 60 rabatt 50` | eine Marke mit eigenen Regeln |
| `/wert carhartt detroit jacke vintage 40 €` | Wert schätzen (auch mit Vinted-Link) |
| **Was gemeldet wird** | |
| `/groesse S M L` · `/groesse alle` | deine Größen (auch `W30`, `M 32`) |
| `/ohne schuhe` · `/mit schuhe` · `/kategorien` | Kategorien aus-/einblenden |
| `/raritaeten an` | nur noch Raritäten |
| `/preis carhartt jacken 90` | eigenen Marktwert beibringen |
| `/vorlieben` | was er aus deinen 👍/👎 gelernt hat |
| **Bildmodell & Echtheit** | |
| `/modell an` · `/modell aus` · `/modell` | Bildmodell ein/aus (Standard: aus), Stand |
| `/sammeln` · `/trainieren` | Sammel-Turbo, neu trainieren (nur mit Bildmodell) |
| `/ampel streng` · `warnen` · `aus` | Fake-Ampel |
| `/fake <Link>` · `/echt <Link>` | dem Fake-Modell etwas beibringen |
| `/ki an` · `/ki aus` · `/pruefen <Link>` | Claude-Bildcheck |
| **Sonstiges** | |
| `/neu nike air max 90 bis 40 score 60` | eigene normale Suche |
| `/suchen` · `/pause 2` · `/weiter 2` · `/loeschen 2` | Suchen verwalten |
| `/pause` · `/weiter` | alle Meldungen anhalten / fortsetzen |
| `/push sniper` · `alle` · `aus` | 🔔 welche Meldungen mit Push-Ton kommen (Standard: nur ⚡ Sniper-Treffer, der Rest lautlos) |
| `/live` · `/live 10` | **was kam wirklich rein?** Sniper-Takt, Meldungen, wie viele Sekunden nach dem Upload, Preise, häufigste Aussortier-Gründe |
| `/status` · `/probelauf` · `/hilfe` | Überblick, Testlauf, Hilfe |

---

## Einstellungen (`config.yaml`)

Fast alles geht auch per Telegram. In der `config.yaml` stehen die Startwerte:

| Abschnitt → Wert | Standard | Bedeutung |
|---|---|---|
| `notifications → telegram → token / chat_id` | – | dein Telegram-Bot |
| `resale → brands` | `[trends]` | eingebaute Trend-Liste (+ eigene Marken, z. B. `[trends, Ganni]`) |
| `resale → level` | `auto` | `auto` / `offen` / `locker` / `normal` / `streng` |
| `notifications → push` | `sniper` | Push-Ton für `sniper` (nur ⚡ Sniper-Treffer) / `alle` / `aus` |
| `resale → budget` / `budget_brands` | `30` / `80` | Höchstpreis / für teure Marken |
| `resale → sniper` / `sniper_every_seconds` | `true` / `4` | ⚡ Sniper an, wie oft |
| `resale → sniper_link` | – | Sniper nur für diesen Vinted-Link |
| `filters → sizes` / `exclude_types` | `[S, M, L]` / `[schuhe]` | Größen / ausgeblendete Kategorien |
| `filters → fake_ampel` | `streng` | `streng` / `warnen` / `aus` |
| `ml → backbone` | `fashion` | Bildmodell: `fashion` (Mode-Spezialist) oder `schnell` (für schwache PCs) |
| `ai → enabled / api_key` | aus | Claude-Bildcheck (kostet pro Treffer ein paar Cent) |
| `vinted → workers` / `request_gap_seconds` | `2` / `1.0` | parallele Sucher / Abstand zwischen Anfragen |

---

## Bildmodell, Fake-Ampel, KI-Check

### 👗 Mode-Bildmodell (optional, Standard: aus)
Ohne Bildmodell entscheidet der Bot nach Marke, Preis, Zustand und Titel – schneller und ohne Rechenlast. Wer einen starken PC hat, kann es zuschalten: einmalig `ki-installieren.bat` ausführen, in Telegram `/modell an`, Bot neu starten. `/modell aus` schaltet es sofort wieder ab. Beim ersten Start lädt der Bot **Marqo-FashionSigLIP**, ein auf Mode-Fotos spezialisiertes Bildmodell (Apache-2.0, ca. 800 MB, ~110 ms pro Foto). Auf schwachen PCs nimmst du `backbone: schnell` (CLIP ViT-B/32, ~40 ms).

- **Sofort, ohne Training:** 123 Merkmale aus dem Foto, nämlich Kategorie (auch Aufnäher, Karton, Buch), Farbe, Material, Muster, Stil, Jahrzehnt, Details und Fotoart. Daraus folgen der 😎 Foto-Look, die Kategorie bei unklaren Titeln, das Aussortieren von Kleinkram und Hinweise für die Fake-Ampel.
- **Eigenes Training:** Von jedem gesehenen Artikel speichert er einen Bild-Fingerabdruck (ca. 4 KB, keine Fotos) mit Preis und Favoriten. Alle 6 Stunden trainiert er daraus ein Wert-, Begehrt-, Geschmacks- (👍/👎) und Fake-Modell (`/fake`, `/echt`, Claude-Urteile). Jedes Modell wird an Artikeln geprüft, die es nicht kennt, und nur benutzt, wenn es besser ist als die Faustregel. `/modell` zeigt die Werte: niedrige „Abweichung“ ist gut (20–30 % ist realistisch), hohe „Trefferqualität“ ist gut (ab 70 % gut).
- **Schneller Start:** `/sammeln` holt Tausende Artikel auf einmal und trainiert sofort.

### 🛡 Fake-Ampel (sofort, ohne Training)
Sie prüft jeden Treffer auf typische Warnzeichen: rund 60 oft gefälschte Marken mit Hype-Modellen (Jordan 1, Yeezy, Nuptse, Box Logo, Neverfull …) × verdächtig billig, Verräter-Wörter („1:1“, „AAA“, „UA“, „mirror“, „wie original“, „alle Größen verfügbar“ …), „neu mit Etikett“ zum Spottpreis, Katalogfoto statt eigenem Foto und, sobald trainiert, dein Fake-Modell.
🔴 wird nicht gemeldet, 🟡 kommt mit Warnung. **Ehrlich gesagt:** Ein fertiges Modell, das Kleidungs-Fakes zuverlässig erkennt, gibt es nicht. Grün heißt „keine Warnzeichen“, nicht „garantiert echt“.

### 🤖 KI-Bildcheck mit Claude (optional)
Claude schaut sich bis zu 4 Fotos jedes Treffers an und gibt Echtheit, Zustand, Look, Trend, realistischen Wert und ein Urteil (kaufen/vielleicht/lassen). Fake-Verdacht wird nicht gemeldet. Knapp verpasste Retro- und Trend-Teile bekommen einen Zweitblick (🤖✨ KI-Fund).
**Einrichten:** Auf [console.anthropic.com](https://console.anthropic.com) Guthaben aufladen (getrennt von einem Claude-Abo) und einen API-Schlüssel erstellen. Dann in der `config.yaml` unter `ai:` die Werte `enabled: true` und `api_key: "sk-ant-…"` eintragen und neu starten.
**Kosten:** mit Claude Opus 5.5 ca. 4–6 Cent pro Check, mit den Standard-Limits (40 Checks + 20 Zweitblicke pro Tag) höchstens ca. 2–3 $ am Tag. `model: claude-sonnet-5-5` kostet etwa die Hälfte. `/ki` zeigt die Tageskosten.

---

## Was aussortiert wird

| wird aussortiert | wird gemeldet |
|---|---|
| „fake“, „inspired“, „replica“, „defekt“, Suchanzeigen, „nur Tausch“ | „kein Fake“, „nicht defekt“, „Tausch möglich“ |
| Patches, Sticker, Kartons, Staubbeutel, Bücher (auch wenn nur das **Foto** es zeigt) | „Jacke neu mit Etikett“, „Tasche mit Staubbeutel“ |
| „im Stone Island Style“, Marke „No Name“ + Markenname im Titel | Marke „Vintage“/„Andere“ + „Adidas“ im Titel |
| Kindergrößen, falsche Größe, ausgeblendete Kategorien | W30 L32, 38, 48 werden in S/M/L umgerechnet |
| über deinem Budget, unter 2 €, 🔴 Fake-Ampel | |
| im Sniper: Fast Fashion, No-Name, Allerwelts-Marken | Marken deiner Liste, Premium-Marken, Raritäten |

Der Bot lernt Preise nur aus echten Angeboten: Fakes, Kindergrößen, Kleinkram und defekte Teile zählen nicht. Warum etwas nicht kam, zeigt `/probelauf`.

---

## Eigene Suchen, Kaufen & Angebote

**Eigene Suchen** laufen zusätzlich zum Schnäppchen-Radar und mit ihren eigenen Grenzen:
`/neu nike air max 90 bis 40 score 60` oder einen Vinted-Link mit Filtern: `/neu https://www.vinted.de/catalog?…`
Optionen: `bis 40`, `ab 10`, `rabatt 40`, `gewinn 15`, `frisch 10`, `günstiger 95`, `score 60`, `markt 50`.
In der `config.yaml` unter `searches:` (Beispiele stehen in der Vorlage).

**🛒 Jetzt kaufen** öffnet direkt den Vinted-Kaufvorgang. Bezahlen bestätigst du selbst. Der Bot kauft absichtlich **nie automatisch**.

**💸 Angebote (experimentell):** Ohne Einrichtung öffnet der Button den Artikel. Mit Einrichtung schickt der Bot das Angebot nach deinem „✅ Ja, senden“ selbst:
1. Auf vinted.de einloggen.
2. `F12` drücken → **Netzwerk** → Seite neu laden → erste Anfrage → den Wert von **`Cookie:`** kopieren.
3. In der `config.yaml`: `account: enabled: true, cookies: "…"`.

Vinted erlaubt höchstens 25 Angebote pro Tag und höchstens −40 %.

> ⚠️ Cookies und API-Schlüssel sind so viel wert wie Passwörter. Die `config.yaml` deshalb **nie** weitergeben oder hochladen.

---

## Aktualisieren
1. Bot stoppen: im Fenster **Strg + C** drücken und das Fenster schließen.
2. [Neue ZIP](https://github.com/martinboettcherfarago/merdins-doener/archive/refs/heads/claude/vinted-bot.zip) laden und entpacken.
3. Den Inhalt des neuen `vinted-bot`-Ordners in deinen bisherigen Ordner kopieren und **„Dateien ersetzen“** wählen. `config.yaml`, Datenbanken, Bildmodell und Pakete bleiben erhalten.
4. `start.bat` starten. Neue Pakete installiert er dabei selbst.

## Rund um die Uhr
Der Bot meldet nur, solange er läuft: entweder auf dem PC (`start.bat` offen lassen, kein Ruhezustand) oder auf einem **Raspberry Pi** (ca. 3 W) mit `./start.sh` in `tmux` bzw. als `systemd`-Dienst.

## Probleme?

| Problem | Lösung |
|---|---|
| „Vinted blockiert gerade (403)“ | wartet und versucht es selbst weiter. Bei häufigem Auftreten: `workers: 1` oder `request_gap_seconds: 1.5`, evtl. `proxy:` |
| Keine oder zu wenige Meldungen | normal direkt nach dem Start (erste Runde = Preise lernen). `/live` zeigt, wie oft der Sniper abfragt und warum aussortiert wird; `/stufe auto` lockert bei Flaute selbst |
| Telegram meldet nichts | `start.bat test-notify`; dem Bot `/start` geschrieben? `chat_id` richtig? |
| `/modell`: „⚠️ … nicht ladbar“ | `ki-installieren.bat` erneut ausführen; der Bot läuft solange mit dem schnellen Modell |
| Rote Fehlermeldung beim Start | meist ein Tab in der `config.yaml` (nur Leerzeichen zum Einrücken). Die Meldung nennt die Zeile |

Mehr Details im Fenster zeigt `start.bat -v`.

## Wichtig zu wissen
- Vinted hat keine offizielle Schnittstelle. Der Bot nutzt dieselben Abfragen wie die Webseite. Ändert Vinted etwas, muss der Bot evtl. angepasst werden.
- Vinteds Nutzungsbedingungen erlauben keine automatisierten Zugriffe. Nutzung auf eigene Verantwortung, nur privat.
- Werte sind Schätzungen auf Basis von **Angebotspreisen**. Verkauft wird oft etwas darunter.

## Entwicklung
```bash
pip install -r requirements.txt pytest
python -m pytest -q
```
