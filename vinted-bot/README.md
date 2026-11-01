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
| 💰 **Resale-Radar** | beobachtet ganze Marken (z. B. eingebaute Trend-Liste) und meldet nur **ganz frisch hochgeladene** Artikel, die **weit unter Marktpreis** liegen, mit geschätztem Gewinn |
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

## 💰 Resale-Radar: frische Schnäppchen zum Weiterverkaufen

Der Resale-Modus ist für alle, die günstig kaufen und teurer weiterverkaufen wollen. Er beobachtet **ganze Marken** und meldet nur Artikel, die alle drei Bedingungen erfüllen:

1. **ganz frisch:** höchstens 10 Minuten online
2. **weit unter Marktpreis:** mindestens 40 % billiger
3. **lohnt sich:** mindestens 15 € Gewinn nach Käuferschutz und Versand

```
🔥💰 RESALE-DEAL · 62% unter Markt · Score 91/100
Nike Air Max 90 OG

💶 15,00 €  (mit Käuferschutz 16,50 €)
💰 Gewinn-Potenzial ca. +18,50 € (Weiterverkauf zum Marktpreis, nach Käuferschutz & Versand)
⚡ vor 1 Min. hochgeladen
📊 62% unter Marktpreis (Ø 40 € · 10 ähnliche Nike Schuhe)
🏷 Nike · Gr. 43 · Sehr gut
```

**Wie der Marktpreis entsteht:** Der Bot sammelt die Preise aller Artikel, die er sieht, getrennt nach **Marke und Produkttyp**. Er erkennt Jacken, Hoodies, Pullover, Shirts, Hosen, Schuhe, Mützen, Taschen und mehr am Titel. Eine Carhartt-Mütze für 20 € wird also nie mit einer Carhartt-Jacke für 100 € verglichen. Gemeldet wird erst, wenn mindestens 5 Vergleichspreise da sind. Nach dem Start braucht der Bot deshalb ein paar Durchläufe zum Lernen.

### Einschalten in der `config.yaml`
```yaml
resale:
  enabled: true
  brands: trends            # eingebaute Trend-Liste – oder eigene: [Carhartt, Stüssy, Arc'teryx]
  max_age_minutes: 10       # nur Artikel, die höchstens 10 Min. online sind
  min_discount: 40          # mind. 40 % unter Marktpreis
  min_profit: 15            # mind. 15 € Gewinn-Potenzial
  min_condition: gut        # "zufriedenstellend" ignorieren
  max_price: 250
  shipping_estimate: 5      # Versandkosten für die Gewinn-Rechnung
```

**Eingebaute Trend-Marken** (`brands: trends`): Carhartt, Stüssy, Arc'teryx, Salomon, The North Face, Patagonia, Ralph Lauren, Lacoste, Stone Island, C.P. Company, New Balance, Asics, Levi's, Dickies, Barbour, Nike und Adidas. Trends ändern sich, deshalb kannst du die Liste jederzeit durch deine eigene ersetzen.

### Oder per Telegram
```
/marke stone island                     eine Marke beobachten
/marke carhartt bis 80 rabatt 50 gewinn 20 frisch 5
/trends                                 Trend-Liste anzeigen
/trends an   ·   /trends aus            alle Trend-Marken beobachten / entfernen
```

Die Resale-Kriterien gibt es auch für normale Suchen:
`/neu salomon xt-6 bis 90 rabatt 35 frisch 15` oder in der config `min_discount`, `min_profit`, `max_age_minutes` und `min_condition`.

**Tipps:**
- Je kleiner `interval_seconds` (z. B. 30–45), desto früher bist du dran. Zu klein führt aber zu Blockaden durch Vinted.
- Bei 17 Trend-Marken dauert ein Durchlauf rund eine Minute, weil der Bot zwischen den Abfragen kurz wartet. Weniger Marken heißt schnellere Meldungen.
- Der „Marktpreis“ ist der Median der **Angebotspreise** auf Vinted. Verkauft wird oft etwas darunter. Rechne den Gewinn deshalb lieber vorsichtig.
- Bei Luxusmarken auf Fakes achten. Wörter wie „replica“ filtert der Bot schon raus, echte Prüfung ersetzt das nicht.

```bash
./start.sh scan --suche resale      # sofort die besten aktuellen Resale-Deals anzeigen
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
| `mode: resale` | Resale-Bewertung: Frische zählt mehr, Marktpreis je Marke + Produkttyp |
| `min_discount` | nur Artikel mind. x % unter Marktpreis |
| `min_profit` | nur Artikel mit mind. x € Gewinn-Potenzial |
| `max_age_minutes` | nur Artikel, die höchstens x Minuten online sind |
| `min_condition` | Mindest-Zustand, z. B. `sehr gut` |
| `must_contain` | diese Wörter müssen im Titel stehen |
| `exclude_words` | diese Wörter dürfen nicht im Titel stehen |
| `enabled: false` | Suche vorübergehend aus |

### Per Telegram (ohne Neustart)
```
/neu nike air max 90 bis 40 score 60
/neu carhartt jacke ab 20 bis 60 markt 80
/neu https://www.vinted.de/catalog?search_text=…   (Link mit Filtern)
/neu salomon xt-6 bis 90 rabatt 35 frisch 15
/marke stüssy    Resale-Radar für eine Marke    /trends   Trend-Marken
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

**Resale-Suchen** werden anders gewichtet: **Preis 55** (erst ab großen Rabatten, 60 % darunter = volle Punktzahl), **Frische 25** (≤ 2 Min. = 25, ≤ 5 Min. = 20, ≤ 10 Min. = 14), Zustand 10, Beliebtheit 10.

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
