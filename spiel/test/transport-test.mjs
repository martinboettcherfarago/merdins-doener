// Prüfstand „Verkehr & ÖPNV" (Agent S3): baut eine Stadt mit Bus-, Tram-, Fernbahn-, Flug-, Fähr- und Taxiverkehr
// und simuliert viele Tage. Aufruf: node test/transport-test.mjs [tage] [karte]
// Teil A: normale Schwierigkeit (Wirtschaftlichkeit, Fahrgäste, Pendleranteil, Verkehrsfluss) über die volle Dauer.
// Teil B: Sandkasten (alle Anlagen, Ampeln, Unfälle, Bearbeiten, Speichern/Laden, renderables).
import { Game } from '../src/sim/game.js';
import { R, Z, BUILDINGS, TRANSIT } from '../src/config.js';
import { buildDemoCity } from '../src/sim/demo.js';
import * as TPS from '../src/sim/systems/transport.js';

const days = +(process.argv[2] || 45);
const mapType = process.argv[3] || 'river';
let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const fmt = (n) => Math.round(n).toLocaleString('de-DE');
const KINDS = new Set(['car', 'van', 'truck', 'bus', 'tram', 'taxi', 'police', 'fire', 'ambulance', 'garbage', 'hearse', 'snowplow', 'tanker', 'train_loco', 'train_wagon', 'cargo_wagon', 'ship_cargo', 'ferry', 'boat', 'plane', 'helicopter', 'ship_cruise']);

function helpers(g) {
  const W = g.W;
  const idx = (x, y) => y * W + x;
  const road = (x0, y0, x1, y1, t = R.STREET) => {
    if (y0 === y1) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) g.buildRoad([idx(x, y0)], t);
    else for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) g.buildRoad([idx(x0, y)], t);
  };
  const zone = (x0, y0, x1, y1, z) => {
    const tiles = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < W && y < W) tiles.push(idx(x, y));
    g.zoneTiles(tiles, z);
  };
  const place = (key, x, y, rot = 0) => {
    for (let d = 0; d < 22; d++) for (const [ox, oy] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, -d], [d, -d], [-d, d]]) {
      const r = g.placeBuilding(key, x + ox, y + oy, rot);
      if (r.ok) return r;
    }
    console.log('    platzieren fehlgeschlagen:', key);
    return { ok: false };
  };
  const station = (x, y) => {
    for (let d = 0; d < 6; d++) for (const [ox, oy] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]]) {
      const r = g.placeBuilding('station', x + ox, y + oy);
      if (r.ok) return r.station;
    }
    return null;
  };
  // Haltestellenfeld in der Nähe suchen
  const stopTile = (x, y, mode = 'bus') => {
    for (let d = 0; d < 5; d++) for (const [ox, oy] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]]) {
      const xx = x + ox, yy = y + oy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= g.H) continue;
      if (!TPS.canStop(g, idx(xx, yy), mode)) return idx(xx, yy);
    }
    return -1;
  };
  const run = (nDays, each) => {
    for (let d = 0; d < nDays; d++) {
      for (let s = 0; s < 300; s++) { g.update(0.1); if (each && s % 5 === 0) each(); }
    }
  };
  return { idx, road, zone, place, station, stopTile, run };
}

function checkRenderables(g, label) {
  const rs = g.renderables();
  let bad = 0;
  const kinds = {};
  for (const o of rs) {
    kinds[o.kind] = (kinds[o.kind] || 0) + 1;
    if (!KINDS.has(o.kind) || ![o.x, o.y, o.z, o.yaw].every(Number.isFinite) || (o.pitch !== undefined && !Number.isFinite(o.pitch))) bad++;
  }
  ok(bad === 0, `${label}: ${rs.length} bewegliche Objekte gültig (${Object.entries(kinds).map(([k, v]) => k + ' ' + v).join(', ') || '–'})`);
  return kinds;
}

// ======================================================================= Teil A
console.log(`\n=== Teil A: normale Stadt, ${days} Tage, Karte ${mapType} ===`);
const t0 = Date.now();
const g = new Game({ size: 96, seed: 4242, mapType, difficulty: 'normal', name: 'Busstadt' });
g.on('cards', (ids) => { const pref = ids.find((i) => i.startsWith('tp_')) || ids[0]; g.chooseCard(pref); });
g.on('event', () => g.resolveEvent(0));
const H = helpers(g);
const hy = g.world.highwayY;
H.road(6, hy, 46, hy);
for (let x = 9; x <= 45; x += 5) H.road(x, hy - 12, x, hy + 12);
H.road(9, hy - 12, 45, hy - 12); H.road(9, hy + 12, 45, hy + 12);
H.road(9, hy - 6, 45, hy - 6); H.road(9, hy + 6, 45, hy + 6);
H.place('landfill', 24, hy + 13);
H.zone(10, hy - 11, 28, hy - 1, Z.RES);
H.zone(10, hy + 1, 22, hy + 11, Z.COM);
H.zone(31, hy + 1, 44, hy + 11, Z.IND);
H.zone(29, hy - 11, 44, hy - 1, Z.RES);
H.place('coal', 40, hy + 13);
H.place('watertower', 8, hy - 3);
H.place('watertower', 8, hy + 3);
const T = () => g.ext.transport;
ok(!!T() && Array.isArray(T().stops) && Array.isArray(T().lines), 'Zustand g.ext.transport mit stops/lines vorhanden');

