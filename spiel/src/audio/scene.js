// Hörort: Was ist unter und um die Kamera? Liefert ein flaches Objekt mit Pegeln 0..1, aus denen
// Umgebung und Musik ihre Mischung bilden. Reines JavaScript ohne WebAudio – läuft auch headless.
//
// Abgetastet wird ein Kreis um den Kamera-Zielpunkt; der Radius wächst mit dem Zoom (nah: eine Straße,
// fern: halbe Stadt). Jede Probe wird nach Abstand gewichtet. Pro Kategorie entstehen Anteil (0..1)
// und Richtung (Stereo-Position −1 links … +1 rechts, aus Sicht der Kamera).
import { BUILDINGS, ROADS, T } from '../config.js';
import { clamp } from './core.js';

const DEF_WEATHER = { season: 'summer', yearT: 0.5, temp: 19, rain: 0, snow: 0, snowCover: 0, cloud: 0.2, fog: 0, wind: 0.15, windDir: 0, lightning: 0, storm: false };
const CATS = ['traffic', 'highway', 'res', 'com', 'ind', 'off', 'construction', 'trees', 'park', 'water', 'rock', 'fire', 'abandoned', 'edge'];

// Klangquellen unter den Gebäuden (Schlüssel → Art). Unbekannte Schlüssel fallen auf die Kategorie zurück.
const POI_KEYS = {
  cathedral: 'bells', townhall: 'bells', castle: ['bells', 'fountain'], citygate: 'bells',
  stadium: 'crowd', arena: 'crowd', sports: 'crowd', themepark: ['crowd', 'musicbox'], fairground: ['crowd', 'musicbox'], zoo: 'crowd',
  swimming_pool: 'pool', beach: 'pool',
  plaza: 'fountain', pond_park: 'fountain', citypark: 'fountain', botanical: 'fountain',
  ferris: 'musicbox',
  doener: 'doener',
  coal: 'heavy', gas: 'heavy', nuclear: 'heavy', steelworks: 'heavy', refinery: 'heavy', incinerator: 'heavy',
  district_heating: 'heavy', sawmill: 'saw', food_factory: 'heavy', geothermal: 'heavy',
  cargo_rail: 'cargo', cargo_harbor: 'harbor', ferry_pier: 'harbor', lighthouse: 'lighthouse',
  airport: 'airport', train_station: 'railway',
  wind: 'turbine', windmill: 'turbine',
  school: 'school', highschool: 'school', kindergarten: 'school', playground: 'school',
  fire: 'firestation', firehq: 'firestation', hospital: 'hospital',
  cemetery: 'quiet', warning_siren: 'siren',
};
const POI_KINDS = ['farm', 'bells', 'crowd', 'pool', 'fountain', 'musicbox', 'doener', 'heavy', 'saw', 'cargo', 'harbor', 'lighthouse', 'airport', 'railway', 'turbine', 'school', 'firestation', 'hospital', 'quiet', 'siren'];
const VEH_KINDS = ['siren', 'pulsbahn', 'plane', 'heli', 'ship', 'bus', 'train', 'plow'];
const RENDER_KIND = {
  police: 'siren', fire: 'siren', ambulance: 'siren',
  plane: 'plane', helicopter: 'heli',
  ship_cargo: 'ship', ferry: 'ship', boat: 'ship', ship_cruise: 'ship',
  bus: 'bus', tram: 'bus',
  train_loco: 'train', snowplow: 'plow',
};

export function emptyScene() {
  const s = {
    t: 0, valid: false, paused: false, speed: 1,
    dist: 40, zoom: 0.4, radius: 12, fx: 0, fz: 0, yaw: 0,
    hour: 12, night: 0, dawn: 0, dusk: 0, weekday: 0, weekend: false,
    weather: { ...DEF_WEATHER },
    pop: 0, cityScale: 0, carsTotal: 0, trafficCity: 0, cars: 0,
    crisis: 0, crisisWhy: '', disaster: 0, burning: 0,
    poi: {}, veh: {}, pan: {},
  };
  for (const k of CATS) { s[k] = 0; s.pan[k] = 0; }
  for (const k of POI_KINDS) s.poi[k] = { p: 0, pan: 0, d: 999 };
  for (const k of VEH_KINDS) s.veh[k] = { p: 0, pan: 0, d: 999, vr: 0, n: 0 };
  return s;
}

