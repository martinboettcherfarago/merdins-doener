// Zusätzliche Varianten für häufige Dienste und Freizeitanlagen. Jede neue Variante behält die Erkennungszeichen
// der Funktion (Farbe, Schild, Fahrzeuge, Symbol). Die vorhandenen Varianten bleiben unverändert; neue werden hinten
// angehängt (Sim-Variante modulo Anzahl). Front (Straße) nach +z, M = 1 Meter.
import { registerArch, ARCH } from './index.js';
import * as P from './svc_parts.js';

const { M, FLOOR } = P;
const dims = (ctx) => [ctx.fw * 10 * M, ctx.fd * 10 * M];

// Hängt Bausteine an einen registrierten Dienst an
function extend(key, extra) {
  const def = ARCH[key];
  if (!def) return;
  const n = Math.max(1, def.variants || 1);
  registerArch(key, { ...def, variants: n + extra.length, build: (ctx) => (ctx.variant < n ? def.build(ctx) : extra[ctx.variant - n](ctx)) });
}

// ---------------------------------------------------------------- Polizei: moderner Glaskubus mit blauem Band
function policeModern(ctx) {
  const k = ctx.kit, [W, D] = dims(ctx);
  P.lot(k, W, D, 'pavers');
  P.slab(k, 'asphalt', 2.9 * M, 2.4 * M, 3.8 * M, 5.0 * M);
  const bx = -1.6 * M, bz = -1.4 * M, bw = 6.2 * M, bd = 6.0 * M, h = 2 * FLOOR + 0.6 * M;
  k.box('metal_panel_white', bx, 0, bz, bw, h, bd);
  for (const s of ['front', 'left', 'back']) P.ribbon(k, s, bx, bz, bw, bd, 0.5 * M, 1.9 * M, { margin: 0.4 * M, glass: 'glass_curtain_blue' });
  for (const s of ['front', 'left']) P.ribbon(k, s, bx, bz, bw, bd, FLOOR + 0.6 * M, 1.7 * M, { margin: 0.4 * M });
  k.box('paint_blue', bx, h - 0.9 * M, bz, bw + 0.08 * M, 0.7 * M, bd + 0.08 * M);
  k.flatRoof('roof_flat_membrane', 'metal_panel_white', bx, h, bz, bw, bd, { parapet: 0.3 * M });
  P.door(k, bx + 1.4 * M, bz + bd / 2, 0, { glass: true, w: 1.6 * M, canopy: 'paint_blue' });
  P.signBox(k, 'POLIZEI', bx - 0.6 * M, h - 0.15 * M, bz + bd / 2 + 0.05 * M, 0, { px: 0.12 * M, bg: 'paint_blue', frame: 'paint_white' });
  if (P.D1(k)) {
    k.cyl('metal_light', bx - 2.2 * M, h, bz - 1.6 * M, 0.08 * M, 6 * M, { seg: 5 });
    k.light(bx - 2.2 * M, h + 6.1 * M, bz - 1.6 * M, 0xff3a2a, 0.2);
    k.box('trim_dark', bx - 3.4 * M, 0, bz + bd / 2 + 0.9 * M, 0.12 * M, 2.4 * M, 0.12 * M);
    k.box('emissive_cool', bx - 3.4 * M, 2.4 * M, bz + bd / 2 + 0.9 * M, 0.55 * M, 0.45 * M, 0.55 * M);
    k.light(bx - 3.4 * M, 2.6 * M, bz + bd / 2 + 0.9 * M, 0x6fa8ff, 0.35);
  }
  // Carport mit zwei Streifenwagen
  P.canopy(k, 2.9 * M, 2.6 * M, 1.0 * M, 3.8 * M, 5.6 * M, { mat: 'paint_blue', post: 'metal_dark' });
  P.policeCar(k, 2.0 * M, 1.4 * M, Math.PI);
  P.policeCar(k, 3.8 * M, 1.6 * M, Math.PI);
  P.bollards(k, -4.4 * M, 4.4 * M, 0.8 * M, 4.4 * M, 5);
  P.lamp(k, 0.8 * M, 4.0 * M, 4 * M);
  return P.finish(k);
}

