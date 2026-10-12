// Spezialindustrie Forstwirtschaft ('forest') – Archetypen, die mit der Stufe wachsen (Besitzer: G4).
// Forsthaus mit Holzpolter, Sägewerk mit offener Sägehalle, Holzhof mit Portalkran, Köhlerei,
// Pelletwerk, Baumschule mit Harvester.
import * as THREE from 'three';
import { B, PI, HP, clamp } from './indoff_parts.js';

const geom = (b) => ({ W: b.W, D: b.D, X: b.W / 2, Z: b.D / 2, wide: b.W > 10, deep: b.D > 10 });

// Holzpolter: Stämme entlang der lokalen z-Achse (Länge len), Breite w, Höhe h, Richtung ry
function logPile(b, x, z, len, w, h, ry = 0) {
  if (b.d === 0) { b.box('log_wood', x, 0, z, w, h, len, ry); return; }
  const s = Math.sin(ry), c = Math.cos(ry);
  if (b.d === 1) {
    b.box('log_wood', x, 0, z, w, h * 0.75, len, ry);
    const n = Math.max(1, Math.floor(w / 0.6));
    for (let i = 0; i < n; i++) { const a = -w / 2 + 0.3 + i * ((w - 0.6) / Math.max(1, n - 1)); b.g('log_wood', new THREE.CylinderGeometry(0.3, 0.3, len + 0.2, 6).rotateX(HP), x + c * a, h * 0.75 + 0.25, z - s * a, { ry }); }
    return;
  }
  const r = 0.27, n = Math.max(2, Math.floor(w / (2 * r + 0.04))), layers = Math.max(1, Math.min(n, Math.round(h / (2 * r * 0.88))));
  for (let k = 0; k < layers; k++) for (let i = 0; i < n - k; i++) {
    const a = -((n - k - 1) * (2 * r + 0.04)) / 2 + i * (2 * r + 0.04), y = r + k * 2 * r * 0.88;
    const L2 = len + ((i * 7 + k * 3) % 5) * 0.12 - 0.24;
    b.g('log_wood', new THREE.CylinderGeometry(r * (0.9 + ((i + k) % 3) * 0.06), r, L2, 6).rotateX(HP), x + c * a, y, z - s * a, { ry });
  }
  for (const sg of [-1, 1]) b.box('wood_dark', x + c * sg * (w / 2 + 0.1), 0, z - s * sg * (w / 2 + 0.1), 0.14, h * 0.8, 0.14, ry);
}
// Schnittholzstapel mit Stapelleisten
function boards(b, x, z, len, w, h, ry = 0) {
  if (b.d < 2) { b.box('wood_planks', x, 0.15, z, w, h, len, ry); b.box('wood_dark', x, 0, z, w * 0.9, 0.15, len * 0.9, ry); return; }
  const layers = Math.max(2, Math.round(h / 0.35));
  b.box('wood_dark', x, 0, z, w * 0.9, 0.15, len * 0.9, ry);
  for (let k = 0; k < layers; k++) {
    b.box('wood_planks', x, 0.15 + k * 0.35, z, w, 0.28, len, ry);
    b.box('wood_dark', x, 0.15 + k * 0.35 + 0.28, z, w + 0.04, 0.07, len * 0.12, ry);
  }
}
// Offene Halle auf Holzstützen mit Satteldach (Sägehalle, Brennholzlager)
function openHall(b, x, z, sx, sz, h, o = {}) {
  const roof = o.roof || b.pick(['metal_corrugated', 'roof_metal_grey', 'roof_tiles_anthracite', 'metal_corrugated_red']);
  const post = o.post || 'wood_dark';
  const nx = Math.max(1, Math.round(sx / 4));
  for (let i = 0; i <= nx; i++) for (const sg of [-1, 1]) b.box(post, x - sx / 2 + 0.15 + (i * (sx - 0.3)) / nx, 0, z + sg * (sz / 2 - 0.15), 0.3, h, 0.3);
  const rise = sz * 0.22;
  b.box(post, x, h - 0.35, z + sz / 2 - 0.15, sx, 0.35, 0.3); b.box(post, x, h - 0.35, z - sz / 2 + 0.15, sx, 0.35, 0.3);
  for (const sg of [-1, 1]) b.beam(roof, [x, h - 0.05, z + sg * (sz / 2 + 0.6)], [x, h + rise, z + sg * 0.05], sx + 0.8, 0.18);
  if (o.cladTop !== false) for (const sg of [-1, 1]) b.prism(o.clad || 'wood_planks', [[-sz / 2, 0], [sz / 2, 0], [0, rise]], 0.12, x + sg * (sx / 2 - 0.06), h, z, HP);
  if (o.backWall) b.box(o.clad || 'wood_planks', x, 0, z - sz / 2 + 0.12, sx, h, 0.15);
  b.take(x, z, sx, sz, 0.3);
}
// Rückezug / Harvester (Forstmaschine mit Kran)
function forestMachine(b, x, z, ry, harvester = false) {
  if (!b.fits(x, z, ry, 9, 3)) return;
  const col = b.pick(['paint_green', 'paint_yellow', 'paint_orange', 'container_green']);
  const P = b.T(x, z, ry), at = (f, l, y, sx, sy, sz, mat) => { const [px, pz] = P(f, l); b.box(mat, px, y, pz, sx, sy, sz, ry); };
  at(1.6, 0, 0.9, 2.4, 1.4, 2.6, col);
  at(1.6, 0, 2.3, 1.8, 1.3, 1.6, 'trim_dark');
  at(-1.6, 0, 0.9, 2.5, 0.6, 3.6, col);
  if (!harvester && b.d >= 1) { for (const f of [-2.8, -0.5]) for (const l of [-1.1, 1.1]) at(f, l, 1.5, 0.12, 1.6, 0.12, 'metal_dark'); logPile(b, ...P(-1.6, 0), 3.4, 1.8, 0.9, ry); }
  for (const l of [-1.15, 1.15]) for (const f of [2.0, -0.9, -2.4]) b.wheel(P, ry, f, l, 0.6, 0.55);
  if (b.d >= 1) { const [cx, cz] = P(0.2, 0), [ex, ez] = P(harvester ? 3.8 : -2.0, harvester ? 0.4 : -0.5); b.beam(col, [cx, 2.0, cz], [(cx + ex) / 2, 4.3, (cz + ez) / 2], 0.3, 0.3); b.beam(col, [(cx + ex) / 2, 4.3, (cz + ez) / 2], [ex, harvester ? 1.6 : 2.6, ez], 0.25, 0.25); b.box('metal_dark', ex, harvester ? 0.8 : 1.8, ez, 0.8, 0.8, 0.8, ry); }
}
// Kohlenmeiler (rauchende Erdkuppel)
function meiler(b, x, z, r) {
  b.dome('dirt', x, 0, z, r, 0.72, { seg: 12 });
  if (b.d >= 1) b.dome('stone_dark', x, 0, z, r * 0.6, 1.3, { seg: 10 });
  b.smoke(x, r * 0.9, z, 'smoke', 0.6);
  b.takeC(x, z, r, 0.2);
}
// Nadelwald-Rest an freien Stellen
function forestEdge(b, n, s = 1) { for (let i = 0; i < n; i++) b.putTree(s * (0.8 + b.r() * 0.4), b.r() < 0.75 ? 'nadel' : 'laub', { prefer: i % 2 ? 'back' : 'left' }); }

