// Kulturbauten: Opernhaus (2 × 2), Museum (2 × 2), Sternwarte (1 × 1). Besitzer: G6.
import * as THREE from 'three';
import { registerArch } from './index.js';
import { M } from './kit.js';
import { beam, lathe, slab, column, pediment, archWindow, stairs, lamp, bench, tree, flag, addAnim, face, torus, glassRail, railing, crowd } from './lm_parts.js';
import { text } from './lm_text.js';

// Schalendach (wie ein Segel): vorn hoch und offen, nach hinten zum Boden auslaufend, mit spitzem First.
// Ursprung = Mitte der vorderen Öffnung am Boden, Öffnung zeigt nach +z (vor Drehung ry).
function shell(kit, mat, x, y0, z, ry, W, H, L, o = {}) {
  const nu = kit.detail === 2 ? 18 : kit.detail === 1 ? 10 : 6, nv = kit.detail === 2 ? 12 : kit.detail === 1 ? 7 : 4;
  const over = o.over ?? 0.12 * H, p = o.p ?? 1.7;
  const pos = [], idx = [];
  const P = (s, v) => {
    const w = W * Math.pow(1 - v, 0.35) + 0.0001, h = H * Math.pow(1 - v * v, 0.9);
    const y = h * (1 - Math.pow(Math.abs(s), p));
    return [w * s, y, -v * L + (y / H) * over * (1 - v)];
  };
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) pos.push(...P(-1 + (2 * i) / nu, j / nv));
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  kit.add(mat, geo, { x, y: y0, z, ry });
  // Innenseite (sichtbar unter dem Überstand)
  const inner = geo.clone();
  inner.setIndex(idx.slice().reverse());
  inner.scale(0.97, 0.97, 0.97);
  inner.computeVertexNormals();
  kit.add(o.inner || mat, inner, { x, y: y0, z, ry });
  // Glaswand in der Öffnung (etwas zurückgesetzt)
  if (o.glass !== false) {
    const vg = 0.12, outline = [];
    for (let i = 0; i <= nu; i++) { const q = P(-1 + (2 * i) / nu, vg); outline.push([q[0], q[1]]); }
    const zG = -vg * L + 0.02 * M;
    const f = face(x, z, ry);
    const [gx, gz] = f.at(0, zG);
    slab(kit, o.glass || 'glass_curtain_gold', outline, 0.06 * M, { x: gx, y: y0, z: gz, ry, lit: o.lit ?? 0.9 });
    if (kit.detail > 0) {
      const n = kit.detail === 2 ? 9 : 5;
      for (let i = 1; i < n; i++) {
        const s = -1 + (2 * i) / n, q = P(s, vg);
        const [mx, mz] = f.at(q[0], zG + 0.06 * M);
        kit.box('metal_dark', mx, y0, mz, 0.08 * M, q[1], 0.08 * M, { ry });
      }
    }
  }
  // Rippen (Fugenlinien) auf der Schale
  if (kit.detail === 2) for (const s of [-0.66, -0.33, 0, 0.33, 0.66]) {
    const pts = [];
    for (let j = 0; j <= 6; j++) { const q = P(s, j / 6.5); const [rx, rz] = face(x, z, ry).at(q[0], q[2]); pts.push([rx, y0 + q[1] + 0.03 * M, rz]); }
    for (let j = 0; j < pts.length - 1; j++) beam(kit, o.rib || 'marble', pts[j], pts[j + 1], 0.12 * M, 0.06 * M);
  }
}

