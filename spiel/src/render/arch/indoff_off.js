// Büro (Zone 'off') – Fassadensystem und Archetypen je Stufe (Besitzer: G4).
// Stufe 1: kleine Bürohäuser · 2: Bürohäuser 3–5 Geschosse · 3: Bürogebäude 5–9 Geschosse ·
// 4: Bürotürme 9–18 Geschosse · 5: Wolkenkratzer 20–40 Geschosse. Je Stufe 6 Archetypen.
// Ein Baukörper („Volumen") ist { x, z, sx, sz, y0, n, fh }: Mitte, Größe, Unterkante, Geschosse, Geschosshöhe (alles in m).
import * as THREE from 'three';
import { B, PI, HP, LOGO, CAR, clamp } from './indoff_parts.js';

const SIDES = ['front', 'back', 'left', 'right'];
const FH = 3.4;            // Bürogeschoss
const GLASS = ['glass_curtain_blue', 'glass_curtain_green', 'glass_curtain_dark', 'glass_curtain_gold'];
const geom = (b) => ({ W: b.W, D: b.D, X: b.W / 2, Z: b.D / 2, wide: b.W > 10, deep: b.D > 10 });
const vol = (x, z, sx, sz, y0, n, fh = FH) => ({ x, z, sx, sz, y0, n, fh, top: y0 + n * fh });

// =====================================================================================
// Fassaden
// =====================================================================================

// Bandfenster: durchlaufende Fensterbänder, Brüstungsbänder springen vor
function facRibbon(b, v, o = {}) {
  const { x, z, sx, sz, y0, n, fh } = v;
  const band = o.band || 'concrete_panel', glass = o.glass || 'glass_window';
  const winH = o.winH ?? fh * 0.52, sill = o.sill ?? (fh - winH) * 0.55;
  const ins = o.inset ?? 0.3, sides = o.sides || SIDES, H = n * fh;
  if (b.d === 0) {
    b.box(band, x, y0, z, sx, H, sz);
    const f = b.faces(x, z, sx, sz);
    for (const s of sides) for (let k = 0; k < n; k++) b.fplane(glass, f[s], 0, y0 + k * fh + sill, f[s].len - 0.3, winH, 0.03);
    return;
  }
  b.box(o.core || band, x, y0, z, sx - 2 * ins, H, sz - 2 * ins);
  for (let k = 0; k <= n; k++) {
    const yb = k === 0 ? y0 : y0 + (k - 1) * fh + sill + winH;
    const yt = k === n ? y0 + H : y0 + k * fh + sill;
    if (yt - yb > 0.02) b.box(band, x, yb, z, sx, yt - yb, sz);
  }
  const fi = b.faces(x, z, sx - 2 * ins, sz - 2 * ins), fo = b.faces(x, z, sx, sz);
  for (const s of SIDES) {
    if (!sides.includes(s)) { b.fbox(band, fo[s], 0, y0, fo[s].len, H, ins, -ins); continue; }
    const fc = fi[s];
    for (let k = 0; k < n; k++) {
      const yw = y0 + k * fh + sill;
      b.fplane(glass, fc, 0, yw, fc.len, winH, 0.02);
      if (b.d >= 2 && o.mull !== false) {
        const m = Math.max(1, Math.round(fc.len / (o.mull ?? 1.35)));
        for (let i = 1; i < m; i++) b.fbox(o.frame || 'window_frame_dark', fc, -fc.len / 2 + (i * fc.len) / m, yw, 0.07, winH, 0.06, 0.02);
      }
    }
  }
}

// Vorhangfassade: Glas je Geschoss und Seite, Riegel je Geschoss, Pfosten über die ganze Höhe
function facCurtain(b, v, o = {}) {
  const { x, z, sx, sz, y0, n, fh } = v;
  const glass = o.glass || 'glass_curtain_blue', frame = o.frame || 'metal_dark', sides = o.sides || SIDES, H = n * fh;
  b.box(o.core || 'metal_dark', x, y0, z, sx - 0.1, H, sz - 0.1);
  const f = b.faces(x, z, sx, sz);
  for (const s of sides) for (let k = 0; k < n; k++) b.fplane(glass, f[s], 0, y0 + k * fh + 0.08, f[s].len - 0.04, fh - 0.16, -0.03);
  for (const s of SIDES) if (!sides.includes(s)) b.fbox(o.blind || 'concrete', f[s], 0, y0, f[s].len, H, 0.12, -0.08);
  if (b.d >= 1) for (let k = 1; k < n; k++) b.box(frame, x, y0 + k * fh - 0.08, z, sx + 0.06, 0.16, sz + 0.06);
  if (b.d >= 2) for (const s of sides) {
    const len = f[s].len, m = Math.max(1, Math.round(len / (o.col ?? 1.5)));
    for (let i = 0; i <= m; i++) b.fbox(frame, f[s], clamp(-len / 2 + (i * len) / m, -len / 2 + 0.04, len / 2 - 0.04), y0, 0.09, H, 0.1, -0.02);
  }
}

// Rasterfassade (Betonraster): Pfeiler und Geschossbänder, Glas zurückgesetzt
function facGrid(b, v, o = {}) {
  const { x, z, sx, sz, y0, n, fh } = v;
  const frame = o.frame || 'concrete', glass = o.glass || 'glass_curtain_dark';
  const ins = o.inset ?? 0.4, bay = o.bay ?? 1.6, bandH = o.bandH ?? 0.6, H = n * fh, sides = o.sides || SIDES;
  const fo = b.faces(x, z, sx, sz);
  if (b.d === 0) {
    b.box(frame, x, y0, z, sx, H, sz);
    for (const s of sides) { const [px, pz] = fo[s].at(0, 0.03); b.lodWin(px, y0 + H / 2, pz, fo[s].len, H, Math.max(1, Math.round(fo[s].len / bay)), n, fo[s].ry); }
    return;
  }
  b.box(o.core || 'concrete_dark', x, y0, z, sx - 2 * ins, H, sz - 2 * ins);
  const fi = b.faces(x, z, sx - 2 * ins, sz - 2 * ins);
  for (const s of SIDES) {
    if (!sides.includes(s)) { b.fbox(frame, fo[s], 0, y0, fo[s].len, H, ins, -ins); continue; }
    for (let k = 0; k < n; k++) b.fplane(glass, fi[s], 0, y0 + k * fh + bandH, fi[s].len, fh - bandH, 0.02);
    const len = fo[s].len, m = Math.max(1, Math.round(len / bay));
    for (let i = 0; i <= m; i++) b.fbox(frame, fo[s], clamp(-len / 2 + (i * len) / m, -len / 2 + 0.15, len / 2 - 0.15), y0, o.pierW ?? 0.3, H, ins, -ins);
  }
  for (let k = 0; k <= n; k++) b.box(frame, x, y0 + k * fh - (k === n ? 0 : 0), z, sx, k === n ? (o.topH ?? 0.9) : bandH, sz);
}

// Lochfassade: Wand mit Einzelfenstern
function facPunch(b, v, o = {}) {
  const { x, z, sx, sz, y0, n, fh } = v;
  const wall = o.wall || 'plaster_white', sides = o.sides || SIDES;
  b.box(wall, x, y0, z, sx, n * fh, sz);
  const f = b.faces(x, z, sx, sz);
  const winW = o.winW ?? 1.3, winH = o.winH ?? 1.7, sill = o.sill ?? (fh - winH) * 0.55;
  for (const s of sides) for (let k = (o.skipGround ? 1 : 0); k < n; k++) {
    b.winRow(f[s], -f[s].len / 2 + (o.margin ?? 0.9), f[s].len / 2 - (o.margin ?? 0.9), y0 + k * fh + sill, winW, winH, { spacing: o.spacing ?? 2.4, frame: o.frame || 'window_frame_white', glass: o.glass || 'glass_window', sill: o.sills, arch: o.arch, lintel: o.lintel, mullion: o.mullion });
  }
}

// Pfeilerfassade (Kontorhaus): durchgehende senkrechte Pfeiler, Fenster dazwischen
function facPiers(b, v, o = {}) {
  const { x, z, sx, sz, y0, n, fh } = v;
  const wall = o.wall || 'brick_dark', glass = o.glass || 'glass_window', sp = o.sp ?? 1.5, ins = 0.28, H = n * fh;
  const fo = b.faces(x, z, sx, sz), sides = o.sides || SIDES;
  if (b.d === 0) {
    b.box(wall, x, y0, z, sx, H, sz);
    for (const s of sides) { const [px, pz] = fo[s].at(0, 0.03); b.lodWin(px, y0 + H / 2, pz, fo[s].len, H, Math.max(1, Math.round(fo[s].len / sp)), n, fo[s].ry); }
    return;
  }
  b.box(o.core || wall, x, y0, z, sx - 2 * ins, H, sz - 2 * ins);
  const fi = b.faces(x, z, sx - 2 * ins, sz - 2 * ins);
  const winH = fh * 0.58, sill = fh * 0.24;
  for (const s of SIDES) {
    if (!sides.includes(s)) { b.fbox(wall, fo[s], 0, y0, fo[s].len, H, ins, -ins); continue; }
    for (let k = 0; k < n; k++) {
      b.fplane(glass, fi[s], 0, y0 + k * fh + sill, fi[s].len, winH, 0.02);
      if (b.d >= 2) b.fbox(o.spandrel || wall, fi[s], 0, y0 + k * fh, fi[s].len, sill - 0.05, 0.12, 0);
    }
    const len = fo[s].len, m = Math.max(2, Math.round(len / sp));
    for (let i = 0; i <= m; i++) {
      const a = clamp(-len / 2 + (i * len) / m, -len / 2 + 0.2, len / 2 - 0.2);
      b.fbox(wall, fo[s], a, y0, 0.42, H + (o.pinnacle ? 0.9 : 0), ins + 0.06, -ins);
      if (o.pinnacle && b.d >= 2) b.fbox(o.cap || 'trim_stone', fo[s], a, y0 + H + 0.9, 0.5, 0.2, ins + 0.12, -ins);
    }
  }
}

// Lamellenfassade: Vorhangfassade mit senkrechten Sonnenschutz-Lamellen
function facFins(b, v, o = {}) {
  facCurtain(b, v, o);
  if (b.d === 0) return;
  const { x, z, sx, sz, y0, n, fh } = v;
  const f = b.faces(x, z, sx, sz), sp = o.finSp ?? 1.2, fin = o.fin || 'metal_panel_white';
  for (const s of o.finSides || o.sides || SIDES) {
    const len = f[s].len, m = Math.max(2, Math.round(len / sp));
    for (let i = 0; i <= m; i++) b.fbox(fin, f[s], clamp(-len / 2 + (i * len) / m, -len / 2 + 0.1, len / 2 - 0.1), y0, o.finW ?? 0.16, n * fh, o.finD ?? 0.55, 0);
  }
}

const FAC = { ribbon: facRibbon, curtain: facCurtain, grid: facGrid, punch: facPunch, piers: facPiers, fins: facFins };
const fac = (b, type, v, o) => FAC[type](b, v, o);

// =====================================================================================
// Bauteile
// =====================================================================================

