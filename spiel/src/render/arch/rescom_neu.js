// Weitere Wohngebäude der Stufen 3–5 (Zone Wohnen). Gebaut mit dem Meter-Baukasten B (indoff_parts.js) auf
// demselben Kit wie die übrigen Wohntypen. Front (Straße) nach +z, 1 Feld = 10 m. ctx.hf = Höhenfaktor (mix.js).
// Stufe 3: Backstein-Altbau mit Zwerchgiebel, Kubus mit farbigen Loggien, Stadtvilla mit Zeltdach, Holzhaus
// Stufe 4: Klinkerblock mit Erkern, Block mit bunten Balkonen, Rundeck-Wohnhaus, kleiner Wohnturm mit Eckbalkonen
// Stufe 5: Stufenturm mit Dachgärten, Versatzturm, Wellenbalkon-Turm, Wohnturm mit Krone
import { B, PI, HP } from './indoff_parts.js';
import { SIDES, vol, facPunch, facRibbon, facCurtain, roundBlock, antenna } from './indoff_off.js';

const FHR = 3.0; // Wohngeschoss
const PLASTER = ['plaster_white', 'plaster_cream', 'plaster_ochre', 'plaster_pink', 'plaster_blue', 'plaster_green', 'plaster_yellow', 'plaster_grey', 'plaster_red'];
const ACCENT = ['paint_yellow', 'paint_teal', 'terracotta', 'paint_red', 'paint_blue', 'paint_green', 'paint_orange', 'metal_panel_bronze'];
const nfl = (b, base, rnd = 2) => Math.max(3, Math.round(base * (b.fw * b.fd >= 4 ? 1.2 : b.fw * b.fd >= 2 ? 1.08 : 1) * (b.ctx.hf || 1)) + b.int(0, rnd));

// Kragbalkon an Fassade f (Mitte a, Fußboden y): Platte + Brüstung (Glas, Blech oder Stäbe)
function balc(b, f, a, y, w, dep, o = {}) {
  const slab = o.slab || 'concrete', rail = o.rail || 'glass_railing', rh = o.rh ?? 1.0;
  b.fbox(slab, f, a, y - 0.2, w, 0.2, dep, 0);
  if (b.d === 0) return;
  if (o.bars && b.d >= 2) {
    b.fbox(rail, f, a, y + rh - 0.06, w, 0.06, 0.06, dep - 0.06);
    const n = Math.max(2, Math.round(w / 0.35));
    for (let i = 0; i <= n; i++) b.fbox(rail, f, a - w / 2 + 0.03 + (i * (w - 0.06)) / n, y, 0.04, rh, 0.04, dep - 0.05);
  } else b.fbox(rail, f, a, y, w, rh, 0.06, dep - 0.06);
  if (b.d >= 2 || !o.bars) for (const s of [-1, 1]) { const [x, z] = f.at(a + s * (w / 2 - 0.03), dep / 2); b.box(rail, x, y, z, 0.06, rh, dep - 0.06, f.ry); }
  if (o.plants && b.d >= 2) { const [x, z] = f.at(a + w / 2 - 0.4, dep * 0.5); b.box('leaves_green', x, y, z, 0.5, 0.6, 0.5); }
}
// Hausgrund: Vorgarten/Vorplatz, Hof mit Bäumen, Fahrradständer
function resGround(b, front, o = {}) {
  const { W, D } = b;
  b.lot(o.lawn || 'grass', 0.06);
  b.ground(o.paved || 'pavers', 0, D / 2 - front / 2, W - 0.3, front - 0.1, 0.1);
}
function yard(b, n = 2) { for (let i = 0; i < n; i++) b.putTree(b.rnd(0.6, 0.9), b.chance(0.25) ? 'obst' : 'laub', { prefer: 'back' }); }
// Eingang mit Vordach, Klingel, Leuchte
function entry(b, f, a, o = {}) {
  b.fbox('metal_dark', f, a, 0, 1.9, 2.8, 0.1, 0);
  b.fplane(o.glass || 'glass_window', f, a, 0.05, 1.5, 2.5, 0.12);
  if (b.d >= 1) b.fbox(o.canopy || 'concrete', f, a, 2.9, 2.6, 0.2, 1.3, 0);
  b.wallLight(f, a + 1.2, 2.4);
}
// Satteldach mit First entlang x (Traufe zur Straße), Prisma
function ridgeX(b, mat, x, y, z, sx, sz, h, over = 0.4) { b.prism(mat, [[-sz / 2 - over, 0], [sz / 2 + over, 0], [0, h]], sx + 2 * over * 0.6, x, y, z, HP); }

// =====================================================================================
// Stufe 3
// =====================================================================================

