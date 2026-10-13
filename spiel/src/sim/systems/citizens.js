// System „Bürger & Dienste" (Besitzer S2). Läuft headless – keine Imports aus render/ oder ui/.
//
// Bevölkerungsmodell: Jedes Wohngebäude trägt in b.cz eine Altersstruktur aus 20 Altersgruppen à 5 Jahre
// (0–4 … 95–99) und eine Bildungsverteilung (ohne Abschluss, Schulabschluss, Abitur, Hochschule).
// Ein Spieltag entspricht einem halben Lebensjahr (YEARS_PER_DAY). Menschen werden geboren, altern, gehen zur Kita, Schule,
// aufs Gymnasium und an die Universität, werden krank und sterben. Die Kernsimulation kennt nur b.occ –
// dieses System hält die Kohorten mit b.occ im Gleichgewicht (Zuzug/Wegzug), verändert b.occ durch
// Geburten und Sterbefälle und schreibt den Bildungsstand nach b.edu (wirkt auf Stufen und Büro-Nachfrage).
//
// Dienste:
//  · Bestattung: Verstorbene warten im Gebäude, Leichenwagen von Friedhof/Krematorium holen sie ab
//    (Friedhöfe haben Gräber mit 25 Jahren Ruhefrist). Sonst: Unglück, Wegzug, Problemsymbol.
//  · Abwasser: dritte Versorgung wie Wasser (pro Straßennetz). Auslässe verschmutzen Gewässer,
//    Pumpwerke am verschmutzten Wasser liefern verunreinigtes Trinkwasser (Krankheit, Unglück).
//  · Gesundheit: Krankenstand je Gebäude aus Abgasen, Abwasser, Trinkwasser, Kälte, Alter – Ärzte heilen.
//  · Fernwärme: bei Kälte (g.ext.weather.temp) brauchen Gebäude Wärme aus Heizkraftwerken.
//  · Gefängnis, Seniorenheim, Forschungszentrum.
// Fahrzeuge (renderables): Leichenwagen ('hearse') und Rettungswagen ('ambulance') über das Straßennetz.
//
// Zustand: g.ext.citizens = { stats, hist, lvWater, lvSew, waterPol, contam, vehicles, … } und b.cz je Gebäude.
import { registerSystem, HAPPINESS_FACTORS, LANDVALUE_TERMS, DEMAND_MODIFIERS, BUDGET_LINES } from '../../registry.js';
import { BUILDINGS, Z, T, R, LEVELS } from '../../config.js';
import { clamp, hash2, mulberry32, citizenName, pick, typedToB64, b64ToTyped } from '../../util.js';
import { waterUse } from '../services.js';
import { findPath } from '../network.js';

// ---------- Konstanten
export const BINS = 20;            // Altersgruppen à 5 Jahre
export const E3 = 20;              // Bildung der 15–19-Jährigen (4 Werte)
export const E4 = 24;              // Bildung der 20–24-Jährigen
export const EA = 28;              // Bildung der Erwachsenen ab 25
export const LEN = 32;
export const YEARS_PER_DAY = 0.5;   // ein Spieltag = ein halbes Lebensjahr
export const AGE_GROUPS = [
  { id: 'kids', name: 'Kinder', range: '0–14', from: 0, to: 2, color: '#f2b01e' },
  { id: 'youth', name: 'Jugendliche', range: '15–24', from: 3, to: 4, color: '#22a866' },
  { id: 'adults', name: 'Erwachsene', range: '25–64', from: 5, to: 12, color: '#2f8fe0' },
  { id: 'seniors', name: 'Senioren', range: '65+', from: 13, to: 19, color: '#8f5ad8' },
];
export const EDU_LEVELS = ['Ohne Abschluss', 'Schulabschluss', 'Abitur', 'Hochschule'];
export const EDU_COLORS = ['#b9b2a5', '#4c9be8', '#22a866', '#8f5ad8'];
const EDU_W = [0, 0.3, 0.65, 1];
// Sterbewahrscheinlichkeit pro Jahr je Altersgruppe (gute Versorgung)
export const MORT = [0.0012, 0.0002, 0.0002, 0.0004, 0.0006, 0.0006, 0.0007, 0.0009, 0.0013, 0.002, 0.0032, 0.005, 0.009, 0.015, 0.025, 0.045, 0.08, 0.14, 0.25, 0.42];
const FERT = 0.04; // Geburten je Person zwischen 20 und 44 pro Jahr (≈ 2 Kinder je Frau)
const IMM_RAW = [0.075, 0.06, 0.05, 0.055, 0.12, 0.145, 0.125, 0.095, 0.07, 0.05, 0.04, 0.03, 0.025, 0.02, 0.015, 0.012, 0.008, 0.004, 0.0015, 0.0005];
const IMM = (() => { const s = IMM_RAW.reduce((a, b) => a + b, 0); return IMM_RAW.map((v) => v / s); })();
// Kapazitäten (Schulplätze usw.) für Gebäude, deren Daten nicht in content/services.js liegen
const STAGE_OF = { kindergarten: 'kita', school: 'school', highschool: 'gym', university: 'uni', library: 'lib' };
const SEATS_DEFAULT = { kindergarten: 140, school: 650, highschool: 520, university: 1800, library: 260 };
const BEDS_DEFAULT = { clinic: 12, hospital: 180 };
const bedsOf = (f) => BUILDINGS[f.key].beds ?? BEDS_DEFAULT[f.key] ?? Math.round(((BUILDINGS[f.key].service || {}).capacity || 700) / 70);
export const STAGES = [
  { id: 'kita', name: 'Kita', who: 'Kinder 0–4' },
  { id: 'school', name: 'Schule', who: 'Kinder 5–14' },
  { id: 'gym', name: 'Gymnasium', who: 'Jugendliche 15–19' },
  { id: 'uni', name: 'Universität', who: 'Studierende 20–24' },
  { id: 'lib', name: 'Bibliothek', who: 'Weiterbildung' },
];
export const SEWAGE_POP = 300;        // ab hier meldet sich die Stadtentwässerung
export const SEWAGE_LEVEL = 3;        // Zonengebäude ab dieser Stufe brauchen einen Kanalanschluss (sonst Sickergrube)
export const SEWAGE_ALL_POP = 3000;   // ab dieser Einwohnerzahl brauchen alle Zonengebäude den Kanal
export const HEAT_LEVEL = 3;          // ab dieser Stufe brauchen Gebäude bei Kälte Fernwärme
export const UMLAND_PER_DAY = 3;      // so viele Verstorbene holt das Umland pro Tag ab
export const UMLAND_FEE = 60;        // € je Bestattung im Umland
const BODIES_PER_HEARSE = 6;          // Verstorbene je Leichenwagen und Tag
const REST_YEARS = 25;                // Ruhefrist auf dem Friedhof
const REST_DAYS = Math.round(REST_YEARS / YEARS_PER_DAY);
const POL_RADIUS = 8;                 // Ausbreitung der Wasserverschmutzung (Felder)
const MAX_HEARSES = 12, MAX_AMBULANCES = 8;
const HEARSE_SPEED = 0.04, AMB_SPEED = 0.06; // Felder je Spielminute

// ---------- Hilfen
export function newCz(res) {
  return {
    a: res ? new Float32Array(LEN) : null,
    sick: 0, dead: 0, deadDays: 0, dAcc: 0, bAcc: 0, born: 0, died: 0,
    sew: true, noSew: 0, heat: true, cold: 0,
    kq: 0, sq: 0, gq: 0, uq: 0, lq: 0, kqA: -1, sqA: 0, gqA: 0, uqA: 0, care: 0,
  };
}
export function czOf(b) {
  if (!b.cz) b.cz = newCz(b.zone === Z.RES);
  else if (b.zone === Z.RES && !b.cz.a) b.cz.a = new Float32Array(LEN);
  return b.cz;
}
function sumRange(a, from, to) { let s = 0; for (let k = from; k <= to; k++) s += a[k]; return s; }
export function groupCounts(a) { return AGE_GROUPS.map((gr) => (a ? sumRange(a, gr.from, gr.to) : 0)); }
export function eduOf(a) {
  // Bildungsverteilung der Menschen ab 20 Jahren
  if (!a) return [0, 0, 0, 0];
  return [0, 1, 2, 3].map((l) => a[E4 + l] + a[EA + l]);
}
export function eduIndex(a) {
  const e = eduOf(a);
  const n = e[0] + e[1] + e[2] + e[3];
  if (n <= 1e-6) return -1;
  return (e[0] * EDU_W[0] + e[1] * EDU_W[1] + e[2] * EDU_W[2] + e[3] * EDU_W[3]) / n;
}
export function avgAgeOf(a) {
  let s = 0, n = 0;
  for (let k = 0; k < BINS; k++) { s += a[k] * (k * 5 + 2.5); n += a[k]; }
  return n > 0 ? s / n : 0;
}
const def = (b) => (b.zone ? null : BUILDINGS[b.key]);
const center = (b) => [b.x + b.w / 2, b.y + b.h / 2];
const tileOf = (b, g) => (b.y + (b.h >> 1)) * g.W + b.x + (b.w >> 1);
const budget = (g, d) => g.serviceBudget[d.cat] ?? 1;
const working = (b) => b.construct >= 1 && !b.abandoned;
function scaleBlock(a, off, target) {
  const s = a[off] + a[off + 1] + a[off + 2] + a[off + 3];
  if (target <= 1e-6) { a[off] = a[off + 1] = a[off + 2] = a[off + 3] = 0; return; }
  if (s <= 1e-6) { a[off + 1] = target; return; }
  const f = target / s;
  a[off] *= f; a[off + 1] *= f; a[off + 2] *= f; a[off + 3] *= f;
}
function distPolicy(g, b, pid) {
  const D = g.ext.districts;
  if (!D || !D.map || !D.list || !D.list.length) return false;
  const id = D.map[b.y * g.W + b.x];
  if (!id) return false;
  const d = D.byId ? D.byId[id] : D.list.find((x) => x.id === id);
  return !!(d && d.policies && d.policies.includes(pid));
}
export function sewageRequired(g) { return g.stats.pop >= SEWAGE_POP || (g.ext.citizens && g.ext.citizens.sewReq); }
// Braucht dieses Gebäude einen Kanalanschluss? Kleine Häuser kommen mit einer Sickergrube aus.
export function needsSewer(g, b) { return !!b.zone && (b.level >= SEWAGE_LEVEL || g.stats.pop >= SEWAGE_ALL_POP); }

