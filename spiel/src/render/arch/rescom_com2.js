// Weitere Gewerbebauten (Zone Gewerbe). Baukörper mit dem Meter-Baukasten B (indoff_parts.js), Schriftzüge,
// Markisen und Bestuhlung mit den Gewerbe-Werkzeugen (rescom_signs/site) auf derselben Geometrie-Sammlung g.
// Front (Straße) nach +z, 1 Feld = 10 m. ctx.hf = Höhenfaktor (mix.js).
// Stufe 1: Eckcafé, Friseur, Wochenmarkt, moderne Ladenzeile · Stufe 2: Eckhaus mit Café, Markthalle, Modehaus
// Stufe 3–4: Boutiquenhäuser, Kaufhaus (Stein, Uhr, Fahnen), Passage mit Glasdach, Hotel, Kino-Center
// Stufe 5: Hotelturm mit Spitze, Mall mit Turm, Leuchtturm-Geschäftshaus, gestuftes Kaufhaus-Hochhaus
import { B, PI, HP, LOGO } from './indoff_parts.js';
import { SIDES, FH, GLASS, vol, facRibbon, facCurtain, facGrid, facPunch, facFins, roofOff, lobby, roundBlock, antenna } from './indoff_off.js';
import { frame } from './rescom_geo.js';
import { signBand, awning } from './rescom_signs.js';
import { cafeSeating, parasol } from './rescom_site.js';
import { NAMES, AWNINGS, NEON } from './rescom_shop.js';

const MM = 0.1;
const SHOP_NAMES = ['MODE', 'SCHUHE', 'OPTIK', 'BÜCHER', 'ELEKTRO', 'SPIELWAREN', 'FEINKOST', 'BIOLADEN', 'WEIN', 'TEXTIL', 'UHREN', 'BLUMEN', 'DROGERIE', 'BÄCKER', 'CAFÉ'];
const nfl = (b, base, rnd = 2) => {
  const a = b.fw * b.fd, f = base >= 12 ? (a >= 4 ? 1.15 : a >= 2 ? 0.95 : 0.72) : (a >= 4 ? 1.2 : a >= 2 ? 1.08 : 1);
  return Math.max(2, Math.round(base * f * (b.ctx.hf || 1)) + b.int(0, rnd));
};
// Geo-Rahmen zu einer B-Fassade (gleiche Lage, Welteinheiten)
const gfr = (cx, cz, sx, sz, side) => frame(cx * MM, cz * MM, sx * MM, sz * MM, side);
// Schriftzug (Meter) auf Geo-Fassade
function label(g, f, str, a, y, w, h, o = {}) { signBand(g, f, str, a * MM, y * MM, w * MM, h * MM, { band: o.band ?? null, mat: o.mat || 'sign_white', depth: (o.depth ?? 0.06) * MM, maxPx: (o.maxPx ?? 0.35) * MM, light: o.light }); }
function awn(g, f, a, y, w, dep, mat, type = 'fixed') { awning(g, f, a * MM, y * MM, w * MM, dep * MM, mat, type); }
// Schaufensterfront: Glas mit Sprossen, Sockel, Kämpfer; Tür in der Mitte
function shopFront(b, f, a, w, h, o = {}) {
  b.fbox(o.frame || 'metal_dark', f, a, 0, w + 0.2, 0.35, 0.12, 0);
  b.fplane(o.glass || 'glass_shop', f, a, 0.35, w, h - 0.35, 0.1, b.r());
  if (b.d >= 1) {
    b.fbox(o.frame || 'metal_dark', f, a, h, w + 0.2, 0.15, 0.14, 0);
    const n = Math.max(1, Math.round(w / 1.8));
    for (let i = 0; i <= n; i++) b.fbox(o.frame || 'metal_dark', f, a - w / 2 + (i * w) / n, 0, 0.1, h, 0.12, 0);
  }
  if (b.d >= 2 && o.door !== false) b.fplane('door_glass', f, a + (o.doorA ?? 0), 0.02, 1.2, 2.3, 0.13);
}
// Obstkisten / Auslage
function crates(b, x, z, n, ry = 0) {
  if (b.d < 2) return;
  const cols = ['paint_red', 'paint_orange', 'leaves_green', 'paint_yellow', 'leaves_light'];
  for (let i = 0; i < n; i++) {
    const s = Math.sin(ry), c = Math.cos(ry), o = (i - (n - 1) / 2) * 0.6;
    b.box('wood_planks', x + c * o, 0.1, z - s * o, 0.55, 0.5, 0.4, ry);
    b.box(cols[i % cols.length], x + c * o, 0.6, z - s * o, 0.5, 0.12, 0.35, ry);
  }
}
function ground(b, front, mat = 'pavers') { b.lot(mat, 0.08); b.ground('sidewalk', 0, b.D / 2 - front / 2, b.W - 0.3, front - 0.1, 0.12); }

// =====================================================================================
// Stufe 1
// =====================================================================================

// Eckcafé: gläserner Pavillon mit Markise, Terrasse mit Sonnenschirmen
function eckcafe(ctx, g) {
  const b = new B(ctx), { W, D } = b;
  const front = 3.6;
  ground(b, front);
  const sx = Math.min(W - 3.0, 8 + (b.fw - 1) * 5), sz = Math.min(D - front - 1.4, 6.5 + (b.fd - 1) * 3), cx = b.chance(0.5) ? -1.0 : 1.0, cz = D / 2 - front - sz / 2;
  const wall = b.pick(['plaster_white', 'plaster_cream', 'paint_white', 'brick_red', 'plaster_yellow']);
  b.box(wall, cx, 0, cz, sx, 3.6, sz);
  const f = b.faces(cx, cz, sx, sz);
  shopFront(b, f.front, 0, sx - 1.2, 2.9, { glass: 'glass_shop', frame: 'wood_dark' });
  shopFront(b, f[cx > 0 ? 'left' : 'right'], 0, sz - 1.4, 2.9, { glass: 'glass_shop', frame: 'wood_dark', door: false });
  b.box('trim_dark', cx, 3.6, cz, sx + 0.3, 0.4, sz + 0.3);
  b.box('roof_flat_membrane', cx, 4.0, cz, sx, 0.05, sz);
  const gf = gfr(cx, cz, sx, sz, 'front');
  const am = b.pick(AWNINGS);
  awn(g, gf, 0, 3.2, sx - 0.6, 1.8, am, b.chance(0.5) ? 'fixed' : 'roll');
  label(g, gf, b.pick(NAMES.cafe), 0, 3.62, sx - 1.0, 0.7, { band: 'trim_dark', mat: 'sign_white' });
  const tz = D / 2 - front / 2 - 0.2;
  cafeSeating(g, cx * MM, tz * MM, (sx - 1) * MM, Math.max(2, Math.round(sx / 2.4)), { umbrella: b.d >= 2 ? b.pick(['canvas_white', am]) : null, chair: 'metal_dark' });
  if (b.d >= 1) b.box('hedge', cx, 0, D / 2 - 0.35, sx - 1, 0.6, 0.4);
  b.take(cx, cz, sx, sz, 0.3);
  b.putTree(0.8, 'laub', { prefer: 'back' });
  if (b.fd > 1) for (let i = 0; i < 3; i++) b.putCar({ prefer: 'back' });
}