// ---------------------------------------------------------------- Feuerwache: Stahl-Glas-Halle mit drei Toren, gläserner Turm
function fireModern(ctx) {
  const k = ctx.kit, [W, D] = dims(ctx);
  P.lot(k, W, D, 'concrete');
  const hx = -0.6 * M, hz = -1.2 * M, hw = 8.4 * M, hd = 6.4 * M, hh = 5.0 * M;
  P.slab(k, 'concrete', hx, (hz + hd / 2 + D / 2) / 2, hw, D / 2 - hz - hd / 2);
  if (P.D1(k)) for (let i = 0; i <= 3; i++) { const x = hx - hw / 2 + (hw / 3) * i; P.line(k, x, hz + hd / 2 + 0.3 * M, x, D / 2 - 0.3 * M, 0.15 * M, 'paint_yellow'); }
  k.box('metal_panel_grey', hx, 0, hz, hw, hh, hd);
  k.box('paint_red', hx, hh - 1.1 * M, hz, hw + 0.06 * M, 1.1 * M, hd + 0.06 * M);
  for (let i = 0; i < 3; i++) P.rollerDoor(k, hx - hw / 2 + (hw / 3) * (i + 0.5), hz + hd / 2, 0, 2.3 * M, 3.4 * M, { mat: i === 1 ? 'glass_window' : 'metal_panel_white', frame: 'paint_red', glassRow: true, ribs: 4, open: i === 0 });
  k.flatRoof('roof_flat_membrane', 'paint_red', hx, hh, hz, hw, hd, { parapet: 0.3 * M });
  if (P.D1(k)) P.signBox(k, 'FEUERWEHR', hx, hh - 0.2 * M, hz + hd / 2 + 0.06 * M, 0, { px: 0.12 * M, bg: 'paint_red', frame: 'paint_white' });
  // Schlauch- und Übungsturm aus Glas und Stahl
  const tx = 3.6 * M, tz = -3.6 * M, ts = 2.2 * M, th = 12 * M;
  k.box('metal_dark', tx, 0, tz, ts, th, ts);
  for (const s of ['front', 'right', 'left']) P.ribbon(k, s, tx, tz, ts, ts, 1.2 * M, th - 3.0 * M, { margin: 0.25 * M, glass: 'glass_window', pane: 0.9 * M });
  k.box('paint_red', tx, th, tz, ts + 0.2 * M, 1.0 * M, ts + 0.2 * M);
  P.text(k, '112', tx, th + 0.75 * M, tz + ts / 2 + 0.12 * M, 0, 0.17 * M, 'paint_white');
  if (P.D2(k)) { k.cyl('metal_light', tx, th + 1.0 * M, tz, 0.4 * M, 0.5 * M, { seg: 8 }); }
  k.light(tx, th + 1.6 * M, tz, 0xff3a2a, 0.22);
  P.fireTruck(k, hx - hw / 2 + hw / 6, 1.6 * M, 0, { len: 7.0 * M });
  P.ambulance(k, hx + hw / 2 - hw / 6, 2.8 * M, 0);
  P.lamp(k, 4.4 * M, 4.4 * M, 4 * M);
  return P.finish(k);
}

