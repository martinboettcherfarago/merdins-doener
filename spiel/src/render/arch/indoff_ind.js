// Industrie (Zone 'ind', ohne Spezialisierung) – Archetypen je Stufe (Besitzer: G4).
// Stufe 1: Handwerk & Kleingewerbe · 2: Lager & Werkstätten · 3: Fabriken · 4: Schwerindustrie · 5: Hightech.
// Jede Stufe hat 6 Archetypen; die Variante wählt den Archetyp, der Zufall Farben und Details.
// Hauptbauten werden pro Grundfläche ausdrücklich gesetzt und im Belegungsplan (b.take) eingetragen,
// Nebenteile (Fahrzeuge, Container, Bäume …) suchen sich über den Plan einen freien Platz.
import * as THREE from 'three';
import { B, PI, HP, LOGO, CAR, clamp } from './indoff_parts.js';

const WALL_LIGHT = ['plaster_white', 'plaster_grey', 'plaster_cream', 'metal_panel_white', 'brick_yellow'];
const BRICK = ['brick_red', 'brick_brown', 'brick_red', 'brick_dark', 'brick_yellow'];
const geom = (b) => ({ W: b.W, D: b.D, X: b.W / 2, Z: b.D / 2, wide: b.W > 10, deep: b.D > 10 });

// ---------- Hilfen dieses Moduls
// Kleines Bürogebäude (Bürokopf) mit Bandfenstern, Eingang und Schild
export function officeHead(b, x, z, sx, sz, floors, o = {}) {
  const fh = 3.3, h = floors * fh + 0.3;
  const wall = o.wall || 'metal_panel_white';
  const H = b.hall({ x, z, sx, sz, h, wall, roof: 'flat', roofMat: 'roof_flat_gravel', ribs: false, plinthH: 0.3, parapet: 0.7, parMat: o.parMat || wall, coping: 'metal_light' });
  const glass = o.glass || 'glass_window';
  const ea = o.entryA ?? 0;
  for (const s of ['front', 'back', 'left', 'right']) {
    if ((o.skip || []).includes(s)) continue;
    const f = H.f[s];
    for (let k = 0; k < floors; k++) {
      if (k === 0 && s === 'front' && o.entry !== false) {
        b.band(f, -f.len / 2 + 0.6, ea - 1.6, 1.0, 1.5, { glass });
        b.band(f, ea + 1.6, f.len / 2 - 0.6, 1.0, 1.5, { glass });
      } else b.band(f, -f.len / 2 + 0.6, f.len / 2 - 0.6, k * fh + 1.0, 1.5, { glass });
    }
  }
  if (o.entry !== false) b.entrance(H.f.front, ea, 2.2, 2.5, { glass, canopy: o.canopy || 'metal_light', canopyD: o.canopyD ?? 1.2 });
  if (o.sign !== false) b.sign(H.f.front, o.signA ?? 0, h - 0.95, Math.min(sx - 1.2, 7), 0.8, { logo: o.logo });
  if (b.d >= 1) b.vents(x, h, z, sx * 0.6, sz * 0.5, o.vents ?? 1);
  return H;
}
// Reifenstapel
function tires(b, x, z, n = 3) {
  if (b.d < 2) return;
  for (let i = 0; i < n; i++) for (let k = 0; k < 1 + (i % 3); k++) b.cyl('rubber', x + i * 0.75, k * 0.28, z, 0.34, 0.26, { seg: 10 });
}
// Materialstapel (Bretter, Stahlprofile, Rohre): n Reihen nebeneinander (lokale x), Länge len (lokale z)
function stock(b, x, z, len, kind = 'planks', ry = 0, n = 3) {
  const s = Math.sin(ry), c = Math.cos(ry);
  if (b.d < 1) { b.box(kind === 'planks' ? 'wood_planks' : 'rust', x, 0, z, n * 1.5 - 0.3, 0.8, len, ry); return; }
  for (let k = 0; k < n; k++) {
    const a = (k - (n - 1) / 2) * 1.5;
    const px = x + c * a, pz = z - s * a;
    if (kind === 'pipes') {
      for (let j = 0; j < 3; j++) for (let t = 0; t < 2 - (j % 2); t++) b.g('pipe_metal', new THREE.CylinderGeometry(0.2, 0.2, len, 7).rotateX(HP), px + c * (j - 1) * 0.42, 0.22 + t * 0.4 + (j % 2) * 0.2, pz - s * (j - 1) * 0.42, { ry });
      continue;
    }
    const mat = kind === 'steel' ? (k % 2 ? 'rust' : 'metal_dark') : k % 2 ? 'wood_planks' : 'log_wood';
    const hh = 0.45 + ((k * 7) % 3) * 0.3;
    b.box('wood_dark', px, 0, pz, 1.2, 0.12, len * 0.9, ry);
    b.box(mat, px, 0.12, pz, 1.1, hh, len, ry);
    if (b.d >= 2 && kind === 'planks') b.box('wood_dark', px, 0.12 + hh * 0.5, pz, 1.14, 0.06, len + 0.04, ry);
  }
}
// Werks-Wasserturm (Intze-Bauart): Kopf-Radius 4 m
function waterTower(b, x, z, h, o = {}) {
  const shaft = o.shaft || 'brick_red', head = o.head || 'brick_red';
  b.cyl(shaft, x, 0, z, 1.8, h, { seg: 12, rTop: 1.6 });
  b.cyl(head, x, h, z, 3.6, 3.6, { seg: 14, rTop: 3.8 });
  b.cyl(o.roofMat || 'roof_slate', x, h + 3.6, z, 4.0, 0.3, { seg: 14 });
  b.cone(o.roofMat || 'roof_slate', x, h + 3.9, z, 4.0, 2.4, { seg: 14 });
  if (b.d >= 1) b.cyl('trim_stone', x, h - 0.4, z, 2.0, 0.4, { seg: 12, rTop: 3.6 });
  if (b.d >= 2) {
    b.cone('metal_dark', x, h + 6.2, z, 0.5, 0.9, { seg: 6 });
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * PI * 2 + 0.4;
      b.plane('glass_window', x + Math.cos(a) * 1.72, h * 0.35 + (k % 2) * h * 0.3, z + Math.sin(a) * 1.72, 0.5, 1.2, PI / 2 - a);
      b.plane('glass_window', x + Math.cos(a) * 3.72, h + 1.8, z + Math.sin(a) * 3.72, 0.7, 1.0, PI / 2 - a);
    }
  }
}
// Prozesskolonne mit Bühnen (Platzbedarf r + 0.9)
function column(b, x, z, r, h, o = {}) {
  const mat = o.mat || 'metal_light';
  b.cyl(mat, x, 0, z, r, h, { seg: 12 });
  b.dome(mat, x, h, z, r, 0.5, { seg: 12 });
  const n = Math.max(1, Math.floor(h / 7));
  if (b.d >= 1) {
    b.cyl('concrete', x, 0, z, r + 0.5, 1.0, { seg: 12 });
    for (let k = 1; k <= n; k++) b.cyl('metal_dark', x, (h * k) / (n + 0.4), z, r + 0.9, 0.18, { seg: 12 });
    if (o.band) b.cyl(o.band, x, h * 0.86, z, r + 0.03, 1.2, { seg: 12, open: true });
  }
  if (b.d >= 2) {
    for (let k = 1; k <= n; k++) b.cyl('metal_dark', x, (h * k) / (n + 0.4) + 1.0, z, r + 0.88, 0.06, { seg: 12, open: true });
    b.box('metal_dark', x + r + 0.2, 1, z, 0.12, h - 1, 0.5);
    b.pipe('pipe_metal', [x - r - 0.25, 1.5, z], [x - r - 0.25, h + 0.4, z], 0.18);
    b.pipe('pipe_metal', [x - r - 0.25, h + 0.4, z], [x, h + r * 0.5, z], 0.18);
  }
}
// Fahrmischer
function mixerTruck(b, x, z, ry) {
  b.truck(x, z, ry, { type: 'rigid', load: 'flat', cargo: false, cab: b.pick(['paint_white', 'paint_orange', 'paint_yellow']) });
  if (b.d < 1 || !b.fits(x, z, ry, 8.5, 2.6)) return;
  const s = Math.sin(ry), c = Math.cos(ry);
  const geo = new THREE.CylinderGeometry(0.75, 1.15, 4.6, b.seg(10)).rotateX(-HP - 0.22);
  b.g(b.d >= 2 ? 'paint_orange' : 'metal_light', geo, x - s * 1.3, 2.75, z - c * 1.3, { ry });
}
// Autotransporter
function carCarrier(b, x, z, ry) {
  if (!b.fits(x, z, ry, 16.5, 2.6)) return false;
  b.truck(x, z, ry, { type: 'semi', load: 'flat', cargo: false, cab: b.pick(['paint_white', 'paint_blue', 'metal_dark']) });
  if (b.d < 1) return true;
  const s = Math.sin(ry), c = Math.cos(ry);
  for (const [f, y] of [[-4.5, 1.35], [0, 1.35], [4.5, 1.35], [-3, 3.0], [2, 3.0]]) {
    const px = x + s * (f - 1.4), pz = z + c * (f - 1.4);
    b.box(b.d >= 2 ? b.pick(CAR) : 'metal_light', px, y, pz, 1.7, 1.05, 3.9, ry);
  }
  if (b.d >= 2) b.box('metal_dark', x - s * 1.4, 2.8, z - c * 1.4, 2.5, 0.12, 12.5, ry);
  return true;
}
// Lkw rückwärts an Rampen einer Fassade (Fahrerhaus zeigt nach außen)
function dockTrucks(b, f, list, o = {}) {
  for (const a of list) {
    if (b.r() > (o.p ?? 0.75)) continue;
    let len = o.type === 'semi' ? 16.5 : 8.5;
    let [x, z] = f.at(a, 0.8 + len / 2);
    let tp = o.type;
    if (!b.fits(x, z, f.ry, len, 2.6, 0)) { len = 8.5; tp = 'rigid'; [x, z] = f.at(a, 0.8 + len / 2); }
    const along = Math.abs(Math.sin(f.ry)) > 0.5;
    const sx = along ? len : 2.6, sz = along ? 2.6 : len;
    if (!b.fits(x, z, f.ry, len, 2.6, 0) || !b.plan.free(x, z, sx, sz)) continue;
    b.truck(x, z, f.ry, { ...o, type: tp });
    b.take(x, z, sx, sz, 0.2);
  }
}
// Bürocontainer (6 × 2,5 m) mit Fenstern und Tür; Längsseite zeigt nach ry
function officeContainer(b, x, z, ry, mat, stacked = false) {
  const along = Math.abs(Math.sin(ry)) > 0.5;
  const sx = along ? 2.5 : 6.0, sz = along ? 6.0 : 2.5;
  const side = along ? (Math.sin(ry) > 0 ? 'right' : 'left') : Math.cos(ry) > 0 ? 'front' : 'back';
  const lv = stacked ? 2 : 1;
  for (let k = 0; k < lv; k++) {
    b.box(mat, x, 0.2 + k * 2.65, z, sx, 2.6, sz);
    const f = b.face(x, z, sx, sz, side);
    b.winRow(f, -2.4, 1.2, 1.25 + k * 2.65, 1.0, 1.0, { spacing: 1.8 });
    if (k === 0) b.door(f, 2.2, { w: 0.9, canopy: false });
    else if (b.d >= 2) b.fbox('metal_dark', f, 0, 2.85, 6.4, 0.12, 1.0, 0);
  }
  if (stacked && b.d >= 2) {
    const f = b.face(x, z, sx, sz, side);
    const p0 = f.at(-2.6, 0.5), p1 = f.at(0.6, 0.5);
    b.beam('metal_dark', [p0[0], 0.2, p0[1]], [p1[0], 2.85, p1[1]], 0.8, 0.12);
  }
}
// Getränkekisten / Kisten-Stapel
function crates(b, x, z, n = 3, mats = ['paint_red', 'paint_green', 'paint_yellow']) {
  if (b.d < 2) return;
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) b.box(b.pick(mats), x + i * 0.6, k * 0.34, z, 0.5, 0.32, 0.36);
}
// Parkplatz an freier Stelle
function putParking(b, sx, sz, f = {}) {
  const p = b.plan.find(sx, sz, { pad: 0.1, ...f });
  if (p) b.parking(p[0], p[1], sx, sz, { fill: f.fill ?? 0.7, front: f.front });
  return p;
}

// =====================================================================================
// Stufe 1 – Handwerk & Kleingewerbe
// =====================================================================================

// Kfz-Werkstatt: Halle mit Rolltoren, Büroecke, Autos auf dem Hof
function werkstatt(b) {
  const { X, Z, wide, deep } = geom(b);
  b.lot('asphalt_dark');
  const wall = b.pick(WALL_LIGHT), roofMat = b.pick(['roof_metal_grey', 'roof_tiles_anthracite', 'roof_flat_membrane']);
  const flat = roofMat === 'roof_flat_membrane';
  const sx = wide ? 12.4 : 8.6, sz = deep ? 9.5 : 5.8;
  const x = wide ? -X + 0.6 + sx / 2 : 0, z = -Z + 0.6 + sz / 2, zf = z + sz / 2;
  const H = b.hall({ x, z, sx, sz, h: 4.6, wall, roof: flat ? 'flat' : 'gable', roofMat, pitch: 15, ridge: 'x', ribs: false, plinth: 'concrete_dark', plinthH: 0.5, parapet: 0.6 });
  b.take(x, z, sx, sz, 0.3);
  const f = H.f.front, n = wide ? 3 : 2, dw = 2.8, gap = 0.6;
  const logo = b.pick(LOGO);
  const doorMat = b.pick(['metal_panel_grey', 'metal_panel_white', 'metal_panel_blue']);
  for (let i = 0; i < n; i++) b.rollerDoor(f, -sx / 2 + 0.5 + dw / 2 + i * (dw + gap), dw, 3.3, { mat: doorMat });
  const aEnd = -sx / 2 + 0.5 + n * (dw + gap) - gap;
  if (sx / 2 - aEnd > 3) b.winRow(f, aEnd + 0.4, sx / 2 - 1.8, 1.0, 1.2, 1.4, { spacing: 1.6 });
  b.door(f, sx / 2 - 0.9, {});
  b.sign(f, (-sx / 2 + aEnd) / 2 + 0.25, 3.65, aEnd + sx / 2 - 0.9, 0.75, { logo });
  for (const s of ['left', 'right']) b.winRow(H.f[s], -sz / 2 + 1, sz / 2 - 1, 1.6, 1.0, 1.0, { spacing: 2.6 });
  b.winRow(H.f.back, -sx / 2 + 1, sx / 2 - 1, 1.6, 1.0, 1.0, { spacing: 3.0 });
  b.pylon(X - 0.9, Z - 0.8, 4.5, logo); b.take(X - 0.9, Z - 0.8, 1.6, 0.6);
  b.lamp(-X + 0.5, Z - 0.6, 6); b.take(-X + 0.5, Z - 0.6, 0.5, 0.5);
  tires(b, x + sx / 2 - 2.6, zf + 0.75, 3); b.take(x + sx / 2 - 1.85, zf + 0.75, 2.4, 0.9, 0.1);
  if (wide) { b.parking(X - 3.4, z, 6.0, sz, { fill: 0.8 }); b.take(X - 3.4, z, 6.0, sz, 0); }
  b.putCar({ prefer: 'front' });
  b.putCar({ prefer: 'front' });
  if (deep) { b.putVan({ prefer: 'front' }); b.putCar({ prefer: 'center' }); }
}

