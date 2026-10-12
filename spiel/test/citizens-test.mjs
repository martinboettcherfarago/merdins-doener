// Prüfstand „Bürger, Dienste & Bezirke" (S2). Ohne Browser:
//   node test/citizens-test.mjs [tage=70] [variante=alle]
// Varianten: bare (ohne Friedhof/Kanal), full (mit Diensten), winter (Kälte mit/ohne Fernwärme), districts.
// Prüft Altersstruktur, Bildungsstufen, Sterbefälle mit/ohne Friedhof, Abwasser mit/ohne Kläranlage,
// Bezirke mit Verordnungen, Speichern/Laden – und meldet Verstöße gegen Invarianten.
import { Game } from '../src/sim/game.js';
import { happinessFactors } from '../src/sim/services.js';
import { R, Z, T } from '../src/config.js';
import { BINS, LEN, AGE_GROUPS, EDU_LEVELS } from '../src/sim/systems/citizens.js';
import * as DIST from '../src/sim/systems/districts.js';

const days = +(process.argv[2] || 70);
const only = process.argv[3] || 'all';
let failures = 0;
const fail = (msg) => { failures++; console.log('  ✗ ' + msg); };
const ok = (msg) => console.log('  ✓ ' + msg);
const pct = (v) => (v * 100).toFixed(0) + '%';

