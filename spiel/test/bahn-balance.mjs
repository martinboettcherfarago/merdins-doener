// Prüfstand „U-Bahn-Gleichgewicht" (BAHNPLAN): Fahrgäste entstanden ↔ befördert je Spieltag, überfüllte Stationen und
// Auslastung der Züge – für kleine, mittlere und große Netze (saves/megastadt.json) und die Tageslängen 48/24/16
// Spielminuten je Sekunde. Je Netz drei Ausbaustufen: „knapp" (1 Zug, ohne Waggons), „passend" (Züge nach Linienlänge,
// Waggons nach Bedarf), „voll" (6 Züge × 3 Waggons).
// Aufruf aus spiel/: node test/bahn-balance.mjs [--report] [--quick]   (--report: nur messen, keine Prüfungen)
import { readFileSync } from 'node:fs';
import { makeRng } from '../src/sim/rng.js';

const rnd = { rng: makeRng(1) };
Math.random = () => rnd.rng();
const reseed = (s) => { rnd.rng = makeRng(s); };

const { Game } = await import('../src/sim/game.js');
const { TRANSIT } = await import('../src/config.js');
const { buildDemoCity } = await import('../src/sim/demo.js');

const report = process.argv.includes('--report');
const quick = process.argv.includes('--quick');
const t0 = Date.now();
let fails = 0, count = 0;
const ok = (c, msg) => { count++; if (!c) fails++; if (!report) console.log(`  ${c ? '✓' : '✗'} ${msg}`); return c; };
const hook = (g) => { g.on('cards', (ids) => g.chooseCard(ids[0])); g.on('event', () => g.resolveEvent(0)); return g; };
const pct = (v) => `${Math.round(v * 100)} %`;

function station(g, x, y) {
  for (let d = 0; d < 8; d++) for (const [ox, oy] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, -d], [d, -d], [-d, d]]) {
    const r = g.placeBuilding('station', x + ox, y + oy);
    if (r.ok) return r.station;
  }
  return null;
}

// ---------------------------------------------------------------- Netze
function demoCity() {
  reseed(5);
  const g = hook(new Game({ size: 64, seed: 7, mapType: 'river', difficulty: 'normal', name: 'Gleichgewicht' }));
  g.money = 1e6;
  buildDemoCity(g);
  g.speed = 1;
  for (let k = 0; k < 6 * 300; k++) g.update(0.1);
  g.milestone = Math.max(g.milestone, 3);
  g.transit.linesMax = 10;
  g.money = 1e7;
  return g;
}
function small() {
  const g = demoCity();
  const hy = g.world.highwayY, x0 = (g.world.highwayEnd % g.W) + 1;
  const sts = [[x0 + 1, hy - 7], [x0 + 9, hy - 2], [x0 + 17, hy - 8], [x0 + 25, hy - 2]].map(([x, y]) => station(g, x, y)).filter(Boolean);
  g.createLine(sts.map((s) => s.id), false);
  return g;
}
function medium() {
  const g = demoCity();
  const hy = g.world.highwayY, x0 = (g.world.highwayEnd % g.W) + 1;
  const sts = [[x0 + 1, hy - 7], [x0 + 9, hy - 2], [x0 + 17, hy - 8], [x0 + 25, hy - 2], [x0 + 31, hy + 6], [x0 + 21, hy + 9], [x0 + 11, hy + 7]].map(([x, y]) => station(g, x, y)).filter(Boolean);
  g.createLine(sts.slice(0, 5).map((s) => s.id), false);
  g.createLine([sts[1], sts[6], sts[5], sts[4]].filter(Boolean).map((s) => s.id), false);
  return g;
}
function large() {
  reseed(9);
  const g = hook(Game.fromSave(readFileSync(new URL('../saves/megastadt.json', import.meta.url), 'utf8')));
  g.money = 1e9;
  return g;
}

// Ausbaustufe setzen: Züge und Waggons je Linie
function equip(g, mode) {
  const T = g.transit;
  for (const l of T.lines) {
    const want = mode === 'knapp' ? 1 : mode === 'voll' ? 6 : Math.max(2, Math.min(6, Math.round((l.loop ? l.length : 2 * l.length) / 28)));
    const wag = mode === 'knapp' ? 0 : mode === 'voll' ? 3 : 1;
    while (T.trains.filter((t) => t.line === l.id).length > want) T.removeTrainFromLine(l);
    while (T.trains.filter((t) => t.line === l.id).length < want) T.addTrainToLine(l);
    for (const t of T.trains) if (t.line === l.id) t.wagons = wag;
  }
  T.freeTrains = 0; T.freeWagons = 0;
  for (const st of T.stations.values()) { st.waiting = []; st.over = 0; st.penaltyUntil = 0; }
  for (const t of T.trains) t.pax = [];
  if (mode !== 'knapp') for (const l of T.lines) T.evenOut(l, true);
  g.afterTransitChange();
}

