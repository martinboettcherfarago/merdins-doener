// System „Wirtschaft & Industrie": Warenwirtschaft, Handel, Konjunktur, Dienstbudgets, Dichte-Steuern.
// Hooks: init(g) · step(g, minuten) · hourly(g, h) · daily(g, tag) · weekly(g) · serialize(g) → Daten · load(g, daten) · renderables(g) → [...]
// Zustand gehört nach g.ext.industry. Keine Imports aus render/ oder ui/ (läuft auch headless im Test).
//
// Warenströme (alles in Tonnen pro Tag, stündlich gerechnet):
//   Spezialindustrie (Bauernhof, Forst, Bergwerk, Ölförderung) liefert Rohstoffe
//   → Verarbeitung (Lebensmittelfabrik, Sägewerk, Stahlwerk, Raffinerie) macht daraus wertvollere Waren
//   → Vorprodukte (Holzwaren, Stahl, Kunststoff) machen Fabriken der Industriezone bis zu 40 % produktiver
//   → Läden brauchen Konsumgüter und Lebensmittel: Ware aus der Stadt ist gut, Importware teurer, Mangel kostet
//     Glück und auf Dauer Stufen. Läden nahe an Fabriken und Lagerhallen werden zuerst beliefert.
//   → Überschüsse gehen in den Export (Lkw über die Autobahn, Güterbahnhof, Frachthafen) zu schwankenden
//     Weltmarktpreisen; der Spieler setzt je Ware einen Preis (70–150 %), der Weltmarkt reagiert darauf.
//   → Lagerhallen puffern: sie halten bei niedrigen Preisen zurück, verkaufen bei hohen und beliefern Läden.
//   Lkw und Lieferwagen fahren passend zu diesen Strömen über das echte Straßennetz (g.traffic).
//
// Für andere Agenten lesbar:
//   g.ext.industry.rec.get(b.id) → { kind: 'raw'|'factory'|'shop'|'proc'|'wh'|'cargo'|'market', good, out, sales, supply, … }
//   g.ext.industry.tot → Kennzahlen der Stadt (supplyCom, salesInd, exportT, importT, freightUse, trucksDay …)
//   g.ext.industry.flow[ware] → { prod, local, exp, imp, whIn, whOut, unsold, need, short } (t/Tag, geglättet)
//   g.ext.industry.cycle.value → Konjunktur von −1 (Rezession) bis +1 (Boom)
//   g.ext.industry.jobs → Arbeitsplätze in städtischen Betrieben (Verarbeitung, Lager, Umschlag, Markthallen)
import { registerSystem, HAPPINESS_FACTORS, DEMAND_MODIFIERS, BUDGET_LINES, LANDVALUE_TERMS, emit } from '../../registry.js';
import { BUILDINGS, Z, TAX_RATE, T } from '../../config.js';
import { clamp, WeightedList, fmtMoney, typedToB64, b64ToTyped } from '../../util.js';
import { findPath } from '../network.js';
import { VT } from '../traffic.js';
import { GOODS, GOOD_KEYS, RAW_KEYS, INPUT_KEYS, RAW_OF_SPEC, SPEC_NAMES, SPEC_HOWTO, ECON } from '../../content/industry.js';

const DT = 1 / 24; // ein Takt = eine Spielstunde
const TAU = Math.PI * 2;
const pct = (f) => `${Math.round(f * 100)} %`;

// ---------------------------------------------------------------- Dienstbudgets
// g.serviceBudget[kategorie] (0,5–1,5) skaliert im Kern bereits Unterhalt und die Kapazität von Diensten
// mit Abdeckung (Müll, Polizei, Feuerwehr, Gesundheit, Bildung). Dieses System ergänzt die Wirkung für
// Strom, Wasser, Lerntempo, Parkpflege und die städtischen Betriebe der Logistik.
export const utilFactor = (v) => 1 + (v - 1) * 0.5;
export const eduFactor = (v) => 1 + (v - 1) * 0.6;
export const logFactor = (v) => 1 + (v - 1) * 0.4;
export const BUDGET_CATS = [
  { id: 'power', name: 'Strom', what: 'Kraftwerke', effect: (v) => `Kraftwerksleistung ${pct(utilFactor(v))}` },
  { id: 'water', name: 'Wasser', what: 'Wassertürme, Pumpen, Wasserwerke', effect: (v) => `Förderleistung ${pct(utilFactor(v))}` },
  { id: 'garbage', name: 'Müll', what: 'Deponien, Verbrennung, Recycling', effect: (v) => `Kapazität der Müllabfuhr ${pct(v)}` },
  { id: 'services', name: 'Dienste', what: 'Polizei, Feuerwehr, Ärzte, Verwaltung', effect: (v) => `Kapazität von Wachen und Praxen ${pct(v)}` },
  { id: 'education', name: 'Bildung', what: 'Kitas, Schulen, Bibliotheken, Universitäten', effect: (v) => `Plätze ${pct(v)} · Lerntempo ${pct(eduFactor(v))}` },
  { id: 'parks', name: 'Parks', what: 'Parks, Sport und Freizeit', effect: (v) => (Math.abs(v - 1) < 0.01 ? 'Normale Pflege' : v > 1 ? `Gute Pflege: Glück und Bodenwert am Park steigen` : `Verwahrlosung: Glück und Bodenwert am Park sinken`) },
  { id: 'industry', name: 'Logistik', what: 'Verarbeitung, Lager, Güterumschlag, Markthallen', effect: (v) => `Leistung der städtischen Betriebe ${pct(logFactor(v))}` },
];
export function budgetOf(g, cat) { return clamp(g.serviceBudget[cat] ?? 1, 0.5, 1.5); }
export function categoryUpkeep(g, cat) {
  let sum = 0;
  for (const b of g.buildings.values()) {
    if (b.zone || b.key === 'station') continue;
    const d = BUILDINGS[b.key];
    if (d && d.cat === cat) sum += (d.upkeep || 0) * g.upkeepMul();
  }
  return sum; // bei 100 %
}
export function setServiceBudget(g, cat, v) {
  g.serviceBudget[cat] = clamp(Math.round(v * 20) / 20, 0.5, 1.5);
  applyBudgetMods(g);
  g.dirty.coverage = g.dirty.util = true;
  g.emit('money');
}
// Strom, Wasser und Lerntempo laufen über g.mods (wird gespeichert). Der eigene Anteil wird
// herausgerechnet und neu angewandt, damit Wochenkarten (die g.mods multiplizieren) erhalten bleiben.
function applyBudgetMods(g) {
  const st = g.ext.industry;
  if (!st) return;
  for (const [key, cat, fn] of [['power', 'power', utilFactor], ['water', 'water', utilFactor], ['edu', 'education', eduFactor]]) {
    const want = fn(budgetOf(g, cat));
    const have = st.applied[key] || 1;
    if (Math.abs(want - have) > 1e-9) {
      g.mods[key] = (g.mods[key] / have) * want;
      st.applied[key] = want;
      g.dirty.util = true;
    }
  }
  st.parkLV = (budgetOf(g, 'parks') - 1) * 12;
}

// ---------------------------------------------------------------- Bedienung (für das Panel)
export function setExportPrice(g, k, mul) {
  const st = g.ext.industry;
  if (st && st.prices[k] !== undefined) st.prices[k] = clamp(Math.round(mul * 20) / 20, 0.7, 1.5);
}
export function setBuyRaw(g, on) { if (g.ext.industry) g.ext.industry.buyRaw = !!on; }
// Handelskammer: passt die Exportpreise täglich an – billiger, wenn Ware liegen bleibt, teurer, wenn der Weltmarkt mehr will
export function setAutoPrice(g, on) { if (g.ext.industry) g.ext.industry.autoPrice = !!on; }
function autoPrices(g, st) {
  for (const k of GOOD_KEYS) {
    const f = st.flow[k];
    if (f.prod < 2) continue;
    const p = st.prices[k];
    if (f.unsold > f.prod * 0.05 && p > 0.7) setExportPrice(g, k, p - 0.05);
    else if (f.unsold < 0.5 && f.exp > 2 && marketDemand(g, k) > f.exp * 1.3 && p < 1.5) setExportPrice(g, k, p + 0.05);
  }
}
export const WH_MODES = { balance: 'Ausgleich', fill: 'Füllen', empty: 'Leeren' };
export function setWarehouseMode(g, id, mode) {
  const s = whState(g.ext.industry, id);
  if (s && WH_MODES[mode]) s.mode = mode;
}
export function setWarehouseGood(g, id, good) {
  const s = whState(g.ext.industry, id);
  if (s && (good === 'auto' || GOODS[good])) s.good = good;
}
export function cycleWarehouseGood(g, id) {
  const s = whState(g.ext.industry, id);
  if (!s) return;
  const list = ['auto', ...GOOD_KEYS];
  s.good = list[(list.indexOf(s.good) + 1) % list.length];
}
// Dichte-Steuern: Zuschlag/Nachlass in Prozentpunkten auf den Zonensteuersatz,
// k = 0 für Stufe 1–2 (geringe Dichte), k = 1 für Stufe 4–5 (hohe Dichte). Stufe 3 zahlt den Grundsatz.
export function setDensityTax(g, z, k, delta) {
  const st = g.ext.industry;
  if (!st || !st.dens[z]) return;
  st.dens[z][k] = clamp(Math.round(delta), -5, 5);
  g.emit('money');
}
export function densityDelta(g, b) {
  const st = g.ext.industry;
  if (!st || !b.zone) return 0;
  const dz = st.dens[b.zone];
  const d = b.level <= 2 ? dz[0] : b.level >= 4 ? dz[1] : 0;
  return Math.max(d, -g.taxes[b.zone]);
}
export function effectiveTax(g, b) { return g.taxes[b.zone] + densityDelta(g, b); }

