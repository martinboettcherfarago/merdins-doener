// Türme: Fernsehturm (1 × 1), Pulsturm (2 × 2, höchster Turm der Region), Leuchtturm (1 × 1). Besitzer: G6.
import * as THREE from 'three';
import { registerArch } from './index.js';
import { M } from './kit.js';
import { lathe, beam, railing, glassRail, lamp, bench, tree, addAnim, flat, torus, face, hut, crowd, person } from './lm_parts.js';
import { text } from './lm_text.js';

// ---------------------------------------------------------------- Fernsehturm
registerArch('tvtower', {
  variants: 1,
  build(ctx) {
    const { kit, detail } = ctx;
    const seg = detail === 2 ? 24 : detail === 1 ? 14 : 10;
    const SY = 76 * M, SR = 12 * M; // Kugelmitte, Kugelradius
    // Platz und Eingangspavillon mit Faltdach
    kit.box('pavers', 0, 0, 0, 9.8 * M, 0.08 * M, 9.8 * M);
    kit.cyl('concrete', 0, 0, 0, 4.6 * M, 0.35 * M, { seg });
    kit.cyl('glass_curtain_blue', 0, 0.35 * M, 0, 4.2 * M, 3.4 * M, { seg, lit: 0.95 });
    if (detail > 0) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        kit.box('concrete', Math.sin(a) * 4.25 * M, 0.35 * M, Math.cos(a) * 4.25 * M, 0.25 * M, 3.4 * M, 0.25 * M, { ry: a });
        // gefaltetes Dach: Zacken
        kit.prism('concrete_panel', [[-1.2 * M, 0], [1.2 * M, 0], [0, 1.0 * M]], 1.6 * M, { x: Math.sin(a) * 4.0 * M, y: 3.75 * M, z: Math.cos(a) * 4.0 * M, ry: a });
      }
    }
    kit.cyl('concrete_panel', 0, 3.75 * M, 0, 4.7 * M, 0.3 * M, { seg });
    // Schaft (leicht verjüngt)
    lathe(kit, 'concrete_panel', 0, 0, 0, [[3.4 * M, 0], [3.1 * M, 6 * M], [2.5 * M, 30 * M], [2.05 * M, 60 * M], [1.9 * M, SY - SR * 0.9]], seg);
    if (detail > 0) for (let y = 12 * M; y < SY - SR; y += 12 * M) kit.cyl('concrete_dark', 0, y, 0, 3.2 * M - (y / (60 * M)) * 1.1 * M, 0.25 * M, { seg });
    // Aufzugsschächte als Lisenen
    if (detail === 2) for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      kit.box('concrete', Math.sin(a) * 2.2 * M, 4 * M, Math.cos(a) * 2.2 * M, 0.6 * M, SY - SR - 4 * M, 0.5 * M, { ry: a });
    }
    // Kugel mit Restaurant-Glasband
    kit.sphere('metal_panel_white', 0, SY, 0, SR, { seg: detail === 2 ? 28 : detail === 1 ? 16 : 10 });
    kit.cyl('glass_curtain_dark', 0, SY - 1.6 * M, 0, SR * 1.003, 3.2 * M, { seg: detail === 2 ? 28 : 16, lit: 0.9 });
    if (detail > 0) {
      torus(kit, 'metal_dark', 0, SY - 1.6 * M, 0, SR * 1.0, 0.25 * M, { rx: Math.PI / 2, tubular: 28, radial: 4 });
      torus(kit, 'metal_dark', 0, SY + 1.6 * M, 0, SR * 0.99, 0.25 * M, { rx: Math.PI / 2, tubular: 28, radial: 4 });
      if (detail === 2) for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        kit.box('metal_dark', Math.sin(a) * SR * 1.004, SY - 1.6 * M, Math.cos(a) * SR * 1.004, 0.12 * M, 3.2 * M, 0.12 * M, { ry: a });
      }
      // Facettenringe der Kugel
      for (const t of [-0.75, -0.4, 0.4, 0.75]) {
        const yy = SY + t * SR, rr = Math.sqrt(1 - t * t) * SR;
        torus(kit, 'metal_panel_grey', 0, yy, 0, rr, 0.12 * M, { rx: Math.PI / 2, tubular: 24, radial: 3 });
      }
    }
    // Antennenträger und Mast in Rot/Weiß
    const T0 = SY + SR * 0.95;
    kit.cyl('concrete_panel', 0, T0, 0, 1.6 * M, 14 * M, { seg: 12, rTop: 1.3 * M });
    const A0 = T0 + 14 * M;
    kit.cyl('metal_panel_white', 0, A0, 0, 1.4 * M, 1.0 * M, { seg: 10 });
    for (let k = 0; k < 7; k++) kit.cyl(k % 2 ? 'paint_white' : 'paint_red', 0, A0 + 1 * M + k * 3.4 * M, 0, 0.9 * M - k * 0.09 * M, 3.4 * M, { seg: 8, rTop: 0.9 * M - (k + 1) * 0.09 * M });
    const TOP = A0 + 1 * M + 7 * 3.4 * M;
    kit.cyl('metal_light', 0, TOP, 0, 0.15 * M, 5 * M, { seg: 4 });
    kit.sphere('emissive_red', 0, TOP + 5.1 * M, 0, 0.35 * M, { seg: 6 });
    kit.light(0, TOP + 5.1 * M, 0, 0xff3020, 0.5);
    if (detail > 0) {
      for (const y of [A0 + 8 * M, A0 + 16 * M]) for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2; kit.sphere('emissive_red', Math.sin(a) * 1.0 * M, y, Math.cos(a) * 1.0 * M, 0.22 * M, { seg: 4 }); }
      // Antennenschüsseln am Träger
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + 0.4;
        kit.add('metal_panel_white', new THREE.SphereGeometry(1.1 * M, 8, 4, 0, Math.PI * 2, 0, 1.0), { x: Math.sin(a) * 2.0 * M, y: T0 + 6 * M, z: Math.cos(a) * 2.0 * M, rx: -Math.PI / 2, ry: a, sy: 0.4 });
      }
      kit.light(0, SY, SR, 0xdcefff, 0.8);
    }
    if (detail === 2) {
      for (const [x, z] of [[-4.2, 4.2], [4.2, -4.2], [4.2, 4.2], [-4.2, -4.2]]) tree(kit, x * M, z * M, 0.55, 'round');
      for (const s of [-1, 1]) bench(kit, s * 3.0 * M, 4.6 * M, Math.PI);
    }
    return kit.build();
  },
});

