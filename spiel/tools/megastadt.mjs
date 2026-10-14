// Baut die Vorzeigestadt „Megastadt" als Spielstand (saves/megastadt.json): größte Karte, dicht bebaut, alle Wahrzeichen,
// Hauptbahnhof, Flughafen, viele U-Bahn-, Bus- und Straßenbahnlinien, volle Versorgung und hohe Einnahmen.
// Aufruf: node tools/megastadt.mjs [tage=260] [karte=river] [saat=11] [--out saves/megastadt.json]
// Der Bot aus den Prüfständen spielt wie ein Mensch; hier bekommt er unbegrenzt Geld und Szenario-Ziele (Fahrgäste,
// Pendelzeit, Tourismus, Wahrzeichen, Parks, Bildung, Glück), damit er alles ausbaut, was das Spiel hergibt.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Game } from '../src/sim/game.js';
import { BUILDINGS, R, T as TER, DAY } from '../src/config.js';
import { computeUtilities } from '../src/sim/services.js';
import * as TPS from '../src/sim/systems/transport.js';
import { Bot, runDay, seedMathRandom } from '../test/bot.mjs';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const pos = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const days = +(pos[0] || 260), map = pos[1] || 'river', seed = +(pos[2] || 11);
const out = resolve(process.cwd(), flag('--out', 'saves/megastadt.json'));

seedMathRandom(seed);
const g = new Game({ size: 128, seed, mapType: map, difficulty: 'relaxed', name: 'Megastadt', disasters: 'off' });
const RICH = 1e9;
g.money = RICH;
// Takt wie im Spiel mit der Standard-Tageslänge „Lang" (1 Minute je Tag), damit Bahnen und Fahrgäste zusammenpassen
g.minPerSec = 24;
// Alle Dienste mit vollem Budget (150 %): mehr Reichweite und Leistung für Müll, Gesundheit, Bildung, Sicherheit usw.
for (const cat of new Set(Object.values(BUILDINGS).map((d) => d.cat))) if (!['landmarks', 'transit', 'industry'].includes(cat)) g.serviceBudget[cat] = 1.5;