// Handwerkerhof: offener Unterstand, Bürocontainer, Lagerplatz, Zaun
function schuppenhof(b) {
  const { W, X, Z, wide, deep } = geom(b);
  b.lot('gravel');
  const roofMat = b.pick(['metal_corrugated', 'metal_corrugated_green', 'metal_corrugated_red', 'roof_metal_grey']);
  const sx = W - 1.4, sz = deep ? 6 : 3.8, zc = -Z + 0.6 + sz / 2, h = 3.4;
  if (b.d >= 1) {
    const n = Math.max(2, Math.round(sx / 4));
    for (let i = 0; i <= n; i++) {
      const px = -sx / 2 + 0.15 + (i * (sx - 0.3)) / n;
      b.box('wood_dark', px, 0, zc + sz / 2 - 0.2, 0.25, h, 0.25);
      b.box('wood_dark', px, 0, zc - sz / 2 + 0.2, 0.25, h + 0.8, 0.25);
    }
    b.box('wood_dark', 0, h - 0.3, zc + sz / 2 - 0.2, sx, 0.3, 0.25);
  }
  b.box('wood_planks', 0, 0, zc - sz / 2 + 0.1, sx, h + 0.8, 0.12);
  b.beam(roofMat, [0, h + 1.05, zc - sz / 2 - 0.2], [0, h + 0.05, zc + sz / 2 + 0.5], sx + 0.6, 0.15);
  b.take(0, zc, sx, sz, 0.2);
  if (deep) { stock(b, -sx / 4, zc, sz - 1.4, 'planks', HP, 3); stock(b, sx / 4, zc, sz - 1.4, b.chance(0.5) ? 'steel' : 'pipes', HP, 3); }
  else { stock(b, -sx / 4, zc, sz - 1.0, 'planks', 0, 2); stock(b, sx / 4, zc, sz - 1.0, b.chance(0.5) ? 'steel' : 'pipes', 0, 2); }
  // Bürocontainer vorne rechts
  const cm = b.pick(['metal_panel_white', 'metal_panel_blue', 'paint_white']);
  const stacked = wide || deep;
  const cx = X - 3.4, cz = stacked ? Z - 2.7 : Z - 1.85;
  officeContainer(b, cx, cz, 0, cm, stacked);
  b.take(cx, cz, 6.0, 2.5, 0.3);
  if (stacked) b.take(cx - 1.0, cz + 1.75, 3.4, 1.0, 0);
  if (wide) b.putContainer(false, { prefer: 'left' }, 2);
  if (deep) b.putTruck({ type: 'rigid', load: 'flat', cargoMat: 'wood_planks' }, { prefer: 'center' });
  b.putVan({ prefer: 'front' });
  b.putPallets(3, { prefer: 'center' });
  if (wide && deep) b.putContainer(true, { prefer: 'left' });
  b.fenceLot(0, 0, W - 0.4, b.D - 0.4, { gate: 4.5, ga: -0.5 });
  b.lamp(X - 0.5, -Z + 0.5, 6);
}

// Tischlerei: holzverkleidete Halle mit Pultdach, Späneabsaugung (Silo mit Zyklon), Holzlager
function tischlerei(b) {
  const { X, Z, wide, deep } = geom(b);
  b.lot(b.chance(0.5) ? 'asphalt' : 'pavers');
  const wall = b.pick(['wood_planks', 'wood_planks', 'siding_red', 'wood_dark']);
  const sx = wide ? 10.5 : 6.6, sz = deep ? 11 : 6.2;
  const x = -X + 0.6 + sx / 2, z = -Z + 0.6 + sz / 2;
  const H = b.hall({ x, z, sx, sz, h: 4.2, wall, roof: 'shed', roofMat: b.pick(['roof_metal_grey', 'metal_corrugated', 'green_roof']), pitch: 9, high: 'front', ribs: false, plinth: 'concrete', plinthH: 0.4 });
  b.take(x, z, sx, sz, 0.3);
  const f = H.f.front;
  b.band(f, -sx / 2 + 0.4, sx / 2 - 0.4, 3.75, 0.8, { glass: 'glass_window', mull: 1.2 });
  b.fbox('wood_dark', f, -sx / 2 + 2.1, 0, 3.2, 3.3, 0.12, 0.02);
  if (b.d >= 1) { b.fbox('metal_dark', f, -sx / 2 + 2.1, 3.3, 4.0, 0.18, 0.2, 0.02); b.fbox('metal_dark', f, -sx / 2 + 2.1, 0, 0.1, 3.3, 0.05, 0.14); }
  b.winRow(f, -sx / 2 + 4.2, sx / 2 - 1.8, 0.9, 1.5, 1.8, { spacing: 2.1, frame: 'window_frame_wood' });
  b.door(f, sx / 2 - 1.0, { mat: 'door_wood' });
  b.sign(f, 0.7, 2.9, Math.min(sx - 3.2, 4.2), 0.6, { bg: 'wood_dark', logo: b.pick(['paint_white', 'paint_yellow', 'leaves_light']), text: 'paint_white' });
  for (const s of ['left', 'back']) b.winRow(H.f[s], -H.f[s].len / 2 + 1, H.f[s].len / 2 - 1, 1.2, 1.4, 1.3, { spacing: 2.6, frame: 'window_frame_wood' });
  // Späneabsaugung: Silo auf Stützen mit Zyklon und Rohr zur Halle
  const r = 1.05, sxp = x + sx / 2 + 0.3 + r, szp = z - sz / 2 + 1.6;
  b.silo(sxp, szp, r, 4.0, { mat: 'metal_light', legs: 2.4, top: 'cone' });
  b.takeC(sxp, szp, r, 0.2);
  if (b.d >= 1) {
    b.cyl('metal_light', sxp, 8.7, szp, 0.5, 1.3, { seg: 10 });
    b.cone('metal_light', sxp, 7.3, szp, 0.5, 1.4, { seg: 10 });
    b.pipe('metal_light', [sxp - 0.3, 9.6, szp], [x + sx / 2 - 0.4, 5.0, szp], 0.26);
  }
  if (wide) { b.parking(X - 3.0, z, 5.4, sz, { fill: 0.6 }); b.take(X - 3.0, z, 5.4, sz, 0); }
  b.put(3.0, 2.8, { prefer: 'front' }, (px, pz, ry) => stock(b, px, pz, 3.0, 'planks', ry, 2));
  b.hedge(-X + 2.0, Z - 0.5, 3.0, 0.7); b.take(-X + 2.0, Z - 0.5, 3.0, 0.7, 0);
  if (deep) { b.putVan({ prefer: 'front' }); b.putTree(0.8, 'laub', { prefer: 'front' }); }
  else b.putCar({ prefer: 'front' });
  b.lamp(X - 0.5, Z - 0.5, 5);
}

// Mietlager / Self-Storage: Stahlhalle(n) mit vielen farbigen Rolltoren
function mietlager(b) {
  const { W, X, Z, deep, wide } = geom(b);
  b.lot('asphalt');
  const wall = b.pick(['metal_panel_white', 'metal_panel_grey', 'metal_corrugated']);
  const doorMat = b.pick(['paint_orange', 'paint_blue', 'paint_yellow', 'paint_red', 'paint_green']);
  const sx = W - 1.2, sz = deep ? 4.8 : 5.0;
  const zs = deep ? [-Z + 0.6 + sz / 2, -Z + 0.6 + sz * 1.5 + 6.0] : [-Z + 0.6 + sz / 2];
  const barrel = b.chance(0.5);
  for (const zc of zs) {
    const H = b.hall({ x: 0, z: zc, sx, sz, h: 3.4, wall, roof: barrel ? 'barrel' : 'flat', roofMat: 'roof_metal_grey', rise: 0.9, ribs: false, plinthH: 0.3, parapet: 0.5 });
    const n = Math.max(2, Math.floor((sx - 1) / 2.4));
    for (let i = 0; i < n; i++) b.rollerDoor(H.f.front, -sx / 2 + 0.5 + (i + 0.5) * ((sx - 1) / n), 1.8, 2.3, { mat: doorMat, window: false, bollards: false });
    b.fbox(doorMat, H.f.front, 0, 3.0, sx, 0.25, 0.05, 0.03);
    if (b.d >= 2) for (let i = 0; i <= n; i++) b.fbox('metal_dark', H.f.front, -sx / 2 + 0.5 + (i * (sx - 1)) / n, 0, 0.12, 3.0, 0.08, 0.02);
    b.take(0, zc, sx, sz, 0.3);
  }
  // Empfang
  const ex = X - 2.0, ez = Z - 1.9;
  b.box(wall, ex, 0, ez, 3.0, 3.0, 2.6);
  b.box(doorMat, ex, 3.0, ez, 3.2, 0.5, 2.8);
  b.fplane('glass_window', b.face(ex, ez, 3.0, 2.6, 'front'), 0, 0.1, 2.2, 2.2, 0.03);
  b.take(ex, ez, 3.0, 2.6, 0.3);
  b.pylon(-X + 0.9, Z - 0.8, 5.5, doorMat); b.take(-X + 0.9, Z - 0.8, 1.6, 0.6);
  b.putVan({ prefer: 'front' });
  if (wide || deep) b.putCar({ prefer: 'front' });
  if (deep) b.putVan({ prefer: 'center' });
  b.fenceLot(0, 0, W - 0.4, b.D - 0.4, { gate: 5, ga: -1.0 });
  b.lamp(X - 0.5, 0, 6);
}

// Alte Backstein-Werkstatt mit Satteldach, Segmentbogenfenstern und kleinem Schornstein
function ziegelwerkstatt(b) {
  const { W, X, Z, wide, deep } = geom(b);
  b.lot('pavers');
  const wall = b.pick(BRICK);
  const roofMat = b.pick(['roof_tiles_red', 'roof_tiles_anthracite', 'roof_tiles_brown', 'roof_slate']);
  const sx = wide ? 15 : 8, sz = deep ? 9 : 6.0;
  const z = -Z + 0.6 + sz / 2, zf = z + sz / 2;
  const rib = wall === 'brick_dark' ? 'brick_brown' : 'brick_dark';
  const H = b.hall({ x: 0, z, sx, sz, h: 4.4, wall, roof: 'gable', roofMat, pitch: 32, ridge: 'x', ribs: true, bay: 3.2, ribMat: rib, ribDepth: 0.12, plinth: 'stone_grey', plinthH: 0.6, over: 0.4 });
  b.take(0, z, sx, sz, 0.5);
  const f = H.f.front, nb = H.bays.front.length;
  H.bays.front.forEach((a, i) => {
    if (i === Math.floor(nb / 2)) {
      b.fbox('door_wood', f, a, 0, 2.4, 3.0, 0.1, 0.02);
      if (b.d >= 1) b.winRow(f, a - 0.1, a + 0.1, 3.05, 1.9, 0.01, { arch: 'trim_stone', lod: false });
    } else b.winRow(f, a - 0.5, a + 0.5, 1.2, 1.4, 1.9, { arch: rib, frame: 'window_frame_white', sill: true });
  });
  for (const s of ['left', 'right']) b.winRow(H.f[s], -sz / 2 + 1.2, sz / 2 - 1.2, 1.2, 1.2, 1.7, { arch: rib, frame: 'window_frame_white', spacing: 2.6 });
  b.winRow(H.f.back, -sx / 2 + 1, sx / 2 - 1, 1.2, 1.2, 1.7, { arch: rib, spacing: 3.2 });
  if (b.d >= 1) for (let i = 0; i < Math.max(1, Math.floor(sx / 5)); i++) b.boxc('glass_skylight', -sx / 2 + 2.2 + i * 4.6, 4.4 + 1.55, z + sz / 4 + 0.1, 1.2, 0.08, 1.6, { rx: 0.56 });
  b.chimney(sx / 2 - 1.2, z - sz / 4, { type: 'square', h: 10, r: 0.55, mat: wall, smoke: 0.6, base: 0 });
  b.sign(f, 0, 3.55, 3.6, 0.55, { bg: 'paint_white', logo: b.pick(LOGO) });
  b.fence(-X + 0.2, Z - 0.2, -1.6, Z - 0.2, 1.4, 'metal_dark');
  b.fence(1.6, Z - 0.2, X - 0.2, Z - 0.2, 1.4, 'metal_dark');
  b.lamp(X - 0.5, Z - 0.5, 4.5); b.take(X - 0.5, Z - 0.5, 0.5, 0.5);
  const bp = b.plan.find(2.0, 1.4, { prefer: 'right', zMin: zf });
  if (bp) b.barrels(bp[0] - 0.65, bp[1] - 0.33, 4, b.pick(['paint_blue', 'rust', 'paint_green']));
  b.putVan({ prefer: 'front' }, b.pick(['paint_white', 'paint_blue', 'paint_red']));
  if (deep) { b.ground('grass', 0, Z - 1.4, W - 0.6, 2.2, 0.12); b.take(0, Z - 1.4, W - 0.6, 2.2, 0); b.tree(-X + 2.2, Z - 1.4, 0.9); b.tree(X - 2.2, Z - 1.4, 1.0); }
  if (wide) b.putTree(0.9, 'laub', { prefer: 'right' });
}

// Baustoffhandel: Hof mit Schüttgutboxen, Paletten, Regaldach und Verkaufsbau
function baustoffhandel(b) {
  const { W, D, X, Z, wide, deep } = geom(b);
  b.lot('asphalt');
  const logo = b.pick(['paint_red', 'paint_orange', 'paint_green', 'paint_blue', 'paint_yellow']);
  const nbx = wide ? 4 : 2, bw = (W - 1.6) / nbx;
  for (let i = 0; i <= nbx; i++) b.box('concrete', -X + 0.8 + i * bw, 0, -Z + 2.2, 0.35, 1.8, 3.6);
  b.box('concrete', 0, 0, -Z + 0.55, W - 1.4, 1.8, 0.35);
  const fills = ['sand', 'gravel', 'rock', 'dirt', 'sand', 'gravel'];
  const f0 = b.int(0, 3);
  for (let i = 0; i < nbx; i++) b.cone(fills[(i + f0) % fills.length], -X + 0.8 + (i + 0.5) * bw, 0, -Z + 2.3, bw * 0.42, 1.9, { seg: 8 });
  b.take(0, -Z + 2.2, W - 1.2, 3.8, 0.2);
  // Verkaufsbau vorne links
  const vsx = wide ? 6.4 : 4.0, vsz = 3.0, vx = -X + 0.6 + vsx / 2, vz = Z - 1.5 - vsz / 2;
  const H = b.hall({ x: vx, z: vz, sx: vsx, sz: vsz, h: 3.6, wall: 'metal_panel_white', roof: 'flat', ribs: false, plinthH: 0.3, parapet: 0.9, parMat: logo });
  b.entrance(H.f.front, -vsx / 2 + 1.4, 1.6, 2.4, { canopy: logo, canopyD: 1.1 });
  b.band(H.f.front, -vsx / 2 + 2.6, vsx / 2 - 0.4, 0.9, 1.7, {});
  b.sign(H.f.front, 0.3, 3.75, Math.min(vsx - 1.0, 5), 0.65, { logo });
  b.take(vx, vz + 0.5, vsx, vsz + 1.0, 0.3);
  // Regaldach rechts
  const rsx = wide ? 5.6 : 3.4, rx = X - 0.6 - rsx / 2, rz0 = -Z + 4.5, rsz = deep ? 9 : D - 4.5 - 1.4, rz = rz0 + rsz / 2;
  const nrp = Math.max(1, Math.round(rsz / 4));
  if (b.d >= 1) for (const s of [-1, 1]) for (let k = 0; k <= nrp; k++) b.box('metal_dark', rx + s * (rsx / 2 - 0.2), 0, rz0 + 0.2 + (k * (rsz - 0.4)) / nrp, 0.2, 4.2, 0.2);
  b.box('metal_corrugated', rx, 4.2, rz, rsx + 0.5, 0.15, rsz + 0.5);
  b.pallets(rx, rz, Math.max(2, Math.floor(rsz / 1.5)), HP);
  b.take(rx, rz, rsx, rsz, 0.3);
  b.pylon(X - 0.8, Z - 0.5, 5, logo); b.take(X - 0.8, Z - 0.5, 1.6, 0.6);
  const np = wide ? 5 : 3;
  b.put(np * 1.5, 1.4, { prefer: 'center' }, (px, pz, ry) => {
    const s = Math.sin(ry), c = Math.cos(ry);
    if (b.d < 1) { b.box('brick_red', px, 0, pz, 1.2, 1.0, np * 1.5 - 0.3, ry); return; }
    for (let i = 0; i < np; i++) {
      const a = (i - (np - 1) / 2) * 1.5;
      b.box('wood_planks', px + s * a, 0, pz + c * a, 1.0, 0.15, 1.2, ry);
      b.box(b.pick(['brick_red', 'brick_yellow', 'concrete', 'stone_grey', 'brick_red']), px + s * a, 0.15, pz + c * a, 0.95, 0.9 + (i % 2) * 0.3, 1.1, ry);
    }
  });
  b.put(2.2, 1.2, { prefer: 'center' }, (px, pz, ry) => b.forklift(px, pz, ry, 'paint_yellow'));
  if (wide || deep) b.putTruck({ type: 'rigid', load: 'flat', cargoMat: 'brick_red', cab: logo }, { prefer: 'center' });
  b.lamp(-X + 0.5, -Z + 4.8, 6);
}

