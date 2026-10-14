// Weitere Bürogebäude und Wolkenkratzer (Zone 'off'). Ergänzt die Archetypen aus indoff_off.js je Stufe.
// Maße in Metern (1 Feld = 10 m), Front (Straße) nach +z. ctx.hf = Höhenfaktor der Durchmischung (mix.js).
// Stufe 1: Klinkerkontor mit Treppengiebel, Praxishaus mit Holzobergeschoss, Glaswürfel mit Dachgarten
// Stufe 2: Klinker-Bürohaus mit Glasstaffel, Holz-Hybridbau mit Lamellen, Rundbau
// Stufe 3: Bürocampus mit Glasbrücke, Wellenhaus, Rasterwürfel mit Pergola, Zwillingsriegel
// Stufe 4: Art-déco-Steinturm, Pultdachturm, Kreuzturm, Turm auf Sockelbau
// Stufe 5: Nadelturm, Kronenspitze, Splitter, Zwillingstürme mit Himmelsbrücke, Kristallturm, Hubschrauber-
//          Scheibe, Stufenpyramide mit Dachgärten
import { PI, LOGO } from './indoff_parts.js';
import { SIDES, FH, GLASS, geom, vol, facRibbon, facCurtain, facGrid, facPunch, facPiers, facFins, roofOff, lobby, plaza, antenna, greenery, bikes } from './indoff_off.js';

const STONE = ['stone_sandstone', 'stone_grey', 'concrete_panel', 'marble', 'trim_stone'];
const fpF = (b) => (b.fw * b.fd >= 4 ? 1.25 : b.fw * b.fd >= 2 ? 1.1 : 0.95);
const floors = (b, base, rnd = 3) => Math.max(3, Math.round(base * fpF(b) * (b.ctx.hf || 1)) + b.int(0, rnd));
// Warnlicht / Leuchtband
const warn = (b, x, y, z) => b.light(x, y, z, 0xff2a20, 0.32);
function glowBand(b, mat, x, y, z, sx, sz, h = 0.22) { if (b.d >= 1) b.box(mat, x, y, z, sx + 0.06, h, sz + 0.06); }
// Spitze: Kegel + Nadel + Warnlicht
function spire(b, x, y, z, r, h, mat = 'metal_light') {
  b.cone(mat, x, y, z, r, h * 0.55, { seg: 8 });
  b.cyl(mat, x, y + h * 0.5, z, r * 0.18, h * 0.5, { seg: 6, exact: true, rTop: 0.05 });
  warn(b, x, y + h + 0.2, z);
}
// Satteldach als Prisma (First quer zur Straße: Giebel zeigt nach vorne)
function gable(b, mat, x, y, z, sx, sz, h) { b.prism(mat, [[-sx / 2 - 0.3, 0], [sx / 2 + 0.3, 0], [0, h]], sz + 0.4, x, y, z, 0); }

// =====================================================================================
// Stufe 1
// =====================================================================================

// Klinkerkontor: drei Geschosse Backstein, Treppengiebel zur Straße, Messingschild
function stadtkontor(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const wall = b.pick(['brick_red', 'brick_clinker', 'brick_dark', 'brick_brown', 'brick_clinker']);
  const trim = b.pick(['trim_stone', 'plaster_white', 'stone_sandstone']);
  const n = b.chance(0.5) ? 3 : 2, fh = 3.3, pl = 0.4;
  const sx = Math.min(W - 1.6, 8.6 + (b.fw - 1) * 4), sz = Math.min(D - 3.2, 9.0 + (b.fd - 1) * 5);
  const pz = -Z + 0.8 + sz / 2, top = pl + n * fh;
  b.box('stone_dark', 0, 0, pz, sx + 0.1, pl, sz + 0.1);
  facPunch(b, vol(0, pz, sx, sz, pl, n, fh), { wall, frame: 'window_frame_white', winW: 1.2, winH: 1.85, spacing: 2.3, sills: trim, lintel: b.d >= 2 ? trim : null, skipGround: true, margin: 1.0 });
  const f = b.faces(0, pz, sx, sz), ff = f.front;
  for (const s of [-1, 1]) b.winRow(ff, s > 0 ? 1.3 : -sx / 2 + 0.9, s > 0 ? sx / 2 - 0.9 : -1.3, pl + 0.9, 1.3, 1.9, { spacing: 2.3, frame: 'window_frame_white', sill: trim });
  for (const s of ['back', 'left', 'right']) b.winRow(f[s], -f[s].len / 2 + 1.0, f[s].len / 2 - 1.0, pl + 0.9, 1.2, 1.7, { spacing: 2.6, frame: 'window_frame_white' });
  b.door(ff, 0, { mat: 'door_wood', w: 1.6, h: 2.6, frame: trim, canopy: false });
  if (b.d >= 1) b.box(trim, 0, top - 0.3, pz, sx + 0.2, 0.3, sz + 0.2);
  // Satteldach + Treppengiebel vorne
  const rh = Math.min(sx * 0.55, 5.0), roof = b.pick(['roof_slate', 'roof_tiles_red', 'roof_tiles_anthracite']);
  gable(b, roof, 0, top, pz, sx, sz, rh);
  const steps = 5, sw = sx / (steps * 2 - 1);
  for (let k = 0; k < steps; k++) {
    const w = sx - k * 2 * sw;
    b.fbox(wall, ff, 0, top + (k * rh) / steps, w, rh / steps + 0.25, 0.45, -0.45);
    if (b.d >= 2) b.fbox(trim, ff, 0, top + ((k + 1) * rh) / steps + 0.25, w + 0.1, 0.12, 0.5, -0.47);
  }
  if (b.d >= 1) b.winRow(ff, -0.7, 0.7, top + 0.6, 0.9, 1.2, { spacing: 1.4, frame: 'window_frame_white' });
  b.sign(ff, 0, pl + 2.85, Math.min(3.4, sx * 0.4), 0.45, { bg: 'trim_dark', logo: 'roof_copper', text: 'paint_yellow' });
  b.take(0, pz, sx, sz, 0.3);
  plaza(b, pz + sz / 2, { trees: true });
  if (b.fd > 1 || b.fw > 1) { for (let i = 0; i < 2 * b.fw; i++) b.putCar({ prefer: 'front' }); }
  greenery(b, 1);
}

