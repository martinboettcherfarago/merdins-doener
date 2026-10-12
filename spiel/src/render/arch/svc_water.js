// Wasser, Abwasser und Müll: Wasserturm, Pumpwerk, Wasserwerk, Kläranlage, Abwasserauslass,
// Deponie, Müllverbrennung, Recyclinghof. Besitzer: G5. Wasserseite (falls nötig) = hinten (−z).
import * as THREE from 'three';
import { registerArch } from './index.js';
import * as P from './svc_parts.js';

const { M, pick } = P;
const dims = (ctx) => [ctx.fw * 10 * M, ctx.fd * 10 * M];

// Offener Container (Mulde) mit Füllung
function skip(k, x, z, ry, mat, fill, o = {}) {
  const g = new P.G(k, x, z, ry);
  const L = o.len ?? 5.5 * M, w = o.w ?? 2.4 * M, h = o.h ?? 1.6 * M;
  g.box(mat, 0, 0, 0, w, h, L);
  g.box(fill, 0, 0, 0, w - 0.3 * M, h - (o.low ?? 0.35) * M, L - 0.3 * M);
  if (P.D2(k)) for (const s of [-1, 1]) g.box('metal_dark', s * (w / 2 + 0.03 * M), 0.2 * M, 0, 0.06 * M, 0.25 * M, L * 0.9);
}
// Rundbecken mit Wasser, Rand und drehender Räumerbrücke
function roundBasin(k, x, z, r, o = {}) {
  const seg = P.segs(k, 28);
  k.cyl('concrete', x, 0, z, r + 0.35 * M, 1.1 * M, { seg, open: true });
  k.cyl('concrete', x, 0, z, r + 0.35 * M, 0.2 * M, { seg });
  P.disk(k, o.water || 'water_canal', x, 0.85 * M, z, r, { seg });
  if (k.detail > 0) P.ring(k, 'concrete', x, 1.1 * M, z, r, r + 0.35 * M, { seg });
  if (P.D2(k)) P.ring(k, 'concrete_dark', x, 0.9 * M, z, r - 0.5 * M, r - 0.3 * M, { seg });
  k.cyl('concrete', x, 0, z, 0.7 * M, 1.6 * M, { seg: P.segs(k, 10) });
  P.anim(k, [x, 1.6 * M, z], 'y', o.speed ?? 0.12, (s) => {
    s.box('metal_light', r / 2, 0, 0, r + 0.2 * M, 0.35 * M, 1.1 * M);
    s.box(o.bridge || 'paint_blue', r / 2, 0.35 * M, 0, r + 0.2 * M, 0.12 * M, 1.2 * M);
    if (s.detail >= 2) {
      for (const sd of [-1, 1]) s.box('metal_dark', r / 2, 0.47 * M, sd * 0.6 * M, r, 0.9 * M, 0.05 * M);
      s.box('metal_light', r - 0.1 * M, -0.5 * M, 0, 0.5 * M, 0.5 * M, 0.7 * M);
      s.box('metal_dark', r * 0.55, -0.7 * M, 0.3 * M, 0.08 * M, 0.7 * M, 0.08 * M);
    }
    s.cyl('metal_dark', 0, 0, 0, 0.9 * M, 0.6 * M, { seg: 10 });
  });
}
// Rechteckbecken mit Wasser
function rectBasin(k, x, z, sx, sz, o = {}) {
  const h = o.h ?? 1.1 * M, t = 0.35 * M;
  k.box('concrete', x, 0, z, sx, 0.25 * M, sz);
  for (const s of [-1, 1]) { k.box('concrete', x, 0, z + s * (sz / 2 - t / 2), sx, h, t); k.box('concrete', x + s * (sx / 2 - t / 2), 0, z, t, h, sz - 2 * t); }
  k.box(o.water || 'water_canal', x, 0, z, sx - 2 * t, h - 0.25 * M, sz - 2 * t);
}