// Backstein-Altbau: vier Geschosse Klinker, weiße Sprossenfenster, Satteldach mit Zwerchgiebel und Stabbalkonen
function backsteinZwerch(ctx) {
  const b = new B(ctx);
  const front = 2.0, { W, D } = b;
  const wall = b.pick(['brick_red', 'brick_clinker', 'brick_brown', 'brick_red', 'brick_yellow']);
  const trim = b.pick(['plaster_white', 'trim_stone', 'stone_sandstone']);
  const n = 4, pl = 0.6;
  const sx = W - 0.6, sz = Math.min(D - front - 3.0, 11 + (b.fd - 1) * 3), cz = D / 2 - front - sz / 2;
  resGround(b, front);
  b.box('stone_dark', 0, 0, cz, sx + 0.1, pl, sz + 0.1);
  facPunch(b, vol(0, cz, sx, sz, pl, n, FHR), { wall, frame: 'window_frame_white', winW: 1.15, winH: 1.7, spacing: 2.3, sills: trim, lintel: b.d >= 2 ? trim : null, skipGround: true, margin: 0.9 });
  const f = b.faces(0, cz, sx, sz), ff = f.front;
  b.winRow(ff, -sx / 2 + 0.9, -1.6, pl + 0.9, 1.15, 1.6, { spacing: 2.3, frame: 'window_frame_white', sill: trim });
  b.winRow(ff, 1.6, sx / 2 - 0.9, pl + 0.9, 1.15, 1.6, { spacing: 2.3, frame: 'window_frame_white', sill: trim });
  for (const s of ['back', 'left', 'right']) b.winRow(f[s], -f[s].len / 2 + 1.0, f[s].len / 2 - 1.0, pl + 0.9, 1.1, 1.5, { spacing: 2.6, frame: 'window_frame_white' });
  entry(b, ff, 0, { canopy: trim });
  const top = pl + n * FHR;
  if (b.d >= 1) for (let k = 1; k < n; k++) b.box(trim, 0, pl + k * FHR - 0.15, cz, sx + 0.12, 0.15, sz + 0.12);
  b.box(trim, 0, top - 0.35, cz, sx + 0.3, 0.35, sz + 0.3);
  const roof = b.pick(['roof_tiles_red', 'roof_tiles_anthracite', 'roof_slate', 'roof_tiles_brown']);
  const rh = Math.min(sz * 0.42, 4.6);
  ridgeX(b, roof, 0, top, cz, sx, sz, rh);
  // Zwerchgiebel in der Mitte der Front
  const zw = Math.min(5.2, sx * 0.4), zh = rh * 0.85;
  b.fbox(wall, ff, 0, top, zw, zh * 0.45, 0.6, -0.6);
  b.prism(roof, [[-zw / 2 - 0.3, 0], [zw / 2 + 0.3, 0], [0, zh * 0.62]], sz * 0.55, 0, top + zh * 0.45, cz + sz * 0.25 + 0.4, 0);
  if (b.d >= 1) b.winRow(ff, -zw / 2 + 0.6, zw / 2 - 0.6, top + 0.5, 1.0, 1.3, { spacing: 1.6, frame: 'window_frame_white' });
  // Stabbalkone seitlich
  if (b.d >= 1) for (let k = 1; k < n; k++) for (const s of [-1, 1]) balc(b, ff, s * (sx / 2 - 2.3), pl + k * FHR, 2.4, 1.2, { slab: 'concrete', rail: 'metal_dark', bars: true, plants: b.chance(0.4) });
  if (b.d >= 1) { b.box('chimney_brick', sx * 0.3, top + rh * 0.4, cz - sz * 0.15, 0.7, rh * 0.75, 0.7); b.box('chimney_brick', -sx * 0.32, top + rh * 0.4, cz - sz * 0.12, 0.7, rh * 0.7, 0.7); }
  b.take(0, cz, sx, sz, 0.2);
  if (b.d >= 1) for (const s of [-1, 1]) b.hedge(s * (sx / 4 + 0.8), D / 2 - front * 0.55, sx / 2 - 3, 0.6, 0.7);
  yard(b, 2);
}

// Moderner Kubus: helle Putzfassade, eingeschnittene Loggien mit farbigen Laibungen, Dachterrasse
function kubusLoggia(ctx) {
  const b = new B(ctx);
  const front = 2.2, { W, D } = b;
  const wall = b.pick(['plaster_white', 'plaster_white', 'plaster_grey', 'brick_white', 'concrete_panel']);
  const acc = b.pick(ACCENT);
  const n = 4 + b.int(0, 1), pl = 0.3;
  const sx = W - 1.0, sz = Math.min(D - front - 2.6, 11 + (b.fd - 1) * 4), cz = D / 2 - front - sz / 2;
  resGround(b, front);
  const v = vol(0, cz, sx, sz, pl, n, FHR);
  facPunch(b, v, { wall, frame: 'window_frame_dark', winW: 1.5, winH: 1.5, spacing: 3.0, sills: 'metal_light', skipGround: false, margin: 1.2, sides: ['back', 'left', 'right'] });
  b.box(wall, 0, pl, cz, sx, n * FHR, sz);
  const ff = b.faces(0, cz, sx, sz).front;
  const nb = Math.max(2, Math.round(sx / 3.4)), bw = sx / nb;
  for (let k = 0; k < n; k++) for (let i = 0; i < nb; i++) {
    const a = -sx / 2 + (i + 0.5) * bw, y = pl + k * FHR;
    const lg = k > 0 && (i + k) % 2 === 0;
    if (k === 0 && i === Math.floor(nb / 2)) { entry(b, ff, a, { canopy: acc }); continue; }
    if (!lg) { b.winRow(ff, a - 0.8, a + 0.8, y + 0.8, 1.5, 1.6, { spacing: 2, frame: 'window_frame_dark', sill: 'metal_light' }); continue; }
    // Loggia: farbiger Rahmen, dunkle Rückwand mit Glastür, Glasbrüstung
    const lw = bw - 0.7;
    if (b.d === 0) { b.fplane(acc, ff, a, y, lw + 0.4, FHR, 0.04); b.fplane('glass_window', ff, a, y + 0.2, lw, FHR - 0.6, 0.06); continue; }
    b.fbox(acc, ff, a, y, lw + 0.4, 0.18, 0.12, 0);
    b.fbox(acc, ff, a, y + FHR - 0.3, lw + 0.4, 0.3, 0.12, 0);
    for (const s of [-1, 1]) b.fbox(acc, ff, a + s * (lw / 2 + 0.1), y, 0.2, FHR, 0.12, 0);
    b.fplane('glass_window', ff, a, y + 0.2, lw, FHR - 0.6, 0.13);
    if (b.d >= 1) b.fbox('glass_railing', ff, a, y + 0.18, lw, 0.95, 0.05, 0.12);
  }
  const top = pl + n * FHR;
  b.box('metal_light', 0, top, cz, sx + 0.1, 0.4, sz + 0.1);
  b.box('wood_deck', 0, top + 0.4, cz, sx - 0.4, 0.05, sz - 0.4);
  const ps = vol(-sx * 0.15, cz - sz * 0.15, sx * 0.55, sz * 0.6, top + 0.4, 1, 2.9);
  facCurtain(b, ps, { glass: 'glass_window', frame: 'metal_dark', sides: ['front', 'left', 'right'], blind: wall });
  b.box('green_roof', ps.x, ps.top, ps.z, ps.sx + 0.4, 0.3, ps.sz + 0.4);
  if (b.d >= 1) { b.roofRail(0, top + 0.4, cz, sx, sz); b.box(acc, sx * 0.3, top + 0.45, cz + sz * 0.2, 1.6, 0.45, 0.6); }
  b.take(0, cz, sx, sz, 0.2);
  yard(b, 2);
}

