// Spezialindustrie Bergbau ('mine') – Archetypen, die mit der Stufe wachsen (Besitzer: G4).
// Zeche mit Strebengerüst (Seilscheiben drehen sich, res.anim), Steinbruch, Kieswerk, Hammerkopfturm,
// Stollen mit Grubenbahn, Kalibergwerk mit weißer Halde.
import * as THREE from 'three';
import { B, PI, HP, clamp } from './indoff_parts.js';

const geom = (b) => ({ W: b.W, D: b.D, X: b.W / 2, Z: b.D / 2, wide: b.W > 10, deep: b.D > 10 });

// Seilscheiben (zwei nebeneinander, drehen um die x-Achse)
function sheaves(b, x, y, z, r, mat, speed, pair = true) {
  b.spin([x, y, z], 'x', speed, (sb) => {
    for (const ox of pair ? [-0.9, 0.9] : [0]) {
      sb.g(mat, new THREE.TorusGeometry(r, 0.13, sb.d >= 2 ? 6 : 4, sb.d >= 2 ? 22 : 12).rotateY(HP), ox, 0, 0, {});
      if (sb.d >= 1) for (let k = 0; k < 3; k++) { const a = (k / 3) * PI; sb.beam(mat, [ox, Math.sin(a) * r, Math.cos(a) * r], [ox, -Math.sin(a) * r, -Math.cos(a) * r], 0.08, 0.08); }
      sb.g('metal_dark', new THREE.CylinderGeometry(0.25, 0.25, 0.4, 8).rotateZ(HP), ox, 0, 0, {});
    }
  });
}
// Strebengerüst (Fördergerüst aus Stahl). Seile laufen nach hinten (-z) zum Maschinenhaus.
// o: { mat, r (Scheibenradius), doppel (zweite Strebe nach vorne), wood }
function headframe(b, x, z, H, o = {}) {
  const mat = o.mat || b.pick(['paint_red', 'rust', 'paint_green', 'metal_dark', 'paint_red']);
  const a0 = o.wood ? 1.4 : 2.2, a1 = o.wood ? 0.9 : 1.4, r = o.r ?? (o.wood ? 1.2 : 1.8 + H / 25);
  const leg = (sx, sz, t) => [x + sx * (a0 + (a1 - a0) * t), H * t, z + sz * (a0 + (a1 - a0) * t)];
  const t0 = o.wood ? 0.3 : 0.38, t1 = o.wood ? 0.2 : 0.25;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.beam(mat, leg(sx, sz, 0), leg(sx, sz, 1), t0, t0);
  const lv = Math.max(2, Math.round(H / 5));
  for (let k = 1; k <= lv; k++) {
    const t = k / lv;
    if (b.d === 0 && k < lv) continue;
    for (const [a, c] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) b.beam(mat, leg(a[0], a[1], t), leg(c[0], c[1], t), t1, t1);
    if (b.d >= 2) { const tp = (k - 1) / lv; for (const [a, c] of [[[-1, 1], [1, 1]], [[1, -1], [1, 1]], [[-1, -1], [-1, 1]]]) b.beam(mat, leg(a[0], a[1], tp), leg(c[0], c[1], t), 0.1, 0.1); }
  }
  // Streben zum Maschinenhaus (und beim Doppelbock auch nach vorne)
  const sl = o.sl ?? H * 0.62;
  for (const dir of o.doppel ? [-1, 1] : [-1]) for (const sx of [-1, 1]) {
    b.beam(mat, [x + sx * a1 * 1.2, H - 1.0, z + dir * a1], [x + sx * a0 * 1.25, 0, z + dir * sl], t0 * 1.1, t0 * 1.1);
    if (b.d >= 1) b.beam(mat, [x + sx * a1 * 1.2, H * 0.55, z + dir * (a1 + (sl - a1) * 0.42)], [x + sx * a0, H * 0.55, z + dir * a0], t1, t1);
  }
  if (b.d >= 1 && o.doppel !== true) b.box('concrete', x, 0, z - sl, a0 * 2.8, 0.8, 1.6);
  // Scheibenbühne mit Dach
  b.box(mat, x, H, z, 2 * a1 + 1.0, 0.4, 2 * a1 + 1.0);
  if (b.d >= 2) b.roofRail(x, H + 0.3, z, 2 * a1 + 1.0, 2 * a1 + 1.0);
  const wy = H + 0.4 + r * 0.85;
  sheaves(b, x, wy, z, r, o.wheel || mat, o.speed ?? 1.2, !o.wood);
  if (o.doppel) sheaves(b, x, wy + 0.2, z + 0.2, r * 0.9, o.wheel || mat, -(o.speed ?? 1.2), !o.wood);
  if (b.d >= 1) for (const sx of o.wood ? [0] : [-0.9, 0.9]) b.beam('metal_dark', [x + sx, wy + r, z - 0.2], [x + sx, (o.ropeY ?? 8), z - (o.ropeZ ?? H * 0.75)], 0.05, 0.05);
  b.light(x, H + 0.6 + 2 * r, z, 0xff2a20, 0.25);
  return { top: wy + r, sl };
}
// Maschinenhaus (Backstein, hohe Rundbogenfenster)
function engineHouse(b, x, z, sx, sz, h, o = {}) {
  const wall = o.wall || b.pick(['brick_red', 'brick_brown', 'brick_red', 'brick_yellow']);
  const H = b.hall({ x, z, sx, sz, h, wall, roof: 'gable', roofMat: o.roof || b.pick(['roof_slate', 'roof_tiles_anthracite', 'roof_metal_grey']), pitch: 26, ridge: sx >= sz ? 'x' : 'z', ribs: true, bay: 2.6, ribMat: 'brick_dark', plinth: 'stone_grey', plinthH: 0.8, over: 0.3 });
  for (const s of ['front', 'left', 'right', 'back']) for (const a of H.bays[s]) b.winRow(H.f[s], a - 0.1, a + 0.1, 1.4, 1.3, h - 2.6, { arch: 'trim_stone', frame: 'window_frame_white', mullion: true, lod: s === 'front' || s === 'right' });
  b.take(x, z, sx, sz, 0.3);
  return H;
}
// Halde: gestufter Kegel; mat (Gestein), r Radius am Fuß, h Höhe
function heap(b, x, z, r, h, mat = 'stone_dark') {
  const tiers = b.d === 0 ? 1 : 3;
  for (let k = 0; k < tiers; k++) {
    const r0 = r * (1 - k * 0.3), r1 = r * (1 - (k + 1) * 0.3 + 0.08), y0 = (h * k) / tiers, th = h / tiers;
    b.cyl(mat, x, y0, z, r0, th, { seg: 14, rTop: Math.max(0.6, r1) });
  }
  if (b.d >= 1) b.cyl(mat, x, h, z, r * 0.18 + 0.4, 0.3, { seg: 10, rTop: r * 0.12 });
  b.takeC(x, z, r, 0.1);
}
// Schüttkegel (Kies/Sand) mit einfacher Form
function pile(b, x, z, r, h, mat) { b.cone(mat, x, 0, z, r, h, { seg: 10 }); b.takeC(x, z, r, 0.1); }
// Siebanlage auf Stützen mit Schurren
function screening(b, x, z, h, o = {}) {
  const mat = o.mat || b.pick(['metal_corrugated', 'metal_panel_grey', 'metal_corrugated_green', 'paint_yellow']);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('metal_dark', x + sx * 1.6, 0, z + sz * 1.3, 0.3, h, 0.3);
  if (b.d >= 1) for (const sz of [-1, 1]) b.beam('metal_dark', [x - 1.6, 0.4, z + sz * 1.3], [x + 1.6, h - 0.4, z + sz * 1.3], 0.15, 0.15);
  b.box(mat, x, h, z, 4.0, 3.0, 3.4);
  b.box('roof_metal_grey', x, h + 3.0, z, 4.3, 0.2, 3.7);
  if (b.d >= 1) for (const sx of [-1, 1]) { const g = new THREE.ConeGeometry(0.8, 1.6, b.seg(8)).rotateX(PI).translate(0, -0.8, 0); b.g('metal_light', g, x + sx * 1.0, h, z, {}); }
  b.take(x, z, 4.0, 3.4, 0.4);
}
// Gleise mit Schwellen (achsparallel)
function rails(b, ax, az, bx, bz) {
  const alongX = Math.abs(bx - ax) > Math.abs(bz - az), len = alongX ? Math.abs(bx - ax) : Math.abs(bz - az), cx = (ax + bx) / 2, cz = (az + bz) / 2;
  if (b.d >= 1) for (const s of [-0.5, 0.5]) b.box('rail_track', alongX ? cx : cx + s, 0.1, alongX ? cz + s : cz, alongX ? len : 0.08, 0.12, alongX ? 0.08 : len);
  if (b.d >= 2) { const n = Math.round(len / 0.9); for (let i = 0; i <= n; i++) { const t = -len / 2 + (i * len) / n; b.box('wood_dark', alongX ? cx + t : cx, 0.08, alongX ? cz : cz + t, alongX ? 0.2 : 1.4, 0.06, alongX ? 1.4 : 0.2); } }
  b.ground('ballast', cx, cz, alongX ? len : 1.8, alongX ? 1.8 : len, 0.08);
}
// Förderwagen (Hunt)
function cart(b, x, z, ry, fill = 'stone_dark') {
  b.box(b.pick(['rust', 'metal_dark', 'paint_red']), x, 0.3, z, 0.9, 0.8, 1.4, ry);
  if (b.d >= 1) b.box(fill, x, 1.1, z, 0.75, 0.15, 1.2, ry);
}

