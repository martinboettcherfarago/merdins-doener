// Spezialindustrie Landwirtschaft ('farm') – Archetypen, die mit der Stufe wachsen (Besitzer: G4).
// Jede Variante ist ein eigener Hoftyp (Ackerhof, Milchviehhof, Gärtnerei, Obsthof, Fachwerkhof, Masthof);
// die Stufe (1–5) bestimmt Größe und Ausstattung (Silos, Hallen, Biogas …).
import * as THREE from 'three';
import { B, PI, HP, clamp } from './indoff_parts.js';

const geom = (b) => ({ W: b.W, D: b.D, X: b.W / 2, Z: b.D / 2, wide: b.W > 10, deep: b.D > 10 });
const CROPS = ['field_wheat', 'field_crops', 'field_rapeseed', 'field_wheat', 'field_crops', 'grass_dry'];

// Aufteilung: Hofstelle (yard) und Felder je Grundfläche
function farmLayout(b) {
  const { W, D, X, Z, wide, deep } = geom(b);
  if (wide && deep) return { yard: [-X / 2, -Z / 2, W / 2, D / 2], fields: [[X / 2, -Z / 2, W / 2 - 0.3, D / 2 - 0.3], [0, Z / 2, W - 0.3, D / 2 - 0.3]] };
  if (wide) return { yard: [-X / 2, 0, W / 2, D], fields: [[X / 2, 0, W / 2 - 0.3, D - 0.3]] };
  if (deep) return { yard: [0, -Z / 2, W, D / 2], fields: [[0, Z / 2, W - 0.3, D / 2 - 0.3]] };
  return { yard: [0, -1.6, W, D - 3.2], fields: [[0, Z - 1.7, W - 0.3, 3.2]] };
}

