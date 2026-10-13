// System „Verkehr & ÖPNV" (Agent S3).
// Buslinien und Straßenbahnen (Haltestellen an der Straße, Wege über das echte Straßennetz, Takt, Auslastung,
// Umstiege, Zubringer zur Pulsbahn), Fernbahn am Hauptbahnhof, Flughafen, Fähren, Taxis, Parkhäuser,
// Ampeln an großen Kreuzungen (Zeitverlust, aber weniger Unfälle), Unfälle, Pulsbahn-Umsteigebahnhof.
//
// Zustand: g.ext.transport (Vertrag 6.6: stops: [{ id, tile, side, lines }], lines: [...]).
// Bewegliche Objekte über renderables(g) (Vertrag 6.3): bus, tram, taxi, train_loco, train_wagon, plane, ferry,
// police, ambulance, car (Unfallwagen). Keine Imports aus render/ oder ui/ – läuft headless im Test.
//
// Zwei Zeitmaßstäbe (wie im übrigen Spiel): Fahrzeuge bewegen sich in Sim-Sekunden (sichtbares Tempo wie die Autos),
// Takt, Fahrzeit und Kapazität rechnen in „Erzählminuten" wie die Pendelzeit (1 Feld Straße ≈ 1,2 Minuten).
import { registerSystem, HAPPINESS_FACTORS, LANDVALUE_TERMS, DEMAND_MODIFIERS, BUDGET_LINES, BUILDING_PROBLEMS, emit } from '../../registry.js';
import { BUILDINGS, ROADS, R, T as TER, Z, TRANSIT, GAME_MIN_PER_SEC, DAY, MILESTONES } from '../../config.js';
import { MinHeap, clamp, hash2, mulberry32 } from '../../util.js';
import { forDisc } from '../services.js';
import { findPath } from '../network.js';

// ---------------------------------------------------------------- Daten

export const VEHICLE_TYPES = {
  bus: { id: 'bus', mode: 'bus', name: 'Stadtbus', cap: 30, cost: 900, upkeep: 16, speed: 1, len: 1.2, kind: 'bus', unlock: 1, diesel: true, desc: 'Günstig und robust. 30 Plätze.' },
  ebus: { id: 'ebus', mode: 'bus', name: 'Elektrobus', cap: 30, cost: 1500, upkeep: 18, speed: 1.03, len: 1.2, kind: 'bus', unlock: 2, desc: 'Leise und abgasfrei – Anwohner an der Strecke danken es. 30 Plätze.' },
  gelenk: { id: 'gelenk', mode: 'bus', name: 'Gelenkbus', cap: 52, cost: 1700, upkeep: 24, speed: 0.95, len: 1.8, kind: 'bus', unlock: 3, diesel: true, desc: 'Viel Platz für volle Linien. 52 Plätze.' },
  tram: { id: 'tram', mode: 'tram', name: 'Straßenbahn', cap: 110, cost: 3600, upkeep: 38, speed: 1.1, len: 1.15, segments: 2, kind: 'tram', unlock: 3, desc: 'Zwei Wagen, 110 Plätze, eigene Gleise.' },
  tram_long: { id: 'tram_long', mode: 'tram', name: 'Langzug', cap: 170, cost: 5200, upkeep: 52, speed: 1.05, len: 1.15, segments: 3, kind: 'tram', unlock: 4, desc: 'Drei Wagen, 170 Plätze.' },
};
export const VEHICLES_BY_MODE = { bus: ['bus', 'ebus', 'gelenk'], tram: ['tram', 'tram_long'] };

export const TP = {
  stopRadius: 3.2,          // Einzugsradius einer Haltestelle in Feldern
  stopCost: 150,
  stopUpkeep: 2,
  lineCost: { bus: 600, tram: 2400 },
  tileCost: { bus: 2, tram: 42 },     // Tram: Gleisbau pro neuem Feld
  lineUpkeep: { bus: 8, tram: 14 },
  trackUpkeep: 0.3,                   // Gleisunterhalt pro Feld und Tag
  maxVehicles: 12,
  maxStops: 32,
  fare: 2,
  fareMax: 4,
  dwellMin: 0.4,                      // Erzählminuten pro Halt
  feederRadius: 1.8,                  // Haltestelle ↔ Pulsbahn-Station: Umsteigepunkt
  maxTripMin: 75,
};

export const BUS_COLORS = [0xd6336c, 0x1c7ed6, 0x2b8a3e, 0xf08c00, 0x7048e8, 0x0c8599, 0xc92a2a, 0x5c940d, 0x862e9c, 0xe67700, 0x364fc7, 0xa61e4d];
export const BUS_COLOR_NAMES = ['Magenta', 'Blau', 'Grün', 'Orange', 'Violett', 'Petrol', 'Rot', 'Lindgrün', 'Purpur', 'Bernstein', 'Indigo', 'Beere'];
const TRAM_COLORS = [0xc92a2a, 0x2b8a3e, 0x1c7ed6, 0xf08c00, 0x862e9c, 0x0c8599];

const STREET_A = ['Linden', 'Ahorn', 'Birken', 'Kastanien', 'Rosen', 'Tulpen', 'Mühlen', 'Schul', 'Kirch', 'Garten', 'Wiesen', 'Wald', 'Berg', 'Brunnen', 'Markt', 'Post', 'Sonnen', 'Feld', 'Bach', 'Ulmen', 'Eichen', 'Holunder', 'Goethe', 'Schiller', 'Mozart', 'Fontane', 'Lessing', 'Heine', 'Röntgen', 'Humboldt', 'Kepler', 'Brahms', 'Uhland', 'Händel', 'Dürer', 'Kleist', 'Holbein', 'Rilke', 'Morgen', 'Weiden', 'Erlen', 'Kiefern', 'Flieder', 'Nelken', 'Lerchen', 'Amsel', 'Falken', 'Hirsch', 'Fuchs', 'Kranich'];
const STREET_B = ['straße', 'weg', 'allee', 'platz', 'gasse', 'ring', 'ufer', 'damm', 'steig', 'hof'];
const PLACE_NAMES = { townhall: 'Rathaus', hospital: 'Klinikum', clinic: 'Ärztehaus', school: 'Schulzentrum', university: 'Universität', library: 'Stadtbibliothek', train_station: 'Hauptbahnhof', airport: 'Flughafen', citypark: 'Stadtpark', park: 'Am Park', plaza: 'Brunnenplatz', stadium: 'Stadion', opera: 'Oper', police: 'Polizeiwache', fire: 'Feuerwache', ferry_pier: 'Fähranleger', bus_depot: 'Betriebshof', tram_depot: 'Straßenbahnhof', cathedral: 'Dom', castle: 'Schloss', museum: 'Museum', zoo: 'Zoo', sports: 'Sportplatz', swimming_pool: 'Freibad', highschool: 'Gymnasium', doener: 'Mêrdîn’s', parking: 'Parkhaus', cemetery: 'Friedhof', fairground: 'Messe', themepark: 'Freizeitpark', ferris: 'Riesenrad' };

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N O S W (wie roadMask: 1, 2, 4, 8)
const gauss = (h, m, s) => Math.exp(-0.5 * ((h - m) / s) ** 2);
const LANE_OFF = { 1: 0.11, 2: 0.16, 3: 0.24, 4: 0.27 };

// ---------------------------------------------------------------- Zugriff

export function TS(g) { return g && g.ext && g.ext.transport; }
const stopMap = (T) => T._stopMap || (T._stopMap = new Map(T.stops.map((s) => [s.id, s])));
const lineMap = (T) => T._lineMap || (T._lineMap = new Map(T.lines.map((l) => [l.id, l])));
export function stopById(g, id) { return stopMap(TS(g)).get(id) || null; }
export function lineById(g, id) { return lineMap(TS(g)).get(id) || null; }
export function stopAtTile(g, tile) { const T = TS(g); return T && T.stopAt ? (stopMap(T).get(T.stopAt.get(tile)) || null) : null; }
function changed(T) { T.version++; T._stopMap = null; T._lineMap = null; T.dirty.graph = true; T.dirty.fields = true; }
export function lineLabel(l) { return l.mode === 'tram' ? `Tram ${l.num}` : `Bus ${l.num}`; }
export function lineColor(l) { return l.mode === 'tram' ? TRAM_COLORS[l.color % TRAM_COLORS.length] : BUS_COLORS[l.color % BUS_COLORS.length]; }
export function lineColorName(l) { return BUS_COLOR_NAMES[BUS_COLORS.indexOf(lineColor(l))] || 'Rot'; }

function news(g, key, text, mood, where, minGapMin = 360) {
  const T = TS(g);
  const last = T.newsAt[key] || -1e9;
  if (g.time - last < minGapMin) return;
  T.newsAt[key] = g.time;
  g.pushNews({ kind: 'transport', author: 'Verkehrsbetriebe', text, mood: mood || 'info', x: where ? where.x : undefined, y: where ? where.y : undefined });
}

// ---------------------------------------------------------------- Straßen-Helfer

function arms(g, i) {
  const { W, H, road } = g;
  const x = i % W, y = (i / W) | 0;
  let m = 0;
  if (y > 0 && road[i - W]) m |= 1;
  if (x < W - 1 && road[i + 1]) m |= 2;
  if (y < H - 1 && road[i + W]) m |= 4;
  if (x > 0 && road[i - 1]) m |= 8;
  return m;
}
const bits = (m) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
export function isIntersection(g, i) { return g.road[i] && g.road[i] !== R.HIGHWAY && bits(arms(g, i)) >= 3; }

function modeRoadOk(g, i, mode) {
  const r = g.road[i];
  if (!r) return false;
  if (mode === 'tram') return r === R.STREET || r === R.AVENUE;
  return true;
}

// Prüft, ob auf einem Straßenfeld eine Haltestelle stehen darf. Rückgabe: Fehlermeldung oder null.
export function canStop(g, tile, mode = 'bus') {
  if (tile < 0 || tile >= g.N) return 'Außerhalb der Karte';
  const r = g.road[tile];
  if (!r) return 'Haltestellen stehen an Straßen';
  if (r === R.HIGHWAY) return 'Nicht an der Autobahn';
  if (g.world.terrain[tile] === TER.WATER) return 'Nicht auf einer Brücke';
  if (mode === 'tram' && !modeRoadOk(g, tile, 'tram')) return 'Straßenbahnen fahren nur auf Straßen und Alleen';
  const m = arms(g, tile);
  const n = bits(m);
  if (n >= 3) return 'Nicht auf einer Kreuzung';
  if (n === 2 && m !== 5 && m !== 10) return 'Nicht in einer Kurve';
  return null;
}

function stopSide(g, tile) {
  const m = arms(g, tile);
  const { W } = g;
  const x = tile % W, y = (tile / W) | 0;
  let best = 2, bv = -1e9;
  for (let s = 0; s < 4; s++) {
    if (m & (1 << s)) continue;
    const nx = x + DIRS[s][0], ny = y + DIRS[s][1];
    if (nx < 0 || ny < 0 || nx >= W || ny >= g.H) continue;
    const j = ny * W + nx;
    let v = (s === 2 ? 0.3 : 0) + (s === 1 ? 0.2 : 0);
    if (g.bld[j]) v += 2;
    if (g.zone[j]) v += 1;
    if (g.world.terrain[j] === TER.WATER) v -= 3;
    if (v > bv) { bv = v; best = s; }
  }
  return best;
}

function makeStopName(g, tile) {
  const T = TS(g);
  const { W } = g;
  const x = tile % W, y = (tile / W) | 0;
  // Besondere Gebäude in der Nähe geben den Namen
  let bestD = 1e9, best = null;
  for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 2; xx <= x + 2; xx++) {
    if (xx < 0 || yy < 0 || xx >= W || yy >= g.H) continue;
    const b = g.buildings.get(g.bld[yy * W + xx]);
    if (!b || b.zone) continue;
    const nm = PLACE_NAMES[b.key] || (BUILDINGS[b.key] && BUILDINGS[b.key].landmark ? BUILDINGS[b.key].name : null);
    if (!nm || T.usedNames.has(nm)) continue;
    const d = Math.abs(xx - x) + Math.abs(yy - y);
    if (d < bestD) { bestD = d; best = nm; }
  }
  if (best) { T.usedNames.add(best); return best; }
  for (let k = 0; k < 60; k++) {
    const a = STREET_A[Math.floor(hash2(tile, k, 31) * STREET_A.length)];
    const b = STREET_B[Math.floor(hash2(k, tile, 77) * STREET_B.length)];
    const nm = a + b;
    if (!T.usedNames.has(nm)) { T.usedNames.add(nm); return nm; }
  }
  const nm = `Halt ${T.nextStop}`;
  T.usedNames.add(nm);
  return nm;
}

// A* über die Straßen (feste Kosten, damit Linien nicht mit dem Stau springen). Tram nur auf Straßen und Alleen.
const BUF = {};
export function routeTiles(g, from, to, mode = 'bus') {
  if (from < 0 || to < 0) return null;
  if (!modeRoadOk(g, from, mode) || !modeRoadOk(g, to, mode)) return null;
  if (from === to) return Int32Array.of(from);
  if (g.roadComp[from] !== g.roadComp[to]) return null;
  const { W, H, N, road } = g;
  let B = BUF[N];
  if (!B) B = BUF[N] = { gs: new Float32Array(N), came: new Int32Array(N), stamp: new Uint32Array(N), id: 0 };
  const sid = ++B.id;
  const { gs, came, stamp } = B;
  const tx = to % W, ty = (to / W) | 0;
  const heap = new MinHeap();
  gs[from] = 0; came[from] = -1; stamp[from] = sid;
  heap.push(from, 0);
  const hMul = 2 / 1.7;
  let found = false, iter = 0;
  while (heap.size) {
    const cur = heap.pop();
    if (cur === to) { found = true; break; }
    if (++iter > 80000) break;
    const cx = cur % W, cy = (cur / W) | 0;
    const gc = gs[cur];
    for (let d = 0; d < 4; d++) {
      const nx = cx + DIRS[d][0], ny = cy + DIRS[d][1];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (!road[n] || !modeRoadOk(g, n, mode)) continue;
      // Busse meiden die Autobahn, wenn es geht
      const c = (2 / ROADS[road[n]].speed) * (road[n] === R.HIGHWAY && mode === 'bus' ? 1.6 : 1);
      const ng = gc + c;
      if (stamp[n] !== sid || ng < gs[n]) {
        stamp[n] = sid; gs[n] = ng; came[n] = cur;
        heap.push(n, ng + (Math.abs(nx - tx) + Math.abs(ny - ty)) * hMul);
      }
    }
  }
  if (!found) return null;
  const rev = [];
  for (let c = to; c !== -1; c = came[c]) rev.push(c);
  rev.reverse();
  return Int32Array.from(rev);
}

// ---------------------------------------------------------------- Liniengeometrie

// Glatter Linienzug durch die Feldmitten, Kurven als quadratische Bézierkurven (wie die Autos).
function polyFromTiles(g, path) {
  const W = g.W;
  const pts = [];
  const tileD = new Float32Array(path.length);
  const cx = (k) => (path[k] % W) + 0.5;
  const cy = (k) => ((path[k] / W) | 0) + 0.5;
  let cum = [0];
  const push = (x, y) => {
    if (pts.length) {
      const px = pts[pts.length - 2], py = pts[pts.length - 1];
      const d = Math.hypot(x - px, y - py);
      if (d < 1e-4) return;
      cum.push(cum[cum.length - 1] + d);
    }
    pts.push(x, y);
  };
  const n = path.length;
  for (let k = 0; k < n; k++) {
    const x = cx(k), y = cy(k);
    if (k === 0 || k === n - 1) { push(x, y); tileD[k] = cum[cum.length - 1]; continue; }
    const ax = cx(k - 1), ay = cy(k - 1), bx = cx(k + 1), by = cy(k + 1);
    const d1x = x - ax, d1y = y - ay, d2x = bx - x, d2y = by - y;
    if (d1x === d2x && d1y === d2y) { push(x, y); tileD[k] = cum[cum.length - 1]; continue; }
    if (d1x === -d2x && d1y === -d2y) { push(x, y); tileD[k] = cum[cum.length - 1]; continue; } // Wende
    const Ax = (ax + x) / 2, Ay = (ay + y) / 2, Cx = (x + bx) / 2, Cy = (y + by) / 2;
    for (let s = 0; s <= 4; s++) {
      const t = s / 4, u = 1 - t;
      push(u * u * Ax + 2 * u * t * x + t * t * Cx, u * u * Ay + 2 * u * t * y + t * t * Cy);
      if (s === 2) tileD[k] = cum[cum.length - 1];
    }
  }
  return { pts: Float32Array.from(pts), cum: Float32Array.from(cum), tileD };
}