// =====================================================================================
// Archetypen
// =====================================================================================

// Zeche: Strebengerüst mit Seilscheiben über der Schachthalle, Maschinenhaus, Halde, Förderband
function zeche(b) {
  const { W, D, X, Z, wide, deep } = geom(b);
  const L = b.L;
  b.lot('asphalt_dark', 0.08);
  const wood = L === 1;
  const H = wood ? 11 : 16 + L * 5 + (b.fw * b.fd >= 2 ? 4 : 0);
  const hx = wide ? -X + 5.0 : 0, hz = deep ? -Z / 2 + 2 : 0.4;
  // Schachthalle
  const sh = wood ? 3.2 : 5 + L * 0.6, ss = wood ? 4.2 : 6.4;
  const S = b.hall({ x: hx, z: hz, sx: ss, sz: ss, h: sh, wall: wood ? 'wood_planks' : b.pick(['brick_red', 'brick_brown', 'metal_corrugated']), roof: 'gable', roofMat: 'roof_metal_grey', pitch: 22, ridge: 'x', ribs: !wood, bay: 2.2, ribMat: 'brick_dark', plinthH: 0.5 });
  b.rollerDoor(S.f.front, 0, 2.4, Math.min(3.2, sh - 0.8), { mat: wood ? 'wood_dark' : 'metal_panel_grey' });
  b.take(hx, hz, ss, ss, 0.2);
  const sl = Math.min(H * 0.62, hz + Z - 1.2);
  const hf = headframe(b, hx, hz, H, { wood, sl, doppel: L >= 4 && deep, ropeZ: Math.max(2.5, sl - 1.5), ropeY: 6 });
  b.take(hx, hz - hf.sl / 2, 5.0, hf.sl, 0.1);
  // Maschinenhaus hinter dem Gerüst (Platz vorausgesetzt), sonst seitlich
  const ew = wood ? 3.6 : 5.6, ed = wood ? 3.0 : 4.4;
  const ez = clamp(hz - hf.sl - ed / 2 + 0.5, -Z + 0.5 + ed / 2, Z), ex = hx;
  if (ez - ed / 2 >= -Z + 0.3 && b.plan.free(ex, ez, ew, ed)) engineHouse(b, ex, ez, ew, ed, wood ? 3.6 : 7 + L * 0.4, { wall: wood ? 'wood_dark' : undefined });
  else { const p = b.plan.find(ew, ed, { prefer: 'back', pad: 0.1 }); if (p) engineHouse(b, p[0], p[1], ew, ed, wood ? 3.6 : 7, { wall: wood ? 'wood_dark' : undefined }); }
  // Halde und Förderband
  if (L >= 2) {
    const r = clamp(2.2 + L * 0.9 + (b.fw * b.fd >= 2 ? 1.5 : 0), 2.2, Math.min(W, D) * 0.42);
    const p = b.plan.find(2 * r, 2 * r, { prefer: wide ? 'right' : 'front', pad: 0.1 });
    if (p) {
      heap(b, p[0], p[1], r, r * 0.7, b.pick(['stone_dark', 'stone_dark', 'rock']));
      if (L >= 3) b.conveyor([hx + ss / 2, sh + 0.5, hz], [p[0], r * 0.7 + 0.5, p[1]], { w: 1.2, mat: 'metal_corrugated', noEnd: true });
    }
  }
  if (L >= 3) b.chimney(...(() => { const p = b.plan.find(3.0, 3.0, { prefer: 'back', pad: 0 }) || [X - 1.6, -Z + 1.6]; return [p[0], p[1]]; })(), { type: 'round', h: 24 + L * 2, r: 0.95, mat: 'chimney_brick', smoke: 0.9 });
  b.put(8.5, 2.6, { prefer: 'front' }, (px, pz, ry) => b.truck(px, pz, ry, { type: 'rigid', load: 'tipper', fill: 'stone_dark' }));
  for (let i = 0; i < (wide || deep ? 3 : 1); i++) { const p = b.plan.find(1.2, 1.6, { prefer: 'front' }); if (p) cart(b, p[0], p[1], 0, 'stone_dark'); }
  b.lamp(X - 0.5, Z - 0.5, 7);
}

