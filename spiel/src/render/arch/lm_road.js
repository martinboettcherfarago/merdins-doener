// Verkehrsbauten Straße und Wasser: Busdepot (2 × 2), Parkhaus (1 × 1), Taxizentrale (1 × 1), Fähranleger (1 × 1).
// Besitzer: G6.
import * as THREE from 'three';
import { registerArch } from './index.js';
import { M } from './kit.js';
import { beam, railing, glassRail, lamp, bench, tree, flag, face, bus, car, hut, bollard, planter } from './lm_parts.js';
import { text } from './lm_text.js';

const CAR_COLORS = ['paint_red', 'paint_blue', 'paint_white', 'metal_dark', 'paint_yellow', 'metal_light', 'paint_green', 'siding_blue'];

// Parkmarkierungen (weiße Linien) in einer Reihe
function stalls(kit, x0, x1, z, depth, n) {
  if (kit.detail === 0) return;
  for (let k = 0; k <= n; k++) kit.box('paint_white', x0 + ((x1 - x0) * k) / n, 0.08 * M, z, 0.12 * M, 0.02 * M, depth);
}

registerArch('bus_depot', {
  variants: 2,
  build(ctx) {
    const { kit, detail, variant } = ctx;
    const BUS = variant ? 'paint_blue' : 'paint_yellow';
    kit.box('asphalt', 0, 0, 0, 19.8 * M, 0.06 * M, 19.8 * M);
    // --- Wagenhalle mit Sägezahndach und vier Toren
    const HZ = -4.4 * M, HW = 19.0 * M, HD = 10.6 * M, HH = 6.4 * M;
    kit.box('brick_red', 0, 0, HZ, HW, HH, HD);
    kit.box('concrete', 0, 0, HZ, HW + 0.2 * M, 0.5 * M, HD + 0.2 * M);
    kit.band('concrete', 0, HZ, HW, HD, HH - 0.5 * M, 0.5 * M, 0.12 * M);
    kit.sawtoothRoof('metal_corrugated', 'glass_skylight', 0, HH, HZ, HW, HD, 4, 2.0 * M);
    const gates = 4, gw = 3.4 * M, gh = 4.6 * M;
    for (let k = 0; k < gates; k++) {
      const x = -HW / 2 + (HW / gates) * (k + 0.5);
      const open = k === 1 || k === 2;
      kit.box('concrete', x, gh, HZ + HD / 2 + 0.08 * M, gw + 0.6 * M, 0.5 * M, 0.2 * M);
      if (open) {
        kit.box('asphalt_dark', x, 0.05 * M, HZ + HD / 2 - 0.02 * M, gw, gh - 0.05 * M, 0.06 * M);
        bus(kit, x, HZ + HD / 2 - 6.2 * M, 0, BUS);
      } else kit.box('metal_corrugated', x, 0, HZ + HD / 2 + 0.03 * M, gw, gh, 0.08 * M);
      if (detail > 0) { kit.box('metal_dark', x - gw / 2 - 0.1 * M, 0, HZ + HD / 2 + 0.06 * M, 0.2 * M, gh, 0.2 * M); kit.box('metal_dark', x + gw / 2 + 0.1 * M, 0, HZ + HD / 2 + 0.06 * M, 0.2 * M, gh, 0.2 * M); }
      if (detail > 0) kit.box('emissive_warm', x, gh + 0.55 * M, HZ + HD / 2 + 0.2 * M, 0.6 * M, 0.15 * M, 0.15 * M);
    }
    kit.windows('left', 0, HZ, HW, HD, 0.5 * M, 1, HH - 0.5 * M, { winW: 2.0 * M, winH: 2.4 * M, spacing: 3.0 * M, frame: 'window_frame_dark' });
    kit.windows('right', 0, HZ, HW, HD, 0.5 * M, 1, HH - 0.5 * M, { winW: 2.0 * M, winH: 2.4 * M, spacing: 3.0 * M, frame: 'window_frame_dark' });
    kit.box('concrete', 0, HH - 1.6 * M, HZ + HD / 2 + 0.12 * M, 8.0 * M, 1.0 * M, 0.2 * M);
    text(kit, 'paint_white', 'BUSDEPOT', 0, HH - 1.45 * M, HZ + HD / 2 + 0.25 * M, 0, 0.6 * M, { depth: 0.05 * M });
    // --- Hof: Abstellplätze, drei Busse, Ladestation mit Pantographen
    const YZ = 5.4 * M;
    stalls(kit, -9.0 * M, 3.0 * M, YZ, 7.4 * M, 3);
    for (let k = 0; k < 3; k++) {
      const x = -7.0 * M + k * 4.0 * M;
      if (k < 2 || variant) bus(kit, x, YZ - 0.4 * M, 0, k === 1 ? 'paint_red' : BUS);
      if (detail > 0) {
        kit.box('metal_light', x - 1.7 * M, 0, YZ - 4.2 * M, 0.3 * M, 4.4 * M, 0.3 * M);
        beam(kit, 'metal_light', [x - 1.7 * M, 4.3 * M, YZ - 4.2 * M], [x, 4.3 * M, YZ - 4.2 * M], 0.2 * M);
        kit.box('metal_dark', x, 3.6 * M, YZ - 4.2 * M, 1.2 * M, 0.7 * M, 0.5 * M);
      }
    }
    // --- Tankstelle / Waschanlage
    kit.box('concrete', 6.6 * M, 0, 4.6 * M, 5.6 * M, 0.2 * M, 8.0 * M);
    for (const [x, z] of [[4.4, 1.2], [8.8, 1.2], [4.4, 8.0], [8.8, 8.0]]) kit.cyl('metal_light', x * M, 0.2 * M, z * M, 0.16 * M, 4.6 * M, { seg: 6 });
    kit.box('paint_white', 6.6 * M, 4.8 * M, 4.6 * M, 5.8 * M, 0.5 * M, 7.8 * M);
    kit.box(variant ? 'paint_blue' : 'paint_yellow', 6.6 * M, 4.8 * M, 4.6 * M, 5.9 * M, 0.25 * M, 7.9 * M);
    if (detail > 0) {
      kit.box('emissive_warm', 6.6 * M, 4.75 * M, 4.6 * M, 4.0 * M, 0.04 * M, 6.0 * M);
      for (const z of [3.0, 6.2]) { kit.box('metal_panel_white', 6.6 * M, 0.2 * M, z * M, 0.6 * M, 1.6 * M, 0.9 * M); kit.box('glass_window', 6.92 * M, 1.1 * M, z * M, 0.02 * M, 0.4 * M, 0.5 * M, { lit: 1 }); }
      // Waschbürsten
      for (const z of [8.6]) for (const x of [5.2, 8.0]) kit.cyl('paint_blue', x * M, 0.2 * M, z * M, 0.5 * M, 3.0 * M, { seg: 8 });
    }
    // --- Verwaltung (zweigeschossig) vorn links
    hut(kit, -8.0 * M, 8.2 * M, 0, 3.4 * M, 2.6 * M, 3.0 * M, { wall: 'plaster_grey', roof: 'roof_flat_membrane', door: true, gable: false, rh: 0.3 * M });
    if (detail > 0) {
      kit.window(-8.8 * M, 1.0 * M, 9.52 * M, 0, 1.2 * M, 1.3 * M, { frame: 'window_frame_dark' });
      for (const x of [-2.2, 2.2]) lamp(kit, x * M, 9.4 * M, 5.0 * M);
      flag(kit, 1.0 * M, 9.6 * M, 6.0 * M, variant ? 'paint_blue' : 'paint_yellow');
    }
    return kit.build();
  },
});

