#!/bin/sh
# Alle Prüfstände nacheinander (Q2). Aufruf aus spiel/: sh test/run-all.sh – endet mit Code 1, wenn einer rot ist.
cd "$(dirname "$0")/.." || exit 1
fail=0
for t in sim-test.mjs weather-test.mjs citizens-test.mjs industry-test.mjs transport-test.mjs progression-test.mjs save-test.mjs takt-test.mjs linienplan-test.mjs bahn-balance.mjs playthrough-test.mjs scenario-test.mjs einstieg-test.mjs autoq-test.mjs fahrt-test.mjs; do
  echo "== $t"
  if node "test/$t" > "${TMPDIR:-/tmp}/stadtpuls-$t.log" 2>&1; then tail -n 1 "${TMPDIR:-/tmp}/stadtpuls-$t.log"; else echo "ROT (Ausgabe: ${TMPDIR:-/tmp}/stadtpuls-$t.log)"; tail -n 3 "${TMPDIR:-/tmp}/stadtpuls-$t.log"; fail=1; fi
done
[ -f src/audio/logiktest.js ] && { echo "== audio/logiktest.js"; node src/audio/logiktest.js 2>&1 | tail -n 1; }
exit $fail