// Steinbruch: gestufte Felswand, Bagger, Muldenkipper, Brecher mit Förderband und Splitthalden
function steinbruch(b) {
  const { W, D, X, Z, wide, deep } = geom(b);
  const L = b.L;
  b.lot('gravel', 0.08);
  const rock = b.pick(['rock', 'stone_grey', 'stone_sandstone', 'rock']);
  // Felswand mit Bermen (Stufen) hinten
  const tiers = 2 + Math.min(3, L), th = 3.0, td = deep ? 2.6 : 1.4;
  const segs = wide ? 3 : 2;
  for (let s = 0; s < segs; s++) {
    const sw = (W - 0.4) / segs, sx = -X + 0.2 + sw * (s + 0.5), jitter = (b.r() - 0.5) * 0.8;
    for (let k = 0; k < tiers; k++) {
      const dz = td * (tiers - k), h = th * (k + 1) + jitter * k;
      b.box(rock, sx, 0, -Z + 0.2 + dz / 2, sw + 0.02, h, dz);
      if (b.d >= 2 && k < tiers - 1) b.box('gravel', sx, h, -Z + 0.2 + dz - td * 0.5, sw, 0.08, td * 0.6);
    }
    if (b.d >= 1) b.box('grass_dry', sx, th * tiers + jitter * (tiers - 1), -Z + 0.2 + td / 2, sw, 0.1, td);
  }
  b.take(0, -Z + 0.2 + (td * tiers) / 2, W, td * tiers, 0.4);
  // Geröllhaufen am Fuß
  for (let i = 0; i < (wide ? 3 : 2); i++) { const p = b.plan.find(3.0, 3.0, { prefer: 'back', pad: 0 }); if (p) pile(b, p[0], p[1], 1.4, 1.1, rock); }
  b.put(9.0, 3.6, { prefer: 'back' }, (px, pz, ry) => b.excavator(px, pz, ry, b.pick(['paint_yellow', 'paint_orange']), 0));
  // Brecher und Förderband ab Stufe 2
  if (L >= 2) {
    const p = b.plan.find(4.2, 3.6, { prefer: 'right', pad: 0.2 });
    if (p) {
      b.box('metal_dark', p[0], 0, p[1], 3.4, 3.2, 3.0);
      const g = new THREE.ConeGeometry(1.7, 1.8, b.seg(8), 1, true).rotateX(PI).translate(0, 0.9, 0);
      b.g('metal_light', g, p[0], 3.2, p[1], {});
      const q = b.plan.find(4.6, 4.6, { prefer: 'front', pad: 0 });
      if (q) { pile(b, q[0], q[1], 2.1, 2.6, b.pick(['gravel', 'sand'])); b.conveyor([p[0], 2.4, p[1]], [q[0], 3.0, q[1]], { w: 0.9, covered: false, fill: 'gravel', noEnd: true }); }
    }
  }
  if (L >= 3) { const p = b.plan.find(4.6, 4.0, { prefer: 'center', pad: 0.2 }); if (p) screening(b, p[0], p[1], 4.5); }
  b.put(L >= 3 ? 11.5 : 7.8, L >= 3 ? 5.4 : 3.8, { prefer: 'front' }, (px, pz, ry) => b.dumper(px, pz, ry, 'paint_yellow', L >= 3));
  b.put(6.0, 2.5, { prefer: 'front' }, (px, pz, ry) => { const along = Math.abs(Math.sin(ry)) > 0.5; b.box('metal_panel_white', px, 0.2, pz, along ? 6 : 2.5, 2.6, along ? 2.5 : 6); });
  b.lamp(X - 0.5, Z - 0.5, 6);
}

