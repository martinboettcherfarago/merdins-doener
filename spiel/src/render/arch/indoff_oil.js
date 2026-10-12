// Spezialindustrie Erdöl ('oil') – Archetypen, die mit der Stufe wachsen (Besitzer: G4).
// Pumpenböcke mit drehender Kurbel und Gegengewichten (animiert über res.anim), Bohrturm, Tanklager,
// Gasaufbereitung mit Fackel, Verladestation, Pumpstation.
import * as THREE from 'three';
import { B, PI, HP, clamp } from './indoff_parts.js';

const geom = (b) => ({ W: b.W, D: b.D, X: b.W / 2, Z: b.D / 2, wide: b.W > 10, deep: b.D > 10 });
const JACK = ['paint_yellow', 'paint_blue', 'paint_red', 'metal_dark', 'paint_green', 'paint_orange'];

// Pumpenbock (Pferdekopfpumpe). Länge ≈ 8·s m entlang der Richtung ry (nur 0, ±π/2, π), Pferdekopf vorne.
// Kurbel mit Gegengewichten dreht sich (res.anim, Achse quer zum Balancier).
export function pumpjack(b, x, z, ry, s = 1, o = {}) {
  const col = o.color || b.pick(JACK), head = o.head || (col === 'metal_dark' ? 'paint_yellow' : b.chance(0.5) ? col : 'metal_dark');
  const P = b.T(x, z, ry);
  const at = (f, l, y, sx, sy, sz, mat) => { const [px, pz] = P(f * s, l * s); b.box(mat, px, y * s, pz, sx * s, sy * s, sz * s, ry); };
  const pt = (f, l, y) => { const [px, pz] = P(f * s, l * s); return [px, y * s, pz]; };
  // Fundament und Grundrahmen
  at(-0.6, 0, 0, 2.2, 0.25, 7.6, 'concrete');
  at(-0.6, 0, 0.25, 1.4, 0.3, 6.8, 'metal_dark');
  // Bockgerüst (Samson-Post)
  for (const l of [-0.7, 0.7]) {
    b.beam(col, pt(0.8, l, 0.5), pt(0, l * 0.35, 4.3), 0.22 * s, 0.22 * s);
    if (b.d >= 1) b.beam(col, pt(-0.8, l, 0.5), pt(0, l * 0.35, 4.3), 0.22 * s, 0.22 * s);
  }
  if (b.d >= 2) b.beam(col, pt(0, -0.55, 2.2), pt(0, 0.55, 2.2), 0.12 * s, 0.12 * s);
  // Balancier mit Pferdekopf
  b.beam(col, pt(-2.7, 0, 4.45), pt(3.0, 0, 4.65), 0.38 * s, 0.55 * s);
  at(3.25, 0, 3.55, 0.5, 2.0, 0.55, head);
  if (b.d >= 1) b.beam(head, pt(3.0, 0, 5.4), pt(3.45, 0, 4.9), 0.48 * s, 0.4 * s);
  // Seil und Bohrlochkopf („Christbaum")
  if (b.d >= 1) b.beam('metal_dark', pt(3.5, 0, 3.6), pt(3.5, 0, 1.3), 0.05 * s, 0.05 * s);
  if (b.d >= 1) { const [px, , pz] = pt(3.5, 0, 0); b.cyl('metal_light', px, 0.25 * s, pz, 0.18 * s, 1.1 * s, { seg: 8 }); b.cyl('paint_red', px, 0.8 * s, pz, 0.3 * s, 0.15 * s, { seg: 8 }); }
  // Getriebe, Pleuel (statisch), Motor
  at(-2.7, 0, 0.55, 1.0, 1.1, 1.1, 'metal_dark');
  if (b.d >= 1) { for (const l of [-0.45, 0.45]) b.beam(col, pt(-2.7, l, 4.35), pt(-2.95, l, 2.3), 0.12 * s, 0.12 * s); at(-4.0, 0, 0.55, 0.8, 0.7, 1.0, 'paint_blue'); }
  // Kurbel und Gegengewichte (animiert)
  const pv = pt(-2.7, 0, 1.15);
  const axis = Math.abs(Math.sin(ry)) > 0.5 ? 'z' : 'x';
  const speed = (o.speed ?? 0.9) * (b.chance(0.5) ? 1 : -1) * (0.85 + b.r() * 0.3);
  b.spin(pv, axis, speed, (sb) => {
    const Q = sb.T(0, 0, ry);
    for (const l of [-0.7, 0.7]) {
      const [a0, b0] = Q(-0.6 * s, l * s), [a1, b1] = Q(-1.25 * s, l * s);
      sb.boxc(col === 'metal_dark' ? 'metal_light' : 'metal_dark', a0, 0, b0, 0.18 * s, 0.32 * s, 1.5 * s, { ry });
      sb.boxc(col, a1, 0, b1, 0.26 * s, 1.15 * s, 1.0 * s, { ry });
    }
    const [c0, c1] = Q(0, 0);
    sb.g('metal_dark', new THREE.CylinderGeometry(0.16 * s, 0.16 * s, 1.6 * s, 8).rotateZ(HP), c0, 0, c1, { ry });
  });
  b.take(...P(-0.6 * s, 0), Math.abs(Math.sin(ry)) > 0.5 ? 7.8 * s : 2.4 * s, Math.abs(Math.sin(ry)) > 0.5 ? 2.4 * s : 7.8 * s, 0.4);
}
// Pumpenbock mit Zaun an freier Stelle
function putJack(b, s = 1, f = {}) {
  return b.put(8.4 * s, 2.8 * s, { pad: 0.6, ...f }, (x, z, ry) => {
    const r = Math.round(ry / HP) * HP;
    pumpjack(b, x, z, r, s);
    if (b.d >= 1 && f.fence !== false) {
      const along = Math.abs(Math.sin(r)) > 0.5, hx = (along ? 8.6 * s : 3.0 * s) / 2, hz = (along ? 3.0 * s : 8.6 * s) / 2;
      const [cx, cz] = b.T(x, z, r)(-0.6 * s, 0);
      b.fence(cx - hx, cz - hz, cx + hx, cz - hz, 1.4); b.fence(cx - hx, cz + hz, cx + hx, cz + hz, 1.4);
      b.fence(cx - hx, cz - hz, cx - hx, cz + hz, 1.4); b.fence(cx + hx, cz - hz, cx + hx, cz + hz, 1.4);
    }
  });
}
// Liegender Abscheider auf Sätteln
function separator(b, x, z, len, r, ry = 0, mat = 'tank_white') {
  const s = Math.sin(ry), c = Math.cos(ry);
  b.g(mat, new THREE.CylinderGeometry(r, r, len, b.seg(12)).rotateX(HP), x, r + 0.6, z, { ry });
  if (b.d >= 1) for (const t of [-0.32, 0.32]) b.box('concrete', x + s * t * len, 0, z + c * t * len, r * 1.6, 0.8, 0.5, ry);
  if (b.d >= 2) { b.cyl('pipe_metal', x, 2 * r + 0.6, z, 0.12, 1.2, { seg: 6 }); b.cyl('paint_red', x + s * len * 0.3, 2 * r + 0.6, z + c * len * 0.3, 0.2, 0.4, { seg: 6 }); }
}
// Fackel mit Flamme und Abspannseilen
function flare(b, x, z, h) {
  b.cyl('metal_light', x, 0, z, 0.35, h, { seg: 8 });
  if (b.d >= 1) { b.cyl('paint_red', x, h - 2.2, z, 0.38, 1.0, { seg: 8, open: true }); b.cyl('paint_white', x, h - 3.2, z, 0.38, 1.0, { seg: 8, open: true }); b.cone('emissive_warm', x, h, z, 0.32, 1.1, { seg: 6 }); }
  const gr = Math.min(h * 0.32, 2.2, b.W / 2 - Math.abs(x) - 0.3, b.D / 2 - Math.abs(z) - 0.3);
  if (b.d >= 2 && gr > 0.8) for (let k = 0; k < 3; k++) { const a = (k / 3) * PI * 2 + 0.5; b.beam('metal_dark', [x, h * 0.7, z], [x + Math.cos(a) * gr, 0, z + Math.sin(a) * gr], 0.04, 0.04); }
  b.smoke(x, h + 1.0, z, 'smoke', 0.9);
  b.light(x, h + 1.0, z, 0xff7a2a, 0.6);
  b.takeC(x, z, 0.6, 0.2);
}
// Auffangwanne (Betonwall) um ein Rechteck
function bund(b, x, z, sx, sz, h = 0.8) {
  b.box('concrete', x, 0, z - sz / 2 + 0.15, sx, h, 0.3); b.box('concrete', x, 0, z + sz / 2 - 0.15, sx, h, 0.3);
  b.box('concrete', x - sx / 2 + 0.15, 0, z, 0.3, h, sz - 0.6); b.box('concrete', x + sx / 2 - 0.15, 0, z, 0.3, h, sz - 0.6);
  if (b.d >= 1) b.box('gravel', x, 0, z, sx - 0.6, 0.15, sz - 0.6);
}
// Rohrleitung am Boden auf kleinen Stützen mit Schiebern
function flowline(b, a, c, r = 0.18, mat = 'pipe_metal') {
  const y = 0.6;
  b.pipe(mat, [a[0], y, a[1]], [c[0], y, c[1]], r);
  if (b.d >= 1) { const len = Math.hypot(c[0] - a[0], c[1] - a[1]), n = Math.max(1, Math.floor(len / 3)); for (let i = 1; i < n; i++) { const t = i / n; b.box('concrete', a[0] + (c[0] - a[0]) * t, 0, a[1] + (c[1] - a[1]) * t, 0.4, 0.45, 0.4); } }
  if (b.d >= 2) { const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2; b.cyl('paint_red', mx, y + 0.2, mz, 0.06, 0.5, { seg: 5, exact: true }); b.g('paint_red', new THREE.TorusGeometry(0.28, 0.05, 4, 10), mx, y + 0.75, mz, { rx: HP }); }
}
// Bohrturm (Gittermast) auf Unterbau mit Arbeitsbühne
function derrick(b, x, z, H, o = {}) {
  const col = o.color || b.pick(['paint_red', 'paint_white', 'paint_orange', 'paint_yellow']);
  const k0 = o.scale ?? 1, sub = 5.0 * k0, w = 2.8 * k0, wt = 0.75, e = 3.0 * k0;
  // Unterbau
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('metal_dark', x + sx * e, 0, z + sz * e, 0.5, sub, 0.5);
  if (b.d >= 1) for (const sz of [-1, 1]) { b.beam('metal_dark', [x - e, 0.5, z + sz * e], [x + e, sub - 0.5, z + sz * e], 0.25, 0.25); b.beam('metal_dark', [x + e, 0.5, z + sz * e], [x - e, sub - 0.5, z + sz * e], 0.25, 0.25); }
  b.box('metal_dark', x, sub, z, 2 * e + 1.2, 0.5, 2 * e + 1.2);
  // Mast
  const y0 = sub + 0.5, corner = (sx, sz, t) => [x + sx * (w + (wt - w) * t), y0 + H * t, z + sz * (w + (wt - w) * t)];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.beam(col, corner(sx, sz, 0), corner(sx, sz, 1), 0.3, 0.3);
  const lv = Math.max(3, Math.round(H / 4));
  for (let k = 1; k <= lv; k++) {
    const t = k / lv;
    if (b.d === 0 && k % 2) continue;
    for (const [a, c] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) b.beam(col, corner(a[0], a[1], t), corner(c[0], c[1], t), 0.16, 0.16);
    if (b.d >= 2) {
      const t0 = (k - 1) / lv;
      for (const [a, c] of [[[-1, -1], [1, -1]], [[1, 1], [-1, 1]], [[1, -1], [1, 1]], [[-1, 1], [-1, -1]]]) b.beam(col, corner(a[0], a[1], t0), corner(c[0], c[1], t), 0.08, 0.08);
    }
  }
  b.box(col, x, y0 + H, z, 2.2, 1.2, 2.2);
  if (b.d >= 1) { b.box('metal_dark', x, y0 + H * 0.62, z + w * 0.5, 2.6, 0.2, 1.2); b.box('metal_dark', x, y0 + H * 0.3, z, 1.0, 1.2, 0.8); }
  if (b.d >= 2) b.beam('metal_dark', [x, y0 + H, z], [x, y0 + H * 0.3 + 1.2, z], 0.06, 0.06);
  // Bohrmeisterkabine auf der Bühne und Rampe
  b.box(o.house || 'metal_panel_white', x - e + 0.6, sub + 0.5, z - e + 1.4, 1.8, 2.6, 2.6);
  if (b.d >= 1) b.beam('metal_dark', [x, sub + 0.5, z + e + 0.6], [x, 0.3, z + e + 0.6 + (o.ramp ?? 6.0)], 1.4, 0.3);
  for (let k = 0; k < 4; k++) b.light(x + (k % 2 ? 1 : -1) * w * (1 - k / 4), y0 + H * (0.2 + k * 0.22), z + w * (1 - k / 4), 0xfff1c8, 0.35);
  b.light(x, y0 + H + 1.4, z, 0xff2a20, 0.3);
}