// Stadtvilla mit Zeltdach: vier Geschosse Putz, Eckbalkone, flaches Zeltdach mit weitem Überstand
function zeltvilla(ctx) {
  const b = new B(ctx);
  const front = 2.8, { W, D } = b;
  const wall = b.pick(PLASTER);
  const trim = b.pick(['plaster_white', 'trim_stone']);
  const n = 3 + b.int(0, 1), pl = 0.5;
  const s = Math.min(W - 2.4, D - front - 2.6, 14), sx = Math.min(W - 2.4, s * (b.fw > b.fd ? 1.35 : 1)), sz = s;
  const cz = D / 2 - front - sz / 2;
  resGround(b, front);
  b.box('stone_grey', 0, 0, cz, sx + 0.1, pl, sz + 0.1);
  facPunch(b, vol(0, cz, sx, sz, pl, n, FHR), { wall, frame: 'window_frame_white', winW: 1.2, winH: 1.6, spacing: 2.4, sills: trim, margin: 1.4, skipGround: false });
  const top = pl + n * FHR;
  b.box(trim, 0, top - 0.3, cz, sx + 0.2, 0.3, sz + 0.2);
  const f = b.faces(0, cz, sx, sz);
  entry(b, f.front, 0, { canopy: 'metal_dark' });
  if (b.d >= 1) for (let k = 1; k < n; k++) for (const sd of ['front', 'back']) for (const e of [-1, 1]) balc(b, f[sd], e * (sx / 2 - 1.5), pl + k * FHR, 2.6, 1.4, { slab: trim, rail: b.chance(0.5) ? 'glass_railing' : 'metal_dark', bars: b.chance(0.5) });
  // Zeltdach: vierseitige Pyramide, Überstand
  const roof = b.pick(['roof_tiles_anthracite', 'roof_slate', 'roof_tiles_red', 'roof_metal_grey']);
  const M = 0.1;
  b.k.hipRoof(roof, 0, top * M, cz * M, (sx + 1.6) * M, (sz + 1.6) * M, Math.min(sx, sz) * 0.24 * M);
  if (b.d >= 1) b.box('wood_dark', 0, top - 0.05, cz, sx + 1.5, 0.12, sz + 1.5);
  if (b.d >= 1) b.box('chimney_brick', sx * 0.2, top, cz - sz * 0.15, 0.6, Math.min(sx, sz) * 0.26, 0.6);
  b.take(0, cz, sx, sz, 0.2);
  if (b.d >= 1) b.hedge(0, D / 2 - 0.5, W - 4, 0.6, 0.9);
  yard(b, 3);
}