// Kieswerk: Siebturm, sternförmige Förderbänder, Sand- und Kieskegel, Radlader, Lkw
function kieswerk(b) {
  const { W, D, X, Z, wide, deep } = geom(b);
  const L = b.L;
  b.lot('sand', 0.08);
  const h = 4 + L * 1.2;
  const sx = wide ? -X / 2 : 0, sz = deep ? -Z / 2 : -1.0;
  screening(b, sx, sz, h, {});
  const mats = ['gravel', 'sand', 'rock', 'gravel', 'sand'];
  const n = 2 + Math.min(3, L) - (wide || deep ? 0 : 1);
  for (let i = 0; i < n; i++) {
    const r = 1.8 + L * 0.35 + (wide || deep ? 0.6 : 0);
    const p = b.plan.find(2 * r, 2 * r, { prefer: i % 2 ? 'left' : 'right', pad: 0 });
    if (!p) continue;
    pile(b, p[0], p[1], r, r * 1.05, mats[i % mats.length]);
    b.conveyor([sx, h + 0.4, sz], [p[0], r * 1.05 + 0.4, p[1]], { w: 0.8, covered: false, fill: mats[i % mats.length], noEnd: true });
  }
  b.put(7.0, 2.8, { prefer: 'front' }, (px, pz, ry) => b.loader(px, pz, ry, b.pick(['paint_yellow', 'paint_orange', 'paint_green'])));
  b.putTruck({ type: 'rigid', load: 'tipper', fill: 'gravel' }, { prefer: 'front' });
  b.put(6.0, 2.5, { prefer: 'front' }, (px, pz, ry) => { const along = Math.abs(Math.sin(ry)) > 0.5; b.box('metal_panel_white', px, 0.2, pz, along ? 6 : 2.5, 2.6, along ? 2.5 : 6); });
  if (L >= 3 && (wide || deep)) { const p = b.plan.find(3.0, 3.0, { prefer: 'back', pad: 0.2 }); if (p) b.silo(p[0], p[1], 1.2, 7, { mat: 'metal_light', legs: 3.5, top: 'cone' }); }
  b.fenceLot(0, 0, W - 0.3, D - 0.3, { gate: 5, ga: 0 });
  b.lamp(X - 0.5, Z - 0.5, 6);
}

