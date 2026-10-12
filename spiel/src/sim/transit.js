// Pulsbahn: Hochbahn-Stationen, Linien (oktilinear wie auf einem Netzplan), Züge, Fahrgäste.
// Fahrgäste haben eine Form je Ziel: ● Wohnen, ▲ Gewerbe, ■ Industrie, ◆ Büro.
import { TRANSIT, BUILDINGS, T } from '../config.js';
import { stationName } from '../util.js';
import { forDisc } from './services.js';

export const LINE_COLORS = [0xe8543f, 0x2f8fe0, 0xf2b01e, 0x22a866, 0x8f5ad8, 0xf06fae, 0x10a9a3, 0x8a6a55, 0xff8a1f, 0x4656c9];
export const LINE_COLOR_NAMES = ['Rot', 'Blau', 'Gelb', 'Grün', 'Violett', 'Rosa', 'Türkis', 'Braun', 'Orange', 'Indigo'];

const gauss = (h, m, s) => Math.exp(-0.5 * ((h - m) / s) ** 2);

export class Transit {
  constructor(g) {
    this.g = g;
    this.stations = new Map();
    this.lines = [];
    this.trains = [];
    this.linesMax = 2;
    this.freeTrains = 0;
    this.freeWagons = 0;
    this.nextStation = 1;
    this.nextLine = 1;
    this.nextTrain = 1;
    this.usedNames = new Set();
    this.dist = new Map();
    this.faresToday = 0;
    this.deliveredToday = 0;
    this.deliveredTotal = 0;
    this.version = 0;
    this.arrivals = []; // für Klänge und Effekte: {line, station}
  }

  totalWagons() { let n = 0; for (const t of this.trains) n += t.wagons; return n; }

  canPlaceStation(x, y) {
    const g = this.g;
    if (x < 0 || y < 0 || x >= g.W || y >= g.H) return 'Außerhalb der Karte';
    const i = y * g.W + x;
    const ter = g.world.terrain[i];
    if (ter === T.WATER || ter === T.ROCK) return 'Nicht auf Wasser oder Fels';
    if (g.bld[i]) return 'Feld ist bebaut';
    if (g.stationAt[i]) return 'Hier steht schon eine Station';
    if (g.road[i] === 4) return 'Nicht auf der Autobahn';
    return null;
  }

  addStation(x, y) {
    const g = this.g;
    const i = y * g.W + x;
    const id = this.nextStation++;
    const st = { id, x, y, name: stationName(g.rng, this.usedNames), waiting: [], over: 0, penaltyUntil: 0, w: [0, 0, 0, 0, 0], served: 0 };
    this.stations.set(id, st);
    g.stationAt[i] = id;
    this.updateCatchment(st);
    this.changed();
    return st;
  }

  removeStation(id) {
    const g = this.g;
    const st = this.stations.get(id);
    if (!st) return;
    g.stationAt[st.y * g.W + st.x] = 0;
    this.stations.delete(id);
    this.usedNames.delete(st.name);
    for (const line of [...this.lines]) {
      if (!line.stops.includes(id)) continue;
      line.stops = line.stops.filter((s) => s !== id);
      // doppelte Nachbarn entfernen
      line.stops = line.stops.filter((s, k, a) => k === 0 || a[k - 1] !== s);
      if (line.loop && line.stops.length < 3) line.loop = false;
      if (line.stops.length < 2) this.removeLine(line.id, true);
      else this.rebuildLine(line);
    }
    this.changed();
  }

  lineCost(stops, loop) {
    let len = 0;
    for (let k = 0; k < stops.length - 1; k++) len += this.segLen(stops[k], stops[k + 1]);
    if (loop) len += this.segLen(stops[stops.length - 1], stops[0]);
    return len * TRANSIT.trackCostPerTile;
  }

  segLen(a, b) {
    const A = this.stations.get(a), B = this.stations.get(b);
    const dx = Math.abs(B.x - A.x), dy = Math.abs(B.y - A.y);
    const d = Math.min(dx, dy);
    return d * Math.SQRT2 + Math.max(dx, dy) - d;
  }

