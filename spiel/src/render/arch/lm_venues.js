// Veranstaltungsorte: Stadion (3 × 3) und Mehrzweckhalle (2 × 2). Besitzer: G6.
import * as THREE from 'three';
import { registerArch } from './index.js';
import { M } from './kit.js';
import { beam, torus, lamp, bench, tree, flag, hut, face, flat, glassRail, path, person, crowd } from './lm_parts.js';
import { text } from './lm_text.js';

// Elliptischer Drehkörper: pts = [[r (0..1), y], …]; Halbachsen ax (x) und az (z)
function ellLathe(kit, mat, pts, ax, az, seg, o = {}) {
  const geo = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)), seg, o.phiStart || 0, o.phiLength || Math.PI * 2);
  return kit.add(mat, o.flat ? flat(geo) : geo, { x: o.x || 0, y: o.y || 0, z: o.z || 0, sx: ax, sz: az, lit: o.lit });
}
// Stufenprofil (Tribüne) von innen unten nach außen oben; Reihenfolge so, dass die Flächen nach oben/innen zeigen
function stepProfile(r0, y0, r1, y1, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const r = r0 + ((r1 - r0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
    if (i > 0) pts.push([r, y - (y1 - y0) / n]);
    pts.push([r, y]);
  }
  return pts.reverse();
}

registerArch('stadium', {
  variants: 1,
  build(ctx) {
    const { kit, detail } = ctx;
    const AX = 13.6 * M, AZ = 12.4 * M; // äußere Halbachsen
    const seg = detail === 2 ? 56 : detail === 1 ? 32 : 18;
    // --- Vorplatz
    kit.box('pavers', 0, 0, 0, 29.8 * M, 0.08 * M, 29.8 * M);
    kit.box('stone_grey', 0, 0, 13.6 * M, 22 * M, 0.12 * M, 2.4 * M);
    // --- Spielfeld mit Mähstreifen und Linien
    const FW = 14.8 * M, FD = 9.8 * M;
    kit.box('rubber_track', 0, 0.06 * M, 0, FW + 2.4 * M, 0.06 * M, FD + 2.2 * M);
    const stripes = detail === 0 ? 1 : 10;
    for (let i = 0; i < stripes; i++) kit.box(i % 2 ? 'sports_turf' : 'grass', -FW / 2 + (FW / stripes) * (i + 0.5), 0.1 * M, 0, FW / stripes + 0.001, 0.05 * M, FD);
    if (detail > 0) {
      const L = 'paint_white', ly = 0.15 * M, lw = 0.12 * M;
      for (const s of [-1, 1]) {
        kit.box(L, 0, ly, s * FD / 2, FW, 0.02 * M, lw);
        kit.box(L, s * FW / 2, ly, 0, lw, 0.02 * M, FD);
        // Strafräume
        kit.box(L, s * (FW / 2 - 2.2 * M), ly, 0, lw, 0.02 * M, 5.6 * M);
        kit.box(L, s * (FW / 2 - 1.1 * M), ly, 2.8 * M, 2.2 * M, 0.02 * M, lw);
        kit.box(L, s * (FW / 2 - 1.1 * M), ly, -2.8 * M, 2.2 * M, 0.02 * M, lw);
        // Tore
        const gx = s * (FW / 2 + 0.3 * M);
        for (const zz of [-1.0, 1.0]) kit.box(L, gx, 0.1 * M, zz * M, 0.1 * M, 0.95 * M, 0.1 * M);
        kit.box(L, gx, 1.05 * M, 0, 0.1 * M, 0.1 * M, 2.1 * M);
        if (detail === 2) kit.box('chain_fence', gx + s * 0.4 * M, 0.1 * M, 0, 0.04 * M, 0.95 * M, 2.0 * M);
      }
      kit.box(L, 0, ly, 0, lw, 0.02 * M, FD);
      torus(kit, L, 0, ly + 0.01 * M, 0, 1.8 * M, 0.06 * M, { rx: Math.PI / 2, tubular: 28, radial: 3 });
      // Ersatzbänke
      for (const s of [-1, 1]) kit.box('glass_curtain_dark', s * 2.4 * M, 0.1 * M, FD / 2 + 0.75 * M, 2.6 * M, 0.7 * M, 0.5 * M, { lit: 0 });
    }
    // --- Tribünen: Unterrang und Oberrang (flach schattiert, damit die Stufen lesbar bleiben)
    const nStep = detail === 2 ? 9 : detail === 1 ? 5 : 2;
    ellLathe(kit, 'concrete', [[0.62, 0], [0.62, 0.7 * M]], AX, AZ, seg);
    ellLathe(kit, 'paint_red', stepProfile(0.62, 0.7 * M, 0.78, 3.8 * M, nStep), AX, AZ, seg, { flat: true });
    ellLathe(kit, 'concrete_dark', [[0.78, 4.6 * M], [0.78, 3.8 * M]], AX, AZ, seg);
    if (detail > 0) ellLathe(kit, 'glass_curtain_dark', [[0.775, 4.5 * M], [0.775, 3.9 * M]], AX, AZ, seg, { lit: 0.9 });
    ellLathe(kit, 'paint_white', stepProfile(0.78, 4.6 * M, 0.97, 8.4 * M, nStep), AX, AZ, seg, { flat: true });
    if (detail > 0) {
      // Vereinsfarbe als Muster im Oberrang
      for (const ph of [-0.3, Math.PI - 0.3]) ellLathe(kit, 'paint_red', stepProfile(0.78, 4.6 * M, 0.97, 8.4 * M, nStep), AX * 1.002, AZ * 1.002, detail === 2 ? 10 : 6, { phiStart: ph, phiLength: 0.6, y: 0.01 * M, flat: true });
    }
    // --- Fassade: weiße Lamellen vor dunklem Glas, oben ein Leuchtband
    ellLathe(kit, 'glass_curtain_dark', [[1.0, 0.4 * M], [1.0, 9.0 * M]], AX * 0.995, AZ * 0.995, seg, { lit: 0.3 });
    ellLathe(kit, 'metal_panel_white', [[1.01, 0], [1.01, 1.2 * M]], AX, AZ, seg);
    ellLathe(kit, 'metal_panel_white', [[1.012, 3.8 * M], [1.012, 4.6 * M]], AX, AZ, seg);
    ellLathe(kit, 'emissive_red', [[1.014, 8.0 * M], [1.014, 8.5 * M]], AX, AZ, seg);
    ellLathe(kit, 'metal_panel_white', [[1.015, 8.5 * M], [1.015, 9.2 * M], [0.97, 9.2 * M], [0.97, 8.3 * M]], AX, AZ, seg);
    if (detail > 0) {
      const nf = detail === 2 ? 72 : 36;
      for (let i = 0; i < nf; i++) {
        const a = (i / nf) * Math.PI * 2;
        const x = Math.sin(a) * AX * 1.03, z = Math.cos(a) * AZ * 1.03;
        const tang = Math.atan2(Math.sin(a) * AZ, Math.cos(a) * AX);
        kit.box('metal_panel_white', x, 1.2 * M, z, 0.25 * M, 6.8 * M, 0.7 * M, { ry: tang, rz: 0.12 });
      }
    }
    // --- Dachring (Membran) mit Fachwerkträgern und Flutlicht
    ellLathe(kit, 'canvas_white', [[1.06, 9.2 * M], [0.86, 10.5 * M], [0.8, 10.7 * M], [0.8, 10.45 * M], [0.86, 10.2 * M], [1.04, 8.95 * M]], AX, AZ, seg);
    if (detail > 0) {
      const nt = detail === 2 ? 28 : 14;
      for (let i = 0; i < nt; i++) {
        const a = (i / nt) * Math.PI * 2;
        const P = (r, y) => [Math.sin(a) * AX * r, y, Math.cos(a) * AZ * r];
        beam(kit, 'metal_light', P(1.04, 9.3 * M), P(0.81, 10.8 * M), 0.2 * M, 0.3 * M);
        if (detail === 2) beam(kit, 'metal_light', P(1.04, 9.3 * M), P(1.04, 10.4 * M), 0.12 * M, 0.12 * M);
        if (detail === 2) beam(kit, 'metal_light', P(1.04, 10.4 * M), P(0.83, 10.9 * M), 0.12 * M, 0.12 * M);
        kit.box('emissive_cool', ...P(0.805, 10.25 * M), 0.9 * M, 0.3 * M, 0.5 * M, { ry: a });
        if (i % 4 === 0) kit.light(...P(0.8, 10.2 * M), 0xdcefff, 0.8);
      }
      // Videowand
      kit.box('metal_dark', -AX * 0.84, 6.4 * M, 0, 0.4 * M, 2.6 * M, 4.6 * M);
      kit.box('glass_curtain_dark', -AX * 0.84 + 0.22 * M, 6.6 * M, 0, 0.05 * M, 2.2 * M, 4.2 * M, { lit: 0.95 });
    }
    if (detail === 2) {
      const FAN = ['paint_red', 'paint_red', 'paint_white', 'paint_red', 'metal_dark', 'paint_yellow'];
      for (const [r0, y0, r1, y1, n] of [[0.62, 0.7 * M, 0.78, 3.8 * M, 70], [0.78, 4.6 * M, 0.97, 8.4 * M, 90]]) {
        for (let i = 0; i < n; i++) {
          const k = Math.floor(kit.rng() * nStep), phi = kit.rng() * Math.PI * 2;
          const r = r0 + ((r1 - r0) * (k + 0.55)) / nStep, y = y0 + ((y1 - y0) * (k + 1)) / nStep;
          person(kit, Math.sin(phi) * AX * r, Math.cos(phi) * AZ * r, { sit: true, y0: y, shirt: FAN[i % FAN.length] });
        }
      }
      for (let i = 0; i < 22; i++) person(kit, (i < 11 ? -1 : 1) * (0.6 + kit.rng() * 6.4) * M, (kit.rng() - 0.5) * 8.6 * M, { y0: 0.15 * M, shirt: i < 11 ? 'paint_red' : 'paint_blue' });
      kit.sphere('paint_white', 0.6 * M, 0.3 * M, 0.4 * M, 0.12 * M, { seg: 5 });
      crowd(kit, 0, 13.4 * M, 18 * M, 2.4 * M, 16);
    }
    // --- Eingänge, Kassen, Fahnen
    for (const s of [-1, 1]) {
      const [ex, ez] = [s * 5.0 * M, AZ * 0.97];
      kit.box('metal_dark', ex, 0, ez + 0.4 * M, 3.4 * M, 3.2 * M, 1.0 * M);
      kit.box('glass_curtain_dark', ex, 0.1 * M, ez + 0.92 * M, 3.0 * M, 2.6 * M, 0.04 * M, { lit: 0.99 });
      kit.box('paint_red', ex, 3.2 * M, ez + 0.6 * M, 3.8 * M, 0.5 * M, 1.6 * M);
    }
    text(kit, 'paint_white', 'STADION', 0, 5.6 * M, AZ * 1.04 + 0.4 * M, 0, 1.0 * M, { depth: 0.1 * M });
    if (detail > 0) {
      kit.box('paint_red', 0, 5.4 * M, AZ * 1.04 + 0.2 * M, 8.0 * M, 1.4 * M, 0.25 * M);
      hut(kit, -10.5 * M, 12.6 * M, 0, 2.6 * M, 1.8 * M, 2.4 * M, { wall: 'paint_red', roof: 'roof_metal_grey', counter: true, awning: 'awning_red', glass: 'glass_curtain_dark' });
      hut(kit, 10.5 * M, 12.6 * M, 0, 2.6 * M, 1.8 * M, 2.4 * M, { wall: 'paint_red', roof: 'roof_metal_grey', counter: true, awning: 'awning_red', glass: 'glass_curtain_dark' });
      for (const x of [-8, -6.5, 6.5, 8]) flag(kit, x * M, 14.2 * M, 7.0 * M, Math.abs(x) > 7 ? 'paint_red' : 'paint_white');
      for (const [x, z] of [[-13.6, -13.6], [13.6, -13.6], [-13.8, 9.0], [13.8, 9.0], [-13.8, -4], [13.8, -4]]) tree(kit, x * M, z * M, 0.8, 'round');
      for (const s of [-1, 1]) { lamp(kit, s * 13.4 * M, 13.4 * M, 5.0 * M, { head: 'emissive_cool' }); lamp(kit, s * 3.0 * M, 14.2 * M, 5.0 * M, { head: 'emissive_cool' }); }
    }
    return kit.build();
  },
});

registerArch('arena', {
  variants: 1,
  build(ctx) {
    const { kit, detail } = ctx;
    const AX = 8.8 * M, AZ = 7.0 * M, CZ = -1.4 * M;
    const seg = detail === 2 ? 48 : detail === 1 ? 28 : 16;
    kit.box('pavers', 0, 0, 0, 19.8 * M, 0.08 * M, 19.8 * M);
    // Sockel mit umlaufender Terrasse
    ellLathe(kit, 'stone_dark', [[1.12, 0], [1.12, 1.2 * M], [0.01, 1.2 * M]], AX, AZ, seg, { z: CZ });
    if (detail > 0) {
      const pts = [];
      const n = detail === 2 ? 40 : 20;
      for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; pts.push([Math.sin(a) * AX * 1.11, CZ + Math.cos(a) * AZ * 1.11]); }
      glassRail(kit, pts, 1.2 * M, 1.0 * M, { glass: 'glass_curtain_blue' });
    }
    // Körper: Metallfassade mit Glasfuge und LED-Medienband
    ellLathe(kit, 'metal_panel_grey', [[1.0, 1.2 * M], [1.0, 3.6 * M]], AX, AZ, seg, { z: CZ });
    ellLathe(kit, 'glass_curtain_blue', [[0.99, 3.6 * M], [0.99, 5.2 * M]], AX, AZ, seg, { z: CZ, lit: 0.6 });
    ellLathe(kit, 'metal_panel_white', [[1.0, 5.2 * M], [1.03, 6.0 * M], [1.03, 7.6 * M], [1.0, 8.2 * M]], AX, AZ, seg, { z: CZ });
    ellLathe(kit, 'neon_pink', [[1.035, 6.3 * M], [1.035, 7.3 * M]], AX, AZ, seg, { z: CZ });
    if (detail > 0) {
      const nf = detail === 2 ? 48 : 24;
      for (let i = 0; i < nf; i++) {
        const a = (i / nf) * Math.PI * 2;
        const tang = Math.atan2(Math.sin(a) * AZ, Math.cos(a) * AX);
        kit.box('metal_light', Math.sin(a) * AX * 1.0, 3.6 * M, CZ + Math.cos(a) * AZ * 1.0, 0.12 * M, 1.6 * M, 0.2 * M, { ry: tang });
      }
    }
    // Kuppeldach mit Rippen
    ellLathe(kit, 'metal_panel_white', [[1.0, 8.2 * M], [0.92, 9.8 * M], [0.75, 11.0 * M], [0.5, 11.8 * M], [0.2, 12.2 * M], [0.01, 12.25 * M]], AX, AZ, seg, { z: CZ });
    if (detail > 0) {
      ellLathe(kit, 'glass_curtain_blue', [[0.28, 12.18 * M], [0.01, 12.32 * M]], AX, AZ, 16, { z: CZ, lit: 0.8 });
      const nr = detail === 2 ? 24 : 12;
      for (let i = 0; i < nr; i++) {
        const a = (i / nr) * Math.PI * 2;
        const pts = [[1.005, 8.2], [0.925, 9.8], [0.755, 11.0], [0.505, 11.8], [0.29, 12.18]];
        for (let k = 0; k < pts.length - 1; k++) {
          const [r0, y0] = pts[k], [r1, y1] = pts[k + 1];
          beam(kit, 'metal_panel_grey', [Math.sin(a) * AX * r0, y0 * M + 0.05 * M, CZ + Math.cos(a) * AZ * r0], [Math.sin(a) * AX * r1, y1 * M + 0.05 * M, CZ + Math.cos(a) * AZ * r1], 0.18 * M, 0.12 * M);
        }
      }
    }
    // Glasfoyer zur Straße mit Vordach und Schriftzug
    const FZ = CZ + AZ * 0.86;
    kit.box('glass_curtain_blue', 0, 1.2 * M, FZ + 1.3 * M, 9.0 * M, 5.4 * M, 2.6 * M, { lit: 0.95 });
    if (detail > 0) for (let i = 0; i <= 8; i++) kit.box('metal_dark', -4.5 * M + i * 1.125 * M, 1.2 * M, FZ + 2.62 * M, 0.1 * M, 5.4 * M, 0.1 * M);
    kit.box('metal_panel_white', 0, 6.6 * M, FZ + 2.2 * M, 11.4 * M, 0.5 * M, 4.8 * M);
    kit.box('neon_pink', 0, 6.55 * M, FZ + 4.62 * M, 11.0 * M, 0.08 * M, 0.06 * M);
    text(kit, 'metal_dark', 'ARENA', 0, 6.62 * M, FZ + 4.63 * M, 0, 0.38 * M, { depth: 0.04 * M });
    for (const s of [-1, 1]) kit.cyl('metal_light', s * 5.2 * M, 0, FZ + 4.2 * M, 0.15 * M, 6.6 * M, { seg: 8 });
    // Freitreppe
    for (let k = 0; k < 6; k++) kit.box('stone_grey', 0, 0, FZ + 3.0 * M + k * 0.42 * M, 10.0 * M - k * 0.2 * M, 1.2 * M * (1 - k / 6), 0.44 * M);
    // Anlieferung hinten
    kit.box('concrete', 0, 0, CZ - AZ * 1.02, 5.0 * M, 3.6 * M, 2.4 * M);
    if (detail > 0) {
      kit.box('metal_corrugated', -1.2 * M, 0.2 * M, CZ - AZ * 1.02 - 1.21 * M, 1.8 * M, 2.8 * M, 0.05 * M);
      kit.box('metal_corrugated', 1.2 * M, 0.2 * M, CZ - AZ * 1.02 - 1.21 * M, 1.8 * M, 2.8 * M, 0.05 * M);
    }
    // Vorplatz
    crowd(kit, 0, 8.8 * M, 12 * M, 1.6 * M, 10);
    if (detail > 0) {
      for (const s of [-1, 1]) {
        lamp(kit, s * 8.6 * M, 8.8 * M, 4.6 * M);
        tree(kit, s * 8.6 * M, -8.6 * M, 0.8, 'round');
        tree(kit, s * 9.0 * M, 3.0 * M, 0.7, 'round');
        flag(kit, s * 7.2 * M, 9.0 * M, 6.0 * M, s > 0 ? 'paint_blue' : 'paint_red');
        bench(kit, s * 7.0 * M, 7.0 * M, s * Math.PI / 2);
      }
    }
    void path; void face;
    return kit.build();
  },
});
