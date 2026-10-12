// Riesenrad (2 × 2): Doppelfelgen-Rad mit Speichen, runden Panoramagondeln und Lichterketten (dreht sich über
// res.anim um die z-Achse), A-Böcke, Einstiegsplattform, Kasse, Warteschlange. Besitzer: G6.
import * as THREE from 'three';
import { registerArch } from './index.js';
import { M } from './kit.js';
import { beam, rod, torus, railing, lamp, bench, tree, flag, hut, addAnim, face } from './lm_parts.js';
import { text } from './lm_text.js';

const CAB_COLORS = ['paint_red', 'paint_blue', 'paint_yellow', 'paint_green', 'paint_orange', 'paint_white'];

// Statischer Teil: A-Böcke, Achse, Plattform. Liefert die Nabenhöhe.
export function ferrisStand(kit, x, z, R, hub, o = {}) {
  const W = o.width ?? 2.6 * M; // Radbreite (Abstand der Felgen)
  const legX = R * 0.62, legZ = W / 2 + 1.4 * M;
  const steel = o.steel || 'paint_white';
  for (const sz of [-1, 1]) {
    const zz = z + sz * legZ;
    for (const sx of [-1, 1]) {
      beam(kit, steel, [x + sx * legX, 0, zz + sz * 0.6 * M], [x + sx * 0.25 * M, hub, z + sz * (W / 2 + 0.55 * M)], 0.45 * M, 0.45 * M);
      kit.box('concrete', x + sx * legX, 0, zz + sz * 0.6 * M, 1.4 * M, 0.5 * M, 1.4 * M);
    }
    if (kit.detail > 0) {
      // Querstreben der A-Böcke
      for (const t of [0.3, 0.62]) {
        const y = hub * t, dx = legX + (0.25 * M - legX) * t;
        beam(kit, steel, [x - dx, y, zz + sz * 0.6 * M * (1 - t)], [x + dx, y, zz + sz * 0.6 * M * (1 - t)], 0.22 * M, 0.22 * M);
      }
      if (kit.detail === 2) for (const sx of [-1, 1]) {
        const t0 = 0.3, t1 = 0.62;
        beam(kit, steel, [x + sx * (legX + (0.25 * M - legX) * t0), hub * t0, zz], [x - sx * (legX + (0.25 * M - legX) * t1), hub * t1, zz], 0.14 * M, 0.14 * M);
      }
    }
  }
  // Achse und Lagerböcke
  kit.cyl('metal_dark', x, hub, z - legZ, 0.35 * M, legZ * 2, { rx: Math.PI / 2, seg: 10 });
  for (const sz of [-1, 1]) kit.box('metal_dark', x, hub - 0.6 * M, z + sz * (W / 2 + 0.6 * M), 0.9 * M, 1.2 * M, 0.6 * M);
  if (kit.detail > 0) kit.light(x, hub, z + legZ, 0xffe2b0, 0.6);
  return { legZ, W };
}