// Holzhaus: fünf Geschosse mit Lärchenschalung, umlaufende Holzbalkone, Gründach
function holzMfh(ctx) {
  const b = new B(ctx);
  const front = 2.4, { W, D } = b;
  const clad = b.pick(['wood_planks', 'wood_planks', 'wood_dark']);
  const n = 4 + b.int(0, 1), pl = 0.4;
  const sx = W - 2.6, sz = Math.min(D - front - 3.4, 10 + (b.fd - 1) * 4), cz = D / 2 - front - sz / 2;
  resGround(b, front, { paved: 'gravel_path' });
  b.box('concrete', 0, 0, cz, sx + 0.1, pl, sz + 0.1);
  facPunch(b, vol(0, cz, sx, sz, pl, n, FHR), { wall: clad, frame: 'window_frame_wood', winW: 1.0, winH: 2.3, spacing: 1.9, margin: 0.8, sill: 0.15 });
  const top = pl + n * FHR;
  const f = b.faces(0, cz, sx, sz);
  for (let k = 1; k <= n; k++) {
    const y = pl + k * FHR;
    if (k < n) for (const s of ['front', 'back']) balc(b, f[s], 0, y, f[s].len + 1.0, 1.3, { slab: 'wood_deck', rail: 'wood_planks', bars: true, plants: b.chance(0.5) });
    if (b.d >= 1 && k < n) for (const s of ['left', 'right']) b.fbox('wood_dark', f[s], 0, y - 0.2, f[s].len, 0.2, 0.25, 0);
  }
  b.box('wood_dark', 0, top, cz, sx + 0.6, 0.3, sz + 0.6);
  b.box('green_roof', 0, top + 0.3, cz, sx + 0.4, 0.25, sz + 0.4);
  if (b.d >= 1) b.solar(0, top + 0.55, cz, sx * 0.6, sz * 0.5);
  entry(b, f.front, -sx * 0.25, { canopy: 'wood_dark' });
  b.take(0, cz, sx + 1.0, sz + 2.6, 0.2);
  yard(b, 3);
}

// =====================================================================================
// Stufe 4
// =====================================================================================

// Klinkerblock: sieben Geschosse dunkler Klinker, durchgehende Erker mit Fensterbändern, Staffelgeschoss
function klinkerErker(ctx) {
  const b = new B(ctx);
  const front = 2.0, { W, D } = b;
  const wall = b.pick(['brick_clinker', 'brick_dark', 'brick_red', 'brick_brown']);
  const erk = b.pick(['metal_panel_grey', 'brick_white', 'plaster_white', 'metal_panel_bronze', wall]);
  const n = nfl(b, 6, 1), pl = 0.4;
  const sx = W - 0.6, sz = Math.min(D - front - 3.0, 12 + (b.fd - 1) * 4), cz = D / 2 - front - sz / 2;
  resGround(b, front);
  const v = vol(0, cz, sx, sz, pl, n, FHR);
  facPunch(b, v, { wall, frame: 'window_frame_white', winW: 1.3, winH: 1.6, spacing: 2.4, sills: 'metal_light', margin: 0.8, skipGround: true });
  const f = b.faces(0, cz, sx, sz), ff = f.front;
  b.box('stone_dark', 0, 0, cz, sx + 0.1, pl + FHR, sz + 0.1);
  entry(b, ff, 0, { canopy: 'metal_dark' });
  for (const s of [-1, 1]) b.winRow(ff, s > 0 ? 1.6 : -sx / 2 + 0.8, s > 0 ? sx / 2 - 0.8 : -1.6, pl + 0.9, 1.4, 1.7, { spacing: 2.4, frame: 'window_frame_dark' });
  // Erker: über alle Obergeschosse, mit Fensterbändern
  const ne = Math.max(1, Math.round(sx / 7)), ew = Math.min(3.6, sx / ne - 2.2);
  for (let i = 0; i < ne; i++) {
    const a = -sx / 2 + (i + 0.5) * (sx / ne);
    const [ex, ez] = ff.at(a, 0.45);
    const em = vol(ex, ez, ew, 0.9, pl + FHR, n - 1, FHR);
    b.box(erk, ex, em.y0, ez, ew, (n - 1) * FHR, 0.9);
    const ef = b.face(ex, ez, ew, 0.9, 'front');
    for (let k = 0; k < n - 1; k++) b.band(ef, -ew / 2 + 0.25, ew / 2 - 0.25, em.y0 + k * FHR + 0.8, 1.6, { glass: 'glass_window', frame: 'window_frame_dark', part: 4 });
    b.box('metal_dark', ex, em.y0 + (n - 1) * FHR, ez, ew + 0.1, 0.25, 1.0);
  }
  const top = pl + n * FHR;
  b.box('stone_grey', 0, top - 0.3, cz, sx + 0.2, 0.3, sz + 0.2);
  const s = vol(0, cz - 1.0, sx - 3.0, sz - 2.6, top, 1, 2.9);
  facRibbon(b, s, { band: 'metal_panel_grey', glass: 'glass_window', winH: 2.1 });
  b.box('roof_flat_gravel', 0, s.top, s.z, s.sx + 0.2, 0.3, s.sz + 0.2);
  if (b.d >= 1) b.roofRail(0, top, cz, sx, sz);
  b.take(0, cz, sx, sz, 0.2);
  yard(b, 2);
}

