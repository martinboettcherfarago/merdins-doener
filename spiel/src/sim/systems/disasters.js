// System „Katastrophen" (Besitzer S4). Hochwasser, Orkan, Tornado, Erdbeben, Blitzeinschlag, Waldbrand, Meteorit.
// Ablauf: Planung (Tage voraus) → Vorwarnung (Wetterstation, Sternwarte, Sirenen) → Vorbereitung (Sandsäcke, Sicherung,
// Evakuierung) → Ereignis → Schäden (Trümmer, beschädigte Gebäude = Baustellen) → Rettung → Aufräumen → Wiederaufbau.
// Zustand in g.ext.disasters (wird gespeichert). Meldet emit('disaster', { type, phase: 'warn'|'start'|'update'|'end',
// x, y, radius, intensity, id, name, eta? }) aus registry.js. Läuft headless (keine Imports aus render/ui).
import { registerSystem, HAPPINESS_FACTORS, DEMAND_MODIFIERS, BUDGET_LINES, BUILDING_PROBLEMS, emit } from '../../registry.js';
import { BUILDINGS, DAY, Z, T, R } from '../../config.js';
import { clamp, fmtMoney } from '../../util.js';
import { forDisc } from '../services.js';
import { EVENTS } from '../progress.js';
import { forceDay, dayPlan, calendar } from './weather.js';

export const DISASTERS = {
  flood: { name: 'Hochwasser', short: 'Flut', minPop: 400, weather: true, color: '#3f8fd0' },
  storm: { name: 'Orkan', short: 'Orkan', minPop: 300, weather: true, color: '#7d8fa8' },
  tornado: { name: 'Tornado', short: 'Tornado', minPop: 1200, weather: true, color: '#6f6a86' },
  quake: { name: 'Erdbeben', short: 'Beben', minPop: 1500, color: '#a0703c' },
  lightning: { name: 'Blitzeinschlag', short: 'Blitz', minor: true, color: '#e9c42c' },
  wildfire: { name: 'Waldbrand', short: 'Feuer', minPop: 300, weather: true, color: '#e0662a' },
  meteor: { name: 'Meteorit', short: 'Meteor', minPop: 3000, color: '#d4433a' },
};
export const FREQS = [
  { id: 'off', name: 'Aus', mul: 0 },
  { id: 'rare', name: 'Selten', mul: 0.45 },
  { id: 'normal', name: 'Normal', mul: 1 },
  { id: 'often', name: 'Häufig', mul: 2.2 },
];
// Vorbereitungen während einer Warnung
export const PREP = {
  sandbags: { name: 'Sandsäcke', desc: 'Der Pegel bleibt um 40 % niedriger.', types: ['flood'], cost: (g, p) => 2500 + (p.est || 20) * 40 },
  secure: { name: 'Sturmsicherung', desc: 'Dächer und Leitungen sichern: 40 % weniger Schäden, kein Stromausfall.', types: ['storm', 'tornado'], cost: () => 3500 },
  firebreak: { name: 'Brandschneisen', desc: 'Das Feuer breitet sich nur halb so schnell aus.', types: ['wildfire'], cost: () => 2500 },
  evacuate: { name: 'Evakuieren', desc: 'Alle im Gefahrengebiet bringen sich in Sicherheit: keine Verletzten, keine Verschütteten.', types: ['flood', 'tornado', 'meteor', 'wildfire'], cost: (g, p) => 800 + (p.residents || 0) * 2 },
  teams: { name: 'Einsatzkräfte bereitstellen', desc: 'Rettung doppelt so schnell, Aufräumen und Reparatur schneller.', types: ['flood', 'storm', 'tornado', 'quake', 'wildfire', 'meteor'], cost: () => 2000 },
};
const PRIMARY = { flood: 'sandbags', storm: 'secure', tornado: 'secure', wildfire: 'firebreak', meteor: 'evacuate', quake: 'teams' };
const RUBBLE_DAYS = 10;
const DUR = { flood: 1800, storm: 720, tornado: 840, quake: 150, meteor: 460, wildfire: 5760 };

// ---------- Zufall mit speicherbarem Zustand (unabhängig vom Spielzufall)
function rnd(st) {
  let a = (st.rs = (st.rs + 0x6d2b79f5) >>> 0);
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Flüchtige Felder (pro Spiel, werden bei Bedarf neu berechnet)
const INTERNAL = new WeakMap();
function I_(g) {
  let I = INTERNAL.get(g);
  if (!I) {
    I = { siren: new Float32Array(g.N), damage: new Float32Array(g.N), protect: new Float32Array(g.N), flooded: new Map(), fieldsAt: -1, cityBox: null, boxDay: -1, protection: 0 };
    INTERNAL.set(g, I);
  }
  return I;
}

function freshState(g) {
  let freq = g.opts.disasters;
  if (!FREQS.find((f) => f.id === freq)) freq = g.sandbox ? 'off' : g.difficulty === 'relaxed' ? 'rare' : 'normal';
  if (g.sandboxNoEvents) freq = 'off';
  return {
    freq, autoRebuild: true, rs: ((g.opts.seed || 7) * 40503 + 977) >>> 0, seq: 1,
    planned: [], active: [], ops: [], repairs: {}, rubble: [], ruins: [], strikes: [], craters: [], scorch: [], mud: [],
    history: [], homeless: 0, displaced: 0, sheltered: 0, shelterCap: 0, fear: 0, mourn: 0, cooldown: 0, rubbleCount: 0,
    totals: { destroyed: 0, damaged: 0, rescued: 0, lost: 0, cost: 0, aid: 0 }, prompt: null, lastWildCheck: -1,
  };
}

// ---------- Helfer
const tileOf = (g, x, y) => clamp(Math.floor(y), 0, g.H - 1) * g.W + clamp(Math.floor(x), 0, g.W - 1);
const bCenter = (b) => [b.x + b.w / 2, b.y + b.h / 2];
const isLandmark = (b) => !b.zone && BUILDINGS[b.key] && (BUILDINGS[b.key].landmark || BUILDINGS[b.key].unique);
const countBuilt = (g, key) => { let n = 0; for (const b of g.buildings.values()) if (b.key === key && b.construct >= 1 && !b.abandoned) n++; return n; };
export const stationCount = (g) => countBuilt(g, 'weather_station');
export function forecastDays(g) { const n = stationCount(g); return n >= 2 ? 7 : n >= 1 ? 5 : 1; }

function cityBox(g) {
  const I = I_(g);
  if (I.cityBox && I.boxDay === g.day() && I.boxN === g.buildings.size) return I.cityBox;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, n = 0;
  for (const b of g.buildings.values()) {
    if (!b.zone) continue;
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); n++;
  }
  if (!n) { const hy = g.world.highwayY, hx = g.world.highwayEnd % g.W; x0 = hx; x1 = hx + 20; y0 = hy - 10; y1 = hy + 10; }
  I.cityBox = { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, n };
  I.boxDay = g.day(); I.boxN = g.buildings.size;
  return I.cityBox;
}

function buildingsNear(g, cx, cy, r) {
  const seen = new Set(), out = [];
  forDisc(g, cx, cy, r + 1.5, (t) => {
    const id = g.bld[t];
    if (!id || seen.has(id)) return;
    seen.add(id);
    const b = g.buildings.get(id);
    if (!b) return;
    const [bx, by] = bCenter(b);
    const d = Math.max(0, Math.hypot(bx - cx, by - cy) - Math.min(b.w, b.h) * 0.35);
    if (d <= r) out.push([b, d]);
  });
  return out;
}
function residentsNear(g, cx, cy, r) {
  let n = 0;
  for (const [b] of buildingsNear(g, cx, cy, r)) if (b.zone === Z.RES) n += b.occ;
  return n;
}

function vuln(b, type) {
  if (isLandmark(b)) return 0.45;
  if (!b.zone) {
    if (b.key === 'disaster_center' || b.key === 'shelter') return 0.3;
    return type === 'quake' ? 0.75 : 0.6;
  }
  const L = b.level;
  if (type === 'storm' || type === 'tornado') return [0, 1.3, 1.1, 0.9, 0.75, 0.7][L];
  if (type === 'flood') return [0, 1.2, 1.1, 0.9, 0.8, 0.75][L];
  return [0, 1.25, 1.1, 0.95, 0.85, 0.8][L];
}

const budgetMul = (g) => g.serviceBudget.safety ?? 1;
// Strom- und Wasserbauten werden zuerst repariert und nur durch direkte Treffer zerstört
const isUtility = (b) => !b.zone && BUILDINGS[b.key] && (BUILDINGS[b.key].cat === 'power' || BUILDINGS[b.key].cat === 'water');
const disasterCenters = (g) => { const out = []; for (const b of g.buildings.values()) if (b.key === 'disaster_center' && b.construct >= 1 && !b.abandoned) out.push(b); return out; };

