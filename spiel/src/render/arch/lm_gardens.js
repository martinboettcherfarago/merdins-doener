// Gärten und Tiere: Botanischer Garten (3 × 2) mit Palmenhaus, Zoo (3 × 3) mit Gehegen und Tieren. Besitzer: G6.
import * as THREE from 'three';
import { registerArch } from './index.js';
import { M } from './kit.js';
import { beam, rod, lathe, torus, tube, railing, glassRail, lamp, bench, tree, flag, hut, face, flat, fountain, path, crowd } from './lm_parts.js';
import { text } from './lm_text.js';

// Glaskuppel mit weißen Eisenrippen
function glassDome(kit, x, y0, z, R, o = {}) {
  const seg = kit.detail === 2 ? 20 : kit.detail === 1 ? 12 : 8;
  kit.dome(o.glass || 'glass_skylight', x, y0, z, R, { seg, lit: o.lit ?? 0.6 });
  if (kit.detail === 0) return;
  const n = kit.detail === 2 ? 10 : 6;
  for (let k = 0; k < n; k++) torus(kit, o.rib || 'paint_white', x, y0, z, R + 0.03 * M, 0.08 * M, { arc: Math.PI, ry: (k / n) * Math.PI, tubular: 12, radial: 3 });
  for (const t of [0.35, 0.7]) torus(kit, o.rib || 'paint_white', x, y0 + R * Math.sin(t * Math.PI / 2), z, R * Math.cos(t * Math.PI / 2) + 0.03 * M, 0.07 * M, { rx: Math.PI / 2, tubular: seg, radial: 3 });
}
// Gläsernes Tonnengewölbe entlang x
function glassVault(kit, x, y0, z, len, R, o = {}) {
  const seg = kit.detail === 2 ? 14 : 8;
  const geo = new THREE.CylinderGeometry(R, R, len, seg, 1, true, -Math.PI / 2, Math.PI);
  kit.add(o.glass || 'glass_skylight', geo, { x, y: y0, z, rx: -Math.PI / 2, ry: Math.PI / 2, lit: o.lit ?? 0.6 });
  if (kit.detail === 0) return;
  const n = Math.max(2, Math.round(len / (kit.detail === 2 ? 1.6 * M : 3.2 * M)));
  for (let k = 0; k <= n; k++) torus(kit, o.rib || 'paint_white', x - len / 2 + (k * len) / n, y0, z, R + 0.03 * M, 0.08 * M, { arc: Math.PI, ry: Math.PI / 2, tubular: 10, radial: 3 });
  beam(kit, o.rib || 'paint_white', [x - len / 2, y0 + R + 0.05 * M, z], [x + len / 2, y0 + R + 0.05 * M, z], 0.15 * M, 0.15 * M);
}