// Praxis-/Kanzleihaus: verputztes Erdgeschoss mit Bandfenstern, auskragendes Obergeschoss mit Holz- oder Metallhaut
function praxishaus(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const clad = b.pick(['wood_planks', 'wood_dark', 'metal_panel_bronze', 'terracotta', 'metal_panel_grey']);
  const base = b.pick(['plaster_white', 'plaster_grey', 'concrete_panel']);
  const sx = Math.min(W - 2.0, 11 + (b.fw - 1) * 6), sz = Math.min(D - 4.4, 8.0 + (b.fd - 1) * 5), pz = -Z + 0.8 + sz / 2;
  const out = 1.4, upper = b.chance(0.5) ? 2 : 1;
  facRibbon(b, vol(0, pz, sx, sz, 0, 1, 3.5), { band: base, glass: 'glass_window', winH: 1.9 });
  const uz = pz + out / 2, usz = sz + out;
  facRibbon(b, vol(0, uz, sx + 0.4, usz, 3.5, upper, 3.3), { band: clad, glass: 'glass_window', winH: 1.5, mull: 1.1 });
  const top = 3.5 + upper * 3.3;
  roofOff(b, 0, top, uz, sx + 0.4, usz, { parapet: 0.4, parMat: clad, plant: false, roofMat: b.chance(0.5) ? 'green_roof' : 'roof_flat_gravel' });
  const ff = b.faces(0, pz, sx, sz).front, fu = b.faces(0, uz, sx + 0.4, usz).front;
  b.entrance(ff, -sx / 4, 2.0, 2.6, { canopy: 'metal_dark', canopyD: 0.6 });
  b.sign(fu, sx / 4, 3.5 + 0.2, Math.min(3.6, sx * 0.35), 0.6, { logo: b.pick(['paint_green', 'paint_blue', 'paint_red']), disc: b.chance(0.5) });
  if (b.d >= 1) for (let i = 0; i < 3; i++) b.box('metal_dark', -sx / 2 + 0.5 + i * (sx - 1) / 2, 0, pz + sz / 2 + out - 0.2, 0.18, 3.5, 0.18);
  b.take(0, uz, sx + 0.4, usz, 0.3);
  plaza(b, pz + sz / 2 + out, { trees: true });
  for (let i = 0; i < b.fw + b.fd - 1; i++) b.putCar({ prefer: 'back' });
  greenery(b, 2);
}

// Glaswürfel: zwei bis drei Geschosse Vorhangfassade, Dachterrasse mit Pergola und Pflanzkübeln
function glaswuerfel(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const glass = b.pick(GLASS), frame = b.pick(['metal_dark', 'metal_light', 'trim_dark']);
  const s = Math.min(W - 2.4, D - 3.6, 9.5 + (Math.min(b.fw, b.fd) - 1) * 5);
  const sx = Math.min(W - 2.4, s * (b.fw > b.fd ? 1.5 : 1)), sz = Math.min(D - 3.6, s * (b.fd > b.fw ? 1.4 : 1));
  const pz = -Z + 1.0 + sz / 2, n = b.chance(0.5) ? 3 : 2;
  b.box('concrete_dark', 0, 0, pz, sx + 0.3, 0.3, sz + 0.3);
  const v = vol(0, pz, sx, sz, 0.3, n, 3.4);
  facCurtain(b, v, { glass, frame, col: 1.25 });
  b.box(frame, 0, v.top, pz, sx + 0.2, 0.5, sz + 0.2);
  b.box('wood_deck', 0, v.top + 0.5, pz, sx - 0.6, 0.06, sz - 0.6);
  if (b.d >= 1) {
    // Pergola über der halben Dachfläche
    const px = -sx / 4, pw = sx / 2 - 0.4;
    for (const cx of [-1, 1]) for (const cz of [-1, 1]) b.box('metal_dark', px + cx * (pw / 2 - 0.1), v.top + 0.5, pz + cz * (sz / 2 - 0.6), 0.14, 2.5, 0.14);
    const nb = Math.round(pw / 0.6);
    for (let i = 0; i <= nb; i++) b.box(b.d >= 2 ? 'wood_planks' : 'metal_dark', px - pw / 2 + (i * pw) / nb, v.top + 2.95, pz, 0.12, 0.12, sz - 1.0);
    for (const cx of [0.2, 0.4]) { b.box('concrete', sx * cx, v.top + 0.5, pz + sz * 0.25, 0.9, 0.6, 0.9); b.sphere('leaves_green', sx * cx, v.top + 1.3, pz + sz * 0.25, 0.6, { seg: 6 }); }
    if (b.d >= 2) b.roofRail(0, v.top + 0.5, pz, sx, sz);
  }
  const ff = b.faces(0, pz, sx, sz).front;
  b.entrance(ff, 0, 2.2, 2.7, { glass, canopy: frame });
  b.sign(ff, 0, 0.3 + 3.4 - 0.05, Math.min(4, sx * 0.45), 0.55, { logo: b.pick(LOGO) });
  b.take(0, pz, sx, sz, 0.3);
  plaza(b, pz + sz / 2, { trees: true });
  greenery(b, 2);
  if (b.fw > 1 || b.fd > 1) for (let i = 0; i < 3; i++) b.putCar({ prefer: 'back' });
}

// =====================================================================================
// Stufe 2
// =====================================================================================

// Klinker-Bürohaus: Pfeilerfassade aus Backstein, zurückgesetztes Glasgeschoss mit Dachterrasse
function klinkerbuero(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const wall = b.pick(['brick_clinker', 'brick_red', 'brick_dark', 'brick_brown']);
  const psx = W - 1.4, psz = Math.min(D - 3.0, 11 + (b.fd - 1) * 6), pz = -Z + 0.7 + psz / 2;
  const n = 3 + b.int(0, 1);
  b.box('stone_dark', 0, 0, pz, psx + 0.1, 0.5, psz + 0.1);
  lobby(b, 0, pz, psx, psz, 4.2, { glass: 'glass_window', inset: 0.5, col: wall, canopyMat: 'metal_dark' });
  const v = vol(0, pz, psx, psz, 4.2, n, 3.4);
  facPiers(b, v, { wall, sp: 1.6, glass: 'glass_window', spandrel: 'brick_dark' });
  b.box('trim_stone', 0, v.top, pz, psx + 0.2, 0.4, psz + 0.2);
  const s = vol(0, pz - 0.8, psx - 2.4, psz - 2.4, v.top + 0.4, 1, 3.4);
  facCurtain(b, s, { glass: b.pick(GLASS), frame: 'metal_dark' });
  b.box('metal_dark', 0, s.top, s.z, s.sx + 0.3, 0.45, s.sz + 0.3);
  b.box('wood_deck', 0, v.top + 0.4, pz, psx - 0.4, 0.05, psz - 0.4);
  if (b.d >= 1) b.roofRail(0, v.top + 0.4, pz, psx, psz);
  if (b.d >= 1) b.vents(0, s.top + 0.45, s.z, s.sx * 0.5, s.sz * 0.4, 2);
  const ff = b.faces(0, pz, psx, psz).front;
  b.sign(ff, 0, v.top - 1.5, Math.min(5.5, psx * 0.45), 0.8, { bg: 'trim_dark', logo: 'roof_copper', text: 'trim_stone' });
  b.take(0, pz, psx, psz, 0.3);
  plaza(b, pz + psz / 2, { trees: true });
  greenery(b, 1);
}

