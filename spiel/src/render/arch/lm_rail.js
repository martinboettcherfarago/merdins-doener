// Schienenverkehr: Straßenbahndepot (3 × 2, historische Backsteinhalle) und Hauptbahnhof (4 × 2) mit
// Empfangsgebäude, Uhrturm und gläserner Bahnsteighalle. Besitzer: G6.
// Gleise im Hauptbahnhof (Modellkoordinaten, vor Drehung): entlang x bei z = −0.68 und z = −0.24 (Welteinheiten),
// Schienenoberkante y = 0.012. Auf dem hinteren Gleis steht ein Zug, das vordere ist für einfahrende Züge frei.
import * as THREE from 'three';
import { registerArch } from './index.js';
import { M } from './kit.js';
import { beam, archWindow, archRing, slab, railing, lamp, bench, tree, flag, face, tram, railcar, torus, dormer } from './lm_parts.js';
import { text } from './lm_text.js';

// Gleis entlang x (Schotter, Schwellen, Schienen) von x0 bis x1 bei z
export function trackX(kit, x0, x1, z, o = {}) {
  const len = x1 - x0, cx = (x0 + x1) / 2, y0 = o.y0 || 0;
  if (o.ballast !== false) kit.box('ballast', cx, y0, z, len, 0.25 * M, 3.0 * M);
  if (kit.detail > 0) {
    const n = Math.round(len / (kit.detail === 2 ? 0.65 * M : 1.6 * M));
    for (let k = 0; k <= n; k++) kit.box('rail_track', x0 + (k * len) / n, y0 + 0.2 * M, z, 0.25 * M, 0.1 * M, 2.4 * M);
  }
  for (const s of [-1, 1]) kit.box('metal_light', cx, y0 + 0.28 * M, z + s * 0.72 * M, len, 0.15 * M, 0.08 * M);
}
// Gleis entlang z
function trackZ(kit, z0, z1, x, o = {}) {
  const len = z1 - z0, cz = (z0 + z1) / 2;
  if (o.paved) kit.box('stone_grey', x, 0, cz, 2.6 * M, 0.1 * M, len);
  else kit.box('ballast', x, 0, cz, 3.0 * M, 0.25 * M, len);
  if (kit.detail > 0 && !o.paved) {
    const n = Math.round(len / (kit.detail === 2 ? 0.65 * M : 1.6 * M));
    for (let k = 0; k <= n; k++) kit.box('rail_track', x, 0.2 * M, z0 + (k * len) / n, 2.4 * M, 0.1 * M, 0.25 * M);
  }
  for (const s of [-1, 1]) kit.box('metal_light', x + s * 0.72 * M, o.paved ? 0.08 * M : 0.28 * M, cz, 0.08 * M, 0.08 * M, len);
}