function buildLine(g, line) {
  const T = TS(g);
  const sm = stopMap(T);
  const stops = line.stops.map((id) => sm.get(id));
  line.broken = null;
  const n = stops.length;
  const fail = (msg) => { line.broken = msg; line.path = new Int32Array(0); line.pts = new Float32Array(0); line.cum = new Float32Array(0); line.len = 0; line.stopD = []; line.visits = []; line.segs = 0; line.edgeLoad = new Float32Array(2); return false; };
  if (n < 2 || stops.some((s) => !s)) return fail('Zu wenige Haltestellen');
  const segs = line.loop ? n : n - 1;
  const path = [];
  const stopIdx = [];
  for (let k = 0; k < segs; k++) {
    const a = stops[k], b = stops[(k + 1) % n];
    const p = routeTiles(g, a.tile, b.tile, line.mode);
    if (!p) { line.brokenAt = [a.id, b.id]; return fail(`Kein Weg zwischen ${a.name} und ${b.name}`); }
    if (k === 0) { for (const t of p) path.push(t); stopIdx.push(0); } else for (let j = 1; j < p.length; j++) path.push(p[j]);
    stopIdx.push(path.length - 1);
  }
  line.path = Int32Array.from(path);
  line.stopIdx = stopIdx;
  const geo = polyFromTiles(g, line.path);
  line.pts = geo.pts;
  line.cum = geo.cum;
  line.len = geo.cum[geo.cum.length - 1];
  line.stopD = stopIdx.map((pi) => geo.tileD[pi]);
  if (line.loop) line.stopD[line.stopD.length - 1] = line.len;
  // Halte in Fahrreihenfolge
  const visits = [];
  if (line.loop) for (let k = 0; k < n; k++) visits.push({ k, s: line.stopD[k], dir: 1 });
  else {
    for (let k = 0; k < n; k++) visits.push({ k, s: line.stopD[k], dir: k === n - 1 ? -1 : 1 });
    for (let k = n - 2; k >= 1; k--) visits.push({ k, s: line.stopD[k], dir: -1 });
  }
  line.visits = visits;
  line.segs = segs;
  line.edgeLoad = new Float32Array(segs * 2);
  return true;
}

