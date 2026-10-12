// Gärten und Vorgärten für Wohnhäuser (Besitzer G3). Setzt Rasen, Wege, Einfahrt, Einfriedung, Terrasse,
// Bäume, Büsche und Gartenausstattung passend um ein Haus auf ein Grundstück.
import { M } from './kit.js';
import { rr, rpick, chance } from './rescom_geo.js';
import { ground, tree, conifer, bush, hedge, fence, gate, carport, garage, shed, terrace, pool, play, bins, flowerBed, car, CAR_COLORS } from './rescom_site.js';

// plot: { W, D } in Welteinheiten (Mitte 0/0, Straße bei +D/2)
// h: { x, z, w, d, doorU } Hauptbaukörper; o: { drive: 'carport'|'garage'|'open'|null, driveSide: -1|1, fence, … }
export function garden(g, plot, h, o = {}) {
  const { W, D } = plot;
  const rng = g.rng, det = g.detail;
  const front = D / 2;
  const hFront = h.z + h.d / 2, hBack = h.z - h.d / 2;
  const left = -W / 2, right = W / 2;
  ground(g, o.lawn || 'grass', 0, 0, W - 0.04 * M, D - 0.04 * M, 0.03 * M);
  // Weg zur Haustür
  const doorX = h.x + (h.doorU || 0);
  const pathW = o.pathW ?? 1.3 * M;
  if (front - hFront > 0.2 * M) ground(g, o.pathMat || 'pavers', doorX, (front + hFront) / 2 + 0.1 * M, pathW, front - hFront - 0.2 * M, 0.05 * M);
  // Einfahrt
  let driveX = null;
  if (o.drive) {
    const side = o.driveSide ?? (h.x <= 0 ? 1 : -1);
    const freeL = side > 0 ? right - (h.x + h.w / 2) : (h.x - h.w / 2) - left;
    const dw = Math.min(o.driveW ?? 3.2 * M, freeL - 0.3 * M);
    if (dw > 2.4 * M) {
      driveX = side > 0 ? right - 0.2 * M - dw / 2 : left + 0.2 * M + dw / 2;
      const dz1 = front, dz0 = Math.max(-D / 2 + 0.3 * M, hBack + (o.drive === 'open' ? h.d * 0.5 : 0));
      ground(g, o.driveMat || 'pavers', driveX, (dz0 + dz1) / 2, dw, dz1 - dz0, 0.05 * M);
      const cz = Math.min(hFront - 2.8 * M, front - 3.2 * M);
      if (o.drive === 'carport') carport(g, driveX, Math.max(dz0 + 2.8 * M, cz), dw - 0.2 * M, 5.4 * M, { mat: o.carportMat });
      else if (o.drive === 'garage') garage(g, driveX, Math.max(dz0 + 3.0 * M, cz - 0.4 * M), Math.min(dw, 3.0 * M), 6.0 * M, { wall: o.garageWall || 'plaster_white', door: o.garageDoor });
      else if (o.drive === 'open' && det >= 1 && chance(rng, 0.8)) car(g, driveX, front - 3.0 * M, Math.PI / 2 * (chance(rng, 0.5) ? 1 : -1), rpick(rng, CAR_COLORS));
    }
  }
  // Einfriedung vorne (mit Lücken für Weg und Einfahrt)
  const fz = front - 0.12 * M;
  const gaps = [[doorX - pathW / 2 - 0.05 * M, doorX + pathW / 2 + 0.05 * M]];
  if (driveX !== null) gaps.push([driveX - 1.7 * M, driveX + 1.7 * M]);
  gaps.sort((a, b) => a[0] - b[0]);
  const ft = o.fence ?? rpick(rng, ['picket', 'hedge', 'metal', 'wall', 'hedge', 'none']);
  let x = left + 0.1 * M;
  const segs = [];
  for (const [a, b] of gaps) { if (a - x > 0.3 * M) segs.push([x, a]); x = Math.max(x, b); }
  if (right - 0.1 * M - x > 0.3 * M) segs.push([x, right - 0.1 * M]);
  for (const [a, b] of segs) {
    if (ft === 'hedge') hedge(g, (a + b) / 2, fz - 0.15 * M, b - a, 0.5 * M, o.hedgeH ?? 0.9 * M);
    else if (ft !== 'none') fence(g, a, fz, b, fz, ft, { mat: o.fenceMat, h: ft === 'wall' ? 0.6 * M : 0.95 * M });
  }
  if (det >= 2 && ft !== 'none' && o.gate !== false) gate(g, doorX, fz, { mat: ft === 'wall' ? 'stone_grey' : 'concrete', mailbox: rpick(rng, ['paint_yellow', 'metal_dark', 'paint_green']) });
  // seitliche Einfriedung (Hecke/Zaun) im hinteren Bereich
  const sideT = o.sideFence ?? rpick(rng, ['hedge', 'post', 'hedge', 'none']);
  if (sideT !== 'none' && det >= 1) {
    const z0 = -D / 2 + 0.1 * M, z1 = Math.min(hFront, front - 0.5 * M);
    for (const sx of [left + 0.15 * M, right - 0.15 * M]) {
      if (driveX !== null && Math.abs(sx - driveX) < 2.2 * M) continue;
      if (sideT === 'hedge') hedge(g, sx, (z0 + z1) / 2, 0.45 * M, z1 - z0, 1.4 * M);
      else fence(g, sx, z0, sx, z1, 'post', { h: 1.1 * M });
    }
  }
  if (det >= 1 && o.backFence !== false && D > 1.2) fence(g, left + 0.2 * M, -D / 2 + 0.12 * M, right - 0.2 * M, -D / 2 + 0.12 * M, 'post', { h: 1.2 * M });
  // Vorgarten: Büsche und Beet
  const fy = front - hFront;
  if (fy > 1.2 * M && det >= 1) {
    const bx = doorX > h.x ? h.x - h.w * 0.25 : h.x + h.w * 0.25;
    if (chance(rng, 0.6)) flowerBed(g, bx, hFront + fy * 0.45, Math.min(2.6 * M, h.w * 0.35), Math.min(1.0 * M, fy * 0.45));
    bush(g, h.x - h.w / 2 + 0.4 * M, hFront + 0.5 * M, rr(rng, 0.8, 1.2), rpick(rng, ['hedge', 'leaves_dark', 'leaves_green']));
    bush(g, h.x + h.w / 2 - 0.4 * M, hFront + 0.5 * M, rr(rng, 0.7, 1.1), rpick(rng, ['hedge', 'leaves_dark', 'leaves_light']));
    if (o.bins !== false) bins(g, doorX + (doorX > h.x ? -1 : 1) * 1.6 * M, front - 0.7 * M, 3);
  }
  // Garten hinter dem Haus
  const by = hBack - (-D / 2);
  const back = (-D / 2 + hBack) / 2;
  if (by > 2.5 * M) {
    if (o.terrace !== false) terrace(g, h.x - h.w * 0.25, hBack - 1.4 * M, Math.min(4.0 * M, h.w * 0.5), 2.6 * M, { umbrella: rpick(rng, ['canvas_white', 'awning_red', 'awning_green', null]) });
    const treeN = o.trees ?? Math.min(4, Math.max(1, Math.round((W * by) / (6 * M * 6 * M))));
    for (let k = 0; k < treeN; k++) {
      const tx = left + W * (k + 0.5) / treeN + rr(rng, -0.8, 0.8) * M;
      const tz = -D / 2 + rr(rng, 1.6, Math.min(4.0, by / M - 1.6)) * M;
      if (o.pool && Math.abs(tx - o.pool.x) < o.pool.w / 2 + 1.5 * M && Math.abs(tz - o.pool.z) < o.pool.d / 2 + 1.5 * M) continue;
      if (chance(rng, 0.25)) conifer(g, tx, tz, rr(rng, 0.8, 1.1));
      else tree(g, tx, tz, rr(rng, 0.8, 1.15));
    }
    if (o.pool) pool(g, o.pool.x, o.pool.z, o.pool.w, o.pool.d);
    if (o.shed !== false && by > 4.5 * M && chance(rng, 0.7)) shed(g, right - 1.6 * M, -D / 2 + 1.4 * M, { wall: rpick(rng, ['wood_planks', 'wood_dark', 'siding_red', 'siding_white']) });
    if (by > 4 * M) {
      const t = rpick(rng, ['trampoline', 'swing', 'sand', null, null]);
      if (t) play(g, h.x + h.w * 0.15, back + rr(rng, -0.6, 0.6) * M, t);
      if (chance(rng, 0.5)) for (let k = 0; k < 2; k++) g.box('wood_planks', left + 1.5 * M + k * 1.6 * M, 0, -D / 2 + 1.1 * M, 1.2 * M, 0.5 * M, 0.8 * M, { skip: 32 });
    }
  } else if (by > 0.8 * M && det >= 1) {
    bush(g, h.x + h.w * 0.3, (hBack - D / 2) / 2, 0.9, 'leaves_green');
    bush(g, h.x - h.w * 0.3, (hBack - D / 2) / 2, 0.8, 'hedge');
  }
  // Seitlicher Baum, wenn Platz
  const sideFree = Math.min(h.x - h.w / 2 - left, right - (h.x + h.w / 2));
  if (o.sideTree !== false && sideFree > 1.6 * M && driveX === null) tree(g, h.x > 0 ? left + sideFree / 2 : right - sideFree / 2, h.z - h.d * 0.2, rr(rng, 0.7, 0.95));
  return { driveX };
}