// =====================================================================================
// Stufe 2 – Lager, Werkstätten, kleine Fabriken
// =====================================================================================

// Lagerhalle mit Laderampen, Rolltoren und Bürokopf
function lagerhalle(b) {
  const { W, X, Z, wide, deep } = geom(b);
  b.lot('asphalt');
  const wall = b.pick(['metal_panel_grey', 'metal_panel_blue', 'metal_corrugated', 'metal_panel_white', 'metal_corrugated_green']);
  const logo = b.pick(LOGO);
  const offW = wide ? 5.0 : 0;
  const hsx = W - 1.2 - offW, sz = deep ? 9 : 5.0;
  const hx = -X + 0.6 + hsx / 2, z = -Z + 0.6 + sz / 2, zf = z + sz / 2;
  const roofFlat = b.chance(0.6);
  const H = b.hall({ x: hx, z, sx: hsx, sz, h: deep ? 7.5 : 6, wall, roof: roofFlat ? 'flat' : 'gable', roofMat: roofFlat ? 'roof_flat_membrane' : 'roof_metal_grey', pitch: 6, ridge: 'z', bay: 5, ribMat: 'metal_dark', plinthH: 0.9 });
  b.take(hx, z, hsx, sz, 0.3);
  const f = H.f.front;
  if (deep) {
    const n = Math.max(2, Math.floor(hsx / 4)), docks = [];
    for (let i = 0; i < n; i++) { const a = -hsx / 2 + (i + 0.5) * (hsx / n); docks.push(a); b.dockDoor(f, a, { w: 2.8, h: 3.0 }); }
    dockTrucks(b, f, docks, { type: 'rigid', load: 'box', logo });
  } else {
    b.dockPlatform(f, -hsx / 2 + 0.4, hsx / 2 - 2.6, { depth: 1.8, canopyY: 4.6 });
    const n = Math.max(1, Math.floor((hsx - 3.0) / 3.6));
    for (let i = 0; i < n; i++) b.rollerDoor(f, -hsx / 2 + 0.4 + (i + 0.5) * ((hsx - 3.0) / n), 2.6, 3.0, { y0: 1.2, bollards: false, window: false });
    b.rollerDoor(f, hsx / 2 - 1.4, 2.2, 3.4, { mat: 'metal_panel_white' });
    const [px, pz] = f.at(-hsx / 2 + 1.6, 0.9);
    b.pallets(px, pz, 2, 0, 1.2);
    b.take(hx - 1.1, zf + 0.9, hsx - 2.2, 1.8, 0.1);
  }
  b.band(H.f.left, -sz / 2 + 0.6, sz / 2 - 0.6, H.top - 1.6, 0.9, {});
  b.band(H.f.right, -sz / 2 + 0.6, sz / 2 - 0.6, H.top - 1.6, 0.9, {});
  b.sign(f, -hsx / 2 + 3.2, H.top - 1.2, 5, 0.9, { logo });
  if (roofFlat) b.domelights(hx, H.top + 0.1, z, hsx * 0.7, sz * 0.6, Math.max(1, Math.round(hsx / 6)), Math.max(1, Math.round(sz / 6)));
  if (offW) {
    const osz = deep ? 6 : sz, oz = deep ? zf + 1 - osz / 2 : z;
    officeHead(b, X - 0.6 - offW / 2, oz, offW, osz, 2, { skip: ['left'], logo, wall: b.pick(['metal_panel_white', 'plaster_white', 'concrete_panel']) });
    b.take(X - 0.6 - offW / 2, oz + 0.6, offW, osz + 1.2, 0.3);
  }
  if (!deep) b.putVan({ prefer: 'front' });
  b.fenceLot(0, 0, W - 0.3, b.D - 0.3, { gate: wide ? 9 : 5, ga: 0 });
  b.lamp(-X + 0.5, Z - 0.6, 8);
  if (wide) b.lamp(X - 0.5, Z - 0.6, 8);
}

// Stahlbau mit Kranbahn im Freilager
function metallbau(b) {
  const { W, D, X, Z, wide, deep } = geom(b);
  b.lot('asphalt_dark');
  const wall = b.pick(['metal_panel_blue', 'metal_panel_grey', 'metal_corrugated', 'metal_corrugated_red']);
  const craneMat = b.pick(['paint_yellow', 'paint_orange', 'paint_blue']);
  const sx = wide ? 10.5 : W - 1.2, sz = wide ? (deep ? 13 : 7.0) : deep ? 11 : 5.4;
  const x = wide ? -X + 0.6 + sx / 2 : 0, z = -Z + 0.6 + sz / 2, zf = z + sz / 2;
  const H = b.hall({ x, z, sx, sz, h: 7.0, wall, roof: 'gable', roofMat: 'roof_metal_grey', pitch: 10, ridge: 'z', bay: 5, plinthH: 1.0 });
  b.take(x, z, sx, sz, 0.3);
  b.rollerDoor(H.f.front, 0, Math.min(sx - 2.5, 5), 5.2, { mat: b.pick(['metal_panel_white', 'metal_panel_grey']) });
  b.band(H.f.left, -sz / 2 + 0.6, sz / 2 - 0.6, 5.0, 1.1, {});
  b.band(H.f.right, -sz / 2 + 0.6, sz / 2 - 0.6, 5.0, 1.1, {});
  b.sign(H.f.front, 0, 6.0, Math.min(sx - 1.5, 6), 0.8, {});
  if (wide) {
    const gx = X - 4.4, glen = D - 1.4;
    b.gantry(gx, 0, 6.0, glen, 6.5, { mat: craneMat, pos: 0.1 });
    b.take(gx, 0, 7.8, glen, 0);
    stock(b, gx - 1.6, -D / 4, Math.min(7, D / 2 - 1.2), 'steel', 0, 2);
    stock(b, gx + 1.8, D / 4 - 0.4, Math.min(6, D / 2 - 1.4), 'pipes', 0, 2);
    if (b.d >= 1) b.box('rust', gx, 0, deep ? D / 4 : 0.5, 2.6, 1.0, 1.2);
  } else {
    const glen = Z - zf - 0.5;
    if (glen > 2.6) {
      const gz = zf + 0.1 + glen / 2;
      b.gantry(0, gz, Math.min(W - 2.4, 7), glen, 5.8, { mat: craneMat, pos: 0 });
      b.take(0, gz, W - 1, glen, 0);
      stock(b, 0, gz, Math.max(1.5, glen - 1.6), 'steel', HP, 2);
    }
  }
  b.put(6.0, 2.5, { prefer: 'front' }, (px, pz, ry) => officeContainer(b, px, pz, ry + HP, 'metal_panel_white'));
  b.fenceLot(0, 0, W - 0.3, D - 0.3, { gate: 5, ga: x });
  b.lamp(-X + 0.5, Z - 0.6, 8);
}

// Spedition: lange Umschlaghalle mit vielen Toren unter durchgehendem Vordach
function spedition(b) {
  const { W, X, Z, deep } = geom(b);
  b.lot('asphalt');
  const wall = b.pick(['metal_panel_white', 'metal_panel_grey', 'metal_panel_blue']);
  const logo = b.pick(LOGO);
  const sx = W - 1.2, sz = deep ? 8.0 : 4.8;
  const z = -Z + 0.6 + sz / 2;
  const H = b.hall({ x: 0, z, sx, sz, h: 6.0, wall, roof: 'flat', roofMat: 'roof_flat_membrane', bay: 4, ribMat: logo === 'paint_yellow' ? 'metal_dark' : logo, plinthH: 1.2, plinth: 'concrete_dark' });
  b.take(0, z, sx, sz, 0.3);
  const f = H.f.front;
  const n = Math.max(2, Math.floor(sx / 3.6)), docks = [];
  b.fbox('metal_panel_grey', f, 0, 4.9, sx + 0.4, 0.3, 3.0, 0);
  if (b.d >= 1) b.fbox(logo, f, 0, 5.2, sx + 0.4, 0.5, 0.15, 2.9);
  for (let i = 0; i < n; i++) { const a = -sx / 2 + (i + 0.5) * (sx / n); docks.push(a); b.dockDoor(f, a, { w: 2.6, h: 2.9, mat: 'metal_panel_white', pad: deep }); }
  const ox = sx / 2 - 2.0;
  b.box('metal_panel_white', ox, 6.0, z, 3.6, 3.0, sz - 0.6);
  b.band(b.face(ox, z, 3.6, sz - 0.6, 'front'), -1.5, 1.5, 6.7, 1.6, {});
  b.band(b.face(ox, z, 3.6, sz - 0.6, 'right'), -sz / 2 + 0.8, sz / 2 - 0.8, 6.7, 1.6, {});
  b.box('metal_dark', ox, 9.0, z, 3.8, 0.25, sz - 0.4);
  b.sign(f, -sx / 4, 6.1, Math.min(8, sx / 2), 1.0, { logo });
  if (deep) { dockTrucks(b, f, docks, { type: 'rigid', load: b.pick(['box', 'tarp', 'box']), logo, p: 0.8 }); b.stripe(0, Z - 0.9, W - 1, 0.15, 'paint_yellow'); }
  else { b.putVan({ prefer: 'front' }, 'paint_white'); b.putVan({ prefer: 'front' }, logo); }
  b.fenceLot(0, 0, W - 0.3, b.D - 0.3, { gate: 7, ga: 0 });
  b.lamp(-X + 0.5, Z - 0.5, 9);
}

// Kleine Backsteinfabrik mit Sägezahndach und Kopfbau mit Treppengiebel
function kleinfabrik(b) {
  const { W, X, Z, wide, deep } = geom(b);
  b.lot('pavers');
  const wall = b.pick(BRICK);
  const rib = wall === 'brick_dark' ? 'brick_brown' : 'brick_dark';
  const sx = W - 1.4, sz = deep ? 12 : 5.2;
  const z = -Z + 0.6 + sz / 2, zf = z + sz / 2;
  const H = b.hall({ x: 0, z, sx, sz, h: 5.0, wall, roof: 'saw', roofMat: b.pick(['roof_metal_grey', 'roof_slate', 'roof_flat_membrane']), teeth: Math.max(2, Math.round(sz / 4.5)), ribMat: rib, bay: 3.6, plinth: 'stone_grey', plinthH: 0.7 });
  b.take(0, z, sx, sz, 0.3);
  for (const s of ['left', 'right', 'back']) b.winRow(H.f[s], -H.f[s].len / 2 + 1, H.f[s].len / 2 - 1, 1.3, 1.4, 2.2, { spacing: 3.6, arch: rib, frame: 'window_frame_dark', lod: s !== 'back' });
  // Kopfbau mit Treppengiebel
  const kw = Math.min(6.5, sx * 0.62), kd = 3.4, kz = zf + kd / 2 - 0.2, kh = 6.5;
  b.hall({ x: 0, z: kz, sx: kw, sz: kd, h: kh, wall, roof: 'gable', roofMat: b.pick(['roof_tiles_red', 'roof_slate', 'roof_tiles_anthracite']), pitch: 48, ridge: 'z', ribs: false, plinth: 'stone_grey', plinthH: 0.7, over: 0.2, gableOver: 0, gutter: false });
  if (b.d >= 1) b.box('trim_stone', 0, kh - 0.25, kz + kd / 2 - 0.05, kw + 0.25, 0.25, 0.3);
  // Treppengiebel: Stufen folgen der Dachneigung und ragen darüber hinaus
  const rise = Math.tan((48 * PI) / 180) * (kw / 2), st = rise / 4;
  for (let k = 0; k < 4; k++) {
    const w = Math.max(0.9, kw - 2 * k * (kw / 2 / 4.6));
    b.box(wall, 0, kh + k * st, kz + kd / 2 - 0.25, w, st + 0.35, 0.55);
    if (b.d >= 1) b.box('trim_stone', 0, kh + (k + 1) * st + 0.35, kz + kd / 2 - 0.25, w + 0.12, 0.12, 0.65);
  }
  if (b.d >= 1) b.cone('trim_stone', 0, kh + 4 * st + 0.47, kz + kd / 2 - 0.25, 0.25, 0.9, { seg: 4, exact: true, ry: PI / 4 });
  if (b.d >= 1) b.winRow(b.face(0, kz, kw, kd + 0.3, 'front'), -0.1, 0.1, kh + 0.4, 0.8, 1.1, { arch: 'trim_stone', lod: false });
  b.take(0, kz, kw, kd, 0.3);
  const kf = b.face(0, kz, kw, kd, 'front');
  b.fbox('door_wood', kf, 0, 0, 1.8, 2.8, 0.1, 0.02);
  if (b.d >= 1) b.winRow(kf, -0.1, 0.1, 2.85, 1.4, 0.01, { arch: 'trim_stone', lod: false });
  b.winRow(kf, -kw / 2 + 0.7, -1.3, 1.1, 1.0, 1.7, { arch: rib, spacing: 1.6 });
  b.winRow(kf, 1.3, kw / 2 - 0.7, 1.1, 1.0, 1.7, { arch: rib, spacing: 1.6 });
  b.winRow(kf, -kw / 2 + 0.7, kw / 2 - 0.7, 3.9, 1.0, 1.7, { arch: rib, spacing: 1.6 });
  b.sign(kf, 0, 5.6, kw - 1.4, 0.55, { bg: 'paint_white', logo: b.pick(LOGO) });
  b.chimney(-sx / 2 + 1.6, z - sz / 2 + 1.8, { type: 'square', h: 16, r: 0.8, mat: wall, smoke: 1 });
  if (deep) b.putTruck({ type: 'rigid', load: 'tarp' }, { prefer: 'front' });
  if (wide) { b.putPallets(3, { prefer: 'front' }); b.putTree(0.9, 'laub', { prefer: 'left' }); b.putTree(0.8, 'laub', { prefer: 'right' }); }
  b.fence(-X + 0.2, Z - 0.2, -1.8, Z - 0.2, 1.6, 'metal_dark');
  b.fence(1.8, Z - 0.2, X - 0.2, Z - 0.2, 1.6, 'metal_dark');
  b.lamp(X - 0.5, Z - 0.5, 5);
}

