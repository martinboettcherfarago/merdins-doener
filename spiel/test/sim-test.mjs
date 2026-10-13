// Headless-Test: baut automatisch eine Stadt und simuliert einige Wochen.
import { Game } from '../src/sim/game.js';
import { R, Z } from '../src/config.js';
import { placeAtShore } from '../src/sim/demo.js';

const days = +(process.argv[2] || 60);
const mapType = process.argv[3] || 'river';
const g = new Game({ size: 96, seed: 4242, mapType, difficulty: 'normal', name: 'Teststadt' });
const W = g.W;
const hy = g.world.highwayY;
const idx = (x, y) => y * W + x;
let errs = 0;
g.on('cards', (ids) => { g.chooseCard(ids[0]); });
g.on('event', () => { g.resolveEvent(1); });
g.on('bankrupt', () => { console.log('BANKROTT'); });

function road(x0, y0, x1, y1, t = R.STREET) {
  const tiles = [];
  if (y0 === y1) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) tiles.push(idx(x, y0));
  else for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) tiles.push(idx(x0, y));
  for (const t1 of tiles) { const r = g.buildRoad([t1], t); }
}
function zone(x0, y0, x1, y1, z) {
  const tiles = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < W && y < W) tiles.push(idx(x, y));
  g.zoneTiles(tiles, z);
}
function place(key, x, y) {
  const r = g.placeBuilding(key, x, y);
  if (!r.ok) { // in der Nähe probieren
    for (let d = 1; d < 8; d++) for (const [ox, oy] of [[d,0],[-d,0],[0,d],[0,-d],[d,d],[-d,-d],[d,-d],[-d,d]]) {
      const r2 = g.placeBuilding(key, x + ox, y + oy);
      if (r2.ok) return r2;
    }
    console.log('  platzieren fehlgeschlagen:', key, r.msg);
  }
  return r;
}

function station(x, y) {
  for (let d = 0; d < 6; d++) for (const [ox, oy] of [[0,0],[d,0],[-d,0],[0,d],[0,-d]]) {
    const r = g.placeBuilding('station', x + ox, y + oy);
    if (r.ok) return r.station;
  }
  console.log('  Station fehlgeschlagen', x, y);
  return null;
}
// Hauptachse und Querstraßen
road(6, hy, 46, hy);
for (let x = 9; x <= 45; x += 5) { road(x, hy - 12, x, hy + 12); }
road(9, hy - 12, 45, hy - 12); road(9, hy + 12, 45, hy + 12);
road(9, hy - 6, 45, hy - 6); road(9, hy + 6, 45, hy + 6);
console.log('Straßen gebaut. Geld:', Math.round(g.money), 'Komponenten', g.compCount, 'outside', g.outsideComp);
place('landfill', 24, hy + 13);
zone(10, hy - 11, 28, hy - 1, Z.RES);
zone(10, hy + 1, 22, hy + 11, Z.COM);
zone(31, hy + 1, 44, hy + 11, Z.IND);
zone(29, hy - 11, 44, hy - 1, Z.RES);
place('coal', 40, hy + 13);
place('watertower', 8, hy - 3);
place('watertower', 8, hy + 3);
console.log('Start-Infrastruktur. Geld:', Math.round(g.money));

