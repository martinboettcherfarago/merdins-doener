// Verkehr: Fahrtenerzeugung nach Tageszeit, Staus – und die sichtbaren Fahrzeuge auf den Fahrstreifen.
//
// Zwei Ebenen (damit die Wirtschaft nicht vom Fahrstil der Darstellung abhängt):
//  - Fahrten (this.trips): die Rechnung wie bisher – Zählung der Befahrungen je Feld (Auslastung, Staus),
//    Höchstzahl gleichzeitiger Fahrten, Ankunft der Feuerwehr. Tempo, Zufallsfolge und Zählweise unverändert.
//  - Fahrzeuge (this.cars): was man sieht. Jede Fahrt bekommt (solange Platz ist) ein Fahrzeug auf derselben Route,
//    das nach roadnet.js fährt: auf dem eigenen Fahrstreifen, mit Abstand zum Vordermann, Ampeln, Vorfahrt,
//    Kreuzungsbelegung und Zebrastreifen, sanftem Anfahren und Bremsen vor Kurven. Systeme (Taxis, Rettungswagen,
//    Leichenwagen, Räumfahrzeuge, Busse, Straßenbahnen) setzen über addVisual eigene Fahrzeuge in denselben Fluss.
import { ROADS, R, Z, minPerSec } from '../config.js';
import { findPath } from './network.js';
import { WeightedList } from '../util.js';
import { makeRng } from './rng.js';
import { SYSTEMS } from '../registry.js';
import { Flow, Route, LC, VDIM, TRAILER, carModel, hashf, chordBack } from './roadnet.js';

export const VT = { CAR: 0, TRUCK: 1, VAN: 2, FIRE: 3, POLICE: 4, GARBAGE: 5 };

const gauss = (h, m, s) => Math.exp(-0.5 * ((h - m) / s) ** 2);
export function rushFactor(h) {
  return 0.25 + 1.1 * gauss(h, 8, 1.3) + 0.9 * gauss(h, 17.5, 1.6) + 0.55 * gauss(h, 13, 2.5);
}

// Fahrverhalten je Art: Anfahrbeschleunigung (Felder/s²), Tempofaktor, Kurventempo-Faktor, Vorrang
const KIND = {
  car: { acc: 0.36, vmul: 1, turn: 1 }, taxi: { acc: 0.36, vmul: 1.03, turn: 1 },
  van: { acc: 0.26, vmul: 0.95, turn: 0.95 }, truck: { acc: 0.17, vmul: 0.85, turn: 0.8 },
  semi: { acc: 0.14, vmul: 0.82, turn: 0.72 }, fire: { acc: 0.36, vmul: 1.28, turn: 1.08, prio: 1 },
  police: { acc: 0.32, vmul: 1.05, turn: 1 }, garbage: { acc: 0.16, vmul: 0.8, turn: 0.8 },
  ambulance: { acc: 0.34, vmul: 1.18, turn: 1.05 }, hearse: { acc: 0.22, vmul: 0.85, turn: 0.95 },
  snowplow: { acc: 0.14, vmul: 0.55, turn: 0.85 }, bus: { acc: 0.2, vmul: 0.9, turn: 0.8 },
  tram: { acc: 0.17, vmul: 0.95, turn: 0.72 },
};
const TYPE_KIND = ['car', 'truck', 'van', 'fire', 'police', 'garbage'];
const WAIT = 0, DRIVE = 1;
const _q = { x: 0, z: 0, hx: 0, hz: 1, k: 0 }, _r = { x: 0, z: 0, hx: 0, hz: 1, k: 0 }, _t = { x: 0, z: 0, hx: 0, hz: 1, k: 0 };