// Mühle / Futtermittelwerk: Silobatterie, Elevatorturm, Verladebrücke mit Durchfahrt
function muehle(b) {
  const { W, X, Z, wide, deep } = geom(b);
  b.lot('concrete');
  const siloMat = b.pick(['concrete', 'concrete_panel', 'metal_light', 'tank_white']);
  const towerMat = b.pick(['metal_corrugated', 'metal_panel_white', 'concrete_panel', 'brick_red']);
  const r = wide ? 1.9 : 1.4, tw = wide ? 3.8 : 2.6, rows = deep ? 2 : 1;
  const cols = Math.max(1, Math.floor((W - 1.0 - tw - 0.2) / (2 * r + 0.15)));
  const x0 = -X + 0.5 + r, z0 = -Z + 0.6 + r, hS = 13 + b.L * 2.5;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) b.silo(x0 + i * (2 * r + 0.15), z0 + j * (2 * r + 0.15), r, hS, { mat: siloMat, top: 'flat', rings: siloMat === 'metal_light' ? 4 : 0, ladder: i === 0 && j === 0 });
  const gsx = cols * (2 * r + 0.15), gsz = rows * (2 * r + 0.15);
  const gx = -X + 0.5 + gsx / 2 - 0.075, gz = -Z + 0.6 + gsz / 2 - 0.075;
  b.take(gx, gz, gsx, gsz, 0.2);
  b.box(towerMat, gx, hS, gz, gsx, 2.4, Math.max(2.4, gsz * 0.5));
  b.box('roof_metal_grey', gx, hS + 2.4, gz, gsx + 0.3, 0.2, Math.max(2.6, gsz * 0.5 + 0.3));
  if (b.d >= 1) b.box('concrete', gx, hS, gz, gsx - 0.2, 0.2, gsz - 0.2);
  // Elevatorturm
  const tx = X - 0.5 - tw / 2, tz = gz, th = hS + 6;
  const T = b.hall({ x: tx, z: tz, sx: tw, sz: tw, h: th, wall: towerMat, roof: 'gable', roofMat: 'roof_metal_grey', pitch: 25, ridge: 'z', ribs: false, plinthH: 0.5 });
  b.take(tx, tz, tw, tw, 0.2);
  for (let k = 1; k < 5; k++) b.winRow(T.f.front, -1, 1, (th * k) / 5, 0.8, 1.0, { spacing: 1.4 });
  b.winRow(T.f.left, -1, 1, th - 2.4, 0.8, 1.0, { spacing: 1.4 });
  b.conveyor([tx - tw / 2, th - 2.2, tz], [gx + gsx / 2 - 0.3, hS + 1.2, gz], { w: 1.2, mat: towerMat === 'brick_red' ? 'metal_corrugated' : towerMat });
  b.sign(T.f.front, 0, th - 1.6, tw - 0.6, 0.8, { logo: b.pick(['paint_green', 'paint_yellow', 'paint_red', 'paint_blue']) });
  // Verladebrücke: Lkw fährt entlang x hindurch
  const lz = -Z + 0.6 + gsz + 1.9, lx = clamp(gx, -X + 3.0, X - 3.0);
  if (b.d >= 1) for (const s of [-1, 1]) for (const t of [-1, 1]) b.box('concrete', lx + s * 2.3, 0, lz + t * 1.6, 0.4, 5.0, 0.4);
  b.box('metal_corrugated', lx, 5.0, lz, 5.2, 2.2, 3.8);
  if (b.d >= 1) b.cone('metal_light', lx, 4.0, lz, 0.6, 1.0, { seg: 8 });
  b.conveyor([lx + 2.6, 6.2, lz], [tx - tw / 2, 4.0, tz + tw / 2 - 0.4], { w: 0.9 });
  b.truck(clamp(lx, -X + 4.6, X - 4.6), lz, HP, { type: 'rigid', load: 'tank', loadMat: 'metal_light' });
  b.take(0, lz, b.W - 1, 4.0, 0);
  b.smoke(gx, hS + 2.8, gz, 'steam', 0.3);
  if (deep) b.putTruck({ type: 'semi', load: 'tank', loadMat: 'metal_light' }, { prefer: 'front' });
  b.fenceLot(0, 0, W - 0.3, b.D - 0.3, { gate: 5, ga: 0 });
  b.lamp(X - 0.5, Z - 0.5, 8);
}

// Moderne Gewerbehalle mit Bürokopf und Farbband (typisches Gewerbegebiet)
function gewerbehalle(b) {
  const { W, X, Z, wide, deep } = geom(b);
  b.lot('asphalt');
  const wall = b.pick(['metal_panel_white', 'metal_panel_grey', 'metal_panel_white', 'concrete_panel']);
  const logo = b.pick(LOGO);
  const hsx = W - 1.2, hsz = deep ? 9 : 4.6;
  const hz = -Z + 0.6 + hsz / 2, hf = hz + hsz / 2;
  const H = b.hall({ x: 0, z: hz, sx: hsx, sz: hsz, h: 6.5, wall, roof: 'flat', roofMat: 'roof_flat_membrane', ribs: false, plinthH: 0.6, parapet: 0.8 });
  b.take(0, hz, hsx, hsz, 0.3);
  for (const s of ['left', 'right', 'back']) b.fbox(logo, H.f[s], 0, 5.4, H.f[s].len, 0.6, 0.04, 0.02);
  b.band(H.f.left, -hsz / 2 + 0.6, hsz / 2 - 0.6, 3.4, 1.4, {});
  b.band(H.f.right, -hsz / 2 + 0.6, hsz / 2 - 0.6, 3.4, 1.4, {});
  b.domelights(0, 6.6, hz, hsx * 0.6, hsz * 0.5, Math.max(1, Math.round(hsx / 7)), deep ? 2 : 1);
  const osx = wide ? 9 : W - 1.2, osz = deep ? 5 : 3.2;
  const ox = wide ? -X + 0.6 + osx / 2 : 0, oz = hf + osz / 2 - 0.05;
  officeHead(b, ox, oz, osx, osz, deep ? 3 : 2, { skip: ['back'], logo, wall: b.pick(['plaster_white', 'metal_panel_white', 'concrete_panel', 'plaster_grey']), entryA: osx / 4, canopyD: 1.0 });
  b.take(ox, oz + 0.5, osx, osz + 1.0, 0.2);
  if (wide) {
    b.rollerDoor(H.f.front, hsx / 2 - 1.8, 3.2, 4.0, { mat: 'metal_panel_grey' });
    b.take(hsx / 2 - 1.8, hf + 2.0, 4.0, 4.0, 0);
    putParking(b, 6.2, Math.min(5.2, Z - hf - 0.6), { prefer: 'front', fill: 0.75 });
  } else if (deep) putParking(b, W - 1.2, 5.0, { prefer: 'front', fill: 0.7 });
  b.box('grass', 0, 0, Z - 0.35, W - 0.4, 0.12, 0.5);
  if (b.d >= 2) { const p = b.plan.find(4.8, 1.2, { prefer: 'front' }); if (p) b.flags(p[0], p[1], 3, 0); }
  b.lamp(X - 0.5, Z - 0.6, 7);
}

// =====================================================================================
// Stufe 3 – Fabriken
// =====================================================================================

// Backsteinfabrik: Sägezahnhalle, Verwaltungsbau mit Gesims, runder Schornstein, Kesselhaus
function backsteinfabrik(b) {
  const { W, D, X, Z, wide, deep } = geom(b);
  b.lot('pavers');
  const wall = b.pick(['brick_red', 'brick_brown', 'brick_red', 'brick_yellow']);
  const rib = 'brick_dark';
  const asz = deep ? 4.6 : 3.4;
  const hsx = wide ? W - 1.2 : W - 1.2 - 3.4, hx = -X + 0.6 + hsx / 2;
  const sz = deep ? 11 : D - 1.2 - asz - 0.3;
  const z = -Z + 0.6 + sz / 2, zf = z + sz / 2;
  const H = b.hall({ x: hx, z, sx: hsx, sz, h: 6.0, wall, roof: 'saw', roofMat: b.pick(['roof_slate', 'roof_metal_grey', 'roof_flat_membrane']), teeth: Math.max(2, Math.round(sz / 3.8)), toothH: 2.6, ribMat: rib, bay: 3.4, plinth: 'stone_grey', plinthH: 0.8 });
  b.take(hx, z, hsx, sz, 0.3);
  for (const s of ['left', 'right', 'back']) b.winRow(H.f[s], -H.f[s].len / 2 + 1, H.f[s].len / 2 - 1, 1.4, 1.6, 2.8, { spacing: 3.4, arch: rib, frame: 'window_frame_dark', lod: s !== 'back' });
  // Verwaltungsbau (3 Geschosse)
  const asx = wide ? 11 : hsx, ax = -X + 0.6 + asx / 2, az = zf + asz / 2 - 0.1, ah = 10.2;
  const A = b.hall({ x: ax, z: az, sx: asx, sz: asz, h: ah, wall, roof: 'flat', roofMat: 'roof_flat_gravel', ribs: true, bay: 2.4, ribMat: rib, ribSides: ['front'], plinth: 'stone_grey', plinthH: 1.0, parapet: 1.0, parMat: wall });
  b.take(ax, az, asx, asz, 0.3);
  if (b.d >= 1) { b.box('trim_stone', ax, ah - 0.1, az, asx + 0.4, 0.35, asz + 0.4); b.box('trim_stone', ax, 3.4, az, asx + 0.2, 0.25, asz + 0.2); }
  const af = A.f.front, mid = Math.floor(A.bays.front.length / 2);
  for (let k = 0; k < 3; k++) A.bays.front.forEach((a, i) => {
    if (k === 0 && i === mid) return;
    b.winRow(af, a - 0.2, a + 0.2, 0.9 + k * 3.3 + (k ? 0.3 : 0), 1.2, 1.9, { arch: k === 2 ? 'trim_stone' : null, frame: 'window_frame_white', sill: true });
  });
  for (const s of ['left', 'right']) for (let k = 0; k < 3; k++) b.winRow(A.f[s], -asz / 2 + 1, asz / 2 - 1, 1.2 + k * 3.3, 1.2, 1.9, { spacing: 2.2, frame: 'window_frame_white' });
  const ea = A.bays.front[mid];
  b.fbox('door_wood', af, ea, 0, 1.6, 2.6, 0.1, 0.02);
  if (b.d >= 1) b.fbox('trim_stone', af, ea, 2.6, 2.4, 0.5, 0.25, 0);
  b.sign(af, 0, ah + 0.45, Math.min(asx - 2, 7), 0.8, { bg: 'paint_white', logo: b.pick(LOGO) });
  // Schornstein, Kesselhaus, Wasserturm
  const chH = 28 + b.L * 2;
  if (!wide) { b.chimney(X - 1.7, z - sz / 2 + 1.7, { type: 'round', h: chH, r: 1.05, mat: wall === 'brick_yellow' ? 'brick_yellow' : 'chimney_brick', smoke: 1.4 }); b.take(X - 1.7, z - sz / 2 + 1.7, 2.9, 2.9, 0.1); }
  else b.chimney(X - 1.8, -Z + 1.8, { type: 'round', h: chH + 4, r: 1.15, mat: wall === 'brick_yellow' ? 'brick_yellow' : 'chimney_brick', smoke: 1.4 });
  if (wide && !deep) {
    const kx = X - 2.4, kz = zf + 1.6;
    b.hall({ x: kx, z: kz, sx: 3.6, sz: 3.0, h: 5, wall, roof: 'gable', roofMat: 'roof_slate', pitch: 25, ridge: 'z', ribs: false, plinthH: 0.5 });
    b.door(b.face(kx, kz, 3.6, 3.0, 'front'), 0, { mat: 'door_wood' });
    b.take(kx, kz, 3.6, 3.0, 0.3);
  }
  if (wide && deep) { waterTower(b, X - 4.4, Z - 4.4, 9, { shaft: wall, head: wall }); b.takeC(X - 4.4, Z - 4.4, 4.0, 0.1); }
  if (deep) { b.putTruck({ type: 'rigid', load: 'tarp' }, { prefer: 'front' }); b.putTree(0.9, 'laub', { prefer: 'front' }); }
  b.lamp(-X + 0.5, Z - 0.5, 5);
}

// Brauerei: Sudhaus mit Kupferkuppel, Gärtanks im Freien, Malzsilos, Schornstein
function brauerei(b) {
  const { X, Z, wide, deep } = geom(b);
  b.lot('pavers');
  const wall = b.pick(['brick_red', 'brick_yellow', 'plaster_cream', 'brick_brown']);
  const ssx = wide ? 9 : 5.8, ssz = deep ? 9 : 6, sx0 = -X + 0.6 + ssx / 2, sz0 = -Z + 0.6 + ssz / 2, sh = 12;
  const S = b.hall({ x: sx0, z: sz0, sx: ssx, sz: ssz, h: sh, wall, roof: 'gable', roofMat: b.pick(['roof_slate', 'roof_tiles_red', 'roof_copper']), pitch: 35, ridge: 'x', ribs: true, bay: 2.6, ribMat: 'brick_dark', plinth: 'stone_grey', plinthH: 1.2 });
  b.take(sx0, sz0, ssx, ssz, 0.3);
  for (const s of ['front', 'left', 'right']) S.bays[s].forEach((a) => {
    b.winRow(S.f[s], a - 0.2, a + 0.2, 1.6, 1.3, 4.6, { arch: 'trim_stone', frame: 'window_frame_white', mullion: true });
    b.winRow(S.f[s], a - 0.2, a + 0.2, 7.6, 1.3, 2.6, { arch: 'trim_stone', frame: 'window_frame_white' });
  });
  if (b.d >= 1) b.box('trim_stone', sx0, 6.8, sz0, ssx + 0.15, 0.3, ssz + 0.15);
  // Dachreiter mit Kupferhaube
  const rise = Math.tan((35 * PI) / 180) * (ssz / 2);
  b.box(wall, sx0, sh + rise * 0.55, sz0, 2.4, 2.8, 2.4);
  b.dome('roof_copper', sx0, sh + rise * 0.55 + 2.8, sz0, 1.6, 1.1, { seg: 12 });
  if (b.d >= 1) b.cyl('roof_copper', sx0, sh + rise * 0.55 + 4.5, sz0, 0.08, 1.5, { seg: 5, exact: true });
  if (b.d >= 1) b.winRow(b.face(sx0, sz0, 2.4, 2.4, 'front'), -0.2, 0.2, sh + rise * 0.55 + 0.6, 0.9, 1.6, { arch: 'trim_stone' });
  b.sign(S.f.front, 0, 6.0, ssx - 1.4, 0.65, { bg: 'paint_white', logo: b.pick(['paint_red', 'paint_green', 'paint_blue', 'paint_yellow']) });
  // Schornstein
  const cx = sx0 + ssx / 2 + 1.3, cz = sz0 - ssz / 2 + 1.3;
  b.chimney(cx, cz, { type: 'round', h: 22, r: 0.85, mat: 'chimney_brick', smoke: 0.6, kind: 'steam' });
  b.take(cx, cz, 2.4, 2.4, 0.1);
  // Gärtanks (Zylinder mit Kegelboden auf Stützen) als Block
  const tc = wide ? 3 : 1, tr = wide ? (deep ? 2 : 1) : 2, th = 7 + b.L;
  const blk = b.plan.find(tc * 2.6, tr * 2.7, { prefer: 'right', pad: 0.2 });
  if (blk) {
    for (let i = 0; i < tc; i++) for (let j = 0; j < tr; j++) b.silo(blk[0] + (i - (tc - 1) / 2) * 2.6, blk[1] + (j - (tr - 1) / 2) * 2.7, 1.15, th, { mat: 'metal_light', legs: 2.2, top: 'dome', ladder: false });
    if (b.d >= 1) b.box('metal_dark', blk[0], 9.9 + b.L, blk[1], tc * 2.6, 0.18, Math.max(1.4, tr * 2.7 - 1.2));
    if (b.d >= 2) b.beam('metal_dark', [blk[0] - tc * 1.3, 0, blk[1] + tr * 1.35], [blk[0] - tc * 1.3, 9.9 + b.L, blk[1] - tr * 0.6], 0.8, 0.12);
  }
  if (deep) {
    const ms = b.plan.find(6.2, 3.0, { prefer: 'left', pad: 0.2 });
    if (ms) for (const s of [-1, 1]) b.silo(ms[0] + s * 1.55, ms[1], 1.4, 9, { mat: 'metal_light', rings: 3, top: 'cone' });
  }
  const cp = b.plan.find(1.8, 0.5, { prefer: 'front' });
  if (cp) crates(b, cp[0] - 0.6, cp[1], 3);
  if (wide || deep) b.putTruck({ type: 'rigid', load: 'box', loadMat: b.pick(['paint_red', 'paint_green', 'metal_panel_white']) }, { prefer: 'front' });
  else b.putVan({ prefer: 'front' });
  if (wide && deep) { b.putTree(1.0, 'laub', { prefer: 'front' }); b.putTree(0.85, 'laub', { prefer: 'front' }); }
  b.lamp(X - 0.5, Z - 0.5, 5);
}

