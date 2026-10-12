// Pulsbahn: Hochbahnsteig `station` (1 × 1, steht über der Straße) und Umsteigebahnhof `metro_hub` (2 × 1).
// Bahnsteigoberkante liegt auf TRANSIT.trackHeight (Oberkante Fahrbalken, dort stehen die Züge). Besitzer: G6.
// Hinweis für die Ansicht: Die Fahrrichtung ist beliebig – deshalb keine Geländer an den Bahnsteigkanten, Stützen
// nur in den Ecken bzw. an den Rändern; das Dach liegt unter TRANSIT.trackHeight + 0.44 (Stationssymbol darüber).
import * as THREE from 'three';
import { registerArch } from './index.js';
import { M } from './kit.js';
import { TRANSIT } from '../../config.js';
import { beam, rod, lathe, glassRail, lamp, bench, face, tube } from './lm_parts.js';
import { text } from './lm_text.js';

const H = TRANSIT.trackHeight;

// Gläserner Aufzugsschacht mit Kabine
function elevator(kit, x, z, top, w = 1.5 * M) {
  kit.box('concrete', x, 0, z, w + 0.3 * M, 0.3 * M, w + 0.3 * M);
  kit.box('glass_curtain_blue', x, 0.3 * M, z, w, top - 0.3 * M, w, { lit: 0.5 });
  if (kit.detail > 0) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.box('metal_dark', x + sx * w / 2, 0.3 * M, z + sz * w / 2, 0.14 * M, top - 0.3 * M, 0.14 * M);
    const n = Math.max(2, Math.round(top / (3.2 * M)));
    for (let k = 1; k <= n; k++) kit.box('metal_dark', x, (k * top) / n - 0.06 * M, z, w + 0.12 * M, 0.12 * M, w + 0.12 * M);
    kit.box('metal_panel_white', x, top * 0.45, z, w * 0.8, 2.3 * M, w * 0.8);
  }
  kit.box('metal_dark', x, top, z, w + 0.2 * M, 0.5 * M, w + 0.2 * M);
}

// Wendeltreppe um eine Stütze
function spiralStair(kit, x, z, top, r = 0.95 * M) {
  const d = kit.detail;
  kit.cyl('concrete', x, 0, z, 0.28 * M, top, { seg: 8 });
  if (d === 0) { tube(kit, 'metal_light', helix(x, z, r, top, 12), 0.25 * M, { tubular: 48, radial: 3 }); return; }
  const turns = top / (3.0 * M), steps = d === 2 ? Math.round(turns * 14) : Math.round(turns * 5);
  for (let i = 0; i < steps; i++) {
    const t = i / steps, a = t * turns * Math.PI * 2, y = t * top;
    const cx = x + Math.cos(a) * r * 0.55, cz = z + Math.sin(a) * r * 0.55;
    kit.add('concrete_panel', new THREE.BoxGeometry(r * 1.1, 0.12 * M, d === 2 ? 0.42 * M : 1.1 * M), { x: cx, y: y + 0.06 * M, z: cz, ry: -a });
  }
  tube(kit, 'metal_dark', helix(x, z, r * 1.08, top, Math.round(turns * 10), 1.0 * M), 0.04 * M, { tubular: Math.round(turns * 24), radial: 3 });
}
function helix(x, z, r, top, n, dy = 0) {
  const turns = top / (3.0 * M), pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, a = t * turns * Math.PI * 2; pts.push([x + Math.cos(a) * r, t * top + dy, z + Math.sin(a) * r]); }
  return pts;
}