// Position auf einem Linienzug: tile-Koordinaten (x, y) und Richtung (tx, ty)
export function polyPose(line, s, out) {
  const cum = line.cum, pts = line.pts;
  const n = cum.length;
  if (!n) { out.x = 0; out.y = 0; out.tx = 0; out.ty = 1; return out; }
  if (s <= 0) s = 0;
  if (s >= cum[n - 1]) s = cum[n - 1];
  let lo = 0, hi = n - 1;
  while (lo < hi - 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
  const k = Math.min(lo, n - 2);
  if (k < 0) { out.x = pts[0]; out.y = pts[1]; out.tx = 0; out.ty = 1; return out; }
  const L = cum[k + 1] - cum[k] || 1;
  const t = (s - cum[k]) / L;
  const ax = pts[k * 2], ay = pts[k * 2 + 1], bx = pts[k * 2 + 2], by = pts[k * 2 + 3];
  out.x = ax + (bx - ax) * t;
  out.y = ay + (by - ay) * t;
  out.tx = (bx - ax) / L;
  out.ty = (by - ay) / L;
  return out;
}

// ---------------------------------------------------------------- Zustand

function freshState(g) {
  return {
    v: 1,
    version: 0,
    stops: [],
    lines: [],
    vehicles: [],
    stopAt: new Map(),
    usedNames: new Set(),
    nextStop: 1, nextLine: 1, nextVeh: 1,
    num: { bus: 0, tram: 0 },
    free: { bus: 0, tram: 0 },
    fare: TP.fare,
    signals: [],
    signalSet: new Set(),
    signalMode: new Map(),   // Feld → 1 (Ampel an) | 0 (aus); fehlt = automatisch
    trackTiles: new Set(),
    accidents: [],
    accidentLog: [],
    hubs: new Map(),         // Gebäude-ID (metro_hub) → Pulsbahn-Station
    rail: new Map(),         // Gebäude-ID (train_station) → Fernbahn
    air: new Map(),          // Gebäude-ID (airport) → Flugbetrieb
    ferries: [],             // Fährrouten
    taxis: [],
    newsAt: {},
    ring: new Float32Array(24),
    faresToday: 0, longToday: 0,
    today: { riders: 0, bus: 0, tram: 0, transfers: 0, feeder: 0, rejected: 0, trains: 0, trainPax: 0, tourists: 0, flights: 0, flightPax: 0, ferry: 0, taxi: 0, accidents: 0, fares: 0, long: 0 },
    day: null,               // gestern
    hist: [],
    totals: { riders: 0, accidents: 0, trains: 0, flights: 0, ferry: 0, taxi: 0 },
    share: 0,
    feederAcc: 0,
    shareBase: 0, shareWrote: -1, tourBase: 0, tourWrote: -1, tourExtra: 0,
    demandMod: [0, 0, 0, 0, 0],
    tStep: g.time,
    dirty: { routes: true, graph: true, facilities: true, signals: true, fields: true, ferries: true },
    rng: mulberry32(((g.opts && g.opts.seed) || 1) * 2654435761 ^ 0x5eed),
  };
}

// ---------------------------------------------------------------- Linien bauen

function depotCapacity(g, mode) {
  const key = mode === 'tram' ? 'tram_depot' : 'bus_depot';
  const per = mode === 'tram' ? (BUILDINGS.tram_depot.trams || 6) : (BUILDINGS.bus_depot.buses || 8);
  let cap = 0;
  const comps = new Set();
  for (const b of g.buildings.values()) {
    if (b.key !== key) continue; // auch Depots im Bau zählen – Linien dürfen schon geplant werden
    cap += per;
    if (b.access >= 0) comps.add(g.roadComp[b.access]);
    // Tram-Depot: auch über angrenzende Straßen anbinden
    if (mode === 'tram') for (let yy = b.y - 1; yy <= b.y + b.h; yy++) for (let xx = b.x - 1; xx <= b.x + b.w; xx++) {
      if (xx < 0 || yy < 0 || xx >= g.W || yy >= g.H) continue;
      const j = yy * g.W + xx;
      if (g.road[j]) comps.add(g.roadComp[j]);
    }
  }
  return { cap, comps, any: cap > 0, depots: cap / per };
}
export function vehiclesInUse(g, mode) {
  let n = 0;
  for (const l of TS(g).lines) if (l.mode === mode) n += l.nveh;
  return n;
}
export function fleetInfo(g, mode) {
  const d = depotCapacity(g, mode);
  return { cap: d.cap, used: vehiclesInUse(g, mode), free: TS(g).free[mode] || 0, depots: d.depots };
}

export function modeUnlocked(g, mode) { return g.isUnlocked(mode === 'tram' ? 'tram_depot' : 'bus_depot'); }
export function modeLockReason(g, mode) { return g.lockReason(mode === 'tram' ? 'tram_depot' : 'bus_depot'); }

// Kosten und Prüfung einer neuen Linie (tiles: Straßenfelder der Haltestellen in Reihenfolge)
export function planLine(g, mode, tiles, loop = false, extendOf = null) {
  const T = TS(g);
  const out = { ok: false, msg: '', cost: 0, len: 0, newStops: 0, tracks: 0, paths: [] };
  if (!modeUnlocked(g, mode)) { out.msg = modeLockReason(g, mode); return out; }
  if (tiles.length < (extendOf ? 1 : 2)) { out.msg = 'Eine Linie braucht mindestens zwei Haltestellen.'; return out; }
  if (tiles.length > TP.maxStops) { out.msg = `Höchstens ${TP.maxStops} Haltestellen pro Linie.`; return out; }
  if (new Set(tiles).size !== tiles.length) { out.msg = 'Jede Haltestelle nur einmal pro Linie.'; return out; }
  for (const t of tiles) {
    const st = stopAtTile(g, t);
    const err = st ? (mode === 'tram' && !modeRoadOk(g, t, 'tram') ? 'Gleise brauchen Straße oder Allee' : null) : canStop(g, t, mode);
    if (err) { out.msg = err; return out; }
  }
  let seq = [...tiles];
  if (extendOf) {
    const L = lineById(g, extendOf.line);
    if (!L) { out.msg = 'Linie fehlt.'; return out; }
    const onLine = new Set(L.stops.map((id) => stopById(g, id).tile));
    if (tiles.some((t) => onLine.has(t))) { out.msg = 'Haltestelle liegt schon auf der Linie.'; return out; }
    const endTile = stopById(g, extendOf.atStart ? L.stops[0] : L.stops[L.stops.length - 1]).tile;
    // Klickreihenfolge geht vom Linienende nach außen
    if (extendOf.atStart) { seq = [...tiles].reverse(); seq.push(endTile); } else seq.unshift(endTile);
  }
  const segs = loop ? seq.length : seq.length - 1;
  const trackNew = new Set();
  let len = 0;
  for (let k = 0; k < segs; k++) {
    const p = routeTiles(g, seq[k], seq[(k + 1) % seq.length], mode);
    if (!p) { out.msg = mode === 'tram' ? 'Kein Gleisweg (nur Straßen und Alleen, zusammenhängend).' : 'Keine Straßenverbindung zwischen den Haltestellen.'; return out; }
    out.paths.push(p);
    len += p.length - 1;
    if (mode === 'tram') for (const t of p) if (!T.trackTiles.has(t)) trackNew.add(t);
  }
  const dep = depotCapacity(g, mode);
  if (!dep.any) { out.msg = mode === 'tram' ? 'Zuerst ein Straßenbahndepot bauen.' : 'Zuerst ein Busdepot bauen.'; return out; }
  if (!extendOf && !dep.comps.has(g.roadComp[seq[0]])) { out.msg = mode === 'tram' ? 'Das Straßenbahndepot liegt an einem anderen Straßennetz.' : 'Das Busdepot liegt an einem anderen Straßennetz.'; return out; }
  if (!extendOf && vehiclesInUse(g, mode) >= dep.cap) { out.msg = `Alle ${dep.cap} Fahrzeuge der Depots sind im Einsatz. Ein weiteres Depot bauen.`; return out; }
  let newStops = 0;
  for (const t of new Set(tiles)) if (!stopAtTile(g, t)) newStops++;
  const vt = VEHICLE_TYPES[mode === 'tram' ? 'tram' : 'bus'];
  const vehCost = extendOf ? 0 : (T.free[mode] > 0 ? 0 : vt.cost);
  out.cost = Math.round(((extendOf ? 0 : TP.lineCost[mode]) + len * TP.tileCost.bus + trackNew.size * (mode === 'tram' ? TP.tileCost.tram : 0) + newStops * TP.stopCost + vehCost) * g.costMul);
  out.len = len; out.newStops = newStops; out.tracks = trackNew.size; out.ok = true;
  return out;
}

function addStop(g, tile, mode) {
  const T = TS(g);
  const ex = stopAtTile(g, tile);
  if (ex) { if (mode === 'tram' && ex.mode === 'bus') ex.mode = 'both'; else if (mode === 'bus' && ex.mode === 'tram') ex.mode = 'both'; return ex; }
  const st = {
    id: T.nextStop++, tile, x: tile % g.W, y: (tile / g.W) | 0, side: stopSide(g, tile), name: makeStopName(g, tile), mode,
    lines: [], w: [0, 0, 0, 0, 0], lm: 0, tour: 0, waiting: 0, crowd: 0, takt: Infinity, feeder: 0, active: false,
    boardToday: 0, board: 0, alightToday: 0, alight: 0, rejectedToday: 0,
  };
  T.stops.push(st);
  T.stopAt.set(tile, st.id);
  changed(T);
  return st;
}

export function createLine(g, mode, tiles, loop = false) {
  const T = TS(g);
  if (loop && tiles.length < 3) loop = false;
  const plan = planLine(g, mode, tiles, loop);
  if (!plan.ok) return { ok: false, msg: plan.msg };
  if (!g.canAfford(plan.cost)) return { ok: false, msg: 'Nicht genug Geld.' };
  g.spend(plan.cost);
  const stops = tiles.map((t) => addStop(g, t, mode).id);
  const used = new Set(T.lines.filter((l) => l.mode === mode).map((l) => l.color));
  let color = 0;
  const palN = mode === 'tram' ? TRAM_COLORS.length : BUS_COLORS.length;
  while (used.has(color) && color < palN - 1) color++;
  const num = ++T.num[mode];
  const line = {
    id: T.nextLine++, mode, num, color, stops, loop: !!loop, vtype: mode === 'tram' ? 'tram' : 'bus', nveh: 1,
    ridersToday: 0, riders: 0, rHist: [], load: 0, loadHour: 0, transfersToday: 0, rejectedToday: 0, created: g.day(),
    path: new Int32Array(0), pts: new Float32Array(0), cum: new Float32Array(0), stopD: [], visits: [], len: 0, segMin: [], cycleMin: 0, takt: Infinity,
  };
  if (T.free[mode] > 0) T.free[mode]--;
  T.lines.push(line);
  changed(T);
  buildLine(g, line);
  syncTracks(g);
  respawnVehicles(g, line);
  updateStopLines(g);
  timings(g);
  news(g, 'newline' + line.id, `${lineLabel(line)} fährt jetzt: ${stops.length} Haltestellen von ${stopById(g, stops[0]).name} nach ${stopById(g, stops[stops.length - 1]).name}.`, 'good', null, 0);
  emit('transport:changed', { type: 'line', id: line.id });
  return { ok: true, cost: plan.cost, line };
}

export function extendLine(g, lineId, tiles, atStart) {
  const line = lineById(g, lineId);
  if (!line || line.loop) return { ok: false, msg: 'Ringlinien lassen sich nicht verlängern.' };
  if (line.stops.length + tiles.length > TP.maxStops) return { ok: false, msg: `Höchstens ${TP.maxStops} Haltestellen.` };
  const plan = planLine(g, line.mode, tiles, false, { line: lineId, atStart });
  if (!plan.ok) return { ok: false, msg: plan.msg };
  if (!g.canAfford(plan.cost)) return { ok: false, msg: 'Nicht genug Geld.' };
  g.spend(plan.cost);
  const ids = tiles.map((t) => addStop(g, t, line.mode).id);
  if (atStart) line.stops = [...ids.reverse(), ...line.stops];
  else line.stops = [...line.stops, ...ids];
  line.stops = line.stops.filter((s, k, a) => k === 0 || a[k - 1] !== s);
  rebuildAll(g);
  return { ok: true, cost: plan.cost };
}

export function removeLine(g, lineId) {
  const T = TS(g);
  const line = lineById(g, lineId);
  if (!line) return false;
  T.lines = T.lines.filter((l) => l.id !== lineId);
  T.vehicles = T.vehicles.filter((v) => v.line !== lineId);
  changed(T);
  pruneStops(g);
  rebuildAll(g);
  emit('transport:changed', { type: 'removeLine', id: lineId });
  return true;
}

// Fahrzeuge pro Linie setzen (kauft dazu, legt ab)
export function setVehicles(g, lineId, n) {
  const T = TS(g);
  const line = lineById(g, lineId);
  if (!line) return { ok: false };
  n = clamp(Math.round(n), 1, TP.maxVehicles);
  if (n === line.nveh) return { ok: true, cost: 0 };
  let cost = 0;
  if (n > line.nveh) {
    const dep = depotCapacity(g, line.mode);
    const add = n - line.nveh;
    if (vehiclesInUse(g, line.mode) + add > dep.cap) return { ok: false, msg: `Die Depots fassen nur ${dep.cap} ${line.mode === 'tram' ? 'Straßenbahnen' : 'Busse'}.` };
    const vt = VEHICLE_TYPES[line.vtype];
    const free = Math.min(add, T.free[line.mode] || 0);
    cost = Math.round((add - free) * vt.cost * g.costMul);
    if (!g.canAfford(cost)) return { ok: false, msg: 'Nicht genug Geld.' };
    g.spend(cost);
    T.free[line.mode] -= free;
  }
  line.nveh = n;
  respawnVehicles(g, line);
  timings(g);
  T.version++;
  return { ok: true, cost };
}

// Fahrzeugtyp der Linie wechseln (Umrüstung kostet die Hälfte des Neupreises je Fahrzeug)
export function setVehicleType(g, lineId, vtype) {
  const line = lineById(g, lineId);
  const vt = VEHICLE_TYPES[vtype];
  if (!line || !vt || vt.mode !== line.mode) return { ok: false };
  if (!g.sandbox && g.milestone < vt.unlock) return { ok: false, msg: `${vt.name} ab „${MILESTONES[vt.unlock].name}".` };
  if (line.vtype === vtype) return { ok: true, cost: 0 };
  const cost = Math.round(line.nveh * vt.cost * 0.5 * g.costMul);
  if (!g.canAfford(cost)) return { ok: false, msg: 'Nicht genug Geld.' };
  g.spend(cost);
  line.vtype = vtype;
  respawnVehicles(g, line);
  timings(g);
  TS(g).version++;
  return { ok: true, cost };
}
export function nextVehicleType(g, line) {
  const list = VEHICLES_BY_MODE[line.mode].filter((k) => g.sandbox || g.milestone >= VEHICLE_TYPES[k].unlock);
  const i = list.indexOf(line.vtype);
  return list[(i + 1) % list.length];
}

export function cycleLineColor(g, lineId) {
  const line = lineById(g, lineId);
  if (!line) return;
  line.color = (line.color + 1) % (line.mode === 'tram' ? TRAM_COLORS.length : BUS_COLORS.length);
  TS(g).version++;
}

export function setFare(g, fare) {
  TS(g).fare = clamp(Math.round(fare * 2) / 2, 0, TP.fareMax);
  TS(g).dirty.fields = true;
}

// Haltestelle in eine bestehende Linie einfügen (Feld liegt auf dem Linienweg)
export function insertStop(g, tile) {
  const T = TS(g);
  if (stopAtTile(g, tile)) return { ok: false, msg: 'Hier ist schon eine Haltestelle.' };
  const cands = [];
  for (const l of T.lines) {
    if (!l.path || !l.path.length) continue;
    for (let j = 0; j < l.path.length; j++) if (l.path[j] === tile) {
      let k = 0;
      while (k < l.stopIdx.length - 1 && l.stopIdx[k + 1] < j) k++;
      cands.push([l, k]);
      break;
    }
  }
  if (!cands.length) return { ok: false, msg: 'Feld liegt auf keiner Linie. Zum Einfügen auf den Linienweg klicken.' };
  const mode = cands.some(([l]) => l.mode === 'bus') ? 'bus' : 'tram';
  const err = canStop(g, tile, mode);
  if (err) return { ok: false, msg: err };
  const cost = Math.round(TP.stopCost * g.costMul);
  if (!g.canAfford(cost)) return { ok: false, msg: 'Nicht genug Geld.' };
  g.spend(cost);
  const st = addStop(g, tile, cands[0][0].mode);
  for (const [l, k] of cands) {
    const at = Math.min(k + 1, l.stops.length);
    l.stops.splice(at, 0, st.id);
    if (l.mode !== st.mode) st.mode = 'both';
  }
  rebuildAll(g);
  return { ok: true, cost, stop: st, lines: cands.map(([l]) => l) };
}

export function removeStop(g, stopId) {
  const T = TS(g);
  const st = stopById(g, stopId);
  if (!st) return { ok: false };
  const removed = [];
  for (const l of [...T.lines]) {
    if (!l.stops.includes(stopId)) continue;
    l.stops = l.stops.filter((s) => s !== stopId).filter((s, k, a) => k === 0 || a[k - 1] !== s);
    if (l.loop && l.stops.length < 3) l.loop = false;
    if (l.stops.length < 2) { T.lines = T.lines.filter((x) => x !== l); T.vehicles = T.vehicles.filter((v) => v.line !== l.id); removed.push(l); }
  }
  T.stops = T.stops.filter((s) => s.id !== stopId);
  T.stopAt.delete(st.tile);
  T.usedNames.delete(st.name);
  changed(T);
  pruneStops(g);
  rebuildAll(g);
  return { ok: true, removedLines: removed };
}

function pruneStops(g) {
  const T = TS(g);
  const used = new Set();
  for (const l of T.lines) for (const s of l.stops) used.add(s);
  const keep = [];
  for (const s of T.stops) {
    if (used.has(s.id)) keep.push(s);
    else { T.stopAt.delete(s.tile); T.usedNames.delete(s.name); }
  }
  if (keep.length !== T.stops.length) { T.stops = keep; changed(T); }
}

function updateStopLines(g) {
  const T = TS(g);
  for (const s of T.stops) { s.lines = []; s.hasBus = false; s.hasTram = false; }
  const sm = stopMap(T);
  for (const l of T.lines) for (const id of new Set(l.stops)) {
    const s = sm.get(id);
    if (!s) continue;
    s.lines.push(l.id);
    if (l.mode === 'tram') s.hasTram = true; else s.hasBus = true;
  }
  for (const s of T.stops) s.mode = s.hasTram && s.hasBus ? 'both' : s.hasTram ? 'tram' : 'bus';
}

function syncTracks(g) {
  const T = TS(g);
  T.trackTiles = new Set();
  for (const l of T.lines) if (l.mode === 'tram') for (const t of l.path) T.trackTiles.add(t);
}

function respawnVehicles(g, line) {
  const T = TS(g);
  const old = T.vehicles.filter((v) => v.line === line.id);
  T.vehicles = T.vehicles.filter((v) => v.line !== line.id);
  const nv = line.visits.length;
  for (let j = 0; j < line.nveh; j++) {
    const start = nv ? Math.floor((j * nv) / line.nveh) % nv : 0;
    const prev = old[j];
    const v = {
      id: prev ? prev.id : T.nextVeh++, line: line.id, vi: nv ? (start + 1) % nv : 0, dir: nv ? line.visits[start].dir : 1,
      s: nv ? line.visits[start].s : 0, tgt: 0, state: 'dwell', dwell: 0.3 + j * 0.15, pax: 0, vs: 0, v0: 1.5, color: Math.floor(T.rng() * 1000),
    };
    if (line.loop && nv && start === nv - 1) v.tgt = line.len;
    T.vehicles.push(v);
  }
}

// Alle Linien neu berechnen (nach Straßenänderungen, Laden, Bearbeiten)
function rebuildAll(g) {
  const T = TS(g);
  // Haltestellen auf verschwundenen Straßen löschen
  let lost = 0;
  for (const s of [...T.stops]) {
    if (!g.road[s.tile] || g.road[s.tile] === R.HIGHWAY) {
      lost++;
      for (const l of T.lines) l.stops = l.stops.filter((x) => x !== s.id).filter((x, k, a) => k === 0 || a[k - 1] !== x);
      T.stops = T.stops.filter((x) => x !== s);
      T.stopAt.delete(s.tile);
      T.usedNames.delete(s.name);
    } else s.side = stopSide(g, s.tile);
  }
  if (lost) {
    changed(T);
    for (const l of [...T.lines]) {
      if (l.loop && l.stops.length < 3) l.loop = false;
      if (l.stops.length < 2) { T.lines = T.lines.filter((x) => x !== l); T.vehicles = T.vehicles.filter((v) => v.line !== l.id); news(g, 'lost' + l.id, `${lineLabel(l)} wurde eingestellt – die Straße mit den Haltestellen ist weg.`, 'bad', null, 0); }
    }
    changed(T);
  }
  for (const l of T.lines) {
    const wasBroken = l.broken;
    const sigBefore = l.path ? l.path.length + ':' + l.stops.join(',') : '';
    buildLine(g, l);
    const sigAfter = l.path.length + ':' + l.stops.join(',');
    if (l.broken && !wasBroken) news(g, 'broken' + l.id, `${lineLabel(l)} ist unterbrochen: ${l.broken}.`, 'bad', null, 60);
    if (sigBefore !== sigAfter || T.vehicles.filter((v) => v.line === l.id).length !== l.nveh) respawnVehicles(g, l);
  }
  syncTracks(g);
  updateStopLines(g);
  changed(T);
  timings(g);
  T.dirty.routes = false;
}

// ---------------------------------------------------------------- Ampeln

export function signalScore(g, i) {
  const { W, road } = g;
  const x = i % W, y = (i / W) | 0;
  let sc = 0, n = 0;
  for (let d = 0; d < 4; d++) {
    const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
    if (nx < 0 || ny < 0 || nx >= W || ny >= g.H) continue;
    const r = road[ny * W + nx];
    if (!r) continue;
    n++;
    sc += r === R.LANE ? 0.5 : r === R.STREET ? 1 : 2;
  }
  return { score: sc, arms: n };
}

// Automatisch: große Kreuzungen (Alleen, oder viel Verkehr auf einer Kreuzung mit vier Armen)
export function signalAuto(g, i) {
  if (!g.road[i] || g.road[i] === R.HIGHWAY || g.world.terrain[i] === TER.WATER) return false;
  const { score, arms: n } = signalScore(g, i);
  if (n < 3) return false;
  if (score >= 4.5) return true;
  if (n === 4) {
    const cap = ROADS[g.road[i]].capacity;
    return g.trafficLoad[i] / cap > 0.42;
  }
  return false;
}
export function signalState(g, i) {
  const T = TS(g);
  if (!isIntersection(g, i)) return { possible: false };
  const m = T.signalMode.has(i) ? T.signalMode.get(i) : -1;
  return { possible: true, mode: m === -1 ? 'auto' : m ? 'an' : 'aus', on: T.signalSet.has(i), auto: signalAuto(g, i) };
}
export function cycleSignal(g, i) {
  const T = TS(g);
  if (!isIntersection(g, i)) return { ok: false, msg: 'Ampeln gibt es nur an Kreuzungen.' };
  const m = T.signalMode.has(i) ? T.signalMode.get(i) : -1;
  // automatisch → an → aus → automatisch
  if (m === -1) T.signalMode.set(i, 1);
  else if (m === 1) T.signalMode.set(i, 0);
  else T.signalMode.delete(i);
  updateSignals(g);
  return { ok: true, state: signalState(g, i) };
}
function updateSignals(g) {
  const T = TS(g);
  const list = [];
  for (let i = 0; i < g.N; i++) {
    if (!g.road[i] || g.road[i] === R.HIGHWAY) continue;
    if (bits(arms(g, i)) < 3) continue;
    const m = T.signalMode.has(i) ? T.signalMode.get(i) : -1;
    const on = m === 1 || (m === -1 && signalAuto(g, i));
    if (on) list.push(i);
  }
  for (const [i] of T.signalMode) if (!isIntersection(g, i)) T.signalMode.delete(i);
  const key = list.join(',');
  if (key !== T._sigKey) { T._sigKey = key; T.version++; }
  T.signals = list;
  T.signalSet = new Set(list);
  T.dirty.signals = false;
}
// Ampelphase für die Darstellung: 0 = Nord-Süd grün, 1 = Nord-Süd gelb, 2 = Ost-West grün, 3 = Ost-West gelb
export function signalPhase(g, i, time = g.time) {
  const cyc = 36; // Spielminuten
  const t = (time + hash2(i, 5, 9) * cyc) % cyc;
  return t < 15 ? 0 : t < 18 ? 1 : t < 33 ? 2 : 3;
}

// ---------------------------------------------------------------- Einrichtungen (Bahnhof, Flughafen, Fähren, Taxis, Parkhäuser, Umsteigebahnhof)

function scanFacilities(g) {
  const T = TS(g);
  const seen = { train: new Set(), air: new Set(), hub: new Set() };
  T.parking = [];
  T.taxiDepots = [];
  T.piers = [];
  T.landmarks = [];
  for (const b of g.buildings.values()) {
    if (b.zone) continue;
    if (b.key === 'train_station') { seen.train.add(b.id); if (!T.rail.has(b.id)) T.rail.set(b.id, { trains: [], nextAt: g.time + 40 + T.rng() * 60, track: 0, today: 0 }); }
    else if (b.key === 'airport') { seen.air.add(b.id); if (!T.air.has(b.id)) T.air.set(b.id, { flights: [], nextAt: g.time + 60 + T.rng() * 60, stand: 0, today: 0, first: true }); }
    else if (b.key === 'metro_hub') { seen.hub.add(b.id); ensureHub(g, b); }
    else if (b.key === 'parking') T.parking.push(b);
    else if (b.key === 'taxi_depot') T.taxiDepots.push(b);
    else if (b.key === 'ferry_pier') T.piers.push(b);
    const d = BUILDINGS[b.key];
    if (d && (d.landmark || d.tourism) && b.key !== 'airport' && b.key !== 'train_station') T.landmarks.push(b);
  }
  for (const id of [...T.rail.keys()]) if (!seen.train.has(id)) T.rail.delete(id);
  for (const id of [...T.air.keys()]) if (!seen.air.has(id)) T.air.delete(id);
  for (const [bid, sid] of [...T.hubs]) if (!seen.hub.has(bid)) {
    T.hubs.delete(bid);
    if (g.transit.stations.has(sid)) { g.transit.removeStation(sid); g.afterTransitChange(); }
  }
  T.taxis = T.taxis.filter((tx) => T.taxiDepots.some((b) => b.id === tx.depot));
  T.dirty.facilities = false;
  T.dirty.ferries = true;
  T.dirty.fields = true;
  T.version++;
}

function ensureHub(g, b) {
  const T = TS(g);
  const sid = T.hubs.get(b.id);
  if (sid && g.transit.stations.has(sid)) return;
  // Station auf dem Gebäude anlegen (Hochbahnsteig auf dem Umsteigebahnhof)
  for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) {
    const i = yy * g.W + xx;
    if (g.stationAt[i]) { T.hubs.set(b.id, g.stationAt[i]); return; }
  }
  const st = g.transit.addStation(b.x, b.y);
  st.hub = true;
  T.hubs.set(b.id, st.id);
  g.afterTransitChange();
  news(g, 'hub' + b.id, `Der Umsteigebahnhof ${st.name} ist fertig: doppelte Kapazität und schnellere Umstiege. Jetzt Pulsbahn-Linien anschließen.`, 'good', b, 0);
}

function hubStep(g, minutes) {
  const T = TS(g);
  if (!T.hubs.size) return;
  const tr = g.transit;
  const cap2 = (BUILDINGS.metro_hub.stationCapacity || 30);
  const hubSet = new Set(T.hubs.values());
  for (const sid of hubSet) {
    const st = tr.stations.get(sid);
    if (!st) continue;
    st.hub = true;
    // Kern zählt ab 14 Wartenden die Überfüllung hoch – bis zur doppelten Kapazität nehmen wir das zurück
    if (st.waiting.length > TRANSIT.stationCapacity && st.waiting.length <= cap2) st.over = Math.max(0, st.over - minutes / (TRANSIT.overcrowdDays * 1440) - minutes / 720);
  }
  // Schnelleres Umsteigen: Züge halten am Umsteigebahnhof kürzer
  for (const t of tr.trains) {
    if (t.state !== 'dwell') { t._hubCut = false; continue; }
    if (t._hubCut) continue;
    const line = tr.lines.find((l) => l.id === t.line);
    if (line && hubSet.has(line.stops[t.cur])) { t.dwell *= 0.55; t._hubCut = true; }
  }
}

