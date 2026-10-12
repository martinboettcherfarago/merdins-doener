// Mêrdîn’s Dönerpalast (1 × 1): dunkle Fassade, gelbes „M"-Leuchtschild, Terrasse mit Sonnenschirmen
// und ein riesiger Chili-Cheese-Dönerspieß auf dem Dach, der sich dreht (res.anim). Besitzer: G6.
import { registerArch } from './index.js';
import { M } from './kit.js';
import { obox, beam, lathe, archWindow, railing, lamp, tree, addAnim, flat, face, person } from './lm_parts.js';
import { text } from './lm_text.js';
import * as THREE from 'three';

const DARK = 'trim_dark', FRAME = 'metal_dark', GOLD = 'paint_yellow', NEON = 'neon_yellow';

function terraceTable(kit, x, z) {
  kit.cyl(FRAME, x, 0, z, 0.06 * M, 0.75 * M, { seg: 5 });
  kit.cyl('wood_dark', x, 0.72 * M, z, 0.45 * M, 0.05 * M, { seg: 10 });
  if (kit.detail < 2) return;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    const cx = x + Math.cos(a) * 0.75 * M, cz = z + Math.sin(a) * 0.75 * M;
    kit.box('wood_planks', cx, 0.42 * M, cz, 0.42 * M, 0.05 * M, 0.42 * M, { ry: -a - Math.PI / 2 });
    kit.box(FRAME, x + Math.cos(a) * 0.95 * M, 0, z + Math.sin(a) * 0.95 * M, 0.4 * M, 0.85 * M, 0.04 * M, { ry: -a - Math.PI / 2 });
  }
  // Sonnenschirm
  kit.cyl(FRAME, x, 0.75 * M, z, 0.03 * M, 1.6 * M, { seg: 4 });
  kit.cone('awning_yellow', x, 2.2 * M, z, 1.35 * M, 0.55 * M, { seg: 8 });
  kit.cyl('awning_yellow', x, 2.1 * M, z, 1.35 * M, 0.12 * M, { seg: 8, open: true });
}

