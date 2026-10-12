// Schloss (3 × 3): barocke Dreiflügelanlage mit Mittelrisalit, Kuppel, Mansarddächern,
// Ehrenhof, Broderie-Parterre, großem Brunnen und schmiedeeisernem Tor. Besitzer: G6.
import * as THREE from 'three';
import { registerArch } from './index.js';
import { M } from './kit.js';
import { obox, beam, lathe, archWindow, pediment, column, fountain, tree, lamp, bench, face, torus, path, crowd } from './lm_parts.js';

const WALL = 'plaster_yellow', TRIM = 'plaster_white', ROOF = 'roof_slate', CU = 'roof_copper', GOLD = 'paint_yellow';

// Mansarddach: steiler Unterteil (Kegelstumpf) + flaches Walmdach
export function mansard(kit, mat, x, y0, z, sx, sz, h1, h2, inset = 1.0 * M) {
  const ov = 0.25 * M;
  const a = sx / 2 + ov, b = sz / 2 + ov;
  const k1 = Math.min(0.9, inset / Math.min(a, b));
  kit.hipRoof(mat, x, y0, z, sx, sz, h1, { overhang: ov, ridgeK: k1 });
  const r1 = Math.min(a, b) * k1;
  kit.hipRoof(mat, x, y0 + h1, z, 2 * (a - r1), 2 * (b - r1), h2, { overhang: 0, ridgeK: 0.95 });
}

// Balustrade entlang einer Strecke
function balustrade(kit, a, b, y0, h = 0.9 * M) {
  if (kit.detail === 0) return;
  beam(kit, TRIM, [a[0], y0 + h - 0.08 * M, a[1]], [b[0], y0 + h - 0.08 * M, b[1]], 0.3 * M, 0.16 * M);
  beam(kit, TRIM, [a[0], y0 + 0.08 * M, a[1]], [b[0], y0 + 0.08 * M, b[1]], 0.3 * M, 0.16 * M);
  if (kit.detail < 2) { beam(kit, TRIM, [a[0], y0 + h / 2, a[1]], [b[0], y0 + h / 2, b[1]], 0.12 * M, h * 0.6); return; }
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(2, Math.round(len / (0.45 * M)));
  for (let k = 0; k <= n; k++) {
    const t = k / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
    if (k % 8 === 0) kit.box(TRIM, x, y0, z, 0.32 * M, h, 0.32 * M);
    else lathe(kit, TRIM, x, y0 + 0.16 * M, z, [[0.07 * M, 0], [0.12 * M, 0.12 * M], [0.06 * M, 0.35 * M], [0.08 * M, h - 0.36 * M]], 5);
  }
}