// ---------------------------------------------------------------- Arztpraxis: weißes Ärztehaus mit rotem Kreuz, Rampe, Krankenwagen
function clinicModern(ctx) {
  const k = ctx.kit, [W, D] = dims(ctx);
  P.lot(k, W, D, 'pavers');
  const bx = 0, bz = -1.8 * M, bw = W - 2.0 * M, bd = 5.6 * M;
  const top = P.block(k, { x: bx, z: bz, w: bw, d: bd, floors: 2, wall: 'plaster_white', plinth: 'stone_grey', win: { frame: 'window_frame_dark', spacing: 2.0 * M, winW: 1.4 * M }, roof: 'flat', parapet: 'paint_green', skipGround: 'front', clutter: 1 });
  P.ribbon(k, 'front', bx + 1.2 * M, bz, bw - 3.0 * M, bd, 0.45 * M, 1.9 * M, { margin: 0.2 * M });
  if (P.D1(k)) k.band('paint_green', bx, bz, bw, bd, FLOOR - 0.2 * M, 0.4 * M, 0.05 * M);
  P.door(k, bx - bw / 2 + 1.4 * M, bz + bd / 2, 0, { glass: true, w: 1.6 * M, canopy: 'paint_white' });
  P.cross(k, bx - bw / 2 + 1.4 * M, top + 1.4 * M, bz + bd / 2 + 0.1 * M, 1.4 * M, 'paint_red', 0, { plate: 'paint_white' });
  if (P.D1(k)) { k.box('metal_dark', bx - bw / 2 + 1.4 * M, top, bz + bd / 2 - 0.1 * M, 0.12 * M, 0.6 * M, 0.12 * M); }
  P.signBox(k, 'ARZT', bx + 1.2 * M, FLOOR + 0.2 * M, bz + bd / 2 + 0.05 * M, 0, { px: 0.11 * M, bg: 'paint_green' });
  // Rampe und Parkplatz
  P.slab(k, 'concrete', bx + bw / 2 - 1.5 * M, bz + bd / 2 + 0.9 * M, 2.6 * M, 1.6 * M, 0.25 * M);
  P.parking(k, 1.2 * M, 3.4 * M, W - 3.4 * M, 2.4 * M, { rows: 1, fill: 0.5 });
  P.ambulance(k, -3.6 * M, 3.0 * M, Math.PI / 2);
  P.tree(k, 4.0 * M, -4.2 * M, 0.7); P.tree(k, -4.0 * M, -4.2 * M, 0.65);
  return P.finish(k);
}

// ---------------------------------------------------------------- Schule: moderner Bau mit bunten Paneelen und Pausenhof
function schoolModern(ctx) {
  const k = ctx.kit, [W, D] = dims(ctx);
  P.lot(k, W, D, 'pavers');
  const bx = -W * 0.18, bz = -1.6 * M, bw = W * 0.58, bd = 6.2 * M, floors = 3;
  const top = P.block(k, { x: bx, z: bz, w: bw, d: bd, floors, wall: 'plaster_white', plinth: 'concrete_dark', win: { frame: 'window_frame_dark', spacing: 1.8 * M, winW: 1.3 * M, winH: 1.6 * M }, roof: 'flat', parapet: 'metal_panel_grey', skipGround: 'front' });
  // bunte Paneele zwischen den Fenstern (Front)
  if (P.D1(k)) {
    const cols = ['paint_yellow', 'paint_red', 'paint_teal', 'paint_green', 'paint_orange', 'paint_blue'];
    const n = Math.round(bw / (1.8 * M));
    for (let f = 1; f < floors; f++) for (let i = 0; i < n; i++) k.box(cols[(i + f * 2) % cols.length], bx - bw / 2 + (i + 0.5) * (bw / n) + 0.9 * M, f * FLOOR + 0.3 * M, bz + bd / 2 + 0.02 * M, 0.5 * M, FLOOR - 0.6 * M, 0.06 * M);
  }
  P.ribbon(k, 'front', bx, bz, bw, bd, 0.5 * M, 2.0 * M, { margin: 1.4 * M });
  P.door(k, bx + bw / 2 - 1.4 * M, bz + bd / 2, 0, { glass: true, w: 2.0 * M, canopy: 'paint_yellow' });
  P.signBox(k, 'SCHULE', bx - bw / 4, top - 0.4 * M, bz + bd / 2 + 0.05 * M, 0, { px: 0.13 * M, bg: 'paint_red' });
  P.clock(k, bx + bw / 4, top - 1.0 * M, bz + bd / 2 + 0.05 * M, 0.6 * M, 0);
  // Turnhalle mit Tonnendach
  const gx = W * 0.3, gz = -1.4 * M, gw = W * 0.34, gd = 6.6 * M;
  k.box('metal_panel_blue', gx, 0, gz, gw, 5.4 * M, gd);
  P.ribbon(k, 'front', gx, gz, gw, gd, 3.4 * M, 1.4 * M, { margin: 0.4 * M });
  P.ribbon(k, 'right', gx, gz, gw, gd, 3.4 * M, 1.4 * M, { margin: 0.4 * M });
  k.gableRoof('roof_metal_grey', gx, 5.4 * M, gz, gw, gd, 1.1 * M, { ridge: 'x', overhang: 0.3 * M });
  k.gableEnds('metal_panel_blue', gx, 5.4 * M, gz, gw, gd, 1.1 * M, { ridge: 'x' });
  // Pausenhof mit Spielfeld und Bäumen
  P.slab(k, 'rubber_track', bx, 3.3 * M, bw - 1 * M, 2.6 * M);
  if (P.D1(k)) { P.line(k, bx - bw / 2 + 1.0 * M, 3.3 * M, bx + bw / 2 - 1.0 * M, 3.3 * M, 0.08 * M, 'paint_white'); for (const s of [-1, 1]) k.box('metal_light', bx + s * (bw / 2 - 1.2 * M), 0, 3.3 * M, 0.08 * M, 2.2 * M, 0.08 * M); }
  for (const x of [gx - gw / 3, gx + gw / 3]) P.tree(k, x, 3.4 * M, 0.75);
  P.bikeRack(k, gx, 4.4 * M, 0, 6);
  P.flagpole(k, -W / 2 + 0.8 * M, 4.2 * M, 7 * M, 'paint_yellow');
  return P.finish(k);
}