// Block mit bunten Balkonen: weiße Fassade, versetzte Kragbalkone mit farbigen Brüstungen
function bunteBalkone(ctx) {
  const b = new B(ctx);
  const front = 2.4, { W, D } = b;
  const wall = b.pick(['plaster_white', 'plaster_white', 'concrete_panel', 'plaster_grey', 'brick_white']);
  const cols = [b.pick(ACCENT), b.pick(ACCENT), b.pick(ACCENT)];
  const n = nfl(b, 7, 1), pl = 0.3;
  const sx = W - 1.0, sz = Math.min(D - front - 3.0, 12 + (b.fd - 1) * 4), cz = D / 2 - front - sz / 2;
  resGround(b, front);
  facPunch(b, vol(0, cz, sx, sz, pl, n, FHR), { wall, frame: 'window_frame_dark', winW: 1.1, winH: 2.2, spacing: 2.2, margin: 0.9, sill: 0.1 });
  const f = b.faces(0, cz, sx, sz);
  entry(b, f.front, 0, { canopy: cols[0] });
  const nb = Math.max(2, Math.round(sx / 4.4)), bw = sx / nb;
  for (let k = 1; k < n; k++) for (const side of ['front', 'back']) for (let i = 0; i < nb; i++) {
    if ((i + k + (side === 'back' ? 1 : 0)) % 2) continue;
    const a = -sx / 2 + (i + 0.5) * bw + (k % 2 ? 0.5 : -0.5);
    balc(b, f[side], a, pl + k * FHR, Math.min(3.2, bw - 0.6), 1.5, { slab: 'concrete_panel', rail: cols[(i + k) % 3], plants: b.chance(0.3) });
  }
  const top = pl + n * FHR;
  b.box('metal_light', 0, top, cz, sx + 0.1, 0.5, sz + 0.1);
  b.box('green_roof', 0, top + 0.5, cz, sx - 0.3, 0.1, sz - 0.3);
  if (b.d >= 1) { b.box('metal_panel_grey', 0, top + 0.5, cz - sz * 0.2, 2.6, 2.4, 2.4); b.solar(sx * 0.25, top + 0.6, cz, sx * 0.3, sz * 0.5); }
  b.take(0, cz, sx, sz + 3.2, 0.2);
  yard(b, 3);
}

// Rundeck-Wohnhaus (50er Jahre): abgerundete Ecke, umlaufende Brüstungsbänder, Flugdach
function rundeck(ctx) {
  const b = new B(ctx);
  const front = 1.6, { W, D } = b;
  const band = b.pick(['plaster_white', 'plaster_cream', 'plaster_yellow', 'plaster_grey']);
  const wall = b.pick(['plaster_ochre', 'plaster_blue', 'plaster_green', 'brick_yellow', 'plaster_pink', 'plaster_grey']);
  const n = nfl(b, 6, 1), pl = 0.3;
  const sx = W - 0.6, sz = Math.min(D - front - 2.6, 12 + (b.fd - 1) * 4), cz = D / 2 - front - sz / 2;
  const R = Math.min(sx, sz) * 0.32;
  resGround(b, front, { lawn: 'grass' });
  b.box('stone_dark', 0, 0, cz, sx, pl, sz);
  const seg = b.d >= 2 ? 10 : b.d === 1 ? 7 : 5;
  if (b.d === 0) roundBlock(b, wall, 0, pl, cz, sx - 0.3, n * FHR, sz - 0.3, R - 0.15, { seg });
  for (let k = 0; k < n; k++) {
    const y = pl + k * FHR;
    if (b.d === 0) {
      const ff = b.face(0, cz, sx - 0.3, sz - 0.3, 'front'), fr = b.face(0, cz, sx - 0.3, sz - 0.3, 'right');
      b.fplane(band, ff, -R / 2, y, sx - R - 0.3, 1.0, 0.02); b.fplane(band, fr, R / 2, y, sz - R - 0.3, 1.0, 0.02);
      b.band(ff, -sx / 2 + 0.8, sx / 2 - R - 0.2, y + 1.1, 1.5, { glass: 'glass_window', part: 3 });
      b.band(fr, -sz / 2 + R + 0.2, sz / 2 - 0.8, y + 1.1, 1.5, { glass: 'glass_window', part: 3 });
      continue;
    }
    roundBlock(b, band, 0, y, cz, sx, 1.0, sz, R, { seg });
    roundBlock(b, wall, 0, y + 1.0, cz, sx - 0.3, FHR - 1.0, sz - 0.3, R - 0.15, { seg });
    // Fensterband an Front und rechter Seite (lit für Nachtlicht)
    const ff = b.face(0, cz, sx - 0.3, sz - 0.3, 'front'), fr = b.face(0, cz, sx - 0.3, sz - 0.3, 'right');
    b.band(ff, -sx / 2 + 0.8, sx / 2 - R - 0.2, y + 1.1, 1.5, { glass: 'glass_window', frame: 'window_frame_white', part: 3, mull: 1.2 });
    b.band(fr, -sz / 2 + R + 0.2, sz / 2 - 0.8, y + 1.1, 1.5, { glass: 'glass_window', frame: 'window_frame_white', part: 3, mull: 1.2 });
    if (b.d >= 1) b.cyl('glass_window', sx / 2 - R, y + 1.1, cz + sz / 2 - R, R - 0.1, 1.5, { seg, t0: 0, tl: HP, open: true, lit: b.r(), exact: true });
    const fb = b.face(0, cz, sx - 0.3, sz - 0.3, 'back'), fl = b.face(0, cz, sx - 0.3, sz - 0.3, 'left');
    b.winRow(fb, -fb.len / 2 + 1, fb.len / 2 - 1, y + 1.1, 1.3, 1.4, { spacing: 2.4, frame: 'window_frame_white' });
    b.winRow(fl, -fl.len / 2 + 1, fl.len / 2 - 1, y + 1.1, 1.1, 1.4, { spacing: 2.8, frame: 'window_frame_white' });
  }
  const top = pl + n * FHR;
  roundBlock(b, band, 0, top, cz, sx + 0.8, 0.35, sz + 0.8, R + 0.4, { seg });
  if (b.d >= 1) b.box('metal_dark', -sx * 0.3, top + 0.35, cz - sz * 0.2, 1.8, 2.0, 1.8);
  const ff = b.faces(0, cz, sx, sz).front;
  entry(b, ff, -sx * 0.3, { canopy: band });
  b.take(0, cz, sx, sz, 0.2);
  yard(b, 2);
}