// Flachdach mit Attika, Technikaufbau, Lüftern; o: { parapet, parMat, roofMat, plant, rail, bmu }
function roofOff(b, x, y, z, sx, sz, o = {}) {
  const p = o.parapet ?? 0.9, pm = o.parMat || 'concrete', t = 0.3;
  b.box(o.roofMat || 'roof_flat_gravel', x, y, z, sx - 0.2, 0.12, sz - 0.2);
  if (p > 0) {
    if (b.d === 0) { b.box(pm, x, y, z + sz / 2 - t / 2, sx, p, t); b.box(pm, x, y, z - sz / 2 + t / 2, sx, p, t); }
    else {
      b.box(pm, x, y, z + sz / 2 - t / 2, sx, p, t); b.box(pm, x, y, z - sz / 2 + t / 2, sx, p, t);
      b.box(pm, x - sx / 2 + t / 2, y, z, t, p, sz - 2 * t); b.box(pm, x + sx / 2 - t / 2, y, z, t, p, sz - 2 * t);
    }
  }
  let top = y + p;
  if (o.plant !== false && sx > 5 && sz > 4) {
    const px = sx * (o.plantW ?? 0.42), pz = sz * (o.plantD ?? 0.42), ph = o.plantH ?? 3.0;
    b.box(o.plantMat || 'metal_panel_grey', x, y, z - sz * 0.05, px, ph, pz);
    if (b.d >= 2) for (let k = 1; k < 5; k++) b.box('metal_dark', x, y + (ph * k) / 5, z - sz * 0.05, px + 0.06, 0.05, pz + 0.06);
    top = Math.max(top, y + ph);
    if (b.d >= 1) b.vents(x, y + 0.1, z + sz * 0.3, sx * 0.5, sz * 0.15, o.vents ?? 2);
  } else if (b.d >= 1) b.vents(x, y + 0.1, z, sx * 0.5, sz * 0.5, o.vents ?? 2);
  if (o.rail) b.roofRail(x, y + 0.1, z, sx - 0.4, sz - 0.4);
  if (o.bmu && b.d >= 2) {
    b.box('metal_light', x + sx * 0.25, y + 0.1, z + sz * 0.2, 1.0, 1.4, 1.0);
    b.box('metal_light', x + sx * 0.25, y + 1.5, z + sz * 0.2 + 1.2, 0.3, 0.3, 3.2);
  }
  return top;
}
// Erdgeschoss-Lobby: zurückgesetzte Glasfront mit Stützen, Eingang mit Vordach
function lobby(b, x, z, sx, sz, h, o = {}) {
  const glass = o.glass || 'glass_window', ins = o.inset ?? 0.9, col = o.col || 'concrete';
  b.box(o.core || 'metal_dark', x, 0, z, sx - 2 * ins - 0.1, h, sz - 2 * ins - 0.1);
  const fi = b.faces(x, z, sx - 2 * ins, sz - 2 * ins);
  for (const s of o.sides || SIDES) {
    const fc = fi[s];
    const parts = Math.max(1, Math.round(fc.len / 4));
    for (let p = 0; p < parts; p++) b.fplane(glass, fc, -fc.len / 2 + (p + 0.5) * (fc.len / parts), 0.05, fc.len / parts - 0.05, h - 0.3, 0.02);
    if (b.d >= 2) { const m = Math.max(2, Math.round(fc.len / 1.8)); for (let i = 1; i < m; i++) b.fbox('metal_dark', fc, -fc.len / 2 + (i * fc.len) / m, 0, 0.08, h - 0.2, 0.08, 0.02); }
  }
  // Stützen am Rand
  if (b.d >= 1 && ins > 0.4) {
    const nx = Math.max(1, Math.round(sx / 5)), nz = Math.max(1, Math.round(sz / 5));
    for (let i = 0; i <= nx; i++) for (const s of [-1, 1]) b.box(col, x - sx / 2 + 0.3 + (i * (sx - 0.6)) / nx, 0, z + s * (sz / 2 - 0.3), 0.45, h, 0.45);
    for (let i = 1; i < nz; i++) for (const s of [-1, 1]) b.box(col, x + s * (sx / 2 - 0.3), 0, z - sz / 2 + 0.3 + (i * (sz - 0.6)) / nz, 0.45, h, 0.45);
  }
  const ea = o.entryA ?? 0, ff = b.faces(x, z, sx, sz).front;
  if (o.canopy !== false) b.fbox(o.canopyMat || 'metal_light', ff, ea, h - 0.6, Math.min(6, sx * 0.5), 0.3, o.canopyD ?? 1.6, -ins + 0.1);
  if (b.d >= 2) {
    const [rx, rz] = fi.front.at(ea, 0.9);
    b.cyl(glass, rx, 0, rz, 1.0, 2.5, { seg: 10 });
    b.cyl('metal_dark', rx, 2.5, rz, 1.05, 0.2, { seg: 10 });
  }
  const [lx, lz] = fi.front.at(ea, Math.min(ins, 0.5));
  b.light(lx, h - 0.8, lz, 0xffe2b0, 0.3);
}
// Schild auf dem Dach / an der Fassade oben
function roofSign(b, f, y, w, h, o = {}) { b.sign(f, o.a ?? 0, y, w, h, { logo: o.logo || b.pick(LOGO), disc: o.disc ?? b.chance(0.5) }); }
// Fahrradständer
function bikes(b, x, z, n = 4) {
  if (b.d < 2) return;
  b.box('metal_dark', x, 0.7, z, n * 0.7, 0.06, 0.06);
  for (let i = 0; i < n; i++) b.box(b.pick(['paint_red', 'paint_blue', 'metal_dark', 'paint_green']), x - (n - 1) * 0.35 + i * 0.7, 0.2, z, 0.06, 0.8, 1.7);
}
// Vorplatz mit Pflaster, Bäumen und Fahrradständern
function plaza(b, z0, o = {}) {
  const { W, Z } = geom(b);
  const d = Z - z0;
  if (d < 0.5) return;
  b.ground(o.mat || 'pavers', 0, (z0 + Z) / 2, W - 0.2, d - 0.1, 0.12);
  if (o.trees !== false && d > 2.2) {
    const n = Math.max(1, Math.floor((W - 2) / 6));
    for (let i = 0; i < n; i++) {
      const tx = -W / 2 + 1.5 + (i + 0.5) * ((W - 3) / n);
      if (Math.abs(tx - (o.entryX ?? 0)) < 2.0) continue;
      const tz = (z0 + Z) / 2;
      if (b.plan.free(tx, tz, 2.0, 2.0)) { b.tree(tx, tz, Math.min(0.75, d / 5), 'laub'); b.take(tx, tz, 2.0, 2.0, 0); if (b.d >= 1) b.box('concrete', tx, 0.12, tz, 1.4, 0.35, 1.4); }
    }
  }
  if (d > 2) { const p = b.plan.find(3.0, 1.8, { prefer: 'front', pad: 0 }); if (p) bikes(b, p[0], p[1], 4); }
}
// Gerundete Ecke vorne rechts: Quader + Viertelzylinder (Material mat, Unterkante y, Höhe h)
function roundBlock(b, mat, x, y, z, sx, h, sz, R, o = {}) {
  b.box(mat, x - R / 2, y, z, sx - R, h, sz);
  b.box(mat, x + sx / 2 - R / 2, y, z - R / 2, R, h, sz - R);
  b.cyl(mat, x + sx / 2 - R, y, z + sz / 2 - R, R, h, { seg: o.seg || 8, t0: 0, tl: HP, lit: o.lit });
}
// Antenne mit Warnlicht
function antenna(b, x, y, z, h, o = {}) {
  if (b.d >= 1) {
    b.cyl('metal_light', x, y, z, o.r ?? 0.25, h, { seg: 6, exact: true, rTop: 0.08 });
    if (b.d >= 2) for (let k = 1; k < 4; k++) b.cyl('metal_dark', x, y + (h * k) / 4.5, z, 0.45 - k * 0.08, 0.15, { seg: 6, exact: true });
  }
  b.light(x, y + h + 0.2, z, 0xff2a20, 0.3);
}
// Außenanlage: Rasen-Rand und Bäume an freien Stellen
function greenery(b, n = 2) { for (let i = 0; i < n; i++) b.putTree(b.rnd(0.6, 0.85), b.chance(0.3) ? 'pappel' : 'laub', { prefer: 'center' }); }

// =====================================================================================
// Stufe 1 – kleine Bürohäuser (2–3 Geschosse)
// =====================================================================================

// Bürohaus mit Bandfenstern und auskragendem Dach, Parkplatz
function pavillon(b) {
  const { W, X, Z, wide, deep } = geom(b);
  b.lot('grass', 0.1);
  const band = b.pick(['plaster_white', 'metal_panel_white', 'concrete_panel', 'plaster_grey']);
  const sx = wide ? 13 : W - 2.4, sz = deep ? 9 : 5.6, n = b.chance(0.5) ? 2 : 3;
  const x = wide ? -X + 1.0 + sx / 2 : 0, z = -Z + 0.9 + sz / 2;
  const v = vol(x, z, sx, sz, 0, n);
  facRibbon(b, v, { band, glass: 'glass_window', winH: 1.7 });
  b.box(band, x, v.top, z, sx + 1.2, 0.35, sz + 1.2);
  b.box('roof_flat_gravel', x, v.top + 0.35, z, sx + 1.0, 0.06, sz + 1.0);
  if (b.d >= 1) b.vents(x, v.top + 0.4, z, sx * 0.4, sz * 0.4, 2);
  b.take(x, z, sx + 1.2, sz + 1.2, 0.2);
  const ff = b.faces(x, z, sx, sz).front;
  b.entrance(ff, -sx / 4, 2.0, 2.4, { canopy: band === 'plaster_white' ? 'metal_dark' : 'metal_light', canopyD: 1.2 });
  b.sign(ff, sx / 4, v.top - 0.95, Math.min(5, sx / 2 - 0.5), 0.6, { logo: b.pick(LOGO) });
  b.ground('pavers', x - sx / 4, (z + sz / 2 + Z) / 2, 2.2, Z - z - sz / 2, 0.12);
  b.take(x - sx / 4, (z + sz / 2 + Z) / 2, 2.2, Z - z - sz / 2, 0);
  if (wide) b.parking(X - 3.1, z, 5.4, sz + 1, { fill: 0.7 });
  if (wide) b.take(X - 3.1, z, 5.4, sz + 1, 0);
  if (deep) { const p = b.plan.find(W - 1.4, 5.0, { prefer: 'front', pad: 0 }); if (p) b.parking(p[0], p[1], W - 1.4, 5.0, { fill: 0.6 }); }
  else b.putCar({ prefer: 'front' });
  b.hedge(0, -Z + 0.45, W - 1.0, 0.6);
  greenery(b, wide ? 2 : 1);
  b.lamp(X - 0.5, Z - 0.5, 4);
}

// Holz-Bürohaus mit Lärchenschalung, großen Fenstern und Pultdach
function holzbuero(b) {
  const { W, X, Z, wide, deep } = geom(b);
  b.lot('grass', 0.1);
  const wood = b.pick(['wood_planks', 'wood_planks', 'wood_dark', 'siding_white']);
  const sx = wide ? 12 : W - 2.6, sz = deep ? 9 : 6.0, n = 2, h = n * FH + 0.3;
  const x = wide ? -X + 1.2 + sx / 2 : 0, z = -Z + 0.9 + sz / 2;
  const H = b.hall({ x, z, sx, sz, h, wall: wood, roof: 'shed', roofMat: b.pick(['green_roof', 'roof_metal_grey', 'solar_panel']), pitch: 7, high: 'front', ribs: false, plinth: 'concrete', plinthH: 0.4, over: 0.8 });
  b.take(x, z, sx, sz, 0.3);
  if (b.d >= 2) for (const s of ['front', 'left', 'right']) { const f = H.f[s], m = Math.round(f.len / 0.45); for (let i = 1; i < m; i++) b.fbox('wood_dark', f, -f.len / 2 + (i * f.len) / m, 0.4, 0.06, h - 0.5, 0.05, 0); }
  for (const s of ['front', 'back', 'left', 'right']) for (let k = 0; k < n; k++) b.winRow(H.f[s], -H.f[s].len / 2 + 0.9, H.f[s].len / 2 - 0.9, 0.6 + k * FH, 2.2, 2.3, { spacing: 3.2, frame: 'window_frame_dark', mullion: true });
  b.entrance(H.f.front, 0, 1.8, 2.5, { canopy: 'wood_dark', canopyD: 1.0 });
  b.sign(H.f.front, sx / 2 - 2.2, h - 0.9, 2.8, 0.5, { bg: 'wood_dark', text: 'paint_white', logo: 'leaves_light' });
  // Fahrradunterstand
  const p = b.plan.find(4.0, 2.2, { prefer: 'front', pad: 0.2 });
  if (p && b.d >= 1) {
    for (const s of [-1, 1]) b.box('wood_dark', p[0] + s * 1.8, 0, p[1] - 0.8, 0.15, 2.2, 0.15);
    b.boxc('green_roof', p[0], 2.3, p[1] - 0.2, 4.2, 0.12, 2.2, { rx: 0.1 });
    bikes(b, p[0], p[1], 5);
  }
  if (wide) b.putCar({ prefer: 'right' });
  if (deep) { b.putCar({ prefer: 'front' }); b.putCar({ prefer: 'front' }); }
  greenery(b, wide ? 3 : 2);
}

