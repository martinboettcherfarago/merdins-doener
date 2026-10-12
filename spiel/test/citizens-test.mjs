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

function makeCity({ services = false, sewage = 'none', cemetery = false, crematorium = false, seed = 4242, mapType = 'river' } = {}) {
  const g = new Game({ size: 96, seed, mapType, difficulty: 'normal', name: 'Prüfstadt' });
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
    return place(key, 49, hy, false, 9);
  };
  plan.step = () => {
    if (!plan.done1 && g.milestone >= 1) {
      plan.done1 = true;
      if (services) {
        place('police', 20, hy - 5); place('fire', 30, hy + 5); place('clinic', 15, hy + 7); place('school', 24, hy - 8);
        place('park', 12, hy - 4); place('park', 34, hy - 4); place('kindergarten', 14, hy - 9); place('kindergarten', 36, hy - 9);
      }
      place('wind', 46, hy - 8); place('watertower', 46, hy - 4);
      if (sewage !== 'none') plan.sewBuilt = !!placeShore('sewage_outlet');
    }
    if (!plan.done2 && g.milestone >= 2) {
      plan.done2 = true;
      if (cemetery) { place('cemetery', 17, hy - 7); place('cemetery', 37, hy - 7); }
      road(9, hy - 18, 45, hy - 18);
      if (services) { place('clinic', 36, hy - 3); place('elderly_care', 30, hy - 16); place('library', 14, hy - 16); }
      if (sewage === 'plant') placeShore('sewage_plant');
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
  const hi = (r) => [...r.g.buildings.values()].filter((x) => x.zone && x.level >= 3).length;
  const hiA = hi(results.bare), hiB = hi(results.full);
  hiB > hiA ? ok(`Kanalanschluss erlaubt Stufe 3+ (${hiB} Gebäude mit Kanal vs. ${hiA} ohne)`) : fail(`Kanal macht keinen Unterschied bei den Stufen (${hiB} vs. ${hiA})`);
  const seA = results.bare.g.ext.citizens.stats, seB = results.full.g.ext.citizens.stats;
  ok(`Kanal: ohne ${seA.sewageCap}/${Math.round(seA.sewageDemand)} m³, mit ${Math.round(seB.sewageCap)}/${Math.round(seB.sewageDemand)} m³`);
  a.happy < b.happy ? ok(`Ohne Friedhof/Kanal unglücklicher (${a.happy.toFixed(0)} vs. ${b.happy.toFixed(0)})`) : fail('Glück unabhängig von Friedhof/Kanal');
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
