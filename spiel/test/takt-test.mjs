// Prüfstand „Takt" der U-Bahn: gleichmäßig verteilen, Züge verschieben (placeTrain), automatischer Takt gegen Pulkbildung,
// Linienumbau ohne Sprünge, Speichern/Laden der Zugpositionen.
//   node test/takt-test.mjs [tage]
import { makeRng } from '../src/sim/rng.js';

// Reproduzierbarer Zufall auch außerhalb der Kernsimulation (beide Vergleichsläufe sollen dieselbe Stadt sehen)
const rnd = { rng: makeRng(1) };
Math.random = () => rnd.rng();
const reseed = (s) => { rnd.rng = makeRng(s); };

const { Game } = await import('../src/sim/game.js');
const { TRANSIT } = await import('../src/config.js');
const { buildDemoCity } = await import('../src/sim/demo.js');
const { cycPos, cycLen } = await import('../src/sim/transit.js');

const DAYS = +(process.argv[2] || 12);
const t0 = Date.now();
let fails = 0, count = 0;
const ok = (c, msg) => { count++; if (!c) fails++; console.log(`  ${c ? '✓' : '✗'} ${msg}`); return c; };
const f2 = (v) => v.toFixed(2).replace('.', ',');
const hook = (g) => { g.on('cards', (ids) => g.chooseCard(ids[0])); g.on('event', () => g.resolveEvent(0)); return g; };
function step(g, n, each) {
  for (let k = 0; k < n; k++) {
    g.update(0.1);
    if (g.speed === 0) g.speed = 1;
    if (g.pendingCards) g.chooseCard(g.pendingCards[0]);
    if (g.pendingEvent) g.resolveEvent(0);
    if (each) each(k);
  }
}
const lineTrains = (g, line) => g.transit.trains.filter((t) => t.line === line.id);
// Abstände (Felder) im Umlauf je Fahrtrichtung
function gaps(g, line) {
  const C = cycLen(line), out = [];
  for (const dir of line.loop ? [1, -1] : [1]) {
    const qs = lineTrains(g, line).filter((t) => !line.loop || t.dir === dir).map((t) => cycPos(t, line)).sort((a, b) => a - b);
    if (qs.length < 2) continue;
    for (let k = 0; k < qs.length; k++) out.push({ gap: k + 1 < qs.length ? qs[k + 1] - qs[k] : qs[0] + C - qs[k], s: C / qs.length });
  }
  return out;
}
const cvOf = (gs) => { if (!gs.length) return 0; const m = gs.reduce((a, x) => a + x.gap, 0) / gs.length; return Math.sqrt(gs.reduce((a, x) => a + (x.gap - m) ** 2, 0) / gs.length) / m; };
const finiteTrains = (g) => g.transit.trains.every((t) => [t.d, t.x, t.z, t.yaw, t.dwell].every(Number.isFinite) && (t.hold || 0) >= 0);

// ---------------------------------------------------------------- Teststadt mit U-Bahn
function city() {
  reseed(5);
  const g = hook(new Game({ size: 64, seed: 7, mapType: 'river', difficulty: 'normal', name: 'Taktstadt' }));
  g.money = 1e6;
  buildDemoCity(g);
  step(g, 6 * 300);
  g.milestone = Math.max(g.milestone, 3);
  g.money = 1e6;
  return g;
}
function station(g, x, y) {
  for (let d = 0; d < 8; d++) for (const [ox, oy] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, -d], [d, -d], [-d, d]]) {
    const r = g.placeBuilding('station', x + ox, y + oy);
    if (r.ok) return r.station;
  }
  return null;
}

console.log('=== Aufbau');
const base = city();
const hy = base.world.highwayY, x0 = (base.world.highwayEnd % base.W) + 1;
const spots = [[x0 + 1, hy - 7], [x0 + 9, hy - 2], [x0 + 17, hy - 8], [x0 + 25, hy - 2], [x0 + 31, hy + 6], [x0 + 21, hy + 9], [x0 + 11, hy + 7]];
const sts = spots.map(([x, y]) => station(base, x, y)).filter(Boolean);
ok(sts.length >= 6, `${sts.length} Stationen gesetzt`);
const r1 = base.createLine(sts.slice(0, 6).map((s) => s.id), false);
ok(r1.ok, 'Pendellinie angelegt');
const line = r1.line;
for (let k = 0; k < 4; k++) ok(base.addTrain(line.id).ok, `Zug ${k + 2} eingesetzt`);
for (let k = 0; k < 6; k++) base.addWagon(line.id);
ok(line.takt === true, 'automatischer Takt ist für neue Linien an');
{
  const gs = gaps(base, line);
  const minR = Math.min(...gs.map((x) => x.gap / x.s));
  ok(minR > 0.3, `neue Züge kommen in die größte Lücke (kleinster Abstand ${f2(minR)} × Soll)`);
}

