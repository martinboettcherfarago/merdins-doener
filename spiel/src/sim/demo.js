// Baut automatisch eine kleine Beispielstadt (Hintergrund des Hauptmenüs, Tests).
import { R, Z, T } from '../config.js';

// Setzt ein Gebäude, das am Wasser stehen muss (Abwasserauslass, Kläranlage), möglichst nah an (cx, cy)
// und führt eine Straße von dort zur Stadt. Gibt true zurück, wenn es geklappt hat.
export function placeAtShore(g, key, cx, cy, maxDist = 40) {
  const W = g.W, H = g.H, ter = g.world.terrain;
  const cands = [];
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const i = y * W + x;
    if (ter[i] === T.WATER || ter[i] === T.ROCK || g.road[i] || g.bld[i]) continue;
    if (![i - 1, i + 1, i - W, i + W].some((j) => ter[j] === T.WATER)) continue;
    const d = Math.abs(x - cx) + Math.abs(y - cy);
    if (d <= maxDist) cands.push([d, x, y]);
  }
  cands.sort((a, b) => a[0] - b[0]);
  const dry = (x, y) => x >= 0 && y >= 0 && x < W && y < H && ter[y * W + x] !== T.WATER && ter[y * W + x] !== T.ROCK && !g.bld[y * W + x];
  for (const [, bx, by] of cands.slice(0, 40)) {
    // Zufahrt: ein trockenes Nachbarfeld des Bauplatzes, dann L-Weg zurück zur Stadt
    for (const [nx, ny] of [[bx + 1, by], [bx - 1, by], [bx, by + 1], [bx, by - 1]]) {
      if (!dry(nx, ny)) continue;
      const path = [];
      const sx = Math.sign(cx - nx), sy = Math.sign(cy - ny);
      let x = nx, y = ny, ok = true;
      path.push(y * W + x);
      while (y !== cy) { y += sy; if (!dry(x, y) && !g.road[y * W + x]) { ok = false; break; } path.push(y * W + x); }
      while (ok && x !== cx) { x += sx; if (!dry(x, y) && !g.road[y * W + x]) { ok = false; break; } path.push(y * W + x); }
      if (!ok || path.includes(by * W + bx)) continue;
      const fresh = path.filter((i) => !g.road[i]);
      if (fresh.length && !g.buildRoad(fresh, R.STREET).ok) continue;
      if (g.placeBuilding(key, bx, by).ok) return true;
    }
  }
  return false;
}

export function buildDemoCity(g) {
  const W = g.W;
  const hy = g.world.highwayY;
  const x0 = g.world.highwayEnd % W + 1;
  const idx = (x, y) => y * W + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < g.H;
  const road = (ax, ay, bx, by, t = R.STREET) => {
    if (ay === by) for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) { if (inb(x, ay)) g.buildRoad([idx(x, ay)], t); }
    else for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) { if (inb(ax, y)) g.buildRoad([idx(ax, y)], t); }
  };
  const zone = (ax, ay, bx, by, z) => {
    const tiles = [];
    for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) if (inb(x, y)) tiles.push(idx(x, y));
    g.zoneTiles(tiles, z);
  };
  const place = (key, x, y) => {
    for (let d = 0; d < 7; d++) for (const [ox, oy] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, -d]]) {
      if (g.placeBuilding(key, x + ox, y + oy).ok) return true;
    }
    return false;
  };
  const len = Math.min(34, W - x0 - 4);
  road(x0, hy, x0 + len, hy, R.AVENUE);
  for (let x = x0 + 3; x <= x0 + len; x += 5) road(x, hy - 11, x, hy + 11);
  for (const dy of [-11, -6, 6, 11]) road(x0 + 3, hy + dy, x0 + len, hy + dy);
  place('coal', x0 + len - 6, hy + 12);
  place('watertower', x0 + 2, hy - 2);
  place('watertower', x0 + 2, hy + 2);
  place('landfill', x0 + 9, hy + 7);
  place('landfill', x0 + 29, hy + 7);
  zone(x0 + 4, hy - 10, x0 + 20, hy - 1, Z.RES);
  zone(x0 + 4, hy + 1, x0 + 14, hy + 10, Z.COM);
  zone(x0 + 16, hy + 1, x0 + len, hy + 10, Z.IND);
  zone(x0 + 22, hy - 10, x0 + len, hy - 1, Z.RES);
  place('police', x0 + 14, hy - 5);
  place('fire', x0 + 24, hy + 5);
  place('clinic', x0 + 9, hy + 7);
  place('school', x0 + 18, hy - 8);
  place('park', x0 + 6, hy - 4);
  place('park', x0 + 27, hy - 4);
  place('plaza', x0 + 11, hy + 2);
  place('wind', x0 + len + 2, hy - 6);
  place('wind', x0 + len + 2, hy - 9);
  // Abwasser, Friedhof und Bildung, damit die Bürger-Simulation (Kanal, Bestattung, Schulen) nicht klagt
  if (!placeAtShore(g, 'sewage_outlet', x0 + Math.floor(len / 2), hy)) placeAtShore(g, 'sewage_outlet', x0 + Math.floor(len / 2), hy, 80);
  place('cemetery', x0 + 33, hy - 8);
  place('kindergarten', x0 + 26, hy - 8);
  if (g.sandbox) {
    // Im Sandkasten reichlich Versorgung, damit die Vorschau-Stadt gesund wächst
    place('coal', x0 + len - 14, hy + 12);
    for (const [dx, dy] of [[2, -6], [2, 6], [2, -9], [2, 9], [len + 2, -3], [len + 2, 3]]) place('watertower', x0 + dx, hy + dy);
    place('hospital', x0 + 15, hy - 8);
  }
}

// Simuliert schnell eine Anzahl Tage (in Häppchen aufrufen, um die Oberfläche nicht zu blockieren).
export function fastForward(g, steps) {
  for (let k = 0; k < steps; k++) g.update(0.1);
}
