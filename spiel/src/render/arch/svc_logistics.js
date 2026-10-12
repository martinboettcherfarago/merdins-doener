// Logistik und Verarbeitung (Kategorie industry): Lagerhalle, Lebensmittelfabrik, Sägewerk, Stahlwerk, Raffinerie,
// Güterbahnhof, Frachthafen, Markthalle. Besitzer: G5. Wasserseite des Hafens = hinten (−z).
import * as THREE from 'three';
import { registerArch } from './index.js';
import * as P from './svc_parts.js';
import { barrel } from './svc_edu.js';

const { M, pick } = P;
const dims = (ctx) => [ctx.fw * 10 * M, ctx.fd * 10 * M];

// Laderampe mit Tor, Torabdichtung und Puffern (Front einer Halle bei z)
function dock(k, x, z, o = {}) {
  const dh = o.dh ?? 1.2 * M;
  P.rollerDoor(k, x, z, 0, 3.0 * M, 3.2 * M, { y0: dh, mat: o.mat || 'metal_panel_grey', ribs: 6 });
  if (!P.D1(k)) return;
  k.box('rubber', x - 1.8 * M, dh - 0.1 * M, z + 0.3 * M, 0.4 * M, 3.6 * M, 0.6 * M);
  k.box('rubber', x + 1.8 * M, dh - 0.1 * M, z + 0.3 * M, 0.4 * M, 3.6 * M, 0.6 * M);
  k.box('rubber', x, dh + 3.3 * M, z + 0.3 * M, 4.0 * M, 0.5 * M, 0.6 * M);
  if (P.D2(k)) for (const s of [-1, 1]) k.box('rubber', x + s * 1.1 * M, dh - 0.6 * M, z + 0.1 * M, 0.3 * M, 0.5 * M, 0.2 * M);
  k.light(x, dh + 3.9 * M, z + 0.5 * M, 0xffe0b0, 0.25);
}
// Stapel liegender Baumstämme (entlang x)
function logPile(k, x, z, len, rows, r = 0.28 * M) {
  if (k.detail === 0) { k.box('log_wood', x, 0, z, len, rows * r * 1.7, rows * r * 2.1); return; }
  for (let row = 0; row < rows; row++) {
    const n = rows - row;
    for (let i = 0; i < n; i++) {
      const zz = z + (i - (n - 1) / 2) * r * 2.05, y = r + row * r * 1.72;
      P.pipe(k, 'log_wood', [x - len / 2 + (k.rng() - 0.5) * 0.3 * M, y, zz], [x + len / 2 + (k.rng() - 0.5) * 0.3 * M, y, zz], r * (0.85 + k.rng() * 0.25), { seg: P.segs(k, 7), open: false });
    }
  }
}
// Bretterstapel mit Stapelleisten
function lumber(k, x, z, sx, sz, layers) {
  for (let l = 0; l < layers; l++) {
    k.box('wood_planks', x, l * 0.55 * M + 0.12 * M, z, sx, 0.45 * M, sz);
    if (P.D2(k)) for (const s of [-1, 0, 1]) k.box('wood_dark', x + s * (sx / 2 - 0.3 * M), l * 0.55 * M + 0.02 * M, z, 0.12 * M, 0.1 * M, sz + 0.1 * M);
  }
}