// ---------------------------------------------------------------- Konjunktur
export function cycleLabel(v) { return v > 0.5 ? 'Boom' : v > 0.15 ? 'Aufschwung' : v > -0.15 ? 'Stabil' : v > -0.5 ? 'Abschwung' : 'Rezession'; }
// Prognose der Wirtschaftsforscher: Grundwelle in n Tagen (ohne Zufall und Schocks)
export function cycleForecast(g, days = 7) {
  const c = g.ext.industry.cycle;
  return clamp(0.7 * Math.sin(c.phase + (TAU / c.period) * days) + c.noise * Math.pow(0.85, days) + c.shock * Math.pow(0.92, days), -1, 1);
}
const CYCLE_NEWS = {
  Boom: ['Konjunktur: Boom! Der Weltmarkt reißt sich um Waren, die Exportpreise steigen.', 'good'],
  Aufschwung: ['Konjunktur: Die Wirtschaft zieht an. Mehr Nachfrage nach Gewerbe, Industrie und Büros.', 'good'],
  Stabil: ['Konjunktur: Die Wirtschaftslage beruhigt sich.', 'info'],
  Abschwung: ['Konjunktur: Abschwung. Exportpreise und Nachfrage geben nach – Lagerhallen können Ware zurückhalten.', 'bad'],
  Rezession: ['Konjunktur: Rezession! Weniger Exporte, weniger Steuern. Jetzt hilft ein dickes Polster in der Kasse.', 'bad'],
};

// ---------------------------------------------------------------- Zustand
function rnd(st) { st.seed = (Math.imul(st.seed, 1664525) + 1013904223) >>> 0; return st.seed / 4294967296; }
const emptyPool = () => ({ prod: 0, need: 0, local: 0, whIn: 0, whOut: 0, imp: 0, exp: 0, expWh: 0, unsold: 0, short: 0 });
const ZERO_ACC = () => ({ export: 0, local: 0, rawbuy: 0, market: 0, exportT: 0, importT: 0, unsoldT: 0, hours: 0 });

function freshState(g) {
  const market = {}, prices = {}, flow = {};
  for (const k of GOOD_KEYS) { market[k] = { idx: 1, trend: 0, shock: 0, shockDays: 0 }; prices[k] = 1; flow[k] = emptyPool(); }
  return {
    v: 1,
    seed: (((g.opts.seed || 1) * 2654435761) ^ 0x5eed) >>> 0 || 1,
    market, prices, buyRaw: true, autoPrice: false,
    cycle: { phase: 0.2, period: 48, noise: 0, shock: 0, value: 0.14, label: 'Stabil', since: 0 },
    dens: { 1: [0, 0], 2: [0, 0], 3: [0, 0], 4: [0, 0] },
    densAvg: { 1: 0, 2: 0, 3: 0, 4: 0 },
    applied: { power: 1, water: 1, edu: 1 },
    perm: { market: 1, proc: 1, storage: 1, harbor: 1 },
    parkLV: 0,
    wh: {}, // Lagerhallen: id → { mode, good, stock: { ware: t } }
    flow, // aktuelle Raten (t/Tag, geglättet)
    tot: {},
    acc: ZERO_ACC(), // Summen des laufenden Tages (€ bzw. t)
    lines: { export: 0, local: 0, rawbuy: 0, market: 0, cycle: 0, density: 0 }, // € pro Tag für den Haushalt
    hist: [],
    rec: new Map(),
    jobs: 0,
    plan: null, truckAcc: 0, trucksToday: 0, // Lieferverkehr (flüchtig)
    news: {},
    nextShock: 14,
    first: {},
    _ships: null,
  };
}
function whState(st, id) {
  if (!st) return null;
  return st.wh[id] || (st.wh[id] = { mode: 'balance', good: 'auto', stock: {} });
}
const stockSum = (s) => { let t = 0; for (const k in s.stock) t += s.stock[k]; return t; };

function say(g, st, key, days, text, mood = 'info', where = null) {
  const d = g.day();
  if (st.news[key] !== undefined && d - st.news[key] < days) return false;
  st.news[key] = d;
  g.news('economy', text, mood, where);
  return true;
}

// ---------------------------------------------------------------- Markt
function reachOf(g, st) {
  return 1 + ECON.reachPerMilestone * g.milestone + g.stats.pop * ECON.reachPerPop + (st.tot.reachBonus || 0);
}
// Weltmarktpreis in € je t (ohne Preisstufe des Spielers)
export function worldPrice(g, k) {
  const st = g.ext.industry;
  const m = st.market[k];
  return GOODS[k].price * m.idx * (1 + (m.shock || 0)) * Math.max(0.2, 1 + g.eff('ecoPrice') + g.eff('ecoPrice:' + k));
}
// Einkaufspreis für Rohstoff-Zukäufe der Verarbeitung in € je t
export function buyPrice(g, k) {
  const m = g.ext.industry.market[k];
  return (GOODS[k].buy || GOODS[k].price) * m.idx * (1 + (m.shock || 0));
}
// Aufnahme des Weltmarkts in t/Tag beim aktuellen Preis des Spielers
export function marketDemand(g, k, priceMul) {
  const st = g.ext.industry;
  const m = st.market[k];
  const p = priceMul ?? st.prices[k];
  const mul = Math.max(0.1, 1 + g.eff('ecoMarket') + g.eff('ecoMarket:' + k) + 0.5 * Math.max(0, m.shock || 0));
  return GOODS[k].market * reachOf(g, st) * st.perm.market * (1 + 0.35 * st.cycle.value) * mul * priceResponse(p);
}
// Wie stark der Weltmarkt auf den Preis des Spielers reagiert: Rabatte locken mäßig, Aufschläge schrecken deutlich ab.
export function priceResponse(p) { return Math.pow(p, p > 1 ? -ECON.elasticity * 1.4 : -ECON.elasticity * 0.85); }

// ---------------------------------------------------------------- Lager (Hilfen innerhalb eines Takts)
function whTake(W, k, want, modes) {
  if (want <= 1e-9) return 0;
  let got = 0;
  for (const w of W) {
    if (!modes.includes(w.s.mode)) continue;
    const have = (w.s.stock[k] || 0) / DT;
    const can = Math.min(have, w.rate, want - got);
    if (can <= 1e-9) continue;
    w.s.stock[k] = Math.max(0, (w.s.stock[k] || 0) - can * DT);
    w.rate -= can; w.outT += can; got += can;
    if (got >= want - 1e-9) break;
  }
  return got;
}
// Verkauf aus dem Lager in den Export: „Leeren" immer, „Ausgleich" bei hohem Preis alles,
// bei normalem Preis nur, was über 60 % Füllstand liegt (damit Lager nicht dauerhaft verstopfen).
function whTakeExport(W, k, want, idx) {
  if (want <= 1e-9) return 0;
  let got = 0;
  for (const w of W) {
    let free = 0;
    const have = w.s.stock[k] || 0;
    if (w.s.mode === 'empty' || (w.s.mode === 'balance' && idx > 1.08)) free = have;
    else if (w.s.mode === 'balance' && idx >= 0.92) free = Math.min(have, Math.max(0, stockSum(w.s) - w.cap * 0.6));
    const can = Math.min(free / DT, w.rate, want - got);
    if (can <= 1e-9) continue;
    w.s.stock[k] = Math.max(0, have - can * DT);
    w.rate -= can; w.outT += can; got += can;
    if (got >= want - 1e-9) break;
  }
  return got;
}
function whPut(W, k, amount, modes) {
  if (amount <= 1e-9) return 0;
  let put = 0;
  for (const w of W) {
    if (!modes.includes(w.s.mode)) continue;
    if (w.s.good !== 'auto' && w.s.good !== k) continue;
    // Automatisch: eine Ware belegt höchstens 60 % der Halle, damit Platz für andere bleibt
    // (Rohstoffe höchstens 35 %, damit Konsumgüter und Lebensmittel für die Läden Platz finden)
    let room = Math.max(0, w.cap - stockSum(w.s));
    if (w.s.good === 'auto') room = Math.min(room, Math.max(0, w.cap * (GOODS[k].tier === 0 ? 0.35 : 0.6) - (w.s.stock[k] || 0)));
    room /= DT;
    const can = Math.min(room, w.rate, amount - put);
    if (can <= 1e-9) continue;
    w.s.stock[k] = (w.s.stock[k] || 0) + can * DT;
    w.rate -= can; w.inT += can; put += can;
    if (put >= amount - 1e-9) break;
  }
  return put;
}

// ---------------------------------------------------------------- Jahreszeiten und Vorkommen
// Ernte nach Jahreszeit (g.ext.weather von S4; fehlt das Wetter, gilt Sommer = 1)
export const SEASON_FARM = { spring: 0.9, summer: 1.1, autumn: 1.3, winter: 0.55 };
export const SEASON_NAMES = { spring: 'Frühling', summer: 'Sommer', autumn: 'Herbst', winter: 'Winter' };
function seasonFactor(g) {
  const w = g.ext && g.ext.weather;
  return w && SEASON_FARM[w.season] ? SEASON_FARM[w.season] : 1;
}
// Erz- und Ölvorkommen gehen langsam zur Neige (Felder und Wälder wachsen nach).
// st.depl[i] = abgebauter Anteil 0..1 je Feld; ein Feld trägt DEPOSIT_T Tonnen.
const DEPLETING = { mine: 1, oil: 1 };
const DEPOSIT_T = 12000;
const DEPOSIT_LOW = 0.3; // darunter sinkt die Förderung
function depletionOf(g, st, b) {
  if (!st.depl) return 0;
  let s = 0;
  for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) s += st.depl[yy * g.W + xx];
  return s / (b.w * b.h);
}
function depleteDaily(g, st) {
  for (const b of g.buildings.values()) {
    if (!b.spec || !DEPLETING[b.spec] || b.construct < 1 || b.abandoned) continue;
    const r = st.rec.get(b.id);
    if (!r || !(r.out > 0)) continue;
    if (!st.depl) st.depl = new Float32Array(g.N);
    const per = r.out / (b.w * b.h * DEPOSIT_T);
    for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) {
      const i = yy * g.W + xx;
      st.depl[i] = Math.min(1, st.depl[i] + per);
    }
    const left = 1 - depletionOf(g, st, b);
    if (left < DEPOSIT_LOW && !st.first['dep' + b.id]) {
      st.first['dep' + b.id] = 1;
      say(g, st, 'dep' + b.id, 0, `${b.spec === 'mine' ? 'Ein Bergwerk' : 'Ein Ölfeld'} ist fast ausgebeutet (${Math.round(left * 100)} % Vorkommen) – die Förderung sinkt. Neue ${b.spec === 'mine' ? 'Erzfelder' : 'Ölvorkommen'} erschließen.`, 'info', b);
    }
  }
}