// =====================================================================================
// Archetypen
// =====================================================================================

// Pumpenfeld: Pferdekopfpumpen, kleine Tanks, Abscheider, Feldleitungen
function pumpenfeld(b) {
  const { X, Z, wide, deep } = geom(b);
  const L = b.L;
  b.lot('dirt', 0.08);
  const area = b.fw * b.fd;
  const nj = clamp(Math.round(area * (L >= 3 ? 1.5 : 1.0) + (L >= 4 ? 1 : 0)), 1, 6);
  const s = 0.85 + b.r() * 0.2;
  // Tanks am Rand
  const nt = Math.min(1 + Math.floor(L / 2), area >= 2 ? 3 : 2);
  const tr = 1.3 + L * 0.12;
  const tpos = [];
  for (let i = 0; i < nt; i++) { const p = b.plan.find(2 * tr + 1.6, 2 * tr + 1.6, { prefer: 'back', pad: 0 }); if (p) { b.tank(p[0], p[1], tr, 3.5 + L * 0.5, { mat: b.pick(['tank_white', 'rust', 'metal_light']), roof: 'cone', band: 'paint_red' }); tpos.push(p); } }
  for (let i = 0; i < nj; i++) { const p = putJack(b, s, { prefer: i % 2 ? 'left' : 'right' }); if (p && tpos[0]) flowline(b, [p[0], p[1]], [tpos[0][0], tpos[0][1]]); }
  if (L >= 2) b.put(4.6, 2.6, { prefer: 'center' }, (px, pz, ry) => separator(b, px, pz, 4.0, 0.8, ry));
  if (L >= 3 || wide || deep) b.putTruck({ type: 'rigid', load: 'tank', loadMat: 'metal_light', cab: 'paint_white' }, { prefer: 'front' });
  b.put(2.4, 2.0, { prefer: 'front' }, (px, pz) => { b.box('metal_panel_white', px, 0.2, pz, 2.2, 2.5, 1.8); b.fplane('glass_window', b.face(px, pz, 2.2, 1.8, 'front'), 0, 1.2, 1.0, 0.8, 0.03); });
  b.lamp(X - 0.5, Z - 0.5, 6);
}