// ---------- Zuzug und Wegzug
function addPeople(g, b, cz, n) {
  const a = cz.a;
  const i = b.y * g.W + b.x;
  const c = clamp(g.cov.edu[i], 0, 1);
  // Wer zuzieht, hängt vom Angebot ab: Kitas ziehen Familien an, Seniorenheime Ältere, Universitäten Studierende
  const w = IMM.slice();
  if (cz.kq > 0.3) { w[0] *= 1.3; w[1] *= 1.15; }
  if (cz.care > 0.3) for (let k = 13; k < BINS; k++) w[k] *= 1.6;
  if (cz.uq > 0.3) w[4] *= 1.5;
  let ws = 0; for (const v of w) ws += v;
  for (let k = 0; k < BINS; k++) {
    const m = (n * w[k]) / ws;
    a[k] += m;
    if (k === 3) { const s = Math.min(0.92, 0.5 + 0.4 * c); a[E3] += m * (1 - s); a[E3 + 1] += m * s; }
    else if (k >= 4) {
      const uni = 0.03 + 0.3 * c * c, ab = 0.1 + 0.25 * c, sch = 0.4 - 0.15 * c, none = Math.max(0, 1 - uni - ab - sch);
      const off = k === 4 ? E4 : EA;
      if (k === 4) { a[off] += m * none; a[off + 1] += m * sch; a[off + 2] += m * (ab + uni * 0.6); a[off + 3] += m * uni * 0.4; }
      else { a[off] += m * none; a[off + 1] += m * sch; a[off + 2] += m * ab; a[off + 3] += m * uni; }
    }
  }
}
function removePeople(cz, n) {
  const a = cz.a;
  let tot = 0;
  for (let k = 0; k < BINS; k++) tot += a[k];
  if (tot <= 1e-6) return;
  const f = Math.max(0, 1 - n / tot);
  for (let k = 0; k < LEN; k++) a[k] *= f;
}

// ---------- Geburt, Altern, Bildung, Tod (ein Tag für ein Gebäude)
function stepPeople(g, C, b, cz, rnd, ctx) {
  const a = cz.a;
  let tot = 0;
  for (let k = 0; k < BINS; k++) tot += a[k];
  const expected = tot + cz.dAcc - cz.bAcc;
  const diff = b.occ - expected;
  if (diff > 1e-3) { addPeople(g, b, cz, diff); ctx.moveIn += diff; }
  else if (diff < -1e-3) { removePeople(cz, Math.min(tot, -diff)); ctx.moveOut += -diff; }
  if (b.occ <= 0) { a.fill(0); cz.dAcc = cz.bAcc = 0; return; }

  const i = b.y * g.W + b.x;
  const health = g.cov.health[i];
  const pol = g.fields.pollution[i];
  // --- Krankheit
  const seniors = sumRange(a, 13, 19);
  tot = 0; for (let k = 0; k < BINS; k++) tot += a[k];
  const seniorShare = tot > 0 ? seniors / tot : 0;
  const contam = (C.contam && b.comp >= 0 ? C.contam[b.comp] : 0) || 0;
  let inc = 0.006 + pol * 0.05 + (cz.sew || !cz.sewNeed ? 0 : 0.012) + contam * 0.09 + cz.cold * 0.03 + seniorShare * 0.025 + ctx.flu;
  inc *= (g.policies.has('vaccination') ? 0.65 : 1) * Math.max(0.2, 1 + g.eff('sickness'));
  const rec = 0.25 + 0.6 * health;
  cz.sick = clamp(cz.sick + inc * (1 - cz.sick) - rec * cz.sick, 0, 0.9);

  // --- Sterbefälle
  // Schwer Kranke brauchen ein Krankenhausbett – fehlen Betten, sterben mehr
  const mm = (1.25 - 0.42 * health) * (1 + cz.sick * (1 + 1.2 * (1 - ctx.bedQ))) * (1 + pol * 0.35) * (g.policies.has('vaccination') ? 0.94 : 1);
  const careMul = (1 - 0.22 * cz.care) * ctx.heat; // Hitzewellen treffen vor allem Ältere
  const dk = ctx.dk;
  let D = 0;
  for (let k = 0; k < BINS; k++) {
    let d = a[k] * Math.min(0.9, MORT[k] * mm * (k >= 13 ? careMul : 1) * YEARS_PER_DAY);
    if (k === BINS - 1) { const old = (a[k] - d) * 0.2 * YEARS_PER_DAY; d += old; ctx.centenarians += old; } // 100 Jahre
    dk[k] = d;
    D += d;
  }
  ctx.mmSum += mm * tot; ctx.mmW += tot;
  // Bildungsblöcke anpassen
  const adultsBefore = sumRange(a, 5, 19);
  const a3 = a[3], a4 = a[4];
  for (let k = 0; k < BINS; k++) a[k] -= dk[k];
  if (a3 > 1e-6) scaleBlock(a, E3, a[3]);
  if (a4 > 1e-6) scaleBlock(a, E4, a[4]);
  if (adultsBefore > 1e-6) scaleBlock(a, EA, sumRange(a, 5, 19));
  for (let k = 0; k < BINS; k++) ctx.deathsByBin[k] += dk[k];

  // --- Altern (ein Fünftel jeder Gruppe rückt pro Jahr auf)
  const f = ctx.flow;
  for (let k = 0; k < BINS - 1; k++) f[k] = a[k] * 0.2 * YEARS_PER_DAY;
  // Bildungsübergänge
  const boost = ctx.eduBoost * (distPolicy(g, b, 'd_edu') ? 1.2 : 1);
  const ps = clamp(0.12 + 0.83 * cz.sqA * (0.9 + 0.1 * Math.max(0, cz.kqA)) * boost, 0, 0.98);
  const pg = clamp(Math.max(0.06 * cz.sqA, 0.88 * cz.gqA) * boost * ctx.study, 0, 0.95);
  const pu = clamp(0.85 * cz.uqA * boost * ctx.study, 0, 0.95);
  // 15-Jährige: Schulabschluss?
  const f2 = f[2];
  // 20-Jährige verlassen die Gruppe 15–19
  const s3 = a[E3] + a[E3 + 1] + a[E3 + 2] + a[E3 + 3];
  const f3 = f[3];
  const e3 = s3 > 1e-6 ? [a[E3] / s3, a[E3 + 1] / s3, a[E3 + 2] / s3, a[E3 + 3] / s3] : [1, 0, 0, 0];
  const s4 = a[E4] + a[E4 + 1] + a[E4 + 2] + a[E4 + 3];
  const f4 = f[4];
  const e4 = s4 > 1e-6 ? [a[E4] / s4, a[E4 + 1] / s4, a[E4 + 2] / s4, a[E4 + 3] / s4] : [1, 0, 0, 0];
  for (let l = 0; l < 4; l++) { a[E3 + l] -= f3 * e3[l]; a[E4 + l] -= f4 * e4[l]; }
  a[E3] += f2 * (1 - ps); a[E3 + 1] += f2 * ps;
  a[E4] += f3 * e3[0]; a[E4 + 1] += f3 * e3[1] * (1 - pg); a[E4 + 2] += f3 * (e3[1] * pg + e3[2]); a[E4 + 3] += f3 * e3[3];
  a[EA] += f4 * e4[0]; a[EA + 1] += f4 * e4[1]; a[EA + 2] += f4 * e4[2] * (1 - pu); a[EA + 3] += f4 * (e4[2] * pu + e4[3]);
  ctx.graduates[1] += f2 * ps; ctx.graduates[2] += f3 * e3[1] * pg; ctx.graduates[3] += f4 * e4[2] * pu;
  // Abschlussquoten je Jahrgang
  const R = ctx.rates;
  R[0] += f2 * ps; R[1] += f2;
  R[2] += f3 * (e3[1] * pg + e3[2] + e3[3]); R[3] += f3;
  R[4] += f4 * (e4[2] * pu + e4[3]); R[5] += f4;
  for (let k = BINS - 1; k >= 1; k--) a[k] += f[k - 1];
  for (let k = 0; k < BINS - 1; k++) a[k] -= f[k];
  // Weiterbildung (Bibliotheken)
  if (cz.lq > 0) {
    const m1 = a[EA] * 0.01 * cz.lq, m2 = a[EA + 1] * 0.004 * cz.lq;
    a[EA] -= m1; a[EA + 1] += m1 - m2; a[EA + 2] += m2;
  }

  // --- Geburten
  const parents = sumRange(a, 4, 8);
  const room = b.occ < b.cap;
  let fm = (0.7 + 0.6 * clamp(b.happy / 70, 0, 1)) * (room ? 1 : 0.4) * (1 + 0.12 * Math.max(0, cz.kqA));
  fm *= (g.policies.has('familybonus') ? 1.35 : 1) * (1 + g.eff('births'));
  const B = parents * FERT * fm * YEARS_PER_DAY;
  a[0] += B;

  // --- Ganze Menschen zählen (Akkumulatoren halten die Kohorten mit b.occ deckungsgleich)
  cz.dAcc += D; cz.bAcc += B;
  const nD = Math.floor(cz.dAcc), nB = Math.floor(cz.bAcc);
  cz.dAcc -= nD; cz.bAcc -= nB;
  b.occ = Math.max(0, b.occ - nD + nB);
  cz.dead += nD;
  cz.born += nB; cz.died += nD;
  ctx.deaths += nD; ctx.births += nB;
  // Überbelegung: eine Familie zieht aus
  if (b.occ > b.cap) {
    const ex = b.occ - b.cap;
    removePeople(cz, ex);
    b.occ = b.cap;
    ctx.moveOut += ex;
  }
  // Bildungsstand → Kernsimulation (Stufenaufstieg, Büro-Nachfrage)
  const ei = eduIndex(a);
  if (ei >= 0) b.edu = clamp(ei, 0, 1);
  void rnd;
}