registerArch('doener', {
  variants: 1,
  build(ctx) {
    const { kit, detail } = ctx;
    const BW = 8.4 * M, BD = 6.2 * M, ZF = 1.4 * M, ZC = ZF - BD / 2; // Front bei z = ZF
    const G1 = 3.7 * M, G2 = 3.1 * M, H = G1 + G2;
    // --- Grundstück: Terrasse aus Pflaster, seitlich Rasenstreifen
    kit.box('pavers', 0, 0, 0, 9.8 * M, 0.08 * M, 9.8 * M);
    kit.box('stone_dark', 0, 0, ZF + 0.6 * M, BW + 0.6 * M, 0.1 * M, 1.2 * M);
    // --- Baukörper
    kit.box(DARK, 0, 0, ZC, BW, H, BD);
    kit.box('brick_dark', -BW / 2 + 0.01 * M, 0.5 * M, ZC - 0.2 * M, 0.04 * M, H - 0.5 * M, BD - 0.6 * M);
    kit.box('brick_dark', BW / 2 - 0.01 * M, 0.5 * M, ZC - 0.2 * M, 0.04 * M, H - 0.5 * M, BD - 0.6 * M);
    kit.box('stone_dark', 0, 0, ZC, BW + 0.12 * M, 0.45 * M, BD + 0.12 * M);
    // Gesimse in Gold
    kit.box(GOLD, 0, G1 - 0.05 * M, ZC, BW + 0.3 * M, 0.18 * M, BD + 0.3 * M);
    kit.box(GOLD, 0, H, ZC, BW + 0.4 * M, 0.22 * M, BD + 0.4 * M);
    kit.box(DARK, 0, H + 0.22 * M, ZC, BW + 0.2 * M, 0.55 * M, BD + 0.2 * M);
    // Markenname auf der Attika
    text(kit, NEON, 'MÊRDÎNS', 0, H + 0.3 * M, ZF + 0.16 * M, 0, 0.36 * M, { depth: 0.05 * M });
    // Zinnen-Ornament auf der Attika (Palast)
    if (detail > 0) {
      const n = 9;
      for (let k = 0; k < n; k++) {
        const x = -BW / 2 + 0.45 * M + (k * (BW - 0.9 * M)) / (n - 1);
        kit.box(GOLD, x, H + 0.77 * M, ZF + 0.03 * M, 0.42 * M, 0.32 * M, 0.25 * M);
        if (detail === 2) kit.cone(GOLD, x, H + 1.09 * M, ZF + 0.03 * M, 0.2 * M, 0.3 * M, { seg: 4 });
      }
    }
    // Ecktürmchen mit goldenen Kuppeln
    for (const s of [-1, 1]) {
      const x = s * (BW / 2 - 0.15 * M), z = ZF - 0.1 * M;
      kit.cyl(DARK, x, 0.45 * M, z, 0.42 * M, H + 1.3 * M - 0.45 * M, { seg: detail === 2 ? 8 : 6 });
      kit.cyl(GOLD, x, H + 1.25 * M, z, 0.52 * M, 0.16 * M, { seg: 8 });
      lathe(kit, GOLD, x, H + 1.4 * M, z, [[0.5 * M, 0], [0.58 * M, 0.35 * M], [0.42 * M, 0.8 * M], [0.12 * M, 1.15 * M], [0.02 * M, 1.5 * M]], detail === 2 ? 10 : 6);
      if (detail === 2) {
        kit.cyl(GOLD, x, H + 2.9 * M, z, 0.03 * M, 0.5 * M, { seg: 4 });
        kit.sphere(NEON, x, H + 3.45 * M, z, 0.1 * M, { seg: 6 });
        for (const yy of [1.6 * M, 4.6 * M]) kit.cyl(GOLD, x, yy, z, 0.45 * M, 0.1 * M, { seg: 8 });
      }
    }
    // --- Erdgeschoss: Schaufensterfront
    const sfW = BW - 1.6 * M, sfH = 2.6 * M;
    kit.box('glass_shop', -0.5 * M, 0.5 * M, ZF + 0.02 * M, sfW - 1.2 * M, sfH, 0.05 * M, { lit: 0.97 });
    kit.box('glass_shop', sfW / 2 - 0.55 * M, 0.45 * M, ZF + 0.02 * M, 1.3 * M, 2.4 * M, 0.06 * M, { lit: 0.97 });
    if (detail > 0) {
      for (const x of [-sfW / 2 - 0.1 * M, -1.8 * M, 0.8 * M, sfW / 2 - 1.25 * M, sfW / 2 + 0.15 * M]) kit.box(FRAME, x, 0.45 * M, ZF + 0.06 * M, 0.14 * M, sfH + 0.15 * M, 0.1 * M);
      kit.box(FRAME, 0, 0.45 * M, ZF + 0.06 * M, sfW + 0.3 * M, 0.14 * M, 0.12 * M);
      kit.box(FRAME, 0, 0.5 * M + sfH, ZF + 0.06 * M, sfW + 0.3 * M, 0.14 * M, 0.12 * M);
    }
    // Türkis-weiß gestreifter Sockel unter dem Schaufenster (wie die Theke im Laden)
    if (detail === 2) for (let k = 0; k < 30; k++) kit.box(k % 2 ? 'paint_white' : 'roof_copper', -sfW / 2 + 0.1 * M + k * ((sfW - 1.4 * M) / 30), 0.08 * M, ZF + 0.08 * M, (sfW - 1.4 * M) / 30, 0.36 * M, 0.04 * M);
    // Blende mit Schriftzug
    kit.box(GOLD, 0, 3.2 * M, ZF + 0.12 * M, BW - 1.2 * M, 0.52 * M, 0.2 * M);
    text(kit, DARK, 'DÖNERPALAST', 0, 3.27 * M, ZF + 0.24 * M, 0, 0.36 * M, { depth: 0.06 * M, weight: 1 });
    // Vordach mit Downlights
    if (detail > 0) {
      kit.box(FRAME, 0, 3.0 * M, ZF + 0.6 * M, BW - 1.0 * M, 0.12 * M, 1.1 * M);
      if (detail === 2) for (const x of [-3, -1.5, 0, 1.5, 3]) kit.box(NEON, x * M, 2.97 * M, ZF + 0.8 * M, 0.25 * M, 0.04 * M, 0.25 * M);
      for (const s of [-1, 1]) beam(kit, FRAME, [s * 3.2 * M, 3.1 * M, ZF + 1.1 * M], [s * 3.2 * M, 3.7 * M, ZF + 0.02 * M], 0.06 * M);
    }
    // --- Obergeschoss: Spitzbogenfenster mit Goldrahmen, Mitte das runde M-Schild
    for (const x of [-3.0 * M, -1.85 * M, 1.85 * M, 3.0 * M]) archWindow(kit, x, G1 + 0.55 * M, ZF, 0, 0.8 * M, 1.85 * M, { kind: 'pointed', frame: GOLD, glass: 'glass_shop', t: 0.12 * M, mullions: 0, sill: true, sillMat: GOLD });
    // Rundes Leuchtschild mit großem „M"
    const sy = G1 + 1.45 * M, sz = ZF + 0.25 * M, R = 1.25 * M;
    kit.cyl(DARK, 0, sy, ZF, R + 0.1 * M, 0.3 * M, { rx: Math.PI / 2, seg: detail === 2 ? 28 : 12 });
    if (detail > 0) {
      const ring = new THREE.TorusGeometry(R - 0.02 * M, 0.08 * M, 4, detail === 2 ? 32 : 16);
      kit.add(NEON, ring, { x: 0, y: sy, z: sz + 0.06 * M });
      const ring2 = new THREE.TorusGeometry(R + 0.12 * M, 0.06 * M, 4, detail === 2 ? 32 : 16);
      kit.add(GOLD, ring2, { x: 0, y: sy, z: sz - 0.02 * M });
    }
    text(kit, NEON, 'M', 0, sy - 0.75 * M, sz + 0.08 * M, 0, 1.5 * M, { depth: 0.14 * M, weight: 1.15, lod: true });
    // Seitlicher Ausleger mit „M" (zur Straße sichtbar)
    if (detail > 0) {
      const ax = BW / 2 + 0.55 * M, az = ZF - 0.4 * M;
      beam(kit, FRAME, [BW / 2, G1 + 2.2 * M, az], [ax + 0.4 * M, G1 + 2.2 * M, az], 0.08 * M);
      kit.box(DARK, ax, G1 + 0.8 * M, az, 0.18 * M, 1.3 * M, 1.0 * M);
      kit.box(GOLD, ax, G1 + 0.75 * M, az, 0.2 * M, 0.06 * M, 1.06 * M);
      kit.box(GOLD, ax, G1 + 2.1 * M, az, 0.2 * M, 0.06 * M, 1.06 * M);
      for (const s of [-1, 1]) text(kit, NEON, 'M', ax + s * 0.1 * M, G1 + 1.08 * M, az, s * Math.PI / 2, 0.75 * M, { depth: 0.04 * M, weight: 1.1 });
    }
    // Seitenfenster
    for (const s of [-1, 1]) {
      const f = face(s * BW / 2, ZC, s * Math.PI / 2);
      for (const u of [-1.4 * M, 1.4 * M]) {
        const [x, z] = f.at(u, 0);
        archWindow(kit, x, G1 + 0.6 * M, z, f.ry, 0.75 * M, 1.7 * M, { kind: 'pointed', frame: GOLD, glass: 'glass_shop', t: 0.1 * M, mullions: 0 });
      }
    }
    // --- Dach: Technik und Dönergrill
    const RY = H + 0.22 * M, gz = ZC - 0.6 * M;
    kit.box('roof_flat_membrane', 0, RY, ZC, BW - 0.2 * M, 0.06 * M, BD - 0.2 * M);
    if (detail > 0) {
      kit.box('metal_light', -2.8 * M, RY, ZC - 2.1 * M, 1.4 * M, 0.9 * M, 1.0 * M);
      kit.cyl('metal_light', 2.9 * M, RY, ZC - 2.0 * M, 0.28 * M, 2.2 * M, { seg: 8 });
      kit.cone('metal_light', 2.9 * M, RY + 2.2 * M, ZC - 2.0 * M, 0.42 * M, 0.3 * M, { seg: 8 });
    }
    // Sockel des Spießes (Drehteller) und gebogene Grillwand mit glühenden Heizstäben
    kit.cyl('metal_light', 0, RY, gz, 1.0 * M, 0.5 * M, { seg: detail === 2 ? 18 : 10 });
    kit.cyl(FRAME, 0, RY + 0.5 * M, gz, 0.85 * M, 0.12 * M, { seg: detail === 2 ? 18 : 10 });
    const wallSeg = detail === 2 ? 10 : 5;
    const GR = 2.25 * M, span = Math.PI - 1.3;
    for (let k = 0; k < wallSeg; k++) {
      const a = Math.PI + 0.65 + (k + 0.5) * (span / wallSeg);
      const x = Math.cos(a) * GR, z = gz + Math.sin(a) * GR;
      const w = (GR * span) / wallSeg + 0.02 * M;
      kit.box('metal_light', x, RY + 0.4 * M, z, w, 3.6 * M, 0.12 * M, { ry: -a - Math.PI / 2 });
      const [ix, iz] = face(x, z, -a - Math.PI / 2).at(0, 0.08 * M);
      for (let r = 0; r < 3; r++) kit.box('emissive_red', ix, RY + (1.0 + r * 1.0) * M, iz, w * 0.75, 0.55 * M, 0.04 * M, { ry: -a - Math.PI / 2 });
    }
    if (detail > 0) kit.light(0, RY + 2.4 * M, gz + 1.0 * M, 0xff9a40, 0.9);
    // Riesiges Messer an der Grillwand
    if (detail === 2) {
      beam(kit, 'metal_light', [2.0 * M, RY + 0.5 * M, gz + 0.3 * M], [2.4 * M, RY + 3.4 * M, gz + 0.5 * M], 0.5 * M, 0.04 * M);
      beam(kit, 'wood_dark', [2.4 * M, RY + 3.4 * M, gz + 0.5 * M], [2.5 * M, RY + 4.2 * M, gz + 0.55 * M], 0.2 * M, 0.2 * M);
    }
    // --- Terrasse vor dem Laden
    for (const [x, z] of [[-2.6 * M, ZF + 2.4 * M], [0.4 * M, ZF + 2.6 * M], [3.0 * M, ZF + 2.4 * M]]) terraceTable(kit, x, z);
    if (detail > 0) {
      for (const s of [-1, 1]) {
        kit.box('concrete_dark', s * 4.5 * M, 0, ZF + 2.0 * M, 0.7 * M, 0.55 * M, 3.4 * M);
        kit.box('hedge', s * 4.5 * M, 0.55 * M, ZF + 2.0 * M, 0.6 * M, 0.5 * M, 3.3 * M);
      }
      // Lichterkette über der Terrasse
      if (detail === 2) {
        for (const s of [-1, 1]) kit.cyl(FRAME, s * 4.5 * M, 1.0 * M, ZF + 3.6 * M, 0.04 * M, 2.0 * M, { seg: 4 });
        for (let k = 0; k <= 10; k++) {
          const t = k / 10, x = -4.5 * M + t * 9 * M, sag = Math.sin(t * Math.PI) * 0.35 * M;
          kit.sphere(NEON, x, 3.0 * M - sag, ZF + 3.6 * M - (1 - Math.abs(t - 0.5) * 2) * 0.1 * M, 0.07 * M, { seg: 4 });
        }
        for (let k = 0; k < 10; k++) {
          const t0 = k / 10, t1 = (k + 1) / 10;
          beam(kit, FRAME, [-4.5 * M + t0 * 9 * M, 3.0 * M - Math.sin(t0 * Math.PI) * 0.35 * M, ZF + 3.6 * M], [-4.5 * M + t1 * 9 * M, 3.0 * M - Math.sin(t1 * Math.PI) * 0.35 * M, ZF + 3.6 * M], 0.015 * M);
        }
        // Speisekarten-Aufsteller
        kit.box(DARK, -0.9 * M, 0, ZF + 4.4 * M, 0.7 * M, 1.1 * M, 0.08 * M, { rx: 0.15 });
        kit.box(GOLD, -0.9 * M, 0.75 * M, ZF + 4.47 * M, 0.5 * M, 0.2 * M, 0.02 * M, { rx: 0.15 });
      }
      railing(kit, [[-4.2 * M, ZF + 4.9 * M], [-1.5 * M, ZF + 4.9 * M]], 0, 0.9 * M, { mat: FRAME, spacing: 1.0 * M });
      railing(kit, [[1.5 * M, ZF + 4.9 * M], [4.2 * M, ZF + 4.9 * M]], 0, 0.9 * M, { mat: FRAME, spacing: 1.0 * M });
    }
    if (detail === 2) {
      for (const [x, z] of [[-2.6, 2.4], [0.4, 2.6], [3.0, 2.4]]) for (const a of [0.4, 3.5]) person(kit, (x + Math.cos(a) * 0.75) * M, ZF + (z + Math.sin(a) * 0.75) * M, { sit: true, y0: 0.05 * M });
      for (let k = 0; k < 4; k++) person(kit, (2.9 - k * 0.15) * M, ZF + (0.9 + k * 0.6) * M, { ry: Math.PI });
      person(kit, 1.9 * M, ZF + 0.5 * M, { shirt: 'paint_yellow' });
    }
    if (detail === 2) { tree(kit, -4.4 * M, -4.2 * M, 0.7, 'round'); lamp(kit, 4.6 * M, ZF + 4.6 * M, 3.8 * M, { style: 'old', head: NEON }); }
    const res = kit.build();
    // --- Animiert: Chili-Cheese-Dönerspieß (dreht sich um die Hochachse)
    addAnim(ctx, res, [0, RY + 0.62 * M, gz], 'y', 0.9, (k) => {
      const S = 1.3 * M;
      const seg = detail === 2 ? 18 : detail === 1 ? 10 : 7;
      // Fleischkegel: breit oben, schmal unten, leicht unregelmäßig
      const prof = [[0.45, 0], [0.62, 0.3], [0.78, 0.9], [0.92, 1.6], [1.02, 2.3], [1.08, 2.9], [1.02, 3.3], [0.75, 3.55], [0.3, 3.7], [0.05, 3.72]];
      k.add('dirt', new THREE.LatheGeometry(prof.map(([r, h]) => new THREE.Vector2(r * S, h * S)), seg), {});
      // Angegrillte Kruste (dunkle Streifen) und Käsekragen
      if (detail > 0) {
        k.add('bark', new THREE.LatheGeometry([[0.94, 1.7], [1.05, 2.4], [1.1, 2.95], [1.04, 3.3]].map(([r, h]) => new THREE.Vector2(r * S + 0.02 * S, h * S)), seg, 0.3, 1.2), {});
        k.add('bark', new THREE.LatheGeometry([[0.64, 0.4], [0.8, 0.95], [0.94, 1.6]].map(([r, h]) => new THREE.Vector2(r * S + 0.02 * S, h * S)), seg, 3.4, 1.0), {});
        // Käsehaube oben mit Tropfen
        k.add('paint_yellow', new THREE.LatheGeometry([[0.98, 3.2], [1.06, 3.32], [0.82, 3.6], [0.35, 3.78], [0.05, 3.8]].map(([r, h]) => new THREE.Vector2(r * S, h * S)), seg), {});
        const drips = detail === 2 ? 16 : 8;
        for (let i = 0; i < drips; i++) {
          const a = (i / drips) * Math.PI * 2 + 0.2;
          const len = (0.5 + ((i * 37) % 7) / 7 * 1.3) * S;
          const r = 1.06 * S;
          k.add('paint_yellow', new THREE.CylinderGeometry(0.11 * S, 0.06 * S, len, 5), { x: Math.cos(a) * r, y: 3.25 * S - len / 2, z: Math.sin(a) * r });
          if (detail === 2) k.sphere('paint_yellow', Math.cos(a) * r, 3.25 * S - len, Math.sin(a) * r, 0.1 * S, { seg: 5 });
        }
        // Chili-Soße und Chilischoten
        const chili = detail === 2 ? 22 : 8;
        for (let i = 0; i < chili; i++) {
          const a = i * 2.39996, hh = 0.5 + ((i * 53) % 29) / 29 * 2.6;
          const rr = (0.62 + (hh / 2.9) * 0.44) * S;
          const geo = new THREE.SphereGeometry(0.11 * S, 5, 4);
          k.add(i % 3 === 0 ? 'paint_orange' : 'paint_red', geo, { x: Math.cos(a) * rr, y: hh * S, z: Math.sin(a) * rr, sx: 1, sy: 0.6, sz: 1.6, ry: -a });
        }
        if (detail === 2) for (let i = 0; i < 4; i++) {
          const a = i * 1.7 + 0.5;
          k.add('paint_green', flat(new THREE.ConeGeometry(0.12 * S, 0.7 * S, 5)), { x: Math.cos(a) * 0.55 * S, y: 3.95 * S, z: Math.sin(a) * 0.55 * S, rx: Math.PI / 2 + 0.3, ry: -a });
        }
      }
      // Spieß und Deckelplatte
      k.cyl('metal_light', 0, -0.1 * S, 0, 0.07 * S, 4.6 * S, { seg: 6 });
      k.cyl('metal_light', 0, 3.8 * S, 0, 0.55 * S, 0.08 * S, { seg: 10 });
      k.cyl('metal_light', 0, 0, 0, 0.62 * S, 0.08 * S, { seg: 10 });
    });
    return res;
  },
});