// ---------------------------------------------------------------- Der stündliche Wirtschaftstakt
function rec(st, b, kind) {
  let r = st.rec.get(b.id);
  if (!r || r.kind !== kind) {
    r = { kind, good: null, out: 0, sales: 1, supply: 1, local: 0, imp: 0, short: 0, need: 0, boost: 0, util: 0, cap: 0, in: 0, staff: 1, shortDays: 0, lowDays: 0, dist: 0 };
    st.rec.set(b.id, r);
  }
  return r;
}

// Entfernungsfeld (8-Nachbarschaft, Diagonale √2) in zwei Durchläufen; D: 0 an Quellen, sonst groß
function chamfer(D, W, H) {
  const S2 = Math.SQRT2;
  for (let y = 0; y < H; y++) {
    const r = y * W;
    for (let x = 0; x < W; x++) {
      const i = r + x;
      let v = D[i];
      if (x > 0 && D[i - 1] + 1 < v) v = D[i - 1] + 1;
      if (y > 0) {
        const j = i - W;
        if (D[j] + 1 < v) v = D[j] + 1;
        if (x > 0 && D[j - 1] + S2 < v) v = D[j - 1] + S2;
        if (x < W - 1 && D[j + 1] + S2 < v) v = D[j + 1] + S2;
      }
      D[i] = v;
    }
  }
  for (let y = H - 1; y >= 0; y--) {
    const r = y * W;
    for (let x = W - 1; x >= 0; x--) {
      const i = r + x;
      let v = D[i];
      if (x < W - 1 && D[i + 1] + 1 < v) v = D[i + 1] + 1;
      if (y < H - 1) {
        const j = i + W;
        if (D[j] + 1 < v) v = D[j] + 1;
        if (x < W - 1 && D[j + 1] + S2 < v) v = D[j + 1] + S2;
        if (x > 0 && D[j - 1] + S2 < v) v = D[j - 1] + S2;
      }
      D[i] = v;
    }
  }
}