function makeCity({ services = false, sewage = 'none', cemetery = false, crematorium = false, seed = 4242, mapType = 'river', difficulty = 'normal' } = {}) {
  const g = new Game({ size: 96, seed, mapType, difficulty: difficulty === 'normal' ? 'relaxed' : difficulty, name: 'Prüfstadt' });
  const W = g.W, hy = g.world.highwayY;
  const idx = (x, y) => y * W + x;
  g.on('cards', (ids) => g.chooseCard(ids[0]));
  g.on('event', () => g.resolveEvent(1));
  const road = (x0, y0, x1, y1, t = R.STREET) => {
    if (y0 === y1) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) g.buildRoad([idx(x, y0)], t);
    else for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) g.buildRoad([idx(x0, y)], t);
  };
  const zone = (x0, y0, x1, y1, z) => {
    const tiles = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < W && y < W) tiles.push(idx(x, y));
    g.zoneTiles(tiles, z);
  };
  const place = (key, x, y, quiet, rad = 8) => {
    const cand = [];
    for (let oy = -rad; oy <= rad; oy++) for (let ox = -rad; ox <= rad; ox++) cand.push([ox, oy, ox * ox + oy * oy]);
    cand.sort((a, b) => a[2] - b[2]);
    for (const [ox, oy] of cand) {
      if (g.checkPlace(key, x + ox, y + oy, 0)) continue;
      const r = g.placeBuilding(key, x + ox, y + oy);
      if (r.ok) return r.building;
    }
    if (!quiet) console.log('    (platzieren fehlgeschlagen:', key, ')');
    return null;
  };
  // Ein Wasserplatz in der Nähe der Stadt: Uferfeld neben einer Straße suchen
  const shoreSpot = (x0, y0, r = 30) => {
    let best = null, bd = 1e9;
    for (let y = Math.max(1, y0 - r); y < Math.min(W - 1, y0 + r); y++) for (let x = Math.max(1, x0 - r); x < Math.min(W - 1, x0 + r); x++) {
      const i = idx(x, y);
      if (g.world.terrain[i] === T.WATER || g.road[i] || g.bld[i]) continue;
      if (g.world.terrain[i - 1] !== T.WATER && g.world.terrain[i + 1] !== T.WATER && g.world.terrain[i - W] !== T.WATER && g.world.terrain[i + W] !== T.WATER) continue;
      const d = Math.hypot(x - x0, y - y0);
      if (d < bd) { bd = d; best = [x, y]; }
    }
    return best;
  };
  road(6, hy, 46, hy);
  for (let x = 9; x <= 45; x += 5) road(x, hy - 12, x, hy + 12);
  road(9, hy - 12, 45, hy - 12); road(9, hy + 12, 45, hy + 12);
  road(9, hy - 6, 45, hy - 6); road(9, hy + 6, 45, hy + 6);
  place('landfill', 24, hy + 13);
  zone(10, hy - 11, 28, hy - 1, Z.RES);
  zone(10, hy + 1, 22, hy + 11, Z.COM);
  zone(31, hy + 1, 44, hy + 11, Z.IND);
  zone(29, hy - 11, 44, hy - 1, Z.RES);
  place('coal', 40, hy + 13);
  place('watertower', 8, hy - 3);
  place('watertower', 8, hy + 3);
  const plan = { services, sewage, cemetery, crematorium, done1: false, done2: false, done3: false, shore: null };
  // Abwasser braucht Ufer: Straße dorthin ziehen
  const connectShore = () => {
    const s = shoreSpot(30, hy, 45);
    if (!s) return null;
    const [sx, sy] = s;
    // Stichstraße vom Rand des Rasters
    const ex = Math.max(9, Math.min(45, sx)), ey = sy < hy ? hy - 12 : hy + 12;
    road(ex, ey, ex, sy);
    road(Math.min(ex, sx), sy, Math.max(ex, sx), sy);
    return s;
  };
  // Anlage am Ufer: Straße nach Osten zum Fluss, dann freie Stelle am Wasser suchen
  let eastRoad = false;
  const placeShore = (key) => {
    if (!eastRoad) { eastRoad = true; road(46, hy, 50, hy); road(50, hy - 10, 50, hy + 10); }
    const b = place(key, 49, hy, true, 9);
    if (b) return b;
    // Freies Uferstück östlich der Stadt suchen und mit einer Stichstraße anbinden
    const [w, h] = g.footprint(key, 0);
    for (let x = 46; x < 75; x++) for (let y = hy - 12; y <= hy + 12; y++) {
      let free = true, wet = false;
      for (let yy = y; yy < y + h && free; yy++) for (let xx = x; xx < x + w; xx++) { const i = idx(xx, yy); if (g.world.terrain[i] === T.WATER || g.world.terrain[i] === T.ROCK || g.road[i] || g.bld[i]) { free = false; break; } }
      if (!free) continue;
      for (let yy = y - 1; yy <= y + h; yy++) for (let xx = x - 1; xx <= x + w; xx++) if (g.world.terrain[idx(xx, yy)] === T.WATER) wet = true;
      if (!wet) continue;
      road(45, y - 1, x + w - 1, y - 1);
      const r = g.placeBuilding(key, x, y, 0);
      if (r.ok) return r.building;
    }
    console.log('    (Uferanlage fehlgeschlagen:', key, ')');
    return null;
  };
  plan.step = () => {
    if (!plan.done1 && g.milestone >= 1) {
      plan.done1 = true;
      if (sewage !== 'none') plan.sewBuilt = !!placeShore('sewage_outlet');
      if (services) {
        place('police', 20, hy - 5); place('fire', 30, hy + 5); place('clinic', 15, hy + 7); place('school', 24, hy - 8);
        place('park', 12, hy - 4); place('park', 34, hy - 4); place('kindergarten', 14, hy - 9); place('kindergarten', 36, hy - 9);
      }
      place('wind', 46, hy - 8); place('watertower', 46, hy - 4);
    }
    if (sewage === 'plant' && !plan.plant && g.milestone >= 2 && (g.money > 12000 || g.sandbox)) plan.plant = !!placeShore('sewage_plant');
    if (!plan.parks && services && g.money > 9000) { plan.parks = true; place('plaza', 20, hy - 2, true); place('plaza', 40, hy - 2, true); place('park', 24, hy - 10, true); place('park', 42, hy - 10, true); }
    if (!plan.done2 && g.milestone >= 2) {
      plan.done2 = true;
      if (cemetery) { place('cemetery', 17, hy - 7); place('cemetery', 37, hy - 7); }
      road(9, hy - 18, 45, hy - 18);
      if (services) { place('clinic', 36, hy - 3); place('elderly_care', 30, hy - 16); place('library', 14, hy - 16); }

    }
    if (!plan.done3 && g.milestone >= 3) {
      plan.done3 = true;
      place('coal', 40, hy + 16);
      place('watertower', 47, hy + 8); place('watertower', 47, hy + 10);
      if (services) { place('hospital', 40, hy - 16); place('highschool', 18, hy - 16); place('school', 26, hy - 17); }
      if (crematorium) place('crematorium', 36, hy - 17);

    }
  };
  return { g, plan, place, road, zone, hy };
}

