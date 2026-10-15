// Pulsbahn – die U-Bahn der Stadt. Oberirdisch stehen nur die Eingänge (Besitzer: UBAHN, vorher G6).
// `station` (1 × 1), Front (+z) zur Straße:
//   Variante 0 „Platz“: eigener Eingangsplatz mit Treppenabgang unter einem Glasdach und U-Säule.
//   Variante 1 „Gehweg“: der Bahnhof liegt unter einer Straße; schmaler Abgang mit Geländer auf dem Gehweg
//              (Modell-x = Straßenrichtung, Abgang am Rand +z). TransitView dreht das Modell passend.
//   Variante 2 „Kreuzung“: kurzer Abgang auf der Gehweg-Ecke (+x/+z) mit U-Säule.
// `metro_hub` (2 × 1): großer Umsteigebahnhof mit gläserner Eingangshalle, zwei Abgängen und U-Säule.
// Der Abgang selbst liegt unter dem Gelände; oben wirkt er durch dunkler werdende Stufen und abfallende
// Handläufe tief. Bahnsteige und Tunnel zeichnet render/underground.js (Untergrund-Ansicht).
import { registerArch } from './index.js';
import { M } from './kit.js';
import { beam, lamp, bench, crowd, bollard } from './lm_parts.js';
import { text } from './lm_text.js';

const WELL = ['concrete_panel', 'concrete', 'concrete_dark', 'stone_dark', 'metal_dark', 'paint_black'];

// Blaues U-Schild als Würfel auf einer Säule (Mitte x/z, Unterkante Würfel y0, Kantenlänge s)
export function uPylon(kit, x, z, h, s = 0.9 * M) {
  const d = kit.detail;
  kit.cyl('metal_dark', x, 0, z, 0.09 * M, h, { seg: d === 2 ? 8 : 5 });
  if (d === 2) kit.cyl('metal_dark', x, 0, z, 0.2 * M, 0.25 * M, { seg: 8 });
  kit.box('paint_blue', x, h, z, s, s, s);
  if (d > 0) {
    kit.box('paint_white', x, h + s - 0.04 * M, z, s + 0.02 * M, 0.06 * M, s + 0.02 * M);
    for (let k = 0; k < 4; k++) {
      const ry = (k * Math.PI) / 2;
      const ox = Math.sin(ry) * (s / 2 + 0.005 * M), oz = Math.cos(ry) * (s / 2 + 0.005 * M);
      text(kit, 'paint_white', 'U', x + ox, h + s * 0.2, z + oz, ry, s * 0.6, { depth: 0.03 * M, weight: 1.15, lod: true });
    }
  }
  kit.light(x, h + s / 2, z, 0x5d8fff, 0.55);
}

// Treppenabgang: Öffnung w × len (entlang z, oberes Ende bei +z), Mitte cx/cz.
// rail: 'stone' (Brüstung aus Naturstein) oder 'metal' (Geländer auf dem Gehweg)
function stairwell(kit, cx, cz, w, len, rail = 'stone') {
  const d = kit.detail;
  const z0 = cz - len / 2, z1 = cz + len / 2;
  const hw = w / 2;
  // „Tiefe“: Stufenbänder von hell (oben) nach dunkel (unten)
  const n = d === 0 ? 3 : WELL.length;
  for (let k = 0; k < n; k++) {
    const mat = d === 0 ? ['concrete', 'stone_dark', 'paint_black'][k] : WELL[k];
    const a = z1 - (len * k) / n, b = z1 - (len * (k + 1)) / n;
    kit.box(mat, cx, 0.07 * M, (a + b) / 2, w, 0.02 * M, a - b);
    if (d === 2 && k < n - 1) kit.box('metal_light', cx, 0.095 * M, b + 0.03 * M, w - 0.1 * M, 0.012 * M, 0.06 * M);
  }
  // Brüstung bzw. Geländer
  if (rail === 'stone') {
    const H = 1.05 * M, T = 0.28 * M;
    for (const s of [-1, 1]) kit.box('trim_stone', cx + s * (hw + T / 2), 0, cz, T, H, len + T);
    kit.box('trim_stone', cx, 0, z0 - T / 2, w + 2 * T, H, T);
    if (d > 0) {
      // Innenseiten dunkler zur Tiefe hin
      for (let k = 0; k < 3; k++) {
        const a = z1 - (len * k) / 3, b = z1 - (len * (k + 1)) / 3;
        for (const s of [-1, 1]) kit.box(['concrete', 'concrete_dark', 'metal_dark'][k], cx + s * (hw - 0.015 * M), 0.08 * M, (a + b) / 2, 0.03 * M, H - 0.1 * M, a - b);
      }
      kit.box('metal_dark', cx, 0.08 * M, z0 + 0.015 * M, w, H - 0.1 * M, 0.03 * M);
    }
  }
  // Handläufe fallen in die Tiefe ab – wirkt wie eine Treppe nach unten
  if (d > 0) for (const s of [-1, 1]) beam(kit, 'metal_light', [cx + s * (hw - 0.12 * M), 0.95 * M, z1 + 0.1 * M], [cx + s * (hw - 0.12 * M), 0.14 * M, z0 + 0.35 * M], 0.05 * M, 0.05 * M);
  // Licht aus der Tiefe
  if (d > 0) kit.box('emissive_cool', cx, 0.1 * M, z0 + 0.05 * M, w * 0.7, 0.22 * M, 0.04 * M);
}

