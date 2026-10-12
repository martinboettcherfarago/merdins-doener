// System „Bezirke" (Besitzer S2). Läuft headless – keine Imports aus render/ oder ui/.
// Der Spieler malt Bezirke auf die Karte, gibt ihnen Namen und erlässt dort eigene Verordnungen
// und Steuerzuschläge. Vertrag (SWARM 6.6):
//   g.ext.districts = { map: Uint8Array(N) (0 = kein Bezirk), list: [{ id, name, color, policies: [], tax }] , version }
// color ist eine Zahl (0xRRGGBB). version steigt bei jeder Änderung (Ansichten bauen dann neu).
// Weitere Felder: byId (Laufzeit), stats { [id]: Kennzahlen }, nextId.
import { registerSystem, HAPPINESS_FACTORS, LANDVALUE_TERMS, CAPACITY_MODIFIERS, DEMAND_MODIFIERS, BUDGET_LINES } from '../../registry.js';
import { Z, T, TAX_RATE } from '../../config.js';
import { clamp, typedToB64, b64ToTyped, mulberry32 } from '../../util.js';
import { capacityOf } from '../city.js';

export const MAX_DISTRICTS = 32;
export const DISTRICT_COLORS = [0xe8543f, 0x2f8fe0, 0xf2b01e, 0x22a866, 0x8f5ad8, 0xf06fae, 0x10a9a3, 0xff8a1f, 0x5d6dd8, 0xb5473a, 0x7cb342, 0xc06a2b, 0x00897b, 0xd81b60, 0x8d6e63, 0x546e7a];
export const DISTRICT_POLICIES = [
  { id: 'd_lowrise', name: 'Hochhausverbot', desc: 'Gebäude höchstens Stufe 3. Wohnglück +2.', cost: 0, group: 'Bauen' },
  { id: 'd_oldtown', name: 'Denkmalschutz', desc: 'Höchstens Stufe 3, Bodenwert +8, zieht Touristen an.', cost: 0.15, group: 'Bauen' },
  { id: 'd_density', name: 'Nachverdichtung', desc: 'Wohnkapazität +20 %, Wohnglück −3.', cost: 0, group: 'Bauen' },
  { id: 'd_tenants', name: 'Milieuschutz', desc: 'Wohnglück +5, Wohnsteuer im Bezirk −10 %.', cost: 0, group: 'Wohnen' },
  { id: 'd_green', name: 'Grüne Oase', desc: 'Stadtbäume und Grünpflege: Bodenwert +6, Glück +3.', cost: 0.5, group: 'Wohnen' },
  { id: 'd_tempo30', name: 'Verkehrsberuhigung', desc: 'Lärm im Bezirk −40 %, Glück +1.', cost: 0.08, group: 'Verkehr' },
  { id: 'd_nightquiet', name: 'Nachtruhe', desc: 'Lärm für Wohnungen −25 %, Gewerbeglück −3.', cost: 0, group: 'Verkehr' },
  { id: 'd_watch', name: 'Nachbarschaftswache', desc: 'Kriminalität −30 %, Glück +1.', cost: 0.25, group: 'Sicherheit' },
  { id: 'd_shopping', name: 'Einkaufsmeile', desc: 'Gewerbeglück +6, Bodenwert +4, Wohnglück −1.', cost: 0.3, group: 'Wirtschaft' },
  { id: 'd_innovation', name: 'Innovationsviertel', desc: 'Büroglück +5, mehr Büronachfrage.', cost: 0.4, group: 'Wirtschaft' },
  { id: 'd_edu', name: 'Bildungsviertel', desc: 'Ganztagsschulen: 20 % mehr Abschlüsse, Wohnglück +1.', cost: 0.6, group: 'Bildung' },
];
const POL = Object.fromEntries(DISTRICT_POLICIES.map((p) => [p.id, p]));