// =====================================================================================
// Archetypen
// =====================================================================================

// Forsthaus: Holzhaus mit Satteldach, Holzpolter, Brennholz, Nadelbäume
function forsthaus(b) {
  const { X, Z, wide, deep } = geom(b);
  const L = b.L;
  b.lot('dirt', 0.08);
  const hw = Math.min(7, b.W - 3.4), hd = 5.0, hx = -X + 0.6 + hw / 2, hz = -Z + 0.8 + hd / 2;
  const H = b.hall({ x: hx, z: hz, sx: hw, sz: hd, h: 3.0 + (L >= 2 ? 2.6 : 0), wall: b.pick(['wood_planks', 'wood_dark', 'plaster_white']), roof: 'gable', roofMat: b.pick(['roof_tiles_brown', 'roof_tiles_anthracite', 'roof_slate']), pitch: 40, ridge: 'x', ribs: false, plinth: 'stone_grey', plinthH: 0.6, over: 0.6, gutter: false });
  for (const s of ['front', 'back', 'left']) b.winRow(H.f[s], -H.f[s].len / 2 + 0.8, H.f[s].len / 2 - 0.8, 1.0, 1.0, 1.3, { spacing: 1.9, frame: 'window_frame_wood', sill: true });
  if (L >= 2) b.winRow(H.f.front, -hw / 2 + 0.8, hw / 2 - 0.8, 3.8, 1.0, 1.2, { spacing: 2.2, frame: 'window_frame_wood' });
  b.fbox('door_wood', H.f.front, hw / 4, 0, 1.0, 2.1, 0.08, 0.02);
  if (b.d >= 2) { b.fbox('wood_dark', H.f.front, 0, 2.8, hw, 0.15, 1.6, 0); for (const a of [-hw / 2 + 0.3, hw / 2 - 0.3]) b.fbox('wood_dark', H.f.front, a, 0, 0.15, 2.8, 0.15, 1.45); }
  if (b.d >= 1) b.chimney(hx + hw * 0.25, hz - 0.8, { type: 'square', h: (3.0 + (L >= 2 ? 2.6 : 0)) + 2.6, r: 0.3, mat: 'stone_grey', smoke: 0.3, base: 0 });
  b.take(hx, hz + 0.8, hw, hd + 1.6, 0.3);
  // Brennholz an der Seitenwand
  if (b.d >= 1) { const f = H.f.right; const [fx, fz] = f.at(0, 0.5); b.box('log_wood', fx, 0, fz, 0.9, 1.6, hd - 1.0, 0); b.box('roof_metal_grey', fx + 0.2, 1.7, fz, 1.3, 0.08, hd - 0.6); }
  const np = 1 + Math.min(3, L) + (wide || deep ? 1 : 0);
  for (let i = 0; i < np; i++) b.put(5.2, 2.4, { prefer: i % 2 ? 'right' : 'front', pad: 0.3 }, (px, pz, ry) => logPile(b, px, pz, 5.0, 2.2, 1.4, ry));
  if (L >= 2) b.put(9, 3, { prefer: 'front' }, (px, pz, ry) => forestMachine(b, px, pz, ry, false));
  if (L >= 3) { const p = b.plan.find(6.0, 3.6, { prefer: 'back', pad: 0.2 }); if (p) { openHall(b, p[0], p[1], 5.6, 3.2, 3.0, { backWall: true }); b.box('log_wood', p[0], 0, p[1] - 0.2, 4.8, 1.6, 2.0); } }
  b.putVan({ prefer: 'front' }, b.pick(['paint_green', 'container_green', 'paint_white']));
  forestEdge(b, 2 + (wide ? 2 : 0) + (deep ? 2 : 0));
}

