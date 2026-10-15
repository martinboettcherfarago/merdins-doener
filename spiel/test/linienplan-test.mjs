// Prüfstand „Linienplan" (BAHNPLAN): game.planLine / game.buildLinePlan – Linie mit geplanten Stationen bauen,
// am Anfang/Ende verlängern und kürzen, Station entfernen (Abriss ohne andere Linie), Ring schließen/öffnen, Kosten,
// Züge bleiben beim Umbau an ihrer Stelle, alte Aufrufe (extendLine) gehen weiter, Speichern/Laden.
//   node test/linienplan-test.mjs
import { makeRng } from '../src/sim/rng.js';

const rnd = { rng: makeRng(3) };
Math.random = () => rnd.rng();
const { Game } = await import('../src/sim/game.js');
const { TRANSIT } = await import('../src/config.js');
const { buildDemoCity } = await import('../src/sim/demo.js');

const t0 = Date.now();
let fails = 0, count = 0;
const ok = (c, msg) => { count++; if (!c) fails++; console.log(`  ${c ? '✓' : '✗'} ${msg}`); return c; };
const hook = (g) => { g.on('cards', (ids) => g.chooseCard(ids[0])); g.on('event', () => g.resolveEvent(0)); return g; };
const step = (g, n) => { for (let k = 0; k < n; k++) { g.update(0.1); if (g.speed === 0) g.speed = 1; if (g.pendingCards) g.chooseCard(g.pendingCards[0]); if (g.pendingEvent) g.resolveEvent(0); } };

const g = hook(new Game({ size: 64, seed: 7, mapType: 'river', difficulty: 'normal', name: 'Planstadt' }));
g.money = 1e6;
buildDemoCity(g);
step(g, 3 * 300);
g.milestone = Math.max(g.milestone, 3);
g.transit.linesMax = 6;
g.money = 200000;
const T = g.transit;
// freie Felder für Stationen
const freeTiles = [];
for (let y = 4; y < g.H - 4; y += 3) for (let x = 4; x < g.W - 4; x += 3) if (!T.canPlaceStation(x, y)) freeTiles.push({ x, y });
const pick = (cx, cy, used) => freeTiles.filter((t) => !used.some((u) => u.x === t.x && u.y === t.y)).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0];
const used = [];
const P = (cx, cy) => { const t = pick(cx, cy, used); used.push(t); return { x: t.x, y: t.y }; };
const hy = g.world.highwayY, x0 = (g.world.highwayEnd % g.W) + 1;

console.log('=== Neue Linie mit geplanten Stationen');
const exist = g.placeBuilding('station', P(x0 + 4, hy - 6).x, used[used.length - 1].y).station;
ok(!!exist, 'vorhandene Station gesetzt');
const p1 = P(x0 + 12, hy - 3), p2 = P(x0 + 20, hy - 6);
const n0 = T.stations.size, m0 = g.money;
let plan = g.planLine(null, [exist.id, p1, p2], false);
const stCost = g.buildingCost('station');
ok(plan.ok && plan.newSt === 2 && plan.stationCost === 2 * stCost && plan.trackCost >= Math.round(TRANSIT.lineCost * g.costMul), `Plan: 2 neue Stationen, Kosten ${plan.cost} (Stationen ${plan.stationCost}, Gleise ${plan.trackCost})`);
ok(T.stations.size === n0 && g.money === m0, 'planLine baut nichts');
ok(!g.planLine(null, [exist.id], false).ok && g.planLine(null, [exist.id], false).reason === 'Mindestens 2 Stationen', 'eine Station reicht nicht');
ok(!g.planLine(null, [exist.id, { x: exist.x, y: exist.y }], false).ok, 'geplante Station auf belegtem Feld wird abgelehnt');
let res = g.buildLinePlan(null, [exist.id, p1, p2], false);
ok(res.ok && T.lines.length === 1 && T.stations.size === n0 + 2 && res.line.stops.length === 3, 'buildLinePlan baut Linie und zwei Stationen');
ok(Math.abs(m0 - g.money - plan.cost) < 1, `bezahlt genau den Plan (${Math.round(m0 - g.money)} €)`);
const line = res.line;
const sA = line.stops[0], sB = line.stops[1], sC = line.stops[2];
g.addTrain(line.id); g.addTrain(line.id);
step(g, 37);

console.log('=== Verlängern an beiden Enden');
const p0 = P(x0 - 2, hy - 9), p3 = P(x0 + 26, hy - 1);
plan = g.planLine(line.id, [p0, sA, sB, sC, p3], false);
const segCost = (a, b) => { const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y), d = Math.min(dx, dy); return Math.round((d * Math.SQRT2 + Math.max(dx, dy) - d) * TRANSIT.trackCostPerTile * g.costMul); };
const expTrack = segCost(p0, T.stations.get(sA)) + segCost(T.stations.get(sC), p3);
ok(plan.ok && plan.add === 2 && plan.rem === 0 && Math.abs(plan.trackCost - expTrack) <= 1, `nur neue Abschnitte kosten (${plan.trackCost} ≈ ${expTrack})`);
const before = T.trains.filter((t) => t.line === line.id).map((t) => ({ t, x: t.x, z: t.z }));
res = g.buildLinePlan(line.id, [p0, sA, sB, sC, p3], false);
ok(res.ok && line.stops.length === 5 && line.stops[1] === sA && line.stops[3] === sC, 'beide Enden verlängert');
ok(before.every((b) => Math.hypot(b.t.x - b.x, b.t.z - b.z) < 1e-6), 'Züge bleiben beim Verlängern stehen, wo sie sind');
const sP0 = line.stops[0], sP3 = line.stops[4];