  createLine(stops, loop) {
    const usedColors = new Set(this.lines.map((l) => l.color));
    let color = 0;
    while (usedColors.has(color) && color < LINE_COLORS.length - 1) color++;
    const line = { id: this.nextLine++, color, stops: [...stops], loop: !!loop, ridersToday: 0, riders: 0, pts: [], cum: [], stopD: [], length: 0 };
    this.lines.push(line);
    this.rebuildLine(line);
    this.addTrainToLine(line, true);
    this.changed();
    return line;
  }

  extendLine(line, stationId, atStart) {
    if (atStart) line.stops.unshift(stationId); else line.stops.push(stationId);
    this.rebuildLine(line);
    this.changed();
  }

  removeLine(id, keepStations) {
    const line = this.lines.find((l) => l.id === id);
    if (!line) return;
    for (const t of this.trains.filter((t) => t.line === id)) {
      this.freeTrains++;
      this.freeWagons += t.wagons;
    }
    this.trains = this.trains.filter((t) => t.line !== id);
    this.lines = this.lines.filter((l) => l.id !== id);
    void keepStations;
    this.recomputeTracks();
    this.recomputeRouting();
    this.changed();
  }

  addTrainToLine(line, initial) {
    const n = this.trains.filter((t) => t.line === line.id).length;
    const t = { id: this.nextTrain++, line: line.id, d: 0, dir: 1, cur: 0, to: 0, targetD: 0, state: 'dwell', dwell: 0.6, pax: [], wagons: 0, x: 0, y: 0, z: 0, yaw: 0 };
    // Züge gleichmäßig verteilen
    if (n > 0 && line.stops.length > 1) {
      t.cur = Math.floor((n * line.stops.length) / (n + 1)) % line.stops.length;
      t.dir = n % 2 === 0 ? 1 : -1;
      if (!line.loop && t.cur === line.stops.length - 1) t.dir = -1;
      if (!line.loop && t.cur === 0) t.dir = 1;
    }
    t.d = line.stopD[t.cur] || 0;
    this.trains.push(t);
    poseTrain(this, t);
    void initial;
    this.changed();
    return t;
  }

  removeTrainFromLine(line) {
    const ts = this.trains.filter((t) => t.line === line.id);
    if (ts.length <= 1) return false;
    const t = ts[ts.length - 1];
    this.freeTrains++;
    this.freeWagons += t.wagons;
    this.trains = this.trains.filter((x) => x !== t);
    this.changed();
    return true;
  }

  addWagonToLine(line) {
    const ts = this.trains.filter((t) => t.line === line.id && t.wagons < 3);
    if (!ts.length) return false;
    ts.sort((a, b) => a.wagons - b.wagons);
    ts[0].wagons++;
    this.changed();
    return true;
  }

  trainCapacity(t) { return TRANSIT.baseCapacity + t.wagons * TRANSIT.wagonCapacity; }