// Glasdach auf vier Stützen über dem Abgang
function glassCanopy(kit, cx, cz, sx, sz, h) {
  const d = kit.detail;
  for (const s of [-1, 1]) for (const t of [-1, 1]) kit.box('metal_dark', cx + s * (sx / 2 - 0.1 * M), 0, cz + t * (sz / 2 - 0.25 * M), 0.12 * M, h, 0.12 * M);
  kit.box('glass_skylight', cx, h, cz, sx, 0.08 * M, sz, { lit: 0.25 });
  kit.box('metal_dark', cx, h + 0.08 * M, cz + sz / 2 - 0.05 * M, sx + 0.1 * M, 0.18 * M, 0.12 * M);
  if (d > 0) {
    kit.box('metal_dark', cx, h + 0.08 * M, cz - sz / 2 + 0.05 * M, sx + 0.1 * M, 0.18 * M, 0.12 * M);
    for (const s of [-1, 1]) kit.box('metal_dark', cx + s * (sx / 2), h + 0.08 * M, cz, 0.1 * M, 0.14 * M, sz);
    // Schriftband an der Stirnseite
    kit.box('paint_blue', cx, h - 0.42 * M, cz + sz / 2 - 0.06 * M, sx * 0.86, 0.42 * M, 0.06 * M);
    if (d === 2) text(kit, 'paint_white', 'PULSBAHN', cx, h - 0.35 * M, cz + sz / 2 - 0.02 * M, 0, 0.26 * M, { depth: 0.02 * M });
    kit.box('emissive_cool', cx, h - 0.06 * M, cz, sx * 0.5, 0.04 * M, 0.12 * M);
  }
  kit.light(cx, h - 0.3 * M, cz, 0xdcefff, 0.5);
}

registerArch('station', {
  variants: 3,
  build(ctx) {
    const { kit, detail } = ctx;
    if ((ctx.variant | 0) % 3 === 2) {
      // Kreuzung: kurzer Abgang auf der Gehweg-Ecke (+x/+z), U-Säule an der Ecke
      sideWellZ(kit, 3.72 * M, 3.5 * M, 2.3 * M, 1.25 * M);
      uPylon(kit, 4.55 * M, 2.15 * M, 3.2 * M, 1.2 * M);
      return kit.build();
    }
    if ((ctx.variant | 0) % 3 === 1) {
      // Gehweg-Abgang: Straße entlang Modell-x, Abgang auf dem Gehweg am Rand +z
      const cz = 3.72 * M, w = 1.45 * M, len = 4.4 * M;
      sideWell(kit, 0, cz, len, w);
      uPylon(kit, 2.9 * M, cz, 3.2 * M, 1.2 * M);
      if (detail === 2) { bollard(kit, -2.9 * M, cz); kit.box('paint_blue', -2.9 * M, 0, cz - 0.3 * M, 0.5 * M, 1.5 * M, 0.08 * M); }
      return kit.build();
    }
    // Eingangsplatz
    kit.box('pavers', 0, 0, 0, 9.8 * M, 0.06 * M, 9.8 * M);
    if (detail > 0) kit.box('stone_dark', 0, 0, 4.75 * M, 9.8 * M, 0.08 * M, 0.3 * M);
    const cx = -0.6 * M, cz = -0.2 * M, w = 2.8 * M, len = 5.6 * M;
    stairwell(kit, cx, cz, w, len, 'stone');
    glassCanopy(kit, cx, cz + 0.2 * M, w + 1.2 * M, len + 1.2 * M, 2.9 * M);
    uPylon(kit, 3.2 * M, 3.4 * M, 3.4 * M, 1.3 * M);
    if (detail > 0) {
      // Netzplan-Vitrine und Fahrkartenautomat
      kit.box('metal_dark', 2.9 * M, 0, -1.6 * M, 0.12 * M, 2.1 * M, 1.5 * M);
      kit.box('glass_curtain_blue', 2.97 * M, 0.7 * M, -1.6 * M, 0.04 * M, 1.2 * M, 1.3 * M, { lit: 0.9 });
      kit.box('paint_blue', 3.0 * M, 0, 0.4 * M, 0.6 * M, 1.7 * M, 0.5 * M);
      kit.box('emissive_cool', 3.32 * M, 1.0 * M, 0.4 * M, 0.04 * M, 0.4 * M, 0.3 * M);
    }
    if (detail === 2) {
      bench(kit, -3.9 * M, 2.6 * M, Math.PI / 2);
      lamp(kit, -3.9 * M, -3.6 * M, 4.2 * M, { head: 'emissive_cool', color: 0xdcefff, ry: Math.PI / 4 });
      for (let k = 0; k < 4; k++) kit.box('metal_light', 1.6 * M + k * 0.55 * M, 0, -4.1 * M, 0.05 * M, 0.75 * M, 0.7 * M);
      crowd(kit, 1.6 * M, 2.4 * M, 2.4 * M, 2.0 * M, 3);
    }
    return kit.build();
  },
});

