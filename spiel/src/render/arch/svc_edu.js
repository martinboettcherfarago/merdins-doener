// Bildung: Schule, Universität, Bibliothek, Kita, Gymnasium, Forschungszentrum. Besitzer: G5.
import * as THREE from 'three';
import { registerArch } from './index.js';
import * as P from './svc_parts.js';

const { M, FLOOR, pick } = P;
const dims = (ctx) => [ctx.fw * 10 * M, ctx.fd * 10 * M];

// Tonnendach (halber Zylinder) entlang x
export function barrel(k, mat, x, y0, z, len, r, o = {}) {
  const geo = new THREE.CylinderGeometry(r, r, len, P.segs(k, o.seg ?? 14), 1, false, 0, Math.PI);
  geo.rotateZ(Math.PI / 2);
  geo.scale(1, o.flat ?? 1, 1);
  if (o.ry) geo.rotateY(o.ry);
  k.add(mat, geo, { x, y: y0, z, lit: o.lit });
}
// Basketballkorb
function hoop(k, x, z, ry) {
  if (!P.D1(k)) return;
  const g = new P.G(k, x, z, ry);
  g.box('metal_dark', 0, 0, -0.6 * M, 0.15 * M, 3.4 * M, 0.15 * M);
  g.box('paint_white', 0, 2.9 * M, -0.5 * M, 1.8 * M, 1.1 * M, 0.08 * M);
  const [rx, rz] = g.p(0, -0.15 * M);
  if (P.D2(k)) P.torus(k, 'paint_orange', rx, 3.05 * M, rz, 0.23 * M, 0.025 * M, { seg: 10 });
}
// Tischtennisplatte aus Beton (typisch für deutsche Schulhöfe)
function pingpong(k, x, z, ry) {
  if (!P.D1(k)) return;
  const g = new P.G(k, x, z, ry);
  g.box('concrete', 0, 0, 0, 0.4 * M, 0.7 * M, 1.2 * M);
  g.box('court_blue', 0, 0.7 * M, 0, 1.5 * M, 0.08 * M, 2.7 * M);
  if (P.D2(k)) g.box('concrete_dark', 0, 0.78 * M, 0, 1.5 * M, 0.15 * M, 0.06 * M);
}
// Rutsche, Schaukel, Sandkasten
export function slide(k, x, z, ry, col = 'paint_red') {
  if (!P.D1(k)) return;
  const g = new P.G(k, x, z, ry);
  for (const s of [-1, 1]) for (const zz of [-0.5, 0.5]) g.box('wood_planks', s * 0.5 * M, 0, zz * M - 1 * M, 0.12 * M, 2.4 * M, 0.12 * M);
  g.box('wood_planks', 0, 1.4 * M, -1 * M, 1.2 * M, 0.12 * M, 1.2 * M);
  g.box(col, 0, 2.3 * M, -1 * M, 1.3 * M, 0.9 * M, 1.3 * M, { });
  g.prism(col, [[-0.45 * M, 0], [0.45 * M, 0], [0, 0.7 * M]], 1.3 * M, { y: 3.2 * M, z: -1 * M, ry: Math.PI / 2 });
  g.beam('paint_yellow', [0, 1.5 * M, -0.4 * M], [0, 0.2 * M, 1.6 * M], 0.7 * M, { d: 0.1 * M });
  g.beam('wood_planks', [0, 0, -1.9 * M], [0, 1.45 * M, -1.6 * M], 0.5 * M, { d: 0.08 * M });
}
export function swing(k, x, z, ry) {
  if (!P.D1(k)) return;
  const g = new P.G(k, x, z, ry);
  for (const s of [-1, 1]) { g.beam('metal_dark', [s * 1.4 * M, 0, -0.7 * M], [s * 1.4 * M, 2.4 * M, 0], 0.1 * M); g.beam('metal_dark', [s * 1.4 * M, 0, 0.7 * M], [s * 1.4 * M, 2.4 * M, 0], 0.1 * M); }
  g.beam('metal_dark', [-1.5 * M, 2.4 * M, 0], [1.5 * M, 2.4 * M, 0], 0.12 * M);
  if (!P.D2(k)) return;
  for (const s of [-0.6, 0.6]) { g.box('metal_light', s * M - 0.22 * M, 0.5 * M, 0, 0.03 * M, 1.9 * M, 0.03 * M); g.box('metal_light', s * M + 0.22 * M, 0.5 * M, 0, 0.03 * M, 1.9 * M, 0.03 * M); g.box(pick(k.rng, ['paint_red', 'paint_blue', 'paint_yellow']), s * M, 0.45 * M, 0, 0.6 * M, 0.06 * M, 0.3 * M); }
}
export function sandbox(k, x, z, s = 3 * M) {
  k.box('wood_planks', x, 0, z, s, 0.3 * M, s);
  k.box('sand', x, 0, z, s - 0.3 * M, 0.32 * M, s - 0.3 * M);
  if (P.D2(k)) { k.box('paint_red', x + 0.4 * M, 0.32 * M, z - 0.2 * M, 0.3 * M, 0.25 * M, 0.3 * M); k.cone('paint_yellow', x - 0.5 * M, 0.32 * M, z + 0.4 * M, 0.25 * M, 0.35 * M, { seg: 6 }); }
}

