// Leistungsmessung der Simulation ohne Browser: baut eine dicht bebaute Großstadt und misst die Rechenzeit pro Spieltag.
//   node tools/bench.mjs [--size 128] [--days 3] [--map river] [--seed 9] [--profile] [--top 25]
// Ausgabe: ms pro Spieltag gesamt, aufgeteilt nach Kern-Phasen und System-Hooks; mit --profile zusätzlich die
// teuersten Funktionen (Eigenzeit) aus dem V8-Profiler.
import { Session } from 'node:inspector/promises';
import { Game } from '../src/sim/game.js';
import { R, Z, T, BUILDINGS } from '../src/config.js';
import { SYSTEMS } from '../src/registry.js';
import * as TPS from '../src/sim/systems/transport.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));
const size = +(args.size || 128), days = +(args.days || 3), seed = +(args.seed || 9), top = +(args.top || 25);
const now = () => performance.now();

// ---------- Großstadt bauen
export function buildBigCity(g) {
  const W = g.W, H = g.H, ter = g.world.terrain;
  const ok = (i) => ter[i] !== T.WATER && ter[i] !== T.ROCK;
  const hy = g.world.highwayY, x0 = g.world.highwayEnd % W + 1;
  // Raster: Hauptachse als Allee, alle 6 Felder Straßen
  for (let x = x0; x < W - 2; x++) g.buildRoad([hy * W + x], R.AVENUE);
  for (let y = 3; y < H - 3; y += 6) for (let x = x0; x < W - 3; x++) { const i = y * W + x; if (ok(i) || g.road[i]) g.buildRoad([i], y === hy ? R.AVENUE : R.STREET); }
  for (let x = x0 + 2; x < W - 3; x += 6) for (let y = 3; y < H - 3; y++) { const i = y * W + x; if (ok(i) || g.road[i]) g.buildRoad([i], R.STREET); }
  // Dienste und Versorgung über die Karte verteilt
  const place = (key, x, y) => {
    for (let d = 0; d < 6; d++) for (const [ox, oy] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, -d]]) {
      if (g.placeBuilding(key, x + ox, y + oy).ok) return true;
    }
    return false;
  };
  let svc = 0;
  for (let y = 6; y < H - 6; y += 18) for (let x = x0 + 4; x < W - 6; x += 18) {
    for (const k of ['police', 'fire', 'clinic', 'school', 'park', 'watertower', 'landfill', 'coal'].filter((k) => BUILDINGS[k])) if (place(k, x + (svc++ % 5), y + (svc % 4))) { /* ok */ }
  }
  for (const k of ['hospital', 'university', 'stadium', 'townhall', 'cemetery', 'kindergarten', 'sewage_outlet', 'bus_depot', 'tram_depot', 'cargo_rail']) if (BUILDINGS[k]) place(k, x0 + 20, hy + 9);
  // Zonen: Blöcke abwechselnd Wohnen / Gewerbe / Industrie / Büro
  const tiles = [[], [], [], [], []];
  for (let y = 1; y < H - 1; y++) for (let x = x0; x < W - 1; x++) {
    const i = y * W + x;
    if (g.road[i] || g.bld[i] || !ok(i)) continue;
    const bx = Math.floor((x - x0) / 12), by = Math.floor(y / 12);
    const z = [Z.RES, Z.RES, Z.COM, Z.RES, Z.IND, Z.OFF][(bx * 7 + by * 3) % 6];
    tiles[z].push(i);
  }
  for (let z = 1; z <= 4; z++) g.zoneTiles(tiles[z], z);
  // Alle freien Zonenfelder bebauen (fertig, belegt, Stufe 1–4)
  let n = 0;
  for (let z = 1; z <= 4; z++) for (const t of g.zoneFreeArray(z).slice()) {
    if (g.bld[t] || g.access[t] < 0) continue;
    const b = g.spawnZoneBuilding(t, z, 1, 1);
    if (!b) continue;
    b.construct = 1;
    g.setBuildingLevel(b, 1 + ((t * 2654435761) >>> 0) % 4);
    b.occ = z === Z.RES ? b.cap : 0;
    b.happy = 60;
    n++;
  }
  g.dirty.util = g.dirty.coverage = true;
  // Ein paar Bus- und Tramlinien
  const stops = [];
  for (let y = 3; y < H - 3 && stops.length < 40; y += 6) for (let x = x0 + 5; x < W - 4; x += 9) {
    const i = y * W + x; if (g.road[i] === R.STREET && !TPS.canStop(g, i, 'bus')) stops.push(i);
  }
  let lines = 0;
  for (let k = 0; k + 4 < stops.length; k += 5) if (TPS.createLine(g, k % 10 ? 'bus' : 'tram', stops.slice(k, k + 5)).ok) lines++;
  return { buildings: n, lines };
}

