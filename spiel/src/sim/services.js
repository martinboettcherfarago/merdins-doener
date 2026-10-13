// Versorgung (Strom/Wasser über das Straßennetz), Abdeckung durch Dienste,
// Umweltfelder (Verschmutzung, Lärm, Kriminalität, Bodenwert) und Glück.
import { BUILDINGS, LEVELS, ROADS, R, T, Z, RES } from '../config.js';
import { clamp, hash2 } from '../util.js';
import { SERVICE_TYPES_EXTRA, HAPPINESS_FACTORS, LANDVALUE_TERMS, POWER_MODIFIERS, warnOnce } from '../registry.js';

export const SERVICE_TYPES = ['police', 'fire', 'health', 'garbage', 'edu'];
export const allServiceTypes = () => [...SERVICE_TYPES, ...SERVICE_TYPES_EXTRA];

export function bDef(b) { return b.zone ? null : BUILDINGS[b.key]; }

function occFactor(b) {
  if (!b.cap) return 1;
  return 0.35 + 0.65 * (b.occ / b.cap);
}

// Stromverbrauch eines Gebäudes; g.eff('powerUse') erhöht ihn (Heizen, Kühlen). `mul` = vorab berechneter Faktor.
export function powerUse(g, b, mul) {
  if (b.construct < 1 || b.abandoned) return 0;
  const m = mul === undefined ? Math.max(0, 1 + g.eff('powerUse')) : mul;
  if (b.zone) return LEVELS[b.zone].power[b.level] * occFactor(b) * m;
  return ((bDef(b) || {}).power_use || 0) * m;
}
export function waterUse(g, b, mul) {
  if (b.construct < 1 || b.abandoned) return 0;
  const heat = mul === undefined ? 1 + g.eff('waterUse') : mul;
  if (b.zone) return LEVELS[b.zone].water[b.level] * occFactor(b) * heat;
  return ((bDef(b) || {}).water_use || 0) * heat;
}
export function garbageLoad(g, b) {
  if (b.construct < 1 || b.abandoned || !b.zone) return 0;
  return LEVELS[b.zone].garbage[b.level] * occFactor(b) * (g.policies.has('recycling') ? 0.7 : 1);
}

// Strom und Wasser: Jede Straßenkomponente ist ein eigenes Netz.
export function computeUtilities(g) {
  const nc = g.compCount;
  const pSup = new Float32Array(nc + 1), pDem = new Float32Array(nc + 1);
  const wSup = new Float32Array(nc + 1), wDem = new Float32Array(nc + 1);
  const powerMul = g.mods.power * (1 + g.eff('powerMul'));
  const waterMul = g.mods.water;
  const useMul = Math.max(0, 1 + g.eff('powerUse'));
  const waterUseMul = 1 + g.eff('waterUse');
  for (const b of g.buildings.values()) {
    if (b.comp < 0) continue;
    if (!b.zone && b.construct >= 1 && !b.abandoned) {
      const d = bDef(b);
      if (d && d.power) {
        let p = d.power * powerMul;
        for (const fn of POWER_MODIFIERS) {
          try { const v = fn(g, b, p); if (Number.isFinite(v)) p = v; } catch (e) { warnOnce('POWER_MODIFIERS', e); }
        }
        pSup[b.comp] += Math.max(0, p);
      }
    }
    pDem[b.comp] += powerUse(g, b, useMul);
  }
  // Strom zuerst – Pumpen brauchen Strom
  let totalPS = 0, totalPD = 0;
  for (let c = 0; c < nc; c++) { totalPS += pSup[c]; totalPD += pDem[c]; }
  const pRatio = (c) => (pDem[c] <= 0 ? 1 : Math.min(1, pSup[c] / pDem[c]));
  for (const b of g.buildings.values()) {
    if (b.comp < 0) { b.powered = false; continue; }
    const r = pRatio(b.comp);
    b.powered = r >= 0.999 || hash2(b.id, 7) < r;
    if (!b.zone && b.construct >= 1 && !b.abandoned) {
      const d = bDef(b);
      if (d && d.water && b.powered) wSup[b.comp] += d.water * waterMul;
    }
    wDem[b.comp] += waterUse(g, b, waterUseMul);
  }
  let totalWS = 0, totalWD = 0;
  for (let c = 0; c < nc; c++) { totalWS += wSup[c]; totalWD += wDem[c]; }
  for (const b of g.buildings.values()) {
    if (b.comp < 0) { b.watered = false; continue; }
    const r = wDem[b.comp] <= 0 ? 1 : Math.min(1, wSup[b.comp] / wDem[b.comp]);
    b.watered = r >= 0.999 || hash2(b.id, 13) < r;
  }
  g.util = { powerSupply: totalPS, powerDemand: totalPD, waterSupply: totalWS, waterDemand: totalWD, pSup, pDem, wSup, wDem };
}