// Friseur: schmales zweigeschossiges Haus, Laden mit Schaufenster, Schriftzug, gestreifte Säule
function friseur(ctx, g) {
  const b = new B(ctx), { W, D } = b;
  const front = 2.2;
  ground(b, front);
  const wall = b.pick(['plaster_pink', 'plaster_blue', 'plaster_green', 'plaster_white', 'plaster_yellow', 'brick_yellow']);
  const sx = Math.min(W - 1.4, 7.4 + (b.fw - 1) * 6), sz = Math.min(D - front - 1.6, 8.5 + (b.fd - 1) * 4), cz = D / 2 - front - sz / 2;
  facPunch(b, vol(0, cz, sx, sz, 0, 2, 3.2), { wall, frame: 'window_frame_white', winW: 1.2, winH: 1.5, spacing: 2.3, skipGround: true, margin: 0.9 });
  const f = b.faces(0, cz, sx, sz);
  shopFront(b, f.front, -0.4, sx - 2.0, 2.7, { frame: b.pick(['metal_dark', 'paint_black', 'wood_dark']) });
  b.box('trim_dark', 0, 6.4, cz, sx + 0.2, 0.35, sz + 0.2);
  b.prism(b.pick(['roof_tiles_red', 'roof_tiles_anthracite', 'roof_slate']), [[-sz / 2 - 0.3, 0], [sz / 2 + 0.3, 0], [0, Math.min(3.2, sz * 0.4)]], sx + 0.4, 0, 6.75, cz, HP);
  const gf = gfr(0, cz, sx, sz, 'front');
  label(g, gf, b.pick(NAMES.hair), -0.4, 2.85, sx - 2.0, 0.55, { band: b.pick(['trim_dark', 'paint_black', 'paint_white']), mat: b.pick(['sign_white', 'paint_yellow', 'neon_pink']) });
  // Friseursäule
  const [px, pz] = f.front.at(sx / 2 - 0.5, 0.25);
  if (b.d >= 1) for (let k = 0; k < 4; k++) b.cyl(k % 2 ? 'paint_white' : 'paint_red', px, 1.0 + k * 0.25, pz, 0.12, 0.25, { seg: 8, exact: true });
  if (b.d >= 1) b.box('wood_dark', 0, 0, D / 2 - 0.9, 1.6, 0.45, 0.45);
  b.take(0, cz, sx, sz, 0.3);
  b.putTree(0.7, 'laub', { prefer: 'back' });
}

// Wochenmarkt: Marktstände mit bunten Planendächern, Kisten, Lieferwagen
function wochenmarkt(ctx, g) {
  const b = new B(ctx), { W, D } = b;
  b.lot('cobblestone', 0.08);
  const cols = Math.max(2, Math.floor((W - 2) / 4.2)), rowsN = Math.max(1, Math.floor((D - 3) / 5.0));
  for (let r = 0; r < rowsN; r++) for (let c = 0; c < cols; c++) {
    const x = -W / 2 + 1.2 + (c + 0.5) * ((W - 2.4) / cols), z = D / 2 - 2.6 - r * 5.0;
    const can = b.pick(['awning_red', 'awning_striped', 'awning_green', 'awning_blue', 'awning_yellow', 'canvas_white']);
    const w = (W - 2.4) / cols - 0.6, d = 2.4;
    b.box('wood_planks', x, 0.1, z, w, 0.85, d * 0.6);
    if (b.d >= 1) for (const s of [-1, 1]) for (const t of [-1, 1]) b.box('metal_light', x + s * (w / 2 - 0.08), 0.1, z + t * (d / 2 - 0.08), 0.08, 2.3, 0.08);
    b.prism(can, [[-d / 2 - 0.2, 0], [d / 2 + 0.2, 0], [0, 0.7]], w + 0.2, x, 2.4, z, HP);
    crates(b, x, z + d * 0.25, Math.max(2, Math.round(w / 0.7)), 0);
  }
  if (b.d >= 1) b.van(-W / 2 + 3.5, -D / 2 + 1.6, HP, b.pick(['paint_white', 'paint_red', 'paint_green']));
  const p = b.plan.find(1.2, 1.2, { prefer: 'front' });
  const [sx0, sz0] = p ? [p[0], p[1]] : [W / 2 - 1, D / 2 - 0.8];
  b.box('metal_dark', sx0, 0.1, sz0, 0.15, 3.4, 0.15);
  b.box('sign_white', sx0, 2.6, sz0, 1.8, 0.8, 0.12);
  const gf = gfr(sx0, sz0, 1.8, 0.12, 'front');
  label(g, gf, 'MARKT', 0, 2.65, 1.6, 0.7, { mat: 'paint_red', light: false });
  b.tree(W / 2 - 2.2, -D / 2 + 2.2, 0.85);
  if (b.fw * b.fd > 1) b.tree(-W / 2 + 2.2, -D / 2 + 2.6, 0.8);
  b.lamp(0, -D / 2 + 1.0, 5);
}