// Feld: Ackerboden mit Pflanzreihen bzw. Getreide mit Fahrgassen
function field(b, x, z, sx, sz, crop, dir = 'x') {
  b.ground('field_soil', x, z, sx, sz, 0.1);
  b.take(x, z, sx, sz, 0);
  if (crop === 'grass_dry' || crop === 'grass') { b.box(crop, x, 0.1, z, sx - 0.3, 0.06, sz - 0.3); return; }
  const tall = crop === 'field_wheat' ? 0.75 : crop === 'field_rapeseed' ? 0.95 : 0.4;
  if (b.d === 0 || crop !== 'field_crops') {
    b.box(crop, x, 0.1, z, sx - 0.4, tall, sz - 0.4);
    if (b.d >= 1) {
      const across = dir === 'x' ? sz : sx, n = Math.max(1, Math.floor(across / 7));
      for (let i = 1; i <= n; i++) {
        const t = -across / 2 + (i * across) / (n + 1);
        for (const s of [-0.9, 0.9]) {
          if (dir === 'x') b.box('field_soil', x, 0.1, z + t + s, sx - 0.38, tall + 0.02, 0.35);
          else b.box('field_soil', x + t + s, 0.1, z, 0.35, tall + 0.02, sz - 0.38);
        }
      }
    }
    return;
  }
  const along = dir === 'x' ? sx : sz, across = dir === 'x' ? sz : sx;
  const n = Math.max(2, Math.floor((across - 0.4) / 0.8));
  for (let i = 0; i < n; i++) {
    const t = -across / 2 + 0.2 + (i + 0.5) * ((across - 0.4) / n);
    if (dir === 'x') b.box(crop, x, 0.1, z + t, along - 0.5, tall, 0.45);
    else b.box(crop, x + t, 0.1, z, 0.45, tall, along - 0.5);
  }
}
// Dachfläche als Platte zwischen zwei Profilpunkten (u quer, v hoch) über die Länge len entlang ridge
function slab(b, mat, x, y, z, a, c, len, ridge, t = 0.25) {
  if (ridge === 'x') b.beam(mat, [x, y + a[1], z + a[0]], [x, y + c[1], z + c[0]], len, t);
  else b.beam(mat, [x + a[0], y + a[1], z], [x + c[0], y + c[1], z], len, t);
}
// Scheune mit Sattel- oder Mansarddach (gambrel), großem Tor am Giebel (vorne) und Dachreiter
function barn(b, x, z, sx, sz, h, o = {}) {
  const wall = o.wall || b.pick(['siding_red', 'wood_planks', 'wood_dark', 'brick_red', 'siding_red']);
  const roof = o.roof || b.pick(['roof_tiles_red', 'roof_metal_grey', 'roof_tiles_anthracite', 'metal_corrugated', 'roof_slate']);
  const ridge = o.ridge || 'z', span = ridge === 'z' ? sx : sz, len = ridge === 'z' ? sz : sx, w = span / 2;
  b.box(wall, x, 0, z, sx, h, sz);
  if (b.d >= 1) b.box('stone_grey', x, 0, z, sx + 0.1, 0.5, sz + 0.1);
  const gam = o.gambrel ?? b.chance(0.5);
  const prof = gam ? [[-w, 0], [-w * 0.72, w * 0.62], [0, w * 0.95], [w * 0.72, w * 0.62], [w, 0]] : [[-w, 0], [0, w * (o.pitchK ?? 0.85)], [w, 0]];
  b.prism(wall, prof, len - 0.02, x, h, z, ridge === 'x' ? HP : 0);
  const ov = 0.35;
  for (let i = 0; i < prof.length - 1; i++) {
    const a = prof[i], c = prof[i + 1];
    const du = c[0] - a[0], dv = c[1] - a[1], L = Math.hypot(du, dv), nu = -dv / L, nv = du / L;
    const ex = i === 0 ? -ov : 0, ex2 = i === prof.length - 2 ? ov : 0;
    const a2 = [a[0] + (du / L) * ex + nu * 0.12, a[1] + (dv / L) * ex + nv * 0.12], c2 = [c[0] + (du / L) * ex2 + nu * 0.12, c[1] + (dv / L) * ex2 + nv * 0.12];
    slab(b, roof, x, h, z, a2, c2, len + 0.5, ridge, 0.22);
  }
  const top = h + (gam ? w * 0.95 : w * (o.pitchK ?? 0.85));
  const f = b.face(x, z, sx, sz, ridge === 'z' ? 'front' : 'right');
  const dw = Math.min(span * 0.42, 4.2), dh = Math.min(h - 0.4, 3.8);
  b.fbox(o.door || 'wood_dark', f, 0, 0, dw, dh, 0.1, 0.02);
  if (b.d >= 2) {
    const tr = o.trim || 'paint_white';
    for (const s of [-1, 1]) b.fbox(tr, f, s * dw / 2, 0, 0.18, dh, 0.08, 0.1);
    b.fbox(tr, f, 0, dh - 0.18, dw, 0.18, 0.08, 0.1);
    b.fbox(tr, f, 0, dh / 2, dw, 0.15, 0.08, 0.1);
    for (const s of [-1, 1]) for (const t of [-1, 1]) {
      const [px, pz] = f.at((s * dw) / 4, 0.14);
      b.g(tr, new THREE.BoxGeometry(0.13, Math.hypot(dw / 2, dh - 0.2) - 0.15, 0.05), px, dh / 2 - 0.05, pz, { ry: f.ry, rz: t * Math.atan2(dw / 2, dh - 0.2) });
    }
  }
  if (b.d >= 1) b.fbox(o.door || 'wood_dark', f, 0, h + 0.4, 1.4, 1.3, 0.1, 0.02);
  if (b.d >= 1 && o.cupola !== false && len > 5) {
    b.box(wall, x, top - 0.1, z, 1.0, 1.0, 1.0);
    b.cone(roof, x, top + 0.9, z, 0.85, 0.8, { seg: 4, exact: true, ry: PI / 4 });
  }
  b.take(x, z, sx, sz, 0.3);
  return { f, top };
}
// Wohnhaus (Bauernhaus), optional Fachwerk
function farmhouse(b, x, z, sx, sz, o = {}) {
  const wall = o.wall || b.pick(['plaster_white', 'plaster_cream', 'plaster_ochre', 'brick_red', 'plaster_pink']);
  const roof = o.roof || b.pick(['roof_tiles_red', 'roof_tiles_brown', 'roof_tiles_anthracite']);
  const fl = o.floors ?? 2, fh = 2.8, h = fl * fh;
  const ridge = sx >= sz ? 'x' : 'z';
  const H = b.hall({ x, z, sx, sz, h, wall, roof: 'gable', roofMat: roof, pitch: 45, ridge, ribs: false, plinth: 'stone_grey', plinthH: 0.5, over: 0.45, gutter: false });
  for (const s of ['front', 'back', 'left', 'right']) for (let k = 0; k < fl; k++) {
    const f = H.f[s];
    if (s === 'front' && k === 0) { b.winRow(f, -f.len / 2 + 0.8, -0.9, 0.9, 0.95, 1.25, { spacing: 1.7, frame: 'window_frame_white', sill: true }); b.winRow(f, 0.9, f.len / 2 - 0.8, 0.9, 0.95, 1.25, { spacing: 1.7, frame: 'window_frame_white', sill: true }); continue; }
    b.winRow(f, -f.len / 2 + 0.8, f.len / 2 - 0.8, k * fh + 0.9, 0.95, 1.25, { spacing: 1.7, frame: 'window_frame_white', sill: true });
  }
  b.fbox('door_wood', H.f.front, 0, 0, 1.0, 2.1, 0.08, 0.02);
  if (b.d >= 1) b.fbox('stone_grey', H.f.front, 0, 0, 1.6, 0.25, 0.6, 0);
  if (b.d >= 1) { const rr = Math.tan(PI / 4) * ((ridge === 'x' ? sz : sx) / 2); b.chimney(x + (ridge === 'x' ? sx * 0.25 : 0), z + (ridge === 'z' ? -sz * 0.25 : 0), { type: 'square', h: h + rr + 0.6, r: 0.3, mat: 'chimney_brick', smoke: 0.2, base: 0 }); }
  // Fachwerk: dunkle Balken auf hellem Putz
  if (o.fachwerk && b.d >= 1) {
    const tim = o.timber || 'wood_dark';
    for (const s of ['front', 'back', 'left', 'right']) {
      const f = H.f[s], len = f.len;
      for (let k = 0; k <= fl; k++) b.fbox(tim, f, 0, Math.max(0.5, k * fh - 0.1), len + 0.02, 0.2, 0.06, 0);
      const m = Math.max(2, Math.round(len / 1.3));
      for (let i = 0; i <= m; i++) b.fbox(tim, f, clamp(-len / 2 + (i * len) / m, -len / 2 + 0.1, len / 2 - 0.1), 0.5, 0.18, h - 0.5, 0.06, 0);
      if (b.d >= 2) for (let k = 0; k < fl; k++) for (const sgn of [-1, 1]) {
        const a0 = sgn * (len / 2 - 0.1), a1 = sgn * (len / 2 - len / m - 0.1);
        const p0 = f.at(a0, 0.03), p1 = f.at(a1, 0.03);
        b.beam(tim, [p0[0], k * fh + 0.6, p0[1]], [p1[0], (k + 1) * fh - 0.1, p1[1]], 0.16, 0.06);
      }
    }
  }
  b.take(x, z, sx, sz, 0.3);
  return H;
}
// Rundballen / Silageballen
function bales(b, x, z, n, mat = 'hay', ry = 0) {
  const s = Math.sin(ry), c = Math.cos(ry);
  for (let i = 0; i < n; i++) {
    const a = (i - (n - 1) / 2) * 1.6;
    if (b.d === 0) { b.box(mat, x + c * a, 0, z - s * a, 1.4, 1.4, 1.2, ry); continue; }
    b.hcyl(mat, x + c * a, 0.75, z - s * a, 0.75, 1.2, 'z', { ry, seg: 10 });
  }
}
// Kühe
function cows(b, x, z, sx, sz, n) {
  if (b.d < 1) return;
  for (let i = 0; i < n; i++) {
    const px = x + (b.r() - 0.5) * (sx - 2.5), pz = z + (b.r() - 0.5) * (sz - 2.5), ry = b.r() * PI * 2;
    const P = b.T(px, pz, ry), col = b.pick(['paint_white', 'paint_white', 'wood_dark', 'brick_brown']);
    let [qx, qz] = P(0);
    b.box(col, qx, 0.75, qz, 0.8, 0.75, 1.8, ry);
    [qx, qz] = P(1.05);
    b.box(col === 'paint_white' ? 'trim_dark' : col, qx, 1.05, qz, 0.4, 0.45, 0.55, ry);
    if (b.d >= 2) {
      for (const f of [-0.65, 0.65]) for (const l of [-0.28, 0.28]) { const [lx, lz] = P(f, l); b.box('trim_dark', lx, 0, lz, 0.14, 0.78, 0.14, ry); }
      if (col === 'paint_white') { [qx, qz] = P(-0.2, 0.2); b.box('trim_dark', qx, 1.2, qz, 0.6, 0.32, 0.5, ry); }
    } else { [qx, qz] = P(0); b.box('trim_dark', qx, 0, qz, 0.6, 0.76, 1.4, ry); }
  }
}
// Getreidesilo aus Wellblech (Rundsilo mit Kegeldach) und Elevator
function grainBin(b, x, z, r, h) {
  b.cyl('concrete', x, 0, z, r + 0.3, 0.3, { seg: 14 });
  b.cyl('metal_corrugated', x, 0.3, z, r, h, { seg: 16 });
  b.cone('metal_corrugated', x, h + 0.3, z, r * 1.04, r * 0.55, { seg: 16 });
  if (b.d >= 1) b.cyl('metal_light', x, h + 0.3 + r * 0.5, z, 0.4, 0.5, { seg: 8 });
  if (b.d >= 2) for (let k = 1; k < 4; k++) b.cyl('metal_dark', x, 0.3 + (h * k) / 4, z, r + 0.04, 0.1, { seg: 16, open: true });
}
// Folientunnel (halbe Röhre entlang z)
function tunnel(b, x, z, w, len, h = 2.6) {
  const geo = new THREE.CylinderGeometry(w / 2, w / 2, len, b.seg(12), 1, false, HP, PI);
  geo.rotateX(HP); geo.scale(1, (h / (w / 2)), 1);
  b.g('canvas_white', geo, x, 0.05, z, {});
  if (b.d >= 2) for (let k = 0; k <= Math.round(len / 2.5); k++) b.g('metal_light', new THREE.TorusGeometry(w / 2 + 0.02, 0.04, 4, 10, PI).scale(1, h / (w / 2), 1), x, 0.05, z - len / 2 + (k * len) / Math.round(len / 2.5), {});
  b.take(x, z, w, len, 0.3);
}
// Venlo-Gewächshaus: Glaswände, viele kleine Glasgiebel, Aluminiumrahmen
function glasshouse(b, x, z, sx, sz, h, o = {}) {
  const glass = 'glass_skylight';
  b.box('concrete', x, 0, z, sx + 0.1, 0.5, sz + 0.1);
  b.box(glass, x, 0.5, z, sx, h - 0.5, sz, 0, b.r());
  const span = 3.2, n = Math.max(1, Math.round(sx / span)), w = sx / n, rise = 0.9;
  for (let i = 0; i < n; i++) {
    const px = x - sx / 2 + (i + 0.5) * w;
    b.prism(glass, [[-w / 2, 0], [w / 2, 0], [0, rise]], sz, px, h, z, 0);
    if (b.d >= 1) b.box('metal_light', px, h + rise - 0.05, z, 0.14, 0.14, sz + 0.1);
    if (b.d >= 1 && i > 0) b.box('metal_light', px - w / 2, h - 0.08, z, 0.12, 0.16, sz + 0.1);
  }
  if (b.d >= 2) {
    const f = b.faces(x, z, sx, sz);
    for (const s of ['front', 'back', 'left', 'right']) { const len = f[s].len, m = Math.max(2, Math.round(len / 2.4)); for (let i = 0; i <= m; i++) b.fbox('metal_light', f[s], clamp(-len / 2 + (i * len) / m, -len / 2 + 0.05, len / 2 - 0.05), 0.5, 0.1, h - 0.5, 0.06, 0); }
  }
  b.take(x, z, sx, sz, 0.3);
}
// Fahrsilo: Betonwände in U-Form, Silage unter schwarzer Folie mit Reifen
function silageBunker(b, x, z, sx, sz) {
  b.box('concrete', x, 0, z - sz / 2 + 0.15, sx, 2.0, 0.3);
  for (const s of [-1, 1]) b.box('concrete', x + s * (sx / 2 - 0.15), 0, z, 0.3, 2.0, sz);
  b.box('rubber', x, 0, z - 0.3, sx - 0.6, 1.7, sz - 1.2);
  if (b.d >= 2) for (let i = 0; i < 6; i++) b.cyl('rubber', x - sx / 2 + 0.9 + (i % 3) * (sx - 1.8) / 2, 1.7, z - sz / 2 + 1.2 + Math.floor(i / 3) * (sz - 2.4), 0.4, 0.15, { seg: 8 });
  b.take(x, z, sx, sz, 0.3);
}
// Biogasanlage: Fermenter mit Gasspeicherkuppel, BHKW-Container
function biogas(b, x, z, r) {
  b.cyl('concrete', x, 0, z, r, 3.2, { seg: 16 });
  b.dome(b.pick(['green_roof', 'canvas_white', 'roof_flat_membrane']), x, 3.2, z, r - 0.1, 0.55, { seg: 16 });
  if (b.d >= 1) b.cyl('metal_dark', x, 3.1, z, r + 0.05, 0.2, { seg: 16, open: true });
  b.takeC(x, z, r, 0.3);
}
// Wiese/Weide mit Holzzaun
function paddock(b, x, z, sx, sz, n) {
  b.ground('grass', x, z, sx, sz, 0.12);
  b.take(x, z, sx, sz, 0);
  const x0 = x - sx / 2 + 0.2, x1 = x + sx / 2 - 0.2, z0 = z - sz / 2 + 0.2, z1 = z + sz / 2 - 0.2;
  b.fence(x0, z0, x1, z0, 1.2, 'wood_planks'); b.fence(x0, z1, x1, z1, 1.2, 'wood_planks');
  b.fence(x0, z0, x0, z1, 1.2, 'wood_planks'); b.fence(x1, z0, x1, z1, 1.2, 'wood_planks');
  cows(b, x, z, sx, sz, n);
}