export class Traffic {
  constructor(g) {
    this.g = g;
    this.trips = [];     // Fahrten (Rechnung)
    this.cars = [];      // sichtbare Fahrzeuge
    this.hourCount = new Float32Array(g.N);
    this.spawnAcc = 0;
    this.lists = { res: new WeightedList(), job: new WeightedList(), com: new WeightedList(), ind: new WeightedList(), any: new WeightedList() };
    this.maxCars = 900;      // gleichzeitige Fahrten (Rechnung, wie bisher)
    this.maxVisual = 700;    // sichtbare Fahrzeuge höchstens (fahren gemächlicher als die Rechnung)
    this.nextId = 1;
    this.tripsHour = 0;
    this.flow = 1;
    // Anteil des pauschalen Lieferverkehrs; Systeme mit eigenem Güterverkehr setzen 0
    this.freightShare = 0.28;
    // Eigener, reproduzierbarer Zufall (stört die Zufallsfolge der Stadt nicht)
    this.rng = makeRng(((g.opts && g.opts.seed) || 1) * 2654435761 ^ 0x7f4a7c15);
    this.lanes = new Flow(g);
    this.visId = 1;
    this.visChance = 1;  // Anteil der Fahrten mit sichtbarem Fahrzeug (sinkt, wenn viele im Stau stehen)
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

  // Zahl der laufenden Fahrten (Rechnung) und davon Lieferverkehr
  tripCount() { return this.trips.length; }

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
      if (this.trips.length < this.maxCars) this.spawnTrip(h);
    }
    if (this.spawnAcc > 3) this.spawnAcc = 3;
    // Dienstfahrzeuge
    if (this.rng() < simSec * 0.25 * Math.min(4, g.buildings.size / 60)) this.spawnService();

    // Tempo: Verordnung Tempo 30 und Effekt 'roadSpeed' (Schnee, Glätte, Hochwasser …)
    const slowGlobal = (g.policies.has('tempo30') ? 0.78 : 1) * Math.max(0.15, 1 + g.eff('roadSpeed'));
    const trips = this.trips;
    let w = 0;
    for (let k = 0; k < trips.length; k++) {
      const c = trips[k];
      if (this.advance(c, simSec, slowGlobal)) trips[w++] = c;
      else this.arrive(c);
    }
    trips.length = w;
    this.drive(simSec, slowGlobal);
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
    if (this.trips.length >= this.maxCars || b.access < 0) return;
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

  // Neue Fahrt (Rechnung) und – wenn Platz ist – ihr sichtbares Fahrzeug. opts: { weight, freight }
  addCar(type, path, target, force = false, opts = null) {
    if (path.length < 2) return null;
    if (!force && this.trips.length >= this.maxCars) return null;
    const c = {
      id: this.nextId++, type, path, piece: 0, s: 0, target,
      color: Math.floor(this.rng() * 1000),
      weight: type >= VT.FIRE ? 0.5 : this.weight || 1,
      speedVar: 0.85 + this.rng() * 0.3,
    };
    this.hourCount[path[0]] += c.weight;
    if (opts) { if (opts.weight !== undefined) c.weight = opts.weight; if (opts.freight) c.freight = true; }
    this.trips.push(c);
    // Sichtbares Fahrzeug – solange Platz ist und die Straßen nicht im Stau stehen (sonst nur gerechnet)
    if (force || (this.cars.length < this.maxVisual && hashf(c.id * 97 + 13) < this.visChance)) this.spawnVisual(c);
    return c;
  }

  pieceLen(c, k) {
    const p = c.path, n = p.length - 1;
    if (k === 0 || k === n) return 0.5;
    const a = p[k - 1], b = p[k], d = p[k + 1];
    return (b - a) === (d - b) ? 1 : 0.785;
  }

  // Fortschritt einer Fahrt (Rechnung, wie bisher): Tempo nach Straßentyp, Stau und Verordnungen
  advance(c, simSec, slowGlobal) {
    const g = this.g;
    const tile = c.path[c.piece];
    const road = g.road[tile];
    const def = ROADS[road];
    if (!def) return false; // Straße wurde abgerissen
    const cong = g.congestion[tile];
    const slow = (cong > 0.75 ? 1 / (1 + (cong - 0.75) * 3) : 1) / (1 + (g.tileDelay ? g.tileDelay[tile] : 0));
    let v = 1.7 * def.speed * slow * slowGlobal * c.speedVar;
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
    return true;
  }