function checkInvariants(g, label) {
  let bad = 0, sumCoh = 0, sumOcc = 0;
  for (const b of g.buildings.values()) {
    if (b.zone !== Z.RES || !b.cz || !b.cz.a) continue;
    const a = b.cz.a;
    let tot = 0;
    for (let k = 0; k < LEN; k++) if (!Number.isFinite(a[k]) || a[k] < -1e-3) { bad++; break; }
    for (let k = 0; k < BINS; k++) tot += a[k];
    const e3 = a[20] + a[21] + a[22] + a[23], e4 = a[24] + a[25] + a[26] + a[27];
    let adults = 0; for (let k = 5; k < BINS; k++) adults += a[k];
    const ea = a[28] + a[29] + a[30] + a[31];
    if (Math.abs(e3 - a[3]) > 0.05 + a[3] * 0.01 || Math.abs(e4 - a[4]) > 0.05 + a[4] * 0.01 || Math.abs(ea - adults) > 0.05 + adults * 0.01) bad++;
    if (b.construct >= 1 && !b.abandoned) { sumCoh += tot + b.cz.dAcc - b.cz.bAcc; sumOcc += b.occ; }
    if (b.cz.dead < 0 || !Number.isFinite(b.cz.sick)) bad++;
  }
  if (bad) fail(`${label}: ${bad} Gebäude mit ungültigen Kohorten`);
  if (sumOcc > 0 && Math.abs(sumCoh - sumOcc) > Math.max(5, sumOcc * 0.01)) fail(`${label}: Kohorten ${sumCoh.toFixed(0)} ≠ Bewohner ${sumOcc}`);
  return bad === 0;
}

function run(name, opts, n, hook) {
  console.log(`\n=== ${name} ===`);
  const city = makeCity(opts);
  const { g, plan } = city;
  const rows = [];
  for (let d = 1; d <= n; d++) {
    for (let s = 0; s < 300; s++) g.update(0.1);
    plan.step();
    if (hook) hook(city, d);
    const C = g.ext.citizens.stats;
    if (!C) continue;
    rows.push({ d, pop: g.stats.pop, happy: g.stats.happiness, ...C });
    if (d % 10 === 0 || d === n) {
      const gr = C.groups.map((v) => Math.round(v)).join('/');
      console.log(`  Tag ${String(d).padStart(3)} Einw ${String(g.stats.pop).padStart(5)} Glück ${g.stats.happiness.toFixed(0)} | Alter K/J/E/S ${gr} Ø${C.avgAge.toFixed(0)} LE ${C.lifeExp.toFixed(0)} | Geb ${C.birthsToday} Tote ${C.deathsToday} wartend ${C.bodies} (${C.deadBuildings} Geb, max ${C.maxDeadDays} T) Umland ${C.umland} | krank ${pct(C.sickShare)} | Bildung ${C.eduShares.map(pct).join('/')} idx ${C.eduIndex.toFixed(2)} | Kanal ${Math.round(C.sewageDemand)}/${Math.round(C.sewageCap)} ohne ${C.unsewered} Trinkw ${pct(C.contam)} | Gräber ${Math.round(C.graves.used)}/${C.graves.cap} | Arbeit ${C.laborRatio.toFixed(2)}`);
    }
    checkInvariants(g, `${name} Tag ${d}`);
  }
  const agg = {}; let nres = 0;
  for (const b of g.buildings.values()) {
    if (b.zone !== 1 || b.abandoned) continue;
    nres++;
    const out = []; happinessFactors(g, b, out);
    for (const [l, v] of out) agg[l] = (agg[l] || 0) + v;
  }
  console.log('  Ø Glücksfaktoren Wohnen:', Object.entries(agg).map(([l, v]) => `${l} ${(v / nres).toFixed(1)}`).join(', '));
  if (process.env.CZ_DEBUG) {
    const facs = [...g.buildings.values()].filter((b) => !b.zone && ['cemetery', 'crematorium'].includes(b.key));
    console.log('  Bestattung:', facs.map((f) => `${f.key}@${f.x},${f.y} comp ${f.comp} heute ${f.cz && f.cz.today}/${f.cz && Math.round(f.cz.capToday)} Gräber ${f.cz && Math.round(f.cz.used)}`).join(' | '));
    const waiting = [...g.buildings.values()].filter((b) => b.cz && b.cz.dead >= 1);
    for (const b of waiting.slice(0, 12)) {
      const d = facs.map((f) => Math.hypot(f.x + f.w / 2 - b.x - 0.5, f.y + f.h / 2 - b.y - 0.5).toFixed(1)).join(',');
      console.log(`   wartet: ${b.x},${b.y} tote ${b.cz.dead} Tage ${b.cz.deadDays} comp ${b.comp} conn ${b.connected} Abstände ${d}`);
    }
  }
  const lv = {};
  for (const b of g.buildings.values()) if (b.zone) lv[b.zone + ':' + b.level] = (lv[b.zone + ':' + b.level] || 0) + 1;
  console.log('  Stufen', JSON.stringify(lv), 'Nachfrage', g.demand.slice(1).map((v) => v.toFixed(0)).join('/'), 'Geld', Math.round(g.money));
  return { g, rows, city };
}