// ---------- Felder: Sirenen, Schutz, Schäden in der Nachbarschaft
function updateFields(g) {
  const I = I_(g), st = g.ext.disasters;
  if (I.siren.length !== g.N) { I.siren = new Float32Array(g.N); I.damage = new Float32Array(g.N); I.protect = new Float32Array(g.N); }
  const s = I.siren;
  s.fill(0);
  let shelterCap = 0;
  for (const b of g.buildings.values()) {
    if (b.construct < 1 || b.abandoned) continue;
    const d = BUILDINGS[b.key];
    if (!d || b.zone) continue;
    if (d.warnRadius) forDisc(g, b.x + 0.5, b.y + 0.5, d.warnRadius, (t) => { s[t] = 1; });
    if (d.shelterCap) shelterCap += d.shelterCap * (b.powered ? 1 : 0.7);
  }
  st.shelterCap = Math.round(shelterCap);
  const p = I.protect, cd = g.cov.disaster;
  let wSum = 0, pSum = 0;
  for (let i = 0; i < g.N; i++) p[i] = Math.min(1, s[i] * 0.4 + (cd ? cd[i] : 0) * 0.6);
  for (const b of g.buildings.values()) {
    if (b.zone !== Z.RES || !b.occ) continue;
    wSum += b.occ; pSum += b.occ * p[b.y * g.W + b.x];
  }
  const pop = Math.max(1, g.stats.pop);
  const shelterOk = clamp(shelterCap / (pop * 0.12 + 1), 0, 1);
  I.protection = clamp((wSum ? pSum / wSum : 0) * 0.65 + shelterOk * 0.2 + (stationCount(g) ? 0.15 : 0), 0, 1);
  I.fieldsAt = g.time;
}
export function protectionScore(g) { return I_(g).protection; }
export function sirenAt(g, i) { return I_(g).siren[i] || 0; }
function addDamageField(g, b, v) {
  const I = I_(g);
  const [cx, cy] = bCenter(b);
  forDisc(g, cx, cy, 4.5, (t, d) => { I.damage[t] = Math.min(2, I.damage[t] + v * (1 - d / 5)); });
}

// ---------- Schäden
function repairHours(b, sev) { return (b.zone ? 22 + 50 * sev : 16 + 40 * sev); }
function repairCost(g, b, sev) {
  if (b.zone) return 160 * b.level * b.w * b.h * (0.4 + sev);
  const d = BUILDINGS[b.key];
  return (d ? d.cost : 3000) * 0.22 * (0.4 + sev) * Math.max(0.6, g.costMul || 1);
}
export function damageBuilding(g, b, sev, a) {
  const st = g.ext.disasters;
  if (!g.buildings.has(b.id)) return;
  if (b.abandoned) { destroyBuilding(g, b, a); return; }
  sev = clamp(sev, 0.1, 1);
  const hours = repairHours(b, sev);
  const target = 1 - (0.25 + 0.65 * sev);
  const rec = st.repairs[b.id];
  if (rec) {
    rec.left = Math.max(rec.left, hours); rec.total = Math.max(rec.total, rec.left); rec.sev = Math.max(rec.sev, sev);
    rec.from = Math.min(rec.from, target); rec.cost += repairCost(g, b, sev) * 0.5;
  } else st.repairs[b.id] = { left: hours, total: hours, sev, cause: a ? a.type : 'unknown', cost: repairCost(g, b, sev), from: Math.min(b.construct, target), teams: !!(a && a.prep && a.prep.teams) };
  b.construct = Math.min(b.construct, target);
  if (b.burning && sev > 0.6) g.extinguish(b);
  g.emit('buildingUpdated', b);
  g.dirty.util = g.dirty.coverage = true;
  if (a) { a.stats.damaged++; a.stats.cost += repairCost(g, b, sev); }
  st.totals.damaged++;
  addDamageField(g, b, 0.45 * sev);
}

function warnFactor(g, a, b) {
  if (!a) return 0;
  const i = b.y * g.W + b.x;
  if (a.prep && a.prep.evacuate) return 1;
  let f = a.known ? (a.lead >= 360 ? 0.45 : 0.25) : 0;
  if (I_(g).siren[i] > 0) f = Math.max(f, a.known || a.type !== 'quake' ? 0.8 : 0.5);
  return Math.min(0.95, f);
}

export function destroyBuilding(g, b, a, direct = false) {
  const st = g.ext.disasters;
  if (!g.buildings.has(b.id)) return;
  if (isLandmark(b)) { damageBuilding(g, b, 1, a); return; }
  // Dienstgebäude halten viel aus: meist nur schwer beschädigt
  if (!b.zone && !direct && rnd(st) < (isUtility(b) ? 0.85 : 0.55)) { damageBuilding(g, b, 0.85 + rnd(st) * 0.15, a); return; }
  const occ = b.zone ? b.occ : 0;
  const wf = warnFactor(g, a, b);
  const trapped = Math.round(occ * 0.14 * (1 - wf));
  const injured = Math.round(occ * 0.22 * (1 - wf));
  if (a) {
    const op = opFor(g, a, b);
    op.trapped += trapped; op.injured += injured;
    a.stats.destroyed++;
    a.stats.cost += b.zone ? 900 * b.level * b.w * b.h : (BUILDINGS[b.key]?.cost || 3000) * 0.5;
  }
  if (b.zone === Z.RES) st.homeless += Math.max(0, occ - trapped);
  if (!b.zone) st.ruins.push({ key: b.key, x: b.x, y: b.y, rot: b.rot, day: g.day(), cause: a ? a.type : 'unknown', name: BUILDINGS[b.key]?.name || b.key });
  delete st.repairs[b.id];
  addDamageField(g, b, 1);
  st._removing = b.id;
  g.removeBuilding(b, { rubble: true });
  st._removing = 0;
  for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) {
    const i = yy * g.W + xx;
    g.rubble[i] = RUBBLE_DAYS;
    st.rubble.push(i);
  }
  st.totals.destroyed++;
}

function opFor(g, a, b) {
  const st = g.ext.disasters;
  let op = st.ops.find((o) => o.id === a.id);
  if (!op) {
    const [bx, by] = b ? bCenter(b) : [a.x, a.y];
    op = { id: a.id, type: a.type, x: bx, y: by, trapped: 0, rescued: 0, lost: 0, injured: 0, treated: 0, t0: g.time, teams: !!(a.prep && a.prep.teams) };
    st.ops.push(op);
  }
  return op;
}

function removeTrees(g, cx, cy, r, share = 1) {
  let any = false;
  const st = g.ext.disasters;
  forDisc(g, cx, cy, r, (t) => {
    if (g.world.trees[t] && rnd(st) < share) { g.world.trees[t] = 0; any = true; }
  });
  return any;
}

// ---------- Planung
function pickType(g, st) {
  const w = g.ext.weather || {};
  const s = w.season || 'summer';
  const pop = g.stats.pop;
  const nearWater = waterRiskCount(g);
  let forest = 0;
  for (let i = 0; i < g.N; i += 3) if (g.world.trees[i] >= 2) forest++;
  const W = {
    flood: nearWater >= 3 ? { spring: 3, summer: 0.8, autumn: 2.2, winter: 0.8 }[s] * (1 + (w.snowCover || 0)) : 0,
    storm: { spring: 1, summer: 0.6, autumn: 3, winter: 2.4 }[s],
    tornado: pop >= DISASTERS.tornado.minPop ? { spring: 1.4, summer: 2, autumn: 0.4, winter: 0 }[s] : 0,
    quake: pop >= DISASTERS.quake.minPop ? 0.8 * (g.world.type === 'mountains' ? 2 : 1) : 0,
    wildfire: forest > 25 ? { spring: 0.4, summer: 2.8, autumn: 0.5, winter: 0 }[s] * (0.3 + (w.dry || 0) * 1.5) : 0,
    meteor: pop >= DISASTERS.meteor.minPop ? 0.25 : 0,
  };
  for (const k of Object.keys(W)) if (pop < (DISASTERS[k].minPop || 0)) W[k] = 0;
  const tot = Object.values(W).reduce((x, y) => x + y, 0);
  if (tot <= 0) return null;
  let r = rnd(st) * tot;
  for (const [k, v] of Object.entries(W)) { r -= v; if (r <= 0 && v > 0) return k; }
  return null;
}

function waterRiskCount(g) {
  let n = 0;
  for (const b of g.buildings.values()) { const i = b.y * g.W + b.x; if (g.world.waterDist[i] <= 3) n++; }
  return n;
}