// ---------------------------------------------------------------- Pulsturm (verdrehter Glasturm mit Aussichtskrone)
registerArch('skytower', {
  variants: 1,
  build(ctx) {
    const { kit, detail } = ctx;
    const FH = 3.6 * M, FLOORS = 34, TWIST = (62 / 180) * Math.PI;
    const W0 = 15.5 * M, W1 = 10.0 * M;
    const POD = 7.0 * M;
    // --- Platz mit Bäumen und Wasserbecken
    kit.box('pavers', 0, 0, 0, 19.8 * M, 0.08 * M, 19.8 * M);
    kit.box('stone_dark', 0, 0, 7.6 * M, 14 * M, 0.12 * M, 4.0 * M);
    kit.box('water_pool', -4.5 * M, 0.08 * M, 8.0 * M, 6.0 * M, 0.1 * M, 2.2 * M);
    // --- Sockelbau (Lobby, zwei Geschosse) mit auskragendem Dach
    kit.box('stone_dark', 0, 0, 0, 18.2 * M, 0.5 * M, 14.0 * M);
    kit.curtainWall('front', 0, 0, 18.0 * M, 13.8 * M, 0.5 * M, POD - 0.5 * M, { glass: 'glass_curtain_blue', frame: 'metal_dark', fh: POD / 2, colW: 2.2 * M });
    kit.curtainWall('back', 0, 0, 18.0 * M, 13.8 * M, 0.5 * M, POD - 0.5 * M, { glass: 'glass_curtain_blue', frame: 'metal_dark', fh: POD / 2, colW: 2.2 * M });
    for (const sd of ['left', 'right']) kit.curtainWall(sd, 0, 0, 18.0 * M, 13.8 * M, 0.5 * M, POD - 0.5 * M, { glass: 'glass_curtain_blue', frame: 'metal_dark', fh: POD / 2, colW: 2.2 * M });
    kit.box('metal_panel_white', 0, 0.5 * M, 0, 17.9 * M, POD - 0.5 * M, 13.7 * M);
    kit.box('metal_panel_white', 0, POD, 0.6 * M, 19.6 * M, 0.6 * M, 15.4 * M);
    if (detail > 0) {
      kit.box('neon_cyan', 0, POD - 0.05 * M, 8.2 * M, 16 * M, 0.08 * M, 0.25 * M);
      text(kit, 'metal_light', 'PULSTURM', 0, POD + 0.08 * M, 8.32 * M, 0, 0.42 * M, { depth: 0.05 * M });
      kit.box('glass_curtain_blue', 0, 0.5 * M, 6.95 * M, 4.0 * M, 3.0 * M, 0.08 * M, { lit: 0.99 });
    }
    // --- Turmschaft: Geschosse verdreht und verjüngt
    const steps = detail === 0 ? 8 : FLOORS;
    const per = FLOORS / steps;
    let y = POD + 0.6 * M;
    const corners = [];
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps, w = W0 + (W1 - W0) * t, ry = TWIST * t;
      const h = FH * per;
      const mech = detail > 0 && (i + 1) % 10 === 0;
      kit.box(mech ? 'metal_panel_grey' : 'glass_curtain_blue', 0, y, 0, w, h - (detail > 0 ? 0.25 * M : 0), w, { ry, lit: kit.rng() });
      if (detail > 0) kit.box('metal_panel_white', 0, y + h - 0.45 * M, 0, w + 0.4 * M, 0.45 * M, w + 0.4 * M, { ry });
      if (mech) {
        kit.box('neon_cyan', 0, y + h * 0.45, 0, w + 0.08 * M, 0.25 * M, w + 0.08 * M, { ry });
      }
      corners.push({ y, h, w, ry });
      y += h;
    }
    // Eckfinnen folgen der Drehung
    if (detail > 0) for (const c of corners) for (let k = 0; k < 4; k++) {
      const a = c.ry + Math.PI / 4 + (k * Math.PI) / 2;
      const r = (c.w / 2) * Math.SQRT2;
      kit.box('metal_panel_white', Math.sin(a) * r, c.y, Math.cos(a) * r, 1.0 * M, c.h, 1.0 * M, { ry: a });
      if (detail === 2) for (const off of [-1, 1]) {
        const a2 = c.ry + (k * Math.PI) / 2, u = off * c.w * 0.25;
        const fx = Math.sin(a2) * (c.w / 2 + 0.12 * M) + Math.cos(a2) * u, fz = Math.cos(a2) * (c.w / 2 + 0.12 * M) - Math.sin(a2) * u;
        kit.box('metal_light', fx, c.y, fz, 0.18 * M, c.h - 0.3 * M, 0.25 * M, { ry: a2 });
      }
    }
    // --- Aussichtsplattform (auskragend) und Krone
    const top = corners[corners.length - 1], RY = TWIST;
    const DK = y;
    kit.box('metal_panel_white', 0, DK, 0, W1 + 4.0 * M, 0.6 * M, W1 + 4.0 * M, { ry: RY });
    kit.box('glass_curtain_blue', 0, DK + 0.6 * M, 0, W1 - 0.4 * M, 4.0 * M, W1 - 0.4 * M, { ry: RY, lit: 0.95 });
    kit.box('metal_panel_white', 0, DK + 4.6 * M, 0, W1 + 1.0 * M, 0.4 * M, W1 + 1.0 * M, { ry: RY });
    if (detail > 0) {
      const hw = (W1 + 4.0 * M) / 2 - 0.15 * M;
      const pts = [[-hw, -hw], [hw, -hw], [hw, hw], [-hw, hw], [-hw, -hw]].map(([u, w]) => [Math.cos(RY) * u + Math.sin(RY) * w, -Math.sin(RY) * u + Math.cos(RY) * w]);
      glassRail(kit, pts, DK + 0.6 * M, 1.3 * M, { glass: 'glass_curtain_blue' });
      // Fernrohre auf der Plattform
      if (detail === 2) for (let k = 0; k < 4; k++) {
        const a = RY + (k * Math.PI) / 2;
        const px = Math.sin(a) * (W1 / 2 + 1.2 * M), pz = Math.cos(a) * (W1 / 2 + 1.2 * M);
        kit.cyl('metal_dark', px, DK + 0.6 * M, pz, 0.08 * M, 1.1 * M, { seg: 5 });
        kit.cyl('metal_light', px, DK + 1.7 * M, pz, 0.14 * M, 0.6 * M, { rx: Math.PI / 2 - 0.3, ry: a, seg: 6 });
      }
    }
    // Krone: vier Finnen laufen zur Spitze zusammen
    const CR = DK + 5.0 * M, CH = 13 * M;
    for (let k = 0; k < 4; k++) {
      const a = RY + Math.PI / 4 + (k * Math.PI) / 2, r = (W1 / 2) * Math.SQRT2 * 0.9;
      beam(kit, 'metal_panel_white', [Math.sin(a) * r, CR, Math.cos(a) * r], [Math.sin(a) * 0.5 * M, CR + CH, Math.cos(a) * 0.5 * M], 0.8 * M, 1.6 * M);
      if (detail > 0) beam(kit, 'neon_cyan', [Math.sin(a) * (r + 0.4 * M), CR, Math.cos(a) * (r + 0.4 * M)], [Math.sin(a) * 0.9 * M, CR + CH, Math.cos(a) * 0.9 * M], 0.15 * M, 0.3 * M);
    }
    if (detail > 0) for (const t of [0.3, 0.6]) {
      const r = (W1 / 2) * Math.SQRT2 * 0.9 * (1 - t) + 0.5 * M * t;
      kit.cyl('neon_cyan', 0, CR + CH * t, 0, r * 0.72, 0.25 * M, { seg: 4, ry: RY + Math.PI / 4, open: true });
    }
    kit.cyl('metal_light', 0, CR + CH - 1 * M, 0, 0.35 * M, 11 * M, { seg: 6, rTop: 0.1 * M });
    kit.sphere('neon_cyan', 0, CR + CH + 10 * M, 0, 0.45 * M, { seg: 8 });
    kit.light(0, CR + CH + 10 * M, 0, 0x3fe8ff, 0.9);
    kit.light(0, CR + CH * 0.4, 0, 0x3fe8ff, 1.4);
    void top;
    // --- Platzgestaltung
    crowd(kit, 2.0 * M, 8.4 * M, 14 * M, 2.4 * M, 10);
    if (detail > 0) {
      for (const x of [-8.6, -2.8, 2.8, 8.6]) tree(kit, x * M, 9.0 * M, 0.75, 'round');
      for (const s of [-1, 1]) { lamp(kit, s * 5.8 * M, 9.2 * M, 4.4 * M, { head: 'neon_cyan', color: 0x9fefff }); bench(kit, s * 1.6 * M, 9.4 * M, Math.PI); }
    }
    return kit.build();
  },
});

