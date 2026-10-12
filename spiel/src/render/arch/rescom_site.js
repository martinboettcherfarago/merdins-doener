// Grundstück & Außenanlagen für Wohnen & Gewerbe (Besitzer G3): Rasen, Wege, Hecken, Zäune, Bäume, Büsche,
// Autos, Carport, Garage, Gartenhaus, Terrasse, Pool, Spielgeräte, Mülltonnen, Fahrradständer, Parkplätze,
// Außengastronomie. Kleinteile nur bei Detail 2, Fernansicht stark vereinfacht.
import * as THREE from 'three';
import { M } from './kit.js';
import { F, NB, rr, rpick } from './rescom_geo.js';
import { rectRoof } from './rescom_roofs.js';

// Bodenbelag (flache Platte, bei Detail 0 nur Fläche)
export function ground(g, mat, x, z, sx, sz, h = 0.04 * M) {
  if (sx <= 0 || sz <= 0) return;
  if (g.detail === 0) { g.hquad(mat, x, h, z, sx, sz); return; }
  g.box(mat, x, 0, z, sx, h, sz, { skip: NB });
}

// Laubbaum: Stamm + Krone aus Ikosaedern
export function tree(g, x, z, s = 1, o = {}) {
  const D = g.detail, rng = g.rng;
  const leaf = o.leaf || rpick(rng, ['leaves_green', 'leaves_dark', 'leaves_green', 'leaves_light']);
  const th = (o.trunk ?? 2.2) * M * s;
  g.cyl('bark', x, 0, z, 0.16 * M * s, th + 0.6 * M * s, { seg: D === 0 ? 4 : 6, cap: false, rTop: 0.1 * M * s });
  const r = (o.r ?? 1.7) * M * s;
  if (D === 0) { g.geom(leaf, new THREE.IcosahedronGeometry(r, 0), { x, y: th + r * 0.8, z, sy: 0.9 }); return; }
  g.geom(leaf, new THREE.IcosahedronGeometry(r, D >= 2 ? 1 : 0), { x, y: th + r * 0.85, z, sy: 0.88, ry: rng() * 3 });
  const n = D >= 2 ? 2 : 1;
  for (let k = 0; k < n; k++) {
    const a = rng() * Math.PI * 2, rs = r * rr(rng, 0.55, 0.75);
    g.geom(leaf, new THREE.IcosahedronGeometry(rs, 0), { x: x + Math.cos(a) * r * 0.6, y: th + r * rr(rng, 0.5, 1.2), z: z + Math.sin(a) * r * 0.6, ry: rng() * 3 });
  }
}
// Nadelbaum / Säulenbaum
export function conifer(g, x, z, s = 1, o = {}) {
  const D = g.detail;
  const leaf = o.leaf || 'leaves_dark';
  g.cyl('bark', x, 0, z, 0.12 * M * s, 1.0 * M * s, { seg: 4, cap: false });
  const tiers = D === 0 ? 1 : D === 1 ? 2 : 3;
  const H = (o.h ?? 6) * M * s, R = (o.r ?? 1.4) * M * s;
  for (let k = 0; k < tiers; k++) {
    const y = 0.6 * M * s + (H * 0.8 * k) / tiers;
    const rr2 = R * (1 - k * 0.22);
    g.cyl(leaf, x, y, z, rr2, H / tiers + H * 0.25, { seg: D === 0 ? 5 : 7, rTop: 0, cap: false, bottom: true });
  }
}
export function bush(g, x, z, s = 1, mat = 'hedge') {
  if (g.detail === 0) return;
  g.geom(mat, new THREE.IcosahedronGeometry(0.6 * M * s, 0), { x, y: 0.35 * M * s, z, sy: 0.75, ry: g.rng() * 3 });
}
export function hedge(g, x, z, sx, sz, h = 1.1 * M) {
  g.box('hedge', x, 0, z, sx, h, sz, { skip: NB });
}
// Blumenbeet / Staudenbeet
export function flowerBed(g, x, z, sx, sz) {
  if (g.detail < 2) { ground(g, 'dirt', x, z, sx, sz, 0.06 * M); return; }
  ground(g, 'dirt', x, z, sx, sz, 0.06 * M);
  const n = Math.max(2, Math.round((sx * sz) / (0.5 * M * 0.5 * M) / 4));
  const mats = ['leaves_light', 'paint_red', 'leaves_green', 'paint_yellow', 'plaster_pink', 'paint_white'];
  for (let k = 0; k < Math.min(n, 10); k++) {
    const px = x + (g.rng() - 0.5) * sx * 0.85, pz = z + (g.rng() - 0.5) * sz * 0.85;
    g.box(mats[k % mats.length], px, 0.06 * M, pz, 0.35 * M, 0.18 * M + g.rng() * 0.15 * M, 0.35 * M, { skip: NB });
  }
}

