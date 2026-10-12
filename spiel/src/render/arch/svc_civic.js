// Öffentliche Dienste: Polizei, Präsidium, Feuerwache, Feuerwehrzentrale, Arztpraxis, Krankenhaus, Rathaus,
// Seniorenheim, Friedhof, Krematorium, Gefängnis. Besitzer: G5. Front (Straße) nach +z.
import { registerArch } from './index.js';
import * as P from './svc_parts.js';

const { M, FLOOR, pick } = P;
const dims = (ctx) => [ctx.fw * 10 * M, ctx.fd * 10 * M];

// Funkmast auf dem Dach
function antenna(k, x, y0, z, h = 6 * M) {
  if (!P.D1(k)) return;
  k.cyl('metal_light', x, y0, z, 0.1 * M, h, { seg: 5 });
  if (!P.D2(k)) return;
  for (const t of [0.55, 0.8]) k.box('metal_light', x, y0 + h * t, z, 1.4 * M, 0.06 * M, 0.06 * M);
  k.cyl('paint_white', x + 0.5 * M, y0 + h * 0.6, z, 0.35 * M, 0.25 * M, { seg: 8, rx: Math.PI / 2 });
  k.light(x, y0 + h + 0.1 * M, z, 0xff3a2a, 0.2);
}
// Hallentore-Reihe (Feuerwehr): n Tore auf der Front einer Box
function bayDoors(k, cx, cz, sx, sz, n, w, h, o = {}) {
  for (let i = 0; i < n; i++) {
    const x = cx - sx / 2 + (sx / n) * (i + 0.5);
    P.rollerDoor(k, x, cz + sz / 2, 0, w, h, { mat: o.mat || 'metal_panel_white', frame: o.frame || 'paint_red', glassRow: true, ribs: 4 });
  }
}
// Ausfahrt mit Markierung vor den Toren
function apron(k, cx, z0, z1, sx, n) {
  P.slab(k, 'concrete', cx, (z0 + z1) / 2, sx, z1 - z0);
  if (!P.D1(k)) return;
  for (let i = 0; i <= n; i++) { const x = cx - sx / 2 + (sx / n) * i; P.line(k, x, z0 + 0.3 * M, x, z1 - 0.3 * M, 0.15 * M, 'paint_yellow'); }
  P.line(k, cx - sx / 2 + 0.3 * M, z1 - 0.5 * M, cx + sx / 2 - 0.3 * M, z1 - 0.5 * M, 0.25 * M, 'paint_red');
}
// Schlauchturm
function hoseTower(k, x, z, s, h, wall, o = {}) {
  k.box(wall, x, 0, z, s, h, s);
  if (P.D1(k)) {
    k.band(o.trim || 'trim_stone', x, z, s, s, h - 0.4 * M, 0.4 * M, 0.1 * M);
    for (const sd of ['front', 'right', 'left']) { const [wx, wz, ry] = P.onSide(sd, x, z, s, s, 0, 0); P.gridWindow(k, wx, h - 2.6 * M, wz, ry, s * 0.5, 1.8 * M, 1, 4, { frame: 'trim_dark', glass: 'glass_window' }); }
    for (let i = 1; i < 4; i++) { const [wx, wz, ry] = P.onSide('front', x, z, s, s, 0, 0); k.window(wx, i * 2.6 * M, wz, ry, 0.6 * M, 1.0 * M, { frame: 'window_frame_white' }); }
  }
  if (o.roof === 'hip') k.hipRoof(o.roofMat || 'roof_tiles_red', x, h, z, s, s, s * 0.7, { overhang: 0.25 * M, ridgeK: 1 });
  else k.flatRoof('roof_flat_membrane', o.trim || 'trim_stone', x, h, z, s, s, { parapet: 0.3 * M });
  if (P.D2(k) && o.siren !== false) { k.cyl('metal_dark', x, h + (o.roof === 'hip' ? s * 0.7 : 0.3 * M), z, 0.06 * M, 1.2 * M, { seg: 5 }); k.cyl('metal_light', x, h + (o.roof === 'hip' ? s * 0.7 : 0.3 * M) + 1.2 * M, z, 0.4 * M, 0.5 * M, { seg: 8 }); }
}