// Kontor-Villa: Gründerzeitvilla mit Walmdach, Stuckgesimsen und Portikus (Kanzlei, Agentur)
function kontorvilla(b) {
  const { W, X, Z, wide, deep } = geom(b);
  b.lot('grass', 0.1);
  const wall = b.pick(['plaster_cream', 'plaster_ochre', 'plaster_blue', 'plaster_white', 'plaster_pink', 'brick_yellow']);
  const roof = b.pick(['roof_slate', 'roof_tiles_anthracite', 'roof_tiles_red']);
  const sx = wide ? 13 : W - 2.6, sz = deep ? 9.5 : 6.4, n = wide ? 3 : 2, fh = 3.5;
  const x = 0, z = -Z + 1.0 + sz / 2, h = n * fh;
  b.box('stone_grey', x, 0, z, sx + 0.2, 0.9, sz + 0.2);
  facPunch(b, vol(x, z, sx, sz, 0, n, fh), { wall, winW: 1.2, winH: 2.0, spacing: 2.3, frame: 'window_frame_white', sills: true, lintel: b.d >= 2 ? 'trim_stone' : null, margin: 1.0 });
  if (b.d >= 1) { for (let k = 1; k < n; k++) b.box('trim_stone', x, k * fh - 0.1, z, sx + 0.16, 0.22, sz + 0.16); b.box('trim_stone', x, h - 0.3, z, sx + 0.4, 0.4, sz + 0.4); }
  b.k.hipRoof(roof, x * 0.1, h * 0.1, z * 0.1, sx * 0.1, sz * 0.1, Math.min(sx, sz) * 0.045, { overhang: 0.05 });
  if (b.d >= 1) { b.k.chimney((x + sx * 0.25) * 0.1, (h + 1.2) * 0.1, (z - sz * 0.15) * 0.1, 0.25); b.k.chimney((x - sx * 0.25) * 0.1, (h + 1.2) * 0.1, (z + sz * 0.1) * 0.1, 0.25); }
  b.take(x, z, sx + 0.6, sz + 0.6, 0.3);
  // Portikus mit Säulen und Giebel
  const zf = z + sz / 2;
  b.box('stone_grey', x, 0, zf + 1.0, 3.6, 0.5, 2.0);
  if (b.d >= 1) for (const s of [-1, 1]) b.cyl('trim_stone', x + s * 1.4, 0.5, zf + 1.6, 0.22, 3.0, { seg: 10 });
  b.box('trim_stone', x, 3.5, zf + 0.9, 3.8, 0.35, 2.2);
  b.prism('trim_stone', [[-1.9, 0], [1.9, 0], [0, 1.0]], 2.2, x, 3.85, zf + 0.9, 0);
  b.fbox('door_wood', b.faces(x, z, sx, sz).front, 0, 0.5, 1.5, 2.6, 0.08, 0.02);
  if (b.d >= 2) b.fbox('paint_yellow', b.faces(x, z, sx, sz).front, 1.1, 1.6, 0.45, 0.32, 0.03, 0.03);
  b.take(x, zf + 1.0, 3.8, 2.2, 0.3);
  // Garten
  b.ground('gravel', x, (zf + 2.0 + Z) / 2, 2.2, Z - zf - 2.0, 0.12);
  if (b.d >= 1) { b.hedge(-X + 0.5, 0, 0.7, b.D - 1.2); b.hedge(X - 0.5, 0, 0.7, b.D - 1.2); b.hedge(-X / 2 - 1.0, Z - 0.45, X - 2.6, 0.7); b.hedge(X / 2 + 1.0, Z - 0.45, X - 2.6, 0.7); }
  b.take(-X + 0.5, 0, 0.8, b.D, 0); b.take(X - 0.5, 0, 0.8, b.D, 0);
  if (wide || deep) b.putCar({ prefer: 'front' });
  greenery(b, wide ? 3 : deep ? 2 : 1);
  b.lamp(x + 1.8, Z - 0.6, 3.5);
}

// Moderner Kubus: verglastes Erdgeschoss, auskragender Obergeschoss-Block mit tiefen Fensterlaibungen
function kubus(b) {
  const { W, X, Z, wide, deep } = geom(b);
  b.lot('pavers', 0.1);
  const wall = b.pick(['plaster_grey', 'concrete_dark', 'concrete', 'plaster_white', 'metal_panel_grey']);
  const sx = wide ? 14 : W - 2.0, sz = deep ? 10 : 6.6, x = 0, z = -Z + 0.8 + sz / 2;
  const n = 2 + (b.L > 1 ? 1 : 0), gh = 3.8, uh = (n - 1) * FH;
  lobby(b, x, z - 0.6, sx - 1.6, sz - 1.6, gh, { glass: 'glass_window', inset: 0.2, canopy: false, entryA: -sx / 5 });
  b.box(wall, x, gh, z, sx, uh + 0.6, sz);
  const f = b.faces(x, z, sx, sz);
  for (const s of SIDES) {
    const len = f[s].len, m = Math.max(1, Math.floor(len / 2.6));
    for (let k = 0; k < n - 1; k++) for (let i = 0; i < m; i++) {
      const a = -len / 2 + (i + 0.5) * (len / m) + (k % 2 ? 0.4 : -0.4);
      if (b.d === 0) { b.fplane('glass_window', f[s], a, gh + k * FH + 0.6, 1.6, 2.0, 0.03); continue; }
      b.fbox('metal_dark', f[s], a, gh + k * FH + 0.55, 1.9, 2.3, 0.45, 0);
      b.fplane('glass_window', f[s], a, gh + k * FH + 0.65, 1.6, 2.1, 0.47);
    }
  }
  b.take(x, z, sx, sz, 0.3);
  const top = gh + uh + 0.6;
  if (b.d >= 1) { b.box('wood_planks', x - sx / 4, top, z, sx / 2 - 0.6, 0.08, sz - 0.8); b.roofRail(x, top, z, sx, sz); b.box(wall, x + sx / 4, top, z, sx / 2 - 0.8, 2.8, sz * 0.5); }
  b.sign(f.front, sx / 3, gh + 0.2, 3.0, 0.5, { logo: b.pick(LOGO) });
  if (deep || wide) b.putCar({ prefer: 'front' });
  if (b.d >= 1) { const p = b.plan.find(2, 2, { prefer: 'front' }); if (p) { b.box('concrete', p[0], 0.1, p[1], 1.6, 0.5, 1.6); b.tree(p[0], p[1], 0.6, 'busch'); } }
  greenery(b, 1);
}

// Gewerbehof mit kleinen Büroeinheiten: farbige Paneele, je Einheit eine Tür und ein Schild
function gewerbehof(b) {
  const { W, X, Z, deep } = geom(b);
  b.lot('asphalt', 0.1);
  const sx = W - 1.2, sz = deep ? 8 : 5.4, x = 0, z = -Z + 0.6 + sz / 2, n = 2, h = n * FH + 0.4;
  const units = Math.max(2, Math.round(sx / 5));
  const uw = sx / units;
  const cols = [b.pick(['metal_panel_blue', 'paint_blue', 'container_blue']), 'metal_panel_white', b.pick(['metal_panel_grey', 'paint_green', 'container_green']), 'metal_panel_white'];
  for (let i = 0; i < units; i++) {
    const ux = -sx / 2 + (i + 0.5) * uw, c = cols[i % cols.length];
    b.box(c, ux, 0, z, uw, h, sz);
    const f = b.faces(ux, z, uw, sz).front;
    b.band(f, -uw / 2 + 0.5, uw / 2 - 1.8, 0.9, 1.8, {});
    b.band(f, -uw / 2 + 0.5, uw / 2 - 0.5, FH + 0.9, 1.6, {});
    b.entrance(f, uw / 2 - 1.1, 1.2, 2.4, { canopy: 'metal_dark', canopyD: 0.9 });
    b.sign(f, -0.6, 2.9, uw - 2.6, 0.45, { logo: b.pick(LOGO) });
    if (b.d >= 2 && i > 0) b.fbox('metal_dark', b.faces(x, z, sx, sz).front, -sx / 2 + i * uw, 0, 0.12, h, 0.12, 0);
  }
  b.box('metal_dark', x, h, z, sx + 0.1, 0.4, sz + 0.1);
  b.box('roof_flat_membrane', x, h + 0.05, z, sx - 0.4, 0.4, sz - 0.4);
  if (b.d >= 1) b.vents(x, h + 0.45, z, sx * 0.6, sz * 0.5, 3);
  for (const s of ['left', 'right', 'back']) b.band(b.faces(x, z, sx, sz)[s], -b.faces(x, z, sx, sz)[s].len / 2 + 0.6, b.faces(x, z, sx, sz)[s].len / 2 - 0.6, FH + 0.9, 1.4, {});
  b.take(x, z, sx, sz, 0.3);
  const pz = Z - (deep ? 3.0 : 1.9), pd = deep ? 5.2 : Math.min(3.2, Z - z - sz / 2 - 0.6);
  b.parking(0, pz, W - 1.0, pd, { fill: 0.7, front: false });
  b.take(0, pz, W - 1.0, pd, 0);
  b.lamp(-X + 0.5, Z - 0.5, 6);
}

