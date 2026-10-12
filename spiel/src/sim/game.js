// Das Spiel: Zustand, Aktionen des Spielers, Zeitablauf, Speichern/Laden.
import {
  VERSION, GAME_MIN_PER_SEC, SPEEDS, DAY, WEEKDAYS, T, RES, Z, ZONE_INFO, R, ROADS, BRIDGE_FACTOR,
  CLEAR_TREE_COST, ZONE_COST, BUILDINGS, MILESTONES, TRANSIT, LOANS, DIFFICULTIES, POLICIES,
} from '../config.js';
import { Emitter, mulberry32, clamp, typedToB64, b64ToTyped, hash2, fmtMoney } from '../util.js';
import { generateWorld } from './world.js';
import { rebuildNetwork, updateBuildingAccess, PathCache } from './network.js';
import { computeUtilities, computeCoverage, computeFields, computeHappiness, SERVICE_TYPES } from './services.js';
import { aggregate, updateDemand, growthStep, constructionStep, dailyBuildings, hourlyFires, checkMilestones, capacityOf, maxLevelAt } from './city.js';
import { computeBudget, dailyEconomy, weeklyLoans } from './economy.js';
import { Traffic } from './traffic.js';
import { Transit } from './transit.js';
import { offerCards, chooseCard, maybeEvent, resolveEvent, chatter } from './progress.js';

export class Game extends Emitter {
  constructor(opts) {
    super();
    const { size = 96, seed = 12345, mapType = 'river', difficulty = 'normal', name = 'Neustadt' } = opts;
    this.opts = { size, seed, mapType, difficulty, name };
    this.name = name;
    this.world = generateWorld(size, seed, mapType);
    const W = (this.W = size), H = (this.H = size), N = (this.N = W * H);
    this.rng = mulberry32((seed * 7919) ^ 0x5bd1e995);
    this.road = new Uint8Array(N);
    this.zone = new Uint8Array(N);
    this.bld = new Int32Array(N);
    this.rubble = new Uint8Array(N);
    this.stationAt = new Int32Array(N);
    this.trackCount = new Uint8Array(N);
    this.roadComp = new Int32Array(N).fill(-1);
    this.access = new Int32Array(N).fill(-1);
    this.trafficLoad = new Float32Array(N);
    this.congestion = new Float32Array(N);
    this.transitPenalty = new Uint8Array(N);
    this.cov = {};
    for (const t of [...SERVICE_TYPES, 'park', 'transit', 'lvBonus', 'happyBonus', 'comBoost', 'resBoost']) this.cov[t] = new Float32Array(N);
    this.nearestFac = { fire: new Int32Array(N), police: new Int32Array(N), garbage: new Int32Array(N) };
    this.fields = { pollution: new Float32Array(N), noise: new Float32Array(N), crime: new Float32Array(N), landValue: new Float32Array(N) };
    this.compCount = 0;
    this.outsideComp = -1;
    this.netVersion = 0;
    this.pathCache = new PathCache();
    this.buildings = new Map();
    this.nextId = 1;
    this.zoneFree = [null, new Set(), new Set(), new Set(), new Set()];
    this._zoneArr = [null, null, null, null, null];
    this.growAcc = [0, 0, 0, 0, 0];

    const diff = DIFFICULTIES.find((d) => d.id === difficulty) || DIFFICULTIES[1];
    this.difficulty = diff.id;
    this.sandbox = diff.id === 'sandbox';
    this.costMul = this.sandbox ? 0 : diff.costMul;
    this.money = diff.money;
    this.time = 7 * 60; // Tag 0, 07:00
    this.nextStep = this.time + 10;
    this.lastHour = Math.floor(this.time / 60);
    this.lastDay = 0;
    this.speed = 1;
    this.taxes = { 1: 10, 2: 10, 3: 10, 4: 10 };
    this.policies = new Set();
    this.milestone = this.sandbox ? MILESTONES.length - 1 : 0;
    this.mods = { upkeep: 1, power: 1, water: 1, edu: 1, fire: 1, trainSpeed: 1, pollution: 1 };
    this.effects = [];
    this.loans = [];
    this.cardCount = {};
    this.cardsTaken = [];
    this.landmarkVouchers = new Set();
    this.pendingCards = null;
    this.pendingEvent = null;
    this.nextEventDay = 5;
    this.lastEventId = null;
    this.debtDays = 0;
    this.weekIncome = 0;
    this.weekExpense = 0;
    this.history = [];
    this.newsLog = [];
    this.gameOver = false;
    this.demand = [0, 0, 0, 0, 0];
    this.peopleDemand = 0;
    this.stats = {
      pop: 0, resCap: 0, workers: 0, jobs: 0, jobsByZone: [0, 0, 0, 0, 0], plannedByZone: [0, 0, 0, 0, 0], countByZone: [0, 0, 0, 0, 0], employed: 0, unemployment: 0, jobFill: 1,
      edu: 0, eduWorkers: 0, eduCity: 0, happiness: 60, tourism: 0, transitShare: 0, trafficFlow: 1, ridersToday: 0,
      abandoned: 0, unpowered: 0, unwatered: 0, burning: 0, noRoad: 0, garbageProb: 0, pollutionAvg: 0, crimeAvg: 0, healthAvg: 0,
    };
    this.util = { powerSupply: 0, powerDemand: 0, waterSupply: 0, waterDemand: 0 };
    this.dirty = { util: true, coverage: true, fields: true };

    for (const t of this.world.highway) this.road[t] = R.HIGHWAY;
    this.traffic = new Traffic(this);
    this.transit = new Transit(this);
    if (this.sandbox) this.transit.linesMax = 10;
    rebuildNetwork(this);
    computeFields(this);
    this.lastBudget = computeBudget(this);
  }