// Moderne Ladenzeile: eingeschossige Ladenreihe mit durchlaufendem Vordach, Schilder, Parkplätze davor
function ladenzeileModern(ctx, g, P, o = {}) {
  const b = new B(ctx), { W, D } = b;
  b.lot('asphalt', 0.08);
  const n = Math.max(2, Math.round((W - 1) / 5.0)), floors = o.floors ?? 1;
  const sz = Math.min(D * 0.48, 10), sx = W - 1.0, cz = -D / 2 + 0.6 + sz / 2;
  const wall = b.pick(['metal_panel_grey', 'concrete_panel', 'plaster_white', 'terracotta', 'brick_dark', 'metal_panel_white']);
  b.box(wall, 0, 0, cz, sx, 4.2 + (floors - 1) * 3.4, sz);
  if (floors > 1) facRibbon(b, vol(0, cz, sx, sz, 4.2, floors - 1, 3.4), { band: wall, glass: 'glass_window', sides: ['front', 'left', 'right'] });
  const f = b.faces(0, cz, sx, sz), gf = gfr(0, cz, sx, sz, 'front');
  const uw = sx / n;
  for (let i = 0; i < n; i++) {
    const a = -sx / 2 + (i + 0.5) * uw;
    shopFront(b, f.front, a, uw - 0.8, 3.2, { glass: 'glass_shop' });
    label(g, gf, b.pick(SHOP_NAMES), a, 3.45, uw - 1.0, 0.6, { band: b.pick(['trim_dark', 'paint_white', 'paint_blue', 'paint_red', 'paint_teal']), mat: b.pick(['sign_white', 'paint_yellow', 'trim_dark']) });
  }
  b.fbox('metal_light', f.front, 0, 3.3, sx + 0.4, 0.2, 2.0, 0);
  if (b.d >= 1) for (let i = 0; i <= n; i++) b.fbox('metal_dark', f.front, -sx / 2 + (i * sx) / n, 0, 0.15, 3.3, 0.15, 1.8);
  roofOff(b, 0, 4.2 + (floors - 1) * 3.4, cz, sx, sz, { parapet: 0.6, parMat: wall, plant: false });
  const pdep = D / 2 - (cz + sz / 2 + 2.2);
  if (pdep > 5) b.parking(0, D / 2 - pdep / 2, W - 1, pdep - 0.2, { fill: 0.6 });
  b.take(0, cz, sx, sz + 4.0, 0.2);
  b.pylon(W / 2 - 1.0, D / 2 - 0.8, 5.5, b.pick(LOGO));
}

// =====================================================================================
// Stufe 2
// =====================================================================================

// Eckhaus mit Café: abgerundete Ecke, Café mit Markisen über zwei Seiten, Wohnungen darüber
function eckhausCafe(ctx, g, P, o = {}) {
  const b = new B(ctx), { W, D } = b;
  const front = 2.6;
  ground(b, front);
  const n = o.floors ?? (ctx.level >= 3 ? nfl(b, 4, 1) : 3);
  const wall = b.pick(['plaster_cream', 'plaster_ochre', 'plaster_yellow', 'plaster_white', 'stone_sandstone', 'plaster_pink', 'brick_yellow']);
  const band = b.pick(['trim_stone', 'plaster_white']);
  const cx = -0.8, sx = W - 2.2, sz = Math.min(D - front - 1.0, 12 + (b.fd - 1) * 6), cz = D / 2 - front - sz / 2;
  const R = Math.min(sx, sz) * 0.3, seg = b.d >= 2 ? 10 : b.d === 1 ? 7 : 5;
  roundBlock(b, b.pick(['stone_dark', 'trim_dark', 'paint_black']), cx, 0, cz, sx, 4.0, sz, R, { seg });
  roundBlock(b, wall, cx, 4.0, cz, sx - 0.2, n * 3.1, sz - 0.2, R - 0.1, { seg });
  const f = b.faces(cx, cz, sx, sz), fi = b.faces(cx, cz, sx - 0.2, sz - 0.2);
  shopFront(b, f.front, -R / 2, sx - R - 1.2, 3.4, { glass: 'glass_shop', frame: 'metal_dark' });
  shopFront(b, f.right, R / 2, sz - R - 1.2, 3.4, { glass: 'glass_shop', frame: 'metal_dark', door: false });
  if (b.d >= 1) b.cyl('glass_shop', cx + sx / 2 - R, 0.35, cz + sz / 2 - R, R + 0.02, 3.0, { seg, t0: 0, tl: HP, open: true, lit: b.r(), exact: true });
  for (let k = 0; k < n; k++) {
    const y = 4.0 + k * 3.1;
    for (const s of ['front', 'right']) b.winRow(fi[s], s === 'front' ? -fi[s].len / 2 + 0.9 : -fi[s].len / 2 + R + 0.6, s === 'front' ? fi[s].len / 2 - R - 0.6 : fi[s].len / 2 - 0.9, y + 0.8, 1.2, 1.7, { spacing: 2.3, frame: 'window_frame_white', sill: band });
    for (const s of ['back', 'left']) b.winRow(fi[s], -fi[s].len / 2 + 1.0, fi[s].len / 2 - 1.0, y + 0.8, 1.1, 1.5, { spacing: 2.6, frame: 'window_frame_white' });
    if (b.d >= 1) b.cyl(band, cx + sx / 2 - R, y - 0.12, cz + sz / 2 - R, R + 0.02, 0.18, { seg, t0: 0, tl: HP, exact: true });
    if (b.d >= 1 && k > 0) b.fbox(band, fi.front, -R / 2, y - 0.12, sx - R - 0.2, 0.18, 0.08, 0);
  }
  const top = 4.0 + n * 3.1;
  roundBlock(b, band, cx, top, cz, sx + 0.3, 0.5, sz + 0.3, R + 0.15, { seg });
  if (b.d >= 1) b.box('roof_flat_gravel', cx - sx * 0.1, top + 0.5, cz - sz * 0.1, sx * 0.6, 2.4, sz * 0.5);
  const am = b.pick(AWNINGS);
  awn(g, gfr(cx, cz, sx, sz, 'front'), -R / 2, 3.7, sx - R - 1.6, 2.0, am, 'fixed');
  awn(g, gfr(cx, cz, sx, sz, 'right'), R / 2, 3.7, sz - R - 1.6, 1.4, am, 'fixed');
  label(g, gfr(cx, cz, sx - 0.2, sz - 0.2, 'front'), b.pick(NAMES.cafe), -R / 2, 4.15, Math.min(7, sx - R - 2), 0.6, { mat: b.pick(['paint_white', 'roof_copper', 'sign_white']) });
  cafeSeating(g, (cx - R / 2) * MM, (D / 2 - front / 2) * MM, (sx - R - 2) * MM, Math.max(2, Math.round(sx / 3)), { umbrella: b.d >= 2 ? 'canvas_white' : null });
  b.take(cx, cz, sx + 1.6, sz, 0.3);
  b.putTree(0.8, 'laub', { prefer: 'back' });
}