// ---------- Einrichtungen
function collectFacilities(g) {
  const F = { death: [], stage: { kita: [], school: [], gym: [], uni: [], lib: [] }, care: [], health: [], prison: [], sewage: [], heat: [], research: [] };
  for (const b of g.buildings.values()) {
    if (b.zone || !working(b)) continue;
    const d = BUILDINGS[b.key];
    if (!d) continue;
    if (d.service && d.service.type === 'deathcare') F.death.push(b);
    if (d.service && d.service.type === 'edu') {
      const st = STAGE_OF[b.key] || (d.service.eduMax <= 0.3 ? 'kita' : d.service.eduMax <= 0.65 ? 'school' : d.service.eduMax <= 0.85 ? 'gym' : 'uni');
      F.stage[st].push(b);
    }
    if (d.service && d.service.type === 'health') F.health.push(b);
    if (d.seniorCare) F.care.push(b);
    if (d.crimeCity) F.prison.push(b);
    if (d.sewage) F.sewage.push(b);
    if (d.heat) F.heat.push(b);
    if (d.offBoost && b.key === 'research') F.research.push(b);
  }
  return F;
}
function nearest(list, x, y, radiusOf, comp) {
  let best = null, bd = 1e9;
  for (const f of list) {
    if (comp !== undefined && f.comp !== comp) continue;
    const [fx, fy] = center(f);
    const d = Math.hypot(fx - x, fy - y);
    const r = radiusOf(f);
    if (d <= r && d < bd) { bd = d; best = f; }
  }
  return best ? [best, bd] : null;
}
const svcRadius = (f) => BUILDINGS[f.key].service ? BUILDINGS[f.key].service.radius : 10;
const seatsOf = (f) => BUILDINGS[f.key].seats ?? SEATS_DEFAULT[f.key] ?? Math.round(((BUILDINGS[f.key].service || {}).capacity || 600) / 6);

// Schulplätze, Kita-Plätze, Studienplätze, Pflegeplätze: Belegung und Qualität je Gebäude
function coverageDaily(g, C, F, res) {
  const st = { };
  for (const S of STAGES) st[S.id] = { pupils: 0, seats: 0, missing: 0 };
  const seatMul = 1 + g.eff('seats');
  for (const S of STAGES) {
    const list = F.stage[S.id];
    for (const f of list) {
      const d = BUILDINGS[f.key];
      const cz = czOf(f);
      cz.pupils = 0;
      cz.seats = seatsOf(f) * budget(g, d) * (f.powered ? 1 : 0.5) * (f.connected ? 1 : 0.3) * seatMul;
      st[S.id].seats += cz.seats;
    }
  }
  const pupilsOf = (a, s) => s === 'kita' ? a[0] : s === 'school' ? a[1] + a[2] : s === 'gym' ? a[3] : s === 'uni' ? a[E4 + 2] + a[E4 + 3] : (a[EA] + a[EA + 1] + a[EA + 2] + a[EA + 3]) * 0.05;
  const assign = [];
  for (const b of res) {
    const cz = b.cz;
    const [x, y] = center(b);
    const row = {};
    for (const S of STAGES) {
      const n = nearest(F.stage[S.id], x, y, svcRadius);
      const p = pupilsOf(cz.a, S.id);
      if (n) { n[0].cz.pupils += p; row[S.id] = n; }
      else st[S.id].missing += p;
      st[S.id].pupils += p;
    }
    assign.push(row);
  }
  res.forEach((b, k) => {
    const cz = b.cz, row = assign[k];
    const q = (S) => {
      const n = row[S];
      if (!n) return 0;
      const [f, dist] = n;
      const fc = f.cz;
      const fill = fc.pupils > 0 ? Math.min(1, fc.seats / fc.pupils) : 1;
      const r = svcRadius(f);
      return fill * (1 - 0.35 * (dist / r) * (dist / r));
    };
    cz.kq = q('kita'); cz.sq = q('school'); cz.gq = q('gym'); cz.uq = q('uni'); cz.lq = q('lib');
    if (cz.kqA < 0) { cz.kqA = cz.kq; cz.sqA = cz.sq; cz.gqA = cz.gq; cz.uqA = cz.uq; }
    // Schulzeit dauert Jahre: geglättete Werte
    cz.kqA += (cz.kq - cz.kqA) * 0.15;
    cz.sqA += (cz.sq - cz.sqA) * 0.12;
    cz.gqA += (cz.gq - cz.gqA) * 0.15;
    cz.uqA += (cz.uq - cz.uqA) * 0.18;
  });
  // Seniorenheime
  let careCap = 0, careDem = 0;
  for (const f of F.care) { const cz = czOf(f); cz.residents = 0; cz.capacity = BUILDINGS[f.key].seniorCare * budget(g, BUILDINGS[f.key]) * (f.powered ? 1 : 0.6); careCap += cz.capacity; }
  const careAssign = res.map((b) => {
    const [x, y] = center(b);
    const n = nearest(F.care, x, y, (f) => BUILDINGS[f.key].careRadius || 12);
    const old = sumRange(b.cz.a, 15, 19);
    careDem += old;
    if (n) n[0].cz.residents += old;
    return n;
  });
  const extraCare = clamp(g.eff('care'), 0, 1);
  res.forEach((b, k) => {
    const n = careAssign[k];
    let q = 0;
    if (n) { const fc = n[0].cz; q = fc.residents > 0 ? Math.min(1, fc.capacity / fc.residents) : 1; }
    b.cz.care = clamp(q + extraCare, 0, 1);
  });
  C.stage = st;
  C.careStat = { cap: careCap, demand: careDem };
}