  arrive(c) {
    if (c.type === VT.FIRE && c.target) {
      const b = this.g.buildings.get(c.target);
      if (b && b.burning) this.g.extinguish(b);
    }
  }

  // ------------------------------------------------------------ sichtbare Fahrzeuge
  spawnVisual(trip) {
    const id = trip.id;
    let kind = TYPE_KIND[trip.type] || 'car', model = 'car_compact', trailer = false;
    switch (trip.type) {
      case VT.CAR: model = carModel(hashf(id * 7 + 1)); break;
      case VT.TRUCK: {
        const u = hashf(id * 17 + 3);
        if (u < 0.42) model = 'truck_box'; else { model = 'truck_tractor'; trailer = true; kind = 'semi'; }
        break;
      }
      case VT.VAN: model = hashf(id * 19 + 4) < 0.6 ? 'van_box' : 'van'; break;
      case VT.FIRE: model = hashf(id * 23 + 1) < 0.75 ? 'fire' : 'fire_ladder'; break;
      case VT.POLICE: model = hashf(id * 37 + 2) < 0.8 ? 'police' : 'police_van'; break;
      case VT.GARBAGE: model = 'garbage'; break;
      default: model = 'car_compact';
    }
    const v = this.addVisual(kind, trip.path, { id, model, trailer, type: trip.type, beacon: trip.type === VT.FIRE || (trip.type === VT.POLICE && hashf(id * 41 + 3) < 0.35) });
    if (v) { v.trip = trip; if (trip.freight) v.freight = true; }
    return v;
  }