function pickLocation(g, st, type) {
  const box = cityBox(g);
  const zb = [...g.buildings.values()].filter((b) => b.zone);
  const randB = () => zb.length ? zb[Math.floor(rnd(st) * zb.length)] : null;
  if (type === 'flood') {
    // Ufer mit den meisten Gebäuden in der Nähe
    let best = null, bestN = -1;
    for (let k = 0; k < 220; k++) {
      const x = Math.floor(box.x0 - 8 + rnd(st) * (box.x1 - box.x0 + 16)), y = Math.floor(box.y0 - 8 + rnd(st) * (box.y1 - box.y0 + 16));
      if (x < 0 || y < 0 || x >= g.W || y >= g.H) continue;
      const i = y * g.W + x;
      if (g.world.terrain[i] !== T.WATER) continue;
      let n = 0;
      for (const [b] of buildingsNear(g, x + 0.5, y + 0.5, 9)) n += b.zone ? 1 : 0.5;
      if (n > bestN) { bestN = n; best = [x + 0.5, y + 0.5]; }
    }
    if (!best) {
      for (let i = 0; i < g.N; i++) if (g.world.terrain[i] === T.WATER) { best = [i % g.W + 0.5, Math.floor(i / g.W) + 0.5]; break; }
    }
    return best ? { x: best[0], y: best[1], r: 12 } : null;
  }
  if (type === 'storm') return { x: box.cx, y: box.cy, r: Math.max(box.x1 - box.x0, box.y1 - box.y0) * 0.6 + 8 };
  if (type === 'tornado') { const b = randB(); return b ? { x: b.x + 0.5, y: b.y + 0.5, r: 2 } : { x: box.cx, y: box.cy, r: 2 }; }
  if (type === 'quake') { const b = randB(); const x = (b ? b.x : box.cx) + (rnd(st) - 0.5) * 6, y = (b ? b.y : box.cy) + (rnd(st) - 0.5) * 6; return { x: clamp(x, 2, g.W - 2), y: clamp(y, 2, g.H - 2), r: 14 }; }
  if (type === 'meteor') {
    if (rnd(st) < 0.6) { const b = randB(); if (b) return { x: b.x + 0.5 + (rnd(st) - 0.5) * 6, y: b.y + 0.5 + (rnd(st) - 0.5) * 6, r: 2.5 }; }
    return { x: 4 + rnd(st) * (g.W - 8), y: 4 + rnd(st) * (g.H - 8), r: 2.5 };
  }
  if (type === 'wildfire') {
    let best = null, bestD = 1e9;
    for (let k = 0; k < 400; k++) {
      const i = Math.floor(rnd(st) * g.N);
      if (g.world.trees[i] < 2) continue;
      const x = i % g.W, y = Math.floor(i / g.W);
      const d = Math.abs(Math.hypot(x - box.cx, y - box.cy) - (Math.max(box.x1 - box.x0, box.y1 - box.y0) * 0.5 + 6));
      if (d < bestD) { bestD = d; best = { x: x + 0.5, y: y + 0.5, r: 6 }; }
    }
    return best;
  }
  return { x: box.cx, y: box.cy, r: 4 };
}

export function planDisaster(g, type, opts = {}) {
  const st = g.ext.disasters;
  const loc = opts.x !== undefined ? { x: opts.x, y: opts.y, r: opts.r || 6 } : pickLocation(g, st, type);
  if (!loc) return null;
  const intensity = clamp(opts.intensity ?? 0.45 + rnd(st) * 0.55, 0.1, 1);
  const at = opts.at ?? g.time + (opts.lead ?? 30);
  const p = {
    id: st.seq++, type, name: DISASTERS[type].name, x: loc.x, y: loc.y, r: loc.r, intensity, at, known: false, warned: false, siren: false,
    prompted: false, prep: {}, data: {}, aftershock: !!opts.aftershock, manual: !!opts.manual,
  };
  if (type === 'flood') { p.est = floodTiles(g, p, true).length / 2; }
  p.residents = residentsNear(g, p.x, p.y, type === 'storm' ? p.r : type === 'flood' ? 10 : type === 'wildfire' ? 8 : 6);
  // Wetterlage passend machen
  const d = Math.floor(at / DAY), h = (at % DAY) / 60;
  if (DISASTERS[type].weather && g.ext.weather && !opts.noWeather) {
    if (type === 'storm') {
      forceDay(g, d, 'storm', { wind: 0.86 + intensity * 0.12, reason: 'storm' });
      if (h + (DUR.storm * 1.15) / 60 > 24) forceDay(g, d + 1, 'storm', { wind: 0.7, reason: 'storm' });
    } else if (type === 'tornado') forceDay(g, d, 'thunder', { stormAt: clamp(h - 0.5, 0, 23), len: DUR.tornado / 60 + 0.8, intensity: 1, reason: 'tornado' });
    else if (type === 'flood') { for (let k = 2; k >= 0; k--) forceDay(g, d - k, 'rain', { heavy: intensity * (k === 0 ? 1 : 0.8), reason: 'flood' }); }
    else if (type === 'wildfire') { for (let k = 0; k <= 1; k++) forceDay(g, d - k, 'heat', { dry: true, reason: 'wildfire' }); }
  }
  st.planned.push(p);
  return p;
}
// Für Sandkasten, Tests und Skripte: Katastrophe sofort (bzw. nach lead Minuten) auslösen
export function triggerDisaster(g, type, opts = {}) {
  if (!DISASTERS[type]) return null;
  if (type === 'lightning') return strike(g, opts.x, opts.y, true);
  const p = planDisaster(g, type, { lead: 0, manual: true, ...opts });
  if (p) { p.known = true; p.lead = opts.lead || 0; p.prompted = true; }
  return p;
}

function leadTime(g, p) {
  if (p.aftershock) return 0;
  const fc = stationCount(g);
  const fcDays = fc >= 2 ? 7 : fc >= 1 ? 5 : 0;
  switch (p.type) {
    case 'flood': case 'storm': return fcDays ? fcDays * DAY : 150;
    case 'tornado': return fcDays ? 1.5 * DAY : 60;
    case 'wildfire': return fcDays ? 2 * DAY : 0;
    case 'quake': return g.hasBuilt('disaster_center') && countBuilt(g, 'warning_siren') ? 25 : 0;
    case 'meteor': return g.hasBuilt('observatory') ? 3 * DAY : 50;
    default: return 0;
  }
}

function enabled(g) { const f = FREQS.find((x) => x.id === g.ext.disasters.freq); return f ? f.mul : 0; }

function dailyPlanning(g, day) {
  const st = g.ext.disasters;
  const mul = enabled(g);
  if (!mul || g.sandboxNoEvents) return;
  if (day < 30 || g.stats.pop < 800 || day < st.cooldown) return;
  if (st.planned.some((p) => !p.aftershock) || st.active.some((a) => a.type !== 'wildfire' || a.data.burning?.length > 0)) return;
  const popScale = g.stats.pop < 1000 ? 0.6 : g.stats.pop < 3000 ? 0.85 : 1;
  if (rnd(st) > (mul / 16) * popScale) return;
  const type = pickType(g, st);
  if (!type) return;
  // 2–4 Tage voraus, tagsüber
  const lead = (2 + Math.floor(rnd(st) * 3)) * DAY;
  const at = (Math.floor(g.time / DAY) * DAY) + lead + (8 + rnd(st) * 10) * 60;
  planDisaster(g, type, { at });
}

// ---------- Warnung und Vorbereitung
export function prepCost(g, p, key) { return Math.round(PREP[key].cost(g, p) * (g.sandbox ? 0 : Math.max(0.6, g.costMul || 1))); }
export function prepOptions(p) { return Object.keys(PREP).filter((k) => PREP[k].types.includes(p.type)); }
export function doPrep(g, id, key) {
  const st = g.ext.disasters;
  const p = st.planned.find((x) => x.id === id) || st.active.find((x) => x.id === id);
  if (!p || !PREP[key] || p.prep[key] || !PREP[key].types.includes(p.type)) return { ok: false, msg: 'Nicht möglich.' };
  if (key === 'evacuate' && st.active.includes(p) && p.type !== 'wildfire') return { ok: false, msg: 'Zu spät zum Evakuieren.' };
  const c = prepCost(g, p, key);
  if (!g.canAfford(c)) return { ok: false, msg: 'Nicht genug Geld.' };
  g.spend(c);
  p.prep[key] = true;
  if (key === 'teams') { const op = st.ops.find((o) => o.id === p.id); if (op) op.teams = true; }
  if (key === 'sandbags' && st.active.includes(p) && p.data.reach) p.data.reach = Math.max(1, Math.round(p.data.reach * 0.6));
  g.news('disaster', `${PREP[key].name}: ${PREP[key].desc}`, 'good', { x: Math.floor(p.x), y: Math.floor(p.y) });
  return { ok: true, cost: c };
}

const WEEKDAY = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export function etaText(g, p) {
  const mins = p.at - g.time;
  if (mins <= 0) return 'jetzt';
  if (mins < 90) return `in ${Math.max(5, Math.round(mins / 5) * 5)} Minuten`;
  if (mins < 20 * 60) return `in etwa ${Math.round(mins / 60)} Stunden`;
  const d = Math.floor(p.at / DAY), today = Math.floor(g.time / DAY);
  const hh = Math.floor((p.at % DAY) / 60);
  if (d === today + 1) return `morgen gegen ${hh} Uhr`;
  return `am ${WEEKDAY[d % 7]} gegen ${hh} Uhr (in ${d - today} Tagen)`;
}