// Backstein-Loft: umgebaute Werkstatt mit großen Stahlfenstern, Oberlicht-Sheds und Glasanbau
function loft(b) {
  const { W, X, Z, wide, deep } = geom(b);
  b.lot('pavers', 0.1);
  const wall = b.pick(['brick_red', 'brick_brown', 'brick_dark', 'brick_yellow']);
  const sx = wide ? 13 : W - 3.4, sz = deep ? 10 : 6.6, x = -X + 0.8 + sx / 2, z = -Z + 0.8 + sz / 2, h = 7.4;
  const H = b.hall({ x, z, sx, sz, h, wall, roof: 'saw', roofMat: 'roof_metal_grey', teeth: Math.max(2, Math.round(sz / 3.3)), toothH: 2.0, sawGlass: 'glass_window', ribs: true, bay: 3.3, ribMat: 'brick_dark', plinth: 'stone_dark', plinthH: 0.5 });
  b.take(x, z, sx, sz, 0.3);
  for (const s of ['front', 'left', 'back']) for (const a of H.bays[s]) {
    for (let k = 0; k < 2; k++) {
      b.fplane('glass_window', H.f[s], a, 0.8 + k * 3.4, 2.2, 2.6, 0.03);
      if (b.d >= 1) { b.fbox('window_frame_dark', H.f[s], a, 0.7 + k * 3.4, 2.4, 0.12, 0.08, 0.02); b.fbox('window_frame_dark', H.f[s], a, 3.4 + k * 3.4, 2.4, 0.12, 0.08, 0.02); }
      if (b.d >= 2) { for (const t of [-0.55, 0, 0.55]) b.fbox('window_frame_dark', H.f[s], a + t, 0.8 + k * 3.4, 0.05, 2.6, 0.06, 0.04); b.fbox('window_frame_dark', H.f[s], a, 2.1 + k * 3.4, 2.2, 0.05, 0.06, 0.04); }
    }
  }
  // Glasanbau als Eingang
  const gx = x + sx / 2 + 1.25, gz = z + sz / 2 - 1.8;
  b.box('glass_window', gx, 0, gz, 2.4, 3.4, 3.4, 0, b.r());
  b.box('metal_dark', gx, 3.4, gz, 2.6, 0.25, 3.6);
  b.take(gx, gz, 2.4, 3.4, 0.2);
  b.sign(H.f.front, 0, h - 1.1, Math.min(sx - 2, 6), 0.7, { bg: 'paint_white', logo: b.pick(LOGO) });
  const p = b.plan.find(3.0, 1.8, { prefer: 'front', pad: 0 }); if (p) bikes(b, p[0], p[1], 4);
  if (wide || deep) b.putCar({ prefer: 'front' });
  greenery(b, wide ? 2 : 1);
  b.lamp(X - 0.5, Z - 0.5, 4.5);
}

// =====================================================================================
// Stufe 2 – Bürohäuser (3–5 Geschosse)
// =====================================================================================

// 60er-Jahre-Bandhaus auf Stützen (zurückgesetztes Erdgeschoss), Technikaufbau
function bandhaus(b) {
  const { W, X, Z, wide, deep } = geom(b);
  b.lot('pavers', 0.1);
  const band = b.pick(['concrete_panel', 'plaster_white', 'stone_sandstone', 'metal_panel_white']);
  const sx = W - 1.6, sz = deep ? 12 : 7.0, x = 0, z = -Z + 0.8 + sz / 2, n = 3 + (b.r() < 0.5 ? 1 : 0), gh = 4.0;
  lobby(b, x, z, sx, sz, gh, { glass: 'glass_window', inset: 1.2, col: band, entryA: -sx / 5 });
  const v = vol(x, z, sx, sz, gh, n);
  facRibbon(b, v, { band, glass: 'glass_window', winH: 1.6, mull: 1.25 });
  const top = roofOff(b, x, v.top, z, sx, sz, { parapet: 0.3, parMat: band, plantMat: band, plantW: 0.3, plantD: 0.5 });
  b.take(x, z, sx, sz, 0.3);
  roofSign(b, b.faces(x, z, sx, sz).front, v.top + 0.35, Math.min(6, sx / 2), 0.9, {});
  plaza(b, z + sz / 2, { entryX: -sx / 5 });
  if (deep) b.putCar({ prefer: 'front' });
  void top; void wide;
}

// Kleines Glasbüro mit Staffelgeschoss und Dachterrasse
function glasbuero(b) {
  const { W, X, Z, deep } = geom(b);
  b.lot('pavers', 0.1);
  const glass = b.pick(GLASS);
  const sx = W - 1.6, sz = deep ? 12 : 7.0, x = 0, z = -Z + 0.8 + sz / 2, n = 3 + (b.r() < 0.5 ? 1 : 0);
  const v = vol(x, z, sx, sz, 0, n);
  facCurtain(b, v, { glass, frame: 'metal_dark', col: 1.5 });
  // Staffelgeschoss
  const s2x = sx - 2.4, s2z = sz - 2.4;
  const v2 = vol(x - 0.6, z - 0.6, s2x, s2z, v.top, 1);
  facCurtain(b, v2, { glass, frame: 'metal_dark' });
  b.box('metal_panel_white', x, v.top, z, sx, 0.4, sz);
  b.box('metal_panel_white', v2.x, v2.top, v2.z, s2x + 0.8, 0.35, s2z + 0.8);
  if (b.d >= 1) { b.box('wood_planks', x, v.top + 0.4, z + sz / 2 - 0.7, sx - 0.4, 0.05, 1.2); b.roofRail(x, v.top + 0.3, z, sx, sz); for (let i = 0; i < 3; i++) b.tree(x - sx / 2 + 1.2 + i * 1.8, z + sz / 2 - 0.7, 0.3, 'busch'); }
  if (b.d >= 1) b.vents(v2.x, v2.top + 0.35, v2.z, s2x * 0.5, s2z * 0.5, 2);
  b.take(x, z, sx, sz, 0.3);
  const ff = b.faces(x, z, sx, sz).front;
  b.entrance(ff, 0, 2.6, 2.8, { glass, canopy: 'metal_panel_white', canopyD: 1.4 });
  roofSign(b, ff, v.top - 1.2, Math.min(6, sx * 0.5), 0.8, { a: sx / 4 });
  plaza(b, z + sz / 2, {});
  if (deep) b.putCar({ prefer: 'front' });
  void X;
}

// Kontorhaus (Backstein, Hamburger Art): Pfeilerfassade, Natursteinsockel, Staffelgeschoss
function kontorhaus(b) {
  const { W, X, Z, deep } = geom(b);
  b.lot('pavers', 0.1);
  const wall = b.pick(['brick_dark', 'brick_brown', 'brick_red', 'brick_dark']);
  const sx = W - 1.0, sz = deep ? 13 : 7.6, x = 0, z = -Z + 0.6 + sz / 2, n = 4 + (b.L >= 3 ? 2 : b.r() < 0.5 ? 1 : 0);
  b.box('stone_sandstone', x, 0, z, sx + 0.1, 3.8, sz + 0.1);
  const fb = b.faces(x, z, sx, sz);
  for (const s of SIDES) b.winRow(fb[s], -fb[s].len / 2 + 1, fb[s].len / 2 - 1, 0.8, 1.6, 2.4, { spacing: 2.4, frame: 'window_frame_dark', arch: 'trim_stone' });
  const v = vol(x, z, sx, sz, 3.8, n);
  facPiers(b, v, { wall, glass: 'glass_window', sp: 1.45, pinnacle: true });
  b.box('trim_stone', x, v.top, z, sx + 0.3, 0.3, sz + 0.3);
  // Staffelgeschoss
  const v2 = vol(x, z - 0.8, sx - 2.0, sz - 2.6, v.top + 0.3, 1 + (n > 5 ? 1 : 0));
  facPunch(b, v2, { wall: 'plaster_white', winW: 1.0, winH: 1.6, spacing: 1.6, frame: 'window_frame_dark', margin: 0.6 });
  b.box('roof_copper', v2.x, v2.top, v2.z, v2.sx + 0.4, 0.4, v2.sz + 0.4);
  b.take(x, z, sx, sz, 0.3);
  // Portal
  const ff = fb.front;
  b.fbox('stone_dark', ff, 0, 0, 3.2, 3.6, 0.35, 0);
  b.fbox('door_wood', ff, 0, 0, 2.0, 2.9, 0.06, 0.35);
  if (b.d >= 1) b.fbox('roof_copper', ff, 0, 3.6, 3.6, 0.25, 0.8, 0);
  b.sign(ff, 0, 3.9, Math.min(8, sx - 3), 0.6, { bg: 'trim_stone', logo: 'roof_copper', text: 'metal_dark' });
  plaza(b, z + sz / 2, { trees: false });
  void X;
}

// 70er-Jahre-Rasterbau mit dunklem Glas
function rasterbau(b) {
  const { W, Z, deep } = geom(b);
  b.lot('pavers', 0.1);
  const frame = b.pick(['concrete', 'concrete_panel', 'stone_sandstone', 'concrete_dark']);
  const sx = W - 1.4, sz = deep ? 12 : 7.4, x = 0, z = -Z + 0.7 + sz / 2, n = 4 + (b.r() < 0.5 ? 1 : 0);
  const v = vol(x, z, sx, sz, 0, n, 3.3);
  facGrid(b, v, { frame, glass: b.pick(['glass_curtain_dark', 'glass_curtain_gold', 'glass_curtain_dark']), bay: 1.65, bandH: 0.7, topH: 1.4 });
  const top = roofOff(b, x, v.top + 1.4, z, sx - 0.6, sz - 0.6, { parapet: 0, plantMat: frame });
  b.take(x, z, sx, sz, 0.3);
  const ff = b.faces(x, z, sx, sz).front;
  b.fbox('metal_dark', ff, -sx / 4, 0, 3.0, 2.8, 0.2, 0);
  b.fplane('glass_window', ff, -sx / 4, 0.1, 2.6, 2.5, 0.22);
  b.fbox(frame, ff, -sx / 4, 2.8, 4.0, 0.4, 2.0, 0);
  roofSign(b, ff, v.top + 0.1, Math.min(6, sx / 2), 1.0, { a: sx / 5 });
  plaza(b, z + sz / 2, { entryX: -sx / 4 });
  void top;
}

// Stromlinien-Bürohaus mit gerundeter Ecke und umlaufenden Fensterbändern (Bauhaus/Expressionismus)
function eckrund(b) {
  const { W, Z, deep } = geom(b);
  b.lot('pavers', 0.1);
  const band = b.pick(['plaster_white', 'plaster_cream', 'brick_dark', 'plaster_white']);
  const glass = 'glass_window';
  const sx = W - 1.2, sz = deep ? 12 : 7.6, x = 0, z = -Z + 0.6 + sz / 2, n = 4 + (b.r() < 0.4 ? 1 : 0), fh = 3.3;
  const R = Math.min(4, sx * 0.35, sz * 0.45), ins = 0.3, winH = 1.5, sill = (fh - winH) * 0.55;
  const segs = b.d >= 2 ? 8 : b.d === 1 ? 6 : 4;
  // Kern
  roundBlock(b, band, x, 0, z, sx - 2 * ins, n * fh, sz - 2 * ins, R - ins, { seg: segs });
  for (let k = 0; k <= n; k++) {
    const yb = k === 0 ? 0 : (k - 1) * fh + sill + winH, yt = k === n ? n * fh + 0.6 : k * fh + sill;
    if (yt - yb > 0.02 && b.d >= 1) roundBlock(b, band, x, yb, z, sx, yt - yb, sz, R, { seg: segs });
  }
  if (b.d === 0) roundBlock(b, band, x, 0, z, sx, n * fh + 0.6, sz, R, { seg: segs });
  // Glas: Front (ohne Rundung), rechte Seite, Rundung, linke Seite, Rückseite
  const cx = sx - 2 * ins, cz = sz - 2 * ins, r2 = R - ins, off = b.d === 0 ? ins + 0.03 : 0.02;
  for (let k = 0; k < n; k++) {
    const y = k * fh + sill;
    const ff = b.face(x - r2 / 2, z, cx - r2, cz, 'front'), fr = b.face(x, z - r2 / 2, cx, cz - r2, 'right');
    b.fplane(glass, ff, 0, y, cx - r2, winH, off);
    b.fplane(glass, fr, 0, y, cz - r2, winH, off);
    b.fplane(glass, b.face(x, z, cx, cz, 'left'), 0, y, cz, winH, off);
    b.fplane(glass, b.face(x, z, cx, cz, 'back'), 0, y, cx, winH, off);
    b.cyl(glass, x + cx / 2 - r2, y, z + cz / 2 - r2, r2 + off, winH, { seg: segs, t0: 0, tl: HP, open: true, lit: b.r() });
  }
  // Eingang an der Rundung und Dachaufbau
  const ea = -sx / 4;
  b.fbox('metal_dark', b.face(x, z, sx, sz, 'front'), ea, 0, 2.6, 2.6, 0.2, 0);
  b.fplane(glass, b.face(x, z, sx, sz, 'front'), ea, 0.1, 2.2, 2.3, 0.22);
  if (b.d >= 1) b.fbox('metal_dark', b.face(x, z, sx, sz, 'front'), ea, 2.7, 3.6, 0.15, 1.2, 0);
  const top = n * fh + 0.6;
  if (b.d >= 1) { b.box(band, x - sx * 0.2, top, z - sz * 0.15, sx * 0.4, 2.6, sz * 0.4); b.box('metal_dark', x - sx * 0.2, top + 2.6, z - sz * 0.15, sx * 0.4 + 0.6, 0.15, sz * 0.4 + 0.6); }
  if (b.d >= 1) b.cyl('metal_light', x + sx / 2 - R, top, z + sz / 2 - R, 0.08, 4, { seg: 5, exact: true });
  b.sign(b.face(x, z, sx, sz, 'front'), sx / 2 - R - 2.2, top - 0.6 - 0.9, 3.6, 0.7, { logo: b.pick(LOGO) });
  b.take(x, z, sx, sz, 0.3);
  plaza(b, z + sz / 2, { entryX: ea });
}