registerArch('tram_depot', {
  variants: 1,
  build(ctx) {
    const { kit, detail } = ctx;
    const BR = 'brick_red', TR = 'brick_yellow';
    kit.box('pavers', 0, 0, 0, 29.8 * M, 0.08 * M, 19.8 * M);
    // --- Halle mit drei Schiffen (je Satteldach mit Firstlaterne)
    const HZ0 = -9.6 * M, HZ1 = 3.6 * M, HD = HZ1 - HZ0, HZ = (HZ0 + HZ1) / 2, WH = 7.2 * M, BAY = 9.7 * M;
    kit.box(BR, 0, 0, HZ, BAY * 3, WH, HD);
    kit.box('stone_grey', 0, 0, HZ, BAY * 3 + 0.2 * M, 0.6 * M, HD + 0.2 * M);
    kit.band(TR, 0, HZ, BAY * 3, HD, 3.0 * M, 0.35 * M, 0.08 * M);
    kit.band(TR, 0, HZ, BAY * 3, HD, WH - 0.5 * M, 0.5 * M, 0.15 * M);
    for (let b = 0; b < 3; b++) {
      const x = -BAY + b * BAY, RH = 3.8 * M;
      kit.gableRoof('roof_slate', x, WH, HZ, BAY, HD, RH, { ridge: 'z', overhang: 0.3 * M });
      kit.box('glass_skylight', x, WH + RH - 0.2 * M, HZ, 1.6 * M, 0.9 * M, HD * 0.86, { lit: 0.6 });
      kit.gableRoof('roof_slate', x, WH + RH + 0.7 * M, HZ, 2.0 * M, HD * 0.86, 0.6 * M, { ridge: 'z', overhang: 0.15 * M });
      // Giebel an der Front: Ziergiebel mit Zinnen-Absätzen, Rundfenster
      const gz = HZ1 - 0.35 * M;
      kit.gableEnds(BR, x, WH, gz, BAY - 0.1 * M, 0.7 * M, RH, { ridge: 'z' });
      if (detail > 0) {
        kit.cyl(TR, x, WH + 1.6 * M, HZ1, 1.1 * M, 0.18 * M, { rx: Math.PI / 2, seg: 14 });
        kit.cyl(b === 1 ? 'paint_white' : 'glass_window', x, WH + 1.6 * M, HZ1 + 0.1 * M, 0.85 * M, 0.12 * M, { rx: Math.PI / 2, seg: 14, lit: 0.5 });
        if (b === 1) { beam(kit, 'metal_dark', [x, WH + 1.6 * M, HZ1 + 0.24 * M], [x, WH + 2.2 * M, HZ1 + 0.24 * M], 0.06 * M); beam(kit, 'metal_dark', [x, WH + 1.6 * M, HZ1 + 0.24 * M], [x + 0.4 * M, WH + 1.5 * M, HZ1 + 0.24 * M], 0.05 * M); }
        for (const s of [-1, 1]) {
          kit.box(TR, x + s * (BAY / 2 - 0.3 * M), WH - 0.4 * M, HZ1 + 0.1 * M, 0.7 * M, 1.4 * M, 0.5 * M);
          kit.cone(TR, x + s * (BAY / 2 - 0.3 * M), WH + 1.0 * M, HZ1 + 0.1 * M, 0.4 * M, 1.0 * M, { seg: 4, ry: Math.PI / 4 });
        }
      }
      // Tor mit Rundbogen
      const GW = 5.0 * M, GH = 5.6 * M;
      const [fx, fz] = face(x, HZ1, 0).at(0, 0.12 * M);
      slab(kit, TR, archRing(GW, GH, 0.5 * M, 'round', 10), 0.3 * M, { x: fx, y: 0, z: fz });
      if (b === 1) {
        slab(kit, 'asphalt_dark', [[-GW / 2, 0], [GW / 2, 0], [GW / 2, GH - GW / 2], ...Array.from({ length: 9 }, (_, i) => { const a = (i / 8) * Math.PI; return [Math.cos(a) * GW / 2, GH - GW / 2 + Math.sin(a) * GW / 2]; }), [-GW / 2, GH - GW / 2]], 0.05 * M, { x, y: 0, z: HZ1 + 0.02 * M });
      } else {
        slab(kit, 'paint_green', [[-GW / 2, 0], [GW / 2, 0], [GW / 2, GH - GW / 2], ...Array.from({ length: 9 }, (_, i) => { const a = (i / 8) * Math.PI; return [Math.cos(a) * GW / 2, GH - GW / 2 + Math.sin(a) * GW / 2]; }), [-GW / 2, GH - GW / 2]], 0.1 * M, { x, y: 0, z: HZ1 + 0.05 * M });
        if (detail > 0) {
          kit.box('metal_dark', x, 0, HZ1 + 0.11 * M, 0.12 * M, GH - 0.1 * M, 0.04 * M);
          for (const y of [1.0, 2.6]) kit.box('metal_dark', x, y * M, HZ1 + 0.11 * M, GW * 0.95, 0.1 * M, 0.04 * M);
          for (const s of [-1, 1]) kit.window(x + s * 1.2 * M, 3.6 * M, HZ1 + 0.1 * M, 0, 1.4 * M, 0.9 * M, { frame: 'paint_green', mullion: false });
        }
      }
    }
    // Seitenfenster (Rundbogen)
    for (const s of [-1, 1]) {
      const f = face(s * BAY * 1.5, HZ, s * Math.PI / 2);
      for (const u of [-4.4, -1.5, 1.5, 4.4]) { const [px, pz] = f.at(u * M, 0); archWindow(kit, px, 1.6 * M, pz, f.ry, 1.6 * M, 3.8 * M, { kind: 'round', frame: TR, glass: 'glass_window', mullions: 1, key: true, t: 0.22 * M }); }
    }
    // Schriftzug über dem Mitteltor
    kit.box(TR, 0, 6.2 * M, HZ1 + 0.18 * M, 7.0 * M, 0.8 * M, 0.12 * M);
    text(kit, 'trim_dark', 'STRASSENBAHN', 0, 6.32 * M, HZ1 + 0.26 * M, 0, 0.5 * M, { depth: 0.04 * M });
    // --- Gleise im Pflaster, Fahrleitung, zwei Straßenbahnen
    for (let b = 0; b < 3; b++) trackZ(kit, HZ1 - 6.0 * M * (b === 1 ? 1 : 0), 9.9 * M, -BAY + b * BAY, { paved: true });
    tram(kit, -BAY, 6.85 * M, 0, 'paint_red', { parts: 1, seg: 5.6 * M });
    tram(kit, BAY, 6.85 * M, 0, 'paint_yellow', { parts: 1, seg: 5.6 * M });
    tram(kit, 0, HZ1 + 1.0 * M, 0, 'paint_red', { parts: 1, seg: 8.0 * M });
    if (detail > 0) {
      for (const z of [5.0, 9.4]) {
        for (const s of [-1, 1]) kit.cyl('metal_dark', s * 14.4 * M, 0, z * M, 0.16 * M, 6.6 * M, { seg: 6 });
        beam(kit, 'metal_dark', [-14.4 * M, 6.4 * M, z * M], [14.4 * M, 6.4 * M, z * M], 0.06 * M);
      }
      for (let b = 0; b < 3; b++) beam(kit, 'metal_dark', [-BAY + b * BAY, 6.3 * M, HZ1], [-BAY + b * BAY, 6.3 * M, 9.9 * M], 0.04 * M);
      for (const s of [-1, 1]) lamp(kit, s * 4.8 * M, 9.4 * M, 4.2 * M, { style: 'old' });
      tree(kit, -14.0 * M, 8.6 * M, 0.7, 'round');
      tree(kit, 14.0 * M, 8.6 * M, 0.7, 'round');
    }
    return kit.build();
  },
});

