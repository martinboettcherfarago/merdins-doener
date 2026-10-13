// Prüfstand „Durchspielen" (Q2): Ein Bot spielt ein normales neues Spiel wie ein Mensch und misst die Spielkurve.
// Aufruf: node test/playthrough-test.mjs [tage=75] [karten=river,coast] [seed=7] [--quiet]
import { Game } from '../src/sim/game.js';
import { happinessFactors } from '../src/sim/services.js';
import { Z, MILESTONES } from '../src/config.js';
import { Bot, runDay } from './bot.mjs';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const quiet = process.argv.includes('--quiet');
const days = +(args[0] || 75);
const maps = (args[1] || 'river,coast').split(',');
const seeds = (args[2] || '7').split(',').map(Number);
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('  FEHLER: ' + msg); } else if (!quiet) console.log('  ok: ' + msg); };
const fmt = (v) => Math.round(v).toLocaleString('de-DE');

function factorAvg(g, zone = Z.RES) {
  const agg = {}; let n = 0;
  for (const b of g.buildings.values()) {
    if (b.zone !== zone || b.abandoned || b.construct < 1) continue;
    n++;
    const out = []; happinessFactors(g, b, out);
    for (const [l, v] of out) agg[l] = (agg[l] || 0) + v;
  }
  return Object.entries(agg).map(([l, v]) => [l, v / Math.max(1, n)]).sort((a, b) => a[1] - b[1]);
}
const fstr = (arr, k = 6) => arr.filter(([, v]) => Math.abs(v) >= 0.5).slice(0, k).map(([l, v]) => `${l} ${v.toFixed(1)}`).join(', ');