  // Fahrzeug in den sichtbaren Verkehr setzen. path: Feldfolge oder fertige Route (opts.route).
  // opts: { id, model, kind, trailer, owned (Besitzer zeichnet über renderables), S, cls, len, segs, prio, beacon,
  //         cyclic, lanes, speed (Faktor) }
  addVisual(kind, path, opts = {}) {
    const g = this.g;
    // Fahrten von und zur Autobahn: sichtbar bis zum Kartenrand (nicht am Autobahnende auftauchen oder verschwinden)
    let fromEdge = false, toEdge = false;
    if (path && !opts.route && !opts.cyclic && path.length >= 2) {
      const hw = g.world.highway, he = g.world.highwayEnd;
      if (hw && hw.length > 1 && (path[0] === he || path[path.length - 1] === he)) {
        const arr = Array.from(path);
        const ext = hw.slice(0, hw.length - 1);
        if (arr[0] === he && !arr.includes(hw[0])) { arr.unshift(...ext); fromEdge = true; }
        if (arr[arr.length - 1] === he && !arr.slice(0, -1).includes(hw[0])) { for (let i = ext.length - 1; i >= 0; i--) arr.push(ext[i]); toEdge = true; }
        path = Int32Array.from(arr);
      }
      if (path[0] === g.world.entry) fromEdge = true;
      if (path[path.length - 1] === g.world.entry) toEdge = true;
    }
    const route = opts.route || (path && path.length >= 1 ? new Route(g, path, !!opts.cyclic, { lanes: opts.lanes || 'car' }) : null);
    if (!route) return null;
    const P = KIND[kind] || KIND.car;
    const model = opts.model || kind;
    const dim = VDIM[model] || VDIM.car_compact;
    let len = opts.len || dim[0];
    if (opts.trailer) len = dim[0] / 2 - TRAILER.fifth + TRAILER.king + TRAILER.len / 2; // Zugmaschine vorn bis Aufliegerheck
    const id = opts.id || 500000 + this.visId++;
    const v = {
      id, kind, model, type: opts.type ?? -1, route, cls: opts.cls ?? LC.IN,
      len, wid: opts.wid || dim[1], axF: dim[2], axR: dim[3], bodyLen: dim[0], trailer: !!opts.trailer,
      S: opts.S ?? len / 2, v: opts.v || 0, a: 0, k: 0, res: [], wait: 0, stuck: 0,
      acc: P.acc, vmul: P.vmul * (opts.speed || 1) * (0.92 + hashf(id * 61 + 5) * 0.16), turnMul: P.turn, prio: opts.prio ?? P.prio ?? 0,
      state: opts.S !== undefined ? DRIVE : WAIT, owned: !!opts.owned, sysDraw: !!opts.sysDraw, beacon: !!opts.beacon, done: false,
      stopS: Infinity, vEnd: 0, endsAtTarget: !route.cyclic && !opts.owned,
      x: 0.5, z: 0.5, yaw: 0.5, hx: 0.5, hz: 0.5, brake: false, blink: 0, born: this.lanes.t,
      // Rechenstand von Flow (immer Zahlen, damit die Felder Kommazahlen bleiben): letzte Beschleunigung, Lagegrenze ab
      // S, Haltegrund, zuletzt eingetragen, Lage zuletzt
      ca: 0.5, cg: 0.5, cs: -1e9, cr: 0, seen: 0, poseTick: -1, lat: 0.5, home: 0, laneT: 0, wide: false, long: false,
      tx: 0.5, tz: 0.5, tyaw: 0.5, zone: null,
      // von Systemen gesetzt (Linienfahrzeuge, Fahrten) – hier schon angelegt, damit alle Fahrzeuge dieselbe Gestalt haben
      hidden: false, rev: 0, rF: null, rB: null, noCong: false, lineVeh: false, flipped: false, xoverEnd: -1, trip: null, freight: false,
      segs: opts.segs || null, mods: null,
    };
    v.vmul0 = v.vmul;
    // Spurlage auf zweistreifigen Straßen (0 innen, 1 außen): Pkw nach Zufall, Busse außen; breite Fahrzeuge
    // (Lkw, Busse, Bahnen) belegen dort beide Streifen
    v.lat = v.cls === LC.OUT ? 1 : v.cls === LC.TRAM ? 0 : hashf(id * 53 + 9) < 0.55 ? 0 : 1;
    v.home = v.lat; v.laneT = v.lat;
    v.wide = v.wid >= 0.215 || !!opts.segs;
    v.long = dim[0] > 0.7 || !!opts.trailer || !!opts.segs;
    if (!route.cyclic && !opts.owned) { v.stopS = route.len + v.bodyLen / 2; v.vEnd = toEdge ? 4 : 0.4; }
    if (fromEdge) { v.v = 1.6; v.S = -0.6; }
    if (v.trailer) { v.tx = 0; v.tz = 0; v.tyaw = 0; }
    this.pose(v);
    this.cars.push(v);
    return v;
  }