const proximity = (d, R) => 1 / (1 + (d / (0.38 * R)) ** 2);

export class Listener {
  constructor() {
    this.s = emptyScene();
    this.poiList = [];
    this.poiDirty = true;
    this.poiAt = 0;
    this.crisisAt = -10;
    this.disasters = new Map(); // id → { intensity, until }
    this.prevVeh = {};
    this.lastT = 0;
  }

  markDirty() { this.poiDirty = true; }

  // Katastrophen-Meldungen (registry emit('disaster', …)) halten die Krise eine Weile hoch.
  disaster(ev, now) {
    const id = `${ev.type || '?'}@${ev.x | 0},${ev.y | 0}`;
    if (ev.phase === 'end') { this.disasters.delete(id); return; }
    const inten = clamp(ev.intensity == null ? 0.7 : +ev.intensity);
    this.disasters.set(id, { intensity: ev.phase === 'warn' ? inten * 0.6 : inten, until: now + (ev.phase === 'warn' ? 40 : 60) });
  }

  rebuildPoi(g) {
    const list = [];
    for (const b of g.buildings.values()) {
      if (b.zone) {
        if (b.spec === 'mine' || b.spec === 'oil') list.push({ kind: 'heavy', x: b.x + b.w / 2, y: b.y + b.h / 2, b });
        else if (b.spec === 'farm') list.push({ kind: 'farm', x: b.x + b.w / 2, y: b.y + b.h / 2, b });
        else if (b.spec === 'forest') list.push({ kind: 'saw', x: b.x + b.w / 2, y: b.y + b.h / 2, b });
        continue;
      }
      const kind = POI_KEYS[b.key] || (BUILDINGS[b.key] && BUILDINGS[b.key].cat === 'industry' ? 'cargo' : null);
      if (!kind) continue;
      for (const k of Array.isArray(kind) ? kind : [kind]) list.push({ kind: k, x: b.x + b.w / 2, y: b.y + b.h / 2, b });
    }
    this.poiList = list;
    this.poiDirty = false;
  }

