// Flughafen (6 × 4): Terminal mit Wellendach und Glasfront, Fluggastbrücken, Vorfeld mit geparkten Flugzeugen,
// Tower, Hangar, Rollweg und Start- und Landebahn (entlang x am hinteren Rand). Besitzer: G6.
// Startbahn-Mittellinie (Modellkoordinaten vor Drehung): z = −1.65, von x = −2.95 bis 2.95 (Welteinheiten).
import * as THREE from 'three';
import { registerArch } from './index.js';
import { M } from './kit.js';
import { beam, lamp, tree, flag, face, plane, car, bus, glassRail, crowd } from './lm_parts.js';
import { text } from './lm_text.js';

const CAR_COLORS = ['paint_red', 'paint_blue', 'paint_white', 'metal_dark', 'metal_light', 'paint_yellow', 'siding_blue'];

registerArch('airport', {
  variants: 1,
  build(ctx) {
    const { kit, detail, rng } = ctx;
    const d = detail;
    kit.box('grass', 0, 0, 0, 59.8 * M, 0.05 * M, 39.8 * M);
    // --- Start- und Landebahn mit Markierungen und Befeuerung
    const RZ = -16.5 * M, RW = 5.6 * M, RL = 59.0 * M;
    kit.box('tarmac', 0, 0.02 * M, RZ, RL, 0.08 * M, RW);
    if (d > 0) {
      for (let k = 0; k < 14; k++) kit.box('runway_marking', -26 * M + k * 4.0 * M, 0.1 * M, RZ, 2.2 * M, 0.02 * M, 0.25 * M);
      for (const s of [-1, 1]) {
        for (let k = 0; k < 5; k++) kit.box('runway_marking', s * 27.6 * M, 0.1 * M, RZ - 2.0 * M + k * 1.0 * M, 2.0 * M, 0.02 * M, 0.45 * M);
        kit.box('runway_marking', 0, 0.1 * M, RZ + s * (RW / 2 - 0.25 * M), RL - 1.0 * M, 0.02 * M, 0.12 * M);
      }
      const nl = d === 2 ? 24 : 12;
      for (let k = 0; k <= nl; k++) for (const s of [-1, 1]) kit.box(k % 6 === 0 ? 'emissive_red' : 'sign_white', -RL / 2 + (k * RL) / nl, 0.1 * M, RZ + s * (RW / 2 + 0.2 * M), 0.18 * M, 0.12 * M, 0.18 * M);
    }
    // Rollweg und Verbindungen zum Vorfeld
    const TZ = -11.6 * M;
    kit.box('tarmac', 0, 0.02 * M, TZ, RL, 0.07 * M, 2.4 * M);
    for (const x of [-22, 0, 22]) kit.box('tarmac', x * M, 0.02 * M, (TZ + RZ) / 2, 2.4 * M, 0.07 * M, Math.abs(RZ - TZ));
    if (d > 0) {
      kit.box('paint_yellow', 0, 0.1 * M, TZ, RL - 2 * M, 0.02 * M, 0.1 * M);
      for (const x of [-22, 0, 22]) kit.box('paint_yellow', x * M, 0.1 * M, (TZ + RZ) / 2, 0.1 * M, 0.02 * M, Math.abs(RZ - TZ));
    }
    // --- Vorfeld
    const AZ0 = -10.4 * M, AZ1 = 3.0 * M;
    kit.box('concrete', -4.0 * M, 0.02 * M, (AZ0 + AZ1) / 2, 50.0 * M, 0.07 * M, AZ1 - AZ0);
    if (d > 0) for (const x of [-22, -8, 6]) {
      kit.box('paint_yellow', x * M, 0.1 * M, (AZ0 + AZ1) / 2, 0.12 * M, 0.02 * M, AZ1 - AZ0 - 1.0 * M);
      kit.box('paint_white', x * M, 0.1 * M, AZ1 - 1.8 * M, 3.0 * M, 0.02 * M, 0.12 * M);
    }
    // Geparkte Flugzeuge (Nase zum Terminal)
    const LIVERY = [['paint_blue', 'paint_blue'], ['paint_red', 'paint_red'], ['paint_yellow', 'metal_dark']];
    [-22, -8, 6].forEach((x, i) => plane(kit, x * M, 0.08 * M, -4.2 * M, 0, 0.4, { tail: LIVERY[i][0], stripe: LIVERY[i][1], glass: 'glass_curtain_blue' }));
    // Vorfeldfahrzeuge
    if (d > 0) {
      bus(kit, -14.0 * M, -1.2 * M, Math.PI / 2, 'paint_white', { len: 9, glass: 'glass_curtain_blue', signMat: 'sign_white' });
      for (const [x, z, c] of [[-15.0, 1.8, 'paint_yellow'], [-1.0, 1.8, 'paint_orange'], [12.4, -1.6, 'paint_yellow'], [-27.0, -8.6, 'paint_white']]) car(kit, x * M, z * M, rng() * 6, c, { len: 3.6, glass: 'glass_curtain_blue' });
      for (let k = 0; k < 4; k++) kit.box('container_blue', (-17.4 + k * 0.9) * M, 0.08 * M, 0.8 * M, 0.8 * M, 0.9 * M, 1.4 * M);
    }
    // --- Terminal: Glasfront zur Straße, gewelltes Dach, Fluggastbrücken
    const TZ0 = 3.0 * M, TZ1 = 11.8 * M, TX0 = -26.0 * M, TX1 = 13.0 * M, TH = 7.4 * M;
    const tcx = (TX0 + TX1) / 2, tcz = (TZ0 + TZ1) / 2, tw = TX1 - TX0, td = TZ1 - TZ0;
    kit.box('concrete', tcx, 0, tcz, tw + 0.2 * M, 0.5 * M, td + 0.2 * M);
    kit.box('metal_panel_white', tcx, 0.5 * M, tcz, tw, TH - 0.5 * M, td);
    kit.curtainWall('front', tcx, tcz, tw, td, 0.5 * M, TH - 1.0 * M, { glass: 'glass_curtain_blue', frame: 'metal_light', fh: (TH - 1.0 * M) / 2, colW: 2.4 * M });
    kit.curtainWall('back', tcx, tcz, tw, td, 0.5 * M, TH - 1.0 * M, { glass: 'glass_curtain_blue', frame: 'metal_light', fh: (TH - 1.0 * M) / 2, colW: 2.4 * M });
    // Wellendach aus Segmenten
    const segs = d === 2 ? 20 : d === 1 ? 10 : 5;
    for (let k = 0; k < segs; k++) {
      const x0 = TX0 - 1.0 * M + (k * (tw + 2.0 * M)) / segs, x1 = x0 + (tw + 2.0 * M) / segs;
      const y0 = TH + Math.sin((k / segs) * Math.PI * 2) * 0.6 * M, y1 = TH + Math.sin(((k + 1) / segs) * Math.PI * 2) * 0.6 * M;
      beam(kit, 'metal_panel_white', [x0, y0 + 0.3 * M, tcz + 1.0 * M], [x1, y1 + 0.3 * M, tcz + 1.0 * M], td + 4.0 * M, 0.5 * M, { extend: 0.05 * M });
    }
    if (d > 0) {
      for (let k = 0; k < 9; k++) kit.cyl('metal_light', (TX0 + 1.0 * M) + k * ((tw - 2.0 * M) / 8), 0.5 * M, TZ1 + 2.6 * M, 0.15 * M, TH - 0.4 * M, { seg: 6, rTop: 0.25 * M });
      kit.box('sign_white', tcx, TH - 0.1 * M, TZ1 + 1.8 * M, tw - 2 * M, 0.06 * M, 0.3 * M);
    }
    // Schriftzug über dem Haupteingang
    kit.box('metal_dark', -6.5 * M, TH - 2.2 * M, TZ1 + 0.1 * M, 12.0 * M, 1.4 * M, 0.25 * M);
    text(kit, 'sign_white', 'FLUGHAFEN', -6.5 * M, TH - 2.0 * M, TZ1 + 0.26 * M, 0, 0.95 * M, { depth: 0.05 * M, lod: true });
    // Fluggastbrücken
    [-22, -8, 6].forEach((x) => {
      const bx = x * M, by = 3.0 * M;
      beam(kit, 'metal_panel_grey', [bx + 3.6 * M, by, TZ0 - 0.1 * M], [bx + 2.3 * M, by, 0.4 * M], 1.8 * M, 2.2 * M);
      kit.cyl('metal_dark', bx + 2.4 * M, 0.08 * M, 0.2 * M, 0.2 * M, by - 1.2 * M, { seg: 6 });
      kit.box('metal_dark', bx + 2.4 * M, 0.08 * M, 0.2 * M, 1.4 * M, 0.5 * M, 0.6 * M);
      kit.box('metal_panel_grey', bx + 1.9 * M, by - 1.1 * M, 0.0, 1.6 * M, 2.4 * M, 1.6 * M);
      if (d > 0) kit.box('glass_curtain_blue', bx + 3.02 * M, by - 0.3 * M, (TZ0 + 0.4 * M) / 2, 0.04 * M, 0.6 * M, 2.0 * M, { lit: 0.8 });
    });
    // --- Tower
    const WX = 20.0 * M, WZ = 7.0 * M, WH = 26.0 * M;
    kit.box('concrete', WX, 0, WZ, 5.0 * M, 4.0 * M, 5.0 * M);
    kit.cyl('concrete_panel', WX, 4.0 * M, WZ, 1.4 * M, WH - 4.0 * M, { seg: 12, rTop: 1.2 * M });
    kit.cyl('concrete_panel', WX, WH, WZ, 2.4 * M, 1.2 * M, { seg: 8, rTop: 3.0 * M });
    kit.add('glass_curtain_blue', new THREE.CylinderGeometry(3.2 * M, 2.8 * M, 3.0 * M, 8, 1, false), { x: WX, y: WH + 2.7 * M, z: WZ, lit: 0.9 });
    kit.cyl('metal_dark', WX, WH + 4.2 * M, WZ, 3.4 * M, 0.5 * M, { seg: 8 });
    kit.cyl('metal_light', WX, WH + 4.7 * M, WZ, 0.6 * M, 1.4 * M, { seg: 8 });
    kit.cyl('metal_light', WX, WH + 6.1 * M, WZ, 0.06 * M, 4.0 * M, { seg: 4 });
    kit.sphere('emissive_red', WX, WH + 10.2 * M, WZ, 0.25 * M, { seg: 6 });
    kit.light(WX, WH + 10.2 * M, WZ, 0xff3020, 0.5);
    if (d > 0) {
      kit.add('metal_panel_white', new THREE.SphereGeometry(1.0 * M, 8, 6), { x: WX + 0.8 * M, y: WH + 6.3 * M, z: WZ, sy: 1.0 });
      kit.light(WX, WH + 2.7 * M, WZ, 0xdcefff, 0.8);
    }
    // --- Hangar mit Bogendach
    const HX = 21.0 * M, HZ = -3.6 * M, HW = 15.0 * M, HD = 11.0 * M, HH = 5.0 * M;
    kit.box('metal_corrugated', HX, 0, HZ, HW, HH, HD);
    const R = HW / 2 + 0.3 * M;
    kit.add('metal_corrugated', new THREE.CylinderGeometry(R, R, HD + 0.6 * M, d === 2 ? 16 : 8, 1, false, -Math.PI / 2, Math.PI), { x: HX, y: HH, z: HZ, rx: -Math.PI / 2, sz: 4.0 * M / R });
    kit.box('metal_panel_grey', HX, 0.05 * M, HZ - HD / 2 - 0.03 * M, HW - 2.0 * M, HH + 2.0 * M, 0.08 * M);
    if (d > 0) {
      for (let k = 1; k < 6; k++) kit.box('metal_dark', HX - (HW - 2.0 * M) / 2 + (k * (HW - 2.0 * M)) / 6, 0.05 * M, HZ - HD / 2 - 0.08 * M, 0.12 * M, HH + 2.0 * M, 0.06 * M);
      kit.box('paint_white', HX, HH + 2.6 * M, HZ - HD / 2 - 0.1 * M, 8.0 * M, 1.0 * M, 0.1 * M);
    }
    // --- Landseite: Vorfahrt, Parkplatz mit Autos, Bäume
    kit.box('asphalt', -6.5 * M, 0.02 * M, 15.8 * M, 46.0 * M, 0.06 * M, 7.6 * M);
    if (d > 0) {
      for (let k = 0; k < 10; k++) kit.box('paint_white', (-27 + k * 4.6) * M, 0.09 * M, 15.8 * M, 2.2 * M, 0.02 * M, 0.12 * M);
      const n = d === 2 ? 14 : 7;
      for (let k = 0; k < n; k++) car(kit, (-24 + k * (42 / n)) * M, 18.4 * M, Math.PI, CAR_COLORS[k % CAR_COLORS.length], { glass: 'glass_curtain_blue' });
      for (let k = 0; k < 3; k++) car(kit, (-12 + k * 6) * M, 13.6 * M, Math.PI / 2, k === 1 ? 'plaster_cream' : CAR_COLORS[(k * 3) % CAR_COLORS.length], { taxi: k === 1, glass: 'glass_curtain_blue', signMat: 'sign_white' });
      bus(kit, 4.0 * M, 13.8 * M, -Math.PI / 2, 'paint_blue', { glass: 'glass_curtain_blue', signMat: 'sign_white' });
      for (const x of [-28, -18, -8, 2, 12]) lamp(kit, x * M, 19.6 * M, 6.0 * M, { head: 'sign_white', color: 0xdcefff });
      for (const [x, z] of [[24, 16], [28, 12], [27.6, 18.6], [-28.6, 6], [17, 18]]) tree(kit, x * M, z * M, 0.9, 'round');
      for (const x of [-2.0, 0.0, 2.0]) flag(kit, (x + 16) * M, 13.0 * M, 7.0 * M, x === 0 ? 'paint_blue' : 'paint_white');
    }
    crowd(kit, -6.5 * M, 12.6 * M, 36 * M, 1.4 * M, 14);
    // Windsack
    if (d > 0) {
      kit.cyl('metal_light', 27.0 * M, 0, -13.4 * M, 0.06 * M, 4.0 * M, { seg: 4 });
      kit.cone('paint_orange', 27.0 * M + 0.9 * M, 3.8 * M, -13.4 * M, 0.35 * M, 1.8 * M, { seg: 8, rz: Math.PI / 2 });
    }
    void glassRail; void face;
    return kit.build();
  },
});