// Sägewerk: offene Sägehalle mit Sägestraße, Rundholzplatz, Schnittholzstapel, Trockenkammern, Spänesilo
function saegewerk(b) {
  const { W, D, X, Z, wide, deep } = geom(b);
  const L = b.L;
  b.lot('gravel', 0.08);
  const sx = wide ? 12 : W - 1.6, sz = deep ? 7 : 5.2, hx = wide ? -X + 0.8 + sx / 2 : 0, hz = -Z + 0.8 + sz / 2, h = 4.6 + L * 0.3;
  openHall(b, hx, hz, sx, sz, h, { backWall: true, roof: b.pick(['metal_corrugated', 'roof_metal_grey', 'metal_corrugated_red']) });
  // Sägestraße in der Halle
  b.box('metal_dark', hx, 0, hz, sx - 1.0, 0.9, 1.0);
  if (b.d >= 1) { b.box('paint_orange', hx - sx * 0.1, 0.9, hz, 1.4, 1.6, 1.6); b.box('metal_light', hx + sx * 0.25, 0.9, hz, 1.0, 1.2, 1.4); }
  if (b.d >= 2) for (let i = 0; i < 3; i++) b.g('log_wood', new THREE.CylinderGeometry(0.3, 0.3, 3.2, 6).rotateZ(HP), hx - sx / 2 + 2 + i * 0.1, 1.2, hz + 0.0, {});
  if (L >= 2) { const p = b.plan.find(4.6, 4.6, { prefer: 'right', pad: 0 }); if (p) { b.cone('log_wood', p[0], 0, p[1], 2.1, 2.2, { seg: 10 }); b.take(p[0], p[1], 4.2, 4.2, 0); b.conveyor([hx + sx / 2 - 0.4, 3.6, hz], [p[0], 2.6, p[1]], { w: 0.8, noEnd: true }); } }
  // Trockenkammern ab Stufe 3
  if (L >= 3) {
    const nk = wide || deep ? 3 : 2, kw = 3.0;
    const p = b.plan.find(nk * kw + 0.4, 4.4, { prefer: 'back', pad: 0.2 });
    if (p) for (let i = 0; i < nk; i++) {
      const kx = p[0] - ((nk - 1) * kw) / 2 + i * kw;
      const H = b.hall({ x: kx, z: p[1], sx: kw - 0.1, sz: 4.2, h: 4.2, wall: 'metal_panel_grey', roof: 'flat', roofMat: 'roof_flat_membrane', ribs: false, plinthH: 0.3, parapet: 0.3 });
      b.fbox('metal_panel_white', H.f.front, 0, 0, kw - 0.7, 3.6, 0.1, 0.02);
      if (b.d >= 1) b.cyl('metal_light', kx, 4.5, p[1] - 1.0, 0.25, 1.2, { seg: 6 });
      b.smoke(kx, 5.8, p[1] - 1.0, 'steam', 0.3);
    }
    const q = b.plan.find(2.6, 2.6, { prefer: 'right', pad: 0.2 }); if (q) b.silo(q[0], q[1], 1.1, 5, { mat: 'metal_light', legs: 3, top: 'cone' });
  }
  // Rundholz und Schnittholz
  const nl = 1 + Math.min(3, L);
  for (let i = 0; i < nl; i++) b.put(6.2, 2.6, { prefer: i % 2 ? 'front' : 'left', pad: 0.3 }, (px, pz, ry) => logPile(b, px, pz, 6.0, 2.4, 1.5, ry));
  for (let i = 0; i < Math.min(3, L); i++) b.put(4.4, 1.6, { prefer: 'front', pad: 0.3 }, (px, pz, ry) => boards(b, px, pz, 4.2, 1.2, 1.2 + (i % 2) * 0.4, ry));
  b.put(2.2, 1.2, { prefer: 'front' }, (px, pz, ry) => b.forklift(px, pz, ry, 'paint_yellow'));
  if (L >= 2 || wide) b.putTruck({ type: 'semi', load: 'logs' }, { prefer: 'front' });
  b.fenceLot(0, 0, W - 0.3, D - 0.3, { gate: 5, ga: 0, barrier: false });
  b.lamp(X - 0.5, Z - 0.5, 6);
}

