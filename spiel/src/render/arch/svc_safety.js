// Schutz: Katastrophenschutz, Notunterkunft, Warnsirene, Wetterstation, Winterdienst, Hochwasserschutz. Besitzer: G5.
import * as THREE from 'three';
import { registerArch } from './index.js';
import * as P from './svc_parts.js';

const { M, pick } = P;
const dims = (ctx) => [ctx.fw * 10 * M, ctx.fd * 10 * M];

// Gittermast mit Antennen
function lattice(k, x, z, h, o = {}) {
  const b = o.base ?? 1.6 * M, t = o.top ?? 0.5 * M, mat = o.mat || 'metal_light';
  if (k.detail === 0) { k.cyl(mat, x, 0, z, b * 0.5, h, { seg: 3, rTop: t * 0.5 }); return; }
  const lv = (y) => b + (t - b) * (y / h);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) P.beam(k, mat, [x + sx * b / 2, 0, z + sz * b / 2], [x + sx * t / 2, h, z + sz * t / 2], 0.1 * M);
  if (P.D2(k)) { const n = Math.max(3, Math.round(h / (2.5 * M))); for (let i = 0; i < n; i++) { const y1 = (h * i) / n, y2 = (h * (i + 1)) / n; for (const [a, c] of [[[-1, 1], [1, 1]], [[1, -1], [-1, -1]], [[1, 1], [1, -1]], [[-1, -1], [-1, 1]]]) P.beam(k, mat, [x + a[0] * lv(y1) / 2, y1, z + a[1] * lv(y1) / 2], [x + c[0] * lv(y2) / 2, y2, z + c[1] * lv(y2) / 2], 0.05 * M); } }
  if (o.light !== false) k.light(x, h + 0.2 * M, z, 0xff3a2a, 0.25);
}
// Sandsackstapel
function sandbags(k, x, z, n, rows, ry = 0) {
  const g = new P.G(k, x, z, ry);
  if (k.detail === 0) { g.box('sand', 0, 0, 0, n * 0.6 * M, rows * 0.25 * M, 0.9 * M); return; }
  for (let r = 0; r < rows; r++) for (let i = 0; i < n - r; i++) g.box(r % 2 ? 'sand' : 'hay', (i - (n - r - 1) / 2) * 0.62 * M, r * 0.24 * M, 0, 0.58 * M, 0.24 * M, 0.9 * M);
}
const THW = 'paint_blue';