// Bestattung: Leichenwagen holen Verstorbene ab
function deathcareDaily(g, C, F, res, rnd) {
  const forest = g.policies.has('forestburial') ? 1.4 : 1;
  const fac = F.death.map((f) => {
    const d = BUILDINGS[f.key];
    const cz = czOf(f);
    if (!cz.ring || cz.ring.length !== REST_DAYS) cz.ring = new Array(REST_DAYS).fill(0);
    cz.used ||= 0;
    // Ruhefrist abgelaufen → Gräber werden frei
    const slot = g.day() % REST_DAYS;
    if (d.graves) { cz.used = Math.max(0, cz.used - cz.ring[slot]); cz.ring[slot] = 0; }
    cz.graveCap = d.graves ? Math.round((d.graves + (cz.extraGraves || 0)) * forest) : 0;
    let cap = (d.hearses || 4) * BODIES_PER_HEARSE * budget(g, d) * (f.connected || f.comp >= 0 ? 1 : 0.2);
    if (d.needsPower && !f.powered) cap *= 0.3;
    if (d.graves) cap = Math.min(cap, Math.max(0, cz.graveCap - cz.used));
    cz.capToday = cap;
    cz.today = 0;
    return f;
  });
  const waiting = res.filter((b) => b.cz.dead >= 1).sort((x, y) => y.cz.deadDays - x.cz.deadDays);
  const unlocked = g.isUnlocked('cemetery');
  // Übergang (Q2): Solange es noch keinen Friedhof gibt, nimmt das Umland deutlich mehr ab (gegen Gebühr) –
  // sonst stapeln sich die Verstorbenen schlagartig, sobald „Kleinstadt" erreicht ist.
  let umlandCap = unlocked ? UMLAND_PER_DAY + (fac.length ? 0 : Math.floor(g.stats.pop / 250)) + g.eff('umland') : 1e9;
  const umlandFree = g.eff('umland') > 0;
  let umland = 0, umlandPaid = 0, collected = 0;
  const trips = [];
  for (const b of waiting) {
    const cz = b.cz;
    const [x, y] = center(b);
    let left = cz.dead;
    // nächste Einrichtung mit freier Kapazität im selben Straßennetz
    const cands = fac.filter((f) => f.cz.capToday - f.cz.today >= 1 && f.comp === b.comp && b.comp >= 0);
    const n = nearest(cands, x, y, svcRadius);
    if (n) {
      const f = n[0];
      const take = Math.min(left, Math.floor(f.cz.capToday - f.cz.today));
      f.cz.today += take;
      left -= take;
      collected += take;
      if (BUILDINGS[f.key].graves) { f.cz.used += take; f.cz.ring[g.day() % REST_DAYS] += take; }
      else f.cz.cremated = (f.cz.cremated || 0) + take;
      trips.push([f.access, b.access]);
    }
    if (left >= 1 && umlandCap >= 1 && b.connected) {
      const take = Math.min(left, Math.floor(umlandCap));
      umlandCap -= take;
      left -= take;
      umland += take;
      if (!umlandFree || umland > g.eff('umland')) umlandPaid += take;
      trips.push([g.world.highwayEnd, b.access]);
    }
    cz.dead = left;
  }
  for (const b of res) b.cz.deadDays = b.cz.dead >= 1 ? b.cz.deadDays + 1 : 0;
  C.umlandToday = umland;
  C.umlandCost = g.sandbox ? 0 : umlandPaid * UMLAND_FEE * g.costMul;
  C.collectedToday = collected;
  // Leichenwagen sichtbar losschicken (über den Tag verteilt)
  for (let k = 0; k < trips.length && k < MAX_HEARSES; k++) {
    const [from, to] = trips[Math.floor(rnd() * trips.length)];
    scheduleTrip(g, C, 'hearse', from, to, g.time + rnd() * 900, HEARSE_SPEED, true);
  }
}

// Abwasser: pro Straßennetz wie Wasser. Stündlich.
function sewageHourly(g, C) {
  const nc = g.compCount;
  const cap = new Float32Array(nc + 1), dem = new Float32Array(nc + 1);
  const req = g.stats.pop >= SEWAGE_POP || C.sewReq;
  if (req && !C.sewReq) {
    C.sewReq = true;
    g.news('sewage', `Die Stadt wächst: Gebäude ab Stufe ${SEWAGE_LEVEL} brauchen einen Kanalanschluss. Baue einen Abwasserauslass oder eine Kläranlage am Ufer.`, 'info');
  }
  const mul = (g.mods.czSewage || 1) * Math.max(0.1, 1 + g.eff('sewageCap'));
  const facs = [];
  let totCap = 0, totDem = 0;
  for (const b of g.buildings.values()) {
    const cz = czOf(b);
    if (b.comp < 0) continue;
    const d = def(b);
    if (d && d.sewage && working(b)) {
      const c = d.sewage * budget(g, d) * mul * (d.needsPower && !b.powered ? 0.3 : 1);
      cz.sewCap = c;
      cap[b.comp] += c;
      facs.push(b);
    }
    const u = waterUse(g, b);
    cz.water = u;
    dem[b.comp] += u;
  }
  for (let c = 0; c < nc; c++) { totCap += cap[c]; totDem += dem[c]; }
  let uns = 0, connected = 0;
  for (const b of g.buildings.values()) {
    const cz = b.cz;
    cz.sewNeed = req && needsSewer(g, b) && !!cz.water;
    if (!cz.water) { cz.sew = true; continue; }
    if (b.comp < 0) { cz.sew = false; if (cz.sewNeed) uns++; continue; }
    const r = dem[b.comp] <= 0 ? 1 : Math.min(1, cap[b.comp] / dem[b.comp]);
    cz.sew = r >= 0.999 || hash2(b.id, 17) < r;
    if (cz.sew && cap[b.comp] > 0) connected++;
    if (!cz.sew && cz.sewNeed) uns++;
  }
  C.sewConnected = connected;
  // tatsächlich eingeleitete Menge je Anlage
  for (const f of facs) {
    const c = f.cz.sewCap;
    f.cz.sewFlow = cap[f.comp] > 0 ? c * Math.min(1, dem[f.comp] / cap[f.comp]) : 0;
    f.cz.sewLoad = cap[f.comp] > 0 ? dem[f.comp] / cap[f.comp] : 0;
  }
  C.sewCap = cap; C.sewDem = dem;
  C.sewageCap = totCap; C.sewageDemand = totDem; C.unsewered = uns;
  // Bodenwert-Abschlag für Gebäude ohne Abwasser
  const lv = C.lvSew || (C.lvSew = new Float32Array(g.N));
  lv.fill(0);
  if (req) for (const b of g.buildings.values()) {
    if (b.cz.sew || !b.cz.sewNeed) continue;
    for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) lv[yy * g.W + xx] = -6;
  }
  const sig = facs.map((f) => f.id + ':' + Math.round(f.cz.sewFlow / 25)).join(',');
  if (sig !== C.sewSig) { C.sewSig = sig; C.polDirty = true; }
}

// Wasserverschmutzung durch Abwasser und verunreinigtes Trinkwasser
function waterPollution(g, C) {
  const { W, H, N } = g;
  const terr = g.world.terrain;
  const pol = C.waterPol || (C.waterPol = new Float32Array(N));
  pol.fill(0);
  const dist = C._dist || (C._dist = new Int16Array(N));
  const q = C._q || (C._q = new Int32Array(N));
  let maxPol = 0;
  const sources = [];
  for (const b of g.buildings.values()) {
    const d = def(b);
    if (!d || !d.sewage || !working(b) || !b.cz || !b.cz.sewFlow) continue;
    const em = b.cz.sewFlow * (d.residual ?? 1);
    if (em < 1) continue;
    sources.push([b, em]);
  }
  for (const [b, em] of sources) {
    const s = clamp(em / 380, 0, 1.6);
    dist.fill(-1);
    let qh = 0, qt = 0;
    for (let yy = b.y - 1; yy <= b.y + b.h; yy++) for (let xx = b.x - 1; xx <= b.x + b.w; xx++) {
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const j = yy * W + xx;
      if (terr[j] === T.WATER && dist[j] < 0) { dist[j] = 0; q[qt++] = j; }
    }
    while (qh < qt) {
      const j = q[qh++];
      const dj = dist[j];
      pol[j] += s * Math.exp(-dj / POL_RADIUS);
      if (dj >= POL_RADIUS * 3) continue;
      const x = j % W, y = (j / W) | 0;
      if (x > 0 && terr[j - 1] === T.WATER && dist[j - 1] < 0) { dist[j - 1] = dj + 1; q[qt++] = j - 1; }
      if (x < W - 1 && terr[j + 1] === T.WATER && dist[j + 1] < 0) { dist[j + 1] = dj + 1; q[qt++] = j + 1; }
      if (y > 0 && terr[j - W] === T.WATER && dist[j - W] < 0) { dist[j - W] = dj + 1; q[qt++] = j - W; }
      if (y < H - 1 && terr[j + W] === T.WATER && dist[j + W] < 0) { dist[j + W] = dj + 1; q[qt++] = j + W; }
    }
  }
  for (let j = 0; j < N; j++) { if (pol[j] > 1) pol[j] = 1; if (pol[j] > maxPol) maxPol = pol[j]; }
  // Trinkwasser: Pumpwerke am verschmutzten Wasser
  const nc = g.compCount;
  const cont = new Float32Array(nc + 1), tot = new Float32Array(nc + 1);
  for (const b of g.buildings.values()) {
    const d = def(b);
    if (!d || !d.water || !working(b) || b.comp < 0) continue;
    let p = 0;
    if (d.needsWater) {
      for (let yy = b.y - 1; yy <= b.y + b.h; yy++) for (let xx = b.x - 1; xx <= b.x + b.w; xx++) {
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        p = Math.max(p, pol[yy * W + xx]);
      }
    }
    b.cz ||= newCz(false);
    b.cz.intake = p;
    cont[b.comp] += d.water * p;
    tot[b.comp] += d.water;
  }
  const contam = new Float32Array(nc + 1);
  for (let c = 0; c < nc; c++) contam[c] = tot[c] > 0 ? cont[c] / tot[c] : 0;
  C.contam = contam;
  C.waterPolMax = maxPol;
  // Bodenwert am verschmutzten Ufer
  const lv = C.lvWater || (C.lvWater = new Float32Array(N));
  lv.fill(0);
  if (maxPol > 0.01) {
    for (let j = 0; j < N; j++) {
      const p = pol[j];
      if (p < 0.03) continue;
      const x = j % W, y = (j / W) | 0;
      for (let oy = -3; oy <= 3; oy++) for (let ox = -3; ox <= 3; ox++) {
        const nx = x + ox, ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const t = ny * W + nx;
        if (terr[t] === T.WATER) continue;
        const v = -p * 15 * (1 - Math.hypot(ox, oy) / 4.5);
        if (v < lv[t]) lv[t] = v;
      }
    }
  }
  C.polVersion = (C.polVersion || 0) + 1;
  C.polDirty = false;
}