function summary(rows, from) {
  const r = rows.filter((x) => x.d >= from);
  const avg = (k) => r.reduce((a, x) => a + (typeof k === 'function' ? k(x) : x[k]), 0) / Math.max(1, r.length);
  return { pop: avg('pop'), happy: avg('happy'), deaths: avg('deathsToday'), births: avg('birthsToday'), bodies: avg('bodies'), sick: avg('sickShare'), edu: avg('eduIndex'), unsew: avg('unsewered'), contam: avg('contam'), le: avg('lifeExp'), seniors: avg('seniorShare'), kids: avg('kidsShare') };
}

const results = {};
if (only === 'all' || only === 'bare') results.bare = run('Ohne Friedhof und Kanal (wie sim-test)', { services: true, sewage: 'none', cemetery: false }, days);
if (only === 'all' || only === 'full') results.full = run('Mit Friedhof, Krematorium, Kläranlage und Diensten', { services: true, sewage: 'plant', cemetery: true, crematorium: true }, days);
if (only === 'all' || only === 'outlet') results.outlet = run('Nur Abwasserauslass, Friedhof', { services: true, sewage: 'outlet', cemetery: true }, days);

// --- Bezirke mit Verordnungen
let districtsCity = null;
if (only === 'all' || only === 'districts') {
  const ids = {};
  districtsCity = run('Bezirke mit Verordnungen', { services: true, sewage: 'plant', cemetery: true }, Math.max(40, Math.round(days * 0.8)), ({ g, hy }, d) => {
    if (d !== 8) return;
    // West-Wohngebiet: Hochhausverbot + Verkehrsberuhigung; Ost-Wohngebiet: Nachverdichtung + Steuerzuschlag; Gewerbe: Einkaufsmeile
    const rect = (x0, y0, x1, y1) => { const t = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) t.push(y * g.W + x); return t; };
    const west = DIST.createDistrict(g); DIST.paintTiles(g, west.id, rect(9, hy - 12, 27, hy - 1)); DIST.finishStroke(g, west.id);
    const east = DIST.createDistrict(g); DIST.paintTiles(g, east.id, rect(28, hy - 12, 45, hy - 1)); DIST.finishStroke(g, east.id);
    const shop = DIST.createDistrict(g); DIST.paintTiles(g, shop.id, DIST.blockTiles(g, (hy + 3) * g.W + 12)); DIST.finishStroke(g, shop.id);
    DIST.toggleDistrictPolicy(g, west.id, 'd_lowrise'); DIST.toggleDistrictPolicy(g, west.id, 'd_tempo30'); DIST.toggleDistrictPolicy(g, west.id, 'd_watch');
    DIST.toggleDistrictPolicy(g, east.id, 'd_density'); DIST.setDistrictTax(g, east.id, 3);
    DIST.toggleDistrictPolicy(g, shop.id, 'd_shopping');
    Object.assign(ids, { west: west.id, east: east.id, shop: shop.id });
    console.log('    Bezirke:', g.ext.districts.list.map((x) => `${x.name} (${DIST.districtArea(g, x.id)} Felder)`).join(', '));
  });
  const g = districtsCity.g;
  const D = g.ext.districts;
  const inD = (b, id) => D.map[DIST.anchorTile(g, b)] === id;
  const westHigh = [...g.buildings.values()].filter((b) => b.zone && inD(b, ids.west) && b.level > 3).length;
  westHigh === 0 ? ok('Hochhausverbot: kein Gebäude über Stufe 3 im Bezirk') : fail(`Hochhausverbot verletzt (${westHigh} Gebäude über Stufe 3)`);
  const eastRes = [...g.buildings.values()].filter((b) => b.zone === 1 && inD(b, ids.east) && !b.abandoned);
  const dense = eastRes.filter((b) => b._dens).length;
  dense === eastRes.length && dense > 0 ? ok(`Nachverdichtung: ${dense} Wohngebäude mit +20 % Kapazität`) : fail(`Nachverdichtung greift nicht (${dense}/${eastRes.length})`);
  const bud = g.budget();
  bud.inc.distTax > 0 ? ok(`Bezirkssteuern bringen ${Math.round(bud.inc.distTax)} €/Tag`) : fail('Bezirkssteuern ohne Wirkung');
  bud.exp.distPolicies > 0 ? ok(`Bezirksverordnungen kosten ${Math.round(bud.exp.distPolicies)} €/Tag`) : fail('Bezirksverordnungen kosten nichts');
  const st = DIST.computeDistrictStats(g);
  for (const d of D.list) { const x = st[d.id]; console.log(`    ${d.name}: ${x.residents} Einw., ${x.jobs} Jobs, Glück ${x.happiness.toFixed(0)}, Bodenwert ${x.lv.toFixed(0)}, Lärm ${(x.noise * 100).toFixed(0)}%, Steuern ${Math.round(x.taxIncome)} €/T, Verordnungen ${Math.round(x.policyCost)} €/T`); }
  const shopB = [...g.buildings.values()].find((b) => b.zone === 2 && inD(b, ids.shop));
  if (shopB) { const out = []; happinessFactors(g, shopB, out); const f = out.find(([l]) => l.includes('Einkaufsmeile')); f ? ok(`Einkaufsmeile im Inspektor: „${f[0]}" ${f[1].toFixed(1)}`) : fail('Einkaufsmeile fehlt in den Glücksfaktoren'); }
  // Speichern/Laden der Bezirke
  const g2 = Game.fromSave(JSON.parse(JSON.stringify(g.serialize())));
  const D2 = g2.ext.districts;
  let same = D2.list.length === D.list.length;
  for (let i = 0; i < g.N && same; i++) if (D2.map[i] !== D.map[i]) same = false;
  same && D2.list.every((d, k) => d.name === D.list[k].name && d.policies.join() === D.list[k].policies.join() && d.tax === D.list[k].tax) ? ok('Bezirke überstehen Speichern/Laden') : fail('Bezirke nach Laden verändert');
  // Auflösen
  const n0 = D.list.length;
  DIST.deleteDistrict(g, ids.shop);
  D.list.length === n0 - 1 && ![...D.map].includes(ids.shop) ? ok('Bezirk auflösen entfernt Fläche und Eintrag') : fail('Bezirk auflösen unvollständig');
}