// Bürohaus mit senkrechten Sonnenschutz-Lamellen
function lamellen(b) {
  const { W, Z, deep } = geom(b);
  b.lot('pavers', 0.1);
  const fin = b.pick(['metal_panel_white', 'concrete_panel', 'wood_planks', 'metal_light', 'brick_red']);
  const glass = b.pick(['glass_window', 'glass_curtain_green', 'glass_curtain_blue']);
  const sx = W - 1.6, sz = deep ? 12 : 7.2, x = 0, z = -Z + 0.8 + sz / 2, n = 4 + (b.r() < 0.5 ? 1 : 0);
  const gh = 4.2;
  lobby(b, x, z, sx, sz, gh, { glass, inset: 0.6, col: fin === 'wood_planks' ? 'concrete' : fin, entryA: sx / 5 });
  const v = vol(x, z, sx, sz, gh, n);
  facFins(b, v, { glass, frame: 'metal_dark', fin, finSp: 1.25, finD: 0.6 });
  b.box(fin === 'wood_planks' ? 'concrete_panel' : fin, x, v.top, z, sx + 0.8, 0.5, sz + 0.8);
  roofOff(b, x, v.top + 0.5, z, sx, sz, { parapet: 0, plantMat: 'metal_panel_grey' });
  b.take(x, z, sx + 0.8, sz + 0.8, 0.2);
  roofSign(b, b.faces(x, z, sx, sz).front, gh - 1.4, Math.min(5, sx / 3), 0.7, { a: -sx / 4 });
  plaza(b, z + sz / 2 + 0.4, { entryX: sx / 5 });
}

// =====================================================================================
// Stufe 3 – Bürogebäude (5–9 Geschosse)
// =====================================================================================

// Glasriegel: niedriger Flügel und hoher Block, zwei Glastöne
function glasriegel(b) {
  const { W, X, Z, wide, deep } = geom(b);
  b.lot('pavers', 0.1);
  const g1 = b.pick(GLASS), g2 = b.pick(GLASS.filter((g) => g !== g1));
  const sx = W - 1.4, sz = deep ? 13 : 7.6, z = -Z + 0.7 + sz / 2;
  const hiW = wide ? sx * 0.45 : sx, hiD = deep ? sz * 0.55 : sz;
  const hx = wide ? X - 0.7 - hiW / 2 : 0, hz = deep ? -Z + 0.7 + hiD / 2 : z;
  const nHi = 7 + b.int(0, 2), nLo = 3;
  if (wide || deep) {
    const lx = wide ? -X + 0.7 + (sx - hiW) / 2 + 0.2 : 0, lz = deep ? hz + hiD / 2 + (sz - hiD) / 2 - 0.2 : z;
    const lsx = wide ? sx - hiW + 0.4 : sx, lsz = deep ? sz - hiD + 0.4 : sz;
    facCurtain(b, vol(lx, lz, lsx, lsz, 0, nLo), { glass: g2 });
    b.box('metal_panel_white', lx, nLo * FH, lz, lsx, 0.5, lsz);
    if (b.d >= 1) { b.box('green_roof', lx, nLo * FH + 0.5, lz, lsx - 0.6, 0.1, lsz - 0.6); b.vents(lx, nLo * FH + 0.6, lz, lsx * 0.4, lsz * 0.4, 2); }
    b.take(lx, lz, lsx, lsz, 0.3);
  }
  const v = vol(hx, hz, hiW, hiD, 0, nHi);
  facCurtain(b, v, { glass: g1, col: 1.35 });
  b.box('metal_panel_white', hx, v.top, hz, hiW + 0.2, 0.6, hiD + 0.2);
  roofOff(b, hx, v.top + 0.6, hz, hiW, hiD, { parapet: 0.2, parMat: 'metal_panel_white', plantMat: 'metal_panel_grey', rail: true });
  b.take(hx, hz, hiW, hiD, 0.3);
  const ff = b.faces(hx, hz, hiW, hiD).front;
  roofSign(b, ff, v.top - 1.5, Math.min(6, hiW * 0.6), 1.0, {});
  if (!deep) b.entrance(ff, wide ? 0 : -hiW / 4, 2.6, 3.0, { glass: g1, canopy: 'metal_panel_white', canopyD: 1.4 });
  plaza(b, z + sz / 2, { entryX: hx });
}

// Bandblock mit außenliegendem Treppenhausturm und zurückgesetztem Dachgeschoss
function bandblock(b) {
  const { W, Z, deep } = geom(b);
  b.lot('pavers', 0.1);
  const band = b.pick(['concrete_panel', 'metal_panel_white', 'plaster_white', 'stone_sandstone', 'metal_panel_grey']);
  const sx = W - 1.4, sz = deep ? 12 : 7.6, z = -Z + 0.7 + sz / 2, n = 5 + b.int(0, 2), gh = 4.0;
  const coreW = 2.8, mx = -coreW / 2;
  lobby(b, mx, z, sx - coreW, sz, gh, { glass: 'glass_window', inset: 0.8, col: band, entryA: 0 });
  const v = vol(mx, z, sx - coreW, sz, gh, n);
  facRibbon(b, v, { band, glass: b.pick(['glass_window', 'glass_curtain_blue']), winH: 1.7 });
  // Treppenhausturm (geschlossen, höher)
  const cxp = sx / 2 - coreW / 2, ch = v.top + 3.4;
  b.box('concrete', cxp, 0, z - sz * 0.1, coreW, ch, sz * 0.55);
  if (b.d >= 1) { const fcore = b.face(cxp, z - sz * 0.1, coreW, sz * 0.55, 'front'); for (let k = 0; k < n + 1; k++) b.fplane('glass_window', fcore, 0, gh + k * FH + 1.0, 0.6, 1.4, 0.02); }
  const v2 = vol(mx, z - 0.8, sx - coreW - 2.4, sz - 2.6, v.top, 1);
  facCurtain(b, v2, { glass: 'glass_window' });
  b.box('metal_dark', v2.x, v2.top, v2.z, v2.sx + 0.8, 0.3, v2.sz + 0.8);
  if (b.d >= 1) b.roofRail(mx, v.top, z, sx - coreW, sz);
  roofSign(b, b.face(cxp, z - sz * 0.1, coreW, sz * 0.55, 'front'), ch - 2.6, coreW - 0.4, 1.8, { disc: true });
  b.take(0, z, sx, sz, 0.3);
  plaza(b, z + sz / 2, {});
  if (deep) b.putCar({ prefer: 'front' });
}

// Großes Kontorhaus mit zwei Staffelgeschossen und Kupferdach
function kontorhausGross(b) {
  const { W, Z, deep } = geom(b);
  b.lot('pavers', 0.1);
  const wall = b.pick(['brick_dark', 'brick_brown', 'brick_dark', 'brick_red']);
  const sx = W - 0.8, sz = deep ? 14 : 8.4, x = 0, z = -Z + 0.5 + sz / 2, n = 6 + b.int(0, 1);
  b.box('stone_dark', x, 0, z, sx + 0.1, 4.0, sz + 0.1);
  const fb = b.faces(x, z, sx, sz);
  for (const s of SIDES) b.winRow(fb[s], -fb[s].len / 2 + 1, fb[s].len / 2 - 1, 0.9, 1.8, 2.6, { spacing: 2.6, frame: 'window_frame_dark', arch: 'trim_stone' });
  const v = vol(x, z, sx, sz, 4.0, n);
  facPiers(b, v, { wall, sp: 1.4, pinnacle: true, cap: 'trim_stone' });
  b.box('trim_stone', x, v.top, z, sx + 0.3, 0.35, sz + 0.3);
  const s1 = vol(x, z - 0.7, sx - 1.8, sz - 2.4, v.top + 0.35, 1), s2 = vol(x, z - 1.3, sx - 3.8, sz - 4.4, s1.top + 0.3, 1);
  facPiers(b, s1, { wall, sp: 1.4 });
  b.box('trim_stone', s1.x, s1.top, s1.z, s1.sx + 0.25, 0.3, s1.sz + 0.25);
  facPunch(b, s2, { wall: 'plaster_white', winW: 1.0, winH: 1.6, spacing: 1.7, margin: 0.6, frame: 'window_frame_dark' });
  b.k.hipRoof('roof_copper', s2.x * 0.1, s2.top * 0.1, s2.z * 0.1, s2.sx * 0.1, s2.sz * 0.1, 0.18, { overhang: 0.03, ridgeK: 0.8 });
  b.take(x, z, sx, sz, 0.3);
  const ff = fb.front;
  b.fbox('stone_dark', ff, 0, 0, 3.6, 3.8, 0.4, 0);
  b.fbox('door_wood', ff, 0, 0, 2.2, 3.0, 0.06, 0.4);
  if (b.d >= 1) b.fbox('roof_copper', ff, 0, 3.8, 4.0, 0.25, 0.9, 0);
  b.sign(ff, 0, 4.15, Math.min(8, sx - 3), 0.6, { bg: 'trim_stone', logo: 'roof_copper', text: 'metal_dark' });
  plaza(b, z + sz / 2, { trees: false });
}