// Markthalle: Backsteinhalle mit Tonnendach, Rundbogenfenster, großes Tor, Stände davor
function markthalle(ctx, g) {
  const b = new B(ctx), { W, D } = b;
  const front = 3.0;
  ground(b, front, 'cobblestone');
  const wall = b.pick(['brick_red', 'brick_clinker', 'brick_yellow', 'brick_brown']);
  const roof = b.pick(['roof_copper', 'roof_metal_grey', 'roof_slate']);
  const big = ctx.level >= 3;
  const sx = W - 1.2, sz = Math.min(D - front - 1.0, (big ? 18 : 12) + (b.fd - 1) * 4), cz = D / 2 - front - sz / 2;
  const h = big ? 7.5 : 5.5;
  b.box(wall, 0, 0, cz, sx, h, sz);
  const f = b.faces(0, cz, sx, sz);
  for (const s of SIDES) b.winRow(f[s], -f[s].len / 2 + 1.2, f[s].len / 2 - 1.2, 1.4, 1.6, h - 3.0, { spacing: 3.0, frame: 'metal_dark', arch: wall === 'brick_yellow' ? 'brick_red' : 'brick_yellow', glass: 'glass_window' });
  // Tonnendach entlang z (Giebelseite mit Halbkreis-Fenster vorne)
  b.hcyl(roof, 0, h, cz, sx / 2 + 0.2, sz + 0.4, 'z', { seg: b.d >= 1 ? 16 : 8 });
  b.box(wall, 0, h - 0.3, cz, sx + 0.3, 0.3, sz + 0.3);
  if (b.d >= 1) b.hcyl('glass_skylight', 0, h + 0.02, cz, sx / 2 * 0.45, sz * 0.8, 'z', { seg: 10 });
  // Tor
  b.fbox('stone_dark', f.front, 0, 0, 4.6, 4.4, 0.4, 0);
  b.fplane('glass_shop', f.front, 0, 0.1, 3.6, 3.8, 0.42, b.r());
  label(g, gfr(0, cz, sx, sz, 'front'), big ? 'MARKTHALLE' : 'MARKT', 0, 4.6, Math.min(sx - 2, 9), 0.9, { band: 'trim_dark', mat: 'sign_white' });
  // Stände vor der Halle
  const nst = Math.max(1, Math.floor((sx - 6) / 4.5));
  for (let i = 0; i < nst; i++) {
    const x = -sx / 2 + 1.6 + i * 4.5;
    if (Math.abs(x) < 3.2) continue;
    b.box('wood_planks', x, 0.12, D / 2 - front / 2, 2.6, 0.8, 1.0);
    b.prism(b.pick(AWNINGS), [[-0.9, 0], [0.9, 0], [0, 0.5]], 2.8, x, 2.2, D / 2 - front / 2, HP);
    if (b.d >= 1) for (const s of [-1, 1]) b.box('metal_light', x + s * 1.25, 0.12, D / 2 - front / 2, 0.07, 2.1, 0.07);
    crates(b, x, D / 2 - front / 2 + 0.6, 3);
  }
  b.take(0, cz, sx, sz, 0.3);
  b.putTree(0.9, 'laub', { prefer: 'back' });
}

// Modehaus: doppelt hohe Schaufenster, darüber Bronze- oder Terrakottahaut, Logo und Schriftzug
function modehaus(ctx, g, P, o = {}) {
  const b = new B(ctx), { W, D } = b;
  const front = 2.4;
  ground(b, front);
  const clad = b.pick(['metal_panel_bronze', 'terracotta', 'stone_sandstone', 'metal_panel_white', 'marble', 'brick_dark']);
  const n = o.floors ?? (ctx.level >= 3 ? nfl(b, 3, 1) : 2);
  const sx = W - 0.8, sz = Math.min(D - front - 1.4, 11 + (b.fd - 1) * 6), cz = D / 2 - front - sz / 2;
  b.box('metal_dark', 0, 0, cz, sx, 6.6, sz);
  const f = b.faces(0, cz, sx, sz);
  shopFront(b, f.front, 0, sx - 1.4, 6.2, { glass: 'glass_shop' });
  if (b.d >= 1) b.fbox('metal_dark', f.front, 0, 3.4, sx - 1.2, 0.3, 0.5, 0);
  const v = vol(0, cz, sx, sz, 6.6, n, 3.6);
  facFins(b, v, { glass: 'glass_window', fin: clad, finSp: 1.0, finD: 0.4, finW: 0.35, sides: ['front', 'left', 'right'], blind: clad });
  b.box(clad, 0, v.top, cz, sx + 0.2, 0.8, sz + 0.2);
  const nm = b.pick(['MODEHAUS', 'MODE', 'BOUTIQUE', 'SCHUHHAUS', 'KAUFHAUS']);
  label(g, gfr(0, cz, sx, sz, 'front'), nm, 0, v.top - 1.6, Math.min(sx - 1, 10), 1.2, { mat: g.neon ? g.neon(b.pick(NEON)) : 'sign_white', maxPx: 0.4 });
  b.take(0, cz, sx, sz, 0.3);
  b.putTree(0.7, 'laub', { prefer: 'front' });
}

// =====================================================================================
// Stufe 3–4
// =====================================================================================

