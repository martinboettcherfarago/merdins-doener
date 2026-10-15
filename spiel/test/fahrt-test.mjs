// Prüfstand „Fahren" (Agent Fahrt): lässt dichten Verkehr headless laufen und misst, ob er glaubwürdig fährt.
//   node test/fahrt-test.mjs [sekunden=50]        (FT_ROOT=<anderer spiel-Ordner> misst einen anderen Stand)
// Szenen: A Megastadt (saves/megastadt.json, sehr dichter Verkehr, Busse und Straßenbahnen), B Sandkasten-Stadt mit
// Allee, Ampeln, Autobahn, Bus-, Gelenkbus-, Ring- und Straßenbahnlinien mit Kurven und Endhaltestellen.
// Gemessen je Bild (30 Bilder/s, ×1, Tageslänge „Lang"):
//  - Überlappungen: Fahrzeugkörper (gedrehte Rechtecke, leicht verkleinert), die sich schneiden – Pkw, Lkw mit
//    Auflieger, Busse, Straßenbahnglieder, Taxis, Dienstwagen (Glieder desselben Fahrzeugs zählen nicht).
//  - Fußgänger: Querende auf Zebrastreifen an Kreuzungen (wie life.js: warten auf Grün bzw. eine Lücke) – Fahrzeuge,
//    die einen Querenden berühren.
//  - Drehsprünge: Richtungswechsel eines Körpers von mehr als 25° zwischen zwei Bildern (Drehen auf der Stelle,
//    Umklappen an der Endhaltestelle); Lagesprünge über 0,3 Felder.
//  - Neben der Fahrbahn: Räder (Achsenden) langer Fahrzeuge (Straßenbahnglieder, Auflieger, Busse, Lkw) außerhalb der
//    Fahrbahn; dazu, wie oft die Karosserie mehr als 0,08 über den Rand ragt (etwas Überhang an engen Ecken ist üblich).
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRng } from '../src/sim/rng.js';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(process.env.FT_ROOT || join(here, '..'));
// Reproduzierbarer Zufall (Fahrtenwahl, Fußgänger)
const rr = makeRng(4242);
Math.random = () => rr();
const { Game } = await import(join(ROOT, 'src/sim/game.js'));
const { R, ROAD_GEOM } = await import(join(ROOT, 'src/config.js'));
const { buildDemoCity } = await import(join(ROOT, 'src/sim/demo.js'));
const TPS = await import(join(ROOT, 'src/sim/systems/transport.js'));
const SECS = +(process.argv[2] || 50);
const DEBUG = process.env.FT_DEBUG ? +process.env.FT_DEBUG || 6 : 0; // Beispiele je Befund ausgeben
const samples = {};
const sample = (kind, txt) => { if (!DEBUG) return; const a = samples[kind] || (samples[kind] = []); if (a.length < DEBUG) a.push(txt); };
const where = (g, x, z) => { const t = Math.floor(z + g.H / 2) * g.W + Math.floor(x + g.W / 2); return `(${(x + g.W / 2).toFixed(2)},${(z + g.H / 2).toFixed(2)}) Feld ${t % g.W},${(t / g.W) | 0} Typ ${g.road[t]}`; };
const FPS = 30;
const t0 = Date.now();
let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) fails++; console.log(`  ${c ? '✓' : '✗'} ${msg}`); return c; };