// Bahnsteigdach mit Stützen, Lichtband und Schriftzug
function canopy(kit, cx, cz, sx, sz, y0, posts) {
  const RH = 4.1 * M;
  for (const [px, pz] of posts) kit.cyl('metal_light', px, y0, pz, 0.12 * M, RH, { seg: 8 });
  kit.box('metal_panel_white', cx, y0 + RH, cz, sx, 0.3 * M, sz);
  if (kit.detail > 0) {
    kit.box('glass_curtain_blue', cx, y0 + RH + 0.02 * M, cz, sx * 0.5, 0.3 * M, sz * 0.5, { lit: 0.5 });
    kit.box('emissive_cool', cx, y0 + RH - 0.04 * M, cz, sx * 0.7, 0.05 * M, 0.25 * M);
    kit.box('emissive_cool', cx, y0 + RH - 0.04 * M, cz, 0.25 * M, 0.05 * M, sz * 0.7);
    for (const [fx, fz, ry, len] of [[cx, cz + sz / 2, 0, sx], [cx, cz - sz / 2, Math.PI, sx], [cx + sx / 2, cz, Math.PI / 2, sz], [cx - sx / 2, cz, -Math.PI / 2, sz]]) {
      const [tx, tz] = face(fx, fz, ry).at(0, 0.02 * M);
      kit.box('paint_blue', tx, y0 + RH - 0.02 * M, tz, len, 0.34 * M, 0.04 * M, { ry });
      if (kit.detail === 2) { const [qx, qz] = face(fx, fz, ry).at(0, 0.05 * M); text(kit, 'paint_white', 'PULSBAHN', qx, y0 + RH + 0.02 * M, qz, ry, 0.24 * M, { depth: 0.02 * M }); }
    }
  }
  kit.light(cx, y0 + RH - 0.2 * M, cz, 0xdcefff, 0.7);
}

registerArch('station', {
  variants: 1,
  build(ctx) {
    const { kit, detail } = ctx;
    const C = 4.35 * M; // Eckstützen
    // Stützen in den vier Ecken (außerhalb der Fahrbahn), Querträger unter dem Bahnsteig
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      if (sx > 0 && sz > 0) continue; // dort steht der Aufzug
      if (sx < 0 && sz < 0) { spiralStair(kit, sx * C, sz * C, H - 0.25 * M); continue; }
      kit.cyl('concrete', sx * C, 0, sz * C, 0.4 * M, H - 0.25 * M, { seg: 10, rTop: 0.32 * M });
      kit.cyl('concrete_dark', sx * C, 0, sz * C, 0.55 * M, 0.5 * M, { seg: 10 });
    }
    elevator(kit, C - 0.2 * M, C - 0.2 * M, H + 3.6 * M, 1.3 * M);
    for (const s of [-1, 1]) {
      kit.box('concrete', 0, H - 1.1 * M, s * C, 9.6 * M, 0.85 * M, 0.7 * M);
      kit.box('concrete', s * C, H - 1.1 * M, 0, 0.7 * M, 0.85 * M, 9.6 * M);
    }
    // Bahnsteigplatte: Oberkante knapp unter der Fahrbahnoberkante (Zugboden)
    kit.box('concrete_panel', 0, H - 0.3 * M, 0, 9.8 * M, 0.29 * M, 9.8 * M);
    if (detail > 0) {
      // Taktiler Leitstreifen und Sicherheitslinie um die Fahrspur
      kit.box('paint_white', 0, H - 0.005 * M, 0, 9.7 * M, 0.02 * M, 9.7 * M);
      kit.box('concrete_panel', 0, H, 0, 9.0 * M, 0.02 * M, 9.0 * M);
      kit.box('paint_yellow', 0, H + 0.005 * M, 0, 3.4 * M, 0.02 * M, 3.4 * M);
      kit.box('concrete_panel', 0, H + 0.012 * M, 0, 3.0 * M, 0.02 * M, 3.0 * M);
    }
    // Dach auf vier Stützen
    canopy(kit, 0, 0, 9.4 * M, 9.4 * M, H, [[-4.2 * M, -4.2 * M], [4.2 * M, -4.2 * M], [-4.2 * M, 4.2 * M], [4.2 * M, 4.2 * M]]);
    // Ausstattung an den Ecken: Bänke, Anzeigetafel, Fahrkartenautomat
    if (detail === 2) {
      bench(kit, -3.4 * M, 3.4 * M, Math.PI / 4 + Math.PI);
      kit.add('wood_planks', new THREE.BoxGeometry(1.6 * M, 0.06 * M, 0.45 * M), { x: 3.4 * M, y: H + 0.42 * M, z: -3.4 * M, ry: Math.PI / 4 });
      kit.cyl('metal_dark', -3.3 * M, H, -3.3 * M, 0.06 * M, 2.4 * M, { seg: 5 });
      kit.box('glass_curtain_blue', -3.3 * M, H + 2.4 * M, -3.3 * M, 1.4 * M, 0.5 * M, 0.12 * M, { ry: Math.PI / 4, lit: 1 });
      kit.box('paint_blue', 3.6 * M, H, 2.4 * M, 0.5 * M, 1.6 * M, 0.4 * M);
      kit.box('glass_curtain_blue', 3.6 * M, H + 1.0 * M, 2.62 * M, 0.35 * M, 0.4 * M, 0.02 * M, { lit: 1 });
    }
    // Bodenebene: Eingang am Aufzug und Fahrkartenautomat
    if (detail > 0) {
      kit.box('paint_blue', C - 0.2 * M, 2.4 * M, C + 0.52 * M, 1.3 * M, 0.5 * M, 0.06 * M);
      if (detail === 2) text(kit, 'paint_white', 'P', C - 0.2 * M, 2.45 * M, C + 0.56 * M, 0, 0.36 * M, { depth: 0.02 * M });
    }
    return kit.build();
  },
});

