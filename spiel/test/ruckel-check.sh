#!/bin/sh
# Ruckel-Prüfung (Megastadt auf dem iPad, nachgestellt im kopflosen Chromium): Zoomen, Schwenken, Drehen, Untergrund,
# Zeitraffer; prüft längste Bilder (JS-Zeit), Flackern der Detailstufen und die Zeit bis zum vollen Detail.
# Grenzwerte und Messung: tools/ruckel.mjs (check). Dauert je Spielstand etwa 4–6 Minuten (Software-GPU) und ist
# deshalb nicht Teil von run-all.sh; auf einer stark ausgelasteten Maschine schwanken die Bildzeiten.
#
# Aufruf aus spiel/:  sh test/ruckel-check.sh [spielstand.json …]   (ohne Angabe: saves/megastadt.json)
# Umgebung: RK_PHASES=zoomin,panlow,… (Auswahl), RK_MAX_MS, RK_MAX_OVER, RK_FULL_MS, RK_AT2, RK_MAX_FLIPS (Grenzen),
#           RK_SHEET=bild.png (Kontaktbogen), RK_JSON=werte.json (Rohdaten)
cd "$(dirname "$0")/.." || exit 1
[ -f dist/stadtpuls.js ] || { echo "dist/stadtpuls.js fehlt – erst npm run build"; exit 1; }
[ $# -gt 0 ] || set -- saves/megastadt.json
fail=0
for save in "$@"; do
  echo "== $save"
  log="${TMPDIR:-/tmp}/stadtpuls-ruckel-$(basename "$save" .json).log"
  SHOT_ARGS="${SHOT_ARGS:---enable-precise-memory-info}" RK_SAVE="$save" RK_CHECK=1 node tools/shot.mjs --scenario menu --ua ipad --dpr 2 --gpu "Apple GPU" --w 1180 --h 820 \
    --quality auto --eval tools/ruckel.mjs --out "${TMPDIR:-/tmp}/stadtpuls-ruckel.png" --timeout 3000 > "$log" 2>&1
  if grep -q '^RUCKEL GRÜN' "$log"; then
    echo "GRÜN"
  else
    fail=1
    if grep -q '^RUCKEL ROT' "$log"; then grep '^RUCKEL ROT' "$log" | cut -c1-2000; else echo "ROT (kein Ergebnis, Ausgabe: $log)"; tail -n 5 "$log"; fi
  fi
  grep -E '^\[[0-9]+ s\] [a-z]+: ' "$log" | sed -E 's/"parts".*//' | cut -c1-220
done
exit $fail