// Hammerkopfturm: hoher Beton-Förderturm mit breitem Maschinenkopf, Erzbunker, Förderband
function hammerturm(b) {
  const { W, D, X, Z, wide, deep } = geom(b);
  const L = b.L;
  b.lot('concrete', 0.08);
  const ts = Math.min(6.4, Math.min(W, D) - 3.0), H = 20 + L * 6 + (b.fw * b.fd >= 2 ? 6 : 0);
  const tx = wide ? -X / 2 : 0, tz = deep ? -Z / 2 : -Z + 0.8 + ts / 2;
  const mat = b.pick(['concrete', 'concrete_panel', 'brick_red', 'concrete']);
  b.box(mat, tx, 0, tz, ts, H, ts);
  const f = b.faces(tx, tz, ts, ts);
  for (const s of ['front', 'left', 'right', 'back']) {
    if (b.d === 0) { const [px, pz] = f[s].at(0, 0.03); b.lodWin(px, H / 2, pz, 1.2, H * 0.8, 1, Math.round(H / 4), f[s].ry); continue; }
    for (const a of [-ts / 4, ts / 4]) b.fplane('glass_window', f[s], a, 3, 0.7, H - 6, 0.03);
    if (b.d >= 2) for (let k = 1; k < Math.round(H / 6); k++) b.fbox('concrete_dark', f[s], 0, k * 6, ts + 0.04, 0.12, 0.05, 0);
  }
  // Maschinenkopf (Hammerkopf) auskragend
  const hx2 = ts + 2.6, hz2 = ts + 1.2;
  b.box(mat, tx, H, tz, hx2, 6, hz2);
  const fh = b.faces(tx, tz, hx2, hz2);
  b.band(fh.front, -hx2 / 2 + 0.4, hx2 / 2 - 0.4, H + 2.2, 2.4, { part: 3 });
  b.band(fh.back, -hx2 / 2 + 0.4, hx2 / 2 - 0.4, H + 2.2, 2.4, { part: 3 });
  b.box('roof_metal_grey', tx, H + 6, tz, hx2 + 0.3, 0.4, hz2 + 0.3);
  if (b.d >= 1) b.box('metal_dark', tx, H + 6.4, tz, 1.6, 2.0, 1.6);
  b.light(tx, H + 8.6, tz, 0xff2a20, 0.3);
  b.sign(fh.front, 0, H + 0.6, Math.min(hx2 - 1, 6), 1.2, { logo: b.pick(['paint_red', 'paint_blue', 'paint_yellow']), disc: true });
  b.take(tx, tz, Math.max(ts, hx2), Math.max(ts, hz2), 0.3);
  // Erzbunker auf Stützen
  const p = b.plan.find(5.0, 4.4, { prefer: 'right', pad: 0.2 });
  if (p) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('concrete', p[0] + sx * 1.9, 0, p[1] + sz * 1.6, 0.6, 5.0, 0.6);
    b.box(b.pick(['metal_corrugated', 'concrete']), p[0], 5.0, p[1], 4.6, 4.0, 4.0);
    if (b.d >= 1) b.box('metal_dark', p[0], 3.6, p[1], 1.6, 1.4, 1.6);
    b.conveyor([tx + ts / 2, H * 0.4, tz], [p[0], 9.5, p[1]], { w: 1.2, mat: 'metal_corrugated', noEnd: true });
    b.put(8.5, 2.6, { near: [p[0], p[1]] }, (px, pz, ry) => b.truck(px, pz, ry, { type: 'rigid', load: 'tipper', fill: 'rust' }));
  }
  if (L >= 3) { const q = b.plan.find(6.4, 4.8, { prefer: 'front', pad: 0.2 }); if (q) { const H2 = b.hall({ x: q[0], z: q[1], sx: 6.2, sz: 4.6, h: 6, wall: 'metal_panel_grey', roof: 'gable', roofMat: 'roof_metal_grey', pitch: 12, ridge: 'x', bay: 3, plinthH: 0.6 }); b.rollerDoor(H2.f.front, 0, 3, 3.6, {}); } }
  if (L >= 2) { const r = 2.0 + L * 0.6; const q = b.plan.find(2 * r, 2 * r, { prefer: 'front', pad: 0 }); if (q) heap(b, q[0], q[1], r, r * 0.65, 'rock'); }
  b.lamp(X - 0.5, Z - 0.5, 7);
}