// ---------------------------------------------------------------- Bibliothek: Glasbau mit „Bücherregal"-Fassade (farbige Lamellen)
function libraryModern(ctx) {
  const k = ctx.kit, [W, D] = dims(ctx);
  P.lot(k, W, D, 'pavers');
  const bx = 0, bz = -1.2 * M, bw = W - 2.0 * M, bd = 6.0 * M, h = 7.4 * M;
  k.box('glass_curtain_dark', bx, 0, bz, bw, h, bd);
  if (P.D1(k)) {
    const cols = ['paint_red', 'wood_planks', 'paint_yellow', 'paint_teal', 'wood_dark', 'paint_blue', 'terracotta', 'paint_green'];
    const n = Math.round(bw / (0.42 * M));
    for (let row = 0; row < 2; row++) for (let i = 0; i < n; i++) {
      const hh = (2.2 + ((i * 7 + row * 3) % 5) * 0.18) * M;
      k.box(cols[(i * 3 + row) % cols.length], bx - bw / 2 + (i + 0.5) * (bw / n), 1.0 * M + row * 3.2 * M, bz + bd / 2 + 0.05 * M, bw / n * 0.7, hh, 0.12 * M);
    }
  } else k.box('lod_windows', bx, 0.8 * M, bz + bd / 2 + 0.04 * M, bw, h - 1.6 * M, 0.02 * M);
  k.box('trim_dark', bx, h, bz, bw + 0.6 * M, 0.5 * M, bd + 0.6 * M);
  k.flatRoof('green_roof', 'trim_dark', bx, h + 0.5 * M, bz, bw, bd, { parapet: 0.2 * M });
  P.door(k, bx, bz + bd / 2 + 0.06 * M, 0, { glass: true, w: 2.0 * M, canopy: 'trim_dark' });
  P.signBox(k, 'BIBLIOTHEK', bx, h + 0.05 * M, bz + bd / 2 + 0.36 * M, 0, { px: 0.1 * M, bg: 'trim_dark', fg: 'paint_yellow' });
  P.slab(k, 'wood_deck', bx - bw / 4, 3.2 * M, bw * 0.4, 2.0 * M);
  P.bench(k, bx - bw / 4, 3.2 * M, 0); P.bench(k, bx + bw / 4, 3.6 * M, 0);
  P.tree(k, bx + bw / 4, 3.0 * M, 0.7);
  P.bikeRack(k, -3.6 * M, 4.4 * M, 0, 3);
  return P.finish(k);
}