// Entscheidung im Anzeiger, wenn eine Warnung früh genug kommt
const WARN_EVENT = {
  id: 'kat_warnung', title: 'Unwetterwarnung', text: '', minPop: Infinity, cond: () => false,
  options: [
    { label: 'Alles vorbereiten', hint: (g) => promptHint(g, 'all'), apply: (g) => promptApply(g, 'all') },
    { label: 'Nur das Nötigste', hint: (g) => promptHint(g, 'primary'), apply: (g) => promptApply(g, 'primary') },
    { label: 'Abwarten', hint: () => 'Keine Kosten – das Risiko bleibt.', apply: (g) => promptApply(g, 'none') },
  ],
};
EVENTS.push(WARN_EVENT);
function promptKeys(g, mode) {
  const st = g.ext.disasters;
  const p = st.planned.find((x) => x.id === st.prompt);
  if (!p || mode === 'none') return [p, []];
  if (mode === 'primary') return [p, [PRIMARY[p.type]]];
  return [p, prepOptions(p)];
}
function promptHint(g, mode) {
  const [p, keys] = promptKeys(g, mode);
  if (!p) return '';
  const cost = keys.reduce((s, k) => s + prepCost(g, p, k), 0);
  return `${keys.map((k) => PREP[k].name).join(' + ')} · −${fmtMoney(cost).replace('−', '')}`;
}
function promptApply(g, mode) {
  const st = g.ext.disasters;
  const [p, keys] = promptKeys(g, mode);
  st.prompt = null;
  if (!p) return;
  for (const k of keys) {
    const c = prepCost(g, p, k);
    if (!g.sandbox) g.money -= c;
    p.prep[k] = true;
  }
  if (keys.length) g.news('disaster', `Vorbereitung auf ${p.name}: ${keys.map((k) => PREP[k].name).join(', ')}.`, 'good');
}
const PROMPT_TEXT = {
  flood: (g, p) => [`Hochwasserwarnung`, `Die Wetterstation meldet tagelangen Dauerregen. ${etaText(g, p)[0].toUpperCase() + etaText(g, p).slice(1)} droht das Wasser bei Feld ${Math.floor(p.x)}, ${Math.floor(p.y)} über die Ufer zu treten – etwa ${Math.max(1, Math.round(p.est || 0))} Felder sind gefährdet, ${p.residents} Menschen wohnen dort.`],
  storm: (g, p) => [`Orkanwarnung`, `Ein Orkan mit Böen bis ${Math.round(90 + p.intensity * 70)} km/h erreicht die Stadt ${etaText(g, p)}. Dächer, Bäume und Stromleitungen sind in Gefahr.`],
  tornado: (g, p) => [`Tornadowarnung`, `Für ${etaText(g, p)} sagt die Wetterstation schwere Gewitter voraus. Ein Tornado ist möglich – wo genau, weiß niemand.`],
  wildfire: (g, p) => [`Waldbrandgefahr`, `Seit Tagen ist es heiß und staubtrocken. Im Wald bei Feld ${Math.floor(p.x)}, ${Math.floor(p.y)} ist ein Feuer ${etaText(g, p)} sehr wahrscheinlich.`],
  meteor: (g, p) => [`Meteorit auf Kollisionskurs!`, `Die Sternwarte hat einen Gesteinsbrocken entdeckt. Einschlag ${etaText(g, p)} bei Feld ${Math.floor(p.x)}, ${Math.floor(p.y)} – ${p.residents} Menschen wohnen im Gefahrengebiet.`],
  quake: (g, p) => [`Erdbeben-Frühwarnung`, `Seismometer schlagen aus: Ein Beben steht unmittelbar bevor.`],
};
function canPrompt(g) { return !g.pendingEvent && !g.pendingCards && !g.gameOver && !g.sandboxNoEvents; }
function tryPrompt(g, p) {
  const st = g.ext.disasters;
  if (p.prompted || p.manual || p.aftershock) return;
  if (p.at - g.time < 6 * 60) { p.prompted = true; return; }
  if (!canPrompt(g)) return;
  p.prompted = true;
  st.prompt = p.id;
  const [title, text] = PROMPT_TEXT[p.type](g, p);
  WARN_EVENT.title = title;
  WARN_EVENT.text = text;
  const prim = PREP[PRIMARY[p.type]];
  WARN_EVENT.options[0].label = 'Alles vorbereiten';
  WARN_EVENT.options[1].label = prim ? `Nur ${prim.name}` : 'Nur das Nötigste';
  g.pendingEvent = WARN_EVENT.id;
  g.emit('event', WARN_EVENT);
}

function warn(g, p) {
  p.known = true;
  p.lead = Math.max(0, p.at - g.time);
  if (p.aftershock) return;
  // emit('disaster', phase 'warn') erst, wenn die Sirenen heulen (U2 spielt dazu die Sirene) – siehe step()
  const where = { x: Math.floor(p.x), y: Math.floor(p.y) };
  const t = etaText(g, p);
  const msg = {
    flood: `Hochwasserwarnung: Pegel steigen, Überflutung ${t} erwartet.`,
    storm: `Orkanwarnung: Schwerer Sturm ${t}.`,
    tornado: `Unwetterwarnung: Schwere Gewitter mit Tornadogefahr ${t}.`,
    wildfire: `Waldbrandgefahr: Ein Feuer im Wald ist ${t} wahrscheinlich.`,
    meteor: p.lead > 120 ? `Die Sternwarte warnt: Meteoriteneinschlag ${t}!` : 'Ein gleißender Feuerball am Himmel – ein Meteorit stürzt herab!',
    quake: 'Erdbeben-Frühwarnung: Seismometer schlagen aus!',
  }[p.type];
  if (msg) g.news('disaster', msg, 'bad', where);
}

function emitD(g, a, phase, extra = {}) {
  emit('disaster', { type: a.type, phase, x: a.x, y: a.y, radius: a.r, intensity: a.intensity, id: a.id, name: a.name, ...extra });
}

// ---------- Hochwasser
function floodTiles(g, p, estimate = false) {
  const { W, H } = g;
  let reach = Math.round(2 + 4 * p.intensity);
  if (!estimate && p.prep.sandbags) reach = Math.max(1, Math.round(reach * 0.6));
  if (g.eff('floodShield') > 0) reach = Math.max(1, Math.round(reach * 0.5));
  // Schutz durch Hochwasserschutz
  const prot = new Uint8Array(g.N);
  for (const b of g.buildings.values()) {
    const d = BUILDINGS[b.key];
    if (b.zone || !d || !d.floodProtect || b.construct < 1) continue;
    forDisc(g, b.x + 0.5, b.y + 0.5, d.floodProtect, (t) => { prot[t] = 1; });
  }
  const dist = new Int16Array(g.N).fill(-1);
  const q = [];
  const R = 10 + 8 * p.intensity;
  forDisc(g, p.x, p.y, R, (t) => { if (g.world.terrain[t] === T.WATER) { dist[t] = 0; q.push(t); } });
  const out = [];
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    const d = dist[i];
    if (d >= reach) continue;
    const x = i % W, y = (i / W) | 0;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + ox, ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (dist[j] >= 0) continue;
      const ter = g.world.terrain[j];
      if (ter === T.WATER || ter === T.ROCK || prot[j]) continue;
      if (Math.hypot(nx + 0.5 - p.x, ny + 0.5 - p.y) > R + reach) continue;
      dist[j] = d + 1;
      q.push(j);
      out.push(j, d + 1);
    }
  }
  if (!estimate) p.data.reach = reach;
  return out;
}
export function floodCurve(a, t) {
  const u = t - a.t0;
  if (u <= 0) return 0;
  if (u < 480) return smooth(u / 480);
  if (u < 840) return 1;
  if (u < 1800) return 1 - smooth((u - 840) / 960);
  return 0;
}
const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
export function floodDepth(a, d, t) {
  const L = (a.data.reach || 3) * floodCurve(a, t);
  return clamp((L - d + 1) / 1.6, 0, 1);
}

function stepFlood(g, a) {
  const st = g.ext.disasters, I = I_(g);
  const tiles = a.data.tiles || [];
  const hit = a.data.hit || (a.data.hit = []);
  for (let k = 0; k < tiles.length; k += 2) {
    const i = tiles[k];
    const dep = floodDepth(a, tiles[k + 1], g.time);
    if (dep < 0.05) continue;
    a.data.maxD = a.data.maxD || {};
    if (!a.data.maxD[i] || a.data.maxD[i] < dep) a.data.maxD[i] = +dep.toFixed(2);
    const id = g.bld[i];
    if (!id) continue;
    const b = g.buildings.get(id);
    if (!b) continue;
    I.flooded.set(b.id, Math.max(I.flooded.get(b.id) || 0, dep));
    if (dep < 0.35 || hit.includes(b.id) || g.time - a.t0 < 200) continue;
    hit.push(b.id);
    const v = vuln(b, 'flood');
    if (b.zone && b.level <= 2 && rnd(st) < 0.05 * dep * v) destroyBuilding(g, b, a);
    else if (rnd(st) < (0.3 + dep * 0.5) * v) damageBuilding(g, b, 0.25 + dep * 0.55, a);
    a.stats.flooded++;
  }
}

// ---------- Orkan
function stepStorm(g, a, minutes) {
  const st = g.ext.disasters;
  const hrs = minutes / 60;
  const I0 = a.intensity * Math.sin(Math.PI * clamp((g.time - a.t0) / a.dur, 0, 1));
  const sec = a.prep.secure ? 0.6 : 1;
  const victims = [];
  for (const b of g.buildings.values()) {
    if (b.construct < 1 && !st.repairs[b.id]) continue;
    const [bx, by] = bCenter(b);
    if (Math.hypot(bx - a.x, by - a.y) > a.r) continue;
    const p = I0 * I0 * 0.012 * vuln(b, 'storm') * sec * hrs;
    if (rnd(st) < p) victims.push(b);
  }
  for (const b of victims) {
    if (b.zone && b.level <= 2 && rnd(st) < 0.08) destroyBuilding(g, b, a);
    else damageBuilding(g, b, 0.2 + rnd(st) * 0.45, a);
  }
  // Umgestürzte Bäume
  let trees = false;
  for (let k = 0; k < 60; k++) {
    const i = Math.floor(rnd(st) * g.N);
    if (g.world.trees[i] && rnd(st) < 0.25 * I0 * hrs * 6) { g.world.trees[i] = Math.max(0, g.world.trees[i] - 1); trees = true; a.stats.trees = (a.stats.trees || 0) + 1; }
  }
  if (trees) g.emit('treesChanged');
}