  rebuildLine(line) {
    const pts = [];
    const stopD = [];
    const pair = [];
    const S = (id) => this.stations.get(id);
    const n = line.stops.length;
    const segs = line.loop ? n : n - 1;
    let cum = [0];
    const push = (x, y, pk) => {
      if (pts.length) {
        const [px, py] = pts[pts.length - 1];
        if (Math.abs(px - x) < 1e-6 && Math.abs(py - y) < 1e-6) return;
        cum.push(cum[cum.length - 1] + Math.hypot(x - px, y - py));
      }
      pts.push([x, y]);
      pair.push(pk);
    };
    for (let k = 0; k < segs; k++) {
      const A = S(line.stops[k]), B = S(line.stops[(k + 1) % n]);
      const ax = A.x + 0.5, ay = A.y + 0.5, bx = B.x + 0.5, by = B.y + 0.5;
      if (k === 0) { push(ax, ay, k); stopD.push(0); }
      const dx = bx - ax, dy = by - ay;
      const d = Math.min(Math.abs(dx), Math.abs(dy));
      // Diagonale zuerst, wenn der Abschnitt überwiegend diagonal ist; sonst gerade zuerst
      if (d > 0 && d !== Math.abs(dx) || d > 0 && d !== Math.abs(dy)) {
        let mx, my;
        if (k % 2 === 0) { mx = ax + Math.sign(dx) * d; my = ay + Math.sign(dy) * d; }
        else { mx = bx - Math.sign(dx) * d; my = by - Math.sign(dy) * d; }
        push(mx, my, k);
      }
      push(bx, by, k);
      if (!(line.loop && k === segs - 1)) stopD.push(cum[cum.length - 1]);
    }
    line.pts = pts;
    line.cum = cum;
    line.pair = pair;
    line.stopD = stopD;
    line.length = cum[cum.length - 1];
    // Züge auf gültige Positionen setzen
    for (const t of this.trains) {
      if (t.line !== line.id) continue;
      t.cur = Math.min(t.cur, n - 1);
      t.d = stopD[t.cur];
      t.state = 'dwell';
      t.dwell = 0.5;
      if (!line.loop) {
        if (t.cur === 0) t.dir = 1;
        if (t.cur === n - 1) t.dir = -1;
      }
      poseTrain(this, t);
    }
    this.recomputeTracks();
    this.recomputeRouting();
  }

  recomputeTracks() {
    const g = this.g;
    g.trackCount.fill(0);
    const seen = new Set();
    for (const line of this.lines) {
      const tiles = new Set();
      if (!line.pts) continue;
      for (let k = 0; k < line.pts.length - 1; k++) {
        const [ax, ay] = line.pts[k], [bx, by] = line.pts[k + 1];
        const len = Math.hypot(bx - ax, by - ay);
        const steps = Math.ceil(len / 0.25);
        for (let s = 0; s <= steps; s++) {
          const x = Math.floor(ax + ((bx - ax) * s) / steps), y = Math.floor(ay + ((by - ay) * s) / steps);
          if (x >= 0 && y >= 0 && x < g.W && y < g.H) tiles.add(y * g.W + x);
        }
      }
      for (const t of tiles) { g.trackCount[t]++; seen.add(t); }
    }
    // Parallele Linien versetzen
    const shared = new Map();
    for (const line of this.lines) {
      const n = line.stops.length;
      const segs = line.loop ? n : n - 1;
      line.segOffset = [];
      for (let k = 0; k < segs; k++) {
        const a = line.stops[k], b = line.stops[(k + 1) % n];
        const key = a < b ? a + '-' + b : b + '-' + a;
        if (!shared.has(key)) shared.set(key, []);
        shared.get(key).push([line, k]);
      }
    }
    for (const list of shared.values()) {
      const c = list.length;
      list.forEach(([line, k], j) => { line.segOffset[k] = (j - (c - 1) / 2) * 0.3; });
    }
  }

  recomputeRouting() {
    const adj = new Map();
    for (const id of this.stations.keys()) adj.set(id, new Set());
    for (const line of this.lines) {
      const n = line.stops.length;
      for (let k = 0; k < n - 1; k++) { adj.get(line.stops[k])?.add(line.stops[k + 1]); adj.get(line.stops[k + 1])?.add(line.stops[k]); }
      if (line.loop && n > 2) { adj.get(line.stops[n - 1])?.add(line.stops[0]); adj.get(line.stops[0])?.add(line.stops[n - 1]); }
    }
    this.dist = new Map();
    for (const dest of this.stations.keys()) {
      const m = new Map([[dest, 0]]);
      const q = [dest];
      for (let h = 0; h < q.length; h++) {
        const s = q[h];
        for (const nb of adj.get(s) || []) if (!m.has(nb)) { m.set(nb, m.get(s) + 1); q.push(nb); }
      }
      this.dist.set(dest, m);
    }
    this.stationLines = new Map();
    for (const line of this.lines) for (const s of line.stops) {
      if (!this.stationLines.has(s)) this.stationLines.set(s, new Set());
      this.stationLines.get(s).add(line.id);
    }
  }

