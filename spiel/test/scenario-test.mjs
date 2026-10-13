// Prüfstand „Szenarien" (Q2): Der Spieler-Bot spielt jedes Szenario mit gutem, aber menschlichem Spiel
// und prüft, ob es in der vorgegebenen Zeit zu gewinnen ist (und nicht schon am ersten Tag).
// Aufruf: node test/scenario-test.mjs [ids=alle] [--quiet] [--report] (--report: nur messen, keine Prüfungen)
import { Game } from '../src/sim/game.js';
import { SCENARIOS, scenarioOptions, scenarioStatus } from '../src/sim/systems/progression.js';
import { happinessFactors } from '../src/sim/services.js';
import { Bot, runDay, seedMathRandom } from './bot.mjs';

function factors(g) {
  const agg = {}; let n = 0;
  for (const b of g.buildings.values()) {
    if (b.zone !== 1 || b.abandoned || b.construct < 1) continue;
    n++;
    const out = []; happinessFactors(g, b, out);
    for (const [l, v] of out) agg[l] = (agg[l] || 0) + v;
  }
  return Object.entries(agg).map(([l, v]) => [l, v / Math.max(1, n)]).filter(([, v]) => Math.abs(v) >= 0.7).sort((a, b) => a[1] - b[1]).map(([l, v]) => `${l} ${v.toFixed(1)}`).join(', ');
}

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const quiet = process.argv.includes('--quiet');
const report = process.argv.includes('--report');
// Inselbrücken braucht Brückenbau, Metro-Modus hat kein Ziel – beides spielt der Bot nicht
const SKIP = new Set(['metro', 'inseln']);
const ids = args[0] ? args[0].split(',') : SCENARIOS.filter((s) => !SKIP.has(s.id)).map((s) => s.id);
let fails = 0;
const ok = (c, msg) => { if (report) return; if (!c) { fails++; console.log('  FEHLER: ' + msg); } else if (!quiet) console.log('  ok: ' + msg); };
const goalLine = (st) => st.goals.map((x) => `${x.goal.label}: ${x.text}${x.done ? ' ✓' : ''}`).join(' | ');
const results = [];
// Strategie-Hinweise wie aus dem Briefing des Szenarios (was ein Mensch daraus ableiten würde)
const BOT_OPTS = {
  idylle: { transit: false, buses: false }, // „Klein, fein und glücklich" – ein Dorf braucht keine Hochbahn
};

// Ein Durchgang mit festem Zufall (Verkehr). Der Bot ist kein perfekter Spieler: Verliert er knapp, darf er es
// mit anderen Wochenkarten ein zweites Mal versuchen – gewinnbar heißt: mindestens einer der Versuche gewinnt.
function playOnce(sc, seed, cardPick = 0) {
  const t0 = Date.now();
  seedMathRandom(seed);
  const g = new Game(scenarioOptions(sc.id));
  const bot = new Bot(g, { status: scenarioStatus, banned: sc.banned, cardPick, ...(BOT_OPTS[sc.id] || {}) });
  g.speed = 1; // Briefing gelesen, Spiel läuft
  if (!g.buildings.size) bot.start();
  const st0 = scenarioStatus(g);
  console.log(`\n=== ${sc.name} (${sc.id}), ${sc.days} Tage, Start ${Math.round(g.money).toLocaleString('de-DE')} €, Zufall ${seed} ===`);
  console.log('  Start:', goalLine(st0));
  const atStart = st0.goals.every((x) => x.done);
  let end = null;
  const best = st0.goals.map((x) => x.progress);
  for (let d = 1; d <= sc.days + 1; d++) {
    runDay(g);
    bot.daily();
    const st = scenarioStatus(g);
    st.goals.forEach((x, k) => { best[k] = Math.max(best[k], x.progress); });
    if (!quiet && d % 10 === 0) console.log(`  Tag ${String(d).padStart(2)}: ${goalLine(st)} · Geld ${Math.round(g.money).toLocaleString('de-DE')}`);
    if (st.st.status !== 'running') { end = { status: st.st.status, day: st.elapsed }; break; }
  }
  const st = scenarioStatus(g);
  end ||= { status: st.st.status, day: st.elapsed };
  console.log(`  Ergebnis: ${end.status === 'won' ? 'GEWONNEN' : end.status === 'lost' ? 'VERLOREN' : 'offen'} nach ${end.day} Tagen · ${goalLine(st)} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (!quiet || report) console.log(`  Glück Wohnen ${g.stats.happiness.toFixed(0)} %: ${factors(g)} | Steuern ${Object.values(g.taxes).join('/')} | Bilanz ${Math.round(g.lastBudget.net)} €/Tag`);
  return { ...end, atStart, best: best.map((v) => Math.round(v * 100)) };
}

for (const id of ids) {
  const sc = SCENARIOS.find((s) => s.id === id);
  if (!sc) { console.log('Unbekanntes Szenario', id); fails++; continue; }
  const runs = [playOnce(sc, 4711)];
  if (runs[0].status !== 'won') runs.push(playOnce(sc, 99, 1)); // zweiter Versuch: andere Wochenkarten
  const won = runs.find((r) => r.status === 'won');
  const r = won || runs[runs.length - 1];
  results.push({ id, name: sc.name, status: r.status, day: r.day, days: sc.days, best: r.best, tries: runs.length });
  ok(!runs[0].atStart, `${id}: nicht schon beim Start gewonnen`);
  ok(!!won, `${id}: mit gutem Spiel in ${sc.days} Tagen gewinnbar`);
  for (const x of runs) if (x.status === 'won') ok(x.day >= Math.min(12, sc.days * 0.25), `${id}: nicht geschenkt (Sieg frühestens nach einem Viertel der Zeit, war Tag ${x.day})`);
}
console.log('\nZusammenfassung:');
for (const r of results) console.log(`  ${r.name.padEnd(20)} ${r.status === 'won' ? `gewonnen an Tag ${r.day}/${r.days}` : `${r.status} (Bestwerte ${r.best.join(' / ')} %)`}${r.tries > 1 ? ' (2. Versuch)' : ''}`);
console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen` : '\nAlle Prüfungen bestanden');
process.exit(fails ? 1 : 0);