console.log('=== Gleichmäßig verteilen');
{
  ok(base.evenOutLine(line.id).ok, 'evenOutLine meldet Erfolg');
  const gs = gaps(base, line);
  const dev = Math.max(...gs.map((x) => Math.abs(x.gap - x.s)));
  ok(gs.length === 5 && dev < 1e-6, `Pendellinie: 5 gleiche Abstände (Abweichung ${dev.toExponential(1)} Felder, Soll ${f2(gs[0].s)})`);
  ok(finiteTrains(base), 'keine ungültigen Werte nach dem Verteilen');
}

console.log('=== placeTrain');
{
  const g = base, L = line.length, t = lineTrains(g, line)[0];
  const tr = g.transit;
  ok(g.placeTrain(t.id, L * 0.37).ok && Math.abs(tr.trainP(t, line) - L * 0.37) < 1e-6 && t.dir === 1 && t.state === 'move', 'Hinfahrt mitten im Abschnitt: Position, Richtung, fährt');
  ok(line.stopD[t.cur] <= t.d && t.d <= line.stopD[t.to] && t.to === t.cur + 1, 'Abschnitt passt (cur → to)');
  ok(g.placeTrain(t.id, 2 * L - L * 0.61).ok && t.dir === -1 && Math.abs(t.d - L * 0.61) < 1e-6 && t.to === t.cur - 1, 'Rückfahrt: Richtung −1, Abschnitt rückwärts');
  ok(g.placeTrain(t.id, line.stopD[2] + 0.2, { snap: 0.5 }).ok && t.state === 'dwell' && t.cur === 2 && t.d === line.stopD[2], 'nahe an einer Station: rastet ein und hält');
  ok(g.placeTrain(t.id, 0).ok && t.cur === 0 && t.dir === 1, 'Anfangsstation: Richtung Hinfahrt');
  ok(g.placeTrain(t.id, L).ok && t.cur === line.stops.length - 1 && t.dir === -1, 'Endstation: wendet');
  ok(!g.placeTrain(t.id, NaN).ok && !g.placeTrain(99999, 3).ok, 'ungültige Position bzw. Zug wird abgelehnt');
  ok(g.placeTrain(t.id, L * 3.25).ok && Math.abs(tr.trainP(t, line) - L * 1.25) < 1e-6, 'Position außerhalb wird in den Umlauf gefaltet');
  // Festhalten (Ziehen) und Loslassen
  g.placeTrain(t.id, L * 0.5, { hold: true });
  const d0 = t.d;
  step(g, 40);
  ok(t.d === d0 && t.drag, 'festgehaltener Zug steht');
  g.placeTrain(t.id, L * 0.5);
  step(g, 10);
  ok(!t.drag && t.d !== d0, 'nach dem Loslassen fährt er von dort weiter');
  ok(finiteTrains(g), 'keine ungültigen Werte');
}

console.log('=== Linie verlängern ohne Sprünge');
{
  const g = base;
  g.evenOutLine(line.id);
  step(g, 23);
  const before = lineTrains(g, line).map((t) => ({ t, a: line.stops[t.cur], b: line.stops[t.to], st: t.state, x: t.x, z: t.z }));
  const extra = sts[6];
  const r = g.extendLine(line.id, extra.id, true);
  ok(r.ok, 'Linie am Anfang verlängert');
  let same = 0, near = 0;
  for (const b of before) {
    if (line.stops[b.t.cur] === b.a && line.stops[b.t.to] === b.b && b.t.state === b.st) same++;
    if (Math.hypot(b.t.x - b.x, b.t.z - b.z) < 1e-6) near++;
  }
  ok(same === before.length, `alle ${before.length} Züge bleiben auf ihrem Abschnitt bzw. an ihrer Station (${same})`);
  ok(near === before.length, `kein Zug springt (${near}/${before.length} an gleicher Stelle)`);
  ok(finiteTrains(g), 'keine ungültigen Werte');
}