// ---------------------------------------------------------------- Spielplatz: Kletterburg mit Türmen, Hängebrücke, Rutsche
function playCastle(ctx) {
  const k = ctx.kit, [W, D] = dims(ctx);
  P.lot(k, W, D, 'grass', { curb: false });
  P.slab(k, 'sand', 0, -0.4 * M, 8.0 * M, 7.4 * M);
  const towers = [[-2.4 * M, -1.8 * M, 'paint_red'], [2.2 * M, -1.6 * M, 'paint_blue']];
  for (const [x, z, roof] of towers) {
    for (const a of [-1, 1]) for (const b of [-1, 1]) k.box('wood_planks', x + a * 0.75 * M, 0, z + b * 0.75 * M, 0.16 * M, 3.0 * M, 0.16 * M);
    k.box('wood_dark', x, 1.5 * M, z, 1.7 * M, 0.12 * M, 1.7 * M);
    if (P.D1(k)) for (const b of [-1, 1]) k.box('wood_planks', x, 1.62 * M, z + b * 0.8 * M, 1.6 * M, 0.7 * M, 0.06 * M);
    k.cone(roof, x, 3.0 * M, z, 1.25 * M, 1.4 * M, { seg: 4, ry: Math.PI / 4 });
  }
  // Hängebrücke
  if (P.D1(k)) {
    const n = 8;
    for (let i = 0; i <= n; i++) { const t = i / n, x = -1.6 * M + t * 3.0 * M, y = 1.6 * M - Math.sin(t * Math.PI) * 0.35 * M; k.box('wood_planks', x, y, -1.7 * M, 0.3 * M, 0.06 * M, 0.9 * M); }
    for (const s of [-1, 1]) k.box('rubber', 0.0, 2.3 * M, -1.7 * M + s * 0.45 * M, 3.0 * M, 0.04 * M, 0.04 * M);
  }
  // Rutsche vom blauen Turm
  k.box('paint_yellow', 3.6 * M, 0.9 * M, -0.2 * M, 0.7 * M, 0.08 * M, 2.8 * M, { rx: -0.55 });
  // Schaukel, Sandkasten
  if (P.D1(k)) {
    for (const s of [-1, 1]) k.box('metal_dark', -2.6 * M + s * 1.4 * M, 0, 2.6 * M, 0.1 * M, 2.4 * M, 0.1 * M);
    k.box('metal_dark', -2.6 * M, 2.35 * M, 2.6 * M, 2.9 * M, 0.1 * M, 0.1 * M);
    for (const s of [-1, 1]) { k.box('metal_light', -2.6 * M + s * 0.6 * M, 0.6 * M, 2.6 * M, 0.03 * M, 1.75 * M, 0.03 * M); k.box('paint_red', -2.6 * M + s * 0.6 * M, 0.55 * M, 2.6 * M, 0.5 * M, 0.06 * M, 0.25 * M); }
  }
  k.box('wood_planks', 2.0 * M, 0, 2.6 * M, 2.6 * M, 0.35 * M, 2.6 * M);
  k.box('sand', 2.0 * M, 0.02 * M, 2.6 * M, 2.3 * M, 0.35 * M, 2.3 * M);
  P.bench(k, 4.2 * M, 3.6 * M, -Math.PI / 2); P.bench(k, -4.3 * M, -0.2 * M, Math.PI / 2);
  P.tree(k, -4.0 * M, -4.2 * M, 0.85); P.tree(k, 4.0 * M, -4.2 * M, 0.7, { leaf: 'leaves_light' });
  P.fenceRect(k, 0, 0, W - 0.5 * M, D - 0.5 * M, { h: 1.0 * M, mat: 'paint_green', post: 'metal_dark', gate: 1.4 * M, gateX: 1.8 * M, step: 1.5 * M, gatePosts: false });
  return P.finish(k);
}