// Stollen: Felshügel mit Mundloch, Grubenbahn mit Hunten zum Verladebunker, Werkstattschuppen
function stollen(b) {
  const { W, D, X, Z, wide, deep } = geom(b);
  const L = b.L;
  b.lot('dirt', 0.08);
  const rock = b.pick(['rock', 'stone_grey', 'stone_dark']);
  // Hügel: vordere Halbkuppel, hinten bündig mit der Grundstückskante
  const hr = Math.min(X - 0.3, (deep ? 7.5 : 5.2)), sy = 0.6 + L * 0.05, hzc = -Z + 0.3;
  const half = (mat, x, z, r, k) => { const s2 = b.seg(14); const g = new THREE.SphereGeometry(r, s2, Math.max(3, s2 >> 2), 0, PI, 0, HP); g.scale(1, k, 1); b.g(mat, g, x, 0, z, {}); };
  half(rock, 0, hzc, hr, sy);
  if (b.d >= 1) { half('grass_dry', -hr * 0.25, hzc, hr * 0.62, sy * 1.25); b.tree(-X + 2.0, -Z + 1.6, 0.7, 'nadel'); b.tree(X - 2.0, -Z + 1.8, 0.8, 'nadel'); }
  // Mundloch(e)
  const portals = wide ? [-X / 2, X / 2].map((v) => clamp(v, -hr * 0.55, hr * 0.55)) : [0];
  const pz = hzc + hr * Math.sqrt(Math.max(0.05, 1 - (2.0 / (hr * sy)) ** 2)) - 0.6;
  portals.forEach((px, i) => {
    if (i > 0 && L < 2) return;
    b.box('stone_grey', px, 0, pz, 3.4, 3.6, 1.0);
    b.box('metal_dark', px, 0, pz + 0.05, 2.0, 2.6, 1.0);
    if (b.d >= 1) { b.prism('stone_grey', [[-1.9, 0], [1.9, 0], [1.7, 0.7], [-1.7, 0.7]], 1.1, px, 3.6, pz, 0); for (const sg of [-1, 1]) b.box('wood_dark', px + sg * 1.05, 0, pz + 0.55, 0.25, 2.7, 0.25); b.box('wood_dark', px, 2.6, pz + 0.55, 2.4, 0.25, 0.25); }
    rails(b, px, pz + 0.6, px, Z - 0.6);
    for (let k = 0; k < 1 + Math.min(2, L); k++) { const cz = pz + 2.0 + k * 1.7; if (cz < Z - 1.0) cart(b, px, cz, 0, b.pick(['stone_dark', 'rust', 'rock'])); }
    b.take(px, (pz + Z) / 2, 1.9, Z - pz, 0.2);
  });
  b.take(0, hzc + hr / 2, 2 * hr, hr, 0.2);
  // Verladebunker (Tipple) über dem Gleis ab Stufe 2
  if (L >= 2) {
    const tx = portals[0], tz = Z - 3.0;
    for (const s of [-1, 1]) for (const t of [-1, 1]) b.box('wood_dark', tx + s * 1.4, 0, tz + t * 1.0, 0.3, 4.0, 0.3);
    b.box('wood_planks', tx, 4.0, tz, 3.4, 2.6, 2.6);
    b.box('roof_metal_grey', tx, 6.6, tz, 3.8, 0.2, 3.0);
  }
  // Schuppen und Halde
  const p = b.plan.find(4.0, 3.2, { prefer: 'right', pad: 0.2 });
  if (p) { const H = b.hall({ x: p[0], z: p[1], sx: 3.8, sz: 3.0, h: 3.0, wall: 'wood_planks', roof: 'gable', roofMat: 'metal_corrugated', pitch: 25, ridge: 'x', ribs: false, plinthH: 0.2 }); b.door(H.f.front, 0, { mat: 'wood_dark', canopy: false }); }
  if (L >= 3) { const r = 1.8 + L * 0.5; const q = b.plan.find(2 * r, 2 * r, { prefer: 'right', pad: 0 }); if (q) heap(b, q[0], q[1], r, r * 0.7, 'stone_dark'); }
  if (wide || deep) b.putTruck({ type: 'rigid', load: 'tipper', fill: 'stone_dark' }, { prefer: 'front' });
  b.lamp(X - 0.5, Z - 0.5, 5);
}