// Holz-Hybridbau: Vorhangfassade mit Holzlamellen, begrüntes Dach mit Solarfeld
function holzhybrid(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const psx = W - 1.6, psz = Math.min(D - 3.2, 10.5 + (b.fd - 1) * 6), pz = -Z + 0.8 + psz / 2;
  const n = 4 + b.int(0, 1), fin = b.pick(['wood_planks', 'wood_dark', 'wood_planks']);
  b.box('concrete', 0, 0, pz, psx + 0.1, 0.3, psz + 0.1);
  const v = vol(0, pz, psx, psz, 0.3, n, 3.3);
  facFins(b, v, { glass: 'glass_window', frame: 'wood_dark', fin, finSp: 0.9, finD: 0.45, finW: 0.14 });
  // Holzdecke-Bänder je Geschoss (gut sichtbar aus der Ferne)
  for (let k = 1; k <= n; k++) b.box(fin, 0, 0.3 + k * 3.3 - 0.25, pz, psx + 0.5, 0.25, psz + 0.5);
  b.box('green_roof', 0, v.top, pz, psx + 0.4, 0.3, psz + 0.4);
  if (b.d >= 1) b.solar(psx * 0.15, v.top + 0.3, pz - psz * 0.1, psx * 0.5, psz * 0.55);
  const ff = b.faces(0, pz, psx, psz).front;
  b.entrance(ff, -psx * 0.2, 2.4, 2.6, { canopy: fin });
  b.sign(ff, psx * 0.22, 3.4, Math.min(4.2, psx * 0.32), 0.6, { logo: 'paint_green', bg: 'sign_white' });
  b.take(0, pz, psx, psz, 0.3);
  plaza(b, pz + psz / 2, { trees: true });
  const p = b.plan.find(3.0, 1.8, { prefer: 'front', pad: 0 });
  if (p) bikes(b, p[0], p[1], 4);
  greenery(b, 2);
}

// Rundbau: zylindrischer Bürobau mit umlaufenden Fensterbändern und Technik-Laterne
function rundbau(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const band = b.pick(['concrete_panel', 'metal_panel_white', 'plaster_white', 'terracotta']);
  const glass = b.pick(['glass_window', 'glass_curtain_blue', 'glass_curtain_dark']);
  const r = Math.min(W - 2.4, D - 4.0) * 0.5, pz = -Z + 1.0 + r, n = 4 + b.int(0, 1);
  const seg = b.d >= 2 ? 20 : b.d === 1 ? 14 : 10;
  b.cyl('concrete_dark', 0, 0, pz, r + 0.15, 0.3, { seg, exact: true });
  b.cyl('metal_dark', 0, 0.3, pz, r - 0.2, n * 3.4, { seg, exact: true });
  for (let k = 0; k < n; k++) {
    const y = 0.3 + k * 3.4;
    b.cyl(band, 0, y, pz, r, 1.2, { seg, exact: true, open: true });
    b.cyl(glass, 0, y + 1.2, pz, r - 0.12, 2.2, { seg, exact: true, open: true, lit: b.r() });
  }
  const top = 0.3 + n * 3.4;
  b.cyl(band, 0, top, pz, r + 0.1, 0.6, { seg, exact: true });
  b.cyl('metal_panel_grey', 0, top + 0.6, pz, r * 0.45, 2.4, { seg: 10 });
  if (b.d >= 1) b.cyl('emissive_warm', 0, top + 3.0, pz, r * 0.46, 0.2, { seg: 10 });
  const ff = b.face(0, pz, 2 * r, 2 * r, 'front');
  b.fbox('metal_dark', ff, 0, 0, 3.4, 3.2, 1.2, -0.4);
  b.fplane('glass_window', ff, 0, 0.1, 2.6, 2.6, 0.82);
  b.fbox('metal_light', ff, 0, 3.2, 4.4, 0.25, 2.2, -0.4);
  b.sign(ff, 0, top - 1.3, 3.6, 0.7, { logo: b.pick(LOGO), disc: true });
  b.takeC(0, pz, r, 0.3);
  plaza(b, pz + r, { trees: true });
  greenery(b, 3);
}

// =====================================================================================
// Stufe 3
// =====================================================================================

// Bürocampus: zwei Riegel unterschiedlicher Höhe (hintereinander um einen grünen Hof oder nebeneinander), Glasbrücke
function campus(b) {
  const { W, D, Z } = geom(b);
  b.lot('grass', 0.1);
  const band = b.pick(['concrete_panel', 'metal_panel_white', 'terracotta', 'stone_sandstone']);
  const glass = b.pick(GLASS);
  const n1 = floors(b, 8, 2), n2 = Math.max(3, n1 - 3 - b.int(0, 1));
  const yb = 2 * FH;
  let blocks, front;
  if (b.fd >= 2) {
    const dz = Math.min(8, D * 0.32), bz = -Z + 0.6 + dz / 2, fz = Z - 3.0 - dz / 2, wide = b.fw > 1;
    blocks = [{ x: wide ? -W * 0.06 : 0, z: bz, sx: W - (wide ? W * 0.24 : 1.4), sz: dz, n: n1, t: 'ribbon' }, { x: wide ? W * 0.1 : 0, z: fz, sx: W - (wide ? W * 0.32 : 3.0), sz: dz, n: n2, t: 'grid' }];
    front = blocks[1];
    const bl = fz - bz - dz, bx = wide ? 0 : -W * 0.15, bw = 3.0;
    if (bl > 0.5) {
      b.box('metal_dark', bx, yb, (bz + fz) / 2, bw + 0.2, 0.3, bl + 0.2);
      b.box('metal_dark', bx, yb + FH - 0.3, (bz + fz) / 2, bw + 0.2, 0.3, bl + 0.2);
      for (const s of [-1, 1]) b.plane(glass, bx + s * (bw / 2), yb + FH / 2, (bz + fz) / 2, bl, FH - 0.6, s * PI / 2, b.r());
    }
  } else {
    const gap = b.fw > 1 ? 3.4 : 1.4, bw = (W - 1.4 - gap) / 2, sz = D - 3.6, z = -Z + 0.6 + sz / 2, left = b.chance(0.5);
    blocks = [{ x: -gap / 2 - bw / 2, z, sx: bw, sz, n: left ? n1 : n2, t: left ? 'ribbon' : 'grid' }, { x: gap / 2 + bw / 2, z, sx: bw, sz, n: left ? n2 : n1, t: left ? 'grid' : 'ribbon' }];
    front = blocks[left ? 1 : 0];
    const dd = Math.min(3.0, sz - 1.0);
    b.box('metal_dark', 0, yb, z, gap + 0.2, 0.3, dd + 0.2);
    b.box('metal_dark', 0, yb + FH - 0.3, z, gap + 0.2, 0.3, dd + 0.2);
    for (const s of [-1, 1]) b.plane(glass, 0, yb + FH / 2, z + s * dd / 2, gap, FH - 0.6, s > 0 ? 0 : PI, b.r());
  }
  for (const k of blocks) {
    const v = vol(k.x, k.z, k.sx, k.sz, 0, k.n);
    if (k.t === 'ribbon') facRibbon(b, v, { band, glass: 'glass_window' });
    else facGrid(b, v, { frame: band, glass, topH: 0.6 });
    roofOff(b, k.x, v.top + (k.t === 'grid' ? 0.6 : 0), k.z, k.sx, k.sz, { parapet: 0.6, parMat: band, plant: k.n === n1, roofMat: 'green_roof' });
    b.take(k.x, k.z, k.sx, k.sz, 0.2);
  }
  const ff = b.faces(front.x, front.z, front.sx, front.sz).front;
  b.entrance(ff, 0, Math.min(3.0, front.sx - 1.2), 2.8, { glass });
  b.sign(ff, 0, (front.n - 1) * FH + 0.6, Math.min(6, front.sx * 0.6), 0.8, { logo: b.pick(LOGO) });
  b.ground('pavers', 0, Z - 1.2, W - 0.4, 2.2, 0.12);
  greenery(b, b.fw * b.fd >= 2 ? 5 : 2);
}