// Bohrturm: Gittermast auf Unterbau, Spülungstanks, Rohrlager, Generatoren
function bohrturm(b) {
  const { X, Z, wide, deep } = geom(b);
  const L = b.L;
  b.lot('gravel', 0.08);
  const small = !wide && !deep, k0 = small ? 0.72 : 1;
  const H = (16 + L * 6) * (small ? 0.8 : 1);
  const e = 3.0 * k0 + 0.6;
  const dx = wide ? -X + 4.5 : 0, dz = deep ? -Z + 5.0 : -Z + 0.4 + e;
  const ramp = clamp(Z - 0.4 - (dz + 3.0 * k0 + 0.6), 1.5, 6.0);
  derrick(b, dx, dz, H, { scale: k0, ramp });
  b.take(dx, dz + ramp / 2, 2 * e, 2 * e + ramp, 0.2);
  // Rohrlager
  { const p = b.plan.find(7.0, 2.6, { prefer: 'front', pad: 0.2 }); if (p) { if (b.d >= 1) for (const t of [-2.6, 0, 2.6]) b.box('metal_dark', p[0] + t, 0, p[1], 0.3, 0.8, 2.4); for (let i = 0; i < (b.d >= 1 ? 3 : 1); i++) for (let k = 0; k < (b.d >= 1 ? 2 : 1); k++) b.hcyl('pipe_metal', p[0], 0.95 + k * 0.32, p[1] - 0.6 + i * 0.6, 0.15, 6.6, 'x', { seg: 6 }); } }
  // Spülungstanks und Generatoren
  const nm = 1 + Math.min(2, Math.floor(L / 2));
  for (let i = 0; i < nm; i++) b.put(7.0, 2.6, { prefer: 'left', pad: 0.2 }, (px, pz, ry) => { b.box(b.pick(['metal_corrugated_red', 'metal_panel_grey', 'metal_corrugated']), px, 0.3, pz, 2.6, 2.4, 7.0, ry); if (b.d >= 2) b.box('metal_dark', px, 2.7, pz, 2.7, 0.1, 7.1, ry); });
  for (let i = 0; i < (wide || deep ? 2 : 1); i++) b.put(6.1, 2.5, { prefer: 'right', pad: 0.2 }, (px, pz, ry) => { b.container(px, 0.2, pz, ry, false, 'paint_white'); const [ex, ez] = b.T(px, pz, ry)(1.8); b.cyl('metal_dark', ex, 2.8, ez, 0.15, 1.4, { seg: 6 }); b.smoke(ex, 4.4, ez, 'smoke', 0.25); });
  if (wide && deep) putJack(b, 1.0, { prefer: 'right' });
  if (wide || deep) b.put(6.0, 2.5, { prefer: 'front' }, (px, pz, ry) => { b.box('metal_panel_white', px, 0.2, pz, Math.abs(Math.sin(ry)) > 0.5 ? 6 : 2.5, 2.6, Math.abs(Math.sin(ry)) > 0.5 ? 2.5 : 6); });
  b.lamp(X - 0.5, Z - 0.5, 8);
}