// ---------------------------------------------------------------- Wasserturm (1×1)
registerArch('watertower', {
  variants: 3,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'grass', { curb: false });
    P.slab(k, 'pavers', 0, 0, 7.6 * M, 7.6 * M);
    P.slab(k, 'pavers', 0, 4.3 * M, 2.2 * M, 1.4 * M);
    if (v === 0) {
      // Historischer Backstein-Wasserturm
      const s8 = { seg: 8, ry: Math.PI / 8 };
      k.cyl('stone_grey', 0, 0, 0, 3.3 * M, 1.2 * M, s8);
      k.cyl('brick_red', 0, 1.2 * M, 0, 3.0 * M, 13 * M, { ...s8, rTop: 2.6 * M });
      if (P.D1(k)) for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; k.box('brick_dark', Math.sin(a) * 2.85 * M, 1.2 * M, Math.cos(a) * 2.85 * M, 0.6 * M, 13 * M, 0.3 * M, { ry: a, rx: 0 }); }
      for (const [y, ry] of [[3, 0], [7, 0], [10.5, 0], [7, Math.PI / 2], [7, -Math.PI / 2], [11, Math.PI]]) {
        const rr = 3.0 * M - 0.4 * M * (y / 13) + 0.02 * M;
        k.window(Math.sin(ry) * rr, y * M, Math.cos(ry) * rr, ry, 0.8 * M, 1.6 * M, { frame: 'window_frame_white', sill: true });
      }
      k.cyl('trim_stone', 0, 14.2 * M, 0, 2.7 * M, 1.0 * M, { seg: P.segs(k, 16), rTop: 4.3 * M });
      k.cyl(pick(k.rng, ['plaster_cream', 'plaster_ochre']), 0, 15.2 * M, 0, 4.2 * M, 5.2 * M, { seg: P.segs(k, 16) });
      if (P.D1(k)) { k.cyl('trim_stone', 0, 15.2 * M, 0, 4.3 * M, 0.35 * M, { seg: P.segs(k, 16) }); k.cyl('trim_stone', 0, 20.1 * M, 0, 4.35 * M, 0.4 * M, { seg: P.segs(k, 16) }); }
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; k.window(Math.sin(a) * 4.22 * M, 16.6 * M, Math.cos(a) * 4.22 * M, a, 1.0 * M, 1.8 * M, { frame: 'window_frame_white' }); }
      if (P.D2(k)) for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; k.box('wood_dark', Math.sin(a) * 4.22 * M, 15.6 * M, Math.cos(a) * 4.22 * M, 0.25 * M, 4.4 * M, 0.06 * M, { ry: a }); }
      k.cone('roof_slate', 0, 20.5 * M, 0, 4.9 * M, 3.6 * M, { seg: P.segs(k, 16) });
      k.cyl('roof_copper', 0, 23.6 * M, 0, 0.9 * M, 1.4 * M, { seg: 8 });
      k.cone('roof_copper', 0, 25 * M, 0, 1.1 * M, 2.0 * M, { seg: 8 });
      if (P.D1(k)) k.cyl('metal_dark', 0, 27 * M, 0, 0.05 * M, 1.6 * M, { seg: 4 });
      P.door(k, 0, 3.05 * M, 0, { w: 1.4 * M, h: 2.6 * M, y0: 0, mat: 'wood_dark', frame: 'trim_stone' });
      P.steps(k, 0, 3.0 * M, 2 * M, 2);
    } else if (v === 1) {
      // Pilzförmiger Betonwasserturm
      k.cyl('concrete', 0, 0, 0, 2.2 * M, 0.8 * M, { seg: P.segs(k, 16) });
      k.cyl('concrete_panel', 0, 0.8 * M, 0, 1.6 * M, 15.5 * M, { seg: P.segs(k, 16), rTop: 1.4 * M });
      const prof = [[1.4, 16], [2.4, 17.2], [4.0, 18.6], [4.9, 19.8], [5.0, 21.6], [4.6, 22.6], [3.2, 23.4], [0.01, 23.8]].map(([r, y]) => [r * M, y * M]);
      P.lathe(k, 'concrete_panel', 0, 0, 0, prof, P.segs(k, 24));
      if (P.D1(k)) { k.cyl('trim_dark', 0, 20.6 * M, 0, 5.03 * M, 0.6 * M, { seg: P.segs(k, 24), open: true }); for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; k.box('concrete', Math.sin(a) * 1.5 * M, 0.8 * M, Math.cos(a) * 1.5 * M, 0.25 * M, 15 * M, 0.2 * M, { ry: a }); } }
      if (P.D2(k)) { for (const [x, h] of [[-1, 4], [1.2, 3]]) { k.cyl('metal_light', x * M, 23.4 * M, 0, 0.08 * M, h * M, { seg: 5 }); } k.light(0, 24 * M, 0, 0xff3a2a, 0.25); }
      P.door(k, 0, 1.6 * M, 0, { w: 1.2 * M, h: 2.3 * M, y0: 0.8 * M, mat: 'metal_dark', frame: 'concrete_dark' });
      P.steps(k, 0, 1.6 * M, 1.8 * M, 4);
    } else {
      // Kugelbehälter auf Stützen
      k.cyl('concrete', 0, 0, 0, 3.2 * M, 0.5 * M, { seg: P.segs(k, 16) });
      k.cyl('tank_white', 0, 0.5 * M, 0, 0.7 * M, 15 * M, { seg: P.segs(k, 10) });
      P.sphereTank(k, 0, 0, 4.4 * M, { y: 18.5 * M, legs: 6, mat: 'tank_white', legMat: 'tank_white', stair: false });
      if (P.D1(k)) {
        k.cyl('paint_blue', 0, 17.8 * M, 0, 4.42 * M, 1.4 * M, { seg: P.segs(k, 24), open: true });
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.2, b = a + Math.PI / 3; P.beam(k, 'tank_white', [Math.cos(a) * 4.3 * M, 8 * M, Math.sin(a) * 4.3 * M], [Math.cos(b) * 4.3 * M, 8 * M, Math.sin(b) * 4.3 * M], 0.18 * M); }
        P.textArc(k, 'WASSER', 0, 18.5 * M, 0, 4.43 * M, 0.5, 0.2 * M, 'paint_white');
        P.textArc(k, 'WASSER', 0, 18.5 * M, 0, 4.43 * M, 0.5 + Math.PI, 0.2 * M, 'paint_white');
      }
      k.box('plaster_white', 0, 0, 2.6 * M, 2.4 * M, 2.6 * M, 1.6 * M);
      P.door(k, 0, 3.4 * M, 0, { w: 1 * M, h: 2.1 * M, mat: 'metal_dark' });
    }
    P.tree(k, -3.8 * M, -3.6 * M, 0.8); P.bush(k, 3.8 * M, 3.6 * M, 1.2); P.bush(k, -3.9 * M, 3.4 * M, 1);
    P.lamp(k, 2.4 * M, 4.4 * M, 3.5 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Pumpwerk (1×1), Einlauf hinten
registerArch('pump', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'grass', { curb: false });
    P.slab(k, 'pavers', 0, 3.8 * M, 2 * M, 2.4 * M);
    // Einlaufbauwerk hinten
    k.box('concrete', 0, 0, -3.6 * M, W - 0.6 * M, 1.1 * M, 2.8 * M);
    P.railing(k, -W / 2 + 0.4 * M, -4.9 * M, W / 2 - 0.4 * M, -4.9 * M, 1.1 * M);
    for (const s of [-1.6, 1.6]) {
      P.pipeline(k, 'pipe_metal', [[s * M, 1.8 * M, -1.5 * M], [s * M, 1.8 * M, -4.3 * M], [s * M, -0.6 * M, -4.3 * M]], 0.45 * M);
      if (P.D1(k)) k.box('concrete_dark', s * M, 1.1 * M, -3 * M, 1.2 * M, 0.7 * M, 0.6 * M);
    }
    if (P.D1(k)) { k.box('metal_dark', 0, 0, -4.95 * M, W - 1.2 * M, 1.0 * M, 0.12 * M); }
    if (P.D2(k)) { k.box('paint_yellow', 3.6 * M, 1.1 * M, -3.6 * M, 0.3 * M, 3.4 * M, 0.3 * M); k.box('paint_yellow', 2.9 * M, 4.3 * M, -3.8 * M, 1.8 * M, 0.25 * M, 0.25 * M); k.box('metal_dark', 2.2 * M, 3.3 * M, -3.8 * M, 0.05 * M, 1.0 * M, 0.05 * M); }
    // Pumpenhaus
    const brick = v ? 'brick_yellow' : 'brick_red';
    const hx = 0, hz = 0.9 * M, hw = 6.4 * M, hd = 4.8 * M, hh = 4.8 * M;
    k.box(brick, hx, 0, hz, hw, hh, hd);
    k.box('stone_grey', hx, 0, hz, hw + 0.14 * M, 0.7 * M, hd + 0.14 * M);
    P.gridRow(k, 'left', hx, hz, hw, hd, 2, 1.2 * M, 1.1 * M, 2.2 * M, 2, 3, { arch: true, archMat: 'trim_stone', frame: 'window_frame_white' });
    P.gridRow(k, 'right', hx, hz, hw, hd, 2, 1.2 * M, 1.1 * M, 2.2 * M, 2, 3, { arch: true, archMat: 'trim_stone', frame: 'window_frame_white' });
    P.gridRow(k, 'front', hx, hz, hw, hd, 2, 1.2 * M, 1.1 * M, 2.2 * M, 2, 3, { arch: true, archMat: 'trim_stone', frame: 'window_frame_white', margin: 0.4 * M, shift: 0 });
    if (P.D1(k)) k.band('trim_stone', hx, hz, hw, hd, hh - 0.35 * M, 0.35 * M, 0.1 * M);
    k.gableRoof(v ? 'roof_tiles_anthracite' : 'roof_tiles_red', hx, hh, hz, hw, hd, 2.4 * M, { ridge: 'x', overhang: 0.4 * M });
    k.gableEnds(brick, hx, hh, hz, hw, hd, 2.4 * M, { ridge: 'x' });
    if (P.D2(k)) { k.box('roof_metal_grey', hx, hh + 2.1 * M, hz, 1 * M, 0.9 * M, 1 * M); k.cone('roof_metal_grey', hx, hh + 3 * M, hz, 0.8 * M, 0.6 * M, { seg: 4, ry: Math.PI / 4 }); }
    P.door(k, hx, hz + hd / 2, 0, { w: 1.4 * M, h: 2.5 * M, mat: 'paint_blue', frame: 'trim_stone' });
    P.signBox(k, 'PUMPWERK', hx, 3.9 * M, hz + hd / 2, 0, { px: 0.1 * M, bg: 'paint_blue' });
    if (P.D1(k)) { k.box('metal_panel_grey', 4.0 * M, 0, 2.4 * M, 0.9 * M, 1.6 * M, 0.6 * M); P.pipeline(k, 'paint_blue', [[-3.2 * M, 0.9 * M, 2.4 * M], [-4.2 * M, 0.9 * M, 2.4 * M], [-4.2 * M, -0.3 * M, 2.4 * M]], 0.3 * M); }
    P.bush(k, -3.8 * M, 4 * M, 1.1); P.bush(k, 3.9 * M, 4.1 * M, 0.9);
    P.lamp(k, 1.6 * M, 4.4 * M, 3.4 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Wasserwerk (2×2)
registerArch('waterworks', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'grass');
    P.slab(k, 'asphalt', 3.4 * M, 6.8 * M, 3.6 * M, 6 * M);
    P.slab(k, 'concrete', 0, -5 * M, W - 0.8 * M, 9.4 * M);
    // Absetzbecken (rund) und Filterbecken
    roundBasin(k, -5.2 * M, -5.2 * M, 3.7 * M, { bridge: 'paint_blue', speed: 0.1 });
    const fx = 4.8 * M, fz = -5.4 * M;
    k.box('concrete', fx, 0, fz, 9.4 * M, 0.3 * M, 8.2 * M);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) rectBasin(k, fx - 2.3 * M + i * 4.6 * M, fz - 2.0 * M + j * 4.0 * M, 4.2 * M, 3.6 * M, { h: 1.2 * M });
    if (P.D1(k)) { k.box('concrete', fx, 1.2 * M, fz, 0.9 * M, 0.15 * M, 8.2 * M); P.railing(k, fx - 0.45 * M, fz - 4 * M, fx - 0.45 * M, fz + 4 * M, 1.35 * M); P.railing(k, fx + 0.45 * M, fz - 4 * M, fx + 0.45 * M, fz + 4 * M, 1.35 * M); }
    P.pipeline(k, 'paint_blue', [[-1.4 * M, 0.6 * M, -5.2 * M], [0.1 * M, 0.6 * M, -5.2 * M], [0.1 * M, 0.6 * M, -0.6 * M]], 0.35 * M);
    // Hauptgebäude mit Uhrturm
    const brick = v ? 'brick_yellow' : 'brick_red';
    const hx = -3.4 * M, hz = 4.6 * M, hw = 10 * M, hd = 6 * M, hh = 6.2 * M;
    k.box(brick, hx, 0, hz, hw, hh, hd);
    k.box('stone_grey', hx, 0, hz, hw + 0.14 * M, 0.8 * M, hd + 0.14 * M);
    P.gridRow(k, 'front', hx, hz, hw, hd, 4, 1.4 * M, 1.4 * M, 2.5 * M, 2, 4, { arch: true, archMat: 'trim_stone', frame: 'window_frame_white' });
    P.gridRow(k, 'right', hx, hz, hw, hd, 2, 1.4 * M, 1.4 * M, 3 * M, 2, 4, { arch: true, archMat: 'trim_stone', frame: 'window_frame_white' });
    P.gridRow(k, 'back', hx, hz, hw, hd, 4, 1.4 * M, 1.4 * M, 3 * M, 2, 4, { arch: true, frame: 'window_frame_white' });
    if (P.D1(k)) k.band('trim_stone', hx, hz, hw, hd, hh - 0.4 * M, 0.4 * M, 0.12 * M);
    k.hipRoof('roof_tiles_red', hx, hh, hz, hw, hd, 2.6 * M, { overhang: 0.4 * M, ridgeK: 0.7 });
    const tx = -7.4 * M, tz = 6.4 * M;
    k.box(brick, tx, 0, tz, 3 * M, 12 * M, 3 * M);
    if (P.D1(k)) { k.band('trim_stone', tx, tz, 3 * M, 3 * M, 11.4 * M, 0.6 * M, 0.15 * M); for (const sd of ['front', 'right']) { const [x, z, ry] = P.onSide(sd, tx, tz, 3 * M, 3 * M, 0, 0.06 * M); P.clock(k, x, 9.8 * M, z, 0.8 * M, ry); } }
    k.hipRoof('roof_copper', tx, 12 * M, tz, 3 * M, 3 * M, 3 * M, { overhang: 0.3 * M, ridgeK: 1 });
    P.door(k, hx + 1.2 * M, hz + hd / 2, 0, { w: 1.8 * M, h: 2.8 * M, mat: 'wood_dark', frame: 'trim_stone' });
    P.text(k, 'WASSERWERK', hx + 1.2 * M, 5.2 * M, hz + hd / 2 + 0.05 * M, 0, 0.13 * M, 'trim_stone');
    // Reinwasserbehälter (begrünter Hügel mit Lüftern)
    P.mound(k, 'grass', 6.4 * M, 4.8 * M, 3.6 * M, 1.8 * M, { sz: 1.05 });
    if (P.D1(k)) for (const [x, z] of [[5.4, 4.2], [7.4, 5.4]]) { k.cyl('metal_light', x * M, 1.4 * M, z * M, 0.2 * M, 1.0 * M, { seg: 6 }); k.cone('metal_dark', x * M, 2.4 * M, z * M, 0.4 * M, 0.3 * M, { seg: 6 }); }
    P.tree(k, 1 * M, 9 * M, 0.7); P.tree(k, -9 * M, 1.4 * M, 0.8);
    P.fenceRect(k, 0, 0, W - 0.4 * M, D - 0.4 * M, { h: 1.8 * M, gate: 3.6 * M, gateX: 3.4 * M });
    P.lamp(k, 1.4 * M, 6 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Kläranlage (2×2)
registerArch('sewage_plant', {
  variants: 1,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx);
    P.lot(k, W, D, 'grass');
    P.slab(k, 'concrete', 0, -1 * M, W - 0.6 * M, 17 * M);
    P.slab(k, 'asphalt', 5.6 * M, 7.6 * M, 3.6 * M, 4.4 * M);
    // Faulbehälter (Eier) mit Brücke und Treppenturm
    const egg = (x, z, H, R) => {
      const n = k.detail >= 2 ? 12 : k.detail === 1 ? 8 : 6, prof = [];
      for (let i = 0; i <= n; i++) { const t = i / n, a = Math.PI * t; prof.push([R * Math.sin(a) * (1 + 0.12 * Math.cos(a)) + 0.001, 2.2 * M + H * (1 - Math.cos(a)) / 2]); }
      k.cyl('concrete', x, 0, z, R * 0.6, 2.6 * M, { seg: P.segs(k, 14) });
      P.lathe(k, 'metal_light', x, 0, z, prof, P.segs(k, 22));
      if (P.D1(k)) k.cyl('metal_dark', x, 2.2 * M + H - 0.2 * M, z, 1.2 * M, 0.9 * M, { seg: 10 });
    };
    egg(-6.4 * M, -6.4 * M, 12 * M, 3.0 * M);
    egg(-0.6 * M, -6.6 * M, 11 * M, 2.8 * M);
    k.box('metal_dark', -3.5 * M, 0, -8.4 * M, 1.6 * M, 14.2 * M, 1.6 * M);
    if (P.D1(k)) { k.box('metal_dark', -3.5 * M, 13.6 * M, -6.6 * M, 6.4 * M, 0.25 * M, 1.0 * M); P.railing(k, -6.6 * M, -6.1 * M, -0.4 * M, -6.1 * M, 13.85 * M); }
    // Gasspeicher (Membrankuppel) und Fackel
    k.cyl('concrete', 4.8 * M, 0, -7.8 * M, 2.4 * M, 0.6 * M, { seg: P.segs(k, 16) });
    k.dome('canvas_white', 4.8 * M, 0.6 * M, -7.8 * M, 2.3 * M, { seg: P.segs(k, 16), sy: 0.9 });
    k.cyl('metal_dark', 8.6 * M, 0, -8.6 * M, 0.2 * M, 7 * M, { seg: 6 });
    if (P.D1(k)) { k.cyl('metal_light', 8.6 * M, 7 * M, -8.6 * M, 0.35 * M, 0.6 * M, { seg: 8 }); k.cone('emissive_warm', 8.6 * M, 7.6 * M, -8.6 * M, 0.3 * M, 0.9 * M, { seg: 6 }); k.light(8.6 * M, 8 * M, -8.6 * M, 0xffa040, 0.4); }
    // Belebungsbecken mit Schaum
    const ax = -4.2 * M, az = 1.6 * M;
    rectBasin(k, ax, az, 10.4 * M, 6 * M, { h: 1.2 * M });
    if (P.D1(k)) {
      k.box('concrete', ax, 0, az, 10.4 * M, 1.2 * M, 0.4 * M);
      k.box('concrete', ax, 1.2 * M, az, 10.4 * M, 0.12 * M, 0.9 * M);
      P.railing(k, ax - 5.2 * M, az + 0.45 * M, ax + 5.2 * M, az + 0.45 * M, 1.32 * M);
      for (let i = 0; i < (P.D2(k) ? 14 : 6); i++) {
        const fx = ax + (k.rng() - 0.5) * 9 * M, fz = az + (k.rng() < 0.5 ? -1.5 : 1.5) * M + (k.rng() - 0.5) * 1.4 * M;
        P.disk(k, 'canvas_white', fx, 1.0 * M, fz, (0.3 + k.rng() * 0.5) * M, { seg: 7 });
      }
    }
    // Nachklärbecken mit Räumerbrücke
    roundBasin(k, 5.2 * M, 0.4 * M, 3.8 * M, { bridge: 'paint_green', speed: 0.14 });
    // Betriebsgebäude
    const bx = -4 * M, bz = 7.4 * M;
    P.block(k, { x: bx, z: bz, w: 8.6 * M, d: 4 * M, floors: 2, wall: 'plaster_white', win: { spacing: 2.2 * M, frame: 'window_frame_dark' }, cornice: 'trim_dark', roof: 'flat', clutter: 1, skipGround: 'front' });
    P.door(k, bx - 1.6 * M, bz + 2 * M, 0, { glass: true, canopy: 'concrete' });
    P.ribbon(k, 'front', bx + 1.2 * M, bz, 5 * M, 4 * M, 1.0 * M, 1.4 * M, { margin: 0.3 * M });
    P.signBox(k, 'KLAERWERK', bx + 1.2 * M, 5.6 * M, bz + 2 * M, 0, { px: 0.13 * M, bg: 'paint_green' });
    P.pipeline(k, 'paint_green', [[ax + 5.2 * M, 0.6 * M, az + 2 * M], [1.4 * M, 0.6 * M, az + 2 * M]], 0.3 * M);
    P.fenceRect(k, 0, 0, W - 0.4 * M, D - 0.4 * M, { h: 1.8 * M, gate: 3.6 * M, gateX: 5.6 * M });
    P.lamp(k, 3.4 * M, 6 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Abwasserauslass (1×1), Auslauf hinten
registerArch('sewage_outlet', {
  variants: 1,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx);
    P.lot(k, W, D, 'grass_dry', { curb: false });
    P.slab(k, 'gravel', 1.6 * M, 2.6 * M, 2.2 * M, 4.8 * M);
    // Gerinne mit Schlamm und Stirnwand
    k.box('concrete', 0, 0, -2.8 * M, 4.4 * M, 0.9 * M, 4.4 * M);
    k.box('dirt', 0, 0, -2.9 * M, 3.2 * M, 0.95 * M, 4.2 * M);
    if (P.D1(k)) for (let i = 0; i < 4; i++) P.disk(k, 'grass_dry', (k.rng() - 0.5) * 2.4 * M, 0.97 * M, -1.6 * M - i * 0.8 * M, 0.3 * M, { seg: 6 });
    k.box('concrete', 0, 0, -0.4 * M, 5.6 * M, 2.8 * M, 0.9 * M);
    if (P.D1(k)) k.box('concrete_dark', 0, 2.8 * M, -0.4 * M, 5.9 * M, 0.2 * M, 1.1 * M);
    P.pipe(k, 'concrete', [0, 1.2 * M, 0.2 * M], [0, 1.2 * M, -1.4 * M], 0.95 * M, { seg: P.segs(k, 14), open: false });
    k.add('rubber', new THREE.CircleGeometry(0.75 * M, P.segs(k, 12)), { x: 0, y: 1.2 * M, z: -1.42 * M, ry: Math.PI });
    k.box('dirt', 0, 0, -1.9 * M, 1.6 * M, 1.05 * M, 1.2 * M);
    if (P.D2(k)) { P.railing(k, -2.2 * M, -4.9 * M, 2.2 * M, -4.9 * M, 0.9 * M); P.railing(k, -2.6 * M, -0.85 * M, 2.6 * M, -0.85 * M, 3.0 * M); }
    // Zulauf: halb eingegrabenes Betonrohr mit Schachtdeckeln
    P.pipe(k, 'concrete', [-3.4 * M, 0.2 * M, D / 2 - 0.4 * M], [-3.4 * M, 0.2 * M, -0.9 * M], 0.75 * M, { seg: P.segs(k, 12), open: false });
    if (P.D1(k)) for (const z of [3.2, 0.6]) { k.cyl('concrete_dark', -3.4 * M, 0, z * M, 0.9 * M, 1.05 * M, { seg: 10 }); k.cyl('metal_dark', -3.4 * M, 1.05 * M, z * M, 0.6 * M, 0.06 * M, { seg: 10 }); }
    // Kontrollhäuschen
    k.box('concrete_panel', 2.8 * M, 0, 2 * M, 3 * M, 2.6 * M, 2.6 * M);
    k.flatRoof('roof_flat_membrane', 'trim_dark', 2.8 * M, 2.6 * M, 2 * M, 3 * M, 2.6 * M, { parapet: 0.2 * M });
    P.door(k, 2.8 * M, 3.3 * M, 0, { w: 1 * M, h: 2.1 * M, mat: 'metal_dark' });
    if (P.D1(k)) { k.cyl('metal_light', 3.8 * M, 2.6 * M, 1.4 * M, 0.15 * M, 1.6 * M, { seg: 6 }); k.box('paint_yellow', -2.6 * M, 1.2 * M, 3.8 * M, 1.2 * M, 1.0 * M, 0.06 * M); k.box('metal_dark', -2.6 * M, 0, 3.8 * M, 0.08 * M, 1.2 * M, 0.08 * M); }
    P.fenceRect(k, 0, 0.6 * M, W - 0.6 * M, D - 1.8 * M, { h: 1.8 * M, gate: 2.2 * M, gateX: 1.6 * M });
    P.bush(k, -3.6 * M, 3 * M, 1.2); P.bush(k, -3.4 * M, 1.4 * M, 0.9);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Deponie (2×2)
registerArch('landfill', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'dirt', { curb: false });
    // Begrünter Altkörper hinten, aktiver Schüttkörper vorne rechts
    P.heap(k, 'grass_dry', -3 * M, -4.4 * M, 13 * M, 9.6 * M, 4.6 * M, { ridgeK: 0.75 });
    P.heap(k, 'grass', -3 * M, -4.4 * M, 9.5 * M, 6 * M, 4.9 * M, { y0: 0.01 * M, ridgeK: 0.6 });
    P.heap(k, 'dirt', 4.4 * M, -1 * M, 9 * M, 9.6 * M, 3.4 * M, { ridgeK: 0.7 });
    if (P.D1(k)) {
      const cols = ['paint_blue', 'paint_red', 'paint_yellow', 'canvas_white', 'metal_light', 'paint_green', 'wood_planks', 'metal_dark', 'paint_orange'];
      const n = P.D2(k) ? 70 : 22;
      for (let i = 0; i < n; i++) {
        const t = k.rng(), u = k.rng() - 0.5;
        const x = 4.4 * M + u * 7 * M, z = -1 * M + (t - 0.5) * 7.4 * M;
        const hx = 1 - Math.abs(u) * 2, hz = 1 - Math.abs(t - 0.5) * 2;
        const y = Math.max(0, Math.min(hx, hz)) * 3.4 * M;
        k.box(pick(k.rng, cols), x, y - 0.1 * M, z, (0.3 + k.rng() * 0.6) * M, (0.2 + k.rng() * 0.3) * M, (0.3 + k.rng() * 0.6) * M, { ry: k.rng() * 3 });
      }
    }
    // Planierraupe auf dem Schüttkörper
    if (P.D1(k)) {
      const g = new P.G(k, 4.6 * M, -0.4 * M, 0.5, 2.6 * M);
      g.box('paint_yellow', 0, 0.4 * M, 0, 2.4 * M, 1.3 * M, 3.4 * M);
      g.box('paint_yellow', 0, 1.7 * M, -0.5 * M, 1.6 * M, 1.2 * M, 1.6 * M);
      g.box('rubber', 0, 0, 0, 2.8 * M, 0.7 * M, 3.6 * M);
      g.box('metal_dark', 0, 0.1 * M, 2.2 * M, 3.2 * M, 1.1 * M, 0.3 * M);
      if (P.D2(k)) g.box('glass_window', 0, 1.9 * M, -0.5 * M, 1.62 * M, 0.7 * M, 1.4 * M, { lit: 0 });
    }
    // Gasbrunnen auf dem Altkörper
    if (P.D1(k)) for (const [x, z] of [[-6, -4], [-1, -3], [-3.5, -6.5], [-7, -1.8]]) { const y = 2.4 * M; k.cyl('metal_light', x * M, 0, z * M, 0.15 * M, y + 1.2 * M + (z > -3 ? 0 : 1.2 * M), { seg: 6 }); }
    // Zufahrt, Waage, Büro, Sickerwasserbecken
    P.slab(k, 'asphalt', -4 * M, 7.2 * M, 11 * M, 4 * M);
    P.walk(k, 'gravel', [[1.4 * M, 7 * M], [3.6 * M, 4.2 * M], [5 * M, 1.6 * M]], 3.2 * M);
    k.box('metal_dark', -2.2 * M, 0, 7.4 * M, 3.2 * M, 0.18 * M, 6 * M);
    k.box('metal_panel_white', -6.6 * M, 0, 7.6 * M, 4.8 * M, 2.6 * M, 2.44 * M);
    if (P.D1(k)) { k.box('glass_window', -6.6 * M, 1.1 * M, 8.84 * M, 3.6 * M, 1.0 * M, 0.04 * M, { lit: 0.9 }); k.box('paint_red', -0.3 * M, 1.0 * M, 9.4 * M, 0.12 * M, 0.12 * M, 3.2 * M, { ry: Math.PI / 2 }); }
    P.signBox(k, 'DEPONIE', -6.6 * M, 3.4 * M, 8.82 * M, 0, { px: 0.12 * M, bg: 'paint_green' });
    P.garbageTruck(k, 2.6 * M, 5.6 * M, -0.6 - Math.PI);
    k.box('concrete', -8 * M, 0, 2.8 * M, 3.6 * M, 0.6 * M, 3.6 * M);
    k.box(v ? 'water_canal' : 'water_canal', -8 * M, 0, 2.8 * M, 3.0 * M, 0.5 * M, 3.0 * M);
    P.fenceRect(k, 0, 0, W - 0.4 * M, D - 0.4 * M, { h: 2 * M, gate: 4 * M, gateX: 2 * M });
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Müllverbrennung (2×2)
registerArch('incinerator', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'concrete');
    P.slab(k, 'asphalt', 2.2 * M, 6.8 * M, 14 * M, 5.6 * M);
    // Bunker- und Kesselhaus (hoch, schräges Dach)
    const hx = -1.6 * M, hz = -2.6 * M, hw = 13 * M, hd = 9 * M;
    const wall = v ? 'plaster_ochre' : 'metal_panel_white', accent = v ? 'paint_red' : 'metal_panel_blue';
    k.box(wall, hx, 0, hz, hw, 12 * M, hd);
    k.box('concrete_dark', hx, 0, hz, hw + 0.12 * M, 0.8 * M, hd + 0.12 * M);
    k.prism(wall, [[-hd / 2, 0], [hd / 2, 0], [hd / 2, 5.6 * M], [-hd / 2, 2.4 * M]], hw, { x: hx, y: 12 * M, z: hz, ry: Math.PI / 2 });
    k.prism('roof_metal_grey', [[-hd / 2 - 0.3 * M, 2.25 * M], [hd / 2 + 0.3 * M, 5.75 * M], [hd / 2 + 0.3 * M, 6.0 * M], [-hd / 2 - 0.3 * M, 2.5 * M]], hw + 0.4 * M, { x: hx, y: 12 * M, z: hz, ry: Math.PI / 2 });
    if (v === 0) {
      for (let i = 0; i < 6; i++) k.box(accent, hx - hw / 2 + 1.2 * M + i * 2.1 * M, 0.8 * M, hz + hd / 2 + 0.04 * M, 0.9 * M, 11 * M, 0.06 * M);
      P.ribbon(k, 'right', hx, hz, hw, hd, 7 * M, 2 * M);
      P.ribbon(k, 'left', hx, hz, hw, hd, 7 * M, 2 * M);
      // verglastes Treppenhaus an der Ecke
      const sx = hx - hw / 2 + 1.4 * M, sz = hz + hd / 2 + 1.0 * M;
      k.box('metal_panel_white', sx, 0, sz, 2.6 * M, 15 * M, 2.0 * M);
      k.curtainWall('front', sx, sz, 2.6 * M, 2.0 * M, 0.6 * M, 13.8 * M, { glass: 'glass_curtain_blue', fh: 3.0 * M, colW: 1.3 * M });
      k.curtainWall('left', sx, sz, 2.6 * M, 2.0 * M, 0.6 * M, 13.8 * M, { glass: 'glass_curtain_blue', fh: 3.0 * M, colW: 1.0 * M });
      k.flatRoof('roof_flat_membrane', accent, sx, 15 * M, sz, 2.6 * M, 2.0 * M, { parapet: 0.3 * M });
    } else {
      // bunte Kacheln, Kugel am Kamin (Hundertwasser-Anklang)
      const cols = ['paint_red', 'paint_yellow', 'paint_blue', 'paint_green', 'paint_white'];
      if (P.D1(k)) for (let i = 0; i < 7; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0) k.box(cols[(i * 3 + j) % 5], hx - hw / 2 + 1 * M + i * 1.8 * M, 1.4 * M + j * 2.6 * M, hz + hd / 2 + 0.04 * M, 1.6 * M, 2.2 * M, 0.06 * M);
      for (let i = 0; i < 5; i++) k.window(hx + hw / 2 + 0.03 * M, 3 * M + (i % 2) * 4 * M, hz - 3 * M + i * 1.5 * M, Math.PI / 2, 0.9 * M, 1.4 * M, { frame: 'paint_yellow' });
    }
    // Annahmehalle mit Toren
    const ax = 2.4 * M, az = 3.8 * M, aw = 12 * M, ad = 4 * M;
    k.box(wall, ax, 0, az, aw, 6.6 * M, ad);
    k.flatRoof('roof_flat_membrane', accent, ax, 6.6 * M, az, aw, ad, { parapet: 0.5 * M });
    for (let i = 0; i < 3; i++) P.rollerDoor(k, ax - 3.8 * M + i * 3.8 * M, az + ad / 2, 0, 3.2 * M, 4.4 * M, { mat: 'metal_panel_grey' });
    P.signBox(k, 'MUELLHEIZKRAFTWERK', ax, 5.9 * M, az + ad / 2, 0, { px: 0.13 * M, bg: accent });
    P.garbageTruck(k, 5.2 * M, 8.0 * M, Math.PI / 2 + 0.05);
    P.garbageTruck(k, -3.0 * M, 8.2 * M, -Math.PI / 2);
    // Rauchgasreinigung + Kamin
    k.box('metal_panel_grey', 7.4 * M, 0, -5.4 * M, 4.6 * M, 9 * M, 6 * M);
    if (P.D1(k)) { k.band('metal_dark', 7.4 * M, -5.4 * M, 4.6 * M, 6 * M, 4.5 * M, 0.2 * M, 0.2 * M); for (let i = 0; i < 2; i++) k.cyl('metal_light', 6.4 * M + i * 2 * M, 9 * M, -5.4 * M, 0.7 * M, 2 * M, { seg: 10 }); }
    for (let i = 0; i < 2; i++) { P.tank(k, 6.2 * M + i * 2.6 * M, -1.0 * M, 1.0 * M, 7.0 * M, { mat: 'metal_panel_white', roof: 'cone', coneK: 0.6, ringsAt: [0.3, 0.7] }); P.pipe(k, 'metal_light', [6.2 * M + i * 2.6 * M, 6.4 * M, -1.8 * M], [6.2 * M + i * 2.6 * M, 6.4 * M, -2.6 * M], 0.35 * M); }
    k.flatRoof('roof_flat_membrane', 'metal_dark', 7.4 * M, 9 * M, -5.4 * M, 4.6 * M, 6 * M, { parapet: 0.3 * M });
    P.pipe(k, 'metal_light', [5 * M, 10.5 * M, -5.4 * M], [7.4 * M, 10.5 * M, -5.4 * M], 0.8 * M, { open: false });
    const sx = 7.6 * M, sz = -9 * M + 1.2 * M;
    P.stack(k, sx, sz, 36 * M, { r: 1.0 * M, rTop: 0.85 * M, mat: v ? 'metal_light' : 'concrete', bands: v ? 0 : 3, bandH: 1.2 * M, amount: 1.6 });
    if (v === 1) { k.sphere('roof_copper', sx, 30 * M, sz, 2.2 * M, { seg: P.segs(k, 16) }); if (P.D1(k)) k.sphere('paint_yellow', sx, 30 * M, sz, 2.25 * M, { seg: P.segs(k, 16), sy: 0.2 }); }
    P.pipe(k, 'metal_light', [7.4 * M, 7 * M, -7.2 * M], [sx, 7 * M, sz], 0.6 * M, { open: false });
    P.lamp(k, -1 * M, 9.4 * M); P.lamp(k, 8.6 * M, 4.6 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Recyclinghof (2×2)
registerArch('recycling', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'asphalt');
    // Rampe mit Geländer, darunter Mulden
    const rz = -6.2 * M;
    k.box('concrete', -1 * M, 0, rz, 15 * M, 1.6 * M, 3.4 * M);
    k.prism('concrete', [[0, 0], [3.0 * M, 0], [0, 1.6 * M]], 3.4 * M, { x: 6.5 * M, y: 0, z: rz, ry: 0 });
    P.railing(k, -8.5 * M, rz + 1.7 * M, 6.5 * M, rz + 1.7 * M, 1.6 * M);
    const fills = [['container_blue', 'canvas_white', 'PAPIER'], ['container_green', 'leaves_dark', 'GRUEN'], ['container_yellow', 'paint_yellow', 'PLASTIK'], ['metal_panel_grey', 'metal_light', 'METALL'], ['container_red', 'wood_planks', 'HOLZ']];
    fills.forEach(([c, f, label], i) => {
      const x = -7 * M + i * 2.9 * M;
      skip(k, x, rz + 3.4 * M, 0, c, f, { len: 3.2 * M, w: 2.5 * M, h: 1.4 * M, low: 0.3 });
      if (P.D1(k)) P.signBox(k, label, x, 2.6 * M, rz + 1.75 * M, 0, { px: 0.06 * M, bg: c, fg: 'paint_white', frame: 'metal_dark' });
    });
    // Sortierhalle mit offener Front und Ballen
    const hx = -4.4 * M, hz = 3.4 * M, hw = 10 * M, hd = 6.4 * M, hh = 6 * M, wall = v ? 'metal_corrugated_green' : 'metal_corrugated';
    k.box(wall, hx, 0, hz - hd / 2 + 0.15 * M, hw, hh, 0.3 * M);
    for (const s of [-1, 1]) k.box(wall, hx + s * (hw / 2 - 0.15 * M), 0, hz, 0.3 * M, hh, hd);
    k.box('concrete_dark', hx, 0.01 * M, hz, hw - 0.6 * M, 0.05 * M, hd - 0.4 * M);
    k.gableRoof('roof_metal_grey', hx, hh, hz, hw, hd, 1.4 * M, { ridge: 'x', overhang: 0.6 * M });
    k.gableEnds(wall, hx, hh, hz, hw, hd, 1.4 * M, { ridge: 'x' });
    if (P.D1(k)) for (const s of [-1, 1]) k.box('metal_dark', hx + s * 2.4 * M, 0, hz + hd / 2 - 0.2 * M, 0.3 * M, hh, 0.3 * M);
    const bales = ['canvas_white', 'paint_blue', 'paint_yellow', 'metal_light', 'paint_green', 'paint_red'];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) for (let l = 0; l < 2 - (i + j) % 2; l++) {
      if (k.detail === 0 && l) continue;
      k.box(bales[(i * 2 + j) % bales.length], hx - 3 * M + i * 1.5 * M, l * 1.25 * M, hz - 1.6 * M + j * 1.5 * M, 1.3 * M, 1.2 * M, 1.3 * M);
    }
    if (P.D1(k)) { P.beam(k, 'metal_dark', [hx + 1 * M, 0.9 * M, hz + 1 * M], [hx + 3.6 * M, 3.4 * M, hz - 1 * M], 0.9 * M); k.box('metal_panel_grey', hx + 3.8 * M, 0, hz - 1.6 * M, 1.6 * M, 3.8 * M, 1.6 * M); }
    P.forklift(k, hx + 0.4 * M, hz + 2.4 * M, 0.6);
    // Bürocontainer, Schild, Kundenauto
    k.box('metal_panel_white', 6.4 * M, 0, 7.6 * M, 5.8 * M, 2.6 * M, 2.44 * M);
    if (P.D1(k)) k.box('glass_window', 6.4 * M, 1.0 * M, 8.84 * M, 4.4 * M, 1.1 * M, 0.04 * M, { lit: 0.9 });
    P.signBox(k, 'WERTSTOFFHOF', 2.6 * M, 3.4 * M, 9.4 * M, 0, { px: 0.12 * M, bg: 'paint_green' });
    if (P.D1(k)) for (const s of [-1, 1]) k.box('metal_dark', 2.6 * M + s * 1.4 * M, 0, 9.4 * M, 0.1 * M, 2.6 * M, 0.1 * M);
    P.car(k, 2.6 * M, -1.8 * M, Math.PI / 2 + 0.1, 'paint_blue');
    P.garbageTruck(k, 5.6 * M, 2.2 * M, -0.2);
    P.fenceRect(k, 0, 0, W - 0.4 * M, D - 0.4 * M, { h: 2 * M, gate: 4.4 * M, gateX: 0 });
    P.lamp(k, 0 * M, 6 * M);
    return P.finish(k);
  },
});