// Wellenhaus: gläserner Kern, Geschossplatten springen wellenförmig vor und zurück
function wellenhaus(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const slab = b.pick(['concrete_panel', 'metal_panel_white', 'plaster_white']);
  const glass = b.pick(['glass_curtain_blue', 'glass_curtain_green', 'glass_window', 'glass_curtain_dark']);
  const psx = W - 3.0, psz = Math.min(D - 4.6, 11 + (b.fd - 1) * 6), pz = -Z + 1.4 + psz / 2;
  const n = floors(b, 7, 2), ph = b.r() * PI;
  const v = vol(0, pz, psx, psz, 0, n);
  facCurtain(b, v, { glass, frame: 'metal_dark', col: 1.6 });
  for (let k = 1; k <= n; k++) {
    const off = Math.sin(k * 0.9 + ph) * 0.6, offz = Math.cos(k * 0.7 + ph) * 0.4;
    const y = k * FH - 0.18;
    b.box(slab, off, y, pz + offz, psx + 1.2, 0.36, psz + 1.2);
    // Glasbrüstung vorne
    if (b.d >= 2 && k < n) b.box('glass_railing', off, y + 0.36, pz + offz + psz / 2 + 0.56, psx + 1.1, 0.9, 0.05);
  }
  b.box('metal_panel_grey', 0, n * FH + 0.18, pz, psx * 0.4, 2.4, psz * 0.4);
  const ff = b.faces(0, pz, psx, psz).front;
  b.entrance(ff, 0, 2.6, 2.7, { glass, canopy: slab });
  b.sign(ff, 0, FH * 2 + 0.6, Math.min(5, psx * 0.4), 0.7, { logo: b.pick(LOGO) });
  b.take(0, pz, psx + 1.2, psz + 1.2, 0.3);
  plaza(b, pz + psz / 2 + 1.0, { trees: true });
  greenery(b, 2);
}

// Rasterwürfel: tiefes Betonraster, zurückgesetztes Glas-Erdgeschoss, Dachpergola
function rasterwuerfel(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const frame = b.pick(['concrete', 'stone_sandstone', 'concrete_panel', 'stone_grey', 'terracotta']);
  const psx = W - 1.6, psz = Math.min(D - 3.2, 12 + (b.fd - 1) * 6), pz = -Z + 0.8 + psz / 2;
  const n = floors(b, 6, 2);
  lobby(b, 0, pz, psx, psz, 4.6, { glass: 'glass_window', inset: 1.0, col: frame });
  const v = vol(0, pz, psx, psz, 4.6, n);
  facGrid(b, v, { frame, glass: b.pick(['glass_curtain_dark', 'glass_window', 'glass_curtain_blue']), bay: 2.0, inset: 0.6, pierW: 0.45, bandH: 0.8, topH: 1.2 });
  const top = v.top + 1.2;
  b.box('roof_flat_gravel', 0, top, pz, psx - 0.4, 0.1, psz - 0.4);
  if (b.d >= 1) {
    const nb = Math.max(3, Math.round(psx / 1.4));
    for (let i = 0; i <= nb; i++) b.box(frame, -psx / 2 + 0.4 + (i * (psx - 0.8)) / nb, top, pz - psz / 2 + 0.4, 0.3, 3.0, 0.3);
    for (let i = 0; i <= nb; i++) b.box(frame, -psx / 2 + 0.4 + (i * (psx - 0.8)) / nb, top + 3.0, pz, 0.25, 0.3, psz - 0.8);
    b.box('metal_panel_grey', psx * 0.2, top, pz + psz * 0.1, psx * 0.3, 2.2, psz * 0.3);
  }
  const ff = b.faces(0, pz, psx, psz).front;
  b.sign(ff, 0, 4.7, Math.min(6, psx * 0.5), 0.8, { logo: b.pick(LOGO), bg: 'trim_dark', text: 'sign_white' });
  b.take(0, pz, psx, psz, 0.3);
  plaza(b, pz + psz / 2, { trees: true });
  greenery(b, 1);
}

// Zwillingsriegel: zwei schlanke, versetzte Scheiben in verschiedenen Glasfarben über gemeinsamem Glasfoyer
function zwillingsriegel(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const g1 = b.pick(GLASS), g2 = b.pick(GLASS.filter((g) => g !== g1));
  const psx = W - 1.4, psz = Math.min(D - 3.2, 12 + (b.fd - 1) * 6), pz = -Z + 0.7 + psz / 2;
  const sw = psx * 0.44, n1 = floors(b, 8, 2), n2 = Math.max(4, n1 - 2 - b.int(0, 2));
  lobby(b, 0, pz, psx, psz, 4.2, { glass: 'glass_window', inset: 0.5, col: 'metal_dark' });
  b.box('metal_dark', 0, 4.2, pz, psx, 0.4, psz);
  const off = psz * 0.12;
  const A = vol(-psx / 2 + sw / 2, pz - off, sw, psz - off * 2, 4.6, n1), Bv = vol(psx / 2 - sw / 2, pz + off, sw, psz - off * 2, 4.6, n2);
  facCurtain(b, A, { glass: g1, frame: 'metal_dark' });
  facFins(b, Bv, { glass: g2, frame: 'metal_dark', fin: 'metal_panel_white', finSides: ['front', 'back'] });
  roofOff(b, A.x, A.top, A.z, A.sx, A.sz, { parapet: 1.0, parMat: 'metal_dark', plantW: 0.5 });
  roofOff(b, Bv.x, Bv.top, Bv.z, Bv.sx, Bv.sz, { parapet: 0.8, parMat: 'metal_panel_white', plant: false });
  b.sign(b.faces(A.x, A.z, A.sx, A.sz).front, 0, A.top - 1.6, Math.min(4, sw * 0.7), 0.9, { logo: b.pick(LOGO) });
  b.take(0, pz, psx, psz, 0.3);
  plaza(b, pz + psz / 2, { trees: true });
}