// Gebäude-lokale Koordinaten → Welt (wie die Gebäude-Ansicht: Mittelpunkt + Drehung um y)
function localToWorld(g, b, lx, lz, out) {
  const rot = (b.rot || 0) * (Math.PI / 2);
  const cs = Math.cos(rot), sn = Math.sin(rot);
  out.x = b.x + b.w / 2 - g.W / 2 + lx * cs + lz * sn;
  out.z = b.y + b.h / 2 - g.H / 2 - lx * sn + lz * cs;
  out.rot = rot;
  return out;
}
export const STATION_LAYOUT = { tracks: [-0.25, -0.8], platform: [-0.62, -0.43], portal: 0.7, carLen: 0.62, locoLen: 0.72 };
export const AIRPORT_LAYOUT = { runwayZ: -1.25, runwayX: [-2.85, 2.85], taxiZ: -0.45, standZ: 0.45, stands: [-1.6, 0, 1.6] };

// Fernzug: Einfahrt aus dem Tunnelportal, Halt am Bahnsteig, Ausfahrt ins andere Portal
const TRAIN = { ta: 2.2, dwell: 1.8, td: 2.2 };
function trainCars(tr) { return tr.wagons + 1; }
function trainLen(tr) { return STATION_LAYOUT.locoLen + tr.wagons * STATION_LAYOUT.carLen; }
// Position der Zugspitze (lokales x, Richtung dir) zur Zeit seit Einfahrt (Sim-Sekunden)
function trainFront(def, tr, t) {
  const L = def.size[0] / 2;
  const len = trainLen(tr);
  const xStop = len / 2;
  const xStart = -L - len - 0.2;
  const D = xStop - xStart;
  if (t < TRAIN.ta) { const u = t / TRAIN.ta; return xStart + D * (1 - (1 - u) * (1 - u)); }
  if (t < TRAIN.ta + TRAIN.dwell) return xStop;
  const u = Math.min(1, (t - TRAIN.ta - TRAIN.dwell) / TRAIN.td);
  return xStop + (L + len + 0.2) * u * u + 0.0;
}

function railStep(g, minutes) {
  const T = TS(g);
  const h = g.hour();
  for (const [bid, R2] of T.rail) {
    const b = g.buildings.get(bid);
    if (!b) continue;
    const ok = b.construct >= 1 && b.powered && b.connected;
    R2.ok = ok;
    // abgelaufene Züge entfernen
    R2.trains = R2.trains.filter((tr) => (g.time - tr.t0) / GAME_MIN_PER_SEC < TRAIN.ta + TRAIN.dwell + TRAIN.td + 0.1);
    if (!ok) continue;
    if (g.time >= R2.nextAt) {
      const night = h < 5 || h >= 23.5;
      if (!night) {
        const track = R2.track;
        R2.track = 1 - R2.track;
        const busy = R2.trains.some((tr) => tr.track === track);
        if (!busy) {
          const ic = T.rng() < 0.45;
          const tr = { t0: g.time, track, dir: track === 0 ? 1 : -1, wagons: ic ? 4 : 2, ic, counted: false, color: ic ? 0xf2f2f0 : 0xd6312b };
          R2.trains.push(tr);
        }
      }
      const base = night ? 150 : 95 - Math.min(35, g.stats.pop / 400);
      R2.nextAt = g.time + base * (0.8 + T.rng() * 0.4);
    }
    // Ankünfte zählen (Fahrgäste, Touristen, Einnahmen)
    for (const tr of R2.trains) {
      const t = (g.time - tr.t0) / GAME_MIN_PER_SEC;
      if (!tr.counted && t >= TRAIN.ta) {
        tr.counted = true;
        const pax = Math.round((tr.ic ? 90 : 45) * (0.7 + T.rng() * 0.6) * (0.6 + Math.min(1.6, g.stats.pop / 6000)));
        const tour = Math.round(pax * (tr.ic ? 0.35 : 0.15) * (1 + g.stats.tourism / 1500));
        T.today.trains++; T.today.trainPax += pax; T.today.tourists += tour; T.totals.trains++;
        R2.today++;
        R2.lastPax = pax;
        const fee = (tr.ic ? 40 : 20) + pax * 0.3;
        T.longToday += fee; T.today.long += fee;
        b._arrivalPax = (b._arrivalPax || 0) + pax;
        if (T.totals.trains === 1) news(g, 'firsttrain', `Der erste ${tr.ic ? 'Intercity' : 'Regionalzug'} rollt in den Hauptbahnhof ein! ${pax} Fahrgäste steigen aus.`, 'good', b, 0);
        emit('transport:arrive', { kind: 'train', x: b.x, y: b.y, pax });
      }
    }
  }
}

// Flugzeug: Anflug, Landung, Rollen zur Parkposition, Abfertigung, Rollen, Start (lokale Koordinaten)
const FLIGHT = { app: 4.2, roll: 1.5, taxiIn: 1.6, park: 2.6, taxiOut: 1.6, take: 2.8 };
const FLIGHT_T = FLIGHT.app + FLIGHT.roll + FLIGHT.taxiIn + FLIGHT.park + FLIGHT.taxiOut + FLIGHT.take;
function polyAlong(pts, u, out) {
  // pts: [[x, z], …], u 0..1 nach Länge
  let tot = 0;
  const L = [];
  for (let k = 0; k < pts.length - 1; k++) { const d = Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]); L.push(d); tot += d; }
  let s = clamp(u, 0, 1) * tot;
  for (let k = 0; k < L.length; k++) {
    if (s <= L[k] || k === L.length - 1) {
      const t = L[k] ? Math.min(1, s / L[k]) : 0;
      const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
      out.x = ax + (bx - ax) * t; out.z = az + (bz - az) * t;
      out.yaw = Math.atan2(bx - ax, bz - az);
      return out;
    }
    s -= L[k];
  }
  return out;
}
function flightPose(fl, t, out) {
  const A = AIRPORT_LAYOUT;
  const rz = A.runwayZ, x0 = A.runwayX[0] + 0.25, x1 = A.runwayX[1] - 0.9;
  const sx = A.stands[fl.stand % A.stands.length];
  out.pitch = 0; out.y = 0.05; out.phase = '';
  let k = t;
  if (k < FLIGHT.app) {
    const u = k / FLIGHT.app;
    out.x = -70 + (x0 + 70) * u; out.z = rz; out.yaw = Math.PI / 2;
    out.y = 0.05 + 7.5 * Math.pow(1 - u, 1.15);
    out.pitch = -0.06 + 0.12 * u; out.phase = 'approach';
    return out;
  }
  k -= FLIGHT.app;
  if (k < FLIGHT.roll) {
    const u = k / FLIGHT.roll;
    out.x = x0 + (x1 - x0) * (1 - (1 - u) * (1 - u)); out.z = rz; out.yaw = Math.PI / 2; out.phase = 'roll';
    return out;
  }
  k -= FLIGHT.roll;
  if (k < FLIGHT.taxiIn) {
    polyAlong([[x1, rz], [x1 + 0.4, rz + 0.4], [x1 + 0.4, A.taxiZ], [sx, A.taxiZ], [sx, A.standZ]], k / FLIGHT.taxiIn, out); out.phase = 'taxi';
    return out;
  }
  k -= FLIGHT.taxiIn;
  if (k < FLIGHT.park) { out.x = sx; out.z = A.standZ; out.yaw = 0; out.phase = 'park'; return out; }
  k -= FLIGHT.park;
  if (k < FLIGHT.taxiOut) {
    polyAlong([[sx, A.standZ], [sx, A.taxiZ], [x0 - 0.1, A.taxiZ], [x0 - 0.1, rz]], k / FLIGHT.taxiOut, out); out.phase = 'taxi';
    return out;
  }
  k -= FLIGHT.taxiOut;
  const u = Math.min(1, k / FLIGHT.take);
  const dist = 75 * u * u;
  out.x = x0 + dist; out.z = rz; out.yaw = Math.PI / 2; out.phase = 'takeoff';
  const lift = Math.max(0, dist - 3.2);
  out.y = 0.05 + lift * 0.14;
  out.pitch = lift > 0 ? -0.16 : 0;
  return out;
}

function airStep(g) {
  const T = TS(g);
  const h = g.hour();
  for (const [bid, A] of T.air) {
    const b = g.buildings.get(bid);
    if (!b) continue;
    const ok = b.construct >= 1 && b.powered && b.connected;
    A.ok = ok;
    A.flights = A.flights.filter((f) => (g.time - f.t0) / GAME_MIN_PER_SEC < FLIGHT_T + 0.2);
    if (!ok) continue;
    if (g.time >= A.nextAt) {
      if (h >= 5 && h < 23) {
        const used = new Set(A.flights.map((f) => f.stand));
        let stand = -1;
        for (let k = 0; k < AIRPORT_LAYOUT.stands.length; k++) { const s = (A.stand + k) % AIRPORT_LAYOUT.stands.length; if (!used.has(s)) { stand = s; break; } }
        if (stand >= 0) {
          A.stand = (stand + 1) % AIRPORT_LAYOUT.stands.length;
          A.flights.push({ t0: g.time, stand, counted: false, livery: Math.floor(T.rng() * 6), big: T.rng() < 0.3 });
        }
      }
      A.nextAt = g.time + (220 - Math.min(80, g.stats.pop / 250)) * (0.8 + T.rng() * 0.4);
    }
    for (const f of A.flights) {
      const t = (g.time - f.t0) / GAME_MIN_PER_SEC;
      if (!f.landed && t >= FLIGHT.app) { f.landed = true; emit('plane', { x: b.x + b.w / 2, y: b.y + b.h / 2, phase: 'landing' }); }
      if (!f.tookOff && t >= FLIGHT_T - FLIGHT.take) { f.tookOff = true; emit('plane', { x: b.x + b.w / 2, y: b.y + b.h / 2, phase: 'takeoff' }); }
      if (!f.counted && t >= FLIGHT.app + FLIGHT.roll) {
        f.counted = true;
        const pax = Math.round((f.big ? 260 : 150) * (0.6 + T.rng() * 0.5));
        const tour = Math.round(pax * 0.45 * (1 + g.stats.tourism / 2000));
        T.today.flights++; T.today.flightPax += pax; T.today.tourists += tour; T.totals.flights++;
        A.today++;
        const fee = 120 + pax * 0.5;
        T.longToday += fee; T.today.long += fee;
        if (A.first) { A.first = false; news(g, 'firstflight', `Erster Linienflug gelandet! ${pax} Reisende kommen in die Stadt.`, 'good', b, 0); }
        emit('transport:arrive', { kind: 'plane', x: b.x, y: b.y, pax });
      }
    }
  }
}

// Fähren: Anleger über das Wasser verbinden (Breitensuche über Wasserfelder)
function dockTile(g, b) {
  // Das Modell (G6) erwartet das Wasser hinter dem Grundstück (lokal −z)
  if (b.w === 1 && b.h === 1) {
    const rot = (b.rot || 0) * (Math.PI / 2);
    const bx = b.x + Math.round(-Math.sin(rot)), by = b.y + Math.round(-Math.cos(rot));
    if (bx >= 0 && by >= 0 && bx < g.W && by < g.H) {
      const i = by * g.W + bx;
      if (g.world.terrain[i] === TER.WATER && !g.road[i]) return i;
    }
  }
  let best = -1, bv = -1;
  for (let yy = b.y - 1; yy <= b.y + b.h; yy++) for (let xx = b.x - 1; xx <= b.x + b.w; xx++) {
    if (xx < 0 || yy < 0 || xx >= g.W || yy >= g.H) continue;
    const inside = xx >= b.x && xx < b.x + b.w && yy >= b.y && yy < b.y + b.h;
    const corner = (xx === b.x - 1 || xx === b.x + b.w) && (yy === b.y - 1 || yy === b.y + b.h);
    if (inside || corner) continue;
    const i = yy * g.W + xx;
    if (g.world.terrain[i] !== TER.WATER || g.road[i]) continue;
    let v = 0;
    for (const [dx, dy] of DIRS) { const nx = xx + dx, ny = yy + dy; if (nx >= 0 && ny >= 0 && nx < g.W && ny < g.H && g.world.terrain[ny * g.W + nx] === TER.WATER) v++; }
    if (v > bv) { bv = v; best = i; }
  }
  return best;
}
function rebuildFerries(g) {
  const T = TS(g);
  const old = new Map(T.ferries.map((f) => [f.key, f]));
  const piers = T.piers.filter((b) => b.construct >= 1).map((b) => ({ b, dock: dockTile(g, b) })).filter((p) => p.dock >= 0);
  const routes = [];
  const { W, N } = g;
  const paired = new Set();
  for (const p of piers) {
    // BFS über Wasser (Brücken sperren nicht – Fähren fahren darunter durch)
    const prev = new Int32Array(N).fill(-2);
    const q = [p.dock];
    prev[p.dock] = -1;
    let found = null;
    const targets = new Map(piers.filter((o) => o !== p).map((o) => [o.dock, o]));
    for (let h = 0; h < q.length && !found; h++) {
      const c = q[h];
      if (h > 0 && targets.has(c)) {
        const o = targets.get(c);
        found = o;
        break;
      }
      const cx = c % W, cy = (c / W) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= g.H) continue;
        const j = ny * W + nx;
        if (prev[j] !== -2 || g.world.terrain[j] !== TER.WATER) continue;
        prev[j] = c;
        q.push(j);
      }
    }
    if (!found) continue;
    const key = [p.b.id, found.b.id].sort((a, c) => a - c).join('-');
    if (paired.has(key)) continue;
    paired.add(key);
    const tiles = [];
    for (let c = found.dock; c !== -1; c = prev[c]) tiles.push(c);
    tiles.reverse();
    if (tiles.length < 3) continue;
    // geglätteter Kurs (Chaikin)
    let pts = tiles.map((t) => [(t % W) + 0.5, ((t / W) | 0) + 0.5]);
    for (let it = 0; it < 3; it++) {
      const np = [pts[0]];
      for (let k = 0; k < pts.length - 1; k++) {
        const [ax, ay] = pts[k], [bx, by] = pts[k + 1];
        np.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
      }
      np.push(pts[pts.length - 1]);
      pts = np;
    }
    const flat = [];
    const cum = [0];
    for (let k = 0; k < pts.length; k++) {
      flat.push(pts[k][0], pts[k][1]);
      if (k) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    }
    const o = old.get(key);
    routes.push({
      key, a: p.b.id, b: found.b.id, tiles, pts: Float32Array.from(flat), cum: Float32Array.from(cum), len: cum[cum.length - 1],
      s: o ? Math.min(o.s, cum[cum.length - 1]) : 0, dir: o ? o.dir : 1, state: o ? o.state : 'dwell', dwell: o ? o.dwell : 1, pax: o ? o.pax : 0, vs: 0, ridersToday: o ? o.ridersToday : 0, riders: o ? o.riders : 0,
    });
  }
  T.ferries = routes;
  T.dirty.ferries = false;
  T.version++;
}
function ferryStep(g, dt) {
  const T = TS(g);
  for (const f of T.ferries) {
    let left = dt;
    let guard = 0;
    while (left > 1e-6 && guard++ < 4) {
      if (f.state === 'dwell') {
        if (f.dwell > left) { f.dwell -= left; left = 0; f.vs = 0; break; }
        left -= f.dwell; f.dwell = 0; f.state = 'move';
      } else {
        const tgt = f.dir > 0 ? f.len : 0;
        const rem = Math.abs(tgt - f.s);
        let v = 1.15;
        if (rem < 1.2) v *= 0.3 + 0.7 * rem / 1.2;
        const dep = f.dir > 0 ? f.s : f.len - f.s;
        if (dep < 1.2) v *= 0.3 + 0.7 * dep / 1.2;
        const st = v * left;
        if (st >= rem) {
          left -= rem / v; f.s = tgt; f.state = 'dwell'; f.dwell = 1.6; f.dir = -f.dir;
          // Fahrgäste: Einzugsgebiet beider Anleger
          const pax = Math.round(clamp(f.demand || 4, 2, 60));
          f.pax = pax; f.ridersToday += pax; T.today.ferry += pax; T.totals.ferry += pax;
          const fare = pax * 3; T.longToday += fare; T.today.long += fare;
        } else { f.s += f.dir * st; left = 0; f.vs = f.dir * v; }
      }
    }
  }
}
function ferryDemand(g) {
  const T = TS(g);
  const h = g.hour();
  const rush = 0.35 + gauss(h, 8, 1.6) + gauss(h, 17.5, 1.8) * 0.9 + gauss(h, 13, 3) * 0.4;
  for (const f of T.ferries) {
    let w = 0;
    for (const id of [f.a, f.b]) {
      const b = g.buildings.get(id);
      if (!b) continue;
      forDisc(g, b.x + 0.5, b.y + 0.5, 6, (t) => { const o = g.buildings.get(g.bld[t]); if (o && o.zone && o.x + o.y * g.W === t) w += o.occ; });
    }
    f.demand = (w * 0.012 + 3 + g.stats.tourism * 0.004) * rush;
  }
}