let busBuilt = false, tramBuilt = false, servicesBuilt = false, transitBuilt = false, stationBuilt = false, more = false;
const log = [];
const tryLine = (mode, pts, loop = false) => {
  const tiles = pts.map(([x, y]) => H.stopTile(x, y, mode)).filter((t) => t >= 0);
  const r = TPS.createLine(g, mode, tiles, loop);
  console.log(`    ${mode}-Linie (${tiles.length} Halte${loop ? ', Ring' : ''}): ${r.ok ? 'ok, ' + fmt(r.cost) + ' €' : r.msg}`);
  return r;
};
for (let d = 1; d <= days; d++) {
  H.run(1);
  if (!servicesBuilt && g.milestone >= 1) {
    servicesBuilt = true;
    H.place('police', 20, hy - 5); H.place('fire', 30, hy + 5); H.place('clinic', 15, hy + 7); H.place('school', 24, hy - 8);
    H.place('park', 12, hy - 4); H.place('park', 34, hy - 4); H.place('wind', 46, hy - 8); H.place('watertower', 46, hy - 4);
  }
  if (!busBuilt && g.isUnlocked('bus_depot') && g.money > 9000) {
    busBuilt = true;
    console.log(`  Tag ${d}: Busdepot und Buslinien`);
    const dep = H.place('bus_depot', 47, hy + 6);
    ok(dep.ok, 'Busdepot gebaut');
    H.run(1); // Bauzeit
    const a = tryLine('bus', [[11, hy - 6], [16, hy - 6], [21, hy - 6], [26, hy - 6], [31, hy - 6], [36, hy - 6], [41, hy - 6]]);
    ok(a.ok, 'Buslinie 1 (Wohngebiet Ost-West) eröffnet');
    const b = tryLine('bus', [[24, hy - 10], [24, hy - 3], [24, hy + 3], [24, hy + 9], [36, hy + 6]]);
    ok(b.ok, 'Buslinie 2 (Wohnen → Gewerbe/Industrie) eröffnet');
    if (a.ok) TPS.setVehicles(g, a.line.id, 2);
    if (b.ok) TPS.setVehicles(g, b.line.id, 2);
  }
  if (!transitBuilt && g.isUnlocked('transit')) {
    transitBuilt = true;
    const a = H.station(12, hy), b = H.station(26, hy), c = H.station(40, hy), e = H.station(26, hy - 10);
    if (a && b && c) g.createLine([a.id, b.id, c.id], false);
    if (e && b) g.createLine([e.id, b.id], false);
    H.zone(10, hy - 20, 44, hy - 13, Z.OFF);
    H.road(9, hy - 18, 45, hy - 18);
    // Zubringer: Buslinie mit Halt an der Pulsbahn-Station
    const f = tryLine('bus', [[16, hy - 18], [26, hy - 15], [27, hy]]);
    if (f.ok) log.push('Zubringerlinie');
  }
  if (!stationBuilt && g.isUnlocked('train_station') && g.money > 32000) {
    stationBuilt = true;
    const st = H.place('train_station', 30, hy + 14);
    ok(st.ok, 'Hauptbahnhof gebaut');
    H.place('coal', 40, hy + 17);
    H.place('watertower', 47, hy + 9); H.place('watertower', 47, hy + 11);
  }
  if (!tramBuilt && stationBuilt && g.isUnlocked('tram_depot') && g.money > 22000) {
    tramBuilt = true;
    console.log(`  Tag ${d}: Straßenbahn`);
    const dep = H.place('tram_depot', 3, hy - 4);
    H.run(1);
    if (dep.ok) {
      const r = tryLine('tram', [[7, hy], [17, hy], [31, hy], [43, hy]]);
      ok(r.ok, 'Straßenbahnlinie auf der Hauptachse eröffnet');
      if (r.ok) TPS.setVehicles(g, r.line.id, 2);
    }
  }
  if (!more && d === Math.floor(days * 0.6)) {
    more = true;
    for (const l of T().lines) if (l.load > 0.7) { TPS.setVehicles(g, l.id, l.nveh + 2); }
    H.place('parking', 16, hy + 5);
  }
  if (d % 5 === 0 || d === days) {
    const s = g.stats, t = T();
    const y = t.day || {};
    console.log(`Tag ${String(d).padStart(3)} Einw ${String(s.pop).padStart(5)} Geld ${String(Math.round(g.money)).padStart(7)} MS ${g.milestone} · Linien ${t.lines.length} Halte ${t.stops.length} Fzg ${t.vehicles.length} · gestern: Bus ${fmt(y.bus || 0)} Tram ${fmt(y.tram || 0)} Puls ${s.ridersToday} Umstieg ${fmt(y.transfers || 0)} Zubringer ${fmt(y.feeder || 0)} abgew. ${fmt(y.rejected || 0)} Züge ${y.trains || 0} · Anteil ÖPNV ${(t.share * 100).toFixed(1)} % (Kern ${(s.transitShare * 100).toFixed(1)} %) · Fluss ${(s.trafficFlow * 100).toFixed(0)} % Autos ${g.traffic.cars.length} · Ampeln ${t.signals.length} Unfälle ${t.totals.accidents}`);
  }
}
{
  const t = T(), b = g.lastBudget, s = g.stats;
  console.log('Laufzeit Teil A', ((Date.now() - t0) / 1000).toFixed(1), 's');
  console.log('Haushalt/Tag: Fahrgeld', fmt(b.inc.tp_fares || 0), '€ · Fernverkehr', fmt(b.inc.tp_long || 0), '€ · Linienkosten', fmt(b.exp.tp_lines || 0), '€ · Saldo', fmt(b.net), '€');
  for (const l of t.lines) console.log(`  ${TPS.lineLabel(l)}: ${l.stops.length} Halte, ${l.len.toFixed(1)} Felder, ${l.nveh}× ${TPS.VEHICLE_TYPES[l.vtype].name}, Takt ${l.takt.toFixed(1)} Min., Umlauf ${l.cycleMin.toFixed(0)} Min., Fahrgäste gestern ${l.riders}, Auslastung ${(l.load * 100).toFixed(0)} %, Kosten ${fmt(TPS.lineUpkeep(g, l))} €/Tag${l.broken ? ' UNTERBROCHEN: ' + l.broken : ''}`);
  const hist = t.hist;
  const last = hist.slice(-5);
  const riders = last.reduce((a, h) => a + h.riders, 0) / Math.max(1, last.length);
  ok(t.lines.length >= 2, `mindestens zwei Linien in Betrieb (${t.lines.length})`);
  ok(riders > 20, `Bus/Tram befördern Fahrgäste (Ø ${fmt(riders)} pro Tag zuletzt)`);
  ok(t.share > 0.005, `ÖPNV senkt den Autoanteil (Bus/Tram-Anteil ${(t.share * 100).toFixed(1)} %)`);
  ok(s.transitShare >= t.share * 0.85 - 1e-6, `Pendleranteil im Kern enthält Bus/Tram (${(s.transitShare * 100).toFixed(1)} %)`);
  ok(t.lines.every((l) => !l.broken), 'keine Linie unterbrochen');
  ok(t.vehicles.every((v) => Number.isFinite(v.s)), 'Fahrzeugpositionen endlich');
  const moved = t.vehicles.filter((v) => v.s > 0.01).length;
  ok(moved > 0, `Fahrzeuge sind unterwegs (${moved}/${t.vehicles.length} nicht am Start)`);
  ok(Number.isFinite(b.net), 'Haushalt endlich');
  ok((b.inc.tp_fares || 0) >= 0 && (b.exp.tp_lines || 0) > 0, 'Fahrgeld und Linienkosten im Haushalt');
  ok(g.money > -25000, `Stadtkasse nicht pleite (${fmt(g.money)} €)`);
  if (stationBuilt) ok(hist.slice(-3).some((h) => h.trains > 0), `Fernzüge halten am Hauptbahnhof (${hist.slice(-3).map((h) => h.trains).join('/')} pro Tag)`);
  checkRenderables(g, 'Teil A');
  // Speichern/Laden
  const data = JSON.stringify(g.serialize());
  const g2 = Game.fromSave(JSON.parse(data));
  const t2 = g2.ext.transport;
  ok(t2.lines.length === t.lines.length && t2.stops.length === t.stops.length, `Speichern/Laden: ${t2.lines.length} Linien, ${t2.stops.length} Halte`);
  ok(t2.lines.every((l) => l.path.length > 1 && !l.broken), 'geladene Linien haben Wege');
  for (let s2 = 0; s2 < 600; s2++) g2.update(0.1);
  ok(g2.ext.transport.vehicles.length === t.vehicles.length, `nach Laden ${g2.ext.transport.vehicles.length} Fahrzeuge`);
  ok(g2.ext.transport.day && g2.ext.transport.day.riders > 0, `nach Laden weiter Fahrgäste (${fmt(g2.ext.transport.day ? g2.ext.transport.day.riders : 0)})`);
  console.log('  Save-Größe', (data.length / 1024).toFixed(0), 'KB');
}