// Fernwärme: Bei Kälte brauchen Gebäude Wärme. Stündlich.
function heatHourly(g, C) {
  const w = g.ext.weather;
  const temp = w && typeof w.temp === 'number' ? w.temp : 15;
  const hd = clamp((10 - temp) / 18, 0, 1);
  C.temp = temp; C.hd = hd;
  let coldN = 0;
  if (hd <= 0) {
    for (const b of g.buildings.values()) if (b.cz) { b.cz.heat = true; b.cz.cold = 0; }
    C.heatSupply = 0; C.heatDemand = 0; C.coldBuildings = 0;
    return;
  }
  const nc = g.compCount;
  const sup = new Float32Array(nc + 1), dem = new Float32Array(nc + 1);
  let ts = 0, td = 0;
  const use = (b) => {
    if (!b.zone || !working(b) || b.construct < 1) return 0;
    const occF = b.cap ? 0.35 + 0.65 * (b.occ / b.cap) : 1;
    return LEVELS[b.zone].power[b.level] * occF * 1.2 * hd * (b.zone === Z.IND ? 0.5 : 1);
  };
  for (const b of g.buildings.values()) {
    if (b.comp < 0) continue;
    const d = def(b);
    if (d && d.heat && working(b)) sup[b.comp] += d.heat * budget(g, d);
    const u = use(b);
    czOf(b).heatUse = u;
    dem[b.comp] += u;
  }
  for (let c = 0; c < nc; c++) { ts += sup[c]; td += dem[c]; }
  for (const b of g.buildings.values()) {
    const cz = b.cz;
    if (!cz || !b.zone) continue;
    const r = b.comp < 0 || dem[b.comp] <= 0 ? 0 : Math.min(1, sup[b.comp] / dem[b.comp]);
    cz.heat = r >= 0.999 || hash2(b.id, 23) < r;
    // Kleine Häuser heizen mit eigenen Öfen; ab Stufe 3 braucht es Fernwärme
    cz.heatNeed = b.level >= HEAT_LEVEL;
    cz.cold = cz.heat || !cz.heatNeed ? 0 : hd;
    if (cz.cold && b.construct >= 1 && !b.abandoned) coldN++;
  }
  C.heatSupply = ts; C.heatDemand = td; C.coldBuildings = coldN;
}

// Gefängnis senkt die Kriminalität (nach der Glücksberechnung der Kernsimulation)
function prisonHourly(g, C, F) {
  let criminals = 0;
  for (const b of g.buildings.values()) if (b.zone && !b.abandoned) criminals += (b.crime || 0) * b.occ * 0.03;
  let cap = 0, red = 0;
  for (const f of F.prison) {
    const d = BUILDINGS[f.key];
    const c = (d.inmates || 500) * budget(g, d) * (f.powered ? 1 : 0.6);
    cap += c;
    red += d.crimeCity;
  }
  if (criminals > 0 && cap < criminals) red *= cap / criminals;
  red = Math.min(0.45, red);
  C.prison = { cap, criminals, inmates: Math.min(cap, criminals), red };
  if (red > 0) for (const b of g.buildings.values()) if (b.zone && b.crime) b.crime *= 1 - red;
}

// ---------- Fahrzeuge
function pieceLen(p, k) {
  const n = p.length - 1;
  if (k === 0 || k === n) return 0.5;
  return p[k] - p[k - 1] === p[k + 1] - p[k] ? 1 : 0.785;
}
function scheduleTrip(g, C, kind, from, to, t0, speed, ret) {
  if (from < 0 || to < 0 || from === to) return;
  const max = kind === 'hearse' ? MAX_HEARSES : MAX_AMBULANCES;
  let n = 0;
  for (const v of C.vehicles) if (v.kind === kind) n++;
  if (n >= max) return;
  const res = findPath(g, from, to);
  if (!res || res.path.length < 2) return;
  C.vehicles.push(makeVehicle(kind, res.path, t0, speed, ret));
}
function makeVehicle(kind, path, t0, speed, ret) {
  const lens = new Float32Array(path.length + 1);
  for (let k = 0; k < path.length; k++) lens[k + 1] = lens[k] + pieceLen(path, k);
  return { kind, path, lens, total: lens[path.length], t0, speed, ret };
}
function poseAt(g, v, s, out) {
  const p = v.path, n = p.length - 1, W = g.W;
  let k = 0;
  while (k < n && v.lens[k + 1] <= s) k++;
  const len = v.lens[k + 1] - v.lens[k];
  const t = clamp((s - v.lens[k]) / (len || 1), 0, 1);
  const cx = (i) => p[i] % W, cy = (i) => (p[i] / W) | 0;
  let x, y, tx, ty;
  if (n === 0) { x = cx(0); y = cy(0); tx = 1; ty = 0; }
  else if (k === 0) {
    const ax = cx(0), ay = cy(0), bx = (cx(0) + cx(1)) / 2, by = (cy(0) + cy(1)) / 2;
    x = ax + (bx - ax) * t; y = ay + (by - ay) * t; tx = bx - ax; ty = by - ay;
  } else if (k === n) {
    const ax = (cx(n - 1) + cx(n)) / 2, ay = (cy(n - 1) + cy(n)) / 2, bx = cx(n), by = cy(n);
    x = ax + (bx - ax) * t; y = ay + (by - ay) * t; tx = bx - ax; ty = by - ay;
  } else {
    const Ax = (cx(k - 1) + cx(k)) / 2, Ay = (cy(k - 1) + cy(k)) / 2, Bx = cx(k), By = cy(k);
    const Cx = (cx(k) + cx(k + 1)) / 2, Cy = (cy(k) + cy(k + 1)) / 2;
    const u = 1 - t;
    x = u * u * Ax + 2 * u * t * Bx + t * t * Cx; y = u * u * Ay + 2 * u * t * By + t * t * Cy;
    tx = 2 * u * (Bx - Ax) + 2 * t * (Cx - Bx); ty = 2 * u * (By - Ay) + 2 * t * (Cy - By);
  }
  const l = Math.hypot(tx, ty) || 1;
  tx /= l; ty /= l;
  const tile = p[k];
  const road = g.road[tile];
  const off = road === R.HIGHWAY ? 0.26 : road === R.AVENUE ? 0.24 : road === R.LANE ? 0.12 : 0.16;
  out.x = x + 0.5 - g.W / 2 - ty * off;
  out.z = y + 0.5 - g.H / 2 + tx * off;
  out.y = g.world.terrain[tile] === T.WATER ? 0.24 : 0.012;
  out.yaw = Math.atan2(tx, ty);
  return out;
}

// ---------- Kennzahlen
function lifeExpectancy(mm) {
  let S = 1, L = 0;
  for (let k = 0; k < BINS; k++) {
    const q = 1 - Math.exp(-5 * Math.min(0.9, MORT[k] * mm));
    const Sn = S * (1 - q);
    L += 2.5 * (S + Sn);
    S = Sn;
  }
  return L;
}