// Gießerei: hohe Halle mit Firstlaterne, Kupolofen mit Rauch, Formsand-Silos, Portalkran im Gusslager
function giesserei(b) {
  const { W, D, X, Z, wide, deep } = geom(b);
  b.lot('asphalt_dark');
  const wall = b.pick(['metal_corrugated', 'brick_dark', 'metal_corrugated_red', 'metal_panel_grey']);
  const sx = wide ? 12 : W - 1.2, sz = deep ? 13 : 6.2;
  const x = wide ? -X + 0.6 + sx / 2 : 0, z = -Z + 0.6 + sz / 2;
  const H = b.hall({ x, z, sx, sz, h: 9.0, wall, roof: 'monitor', roofMat: 'roof_metal_grey', pitch: 12, ridge: 'z', bay: 4.2, ribMat: 'metal_dark', plinth: 'concrete_dark', plinthH: 1.2, sawGlass: 'glass_window' });
  b.take(x, z, sx, sz, 0.3);
  b.rollerDoor(H.f.front, -sx / 6, Math.min(4.5, sx * 0.4), 5.5, { mat: 'metal_panel_grey' });
  b.band(H.f.left, -sz / 2 + 0.6, sz / 2 - 0.6, 6.0, 1.6, {});
  b.band(H.f.right, -sz / 2 + 0.6, sz / 2 - 0.6, 6.0, 1.6, {});
  b.winRow(H.f.front, sx / 6 + 1.0, sx / 2 - 0.8, 1.4, 1.2, 2.4, { spacing: 2.2 });
  // Kupolofen durch das Dach
  const kx = x + sx / 4, kz = z - sz / 5;
  b.cyl('metal_dark', kx, 7, kz, 1.1, 14, { seg: 10 });
  b.cyl('rust', kx, 7, kz, 1.3, 3.5, { seg: 10 });
  if (b.d >= 1) b.cone('metal_dark', kx, 21, kz, 1.5, 0.8, { seg: 10 });
  b.smoke(kx, 21.5, kz, 'smoke', 1.6);
  b.chimney(x - sx / 2 + 1.5, z - sz / 2 + 1.3, { type: 'steel', h: 20, r: 0.7, smoke: 0.9 });
  b.light(x - sx / 6, 3.0, z + sz / 2 + 0.6, 0xff8a3a, 0.6);
  if (wide) {
    const gx = X - 3.7, glen = D - 1.2;
    b.gantry(gx, 0, 5.0, glen, 6.0, { mat: 'paint_yellow', pos: 0.1, grab: true });
    b.take(gx, 0, 6.8, glen, 0);
    if (b.d >= 1) {
      for (let i = 0; i < 3; i++) b.cyl('rust', gx + (i - 1) * 1.5, 0, -D / 4 + i * 1.2, 0.6, 0.9, { seg: 10 });
      b.box('rust', gx, 0, D / 4, 2.2, 0.8, 1.4);
      b.box('metal_dark', gx + 0.6, 0, D / 4 - 2.2, 1.4, 1.2, 1.4);
    }
  }
  for (let i = 0; i < (wide ? 2 : 1); i++) { const p = b.plan.find(2.6, 2.6, { prefer: 'front', pad: 0.2 }); if (p) b.silo(p[0], p[1], 1.2, 7, { mat: 'metal_light', legs: 3, top: 'cone' }); }
  if (deep) b.putTruck({ type: 'rigid', load: 'flat', cargoMat: 'rust' }, { prefer: 'front' });
  b.fenceLot(0, 0, W - 0.3, D - 0.3, { gate: 5, ga: x - sx / 6 });
  b.lamp(-X + 0.5, Z - 0.5, 8);
}

// Kunststoffwerk: weiße Fertigungshalle mit Granulatsilos auf Stützen
function kunststoffwerk(b) {
  const { W, X, Z, wide, deep } = geom(b);
  b.lot('asphalt');
  const wall = b.pick(['metal_panel_white', 'metal_panel_grey', 'concrete_panel']);
  const accent = b.pick(['paint_blue', 'paint_green', 'paint_orange', 'paint_red']);
  const sx = W - 1.2, sz = deep ? 10 : 4.8;
  const z = -Z + 0.6 + sz / 2, zf = z + sz / 2;
  const H = b.hall({ x: 0, z, sx, sz, h: 8.0, wall, roof: 'flat', roofMat: 'roof_flat_membrane', bay: 5, ribMat: 'metal_light', plinthH: 0.6 });
  b.take(0, z, sx, sz, 0.3);
  for (const s of ['front', 'left', 'right']) b.fbox(accent, H.f[s], 0, 6.6, H.f[s].len, 0.5, 0.04, 0.17);
  b.band(H.f.left, -sz / 2 + 0.6, sz / 2 - 0.6, 3.5, 1.4, {});
  b.band(H.f.right, -sz / 2 + 0.6, sz / 2 - 0.6, 3.5, 1.4, {});
  b.domelights(0, 8.1, z, sx * 0.7, sz * 0.6, Math.max(1, Math.round(sx / 5)), Math.max(1, Math.round(sz / 5)));
  const ns = wide ? 4 : 2;
  for (let i = 0; i < ns; i++) {
    const px = -sx / 2 + 1.6 + i * 2.6, pz = zf + 1.6;
    b.silo(px, pz, 1.05, 8 + (i % 2), { mat: i % 2 ? 'tank_white' : 'metal_light', legs: 3.2, top: 'cone', ladder: i === 0 });
    if (b.d >= 2) b.pipe('metal_light', [px, 12.3 + (i % 2), pz], [px, 12.3 + (i % 2), zf - 0.2], 0.14);
  }
  const sw = (ns - 1) * 2.6 + 2.2;
  if (b.d >= 1) b.box('metal_dark', -sx / 2 + 1.6 + ((ns - 1) * 2.6) / 2, 3.2, zf + 1.6, sw, 0.2, 2.6);
  b.take(-sx / 2 + 1.6 + ((ns - 1) * 2.6) / 2, zf + 1.6, sw, 2.4, 0.3);
  b.sign(H.f.front, sx / 4 + 0.5, 4.6, Math.min(5.5, sx / 2 - 1.5), 1.0, { logo: accent });
  if (wide) { b.dockDoor(H.f.front, sx / 2 - 2.2, { w: 3, h: 3, pad: false }); b.take(sx / 2 - 2.2, zf + 2.5, 4, 5, 0); }
  if (deep) b.putTruck({ type: 'rigid', load: 'tank', loadMat: 'tank_white' }, { prefer: 'front', ryX: HP });
  if (wide && deep) putParking(b, 8.0, 5.0, { prefer: 'front' });
  b.fenceLot(0, 0, W - 0.3, b.D - 0.3, { gate: 6, ga: wide ? 4 : 0 });
  b.lamp(X - 0.5, Z - 0.5, 8);
}

// Betonwerk: Mischturm (unterfahrbar), Zementsilos, Schüttgutboxen, Förderband, Fahrmischer
function betonwerk(b) {
  const { W, X, Z, wide, deep } = geom(b);
  b.lot('concrete');
  const towerMat = b.pick(['metal_corrugated', 'metal_panel_white', 'metal_corrugated_green', 'metal_panel_blue']);
  const mx = wide ? -X + 4.5 : -X + 2.8, mz = -Z + 2.8, mh = 13 + b.L;
  b.box(towerMat, mx, 5.0, mz, 4.2, mh - 5, 4.2);
  if (b.d >= 1) for (const s of [-1, 1]) for (const t of [-1, 1]) b.box('metal_dark', mx + s * 1.9, 0, mz + t * 1.9, 0.3, 5.0, 0.3);
  b.box('roof_metal_grey', mx, mh, mz, 4.6, 0.25, 4.6);
  if (b.d >= 1) b.cone('metal_light', mx, 3.6, mz, 1.2, 1.4, { seg: 8 });
  const MF = b.face(mx, mz, 4.2, 4.2, 'front');
  b.band(MF, -1.6, 1.6, mh - 2.2, 1.0, {});
  b.sign(MF, 0, mh - 4.0, 3.6, 0.9, { logo: b.pick(LOGO) });
  b.take(mx, mz, 4.4, 4.4, 0.2);
  const ns = wide ? 4 : 2;
  for (let i = 0; i < ns; i++) b.silo(mx + 3.5 + i * 2.4, mz - 0.3, 1.05, 9, { mat: i % 2 ? 'tank_white' : 'metal_light', legs: 4, top: 'cone', ladder: i === 0 });
  b.take(mx + 3.5 + ((ns - 1) * 2.4) / 2, mz - 0.3, ns * 2.4, 2.4, 0.2);
  if (b.d >= 1) b.box('metal_dark', mx + 3.5 + ((ns - 1) * 2.4) / 2, 4.0, mz - 0.3, ns * 2.4, 0.2, 1.0);
  // Schüttgutboxen
  const nb = wide ? (deep ? 5 : 3) : 3, bxw = wide && !deep ? W / 2 - 1.2 : W - 1.6, bw = bxw / nb;
  const bx0 = -X + 0.8, bz = deep ? 2.6 : Z - 1.9;
  for (let i = 0; i <= nb; i++) b.box('concrete', bx0 + i * bw, 0, bz, 0.35, 2.0, 3.2);
  if (b.d >= 1) b.box('concrete', bx0 + bxw / 2, 0, bz - 1.5, bxw, 2.0, 0.3);
  const fills = ['sand', 'gravel', 'rock', 'gravel', 'sand'];
  for (let i = 0; i < nb; i++) b.cone(fills[i % 5], bx0 + (i + 0.5) * bw, 0, bz, bw * 0.45, 2.1, { seg: 8 });
  b.take(bx0 + bxw / 2, bz, bxw, 3.4, 0.2);
  b.conveyor([bx0 + bw * 0.5, 1.0, bz - 1.2], [mx - 1.6, mh - 3, mz], { w: 1.0, covered: false, fill: 'gravel' });
  b.take(mx - 1.6 + (bx0 + bw * 0.5 - mx + 1.6) / 2, (bz - 1.2 + mz) / 2, 1.6, Math.abs(bz - 1.2 - mz), 0);
  const mixers = deep ? (wide ? 3 : 2) : 1;
  for (let i = 0; i < mixers; i++) b.put(8.5, 2.6, { prefer: 'front' }, (px, pz, ry) => mixerTruck(b, px, pz, ry));
  b.put(3.0, 2.0, { prefer: 'center' }, (px, pz, ry) => { b.box('paint_yellow', px, 0.5, pz, 2.2, 1.6, 3.0, ry); if (b.d >= 2) b.box('metal_dark', px + Math.sin(ry) * 1.8, 0.2, pz + Math.cos(ry) * 1.8, 2.4, 0.9, 0.5, ry); });
  b.fenceLot(0, 0, W - 0.3, b.D - 0.3, { gate: 6, ga: wide ? 3 : 1.5 });
  b.lamp(X - 0.5, Z - 0.5, 9);
}

// Logistikzentrum: große Halle mit Farbband, viele Rampen, Pförtnerhaus
function logistik(b) {
  const { W, X, Z, wide, deep } = geom(b);
  b.lot('asphalt');
  const wall = b.pick(['metal_panel_blue', 'metal_panel_grey', 'metal_panel_white', 'metal_corrugated_green']);
  const band = wall === 'metal_panel_white' ? b.pick(['paint_blue', 'paint_red', 'paint_orange']) : 'metal_panel_white';
  const sx = W - 1.0, sz = deep ? 9 : 5.4;
  const z = -Z + 0.5 + sz / 2, h = deep ? 10 : 8;
  const H = b.hall({ x: 0, z, sx, sz, h, wall, roof: 'flat', roofMat: 'roof_flat_membrane', bay: 6, ribs: false, plinthH: 1.2, plinth: 'concrete_dark', parapet: 1.0 });
  b.take(0, z, sx, sz, 0.3);
  for (const s of ['front', 'left', 'right', 'back']) b.fbox(band, H.f[s], 0, h - 1.6, H.f[s].len + 0.02, 1.4, 0.04, 0.02);
  const n = Math.max(2, Math.floor(sx / 3.4)), docks = [];
  for (let i = 0; i < n; i++) { const a = -sx / 2 + (i + 0.5) * (sx / n); docks.push(a); b.dockDoor(H.f.front, a, { w: 2.6, h: 2.9, pad: deep }); }
  b.sign(H.f.front, sx / 2 - 3.5, h - 1.5, 5, 1.2, { logo: band === 'metal_panel_white' ? b.pick(LOGO) : band });
  b.domelights(0, h + 0.1, z, sx * 0.75, sz * 0.6, Math.max(1, Math.round(sx / 6)), Math.max(1, Math.round(sz / 6)));
  b.vents(0, h + 0.1, z, sx * 0.5, sz * 0.4, 2);
  if (wide && deep) {
    const px = X - 1.6, pz = Z - 1.6;
    b.box('metal_panel_white', px, 0, pz, 2.2, 2.8, 2.2);
    b.box('metal_dark', px, 2.8, pz, 2.8, 0.2, 2.8);
    b.fplane('glass_window', b.face(px, pz, 2.2, 2.2, 'left'), 0, 1.0, 1.8, 1.4, 0.03);
    if (b.d >= 2) b.box('paint_red', px - 3.5, 0.95, pz, 5.0, 0.12, 0.1);
    b.take(px, pz, 2.4, 2.4, 0.3);
  }
  if (deep) dockTrucks(b, H.f.front, docks, { type: 'rigid', load: b.pick(['box', 'tarp', 'container']), p: 0.8 });
  else b.putVan({ prefer: 'front' }, 'paint_white');
  b.fenceLot(0, 0, W - 0.3, b.D - 0.3, { gate: wide ? 10 : 6, ga: 0 });
  b.lamp(-X + 0.5, Z - 0.5, 10);
  if (wide) b.lamp(0, Z - 0.5, 10);
}