  hops(dest, s) {
    const m = this.dist.get(dest);
    if (!m) return Infinity;
    const v = m.get(s);
    return v === undefined ? Infinity : v;
  }

  updateCatchment(st) {
    const g = this.g;
    const w = [0, 0, 0, 0, 0];
    forDisc(g, st.x + 0.5, st.y + 0.5, TRANSIT.catchment, (t) => {
      const b = g.buildings.get(g.bld[t]);
      if (b && b.zone && !b.abandoned) w[b.zone] += b.occ;
    });
    st.w = w;
    let best = 1, bv = -1;
    for (let z = 1; z <= 4; z++) if (w[z] > bv) { bv = w[z]; best = z; }
    st.shape = bv > 0 ? best : 0;
  }

  hourly() {
    for (const st of this.stations.values()) this.updateCatchment(st);
  }

  // Abdeckungsfeld für Bodenwert, Glück und weniger Autos.
  applyCoverage() {
    const g = this.g;
    const cov = g.cov.transit;
    cov.fill(0);
    g.transitPenalty.fill(0);
    const servedLines = new Set(this.trains.map((t) => t.line));
    for (const st of this.stations.values()) {
      const ls = this.stationLines?.get(st.id);
      let ok = false;
      if (ls) for (const l of ls) if (servedLines.has(l)) ok = true;
      st.active = ok;
      if (!ok) continue;
      const r = TRANSIT.catchment;
      const pen = st.penaltyUntil > g.time;
      forDisc(g, st.x + 0.5, st.y + 0.5, r, (t, d) => {
        const v = 1 - 0.35 * (d / r);
        if (v > cov[t]) cov[t] = v;
        if (pen) g.transitPenalty[t] = 1;
      });
    }
    let share = 0, tot = 0;
    for (const b of g.buildings.values()) {
      if (b.zone !== 1 || b.abandoned) continue;
      share += cov[b.y * g.W + b.x] * 0.35 * b.occ;
      tot += b.occ;
    }
    g.stats.transitShare = tot > 0 ? share / tot : 0;
  }

  spawnPassengers(minutes) {
    const g = this.g;
    if (!this.lines.length) return;
    const h = g.hour();
    const night = h < 5 || h > 23 ? 0.25 : 1;
    const workF = gauss(h, 7.8, 1.6) * 1.3 + 0.12;
    const homeF = gauss(h, 17.3, 1.8) * 1.2 + 0.1;
    const shopF = 0.22 + gauss(h, 13, 3) * 0.5;
    const ridership = (g.policies.has('freetransit') ? 1.4 : 1) * (1 + g.eff('ridership'));
    const k = (minutes / 60) * night * ridership * 0.55;
    for (const st of this.stations.values()) {
      if (!st.active) continue;
      const w = st.w;
      const rWork = w[1] * 0.01 * workF * k;
      const rShop = w[1] * 0.005 * shopF * k;
      const rHome = (w[2] + w[3] + w[4]) * 0.01 * homeF * k;
      st.acc = (st.acc || 0) + rWork + rShop + rHome;
      let guard = 0;
      while (st.acc >= 1 && guard++ < 6) {
        st.acc -= 1;
        const r = g.rng() * (rWork + rShop + rHome);
        let types;
        if (r < rWork) types = [3, 4];
        else if (r < rWork + rShop) types = [2];
        else types = [1];
        // Ziel wählen
        let total = 0;
        const cands = [];
        for (const t of this.stations.values()) {
          if (t === st || !t.active) continue;
          if (this.hops(t.id, st.id) === Infinity) continue;
          for (const z of types) {
            const v = t.w[z];
            if (v > 0) { cands.push([t, z, v]); total += v; }
          }
        }
        if (total <= 0) continue;
        let q = g.rng() * total;
        let pick = cands[cands.length - 1];
        for (const c of cands) { q -= c[2]; if (q <= 0) { pick = c; break; } }
        st.waiting.push({ dest: pick[0].id, shape: pick[1], t: g.time });
      }
      if (st.acc > 4) st.acc = 4;
      // Überfüllung
      if (st.waiting.length > TRANSIT.stationCapacity) {
        st.over += minutes / (TRANSIT.overcrowdDays * 1440);
        if (st.over >= 1) {
          st.over = 0;
          st.penaltyUntil = g.time + 2 * 1440;
          const lost = Math.ceil(st.waiting.length / 2);
          st.waiting.splice(0, lost);
          g.news('transit', `Station ${st.name} ist hoffnungslos überfüllt! ${lost} Fahrgäste geben auf. Mehr Züge oder Waggons einsetzen.`, 'bad', { x: st.x, y: st.y });
          this.changed();
        }
      } else st.over = Math.max(0, st.over - minutes / 720);
      // Fahrgäste ohne erreichbares Ziel verlassen die Station
      if (st.waiting.length) st.waiting = st.waiting.filter((p) => this.hops(p.dest, st.id) !== Infinity && g.time - p.t < 1440 * 1.5);
    }
  }