// Messen: d Tage (nach einem Tag Einschwingen) bei mps Spielminuten je Sekunde
function measure(make, mode, mps, days) {
  const g = make();
  g.minPerSec = mps;
  equip(g, mode);
  const T = g.transit;
  const stepsDay = Math.round((300 * 48) / mps);
  const run = (n, sample) => { for (let k = 0; k < n; k++) { g.update(0.1); if (g.speed === 0) g.speed = 1; if (g.pendingCards) g.chooseCard(g.pendingCards[0]); if (g.pendingEvent) g.resolveEvent(0); if (sample && k % 5 === 0) sample(); } };
  run(stepsDay);
  const c0 = { ...T.cnt }, del0 = T.deliveredTotal;
  let samples = 0, overSt = 0, stTot = 0, wait = 0, load = 0, loadN = 0, full = 0;
  run(stepsDay * days, () => {
    samples++;
    for (const st of T.stations.values()) { if (!st.active) continue; stTot++; wait += st.waiting.length; if (st.waiting.length > TRANSIT.stationCapacity) overSt++; }
    for (const t of T.trains) { const cap = T.trainCapacity(t); load += t.pax.length / cap; loadN++; if (t.pax.length >= cap) full++; }
  });
  const spawn = (T.cnt.spawn - c0.spawn) / days, reject = (T.cnt.reject - c0.reject) / days;
  const lost = (T.cnt.lost - c0.lost) / days, expire = (T.cnt.expire - c0.expire) / days, del = (T.deliveredTotal - del0) / days;
  const waitingEnd = [...T.stations.values()].reduce((a, s) => a + s.waiting.length, 0);
  return {
    lines: T.lines.length, trains: T.trains.length, wagons: T.totalWagons(), spawn, reject, lost, expire, del,
    served: del / Math.max(1, spawn + reject), over: overSt / Math.max(1, stTot), wait: wait / Math.max(1, stTot), load: load / Math.max(1, loadN), full: full / Math.max(1, loadN), waitingEnd,
  };
}

const only = process.argv.includes('--net') ? process.argv[process.argv.indexOf('--net') + 1].split(',') : null;
const NETS = [['klein', small], ['mittel', medium], ['groß', large]].filter(([n]) => !only || only.includes(n));
const MODES = ['knapp', 'passend', 'voll'];
const MPS = [48, 24, 16];
const DAYS = quick ? 1 : 2;
const res = {};
console.log('Netz     Ausbau    Tag  Züge/Wag  entst.  abgew.  beförd.  aufgeg.  verfall.  bedient  überfüllt  Ø wart.  Ø Last  voll');
for (const [name, make] of NETS) {
  for (const mode of MODES) {
    for (const mps of MPS) {
      if (quick && mps !== 24) continue;
      const r = measure(make, mode, mps, name === 'groß' ? 1 : DAYS);
      res[`${name}/${mode}/${mps}`] = r;
      const f = (v) => String(Math.round(v)).padStart(6);
      console.log(`${name.padEnd(8)} ${mode.padEnd(8)} ${String(mps).padStart(4)}  ${String(r.trains).padStart(4)}/${String(r.wagons).padEnd(4)} ${f(r.spawn)}  ${f(r.reject)}  ${f(r.del)}   ${f(r.lost)}   ${f(r.expire)}    ${pct(r.served).padStart(5)}    ${pct(r.over).padStart(5)}   ${r.wait.toFixed(1).padStart(5)}   ${pct(r.load).padStart(5)}  ${pct(r.full).padStart(4)}`);
    }
  }
}

if (!report) {
  console.log('\nPrüfungen');
  for (const [name] of NETS) {
    for (const mps of MPS) {
      const p = res[`${name}/passend/${mps}`], k = res[`${name}/knapp/${mps}`], v = res[`${name}/voll/${mps}`];
      if (!p) continue;
      ok(p.served >= 0.8, `${name}, ${mps}: passend ausgebaut wird der Großteil befördert (${pct(p.served)})`);
      ok(p.over <= 0.2, `${name}, ${mps}: passend ausgebaut ist Überfüllung die Ausnahme (${pct(p.over)} der Stationen)`);
      if (v) ok(v.served >= p.served - 0.05 && v.over <= p.over + 0.05, `${name}, ${mps}: voll ausgebaut nicht schlechter (${pct(v.served)}, ${pct(v.over)})`);
      if (k && name !== 'klein') ok(k.over > p.over || k.served < p.served, `${name}, ${mps}: knapp ausgebaut zeigt Engpässe (${pct(k.served)} bedient, ${pct(k.over)} überfüllt)`);
    }
    const a = res[`${name}/passend/48`], b = res[`${name}/passend/16`];
    if (a && b) ok(Math.abs(a.served - b.served) <= 0.15 && Math.abs(a.over - b.over) <= 0.15, `${name}: unabhängig von der Tageslänge (bedient ${pct(a.served)} ↔ ${pct(b.served)}, überfüllt ${pct(a.over)} ↔ ${pct(b.over)})`);
  }
}
console.log(`\n${report ? 'Messung' : fails ? `${fails} von ${count} Prüfungen fehlgeschlagen` : `Alle ${count} Prüfungen bestanden`} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(fails ? 1 : 0);