// Holzhof: Rundholzplatz mit großem Portalkran über den Poltern, Langholz-Lkw, Waage
function holzhof(b) {
  const { W, D, X, Z, wide, deep } = geom(b);
  const L = b.L;
  b.lot('dirt', 0.08);
  const along = D >= W;
  const span = Math.min((along ? W : D) - 2.0, 6 + L * 1.6), glen = (along ? D : W) - 1.2, gh = 6 + L * 0.8;
  const mat = b.pick(['paint_yellow', 'paint_orange', 'paint_blue', 'paint_red']);
  if (along) b.gantry(0, 0, span, glen, gh, { mat, pos: 0.15, grab: true, hookY: 2.5 });
  else {
    // Kran quer: Schienen entlang x – gleiche Bauweise, um 90° gedacht
    const leg = Math.min(2.2, glen * 0.4);
    if (b.d >= 1) for (const s of [-1, 1]) b.box('rail_track', 0, 0, s * span / 2, glen, 0.12, 0.4);
    const xc = b.rnd(-0.2, 0.2) * glen;
    for (const s of [-1, 1]) { const pz = s * span / 2; b.beam(mat, [xc - leg, 0.6, pz], [xc - 0.4, gh, pz], 0.5, 0.6); b.beam(mat, [xc + leg, 0.6, pz], [xc + 0.4, gh, pz], 0.5, 0.6); if (b.d >= 1) b.box(mat, xc, 0, pz, leg * 2 + 0.8, 0.7, 0.8); }
    b.box(mat, xc, gh, 0, 1.3, 1.4, span + 1.6);
    if (b.d >= 1) b.box('metal_dark', xc, gh + 1.4, b.rnd(-0.3, 0.3) * span, 2.2, 1.1, 2.0);
  }
  // Polter unter dem Kran
  const rows = Math.max(1, Math.floor((span - 1.0) / 2.8)), plen = Math.min(glen - 2.0, 9);
  const segs = Math.max(1, Math.floor((glen - 1.0) / (plen + 1.2)));
  for (let i = 0; i < rows; i++) for (let j = 0; j < segs; j++) {
    const a = -((rows - 1) * 2.8) / 2 + i * 2.8, t = -((segs - 1) * (plen + 1.2)) / 2 + j * (plen + 1.2);
    if (along) logPile(b, a, t, plen, 2.4, 1.2 + ((i + j) % 3) * 0.5, 0); else logPile(b, t, a, plen, 2.4, 1.2 + ((i + j) % 3) * 0.5, HP);
  }
  b.take(0, 0, along ? span + 1.6 : glen, along ? glen : span + 1.6, 0.1);
  b.putTruck({ type: 'semi', load: 'logs' }, { prefer: 'front' });
  if (wide && deep) b.putTruck({ type: 'semi', load: 'logs' }, { prefer: 'right' });
  b.put(3.4, 2.6, { prefer: 'front' }, (px, pz) => { b.box('metal_panel_white', px, 0.2, pz, 3.0, 2.6, 2.2); b.fplane('glass_window', b.face(px, pz, 3.0, 2.2, 'front'), 0, 1.2, 2.0, 0.9, 0.03); });
  forestEdge(b, wide || deep ? 3 : 1, 0.9);
  b.lamp(X - 0.5, Z - 0.5, 8);
  b.light(0, gh + 1.6, 0, 0xfff1c8, 0.4);
}