// Drehender Teil (Geometrie relativ zur Nabe)
export function ferrisWheel(k, R, o = {}) {
  const W = o.width ?? 2.6 * M, n = o.cabins ?? 16, d = k.detail;
  const steel = o.steel || 'paint_white';
  const tub = d === 2 ? 56 : d === 1 ? 32 : 18;
  for (const s of [-1, 1]) {
    torus(k, steel, 0, 0, s * W / 2, R, 0.14 * M, { tubular: tub, radial: d === 2 ? 5 : 3 });
    if (d > 0) torus(k, steel, 0, 0, s * W / 2, R * 0.86, 0.08 * M, { tubular: tub, radial: 3 });
    if (d > 0) torus(k, 'metal_light', 0, 0, s * W / 2, 0.9 * M, 0.2 * M, { tubular: 12, radial: 4 });
  }
  k.cyl('metal_light', 0, 0, -W / 2 - 0.3 * M, 0.7 * M, W + 0.6 * M, { rx: Math.PI / 2, seg: 12, x: 0, y: 0 });
  const sp = d === 2 ? Math.round(n * 1.5) : d === 1 ? n : Math.max(6, n >> 1);
  for (let i = 0; i < sp; i++) {
    const a = (i / sp) * Math.PI * 2;
    const c = Math.cos(a), sn = Math.sin(a);
    for (const s of [-1, 1]) {
      // Speichen (gekreuzt von Nabe zur Felge)
      rod(k, steel, [c * 0.8 * M, sn * 0.8 * M, s * (W / 2 + 0.35 * M)], [c * R, sn * R, s * W / 2], 0.05 * M, 3);
    }
    if (d > 0 && i % Math.max(1, Math.round(sp / n)) === 0) {
      beam(k, steel, [c * R, sn * R, -W / 2], [c * R, sn * R, W / 2], 0.18 * M, 0.18 * M);
      if (d === 2) {
        const a2 = a + Math.PI / n;
        beam(k, steel, [c * R, sn * R, -W / 2], [Math.cos(a2) * R, Math.sin(a2) * R, W / 2], 0.08 * M, 0.08 * M);
      }
    }
  }
  // Panoramagondeln (Zylinder entlang der Drehachse – sie bleiben dadurch scheinbar waagrecht)
  const cr = o.cabR ?? 0.9 * M, cl = W + 0.3 * M;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / n;
    const rr = R + cr + 0.25 * M;
    const cx = Math.cos(a) * rr, cy = Math.sin(a) * rr;
    const seg = d === 2 ? 14 : 8;
    const col = CAB_COLORS[i % CAB_COLORS.length];
    if (d === 0) { k.cyl(col, cx, cy, -cl / 2, cr, cl, { rx: Math.PI / 2, seg: 5 }); continue; }
    k.cyl(o.glass || 'glass_skylight', cx, cy, -cl / 2, cr * 0.97, cl, { rx: Math.PI / 2, seg, lit: 0.7 + (i % 4) * 0.07 });
    for (const zz of [-cl / 2 - 0.04 * M, cl / 2 - 0.1 * M]) k.cyl(col, cx, cy, zz, cr, 0.14 * M, { rx: Math.PI / 2, seg });
    if (d > 0) {
      k.cyl(col, cx, cy, -0.35 * M, cr * 1.02, 0.7 * M, { rx: Math.PI / 2, seg });
      k.cyl('metal_light', cx, cy, -cl / 2 - 0.12 * M, cr * 0.35, cl + 0.24 * M, { rx: Math.PI / 2, seg: 6 });
      beam(k, steel, [Math.cos(a) * R, Math.sin(a) * R, 0], [cx - Math.cos(a) * cr, cy - Math.sin(a) * cr, 0], 0.16 * M, 0.3 * M);
    }
  }
  // Lichterketten auf den Felgen
  if (d > 0) {
    const nb = d === 2 ? 64 : 24;
    for (const s of [-1, 1]) for (let i = 0; i < nb; i++) {
      const a = (i / nb) * Math.PI * 2;
      k.box(o.bulbs || 'emissive_warm', Math.cos(a) * (R + 0.16 * M), Math.sin(a) * (R + 0.16 * M), s * (W / 2 + 0.05 * M), 0.18 * M, 0.18 * M, 0.18 * M);
    }
    if (d === 2) for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      for (const t of [0.35, 0.6]) k.box(o.bulbs || 'emissive_warm', Math.cos(a) * R * t, Math.sin(a) * R * t, W / 2 + 0.25 * M, 0.14 * M, 0.14 * M, 0.14 * M);
    }
  }
}

