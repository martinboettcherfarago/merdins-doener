// Verkehr: Fahrzeug-Agenten auf dem Straßenraster, Fahrtenerzeugung nach Tageszeit, Staus.
import { ROADS, R, Z, minPerSec } from '../config.js';
import { findPath } from './network.js';
import { WeightedList } from '../util.js';
import { makeRng } from './rng.js';

export const VT = { CAR: 0, TRUCK: 1, VAN: 2, FIRE: 3, POLICE: 4, GARBAGE: 5 };

const gauss = (h, m, s) => Math.exp(-0.5 * ((h - m) / s) ** 2);
export function rushFactor(h) {
  return 0.25 + 1.1 * gauss(h, 8, 1.3) + 0.9 * gauss(h, 17.5, 1.6) + 0.55 * gauss(h, 13, 2.5);
}

export class Traffic {
  constructor(g) {
    this.g = g;
    this.cars = [];
    this.hourCount = new Float32Array(g.N);
    this.spawnAcc = 0;
    this.lists = { res: new WeightedList(), job: new WeightedList(), com: new WeightedList(), ind: new WeightedList(), any: new WeightedList() };
    this.maxCars = 900;
    this.nextId = 1;
    this.tripsHour = 0;
    this.flow = 1;
    // Anteil des pauschalen Lieferverkehrs; Systeme mit eigenem Güterverkehr setzen 0
    this.freightShare = 0.28;
    // Eigener, reproduzierbarer Zufall (stört die Zufallsfolge der Stadt nicht)
    this.rng = makeRng(((g.opts && g.opts.seed) || 1) * 2654435761 ^ 0x7f4a7c15);
  }

  rebuildLists() {
    const g = this.g;
    const bs = [];
    for (const b of g.buildings.values()) {
      if (!b.zone || b.abandoned || b.construct < 1 || !b.connected || b.access < 0) continue;
      bs.push(b);
      b.transitShare = g.cov.transit[b.y * g.W + b.x] * 0.35;
    }
    this.lists.res.build(bs, (b) => (b.zone === Z.RES ? b.occ * (1 - b.transitShare) : 0));
    this.lists.job.build(bs, (b) => (b.zone !== Z.RES ? b.occ * (1 - b.transitShare) : 0));
    this.lists.com.build(bs, (b) => (b.zone === Z.COM ? b.cap : 0));
    this.lists.ind.build(bs, (b) => (b.zone === Z.IND ? b.occ + 1 : 0));
    this.lists.any.build(bs, () => 1);
  }

  update(simSec) {
    const g = this.g;
    if (simSec <= 0) return;
    const h = g.hour();
    const rush = rushFactor(h);
    const pop = g.stats.pop;
    const carMul = g.policies.has('bikes') ? 0.85 : 1;
    const rate = pop > 0 ? Math.min(32, (0.6 + Math.sqrt(pop) * 0.17 * rush) * carMul) : 0;
    // Echte Fahrten pro Spielstunde, die ein Auto repräsentiert
    const tripsPerHour = (pop * 1.5 / 24) * rush * carMul * (1 - g.stats.transitShare);
    // Autos je Spielstunde = Rate je Sekunde × Sekunden je Spielstunde (hängt von der Tageslänge ab)
    this.weight = rate > 0 ? tripsPerHour / (rate * 60 / minPerSec(g)) : 1;
    this.spawnAcc += rate * simSec;
    let guard = 0;
    while (this.spawnAcc >= 1 && guard++ < 6) {
      this.spawnAcc -= 1;
      if (this.cars.length < this.maxCars) this.spawnTrip(h);
    }
    if (this.spawnAcc > 3) this.spawnAcc = 3;
    // Dienstfahrzeuge
    if (this.rng() < simSec * 0.25 * Math.min(4, g.buildings.size / 60)) this.spawnService();

    // Tempo: Verordnung Tempo 30 und Effekt 'roadSpeed' (Schnee, Glätte, Hochwasser …)
    const slowGlobal = (g.policies.has('tempo30') ? 0.78 : 1) * Math.max(0.15, 1 + g.eff('roadSpeed'));
    const cars = this.cars;
    let w = 0;
    for (let k = 0; k < cars.length; k++) {
      const c = cars[k];
      if (this.advance(c, simSec, slowGlobal)) cars[w++] = c;
      else this.arrive(c);
    }
    cars.length = w;
  }

