// Baut automatisch eine kleine Beispielstadt (Hintergrund des Hauptmenüs, Tests).
import { R, Z, T, BUILDINGS } from '../config.js';

// Setzt ein Gebäude, das am Wasser stehen muss (Abwasserauslass, Kläranlage), möglichst nah an (cx, cy).
// Prüft zuerst Grundstück samt Drehung und Wasserkante, sucht dann per Breitensuche den kürzesten Weg zum Straßennetz
// und baut die Zufahrt erst, wenn alles passt. Gibt true zurück, wenn es geklappt hat.
export function placeAtShore(g, key, cx, cy, maxDist = 40) {
  const W = g.W, H = g.H, ter = g.world.terrain;
  const def = BUILDINGS[key];
  if (!def) return false;
  const [w0, h0] = def.size || [1, 1];
  const dry = (i) => ter[i] !== T.WATER && ter[i] !== T.ROCK && !g.bld[i] && !g.stationAt[i];
  const cands = [];
  for (let y = 2; y < H - 3; y++) for (let x = 2; x < W - 3; x++) {
    const d = Math.abs(x - cx) + Math.abs(y - cy);
    if (d > maxDist) continue;
    for (const rot of w0 === h0 ? [0] : [0, 1]) {
      const [w, h] = rot ? [h0, w0] : [w0, h0];
      let ok = true, wet = false;
      for (let yy = y; yy < y + h && ok; yy++) for (let xx = x; xx < x + w; xx++) { const i = yy * W + xx; if (!dry(i) || g.road[i]) { ok = false; break; } }
      if (!ok) continue;
      for (let yy = y - 1; yy <= y + h && !wet; yy++) for (let xx = x - 1; xx <= x + w; xx++) {
        const corner = (xx === x - 1 || xx === x + w) && (yy === y - 1 || yy === y + h);
        if (!corner && (xx < x || xx >= x + w || yy < y || yy >= y + h) && ter[yy * W + xx] === T.WATER) { wet = true; break; }
      }
      if (wet) cands.push([d + (g.zone[y * W + x] ? 3 : 0), x, y, rot, w, h]);
    }
  }
  cands.sort((a, b) => a[0] - b[0]);
  for (const [, x, y, rot, w, h] of cands.slice(0, 60)) {
    if (!g.checkPlace(key, x, y, rot)) { if (g.placeBuilding(key, x, y, rot).ok) return true; continue; }
    // Kürzester Weg über trockenes, freies Land vom Grundstücksrand zum Straßennetz der Stadt
    const prev = new Int32Array(g.N).fill(-2), q = [];
    for (let yy = y - 1; yy <= y + h; yy++) for (let xx = x - 1; xx <= x + w; xx++) {
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const corner = (xx === x - 1 || xx === x + w) && (yy === y - 1 || yy === y + h);
      if (corner || (xx >= x && xx < x + w && yy >= y && yy < y + h)) continue;
      const i = yy * W + xx;
      if (dry(i) && !g.road[i]) { prev[i] = -1; q.push(i); }
    }
    let hit = -1;
    for (let qi = 0; qi < q.length && hit < 0 && qi < 4000; qi++) {
      const i = q[qi], xx = i % W, yy = (i / W) | 0;
      for (const j of [i - 1, i + 1, i - W, i + W]) {
        const jx = j % W, jy = (j / W) | 0;
        if (j < 0 || j >= g.N || Math.abs(jx - xx) + Math.abs(jy - yy) !== 1) continue;
        if (jx >= x && jx < x + w && jy >= y && jy < y + h) continue;
        if (g.road[j] && g.road[j] !== R.HIGHWAY && g.roadComp[j] === g.outsideComp) { hit = i; break; }
        if (prev[j] !== -2 || !dry(j) || g.road[j]) continue;
        prev[j] = i; q.push(j);
      }
    }
    if (hit < 0) continue;
    const path = [];
    for (let i = hit; i >= 0; i = prev[i]) path.push(i);
    if (path.length > 30 || !g.buildRoad(path, R.STREET).ok) continue;
    if (g.placeBuilding(key, x, y, rot).ok) return true;
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
  place('landfill', x0 + 29, hy - 13);
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