// Ziele, die nie ganz erfüllt sind: Der Bot baut Linien, Züge, Busse, Wahrzeichen, Parks und Bildung aus.
const trainsPerLine = 6;
const status = () => {
  const T = g.transit;
  const tOk = T.lines.length >= T.linesMax && T.lines.every((l) => T.trains.filter((t) => t.line === l.id).length >= trainsPerLine);
  const goals = ['riders', 'commute', 'tourism', 'landmarks', 'parks', 'edu', 'happy'].map((id) => ({ goal: { id, target: 1 }, done: id === 'riders' ? tOk : false }));
  return { st: { status: 'running' }, sc: { days: 99999 }, elapsed: 0, goals };
};
// Größeres Raster als im Prüfstand: die ganze Karte, auch jenseits des Flusses (über Brücken)
const B = 5;
class MegaBot extends Bot {
  frontier() {
    const out = [], endT = g.world.highwayEnd;
    const kMax = Math.floor((this.W - 2 - this.x0) / B) - 1, mMin = -Math.floor((this.hy - 1) / B), mMax = Math.floor((this.H - 2 - this.hy) / B) - 1;
    for (let m = mMin; m <= mMax; m++) for (let k = 0; k <= kMax; k++) {
      if (this.blocks.has(k + ',' + m) || !this.blockOk(k, m)) continue;
      const touch = this.perim(k, m).some((i) => (g.road[i] && g.road[i] !== R.HIGHWAY && g.roadComp[i] === g.outsideComp) || i === endT + 1);
      if (touch) out.push([k, m]);
    }
    return out;
  }
  // Wohnen und Büros nördlich, Gewerbe an der Hauptachse, Industrie im Süden – auf der ganzen Karte
  sector(k, m) { return m <= -1 ? 'north' : m === 0 ? 'main' : m >= 4 ? 'south' : (k % 3 === 0 ? 'south' : 'north'); }
}
// Die U-Bahn plant das Werkzeug selbst als Raster (siehe metroGrid), der Bot baut Busse, Straßen und alles andere
const bot = new MegaBot(g, { reserve: 0, status, transit: false });
bot.start();
// Brücken: Rasterstraßen über Wasser bis zum Kartenrand verlängern, sobald das Netz an den Fluss stößt
function bridges() {
  let built = 0;
  for (let m = -10; m <= 10; m += 2) {
    const y = bot.hy + B * m;
    if (y < 2 || y > g.H - 3) continue;
    let x = 1; const W = g.W;
    // vom letzten Straßenfeld der Zeile nach Osten über Wasser bis zum nächsten Land weiterbauen
    let last = -1;
    for (x = 1; x < W - 1; x++) if (g.road[y * W + x] && g.roadComp[y * W + x] === g.outsideComp) last = x;
    if (last < 0) continue;
    const tiles = [];
    let wet = false, k = last + 1;
    for (; k < W - 2 && tiles.length < 40; k++) {
      const i = y * W + k, ter = g.world.terrain[i];
      if (ter === TER.ROCK || (g.bld[i] && !g.road[i])) break;
      if (ter === TER.WATER) wet = true;
      tiles.push(i);
      if (wet && ter !== TER.WATER && tiles.length > 2 && g.world.terrain[i + 1] !== TER.WATER) { tiles.push(y * W + k + 1); break; }
    }
    if (wet && tiles.length > 2) { const r = g.buildRoad(tiles, R.STREET); if (r.ok) { built++; log(`Brücke in Zeile ${m}`); } }
  }
  return built;
}
// Wasserwerke am Ufer, wenn das Wasser knapp wird
function bigWater() {
  computeUtilities(g);
  const u = g.util;
  if ((u.waterSupply || 0) >= (u.waterDemand || 0) * 1.25 + 100) return;
  const [cx, cy] = center();
  const key = g.isUnlocked('waterworks') ? 'waterworks' : 'pump';
  if (bot.shorePlace(key, cx, cy, { maxDist: 70 })) log(`baut ${BUILDINGS[key].name} (Bedarf ${Math.round(u.waterDemand)} m³)`);
}
// Großbauten mit viel Platzbedarf (Flughafen): die ganze Karte nach einem passenden Grundstück am Straßennetz absuchen
function placeAnywhere(key, dmin = 10, dmax = 140) {
  if (!g.isUnlocked(key) || g.hasBuilt(key)) return false;
  const [cx, cy] = center(), cands = [];
  for (let y = 2; y < g.H - 2; y++) for (let x = 2; x < g.W - 2; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d < dmin || d > dmax) continue;
    for (const rot of [0, 1]) if (!g.checkPlace(key, x, y, rot)) cands.push([d, x, y, rot]);
  }
  cands.sort((a, b) => a[0] - b[0]);
  for (const [, x, y, rot] of cands.slice(0, 40)) if (g.placeBuilding(key, x, y, rot).ok) { bot.tally(key); log(`baut ${BUILDINGS[key].name} (${x},${y})`); return true; }
  return false;
}
// U-Bahn-Netz über die ganze Stadt: Achsen waagrecht, senkrecht und diagonal, Stationen alle ~7 Felder,
// Umstieg an vorhandenen Stationen in der Nähe; jede Linie mit vielen Zügen und vollen Waggons
function metroGrid() {
  const T = g.transit;
  if (!g.isUnlocked('transit') || g.milestone < 3) return;
  T.linesMax = Math.max(T.linesMax, 10);
  // Alle Schnellzug-Karten, die es gibt (Expresszüge 2×, Neue Stellwerke 3×)
  if (!metroGrid.fast) { metroGrid.fast = true; g.mods.trainSpeed *= 1.2 * 1.2 * 1.1 * 1.1 * 1.1; g.cardCount.express = 2; g.cardCount.signals = 3; }
  const [cx, cy] = center();
  // Raster aus je fünf waagrechten und senkrechten Linien: An jeder Kreuzung treffen sich genau zwei Linien (Umstieg)
  const axes = [[1, 0, 0], [0, 1, 0], [1, 0, -18], [0, 1, -18], [1, 0, 18], [0, 1, 18], [1, 0, -36], [0, 1, -36], [1, 0, 36], [0, 1, 36]];
  const W = g.W;
  const near = (x, y) => { let best = null, bd = 3.1; for (const st of T.stations.values()) { const d = Math.hypot(st.x - x, st.y - y); if (d < bd) { bd = d; best = st; } } return best; };
  for (const [ax, ay, off] of axes) {
    if (T.lines.length >= T.linesMax) break;
    const ox = ay !== 0 && ax === 0 ? off : ax !== 0 && ay !== 0 ? 0 : 0, oy = ax !== 0 && ay === 0 ? off : 0;
    const key = `${ax},${ay},${off}`;
    if ((metroGrid.done ||= new Set()).has(key)) continue;
    const stops = [];
    for (let s = -42; s <= 42; s += 7) {
      const tx = Math.round(cx + ox + ax * s), ty = Math.round(cy + oy + ay * s);
      if (tx < 2 || ty < 2 || tx >= W - 2 || ty >= g.H - 2) continue;
      let st = near(tx, ty);
      if (!st) {
        for (let r = 0; r <= 2 && !st; r++) for (let dy = -r; dy <= r && !st; dy++) for (let dx = -r; dx <= r && !st; dx++) {
          const x = tx + dx, y = ty + dy, i = y * W + x;
          if (!g.road[i] || g.road[i] === R.HIGHWAY || g.checkPlace('station', x, y)) continue;
          // nur dort, wo Leute wohnen oder arbeiten
          let occ = 0; for (const b of g.buildings.values()) if (b.zone && Math.abs(b.x - x) <= 3 && Math.abs(b.y - y) <= 3) occ += b.occ || 0;
          if (occ < 40) continue;
          const r2 = g.placeBuilding('station', x, y);
          if (r2.ok) st = r2.station;
        }
      }
      if (st && !stops.includes(st)) stops.push(st);
    }
    if (stops.length < 4) continue;
    const r = g.createLine(stops.map((x) => x.id), false);
    if (!r.ok) { log(`U-Bahn-Linie nicht möglich: ${r.msg}`); continue; }
    metroGrid.done.add(key);
    const line = T.lines[T.lines.length - 1];
    for (let k = 0; k < 7; k++) g.addTrain(line.id);
    for (let k = 0; k < 24; k++) g.addWagon(line.id);
    log(`U-Bahn-Linie ${T.lines.length} (${stops.length} Stationen, ${T.trains.filter((t) => t.line === line.id).length} Züge)`);
  }
  // vorhandene Linien ebenfalls verdichten
  for (const l of T.lines) {
    const n = T.trains.filter((t) => t.line === l.id).length;
    for (let k = n; k < 7; k++) g.addTrain(l.id);
    for (let k = 0; k < 24; k++) if (!g.addWagon(l.id).ok) break;
  }
}
// Kläranlagen: so viele, dass keine voll ausgelastet ist – dann bleibt der Rest-Ablauf gering und das Wasser sauber blau
function bigSewage() {
  const S = g.ext.citizens && g.ext.citizens.stats;
  if (!S || !S.sewageDemand || !g.isUnlocked('sewage_plant')) return;
  const plants = [...g.buildings.values()].filter((b) => b.key === 'sewage_plant').length;
  if (plants * BUILDINGS.sewage_plant.sewage >= S.sewageDemand * 1.5 || plants >= 24) return;
  const [cx, cy] = center();
  if (bot.shorePlace('sewage_plant', cx, cy, { maxDist: 80 })) log(`baut Kläranlage ${plants + 1} (Abwasser ${Math.round(S.sewageDemand)} m³)`);
}
// Großkraftwerke, wenn der Bedarf die Reserve übersteigt
function bigPower() {
  computeUtilities(g);
  const oc = g.outsideComp, ps = g.util.pSup?.[oc] || 0, pd = g.util.pDem?.[oc] || 0;
  if (ps >= pd * 1.3 + 200) return;
  const [cx] = center();
  const key = g.isUnlocked('fusion') ? 'fusion' : g.isUnlocked('nuclear') ? 'nuclear' : g.isUnlocked('gas') ? 'gas' : 'coal';
  if (bot.placeNear(key, cx, bot.southEdge() + 3, 30, { avoid: 4 })) log(`baut ${BUILDINGS[key].name} (Bedarf ${Math.round(pd)} MW)`);
}