// ---------------------------------------------------------------- Maße (wie render/vehicles_models.js)
// Länge, Breite, Achsen (vorn, hinten; lokal ab Mitte)
const DIM = {
  car_compact: [0.425, 0.179, 0.12, -0.14], car_sedan: [0.475, 0.183, 0.145, -0.14], car_kombi: [0.48, 0.183, 0.147, -0.141], car_suv: [0.465, 0.19, 0.142, -0.137],
  car_small: [0.36, 0.165, 0.112, -0.115], car_coupe: [0.45, 0.185, 0.14, -0.13], minibus: [0.52, 0.196, 0.165, -0.17], van: [0.52, 0.196, 0.165, -0.17],
  van_box: [0.64, 0.21, 0.21, -0.2], police: [0.475, 0.183, 0.145, -0.14], police_van: [0.52, 0.196, 0.165, -0.17], truck_box: [0.84, 0.25, 0.3, -0.2],
  truck_tractor: [0.6, 0.25, 0.21, -0.17], fire: [0.86, 0.25, 0.3, -0.22], fire_ladder: [1.0, 0.25, 0.34, -0.26], garbage: [0.92, 0.25, 0.3, -0.22],
  taxi: [0.475, 0.183, 0.145, -0.14], ambulance: [0.68, 0.22, 0.24, -0.2], hearse: [0.53, 0.185, 0.17, -0.16], snowplow: [0.9, 0.26, 0.3, -0.22],
  bus: [1.2, 0.255, 0.33, -0.26], tram: [1.15, 0.24], trailer: [1.32, 0.255, -0.36, -0.6],
  bus_artic_a: [0.98, 0.255, 0.27, -0.37], bus_artic_b: [0.82, 0.255, -0.17, -0.17],
};
const CAR_TYPES = [['car_compact', 28], ['car_sedan', 16], ['car_kombi', 20], ['car_suv', 16], ['car_small', 12], ['car_coupe', 5], ['minibus', 3]];
function hashf(n) { let t = (n | 0) + 0x6d2b79f5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function carType(u) { let r = u * 100; for (const [t, w] of CAR_TYPES) { r -= w; if (r <= 0) return t; } return 'car_compact'; }

// ---------------------------------------------------------------- Körper aller Straßenfahrzeuge
const ROADKINDS = new Set(['bus', 'tram', 'taxi', 'ambulance', 'hearse', 'snowplow', 'police', 'fire', 'car']);
function bodies(g, st) {
  const out = [];
  const tr = g.traffic;
  const add = (key, part, x, z, yaw, len, wid, cls, d) => out.push({ key, part, x, z, yaw, len, wid, cls, ax: d && d.length > 2 ? [d[2], d[3]] : null });
  if (tr.lanes) {
    for (const c of tr.cars) {
      if (c.sysDraw || c.state !== 1 || c.hidden) continue;
      tr.pose(c);
      const d = DIM[c.model] || DIM.car_compact;
      const cls = c.trailer ? 'semi' : d[0] > 0.8 ? 'truck' : 'car';
      add('c' + c.id, 0, c.x, c.z, c.yaw, d[0], d[1], cls, d);
      if (c.trailer) add('c' + c.id, 1, c.tx, c.tz, c.tyaw, DIM.trailer[0], DIM.trailer[1], 'trailer', DIM.trailer);
    }
  } else {
    // alter Stand: Mitte und Richtung aus der Simulation, Spurversatz der Allee und Auflieger wie im alten agents.js
    for (const c of tr.cars) {
      const id = c.id;
      let model = 'car_compact', trailer = false;
      if (c.type === 0) model = carType(hashf(id * 7 + 1));
      else if (c.type === 1) { if (hashf(id * 17 + 3) < 0.42) model = 'truck_box'; else { model = 'truck_tractor'; trailer = true; } }
      else if (c.type === 2) model = hashf(id * 19 + 4) < 0.6 ? 'van_box' : 'van';
      else if (c.type === 3) model = hashf(id * 23 + 1) < 0.75 ? 'fire' : 'fire_ladder';
      else if (c.type === 4) model = hashf(id * 37 + 2) < 0.8 ? 'police' : 'police_van';
      else if (c.type === 5) model = 'garbage';
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
      let cx = c.x, cz = c.z;
      const rt = g.road[c.path[Math.min(c.piece, c.path.length - 1)]];
      if (rt === R.AVENUE || rt === R.HIGHWAY) { const lane = (hashf(id * 53 + 9) < 0.55 ? -1 : 1) * 0.09; cx += -fz * lane; cz += fx * lane; }
      const d = DIM[model];
      add('c' + id, 0, cx, cz, c.yaw, d[0], d[1], trailer ? 'semi' : d[0] > 0.8 ? 'truck' : 'car', d);
      if (trailer) {
        let h = st.hist.get(id);
        if (!h) { h = { xs: new Float32Array(48), zs: new Float32Array(48), n: 0, head: -1 }; st.hist.set(id, h); }
        const N = 48;
        if (h.n === 0 || Math.hypot(cx - h.xs[h.head], cz - h.zs[h.head]) > 0.04) {
          if (h.n > 0 && Math.hypot(cx - h.xs[h.head], cz - h.zs[h.head]) > 1.5) h.n = 0;
          h.head = (h.head + 1) % N; h.xs[h.head] = cx; h.zs[h.head] = cz; h.n = Math.min(N, h.n + 1);
        }
        const kx = cx - fx * 0.17, kz = cz - fz * 0.17;
        let px = cx, pz = cz, acc = 0, ax = 0, az = 0, found = false;
        for (let j = 0; j < h.n; j++) {
          const idx = (h.head - j + N) % N, qx = h.xs[idx], qz = h.zs[idx], l = Math.hypot(qx - px, qz - pz);
          if (acc + l >= 1.2 && l > 1e-6) { const t = (1.2 - acc) / l; ax = px + (qx - px) * t; az = pz + (qz - pz) * t; found = true; break; }
          acc += l; px = qx; pz = qz;
        }
        if (!found) { const rest = 1.2 - acc; ax = px - fx * rest; az = pz - fz * rest; }
        let dx = kx - ax, dz = kz - az; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        add('c' + id, 1, kx - dx * 0.56, kz - dz * 0.56, Math.atan2(dx, dz), DIM.trailer[0], DIM.trailer[1], 'trailer', DIM.trailer);
      }
    }
  }
  for (const r of g.renderables()) {
    if (!ROADKINDS.has(r.kind) || r.wreck) continue;
    // nur fahrende Straßenfahrzeuge (Unfall- und Katastrophenstellen stehen)
    if (tr.lanes ? !r.road : (r.kind === 'car' || r.kind === 'police' || r.kind === 'fire' || r.siren)) continue;
    const seg = r.segment !== undefined;
    const vid = seg ? Math.floor(r.id / (tr.lanes ? 16 : 4)) : r.id;
    const d = DIM[r.kind] || DIM.car_compact;
    const len = r.len || d[0];
    // Richtung wie gezeichnet (Führerstand von hinten: Modell gedreht); Mittelglieder sind vorn wie hinten gleich
    const dm = (r.model && DIM[r.model]) || (seg ? null : d);
    add(r.kind + vid, seg ? r.segment : 0, r.x, r.z, r.yaw + (r.flip ? Math.PI : 0), len, d[1], r.kind === 'tram' ? 'tram' : r.kind === 'bus' ? 'bus' : 'car', dm);
    if (r.model && r.model.startsWith('tram_link')) out[out.length - 1].sym = true;
  }
  return out;
}

// ---------------------------------------------------------------- Geometrie
function corners(b, shrinkL, shrinkW, out) {
  const s = Math.sin(b.yaw), c = Math.cos(b.yaw);
  const hl = b.len / 2 - shrinkL, hw = b.wid / 2 - shrinkW;
  out[0] = b.x + s * hl + c * hw; out[1] = b.z + c * hl - s * hw;
  out[2] = b.x + s * hl - c * hw; out[3] = b.z + c * hl + s * hw;
  out[4] = b.x - s * hl - c * hw; out[5] = b.z - c * hl + s * hw;
  out[6] = b.x - s * hl + c * hw; out[7] = b.z - c * hl - s * hw;
  return out;
}
const _a = new Float64Array(8), _b = new Float64Array(8);
function overlap(A, B) {
  corners(A, 0.03, 0.015, _a); corners(B, 0.03, 0.015, _b);
  for (const P of [_a, _b]) for (let i = 0; i < 2; i++) {
    const ex = P[(i + 1) * 2] - P[i * 2], ez = P[(i + 1) * 2 + 1] - P[i * 2 + 1];
    const nx = -ez, nz = ex;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (let k = 0; k < 4; k++) { const p = _a[k * 2] * nx + _a[k * 2 + 1] * nz; if (p < a0) a0 = p; if (p > a1) a1 = p; const q = _b[k * 2] * nx + _b[k * 2 + 1] * nz; if (q < b0) b0 = q; if (q > b1) b1 = q; }
    if (a1 <= b0 || b1 <= a0) return false;
  }
  return true;
}
function pointInBody(b, x, z, r) {
  const s = Math.sin(b.yaw), c = Math.cos(b.yaw);
  const dx = x - b.x, dz = z - b.z;
  const along = dx * s + dz * c, lat = dx * c - dz * s;
  return Math.abs(along) < b.len / 2 + r - 0.02 && Math.abs(lat) < b.wid / 2 + r - 0.01;
}
// Liegt ein Punkt auf der Fahrbahn (wie die Flächen in roads.js, mit kleiner Toleranz)?
function onRoad(g, x, z, tol = 0.025) {
  const W = g.W, H = g.H;
  const gx = x + W / 2, gz = z + H / 2;
  const ix = Math.floor(gx), iz = Math.floor(gz);
  if (ix < 0 || iz < 0 || ix >= W || iz >= H) return false;
  const i = iz * W + ix, t = g.road[i];
  if (!t) return false;
  const u = gx - ix - 0.5, v = gz - iz - 0.5;
  const half = (rt) => (ROAD_GEOM[rt] || ROAD_GEOM[2]).width / 2;
  const own = half(t);
  const DXs = [0, 1, 0, -1], DZs = [-1, 0, 1, 0];
  const conn = [], hw = [];
  for (let d = 0; d < 4; d++) {
    const xx = ix + DXs[d], zz = iz + DZs[d];
    const nt = xx >= 0 && zz >= 0 && xx < W && zz < H ? g.road[zz * W + xx] : (d === 3 && t === R.HIGHWAY ? R.HIGHWAY : 0);
    conn.push(!!nt); hw.push(nt ? Math.max(own, half(nt)) : own);
  }
  const deg = conn.filter(Boolean).length;
  if (deg === 0) return Math.abs(u) < 0.4 && Math.abs(v) < 0.4;
  if (deg === 1) {
    const d = conn.indexOf(true), rc = Math.min(0.44, Math.max(0.28, own * 1.35));
    if (Math.hypot(u, v) <= rc + tol) return true;
    const along = u * DXs[d] + v * DZs[d], lat = Math.abs(u * DZs[d] - v * DXs[d]);
    return along >= 0 && lat <= hw[d] + tol;
  }
  if (deg === 2 && ((conn[0] && conn[2]) || (conn[1] && conn[3]))) {
    if (conn[0]) return Math.abs(u) <= hw[0] + (hw[2] - hw[0]) * (v + 0.5) + tol;
    return Math.abs(v) <= hw[3] + (hw[1] - hw[3]) * (u + 0.5) + tol;
  }
  if (deg === 2) {
    let d1 = conn.indexOf(true), d2 = conn.lastIndexOf(true);
    const cx = (DXs[d1] + DXs[d2]) * 0.5, cz = (DZs[d1] + DZs[d2]) * 0.5;
    const r = Math.hypot(u - cx, v - cz);
    return Math.abs(r - 0.5) <= Math.max(hw[d1], hw[d2]) + tol;
  }
  const hx = conn[0] || conn[2] ? Math.max(conn[0] ? hw[0] : 0, conn[2] ? hw[2] : 0) : own;
  const hz = conn[1] || conn[3] ? Math.max(conn[1] ? hw[1] : 0, conn[3] ? hw[3] : 0) : own;
  if (Math.abs(u) <= hx + tol && Math.abs(v) <= hz + tol) return true;
  if (conn[0] && v < 0 && Math.abs(u) <= hw[0] + tol) return true;
  if (conn[2] && v > 0 && Math.abs(u) <= hw[2] + tol) return true;
  if (conn[1] && u > 0 && Math.abs(v) <= hw[1] + tol) return true;
  if (conn[3] && u < 0 && Math.abs(v) <= hw[3] + tol) return true;
  return false;
}

// ---------------------------------------------------------------- Fußgänger auf Zebrastreifen (wie life.js)
class Crossers {
  constructor(g, n) { this.g = g; this.n = n; this.list = []; this.arms = null; this.waits = 0; this.crossed = 0; }
  findArms() {
    const g = this.g, W = g.W, H = g.H;
    const arms = [];
    const counts = new Map();
    for (const b of bodies(g, { hist: new Map() })) { const t = Math.floor(b.z + H / 2) * W + Math.floor(b.x + W / 2); counts.set(t, (counts.get(t) || 0) + 1); }
    for (let i = 0; i < g.N; i++) {
      if (!g.road[i] || g.road[i] === R.HIGHWAY) continue;
      const x = i % W, y = (i / W) | 0;
      let deg = 0;
      const ds = [];
      for (const [d, dx, dy] of [[0, 0, -1], [1, 1, 0], [2, 0, 1], [3, -1, 0]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && g.road[yy * W + xx]) { deg++; ds.push([d, yy * W + xx]); } }
      if (deg < 3) continue;
      let busy = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) busy += counts.get(i + dy * W + dx) || 0;
      for (const [d, a] of ds) { const ma = g.road[a]; if (ma === R.HIGHWAY) continue; arms.push({ J: i, side: d, A: a, w: 1 + busy }); }
    }
    arms.sort((p, q) => q.w - p.w);
    this.arms = arms.slice(0, 160);
  }
  spawn() {
    if (!this.arms || !this.arms.length) return;
    const a = this.arms[Math.floor(Math.random() * this.arms.length)];
    this.list.push({ a, t: 0, state: 0, wait: Math.random() < 0.55 ? 1.5 + Math.random() * 4 : 0, dir: Math.random() < 0.5 ? 1 : -1, x: 0, z: 0 });
  }
  update(dt) {
    const g = this.g, F = g.traffic.lanes, W = g.W, H = g.H;
    while (this.list.length < this.n) this.spawn();
    let w = 0;
    for (const p of this.list) {
      const a = p.a, J = a.J;
      const geo = ROAD_GEOM[g.road[a.A]] || ROAD_GEOM[2];
      const half = geo.width / 2 + 0.03;
      const len = 2 * half, need = len / 0.12;
      if (p.state === 0) {
        if (F) { if (F.pedMayCross(J, a.side, need)) p.state = 1; else this.waits++; }
        else { p.wait -= dt; if (p.wait <= 0) p.state = 1; }
      }
      if (p.state === 1) {
        p.t += (0.12 * dt) / len;
        if (F) F.markCrossing(J, a.side);
        if (p.t >= 1) { this.crossed++; continue; }
      }
      // Lage: Querlinie 0,105 vor der Kreuzungskante im Arm-Feld
      const DXs = [0, 1, 0, -1], DZs = [-1, 0, 1, 0];
      const jx = (J % W) + 0.5 - W / 2, jz = ((J / W) | 0) + 0.5 - H / 2;
      const ax = DXs[a.side], az = DZs[a.side];
      const along = 0.5 + 0.105;
      const lat = (p.state === 0 ? -half - 0.02 : -half + p.t * len) * p.dir;
      p.x = jx + ax * along + az * lat; p.z = jz + az * along - ax * lat;
      this.list[w++] = p;
    }
    this.list.length = w;
  }
}