registerArch('parking', {
  variants: 2,
  build(ctx) {
    const { kit, detail, variant, rng } = ctx;
    const LV = 5, LH = 2.9 * M, W = 9.6 * M, D = 9.6 * M;
    kit.box('concrete', 0, 0, 0, 9.8 * M, 0.08 * M, 9.8 * M);
    // Kern: Rampe im hinteren Bereich, Treppenhaus mit Glas vorn rechts
    for (let l = 0; l < LV; l++) {
      const y = l * LH;
      kit.box('concrete_panel', 0, y + LH - 0.3 * M, 0, W, 0.3 * M, D);
      // Brüstungen mit Lochblech-Lamellen
      for (const [cx, cz, sx, sz] of [[0, D / 2, W, 0.2 * M], [0, -D / 2, W, 0.2 * M], [W / 2, 0, 0.2 * M, D], [-W / 2, 0, 0.2 * M, D]]) {
        kit.box(variant ? 'metal_panel_grey' : 'concrete', cx, y + LH, cz, sx, 1.0 * M, sz);
      }
      if (detail > 0 && l > 0) {
        // Autos auf dem Deck
        for (let k = 0; k < 3; k++) if (rng() < 0.75) car(kit, (-3.0 + k * 3.0) * M, 2.4 * M, Math.PI, CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)], { y0: y, glass: 'glass_curtain_blue' });
        for (let k = 0; k < 2; k++) if (rng() < 0.6) car(kit, (-3.0 + k * 3.0) * M, -2.8 * M, 0, CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)], { y0: y, glass: 'glass_curtain_blue' });
        kit.box('emissive_cool', 0, y + LH - 0.34 * M, 0, 6.0 * M, 0.04 * M, 0.15 * M);
      }
    }
    // Stützen
    for (const x of [-4.6, 0, 4.6]) for (const z of [-4.6, 4.6]) kit.box('concrete', x * M, 0, z * M, 0.4 * M, LV * LH, 0.4 * M);
    // Vertikale Lamellen als Fassade (Variante 1: grün berankt)
    if (detail > 0) {
      const mat = variant ? 'hedge' : 'metal_panel_white';
      for (let k = 0; k < 14; k++) {
        const x = -W / 2 + 0.35 * M + k * ((W - 0.7 * M) / 13);
        kit.box(mat, x, LH, D / 2 + 0.18 * M, 0.12 * M, (LV - 1) * LH + 1.0 * M, 0.25 * M);
      }
    }
    // Rampe (sichtbar an der linken Seite)
    for (let l = 0; l < LV - 1; l++) beam(kit, 'concrete_dark', [-W / 2 + 1.0 * M, l * LH + 0.2 * M, -3.6 * M], [-W / 2 + 1.0 * M, (l + 1) * LH, 3.0 * M], 1.6 * M, 0.3 * M);
    // Treppenhaus
    kit.box('glass_curtain_blue', W / 2 - 1.0 * M, 0, D / 2 - 1.0 * M, 2.2 * M, LV * LH + 1.6 * M, 2.2 * M, { lit: 0.6 });
    kit.box('concrete', W / 2 - 1.0 * M, LV * LH + 1.6 * M, D / 2 - 1.0 * M, 2.4 * M, 0.3 * M, 2.4 * M);
    // Großes P-Schild
    const PY = LV * LH - 0.2 * M;
    kit.box('paint_blue', W / 2 - 1.0 * M, PY - 1.4 * M, D / 2 + 0.2 * M, 1.8 * M, 1.8 * M, 0.15 * M);
    text(kit, 'sign_white', 'P', W / 2 - 1.0 * M, PY - 1.12 * M, D / 2 + 0.3 * M, 0, 1.2 * M, { depth: 0.06 * M, weight: 1.2, lod: true });
    // Einfahrt
    kit.box('concrete', -2.0 * M, 2.4 * M, D / 2 + 0.6 * M, 4.0 * M, 0.25 * M, 1.4 * M);
    if (detail > 0) {
      kit.box('metal_dark', -3.6 * M, 0, D / 2 + 0.4 * M, 0.4 * M, 1.1 * M, 0.3 * M);
      beam(kit, 'paint_red', [-3.4 * M, 1.0 * M, D / 2 + 0.4 * M], [-0.6 * M, 1.0 * M, D / 2 + 0.4 * M], 0.08 * M);
      kit.box('glass_curtain_blue', -2.0 * M, 2.2 * M, D / 2 + 1.25 * M, 3.0 * M, 0.2 * M, 0.06 * M, { lit: 1 });
      // Dachdeck: Leuchten
      for (const [x, z] of [[-3.6, -3.6], [3.6, -3.6], [-3.6, 2.0]]) lamp(kit, x * M, z * M, 3.2 * M, { head: 'emissive_cool', color: 0xdcefff, ry: 0, y0: LV * LH });
    }
    return kit.build();
  },
});