// --- Winter: Fernwärme
if (only === 'all' || only === 'winter') {
  const mk = (heat) => run(heat ? 'Winter mit Heizkraftwerk (Sandkasten)' : 'Winter ohne Fernwärme (Sandkasten)', { services: true, sewage: 'plant', cemetery: true, difficulty: 'sandbox' }, 30, ({ g, place, hy }, d) => {
    if (heat && g.milestone >= 2 && !g.hasBuilt('district_heating')) place('district_heating', 30, hy + 15, true);
    if (d === 10) { let n = 0; for (const b of g.buildings.values()) if (b.zone === 1 && b.level < 3 && b.construct >= 1 && !b.abandoned && n++ < 40) g.setBuildingLevel(b, 3); }
    if (d >= 12) { g.ext.weather = { ...(g.ext.weather || {}), temp: -6, season: 'winter' }; }
  });
  const a = mk(false), b = mk(true);
  const ca = a.g.ext.citizens.stats.cold, cb = b.g.ext.citizens.stats.cold;
  const sa = summary(a.rows, 18), sb = summary(b.rows, 18);
  ca > cb ? ok(`Ohne Fernwärme frieren mehr Gebäude (${ca} vs. ${cb})`) : fail(`Fernwärme ohne Wirkung (${ca} vs. ${cb})`);
  sa.sick > sb.sick ? ok(`Kälte macht krank (${pct(sa.sick)} vs. ${pct(sb.sick)})`) : fail(`Kälte ohne Einfluss auf Krankheit (${pct(sa.sick)} vs. ${pct(sb.sick)})`);
}