// Tanklager: große Tanks in Auffangwannen, Treppen, Rohrverteiler, Pumpenbock
function tanklager(b) {
  const { W, D, X, Z } = geom(b);
  const L = b.L;
  b.lot('concrete', 0.08);
  const area = b.fw * b.fd;
  const tr = clamp(1.6 + L * 0.35 + (area >= 4 ? 0.8 : 0), 1.4, Math.min(4.2, (D - 5.4) / 2, (W - 2.8) / 2)), th = 4 + L * 1.2;
  const cell = 2 * tr + 1.8;
  const cols = Math.max(1, Math.floor((W - 1.0) / cell)), rows = Math.max(1, Math.floor((D - 3.2) / cell));
  const bx = 0, bz = -Z + 0.5 + (rows * cell) / 2;
  bund(b, bx, bz, cols * cell, rows * cell, 1.0);
  const mat = b.pick(['tank_white', 'tank_white', 'metal_light']), band = b.pick(['paint_blue', 'paint_red', 'paint_green', 'paint_yellow']);
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) b.tank(bx - (cols * cell) / 2 + (i + 0.5) * cell, bz - (rows * cell) / 2 + (j + 0.5) * cell, tr, th, { mat, roof: b.chance(0.5) ? 'cone' : 'flat', band, pipeA: HP });
  b.take(bx, bz, cols * cell, rows * cell, 0.2);
  // Rohrverteiler vor den Tanks
  const mz = bz + (rows * cell) / 2 + 0.9;
  b.pipeRack(-X + 0.6, mz, X - 0.6, mz, 2.2, { w: 1.2, pipes: [['pipe_metal', 0.22], ['paint_yellow', 0.16], ['pipe_metal', 0.18]] });
  b.take(0, mz, W - 1, 1.6, 0);
  if (area >= 2) putJack(b, 0.95, { prefer: 'front' });
  b.put(3.0, 2.6, { prefer: 'front' }, (px, pz) => { b.hall({ x: px, z: pz, sx: 2.8, sz: 2.4, h: 2.8, wall: 'metal_panel_grey', roof: 'flat', ribs: false, plinthH: 0.2, parapet: 0.3 }); b.sign(b.face(px, pz, 2.8, 2.4, 'front'), 0, 1.8, 2.2, 0.5, {}); });
  if (L >= 3) b.putTruck({ type: 'semi', load: 'tank', loadMat: 'metal_light' }, { prefer: 'front' });
  b.fenceLot(0, 0, W - 0.3, D - 0.3, { gate: 5, ga: 0 });
  b.lamp(X - 0.5, Z - 0.5, 8);
}