registerArch('ferris', {
  variants: 1,
  build(ctx) {
    const { kit, detail } = ctx;
    const R = 12.5 * M, HUB = R + 3.7 * M, ZW = -1.5 * M;
    // --- Platz
    kit.box('pavers', 0, 0, 0, 19.8 * M, 0.08 * M, 19.8 * M);
    kit.box('stone_grey', 0, 0, 8.4 * M, 19.8 * M, 0.1 * M, 3.0 * M);
    for (const s of [-1, 1]) {
      kit.box('grass', s * 7.6 * M, 0.02 * M, -6.8 * M, 4.4 * M, 0.1 * M, 6.0 * M);
      kit.box('stone_grey', s * 7.6 * M, 0, -6.8 * M, 4.7 * M, 0.25 * M, 6.3 * M);
    }
    const { legZ } = ferrisStand(kit, 0, ZW, R, HUB);
    // --- Einstiegsplattform mit Dach unter dem tiefsten Punkt
    const PY = 1.2 * M, PZ = ZW;
    kit.box('concrete', 0, 0, PZ, 7.0 * M, PY, legZ * 2 - 1.2 * M);
    kit.box('wood_planks', 0, PY, PZ, 7.0 * M, 0.06 * M, legZ * 2 - 1.2 * M);
    for (const s of [-1, 1]) {
      // Treppen vorn
      for (let k = 0; k < 6; k++) kit.box('concrete', s * 2.4 * M, 0, PZ + legZ - 0.6 * M + (k + 0.5) * 0.35 * M, 1.6 * M, PY * (1 - k / 6), 0.36 * M);
      railing(kit, [[s * 3.4 * M, PZ - legZ + 0.6 * M], [s * 3.4 * M, PZ + legZ - 0.6 * M]], PY, 1.0 * M, { mat: 'metal_light' });
    }
    if (detail > 0) {
      // Bahnsteigdach (zweiteilig, damit die Gondeln durchfahren)
      for (const s of [-1, 1]) {
        const zz = PZ + s * (legZ - 0.5 * M);
        for (const x of [-3.2, 3.2]) kit.cyl('metal_light', x * M, PY, zz, 0.08 * M, 2.4 * M, { seg: 6 });
        kit.box('paint_red', 0, PY + 2.4 * M, zz, 7.2 * M, 0.15 * M, 1.4 * M, { rx: s * 0.12 });
        kit.box('emissive_warm', 0, PY + 2.38 * M, zz, 5.0 * M, 0.04 * M, 0.2 * M);
      }
    }
    // --- Kasse und Kiosk mit Schriftzug
    hut(kit, -6.6 * M, 6.0 * M, 0, 3.4 * M, 2.4 * M, 2.6 * M, { wall: 'siding_white', roof: 'roof_metal_grey', counter: true, awning: 'awning_striped' });
    hut(kit, 6.6 * M, 6.0 * M, 0, 3.0 * M, 2.4 * M, 2.6 * M, { wall: 'siding_red', roof: 'roof_metal_grey', counter: true, awning: 'awning_yellow' });
    // Torbogen mit Schriftzug „RIESENRAD"
    kit.box('paint_red', -4.4 * M, 0, 8.6 * M, 0.4 * M, 4.2 * M, 0.4 * M);
    kit.box('paint_red', 4.4 * M, 0, 8.6 * M, 0.4 * M, 4.2 * M, 0.4 * M);
    kit.box('paint_white', 0, 3.4 * M, 8.6 * M, 9.4 * M, 1.0 * M, 0.3 * M);
    text(kit, 'paint_red', 'RIESENRAD', 0, 3.55 * M, 8.79 * M, 0, 0.65 * M, { depth: 0.08 * M });
    if (detail > 0) for (let i = 0; i < 12; i++) kit.box('emissive_warm', -4.4 * M + i * 0.8 * M, 4.45 * M, 8.6 * M, 0.16 * M, 0.16 * M, 0.16 * M);
    // Warteschlange mit Absperrungen
    if (detail === 2) {
      for (const zz of [3.4, 4.8]) railing(kit, [[-3.5 * M, zz * M], [3.5 * M, zz * M]], 0, 0.9 * M, { mat: 'metal_light', spacing: 1.2 * M });
      for (const s of [-1, 1]) { flag(kit, s * 9.0 * M, 8.8 * M, 6.5 * M, s > 0 ? 'paint_yellow' : 'paint_blue'); lamp(kit, s * 9.2 * M, 2.0 * M, 4.0 * M, { style: 'globe' }); bench(kit, s * 6.6 * M, 2.6 * M, s * Math.PI / 2); }
      for (const [x, z] of [[-8.6, -8.6], [8.6, -8.6], [-8.8, -4.6], [8.8, -4.6]]) tree(kit, x * M, z * M, 0.8, 'round');
    }
    const res = kit.build();
    addAnim(ctx, res, [0, HUB, ZW], 'z', 0.12, (k) => ferrisWheel(k, R));
    return res;
  },
});