function computeStats(g, C, res, ctx) {
  const ages = new Array(BINS).fill(0);
  const edu = [0, 0, 0, 0];
  let sick = 0, bodies = 0, deadB = 0, maxDD = 0, pop = 0;
  for (const b of res) {
    const a = b.cz.a;
    for (let k = 0; k < BINS; k++) ages[k] += a[k];
    for (let l = 0; l < 4; l++) edu[l] += a[E4 + l] + a[EA + l];
    sick += b.cz.sick * b.occ;
    pop += b.occ;
    if (b.cz.dead >= 1) { bodies += b.cz.dead; deadB++; maxDD = Math.max(maxDD, b.cz.deadDays); }
  }
  const tot = ages.reduce((x, y) => x + y, 0) || 1;
  const groups = AGE_GROUPS.map((gr) => { let s = 0; for (let k = gr.from; k <= gr.to; k++) s += ages[k]; return s; });
  let ageSum = 0; for (let k = 0; k < BINS; k++) ageSum += ages[k] * (k * 5 + 2.5);
  const eduN = edu.reduce((x, y) => x + y, 0) || 1;
  // Erwerbspersonen: 20–64 (ohne Studierende) und die Hälfte der 15–19-Jährigen, ohne Kranke
  let students = 0; for (const b of res) students += (b.cz.a[E4 + 2] + b.cz.a[E4 + 3]) * b.cz.uq * 0.8;
  const work = (sumRange(ages, 4, 12) - students + ages[3] * 0.5) * (1 - (pop > 0 ? sick / pop : 0) * 0.6);
  const graves = { used: 0, cap: 0 };
  let cremated = 0;
  const cems = [];
  for (const b of g.buildings.values()) {
    if (b.zone || !b.cz) continue;
    const d = BUILDINGS[b.key];
    if (!d || !d.service || d.service.type !== 'deathcare') continue;
    if (d.graves) { graves.used += b.cz.used || 0; graves.cap += b.cz.graveCap || d.graves; }
    cremated += b.cz.cremated || 0;
    cems.push(b.id);
  }
  // Durchschnitt der Zuzugs-Bildung ist nicht relevant – Kennzahlen der Wohnbevölkerung:
  let contamW = 0;
  if (C.contam) for (const b of res) contamW += (C.contam[b.comp] || 0) * b.occ;
  const S = {
    pop, ages, groups, avgAge: ageSum / tot,
    kidsShare: groups[0] / tot, youthShare: groups[1] / tot, adultShare: groups[2] / tot, seniorShare: groups[3] / tot,
    edu, eduShares: edu.map((v) => v / eduN), uniShare: edu[3] / eduN, eduIndex: (edu[1] * EDU_W[1] + edu[2] * EDU_W[2] + edu[3] * EDU_W[3]) / eduN,
    birthsToday: ctx.births, deathsToday: ctx.deaths, moveIn: ctx.moveIn, moveOut: ctx.moveOut,
    graduates: ctx.graduates.map((v) => Math.round(v)),
    deathsByGroup: AGE_GROUPS.map((gr) => { let s = 0; for (let k = gr.from; k <= gr.to; k++) s += ctx.deathsByBin[k]; return s; }),
    lifeExp: lifeExpectancy(ctx.mmW > 0 ? ctx.mmSum / ctx.mmW : 1),
    sick: Math.round(sick), sickShare: pop > 0 ? sick / pop : 0,
    bodies, deadBuildings: deadB, maxDeadDays: maxDD,
    collected: C.collectedToday || 0, umland: C.umlandToday || 0, umlandCost: C.umlandCost || 0,
    graves, graveFill: graves.cap > 0 ? graves.used / graves.cap : 0, cremated, deathcareCount: cems.length,
    unsewered: C.unsewered || 0, sewageCap: C.sewageCap || 0, sewageDemand: C.sewageDemand || 0, sewageRequired: !!C.sewReq,
    contam: pop > 0 ? contamW / pop : 0, waterPolMax: C.waterPolMax || 0,
    temp: C.temp ?? 15, hd: C.hd || 0, heatSupply: C.heatSupply || 0, heatDemand: C.heatDemand || 0, cold: C.coldBuildings || 0,
    stage: C.stage || {}, care: C.careStat || { cap: 0, demand: 0 }, prison: C.prison || { cap: 0, criminals: 0, inmates: 0, red: 0 },
    schoolFill: C.stage && C.stage.school.seats > 0 ? C.stage.school.pupils / C.stage.school.seats : 0,
    kitaFill: C.stage && C.stage.kita.seats > 0 ? C.stage.kita.pupils / C.stage.kita.seats : 0,
    workforce: work, laborRatio: pop > 50 ? work / (pop * 0.62) : 1,
    ambulances: C.ambToday || 0,
    beds: C.beds || { beds: 0, severe: 0, q: 1 },
    centenarians: ctx.centenarians || 0,
    sewBlocked: C.sewBlocked || 0,
    rates: [0, 2, 4].map((k) => (ctx.rates[k + 1] > 1e-6 ? ctx.rates[k] / ctx.rates[k + 1] : 0)),
  };
  C.stats = S;
  C.hist.push({ d: g.day(), pop: Math.round(pop), b: ctx.births, dth: ctx.deaths, sick: Math.round(sick), age: +S.avgAge.toFixed(1), edu: Math.round(S.eduIndex * 100), dead: bodies, le: Math.round(S.lifeExp) });
  if (C.hist.length > 240) C.hist.shift();
}

// ---------- Stadtfunk
function say(g, C, key, days, text, mood = 'bad', where = null) {
  const now = g.day();
  if ((C.cool[key] ?? -1e9) > now) return;
  C.cool[key] = now + days;
  g.news(key, text, mood, where);
}
function newsDaily(g, C, rnd) {
  const S = C.stats;
  if (!S || S.pop < 30) return;
  // Woche aufsummieren
  const w = C.week || (C.week = { b: 0, d: 0, gr: 0, c: 0 });
  w.b += S.birthsToday; w.d += S.deathsToday; w.gr += S.graduates[1] + S.graduates[2] + S.graduates[3]; w.c += S.centenarians;
  if (S.centenarians >= 0.6 && rnd() < 0.5) {
    const n = pick(rnd, ['Gertrud', 'Heinz', 'Ursula', 'Klaus', 'Helga', 'Werner', 'Erika', 'Hannelore']);
    g.pushNews({ kind: 'chatter', author: citizenName(rnd), text: pick(rnd, [`Unsere Nachbarin ${n} ist heute 100 geworden! Die ganze Straße hat gesungen.`, `${n} aus dem dritten Stock feiert den 100. Geburtstag. Der Bürgermeister hat gratuliert!`]), mood: 'info' });
  }
  const fmt = (n) => Math.round(n).toLocaleString('de-DE');
  if (S.bodies >= 1 && S.deathcareCount === 0 && g.isUnlocked('cemetery')) say(g, C, 'dc0', 6, `${fmt(S.bodies)} Verstorbene warten auf ihre Bestattung – die Stadt braucht einen Friedhof.`);
  else if (S.bodies > 10) say(g, C, 'dc1', 4, `Leichenwagen-Stau: ${fmt(S.bodies)} Verstorbene warten auf ihre Bestattung. Mehr Friedhöfe oder ein Krematorium!`);
  if (S.graveFill > 0.9) say(g, C, 'dc2', 6, `Die Friedhöfe sind zu ${Math.round(S.graveFill * 100)} % belegt. Ein Krematorium braucht keine Gräber.`, 'bad');
  if (S.sewageRequired && S.unsewered > Math.max(3, g.stats.countByZone.reduce((a, b) => a + b, 0) * 0.05)) say(g, C, 'sw1', 4, `Das Kanalnetz ist überlastet – ${fmt(S.unsewered)} Gebäude ohne Abwasserentsorgung.`);
  if (S.sewBlocked >= 3) say(g, C, 'sw3', 10, `${fmt(S.sewBlocked)} Häuser könnten zu Stufe ${SEWAGE_LEVEL} wachsen – es fehlt nur der Kanalanschluss.`, 'info');
  if (S.contam > 0.12) say(g, C, 'sw2', 5, 'Ein Pumpwerk fördert verschmutztes Wasser! Den Abwasserauslass weit weg vom Pumpwerk setzen (gut 20 Felder Wasserweg) oder eine Kläranlage bauen.');
  if (S.schoolFill > 1.15 && S.stage.school) say(g, C, 'ed1', 7, `Die Schulen sind überfüllt: ${fmt(S.stage.school.pupils)} Kinder, ${fmt(S.stage.school.seats)} Plätze.`, 'bad');
  if (S.kitaFill > 1.3 && S.stage.kita && S.stage.kita.pupils > 40) say(g, C, 'ed2', 8, `Kita-Plätze fehlen: ${fmt(S.stage.kita.pupils)} Kleinkinder, ${fmt(S.stage.kita.seats)} Plätze.`, 'info');
  if (S.sickShare > 0.1 && S.pop > 300) say(g, C, 'hl1', 5, `${Math.round(S.sickShare * 100)} % der Menschen sind krank. Mehr Arztpraxen und Krankenhäuser helfen.`);
  if (S.cold > 10) say(g, C, 'ht1', 4, `Frost bei ${Math.round(S.temp)} °C: ${fmt(S.cold)} Gebäude frieren ohne Fernwärme.`);
  if (S.birthsToday > Math.max(12, S.pop * 0.02)) say(g, C, 'bb', 10, `Babyboom! Heute wurden ${fmt(S.birthsToday)} Kinder geboren.`, 'good');
  if (S.graduates[3] >= 1 && !C.flags.uni) { C.flags.uni = true; g.news('edu', 'Die ersten Absolventinnen und Absolventen der Universität feiern ihren Abschluss!', 'good'); }
  if (S.graduates[2] >= 1 && !C.flags.abi) { C.flags.abi = true; g.news('edu', 'Der erste Abiturjahrgang der Stadt wirft die Hüte in die Luft.', 'good'); }
  if (S.deathsToday > 0 && rnd() < 0.08) {
    const name = citizenName(rnd);
    const texts = S.care.cap > 0
      ? [`Oma ist mit 94 friedlich eingeschlafen. Danke an das Seniorenheim für die liebevolle Pflege.`, `Heute haben wir Opa beerdigt. Der Friedhof ist wunderschön gelegen.`]
      : [`Mein Nachbar ist gestorben. Er hat jeden Morgen die Tauben gefüttert.`, `Trauer in der Straße – die alte Frau Weber ist gestorben.`];
    g.pushNews({ kind: 'chatter', author: name, text: pick(rnd, texts), mood: 'info' });
  }
}