registerArch('botanical', {
  variants: 1,
  build(ctx) {
    const { kit, detail } = ctx;
    kit.box('grass', 0, 0, 0, 29.8 * M, 0.06 * M, 19.8 * M);
    // --- Palmenhaus: Mittelkuppel, zwei Flügel mit Tonnengewölbe, Eckpavillons
    const PZ = -4.8 * M;
    kit.box('stone_grey', 0, 0, PZ, 27.0 * M, 0.6 * M, 7.4 * M);
    // Mittelbau
    kit.cyl('stone_grey', 0, 0, PZ, 5.4 * M, 0.6 * M, { seg: 16 });
    kit.cyl('glass_skylight', 0, 0.6 * M, PZ, 4.8 * M, 4.4 * M, { seg: detail === 2 ? 20 : 12, lit: 0.6 });
    if (detail > 0) for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; kit.box('paint_white', Math.sin(a) * 4.82 * M, 0.6 * M, PZ + Math.cos(a) * 4.82 * M, 0.14 * M, 4.4 * M, 0.14 * M, { ry: a }); }
    kit.cyl('paint_white', 0, 5.0 * M, PZ, 5.0 * M, 0.35 * M, { seg: 20 });
    glassDome(kit, 0, 5.35 * M, PZ, 4.8 * M);
    kit.cyl('glass_skylight', 0, 10.0 * M, PZ, 1.0 * M, 1.4 * M, { seg: 10, lit: 0.6 });
    kit.cone('paint_white', 0, 11.4 * M, PZ, 1.2 * M, 1.0 * M, { seg: 10 });
    kit.sphere('paint_yellow', 0, 12.5 * M, PZ, 0.22 * M, { seg: 6 });
    // Flügel
    for (const s of [-1, 1]) {
      const cx = s * 8.6 * M, len = 7.8 * M;
      for (const zz of [PZ - 3.0 * M, PZ + 3.0 * M]) kit.box('glass_skylight', cx, 0.6 * M, zz, len, 2.6 * M, 0.06 * M, { lit: 0.6 });
      if (detail > 0) for (let k = 0; k <= 6; k++) for (const zz of [PZ - 3.0 * M, PZ + 3.0 * M]) kit.box('paint_white', cx - len / 2 + (k * len) / 6, 0.6 * M, zz, 0.12 * M, 2.6 * M, 0.14 * M);
      kit.box('paint_white', cx, 3.2 * M, PZ, len, 0.2 * M, 6.3 * M);
      glassVault(kit, cx, 3.4 * M, PZ, len, 3.0 * M);
      // Eckpavillon mit kleiner Kuppel
      const ex = s * 13.4 * M;
      kit.box('glass_skylight', ex, 0.6 * M, PZ, 3.0 * M, 3.8 * M, 6.2 * M, { lit: 0.6 });
      if (detail > 0) for (const zz of [-3.1, 3.1]) for (const xx of [-1.5, 1.5]) kit.box('paint_white', ex + xx * M, 0.6 * M, PZ + zz * M, 0.16 * M, 3.8 * M, 0.16 * M);
      kit.box('paint_white', ex, 4.4 * M, PZ, 3.3 * M, 0.25 * M, 6.5 * M);
      glassDome(kit, ex, 4.65 * M, PZ, 1.5 * M);
    }
    // Palmen, die durch die Dachfenster lugen, und Pflanzen am Haus
    if (detail > 0) {
      for (const x of [-10.5, -6.8, 6.8, 10.5]) tree(kit, x * M, PZ + 3.9 * M, 0.5, 'topiary', { leaf: 'leaves_light' });
    }
    // --- Garten: Wege, Beete, Seerosenteich, Eingangstor
    path(kit, 'gravel', [0, PZ + 3.6 * M], [0, 9.8 * M], 2.6 * M);
    path(kit, 'gravel', [-14.4 * M, 3.4 * M], [14.4 * M, 3.4 * M], 2.0 * M);
    const FLOWERS = ['awning_red', 'field_rapeseed', 'plaster_pink', 'paint_orange', 'plaster_blue', 'paint_white'];
    let fi = 0;
    for (const sx of [-1, 1]) for (const [z0, z1] of [[-0.6, 2.2], [4.6, 9.0]]) {
      const x0 = sx * 2.0 * M, x1 = sx * 14.2 * M;
      const n = detail === 2 ? 6 : 3;
      for (let k = 0; k < n; k++) {
        const bx = x0 + (x1 - x0) * ((k + 0.5) / n), bw = Math.abs(x1 - x0) / n - 0.6 * M;
        kit.box('field_soil', bx, 0.02 * M, ((z0 + z1) / 2) * M, bw, 0.16 * M, (z1 - z0) * M - 0.6 * M);
        if (detail > 0) {
          const rows = 3;
          for (let r = 0; r < rows; r++) {
            const zz = (z0 + 0.5 + ((z1 - z0 - 1.0) * (r + 0.5)) / rows) * M;
            kit.box(FLOWERS[(fi++) % FLOWERS.length], bx, 0.18 * M, zz, bw - 0.3 * M, 0.25 * M, 0.45 * M);
          }
        }
      }
    }
    // Seerosenteich mit Holzsteg
    const TX = 8.4 * M, TZ = 6.8 * M;
    kit.cyl('stone_grey', TX, 0, TZ, 3.2 * M, 0.25 * M, { seg: 18 });
    kit.cyl('water_pool', TX, 0.08 * M, TZ, 3.0 * M, 0.2 * M, { seg: 18 });
    if (detail > 0) {
      for (let k = 0; k < (detail === 2 ? 12 : 5); k++) {
        const a = k * 2.4, r = (0.8 + (k % 3) * 0.7) * M;
        kit.cyl('leaves_light', TX + Math.cos(a) * r, 0.29 * M, TZ + Math.sin(a) * r, 0.45 * M, 0.03 * M, { seg: 7 });
        if (detail === 2 && k % 3 === 0) kit.sphere('plaster_pink', TX + Math.cos(a) * r, 0.36 * M, TZ + Math.sin(a) * r, 0.12 * M, { seg: 5 });
      }
      kit.box('wood_planks', TX - 1.8 * M, 0.3 * M, TZ, 3.0 * M, 0.1 * M, 1.0 * M);
    }
    fountain(kit, -8.4 * M, 6.8 * M, 1.8 * M, { stone: 'stone_grey' });
    // Bäume (exotisch und heimisch)
    if (detail > 0) {
      for (const [x, z, k, s] of [[-14, -9.2, 'conifer', 0.9], [14, -9.2, 'conifer', 0.9], [-14.2, 7.8, 'round', 0.8], [14.2, 7.6, 'round', 0.8], [-4.6, 8.8, 'palm', 0.8], [4.6, 8.8, 'palm', 0.8], [-12.6, 2.0, 'poplar', 0.8], [12.6, 2.0, 'poplar', 0.8]]) tree(kit, x * M, z * M, s, k);
      for (const s of [-1, 1]) { lamp(kit, s * 1.8 * M, 7.0 * M, 3.6 * M, { style: 'old' }); bench(kit, s * 4.0 * M, 2.1 * M, 0); }
    }
    crowd(kit, 0, 4.0 * M, 2.0 * M, 9.0 * M, 7);
    crowd(kit, 0, 3.4 * M, 26 * M, 1.4 * M, 8);
    // Eingangstor mit Schriftzug
    for (const s of [-1, 1]) {
      kit.box('stone_grey', s * 2.2 * M, 0, 9.4 * M, 0.7 * M, 3.4 * M, 0.7 * M);
      kit.box('hedge', s * 8.6 * M, 0, 9.5 * M, 12.0 * M, 1.0 * M, 0.6 * M);
    }
    kit.box('wood_dark', 0, 3.0 * M, 9.4 * M, 5.2 * M, 0.7 * M, 0.3 * M);
    text(kit, 'paint_yellow', 'BOTANIK', 0, 3.12 * M, 9.58 * M, 0, 0.45 * M, { depth: 0.05 * M });
    return kit.build();
  },
});