// Gasaufbereitung: Abscheider, Kugelbehälter, Kolonnen, Fackel, Leitstand
function gasanlage(b) {
  const { W, D, X, Z, wide, deep } = geom(b);
  const L = b.L;
  b.lot('gravel', 0.08);
  // Fackel hinten
  { const p = b.plan.find(4.6, 4.6, { prefer: 'back', pad: 0 }); if (p) flare(b, p[0], p[1], 16 + L * 4); }
  // Kugelbehälter ab Stufe 2
  for (let i = 0; i < (L >= 2 ? (wide && deep ? 2 : 1) : 0); i++) { const r = 2.0 + L * 0.2; const p = b.plan.find(2 * r + 2.4, 2 * r + 2.4, { prefer: 'back', pad: 0 }); if (p) b.sphereTank(p[0], p[1], r, {}); }
  // Kolonnen ab Stufe 3
  for (let i = 0; i < (L >= 3 ? 1 + (wide ? 1 : 0) : 0); i++) {
    const p = b.plan.find(2.8, 2.8, { prefer: 'right', pad: 0.2 });
    if (p) { b.cyl('metal_light', p[0], 0, p[1], 0.8, 12 + L * 2, { seg: 12 }); b.dome('metal_light', p[0], 12 + L * 2, p[1], 0.8, 0.5, { seg: 12 }); if (b.d >= 1) for (let k = 1; k < 3; k++) b.cyl('metal_dark', p[0], (k * (12 + L * 2)) / 3, p[1], 1.5, 0.15, { seg: 12 }); }
  }
  // Abscheider
  for (let i = 0; i < 1 + Math.min(2, Math.floor(L / 2)); i++) b.put(5.0, 2.4, { prefer: 'center' }, (px, pz, ry) => separator(b, px, pz, 4.4, 0.85, ry, i % 2 ? 'metal_light' : 'tank_white'));
  // Rohrbrücke
  b.pipeRack(-X + 0.5, deep ? 1 : Z - 3.4, X - 0.5, deep ? 1 : Z - 3.4, 4.0, { w: 1.4 });
  b.take(0, deep ? 1 : Z - 3.4, W - 1, 1.8, 0);
  // Leitstand
  b.put(6.0, 2.6, { prefer: 'front' }, (px, pz, ry) => { b.container(px, 0.2, pz, ry, false, 'metal_panel_white'); if (b.d >= 1) { const [qx, qz] = b.T(px, pz, ry)(0, 1.25); b.plane('glass_window', qx, 1.6, qz, 3.0, 0.9, ry + HP); } });
  if (W > 10 || D > 10) putJack(b, 0.9, { prefer: 'front' });
  b.fenceLot(0, 0, W - 0.3, D - 0.3, { gate: 4, ga: 1 });
  b.lamp(-X + 0.5, Z - 0.5, 8);
}