// Kleiner Wohnturm: zehn bis zwölf Geschosse, Eckbalkone über Eck, Penthouse mit Pergola
function eckbalkonTurm(ctx) {
  const b = new B(ctx);
  const front = 2.6, { W, D } = b;
  const wall = b.pick(['plaster_white', 'concrete_panel', 'brick_white', 'plaster_grey', 'brick_yellow', 'terracotta']);
  const rail = b.pick(['glass_railing', 'metal_light', 'metal_dark', 'paint_white']);
  const n = nfl(b, 10, 2), pl = 0.3;
  const s = Math.min(W - 3.0, D - front - 3.0, 16), cz = D / 2 - front - s / 2;
  resGround(b, front);
  b.box('stone_dark', 0, 0, cz, s + 0.1, pl + 3.6, s + 0.1);
  const f0 = b.faces(0, cz, s, s);
  for (const sd of SIDES) b.band(f0[sd], -s / 2 + 1.0, s / 2 - 1.0, pl + 0.4, 2.6, { glass: 'glass_window', frame: 'metal_dark', part: 3 });
  entry(b, f0.front, 0, { canopy: 'metal_dark' });
  const v = vol(0, cz, s, s, pl + 3.6, n - 1, FHR);
  facPunch(b, v, { wall, frame: 'window_frame_dark', winW: 1.4, winH: 1.5, spacing: 2.6, sills: 'metal_light', margin: 2.6 });
  // Eckbalkone: je Ecke zwei Platten (vorne/hinten und seitlich)
  const f = b.faces(0, cz, s, s);
  for (let k = 1; k < n; k++) {
    const y = pl + 3.6 + (k - 1) * FHR + (k === 1 ? 0.01 : 0);
    if (k === 1) continue;
    if (b.d === 0) { if (k % 2 === 0) b.box('concrete', 0, y - 0.2, cz, s + 2.4, 0.2, s + 2.4); continue; }
    for (const sd of ['front', 'back']) for (const e of [-1, 1]) {
      balc(b, f[sd], e * (s / 2 - 1.2), y, 2.4, 1.4, { slab: 'concrete', rail });
    }
    for (const sd of ['left', 'right']) for (const e of [-1, 1]) balc(b, f[sd], e * (s / 2 - 1.2 + 0.7), y, 1.0, 1.4, { slab: 'concrete', rail });
  }
  const top = v.top;
  b.box('concrete', 0, top, cz, s + 0.2, 0.4, s + 0.2);
  const p = vol(-s * 0.1, cz - s * 0.1, s * 0.6, s * 0.6, top + 0.4, 1, 3.0);
  facCurtain(b, p, { glass: 'glass_window', frame: 'metal_dark' });
  b.box('concrete', p.x, p.top, p.z, p.sx + 1.6, 0.35, p.sz + 1.6);
  if (b.d >= 1) {
    b.roofRail(0, top + 0.4, cz, s, s);
    for (let i = 0; i < 5; i++) b.box('wood_planks', s * 0.25, top + 3.0, cz - s / 2 + 1 + i * (s - 2) / 4, s * 0.4, 0.12, 0.12);
    for (const e of [-1, 1]) b.box('metal_dark', s * 0.25 + e * s * 0.18, top + 0.4, cz + s * 0.35, 0.12, 2.6, 0.12);
  }
  antenna(b, p.x, p.top + 0.35, p.z, 4);
  b.take(0, cz, s, s, 0.4);
  yard(b, 3);
}

// =====================================================================================
// Stufe 5
// =====================================================================================

// Stufenturm: Wohnhochhaus mit vier Rücksprüngen, begrünte Dachterrassen mit Bäumchen
function stufenturm(ctx) {
  const b = new B(ctx);
  const front = 2.6, { W, D } = b;
  const wall = b.pick(['plaster_white', 'concrete_panel', 'brick_white', 'terracotta', 'brick_yellow', 'plaster_grey']);
  const acc = b.pick(['wood_planks', 'metal_panel_bronze', 'metal_panel_grey', 'brick_dark']);
  const n = nfl(b, 18, 3), pl = 0.3;
  const sx0 = Math.min(W - 1.6, 22), sz0 = Math.min(D - front - 2.4, 18), cz = D / 2 - front - sz0 / 2;
  resGround(b, front);
  const parts = [0.4, 0.28, 0.2, 0.12];
  let y = pl, sx = sx0, sz = sz0, zc = cz;
  b.box('stone_dark', 0, 0, cz, sx0 + 0.1, pl, sz0 + 0.1);
  parts.forEach((p, i) => {
    const nf = Math.max(2, Math.round(n * p));
    const v = vol(0, zc, sx, sz, y, nf, FHR);
    facPunch(b, v, { wall: i % 2 ? acc : wall, frame: 'window_frame_dark', winW: 1.5, winH: 1.6, spacing: 2.5, sills: 'metal_light', margin: 1.0 });
    const f = b.faces(0, zc, sx, sz);
    if (b.d >= 1) for (let k = 1; k < nf; k++) for (const e of [-1, 1]) balc(b, f.front, e * sx * 0.25, y + k * FHR, Math.min(3.0, sx * 0.3), 1.3, { slab: 'concrete', rail: 'glass_railing' });
    y = v.top;
    b.box(i === parts.length - 1 ? 'concrete' : 'green_roof', 0, y, zc, sx + 0.2, 0.3, sz + 0.2);
    const nsx = sx * 0.78, nsz = sz * 0.8;
    if (b.d >= 1 && i < parts.length - 1) {
      b.box('glass_railing', 0, y + 0.3, zc + sz / 2 - 0.05, sx, 1.0, 0.06);
      for (const e of [-1, 1]) b.sphere('leaves_green', e * (sx / 2 - (sx - nsx) / 4), y + 1.4, zc + sz / 2 - 1.2, Math.min(1.2, (sx - nsx) / 4), { seg: 6 });
    }
    y += 0.3; zc -= (sz - nsz) / 2 * 0.6; sx = nsx; sz = nsz;
  });
  b.box('metal_panel_grey', 0, y, zc, sx * 0.5, 2.6, sz * 0.5);
  antenna(b, 0, y + 2.6, zc, 5);
  const ff = b.faces(0, cz, sx0, sz0).front;
  entry(b, ff, 0, { canopy: 'metal_dark' });
  b.take(0, cz, sx0, sz0, 0.3);
  yard(b, 2);
}