// =====================================================================================
// Archetypen
// =====================================================================================

// Ackerhof: Wohnhaus, Scheune, Silos/Getreidesilos, Maschinenhalle, Felder mit Traktor
function ackerhof(b) {
  const { yard, fields } = farmLayout(b);
  const L = b.L;
  b.lot('gravel', 0.08);
  const [yx, yz, ysx, ysz] = yard;
  const crop = b.pick(CROPS);
  fields.forEach(([fx, fz, fsx, fsz], i) => field(b, fx, fz, fsx, fsz, i ? b.pick(CROPS) : crop, fsx > fsz ? 'x' : 'z'));
  // Wohnhaus und Scheune
  const hw = Math.min(6.4, ysx * 0.42), hd = Math.min(5.2, ysz * 0.5);
  farmhouse(b, yx - ysx / 2 + 0.5 + hw / 2, yz + ysz / 2 - 1.1 - hd / 2, hw, hd, { floors: L >= 3 ? 2 : 1 + (b.r() < 0.6 ? 1 : 0) });
  const bw = Math.min(7.0, ysx - hw - 1.6), bd = Math.min(ysz - 1.0, 5.5 + L * 0.6);
  barn(b, yx + ysx / 2 - 0.5 - bw / 2, yz - ysz / 2 + 0.5 + bd / 2, bw, bd, 4.0 + L * 0.3, {});
  if (L >= 2) { const p = b.plan.find(2.8, 2.8, { prefer: 'left', pad: 0.1 }); if (p) b.silo(p[0], p[1], 1.25, 8 + L * 1.5, { mat: b.pick(['concrete', 'paint_blue', 'tank_white']), top: 'dome' }); }
  for (let i = 0; i < Math.max(0, L - 2); i++) { const p = b.plan.find(4.0, 4.0, { prefer: 'back', pad: 0.1 }); if (p) grainBin(b, p[0], p[1], 1.8, 3.6 + L * 0.4); }
  if (L >= 4) { const p = b.plan.find(2.8, 2.8, { prefer: 'back', pad: 0.1 }); if (p) { b.box('metal_corrugated', p[0], 0, p[1], 2.4, 14, 2.4); b.smoke(p[0], 14.5, p[1], 'steam', 0.4); } }
  // Traktor und Ballen auf dem Feld
  const [fx, fz, fsx, fsz] = fields[0];
  if (b.fits(fx, fz, fsx > fsz ? HP : 0, L >= 2 ? 10 : 4.4, 2.5)) b.tractor(fx + (fsx > fsz ? fsx * 0.15 : 0), fz + (fsx > fsz ? 0 : fsz * 0.15), fsx > fsz ? HP : 0, b.pick(['paint_green', 'paint_red', 'paint_green', 'paint_blue']), L >= 2 ? b.pick(['hay', 'grain']) : null);
  if (crop === 'grass_dry' || b.chance(0.4)) { const p = b.plan.find(5.0, 1.6, { prefer: 'front', pad: 0 }); if (p) bales(b, p[0], p[1], 3, b.chance(0.3) ? 'canvas_white' : 'hay', HP); }
  b.putTree(0.9, 'laub', { prefer: 'back' });
}