// Kurzer Abgang mit Laufrichtung entlang z (oberes Ende bei −z), für Gehweg-Ecken an Kreuzungen
function sideWellZ(kit, cx, cz, len, w) {
  const d = kit.detail;
  const z0 = cz - len / 2, z1 = cz + len / 2, hw = w / 2;
  const n = d === 0 ? 2 : 4;
  for (let k = 0; k < n; k++) {
    const mat = d === 0 ? ['stone_dark', 'paint_black'][k] : WELL[k + 2];
    const a = z0 + (len * k) / n, b = z0 + (len * (k + 1)) / n;
    kit.box(mat, cx, 0.075 * M, (a + b) / 2, w, 0.02 * M, b - a);
  }
  kit.box('concrete_dark', cx, 0, cz, w + 0.14 * M, 0.075 * M, len + 0.14 * M);
  if (d > 0) {
    const H = 1.0 * M;
    const pts = [[cx - hw, z0], [cx - hw, z1], [cx + hw, z1], [cx + hw, z0]];
    for (let i = 0; i < 3; i++) beam(kit, 'metal_dark', [pts[i][0], H, pts[i][1]], [pts[i + 1][0], H, pts[i + 1][1]], 0.06 * M, 0.06 * M);
    for (const s of [-1, 1]) beam(kit, 'metal_light', [cx + s * (hw - 0.1 * M), 0.9 * M, z0 - 0.1 * M], [cx + s * (hw - 0.1 * M), 0.15 * M, z1 - 0.3 * M], 0.05 * M, 0.05 * M);
    kit.box('emissive_cool', cx, 0.1 * M, z1 - 0.05 * M, w * 0.7, 0.2 * M, 0.04 * M);
  }
}

// Abgang quer (Laufrichtung entlang x, oberes Ende bei +x), für den Gehweg
function sideWell(kit, cx, cz, len, w) {
  const d = kit.detail;
  const x0 = cx - len / 2, x1 = cx + len / 2, hw = w / 2;
  const n = d === 0 ? 3 : WELL.length;
  for (let k = 0; k < n; k++) {
    const mat = d === 0 ? ['concrete', 'stone_dark', 'paint_black'][k] : WELL[k];
    const a = x1 - (len * k) / n, b = x1 - (len * (k + 1)) / n;
    kit.box(mat, (a + b) / 2, 0.075 * M, cz, a - b, 0.02 * M, w);
    if (d === 2 && k < n - 1) kit.box('metal_light', b + 0.03 * M, 0.1 * M, cz, 0.06 * M, 0.012 * M, w - 0.1 * M);
  }
  kit.box('concrete_dark', cx, 0, cz, len + 0.14 * M, 0.075 * M, w + 0.14 * M);
  if (d > 0) {
    const H = 1.0 * M;
    const pts = [[x1, cz - hw], [x0, cz - hw], [x0, cz + hw], [x1, cz + hw]];
    for (let i = 0; i < 3; i++) beam(kit, 'metal_dark', [pts[i][0], H, pts[i][1]], [pts[i + 1][0], H, pts[i + 1][1]], 0.06 * M, 0.06 * M);
    if (d === 2) for (const [px, pz] of [...pts, [cx, cz - hw], [cx, cz + hw]]) kit.box('metal_dark', px, 0, pz, 0.06 * M, H, 0.06 * M);
    for (const s of [-1, 1]) beam(kit, 'metal_light', [x1 + 0.1 * M, 0.9 * M, cz + s * (hw - 0.1 * M)], [x0 + 0.35 * M, 0.15 * M, cz + s * (hw - 0.1 * M)], 0.05 * M, 0.05 * M);
    kit.box('emissive_cool', x0 + 0.05 * M, 0.1 * M, cz, 0.04 * M, 0.2 * M, w * 0.7);
  }
}