function forDisc(g, cx, cy, r, fn) {
  const { W, H } = g;
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= r) fn(y * W + x, d);
    }
  }
}
export { forDisc };

export function computeCoverage(g) {
  const { N } = g;
  const bestD = g._bestD || (g._bestD = new Float32Array(N));
  const bestF = g._bestF || (g._bestF = new Int32Array(N));
  // Ein Durchlauf über alle Gebäude: Zonengebäude und Dienste nach Art
  const zoneBlds = [];
  const byType = new Map();
  for (const b of g.buildings.values()) {
    if (b.zone) { if (!b.abandoned) zoneBlds.push(b); continue; }
    const d = bDef(b);
    if (!d || !d.service || b.construct < 1 || b.abandoned) continue;
    const list = byType.get(d.service.type);
    if (list) list.push(b); else byType.set(d.service.type, [b]);
  }

  for (const type of allServiceTypes()) {
    const cov = g.cov[type] || (g.cov[type] = new Float32Array(N));
    cov.fill(0);
    const facs = byType.get(type) || [];
    if (!facs.length) { const nr = g.nearestFac[type]; if (nr) nr.fill(0); continue; }
    bestD.fill(1e9);
    bestF.fill(-1);
    facs.forEach((f, fi) => {
      const s = bDef(f).service;
      forDisc(g, f.x + f.w / 2, f.y + f.h / 2, s.radius, (t, d) => {
        if (d < bestD[t]) { bestD[t] = d; bestF[t] = fi; }
      });
    });
    const demand = new Float32Array(facs.length);
    for (const b of zoneBlds) {
      const fi = bestF[b.y * g.W + b.x];
      if (fi < 0) continue;
      demand[fi] += type === 'garbage' ? garbageLoad(g, b) : b.occ;
    }
    const eff = facs.map((f, fi) => {
      const s = bDef(f).service;
      const capMul = type === 'garbage' ? 1 + g.eff('garbageCov') : type === 'health' ? 1 + g.eff('healthCov') : 1;
      const bud = g.serviceBudget[bDef(f).cat] ?? 1;
      let e = demand[fi] <= 0 ? 1 : Math.min(1, (s.capacity * capMul * bud) / demand[fi]);
      if (!f.powered) e *= 0.45;
      if (!f.connected) e *= 0.25;
      f.load = demand[fi] / s.capacity;
      return e;
    });
    const nearest = g.nearestFac[type];
    if (nearest) nearest.fill(0);
    if (type === 'edu') {
      // Bildung: bestes erreichbares Niveau (Schule, Bibliothek oder Universität)
      facs.forEach((f, fi) => {
        const s = bDef(f).service;
        forDisc(g, f.x + f.w / 2, f.y + f.h / 2, s.radius, (t, d) => {
          const v = clamp(eff[fi], 0, 1) * (1 - 0.45 * (d / s.radius) ** 2) * s.eduMax;
          if (v > cov[t]) cov[t] = v;
        });
      });
      continue;
    }
    for (let t = 0; t < N; t++) {
      const fi = bestF[t];
      if (fi < 0) continue;
      const f = facs[fi];
      const s = bDef(f).service;
      const r = s.radius;
      const fall = 1 - 0.45 * (bestD[t] / r) * (bestD[t] / r);
      let v = clamp(eff[fi], 0, 1) * fall;
      if (type === 'edu') v *= s.eduMax;
      cov[t] = v;
      if (nearest) nearest[t] = f.id;
    }
  }

  // Parks, Wahrzeichen und andere Flächeneffekte
  const { park, lvBonus, happyBonus, comBoost, resBoost } = g.cov;
  park.fill(0); lvBonus.fill(0); happyBonus.fill(0); comBoost.fill(0); resBoost.fill(0);
  let tourism = 0;
  for (const b of g.buildings.values()) {
    if (b.zone || b.construct < 1 || b.abandoned) continue;
    const d = bDef(b);
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    if (d.park) forDisc(g, cx, cy, d.parkRadius, (t, dist) => { park[t] = Math.min(1, park[t] + d.park * (1 - dist / (d.parkRadius + 0.5))); });
    if (d.lv) forDisc(g, cx, cy, d.lvRadius, (t, dist) => { lvBonus[t] += d.lv * (1 - dist / (d.lvRadius + 0.5)); });
    if (d.happy) {
      const rr = d.lvRadius || 8;
      forDisc(g, cx, cy, rr, (t, dist) => { happyBonus[t] += d.happy * (1 - 0.5 * dist / rr); });
    }
    if (d.comBoost) forDisc(g, cx, cy, d.lvRadius || 5, (t) => { comBoost[t] += d.comBoost; });
    if (d.resBoost) forDisc(g, cx, cy, d.parkRadius || 4, (t) => { resBoost[t] += d.resBoost; });
    if (d.tourism) tourism += d.tourism * (b.powered ? 1 : 0.5);
  }
  g.stats.tourism = tourism * (1 + g.eff('tourism') / 100) + g.eff('tourismAdd');
}