  // Alle sichtbaren Fahrzeuge einen Schritt fahren lassen (Belegung → Fahren → Lage)
  drive(dt, slowGlobal) {
    const F = this.lanes, g = this.g;
    F.begin(dt);
    F.env = slowGlobal;
    const cars = this.cars;
    const nc = cars.length;
    for (let i = 0; i < nc; i++) { const v = cars[i]; if (v.state === DRIVE && !v.done) F.register(v); }
    for (const s of SYSTEMS) if (s.flowRegister) { try { s.flowRegister(g, F); } catch (e) { g.reportError(`System „${s.id}“ (flowRegister)`, e); } }
    // Abfahrt vom Straßenrand, sobald auf der Fahrbahn Platz ist (sonst nach einer Weile aufgeben)
    for (let i = 0; i < nc; i++) {
      const v = cars[i];
      if (v.state !== WAIT || v.done) continue;
      if (F.canStart(v)) { v.state = DRIVE; F.register(v); }
      else if (F.t - v.born > 10) v.done = true;
    }
    let w = 0;
    for (let i = 0; i < cars.length; i++) {
      const v = cars[i];
      if (!v.done && v.state === DRIVE && !v.hidden) {
        F.drive(v);
        const R0 = v.route;
        // Ziel erreicht, Straße abgerissen oder hoffnungslos verkeilt
        if (!R0.cyclic && !v.owned && v.S >= v.stopS - 0.03) v.done = true;
        else if (!v.owned && !g.road[R0.tile(v.k)]) v.done = true;
        else if (!v.owned && v.stuck > 15 && (v.stuck > 40 || this.offView(v))) { v.done = true; F.stats.removed++; }
        // Ort für Klang, Übersicht und Detailstufe reihum (jedes achte Bild, nur die Mitte); die Darstellung rechnet
        // sichtbare Fahrzeuge selbst ganz nach
        if (!v.done && ((F.tick + v.id) & 7) === 0) { _q.k = v.k; R0.at(v.S - v.bodyLen / 2, v.cls, _q, v.lat || 0); v.x = _q.x; v.z = _q.z; }
      }
      if (v.done) { F.releaseAll(v); continue; }
      cars[w++] = v;
    }
    cars.length = w;
    // Staugrad der sichtbaren Fahrzeuge (ohne Warten an Rot): danach richtet sich, wie viele neue Fahrten sichtbar werden
    if ((F.tick & 31) === 0) {
      let n = 0, jam = 0;
      for (const v of cars) if (v.state === DRIVE && !v.owned) { n++; if (v.v < 0.05 && v.cr !== 1) jam++; }
      const f = n > 40 ? jam / n : 0;
      // (bis etwa ein Achtel steht, alle; ab einem Drittel kaum noch neue – sonst verstopft die Stadt sichtbar)
      this.visChance = Math.max(0.1, Math.min(1, 1.5 - 4 * f));
    }
    // Systeme mit eigenen Fahrzeugen (Busse, Straßenbahnen): Halte, Abfahrt, Wende
    for (const s of SYSTEMS) if (s.flowTick) { try { s.flowTick(g, F, dt); } catch (e) { g.reportError(`System „${s.id}“ (flowTick)`, e); } }
    F.end();
  }

  // Außerhalb des Blickkreises der Kamera (Flow.focus; ohne Darstellung: überall)? Dort lösen sich lange Staus auf,
  // indem festsitzende Fahrzeuge still verschwinden – die Fahrten der Rechnung laufen davon unberührt weiter.
  offView(v) {
    const Fc = this.lanes.focus;
    if (!Fc) return true;
    const dx = v.x - Fc.x, dz = v.z - Fc.z;
    return dx * dx + dz * dz > Fc.r2 * 2.25;
  }