// Milchviehhof: Laufstall (offene Seiten), Weide mit Kühen, Fahrsilo, blaue Hochsilos, Biogas
function milchhof(b) {
  const { yard, fields } = farmLayout(b);
  const L = b.L;
  b.lot('dirt', 0.08);
  const [yx, yz, ysx, ysz] = yard;
  // Laufstall
  const ssx = Math.min(ysx - 1.0, 9 + L), ssz = Math.min(ysz - 1.2, 6 + L * 0.5), sx0 = yx - ysx / 2 + 0.5 + ssx / 2, sz0 = yz - ysz / 2 + 0.6 + ssz / 2;
  const sh = 3.6, roof = b.pick(['roof_metal_grey', 'metal_corrugated', 'roof_tiles_red']);
  b.box('concrete', sx0, 0, sz0, ssx, 1.2, ssz);
  if (b.d >= 1) for (const s of [-1, 1]) for (let i = 0; i <= Math.round(ssx / 4); i++) b.box('wood_dark', sx0 - ssx / 2 + 0.15 + (i * (ssx - 0.3)) / Math.round(ssx / 4), 1.2, sz0 + s * (ssz / 2 - 0.15), 0.25, sh - 1.2, 0.25);
  if (b.d >= 2) for (const s of [-1, 1]) b.box('canvas_white', sx0, 1.3, sz0 + s * (ssz / 2 - 0.1), ssx - 0.4, 0.9, 0.05);
  for (const s of [-1, 1]) b.box('wood_planks', sx0 + s * (ssx / 2 - 0.1), 0, sz0, 0.2, sh, ssz);
  const rr = ssz * 0.18;
  for (const s of [-1, 1]) slab(b, roof, sx0, sh, sz0, [s * (ssz / 2 + 0.5), -0.1], [s * 0.6, rr], ssx + 0.6, 'x', 0.2);
  b.box(roof, sx0, sh + rr - 0.1, sz0, ssx + 0.6, 0.6, 1.4);
  if (b.d >= 1) { b.box('metal_dark', sx0, sh + rr + 0.5, sz0, ssx + 0.6, 0.1, 1.6); b.box('concrete', sx0, 0, sz0, ssx - 0.6, 0.05, ssz - 0.6); }
  if (b.d >= 2) cows(b, sx0, sz0, ssx, ssz, Math.round(ssx / 2.5));
  b.take(sx0, sz0, ssx, ssz, 0.3);
  // Weide
  fields.forEach(([fx, fz, fsx, fsz], i) => { if (i === 0) paddock(b, fx, fz, fsx, fsz, Math.max(2, Math.round((fsx * fsz) / 30))); else field(b, fx, fz, fsx, fsz, 'grass_dry', 'x'); });
  // Fahrsilo, Hochsilos, Biogas
  { const p = b.plan.find(4.2, 5.5, { prefer: 'right', pad: 0.1 }); if (p) silageBunker(b, p[0], p[1], 4.2, 5.5); }
  if (L >= 2) for (let i = 0; i < Math.min(2, L - 1); i++) { const p = b.plan.find(3.0, 3.0, { prefer: 'right', pad: 0.1 }); if (p) b.silo(p[0], p[1], 1.35, 10 + L, { mat: b.pick(['paint_blue', 'container_blue']), top: 'dome', roofMat: 'metal_light' }); }
  if (L >= 3) { const r = 2.2 + (L - 3) * 0.5; const p = b.plan.find(2 * r + 0.6, 2 * r + 0.6, { prefer: 'back', pad: 0 }); if (p) biogas(b, p[0], p[1], r); }
  if (L >= 3) b.put(6.1, 2.5, { prefer: 'back' }, (px, pz, ry) => { b.container(px, 0, pz, ry, false, 'paint_green'); b.cyl('metal_light', px, 2.6, pz, 0.18, 2.4, { seg: 6 }); b.smoke(px, 5.2, pz, 'steam', 0.3); });
  if (L >= 2) b.put(4.4, 2.5, { prefer: 'center' }, (px, pz, ry) => b.tractor(px, pz, ry, b.pick(['paint_green', 'paint_red'])));
  b.putTree(0.9, 'laub', { prefer: 'back' });
}