const summary = [];
for (const map of maps) for (const seed of seeds) {
  const g = new Game({ size: 96, seed, mapType: map, difficulty: 'normal', name: 'Botstadt' });
  const bot = new Bot(g, { naive: process.argv.includes('--naive') });
  let bankrupt = false;
  g.on('bankrupt', () => { bankrupt = true; });
  bot.start();
  console.log(`\n=== ${map} (Saat ${seed}), ${days} Tage, Start ${fmt(g.money)} € ===`);
  const rec = [];
  let maxPop = 0, minMoney = g.money, negDays = 0, maxNeg = 0, spiral = [], lowHappy = 0, maxLow = 0;
  const t0 = Date.now();
  const snap = {};
  for (let d = 1; d <= days; d++) {
    runDay(g);
    bot.daily();
    const s = g.stats, C = g.ext.citizens?.stats || {};
    const r = { d, pop: s.pop, money: g.money, net: g.lastBudget.net, happy: s.happiness, ab: s.abandoned, ms: g.milestone, riders: s.ridersToday, bus: g.ext.transport?.day?.riders || 0, out: C.moveOut || 0, unemp: s.unemployment, flow: s.trafficFlow };
    rec.push(r);
    maxPop = Math.max(maxPop, s.pop);
    minMoney = Math.min(minMoney, g.money);
    negDays = g.money < 0 ? negDays + 1 : 0; maxNeg = Math.max(maxNeg, negDays);
    lowHappy = s.happiness < 40 && s.pop > 300 ? lowHappy + 1 : 0; maxLow = Math.max(maxLow, lowHappy);
    if (d > 10 && s.pop < maxPop * 0.85) spiral.push(d);
    if (d === 15 || d === 30 || d === 60 || d === days) snap[d] = fstr(factorAvg(g));
    if (!quiet && (d % 5 === 0 || d === days)) {
      console.log(`Tag ${String(d).padStart(3)} Einw ${String(s.pop).padStart(5)} Geld ${String(fmt(g.money)).padStart(8)} Bilanz ${String(fmt(r.net)).padStart(6)} Glück ${s.happiness.toFixed(0)} AL ${(s.unemployment * 100).toFixed(0)}% verl ${s.abandoned} MS ${g.milestone} Nachfr W${g.demand[1].toFixed(0)} G${g.demand[2].toFixed(0)} I${g.demand[3].toFixed(0)} B${g.demand[4].toFixed(0)} Puls ${s.ridersToday} Bus ${r.bus} Wegzug ${Math.round(r.out)} Fluss ${(s.trafficFlow * 100).toFixed(0)}%`);
    }
    if (g.gameOver) { console.log('  Spiel vorbei an Tag', d); break; }
  }
  const last = rec[rec.length - 1];
  const at = (d) => rec[Math.min(rec.length, d) - 1];
  console.log('Laufzeit', ((Date.now() - t0) / 1000).toFixed(1), 's');
  console.log('Meilensteine (Tag):', Object.entries(bot.unlockDay).map(([n, d]) => `${n} ${d}`).join(', ') || 'keine');
  console.log('Gebaut:', Object.entries(bot.count).map(([k, v]) => `${k} ${v}`).join(', '));
  for (const [d, t] of Object.entries(snap)) console.log(`Glücksfaktoren Wohnen Tag ${d}: ${t}`);
  console.log('Gewerbe:', fstr(factorAvg(g, Z.COM), 5), '| Industrie:', fstr(factorAvg(g, Z.IND), 5));
  const B = g.lastBudget;
  const top = (o) => Object.entries(o).filter(([, v]) => Math.abs(v) >= 1).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 8).map(([k, v]) => `${k} ${fmt(v)}`).join(', ');
  console.log('Einnahmen:', top(B.inc));
  console.log('Ausgaben:', top(B.exp));
  if (!quiet) console.log('Bot-Protokoll (letzte):', bot.log.slice(-8).join(' | '));
  const S = { map, seed, d15: at(15)?.pop, d30: at(30)?.pop, d60: at(60)?.pop, end: last.pop, money: last.money, minMoney, happy: last.happy, ab: last.ab, ms: last.ms, riders: last.riders, spiral: spiral.length, maxNeg, maxLow, bankrupt };
  summary.push(S);
  // Erwartungen an ein gewinnbares, faires Spiel
  ok(!bankrupt && !g.gameOver, `${map}: kein Bankrott`);
  ok(maxNeg <= 4, `${map}: höchstens 4 Tage am Stück im Minus (war ${maxNeg})`);
  ok((at(30)?.pop || 0) >= 1000, `${map}: nach 30 Tagen ≥ 1.000 Einwohner (${fmt(at(30)?.pop || 0)})`);
  if (days >= 60) ok((at(60)?.pop || 0) >= 3000, `${map}: nach 60 Tagen ≥ 3.000 Einwohner (${fmt(at(60)?.pop || 0)})`);
  if (days >= 60) ok(g.milestone >= 3, `${map}: Meilenstein „${MILESTONES[3].name}" erreicht`);
  ok(spiral.length <= 3, `${map}: keine Todesspirale (Tage mit −15 % unter Höchststand: ${spiral.length})`);
  ok(maxLow <= 3, `${map}: Glück nie länger als 3 Tage unter 40 % (war ${maxLow})`);
  ok(last.happy >= 50, `${map}: Glück am Ende ≥ 50 % (${last.happy.toFixed(0)} %)`);
  ok(last.ab <= Math.max(6, g.buildings.size * 0.03), `${map}: wenige verlassene Gebäude (${last.ab})`);
}
console.log('\nZusammenfassung:');
for (const s of summary) console.log(`  ${s.map}/${s.seed}: Einw T15 ${fmt(s.d15 || 0)} · T30 ${fmt(s.d30 || 0)} · T60 ${fmt(s.d60 || 0)} · Ende ${fmt(s.end)} | Geld Ende ${fmt(s.money)} (min ${fmt(s.minMoney)}) | Glück ${s.happy.toFixed(0)} | verl ${s.ab} | MS ${s.ms} | Puls/Tag ${s.riders} | Spirale ${s.spiral} | Minus-Tage ${s.maxNeg}`);
console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen` : '\nAlle Prüfungen bestanden');
process.exit(fails ? 1 : 0);