// Bürokomplex mit Innenhof (U- oder Ringform) und begrüntem Hof
function innenhof(b) {
  const { W, D, X, Z, wide, deep } = geom(b);
  b.lot('pavers', 0.1);
  const band = b.pick(['concrete_panel', 'plaster_white', 'stone_sandstone', 'metal_panel_white', 'brick_red']);
  const glass = b.pick(['glass_window', 'glass_curtain_blue', 'glass_curtain_green']);
  const n = 5 + b.int(0, 2), wd = Math.min(5.6, Math.min(W, D) * 0.34);
  const x0 = -X + 0.6, x1 = X - 0.6, z0 = -Z + 0.6, z1 = Z - (deep ? 2.4 : 1.2);
  const type = b.chance(0.5) ? 'ribbon' : 'grid';
  const fo = type === 'ribbon' ? { band, glass, winH: 1.6 } : { frame: band, glass, bay: 1.6, bandH: 0.7, topH: 0.9 };
  const wings = [];
  // Hinterer Flügel
  wings.push([0, z0 + wd / 2, x1 - x0, wd]);
  // Seitenflügel
  wings.push([x0 + wd / 2, (z0 + wd + z1) / 2, wd, z1 - z0 - wd]);
  wings.push([x1 - wd / 2, (z0 + wd + z1) / 2, wd, z1 - z0 - wd]);
  // Vorderer Flügel (Ring) nur bei 2×2, mit Durchgang
  const ring = wide && deep;
  if (ring) wings.push([0, z1 - wd / 2, x1 - x0 - 2 * wd, wd]);
  wings.forEach(([wx, wz, wsx, wsz], i) => {
    const pass = ring && i === 3;
    if (pass) lobby(b, wx, wz, wsx, wsz, 4.4, { glass, inset: 0.7, canopy: false, col: band === 'brick_red' ? 'concrete' : band });
    fac(b, type, vol(wx, wz, wsx, wsz, pass ? 4.4 : 0, pass ? n - 1 : n, pass ? (n * FH - 4.4) / (n - 1) : FH), fo);
    roofOff(b, wx, n * FH + (type === 'grid' ? 0.9 : 0), wz, wsx, wsz, { parapet: 0.5, parMat: band, plant: wsx > 8 || wsz > 8, plantMat: 'metal_panel_grey' });
    b.take(wx, wz, wsx, wsz, 0.2);
  });
  // Hof
  const hx = 0, hz = (z0 + wd + (ring ? z1 - wd : z1)) / 2, hsx = x1 - x0 - 2 * wd, hsz = (ring ? z1 - wd : z1) - z0 - wd;
  if (hsx > 1.5 && hsz > 1.5) {
    b.ground('grass', hx, hz, hsx - 0.4, hsz - 0.4, 0.14);
    if (hsx > 4 && hsz > 4) { b.tree(hx, hz, Math.min(1.0, Math.min(hsx, hsz) / 6)); b.take(hx, hz, 4, 4, 0); }
    if (b.d >= 2) b.box('pavers', hx, 0.14, hz, Math.max(0.5, hsx - 3), 0.04, 1.0);
  }
  const ff = b.face(0, z0 + wd / 2, x1 - x0, wd, 'front');
  if (!ring) b.entrance(b.face(x0 + wd / 2, (z0 + wd + z1) / 2, wd, z1 - z0 - wd, 'front'), 0, 2.2, 2.8, { glass, canopyD: 1.0 });
  roofSign(b, b.face(x1 - wd / 2, (z0 + wd + z1) / 2, wd, z1 - z0 - wd, 'front'), n * FH - 1.4, wd - 1.0, 0.9, { disc: true });
  void ff;
  plaza(b, z1, { trees: deep });
}

// Terrassen-Bürohaus: Geschosse treppen nach vorne zurück, begrünte Terrassen
function staffelbau(b) {
  const { W, Z, deep } = geom(b);
  b.lot('grass', 0.1);
  const band = b.pick(['plaster_white', 'concrete_panel', 'metal_panel_white', 'stone_sandstone']);
  const glass = b.pick(['glass_window', 'glass_curtain_green', 'glass_curtain_blue']);
  const sx = W - 1.6, szMax = deep ? 14 : 7.6, z0 = -Z + 0.8, n = 6 + b.int(0, 2);
  const step = (szMax - 3.2) / (n - 1);
  for (let k = 0; k < n; k++) {
    const sz = szMax - k * step, z = z0 + sz / 2;
    const v = vol(0, z, sx - (k % 2 ? 0 : 0), sz, k * FH, 1);
    facRibbon(b, v, { band, glass, winH: 2.0, sides: ['front', 'left', 'right'] });
    if (b.d >= 1 && k < n - 1) {
      const tz = z0 + sz - step / 2;
      b.box('green_roof', 0, (k + 1) * FH, tz, sx - 0.4, 0.15, step - 0.2);
      if (b.d >= 2) { b.box('metal_light', 0, (k + 1) * FH + 1.0, z0 + sz - 0.05, sx - 0.2, 0.06, 0.06); for (let i = 0; i < 3; i++) b.sphere('hedge', -sx / 2 + 1.5 + i * (sx - 3) / 2, (k + 1) * FH + 0.5, tz, 0.6, { seg: 6, sy: 0.7 }); }
    }
  }
  const top = n * FH;
  roofOff(b, 0, top, z0 + (szMax - (n - 1) * step) / 2, sx, szMax - (n - 1) * step, { parapet: 0.4, parMat: band, plant: false });
  b.take(0, z0 + szMax / 2, sx, szMax, 0.3);
  b.entrance(b.face(0, z0 + szMax / 2, sx, szMax, 'front'), 0, 2.6, 2.6, { glass, canopyD: 0.9 });
  roofSign(b, b.face(0, z0 + szMax / 2, sx, szMax, 'front'), 2.75, 3.2, 0.5, { a: sx / 3 });
  plaza(b, z0 + szMax, {});
}

// Bürogebäude mit farbigen Lamellen und gläsernem Eckturm
function eckturm(b) {
  const { W, Z, deep } = geom(b);
  b.lot('pavers', 0.1);
  const fin = b.pick(['brick_red', 'metal_panel_white', 'container_green', 'wood_planks', 'stone_sandstone']);
  const glass = b.pick(GLASS);
  const sx = W - 1.2, sz = deep ? 12 : 7.6, z = -Z + 0.6 + sz / 2, n = 6 + b.int(0, 1);
  const tw = Math.min(4.2, sx * 0.4);
  const v = vol(-tw / 2, z, sx - tw, sz, 0, n);
  facFins(b, v, { glass: 'glass_window', fin, finSp: 1.4, finD: 0.45, finW: 0.4 });
  roofOff(b, v.x, v.top, z, v.sx, sz, { parapet: 0.8, parMat: fin === 'wood_planks' ? 'concrete' : fin, plantMat: 'metal_panel_grey' });
  const t = vol(sx / 2 - tw / 2, z + 0.4, tw, sz - 0.8, 0, n + 2);
  facCurtain(b, t, { glass, col: 1.2 });
  b.box('metal_dark', t.x, t.top, t.z, tw + 0.2, 0.5, t.sz + 0.2);
  b.take(0, z, sx, sz, 0.3);
  roofSign(b, b.face(t.x, t.z, tw, t.sz, 'front'), t.top - 1.8, tw - 0.6, 1.2, { disc: true });
  b.entrance(b.face(t.x, t.z, tw, t.sz, 'front'), 0, 2.4, 3.0, { glass, canopyD: 1.2 });
  plaza(b, z + sz / 2, { entryX: t.x });
}

// =====================================================================================
// Stufe 4 – Bürotürme (9–18 Geschosse)
// =====================================================================================

// Turm mit Staffeln: Sockel, Schaft, zwei Rücksprünge, Krone
function staffelturm(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const type = b.pick(['ribbon', 'curtain', 'grid']);
  const glass = b.pick(GLASS), band = b.pick(['concrete_panel', 'stone_sandstone', 'metal_panel_white', 'plaster_white']);
  const pz = -Z + 0.6 + (D - 3.0) / 2, psx = W - 1.2, psz = D - 3.0;
  const np = 3, nS = 9 + b.int(0, 3), nU = 3;
  lobby(b, 0, pz, psx, psz, 4.4, { glass: type === 'curtain' ? glass : 'glass_window', inset: 0.6, col: band });
  fac(b, type, vol(0, pz, psx, psz, 4.4, np - 1), type === 'grid' ? { frame: band, glass, topH: 0.6 } : type === 'ribbon' ? { band, glass: 'glass_window' } : { glass });
  const y1 = 4.4 + (np - 1) * FH + (type === 'grid' ? 0.6 : 0);
  b.box(band, 0, y1, pz, psx + 0.2, 0.5, psz + 0.2);
  const ssx = psx * 0.78, ssz = psz * 0.78;
  const v = vol(0, pz - psz * 0.05, ssx, ssz, y1 + 0.5, nS);
  fac(b, type, v, type === 'grid' ? { frame: band, glass, topH: 0.6 } : type === 'ribbon' ? { band, glass: 'glass_window' } : { glass });
  const y2 = v.top + (type === 'grid' ? 0.6 : 0);
  b.box(band, 0, y2, v.z, ssx + 0.3, 0.4, ssz + 0.3);
  const u = vol(0, v.z, ssx * 0.72, ssz * 0.72, y2 + 0.4, nU);
  fac(b, type, u, type === 'grid' ? { frame: band, glass, topH: 0.6 } : type === 'ribbon' ? { band, glass: 'glass_window' } : { glass });
  const y3 = u.top + (type === 'grid' ? 0.6 : 0);
  b.box(band, 0, y3, u.z, u.sx + 0.3, 1.2, u.sz + 0.3);
  if (b.d >= 1) b.box('metal_panel_grey', 0, y3 + 1.2, u.z, u.sx * 0.5, 2.6, u.sz * 0.5);
  antenna(b, 0, y3 + 3.8, u.z, 6);
  b.take(0, pz, psx, psz, 0.3);
  roofSign(b, b.faces(0, v.z, ssx, ssz).front, y2 - 1.6, Math.min(5, ssx * 0.6), 1.1, {});
  plaza(b, pz + psz / 2, {});
}

// Scheibenhochhaus: schmale, breite Scheibe auf Sockel mit geschlossenen Stirnseiten
function scheibe(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const glass = b.pick(GLASS), endMat = b.pick(['concrete', 'stone_sandstone', 'concrete_panel', 'metal_panel_grey']);
  const along = W >= D;
  const psx = W - 1.2, psz = D - 2.8, pz = -Z + 0.6 + psz / 2;
  lobby(b, 0, pz, psx, psz, 4.6, { glass, inset: 0.8, col: endMat });
  b.box(endMat, 0, 4.6, pz, psx, 0.6, psz);
  const n = 11 + b.int(0, 4);
  const ssx = along ? psx - 1.2 : Math.min(psx - 1.4, 5.6), ssz = along ? Math.min(psz - 1.2, 5.4) : psz - 1.2;
  const sides = along ? ['front', 'back'] : ['left', 'right'];
  const v = vol(0, pz, ssx, ssz, 5.2, n);
  facCurtain(b, v, { glass, sides, blind: endMat, col: 1.35 });
  // Stirnseiten mit Fugen
  const f = b.faces(0, pz, ssx, ssz);
  for (const s of SIDES) if (!sides.includes(s)) {
    b.fbox(endMat, f[s], 0, 5.2, f[s].len + 0.3, n * FH + 1.6, 0.35, -0.05);
    if (b.d >= 2) for (let k = 1; k < n; k += 2) b.fbox('concrete_dark', f[s], 0, 5.2 + k * FH, f[s].len + 0.32, 0.06, 0.37, -0.05);
  }
  b.box(endMat, 0, v.top, pz, ssx + 0.3, 1.6, ssz + 0.3);
  if (b.d >= 1) b.box('metal_panel_grey', 0, v.top + 1.6, pz, ssx * 0.6, 2.4, ssz * 0.5);
  b.take(0, pz, psx, psz, 0.3);
  roofSign(b, f[along ? 'front' : 'right'], v.top + 0.2, Math.min(6, f[along ? 'front' : 'right'].len * 0.5), 1.1, {});
  antenna(b, ssx * 0.3, v.top + 1.6, pz, 4);
  plaza(b, pz + psz / 2, {});
}