// Köhlerei & Brennholzhof: rauchende Meiler, Brennholzstapel unter Dächern, Spaltmaschine, Retortenöfen
function koehlerei(b) {
  const { wide, deep } = geom(b);
  const L = b.L;
  b.lot('dirt', 0.08);
  const nm = 1 + Math.min(2, L - 1) + (wide || deep ? 1 : 0);
  for (let i = 0; i < nm; i++) { const r = 1.7 + (i % 2) * 0.4; const p = b.plan.find(2 * r + 0.6, 2 * r + 0.6, { prefer: 'back', pad: 0 }); if (p) meiler(b, p[0], p[1], r); }
  // Brennholz unter Pultdächern
  const nb = 1 + Math.min(2, L);
  for (let i = 0; i < nb; i++) b.put(5.2, 1.8, { prefer: 'left', pad: 0.3 }, (px, pz, ry) => {
    const s = Math.sin(ry), c = Math.cos(ry);
    b.box('log_wood', px, 0, pz, 1.2, 1.7, 5.0, ry);
    if (b.d >= 2) for (let k = 0; k < 4; k++) b.box('wood_planks', px + s * (-1.9 + k * 1.25), 0.3 + (k % 2) * 0.6, pz + c * (-1.9 + k * 1.25), 1.24, 0.08, 0.6, ry);
    b.boxc('roof_metal_grey', px - c * 0.1, 2.0, pz + s * 0.1, 1.8, 0.08, 5.4, { ry, rz: 0.15 });
    if (b.d >= 1) for (const t of [-2.3, 2.3]) b.box('wood_dark', px + s * t, 0, pz + c * t, 0.15, 1.9, 0.15, ry);
  });
  b.put(2.6, 1.6, { prefer: 'center' }, (px, pz, ry) => { b.box('paint_red', px, 0.3, pz, 1.0, 0.8, 2.4, ry); if (b.d >= 1) b.box('metal_dark', px, 1.1, pz, 0.3, 1.2, 0.3, ry); });
  if (L >= 3) {
    const p = b.plan.find(6.4, 3.4, { prefer: 'right', pad: 0.2 });
    if (p) { for (let i = 0; i < 2; i++) b.hcyl('metal_dark', p[0] - 1.6 + i * 3.2, 1.6, p[1], 1.3, 3.0, 'z', { seg: 12 }); b.chimney(p[0], p[1] - 1.2, { type: 'steel', h: 9 + L, r: 0.35, smoke: 0.7, mat: 'metal_dark' }); }
  }
  // Holzsäcke / Kohlesäcke
  if (b.d >= 2) { const p = b.plan.find(2.0, 1.2, { prefer: 'front' }); if (p) for (let i = 0; i < 6; i++) b.box('canvas_white', p[0] - 0.75 + (i % 3) * 0.75, Math.floor(i / 3) * 0.5, p[1], 0.65, 0.48, 0.9); }
  b.putVan({ prefer: 'front' }, 'paint_white');
  forestEdge(b, 2 + (wide ? 2 : 0) + (deep ? 2 : 0));
}

