// Baut automatisch eine kleine Beispielstadt (Hintergrund des Hauptmenüs, Tests).
import { R, Z } from '../config.js';

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