// Zäune entlang einer Strecke von (x0, z0) nach (x1, z1). type: 'picket' | 'metal' | 'wall' | 'post'
export function fence(g, x0, z0, x1, z1, type = 'picket', o = {}) {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
  if (len < 0.1 * M) return;
  const ry = Math.atan2(-dz, dx);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const h = o.h ?? (type === 'wall' ? 0.8 * M : 1.0 * M);
  const mat = o.mat || (type === 'picket' ? 'paint_white' : type === 'metal' ? 'metal_dark' : type === 'wall' ? 'stone_grey' : 'wood_planks');
  const D = g.detail;
  if (type === 'wall') {
    g.box(mat, cx, 0, cz, len, h, 0.3 * M, { ry, skip: NB });
    if (D >= 1) g.box(o.cap || 'trim_stone', cx, h, cz, len + 0.04 * M, 0.08 * M, 0.38 * M, { ry });
    return;
  }
  if (D === 0) return;
  const ux = dx / len, uz = dz / len;
  const nPost = Math.max(2, Math.round(len / (2.0 * M)) + 1);
  for (let k = 0; k < nPost; k++) {
    const t = k / (nPost - 1);
    g.box(type === 'metal' ? mat : (o.post || 'wood_dark'), x0 + dx * t, 0, z0 + dz * t, 0.09 * M, h + 0.08 * M, 0.09 * M, { ry, skip: NB });
  }
  if (D < 2) { g.box(mat, cx, h * 0.15, cz, len, h * 0.75, 0.03 * M, { ry, skip: NB }); return; }
  g.box(mat, cx, h * 0.75, cz, len, 0.07 * M, 0.04 * M, { ry });
  g.box(mat, cx, h * 0.25, cz, len, 0.07 * M, 0.04 * M, { ry });
  const step = type === 'metal' ? 0.16 * M : 0.2 * M;
  const n = Math.floor(len / step);
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n;
    const px = x0 + dx * t, pz = z0 + dz * t;
    g.box(mat, px + uz * 0.03 * M, 0.05 * M, pz - ux * 0.03 * M, type === 'metal' ? 0.025 * M : 0.09 * M, h - 0.05 * M, 0.02 * M, { ry, skip: F.BOTTOM | F.BACK });
  }
}
// Gartentor-Pfosten + Briefkasten am Grundstückseingang
export function gate(g, x, z, o = {}) {
  if (g.detail < 2) return;
  g.box(o.mat || 'stone_grey', x - 0.65 * M, 0, z, 0.3 * M, 1.2 * M, 0.3 * M, { skip: NB });
  g.box(o.mat || 'stone_grey', x + 0.65 * M, 0, z, 0.3 * M, 1.2 * M, 0.3 * M, { skip: NB });
  if (o.mailbox !== false) g.box(o.mailbox || 'paint_yellow', x + 0.65 * M, 1.2 * M, z, 0.3 * M, 0.35 * M, 0.22 * M);
}

