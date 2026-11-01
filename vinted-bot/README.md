# 🤖 Vinted-Deal-Bot

Der Bot durchsucht Vinted rund um die Uhr nach den Sachen, die du willst. Jeden neuen Treffer bewertet er mit einem **Deal-Score von 0 bis 100** und schickt dir die guten sofort aufs Handy, mit Foto und Buttons:

```
🔥 TOP-DEAL · Score 94/100
Nike Air Max 90

💶 19,00 €  (mit Käuferschutz 20,50 €)
📊 52% unter Marktpreis (Ø 40 €)
🏷 Nike · Gr. 43 · Neu mit Etikett
❤️ 2 Favoriten · ⏱ vor 1 Min. · 👤 sneakerqueen
🔎 Suche: Air Max

[ 🛒 Jetzt kaufen ]  [ 👀 Ansehen ]
[ 💸 17,00 € anbieten ]  [ 💸 15,00 € anbieten ]
```

## Was er kann

| | |
|---|---|
| 💶 **Preisschätzung für fast alles** | über 400 Marken in 7 Preisklassen (Fast Fashion bis Luxus) × rund 50 Kategorien (Kleidung, Schuhe, Taschen, Schmuck, Konsolen, Games, Lego, Parfum …) × Zustand × Kindergröße. Nichts wird mehr wegen „Preis unbekannt“ aussortiert |
| 💰 **Schnäppchen-Radar** | sucht nach Marken **und** angesagten Modellen/Styles (Nike Tech Fleece, Vintage Lederjacke, Vintage Trikot, Le Pliage, Y2K …) und meldet nur **ganz frisch hochgeladene** Artikel **weit unter Wert**, mit geschätztem Gewinn |
| 📡 **Alles-Radar** | optional: prüft zusätzlich die neuesten Uploads auf ganz Vinted, ganz ohne Suchbegriff |
| ⚠️ **Fake-Schutz** | Luxus/Designer verdächtig billig → Warnung; extrem billig → wird aussortiert |
| 💎 **Raritäten-Erkennung** | erkennt vintage, 90er, Made in USA/Italy/England, Deadstock und begehrte Modelle (Carhartt Detroit, Stone Island Ghost, Arc'teryx Veilance, Patagonia Retro X …) |
| 🧠 **Lernt dazu** | 👍/👎 unter jeder Meldung, eingebautes Preis-Vorwissen, eigene Marktpreise per `/preis` |
| 📏 **Deine Größe** | Standard S, M, L; Schuhe standardmäßig ausgeblendet. Beides änderbar |
| 🏷 **Marken-Filter** | strenger Abgleich mit der Marken-Angabe des Artikels: Ein No-Name-Teil „im Carhartt-Style“ zählt nicht |
| 🔎 **Beliebig viele Suchen** | Suchbegriff + Preis, oder einfach einen Vinted-Link mit allen Filtern (Marke, Größe, Zustand, Kategorie) einfügen |
| ⏱ **Ständig aktuell** | prüft standardmäßig jede Minute und meldet nur **neue** Artikel |
| 📊 **Findet die guten Sachen** | vergleicht jeden Preis mit dem üblichen Marktpreis, achtet auf Zustand, Frische und Beliebtheit |
| 📉 **Preissenkungen** | meldet, wenn ein Artikel aus deiner Suche billiger wird |
| 🚫 **Filtert Müll raus** | Fakes, „defekt“, „Suche“ und „Tausch“ sowie falsche Größen oder Marken |
| 🛒 **Direkt kaufen** | ein Tipp öffnet direkt den Vinted-Kaufvorgang |
| 💸 **Angebote senden** | Preisvorschlag per Button (−10 % / −20 %), nach einer Sicherheitsabfrage |
| 📱 **Steuerung per Telegram** | Suchen anlegen, pausieren und löschen direkt im Chat |
| 🔔 **Mehrere Kanäle** | Telegram (empfohlen), Discord, ntfy (Push ohne Konto) |

---

## Einrichtung (ca. 10 Minuten)

### 1. Python installieren
- **Windows:** [python.org/downloads](https://www.python.org/downloads/) → bei der Installation **„Add Python to PATH“ anhaken**.
- **Mac:** `brew install python` oder Installer von python.org.
- **Raspberry Pi / Linux:** ist meist schon da.

### 2. Telegram-Bot erstellen
1. In Telegram **@BotFather** öffnen → `/newbot` → Namen ausdenken.
2. Du bekommst einen **Token** wie `123456789:AAH...` und kopierst ihn.

### 3. Konfiguration
1. `config.example.yaml` kopieren und die Kopie **`config.yaml`** nennen. Das macht das Startskript beim ersten Start auch automatisch.
2. In `config.yaml` bei `telegram → token` deinen Token eintragen.
3. Chat-ID herausfinden:
   - Windows: `start.bat chat-id`
   - Mac/Linux: `./start.sh chat-id`

   Dann deinem Bot in Telegram `/start` schreiben. Die angezeigte Zahl trägst du bei `chat_id` ein.
4. Unter `searches:` deine Suchen eintragen (Beispiele stehen schon drin).

### 4. Testen
```bash
./start.sh test-notify     # Windows: start.bat test-notify  → Testnachricht aufs Handy
./start.sh scan            # zeigt sofort die besten aktuellen Angebote jeder Suche
./start.sh scan --send     # …und schickt sie dir auch per Telegram
```

### 5. Starten
```bash
./start.sh                 # Windows: Doppelklick auf start.bat
```
Beim ersten Durchlauf merkt sich der Bot die Artikel, die gerade online sind, und deren Preise. Danach meldet er nur noch **neue** Treffer.

---

## 💰 Schnäppchen-Radar: nur die günstigsten, frisch hochgeladenen Artikel

Die besten Schnäppchen gibt es meistens in den ersten Minuten nach dem Hochladen. Das Schnäppchen-Radar sucht deshalb auf Vinted nach:
- **Marken**, z. B. „Carhartt“: alle neuen Carhartt-Artikel, aber nur echte Carhartt
- **angesagten Modellen und Styles**, z. B. „Nike Tech Fleece“, „Vintage Lederjacke“, „Vintage Trikot“, „Longchamp Le Pliage“, „Y2K“, „College Jacke“

Die Suchen heißen „Marke · …“ bzw. „Trend · …“. Gesucht wird genau der Begriff, **nicht** das Wort „Resale“. Das war in älteren Versionen nur der Name der Suche.

Gemeldet wird nur, was alle Bedingungen gleichzeitig erfüllt (Stufe „normal“):

1. **ganz frisch:** höchstens 10 Minuten online
2. **weit unter Marktpreis:** mindestens 40 % billiger als der übliche Preis
3. **wirklich einer der günstigsten:** billiger als 90 % aller vergleichbaren Angebote
4. **lohnt sich:** mindestens 15 € Gewinn nach Käuferschutz und Versand

```
🔥💰 SCHNÄPPCHEN · 62% unter Wert · Score 91/100
Nike Air Max 90 OG

💶 15,00 €  (mit Käuferschutz 16,50 €)
💰 Gewinn-Potenzial ca. +18,50 € (Weiterverkauf zum Marktpreis, nach Käuferschutz & Versand)
⚡ vor 1 Min. hochgeladen
📊 62% unter Marktpreis (Ø 40 € · 10 ähnliche Nike Schuhe)
📊 billigstes von 10 vergleichbaren Angeboten 🏆
🏷 Nike · Gr. 43 · Sehr gut
```

**Wie der Wert entsteht:**
1. **Schätzung ab dem ersten Artikel:** Kategorie (am Titel erkannt, ca. 50 Stück) × Preisklasse der Marke × Zustand × Kindergröße. Ein Beispiel: Pullover haben einen Grundpreis von 18 €, Designer-Marken den Faktor 4, „neu mit Etikett“ +35 %.
2. **Lernen:** Jeder gesehene Preis fließt ein, getrennt nach Marke und Kategorie. Eine Carhartt-Mütze wird also nie mit einer Carhartt-Jacke verglichen. Ab ca. 30 echten Vergleichspreisen zählen nur noch die echten Daten.
3. **Aufschläge:** 💎 Raritäten +20–60 %, 🔥 Trend-Modelle +10 %.

Bei unsicheren Schätzungen (unbekannte Marke, Elektronik, Sammelkarten …) verlangt der Bot **15 % mehr Rabatt** und schreibt „❔ Schätzung unsicher“ dazu. Mit `/wert carhartt detroit jacke vintage` kannst du jederzeit selbst schätzen lassen, auch mit einem Vinted-Link.

### 🎯 Schnäppchen-Stufe: wie streng gefiltert wird

| Stufe | online seit max. | unter Marktpreis | günstiger als | Gewinn mind. |
|---|---|---|---|---|
| `locker` | 20 Min. | 30 % | 75 % der Vergleichsangebote | 10 € |
| `normal` | 10 Min. | 40 % | 90 % der Vergleichsangebote | 15 € |
| `streng` | **5 Min.** | **50 %** | **95 %** der Vergleichsangebote | **20 €** |

Per Telegram umschalten: **`/stufe streng`**. Dann kommen wenige Meldungen, aber nur die allergünstigsten. `/stufe` zeigt die aktuelle Einstellung. In der `config.yaml` geht es mit `level: streng` im Abschnitt `resale:`.

### 🔥 Deine Trend-Liste: Marken + Modelle/Styles

Eingebaut sind:
- **Marken:** Carhartt, Stüssy, Arc'teryx, The North Face, Patagonia, Ralph Lauren, Lacoste, Stone Island, C.P. Company, Barbour, Levi's, Dickies, Moncler, Burberry, Miu Miu und Vivienne Westwood
- **Modelle & Styles:** Nike Tech Fleece, Nike ACG, Vintage Nike, Adidas Trainingsjacke, Ralph Lauren Strick, Polo Bear, Longchamp Le Pliage, Prada Nylon, Coach Tasche, Ed Hardy, Diesel vintage, Vintage Lederjacke, Vintage Trikot, College Jacke, Band Shirt vintage, Harley Davidson, Y2K, Vintage Levi's und Bootcut Jeans

Ändern kannst du die Liste per Telegram:

```
/trends                                    Liste anzeigen (✅ = wird beobachtet, ⭐ = von dir)
/trends plus jacquemus, vintage lederjacke Marken ODER Suchbegriffe hinzufügen – sofort aktiv
/trends minus nike, y2k                    entfernen
/trends an   ·   /trends aus               alle beobachten / stoppen
/marke carhartt bis 80 rabatt 50           eine Marke mit eigenen Grenzen beobachten
```

Eine Marke („Ganni“) beobachtet alle neuen Artikel dieser Marke. Ein Begriff („Ganni Tasche“) sucht genau danach, und zwar nur bei echter Ganni. Ein Begriff ohne Marke („Vintage Lederjacke“) akzeptiert jede Marke.

### 📡 Alles-Radar
`/radar an` prüft bei jedem Durchlauf zusätzlich die **neuesten Uploads auf ganz Vinted**, ganz ohne Suchbegriff. Gemeldet werden nur gefragte Marken, Trend-Modelle und Raritäten weit unter Wert. Fast Fashion und No-Name werden hier ignoriert. Mit `/radar an <Vinted-Link>` beschränkst du das Radar auf eine Kategorie, z. B. Herren-Jacken. In der config geht es mit `radar: true`.

Oder in der `config.yaml`:
```yaml
resale:
  enabled: true
  brands: [trends, Jacquemus, Ganni]   # Trend-Liste + eigene Marken
  level: streng                        # locker / normal / streng
  max_price: 250
  shipping_estimate: 5                 # Versandkosten für die Gewinn-Rechnung
  # min_profit: 30                     # einzelne Werte der Stufe überschreiben
```

Die Schnäppchen-Kriterien gibt es auch für normale Suchen:
`/neu salomon xt-6 bis 90 rabatt 35 günstiger 95 frisch 5` oder in der config `min_discount`, `min_cheaper_than`, `min_profit`, `max_age_minutes` und `min_condition`.

**Tipps:**
- **Weniger Einträge bedeuten schnellere Meldungen.** Bei den 33 eingebauten Trends dauert ein Durchlauf rund 1–1,5 Minuten, weil der Bot zwischen den Abfragen kurz wartet. Mit 10–15 Lieblingseinträgen bist du deutlich schneller.
- Findet ein Artikel mehrere Suchen gleichzeitig, wird er trotzdem nur **einmal** gemeldet.
- Je kleiner `interval_seconds` (z. B. 30–45), desto früher bist du dran. Zu klein führt aber zu Blockaden durch Vinted.
- Der „Marktpreis“ ist der Median der **Angebotspreise** auf Vinted. Verkauft wird oft etwas darunter. Rechne den Gewinn deshalb lieber vorsichtig.
- **Fakes:** Ist ein Luxus- oder Designerteil mehr als 75 % unter Wert, warnt der Bot „⚠️ Fake-Risiko“. Ab 85 % sortiert er es aus. Wörter wie „replica“ und „inspired“ fliegen sowieso raus. Eine echte Prüfung ersetzt das nicht.

```bash
./start.sh scan --suche trend       # sofort die besten aktuellen Deals der Trend-Suchen anzeigen
```

---

## Suchen festlegen

### In der `config.yaml`
```yaml
searches:
  - name: Air Max 90
    keywords: nike air max 90
    max_price: 60
    sizes: ["43", "44"]
    min_score: 50            # nur Deals ab Score 50 melden

  - name: Carhartt Jacken
    url: "https://www.vinted.de/catalog?search_text=carhartt%20jacke&brand_ids[]=362"
    max_price: 70
    market_price: 80         # optional: üblicher Preis → genauere Bewertung
```

**Tipp:** Stell die Suche auf vinted.de im Browser mit allen Filtern ein und kopier den Link aus der Adresszeile in `url:`. Der Bot übernimmt dann alle Filter.

| Feld | Bedeutung |
|---|---|
| `keywords` | Suchbegriff |
| `url` | Vinted-Such-Link (statt oder zusätzlich zu `keywords`) |
| `min_price` / `max_price` | Preisrahmen in € |
| `market_price` | typischer Preis. Ohne Angabe lernt der Bot ihn selbst aus den Suchergebnissen |
| `min_score` | nur Treffer ab diesem Deal-Score melden (0 = alle) |
| `sizes` | nur diese Größen, z. B. `["M", "L"]` oder `["43"]` |
| `brands` | nur diese Marken (strenger Abgleich mit der Marken-Angabe des Artikels, z. B. `[Carhartt, Stüssy]`) |
| `mode: resale` | Schnäppchen-Bewertung: Frische zählt mehr, Wert je Marke + Kategorie |
| `min_discount` | nur Artikel mind. x % unter Marktpreis |
| `min_profit` | nur Artikel mit mind. x € Gewinn-Potenzial |
| `max_age_minutes` | nur Artikel, die höchstens x Minuten online sind |
| `min_condition` | Mindest-Zustand, z. B. `sehr gut` |
| `min_cheaper_than` | nur Artikel, die günstiger sind als x % aller vergleichbaren Angebote |
| `must_contain` | diese Wörter müssen im Titel stehen |
| `exclude_words` | diese Wörter dürfen nicht im Titel stehen |
| `enabled: false` | Suche vorübergehend aus |

### Per Telegram (ohne Neustart)
```
/neu nike air max 90 bis 40 score 60
/neu carhartt jacke ab 20 bis 60 markt 80
/neu https://www.vinted.de/catalog?search_text=…   (Link mit Filtern)
/neu salomon xt-6 bis 90 rabatt 35 frisch 15
/marke stüssy    Marke beobachten    /trends   Trend-Liste
/trends plus ganni   eigene Trend-Marke    /stufe streng   nur die allergünstigsten
/groesse S M L   Größen    /ohne schuhe   Kategorie ausblenden    /raritaeten an   nur Raritäten
/preis carhartt jacken 90   eigener Marktpreis    /vorlieben   Gelerntes    /probelauf   Testlauf
/wert <Artikel oder Link>   Wert schätzen    /radar an   Alles-Radar
/suchen          alle Suchen mit Nummer
/pause 2         Suche 2 anhalten     /weiter 2   fortsetzen
/loeschen 2      Suche 2 löschen
/pause           alle Meldungen pausieren   /weiter   fortsetzen
/status          läuft alles?
```

---

## So entsteht der Deal-Score (0–100)

| Teil | Punkte | Wie |
|---|---|---|
| **Preis** | bis 60 | Vergleich mit dem Marktpreis: 50 % darunter = volle Punktzahl, teurer = 0 |
| **Zustand** | bis 20 | Neu mit Etikett 20 · Neu 17 · Sehr gut 14 · Gut 9 · Zufriedenstellend 4 |
| **Frische** | bis 10 | in den letzten 5 Minuten eingestellt = 10 (wer zuerst kommt, kauft zuerst) |
| **Beliebtheit** | bis 10 | viele Favoriten kurz nach dem Einstellen = begehrt |

**Schnäppchen-Suchen** (Marken & Trends) werden anders gewichtet: **Preis 55** (erst ab großen Rabatten, 60 % darunter = volle Punktzahl), **Frische 25** (≤ 2 Min. = 25, ≤ 5 Min. = 20, ≤ 10 Min. = 14), Zustand 10, Beliebtheit 10.

Ab **75 Punkten** gibt's 🔥 **TOP-DEAL** (einstellbar mit `top_deal_score`).
Den Marktpreis lernt der Bot aus allen Artikeln, die er sieht (Median), getrennt nach Produkttyp. Wenn du ihn kennst, trag ihn besser als `market_price` ein.

---

## Kaufen und Angebote

**🛒 Jetzt kaufen** öffnet direkt den Vinted-Kaufvorgang des Artikels. Bezahlen bestätigst du dort selbst.
Der Bot kauft absichtlich **nicht automatisch**. Ein automatischer Kauf mit deinem Geld wäre bei einem Fehlalarm teuer, und Vinted sperrt dafür Konten.

**💸 Angebote senden (experimentell):**
Ohne Einrichtung öffnet der Button den Artikel, und du tippst dort auf „Preis vorschlagen“.
Mit Einrichtung schickt der Bot das Angebot selbst, nachdem du in Telegram auf **„✅ Ja, senden“** getippt hast:

1. Am PC auf vinted.de **einloggen**.
2. `F12` drücken → Reiter **Netzwerk** → Seite neu laden → oben die erste Anfrage anklicken.
3. Unter **Anfrage-Header** den kompletten Wert von **`Cookie:`** kopieren.
4. In `config.yaml`:
   ```yaml
   account:
     enabled: true
     cookies: "access_token_web=…; refresh_token_web=…; anon_id=…; …"
   ```

> ⚠️ Die Cookies sind so viel wert wie dein Passwort. Gib die `config.yaml` deshalb nie weiter und lade sie nirgends hoch. Sie steht schon in der `.gitignore`.
> Vinted erlaubt höchstens 25 Angebote pro Tag und höchstens 40 % Nachlass. Daran hält sich der Bot.

---

## Rund um die Uhr laufen lassen

Der Bot meldet nur, solange er läuft. Dafür gibt es drei Möglichkeiten:

- **PC / Laptop:** `start.bat` bzw. `start.sh` offen lassen. Der Rechner darf nicht in den Ruhezustand gehen.
- **Raspberry Pi (empfohlen, ca. 3 W Strom):** Ordner kopieren, `./start.sh` einmal einrichten und dann als Dienst starten, z. B. mit `tmux` oder `systemd`.
- **Docker / Server:**
  ```bash
  mkdir data && cp config.example.yaml data/config.yaml   # bearbeiten!
  docker compose up -d
  ```

Die Datenbank `vinted_bot.db` (gesehene Artikel, Preise, per Telegram angelegte Suchen) liegt neben der `config.yaml`.

---

## 🧠 Training: Größe, Kategorien, Raritäten und dein Geschmack

### 📏 Größe & Kategorien
Standardmäßig meldet das Schnäppchen-Radar nur **S, M und L** und **keine Schuhe**. Artikel ohne Größe (Taschen, Caps, One Size) kommen trotzdem durch. Jeans- und Zahlengrößen werden umgerechnet: W30 L32 ≈ M, W28 ≈ S/M, 38 ≈ M (Damen), 48 ≈ M (Herren). Wer es genau will, gibt seine Bundweite an, z. B. `/groesse M W30 W31`.

```
/groesse S M L        deine Größen (auch Zahlen, z. B. /groesse M 32 für Jeans)
/groesse alle         keine Größen-Einschränkung
/ohne schuhe, caps    Kategorien ausblenden
/mit schuhe           wieder einblenden
/kategorien           alle Kategorien mit ✅/🚫 anzeigen
```

### 💎 Raritäten
Der Bot erkennt seltene Stücke am Titel:
- **allgemein:** vintage, 90er/80er, Y2K, Made in USA/Italy/England/Canada/Japan, West Germany, Deadstock, Single Stitch, Sample
- **begehrte Modelle je Marke:** z. B. Carhartt Detroit/Santa Fe, Stüssy 8 Ball/World Tour, Arc'teryx Veilance/LEAF, Stone Island Ghost/Shadow Project, Patagonia Retro X/Deep Pile, Ralph Lauren Polo Sport/RRL, Levi's Big E, Nike ACG

Raritäten werden mit **💎 RARITÄT** markiert. Sie bekommen Bonuspunkte, und ihr Wert wird je nach Seltenheit 20–60 % über dem normalen Marktpreis angesetzt. „vintage“ allein reicht nicht, das steht bei Vinted in fast jedem zweiten Titel.

`/raritaeten an` → **nur noch Raritäten** melden · `/raritaeten aus` → wieder alles

### 🧠 Vorwissen & eigene Preise
Der Bot startet mit eingebautem Preiswissen. Dadurch kann er vom ersten Artikel an vergleichen:
- `vinted_bot/data/brands.json`: über 400 Marken in 7 Preisklassen (Fast Fashion, Standard, Premium, Streetwear, Outdoor, Designer, Luxus). Eigene Marken trägst du einfach in die passende Liste ein.
- `vinted_bot/catalog.py`: ca. 50 Kategorien mit Grundpreis und den Faktoren je Preisklasse
- `vinted_bot/data/market_prices.json`: genauere Werte für die wichtigsten Trend-Marken, z. B. Carhartt-Jacken ca. 75 €, Arc'teryx-Jacken ca. 200 €

Das sind Schätzungen. Der Bot mischt sie mit den echten Preisen, die er sieht, und ab etwa 30 echten Vergleichspreisen zählen nur noch die echten Daten.

Wenn du es besser weißt: `/preis carhartt jacken 90` → ab jetzt rechnet er mit 90 €. `/preis` zeigt deine Werte.

### 👍 / 👎 – der Bot lernt deinen Geschmack
Unter jeder Meldung gibt es **👍 Guter Find** und **👎 Nicht mein Ding**:
- Marken und Kategorien, die du magst, bekommen **mehr Punkte**.
- Nach **3× 👎** für eine Kategorie (z. B. Caps) blendet der Bot sie **automatisch aus**. Mit `/mit caps` kommt sie zurück.
- Nach **3× 👎 für eine Marke** sortiert er Artikel dieser Marke aus. Ungeliebte Kombinationen wie „Nike-Caps“ fliegen schon nach 2× 👎 raus.
- `/vorlieben` zeigt, was er gelernt hat. `/vorlieben reset` vergisst alles.

### 🧪 Probelauf mit Musterdaten
Ohne Vinted zu fragen zeigt der Bot, was er mit **deinen aktuellen Einstellungen** melden würde. Er nutzt dafür einen künstlichen, aber realistischen Datensatz: über 600 Angebote aus 9 Marken plus eine Trend-Suche.

- **8 echte Finds**, z. B. vintage Carhartt Detroit für 45 €, eine Miu-Miu-Tasche für 160 €, eine No-Name-Vintage-Lederjacke für 12 €
- **12 Fallen**: Schuhe, Fakes, „Miu Miu“ für 35 €, XL, Kindergröße, defekt, Normalpreis, H&M ohne Gewinn, schon lange online

- **Telegram:** `/probelauf`
- **Windows:** Doppelklick auf `probelauf.bat`

Mit den Standardeinstellungen (Stufe „normal“) erkennt er in 30 verschiedenen Zufalls-Märkten **239 von 240 Finds** und meldet **keine einzige Falle**.

---

## 🔄 Bot aktualisieren (Einstellungen bleiben erhalten)

1. Neue Version als ZIP herunterladen und entpacken, wie bei der Einrichtung.
2. Aus dem **alten** `vinted-bot`-Ordner diese zwei Dateien in den **neuen** kopieren:
   - `config.yaml` (deine Einstellungen und der Telegram-Token)
   - `vinted_bot.db` (gelernte Marktpreise, Trend-Marken und per Telegram angelegte Suchen)
3. Im neuen Ordner `start.bat` starten. Beim ersten Mal richtet er sich wieder 1–2 Minuten ein.

Der alte Ordner kann danach weg.

---

## Probleme?

| Problem | Lösung |
|---|---|
| „Vinted blockiert gerade die Anfragen (403)“ | `interval_seconds` erhöhen (z. B. 120) und weniger Suchen gleichzeitig. Bei Bedarf `proxy:` eintragen. Der Bot versucht es automatisch weiter |
| Keine Meldungen | Normal direkt nach dem Start: Erst ab dem zweiten Durchlauf kommen neue Artikel. Mit `scan` prüfen, ob die Suche überhaupt etwas findet. `min_score` evtl. senken |
| Telegram meldet nichts | `test-notify` ausführen. Wurde dem Bot schon `/start` geschrieben? Stimmt die `chat_id`? |
| Angebot schlägt fehl | Cookies abgelaufen → neu kopieren. Die Meldung enthält einen Link, über den du manuell anbieten kannst |

Mehr Details zeigt `./start.sh -v`.

## Wichtig zu wissen

- Vinted hat **keine offizielle Schnittstelle**. Der Bot nutzt dieselben Abfragen wie die Vinted-Webseite. Ändert Vinted daran etwas, muss der Bot eventuell angepasst werden.
- Vinteds Nutzungsbedingungen erlauben keine automatisierten Zugriffe. Nutzung auf eigene Verantwortung: Intervall nicht zu klein wählen, nur für den privaten Gebrauch.

## Entwicklung

```bash
pip install -r requirements.txt pytest
python -m pytest -q
```