// ======================================================================= Teil B
console.log('\n=== Teil B: Sandkasten mit allen Anlagen ===');
const t1 = Date.now();
const s = new Game({ size: 96, seed: 77, mapType, difficulty: 'sandbox', name: 'Verkehrsstadt' });
s.sandboxNoEvents = true;
s.on('cards', (ids) => s.chooseCard(ids[0]));
buildDemoCity(s);
const HB = helpers(s);
const sy = s.world.highwayY, x0 = s.world.highwayEnd % s.W + 1;
HB.run(6);
const TB = () => s.ext.transport;
// Depots
ok(HB.place('bus_depot', x0 + 6, sy + 13).ok, 'Busdepot (Sandkasten)');
ok(HB.place('tram_depot', x0 + 22, sy - 14).ok, 'Straßenbahndepot');
HB.place('taxi_depot', x0 + 12, sy + 2);
HB.place('parking', x0 + 8, sy + 3);
const hub = HB.place('metro_hub', x0 + 17, sy - 3);
// Freie Fläche an der Außenseite des Rasters suchen (oberhalb der nördlichsten Straße)
const freeSpot = (w, h, yTop) => {
  for (let x = x0 + 2; x < x0 + 36; x++) {
    let free = true;
    for (let yy = yTop - h + 1; yy <= yTop && free; yy++) for (let xx = x; xx < x + w; xx++) { const i = yy * s.W + xx; if (s.bld[i] || s.road[i] || s.world.terrain[i] === 1 || s.world.terrain[i] === 3) free = false; }
    if (free) return [x, yTop - h + 1];
  }
  return null;
};
const north = sy - 12;
let ts = { ok: false };
{ const p = freeSpot(4, 2, north); if (p) ts = s.placeBuilding('train_station', p[0], p[1], 0); }
if (!ts.ok) ts = HB.place('train_station', x0 + 26, sy + 13, 0);
ok(ts.ok, 'Hauptbahnhof (Sandkasten)');
// Flughafen an der Südseite
let air = { ok: false };
{ const p = (() => { for (let x = x0 + 2; x < x0 + 30; x++) { let free = true; for (let yy = sy + 12; yy < sy + 16 && free; yy++) for (let xx = x; xx < x + 6; xx++) { const i = yy * s.W + xx; if (s.bld[i] || s.road[i] || s.world.terrain[i] === 1 || s.world.terrain[i] === 3) free = false; } if (free) return [x, sy + 12]; } return null; })(); if (p) air = s.placeBuilding('airport', p[0], p[1], 0); }
if (!air.ok) air = HB.place('airport', x0 + 14, sy + 14);
ok(air.ok, 'Flughafen gebaut');
// Fähranleger an zwei Ufern desselben (größten) Gewässers suchen
const lab = new Int32Array(s.N).fill(-1);
const bodies = [];
for (let i = 0; i < s.N; i++) {
  if (s.world.terrain[i] !== 1 || lab[i] >= 0) continue;
  const q = [i], tiles = [];
  lab[i] = bodies.length;
  while (q.length) { const c = q.pop(); tiles.push(c); const x = c % s.W, y = (c / s.W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= s.W || ny >= s.H) continue; const j = ny * s.W + nx; if (s.world.terrain[j] === 1 && lab[j] < 0) { lab[j] = bodies.length; q.push(j); } } }
  bodies.push(tiles);
}
bodies.sort((a, b) => b.length - a.length);
const water = bodies[0] || [];
const piers = [];
for (const i of water) {
  if (piers.length >= 2) break;
  const x = i % s.W, y = (i / s.W) | 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy, j = ny * s.W + nx;
    if (nx < 1 || ny < 1 || nx >= s.W - 1 || ny >= s.H - 1 || s.world.terrain[j] === 1 || s.bld[j] || s.road[j]) continue;
    if (piers.length && Math.hypot(nx - piers[0].x, ny - piers[0].y) < 14) continue;
    // Straße zum Anleger
    const rx = nx + dx, ry = ny + dy;
    if (rx < 0 || ry < 0 || rx >= s.W || ry >= s.H || s.world.terrain[ry * s.W + rx] === 1) continue;
    s.buildRoad([ry * s.W + rx], R.STREET);
    const r = s.placeBuilding('ferry_pier', nx, ny);
    if (r.ok) { piers.push({ x: nx, y: ny }); break; }
  }
}
HB.run(1);
ok(TB().ferries.length >= (piers.length >= 2 ? 1 : 0), `Fährrouten: ${TB().ferries.length} (Anleger ${piers.length})`);
// Linien
const st = (x, y, m) => HB.stopTile(x, y, m);
const L1 = TPS.createLine(s, 'bus', [st(x0 + 5, sy - 6), st(x0 + 10, sy - 6), st(x0 + 15, sy - 6), st(x0 + 20, sy - 6), st(x0 + 30, sy - 6)].filter((t) => t >= 0));
ok(L1.ok, 'Sandkasten-Buslinie 1 ' + (L1.msg || ''));
const L2 = TPS.createLine(s, 'bus', [st(x0 + 8, sy - 11), st(x0 + 8, sy - 3), st(x0 + 8, sy + 3), st(x0 + 13, sy + 6), st(x0 + 23, sy + 11)].filter((t) => t >= 0));
ok(L2.ok, 'Sandkasten-Buslinie 2 ' + (L2.msg || ''));
const L3 = TPS.createLine(s, 'bus', [st(x0 + 5, sy - 11), st(x0 + 15, sy - 11), st(x0 + 18, sy - 2), st(x0 + 5, sy - 4)].filter((t) => t >= 0), true);
ok(L3.ok && L3.line.loop, 'Ringlinie ' + (L3.msg || ''));
const LT = TPS.createLine(s, 'tram', [st(x0 + 2, sy, 'tram'), st(x0 + 12, sy, 'tram'), st(x0 + 24, sy, 'tram'), st(x0 + 32, sy, 'tram')].filter((t) => t >= 0));
ok(LT.ok, 'Straßenbahn auf der Allee ' + (LT.msg || ''));
ok(!!TPS.canStop(s, (sy - 3) * s.W + x0 + 6, 'tram'), 'Tram-Halt neben der Straße abgelehnt: ' + TPS.canStop(s, (sy - 3) * s.W + x0 + 6, 'tram'));
{ let inter = -1; for (let i = 0; i < s.N && inter < 0; i++) if (TPS.isIntersection(s, i) && s.world.terrain[i] !== 1) inter = i; ok(TPS.canStop(s, inter, 'bus') === 'Nicht auf einer Kreuzung', 'Halt auf Kreuzung abgelehnt'); }
if (L1.ok) TPS.setVehicles(s, L1.line.id, 3);
if (LT.ok) { TPS.setVehicles(s, LT.line.id, 2); TPS.setVehicleType(s, LT.line.id, 'tram_long'); }
if (L2.ok) TPS.setVehicleType(s, L2.line.id, 'gelenk');
ok(!L2.ok || TB().lines.find((l) => l.id === L2.line.id).vtype === 'gelenk', 'Fahrzeugtyp gewechselt (Gelenkbus)');
// Bearbeiten: Haltestelle einfügen, verlängern, entfernen
if (L1.ok) {
  const line = TB().lines.find((l) => l.id === L1.line.id);
  const mid = line.path[Math.floor((line.stopIdx[1] + line.stopIdx[2]) / 2)];
  const ins = TPS.insertStop(s, mid);
  ok(ins.ok || /Kreuzung|Kurve|Brücke/.test(ins.msg), 'Haltestelle einfügen: ' + (ins.ok ? 'ok' : ins.msg));
  const n0 = line.stops.length;
  const ext = TPS.extendLine(s, line.id, [st(x0 + 30, sy - 11)].filter((t) => t >= 0), false);
  ok(ext.ok && line.stops.length === n0 + 1, 'Linie am Ende verlängert ' + (ext.msg || ''));
  const ext2 = TPS.extendLine(s, line.id, [st(x0 + 5, sy - 1)].filter((t) => t >= 0), true);
  ok(ext2.ok, 'Linie am Anfang verlängert ' + (ext2.msg || ''));
}
// Ampeln umschalten
let inter = -1;
for (let i = 0; i < s.N && inter < 0; i++) if (TPS.isIntersection(s, i) && !TB().signalSet.has(i)) inter = i;
if (inter >= 0) {
  TPS.cycleSignal(s, inter);
  ok(TB().signalSet.has(inter), 'Ampel von Hand eingeschaltet');
  TPS.cycleSignal(s, inter);
  ok(!TB().signalSet.has(inter), 'Ampel von Hand ausgeschaltet');
  TPS.cycleSignal(s, inter);
}
// Zubringer: Pulsbahn-Linie und eine Buslinie mit Halt an einer Station
let feederLine = null;
{
  const a = HB.station(x0 + 11, sy - 11), b = HB.station(x0 + 31, sy + 11);
  if (a && b) s.createLine([a.id, b.id], false);
  const tA = a ? a.y * s.W + a.x : -1;
  const ok1 = a && !TPS.canStop(s, tA, 'bus');
  const r = ok1 ? TPS.createLine(s, 'bus', [tA, st(x0 + 11, sy - 3), st(x0 + 11, sy + 6)].filter((t) => t >= 0)) : { ok: false, msg: 'Station nicht auf geradem Straßenstück' };
  feederLine = r.ok ? r.line : null;
  console.log('    Zubringerlinie:', r.ok ? 'ok' : r.msg);
}
let maxR = 0, sawTrain = 0, sawPlane = 0, sawFerry = 0, sawTaxi = 0, sawBus = 0, sawTram = 0, sawAcc = 0, accMax = 0;
HB.run(14, () => {
  const rs = s.renderables();
  maxR = Math.max(maxR, rs.length);
  for (const o of rs) {
    if (o.kind === 'train_loco') sawTrain++;
    else if (o.kind === 'plane') sawPlane++;
    else if (o.kind === 'ferry') sawFerry++;
    else if (o.kind === 'taxi') sawTaxi++;
    else if (o.kind === 'bus') sawBus++;
    else if (o.kind === 'tram') sawTram++;
    else if (o.kind === 'ambulance' || (o.kind === 'car' && o.wreck)) sawAcc++;
  }
  accMax = Math.max(accMax, TB().accidents.length);
});
// Unfall erzwingen: viel Verkehr auf einer Kreuzung ohne Ampel
{
  const T2 = TB();
  let inter = -1;
  for (let i = 0; i < s.N && inter < 0; i++) if (TPS.isIntersection(s, i) && !T2.signalSet.has(i)) inter = i;
  const before = T2.totals.accidents;
  for (let k = 0; k < 400 && T2.totals.accidents === before; k++) { s.trafficLoad[inter] = 900; TPS.debugAccidents(s, 12); }
  ok(T2.totals.accidents > before, 'Unfall an einer stark belasteten Kreuzung ohne Ampel');
  const a = T2.accidents[T2.accidents.length - 1];
  const sys = s.system('transport');
  sys.hourly(s, 12);
  ok(a && s.congestion[a.tile] >= 1.7, `Unfallstelle blockiert die Kreuzung (Auslastung ${a ? Math.round(s.congestion[a.tile] * 100) : 0} %)`);
  const rs = s.renderables();
  ok(rs.some((o) => o.wreck) , 'Unfallwagen sichtbar');
  // Ampel: Wartezeit, aber deutlich seltener Unfälle
  T2.signalMode.set(inter, 1); TPS.cycleSignal(s, inter); TPS.cycleSignal(s, inter); TPS.cycleSignal(s, inter);
}
const tb = TB();
console.log(`  bewegliche Objekte max. ${maxR} pro Bild · gesehen: Busse ${sawBus} Trams ${sawTram} Züge ${sawTrain} Flugzeuge ${sawPlane} Fähren ${sawFerry} Taxis ${sawTaxi} Unfallstellen ${sawAcc}`);
ok(sawBus > 0 && sawTram > 0, 'Busse und Straßenbahnen sichtbar');
ok(sawTrain > 0, 'Fernzüge sichtbar');
ok(!air.ok || sawPlane > 0, 'Flugzeuge sichtbar');
ok(piers.length < 2 || tb.ferries.length === 0 || sawFerry > 0, 'Fähren sichtbar');
ok(sawTaxi > 0, 'Taxis sichtbar');
ok(tb.signals.length > 0, `Ampeln an großen Kreuzungen: ${tb.signals.length}`);
if (feederLine) {
  const fw = [...s.transit.stations.values()].reduce((a, st2) => a + st2.waiting.filter((p) => p.feeder).length, 0);
  ok(tb.stops.some((x) => x.feeder) && (tb.day.feeder > 0 || tb.today.feeder > 0), `Zubringer zur Pulsbahn: gestern ${fmt(tb.day.feeder)} Umsteiger, ${fw} warten gerade an Stationen`);
}
ok(tb.totals.trains > 0 && tb.totals.flights >= (air.ok ? 1 : 0), `Fernverkehr: ${tb.totals.trains} Züge, ${tb.totals.flights} Flüge, Fähre ${fmt(tb.totals.ferry)} Fahrgäste, Taxi ${tb.totals.taxi} Fahrten`);
ok(!hub.ok || [...tb.hubs.values()].every((sid) => s.transit.stations.has(sid)), 'Umsteigebahnhof hat eine Pulsbahn-Station');
console.log(`  Unfälle gesamt ${tb.totals.accidents} (gleichzeitig max. ${accMax}), Einkommen Fernverkehr gestern ${fmt(tb.day.long)} €`);
checkRenderables(s, 'Teil B');
// Straße unter einer Linie abreißen → Linie wird neu geführt oder als unterbrochen gemeldet
if (L1.ok) {
  const line = tb.lines.find((l) => l.id === L1.line.id);
  const mid = line.path[Math.floor(line.path.length / 2)];
  const isStop = !!TPS.stopAtTile(s, mid);
  s.bulldoze([mid]);
  HB.run(1);
  const l2 = s.ext.transport.lines.find((l) => l.id === L1.line.id);
  ok(!l2 || l2.broken || l2.path.length > 1, `Straßenabriss: Linie ${!l2 ? 'eingestellt' : l2.broken ? 'unterbrochen gemeldet' : 'umgeleitet'}${isStop ? ' (Halt war betroffen)' : ''}`);
}
// Haltestelle entfernen
{
  const stop = s.ext.transport.stops[0];
  const n = s.ext.transport.stops.length;
  const r = TPS.removeStop(s, stop.id);
  ok(r.ok && s.ext.transport.stops.length < n, 'Haltestelle entfernt');
}
// Linie löschen
{
  const n = s.ext.transport.lines.length;
  const id = s.ext.transport.lines[s.ext.transport.lines.length - 1].id;
  TPS.removeLine(s, id);
  ok(s.ext.transport.lines.length === n - 1 && !s.ext.transport.vehicles.some((v) => v.line === id), 'Linie gelöscht, Fahrzeuge zurück im Depot');
}
// Speichern/Laden im Sandkasten
{
  const data = JSON.stringify(s.serialize());
  const s2 = Game.fromSave(JSON.parse(data));
  for (let k = 0; k < 300; k++) s2.update(0.1);
  const t2 = s2.ext.transport;
  ok(t2.lines.length === s.ext.transport.lines.length, `Sandkasten geladen: ${t2.lines.length} Linien, ${t2.signals.length} Ampeln, ${t2.ferries.length} Fähren, ${t2.rail.size} Bahnhof, ${t2.air.size} Flughafen`);
  ok(t2.signalMode.size === s.ext.transport.signalMode.size, 'Ampel-Einstellungen gespeichert');
  checkRenderables(s2, 'nach Laden');
}
// Leistung: renderables und Stunde
{
  const n = 400;
  let a = performance.now();
  for (let k = 0; k < n; k++) s.renderables();
  const perFrame = (performance.now() - a) / n;
  a = performance.now();
  const sys = s.system('transport');
  for (let k = 0; k < 24; k++) sys.hourly(s, k);
  const perHour = (performance.now() - a) / 24;
  console.log(`  Leistung: renderables ${perFrame.toFixed(3)} ms/Bild, Stundenrechnung ${perHour.toFixed(2)} ms`);
  ok(perFrame < 2 && perHour < 40, 'Rechenzeit im Rahmen');
}
console.log('Laufzeit Teil B', ((Date.now() - t1) / 1000).toFixed(1), 's');