// =====================================================================================
// Stufe 4 – Schwerindustrie
// =====================================================================================

// Chemiewerk: Kolonnen, Tanks, Rohrbrücken, Fackel, Leitwarte
function chemiewerk(b) {
  const { W, X, Z, wide, deep } = geom(b);
  b.lot('concrete');
  const tankMat = b.pick(['tank_white', 'tank_white', 'metal_light']);
  const band = b.pick(['paint_blue', 'paint_red', 'paint_green', 'paint_orange']);
  const lw = wide ? 7 : 4.6, ld = 3.0, lx = -X + 0.6 + lw / 2, lz = Z - 0.6 - ld / 2;
  const LW = b.hall({ x: lx, z: lz, sx: lw, sz: ld, h: 4.0, wall: 'concrete_panel', roof: 'flat', roofMat: 'roof_flat_gravel', ribs: false, plinthH: 0.3, parapet: 0.6 });
  b.band(LW.f.front, -lw / 2 + 0.5, lw / 2 - 0.5, 1.2, 1.6, { glass: 'glass_window' });
  b.door(LW.f.right, 0);
  b.sign(LW.f.front, 0, 3.15, lw - 1.0, 0.6, { logo: band });
  b.take(lx, lz, lw, ld, 0.3);
  const rz = lz - ld / 2 - 1.4;
  b.pipeRack(-X + 0.5, rz, X - 0.5, rz, 5.5, { w: 1.8 });
  b.take(0, rz, W - 1, 2.2, 0);
  const cx = X - 2.4, cz = -Z + 2.4, ch = 24 + b.L * 2;
  column(b, cx, cz, 1.0, ch, { band });
  b.takeC(cx, cz, 1.9, 0.1);
  if (b.d >= 1) {
    const gx = cx - 2.6, gz = cz, gs = 2.4;
    if (b.plan.free(gx, gz, gs + 0.4, gs + 0.4)) {
      for (const s of [-1, 1]) for (const t of [-1, 1]) b.box('metal_dark', gx + s * gs / 2, 0, gz + t * gs / 2, 0.25, 12, 0.25);
      for (const y of [4, 8, 12]) b.box('metal_dark', gx, y, gz, gs + 0.3, 0.2, gs + 0.3);
      b.cyl('metal_light', gx, 4.2, gz, 0.7, 3.0, { seg: 10 });
      b.take(gx, gz, gs, gs, 0.2);
    }
  }
  b.smoke(cx, ch + 1.5, cz, 'steam', 0.7);
  if (wide || deep) { const p = b.plan.find(2.8, 2.8, { prefer: 'back', pad: 0.2 }); if (p) column(b, p[0], p[1], 0.7, 16 + b.L, { band }); }
  const tr = wide && deep ? 2.6 : wide || deep ? 2.2 : 1.7;
  const nt = wide && deep ? 3 : wide || deep ? 2 : 1;
  for (let i = 0; i < nt; i++) { const p = b.plan.find(2 * tr + 1.6, 2 * tr + 1.6, { prefer: 'left', pad: 0 }); if (p) b.tank(p[0], p[1], tr, 6 + b.L, { mat: tankMat, roof: 'dome', band }); }
  if (wide && deep) { const p = b.plan.find(5.6, 5.6, { prefer: 'back', pad: 0 }); if (p) b.sphereTank(p[0], p[1], 2.3, {}); }
  const fp = b.plan.find(1.2, 1.2, { prefer: 'right', pad: 0.2 });
  if (fp) {
    b.cyl('metal_light', fp[0], 0, fp[1], 0.35, 26, { seg: 8 });
    if (b.d >= 1) b.cyl('paint_red', fp[0], 22, fp[1], 0.38, 2, { seg: 8, open: true });
    if (b.d >= 1) b.cone('emissive_warm', fp[0], 26, fp[1], 0.3, 0.9, { seg: 6 });
    b.smoke(fp[0], 26.5, fp[1], 'smoke', 0.8);
    b.light(fp[0], 26.7, fp[1], 0xff7a2a, 0.55);
  }
  b.fenceLot(0, 0, W - 0.3, b.D - 0.3, { gate: 5, ga: wide ? 3 : 1 });
  b.lamp(X - 0.5, Z - 0.5, 9);
  if (wide || deep) b.lamp(-X + 0.5, -Z + 0.5, 9);
}

// Zementwerk: Vorwärmerturm, Drehrohrofen, Klinkersilos, rot-weißer Schornstein
function zementwerk(b) {
  const { W, X, Z, wide, deep } = geom(b);
  b.lot('concrete');
  const towerMat = b.pick(['concrete', 'metal_corrugated', 'concrete_panel']);
  const tsx = 5, tsz = 5, tx = -X + 0.6 + tsx / 2, tz = -Z + 0.6 + tsz / 2, th = 26 + b.L * 3;
  b.box(towerMat, tx, 0, tz, tsx, th, tsz);
  if (b.d >= 1) for (let k = 1; k < 6; k++) b.box('metal_dark', tx, (th * k) / 6, tz, tsx + 0.5, 0.25, tsz + 0.5);
  if (b.d >= 2) for (let k = 1; k < 6; k++) b.cyl('metal_light', tx + tsx / 2 - 0.4, (th * k) / 6 - 2.6, tz + 1.2, 0.6, 2.4, { seg: 10 });
  b.box('metal_dark', tx, th, tz, tsx * 0.6, 2.0, tsz * 0.6);
  b.sign(b.face(tx, tz, tsx, tsz, 'front'), 0, th - 3.0, 4, 1.0, { logo: b.pick(LOGO) });
  b.take(tx, tz, tsx, tsz, 0.2);
  const chx = tx + tsx / 2 + 1.4, chz = -Z + 1.6;
  b.chimney(chx, chz, { type: 'steel', h: th + 10, r: 0.9, stripes: true, smoke: 1.6, mat: 'paint_white' });
  b.take(chx, chz, 3.0, 3.0, 0);
  b.smoke(tx, th + 2.5, tz, 'steam', 1.0);
  const k0 = [tx + 1.6, 5.5, tz + tsz / 2 + 0.6];
  const k1 = wide ? [X - 2.4, 3.2, deep ? -Z + 5 : tz + 0.6] : [tx + 1.2, 3.2, Z - 2.4];
  if (wide && !deep) { k0[0] = tx + tsx / 2 + 0.6; k0[2] = tz + 1.2; }
  b.pipe('metal_light', k0, k1, 1.2, 12);
  if (b.d >= 1) for (const t of [0.25, 0.55, 0.85]) {
    const px = k0[0] + (k1[0] - k0[0]) * t, py = k0[1] + (k1[1] - k0[1]) * t, pz = k0[2] + (k1[2] - k0[2]) * t;
    b.box('concrete', px, 0, pz, 1.4, py - 1.1, 1.4);
    if (b.d >= 2) b.pipe('rust', [px - (k1[0] - k0[0]) * 0.02, py, pz - (k1[2] - k0[2]) * 0.02], [px + (k1[0] - k0[0]) * 0.02, py, pz + (k1[2] - k0[2]) * 0.02], 1.4, 12);
  }
  b.box('metal_corrugated', k1[0], 0, k1[2], 3.2, 4.6, 3.2);
  b.take((k0[0] + k1[0]) / 2, (k0[2] + k1[2]) / 2, Math.abs(k1[0] - k0[0]) + 3.2, Math.abs(k1[2] - k0[2]) + 3.2, 0);
  const ns = wide && deep ? 2 : wide || deep ? 1 : 0;
  for (let i = 0; i < ns; i++) {
    const p = b.plan.find(5.4, 5.4, { prefer: 'right', pad: 0.1 });
    if (!p) break;
    b.silo(p[0], p[1], 2.6, 16 + b.L, { mat: 'concrete', top: 'dome' });
    if (i === 0) b.conveyor([k1[0], 4.4, k1[2]], [p[0], 16.5 + b.L, p[1]], { w: 1.2, noEnd: true });
  }
  b.putTruck({ type: 'semi', load: 'tank', loadMat: 'metal_light' }, { prefer: 'front' });
  b.fenceLot(0, 0, W - 0.3, b.D - 0.3, { gate: 6, ga: 0 });
  b.lamp(X - 0.5, Z - 0.5, 10);
}

// Fabrikkomplex: mehrere Satteldachhallen, Verwaltungsbau mit Uhrturm, Wasserturm, hoher Schornstein
function fabrikkomplex(b) {
  const { W, X, Z, wide, deep } = geom(b);
  b.lot('asphalt');
  const wall = b.pick(['brick_red', 'brick_yellow', 'plaster_grey', 'brick_brown']);
  const roofMat = b.pick(['roof_metal_grey', 'roof_slate', 'roof_tiles_anthracite']);
  const nh = wide ? 3 : 2, hsz = deep ? 11 : 5.6, hsxAll = W - 1.2 - (wide ? 0 : 3.2), hsx = hsxAll / nh;
  const hz = -Z + 0.6 + hsz / 2, hf = hz + hsz / 2;
  for (let i = 0; i < nh; i++) {
    const hx = -X + 0.6 + hsx * (i + 0.5);
    const H = b.hall({ x: hx, z: hz, sx: hsx, sz: hsz, h: 7.0, wall, roof: 'gable', roofMat, pitch: 26, ridge: 'z', bay: 3.6, ribMat: 'brick_dark', ribSides: ['left', 'right', 'back'], plinth: 'stone_grey', plinthH: 0.8, over: 0.15, gutter: false });
    b.winRow(H.f.front, -hsx / 2 + 0.8, hsx / 2 - 0.8, 1.6, Math.min(2.0, hsx / 3.2), 3.2, { arch: 'brick_dark', frame: 'window_frame_dark', spacing: hsx / 2.3 });
    if (b.d >= 1) b.winRow(H.f.front, -0.3, 0.3, 7.6, 1.2, 0.8 * Math.min(1, hsx / 5), { frame: 'window_frame_dark', lod: false });
    if (i === nh - 1 || i === 0) for (const a of H.bays[i ? 'right' : 'left']) b.winRow(H.f[i ? 'right' : 'left'], a - 0.2, a + 0.2, 1.6, 1.4, 3.2, { arch: 'brick_dark' });
  }
  b.take(-X + 0.6 + hsxAll / 2, hz, hsxAll, hsz, 0.3);
  const cx = wide ? X - 2.0 : X - 1.8, cz = deep ? hf + 2.0 : -Z + 2.0;
  b.chimney(cx, cz, { type: 'round', h: 38 + b.L, r: 1.2, mat: 'chimney_brick', smoke: 1.8 });
  b.take(cx, cz, 3.4, 3.4, 0.1);
  if (deep) {
    const asx = wide ? 10 : 6.6, asz = 4.4, ax = -X + 0.6 + asx / 2, az = Z - 0.8 - asz / 2;
    const A = b.hall({ x: ax, z: az, sx: asx, sz: asz, h: 12.6, wall: b.pick(['plaster_cream', 'plaster_white', wall]), roof: 'gable', roofMat: 'roof_slate', pitch: 40, ridge: 'x', ribs: false, plinth: 'stone_grey', plinthH: 1.0 });
    for (let k = 0; k < 4; k++) b.winRow(A.f.front, -asx / 2 + 0.8, asx / 2 - 0.8, 1.0 + k * 3.0, 1.2, 1.8, { spacing: 2.0, frame: 'window_frame_white', sill: true });
    for (let k = 0; k < 4; k++) b.winRow(A.f.back, -asx / 2 + 0.8, asx / 2 - 0.8, 1.0 + k * 3.0, 1.2, 1.8, { spacing: 2.4, frame: 'window_frame_white' });
    if (b.d >= 1) { b.box('trim_stone', ax, 12.3, az, asx + 0.3, 0.3, asz + 0.3); b.box('trim_stone', ax, 3.5, az, asx + 0.15, 0.2, asz + 0.15); }
    const rr = Math.tan((40 * PI) / 180) * (asz / 2);
    b.box(wall, ax, 12.6 + rr * 0.5, az, 1.8, 2.6, 1.8);
    b.cone('roof_copper', ax, 15.2 + rr * 0.5, az, 1.45, 2.6, { seg: 4, exact: true, ry: PI / 4 });
    if (b.d >= 1) { const [px, pz] = b.face(ax, az, 1.8, 1.8, 'front').at(0, 0.04); b.g('paint_white', new THREE.CylinderGeometry(0.6, 0.6, 0.08, b.seg(14)).rotateX(HP), px, 13.9 + rr * 0.5, pz, {}); }
    b.sign(A.f.front, 0, 3.75, asx - 2, 0.6, { bg: 'paint_white', logo: b.pick(LOGO) });
    b.take(ax, az, asx, asz, 0.3);
    if (wide) { const p = b.plan.find(8.2, 8.2, { prefer: 'right', pad: 0 }); if (p) waterTower(b, p[0], p[1], 12, { shaft: 'concrete', head: 'concrete_panel', roofMat: 'roof_metal_grey' }); }
  }
  b.putTruck({ type: 'semi', load: 'box' }, { prefer: 'front' });
  if (!deep && !wide) b.putVan({ prefer: 'front' });
  b.lamp(-X + 0.5, Z - 0.5, 6);
}