// Auto: Silhouette als Prisma + Fenster + Räder (Front zeigt entlang ry = 0 nach +x)
export function car(g, x, z, ry = 0, color = 'paint_red', o = {}) {
  const D = g.detail;
  const L = (o.len ?? 4.4) * M, Wd = (o.w ?? 1.8) * M;
  const c = Math.cos(ry), s = Math.sin(ry);
  if (D === 0) { g.box(color, x, 0.15 * M, z, L, 1.15 * M, Wd, { ry, skip: NB }); return; }
  if (D === 1) {
    g.box(color, x, 0.25 * M, z, L, 0.7 * M, Wd, { ry, skip: NB });
    g.box('trim_dark', x - c * 0.2 * M, 0.95 * M, z + s * 0.2 * M, L * 0.5, 0.5 * M, Wd * 0.9, { ry, skip: NB });
    return;
  }
  const hm = (o.len ?? 4.4) / 2; // halbe Länge in Metern
  const prof = o.van
    ? [[-hm, 0.3], [hm, 0.3], [hm, 0.85], [hm - 0.25, 1.05], [hm - 0.9, 1.85], [-hm, 1.9]]
    : [[-hm, 0.3], [hm, 0.3], [hm, 0.78], [hm - 0.9, 0.92], [hm - 1.6, 1.42], [-hm + 1.1, 1.45], [-hm + 0.3, 0.98], [-hm, 0.9]];
  const tmp = new GeoProxy(g, x, z, ry);
  tmp.prism(color, prof.map(([a, b]) => [a * M, b * M]), Wd);
  // Scheiben (Maße in Metern)
  const win = 'trim_dark';
  if (!o.van) {
    tmp.sideQuad(win, hm - 1.55, 0.98, hm - 0.95, 1.36, Wd / 2 + 0.005 * M);
    tmp.sideQuad(win, -hm + 1.15, 0.98, hm - 1.65, 1.38, Wd / 2 + 0.005 * M);
    tmp.frontQuad(win, hm - 1.0, 0.95, hm - 1.55, 1.38, Wd / 2 - 0.1 * M);
  } else tmp.sideQuad(win, hm - 1.1, 1.0, hm - 0.35, 1.6, Wd / 2 + 0.005 * M);
  const hL = L / 2;
  // Räder
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    const lx = a * (hL - 0.8 * M), lz = b * (Wd / 2 - 0.12 * M);
    g.box('rubber', x + c * lx + s * lz, 0, z - s * lx + c * lz, 0.62 * M, 0.62 * M, 0.24 * M, { ry, skip: NB });
  }
}
// Hilfsobjekt: Punkte im Fahrzeug-Rahmen (Länge a entlang ry, Breite entlang Querachse)
class GeoProxy {
  constructor(g, x, z, ry) { this.g = g; this.x = x; this.z = z; this.c = Math.cos(ry); this.s = Math.sin(ry); }
  P(a, y, w) { return [this.x + this.c * a + this.s * w, y, this.z - this.s * a + this.c * w]; }
  prism(mat, prof, width) {
    const g = this.g, hw = width / 2;
    g.shape2(mat, prof, [], (a, y) => this.P(a, y, hw), [this.s, 0, this.c]);
    g.shape2(mat, prof, [], (a, y) => this.P(a, y, -hw), [-this.s, 0, -this.c]);
    let ca = 0, cy = 0;
    for (const [a, y] of prof) { ca += a / prof.length; cy += y / prof.length; }
    for (let i = 0; i < prof.length; i++) {
      const [a0, y0] = prof[i], [a1, y1] = prof[(i + 1) % prof.length];
      let na = y1 - y0, ny = -(a1 - a0);
      if (na * ((a0 + a1) / 2 - ca) + ny * ((y0 + y1) / 2 - cy) < 0) { na = -na; ny = -ny; }
      g.quad(mat, this.P(a0, y0, -hw), this.P(a1, y1, -hw), this.P(a1, y1, hw), this.P(a0, y0, hw), 0, [this.c * na, ny, -this.s * na]);
    }
  }
  // Seitenscheiben (Längen/Höhen in Metern), w = halbe Breite (Welt)
  sideQuad(mat, a0, y0, a1, y1, w) {
    const g = this.g;
    for (const sg of [1, -1]) g.quad(mat, this.P(a0 * M, y0 * M, sg * w), this.P(a1 * M, y0 * M, sg * w), this.P(a1 * M, y1 * M, sg * w), this.P(a0 * M, y1 * M, sg * w), 0, [this.s * sg, 0, this.c * sg]);
  }
  // Windschutzscheibe: schräge Fläche zwischen (a0, y0) unten und (a1, y1) oben
  frontQuad(mat, a0, y0, a1, y1, w) {
    const lift = 0.01 * M;
    this.g.quad(mat, this.P(a0 * M + lift, y0 * M + lift, -w), this.P(a0 * M + lift, y0 * M + lift, w), this.P(a1 * M + lift, y1 * M + lift, w), this.P(a1 * M + lift, y1 * M + lift, -w), 0, [this.c * 0.5, 0.8, -this.s * 0.5]);
  }
}
export const CAR_COLORS = ['paint_red', 'paint_white', 'metal_dark', 'paint_blue', 'metal_light', 'paint_white', 'metal_panel_grey', 'paint_yellow', 'paint_green', 'metal_dark'];