// Pelletwerk: offene Hackschnitzelhalle, Werkhalle, hohe Pelletsilos, Dampfschlot, Förderbänder
function pelletwerk(b) {
  const { W, D, X, Z, wide, deep } = geom(b);
  const L = b.L;
  b.lot('concrete', 0.08);
  // Hackschnitzel unter offener Halle
  const hw = Math.min(W - 1.4, 7 + L), hd = Math.min(5.0, D * 0.42);
  const hx = -X + 0.7 + hw / 2, hz = -Z + 0.7 + hd / 2;
  openHall(b, hx, hz, hw, hd, 5.0, { backWall: true, roof: 'metal_corrugated', post: 'metal_dark', clad: 'metal_corrugated' });
  b.cone('log_wood', hx, 0, hz, Math.min(hw, hd) * 0.45, 3.0, { seg: 10 });
  if (b.d >= 1) b.box('log_wood', hx, 0, hz, hw - 1.2, 1.2, hd - 1.2);
  // Werkhalle und Silos ab Stufe 2
  if (L >= 2) {
    const p = b.plan.find(6.0, 4.6, { prefer: 'right', pad: 0.2 });
    if (p) {
      const H = b.hall({ x: p[0], z: p[1], sx: 5.8, sz: 4.4, h: 7 + L * 0.5, wall: b.pick(['metal_panel_white', 'metal_panel_grey', 'metal_corrugated_green']), roof: 'flat', roofMat: 'roof_flat_membrane', ribs: false, plinthH: 0.4 });
      b.band(H.f.front, -2.4, 2.4, 4.2, 1.2, {});
      b.rollerDoor(H.f.front, 1.2, 2.4, 3.0, {});
      b.sign(H.f.front, -1.2, 2.2, 2.4, 0.6, { logo: 'paint_green' });
      b.chimney(p[0] - 1.8, p[1] - 1.4, { type: 'steel', h: 13 + L * 2, r: 0.5, smoke: 1.0, kind: 'steam', mat: 'metal_light' });
      b.conveyor([hx + hw / 2, 3.5, hz], [p[0] - 2.9, 6.0, p[1]], { w: 0.9, mat: 'metal_corrugated', noEnd: true });
    }
  }
  const ns = Math.min(4, L + (wide ? 1 : 0));
  for (let i = 0; i < ns; i++) { const p = b.plan.find(2.8, 2.8, { prefer: 'front', pad: 0.1 }); if (p) b.silo(p[0], p[1], 1.2, 8 + L * 1.5, { mat: i % 2 ? 'tank_white' : 'metal_light', top: 'cone', rings: 3, legs: L >= 3 ? 2.5 : 0 }); }
  b.putTruck({ type: 'rigid', load: 'tank', loadMat: 'container_green' }, { prefer: 'front' });
  if (deep || wide) b.put(7.0, 2.8, { prefer: 'front' }, (px, pz, ry) => b.loader(px, pz, ry, 'paint_green'));
  b.fenceLot(0, 0, W - 0.3, D - 0.3, { gate: 5, ga: 0 });
  b.lamp(X - 0.5, Z - 0.5, 7);
}