// ---------------------------------------------------------------- Schule (2×1)
registerArch('school', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'pavers');
    const wall = v ? 'brick_red' : 'plaster_ochre';
    const bx = -3.4 * M, bz = -1.6 * M, bw = 12.4 * M, bd = 6 * M, fl = 3, fh = 3.3 * M;
    const top = P.block(k, { x: bx, z: bz, w: bw, d: bd, floors: fl, fh, wall, win: { frame: 'window_frame_white', winW: 1.6 * M, winH: 1.8 * M, spacing: 2.2 * M, margin: 0.6 * M }, cornice: 'trim_stone', bands: v ? 'trim_stone' : null, roof: 'hip', roofMat: v ? 'roof_tiles_red' : 'roof_tiles_brown', roofH: 2.6 * M, skipGround: 'front' });
    void top;
    // Eingang mit Treppenhaus-Risalit, Uhr und Schriftzug
    k.box(wall, bx, 0, bz + bd / 2 + 0.4 * M, 3.4 * M, fl * fh + 0.8 * M, 0.8 * M);
    if (P.D1(k)) { P.gridWindow(k, bx, fh + 0.6 * M, bz + bd / 2 + 0.82 * M, 0, 1.4 * M, fh * 2 - 1.2 * M, 2, 6, { frame: 'window_frame_white' }); P.clock(k, bx, fl * fh + 0.1 * M, bz + bd / 2 + 0.86 * M, 0.6 * M); }
    k.gableRoof(v ? 'roof_tiles_red' : 'roof_tiles_brown', bx, fl * fh + 0.8 * M, bz + bd / 2 - 0.4 * M, 3.4 * M, 2.4 * M, 1.6 * M, { ridge: 'z', overhang: 0.2 * M });
    k.gableEnds(wall, bx, fl * fh + 0.8 * M, bz + bd / 2 - 0.4 * M, 3.4 * M, 2.4 * M, 1.6 * M, { ridge: 'z' });
    P.door(k, bx, bz + bd / 2 + 0.8 * M, 0, { w: 2 * M, h: 2.6 * M, glass: true, canopy: 'concrete' });
    P.text(k, 'SCHULE', bx, 3.1 * M, bz + bd / 2 + 0.86 * M, 0, 0.12 * M, 'trim_dark');
    for (let i = 0; i < 4; i++) { const x = bx - 5.2 * M + i * 2.2 * M + (i > 1 ? 4.4 * M : 0); k.window(x, 0.9 * M, bz + bd / 2 + 0.03 * M, 0, 1.6 * M, 1.8 * M, { frame: 'window_frame_white' }); }
    // Schulhof
    const yx = 6.2 * M;
    P.slab(k, 'asphalt', yx, -0.4 * M, 7 * M, 8.6 * M);
    if (P.D1(k)) {
      P.line(k, yx - 3 * M, -4.2 * M, yx + 3 * M, -4.2 * M); P.line(k, yx - 3 * M, -0.4 * M, yx + 3 * M, -0.4 * M);
      for (let i = 0; i < 4; i++) k.box(['paint_yellow', 'paint_white', 'paint_red', 'paint_white'][i], yx - 1.5 * M + (i % 2) * 0.9 * M, 0, 1.6 * M + Math.floor(i / 2) * 0.9 * M, 0.8 * M, P.MARK, 0.8 * M);
    }
    hoop(k, yx, -4.5 * M, 0);
    pingpong(k, yx - 1.6 * M, 2.2 * M, Math.PI / 2);
    k.cyl('wood_planks', yx + 1.6 * M, 0, -1.8 * M, 1.4 * M, 0.45 * M, { seg: P.segs(k, 12), open: true });
    P.tree(k, yx + 1.6 * M, -1.8 * M, 0.9);
    P.bikeRack(k, yx + 2.8 * M, 3.6 * M, 0, 4);
    P.bikeRack(k, bx + 4 * M, 3.4 * M, 0, 4);
    P.fence(k, 2.6 * M, D / 2 - 0.3 * M, W / 2 - 0.3 * M, D / 2 - 0.3 * M, { h: 1.4 * M, mat: 'metal_dark' });
    P.hedgeLine(k, -W / 2 + 0.4 * M, D / 2 - 0.5 * M, bx - 1.4 * M, D / 2 - 0.5 * M, 0.9 * M, 0.6 * M);
    P.lamp(k, 1.6 * M, 4 * M, 4 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Universität (3×2)
registerArch('university', {
  variants: 1,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx);
    P.lot(k, W, D, 'grass');
    // Hauptgebäude mit Säulenportikus und Kuppel
    const bx = 0, bz = -6 * M, bw = 16 * M, bd = 7 * M, fl = 3, fh = 3.6 * M;
    const top = P.block(k, { x: bx, z: bz, w: bw, d: bd, floors: fl, fh, wall: 'stone_sandstone', plinth: 'stone_dark', plinthH: 1.0 * M, win: { frame: 'window_frame_white', sill: true, spacing: 2.2 * M, winW: 1.1 * M, winH: 2.0 * M }, cornice: 'trim_stone', bands: 'trim_stone', roof: 'flat', roofMat: 'roof_copper', parapet: 'trim_stone', parapetH: 0.9 * M });
    const pz = bz + bd / 2 + 1.6 * M;
    k.box('stone_sandstone', bx, 0, pz - 0.4 * M, 7.6 * M, 1.0 * M, 3.4 * M);
    P.columns(k, bx - 3.2 * M, bx + 3.2 * M, pz + 0.6 * M, 1.0 * M, fh * 2 + 0.4 * M, 6, 0.32 * M);
    k.box('trim_stone', bx, fh * 2 + 1.4 * M, pz - 0.4 * M, 7.8 * M, 0.9 * M, 3.4 * M);
    P.pediment(k, bx, fh * 2 + 2.3 * M, pz - 0.4 * M, 8 * M, 2.2 * M, 3.4 * M);
    P.text(k, 'UNIVERSITAET', bx, fh * 2 + 1.85 * M, pz + 1.33 * M, 0, 0.13 * M, 'trim_dark');
    P.steps(k, bx, pz + 1.3 * M, 7.6 * M, 6);
    P.door(k, bx, bz + bd / 2, 0, { w: 2.2 * M, h: 3.4 * M, mat: 'wood_dark', frame: 'trim_stone', y0: 1.0 * M });
    // Tambour + Kuppel
    k.cyl('stone_sandstone', bx, top, bz, 2.8 * M, 2.4 * M, { seg: P.segs(k, 20) });
    if (P.D1(k)) for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; k.window(Math.sin(a) * 2.82 * M, top + 0.6 * M, bz + Math.cos(a) * 2.82 * M, a, 0.8 * M, 1.3 * M, { frame: 'window_frame_white' }); }
    k.dome('roof_copper', bx, top + 2.4 * M, bz, 3.0 * M, { seg: P.segs(k, 20), sy: 0.9 });
    k.cyl('roof_copper', bx, top + 5.0 * M, bz, 0.6 * M, 1.2 * M, { seg: 8 });
    k.cone('roof_copper', bx, top + 6.2 * M, bz, 0.7 * M, 1.2 * M, { seg: 8 });
    // Bibliothek (Glas) links, Hörsaal (Backstein) rechts
    const lx = -11.5 * M, lz = -3 * M;
    k.box('concrete_panel', lx, 0, lz, 6 * M, 11 * M, 12 * M);
    k.curtainWall('front', lx, lz, 6 * M, 12 * M, 0.5 * M, 10 * M, { glass: 'glass_curtain_green', fh: 3.3 * M, colW: 1.4 * M });
    k.curtainWall('right', lx, lz, 6 * M, 12 * M, 0.5 * M, 10 * M, { glass: 'glass_curtain_green', fh: 3.3 * M, colW: 1.4 * M });
    k.flatRoof('green_roof', 'concrete_panel', lx, 11 * M, lz, 6 * M, 12 * M, { parapet: 0.4 * M });
    P.signBox(k, 'BIBLIOTHEK', lx, 11.5 * M, lz + 6.02 * M, 0, { px: 0.11 * M, bg: 'trim_dark' });
    const hx = 11.5 * M, hz = -3.5 * M;
    P.block(k, { x: hx, z: hz, w: 6 * M, d: 11 * M, floors: 2, fh: 4 * M, wall: 'brick_red', win: { frame: 'window_frame_dark', winW: 1.4 * M, winH: 2.6 * M, spacing: 2.4 * M }, roof: 'gable', roofMat: 'roof_slate', roofH: 2.6 * M, ridge: 'z' });
    P.door(k, hx, hz + 5.5 * M, 0, { glass: true, w: 1.8 * M, canopy: 'metal_dark' });
    // Campus-Wiese mit Wegen, Bäumen, Brunnen
    P.walk(k, 'pavers', [[0, D / 2 - 0.2 * M], [0, pz + 1.5 * M]], 3 * M);
    P.walk(k, 'pavers', [[lx + 1 * M, 3.5 * M], [hx - 1 * M, 3.5 * M]], 1.8 * M);
    P.walk(k, 'gravel', [[-8 * M, 9.4 * M], [-2 * M, 3.5 * M]], 1.2 * M);
    P.walk(k, 'gravel', [[8 * M, 9.4 * M], [2 * M, 3.5 * M]], 1.2 * M);
    k.cyl('stone_grey', 0, 0, 3.5 * M, 2.0 * M, 0.5 * M, { seg: P.segs(k, 18) });
    k.cyl('water_pool', 0, 0, 3.5 * M, 1.7 * M, 0.52 * M, { seg: P.segs(k, 18) });
    if (P.D1(k)) { k.box('stone_dark', 0, 0.5 * M, 3.5 * M, 0.7 * M, 1.6 * M, 0.7 * M); k.box('metal_dark', 0, 2.1 * M, 3.5 * M, 0.45 * M, 1.4 * M, 0.45 * M); }
    for (const [x, z] of [[-10, 6], [-6, 8.5], [-12.5, 9], [10, 6.4], [6, 8.6], [12.6, 9], [-4.5, 6.2], [4.5, 6.2]]) P.tree(k, x * M, z * M, 0.75 + k.rng() * 0.3);
    for (const x of [-5, 5]) { P.bench(k, x * M, 2.4 * M, 0); P.lamp(k, x * 0.6 * M, 6.4 * M, 4 * M, { globe: true }); }
    P.bikeRack(k, 6.6 * M, 1.6 * M, 0, 6); P.bikeRack(k, -6.6 * M, 1.6 * M, 0, 5);
    for (const s of [-1.6, 1.6]) P.flagpole(k, s * M, 9.4 * M, 8 * M, s < 0 ? 'paint_blue' : 'paint_red');
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Bibliothek (1×1)
registerArch('library', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'pavers');
    if (v === 0) {
      // Klassizistischer Bau mit Säulenvorhalle
      const bx = 0, bz = -1.4 * M, bw = 8.4 * M, bd = 6 * M, h = 6.6 * M;
      k.box('stone_sandstone', bx, 0, bz, bw, 1.0 * M, bd);
      k.box('stone_sandstone', bx, 1.0 * M, bz, bw - 0.4 * M, h - 1.0 * M, bd - 0.4 * M);
      for (const sd of ['left', 'right', 'back']) P.gridRow(k, sd, bx, bz, bw - 0.4 * M, bd - 0.4 * M, 2, 1.8 * M, 1.1 * M, 3.0 * M, 2, 4, { arch: true, archMat: 'trim_stone', frame: 'window_frame_white' });
      if (P.D1(k)) k.band('trim_stone', bx, bz, bw - 0.4 * M, bd - 0.4 * M, h - 0.7 * M, 0.7 * M, 0.15 * M);
      k.flatRoof('roof_copper', 'trim_stone', bx, h, bz, bw - 0.4 * M, bd - 0.4 * M, { parapet: 0.5 * M });
      const pz = bz + bd / 2 + 1.0 * M;
      k.box('stone_sandstone', bx, 0, pz, 6 * M, 1.0 * M, 2.2 * M);
      P.columns(k, bx - 2.4 * M, bx + 2.4 * M, pz + 0.4 * M, 1.0 * M, 4.4 * M, 4, 0.28 * M);
      k.box('trim_stone', bx, 5.4 * M, pz - 0.1 * M, 6.2 * M, 0.8 * M, 2.6 * M);
      P.pediment(k, bx, 6.2 * M, pz - 0.1 * M, 6.4 * M, 1.6 * M, 2.6 * M);
      P.text(k, 'BIBLIOTHEK', bx, 5.8 * M, pz + 1.22 * M, 0, 0.1 * M, 'trim_dark');
      P.door(k, bx, bz + bd / 2 - 0.2 * M, 0, { w: 1.6 * M, h: 3 * M, mat: 'wood_dark', frame: 'trim_stone', y0: 1.0 * M });
      P.steps(k, bx, pz + 1.1 * M, 5 * M, 4, 0.25 * M, 0.35 * M);
    } else {
      // Moderner Glaskubus mit Bücherregalen
      const bx = 0, bz = -1.0 * M, bw = 8 * M, bd = 7 * M, h = 7.4 * M;
      k.box('concrete_panel', bx, 0, bz, bw, 0.6 * M, bd);
      k.box('wood_planks', bx, 0.6 * M, bz - bd / 2 + 0.6 * M, bw - 0.4 * M, h - 1.2 * M, 1.0 * M);
      if (P.D1(k)) {
        const cols = ['paint_red', 'paint_blue', 'paint_yellow', 'paint_green', 'paint_white', 'wood_dark'];
        for (let f = 0; f < 2; f++) for (let i = 0; i < 6; i++) k.box(pick(k.rng, cols), bx - 3 * M + i * 1.2 * M, 1.0 * M + f * 3.0 * M, bz - bd / 2 + 1.2 * M, 1.0 * M, 2.2 * M, 0.3 * M);
        k.box('concrete_panel', bx, 3.6 * M, bz, bw - 0.6 * M, 0.3 * M, bd - 0.6 * M);
      }
      for (const sd of ['front', 'left', 'right']) k.curtainWall(sd, bx, bz, bw, bd, 0.6 * M, h - 1.2 * M, { glass: 'glass_curtain_green', fh: 3.0 * M, colW: 1.3 * M });
      k.box('concrete_panel', bx, h - 0.6 * M, bz, bw + 0.8 * M, 0.6 * M, bd + 0.8 * M);
      k.box('green_roof', bx, h, bz, bw + 0.4 * M, 0.15 * M, bd + 0.4 * M);
      P.signBox(k, 'BIBLIOTHEK', bx, h - 0.15 * M, bz + bd / 2 + 0.42 * M, 0, { px: 0.11 * M, bg: 'trim_dark', frame: false });
      P.door(k, bx + 2.4 * M, bz + bd / 2 + 0.06 * M, 0, { glass: true, w: 1.6 * M });
    }
    for (const [x, z] of [[-4, 3.6], [4, 3.6]]) P.tree(k, x * M, z * M, 0.6);
    P.bench(k, -2.6 * M, 4.3 * M, Math.PI); P.bikeRack(k, 2.6 * M, 4.3 * M, 0, 3);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Kita (1×1)
registerArch('kindergarten', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'grass', { curb: false });
    const wall = v ? 'plaster_blue' : 'plaster_yellow';
    const bx = -1.6 * M, bz = -2.4 * M, bw = 6.4 * M, bd = 4.6 * M, h = 3.4 * M;
    k.box(wall, bx, 0, bz, bw, h, bd);
    k.box('wood_planks', bx, 0, bz, bw + 0.1 * M, 0.4 * M, bd + 0.1 * M);
    const frames = ['paint_red', 'paint_green', 'paint_blue', 'paint_orange'];
    for (let i = 0; i < 3; i++) k.window(bx - 2.2 * M + i * 2.2 * M, 0.6 * M, bz + bd / 2 + 0.03 * M, 0, 1.5 * M, 1.9 * M, { frame: frames[i], mullion: false });
    for (const sd of ['left', 'right']) { const [x, z, ry] = P.onSide(sd, bx, bz, bw, bd, 0, 0.03 * M); k.window(x, 0.8 * M, z, ry, 1.2 * M, 1.5 * M, { frame: frames[3] }); }
    k.gableRoof(v ? 'roof_tiles_anthracite' : 'roof_tiles_red', bx, h, bz, bw, bd, 2.2 * M, { ridge: 'x', overhang: 0.6 * M });
    k.gableEnds(wall, bx, h, bz, bw, bd, 2.2 * M, { ridge: 'x' });
    // Bunter Schriftzug KITA
    if (P.D1(k)) { const L = ['K', 'I', 'T', 'A'], cs = ['paint_red', 'paint_yellow', 'paint_green', 'paint_blue']; L.forEach((ch, i) => P.text(k, ch, bx + 1.8 * M + (i - 1.5) * 0.85 * M, 3.0 * M, bz + bd / 2 + 0.05 * M, 0, 0.12 * M, cs[i])); }
    P.door(k, bx + 2.6 * M, bz + bd / 2, 0, { w: 1.1 * M, h: 2.2 * M, mat: 'paint_green', canopy: 'wood_planks' });
    // Spielplatz
    slide(k, 2.8 * M, 0.8 * M, -Math.PI / 2, v ? 'paint_blue' : 'paint_red');
    sandbox(k, -2.6 * M, 2.0 * M, 2.8 * M);
    swing(k, 2.4 * M, 3.6 * M, 0);
    if (P.D1(k)) { k.box('rubber_track', 2.8 * M, 0, 1.6 * M, 4.4 * M, 0.08 * M, 5 * M); }
    P.tree(k, 3.8 * M, -3.6 * M, 0.8, { leaf: 'leaves_light' });
    P.bush(k, -4.2 * M, -0.2 * M, 1); P.bush(k, -4.2 * M, 4 * M, 0.8);
    // Holzzaun mit Tor
    const e = W / 2 - 0.25 * M;
    P.fenceRect(k, 0, 0, e * 2, e * 2, { h: 1.1 * M, mat: 'wood_planks', post: 'wood_planks', gate: 1.4 * M, gateX: 0.9 * M, step: 1.5 * M, gatePosts: false });
    P.bench(k, -0.6 * M, 3.2 * M, Math.PI / 2);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Gymnasium (2×2)
registerArch('highschool', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'pavers');
    const wall = v ? 'plaster_white' : 'brick_red';
    const fh = 3.3 * M;
    // L-förmiges Schulgebäude
    P.block(k, { x: -3.2 * M, z: -6.2 * M, w: 13 * M, d: 6.4 * M, floors: 4, fh, wall, win: { frame: 'window_frame_white', winW: 1.6 * M, winH: 1.8 * M, spacing: 2.2 * M }, cornice: 'trim_stone', bands: v ? 'paint_blue' : null, roof: 'flat', clutter: 2 });
    P.block(k, { x: -6.4 * M, z: 0.6 * M, w: 6.4 * M, d: 7.4 * M, floors: 3, fh, wall, win: { frame: 'window_frame_white', winW: 1.6 * M, winH: 1.8 * M, spacing: 2.2 * M }, cornice: 'trim_stone', roof: 'flat', sides: ['front', 'right', 'left'], skipGround: 'front' });
    k.curtainWall('front', -6.4 * M, 0.6 * M, 6.4 * M, 7.4 * M, 0.4 * M, fh - 0.6 * M, { glass: 'glass_curtain_blue', fh: fh - 0.6 * M });
    P.door(k, -6.4 * M, 4.32 * M, 0, { glass: true, w: 2.2 * M, canopy: 'concrete' });
    P.signBox(k, 'GYMNASIUM', -6.4 * M, 3 * fh + 0.2 * M, 4.32 * M, 0, { px: 0.15 * M, bg: v ? 'paint_blue' : 'trim_dark' });
    // Turnhalle mit Tonnendach
    const hx = 5.8 * M, hz = 1.2 * M, hw = 8 * M, hd = 7.6 * M;
    k.box('concrete_panel', hx, 0, hz, hw, 5.4 * M, hd);
    P.ribbon(k, 'front', hx, hz, hw, hd, 3.4 * M, 1.4 * M);
    P.ribbon(k, 'left', hx, hz, hw, hd, 3.4 * M, 1.4 * M);
    barrel(k, 'roof_metal_grey', hx, 5.4 * M, hz, hw + 0.3 * M, hd / 2 + 0.15 * M, { flat: 0.38 });
    P.door(k, hx - 2.4 * M, hz + hd / 2, 0, { w: 1.8 * M, glass: true });
    P.text(k, 'SPORTHALLE', hx + 1 * M, 4.4 * M, hz + hd / 2 + 0.05 * M, 0, 0.1 * M, 'trim_dark');
    // Kleinspielfeld hinten rechts
    const sx = 6.6 * M, sz = -7 * M;
    P.slab(k, 'rubber_track', sx, sz, 6.6 * M, 5.4 * M);
    P.slab(k, 'sports_turf', sx, sz, 5.4 * M, 4.2 * M, P.PAVE + 0.04 * M);
    if (P.D1(k)) { P.line(k, sx, sz - 2.0 * M, sx, sz + 2.0 * M, 0.1 * M, 'paint_white', P.MARK + 0.04 * M); for (const s of [-1, 1]) k.box('paint_white', sx + s * 2.6 * M, 0, sz, 0.1 * M, 1.2 * M, 1.6 * M); }
    P.fenceRect(k, sx, sz, 6.8 * M, 5.6 * M, { h: 2.6 * M, gate: 1.2 * M });
    // Schulhof
    hoop(k, 0.4 * M, -1.6 * M, 0);
    pingpong(k, 0.6 * M, 3.4 * M, 0);
    for (const [x, z] of [[-1.6, 7.6], [2.4, 7.4], [-8.4, 7.4]]) P.tree(k, x * M, z * M, 0.8);
    P.bikeRack(k, -1.6 * M, 9.2 * M, 0, 6); P.bikeRack(k, 4.6 * M, 9.2 * M, 0, 5);
    P.bench(k, 0.4 * M, 6.0 * M, 0);
    P.lamp(k, 1.4 * M, 8.6 * M, 4 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Forschungszentrum (2×2)
registerArch('research', {
  variants: 1,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx);
    P.lot(k, W, D, 'pavers');
    P.slab(k, 'grass', 4.6 * M, 6.4 * M, 9 * M, 6 * M);
    // Laborgebäude (Glas, Lamellen)
    const lx = -4.4 * M, lz = -3.6 * M, lw = 10 * M, ld = 9 * M, lh = 11 * M;
    k.box('metal_panel_white', lx, 0, lz, lw, lh, ld);
    k.curtainWall('front', lx, lz, lw, ld, 0.5 * M, lh - 1.2 * M, { glass: 'glass_curtain_blue', fh: 3.4 * M, colW: 1.2 * M });
    k.curtainWall('right', lx, lz, lw, ld, 0.5 * M, lh - 1.2 * M, { glass: 'glass_curtain_blue', fh: 3.4 * M, colW: 1.2 * M });
    if (P.D2(k)) for (let i = 0; i < 9; i++) k.box('metal_panel_white', lx - lw / 2 + 0.6 * M + i * 1.1 * M, 0.5 * M, lz + ld / 2 + 0.35 * M, 0.12 * M, lh - 1.2 * M, 0.5 * M);
    k.flatRoof('roof_flat_membrane', 'metal_panel_white', lx, lh, lz, lw, ld, { parapet: 0.4 * M });
    for (let i = 0; i < 3; i++) P.fanUnit(k, lx - 3 * M + i * 3 * M, lh, lz - 2 * M, 0.8 * M);
    k.box('metal_panel_grey', lx + 2.6 * M, lh, lz + 1.6 * M, 3 * M, 1.8 * M, 2.4 * M);
    // Flachbau mit Sternwartenkuppel
    const fx = -6.4 * M, fz = 5.6 * M;
    k.box('concrete_panel', fx, 0, fz, 6 * M, 4 * M, 6.4 * M);
    P.ribbon(k, 'front', fx, fz, 6 * M, 6.4 * M, 1.2 * M, 1.8 * M);
    P.ribbon(k, 'right', fx, fz, 6 * M, 6.4 * M, 1.2 * M, 1.8 * M);
    k.flatRoof('roof_flat_gravel', 'concrete_panel', fx, 4 * M, fz, 6 * M, 6.4 * M, { parapet: 0.3 * M });
    k.cyl('metal_panel_white', fx, 4 * M, fz, 2.0 * M, 1.0 * M, { seg: P.segs(k, 16) });
    k.dome('metal_light', fx, 5 * M, fz, 2.0 * M, { seg: P.segs(k, 16) });
    if (P.D1(k)) k.box('metal_dark', fx, 5.2 * M, fz + 0.4 * M, 0.7 * M, 1.8 * M, 1.6 * M, { rx: -0.5 });
    P.door(k, fx, fz + 3.2 * M, 0, { glass: true, w: 1.8 * M, canopy: 'metal_panel_white' });
    P.signBox(k, 'FORSCHUNG', fx, 3.5 * M, fz + 3.22 * M, 0, { px: 0.13 * M, bg: 'paint_blue' });
    // Radioteleskop
    const tx = 5.4 * M, tz = -4.8 * M;
    k.cyl('concrete', tx, 0, tz, 2.0 * M, 0.8 * M, { seg: P.segs(k, 14) });
    k.box('paint_white', tx, 0.8 * M, tz, 2.4 * M, 3.4 * M, 1.6 * M);
    const dish = [];
    const n = k.detail >= 2 ? 8 : 5, R = 4.4 * M;
    for (let i = 0; i <= n; i++) { const r = (R * i) / n; dish.push([r + 0.001, (r * r) / (R * 2.4)]); }
    for (let i = n; i >= 0; i--) { const r = (R * i) / n; dish.push([r + 0.001, (r * r) / (R * 2.4) - 0.25 * M]); }
    P.lathe(k, 'paint_white', tx, 5.0 * M, tz, dish.reverse(), P.segs(k, 24), { rx: 0.75 });
    if (P.D1(k)) {
      const fy = 5.2 * M;
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; P.beam(k, 'metal_light', [tx + Math.cos(a) * 2.8 * M, fy + Math.sin(a) * 2.2 * M - 0.6 * M, tz + 1.0 * M + Math.sin(a) * 1.2 * M], [tx, fy + 3.0 * M, tz + 3.2 * M], 0.12 * M); }
      k.box('metal_light', tx, fy + 2.7 * M, tz + 3.0 * M, 0.6 * M, 0.6 * M, 0.6 * M);
    }
    for (const [x, z] of [[1.6, 8.4], [4.6, 7.6], [8, 8.4], [8.6, 4.4]]) P.tree(k, x * M, z * M, 0.7);
    P.parking(k, 4.4 * M, 1.6 * M, 9.4 * M, 3.4 * M, { rows: 1, fill: 0.6 });
    P.lamp(k, 0.4 * M, 8.6 * M, 4 * M);
    return P.finish(k);
  },
});