registerArch('taxi_depot', {
  variants: 1,
  build(ctx) {
    const { kit, detail } = ctx;
    const TAXI = 'plaster_cream';
    kit.box('asphalt', 0, 0, 0, 9.8 * M, 0.06 * M, 9.8 * M);
    // Zentrale: zweigeschossiger Bau mit Glasfront und Leuchtschild
    kit.box('plaster_white', -2.4 * M, 0, -2.6 * M, 4.8 * M, 6.0 * M, 4.4 * M);
    kit.box('stone_grey', -2.4 * M, 0, -2.6 * M, 5.0 * M, 0.4 * M, 4.6 * M);
    kit.box('glass_shop', -2.4 * M, 0.4 * M, -0.38 * M, 4.0 * M, 2.4 * M, 0.06 * M, { lit: 0.97 });
    kit.windows('front', -2.4 * M, -2.6 * M, 4.8 * M, 4.4 * M, 3.0 * M, 1, 3.0 * M, { winW: 1.4 * M, winH: 1.5 * M, spacing: 2.0 * M, frame: 'window_frame_dark', glass: 'glass_shop' });
    kit.windows('right', -2.4 * M, -2.6 * M, 4.8 * M, 4.4 * M, 0.4 * M, 2, 2.8 * M, { winW: 1.0 * M, winH: 1.3 * M, spacing: 2.0 * M, frame: 'window_frame_dark', glass: 'glass_shop' });
    kit.flatRoof('roof_flat_gravel', 'plaster_white', -2.4 * M, 6.0 * M, -2.6 * M, 4.8 * M, 4.4 * M, {});
    kit.box('metal_dark', -2.4 * M, 6.0 * M, -0.5 * M, 4.2 * M, 1.1 * M, 0.25 * M);
    text(kit, 'neon_yellow', 'TAXI', -2.4 * M, 6.15 * M, -0.34 * M, 0, 0.75 * M, { depth: 0.08 * M, lod: true });
    kit.light(-2.4 * M, 6.5 * M, 0.2 * M, 0xffd43f, 0.6);
    // Carport mit Ladesäulen und drei Taxis
    for (const x of [0.6, 4.6]) for (const z of [-4.6, 4.2]) kit.cyl('metal_light', x * M, 0, z * M, 0.12 * M, 3.0 * M, { seg: 6 });
    kit.box('metal_panel_white', 2.6 * M, 3.0 * M, -0.2 * M, 5.0 * M, 0.25 * M, 9.6 * M);
    if (detail > 0) kit.box('solar_panel', 2.6 * M, 3.25 * M, -0.2 * M, 4.6 * M, 0.06 * M, 9.2 * M);
    for (let k = 0; k < 3; k++) {
      const z = (-3.2 + k * 3.0) * M;
      car(kit, 2.6 * M, z, Math.PI / 2, TAXI, { taxi: true, glass: 'glass_shop', signMat: 'neon_yellow' });
      if (detail > 0) { kit.box('metal_panel_white', 4.8 * M, 0, z, 0.4 * M, 1.4 * M, 0.3 * M); kit.box('neon_yellow', 4.58 * M, 1.0 * M, z, 0.02 * M, 0.2 * M, 0.15 * M); }
    }
    car(kit, -2.0 * M, 2.8 * M, 0.3, TAXI, { taxi: true, glass: 'glass_shop', signMat: 'neon_yellow' });
    if (detail > 0) {
      for (let k = 0; k <= 3; k++) kit.box('paint_white', 2.6 * M, 0.07 * M, (-4.7 + k * 3.0) * M, 4.4 * M, 0.02 * M, 0.1 * M);
      // Wartebank und Rufsäule
      bench(kit, -4.0 * M, 0.6 * M, 0);
      kit.cyl('paint_yellow', -0.4 * M, 0, 1.0 * M, 0.15 * M, 2.4 * M, { seg: 6 });
      kit.box('neon_yellow', -0.4 * M, 2.4 * M, 1.0 * M, 0.6 * M, 0.4 * M, 0.2 * M);
      planter(kit, -4.2 * M, 4.2 * M);
    }
    return kit.build();
  },
});