// Baukörper mit Sockel, Geschossen, Fenstern, Lisenen und Gesims
function block(kit, cx, cz, sx, sz, floors, o = {}) {
  const H = floors.reduce((s, f) => s + f, 0);
  kit.box(WALL, cx, 0, cz, sx, H, sz);
  kit.box('stone_sandstone', cx, 0, cz, sx + 0.2 * M, floors[0], sz + 0.2 * M);
  if (kit.detail === 2) {
    // Rustika-Fugen im Erdgeschoss
    for (let y = 0.9 * M; y < floors[0] - 0.3 * M; y += 0.75 * M) kit.box('stone_dark', cx, y, cz, sx + 0.24 * M, 0.06 * M, sz + 0.24 * M);
  }
  kit.band(TRIM, cx, cz, sx, sz, floors[0] - 0.2 * M, 0.35 * M, 0.18 * M);
  kit.band(TRIM, cx, cz, sx, sz, H - 0.55 * M, 0.55 * M, 0.3 * M);
  let y = 0;
  const sidesWanted = o.sides || ['front', 'back', 'left', 'right'];
  floors.forEach((fh, i) => {
    for (const side of sidesWanted) {
      const sp = o.spacing ?? 2.6 * M;
      if (i === 0 && kit.detail > 0 && o.archGround !== false) {
        // Rundbogenfenster im Erdgeschoss
        const along = side === 'front' || side === 'back' ? sx : sz;
        const n = Math.max(1, Math.floor((along - 1.2 * M) / sp));
        for (let k = 0; k < n; k++) {
          const u = -((n - 1) * sp) / 2 + k * sp;
          if (o.skipU && side === 'front' && o.skipU(u)) continue;
          let x, z, ry;
          if (side === 'front') { x = cx + u; z = cz + sz / 2; ry = 0; } else if (side === 'back') { x = cx - u; z = cz - sz / 2; ry = Math.PI; }
          else if (side === 'right') { x = cx + sx / 2; z = cz - u; ry = Math.PI / 2; } else { x = cx - sx / 2; z = cz + u; ry = -Math.PI / 2; }
          [x, z] = face(x, z, ry).at(0, 0.1 * M);
          archWindow(kit, x, 0.9 * M, z, ry, 1.2 * M, fh - 1.6 * M, { kind: 'round', frame: TRIM, glass: 'glass_window', mullions: 1, key: true, t: 0.18 * M });
        }
      } else {
        kit.windows(side, cx, cz, sx, sz, y, 1, fh, { winW: 1.25 * M, winH: fh * (i === 1 ? 0.62 : 0.5), spacing: sp, margin: 0.6 * M, frame: 'window_frame_white', sill: TRIM, mullion: true });
        // Fensterverdachungen im Hauptgeschoss
        if (i === 1 && kit.detail === 2) {
          const along = side === 'front' || side === 'back' ? sx : sz;
          const n = Math.max(1, Math.floor((along - 1.6 * M + sp - 1.25 * M) / sp));
          for (let k = 0; k < n; k++) {
            const u = -((n - 1) * sp) / 2 + k * sp;
            let x, z, ry;
            if (side === 'front') { x = cx + u; z = cz + sz / 2; ry = 0; } else if (side === 'back') { x = cx - u; z = cz - sz / 2; ry = Math.PI; }
            else if (side === 'right') { x = cx + sx / 2; z = cz - u; ry = Math.PI / 2; } else { x = cx - sx / 2; z = cz + u; ry = -Math.PI / 2; }
            const yy = y + (fh - fh * 0.62) * 0.55 + fh * 0.62 + 0.2 * M;
            if (k % 2 === 0) pediment(kit, TRIM, x, yy, z, ry, 1.7 * M, 0.5 * M, 0.25 * M);
            else { const [px, pz] = face(x, z, ry).at(0, 0.1 * M); kit.box(TRIM, px, yy, pz, 1.7 * M, 0.18 * M, 0.25 * M, { ry }); }
          }
        }
      }
    }
    y += fh;
  });
  // Lisenen an den Ecken
  if (kit.detail > 0) for (const ax of [-1, 1]) for (const az of [-1, 1]) kit.box(TRIM, cx + ax * (sx / 2 - 0.25 * M), floors[0], cz + az * (sz / 2 - 0.25 * M), 0.62 * M, H - floors[0] - 0.5 * M, 0.62 * M);
  return H;
}

function statue(kit, x, z, s = 1) {
  if (kit.detail === 0) return;
  kit.box('stone_grey', x, 0, z, 0.9 * M * s, 1.4 * M * s, 0.9 * M * s);
  kit.box(TRIM, x, 1.4 * M * s, z, 1.05 * M * s, 0.15 * M * s, 1.05 * M * s);
  if (kit.detail < 2) return;
  lathe(kit, 'stone_grey', x, 1.55 * M * s, z, [[0.32 * M, 0], [0.28 * M, 0.6 * M], [0.22 * M, 1.1 * M], [0.25 * M, 1.4 * M], [0.12 * M, 1.5 * M]].map(([r, h]) => [r * s, h * s]), 6);
  kit.sphere('stone_grey', x, 1.55 * M * s + 1.68 * M * s, z, 0.17 * M * s, { seg: 6 });
  beam(kit, 'stone_grey', [x, 2.6 * M * s, z], [x + 0.45 * M * s, 3.3 * M * s, z + 0.1 * M * s], 0.1 * M * s);
}