// Boutiquenhäuser: Reihe schmaler, farbiger Stadthäuser (verschiedene Höhen und Giebel) mit Läden im Erdgeschoss
function boutiquen(ctx, g) {
  const b = new B(ctx), { W, D } = b;
  const front = 2.4;
  ground(b, front);
  const n = Math.max(2, Math.round((W - 0.4) / 4.8)), uw = (W - 0.4) / n;
  const sz = Math.min(D - front - 1.2, 12 + (b.fd - 1) * 5), cz = D / 2 - front - sz / 2;
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + 0.2 + (i + 0.5) * uw;
    const wall = b.pick(['plaster_pink', 'plaster_blue', 'plaster_green', 'plaster_yellow', 'plaster_cream', 'plaster_red', 'plaster_ochre', 'brick_red', 'plaster_white']);
    const fl = 3 + b.int(0, 2), top = 4.0 + fl * 3.1;
    b.box(b.pick(['stone_dark', 'trim_dark', 'paint_black', 'wood_dark']), x, 0, cz, uw - 0.02, 4.0, sz);
    facPunch(b, vol(x, cz, uw - 0.02, sz, 4.0, fl, 3.1), { wall, frame: 'window_frame_white', winW: 1.1, winH: 1.8, spacing: 1.9, margin: 0.6, sides: ['front', 'back'], sills: 'trim_stone' });
    const f = b.face(x, cz, uw - 0.02, sz, 'front');
    shopFront(b, f, 0, uw - 1.0, 3.4, { glass: 'glass_shop', frame: b.pick(['metal_dark', 'wood_dark', 'paint_black']) });
    label(g, gfr(x, cz, uw - 0.02, sz, 'front'), b.pick(SHOP_NAMES), 0, 3.5, uw - 1.2, 0.45, { mat: b.pick(['roof_copper', 'paint_white', 'sign_white', 'paint_yellow']) });
    const gable = b.chance(0.55);
    if (gable) b.prism(b.pick(['roof_slate', 'roof_tiles_red', 'roof_tiles_anthracite']), [[-uw / 2, 0], [uw / 2, 0], [0, Math.min(4, uw * 0.7)]], sz, x, top, cz, 0);
    else { b.box(b.pick(['trim_stone', 'plaster_white']), x, top, cz, uw, 0.6, sz); if (b.d >= 1 && b.chance(0.5)) b.box('roof_slate', x, top + 0.6, cz - 0.6, uw - 0.6, 2.2, sz - 2.4); }
    if (b.d >= 1 && b.chance(0.5)) awn(g, gfr(x, cz, uw - 0.02, sz, 'front'), 0, 3.3, uw - 1.2, 1.3, b.pick(AWNINGS), 'roll');
  }
  b.take(0, cz, W, sz, 0.2);
  b.putTree(0.7, 'laub', { prefer: 'back' });
}

// Kaufhaus (klassisch): Natursteinfassade mit Pfeilern, große Schaufenster, Uhr, Fahnen, Kupferdach-Kante
function kaufhausKlassik(ctx, g) {
  const b = new B(ctx), { W, D } = b;
  const front = 3.0;
  ground(b, front);
  const stone = b.pick(['stone_sandstone', 'trim_stone', 'stone_grey', 'marble', 'plaster_cream']);
  const n = nfl(b, ctx.level >= 4 ? 5 : 4, 1);
  const sx = W - 0.6, sz = Math.min(D - front - 0.6, 16 + (b.fd - 1) * 5), cz = D / 2 - front - sz / 2;
  b.box('stone_dark', 0, 0, cz, sx, 5.0, sz);
  const f = b.faces(0, cz, sx, sz);
  const ns = Math.max(2, Math.round(sx / 6));
  for (let i = 0; i < ns; i++) shopFront(b, f.front, -sx / 2 + (i + 0.5) * (sx / ns), sx / ns - 1.2, 4.4, { glass: 'glass_shop', frame: 'metal_dark', door: i === Math.floor(ns / 2) });
  for (const s of ['left', 'right']) shopFront(b, f[s], 0, Math.min(f[s].len - 2, 8), 4.4, { glass: 'glass_shop', door: false });
  const v = vol(0, cz, sx, sz, 5.0, n, 4.0);
  kaufRaster(b, v);
  function kaufRaster(bb, vv) { // Steinfassade mit großen Fenstern (Kaufhausraster)
    bb.box(stone, vv.x, vv.y0, vv.z, vv.sx, vv.n * vv.fh, vv.sz);
    const ff = bb.faces(vv.x, vv.z, vv.sx, vv.sz);
    for (const s of SIDES) for (let k = 0; k < vv.n; k++) bb.winRow(ff[s], -ff[s].len / 2 + 1.2, ff[s].len / 2 - 1.2, vv.y0 + k * vv.fh + 0.8, 2.0, 2.6, { spacing: 3.0, frame: 'metal_dark', glass: 'glass_window', sill: bb.d >= 2 ? 'trim_stone' : null });
  }
  const top = v.top;
  b.box('roof_copper', 0, top, cz, sx + 0.5, 0.9, sz + 0.5);
  b.box('roof_copper', 0, top + 0.9, cz, sx - 1.0, 1.6, sz - 1.0);
  // Uhr über dem Eingang
  if (b.d >= 1) {
    const [ux, uz] = f.front.at(0, 0.12);
    const geoR = 1.0;
    b.cyl('paint_white', ux, top - 2.2, uz, geoR, 0.15, { seg: 16 });
    b.box('trim_dark', ux, top - 1.25, uz + 0.1, 0.08, 0.75, 0.05);
    b.box('trim_dark', ux + 0.25, top - 1.25, uz + 0.1, 0.5, 0.08, 0.05);
  }
  label(g, gfr(0, cz, sx, sz, 'front'), b.pick(NAMES.store), 0, 5.2, Math.min(sx - 4, 14), 1.2, { mat: g.neon ? g.neon(b.pick(['sign_white', 'emissive_red', 'neon_cyan'])) : 'sign_white', maxPx: 0.45 });
  if (b.d >= 1) for (let i = -1; i <= 1; i++) { const [fx, fz] = f.front.at(i * sx * 0.3, 0.2); b.box('metal_light', fx, top + 0.9, fz, 0.1, 5, 0.1); b.box(b.pick(['paint_red', 'paint_blue', 'paint_yellow', 'paint_green']), fx + 0.65, top + 4.4, fz, 1.2, 0.8, 0.04); }
  b.box('metal_panel_grey', 0, top + 2.5, cz - sz * 0.2, sx * 0.3, 2.2, sz * 0.3);
  b.take(0, cz, sx, sz, 0.3);
}