registerArch('opera', {
  variants: 1,
  build(ctx) {
    const { kit, detail } = ctx;
    const PH = 2.2 * M; // Podium
    kit.box('pavers', 0, 0, 0, 19.8 * M, 0.08 * M, 19.8 * M);
    // Podium mit Foyer-Glasbändern
    kit.box('stone_sandstone', 0, 0, -2.2 * M, 19.0 * M, PH, 15.0 * M);
    kit.box('stone_grey', 0, PH, -2.2 * M, 19.2 * M, 0.25 * M, 15.2 * M);
    for (const s of [-1, 1]) kit.box('glass_curtain_gold', s * 9.52 * M, 0.3 * M, -2.2 * M, 0.04 * M, PH - 0.6 * M, 13.0 * M, { lit: 0.9 });
    kit.box('glass_curtain_gold', 0, 0.3 * M, -9.72 * M, 16.0 * M, PH - 0.6 * M, 0.04 * M, { lit: 0.9 });
    // Freitreppe über die ganze Breite
    stairs(kit, 'stone_grey', 0, 5.3 * M, 0, 15.0 * M, PH + 0.25 * M, 4.0 * M, { steps: detail === 2 ? 14 : 5 });
    if (detail > 0) for (const s of [-1, 1]) {
      kit.box('stone_sandstone', s * 7.9 * M, 0, 7.3 * M, 1.4 * M, 1.2 * M, 4.0 * M);
      lamp(kit, s * 7.9 * M, 8.8 * M, 4.0 * M, { style: 'globe' });
    }
    // Schalen: große Halle (links), kleine Halle (rechts), Restaurant (vorn rechts)
    const Y = PH + 0.25 * M;
    const big = [[-3.4, 3.8, 3.4, 10.5, 5.4, 0], [-3.4, -0.6, 3.6, 12.5, 5.6, 0], [-3.4, -5.6, 3.2, 8.5, 4.2, Math.PI]];
    const small = [[4.6, 2.6, 2.5, 7.5, 4.2, 0], [4.6, -1.4, 2.7, 9.0, 4.6, 0], [4.6, -6.0, 2.4, 6.0, 3.4, Math.PI]];
    for (const [sx, sz, w, h, l, r] of [...big, ...small]) shell(kit, 'tile_white', sx * M, Y, sz * M, r, w * M, h * M, l * M, { inner: 'marble' });
    shell(kit, 'tile_white', 7.6 * M, Y, 3.4 * M, 0.5, 1.6 * M, 4.2 * M, 2.6 * M, { inner: 'marble' });
    // Sockelbauten unter den Schalen (Bühnenhaus)
    kit.box('stone_sandstone', -3.4 * M, Y, -3.0 * M, 6.4 * M, 3.0 * M, 7.0 * M);
    kit.box('stone_sandstone', 4.6 * M, Y, -2.6 * M, 4.8 * M, 2.4 * M, 6.0 * M);
    // Schriftzug am Podium
    text(kit, 'trim_dark', 'OPER', 3.4 * M, Y, 4.9 * M, 0, 1.1 * M, { depth: 0.25 * M, weight: 1.1 });
    crowd(kit, 0, 7.4 * M, 14 * M, 3.4 * M, 12);
    crowd(kit, 0, 9.2 * M, 16 * M, 1.0 * M, 6);
    // Uferpromenade-Möblierung
    if (detail > 0) {
      const rail = [[-9.4 * M, -9.8 * M], [9.4 * M, -9.8 * M]];
      railing(kit, rail, 0, 1.0 * M, { mat: 'metal_dark' });
      for (const s of [-1, 1]) { tree(kit, s * 9.0 * M, 9.0 * M, 0.7, 'round'); bench(kit, s * 3.0 * M, 9.4 * M, Math.PI); flag(kit, s * 6.0 * M, 9.2 * M, 6.5 * M, 'paint_red'); }
      kit.light(-3.4 * M, Y + 3 * M, 5.0 * M, 0xffd79a, 1.2);
      kit.light(4.6 * M, Y + 2 * M, 4.0 * M, 0xffd79a, 1.0);
    }
    return kit.build();
  },
});