// ======================================================================= Teil C
console.log('\n=== Teil C: Panel, Inspektor und Werkzeug ohne Browser ===');
{
  const { PANELS, INSPECTORS, TOOLS, TRAY_ITEMS } = await import('../src/registry.js');
  await import('../src/ui/panels/transport.js');
  await import('../src/input/buslines.js');
  const g3 = s;
  const toasts = [];
  const ui = {
    g: g3, view: 'none', el: { insp: { addEventListener() {} } },
    toast: (m, k) => toasts.push([m, k]), closePanels() {}, openPanel() {}, setView(v) { this.view = v; }, inspect() {}, renderInspector() {}, tooltip() {}, floatMoney() {},
    app: { audio: { play() {} }, engine: { rig: { focus() {} } } },
  };
  const input = {
    g: g3, ui, audio: ui.app.audio, mouse: { x: 0, y: 0 }, tool: { kind: 'select' }, hover: null,
    e: { canvas: { addEventListener() {} }, overlay: { showRadius() {}, hideRadius() {}, showTiles() {} } },
    setTool(t) { const old = TOOLS[this.tool.kind]; if (old && old.cancel) old.cancel(this); this.tool = t || { kind: 'select' }; },
  };
  ui.app.input = input;
  const panel = PANELS.find((p) => p.id === 'transport');
  ok(!!panel, 'Panel „Verkehr & ÖPNV" registriert');
  let htmlOk = true;
  for (const tab of ['overview', 'lines', 'long', 'roads']) {
    try { panel.click(ui, 'tab', { dataset: { k: tab } }); const html = panel.render(ui); if (!html || html.length < 200 || /undefined|NaN/.test(html)) { htmlOk = false; console.log('    Reiter', tab, 'verdächtig:', (html.match(/.{0,40}(undefined|NaN).{0,40}/) || [''])[0]); } } catch (e) { htmlOk = false; console.log('    Reiter', tab, e.message); }
  }
  ok(htmlOk, 'alle Reiter rendern ohne Fehler, ohne „undefined"/„NaN"');
  const l0 = g3.ext.transport.lines[0];
  const n0 = l0.nveh;
  panel.click(ui, 'veh+', { dataset: { l: String(l0.id) } });
  ok(l0.nveh === n0 + 1, 'Panel: Fahrzeug hinzugefügt');
  panel.click(ui, 'fare', { dataset: { v: '0' } });
  ok(g3.ext.transport.fare === 0, 'Panel: Fahrpreis auf gratis');
  panel.click(ui, 'fare', { dataset: { v: '2' } });
  // Inspektor
  let inspOk = true;
  for (const st of g3.ext.transport.stops.slice(0, 3)) {
    for (const fn of INSPECTORS) { try { const h = fn(ui, { type: 'road', i: st.tile }); if (h && /undefined|NaN/.test(h)) inspOk = false; } catch (e) { inspOk = false; console.log('    Inspektor', e.message); } }
  }
  for (const b of [...g3.buildings.values()].filter((b) => !b.zone).slice(0, 40)) for (const fn of INSPECTORS) { try { const h = fn(ui, { type: 'building', id: b.id }); if (h && /undefined|NaN/.test(h)) { inspOk = false; console.log('    Inspektor', b.key, (h.match(/.{0,40}(undefined|NaN).{0,40}/) || [''])[0]); } } catch (e) { inspOk = false; console.log('    Inspektor', b.key, e.message); } }
  ok(inspOk, 'Inspektor-Zusätze ohne Fehler');
  // Werkzeugleiste
  const items = TRAY_ITEMS.filter((t) => t.cat === 'transport').map((t) => t.item(g3));
  ok(items.length >= 4 && items.every((it) => it && it.name), `Werkzeugleiste: ${items.map((it) => it.name).join(', ')}`);
  // Werkzeug: Linie mit drei Klicks und Enter
  const tool = TOOLS.buslines;
  input.setTool({ kind: 'buslines', type: 'bus' });
  const sy3 = g3.world.highwayY, x03 = g3.world.highwayEnd % g3.W + 1;
  const tiles = [[x03 + 6, sy3 + 11], [x03 + 16, sy3 + 11], [x03 + 26, sy3 + 11]].map(([x, y]) => HB.stopTile(x, y)).filter((t) => t >= 0);
  const nl = g3.ext.transport.lines.length;
  for (const t of tiles) { const tt = { x: t % g3.W, y: (t / g3.W) | 0, i: t }; tool.hover(input, tt); tool.up(input, tt); }
  tool.key(input, { code: 'Enter' });
  ok(g3.ext.transport.lines.length === nl + 1, `Werkzeug: Linie per Klick und Enter gebaut (${tiles.length} Halte)${toasts.length ? ' · ' + toasts[toasts.length - 1][0] : ''}`);
  // Ampel-Werkzeug
  input.setTool({ kind: 'buslines', type: 'signal' });
  let inter = -1;
  for (let i = 0; i < g3.N && inter < 0; i++) if (TPS.isIntersection(g3, i)) inter = i;
  const before = TPS.signalState(g3, inter).mode;
  tool.up(input, { x: inter % g3.W, y: (inter / g3.W) | 0, i: inter });
  ok(TPS.signalState(g3, inter).mode !== before, 'Werkzeug: Ampel umgeschaltet');
  // Haltestellen-Werkzeug: entfernen
  input.setTool({ kind: 'buslines', type: 'stop' });
  const st0 = g3.ext.transport.stops[g3.ext.transport.stops.length - 1];
  tool.up(input, { x: st0.x, y: st0.y, i: st0.tile });
  ok(!TPS.stopAtTile(g3, st0.tile), 'Werkzeug: Haltestelle entfernt');
  input.setTool({ kind: 'select' });
}
console.log(`\n${checks - fails}/${checks} Prüfungen bestanden${fails ? ` – ${fails} FEHLER` : ''}.`);
process.exit(fails ? 1 : 0);
