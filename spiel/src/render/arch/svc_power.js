// Energie: Kohle, Wind, Solar, Gas, Fusion, Wasserkraft, Geothermie, Kernkraft, Batteriespeicher, Heizkraftwerk.
// Besitzer: G5. Maße in Metern × M, Front (Straße) nach +z.
import * as THREE from 'three';
import { registerArch } from './index.js';
import * as P from './svc_parts.js';

const { M, pick } = P;
const dims = (ctx) => [ctx.fw * 10 * M, ctx.fd * 10 * M];

// ---------------------------------------------------------------- Kohlekraftwerk (2×2)
registerArch('coal', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    const brick = v === 0 ? 'brick_red' : 'brick_brown';
    P.lot(k, W, D, 'concrete');
    // Zufahrt und Kohlelager
    P.slab(k, 'asphalt', 1.6 * M, 7.6 * M, 4.2 * M, 4.6 * M);
    P.slab(k, 'dirt', 6.9 * M, 3.3 * M, 5.8 * M, 7.6 * M);
    P.heap(k, 'asphalt_dark', 7.0 * M, 5.0 * M, 4.6 * M, 3.4 * M, 2.3 * M);
    P.heap(k, 'asphalt_dark', 6.8 * M, 1.4 * M, 4.0 * M, 2.8 * M, 1.6 * M);
    if (P.D1(k)) P.bollards(k, 4.0 * M, -0.4 * M, 4.0 * M, 7.0 * M, 5);
    // Kesselhaus (hoch, hinten links)
    const bx = -3 * M, bz = -4.6 * M, bw = 6 * M, bd = 7 * M, bh = 15 * M;
    k.box(brick, bx, 0, bz, bw, bh, bd);
    k.box('concrete_dark', bx, 0, bz, bw + 0.14 * M, 0.8 * M, bd + 0.14 * M);
    P.gridRow(k, 'right', bx, bz, bw, bd, 3, 2.5 * M, 1.1 * M, 10 * M, 2, 8);
    P.gridRow(k, 'left', bx, bz, bw, bd, 3, 2.5 * M, 1.1 * M, 10 * M, 2, 8);
    P.gridRow(k, 'back', bx, bz, bw, bd, 2, 2.5 * M, 1.1 * M, 10 * M, 2, 8);
    if (P.D1(k)) k.band('trim_stone', bx, bz, bw, bd, bh - 0.6 * M, 0.6 * M, 0.15 * M);
    k.flatRoof('roof_flat_membrane', 'trim_dark', bx, bh, bz, bw, bd, {});
    k.box('metal_corrugated', bx - 0.5 * M, bh, bz - 0.5 * M, 3.6 * M, 3 * M, 4 * M);
    k.box('roof_metal_grey', bx - 0.5 * M, bh + 3 * M, bz - 0.5 * M, 3.8 * M, 0.2 * M, 4.2 * M);
    // Kohlebunker am Kesselhaus
    k.box('metal_corrugated', 0.7 * M, 10.5 * M, -3.2 * M, 1.6 * M, 3.5 * M, 2.6 * M);
    // Maschinenhaus (vorne)
    const tx = -2 * M, tz = 3.1 * M, tw = 10 * M, td = 6 * M, th = 8 * M;
    k.box(brick, tx, 0, tz, tw, th, td);
    k.box('concrete_dark', tx, 0, tz, tw + 0.14 * M, 0.6 * M, td + 0.14 * M);
    P.gridRow(k, 'front', tx, tz, tw, td, 4, 1.2 * M, 1.6 * M, 4.0 * M, 3, 5, { arch: true });
    P.gridRow(k, 'right', tx, tz, tw, td, 2, 1.2 * M, 1.4 * M, 4.6 * M, 3, 5, { arch: true });
    P.gridRow(k, 'left', tx, tz, tw, td, 2, 1.2 * M, 1.4 * M, 4.6 * M, 3, 5, { arch: true });
    if (P.D1(k)) k.band('trim_stone', tx, tz, tw, td, th - 0.5 * M, 0.5 * M, 0.12 * M);
    k.gableRoof('roof_metal_grey', tx, th, tz, tw, td, 1.6 * M, { ridge: 'x', overhang: 0.3 * M });
    k.gableEnds(brick, tx, th, tz, tw, td, 1.6 * M, { ridge: 'x' });
    if (P.D1(k)) {
      k.box('metal_corrugated', tx, th + 1.2 * M, tz, 7 * M, 0.9 * M, 1.4 * M);
      for (const s of [-1, 1]) P.quad(k, 'glass_window', tx, th + 1.65 * M, tz + s * 0.73 * M, 6.6 * M, 0.55 * M, s > 0 ? 0 : Math.PI);
      k.box('roof_metal_grey', tx, th + 2.1 * M, tz, 7.4 * M, 0.14 * M, 1.9 * M);
    }
    P.door(k, tx + 3.2 * M, tz + td / 2, 0, { w: 3 * M, h: 3.6 * M, mat: 'metal_panel_grey' });
    P.signBox(k, 'STADTWERKE', tx, 6.85 * M, tz + td / 2, 0, { px: 0.11 * M, bg: 'trim_dark', fg: 'sign_white' });
    // Schornstein mit Rauchgaskanal
    const cx = -8.2 * M, cz = -7.6 * M;
    P.stack(k, cx, cz, 34 * M, { r: 1.2 * M, rTop: 0.85 * M, mat: v === 0 ? 'concrete' : 'chimney_brick', bands: 3, bandH: 1.4 * M, amount: 2.4 });
    k.box('metal_corrugated', (cx + bx - bw / 2) / 2 + 0.4 * M, 11 * M, -6.4 * M, Math.abs(bx - bw / 2 - cx) + 0.6 * M, 1.8 * M, 1.6 * M);
    // Kühlturm
    P.coolingTower(k, 5.5 * M, -5.3 * M, 4.2 * M, 17 * M, { steam: 2.4 });
    // Förderband vom Kohlelager zum Bunker
    const a = [4.4 * M, 0.6 * M, 0.2 * M], b = [1.2 * M, 11.2 * M, -2.6 * M];
    P.beam(k, 'metal_corrugated', a, b, 1.3 * M);
    k.box('metal_dark', a[0], 0, a[2], 2 * M, 1.6 * M, 2 * M);
    if (P.D1(k)) for (const t of [0.35, 0.68]) {
      const px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t, pz = a[2] + (b[2] - a[2]) * t;
      P.beam(k, 'metal_dark', [px - 0.6 * M, 0, pz], [px - 0.4 * M, py - 0.6 * M, pz], 0.3 * M);
      P.beam(k, 'metal_dark', [px + 0.6 * M, 0, pz], [px + 0.4 * M, py - 0.6 * M, pz], 0.3 * M);
    }
    // Absetz-/Rückladegerät auf dem Kohlelager
    if (P.D1(k)) {
      k.box('paint_yellow', 7.0 * M, 0, 3.2 * M, 1.4 * M, 3.2 * M, 1.4 * M);
      P.beam(k, 'paint_yellow', [7.0 * M, 3.0 * M, 3.2 * M], [4.6 * M, 1.4 * M, 6.4 * M], 0.5 * M);
      P.beam(k, 'paint_yellow', [7.0 * M, 3.0 * M, 3.2 * M], [8.6 * M, 2.4 * M, 1.0 * M], 0.4 * M);
      k.box('metal_dark', 8.6 * M, 1.6 * M, 1.0 * M, 1.2 * M, 1.2 * M, 1.2 * M);
      k.add('paint_yellow', new THREE.CylinderGeometry(1.0 * M, 1.0 * M, 0.5 * M, P.segs(k, 12)), { x: 4.5 * M, y: 1.4 * M, z: 6.5 * M, rz: Math.PI / 2, ry: -0.9 });
    }
    // Umspannwerk vorne links, Mast, Pförtner
    P.substation(k, -6.6 * M, 8.2 * M, 6 * M, 3.2 * M, { n: 1, gantry: false });
    P.pylon(k, -8.6 * M, -1.6 * M, 14 * M, Math.PI / 2);
    P.block(k, { x: 5.6 * M, z: 8.7 * M, w: 2.6 * M, d: 2 * M, h: 2.8 * M, floors: 1, wall: 'plaster_white', win: { winW: 1.2 * M, winH: 1.1 * M, spacing: 1.6 * M, margin: 0.4 * M }, sides: ['front', 'left'] });
    P.lamp(k, 0 * M, 9 * M); P.lamp(k, 4.2 * M, 4 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Windrad (1×1) mit drehendem Rotor
registerArch('wind', {
  variants: 3,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'grass', { curb: false });
    k.cyl('gravel', 0, 0, 0, 3.4 * M, P.PAVE, { seg: P.segs(k, 18) });
    P.slab(k, 'gravel', 0, 4.2 * M, 2.4 * M, 2 * M);
    const hub = [30, 34, 27][v] * M, r0 = 1.35 * M, r1 = 0.7 * M, nh = 2.6 * M;
    k.cyl('concrete', 0, 0, 0, 2.4 * M, 0.5 * M, { seg: P.segs(k, 18) });
    k.cyl('paint_white', 0, 0.5 * M, 0, r0, hub - nh / 2 - 0.5 * M, { rTop: r1, seg: P.segs(k, 16) });
    if (P.D1(k) && v !== 2) {
      const mats = ['paint_green', 'grass', 'leaves_light'];
      for (let i = 0; i < 3; i++) { const y = 1.2 * M + i * 1.7 * M, rr = r0 + (r1 - r0) * (y / hub) + 0.03 * M; k.cyl(mats[i], 0, y, 0, rr, 1.5 * M, { seg: P.segs(k, 16), open: true }); }
    }
    if (P.D1(k)) {
      P.door(k, 0, r0 - 0.05 * M, 0, { w: 0.9 * M, h: 2.1 * M, y0: 0.5 * M, mat: 'metal_light', frame: 'metal_dark' });
      k.box('metal_panel_grey', 2.2 * M, 0, 2.6 * M, 1.6 * M, 1.8 * M, 1.2 * M);
    }
    // Gondel
    const ny = hub - nh / 2;
    k.box('paint_white', 0, ny, -1.2 * M, 2.5 * M, nh, 7 * M);
    k.box('paint_white', 0, ny + 0.2 * M, -4.9 * M, 2.2 * M, nh - 0.4 * M, 0.5 * M);
    if (P.D2(k)) {
      k.box('metal_light', -0.7 * M, ny + nh, -3.8 * M, 0.08 * M, 1.4 * M, 0.08 * M);
      k.box('metal_light', 0.7 * M, ny + nh, -3.8 * M, 0.08 * M, 1.2 * M, 0.08 * M);
      k.box('emissive_red', 0, ny + nh, -3.0 * M, 0.5 * M, 0.35 * M, 0.5 * M);
      k.light(0, ny + nh + 0.3 * M, -3 * M, 0xff2a1a, 0.3);
    }
    // Rotor (Drehpunkt = Nabe), Blätter in der x/y-Ebene, Achse z
    const L = 15 * M, tip = 2.6 * M;
    P.anim(k, [0, hub, 2.4 * M], 'z', 1.3 + v * 0.15, (s) => {
      s.add('paint_white', new THREE.CylinderGeometry(1.15 * M, 1.25 * M, 1.2 * M, P.segs(s, 14)), { z: -0.6 * M, rx: Math.PI / 2 });
      s.cone('paint_white', 0, 0, 0, 1.15 * M, 2.0 * M, { seg: P.segs(s, 14), rx: Math.PI / 2 });
      for (let i = 0; i < 3; i++) {
        const rz = (i * Math.PI * 2) / 3 + 0.3;
        if (s.detail === 0) { s.box('paint_white', 0, 0, 0, 1.1 * M, L, 0.3 * M, { rz }); continue; }
        const body = [[-0.3 * M, 0.9 * M], [0.35 * M, 0.9 * M], [1.0 * M, 3.4 * M], [0.42 * M, L - tip], [-0.18 * M, L - tip], [-0.5 * M, 3.4 * M]];
        s.prism('paint_white', body, 0.32 * M, { rz });
        s.prism('paint_red', [[-0.18 * M, L - tip], [0.42 * M, L - tip], [0.28 * M, L], [-0.04 * M, L]], 0.26 * M, { rz });
      }
    });
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Solarpark (2×2)
registerArch('solar', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, v ? 'grass' : 'grass_dry', { curb: false });
    P.slab(k, 'gravel', 0, 8.6 * M, W - 0.6 * M, 1.6 * M);
    P.slab(k, 'gravel', -9.0 * M, 0, 1.2 * M, D - 0.6 * M);
    const tilt = 0.44, cs = Math.cos(tilt), sn = Math.sin(tilt);
    const len = 16.6 * M, dep = 2.3 * M, rows = 6, x0 = 0.6 * M;
    for (let r = 0; r < rows; r++) {
      const zc = -8.0 * M + r * 2.75 * M, yc = 1.25 * M;
      // Tisch: Unterkante-Mitte bei (x0, y, z), um x geneigt (Front tiefer)
      const by = yc - (0.04 * M) * cs;
      k.box('solar_panel', x0, by, zc, len, 0.08 * M, dep, { rx: tilt });
      if (k.detail === 0) continue;
      const ty = by + 0.08 * M * cs, tz = zc + 0.08 * M * sn;
      if (P.D2(k)) {
        const n = 16;
        for (let i = 0; i <= n; i++) k.box('metal_light', x0 - len / 2 + (i * len) / n, ty, tz, 0.05 * M, 0.02 * M, dep, { rx: tilt });
        k.box('metal_light', x0, ty, tz, len, 0.02 * M, 0.05 * M, { rx: tilt });
      }
      // Gestell
      const fz = zc + (dep / 2) * cs * 0.8, fy = yc - (dep / 2) * sn * 0.8;
      const bz = zc - (dep / 2) * cs * 0.8, byy = yc + (dep / 2) * sn * 0.8;
      for (let i = 0; i < 6; i++) {
        const px = x0 - len / 2 + 0.6 * M + (i * (len - 1.2 * M)) / 5;
        k.box('metal_light', px, 0, fz, 0.1 * M, fy, 0.1 * M);
        k.box('metal_light', px, 0, bz, 0.1 * M, byy, 0.1 * M);
      }
    }
    // Wechselrichter-Station und Trafo
    k.box('metal_panel_white', 5.6 * M, 0, 8.6 * M, 4.4 * M, 2.6 * M, 1.4 * M);
    if (P.D1(k)) { for (let i = 0; i < 3; i++) k.box('metal_dark', 4.2 * M + i * 1.4 * M, 0.3 * M, 9.32 * M, 0.9 * M, 1.8 * M, 0.04 * M); k.box('paint_green', 5.6 * M, 2.2 * M, 9.32 * M, 4.4 * M, 0.25 * M, 0.04 * M); }
    P.transformer(k, 1.6 * M, 8.6 * M, 0, 0.7);
    P.fenceRect(k, 0, 0, W - 0.4 * M, D - 0.4 * M, { h: 1.8 * M, gate: 3 * M, gateX: -5 * M });
    P.signBox(k, 'SOLARPARK', -5 * M, 2.3 * M, D / 2 - 0.15 * M, 0, { px: 0.12 * M, bg: 'paint_green' });
    if (P.D1(k)) for (const s of [-1, 1]) k.box('metal_dark', -5 * M + s * 1.2 * M, 0, D / 2 - 0.25 * M, 0.1 * M, 1.6 * M, 0.1 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Gaskraftwerk (2×2, GuD)
registerArch('gas', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'concrete');
    P.slab(k, 'asphalt', 2.8 * M, 7.5 * M, 3.6 * M, 4.6 * M);
    // Maschinenhaus
    const hx = -3 * M, hz = 2.6 * M, hw = 11 * M, hd = 7 * M, hh = 10 * M;
    k.box('metal_panel_white', hx, 0, hz, hw, hh, hd);
    k.box('concrete_dark', hx, 0, hz, hw + 0.12 * M, 0.6 * M, hd + 0.12 * M);
    k.box('metal_panel_blue', hx, hh - 1.8 * M, hz, hw + 0.06 * M, 1.4 * M, hd + 0.06 * M);
    P.ribbon(k, 'front', hx, hz, hw, hd, 5.2 * M, 1.6 * M);
    P.ribbon(k, 'right', hx, hz, hw, hd, 5.2 * M, 1.6 * M);
    P.ribbon(k, 'left', hx, hz, hw, hd, 5.2 * M, 1.6 * M);
    k.flatRoof('roof_flat_membrane', 'metal_panel_white', hx, hh, hz, hw, hd, { parapet: 0.4 * M });
    if (P.D1(k)) for (let i = 0; i < 3; i++) P.fanUnit(k, hx - 3.5 * M + i * 3.5 * M, hh, hz + 1 * M, 0.9 * M);
    P.rollerDoor(k, hx + 3 * M, hz + hd / 2, 0, 3.4 * M, 4.2 * M, {});
    P.door(k, hx - 3 * M, hz + hd / 2, 0, { glass: true, canopy: 'metal_dark' });
    P.signBox(k, 'GASKRAFTWERK', hx - 1 * M, hh - 2.6 * M, hz + hd / 2, 0, { px: 0.15 * M, bg: 'metal_panel_blue' });
    // Abhitzekessel + Kamin(e)
    const ex = -5 * M, ez = -5.2 * M;
    k.box('metal_panel_grey', ex, 0, ez, 5 * M, 16 * M, 6.8 * M);
    if (P.D1(k)) { for (let i = 1; i < 5; i++) k.band('metal_dark', ex, ez, 5 * M, 6.8 * M, i * 3.2 * M, 0.15 * M, 0.25 * M); k.box('metal_dark', ex + 3.2 * M, 0, ez + 2.4 * M, 1.4 * M, 16.5 * M, 1.4 * M); }
    k.flatRoof('roof_flat_membrane', 'metal_dark', ex, 16 * M, ez, 5 * M, 6.8 * M, { parapet: 0.5 * M });
    k.box('metal_panel_grey', ex, 3 * M, -0.6 * M, 3 * M, 4 * M, 2.4 * M);
    const stacks = v === 0 ? [[-8.4 * M, -7.6 * M]] : [[-8.4 * M, -7.8 * M], [-8.4 * M, -4.4 * M]];
    for (const [sx, sz] of stacks) {
      P.stack(k, sx, sz, 30 * M, { r: 0.95 * M, rTop: 0.85 * M, mat: 'metal_light', capMat: 'metal_dark', type: 'steam', amount: 1.2 });
      k.box('metal_panel_grey', (sx + ex - 2.5 * M) / 2, 12.5 * M, sz, Math.abs(ex - 2.5 * M - sx) + 0.4 * M, 2 * M, 1.6 * M);
    }
    // Luftkondensator auf Stützen
    const ax = 5.6 * M, az = -5.4 * M, aw = 7.6 * M, ad = 7 * M, ay = 6.5 * M;
    if (k.detail > 0) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) k.box('concrete', ax - aw / 2 + 0.4 * M + (i * (aw - 0.8 * M)) / 2, 0, az - ad / 2 + 0.4 * M + (j * (ad - 0.8 * M)) / 2, 0.32 * M, ay, 0.32 * M);
    else k.box('concrete', ax, 0, az, aw * 0.8, ay, ad * 0.8);
    if (P.D2(k)) for (const s of [-1, 1]) { P.beam(k, 'concrete', [ax - aw / 2 + 0.4 * M, 0.5 * M, az + s * (ad / 2 - 0.4 * M)], [ax, ay - 0.2 * M, az + s * (ad / 2 - 0.4 * M)], 0.2 * M); P.beam(k, 'concrete', [ax + aw / 2 - 0.4 * M, 0.5 * M, az + s * (ad / 2 - 0.4 * M)], [ax, ay - 0.2 * M, az + s * (ad / 2 - 0.4 * M)], 0.2 * M); }
    k.box('metal_panel_grey', ax, ay, az, aw, 0.7 * M, ad);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) P.fanUnit(k, ax - 1.8 * M + i * 3.6 * M, ay + 0.7 * M, az - 2.3 * M + j * 2.3 * M, 1 * M, { h: 0.5 * M });
    k.prism('metal_corrugated', [[-ad / 2, 0], [ad / 2, 0], [0, 3 * M]], aw * 0.96, { x: ax, y: ay + 1.3 * M, z: az, ry: Math.PI / 2 });
    P.pipe(k, 'metal_light', [hx + hw / 2 - 0.5 * M, 7.5 * M, hz - 2 * M], [ax - 2 * M, 7.5 * M, az + ad / 2 - 0.5 * M], 0.9 * M, { open: false });
    // Gasversorgung
    if (v === 0) {
      P.sphereTank(k, 6.6 * M, 4.2 * M, 2.5 * M, { mat: 'tank_white' });
      P.pipeline(k, 'paint_yellow', [[6.6 * M, 0.5 * M, 4.2 * M], [3.5 * M, 0.5 * M, 4.2 * M], [3.5 * M, 0.5 * M, 3.2 * M], [hx + hw / 2, 0.5 * M, 3.2 * M]], 0.22 * M);
    } else {
      k.box('metal_panel_white', 6.8 * M, 0, 3.6 * M, 4 * M, 3 * M, 3 * M);
      k.box('paint_yellow', 6.8 * M, 2.4 * M, 5.12 * M, 4 * M, 0.3 * M, 0.04 * M);
      P.pipeRack(k, [9.4 * M, 1.6 * M], [hx + hw / 2, 1.6 * M], 1.2 * M, { n: 2, mats: ['paint_yellow', 'paint_yellow'] });
    }
    P.substation(k, -5.5 * M, 8.3 * M, 8.2 * M, 3 * M, { n: 2, gantry: false, s: 0.75 });
    P.lamp(k, 4.8 * M, 9 * M); P.lamp(k, 1 * M, 6.4 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Fusionsreaktor (3×3)
registerArch('fusion', {
  variants: 1,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx);
    P.lot(k, W, D, 'pavers');
    P.slab(k, 'grass', -9 * M, 10.2 * M, 11 * M, 8 * M);
    P.parking(k, 8.6 * M, 10.2 * M, 11 * M, 7.6 * M, { rows: 2 });
    // Zentraler Ringbau mit Kuppel und Plasmaring
    const cx = 0, cz = -2 * M, R = 8.6 * M, H = 9 * M, seg = P.segs(k, 36);
    k.cyl('concrete', cx, 0, cz, R + 0.6 * M, 0.8 * M, { seg });
    k.cyl('metal_panel_white', cx, 0.8 * M, cz, R, H - 0.8 * M, { seg });
    k.cyl('emissive_cool', cx, 6.2 * M, cz, R + 0.04 * M, 0.5 * M, { seg, open: true });
    k.cyl('glass_curtain_blue', cx, 2.2 * M, cz, R + 0.03 * M, 2.6 * M, { seg, open: true, lit: 0.9 });
    k.dome('metal_panel_white', cx, H, cz, R, { seg, sy: 0.32 });
    P.torus(k, 'emissive_cool', cx, H + 2.15 * M, cz, 4.4 * M, 0.45 * M, { seg: P.segs(k, 32) });
    if (P.D2(k)) {
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; k.box('metal_light', cx + Math.sin(a) * (R + 0.1 * M), 0.8 * M, cz + Math.cos(a) * (R + 0.1 * M), 0.35 * M, H - 0.8 * M, 0.3 * M, { ry: a }); }
      k.cyl('metal_light', cx, H + 2.65 * M, cz, 1.2 * M, 1.3 * M, { seg: 12 });
      k.light(cx, H + 2.2 * M, cz, 0x7fe8ff, 1.2);
    }
    // Laborflügel links (Glas) und Generatorhalle rechts
    const lx = -11.6 * M, lz = -2 * M;
    k.box('metal_panel_white', lx, 0, lz, 5.4 * M, 10.5 * M, 15 * M);
    k.curtainWall('front', lx, lz, 5.4 * M, 15 * M, 0.6 * M, 9.6 * M, { glass: 'glass_curtain_blue', fh: 3.2 * M });
    k.curtainWall('left', lx, lz, 5.4 * M, 15 * M, 0.6 * M, 9.6 * M, { glass: 'glass_curtain_blue', fh: 3.2 * M });
    k.flatRoof('roof_flat_membrane', 'metal_panel_white', lx, 10.5 * M, lz, 5.4 * M, 15 * M, { parapet: 0.4 * M });
    k.box('glass_curtain_blue', -8.4 * M, 5 * M, 0.5 * M, 1.6 * M, 2.6 * M, 2.4 * M, { lit: 0.8 });
    const gx = 11.4 * M, gz = -4 * M;
    k.box('metal_panel_grey', gx, 0, gz, 6 * M, 8 * M, 13 * M);
    k.box('metal_panel_blue', gx, 6.4 * M, gz, 6.06 * M, 1.2 * M, 13.06 * M);
    P.ribbon(k, 'left', gx, gz, 6 * M, 13 * M, 3 * M, 1.4 * M);
    P.ribbon(k, 'front', gx, gz, 6 * M, 13 * M, 3 * M, 1.4 * M);
    k.flatRoof('roof_flat_membrane', 'metal_panel_grey', gx, 8 * M, gz, 6 * M, 13 * M, { parapet: 0.3 * M });
    // Rückkühler hinten mit Dampf
    k.box('concrete', -1 * M, 0, -13 * M, 12 * M, 3.4 * M, 3.4 * M);
    for (let i = 0; i < 4; i++) { P.fanUnit(k, -5.5 * M + i * 3 * M, 3.4 * M, -13 * M, 1.2 * M, { h: 1.3 * M }); if (i % 2 === 0) k.smoke(-5.5 * M + i * 3 * M, 5 * M, -13 * M, 'steam', 0.8); }
    // Eingangsplatz mit Emblem und Fahnen
    P.slab(k, 'pavers', 0, 10.2 * M, 6 * M, 8 * M);
    k.cyl('trim_stone', 0, 0, 10.4 * M, 2.4 * M, 0.5 * M, { seg: P.segs(k, 20) });
    k.cyl('water_pool', 0, 0, 10.4 * M, 2.1 * M, 0.55 * M, { seg: P.segs(k, 20) });
    if (P.D1(k)) { P.torus(k, 'metal_light', 0, 1.6 * M, 10.4 * M, 1.1 * M, 0.12 * M, { rx: 0, seg: 16 }); k.box('metal_light', 0, 0.5 * M, 10.4 * M, 0.15 * M, 0.6 * M, 0.15 * M); }
    for (let i = 0; i < 3; i++) P.flagpole(k, -2.4 * M + i * 2.4 * M, 14 * M, 9 * M, ['paint_blue', 'paint_white', 'metal_panel_blue'][i]);
    k.box('glass_curtain_blue', 0, 0, 7 * M, 6 * M, 3.4 * M, 1.6 * M, { lit: 0.9 });
    k.box('metal_panel_white', 0, 3.4 * M, 7 * M, 6.6 * M, 0.4 * M, 2.4 * M);
    P.signBox(k, 'FUSION', 0, 3.6 * M, 8.25 * M, 0, { px: 0.2 * M, bg: 'metal_panel_blue' });
    for (let i = 0; i < 6; i++) P.tree(k, -13.5 * M + i * 1.9 * M, 12.2 * M + (i % 2) * 1.4 * M, 0.75);
    P.stack(k, -13 * M, -12.5 * M, 26 * M, { r: 0.6 * M, rTop: 0.5 * M, mat: 'metal_panel_white', capMat: 'emissive_cool', smoke: false, platform: false });
    P.lamp(k, 4 * M, 6.5 * M); P.lamp(k, -4 * M, 6.5 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Wasserkraftwerk (2×1), Wasserseite hinten
registerArch('hydro', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'concrete');
    // Einlaufbecken mit Pfeilern, Schützen und Portalkran
    const z0 = -D / 2 + 0.15 * M, z1 = -1.4 * M, zc = (z0 + z1) / 2, bd = z1 - z0;
    k.box('concrete_dark', 0, 0, zc, W - 0.3 * M, 0.25 * M, bd);
    k.box('water_canal', 0, 0, zc, W - 0.6 * M, 0.55 * M, bd - 0.1 * M);
    for (const s of [-1, 1]) k.box('concrete', s * (W / 2 - 0.45 * M), 0, zc, 0.6 * M, 1.6 * M, bd);
    const piers = [-6.6, -2.2, 2.2, 6.6];
    for (const px of piers) {
      k.box('concrete', px * M, 0, zc + 0.55 * M, 0.9 * M, 3.6 * M, bd - 1.1 * M);
      k.prism('concrete', [[-0.45 * M, 0], [0.45 * M, 0], [0, 1.05 * M]], 3.6 * M, { x: px * M, y: 1.8 * M, z: z0 + 1.1 * M, rx: -Math.PI / 2 });
    }
    for (let i = 0; i < 5; i++) {
      const xa = i === 0 ? -W / 2 + 0.75 * M : piers[i - 1] * M + 0.45 * M, xb = i === 4 ? W / 2 - 0.75 * M : piers[i] * M - 0.45 * M;
      if (xb - xa < 0.5 * M) continue;
      k.box('metal_dark', (xa + xb) / 2, 0.3 * M, zc + 0.4 * M, xb - xa, 2.6 * M, 0.2 * M);
      if (P.D1(k)) k.box('canvas_white', (xa + xb) / 2, 0.55 * M, zc - 0.6 * M, (xb - xa) * 0.9, 0.04 * M, 1.2 * M);
      if (P.D2(k)) for (let j = 0; j < 4; j++) k.box('metal_light', xa + ((j + 0.5) * (xb - xa)) / 4, 0.55 * M, zc - 1.35 * M, 0.06 * M, 1.6 * M, 0.06 * M);
    }
    k.box('concrete', 0, 3.6 * M, zc, W - 0.3 * M, 0.35 * M, bd);
    if (P.D1(k)) {
      P.railing(k, -W / 2 + 0.3 * M, z0 + 0.2 * M, W / 2 - 0.3 * M, z0 + 0.2 * M, 3.95 * M);
      const gx = v ? -4.4 * M : 4.4 * M;
      for (const s of [-1, 1]) k.box('paint_yellow', gx + s * 1.6 * M, 3.95 * M, zc, 0.4 * M, 3.4 * M, 0.5 * M);
      k.box('paint_yellow', gx, 7.0 * M, zc, 3.6 * M, 0.6 * M, bd * 0.9);
      if (P.D2(k)) { k.box('metal_dark', gx, 5.6 * M, zc + 0.2 * M, 0.9 * M, 1.4 * M, 0.9 * M); k.box('metal_dark', gx, 4.2 * M, zc + 0.6 * M, 0.06 * M, 1.4 * M, 0.06 * M); }
    }
    // Krafthaus (Backstein, Rundbogenfenster, Walmdach)
    const hx = -1.9 * M, hz = 1.0 * M, hw = 12.4 * M, hd = 5 * M, hh = 8 * M;
    const brick = v ? 'brick_dark' : 'brick_red';
    k.box(brick, hx, 0, hz, hw, hh, hd);
    k.box('stone_grey', hx, 0, hz, hw + 0.16 * M, 0.9 * M, hd + 0.16 * M);
    P.gridRow(k, 'front', hx, hz, hw, hd, 4, 1.6 * M, 1.7 * M, 4.2 * M, 3, 5, { arch: true, archMat: 'trim_stone', frame: 'window_frame_white', margin: 0.8 * M, shift: 0 });
    P.gridRow(k, 'left', hx, hz, hw, hd, 1, 1.6 * M, 1.7 * M, 4.2 * M, 3, 5, { arch: true, archMat: 'trim_stone', frame: 'window_frame_white' });
    P.gridRow(k, 'right', hx, hz, hw, hd, 1, 1.6 * M, 1.7 * M, 4.2 * M, 3, 5, { arch: true, archMat: 'trim_stone', frame: 'window_frame_white' });
    if (P.D1(k)) { k.band('trim_stone', hx, hz, hw, hd, hh - 0.5 * M, 0.5 * M, 0.14 * M); for (const s of [-1, 1]) k.box('trim_stone', hx + s * (hw / 2 - 0.25 * M), 0, hz + hd / 2, 0.6 * M, hh, 0.2 * M); }
    k.hipRoof(v ? 'roof_slate' : 'roof_copper', hx, hh, hz, hw, hd, 2.4 * M, { overhang: 0.4 * M, ridgeK: 0.8 });
    if (P.D2(k)) { k.box('roof_copper', hx, hh + 2.2 * M, hz, 1.4 * M, 1.4 * M, 1.4 * M); k.cone('roof_copper', hx, hh + 3.6 * M, hz, 1.1 * M, 1.4 * M, { seg: 4, ry: Math.PI / 4 }); }
    P.door(k, hx, hz + hd / 2, 0, { w: 2 * M, h: 3 * M, mat: 'wood_dark', frame: 'trim_stone' });
    P.text(k, 'WASSERKRAFT', hx, 6.4 * M, hz + hd / 2 + 0.05 * M, 0, 0.16 * M, 'trim_stone');
    // Schaltanlage rechts
    P.substation(k, 7.0 * M, 1.6 * M, 4.8 * M, 5.4 * M, { n: 1, s: 0.8 });
    P.lamp(k, 4.2 * M, 4.2 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Geothermie (2×2)
registerArch('geothermal', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'gravel');
    P.slab(k, 'asphalt', 0, 8 * M, 4 * M, 3.8 * M);
    // Kraftwerksgebäude
    const hx = -5 * M, hz = 3 * M, hw = 8.4 * M, hd = 6 * M, hh = 7 * M;
    k.box('metal_panel_grey', hx, 0, hz, hw, hh, hd);
    k.box(v ? 'metal_corrugated_green' : 'metal_panel_blue', hx, hh - 1.4 * M, hz, hw + 0.06 * M, 1.1 * M, hd + 0.06 * M);
    P.ribbon(k, 'front', hx, hz, hw, hd, 3 * M, 1.4 * M);
    P.ribbon(k, 'right', hx, hz, hw, hd, 3 * M, 1.4 * M);
    k.flatRoof('roof_flat_membrane', 'metal_panel_grey', hx, hh, hz, hw, hd, { parapet: 0.3 * M });
    if (P.D1(k)) { P.fanUnit(k, hx - 2 * M, hh, hz, 0.8 * M); P.fanUnit(k, hx + 1.5 * M, hh, hz - 1 * M, 0.8 * M); }
    P.rollerDoor(k, hx - 2 * M, hz + hd / 2, 0, 3 * M, 3.6 * M);
    P.signBox(k, 'GEOTHERMIE', hx + 1.6 * M, 4.9 * M, hz + hd / 2, 0, { px: 0.13 * M, bg: 'trim_dark' });
    // Zwangszug-Kühlturm mit drei Lüftern
    const cx = 5 * M, cz = -6.6 * M, cw = 9 * M, cd = 5.4 * M, ch = 5 * M;
    k.box('concrete', cx, 0, cz, cw, ch, cd);
    if (P.D1(k)) for (const sd of ['front', 'back']) { const [x, z, ry] = P.onSide(sd, cx, cz, cw, cd, 0, 0.03 * M); P.quad(k, 'metal_dark', x, 1.6 * M, z, cw - 0.8 * M, 2.2 * M, ry); }
    for (let i = 0; i < 3; i++) { const fx = cx - 3 * M + i * 3 * M; P.fanUnit(k, fx, ch, cz, 1.3 * M, { h: 1.6 * M, mat: 'concrete' }); k.smoke(fx, ch + 1.8 * M, cz, 'steam', 1.4); }
    // Bohrköpfe mit Schalldämpfer
    const wells = [[-7.2 * M, -7.4 * M], [-2.2 * M, -8.6 * M]];
    for (const [wx, wz] of wells) {
      P.slab(k, 'concrete', wx, wz, 2.8 * M, 2.8 * M, 0.2 * M);
      k.cyl('metal_dark', wx, 0.2 * M, wz, 0.35 * M, 1.4 * M, { seg: P.segs(k, 8) });
      if (P.D2(k)) { k.cyl('paint_red', wx, 1.2 * M, wz, 0.5 * M, 0.15 * M, { seg: 8 }); P.torus(k, 'paint_red', wx, 1.75 * M, wz + 0.4 * M, 0.3 * M, 0.04 * M, { rx: 0, seg: 10 }); }
      k.smoke(wx, 1.8 * M, wz, 'steam', 0.4);
    }
    // Separatoren
    P.tank(k, -1.6 * M, -3.6 * M, 1.0 * M, 4.6 * M, { mat: 'tank_white', roof: 'dome', domeK: 0.6 });
    P.tank(k, 0.8 * M, -3.6 * M, 0.8 * M, 3.8 * M, { mat: 'tank_white', roof: 'dome', domeK: 0.6 });
    // Rohrleitungen (isoliert, silbern) mit Dehnungsbogen
    const py = 1.1 * M, r = 0.32 * M;
    const supports = (pts) => { if (!P.D1(k)) return; for (let i = 0; i < pts.length - 1; i++) { const [a, b] = [pts[i], pts[i + 1]]; if (Math.abs(a[1] - py) > 0.01 || Math.abs(b[1] - py) > 0.01) continue; const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / (3 * M))); for (let j = 1; j < n; j++) { const t = j / n; k.box('concrete', a[0] + (b[0] - a[0]) * t, 0, a[2] + (b[2] - a[2]) * t, 0.6 * M, py - r, 0.6 * M); } } };
    const runA = [[-7.2 * M, py, -7.4 * M], [-4.2 * M, py, -7.4 * M], [-4.2 * M, 3.6 * M, -7.4 * M], [-4.2 * M, 3.6 * M, -5.4 * M], [-4.2 * M, py, -5.4 * M], [-4.2 * M, py, -3.6 * M], [-2.6 * M, py, -3.6 * M]];
    const runB = [[-2.2 * M, py, -8.6 * M], [-2.2 * M, py, -5.0 * M], [-1.6 * M, py, -5.0 * M], [-1.6 * M, py, -4.6 * M]];
    const runC = [[-1.6 * M, 2.6 * M, -2.6 * M], [-1.6 * M, 2.6 * M, -1.4 * M], [-1.6 * M, py, -1.4 * M], [-1.6 * M, py, -0.6 * M], [hx + hw / 2 - 1 * M, py, -0.6 * M], [hx + hw / 2 - 1 * M, py, 0]];
    const runD = [[0.8 * M, py, -2.8 * M], [3.4 * M, py, -2.8 * M], [3.4 * M, py, -3.9 * M]];
    for (const run of [runA, runB, runC, runD]) { P.pipeline(k, 'metal_light', run, r); supports(run); }
    // Thermalbecken mit Dampf
    const px = 5.4 * M, pz = 3.4 * M;
    P.mound(k, 'rock', px, pz, 3.6 * M, 0.5 * M, { seg: 12 });
    k.cyl('water_pool', px, 0.3 * M, pz, 3.0 * M, 0.3 * M, { seg: P.segs(k, 18) });
    k.smoke(px, 0.8 * M, pz, 'steam', 0.9);
    if (P.D2(k)) for (let i = 0; i < 7; i++) { const a = i * 0.9; k.add('rock', new THREE.DodecahedronGeometry(0.45 * M, 0), { x: px + Math.cos(a) * 3.2 * M, y: 0.4 * M, z: pz + Math.sin(a) * 3.2 * M, ry: a }); }
    P.fenceRect(k, 0, 0, W - 0.4 * M, D - 0.4 * M, { h: 2 * M, gate: 4.2 * M });
    P.lamp(k, 2.6 * M, 6.4 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Kernkraftwerk (3×3)
registerArch('nuclear', {
  variants: 1,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx);
    P.lot(k, W, D, 'concrete');
    P.slab(k, 'grass', -9 * M, 13 * M, 11.4 * M, 3.4 * M);
    // Kühltürme hinten
    P.coolingTower(k, -7.4 * M, -8.2 * M, 6.0 * M, 25 * M, { steam: 3.2, bands: 'concrete_dark' });
    P.coolingTower(k, 6.8 * M, -8.6 * M, 5.6 * M, 23 * M, { steam: 3 });
    // Reaktorgebäude: Zylinder mit Kuppel
    const rx = -8.4 * M, rz = 5.6 * M, rr = 4.8 * M, rh = 11 * M;
    k.cyl('concrete', rx, 0, rz, rr + 0.5 * M, 1 * M, { seg: P.segs(k, 28) });
    k.cyl('concrete_panel', rx, 1 * M, rz, rr, rh - 1 * M, { seg: P.segs(k, 28) });
    k.dome('concrete_panel', rx, rh, rz, rr, { seg: P.segs(k, 28), sy: 0.72 });
    if (P.D1(k)) { k.cyl('trim_dark', rx, rh - 1.2 * M, rz, rr + 0.04 * M, 0.5 * M, { seg: P.segs(k, 28), open: true }); P.door(k, rx, rz + rr - 0.1 * M, 0, { w: 2.2 * M, h: 3 * M, mat: 'metal_dark', frame: 'concrete_dark' }); }
    // Hilfsanlagen, Maschinenhaus
    k.box('concrete', -2.8 * M, 0, 5.8 * M, 3.6 * M, 7 * M, 7.4 * M);
    P.ribbon(k, 'front', -2.8 * M, 5.8 * M, 3.6 * M, 7.4 * M, 4.4 * M, 1 * M);
    k.flatRoof('roof_flat_gravel', 'concrete_dark', -2.8 * M, 7 * M, 5.8 * M, 3.6 * M, 7.4 * M, { parapet: 0.4 * M });
    const tx = 6 * M, tz = 5.4 * M, tw = 14.6 * M, td = 8 * M, th = 11 * M;
    k.box('metal_panel_white', tx, 0, tz, tw, th, td);
    k.box('concrete_dark', tx, 0, tz, tw + 0.12 * M, 0.8 * M, td + 0.12 * M);
    k.box('metal_panel_blue', tx, th - 2 * M, tz, tw + 0.06 * M, 1.4 * M, td + 0.06 * M);
    P.ribbon(k, 'front', tx, tz, tw, td, 5 * M, 1.8 * M);
    P.ribbon(k, 'right', tx, tz, tw, td, 5 * M, 1.8 * M);
    k.flatRoof('roof_flat_membrane', 'metal_panel_white', tx, th, tz, tw, td, { parapet: 0.4 * M });
    if (P.D1(k)) for (let i = 0; i < 4; i++) P.fanUnit(k, tx - 5 * M + i * 3.4 * M, th, tz, 0.8 * M);
    P.rollerDoor(k, tx + 4 * M, tz + td / 2, 0, 3.6 * M, 4.4 * M);
    P.signBox(k, 'KERNKRAFTWERK', tx - 1.4 * M, th - 3 * M, tz + td / 2, 0, { px: 0.17 * M, bg: 'metal_panel_blue' });
    // Abluftkamin
    P.stack(k, -13.4 * M, -0.6 * M, 38 * M, { r: 0.9 * M, rTop: 0.7 * M, mat: 'concrete', bands: 4, bandH: 1.3 * M, smoke: false });
    // Vorfeld: Umspannwerk, Wache, Zaun, Parkplatz
    P.substation(k, 7.6 * M, 12.2 * M, 12.6 * M, 3.8 * M, { n: 3, s: 0.8 });
    P.parking(k, -9 * M, 12.6 * M, 9 * M, 3 * M, { rows: 1, facing: 0, fill: 0.8 });
    k.box('plaster_white', -2 * M, 0, 12.4 * M, 3 * M, 2.8 * M, 2.4 * M);
    k.flatRoof('roof_flat_membrane', 'trim_dark', -2 * M, 2.8 * M, 12.4 * M, 3 * M, 2.4 * M, { parapet: 0.2 * M });
    if (P.D1(k)) k.box('glass_window', -2 * M, 1.1 * M, 13.62 * M, 2.4 * M, 1.2 * M, 0.04 * M, { lit: 0.9 });
    if (P.D1(k)) { P.fence(k, -W / 2 + 0.3 * M, 10 * M, -4 * M, 10 * M, { h: 2.4 * M, wire: true }); P.fence(k, 0.3 * M, 10 * M, 1.2 * M, 10 * M, { h: 2.4 * M, wire: true }); k.box('paint_red', -1.85 * M, 1 * M, 10 * M, 4 * M, 0.12 * M, 0.12 * M); }
    P.lamp(k, -4 * M, 9 * M, 6 * M); P.lamp(k, 2 * M, 1 * M, 6 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Batteriespeicher (1×1)
registerArch('battery', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'gravel');
    P.slab(k, 'concrete', -1.2 * M, -0.5 * M, 7 * M, 8.6 * M, 0.2 * M);
    const accent = v ? 'paint_blue' : 'paint_green';
    for (let i = 0; i < 3; i++) {
      const z = -3.3 * M + i * 2.9 * M;
      k.box('metal_panel_white', -1.4 * M, 0.2 * M, z, 6.06 * M, 2.6 * M, 2.44 * M);
      if (P.D1(k)) {
        k.box(accent, -1.4 * M, 2.3 * M, z, 6.08 * M, 0.22 * M, 2.46 * M);
        k.box('metal_light', 1.0 * M, 2.8 * M, z, 1.2 * M, 0.7 * M, 1.6 * M);
        k.box('metal_light', -3.2 * M, 2.8 * M, z, 1.2 * M, 0.7 * M, 1.6 * M);
      }
      if (P.D2(k)) for (let j = 0; j < 4; j++) { k.box('metal_dark', -3.6 * M + j * 1.5 * M, 0.7 * M, z + 1.23 * M, 0.9 * M, 1.4 * M, 0.03 * M); k.box('paint_yellow', -3.6 * M + j * 1.5 * M, 1.7 * M, z + 1.24 * M, 0.3 * M, 0.3 * M, 0.02 * M); }
    }
    P.transformer(k, 3.4 * M, -2.4 * M, Math.PI / 2, 0.8);
    k.box('metal_panel_grey', 3.4 * M, 0, 1.4 * M, 2 * M, 2.2 * M, 1.4 * M);
    if (P.D1(k)) { k.box('metal_dark', 1.4 * M, 0.2 * M, 1.4 * M, 1.6 * M, 0.3 * M, 0.5 * M); k.box('metal_dark', 1.4 * M, 0.2 * M, -2.2 * M, 1.6 * M, 0.3 * M, 0.5 * M); }
    P.fenceRect(k, 0, 0, W - 0.5 * M, D - 0.5 * M, { h: 2.2 * M, gate: 2.6 * M, gateX: 2.4 * M, wire: true });
    P.signBox(k, 'SPEICHER', -1.4 * M, 2.4 * M, D / 2 - 0.3 * M, 0, { px: 0.1 * M, bg: accent });
    P.lamp(k, 3.6 * M, 3.8 * M, 5 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Heizkraftwerk (2×2) mit Wärmespeicher
registerArch('district_heating', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'concrete');
    P.slab(k, 'asphalt', 1.8 * M, 6.4 * M, 4 * M, 7 * M);
    // Backstein-Maschinenhaus
    const hx = -5 * M, hz = 2.2 * M, hw = 8.4 * M, hd = 9 * M, hh = 11 * M, brick = v ? 'brick_dark' : 'brick_red';
    k.box(brick, hx, 0, hz, hw, hh, hd);
    k.box('stone_dark', hx, 0, hz, hw + 0.16 * M, 0.8 * M, hd + 0.16 * M);
    P.gridRow(k, 'front', hx, hz, hw, hd, 3, 1.6 * M, 1.5 * M, 6.4 * M, 3, 7, { arch: true, archMat: 'trim_stone' });
    P.gridRow(k, 'right', hx, hz, hw, hd, 3, 1.6 * M, 1.5 * M, 6.4 * M, 3, 7, { arch: true, archMat: 'trim_stone' });
    P.gridRow(k, 'left', hx, hz, hw, hd, 3, 1.6 * M, 1.5 * M, 6.4 * M, 3, 7, { arch: true, archMat: 'trim_stone' });
    if (P.D1(k)) { k.band('trim_stone', hx, hz, hw, hd, hh - 0.6 * M, 0.6 * M, 0.15 * M); k.band('trim_stone', hx, hz, hw, hd, 9.4 * M, 0.2 * M, 0.08 * M); }
    k.gableRoof('roof_tiles_anthracite', hx, hh, hz, hw, hd, 2.2 * M, { ridge: 'z', overhang: 0.3 * M });
    k.gableEnds(brick, hx, hh, hz, hw, hd, 2.2 * M, { ridge: 'z' });
    if (P.D1(k)) P.clock(k, hx, hh + 0.9 * M, hz + hd / 2 + 0.05 * M, 0.7 * M);
    P.text(k, 'FERNWAERME', hx, 9.8 * M, hz + hd / 2 + 0.06 * M, 0, 0.14 * M, 'trim_stone');
    // Kesselhaus + Schornstein
    k.box('metal_corrugated', -5.6 * M, 0, -6.4 * M, 7.2 * M, 14 * M, 6 * M);
    P.gridRow(k, 'right', -5.6 * M, -6.4 * M, 7.2 * M, 6 * M, 2, 3 * M, 0.9 * M, 9 * M, 1, 6);
    k.flatRoof('roof_flat_membrane', 'metal_dark', -5.6 * M, 14 * M, -6.4 * M, 7.2 * M, 6 * M, { parapet: 0.4 * M });
    P.stack(k, -0.8 * M, -7.6 * M, 30 * M, { r: 1.1 * M, rTop: 0.8 * M, mat: 'chimney_brick', capMat: 'metal_dark', amount: 1.6 });
    k.box('metal_corrugated', -1.4 * M, 10 * M, -7.6 * M, 1.6 * M, 1.6 * M, 1.4 * M);
    // Wärmespeicher
    const sx = 5.6 * M, sz = -4.2 * M;
    P.tank(k, sx, sz, 3.6 * M, 20 * M, { mat: v ? 'metal_corrugated_green' : 'metal_panel_blue', roof: 'cone', coneK: 0.18, rail: true, ringsAt: [0.25, 0.5, 0.75], ringMat: 'metal_light' });
    P.textArc(k, 'FERNWAERME', sx, 16.5 * M, sz, 3.6 * M, 0.35, 0.22 * M, 'paint_white');
    // Fernwärmeleitung mit Dehnungsbogen über die Zufahrt
    const r = 0.38 * M;
    for (const off of [0, 1.1 * M]) {
      const pts = [[hx + hw / 2, 1.3 * M, -1.2 * M + off], [5.2 * M, 1.3 * M, -1.2 * M + off], [5.2 * M, 1.3 * M, 3.4 * M + off], [5.2 * M, 5.4 * M, 3.4 * M + off], [5.2 * M, 5.4 * M, 6.4 * M + off], [5.2 * M, 1.3 * M, 6.4 * M + off], [5.2 * M, 1.3 * M, D / 2 - 0.2 * M]];
      if (off) for (const p of pts) p[0] += 1.1 * M;
      P.pipeline(k, 'metal_light', pts, r);
    }
    if (P.D1(k)) for (const z of [0.8 * M, 2.4 * M, 8 * M]) k.box('concrete', 5.75 * M, 0, z, 2.4 * M, 0.9 * M, 0.5 * M);
    k.smoke(sx, 20.7 * M, sz, 'steam', 0.4);
    P.lamp(k, -0.6 * M, 8.6 * M); P.lamp(k, 3.8 * M, 1 * M);
    return P.finish(k);
  },
});