function tick(g, st) {
  const s = g.stats;
  const cyc = st.cycle.value;
  const logEff = logFactor(budgetOf(g, 'industry')) * st.perm.proc;
  const live = new Set();
  const raws = { crops: [], wood: [], ore: [], oil: [] };
  const facs = [], shops = [], procs = [], whs = [], cargos = [], markets = [];
  let jobs = 0;
  const taxMul = 1 + g.eff('taxMul') + (g.hasBuilt('townhall') ? 0.08 : 0);
  let zoneTax = 0, densInc = 0;
  const densW = { 1: [0, 0], 2: [0, 0], 3: [0, 0], 4: [0, 0] };
  const prodFac = 1 + g.eff('ecoProd:factory');
  const seasonMul = seasonFactor(g);

  // --- 1) Gebäude einsammeln
  for (const b of g.buildings.values()) {
    const ok = b.construct >= 1 && !b.abandoned;
    if (b.zone) {
      // Steuern für Konjunktur und Dichte-Zuschläge
      if (ok && b.occ > 0) {
        let base = b.occ * TAX_RATE[b.zone] * taxMul;
        if (b.zone === Z.RES && g.policies.has('tenants')) base *= 0.9;
        if (b.zone === Z.COM) base *= (g.policies.has('nightquiet') ? 0.9 : 1) * (1 + g.eff('comTax'));
        if (b.zone >= 2) zoneTax += base * g.taxes[b.zone];
        const dd = densityDelta(g, b);
        densInc += base * dd;
        densW[b.zone][0] += dd * b.occ; densW[b.zone][1] += b.occ;
      }
      if (b.zone === Z.IND) {
        live.add(b.id);
        const eff = ok ? (b.powered ? 1 : 0.4) * (b.connected ? 1 : 0) : 0;
        if (b.spec && RAW_OF_SPEC[b.spec]) {
          const r = rec(st, b, 'raw');
          r.good = RAW_OF_SPEC[b.spec];
          r.season = b.spec === 'farm' ? seasonMul : 1;
          r.deposit = DEPLETING[b.spec] ? 1 - depletionOf(g, st, b) : 1;
          r.depMul = r.deposit >= DEPOSIT_LOW ? 1 : Math.max(0.05, r.deposit / DEPOSIT_LOW);
          r.out = b.occ * ECON.rawRate[b.spec] * ECON.levelProd[b.level] * eff * Math.max(0, 1 + g.eff('ecoProd:' + b.spec)) * r.season * r.depMul;
          raws[r.good].push({ b, r });
        } else {
          const r = rec(st, b, 'factory');
          r.good = 'goods';
          r.base = b.occ * ECON.factoryRate * ECON.levelProd[b.level] * eff * Math.max(0, prodFac);
          facs.push({ b, r });
        }
      } else if (b.zone === Z.COM) {
        live.add(b.id);
        const r = rec(st, b, 'shop');
        r.need = ok && b.connected ? b.occ * ECON.comNeed * ECON.comLevel[b.level] : 0;
        shops.push({ b, r });
      }
      continue;
    }
    const d = BUILDINGS[b.key];
    if (!d || !(d.output || d.storage || d.cargo || d.goodsDemand)) continue;
    live.add(b.id);
    if (ok) jobs += d.jobs || 0;
    if (d.output) procs.push({ b, d, r: rec(st, b, 'proc'), ok });
    else if (d.storage) whs.push({ b, d, r: rec(st, b, 'wh'), ok });
    else if (d.cargo) cargos.push({ b, d, r: rec(st, b, 'cargo'), ok });
    else if (d.goodsDemand) markets.push({ b, d, r: rec(st, b, 'market'), ok });
  }
  for (const id of st.rec.keys()) if (!live.has(id)) st.rec.delete(id);
  for (const id of Object.keys(st.wh)) if (!live.has(+id)) delete st.wh[id];
  st.jobs = jobs;
  const staff = s.workers > 0 ? clamp(s.workers / Math.max(1, s.jobs + jobs), 0, 1) : 0;

  // Lager, Frachtkapazität
  const W = whs.map(({ b, d, r, ok }) => {
    const ws = whState(st, b.id);
    const cap = d.storage * st.perm.storage;
    const rate = ok ? d.storage * 1.2 * logEff * (b.powered ? 1 : 0.5) * (b.connected ? 1 : 0) * staff : 0;
    r.cap = cap; r.good = ws.good; r.staff = staff;
    return { b, r, s: ws, cap, rate, inT: 0, outT: 0 };
  });
  const flowMul = 0.55 + 0.45 * clamp(s.trafficFlow, 0, 1);
  const freightEff = Math.max(0.1, 1 + g.eff('ecoFreight'));
  let truckCap = (ECON.truckBase + ECON.truckPerPop * s.pop + W.filter((w) => w.rate > 0).length * ECON.warehouseTruck) * flowMul * freightEff * Math.max(0.1, 1 + g.eff('ecoTruck'));
  if (s.pop < 30) truckCap *= s.pop / 30;
  let railCap = 0, harborCap = 0, railBonus = 0, harborBonus = 0, reachBonus = 0;
  for (const c of cargos) {
    const cap = c.ok ? c.d.cargo * logEff * (c.b.powered ? 1 : 0.4) * (c.b.connected ? 1 : 0) * freightEff * staff * (c.b.key === 'cargo_harbor' ? st.perm.harbor : 1) : 0;
    c.r.cap = cap; c.r.staff = staff;
    if (c.b.key === 'cargo_harbor') { harborCap += cap; if (cap > 0) harborBonus = Math.max(harborBonus, c.d.priceBonus || 0); }
    else { railCap += cap; if (cap > 0) railBonus = Math.max(railBonus, c.d.priceBonus || 0); }
  }
  if (harborCap > 0) reachBonus += BUILDINGS.cargo_harbor.reach;
  if (railCap > 0) reachBonus += BUILDINGS.cargo_rail.reach;
  const freightCap = truckCap + railCap + harborCap;
  let freightLeft = freightCap;

  const P = {};
  for (const k of GOOD_KEYS) P[k] = emptyPool();
  let rawBuy = 0, localRev = 0, marketRev = 0;
  // Warenstrom-Verbindungen für das Diagramm im Wirtschaftsfenster (t/Tag)
  const lk = { rawProc: 0, whProc: 0, impProc: 0, rawShop: 0, rawExp: 0, rawWh: 0, rawLeft: 0, procFac: 0, whFac: 0, procShop: 0, procExp: 0, procWh: 0, procLeft: 0, facShop: 0, facExp: 0, facWh: 0, facLeft: 0, impShop: 0, whShop: 0, whExp: 0 };

  // --- 2) Rohstoffe → Verarbeitung
  for (const k of RAW_KEYS) for (const { r } of raws[k]) P[k].prod += r.out;
  const procNeed = { crops: 0, wood: 0, ore: 0, oil: 0 };
  for (const p of procs) {
    const d = p.d, b = p.b;
    p.r.good = d.output; p.r.input = d.input; p.r.staff = staff;
    p.cap = p.ok ? d.throughput * staff * (b.powered ? 1 : 0.3) * (b.connected ? 1 : 0) * logEff * Math.max(0, 1 + g.eff('ecoProd:proc')) : 0;
    procNeed[d.input] += p.cap;
  }
  const procGot = {};
  const rawImpMax = freightCap * 0.4;
  let rawImp = 0;
  for (const k of RAW_KEYS) {
    const need = procNeed[k];
    P[k].need += need;
    let local = Math.min(P[k].prod, need);
    let short = need - local;
    const wo = whTake(W, k, short, ['balance', 'empty']);
    short -= wo; P[k].whOut += wo;
    let imp = 0;
    if (short > 0 && st.buyRaw) {
      imp = Math.min(short, rawImpMax - rawImp, freightLeft);
      rawImp += imp; freightLeft -= imp;
      rawBuy += imp * buyPrice(g, k);
    }
    P[k].local += local; P[k].imp += imp; P[k].short += short - imp;
    procGot[k] = need > 0 ? (local + wo + imp) / need : 0;
    lk.rawProc += local; lk.whProc += wo; lk.impProc += imp;
  }
  for (const p of procs) {
    const ratio = procGot[p.d.input] || 0;
    p.r.cap = p.cap;
    p.r.in = p.cap * ratio;
    p.r.out = p.r.in * p.d.yield;
    p.r.util = p.cap > 0 ? ratio : 0;
    P[p.d.output].prod += p.r.out;
  }

  // --- 3) Vorprodukte → Fabriken
  let baseSum = 0;
  for (const f of facs) baseSum += f.r.base;
  const inputNeed = baseSum * ECON.inputRate;
  let inAvail = 0;
  for (const k of INPUT_KEYS) inAvail += P[k].prod;
  let take = Math.min(inputNeed, inAvail);
  lk.procFac = take;
  for (const k of INPUT_KEYS) {
    const share = inAvail > 0 ? (P[k].prod / inAvail) * take : 0;
    P[k].local += share; P[k].need += share;
  }
  if (take < inputNeed) {
    for (const k of INPUT_KEYS) {
      const wo = whTake(W, k, inputNeed - take, ['balance', 'empty']);
      P[k].whOut += wo; P[k].need += wo; take += wo; lk.whFac += wo;
    }
  }
  const boost = inputNeed > 0 ? take / inputNeed : 0;
  for (const f of facs) {
    f.r.boost = boost;
    f.r.out = f.r.base * (1 + ECON.inputBoost * boost);
    P.goods.prod += f.r.out;
  }

  // --- 4) Läden: Konsumgüter und Lebensmittel
  let needSum = 0;
  for (const sh of shops) needSum += sh.r.need;
  const tourNeed = needSum > 0 ? s.tourism * ECON.tourismNeed : 0;
  const shopGoods = (sh) => sh.r.need * (1 - ECON.foodShare) + (needSum > 0 ? (tourNeed * sh.r.need) / needSum : 0);
  const shopFood = (sh) => sh.r.need * ECON.foodShare;
  let needG = 0, needF = 0;
  for (const sh of shops) { sh.ng = shopGoods(sh); sh.nf = shopFood(sh); needG += sh.ng; needF += sh.nf; }
  // Konsumgüter
  const supply = (k, need, extra = null) => {
    const pool = P[k];
    pool.need += need;
    const local = Math.min(Math.max(0, pool.prod - pool.local), need);
    pool.local += local;
    let short = need - local;
    let fresh = 0;
    if (extra && short > 0) {
      const ep = P[extra.k];
      fresh = Math.min(Math.max(0, ep.prod - ep.local), short, need * extra.max);
      ep.local += fresh; short -= fresh;
    }
    const wo = whTake(W, k, short, ['balance', 'empty']);
    pool.whOut += wo; short -= wo;
    let wo2 = 0;
    if (extra && short > 0) { wo2 = whTake(W, extra.k, Math.min(short, need * extra.max - fresh), ['balance', 'empty']); P[extra.k].whOut += wo2; short -= wo2; }
    const imp = Math.min(short, Math.max(0, freightLeft));
    freightLeft -= imp; pool.imp += imp; short -= imp;
    pool.short += short;
    return { local: local + fresh, fresh, wh: wo + wo2, imp, short, got: need - short };
  };
  const SG = supply('goods', needG);
  const SF = supply('food', needF, { k: 'crops', max: ECON.freshShare });
  lk.facShop = SG.local; lk.procShop = SF.local - SF.fresh; lk.rawShop = SF.fresh;
  lk.impShop = SG.imp + SF.imp; lk.whShop = SG.wh + SF.wh;
  // Verteilung nach Entfernung zur nächsten Bezugsquelle (Fabriken, Lager, Umschlag, Autobahn)
  if (shops.length) {
    // Abstandsfeld je Quellenart (Chamfer, zwei Durchläufe über das Raster): O(Felder) statt Läden × Quellen (Q4-Messung: 42 % Rechenzeit)
    const N = g.N, Wd = g.W;
    const groups = new Map();
    const src = (b, m) => { const t = Math.min(g.H - 1, Math.floor(b.y + b.h / 2)) * Wd + Math.min(Wd - 1, Math.floor(b.x + b.w / 2)); (groups.get(m) || groups.set(m, []).get(m)).push(t); };
    for (const f of facs) if (f.r.out > 0.2) src(f.b, 1);
    for (const p of procs) if (p.d.output === 'food' && p.r.out > 0.2) src(p.b, 1);
    for (const w of W) if (w.rate > 0) src(w.b, 0.5);
    for (const c of cargos) if (c.r.cap > 0) src(c.b, 0.8);
    (groups.get(1.2) || groups.set(1.2, []).get(1.2)).push(g.world.highwayEnd);
    const best = st._best && st._best.length === N ? st._best : (st._best = new Float32Array(N));
    const D = st._dfield && st._dfield.length === N ? st._dfield : (st._dfield = new Float32Array(N));
    best.fill(1e9);
    for (const [m, tiles] of groups) {
      D.fill(1e9);
      for (const t of tiles) D[t] = 0;
      chamfer(D, Wd, g.H);
      for (let i = 0; i < N; i++) { const v = D[i] * m; if (v < best[i]) best[i] = v; }
    }
    for (const sh of shops) {
      const t = Math.min(g.H - 1, Math.floor(sh.b.y + sh.b.h / 2)) * Wd + Math.min(Wd - 1, Math.floor(sh.b.x + sh.b.w / 2));
      const d = best[t];
      sh.dist = d + (sh.b.id % 7) * 0.01;
      sh.r.dist = d;
    }
    shops.sort((a, c) => a.dist - c.dist);
    let remG = SG.got, remF = SF.got;
    const shareG = SG.got > 0 ? { l: SG.local / SG.got, w: SG.wh / SG.got, i: SG.imp / SG.got } : { l: 0, w: 0, i: 0 };
    const shareF = SF.got > 0 ? { l: SF.local / SF.got, w: SF.wh / SF.got, i: SF.imp / SF.got } : { l: 0, w: 0, i: 0 };
    for (const sh of shops) {
      const gG = Math.min(sh.ng, remG); remG -= gG;
      const gF = Math.min(sh.nf, remF); remF -= gF;
      const n = sh.ng + sh.nf;
      const r = sh.r;
      if (n <= 1e-6) { r.supply = 1; r.local = 0; r.imp = 0; r.short = 0; r.got = 0; continue; }
      const sup = (gG + gF) / n;
      const loc = (gG * (shareG.l + shareG.w) + gF * (shareF.l + shareF.w)) / n;
      const imp = (gG * shareG.i + gF * shareF.i) / n;
      r.supply = r.supply * 0.75 + sup * 0.25;
      r.local = r.local * 0.75 + loc * 0.25;
      r.imp = r.imp * 0.75 + imp * 0.25;
      r.short = clamp(1 - r.supply, 0, 1);
      r.got = gG + gF;
    }
  }
  // Markthallen: regionale Ernte und Lebensmittel
  for (const m of markets) {
    const want = m.ok && m.b.connected ? m.d.goodsDemand * logEff * staff : 0;
    let got = 0;
    for (const k of ['crops', 'food']) {
      const pool = P[k];
      const t = Math.min(Math.max(0, pool.prod - pool.local), want - got);
      pool.local += t; pool.need += t; got += t;
      if (k === 'crops') lk.rawShop += t; else lk.procShop += t;
    }
    if (got < want) { const wo = whTake(W, 'food', want - got, ['balance', 'empty']); P.food.whOut += wo; got += wo; lk.whShop += wo; }
    m.r.need = want; m.r.in = got; m.r.util = want > 0 ? got / want : 0; m.r.staff = staff;
    marketRev += got * ECON.marketFee;
  }
  // Erlöse städtischer Betriebe, die in der Stadt verkaufen (Lebensmittel an Läden, Vorprodukte an Fabriken)
  for (const k of [...INPUT_KEYS, 'food']) {
    const fromProc = Math.min(P[k].local, P[k].prod);
    localRev += fromProc * worldPrice(g, k) * ECON.localShare;
  }

  // --- 5) Lager und Export (wertvollste Waren zuerst)
  const order = [...GOOD_KEYS].sort((a, c) => worldPrice(g, c) * st.prices[c] - worldPrice(g, a) * st.prices[a]);
  const offer = {};
  for (const k of order) {
    const pool = P[k];
    let sur = Math.max(0, pool.prod - pool.local);
    let put = whPut(W, k, sur, ['fill']);
    const idx = st.market[k].idx * (1 + (st.market[k].shock || 0));
    if (idx < 0.92) put += whPut(W, k, sur - put, ['balance']);
    sur -= put; pool.whIn += put;
    offer[k] = sur;
  }
  let revBase = 0;
  for (const k of order) {
    const pool = P[k];
    const D = marketDemand(g, k);
    // „Leeren": Lagerware geht vor frischer Ware hinaus
    let rel = whTake(W, k, Math.min(D, Math.max(0, freightLeft)), ['empty']);
    freightLeft -= rel;
    const fromOffer = Math.max(0, Math.min(offer[k], D - rel, freightLeft));
    freightLeft -= fromOffer;
    const idx = st.market[k].idx * (1 + (st.market[k].shock || 0));
    if (rel + fromOffer < D && freightLeft > 1e-6) {
      const r2 = whTakeExport(W, k, Math.min(D - rel - fromOffer, freightLeft), idx);
      freightLeft -= r2; rel += r2;
    }
    pool.whOut += rel;
    pool.exp = fromOffer + rel;
    pool.expWh = rel;
    revBase += pool.exp * worldPrice(g, k) * st.prices[k];
    let left = offer[k] - fromOffer;
    if (left > 1e-6) { const put = whPut(W, k, left, ['balance', 'fill']); pool.whIn += put; left -= put; }
    pool.unsold = Math.max(0, left);
  }
  // Fracht auf Lkw, Bahn und Hafen verteilen (Importe zuerst per Lkw, Exporte zuerst per Schiff)
  let I = 0, E = 0;
  for (const k of GOOD_KEYS) { I += P[k].imp; E += P[k].exp; }
  let tL = truckCap, rL = railCap, hL = harborCap;
  const iT = Math.min(I, tL); tL -= iT;
  const iR = Math.min(I - iT, rL); rL -= iR;
  const iH = Math.max(0, I - iT - iR); hL -= iH;
  // Bahn und Hafen teilen sich die Exporte nach Kapazität, Lkw nehmen den Rest
  const ship = Math.min(E, Math.max(0, hL) + Math.max(0, rL));
  const eH = hL + rL > 0 ? ship * Math.max(0, hL) / (Math.max(0, hL) + Math.max(0, rL)) : 0;
  const eR = ship - eH;
  const eT = Math.max(0, E - ship);
  const routeBonus = E > 0 ? (eH * harborBonus + eR * railBonus) / E : 0;
  const exportRev = revBase * (1 + routeBonus);
  // Ergebnis der städtischen Betriebe (€/Tag): Erlös – Rohstoffzukauf – Unterhalt
  const upkeepOf = (b) => (BUILDINGS[b.key].upkeep || 0) * g.upkeepMul() * budgetOf(g, BUILDINGS[b.key].cat);
  for (const p of procs) {
    const k = p.d.output, pool = P[k];
    const wp = worldPrice(g, k);
    const perT = pool.prod > 0 ? (Math.min(pool.local, pool.prod) * wp * ECON.localShare + pool.exp * wp * st.prices[k] * (1 + routeBonus)) / pool.prod : 0;
    const r = p.d.input, impShare = procNeed[r] > 0 ? P[r].imp / procNeed[r] : 0;
    p.r.rev = p.r.out * perT;
    p.r.cost = p.r.in * impShare * buyPrice(g, r);
    p.r.profit = p.r.rev - p.r.cost - upkeepOf(p.b);
    p.r.impShare = procGot[r] > 0 ? impShare / procGot[r] : 0;
  }
  for (const m of markets) { m.r.rev = m.r.in * ECON.marketFee; m.r.profit = m.r.rev - upkeepOf(m.b); }

  // --- 6) Absatz je Ware → Kennzahlen der Erzeuger
  const sold = {};
  for (const k of GOOD_KEYS) sold[k] = P[k].prod > 1e-6 ? clamp(1 - P[k].unsold / P[k].prod, 0, 1) : 1;
  const ema = (old, v, a) => old + (v - old) * a;
  for (const k of RAW_KEYS) {
    const loc = P[k].prod > 0 ? Math.min(1, P[k].local / P[k].prod) : 0;
    for (const { r } of raws[k]) { r.sales = ema(r.sales, sold[k], 0.3); r.local = ema(r.local, loc, 0.3); }
  }
  for (const f of facs) f.r.sales = ema(f.r.sales, sold.goods, 0.3);
  for (const p of procs) p.r.sales = ema(p.r.sales, sold[p.d.output], 0.3);
  for (const w of W) { w.r.used = stockSum(w.s); w.r.inT = w.inT; w.r.outT = w.outT; w.r.util = w.cap > 0 ? w.r.used / w.cap : 0; }
  let railUsed = iR + eR, harborUsed = iH + eH;
  for (const c of cargos) {
    const share = c.b.key === 'cargo_harbor' ? (harborCap > 0 ? c.r.cap / harborCap : 0) * harborUsed : (railCap > 0 ? c.r.cap / railCap : 0) * railUsed;
    c.r.used = share; c.r.util = c.r.cap > 0 ? share / c.r.cap : 0;
  }

  // --- 7) Glätten, Kennzahlen, Tagessummen
  for (const k of GOOD_KEYS) {
    const f = st.flow[k], p = P[k];
    for (const key in p) f[key] = (f[key] || 0) + (p[key] - (f[key] || 0)) * 0.35;
    const tier = GOODS[k].tier, pre = tier === 0 ? 'raw' : tier === 1 ? 'proc' : 'fac';
    lk[pre + 'Exp'] += p.exp - p.expWh; lk.whExp += p.expWh; lk[pre + 'Wh'] += p.whIn; lk[pre + 'Left'] += p.unsold;
  }
  const sl = st.links || (st.links = {});
  for (const key in lk) sl[key] = (sl[key] || 0) + (lk[key] - (sl[key] || 0)) * 0.35;
  let prodInd = 0, unsoldInd = 0;
  for (const k of [...RAW_KEYS, 'goods']) { prodInd += P[k].prod; unsoldInd += P[k].unsold; }
  let supSum = 0, needSumAll = 0, locSum = 0, impSum = 0;
  for (const sh of shops) { const n = sh.ng + sh.nf; supSum += sh.r.supply * n; locSum += sh.r.local * n; impSum += sh.r.imp * n; needSumAll += n; }
  let stock = 0, stockCap = 0;
  for (const w of W) { stock += w.r.used; stockCap += w.cap; }
  const t = st.tot;
  t.supplyCom = needSumAll > 0 ? supSum / needSumAll : 1;
  t.shortCom = 1 - t.supplyCom;
  t.localCom = needSumAll > 0 ? locSum / needSumAll : 0;
  t.importCom = needSumAll > 0 ? impSum / needSumAll : 0;
  t.needCom = needG + needF;
  t.salesInd = ema(t.salesInd ?? 1, prodInd > 0 ? 1 - unsoldInd / prodInd : 1, 0.3);
  t.indProd = prodInd;
  t.boost = boost;
  t.freightCap = freightCap; t.truckCap = truckCap; t.railCap = railCap; t.harborCap = harborCap;
  t.truckUsed = iT + eT; t.railUsed = railUsed; t.harborUsed = harborUsed;
  t.freightUse = freightCap > 0 ? (I + E) / freightCap : 0;
  t.exportT = E; t.importT = I; t.rawImportT = rawImp;
  t.unsoldT = 0; for (const k of GOOD_KEYS) t.unsoldT += P[k].unsold;
  t.exportRate = exportRev; t.localRate = localRev; t.rawbuyRate = rawBuy; t.marketRate = marketRev;
  t.routeBonus = routeBonus; t.reachBonus = reachBonus; t.reach = reachOf(g, st);
  t.staff = staff; t.jobs = jobs; t.logEff = logEff;
  t.stock = stock; t.stockCap = stockCap;
  t.zoneTax = zoneTax;
  for (const z of [1, 2, 3, 4]) st.densAvg[z] = densW[z][1] > 0 ? densW[z][0] / densW[z][1] : 0;
  st.lines.cycle = zoneTax * 0.1 * cyc;
  st.lines.density = densInc;
  const a = st.acc;
  a.export += exportRev * DT; a.local += localRev * DT; a.rawbuy += rawBuy * DT; a.market += marketRev * DT;
  a.exportT += E * DT; a.importT += I * DT; a.unsoldT += t.unsoldT * DT; a.hours++;

  // --- 8) Lieferverkehr planen
  buildTruckPlan(g, st, { raws, facs, shops, procs, W, cargos, P, iT, iR, iH, eT, eR, eH });
}