// Gärtnerei: Folientunnel, Glashaus (ab Stufe 2), Gemüsebeete, Heizhaus mit Schornstein
function gaertnerei(b) {
  const L = b.L;
  b.lot('dirt', 0.08);
  const { yard, fields } = farmLayout(b);
  const [yx, yz, ysx, ysz] = yard;
  if (L >= 2) {
    const gsx = Math.min(ysx - 1.2, 6 + L * 2.2), gsz = Math.min(ysz - (L >= 3 ? 1.2 : 3.4), 5 + L * 1.8);
    glasshouse(b, yx - ysx / 2 + 0.6 + gsx / 2, yz - ysz / 2 + 0.6 + gsz / 2, gsx, gsz, 3.6 + L * 0.3);
  }
  // Folientunnel
  const nt = L >= 3 ? 1 : 2 + (L === 1 ? 1 : 0);
  for (let i = 0; i < nt; i++) { const len = Math.min(ysz - 1.0, 8); const p = b.plan.find(3.6, len, { prefer: 'left', pad: 0.1 }); if (p) tunnel(b, p[0], p[1], 3.2, len, 2.4); }
  fields.forEach(([fx, fz, fsx, fsz], i) => { if (L >= 4 && i === 0 && fsx > 8 && fsz > 8) glasshouse(b, fx, fz, fsx - 1.4, fsz - 1.4, 4.6); else field(b, fx, fz, fsx, fsz, 'field_crops', fsx > fsz ? 'x' : 'z'); });
  // Heizhaus mit Schornstein ab Stufe 3
  if (L >= 3) {
    const p = b.plan.find(3.4, 3.0, { prefer: 'right', pad: 0.1 });
    if (p) { b.hall({ x: p[0], z: p[1], sx: 3.2, sz: 2.8, h: 3.4, wall: 'brick_red', roof: 'flat', roofMat: 'roof_flat_gravel', ribs: false, plinthH: 0.3, parapet: 0.4 }); b.chimney(p[0] + 0.8, p[1], { type: 'steel', h: 12 + L, r: 0.35, smoke: 0.5, kind: 'steam', mat: 'metal_light' }); }
    const q = b.plan.find(2.2, 2.2, { prefer: 'right', pad: 0.1 }); if (q) b.silo(q[0], q[1], 0.9, 4.5, { mat: 'tank_white', top: 'dome', ladder: false });
  }
  // Schuppen und Kisten
  { const p = b.plan.find(3.4, 2.8, { prefer: 'right', pad: 0.2 }); if (p) { b.hall({ x: p[0], z: p[1], sx: 3.2, sz: 2.6, h: 2.6, wall: 'wood_planks', roof: 'shed', roofMat: 'metal_corrugated', pitch: 10, ribs: false, plinthH: 0.2 }); b.door(b.face(p[0], p[1], 3.2, 2.6, 'front'), 0, { mat: 'wood_dark', canopy: false }); } }
  if (b.d >= 2) { const p = b.plan.find(2.0, 1.2, { prefer: 'front' }); if (p) for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) b.box(b.pick(['wood_planks', 'paint_green', 'paint_red']), p[0] - 0.6 + i * 0.6, k * 0.32, p[1], 0.55, 0.3, 0.4); }
  if (L >= 4) b.putTruck({ type: 'rigid', load: 'box', loadMat: 'metal_panel_white' }, { prefer: 'front' });
  else b.putVan({ prefer: 'front' }, 'paint_white');
}

