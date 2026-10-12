// Messegelände (3 × 3): zwei große Hallen mit Tonnendächern, gläserne Eingangshalle mit runder Dachscheibe,
// Messeturm mit Pyramidenspitze, Fahnenallee und Vorplatz. Besitzer: G6.
import * as THREE from 'three';
import { registerArch } from './index.js';
import { M } from './kit.js';
import { beam, lamp, bench, tree, flag, face, path, glassRail } from './lm_parts.js';
import { text } from './lm_text.js';

// Messehalle mit Tonnendach (First entlang z), Glasband und Hallennummer an der Front
function hall(kit, x, z, w, d, h, num) {
  const det = kit.detail;
  kit.box('concrete_dark', x, 0, z, w + 0.2 * M, 0.6 * M, d + 0.2 * M);
  kit.box('metal_panel_grey', x, 0.6 * M, z, w, h - 0.6 * M, d);
  // Fensterband und Lisenen
  for (const sd of ['left', 'right', 'back']) kit.curtainWall(sd, x, z, w, d, h * 0.62, h * 0.24, { glass: 'glass_curtain_blue', frame: 'metal_dark', fh: h * 0.24, colW: 2.4 * M });
  if (det > 0) {
    for (const s of [-1, 1]) for (let k = 0; k <= Math.round(d / (3.2 * M)); k++) {
      const zz = z - d / 2 + (k * d) / Math.round(d / (3.2 * M));
      kit.box('metal_panel_white', x + s * (w / 2 + 0.15 * M), 0.6 * M, zz, 0.3 * M, h - 0.6 * M, 0.5 * M);
    }
  }
  // Tonnendach
  const R = w / 2 + 0.4 * M, rise = 3.4 * M;
  const geo = new THREE.CylinderGeometry(R, R, d + 0.8 * M, det === 2 ? 16 : det === 1 ? 10 : 6, 1, false, -Math.PI / 2, Math.PI);
  kit.add('roof_metal_grey', geo, { x, y: h, z, rx: -Math.PI / 2, sz: rise / R });
  if (det > 0) {
    // Dachrippen
    for (let k = 0; k <= 5; k++) {
      const zz = z - d / 2 + (k * d) / 5;
      kit.add('metal_panel_white', new THREE.TorusGeometry(R + 0.05 * M, 0.12 * M, 3, 12, Math.PI), { x, y: h, z: zz, sy: rise / R });
    }
    // Oberlicht-Firstband
    kit.box('glass_curtain_blue', x, h + rise - 0.05 * M, z, 1.6 * M, 0.2 * M, d * 0.9, { lit: 0.6 });
  }
  // Glasgiebel an der Front mit Hallennummer
  const f = face(x, z + d / 2, 0);
  const [gx, gz] = f.at(0, 0.03 * M);
  kit.box('glass_curtain_blue', gx, 0.6 * M, gz, w - 1.0 * M, h - 1.2 * M, 0.08 * M, { lit: 0.85 });
  const pts = [];
  for (let k = 0; k <= 10; k++) { const a = (k / 10) * Math.PI; pts.push([Math.cos(a) * R, Math.sin(a) * rise]); }
  const shp = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));
  kit.add('metal_panel_white', new THREE.ShapeGeometry(shp, 2), { x: gx, y: h, z: gz + 0.02 * M });
  if (det > 0) {
    for (let k = 0; k <= 6; k++) kit.box('metal_dark', gx - (w - 1.0 * M) / 2 + (k * (w - 1.0 * M)) / 6, 0.6 * M, gz + 0.06 * M, 0.12 * M, h - 1.2 * M, 0.1 * M);
    kit.box('metal_panel_white', gx, h - 1.6 * M, gz + 0.1 * M, w, 1.0 * M, 0.2 * M);
    text(kit, 'paint_blue', 'HALLE ' + num, gx, h - 1.45 * M, gz + 0.22 * M, 0, 0.6 * M, { depth: 0.05 * M });
    kit.box('metal_dark', gx, 0.6 * M, gz + 0.3 * M, 4.0 * M, 3.2 * M, 0.6 * M);
    kit.box('neon_cyan', gx, 3.8 * M, gz + 0.62 * M, 4.2 * M, 0.12 * M, 0.08 * M);
  }
}