  update(simSec) {
    if (simSec <= 0) return;
    const g = this.g;
    const speed = TRANSIT.speed * g.mods.trainSpeed;
    for (const t of this.trains) {
      const line = this.lines.find((l) => l.id === t.line);
      if (!line || line.stops.length < 2) continue;
      if (t.state === 'dwell') {
        t.dwell -= simSec;
        if (t.dwell <= 0) this.depart(t, line);
      } else {
        let step = speed * simSec;
        // sanftes Bremsen vor der Station
        const left = Math.abs(t.targetD - t.d);
        if (left < 0.8) step *= 0.45 + 0.55 * (left / 0.8);
        if (step >= left) { t.d = t.targetD; this.arrive(t, line); }
        else t.d += t.dir * step;
      }
      poseTrain(this, t);
    }
  }

  nextStop(line, cur, dir) {
    const n = line.stops.length;
    if (line.loop) return { next: (cur + dir + n) % n, dir };
    let nx = cur + dir;
    if (nx < 0 || nx >= n) { dir = -dir; nx = cur + dir; }
    return { next: nx, dir };
  }

  depart(t, line) {
    const { next, dir } = this.nextStop(line, t.cur, t.dir);
    t.dir = dir;
    t.to = next;
    const n = line.stops.length;
    if (line.loop) {
      if (dir > 0) t.targetD = next === 0 ? line.length : line.stopD[next];
      else {
        if (t.cur === 0) t.d = line.length;
        t.targetD = line.stopD[next];
      }
    } else t.targetD = line.stopD[next];
    void n;
    t.state = 'move';
  }

  arrive(t, line) {
    const g = this.g;
    t.cur = t.to;
    if (line.loop && t.d >= line.length - 1e-6) t.d = 0;
    t.state = 'dwell';
    const sid = line.stops[t.cur];
    const st = this.stations.get(sid);
    const { next } = this.nextStop(line, t.cur, t.dir);
    const nextSid = line.stops[next];
    let moved = 0;
    const keep = [];
    for (const p of t.pax) {
      if (p.dest === sid) {
        moved++;
        this.deliveredToday++;
        this.deliveredTotal++;
        this.faresToday += TRANSIT.fare;
        line.ridersToday++;
        if (st) st.served++;
      } else if (this.hops(p.dest, nextSid) < this.hops(p.dest, sid)) keep.push(p);
      else { moved++; if (st) st.waiting.push(p); }
    }
    t.pax = keep;
    if (st) {
      const cap = this.trainCapacity(t);
      const stay = [];
      for (const p of st.waiting) {
        if (t.pax.length < cap && this.hops(p.dest, nextSid) < this.hops(p.dest, sid)) { t.pax.push(p); moved++; }
        else stay.push(p);
      }
      st.waiting = stay;
      if (this.arrivals.length < 40) this.arrivals.push({ line: line.color, station: sid, n: moved });
    }
    t.dwell = 0.45 + moved * 0.09;
    void g;
  }