// ---------- Namen
const NAMES = {
  res: ['Gartenstadt', 'Lindenhof', 'Rosenau', 'Sonnenhang', 'Wiesengrund', 'Eichenhain', 'Kastanienviertel', 'Musikerviertel', 'Dichterviertel', 'Vogelsang', 'Heideblick', 'Fliederhof', 'Am Stadtpark', 'Birkenhöhe', 'Kirschgarten'],
  com: ['Altstadt', 'Neue Mitte', 'Marktviertel', 'Kaufmannsviertel', 'Domviertel', 'Bahnhofsviertel', 'Passagenviertel', 'Am Markt'],
  ind: ['Gewerbepark', 'Werkviertel', 'Hüttenviertel', 'Gewerbegebiet', 'Ziegelei', 'Am Güterbahnhof', 'Industriehof'],
  off: ['Bankenviertel', 'Technologiepark', 'Medienhafen', 'Campus', 'Skyline', 'Neue Mitte'],
  water: ['Hafenviertel', 'Uferviertel', 'Fischerviertel', 'Am Fluss', 'Seeblick', 'Schifferviertel'],
  none: ['Neustadt', 'Vorstadt', 'Stadtrand', 'Neubaugebiet', 'Feldmark'],
};
const DIRS = { N: ['Nordend', 'Nordstadt', 'Nord'], S: ['Südstadt', 'Südviertel', 'Süd'], W: ['Westend', 'Weststadt', 'West'], E: ['Ostend', 'Oststadt', 'Ost'] };

export function districtsOf(g) { return g.ext && g.ext.districts; }
function D(g) { return g.ext.districts; }
function touch(g) { const d = D(g); d.version++; d.statsAt = -1; }
function rebuildIndex(g) {
  const st = D(g);
  st.byId = [];
  for (const d of st.list) st.byId[d.id] = d;
}

export function createDistrict(g, name) {
  const st = D(g);
  if (st.list.length >= MAX_DISTRICTS) return null;
  let id = 1;
  while (st.byId[id]) id++;
  if (id > 255) return null;
  const used = new Set(st.list.map((x) => x.color));
  const color = DISTRICT_COLORS.find((c) => !used.has(c)) ?? DISTRICT_COLORS[st.list.length % DISTRICT_COLORS.length];
  const d = { id, name: name || `Bezirk ${st.list.length + 1}`, color, policies: [], tax: 0, auto: !name, named: !!name, created: g.day() };
  st.list.push(d);
  rebuildIndex(g);
  touch(g);
  g.emit('districtsChanged', d);
  return d;
}
export function deleteDistrict(g, id) {
  const st = D(g);
  const k = st.list.findIndex((x) => x.id === id);
  if (k < 0) return false;
  st.list.splice(k, 1);
  for (let i = 0; i < g.N; i++) if (st.map[i] === id) st.map[i] = 0;
  rebuildIndex(g);
  touch(g);
  g.dirty.coverage = true;
  refreshCaps(g);
  g.emit('districtsChanged', null);
  return true;
}
export function renameDistrict(g, id, name) {
  const d = D(g).byId[id];
  if (!d) return false;
  const n = String(name || '').trim().slice(0, 32);
  if (!n) return false;
  d.name = n; d.auto = false; d.named = true;
  touch(g);
  g.emit('districtsChanged', d);
  return true;
}
export function setDistrictColor(g, id, color) {
  const d = D(g).byId[id];
  if (!d) return false;
  d.color = color;
  touch(g);
  g.emit('districtsChanged', d);
  return true;
}
export function cycleDistrictColor(g, id) {
  const d = D(g).byId[id];
  if (!d) return false;
  const k = DISTRICT_COLORS.indexOf(d.color);
  return setDistrictColor(g, id, DISTRICT_COLORS[(k + 1) % DISTRICT_COLORS.length]);
}
export function toggleDistrictPolicy(g, id, pid) {
  const d = D(g).byId[id];
  if (!d || !POL[pid]) return false;
  const k = d.policies.indexOf(pid);
  if (k >= 0) d.policies.splice(k, 1); else d.policies.push(pid);
  touch(g);
  g.dirty.coverage = g.dirty.util = true;
  if (pid === 'd_density') refreshCaps(g);
  g.emit('districtsChanged', d);
  return true;
}
export function setDistrictTax(g, id, v) {
  const d = D(g).byId[id];
  if (!d) return false;
  d.tax = clamp(Math.round(v), -5, 5);
  touch(g);
  return true;
}
export function districtAt(g, i) {
  const st = D(g);
  if (!st || i < 0 || i >= g.N) return null;
  const id = st.map[i];
  return id ? st.byId[id] || null : null;
}
export const anchorTile = (g, b) => (b.y + (b.h >> 1)) * g.W + b.x + (b.w >> 1);
export function districtOfBuilding(g, b) { return districtAt(g, anchorTile(g, b)); }
export function hasPolicy(g, b, pid) {
  const d = districtOfBuilding(g, b);
  return !!(d && d.policies.includes(pid));
}