// Obsthof: Baumreihen, Hofladen mit Markise und Obstkisten, Kühlhaus
function obsthof(b) {
  const L = b.L;
  b.lot('grass', 0.08);
  const { yard, fields } = farmLayout(b);
  const [yx, yz, ysx, ysz] = yard;
  b.ground('gravel', yx, yz, ysx - 0.4, ysz - 0.4, 0.1);
  // Hofladen
  const lw = Math.min(6, ysx - 1.2), ld = 3.6, lx = yx - ysx / 2 + 0.6 + lw / 2, lz = yz + ysz / 2 - 0.6 - ld / 2 - 1.0;
  const H = b.hall({ x: lx, z: lz, sx: lw, sz: ld, h: 3.0, wall: b.pick(['wood_planks', 'plaster_white', 'siding_red']), roof: 'gable', roofMat: b.pick(['roof_tiles_red', 'roof_tiles_brown']), pitch: 35, ridge: 'x', ribs: false, plinthH: 0.3, over: 0.4 });
  b.fbox(b.pick(['awning_red', 'awning_green', 'awning_striped']), H.f.front, 0, 2.2, lw - 0.4, 0.12, 1.4, 0);
  b.fplane('glass_window', H.f.front, -lw / 4, 0.7, lw / 2 - 0.6, 1.4, 0.03);
  b.fbox('door_wood', H.f.front, lw / 4, 0, 1.0, 2.1, 0.06, 0.02);
  b.sign(H.f.front, 0, 2.45, Math.min(3.6, lw - 1), 0.45, { bg: 'paint_white', logo: 'paint_red', text: 'leaves_dark' });
  b.take(lx, lz + 0.7, lw, ld + 1.4, 0.3);
  if (b.d >= 2) for (let i = 0; i < 4; i++) { const [px, pz] = H.f.front.at(-lw / 2 + 0.8 + i * 0.9, 1.0); b.box('wood_planks', px, 0, pz, 0.6, 0.6, 0.45); b.box(b.pick(['paint_red', 'paint_yellow', 'leaves_light', 'paint_green']), px, 0.6, pz, 0.55, 0.12, 0.4); }
  // Kühlhaus / Sortierhalle
  if (L >= 2) { const s = 4 + L * 0.8; const p = b.plan.find(s, 4.0, { prefer: 'back', pad: 0.2 }); if (p) { const C = b.hall({ x: p[0], z: p[1], sx: s, sz: 4.0, h: 4.4, wall: 'metal_panel_white', roof: 'flat', roofMat: 'roof_flat_membrane', ribs: false, plinthH: 0.4, parapet: 0.4 }); b.rollerDoor(C.f.front, 0, 2.6, 3.0, { mat: 'metal_panel_white' }); if (b.d >= 1) b.hvac(p[0], 4.5, p[1], 0.8); } }
  if (L >= 3) { const p = b.plan.find(7.0, 5.0, { prefer: 'back', pad: 0.2 }); if (p) barn(b, p[0], p[1], 6.6, 4.6, 4.2, { ridge: 'x', gambrel: false }); }
  // Obstbaumreihen
  fields.forEach(([fx, fz, fsx, fsz]) => {
    b.ground('grass', fx, fz, fsx, fsz, 0.1);
    b.take(fx, fz, fsx, fsz, 0);
    const rows = Math.max(1, Math.floor((fsz - 1) / 3.2)), cols = Math.max(1, Math.floor((fsx - 1) / 3.0));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const px = fx - fsx / 2 + 0.5 + (i + 0.5) * ((fsx - 1) / cols), pz = fz - fsz / 2 + 0.5 + (j + 0.5) * ((fsz - 1) / rows);
      b.tree(px, pz, 0.85, 'obst');
      if (b.d >= 2 && (i + j) % 3 === 0) b.sphere(b.pick(['paint_red', 'paint_yellow']), px + 0.6, 1.6, pz + 0.4, 0.18, { seg: 5 });
    }
  });
  if (b.d >= 2) { const p = b.plan.find(2.4, 1.0, { prefer: 'center' }); if (p) for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) b.box('wood_planks', p[0] - 0.8 + i * 0.8, k * 0.55, p[1], 0.7, 0.5, 0.6); }
  b.put(4.4, 2.5, { prefer: 'center' }, (px, pz, ry) => b.tractor(px, pz, ry, b.pick(['paint_red', 'paint_green', 'paint_orange'])));
  b.lamp(yx + ysx / 2 - 0.6, yz + ysz / 2 - 0.6, 4);
}