// Taxis: fahren über das Straßennetz zwischen Bahnhof, Flughafen, Wahrzeichen, Gewerbe und Wohnungen
function taxiStep(g, dt) {
  const T = TS(g);
  if (!T.taxiDepots || !T.taxiDepots.length) { T.taxis = []; return; }
  const h = g.hour();
  // Anzahl aktiver Taxis
  const want = new Map();
  for (const b of T.taxiDepots) {
    if (b.construct < 1 || !b.connected || b.access < 0) { want.set(b.id, 0); continue; }
    const night = h >= 21 || h < 2 ? 1.6 : h < 6 ? 0.4 : 1;
    const n = Math.round(clamp((1.5 + g.stats.tourism / 120 + g.stats.pop / 2500) * night, 1, BUILDINGS.taxi_depot.taxis || 10));
    want.set(b.id, n);
  }
  for (const b of T.taxiDepots) {
    const have = T.taxis.filter((t) => t.depot === b.id);
    const n = want.get(b.id) || 0;
    if (have.length < n) T.taxis.push({ depot: b.id, path: null, piece: 0, s: 0, wait: T.rng() * 0.8, tile: b.access, x: 0, z: 0, yaw: 0, vs: 0, color: Math.floor(T.rng() * 1000) });
    else if (have.length > n) { const victim = have.find((t) => !t.path); if (victim) T.taxis = T.taxis.filter((t) => t !== victim); }
  }
  for (const tx of T.taxis) {
    if (!tx.path) {
      tx.wait -= dt;
      if (tx.wait > 0) continue;
      const dest = pickTaxiDest(g, tx);
      if (dest < 0 || dest === tx.tile) { tx.wait = 0.5; continue; }
      const res = findPath(g, tx.tile, dest);
      if (!res || res.path.length < 2) { tx.wait = 0.6; continue; }
      tx.path = res.path; tx.piece = 0; tx.s = 0;
      continue;
    }
    // wie die Autos: Stückweise über die Felder
    const tile = tx.path[tx.piece];
    const def = ROADS[g.road[tile]];
    if (!def) { tx.path = null; tx.wait = 0.5; continue; }
    const cong = g.congestion[tile];
    const slow = cong > 0.75 ? 1 / (1 + (cong - 0.75) * 3) : 1;
    const v = 2.1 * def.speed * slow * 1.05;
    tx.vs = v;
    tx.s += v * dt;
    let len = pieceLen(tx.path, tx.piece);
    while (tx.s >= len) {
      tx.s -= len;
      tx.piece++;
      if (tx.piece >= tx.path.length) {
        tx.tile = tx.path[tx.path.length - 1];
        tx.path = null; tx.wait = 0.5 + T.rng() * 0.6;
        T.today.taxi++; T.totals.taxi++;
        const fare = 5; T.longToday += fare; T.today.long += fare;
        break;
      }
      if (!g.road[tx.path[tx.piece]]) { tx.path = null; tx.wait = 0.5; break; }
      len = pieceLen(tx.path, tx.piece);
    }
  }
}
function pieceLen(p, k) {
  const n = p.length - 1;
  if (k === 0 || k === n) return 0.5;
  return (p[k] - p[k - 1]) === (p[k + 1] - p[k]) ? 1 : 0.785;
}
function pickTaxiDest(g, tx) {
  const T = TS(g);
  const r = T.rng();
  const pool = [];
  if (r < 0.35) {
    for (const [bid] of T.rail) pool.push(g.buildings.get(bid));
    for (const [bid] of T.air) pool.push(g.buildings.get(bid));
    for (const b of T.landmarks) pool.push(b);
  }
  if (!pool.length) {
    const L = g.traffic.lists;
    const b = (r < 0.65 ? L.com : L.res).sample(T.rng) || L.any.sample(T.rng);
    if (b) pool.push(b);
  }
  const b = pool[Math.floor(T.rng() * pool.length)];
  return b && b.access >= 0 ? b.access : -1;
}
// Pose eines Taxis (wie Traffic.pose)
function taxiPose(g, tx, sExtra, out) {
  const W = g.W;
  const p = tx.path, n = p.length - 1;
  let k = tx.piece, s = tx.s + sExtra;
  let len = pieceLen(p, k);
  while (s > len && k < n) { s -= len; k++; len = pieceLen(p, k); }
  const t = Math.min(1, s / len);
  const cx = (i) => (p[i] % W) + 0.5;
  const cy = (i) => ((p[i] / W) | 0) + 0.5;
  let x, y, tx2, ty2;
  if (k === 0) { const ax = cx(0), ay = cy(0), bx = (cx(0) + cx(1)) / 2, by = (cy(0) + cy(1)) / 2; x = ax + (bx - ax) * t; y = ay + (by - ay) * t; tx2 = bx - ax; ty2 = by - ay; }
  else if (k >= n) { const ax = (cx(n - 1) + cx(n)) / 2, ay = (cy(n - 1) + cy(n)) / 2, bx = cx(n), by = cy(n); x = ax + (bx - ax) * t; y = ay + (by - ay) * t; tx2 = bx - ax; ty2 = by - ay; }
  else {
    const Ax = (cx(k - 1) + cx(k)) / 2, Ay = (cy(k - 1) + cy(k)) / 2, Bx = cx(k), By = cy(k), Cx = (cx(k) + cx(k + 1)) / 2, Cy = (cy(k) + cy(k + 1)) / 2;
    const u = 1 - t;
    x = u * u * Ax + 2 * u * t * Bx + t * t * Cx; y = u * u * Ay + 2 * u * t * By + t * t * Cy;
    tx2 = 2 * u * (Bx - Ax) + 2 * t * (Cx - Bx); ty2 = 2 * u * (By - Ay) + 2 * t * (Cy - By);
  }
  const l = Math.hypot(tx2, ty2) || 1; tx2 /= l; ty2 /= l;
  const r = g.road[p[Math.min(k, n)]];
  const off = LANE_OFF[r] || 0.16;
  out.x = x - g.W / 2 - ty2 * off;
  out.z = y - g.H / 2 + tx2 * off;
  out.yaw = Math.atan2(tx2, ty2);
  out.y = g.world.terrain[p[Math.min(k, n)]] === TER.WATER ? 0.24 : 0.012;
  return out;
}

// ---------------------------------------------------------------- Fahrzeugbewegung (Busse, Straßenbahnen)

function vehSpeed(g, line, tile, vt) {
  const def = ROADS[g.road[tile]];
  if (!def) return 0.6;
  let v = 2.1 * def.speed * vt.speed * (line.mode === 'tram' ? 1.0 : 0.86);
  const c = g.congestion[tile];
  if (line.mode === 'tram') { if (c > 0.75) v /= 1 + (c - 0.75) * 0.8; }
  else if (!g.policies.has('tp_buslanes')) { if (c > 0.75) v /= 1 + (c - 0.75) * 3; }
  const w = g.ext.weather;
  if (w && w.snowCover) v *= 1 - 0.25 * w.snowCover;
  return v;
}

const _pp = { x: 0, y: 0, tx: 0, ty: 1 };
function tileAt(g, line, s) {
  polyPose(line, s, _pp);
  const x = Math.floor(_pp.x), y = Math.floor(_pp.y);
  return clamp(y, 0, g.H - 1) * g.W + clamp(x, 0, g.W - 1);
}

function moveVehicles(g, dt) {
  const T = TS(g);
  const lm = lineMap(T);
  const strike = g.eff('busStrike') > 0;
  for (const v of T.vehicles) {
    const line = lm.get(v.line);
    if (!line || line.broken || line.visits.length < 2 || (strike && line.mode === 'bus')) { v.vs = 0; continue; }
    const vt = VEHICLE_TYPES[line.vtype] || VEHICLE_TYPES.bus;
    let left = dt, guard = 0;
    while (left > 1e-6 && guard++ < 8) {
      if (v.state === 'dwell') {
        if (v.dwell > left) { v.dwell -= left; left = 0; v.vs = 0; break; }
        left -= v.dwell; v.dwell = 0; v.state = 'move';
        const tgtVisit = line.visits[v.vi];
        const fromVisit = line.visits[(v.vi - 1 + line.visits.length) % line.visits.length];
        v.dir = fromVisit.dir;
        v.tgt = line.loop && v.vi === 0 ? line.len : tgtVisit.s;
        if (line.loop && v.s >= line.len - 1e-6) v.s = 0;
        v.sDep = v.s;
        // Fahrgäste an Bord: Auslastung des nächsten Abschnitts
        const k = fromVisit.k;
        const e = v.dir > 0 ? 2 * k : 2 * (k - 1) + 1;
        const ratio = line.edgeLoad && line.capH ? (line.edgeLoad[e] || 0) / line.capH : 0;
        v.pax = Math.round(clamp(ratio * (0.75 + T.rng() * 0.5), 0, 1) * vt.cap);
      } else {
        const rem = Math.abs(v.tgt - v.s);
        let sp = vehSpeed(g, line, tileAt(g, line, v.s), vt);
        v.v0 = sp;
        if (rem < 0.7) sp *= 0.3 + 0.7 * (rem / 0.7);
        const since = Math.abs(v.s - (v.sDep ?? v.s));
        if (since < 0.7) sp *= 0.35 + 0.65 * (since / 0.7);
        const st = sp * left;
        if (st >= rem) {
          left -= rem / Math.max(0.05, sp);
          v.s = v.tgt;
          arriveVehicle(g, T, line, v, vt);
        } else { v.s += v.dir * st; v.vs = v.dir * sp; left = 0; }
      }
    }
  }
}

function arriveVehicle(g, T, line, v, vt) {
  const visit = line.visits[v.vi];
  const st = stopMap(T).get(line.stops[visit.k]);
  v.state = 'dwell';
  v.vs = 0;
  const boarding = st ? Math.min(vt.cap, st.waiting || 0) : 0;
  v.dwell = 0.45 + boarding * 0.01 + (visit.k === 0 || visit.k === line.stops.length - 1 ? 0.35 : 0);
  // Taktausgleich: Fahrzeug direkt dahinter? Dann etwas länger warten.
  if (line.nveh > 1) {
    const cyc = line.loop ? line.len : 2 * line.len;
    const ideal = cyc / line.nveh;
    const pos = (x) => (line.loop ? x.s : x.dir > 0 ? x.s : 2 * line.len - x.s);
    const me = pos(v);
    let ahead = Infinity;
    for (const o of T.vehicles) {
      if (o === v || o.line !== line.id) continue;
      let d = pos(o) - me;
      if (d <= 0) d += cyc;
      if (d < ahead) ahead = d;
    }
    if (ahead < ideal * 0.55) v.dwell += 0.35;
  }
  v.vi = (v.vi + 1) % line.visits.length;
  if (st) {
    emit('transport:arrive', { kind: line.mode, line: line.id, x: st.x, y: st.y, pax: v.pax });
    emit('busStop', { x: st.x + 0.5, y: st.y + 0.5, kind: line.mode, line: line.id, pax: v.pax });
  }
}

// ---------------------------------------------------------------- Takt, Nachfrage, Umlegung (stündlich)

function minutesPerTile(g, line, tile) {
  const def = ROADS[g.road[tile]];
  if (!def) return 2;
  const vt = VEHICLE_TYPES[line.vtype] || VEHICLE_TYPES.bus;
  // ÖPNV-Erzählminuten: ein Feld Straße ≈ 0,42 Minuten im Bus (Takt und Wartezeit sollen sich nach Stadtbus anfühlen)
  let m = (0.42 / def.speed) / vt.speed / (line.mode === 'tram' ? 1.2 : 1);
  const c = g.congestion[tile];
  if (c > 0.75) {
    if (line.mode === 'tram') m *= 1 + (c - 0.75) * 0.8;
    else if (!g.policies.has('tp_buslanes')) m *= 1 + (c - 0.75) * 3;
  }
  if (TS(g).signalSet.has(tile) && g.eff('greenWave') <= 0) m += 0.15;
  return m;
}

function timings(g) {
  const T = TS(g);
  for (const l of T.lines) {
    l.segMin = [];
    if (l.broken || !l.path.length) { l.cycleMin = 0; l.takt = Infinity; l.capH = 0; continue; }
    let tot = 0;
    for (let k = 0; k < l.segs; k++) {
      let m = 0;
      for (let j = l.stopIdx[k] + 1; j <= l.stopIdx[k + 1]; j++) m += minutesPerTile(g, l, l.path[j]);
      l.segMin.push(m);
      tot += m;
    }
    const n = l.stops.length;
    l.cycleMin = l.loop ? tot + n * TP.dwellMin : 2 * tot + (2 * n - 2) * TP.dwellMin;
    l.oneWayMin = l.loop ? l.cycleMin : tot + (n - 1) * TP.dwellMin;
    l.takt = l.nveh > 0 ? l.cycleMin / l.nveh : Infinity;
    const vt = VEHICLE_TYPES[l.vtype] || VEHICLE_TYPES.bus;
    // Effektive Kapazität: Fahrgäste verteilen sich nicht gleichmäßig über die Stunde (Faktor 0,7)
    l.capH = l.nveh * (60 / Math.max(1, l.cycleMin)) * vt.cap * 0.7;
  }
}

function updateCatchments(g) {
  const T = TS(g);
  const R0 = TP.stopRadius;
  const cover = T._cover || (T._cover = new Uint8Array(g.N));
  cover.fill(0);
  const active = T.stops.filter((s) => s.lines.length);
  for (const s of active) forDisc(g, s.x + 0.5, s.y + 0.5, R0, (t) => { if (cover[t] < 255) cover[t]++; });
  // Pulsbahn-Stationen für Zubringer
  const stations = [...g.transit.stations.values()].filter((st) => st.active);
  for (const s of active) {
    const w = [0, 0, 0, 0, 0];
    let lm = 0;
    forDisc(g, s.x + 0.5, s.y + 0.5, R0, (t) => {
      const b = g.buildings.get(g.bld[t]);
      if (!b || b.abandoned) return;
      if (b.y * g.W + b.x !== t) return; // jedes Gebäude einmal (Ursprungsfeld)
      if (b.zone) w[b.zone] += b.occ / Math.max(1, cover[t]);
      else { const d = BUILDINGS[b.key]; if (d && d.tourism) lm += d.tourism / 10; }
    });
    s.w = w;
    s.lm = lm;
    s.feeder = 0;
    for (const st of stations) if (Math.hypot(st.x - s.x, st.y - s.y) <= TP.feederRadius) { s.feeder = st.id; break; }
    // Umsteiger aus dem Fernverkehr
    let tour = 0;
    for (const [bid, R2] of T.rail) { const b = g.buildings.get(bid); if (b && R2.ok && Math.hypot(b.x + b.w / 2 - s.x, b.y + b.h / 2 - s.y) < R0 + 2) tour += 6; }
    for (const [bid, A] of T.air) { const b = g.buildings.get(bid); if (b && A.ok && Math.hypot(b.x + b.w / 2 - s.x, b.y + b.h / 2 - s.y) < R0 + 3) tour += 9; }
    s.tour = tour;
  }
  for (const s of T.stops) if (!s.lines.length) { s.w = [0, 0, 0, 0, 0]; s.lm = 0; s.feeder = 0; s.tour = 0; }
}