// ---------- Malen
export function paintable(g, i) { return i >= 0 && i < g.N && g.world.terrain[i] !== T.WATER; }
export function brushTiles(g, cx, cy, r) {
  const out = [];
  const rr = r + 0.35;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
    if (x < 0 || y < 0 || x >= g.W || y >= g.H) continue;
    if (Math.hypot(x - cx, y - cy) > rr) continue;
    const i = y * g.W + x;
    if (paintable(g, i)) out.push(i);
  }
  return out;
}
// Block füllen: alle Felder bis zu den Straßen (höchstens limit Felder). Straßen bleiben Grenze.
export function blockTiles(g, i0, limit = 700) {
  if (!paintable(g, i0) || g.road[i0]) return [];
  const { W, H } = g;
  const seen = new Uint8Array(g.N);
  seen[i0] = 1;
  const q = [i0];
  for (let h = 0; h < q.length && q.length < limit; h++) {
    const i = q[h];
    const x = i % W, y = (i / W) | 0;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + ox, ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (seen[j] || !paintable(g, j) || g.road[j]) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  return q.slice(0, limit);
}
export function paintTiles(g, id, tiles) {
  const st = D(g);
  if (id && !st.byId[id]) return 0;
  let n = 0;
  for (const i of tiles) {
    if (!paintable(g, i)) continue;
    if (st.map[i] !== id) { st.map[i] = id; n++; }
  }
  if (n) { touch(g); g.dirty.coverage = true; if (id) st.byId[id].hadTiles = true; }
  return n;
}
export function districtArea(g, id) { let n = 0; const m = D(g).map; for (let i = 0; i < g.N; i++) if (m[i] === id) n++; return n; }
// Leere Bezirke aufräumen
export function pruneEmpty(g) {
  const st = D(g);
  const area = new Int32Array(256);
  for (let i = 0; i < g.N; i++) area[st.map[i]]++;
  const before = st.list.length;
  st.list = st.list.filter((d) => area[d.id] > 0 || !d.hadTiles);
  if (st.list.length !== before) { rebuildIndex(g); touch(g); g.emit('districtsChanged', null); }
}

// Namen nach Lage und Bebauung vorschlagen
export function suggestName(g, id) {
  const st = D(g);
  const W = g.W;
  let n = 0, sx = 0, sy = 0, water = 0;
  const zc = [0, 0, 0, 0, 0];
  for (let i = 0; i < g.N; i++) {
    if (st.map[i] !== id) continue;
    n++;
    const x = i % W, y = (i / W) | 0;
    sx += x; sy += y;
    if (g.world.waterDist[i] > 0 && g.world.waterDist[i] <= 2) water++;
    if (g.zone[i]) zc[g.zone[i]]++;
  }
  if (!n) return null;
  const cx = sx / n, cy = sy / n;
  // Stadtmitte = Schwerpunkt aller Gebäude
  let bx = 0, by = 0, bn = 0;
  for (const b of g.buildings.values()) { bx += b.x; by += b.y; bn++; }
  const mx = bn ? bx / bn : W / 2, my = bn ? by / bn : g.H / 2;
  const dx = cx - mx, dy = cy - my;
  const far = Math.hypot(dx, dy) > 10;
  const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N');
  let kind = 'none', best = 0;
  for (let z = 1; z <= 4; z++) if (zc[z] > best) { best = zc[z]; kind = ['', 'res', 'com', 'ind', 'off'][z]; }
  if (water > n * 0.25) kind = 'water';
  const used = new Set(st.list.filter((d) => d.id !== id).map((d) => d.name));
  const rng = mulberry32(id * 7919 + g.opts.seed);
  const pool = [...NAMES[kind]];
  if (far) pool.unshift(...DIRS[dir].slice(0, 2));
  for (let k = pool.length - 1; k > 0; k--) { const j = Math.floor(rng() * (k + 1)); [pool[k], pool[j]] = [pool[j], pool[k]]; }
  if (far && rng() < 0.6) pool.unshift(DIRS[dir][Math.floor(rng() * 2)]);
  for (const name of pool) if (!used.has(name)) return name;
  for (const name of pool) { const v = `${name} ${DIRS[dir][2]}`; if (!used.has(v)) return v; }
  return `Bezirk ${id}`;
}
// Nach dem ersten Pinselstrich bekommt ein neuer Bezirk einen passenden Namen
export function finishStroke(g, id) {
  const d = id > 0 ? D(g).byId[id] : null;
  if (d && d.auto && !d.named) {
    const nm = suggestName(g, id);
    if (nm) { d.name = nm; d.named = true; touch(g); }
  }
  pruneEmpty(g);
  refreshCaps(g);
  g.emit('districtsChanged', d);
}

// ---------- Kennzahlen
export function computeDistrictStats(g) {
  const st = D(g);
  const W = g.W;
  const S = {};
  for (const d of st.list) S[d.id] = { tiles: 0, lv: 0, noise: 0, pollution: 0, crime: 0, buildings: 0, byZone: [0, 0, 0, 0, 0], residents: 0, jobs: 0, happySum: 0, happyW: 0, eduSum: 0, ages: [0, 0, 0, 0], sick: 0, dead: 0, unsewered: 0, services: 0, taxBase: [0, 0, 0, 0, 0], levelSum: 0, abandoned: 0 };
  for (let i = 0; i < g.N; i++) {
    const id = st.map[i];
    if (!id || !S[id]) continue;
    const s = S[id];
    s.tiles++;
    s.lv += g.fields.landValue[i];
    s.noise += g.fields.noise[i];
    s.pollution += g.fields.pollution[i];
    s.crime += g.fields.crime[i];
  }
  for (const b of g.buildings.values()) {
    const d = districtAt(g, anchorTile(g, b));
    if (!d) continue;
    const s = S[d.id];
    s.buildings++;
    if (!b.zone) { s.services++; continue; }
    s.byZone[b.zone]++;
    if (b.abandoned) { s.abandoned++; continue; }
    s.levelSum += b.level;
    if (b.zone === Z.RES) {
      s.residents += b.occ;
      s.eduSum += b.edu * b.occ;
      if (b.cz && b.cz.a) {
        const a = b.cz.a;
        let k0 = 0, k1 = 0, k2 = 0, k3 = 0;
        for (let k = 0; k <= 2; k++) k0 += a[k];
        for (let k = 3; k <= 4; k++) k1 += a[k];
        for (let k = 5; k <= 12; k++) k2 += a[k];
        for (let k = 13; k < 20; k++) k3 += a[k];
        s.ages[0] += k0; s.ages[1] += k1; s.ages[2] += k2; s.ages[3] += k3;
        s.sick += b.cz.sick * b.occ;
        s.dead += b.cz.dead || 0;
      }
    } else s.jobs += b.occ;
    if (b.cz && b.cz.sewNeed && !b.cz.sew) s.unsewered++;
    s.taxBase[b.zone] += b.occ * TAX_RATE[b.zone];
    const w = Math.max(1, b.occ);
    s.happySum += b.happy * w; s.happyW += w;
  }
  const taxMul = 1 + g.eff('taxMul') + (g.hasBuilt('townhall') ? 0.08 : 0);
  for (const d of st.list) {
    const s = S[d.id];
    const t = Math.max(1, s.tiles);
    s.lv /= t; s.noise /= t; s.pollution /= t; s.crime /= t;
    s.happiness = s.happyW > 0 ? s.happySum / s.happyW : 0;
    s.edu = s.residents > 0 ? s.eduSum / s.residents : 0;
    s.sickShare = s.residents > 0 ? s.sick / s.residents : 0;
    // Steuern aus dem Bezirk (inkl. Zuschlag) und Kosten der Verordnungen
    let tax = 0, delta = 0;
    for (let z = 1; z <= 4; z++) {
      const base = s.taxBase[z] * taxMul;
      tax += base * (g.taxes[z] + d.tax);
      delta += base * d.tax;
      if (z === Z.RES && d.policies.includes('d_tenants')) { tax -= base * g.taxes[z] * 0.1; delta -= base * g.taxes[z] * 0.1; }
    }
    s.taxIncome = tax;
    s.taxDelta = delta;
    s.policyCost = d.policies.reduce((a, pid) => a + (POL[pid] ? POL[pid].cost : 0), 0) * (s.residents + s.jobs * 0.5) / 100;
    delete s.happySum; delete s.happyW; delete s.eduSum; delete s.taxBase;
  }
  st.stats = S;
  st.statsAt = g.time;
  return S;
}
export function districtStats(g, id) {
  const st = D(g);
  if (!st.stats || st.statsAt < 0 || g.time - st.statsAt > 60) computeDistrictStats(g);
  return st.stats[id] || null;
}

// ---------- Wirkungen
// Nachverdichtung: Kapazität der Wohngebäude neu berechnen, wenn sich Bezirk oder Verordnung ändern
export function refreshCaps(g) {
  for (const b of g.buildings.values()) {
    if (b.zone !== Z.RES) continue;
    const on = hasPolicy(g, b, 'd_density');
    if (on === !!b._dens) continue;
    b._dens = on;
    b.cap = capacityOf(b, g);
    if (b.occ > b.cap) b.occ = b.cap;
  }
}
CAPACITY_MODIFIERS.push((g, b, cap) => {
  if (b.zone !== Z.RES || !g.ext || !g.ext.districts || !g.ext.districts.list.length) return cap;
  const on = hasPolicy(g, b, 'd_density');
  b._dens = on;
  return on ? cap * 1.2 : cap;
});

HAPPINESS_FACTORS.push((g, b, i) => {
  if (!g.ext || !g.ext.districts || !b.zone) return null;
  const d = districtOfBuilding(g, b);
  if (!d || !d.policies.length) return null;
  const P = d.policies;
  const res = b.zone === Z.RES, com = b.zone === Z.COM, off = b.zone === Z.OFF;
  const noise = g.fields.noise[i];
  let v = 0;
  const names = [];
  const add = (pid, x) => { if (P.includes(pid) && x) { v += x; names.push(POL[pid].name); } };
  add('d_lowrise', res ? 2 : 0);
  add('d_oldtown', res || com ? 2 : 0);
  add('d_density', res ? -3 : 0);
  add('d_tenants', res ? 5 : 0);
  add('d_green', 3);
  add('d_tempo30', 1 + noise * (res ? 13 : 5) * 0.4);
  add('d_nightquiet', res ? noise * 13 * 0.25 : com ? -3 : 0);
  add('d_watch', 1 + (b.crime || 0) * 12 * 0.3);
  add('d_shopping', com ? 6 : res ? -1 : 0);
  add('d_innovation', off ? 5 : 0);
  add('d_edu', res ? 1 : 0);
  if (Math.abs(v) < 0.5) return null;
  return [names.length === 1 ? `${d.name}: ${names[0]}` : `${d.name}: Verordnungen`, v];
});
HAPPINESS_FACTORS.push((g, b) => {
  if (!g.ext || !g.ext.districts || !b.zone) return null;
  const d = districtOfBuilding(g, b);
  if (!d || !d.tax) return null;
  return [`${d.name}: Steuern ${d.tax > 0 ? '+' : '−'}${Math.abs(d.tax)} %`, -d.tax * 1.7];
});

LANDVALUE_TERMS.push((g, i) => {
  const st = g.ext && g.ext.districts;
  if (!st || !st.list.length) return 0;
  const id = st.map[i];
  if (!id) return 0;
  const d = st.byId[id];
  if (!d || !d.policies.length) return 0;
  let v = 0;
  for (const pid of d.policies) {
    if (pid === 'd_green') v += 6;
    else if (pid === 'd_oldtown') v += 8;
    else if (pid === 'd_shopping') v += 4;
    else if (pid === 'd_tempo30') v += g.fields.noise[i] * 16 * 0.4;
    else if (pid === 'd_nightquiet') v += g.fields.noise[i] * 16 * 0.2;
  }
  return v;
});

DEMAND_MODIFIERS.push((g, d) => {
  const st = g.ext && g.ext.districts;
  if (!st || !st.list.length || !g.isUnlocked('zone4')) return;
  let n = 0;
  for (const x of st.list) if (x.policies.includes('d_innovation')) n++;
  if (n) d[4] += Math.min(18, n * 6);
});

BUDGET_LINES.push({
  id: 'distTax', label: 'Bezirkssteuern', kind: 'income',
  amount: (g) => {
    const st = g.ext && g.ext.districts;
    if (!st || !st.list.length) return 0;
    let v = 0;
    for (const d of st.list) { const s = districtStats(g, d.id); if (s) v += s.taxDelta; }
    return v;
  },
});
BUDGET_LINES.push({
  id: 'distPolicies', label: 'Bezirksverordnungen', kind: 'expense',
  amount: (g) => {
    const st = g.ext && g.ext.districts;
    if (!st || !st.list.length) return 0;
    let v = 0;
    for (const d of st.list) { const s = districtStats(g, d.id); if (s) v += s.policyCost; }
    return v;
  },
});

// Stufen begrenzen (Hochhausverbot, Denkmalschutz): nach der Kernsimulation des Tages
function levelCaps(g) {
  const st = D(g);
  for (const b of g.buildings.values()) {
    if (!b.zone || b.construct < 1 || b.abandoned) continue;
    const d = districtAt(g, anchorTile(g, b));
    if (!d) continue;
    if (d.policies.includes('d_lowrise') || d.policies.includes('d_oldtown')) {
      if (b.level > 3) g.setBuildingLevel(b, 3);
      else if (b.level === 3) b.upCount = 0;
    }
  }
  void st;
}
// Denkmalschutz bringt Touristen: ein Effekt, dessen Wert täglich angepasst wird
function oldtownTourism(g) {
  const st = D(g);
  let n = 0;
  for (const b of g.buildings.values()) {
    if (!b.zone || b.abandoned || b.construct < 1 || (b.zone !== Z.RES && b.zone !== Z.COM)) continue;
    const d = districtAt(g, anchorTile(g, b));
    if (d && d.policies.includes('d_oldtown')) n++;
  }
  const val = Math.min(320, n * 0.9);
  let e = g.effects.find((x) => x.key === 'tourismAdd' && x.label === 'Denkmalschutz');
  if (val <= 0) { if (e) e.until = g.time; return; }
  if (!e) { e = { key: 'tourismAdd', value: 0, until: 0, label: 'Denkmalschutz' }; g.effects.push(e); }
  e.value = Math.round(val);
  e.until = g.time + 2 * 1440;
  void st;
}

registerSystem({
  id: 'districts',
  init(g) {
    g.ext.districts = { map: new Uint8Array(g.N), list: [], byId: [], version: 1, stats: {}, statsAt: -1 };
  },
  hourly(g) {
    const st = D(g);
    if (!st.list.length) return;
    // Nachbarschaftswache: Kriminalität im Bezirk −30 % (nach der Glücksberechnung)
    for (const b of g.buildings.values()) {
      if (!b.zone || !b.crime) continue;
      const d = districtAt(g, anchorTile(g, b));
      if (d && d.policies.includes('d_watch')) b.crime *= 0.7;
    }
    computeDistrictStats(g);
  },
  daily(g) {
    const st = D(g);
    if (!st.list.length) return;
    levelCaps(g);
    oldtownTourism(g);
  },
  serialize(g) {
    const st = D(g);
    return { map: typedToB64(st.map), list: st.list.map((d) => ({ id: d.id, name: d.name, color: d.color, policies: [...d.policies], tax: d.tax, auto: d.auto, named: d.named, created: d.created, hadTiles: !!d.hadTiles })) };
  },
  load(g, data) {
    const st = D(g);
    if (!data) return;
    try {
      const m = b64ToTyped(data.map, Uint8Array);
      if (m.length === g.N) st.map = m;
    } catch (e) { /* alter Spielstand */ }
    st.list = (data.list || []).map((d) => ({ policies: [], tax: 0, auto: false, named: true, created: 0, ...d }));
    rebuildIndex(g);
    touch(g);
    refreshCaps(g);
  },
});