  // Lage für die Darstellung: Mitte und Richtung aus Vorder- und Hinterachse auf der Spur, Auflieger und Glieder
  // folgen der Spur im festen Abstand (Königszapfen bzw. Gelenk auf der Sehne) – nichts schwenkt starr über Ecken.
  pose(v) {
    const R0 = v.route, cls = v.cls;
    v.poseTick = this.lanes.tick;
    if (v.segs) { this.poseSegments(v); return; }
    const L = v.bodyLen;
    // Front des Zugfahrzeugs: bei Sattelzügen ganz vorn (S zählt bis zur Spitze)
    const Sf = v.S;
    // breite Fahrzeuge auf der Allee nicht ganz außen (sonst ragen sie über den Fahrbahnrand)
    const lp = (v.wide ? Math.min(v.lat || 0, 0.8) : v.lat || 0) + (v.long ? 2 : 0);
    // Hinterachse im festen Sehnenabstand hinter der Vorderachse (in Kurven ist die Spur kürzer als ihr Nennmaß S)
    _q.k = v.k;
    const sq = Sf - (L / 2 - v.axF);
    R0.at(sq, cls, _q, lp);
    _r.k = _q.k;
    chordBack(R0, cls, sq, _q.x, _q.z, v.axF - v.axR, _r, lp, 3);
    let hx = _q.x - _r.x, hz = _q.z - _r.z;
    const l = Math.sqrt(hx * hx + hz * hz) || 1;
    hx /= l; hz /= l;
    v.x = _r.x - hx * v.axR;
    v.z = _r.z - hz * v.axR;
    v.yaw = Math.atan2(hx, hz);
    v.hx = hx; v.hz = hz;
    // Blinker: Abbiegen in den nächsten gut anderthalb Feldern (−1 rechts, +1 links)
    v.blink = v.state === DRIVE ? R0.turnAhead(Sf, v.k, 1.6) : 0;
    if (v.trailer) {
      // Sattelpunkt der Zugmaschine, Achse des Aufliegers auf der Spur im Abstand king − axle dahinter
      const kx = v.x + hx * TRAILER.fifth, kz = v.z + hz * TRAILER.fifth;
      const sk = Sf - (L / 2 - TRAILER.fifth);
      _t.k = v.k;
      chordBack(R0, cls, sk, kx, kz, TRAILER.king - TRAILER.axle, _t, lp);
      let tx = kx - _t.x, tz = kz - _t.z;
      const tl = Math.sqrt(tx * tx + tz * tz) || 1;
      tx /= tl; tz /= tl;
      v.tx = kx - tx * TRAILER.king; v.tz = kz - tz * TRAILER.king;
      v.tyaw = Math.atan2(tx, tz);
    }
  }

  // Gliederfahrzeuge (Straßenbahn, Gelenkbus): Gelenkpunkte auf der Spur, jedes Glied auf der Sehne zwischen zweien.
  // v.segs: [{ len, model, front: Überhang vorn, back: Überhang hinten }], v.mods: Lagen je Glied
  poseSegments(v) {
    const R0 = v.route, cls = v.cls, segs = v.segs;
    if (!v.mods) v.mods = segs.map(() => ({ x: 0, z: 0, yaw: 0 }));
    const lp = Math.min(v.lat || 0, 0.8) + 2;
    let S = v.S - segs[0].front;
    _q.k = v.k;
    R0.at(S, cls, _q, lp);
    let px = _q.x, pz = _q.z;
    for (let i = 0; i < segs.length; i++) {
      const sg = segs[i];
      const d = sg.len - sg.front - sg.back;
      _r.k = _q.k;
      S = chordBack(R0, cls, S, px, pz, d, _r, lp);
      let hx = px - _r.x, hz = pz - _r.z;
      const l = Math.sqrt(hx * hx + hz * hz) || 1;
      hx /= l; hz /= l;
      const m = v.mods[i];
      // Gliedmitte: zwischen den Gelenken, verschoben um die Überhänge
      const c = (sg.front - sg.back) / 2;
      m.x = (px + _r.x) / 2 + hx * c; m.z = (pz + _r.z) / 2 + hz * c;
      m.yaw = Math.atan2(hx, hz);
      if (i === 0) { v.x = m.x; v.z = m.z; v.yaw = m.yaw; v.hx = hx; v.hz = hz; }
      px = _r.x; pz = _r.z;
      _q.k = _r.k;
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
    // Fahrten und Fahrzeuge auf abgerissenen Straßen entfernen
    const set = new Set(tiles);
    this.trips = this.trips.filter((c) => {
      for (let k = c.piece; k < c.path.length; k++) if (set.has(c.path[k])) return false;
      return true;
    });
    for (const v of this.cars) {
      if (v.owned) continue;
      const p = v.route.path;
      for (let k = Math.max(0, v.k - 1); k < p.length; k++) if (set.has(p[k])) { v.done = true; break; }
    }
    this.cars = this.cars.filter((v) => { if (v.done) this.lanes.releaseAll(v); return !v.done; });
  }
}
void R;
