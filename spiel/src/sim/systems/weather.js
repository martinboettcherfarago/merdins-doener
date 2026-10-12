// System „Wetter & Jahreszeiten" (Besitzer S4).
// Jahreszeiten, Temperatur, Regen, Schnee, Nebel, Wind, Gewitter – mit Spielwirkung auf Wasser, Strom, Heizen,
// Tourismus, Glück, Nachfrage, Bauernhöfe, Baustellen und Pulsbahn. Läuft headless (keine Imports aus render/ui).
//
// Öffentlicher Zustand: g.ext.weather nach Vertrag 6.4
//   { season, yearT, temp, rain, snow, snowCover, cloud, fog, wind, windDir, lightning, storm }
//   windDir = Richtung, IN die der Wind weht (Bogenmaß in der x/z-Ebene: 0 = +x/Osten, π/2 = +z/Süden).
// Zusätzliche Felder (lesen erlaubt, nicht schreiben):
//   kind (Wetterlage-ID), label (deutscher Name), seasonT (0..1 innerhalb der Jahreszeit), seasonDay (1..28), year,
//   stormI (Gewitterstärke 0..1), wet (Bodennässe 0..1), dry (Trockenheit 0..1), heatNeed / coolNeed (0..1),
//   sun (Solarertrag 0..1,25), forecast ([{ day, kind, tMin, tMax, precip, wind, storm }] für die nächsten Tage).
// Ein Spieljahr hat 4 × 28 Tage (eine Jahreszeit = 4 Wochen). Spielbeginn im frühen Frühling.
import { registerSystem, HAPPINESS_FACTORS, DEMAND_MODIFIERS, CAPACITY_MODIFIERS, BUDGET_LINES, emit } from '../../registry.js';
import { BUILDINGS, DAY, Z, T } from '../../config.js';
import { clamp } from '../../util.js';
import { capacityOf } from '../city.js';
import { findPath } from '../network.js';
import { forDisc } from '../services.js';

export const SEASON_DAYS = 28;
export const YEAR_DAYS = SEASON_DAYS * 4;
export const START_DAY = 3; // Tag 0 des Spiels = Tag 4 des Frühlings
export const FORECAST_DAYS = 8;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const SEASON_INFO = {
  spring: { name: 'Frühling', color: '#7fbf5c', adj: 'Frühlings' },
  summer: { name: 'Sommer', color: '#efa821', adj: 'Sommer' },
  autumn: { name: 'Herbst', color: '#cf6d2a', adj: 'Herbst' },
  winter: { name: 'Winter', color: '#6fa3d6', adj: 'Winter' },
};

// Wetterlagen: Grundbewölkung, Tagesgang der Temperatur (amp), Wind, Temperaturabweichung, Niederschlag
export const KINDS = {
  clear: { name: 'Sonnig', cloud: 0.05, amp: 10, wind: 0.14, tmod: 1 },
  fair: { name: 'Heiter', cloud: 0.28, amp: 8.5, wind: 0.2, tmod: 0.5 },
  cloudy: { name: 'Wolkig', cloud: 0.58, amp: 6.5, wind: 0.27, tmod: 0 },
  overcast: { name: 'Bedeckt', cloud: 0.9, amp: 4, wind: 0.3, tmod: -0.8 },
  rain: { name: 'Regen', cloud: 0.95, amp: 3.5, wind: 0.42, tmod: -1.6, precip: true },
  showers: { name: 'Schauer', cloud: 0.6, amp: 6, wind: 0.38, tmod: -0.8, precip: true },
  thunder: { name: 'Gewitter', cloud: 0.5, amp: 8, wind: 0.28, tmod: 1.4, precip: true },
  storm: { name: 'Sturm', cloud: 1, amp: 3.5, wind: 0.82, tmod: -1.2, precip: true },
  fog: { name: 'Nebel', cloud: 0.72, amp: 3, wind: 0.05, tmod: -1 },
  snow: { name: 'Schneefall', cloud: 0.95, amp: 3, wind: 0.3, tmod: -1.5, precip: true },
  heat: { name: 'Hitze', cloud: 0.04, amp: 11, wind: 0.1, tmod: 6 },
  frost: { name: 'Frost', cloud: 0.08, amp: 8, wind: 0.12, tmod: -5 },
};
const KIND_KEYS = Object.keys(KINDS);
const WET = new Set(['rain', 'showers', 'thunder', 'storm', 'snow']);
const DRY = new Set(['clear', 'fair', 'heat', 'frost']);
const PERSIST = { clear: 1.6, fair: 1.4, cloudy: 1.3, overcast: 1.6, rain: 1.5, showers: 1.3, thunder: 1.1, storm: 0.5, fog: 1.3, snow: 1.6, heat: 2.2, frost: 2 };
const SEASON_W = {
  spring: { clear: 12, fair: 18, cloudy: 18, overcast: 9, rain: 13, showers: 17, thunder: 4, storm: 2, fog: 4 },
  summer: { clear: 24, fair: 22, cloudy: 12, overcast: 4, rain: 6, showers: 9, thunder: 11, storm: 1.5, fog: 0.5, heat: 9 },
  autumn: { clear: 9, fair: 13, cloudy: 16, overcast: 16, rain: 17, showers: 8, thunder: 2, storm: 6, fog: 13 },
  winter: { clear: 7, fair: 9, cloudy: 15, overcast: 19, rain: 7, showers: 3, storm: 5, fog: 8, snow: 20, frost: 8 },
};
// Bauernhöfe arbeiten saisonal (Arbeitsplätze), Ernte im Herbst
const FARM = { spring: 1, summer: 1.1, autumn: 1.25, winter: 0.6 };
const WEST = 0; // vorherrschende Windrichtung: Westwind weht nach Osten (+x)