// =====================================================================================
// Stufe 4
// =====================================================================================

// Art-déco-Steinturm: Sockel, Schaft mit Lisenen, zwei Rücksprünge mit Gesimsen, Fahnenmast
function steinturm(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const stone = b.pick(['stone_sandstone', 'stone_grey', 'trim_stone', 'brick_yellow', 'concrete_panel']);
  const cap = b.pick(['trim_stone', 'roof_copper', 'metal_light']);
  const psx = W - 1.0, psz = D - 2.6, pz = -Z + 0.6 + psz / 2;
  b.box('stone_dark', 0, 0, pz, psx, 1.0, psz);
  const base = vol(0, pz, psx, psz, 1.0, 3, 3.8);
  facPiers(b, base, { wall: stone, sp: 2.0, glass: 'glass_window' });
  b.box(cap, 0, base.top, pz, psx + 0.3, 0.45, psz + 0.3);
  const n = floors(b, 10, 3);
  const s1 = vol(0, pz, psx * 0.8, psz * 0.8, base.top + 0.45, Math.round(n * 0.65), 3.5);
  facPiers(b, s1, { wall: stone, sp: 1.4, glass: 'glass_window', pinnacle: true, cap });
  b.box(cap, 0, s1.top, pz, s1.sx + 0.3, 0.4, s1.sz + 0.3);
  const s2 = vol(0, pz, psx * 0.6, psz * 0.6, s1.top + 0.4, n - Math.round(n * 0.65), 3.5);
  facPiers(b, s2, { wall: stone, sp: 1.2, glass: 'glass_window', pinnacle: true, cap });
  b.box(cap, 0, s2.top, pz, s2.sx + 0.3, 0.5, s2.sz + 0.3);
  glowBand(b, 'emissive_warm', 0, s2.top + 0.5, pz, s2.sx * 0.7, s2.sz * 0.7, 0.3);
  b.box(stone, 0, s2.top + 0.5, pz, s2.sx * 0.66, 2.6, s2.sz * 0.66);
  b.cyl('metal_light', 0, s2.top + 3.1, pz, 0.12, 6, { seg: 6, exact: true });
  if (b.d >= 1) b.box(b.pick(['paint_red', 'paint_blue', 'paint_white']), 0.7, s2.top + 7.6, pz, 1.4, 0.9, 0.04);
  warn(b, 0, s2.top + 9.3, pz);
  const ff = b.faces(0, pz, psx, psz).front;
  b.fbox('stone_dark', ff, 0, 0, 4.4, 5.2, 0.5, 0);
  b.fplane('glass_window', ff, 0, 0.2, 3.2, 4.4, 0.52);
  b.sign(ff, 0, 5.4, Math.min(6.5, psx - 2), 0.8, { bg: 'trim_stone', logo: cap, text: 'metal_dark' });
  b.take(0, pz, psx, psz, 0.3);
  plaza(b, pz + psz / 2, { trees: false });
}

// Pultdachturm: Glasschaft, Krone schräg abgeschnitten (Glasfläche), leuchtende Kante
function pultdachturm(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const glass = b.pick(GLASS), frame = b.pick(['metal_dark', 'metal_light']);
  const psx = W - 1.4, psz = D - 2.8, pz = -Z + 0.7 + psz / 2;
  lobby(b, 0, pz, psx, psz, 5.0, { glass, inset: 0.7, col: frame });
  const n = floors(b, 13, 3);
  const sx = psx * 0.86, sz = psz * 0.86;
  const v = vol(0, pz, sx, sz, 5.0, n);
  facCurtain(b, v, { glass, frame, col: 1.5 });
  const h = Math.min(sx, 9) * 0.9;
  // Schräge Krone: Prisma (hinten hoch, vorne niedrig)
  b.prism(glass, [[-sz / 2, 0], [sz / 2, 0], [sz / 2, h * 0.25], [-sz / 2, h]], sx, 0, v.top, pz, PI / 2);
  b.box(frame, 0, v.top - 0.1, pz, sx + 0.2, 0.3, sz + 0.2);
  if (b.d >= 1) {
    const len = Math.hypot(sz, h * 0.75), ang = Math.atan2(h * 0.75, sz);
    for (const s of [-1, 1]) b.boxc('emissive_cool', s * (sx / 2 + 0.05), v.top + h * 0.625, pz, 0.15, 0.15, len, { rx: -ang });
  }
  warn(b, 0, v.top + h + 0.3, pz + sz / 2 - 0.3);
  const ff = b.faces(0, pz, psx, psz).front;
  b.sign(ff, 0, 5.2, Math.min(6, psx * 0.5), 0.8, { logo: b.pick(LOGO) });
  b.take(0, pz, psx, psz, 0.3);
  plaza(b, pz + psz / 2, {});
}

// Kreuzturm: Grundriss als Plus aus zwei sich kreuzenden Scheiben, Arme verschieden hoch
function kreuzturm(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const glass = b.pick(GLASS), band = b.pick(['metal_panel_white', 'concrete_panel', 'stone_grey']);
  const psx = W - 1.2, psz = D - 2.8, pz = -Z + 0.6 + psz / 2;
  lobby(b, 0, pz, psx * 0.9, psz * 0.9, 4.8, { glass: 'glass_window', inset: 0.6, col: band });
  const n = floors(b, 14, 3), y0 = 4.8;
  const A = vol(0, pz, psx * 0.9, psz * 0.42, y0, n), Bv = vol(0, pz, psx * 0.42, psz * 0.9, y0, n + 2 + b.int(0, 2));
  facRibbon(b, A, { band, glass, winH: FH * 0.62 });
  facCurtain(b, Bv, { glass, frame: 'metal_dark', sides: ['front', 'back'] });
  // Seiten des hohen Arms oberhalb des niedrigen
  roofOff(b, 0, A.top, pz, A.sx, A.sz, { parapet: 0.6, parMat: band, plant: false });
  roofOff(b, 0, Bv.top, pz, Bv.sx, Bv.sz, { parapet: 1.2, parMat: 'metal_dark', plantW: 0.6 });
  glowBand(b, 'emissive_cool', 0, Bv.top + 1.0, pz, Bv.sx, Bv.sz, 0.2);
  antenna(b, 0, Bv.top + 3.0, pz - Bv.sz * 0.2, 7);
  const ff = b.faces(0, pz, Bv.sx, Bv.sz).front;
  b.sign(ff, 0, Bv.top - 1.7, Math.min(4, Bv.sx * 0.8), 1.0, { logo: b.pick(LOGO) });
  b.take(0, pz, psx, psz, 0.3);
  plaza(b, pz + psz / 2, {});
}