// --- Bewertung
console.log('\n=== Bewertung ===');
const from = Math.floor(days * 0.6);
for (const [k, v] of Object.entries(results)) {
  const s = summary(v.rows, from);
  console.log(`  ${k}: Ø ab Tag ${from}: Einw ${s.pop.toFixed(0)} Glück ${s.happy.toFixed(0)} Geburten ${s.births.toFixed(1)} Tote ${s.deaths.toFixed(1)} wartend ${s.bodies.toFixed(1)} krank ${pct(s.sick)} Bildung ${s.edu.toFixed(2)} ohneKanal ${s.unsew.toFixed(0)} Trinkwasser ${pct(s.contam)} LE ${s.le.toFixed(0)} Kinder ${pct(s.kids)} Senioren ${pct(s.seniors)}`);
  results[k].sum = s;
}
if (results.full) {
  const s = results.full.sum;
  s.pop > 1100 ? ok(`Stadt mit Diensten wächst (${s.pop.toFixed(0)} Einw.)`) : fail(`Stadt mit Diensten zu klein (${s.pop.toFixed(0)})`);
  s.le > 65 && s.le < 95 ? ok(`Lebenserwartung plausibel (${s.le.toFixed(0)} Jahre)`) : fail(`Lebenserwartung unplausibel (${s.le.toFixed(0)})`);
  s.bodies < 5 ? ok(`Friedhof/Krematorium holen Verstorbene ab (Ø ${s.bodies.toFixed(1)} wartend)`) : fail(`Zu viele wartende Verstorbene trotz Friedhof (${s.bodies.toFixed(1)})`);
  s.unsew < 3 ? ok('Kläranlage versorgt alle Gebäude') : fail(`Gebäude ohne Abwasser trotz Kläranlage (${s.unsew.toFixed(0)})`);
  s.deaths > 0.5 ? ok(`Es wird gestorben (Ø ${s.deaths.toFixed(1)}/Tag)`) : fail('Keine Sterbefälle');
  s.births > 0.5 ? ok(`Es werden Kinder geboren (Ø ${s.births.toFixed(1)}/Tag)`) : fail('Keine Geburten');
  s.kids > 0.08 && s.kids < 0.35 ? ok(`Kinderanteil plausibel (${pct(s.kids)})`) : fail(`Kinderanteil unplausibel (${pct(s.kids)})`);
  s.seniors > 0.04 && s.seniors < 0.4 ? ok(`Seniorenanteil plausibel (${pct(s.seniors)})`) : fail(`Seniorenanteil unplausibel (${pct(s.seniors)})`);
}
if (results.bare && results.full) {
  const a = results.bare.sum, b = results.full.sum;
  a.bodies > b.bodies + 2 ? ok(`Ohne Friedhof warten mehr Verstorbene (${a.bodies.toFixed(1)} vs. ${b.bodies.toFixed(1)})`) : fail('Friedhof macht keinen Unterschied bei wartenden Verstorbenen');
  const hi = (r) => [...r.g.buildings.values()].filter((x) => x.zone === Z.RES && x.level >= 3).length;
  const hiA = hi(results.bare), hiB = hi(results.full);
  hiB > hiA ? ok(`Kanalanschluss erlaubt Wohnstufe 3+ (${hiB} Wohnhäuser mit Kanal vs. ${hiA} ohne)`) : fail(`Kanal macht keinen Unterschied bei den Wohnstufen (${hiB} vs. ${hiA})`);
  const seA = results.bare.g.ext.citizens.stats, seB = results.full.g.ext.citizens.stats;
  ok(`Kanal: ohne ${seA.sewageCap}/${Math.round(seA.sewageDemand)} m³, mit ${Math.round(seB.sewageCap)}/${Math.round(seB.sewageDemand)} m³`);
  {
    const ga = results.bare.g;
    let hw = 0, nw = 0, ho = 0, no = 0;
    for (const x of ga.buildings.values()) {
      if (x.zone !== Z.RES || x.abandoned || x.construct < 1) continue;
      if (x.cz && x.cz.dead >= 1 && x.cz.deadDays >= 2) { hw += x.happy; nw++; } else { ho += x.happy; no++; }
    }
    const aw = nw ? hw / nw : 0, ao = no ? ho / no : 0;
    nw > 0 && aw < ao - 3 ? ok(`Häuser mit unbestatteten Verstorbenen sind unglücklicher (${aw.toFixed(0)} vs. ${ao.toFixed(0)}, ${nw} Häuser)`) : fail(`Unbestattete Verstorbene ohne Wirkung aufs Glück (${aw.toFixed(0)} vs. ${ao.toFixed(0)}, ${nw} Häuser)`);
  }
  a.pop > 600 ? ok(`Stadt ohne Friedhof/Kanal bricht nicht zusammen (${a.pop.toFixed(0)} Einw.)`) : fail(`Stadt ohne Friedhof/Kanal kollabiert (${a.pop.toFixed(0)})`);
  b.edu > 0.15 ? ok(`Bildungsstand mit Schulen ${b.edu.toFixed(2)}`) : fail(`Bildungsstand zu gering (${b.edu.toFixed(2)})`);
}
if (results.outlet && results.full) {
  const o = results.outlet.sum;
  o.contam >= 0 ? ok(`Auslass: Trinkwasser-Verschmutzung ${pct(o.contam)}, Gewässer max ${(results.outlet.g.ext.citizens.waterPolMax || 0).toFixed(2)}`) : null;
}