registerArch('museum', {
  variants: 1,
  build(ctx) {
    const { kit, detail } = ctx;
    const ST = 'stone_sandstone', TR = 'trim_stone';
    const PB = 1.4 * M, H = 11.0 * M;
    kit.box('pavers', 0, 0, 0, 19.8 * M, 0.08 * M, 19.8 * M);
    kit.box('grass', 0, 0.02 * M, -8.6 * M, 19.6 * M, 0.08 * M, 2.6 * M);
    // Hauptbau auf Sockel
    const BZ = -2.8 * M, BW = 17.4 * M, BD = 10.0 * M;
    kit.box('stone_grey', 0, 0, BZ, BW + 0.4 * M, PB, BD + 0.4 * M);
    kit.box(ST, 0, PB, BZ, BW, H - PB, BD);
    kit.band(TR, 0, BZ, BW, BD, PB + 4.4 * M, 0.3 * M, 0.12 * M);
    kit.band(TR, 0, BZ, BW, BD, H - 1.2 * M, 1.2 * M, 0.3 * M);
    kit.box(ST, 0, H, BZ, BW - 0.4 * M, 1.3 * M, BD - 0.4 * M);
    kit.band(TR, 0, BZ, BW - 0.4 * M, BD - 0.4 * M, H + 1.2 * M, 0.2 * M, 0.12 * M);
    kit.box('roof_flat_gravel', 0, H + 1.3 * M, BZ, BW - 0.8 * M, 0.06 * M, BD - 0.8 * M);
    // Pilaster und Blendnischen mit Statuen an den Flanken
    for (const side of [{ x: -BW / 2, ry: -Math.PI / 2, len: BD }, { x: BW / 2, ry: Math.PI / 2, len: BD }]) {
      const f = face(side.x, BZ, side.ry);
      for (const u of [-3.4 * M, 0, 3.4 * M]) {
        const [px, pz] = f.at(u, 0);
        archWindow(kit, px, PB + 1.2 * M, pz, side.ry, 1.6 * M, 5.2 * M, { kind: 'round', frame: TR, glass: 'stone_dark', mullions: 0, lit: 0, key: true });
      }
      if (detail > 0) for (const u of [-5.0 * M, -1.7 * M, 1.7 * M, 5.0 * M]) { const [px, pz] = f.at(u, 0.15 * M); kit.box(TR, px, PB, pz, 0.7 * M, H - PB - 1.2 * M, 0.3 * M, { ry: side.ry }); }
    }
    // Frontflügel links und rechts vom Portikus: hohe Fenster
    for (const s of [-1, 1]) {
      const f = face(s * 6.6 * M, BZ + BD / 2, 0);
      for (const u of [-1.4 * M, 1.4 * M]) { const [px, pz] = f.at(u, 0); archWindow(kit, px, PB + 1.2 * M, pz, 0, 1.5 * M, 5.0 * M, { kind: 'round', frame: TR, mullions: 1, key: true }); }
      if (detail > 0) { const [px, pz] = f.at(0, 0.1 * M); kit.box(TR, px, PB + 7.0 * M, pz, 4.4 * M, 1.6 * M, 0.2 * M); }
    }
    // Rückseite
    kit.windows('back', 0, BZ, BW, BD, PB + 1.0 * M, 2, 4.2 * M, { winW: 1.4 * M, winH: 2.6 * M, spacing: 3.4 * M, frame: 'window_frame_white' });
    // Portikus: Stylobat, sechs Säulen, Gebälk mit Inschrift, Giebel
    const PZ0 = BZ + BD / 2, PZ1 = PZ0 + 3.6 * M, PW = 11.0 * M;
    kit.box('stone_grey', 0, 0, (PZ0 + PZ1) / 2, PW + 0.6 * M, PB, PZ1 - PZ0 + 0.2 * M);
    stairs(kit, 'stone_grey', 0, PZ1 + 0.1 * M, 0, PW - 1.0 * M, PB, 2.6 * M, { steps: detail === 2 ? 8 : 3 });
    const CH = 7.4 * M;
    for (let i = 0; i < 6; i++) {
      const u = -PW / 2 + 0.9 * M + (i * (PW - 1.8 * M)) / 5;
      column(kit, 'marble', u, PB, PZ1 - 0.6 * M, 0.48 * M, CH, { base: TR, cap: TR });
      if (detail > 0 && i < 5) {
        // Fahnen (Ausstellungsbanner) zwischen den Säulen
        const ub = u + (PW - 1.8 * M) / 10;
        kit.box(i % 2 ? 'paint_blue' : 'paint_red', ub, PB + 2.6 * M, PZ1 - 0.6 * M, 1.0 * M, 4.2 * M, 0.04 * M);
      }
      if (detail > 0) column(kit, 'marble', u, PB, PZ0 + 0.9 * M, 0.42 * M, CH, { base: TR, cap: TR });
    }
    const EY = PB + CH;
    kit.box(TR, 0, EY, (PZ0 + PZ1) / 2, PW + 0.4 * M, 1.5 * M, PZ1 - PZ0 + 0.4 * M);
    kit.box('marble', 0, EY + 1.5 * M, (PZ0 + PZ1) / 2, PW + 0.7 * M, 0.35 * M, PZ1 - PZ0 + 0.7 * M);
    text(kit, 'trim_dark', 'MUSEUM', 0, EY + 0.45 * M, PZ1 + 0.22 * M, 0, 0.7 * M, { depth: 0.05 * M });
    pediment(kit, 'marble', 0, EY + 1.85 * M, (PZ0 + PZ1) / 2, 0, PW + 0.5 * M, 2.4 * M, PZ1 - PZ0 + 0.4 * M, { cornice: TR });
    kit.prism('roof_copper', [[-(PW + 0.9 * M) / 2, 0], [(PW + 0.9 * M) / 2, 0], [0, 2.6 * M]], PZ1 - PZ0 + 1.0 * M, { x: 0, y: EY + 1.95 * M, z: (PZ0 + PZ1) / 2 - 0.4 * M });
    if (detail > 0) {
      kit.box('door_wood', 0, PB, PZ0 + 0.06 * M, 2.2 * M, 4.2 * M, 0.1 * M);
      kit.box(TR, 0, PB + 4.2 * M, PZ0 + 0.1 * M, 2.8 * M, 0.35 * M, 0.2 * M);
      for (const u of [-3.4 * M, 3.4 * M]) kit.box('glass_window', u, PB + 0.2 * M, PZ0 + 0.06 * M, 1.6 * M, 3.6 * M, 0.06 * M, { lit: 0.97 });
      for (const [u, h] of [[0, 2.4], [-(PW + 0.5 * M) / 2, 0], [(PW + 0.5 * M) / 2, 0]]) kit.sphere('paint_yellow', u, EY + 1.85 * M + h * M + 0.25 * M, PZ1 - 0.2 * M, 0.3 * M, { seg: 6 });
    }
    // Rotunde mit Kuppel und Laterne
    const DZ = BZ - 0.5 * M, DY = H + 1.3 * M;
    kit.cyl(ST, 0, DY, DZ, 3.8 * M, 3.0 * M, { seg: detail === 2 ? 24 : 14 });
    kit.cyl(TR, 0, DY + 2.8 * M, DZ, 4.05 * M, 0.4 * M, { seg: detail === 2 ? 24 : 14 });
    if (detail > 0) for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      archWindow(kit, Math.sin(a) * 3.8 * M, DY + 0.5 * M, DZ + Math.cos(a) * 3.8 * M, a, 0.8 * M, 1.8 * M, { kind: 'round', frame: TR, mullions: 0, sill: false });
    }
    lathe(kit, 'roof_copper', 0, DY + 3.2 * M, DZ, [[3.9 * M, 0], [3.7 * M, 1.4 * M], [3.0 * M, 2.8 * M], [1.8 * M, 3.8 * M], [0.7 * M, 4.2 * M]], detail === 2 ? 24 : 12);
    kit.cyl('glass_window', 0, DY + 7.3 * M, DZ, 0.8 * M, 1.2 * M, { seg: 10, lit: 0.8 });
    kit.cone('roof_copper', 0, DY + 8.5 * M, DZ, 1.0 * M, 1.0 * M, { seg: 10 });
    kit.sphere('paint_yellow', 0, DY + 9.6 * M, DZ, 0.2 * M, { seg: 6 });
    // Moderner Glaswürfel-Anbau hinten rechts
    kit.box('glass_curtain_blue', 6.2 * M, 0, -8.4 * M, 6.0 * M, 7.2 * M, 2.6 * M, { lit: 0.85 });
    kit.box('metal_panel_white', 6.2 * M, 7.2 * M, -8.4 * M, 6.4 * M, 0.4 * M, 3.0 * M);
    crowd(kit, 0, PZ1 + 1.6 * M, PW - 2 * M, 2.0 * M, 7);
    crowd(kit, 2.0 * M, 8.6 * M, 10 * M, 1.6 * M, 6);
    // Skulptur auf dem Vorplatz
    if (detail > 0) {
      kit.box('stone_dark', -7.0 * M, 0, 7.4 * M, 2.0 * M, 0.6 * M, 2.0 * M);
      kit.add('paint_red', new THREE.TorusKnotGeometry(0.8 * M, 0.18 * M, detail === 2 ? 64 : 24, 6, 2, 3), { x: -7.0 * M, y: 1.8 * M, z: 7.4 * M });
      for (const s of [-1, 1]) { lamp(kit, s * 8.8 * M, 8.8 * M, 4.0 * M, { style: 'old' }); tree(kit, s * 8.6 * M, -8.6 * M, 0.7, 'round'); }
      tree(kit, 8.4 * M, 6.4 * M, 0.75, 'round');
      bench(kit, 6.4 * M, 8.8 * M, Math.PI);
    }
    return kit.build();
  },
});