// Turm auf Sockelbau: breiter dreigeschossiger Sockel mit Dachgarten, schlanker Turm seitlich versetzt
function sockelturm(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const band = b.pick(['concrete_panel', 'stone_sandstone', 'terracotta', 'metal_panel_bronze']);
  const glass = b.pick(GLASS);
  const psx = W - 0.8, psz = D - 2.2, pz = -Z + 0.4 + psz / 2;
  const base = vol(0, pz, psx, psz, 0, 3, 3.8);
  facRibbon(b, base, { band, glass: 'glass_window', winH: 2.2 });
  b.box('green_roof', 0, base.top, pz, psx, 0.35, psz);
  if (b.d >= 1) { b.hedge(psx * 0.3, pz + psz * 0.3, psx * 0.3, 0.8, 0.9); b.box('wood_deck', psx * 0.3, base.top + 0.35, pz - psz * 0.2, psx * 0.3, 0.06, psz * 0.3); }
  const side = b.chance(0.5) ? -1 : 1, tsx = psx * 0.5, tsz = psz * 0.7;
  const tx = side * (psx / 2 - tsx / 2 - 0.4), tz = pz - psz / 2 + tsz / 2 + 0.4;
  const v = vol(tx, tz, tsx, tsz, base.top + 0.35, floors(b, 12, 3));
  facFins(b, v, { glass, frame: 'metal_dark', fin: band, finSides: ['front', side > 0 ? 'left' : 'right'] });
  const rt = roofOff(b, tx, v.top, tz, tsx, tsz, { parapet: 1.0, parMat: band, plantW: 0.5, bmu: true });
  antenna(b, tx, rt, tz, 5);
  if (b.d >= 1) for (let i = 0; i < 3; i++) b.tree(-side * (psx * 0.15 + i * 2.2), pz - psz * 0.25, 0.5, 'busch');
  const ff = b.faces(0, pz, psx, psz).front;
  b.entrance(ff, side * psx * 0.25, 3.0, 3.0, { glass });
  b.sign(ff, -side * psx * 0.2, 3.9, Math.min(6, psx * 0.4), 0.9, { logo: b.pick(LOGO) });
  b.take(0, pz, psx, psz, 0.3);
  plaza(b, pz + psz / 2, {});
}

// =====================================================================================
// Stufe 5 – Wolkenkratzer
// =====================================================================================

// Nadelturm: gestufter Steinturm (drei Rücksprünge), Laterne und lange Spitze
function nadelturm(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const stone = b.pick(['stone_sandstone', 'stone_grey', 'trim_stone', 'concrete_panel']);
  const cap = b.pick(['metal_light', 'trim_stone', 'roof_copper']);
  const psx = W - 0.8, psz = D - 2.2, pz = -Z + 0.4 + psz / 2;
  const base = vol(0, pz, psx, psz, 0, 5, 3.8);
  facPiers(b, base, { wall: stone, sp: 1.8, glass: 'glass_window' });
  b.box(cap, 0, base.top, pz, psx + 0.3, 0.5, psz + 0.3);
  const n = floors(b, 28, 4);
  const parts = [[0.78, 0.55], [0.6, 0.27], [0.44, 0.18]];
  let y = base.top + 0.5, last = null;
  for (const [s, f] of parts) {
    const v = vol(0, pz, psx * s, psz * s, y, Math.max(3, Math.round(n * f)), 3.5);
    facPiers(b, v, { wall: stone, sp: 1.25, glass: 'glass_window', pinnacle: true, cap });
    b.box(cap, 0, v.top, pz, v.sx + 0.3, 0.5, v.sz + 0.3);
    y = v.top + 0.5; last = v;
  }
  // Laterne (leuchtend) und Spitze
  const ls = Math.min(last.sx, last.sz) * 0.6;
  b.box('metal_dark', 0, y, pz, ls, 4.5, ls);
  if (b.d >= 1) for (const s of SIDES) { const f = b.face(0, pz, ls, ls, s); b.fplane('emissive_warm', f, 0, y + 0.6, ls * 0.7, 3.2, 0.03); }
  else b.box('emissive_warm', 0, y + 0.6, pz, ls + 0.04, 3.2, ls + 0.04);
  b.box(cap, 0, y + 4.5, pz, ls + 0.4, 0.4, ls + 0.4);
  spire(b, 0, y + 4.9, pz, ls * 0.35, 16, cap);
  b.light(0, y + 2.4, pz, 0xffd79a, 0.9);
  const ff = b.faces(0, pz, psx, psz).front;
  b.fbox('stone_dark', ff, 0, 0, 5.0, 6.0, 0.5, 0);
  b.fplane('glass_window', ff, 0, 0.2, 3.6, 5.2, 0.52);
  b.sign(ff, 0, 6.3, Math.min(7, psx - 2), 0.8, { bg: 'trim_stone', logo: cap, text: 'metal_dark' });
  b.take(0, pz, psx, psz, 0.3);
  plaza(b, pz + psz / 2, { trees: false });
}

// Kronenspitze: Schaft mit Metall-Lisenen, Krone aus gestuften Achteck-Ringen mit Lichtbögen, Nadel
function kronenspitze(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const stone = b.pick(['stone_grey', 'brick_white', 'stone_sandstone', 'marble']);
  const metal = b.pick(['metal_light', 'metal_light', 'roof_copper']);
  const psx = W - 1.0, psz = D - 2.4, pz = -Z + 0.5 + psz / 2;
  lobby(b, 0, pz, psx, psz, 5.5, { glass: 'glass_window', inset: 0.5, col: stone });
  const n = floors(b, 30, 4);
  const s = Math.min(psx, psz) * 0.8;
  const v = vol(0, pz, s, s, 5.5, n, 3.5);
  facPiers(b, v, { wall: stone, sp: 1.15, glass: 'glass_window', spandrel: 'metal_dark' });
  // Ecken in Metall
  if (b.d >= 1) for (const cx of [-1, 1]) for (const cz of [-1, 1]) b.box(metal, cx * (s / 2 - 0.2), v.y0, pz + cz * (s / 2 - 0.2), 0.5, n * 3.5 + 0.4, 0.5);
  let y = v.top, r = s * 0.62;
  for (let k = 0; k < 5; k++) {
    const h = 3.2 - k * 0.3, r2 = r * 0.82;
    b.cyl(metal, 0, y, pz, r, h, { seg: 8, exact: true, rTop: r2, ry: PI / 8 });
    if (b.d >= 1) b.cyl('emissive_warm', 0, y + h * 0.35, pz, r - (r - r2) * 0.35 + 0.06, h * 0.35, { seg: 8, exact: true, rTop: r - (r - r2) * 0.7 + 0.06, open: true, ry: PI / 8 });
    y += h; r = r2;
  }
  spire(b, 0, y, pz, r * 0.8, 18, metal);
  b.light(0, y - 6, pz, 0xffd79a, 1.0);
  const ff = b.faces(0, pz, psx, psz).front;
  b.sign(ff, 0, 5.7, Math.min(6, psx * 0.5), 0.8, { bg: 'trim_dark', logo: metal, text: 'sign_white' });
  b.take(0, pz, psx, psz, 0.3);
  plaza(b, pz + psz / 2, {});
}