// ---------------------------------------------------------------- Tiere (vereinfachte Figuren)
function elephant(kit, x, z, ry, s = 1) {
  const f = face(x, z, ry), G = 'concrete_dark';
  const P = (u, w) => f.at(u * s, w * s);
  const [bx, bz] = P(0, 0);
  kit.add(G, new THREE.SphereGeometry(1, 10, 7), { x: bx, y: 2.1 * M * s, z: bz, sx: 1.1 * M * s, sy: 1.15 * M * s, sz: 1.9 * M * s, ry });
  for (const [u, w] of [[-0.6, 1.1], [0.6, 1.1], [-0.6, -1.1], [0.6, -1.1]]) { const [lx, lz] = P(u * M, w * M); kit.cyl(G, lx, 0, lz, 0.38 * M * s, 1.7 * M * s, { seg: 7 }); }
  const [hx, hz] = P(0, 2.2 * M);
  kit.sphere(G, hx, 2.6 * M * s, hz, 0.8 * M * s, { seg: 8 });
  if (kit.detail === 0) return;
  for (const sd of [-1, 1]) {
    const [ex, ez] = P(sd * 0.75 * M, 1.95 * M);
    kit.add(G, new THREE.CylinderGeometry(0.75 * M * s, 0.75 * M * s, 0.1 * M * s, 8), { x: ex, y: 2.6 * M * s, z: ez, rz: Math.PI / 2, ry: ry + sd * 0.5 });
    const [tx, tz] = P(sd * 0.3 * M, 2.8 * M);
    rod(kit, 'paint_white', [tx, 2.1 * M * s, tz], [tx + Math.sin(ry) * 0.5 * M * s, 2.3 * M * s, tz + Math.cos(ry) * 0.5 * M * s], 0.08 * M * s, 4, { rTop: 0.02 * M });
  }
  const pts = [[0, 2.3], [0, 2.95], [0, 3.2], [0, 3.3]].map(([u, w], i) => { const [px, pz] = P(u, w * M); return [px, (2.4 - i * 0.65) * M * s, pz]; });
  tube(kit, G, pts, 0.17 * M * s, { tubular: 8, radial: 5 });
}
function giraffe(kit, x, z, ry, s = 1) {
  const f = face(x, z, ry), C = 'plaster_ochre';
  const P = (u, w) => f.at(u * s, w * s);
  const [bx, bz] = P(0, 0);
  kit.add(C, new THREE.SphereGeometry(1, 9, 6), { x: bx, y: 2.6 * M * s, z: bz, sx: 0.6 * M * s, sy: 0.65 * M * s, sz: 1.2 * M * s, ry });
  for (const [u, w] of [[-0.35, 0.8], [0.35, 0.8], [-0.35, -0.8], [0.35, -0.8]]) { const [lx, lz] = P(u * M, w * M); kit.cyl(C, lx, 0, lz, 0.12 * M * s, 2.3 * M * s, { seg: 5 }); }
  const [n0x, n0z] = P(0, 0.8 * M), [n1x, n1z] = P(0, 1.6 * M);
  rod(kit, C, [n0x, 2.8 * M * s, n0z], [n1x, 5.0 * M * s, n1z], 0.22 * M * s, 6, { rTop: 0.14 * M * s });
  const [hx, hz] = P(0, 1.9 * M);
  kit.add(C, new THREE.BoxGeometry(0.3 * M * s, 0.32 * M * s, 0.75 * M * s), { x: hx, y: 5.05 * M * s, z: hz, ry, rx: 0.3 });
  if (kit.detail < 2) return;
  for (let k = 0; k < 10; k++) {
    const a = k * 2.1, sd = k % 2 ? 1 : -1;
    const [sx, sz] = P(sd * 0.58 * M, (-0.9 + (k / 10) * 1.8) * M);
    kit.cyl('wood_dark', sx, (2.3 + (a % 0.6)) * M * s, sz, 0.14 * M * s, 0.04 * M, { rz: Math.PI / 2, ry, seg: 6 });
  }
  for (const sd of [-1, 1]) { const [ox, oz] = P(sd * 0.1 * M, 1.75 * M); kit.cyl('wood_dark', ox, 5.2 * M * s, oz, 0.04 * M * s, 0.3 * M * s, { seg: 4 }); }
}
function penguin(kit, x, z, ry, s = 1) {
  const f = face(x, z, ry);
  kit.add('rubber', new THREE.SphereGeometry(1, 7, 5), { x, y: 0.38 * M * s, z, sx: 0.22 * M * s, sy: 0.38 * M * s, sz: 0.2 * M * s, ry });
  if (kit.detail === 0) return;
  const [bx, bz] = f.at(0, 0.06 * M * s);
  kit.add('paint_white', new THREE.SphereGeometry(1, 6, 5), { x: bx, y: 0.36 * M * s, z: bz, sx: 0.17 * M * s, sy: 0.3 * M * s, sz: 0.16 * M * s, ry });
  kit.sphere('rubber', x, 0.78 * M * s, z, 0.13 * M * s, { seg: 6 });
  const [kx, kz] = f.at(0, 0.14 * M * s);
  kit.cone('paint_orange', kx, 0.76 * M * s, kz, 0.04 * M * s, 0.12 * M * s, { seg: 4, rx: Math.PI / 2, ry });
}
function flamingo(kit, x, z, ry, s = 1) {
  const f = face(x, z, ry), C = 'plaster_red';
  kit.cyl('paint_orange', x, 0, z, 0.025 * M, 0.9 * M * s, { seg: 3 });
  kit.add(C, new THREE.SphereGeometry(1, 7, 5), { x, y: 1.05 * M * s, z, sx: 0.2 * M * s, sy: 0.2 * M * s, sz: 0.35 * M * s, ry });
  if (kit.detail === 0) return;
  const [n0x, n0z] = f.at(0, 0.25 * M * s), [n1x, n1z] = f.at(0, 0.3 * M * s);
  tube(kit, C, [[n0x, 1.1 * M * s, n0z], [n1x, 1.45 * M * s, n1z], [n0x, 1.7 * M * s, n0z]], 0.04 * M * s, { tubular: 6, radial: 3 });
  kit.sphere(C, n0x, 1.75 * M * s, n0z, 0.07 * M * s, { seg: 5 });
}
function zebra(kit, x, z, ry, s = 1) {
  const f = face(x, z, ry);
  kit.add('paint_white', new THREE.SphereGeometry(1, 8, 5), { x, y: 1.1 * M * s, z, sx: 0.4 * M * s, sy: 0.45 * M * s, sz: 0.95 * M * s, ry });
  for (const [u, w] of [[-0.22, 0.6], [0.22, 0.6], [-0.22, -0.6], [0.22, -0.6]]) { const [lx, lz] = f.at(u * M * s, w * M * s); kit.cyl('paint_white', lx, 0, lz, 0.07 * M * s, 0.9 * M * s, { seg: 4 }); }
  const [hx, hz] = f.at(0, 1.0 * M * s);
  kit.add('paint_white', new THREE.BoxGeometry(0.25 * M * s, 0.3 * M * s, 0.6 * M * s), { x: hx, y: 1.45 * M * s, z: hz, ry, rx: 0.6 });
  if (kit.detail < 2) return;
  for (let k = -3; k <= 3; k++) { const [px, pz] = f.at(0, k * 0.22 * M * s); kit.add('rubber', new THREE.BoxGeometry(0.84 * M * s, 0.9 * M * s, 0.07 * M * s), { x: px, y: 1.1 * M * s, z: pz, ry }); }
}