// Versatzturm: gestapelte Quader zu je drei Geschossen, abwechselnd seitlich versetzt („Bauklötze")
function versatzturm(ctx) {
  const b = new B(ctx);
  const front = 2.6, { W, D } = b;
  const mats = [b.pick(['plaster_white', 'concrete_panel', 'metal_panel_white']), b.pick(['metal_panel_grey', 'terracotta', 'wood_planks', 'brick_dark', 'metal_panel_bronze'])];
  const n = nfl(b, 21, 3), pl = 0.3;
  const sx = Math.min(W - 4.0, 13), sz = Math.min(D - front - 4.0, 12), cz = D / 2 - front - sz / 2 - 0.4;
  resGround(b, front);
  b.box('stone_dark', 0, 0, cz, sx + 0.1, pl + 4.0, sz + 0.1);
  const f0 = b.faces(0, cz, sx, sz);
  for (const sd of SIDES) b.band(f0[sd], -f0[sd].len / 2 + 0.8, f0[sd].len / 2 - 0.8, pl + 0.5, 3.0, { glass: 'glass_window', frame: 'metal_dark', part: 3 });
  entry(b, f0.front, 0, { canopy: 'metal_dark' });
  const blocks = Math.max(3, Math.round((n - 1) / 3));
  let y = pl + 4.0;
  const mx = Math.min(1.6, (W - sx) / 2 - 0.6), mz = Math.min(1.2, (D - front - sz) / 2 - 0.6);
  for (let i = 0; i < blocks; i++) {
    const ox = (i % 2 ? 1 : -1) * mx * (i % 4 < 2 ? 1 : 0.5), oz = (i % 3 === 1 ? 1 : i % 3 === 2 ? -1 : 0) * mz;
    const v = vol(ox, cz + oz, sx, sz, y, 3, FHR);
    facPunch(b, v, { wall: mats[i % 2], frame: 'window_frame_dark', winW: 1.6, winH: 1.7, spacing: 2.6, margin: 0.9, sills: 'metal_light' });
    if (b.d >= 1) b.box('concrete', ox, v.top - 0.25, cz + oz, sx + 0.3, 0.25, sz + 0.3);
    y = v.top;
  }
  b.box('roof_flat_gravel', 0, y, cz, sx, 0.3, sz);
  b.box('metal_panel_grey', 0, y + 0.3, cz, sx * 0.4, 2.4, sz * 0.4);
  b.take(0, cz, sx + 2 * mx, sz + 2 * mz, 0.3);
  yard(b, 3);
}

// Wellenbalkon-Turm: runder Glasturm, umlaufende weiße Balkonplatten, deren Radius wellenförmig schwingt
function wellenturm(ctx) {
  const b = new B(ctx);
  const front = 2.8, { W, D } = b;
  const glass = b.pick(['glass_window', 'glass_curtain_blue', 'glass_curtain_green']);
  const slab = b.pick(['concrete_panel', 'metal_panel_white', 'plaster_white']);
  const n = nfl(b, 22, 3), pl = 0.3;
  const r = Math.min(W - 3.4, D - front - 3.4, 15) / 2, cz = D / 2 - front - r - 1.0;
  const seg = b.d >= 2 ? 16 : b.d === 1 ? 12 : 8;
  resGround(b, front);
  b.cyl('stone_dark', 0, 0, cz, r + 0.6, pl + 3.8, { seg, exact: true });
  b.cyl('glass_window', 0, pl + 0.3, cz, r + 0.62, 3.0, { seg, exact: true, open: true, lit: b.r() });
  const y0 = pl + 3.8, ph = b.r() * 6;
  b.cyl('concrete_dark', 0, y0, cz, r - 0.6, n * FHR, { seg, exact: true });
  if (b.d === 0) b.cyl(glass, 0, y0, cz, r - 0.5, n * FHR, { seg, exact: true, open: true, lit: b.r() });
  for (let k = 0; k < n; k++) {
    const y = y0 + k * FHR;
    if (b.d >= 1) b.cyl(glass, 0, y + 0.2, cz, r - 0.5, FHR - 0.25, { seg, exact: true, open: true, lit: b.r() });
    const rr = r + 0.35 * Math.sin(k * 0.55 + ph) + 0.35;
    if (b.d > 0 || k % 2) b.cyl(slab, 0, y + FHR - 0.22, cz, rr, 0.22, { seg: b.d === 0 ? 6 : seg, exact: true });
    if (b.d >= 2) b.cyl('glass_railing', 0, y + FHR, cz, rr - 0.05, 0.9, { seg, exact: true, open: true });
  }
  const top = y0 + n * FHR;
  b.cyl(slab, 0, top, cz, r + 0.2, 0.5, { seg, exact: true });
  b.cyl('metal_panel_grey', 0, top + 0.5, cz, r * 0.45, 2.6, { seg: 10 });
  const ff = b.face(0, cz, 2 * r + 1.2, 2 * r + 1.2, 'front');
  b.fbox('metal_dark', ff, 0, 0, 3.0, 3.4, 1.4, -0.3);
  b.fbox('concrete', ff, 0, 3.4, 4.0, 0.25, 2.2, -0.3);
  b.takeC(0, cz, r + 0.8, 0.3);
  yard(b, 3);
}