console.log('=== Speichern und Laden');
{
  const g = base;
  step(g, 17);
  const t = lineTrains(g, line)[2];
  g.placeTrain(t.id, line.length * 1.3);
  g.setLineTakt(line.id, false);
  const g2 = hook(Game.fromSave(JSON.stringify(g.serialize())));
  const l2 = g2.transit.lines.find((l) => l.id === line.id);
  const pairs = lineTrains(g, line).map((a) => [a, g2.transit.trains.find((b) => b.id === a.id)]);
  ok(pairs.every(([a, b]) => b && Math.abs(a.d - b.d) < 1e-9 && a.dir === b.dir && a.state === b.state && a.cur === b.cur && a.to === b.to), 'Position, Richtung, Zustand und Abschnitt aller Züge erhalten');
  ok(l2.takt === false, 'Takt-Einstellung (aus) erhalten');
  // alter Spielstand ohne Positionen: lädt, Züge werden verteilt
  const old = g.serialize();
  old.transit.lines.forEach((l) => delete l.takt);
  old.transit.trains.forEach((x) => { delete x.d; delete x.to; delete x.st; delete x.dwell; delete x.hold; x.cur = 0; x.dir = 1; });
  const g3 = hook(Game.fromSave(JSON.stringify(old)));
  const l3 = g3.transit.lines.find((l) => l.id === line.id);
  const gs = gaps(g3, l3);
  ok(g3.errors.length === 0 && l3.takt === true, 'alter Spielstand lädt (Takt standardmäßig an)');
  ok(gs.length && Math.max(...gs.map((x) => Math.abs(x.gap - x.s))) < 1e-6, 'alte Züge (alle an Station 0) werden beim Laden gleichmäßig verteilt');
  step(g3, 300);
  ok(finiteTrains(g3) && g3.errors.length === 0, 'läuft nach dem Laden fehlerfrei weiter');
  g.setLineTakt(line.id, true);
}

console.log('=== Ring: beide Richtungen');
{
  const g = base;
  const r = g.createLine([sts[1].id, sts[3].id, sts[4].id, sts[5].id], true);
  ok(r.ok && r.line.loop, 'Ringlinie angelegt');
  const ring = r.line;
  for (let k = 0; k < 3; k++) g.addTrain(ring.id);
  const ts = lineTrains(g, ring);
  ok(ts.filter((t) => t.dir > 0).length === 2 && ts.filter((t) => t.dir < 0).length === 2, 'neue Züge verteilen sich auf beide Richtungen');
  g.evenOutLine(ring.id);
  const gs = gaps(g, ring);
  ok(gs.length === 4 && Math.max(...gs.map((x) => Math.abs(x.gap - x.s))) < 1e-6, 'je Richtung gleiche Abstände');
  const t = ts.find((x) => x.dir < 0);
  ok(g.placeTrain(t.id, ring.length + 0.4 * ring.length).ok && t.dir === -1 && Math.abs(t.d - 0.6 * ring.length) < 1e-6, 'Ring Gegenrichtung: placeTrain');
  step(g, 600);
  ok(finiteTrains(g), 'Ring läuft ohne ungültige Werte');
  g.removeLine(ring.id);
}