// Carport mit Flachdach (Mitte x, z; Breite sx, Tiefe sz)
export function carport(g, x, z, sx, sz, o = {}) {
  const h = 2.3 * M, mat = o.mat || 'wood_planks';
  if (g.detail >= 1) for (const a of [-1, 1]) for (const b of [-1, 1]) g.box(mat, x + a * (sx / 2 - 0.1 * M), 0, z + b * (sz / 2 - 0.1 * M), 0.14 * M, h, 0.14 * M, { skip: F.TOP | F.BOTTOM });
  g.box(o.roof || 'roof_metal_grey', x, h, z, sx + 0.3 * M, 0.08 * M, sz + 0.3 * M);
  if (g.detail >= 1) g.box(mat, x, h - 0.2 * M, z, sx + 0.2 * M, 0.2 * M, sz + 0.2 * M, { skip: F.TOP });
  if (o.car !== false) car(g, x, z, Math.PI / 2, o.car || rpick(g.rng, CAR_COLORS));
}
// Garage (Fertiggarage) mit Tor nach +z
export function garage(g, x, z, sx, sz, o = {}) {
  const h = 2.5 * M, wall = o.wall || 'plaster_white';
  g.box(wall, x, 0, z, sx, h, sz, { skip: NB });
  g.box(o.cap || 'metal_light', x, h, z, sx + 0.08 * M, 0.1 * M, sz + 0.08 * M);
  if (g.detail >= 1) {
    g.box(o.door || 'metal_panel_white', x, 0.02 * M, z + sz / 2 + 0.005 * M, sx - 0.5 * M, 2.1 * M, 0.02 * M, { skip: F.BACK | F.BOTTOM });
    if (g.detail >= 2) for (let k = 1; k < 5; k++) g.box('trim_dark', x, 0.02 * M + (2.1 * M * k) / 5, z + sz / 2 + 0.02 * M, sx - 0.55 * M, 0.03 * M, 0.01 * M, { skip: F.BACK | F.BOTTOM });
  }
}
// Gartenhaus mit Satteldach
export function shed(g, x, z, o = {}) {
  const sx = (o.w ?? 2.4) * M, sz = (o.d ?? 2.0) * M, h = 2.0 * M;
  const wall = o.wall || 'wood_planks';
  g.box(wall, x, 0, z, sx, h, sz, { skip: NB });
  if (g.detail >= 1) g.box('door_wood', x, 0, z + sz / 2 + 0.005 * M, 0.8 * M, 1.8 * M, 0.02 * M, { skip: F.BACK | F.BOTTOM });
  rectRoof(g, { cx: x, cz: z, sx, sz, y0: h, pitch: 30, ridge: 'x', mat: o.roof || 'roof_flat_membrane', under: wall, edge: 'wood_dark', t: 0.1 * M, eave: 0.2 * M, verge: 0.15 * M, wall, gutter: null });
}
// Terrasse mit Möbeln
export function terrace(g, x, z, sx, sz, o = {}) {
  ground(g, o.mat || 'wood_planks', x, z, sx, sz, 0.12 * M);
  if (g.detail < 2) return;
  if (o.furniture !== false) {
    g.cyl('metal_dark', x, 0.12 * M, z, 0.04 * M, 0.7 * M, { seg: 4, cap: false });
    g.cyl(o.table || 'paint_white', x, 0.82 * M, z, 0.5 * M, 0.04 * M, { seg: 8 });
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      g.box(o.chair || 'metal_dark', x + Math.cos(a) * 0.8 * M, 0.12 * M, z + Math.sin(a) * 0.8 * M, 0.45 * M, 0.45 * M, 0.45 * M, { ry: -a, skip: NB });
    }
    if (o.umbrella) parasol(g, x, z, o.umbrella, 0.12 * M);
  }
}
// Sonnenschirm
export function parasol(g, x, z, mat = 'canvas_white', y0 = 0, r = 1.3 * M) {
  if (g.detail < 1) return;
  g.cyl('metal_light', x, y0, z, 0.03 * M, 2.3 * M, { seg: 4, cap: false });
  g.cyl(mat, x, y0 + 2.0 * M, z, r, 0.45 * M, { seg: 8, rTop: 0.05 * M, bottom: true });
}
// Swimmingpool
export function pool(g, x, z, sx, sz) {
  const rim = 0.35 * M;
  g.box('tile_white', x, 0, z + sz / 2 + rim / 2, sx + rim * 2, 0.12 * M, rim, { skip: NB });
  g.box('tile_white', x, 0, z - sz / 2 - rim / 2, sx + rim * 2, 0.12 * M, rim, { skip: NB });
  g.box('tile_white', x + sx / 2 + rim / 2, 0, z, rim, 0.12 * M, sz, { skip: NB });
  g.box('tile_white', x - sx / 2 - rim / 2, 0, z, rim, 0.12 * M, sz, { skip: NB });
  g.hquad('water_pool', x, 0.07 * M, z, sx, sz);
}
// Trampolin / Schaukel / Sandkasten
export function play(g, x, z, kind = 'trampoline') {
  if (g.detail < 2) return;
  if (kind === 'trampoline') {
    g.cyl('rubber', x, 0.75 * M, z, 1.5 * M, 0.06 * M, { seg: 10 });
    g.cyl('paint_blue', x, 0.74 * M, z, 1.62 * M, 0.08 * M, { seg: 10, cap: false });
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2; g.box('metal_light', x + Math.cos(a) * 1.5 * M, 0, z + Math.sin(a) * 1.5 * M, 0.06 * M, 0.75 * M, 0.06 * M, { skip: F.TOP | F.BOTTOM }); }
  } else if (kind === 'swing') {
    for (const s of [-1, 1]) {
      g.rbox('wood_planks', x + s * 1.1 * M, 1.0 * M, z + 0.4 * M, 0.1 * M, 2.1 * M, 0.1 * M, -0.2, 0, 0);
      g.rbox('wood_planks', x + s * 1.1 * M, 1.0 * M, z - 0.4 * M, 0.1 * M, 2.1 * M, 0.1 * M, 0.2, 0, 0);
    }
    g.box('wood_planks', x, 1.95 * M, z, 2.4 * M, 0.1 * M, 0.1 * M);
    for (const s of [-0.45, 0.45]) {
      g.box('metal_dark', x + s * M * 1.2, 0.45 * M, z, 0.02 * M, 1.5 * M, 0.02 * M, { skip: F.TOP | F.BOTTOM });
      g.box('paint_red', x + s * M * 1.2, 0.42 * M, z, 0.45 * M, 0.04 * M, 0.2 * M);
    }
  } else {
    g.box('wood_planks', x, 0, z, 2.0 * M, 0.25 * M, 2.0 * M, { skip: NB });
    g.hquad('sand', x, 0.22 * M, z, 1.8 * M, 1.8 * M);
  }
}
// Mülltonnen-Reihe
export function bins(g, x, z, n = 3, ry = 0) {
  if (g.detail < 2) return;
  const mats = ['metal_dark', 'paint_blue', 'paint_yellow', 'paint_green', 'metal_dark'];
  const c = Math.cos(ry), s = Math.sin(ry);
  for (let k = 0; k < n; k++) {
    const a = (k - (n - 1) / 2) * 0.75 * M;
    g.box(mats[k % mats.length], x + c * a, 0, z - s * a, 0.6 * M, 1.05 * M, 0.7 * M, { ry, skip: NB });
  }
}
// Fahrradständer mit Rädern (angedeutet)
export function bikeRack(g, x, z, n = 4, ry = 0) {
  if (g.detail < 2) return;
  const c = Math.cos(ry), s = Math.sin(ry);
  for (let k = 0; k < n; k++) {
    const a = (k - (n - 1) / 2) * 0.7 * M;
    const px = x + c * a, pz = z - s * a;
    g.box('metal_light', px, 0, pz, 0.04 * M, 0.75 * M, 0.7 * M, { ry, skip: NB });
    if (k % 3 !== 2) {
      const col = ['paint_red', 'metal_dark', 'paint_blue', 'paint_green'][k % 4];
      g.box(col, px + c * 0.15 * M, 0.35 * M, pz - s * 0.15 * M, 0.04 * M, 0.08 * M, 1.5 * M, { ry });
      for (const e of [-0.55, 0.55]) g.cyl('rubber', px + c * 0.15 * M + s * e * M, 0, pz - s * 0.15 * M + c * e * M, 0.33 * M, 0.04 * M, { seg: 6 });
    }
  }
}
// Parkplatz-Reihe: Stellplätze nebeneinander entlang x (Breite 2.5 m), Autos mit Wahrscheinlichkeit p
export function parkingRow(g, x, z, n, facing = 1, p = 0.7, o = {}) {
  const sw = 2.5 * M, sl = 5.0 * M;
  const x0 = x - ((n - 1) * sw) / 2;
  if (g.detail >= 1) {
    for (let k = 0; k <= n; k++) g.hquad('paint_white', x0 - sw / 2 + k * sw, 0.045 * M, z, 0.1 * M, sl * 0.9);
  }
  for (let k = 0; k < n; k++) {
    if (g.rng() > p) continue;
    car(g, x0 + k * sw + (g.rng() - 0.5) * 0.2 * M, z + facing * 0.1 * M, facing > 0 ? Math.PI / 2 : -Math.PI / 2, rpick(g.rng, o.colors || CAR_COLORS), { van: g.rng() < 0.12 });
  }
}
// Straßenlaterne (privat, z. B. Parkplatz)
export function lamp(g, x, z, h = 4.5 * M) {
  if (g.detail >= 1) {
    g.cyl('metal_dark', x, 0, z, 0.06 * M, h, { seg: 5, cap: false });
    g.box('metal_dark', x, h, z, 0.5 * M, 0.12 * M, 0.25 * M);
    if (g.detail >= 2) g.box('emissive_warm', x, h - 0.04 * M, z, 0.4 * M, 0.04 * M, 0.18 * M);
  }
  g.kit.light(x, h - 0.1 * M, z, 0xffd79a, 0.5);
}
// Bank
export function bench(g, x, z, ry = 0) {
  if (g.detail < 2) return;
  g.box('wood_planks', x, 0.42 * M, z, 1.6 * M, 0.06 * M, 0.45 * M, { ry });
  const c = Math.cos(ry), s = Math.sin(ry);
  g.box('wood_planks', x - s * 0.22 * M, 0.5 * M, z - c * 0.22 * M, 1.6 * M, 0.4 * M, 0.05 * M, { ry });
  for (const e of [-0.65, 0.65]) g.box('metal_dark', x + c * e * M, 0, z - s * e * M, 0.06 * M, 0.42 * M, 0.4 * M, { ry, skip: NB });
}
// Pflanzkübel mit Busch
export function planter(g, x, z, mat = 'concrete') {
  if (g.detail < 1) return;
  g.box(mat, x, 0, z, 0.8 * M, 0.55 * M, 0.8 * M, { skip: NB });
  if (g.detail >= 2) g.geom('leaves_green', new THREE.IcosahedronGeometry(0.5 * M, 0), { x, y: 0.85 * M, z, sy: 0.8 });
}
// Außengastronomie: Tische mit Stühlen und Schirmen auf einer Fläche (x, z, sx, sz)
export function cafeSeating(g, x, z, sx, n = 3, o = {}) {
  if (g.detail < 1) return;
  const step = sx / n;
  for (let k = 0; k < n; k++) {
    const px = x - sx / 2 + step * (k + 0.5);
    if (g.detail >= 2) {
      g.cyl('metal_dark', px, 0, z, 0.03 * M, 0.72 * M, { seg: 4, cap: false });
      g.cyl(o.table || 'paint_white', px, 0.72 * M, z, 0.38 * M, 0.04 * M, { seg: 8 });
      for (const s of [-1, 1]) g.box(o.chair || 'metal_dark', px + s * 0.6 * M, 0, z, 0.42 * M, 0.85 * M, 0.42 * M, { skip: NB });
    } else g.box(o.table || 'paint_white', px, 0, z, 1.4 * M, 0.75 * M, 0.7 * M, { skip: NB });
    if (o.umbrella) parasol(g, px, z, o.umbrella, 0, 1.25 * M);
  }
}