  spawnTrip(h) {
    const g = this.g;
    const rng = this.rng;
    const L = this.lists;
    const night = h < 5 || h > 22.5 ? 0.35 : 1;
    const wWork = gauss(h, 7.8, 1.5) * 1.2 * night;
    const wHome = gauss(h, 17.5, 1.8) * night;
    const wShop = (0.3 + gauss(h, 13, 3) * 0.6) * night;
    const fs = Number.isFinite(this.freightShare) ? Math.max(0, this.freightShare) : 0.28;
    const wFreight = L.ind.total > 0 ? fs : 0;
    const total = wWork + wHome + wShop + wFreight;
    let r = rng() * total;
    let o = null, d = null, type = VT.CAR, from = -1, to = -1, kind = '';
    const entry = g.world.highwayEnd;
    if ((r -= wWork) < 0) { o = L.res.sample(rng); d = L.job.sample(rng); kind = 'work'; }
    else if ((r -= wHome) < 0) { o = L.job.sample(rng); d = L.res.sample(rng); kind = 'home'; }
    else if ((r -= wShop) < 0) { o = L.res.sample(rng); d = L.com.sample(rng); kind = 'shop'; }
    else {
      type = VT.TRUCK; kind = 'freight';
      const q = rng();
      if (q < 0.45) { o = L.ind.sample(rng); d = L.com.sample(rng) || null; }
      else if (q < 0.75) { o = L.ind.sample(rng); to = entry; }
      else { from = entry; d = (rng() < 0.6 ? L.com.sample(rng) : L.ind.sample(rng)); }
    }
    if (o) from = o.access;
    if (d) to = d.access;
    if (from < 0 || to < 0 || from === to) return;
    const res = findPath(g, from, to);
    if (!res) {
      if (o && o.zone === Z.RES) o.noRoute = (o.noRoute || 0) + 1;
      return;
    }
    const minutes = 4 + res.cost * 0.6;
    if (kind === 'work' && o) o.commute = o.commute * 0.75 + minutes * 0.25;
    if (kind === 'home' && d) d.commute = d.commute * 0.75 + minutes * 0.25;
    this.addCar(type, res.path, null);
  }

  spawnService() {
    const g = this.g;
    const b = this.lists.any.sample(this.rng);
    if (!b) return;
    const i = b.y * g.W + b.x;
    const isG = this.rng() < 0.6;
    const facId = isG ? g.nearestFac.garbage[i] : g.nearestFac.police[i];
    const fac = g.buildings.get(facId);
    if (!fac || fac.access < 0 || fac.access === b.access) return;
    const res = findPath(g, fac.access, b.access);
    if (!res) return;
    this.addCar(isG ? VT.GARBAGE : VT.POLICE, res.path, null);
  }

  spawnMoveIn(b) {
    const g = this.g;
    if (this.cars.length >= this.maxCars || b.access < 0) return;
    const res = findPath(g, g.world.highwayEnd, b.access);
    if (res) this.addCar(VT.VAN, res.path, null);
  }

  dispatchFire(b) {
    const g = this.g;
    const fac = g.buildings.get(g.nearestFac.fire[b.y * g.W + b.x]);
    if (!fac || fac.access < 0 || b.access < 0) return false;
    const res = fac.access === b.access ? { path: new Int32Array([fac.access]) } : findPath(g, fac.access, b.access);
    if (!res) return false;
    if (res.path.length < 2) { g.extinguish(b); return true; }
    this.addCar(VT.FIRE, res.path, b.id, true);
    return true;
  }

  addCar(type, path, target, force = false) {
    if (path.length < 2) return;
    if (!force && this.cars.length >= this.maxCars) return;
    const c = {
      id: this.nextId++, type, path, piece: 0, s: 0, target,
      color: Math.floor(this.rng() * 1000),
      weight: type >= VT.FIRE ? 0.5 : this.weight || 1,
      x: 0, z: 0, yaw: 0,
      speedVar: 0.85 + this.rng() * 0.3,
    };
    this.hourCount[path[0]] += c.weight;
    this.pose(c);
    this.cars.push(c);
  }

  pieceLen(c, k) {
    const p = c.path, n = p.length - 1;
    if (k === 0 || k === n) return 0.5;
    const W = this.g.W;
    const a = p[k - 1], b = p[k], d = p[k + 1];
    const straight = (b - a) === (d - b);
    void W;
    return straight ? 1 : 0.785;
  }