registerArch('metro_hub', {
  variants: 1,
  build(ctx) {
    const { kit, detail } = ctx;
    // Vorplatz
    kit.box('pavers', 0, 0, 0, 19.8 * M, 0.06 * M, 9.8 * M);
    // Eingangshalle aus Glas mit weit auskragendem Dach
    const HX = -3.4 * M, HZ = -1.3 * M, HW = 12.0 * M, HD = 6.4 * M, GH = 5.0 * M;
    kit.box('stone_dark', HX, 0, HZ, HW + 0.4 * M, 0.3 * M, HD + 0.4 * M);
    kit.box('glass_curtain_blue', HX, 0.3 * M, HZ, HW, GH - 0.3 * M, HD, { lit: 0.95 });
    if (detail > 0) {
      for (let k = 0; k <= 8; k++) kit.box('metal_panel_white', HX - HW / 2 + (k * HW) / 8, 0.3 * M, HZ + HD / 2 + 0.02 * M, 0.16 * M, GH - 0.3 * M, 0.12 * M);
      kit.box('metal_panel_white', HX, 2.8 * M, HZ + HD / 2 + 0.02 * M, HW, 0.14 * M, 0.12 * M);
      // Eingangsportal (dunkle Glastüren)
      kit.box('glass_curtain_dark', HX, 0.3 * M, HZ + HD / 2 + 0.06 * M, 4.0 * M, 2.4 * M, 0.06 * M, { lit: 0.5 });
    }
    kit.box('metal_panel_white', HX + 0.6 * M, GH, HZ + 1.0 * M, HW + 2.6 * M, 0.45 * M, HD + 2.6 * M);
    if (detail > 0) {
      kit.box('glass_skylight', HX, GH + 0.45 * M, HZ, HW * 0.6, 0.12 * M, HD * 0.5, { lit: 0.4 });
      kit.box('emissive_cool', HX + 0.6 * M, GH - 0.04 * M, HZ + HD / 2 + 1.6 * M, HW, 0.05 * M, 0.2 * M);
      for (const s of [-1, 1]) kit.cyl('metal_panel_white', HX + s * (HW / 2 + 0.8 * M), 0, HZ + HD / 2 + 1.9 * M, 0.14 * M, GH, { seg: 8 });
    }
    // Großes U-Schild über dem Eingang und Schriftzug
    kit.box('paint_blue', HX - 3.6 * M, GH + 0.45 * M, HZ + HD / 2 + 1.5 * M, 1.6 * M, 1.6 * M, 0.25 * M);
    text(kit, 'paint_white', 'U', HX - 3.6 * M, GH + 0.75 * M, HZ + HD / 2 + 1.64 * M, 0, 1.0 * M, { depth: 0.04 * M, weight: 1.15, lod: true });
    kit.box('paint_blue', HX + 1.4 * M, GH + 0.5 * M, HZ + HD / 2 + 1.55 * M, 7.0 * M, 0.7 * M, 0.12 * M);
    if (detail > 0) text(kit, 'paint_white', 'PULSBAHN', HX + 1.4 * M, GH + 0.6 * M, HZ + HD / 2 + 1.62 * M, 0, 0.5 * M, { depth: 0.03 * M });
    kit.light(HX - 3.6 * M, GH + 1.2 * M, HZ + HD / 2 + 1.8 * M, 0x5d8fff, 0.8);
    kit.light(HX, GH - 0.6 * M, HZ + HD / 2 + 1.2 * M, 0xdcefff, 0.7);
    // Zweiter, offener Abgang mit Glasdach auf dem Vorplatz
    stairwell(kit, 6.6 * M, -0.6 * M, 2.8 * M, 5.4 * M, 'stone');
    glassCanopy(kit, 6.6 * M, -0.4 * M, 4.0 * M, 6.6 * M, 3.0 * M);
    uPylon(kit, 8.9 * M, 3.9 * M, 4.4 * M, 1.4 * M);
    if (detail > 0) {
      for (const s of [-1, 1]) lamp(kit, 3.0 * M + s * 0.01 * M, s > 0 ? 4.2 * M : -4.2 * M, 4.4 * M, { head: 'emissive_cool', color: 0xdcefff });
      for (let k = 0; k < 6; k++) kit.box('metal_light', -8.6 * M + k * 0.55 * M, 0, 4.1 * M, 0.05 * M, 0.75 * M, 0.7 * M);
    }
    if (detail === 2) {
      for (const x of [-1.5, 1.5]) bench(kit, x * M, 4.2 * M, 0);
      crowd(kit, -2.0 * M, 3.6 * M, 9 * M, 1.6 * M, 7);
      crowd(kit, 6.6 * M, 3.8 * M, 2 * M, 1.0 * M, 2);
    }
    return kit.build();
  },
});