// Splitter: gläserner Turm, der sich in Stufen verjüngt; oben offene Glasfahnen
function splitter(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const glass = b.pick(['glass_curtain_blue', 'glass_curtain_dark', 'glass_curtain_blue', 'glass_curtain_green']);
  const psx = W - 1.2, psz = D - 2.6, pz = -Z + 0.6 + psz / 2;
  lobby(b, 0, pz, psx, psz, 5.0, { glass, inset: 0.8, col: 'metal_dark' });
  const n = floors(b, 34, 4), tiers = b.d === 0 ? 6 : 8;
  const s0x = psx * 0.92, s0z = psz * 0.92;
  let y = 5.0, last = null;
  for (let t = 0; t < tiers; t++) {
    const f = 1 - (t / tiers) * 0.72;
    const nf = Math.max(2, Math.round(n / tiers));
    const v = vol(0, pz - (1 - f) * s0z * 0.08, s0x * f, s0z * f, y, nf);
    facCurtain(b, v, { glass, frame: 'metal_dark', col: 1.8 });
    y = v.top; last = v;
  }
  // Glasfahnen über dem Dach
  for (const [ax, az, h] of [[-0.3, -0.3, 9], [0.32, -0.25, 7], [-0.25, 0.3, 6], [0.28, 0.32, 8]]) {
    b.box(glass, ax * last.sx, y, last.z + az * last.sz, last.sx * 0.42, h, 0.25, ax * az > 0 ? 0.35 : -0.35);
  }
  glowBand(b, 'emissive_cool', 0, y, last.z, last.sx, last.sz, 0.25);
  warn(b, -0.3 * last.sx, y + 9.3, last.z - 0.3 * last.sz);
  b.light(0, y + 2, last.z, 0xcfe6ff, 0.8);
  const ff = b.faces(0, pz, psx, psz).front;
  b.sign(ff, 0, 5.2, Math.min(6, psx * 0.5), 0.8, { logo: b.pick(LOGO) });
  b.take(0, pz, psx, psz, 0.3);
  plaza(b, pz + psz / 2, {});
}

// Zwillingstürme mit Himmelsbrücke: zwei achteckige Glastürme mit Ringbändern, Brücke, Spitzen
function himmelsbruecke(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const glass = b.pick(['glass_curtain_blue', 'glass_curtain_dark', 'glass_window', 'glass_curtain_gold']);
  const band = b.pick(['metal_light', 'stone_grey', 'metal_panel_white']);
  const psx = W - 0.8, psz = D - 2.4, pz = -Z + 0.6 + psz / 2;
  const wide = psx >= psz;
  const r = Math.min(wide ? psx * 0.23 : psz * 0.23, wide ? psz * 0.46 : psx * 0.46);
  const off = (wide ? psx : psz) / 2 - r - 0.2;
  const P = wide ? [[-off, pz], [off, pz]] : [[0, pz - off], [0, pz + off]];
  const n = floors(b, 30, 3), seg = 8;
  b.box('stone_dark', 0, 0, pz, wide ? psx : r * 2.2, 0.5, wide ? r * 2.2 : psz);
  const levels = 3, lf = [0.62, 0.22, 0.16];
  for (const [x, z] of P) {
    let y = 0.5, rr = r;
    for (let l = 0; l < levels; l++) {
      const nf = Math.max(2, Math.round(n * lf[l]));
      b.cyl('metal_dark', x, y, z, rr - 0.15, nf * FH, { seg, exact: true, ry: PI / 8 });
      if (b.d === 0) b.cyl(glass, x, y, z, rr, nf * FH, { seg, exact: true, open: true, ry: PI / 8, lit: b.r() });
      else for (let k = 0; k < nf; k++) {
        b.cyl(glass, x, y + k * FH + 0.12, z, rr, FH - 0.24, { seg, exact: true, open: true, ry: PI / 8, lit: b.r() });
        if (b.d >= 1 && k % 2 === 0) b.cyl(band, x, y + k * FH - 0.12, z, rr + 0.08, 0.24, { seg, exact: true, open: true, ry: PI / 8 });
      }
      y += nf * FH;
      b.cyl(band, x, y, z, rr + 0.12, 0.5, { seg, exact: true, ry: PI / 8 });
      y += 0.5; rr *= 0.78;
    }
    spire(b, x, y, z, rr * 0.7, 14, band);
  }
  // Himmelsbrücke in etwa 40 % Höhe
  const yb = 0.5 + Math.round(n * 0.4) * FH, L = 2 * off - 2 * r * 0.9;
  if (L > 0.5) {
    const cx = (P[0][0] + P[1][0]) / 2, cz = (P[0][1] + P[1][1]) / 2;
    const bx = wide ? L : 2.2, bz = wide ? 2.2 : L;
    b.box(band, cx, yb, cz, bx, 0.4, bz);
    b.box(glass, cx, yb + 0.4, cz, wide ? L : 1.9, 2.6, wide ? 1.9 : L);
    b.box(band, cx, yb + 3.0, cz, bx, 0.35, bz);
    if (b.d >= 1) for (const s of [-1, 1]) b.beam(band, wide ? [cx + s * L * 0.15, yb, cz] : [cx, yb, cz + s * L * 0.15], wide ? [cx + s * (off - r * 0.9), yb - 8, cz] : [cx, yb - 8, cz + s * (off - r * 0.9)], 0.35);
  }
  const ff = b.faces(0, pz, psx, psz).front;
  b.fbox('metal_dark', ff, 0, 0.5, wide ? 6 : 3.4, 4.0, 1.4, wide ? 0 : -psz / 2 + off + r);
  b.sign(ff, 0, 4.7, Math.min(6, psx * 0.5), 0.7, { logo: b.pick(LOGO) });
  b.take(0, pz, psx, psz, 0.3);
  plaza(b, pz + psz / 2, {});
}