// Graph der Haltestellen: Kanten = Linienabschnitte (je Richtung). CSR-Adjazenz.
function buildGraph(g) {
  const T = TS(g);
  const nodes = T.stops.filter((s) => s.lines.length);
  const idx = new Map(nodes.map((s, i) => [s.id, i]));
  const lines = T.lines.filter((l) => !l.broken && l.nveh > 0 && l.path.length);
  const E = [];
  lines.forEach((l, li) => {
    const n = l.stops.length;
    for (let k = 0; k < l.segs; k++) {
      const a = idx.get(l.stops[k]), b = idx.get(l.stops[(k + 1) % n]);
      if (a === undefined || b === undefined) continue;
      E.push([a, b, li, 2 * k, k]);
      if (!l.loop) E.push([b, a, li, 2 * k + 1, k]);
    }
  });
  const S = nodes.length;
  const deg = new Int32Array(S + 1);
  for (const e of E) deg[e[0] + 1]++;
  for (let i = 0; i < S; i++) deg[i + 1] += deg[i];
  const fill = deg.slice(0, S);
  const eTo = new Int32Array(E.length), eLine = new Int32Array(E.length), eEdge = new Int32Array(E.length), eSeg = new Int32Array(E.length);
  const order = new Int32Array(E.length);
  E.forEach((e, k) => { const p = fill[e[0]]++; order[p] = k; eTo[p] = e[1]; eLine[p] = e[2]; eEdge[p] = e[3]; eSeg[p] = e[4]; });
  T.graph = { nodes, idx, lines, start: deg, eTo, eLine, eEdge, eSeg, S };
  T.dirty.graph = false;
}

// Dijkstra von jeder Haltestelle (Minuten, Umstieg kostet 4 Minuten)
function shortestTrees(g) {
  const T = TS(g);
  const G = T.graph;
  const S = G.S;
  const trees = [];
  for (let o = 0; o < S; o++) {
    const dist = new Float32Array(S).fill(1e9);
    const pe = new Int32Array(S).fill(-1);  // Kante (CSR-Index), über die der Knoten erreicht wurde
    const pn = new Int32Array(S).fill(-1);
    dist[o] = 0;
    const heap = new MinHeap();
    heap.push(o, 0);
    while (heap.size) {
      const u = heap.pop();
      const du = dist[u];
      if (du > TP.maxTripMin) continue;
      const inLine = pe[u] >= 0 ? G.eLine[pe[u]] : -1;
      for (let p = G.start[u]; p < G.start[u + 1]; p++) {
        const v = G.eTo[p];
        const l = G.lines[G.eLine[p]];
        let c = (l.segMin[G.eSeg[p]] || 1) + TP.dwellMin;
        if (inLine >= 0 && inLine !== G.eLine[p]) c += 2 + Math.min(10, l.takt / 2);
        const nd = du + c;
        if (nd < dist[v]) { dist[v] = nd; pe[v] = p; pn[v] = u; heap.push(v, nd); }
      }
    }
    trees.push({ dist, pe, pn });
  }
  T.trees = trees;
}

function purposeRates(g, h) {
  const night = h < 5 || h >= 23;
  const nm = night ? (g.policies.has('tp_nightbus') ? 0.7 : 0.2) : 1;
  return {
    work: (0.07 * gauss(h, 7.8, 1.4) + 0.0015) * nm,
    home: (0.055 * gauss(h, 17.3, 1.7) + 0.0015) * nm,
    shop: (h >= 8 && h < 21 ? 0.008 * (0.25 + gauss(h, 13, 3)) : 0.0006) * nm,
    misc: 0.003 * nm,
    tour: (h >= 7 && h < 22 ? 1 : 0.15),
  };
}

function assignHour(g, h) {
  const T = TS(g);
  const G = T.graph;
  const S = G ? G.S : 0;
  for (const l of T.lines) { l.edgeLoad = new Float32Array(Math.max(1, l.segs) * 2); l.hourRiders = 0; }
  for (const s of T.stops) { s.genH = 0; s.boardH = 0; s.rejH = 0; }
  if (!S || !T.trees) return { delivered: 0 };
  const strikeBus = g.eff('busStrike') > 0;
  const rates = purposeRates(g, h);
  const fare = T.fare;
  const fareMul = clamp(1.3 - fare * 0.12, 0.6, 1.3) * (g.policies.has('tp_parkfee') ? 1.1 : 1);
  const w = g.ext.weather;
  const weatherMul = w ? 1 + 0.18 * (w.rain || 0) + 0.25 * (w.snow || 0) + 0.15 * (w.snowCover || 0) : 1;
  const ridership = (1 + g.eff('busRidership') + g.eff('ridership') * 0.5) * fareMul * weatherMul;
  // Pulsbahn-Netz als Zubringerziel
  const puls = [0, 0, 0, 0, 0];
  for (const st of g.transit.stations.values()) if (st.active) for (let z = 1; z <= 4; z++) puls[z] += st.w[z];
  const s = g.stats;
  const jobsTot = Math.max(1, s.jobs), popTot = Math.max(1, s.pop);
  let lmTot = 0;
  for (const b of T.landmarks || []) { const d = BUILDINGS[b.key]; if (d && d.tourism) lmTot += d.tourism / 10; }
  const comTot = Math.max(1, s.jobsByZone[2] * 2 + lmTot);
  const nodes = G.nodes;
  // Gewichte je Ziel
  const wtWork = new Float32Array(S), wtHome = new Float32Array(S), wtShop = new Float32Array(S), wtMisc = new Float32Array(S), wtTour = new Float32Array(S), feedFrac = new Float32Array(S);
  for (let d = 0; d < S; d++) {
    const n = nodes[d];
    const jobs = n.w[2] + n.w[3] + n.w[4];
    const f = n.feeder ? 0.35 : 0;
    wtWork[d] = jobs + f * (puls[2] + puls[3] + puls[4]);
    wtHome[d] = n.w[1] + f * puls[1];
    wtShop[d] = n.w[2] * 2 + n.lm + f * puls[2];
    wtMisc[d] = n.w[1] + jobs;
    wtTour[d] = n.w[2] + n.lm * 3 + n.w[1] * 0.2;
    const loc = jobs + n.w[1] + n.w[2] * 2;
    const fd = f * (puls[1] + puls[2] * 2 + puls[3] + puls[4]);
    feedFrac[d] = loc + fd > 0 ? fd / (loc + fd) : 0;
  }
  const ods = [];
  const purposes = [
    ['work', wtWork, jobsTot], ['home', wtHome, popTot], ['shop', wtShop, comTot], ['misc', wtMisc, jobsTot + popTot], ['tour', wtTour, comTot + popTot * 0.2],
  ];
  const decay = new Float32Array(S);
  for (let o = 0; o < S; o++) {
    const so = nodes[o];
    const tree = T.trees[o];
    if (!tree) continue;
    const res = so.w[1], jobs = so.w[2] + so.w[3] + so.w[4];
    const gen = { work: res * rates.work, home: jobs * rates.home, shop: res * rates.shop, misc: (res + jobs) * rates.misc, tour: so.tour * rates.tour };
    const takt = so.takt;
    const attract = clamp(1.25 - takt / 40, 0.08, 1.1) * ridership;
    for (let d = 0; d < S; d++) decay[d] = d !== o && tree.dist[d] < 1e8 ? Math.exp(-tree.dist[d] / 30) : 0;
    const Td = new Float32Array(S);
    let any = false;
    for (const [key, wt, tot] of purposes) {
      const G0 = gen[key];
      if (G0 <= 1e-4) continue;
      let sum = 0;
      for (let d = 0; d < S; d++) if (decay[d]) sum += wt[d] * decay[d];
      if (sum <= 0) continue;
      const u = Math.min(1, (3 * sum) / tot);
      const trips = G0 * attract * u;
      if (trips <= 1e-4) continue;
      for (let d = 0; d < S; d++) if (decay[d]) Td[d] += (trips * wt[d] * decay[d]) / sum;
      any = true;
    }
    if (!any) continue;
    for (let d = 0; d < S; d++) {
      const t = Td[d];
      if (t < 0.002) continue;
      ods.push(o, d, t);
      so.genH += t;
      // Last entlang des Pfades
      for (let v = d; v !== o; v = tree.pn[v]) {
        const p = tree.pe[v];
        if (p < 0) break;
        const l = G.lines[G.eLine[p]];
        l.edgeLoad[G.eEdge[p]] += t;
      }
    }
  }
  // Annahme je Fahrt: knappste Kante entscheidet
  let delivered = 0, rejected = 0, transfers = 0, feeder = 0, busR = 0, tramR = 0;
  const used = new Set();
  for (let k = 0; k < ods.length; k += 3) {
    const o = ods[k], d = ods[k + 1], t = ods[k + 2];
    const tree = T.trees[o];
    let acc = 1;
    used.clear();
    let lastLine = -1, chg = 0;
    for (let v = d; v !== o; v = tree.pn[v]) {
      const p = tree.pe[v];
      if (p < 0) break;
      const li = G.eLine[p];
      const l = G.lines[li];
      const load = l.edgeLoad[G.eEdge[p]];
      const cap = (strikeBus && l.mode === 'bus') ? 0 : l.capH;
      if (load > cap) acc = Math.min(acc, cap / load);
      used.add(li);
      if (lastLine >= 0 && li !== lastLine) chg++;
      lastLine = li;
    }
    const dl = t * acc;
    delivered += dl;
    rejected += t - dl;
    nodes[o].boardH += dl;
    nodes[o].rejH += t - dl;
    nodes[d].alightToday += dl;
    if (chg) transfers += dl;
    feeder += dl * feedFrac[d];
    for (const li of used) { const l = G.lines[li]; l.hourRiders += dl; l.faresToday = (l.faresToday || 0) + (dl * fare) / used.size; if (l.mode === 'tram') tramR += dl; else busR += dl; }
  }
  // Ergebnisse
  for (const l of T.lines) {
    let peak = 0;
    for (let e = 0; e < l.edgeLoad.length; e++) if (l.capH > 0) peak = Math.max(peak, l.edgeLoad[e] / l.capH);
    l.loadHour = peak;
    l.load = l.load * 0.6 + peak * 0.4;
    l.ridersToday += l.hourRiders;
  }
  for (const n of T.stops) {
    if (!n.lines.length) { n.waiting = 0; n.crowd = 0; continue; }
    n.boardToday += n.boardH || 0;
    n.rejectedToday += n.rejH || 0;
    const cr = n.genH > 0.2 ? n.rejH / n.genH : 0;
    n.crowd = n.crowd * 0.65 + cr * 0.35;
    n.waiting = Math.round(clamp((n.genH || 0) * Math.min(60, n.takt) / 60 * 0.7 + (n.rejH || 0) * 0.6, 0, 80));
  }
  T.today.riders += delivered; T.today.bus += busR; T.today.tram += tramR;
  T.today.transfers += transfers; T.today.feeder += feeder; T.today.rejected += rejected;
  T.totals.riders += delivered;
  const fares = delivered * fare;
  T.faresToday += fares; T.today.fares += fares;
  // Zubringer: ein Teil steigt in die Pulsbahn um (ein Pulsbahn-Fahrgast steht für etwa 6 Menschen)
  T.feederAcc += feeder / 6;
  pushFeeder(g, h);
  return { delivered, rejected };
}

function pushFeeder(g, h) {
  const T = TS(g);
  const tr = g.transit;
  let guard = 0;
  while (T.feederAcc >= 1 && guard++ < 8) {
    T.feederAcc -= 1;
    const feeders = T.stops.filter((s) => s.feeder && tr.stations.get(s.feeder));
    if (!feeders.length) { T.feederAcc = 0; return; }
    const s = feeders[Math.floor(T.rng() * feeders.length)];
    const st = tr.stations.get(s.feeder);
    if (!st || !st.active || st.waiting.length >= TRANSIT.stationCapacity - 2) continue;
    const types = h < 12 ? [2, 3, 4] : [1];
    let total = 0;
    const cands = [];
    for (const t of tr.stations.values()) {
      if (t === st || !t.active || tr.hops(t.id, st.id) === Infinity) continue;
      for (const z of types) if (t.w[z] > 0) { cands.push([t, z, t.w[z]]); total += t.w[z]; }
    }
    if (total <= 0) continue;
    let q = T.rng() * total, pick = cands[cands.length - 1];
    for (const c of cands) { q -= c[2]; if (q <= 0) { pick = c; break; } }
    st.waiting.push({ dest: pick[0].id, shape: pick[1], t: g.time, feeder: true });
  }
  if (T.feederAcc > 6) T.feederAcc = 6;
}

function stopTakts(g) {
  const T = TS(g);
  const lm = lineMap(T);
  for (const s of T.stops) {
    let f = 0;
    for (const id of s.lines) { const l = lm.get(id); if (l && l.takt < Infinity && !l.broken) f += (l.loop ? 1 : 1) / l.takt; }
    s.takt = f > 0 ? 1 / f : Infinity;
    s.active = f > 0;
  }
}

// ---------------------------------------------------------------- Felder für Glück und Bodenwert

function computeFields(g) {
  const T = TS(g);
  const N = g.N;
  const cov = T.covField || (T.covField = new Float32Array(N));
  const crowd = T.crowdField || (T.crowdField = new Float32Array(N));
  const park = T.parkField || (T.parkField = new Uint8Array(N));
  const lv = T.lvField || (T.lvField = new Float32Array(N));
  const diesel = T.dieselField || (T.dieselField = new Uint8Array(N));
  const acc = T.accField || (T.accField = new Uint8Array(N));
  const takt = T.taktField || (T.taktField = new Float32Array(N));
  cov.fill(0); crowd.fill(0); park.fill(0); lv.fill(0); diesel.fill(0); acc.fill(0); takt.fill(999);
  const R0 = TP.stopRadius;
  for (const s of T.stops) {
    if (!s.active) continue;
    const q = clamp(1.25 - s.takt / 40, 0.2, 1) * (s.hasTram ? 1.15 : 1);
    forDisc(g, s.x + 0.5, s.y + 0.5, R0, (t, d) => {
      const v = (1 - 0.6 * (d / R0)) * q;
      if (v > cov[t]) cov[t] = v;
      if (s.crowd > crowd[t]) crowd[t] = s.crowd;
      if (s.takt < takt[t]) takt[t] = s.takt;
    });
  }
  for (let i = 0; i < N; i++) lv[i] = cov[i] * 5;
  // Straßenbahngleise werten auf (verlässliche Anbindung)
  for (const t of T.trackTiles) forDisc(g, (t % g.W) + 0.5, ((t / g.W) | 0) + 0.5, 2.2, (j) => { lv[j] = Math.max(lv[j], cov[j] * 5 + 2.5); });
  for (const b of T.parking || []) if (b.construct >= 1) forDisc(g, b.x + 0.5, b.y + 0.5, 4.5, (t) => { park[t] = 1; });
  // Dieselbusse im dichten Takt: Abgase und Lärm an der Strecke
  for (const l of T.lines) {
    const vt = VEHICLE_TYPES[l.vtype];
    if (!vt || !vt.diesel || l.broken || l.takt > 12) continue;
    for (const t of l.path) {
      const x = t % g.W, y = (t / g.W) | 0;
      for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < g.W && ny < g.H) diesel[ny * g.W + nx] = 1; }
    }
  }
  for (const a of T.accidents) if (g.time < a.until + 360) forDisc(g, a.x + 0.5, a.y + 0.5, 2.6, (t) => { acc[t] = 1; });
  T.dirty.fields = false;
}