// Passage: zwei Geschäftshäuser, dazwischen eine Ladenstraße mit gläsernem Tonnendach
function passage(ctx, g) {
  const b = new B(ctx), { W, D } = b;
  const front = 2.2;
  ground(b, front);
  const n = nfl(b, ctx.level >= 4 ? 6 : 4, 1);
  const wall = b.pick(['stone_sandstone', 'plaster_cream', 'brick_yellow', 'terracotta', 'concrete_panel']);
  const gw = Math.min(5.0, W * 0.3), bw = (W - 0.6 - gw) / 2;
  const sz = D - front - 0.8, cz = D / 2 - front - sz / 2;
  for (const s of [-1, 1]) {
    const x = s * (gw / 2 + bw / 2);
    b.box('stone_dark', x, 0, cz, bw, 4.4, sz);
    const v = vol(x, cz, bw, sz, 4.4, n, 3.4);
    facPunch(b, v, { wall, frame: 'window_frame_dark', winW: 1.5, winH: 2.0, spacing: 2.3, margin: 0.8 });
    const f = b.face(x, cz, bw, sz, 'front');
    shopFront(b, f, 0, bw - 1.2, 3.8, { glass: 'glass_shop' });
    const fi = b.face(x, cz, bw, sz, s < 0 ? 'right' : 'left');
    const m = Math.max(1, Math.floor(sz / 6));
    for (let i = 0; i < m; i++) shopFront(b, fi, -sz / 2 + (i + 0.5) * (sz / m), sz / m - 1.4, 3.6, { glass: 'glass_shop', door: i % 2 === 0 });
    roofOff(b, x, v.top, cz, bw, sz, { parapet: 0.8, parMat: wall, plant: false });
    label(g, gfr(x, cz, bw, sz, 'front'), b.pick(SHOP_NAMES), 0, 3.95, bw - 1.4, 0.5, { band: 'trim_dark', mat: 'sign_white' });
  }
  // Glasdach (Tonne) über der Passage
  const yh = 4.4 + Math.min(n, 3) * 3.4;
  b.hcyl('glass_skylight', 0, yh, cz, gw / 2, sz, 'z', { seg: b.d >= 1 ? 12 : 6 });
  if (b.d >= 1) { const nr = Math.round(sz / 3); for (let i = 0; i <= nr; i++) b.hcyl('metal_dark', 0, yh, cz - sz / 2 + (i * sz) / nr, gw / 2 + 0.05, 0.15, 'z', { seg: 12, open: true }); }
  b.ground('pavers', 0, cz, gw, sz, 0.14);
  // Eingangsbogen mit Namen
  b.box(wall, 0, 5.5, D / 2 - front - 0.3, gw + 0.4, 1.4, 0.6);
  label(g, gfr(0, D / 2 - front - 0.3, gw + 0.4, 0.6, 'front'), b.pick(NAMES.center), 0, 5.7, gw, 1.0, { mat: 'sign_white' });
  if (b.d >= 1) for (let i = 0; i < 3; i++) b.lamp(0, cz - sz / 2 + 2 + i * (sz - 4) / 2, 3.2);
  b.take(0, cz, W, sz, 0.2);
}

// Hotel: Scheibe mit Lochfassade und farbigem Seitenband, Vorfahrt mit Vordach, senkrechter Leuchtschriftzug
function hotelModern(ctx, g) {
  const b = new B(ctx), { W, D } = b;
  const front = 3.4;
  ground(b, front);
  const wall = b.pick(['plaster_white', 'concrete_panel', 'metal_panel_white', 'brick_white', 'stone_sandstone']);
  const acc = b.pick(['paint_teal', 'metal_panel_bronze', 'terracotta', 'paint_blue', 'paint_red']);
  const n = nfl(b, ctx.level >= 5 ? 14 : 8, 2);
  const sx = W - 1.6, sz = Math.min(D - front - 1.4, 11 + (b.fd - 1) * 3), cz = D / 2 - front - sz / 2;
  lobby(b, 0, cz, sx, sz, 4.8, { glass: 'glass_shop', inset: 0.6, col: wall, canopy: false });
  const v = vol(0, cz, sx, sz, 4.8, n, 3.1);
  facPunch(b, v, { wall, frame: 'window_frame_dark', winW: 1.4, winH: 1.7, spacing: 2.0, margin: 0.8 });
  const f = b.faces(0, cz, sx, sz);
  b.fbox(acc, f.front, -sx / 2 + 1.2, 4.8, 1.6, n * 3.1, 0.3, 0);
  // senkrechter Schriftzug HOTEL
  const word = 'HOTEL';
  if (b.d >= 1) for (let i = 0; i < word.length; i++) {
    const y = v.top - 2.4 - i * 2.1;
    b.fbox('trim_dark', f.front, -sx / 2 + 1.2, y, 1.4, 1.8, 0.2, 0.3);
    label(g, gfr(0, cz + 0.5, sx, sz, 'front'), word[i], -sx / 2 + 1.2, y + 0.15, 1.2, 1.5, { mat: g.neon ? g.neon(b.pick(['neon_pink', 'neon_cyan', 'sign_white', 'emissive_red'])) : 'sign_white', maxPx: 0.3 });
  }
  b.fbox('metal_dark', f.front, 0, 4.4, Math.min(10, sx - 2), 0.4, 3.4, 0);
  if (b.d >= 1) for (const s of [-1, 1]) b.fbox('metal_light', f.front, s * Math.min(4.6, sx / 2 - 1.4), 0, 0.2, 4.4, 0.2, 3.1);
  roofOff(b, 0, v.top, cz, sx, sz, { parapet: 0.9, parMat: wall, plantW: 0.4 });
  label(g, gfr(0, cz, sx, sz, 'front'), b.pick(NAMES.hotel), sx * 0.12, v.top - 0.2, Math.min(sx * 0.6, 9), 1.1, { mat: g.neon ? g.neon('sign_white') : 'sign_white' });
  if (b.d >= 1) b.flags(sx * 0.15, D / 2 - 0.8, 3, 0);
  b.take(0, cz, sx, sz, 0.3);
}