// ---------------------------------------------------------------- Lieferverkehr
// Die Simulation rechnet Warenströme in Tonnen, hier werden daraus Lkw-Fahrten über das echte Straßennetz.
// Jeder sichtbare Lkw steht für mehrere echte Fahrten (wie Autos im Kern) und belastet die Straßen entsprechend.
const PCU = { truck: 2.2, van: 1.3 };
function buildTruckPlan(g, st, f) {
  const flows = [];
  const list = (items, w) => { const l = new WeightedList(); l.build(items, w); return l.total > 0 ? l : null; };
  const add = (tons, load, type, from, to) => { if (from && to && tons > 0.01) flows.push({ w: tons / load, type, from, to }); };
  const harbor = list(f.cargos.filter((c) => c.b.key === 'cargo_harbor' && c.r.cap > 0).map((c) => c.b), () => 1);
  const rail = list(f.cargos.filter((c) => c.b.key !== 'cargo_harbor' && c.r.cap > 0).map((c) => c.b), () => 1);
  const shopsL = list(f.shops.map((x) => x.b), (b) => st.rec.get(b.id)?.got || 0);
  const facsIn = list(f.facs.map((x) => x.b), (b) => st.rec.get(b.id)?.base || 0);
  const facsOut = list(f.facs.map((x) => x.b), (b) => st.rec.get(b.id)?.out || 0);
  const whOut = list(f.W.map((w) => w.b), (b) => st.rec.get(b.id)?.outT || 0);
  const whIn = list(f.W.map((w) => w.b), (b) => st.rec.get(b.id)?.inT || 0);
  const entry = 'entry';
  const P = f.P;
  for (const k of RAW_KEYS) {
    const src = list(f.raws[k].map((x) => x.b), (b) => st.rec.get(b.id)?.out || 0);
    const dst = list(f.procs.filter((p) => p.d.input === k).map((p) => p.b), (b) => st.rec.get(b.id)?.in || 0);
    add(Math.min(P[k].local, P[k].prod), ECON.truckLoad, VT.TRUCK, src, dst);
  }
  for (const k of INPUT_KEYS) {
    const src = list(f.procs.filter((p) => p.d.output === k).map((p) => p.b), (b) => st.rec.get(b.id)?.out || 0);
    add(P[k].local, ECON.truckLoad, VT.TRUCK, src, facsIn);
  }
  add(Math.min(P.goods.local, P.goods.prod), ECON.vanLoad, VT.VAN, facsOut, shopsL);
  const foodSrc = list(f.procs.filter((p) => p.d.output === 'food').map((p) => p.b), (b) => st.rec.get(b.id)?.out || 0);
  add(Math.min(P.food.local, P.food.prod), ECON.vanLoad, VT.VAN, foodSrc, shopsL);
  let whO = 0, whI = 0;
  for (const k of GOOD_KEYS) { whO += P[k].whOut; whI += P[k].whIn; }
  add(whO * 0.8, ECON.vanLoad * 1.5, VT.VAN, whOut, shopsL);
  add(whI, ECON.truckLoad, VT.TRUCK, facsOut, whIn);
  // Importe: von der Autobahn bzw. vom Umschlag zu den Läden
  add(f.iT, ECON.truckLoad, VT.TRUCK, entry, shopsL);
  add(f.iR, ECON.truckLoad, VT.TRUCK, rail, shopsL);
  add(f.iH, ECON.truckLoad, VT.TRUCK, harbor, shopsL);
  // Exporte: von den Erzeugern zur Autobahn bzw. zum Umschlag
  const prodW = (b) => {
    const r = st.rec.get(b.id);
    if (!r) return 0;
    const k = r.good, pool = P[k];
    return pool && pool.prod > 0 ? (r.out || 0) * (pool.exp / pool.prod) : 0;
  };
  const exporters = list([...f.facs.map((x) => x.b), ...RAW_KEYS.flatMap((k) => f.raws[k].map((x) => x.b)), ...f.procs.map((p) => p.b)], prodW);
  add(f.eT, ECON.truckLoad, VT.TRUCK, exporters, entry);
  add(f.eR, ECON.truckLoad, VT.TRUCK, exporters, rail);
  add(f.eH, ECON.truckLoad, VT.TRUCK, exporters, harbor);
  let total = 0;
  for (const fl of flows) total += fl.w;
  st.plan = { flows, total };
  st.tot.trucksDay = total;
}
function spawnTruck(g, st) {
  const plan = st.plan;
  // Reproduzierbarer Zufall des Verkehrs (Zustand wird gespeichert) statt Math.random
  const rng = (g.traffic && g.traffic.rng) || g.rng;
  let r = rng() * plan.total;
  let fl = plan.flows[plan.flows.length - 1];
  for (const x of plan.flows) { r -= x.w; if (r <= 0) { fl = x; break; } }
  const pickTile = (end) => {
    if (end === 'entry') return g.world.entry;
    const b = end.sample(rng);
    return b ? b.access : -1;
  };
  const from = pickTile(fl.from), to = pickTile(fl.to);
  if (from < 0 || to < 0 || from === to) return false;
  const res = findPath(g, from, to);
  if (!res || res.path.length < 2) return false;
  const tr = g.traffic;
  tr.addCar(fl.type, res.path, null, false, { weight: plan.scale * (fl.type === VT.VAN ? PCU.van : PCU.truck), freight: true });
  return true;
}