// Fachwerkhof (Drei-/Vierseithof): Fachwerk-Wohnhaus, Scheune mit Tor, Stall, Misthaufen, Hofbaum
function fachwerkhof(b) {
  const L = b.L;
  b.lot('pavers', 0.08);
  const { yard, fields } = farmLayout(b);
  const [yx, yz, ysx, ysz] = yard;
  fields.forEach(([fx, fz, fsx, fsz], i) => field(b, fx, fz, fsx, fsz, i ? 'field_rapeseed' : b.pick(CROPS), fsx > fsz ? 'x' : 'z'));
  const roof = b.pick(['roof_tiles_red', 'roof_tiles_brown', 'roof_tiles_red']);
  const wall = b.pick(['plaster_white', 'plaster_cream', 'plaster_ochre']);
  // Wohnhaus (Fachwerk) links
  const hw = Math.min(5.0, ysx * 0.38), hd = Math.min(ysz - 1.2, 7.0);
  farmhouse(b, yx - ysx / 2 + 0.5 + hw / 2, yz - ysz / 2 + 0.6 + hd / 2, hw, hd, { fachwerk: true, wall, roof, floors: 2 });
  // Scheune hinten
  const bw = Math.min(ysx - hw - 1.4, 8), bd = Math.min(4.6, ysz * 0.45);
  barn(b, yx + ysx / 2 - 0.5 - bw / 2, yz - ysz / 2 + 0.5 + bd / 2, bw, bd, 4.2, { ridge: 'x', wall: b.pick(['wood_dark', 'wood_planks', 'brick_red']), roof, gambrel: false, pitchK: 0.9 });
  // Stall (ab Stufe 2) vorne rechts
  if (L >= 2 && ysz > 9) { const sw = Math.min(bw, 7), sd = 3.6; const sx0 = yx + ysx / 2 - 0.5 - sw / 2, sz0 = yz + ysz / 2 - 0.5 - sd / 2; farmhouse(b, sx0, sz0, sw, sd, { fachwerk: true, wall, roof, floors: 1 }); }
  // Misthaufen, Hofbaum, Hühner
  { const p = b.plan.find(2.6, 2.6, { prefer: 'center', pad: 0.2 }); if (p) { b.box('concrete', p[0], 0, p[1], 2.4, 0.4, 2.4); b.cone('dirt', p[0], 0.4, p[1], 1.0, 0.9, { seg: 7 }); } }
  b.putTree(L >= 3 ? 1.1 : 0.9, 'laub', { prefer: 'center' });
  if (b.d >= 2) for (let i = 0; i < 6; i++) { const px = yx + (b.r() - 0.5) * ysx * 0.4, pz = yz + (b.r() - 0.2) * ysz * 0.3; if (b.plan.free(px, pz, 0.4, 0.4)) b.box('paint_white', px, 0, pz, 0.25, 0.3, 0.4, b.r() * PI); }
  if (L >= 3) { const p = b.plan.find(2.8, 2.8, { prefer: 'right', pad: 0.1 }); if (p) b.silo(p[0], p[1], 1.2, 9 + L, { mat: 'concrete', top: 'cone', roofMat: roof }); }
  b.put(4.4, 2.5, { prefer: 'front' }, (px, pz, ry) => b.tractor(px, pz, ry, b.pick(['paint_red', 'paint_green', 'paint_orange']), L >= 2 ? 'hay' : null));
  if (L >= 2) { const p = b.plan.find(5.0, 1.6, { prefer: 'front', pad: 0 }); if (p) bales(b, p[0], p[1], 3, 'hay', HP); }
}