registerArch('ferry_pier', {
  variants: 1,
  build(ctx) {
    const { kit, detail } = ctx;
    // Uferkante mit Spundwand, Terminalhäuschen, Steg über das Wasser hinaus (nach hinten, −z)
    kit.box('pavers', 0, 0, 1.0 * M, 9.8 * M, 0.08 * M, 7.8 * M);
    kit.box('stone_grey', 0, -1.2 * M, -3.6 * M, 9.8 * M, 1.4 * M, 2.4 * M);
    // Terminal: Holz und Glas mit Pultdach
    kit.box('wood_planks', -2.0 * M, 0, 1.4 * M, 5.2 * M, 3.4 * M, 4.0 * M);
    kit.box('glass_shop', -2.0 * M, 0.3 * M, 3.42 * M, 4.4 * M, 2.4 * M, 0.06 * M, { lit: 0.95 });
    kit.box('glass_shop', -2.0 * M, 0.3 * M, -0.62 * M, 4.4 * M, 2.4 * M, 0.06 * M, { lit: 0.95 });
    kit.prism('roof_metal_grey', [[-2.4 * M, 0], [2.4 * M, 0], [2.4 * M, 0.25 * M], [-2.4 * M, 1.3 * M]], 6.0 * M, { x: -2.0 * M, y: 3.4 * M, z: 1.4 * M, ry: Math.PI / 2 });
    kit.box('paint_blue', -2.0 * M, 2.8 * M, 3.5 * M, 4.0 * M, 0.6 * M, 0.1 * M);
    text(kit, 'paint_white', 'FÄHRE', -2.0 * M, 2.88 * M, 3.56 * M, 0, 0.42 * M, { depth: 0.03 * M });
    // Steg auf Pfählen bis über die Grundstücksgrenze hinaus
    const SX = 2.8 * M;
    kit.box('wood_planks', SX, 0.1 * M, -3.0 * M, 2.4 * M, 0.25 * M, 12.0 * M);
    for (let z = 2.6; z >= -8.6; z -= 2.2) for (const s of [-1, 1]) kit.cyl('wood_dark', SX + s * 1.1 * M, -2.0 * M, z * M, 0.16 * M, 2.4 * M, { seg: 6 });
    railing(kit, [[SX - 1.15 * M, 2.8 * M], [SX - 1.15 * M, -8.8 * M]], 0.35 * M, 1.0 * M, { mat: 'paint_white', spacing: 1.2 * M });
    railing(kit, [[SX + 1.15 * M, 2.8 * M], [SX + 1.15 * M, -6.0 * M]], 0.35 * M, 1.0 * M, { mat: 'paint_white', spacing: 1.2 * M });
    // Ponton mit Gangway
    kit.box('metal_panel_grey', SX + 0.8 * M, -0.3 * M, -10.0 * M, 5.0 * M, 0.5 * M, 3.0 * M);
    kit.box('paint_yellow', SX + 0.8 * M, 0.2 * M, -10.0 * M, 5.05 * M, 0.06 * M, 0.1 * M);
    if (detail > 0) {
      for (const x of [-1.2, 2.8]) { kit.cyl('metal_dark', SX + x * M, 0.2 * M, -11.3 * M, 0.18 * M, 0.5 * M, { seg: 6 }); kit.cyl('metal_dark', SX + x * M, 0.65 * M, -11.3 * M, 0.26 * M, 0.08 * M, { seg: 6 }); }
      for (const z of [-2.0, -6.0]) kit.add('paint_red', new THREE.TorusGeometry(0.32 * M, 0.08 * M, 4, 10), { x: SX + 1.25 * M, y: 1.0 * M, z: z * M, ry: Math.PI / 2 });
      // Wartehäuschen auf dem Steg
      kit.box('glass_shop', SX, 0.35 * M, -7.6 * M, 2.0 * M, 2.4 * M, 0.06 * M, { lit: 0.6 });
      kit.box('metal_dark', SX, 2.75 * M, -7.0 * M, 2.4 * M, 0.12 * M, 1.6 * M);
      for (const s of [-1, 1]) kit.cyl('metal_dark', SX + s * 1.0 * M, 0.35 * M, -6.4 * M, 0.06 * M, 2.4 * M, { seg: 4 });
      // Poller und Laternen am Ufer
      for (const x of [-4.2, -1.2]) bollard(kit, x * M, -2.6 * M);
      lamp(kit, SX - 1.2 * M, 3.4 * M, 3.8 * M, { style: 'old' });
      lamp(kit, SX + 1.0 * M, -8.6 * M, 3.0 * M, { style: 'globe' });
      bench(kit, -2.0 * M, 4.4 * M, Math.PI);
      tree(kit, -4.2 * M, 4.2 * M, 0.6, 'round');
    }
    return kit.build();
  },
});
void glassRail; void flag;