// Gehegezaun entlang Punktfolge
function fenceRun(kit, pts, h = 1.6 * M) {
  railing(kit, pts, 0, h, { mat: 'wood_dark', spacing: 1.4 * M });
}

registerArch('zoo', {
  variants: 1,
  build(ctx) {
    const { kit, detail } = ctx;
    kit.box('grass', 0, 0, 0, 29.8 * M, 0.06 * M, 29.8 * M);
    // Hauptwege
    path(kit, 'pavers', [0, 15 * M], [0, -1.0 * M], 3.2 * M);
    path(kit, 'pavers', [-14.5 * M, -0.5 * M], [14.5 * M, -0.5 * M], 2.6 * M);
    // --- Elefantengehege (hinten links)
    const EX = -9.0 * M, EZ = -8.0 * M;
    kit.box('sand', EX, 0.02 * M, EZ, 10.0 * M, 0.1 * M, 11.0 * M);
    kit.cyl('water_pool', EX + 2.8 * M, 0.05 * M, EZ + 2.4 * M, 2.4 * M, 0.12 * M, { seg: 14 });
    for (let k = 0; k < (detail === 0 ? 2 : 6); k++) kit.add('rock', flat(new THREE.IcosahedronGeometry((0.8 + (k % 3) * 0.5) * M, 0)), { x: EX - 4 * M + k * 1.3 * M, y: 0.3 * M, z: EZ - 3.6 * M + (k % 2) * 1.2 * M, sy: 0.7, ry: k });
    elephant(kit, EX - 1.5 * M, EZ + 0.6 * M, 0.7, 1.0);
    elephant(kit, EX + 1.6 * M, EZ - 2.0 * M, -2.2, 0.75);
    // Elefantenhaus mit Bogendach
    kit.box('brick_yellow', EX - 2.0 * M, 0, EZ - 4.6 * M, 7.0 * M, 4.6 * M, 3.0 * M);
    kit.add('roof_copper', new THREE.CylinderGeometry(1.6 * M, 1.6 * M, 7.4 * M, detail === 2 ? 12 : 6, 1, false, -Math.PI / 2, Math.PI), { x: EX - 2.0 * M, y: 4.6 * M, z: EZ - 4.6 * M, rx: -Math.PI / 2, ry: Math.PI / 2, sz: 0.7 });
    if (detail > 0) kit.box('wood_dark', EX - 2.0 * M, 0, EZ - 3.08 * M, 2.4 * M, 3.4 * M, 0.08 * M);
    tree(kit, EX - 4.6 * M, EZ + 3.4 * M, 1.0, 'round');
    fenceRun(kit, [[EX - 5 * M, EZ + 5.5 * M], [EX + 5 * M, EZ + 5.5 * M], [EX + 5 * M, EZ - 5.5 * M]]);
    // --- Savanne (hinten rechts): Giraffen und Zebras
    const SX = 9.0 * M, SZ = -8.0 * M;
    kit.box('grass_dry', SX, 0.02 * M, SZ, 10.0 * M, 0.1 * M, 11.0 * M);
    giraffe(kit, SX - 1.4 * M, SZ - 0.6 * M, 0.5, 1.0);
    giraffe(kit, SX + 2.2 * M, SZ + 1.6 * M, -0.9, 0.9);
    zebra(kit, SX + 0.8 * M, SZ + 3.4 * M, 1.8, 1.0);
    zebra(kit, SX - 2.4 * M, SZ + 3.0 * M, 1.2, 1.0);
    // Schirmakazien
    for (const [ax, az] of [[3.4, -2.6], [-3.6, 1.4]]) {
      kit.cyl('bark', SX + ax * M, 0, SZ + az * M, 0.2 * M, 3.6 * M, { seg: 5 });
      kit.add('leaves_dark', new THREE.SphereGeometry(1, 8, 4), { x: SX + ax * M, y: 4.0 * M, z: SZ + az * M, sx: 2.6 * M, sy: 0.6 * M, sz: 2.6 * M });
    }
    // Giraffenhaus (hoch)
    kit.box('wood_planks', SX + 3.6 * M, 0, SZ - 4.4 * M, 4.4 * M, 7.0 * M, 2.8 * M);
    kit.gableRoof('roof_tiles_brown', SX + 3.6 * M, 7.0 * M, SZ - 4.4 * M, 4.4 * M, 2.8 * M, 1.6 * M, { ridge: 'x', overhang: 0.4 * M });
    kit.gableEnds('wood_planks', SX + 3.6 * M, 7.0 * M, SZ - 4.4 * M, 4.4 * M, 2.8 * M, 1.6 * M, { ridge: 'x' });
    if (detail > 0) kit.box('wood_dark', SX + 3.6 * M, 0, SZ - 2.98 * M, 2.0 * M, 5.6 * M, 0.08 * M);
    fenceRun(kit, [[SX - 5 * M, SZ - 5.5 * M], [SX - 5 * M, SZ + 5.5 * M], [SX + 5 * M, SZ + 5.5 * M]]);
    // --- Pinguinbecken (vorn links)
    const PX = -8.4 * M, PZ = 7.4 * M;
    kit.box('concrete_panel', PX, 0, PZ, 10.6 * M, 0.6 * M, 8.0 * M);
    kit.box('water_pool', PX + 1.0 * M, 0.3 * M, PZ + 0.6 * M, 7.4 * M, 0.35 * M, 5.6 * M);
    for (let k = 0; k < (detail === 0 ? 1 : 4); k++) kit.add('marble', flat(new THREE.IcosahedronGeometry((0.9 + (k % 2) * 0.6) * M, 0)), { x: PX - 3.8 * M + (k % 2) * 1.2 * M, y: 0.8 * M, z: PZ - 2.4 * M + k * 1.4 * M, sy: 0.9, ry: k * 1.3 });
    for (let k = 0; k < (detail === 0 ? 2 : 9); k++) penguin(kit, PX - 4.4 * M + (k % 3) * 0.6 * M, PZ - 2.6 * M + Math.floor(k / 3) * 0.9 * M, k * 0.7, 1.0);
    if (detail > 0) {
      const g = [[PX - 5.3 * M, PZ + 4.0 * M], [PX + 5.3 * M, PZ + 4.0 * M], [PX + 5.3 * M, PZ - 4.0 * M]];
      glassRail(kit, g, 0.6 * M, 1.1 * M, { glass: 'glass_shop' });
    }
    // --- Voliere (vorn rechts): Netzkuppel mit Bäumen, davor Flamingoteich
    const VX = 8.6 * M, VZ = 6.2 * M;
    tree(kit, VX - 1.0 * M, VZ - 1.0 * M, 1.0, 'round');
    tree(kit, VX + 1.6 * M, VZ + 0.6 * M, 0.8, 'palm');
    // Netzkuppel als Gitter aus Meridianen und Ringen
    const nm = detail === 2 ? 12 : detail === 1 ? 8 : 4;
    for (let k = 0; k < nm; k++) kit.add('metal_dark', new THREE.TorusGeometry(4.4 * M, 0.05 * M, 3, detail === 0 ? 8 : 16, Math.PI), { x: VX, y: 0, z: VZ, ry: (k / nm) * Math.PI, sy: 1.15 });
    for (const t of detail === 0 ? [0.5] : [0.25, 0.5, 0.72, 0.9]) {
      const a = t * Math.PI / 2;
      kit.add('metal_dark', new THREE.TorusGeometry(4.4 * M * Math.cos(a), 0.05 * M, 3, detail === 2 ? 24 : 12), { x: VX, y: 4.4 * M * 1.15 * Math.sin(a), z: VZ, rx: Math.PI / 2 });
    }
    if (detail > 0) kit.box('chain_fence', VX, 0, VZ, 8.8 * M, 1.0 * M, 8.8 * M);
    if (detail === 2) for (let k = 0; k < 8; k++) { const a = k * 0.8; kit.sphere(k % 2 ? 'paint_red' : 'paint_yellow', VX + Math.cos(a) * 1.6 * M, (2.4 + (k % 3)) * M, VZ + Math.sin(a) * 1.6 * M, 0.14 * M, { seg: 4 }); }
    kit.cyl('water_pool', VX - 1.0 * M, 0.05 * M, 12.4 * M, 2.0 * M, 0.12 * M, { seg: 14, sx: 1.5 });
    for (let k = 0; k < (detail === 0 ? 2 : 6); k++) flamingo(kit, VX - 3.0 * M + k * 0.75 * M, 12.0 * M + (k % 2) * 0.7 * M, 1.4 + k * 0.4, 1.0);
    // --- Mitte: Affeninsel im Wassergraben
    kit.cyl('stone_grey', 0, 0, -8.0 * M, 3.0 * M, 0.2 * M, { seg: 18 });
    kit.cyl('water_pool', 0, 0.04 * M, -8.0 * M, 2.8 * M, 0.2 * M, { seg: 18 });
    kit.cyl('rock', 0, 0, -8.0 * M, 1.9 * M, 0.9 * M, { seg: 9, rTop: 1.4 * M });
    tree(kit, 0.3 * M, -8.2 * M, 0.8, 'round', { y0: 0.9 * M });
    if (detail > 0) { beam(kit, 'wood_dark', [-1.2 * M, 0.9 * M, -8.4 * M], [0.4 * M, 3.4 * M, -7.8 * M], 0.15 * M); kit.box('wood_planks', 0.9 * M, 2.2 * M, -7.4 * M, 1.0 * M, 0.1 * M, 1.0 * M); }
    // --- Eingang mit Kassen und Schild
    for (const s of [-1, 1]) {
      hut(kit, s * 4.0 * M, 12.6 * M, 0, 3.0 * M, 2.4 * M, 2.8 * M, { wall: 'wood_planks', roof: 'roof_tiles_brown', counter: true, awning: 'awning_green' });
      kit.box('wood_dark', s * 2.0 * M, 0, 14.0 * M, 0.5 * M, 4.6 * M, 0.5 * M);
    }
    kit.box('wood_dark', 0, 4.0 * M, 14.0 * M, 5.4 * M, 1.2 * M, 0.4 * M);
    text(kit, 'paint_yellow', 'ZOO', 0, 4.2 * M, 14.22 * M, 0, 0.8 * M, { depth: 0.08 * M });
    if (detail > 0) kit.prism('roof_tiles_brown', [[-3.2 * M, 0], [3.2 * M, 0], [0, 1.2 * M]], 1.2 * M, { x: 0, y: 5.2 * M, z: 14.0 * M });
    crowd(kit, 0, 7.0 * M, 2.6 * M, 13 * M, 10);
    crowd(kit, 0, -0.5 * M, 26 * M, 2.0 * M, 10);
    crowd(kit, -3.4 * M, 4.6 * M, 1.2 * M, 4.0 * M, 4);
    // Kiosk, Spielplatz, Bänke, Bäume, Laternen
    hut(kit, 4.4 * M, 2.2 * M, -Math.PI / 2, 2.6 * M, 2.0 * M, 2.6 * M, { wall: 'plaster_pink', roof: 'roof_tiles_red', counter: true, awning: 'awning_striped' });
    if (detail > 0) {
      for (const [x, z] of [[-3.4, 3.0], [3.4, 6.0], [-3.4, 9.0], [3.4, 10.4], [-13.8, 13.8], [13.8, 13.8], [-13.6, 2.6], [13.6, 2.6], [-3.0, -12.8], [3.0, -13.6]]) tree(kit, x * M, z * M, 0.75, kit.rng() < 0.3 ? 'conifer' : 'round');
      for (const [x, z, r] of [[-2.4, 5.0, Math.PI / 2], [2.4, 8.0, -Math.PI / 2], [-6.0, 1.6, Math.PI], [6.4, -2.6, 0]]) bench(kit, x * M, z * M, r);
      for (const [x, z] of [[-2.0, 1.4], [2.0, -2.4], [-2.0, 11.0]]) lamp(kit, x * M, z * M, 3.6 * M, { style: 'old' });
      flag(kit, -3.0 * M, 14.4 * M, 6.0 * M, 'paint_green');
      flag(kit, 3.0 * M, 14.4 * M, 6.0 * M, 'paint_yellow');
    }
    return kit.build();
  },
});
void beam; void lathe;