function vase(kit, x, y0, z) {
  if (kit.detail < 2) return;
  lathe(kit, TRIM, x, y0, z, [[0.18 * M, 0], [0.1 * M, 0.15 * M], [0.32 * M, 0.45 * M], [0.22 * M, 0.75 * M], [0.28 * M, 0.85 * M]], 8);
}

registerArch('castle', {
  variants: 1,
  build(ctx) {
    const { kit, detail } = ctx;
    const G = 4.2 * M, P = 4.8 * M, O = 3.4 * M;
    const MZ = -9.2 * M, MD = 8.6 * M, MW = 17.6 * M; // Hauptflügel
    // --- Grund: Kies, Rasen
    kit.box('gravel', 0, 0, 0, 29.8 * M, 0.06 * M, 29.8 * M);
    // --- Hauptflügel und Eckpavillons
    const H = block(kit, 0, MZ, MW, MD, [G, P, O], { skipU: (u) => Math.abs(u) < 3.8 * M });
    balustrade(kit, [-MW / 2, MZ + MD / 2 + 0.05 * M], [MW / 2, MZ + MD / 2 + 0.05 * M], H);
    mansard(kit, ROOF, 0, H, MZ, MW - 0.8 * M, MD - 0.8 * M, 2.8 * M, 1.4 * M, 1.0 * M);
    for (const s of [-1, 1]) {
      const px = s * 11.6 * M, pz = MZ + 0.5 * M;
      const HP = block(kit, px, pz, 5.6 * M, MD + 1.4 * M, [G, P, O + 0.6 * M], { spacing: 2.4 * M });
      mansard(kit, CU, px, HP, pz, 5.2 * M, MD + 1.0 * M, 3.4 * M, 1.6 * M, 1.0 * M);
      if (detail > 0) { kit.sphere(GOLD, px, HP + 5.1 * M, pz, 0.3 * M, { seg: 6 }); kit.cyl(GOLD, px, HP + 4.9 * M, pz, 0.05 * M, 0.9 * M, { seg: 4 }); }
      // Seitenflügel nach vorn zum Ehrenhof
      const wz0 = MZ + MD / 2 + 0.7 * M, wz1 = 1.6 * M;
      const wx = s * 11.2 * M;
      const HW = block(kit, wx, (wz0 + wz1) / 2, 4.6 * M, wz1 - wz0, [G, P], { sides: ['left', 'right', 'front'], spacing: 2.5 * M });
      mansard(kit, ROOF, wx, HW, (wz0 + wz1) / 2, 4.2 * M, wz1 - wz0 - 0.4 * M, 2.2 * M, 1.0 * M, 0.9 * M);
      balustrade(kit, [wx - s * 2.3 * M, wz0], [wx - s * 2.3 * M, wz1], HW);
      // Schornsteine
      if (detail > 0) for (const zz of [MZ - 1.6 * M, MZ + 1.6 * M]) kit.chimney(s * 5.5 * M, H + 2.0 * M, zz, 2.2 * M, 'plaster_cream');
    }
    // --- Mittelrisalit mit Säulenportikus, Dreiecksgiebel und Kuppel
    const RW = 7.6 * M, RZ = MZ + MD / 2 + 0.7 * M;
    kit.box(WALL, 0, 0, RZ - 0.7 * M, RW, H + 0.6 * M, 1.6 * M);
    kit.box('stone_sandstone', 0, 0, RZ - 0.7 * M, RW + 0.2 * M, G, 1.8 * M);
    kit.band(TRIM, 0, RZ - 0.7 * M, RW, 1.6 * M, H, 0.6 * M, 0.3 * M);
    // Vorbau mit Arkaden im Erdgeschoss (trägt Balkon und Säulen)
    kit.box('stone_sandstone', 0, 0, RZ + 0.8 * M, RW + 0.4 * M, G - 0.1 * M, 1.6 * M);
    for (const u of [-2.4 * M, 0, 2.4 * M]) archWindow(kit, u, 0, RZ + 1.62 * M, 0, 1.8 * M, G - 0.5 * M, { kind: 'round', frame: TRIM, glass: 'glass_window', mullions: 0, sill: false, key: true, t: 0.25 * M, lit: 0.9 });
    kit.box('stone_grey', 0, 0, RZ + 2.2 * M, 6.0 * M, 0.3 * M, 1.2 * M);
    kit.box('stone_grey', 0, 0, RZ + 2.9 * M, 5.0 * M, 0.15 * M, 0.6 * M);
    balustrade(kit, [-3.8 * M, RZ + 1.5 * M], [3.8 * M, RZ + 1.5 * M], G - 0.1 * M, 0.85 * M);
    // Kolossalsäulen über zwei Geschosse
    for (const u of [-3.3, -1.2, 1.2, 3.3]) column(kit, TRIM, u * M, G - 0.1 * M, RZ + 0.75 * M, 0.38 * M, P + O - 0.1 * M, { base: TRIM });
    kit.box(TRIM, 0, G - 0.1 * M, RZ + 0.75 * M, RW + 0.4 * M, 0.3 * M, 1.4 * M);
    kit.box(TRIM, 0, H - 0.4 * M, RZ + 0.75 * M, RW + 0.6 * M, 1.0 * M, 1.5 * M);
    pediment(kit, TRIM, 0, H + 0.6 * M, RZ + 1.0 * M, 0, RW + 0.5 * M, 2.6 * M, 1.2 * M);
    if (detail > 0) {
      kit.window(0, G + 0.9 * M, RZ + 0.12 * M, 0, 1.5 * M, 3.0 * M, { frame: 'window_frame_white' });
      for (const u of [-2.25 * M, 2.25 * M]) kit.window(u, G + 1.0 * M, RZ + 0.12 * M, 0, 1.2 * M, 2.6 * M, { frame: 'window_frame_white' });
      for (const u of [-2.25 * M, 0, 2.25 * M]) kit.window(u, G + P + 0.7 * M, RZ + 0.12 * M, 0, 1.1 * M, 1.7 * M, { frame: 'window_frame_white' });
      // Wappen im Giebelfeld
      kit.cyl(GOLD, 0, H + 1.4 * M, RZ + 1.55 * M, 0.6 * M, 0.1 * M, { rx: Math.PI / 2, seg: 10 });
      for (const s of [-1, 0, 1]) vase(kit, s * (RW / 2) * (s ? 1 : 0), H + 0.6 * M + (s ? 0 : 2.6 * M), RZ + 1.0 * M);
    }
    // Tambour und Kuppel
    const DY = H + 1.0 * M, DZ = MZ;
    kit.cyl(WALL, 0, H, DZ, 2.9 * M, 1.0 * M + 2.8 * M, { seg: 16 });
    kit.cyl(TRIM, 0, DY + 2.6 * M, DZ, 3.15 * M, 0.45 * M, { seg: 16 });
    if (detail > 0) for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      archWindow(kit, Math.sin(a) * 2.9 * M, DY + 0.4 * M, DZ + Math.cos(a) * 2.9 * M, a, 0.8 * M, 1.8 * M, { kind: 'round', frame: TRIM, mullions: 0, sill: false });
      kit.box(TRIM, Math.sin(a + Math.PI / 8) * 2.95 * M, H, DZ + Math.cos(a + Math.PI / 8) * 2.95 * M, 0.35 * M, 3.0 * M, 0.35 * M, { ry: a });
    }
    lathe(kit, CU, 0, DY + 3.0 * M, DZ, [[3.05 * M, 0], [3.0 * M, 0.6 * M], [2.7 * M, 1.6 * M], [2.0 * M, 2.6 * M], [1.0 * M, 3.3 * M], [0.5 * M, 3.5 * M]], detail === 2 ? 20 : 10);
    if (detail > 0) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        lathe(kit, GOLD, 0, DY + 3.0 * M, DZ, [[3.08 * M, 0], [3.03 * M, 0.6 * M], [2.73 * M, 1.6 * M], [2.03 * M, 2.6 * M], [1.03 * M, 3.3 * M]], 1, { phiStart: a, phiLength: 0.04 });
      }
      // Laterne
      kit.cyl(WALL, 0, DY + 6.4 * M, DZ, 0.6 * M, 1.4 * M, { seg: 8 });
      kit.cone(CU, 0, DY + 7.8 * M, DZ, 0.8 * M, 1.2 * M, { seg: 8 });
      kit.cyl(GOLD, 0, DY + 8.9 * M, DZ, 0.05 * M, 1.0 * M, { seg: 4 });
      kit.sphere(GOLD, 0, DY + 9.3 * M, DZ, 0.22 * M, { seg: 6 });
      flagPoleOnDome(kit, DY);
    }
    // --- Ehrenhof und Garten
    const CZ0 = RZ + 2.2 * M;
    void CZ0;
    kit.box('pavers', 0, 0, -1.0 * M, 17.6 * M, 0.08 * M, 6.6 * M);
    // Parterre-Beete um den Brunnen
    const FZ = 7.6 * M;
    path(kit, 'gravel', [0, 2 * M], [0, 14.6 * M], 3.0 * M, 0.09 * M);
    path(kit, 'gravel', [-10 * M, FZ], [10 * M, FZ], 2.2 * M, 0.09 * M);
    for (const sx of [-1, 1]) for (const [z0, z1] of [[2.4 * M, FZ - 1.3 * M], [FZ + 1.3 * M, 13.2 * M]]) {
      const x0 = sx * 3.0 * M, x1 = sx * 9.4 * M, bx = (x0 + x1) / 2, bz = (z0 + z1) / 2, bw = Math.abs(x1 - x0), bd = z1 - z0;
      kit.box('grass', bx, 0, bz, bw, 0.1 * M, bd);
      // Heckenrahmen
      for (const [hx, hz, hw, hd] of [[bx, z0 + 0.2 * M, bw, 0.4 * M], [bx, z1 - 0.2 * M, bw, 0.4 * M], [x0 + sx * 0.2 * M, bz, 0.4 * M, bd], [x1 - sx * 0.2 * M, bz, 0.4 * M, bd]]) kit.box('hedge', hx, 0.1 * M, hz, hw, 0.55 * M, hd);
      if (detail > 0) {
        // Broderie: Heckenring, Diagonalen, Blumenbeete
        torus(kit, 'hedge', bx, 0.32 * M, bz, Math.min(bw, bd) * 0.3, 0.22 * M, { rx: Math.PI / 2, tubular: detail === 2 ? 20 : 10, radial: 4 });
        kit.cyl(sx > 0 ? 'awning_red' : 'field_rapeseed', bx, 0.1 * M, bz, Math.min(bw, bd) * 0.18, 0.2 * M, { seg: 10 });
        for (const d of [-1, 1]) obox(kit, 'hedge', bx, 0.32 * M, bz, Math.hypot(bw, bd) * 0.62, 0.4 * M, 0.3 * M, { ry: d * Math.atan2(bd, bw) });
        for (const [cx, cz] of [[x0 + sx * 0.6 * M, z0 + 0.6 * M], [x1 - sx * 0.6 * M, z0 + 0.6 * M], [x0 + sx * 0.6 * M, z1 - 0.6 * M], [x1 - sx * 0.6 * M, z1 - 0.6 * M]]) tree(kit, cx, cz, 0.9, 'cone');
      }
    }
    // Großer Brunnen mit Figur
    kit.cyl('stone_sandstone', 0, 0, FZ, 2.7 * M, 0.6 * M, { seg: detail === 2 ? 28 : 14 });
    kit.cyl('water_pool', 0, 0.45 * M, FZ, 2.4 * M, 0.1 * M, { seg: detail === 2 ? 28 : 14 });
    fountain(kit, 0, FZ, 1.4 * M, { jet: 2.6 * M });
    if (detail === 2) for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      kit.cyl('water_pool', Math.cos(a) * 1.8 * M, 0.5 * M, FZ + Math.sin(a) * 1.8 * M, 0.06 * M, 0.9 * M, { seg: 4, rTop: 0.02 * M, rz: Math.cos(a) * 0.5, rx: -Math.sin(a) * 0.5 });
    }
    // Statuen, Laternen und Bänke
    for (const s of [-1, 1]) {
      statue(kit, s * 4.4 * M, FZ);
      statue(kit, s * 8.4 * M, FZ);
      lamp(kit, s * 2.0 * M, 13.6 * M, 3.8 * M, { style: 'old' });
      lamp(kit, s * 2.0 * M, 3.0 * M, 3.8 * M, { style: 'old' });
      bench(kit, s * 6.4 * M, FZ - 0.75 * M, 0);
      bench(kit, s * 6.4 * M, FZ + 0.75 * M, Math.PI);
      // Baumreihen an den Rändern
      for (let z = 3.0 * M; z <= 13.5 * M; z += 2.6 * M) tree(kit, s * 13.8 * M, z, 0.8, 'topiary', { leaf: 'leaves_dark' });
    }
    crowd(kit, 0, 11.0 * M, 2.4 * M, 6.0 * M, 7);
    crowd(kit, -6.6 * M, FZ, 5.0 * M, 1.2 * M, 4);
    crowd(kit, 6.6 * M, FZ, 5.0 * M, 1.2 * M, 4);
    crowd(kit, 0, -0.6 * M, 10.0 * M, 3.0 * M, 6);
    // --- Tor und Zaun zur Straße
    const GZ = 14.6 * M;
    for (const x of [-14.6, -9, -3.4, 3.4, 9, 14.6]) {
      kit.box('stone_sandstone', x * M, 0, GZ, 0.9 * M, 2.6 * M, 0.9 * M);
      kit.box(TRIM, x * M, 2.6 * M, GZ, 1.05 * M, 0.2 * M, 1.05 * M);
      if (Math.abs(x) === 3.4) { vase(kit, x * M, 2.8 * M, GZ); kit.sphere(GOLD, x * M, 3.8 * M, GZ, 0.2 * M, { seg: 6 }); }
    }
    if (detail > 0) {
      for (const [a, b] of [[-14.2, -9.4], [-8.6, -3.8], [3.8, 8.6], [9.4, 14.2]]) {
        beam(kit, 'metal_dark', [a * M, 2.0 * M, GZ], [b * M, 2.0 * M, GZ], 0.08 * M);
        beam(kit, 'metal_dark', [a * M, 0.3 * M, GZ], [b * M, 0.3 * M, GZ], 0.08 * M);
        if (detail === 2) for (let x = a; x <= b; x += 0.35) { kit.box('metal_dark', x * M, 0, GZ, 0.04 * M, 2.2 * M, 0.04 * M); kit.cone(GOLD, x * M, 2.2 * M, GZ, 0.06 * M, 0.2 * M, { seg: 4 }); }
      }
      // Tor (zwei Flügel, halb geöffnet) mit goldenem Bogen
      for (const s of [-1, 1]) {
        const hx = s * 3.0 * M;
        const ex = hx - s * 1.4 * M * Math.cos(0.9), ez = GZ - 1.4 * M * Math.sin(0.9);
        beam(kit, 'metal_dark', [hx, 2.6 * M, GZ], [ex, 2.6 * M, ez], 0.08 * M);
        beam(kit, 'metal_dark', [hx, 0.3 * M, GZ], [ex, 0.3 * M, ez], 0.08 * M);
        if (detail === 2) for (let t = 0.1; t < 1; t += 0.14) kit.box('metal_dark', hx + (ex - hx) * t, 0.3 * M, GZ + (ez - GZ) * t, 0.04 * M, 2.4 * M, 0.04 * M);
      }
      kit.add(GOLD, new THREE.TorusGeometry(3.0 * M, 0.08 * M, 4, 16, Math.PI), { x: 0, y: 2.6 * M, z: GZ, sy: 0.4 });
      kit.cyl(GOLD, 0, 3.3 * M, GZ, 0.35 * M, 0.08 * M, { rx: Math.PI / 2, seg: 10 });
    }
    return kit.build();

    function flagPoleOnDome(k, dy) {
      if (k.detail < 2) return;
      k.box('paint_red', 0.6 * M, dy + 9.7 * M, DZ, 1.2 * M, 0.6 * M, 0.03 * M);
      k.cyl('metal_light', 0, dy + 9.4 * M, DZ, 0.03 * M, 1.0 * M, { seg: 4 });
    }
  },
});