// Achteckturm: Glasprisma mit umlaufenden Geschossbändern
function achteck(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const glass = b.pick(GLASS), band = b.pick(['metal_panel_white', 'concrete_panel', 'metal_light', 'stone_sandstone']);
  const psx = W - 1.4, psz = D - 2.8, pz = -Z + 0.7 + psz / 2;
  const np = 2;
  lobby(b, 0, pz, psx, psz, 4.4, { glass, inset: 0.5, col: band });
  b.box(band, 0, 4.4, pz, psx, (np - 1) * FH + 0.5, psz);
  if (b.d >= 1) b.box('green_roof', 0, 4.4 + (np - 1) * FH + 0.5, pz, psx - 0.6, 0.1, psz - 0.6);
  const r = Math.min(psx, psz) * 0.46, n = 12 + b.int(0, 4), y0 = 4.4 + (np - 1) * FH + 0.5;
  const s8 = b.d === 0 ? 8 : 8;
  for (let k = 0; k < n; k++) {
    b.cyl(glass, 0, y0 + k * FH + 0.12, pz, r, FH - 0.24, { seg: s8, exact: true, open: true, ry: PI / 8, lit: b.r() });
    if (b.d >= 1) b.cyl(band, 0, y0 + k * FH - 0.12, pz, r + 0.12, 0.24, { seg: s8, exact: true, ry: PI / 8 });
  }
  b.cyl('metal_dark', 0, y0, pz, r - 0.1, n * FH, { seg: s8, exact: true, ry: PI / 8 });
  b.cyl(band, 0, y0 + n * FH - 0.1, pz, r + 0.2, 1.4, { seg: s8, exact: true, ry: PI / 8 });
  b.cyl('metal_panel_grey', 0, y0 + n * FH + 1.3, pz, r * 0.55, 2.4, { seg: s8, exact: true, ry: PI / 8 });
  if (b.d >= 1) b.cyl('emissive_cool', 0, y0 + n * FH + 0.5, pz, r + 0.22, 0.2, { seg: s8, exact: true, ry: PI / 8, open: true });
  antenna(b, 0, y0 + n * FH + 3.7, pz, 7);
  b.take(0, pz, psx, psz, 0.3);
  b.sign(b.faces(0, pz, psx, psz).front, -psx / 4, 1.0, Math.min(4, psx / 3), 0.6, { logo: b.pick(LOGO) });
  plaza(b, pz + psz / 2, {});
}

// 70er-Rasterturm: Betonraster, dunkles Glas, Kopfband
function rasterturm(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const frame = b.pick(['concrete', 'concrete_panel', 'stone_sandstone', 'concrete_dark', 'metal_panel_white']);
  const glass = b.pick(['glass_curtain_dark', 'glass_curtain_gold', 'glass_curtain_blue']);
  const psx = W - 1.2, psz = D - 2.6, pz = -Z + 0.6 + psz / 2;
  lobby(b, 0, pz, psx, psz, 4.2, { glass: 'glass_window', inset: 1.0, col: frame });
  const n = 11 + b.int(0, 3);
  const v = vol(0, pz, psx - 0.4, psz - 0.4, 4.2, n, 3.3);
  facGrid(b, v, { frame, glass, bay: 1.5, bandH: 0.75, topH: 1.0 });
  const top = v.top + 1.0;
  b.box(frame, 0, top, pz, psx, 2.4, psz);
  if (b.d >= 1) for (let i = 0; i < Math.round(psx / 1.5); i++) b.fbox('concrete_dark', b.faces(0, pz, psx, psz).front, -psx / 2 + 0.75 + i * 1.5, top + 0.4, 0.5, 1.6, 0.05, 0);
  roofOff(b, 0, top + 2.4, pz, psx - 1, psz - 1, { parapet: 0, plantMat: frame, bmu: true });
  b.take(0, pz, psx, psz, 0.3);
  roofSign(b, b.faces(0, pz, psx, psz).front, top + 0.4, Math.min(6, psx * 0.6), 1.5, {});
  plaza(b, pz + psz / 2, {});
}

// Zwillingstürme auf gemeinsamem Sockel mit Himmelsbrücke
function zwilling(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const glass = b.pick(GLASS), band = b.pick(['metal_panel_white', 'stone_sandstone', 'concrete_panel']);
  const psx = W - 1.0, psz = D - 2.6, pz = -Z + 0.5 + psz / 2;
  lobby(b, 0, pz, psx, psz, 4.4, { glass, inset: 0.6, col: band });
  b.box(band, 0, 4.4, pz, psx, 3.6, psz);
  if (b.d >= 1) b.box('green_roof', 0, 8.0, pz, psx - 0.6, 0.1, psz - 0.6);
  const along = W >= D;
  const tsx = along ? psx * 0.38 : psx * 0.7, tsz = along ? psz * 0.7 : psz * 0.38;
  const n1 = 10 + b.int(0, 3), n2 = n1 - 2;
  const pos = along ? [[-psx * 0.27, pz], [psx * 0.27, pz]] : [[0, pz - psz * 0.27], [0, pz + psz * 0.27]];
  const tops = [];
  pos.forEach(([tx, tz], i) => {
    const v = vol(tx, tz, tsx, tsz, 8.0, i ? n2 : n1);
    facCurtain(b, v, { glass, col: 1.3 });
    b.box(band, tx, v.top, tz, tsx + 0.3, 1.2, tsz + 0.3);
    if (b.d >= 1) b.box('metal_panel_grey', tx, v.top + 1.2, tz, tsx * 0.5, 2.0, tsz * 0.5);
    tops.push(v.top);
  });
  // Brücke
  const by = 8.0 + 6 * FH;
  const bw = along ? Math.abs(pos[1][0] - pos[0][0]) - tsx : Math.abs(pos[1][1] - pos[0][1]) - tsz;
  if (bw > 0.5) {
    const bx = (pos[0][0] + pos[1][0]) / 2, bz = (pos[0][1] + pos[1][1]) / 2;
    b.box('metal_dark', bx, by - 0.2, bz, along ? bw + 0.4 : 2.6, 0.3, along ? 2.6 : bw + 0.4);
    b.box(glass, bx, by + 0.1, bz, along ? bw + 0.2 : 2.4, 2.8, along ? 2.4 : bw + 0.2, 0, b.r());
    b.box('metal_dark', bx, by + 2.9, bz, along ? bw + 0.4 : 2.6, 0.3, along ? 2.6 : bw + 0.4);
  }
  antenna(b, pos[0][0], tops[0] + 3.2, pos[0][1], 5);
  b.take(0, pz, psx, psz, 0.3);
  b.sign(b.faces(0, pz, psx, psz).front, 0, 6.0, Math.min(7, psx * 0.5), 1.0, { logo: b.pick(LOGO) });
  plaza(b, pz + psz / 2, {});
}

// Konzernzentrale: Glasturm mit leuchtenden Kantenbändern und Logo an der Spitze
function konzern(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const glass = b.pick(GLASS), glow = b.pick(['emissive_cool', 'emissive_warm', 'sign_white']);
  const psx = W - 1.4, psz = D - 2.8, pz = -Z + 0.7 + psz / 2;
  const tsx = psx * 0.82, tsz = psz * 0.82, n = 13 + b.int(0, 3);
  lobby(b, 0, pz, psx, psz, 6.0, { glass, inset: 0.4, col: 'metal_light' });
  b.box('metal_panel_white', 0, 6.0, pz, psx + 0.4, 0.5, psz + 0.4);
  const v = vol(0, pz, tsx, tsz, 6.5, n);
  facCurtain(b, v, { glass, col: 1.2 });
  // Leuchtende Kanten
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(glow, sx * (tsx / 2 + 0.05), 6.5, pz + sz * (tsz / 2 + 0.05), 0.25, n * FH, 0.25);
  b.box('metal_dark', 0, v.top, pz, tsx + 0.2, 3.0, tsz + 0.2);
  b.box(glow, 0, v.top + 3.0, pz, tsx + 0.3, 0.25, tsz + 0.3);
  const f = b.faces(0, pz, tsx + 0.2, tsz + 0.2);
  b.sign(f.front, 0, v.top + 0.4, Math.min(tsx - 1, 7), 2.2, { disc: true });
  if (b.d >= 1) b.sign(f.left, 0, v.top + 0.4, Math.min(tsz - 1, 5), 2.2, { disc: true });
  antenna(b, 0, v.top + 3.25, pz, 5);
  b.take(0, pz, psx, psz, 0.3);
  plaza(b, pz + psz / 2, {});
  b.flags(0, Z - 1.0, 3, 0);
}

// =====================================================================================
// Stufe 5 – Wolkenkratzer (20–40 Geschosse)
// =====================================================================================
const towerFloors = (b, base) => Math.round(base * (b.fw * b.fd >= 4 ? 1.25 : b.fw * b.fd >= 2 ? 1.1 : 0.95)) + b.int(0, 3);

// Kronenturm (Art déco): Schaft mit Lisenen, dreistufige Krone mit Lichtbändern, Spitze
function kronenturm(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const stone = b.pick(['stone_sandstone', 'concrete_panel', 'plaster_cream', 'brick_yellow', 'stone_grey']);
  const glow = b.pick(['emissive_warm', 'sign_white', 'emissive_cool']);
  const psx = W - 1.0, psz = D - 2.4, pz = -Z + 0.5 + psz / 2;
  b.box('stone_dark', 0, 0, pz, psx, 1.2, psz);
  facPiers(b, vol(0, pz, psx, psz, 1.2, 3, 3.6), { wall: stone, sp: 1.8, glass: 'glass_window' });
  const y1 = 1.2 + 3 * 3.6;
  b.box('trim_stone', 0, y1, pz, psx + 0.3, 0.4, psz + 0.3);
  const n = towerFloors(b, 22);
  const tsx = psx * 0.74, tsz = psz * 0.74;
  const v = vol(0, pz, tsx, tsz, y1 + 0.4, n, 3.5);
  facPiers(b, v, { wall: stone, sp: 1.3, glass: 'glass_window' });
  let y = v.top, sx = tsx, sz = tsz;
  for (let k = 0; k < 3; k++) {
    b.box('trim_stone', 0, y, pz, sx + 0.3, 0.35, sz + 0.3);
    if (b.d >= 1) b.box(glow, 0, y + 0.35, pz, sx + 0.32, 0.18, sz + 0.32);
    sx *= 0.74; sz *= 0.74;
    const h = 3.5 * (2 - k * 0.4);
    facPiers(b, vol(0, pz, sx, sz, y + 0.53, 1, h), { wall: stone, sp: 1.1, glass: 'glass_window' });
    y += 0.53 + h;
  }
  b.box('trim_stone', 0, y, pz, sx + 0.3, 0.4, sz + 0.3);
  b.cone('metal_light', 0, y + 0.4, pz, Math.min(sx, sz) * 0.32, 12, { seg: 8 });
  b.light(0, y + 12.6, pz, 0xff2a20, 0.35);
  b.take(0, pz, psx, psz, 0.3);
  const ff = b.faces(0, pz, psx, psz).front;
  b.fbox('stone_dark', ff, 0, 0, 4.0, 5.0, 0.4, 0);
  b.fplane('glass_window', ff, 0, 0.2, 3.0, 4.2, 0.42);
  if (b.d >= 1) b.fbox('roof_copper', ff, 0, 5.0, 5.0, 0.3, 1.4, 0);
  b.sign(ff, 0, 5.5, Math.min(7, psx - 2), 0.8, { bg: 'trim_stone', logo: 'roof_copper', text: 'metal_dark' });
  plaza(b, pz + psz / 2, { trees: false });
}

