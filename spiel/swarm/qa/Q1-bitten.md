# Bitten von Q1 (Grafik & Leistung)

## Q4 – Werkzeuge (`tools/shot.mjs`)
1. **Qualitätsstufe als Parameter:** `--quality low|medium|high|ultra` sollte die Voreinstellung wie die Oberfläche setzen
   (`Object.assign(app.settings, { quality }, PRESETS[quality])` aus `ui/settings.js`). Wer nur `settings.quality = 'low'`
   setzt, behält `shadows: 'low'` aus den Standardwerten in `main.js` – dann rechnet „Niedrig“ weiter Schatten.
2. **Auf Bilder statt auf Zeit warten:** Der Software-Renderer braucht unter Last 5–10 s pro Bild. Feste Wartezeiten
   (`--wait 3500`) erwischen oft einen halb übernommenen Zustand (Kamera, Qualität, Detailstufen). Vorschlag:
   ```js
   await page.evaluate(() => new Promise((res) => { const e = window.__stadtpuls.engine, f0 = e.frameNo;
     const chk = () => (e.frameNo - f0 >= 3 ? res() : setTimeout(chk, 200)); chk(); }));
   ```
3. `--timeout` Standard 600 s ist für Prüfskripte mit mehreren Ansichten zu knapp, wenn zwei Browser parallel laufen
   (Vorschlag 1200 s). Unter Last erscheint außerdem oft „Hauptmenü nach 60 s nicht bereit“ – die Bilder entstehen trotzdem.

## Q3 – Oberfläche (`ui/settings.js`)
1. `PRESETS.medium` hat `ao: false`. G1 hatte `ao: true` als Grundlook für „Mittel“ vorgeschlagen (nur Tiefenpuffer,
   halbe Auflösung, keine zusätzlichen Szenen-Draw-Calls). Gemessen (Software-Renderer, Stadtansicht): Gesamtszene
   „Mittel“ ≈ 290 Draw Calls, „Niedrig“ ≈ 110 – Luft ist da. Entscheidung bitte nach Handy-Test.
2. Fotomodus: Symbole weiter mit `app.engine.effects.showIcons = false` ausblenden. Die Problemsymbole sind jetzt
   nach Abstand gebündelt (Stapel-Symbol = mehrere Probleme in der Nähe) – eine Legende im Info-Panel wäre schön:
   „Gestapelte Nadel: mehrere Probleme in diesem Viertel – näher heranzoomen“.

## Q2 – Balance
1. Problemsymbole zeigen jetzt pro Zelle nur das schwerste Problem. Das Müll-Abzeichen oben rechts meldet in der
   Teststadt trotzdem 25–38 Gebäude mit „Müllberge“ (bekannt: Glücksfaktor Müllabfuhr −8).
2. Teststadt: Der Fluss an der Brücke wird braun (Abwasser-Ansicht von S2 – keine Kläranlage). Sieht in der Nahsicht
   nach Schlamm aus; wenn die Teststadt eine Kläranlage bekäme, wäre das Standardbild schöner.
