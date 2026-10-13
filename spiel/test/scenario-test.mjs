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

for (const id of ids) {
  const sc = SCENARIOS.find((s) => s.id === id);
  if (!sc) { console.log('Unbekanntes Szenario', id); fails++; continue; }
  const t0 = Date.now();
  seedMathRandom(4711);
  const g = new Game(scenarioOptions(id));
  const bot = new Bot(g, { status: scenarioStatus, banned: sc.banned, ...(BOT_OPTS[id] || {}) });
  g.speed = 1; // Briefing gelesen, Spiel läuft
  if (!g.buildings.size) bot.start();
  const st0 = scenarioStatus(g);
  console.log(`\n=== ${sc.name} (${id}), ${sc.days} Tage, Start ${Math.round(g.money).toLocaleString('de-DE')} € ===`);
  console.log('  Start:', goalLine(st0));
  ok(!st0.goals.every((x) => x.done), `${id}: nicht schon beim Start gewonnen`);
  let end = null, best = st0.goals.map((x) => x.progress);
  for (let d = 1; d <= sc.days + 1; d++) {
    runDay(g);
    bot.daily();
    const st = scenarioStatus(g);
    st.goals.forEach((x, k) => { best[k] = Math.max(best[k], x.progress); });
    if (!quiet && d % 10 === 0) console.log(`  Tag ${String(d).padStart(2)}: ${goalLine(st)} · Geld ${Math.round(g.money).toLocaleString('de-DE')}`);
    if (st.st.status !== 'running') { end = { status: st.st.status, day: st.elapsed, st }; break; }
  }
  const st = scenarioStatus(g);
  end ||= { status: st.st.status, day: st.elapsed, st };
  console.log(`  Ergebnis: ${end.status === 'won' ? 'GEWONNEN' : end.status === 'lost' ? 'VERLOREN' : 'offen'} nach ${end.day} Tagen · ${goalLine(st)} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (!quiet || report) console.log(`  Glück Wohnen ${g.stats.happiness.toFixed(0)} %: ${factors(g)} | Steuern ${Object.values(g.taxes).join('/')} | Bilanz ${Math.round(g.lastBudget.net)} €/Tag`);
  results.push({ id, name: sc.name, status: end.status, day: end.day, days: sc.days, best: best.map((v) => Math.round(v * 100)) });
  ok(end.status === 'won', `${id}: mit gutem Spiel in ${sc.days} Tagen gewinnbar`);
  ok(end.status !== 'won' || end.day >= Math.min(12, sc.days * 0.25), `${id}: nicht geschenkt (Sieg frühestens nach einem Viertel der Zeit, war Tag ${end.day})`);
}
console.log('\nZusammenfassung:');
for (const r of results) console.log(`  ${r.name.padEnd(20)} ${r.status === 'won' ? `gewonnen an Tag ${r.day}/${r.days}` : `${r.status} (Bestwerte ${r.best.join(' / ')} %)`}`);
console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen` : '\nAlle Prüfungen bestanden');
process.exit(fails ? 1 : 0);