// ---------------------------------------------------------------- Kleiner Park: Rosengarten mit Pavillon und Rondell
function parkPavilion(ctx) {
  const k = ctx.kit, [W, D] = dims(ctx);
  P.lot(k, W, D, 'grass', { curb: false });
  P.walk(k, 'gravel', [[0, D / 2], [0, -1.0 * M]], 1.4 * M);
  P.ring(k, 'gravel', 0, P.PAVE, -1.4 * M, 1.6 * M, 2.6 * M, { seg: P.segs(k, 20) });
  // Pavillon (achteckig, weiß, Kupferdach)
  const px = 0, pz = -1.4 * M, r = 1.4 * M;
  k.cyl('stone_grey', px, 0, pz, r + 0.15 * M, 0.3 * M, { seg: 8 });
  if (P.D1(k)) for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; k.cyl('paint_white', px + Math.sin(a) * r, 0.3 * M, pz + Math.cos(a) * r, 0.08 * M, 2.4 * M, { seg: 5 }); }
  k.cyl('paint_white', px, 2.7 * M, pz, r + 0.2 * M, 0.25 * M, { seg: 8 });
  k.cone('roof_copper', px, 2.95 * M, pz, r + 0.35 * M, 1.6 * M, { seg: 8 });
  if (P.D1(k)) k.sphere('roof_copper', px, 4.6 * M, pz, 0.15 * M, { seg: 6 });
  // Rosenbeete
  for (const [x, z] of [[-3.2, 2.6], [3.2, 2.6], [-3.4, -3.6], [3.4, -3.6]]) P.flowerBed(k, x * M, z * M, 2.0 * M, 1.6 * M);
  for (const [x, z] of [[-4.0, -0.6], [4.0, -0.6]]) P.tree(k, x * M, z * M, 0.8);
  if (P.D1(k)) { P.hedgeLine(k, -W / 2 + 0.4 * M, -D / 2 + 0.4 * M, W / 2 - 0.4 * M, -D / 2 + 0.4 * M, 0.9 * M, 0.6 * M); }
  P.bench(k, -1.6 * M, 2.2 * M, Math.PI); P.bench(k, 1.6 * M, 2.2 * M, Math.PI);
  P.lamp(k, 1.0 * M, 3.8 * M, 3.6 * M, { globe: true });
  return P.finish(k);
}

// ---------------------------------------------------------------- Wasserturm: moderner Betonkelch auf schlankem Schaft
function watertowerModern(ctx) {
  const k = ctx.kit, [W, D] = dims(ctx);
  P.lot(k, W, D, 'grass', { curb: false });
  P.slab(k, 'pavers', 0, 0, 7.0 * M, 7.0 * M);
  P.slab(k, 'pavers', 0, 4.3 * M, 2.2 * M, 1.4 * M);
  const seg = P.segs(k, 20);
  k.cyl('concrete', 0, 0, 0, 2.0 * M, 0.8 * M, { seg });
  k.cyl('concrete', 0, 0.8 * M, 0, 1.0 * M, 16 * M, { seg, rTop: 0.9 * M });
  if (P.D1(k)) for (let i = 0; i < 4; i++) k.window(Math.sin(i * 1.57) * 1.0 * M, (3 + i * 3.5) * M, Math.cos(i * 1.57) * 1.0 * M, i * 1.57, 0.4 * M, 1.2 * M, { frame: 'trim_dark' });
  // Kelch: Kegelstumpf, Behälter, Dach
  k.cyl('concrete', 0, 16.8 * M, 0, 1.0 * M, 3.2 * M, { seg, rTop: 4.2 * M });
  k.cyl('paint_blue', 0, 20.0 * M, 0, 4.2 * M, 2.6 * M, { seg });
  if (P.D1(k)) k.cyl('paint_white', 0, 21.2 * M, 0, 4.25 * M, 0.35 * M, { seg });
  k.cyl('concrete', 0, 22.6 * M, 0, 4.4 * M, 0.4 * M, { seg });
  P.text(k, 'WASSER', 0, 21.15 * M, 4.27 * M, 0, 0.14 * M, 'paint_white');
  P.ringRail(k, 0, 23.0 * M, 0, 4.25 * M, 'metal_light');
  if (P.D1(k)) k.cyl('metal_light', 1.5 * M, 23.0 * M, 0, 0.08 * M, 3 * M, { seg: 5 });
  k.light(1.5 * M, 26.1 * M, 0, 0xff3a2a, 0.22);
  P.door(k, 0, 2.0 * M, 0, { w: 1.0 * M });
  P.tree(k, -3.8 * M, 3.8 * M, 0.7); P.tree(k, 3.8 * M, -3.8 * M, 0.8);
  return P.finish(k);
}

extend('police', [policeModern]);
extend('fire', [fireModern]);
extend('clinic', [clinicModern]);
extend('school', [schoolModern]);
extend('library', [libraryModern]);
extend('playground', [playCastle]);
extend('park', [parkPavilion]);
extend('watertower', [watertowerModern]);
