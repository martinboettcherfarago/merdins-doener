// Historische Wahrzeichen: Stadttor aus Backstein (2 × 1) und Holländer-Windmühle (1 × 1, Flügel drehen sich).
// Besitzer: G6.
import * as THREE from 'three';
import { registerArch } from './index.js';
import { M } from './kit.js';
import { beam, lathe, slab, archOutline, archRing, archSpandrel, archWindow, railing, lamp, bench, tree, addAnim, face, flat, hut, crowd } from './lm_parts.js';
import { text } from './lm_text.js';

const BRICK = 'brick_red', GLAZE = 'brick_dark', WHITE = 'plaster_white';

// Runder Torturm mit Kegeldach, Glasurbändern, Blendnischen und Schießscharten
function roundTower(kit, x, z, r, h, roofH) {
  const seg = kit.detail === 2 ? 20 : kit.detail === 1 ? 12 : 8;
  kit.cyl('stone_grey', x, 0, z, r + 0.15 * M, 1.0 * M, { seg });
  kit.cyl(BRICK, x, 1.0 * M, z, r, h - 1.0 * M, { seg });
  if (kit.detail > 0) for (const y of [4.6, 9.2, 13.8]) {
    if (y * M > h - 1 * M) continue;
    kit.cyl(GLAZE, x, y * M, z, r + 0.04 * M, 0.5 * M, { seg });
  }
  kit.cyl(GLAZE, x, h - 0.9 * M, z, r + 0.25 * M, 0.9 * M, { seg });
  // Blendnischen (weiß verputzte Spitzbögen) und Fenster rundum
  if (kit.detail > 0) {
    const n = kit.detail === 2 ? 8 : 5;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + 0.2;
      const px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
      archWindow(kit, px, 5.4 * M, pz, a, 0.9 * M, 2.8 * M, { kind: 'pointed', frame: BRICK, glass: WHITE, mullions: 0, sill: false, lit: 0, t: 0.15 * M });
      if (k % 2 === 0) archWindow(kit, px, 10.2 * M, pz, a, 0.6 * M, 1.5 * M, { kind: 'round', frame: GLAZE, mullions: 0, sill: false, t: 0.12 * M });
      if (kit.detail === 2) { const [sx, sz] = face(px, pz, a).at(0, 0.02 * M); kit.box('stone_dark', sx, 2.4 * M, sz, 0.25 * M, 0.7 * M, 0.06 * M, { ry: a }); }
    }
  }
  kit.add('roof_slate', flat(new THREE.ConeGeometry(r + 0.5 * M, roofH, seg)), { x, y: h + roofH / 2, z });
  if (kit.detail > 0) {
    kit.cyl('metal_dark', x, h + roofH - 0.2 * M, z, 0.05 * M, 1.6 * M, { seg: 4 });
    kit.sphere('paint_yellow', x, h + roofH + 0.6 * M, z, 0.18 * M, { seg: 6 });
  }
}