// ---------------------------------------------------------------- Messlauf
function measure(name, g, secs) {
  console.log(`\n=== ${name} ===`);
  g.minPerSec = 24; g.speed = 1;
  g.on && g.on('cards', (ids) => g.chooseCard(ids[0]));
  g.on && g.on('event', () => g.resolveEvent(0));
  const step = () => { g.update(1 / FPS); if (g.pendingCards) g.chooseCard(g.pendingCards[0]); if (g.pendingEvent) g.resolveEvent(0); };
  // Anlauf: Straßen füllen sich
  for (let k = 0; k < 25 * FPS; k++) step();
  const st = { hist: new Map() };
  const peds = new Crossers(g, 70);
  peds.findArms();
  const M = { frames: 0, bodyFrames: 0, overlapPairs: 0, overlapFrames: 0, pairs: new Set(), pedHits: 0, pedHitSet: new Set(), snaps: 0, maxTurn: 0, jumps: 0,
    off: { tram: [0, 0, 0], trailer: [0, 0, 0], bus: [0, 0, 0], truck: [0, 0, 0], semi: [0, 0, 0], car: [0, 0, 0] }, vehicles: 0, ms: 0, speed: 0, nSpeed: 0 };
  const last = new Map();
  const cell = new Map();
  const cs = new Float64Array(8);
  for (let f = 0; f < secs * FPS; f++) {
    const a = performance.now();
    step();
    M.ms += performance.now() - a;
    peds.update(1 / FPS);
    const B = bodies(g, st);
    M.frames++; M.bodyFrames += B.length; M.vehicles = Math.max(M.vehicles, B.length);
    // Überlappungen über ein Raster
    cell.clear();
    for (let i = 0; i < B.length; i++) {
      const b = B[i], k = Math.floor(b.x) * 4096 + Math.floor(b.z);
      let a2 = cell.get(k); if (!a2) { a2 = []; cell.set(k, a2); } a2.push(i);
    }
    let fo = 0;
    for (let i = 0; i < B.length; i++) {
      const b = B[i], bx = Math.floor(b.x), bz = Math.floor(b.z);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const lst = cell.get((bx + dx) * 4096 + bz + dz);
        if (!lst) continue;
        for (const j of lst) {
          if (j <= i) continue;
          const c = B[j];
          if (c.key === b.key) continue;
          if (Math.abs(c.x - b.x) > 2.2 || Math.abs(c.z - b.z) > 2.2) continue;
          if (overlap(b, c)) { fo++; const pk = b.key < c.key ? b.key + '|' + c.key : c.key + '|' + b.key; if (!M.pairs.has(pk)) sample('Überlappung', `${b.key}/${b.part} ${b.cls} ⨯ ${c.key}/${c.part} ${c.cls} bei ${where(g, b.x, b.z)} f${f}`); M.pairs.add(pk); }
        }
      }
    }
    M.overlapPairs += fo; if (fo) M.overlapFrames++;
    // Fußgänger auf dem Zebrastreifen berührt?
    for (const p of peds.list) {
      if (p.state !== 1) continue;
      const lst = cell.get(Math.floor(p.x) * 4096 + Math.floor(p.z));
      const near = [];
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const l2 = cell.get((Math.floor(p.x) + dx) * 4096 + Math.floor(p.z) + dz); if (l2) near.push(...l2); }
      void lst;
      for (const j of near) if (pointInBody(B[j], p.x, p.z, 0.035)) { M.pedHits++; const hk = B[j].key + '@' + p.a.J; if (!M.pedHitSet.has(hk)) sample('Fußgänger', `${B[j].key} ${B[j].cls} trifft Querenden an J ${p.a.J % g.W},${(p.a.J / g.W) | 0} Arm ${p.a.side} t ${p.t.toFixed(2)} f${f}`); M.pedHitSet.add(hk); }
    }
    // Drehsprünge, Lagesprünge, neben der Fahrbahn
    for (const b of B) {
      const id = b.key + '/' + b.part;
      const l = last.get(id);
      if (l && l.f === f - 1) {
        let dy = Math.abs(b.yaw - l.yaw) % (Math.PI * 2);
        if (dy > Math.PI) dy = Math.PI * 2 - dy;
        if (b.sym && dy > Math.PI / 2) dy = Math.PI - dy; // symmetrisches Glied: Zählrichtung egal
        const deg = dy * 180 / Math.PI;
        if (deg > M.maxTurn) M.maxTurn = deg;
        if (deg > 25) { M.snaps++; sample('Drehsprung', `${id} ${b.cls} ${deg.toFixed(0)}° bei ${where(g, b.x, b.z)} f${f}`); }
        const dp = Math.hypot(b.x - l.x, b.z - l.z);
        if (dp > 0.3) { M.jumps++; sample('Lagesprung', `${id} ${b.cls} ${dp.toFixed(2)} bei ${where(g, b.x, b.z)} f${f}`); }
        else { M.speed += dp * FPS; M.nSpeed++; }
      }
      last.set(id, { f, yaw: b.yaw, x: b.x, z: b.z });
      const o = M.off[b.cls];
      if (o && (b.cls !== 'car' || (f & 3) === 0)) {
        o[1]++;
        // Räder (Achsenden): stehen sie auf der Fahrbahn?
        const s = Math.sin(b.yaw), c = Math.cos(b.yaw), hw = b.wid / 2 - 0.02;
        const ax = b.ax ? (b.flip ? [-b.ax[0], -b.ax[1]] : b.ax) : b.cls === 'tram' ? [b.len / 2 - 0.08, -(b.len / 2 - 0.08)] : [b.len * 0.3, -b.len * 0.28];
        let bad = null;
        for (const a of ax) for (const w of [hw, -hw]) { const px = b.x + s * a + c * w, pz = b.z + c * a - s * w; if (!bad && !onRoad(g, px, pz)) bad = { a, px, pz }; }
        if (bad) { o[0]++; if (b.cls !== 'car') sample('Räder neben der Fahrbahn ' + b.cls, `${id} Achse ${bad.a.toFixed(2)} bei ${where(g, bad.px, bad.pz)} Mitte ${where(g, b.x, b.z)} f${f}`); }
        // Karosserie: ragt eine Ecke deutlich über den Fahrbahnrand (Überhang an engen Ecken ist üblich)?
        corners(b, b.len * 0.03, 0.01, cs);
        let bk = -1;
        for (let k = 0; k < 4 && bk < 0; k++) if (!onRoad(g, cs[k * 2], cs[k * 2 + 1], 0.08)) bk = k;
        if (bk >= 0) { o[2]++; if (b.cls !== 'car') sample('Karosserie über dem Rand ' + b.cls, `${id} Ecke ${bk} bei ${where(g, cs[bk * 2], cs[bk * 2 + 1])} Mitte ${where(g, b.x, b.z)} f${f}`); }
      }
    }
  }
  const pct = (a, b) => (b ? (100 * a / b).toFixed(2) : '0.00');
  console.log(`  Fahrzeuge bis ${M.vehicles} je Bild, ${M.frames} Bilder, Rechenzeit Simulation ${(M.ms / M.frames).toFixed(2)} ms/Bild, Tempo im Mittel ${(M.speed / Math.max(1, M.nSpeed)).toFixed(2)} Felder/s`);
  console.log(`  Überlappungen: ${M.overlapPairs} Paar-Bilder (${pct(M.overlapPairs, M.bodyFrames)} % der Körper-Bilder), in ${pct(M.overlapFrames, M.frames)} % der Bilder, ${M.pairs.size} verschiedene Paare`);
  console.log(`  Fußgänger berührt: ${M.pedHits} Bild-Treffer, ${M.pedHitSet.size} Fälle (Querungen ${peds.crossed}, Warte-Bilder ${peds.waits})`);
  console.log(`  Drehsprünge > 25°/Bild: ${M.snaps} (größte Drehung ${M.maxTurn.toFixed(1)}° je Bild), Lagesprünge > 0,3: ${M.jumps}`);
  console.log(`  Räder neben der Fahrbahn: ${Object.entries(M.off).map(([k, v]) => `${k} ${pct(v[0], v[1])} %`).join(', ')}`);
  console.log(`  Karosserie mehr als 0,08 über dem Rand: ${Object.entries(M.off).map(([k, v]) => `${k} ${pct(v[2], v[1])} %`).join(', ')}`);
  if (DEBUG) { for (const [k, a] of Object.entries(samples)) { console.log(`  · ${k}:`); for (const t of a) console.log('      ' + t); } for (const k of Object.keys(samples)) delete samples[k]; }
  return M;
}