  // ---------- Zeit
  day() { return Math.floor(this.time / DAY); }
  hour() { return (this.time % DAY) / 60; }
  weekday() { return this.day() % 7; }
  week() { return Math.floor(this.day() / 7) + 1; }
  year() { return Math.floor(this.day() / 364) + 1; }
  clockText() {
    const m = Math.floor(this.time % DAY);
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(Math.floor((m % 60) / 15) * 15).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  dateText() { return `${WEEKDAYS[this.weekday()]} · Woche ${this.week()} · Jahr ${this.year()}`; }
  get blocking() { return !!(this.pendingCards || this.pendingEvent || this.gameOver); }

  // ---------- Effekte und Freischaltungen
  eff(key) {
    let v = 0;
    for (const e of this.effects) if (e.key === key) v += e.value;
    return v;
  }
  addEffect(key, value, days, label) {
    this.effects.push({ key, value, until: this.time + days * DAY, label });
    this.dirty.coverage = true;
    this.emit('effects');
  }
  upkeepMul() { return this.mods.upkeep * (this.sandbox ? 0 : this.costMul === 0 ? 0 : Math.max(0.6, this.costMul)); }
  isUnlocked(key) {
    if (this.sandbox) return true;
    if (key === 'zone4' || key === 'transit' || key === 'avenue' || key === 'loans') return this.milestone >= 2;
    if (key === 'policies') return this.milestone >= 1;
    const d = BUILDINGS[key];
    if (d) {
      if (d.landmark) return this.landmarkVouchers.has(key) || this.milestone >= d.unlock + 1;
      return this.milestone >= d.unlock;
    }
    return true;
  }
  lockReason(key) {
    if (this.isUnlocked(key)) return null;
    const d = BUILDINGS[key];
    let need = 2;
    if (d) need = d.landmark ? d.unlock + 1 : d.unlock;
    const m = MILESTONES[need];
    if (d && d.landmark) return `Über eine Wochenkarte oder ab „${m.name}" (${m.pop.toLocaleString('de-DE')} Einw.)`;
    return `Ab „${m.name}" (${m.pop.toLocaleString('de-DE')} Einwohner)`;
  }
  hasBuilt(key) { for (const b of this.buildings.values()) if (b.key === key) return true; return false; }
  countBuilt(cat) { let n = 0; for (const b of this.buildings.values()) if (!b.zone && BUILDINGS[b.key]?.cat === cat) n++; return n; }

  canAfford(cost) { return this.sandbox || cost <= 0 || this.money >= cost; }
  spend(cost) { if (!this.sandbox) this.money -= cost; this.emit('money'); }

  // ---------- Straßen
  roadTileCost(i, type) {
    const ter = this.world.terrain[i];
    let c = ROADS[type].cost * this.costMul * Math.max(0.2, 1 + this.eff('roadCost'));
    if (ter === T.WATER) c *= BRIDGE_FACTOR;
    if (this.world.trees[i]) c += CLEAR_TREE_COST * this.costMul;
    return c;
  }
  planRoad(tiles, type) {
    let cost = 0;
    const invalid = [];
    const build = [];
    for (const i of tiles) {
      const ter = this.world.terrain[i];
      const cur = this.road[i];
      if (cur === R.HIGHWAY) { if (type !== R.HIGHWAY) continue; }
      if (cur === type) continue;
      if (ter === T.ROCK || this.bld[i] || (this.stationAt[i] && !cur)) { invalid.push(i); continue; }
      build.push(i);
      cost += this.roadTileCost(i, type);
    }
    return { cost, invalid, build, ok: invalid.length === 0 && build.length > 0 };
  }
  buildRoad(tiles, type) {
    const plan = this.planRoad(tiles, type);
    if (!plan.ok) return { ok: false, msg: plan.invalid.length ? 'Hier kann keine Straße gebaut werden.' : 'Nichts zu bauen.' };
    if (!this.canAfford(plan.cost)) return { ok: false, msg: 'Nicht genug Geld.' };
    let trees = false;
    for (const i of plan.build) {
      this.road[i] = type;
      if (this.zone[i]) { this.zoneFree[this.zone[i]].delete(i); this.zone[i] = 0; this._zoneDirty(); }
      if (this.world.trees[i]) { this.world.trees[i] = 0; trees = true; }
      this.rubble[i] = 0;
    }
    this.spend(plan.cost);
    this.afterNetworkChange();
    if (trees) this.emit('treesChanged');
    this.emit('zonesChanged');
    return { ok: true, cost: plan.cost };
  }
  afterNetworkChange() {
    rebuildNetwork(this);
    this.dirty.util = this.dirty.coverage = true;
    computeUtilities(this);
    this.emit('roadsChanged');
  }

  // ---------- Zonen
  _zoneDirty() { this._zoneArr = [null, null, null, null, null]; }
  zoneFreeArray(z) {
    if (!this._zoneArr[z]) this._zoneArr[z] = [...this.zoneFree[z]];
    return this._zoneArr[z];
  }
  planZone(tiles, z) {
    let cost = 0;
    const apply = [];
    for (const i of tiles) {
      const ter = this.world.terrain[i];
      if (ter === T.WATER || ter === T.ROCK || this.road[i] || this.stationAt[i]) continue;
      if (this.bld[i]) continue;
      if (this.zone[i] === z) continue;
      apply.push(i);
      if (z) cost += ZONE_COST * this.costMul;
    }
    return { cost, apply, ok: apply.length > 0 };
  }
  zoneTiles(tiles, z) {
    const plan = this.planZone(tiles, z);
    if (!plan.ok) return { ok: false, msg: 'Keine passenden Felder.' };
    if (!this.canAfford(plan.cost)) return { ok: false, msg: 'Nicht genug Geld.' };
    for (const i of plan.apply) {
      if (this.zone[i]) this.zoneFree[this.zone[i]].delete(i);
      this.zone[i] = z;
      if (z) this.zoneFree[z].add(i);
    }
    this._zoneDirty();
    this.spend(plan.cost);
    this.emit('zonesChanged');
    return { ok: true, cost: plan.cost };
  }

  // ---------- Gebäude platzieren
  footprint(key, rot) {
    const d = BUILDINGS[key];
    let [w, h] = d.size;
    if (rot % 2 === 1) [w, h] = [h, w];
    return [w, h];
  }
  buildingCost(key) {
    const d = BUILDINGS[key];
    let c = d.cost * this.costMul;
    if (d.landmark && this.landmarkVouchers.has(key)) c *= 0.5;
    if (d.cat === 'parks' && this.eff('parkFree') > 0) c = 0;
    return Math.round(c);
  }
  checkPlace(key, x, y, rot = 0) {
    const d = BUILDINGS[key];
    if (!d) return 'Unbekannt';
    if (!this.isUnlocked(key)) return this.lockReason(key);
    if (key === 'station') return this.transit.canPlaceStation(x, y);
    if (d.unique && this.hasBuilt(key)) return 'Gibt es schon in deiner Stadt';
    const [w, h] = this.footprint(key, rot);
    const { W, H } = this;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) return 'Außerhalb der Karte';
      const i = yy * W + xx;
      const ter = this.world.terrain[i];
      if (ter === T.WATER) return 'Nicht auf dem Wasser';
      if (ter === T.ROCK) return 'Nicht auf Fels';
      if (this.road[i]) return 'Straße im Weg';
      if (this.bld[i]) return 'Fläche ist bebaut';
      if (this.stationAt[i]) return 'Station im Weg';
    }
    let roadOk = false, waterOk = false;
    for (let yy = y - 1; yy <= y + h; yy++) for (let xx = x - 1; xx <= x + w; xx++) {
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const inside = xx >= x && xx < x + w && yy >= y && yy < y + h;
      if (inside) continue;
      const corner = (xx === x - 1 || xx === x + w) && (yy === y - 1 || yy === y + h);
      const i = yy * W + xx;
      if (!corner && this.road[i] && this.road[i] !== R.HIGHWAY) roadOk = true;
      if (this.world.terrain[i] === T.WATER) waterOk = true;
    }
    if (d.needsWater && !waterOk) return 'Muss direkt am Wasser stehen';
    if (!roadOk) return 'Braucht eine angrenzende Straße';
    return null;
  }
  placeCost(key, x, y, rot = 0) {
    let c = this.buildingCost(key);
    if (key === 'station') return c;
    const [w, h] = this.footprint(key, rot);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (xx >= 0 && yy >= 0 && xx < this.W && yy < this.H && this.world.trees[yy * this.W + xx]) c += CLEAR_TREE_COST * this.costMul;
    }
    return c;
  }
  placeBuilding(key, x, y, rot = 0) {
    const err = this.checkPlace(key, x, y, rot);
    if (err) return { ok: false, msg: err };
    const cost = this.placeCost(key, x, y, rot);
    if (!this.canAfford(cost)) return { ok: false, msg: 'Nicht genug Geld.' };
    this.spend(cost);
    if (key === 'station') {
      const i = y * this.W + x;
      if (this.zone[i]) { this.zoneFree[this.zone[i]].delete(i); this.zone[i] = 0; this._zoneDirty(); this.emit('zonesChanged'); }
      if (this.world.trees[i]) { this.world.trees[i] = 0; this.emit('treesChanged'); }
      const st = this.transit.addStation(x, y);
      this.emit('transitChanged');
      return { ok: true, cost, station: st };
    }
    const [w, h] = this.footprint(key, rot);
    let trees = false, zones = false;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const i = yy * this.W + xx;
      if (this.world.trees[i]) { this.world.trees[i] = 0; trees = true; }
      if (this.zone[i]) { this.zoneFree[this.zone[i]].delete(i); this.zone[i] = 0; zones = true; }
      this.rubble[i] = 0;
    }
    if (zones) { this._zoneDirty(); this.emit('zonesChanged'); }
    if (trees) this.emit('treesChanged');
    const b = this.makeBuilding({ key, zone: 0, x, y, w, h, level: 1 });
    b.rot = rot;
    if (BUILDINGS[key].landmark) this.landmarkVouchers.delete(key);
    this.dirty.util = this.dirty.coverage = true;
    computeUtilities(this);
    computeCoverage(this);
    this.transit.applyCoverage();
    return { ok: true, cost, building: b };
  }

  makeBuilding({ key, zone, x, y, w, h, level }) {
    const b = {
      id: this.nextId++, key, zone, x, y, w, h, rot: 0, level, cap: 0, occ: 0,
      variant: Math.floor(this.rng() * 1e6), happy: 62, age: 0, edu: 0, commute: 16,
      powered: false, watered: false, construct: 0, abandoned: false, abandonedDays: 0,
      burning: 0, extinguishAt: 0, noPower: 0, noWater: 0, noRoad: 0, unhappyDays: 0, upCount: 0,
      spec: null, access: -1, comp: -1, connected: false, crime: 0, transitShare: 0, load: 0,
    };
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.bld[yy * this.W + xx] = b.id;
    if (zone) {
      const i = y * this.W + x;
      const res = this.world.resource[i];
      if (zone === Z.IND && res === RES.FERTILE) b.spec = 'farm';
      else if (zone === Z.IND && res === RES.ORE) b.spec = 'mine';
      b.cap = capacityOf(b);
    }
    updateBuildingAccess(this, b);
    this.buildings.set(b.id, b);
    this.emit('buildingAdded', b);
    return b;
  }

  spawnZoneBuilding(t, z) {
    this.zoneFree[z].delete(t);
    this._zoneDirty();
    if (this.world.trees[t]) { this.world.trees[t] = 0; this.emit('treesChanged'); }
    const x = t % this.W, y = (t / this.W) | 0;
    const b = this.makeBuilding({ key: 'zone', zone: z, x, y, w: 1, h: 1, level: 1 });
    this.dirty.util = true;
    return b;
  }

  setBuildingLevel(b, level) {
    const up = level > b.level;
    b.level = level;
    b.cap = capacityOf(b);
    if (b.occ > b.cap) b.occ = b.cap;
    b.construct = up ? 0.35 : 1;
    this.emit('buildingRebuilt', b);
    this.dirty.util = true;
  }

  abandonBuilding(b) {
    b.abandoned = true;
    b.occ = 0;
    b.abandonedDays = 0;
    b.burning = 0;
    this.emit('buildingUpdated', b);
    this.dirty.util = true;
  }

  removeBuilding(b, opts = {}) {
    for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) {
      const i = yy * this.W + xx;
      this.bld[i] = 0;
      if (opts.rubble) this.rubble[i] = 2;
      if (b.zone && this.zone[i] && !this.rubble[i]) this.zoneFree[this.zone[i]].add(i);
    }
    this._zoneDirty();
    this.buildings.delete(b.id);
    this.emit('buildingRemoved', b);
    if (opts.rubble) this.emit('rubbleChanged');
    this.dirty.util = this.dirty.coverage = true;
  }

  igniteBuilding(b) {
    if (b.burning || b.abandoned) return;
    b.burning = this.time;
    b.extinguishAt = 0;
    this.emit('buildingUpdated', b);
    const ok = this.traffic.dispatchFire(b);
    if (!ok && this.rng() < 0.6) this.news('fire', 'Feuer ausgebrochen – und keine Feuerwehr in der Nähe!', 'bad', b);
    else if (this.rng() < 0.3) this.news('fire', 'Feuer gemeldet. Die Feuerwehr ist unterwegs.', 'info', b);
  }
  extinguish(b) {
    if (!b.burning) return;
    b.extinguishAt = this.time + 20;
    b.burning = 0;
    this.emit('buildingUpdated', b);
  }

  // ---------- Abriss
  planBulldoze(tiles) {
    const blds = new Set();
    const roads = [];
    const stations = [];
    let trees = 0, refund = 0, cost = 0;
    for (const i of tiles) {
      if (this.bld[i]) blds.add(this.bld[i]);
      if (this.road[i] && this.road[i] !== R.HIGHWAY) { roads.push(i); refund += ROADS[this.road[i]].cost * this.costMul * 0.3; }
      if (this.stationAt[i]) stations.push(this.stationAt[i]);
      if (this.world.trees[i] && !this.bld[i]) { trees++; cost += CLEAR_TREE_COST * this.costMul; }
      if (this.rubble[i]) trees += 0;
    }
    for (const id of blds) {
      const b = this.buildings.get(id);
      if (b && !b.zone) refund += BUILDINGS[b.key].cost * this.costMul * 0.4;
    }
    return { blds: [...blds], roads, stations, trees, net: cost - refund, any: blds.size + roads.length + stations.length + trees > 0 };
  }
  bulldoze(tiles) {
    const p = this.planBulldoze(tiles);
    if (!p.any) {
      // Trümmer räumen
      let any = false;
      for (const i of tiles) if (this.rubble[i]) { this.rubble[i] = 0; any = true; if (this.zone[i] && !this.bld[i]) this.zoneFree[this.zone[i]].add(i); }
      if (any) { this._zoneDirty(); this.emit('rubbleChanged'); return { ok: true, cost: 0 }; }
      return { ok: false, msg: 'Hier gibt es nichts abzureißen.' };
    }
    if (p.net > 0 && !this.canAfford(p.net)) return { ok: false, msg: 'Nicht genug Geld.' };
    for (const id of p.blds) { const b = this.buildings.get(id); if (b) this.removeBuilding(b); }
    for (const sid of p.stations) this.transit.removeStation(sid);
    if (p.stations.length) this.emit('transitChanged');
    let treesChanged = false;
    for (const i of tiles) if (this.world.trees[i] && !this.bld[i]) { this.world.trees[i] = 0; treesChanged = true; }
    if (treesChanged) this.emit('treesChanged');
    if (p.roads.length) {
      for (const i of p.roads) this.road[i] = 0;
      this.traffic.clearOnRoad(p.roads);
      this.afterNetworkChange();
    }
    this.spend(p.net);
    computeUtilities(this);
    this.emit('zonesChanged');
    return { ok: true, cost: p.net };
  }

  // ---------- Pulsbahn-Aktionen
  linePlanCost(stops, loop) { return Math.round((TRANSIT.lineCost + this.transit.lineCost(stops, loop)) * this.costMul); }
  createLine(stops, loop) {
    if (!this.isUnlocked('transit')) return { ok: false, msg: this.lockReason('station') };
    if (stops.length < 2) return { ok: false, msg: 'Eine Linie braucht mindestens zwei Stationen.' };
    if (loop && stops.length < 3) loop = false;
    if (this.transit.lines.length >= this.transit.linesMax) return { ok: false, msg: 'Keine freie Linie. Neue Linien gibt es über Meilensteine und Wochenkarten.' };
    const cost = this.linePlanCost(stops, loop);
    if (!this.canAfford(cost)) return { ok: false, msg: 'Nicht genug Geld.' };
    this.spend(cost);
    const usedTrain = this.transit.freeTrains > 0;
    if (usedTrain) this.transit.freeTrains--;
    const line = this.transit.createLine(stops, loop);
    this.afterTransitChange();
    return { ok: true, cost, line };
  }
  extendLine(lineId, stationId, atStart) {
    const line = this.transit.lines.find((l) => l.id === lineId);
    if (!line) return { ok: false };
    if (line.stops.includes(stationId) && !(line.stops.length >= 3 && ((atStart && line.stops[line.stops.length - 1] === stationId) || (!atStart && line.stops[0] === stationId)))) return { ok: false, msg: 'Station ist schon auf der Linie.' };
    if (!line.loop && line.stops.length >= 3 && ((atStart && line.stops[line.stops.length - 1] === stationId) || (!atStart && line.stops[0] === stationId))) {
      // Ring schließen
      const cost = Math.round(this.transit.segLen(line.stops[line.stops.length - 1], line.stops[0]) * TRANSIT.trackCostPerTile * this.costMul);
      if (!this.canAfford(cost)) return { ok: false, msg: 'Nicht genug Geld.' };
      this.spend(cost);
      line.loop = true;
      this.transit.rebuildLine(line);
      this.transit.changed();
      this.afterTransitChange();
      return { ok: true, cost, closed: true };
    }
    const from = atStart ? line.stops[0] : line.stops[line.stops.length - 1];
    const cost = Math.round(this.transit.segLen(from, stationId) * TRANSIT.trackCostPerTile * this.costMul);
    if (!this.canAfford(cost)) return { ok: false, msg: 'Nicht genug Geld.' };
    this.spend(cost);
    this.transit.extendLine(line, stationId, atStart);
    this.afterTransitChange();
    return { ok: true, cost };
  }
  removeLine(lineId) {
    this.transit.removeLine(lineId);
    this.afterTransitChange();
  }
  addTrain(lineId) {
    const line = this.transit.lines.find((l) => l.id === lineId);
    if (!line) return { ok: false };
    const n = this.transit.trains.filter((t) => t.line === lineId).length;
    if (n >= 6) return { ok: false, msg: 'Höchstens 6 Züge pro Linie.' };
    let cost = 0;
    if (this.transit.freeTrains > 0) this.transit.freeTrains--;
    else {
      cost = Math.round(TRANSIT.trainCost * this.costMul);
      if (!this.canAfford(cost)) return { ok: false, msg: 'Nicht genug Geld.' };
      this.spend(cost);
    }
    this.transit.addTrainToLine(line);
    this.afterTransitChange();
    return { ok: true, cost };
  }
  removeTrain(lineId) {
    const line = this.transit.lines.find((l) => l.id === lineId);
    if (!line) return { ok: false };
    if (!this.transit.removeTrainFromLine(line)) return { ok: false, msg: 'Jede Linie braucht mindestens einen Zug.' };
    this.afterTransitChange();
    return { ok: true };
  }
  addWagon(lineId) {
    const line = this.transit.lines.find((l) => l.id === lineId);
    if (!line) return { ok: false };
    let cost = 0;
    const free = this.transit.freeWagons > 0;
    if (!free) {
      cost = Math.round(TRANSIT.wagonCost * this.costMul);
      if (!this.canAfford(cost)) return { ok: false, msg: 'Nicht genug Geld.' };
    }
    if (!this.transit.addWagonToLine(line)) return { ok: false, msg: 'Alle Züge haben schon 3 Waggons.' };
    if (free) this.transit.freeWagons--; else this.spend(cost);
    this.afterTransitChange();
    return { ok: true, cost };
  }
  afterTransitChange() {
    this.transit.applyCoverage();
    this.emit('transitChanged');
  }

  // ---------- Politik und Finanzen
  setTax(z, v) { this.taxes[z] = clamp(Math.round(v), 0, 25); this.emit('money'); }
  togglePolicy(id) {
    const p = POLICIES.find((x) => x.id === id);
    if (!p || (!this.sandbox && this.milestone < p.unlock)) return false;
    if (this.policies.has(id)) this.policies.delete(id); else this.policies.add(id);
    this.dirty.coverage = this.dirty.util = true;
    this.emit('policies');
    return true;
  }
  takeLoan(k) {
    const L = LOANS[k];
    if (!L || this.loans.length >= 3) return false;
    this.loans.push({ amount: L.amount, weeks: L.weeks, weeksLeft: L.weeks, rate: L.rate, weekly: L.amount * L.rate });
    this.money += L.amount;
    this.emit('money');
    return true;
  }
  repayLoan(idx) {
    const l = this.loans[idx];
    if (!l) return false;
    const rest = (l.amount / l.weeks) * l.weeksLeft;
    if (!this.canAfford(rest)) return false;
    this.money -= rest;
    this.loans.splice(idx, 1);
    this.emit('money');
    return true;
  }
  chooseCard(id) { chooseCard(this, id); }
  resolveEvent(i) { resolveEvent(this, i); }

  // ---------- Nachrichten
  news(kind, text, mood = 'info', where = null) {
    this.pushNews({ kind, author: 'Stadtfunk', text, mood, x: where ? where.x : undefined, y: where ? where.y : undefined });
  }
  pushNews(n) {
    n.time = this.time;
    this.newsLog.push(n);
    if (this.newsLog.length > 80) this.newsLog.shift();
    this.emit('news', n);
  }

  // ---------- Hauptschleife
  update(realDt) {
    const mul = this.blocking ? 0 : SPEEDS[this.speed];
    const simSec = Math.min(realDt, 0.1) * mul;
    if (simSec > 0) {
      this.time += simSec * GAME_MIN_PER_SEC;
      let guard = 0;
      while (this.time >= this.nextStep && guard++ < 40) {
        this.simStep(10);
        this.nextStep += 10;
        if (this.blocking) break;
      }
      if (this.time > this.nextStep + 60) this.nextStep = this.time;
    }
    this.traffic.update(simSec);
    this.transit.update(simSec);
    return simSec;
  }

  simStep(minutes) {
    aggregate(this);
    updateDemand(this);
    growthStep(this);
    constructionStep(this, minutes);
    if (this.dirty.util) { computeUtilities(this); this.dirty.util = false; }
    this.transit.spawnPassengers(minutes);
    const t = this.nextStep;
    const hour = Math.floor(t / 60);
    if (hour !== this.lastHour) {
      this.lastHour = hour;
      this.hourly(hour % 24);
    }
    const day = Math.floor(t / DAY);
    if (day !== this.lastDay) {
      this.lastDay = day;
      this.daily(day);
    }
    this.emit('step');
  }

  hourly(h) {
    computeUtilities(this);
    if (this.dirty.coverage || h % 3 === 0) {
      computeCoverage(this);
      this.transit.applyCoverage();
      this.dirty.coverage = false;
    }
    if (h % 2 === 0) computeFields(this);
    computeHappiness(this);
    this.traffic.hourly();
    this.transit.hourly();
    hourlyFires(this);
    if (h % 6 === 0) this.pathCache.clear();
    if (this.rng() < 0.2) chatter(this);
    this.emit('hour', h);
  }

  daily(day) {
    dailyBuildings(this);
    dailyEconomy(this);
    this.transit.daily();
    // Trümmer verschwinden
    let rub = false;
    for (let i = 0; i < this.N; i++) {
      if (!this.rubble[i]) continue;
      this.rubble[i]--;
      if (!this.rubble[i]) { rub = true; if (this.zone[i] && !this.bld[i]) this.zoneFree[this.zone[i]].add(i); }
    }
    if (rub) { this._zoneDirty(); this.emit('rubbleChanged'); }
    // Effekte aufräumen
    const before = this.effects.length;
    this.effects = this.effects.filter((e) => e.until > this.time);
    if (this.effects.length !== before) this.emit('effects');
    // Durchschnittswerte für den Stadtfunk
    let pol = 0, cri = 0, hea = 0, n = 0, eduCity = 0;
    for (const b of this.buildings.values()) {
      if (b.zone === Z.RES && !b.abandoned) {
        const i = b.y * this.W + b.x;
        pol += this.fields.pollution[i]; cri += b.crime; hea += this.cov.health[i]; n++;
      }
      if (!b.zone && BUILDINGS[b.key]?.eduCity) eduCity += BUILDINGS[b.key].eduCity;
    }
    this.stats.pollutionAvg = n ? pol / n : 0;
    this.stats.crimeAvg = n ? cri / n : 0;
    this.stats.healthAvg = n ? hea / n : 1;
    this.stats.eduCity = eduCity;
    const s = this.stats;
    this.history.push({ d: day, pop: s.pop, money: Math.round(this.money), net: Math.round(this.lastBudget.net), inc: Math.round(this.lastBudget.income), exp: Math.round(this.lastBudget.expense), happy: Math.round(s.happiness), unemp: +(s.unemployment * 100).toFixed(1), riders: s.ridersToday, flow: Math.round(s.trafficFlow * 100), jobs: Math.round(s.jobs) });
    if (this.history.length > 400) this.history.shift();
    checkMilestones(this);
    maybeEvent(this);
    if (day % 7 === 0) this.weekly();
    this.emit('day', day);
  }

  weekly() {
    weeklyLoans(this);
    const net = this.weekIncome - this.weekExpense;
    if (this.week() > 1) this.news('report', `Wochenbilanz: ${net >= 0 ? '+' : ''}${fmtMoney(net)} (Einnahmen ${fmtMoney(this.weekIncome)}, Ausgaben ${fmtMoney(this.weekExpense)}).`, net >= 0 ? 'good' : 'bad');
    this.weekIncome = 0;
    this.weekExpense = 0;
    if (this.milestone >= 1) offerCards(this);
    this.emit('week');
  }

  budget() { return computeBudget(this); }
  maxLevelAt(x, y) { return maxLevelAt(this, x, y); }

  // ---------- Speichern / Laden
  serialize() {
    const bl = [];
    for (const b of this.buildings.values()) {
      bl.push([b.id, b.key, b.zone, b.x, b.y, b.w, b.h, b.rot, b.level, b.occ, b.variant, Math.round(b.happy), b.age, +b.edu.toFixed(3), Math.round(b.commute), +b.construct.toFixed(3), b.abandoned ? 1 : 0, b.abandonedDays, b.spec || '']);
    }
    return {
      v: VERSION,
      opts: this.opts,
      name: this.name,
      road: typedToB64(this.road), zone: typedToB64(this.zone), rubble: typedToB64(this.rubble), trees: typedToB64(this.world.trees),
      buildings: bl, nextId: this.nextId,
      time: this.time, money: this.money, speed: this.speed, taxes: this.taxes, policies: [...this.policies], milestone: this.milestone,
      mods: this.mods, effects: this.effects, loans: this.loans, cardCount: this.cardCount, cardsTaken: this.cardsTaken,
      vouchers: [...this.landmarkVouchers], nextEventDay: this.nextEventDay, lastEventId: this.lastEventId, debtDays: this.debtDays,
      history: this.history, news: this.newsLog.slice(-30), transit: this.transit.serialize(), savedAt: Date.now(),
      pop: this.stats.pop,
    };
  }

  static fromSave(data) {
    const g = new Game({ ...data.opts, name: data.name });
    g.road = b64ToTyped(data.road, Uint8Array);
    g.zone = b64ToTyped(data.zone, Uint8Array);
    g.rubble = b64ToTyped(data.rubble, Uint8Array);
    g.world.trees = b64ToTyped(data.trees, Uint8Array);
    g.nextId = data.nextId;
    g.buildings = new Map();
    g.bld.fill(0);
    for (const a of data.buildings) {
      const [id, key, zone, x, y, w, h, rot, level, occ, variant, happy, age, edu, commute, construct, abandoned, abandonedDays, spec] = a;
      const b = {
        id, key, zone, x, y, w, h, rot, level, cap: 0, occ, variant, happy, age, edu, commute, powered: false, watered: false, construct,
        abandoned: !!abandoned, abandonedDays, burning: 0, extinguishAt: 0, noPower: 0, noWater: 0, noRoad: 0, unhappyDays: 0, upCount: 0,
        spec: spec || null, access: -1, comp: -1, connected: false, crime: 0, transitShare: 0, load: 0,
      };
      if (zone) b.cap = capacityOf(b);
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) g.bld[yy * g.W + xx] = id;
      g.buildings.set(id, b);
    }
    Object.assign(g, {
      time: data.time, money: data.money, speed: data.speed || 1, taxes: data.taxes, policies: new Set(data.policies), milestone: data.milestone,
      mods: { ...g.mods, ...data.mods }, effects: data.effects || [], loans: data.loans || [], cardCount: data.cardCount || {}, cardsTaken: data.cardsTaken || [],
      landmarkVouchers: new Set(data.vouchers || []), nextEventDay: data.nextEventDay || 5, lastEventId: data.lastEventId, debtDays: data.debtDays || 0,
      history: data.history || [], newsLog: data.news || [],
    });
    g.nextStep = Math.ceil(g.time / 10) * 10 + 10;
    g.lastHour = Math.floor(g.time / 60);
    g.lastDay = Math.floor(g.time / DAY);
    for (let i = 0; i < g.N; i++) {
      if (g.zone[i] && !g.bld[i] && !g.road[i]) g.zoneFree[g.zone[i]].add(i);
    }
    g._zoneDirty();
    rebuildNetwork(g);
    g.transit.load(data.transit);
    aggregate(g);
    computeUtilities(g);
    computeCoverage(g);
    g.transit.applyCoverage();
    computeFields(g);
    computeHappiness(g);
    updateDemand(g);
    g.traffic.rebuildLists();
    g.lastBudget = computeBudget(g);
    return g;
  }
}

export { ZONE_INFO, hash2 };