registerArch('citygate', {
  variants: 1,
  build(ctx) {
    const { kit, detail } = ctx;
    const TR = 3.0 * M, TX = 6.2 * M, TH = 15.5 * M;
    kit.box('pavers', 0, 0, 0, 19.8 * M, 0.08 * M, 9.8 * M);
    kit.box('stone_grey', 0, 0.02 * M, 0, 4.0 * M, 0.08 * M, 9.8 * M);
    // Mittelbau mit Tordurchfahrt (Rundbogen, offen entlang z)
    const CW = 7.4 * M, CD = 7.4 * M, CH = 17.0 * M, AW = 3.6 * M, AH = 5.6 * M;
    const pierW = (CW - AW) / 2;
    for (const s of [-1, 1]) kit.box(BRICK, s * (AW / 2 + pierW / 2), 0, 0, pierW, CH, CD);
    // Bereich über dem Bogen: Platte mit bogenförmigem Ausschnitt
    slab(kit, BRICK, archSpandrel(AW, AH, CH, 'round', 12), CD, { x: 0, y: 0, z: 0 });
    // Fronten (vorn und hinten) mit Bogenrahmen, Inschrift, Blendfenstern, Treppengiebel
    for (const fz of [CD / 2, -CD / 2]) {
      const ry = fz > 0 ? 0 : Math.PI, f = face(0, fz, ry);
      const [ax, az] = f.at(0, 0.12 * M);
      slab(kit, 'stone_sandstone', archRing(AW, AH, 0.6 * M, 'round', 12), 0.25 * M, { x: ax, y: 0, z: az, ry });
      // Glasurbänder
      for (const y of [7.4, 12.2]) { const [bx, bz] = f.at(0, 0.05 * M); kit.box(GLAZE, bx, y * M, bz, CW, 0.5 * M, 0.12 * M, { ry }); }
      // Inschriftband
      const [ix, iz] = f.at(0, 0.1 * M);
      kit.box(GLAZE, ix, 6.2 * M, iz, CW - 0.6 * M, 0.9 * M, 0.12 * M, { ry });
      if (fz > 0) { const [tx, tz] = f.at(0, 0.18 * M); text(kit, 'paint_yellow', 'STADTPULS', tx, 6.38 * M, tz, ry, 0.5 * M, { depth: 0.05 * M }); }
      // Fenster in zwei Reihen
      for (const [y, w, hh] of [[8.4, 0.9, 2.6], [13.0, 0.7, 1.8]]) for (const u of [-2.2, 0, 2.2]) {
        const [px, pz] = f.at(u * M, 0);
        archWindow(kit, px, y * M, pz, ry, w * M, hh * M, { kind: u === 0 ? 'pointed' : 'round', frame: WHITE, mullions: 0, sill: false, t: 0.15 * M });
      }
    }
    kit.box(GLAZE, 0, CH - 0.6 * M, 0, CW + 0.3 * M, 0.6 * M, CD + 0.3 * M);
    // Satteldach mit Giebel nach vorn, Treppengiebel-Zacken
    const RH = 6.0 * M;
    kit.gableRoof('roof_slate', 0, CH, 0, CW, CD, RH, { ridge: 'z', overhang: 0.25 * M });
    for (const fz of [CD / 2 - 0.4 * M, -CD / 2 + 0.4 * M]) {
      kit.gableEnds(BRICK, 0, CH, fz, CW, 0.8 * M, RH, { ridge: 'z' });
      if (detail > 0) {
        const steps = 5;
        for (let k = 0; k < steps; k++) {
          const t = k / steps, w = CW * (1 - t) / 2;
          for (const s of [-1, 1]) kit.box(BRICK, s * (w - 0.3 * M), CH + RH * t, fz, 0.7 * M, RH / steps + 0.5 * M, 0.85 * M);
        }
        kit.box(BRICK, 0, CH + RH - 0.2 * M, fz, 0.8 * M, 1.2 * M, 0.85 * M);
        const ry = fz > 0 ? 0 : Math.PI;
        const [wx, wz] = face(0, fz, ry).at(0, 0.4 * M);
        archWindow(kit, wx, CH + 1.2 * M, wz, ry, 1.0 * M, 2.4 * M, { kind: 'pointed', frame: WHITE, mullions: 0, sill: false, t: 0.15 * M });
      }
    }
    // Zwei Rundtürme
    for (const s of [-1, 1]) roundTower(kit, s * TX, 0.2 * M, TR, TH, 7.0 * M);
    // Anschließende Stadtmauer mit Zinnen
    for (const s of [-1, 1]) {
      const x0 = s * (TX + TR - 0.2 * M), x1 = s * 9.9 * M;
      kit.box(BRICK, (x0 + x1) / 2, 0, -1.2 * M, Math.abs(x1 - x0), 6.0 * M, 1.6 * M);
      if (detail > 0) for (let x = Math.min(x0, x1) + 0.3 * M; x < Math.max(x0, x1) - 0.2 * M; x += 0.9 * M) kit.box(BRICK, x, 6.0 * M, -1.2 * M, 0.5 * M, 0.7 * M, 1.6 * M);
    }
    crowd(kit, 0, 0, 3.2 * M, 9.0 * M, 6);
    crowd(kit, 0, 4.2 * M, 12 * M, 1.2 * M, 4);
    // Laternen und Bänke vor dem Tor
    if (detail > 0) {
      for (const s of [-1, 1]) { lamp(kit, s * 2.6 * M, 4.4 * M, 3.8 * M, { style: 'old' }); bench(kit, s * 6.2 * M, 4.2 * M, Math.PI); }
      kit.light(0, AH - 0.5 * M, 0, 0xffd79a, 0.6);
    }
    return kit.build();
  },
});