// ---------------------------------------------------------------- Szenen
const gA = Game.fromSave(readFileSync(join(ROOT, 'saves/megastadt.json'), 'utf8'));
const MA = measure('A: Megastadt', gA, SECS);

const gB = new Game({ size: 96, seed: 77, mapType: 'river', difficulty: 'sandbox', name: 'Fahrstadt' });
gB.sandboxNoEvents = true;
gB.on('cards', (ids) => gB.chooseCard(ids[0]));
buildDemoCity(gB);
for (let k = 0; k < 6 * 300; k++) gB.update(0.1);
{
  const s = gB, W = s.W, sy = s.world.highwayY, x0 = s.world.highwayEnd % W + 1;
  const place = (key, x, y) => { for (let d = 0; d < 22; d++) for (const [ox, oy] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, -d]]) { const r = s.placeBuilding(key, x + ox, y + oy, 0); if (r.ok) return r; } return { ok: false }; };
  const st = (x, y, mode = 'bus') => { for (let d = 0; d < 5; d++) for (const [ox, oy] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]]) { const xx = x + ox, yy = y + oy; if (xx >= 0 && yy >= 0 && xx < W && yy < s.H && !TPS.canStop(s, yy * W + xx, mode)) return yy * W + xx; } return -1; };
  place('bus_depot', x0 + 6, sy + 13); place('tram_depot', x0 + 22, sy - 14); place('taxi_depot', x0 + 12, sy + 2);
  const L1 = TPS.createLine(s, 'bus', [st(x0 + 5, sy - 6), st(x0 + 15, sy - 6), st(x0 + 30, sy - 6)].filter((t) => t >= 0));
  const L2 = TPS.createLine(s, 'bus', [st(x0 + 8, sy - 11), st(x0 + 8, sy + 3), st(x0 + 23, sy + 11)].filter((t) => t >= 0));
  const L3 = TPS.createLine(s, 'bus', [st(x0 + 5, sy - 11), st(x0 + 15, sy - 11), st(x0 + 18, sy - 2), st(x0 + 5, sy - 4)].filter((t) => t >= 0), true);
  const T1 = TPS.createLine(s, 'tram', [st(x0 + 2, sy, 'tram'), st(x0 + 18, sy, 'tram'), st(x0 + 32, sy, 'tram')].filter((t) => t >= 0));
  const T2 = TPS.createLine(s, 'tram', [st(x0 + 5, sy - 11, 'tram'), st(x0 + 18, sy - 6, 'tram'), st(x0 + 28, sy + 6, 'tram')].filter((t) => t >= 0));
  if (L1.ok) TPS.setVehicles(s, L1.line.id, 3);
  if (L2.ok) { TPS.setVehicles(s, L2.line.id, 2); TPS.setVehicleType(s, L2.line.id, 'gelenk'); }
  if (T1.ok) { TPS.setVehicles(s, T1.line.id, 2); TPS.setVehicleType(s, T1.line.id, 'tram_long'); }
  if (T2.ok) TPS.setVehicles(s, T2.line.id, 3);
  console.log(`\n  Sandkasten: Linien ${[L1, L2, L3, T1, T2].map((l) => (l.ok ? 'ok' : l.msg)).join(', ')}`);
}
const MB = measure('B: Sandkasten mit Allee, Ampeln, Bus- und Straßenbahnlinien', gB, SECS);