// Pendelzeit: Wer Bus oder Bahn nimmt, steht nicht im Stau. Gut angebundene Wohnungen pendeln im Mittel kürzer.
function commuteEffect(g) {
  const T = TS(g);
  if (!T.covField || !T.taktField) return;
  const strike = g.eff('busStrike') > 0;
  const pcov = g.cov.transit, pen = g.transitPenalty;
  for (const b of g.buildings.values()) {
    if (b.zone !== Z.RES || b.abandoned || !b.occ) continue;
    const i = b.y * g.W + b.x;
    let c = strike ? 0 : T.covField[i];
    let tc = 6 + Math.min(30, T.taktField[i]) / 2 + 10; // Fußweg + halbe Wartezeit + Fahrt
    // Pulsbahn (Q2): fährt kreuzungsfrei über dem Stau – wer an einer Station wohnt, pendelt kürzer.
    // Überfüllte Stationen (Strafe aktiv) helfen nicht.
    const p = pcov ? pcov[i] : 0;
    if (p > 0.05 && !(pen && pen[i])) { tc = Math.min(strike ? Infinity : tc, 19); c = Math.max(c, p * 0.8); }
    if (c < 0.05) continue;
    if (tc < b.commute) b.commute -= (b.commute - tc) * c * 0.12;
  }
}

// ---------------------------------------------------------------- Ampeln, Parkhäuser, Unfälle (nach der Stau-Berechnung des Kerns)

function adjustCongestion(g) {
  const T = TS(g);
  const cong = g.congestion;
  // Parkhäuser: weniger Parksuchverkehr im Umkreis
  const mark = T._mark || (T._mark = new Uint8Array(g.N));
  mark.fill(0);
  for (const b of T.parking || []) {
    if (b.construct < 1) continue;
    forDisc(g, b.x + 0.5, b.y + 0.5, 4.5, (t) => { if (g.road[t] && !mark[t]) { mark[t] = 1; cong[t] *= 0.85; } });
  }
  // Busspuren: Autos haben auf Busstrecken weniger Platz
  if (g.policies.has('tp_buslanes')) for (const l of T.lines) if (l.mode === 'bus') for (const t of l.path) cong[t] *= 1.08;
  // Ampeln: Wartezeit an der Kreuzung
  if (g.eff('greenWave') <= 0) for (const i of T.signals) cong[i] = Math.max(cong[i] + 0.06, 0.84);
  // Unfälle blockieren die Kreuzung
  for (const a of T.accidents) if (g.time < a.until) cong[a.tile] = Math.max(cong[a.tile], 1.75);
}

function accidentsHour(g, h) {
  const T = TS(g);
  T.accidents = T.accidents.filter((a) => g.time < a.until + 720);
  if (g.stats.pop < 200) return;
  const w = g.ext.weather;
  const wMul = w ? 1 + (w.rain || 0) * 0.6 + (w.snowCover || 0) * 1.2 + (w.fog || 0) * 0.6 + (w.storm ? 0.5 : 0) : 1;
  const night = h < 5 || h >= 22 ? 0.7 : 1;
  const tempo = (g.policies.has('tempo30') ? 0.6 : 1) * (g.eff('safeRoads') > 0 ? 0.6 : 1);
  const { W, road } = g;
  for (let i = 0; i < g.N; i++) {
    const r = road[i];
    if (!r || r === R.HIGHWAY) continue;
    const m = arms(g, i);
    const n = bits(m);
    if (n < 3) continue;
    const ratio = g.trafficLoad[i] / ROADS[r].capacity;
    if (ratio < 0.12) continue;
    let p = 0.0011 * Math.pow(ratio, 1.4) * (n - 2) * (signalScore(g, i).score >= 4.5 ? 1.5 : 1) * wMul * night * tempo;
    if (T.signalSet.has(i)) p *= 0.12;
    if (T.rng() < p) {
      if (T.accidents.some((a) => a.tile === i && g.time < a.until)) continue;
      const police = g.cov.police[i] || 0;
      const dur = 60 + (1 - police) * 120 + T.rng() * 40;
      const a = { tile: i, x: i % W, y: (i / W) | 0, t0: g.time, until: g.time + dur, police: police > 0.2, ambulance: (g.cov.health[i] || 0) > 0.2, seed: Math.floor(T.rng() * 1e6) };
      T.accidents.push(a);
      T.accidentLog.unshift({ x: a.x, y: a.y, day: g.day(), hour: Math.floor(h), signal: false });
      if (T.accidentLog.length > 12) T.accidentLog.pop();
      T.today.accidents++; T.totals.accidents++;
      const where = nearestStreetName(g, i);
      news(g, 'accident', `Unfall ${where}! Die Kreuzung ist für einige Zeit dicht.${police < 0.2 ? ' Keine Polizei in der Nähe – das dauert.' : ''}`, 'bad', a, 300);
      T.dirty.fields = true;
      emit('transport:accident', { x: a.x, y: a.y });
    }
  }
}
// Einzugsgebiet geplanter Haltestellen (für die Vorschau im Werkzeug): Bewohner, Arbeitsplätze, Sehenswürdigkeiten
export function catchmentOf(g, tiles) {
  const seen = new Set();
  let res = 0, jobs = 0, lm = 0;
  for (const tile of tiles) {
    if (tile < 0) continue;
    forDisc(g, (tile % g.W) + 0.5, ((tile / g.W) | 0) + 0.5, TP.stopRadius, (t) => {
      const id = g.bld[t];
      if (!id || seen.has(id)) return;
      seen.add(id);
      const b = g.buildings.get(id);
      if (!b || b.abandoned) return;
      if (b.zone === Z.RES) res += b.occ;
      else if (b.zone) jobs += b.occ;
      else if (BUILDINGS[b.key] && BUILDINGS[b.key].tourism) lm++;
    });
  }
  return { res, jobs, lm };
}

// Für den Prüfstand: eine Unfallrunde auswürfeln
export function debugAccidents(g, h = 12) { accidentsHour(g, h); }

function nearestStreetName(g, i) {
  const T = TS(g);
  let best = null, bd = 1e9;
  const x = i % g.W, y = (i / g.W) | 0;
  for (const s of T.stops) { const d = Math.abs(s.x - x) + Math.abs(s.y - y); if (d < bd) { bd = d; best = s; } }
  if (best && bd <= 6) return `nahe der Haltestelle ${best.name}`;
  return `an der Kreuzung ${x}/${y}`;
}

// ---------------------------------------------------------------- Kennzahlen, Pendleranteil, Tourismus, Nachfrage

function shareAndTourism(g) {
  const T = TS(g);
  // Pendleranteil: Fahrten der letzten 24 Stunden im ÖPNV (Bus, Tram, Fähre) gegenüber allen Wegen
  let sum = 0;
  for (let k = 0; k < 24; k++) sum += T.ring[k];
  const trips = Math.max(60, g.stats.pop * 1.5);
  T.share = clamp(sum / trips, 0, 0.55);
  // In den Kern-Pendleranteil einrechnen (der Kern setzt ihn nur für die Pulsbahn)
  const cur = g.stats.transitShare;
  if (cur !== T.shareWrote) T.shareBase = cur;
  T.shareWrote = clamp(T.shareBase + T.share * 0.9, 0, 0.85);
  g.stats.transitShare = T.shareWrote;
  // Tourismus: Fähren, Taxis, Stau
  const tc = g.stats.tourism;
  if (tc !== T.tourWrote) T.tourBase = tc;
  const base = T.tourBase;
  let extra = 0;
  for (const f of T.ferries) extra += 25;
  extra += base * 0.04 * Math.min(3, (T.taxiDepots || []).filter((b) => b.construct >= 1).length);
  const flow = g.stats.trafficFlow || 1;
  if (flow < 0.85) extra -= base * (0.85 - flow) * 0.5;
  T.tourExtra = extra;
  T.tourWrote = Math.max(0, base + extra);
  g.stats.tourism = T.tourWrote;
}

function demandMods(g) {
  const T = TS(g);
  const d = [0, 0, 0, 0, 0];
  let st = 0;
  for (const [, R2] of T.rail) if (R2.ok) st++;
  st = Math.min(2, st);
  d[2] += 3 * st; d[3] += 2 * st; d[4] += 5 * st;
  for (const [, A] of T.air) if (A.ok) { d[2] += 4; d[4] += 10; break; }
  d[1] += Math.min(8, T.share * 30);
  const flow = g.stats.trafficFlow || 1;
  if (flow < 0.85 && g.stats.pop > 400) { d[2] -= (0.85 - flow) * 30; d[3] -= (0.85 - flow) * 40; d[4] -= (0.85 - flow) * 15; }
  T.demandMod = d;
}

// Kosten pro Tag
export function lineUpkeep(g, l) {
  const vt = VEHICLE_TYPES[l.vtype] || VEHICLE_TYPES.bus;
  const night = g.policies.has('tp_nightbus') ? 1.15 : 1;
  const tracks = l.mode === 'tram' ? l.path.length * TP.trackUpkeep : 0;
  return (TP.lineUpkeep[l.mode] + l.nveh * vt.upkeep * night + tracks) * g.upkeepMul();
}
export function networkUpkeep(g) {
  const T = TS(g);
  if (!T) return 0;
  let c = 0;
  for (const l of T.lines) c += lineUpkeep(g, l);
  c += T.stops.length * TP.stopUpkeep * g.upkeepMul();
  return c;
}

// ---------------------------------------------------------------- System

function dailyReset(g, day) {
  const T = TS(g);
  const td = T.today;
  // Pulsbahn-Fahrgäste von gestern stehen in g.stats.ridersToday (vom Kern beim Tageswechsel gesetzt)
  T.day = { ...td, d: day - 1, share: T.share, flow: g.stats.trafficFlow, cars: g.traffic.cars.length, puls: g.stats.ridersToday || 0, signals: T.signals.length };
  T.hist.push({ d: day - 1, riders: Math.round(td.riders), bus: Math.round(td.bus), tram: Math.round(td.tram), puls: g.stats.ridersToday || 0, flow: Math.round((g.stats.trafficFlow || 1) * 100), share: Math.round(T.share * 1000) / 10, acc: td.accidents, trains: td.trains, flights: td.flights, ferry: Math.round(td.ferry), taxi: td.taxi, fares: Math.round(td.fares + td.long) });
  if (T.hist.length > 160) T.hist.shift();
  for (const l of T.lines) {
    l.riders = Math.round(l.ridersToday);
    l.rHist.push(l.riders);
    if (l.rHist.length > 21) l.rHist.shift();
    l.ridersToday = 0;
    l.fares = l.faresToday || 0;
    l.faresToday = 0;
  }
  for (const s of T.stops) { s.board = Math.round(s.boardToday); s.alight = Math.round(s.alightToday); s.rejected = Math.round(s.rejectedToday); s.boardToday = 0; s.alightToday = 0; s.rejectedToday = 0; }
  for (const f of T.ferries) { f.riders = f.ridersToday; f.ridersToday = 0; }
  for (const [, R2] of T.rail) { R2.yesterday = R2.today; R2.today = 0; }
  for (const [, A] of T.air) { A.yesterday = A.today; A.today = 0; }
  T.today = { riders: 0, bus: 0, tram: 0, transfers: 0, feeder: 0, rejected: 0, trains: 0, trainPax: 0, tourists: 0, flights: 0, flightPax: 0, ferry: 0, taxi: 0, accidents: 0, fares: 0, long: 0 };
  T.faresToday = 0;
  T.longToday = 0;
  // Warnungen
  // Meilensteine der Fahrgastzahlen
  const marks = [100, 500, 1000, 2500, 5000, 10000];
  T.marks = T.marks || 0;
  while (T.marks < marks.length && T.day.riders >= marks[T.marks]) {
    const m = marks[T.marks++];
    news(g, 'mark' + m, `Rekord: ${m.toLocaleString('de-DE')} Fahrgäste an einem Tag in Bus und Straßenbahn!`, 'good', null, 0);
  }
  for (const l of T.lines) {
    if (l.load > 1.15 && l.riders > 20) news(g, 'full' + l.id, `${lineLabel(l)} ist rappelvoll – Fahrgäste bleiben an den Haltestellen stehen. Mehr Fahrzeuge oder größere einsetzen.`, 'bad', stopById(g, l.stops[0]), 1440 * 2);
  }
}