// ---------------------------------------------------------------- Lagerhalle (2×2)
registerArch('warehouse', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'asphalt');
    const hx = 0.6 * M, hz = -4.4 * M, hw = 18 * M, hd = 10.4 * M, hh = 8.6 * M, dh = 1.2 * M;
    const wall = v ? 'metal_panel_grey' : 'metal_corrugated', accent = v ? 'paint_orange' : 'metal_panel_blue';
    k.box('concrete', hx, 0, hz, hw + 0.1 * M, dh + 0.2 * M, hd + 0.1 * M);
    k.box(wall, hx, dh, hz, hw, hh - dh, hd);
    k.box(accent, hx, hh - 1.0 * M, hz, hw + 0.06 * M, 0.8 * M, hd + 0.06 * M);
    k.flatRoof('roof_flat_membrane', accent, hx, hh, hz, hw, hd, { parapet: 0.4 * M });
    if (P.D1(k)) for (let i = 0; i < 3; i++) k.box('glass_skylight', hx - 5.5 * M + i * 5.5 * M, hh, hz, 1.6 * M, 0.5 * M, hd - 2 * M, { lit: 0.97 });
    for (let i = 0; i < 4; i++) dock(k, hx - 4.8 * M + i * 4.0 * M, hz + hd / 2, { dh, mat: i === 3 ? accent : 'metal_panel_grey' });
    P.signBox(k, 'LOGISTIK', hx + 2.4 * M, hh - 1.8 * M, hz + hd / 2, 0, { px: 0.16 * M, bg: accent });
    // Büro (zweigeschossig, verglast) vorne links
    const ox = -7.0 * M, oz = 2.6 * M;
    k.box('metal_panel_white', ox, 0, oz, 5 * M, 6.6 * M, 4 * M);
    k.curtainWall('front', ox, oz, 5 * M, 4 * M, 0.4 * M, 5.6 * M, { glass: 'glass_curtain_blue', fh: 2.8 * M });
    k.curtainWall('right', ox, oz, 5 * M, 4 * M, 0.4 * M, 5.6 * M, { glass: 'glass_curtain_blue', fh: 2.8 * M });
    k.flatRoof('roof_flat_membrane', accent, ox, 6.6 * M, oz, 5 * M, 4 * M, { parapet: 0.3 * M });
    P.door(k, ox - 1.2 * M, oz + 2 * M, 0, { glass: true });
    // Lkw an den Rampen, Markierungen, Container
    P.truck(k, hx - 4.8 * M, 5.2 * M, 0, { len: 8.6 * M, cab: 'paint_white', body: v ? 'metal_panel_white' : 'canvas_white', stripe: accent });
    P.truck(k, hx + 3.2 * M, 5.3 * M, 0, { len: 8.6 * M, cab: 'paint_red', body: 'metal_panel_grey' });
    if (P.D1(k)) for (let i = 0; i <= 4; i++) P.line(k, hx - 6.8 * M + i * 4 * M, 1.4 * M, hx - 6.8 * M + i * 4 * M, 9.4 * M, 0.15 * M, 'paint_yellow');
    P.containerStack(k, 8.4 * M, 5.6 * M, 1, 1, 2, { long: false });
    P.crates(k, -2.4 * M, 2.2 * M, 4, { spread: 2.6 * M });
    P.forklift(k, 4.6 * M, 2.0 * M, 0.8);
    P.lamp(k, 9.2 * M, 1.6 * M, 6 * M); P.lamp(k, -9.2 * M, 6.6 * M, 6 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Lebensmittelfabrik (2×2)
registerArch('food_factory', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'concrete');
    P.slab(k, 'asphalt', 2.4 * M, 7.0 * M, 15 * M, 5.6 * M);
    const accent = v ? 'paint_red' : 'paint_green';
    // Produktionshalle mit Sheddach
    const hx = -2.6 * M, hz = -1.6 * M, hw = 13.6 * M, hd = 10.4 * M, hh = 6.4 * M;
    k.box('metal_panel_white', hx, 0, hz, hw, hh, hd);
    k.box('concrete', hx, 0, hz, hw + 0.1 * M, 0.6 * M, hd + 0.1 * M);
    k.box(accent, hx, hh - 1.2 * M, hz, hw + 0.06 * M, 0.7 * M, hd + 0.06 * M);
    k.sawtoothRoof('metal_panel_white', 'glass_skylight', hx, hh, hz, hw, hd, 4, 1.8 * M);
    P.ribbon(k, 'front', hx - 3 * M, hz, 7 * M, hd, 2.0 * M, 1.6 * M, { margin: 0.2 * M });
    P.ribbon(k, 'left', hx, hz, hw, hd, 2.0 * M, 1.6 * M);
    for (let i = 0; i < 2; i++) P.rollerDoor(k, hx + 2.6 * M + i * 3.6 * M, hz + hd / 2, 0, 3.0 * M, 3.6 * M, { mat: 'metal_panel_grey' });
    P.signBox(k, v ? 'BACKWAREN' : 'FRISCHKOST', hx - 2.4 * M, hh - 0.25 * M, hz + hd / 2 + 0.04 * M, 0, { px: 0.15 * M, bg: accent });
    if (P.D1(k)) { const [x, z] = [hx - 6.0 * M, hz + hd / 2 + 0.06 * M]; k.add('paint_yellow', new THREE.CircleGeometry(0.9 * M, P.segs(k, 14)), { x, y: hh - 0.8 * M, z }); k.add(accent, new THREE.CircleGeometry(0.55 * M, 6), { x, y: hh - 0.8 * M, z: z + 0.02 * M, ry: 0 }); }
    // Silos und Tanks
    for (let i = 0; i < 3; i++) P.silo(k, 5.6 * M + i * 2.0 * M, -7.6 * M, 0.95 * M, 7.6 * M, { mat: 'metal_light' });
    if (P.D1(k)) { k.box('metal_dark', 7.6 * M, 12.6 * M, -7.6 * M, 6 * M, 0.5 * M, 0.8 * M); P.beam(k, 'metal_corrugated', [5.0 * M, 12.6 * M, -7.6 * M], [hx + hw / 2, hh + 1.0 * M, -6.2 * M], 0.9 * M); }
    for (let i = 0; i < 2; i++) P.tank(k, 6.2 * M + i * 2.6 * M, -2.8 * M, 1.1 * M, 4.6 * M, { mat: 'tank_white', roof: 'dome', domeK: 0.5 });
    P.pipeline(k, 'metal_light', [[6.2 * M, 3.6 * M, -2.8 * M], [6.2 * M, 3.6 * M, -0.6 * M], [hx + hw / 2, 3.6 * M, -0.6 * M]], 0.18 * M);
    // Kesselhaus mit Dampf
    k.box('brick_red', -7.6 * M, 0, -8.2 * M, 3.4 * M, 4.4 * M, 2.8 * M);
    P.stack(k, -8.4 * M, -8.4 * M, 12 * M, { r: 0.45 * M, rTop: 0.4 * M, mat: 'metal_light', type: 'steam', amount: 0.8, platform: false });
    for (let i = 0; i < 2; i++) P.fanUnit(k, hx - 3 * M + i * 6 * M, hh + 1.8 * M, hz - 4 * M, 0.7 * M);
    P.truck(k, 1.6 * M, 8.0 * M, Math.PI / 2, { len: 9 * M, cab: 'paint_white', body: 'metal_panel_white', stripe: accent });
    P.lamp(k, 9 * M, 4.4 * M, 5 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Sägewerk (2×2)
registerArch('sawmill', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'dirt');
    P.slab(k, 'gravel', 2 * M, 7.4 * M, 15 * M, 4.6 * M);
    // Sägehalle (Holz, offene Front)
    const hx = -3 * M, hz = 1.0 * M, hw = 11 * M, hd = 7 * M, hh = 5.6 * M, wall = v ? 'metal_corrugated_red' : 'wood_planks';
    k.box(wall, hx, 0, hz - hd / 2 + 0.15 * M, hw, hh, 0.3 * M);
    for (const s of [-1, 1]) k.box(wall, hx + s * (hw / 2 - 0.15 * M), 0, hz, 0.3 * M, hh, hd);
    k.box(wall, hx, hh - 1.2 * M, hz + hd / 2 - 0.15 * M, hw, 1.2 * M, 0.3 * M);
    for (let i = 1; i < 4; i++) k.box('wood_dark', hx - hw / 2 + (i * hw) / 4, 0, hz + hd / 2 - 0.2 * M, 0.3 * M, hh - 1.2 * M, 0.3 * M);
    k.box('concrete_dark', hx, 0.01 * M, hz, hw - 0.6 * M, 0.06 * M, hd - 0.6 * M);
    k.gableRoof('roof_metal_grey', hx, hh, hz, hw, hd, 1.8 * M, { ridge: 'x', overhang: 0.6 * M });
    k.gableEnds(wall, hx, hh, hz, hw, hd, 1.8 * M, { ridge: 'x' });
    if (P.D1(k)) { k.box('metal_dark', hx, 0, hz, 1.8 * M, 1.6 * M, 2.4 * M); k.box('paint_yellow', hx, 1.6 * M, hz, 1.2 * M, 0.6 * M, 1.2 * M); P.pipe(k, 'log_wood', [hx - 4.4 * M, 0.9 * M, hz], [hx - 1.0 * M, 0.9 * M, hz], 0.28 * M, { seg: 7, open: false }); lumber(k, hx + 3.0 * M, hz + 0.8 * M, 2.4 * M, 1.2 * M, 2); }
    P.signBox(k, 'SAEGEWERK', hx, hh - 0.6 * M, hz + hd / 2 + 0.02 * M, 0, { px: 0.13 * M, bg: 'wood_dark', fg: 'paint_yellow' });
    // Rundholzplatz mit Portalkran
    for (let i = 0; i < 3; i++) logPile(k, -4.6 * M + i * 6.4 * M, -7.0 * M, 5.2 * M, 4);
    if (P.D1(k)) {
      for (const s of [-1, 1]) { P.beam(k, 'paint_yellow', [s * 9.2 * M, 0, -9.0 * M], [s * 9.2 * M, 7 * M, -7.0 * M], 0.35 * M); P.beam(k, 'paint_yellow', [s * 9.2 * M, 0, -5.0 * M], [s * 9.2 * M, 7 * M, -7.0 * M], 0.35 * M); }
      k.box('paint_yellow', 0, 7 * M, -7.0 * M, 18.8 * M, 0.7 * M, 0.7 * M);
      k.box('metal_dark', 1.6 * M, 6.4 * M, -7.0 * M, 1.4 * M, 0.6 * M, 1.4 * M);
      k.box('metal_dark', 1.6 * M, 3.2 * M, -7.0 * M, 0.06 * M, 3.2 * M, 0.06 * M);
      k.box('metal_dark', 1.6 * M, 2.9 * M, -7.0 * M, 1.2 * M, 0.4 * M, 0.9 * M);
    }
    // Trockenkammer, Späne-Silo, Kessel mit Schornstein
    k.box('metal_panel_grey', 6.4 * M, 0, 0.8 * M, 5.4 * M, 4.2 * M, 5.6 * M);
    if (P.D1(k)) { P.rollerDoor(k, 6.4 * M, 3.6 * M, 0, 3.6 * M, 3.4 * M, { mat: 'metal_panel_grey' }); for (let i = 0; i < 2; i++) P.fanUnit(k, 5.2 * M + i * 2.4 * M, 4.2 * M, 0.6 * M, 0.6 * M); }
    k.flatRoof('roof_flat_membrane', 'metal_dark', 6.4 * M, 4.2 * M, 0.8 * M, 5.4 * M, 5.6 * M, { parapet: 0.2 * M });
    P.silo(k, 3.6 * M, -2.4 * M, 1.1 * M, 5.4 * M, { mat: 'metal_light' });
    if (P.D1(k)) { k.cone('metal_light', 3.6 * M, 11.2 * M, -2.4 * M, 0.6 * M, 1.4 * M, { seg: 8, rx: Math.PI }); P.pipe(k, 'metal_light', [3.6 * M, 11.0 * M, -2.4 * M], [hx + hw / 2 - 0.5 * M, hh + 1.2 * M, hz - 1 * M], 0.18 * M); }
    P.stack(k, 9.0 * M, -3.8 * M, 11 * M, { r: 0.45 * M, rTop: 0.38 * M, mat: 'metal_light', capMat: 'metal_dark', amount: 0.9, platform: false });
    lumber(k, 7.0 * M, 7.6 * M, 3.6 * M, 1.4 * M, 3); lumber(k, -1.4 * M, 7.6 * M, 3.6 * M, 1.4 * M, 2);
    // Langholz-Lkw
    if (P.D1(k)) { P.truck(k, -4.4 * M, 6.6 * M, Math.PI / 2, { len: 11 * M, cab: 'paint_green', body: false }); for (let r = 0; r < 2; r++) for (let i = 0; i < 3 - r; i++) P.pipe(k, 'log_wood', [-9.4 * M, 1.3 * M + r * 0.5 * M, 6.05 * M + i * 0.55 * M + r * 0.27 * M], [-2.6 * M, 1.3 * M + r * 0.5 * M, 6.05 * M + i * 0.55 * M + r * 0.27 * M], 0.27 * M, { seg: 6, open: false }); }
    P.lamp(k, 9.2 * M, 6.0 * M, 5 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Stahlwerk (3×2) mit Hochofen
registerArch('steelworks', {
  variants: 1,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx);
    P.lot(k, W, D, 'concrete_dark');
    // Hochofen
    const fx = -6.6 * M, fz = -3.4 * M;
    k.box('metal_corrugated_red', fx, 0, fz + 1 * M, 9 * M, 6 * M, 7 * M);
    k.flatRoof('roof_metal_grey', 'metal_dark', fx, 6 * M, fz + 1 * M, 9 * M, 7 * M, { parapet: 0.3 * M });
    k.cyl('rust', fx, 6 * M, fz, 2.6 * M, 12 * M, { seg: P.segs(k, 16), rTop: 2.1 * M });
    k.cyl('rust', fx, 18 * M, fz, 2.1 * M, 3 * M, { seg: P.segs(k, 16), rTop: 1.4 * M });
    k.box('metal_dark', fx, 21 * M, fz, 3.4 * M, 3 * M, 3.4 * M);
    k.box('metal_corrugated', fx, 24 * M, fz, 2.4 * M, 2.4 * M, 2.4 * M);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box('metal_dark', fx + a * 2.8 * M, 6 * M, fz + b * 2.8 * M, 0.4 * M, 20 * M, 0.4 * M);
    if (P.D1(k)) for (const y of [12, 18]) k.box('metal_dark', fx, y * M, fz, 6.2 * M, 0.3 * M, 6.2 * M);
    P.torus(k, 'rust', fx, 8.2 * M, fz, 3.4 * M, 0.45 * M, { seg: P.segs(k, 16) });
    // Gichtgasleitungen und Staubsack
    for (const s of [-1, 1]) P.pipeline(k, 'rust', [[fx + s * 1.0 * M, 24.5 * M, fz], [fx + s * 1.0 * M, 28 * M, fz], [fx - 3 * M, 28 * M, fz - 1 * M]], 0.5 * M);
    P.pipe(k, 'rust', [fx - 3 * M, 28 * M, fz - 1 * M], [-13.0 * M, 12 * M, -7.6 * M], 0.75 * M, { open: false });
    k.cyl('rust', -13.0 * M, 4 * M, -7.6 * M, 1.6 * M, 6 * M, { seg: P.segs(k, 12) });
    k.add('rust', new THREE.CylinderGeometry(1.6 * M, 0.4 * M, 2.4 * M, P.segs(k, 12)), { x: -13.0 * M, y: 2.8 * M, z: -7.6 * M });
    k.cone('rust', -13.0 * M, 10 * M, -7.6 * M, 1.6 * M, 2.0 * M, { seg: P.segs(k, 12) });
    if (P.D1(k)) for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box('metal_dark', -13.0 * M + a * 1.2 * M, 0, -7.6 * M + b * 1.2 * M, 0.3 * M, 4.2 * M, 0.3 * M);
    // Schrägaufzug zur Gicht
    P.beam(k, 'metal_dark', [fx + 4.4 * M, 0.5 * M, fz + 7.4 * M], [fx + 1.4 * M, 24 * M, fz + 0.6 * M], 1.2 * M);
    // Winderhitzer
    for (let i = 0; i < 3; i++) { const x = 0.6 * M + i * 3.8 * M, z = -6.8 * M; k.cyl('metal_panel_grey', x, 0, z, 1.6 * M, 17 * M, { seg: P.segs(k, 14) }); k.dome('metal_panel_grey', x, 17 * M, z, 1.6 * M, { seg: P.segs(k, 14), sy: 0.8 }); if (P.D1(k)) k.cyl('metal_dark', x, 8 * M, z, 1.65 * M, 0.3 * M, { seg: P.segs(k, 14), open: true }); }
    P.pipe(k, 'rust', [-3.0 * M, 8.2 * M, -6.8 * M], [9.0 * M, 8.2 * M, -6.8 * M], 0.55 * M, { open: false });
    P.pipe(k, 'rust', [-3.0 * M, 8.2 * M, -6.8 * M], [fx + 3.0 * M, 8.2 * M, fz - 1.6 * M], 0.55 * M, { open: false });
    // Stahlwerkshalle mit Dachreiter und Schornsteinen
    const hx = 8.6 * M, hz = 3.4 * M, hw = 12 * M, hd = 12 * M, hh = 11 * M;
    k.box('metal_corrugated', hx, 0, hz, hw, hh, hd);
    k.box('metal_corrugated_red', hx, 0, hz, hw + 0.08 * M, 3 * M, hd + 0.08 * M);
    k.gableRoof('roof_metal_grey', hx, hh, hz, hw, hd, 1.8 * M, { ridge: 'z', overhang: 0.3 * M });
    k.gableEnds('metal_corrugated', hx, hh, hz, hw, hd, 1.8 * M, { ridge: 'z' });
    k.box('metal_corrugated', hx, hh + 1.4 * M, hz, 2.4 * M, 1.6 * M, hd);
    k.gableRoof('roof_metal_grey', hx, hh + 3.0 * M, hz, 2.4 * M, hd, 0.6 * M, { ridge: 'z', overhang: 0.3 * M });
    P.gridRow(k, 'front', hx, hz, hw, hd, 3, 4 * M, 2.4 * M, 5 * M, 3, 5, { frame: 'metal_dark' });
    P.rollerDoor(k, hx, hz + hd / 2, 0, 5 * M, 3.6 * M, { mat: 'metal_dark' });
    for (const [x, z] of [[12.6 * M, -5.0 * M], [12.6 * M, -8.0 * M]]) P.stack(k, x, z, 28 * M, { r: 1.0 * M, rTop: 0.8 * M, mat: 'concrete', bands: 2, bandH: 1.2 * M, amount: 2.4 });
    // Abstich: glühendes Roheisen
    if (P.D1(k)) { k.box('emissive_warm', fx + 1.6 * M, 0.3 * M, fz + 4.55 * M, 2.4 * M, 1.4 * M, 0.05 * M); k.light(fx + 1.6 * M, 1.2 * M, fz + 5.2 * M, 0xff8a30, 0.8); k.box('emissive_warm', hx - 2 * M, 0.3 * M, hz + hd / 2 + 0.03 * M, 2 * M, 2.4 * M, 0.04 * M); }
    k.smoke(fx, 26.6 * M, fz, 'smoke', 1.2);
    k.smoke(hx, hh + 3.6 * M, hz, 'steam', 1.2);
    // Erz- und Kokshalden, Torpedopfannenwagen
    P.heap(k, 'rust', -10.6 * M, 6.6 * M, 7 * M, 4.6 * M, 2.4 * M);
    P.heap(k, 'asphalt_dark', -3.8 * M, 7.4 * M, 5 * M, 3.6 * M, 2.0 * M);
    P.track(k, -W / 2 + 0.3 * M, 2.4 * M, 3.4 * M);
    if (P.D1(k)) for (const x of [-7.6, -1.6]) { const g = new P.G(k, x * M, 3.4 * M, Math.PI / 2); g.box('metal_dark', 0, 0.5 * M, 0, 2.4 * M, 0.5 * M, 5.6 * M); g.pipe('rust', [0, 2.2 * M, -2.6 * M], [0, 2.2 * M, 2.6 * M], 1.2 * M, { seg: 10, open: false, r2: 1.2 * M }); }
    P.lamp(k, 1 * M, 9 * M, 7 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Raffinerie (3×2)
registerArch('refinery', {
  variants: 1,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx);
    P.lot(k, W, D, 'gravel');
    P.slab(k, 'concrete', -4 * M, -2 * M, 20 * M, 14 * M);
    // Kolonnen
    const cols = [[-6.8, -6.0, 1.3, 26], [-3.6, -6.4, 1.0, 21], [-1.0, -5.6, 0.8, 16], [-9.4, -3.6, 0.7, 14]];
    for (const [x, z, r, h] of cols) {
      k.cyl('tank_white', x * M, 0, z * M, r * M, h * M, { seg: P.segs(k, 12) });
      k.dome('tank_white', x * M, h * M, z * M, r * M, { seg: P.segs(k, 12), sy: 0.6 });
      if (P.D1(k)) for (let y = 4; y < h; y += 5) { k.cyl('metal_dark', x * M, y * M, z * M, r * M + 0.7 * M, 0.15 * M, { seg: P.segs(k, 12) }); if (P.D2(k)) k.cyl('metal_dark', x * M, y * M + 0.15 * M, z * M, r * M + 0.7 * M, 0.9 * M, { seg: P.segs(k, 12), open: true }); }
      P.ladder(k, x * M, 0, z * M + r * M + 0.2 * M, h * M);
    }
    // Röhrenofen mit Schornsteinen
    k.box('metal_panel_grey', -6.4 * M, 0, 1.6 * M, 6 * M, 7 * M, 3.6 * M);
    k.box('metal_dark', -6.4 * M, 7 * M, 1.6 * M, 4 * M, 1.2 * M, 2 * M);
    for (const x of [-7.6, -5.2]) P.stack(k, x * M, 1.6 * M, 18 * M, { r: 0.55 * M, rTop: 0.5 * M, y0: 0, mat: 'concrete', bands: 1, amount: 0.9, platform: false });
    // Rohrbrücke
    P.pipeRack(k, [-13 * M, -1.6 * M], [5 * M, -1.6 * M], 4 * M, { n: 5, r: 0.2 * M, mats: ['pipe_metal', 'metal_light', 'paint_yellow', 'pipe_metal', 'paint_green'] });
    P.pipeRack(k, [5 * M, -1.6 * M], [5 * M, -8.6 * M], 4 * M, { n: 3, r: 0.2 * M });
    for (const [x, z] of [[-6.8, -6.0], [-3.6, -6.4], [-1.0, -5.6]]) P.pipe(k, 'pipe_metal', [x * M, 4.5 * M, z * M + 1 * M], [x * M, 4.5 * M, -1.6 * M], 0.2 * M);
    // Kugelbehälter
    P.sphereTank(k, -11.4 * M, 5.6 * M, 2.0 * M, { mat: 'tank_white' });
    P.sphereTank(k, -6.6 * M, 6.4 * M, 2.0 * M, { mat: 'tank_white' });
    // Tanklager
    for (const [x, z, r, h] of [[8.8, -5.6, 3.0, 5.2], [8.8, 2.0, 2.6, 5.0], [13.0, -1.8, 1.7, 4.4], [13.0, 5.4, 1.6, 4.2]]) {
      k.box('concrete', x * M, 0, z * M, r * 2.4 * M, 0.6 * M, r * 2.4 * M);
      P.tank(k, x * M, z * M, r * M, h * M, { mat: 'tank_white', roof: 'cone', coneK: 0.12, band: 'paint_green', rail: true });
    }
    // Fackel mit Flamme
    const lx = 13.6 * M, lz = -8.6 * M;
    k.cyl('metal_dark', lx, 0, lz, 0.35 * M, 26 * M, { seg: 6, rTop: 0.3 * M });
    if (P.D1(k)) for (const a of [0, 2.1, 4.2]) P.beam(k, 'metal_light', [lx + Math.cos(a) * 2.2 * M, 0, lz + Math.sin(a) * 2.2 * M], [lx, 18 * M, lz], 0.12 * M);
    k.cone('emissive_warm', lx, 26 * M, lz, 0.7 * M, 2.2 * M, { seg: 6 });
    k.light(lx, 27 * M, lz, 0xff9a40, 1.0);
    k.smoke(lx, 28 * M, lz, 'smoke', 0.8);
    // Leitwarte, Verladestation
    k.box('plaster_white', 1.4 * M, 0, 6.6 * M, 6 * M, 3.4 * M, 4.2 * M);
    k.flatRoof('roof_flat_membrane', 'paint_green', 1.4 * M, 3.4 * M, 6.6 * M, 6 * M, 4.2 * M, { parapet: 0.3 * M });
    P.ribbon(k, 'front', 1.4 * M, 6.6 * M, 6 * M, 4.2 * M, 1.2 * M, 1.3 * M);
    P.signBox(k, 'RAFFINERIE', 1.4 * M, 3.2 * M, 8.72 * M, 0, { px: 0.12 * M, bg: 'paint_green' });
    P.canopy(k, 7.6 * M, 5.2 * M, 7.8 * M, 5 * M, 3.4 * M, { mat: 'metal_panel_white' });
    P.tanker(k, 7.6 * M, 7.6 * M, Math.PI / 2, { len: 10 * M, cab: 'paint_red' });
    P.fenceRect(k, 0, 0, W - 0.4 * M, D - 0.4 * M, { h: 2.2 * M, gate: 4 * M, gateX: 7.6 * M, wire: true });
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Güterbahnhof (3×2)
registerArch('cargo_rail', {
  variants: 1,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx);
    P.lot(k, W, D, 'gravel');
    const x0 = -W / 2 + 0.2 * M, x1 = W / 2 - 0.2 * M;
    const tz = [-7.6, -4.0, -0.4].map((z) => z * M);
    for (const z of tz) P.track(k, x0, x1, z);
    // Züge
    const kinds = [['flat', 'flat', 'tank'], ['box', 'hopper', 'box'], ['tank', 'flat']];
    kinds.forEach((list, ti) => list.forEach((kd, i) => P.wagon(k, -9.6 * M + i * 9.6 * M + (ti === 2 ? 4.8 * M : 0), tz[ti], Math.PI / 2, kd, { len: 8.8 * M })));
    // Portalkran über den Gleisen
    const cx = 2.6 * M;
    for (const z of [-9.6 * M, 3.0 * M]) {
      for (const s of [-1, 1]) k.box('paint_blue', cx + s * 3 * M, 0, z, 0.6 * M, 12 * M, 0.8 * M);
      k.box('paint_blue', cx, 0.2 * M, z, 7 * M, 0.6 * M, 1.2 * M);
    }
    for (const s of [-1, 1]) k.box('paint_blue', cx + s * 3 * M, 12 * M, -3.3 * M, 0.9 * M, 1.4 * M, 15.4 * M);
    k.box('metal_dark', cx, 13.4 * M, -4.0 * M, 7.4 * M, 1.2 * M, 2.4 * M);
    if (P.D1(k)) { for (const s of [-1, 1]) k.box('metal_dark', cx + s * 1.2 * M, 6.8 * M, -4.0 * M, 0.06 * M, 6.6 * M, 0.06 * M); k.box('paint_yellow', cx, 6.4 * M, -4.0 * M, 2.6 * M, 0.4 * M, 6.2 * M); k.box('glass_window', cx + 3.6 * M, 10.6 * M, 3.0 * M, 1.4 * M, 1.4 * M, 1.4 * M, { lit: 0.9 }); }
    P.container(k, cx, 3.8 * M, -4.0 * M, Math.PI / 2, 'container_red');
    // Containerlager und Lkw vorne
    P.slab(k, 'asphalt', -1 * M, 6.6 * M, 26 * M, 6.0 * M);
    P.containerStack(k, -10 * M, 6.2 * M, 3, 1, 3, { long: false });
    P.containerStack(k, 10.4 * M, 6.2 * M, 2, 1, 2, { long: false });
    P.truck(k, -1.4 * M, 6.8 * M, Math.PI / 2, { len: 14 * M, cab: 'paint_white', body: 'container_blue', bodyH: 2.6 * M });
    // Stellwerk
    const sx = 4.0 * M, sz = 7.4 * M;
    P.block(k, { x: sx, z: sz, w: 4 * M, d: 3.4 * M, floors: 2, wall: 'brick_red', win: { frame: 'window_frame_white', spacing: 1.6 * M, winW: 1.0 * M }, roof: 'hip', roofMat: 'roof_slate', roofH: 1.4 * M });
    P.signBox(k, 'GUETERBAHNHOF', sx, 2.4 * M, sz + 1.72 * M, 0, { px: 0.08 * M, bg: 'trim_dark' });
    // Signale, Lichtmasten
    if (P.D1(k)) for (const z of tz) { k.box('metal_dark', x1 - 1.2 * M, 0, z + 1.8 * M, 0.15 * M, 4 * M, 0.15 * M); k.box('metal_dark', x1 - 1.2 * M, 4 * M, z + 1.8 * M, 0.5 * M, 1.2 * M, 0.3 * M); k.box('emissive_red', x1 - 1.0 * M, 4.6 * M, z + 1.8 * M, 0.2 * M, 0.2 * M, 0.2 * M, {}); }
    for (const x of [-7, 10]) { k.cyl('metal_light', x * M, 0, 1.8 * M, 0.15 * M, 13 * M, { seg: 6 }); if (P.D1(k)) { k.box('emissive_cool', x * M, 13 * M, 1.8 * M, 1.4 * M, 0.4 * M, 0.6 * M); k.light(x * M, 13 * M, 1.8 * M, 0xeaf4ff, 0.7); } }
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Frachthafen (3×3), Kaikante hinten
registerArch('cargo_harbor', {
  variants: 1,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx);
    P.lot(k, W, D, 'concrete');
    const qz = -D / 2 + 0.2 * M;
    // Kaimauer mit Fendern und Pollern
    k.box('concrete_dark', 0, 0, qz + 1.0 * M, W - 0.3 * M, 0.5 * M, 2.0 * M);
    if (P.D1(k)) for (let i = 0; i < 7; i++) { const x = -W / 2 + 2 * M + i * 4.3 * M; k.box('rubber', x, -0.6 * M, qz - 0.1 * M, 1.2 * M, 1.2 * M, 0.4 * M); if (P.D2(k)) k.cyl('metal_dark', x + 1.6 * M, 0.5 * M, qz + 0.6 * M, 0.3 * M, 0.6 * M, { seg: 8 }); }
    for (const z of [qz + 2.4 * M, qz + 9.6 * M]) k.box('rail_track', 0, 0, z, W - 0.4 * M, 0.25 * M, 0.3 * M);
    // Zwei Containerbrücken mit Ausleger über das Wasser
    const sts = (x, col) => {
      const zf = qz + 2.4 * M, zb = qz + 9.6 * M, h = 14 * M;
      for (const z of [zf, zb]) for (const s of [-1, 1]) k.box(col, x + s * 3.2 * M, 0, z, 0.8 * M, h, 0.8 * M);
      for (const s of [-1, 1]) k.box(col, x + s * 3.2 * M, h, (zf + zb) / 2, 0.9 * M, 1.2 * M, zb - zf + 0.8 * M);
      for (const z of [zf, zb]) k.box(col, x, h, z, 7.2 * M, 1.0 * M, 0.8 * M);
      if (P.D1(k)) for (const s of [-1, 1]) { P.beam(k, col, [x + s * 3.2 * M, 1 * M, zf], [x + s * 3.2 * M, h - 1 * M, zb], 0.35 * M); P.beam(k, col, [x + s * 3.2 * M, 1 * M, zb], [x + s * 3.2 * M, h - 1 * M, zf], 0.35 * M); }
      // A-Rahmen und Ausleger
      for (const s of [-1, 1]) { P.beam(k, col, [x + s * 3.0 * M, h + 1 * M, zb], [x + s * 2.4 * M, h + 12 * M, (zf + zb) / 2], 0.6 * M); P.beam(k, col, [x + s * 3.0 * M, h + 1 * M, zf], [x + s * 2.4 * M, h + 12 * M, (zf + zb) / 2], 0.6 * M); }
      k.box(col, x, h + 11.4 * M, (zf + zb) / 2, 5.6 * M, 0.8 * M, 1.0 * M);
      const by = h + 5 * M, b0 = zb + 6 * M, b1 = qz - 18 * M;
      for (const s of [-1, 1]) k.box(col, x + s * 1.3 * M, by, (b0 + b1) / 2, 0.5 * M, 1.6 * M, b0 - b1);
      if (P.D1(k)) for (let i = 0; i < 6; i++) { const z = b1 + ((b0 - b1) * (i + 0.5)) / 6; k.box(col, x, by + 1.2 * M, z, 2.6 * M, 0.3 * M, 0.3 * M); }
      for (const s of [-1, 1]) { P.beam(k, 'metal_dark', [x + s * 2.4 * M, h + 11.8 * M, (zf + zb) / 2], [x + s * 1.3 * M, by + 1.6 * M, b1 + 2 * M], 0.12 * M); P.beam(k, 'metal_dark', [x + s * 2.4 * M, h + 11.8 * M, (zf + zb) / 2], [x + s * 1.3 * M, by + 1.6 * M, b0 - 1 * M], 0.12 * M); }
      k.box('metal_panel_white', x, by - 1.4 * M, zb + 2 * M, 3.4 * M, 3 * M, 4 * M);
      k.box('metal_dark', x, by - 1.0 * M, qz - 6 * M, 2.4 * M, 1.0 * M, 2.4 * M);
      if (P.D1(k)) { k.box('glass_window', x + 1.2 * M, by - 2.2 * M, qz - 4 * M, 1.4 * M, 1.4 * M, 1.4 * M, { lit: 0.9 }); k.box('metal_dark', x, 3.4 * M, qz - 6 * M, 2.4 * M, 0.5 * M, 6.2 * M); for (const s of [-1, 1]) k.box('metal_dark', x + s * 1.0 * M, 3.9 * M, qz - 6 * M, 0.05 * M, by - 5 * M, 0.05 * M); }
      if (P.D2(k)) { k.light(x, by + 1.8 * M, b1 + 1 * M, 0xff3a2a, 0.3); k.light(x, h + 12 * M, (zf + zb) / 2, 0xff3a2a, 0.3); }
    };
    sts(-7.0 * M, 'paint_blue');
    sts(6.6 * M, 'container_red');
    // Containerlager
    P.containerStack(k, -8.6 * M, 1.6 * M, 4, 2, 3, { long: true });
    P.containerStack(k, 6.4 * M, 1.6 * M, 4, 2, 3, { long: true });
    // Portalkran (RTG) über einem Block
    if (P.D1(k)) { const rx = 6.4 * M, rz = 1.6 * M; for (const s of [-1, 1]) for (const t of [-1, 1]) k.box('paint_yellow', rx + s * 6.4 * M, 0, rz + t * 4 * M, 0.6 * M, 10 * M, 0.6 * M); for (const t of [-1, 1]) k.box('paint_yellow', rx, 10 * M, rz + t * 4 * M, 13.4 * M, 0.9 * M, 0.9 * M); k.box('metal_dark', rx - 2 * M, 10.9 * M, rz, 2.4 * M, 1 * M, 8.8 * M); }
    // Tor, Verwaltung, Lkw
    P.slab(k, 'asphalt', 0, 11.4 * M, W - 0.6 * M, 6.4 * M);
    P.block(k, { x: -10 * M, z: 11.4 * M, w: 8 * M, d: 5 * M, floors: 3, wall: 'metal_panel_white', win: { frame: 'window_frame_dark', spacing: 2.0 * M }, cornice: 'paint_blue', roof: 'flat', clutter: 2 });
    P.signBox(k, 'HAFEN', -10 * M, 8.4 * M, 13.92 * M, 0, { px: 0.2 * M, bg: 'paint_blue' });
    P.canopy(k, 6.6 * M, 5 * M, 12.4 * M, 10 * M, 4 * M, { mat: 'metal_panel_white' });
    P.truck(k, 6.6 * M, 11.2 * M, -Math.PI / 2, { len: 12 * M, cab: 'paint_blue', body: 'container_green', bodyH: 2.6 * M });
    P.truck(k, 6.0 * M, 13.6 * M, Math.PI / 2, { len: 12 * M, cab: 'paint_white', body: 'container_red', bodyH: 2.6 * M });
    for (const x of [-13, 0, 13]) { k.cyl('metal_light', x * M, 0, 6.6 * M, 0.2 * M, 18 * M, { seg: 6 }); if (P.D1(k)) { k.box('emissive_cool', x * M, 18 * M, 6.6 * M, 2.4 * M, 0.5 * M, 0.8 * M); k.light(x * M, 18 * M, 6.6 * M, 0xeaf4ff, 1.0); } }
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Markthalle (2×1)
registerArch('market_hall', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'pavers');
    const hx = 0, hz = -1.6 * M, hw = 18.4 * M, hd = 6.4 * M, hh = 5 * M, brick = v ? 'brick_yellow' : 'brick_red';
    k.box(brick, hx, 0, hz, hw, hh, hd);
    k.box('stone_grey', hx, 0, hz, hw + 0.14 * M, 0.6 * M, hd + 0.14 * M);
    P.gridRow(k, 'front', hx, hz, hw, hd, 5, 1.0 * M, 2.0 * M, 2.8 * M, 3, 4, { arch: true, archMat: 'trim_stone', frame: 'metal_dark', margin: 1.2 * M });
    P.gridRow(k, 'back', hx, hz, hw, hd, 5, 1.0 * M, 2.0 * M, 2.8 * M, 3, 4, { arch: true, frame: 'metal_dark', margin: 1.2 * M });
    if (P.D1(k)) { k.band('trim_stone', hx, hz, hw, hd, hh - 0.4 * M, 0.4 * M, 0.12 * M); for (let i = 0; i <= 5; i++) k.box('trim_stone', hx - hw / 2 + 0.3 * M + (i * (hw - 0.6 * M)) / 5, 0, hz + hd / 2, 0.6 * M, hh, 0.2 * M); }
    // Glas-Tonnendach mit Rippen, halbrunde Giebel
    const R = hd / 2;
    barrel(k, 'glass_skylight', hx, hh, hz, hw - 0.2 * M, R, { lit: 0.92, flat: 0.7 });
    for (const s of [-1, 1]) {
      const geo = new THREE.CircleGeometry(R + 0.1 * M, P.segs(k, 14), 0, Math.PI);
      geo.scale(1, 0.7, 1);
      k.add(brick, geo, { x: hx + s * (hw / 2 - 0.05 * M), y: hh, z: hz, ry: s * Math.PI / 2 });
      if (P.D1(k)) { const g2 = new THREE.CircleGeometry(R * 0.6, P.segs(k, 10), 0, Math.PI); g2.scale(1, 0.7, 1); k.add('glass_window', g2, { x: hx + s * (hw / 2 + 0.02 * M), y: hh + 0.1 * M, z: hz, ry: s * Math.PI / 2, lit: 0.9 }); }
    }
    if (P.D1(k)) for (let i = 0; i <= 8; i++) { const x = hx - hw / 2 + 0.4 * M + (i * (hw - 0.8 * M)) / 8; const geo = new THREE.TorusGeometry(R + 0.04 * M, 0.08 * M, 4, P.segs(k, 12), Math.PI); geo.scale(1, 0.7, 1); k.add('metal_dark', geo, { x, y: hh, z: hz, ry: Math.PI / 2 }); }
    k.box('metal_dark', hx, hh + R * 0.7, hz, hw, 0.2 * M, 0.4 * M);
    // Portal mit Schriftzug
    k.box(brick, hx, 0, hz + hd / 2 + 0.3 * M, 4 * M, hh + 1.6 * M, 0.6 * M);
    P.pediment(k, hx, hh + 1.6 * M, hz + hd / 2 + 0.3 * M, 4.4 * M, 1.4 * M, 0.6 * M, 'trim_stone');
    P.door(k, hx, hz + hd / 2 + 0.6 * M, 0, { w: 2 * M, h: 3.0 * M, glass: true, frame: 'metal_dark' });
    P.text(k, 'MARKTHALLE', hx, hh + 0.7 * M, hz + hd / 2 + 0.62 * M, 0, 0.09 * M, 'trim_stone');
    // Marktstände
    const aw = ['awning_red', 'awning_green', 'awning_yellow', 'awning_striped', 'awning_blue'];
    const prod = ['paint_red', 'paint_orange', 'leaves_light', 'paint_yellow', 'field_crops', 'plaster_pink'];
    for (let i = 0; i < 4; i++) {
      const x = -7.6 * M + i * 4.3 * M + (i > 1 ? 2.6 * M : 0), z = 3.4 * M;
      k.box('wood_planks', x, 0, z, 2.6 * M, 0.9 * M, 1.2 * M);
      if (P.D1(k)) { for (let j = 0; j < 3; j++) k.box(pick(k.rng, prod), x - 0.8 * M + j * 0.8 * M, 0.9 * M, z, 0.7 * M, 0.25 * M, 0.9 * M); for (const s of [-1, 1]) k.box('metal_dark', x + s * 1.3 * M, 0, z - 0.5 * M, 0.08 * M, 2.4 * M, 0.08 * M); }
      k.box(aw[i % aw.length], x, 2.4 * M, z + 0.1 * M, 3.0 * M, 0.08 * M, 2.0 * M, { rx: 0.15 });
    }
    P.tree(k, -9.0 * M, 3.8 * M, 0.6); P.tree(k, 9.0 * M, 3.8 * M, 0.6);
    P.lamp(k, -3.0 * M, 4.4 * M, 4 * M, { globe: true }); P.lamp(k, 3.0 * M, 4.4 * M, 4 * M, { globe: true });
    return P.finish(k);
  },
});
