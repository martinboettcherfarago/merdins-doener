// Flughafen (6 × 4): Start- und Landebahn, Rollwege, Vorfeld mit drei Parkpositionen, Terminal mit Wellendach und
// Fluggastbrücken, Tower, Hangar, Feuerwache. Besitzer: G6.
// Abgestimmt mit S3 (AIRPORT_LAYOUT, Welteinheiten, Modellkoordinaten vor Drehung): Bahn z = −1.25 (x −2.85 … 2.85),
// Rollweg z = −0.45, Parkpositionen x = −1.6 / 0 / 1.6 bei z = 0.45 (Nase nach +z), Abrollweg rechts über x = 2.35,
// Rollhalt links bei x = −2.7. Die Flugzeuge selbst zeichnet S3/G10 – auf den Parkpositionen steht nichts Festes.
import * as THREE from 'three';
import { registerArch } from './index.js';
import { M } from './kit.js';
import { beam, lamp, tree, flag, face, plane, car, bus, crowd, path } from './lm_parts.js';
import { text } from './lm_text.js';

registerArch('airport', {
  variants: 1,
  build(ctx) {
    const { kit, detail } = ctx;
    const d = detail;
    kit.box('grass', 0, 0, 0, 59.8 * M, 0.05 * M, 39.8 * M);
    // --- Start- und Landebahn mit Markierungen und Befeuerung
    const RZ = -12.5 * M, RW = 5.0 * M, RL = 59.2 * M;
    kit.box('tarmac', 0, 0.02 * M, RZ, RL, 0.08 * M, RW);
    if (d > 0) {
      for (let k = 0; k < 13; k++) kit.box('runway_marking', -24 * M + k * 4.0 * M, 0.1 * M, RZ, 2.2 * M, 0.02 * M, 0.22 * M);
      for (const s of [-1, 1]) {
        for (let k = 0; k < 6; k++) kit.box('runway_marking', s * 27.4 * M, 0.1 * M, RZ - 1.9 * M + k * 0.76 * M, 2.4 * M, 0.02 * M, 0.38 * M);
        kit.box('runway_marking', 0, 0.1 * M, RZ + s * (RW / 2 - 0.25 * M), RL - 1.0 * M, 0.02 * M, 0.12 * M);
        for (const dz of [-1.2, 1.2]) kit.box('runway_marking', s * 21.0 * M, 0.1 * M, RZ + dz * M, 4.0 * M, 0.02 * M, 0.6 * M);
      }
      const nl = d === 2 ? 24 : 12;
      for (let k = 0; k <= nl; k++) for (const s of [-1, 1]) kit.box(k === 0 || k === nl ? 'emissive_red' : 'sign_white', -RL / 2 + (k * RL) / nl, 0.1 * M, RZ + s * (RW / 2 + 0.2 * M), 0.18 * M, 0.12 * M, 0.18 * M);
    }
    // --- Rollwege (Hauptrollweg, Abrollweg rechts, Rollhalt links)
    const TZ = -4.5 * M, TW = 2.6 * M;
    kit.box('tarmac', -2.0 * M, 0.02 * M, TZ, 51.0 * M, 0.07 * M, TW);
    path(kit, 'tarmac', [19.5 * M, RZ], [23.5 * M, RZ + 4.0 * M], TW, 0.09 * M);
    path(kit, 'tarmac', [23.5 * M, RZ + 4.0 * M], [23.5 * M, TZ], TW, 0.09 * M);
    path(kit, 'tarmac', [-27.0 * M, TZ], [-27.0 * M, RZ], TW, 0.09 * M);
    if (d > 0) {
      kit.box('paint_yellow', -2.0 * M, 0.1 * M, TZ, 50.0 * M, 0.02 * M, 0.1 * M);
      path(kit, 'paint_yellow', [19.5 * M, RZ], [23.5 * M, RZ + 4.0 * M], 0.1 * M, 0.11 * M);
      path(kit, 'paint_yellow', [23.5 * M, RZ + 4.0 * M], [23.5 * M, TZ], 0.1 * M, 0.11 * M);
      path(kit, 'paint_yellow', [-27.0 * M, TZ], [-27.0 * M, RZ], 0.1 * M, 0.11 * M);
      for (const dz of [-0.3, 0.3]) kit.box('paint_yellow', -27.0 * M, 0.11 * M, RZ + 3.4 * M + dz * M, TW, 0.02 * M, 0.12 * M);
      if (d === 2) for (let x = -26; x <= 22; x += 4) for (const s of [-1, 1]) kit.box('sign_white', x * M, 0.1 * M, TZ + s * (TW / 2 + 0.15 * M), 0.12 * M, 0.1 * M, 0.12 * M);
    }
    // --- Vorfeld mit drei Parkpositionen (Leitlinie vom Rollweg, Haltebalken, Sicherheitslinien)
    const AZ0 = -3.2 * M, AZ1 = 13.0 * M, SZ = 4.5 * M;
    kit.box('concrete', -1.0 * M, 0.02 * M, (AZ0 + AZ1) / 2, 46.0 * M, 0.07 * M, AZ1 - AZ0);
    const STANDS = [-16, 0, 16];
    if (d > 0) for (const sx of STANDS) {
      kit.box('paint_yellow', sx * M, 0.1 * M, (TZ + SZ + 6.5 * M) / 2, 0.12 * M, 0.02 * M, SZ + 6.5 * M - TZ);
      kit.box('paint_white', sx * M, 0.1 * M, SZ + 6.2 * M, 3.0 * M, 0.02 * M, 0.16 * M);
      for (const s of [-1, 1]) kit.box('paint_red', (sx + s * 8.0) * M, 0.1 * M, SZ, 0.12 * M, 0.02 * M, 14.0 * M);
      kit.box('paint_yellow', (sx - 5.2) * M, 0.08 * M, 11.2 * M, 1.2 * M, 0.9 * M, 0.8 * M);
    }
    // Vorfeldfahrzeuge an den Rändern (nicht auf den Parkpositionen)
    if (d > 0) {
      bus(kit, -8.0 * M, 11.0 * M, Math.PI / 2, 'paint_white', { len: 9, glass: 'glass_curtain_blue', signMat: 'sign_white' });
      for (const [x, z, c, r] of [[8.0, 10.6, 'paint_yellow', 1.6], [-23.4, 9.6, 'paint_orange', 0.2], [22.0, 1.0, 'paint_yellow', 3.0], [-8.0, -1.6, 'paint_white', 1.57]]) car(kit, x * M, z * M, r, c, { len: 3.6, glass: 'glass_curtain_blue' });
      for (let k = 0; k < 4; k++) kit.box('container_blue', (6.0 + k * 0.9) * M, 0.08 * M, 11.8 * M, 0.8 * M, 0.9 * M, 1.4 * M);
      for (let k = 0; k < 3; k++) kit.box('container_yellow', (-11.6 + k * 0.9) * M, 0.08 * M, 11.8 * M, 0.8 * M, 0.9 * M, 1.4 * M);
    }
    // --- Terminal (z 13 … 19.4) mit Glasfronten, Wellendach, Fluggastbrücken
    const TZ0 = 13.0 * M, TZ1 = 19.4 * M, TX0 = -23.0 * M, TX1 = 21.0 * M, TH = 7.2 * M;
    const tcx = (TX0 + TX1) / 2, tcz = (TZ0 + TZ1) / 2, tw = TX1 - TX0, td = TZ1 - TZ0;
    kit.box('concrete', tcx, 0, tcz, tw + 0.2 * M, 0.5 * M, td + 0.2 * M);
    kit.box('metal_panel_white', tcx, 0.5 * M, tcz, tw, TH - 0.5 * M, td);
    for (const side of ['front', 'back']) kit.curtainWall(side, tcx, tcz, tw, td, 0.5 * M, TH - 1.0 * M, { glass: 'glass_curtain_blue', frame: 'metal_light', fh: (TH - 1.0 * M) / 2, colW: 2.4 * M });
    const segs = d === 2 ? 22 : d === 1 ? 11 : 5;
    for (let k = 0; k < segs; k++) {
      const x0 = TX0 - 1.0 * M + (k * (tw + 2.0 * M)) / segs, x1 = x0 + (tw + 2.0 * M) / segs;
      const y0 = TH + Math.sin((k / segs) * Math.PI * 2) * 0.6 * M, y1 = TH + Math.sin(((k + 1) / segs) * Math.PI * 2) * 0.6 * M;
      beam(kit, 'metal_panel_white', [x0, y0 + 0.3 * M, tcz + 0.3 * M], [x1, y1 + 0.3 * M, tcz + 0.3 * M], td + 1.6 * M, 0.5 * M, { extend: 0.05 * M });
    }
    if (d > 0) {
      for (let k = 0; k < 10; k++) kit.cyl('metal_light', (TX0 + 1.0 * M) + k * ((tw - 2.0 * M) / 9), 0.5 * M, TZ1 + 0.4 * M, 0.14 * M, TH - 0.2 * M, { seg: 6, rTop: 0.22 * M });
      kit.box('sign_white', tcx, TH + 0.05 * M, TZ1 + 0.6 * M, tw - 2 * M, 0.06 * M, 0.25 * M);
    }
    // Schriftzug zur Straße und zum Vorfeld
    for (const [z, ry, y] of [[TZ1 + 0.9 * M, 0, TH + 1.2 * M], [TZ0 - 0.12 * M, Math.PI, TH - 2.0 * M]]) {
      kit.box('metal_dark', -1.0 * M, y, z, 12.0 * M, 1.3 * M, 0.2 * M);
      if (ry === 0) for (const s of [-1, 1]) kit.box('metal_dark', -1.0 * M + s * 5.0 * M, TH + 0.6 * M, z, 0.2 * M, 0.7 * M, 0.2 * M);
      const [tx, tz] = face(-1.0 * M, z, ry).at(0, 0.11 * M);
      text(kit, 'sign_white', 'FLUGHAFEN', tx, y + 0.18 * M, tz, ry, 0.9 * M, { depth: 0.05 * M, lod: true });
    }
    // Fluggastbrücken zu den Parkpositionen
    for (const sx of STANDS) {
      const bx = sx * M, by = 3.0 * M;
      beam(kit, 'metal_panel_grey', [bx + 3.6 * M, by, TZ0 - 0.1 * M], [bx + 2.6 * M, by, 10.8 * M], 1.8 * M, 2.2 * M);
      kit.cyl('metal_dark', bx + 2.7 * M, 0.08 * M, 11.0 * M, 0.2 * M, by - 1.2 * M, { seg: 6 });
      kit.box('metal_dark', bx + 2.7 * M, 0.08 * M, 11.0 * M, 1.4 * M, 0.5 * M, 0.6 * M);
      kit.box('metal_panel_grey', bx + 2.4 * M, by - 1.1 * M, 10.6 * M, 1.6 * M, 2.4 * M, 1.4 * M);
      if (d > 0) kit.box('glass_curtain_blue', bx + 3.2 * M, by - 0.3 * M, 12.0 * M, 0.04 * M, 0.6 * M, 1.8 * M, { lit: 0.8 });
    }
    // --- Tower (rechts, zwischen Abrollweg und Terminal)
    const WX = 26.6 * M, WZ = 6.0 * M, WH = 24.0 * M;
    kit.box('concrete', WX, 0, WZ, 5.0 * M, 4.0 * M, 6.0 * M);
    kit.windows('front', WX, WZ, 5.0 * M, 6.0 * M, 0.4 * M, 1, 3.4 * M, { winW: 1.2 * M, winH: 1.4 * M, spacing: 2.0 * M, frame: 'window_frame_dark', glass: 'glass_curtain_blue' });
    kit.cyl('concrete_panel', WX, 4.0 * M, WZ, 1.4 * M, WH - 4.0 * M, { seg: 12, rTop: 1.2 * M });
    kit.cyl('concrete_panel', WX, WH, WZ, 2.4 * M, 1.2 * M, { seg: 8, rTop: 3.0 * M });
    kit.add('glass_curtain_blue', new THREE.CylinderGeometry(3.2 * M, 2.8 * M, 3.0 * M, 8, 1, false), { x: WX, y: WH + 2.7 * M, z: WZ, lit: 0.9 });
    if (d > 0) for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; kit.box('metal_dark', WX + Math.sin(a) * 3.0 * M, WH + 1.2 * M, WZ + Math.cos(a) * 3.0 * M, 0.12 * M, 3.0 * M, 0.12 * M, { ry: a }); }
    kit.cyl('metal_dark', WX, WH + 4.2 * M, WZ, 3.4 * M, 0.5 * M, { seg: 8 });
    kit.cyl('metal_light', WX, WH + 4.7 * M, WZ, 0.6 * M, 1.4 * M, { seg: 8 });
    kit.cyl('metal_light', WX, WH + 6.1 * M, WZ, 0.06 * M, 4.0 * M, { seg: 4 });
    kit.sphere('emissive_red', WX, WH + 10.2 * M, WZ, 0.25 * M, { seg: 6 });
    kit.light(WX, WH + 10.2 * M, WZ, 0xff3020, 0.5);
    if (d > 0) {
      kit.add('metal_panel_white', new THREE.SphereGeometry(1.0 * M, 8, 6), { x: WX + 0.8 * M, y: WH + 6.3 * M, z: WZ });
      kit.light(WX, WH + 2.7 * M, WZ, 0xdcefff, 0.8);
    }
    // --- Flughafenfeuerwache (rechts vorn)
    kit.box('paint_white', 26.4 * M, 0, 15.6 * M, 6.4 * M, 5.0 * M, 6.0 * M);
    kit.box('paint_red', 26.4 * M, 5.0 * M, 15.6 * M, 6.6 * M, 0.5 * M, 6.2 * M);
    for (const s of [-1, 1]) kit.box('metal_corrugated', 26.4 * M + s * 1.5 * M, 0, 12.58 * M, 2.6 * M, 3.6 * M, 0.06 * M);
    // --- Hangar (links) mit Bogendach, Tor zum Vorfeld (+x)
    const HX = -27.0 * M, HZ = 4.0 * M, HW = 5.6 * M, HD = 13.0 * M, HH = 4.6 * M;
    kit.box('metal_corrugated', HX, 0, HZ, HW, HH, HD);
    const R = HD / 2 + 0.3 * M;
    kit.add('metal_corrugated', new THREE.CylinderGeometry(R, R, HW + 0.4 * M, d === 2 ? 16 : 8, 1, false, -Math.PI / 2, Math.PI), { x: HX, y: HH, z: HZ, rx: -Math.PI / 2, ry: Math.PI / 2, sz: 3.4 * M / R });
    kit.box('metal_panel_grey', HX + HW / 2 + 0.03 * M, 0.05 * M, HZ, 0.08 * M, HH + 1.8 * M, HD - 2.0 * M);
    if (d > 0) {
      for (let k = 1; k < 6; k++) kit.box('metal_dark', HX + HW / 2 + 0.08 * M, 0.05 * M, HZ - (HD - 2.0 * M) / 2 + (k * (HD - 2.0 * M)) / 6, 0.06 * M, HH + 1.8 * M, 0.12 * M);
      // Kleinflugzeug neben dem Hangar
      plane(kit, HX, 0.08 * M, 14.8 * M, Math.PI / 2, 0.24, { tail: 'paint_red', body: 'paint_white', glass: 'glass_curtain_blue' });
    }
    // --- Landseite: Vorfahrt am Terminal, Bäume, Fahnen, Windsack, Vorfeldbeleuchtung
    if (d > 0) {
      for (let k = 0; k < 3; k++) car(kit, (-12 + k * 7) * M, 19.5 * M, Math.PI / 2, k === 1 ? 'plaster_cream' : ['paint_red', 'paint_blue', 'metal_light'][k], { taxi: k === 1, glass: 'glass_curtain_blue', signMat: 'sign_white' });
      for (const [x, z] of [[-28.6, -18.4], [28.6, -18.4], [-28.6, 18.6], [29.0, 9.6], [-22.0, -18.6]]) tree(kit, x * M, z * M, 0.9, 'round');
      for (const x of [22.6, 24.0, 25.4]) flag(kit, x * M, 19.4 * M, 7.0 * M, x === 24.0 ? 'paint_blue' : 'paint_white');
      kit.cyl('metal_light', 27.0 * M, 0, -6.6 * M, 0.06 * M, 4.0 * M, { seg: 4 });
      kit.cone('paint_orange', 27.0 * M + 0.9 * M, 3.8 * M, -6.6 * M, 0.35 * M, 1.8 * M, { seg: 8, rz: -Math.PI / 2 });
      for (const x of [-20, -8, 4, 16]) lamp(kit, x * M, 12.4 * M, 7.0 * M, { head: 'sign_white', color: 0xdcefff, ry: Math.PI });
    }
    crowd(kit, -1.0 * M, 19.7 * M, 40 * M, 0.5 * M, 12);
    return kit.build();
  },
});