  advance(c, simSec, slowGlobal) {
    const g = this.g;
    const tile = c.path[c.piece];
    const road = g.road[tile];
    const def = ROADS[road];
    if (!def) return false; // Straße wurde abgerissen
    const cong = g.congestion[tile];
    const slow = (cong > 0.75 ? 1 / (1 + (cong - 0.75) * 3) : 1) / (1 + (g.tileDelay ? g.tileDelay[tile] : 0));
    let v = 1.7 * def.speed * slow * slowGlobal * c.speedVar; // etwas gemächlicher (Spielerwunsch); vorher 2,1
    if (c.type === VT.FIRE) v *= 1.35;
    if (c.type === VT.TRUCK || c.type === VT.GARBAGE) v *= 0.85;
    c.s += v * simSec;
    let len = this.pieceLen(c, c.piece);
    while (c.s >= len) {
      c.s -= len;
      c.piece++;
      if (c.piece >= c.path.length) return false;
      const t = c.path[c.piece];
      if (!g.road[t]) return false;
      this.hourCount[t] += c.weight;
      len = this.pieceLen(c, c.piece);
    }
    this.pose(c, len);
    return true;
  }

  pose(c, len) {
    const g = this.g;
    const W = g.W, ox = -g.W / 2 + 0.5, oz = -g.H / 2 + 0.5;
    const p = c.path, n = p.length - 1, k = c.piece;
    if (len === undefined) len = this.pieceLen(c, k);
    const t = Math.min(1, c.s / len);
    const cx = (i) => (p[i] % W);
    const cy = (i) => ((p[i] / W) | 0);
    let x, y, tx, ty;
    if (k === 0) {
      const ax = cx(0), ay = cy(0), bx = (cx(0) + cx(1)) / 2, by = (cy(0) + cy(1)) / 2;
      x = ax + (bx - ax) * t; y = ay + (by - ay) * t; tx = bx - ax; ty = by - ay;
    } else if (k === n) {
      const ax = (cx(n - 1) + cx(n)) / 2, ay = (cy(n - 1) + cy(n)) / 2, bx = cx(n), by = cy(n);
      x = ax + (bx - ax) * t; y = ay + (by - ay) * t; tx = bx - ax; ty = by - ay;
    } else {
      const Ax = (cx(k - 1) + cx(k)) / 2, Ay = (cy(k - 1) + cy(k)) / 2;
      const Bx = cx(k), By = cy(k);
      const Cx = (cx(k) + cx(k + 1)) / 2, Cy = (cy(k) + cy(k + 1)) / 2;
      const u = 1 - t;
      x = u * u * Ax + 2 * u * t * Bx + t * t * Cx;
      y = u * u * Ay + 2 * u * t * By + t * t * Cy;
      tx = 2 * u * (Bx - Ax) + 2 * t * (Cx - Bx);
      ty = 2 * u * (By - Ay) + 2 * t * (Cy - By);
    }
    const l = Math.hypot(tx, ty) || 1;
    tx /= l; ty /= l;
    const road = g.road[p[k]];
    const off = road === R.HIGHWAY ? 0.26 : road === R.AVENUE ? 0.24 : road === R.LANE ? 0.12 : 0.16;
    c.x = x + ox - ty * off;
    c.z = y + oz + tx * off;
    c.yaw = Math.atan2(tx, ty);
  }

  arrive(c) {
    if (c.type === VT.FIRE && c.target) {
      const b = this.g.buildings.get(c.target);
      if (b && b.burning) this.g.extinguish(b);
    }
  }

  hourly() {
    const g = this.g;
    const load = g.trafficLoad, cong = g.congestion, road = g.road, delay = g.tileDelay;
    let sumW = 0, sumFlow = 0;
    for (let i = 0; i < g.N; i++) {
      if (!road[i]) { load[i] = 0; cong[i] = 0; this.hourCount[i] = 0; continue; }
      load[i] = load[i] * 0.55 + this.hourCount[i] * 0.45;
      this.hourCount[i] = 0;
      const c = load[i] / ROADS[road[i]].capacity;
      cong[i] = c;
      if (load[i] > 0) {
        const slow = (c > 0.75 ? 1 / (1 + (c - 0.75) * 3) : 1) / (1 + (delay ? delay[i] : 0));
        sumW += load[i];
        sumFlow += load[i] * slow;
      }
    }
    this.flow = sumW > 0 ? sumFlow / sumW : 1;
    g.stats.trafficFlow = this.flow;
    this.rebuildLists();
  }

  clearOnRoad(tiles) {
    // Fahrzeuge auf abgerissenen Straßen entfernen
    const set = new Set(tiles);
    this.cars = this.cars.filter((c) => {
      for (let k = c.piece; k < c.path.length; k++) if (set.has(c.path[k])) return false;
      return true;
    });
  }
}