// ---------- Tornado
export function tornadoPos(a, t) {
  const D = a.data;
  const u = clamp((t - a.t0) / a.dur, 0, 1);
  const bx = D.x0 + (D.x1 - D.x0) * u, by = D.y0 + (D.y1 - D.y0) * u;
  const len = Math.hypot(D.x1 - D.x0, D.y1 - D.y0) || 1;
  const px = -(D.y1 - D.y0) / len, py = (D.x1 - D.x0) / len;
  const wob = Math.sin(u * Math.PI * 3 + D.wob) * 2.2 + Math.sin(u * Math.PI * 7.3 + D.wob * 2) * 0.6;
  return { x: bx + px * wob, y: by + py * wob, u, strength: Math.sin(Math.PI * clamp(u * 1.15, 0, 1)) };
}
function startTornado(g, a) {
  const st = g.ext.disasters;
  const w = g.ext.weather || {};
  const ang = (w.windDir ?? 0) + (rnd(st) - 0.5) * 1.2;
  const len = 26 + rnd(st) * 14;
  const dx = Math.cos(ang), dy = Math.sin(ang);
  a.data = { x0: a.x - dx * len * 0.5, y0: a.y - dy * len * 0.5, x1: a.x + dx * len * 0.5, y1: a.y + dy * len * 0.5, wob: rnd(st) * 6.28, rad: 0.9 + a.intensity * 1.0, hit: [], core: [], lastT: g.time };
}
function stepTornado(g, a) {
  const st = g.ext.disasters, D = a.data;
  const t0 = D.lastT ?? a.t0;
  const t1 = Math.min(g.time, a.t0 + a.dur);
  if (t1 <= t0) return;
  const len = Math.hypot(D.x1 - D.x0, D.y1 - D.y0);
  const steps = Math.max(1, Math.ceil(((t1 - t0) / a.dur) * len / 0.4));
  let trees = false;
  const sec = a.prep.secure ? 0.75 : 1;
  for (let s = 1; s <= steps; s++) {
    const p = tornadoPos(a, t0 + ((t1 - t0) * s) / steps);
    const r = D.rad * (0.55 + 0.45 * p.strength);
    if (p.strength < 0.12) continue;
    if (removeTrees(g, p.x, p.y, r, 0.8)) trees = true;
    const core = D.core || (D.core = []);
    for (const [b, d] of buildingsNear(g, p.x, p.y, r * 1.9)) {
      const v = vuln(b, 'tornado') * sec * p.strength;
      if (d <= r * 0.95) {
        if (core.includes(b.id)) continue;
        core.push(b.id);
        if (rnd(st) < 0.75 * a.intensity * v) destroyBuilding(g, b, a);
        else damageBuilding(g, b, 0.7 + rnd(st) * 0.3, a);
      } else {
        if (D.hit.includes(b.id) || core.includes(b.id)) continue;
        D.hit.push(b.id);
        if (rnd(st) < 0.6 * v) damageBuilding(g, b, 0.25 + 0.45 * (1 - (d - r) / r), a);
      }
    }
  }
  D.lastT = t1;
  if (trees) g.emit('treesChanged');
}

// ---------- Erdbeben
export function quakeShake(a, t) {
  const u = (t - a.t0) / a.dur;
  if (u < 0 || u > 1) return 0;
  return a.intensity * (u < 0.08 ? u / 0.08 : Math.pow(1 - (u - 0.08) / 0.92, 1.6));
}
function startQuake(g, a) {
  const st = g.ext.disasters;
  const R = a.aftershock ? 5 + a.intensity * 10 : 7 + a.intensity * 13;
  a.r = R;
  a.data.mag = +(4.2 + a.intensity * 2.9).toFixed(1);
  const list = buildingsNear(g, a.x, a.y, R);
  const ignite = [];
  for (const [b, d] of list) {
    const s = a.intensity * Math.pow(1 - d / R, 1.15) * vuln(b, 'quake');
    const u = rnd(st);
    if (s > 0.62 + 0.38 * u && b.zone) destroyBuilding(g, b, a);
    else if (s > 0.22 + 0.45 * u) {
      damageBuilding(g, b, clamp(s, 0.2, 1), a);
      if (rnd(st) < 0.12 * s) ignite.push(b);
    }
  }
  for (const b of ignite) if (g.buildings.has(b.id)) g.igniteBuilding(b);
  if (!a.aftershock) {
    g.addEffect('waterUse', 0.12 * a.intensity, 2, 'Rohrbrüche nach dem Beben');
    const n = 1 + Math.floor(rnd(st) * 2);
    for (let k = 0; k < n; k++) planDisaster(g, 'quake', { x: a.x + (rnd(st) - 0.5) * 4, y: a.y + (rnd(st) - 0.5) * 4, intensity: a.intensity * (0.25 + rnd(st) * 0.15), at: g.time + 240 + rnd(st) * 1200, aftershock: true });
  }
}

// ---------- Meteorit
export function meteorState(a, t) {
  const impactAt = a.data.impactAt ?? a.t0 + 100;
  return { impactAt, u: clamp((t - a.t0) / (impactAt - a.t0), 0, 1), impacted: t >= impactAt, since: t - impactAt, az: a.data.az ?? 0.7 };
}
function startMeteor(g, a) {
  const st = g.ext.disasters;
  a.data = { impactAt: g.time + 100, az: rnd(st) * Math.PI * 2, impacted: false };
  a.r = 1.2 + 1.7 * a.intensity;
}
function impactMeteor(g, a) {
  const st = g.ext.disasters;
  a.data.impacted = true;
  const rc = a.r;
  const list = buildingsNear(g, a.x, a.y, rc * 2.7);
  for (const [b, d] of list) {
    if (d <= rc) destroyBuilding(g, b, a, true);
    else if (rnd(st) < 0.85 * (1 - (d - rc) / (rc * 1.7))) {
      damageBuilding(g, b, 0.3 + 0.6 * (1 - (d - rc) / (rc * 1.7)), a);
      if (d < rc * 1.8 && rnd(st) < 0.35 && g.buildings.has(b.id)) g.igniteBuilding(b);
    }
  }
  if (removeTrees(g, a.x, a.y, rc * 1.4, 1)) g.emit('treesChanged');
  forDisc(g, a.x, a.y, rc * 0.9, (t) => { if (!g.bld[t] && !g.road[t] && g.world.terrain[t] !== T.WATER) { g.rubble[t] = Math.max(g.rubble[t], 4); st.rubble.push(t); } });
  g.emit('rubbleChanged');
  st.craters.push({ x: a.x, y: a.y, r: rc, t: g.time, days: 6 });
  st.fear = Math.min(1, st.fear + 0.2);
  emitD(g, a, 'update', { impact: true });
  g.news('disaster', `Einschlag! Ein Meteorit hat bei Feld ${Math.floor(a.x)}, ${Math.floor(a.y)} einen Krater gerissen.`, 'bad', { x: Math.floor(a.x), y: Math.floor(a.y) });
}

// ---------- Waldbrand
function startWildfire(g, a) {
  const st = g.ext.disasters;
  const burning = [];
  forDisc(g, a.x, a.y, 1.6, (t) => { if (g.world.trees[t] && burning.length < 6 && rnd(st) < 0.7) burning.push(t, 0); });
  if (!burning.length) { const t = tileOf(g, a.x, a.y); burning.push(t, 0); }
  a.data = { burning, burned: 0 };
}
function stepWildfire(g, a) {
  const st = g.ext.disasters, w = g.ext.weather || {};
  const B = a.data.burning;
  const map = new Map();
  for (let k = 0; k < B.length; k += 2) map.set(B[k], B[k + 1]);
  const dry = clamp(w.dry ?? 0.5, 0, 1), wind = w.wind ?? 0.2, wdir = w.windDir ?? 0, rain = w.rain ?? 0;
  const brk = a.prep.firebreak ? 0.5 : 1;
  let trees = false;
  const add = [];
  const ignite = [];
  const scorched = new Set(st.scorch.filter((_, k) => k % 2 === 0));
  for (const [i, h] of map) {
    const x = i % g.W, y = (i / g.W) | 0;
    const ext = 0.05 + g.cov.fire[i] * 0.3 + rain * 0.8 + (g.cov.disaster ? g.cov.disaster[i] * 0.15 : 0) + (a.prep.teams ? 0.08 : 0) + Math.min(0.25, ((g.time - a.t0) / 1440) * 0.08);
    if (rnd(st) < ext) { map.delete(i); st.scorch.push(i, 3); continue; }
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oy) continue;
      const nx = x + ox, ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= g.W || ny >= g.H) continue;
      const n = ny * g.W + nx;
      if (map.has(n) || scorched.has(n)) continue;
      if (g.world.trees[n]) {
        const align = Math.cos(Math.atan2(oy, ox) - wdir);
        const p = 0.11 * (0.5 + a.intensity * 0.5) * (0.3 + dry) * (g.world.trees[n] / 3 + 0.3) * (1 + 0.9 * align * wind) * brk * (1 - rain) / (ox && oy ? 1.4 : 1);
        if (rnd(st) < p && map.size + add.length < 70 && a.data.burned + map.size + add.length < 220) add.push(n);
      } else if (g.bld[n] && !ox !== !oy && rnd(st) < 0.05) {
        const b = g.buildings.get(g.bld[n]);
        if (b && b.zone && !b.burning && !b.abandoned) ignite.push(b);
      }
    }
    const life = 4 + (g.world.trees[i] || 1);
    if (h + 1 >= life) {
      map.delete(i);
      if (g.world.trees[i]) { g.world.trees[i] = 0; trees = true; }
      st.scorch.push(i, 8);
      a.data.burned++;
    } else map.set(i, h + 1);
  }
  for (const n of add) map.set(n, 0);
  for (const b of ignite) g.igniteBuilding(b);
  a.data.burning = [];
  for (const [i, h] of map) a.data.burning.push(i, h);
  a.stats.burned = a.data.burned;
  if (trees) g.emit('treesChanged');
}