registerArch('train_station', {
  variants: 1,
  build(ctx) {
    const { kit, detail } = ctx;
    const ST = 'stone_sandstone', TRM = 'trim_stone';
    kit.box('pavers', 0, 0, 0, 39.8 * M, 0.08 * M, 19.8 * M);
    // --- Gleisfeld und Bahnsteige in der Halle
    const T1 = -6.8 * M, T2 = -2.4 * M;
    for (const z of [T1, T2]) trackX(kit, -19.9 * M, 19.9 * M, z);
    const PH = 0.76 * M;
    for (const [z0, z1] of [[-9.8, -8.4], [-5.4, -3.8], [-0.95, 2.6]]) kit.box('concrete_panel', 0, 0, ((z0 + z1) / 2) * M, 39.8 * M, PH, (z1 - z0) * M);
    if (detail > 0) for (const z of [-8.5, -5.3, -3.9, -1.05]) kit.box('paint_white', 0, PH, z * M, 39.6 * M, 0.02 * M, 0.15 * M);
    // Bahnsteigausstattung
    if (detail > 0) for (const x of [-14, -6, 2, 10]) {
      kit.cyl('metal_dark', x * M, PH, -4.6 * M, 0.08 * M, 3.0 * M, { seg: 5 });
      kit.box('glass_window', x * M, PH + 3.0 * M, -4.6 * M, 0.12 * M, 0.7 * M, 2.4 * M, { lit: 1 });
      if (detail === 2) { bench(kit, (x + 3) * M, -4.6 * M + 0.0001, 0); kit.box('paint_blue', (x + 1.5) * M, PH, 0.6 * M, 0.08 * M, 2.4 * M, 1.2 * M); }
    }
    // Zug auf dem hinteren Gleis (Triebkopf + Wagen)
    const ZY = 0.28 * M;
    railcar(kit, -12.0 * M, ZY, T1, Math.PI / 2, 9.0 * M, { body: 'paint_white', stripe: 'paint_red' });
    railcar(kit, -2.6 * M, ZY, T1, Math.PI / 2, 9.0 * M, { body: 'paint_white', stripe: 'paint_red' });
    railcar(kit, 6.8 * M, ZY, T1, Math.PI / 2, 9.0 * M, { body: 'paint_white', stripe: 'paint_red' });
    kit.add('paint_white', new THREE.SphereGeometry(1.5 * M, 10, 6, 0, Math.PI), { x: 11.3 * M, y: ZY + 1.9 * M, z: T1, ry: Math.PI / 2, sx: 1, sy: 1.0, sz: 2.2 });
    if (detail > 0) kit.box('glass_window', 12.6 * M, ZY + 2.6 * M, T1, 0.9 * M, 0.8 * M, 2.0 * M, { rz: -0.6, lit: 0 });
    // --- Bahnsteighalle: Tonnengewölbe aus Glas mit Stahlbögen, entlang x
    const VZ = -3.6 * M, VR = 6.4 * M, VY = 5.0 * M, VL = 39.8 * M;
    for (const s of [-1, 1]) {
      kit.box(ST, 0, 0, VZ + s * (VR - 0.2 * M), VL, VY, 0.5 * M);
      if (detail > 0 && s < 0) for (let x = -18; x <= 18; x += 4) archWindow(kit, x * M, 1.4 * M, VZ - VR - 0.06 * M, Math.PI, 2.2 * M, 3.0 * M, { kind: 'round', frame: TRM, mullions: 1 });
    }
    const vault = new THREE.CylinderGeometry(VR, VR, VL, detail === 2 ? 18 : detail === 1 ? 10 : 6, 1, true, -Math.PI / 2, Math.PI);
    kit.add('glass_skylight', vault, { x: 0, y: VY, z: VZ, rx: -Math.PI / 2, ry: Math.PI / 2, sz: 0.62, lit: 0.4 });
    const nArch = detail === 2 ? 11 : detail === 1 ? 6 : 3;
    for (let k = 0; k < nArch; k++) {
      const x = -VL / 2 + 0.4 * M + (k * (VL - 0.8 * M)) / (nArch - 1);
      kit.add('metal_panel_grey', new THREE.TorusGeometry(VR + 0.05 * M, 0.18 * M, 3, 14, Math.PI), { x, y: VY, z: VZ, ry: Math.PI / 2, sy: 0.62 });
    }
    kit.box('metal_panel_grey', 0, VY + VR * 0.62, VZ, VL, 0.25 * M, 1.6 * M);
    // Giebelabschluss an den Hallenenden (Stahlrahmen mit Glas, unten offen für die Züge)
    if (detail > 0) for (const s of [-1, 1]) {
      const pts = [];
      for (let k = 0; k <= 12; k++) { const a = (k / 12) * Math.PI; pts.push([Math.cos(a) * VR, Math.sin(a) * VR * 0.62]); }
      const shp = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));
      kit.add('glass_skylight', new THREE.ShapeGeometry(shp, 2), { x: s * (VL / 2 - 0.1 * M), y: VY, z: VZ, ry: s * Math.PI / 2, lit: 0.4 });
      kit.box('metal_panel_grey', s * (VL / 2 - 0.1 * M), VY - 0.3 * M, VZ, 0.4 * M, 0.6 * M, VR * 2);
    }
    // --- Empfangsgebäude
    const FZ0 = 2.6 * M, FZ1 = 9.4 * M, FD = FZ1 - FZ0, FZ = (FZ0 + FZ1) / 2;
    // Flügel
    for (const s of [-1, 1]) {
      const cx = s * 11.0 * M, w = 12.0 * M, h = 9.4 * M;
      kit.box(ST, cx, 0, FZ, w, h, FD);
      kit.box('stone_grey', cx, 0, FZ, w + 0.2 * M, 1.0 * M, FD + 0.2 * M);
      kit.band(TRM, cx, FZ, w, FD, 4.4 * M, 0.3 * M, 0.12 * M);
      kit.band(TRM, cx, FZ, w, FD, h - 0.6 * M, 0.6 * M, 0.25 * M);
      kit.hipRoof('roof_slate', cx, h, FZ, w, FD, 3.0 * M, { overhang: 0.3 * M, ridgeK: 0.85 });
      const f = face(cx, FZ1, 0);
      for (const u of [-4.4, -2.2, 0, 2.2, 4.4]) {
        const [px, pz] = f.at(u * M, 0);
        archWindow(kit, px, 1.4 * M, pz, 0, 1.4 * M, 2.6 * M, { kind: 'round', frame: TRM, mullions: 0, key: true });
        archWindow(kit, px, 5.2 * M, pz, 0, 1.2 * M, 2.4 * M, { kind: 'segment', frame: TRM, mullions: 1 });
      }
      for (const fs of [face(cx + s * w / 2, FZ, s * Math.PI / 2)]) for (const u of [-1.6, 1.6]) {
        const [px, pz] = fs.at(u * M, 0);
        archWindow(kit, px, 5.2 * M, pz, fs.ry, 1.2 * M, 2.4 * M, { kind: 'segment', frame: TRM, mullions: 1 });
      }
      if (detail > 0) for (const u of [-3.3, 3.3]) dormer(kit, cx + u * M, 9.6 * M, FZ1 - 0.5 * M, 0, 1.3 * M, 1.4 * M);
    }
    // Mittelhalle mit großem Bogenfenster
    const MW = 10.0 * M, MH = 14.0 * M;
    kit.box(ST, 0, 0, FZ, MW, MH, FD + 0.6 * M);
    kit.box('stone_grey', 0, 0, FZ, MW + 0.2 * M, 1.0 * M, FD + 0.8 * M);
    kit.band(TRM, 0, FZ, MW, FD + 0.6 * M, MH - 0.8 * M, 0.8 * M, 0.3 * M);
    kit.gableRoof('roof_slate', 0, MH, FZ, MW, FD + 0.6 * M, 3.6 * M, { ridge: 'z', overhang: 0.3 * M });
    kit.gableEnds(ST, 0, MH, FZ1 + 0.1 * M, MW, 0.6 * M, 3.6 * M, { ridge: 'z' });
    const [ax, az] = face(0, FZ1 + 0.3 * M, 0).at(0, 0);
    archWindow(kit, ax, 2.2 * M, az, 0, 7.0 * M, 9.6 * M, { kind: 'round', frame: TRM, mullions: 3, t: 0.5 * M, key: true });
    if (detail > 0) {
      for (const y of [4.2, 7.0]) kit.box(TRM, ax, y * M, az + 0.06 * M, 7.0 * M, 0.12 * M, 0.06 * M);
      kit.box(TRM, 0, MH - 2.6 * M, FZ1 + 0.4 * M, 9.0 * M, 1.2 * M, 0.25 * M);
    }
    text(kit, 'trim_dark', 'HAUPTBAHNHOF', 0, MH - 2.42 * M, FZ1 + 0.55 * M, 0, 0.75 * M, { depth: 0.06 * M });
    // Vordach aus Glas und Stahl
    kit.box('glass_skylight', 0, 4.4 * M, FZ1 + 2.0 * M, 13.0 * M, 0.15 * M, 3.6 * M, { lit: 0.3 });
    if (detail > 0) {
      for (const x of [-6, -2, 2, 6]) kit.cyl('metal_dark', x * M, 0, FZ1 + 3.4 * M, 0.12 * M, 4.4 * M, { seg: 6 });
      kit.box('metal_dark', 0, 4.3 * M, FZ1 + 3.6 * M, 13.2 * M, 0.3 * M, 0.2 * M);
      kit.box('emissive_warm', 0, 4.35 * M, FZ1 + 2.0 * M, 11.0 * M, 0.04 * M, 0.25 * M);
    }
    // Uhrturm mit Kupferhaube
    const TX = 7.4 * M, TZ = FZ1 - 1.6 * M, TW = 3.4 * M, TH = 22 * M;
    kit.box(ST, TX, 0, TZ, TW, TH, TW);
    kit.band(TRM, TX, TZ, TW, TW, 9.4 * M, 0.4 * M, 0.15 * M);
    kit.band(TRM, TX, TZ, TW, TW, TH - 0.6 * M, 0.6 * M, 0.3 * M);
    for (const [fx, fz, ry] of [[TX, TZ + TW / 2, 0], [TX + TW / 2, TZ, Math.PI / 2], [TX - TW / 2, TZ, -Math.PI / 2], [TX, TZ - TW / 2, Math.PI]]) {
      const f = face(fx, fz, ry);
      let [px, pz] = f.at(0, 0.05 * M);
      kit.cyl('paint_white', px, TH - 3.2 * M, pz, 1.1 * M, 0.1 * M, { rx: Math.PI / 2, ry, seg: detail === 2 ? 20 : 10 });
      if (detail > 0) {
        torus(kit, 'metal_dark', px, TH - 3.2 * M, pz + 0, 1.1 * M, 0.08 * M, { ry, tubular: 16, radial: 3 });
        [px, pz] = f.at(0, 0.18 * M);
        kit.add('metal_dark', new THREE.BoxGeometry(0.08 * M, 0.75 * M, 0.04 * M), { x: px, y: TH - 3.2 * M + 0.3 * M, z: pz, ry, rz: 0.4 });
        kit.add('metal_dark', new THREE.BoxGeometry(0.08 * M, 0.5 * M, 0.04 * M), { x: px, y: TH - 3.2 * M + 0.1 * M, z: pz, ry, rz: -1.9 });
        const [wx, wz] = f.at(0, 0);
        archWindow(kit, wx, 11.0 * M, wz, ry, 1.0 * M, 3.4 * M, { kind: 'round', frame: TRM, mullions: 0 });
      }
    }
    kit.light(TX, TH - 3.2 * M, TZ + TW / 2 + 0.2 * M, 0xfff3d0, 0.5);
    kit.hipRoof('roof_copper', TX, TH, TZ, TW, TW, 2.0 * M, { overhang: 0.2 * M, ridgeK: 0.55 });
    kit.cone('roof_copper', TX, TH + 2.0 * M, TZ, 1.0 * M, 3.4 * M, { seg: 8 });
    kit.cyl('metal_dark', TX, TH + 5.2 * M, TZ, 0.05 * M, 1.4 * M, { seg: 4 });
    kit.sphere('paint_yellow', TX, TH + 6.7 * M, TZ, 0.2 * M, { seg: 6 });
    // Vorplatz: Laternen, Bäume, Fahrradständer, Taxistand
    if (detail > 0) {
      for (const x of [-16, -9, 9, 16]) lamp(kit, x * M, 9.6 * M, 4.6 * M, { style: 'old' });
      for (const x of [-18.6, 18.6]) tree(kit, x * M, 9.2 * M, 0.8, 'round');
      if (detail === 2) for (let k = 0; k < 8; k++) kit.box('metal_dark', (-14 + k * 0.6) * M, 0, 9.7 * M, 0.04 * M, 0.8 * M, 0.6 * M);
      flag(kit, -4.6 * M, 9.6 * M, 6.0 * M, 'paint_red');
    }
    void railing;
    return kit.build();
  },
});