// Holländer-Windmühle: gemauerter Sockel, Galerie, achteckiger Schaft mit Schindeln, drehbare Kappe, vier Flügel
registerArch('windmill', {
  variants: 1,
  build(ctx) {
    const { kit, detail } = ctx;
    const seg8 = 8;
    kit.box('grass', 0, 0, 0, 9.8 * M, 0.06 * M, 9.8 * M);
    kit.box('gravel', 0, 0.02 * M, 3.6 * M, 2.0 * M, 0.06 * M, 2.6 * M);
    const MZ = 0;
    // Sockel (Backstein, achteckig)
    const BH = 5.2 * M, R0 = 3.2 * M;
    kit.add(BRICK, flat(new THREE.CylinderGeometry(R0 - 0.2 * M, R0, BH, seg8)), { x: 0, y: BH / 2, z: MZ, ry: Math.PI / 8 });
    if (detail > 0) {
      kit.box('door_wood', 0, 0, MZ + R0 * Math.cos(Math.PI / 8) - 0.05 * M, 1.4 * M, 2.4 * M, 0.3 * M);
      kit.box(WHITE, 0, 2.4 * M, MZ + R0 * Math.cos(Math.PI / 8) - 0.02 * M, 1.8 * M, 0.25 * M, 0.3 * M);
      for (let k = 1; k < 8; k += 2) {
        const a = (k / 8) * Math.PI * 2;
        kit.window(Math.sin(a) * (R0 - 0.15 * M) * Math.cos(Math.PI / 8), 2.8 * M, MZ + Math.cos(a) * (R0 - 0.15 * M) * Math.cos(Math.PI / 8), a, 0.8 * M, 1.0 * M, { frame: WHITE });
      }
    }
    // Galerie (Stelling) mit Geländer und Streben
    const GY = BH;
    kit.add('wood_planks', flat(new THREE.CylinderGeometry(R0 + 1.2 * M, R0 + 1.2 * M, 0.25 * M, seg8)), { x: 0, y: GY + 0.12 * M, z: MZ, ry: Math.PI / 8 });
    if (detail > 0) {
      const pts = [];
      for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; pts.push([Math.sin(a) * (R0 + 1.1 * M), MZ + Math.cos(a) * (R0 + 1.1 * M)]); }
      railing(kit, pts, GY + 0.25 * M, 1.0 * M, { mat: 'wood_dark', spacing: 0.9 * M });
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        beam(kit, 'wood_dark', [Math.sin(a) * (R0 - 0.4 * M), GY - 1.8 * M, MZ + Math.cos(a) * (R0 - 0.4 * M)], [Math.sin(a) * (R0 + 1.0 * M), GY, MZ + Math.cos(a) * (R0 + 1.0 * M)], 0.15 * M);
      }
    }
    // Achteckiger, verjüngter Schaft mit Holzschindeln
    const SH = 9.0 * M, R1 = 2.2 * M;
    kit.add('wood_dark', flat(new THREE.CylinderGeometry(R1, R0 - 0.3 * M, SH, seg8)), { x: 0, y: GY + SH / 2, z: MZ, ry: Math.PI / 8 });
    if (detail > 0) {
      for (const t of [0.33, 0.66]) {
        const rr = (R0 - 0.3 * M) + (R1 - (R0 - 0.3 * M)) * t + 0.05 * M;
        kit.add('wood_planks', flat(new THREE.CylinderGeometry(rr, rr + 0.03 * M, 0.3 * M, seg8)), { x: 0, y: GY + SH * t, z: MZ, ry: Math.PI / 8 });
      }
      // Fenster und Tür zur Galerie
      kit.box('door_wood', 0, GY + 0.25 * M, MZ + (R0 - 0.3 * M) * Math.cos(Math.PI / 8) - 0.05 * M, 1.0 * M, 2.0 * M, 0.25 * M);
      kit.window(0, GY + 5.0 * M, MZ + ((R0 - 0.3 * M) * 0.45 + R1 * 0.55) * Math.cos(Math.PI / 8), 0.08, 0.7 * M, 0.9 * M, { frame: WHITE });
    }
    // Kappe (bootförmig) mit Steert
    const CY = GY + SH;
    kit.add('plaster_white', flat(new THREE.CylinderGeometry(R1 + 0.2 * M, R1 + 0.2 * M, 0.4 * M, seg8)), { x: 0, y: CY + 0.2 * M, z: MZ, ry: Math.PI / 8 });
    kit.prism('roof_tiles_brown', [[-R1 - 0.1 * M, 0], [R1 + 0.1 * M, 0], [R1 * 0.6, 1.4 * M], [0, 2.3 * M], [-R1 * 0.6, 1.4 * M]], R1 * 2.6, { x: 0, y: CY + 0.4 * M, z: MZ - 0.2 * M });
    if (detail > 0) {
      beam(kit, 'wood_dark', [0, CY + 1.2 * M, MZ - R1], [0, GY + 1.3 * M, MZ - R0 - 1.0 * M], 0.3 * M);
      kit.cyl('wood_dark', 0.12 * M, GY + 1.3 * M, MZ - R0 - 1.0 * M, 0.6 * M, 0.25 * M, { rz: Math.PI / 2, seg: 10 });
    }
    // Wellkopf (Achse) nach vorn
    const HUB = [0, CY + 1.3 * M, MZ + R1 + 1.0 * M];
    kit.cyl('wood_dark', 0, HUB[1], MZ + R1 - 0.6 * M, 0.35 * M, 1.6 * M, { rx: Math.PI / 2, seg: 8 });
    // Müllerhaus und Mehlsäcke
    hut(kit, 3.7 * M, 3.8 * M, -Math.PI / 2, 2.0 * M, 2.2 * M, 2.2 * M, { wall: 'plaster_cream', roof: 'roof_tiles_red' });
    if (detail === 2) {
      for (let k = 0; k < 4; k++) kit.add('canvas_white', new THREE.SphereGeometry(0.3 * M, 6, 4), { x: -1.6 * M + (k % 2) * 0.5 * M, y: 0.3 * M + Math.floor(k / 2) * 0.4 * M, z: 3.0 * M, sy: 0.7 });
      kit.box('wood_planks', -2.6 * M, 0, 3.4 * M, 1.4 * M, 0.5 * M, 0.9 * M);
      tree(kit, -3.8 * M, -4.0 * M, 0.7, 'round');
      bench(kit, -1.2 * M, 4.4 * M, Math.PI);
      lamp(kit, 1.2 * M, 4.4 * M, 3.2 * M, { style: 'old' });
      kit.fence(0, 4.85 * M, 9.4 * M, 0, 'wood_planks', 0.8 * M);
    }
    const res = kit.build();
    // Vier Flügel mit Gitter und Segeltuch (drehen sich um die z-Achse)
    addAnim(ctx, res, [HUB[0], HUB[1], HUB[2] + 0.2 * M], 'z', 0.7, (k) => {
      const L = 8.6 * M;
      k.cyl('wood_dark', 0, 0, -0.5 * M, 0.5 * M, 0.7 * M, { rx: Math.PI / 2, seg: 8 });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.3;
        const c = Math.cos(a), s = Math.sin(a);
        // Rute
        beam(k, 'wood_dark', [0, 0, 0], [c * L, s * L, 0], 0.3 * M, 0.3 * M);
        // Gatter (Gitterrahmen auf einer Seite der Rute)
        const nx = -s, ny = c, W = 1.8 * M;
        const r0 = 1.6 * M;
        beam(k, 'wood_planks', [c * r0 + nx * W, s * r0 + ny * W, 0.05 * M], [c * L + nx * W, s * L + ny * W, 0.05 * M], 0.12 * M, 0.12 * M);
        const bars = k.detail === 2 ? 9 : k.detail === 1 ? 5 : 2;
        for (let j = 0; j <= bars; j++) {
          const r = r0 + ((L - r0) * j) / bars;
          beam(k, 'wood_planks', [c * r, s * r, 0.05 * M], [c * r + nx * W, s * r + ny * W, 0.05 * M], 0.1 * M, 0.1 * M);
        }
        // Segeltuch über einen Teil der Fläche
        const r1 = r0 + (L - r0) * 0.12;
        k.add('canvas_white', new THREE.BoxGeometry(L - r1 - 0.4 * M, W * 0.92, 0.02 * M), { x: c * ((L + r1) / 2) + nx * W * 0.5, y: s * ((L + r1) / 2) + ny * W * 0.5, z: 0.08 * M, rz: a });
      }
    });
    return res;
  },
});
void lathe;