// ---------- Blitze (bei jedem Gewitter, kleine Katastrophe)
export function strike(g, x, y, manual = false) {
  const st = g.ext.disasters;
  if (x === undefined) {
    const box = cityBox(g);
    if (rnd(st) < 0.65) { x = box.x0 - 6 + rnd(st) * (box.x1 - box.x0 + 12); y = box.y0 - 6 + rnd(st) * (box.y1 - box.y0 + 12); }
    else { x = rnd(st) * g.W; y = rnd(st) * g.H; }
  }
  x = clamp(x, 0, g.W - 0.01); y = clamp(y, 0, g.H - 0.01);
  let hit = 'ground', h = 0, target = null;
  let best = 0;
  for (const [b] of buildingsNear(g, x, y, 2)) {
    const hh = b.zone ? [0, 0.6, 1, 1.5, 2.6, 4.8][b.level] : 1.2;
    if (hh > best) { best = hh; target = b; }
  }
  if (target && rnd(st) < 0.35 + best * 0.08) {
    [x, y] = bCenter(target); hit = 'building'; h = best;
  } else if (g.world.trees[tileOf(g, x, y)]) { hit = 'tree'; h = 0.9; }
  const s = { x: +x.toFixed(2), y: +y.toFixed(2), t: g.time, h, hit, seed: st.seq++ };
  st.strikes.push(s);
  if (st.strikes.length > 16) st.strikes.shift();
  if (g.ext.weather) g.ext.weather.lightning = 1;
  emit('disaster', { type: 'lightning', phase: 'start', x, y, radius: 0.6, intensity: 1, id: s.seed, name: DISASTERS.lightning.name });
  const mul = manual ? 1 : enabled(g);
  if (!mul) return s;
  const early = !manual && (g.milestone < 1 || g.day() < 10);
  if (hit === 'building' && target && !early && rnd(st) < 0.15 * Math.min(1.4, mul) * (target.zone ? 1 : 0.5)) {
    g.igniteBuilding(target);
    g.news('disaster', 'Blitzeinschlag! Ein Gebäude hat Feuer gefangen.', 'bad', target);
  } else if (hit === 'tree' && !early && (g.ext.weather?.dry || 0) > 0.45 && (g.ext.weather?.rain || 0) < 0.25 && rnd(st) < 0.3 * mul && !st.active.some((a) => a.type === 'wildfire') && !st.planned.some((a) => a.type === 'wildfire')) {
    const a = planDisaster(g, 'wildfire', { x, y, lead: 0, intensity: 0.5, noWeather: true });
    if (a) { a.known = true; a.cause = 'lightning'; }
  }
  return s;
}

// ---------- Ablauf
function start(g, p) {
  const st = g.ext.disasters;
  st.planned = st.planned.filter((x) => x !== p);
  const a = p;
  a.t0 = g.time;
  a.dur = DUR[a.type] * (a.type === 'storm' ? 0.85 + a.intensity * 0.3 : 1);
  a.stats = { destroyed: 0, damaged: 0, flooded: 0, burned: 0, cost: 0 };
  a.phase = 'start';
  if (!a.known) { a.known = false; a.lead = 0; }
  if (a.type === 'flood') { a.data.tiles = floodTiles(g, a); a.data.hit = []; }
  if (a.type === 'storm' && !a.prep.secure) g.addEffect('powerMul', -0.25 * a.intensity, 1.5, 'Orkan: beschädigte Stromleitungen');
  if (a.type === 'tornado') startTornado(g, a);
  if (a.type === 'meteor') startMeteor(g, a);
  if (a.type === 'wildfire') startWildfire(g, a);
  st.active.push(a);
  if (!a.aftershock) st.fear = Math.min(1, st.fear + 0.25 * a.intensity);
  emitD(g, a, 'start');
  if (a.type === 'quake') startQuake(g, a);
  const where = { x: Math.floor(a.x), y: Math.floor(a.y) };
  const msg = {
    flood: 'Hochwasser! Der Fluss tritt über die Ufer.',
    storm: 'Der Orkan ist da! Bleibt in den Häusern.',
    tornado: 'Tornado! Ein Wirbelsturm zieht durch die Stadt.',
    quake: a.aftershock ? `Nachbeben der Stärke ${a.data.mag}.` : `Erdbeben der Stärke ${a.data.mag}! Gebäude sind beschädigt.`,
    meteor: 'Ein Meteorit rast auf die Stadt zu!',
    wildfire: a.cause === 'lightning' ? 'Ein Blitz hat einen Waldbrand entfacht!' : 'Waldbrand! Flammen fressen sich durch den Wald.',
  }[a.type];
  if (msg) g.news('disaster', msg, 'bad', where);
}

function finish(g, a) {
  const st = g.ext.disasters;
  st.active = st.active.filter((x) => x !== a);
  a.phase = 'end';
  emitD(g, a, 'end', { stats: a.stats });
  if (a.type === 'flood' && a.data.maxD) {
    for (const [i, d] of Object.entries(a.data.maxD)) if (d >= 0.25) st.mud.push(+i, 3);
  }
  if (a.aftershock && !a.stats.destroyed && !a.stats.damaged) return;
  if (a.type === 'wildfire' && (a.stats.burned || 0) < 3 && !a.stats.destroyed) { g.news('disaster', 'Ein kleiner Waldbrand wurde schnell gelöscht.', 'good'); return; }
  const op = st.ops.find((o) => o.id === a.id);
  const rec = {
    id: a.id, type: a.type, name: a.name, day: g.day(), x: Math.round(a.x), y: Math.round(a.y), intensity: +a.intensity.toFixed(2),
    destroyed: a.stats.destroyed, damaged: a.stats.damaged, burned: a.stats.burned || 0, cost: Math.round(a.stats.cost),
    rescued: op ? op.rescued : 0, lost: op ? op.lost : 0, warned: !!a.known, prep: Object.keys(a.prep), aftershock: !!a.aftershock,
  };
  st.history.push(rec);
  if (st.history.length > 30) st.history.shift();
  st.totals.cost += rec.cost;
  if (!a.aftershock) st.cooldown = g.day() + 6;
  const total = rec.destroyed + rec.damaged;
  if (total > 0 && !a.aftershock) {
    const prot = protectionScore(g);
    const aid = g.sandbox ? 0 : Math.round((rec.cost * (0.25 + prot * 0.2)) / 500) * 500;
    if (aid > 0) { g.money += aid; st.totals.aid += aid; }
    g.news('disaster', `Bilanz ${a.name}: ${rec.destroyed} Gebäude zerstört, ${rec.damaged} beschädigt${rec.burned ? `, ${rec.burned} Waldfelder verbrannt` : ''}.${aid > 0 ? ` Das Land überweist ${fmtMoney(aid)} Katastrophenhilfe.` : ''}`, 'info', { x: rec.x, y: rec.y });
  } else if (!a.aftershock && a.type !== 'wildfire') {
    g.news('disaster', `${a.name} überstanden – keine größeren Schäden.`, 'good');
  } else if (a.type === 'wildfire') {
    g.news('disaster', `Der Waldbrand ist gelöscht. ${rec.burned} Waldfelder sind verbrannt.`, 'info');
  }
}

function stepActive(g, minutes) {
  const st = g.ext.disasters;
  I_(g).flooded.clear();
  for (const a of [...st.active]) {
    if (a.type === 'flood') stepFlood(g, a);
    else if (a.type === 'storm') stepStorm(g, a, minutes);
    else if (a.type === 'tornado') stepTornado(g, a);
    else if (a.type === 'meteor' && !a.data.impacted && g.time >= a.data.impactAt) impactMeteor(g, a);
    if (a.type === 'wildfire') {
      if (!a.data.burning.length || g.time - a.t0 > a.dur) { a.data.burning = []; finish(g, a); }
    } else if (g.time >= a.t0 + a.dur) finish(g, a);
  }
}