// ---------------------------------------------------------------- Täglich: Markt, Konjunktur, Folgen
function daily(g, st) {
  const day = g.day();
  // Konjunktur
  const c = st.cycle;
  c.phase += TAU / c.period;
  if (c.phase >= TAU) { c.phase -= TAU; c.period = 40 + Math.floor(rnd(st) * 30); }
  c.noise = c.noise * 0.85 + (rnd(st) - 0.5) * 0.16;
  c.shock *= 0.92;
  if (Math.abs(c.shock) < 0.01) c.shock = 0;
  c.value = clamp(0.7 * Math.sin(c.phase) + c.noise + c.shock, -1, 1);
  const lab = cycleLabel(c.value);
  if (lab !== c.label && day - (c.since || 0) >= 3) {
    c.label = lab; c.since = day;
    const [txt, mood] = CYCLE_NEWS[lab];
    if (g.stats.pop > 150) say(g, st, 'cycle', 0, txt, mood);
    emit('economyCycle', { label: lab, value: c.value });
  }
  // Weltmarktpreise: Mittelwert-Rückkehr mit Rauschen und Konjunktur
  for (const k of GOOD_KEYS) {
    const m = st.market[k];
    const old = m.idx;
    const target = 1 + 0.18 * c.value;
    m.idx = clamp(m.idx + (target - m.idx) * 0.18 + (rnd(st) - 0.5) * 0.07, 0.55, 1.7);
    m.trend = m.trend * 0.6 + (m.idx - old) * 0.4;
    if (m.shockDays > 0) { m.shockDays--; if (m.shockDays === 0) m.shock = 0; }
  }
  if (st.autoPrice) autoPrices(g, st);
  depleteDaily(g, st);
  // Zufällige Marktereignisse
  if (day >= st.nextShock && g.stats.pop > 200) {
    st.nextShock = day + 10 + Math.floor(rnd(st) * 14);
    const cand = GOOD_KEYS.filter((k) => st.flow[k].prod > 2 || st.flow[k].exp > 2);
    if (cand.length) {
      const k = cand[Math.floor(rnd(st) * cand.length)];
      const up = rnd(st) < 0.55;
      const v = (up ? 1 : -1) * (0.25 + rnd(st) * 0.3);
      const days = 6 + Math.floor(rnd(st) * 8);
      const m = st.market[k];
      m.shock = v; m.shockDays = days;
      const n = GOODS[k].name;
      const p = Math.round(Math.abs(v) * 100);
      say(g, st, 'shock', 0, up ? `Weltmarkt: ${n} ist gefragt – Preis +${p} % für etwa ${days} Tage. Jetzt verkaufen!` : `Weltmarkt: Der Preis für ${n} fällt um ${p} % (etwa ${days} Tage). Lagerhallen können Ware zurückhalten.`, up ? 'good' : 'bad');
    }
  }
  // Folgen für Gebäude: langer Warenmangel oder Absatzflaute kostet Stufen
  let downCom = 0, downInd = 0;
  for (const b of g.buildings.values()) {
    if (!b.zone || b.construct < 1 || b.abandoned) continue;
    const r = st.rec.get(b.id);
    if (!r) continue;
    if (r.kind === 'shop') {
      r.shortDays = r.need > 0.05 && r.supply < 0.6 ? r.shortDays + 1 : Math.max(0, r.shortDays - 1);
      if (r.shortDays >= 6 && b.level > 1 && rnd(st) < 0.15) { g.setBuildingLevel(b, b.level - 1); r.shortDays = 3; downCom++; }
    } else if (r.kind === 'factory' || r.kind === 'raw') {
      r.lowDays = r.sales < 0.55 ? r.lowDays + 1 : Math.max(0, r.lowDays - 1);
      if (r.lowDays >= 6 && b.level > 1 && rnd(st) < 0.12) { g.setBuildingLevel(b, b.level - 1); r.lowDays = 3; downInd++; }
    }
  }
  const t = st.tot;
  if (downCom) say(g, st, 'downCom', 4, `Warenmangel: ${downCom === 1 ? 'Ein Geschäft hat' : downCom + ' Geschäfte haben'} verkleinert. Mehr Industrie, eine Lagerhalle nahe der Läden oder mehr Frachtkapazität helfen.`, 'bad');
  if (downInd) say(g, st, 'downInd', 4, `Absatzflaute: ${downInd === 1 ? 'Ein Betrieb fährt' : downInd + ' Betriebe fahren'} die Produktion zurück. Exportpreise senken oder Fracht ausbauen.`, 'bad');
  if (g.stats.pop > 250 && t.shortCom > 0.15) say(g, st, 'short', 6, `Die Läden bekommen nur ${pct(t.supplyCom)} der Waren, die sie brauchen. Industrie ausbauen, Frachtkapazität erhöhen oder eine Lagerhalle bauen.`, 'bad');
  if (t.indProd > 30 && t.salesInd < 0.8) say(g, st, 'unsold', 6, `${pct(1 - t.salesInd)} der Waren aus der Industrie finden keinen Abnehmer. Exportpreise im Wirtschaftsfenster senken, Lagerhallen oder Güterbahnhof bauen.`, 'bad');
  if (t.freightUse > 0.97 && t.freightCap > 0) say(g, st, 'freight', 8, 'Die Frachtkapazität ist erschöpft – Lkw stauen sich an der Autobahn. Ein Güterbahnhof oder Frachthafen schafft Luft.', 'bad');
  if (!st.first.export && st.acc.exportT + (st.lines.exportT || 0) > 5 && g.stats.pop > 50) { st.first.export = 1; say(g, st, 'firstExport', 0, 'Erster Export! Überschüsse aus der Industrie gehen jetzt über die Autobahn in die Welt. Im Wirtschaftsfenster siehst du Preise und Warenströme.', 'good'); }
  for (const p of g.buildings.values()) {
    if (p.zone || p.construct < 1) continue;
    const d = BUILDINGS[p.key];
    const r = st.rec.get(p.id);
    if (d && d.output && r && r.cap > 0 && r.util < 0.25) say(g, st, 'idle' + p.id, 8, `${d.name}: kaum ${GOODS[d.input].name} zu verarbeiten. ${SPEC_HOWTO[d.process] || 'Zulieferer ansiedeln'}${st.buyRaw ? ' oder mehr Frachtkapazität für Zukäufe schaffen' : ' oder den Zukauf von Rohstoffen erlauben'}.`, 'info', p);
  }
  // Verlauf
  const L = st.lines;
  st.hist.push({ d: day, exp: Math.round(L.export), loc: Math.round(L.local), raw: Math.round(L.rawbuy), mkt: Math.round(L.market), cyc: +c.value.toFixed(2), sup: Math.round(t.supplyCom * 100), sal: Math.round((t.salesInd ?? 1) * 100), fr: Math.round((t.freightUse || 0) * 100), expT: Math.round(L.exportT || 0), impT: Math.round(L.importT || 0), stock: Math.round(t.stock || 0), dens: Math.round(L.density), cy: Math.round(L.cycle), px: GOOD_KEYS.map((k) => +(st.market[k].idx * (1 + (st.market[k].shock || 0))).toFixed(2)) });
  if (st.hist.length > 160) st.hist.shift();
}