// Wohnturm mit Krone: schlanker Schaft mit Lisenen und Loggiareihen, oben zweigeschossiger Glasaufsatz mit Rahmen
function kronenwohnturm(ctx) {
  const b = new B(ctx);
  const front = 2.6, { W, D } = b;
  const wall = b.pick(['brick_white', 'stone_sandstone', 'concrete_panel', 'brick_yellow', 'plaster_white', 'terracotta']);
  const pier = b.pick(['concrete', 'trim_stone', 'metal_light', 'brick_dark']);
  const n = nfl(b, 24, 3), pl = 0.3;
  const sx = Math.min(W - 2.6, 15), sz = Math.min(D - front - 2.6, 13), cz = D / 2 - front - sz / 2;
  resGround(b, front);
  b.box('stone_dark', 0, 0, cz, sx + 0.4, pl + 4.2, sz + 0.4);
  const f0 = b.faces(0, cz, sx + 0.4, sz + 0.4);
  for (const sd of SIDES) b.band(f0[sd], -f0[sd].len / 2 + 0.8, f0[sd].len / 2 - 0.8, pl + 0.5, 3.2, { glass: 'glass_window', frame: 'metal_dark', part: 3 });
  entry(b, f0.front, 0, { canopy: pier });
  const v = vol(0, cz, sx, sz, pl + 4.2, n, FHR);
  facPunch(b, v, { wall, frame: 'window_frame_dark', winW: 1.3, winH: 1.8, spacing: 2.2, margin: 0.9 });
  const f = b.faces(0, cz, sx, sz);
  if (b.d >= 1) for (const sd of SIDES) {
    const len = f[sd].len, m = Math.max(2, Math.round(len / 3.2));
    for (let i = 0; i <= m; i++) b.fbox(pier, f[sd], -len / 2 + 0.15 + (i * (len - 0.3)) / m, v.y0, 0.35, n * FHR, 0.25, 0);
  }
  if (b.d >= 1) for (let k = 1; k < n; k += 1) for (const e of [-1, 1]) balc(b, f.front, e * sx * 0.22, v.y0 + k * FHR, 2.4, 1.0, { slab: pier, rail: 'glass_railing' });
  const top = v.top;
  b.box(pier, 0, top, cz, sx + 0.3, 0.5, sz + 0.3);
  const c = vol(0, cz, sx - 1.2, sz - 1.2, top + 0.5, 2, 3.2);
  facCurtain(b, c, { glass: 'glass_window', frame: 'metal_dark' });
  // Kronen-Rahmen über dem Aufsatz
  const yt = c.top;
  for (const cx of [-1, 1]) for (const cz2 of [-1, 1]) b.box(pier, cx * (sx / 2 - 0.2), top + 0.5, cz + cz2 * (sz / 2 - 0.2), 0.45, yt - top + 1.6, 0.45);
  for (const cz2 of [-1, 1]) b.box(pier, 0, yt + 1.4, cz + cz2 * (sz / 2 - 0.2), sx, 0.5, 0.45);
  for (const cx of [-1, 1]) b.box(pier, cx * (sx / 2 - 0.2), yt + 1.4, cz, 0.45, 0.5, sz);
  if (b.d >= 1) b.box('emissive_warm', 0, yt + 1.2, cz, sx - 0.6, 0.15, sz - 0.6);
  b.box('green_roof', 0, yt, cz, sx - 1.0, 0.3, sz - 1.0);
  b.light(0, yt + 1.0, cz, 0xffd79a, 0.7);
  b.take(0, cz, sx + 2.0, sz + 2.0, 0.3);
  yard(b, 2);
}

// Liste je Stufe: Funktionen mit Signatur (ctx, g, P) wie die übrigen Wohntypen
const wrap = (fn) => (ctx) => fn(ctx);
export const RES_NEW = {
  3: [backsteinZwerch, kubusLoggia, zeltvilla, holzMfh].map(wrap),
  4: [klinkerErker, bunteBalkone, rundeck, eckbalkonTurm].map(wrap),
  5: [stufenturm, versatzturm, wellenturm, kronenwohnturm].map(wrap),
};