let builtServices = false, builtTransit = false, built2 = false, builtCem = false;
const t0 = Date.now();
for (let d = 1; d <= days; d++) {
  for (let s = 0; s < 30 * 10; s++) g.update(0.1); // 30 Sekunden = 1 Tag
  const st = g.stats;
  if (!builtServices && g.milestone >= 1) {
    builtServices = true;
    place('police', 20, hy - 5); place('fire', 30, hy + 5); place('clinic', 15, hy + 7); place('school', 24, hy - 8);
    place('park', 12, hy - 4); place('park', 34, hy - 4);
    place('wind', 46, hy - 8); place('watertower', 46, hy - 4);
    console.log('  Abwasserauslass:', placeAtShore(g, 'sewage_outlet', 27, hy) || placeAtShore(g, 'sewage_outlet', 27, hy, 80));
    place('kindergarten', 18, hy - 3);
  }
  if (!builtCem && g.milestone >= 2) {
    builtCem = true;
    place('cemetery', 36, hy - 9); place('landfill', 8, hy + 9);
    console.log('  Kläranlage:', placeAtShore(g, 'sewage_plant', 27, hy, 80));
  }
  if (!builtTransit && g.isUnlocked('transit') && g.money > 9000) {
    // Erst bauen, wenn genug Geld da ist (Stationen + Linie)
    builtTransit = true;
    const a = station(12, hy), b = station(26, hy), c = station(40, hy), e = station(26, hy - 10);
    if (a && b && c) console.log('  Linie:', JSON.stringify(g.createLine([a.id, b.id, c.id], false)));
    if (e && b) console.log('  Linie2:', g.createLine([e.id, b.id], false).ok);
    zone(10, hy - 20, 44, hy - 13, Z.OFF);
    road(9, hy - 18, 45, hy - 18);
  }
  if (!built2 && g.milestone >= 3) {
    built2 = true;
    place('coal', 40, hy + 16);
    place('watertower', 47, hy + 8); place('watertower', 47, hy + 10);
    place('hospital', 30, hy - 15);
  }
  if (d % 5 === 0 || d === days) {
    const b = g.lastBudget;
    console.log(`Tag ${String(d).padStart(3)} Einw ${String(st.pop).padStart(5)} Jobs ${Math.round(st.jobs)} AL ${(st.unemployment*100).toFixed(0)}% Glück ${st.happiness.toFixed(0)} Geld ${Math.round(g.money)} Bilanz/Tag ${Math.round(b.net)} Nachfr W${g.demand[1].toFixed(0)} G${g.demand[2].toFixed(0)} I${g.demand[3].toFixed(0)} B${g.demand[4].toFixed(0)} Strom ${Math.round(g.util.powerDemand)}/${Math.round(g.util.powerSupply)} Wasser ${Math.round(g.util.waterDemand)}/${Math.round(g.util.waterSupply)} MS ${g.milestone} Autos ${g.traffic.cars.length} Fluss ${(st.trafficFlow*100).toFixed(0)}% Fahrg ${st.ridersToday} Geb ${g.buildings.size} verl ${st.abandoned}`);
  }
}
console.log('Laufzeit', ((Date.now() - t0) / 1000).toFixed(1), 's');
// Level-Verteilung
const lv = {};
for (const b of g.buildings.values()) if (b.zone) lv[b.zone + ':' + b.level] = (lv[b.zone + ':' + b.level] || 0) + 1;
console.log('Stufen', lv);
console.log('Budget', JSON.stringify(g.lastBudget, (k, v) => typeof v === 'number' ? Math.round(v) : v));
// Speichern/Laden-Rundreise
const data = JSON.stringify(g.serialize());
const g2 = Game.fromSave(JSON.parse(data));
console.log('Save-Größe', (data.length / 1024).toFixed(0), 'KB; geladen: Einw', g2.stats.pop, 'Geb', g2.buildings.size, 'Linien', g2.transit.lines.length);
for (let s = 0; s < 300; s++) g2.update(0.1);
console.log('nach Laden 1 Tag: Einw', g2.stats.pop);
console.log('News', g.newsLog.slice(-6).map(n => n.author + ': ' + n.text).join('\n'));
import { happinessFactors } from '../src/sim/services.js';
const agg = {}; let nres = 0;
for (const b of g.buildings.values()) {
  if (b.zone !== 1 || b.abandoned) continue;
  nres++;
  const out = []; happinessFactors(g, b, out);
  for (const [l, v] of out) agg[l] = (agg[l] || 0) + v;
}
console.log('Ø Glücksfaktoren Wohnen:', Object.entries(agg).map(([l, v]) => `${l} ${(v / nres).toFixed(1)}`).join(', '));