// Tagessummen abschließen (zu Beginn von Stunde 0, also vor dem Haushalt des Kerns)
function closeDay(st) {
  const a = st.acc;
  if (a.hours > 0) {
    const f = 24 / Math.max(a.hours, 24); // unvollständiger erster Tag: nicht hochrechnen
    st.lines.export = a.export * f;
    st.lines.local = a.local * f;
    st.lines.rawbuy = a.rawbuy * f;
    st.lines.market = a.market * f;
    st.lines.exportT = a.exportT;
    st.lines.importT = a.importT;
    st.lines.unsoldT = a.unsoldT;
  }
  st.lines.trucksVisible = st.trucksToday;
  st.trucksToday = 0;
  st.acc = ZERO_ACC();
}

// ---------------------------------------------------------------- Schiffe und Güterzüge (renderables)
function harborPaths(g, st) {
  if (st._ships) return st._ships;
  const out = [];
  const { W, H } = g;
  const ter = g.world.terrain;
  for (const b of g.buildings.values()) {
    if (b.key !== 'cargo_harbor') continue;
    // Startfelder: Wasser direkt neben dem Hafen
    const prev = new Int32Array(g.N).fill(-2);
    const q = [];
    for (let y = b.y - 1; y <= b.y + b.h; y++) for (let x = b.x - 1; x <= b.x + b.w; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x;
      if (ter[i] === T.WATER && prev[i] === -2) { prev[i] = -1; q.push(i); }
    }
    if (!q.length) continue;
    let goal = -1, far = -1, farD = -1;
    const dist = new Int32Array(g.N);
    for (let h = 0; h < q.length && goal < 0; h++) {
      const i = q[h];
      const x = i % W, y = (i / W) | 0;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) { goal = i; break; }
      if (dist[i] > farD) { farD = dist[i]; far = i; }
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ox, ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (ter[j] !== T.WATER || prev[j] !== -2) continue;
        prev[j] = i; dist[j] = dist[i] + 1; q.push(j);
      }
    }
    const end = goal >= 0 ? goal : far;
    if (end < 0) continue;
    const tiles = [];
    for (let i = end; i >= 0; i = prev[i]) tiles.push(i);
    tiles.reverse(); // vom Hafen zur Kante
    if (tiles.length < 3) continue;
    // Weltkoordinaten, über die Kante hinaus verlängert, dann geglättet
    let pts = tiles.map((i) => [(i % W) + 0.5 - W / 2, ((i / W) | 0) + 0.5 - H / 2]);
    const a = pts[pts.length - 2], z = pts[pts.length - 1];
    if (goal >= 0) pts.push([z[0] + (z[0] - a[0]) * 6, z[1] + (z[1] - a[1]) * 6]);
    for (let it = 0; it < 3; it++) {
      const np = [pts[0]];
      for (let k = 0; k < pts.length - 1; k++) {
        const p = pts[k], q2 = pts[k + 1];
        np.push([p[0] * 0.75 + q2[0] * 0.25, p[1] * 0.75 + q2[1] * 0.25], [p[0] * 0.25 + q2[0] * 0.75, p[1] * 0.25 + q2[1] * 0.75]);
      }
      np.push(pts[pts.length - 1]);
      pts = np;
    }
    const cum = [0];
    for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    out.push({ id: b.id, pts, cum, len: cum[cum.length - 1] });
  }
  st._ships = out;
  return out;
}
function along(path, s) {
  const { pts, cum } = path;
  s = clamp(s, 0, path.len);
  let lo = 0, hi = cum.length - 1;
  while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
  const t = (s - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]);
  const p = pts[lo], q = pts[hi];
  return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, Math.atan2(q[0] - p[0], q[1] - p[1])];
}
function renderables(g) {
  const st = g.ext.industry;
  if (!st) return null;
  const out = [];
  const t = st.tot;
  // Frachtschiffe: Anzahl nach Hafenumschlag, Bewegung als Funktion der Spielzeit (deterministisch)
  if ((t.harborCap || 0) > 0) {
    const paths = harborPaths(g, st);
    for (const p of paths) {
      const r = st.rec.get(p.id);
      const used = r ? r.used || 0 : 0;
      const ships = used > 1 ? clamp(Math.ceil(used / 600), 1, 3) : 0;
      const speed = 0.012; // Felder pro Spielminute
      const travel = p.len / speed, dock = 240;
      const period = travel * 2 + dock;
      for (let k = 0; k < ships; k++) {
        const ph = (g.time + (k * period) / ships + p.id * 97) % period;
        let s, dir;
        if (ph < travel) { s = p.len - ph * speed; dir = -1; } // einlaufend
        else if (ph < travel + dock) { s = 0.6; dir = 0; } // am Kai
        else { s = (ph - travel - dock) * speed; dir = 1; } // auslaufend
        const [x, z, yaw] = along(p, Math.max(0.6, s));
        out.push({ kind: 'ship_cargo', x, y: -0.14, z, yaw: dir < 0 ? yaw + Math.PI : yaw, len: 2.6, color: [0xc0392b, 0x2f6fb0, 0x2e8b57][(p.id + k) % 3], lights: true });
      }
    }
  }
  // Güterzug im Güterbahnhof: rangiert langsam, solange Fracht über die Schiene läuft
  if ((t.railUsed || 0) > 1) {
    for (const b of g.buildings.values()) {
      if (b.key !== 'cargo_rail' || b.construct < 1) continue;
      const r = st.rec.get(b.id);
      if (!r || (r.used || 0) < 1) continue;
      const long = b.w >= b.h;
      const L = long ? b.w : b.h;
      const cx = b.x + b.w / 2 - g.W / 2, cz = b.y + b.h / 2 - g.H / 2;
      const off = Math.sin((g.time + b.id * 31) / 90) * 0.25;
      const yaw = long ? Math.PI / 2 : 0;
      const wagons = r.used > 400 ? 2 : 1;
      const seg = [{ kind: 'train_loco', len: 0.95 }, ...Array.from({ length: wagons }, () => ({ kind: 'cargo_wagon', len: 0.8 }))];
      const total = seg.reduce((a, s2) => a + s2.len + 0.05, 0);
      let pos = -Math.min(total, L) / 2 + off;
      const side = (long ? b.h : b.w) * 0.18;
      for (const s2 of seg) {
        const c = pos + s2.len / 2;
        out.push({ kind: s2.kind, x: long ? cx + c : cx + side, y: 0.02, z: long ? cz + side : cz + c, yaw, len: s2.len, color: s2.kind === 'cargo_wagon' ? 0x2f6fb0 : 0xd8b21e });
        pos += s2.len + 0.05;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- Abfragen für Oberfläche und Infoansicht
const hexOf = (s) => parseInt(s.slice(1), 16);
function rampHex(v) {
  v = clamp(v, 0, 1);
  const A = [0xe5, 0x48, 0x3c], B = [0xf2, 0xc2, 0x30], C = [0x45, 0xc4, 0x6b];
  const [p, q, t] = v < 0.5 ? [A, B, v * 2] : [B, C, (v - 0.5) * 2];
  return (Math.round(p[0] + (q[0] - p[0]) * t) << 16) | (Math.round(p[1] + (q[1] - p[1]) * t) << 8) | Math.round(p[2] + (q[2] - p[2]) * t);
}
// Farbe für die Infoansicht „Waren": grün = läuft, rot = Mangel bzw. unverkauft, violett = Lager, blau = Umschlag
export function goodsColor(g, b) {
  const st = g.ext.industry;
  const r = st && st.rec.get(b.id);
  if (!r) return null;
  if (r.kind === 'shop') return r.need > 0.01 ? rampHex((r.supply - 0.4) / 0.6) : 0xd9d4cc;
  if (r.kind === 'factory' || r.kind === 'raw') return (r.out || 0) > 0.01 ? rampHex((r.sales - 0.4) / 0.6) : 0xd9d4cc;
  if (r.kind === 'proc' || r.kind === 'market') return r.cap > 0 || r.need > 0 ? rampHex(r.util) : 0xb0aaa0;
  if (r.kind === 'wh') return [0xd9c8f0, 0xb18fe0, 0x8f5ad8, 0x6a3cb4][Math.min(3, Math.floor((r.util || 0) * 4))];
  if (r.kind === 'cargo') return (r.util || 0) > 0.95 ? 0xe5483c : (r.cap || 0) > 0 ? hexOf('#2f8fe0') : 0xb0aaa0;
  return null;
}
// Kennzahlen eines Gebäudes für den Inspektor
export function buildingEconomy(g, b) {
  const st = g.ext.industry;
  const r = st && st.rec.get(b.id);
  if (!r) return null;
  const info = { ...r };
  if (r.kind === 'wh') { const s = whState(st, b.id); info.mode = s.mode; info.goodSel = s.good; info.stock = { ...s.stock }; }
  if (r.kind === 'raw') info.specName = SPEC_NAMES[b.spec];
  return info;
}
export function industryState(g) { return g.ext.industry; }

// ---------------------------------------------------------------- Register: Haushalt, Glück, Nachfrage, Bodenwert
const L = (g) => (g.ext && g.ext.industry ? g.ext.industry.lines : null);
BUDGET_LINES.push(
  { id: 'ind_export', label: 'Exporterlöse', kind: 'income', amount: (g) => L(g)?.export || 0 },
  { id: 'ind_local', label: 'Städtische Betriebe', kind: 'income', amount: (g) => L(g)?.local || 0 },
  { id: 'ind_market', label: 'Markthallen', kind: 'income', amount: (g) => L(g)?.market || 0 },
  { id: 'ind_cycle', label: 'Konjunktur (Steuern G/I/B)', kind: 'income', amount: (g) => L(g)?.cycle || 0 },
  { id: 'ind_density', label: 'Dichte-Zuschläge', kind: 'income', amount: (g) => L(g)?.density || 0 },
  { id: 'ind_rawbuy', label: 'Rohstoffeinkauf', kind: 'expense', amount: (g) => L(g)?.rawbuy || 0 },
);

HAPPINESS_FACTORS.push((g, b) => {
  const st = g.ext && g.ext.industry;
  const r = st && st.rec.get(b.id);
  if (!r) return null;
  if (r.kind === 'shop') {
    if (r.need <= 0.01 || b.construct < 1) return null;
    const v = (3 + g.eff('ecoLocal')) * r.local - 6 * r.imp - 16 * r.short;
    return [r.short > 0.12 ? 'Warenmangel' : v < 0 ? 'Teure Importware' : 'Waren aus der Region', v];
  }
  if (r.kind === 'factory' || r.kind === 'raw') {
    if ((r.out || 0) <= 0.01) return null;
    if (r.sales < 0.97) return ['Absatzflaute', -15 * (1 - r.sales)];
    return [r.kind === 'raw' && r.local > 0.4 ? 'Abnehmer in der Stadt' : 'Volle Auftragsbücher', 2 + (r.kind === 'raw' ? 2 * r.local : 0)];
  }
  return null;
});
HAPPINESS_FACTORS.push((g, b) => {
  const st = g.ext && g.ext.industry;
  const r = st && st.rec.get(b.id);
  return r && r.kind === 'factory' && r.boost > 0.05 ? ['Vorprodukte aus der Stadt', 4 * r.boost] : null;
});
HAPPINESS_FACTORS.push((g, b) => {
  const st = g.ext && g.ext.industry;
  if (!st || !b.zone || g.stats.pop < 150) return null;
  const v = st.cycle.value * (b.zone === Z.RES ? 1.5 : 3);
  return Math.abs(v) >= 0.5 ? [`Konjunktur (${st.cycle.label})`, v] : null;
});
HAPPINESS_FACTORS.push((g, b) => {
  const d = densityDelta(g, b);
  return d ? [d > 0 ? 'Dichte-Zuschlag' : 'Dichte-Nachlass', -d * 1.7] : null;
});
HAPPINESS_FACTORS.push((g, b, i) => {
  const st = g.ext && g.ext.industry;
  if (!st || !st.parkLV) return null;
  const p = g.cov.park[i];
  return p > 0.05 ? [st.parkLV > 0 ? 'Gepflegte Parks' : 'Verwahrloste Parks', (st.parkLV / 12) * p * 8] : null;
});
HAPPINESS_FACTORS.push((g, b) => {
  if (b.zone !== Z.IND) return null;
  const v = g.eff('ecoHappy');
  return v ? ['Lage in der Industrie', v] : null;
});

DEMAND_MODIFIERS.push((g, d) => {
  const st = g.ext && g.ext.industry;
  if (!st || st.tot.supplyCom === undefined) return;
  const t = st.tot, s = g.stats;
  const cyc = st.cycle.value;
  // Industrie: unverkaufte Ware bremst, fehlende Ware in den Läden lockt Fabriken an
  if ((t.indProd || 0) > 5) d[3] += clamp((t.salesInd - 0.92) * 100, -40, 4);
  d[3] += clamp(t.shortCom * 60, 0, 20);
  d[2] -= clamp(t.shortCom * 50, 0, 25);
  // Konjunktur
  d[2] += cyc * 8; d[3] += cyc * 10; d[4] += cyc * 6;
  // Viel Handel braucht Verwaltung: Speditionen, Makler und Handelskontore ziehen Büros an
  d[4] += clamp((t.exportT || 0) / 150, 0, 8);
  // Dichte-Steuern
  for (const z of [1, 2, 3, 4]) d[z] -= (st.densAvg[z] || 0) * 4;
  // Arbeitsplätze in städtischen Betrieben ziehen Menschen an (gleiche Formel wie im Kern)
  if (st.jobs > 0 && s.pop > 0) {
    const D = Math.max(30, s.workers * 0.12);
    const vac = s.jobs * 0.98 - s.workers;
    const f = (v) => clamp((v / D) * 45, -70, 70);
    const extra = f(vac + st.jobs * 0.98 * t.staff) - f(vac);
    d[1] += extra;
    g.peopleDemand = clamp(g.peopleDemand + extra, -100, 100);
  }
});

LANDVALUE_TERMS.push((g, i) => {
  const st = g.ext && g.ext.industry;
  return st && st.parkLV ? st.parkLV * g.cov.park[i] : 0;
});

// ---------------------------------------------------------------- System
registerSystem({
  id: 'industry',
  init(g) {
    g.ext.industry = freshState(g);
    const reset = (b) => { if (b && b.key === 'cargo_harbor' && g.ext.industry) g.ext.industry._ships = null; };
    g.on('buildingAdded', reset);
    g.on('buildingRemoved', reset);
    // Die Wochenkarte „Konjunktur" belebt auch den Weltmarkt
    g.on('cardChosen', (c) => {
      const st = g.ext.industry;
      if (st && c && c.id === 'boom') { st.cycle.shock += 0.3; st.cycle.value = clamp(st.cycle.value + 0.3, -1, 1); }
    });
  },
  step(g, minutes) {
    const st = g.ext.industry;
    const plan = st.plan;
    if (!plan || plan.total <= 0 || !g.traffic) return;
    // Sichtbare Lkw im gleichen Verhältnis wie Autos (ein Fahrzeug = mehrere echte Fahrten)
    plan.scale = Math.max(1, (g.traffic.weight || 1) * 0.4);
    st.truckAcc += (plan.total * minutes) / 1440 / plan.scale;
    // Höchstens ein Drittel der sichtbaren Fahrzeuge ist Lieferverkehr
    // Fahrten der Rechnung (nicht die sichtbaren Fahrzeuge, die gemächlicher fahren)
    const cars = g.traffic.trips || g.traffic.cars;
    let freight = 0;
    if (st.truckAcc >= 1) for (const c of cars) if (c.freight) freight++;
    let n = 0;
    while (st.truckAcc >= 1 && n++ < 4) {
      st.truckAcc -= 1;
      if (cars.length < g.traffic.maxCars - 20 && freight < Math.max(6, cars.length * 0.33) && spawnTruck(g, st)) { st.trucksToday++; freight++; }
    }
    if (st.truckAcc > 4) st.truckAcc = 4;
  },
  hourly(g, h) {
    const st = g.ext.industry;
    applyBudgetMods(g);
    if (h === 0) closeDay(st);
    tick(g, st);
    // Der Lieferverkehr dieses Systems ersetzt den pauschalen Lkw-Anteil des Kerns.
    // Kern-Schnittstelle (Q4): pauschalen Lkw-Anteil abschalten, solange der eigene Lieferplan fährt
    if (g.traffic) g.traffic.freightShare = st.plan && st.plan.total > 0 ? 0 : 0.28;
  },
  daily(g) { daily(g, g.ext.industry); },
  weekly(g) {
    const st = g.ext.industry;
    const h = st.hist.slice(-7);
    if (!h.length || g.stats.pop < 150) return;
    const exp = h.reduce((a, e) => a + e.exp + e.loc + e.mkt - e.raw, 0);
    const sup = h.reduce((a, e) => a + e.sup, 0) / h.length;
    if (exp > 50 || sup < 95) g.news('report', `Wirtschaftswoche: Handel ${exp >= 0 ? '+' : ''}${fmtMoney(exp)} · Läden zu ${Math.round(sup)} % versorgt · Konjunktur: ${st.cycle.label}.`, sup < 80 ? 'bad' : 'good');
  },
  serialize(g) {
    const st = g.ext.industry;
    const recs = [];
    for (const [id, r] of st.rec) recs.push([id, r.kind, +(r.sales ?? 1).toFixed(3), +(r.supply ?? 1).toFixed(3), +(r.local || 0).toFixed(3), +(r.imp || 0).toFixed(3), r.shortDays | 0, r.lowDays | 0]);
    const round = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'number' ? +v.toFixed(4) : v)));
    return round({
      v: 1, seed: st.seed, market: st.market, prices: st.prices, buyRaw: st.buyRaw, autoPrice: st.autoPrice, cycle: st.cycle, dens: st.dens,
      applied: st.applied, perm: st.perm, wh: st.wh, flow: st.flow, tot: st.tot, acc: st.acc, lines: st.lines,
      hist: st.hist, news: st.news, nextShock: st.nextShock, first: st.first, jobs: st.jobs, densAvg: st.densAvg, links: st.links, recs,
      depl: st.depl ? typedToB64(st.depl) : null,
    });
  },
  load(g, d) {
    if (!d || d.v !== 1) return;
    const st = freshState(g);
    for (const k of ['seed', 'buyRaw', 'autoPrice', 'cycle', 'dens', 'applied', 'perm', 'wh', 'tot', 'acc', 'lines', 'hist', 'news', 'nextShock', 'first', 'jobs', 'densAvg', 'links']) if (d[k] !== undefined) st[k] = d[k];
    for (const k of GOOD_KEYS) {
      if (d.market && d.market[k]) Object.assign(st.market[k], d.market[k]);
      if (d.prices && d.prices[k] !== undefined) st.prices[k] = d.prices[k];
      if (d.flow && d.flow[k]) Object.assign(st.flow[k], d.flow[k]);
    }
    for (const a of d.recs || []) {
      const [id, kind, sales, supply, local, imp, shortDays, lowDays] = a;
      st.rec.set(id, { kind, good: null, out: 0, sales, supply, local, imp, short: clamp(1 - supply, 0, 1), need: kind === 'shop' ? 1 : 0, boost: 0, util: 0, cap: 0, in: 0, staff: 1, shortDays, lowDays, dist: 0 });
    }
    if (typeof d.depl === 'string') { try { const a = b64ToTyped(d.depl, Float32Array); if (a.length === g.N) st.depl = a; } catch (e) { /* alter Spielstand */ } }
    st.parkLV = (budgetOf(g, 'parks') - 1) * 12;
    g.ext.industry = st;
  },
  renderables,
});