function boxBlur(src, dst, W, H, r, tmp) {
  // horizontal
  for (let y = 0; y < H; y++) {
    let acc = 0;
    const row = y * W;
    for (let x = -r; x <= r; x++) acc += src[row + clamp(x, 0, W - 1)];
    for (let x = 0; x < W; x++) {
      tmp[row + x] = acc / (2 * r + 1);
      acc += src[row + clamp(x + r + 1, 0, W - 1)] - src[row + clamp(x - r, 0, W - 1)];
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, H - 1) * W + x];
    for (let y = 0; y < H; y++) {
      dst[y * W + x] = acc / (2 * r + 1);
      acc += tmp[clamp(y + r + 1, 0, H - 1) * W + x] - tmp[clamp(y - r, 0, H - 1) * W + x];
    }
  }
}

export function computeFields(g) {
  const { W, H, N, road } = g;
  const em = g._em || (g._em = new Float32Array(N));
  const tmp = g._tmp || (g._tmp = new Float32Array(N));
  const tmp2 = g._tmp2 || (g._tmp2 = new Float32Array(N));
  const polMul = g.mods.pollution * (g.policies.has('cleanind') ? 0.6 : 1);

  // Verschmutzung
  em.fill(0);
  for (const b of g.buildings.values()) {
    if (b.construct < 1 || b.abandoned) continue;
    let p = 0;
    if (b.zone === Z.IND) {
      p = LEVELS[3].pollution[b.level] * occFactor(b) * polMul;
      if (b.spec === 'farm') p *= 0.15;
      else if (b.spec === 'mine') p *= 1.25;
    } else if (!b.zone) {
      const d = bDef(b);
      if (d.pollution) p = d.pollution * (d.cat === 'power' || d.cat === 'garbage' ? 1 : polMul);
    }
    if (!p) continue;
    const per = (p * 5) / (b.w * b.h);
    for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) em[yy * W + xx] += per;
  }
  for (let i = 0; i < N; i++) if (road[i]) em[i] += (road[i] === R.HIGHWAY ? 0.12 : 0) + g.congestion[i] * 0.12;
  boxBlur(em, tmp2, W, H, 3, tmp);
  boxBlur(tmp2, em, W, H, 2, tmp);
  const pol = g.fields.pollution;
  for (let i = 0; i < N; i++) pol[i] = clamp(em[i] * 1.5, 0, 1);

  // Lärm
  em.fill(0);
  const noiseMul = (g.policies.has('tempo30') ? 0.6 : 1) * (g.policies.has('nightquiet') ? 0.75 : 1);
  for (let i = 0; i < N; i++) {
    if (!road[i]) continue;
    em[i] += ROADS[road[i]].noise * (0.25 + Math.min(1.5, g.congestion[i])) * 0.9;
  }
  for (const b of g.buildings.values()) {
    if (b.construct < 1 || b.abandoned) continue;
    let n = 0;
    if (b.zone === Z.IND) n = 0.5 + b.level * 0.15;
    else if (b.zone === Z.COM) n = 0.15 + b.level * 0.05;
    else if (!b.zone) n = bDef(b).noise || 0;
    if (!n) continue;
    const per = (n * 2) / (b.w * b.h);
    for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) em[yy * W + xx] += per;
  }
  boxBlur(em, tmp2, W, H, 2, tmp);
  const noise = g.fields.noise;
  for (let i = 0; i < N; i++) noise[i] = clamp(tmp2[i] * 1.1 * noiseMul, 0, 1);

  // Kriminalität
  em.fill(0);
  for (const b of g.buildings.values()) if (b.zone && b.crime) em[b.y * W + b.x] = b.crime;
  boxBlur(em, tmp2, W, H, 2, tmp);
  const crime = g.fields.crime;
  for (let i = 0; i < N; i++) crime[i] = clamp(tmp2[i] * 1.6, 0, 1);

  // Bodenwert
  const lv = g.fields.landValue;
  const { park, police, health, edu, garbage, transit, lvBonus } = g.cov;
  const terr = g.world.terrain, wd = g.world.waterDist;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let v = 26;
      const d = wd[i];
      if (d > 0 && d <= 4) v += 11 * (1 - (d - 1) / 4);
      if (terr[i] === T.SAND) v += 3;
      v += park[i] * 26;
      v += ((police[i] + health[i]) * 0.5) * 12 + edu[i] * 8;
      v += transit[i] * 9;
      v += lvBonus[i];
      v -= pol[i] * 46 + noise[i] * 16 + crime[i] * 10;
      if (g.stats.pop > 300) v -= (1 - garbage[i]) * 5;
      // Alleen werten auf, Autobahn wertet ab
      let rb = 0;
      if (x > 0 && road[i - 1]) rb = Math.max(rb, ROADS[road[i - 1]].lv);
      if (x < W - 1 && road[i + 1]) rb = Math.max(rb, ROADS[road[i + 1]].lv);
      if (y > 0 && road[i - W]) rb = Math.max(rb, ROADS[road[i - W]].lv);
      if (y < H - 1 && road[i + W]) rb = Math.max(rb, ROADS[road[i + W]].lv);
      v += rb;
      for (const term of LANDVALUE_TERMS) v += term(g, i);
      lv[i] = clamp(v, 0, 100);
    }
  }
}