  // Hauptfunktion: g = Spiel, engine = Engine (rig.cur, night), now = Sekunden (beliebige Uhr)
  sample(g, engine, now) {
    const s = this.s;
    const dtA = Math.min(1, Math.max(0.05, now - this.lastT || 0.2));
    this.lastT = now;
    const cur = engine && engine.rig ? engine.rig.cur : { x: 0, z: 0, dist: 40, yaw: 0.7 };
    const W = g.W, H = g.H;
    s.t = now;
    s.valid = true;
    s.dist = cur.dist;
    s.zoom = clamp(1 - Math.log(Math.max(6, cur.dist) / 6) / Math.log(110 / 6));
    s.yaw = cur.yaw;
    s.fx = cur.x + W / 2; s.fz = cur.z + H / 2;
    const R = (s.radius = clamp(3 + cur.dist * 0.32, 4, 26));
    s.speed = g.speed;
    s.paused = g.speed === 0 || !!g.blocking;

    // Zeit und Wetter
    s.hour = g.hour();
    s.night = engine && engine.night != null ? engine.night : (s.hour < 6 || s.hour > 20.5 ? 1 : 0);
    s.dawn = Math.exp(-0.5 * ((s.hour - 6.3) / 1.2) ** 2);
    s.dusk = Math.exp(-0.5 * ((s.hour - 19.5) / 1.3) ** 2);
    s.weekday = g.weekday();
    s.weekend = s.weekday >= 5;
    const w = (g.ext && g.ext.weather) || {};
    const wo = s.weather;
    for (const k in DEF_WEATHER) wo[k] = w[k] != null ? w[k] : DEF_WEATHER[k];
    wo.storm = !!w.storm;

    // Stadtgröße
    s.pop = g.stats.pop || 0;
    s.cityScale = clamp(Math.log10(s.pop + 1) / 4.8);
    s.carsTotal = g.traffic.cars.length;
    s.trafficCity = clamp(s.carsTotal / 500);

    // Rechts-Vektor der Kamera in Weltkoordinaten
    const ry = Math.cos(cur.yaw), rz = -Math.sin(cur.yaw);
    const panOf = (dx, dz) => clamp((dx * ry + dz * rz) / Math.max(4, R * 0.7), -1, 1);

    // Felder abtasten
    const acc = {}, pan = {};
    for (const k of CATS) { acc[k] = 0; pan[k] = 0; }
    let wsum = 0;
    const step = R > 14 ? 2 : 1;
    const r0 = Math.ceil(R);
    const fxc = Math.floor(s.fx), fzc = Math.floor(s.fz);
    const terrain = g.world.terrain, trees = g.world.trees;
    for (let oy = -r0; oy <= r0; oy += step) {
      for (let ox = -r0; ox <= r0; ox += step) {
        const d = Math.hypot(ox, oy);
        if (d > R) continue;
        const wgt = proximity(d, R);
        wsum += wgt;
        const x = fxc + ox, y = fzc + oy;
        const p = panOf(ox, oy);
        const add = (k, v) => { acc[k] += wgt * v; pan[k] += wgt * v * p; };
        if (x < 0 || y < 0 || x >= W || y >= H) { add('edge', 1); continue; }
        const i = y * W + x;
        const ter = terrain[i];
        if (ter === T.WATER) add('water', 1);
        else if (ter === T.ROCK) add('rock', 1);
        if (trees[i]) add('trees', trees[i] / 3);
        const r = g.road[i];
        if (r) {
          const load = g.trafficLoad[i] / ROADS[r].capacity;
          add('traffic', clamp(0.15 + load * 1.4, 0, 1.6));
          if (r === 4) add('highway', 1);
        }
        const id = g.bld[i];
        if (id) {
          const b = g.buildings.get(id);
          if (!b) continue;
          if (b.burning) add('fire', 1);
          if (b.construct < 1) { add('construction', 1); continue; }
          if (b.abandoned) { add('abandoned', 1); continue; }
          const fill = b.cap ? clamp(0.25 + (b.occ / b.cap) * 0.9) : 0.6;
          if (b.zone === 1) add('res', fill);
          else if (b.zone === 2) add('com', fill);
          else if (b.zone === 3) add('ind', b.spec === 'farm' ? 0.25 : fill);
          else if (b.zone === 4) add('off', fill);
          else {
            const def = BUILDINGS[b.key];
            const cat = def ? def.cat : '';
            if (cat === 'parks') add('park', 1);
            else if (cat === 'power' || cat === 'garbage' || cat === 'industry') add('ind', b.key === 'solar' || b.key === 'wind' || b.key === 'battery' ? 0.15 : 0.8);
            else if (cat === 'water') add('ind', 0.35);
            else if (def && def.park) add('park', def.park);
            else add('com', 0.3);
          }
        }
      }
    }
    const inv = wsum > 0 ? 1 / wsum : 0;
    for (const k of CATS) {
      const a = acc[k] * inv;
      s[k] = clamp(k === 'traffic' ? a * 1.6 : k === 'water' || k === 'trees' || k === 'edge' ? a * 1.25 : a * 1.8);
      s.pan[k] = acc[k] > 1e-6 ? clamp(pan[k] / acc[k], -1, 1) : 0;
    }
    s.burning = g.stats.burning || 0;

    // Autos in der Nähe (für vorbeifahrende Wagen) und Einsatzfahrzeuge
    const wx = cur.x, wz = cur.z;
    let near = 0;
    const best = {};
    for (const k of VEH_KINDS) best[k] = { d: 1e9, dx: 0, dz: 0, n: 0 };
    const consider = (kind, x, z) => {
      const dx = x - wx, dz = z - wz;
      const d = Math.hypot(dx, dz);
      const bk = best[kind];
      if (d < R * 2.2) bk.n++;
      if (d < bk.d) { bk.d = d; bk.dx = dx; bk.dz = dz; }
    };
    const cars = g.traffic.cars;
    const R2 = R * R;
    for (let k = 0; k < cars.length; k++) {
      const c = cars[k];
      const dx = c.x - wx, dz = c.z - wz;
      const d2 = dx * dx + dz * dz;
      if (d2 < R2) near += 1 / (1 + d2 / (0.2 * R2));
      if (c.type === 3 || c.type === 4) consider('siren', c.x, c.z);
    }
    s.cars = clamp(near / (2 + 0.08 * R * R)); // Dichte: erwartete Anzahl wächst mit der Fläche
    for (const t of g.transit.trains) if (t.state !== 'dwell' && t.x != null) consider('pulsbahn', t.x, t.z);
    let rend = null;
    try { rend = g.renderables ? g.renderables() : null; } catch (e) { rend = null; }
    if (rend) for (const o of rend) { const kind = RENDER_KIND[o.kind]; if (kind && o.x != null) consider(kind, o.x, o.z); }
    for (const k of VEH_KINDS) {
      const bk = best[k], o = s.veh[k];
      const prev = this.prevVeh[k];
      const range = k === 'plane' ? R * 3 + 20 : k === 'heli' || k === 'ship' || k === 'train' ? R * 2 + 8 : R * 1.6 + 4;
      o.d = bk.d;
      o.n = bk.n;
      o.p = bk.d < range ? clamp(1 / (1 + (bk.d / (0.3 * range)) ** 2)) : 0;
      o.pan = o.p > 0 ? panOf(bk.dx, bk.dz) : 0;
      o.vr = prev != null && bk.d < 1e8 && prev < 1e8 ? clamp((bk.d - prev) / dtA, -20, 20) : 0;
      this.prevVeh[k] = bk.d < 1e8 ? bk.d : null;
    }

    // Klangquellen unter den Sondergebäuden
    if (this.poiDirty || now - this.poiAt > 5) { this.rebuildPoi(g); this.poiAt = now; }
    for (const k of POI_KINDS) { const o = s.poi[k]; o.p = 0; o.pan = 0; o.d = 999; }
    for (const q of this.poiList) {
      const dx = q.x - s.fx, dz = q.y - s.fz;
      const d = Math.hypot(dx, dz);
      const o = s.poi[q.kind];
      if (d < o.d) {
        o.d = d;
        const range = q.kind === 'bells' || q.kind === 'airport' || q.kind === 'siren' || q.kind === 'lighthouse' ? R * 3 + 30 : q.kind === 'heavy' || q.kind === 'crowd' || q.kind === 'railway' ? R * 1.8 + 6 : R * 1.2 + 2;
        o.p = d < range ? clamp(1 / (1 + (d / (0.3 * range)) ** 2)) : 0;
        o.pan = panOf(dx, dz);
      }
    }

    // Krise (1×/s): Brände, Katastrophen, Schulden, Versorgungslücken, Unmut, Sturm
    if (now - this.crisisAt >= 1) {
      this.crisisAt = now;
      let c = 0, why = '';
      const up = (v, w2) => { if (v > c) { c = v; why = w2; } };
      if (s.burning) up(clamp(0.3 + s.burning * 0.1, 0, 0.8), 'Feuer');
      let dis = 0;
      for (const [id, d] of this.disasters) { if (d.until < now) this.disasters.delete(id); else dis = Math.max(dis, d.intensity); }
      s.disaster = dis;
      if (dis > 0) up(0.55 + dis * 0.45, 'Katastrophe');
      if (!g.sandbox && g.money < 0) up(clamp(0.35 + (g.debtDays || 0) * 0.04, 0, 0.75), 'Schulden');
      const u = g.util || {};
      let extra = 0;
      if (u.powerDemand > 0 && u.powerDemand > u.powerSupply * 1.03) extra += 0.18;
      if (u.waterDemand > 0 && u.waterDemand > u.waterSupply * 1.03) extra += 0.14;
      const hap = g.stats.happiness;
      if (s.pop > 50 && hap < 45) extra += (45 - hap) / 45 * 0.3;
      if (s.pop > 300 && g.stats.trafficFlow < 0.55) extra += 0.08;
      if (wo.storm) extra += 0.25;
      if (extra > 0) up(clamp(c + extra), why || 'Versorgung');
      s.crisis = clamp(c);
      s.crisisWhy = s.crisis > 0.05 ? why : '';
    }
    return s;
  }
}

// Kurzform für Tests: Szene ohne Engine (Kamera mittig).
export function sceneFor(g, cam = {}) {
  const l = new Listener();
  const engine = { rig: { cur: { x: cam.x || 0, z: cam.z || 0, dist: cam.dist || 30, yaw: cam.yaw || 0.7 } }, night: cam.night };
  return l.sample(g, engine, 0);
}

export const SCENE_KEYS = { CATS, POI_KINDS, VEH_KINDS };