const log = (t) => console.log(`T${g.day()} ${t}`);
const center = () => bot.center();
// Alle Wahrzeichen und großen Bauten, die freigeschaltet sind und noch fehlen
function landmarks() {
  const [cx, cy] = center();
  const keys = Object.keys(BUILDINGS).filter((k) => BUILDINGS[k].landmark && g.isUnlocked(k) && !g.hasBuilt(k));
  for (const k of keys) {
    const ok = BUILDINGS[k].needsWater ? bot.shorePlace(k, cx, cy, { maxDist: 50 }) : bot.placeNear(k, cx, cy, 30);
    if (ok) log(`Wahrzeichen ${BUILDINGS[k].name}`);
  }
  const hubs = [['train_station', 1], ['airport', 1], ['tram_depot', 3], ['bus_depot', 3], ['taxi_depot', 2], ['parking', 6], ['metro_hub', 2], ['research', 1], ['elderly_care', 3], ['policehq', 1], ['firehq', 1], ['university', 2], ['highschool', 4], ['hospital', 3], ['disaster_center', 1]];
  for (const [k, n] of hubs) {
    if (!BUILDINGS[k] || !g.isUnlocked(k) || (bot.count[k] || 0) >= n) continue;
    const r = k === 'airport' ? bot.placeNear(k, cx, cy, 60, { avoid: 2 }) : bot.placeNear(k, cx + ((bot.count[k] || 0) * 9) % 19 - 9, cy + ((bot.count[k] || 0) * 7) % 15 - 7, 30);
    if (r) log(`baut ${BUILDINGS[k].name}`);
  }
  for (let k = 0; k < 3 && (bot.count.ferry_pier || 0) < 2; k++) if (bot.shorePlace('ferry_pier', cx, cy, { maxDist: 50 })) log('Fähranleger');
}
// Straßenbahn: zwei Linien quer durch die dichtesten Viertel
function trams() {
  const TS = g.ext.transport;
  if (!TS || !g.isUnlocked('tram_depot') || !bot.count.tram_depot) return;
  const have = TS.lines.filter((l) => l.mode === 'tram').length;
  if (have >= 4) return;
  const W = g.W, [cx, cy] = center();
  const cand = [];
  for (let i = 0; i < g.N; i++) {
    if (!g.road[i] || g.road[i] === R.HIGHWAY || TPS.canStop(g, i, 'tram')) continue;
    cand.push({ i, x: i % W, y: (i / W) | 0 });
  }
  if (cand.length < 10) return;
  // Gerade Achse durch die Mitte (waagrecht, senkrecht, diagonal je nach Linie)
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  const [dx, dy] = dirs[have % 4];
  const stops = [];
  for (let s = -36; s <= 36; s += 6) {
    const tx = cx + dx * s, ty = cy + dy * s;
    const c = cand.filter((c) => Math.hypot(c.x - tx, c.y - ty) < 3.5).sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty))[0];
    if (c && !stops.includes(c)) stops.push(c);
  }
  if (stops.length < 3) return;
  const r = TPS.createLine(g, 'tram', stops.map((c) => c.i), false);
  if (r && r.ok) { TPS.setVehicles(g, r.line.id, 4); log(`Straßenbahnlinie ${have + 1} (${stops.length} Halte)`); }
  else if (r) log(`Straßenbahn nicht möglich: ${r.msg}`);
}