// Hochregallager: fensterloser hoher Block mit Logoband und flacher Versandhalle mit Rampen
function hochregallager(b) {
  const { W, X, Z, wide, deep } = geom(b);
  b.lot('asphalt');
  const wall = b.pick(['metal_panel_white', 'metal_panel_grey', 'metal_panel_blue', 'metal_corrugated']);
  const logo = b.pick(LOGO);
  const tsx = wide ? 10.5 : W - 1.4, tsz = deep ? 9 : 5.4;
  const tx = wide ? -X + 0.7 + tsx / 2 : 0, tz = -Z + 0.6 + tsz / 2, th = 22 + b.L * 3;
  const T = b.hall({ x: tx, z: tz, sx: tsx, sz: tsz, h: th, wall, roof: 'flat', roofMat: 'roof_flat_membrane', bay: 3, ribMat: 'metal_dark', ribDepth: 0.1, plinthH: 1.0, parapet: 0.6 });
  b.take(tx, tz, tsx, tsz, 0.3);
  for (const s of ['front', 'left', 'right', 'back']) {
    b.fbox(logo, T.f[s], 0, th - 4.5, T.f[s].len + 0.02, 2.2, 0.04, 0.17);
    if (b.d >= 1) b.fbox('metal_panel_white', T.f[s], 0, th - 4.8, T.f[s].len + 0.02, 0.3, 0.04, 0.17);
  }
  b.sign(T.f.front, 0, th - 8.0, Math.min(tsx - 1.5, 8), 2.0, { logo });
  b.roofRail(tx, th + 0.6, tz, tsx, tsz);
  b.light(tx, th + 0.8, tz, 0xff3020, 0.25);
  if (wide) {
    const vsx = W - tsx - 1.6, vx = X - 0.6 - vsx / 2, vsz = tsz - 1, vz = tz + 0.5;
    const V = b.hall({ x: vx, z: vz, sx: vsx, sz: vsz, h: 7, wall: 'metal_panel_white', roof: 'flat', roofMat: 'roof_flat_membrane', ribs: false, plinthH: 1.2 });
    b.take(vx, vz, vsx, vsz, 0.3);
    const n = Math.max(1, Math.floor(vsx / 3.6)), docks = [];
    for (let i = 0; i < n; i++) { const a = -vsx / 2 + (i + 0.5) * (vsx / n); docks.push(a); b.dockDoor(V.f.front, a, { w: 2.6, h: 2.9, pad: deep }); }
    if (b.d >= 1) b.box('metal_corrugated', (tx + tsx / 2 + vx - vsx / 2) / 2, 7.5, tz, vx - vsx / 2 - tx - tsx / 2 + 0.2, 2.5, 2.5);
    if (deep) dockTrucks(b, V.f.front, docks, { type: 'rigid', load: 'box', logo });
  } else {
    const n = Math.max(1, Math.floor(tsx / 3.6)), docks = [];
    for (let i = 0; i < n; i++) { const a = -tsx / 2 + (i + 0.5) * (tsx / n); docks.push(a); b.dockDoor(T.f.front, a, { w: 2.6, h: 2.9, pad: deep }); }
    if (deep) dockTrucks(b, T.f.front, docks, { type: 'rigid', load: 'box', logo });
  }
  if (!deep) b.putVan({ prefer: 'front' });
  b.fenceLot(0, 0, W - 0.3, b.D - 0.3, { gate: 6, ga: wide ? 4 : 0 });
  b.lamp(-X + 0.5, Z - 0.5, 10);
}

// Zulieferwerk: lange Hallen, verglaste Verbindungsbrücke, Abluftkamine, Autotransporter
function zulieferer(b) {
  const { W, X, Z, wide, deep } = geom(b);
  b.lot('asphalt');
  const wall = b.pick(['metal_panel_grey', 'metal_panel_white', 'metal_panel_blue', 'concrete_panel']);
  const accent = b.pick(['paint_blue', 'paint_red', 'paint_white', 'metal_dark']);
  const h1 = 9, sx = W - 1.2, sz1 = deep ? 7 : 5.0;
  const z1 = -Z + 0.6 + sz1 / 2, zf1 = z1 + sz1 / 2;
  const A = b.hall({ x: 0, z: z1, sx, sz: sz1, h: h1, wall, roof: 'flat', roofMat: 'roof_flat_membrane', bay: 4, ribMat: accent === 'paint_white' ? 'metal_dark' : accent, plinthH: 0.8 });
  b.take(0, z1, sx, sz1, 0.3);
  b.band(A.f.left, -sz1 / 2 + 0.6, sz1 / 2 - 0.6, 5.5, 1.8, {});
  b.band(A.f.right, -sz1 / 2 + 0.6, sz1 / 2 - 0.6, 5.5, 1.8, {});
  b.band(A.f.front, -sx / 2 + 0.8, sx / 2 - 0.8, 5.5, 1.8, {});
  const nst = wide ? 4 : 2;
  for (let i = 0; i < nst; i++) {
    const px = -sx / 2 + 2 + i * ((sx - 4) / Math.max(1, nst - 1)), pz = z1 - 0.5;
    b.cyl('metal_light', px, h1, pz, 0.45, 7, { seg: 10 });
    if (b.d >= 1) b.cyl('metal_dark', px, h1 + 6.5, pz, 0.55, 0.5, { seg: 10 });
    b.smoke(px, h1 + 7.2, pz, 'steam', 0.4);
  }
  b.vents(0, h1 + 0.1, z1 + 1, sx * 0.6, sz1 * 0.3, 2);
  if (deep) {
    const sx2 = wide ? sx - 4 : sx, sz2 = 5.0, z2 = zf1 + 3.6 + sz2 / 2, x2 = wide ? -2 : 0;
    const B2 = b.hall({ x: x2, z: z2, sx: sx2, sz: sz2, h: 6.5, wall: 'metal_panel_white', roof: 'flat', roofMat: 'roof_flat_membrane', ribs: false, plinthH: 0.6 });
    b.take(x2, z2, sx2, sz2, 0.3);
    b.band(B2.f.front, -sx2 / 2 + 0.8, sx2 / 2 - 0.8, 3.0, 1.6, {});
    b.sign(B2.f.front, 0, 5.0, 6, 0.9, { logo: accent === 'metal_dark' ? b.pick(LOGO) : accent });
    const bx = -sx / 4;
    b.box('metal_dark', bx, 4.5, zf1 + 1.8, 2.8, 0.3, 3.7);
    b.box('glass_window', bx, 4.8, zf1 + 1.8, 2.6, 2.2, 3.7, 0, b.r());
    b.box('metal_dark', bx, 7.0, zf1 + 1.8, 2.8, 0.25, 3.7);
    b.take(0, zf1 + 1.8, sx, 3.4, 0);
    if (wide) { const p = b.plan.find(2.8, 16.6, { prefer: 'right', pad: 0.1 }); if (p) carCarrier(b, p[0], p[1], PI); }
  } else {
    b.dockDoor(A.f.front, -sx / 4, { w: 2.8, h: 3, pad: false });
    if (wide) { b.dockDoor(A.f.front, sx / 4, { w: 2.8, h: 3, pad: false }); carCarrier(b, 0, Z - 1.8, HP); }
    else b.putVan({ prefer: 'front' }, 'paint_white');
  }
  b.fenceLot(0, 0, W - 0.3, b.D - 0.3, { gate: 6, ga: 0 });
  b.lamp(-X + 0.5, Z - 0.5, 9);
}

// Papierfabrik: Maschinenhalle mit Dampfhauben, Kesselhaus mit Schornstein, Papierrollen, Hackschnitzel
function papierfabrik(b) {
  const { W, X, Z, wide, deep } = geom(b);
  b.lot('concrete');
  const wall = b.pick(['metal_corrugated', 'metal_panel_grey', 'concrete_panel', 'metal_corrugated_green']);
  const kw = 4.4, sx = W - 1.2, sz = deep ? 8 : 5.2;
  const z = -Z + 0.6 + sz / 2, zf = z + sz / 2;
  const H = b.hall({ x: 0, z, sx, sz, h: 11, wall, roof: 'gable', roofMat: 'roof_metal_grey', pitch: 8, ridge: 'x', bay: 5, plinthH: 1.0 });
  b.take(0, z, sx, sz, 0.3);
  b.band(H.f.front, -sx / 2 + 0.8, sx / 2 - 0.8, 7.2, 2.0, {});
  b.band(H.f.back, -sx / 2 + 0.8, sx / 2 - 0.8, 7.2, 2.0, {});
  b.rollerDoor(H.f.front, sx / 2 - 2.4, 3.2, 4.2, {});
  const nh = wide ? 3 : 2;
  for (let i = 0; i < nh; i++) {
    const px = -sx / 2 + (i + 0.5) * (sx / nh);
    b.box('metal_light', px, 11.6, z, 1.4, 2.4, 1.4);
    if (b.d >= 1) b.box('metal_dark', px, 14.0, z, 1.7, 0.2, 1.7);
    b.smoke(px, 14.4, z, 'steam', 1.2);
  }
  const kd = deep ? 5 : 3.2, kx = -X + 0.6 + kw / 2, kz = zf + kd / 2 + 0.2;
  b.hall({ x: kx, z: kz, sx: kw, sz: kd, h: 14, wall: 'brick_red', roof: 'flat', roofMat: 'roof_flat_gravel', ribs: true, bay: 2.2, ribMat: 'brick_dark', plinthH: 0.8 });
  b.winRow(b.face(kx, kz, kw, kd, 'front'), -1.2, 1.2, 6, 0.9, 5, { spacing: 2.2, arch: 'brick_dark' });
  b.chimney(kx + 0.6, kz, { type: 'steel', h: 34, r: 0.9, smoke: 1.0, kind: 'steam', mat: 'metal_light' });
  b.take(kx, kz, kw, kd, 0.3);
  const nr = wide ? 6 : 3, rc = Math.min(nr, 3), rr = Math.ceil(nr / 3);
  const rp = b.plan.find(rc * 2.2, rr * 2.2, { prefer: 'front', pad: 0.2 });
  if (rp) for (let i = 0; i < nr; i++) {
    const px = rp[0] + ((i % 3) - (rc - 1) / 2) * 2.2, pz = rp[1] + (Math.floor(i / 3) - (rr - 1) / 2) * 2.2;
    b.cyl('canvas_white', px, 0, pz, 0.95, 2.4, { seg: 14 });
    if (b.d >= 2) b.cyl('metal_dark', px, 2.4, pz, 0.25, 0.02, { seg: 8 });
  }
  if (wide) {
    const p = b.plan.find(7.0, 7.0, { prefer: 'right', pad: 0 });
    if (p) { b.cone('log_wood', p[0], 0, p[1], 3.3, 4.2, { seg: 10 }); b.conveyor([p[0], 4.0, p[1]], [p[0], 9.5, zf - 0.3], { w: 1.0 }); }
  }
  if (deep) b.putTruck({ type: 'semi', load: 'tarp' }, { prefer: 'front' });
  b.fenceLot(0, 0, W - 0.3, b.D - 0.3, { gate: 6, ga: wide ? 2 : 1 });
  b.lamp(X - 0.5, Z - 0.5, 9);
}

// =====================================================================================
// Stufe 5 – Hightech
// =====================================================================================

// Hightech-Fabrik mit Solardach, Glaskubus-Eingang und Grünanlage
function solarfabrik(b) {
  const { W, X, Z, wide, deep } = geom(b);
  b.lot('grass', 0.1);
  const accent = b.pick(['paint_blue', 'paint_green', 'container_blue', 'paint_orange']);
  const sx = W - 2.0, sz = deep ? 11 : 5.4;
  const z = -Z + 0.8 + sz / 2, zf = z + sz / 2;
  const H = b.hall({ x: 0, z, sx, sz, h: 8.5, wall: 'metal_panel_white', roof: 'flat', roofMat: 'roof_flat_membrane', ribs: false, plinthH: 0.4, parapet: 0.5, coping: 'metal_dark' });
  b.take(0, z, sx, sz, 0.3);
  for (const s of ['front', 'left', 'right', 'back']) {
    b.fbox(accent, H.f[s], 0, 0.4, H.f[s].len + 0.02, 0.7, 0.04, 0.02);
    b.band(H.f[s], -H.f[s].len / 2 + 0.5, H.f[s].len / 2 - 0.5, 5.6, 1.6, { glass: 'glass_curtain_blue', part: 4 });
  }
  b.solar(0, 8.6, z, sx - 1.4, sz - 1.4, { rowD: 2.4 });
  const gw = wide ? 5 : 3.6, gd = deep ? 4 : 2.6, gx = sx / 2 - gw / 2 - 0.6, gz = zf + gd / 2;
  b.box('metal_dark', gx, 0, gz, gw + 0.2, 0.2, gd + 0.2);
  b.box('glass_curtain_blue', gx, 0.2, gz, gw, 6.8, gd, 0, b.r());
  b.box('metal_panel_white', gx, 7.0, gz, gw + 0.4, 0.5, gd + 0.4);
  if (b.d >= 2) for (let i = 1; i < Math.round(gw / 1.25); i++) b.box('metal_dark', gx - gw / 2 + i * 1.25, 0.2, gz + gd / 2 + 0.01, 0.08, 6.8, 0.06);
  b.take(gx, gz, gw, gd, 0.3);
  b.sign(H.f.front, -sx / 4, 6.0, Math.min(7, sx / 2), 1.2, { logo: accent, disc: true });
  b.ground('pavers', gx, (gz + gd / 2 + Z) / 2, 2.4, Z - gz - gd / 2, 0.12);
  b.take(gx, (gz + gd / 2 + Z) / 2, 2.4, Z - gz - gd / 2, 0);
  if (deep) putParking(b, W / 2, 5.0, { prefer: 'front', fill: 0.6 });
  if (b.d >= 2) { const p = b.plan.find(4.8, 1.2, { prefer: 'front' }); if (p) b.flags(p[0], p[1], 3, 0); }
  for (let i = 0; i < (wide ? 4 : 2) + (deep ? 2 : 0); i++) b.putTree(0.85, i % 2 ? 'pappel' : 'laub', { prefer: i % 2 ? 'left' : 'right' });
  b.lamp(X - 0.6, -Z + 1, 6);
}

// Chipfabrik (Reinraum): großer weißer Block mit Lüftungstechnik auf dem Dach, Gastanks, Glasbüro
function chipfabrik(b) {
  const { W, X, Z, wide, deep } = geom(b);
  b.lot('concrete', 0.1);
  const sx = W - 1.4, sz = deep ? 11 : 5.6;
  const z = -Z + 0.7 + sz / 2, zf = z + sz / 2, h = 14;
  const H = b.hall({ x: 0, z, sx, sz, h, wall: 'metal_panel_white', roof: 'flat', roofMat: 'roof_flat_membrane', bay: 3, ribMat: 'metal_light', ribDepth: 0.08, plinthH: 0.6, parapet: 0.4 });
  b.take(0, z, sx, sz, 0.3);
  b.band(H.f.left, -sz / 2 + 0.6, sz / 2 - 0.6, 10.5, 1.2, { glass: 'glass_curtain_dark', part: 5 });
  b.band(H.f.right, -sz / 2 + 0.6, sz / 2 - 0.6, 10.5, 1.2, { glass: 'glass_curtain_dark', part: 5 });
  const nx = Math.max(1, Math.floor((sx - 2) / 3.2)), nz = Math.max(1, Math.floor((sz - 2) / 3.6));
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    if (b.d === 0 && (i + j) % 2) continue;
    b.hvac(-sx / 2 + 1.6 + (i + 0.5) * ((sx - 3.2) / nx), h, z - sz / 2 + 1.5 + (j + 0.5) * ((sz - 3) / nz), 1.1, HP);
  }
  if (b.d >= 1) {
    b.box('metal_light', 0, h, z, sx - 2, 0.8, 0.9);
    for (let i = 0; i < (wide ? 4 : 2); i++) b.cyl('metal_light', -sx / 2 + 2 + i * 3.2, h, z + sz / 2 - 1, 0.35, 4.5, { seg: 8 });
  }
  const osx = wide ? 9 : W - 4.0, osz = deep ? 4.4 : 2.8, ox = -X + 0.7 + osx / 2, oz = zf + osz / 2 - 0.05, fl = deep ? 3 : 2;
  b.box('glass_curtain_blue', ox, 0, oz, osx, fl * 3.2, osz, 0, b.r());
  if (b.d >= 1) for (let k = 1; k <= fl; k++) b.box('metal_panel_white', ox, k * 3.2 - 0.25, oz, osx + 0.2, 0.3, osz + 0.2);
  if (b.d >= 2) { const n = Math.round(osx / 1.5); for (let i = 0; i <= n; i++) b.box('metal_dark', ox - osx / 2 + (i * osx) / n, 0, oz + osz / 2 + 0.02, 0.08, fl * 3.2, 0.06); }
  b.sign(b.face(ox, oz, osx, osz, 'front'), 0, fl * 3.2 - 1.2, Math.min(osx - 1, 6), 0.9, { logo: b.pick(LOGO), disc: true });
  b.take(ox, oz, osx, osz, 0.3);
  for (let i = 0; i < (wide ? 2 : 1); i++) { const p = b.plan.find(2.0, 2.0, { prefer: 'right', pad: 0.2 }); if (p) b.silo(p[0], p[1], 0.9, 8, { mat: 'tank_white', top: 'dome', ladder: false }); }
  if (deep) putParking(b, W / 2 - 0.5, 5.0, { prefer: 'front', fill: 0.75 });
  b.box('grass', 0, 0, Z - 0.35, W - 0.4, 0.12, 0.5);
  b.fenceLot(0, 0, W - 0.3, b.D - 0.3, { gate: 6, ga: wide ? 4 : 1.5, h: 2.4 });
  b.lamp(-X + 0.5, -Z + 0.5, 7);
}