// ---------- Rettung, Reparatur, Aufräumen, Wiederaufbau
function stepRepairs(g, minutes) {
  const st = g.ext.disasters, w = g.ext.weather || {};
  const cd = g.cov.disaster;
  const bud = budgetMul(g);
  for (const id of Object.keys(st.repairs)) {
    const rec = st.repairs[id];
    const b = g.buildings.get(+id);
    if (!b) { delete st.repairs[id]; continue; }
    if (b.abandoned) { delete st.repairs[id]; b.construct = 1; continue; }
    const i = b.y * g.W + b.x;
    let speed = (0.55 + 1.7 * (cd ? cd[i] : 0) + (rec.teams ? 0.4 : 0)) * bud * (isUtility(b) ? 1.6 : 1);
    if (w.temp < -3 || w.snow > 0.3) speed *= 0.75;
    if (!g.sandbox && g.money < -20000) speed *= 0.5;
    rec.left -= (minutes / 60) * speed;
    if (rec.left <= 0) {
      delete st.repairs[id];
      b.construct = 1;
      g.emit('buildingUpdated', b);
      g.dirty.util = g.dirty.coverage = true;
    } else {
      b.construct = Math.min(0.98, 1 - (1 - rec.from) * (rec.left / rec.total));
    }
  }
}

function hourlyRescue(g) {
  const st = g.ext.disasters;
  const keep = [];
  for (const op of st.ops) {
    const i = tileOf(g, op.x, op.y);
    const rate = (0.04 + 0.22 * g.cov.fire[i] + 0.55 * (g.cov.disaster ? g.cov.disaster[i] : 0)) * (op.teams ? 1.8 : 1) * budgetMul(g);
    if (op.trapped > 0) {
      const n = Math.min(op.trapped, Math.max(1, Math.round(op.trapped * rate)));
      op.trapped -= n; op.rescued += n; st.totals.rescued += n;
      if (!op.trapped) g.news('disaster', `Alle ${op.rescued} Verschütteten sind gerettet. Danke an alle Einsatzkräfte!`, 'good', { x: Math.floor(op.x), y: Math.floor(op.y) });
    }
    if (op.trapped > 0 && g.time - op.t0 > 40 * 60) {
      op.lost += op.trapped; st.totals.lost += op.trapped;
      st.mourn = Math.min(6, st.mourn + op.trapped / 12 + 1);
      g.news('disaster', `Die Suche ist beendet: ${op.trapped} Menschen werden vermisst. Die Stadt trauert.`, 'bad');
      op.trapped = 0;
    }
    if (op.injured > 0) {
      const n = Math.min(op.injured, Math.max(1, Math.round(op.injured * (0.06 + 0.3 * g.cov.health[i]))));
      op.injured -= n; op.treated += n;
    }
    const busy = op.trapped > 0 || op.injured > 0 || st.active.some((a) => a.id === op.id);
    if (busy || g.time - op.t0 < 180) keep.push(op);
  }
  st.ops = keep;
}

function hourlyRubble(g) {
  const st = g.ext.disasters;
  st.rubble = st.rubble.filter((i) => g.rubble[i] > 0);
  st.rubble = [...new Set(st.rubble)];
  st.rubbleCount = st.rubble.length;
  if (!st.rubble.length) return;
  const centers = disasterCenters(g);
  const fires = [];
  for (const b of g.buildings.values()) if ((b.key === 'fire' || b.key === 'firehq') && b.construct >= 1) fires.push(b);
  const teams = st.active.some((a) => a.prep.teams);
  let changed = false;
  const clear = (i) => {
    g.rubble[i] = 0;
    if (g.zone[i] && !g.bld[i]) g.zoneFree[g.zone[i]].add(i);
    changed = true;
  };
  const cap = new Map();
  for (const c of centers) cap.set(c, (4 + (teams ? 2 : 0)) * budgetMul(g));
  for (const f of fires) cap.set(f, 0.5);
  st.rubble.sort((a, b) => a - b);
  for (const i of st.rubble) {
    if (!g.rubble[i]) continue;
    const x = i % g.W + 0.5, y = Math.floor(i / g.W) + 0.5;
    for (const [c, k] of cap) {
      if (k < 1 && !(k > 0 && rnd(st) < k)) continue;
      const r = c.key === 'disaster_center' ? 22 : 12;
      if (Math.hypot(c.x + c.w / 2 - x, c.y + c.h / 2 - y) > r) continue;
      clear(i);
      cap.set(c, k - 1);
      break;
    }
  }
  if (changed) {
    g._zoneDirty();
    g.emit('rubbleChanged');
    st.rubble = st.rubble.filter((i) => g.rubble[i] > 0);
    st.rubbleCount = st.rubble.length;
  }
}

export function rebuildCost(g, r) {
  const d = BUILDINGS[r.key];
  if (!d) return 0;
  let share = g.hasBuilt('disaster_center') ? 0.35 : 0.5;
  share *= 1 - clamp(g.eff('insurance'), 0, 0.8);
  return Math.round(g.buildingCost(r.key) * share);
}
export function rebuildRuin(g, idx) {
  const st = g.ext.disasters;
  const r = st.ruins[idx];
  if (!r) return { ok: false, msg: 'Nichts zum Wiederaufbauen.' };
  const err = g.checkPlace(r.key, r.x, r.y, r.rot);
  if (err) {
    if (err === 'Fläche ist bebaut' || err === 'Gibt es schon in deiner Stadt' || err === 'Straße im Weg') { st.ruins.splice(idx, 1); return { ok: false, msg: `${r.name}: ${err} – Wiederaufbau entfällt.` }; }
    return { ok: false, msg: `${r.name}: ${err}` };
  }
  const share = rebuildCost(g, r);
  if (!g.canAfford(share)) return { ok: false, msg: 'Nicht genug Geld.' };
  const full = g.placeCost(r.key, r.x, r.y, r.rot);
  const before = g.money;
  const res = g.placeBuilding(r.key, r.x, r.y, r.rot);
  if (!res.ok) return res;
  if (!g.sandbox) { g.money = before - share - Math.max(0, full - g.buildingCost(r.key)); g.emit('money'); }
  st.ruins.splice(idx, 1);
  return { ok: true, cost: share, building: res.building };
}

function dailyAftermath(g) {
  const st = g.ext.disasters, I = I_(g);
  // Obdachlose finden eine neue Bleibe oder ziehen weg
  const unshel = Math.max(0, st.displaced - st.shelterCap);
  if (st.homeless > 0) st.homeless = Math.max(0, st.homeless - Math.ceil(st.homeless * (0.12 + (unshel > 0 ? 0.15 : 0))));
  st.fear *= 0.93 - 0.05 * I.protection;
  if (st.fear < 0.01) st.fear = 0;
  st.mourn *= 0.85;
  if (st.mourn < 0.2) st.mourn = 0;
  for (let i = 0; i < g.N; i++) if (I.damage[i]) { I.damage[i] *= 0.8; if (I.damage[i] < 0.02) I.damage[i] = 0; }
  // Brandflächen wachsen wieder zu, Schlamm trocknet, Krater verblassen
  let trees = false;
  const sc = [];
  for (let k = 0; k < st.scorch.length; k += 2) {
    const i = st.scorch[k], d = st.scorch[k + 1] - 1;
    if (d > 0) { sc.push(i, d); continue; }
    if (g.world.forest && g.world.forest[i] && !g.bld[i] && !g.road[i] && rnd(st) < 0.6) { g.world.trees[i] = 1; trees = true; }
  }
  st.scorch = sc;
  if (trees) g.emit('treesChanged');
  const mud = [];
  for (let k = 0; k < st.mud.length; k += 2) if (st.mud[k + 1] > 1) mud.push(st.mud[k], st.mud[k + 1] - 1);
  st.mud = mud;
  st.craters = st.craters.filter((c) => { c.days--; return c.days > 0; });
  // Automatischer Wiederaufbau mit Katastrophenschutz
  if (st.autoRebuild) {
    const center = g.hasBuilt('disaster_center');
    for (let k = st.ruins.length - 1; k >= 0; k--) {
      const r = st.ruins[k];
      if (g.day() - r.day < (center ? 1 : 2)) continue;
      let clear = true;
      const [w, h] = g.footprint(r.key, r.rot);
      for (let yy = r.y; yy < r.y + h; yy++) for (let xx = r.x; xx < r.x + w; xx++) if (g.rubble[yy * g.W + xx]) clear = false;
      if (!clear) continue;
      const res = rebuildRuin(g, k);
      if (res.ok) g.news('disaster', `Wiederaufbau: ${r.name} steht wieder (${fmtMoney(res.cost)} Eigenanteil).`, 'good', { x: r.x, y: r.y });
    }
  }
  st.strikes = st.strikes.filter((s) => g.time - s.t < 120);
}

function hourlyShelter(g) {
  const st = g.ext.disasters;
  let rep = 0;
  for (const id of Object.keys(st.repairs)) {
    const b = g.buildings.get(+id);
    if (b && b.zone === Z.RES) rep += b.occ;
  }
  st.displaced = Math.round(st.homeless + rep);
  st.sheltered = Math.min(st.displaced, st.shelterCap);
}