// ---------------------------------------------------------------- Bewertung
console.log('\n=== Bewertung ===');
if (!process.env.FT_ROOT) {
  for (const [n, M] of [['A', MA], ['B', MB]]) {
    ok(M.overlapPairs / Math.max(1, M.bodyFrames) < 0.002, `${n}: Fahrzeuge fahren nicht ineinander (${M.overlapPairs} Paar-Bilder bei ${M.bodyFrames} Körper-Bildern)`);
    ok(M.pedHitSet.size <= 2, `${n}: keine Fahrzeuge durch Fußgänger auf Zebrastreifen (${M.pedHitSet.size} Fälle)`);
    ok(M.snaps === 0 && M.jumps <= 2, `${n}: kein Drehen auf der Stelle, keine Sprünge (${M.snaps} Drehsprünge, größte Drehung ${M.maxTurn.toFixed(1)}°/Bild, ${M.jumps} Lagesprünge)`);
    const o = M.off;
    const rate = (k) => o[k][0] / Math.max(1, o[k][1]);
    ok(rate('tram') < 0.01 && rate('trailer') < 0.01 && rate('bus') < 0.01 && rate('truck') < 0.01, `${n}: lange Fahrzeuge mit den Rädern auf der Fahrbahn (Tram ${(rate('tram') * 100).toFixed(2)} %, Auflieger ${(rate('trailer') * 100).toFixed(2)} %, Bus ${(rate('bus') * 100).toFixed(2)} %, Lkw ${(rate('truck') * 100).toFixed(2)} %)`);
    ok(M.speed / Math.max(1, M.nSpeed) < 1.1, `${n}: gemächliches Tempo (im Mittel ${(M.speed / Math.max(1, M.nSpeed)).toFixed(2)} Felder/s)`);
  }
  ok(gA.errors.length === 0 && gB.errors.length === 0, `keine Simulationsfehler (${[...gA.errors, ...gB.errors].map((e) => e.where + ': ' + e.msg).slice(0, 3).join('; ')})`);
}
console.log(`\n${fails ? `${checks - fails}/${checks} Prüfungen bestanden – ${fails} FEHLER` : `${checks}/${checks} Prüfungen bestanden`} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(fails ? 1 : 0);