// Baumschule: Beete mit jungen Nadelbäumen, Folientunnel, Harvester, Langholz-Lkw, Kühlhaus
function baumschule(b) {
  const { W, D, X, Z, wide, deep } = geom(b);
  const L = b.L;
  b.lot('grass', 0.08);
  // Beete
  const bedW = 1.6, n = Math.max(2, Math.floor((W - 1.4) / (bedW + 0.8))), bl = Math.min(D - 4.4, 8 + L);
  const bz = -Z + 0.7 + bl / 2;
  for (let i = 0; i < n; i++) {
    const x = -X + 0.7 + bedW / 2 + i * (bedW + 0.8);
    b.ground('field_soil', x, bz, bedW, bl, 0.12);
    const m = Math.max(2, Math.floor(bl / 1.0)), sz = 0.35 + ((i + L) % 3) * 0.15;
    for (let k = 0; k < m; k++) {
      if (b.d === 0 && k % 2) continue;
      const tz = bz - bl / 2 + 0.5 + (k * (bl - 1)) / (m - 1);
      b.cone(k % 4 === 3 ? 'leaves_light' : 'leaves_dark', x, 0.12, tz, sz, sz * 2.6, { seg: 5, exact: true });
    }
  }
  b.take(0, bz, W - 1.0, bl, 0.2);
  // Folientunnel ab Stufe 2
  if (L >= 2) { const len = Math.min(D - bl - 2.0, 7); const p = len > 3 ? b.plan.find(3.4, len, { prefer: 'right', pad: 0.1 }) : null; if (p) { const g = new THREE.CylinderGeometry(1.5, 1.5, len, b.seg(10), 1, false, HP, PI); g.rotateX(HP); g.scale(1, 1.4, 1); b.g('canvas_white', g, p[0], 0.05, p[1], {}); } }
  if (L >= 3) { const p = b.plan.find(4.4, 3.4, { prefer: 'left', pad: 0.2 }); if (p) { const H = b.hall({ x: p[0], z: p[1], sx: 4.2, sz: 3.2, h: 3.6, wall: 'metal_panel_white', roof: 'flat', roofMat: 'roof_flat_membrane', ribs: false, plinthH: 0.3, parapet: 0.3 }); b.rollerDoor(H.f.front, 0, 2.2, 2.8, { mat: 'metal_panel_white' }); } }
  b.put(9, 3, { prefer: 'front' }, (px, pz, ry) => forestMachine(b, px, pz, ry, true));
  if (wide || deep) b.putTruck({ type: 'rigid', load: 'logs' }, { prefer: 'front' });
  b.putVan({ prefer: 'front' }, 'container_green');
  forestEdge(b, 1 + (wide ? 2 : 0) + (deep ? 1 : 0), 0.9);
}

export const FOREST = [forsthaus, saegewerk, holzhof, koehlerei, pelletwerk, baumschule];
export function buildForest(ctx) {
  const b = new B(ctx);
  FOREST[ctx.variant % FOREST.length](b);
  return b.finish();
}
void clamp; void PI;