// ---------------------------------------------------------------- Polizeiwache (1×1)
registerArch('police', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'pavers');
    P.slab(k, 'asphalt', 3.0 * M, 2.8 * M, 3.6 * M, 4.2 * M);
    const bx = -1.5 * M, bz = -1.0 * M, bw = 6.4 * M, bd = 6.4 * M;
    if (v === 0) {
      const top = P.block(k, { x: bx, z: bz, w: bw, d: bd, floors: 2, wall: 'plaster_white', win: { frame: 'window_frame_dark', spacing: 2.2 * M, winW: 1.3 * M }, cornice: 'trim_dark', roof: 'flat', skipGround: 'front', clutter: 1 });
      if (P.D1(k)) k.band('paint_blue', bx, bz, bw, bd, FLOOR - 0.25 * M, 0.5 * M, 0.04 * M);
      P.ribbon(k, 'front', bx + 1.1 * M, bz, 3.8 * M, bd, 0.5 * M, 1.9 * M, { margin: 0.2 * M });
      P.door(k, bx - 2.0 * M, bz + bd / 2, 0, { glass: true, w: 1.5 * M, canopy: 'paint_blue' });
      P.signBox(k, 'POLIZEI', bx, 5.3 * M, bz + bd / 2, 0, { px: 0.17 * M, bg: 'paint_blue' });
      antenna(k, bx - 2 * M, top, bz - 2 * M, 7 * M);
    } else {
      const top = P.block(k, { x: bx, z: bz, w: bw, d: bd, floors: 2, wall: 'stone_sandstone', plinth: 'stone_dark', win: { frame: 'window_frame_white', sill: true, spacing: 2.1 * M, winW: 1.1 * M, winH: 1.7 * M }, cornice: 'trim_stone', roof: 'hip', roofMat: 'roof_slate', roofH: 2.6 * M, skipGround: 'front' });
      P.door(k, bx, bz + bd / 2, 0, { w: 1.4 * M, h: 2.6 * M, mat: 'wood_dark', frame: 'trim_stone' });
      P.steps(k, bx, bz + bd / 2, 2.4 * M, 2);
      for (const s of [-1, 1]) k.window(bx + s * 2 * M, 0.9 * M, bz + bd / 2 + 0.03 * M, 0, 1.1 * M, 1.6 * M, { frame: 'window_frame_white', sill: true });
      P.signBox(k, 'POLIZEI', bx, 3.35 * M, bz + bd / 2, 0, { px: 0.13 * M, bg: 'paint_blue' });
      antenna(k, bx + 1.6 * M, top + 1.2 * M, bz - 0.8 * M, 5 * M);
    }
    if (P.D1(k)) { k.box('trim_dark', bx - 3.0 * M, 0, bz + bd / 2 + 0.6 * M, 0.12 * M, 2.2 * M, 0.12 * M); k.box('emissive_cool', bx - 3.0 * M, 2.2 * M, bz + bd / 2 + 0.6 * M, 0.5 * M, 0.45 * M, 0.5 * M); k.light(bx - 3 * M, 2.5 * M, bz + bd / 2 + 0.6 * M, 0x6fa8ff, 0.35); }
    // Garage mit Rolltor
    k.box('plaster_grey', 3.2 * M, 0, -2.6 * M, 3.4 * M, 3.4 * M, 4.4 * M);
    k.flatRoof('roof_flat_membrane', 'paint_blue', 3.2 * M, 3.4 * M, -2.6 * M, 3.4 * M, 4.4 * M, { parapet: 0.3 * M });
    P.rollerDoor(k, 3.2 * M, -0.4 * M, 0, 2.6 * M, 2.6 * M, { mat: 'metal_panel_grey' });
    P.policeCar(k, 3.3 * M, 2.6 * M, Math.PI);
    if (v === 0) P.policeCar(k, -3.6 * M, 3.7 * M, Math.PI / 2 + 0.05);
    P.bikeRack(k, -0.4 * M, 4.2 * M, 0, 3);
    P.lamp(k, 1.4 * M, 4.4 * M, 3.8 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Polizeipräsidium (2×2)
registerArch('policehq', {
  variants: 1,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx);
    P.lot(k, W, D, 'pavers');
    P.slab(k, 'asphalt', 0, -5.6 * M, W - 0.6 * M, 8 * M);
    // Hauptbau (vorne) mit Mittelrisalit
    const bx = 0, bz = 3.2 * M, bw = 18 * M, bd = 6.4 * M, fl = 5;
    const top = P.block(k, { x: bx, z: bz, w: bw, d: bd, floors: fl, wall: 'stone_sandstone', plinth: 'stone_dark', plinthH: 1.0 * M, win: { frame: 'window_frame_white', spacing: 2.2 * M, winW: 1.1 * M, winH: 1.7 * M, sill: true }, cornice: 'trim_stone', roof: 'flat', roofMat: 'roof_flat_gravel', skipGround: 'front' });
    if (P.D1(k)) k.band('trim_stone', bx, bz, bw, bd, FLOOR * 1 - 0.15 * M, 0.3 * M, 0.08 * M);
    k.box('stone_sandstone', bx, 0, bz + bd / 2 + 0.5 * M, 6 * M, top + 1.2 * M, 1.2 * M);
    if (P.D1(k)) {
      P.columns(k, bx - 2.2 * M, bx + 2.2 * M, bz + bd / 2 + 1.4 * M, 1.0 * M, 4.6 * M, 4, 0.3 * M);
      k.box('trim_stone', bx, 5.6 * M, bz + bd / 2 + 1.2 * M, 6.2 * M, 0.6 * M, 1.6 * M);
      for (let f = 2; f < fl; f++) for (const s of [-1.6, 0, 1.6]) k.window(bx + s * M, f * FLOOR + 0.6 * M, bz + bd / 2 + 1.13 * M, 0, 1.1 * M, 1.8 * M, { frame: 'window_frame_white' });
    }
    k.box('trim_stone', bx, top + 1.2 * M, bz + bd / 2 + 0.5 * M, 6.3 * M, 0.3 * M, 1.4 * M);
    P.text(k, 'POLIZEIPRAESIDIUM', bx, top + 0.45 * M, bz + bd / 2 + 1.13 * M, 0, 0.11 * M, 'trim_dark');
    P.door(k, bx, bz + bd / 2 + 1.1 * M, 0, { w: 2.2 * M, h: 3.0 * M, glass: true, y0: 1.0 * M });
    P.steps(k, bx, bz + bd / 2 + 1.1 * M, 5 * M, 6);
    for (const s of [-6, -4.5, 4.5, 6]) P.flagpole(k, s * M, 9.5 * M, 9 * M, s < 0 ? 'paint_blue' : 'paint_white');
    // Seitenflügel (hinten) und Hubschrauberlandeplatz
    for (const s of [-1, 1]) P.block(k, { x: s * 7 * M, z: -4.2 * M, w: 4 * M, d: 8.4 * M, floors: 4, wall: 'plaster_grey', win: { frame: 'window_frame_dark', spacing: 2.2 * M }, cornice: 'trim_stone', roof: 'flat', sides: [s < 0 ? 'right' : 'left', s < 0 ? 'left' : 'right', 'back'] });
    P.helipad(k, 7 * M, 4 * FLOOR + 0.1 * M, -4.2 * M, 1.9 * M);
    antenna(k, -7 * M, 4 * FLOOR, -5.6 * M, 9 * M);
    k.rooftopClutter(bx, top, bz, bw * 0.7, bd * 0.6, 3);
    // Hof: Einsatzwagen
    for (let i = 0; i < 3; i++) P.van(k, -2.6 * M + i * 2.6 * M, -6 * M, 0, 'paint_white', { stripe: 'paint_blue', lights: 'emissive_cool' });
    P.policeCar(k, -2.4 * M, -1.2 * M, Math.PI / 2); P.policeCar(k, 2.6 * M, -1.0 * M, -Math.PI / 2);
    for (const x of [-8, -3, 3, 8]) P.tree(k, x * M, 8.6 * M, 0.7);
    P.bollards(k, -4 * M, 9.4 * M, 4 * M, 9.4 * M, 7);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Feuerwache (1×1)
registerArch('fire', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'concrete');
    const wall = v ? 'plaster_white' : 'brick_red';
    const hx = -1.0 * M, hz = -1.4 * M, hw = 7.6 * M, hd = 6.6 * M, hh = 5.2 * M;
    apron(k, hx, hz + hd / 2, D / 2 - 0.2 * M, hw, 2);
    k.box(wall, hx, 0, hz, hw, hh, hd);
    k.box('stone_grey', hx, 0, hz, hw + 0.12 * M, 0.4 * M, hd + 0.12 * M);
    bayDoors(k, hx, hz, hw, hd, 2, 3.2 * M, 3.8 * M, { frame: v ? 'paint_red' : 'trim_stone' });
    if (P.D1(k)) { k.band(v ? 'paint_red' : 'trim_stone', hx, hz, hw, hd, hh - 0.6 * M, 0.6 * M, 0.06 * M); P.signBox(k, 'FEUERWEHR', hx, hh - 0.0 * M, hz + hd / 2 + 0.05 * M, 0, { px: 0.15 * M, bg: 'paint_red', frame: 'trim_dark' }); }
    k.windows('left', hx, hz, hw, hd, 0, 1, FLOOR * 1.4, { frame: 'window_frame_white', spacing: 2.4 * M, winH: 1.2 * M });
    k.flatRoof('roof_flat_membrane', v ? 'paint_red' : 'trim_stone', hx, hh, hz, hw, hd, { parapet: 0.4 * M });
    // Sozialtrakt mit Schlauchturm
    P.block(k, { x: 3.9 * M, z: -0.6 * M, w: 2.2 * M, d: 8.2 * M, floors: 2, wall, win: { frame: 'window_frame_white', spacing: 2.0 * M, winW: 1.0 * M }, cornice: 'trim_stone', roof: 'flat', sides: ['right', 'front'] });
    P.door(k, 3.9 * M, 3.5 * M, 0, { w: 1.1 * M, glass: true });
    hoseTower(k, 3.6 * M, -3.6 * M, 2.4 * M, 13 * M, wall, { roof: v ? 'flat' : 'hip' });
    P.text(k, '112', 3.6 * M, 9.6 * M, -3.6 * M + 1.24 * M, 0, 0.2 * M, 'paint_white');
    P.fireTruck(k, hx - 1.9 * M, 2.4 * M, 0, { len: 7.6 * M });
    if (P.D1(k)) k.box('emissive_red', hx, hh + 0.4 * M, hz + hd / 2 - 0.3 * M, 0.5 * M, 0.3 * M, 0.3 * M);
    P.lamp(k, 4.4 * M, 4.4 * M, 4 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Feuerwehrzentrale (2×2)
registerArch('firehq', {
  variants: 1,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx);
    P.lot(k, W, D, 'concrete');
    const hx = -2 * M, hz = -1.6 * M, hw = 15 * M, hd = 8 * M, hh = 6 * M;
    apron(k, hx, hz + hd / 2, D / 2 - 0.2 * M, hw, 4);
    k.box('brick_red', hx, 0, hz, hw, hh, hd);
    k.box('stone_grey', hx, 0, hz, hw + 0.12 * M, 0.4 * M, hd + 0.12 * M);
    bayDoors(k, hx, hz, hw, hd, 4, 3.0 * M, 4.2 * M, { frame: 'trim_stone' });
    // Obergeschoss (zurückgesetzt) mit Fensterband
    k.box('plaster_white', hx, hh, hz - 1 * M, hw, 3.2 * M, hd - 2 * M);
    P.ribbon(k, 'front', hx, hz - 1 * M, hw, hd - 2 * M, hh + 0.8 * M, 1.6 * M);
    P.ribbon(k, 'right', hx, hz - 1 * M, hw, hd - 2 * M, hh + 0.8 * M, 1.6 * M);
    k.flatRoof('roof_flat_gravel', 'paint_red', hx, hh + 3.2 * M, hz - 1 * M, hw, hd - 2 * M, { parapet: 0.4 * M });
    k.flatRoof('roof_flat_membrane', 'trim_stone', hx, hh, hz, hw, hd, { parapet: 0.3 * M });
    P.signBox(k, 'FEUERWEHR', hx, hh + 0.05 * M, hz + hd / 2 + 0.06 * M, 0, { px: 0.2 * M, bg: 'paint_red' });
    k.rooftopClutter(hx, hh + 3.2 * M, hz - 1 * M, hw * 0.6, 3 * M, 3);
    // Übungsturm
    const tx = 8 * M, tz = -5 * M;
    k.box('concrete', tx, 0, tz, 3.4 * M, 16 * M, 3.4 * M);
    for (let f = 1; f < 5; f++) {
      k.box('concrete', tx, f * 3.2 * M, tz + 2.2 * M, 3.4 * M, 0.2 * M, 1.0 * M);
      if (P.D1(k)) { P.railing(k, tx - 1.7 * M, tz + 2.65 * M, tx + 1.7 * M, tz + 2.65 * M, f * 3.2 * M + 0.2 * M); k.window(tx, f * 3.2 * M + 0.4 * M, tz + 1.73 * M, 0, 1.0 * M, 1.8 * M, { frame: 'window_frame_dark' }); }
    }
    k.flatRoof('roof_flat_membrane', 'paint_red', tx, 16 * M, tz, 3.4 * M, 3.4 * M, { parapet: 0.6 * M });
    P.text(k, '112', tx, 13.6 * M, tz + 1.72 * M, 0, 0.28 * M, 'paint_red');
    // Fahrzeuge
    P.fireTruck(k, hx - 5.6 * M, 5.6 * M, 0, { len: 8 * M });
    P.fireTruck(k, hx + 1.9 * M, 5.2 * M, 0, { len: 9 * M });
    P.van(k, 7.6 * M, 6.4 * M, Math.PI / 2, 'paint_red', { lights: 'emissive_cool' });
    P.fireTruck(k, 7.5 * M, 1.4 * M, Math.PI / 2 + Math.PI, { len: 7 * M, ladder: false });
    P.lamp(k, 5.6 * M, 8.8 * M, 5 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Arztpraxis (1×1)
registerArch('clinic', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'grass', { curb: false });
    P.slab(k, 'pavers', -0.6 * M, 3.4 * M, 6.4 * M, 3 * M);
    P.parking(k, 3.0 * M, 3.2 * M, 4 * M, 3.4 * M, { rows: 1, fill: 0.7 });
    const bx = -0.8 * M, bz = -1.4 * M, bw = 7.4 * M, bd = 5.6 * M;
    if (v === 0) {
      P.block(k, { x: bx, z: bz, w: bw, d: bd, floors: 2, wall: 'plaster_white', win: { frame: 'window_frame_dark', spacing: 2.2 * M }, cornice: 'trim_dark', roof: 'flat', skipGround: 'front' });
      k.box('wood_planks', bx + 2.0 * M, 0.3 * M, bz + bd / 2 + 0.05 * M, 3.2 * M, 5.6 * M, 0.12 * M);
      P.ribbon(k, 'front', bx - 1.6 * M, bz, 4 * M, bd, 0.6 * M, 1.8 * M, { margin: 0.1 * M });
    } else {
      P.block(k, { x: bx, z: bz, w: bw, d: bd, floors: 2, wall: 'plaster_cream', win: { frame: 'window_frame_white', spacing: 2.3 * M, sill: true }, roof: 'gable', roofMat: 'roof_tiles_red', roofH: 2.6 * M, ridge: 'x', skipGround: 'front' });
      P.ribbon(k, 'front', bx - 1.6 * M, bz, 4 * M, bd, 0.6 * M, 1.8 * M, { margin: 0.1 * M, frame: 'window_frame_white' });
    }
    P.door(k, bx + 2.0 * M, bz + bd / 2 + 0.12 * M, 0, { glass: true, w: 1.3 * M, canopy: 'metal_dark' });
    P.signBox(k, 'PRAXIS', bx - 1.6 * M, 3.0 * M, bz + bd / 2, 0, { px: 0.13 * M, bg: 'paint_white', fg: 'trim_dark', frame: 'metal_dark' });
    if (P.D1(k)) { P.cross(k, bx + 2.0 * M, 3.75 * M, bz + bd / 2 + 0.18 * M, 0.8 * M, 'emissive_green', 0, { plate: 'paint_white' }); k.light(bx + 2 * M, 3.6 * M, bz + bd / 2 + 0.5 * M, 0x60ff90, 0.25); }
    // Rampe
    if (P.D1(k)) { k.box('concrete', bx - 1.6 * M, 0, bz + bd / 2 + 0.9 * M, 3.2 * M, 0.2 * M, 1.8 * M); P.railing(k, bx - 3.2 * M, bz + bd / 2 + 1.8 * M, bx, bz + bd / 2 + 1.8 * M, 0.2 * M); }
    P.tree(k, -4 * M, -3.8 * M, 0.7); P.bush(k, 4 * M, -3 * M, 1.2); P.bush(k, -4.2 * M, 1.6 * M, 1);
    P.bench(k, -3.6 * M, 4.2 * M, Math.PI);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Krankenhaus (2×2)
registerArch('hospital', {
  variants: 1,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx);
    P.lot(k, W, D, 'pavers');
    P.slab(k, 'grass', -6.6 * M, 7.6 * M, 6.4 * M, 4.2 * M);
    // Bettenhaus (hoch)
    const tx = -2.4 * M, tz = -4.2 * M, tw = 14 * M, td = 7 * M, fl = 6;
    const top = P.block(k, { x: tx, z: tz, w: tw, d: td, floors: fl, fh: 3.2 * M, y0: 0, wall: 'plaster_white', plinth: 'concrete_dark', win: false, roof: 'flat', roofMat: 'roof_flat_gravel', parapet: 'metal_panel_white' });
    for (let f = 2; f < fl; f++) for (const sd of ['front', 'back', 'left', 'right']) P.ribbon(k, sd, tx, tz, tw, td, f * 3.2 * M + 0.9 * M, 1.5 * M, { margin: 0.5 * M, frame: 'window_frame_white' });
    if (P.D1(k)) for (let f = 2; f <= fl; f++) k.band('paint_white', tx, tz, tw, td, f * 3.2 * M - 0.2 * M, 0.3 * M, 0.1 * M);
    if (P.D1(k)) { P.cross(k, tx + tw / 2 - 2.5 * M, top - 0.4 * M, tz + td / 2 + 0.06 * M, 2.4 * M, 'emissive_red', 0, { plate: 'paint_white' }); k.light(tx + tw / 2 - 2.5 * M, top - 1.6 * M, tz + td / 2 + 0.6 * M, 0xff5040, 0.5); }
    P.helipad(k, tx - 3 * M, top, tz, 3.1 * M);
    k.rooftopClutter(tx + 3.5 * M, top, tz, 5 * M, 4 * M, 3);
    // Flachbau (2 Geschosse) mit Haupteingang und Notaufnahme
    const px = 0, pz = 3.2 * M, pw = 19 * M, pd = 7.6 * M;
    k.box('plaster_white', px, 0, pz, pw, 6.4 * M, pd);
    k.box('concrete_dark', px, 0, pz, pw + 0.12 * M, 0.5 * M, pd + 0.12 * M);
    P.ribbon(k, 'front', px, pz, pw, pd, 3.9 * M, 1.6 * M, { frame: 'window_frame_white' });
    P.ribbon(k, 'left', px, pz, pw, pd, 3.9 * M, 1.6 * M, { frame: 'window_frame_white' });
    P.ribbon(k, 'right', px, pz, pw, pd, 3.9 * M, 1.6 * M, { frame: 'window_frame_white' });
    k.curtainWall('front', px - 3 * M, pz, 6 * M, pd, 0.4 * M, 3 * M, { glass: 'glass_curtain_blue', fh: 3 * M });
    k.flatRoof('roof_flat_gravel', 'metal_panel_white', px, 6.4 * M, pz, pw, pd, { parapet: 0.5 * M });
    if (P.D1(k)) k.band('paint_blue', px, pz, pw, pd, 3.3 * M, 0.35 * M, 0.06 * M);
    P.signBox(k, 'KLINIKUM', px - 3 * M, 3.75 * M, pz + pd / 2 + 0.06 * M, 0, { px: 0.17 * M, bg: 'paint_blue' });
    P.canopy(k, px - 3 * M, 3.2 * M, pz + pd / 2 + 1.4 * M, 5 * M, 2.8 * M, { mat: 'metal_panel_white' });
    // Notaufnahme rechts mit Vordach und Rettungswagen
    P.canopy(k, 6.4 * M, 3.4 * M, pz + pd / 2 + 2.0 * M, 6 * M, 4 * M, { mat: 'paint_red' });
    P.signBox(k, 'NOTAUFNAHME', 6.4 * M, 4.25 * M, pz + pd / 2 + 4.05 * M, 0, { px: 0.1 * M, bg: 'paint_red', d: 0.06 * M });
    P.door(k, 6.4 * M, pz + pd / 2, 0, { glass: true, w: 2.4 * M });
    P.ambulance(k, 5.0 * M, pz + pd / 2 + 2.4 * M, Math.PI);
    P.ambulance(k, 7.9 * M, pz + pd / 2 + 2.4 * M, Math.PI + 0.05);
    P.slab(k, 'asphalt', 6.4 * M, 8.2 * M, 6.4 * M, 3.2 * M);
    for (const x of [-9, -6.5, -4]) P.tree(k, x * M, 8.4 * M, 0.65);
    P.bench(k, -6.6 * M, 6.4 * M, 0); P.lamp(k, -1.4 * M, 9 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Rathaus (2×2)
registerArch('townhall', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'pavers');
    const wall = v ? 'brick_red' : 'stone_sandstone', trim = v ? 'trim_stone' : 'trim_stone';
    // Hauptbau
    const bx = 0, bz = -2.4 * M, bw = 17 * M, bd = 8.4 * M, fl = 3, fh = 3.6 * M;
    const top = P.block(k, { x: bx, z: bz, w: bw, d: bd, floors: fl, fh, wall, plinth: 'stone_dark', plinthH: 0.9 * M, win: { frame: 'window_frame_white', sill: true, spacing: 2.4 * M, winW: 1.2 * M, winH: 2.0 * M }, cornice: trim, bands: trim, roof: 'gable', roofMat: v ? 'roof_slate' : 'roof_tiles_red', roofH: 4.4 * M, ridge: 'x', skipGround: 'front' });
    // Laubengang (Arkaden) im Erdgeschoss
    if (P.D1(k)) {
      for (let i = 0; i < 6; i++) {
        const x = bx - 6.25 * M + i * 2.5 * M;
        if (Math.abs(x - bx) < 1.5 * M) continue;
        P.gridWindow(k, x, 0.4 * M, bz + bd / 2 + 0.02 * M, 0, 1.6 * M, 2.0 * M, 2, 3, { arch: true, archMat: trim, frame: 'window_frame_white' });
      }
    }
    // Dachgauben
    if (P.D2(k)) for (let i = 0; i < 4; i++) { const x = bx - 6 * M + i * 4 * M; k.box(wall, x, top + 0.4 * M, bz + bd / 2 - 1.3 * M, 1.4 * M, 1.4 * M, 1.2 * M); k.gableRoof(v ? 'roof_slate' : 'roof_tiles_red', x, top + 1.8 * M, bz + bd / 2 - 1.3 * M, 1.4 * M, 1.2 * M, 0.7 * M, { ridge: 'z', overhang: 0.15 * M }); k.window(x, top + 0.6 * M, bz + bd / 2 - 0.68 * M, 0, 0.8 * M, 0.9 * M, { frame: 'window_frame_white' }); }
    // Turm mit Uhr und Kupferhelm vorne in der Mitte
    const tz = bz + bd / 2 - 0.4 * M, ts = 4 * M, th = 21 * M;
    k.box(wall, bx, 0, tz, ts, th, ts);
    k.box('stone_dark', bx, 0, tz, ts + 0.14 * M, 0.9 * M, ts + 0.14 * M);
    if (P.D1(k)) for (const y of [fh, fh * 2, fh * 3, th - 0.5 * M]) k.band(trim, bx, tz, ts, ts, y - 0.2 * M, 0.35 * M, 0.1 * M);
    P.door(k, bx, tz + ts / 2, 0, { w: 2 * M, h: 3.2 * M, mat: 'wood_dark', frame: trim });
    P.steps(k, bx, tz + ts / 2, 3.6 * M, 3);
    for (let f = 1; f < 3; f++) P.gridWindow(k, bx, f * fh + 0.6 * M, tz + ts / 2 + 0.02 * M, 0, 1.3 * M, 2.2 * M, 2, 3, { arch: true, archMat: trim, frame: 'window_frame_white' });
    for (const sd of ['front', 'left', 'right', 'back']) { const [x, z, ry] = P.onSide(sd, bx, tz, ts, ts, 0, 0.06 * M); P.clock(k, x, th - 2.4 * M, z, 1.1 * M, ry); }
    k.box(wall, bx, th, tz, ts - 0.6 * M, 3.2 * M, ts - 0.6 * M);
    if (P.D1(k)) for (const sd of ['front', 'left', 'right', 'back']) { const [x, z, ry] = P.onSide(sd, bx, tz, ts - 0.6 * M, ts - 0.6 * M, 0, 0); P.gridWindow(k, x, th + 0.6 * M, z, ry, 1.4 * M, 1.6 * M, 1, 2, { arch: true, frame: 'trim_dark', glass: 'glass_window' }); }
    k.hipRoof('roof_copper', bx, th + 3.2 * M, tz, ts - 0.6 * M, ts - 0.6 * M, 3 * M, { overhang: 0.3 * M, ridgeK: 1 });
    k.cyl('roof_copper', bx, th + 6 * M, tz, 0.7 * M, 1.4 * M, { seg: 8 });
    k.cone('roof_copper', bx, th + 7.4 * M, tz, 0.9 * M, 3.4 * M, { seg: 8 });
    if (P.D1(k)) { k.cyl('paint_yellow', bx, th + 10.8 * M, tz, 0.04 * M, 1.4 * M, { seg: 4 }); k.sphere('paint_yellow', bx, th + 11 * M, tz, 0.25 * M, { seg: 6 }); }
    P.text(k, 'RATHAUS', bx, fh * 3 - 0.6 * M, tz + ts / 2 + 0.06 * M, 0, 0.16 * M, 'trim_dark');
    // Platz mit Brunnen, Fahnen und Bäumen
    const fz = 6.6 * M;
    k.cyl('stone_grey', 5.8 * M, 0, fz, 2.2 * M, 0.6 * M, { seg: P.segs(k, 16) });
    k.cyl('water_pool', 5.8 * M, 0, fz, 1.9 * M, 0.62 * M, { seg: P.segs(k, 16) });
    k.cyl('stone_grey', 5.8 * M, 0.6 * M, fz, 0.35 * M, 1.6 * M, { seg: 8 });
    if (P.D1(k)) k.cyl('stone_grey', 5.8 * M, 2.2 * M, fz, 0.9 * M, 0.25 * M, { seg: 10 });
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) P.flagpole(k, s * (3 + i * 1.3) * M, 4.3 * M, 9 * M, ['paint_red', 'paint_yellow', 'paint_blue', 'paint_white'][i + (s > 0 ? 2 : 0)]);
    for (const x of [-8.4, -5.6, 8.4]) P.tree(k, x * M, 8.6 * M, 0.7);
    for (const x of [-7, 3]) P.bench(k, x * M, 7.4 * M, Math.PI);
    P.lamp(k, -3 * M, 8.4 * M, 4 * M, { globe: true }); P.lamp(k, 3 * M, 8.4 * M, 4 * M, { globe: true });
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Seniorenheim (2×1)
registerArch('elderly_care', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'grass', { curb: false });
    const bx = -1.6 * M, bz = -1.4 * M, bw = 15 * M, bd = 6.4 * M;
    const wall = v ? 'plaster_green' : 'plaster_cream';
    const top = P.block(k, { x: bx, z: bz, w: bw, d: bd, floors: 3, wall, win: { frame: 'window_frame_white', spacing: 2.5 * M, sill: true }, cornice: 'trim_stone', roof: 'hip', roofMat: v ? 'roof_tiles_anthracite' : 'roof_tiles_red', roofH: 2.8 * M, skipGround: 'front' });
    void top;
    k.balconies('front', bx, bz, bw, bd, 0, 3, FLOOR, { count: 4, w: 2.6 * M, d: 1.3 * M, rail: 'window_frame_white', slab: 'concrete' });
    for (let i = 0; i < 4; i++) k.window(bx - 5.6 * M + i * 3.73 * M + (i > 1 ? 0.6 * M : -0.6 * M), 0.5 * M, bz + bd / 2 + 0.03 * M, 0, 1.6 * M, 1.9 * M, { frame: 'window_frame_white' });
    P.door(k, bx, bz + bd / 2, 0, { glass: true, w: 1.8 * M, canopy: 'wood_planks' });
    P.signBox(k, 'SENIORENHEIM', bx, 3.0 * M, bz + bd / 2 + 0.02 * M, 0, { px: 0.1 * M, bg: 'paint_white', fg: 'wood_dark', frame: 'wood_dark' });
    if (P.D1(k)) { k.box('pavers', bx, 0, bz + bd / 2 + 1.5 * M, 3 * M, 0.15 * M, 3 * M); k.box('concrete', bx + 3.6 * M, 0, bz + bd / 2 + 0.7 * M, 4 * M, 0.25 * M, 1.4 * M); P.railing(k, bx + 1.6 * M, bz + bd / 2 + 1.4 * M, bx + 5.6 * M, bz + bd / 2 + 1.4 * M, 0.25 * M); }
    P.walk(k, 'pavers', [[bx, bz + bd / 2 + 3 * M], [bx, D / 2 - 0.1 * M]], 1.8 * M);
    // Garten mit Pergola und Bänken
    const gx = 7.6 * M;
    P.walk(k, 'gravel', [[bx + 2 * M, 3.4 * M], [4.6 * M, 3.4 * M], [gx, 1.0 * M], [gx, -3.6 * M]], 1.2 * M);
    if (P.D1(k)) {
      for (let i = 0; i < 3; i++) for (const s of [-1, 1]) k.box('wood_planks', gx + s * 0.9 * M, 0, -2.4 * M + i * 1.6 * M, 0.15 * M, 2.4 * M, 0.15 * M);
      for (let i = 0; i < 5; i++) k.box('wood_planks', gx, 2.4 * M, -3.0 * M + i * 0.8 * M, 2.2 * M, 0.12 * M, 0.12 * M);
      k.box('leaves_light', gx, 2.5 * M, -1 * M, 2.2 * M, 0.3 * M, 3 * M);
    }
    P.bench(k, gx - 0.4 * M, -1 * M, Math.PI / 2); P.bench(k, 5 * M, 4.1 * M, Math.PI);
    P.flowerBed(k, 3.4 * M, 1.4 * M, 2 * M, 1.2 * M);
    P.flowerBed(k, -8 * M, 3.4 * M, 2.4 * M, 1.4 * M);
    P.tree(k, -8.6 * M, -3.4 * M, 0.8, { leaf: 'leaves_light' }); P.tree(k, 8.6 * M, 3.6 * M, 0.7);
    P.hedgeLine(k, -W / 2 + 0.4 * M, D / 2 - 0.5 * M, bx - 1.2 * M, D / 2 - 0.5 * M, 0.9 * M, 0.6 * M);
    P.hedgeLine(k, bx + 1.2 * M, D / 2 - 0.5 * M, W / 2 - 0.4 * M, D / 2 - 0.5 * M, 0.9 * M, 0.6 * M);
    P.lamp(k, 2.6 * M, 4.2 * M, 3.5 * M, { globe: true });
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Friedhof (2×2) mit Kapelle
registerArch('cemetery', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'grass', { curb: false });
    // Mauer mit Tor
    const e = W / 2 - 0.4 * M, h = 1.8 * M, wm = v ? 'stone_sandstone' : 'brick_red';
    P.wall(k, -e, -e, e, -e, h, { mat: wm, piers: 4 * M });
    P.wall(k, -e, -e, -e, e, h, { mat: wm, piers: 4 * M });
    P.wall(k, e, -e, e, e, h, { mat: wm, piers: 4 * M });
    P.wall(k, -e, e, -1.8 * M, e, h, { mat: wm, piers: 4 * M });
    P.wall(k, 1.8 * M, e, e, e, h, { mat: wm, piers: 4 * M });
    for (const s of [-1, 1]) { k.box(wm, s * 2 * M, 0, e, 0.8 * M, 3.0 * M, 0.8 * M); if (P.D1(k)) k.box('trim_stone', s * 2 * M, 3.0 * M, e, 1.0 * M, 0.25 * M, 1.0 * M); }
    if (P.D2(k)) for (let i = 0; i < 9; i++) k.box('metal_dark', -1.6 * M + i * 0.4 * M, 0, e, 0.05 * M, 2.4 * M - Math.abs(i - 4) * 0.08 * M, 0.05 * M);
    // Wege
    P.walk(k, 'gravel', [[0, e], [0, -3.2 * M]], 2.0 * M);
    P.walk(k, 'gravel', [[-e + 0.6 * M, 1.4 * M], [e - 0.6 * M, 1.4 * M]], 1.4 * M);
    // Kapelle hinten
    const cx = 0, cz = -6.0 * M, cw = 6 * M, cd = 7 * M;
    k.box('plaster_white', cx, 0, cz, cw, 5 * M, cd);
    k.box('stone_grey', cx, 0, cz, cw + 0.12 * M, 0.6 * M, cd + 0.12 * M);
    k.gableRoof('roof_slate', cx, 5 * M, cz, cw, cd, 3.6 * M, { ridge: 'z', overhang: 0.35 * M });
    k.gableEnds('plaster_white', cx, 5 * M, cz, cw, cd, 3.6 * M, { ridge: 'z' });
    for (const sd of ['left', 'right']) P.gridRow(k, sd, cx, cz, cw, cd, 2, 1.3 * M, 1.0 * M, 2.4 * M, 1, 3, { arch: true, frame: 'trim_dark', glass: 'glass_window' });
    P.door(k, cx, cz + cd / 2, 0, { w: 1.6 * M, h: 2.8 * M, mat: 'wood_dark', frame: 'trim_stone' });
    if (P.D1(k)) P.gridWindow(k, cx, 5.4 * M, cz + cd / 2 + 0.02 * M, 0, 1.2 * M, 0.8 * M, 1, 1, { arch: true, frame: 'trim_dark' });
    // Dachreiter mit Glocke und Kreuz
    k.box('wood_dark', cx, 7.6 * M, cz + 2 * M, 1.2 * M, 2.4 * M, 1.2 * M);
    k.cone('roof_slate', cx, 10 * M, cz + 2 * M, 1.0 * M, 2.4 * M, { seg: 4, ry: Math.PI / 4 });
    if (P.D1(k)) { k.box('metal_dark', cx, 12.4 * M, cz + 2 * M, 0.1 * M, 1.2 * M, 0.1 * M); k.box('metal_dark', cx, 12.9 * M, cz + 2 * M, 0.6 * M, 0.1 * M, 0.1 * M); }
    // Gräberfelder
    const stones = ['stone_grey', 'marble', 'stone_dark', 'stone_grey', 'trim_stone'];
    const field = (x0, z0, cols, rows) => {
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = x0 + c * 1.5 * M, z = z0 + r * 2.4 * M;
        if (k.detail === 0) { if ((r + c) % 2 === 0) k.box('stone_grey', x, 0, z - 0.5 * M, 0.8 * M, 0.9 * M, 0.2 * M); continue; }
        k.box(pick(k.rng, ['hedge', 'dirt', 'leaves_dark', 'grass']), x, 0, z + 0.3 * M, 0.9 * M, 0.22 * M, 1.6 * M);
        const sh = (0.7 + k.rng() * 0.5) * M;
        k.box(pick(k.rng, stones), x, 0, z - 0.6 * M, (0.6 + k.rng() * 0.3) * M, sh, 0.16 * M);
        if (P.D2(k) && k.rng() < 0.35) k.box(pick(k.rng, ['paint_red', 'paint_yellow', 'paint_white']), x, 0.22 * M, z + 0.2 * M, 0.35 * M, 0.2 * M, 0.35 * M);
      }
    };
    field(-8.3 * M, -7.6 * M, 4, 3);
    field(3.8 * M, -7.6 * M, 4, 3);
    field(-8.3 * M, 3.2 * M, 4, 2);
    field(3.8 * M, 3.2 * M, 4, 2);
    // Bäume (Säulen und Nadelbäume), Hochkreuz, Bänke
    for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 5], [1.6, 5]]) P.poplar(k, x * M, z * M, 0.9);
    for (const [x, z] of [[-8.6, 0], [8.6, 0], [-8.4, 8.6], [8.4, 8.6]]) P.conifer(k, x * M, z * M, 0.75);
    P.tree(k, 6 * M, -1.4 * M, 0.8, { leaf: 'leaves_dark' }); P.tree(k, -6 * M, -1.4 * M, 0.9);
    if (P.D1(k)) { k.box('stone_grey', 0, 0, 1.4 * M, 1.2 * M, 0.4 * M, 1.2 * M); k.box('stone_grey', 0, 0.4 * M, 1.4 * M, 0.25 * M, 3.0 * M, 0.25 * M); k.box('stone_grey', 0, 2.5 * M, 1.4 * M, 1.4 * M, 0.25 * M, 0.25 * M); }
    P.bench(k, -3 * M, 2.4 * M, Math.PI); P.bench(k, 3 * M, 2.4 * M, Math.PI);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Krematorium (1×1)
registerArch('crematorium', {
  variants: 1,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx);
    P.lot(k, W, D, 'grass', { curb: false });
    P.slab(k, 'pavers', 0, 2.6 * M, 7.6 * M, 4.4 * M);
    const bx = -0.6 * M, bz = -1.6 * M, bw = 7.6 * M, bd = 5.4 * M, bh = 4.6 * M;
    k.box('stone_sandstone', bx, 0, bz, bw, bh, bd);
    k.box('stone_dark', bx, 0, bz, bw + 0.12 * M, 0.5 * M, bd + 0.12 * M);
    k.flatRoof('roof_flat_gravel', 'trim_stone', bx, bh, bz, bw, bd, { parapet: 0.5 * M });
    // Säulenhalle vorne
    k.box('trim_stone', bx, bh - 0.6 * M, bz + bd / 2 + 1.0 * M, bw, 0.6 * M, 2.0 * M);
    if (P.D1(k)) P.columns(k, bx - bw / 2 + 0.5 * M, bx + bw / 2 - 0.5 * M, bz + bd / 2 + 1.7 * M, 0, bh - 0.6 * M, 5, 0.22 * M, { seg: 8 });
    P.door(k, bx, bz + bd / 2, 0, { w: 1.8 * M, h: 2.8 * M, mat: 'wood_dark', frame: 'trim_stone' });
    if (P.D1(k)) for (const s of [-1, 1]) P.gridWindow(k, bx + s * 2.4 * M, 1.0 * M, bz + bd / 2 + 0.02 * M, 0, 0.6 * M, 2.6 * M, 1, 4, { frame: 'trim_dark' });
    P.text(k, 'KREMATORIUM', bx, bh - 0.3 * M, bz + bd / 2 + 2.02 * M, 0, 0.09 * M, 'trim_dark');
    // Schlanker Schornstein hinten
    P.stack(k, 2.6 * M, -3.6 * M, 14 * M, { r: 0.55 * M, rTop: 0.45 * M, mat: 'stone_sandstone', capMat: 'trim_dark', amount: 0.35, platform: false });
    // Zypressen
    for (const [x, z] of [[-4.2, -3.8], [-4.2, -1.4], [-4.2, 1.0], [4.2, 0.6], [4.2, 3.6], [-4.2, 3.6]]) P.poplar(k, x * M, z * M, 0.75);
    P.bench(k, 2.6 * M, 4.2 * M, Math.PI);
    P.hedgeLine(k, -2.6 * M, 4.5 * M, 1 * M, 4.5 * M, 0.6 * M, 0.5 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Gefängnis (3×2)
registerArch('prison', {
  variants: 1,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx);
    P.lot(k, W, D, 'concrete');
    const e = W / 2 - 0.5 * M, f = D / 2 - 0.5 * M, h = 5.2 * M;
    // Außenmauer mit Stacheldraht
    for (const [a, b] of [[[-e, -f], [e, -f]], [[-e, -f], [-e, f - 3.6 * M]], [[e, -f], [e, f - 3.6 * M]], [[-e, f - 3.6 * M], [-3.4 * M, f - 3.6 * M]], [[3.4 * M, f - 3.6 * M], [e, f - 3.6 * M]]]) {
      P.wall(k, a[0], a[1], b[0], b[1], h, { mat: 'concrete', t: 0.6 * M, cap: 'concrete_dark' });
      if (P.D1(k)) P.pipe(k, 'metal_light', [a[0], h + 0.4 * M, a[1]], [b[0], h + 0.4 * M, b[1]], 0.28 * M, { seg: 6 });
    }
    // Wachtürme
    for (const [x, z] of [[-e, -f], [e, -f], [-e, f - 3.6 * M], [e, f - 3.6 * M]]) {
      k.box('concrete', x, 0, z, 1.6 * M, 8.4 * M, 1.6 * M);
      k.box('concrete', x, 8.4 * M, z, 3 * M, 0.3 * M, 3 * M);
      k.box('glass_window', x, 8.7 * M, z, 2.6 * M, 1.5 * M, 2.6 * M, { lit: 0.95 });
      k.box('concrete_dark', x, 10.2 * M, z, 3.2 * M, 0.35 * M, 3.2 * M);
      if (P.D2(k)) { k.box('emissive_warm', x, 10.55 * M, z, 0.5 * M, 0.3 * M, 0.5 * M); k.light(x, 10.8 * M, z, 0xfff1cc, 0.6); }
    }
    // Zellentrakte
    for (const [x, z, w, d] of [[-4.6 * M, -3.2 * M, 16 * M, 5.2 * M], [8.2 * M, -1.0 * M, 5.2 * M, 11.6 * M]]) {
      k.box('plaster_grey', x, 0, z, w, 4 * FLOOR, d);
      k.box('concrete_dark', x, 0, z, w + 0.1 * M, 0.5 * M, d + 0.1 * M);
      for (const sd of ['front', 'back', 'left', 'right']) k.windows(sd, x, z, w, d, 0, 4, FLOOR, { winW: 0.5 * M, winH: 1.0 * M, spacing: 1.6 * M, frame: 'metal_dark', mullion: false, glass: 'glass_window' });
      if (P.D1(k)) for (let fl = 1; fl < 4; fl++) k.band('concrete', x, z, w, d, fl * FLOOR - 0.1 * M, 0.2 * M, 0.06 * M);
      k.flatRoof('roof_flat_gravel', 'concrete', x, 4 * FLOOR, z, w, d, { parapet: 0.4 * M });
      k.rooftopClutter(x, 4 * FLOOR, z, w * 0.6, d * 0.5, 2);
    }
    // Hof mit Sportplatz
    P.slab(k, 'asphalt', -4.4 * M, 3.2 * M, 12 * M, 5.4 * M);
    if (P.D1(k)) { P.line(k, -10.2 * M, 3.2 * M, 1.4 * M, 3.2 * M, 0.1 * M); P.line(k, -4.4 * M, 0.7 * M, -4.4 * M, 5.7 * M, 0.1 * M); for (const s of [-1, 1]) { k.box('metal_dark', -4.4 * M + s * 5.4 * M, 0, 3.2 * M, 0.12 * M, 3 * M, 0.12 * M); k.box('paint_white', -4.4 * M + s * 5.4 * M, 2.6 * M, 3.2 * M, 0.1 * M, 1 * M, 1.6 * M); } }
    P.fence(k, -10.6 * M, 6 * M, 1.8 * M, 6 * M, { h: 3 * M, wire: true });
    // Pforte mit Schleuse
    k.box('plaster_white', 0, 0, f - 1.6 * M, 6.4 * M, 4.2 * M, 4.4 * M);
    k.flatRoof('roof_flat_membrane', 'concrete_dark', 0, 4.2 * M, f - 1.6 * M, 6.4 * M, 4.4 * M, { parapet: 0.3 * M });
    P.rollerDoor(k, -1.2 * M, f + 0.6 * M, 0, 2.8 * M, 3.2 * M, { mat: 'metal_panel_grey' });
    P.door(k, 2 * M, f + 0.6 * M, 0, { glass: true });
    P.signBox(k, 'JVA', 1.6 * M, 3.8 * M, f + 0.62 * M, 0, { px: 0.16 * M, bg: 'trim_dark' });
    // Flutlichtmasten
    for (const [x, z] of [[-10 * M, 6.2 * M], [2.2 * M, -0.2 * M]]) { k.cyl('metal_dark', x, 0, z, 0.15 * M, 9 * M, { seg: 6 }); if (P.D1(k)) { k.box('emissive_cool', x, 9 * M, z, 1.2 * M, 0.5 * M, 0.4 * M); k.light(x, 9 * M, z, 0xdcefff, 0.7); } }
    P.parking(k, -10 * M, 8.3 * M, 8 * M, 2.8 * M, { rows: 1, fill: 0.7 });
    return P.finish(k);
  },
});