registerArch('observatory', {
  variants: 1,
  build(ctx) {
    const { kit, detail } = ctx;
    const seg = detail === 2 ? 24 : detail === 1 ? 14 : 10;
    kit.box('grass', 0, 0, 0, 9.8 * M, 0.06 * M, 9.8 * M);
    kit.box('gravel', 0, 0.02 * M, 3.6 * M, 2.0 * M, 0.06 * M, 2.8 * M);
    // Hauptbau (Backstein, weiße Gesimse)
    kit.box('brick_red', 0, 0, -0.6 * M, 6.4 * M, 6.0 * M, 6.4 * M);
    kit.box('stone_grey', 0, 0, -0.6 * M, 6.6 * M, 0.6 * M, 6.6 * M);
    kit.band('plaster_white', 0, -0.6 * M, 6.4 * M, 6.4 * M, 2.9 * M, 0.25 * M, 0.1 * M);
    kit.band('plaster_white', 0, -0.6 * M, 6.4 * M, 6.4 * M, 5.6 * M, 0.45 * M, 0.2 * M);
    for (const side of ['front', 'left', 'right', 'back']) kit.windows(side, 0, -0.6 * M, 6.4 * M, 6.4 * M, 0.6 * M, 2, 2.6 * M, { winW: 1.0 * M, winH: 1.5 * M, spacing: 2.2 * M, frame: 'window_frame_white', sill: true });
    kit.door(0, -0.6 * M, 6.4 * M, { canopy: 'plaster_white', w: 1.4 * M });
    // Trommel für die Kuppel
    const DY = 6.0 * M, R = 2.9 * M;
    kit.cyl('plaster_white', 0, DY, -0.6 * M, R + 0.1 * M, 1.6 * M, { seg });
    if (detail > 0) {
      railing(kit, [[-3.0 * M, -3.6 * M], [3.0 * M, -3.6 * M], [3.0 * M, 2.4 * M], [-3.0 * M, 2.4 * M], [-3.0 * M, -3.6 * M]], DY + 0.05 * M, 0.9 * M, { mat: 'metal_dark' });
      kit.box('roof_flat_membrane', 0, DY, -0.6 * M, 6.2 * M, 0.06 * M, 6.2 * M);
    }
    // Seitenflügel mit kleiner fester Kuppel
    kit.box('brick_red', -3.4 * M, 0, 2.4 * M, 3.0 * M, 3.4 * M, 3.0 * M);
    kit.box('plaster_white', -3.4 * M, 3.2 * M, 2.4 * M, 3.2 * M, 0.3 * M, 3.2 * M);
    kit.dome('metal_panel_white', -3.4 * M, 3.5 * M, 2.4 * M, 1.3 * M, { seg: detail === 2 ? 16 : 10 });
    kit.windows('front', -3.4 * M, 2.4 * M, 3.0 * M, 3.0 * M, 0.4 * M, 1, 2.6 * M, { winW: 1.0 * M, winH: 1.4 * M, frame: 'window_frame_white' });
    // Radioteleskop im Garten
    if (detail > 0) {
      kit.cyl('metal_light', 3.4 * M, 0, 3.4 * M, 0.25 * M, 2.2 * M, { seg: 6 });
      kit.add('metal_panel_white', new THREE.SphereGeometry(1.6 * M, detail === 2 ? 14 : 8, 5, 0, Math.PI * 2, 0, 0.9), { x: 3.4 * M, y: 2.6 * M, z: 3.4 * M, rx: -0.9, ry: 0.6, sy: 0.45 });
      beam(kit, 'metal_light', [3.4 * M, 2.3 * M, 3.4 * M], [3.4 * M + 0.6 * M, 3.6 * M, 3.4 * M + 0.55 * M], 0.06 * M);
    }
    if (detail === 2) { tree(kit, -3.6 * M, -3.8 * M, 0.6, 'round'); lamp(kit, 1.4 * M, 4.4 * M, 3.4 * M, { style: 'globe' }); bench(kit, -1.6 * M, 4.3 * M, Math.PI); }
    const res = kit.build();
    // Drehende Kuppel mit Spalt und Teleskop
    addAnim(ctx, res, [0, DY + 1.6 * M, -0.6 * M], 'y', 0.08, (k) => {
      const ds = detail === 2 ? 28 : detail === 1 ? 16 : 10;
      const gap = 0.42;
      k.add('metal_panel_white', new THREE.SphereGeometry(R, ds, Math.max(5, ds >> 1), Math.PI / 2 + gap / 2, Math.PI * 2 - gap, 0, Math.PI / 2), {});
      if (detail > 0) {
        // Spaltränder und Schienen
        for (const s of [-1, 1]) {
          const a = s * gap / 2;
          for (let j = 0; j < 6; j++) {
            const t0 = (j / 6) * (Math.PI / 2), t1 = ((j + 1) / 6) * (Math.PI / 2);
            const p0 = [Math.sin(a) * Math.sin(t0) * R * 1.01, Math.cos(t0) * R * 1.01, Math.cos(a) * Math.sin(t0) * R * 1.01];
            const p1 = [Math.sin(a) * Math.sin(t1) * R * 1.01, Math.cos(t1) * R * 1.01, Math.cos(a) * Math.sin(t1) * R * 1.01];
            beam(k, 'metal_dark', p0, p1, 0.15 * M, 0.15 * M);
          }
        }
        torus(k, 'metal_dark', 0, 0.05 * M, 0, R + 0.02 * M, 0.1 * M, { rx: Math.PI / 2, tubular: ds, radial: 3 });
      }
      // Teleskop, schräg im Spalt
      k.cyl('metal_dark', 0, 0, 0, 0.4 * M, 0.9 * M, { seg: 8 });
      k.cyl('paint_white', 0, 0.9 * M, -0.6 * M, 0.42 * M, 3.4 * M, { seg: 10, rx: 0.75 });
      if (detail > 0) k.cyl('metal_dark', 0, 0.9 * M, -0.6 * M, 0.46 * M, 0.3 * M, { seg: 10, rx: 0.75 });
    });
    return res;
  },
});
void glassRail; void torus;