// ---------- System
function state(g) { return g.ext.citizens; }

registerSystem({
  id: 'citizens',
  init(g) {
    g.ext.citizens = {
      stats: null, hist: [], vehicles: [], cool: {}, flags: {}, sewReq: false,
      waterPol: new Float32Array(g.N), lvWater: new Float32Array(g.N), lvSew: new Float32Array(g.N),
      contam: null, polVersion: 0, polDirty: true, umlandCost: 0, offBoost: 0,
      rng: mulberry32(((g.opts.seed || 1) * 2654435761) ^ 0x51ed27),
    };
  },
  hourly(g, h) {
    const C = state(g);
    const F = collectFacilities(g);
    sewageHourly(g, C);
    heatHourly(g, C);
    prisonHourly(g, C, F);
    if (C.polDirty && h % 2 === 1) waterPollution(g, C);
    let ob = 0;
    for (const f of F.research) if (f.powered) ob += BUILDINGS[f.key].offBoost * 0.5;
    C.offBoost = ob;
  },
  weekly(g) {
    const C = state(g);
    const w = C.week;
    if (!w || g.stats.pop < 50) return;
    const S = C.stats || {};
    const parts = [`${w.b.toLocaleString('de-DE')} Geburten`, `${w.d.toLocaleString('de-DE')} Sterbefälle`];
    if (w.gr >= 1) parts.push(`${Math.round(w.gr).toLocaleString('de-DE')} Abschlüsse`);
    let tail = '';
    if (S.bodies >= 1) tail = ` ${S.bodies} Verstorbene warten noch auf ihre Bestattung.`;
    else if (S.sickShare > 0.08) tail = ` Der Krankenstand liegt bei ${Math.round(S.sickShare * 100)} %.`;
    g.news('report', `Bevölkerung diese Woche: ${parts.join(', ')}. Durchschnittsalter ${Math.round(S.avgAge || 0)} Jahre.${tail}`, w.b >= w.d ? 'good' : 'info');
    C.week = { b: 0, d: 0, gr: 0, c: 0 };
  },
  daily(g) {
    const C = state(g);
    const rnd = C.rng;
    const F = collectFacilities(g);
    const res = [];
    for (const b of g.buildings.values()) {
      if (b.zone !== Z.RES) continue;
      const cz = czOf(b);
      if (b.abandoned) { cz.dead = 0; cz.deadDays = 0; cz.a.fill(0); cz.dAcc = cz.bAcc = 0; continue; }
      if (b.construct < 1 && b.occ <= 0) continue;
      res.push(b);
    }
    coverageDaily(g, C, F, res);
    // Krankenhausbetten: schwere Fälle (3 % der Kranken) gegen Betten aller Gesundheitseinrichtungen
    let beds = 0, sickNow = 0;
    for (const f of F.health) beds += bedsOf(f) * budget(g, BUILDINGS[f.key]) * (f.powered ? 1 : 0.4);
    for (const b of res) sickNow += b.cz.sick * b.occ;
    const severe = sickNow * 0.03;
    C.beds = { beds, severe, q: severe > 0 ? Math.min(1, beds / severe) : 1 };
    const ctx = {
      dk: new Float32Array(BINS), flow: new Float32Array(BINS), deathsByBin: new Float32Array(BINS),
      deaths: 0, births: 0, moveIn: 0, moveOut: 0, mmSum: 0, mmW: 0, graduates: [0, 0, 0, 0], centenarians: 0, rates: [0, 0, 0, 0, 0, 0],
      flu: Math.max(0, -g.eff('healthCov')) * 0.12 + (g.ext.weather && g.ext.weather.season === 'winter' ? 0.008 : 0),
      heat: g.ext.weather && typeof g.ext.weather.temp === 'number' && g.ext.weather.temp > 30 ? 1.15 + Math.min(0.25, (g.ext.weather.temp - 30) * 0.04) : 1,
      blocked: 0,
      eduBoost: Math.sqrt(g.mods.edu || 1) * (g.policies.has('education') ? 1.15 : 1) * (g.policies.has('fullday') ? 1.15 : 1) * (1 + (g.stats.eduCity || 0)),
      study: g.mods.czStudy || 1,
      bedQ: C.beds.q,
    };
    for (const b of res) {
      const cz = b.cz;
      stepPeople(g, C, b, cz, rnd, ctx);
      cz.noSew = cz.sew || !cz.sewNeed ? 0 : cz.noSew + 1;
      // Ohne Kanalanschluss wächst ein Haus nicht über die Sickergrube hinaus (Stufe 2 → 3 gesperrt)
      if (b.level === SEWAGE_LEVEL - 1 && !cz.sew && C.sewReq) {
        b.upCount = 0;
        if (b.powered && b.watered && b.happy >= 45 && b.occ >= b.cap * 0.7 && g.fields.landValue[b.y * g.W + b.x] >= LEVELS[Z.RES].need[SEWAGE_LEVEL] && g.maxLevelAt(b.x, b.y) >= SEWAGE_LEVEL) ctx.blocked++;
      }
      // Wegzug bei unbestatteten Toten oder fehlendem Abwasser
      let leave = 0;
      if (cz.deadDays >= 5) leave = Math.max(leave, 0.04);
      if (cz.noSew >= 10) leave = Math.max(leave, 0.02);
      if (leave > 0 && b.occ > 0) {
        const n = Math.min(b.occ, Math.ceil(b.occ * leave));
        removePeople(cz, n);
        b.occ -= n;
        ctx.moveOut += n;
      }
    }
    deathcareDaily(g, C, F, res, rnd);
    // Rettungswagen
    let serious = 0;
    for (const b of res) serious += b.occ * b.cz.sick * 0.02;
    C.ambToday = Math.round(serious);
    const nAmb = Math.min(MAX_AMBULANCES, Math.round(serious));
    if (nAmb > 0 && F.health.length) {
      const sickList = res.filter((b) => b.cz.sick * b.occ >= 0.5);
      for (let k = 0; k < nAmb && sickList.length; k++) {
        const b = sickList[Math.floor(rnd() * sickList.length)];
        const [x, y] = center(b);
        const n = nearest(F.health, x, y, () => 1e9, b.comp);
        if (n) scheduleTrip(g, C, 'ambulance', n[0].access, b.access, g.time + rnd() * 1100, AMB_SPEED, true);
      }
    }
    if (C.polDirty || g.day() % 3 === 0) waterPollution(g, C);
    C.sewBlocked = ctx.blocked;
    computeStats(g, C, res, ctx);
    newsDaily(g, C, rnd);
  },
  renderables(g) {
    const C = state(g);
    if (!C || !C.vehicles.length) return null;
    const out = C._out || (C._out = []);
    out.length = 0;
    const now = g.time;
    let w = 0;
    for (let k = 0; k < C.vehicles.length; k++) {
      let v = C.vehicles[k];
      let keep = true;
      if (now >= v.t0) {
        const s = (now - v.t0) * v.speed;
        if (s >= v.total) {
          if (v.ret) {
            // kurz halten, dann zurück zur Wache bzw. zum Friedhof
            const back = makeVehicle(v.kind, Int32Array.from(v.path).reverse(), now + 40, v.speed, false);
            back._o = v._o;
            v = back;
          } else keep = false;
        } else {
          const o = v._o || (v._o = { kind: v.kind, x: 0, y: 0, z: 0, yaw: 0, lights: true });
          poseAt(g, v, s, o);
          // Straße abgerissen? Dann verschwindet das Fahrzeug
          if (!g.road[v.path[Math.min(v.path.length - 1, Math.floor(s))]] && !g.road[v.path[v.path.length - 1]]) keep = false;
          else out.push(o);
        }
      }
      if (keep) C.vehicles[w++] = v;
    }
    C.vehicles.length = w;
    return out;
  },
  serialize(g) {
    const C = state(g);
    const ids = [], vals = [];
    const LEN2 = LEN + 6;
    for (const b of g.buildings.values()) {
      if (!b.cz) continue;
      const cz = b.cz;
      if (b.zone === Z.RES && cz.a) {
        ids.push(b.id);
        for (let k = 0; k < LEN; k++) vals.push(Math.min(65535, Math.round(cz.a[k] * 10)));
        vals.push(Math.round(cz.sick * 1000), Math.min(65535, cz.dead), Math.min(255, cz.deadDays), Math.min(255, cz.noSew), Math.round(cz.dAcc * 1000), Math.round(cz.bAcc * 1000));
      }
    }
    const fac = [];
    for (const b of g.buildings.values()) {
      if (b.zone || !b.cz) continue;
      const cz = b.cz;
      if (cz.ring || cz.extraGraves || cz.cremated) fac.push([b.id, Math.round(cz.used || 0), cz.ring || [], cz.extraGraves || 0, cz.cremated || 0]);
    }
    return {
      v: 1, n: LEN2, ids: typedToB64(Int32Array.from(ids)), vals: typedToB64(Uint16Array.from(vals)), fac,
      hist: C.hist.slice(-120), flags: C.flags, sewReq: C.sewReq, umlandCost: Math.round(C.umlandCost || 0),
    };
  },
  load(g, d) {
    const C = state(g);
    if (!d || d.v !== 1) return;
    try {
      const ids = b64ToTyped(d.ids, Int32Array);
      const vals = b64ToTyped(d.vals, Uint16Array);
      const n = d.n || LEN + 6;
      for (let k = 0; k < ids.length; k++) {
        const b = g.buildings.get(ids[k]);
        if (!b || b.zone !== Z.RES) continue;
        const cz = czOf(b);
        const o = k * n;
        for (let j = 0; j < LEN; j++) cz.a[j] = vals[o + j] / 10;
        cz.sick = vals[o + LEN] / 1000; cz.dead = vals[o + LEN + 1]; cz.deadDays = vals[o + LEN + 2]; cz.noSew = vals[o + LEN + 3];
        cz.dAcc = (vals[o + LEN + 4] || 0) / 1000; cz.bAcc = (vals[o + LEN + 5] || 0) / 1000;
        // Rundungsfehler: Kohorten an die Belegung angleichen
        let tot = 0; for (let j = 0; j < BINS; j++) tot += cz.a[j];
        const target = b.occ - cz.dAcc + cz.bAcc;
        if (tot > 0 && target > 0) { const f = target / tot; for (let j = 0; j < LEN; j++) cz.a[j] *= f; }
      }
    } catch (e) { /* alter oder beschädigter Spielstand – Kohorten werden neu aufgebaut */ }
    for (const [id, used, ring, extra, crem] of d.fac || []) {
      const b = g.buildings.get(id);
      if (!b) continue;
      const cz = czOf(b);
      cz.used = used; cz.ring = ring.length === REST_DAYS ? ring : new Array(REST_DAYS).fill(0); cz.extraGraves = extra; cz.cremated = crem;
    }
    C.hist = d.hist || [];
    C.flags = d.flags || {};
    C.sewReq = !!d.sewReq;
    C.umlandCost = d.umlandCost || 0; // sonst fehlt „Bestattung im Umland" bis zum nächsten Tag im Haushalt
    C.polDirty = true;
  },
});