// Kristallturm: Vorhangfassade, oben drei übereck gedrehte Glasstufen mit leuchtenden Kanten
function kristallturm(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const glass = b.pick(GLASS), frame = b.pick(['metal_dark', 'metal_light']);
  const psx = W - 1.2, psz = D - 2.6, pz = -Z + 0.6 + psz / 2;
  lobby(b, 0, pz, psx, psz, 5.5, { glass, inset: 0.6, col: frame });
  const n = floors(b, 28, 4);
  const s = Math.min(psx, psz) * 0.84;
  const v = vol(0, pz, s, s, 5.5, n);
  facCurtain(b, v, { glass, frame, col: 1.4 });
  b.box(frame, 0, v.top, pz, s + 0.3, 0.5, s + 0.3);
  let y = v.top + 0.5, q = s * 0.86;
  for (let k = 0; k < 3; k++) {
    const h = 3 * FH - k * 1.2;
    b.box(glass, 0, y, pz, q, h, q, PI / 4, b.r());
    if (b.d >= 1) {
      for (let c = 0; c < 4; c++) {
        const a = PI / 4 + (c * PI) / 2 + PI / 4, rr = q * 0.707;
        b.box('emissive_cool', Math.sin(a) * rr, y, pz + Math.cos(a) * rr, 0.18, h, 0.18, PI / 4);
      }
    }
    b.box(frame, 0, y + h, pz, q * 0.9, 0.35, q * 0.9, PI / 4);
    y += h + 0.35; q *= 0.68;
  }
  b.cone(glass, 0, y, pz, q * 0.8, 5, { seg: 4, exact: true });
  warn(b, 0, y + 5.3, pz);
  b.light(0, y - 3, pz, 0xcfe6ff, 0.9);
  const ff = b.faces(0, pz, psx, psz).front;
  b.sign(ff, 0, 5.7, Math.min(6, psx * 0.5), 0.8, { logo: b.pick(LOGO) });
  b.take(0, pz, psx, psz, 0.3);
  plaza(b, pz + psz / 2, {});
}

// Hubschrauber-Scheibe: breite Scheibe mit Betonraster, auf dem Dach ein Landeplatz mit „H" und Lichtern
function helischeibe(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const frame = b.pick(['concrete', 'metal_panel_white', 'stone_grey', 'concrete_panel']);
  const glass = b.pick(['glass_curtain_dark', 'glass_curtain_blue', 'glass_window']);
  const psx = W - 1.0, psz = D - 2.4, pz = -Z + 0.5 + psz / 2;
  const wide = psx >= psz;
  const sx = wide ? psx * 0.94 : psx * 0.72, sz = wide ? psz * 0.62 : psz * 0.94;
  lobby(b, 0, pz, sx, sz, 5.0, { glass: 'glass_window', inset: 0.6, col: frame });
  const v = vol(0, pz, sx, sz, 5.0, floors(b, 26, 4));
  facGrid(b, v, { frame, glass, bay: 1.5, topH: 1.0 });
  const top = v.top + 1.0;
  b.box('metal_panel_grey', 0, top, pz, sx * 0.85, 2.6, sz * 0.7);
  const hr = Math.min(sx, sz) * 0.48;
  const hy = top + 2.6;
  b.cyl('metal_dark', 0, hy, pz, hr * 0.5, 0.8, { seg: 8 });
  b.cyl('concrete_dark', 0, hy + 0.8, pz, hr, 0.3, { seg: b.d >= 1 ? 20 : 10, exact: true });
  if (b.d >= 1) {
    b.cyl('paint_yellow', 0, hy + 1.1, pz, hr * 0.92, 0.03, { seg: 20, exact: true, open: false });
    b.cyl('concrete_dark', 0, hy + 1.12, pz, hr * 0.86, 0.03, { seg: 20, exact: true });
    const hs = hr * 0.5;
    for (const sxx of [-1, 1]) b.box('paint_white', sxx * hs * 0.45, hy + 1.15, pz, hs * 0.18, 0.03, hs);
    b.box('paint_white', 0, hy + 1.15, pz, hs * 0.9, 0.03, hs * 0.18);
  }
  for (let k = 0; k < 4; k++) { const a = (k * PI) / 2 + PI / 4; b.light(Math.sin(a) * hr, hy + 1.3, pz + Math.cos(a) * hr, k % 2 ? 0x7fdc7a : 0xffd04a, 0.25); }
  warn(b, sx / 2 - 0.5, top + 3.0, pz - sz / 2 + 0.5);
  const ff = b.faces(0, pz, sx, sz).front;
  b.sign(ff, 0, v.top - 2.0, Math.min(7, sx * 0.4), 1.2, { logo: b.pick(LOGO) });
  b.take(0, pz, sx, sz, 0.3);
  plaza(b, pz + sz / 2, { trees: true });
  greenery(b, 2);
}

// Stufenpyramide: breiter Sockel, fünf Rücksprünge mit begrünten Terrassen, oben Laterne
function stufenpyramide(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const band = b.pick(['concrete_panel', 'stone_sandstone', 'metal_panel_white', 'terracotta']);
  const glass = b.pick(GLASS);
  const psx = W - 0.8, psz = D - 2.2, pz = -Z + 0.4 + psz / 2;
  const n = floors(b, 26, 4), tiers = 5;
  let y = 0;
  let last = null;
  for (let t = 0; t < tiers; t++) {
    const f = 1 - t * 0.17;
    const nf = Math.max(2, Math.round((n / tiers) * (t === 0 ? 0.7 : 1.05)));
    const v = vol(0, pz, psx * f, psz * f, y, nf);
    if (t % 2 === 0) facRibbon(b, v, { band, glass, winH: FH * 0.6 }); else facCurtain(b, v, { glass, frame: 'metal_dark' });
    b.box(t === tiers - 1 ? band : 'green_roof', 0, v.top, pz, v.sx + 0.2, 0.35, v.sz + 0.2);
    if (b.d >= 1 && t < tiers - 1) {
      // Hecken und Bäumchen auf der Terrasse
      const nf2 = psx * (1 - (t + 1) * 0.17);
      b.box('hedge', 0, v.top + 0.35, pz + v.sz / 2 - 0.5, v.sx - 0.6, 0.7, 0.5);
      for (const s of [-1, 1]) b.sphere('leaves_green', s * (nf2 / 2 + (v.sx - nf2) / 4), v.top + 1.4, pz + v.sz / 2 - 1.2, 0.8, { seg: 6 });
    }
    y = v.top + 0.35; last = v;
  }
  const ls = Math.min(last.sx, last.sz) * 0.5;
  b.box(glass, 0, y, pz, ls, 4.0, ls, 0, b.r());
  b.box(band, 0, y + 4, pz, ls + 0.4, 0.5, ls + 0.4);
  antenna(b, 0, y + 4.5, pz, 9);
  const ff = b.faces(0, pz, psx, psz).front;
  b.entrance(ff, 0, 3.4, 3.0, { glass });
  b.sign(ff, 0, 4.0, Math.min(7, psx * 0.5), 0.9, { logo: b.pick(LOGO) });
  b.take(0, pz, psx, psz, 0.3);
  plaza(b, pz + psz / 2, {});
}

export const OFF_NEW = {
  1: [stadtkontor, praxishaus, glaswuerfel],
  2: [klinkerbuero, holzhybrid, rundbau],
  3: [campus, wellenhaus, rasterwuerfel, zwillingsriegel],
  4: [steinturm, pultdachturm, kreuzturm, sockelturm],
  5: [nadelturm, kronenspitze, splitter, himmelsbruecke, kristallturm, helischeibe, stufenpyramide],
};
void facPunch;