// Kalibergwerk: große weiße Salzhalde, Fördergerüst, Förderband zur Haldenspitze, Fabrikhallen
function kaliwerk(b) {
  const { W, D, X, Z, wide, deep } = geom(b);
  const L = b.L;
  b.lot('asphalt_dark', 0.08);
  const white = b.pick(['plaster_white', 'concrete_panel', 'plaster_white']);
  const r = clamp(2.6 + L * 1.0 + (wide && deep ? 3 : wide || deep ? 1.5 : 0), 2.6, Math.min(W, D) * 0.47);
  const hxp = wide ? X - r - 0.3 : 0, hzp = -Z + r + 0.3;
  heap(b, hxp, hzp, r, r * 0.8, white);
  // Fördergerüst vorne links
  const H = 14 + L * 4, gx = wide ? -X + 3.4 : -X + 3.0, gz = Z - 3.2;
  const S = b.hall({ x: gx, z: gz, sx: 5.0, sz: 4.4, h: 5, wall: 'metal_panel_grey', roof: 'gable', roofMat: 'roof_metal_grey', pitch: 20, ridge: 'x', ribs: false, plinthH: 0.5 });
  b.rollerDoor(S.f.front, 0, 2.4, 3.2, {});
  b.take(gx, gz, 5.0, 4.4, 0.2);
  headframe(b, gx, gz, H, { mat: b.pick(['paint_green', 'metal_dark', 'paint_blue']), sl: 2.4, ropeZ: 2, ropeY: 5 });
  b.conveyor([gx + 2.5, 5.5, gz - 0.5], [hxp, r * 0.8 + 0.6, hzp], { w: 1.3, mat: 'metal_corrugated', noEnd: true });
  // Fabrikhalle mit Dampf ab Stufe 2
  if (L >= 2) {
    const p = b.plan.find(7.0, 5.0, { prefer: 'front', pad: 0.2 });
    if (p) {
      b.hall({ x: p[0], z: p[1], sx: 6.8, sz: 4.8, h: 8, wall: 'metal_panel_white', roof: 'flat', roofMat: 'roof_flat_membrane', bay: 3.4, ribMat: 'metal_dark', plinthH: 0.6 });
      b.chimney(p[0] + 2.4, p[1] - 1.4, { type: 'steel', h: 14 + L * 2, r: 0.55, smoke: 0.8, kind: 'steam', mat: 'metal_light' });
    }
  }
  b.putTruck({ type: 'rigid', load: 'tipper', fill: white }, { prefer: 'front' });
  b.lamp(X - 0.5, Z - 0.5, 7);
}

export const MINE = [zeche, steinbruch, kieswerk, hammerturm, stollen, kaliwerk];
export function buildMine(ctx) {
  const b = new B(ctx);
  MINE[ctx.variant % MINE.length](b);
  return b.finish();
}