// ---------- Wirkungen auf die Kernsimulation
const sewOn = (g) => g.ext && g.ext.citizens && g.ext.citizens.sewReq;
HAPPINESS_FACTORS.push((g, b) => {
  const cz = b.cz;
  if (!cz || cz.sew || !cz.sewNeed || !sewOn(g)) return null;
  return ['Kein Abwasseranschluss', b.zone === Z.RES ? -(3 + 0.7 * Math.min(6, cz.noSew)) : -(2 + 0.5 * Math.min(4, cz.noSew))];
});
HAPPINESS_FACTORS.push((g, b) => {
  const cz = b.cz;
  if (!cz || cz.dead < 1 || cz.deadDays < 1) return null;
  return ['Unbestattete Verstorbene', -(3 + 1.5 * Math.min(6, cz.deadDays))];
});
HAPPINESS_FACTORS.push((g, b) => {
  const cz = b.cz;
  if (!cz || b.zone !== Z.RES || cz.sick < 0.04) return null;
  return ['Krankheit', -(cz.sick - 0.02) * 28];
});
HAPPINESS_FACTORS.push((g, b) => {
  const C = g.ext && g.ext.citizens;
  if (!C || !C.contam || b.comp < 0) return null;
  const c = C.contam[b.comp] || 0;
  if (c < 0.03) return null;
  return ['Verschmutztes Trinkwasser', -c * (b.zone === Z.RES ? 18 : 6)];
});
HAPPINESS_FACTORS.push((g, b) => {
  const C = g.ext && g.ext.citizens, cz = b.cz;
  if (!C || !C.hd || !cz) return null;
  if (cz.heat) return ['Fernwärme', C.hd * 3];
  if (!cz.heatNeed) return null;
  return ['Kalte Wohnung', -C.hd * (b.zone === Z.RES ? 8 : 4)];
});
HAPPINESS_FACTORS.push((g, b) => {
  const cz = b.cz;
  if (!cz || !cz.a || b.zone !== Z.RES || b.occ <= 0) return null;
  const a = cz.a;
  let tot = 0; for (let k = 0; k < BINS; k++) tot += a[k];
  if (tot <= 0) return null;
  const small = (a[0] + a[1] * 0.5) / tot;
  const v = small * cz.kq * 30;
  return v >= 0.5 ? ['Kinderbetreuung', Math.min(4, v)] : null;
});
HAPPINESS_FACTORS.push((g, b) => {
  const cz = b.cz;
  if (!cz || !cz.a || b.zone !== Z.RES || b.occ <= 0) return null;
  const a = cz.a;
  let tot = 0; for (let k = 0; k < BINS; k++) tot += a[k];
  if (tot <= 0) return null;
  const old = sumRange(a, 15, 19) / tot;
  if (old < 0.04) return null;
  const v = cz.care > 0.2 ? old * cz.care * 25 : -Math.max(0, old - 0.08) * 30;
  return Math.abs(v) >= 0.5 ? ['Seniorenbetreuung', clamp(v, -4, 5)] : null;
});
HAPPINESS_FACTORS.push((g, b) => {
  const C = g.ext && g.ext.citizens;
  if (!C || !C.prison || !C.prison.red || !b.crime) return null;
  const v = b.crime * 12 * C.prison.red;
  return v >= 0.5 ? ['Strafvollzug', v] : null;
});
HAPPINESS_FACTORS.push((g, b) => (b.zone === Z.RES && g.policies.has('familybonus') ? ['Familiengeld', 2] : null));

LANDVALUE_TERMS.push((g, i) => {
  const C = g.ext && g.ext.citizens;
  if (!C) return 0;
  return (C.lvWater ? C.lvWater[i] : 0) + (C.lvSew ? C.lvSew[i] : 0);
});

DEMAND_MODIFIERS.push((g, d) => {
  const C = g.ext && g.ext.citizens;
  if (!C) return;
  if (C.stats && g.stats.pop > 200) {
    // Altersstruktur: fehlen Erwerbstätige, wachsen Firmen langsamer und die Stadt sucht Zuzug
    const dl = clamp((C.stats.laborRatio || 1) - 1, -0.4, 0.2);
    if (dl < 0) { d[2] += dl * 45; d[3] += dl * 45; d[4] += dl * 45; d[1] -= dl * 30; }
    else { d[2] += dl * 25; d[3] += dl * 25; d[4] += dl * 25; }
  }
  if (C.offBoost && g.isUnlocked('zone4')) d[4] += C.offBoost;
});

BUDGET_LINES.push({ id: 'czUmland', label: 'Bestattung im Umland', kind: 'expense', amount: (g) => (g.ext && g.ext.citizens ? g.ext.citizens.umlandCost || 0 : 0) });

// ---------- Schnittstelle für andere Systeme (z. B. Katastrophen, S4)
// Tötet n Bewohner eines Wohngebäudes (Ältere und Erwachsene etwas häufiger), sie warten dann auf Bestattung.
export function addCasualties(g, b, n) {
  if (!b || b.zone !== Z.RES || n <= 0) return 0;
  const cz = czOf(b);
  n = Math.min(Math.floor(n), b.occ);
  if (n <= 0) return 0;
  const a = cz.a;
  let tot = 0; for (let k = 0; k < BINS; k++) tot += a[k];
  if (tot > 0) {
    const f = Math.max(0, 1 - n / tot);
    for (let k = 0; k < LEN; k++) a[k] *= f;
  }
  b.occ -= n;
  cz.dead += n; cz.died += n;
  return n;
}

// ---------- Abfragen für Oberfläche und Ansichten
export function citizensOf(g) { return g.ext.citizens; }
export function buildingPeople(b) {
  const cz = b.cz;
  if (!cz || !cz.a) return null;
  const a = cz.a;
  const groups = groupCounts(a);
  const tot = groups.reduce((x, y) => x + y, 0);
  return { groups, tot, edu: eduOf(a), eduIndex: eduIndex(a), avgAge: avgAgeOf(a), sick: cz.sick, dead: cz.dead, deadDays: cz.deadDays, kq: cz.kq, sq: cz.sq, gq: cz.gq, uq: cz.uq, care: cz.care, born: cz.born, died: cz.died };
}
export { sumRange, tileOf };