// Rechenzentrum: dunkler Block mit Lamellen, Kältemaschinen, Notstromaggregate mit Abgasrohren
function rechenzentrum(b) {
  const { W, X, Z, wide, deep } = geom(b);
  b.lot('asphalt_dark', 0.1);
  const wall = b.pick(['metal_panel_grey', 'concrete_dark', 'metal_dark', 'metal_panel_grey']);
  const sx = W - 1.4, sz = deep ? 10 : 5.4;
  const z = -Z + 0.7 + sz / 2, zf = z + sz / 2, h = 10;
  const H = b.hall({ x: 0, z, sx, sz, h, wall, roof: 'flat', roofMat: 'roof_flat_membrane', bay: 1.2, ribMat: 'metal_light', ribDepth: 0.22, plinthH: 0.5, parapet: 1.5, parMat: 'metal_panel_white' });
  b.take(0, z, sx, sz, 0.3);
  for (const s of ['front', 'left', 'right']) b.fbox('emissive_cool', H.f[s], 0, 2.2, H.f[s].len - 0.4, 0.18, 0.05, 0.25);
  const nx = Math.max(1, Math.floor((sx - 1.5) / 2.6));
  for (let i = 0; i < nx; i++) for (let j = 0; j < (deep ? 2 : 1); j++) {
    const px = -sx / 2 + 1.0 + (i + 0.5) * ((sx - 2) / nx), pz = deep ? z - sz / 4 + j * (sz / 2) : z;
    b.box('metal_light', px, h + 0.2, pz, 2.2, 1.6, 2.6);
    if (b.d >= 2) for (const t of [-0.6, 0.6]) b.cyl('metal_dark', px, h + 1.8, pz + t, 0.5, 0.1, { seg: 10 });
  }
  const ex = sx / 2 - 2.0, ez = zf + 1.4;
  b.box('glass_curtain_dark', ex, 0, ez, 3.0, 3.4, 2.6, 0, b.r());
  b.box('metal_dark', ex, 3.4, ez, 3.4, 0.3, 3.0);
  b.take(ex, ez, 3.0, 2.6, 0.3);
  b.sign(H.f.front, -sx / 4, h - 2.4, 4, 0.9, { logo: b.pick(['paint_blue', 'container_blue', 'paint_green']) });
  for (let i = 0; i < (wide ? 2 : 1) + (deep ? 1 : 0); i++) b.put(6.1, 2.5, { prefer: 'front' }, (px, pz, ry) => {
    b.container(px, 0.2, pz, ry, false, 'metal_panel_white');
    const s = Math.sin(ry), c = Math.cos(ry);
    b.cyl('metal_light', px + s * 2.2, 2.8, pz + c * 2.2, 0.22, 3.2, { seg: 8 });
  });
  if (deep) putParking(b, W / 2 - 0.5, 5.0, { prefer: 'front', fill: 0.4 });
  b.fenceLot(0, 0, W - 0.3, b.D - 0.3, { gate: 4, ga: X / 2, h: 2.8 });
  b.lamp(-X + 0.5, Z - 0.5, 8);
  b.lamp(X - 0.5, -Z + 0.5, 8);
}

// Biotech-Werk: weißes Laborgebäude mit Lamellen, Edelstahltanks, Gründach
function biotech(b) {
  const { W, D, X, Z, wide, deep } = geom(b);
  b.lot('grass', 0.1);
  const glass = b.pick(['glass_curtain_green', 'glass_curtain_blue']);
  const lsx = W - 1.4, lsz = deep ? 6 : 4.0, lz = Z - 1.4 - lsz / 2;
  const fl = deep ? 4 : 3, fh = 3.4, lh = fl * fh;
  b.box(glass, 0, 0, lz, lsx - 0.6, lh, lsz - 0.6, 0, b.r());
  for (let k = 0; k <= fl; k++) b.box('metal_panel_white', 0, k * fh - (k ? 0.3 : 0), lz, lsx, 0.3 + (k === fl ? 0.4 : 0), lsz);
  if (b.d >= 1) { const n = Math.round(lsx / 1.1); for (let i = 0; i <= n; i++) b.box('metal_panel_white', -lsx / 2 + (i * lsx) / n, 0, lz + lsz / 2 - 0.15, 0.14, lh, 0.5); }
  b.box('green_roof', 0, lh + 0.4, lz, lsx - 0.6, 0.15, lsz - 0.6);
  b.entrance(b.face(0, lz, lsx, lsz, 'front'), -lsx / 4, 2.4, 2.6, { glass, canopy: 'metal_panel_white', canopyD: 1.0 });
  b.sign(b.face(0, lz, lsx, lsz, 'front'), lsx / 4, lh - 0.8, Math.min(lsx / 2 - 1, 5), 0.8, { logo: b.pick(LOGO), disc: true });
  b.take(0, lz, lsx, lsz, 0.3);
  const hsz = D - lsz - 2.4 - (deep ? 4.4 : 0.4), hz = -Z + 0.6 + hsz / 2, hsx = wide ? W / 2 - 0.8 : W - 1.4, hx = wide ? -X + 0.6 + hsx / 2 : 0;
  if (hsz > 3) {
    const Hh = b.hall({ x: hx, z: hz, sx: hsx, sz: hsz, h: 8, wall: 'metal_panel_white', roof: 'flat', roofMat: 'green_roof', ribs: false, plinthH: 0.3, parapet: 0.6 });
    b.band(Hh.f.left, -hsz / 2 + 0.5, hsz / 2 - 0.5, 4.5, 1.6, { glass });
    b.band(Hh.f.back, -hsx / 2 + 0.5, hsx / 2 - 0.5, 4.5, 1.6, { glass });
    b.take(hx, hz, hsx, hsz, 0.3);
  }
  const tc = wide ? 3 : 1, tr = deep ? 2 : 1;
  const tp = b.plan.find(tc * 2.4, tr * 2.6, { prefer: 'right', pad: 0.2 });
  if (tp) {
    for (let i = 0; i < tc; i++) for (let j = 0; j < tr; j++) b.silo(tp[0] + (i - (tc - 1) / 2) * 2.4, tp[1] + (j - (tr - 1) / 2) * 2.6, 0.95, 6 + ((i + j) % 2), { mat: 'metal_light', top: 'dome', legs: 1.2, ladder: false });
    if (b.d >= 1 && tc > 1) b.box('metal_dark', tp[0], 7.6, tp[1], tc * 2.4, 0.2, Math.max(1.2, tr * 2.6 - 1.2));
  }
  const sp = b.plan.find(1.0, 1.0, { prefer: 'back', pad: 0.2 });
  if (sp) { b.cyl('metal_light', sp[0], 0, sp[1], 0.3, 12, { seg: 8 }); b.smoke(sp[0], 12.5, sp[1], 'steam', 0.3); }
  b.ground('pavers', -lsx / 4, Z - 0.7, 3, 1.4, 0.12);
  for (let i = 0; i < (wide ? 3 : 1); i++) b.putTree(0.7, 'laub', { prefer: 'front' });
  b.lamp(-X + 0.5, Z - 0.5, 5);
}

// Technologiepark: Pavillons mit Lamellen, Glasbrücke, Innenhof, Solar-Carport
function techpark(b) {
  const { W, X, Z, wide, deep } = geom(b);
  b.lot('grass', 0.1);
  const glass = b.pick(['glass_curtain_blue', 'glass_curtain_green', 'glass_window']);
  const skin = b.pick(['wood_planks', 'metal_panel_white', 'concrete_panel', 'wood_dark']);
  const pav = (x, z, sx, sz, fl) => {
    const h = fl * 3.4;
    b.box(glass, x, 0, z, sx - 0.4, h, sz - 0.4, 0, b.r());
    for (let k = 1; k <= fl; k++) b.box(skin, x, k * 3.4 - 0.4, z, sx, 0.4 + (k === fl ? 0.3 : 0), sz);
    if (b.d >= 1) {
      const n = Math.max(2, Math.round(sx / 1.6));
      for (let i = 0; i <= n; i++) for (const s of [-1, 1]) b.box(skin, x - sx / 2 + 0.1 + (i * (sx - 0.2)) / n, 0, z + s * (sz / 2 - 0.12), 0.18, h, 0.24);
      const m = Math.max(2, Math.round(sz / 1.6));
      for (let i = 1; i < m; i++) for (const s of [-1, 1]) b.box(skin, x + s * (sx / 2 - 0.12), 0, z - sz / 2 + 0.1 + (i * (sz - 0.2)) / m, 0.24, h, 0.18);
    }
    b.box('green_roof', x, h + 0.3, z, sx - 0.5, 0.12, sz - 0.5);
    if (b.d >= 1) b.solar(x, h + 0.3, z, sx * 0.5, sz * 0.5, { rowD: 2.2 });
    b.take(x, z, sx, sz, 0.4);
    return h;
  };
  const cd = 5.0, cz = Z - 0.4 - cd / 2;
  const avail = b.D - cd - 1.2;
  if (wide && deep) {
    pav(-X / 2 - 0.5, -Z / 2, 8, 8, 3);
    pav(X / 2 + 0.5, -Z / 2 + 1, 7, 6, 2);
    b.box('metal_dark', 0.0, 3.6, -Z / 2 + 0.6, 3.2, 0.25, 2.6);
    b.box(glass, 0.0, 3.85, -Z / 2 + 0.6, 3.2, 2.6, 2.4, 0, b.r());
    b.box(skin, 0.0, 6.45, -Z / 2 + 0.6, 3.4, 0.3, 2.6);
    b.ground('pavers', 0, 2.2, W - 2, 3.4, 0.12);
    if (b.d >= 1) b.cyl('water_pool', -X / 2, 0.12, 2.2, 1.4, 0.08, { seg: 16 });
    b.take(0, 2.2, W - 2, 3.4, 0);
  } else if (wide) {
    pav(-X / 2, -Z + 0.6 + avail / 2, 8, avail, 3);
    pav(X / 2 + 0.5, -Z + 0.6 + avail / 2, 7, avail, 2);
    b.box(glass, 0.2, 3.6, -Z + 0.6 + avail / 2, 3.2, 2.6, 2.2, 0, b.r());
    b.box(skin, 0.2, 6.2, -Z + 0.6 + avail / 2, 3.4, 0.3, 2.4);
  } else if (deep) {
    pav(0, -Z + 0.6 + 4, W - 2, 8, 3);
    pav(0, -Z + 0.6 + 8 + 2.2 + 2.0, W - 3, 4.0, 2);
    b.box(glass, 0, 3.6, -Z + 0.6 + 9.1, 2.2, 2.6, 2.6, 0, b.r());
    b.box(skin, 0, 6.2, -Z + 0.6 + 9.1, 2.4, 0.3, 2.8);
  } else pav(0, -Z + 0.6 + avail / 2, W - 2.0, avail, 3);
  const ncol = wide ? 4 : 2;
  if (b.d >= 1) for (let i = 0; i < ncol; i++) b.box('metal_dark', -X + 1.2 + (i * (W - 2.4)) / (ncol - 1), 0, cz - 1.2, 0.2, 2.5, 0.2);
  b.boxc('solar_panel', 0, 2.75, cz, W - 1.6, 0.12, cd - 0.4, { rx: 0.08 });
  b.take(0, cz, W - 1, cd, 0);
  const nc = Math.floor((W - 1.6) / 2.6);
  for (let i = 0; i < nc; i++) if (b.r() < 0.75) b.car(-X + 0.8 + 1.3 + i * 2.6, cz, b.r() < 0.5 ? 0 : PI, b.pick(CAR));
  for (let i = 0; i < (wide ? 3 : 1); i++) b.putTree(0.7, 'laub', { prefer: 'center' });
  b.lamp(X - 0.5, 0, 5);
}

// E-Werk (Batteriefabrik): Sheddach mit Photovoltaik auf den Schrägen, Farbbänder, Ladepark
function eWerk(b) {
  const { W, X, Z, wide, deep } = geom(b);
  b.lot('asphalt', 0.1);
  const accent = b.pick(['paint_green', 'container_green', 'paint_blue', 'leaves_light']);
  const sx = W - 2.6, sz = deep ? 11 : 5.6;
  const z = -Z + 0.7 + sz / 2;
  const H = b.hall({ x: -0.5, z, sx, sz, h: 9, wall: 'metal_panel_white', roof: 'saw', roofMat: 'solar_panel', teeth: Math.max(2, Math.round(sz / 3.6)), toothH: 2.4, sawGlass: 'glass_skylight', bay: 4.5, ribMat: 'metal_light', plinthH: 0.5 });
  b.take(-0.5, z, sx, sz, 0.3);
  for (const s of ['front', 'left', 'right', 'back']) {
    b.fbox(accent, H.f[s], 0, 1.2, H.f[s].len + 0.02, 0.5, 0.04, 0.17);
    b.band(H.f[s], -H.f[s].len / 2 + 0.6, H.f[s].len / 2 - 0.6, 5.2, 2.0, { glass: 'glass_window', part: 4 });
  }
  b.dockDoor(H.f.right, 0, { w: 3, h: 3, pad: false });
  b.take(-0.5 + sx / 2 + 0.5, z, 1.0, 4.6, 0);
  b.sign(H.f.front, 0, 7.5, Math.min(9, sx - 2), 1.1, { logo: accent, disc: true });
  const pd = deep ? 5.2 : Math.min(4.0, Z - (z + sz / 2) - 0.5);
  const pz = Z - 0.4 - pd / 2;
  b.parking(0, pz, W - 1.2, pd, { fill: 0.6, front: !deep });
  b.take(0, pz, W - 1.2, pd, 0);
  if (b.d >= 2) for (let i = 0; i < (wide ? 6 : 3); i++) b.box('paint_white', -X + 1.6 + i * 2.5, 0.1, pz - pd / 2 + 0.3, 0.35, 1.5, 0.3);
  for (let i = 0; i < (wide ? 2 : 1); i++) b.putTree(0.6, 'busch', { prefer: 'right' });
  b.lamp(X - 0.5, Z - 0.5, 7);
}

export const IND = {
  1: [werkstatt, schuppenhof, tischlerei, mietlager, ziegelwerkstatt, baustoffhandel],
  2: [lagerhalle, metallbau, spedition, kleinfabrik, muehle, gewerbehalle],
  3: [backsteinfabrik, brauerei, giesserei, kunststoffwerk, betonwerk, logistik],
  4: [chemiewerk, zementwerk, fabrikkomplex, hochregallager, zulieferer, papierfabrik],
  5: [solarfabrik, chipfabrik, rechenzentrum, biotech, techpark, eWerk],
};

export function buildInd(ctx) {
  const b = new B(ctx);
  const list = IND[clamp(ctx.level, 1, 5)];
  list[ctx.variant % list.length](b);
  return b.finish();
}