// ---------------------------------------------------------------- Pulkbildung mit und ohne Takt
console.log(`=== Pulkbildung über ${DAYS} Tage (mit und ohne automatischen Takt)`);
const snap = JSON.stringify(base.serialize());
function trial(auto, bunchStart) {
  reseed(77);
  const g = hook(Game.fromSave(snap));
  const l = g.transit.lines.find((x) => x.id === line.id);
  g.setLineTakt(l.id, auto);
  const ts = lineTrains(g, l);
  if (bunchStart) ts.forEach((t, i) => g.placeTrain(t.id, 2 + i * 1.2)); // alle dicht hintereinander
  else g.evenOutLine(l.id);
  let cvSum = 0, nS = 0, crowd = 0, minR = 0, holdS = 0, lost = 0, dayCv = 0, dayN = 0; const series = [];
  const pen = new Map(l.stops.map((sid) => [sid, g.transit.stations.get(sid).penaltyUntil || 0]));
  step(g, DAYS * 300, (k) => {
    for (const t of ts) if ((t.hold || 0) > 0) holdS += 0.1;
    if (k % 25) return;
    const gs = gaps(g, l);
    cvSum += cvOf(gs); nS++; dayCv += cvOf(gs); dayN++; if (k % 300 === 275) { series.push(f2(dayCv / dayN)); dayCv = dayN = 0; }
    minR += Math.min(...gs.map((x) => x.gap / x.s));
    for (const sid of l.stops) {
      const st = g.transit.stations.get(sid);
      if (st.waiting.length > TRANSIT.stationCapacity) crowd++;
      if (st.penaltyUntil > pen.get(sid)) { lost++; pen.set(sid, st.penaltyUntil); }
    }
  });
  if (process.env.TAKT_SERIES) console.log("    VK je Tag:", series.join(" "));
  return { cv: cvSum / nS, minR: minR / nS, crowd, lost, riders: g.transit.deliveredTotal, holdPerTrain: holdS / ts.length / DAYS, fine: finiteTrains(g) && g.errors.length === 0 };
}
const res = {};
for (const [k, auto, bunch] of [['an', true, false], ['aus', false, false], ['anPulk', true, true], ['ausPulk', false, true]]) {
  res[k] = trial(auto, bunch);
  const r = res[k];
  console.log(`  Takt ${auto ? 'an ' : 'aus'} · Start ${bunch ? 'im Pulk ' : 'verteilt'}: VK der Abstände ${f2(r.cv)} · kleinster Abstand Ø ${f2(r.minR)} × Soll · überfüllte Stationsproben ${r.crowd} · Überfüllungs-Strafen ${r.lost} · Fahrgäste ${r.riders} · Takt-Wartezeit ${f2(r.holdPerTrain)} s je Zug und Tag`);
}
ok(Object.values(res).every((r) => r.fine), 'alle Läufe ohne Fehler und ungültige Werte');
ok(res.an.cv < res.aus.cv * 0.6, `verteilt gestartet: Takt hält die Abstände gleichmäßiger (VK ${f2(res.an.cv)} statt ${f2(res.aus.cv)})`);
ok(res.anPulk.cv < res.ausPulk.cv * 0.6, `im Pulk gestartet: Takt löst den Pulk auf (VK ${f2(res.anPulk.cv)} statt ${f2(res.ausPulk.cv)})`);
ok(res.an.minR > 0.5 && res.anPulk.minR > 0.45, `mit Takt bleibt der kleinste Abstand groß (Ø ${f2(res.an.minR)} bzw. ${f2(res.anPulk.minR)} × Soll)`);
ok(res.an.crowd + res.anPulk.crowd < (res.aus.crowd + res.ausPulk.crowd), `weniger überfüllte Stationen mit Takt (${res.an.crowd + res.anPulk.crowd} statt ${res.aus.crowd + res.ausPulk.crowd} Proben)`);
ok(res.an.riders >= res.aus.riders * 0.95, `Fahrgastzahl leidet nicht (${res.an.riders} statt ${res.aus.riders})`);
ok(res.an.holdPerTrain < 30 * 0.25, `Zurückhalten bleibt maßvoll (${f2(res.an.holdPerTrain)} s je Zug und Tag)`);

// ---------------------------------------------------------------- Fahrplan-Marker ohne Überlappung
console.log('=== Fahrplan: Marker dicht folgender Züge');
{
  const { layoutLane } = await import('../src/ui/timetable.js');
  const lay = (xs) => layoutLane(xs.map((x, i) => ({ x, i })), 16, 316);
  const noOverlap = (us) => us.every((u, k) => k === 0 || u.px - us[k - 1].px >= 32.9);
  const all = (us) => us.reduce((a, u) => a + u.members.length, 0);
  const tries = [[50, 50], [50, 52, 54, 100, 180, 200, 205], [16, 16, 16], [300, 310, 316], [20, 50, 80, 110, 140, 170, 200, 230, 260, 290]];
  let rnd2 = makeRng(7);
  for (let k = 0; k < 40; k++) tries.push(Array.from({ length: 2 + Math.floor(rnd2() * 12) }, () => 16 + rnd2() * 300));
  ok(tries.every((xs) => { const us = lay(xs); return noOverlap(us) && all(us) === xs.length; }), `${tries.length} Anordnungen: Marker halten Mindestabstand, kein Zug geht verloren`);
  ok(tries.every((xs) => lay(xs).every((u) => u.members.length > 1 || Math.abs(u.px - u.x) <= 17.01)), 'einzelne Marker stehen höchstens 17 px neben ihrer echten Stelle');
  const a = lay([50, 50]), b = lay([100, 120]);
  ok(a.length === 1 && a[0].members.length === 2 && b.length === 2 && Math.abs(b[1].px - b[0].px - 33) < 0.01, 'deckungsgleiche Züge werden gebündelt, nahe Züge weichen aus');
}

console.log(`\n${count - fails}/${count} Prüfungen bestanden${fails ? ` – ${fails} FEHLER` : ''} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(fails ? 1 : 0);