// Kino-Center: geschlossener Kubus mit großen Plakatflächen, Leuchtband und Glasfoyer
function kinocenter(ctx, g) {
  const b = new B(ctx), { W, D } = b;
  const front = 3.2;
  ground(b, front);
  const clad = b.pick(['metal_panel_grey', 'paint_black', 'metal_panel_blue', 'concrete_panel', 'paint_red']);
  const h = ctx.level >= 4 ? 16 : 12;
  const sx = W - 1.0, sz = Math.min(D - front - 0.8, 16 + (b.fd - 1) * 4), cz = D / 2 - front - sz / 2;
  b.box(clad, 0, 0, cz, sx, h, sz);
  const f = b.faces(0, cz, sx, sz);
  // Glasfoyer vorne über zwei Geschosse
  const fw = Math.min(sx - 2, 12);
  b.fbox('metal_dark', f.front, 0, 0, fw + 0.4, 7.6, 1.6, 0);
  b.fplane('glass_shop', f.front, 0, 0.3, fw, 6.8, 1.62, b.r());
  if (b.d >= 1) for (let i = 0; i <= 5; i++) b.fbox('metal_dark', f.front, -fw / 2 + (i * fw) / 5, 0, 0.12, 7.4, 0.12, 1.6);
  // Plakatflächen (bunt, leuchtend) seitlich
  const posters = ['neon_pink', 'neon_cyan', 'neon_yellow', 'emissive_warm', 'paint_red', 'paint_blue'];
  const np = Math.max(2, Math.round((sx - fw) / 3));
  for (let i = 0; i < np; i++) {
    const a = (i % 2 ? 1 : -1) * (fw / 2 + 1.0 + Math.floor(i / 2) * 2.4);
    if (Math.abs(a) > sx / 2 - 1) continue;
    b.fbox('trim_dark', f.front, a, 2.0, 1.8, 2.8, 0.1, 0);
    b.fplane(b.pick(posters), f.front, a, 2.1, 1.6, 2.6, 0.12);
  }
  // Leuchtband und Schriftzug
  b.fbox('emissive_cool', f.front, 0, h - 1.4, sx, 0.25, 0.1, 0);
  label(g, gfr(0, cz, sx, sz, 'front'), b.pick(NAMES.kino), 0, 8.6, Math.min(sx - 2, 14), 2.2, { mat: g.neon ? g.neon(b.pick(NEON)) : 'sign_white', maxPx: 0.5 });
  roofOff(b, 0, h, cz, sx, sz, { parapet: 0.6, parMat: clad, plant: false });
  if (b.d >= 1) b.hvac(sx * 0.25, h, cz - sz * 0.2, 1.2);
  b.take(0, cz, sx, sz, 0.3);
}

// =====================================================================================
// Stufe 5
// =====================================================================================

// Hotelturm mit Spitze: Glasschaft mit Fensterbändern, oben Leuchtkrone mit Schriftzug, Nadel
function hotelSpitze(ctx, g) {
  const b = new B(ctx), { W, D } = b;
  const front = 2.4;
  ground(b, front);
  const glass = b.pick(GLASS), band = b.pick(['metal_panel_white', 'stone_sandstone', 'concrete_panel', 'metal_light']);
  const sx = W - 1.2, sz = Math.min(D - front - 0.8, 14), cz = D / 2 - front - sz / 2;
  lobby(b, 0, cz, sx, sz, 6.0, { glass: 'glass_shop', inset: 0.6, col: band });
  const n = nfl(b, 24, 4), s = Math.min(sx, sz) * 0.95;
  const v = vol(0, cz, s, s, 6.0, n, 3.2);
  facRibbon(b, v, { band, glass, winH: 3.2 * 0.6 });
  b.box(band, 0, v.top, cz, s + 0.4, 0.6, s + 0.4);
  const cr = vol(0, cz, s * 0.86, s * 0.86, v.top + 0.6, 2, 3.4);
  facCurtain(b, cr, { glass: 'glass_curtain_gold', frame: 'metal_dark' });
  b.box('emissive_warm', 0, cr.top, cz, s * 0.9, 0.3, s * 0.9);
  label(g, gfr(0, cz, s * 0.86, s * 0.86, 'front'), 'HOTEL', 0, cr.y0 + 1.6, s * 0.8, 2.2, { mat: g.neon ? g.neon('sign_white') : 'sign_white', depth: 0.1, maxPx: 0.5 });
  b.cone('metal_light', 0, cr.top + 0.3, cz, s * 0.3, 4, { seg: 8 });
  b.cyl('metal_light', 0, cr.top + 4.0, cz, 0.12, 9, { seg: 6, exact: true, rTop: 0.04 });
  b.light(0, cr.top + 13.2, cz, 0xff2a20, 0.32);
  const f = b.faces(0, cz, sx, sz);
  b.fbox('metal_dark', f.front, 0, 5.4, Math.min(11, sx - 2), 0.4, front - 0.4, 0);
  if (b.d >= 1) b.flags(-sx * 0.25, D / 2 - 0.8, 3, 0);
  b.take(0, cz, sx, sz, 0.3);
}

// Mall mit Turm: dreigeschossiger Einkaufssockel mit Leuchtbändern, Büro-/Hotelturm auf einer Ecke
function mallturm(ctx, g) {
  const b = new B(ctx), { W, D } = b;
  const front = 3.0;
  ground(b, front);
  const clad = b.pick(['metal_panel_white', 'terracotta', 'concrete_panel', 'metal_panel_bronze', 'stone_sandstone']);
  const glass = b.pick(GLASS);
  const sx = W - 0.6, sz = D - front - 0.6, cz = D / 2 - front - sz / 2;
  b.box(clad, 0, 0, cz, sx, 13.0, sz);
  const f = b.faces(0, cz, sx, sz);
  shopFront(b, f.front, 0, Math.min(sx - 2, 12), 5.0, { glass: 'glass_shop' });
  for (const s of ['left', 'right']) shopFront(b, f[s], 0, Math.min(f[s].len - 2, 8), 4.4, { glass: 'glass_shop', door: false });
  for (const y of [5.6, 9.4]) for (const s of SIDES) b.fplane(b.d >= 1 ? 'emissive_cool' : 'sign_white', f[s], 0, y, f[s].len - 1.0, 0.25, 0.03);
  label(g, gfr(0, cz, sx, sz, 'front'), b.pick(NAMES.center), 0, 6.4, Math.min(sx - 2, 14), 2.2, { mat: g.neon ? g.neon(b.pick(NEON)) : 'sign_white', maxPx: 0.5 });
  b.box('roof_flat_membrane', 0, 13.0, cz, sx - 0.2, 0.2, sz - 0.2);
  const small = b.fw * b.fd < 2, side = b.chance(0.5) ? 1 : -1, ts = small ? Math.min(sx, sz) - 1.0 : Math.min(sx * 0.48, sz * 0.7, 12);
  const tx = small ? 0 : side * (sx / 2 - ts / 2 - 0.4), tz = small ? cz : cz - sz / 2 + ts / 2 + 0.4;
  const v = vol(tx, tz, ts, ts, 13.2, nfl(b, 20, 4));
  facCurtain(b, v, { glass, frame: 'metal_dark' });
  b.box('metal_dark', tx, v.top, tz, ts + 0.2, 1.0, ts + 0.2);
  if (b.d >= 1) b.box(b.pick(['emissive_cool', 'emissive_warm']), tx, v.top + 1.0, tz, ts * 0.7, 0.3, ts * 0.7);
  antenna(b, tx, v.top + 1.0, tz, 8);
  if (b.d >= 1) b.hvac(-side * sx * 0.25, 13.2, cz, 1.4);
  b.take(0, cz, sx, sz, 0.3);
}