registerArch('fairground', {
  variants: 1,
  build(ctx) {
    const { kit, detail } = ctx;
    kit.box('pavers', 0, 0, 0, 29.8 * M, 0.08 * M, 29.8 * M);
    // Hallen
    hall(kit, -9.0 * M, -4.6 * M, 11.0 * M, 19.0 * M, 9.0 * M, '1');
    hall(kit, 9.0 * M, -4.6 * M, 11.0 * M, 19.0 * M, 9.0 * M, '2');
    // Verbindungsgänge
    for (const s of [-1, 1]) {
      kit.box('glass_curtain_blue', s * 3.2 * M, 0.3 * M, 2.0 * M, 1.4 * M, 3.6 * M, 3.0 * M, { lit: 0.8 });
      kit.box('metal_panel_white', s * 3.2 * M, 3.9 * M, 2.0 * M, 1.6 * M, 0.3 * M, 3.2 * M);
    }
    // Eingangshalle (Glaszylinder) mit großer Dachscheibe auf Stützen
    const EZ = 3.6 * M;
    kit.cyl('stone_dark', 0, 0, EZ, 4.4 * M, 0.3 * M, { seg: 24 });
    kit.cyl('glass_curtain_blue', 0, 0.3 * M, EZ, 3.8 * M, 8.6 * M, { seg: detail === 2 ? 24 : 14, lit: 0.95 });
    if (detail > 0) {
      for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; kit.box('metal_dark', Math.sin(a) * 3.82 * M, 0.3 * M, EZ + Math.cos(a) * 3.82 * M, 0.12 * M, 8.6 * M, 0.12 * M, { ry: a }); }
      for (const y of [3.1, 6.0]) kit.cyl('metal_dark', 0, y * M, EZ, 3.86 * M, 0.15 * M, { seg: detail === 2 ? 24 : 14 });
    }
    const CZ = EZ + 4.0 * M, CR = 5.4 * M;
    kit.cyl('metal_panel_white', 0, 8.9 * M, CZ, CR, 0.7 * M, { seg: detail === 2 ? 32 : 16 });
    kit.cyl('neon_cyan', 0, 8.85 * M, CZ, CR + 0.05 * M, 0.12 * M, { seg: detail === 2 ? 32 : 16, open: true });
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + 0.3 + (k / 4) * (Math.PI - 0.6);
      kit.cyl('metal_light', Math.sin(a) * (CR - 0.8 * M), 0, CZ + Math.cos(a) * (CR - 0.8 * M), 0.2 * M, 8.9 * M, { seg: 8, rTop: 0.12 * M });
    }
    kit.box('metal_panel_white', 0, 9.6 * M, CZ + CR - 0.2 * M, 5.2 * M, 1.1 * M, 0.3 * M);
    text(kit, 'metal_dark', 'MESSE', 0, 9.72 * M, CZ + CR - 0.02 * M, 0, 0.8 * M, { depth: 0.1 * M, weight: 1.1 });
    // Messeturm mit Pyramidenspitze
    const TX = 0, TZ = -10.6 * M, TW = 5.6 * M, TH = 34 * M;
    kit.box('stone_dark', TX, 0, TZ, TW + 0.6 * M, 1.0 * M, TW + 0.6 * M);
    kit.box(detail === 0 ? 'glass_curtain_blue' : 'concrete_dark', TX, 1.0 * M, TZ, TW, TH, TW, { lit: kit.rng() });
    if (detail > 0) {
      for (const sd of ['front', 'back', 'left', 'right']) kit.curtainWall(sd, TX, TZ, TW, TW, 1.0 * M, TH, { glass: 'glass_curtain_blue', frame: 'metal_panel_white', fh: 3.4 * M, colW: 1.4 * M });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.box('stone_sandstone', TX + sx * TW / 2, 1.0 * M, TZ + sz * TW / 2, 0.8 * M, TH, 0.8 * M);
    }
    kit.box('stone_sandstone', TX, TH + 1.0 * M, TZ, TW + 0.4 * M, 0.8 * M, TW + 0.4 * M);
    kit.cone('glass_curtain_blue', TX, TH + 1.8 * M, TZ, (TW / 2) * Math.SQRT2, 6.5 * M, { seg: 4, ry: Math.PI / 4, lit: 0.9 });
    kit.cyl('metal_light', TX, TH + 8.0 * M, TZ, 0.12 * M, 3.0 * M, { seg: 4 });
    kit.sphere('neon_cyan', TX, TH + 11.1 * M, TZ, 0.25 * M, { seg: 6 });
    kit.light(TX, TH + 11.1 * M, TZ, 0x3fe8ff, 0.5);
    // Vorplatz: Fahnenallee, Wasserspiel, Bäume, Laternen, Bänke
    path(kit, 'stone_grey', [0, 15 * M], [0, 9 * M], 5.0 * M);
    if (detail > 0) {
      const FLAGS = ['paint_red', 'paint_blue', 'paint_yellow', 'paint_green', 'paint_white', 'paint_orange'];
      for (let k = 0; k < 6; k++) for (const s of [-1, 1]) flag(kit, s * (4.2 + k * 1.7) * M, 13.6 * M, 7.0 * M, FLAGS[(k + (s > 0 ? 3 : 0)) % 6]);
      kit.box('stone_grey', -9.0 * M, 0, 9.6 * M, 8.0 * M, 0.35 * M, 3.0 * M);
      kit.box('water_pool', -9.0 * M, 0.2 * M, 9.6 * M, 7.4 * M, 0.2 * M, 2.4 * M);
      if (detail === 2) for (let k = 0; k < 6; k++) kit.cyl('water_pool', (-11.8 + k * 1.1) * M, 0.35 * M, 9.6 * M, 0.08 * M, 1.4 * M, { seg: 4, rTop: 0.02 * M });
      for (const [x, z] of [[8.6, 10.6], [12.6, 10.6], [-13.8, 13.8], [13.8, 13.8]]) tree(kit, x * M, z * M, 0.8, 'round');
      for (const [x, z] of [[-6.0, 11.8], [6.0, 11.8], [-14, 6.4], [14, 6.4]]) lamp(kit, x * M, z * M, 5.0 * M, { head: 'neon_cyan', color: 0xbfefff });
      for (const x of [9.0, 12.0]) bench(kit, x * M, 8.6 * M, Math.PI);
      // Zufahrt / Taxistand an der Seite
      for (let k = 0; k < 5; k++) kit.box('paint_white', 13.4 * M, 0.08 * M, (-12 + k * 2.6) * M, 2.0 * M, 0.02 * M, 0.12 * M);
    }
    void beam; void glassRail;
    return kit.build();
  },
});