// Pyramidenturm: quadratischer Glasschaft mit Pyramidendach und leuchtender Spitze
function pyramidenturm(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const glass = b.pick(GLASS), stone = b.pick(['stone_sandstone', 'stone_grey', 'concrete_panel', 'marble']);
  const psx = W - 1.2, psz = D - 2.6, pz = -Z + 0.6 + psz / 2;
  lobby(b, 0, pz, psx, psz, 5.0, { glass, inset: 0.6, col: stone });
  b.box(stone, 0, 5.0, pz, psx, 2 * FH, psz);
  const fp = b.faces(0, pz, psx, psz);
  for (const s of SIDES) for (let k = 0; k < 2; k++) b.winRow(fp[s], -fp[s].len / 2 + 0.8, fp[s].len / 2 - 0.8, 5.0 + k * FH + 0.7, 1.2, 2.0, { spacing: 1.8, frame: 'metal_dark', glass });
  const s0 = Math.min(psx, psz) * 0.8, n = towerFloors(b, 26);
  const v = vol(0, pz, s0, s0, 5.0 + 2 * FH, n);
  // Schaft mit abgeschrägten Ecken: Glas + Steinlisenen an den Ecken
  facCurtain(b, v, { glass, col: 1.4 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(stone, sx * (s0 / 2 - 0.4), v.y0, pz + sz * (s0 / 2 - 0.4), 1.0, n * FH + 0.6, 1.0);
  b.box(stone, 0, v.top, pz, s0 + 0.3, 0.6, s0 + 0.3);
  const ph = s0 * 0.95;
  b.cone(glass, 0, v.top + 0.6, pz, s0 * 0.68, ph, { seg: 4, exact: true, ry: PI / 4 });
  if (b.d >= 1) for (let k = 1; k < 4; k++) b.cone('metal_dark', 0, v.top + 0.6 + (ph * k) / 4 - 0.1, pz, s0 * 0.68 * (1 - k / 4) + 0.1, 0.2, { seg: 4, exact: true, ry: PI / 4 });
  b.box('sign_white', 0, v.top + 0.6 + ph * 0.82, pz, 0.6, ph * 0.12, 0.6);
  b.cyl('metal_light', 0, v.top + 0.6 + ph * 0.9, pz, 0.15, 6, { seg: 6, exact: true });
  b.light(0, v.top + ph + 7, pz, 0xff2a20, 0.35);
  b.light(0, v.top + ph * 0.85, pz, 0xffd79a, 0.8);
  b.take(0, pz, psx, psz, 0.3);
  b.sign(fp.front, 0, 5.0 + 2 * FH + 0.2, Math.min(6, psx * 0.5), 0.9, { logo: b.pick(LOGO) });
  plaza(b, pz + psz / 2, {});
}

// Rundturm: zylindrischer Glasturm mit Geschossringen, Lichtkrone und Antenne
function rundturm(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const glass = b.pick(GLASS), band = b.pick(['metal_panel_white', 'metal_light', 'concrete_panel']);
  const psx = W - 1.2, psz = D - 2.6, pz = -Z + 0.6 + psz / 2;
  const r = Math.min(psx, psz) * 0.45, n = towerFloors(b, 27);
  const seg = b.d >= 2 ? 20 : b.d === 1 ? 14 : 10;
  // Sockel als flacher Ring mit Glas
  b.cyl('metal_dark', 0, 0, pz, Math.min(psx, psz) * 0.49, 5.4, { seg, exact: true });
  for (let k = 0; k < 1; k++) b.cyl(glass, 0, 0.2, pz, Math.min(psx, psz) * 0.495, 4.8, { seg, exact: true, open: true, lit: b.r() });
  b.cyl(band, 0, 5.4, pz, Math.min(psx, psz) * 0.5, 0.6, { seg, exact: true });
  const y0 = 6.0;
  b.cyl('metal_dark', 0, y0, pz, r - 0.12, n * FH, { seg, exact: true });
  for (let k = 0; k < n; k++) {
    b.cyl(glass, 0, y0 + k * FH + 0.1, pz, r, FH - 0.2, { seg, exact: true, open: true, lit: b.r() });
    if (b.d >= 1) b.cyl(band, 0, y0 + k * FH - 0.1, pz, r + 0.1, 0.2, { seg, exact: true, open: true });
  }
  const top = y0 + n * FH;
  b.cyl(band, 0, top - 0.1, pz, r + 0.15, 0.6, { seg, exact: true });
  // Krone: offener Ring mit Lichtband
  b.cyl('metal_light', 0, top + 0.5, pz, r + 0.15, 3.5, { seg, exact: true, open: true });
  if (b.d >= 1) b.cyl('emissive_cool', 0, top + 3.6, pz, r + 0.2, 0.3, { seg, exact: true, open: true });
  b.cyl('metal_panel_grey', 0, top + 0.5, pz, r * 0.6, 3.0, { seg: 10 });
  antenna(b, 0, top + 3.5, pz, 10, { r: 0.35 });
  b.take(0, pz, psx, psz, 0.3);
  const ff = b.faces(0, pz, psx, psz).front;
  b.fbox('metal_dark', ff, 0, 0, 4.2, 4.0, 0.3, -Math.min(psx, psz) * 0.06);
  b.sign(ff, 0, 4.4, 4.0, 0.7, { logo: b.pick(LOGO) });
  plaza(b, pz + psz / 2, {});
}

// Gedrehter Turm: jedes Geschoss ein Stück weitergedreht (weiße Deckenplatten, Glas)
function drehturm(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const glass = b.pick(GLASS), slab = b.pick(['metal_panel_white', 'concrete_panel', 'marble']);
  const psx = W - 1.2, psz = D - 2.6, pz = -Z + 0.6 + psz / 2;
  const s = Math.min(psx, psz) * 0.66, n = towerFloors(b, 30), tw = (b.rnd(0.6, 1.0) * HP) / n;
  lobby(b, 0, pz, psx, psz, 5.0, { glass, inset: 0.5, col: slab });
  b.box(slab, 0, 5.0, pz, psx, 0.6, psz);
  if (b.d >= 1) b.box('green_roof', 0, 5.6, pz, psx - 0.6, 0.1, psz - 0.6);
  const y0 = 5.6;
  b.cyl('concrete', 0, y0, pz, s * 0.3, n * FH + 3, { seg: 8 });
  for (let k = 0; k < n; k++) {
    const ry = k * tw;
    b.g(slab, new THREE.BoxGeometry(s + 0.5, 0.35, s + 0.5), 0, y0 + k * FH + 0.175, pz, { ry });
    b.g(glass, new THREE.BoxGeometry(s, FH - 0.35, s), 0, y0 + k * FH + 0.35 + (FH - 0.35) / 2, pz, { ry, lit: b.r() });
  }
  const top = y0 + n * FH;
  b.g(slab, new THREE.BoxGeometry(s + 0.6, 0.6, s + 0.6), 0, top + 0.3, pz, { ry: n * tw });
  if (b.d >= 1) b.g('emissive_cool', new THREE.BoxGeometry(s + 0.62, 0.15, s + 0.62), 0, top + 0.68, pz, { ry: n * tw });
  antenna(b, 0, top + 0.75, pz, 8);
  b.take(0, pz, psx, psz, 0.3);
  b.sign(b.faces(0, pz, psx, psz).front, -psx / 4, 3.9, 3.6, 0.6, { logo: b.pick(LOGO) });
  plaza(b, pz + psz / 2, {});
}

// Schrägturm: Glasschaft mit schräg abgeschnittener, leuchtend gesäumter Spitze
function schraegturm(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const glass = b.pick(GLASS), frame = b.pick(['metal_dark', 'metal_light', 'metal_panel_white']);
  const glow = b.pick(['emissive_cool', 'sign_white', 'emissive_warm']);
  const psx = W - 1.2, psz = D - 2.6, pz = -Z + 0.6 + psz / 2;
  lobby(b, 0, pz, psx, psz, 5.0, { glass, inset: 0.6, col: frame === 'metal_dark' ? 'concrete' : frame });
  b.box('metal_panel_white', 0, 5.0, pz, psx, 0.5, psz);
  const tsx = psx * 0.84, tsz = psz * 0.84, n = towerFloors(b, 26);
  const v = vol(0, pz, tsx, tsz, 5.5, n);
  facCurtain(b, v, { glass, frame, col: 1.3 });
  // schräge Spitze (fällt von hinten nach vorne ab)
  const hTop = Math.min(16, tsz * 1.1);
  b.prism(glass, [[-tsz / 2, 0], [tsz / 2, 0], [tsz / 2, hTop * 0.25], [-tsz / 2, hTop]], tsx, 0, v.top, pz, -HP);
  if (b.d >= 1) {
    const a0 = [0, v.top + hTop, pz - tsz / 2], a1 = [0, v.top + hTop * 0.25, pz + tsz / 2];
    for (const s of [-1, 1]) b.beam(glow, [s * (tsx / 2 + 0.05), a0[1], a0[2]], [s * (tsx / 2 + 0.05), a1[1], a1[2]], 0.3, 0.3);
    b.beam(frame, [0, a0[1] + 0.1, a0[2]], [0, a1[1] + 0.1, a1[2]], tsx + 0.3, 0.2);
  }
  b.light(0, v.top + hTop + 0.4, pz - tsz / 2 + 0.3, 0xff2a20, 0.3);
  b.take(0, pz, psx, psz, 0.3);
  b.sign(b.faces(0, pz, psx, psz).front, 0, 3.9, Math.min(6, psx * 0.5), 0.7, { logo: b.pick(LOGO) });
  plaza(b, pz + psz / 2, {});
}

// Bündelturm: mehrere Röhren unterschiedlicher Höhe aus dunklem Glas, Antennen
function buendelturm(b) {
  const { W, D, Z } = geom(b);
  b.lot('pavers', 0.1);
  const glass = b.pick(['glass_curtain_dark', 'glass_curtain_dark', 'glass_curtain_blue', 'glass_curtain_gold']);
  const psx = W - 1.2, psz = D - 2.6, pz = -Z + 0.6 + psz / 2;
  lobby(b, 0, pz, psx, psz, 5.0, { glass, inset: 0.5, col: 'metal_dark' });
  const gx = psx / 2 - 0.1, gz = psz / 2 - 0.1;
  const n0 = towerFloors(b, 30);
  const tubes = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const rot = (b.ctx.variant + b.fw + 2 * b.fd) % 4;
  const order = [0, 1, 2, 3].map((i) => (i + rot) % 4);
  let maxTop = 0, maxPos = [0, 0];
  order.forEach((ti, i) => {
    const [sx, sz] = tubes[ti];
    const n = Math.max(6, Math.round(n0 * [1.0, 0.82, 0.68, 0.52][i]));
    const tx = sx * (gx / 2 + 0.05), tz = pz + sz * (gz / 2 + 0.05);
    const v = vol(tx, tz, gx, gz, 5.0, n);
    facCurtain(b, v, { glass, frame: 'metal_dark', col: 1.5 });
    b.box('metal_dark', tx, v.top, tz, gx + 0.1, 1.4, gz + 0.1);
    if (v.top > maxTop) { maxTop = v.top; maxPos = [tx, tz]; }
  });
  b.light(maxPos[0], maxTop + 1.6, maxPos[1], 0xff2a20, 0.3);
  antenna(b, maxPos[0] - gx * 0.25, maxTop + 1.4, maxPos[1], 14, { r: 0.3 });
  antenna(b, maxPos[0] + gx * 0.25, maxTop + 1.4, maxPos[1], 11, { r: 0.3 });
  b.take(0, pz, psx, psz, 0.3);
  b.sign(b.faces(0, pz, psx, psz).front, 0, 3.9, Math.min(6, psx * 0.5), 0.7, { logo: b.pick(LOGO) });
  plaza(b, pz + psz / 2, { trees: true });
}

export const OFF = {
  1: [pavillon, holzbuero, kontorvilla, kubus, gewerbehof, loft],
  2: [bandhaus, glasbuero, kontorhaus, rasterbau, eckrund, lamellen],
  3: [glasriegel, bandblock, kontorhausGross, innenhof, staffelbau, eckturm],
  4: [staffelturm, scheibe, achteck, rasterturm, zwilling, konzern],
  5: [kronenturm, pyramidenturm, rundturm, drehturm, schraegturm, buendelturm],
};

export function buildOff(ctx) {
  const b = new B(ctx);
  const list = OFF[clamp(ctx.level, 1, 5)];
  list[ctx.variant % list.length](b);
  return b.finish();
}
void CAR;