// Leuchtturm-Geschäftshaus: schlanker Turm mit senkrechten LED-Lamellen, die nachts farbig leuchten
function ledturm(ctx, g) {
  const b = new B(ctx), { W, D } = b;
  const front = 2.4;
  ground(b, front);
  const glass = b.pick(['glass_curtain_dark', 'glass_curtain_blue', 'glass_curtain_dark']);
  const led = b.pick(['neon_cyan', 'neon_pink', 'emissive_cool', 'neon_yellow']);
  const sx = W - 1.2, sz = Math.min(D - front - 0.6, 13), cz = D / 2 - front - sz / 2;
  lobby(b, 0, cz, sx, sz, 5.2, { glass: 'glass_shop', inset: 0.6, col: 'metal_dark' });
  const s = Math.min(sx, sz) * 0.92, n = nfl(b, 24, 4);
  const v = vol(0, cz, s, s, 5.2, n);
  facCurtain(b, v, { glass, frame: 'metal_dark' });
  const fs = b.faces(0, cz, s, s);
  const m = Math.max(3, Math.round(s / 1.8));
  for (const sd of SIDES) for (let i = 0; i <= m; i++) {
    const a = -s / 2 + 0.1 + (i * (s - 0.2)) / m;
    b.fbox('metal_dark', fs[sd], a, v.y0, 0.25, n * FH, 0.5, 0);
    if (b.d >= 1 && i % 2 === 0) b.fbox(led, fs[sd], a, v.y0 + 0.5, 0.1, n * FH - 1.0, 0.06, 0.5);
  }
  b.box('metal_dark', 0, v.top, cz, s + 0.4, 2.0, s + 0.4);
  label(g, gfr(0, cz, s + 0.4, s + 0.4, 'front'), b.pick(['CENTER', 'PULS', 'FORUM', 'GALERIE', 'PLAZA']), 0, v.top + 0.2, s * 0.9, 1.6, { mat: g.neon ? g.neon(led) : led, maxPx: 0.45 });
  antenna(b, 0, v.top + 2.0, cz, 10);
  b.take(0, cz, sx, sz, 0.3);
}

// Gestuftes Kaufhaus-Hochhaus: drei Kaufhausgeschosse, darüber ein gestufter Turm mit Terrassen
function kaufhausturm(ctx, g) {
  const b = new B(ctx), { W, D } = b;
  const front = 3.0;
  ground(b, front);
  const stone = b.pick(['stone_sandstone', 'marble', 'stone_grey', 'terracotta', 'concrete_panel']);
  const sx = W - 0.6, sz = D - front - 0.6, cz = D / 2 - front - sz / 2;
  b.box('stone_dark', 0, 0, cz, sx, 5.0, sz);
  const f = b.faces(0, cz, sx, sz);
  const ns = Math.max(2, Math.round(sx / 6));
  for (let i = 0; i < ns; i++) shopFront(b, f.front, -sx / 2 + (i + 0.5) * (sx / ns), sx / ns - 1.2, 4.4, { glass: 'glass_shop', door: i === Math.floor(ns / 2) });
  facGrid(b, vol(0, cz, sx, sz, 5.0, 2, 4.2), { frame: stone, glass: 'glass_window', bay: 2.6, topH: 0.8 });
  label(g, gfr(0, cz, sx, sz, 'front'), b.pick(NAMES.store), 0, 5.4, Math.min(sx - 2, 14), 1.4, { mat: g.neon ? g.neon(b.pick(['sign_white', 'emissive_red'])) : 'sign_white', maxPx: 0.45 });
  let y = 5.0 + 2 * 4.2 + 0.8, s1x = sx * 0.8, s1z = sz * 0.75;
  const n = nfl(b, 20, 3);
  for (const p of [0.5, 0.3, 0.2]) {
    const v = vol(0, cz - (sz - s1z) * 0.3, s1x, s1z, y, Math.max(3, Math.round(n * p)), 3.4);
    facGrid(b, v, { frame: stone, glass: b.pick(GLASS), bay: 1.8, topH: 0.6 });
    y = v.top + 0.6;
    b.box('green_roof', 0, y, v.z, s1x, 0.2, s1z);
    s1x *= 0.78; s1z *= 0.8;
  }
  b.box('metal_panel_grey', 0, y + 0.2, cz - sz * 0.15, s1x * 0.8, 2.6, s1z * 0.7);
  antenna(b, 0, y + 2.8, cz - sz * 0.15, 6);
  b.take(0, cz, sx, sz, 0.3);
}

const L = (fn, o) => (c, g, P) => fn(c, g, P, o);
export const COM_NEW = {
  1: { '1x1': [eckcafe, friseur], '2x1': [wochenmarkt, ladenzeileModern], '1x2': [eckcafe, friseur], '2x2': [wochenmarkt, ladenzeileModern] },
  2: { '1x1': [eckhausCafe, modehaus], '2x1': [markthalle, L(ladenzeileModern, { floors: 2 })], '1x2': [eckhausCafe, modehaus], '2x2': [markthalle, eckhausCafe] },
  3: { '*': [markthalle, L(eckhausCafe, { floors: 5 }), boutiquen, kaufhausKlassik] },
  4: { '*': [passage, hotelModern, kinocenter, kaufhausKlassik] },
  5: { '*': [hotelSpitze, mallturm, ledturm, kaufhausturm] },
};
void PI; void facRibbon; void parasol;