const t0 = Date.now();
for (let d = 1; d <= days; d++) {
  bot.daily();
  // Unbegrenztes Geld: mehr Blöcke pro Tag, solange Nachfrage da ist
  for (let k = 0; k < 5; k++) bot.expand();
  if (d % 3 === 0) bot.services();
  if (d % 4 === 0 && d >= 24) bridges();
  bigPower(); bigPower(); bigWater(); bigWater();
  if (d % 6 === 0) placeAnywhere('airport');
  if (d % 10 === 0 && d >= 80) metroGrid();
  for (let k = 0; k < 3 && bot.water(); k++);
  for (let k = 0; k < 4 && bot.garbage(); k++);
  bigSewage();
  if (d % 2 === 0) for (let k = 0; k < 3 && bot.gap('garbage', g.isUnlocked('recycling') ? 'recycling' : 'incinerator', 0.6, { avoid: 3, r: 10 }); k++);
  if (d % 5 === 0 && g.milestone >= 3) landmarks();
  if (d % 7 === 0) trams();
  if (g.money < RICH / 2) g.money = RICH;
  runDay(g);
  if (d % 20 === 0) {
    const T = g.transit;
    const lvl = [0, 0, 0, 0, 0, 0]; for (const b of g.buildings.values()) if (b.zone) lvl[b.level]++;
    log(`Stufen ${lvl.slice(1).join('/')} · frei Zonen ${[1, 2, 3, 4].map((z) => g.zoneFree[z].size).join('/')} · Nachfrage ${[1, 2, 3, 4].map((z) => Math.round(g.demand[z])).join('/')}`);
    log(`Einwohner ${g.stats.pop} · Gebäude ${g.buildings.size} · Meilenstein ${g.milestone} · U-Bahn ${T.lines.length} Linien / ${T.trains.length} Züge · Busse/Trams ${(g.ext.transport?.lines || []).length} · Glück ${Math.round(g.stats.happiness)} · Saldo ${Math.round(g.budget().net)} € · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
}
landmarks();
metroGrid();

// Bis in den Sommer weiterleben lassen (schöne Ansicht beim Laden), dann auf 10:30 Uhr vorspulen
for (let k = 0; k < 120 && !(g.ext.weather && g.ext.weather.season === 'summer' && g.ext.weather.seasonT > 0.25); k++) { bot.daily(); runDay(g); if (g.money < RICH / 2) g.money = RICH; }
const target = Math.floor(g.time / DAY) * DAY + DAY + 10.5 * 60;
while (g.time < target) g.update(0.1);

// Ungeklärte Abwasserauslässe der Anfangszeit abreißen (die Kläranlagen übernehmen), dann neu rechnen lassen
const S0 = g.ext.citizens && g.ext.citizens.stats;
const outlets = [...g.buildings.values()].filter((b) => b.key === 'sewage_outlet');
if (outlets.length && S0 && S0.sewageCap - outlets.length * BUILDINGS.sewage_outlet.sewage > S0.sewageDemand * 1.2) {
  for (const b of outlets) g.bulldoze([b.y * g.W + b.x]);
  log(`${outlets.length} Abwasserauslässe abgerissen`);
  for (let k = 0; k < 2; k++) runDay(g);
  while (g.time % DAY < 10.5 * 60 || g.time % DAY > 10.6 * 60) g.update(0.1);
}

// Kasse: viel Geld, Einnahmen echt aus Steuern; keine offenen Dialoge
g.money = 25_000_000;
g.loans = [];
g.pendingCards = null; g.pendingEvent = null;
g.speed = 1;

const lv = {};
for (const b of g.buildings.values()) if (b.zone) lv[b.level] = (lv[b.level] || 0) + 1;
const T = g.transit;
const data = g.serialize();
// Züge gleichmäßig über jede Linie verteilen (Umlauf: Hinfahrt, dann Rückfahrt) und Stationen leeren:
// Beim Laden fährt die U-Bahn im sauberen Takt los
for (const l of data.transit.lines) {
  const ts = data.transit.trains.filter((t) => t.line === l.id), n = l.stops.length, C = l.loop ? n : 2 * (n - 1);
  ts.forEach((t, i) => { const p = Math.round((i * C) / ts.length) % C; if (l.loop || p < n - 1) { t.cur = p; t.dir = 1; } else { t.cur = C - p; t.dir = -1; } t.pax = []; });
}
for (const st of data.transit.stations) { st.waiting = []; st.over = 0; st.penaltyUntil = 0; }
if (Array.isArray(data.news)) data.news = data.news.filter((n) => !/überfüllt/.test(n.text || ''));
const txt = JSON.stringify(data);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, txt);
console.log(`\nMegastadt: ${g.stats.pop} Einwohner · ${g.buildings.size} Gebäude · Stufen ${JSON.stringify(lv)} · U-Bahn ${T.lines.length} Linien / ${T.trains.length} Züge / ${T.stations.size} Stationen · Bus/Tram ${(g.ext.transport?.lines || []).length} Linien · Glück ${Math.round(g.stats.happiness)} · Saldo ${Math.round(g.budget().net)} €/Tag · Tag ${g.day()} ${g.ext.weather?.season}`);
console.log(`Gespeichert: ${out} (${(txt.length / 1e6).toFixed(2)} MB) · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