// ---------------------------------------------------------------- Katastrophenschutz (2×2)
registerArch('disaster_center', {
  variants: 1,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx);
    P.lot(k, W, D, 'concrete');
    // Fahrzeughalle mit blauen Toren
    const hx = -2.4 * M, hz = -4.0 * M, hw = 15 * M, hd = 8 * M, hh = 6.4 * M;
    k.box('metal_panel_white', hx, 0, hz, hw, hh, hd);
    k.box('concrete_dark', hx, 0, hz, hw + 0.1 * M, 0.5 * M, hd + 0.1 * M);
    k.box(THW, hx, hh - 1.4 * M, hz, hw + 0.06 * M, 1.4 * M, hd + 0.06 * M);
    for (let i = 0; i < 4; i++) P.rollerDoor(k, hx - hw / 2 + (hw / 4) * (i + 0.5), hz + hd / 2, 0, 3.0 * M, 4.0 * M, { mat: 'metal_panel_white', frame: THW, glassRow: true, ribs: 4 });
    k.flatRoof('roof_flat_membrane', THW, hx, hh, hz, hw, hd, { parapet: 0.3 * M });
    k.rooftopClutter(hx, hh, hz, hw * 0.6, hd * 0.5, 2);
    P.signBox(k, 'KATASTROPHENSCHUTZ', hx, hh - 0.25 * M, hz + hd / 2 + 0.05 * M, 0, { px: 0.11 * M, bg: THW, frame: false });
    // Fahrzeuge
    P.truck(k, hx - 5.6 * M, 3.4 * M, 0, { len: 8.6 * M, cab: THW, body: THW, stripe: 'paint_white' });
    P.van(k, hx - 1.9 * M, 2.6 * M, 0, THW, { stripe: 'paint_white', lights: 'emissive_cool' });
    P.truck(k, hx + 2.0 * M, 3.6 * M, 0, { len: 9 * M, cab: THW, body: 'canvas_white', stripe: THW });
    // Funkmast, Übungsturm, Lagerzelt, Sandsäcke, Landeplatz
    lattice(k, 8.4 * M, -8.4 * M, 20 * M);
    if (P.D1(k)) for (const y of [14, 17]) k.box('metal_light', 8.4 * M, y * M, -8.4 * M, 2.4 * M, 0.1 * M, 0.1 * M);
    k.prism('canvas_white', [[-2.4 * M, 0], [2.4 * M, 0], [2.4 * M, 2.4 * M], [0, 3.6 * M], [-2.4 * M, 2.4 * M]], 6 * M, { x: 7.4 * M, y: 0, z: -2.6 * M });
    if (P.D1(k)) k.box('metal_dark', 7.4 * M, 0, 0.42 * M, 2.4 * M, 2.4 * M, 0.04 * M);
    sandbags(k, 3.8 * M, 7.6 * M, 6, 3, 0); sandbags(k, 3.8 * M, 8.7 * M, 5, 2, 0);
    P.helipad(k, -5.8 * M, P.PAVE, 6.4 * M, 3.0 * M, { ringMat: 'paint_white' });
    P.lamp(k, 9 * M, 5 * M, 6 * M); P.lamp(k, -1 * M, 9 * M, 6 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Notunterkunft (2×1)
registerArch('shelter', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'pavers');
    // Robuster Betonbau (Hochbunker-Anklang)
    const bx = -3.6 * M, bz = -1.0 * M, bw = 11.4 * M, bd = 6.8 * M, bh = 9.4 * M;
    k.box('concrete', bx, 0, bz, bw, bh, bd);
    k.box('concrete_dark', bx, 0, bz, bw + 0.2 * M, 1.0 * M, bd + 0.2 * M);
    k.box('concrete', bx, bh, bz, bw + 0.8 * M, 0.8 * M, bd + 0.8 * M);
    if (P.D1(k)) for (let i = 1; i < 3; i++) k.band('concrete_dark', bx, bz, bw, bd, i * 3.1 * M, 0.12 * M, 0.04 * M);
    for (const sd of ['front', 'left', 'right']) k.windows(sd, bx, bz, bw, bd, 0, 3, 3.1 * M, { winW: 0.9 * M, winH: 0.9 * M, spacing: 2.8 * M, frame: 'metal_dark', mullion: false, skipGround: sd === 'front' });
    k.box(v ? 'paint_orange' : 'paint_green', bx, 3.6 * M, bz + bd / 2 + 0.02 * M, bw, 0.4 * M, 0.06 * M);
    P.door(k, bx - 2 * M, bz + bd / 2, 0, { w: 2 * M, h: 2.6 * M, mat: 'metal_dark', frame: 'concrete_dark', canopy: 'concrete' });
    P.door(k, bx + 2.4 * M, bz + bd / 2, 0, { w: 1.4 * M, h: 2.4 * M, mat: 'metal_dark', frame: 'concrete_dark' });
    P.signBox(k, 'NOTUNTERKUNFT', bx + 0.4 * M, 4.8 * M, bz + bd / 2, 0, { px: 0.13 * M, bg: 'paint_green' });
    if (P.D1(k)) { k.box('emissive_green', bx - 2 * M, 3.3 * M, bz + bd / 2 + 0.7 * M, 0.8 * M, 0.35 * M, 0.06 * M); k.light(bx - 2 * M, 3.4 * M, bz + bd / 2 + 1 * M, 0x60ff90, 0.3); }
    // Zelte, Wassertank, Container, Toiletten
    for (const z of [-2.4 * M, 1.6 * M]) {
      k.prism('canvas_white', [[-1.9 * M, 0], [1.9 * M, 0], [1.9 * M, 1.6 * M], [0, 2.8 * M], [-1.9 * M, 1.6 * M]], 4.6 * M, { x: 5.6 * M, y: 0, z, ry: Math.PI / 2 });
      if (P.D1(k)) { k.box(THW, 3.28 * M, 1.4 * M, z, 0.04 * M, 0.6 * M, 0.6 * M); k.box('paint_white', 3.26 * M, 1.6 * M, z, 0.04 * M, 0.2 * M, 0.45 * M); }
    }
    P.tank(k, 8.8 * M, 1.6 * M, 0.8 * M, 2.0 * M, { mat: 'tank_white', roof: 'dome', domeK: 0.3, rings: false });
    P.container(k, 8.4 * M, 0, -2.6 * M, 0, 'container_blue');
    if (P.D1(k)) for (let i = 0; i < 3; i++) k.box(i === 1 ? 'paint_white' : THW, 6.0 * M + i * 1.3 * M, 0, 4.2 * M, 1.1 * M, 2.3 * M, 1.1 * M);
    P.lamp(k, 2.6 * M, 4.4 * M, 4.4 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Warnsirene (1×1) mit drehendem Kopf
registerArch('warning_siren', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'grass', { curb: false });
    P.slab(k, 'gravel', 0, 0, 4.4 * M, 4.4 * M);
    P.walk(k, 'gravel', [[1.2 * M, 2 * M], [1.2 * M, D / 2]], 1.0 * M);
    const h = v ? 14 * M : 11 * M;
    k.box('concrete', 0, 0, 0, 1.4 * M, 0.5 * M, 1.4 * M);
    if (v) lattice(k, 0, 0, h, { base: 1.4 * M, top: 0.5 * M, light: false });
    else k.cyl('metal_light', 0, 0.5 * M, 0, 0.22 * M, h - 0.5 * M, { seg: P.segs(k, 8), rTop: 0.15 * M });
    k.box('metal_dark', 0, h, 0, 1.2 * M, 0.25 * M, 1.2 * M);
    if (P.D2(k)) P.railing(k, -0.6 * M, 0.6 * M, 0.6 * M, 0.6 * M, h + 0.25 * M, { h: 0.6 * M });
    P.anim(k, [0, h + 0.25 * M, 0], 'y', 1.6, (s) => {
      s.cyl('paint_yellow', 0, 0, 0, 0.35 * M, 1.2 * M, { seg: P.segs(s, 10) });
      for (const sd of [-1, 1]) {
        s.add('paint_yellow', new THREE.CylinderGeometry(0.75 * M, 0.25 * M, 1.4 * M, P.segs(s, 10), 1, true), { x: sd * 0.95 * M, y: 0.6 * M, z: 0, rz: sd * Math.PI / 2 });
        if (s.detail) s.add('metal_dark', new THREE.CircleGeometry(0.72 * M, P.segs(s, 10)), { x: sd * 1.64 * M, y: 0.6 * M, z: 0, ry: sd * Math.PI / 2 });
      }
      s.cone('metal_dark', 0, 1.2 * M, 0, 0.45 * M, 0.4 * M, { seg: 8 });
    });
    // Schaltschrank, Solarmodul, Warnschild
    k.box('metal_panel_grey', 1.6 * M, 0, -0.6 * M, 0.9 * M, 1.6 * M, 0.5 * M);
    if (P.D1(k)) {
      k.box('metal_dark', -1.6 * M, 0, 1.2 * M, 0.08 * M, 2.2 * M, 0.08 * M);
      k.box('solar_panel', -1.6 * M, 2.1 * M, 1.2 * M, 1.4 * M, 0.06 * M, 1.0 * M, { rx: 0.5 });
      k.prism('paint_yellow', [[-0.45 * M, 0], [0.45 * M, 0], [0, 0.8 * M]], 0.04 * M, { x: 1.6 * M, y: 1.7 * M, z: -0.32 * M });
      k.box('metal_dark', 1.6 * M, 1.95 * M, -0.29 * M, 0.08 * M, 0.3 * M, 0.02 * M);
    }
    P.fenceRect(k, 0, 0, 4.6 * M, 4.6 * M, { h: 1.6 * M, gate: 1 * M, gateX: 1.2 * M });
    P.bush(k, -3.8 * M, -3.6 * M, 1.2); P.tree(k, 3.8 * M, -3.6 * M, 0.7); P.bush(k, -3.6 * M, 3.8 * M, 1);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Wetterstation (1×1) mit Radarkuppel und Anemometer
registerArch('weather_station', {
  variants: 1,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx);
    P.lot(k, W, D, 'grass', { curb: false });
    P.walk(k, 'gravel', [[-1.8 * M, D / 2], [-1.8 * M, -0.6 * M], [1.6 * M, -0.6 * M]], 1.0 * M);
    // Radarturm
    const rx = -2.4 * M, rz = -2.6 * M;
    lattice(k, rx, rz, 9 * M, { base: 2.4 * M, top: 1.4 * M, light: false });
    k.box('metal_dark', rx, 9 * M, rz, 2.2 * M, 0.3 * M, 2.2 * M);
    k.sphere('paint_white', rx, 10.8 * M, rz, 1.7 * M, { seg: P.segs(k, 16) });
    k.light(rx, 12.6 * M, rz, 0xff3a2a, 0.25);
    // Wetterhütte
    const hx = 2.0 * M, hz = 2.0 * M;
    for (const a of [-1, 1]) for (const b of [-1, 1]) k.box('paint_white', hx + a * 0.4 * M, 0, hz + b * 0.35 * M, 0.08 * M, 1.2 * M, 0.08 * M);
    k.box('paint_white', hx, 1.2 * M, hz, 1.0 * M, 0.8 * M, 0.9 * M);
    k.gableRoof('paint_white', hx, 2.0 * M, hz, 1.0 * M, 0.9 * M, 0.25 * M, { ridge: 'x', overhang: 0.1 * M });
    if (P.D2(k)) for (let i = 0; i < 4; i++) k.box('metal_light', hx, 1.3 * M + i * 0.18 * M, hz + 0.46 * M, 0.9 * M, 0.04 * M, 0.02 * M);
    // Anemometer-Mast mit drehenden Schalen
    const ax = 3.0 * M, az = -2.8 * M, ah = 10 * M;
    k.cyl('metal_light', ax, 0, az, 0.08 * M, ah, { seg: 6 });
    if (P.D1(k)) { k.box('metal_light', ax, ah - 1.2 * M, az, 1.6 * M, 0.06 * M, 0.06 * M); k.box('metal_dark', ax + 0.8 * M, ah - 1.2 * M, az, 0.06 * M, 0.5 * M, 0.06 * M); k.box('paint_red', ax - 0.8 * M, ah - 0.9 * M, az, 0.04 * M, 0.3 * M, 0.6 * M); }
    P.anim(k, [ax, ah, az], 'y', 3.2, (s) => {
      s.cyl('metal_dark', 0, 0, 0, 0.08 * M, 0.25 * M, { seg: 6 });
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        s.box('metal_light', Math.cos(a) * 0.35 * M, 0.15 * M, Math.sin(a) * 0.35 * M, 0.7 * M, 0.04 * M, 0.04 * M, { ry: -a });
        s.sphere('metal_light', Math.cos(a) * 0.7 * M, 0.15 * M, Math.sin(a) * 0.7 * M, 0.16 * M, { seg: 6 });
      }
    });
    // Messgeräte, Büro
    if (P.D1(k)) { k.cyl('metal_light', 0.4 * M, 0, 1.4 * M, 0.18 * M, 1.0 * M, { seg: 8 }); k.box('metal_dark', 0.2 * M, 0, -3.6 * M, 0.08 * M, 1.6 * M, 0.08 * M); k.box('solar_panel', 0.2 * M, 1.5 * M, -3.6 * M, 1.4 * M, 0.06 * M, 0.9 * M, { rx: 0.6 }); }
    k.box('metal_panel_white', 2.4 * M, 0, -0.4 * M, 4.4 * M, 2.6 * M, 2.44 * M);
    if (P.D1(k)) k.box('glass_window', 2.4 * M, 1.0 * M, 0.83 * M, 2.6 * M, 1.0 * M, 0.04 * M, { lit: 0.9 });
    P.signBox(k, 'WETTERDIENST', 2.4 * M, 2.4 * M, 0.82 * M, 0, { px: 0.07 * M, bg: 'paint_blue' });
    P.fenceRect(k, 0, 0, W - 0.5 * M, D - 0.5 * M, { h: 1.4 * M, gate: 1.4 * M, gateX: -1.8 * M });
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Winterdienst (1×1) mit Salzlager
registerArch('snow_depot', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'asphalt');
    // Salzlager (Holzkuppel) mit Öffnung
    const sx = -2.2 * M, sz = -2.0 * M;
    k.cyl('concrete', sx, 0, sz, 3.0 * M, 0.9 * M, { seg: P.segs(k, 12) });
    if (v === 0) k.cone('wood_planks', sx, 0.9 * M, sz, 3.1 * M, 4.4 * M, { seg: P.segs(k, 12) });
    else k.dome('wood_planks', sx, 0.9 * M, sz, 3.1 * M, { seg: P.segs(k, 12), sy: 1.1 });
    k.box('wood_dark', sx + 1.0 * M, 0, sz + 2.5 * M, 2.0 * M, 2.4 * M, 1.2 * M);
    k.box('rubber', sx + 1.0 * M, 0, sz + 3.12 * M, 1.6 * M, 2.1 * M, 0.04 * M);
    if (P.D1(k)) { k.cone('roof_metal_grey', sx, 0.9 * M + (v ? 3.3 : 4.2) * M, sz, 0.5 * M, 0.6 * M, { seg: 6 }); P.mound(k, 'paint_white', sx + 2.4 * M, sz + 3.6 * M, 1.3 * M, 0.8 * M); }
    // Garage
    const gx = 2.6 * M, gz = -1.2 * M;
    k.box('metal_panel_grey', gx, 0, gz, 4.4 * M, 4.6 * M, 6.6 * M);
    k.box('paint_orange', gx, 3.8 * M, gz, 4.46 * M, 0.5 * M, 6.66 * M);
    k.flatRoof('roof_flat_membrane', 'paint_orange', gx, 4.6 * M, gz, 4.4 * M, 6.6 * M, { parapet: 0.3 * M });
    P.rollerDoor(k, gx, gz + 3.3 * M, 0, 3.2 * M, 3.4 * M, { mat: 'metal_panel_white', frame: 'paint_orange' });
    P.signBox(k, 'WINTERDIENST', gx, 4.95 * M, gz + 3.33 * M, 0, { px: 0.06 * M, bg: 'paint_orange', frame: false });
    // Räumfahrzeug mit Schild
    if (P.D1(k)) {
      const g = new P.G(k, gx, 3.8 * M, 0);
      P.truck(k, gx, 3.0 * M, 0, { len: 6.4 * M, cab: 'paint_orange', body: 'paint_orange', bodyH: 1.6 * M });
      g.box('paint_orange', 0, 0.2 * M, 0.9 * M, 3.0 * M, 1.0 * M, 0.25 * M, { ry: 0.35 });
      g.box('emissive_warm', 0, 3.0 * M, -0.8 * M, 1.0 * M, 0.2 * M, 0.3 * M);
    }
    P.lamp(k, -4.2 * M, 4.2 * M, 4.4 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Hochwasserschutz (1×1), Wasserseite hinten
registerArch('flood_barrier', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'grass', { curb: false });
    // Deich mit Schutzmauer
    const dz = -2.6 * M, dh = 2.4 * M;
    k.prism('grass', [[-4.6 * M, 0], [4.6 * M, 0], [1.0 * M, dh], [-1.0 * M, dh]], W - 0.3 * M, { x: 0, y: 0, z: dz, ry: Math.PI / 2 });
    k.box('concrete', 0, dh - 0.3 * M, dz, W - 0.3 * M, 1.5 * M, 0.5 * M);
    if (P.D1(k)) k.box('concrete_dark', 0, dh + 1.2 * M, dz, W - 0.3 * M, 0.15 * M, 0.7 * M);
    // Mobile Dammbalken im Durchlass
    const ox = v ? -2.4 * M : 2.0 * M;
    if (P.D1(k)) {
      for (const s of [-1, 1]) k.box('metal_light', ox + s * 1.4 * M, dh - 0.3 * M, dz + 0.4 * M, 0.25 * M, 1.8 * M, 0.25 * M);
      for (let i = 0; i < 4; i++) k.box('metal_light', ox, dh - 0.25 * M + i * 0.36 * M, dz + 0.4 * M, 2.6 * M, 0.32 * M, 0.14 * M);
      for (let i = 0; i < 5; i++) k.box('metal_light', -ox * 0.5 + 0.2 * M, 0.2 * M + i * 0.2 * M, 2.4 * M, 3.0 * M, 0.16 * M, 0.3 * M);
      k.box('metal_dark', -ox * 0.5 + 0.2 * M, 0, 2.4 * M, 3.2 * M, 0.2 * M, 0.5 * M);
    }
    // Siel mit Schütz und Handrad
    const sx = v ? 2.6 * M : -2.6 * M;
    k.box('concrete', sx, 0, dz, 2.4 * M, dh + 1.6 * M, 2.0 * M);
    k.box('metal_dark', sx, dh - 0.6 * M, dz - 1.02 * M, 1.6 * M, 1.6 * M, 0.1 * M);
    if (P.D1(k)) { k.box('metal_dark', sx, dh + 1.6 * M, dz, 0.15 * M, 1.2 * M, 0.15 * M); P.torus(k, 'paint_red', sx, dh + 2.8 * M, dz + 0.1 * M, 0.45 * M, 0.06 * M, { rx: 0, seg: 12 }); }
    // Pumpe mit Rohren über den Deich
    k.box('metal_panel_grey', 0.4 * M, 0, 1.2 * M, 2.2 * M, 2.0 * M, 1.8 * M);
    for (const off of [-0.5, 0.5]) P.pipeline(k, 'pipe_metal', [[0.4 * M + off * M, 1.6 * M, 0.3 * M], [0.4 * M + off * M, dh + 1.8 * M, dz + 0.6 * M], [0.4 * M + off * M, dh + 1.8 * M, dz - 0.8 * M], [0.4 * M + off * M, 0.2 * M, -4.6 * M]], 0.22 * M);
    // Pegellatte
    if (P.D1(k)) for (let i = 0; i < 6; i++) k.box(i % 2 ? 'paint_white' : 'paint_red', 4.2 * M, i * 0.6 * M, -4.6 * M, 0.25 * M, 0.6 * M, 0.12 * M);
    sandbagsRow(k, -3.4 * M, 3.4 * M);
    P.signBox(k, 'HOCHWASSERSCHUTZ', 0.4 * M, 2.9 * M, 2.12 * M, 0, { px: 0.05 * M, bg: 'paint_blue' });
    return P.finish(k);
  },
});
function sandbagsRow(k, x, z) { sandbags(k, x, z, 5, 3, 0.2); }
void pick;