// Masthof: lange, niedrige Ställe mit Lüfterkaminen und Futtersilos, Güllebehälter
function masthof(b) {
  const { W, X, Z } = geom(b);
  const L = b.L;
  b.lot('gravel', 0.08);
  const { fields } = farmLayout(b);
  const nh = Math.min(4, 1 + Math.floor(L / 2) + (b.fw * b.fd >= 2 ? 1 : 0));
  const along = b.W >= b.D;
  const hl = (along ? W : b.D) - 4.2, hw = 4.2;
  const across = along ? b.D : W;
  const pitch = Math.min(5.4, (across - 1.0) / nh);
  for (let i = 0; i < nh; i++) {
    const t = -across / 2 + 0.6 + hw / 2 + i * pitch;
    if (t + hw / 2 > across / 2 - 0.4) break;
    const hx = along ? -1.4 : t, hz = along ? t : -1.4;
    const sx = along ? hl : hw, sz = along ? hw : hl;
    const H = b.hall({ x: hx, z: hz, sx, sz, h: 2.8, wall: b.pick(['plaster_white', 'metal_panel_white', 'concrete_panel']), roof: 'gable', roofMat: b.pick(['roof_metal_grey', 'metal_corrugated_green', 'roof_tiles_anthracite']), pitch: 18, ridge: along ? 'x' : 'z', ribs: false, plinthH: 0.3, over: 0.3, gutter: false });
    const ls = along ? ['front', 'back'] : ['left', 'right'];
    for (const s of ls) b.band(H.f[s], -H.f[s].len / 2 + 0.8, H.f[s].len / 2 - 0.8, 1.2, 0.6, { glass: 'glass_window', part: 8, mull: 2.0 });
    const n = Math.max(2, Math.floor(hl / 4));
    if (b.d >= 1) for (let k = 0; k < n; k++) { const a = -hl / 2 + 1.5 + (k * (hl - 3)) / Math.max(1, n - 1); b.cyl('metal_light', along ? hx + a : hx, 3.4, along ? hz : hz + a, 0.35, 1.2, { seg: 8 }); }
    b.take(hx, hz, sx, sz, 0.3);
    // Futtersilos am Ende
    const fx = along ? hx + hl / 2 + 1.5 : hx, fz = along ? hz : hz + hl / 2 + 1.5;
    b.silo(fx, fz, 0.85, 5.5, { mat: b.pick(['metal_light', 'container_green', 'tank_white']), legs: 2.2, top: 'cone', ladder: false });
    if (b.d >= 2) b.pipe('metal_light', [fx, 2.2, fz], [along ? fx - 1.4 : fx, 2.2, along ? fz : fz - 1.4], 0.12);
    b.take(fx, fz, 1.8, 1.8, 0.1);
  }
  if (L >= 3) { const p = b.plan.find(6.4, 6.4, { prefer: 'right', pad: 0 }); if (p) { b.cyl('concrete', p[0], 0, p[1], 2.9, 2.0, { seg: 16 }); b.cyl('dirt', p[0], 1.6, p[1], 2.7, 0.2, { seg: 16 }); b.take(p[0], p[1], 6, 6, 0); } }
  if (L >= 4) { const p = b.plan.find(5.6, 5.6, { prefer: 'back', pad: 0 }); if (p) biogas(b, p[0], p[1], 2.5); }
  fields.forEach(([fx, fz, fsx, fsz]) => { if (b.plan.free(fx, fz, fsx - 0.4, fsz - 0.4)) field(b, fx, fz, fsx, fsz, 'field_crops', 'x'); });
  b.putTruck({ type: 'rigid', load: 'tank', loadMat: 'tank_white' }, { prefer: 'front' });
  b.lamp(X - 0.5, Z - 0.5, 5);
}

export const FARM = [ackerhof, milchhof, gaertnerei, obsthof, fachwerkhof, masthof];
export function buildFarm(ctx) {
  const b = new B(ctx);
  FARM[ctx.variant % FARM.length](b);
  return b.finish();
}