// --- Speichern / Laden
if (results.full) {
  const g = results.full.g;
  const data = JSON.parse(JSON.stringify(g.serialize()));
  const g2 = Game.fromSave(data);
  let c1 = 0, c2 = 0;
  for (const b of g.buildings.values()) if (b.cz && b.cz.a) for (let k = 0; k < BINS; k++) c1 += b.cz.a[k];
  for (const b of g2.buildings.values()) if (b.cz && b.cz.a) for (let k = 0; k < BINS; k++) c2 += b.cz.a[k];
  Math.abs(c1 - c2) < Math.max(3, c1 * 0.01) ? ok(`Speichern/Laden erhält die Kohorten (${c1.toFixed(0)} → ${c2.toFixed(0)}, Spielstand ${(JSON.stringify(data).length / 1024).toFixed(0)} KB, davon Bürger ${(JSON.stringify(data.ext.citizens).length / 1024).toFixed(0)} KB)`) : fail(`Kohorten nach Laden verändert (${c1.toFixed(0)} → ${c2.toFixed(0)})`);
  const gr1 = g.ext.citizens.stats.graves.used;
  for (let s = 0; s < 300; s++) g2.update(0.1);
  const gr2 = g2.ext.citizens.stats.graves.used;
  Math.abs(gr1 - gr2) < Math.max(50, gr1 * 0.3) ? ok(`Gräber nach Laden fortgeführt (${gr1} → ${gr2})`) : fail(`Gräber nach Laden falsch (${gr1} → ${gr2})`);
  checkInvariants(g2, 'nach Laden');
}

console.log(failures ? `\n${failures} Prüfung(en) fehlgeschlagen.` : '\nAlle Prüfungen bestanden.');
process.exit(failures ? 1 : 0);
void AGE_GROUPS; void EDU_LEVELS; void DIST;