// ---------- Messen
if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = now();
  const g = new Game({ size, seed, mapType: args.map || 'river', difficulty: 'sandbox', name: 'Messstadt' });
  g.on('cards', (ids) => g.chooseCard(ids[0]));
  g.on('event', () => g.resolveEvent(0));
  const info = buildBigCity(g);
  const tBuild = now() - t0;
  // Zeitmessung: Kern-Phasen und System-Hooks umwickeln
  const acc = new Map();
  const wrap = (obj, name, label) => {
    const f = obj[name];
    if (typeof f !== 'function') return;
    obj[name] = function (...a) { const s = now(); try { return f.apply(this, a); } finally { acc.set(label, (acc.get(label) || 0) + now() - s); } };
  };
  for (const s of SYSTEMS) for (const h of ['step', 'hourly', 'daily', 'weekly']) wrap(s, h, `sys:${s.id}.${h}`);
  for (const h of ['hourly', 'daily', 'weekly', 'simStep']) wrap(g, h, `core:${h}`);
  wrap(g.traffic, 'update', 'core:traffic.update');
  wrap(g.traffic, 'hourly', 'core:traffic.hourly');
  wrap(g.transit, 'update', 'core:transit.update');
  wrap(g.transit, 'hourly', 'core:transit.hourly');
  // Aufwärmen: ein Tag
  for (let k = 0; k < 300; k++) g.update(0.1);
  acc.clear();
  let session = null;
  if (args.profile) { session = new Session(); session.connect(); await session.post('Profiler.enable'); await session.post('Profiler.setSamplingInterval', { interval: 200 }); await session.post('Profiler.start'); }
  g.speed = 1;
  const tS = now();
  const d0 = g.day();
  let frames = 0;
  while (g.day() < d0 + days) { g.update(0.1); frames++; if (g.blocking) { g.pendingCards = null; g.pendingEvent = null; } }
  const tTot = now() - tS;
  console.log(`Karte ${size}² (${args.map || 'river'}) · ${g.buildings.size} Gebäude (${info.buildings} Zonen) · ${info.lines} Linien · ${Math.round(g.stats.pop)} Einw. · Aufbau ${Math.round(tBuild)} ms`);
  console.log(`Rechenzeit: ${(tTot / days).toFixed(0)} ms pro Spieltag (${days} Tage, ${frames} Bilder, ${(tTot / frames).toFixed(2)} ms pro Bild bei 1×)`);
  const rows = [...acc.entries()].sort((a, b) => b[1] - a[1]);
  for (const [k, v] of rows.slice(0, 30)) if (v / days >= 0.5) console.log(`  ${k.padEnd(34)} ${(v / days).toFixed(1).padStart(8)} ms/Tag`);
  if (session) {
    const { profile } = await session.post('Profiler.stop');
    const self = new Map();
    const dt = profile.timeDeltas; const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    const count = new Map();
    for (const id of profile.samples) count.set(id, (count.get(id) || 0) + 1);
    const total = profile.samples.length;
    for (const [id, c] of count) {
      const n = byId.get(id); const cf = n.callFrame;
      const key = `${cf.functionName || '(anonym)'} ${cf.url.replace(/^.*\/src\//, '')}:${cf.lineNumber + 1}`;
      self.set(key, (self.get(key) || 0) + c);
    }
    void dt;
    console.log(`Profil (Eigenzeit, ${total} Proben):`);
    for (const [k, c] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, top)) console.log(`  ${(100 * c / total).toFixed(1).padStart(5)} %  ${k}`);
    // Gesamtzeit (inklusive Aufrufe) der Kernfunktionen in sim/*.js
    const parent = new Map();
    for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
    const incl = new Map();
    for (const [id, c] of count) {
      const seen = new Set();
      for (let p = id; p !== undefined; p = parent.get(p)) {
        const cf = byId.get(p).callFrame;
        if (!/\/src\/sim\/[a-z]+\.js$/.test(cf.url)) continue;
        const key = `${cf.functionName || '(anonym)'} ${cf.url.replace(/^.*\/src\//, '')}:${cf.lineNumber + 1}`;
        if (seen.has(key)) continue;
        seen.add(key);
        incl.set(key, (incl.get(key) || 0) + c);
      }
    }
    console.log('Kern inklusive Aufrufe:');
    for (const [k, c] of [...incl.entries()].sort((a, b) => b[1] - a[1]).slice(0, top)) console.log(`  ${(100 * c / total).toFixed(1).padStart(5)} %  ${(tTot / days * c / total).toFixed(0).padStart(5)} ms/Tag  ${k}`);
  }
}