console.log('=== Kürzen und Station entfernen');
step(g, 53);
plan = g.planLine(line.id, [sA, sB, sC, sP3], false);
ok(plan.ok && plan.cost === 0 && plan.rem === 1, 'Kürzen kostet nichts');
res = g.buildLinePlan(line.id, [sA, sB, sC, sP3], false);
ok(res.ok && line.stops[0] === sA && T.stations.has(sP0), 'gekürzt – die abgenommene Endstation bleibt stehen');
step(g, 41);
const pos0 = T.trains.filter((t) => t.line === line.id).map((t) => ({ x: t.x, z: t.z }));
res = g.buildLinePlan(line.id, [sA, sC, sP3], false, [sB]);
ok(res.ok && !line.stops.includes(sB) && !T.stations.has(sB), 'Mittelstation entfernt und (ohne andere Linie) abgerissen');
const ts = T.trains.filter((t) => t.line === line.id);
const moved = ts.map((t, k) => Math.hypot(t.x - pos0[k].x, t.z - pos0[k].z));
ok(moved.every((d) => d < 6), `Züge bleiben in der Nähe ihrer Stelle (größte Verschiebung ${Math.max(...moved).toFixed(1)} Felder)`);
const at = new Set(ts.map((t) => (t.state === 'dwell' ? 's' + t.cur : 'm' + t.d.toFixed(2))));
ok(at.size === ts.length, 'Züge springen nicht alle auf dieselbe Station');
ok(ts.every((t) => [t.d, t.x, t.z].every(Number.isFinite) && t.cur >= 0 && t.cur < line.stops.length && t.to >= 0 && t.to < line.stops.length), 'Zugdaten gültig');

console.log('=== Station mit anderer Linie bleibt');
const q1 = P(x0 + 18, hy + 6);
res = g.buildLinePlan(null, [sC, q1], false);
ok(res.ok && T.lines.length === 2, 'zweite Linie über C');
res = g.buildLinePlan(line.id, [sA, sP3], false, [sC]);
ok(res.ok && T.stations.has(sC) && !line.stops.includes(sC), 'C aus Linie 1 entfernt, bleibt für Linie 2 stehen');

console.log('=== Ring schließen und öffnen');
const r1 = P(x0 + 8, hy + 8);
plan = g.planLine(line.id, [sA, sP3, r1], true);
ok(plan.ok && plan.loop && plan.trackCost > 0, 'Ring schließen kostet den Schlussabschnitt');
res = g.buildLinePlan(line.id, [sA, sP3, r1], true);
ok(res.ok && line.loop && line.stops.length === 3, 'Ring gebaut');
step(g, 30);
const sR = line.stops[2];
res = g.buildLinePlan(line.id, [sP3, sR, sA], false);
ok(res.ok && !line.loop && line.stops[0] === sP3, 'Ring an einer Station geöffnet');
ok(g.planLine(line.id, [sP3, sR, sA], false).reason === 'Keine Änderung', 'ohne Änderung meldet der Plan „Keine Änderung"');

console.log('=== Geld, Grenzen, alte Aufrufe');
const rich = g.money;
g.money = 10;
const pz = P(x0 + 30, hy + 9);
ok(!g.buildLinePlan(line.id, [sP3, sR, sA, pz], false).ok && T.stations.size === T.stations.size && g.money === 10, 'ohne Geld wird nichts gebaut');
g.money = rich;
T.linesMax = T.lines.length;
ok(g.planLine(null, [sA, sR], false).reason === 'Keine freie Linie', 'Linienlimit gilt');
T.linesMax = 6;
const ext = g.placeBuilding('station', pz.x, pz.y).station;
ok(g.extendLine(line.id, ext.id, false).ok && line.stops[line.stops.length - 1] === ext.id, 'extendLine (alte Schnittstelle) geht weiter');

console.log('=== Speichern und Laden');
const g2 = hook(Game.fromSave(JSON.stringify(g.serialize())));
const l2 = g2.transit.lines.find((l) => l.id === line.id);
ok(l2 && l2.stops.join() === line.stops.join() && l2.loop === line.loop, 'Linie nach dem Laden gleich');
step(g2, 50);
ok(g2.transit.trains.every((t) => Number.isFinite(t.d) && Number.isFinite(t.x)), 'Züge fahren nach dem Laden weiter');

console.log(`\n${fails ? `${fails} von ${count} Prüfungen fehlgeschlagen` : `${count}/${count} Prüfungen bestanden`} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(fails ? 1 : 0);