// ---------------------------------------------------------------- Leuchtturm
registerArch('lighthouse', {
  variants: 1,
  build(ctx) {
    const { kit, detail } = ctx;
    const seg = detail === 2 ? 18 : detail === 1 ? 12 : 8;
    const TH = 24 * M, R0 = 2.6 * M, R1 = 1.7 * M;
    // Felsen und Plattform
    kit.box('grass', 0, 0, 0, 9.8 * M, 0.06 * M, 9.8 * M);
    for (let k = 0; k < (detail === 0 ? 4 : 11); k++) {
      const a = k * 2.4, r = (3.2 + (k % 3) * 0.6) * M;
      kit.add('rock', flat(new THREE.IcosahedronGeometry((1.0 + (k % 4) * 0.35) * M, 0)), { x: Math.cos(a) * r, y: 0.2 * M, z: Math.sin(a) * r - 0.8 * M, sy: 0.7, ry: a });
    }
    kit.cyl('stone_grey', 0, 0, -0.5 * M, 3.4 * M, 1.4 * M, { seg });
    // Turm: rot-weiße Bänder, verjüngt
    const bands = 6;
    for (let k = 0; k < bands; k++) {
      const t0 = k / bands, t1 = (k + 1) / bands;
      kit.cyl(k % 2 ? 'paint_white' : 'paint_red', 0, 1.4 * M + TH * t0, -0.5 * M, R0 + (R1 - R0) * t0, TH / bands, { seg, rTop: R0 + (R1 - R0) * t1 });
    }
    if (detail > 0) {
      for (let k = 0; k < 5; k++) {
        const t = 0.12 + k * 0.17, rr = R0 + (R1 - R0) * t;
        const a = (k % 2) * Math.PI;
        kit.window(Math.sin(a) * rr, 1.4 * M + TH * t, -0.5 * M + Math.cos(a) * rr, a, 0.6 * M, 1.0 * M, { frame: 'paint_white' });
      }
      kit.box('door_wood', 0, 1.4 * M, -0.5 * M + R0 - 0.05 * M, 1.0 * M, 2.1 * M, 0.3 * M);
    }
    const GY = 1.4 * M + TH;
    // Galerie mit Geländer
    kit.cyl('paint_white', 0, GY, -0.5 * M, R1 + 1.0 * M, 0.35 * M, { seg });
    if (detail > 0) {
      const n = detail === 2 ? 18 : 10, rr = R1 + 0.9 * M;
      const pts = [];
      for (let k = 0; k <= n; k++) { const a = (k / n) * Math.PI * 2; pts.push([Math.cos(a) * rr, -0.5 * M + Math.sin(a) * rr]); }
      railing(kit, pts, GY + 0.35 * M, 1.0 * M, { mat: 'metal_dark', spacing: 0.8 * M });
    }
    // Laternenhaus
    kit.cyl('metal_dark', 0, GY + 0.35 * M, -0.5 * M, R1 * 0.85, 0.8 * M, { seg });
    // Laternenhaus: nur Sprossen (die drehende Optik bleibt sichtbar), unten ein Glasring
    kit.cyl('glass_skylight', 0, GY + 1.15 * M, -0.5 * M, R1 * 0.8, 0.5 * M, { seg, lit: 1 });
    for (let k = 0; k < (detail === 0 ? 4 : 10); k++) {
      const a = (k / (detail === 0 ? 4 : 10)) * Math.PI * 2;
      kit.box('metal_dark', Math.sin(a) * R1 * 0.81, GY + 1.15 * M, -0.5 * M + Math.cos(a) * R1 * 0.81, 0.12 * M, 2.6 * M, 0.12 * M, { ry: a });
    }
    if (detail > 0) kit.cyl('metal_dark', 0, GY + 2.4 * M, -0.5 * M, R1 * 0.82, 0.08 * M, { seg, open: true });
    kit.cyl('metal_dark', 0, GY + 3.75 * M, -0.5 * M, R1 * 0.95, 0.25 * M, { seg });
    lathe(kit, 'roof_copper', 0, GY + 4.0 * M, -0.5 * M, [[R1 * 0.95, 0], [R1 * 0.7, 0.8 * M], [0.4 * M, 1.6 * M], [0.15 * M, 2.0 * M]], seg);
    kit.sphere('metal_dark', 0, GY + 6.1 * M, -0.5 * M, 0.25 * M, { seg: 6 });
    if (detail === 2) { kit.cyl('metal_dark', 0, GY + 6.1 * M, -0.5 * M, 0.04 * M, 1.4 * M, { seg: 4 }); kit.box('metal_dark', 0.3 * M, GY + 7.2 * M, -0.5 * M, 0.8 * M, 0.25 * M, 0.03 * M); }
    kit.light(0, GY + 2.4 * M, -0.5 * M, 0xfff1b8, 1.6);
    // Wärterhaus
    hut(kit, 2.6 * M, 3.0 * M, 0, 4.2 * M, 3.0 * M, 2.8 * M, { wall: 'plaster_white', roof: 'roof_tiles_red', door: true });
    if (detail > 0) {
      kit.window(1.5 * M, 1.0 * M, 4.52 * M, 0, 0.9 * M, 1.1 * M, { frame: 'paint_blue', shutters: 'paint_blue' });
      kit.chimney(3.6 * M, 3.0 * M, 2.8 * M, 1.6 * M, 'plaster_white');
    }
    if (detail === 2) { bench(kit, -2.6 * M, 3.8 * M, 0); kit.box('wood_planks', -1.4 * M, 0, 4.4 * M, 0.08 * M, 0.9 * M, 0.08 * M); }
    const res = kit.build();
    // Drehende Optik mit zwei Leuchtfeldern
    addAnim(ctx, res, [0, GY + 2.45 * M, -0.5 * M], 'y', 1.1, (k) => {
      k.cyl('metal_light', 0, -1.1 * M, 0, 0.25 * M, 0.5 * M, { seg: 6 });
      k.cyl('glass_skylight', 0, -0.6 * M, 0, 0.6 * M, 1.4 * M, { seg: 8, lit: 1 });
      for (const s of [-1, 1]) k.cyl('emissive_warm', 0, 0.1 * M, s * 0.55 * M, 0.45 * M, 0.12 * M, { rx: s * Math.PI / 2, seg: 10 });
    });
    return res;
  },
});
void text; void face;