// ---------- Kalender
export function calendarAt(dayFloat) {
  const yd = (((dayFloat + START_DAY) % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS;
  const yearT = yd / YEAR_DAYS;
  const seasonIdx = Math.min(3, Math.floor(yd / SEASON_DAYS));
  const sd = yd - seasonIdx * SEASON_DAYS;
  return {
    yearT, seasonIdx, season: SEASONS[seasonIdx], seasonT: sd / SEASON_DAYS, seasonDay: Math.floor(sd) + 1,
    year: Math.floor((dayFloat + START_DAY) / YEAR_DAYS) + 1,
  };
}
export const calendar = (g) => calendarAt(g.time / DAY);
export function seasonText(g) {
  const c = calendar(g);
  return `${SEASON_INFO[c.season].name} · Tag ${c.seasonDay}/${SEASON_DAYS}`;
}
// Mittlere Tagestemperatur im Jahresverlauf (°C): Höchststand im Hochsommer, Tiefststand im Hochwinter
export const seasonalMean = (yt) => 10 + 10 * Math.cos(2 * Math.PI * (yt - 0.4));

// ---------- Zufall mit speicherbarem Zustand
function rngNext(I) {
  let a = (I.rs = (I.rs + 0x6d2b79f5) >>> 0);
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function gauss(I) {
  const u = Math.max(1e-6, rngNext(I)), v = rngNext(I);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const smooth01 = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const angWrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Interner Zustand pro Spiel (nicht im öffentlichen g.ext.weather)
const INTERNAL = new WeakMap();
function I_(g) {
  let I = INTERNAL.get(g);
  if (!I) {
    I = {
      rs: ((g.opts.seed || 1) * 2654435761) >>> 0, plans: new Map(), lastGen: -2, anom: 0, prevKind: 'fair', windDir: WEST,
      cloudAvg: 0.3, windAvg: 0.2, tempAvg: 10, precipAvg: 0, precip7: 0.3, mood: 0, lastSeason: null, heatCover: 0,
      poolField: null, plows: [], plowNet: -1, plowTiles: new Map(), fxOwned: false, lastDayPrecip: 0, firstSnowDone: false,
      dayMaxT: -99, dayPrecipH: 0, notes: {},
    };
    INTERNAL.set(g, I);
  }
  return I;
}
// Die Effekt-Ansicht übernimmt das Blitzflackern (pro Bild); dann setzt die Simulation lightning nicht mehr zurück.
export function claimLightning(g) { I_(g).fxOwned = true; }

// ---------- Tagespläne
function plan(g, d) {
  const I = I_(g);
  if (!I.plans.has(d)) ensurePlans(g, d);
  let p = I.plans.get(d);
  if (!p) {
    // Längst vergangener Tag (z. B. nach dem Laden): mit gesichertem Zufallszustand nachbauen
    const keep = { rs: I.rs, anom: I.anom, prevKind: I.prevKind, windDir: I.windDir };
    p = genPlan(I, d);
    Object.assign(I, keep);
    I.plans.set(d, p);
  }
  return p;
}
function ensurePlans(g, upto) {
  const I = I_(g);
  if (I.lastGen < -1) I.lastGen = Math.floor(g.time / DAY) - 2;
  while (I.lastGen < upto) {
    I.lastGen++;
    I.plans.set(I.lastGen, genPlan(I, I.lastGen));
  }
}

function genPlan(I, d, forceKind) {
  const r = () => rngNext(I);
  const cal = calendarAt(d + 0.5);
  const w0 = SEASON_W[cal.season], w1 = SEASON_W[SEASONS[(cal.seasonIdx + 1) % 4]];
  const blend = smooth01((cal.seasonT - 0.72) / 0.28) * 0.5;
  let kind = forceKind;
  if (!kind) {
    const prev = I.prevKind;
    const ws = [];
    let total = 0;
    for (const k of KIND_KEYS) {
      let w = (w0[k] || 0) * (1 - blend) + (w1[k] || 0) * blend;
      if (w > 0) {
        if (k === prev) w *= PERSIST[k] ?? 1.5;
        else if (WET.has(prev) && WET.has(k)) w *= 1.35;
        else if (DRY.has(prev) && DRY.has(k)) w *= 1.3;
      }
      ws.push(w);
      total += w;
    }
    let x = r() * total;
    kind = KIND_KEYS[KIND_KEYS.length - 1];
    for (let k = 0; k < ws.length; k++) { x -= ws[k]; if (x <= 0 && ws[k] > 0) { kind = KIND_KEYS[k]; break; } }
  }
  I.anom = clamp(I.anom * 0.62 + gauss(I) * 2.3, -8, 8);
  if (kind === 'heat') I.anom = Math.max(I.anom, 3 + r() * 2);
  if (kind === 'frost') I.anom = Math.min(I.anom, -2 - r() * 2);
  const mean = seasonalMean(cal.yearT);
  // Schnee braucht Kälte – sonst wird Regen daraus (und umgekehrt im tiefen Winter)
  if (kind === 'snow' && mean + I.anom > 4.5) kind = 'rain';
  if ((kind === 'rain' || kind === 'showers') && mean + I.anom < -1) kind = 'snow';
  const kd = KINDS[kind];
  const amp = kd.amp * (0.8 + 0.4 * r());
  const base = mean + I.anom + kd.tmod;
  let tMax = base + amp / 2, tMin = base - amp / 2;
  if (kind === 'snow' && tMax > 2) { const dd = tMax - 1 - r() * 1.5; tMax -= dd; tMin -= dd; }
  if (kind === 'heat' && tMax < 29) { tMax = 29 + r() * 5; tMin = tMax - amp; }
  if (kind === 'thunder' && tMax < 21 && cal.season !== 'winter') { tMax = 21 + r() * 6; tMin = tMax - amp; }
  // Wind und Windrichtung (Westwind überwiegt)
  const dx = Math.cos(I.windDir) * 0.8 + Math.cos(WEST) * 0.2 + gauss(I) * 0.45;
  const dz = Math.sin(I.windDir) * 0.8 + Math.sin(WEST) * 0.2 + gauss(I) * 0.45;
  I.windDir = Math.atan2(dz, dx);
  const wind = clamp(kd.wind + (r() - 0.5) * 0.14 + (cal.season === 'autumn' ? 0.05 : 0), 0, 1);
  const cloud = clamp(kd.cloud + (r() - 0.5) * 0.14, 0, 1);
  // Nebel am Morgen
  let fog = 0, fogEnd = 0;
  if (kind === 'fog') { fog = 0.75 + r() * 0.25; fogEnd = 10 + r() * 3; }
  else if ((cal.season === 'autumn' || cal.season === 'winter') && (kind === 'clear' || kind === 'fair' || kind === 'cloudy') && r() < 0.3) { fog = 0.35 + r() * 0.3; fogEnd = 8 + r() * 2; }
  else if (cal.season === 'spring' && kind === 'clear' && r() < 0.15) { fog = 0.3; fogEnd = 8; }
  // Niederschlagsfenster [Beginn, Ende, Stärke] in Stunden
  const precip = [];
  let storm = null;
  if (kind === 'rain' || kind === 'snow') {
    const n = 1 + (r() < 0.45 ? 1 : 0);
    let s = r() * 6;
    for (let k = 0; k < n; k++) {
      const len = 5 + r() * 9;
      precip.push([s, Math.min(24, s + len), (kind === 'snow' ? 0.35 : 0.45) + r() * 0.45]);
      s = s + len + 1 + r() * 4;
      if (s > 22) break;
    }
  } else if (kind === 'showers') {
    const n = 2 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) { const s = 8 + r() * 12; precip.push([s, s + 0.6 + r() * 1.5, 0.4 + r() * 0.6]); }
  } else if (kind === 'thunder') {
    const s = 13.5 + r() * 4.5, len = 1.5 + r() * 2;
    storm = [s, s + len, 0.7 + r() * 0.3];
    precip.push([s - 0.2, s + len + 0.6, 0.8 + r() * 0.2]);
    if (r() < 0.4) precip.push([10 + r() * 2, 11 + r() * 2, 0.35]);
  } else if (kind === 'storm') {
    let s = r() * 4;
    while (s < 22) { const len = 2 + r() * 4; precip.push([s, s + len, 0.45 + r() * 0.4]); s += len + 1 + r() * 3; }
  } else if (kind === 'overcast' && r() < 0.3) {
    const s = r() * 18; precip.push([s, s + 2 + r() * 3, 0.15 + r() * 0.1]);
  }
  I.prevKind = kind;
  return { d, kind, tMin, tMax, cloud, wind, windDir: I.windDir, fog, fogEnd, precip, storm, forced: forceKind || null };
}

// Wetterlage eines Tages erzwingen (Katastrophen-System, Tests, Debug). Temperaturen werden passend verschoben.
export function forceDay(g, d, kind, opts = {}) {
  const I = I_(g);
  ensurePlans(g, d);
  const old = I.plans.get(d);
  const keep = { anom: I.anom, prevKind: I.prevKind, windDir: I.windDir };
  I.anom = old ? (old.tMax + old.tMin) / 2 - seasonalMean(calendarAt(d + 0.5).yearT) - KINDS[old.kind].tmod : I.anom;
  const p = genPlan(I, d, kind);
  Object.assign(I, keep);
  if (opts.stormAt !== undefined && p.storm) {
    const len = opts.len ?? p.storm[1] - p.storm[0];
    p.storm = [opts.stormAt, opts.stormAt + len, Math.max(p.storm[2], opts.intensity || 0)];
    p.precip = [[opts.stormAt - 0.3, opts.stormAt + len + 0.8, 0.9]];
  }
  if (opts.heavy && p.precip.length) {
    p.precip = [[0, 24, 0.75 + 0.25 * opts.heavy]];
    p.cloud = 1;
  }
  if (opts.wind !== undefined) p.wind = Math.max(p.wind, opts.wind);
  if (opts.dry) { p.precip = []; }
  p.forced = opts.reason || kind;
  I.plans.set(d, p);
  return p;
}

function windowVal(wins, h) {
  let v = 0;
  for (const w of wins) {
    const [s, e, I] = w;
    if (h < s - 0.6 || h > e + 0.6) continue;
    const ramp = Math.min(1, (h - (s - 0.6)) / 1.2, ((e + 0.6) - h) / 1.2);
    v = Math.max(v, I * smooth01(ramp));
  }
  return v;
}

export function tempAt(g, t) {
  const d = Math.floor(t / DAY), h = (t - d * DAY) / 60;
  const P = plan(g, d);
  const cos = (u) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(u, 0, 1));
  if (h < 5) { const Pp = plan(g, d - 1); return Pp.tMax + (P.tMin - Pp.tMax) * cos((h + 9) / 14); }
  if (h < 15) return P.tMin + (P.tMax - P.tMin) * cos((h - 5) / 10);
  const Pn = plan(g, d + 1);
  return P.tMax + (Pn.tMin - P.tMax) * cos((h - 15) / 14);
}

// Zielwerte (ungeglättet) zum Zeitpunkt t
function targets(g, t) {
  const d = Math.floor(t / DAY), h = (t - d * DAY) / 60;
  const P = plan(g, d);
  let pr = windowVal(P.precip, h);
  // Fenster des Vortags, die über Mitternacht reichen
  const Pp = plan(g, d - 1);
  pr = Math.max(pr, windowVal(Pp.precip.filter((w) => w[1] > 23), h + 24));
  const stormI = P.storm ? windowVal([P.storm], h) : 0;
  let cloud = P.cloud;
  if (pr > 0) cloud = Math.max(cloud, 0.7 + 0.3 * pr);
  if (stormI > 0) cloud = Math.max(cloud, 0.85 + 0.15 * stormI);
  // Gewitterwolken türmen sich nachmittags auf
  if (P.kind === 'thunder' && P.storm && h > P.storm[0] - 3 && h < P.storm[1] + 1) cloud = Math.max(cloud, 0.65 + 0.35 * smooth01((h - (P.storm[0] - 3)) / 3));
  let wind = P.wind * (0.85 + 0.3 * Math.sin(Math.PI * clamp((h - 8) / 12, 0, 1)));
  if (stormI > 0) wind = Math.max(wind, 0.45 + 0.35 * stormI);
  if (P.kind === 'storm') wind = Math.max(wind, P.wind * (0.75 + 0.25 * Math.sin(Math.PI * clamp((h - 2) / 20, 0, 1))));
  let fog = 0;
  if (P.fog > 0) {
    if (h < P.fogEnd) fog = P.fog * smooth01((h + 3) / 4);
    else fog = P.fog * Math.max(0, 1 - (h - P.fogEnd) / 1.5);
    if (P.kind === 'fog' && h > 20) fog = Math.max(fog, P.fog * 0.6 * smooth01((h - 20) / 2));
  }
  if (Pp.kind === 'fog' && h < 3) fog = Math.max(fog, Pp.fog * 0.6);
  return { pr, stormI, cloud: clamp(cloud, 0, 1), wind: clamp(wind, 0, 1), fog: clamp(fog, 0, 1), windDir: P.windDir, kind: P.kind };
}

// ---------- Öffentlicher Zustand
function freshState(g) {
  const cal = calendar(g);
  return {
    season: cal.season, yearT: cal.yearT, temp: 12, rain: 0, snow: 0, snowCover: 0, cloud: 0.3, fog: 0, wind: 0.2, windDir: WEST, lightning: 0, storm: false,
    kind: 'fair', label: KINDS.fair.name, seasonT: cal.seasonT, seasonDay: cal.seasonDay, year: cal.year,
    stormI: 0, wet: 0, dry: 0.2, heatNeed: 0, coolNeed: 0, sun: 1, forecast: [],
  };
}

function weatherLabel(w) {
  if (w.storm && w.stormI > 0.2) return 'Gewitter';
  if (w.kind === 'storm' && w.wind > 0.6) return 'Sturm';
  if (w.snow > 0.05) return w.snow > 0.45 ? 'Starker Schneefall' : w.rain > 0.05 ? 'Schneeregen' : 'Schneefall';
  if (w.rain > 0.05) return w.rain > 0.55 ? 'Starker Regen' : w.rain < 0.22 ? 'Nieselregen' : 'Regen';
  if (w.fog > 0.4) return 'Nebel';
  if (w.temp >= 30 && w.cloud < 0.4) return 'Hitze';
  if (w.temp <= -4 && w.cloud < 0.4) return 'Klirrender Frost';
  if (w.cloud < 0.15) return 'Sonnig';
  if (w.cloud < 0.4) return 'Heiter';
  if (w.cloud < 0.75) return 'Wolkig';
  return 'Bedeckt';
}

function simulate(g, minutes, snap = false) {
  const I = I_(g), w = g.ext.weather;
  const t = g.time;
  ensurePlans(g, Math.floor(t / DAY) + FORECAST_DAYS);
  const cal = calendar(g);
  const tg = targets(g, t);
  const k = snap ? 1 : 1 - Math.exp(-minutes / 35);
  const kf = snap ? 1 : 1 - Math.exp(-minutes / 25);
  w.cloud += (tg.cloud - w.cloud) * k;
  w.wind += (tg.wind - w.wind) * k;
  w.fog += (tg.fog - w.fog) * kf;
  w.windDir = angWrap(w.windDir + angWrap(tg.windDir - w.windDir) * k * 0.6);
  w.temp = tempAt(g, t);
  const pr = I.pr = snap ? tg.pr : (I.pr || 0) + (tg.pr - (I.pr || 0)) * kf;
  // Schnee oder Regen nach Temperatur
  const snowShare = clamp((2.2 - w.temp) / 1.6, 0, 1);
  w.snow = pr * snowShare;
  w.rain = pr * (1 - snowShare);
  w.stormI = snap ? tg.stormI : w.stormI + (tg.stormI - w.stormI) * kf;
  w.storm = w.stormI > 0.25 || (tg.kind === 'storm' && w.wind > 0.55);
  w.kind = tg.kind;
  if (!I.fxOwned) w.lightning = 0;
  // Schneedecke wächst und taut
  const hrs = minutes / 60;
  if (w.snow > 0.01) w.snowCover += w.snow * hrs * (w.temp < -1 ? 0.16 : 0.11);
  if (w.temp > 0.4) w.snowCover -= (w.temp - 0.4) * 0.012 * hrs * (1 + 3 * w.rain) + (1 - w.cloud) * 0.004 * hrs * (w.temp > 2 ? 1 : 0);
  w.snowCover = clamp(w.snowCover, 0, 1);
  // Bodennässe
  w.wet += (w.rain * 1.2 + (w.temp > 0.4 && w.snowCover > 0 ? 0.08 : 0)) * hrs;
  w.wet -= hrs * (0.05 + Math.max(0, w.temp) / 260 + w.wind * 0.05) * (w.rain > 0.05 ? 0.2 : 1);
  w.wet = clamp(w.wet, 0, 1);
  // Kalender
  w.season = cal.season; w.yearT = cal.yearT; w.seasonT = cal.seasonT; w.seasonDay = cal.seasonDay; w.year = cal.year;
  // Gleitende Mittel für die Spielwirkung (verhindert Flackern)
  const a12 = 1 - Math.exp(-hrs / 12), a6 = 1 - Math.exp(-hrs / 6), a24 = 1 - Math.exp(-hrs / 24);
  I.cloudAvg += (w.cloud - I.cloudAvg) * a12;
  I.windAvg += (w.wind - I.windAvg) * a6;
  I.tempAvg += (w.temp - I.tempAvg) * a12;
  I.precipAvg += (pr - I.precipAvg) * a24;
  I.precip7 += (pr - I.precip7) * (1 - Math.exp(-hrs / 120));
  if (snap) { I.cloudAvg = w.cloud; I.windAvg = w.wind; I.tempAvg = w.temp; }
  w.heatNeed = clamp((15 - I.tempAvg) / 20, 0, 1);
  w.coolNeed = clamp((I.tempAvg - 20) / 12, 0, 1);
  const sBase = { spring: 0.95, summer: 1.2, autumn: 0.72, winter: 0.45 }[cal.season];
  w.sun = clamp(sBase * (1 - 0.65 * I.cloudAvg) * (1 - 0.7 * w.snowCover), 0.12, 1.25);
  w.label = weatherLabel(w);
  // Tagesstatistik für die Trockenheit
  I.dayMaxT = Math.max(I.dayMaxT, w.temp);
  if (pr > 0.08) I.dayPrecipH += hrs;
}

// ---------- Wirkung auf die Stadt
function setEffect(g, key, value, label) {
  const tag = 'wetter:' + key;
  const idx = g.effects.findIndex((e) => e.src === tag);
  if (Math.abs(value) < 0.004) { if (idx >= 0) g.effects.splice(idx, 1); return; }
  const e = idx >= 0 ? g.effects[idx] : { key, src: tag };
  e.value = value;
  e.label = label;
  e.until = g.time + 90;
  if (idx < 0) g.effects.push(e);
}
const pct = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v * 100))} %`;

// Kennzahlen, die das Panel anzeigt (werden stündlich neu berechnet)
export function weatherImpact(g) { return I_(g).impact || null; }

function applyEffects(g) {
  const I = I_(g), w = g.ext.weather;
  // --- Strom: Solar, Wind, Wasserkraft und Heiz-/Kühlbedarf
  let S = 0, Ss = 0, Sw = 0, Sh = 0, heat = 0;
  for (const b of g.buildings.values()) {
    if (b.zone || b.construct < 1 || b.abandoned) continue;
    const d = BUILDINGS[b.key];
    if (!d) continue;
    if (d.power) {
      S += d.power;
      if (b.key === 'solar') Ss += d.power;
      else if (b.key === 'wind') Sw += d.power;
      else if (b.key === 'hydro') Sh += d.power;
    }
    if (d.heat && b.powered) heat += d.heat;
  }
  const fs = w.sun;
  const fw = I.windAvg > 0.9 ? 0.25 : clamp(0.62 + 1.4 * I.windAvg, 0.35, 1.45);
  const fh = clamp(0.75 + 0.9 * I.precip7 - 0.25 * w.dry, 0.6, 1.25);
  const supply = S > 0 ? (S - Ss - Sw - Sh + Ss * fs + Sw * fw + Sh * fh) / S : 1;
  // Heizen mit Strom, wenn keine Fernwärme reicht (S2 kann g.ext.citizens.heatCover liefern)
  const heatDemand = g.stats.pop * w.heatNeed;
  let cover = heatDemand > 0 ? clamp(heat / heatDemand, 0, 1) : 1;
  if (g.ext.citizens && typeof g.ext.citizens.heatCover === 'number') cover = clamp(g.ext.citizens.heatCover, 0, 1);
  I.heatCover = cover;
  const heatElec = w.heatNeed * 0.16 * (1 - cover);
  const cool = w.coolNeed * 0.1;
  const m = supply / (1 + heatElec + cool);
  const parts = [];
  if (Ss > 0) parts.push(`Solar ${Math.round(fs * 100)} %`);
  if (Sw > 0) parts.push(`Wind ${Math.round(fw * 100)} %`);
  if (Sh > 0) parts.push(`Wasserkraft ${Math.round(fh * 100)} %`);
  if (heatElec > 0.01) parts.push(`Heizen ${pct(heatElec)}`);
  if (cool > 0.01) parts.push(`Klimaanlagen ${pct(cool)}`);
  setEffect(g, 'powerMul', m - 1, `Wetter: Strombilanz ${pct(m - 1)}${parts.length ? ' (' + parts.join(', ') + ')' : ''}`);
  // --- Wasser
  const rainy = I.precipAvg > 0.12 ? 1 : 0;
  const water = clamp((I.tempAvg - 15) * 0.011, -0.07, 0.24) + w.dry * 0.1 - rainy * 0.05 + (I.tempAvg < -7 ? 0.06 : 0);
  setEffect(g, 'waterUse', water, `Wetter: Wasserverbrauch ${pct(water)}${water < 0 ? (rainy ? ' (Regen)' : ' (kühl)') : I.tempAvg > 24 ? ' (Hitze)' : w.dry > 0.5 ? ' (Trockenheit)' : I.tempAvg < -7 ? ' (Rohrbrüche bei Frost)' : ''}`);
  // --- Tourismus (Prozent)
  let tour = { spring: 6, summer: 18, autumn: -4, winter: -10 }[w.season];
  if (I.precipAvg > 0.15) tour -= 8;
  if (w.storm) tour -= 12;
  if (g.world.type === 'mountains' && w.snowCover > 0.4) tour += 22;
  if (w.season === 'winter' && w.seasonDay >= 4 && w.seasonDay <= 16) tour += 8; // Weihnachtsmärkte
  setEffect(g, 'tourism', tour, `${SEASON_INFO[w.season].name}: Touristen ${tour >= 0 ? '+' : '−'}${Math.abs(Math.round(tour))} %`);
  // Freibäder und Strandbäder ziehen bei schönem Wetter Besucher an
  let beach = 0;
  const nice = w.season === 'summer' || (w.season === 'spring' && I.tempAvg > 20);
  if (nice && I.tempAvg > 19 && I.precipAvg < 0.12) {
    for (const b of g.buildings.values()) {
      if (b.construct < 1 || b.abandoned) continue;
      if (b.key === 'beach') beach += 70;
      else if (b.key === 'swimming_pool') beach += 25;
    }
    beach *= clamp((I.tempAvg - 17) / 8, 0, 1.4);
  }
  setEffect(g, 'tourismAdd', beach, `Badewetter: +${Math.round(beach)} Badegäste`);
  // --- Pulsbahn: bei Schmuddelwetter steigen mehr Leute um
  const rid = clamp(I.precipAvg * 0.35 + w.snowCover * 0.12 + (I.tempAvg < 0 ? 0.04 : 0) - (I.tempAvg > 18 && I.precipAvg < 0.05 ? 0.03 : 0), -0.05, 0.25);
  setEffect(g, 'ridership', rid, rid >= 0 ? `Wetter: Pulsbahn-Fahrgäste ${pct(rid)}` : `Schönes Wetter: mehr Rad und Fuß (${pct(rid)} Fahrgäste)`);
  // --- Stimmung (geglättet), daraus der Glücksfaktor „Wetter"
  let mood = 0;
  const T0 = w.temp;
  if (T0 >= 16 && T0 <= 26 && w.rain < 0.05 && w.snow < 0.05) mood += 2 + (w.cloud < 0.3 ? 1.5 : 0);
  if (w.rain > 0.05) mood -= 1 + w.rain * 2;
  if (w.snow > 0.05 && w.season === 'winter') mood += w.snowCover < 0.6 ? 0.5 : -0.5;
  if (w.storm) mood -= 3;
  if (w.fog > 0.4) mood -= 0.8;
  if (w.cloud > 0.85 && w.season === 'winter') mood -= 1;
  if (w.season === 'spring' && T0 > 12 && w.rain < 0.05) mood += 1; // Frühlingsgefühle
  I.mood += (mood - I.mood) * 0.3;
  I.impact = {
    supply, fs, fw, fh, Ss, Sw, Sh, heatElec, cool, cover, powerMul: m - 1, water, tour, beach, rid, mood: I.mood,
    tempAvg: I.tempAvg, precipAvg: I.precipAvg, windAvg: I.windAvg, frostBuild: frostSlow(w) > 0,
  };
}
const frostSlow = (w) => (w.temp < -3 || w.snow > 0.3 || w.snowCover > 0.7 ? 0.35 : 0);

// Badestellen: Feld 0..1 (Freibad, Strandbad) für den Glücksfaktor
function rebuildPoolField(g) {
  const I = I_(g);
  const f = I.poolField && I.poolField.length === g.N ? I.poolField : new Float32Array(g.N);
  f.fill(0);
  for (const b of g.buildings.values()) {
    if ((b.key !== 'swimming_pool' && b.key !== 'beach') || b.construct < 1 || b.abandoned) continue;
    const r = 8;
    forDisc(g, b.x + b.w / 2, b.y + b.h / 2, r, (t, d) => { f[t] = Math.max(f[t], 1 - d / (r + 1)); });
  }
  I.poolField = f;
}

function recomputeFarms(g) {
  for (const b of g.buildings.values()) {
    if (b.spec !== 'farm' || b.abandoned) continue;
    b.cap = capacityOf(b, g);
    if (b.occ > b.cap) b.occ = b.cap;
  }
}

const SEASON_NEWS = {
  spring: ['Der Frühling ist da! Die Bäume schlagen aus, und die Umzugswagen rollen wieder.', 'Frühlingsanfang: Die Cafés stellen Tische raus, die Stadt atmet auf.'],
  summer: ['Der Sommer beginnt! Freibäder öffnen, Touristen strömen in die Stadt – und alle wollen Wasser.', 'Sommeranfang: Hitze heißt mehr Wasserverbrauch und Klimaanlagen. Gewitter sind möglich.'],
  autumn: ['Herbstanfang: Die Blätter färben sich, die Ernte beginnt. Achtung vor Herbststürmen!', 'Der Herbst ist da – Erntezeit auf den Höfen, Nebel am Morgen, Sturmgefahr.'],
  winter: ['Der Winter kommt: Heizbedarf steigt, Schnee ist möglich. Winterdienst und Stromreserve prüfen!', 'Winteranfang! Ohne Fernwärme heizen viele elektrisch – das kostet Strom. Ein Winterdienst hält die Straßen frei.'],
};

function onSeason(g, prev, cur) {
  const I = I_(g);
  recomputeFarms(g);
  g.dirty.util = true;
  if (prev && g.stats.pop > 0) {
    const list = SEASON_NEWS[cur];
    g.news('season', list[Math.floor(rngNext(I) * list.length)], 'info');
  }
  emit('season', { season: cur, prev, year: g.ext.weather.year });
  g.emit('season', cur);
}

// ---------- Winterdienst: Räumfahrzeuge (renderables)
function depotTiles(g, b) {
  const I = I_(g);
  if (I.plowNet !== g.netVersion) { I.plowTiles.clear(); I.plowNet = g.netVersion; }
  let list = I.plowTiles.get(b.id);
  if (!list) {
    list = [];
    const r = BUILDINGS.snow_depot?.service?.radius || 16;
    forDisc(g, b.x + b.w / 2, b.y + b.h / 2, r, (t) => { if (g.road[t] && g.road[t] !== 4 && g.roadComp[t] === g.roadComp[b.access]) list.push(t); });
    I.plowTiles.set(b.id, list);
  }
  return list;
}

function updatePlows(g) {
  const I = I_(g), w = g.ext.weather;
  const active = w.snowCover > 0.18 || w.snow > 0.2;
  if (!active) { if (I.plows.length) I.plows = I.plows.filter((p) => g.time < p.t0 + p.dur); return; }
  const depots = [];
  for (const b of g.buildings.values()) if (b.key === 'snow_depot' && b.construct >= 1 && !b.abandoned && b.access >= 0) depots.push(b);
  const want = new Map(depots.map((b) => [b.id, Math.min(3, Math.ceil((BUILDINGS.snow_depot.snowPlows || 3) / 2))]));
  const keep = [];
  for (const p of I.plows) {
    const b = g.buildings.get(p.depot);
    if (!b || !want.has(p.depot)) continue;
    if (g.time >= p.t0 + p.dur) continue;
    keep.push(p);
    want.set(p.depot, want.get(p.depot) - 1);
  }
  I.plows = keep;
  for (const b of depots) {
    let n = want.get(b.id);
    const tiles = depotTiles(g, b);
    if (!tiles.length) continue;
    while (n-- > 0) {
      const to = tiles[Math.floor(rngNext(I) * tiles.length)];
      const res = findPath(g, b.access, to);
      if (!res || res.path.length < 3) continue;
      const speed = 0.032; // Felder pro Spielminute
      I.plows.push({ depot: b.id, path: res.path, t0: g.time, dur: (res.path.length - 1) / speed, speed });
    }
  }
}

function plowRenderables(g) {
  const I = I_(g);
  if (!I.plows.length) return [];
  const out = [];
  const W = g.W, ox = -g.W / 2 + 0.5, oz = -g.H / 2 + 0.5;
  for (const p of I.plows) {
    const s = clamp((g.time - p.t0) * p.speed, 0, p.path.length - 1.001);
    const k = Math.floor(s), f = s - k;
    const a = p.path[k], b = p.path[k + 1];
    const ax = a % W, ay = (a / W) | 0, bx = b % W, by = (b / W) | 0;
    const x = ax + (bx - ax) * f, y = ay + (by - ay) * f;
    const dx = bx - ax, dy = by - ay;
    const off = 0.16;
    const onBridge = g.world.terrain[f < 0.5 ? a : b] === T.WATER;
    out.push({ kind: 'snowplow', x: x + ox - dy * off, y: onBridge ? 0.24 : 0.012, z: y + oz + dx * off, yaw: Math.atan2(dx, dy), lights: true });
  }
  return out;
}

// ---------- Vorhersage für Oberfläche und andere Systeme
function exportForecast(g) {
  const w = g.ext.weather;
  const today = Math.floor(g.time / DAY);
  const out = [];
  for (let d = today; d < today + FORECAST_DAYS; d++) {
    const p = plan(g, d);
    let ph = 0;
    for (const [s, e] of p.precip) ph += Math.max(0, Math.min(24, e) - Math.max(0, s));
    const snowy = p.tMax < 2.2 && p.precip.length > 0;
    out.push({ day: d, kind: snowy && p.kind !== 'snow' ? 'snow' : p.kind, tMin: p.tMin, tMax: p.tMax, precip: clamp(ph / 12, 0, 1), wind: p.wind, storm: !!p.storm || p.kind === 'storm', fog: p.fog, forced: p.forced });
  }
  w.forecast = out;
}
export function dayPlan(g, d) { return plan(g, d); }

// ---------- Glücksfaktoren
HAPPINESS_FACTORS.push((g, b) => {
  const I = INTERNAL.get(g);
  if (!I || !g.ext.weather || b.zone === Z.IND) return null;
  const v = I.mood * (b.zone === Z.RES ? 1 : 0.6);
  return Math.abs(v) >= 0.5 ? ['Wetter', v] : null;
});
HAPPINESS_FACTORS.push((g, b, i) => {
  const I = INTERNAL.get(g), w = g.ext.weather;
  if (!I || !w || b.zone !== Z.RES || I.tempAvg < 27) return null;
  let v = -(I.tempAvg - 26) * 0.9;
  v *= 1 - 0.5 * g.cov.park[i];
  if (g.world.waterDist[i] <= 3) v *= 0.7;
  if (I.poolField) v *= 1 - 0.5 * I.poolField[i];
  if (g.eff('heatShield') > 0) v *= 0.5;
  return ['Hitze', v];
});
HAPPINESS_FACTORS.push((g, b) => {
  const I = INTERNAL.get(g), w = g.ext.weather;
  if (!I || !w || b.zone !== Z.RES || w.heatNeed < 0.45 || I.heatCover > 0.95) return null;
  const v = -(w.heatNeed - 0.35) * 5 * (1 - I.heatCover) * (b.powered ? 0.6 : 1.5);
  return v < -0.4 ? ['Kalte Wohnungen', v] : null;
});
HAPPINESS_FACTORS.push((g, b, i) => {
  const w = g.ext.weather;
  if (!w || w.snowCover < 0.15 || b.zone === 0) return null;
  const c = g.cov.snow ? g.cov.snow[i] : 0;
  const v = -4 * w.snowCover * (1 - c);
  return v < -0.5 ? ['Ungeräumte Straßen', v] : null;
});
HAPPINESS_FACTORS.push((g, b, i) => {
  const I = INTERNAL.get(g), w = g.ext.weather;
  if (!I || !w || !I.poolField || b.zone !== Z.RES || I.tempAvg < 21 || !I.poolField[i]) return null;
  if (w.season !== 'summer' && w.season !== 'spring') return null;
  return ['Freibad offen', 4 * I.poolField[i]];
});
HAPPINESS_FACTORS.push((g, b) => {
  const w = g.ext.weather;
  if (!w || b.zone !== Z.RES || w.season !== 'winter' || w.seasonDay < 4 || w.seasonDay > 16) return null;
  return ['Weihnachtszeit', 2];
});

// ---------- Nachfrage (Jahreszeit)
DEMAND_MODIFIERS.push((g, d) => {
  const w = g.ext.weather;
  if (!w || !w.season) return;
  if (w.season === 'spring') d[1] += 4;
  if (w.season === 'summer') d[2] += 4;
  if (w.season === 'winter') { d[1] -= 3; if (w.seasonDay >= 4 && w.seasonDay <= 16) d[2] += 10; }
  if (w.season === 'autumn') d[3] += 3;
});

// ---------- Bauernhöfe arbeiten saisonal
CAPACITY_MODIFIERS.push((g, b, cap) => {
  if (b.spec !== 'farm' || !g.ext || !g.ext.weather || !g.ext.weather.season) return cap;
  return cap * (FARM[g.ext.weather.season] || 1);
});

// ---------- Haushalt: Winterdienst und Heizung öffentlicher Gebäude
BUDGET_LINES.push({
  id: 'winter', label: 'Winterdienst & Heizung', kind: 'expense',
  amount(g) {
    const w = g.ext && g.ext.weather;
    if (!w || !w.season) return 0;
    let depots = 0, pub = 0;
    for (const b of g.buildings.values()) {
      if (b.zone || b.construct < 1) continue;
      pub++;
      if (b.key === 'snow_depot') depots++;
    }
    const plow = w.snowCover > 0.1 || w.snow > 0.05 ? depots * 45 : 0;
    return (plow + pub * w.heatNeed * 2.2) * g.upkeepMul();
  },
});

// ---------- Debug / Prüfstand: Wetter sofort setzen
// setWeatherNow(g, 'snow', { snowCover: 0.8 }) – Art: clear, fair, cloudy, overcast, rain, showers, thunder, storm, fog, snow, heat, frost
export function setWeatherNow(g, kind, extra = {}) {
  const I = I_(g), w = g.ext.weather;
  const d = Math.floor(g.time / DAY), h = (g.time % DAY) / 60;
  const P = forceDay(g, d, kind, { reason: 'debug' });
  P.kind = kind;
  const kd = KINDS[kind] || KINDS.fair;
  P.cloud = kd.cloud;
  P.precip = kd.precip ? [[Math.max(0, h - 1), Math.min(24, h + 8), kind === 'snow' ? 0.7 : kind === 'showers' ? 0.8 : kind === 'storm' ? 0.6 : 0.75]] : [];
  P.storm = kind === 'thunder' ? [Math.max(0, h - 0.5), Math.min(24, h + 4), 1] : null;
  if (kind === 'fog') { P.fog = 0.9; P.fogEnd = Math.min(24, h + 4); } else if (!extra.keepFog) P.fog = 0;
  if (kind === 'storm') P.wind = Math.max(P.wind, 0.9);
  if (kind === 'snow' || kind === 'frost') { const dd = Math.max(0, P.tMax - (kind === 'snow' ? -1 : -4)); P.tMax -= dd; P.tMin -= dd; }
  if (kind === 'heat') { const dd = Math.max(0, 33 - P.tMax); P.tMax += dd; P.tMin += dd; }
  simulate(g, 10, true);
  for (const k of ['snowCover', 'wet', 'dry']) if (typeof extra[k] === 'number') w[k] = extra[k];
  if (typeof extra.snowCover === 'number' || typeof extra.temp === 'number') { I.tempAvg = w.temp; }
  simulate(g, 0.01);
  applyEffects(g);
  exportForecast(g);
  return w;
}

registerSystem({
  id: 'weather',
  init(g) {
    INTERNAL.delete(g);
    g.ext.weather = freshState(g);
    const I = I_(g);
    ensurePlans(g, Math.floor(g.time / DAY) + FORECAST_DAYS);
    // Die ersten zwei Tage: freundlicher Start
    const d0 = Math.floor(g.time / DAY);
    for (const d of [d0, d0 + 1]) { const p = plan(g, d); if (KINDS[p.kind].precip || p.kind === 'fog') { I.plans.set(d, Object.assign(p, { kind: 'fair', precip: [], storm: null, fog: 0, cloud: 0.25, forced: 'start' })); } }
    simulate(g, 10, true);
    I.lastSeason = g.ext.weather.season;
    exportForecast(g);
  },
  step(g, minutes) {
    const I = I_(g), w = g.ext.weather;
    simulate(g, minutes);
    if (w.season !== I.lastSeason) { const prev = I.lastSeason; I.lastSeason = w.season; onSeason(g, prev, w.season); }
    // Frost und Schnee verlangsamen Baustellen (nicht die Reparaturen des Katastrophenschutzes)
    const slow = frostSlow(w);
    if (slow > 0) {
      const rep = g.ext.disasters && g.ext.disasters.repairs;
      for (const b of g.buildings.values()) {
        if (b.construct >= 1 || b.construct <= 0.01 || (rep && rep[b.id])) continue;
        const days = b.zone ? (b.level > 1 ? 0.35 : 0.5) : 0.6;
        b.construct = Math.max(0.01, b.construct - (minutes / (days * 1440)) * slow);
      }
    }
    updatePlows(g);
  },
  hourly(g, h) {
    applyEffects(g);
    if (h % 6 === 0) exportForecast(g);
  },
  daily(g, day) {
    const I = I_(g), w = g.ext.weather;
    // Trockenheit aus dem vergangenen Tag
    if (I.dayPrecipH < 0.5 && I.dayMaxT > 23) w.dry += 0.1 + (I.dayMaxT - 23) * 0.02;
    else if (I.dayPrecipH < 0.5) w.dry += I.dayMaxT > 12 ? 0.02 : -0.03;
    else w.dry -= 0.12 + I.dayPrecipH * 0.04;
    w.dry = clamp(w.dry, 0, 1);
    I.dayMaxT = -99; I.dayPrecipH = 0;
    ensurePlans(g, day + FORECAST_DAYS);
    for (const k of [...I.plans.keys()]) if (k < day - 2) I.plans.delete(k);
    rebuildPoolField(g);
    exportForecast(g);
    // Besondere Wetterlagen ankündigen
    const p = plan(g, day);
    const say = (key, text, mood = 'info') => { if (I.notes[key] !== day) { I.notes[key] = day; if (g.stats.pop > 50) g.news('weather', text, mood); } };
    if (p.kind === 'heat' && plan(g, day - 1).kind !== 'heat') say('heat', `Hitzewelle: bis zu ${Math.round(p.tMax)} °C. Wasserverbrauch und Klimaanlagen laufen heiß – Parks und Freibäder kühlen.`, 'bad');
    if (p.tMax < 2.2 && p.precip.length && !I.firstSnowDone && w.season === 'winter') { I.firstSnowDone = true; say('snow', 'Der erste Schnee! Ohne Winterdienst wird es auf den Straßen glatt.', 'info'); }
    if (w.season !== 'winter') I.firstSnowDone = false;
    if (p.kind === 'frost' && plan(g, day - 1).kind !== 'frost') say('frost', `Frostnacht: bis ${Math.round(p.tMin)} °C. Heizungen laufen auf Hochtouren.`, 'info');
    if (w.dry > 0.65 && I.notes.dryWarn !== Math.floor(day / 7)) { I.notes.dryWarn = Math.floor(day / 7); if (g.stats.pop > 50) g.news('weather', 'Trockenheit: Die Böden sind ausgedörrt. Waldbrandgefahr!', 'bad'); }
  },
  serialize(g) {
    const I = I_(g), w = g.ext.weather;
    const plans = [...I.plans.values()].filter((p) => p.d >= Math.floor(g.time / DAY) - 1);
    const { forecast, ...pub } = w;
    void forecast;
    return {
      w: pub, rs: I.rs, lastGen: I.lastGen, anom: I.anom, prevKind: I.prevKind, windDir: I.windDir,
      avg: [I.cloudAvg, I.windAvg, I.tempAvg, I.precipAvg, I.precip7, I.mood], lastSeason: I.lastSeason, firstSnow: I.firstSnowDone,
      day: [I.dayMaxT, I.dayPrecipH], plans,
    };
  },
  load(g, d) {
    if (!d || !d.w) return;
    const I = I_(g);
    Object.assign(g.ext.weather, d.w);
    I.rs = d.rs >>> 0; I.anom = d.anom || 0; I.prevKind = d.prevKind || 'fair'; I.windDir = d.windDir || 0;
    [I.cloudAvg, I.windAvg, I.tempAvg, I.precipAvg, I.precip7, I.mood] = d.avg || [0.3, 0.2, 10, 0, 0.3, 0];
    I.lastSeason = d.lastSeason || g.ext.weather.season; I.firstSnowDone = !!d.firstSnow;
    [I.dayMaxT, I.dayPrecipH] = d.day || [-99, 0];
    I.plans = new Map();
    for (const p of d.plans || []) I.plans.set(p.d, p);
    I.lastGen = d.lastGen ?? -2;
    if (!I.plans.size) I.lastGen = Math.floor(g.time / DAY) - 2;
    recomputeFarms(g);
    rebuildPoolField(g);
    applyEffects(g);
    exportForecast(g);
  },
  renderables(g) { return plowRenderables(g); },
  // Für Skripte und Werkzeuge: g.system('weather').set(g, 'snow', { snowCover: 0.8 })
  set: setWeatherNow, force: forceDay, calendar,
});