// Verladestation: Füllstraße mit Dach und Ladearmen (entlang x an der Front), Tankwagen, Tanks, Pumpenhaus
function verladestation(b) {
  const { W, D, X, Z, deep } = geom(b);
  const L = b.L;
  b.lot('concrete', 0.08);
  const lw = 4.4, ll = W - 1.4, lz = Z - 0.6 - lw / 2;
  // Füllstraße mit Dach
  if (b.d >= 1) for (const s of [-1, 1]) for (let i = 0; i <= Math.round(ll / 6); i++) b.box('metal_dark', -ll / 2 + 0.3 + (i * (ll - 0.6)) / Math.round(ll / 6), 0, lz + s * (lw / 2 - 0.2), 0.3, 5.4, 0.3);
  b.box('metal_panel_white', 0, 5.4, lz, ll, 0.5, lw + 1.0);
  if (b.d >= 1) b.box('paint_green', 0, 5.4, lz + lw / 2 + 0.5, ll, 0.5, 0.05);
  if (b.d >= 1) for (let i = 0; i < Math.max(1, Math.floor(ll / 8)); i++) {
    const ax = -ll / 2 + 4 + i * 8;
    b.box('metal_light', ax, 0, lz - lw / 2 + 0.3, 1.4, 4.6, 0.6);
    if (b.d >= 2) b.beam('metal_light', [ax, 4.4, lz - lw / 2 + 0.4], [ax + 0.4, 3.9, lz], 0.15, 0.15);
  }
  b.truck(0, lz, HP, { type: ll > 17 ? 'semi' : 'rigid', load: 'tank', loadMat: b.pick(['metal_light', 'tank_white']), cab: b.pick(['paint_white', 'paint_green', 'paint_red']) });
  b.light(0, 5.2, lz, 0xfff1c8, 0.45);
  b.sign(b.face(0, lz, ll, lw + 1.0, 'front'), 0, 5.4, Math.min(5, ll * 0.4), 0.5, { logo: 'paint_green' });
  b.take(0, lz, W - 1, lw + 1.0, 0.1);
  // Tanks dahinter
  const free = D - lw - 2.4, tr = clamp(free / 2 - 1.0, 1.1, 1.6 + L * 0.3), nt = Math.max(1, Math.floor((W - 1) / (2 * tr + 1.8)));
  for (let i = 0; i < nt; i++) { const p = b.plan.find(2 * tr + 1.6, 2 * tr + 1.6, { prefer: 'back', pad: 0 }); if (p) b.tank(p[0], p[1], tr, 3.5 + L, { mat: 'tank_white', roof: 'dome', band: 'paint_green' }); }
  b.put(3.4, 3.0, { prefer: 'left' }, (px, pz) => { const H = b.hall({ x: px, z: pz, sx: 3.2, sz: 2.8, h: 3.2, wall: 'brick_red', roof: 'flat', ribs: false, plinthH: 0.3, parapet: 0.4 }); b.door(H.f.front, 0, {}); });
  if (deep) b.putTruck({ type: 'rigid', load: 'tank', loadMat: 'metal_light' }, { prefer: 'center' });
  b.fenceLot(0, 0, W - 0.3, D - 0.3, { gate: 5, ga: 0, front: false });
  b.lamp(X - 0.5, -Z + 0.5, 7);
}