registerArch('metro_hub', {
  variants: 1,
  build(ctx) {
    const { kit, detail } = ctx;
    const W = 19.6 * M, D = 9.6 * M;
    kit.box('pavers', 0, 0, 0, 19.8 * M, 0.08 * M, 9.8 * M);
    // Empfangshalle am Boden (Glas mit weißem Rahmen)
    const GH = 6.0 * M;
    kit.box('stone_dark', 0, 0, -0.6 * M, 14.0 * M, 0.3 * M, 7.0 * M);
    kit.box('glass_curtain_blue', 0, 0.3 * M, -0.6 * M, 13.6 * M, GH - 0.3 * M, 6.6 * M, { lit: 0.95 });
    if (detail > 0) {
      for (let k = 0; k <= 10; k++) kit.box('metal_panel_white', -6.8 * M + k * 1.36 * M, 0.3 * M, 2.72 * M, 0.14 * M, GH - 0.3 * M, 0.14 * M);
      kit.box('metal_panel_white', 0, 3.1 * M, 2.72 * M, 13.6 * M, 0.16 * M, 0.16 * M);
    }
    kit.box('metal_panel_white', 0, GH, -0.6 * M, 14.4 * M, 0.5 * M, 7.4 * M);
    kit.box('metal_panel_white', 0, GH - 0.4 * M, 3.6 * M, 8.0 * M, 0.3 * M, 2.4 * M);
    kit.box('paint_blue', 0, GH + 0.5 * M, 2.9 * M, 7.0 * M, 1.0 * M, 0.2 * M);
    text(kit, 'paint_white', 'PULSBAHN', 0, GH + 0.65 * M, 3.02 * M, 0, 0.6 * M, { depth: 0.05 * M });
    // Tragwerk: vier große Stützen und zwei Treppen-/Aufzugstürme an den Enden
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        if (sz > 0) continue;
        kit.cyl('concrete', sx * 5.4 * M, 0, sz * 3.8 * M, 0.6 * M, H - 0.6 * M, { seg: 12, rTop: 0.5 * M });
      }
      const tx = sx * 8.6 * M;
      kit.box('concrete_panel', tx, 0, -1.0 * M, 2.4 * M, H + 0.2 * M, 3.2 * M);
      kit.box('glass_curtain_blue', tx, 0.6 * M, 0.62 * M, 2.0 * M, H - 1.0 * M, 0.06 * M, { lit: 0.6 });
      if (detail > 0) for (let y = 3.2 * M; y < H; y += 3.2 * M) kit.box('metal_dark', tx, y, 0.66 * M, 2.1 * M, 0.12 * M, 0.08 * M);
      kit.box('paint_blue', tx, H - 3.0 * M, 0.7 * M, 1.4 * M, 1.4 * M, 0.08 * M);
      if (detail > 0) text(kit, 'paint_white', 'P', tx, H - 2.75 * M, 0.75 * M, 0, 0.9 * M, { depth: 0.03 * M });
    }
    // Rolltreppenröhren vom Hallendach zum Bahnsteig
    for (const s of [-1, 1]) {
      const a = [s * 2.6 * M, GH + 0.5 * M, 1.6 * M], b = [s * 6.2 * M, H - 0.4 * M, 1.6 * M];
      beam(kit, 'metal_panel_white', a, b, 2.0 * M, 0.5 * M);
      if (detail > 0) {
        const geo = new THREE.CylinderGeometry(1.1 * M, 1.1 * M, 1, detail === 2 ? 10 : 6, 1, true);
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        geo.translate(0, 0.5, 0); geo.scale(1, len, 1);
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        kit.add('glass_curtain_blue', geo, { x: a[0], y: a[1] + 0.2 * M, z: a[2], rz: ang - Math.PI / 2, lit: 0.7 });
      }
    }
    // Bahnsteigdeck über die ganze Fläche
    kit.box('concrete', 0, H - 1.2 * M, 0, W - 0.2 * M, 0.9 * M, D - 0.4 * M);
    kit.box('concrete_panel', 0, H - 0.3 * M, 0, W, 0.29 * M, D);
    if (detail > 0) {
      for (const z of [-2.4, 2.4]) kit.box('paint_yellow', 0, H - 0.005 * M, z * M, W - 0.4 * M, 0.02 * M, 0.25 * M);
      kit.box('paint_white', 0, H - 0.008 * M, 0, W - 0.4 * M, 0.02 * M, 0.12 * M);
    }
    // Hallendach: Tonnengewölbe aus Glas mit weißen Bögen, offen an beiden Enden
    const RY = H + 2.4 * M, R = 4.6 * M;
    const vault = new THREE.CylinderGeometry(R, R, W, detail === 2 ? 14 : 8, 1, true, -Math.PI / 2, Math.PI);
    kit.add('glass_curtain_blue', vault, { x: 0, y: RY, z: 0, rx: -Math.PI / 2, ry: Math.PI / 2, sz: 0.4, lit: 0.4 });
    for (let k = 0; k <= (detail === 2 ? 8 : detail === 1 ? 4 : 2); k++) {
      const x = -W / 2 + (k * W) / (detail === 2 ? 8 : detail === 1 ? 4 : 2);
      kit.add('metal_panel_white', new THREE.TorusGeometry(R + 0.05 * M, 0.16 * M, 3, 12, Math.PI), { x, y: RY, z: 0, ry: Math.PI / 2, sy: 0.4 });
      for (const sz of [-1, 1]) kit.cyl('metal_panel_white', x, H, sz * (R - 0.1 * M), 0.14 * M, 2.4 * M, { seg: 6 });
    }
    if (detail > 0) {
      kit.box('emissive_cool', 0, RY + R * 0.4 - 0.3 * M, 0, W - 1 * M, 0.06 * M, 0.3 * M);
      kit.light(-5 * M, H + 2 * M, 0, 0xdcefff, 0.8);
      kit.light(5 * M, H + 2 * M, 0, 0xdcefff, 0.8);
      if (detail === 2) for (const x of [-6, -2, 2, 6]) bench(kit, x * M, -3.8 * M, 0);
    }
    // Vorplatz
    if (detail > 0) {
      for (const s of [-1, 1]) { lamp(kit, s * 7.6 * M, 4.2 * M, 4.0 * M, { head: 'emissive_cool', color: 0xdcefff }); kit.box('metal_dark', s * 4.6 * M, 0, 4.4 * M, 1.8 * M, 0.5 * M, 0.5 * M); }
      kit.light(0, GH - 0.6 * M, 3.8 * M, 0xdcefff, 0.6);
    }
    void rod; void lathe; void glassRail;
    return kit.build();
  },
});