// Glücksfaktoren eines Gebäudes. Gibt den Zielwert zurück, schreibt optional die Gründe nach out.
// Stadtweite Werte für die Glücksberechnung (einmal pro Durchlauf statt pro Gebäude)
function happyCtx(g) {
  const P = g.policies;
  return {
    pop: g.stats.pop, unemp: g.stats.unemployment, jobFill: g.stats.jobFill, comDem: g.demand[2], ev: g.eff('happy'),
    tenants: P.has('tenants'), lowrise: P.has('lowrise'), bikes: P.has('bikes'), freetransit: P.has('freetransit'),
  };
}

export function happinessFactors(g, b, out, ctx) {
  const c = ctx || happyCtx(g);
  const i = b.y * g.W + b.x;
  const cov = g.cov, fld = g.fields;
  const f = out ? (label, v) => { if (Math.abs(v) >= 0.5) out.push([label, v]); return v; } : (label, v) => v;
  let h = 60;
  if (!b.connected) h += f('Keine Verbindung zur Autobahn', -22);
  h += f(b.powered ? 'Strom' : 'Kein Strom', b.powered ? 0 : -28);
  h += f(b.watered ? 'Wasser' : 'Kein Wasser', b.watered ? 0 : -24);
  if (c.pop > 250) h += f('Müllabfuhr', -(1 - cov.garbage[i]) * 9);
  if (c.pop > 300) h += f('Gesundheit', cov.health[i] * 11 - 5);
  if (c.pop > 300) h += f('Sicherheit', cov.police[i] * 6 - (b.crime || 0) * 12);
  if (b.zone === Z.RES) h += f('Bildungsangebot', cov.edu[i] * 6);
  h += f('Parks & Freizeit', cov.park[i] * 12);
  h += f('Bodenwert', (fld.landValue[i] - 35) * 0.14);
  h += f('Verschmutzung', -fld.pollution[i] * (b.zone === Z.IND ? 10 : 30));
  h += f('Lärm', -fld.noise[i] * (b.zone === Z.RES ? 13 : 5));
  const tax = g.taxes[b.zone];
  h += f('Steuern', -(tax - 10) * 1.7);
  if (b.zone === Z.RES) {
    h += f('Pendelzeit', -clamp((b.commute - 30) * 0.3, 0, 12));
    h += f('Arbeitslosigkeit', -c.unemp * 22);
    if (c.tenants) h += f('Mieterschutz', 5);
    if (c.lowrise) h += f('Hochhausverbot', 2);
    h += f('Spielplätze', Math.min(6, cov.resBoost[i]));
  } else {
    h += f('Arbeitskräfte', -(1 - c.jobFill) * 9);
  }
  if (b.zone === Z.COM) h += f('Kundschaft', clamp(c.comDem * 0.06, -6, 4) + Math.min(6, cov.comBoost[i] * 0.5));
  h += f('Pulsbahn', cov.transit[i] * 5);
  if (g.transitPenalty && g.transitPenalty[i] > 0) h += f('Überfüllte Station', -10);
  h += f('Wahrzeichen', Math.min(14, cov.happyBonus[i]));
  if (c.bikes) h += f('Fahrradstadt', 3);
  if (c.freetransit) h += f('Kostenlose Pulsbahn', 3);
  if (c.ev) h += f('Ereignisse', c.ev);
  if (b.burning) h += f('Feuer!', -30);
  if (b.problemGarbage) h += f('Müllberge', -4);
  for (let k = 0; k < HAPPINESS_FACTORS.length; k++) {
    let r = null;
    try { r = HAPPINESS_FACTORS[k](g, b, i); } catch (e) { warnOnce('HAPPINESS_FACTORS #' + k, e); }
    if (r && Number.isFinite(r[1])) h += f(r[0], r[1]);
  }
  return clamp(h, 0, 100);
}

export function computeHappiness(g) {
  let sum = 0, w = 0;
  const ctx = happyCtx(g);
  const unemp = g.stats.unemployment;
  for (const b of g.buildings.values()) {
    if (!b.zone || b.construct < 1) continue;
    const i = b.y * g.W + b.x;
    // Kriminalität im Gebäude
    b.crime = clamp(0.04 + unemp * 0.5 + b.level * 0.03 + (1 - b.happy / 100) * 0.14 + (g.stats.pop > 1500 ? 0.06 : 0) - g.cov.police[i] * 0.75, 0, 1);
    b.problemGarbage = g.cov.garbage[i] < 0.25 && g.stats.pop > 300;
    if (b.abandoned) { b.happy = 0; continue; }
    const target = happinessFactors(g, b, null, ctx);
    b.happy += (target - b.happy) * 0.35;
    const weight = Math.max(1, b.occ);
    sum += b.happy * weight;
    w += weight;
  }
  g.stats.happiness = w > 0 ? sum / w : 60;
}