  daily() {
    for (const l of this.lines) { l.riders = l.ridersToday; l.ridersToday = 0; }
    this.g.stats.ridersToday = this.deliveredToday;
    this.deliveredToday = 0;
  }

  changed() { this.version++; }

  serialize() {
    return {
      stations: [...this.stations.values()].map((s) => ({ id: s.id, x: s.x, y: s.y, name: s.name, waiting: s.waiting, over: s.over, penaltyUntil: s.penaltyUntil })),
      lines: this.lines.map((l) => ({ id: l.id, color: l.color, stops: l.stops, loop: l.loop })),
      trains: this.trains.map((t) => ({ id: t.id, line: t.line, cur: t.cur, dir: t.dir, wagons: t.wagons, pax: t.pax })),
      linesMax: this.linesMax, freeTrains: this.freeTrains, freeWagons: this.freeWagons,
      nextStation: this.nextStation, nextLine: this.nextLine, nextTrain: this.nextTrain, deliveredTotal: this.deliveredTotal,
    };
  }

  load(d) {
    const g = this.g;
    this.stations = new Map();
    this.usedNames = new Set();
    for (const s of d.stations) {
      this.stations.set(s.id, { ...s, w: [0, 0, 0, 0, 0], served: 0 });
      this.usedNames.add(s.name);
      g.stationAt[s.y * g.W + s.x] = s.id;
    }
    this.lines = d.lines.map((l) => ({ ...l, ridersToday: 0, riders: 0, pts: [], cum: [0], stopD: [], pair: [], length: 0 }));
    this.trains = [];
    Object.assign(this, { linesMax: d.linesMax, freeTrains: d.freeTrains, freeWagons: d.freeWagons, nextStation: d.nextStation, nextLine: d.nextLine, nextTrain: d.nextTrain, deliveredTotal: d.deliveredTotal || 0 });
    for (const l of this.lines) this.rebuildLine(l);
    for (const t of d.trains) {
      const line = this.lines.find((l) => l.id === t.line);
      if (!line) continue;
      const tr = { id: t.id, line: t.line, d: line.stopD[t.cur] || 0, dir: t.dir, cur: t.cur, to: t.cur, targetD: 0, state: 'dwell', dwell: 0.5, pax: t.pax || [], wagons: t.wagons, x: 0, y: 0, z: 0, yaw: 0 };
      this.trains.push(tr);
      poseTrain(this, tr);
    }
    for (const st of this.stations.values()) this.updateCatchment(st);
    this.recomputeRouting();
    this.changed();
  }
}

// Position auf der Linie (Distanz d) → Weltkoordinaten inkl. Parallelversatz.
export function linePose(tr, line, d, out) {
  const g = tr.g;
  const pts = line.pts, cum = line.cum;
  if (!pts.length) { out.x = 0; out.z = 0; out.yaw = 0; return out; }
  if (line.loop) { d = ((d % line.length) + line.length) % line.length; }
  else d = Math.max(0, Math.min(line.length, d));
  let lo = 0, hi = cum.length - 1;
  while (lo < hi - 1) { const m = (lo + hi) >> 1; if (cum[m] <= d) lo = m; else hi = m; }
  const k = Math.min(lo, pts.length - 2);
  const [ax, ay] = pts[k], [bx, by] = pts[k + 1];
  const segL = cum[k + 1] - cum[k] || 1;
  const t = (d - cum[k]) / segL;
  let dx = (bx - ax) / segL, dy = (by - ay) / segL;
  const off = (line.segOffset && line.segOffset[line.pair[k + 1]]) || 0;
  out.x = ax + (bx - ax) * t - dy * off - g.W / 2;
  out.z = ay + (by - ay) * t + dx * off - g.H / 2;
  out.yaw = Math.atan2(dx, dy);
  return out;
}

function poseTrain(tr, t) {
  const line = tr.lines.find((l) => l.id === t.line);
  if (!line) return;
  linePose(tr, line, t.d, t);
}