registerSystem({
  id: 'transport',
  init(g) {
    g.ext.transport = freshState(g);
    const D = () => TS(g).dirty;
    g.on('roadsChanged', () => { const d = D(); d.routes = true; d.signals = true; d.ferries = true; });
    g.on('buildingAdded', (b) => { if (!b.zone) D().facilities = true; });
    g.on('buildingRemoved', (b) => { if (!b.zone) D().facilities = true; });
    g.on('buildingUpdated', (b) => { if (!b.zone) D().facilities = true; });
    g.on('transitChanged', () => { D().fields = true; });
  },

  step(g, minutes) {
    const T = TS(g);
    if (!T) return;
    if (T.dirty.facilities) scanFacilities(g);
    if (T.dirty.routes) rebuildAll(g);
    if (T.dirty.signals) updateSignals(g);
    if (T.dirty.ferries) rebuildFerries(g);
    if (T.dirty.graph) { updateStopLines(g); stopTakts(g); buildGraph(g); shortestTrees(g); }
    const dt = minutes / GAME_MIN_PER_SEC;
    moveVehicles(g, dt);
    railStep(g, minutes);
    airStep(g);
    ferryStep(g, dt);
    taxiStep(g, dt);
    hubStep(g, minutes);
    shareAndTourism(g);
    T.tStep = g.nextStep;
  },

  hourly(g, h) {
    const T = TS(g);
    if (!T) return;
    if (T.dirty.facilities) scanFacilities(g);
    if (T.dirty.routes) rebuildAll(g);
    if (h % 3 === 0 || T.dirty.signals) updateSignals(g);
    timings(g);
    stopTakts(g);
    updateCatchments(g);
    if (T.dirty.graph || h % 2 === 0) { buildGraph(g); shortestTrees(g); }
    const r = assignHour(g, h);
    ferryDemand(g);
    const ferryH = T.ferries.reduce((a, f) => a + (f.demand || 0), 0) * 0.5;
    T.ring[h % 24] = (r.delivered || 0) + ferryH;
    accidentsHour(g, h);
    adjustCongestion(g);
    computeFields(g);
    commuteEffect(g);
    demandMods(g);
    shareAndTourism(g);
  },

  daily(g, day) { dailyReset(g, day); },

  weekly(g) {
    const T = TS(g);
    if (!T || (!T.lines.length && !T.rail.size && !T.air.size && T.totals.accidents === 0)) return;
    const wk = T.hist.slice(-7);
    if (!wk.length) return;
    const riders = wk.reduce((a, h) => a + h.riders, 0);
    const acc = wk.reduce((a, h) => a + (h.acc || 0), 0);
    const trains = wk.reduce((a, h) => a + (h.trains || 0), 0);
    const flights = wk.reduce((a, h) => a + (h.flights || 0), 0);
    const parts = [];
    if (T.lines.length) parts.push(`${riders.toLocaleString('de-DE')} Fahrgäste in Bus und Tram (Anteil ${(T.share * 100).toFixed(1).replace('.', ',')} %)`);
    if (trains) parts.push(`${trains} Fernzüge`);
    if (flights) parts.push(`${flights} Flüge`);
    parts.push(acc ? `${acc} Unfall${acc > 1 ? 'e' : ''}` : 'keine Unfälle');
    g.pushNews({ kind: 'report', author: 'Verkehrsbetriebe', text: `Verkehrsbericht der Woche: ${parts.join(', ')}.`, mood: acc > 3 ? 'bad' : 'good' });
  },

  serialize(g) {
    const T = TS(g);
    return {
      v: 1,
      stops: T.stops.map((s) => [s.id, s.tile, s.name, s.mode]),
      lines: T.lines.map((l) => ({ id: l.id, mode: l.mode, num: l.num, color: l.color, stops: l.stops, loop: l.loop, vtype: l.vtype, nveh: l.nveh, rHist: l.rHist.slice(-14), created: l.created })),
      signalMode: [...T.signalMode],
      fare: T.fare, free: T.free, num: T.num,
      next: [T.nextStop, T.nextLine, T.nextVeh],
      hubs: [...T.hubs],
      hist: T.hist.slice(-120),
      totals: T.totals,
      accidentLog: T.accidentLog.slice(0, 8),
      marks: T.marks || 0,
    };
  },

  load(g, d) {
    if (!d || !d.v) return;
    const T = freshState(g);
    g.ext.transport = T;
    for (const [id, tile, name, mode] of d.stops || []) {
      T.stops.push({ id, tile, x: tile % g.W, y: (tile / g.W) | 0, side: 2, name, mode: mode || 'bus', lines: [], w: [0, 0, 0, 0, 0], lm: 0, tour: 0, waiting: 0, crowd: 0, takt: Infinity, feeder: 0, active: false, boardToday: 0, board: 0, alightToday: 0, alight: 0, rejectedToday: 0 });
      T.stopAt.set(tile, id);
      T.usedNames.add(name);
    }
    for (const l of d.lines || []) {
      T.lines.push({
        ...l, rHist: l.rHist || [], ridersToday: 0, riders: (l.rHist || [])[(l.rHist || []).length - 1] || 0, load: 0, loadHour: 0, transfersToday: 0, rejectedToday: 0,
        path: new Int32Array(0), pts: new Float32Array(0), cum: new Float32Array(0), stopD: [], visits: [], len: 0, segMin: [], cycleMin: 0, takt: Infinity,
      });
    }
    T.signalMode = new Map(d.signalMode || []);
    T.fare = d.fare ?? TP.fare;
    T.free = { bus: 0, tram: 0, ...(d.free || {}) };
    T.num = { bus: 0, tram: 0, ...(d.num || {}) };
    if (d.next) [T.nextStop, T.nextLine, T.nextVeh] = d.next;
    T.hubs = new Map(d.hubs || []);
    T.hist = d.hist || [];
    T.totals = { ...T.totals, ...(d.totals || {}) };
    T.accidentLog = d.accidentLog || [];
    T.marks = d.marks || 0;
    changed(T);
    scanFacilities(g);
    rebuildAll(g);
    updateSignals(g);
    rebuildFerries(g);
    stopTakts(g);
    updateCatchments(g);
    buildGraph(g);
    shortestTrees(g);
    computeFields(g);
    demandMods(g);
  },

  renderables(g) { return renderables(g); },
});

// ---------------------------------------------------------------- Darstellung: bewegliche Objekte (Vertrag 6.3)

const _o = { x: 0, z: 0, rot: 0 };
const _fp = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, phase: '' };
const _tp = { x: 0, y: 0, z: 0, yaw: 0 };

export function renderables(g) {
  const T = TS(g);
  if (!T) return [];
  const out = [];
  const get = () => { const o = {}; out.push(o); return o; };
  const dtS = clamp((g.time - T.tStep) / GAME_MIN_PER_SEC, 0, 0.3);
  const lm = lineMap(T);
  const W2 = g.W / 2, H2 = g.H / 2;
  // Busse und Straßenbahnen
  for (const v of T.vehicles) {
    const line = lm.get(v.line);
    if (!line || !line.cum || line.cum.length < 2) continue;
    const vt = VEHICLE_TYPES[line.vtype] || VEHICLE_TYPES.bus;
    let s = v.s;
    if (v.state === 'move') {
      s += v.vs * dtS;
      if (v.dir > 0 ? s > v.tgt : s < v.tgt) s = v.tgt;
    } else if (v.dwell < dtS && !line.broken) {
      // fährt in diesem Moment an
      const tgtVisit = line.visits[v.vi];
      if (tgtVisit) {
        const fromVisit = line.visits[(v.vi - 1 + line.visits.length) % line.visits.length];
        const dir = fromVisit.dir;
        let s0 = s;
        if (line.loop && s0 >= line.len - 1e-6) s0 = 0;
        const tgt = line.loop && v.vi === 0 ? line.len : tgtVisit.s;
        s = s0 + dir * (v.v0 || 1) * 0.35 * (dtS - v.dwell);
        if (dir > 0 ? s > tgt : s < tgt) s = tgt;
      }
    }
    const segs = vt.segments || 1;
    for (let k = 0; k < segs; k++) {
      const sk = s - v.dir * k * (vt.len + 0.06);
      const q = polyPose(line, line.loop ? ((sk % line.len) + line.len) % line.len : sk, _pp);
      const dx = q.tx * v.dir, dy = q.ty * v.dir;
      const tile = clamp(Math.floor(q.y), 0, g.H - 1) * g.W + clamp(Math.floor(q.x), 0, g.W - 1);
      const r = g.road[tile];
      const off = line.mode === 'tram' ? (r === R.AVENUE ? 0.13 : 0.15) : (LANE_OFF[r] || 0.16) + (v.state === 'dwell' ? 0.03 : 0);
      const o = get();
      o.kind = vt.kind;
      o.x = q.x - W2 - dy * off;
      o.z = q.y - H2 + dx * off;
      o.y = g.world.terrain[tile] === TER.WATER ? 0.24 : 0.012;
      o.yaw = Math.atan2(dx, dy);
      o.color = lineColor(line);
      o.len = vt.len;
      o.lights = true;
      o.line = line.id;
      o.label = line.num;
      o.pax = v.pax;
      o.cap = vt.cap;
      o.vtype = line.vtype;
      if (segs > 1) o.segment = k;
      o.id = v.id * 4 + k;
    }
  }
  // Fernzüge
  for (const [bid, R2] of T.rail) {
    const b = g.buildings.get(bid);
    if (!b || !R2.trains.length) continue;
    const def = BUILDINGS.train_station;
    const L = def.size[0] / 2;
    const vis = L - STATION_LAYOUT.portal + 0.29;
    for (const tr of R2.trains) {
      const t = (g.time - tr.t0) / GAME_MIN_PER_SEC;
      const xf = trainFront(def, tr, t);
      const z = STATION_LAYOUT.tracks[tr.track];
      let off = 0;
      for (let k = 0; k < trainCars(tr); k++) {
        const len = k === 0 ? STATION_LAYOUT.locoLen : STATION_LAYOUT.carLen;
        const xc = xf - off - len / 2;
        off += len;
        if (Math.abs(xc) > vis) continue;
        const lx = tr.dir * xc;
        localToWorld(g, b, lx, z, _o);
        const o = get();
        o.kind = k === 0 ? 'train_loco' : 'train_wagon';
        o.x = _o.x; o.z = _o.z; o.y = 0.02;
        o.yaw = (tr.dir > 0 ? Math.PI / 2 : -Math.PI / 2) + _o.rot;
        o.len = len - 0.04;
        o.color = tr.color;
        o.lights = true;
        o.id = 900000 + bid * 16 + k;
      }
    }
  }
  // Flugzeuge
  for (const [bid, A] of T.air) {
    const b = g.buildings.get(bid);
    if (!b) continue;
    for (const f of A.flights) {
      const t = (g.time - f.t0) / GAME_MIN_PER_SEC;
      flightPose(f, t, _fp);
      localToWorld(g, b, _fp.x, _fp.z, _o);
      const o = get();
      o.kind = 'plane';
      o.x = _o.x; o.z = _o.z; o.y = _fp.y;
      o.yaw = _fp.yaw + _o.rot;
      o.pitch = _fp.pitch;
      o.len = f.big ? 1.6 : 1.2;
      o.color = [0xffffff, 0xf2f2f0, 0xe8543f, 0x2f8fe0, 0xf2b01e, 0x22a866][f.livery];
      o.lights = true;
      o.phase = _fp.phase;
      o.id = 800000 + bid * 8 + f.stand;
    }
  }
  // Fähren
  for (const f of T.ferries) {
    if (!f.cum || f.cum.length < 2) continue;
    let s = f.s;
    if (f.state === 'move') { s += f.vs * dtS; s = clamp(s, 0, f.len); }
    const q = polyPose(f, s, _pp);
    const o = get();
    o.kind = 'ferry';
    o.x = q.x - W2; o.z = q.y - H2; o.y = -0.13;
    o.yaw = Math.atan2(q.tx * f.dir, q.ty * f.dir);
    o.len = 1.0;
    o.lights = true;
    o.pax = f.pax;
    o.id = 700000 + (hash2(f.a, f.b) * 1e5 | 0);
  }
  // Taxis
  for (const tx of T.taxis) {
    if (!tx.path) continue;
    taxiPose(g, tx, tx.vs * dtS, _tp);
    const o = get();
    o.kind = 'taxi';
    o.x = _tp.x; o.z = _tp.z; o.y = _tp.y; o.yaw = _tp.yaw;
    o.color = 0xf2c230;
    o.len = 0.45;
    o.lights = true;
    o.id = 600000 + tx.depot * 32 + (tx.color % 32);
  }
  // Unfälle: zwei Unfallwagen, Polizei und Rettungswagen am Rand
  for (const a of T.accidents) {
    if (g.time >= a.until) continue;
    const cx = a.x + 0.5 - W2, cz = a.y + 0.5 - H2;
    const r = hash2(a.seed, 1);
    const wrecks = [[-0.12, 0.05, 0.6 + r], [0.14, -0.08, 2.2 + r]];
    for (const [dx, dz, yaw] of wrecks) { const o = get(); o.kind = 'car'; o.x = cx + dx; o.z = cz + dz; o.y = 0.012; o.yaw = yaw; o.color = r > 0.5 ? 0x8a8f99 : 0xb5473a; o.len = 0.45; o.wreck = true; o.lights = false; }
    if (a.police && g.time > a.t0 + 15) { const o = get(); o.kind = 'police'; o.x = cx + 0.42; o.z = cz + 0.3; o.y = 0.012; o.yaw = Math.PI / 2; o.len = 0.45; o.lights = true; o.siren = true; }
    if (a.ambulance && g.time > a.t0 + 20) { const o = get(); o.kind = 'ambulance'; o.x = cx - 0.42; o.z = cz - 0.32; o.y = 0.012; o.yaw = -Math.PI / 2; o.len = 0.55; o.lights = true; o.siren = true; }
  }
  return out;
}

// Für Ansicht und Panel: Weltposition einer Haltestelle (Bordstein-Seite)
export function stopWorld(g, s) {
  const [dx, dy] = DIRS[s.side] || DIRS[2];
  const r = g.road[s.tile];
  const half = r === R.AVENUE ? 0.42 : r === R.LANE ? 0.21 : 0.3;
  return { x: s.x + 0.5 - g.W / 2 + dx * (half + 0.04), z: s.y + 0.5 - g.H / 2 + dy * (half + 0.04), nx: dx, nz: dy };
}

// ---------------------------------------------------------------- Register: Glück, Bodenwert, Nachfrage, Haushalt, Probleme

const T0 = (g) => g.ext && g.ext.transport;
HAPPINESS_FACTORS.push((g, b, i) => {
  const T = T0(g); if (!T || !T.covField) return null;
  const c = T.covField[i];
  if (c < 0.03) return null;
  return ['Bus & Tram', c * (b.zone === Z.RES ? 4 : 2.5)];
});
HAPPINESS_FACTORS.push((g, b, i) => {
  const T = T0(g); if (!T || !T.crowdField) return null;
  const c = T.crowdField[i];
  return c > 0.12 ? ['Überfüllte Busse', -Math.min(6, 8 * c)] : null;
});
HAPPINESS_FACTORS.push((g, b, i) => {
  const T = T0(g); if (!T || !T.accField) return null;
  return T.accField[i] ? ['Unfall in der Nähe', -3] : null;
});
HAPPINESS_FACTORS.push((g, b, i) => {
  const T = T0(g); if (!T || !T.parkField || b.zone !== Z.COM) return null;
  if (T.parkField[i]) return ['Parkhaus', 3];
  if (b.level >= 3 && g.stats.pop > 1500) return ['Parkplatznot', -2];
  return null;
});
HAPPINESS_FACTORS.push((g, b, i) => {
  const T = T0(g); if (!T || !T.dieselField || b.zone !== Z.RES) return null;
  return T.dieselField[i] ? ['Dieselbusse vor dem Haus', -1.5] : null;
});
HAPPINESS_FACTORS.push((g, b) => {
  const T = T0(g); if (!T || !T.lines.length) return null;
  if (b.zone === Z.RES && T.fare === 0) return ['Kostenloser Nahverkehr', 2];
  if (b.zone === Z.RES && g.policies.has('tp_nightbus')) return ['Nachtbusse', 1];
  return null;
});
HAPPINESS_FACTORS.push((g, b) => {
  if (b.zone !== Z.COM || !g.policies.has('tp_parkfee')) return null;
  return ['Parkgebühren', -2];
});
HAPPINESS_FACTORS.push((g, b) => {
  if (!b.zone || b.zone === Z.RES || b.access < 0) return null;
  const c = g.congestion[b.access];
  return c > 1.0 ? ['Stau vor der Tür', -Math.min(5, 2 + (c - 1) * 6)] : null;
});
LANDVALUE_TERMS.push((g, i) => { const T = T0(g); return T && T.lvField ? T.lvField[i] : 0; });
DEMAND_MODIFIERS.push((g, d) => { const T = T0(g); if (!T) return; const m = T.demandMod; for (let z = 1; z <= 4; z++) d[z] += m[z]; });
BUDGET_LINES.push({ id: 'tp_fares', label: 'Fahrgeld Bus & Tram', kind: 'income', amount: (g) => { const T = T0(g); return T ? T.faresToday : 0; } });
BUDGET_LINES.push({ id: 'tp_long', label: 'Bahnhof, Flughafen, Fähren & Taxis', kind: 'income', amount: (g) => { const T = T0(g); return T ? T.longToday : 0; } });
BUDGET_LINES.push({ id: 'tp_parkfee', label: 'Parkgebühren', kind: 'income', amount: (g) => { if (!g.policies.has('tp_parkfee')) return 0; const T = T0(g); return g.stats.pop / 100 * 0.8 + ((T && T.parking) || []).length * 25; } });
BUDGET_LINES.push({ id: 'tp_lines', label: 'Bus- & Tramlinien', kind: 'expense', amount: (g) => networkUpkeep(g) });
BUDGET_LINES.push({ id: 'tp_ferries', label: 'Fährbetrieb', kind: 'expense', amount: (g) => { const T = T0(g); return T ? T.ferries.length * 30 * g.upkeepMul() : 0; } });
BUILDING_PROBLEMS.push((g, b) => {
  if (b.zone || b.construct < 1) return null;
  if (b.key !== 'bus_depot' && b.key !== 'tram_depot') return null;
  const T = T0(g); if (!T) return null;
  const mode = b.key === 'tram_depot' ? 'tram' : 'bus';
  return T.lines.some((l) => l.mode === mode) ? null : 'tp_depot';
});
BUILDING_PROBLEMS.push((g, b) => {
  if (!b.zone || b.zone === Z.RES || b.access < 0 || b.construct < 1) return null;
  return g.congestion[b.access] > 1.15 ? 'tp_jam' : null;
});