// Pumpstation: Pumpenhaus, Rohrverteiler mit Schiebern, Molchschleuse, Pumpenböcke, Verdichterhalle
function pumpstation(b) {
  const { W, D, X, Z, wide, deep } = geom(b);
  const L = b.L;
  b.lot('gravel', 0.08);
  const hw = Math.min(W - 2.0, 6 + L), hd = 4.0;
  const hx = -X + 0.6 + hw / 2, hz = -Z + 0.6 + hd / 2;
  const H = b.hall({ x: hx, z: hz, sx: hw, sz: hd, h: 4.2, wall: b.pick(['brick_red', 'metal_panel_grey', 'metal_corrugated_green']), roof: 'gable', roofMat: 'roof_metal_grey', pitch: 18, ridge: 'x', ribs: false, plinthH: 0.4 });
  b.winRow(H.f.front, -hw / 2 + 0.8, hw / 2 - 2.4, 1.4, 1.2, 1.4, { spacing: 2.0 });
  b.rollerDoor(H.f.front, hw / 2 - 1.4, 2.2, 3.0, {});
  b.take(hx, hz, hw, hd, 0.3);
  // Rohrverteiler (Manifold)
  const mz = hz + hd / 2 + 1.6, nl = 2 + Math.min(3, L);
  for (let i = 0; i < nl; i++) {
    const px = -X + 1.2 + i * ((W - 2.4) / Math.max(1, nl - 1));
    b.pipe('pipe_metal', [px, 0.8, mz - 1.2], [px, 0.8, mz + 1.2], 0.2);
    if (b.d >= 1) b.cyl('paint_yellow', px, 0.5, mz, 0.3, 0.65, { seg: 8 });
    if (b.d >= 2) b.g('paint_red', new THREE.TorusGeometry(0.3, 0.05, 4, 10), px, 1.45, mz, { rx: HP });
  }
  b.pipe('pipe_metal', [-X + 1.0, 0.8, mz + 1.2], [X - 1.0, 0.8, mz + 1.2], 0.25);
  b.take(0, mz, W - 1, 3.0, 0);
  // Molchschleuse
  b.put(5.2, 1.6, { prefer: 'right' }, (px, pz, ry) => { b.g('paint_yellow', new THREE.CylinderGeometry(0.45, 0.45, 4.0, b.seg(10)).rotateX(HP), px, 1.0, pz, { ry }); const [ex, ez] = b.T(px, pz, ry)(2.1); b.g('metal_dark', new THREE.CylinderGeometry(0.7, 0.7, 0.3, b.seg(10)).rotateX(HP), ex, 1.0, ez, { ry }); });
  // Verdichterhalle mit Luftkühlern ab Stufe 3
  if (L >= 3 && (wide || deep)) {
    const p = b.plan.find(7.0, 5.0, { prefer: 'back', pad: 0.2 });
    if (p) {
      b.hall({ x: p[0], z: p[1], sx: 6.8, sz: 4.8, h: 6, wall: 'metal_panel_white', roof: 'flat', roofMat: 'roof_flat_membrane', ribs: false, plinthH: 0.4 });
      b.chimney(p[0] + 2.4, p[1] - 1.4, { type: 'steel', h: 12, r: 0.4, smoke: 0.4, kind: 'steam', mat: 'metal_light' });
      const q = b.plan.find(6.0, 3.2, { prefer: 'back', pad: 0.2 });
      if (q) { if (b.d >= 1) for (const s of [-1, 1]) for (const t of [-1, 1]) b.box('metal_dark', q[0] + s * 2.8, 0, q[1] + t * 1.4, 0.25, 3.0, 0.25); b.box('metal_light', q[0], 3.0, q[1], 6.0, 0.9, 3.0); if (b.d >= 1) for (let i = 0; i < 3; i++) b.cyl('metal_dark', q[0] - 2 + i * 2, 3.9, q[1], 0.85, 0.1, { seg: 12 }); }
    }
  }
  const nj = Math.min(1 + Math.floor(L / 2), b.fw * b.fd >= 2 ? 3 : 1);
  for (let i = 0; i < nj; i++) putJack(b, 0.9, { prefer: i % 2 ? 'left' : 'front' });
  b.fenceLot(0, 0, W - 0.3, D - 0.3, { gate: 4, ga: X / 2 });
  b.lamp(X - 0.5, Z - 0.5, 6);
}

export const OIL = [pumpenfeld, bohrturm, tanklager, gasanlage, verladestation, pumpstation];
export function buildOil(ctx) {
  const b = new B(ctx);
  OIL[ctx.variant % OIL.length](b);
  return b.finish();
}