// ---------- Glück, Nachfrage, Haushalt, Symbole
HAPPINESS_FACTORS.push((g, b, i) => {
  const st = g.ext.disasters;
  if (!st || st.fear < 0.05) return null;
  const I = I_(g);
  const v = -st.fear * 7 * (1 - 0.7 * I.protect[i]);
  return v < -0.5 ? ['Sorge vor Katastrophen', v] : null;
});
HAPPINESS_FACTORS.push((g, b, i) => {
  const I = INTERNAL.get(g);
  if (!I || !I.damage[i]) return null;
  const v = -Math.min(8, I.damage[i] * 8);
  return v < -0.5 ? ['Zerstörung in der Nachbarschaft', v] : null;
});
HAPPINESS_FACTORS.push((g, b) => {
  const st = g.ext.disasters;
  if (!st || st.mourn < 0.5 || b.zone !== Z.RES) return null;
  return ['Trauer', -Math.min(6, st.mourn)];
});
HAPPINESS_FACTORS.push((g, b) => {
  const st = g.ext.disasters;
  if (!st || b.zone !== Z.RES) return null;
  const un = st.displaced - st.sheltered;
  if (un < 10) return null;
  return ['Obdachlose nach Katastrophe', -Math.min(6, un / 40)];
});
HAPPINESS_FACTORS.push((g, b) => {
  const I = INTERNAL.get(g);
  const d = I && I.flooded.get(b.id);
  return d > 0.15 ? ['Überflutet', -14 * d] : null;
});
DEMAND_MODIFIERS.push((g, d) => {
  const st = g.ext.disasters;
  if (st && st.homeless > 0) d[1] += Math.min(35, st.homeless / 8);
});
BUILDING_PROBLEMS.push((g, b) => {
  const I = INTERNAL.get(g);
  return I && (I.flooded.get(b.id) || 0) > 0.2 ? 'flooded' : null;
});
BUDGET_LINES.push({
  id: 'repair', label: 'Wiederaufbau', kind: 'expense',
  amount(g) {
    const st = g.ext && g.ext.disasters;
    if (!st) return 0;
    let sum = 0;
    const cd = g.cov.disaster;
    for (const id of Object.keys(st.repairs)) {
      const r = st.repairs[id], b = g.buildings.get(+id);
      if (!b) continue;
      const sp = 0.55 + 1.7 * (cd ? cd[b.y * g.W + b.x] : 0);
      sum += (r.cost / Math.max(1, r.total)) * 24 * sp;
    }
    return sum * (1 - clamp(g.eff('insurance'), 0, 0.8)) * (g.sandbox ? 0 : 1);
  },
});
BUDGET_LINES.push({
  id: 'relief', label: 'Notunterkünfte & Rettung', kind: 'expense',
  amount(g) {
    const st = g.ext && g.ext.disasters;
    if (!st) return 0;
    return (st.sheltered * 1.5 + st.ops.length * 250) * (g.sandbox ? 0 : 1);
  },
});

// ---------- Rettungsfahrzeuge, Hubschrauber und Boote (Darstellung über G10)
function nearestRoad(g, x, y) {
  let best = -1, bd = 1e9;
  forDisc(g, x, y, 5, (t, d) => { if (g.road[t] && g.road[t] !== R.HIGHWAY && d < bd) { bd = d; best = t; } });
  return best;
}
function renderables(g) {
  const st = g.ext.disasters;
  if (!st || (!st.ops.length && !st.active.length)) return [];
  const out = [];
  const ox = -g.W / 2, oz = -g.H / 2;
  const t = g.time;
  const center = g.hasBuilt('disaster_center');
  st.ops.slice(0, 4).forEach((op, k) => {
    if (op.road === undefined) op.road = nearestRoad(g, op.x, op.y);
    if (op.road >= 0) {
      const rx = op.road % g.W + 0.5, ry = Math.floor(op.road / g.W) + 0.5;
      out.push({ kind: 'ambulance', x: rx + ox - 0.15, y: 0.012, z: ry + oz, yaw: 0, lights: true });
      out.push({ kind: 'fire', x: rx + ox + 0.18, y: 0.012, z: ry + oz + 0.1, yaw: Math.PI / 2, lights: true });
    }
    if (center && (op.trapped > 0 || st.active.some((a) => a.id === op.id))) {
      const ang = t * 0.012 + k * 2.1;
      out.push({ kind: 'helicopter', x: op.x + ox + Math.cos(ang) * 1.6, y: 2.4 + Math.sin(t * 0.03 + k) * 0.15, z: op.y + oz + Math.sin(ang) * 1.6, yaw: -ang, lights: true });
    }
  });
  for (const a of st.active) {
    if (a.type !== 'flood' || !a.data.tiles) continue;
    const c = floodCurve(a, t);
    if (c < 0.3) continue;
    const T2 = a.data.tiles;
    for (let k = 0; k < 3 && k * 37 < T2.length / 2; k++) {
      const j = ((k * 37 + 11) % (T2.length / 2)) * 2;
      const i = T2[j];
      const dep = floodDepth(a, T2[j + 1], t);
      if (dep < 0.4) continue;
      const bx = i % g.W + 0.5, by = Math.floor(i / g.W) + 0.5;
      const ang = t * 0.01 + k * 2;
      out.push({ kind: 'boat', x: bx + ox + Math.cos(ang) * 0.9, y: dep * 0.12 + 0.03, z: by + oz + Math.sin(ang) * 0.9, yaw: -ang - Math.PI / 2 });
    }
  }
  return out;
}

// ---------- Speichern
function serialize(g) {
  const st = g.ext.disasters, I = I_(g);
  const dmg = [];
  for (let i = 0; i < g.N; i++) if (I.damage[i] > 0.02) dmg.push(i, +I.damage[i].toFixed(2));
  const strip = (a) => ({ ...a });
  return { ...st, planned: st.planned.map(strip), active: st.active.map(strip), dmg };
}
function load(g, d) {
  if (!d) return;
  const st = Object.assign(freshState(g), d);
  delete st.dmg;
  g.ext.disasters = st;
  const I = I_(g);
  if (d.dmg) for (let k = 0; k < d.dmg.length; k += 2) I.damage[d.dmg[k]] = d.dmg[k + 1];
  // Reparaturen gegen den geladenen Bauzustand abgleichen
  for (const id of Object.keys(st.repairs)) { const b = g.buildings.get(+id); if (!b || b.construct >= 1) delete st.repairs[id]; }
  updateFields(g);
  hourlyShelter(g);
}

registerSystem({
  id: 'disasters',
  init(g) {
    INTERNAL.delete(g);
    g.ext.disasters = freshState(g);
    // Brennt ein Dienstgebäude nieder (Kern-Brandlogik), kann es über die Versicherung wiederaufgebaut werden
    g.on('buildingRemoved', (b) => {
      const st = g.ext.disasters;
      if (!st || b.zone || !b.burning || st._removing === b.id || isLandmark(b) || b.key === 'station' || !BUILDINGS[b.key]) return;
      st.ruins.push({ key: b.key, x: b.x, y: b.y, rot: b.rot, day: g.day(), cause: 'fire', name: BUILDINGS[b.key].name });
      g.news('disaster', `${BUILDINGS[b.key].name} ist abgebrannt. Wiederaufbau im Panel „Wetter & Katastrophenschutz".`, 'bad', b);
    });
  },
  step(g, minutes) {
    const st = g.ext.disasters, w = g.ext.weather || {};
    if (I_(g).fieldsAt < 0) updateFields(g);
    // Geplante Katastrophen: Warnung, Sirenen, Beginn
    for (const p of [...st.planned]) {
      const lead = leadTime(g, p);
      if (!p.known && lead > 0 && g.time >= p.at - lead) warn(g, p);
      if (p.known && !p.prompted) tryPrompt(g, p);
      if (!p.siren && !p.aftershock && !p.manual && g.time >= p.at - 60 && countBuilt(g, 'warning_siren') > 0 && (p.known || p.type === 'flood' || p.type === 'storm' || p.type === 'tornado' || p.type === 'meteor')) {
        p.siren = true;
        if (!p.known) warn(g, p);
        emitD(g, p, 'warn', { eta: p.at - g.time, siren: true });
        g.news('disaster', `Sirenenalarm! ${p.name} – sucht Schutz in Gebäuden und Notunterkünften.`, 'bad', { x: Math.floor(p.x), y: Math.floor(p.y) });
      }
      if (g.time >= p.at) start(g, p);
    }
    stepActive(g, minutes);
    stepRepairs(g, minutes);
    // Blitze bei Gewitter
    if (w.stormI > 0.15) {
      let p = 5 * w.stormI * (minutes / 60);
      while (p > 0) { if (rnd(st) < Math.min(1, p)) strike(g); p -= 1; }
    }
  },
  hourly(g, h) {
    const st = g.ext.disasters;
    updateFields(g);
    for (const a of st.active) {
      if (a.type === 'wildfire') stepWildfire(g, a);
      if (h % 2 === 0) emitD(g, a, 'update');
    }
    hourlyRescue(g);
    hourlyRubble(g);
    hourlyShelter(g);
  },
  daily(g, day) {
    dailyAftermath(g);
    dailyPlanning(g, day);
  },
  serialize,
  load,
  renderables,
  // Für Skripte, Tests und Werkzeuge: g.system('disasters').trigger(g, 'tornado', { x, y, intensity })
  trigger: triggerDisaster, plan: planDisaster, prep: doPrep, rebuild: rebuildRuin, strike,
});
