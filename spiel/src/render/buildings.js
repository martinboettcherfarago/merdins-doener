// Gebäude-Renderer. Besitzer: G9.
//
// Jedes Gebäude der Simulation wird aus einem Prototyp (Architektur-Baustein aus arch/*.js oder Ersatzmodell
// aus dem Baukasten, siehe unten) dargestellt:
//  • Detailstufen: 2 = nah, 1 = mittel (instanziert pro Prototyp), 0 = fern (statisch gebündelt pro
//    Kartenabschnitt, siehe protos.js/Batcher). Die Stufen werden alle 0,3 s nach Kameraabstand neu verteilt
//    (mit Hysterese und Obergrenzen); teure Prototypen werden mit Zeitbudget nachgebaut.
//  • Baustellen: Gebäude wächst Geschoss für Geschoss (Schnitthöhe im Shader) mit Betondecke, Gerüst mit
//    Netzen (bei Hochhäusern als Klettergerüst), Bauzaun mit Tor, Baucontainer, Material, Baukran mit
//    schwenkendem Ausleger und Staub.
//  • Abriss: Gebäude sackt wackelnd in sich zusammen, Staubwolke.
//  • Zustände: verlassen (verwittert, Fenster dunkel), brennend (verkohlt, Feuerschein in den Fenstern),
//    ohne Strom (Fenster und Leuchtschilder dunkel), Einfärbung für Infoansichten.
//  • res.anim-Teile drehen bzw. schwingen, res.lights leuchten nachts, res.emitters rauchen (effects.js).
// Öffentlich: add(b), update(b), remove(b), frame(dt, time, night), setTint(fn), heightOf(b), stats(),
//   emitters (Map id → [{x, y, z, type, amount}]), constructing (Set), protoMgr, root.
import * as THREE from 'three';
import { Z, BUILDINGS, TRANSIT } from '../config.js';
import { mulberry32 } from '../util.js';
import { shared, makeGlowTexture, makePointsMaterial, PointBuffer } from './materials.js';
import { ProtoManager, Batcher, InstSet, prepareModel, states, SLOT_HIDDEN } from './protos.js';
import { ARCH, buildArch, archKeyFor, frontFootprint } from './arch/all.js';
import { getMaterial } from './matlib.js';
import { Kit, M, FLOOR, pick, range } from './arch/kit.js';

const COS = [1, 0, -1, 0], SIN = [0, 1, 0, -1];
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const LOD_TICK = 0.3;
const LOD_NEAR = 12.5, LOD_MID = 25; // Kameraabstand für Detail 2 bzw. 1 (Qualität „medium")
const LOD_SCALE = { low: 0.65, medium: 1, high: 1.3, ultra: 1.7 };
const MAX_D2 = 70, MAX_D1 = 160; // höchstens so viele Gebäude in Detail 2 bzw. ≥ 1
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const approach = (v, t, d) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));

// =====================================================================================================
// Ersatzmodelle: schlichte, ordentliche Modelle aus dem Baukasten für alles ohne eigenen Baustein.
// =====================================================================================================
const FB = {};
function fb(keys, variants, build) { for (const k of keys.split(/\s+/)) if (k) FB[k] = { variants, build }; }
export function fallbackVariants(key) { return (FB[key] || FB['@' + (BUILDINGS[key] && BUILDINGS[key].cat)] || FB['@generic']).variants; }
export function buildFallback(key, level, variant, fw, fd, extra = {}, detail = 2) {
  const def = FB[key] || FB['@' + (BUILDINGS[key] && BUILDINGS[key].cat)] || FB['@generic'];
  const v = ((variant % def.variants) + def.variants) % def.variants;
  const rng = mulberry32((v + 1) * 7919 + level * 104729 + fw * 13 + fd * 131 + key.length * 977 + 4243);
  const kit = new Kit(rng, detail);
  const ctx = { key, level, variant: v, fw, fd, W: fw, D: fd, rng, kit, M, FLOOR, detail, zone: 0, spec: null, ...extra };
  const res = def.build(ctx);
  if (res && res.meshes) return res;
  return kit.build();
}

// ---------- Hilfen
const D2 = (c) => c.detail >= 2;
function ground(kit, W, D, mat = 'grass', inset = 0.025) { kit.box(mat, 0, 0, 0, W - inset * 2, 0.05 * M, D - inset * 2); }
function pad(kit, mat, x, z, w, d, y = 0.05 * M) { kit.box(mat, x, 0, z, w, y + 0.03 * M, d); }
// Baukörper mit Sockel und Fenstern; gibt Oberkante zurück
function body(kit, x, z, w, d, floors, wall, o = {}) {
  const fh = o.fh || FLOOR, y0 = o.y0 || 0, h = floors * fh;
  kit.box(wall, x, y0, z, w, h, d);
  if (y0 === 0 && o.plinth !== false) kit.box(o.plinth || 'concrete_dark', x, 0, z, w + 0.12 * M, 0.45 * M, d + 0.12 * M);
  if (o.windows !== false) {
    const wo = { frame: o.frame || 'window_frame_white', glass: o.glass, spacing: o.spacing, winW: o.winW, winH: o.winH, sill: o.sill, skipGround: o.skipGround, shutters: o.shutters, margin: o.margin };
    for (const s of o.sides || ['front', 'back', 'left', 'right']) kit.windows(s, x, z, w, d, y0, floors, fh, wo);
  }
  if (o.cornice) kit.band(o.cornice, x, z, w, d, y0 + h - 0.3 * M, 0.3 * M, 0.12 * M);
  return y0 + h;
}
function roof(kit, type, mat, x, y, z, w, d, o = {}) {
  if (type === 'gable') {
    const rh = o.h ?? Math.min(w, d) * 0.36;
    kit.gableRoof(mat, x, y, z, w, d, rh, { ridge: o.ridge, overhang: o.ov ?? 0.4 * M });
    kit.gableEnds(o.wall || 'plaster_white', x, y, z, w, d, rh, { ridge: o.ridge });
    return y + rh;
  }
  if (type === 'hip') { const rh = o.h ?? Math.min(w, d) * 0.32; kit.hipRoof(mat, x, y, z, w, d, rh, { overhang: o.ov ?? 0.4 * M }); return y + rh; }
  if (type === 'shed') { const rh = o.h ?? d * 0.18; kit.shedRoof(mat, x, y, z, w, d, rh); return y + rh; }
  if (type === 'saw') { kit.sawtoothRoof(mat, o.glass || 'glass_skylight', x, y, z, w, d, o.teeth || Math.max(2, Math.round(d / 0.35)), o.h ?? 0.22); return y + (o.h ?? 0.22); }
  kit.flatRoof(o.top || 'roof_flat_gravel', o.parapet || 'concrete', x, y, z, w, d, { parapet: o.parapetH });
  if (o.clutter) kit.rooftopClutter(x, y, z, w, d, o.clutter);
  return y + 0.6 * M;
}
function sign(kit, mat, x, y, z, w, h, o = {}) {
  const ry = o.ry || 0, dx = Math.sin(ry), dz = Math.cos(ry);
  kit.box('metal_dark', x - dx * 0.02 * M, y - 0.1 * M, z - dz * 0.02 * M, w + 0.2 * M, h + 0.2 * M, 0.12 * M, { ry });
  kit.box(mat, x + dx * 0.06 * M, y, z + dz * 0.06 * M, w, h, 0.1 * M, { ry });
}
// Ladenfront im Erdgeschoss (Front einer Box mit Mitte x/z, Breite w, Tiefe d)
function shopFront(kit, c, x, z, w, d, aw, signMat, o = {}) {
  const zf = z + d / 2, gh = o.gh ?? 3.2 * M;
  kit.box('trim_dark', x, 0, zf + 0.01 * M, w + 0.04 * M, 0.35 * M, 0.12 * M);
  const n = Math.max(1, Math.round(w / (2.6 * M)));
  const pw = (w - 0.4 * M) / n;
  for (let i = 0; i < n; i++) {
    const px = x - w / 2 + 0.2 * M + pw * (i + 0.5);
    if (o.door !== false && i === Math.floor(n / 2)) { kit.box('door_glass', px, 0.1 * M, zf + 0.03 * M, Math.min(pw * 0.8, 1.6 * M), 2.3 * M, 0.06 * M, { lit: 0.99 }); continue; }
    kit.box('glass_shop', px, 0.45 * M, zf + 0.03 * M, pw - 0.25 * M, gh - 0.9 * M, 0.06 * M, { lit: c.rng() });
  }
  if (c.detail >= 1) for (let i = 0; i <= n; i++) kit.box('metal_dark', x - w / 2 + 0.2 * M + pw * i, 0, zf + 0.06 * M, 0.14 * M, gh - 0.3 * M, 0.1 * M);
  kit.box('trim_stone', x, gh - 0.4 * M, zf + 0.04 * M, w + 0.06 * M, 0.35 * M, 0.16 * M);
  if (aw) kit.box(aw, x, gh - 0.55 * M, zf + 0.12 * M, w * 0.92, 0.07 * M, 1.3 * M, { rx: 0.38 });
  if (signMat) sign(kit, signMat, x + (o.signOff || 0), gh - 0.05 * M, zf + 0.12 * M, Math.min(w * 0.6, 5 * M), 0.65 * M);
  if (c.detail >= 2 && o.lamps !== false) kit.light(x, gh - 0.8 * M, zf + 0.8 * M, 0xffd9a0, 0.35);
}
function trees(kit, rng, list, s = 1) { for (const [x, z] of list) kit.tree(x, z, s * range(rng, 0.8, 1.15)); }
function parking(kit, c, x, z, w, d, cars = true) {
  kit.box('asphalt', x, 0, z, w, 0.07 * M, d);
  if (c.detail >= 1) {
    const n = Math.max(1, Math.floor(w / (2.6 * M)));
    for (let i = 0; i <= n; i++) kit.box('runway_marking', x - w / 2 + (i * w) / n, 0.07 * M, z - d / 4, 0.1 * M, 0.01 * M, d * 0.45);
    if (cars && c.detail >= 2) for (let i = 0; i < n; i++) if (c.rng() < 0.6) car(kit, c.rng, x - w / 2 + ((i + 0.5) * w) / n, z - d / 4, Math.PI / 2);
  }
}
function car(kit, rng, x, z, ry = 0) {
  const col = pick(rng, ['paint_red', 'paint_white', 'paint_blue', 'metal_dark', 'metal_light', 'paint_yellow', 'paint_green']);
  const dx = Math.sin(ry), dz = Math.cos(ry);
  kit.box(col, x, 0.25 * M, z, 1.8 * M, 0.7 * M, 4.3 * M, { ry });
  kit.box(col, x - dx * 0.2 * M, 0.95 * M, z - dz * 0.2 * M, 1.6 * M, 0.55 * M, 2.2 * M, { ry });
  kit.box('glass_window', x - dx * 0.2 * M, 1.0 * M, z - dz * 0.2 * M, 1.65 * M, 0.42 * M, 2.0 * M, { ry, lit: 0 });
  kit.box('rubber', x, 0, z, 1.85 * M, 0.35 * M, 3.0 * M, { ry });
}
function truck(kit, rng, x, z, ry = 0) {
  const col = pick(rng, ['paint_white', 'paint_blue', 'paint_red', 'paint_orange']);
  const dx = Math.sin(ry), dz = Math.cos(ry);
  kit.box(col, x + dx * 3.6 * M, 0.4 * M, z + dz * 3.6 * M, 2.4 * M, 2.4 * M, 2.0 * M, { ry });
  kit.box('glass_window', x + dx * 4.62 * M, 1.6 * M, z + dz * 4.62 * M, 2.2 * M, 0.9 * M, 0.06 * M, { ry, lit: 0 });
  kit.box(pick(rng, ['container_red', 'container_blue', 'metal_panel_white', 'container_green']), x - dx * 1.2 * M, 0.5 * M, z - dz * 1.2 * M, 2.5 * M, 2.8 * M, 7 * M, { ry });
  kit.box('rubber', x, 0, z, 2.4 * M, 0.5 * M, 9 * M, { ry });
}
function lamp(kit, c, x, z, h = 4.5 * M) {
  if (c.detail < 2) return;
  kit.cyl('metal_dark', x, 0, z, 0.08 * M, h, { seg: 6 });
  kit.box('emissive_warm', x, h, z, 0.35 * M, 0.2 * M, 0.35 * M);
  kit.light(x, h, z, 0xffd28a, 0.45);
}
function bench(kit, c, x, z, ry = 0) {
  if (c.detail < 2) return;
  kit.box('wood_planks', x, 0.4 * M, z, 1.6 * M, 0.08 * M, 0.45 * M, { ry });
  kit.box('metal_dark', x, 0, z, 1.4 * M, 0.4 * M, 0.08 * M, { ry });
}
function stack(kit, x, z, r, h, mat = 'concrete', o = {}) {
  kit.cyl(mat, x, 0, z, r, h, { rTop: r * (o.taper ?? 0.8), seg: o.seg || 12 });
  if (o.bands) for (let i = 1; i <= o.bands; i++) kit.cyl(o.bandMat || 'paint_white', x, h - i * 0.07 - 0.02, z, r * (o.taper ?? 0.8) * 1.04 + 0.002, 0.035, { seg: o.seg || 12 });
  kit.cyl('concrete_dark', x, h - 0.01, z, r * (o.taper ?? 0.8) * 1.06, 0.02, { seg: o.seg || 12 });
  if (o.smoke !== false) kit.smoke(x, h + 0.02, z, o.steam ? 'steam' : 'smoke', o.amount || 1);
}
function coolingTower(kit, x, z, r, h, seg = 20) {
  if (kit.detail === 0) seg = Math.min(seg, 12);
  const pts = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(r * (0.6 + 0.4 * ((t - 0.7) / 0.7) ** 2), t * h)); }
  kit.add('concrete', new THREE.LatheGeometry(pts, seg), { x, y: 0, z });
  const inner = pts.map((p) => new THREE.Vector2(p.x * 0.94, p.y)).reverse();
  kit.add('concrete_dark', new THREE.LatheGeometry(inner, seg), { x, y: 0, z });
  kit.cyl('concrete_dark', x, 0, z, r * 1.02, 0.4 * M, { seg });
  kit.smoke(x, h, z, 'steam', 2.5);
}
function tank(kit, x, z, r, h, mat = 'tank_white', o = {}) {
  const seg = kit.detail === 0 ? 8 : o.seg || 16;
  kit.cyl(mat, x, 0, z, r, h, { seg });
  if (o.dome !== false) kit.dome(o.domeMat || mat, x, h, z, r, { seg, sy: 0.35 });
  if (o.ring && kit.detail > 0) kit.cyl('metal_dark', x, h * 0.5, z, r * 1.02, 0.15 * M, { seg });
}
function chainFence(kit, c, W, D, o = {}) {
  if (c.detail < 1) return;
  const h = o.h ?? 2 * M, i = o.inset ?? 0.04, mat = o.mat || 'chain_fence';
  kit.box(mat, 0, 0, -D / 2 + i, W - i * 2, h, 0.05 * M);
  kit.box(mat, -W / 2 + i, 0, 0, 0.05 * M, h, D - i * 2);
  kit.box(mat, W / 2 - i, 0, 0, 0.05 * M, h, D - i * 2);
  const gap = o.gap ?? 0.35;
  const seg = (W - i * 2 - gap) / 2;
  kit.box(mat, -W / 2 + i + seg / 2, 0, D / 2 - i, seg, h, 0.05 * M);
  kit.box(mat, W / 2 - i - seg / 2, 0, D / 2 - i, seg, h, 0.05 * M);
}
function path(kit, x, z, w, d, mat = 'pavers') { kit.box(mat, x, 0, z, w, 0.09 * M, d); }
// Satteldach-Haus (Wohnen/Dorf)
function house(kit, c, x, z, w, d, floors, wall, roofMat, o = {}) {
  const top = body(kit, x, z, w, d, floors, wall, { sill: true, shutters: o.shutters, frame: o.frame, plinth: 'stone_grey' });
  kit.door(x + (o.doorOff ?? w * 0.2), z, d, { canopy: c.detail >= 2 ? 'roof_metal_grey' : null });
  const rt = roof(kit, o.roof || 'gable', roofMat, x, top, z, w, d, { wall, ridge: o.ridge || (w >= d ? 'x' : 'z'), h: o.rh });
  if (c.detail >= 1 && o.chimney !== false) kit.chimney(x + w * 0.22, top + (rt - top) * 0.35, z - d * 0.12, (rt - top) * 0.75);
  return rt;
}

// ---------- Zonen
const RES_WALLS = ['plaster_white', 'plaster_cream', 'plaster_ochre', 'plaster_pink', 'plaster_blue', 'plaster_green', 'brick_red', 'brick_yellow'];
const ROOFS = ['roof_tiles_red', 'roof_tiles_brown', 'roof_tiles_anthracite', 'roof_slate', 'roof_tiles_red'];
const AWN = ['awning_red', 'awning_blue', 'awning_green', 'awning_yellow', 'awning_striped'];
const SIGNS = ['sign_white', 'neon_pink', 'neon_cyan', 'neon_yellow', 'emissive_warm', 'emissive_red'];
const OFF_GLASS = ['glass_curtain_blue', 'glass_curtain_green', 'glass_curtain_dark', 'glass_curtain_gold'];

fb('res', 4, (c) => {
  const { kit, rng, level: L, W, D } = c;
  ground(kit, W, D, 'grass');
  const wall = pick(rng, RES_WALLS), rf = pick(rng, ROOFS);
  if (L <= 2) {
    const n = W >= 2 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? 0 : (i - 0.5) * W * 0.5;
      const w = Math.min(W / n - 0.2, range(rng, 0.62, 0.8)), d = Math.min(D - 0.35, range(rng, 0.55, 0.68));
      house(kit, c, x, -0.06 * D, w, d, L === 1 ? 1 + (rng() < 0.5 ? 1 : 0) : 2, i ? pick(rng, RES_WALLS) : wall, rf, { shutters: rng() < 0.3 ? 'paint_green' : null });
      path(kit, x + w * 0.2, D / 2 - 0.12, 0.12, 0.24);
    }
    if (D2(c)) { kit.fence(0, D / 2 - 0.03, W - 0.1, 0, 'wood_planks', 0.8 * M); kit.tree(-W * 0.36, -D * 0.36, range(rng, 0.8, 1.1)); kit.hedge(W * 0.42, 0, 0.08, D * 0.5); }
    return kit.build();
  }
  const floors = L === 3 ? 4 : L === 4 ? 7 + Math.floor(rng() * 2) : 15 + Math.floor(rng() * 8);
  const bw = W - (L === 5 ? 0.3 : 0.16), bd = Math.min(D - 0.2, L === 5 ? 0.62 : 0.72);
  const w2 = pick(rng, ['plaster_white', 'plaster_cream', 'concrete_panel', 'brick_red', 'brick_white', 'plaster_grey']);
  const top = body(kit, 0, 0, L === 5 ? Math.min(bw, 0.7 * W) : bw, bd, floors, w2, { spacing: 2.7 * M, frame: 'window_frame_dark', sill: L === 3 });
  if (L >= 4) kit.balconies('front', 0, 0, L === 5 ? Math.min(bw, 0.7 * W) : bw, bd, 0, floors, FLOOR, {});
  kit.door(0, 0, bd, { canopy: 'concrete', w: 1.6 * M });
  if (L === 3 && rng() < 0.6) roof(kit, 'gable', rf, 0, top, 0, bw, bd, { wall: w2, ridge: 'x' });
  else roof(kit, 'flat', null, 0, top, 0, L === 5 ? Math.min(bw, 0.7 * W) : bw, bd, { clutter: 2 + Math.floor(rng() * 3) });
  if (D2(c)) { kit.tree(-W * 0.4, D * 0.4, 0.8); kit.tree(W * 0.4, D * 0.4, 0.9); }
  return kit.build();
});

fb('com', 4, (c) => {
  const { kit, rng, level: L, W, D } = c;
  ground(kit, W, D, 'pavers', 0.01);
  const wall = pick(rng, RES_WALLS), aw = pick(rng, AWN), sg = pick(rng, SIGNS);
  if (W >= 2 && D >= 2 && L >= 3) {
    // Einkaufszentrum mit Glasdach und Parkplatz
    const bw = W - 0.25, bd = D * 0.58, z0 = -D / 2 + bd / 2 + 0.1;
    const fl = L === 3 ? 2 : 3;
    const top = body(kit, 0, z0, bw, bd, fl, pick(rng, ['concrete_panel', 'plaster_white', 'metal_panel_white']), { windows: false });
    kit.curtainWall('front', 0, z0, bw * 0.5, bd, FLOOR, (fl - 1) * FLOOR, { glass: 'glass_curtain_blue' });
    shopFront(kit, c, 0, z0, bw, bd, null, sg, { gh: 3 * M, signOff: bw * 0.3 });
    roof(kit, 'flat', null, 0, top, z0, bw, bd, { clutter: 4 });
    kit.prism('glass_skylight', [[-0.25, 0], [0.25, 0], [0, 0.18]], bw * 0.7, { x: 0, y: top, z: z0, ry: Math.PI / 2 });
    sign(kit, sg, -bw * 0.3, top - 0.4, z0 + bd / 2 + 0.01, 0.7, 0.22);
    parking(kit, c, 0, D / 2 - (D - bd - 0.1) / 2 - 0.02, W - 0.2, D - bd - 0.2);
    return kit.build();
  }
  if (L <= 2) {
    const fl = L === 1 ? 1 : 2 + (rng() < 0.5 ? 1 : 0);
    const bw = W - 0.14, bd = Math.min(D - 0.28, 0.66 * D), z0 = -D / 2 + bd / 2 + 0.06;
    const top = fl > 1 ? body(kit, 0, z0, bw, bd, fl, wall, { skipGround: true, sill: true }) : (kit.box(wall, 0, 0, z0, bw, FLOOR * 1.2, bd), FLOOR * 1.2);
    shopFront(kit, c, 0, z0, bw, bd, aw, sg);
    if (fl > 1 && rng() < 0.6) roof(kit, 'gable', pick(rng, ROOFS), 0, top, z0, bw, bd, { wall, ridge: 'x' });
    else roof(kit, 'flat', null, 0, top, z0, bw, bd, { clutter: 1 });
    if (D2(c) && D / 2 - (z0 + bd / 2) > 0.18) for (let i = -1; i <= 1; i += 2) {
      const x = i * bw * 0.28, z = z0 + bd / 2 + 0.18;
      kit.cyl('metal_dark', x, 0, z, 0.03 * M, 0.75 * M, { seg: 6 }); kit.cyl('canvas_white', x, 0.72 * M, z, 0.45 * M, 0.04 * M, { seg: 10 });
      kit.cone(pick(rng, ['canvas_white', 'awning_red', 'awning_green']), x, 2.0 * M, z, 1.2 * M, 0.5 * M, { seg: 8 }); kit.cyl('metal_dark', x, 0.8 * M, z, 0.03 * M, 1.3 * M, { seg: 5 });
    }
    return kit.build();
  }
  if (L <= 4) {
    const fl = L === 3 ? 3 + Math.floor(rng() * 2) : 5 + Math.floor(rng() * 2);
    const bw = W - 0.1, bd = D - 0.16;
    const top = body(kit, 0, 0, bw, bd, fl, L === 4 ? pick(rng, ['concrete_panel', 'stone_sandstone', 'plaster_white', 'brick_yellow']) : wall, { skipGround: true, cornice: 'trim_stone', spacing: L === 4 ? 2.2 * M : 2.6 * M, winW: L === 4 ? 1.6 * M : 1.2 * M });
    shopFront(kit, c, 0, 0, bw, bd, L === 3 ? aw : null, sg, { gh: 3.6 * M });
    roof(kit, 'flat', null, 0, top, 0, bw, bd, { clutter: 3 });
    if (L === 4) sign(kit, pick(rng, ['neon_cyan', 'neon_pink', 'sign_white']), bw / 2 - 0.05, top - 0.55, bd / 2 + 0.01, 0.3, 0.42);
    return kit.build();
  }
  // Stufe 5: Geschäftsturm auf Sockel
  const pw = W - 0.08, pd = D - 0.1;
  const pt = body(kit, 0, 0, pw, pd, 2, 'stone_sandstone', { windows: false });
  kit.curtainWall('front', 0, 0, pw, pd, FLOOR, FLOOR, { glass: 'glass_shop' });
  shopFront(kit, c, 0, 0, pw, pd, null, sg, { gh: 3.2 * M });
  roof(kit, 'flat', null, 0, pt, 0, pw, pd, {});
  const tw = Math.min(pw, 0.62) * (W > 1 ? 1.4 : 1), td = Math.min(pd, 0.62);
  const th = (11 + Math.floor(rng() * 6)) * FLOOR;
  kit.box('concrete_panel', 0, pt, 0, tw, th, td);
  const gl = pick(rng, OFF_GLASS);
  for (const s of ['front', 'back', 'left', 'right']) kit.curtainWall(s, 0, 0, tw, td, pt, th, { glass: gl });
  roof(kit, 'flat', null, 0, pt + th, 0, tw, td, { clutter: 2 });
  sign(kit, sg, 0, pt + th - 0.3, td / 2 + 0.02, tw * 0.6, 0.18);
  return kit.build();
});

fb('off', 4, (c) => {
  const { kit, rng, level: L, W, D } = c;
  ground(kit, W, D, 'pavers', 0.01);
  const gl = pick(rng, OFF_GLASS);
  if (L <= 2) {
    const fl = L === 1 ? 3 : 4 + Math.floor(rng() * 2);
    const bw = W - 0.16, bd = D - 0.26;
    const wall = pick(rng, ['plaster_white', 'concrete_panel', 'plaster_grey', 'brick_white']);
    const top = body(kit, 0, -0.04, bw, bd, fl, wall, { frame: 'window_frame_dark', winW: 2.0 * M, spacing: 2.6 * M, winH: 1.4 * M });
    for (let f = 1; f < fl; f++) kit.band('trim_dark', 0, -0.04, bw, bd, f * FLOOR - 0.12 * M, 0.25 * M, 0.06 * M);
    kit.door(0, -0.04, bd, { canopy: 'metal_dark', w: 1.8 * M, mat: 'door_glass' });
    roof(kit, 'flat', null, 0, top, -0.04, bw, bd, { clutter: 2 });
    if (D2(c)) { kit.tree(-W * 0.38, D * 0.4, 0.8); kit.hedge(W * 0.25, D * 0.42, W * 0.35, 0.06); }
    return kit.build();
  }
  const fl = L === 3 ? 7 + Math.floor(rng() * 3) : L === 4 ? 12 + Math.floor(rng() * 4) : 20 + Math.floor(rng() * 8);
  const bw = Math.min(W - 0.16, L === 5 ? 0.66 * Math.max(1, W * 0.75) : 0.84 * W), bd = Math.min(D - 0.16, L === 5 ? 0.66 : 0.8);
  kit.box('concrete_dark', 0, 0, 0, bw + 0.1, FLOOR * 1.2, bd + 0.1);
  kit.box('concrete_panel', 0, 0, 0, bw, fl * FLOOR, bd);
  const low = L >= 4 ? Math.round(fl * 0.62) : fl;
  for (const s of ['front', 'back', 'left', 'right']) kit.curtainWall(s, 0, 0, bw, bd, FLOOR * 1.2, low * FLOOR - FLOOR * 1.2, { glass: gl });
  let top = low * FLOOR;
  if (L >= 4) {
    const sw = bw * 0.78, sd = bd * 0.78;
    roof(kit, 'flat', null, 0, top, 0, bw, bd, {});
    kit.box('concrete_panel', 0, top, 0, sw, (fl - low) * FLOOR, sd);
    for (const s of ['front', 'back', 'left', 'right']) kit.curtainWall(s, 0, 0, sw, sd, top, (fl - low) * FLOOR, { glass: gl });
    top = fl * FLOOR;
    roof(kit, 'flat', null, 0, top, 0, sw, sd, { clutter: 2 });
    if (L === 5) {
      kit.box('metal_light', 0, top, 0, sw * 0.6, 0.35, sd * 0.6);
      kit.box('emissive_cool', 0, top + 0.3, 0, sw * 0.62, 0.03, sd * 0.62);
      kit.cyl('metal_light', 0, top + 0.35, 0, 0.012, 0.7, { seg: 6 });
      kit.light(0, top + 1.05, 0, 0xff3b30, 0.4);
    }
  } else roof(kit, 'flat', null, 0, top, 0, bw, bd, { clutter: 3 });
  kit.door(0, 0, bd, { canopy: 'metal_dark', w: 2.4 * M, mat: 'door_glass' });
  return kit.build();
});

fb('ind', 4, (c) => {
  const { kit, rng, level: L, W, D } = c;
  ground(kit, W, D, 'gravel', 0.01);
  const wall = pick(rng, ['metal_corrugated', 'metal_panel_grey', 'brick_red', 'metal_panel_blue', 'brick_brown']);
  const bw = W - 0.14, bd = D * 0.72, z0 = -D / 2 + bd / 2 + 0.06;
  if (L <= 2) {
    const h = L === 1 ? 0.38 : 0.5;
    kit.box(wall, 0, 0, z0, bw, h, bd);
    kit.windows('left', 0, z0, bw, bd, h * 0.45, 1, 0.25, { winW: 2 * M, winH: 0.8 * M, frame: 'window_frame_dark' });
    for (let i = 0; i < (W > 1 ? 3 : 2); i++) kit.box('metal_corrugated', -bw / 2 + bw * (i + 0.5) / (W > 1 ? 3 : 2), 0, z0 + bd / 2 + 0.01 * M, 0.3, 0.32, 0.03 * M);
    if (L === 1) roof(kit, 'gable', 'metal_corrugated', 0, h, z0, bw, bd, { wall, ridge: 'x', h: 0.12 });
    else roof(kit, 'saw', 'metal_corrugated_red', 0, h, z0, bw, bd, { h: 0.16 });
    kit.box('concrete_panel', bw / 2 - 0.15, 0, z0 + bd / 2 + 0.08, 0.26, 0.28, 0.16);
    if (D2(c)) truck(kit, rng, W > 1 ? -W * 0.18 : 0, D / 2 - 0.12, Math.PI / 2);
    if (L === 2) stack(kit, -bw / 2 + 0.08, z0 - bd / 2 + 0.08, 0.04, 0.85, 'brick_red', {});
    return kit.build();
  }
  if (L <= 4) {
    const h = L === 3 ? 0.55 : 0.7;
    kit.box(L === 3 ? 'brick_red' : wall, -0.06 * W, 0, z0, bw * 0.78, h, bd);
    kit.windows('front', -0.06 * W, z0, bw * 0.78, bd, 0.1, 2, 0.24, { winW: 1.8 * M, spacing: 2.6 * M, frame: 'window_frame_dark' });
    roof(kit, L === 3 ? 'saw' : 'flat', 'roof_metal_grey', -0.06 * W, h, z0, bw * 0.78, bd, { clutter: 3 });
    tank(kit, bw / 2 - 0.12, z0 - bd * 0.2, 0.1, 0.55, 'tank_white', { ring: true });
    tank(kit, bw / 2 - 0.12, z0 + bd * 0.22, 0.1, 0.48, 'metal_light', { ring: true });
    if (c.detail >= 1) kit.box('pipe_metal', bw * 0.2, 0.42, z0, 0.3, 0.04, 0.04);
    stack(kit, -bw / 2 + 0.1, z0 - bd / 2 + 0.1, 0.06, L === 3 ? 1.1 : 1.4, L === 3 ? 'brick_red' : 'concrete', { bands: L === 4 ? 2 : 0, bandMat: 'paint_red' });
    if (L === 4) stack(kit, -bw / 2 + 0.3, z0 - bd / 2 + 0.1, 0.05, 1.2, 'concrete', { bands: 2, bandMat: 'paint_red', amount: 0.8 });
    if (D2(c)) for (let i = 0; i < 3; i++) kit.box(pick(rng, ['container_red', 'container_blue', 'container_green', 'container_yellow']), -W / 2 + 0.2 + i * 0.27, 0, D / 2 - 0.12, 0.24, 0.26 * 0.9, 0.1);
    return kit.build();
  }
  // Hightech-Fabrik
  kit.box('metal_panel_white', 0, 0, z0, bw, 0.62, bd);
  kit.curtainWall('front', 0, z0, bw, bd, 0.12, 0.32, { glass: 'glass_curtain_dark' });
  kit.box('emissive_cool', 0, 0.48, z0 + bd / 2 + 0.01, bw * 0.9, 0.02, 0.01);
  kit.box('roof_flat_membrane', 0, 0.62, z0, bw, 0.02, bd);
  if (c.detail >= 1) for (let i = 0; i < 4; i++) kit.box('solar_panel', 0, 0.66, z0 - bd / 2 + bd * (i + 0.5) / 4, bw * 0.85, 0.02, bd / 5, { rx: -0.35 });
  parking(kit, c, 0, D / 2 - 0.1, W - 0.2, 0.16, false);
  return kit.build();
});

fb('farm', 4, (c) => {
  const { kit, rng, level: L, W, D } = c;
  ground(kit, W, D, 'field_soil', 0.01);
  const crop = pick(rng, ['field_crops', 'field_wheat', 'field_rapeseed', 'field_crops']);
  const rows = Math.round(W * 6);
  for (let i = 0; i < rows; i++) kit.box(crop, -W / 2 + 0.06 + (i * (W - 0.12)) / rows + 0.04, 0.03 * M, D * 0.12, (W - 0.12) / rows * 0.6, 0.06 + L * 0.01, D * 0.66);
  const bx = W / 2 - 0.28, bz = -D / 2 + 0.24;
  kit.box(pick(rng, ['siding_red', 'wood_dark', 'brick_red']), bx, 0, bz, 0.42, 0.24, 0.3);
  roof(kit, 'gable', pick(rng, ['roof_metal_grey', 'roof_tiles_red', 'wood_dark']), bx, 0.24, bz, 0.42, 0.3, { wall: 'wood_dark', ridge: 'x', h: 0.14 });
  kit.box('wood_dark', bx, 0, bz + 0.151, 0.16, 0.2, 0.01);
  if (L >= 2) { tank(kit, bx - 0.32, bz, 0.07, 0.42 + L * 0.06, 'tank_white', { domeMat: 'roof_metal_grey' }); }
  if (L >= 3) tank(kit, bx - 0.48, bz, 0.06, 0.38 + L * 0.05, 'metal_light', { domeMat: 'roof_metal_grey' });
  if (D2(c)) {
    for (let i = 0; i < 3; i++) kit.cyl('hay', -W / 2 + 0.15 + i * 0.1, 0, -D / 2 + 0.14, 0.04, 0.05, { seg: 8, rx: Math.PI / 2 });
    kit.box('paint_green', -W * 0.1, 0.02, -D / 2 + 0.14, 0.08, 0.06, 0.12);
    kit.fence(0, D / 2 - 0.02, W - 0.06, 0, 'wood_planks', 1 * M);
  }
  return kit.build();
});

fb('mine', 4, (c) => {
  const { kit, rng, level: L, W, D } = c;
  ground(kit, W, D, 'gravel', 0.01);
  const hr = Math.min(0.28 * Math.min(W, D), 0.3) + 0.015 * L;
  kit.cone('rock', -W / 2 + hr + 0.04, 0, D / 2 - hr - 0.06, hr, 0.24 + L * 0.05, { seg: 7 });
  const hx = W * 0.22, hz = -D * 0.18, h = 0.65 + L * 0.12;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kit.box('metal_dark', hx + dx * 0.08, 0, hz + dz * 0.08, 0.025, h, 0.025, { rx: dz * 0.05, rz: -dx * 0.05 });
  if (c.detail >= 1) for (let y = 0.15; y < h; y += 0.15) kit.box('metal_dark', hx, y, hz, 0.17, 0.012, 0.17);
  kit.box('metal_dark', hx, h, hz, 0.2, 0.03, 0.2);
  kit.cyl('paint_red', hx, h + 0.03, hz - 0.03, 0.07, 0.02, { seg: 14, rx: Math.PI / 2 });
  kit.box(pick(rng, ['brick_red', 'metal_corrugated']), W * 0.24, 0, D * 0.25, 0.34, 0.24, 0.26);
  roof(kit, 'gable', 'metal_corrugated', W * 0.24, 0.24, D * 0.25, 0.34, 0.26, { wall: 'brick_red', ridge: 'x', h: 0.08 });
  if (c.detail >= 1) kit.box('metal_dark', 0, 0.12, D * 0.2, W * 0.35, 0.03, 0.05, { rz: 0.25 });
  return kit.build();
});

fb('forest', 4, (c) => {
  const { kit, rng, level: L, W, D } = c;
  ground(kit, W, D, 'dirt', 0.01);
  kit.box('wood_dark', 0, 0, -D * 0.2, W * 0.6, 0.26, D * 0.32);
  roof(kit, 'shed', 'metal_corrugated', 0, 0.26, -D * 0.2, W * 0.6, D * 0.32, { h: 0.06 });
  const piles = 2 + Math.min(3, L);
  for (let p = 0; p < piles; p++) {
    const px = -W / 2 + 0.16 + (p % 3) * 0.24, pz = D * 0.12 + Math.floor(p / 3) * 0.17;
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3 - r; k++) kit.cyl('log_wood', px - 0.03 * (2 - r) + k * 0.06, 0.03 + r * 0.05, pz, 0.025, 0.24, { seg: 7, rx: Math.PI / 2 });
  }
  if (D2(c)) for (let i = 0; i < Math.round(D * 3); i++) kit.tree(W / 2 - 0.2, -D / 2 + 0.2 + i * 0.28, range(rng, 0.85, 1.15), { leaf: 'leaves_dark' });
  return kit.build();
});

fb('oil', 4, (c) => {
  const { kit, rng, level: L, W, D } = c;
  ground(kit, W, D, 'sand', 0.01);
  const res = { anim: [] };
  const n = Math.min(3, 1 + Math.floor(L / 2));
  for (let i = 0; i < n; i++) pumpjack(c, res, -W / 2 + 0.2 + i * 0.28, D * 0.2 - (i % 2) * 0.25, rng() * 6);
  tank(kit, W / 2 - 0.2, -D / 2 + 0.22, 0.13, 0.3, 'tank_white', { ring: true });
  if (L >= 3) tank(kit, W / 2 - 0.2, -D / 2 + 0.52, 0.1, 0.26, 'metal_light', { ring: true });
  if (c.detail >= 1) kit.box('pipe_metal', 0, 0.04, -D * 0.1, W * 0.7, 0.025, 0.025);
  return Object.assign(kit.build(), res);
});
function pumpjack(c, res, x, z, phase) {
  const { kit } = c;
  kit.box('concrete', x, 0, z, 0.08, 0.02, 0.28);
  kit.box('metal_dark', x, 0, z, 0.02, 0.2, 0.025, { rx: 0.15 });
  kit.box('metal_dark', x, 0, z + 0.03, 0.02, 0.2, 0.025, { rx: -0.15 });
  const k2 = new Kit(c.rng, c.detail);
  k2.box('paint_yellow', x, 0.19, z, 0.03, 0.03, 0.34);
  k2.box('metal_dark', x, 0.12, z + 0.17, 0.035, 0.11, 0.05);
  k2.box('paint_red', x, 0.14, z - 0.16, 0.06, 0.08, 0.05);
  for (const m of k2.build().meshes) res.anim.push({ geometry: m.geometry, material: m.material, pivot: [x, 0.2, z], axis: 'x', speed: 1.6, swing: 0.32, phase, local: false });
}

// ---------- Kategorien (generisch) und einzelne Gebäude
function civic(c, o) {
  const { kit, rng, W, D } = c;
  ground(kit, W, D, o.ground || 'pavers');
  const bw = (o.bw ?? 0.86) * W - 0.06, bd = (o.bd ?? 0.62) * D, z0 = o.z0 ?? -D / 2 + bd / 2 + 0.08;
  const wall = o.wall || 'plaster_white';
  const top = body(kit, 0, z0, bw, bd, o.floors || 2, wall, { frame: o.frame || 'window_frame_white', sill: true, cornice: o.cornice, winW: o.winW, spacing: o.spacing });
  kit.door(0, z0, bd, { canopy: o.canopy || 'concrete', w: o.doorW || 1.8 * M, mat: o.doorMat || 'door_glass' });
  if (o.band) kit.band(o.band, 0, z0, bw, bd, top - 0.55 * M, 0.35 * M, 0.04 * M);
  const rt = roof(kit, o.roof || 'flat', o.roofMat || 'roof_slate', 0, top, z0, bw, bd, { wall, ridge: 'x', clutter: o.clutter ?? 2 });
  if (o.signMat) sign(kit, o.signMat, 0, top - 0.06 - 0.5 * M, z0 + bd / 2 + 0.01, Math.min(bw * 0.5, 0.42), 0.07);
  if (o.yard !== false && D2(c)) { const fz = (z0 + bd / 2 + D / 2) / 2; lamp(kit, c, -bw * 0.45, fz); bench(kit, c, bw * 0.3, fz); }
  return { top, rt, bw, bd, z0, wall };
}

fb('@generic', 1, (c) => { civic(c, { floors: 2, wall: 'plaster_grey' }); return c.kit.build(); });
fb('@services', 2, (c) => { civic(c, { floors: 3, wall: pick(c.rng, ['plaster_white', 'plaster_cream', 'brick_white']) }); return c.kit.build(); });
fb('@education', 2, (c) => { civic(c, { floors: 3, wall: 'brick_yellow', roof: 'gable', roofMat: 'roof_tiles_red' }); return c.kit.build(); });
fb('@safety', 1, (c) => { civic(c, { floors: 2, wall: 'plaster_white', band: 'paint_orange', signMat: 'emissive_warm' }); return c.kit.build(); });
fb('@industry', 2, (c) => { hall(c, { wall: pick(c.rng, ['metal_corrugated', 'brick_red', 'metal_panel_grey']) }); return c.kit.build(); });
fb('@transport', 1, (c) => { hall(c, { wall: 'metal_panel_blue', roof: 'flat', doors: 4 }); return c.kit.build(); });
fb('@transit', 1, (c) => { hall(c, { wall: 'concrete_panel', roof: 'flat', doors: 0 }); return c.kit.build(); });
fb('@power', 1, (c) => { hall(c, { wall: 'metal_panel_grey', chimney: 1 }); return c.kit.build(); });
fb('@water', 1, (c) => { hall(c, { wall: 'concrete_panel', roof: 'flat' }); return c.kit.build(); });
fb('@garbage', 1, (c) => { hall(c, { wall: 'metal_corrugated_green', roof: 'flat' }); return c.kit.build(); });
fb('@parks', 2, (c) => { parkBase(c, {}); return c.kit.build(); });
fb('@landmarks', 1, (c) => { civic(c, { floors: 3, wall: 'stone_sandstone', roof: 'hip', roofMat: 'roof_copper', cornice: 'trim_stone' }); return c.kit.build(); });

function hall(c, o) {
  const { kit, rng, W, D } = c;
  ground(kit, W, D, o.ground || 'asphalt', 0.01);
  const bw = W - 0.14, bd = (o.bd ?? 0.66) * D, z0 = -D / 2 + bd / 2 + 0.06, h = o.h ?? 0.5;
  const wall = o.wall || 'metal_corrugated';
  kit.box(wall, 0, 0, z0, bw, h, bd);
  kit.box('concrete_dark', 0, 0, z0, bw + 0.012, 0.05, bd + 0.012);
  if (c.detail >= 1) kit.windows('left', 0, z0, bw, bd, h * 0.55, 1, h * 0.4, { winW: 2.4 * M, winH: 0.9 * M, frame: 'window_frame_dark' });
  kit.windows('right', 0, z0, bw, bd, h * 0.55, 1, h * 0.4, { winW: 2.4 * M, winH: 0.9 * M, frame: 'window_frame_dark' });
  const nd = o.doors ?? Math.max(1, Math.round(bw / 0.45));
  for (let i = 0; i < nd; i++) kit.box(o.doorMat || 'metal_corrugated', -bw / 2 + (bw * (i + 0.5)) / nd, 0, z0 + bd / 2 + 0.01 * M, Math.min(0.32, bw / nd * 0.7), Math.min(0.36, h * 0.72), 0.04 * M);
  kit.box('concrete_panel', bw / 2 - 0.16, 0, z0 + bd / 2 + 0.1, 0.28, 0.3, 0.18);
  kit.windows('front', bw / 2 - 0.16, z0 + bd / 2 + 0.1, 0.28, 0.18, 0, 2, 0.15, { winW: 1.4 * M, winH: 0.9 * M, spacing: 2 * M, frame: 'window_frame_dark' });
  roof(kit, o.roof || 'gable', o.roofMat || 'roof_metal_grey', 0, h, z0, bw, bd, { wall, ridge: 'x', h: o.rh ?? 0.12, clutter: 3 });
  for (let i = 0; i < (o.chimney || 0); i++) stack(kit, -bw / 2 + 0.12 + i * 0.22, z0 - bd / 2 + 0.12, 0.06, h + 0.9, 'brick_red', {});
  if (o.yard !== false && D2(c)) truck(kit, rng, -bw * 0.25, D / 2 - 0.12, Math.PI / 2);
  return { bw, bd, z0, h };
}
function parkBase(c, o) {
  const { kit, rng, W, D } = c;
  ground(kit, W, D, o.ground || 'grass', 0.01);
  if (o.paths !== false) {
    path(kit, 0, 0, 0.1, D - 0.05, 'gravel');
    if (W >= 2 || D >= 2 || rng() < 0.5) path(kit, 0, 0, W - 0.05, 0.1, 'gravel');
  }
  const n = Math.round((o.trees ?? 3 * W * D) * (c.detail === 0 ? 0.45 : 1));
  for (let i = 0; i < n; i++) {
    const x = (rng() - 0.5) * (W - 0.25), z = (rng() - 0.5) * (D - 0.25);
    if (Math.abs(x) < 0.1 || Math.abs(z) < 0.1) continue;
    kit.tree(x, z, range(rng, 0.8, 1.25), { leaf: pick(rng, ['leaves_green', 'leaves_dark', 'leaves_light']) });
  }
  if (D2(c)) for (let i = 0; i < Math.max(2, W * D); i++) { bench(kit, c, 0.12, (rng() - 0.5) * (D - 0.3), Math.PI / 2); lamp(kit, c, -0.1, (rng() - 0.5) * (D - 0.3)); }
}

// --- Strom
fb('coal', 2, (c) => {
  const { kit, W, D } = c;
  ground(kit, W, D, 'gravel', 0.01);
  kit.box('brick_red', -0.35, 0, 0.3, 1.0, 0.7, 0.85);
  kit.windows('front', -0.35, 0.3, 1.0, 0.85, 0.15, 2, 0.25, { winW: 2.4 * M, winH: 1.6 * M, frame: 'window_frame_dark', spacing: 3.4 * M });
  kit.windows('left', -0.35, 0.3, 1.0, 0.85, 0.15, 2, 0.25, { winW: 2.4 * M, winH: 1.6 * M, frame: 'window_frame_dark', spacing: 3.4 * M });
  roof(kit, 'gable', 'roof_metal_grey', -0.35, 0.7, 0.3, 1.0, 0.85, { wall: 'brick_red', ridge: 'x', h: 0.14 });
  kit.box('metal_panel_grey', -0.45, 0, -0.45, 0.6, 1.0, 0.5);
  roof(kit, 'flat', null, -0.45, 1.0, -0.45, 0.6, 0.5, { clutter: 2 });
  coolingTower(kit, 0.5, -0.45, 0.42, 1.25);
  stack(kit, -0.82, -0.82, 0.08, 2.3, 'concrete', { bands: 3, bandMat: 'paint_red', amount: 2 });
  kit.cone('asphalt_dark', 0.55, 0, 0.55, 0.32, 0.22, { seg: 7 });
  if (c.detail >= 1) kit.box('metal_dark', 0.2, 0.25, 0.35, 0.65, 0.04, 0.06, { rz: -0.3 });
  return kit.build();
});
fb('wind', 2, (c) => {
  const { kit, rng } = c;
  ground(kit, c.W, c.D, 'grass', 0.01);
  kit.cyl('concrete', 0, 0, 0, 0.12, 0.05, { seg: 12 });
  const h = 2.05;
  kit.cyl('paint_white', 0, 0.05, 0, 0.055, h, { rTop: 0.028, seg: 14 });
  kit.box('paint_white', 0, h + 0.03, -0.05, 0.075, 0.075, 0.22);
  kit.light(0, h + 0.1, -0.05, 0xff3020, 0.35);
  const k2 = new Kit(rng, c.detail);
  const hz = 0.075;
  k2.sphere('paint_white', 0, h + 0.068, hz, 0.035, { seg: 10 });
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3;
    k2.box('paint_white', 0, h + 0.068, hz, 0.045, 0.74, 0.012, { rz: -a });
  }
  const res = kit.build();
  // Rotorblätter: Box-Ursprung ist die Unterkante → Blätter um die Nabe legen
  res.anim = [];
  for (const m of k2.build().meshes) res.anim.push({ geometry: m.geometry, material: m.material, pivot: [0, h + 0.068, hz], axis: 'z', speed: 1.9, phase: rng() * 6, local: false });
  return res;
});
fb('solar', 2, (c) => {
  const { kit, W, D } = c;
  ground(kit, W, D, 'grass_dry', 0.01);
  const rows = Math.round(D * 3.5), cols = Math.round(W * 2);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = -W / 2 + 0.18 + i * ((W - 0.36) / Math.max(1, cols - 1)), z = -D / 2 + 0.2 + j * ((D - 0.4) / Math.max(1, rows - 1));
    kit.box('solar_panel', x, 0.05, z, (W - 0.4) / cols * 0.92, 0.012, 0.16, { rx: -0.5 });
    if (c.detail >= 1) kit.box('metal_dark', x, 0, z + 0.02, 0.01, 0.07, 0.01);
  }
  kit.box('concrete_panel', W / 2 - 0.12, 0, D / 2 - 0.1, 0.16, 0.12, 0.1);
  chainFence(kit, c, W, D, {});
  return kit.build();
});
fb('gas district_heating geothermal', 2, (c) => {
  const { kit, key, W, D } = c;
  ground(kit, W, D, 'gravel', 0.01);
  const wall = key === 'district_heating' ? 'brick_red' : 'metal_panel_grey';
  kit.box(wall, -0.3, 0, 0.3, 1.0, 0.62, 0.8);
  kit.windows('front', -0.3, 0.3, 1.0, 0.8, 0.12, 2, 0.24, { winW: 2.2 * M, winH: 1.4 * M, frame: 'window_frame_dark', spacing: 3 * M });
  roof(kit, 'flat', null, -0.3, 0.62, 0.3, 1.0, 0.8, { clutter: 3 });
  if (key === 'gas') { kit.sphere('tank_white', 0.5, 0.36, -0.45, 0.3, { seg: 16 }); kit.cyl('metal_dark', 0.5, 0, -0.45, 0.2, 0.1, { seg: 12 }); }
  else if (key === 'geothermal') { coolingTower(kit, 0.5, -0.45, 0.28, 0.6, 16); for (let i = 0; i < 3; i++) kit.smoke(0.2 + i * 0.25, 0.1, 0.6, 'steam', 0.6); }
  else { tank(kit, 0.45, -0.45, 0.22, 0.5, 'tank_white', { ring: true }); tank(kit, 0.6, 0.15, 0.14, 0.38, 'metal_light', {}); }
  stack(kit, -0.7, -0.6, 0.07, key === 'district_heating' ? 1.9 : 1.4, key === 'district_heating' ? 'brick_red' : 'concrete', { bands: 2, bandMat: 'paint_white', steam: key === 'geothermal' });
  if (c.detail >= 1) { kit.box('pipe_metal', 0.1, 0.3, -0.45, 0.55, 0.05, 0.05); kit.box('pipe_metal', 0.1, 0, -0.45, 0.04, 0.3, 0.04); }
  return kit.build();
});
fb('fusion nuclear', 1, (c) => {
  const { kit, key, W, D } = c;
  ground(kit, W, D, 'concrete', 0.01);
  if (key === 'nuclear') {
    coolingTower(kit, -0.75, -0.7, 0.6, 1.8, 24); coolingTower(kit, 0.65, -0.7, 0.6, 1.8, 24);
    const sg = c.detail ? 24 : 12;
    kit.cyl('concrete_panel', -0.4, 0, 0.65, 0.42, 0.55, { seg: sg }); kit.dome('concrete_panel', -0.4, 0.55, 0.65, 0.42, { seg: sg, sy: 0.7 });
    kit.box('metal_panel_grey', 0.65, 0, 0.6, 0.9, 0.5, 0.6);
    roof(kit, 'flat', null, 0.65, 0.5, 0.6, 0.9, 0.6, { clutter: 3 });
  } else {
    kit.cyl('metal_panel_white', 0, 0, 0, 1.1, 0.3, { seg: 32 });
    kit.dome('marble', 0, 0.3, 0, 1.0, { seg: 32, sy: 0.75 });
    kit.cyl('emissive_cool', 0, 0.28, 0, 1.12, 0.04, { seg: 32 });
    kit.box('metal_panel_white', 1.05, 0, 1.05, 0.6, 0.45, 0.5);
    kit.curtainWall('front', 1.05, 1.05, 0.6, 0.5, 0.08, 0.3, { glass: 'glass_curtain_blue' });
  }
  chainFence(kit, c, W, D, { gap: 0.5 });
  return kit.build();
});
fb('battery', 1, (c) => {
  const { kit, W, D } = c;
  ground(kit, W, D, 'gravel', 0.01);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) { kit.box('metal_panel_white', -0.2 + i * 0.4, 0, -0.3 + j * 0.27, 0.32, 0.22, 0.17); if (c.detail >= 1) kit.box('emissive_green', -0.2 + i * 0.4, 0.15, -0.3 + j * 0.27 + 0.086, 0.04, 0.02, 0.005); }
  kit.box('metal_panel_grey', 0.3, 0, 0.38, 0.2, 0.18, 0.12);
  chainFence(kit, c, W, D, {});
  return kit.build();
});
fb('hydro', 1, (c) => {
  const { kit, W, D } = c;
  ground(kit, W, D, 'concrete', 0.01);
  kit.box('concrete', 0, 0, -D / 2 + 0.12, W - 0.05, 0.36, 0.2);
  kit.box('water_canal', 0, 0, D * 0.08, W * 0.5, 0.04, D * 0.4);
  kit.box('brick_red', -W * 0.3, 0, D * 0.2, 0.55, 0.32, 0.4);
  kit.windows('front', -W * 0.3, D * 0.2, 0.55, 0.4, 0.06, 2, 0.13, { winW: 1.6 * M, winH: 1 * M, spacing: 2.4 * M });
  roof(kit, 'gable', 'roof_metal_grey', -W * 0.3, 0.32, D * 0.2, 0.55, 0.4, { wall: 'brick_red', ridge: 'x', h: 0.1 });
  kit.box('metal_dark', W * 0.32, 0, D * 0.25, 0.2, 0.18, 0.2);
  return kit.build();
});

// --- Wasser, Abwasser, Müll
fb('watertower', 2, (c) => {
  const { kit, rng } = c;
  ground(kit, c.W, c.D, 'grass', 0.01);
  const modern = rng() < 0.5;
  if (modern) {
    kit.cyl('concrete', 0, 0, 0, 0.09, 0.85, { seg: 16, rTop: 0.07 });
    kit.cyl('paint_white', 0, 0.82, 0, 0.12, 0.08, { seg: 20, rTop: 0.3 });
    kit.cyl('plaster_blue', 0, 0.9, 0, 0.3, 0.16, { seg: 20 });
    kit.cyl('paint_white', 0, 1.06, 0, 0.3, 0.06, { seg: 20, rTop: 0.06 });
  } else {
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kit.box('brick_red', dx * 0.13, 0, dz * 0.13, 0.04, 0.8, 0.04);
    kit.cyl('brick_red', 0, 0, 0, 0.06, 0.8, { seg: 10 });
    kit.cyl('wood_dark', 0, 0.8, 0, 0.26, 0.26, { seg: 18 });
    kit.cone('roof_slate', 0, 1.06, 0, 0.29, 0.18, { seg: 18 });
  }
  return kit.build();
});
fb('pump sewage_outlet flood_barrier ferry_pier', 1, (c) => {
  const { kit, key, W, D } = c;
  ground(kit, W, D, key === 'ferry_pier' ? 'wood_planks' : 'concrete', 0.01);
  if (key === 'flood_barrier') {
    kit.box('concrete', 0, 0, -D * 0.3, W - 0.04, 0.22, 0.14);
    kit.box('paint_yellow', 0, 0.22, -D * 0.3, W - 0.04, 0.02, 0.15);
    return kit.build();
  }
  if (key === 'ferry_pier') {
    kit.box('wood_planks', 0, 0, D * 0.15, 0.25, 0.06, D * 0.7);
    kit.box('paint_white', -W * 0.25, 0, -D * 0.2, 0.35, 0.22, 0.3);
    roof(kit, 'shed', 'roof_metal_grey', -W * 0.25, 0.22, -D * 0.2, 0.35, 0.3, { h: 0.05 });
    kit.box('glass_window', -W * 0.25, 0.08, -D * 0.2 + 0.151, 0.25, 0.1, 0.01, { lit: 0.5 });
    return kit.build();
  }
  const wall = key === 'pump' ? 'brick_red' : 'concrete_panel';
  kit.box(wall, 0, 0, -0.1, 0.5, 0.32, 0.4);
  kit.windows('front', 0, -0.1, 0.5, 0.4, 0.05, 1, 0.24, { winW: 1.4 * M, winH: 1.4 * M, spacing: 2.4 * M });
  kit.door(0.15, -0.1, 0.4, { w: 1.2 * M, step: false });
  roof(kit, key === 'pump' ? 'gable' : 'flat', 'roof_tiles_red', 0, 0.32, -0.1, 0.5, 0.4, { wall, ridge: 'x', h: 0.12 });
  kit.cyl('pipe_metal', 0.3, 0.06, 0.2, 0.05, 0.22, { seg: 10, rx: Math.PI / 2 });
  return kit.build();
});
fb('waterworks sewage_plant', 1, (c) => {
  const { kit, key, W, D } = c;
  ground(kit, W, D, 'concrete', 0.01);
  const pools = key === 'sewage_plant' ? [[-0.45, -0.45, 0.38], [0.45, -0.45, 0.38], [-0.45, 0.25, 0.3]] : [[-0.45, -0.45, 0.4], [0.45, -0.45, 0.4]];
  for (const [x, z, r] of pools) {
    kit.cyl('concrete', x, 0, z, r, 0.12, { seg: 24 });
    kit.cyl(key === 'sewage_plant' ? 'water_canal' : 'water_pool', x, 0.1, z, r * 0.9, 0.025, { seg: 24 });
    if (c.detail >= 1) kit.box('metal_dark', x, 0.13, z, r * 1.9, 0.02, 0.03);
  }
  kit.box('plaster_white', 0.35, 0, 0.45, 0.9, 0.4, 0.6);
  kit.windows('front', 0.35, 0.45, 0.9, 0.6, 0, 2, 0.2, { spacing: 2.6 * M });
  roof(kit, 'flat', null, 0.35, 0.4, 0.45, 0.9, 0.6, { clutter: 2 });
  if (key === 'sewage_plant') { kit.sphere('metal_light', -0.4, 0.42, 0.75, 0.16, { seg: 14 }); kit.cyl('metal_dark', -0.4, 0, 0.75, 0.08, 0.3, { seg: 10 }); }
  return kit.build();
});
fb('landfill', 2, (c) => {
  const { kit, rng, W, D } = c;
  ground(kit, W, D, 'dirt', 0.01);
  kit.cone('grass_dry', -0.35, 0, -0.3, 0.55, 0.38, { seg: 9 });
  kit.cone('dirt', 0.35, 0, -0.35, 0.45, 0.28, { seg: 8 });
  kit.cone('gravel', 0.1, 0, 0.35, 0.5, 0.3, { seg: 8 });
  if (D2(c)) for (let i = 0; i < 12; i++) kit.box(pick(rng, ['container_red', 'container_blue', 'wood_planks', 'metal_light', 'paint_white']), (rng() - 0.5) * 1.4, 0.05 + rng() * 0.15, (rng() - 0.5) * 1.4, 0.06, 0.04, 0.05, { ry: rng() * 3, rz: rng() });
  kit.box('container_green', 0.7, 0, 0.75, 0.28, 0.12, 0.12);
  chainFence(kit, c, W, D, { gap: 0.4 });
  return kit.build();
});
fb('incinerator recycling', 1, (c) => {
  const { kit, rng, key, W, D } = c;
  ground(kit, W, D, 'asphalt', 0.01);
  if (key === 'incinerator') {
    kit.box('metal_panel_grey', 0, 0, 0.15, 1.4, 0.75, 1.0);
    kit.curtainWall('front', 0, 0.15, 1.4, 1.0, 0.4, 0.3, { glass: 'glass_curtain_dark' });
    kit.box('paint_orange', 0, 0.7, 0.15 + 0.505, 1.4, 0.05, 0.01);
    roof(kit, 'flat', null, 0, 0.75, 0.15, 1.4, 1.0, { clutter: 3 });
    stack(kit, -0.55, -0.6, 0.1, 2.1, 'concrete', { bands: 2, bandMat: 'paint_red', amount: 1.5 });
  } else {
    hall(c, { wall: 'metal_corrugated_green', roof: 'shed', yard: false, bd: 0.5 });
    const cols = ['container_blue', 'container_yellow', 'container_red', 'container_green'];
    for (let i = 0; i < 4; i++) kit.box(cols[i], -0.6 + i * 0.4, 0, 0.65, 0.3, 0.16, 0.22);
    if (D2(c)) kit.cone('gravel', 0.75, 0, 0.1, 0.18, 0.12, { seg: 7 });
  }
  void rng;
  return kit.build();
});

// --- Dienste
fb('police policehq', 2, (c) => {
  const big = c.key === 'policehq';
  const o = civic(c, { floors: big ? 4 : 2, wall: pick(c.rng, ['plaster_white', 'concrete_panel']), band: 'paint_blue', bd: big ? 0.55 : 0.6, signMat: 'emissive_cool', frame: 'window_frame_dark' });
  if (big) { c.kit.box('concrete_panel', 0, o.top, o.z0, 0.5, 0.35, 0.4); roof(c.kit, 'flat', null, 0, o.top + 0.35, o.z0, 0.5, 0.4, {}); c.kit.cyl('metal_light', 0.2, o.top + 0.35, o.z0, 0.01, 0.4, { seg: 5 }); }
  parking(c.kit, c, 0, c.D / 2 - (c.D / 2 - (o.z0 + o.bd / 2)) / 2, c.W - 0.2, c.D / 2 - (o.z0 + o.bd / 2) - 0.05, true);
  c.kit.light(0, o.top + 0.05, o.z0 + o.bd / 2, 0x4f8dff, 0.4);
  return c.kit.build();
});
fb('fire firehq', 2, (c) => {
  const { kit, key, W, D } = c;
  ground(kit, W, D, 'asphalt', 0.01);
  const big = key === 'firehq';
  const bw = W - 0.12, bd = D * 0.62, z0 = -D / 2 + bd / 2 + 0.06;
  kit.box('brick_red', 0, 0, z0, bw, 0.42, bd);
  kit.windows('front', 0, z0, bw, bd, 0.3, 1, 0.12, { winW: 1.4 * M, winH: 0.9 * M, spacing: 2.6 * M });
  kit.windows('left', 0, z0, bw, bd, 0, 2, 0.2, {});
  const n = big ? 4 : 2;
  for (let i = 0; i < n; i++) kit.box('paint_red', -bw / 2 + bw * (i + 0.5) / n, 0, z0 + bd / 2 + 0.01 * M, Math.min(0.3, bw / n * 0.75), 0.26, 0.04 * M);
  roof(kit, 'flat', null, 0, 0.42, z0, bw, bd, { top: 'roof_flat_membrane' });
  kit.box('brick_red', bw / 2 - 0.1, 0, z0 - bd / 2 + 0.1, 0.16, big ? 1.0 : 0.8, 0.16);
  kit.cone('roof_slate', bw / 2 - 0.1, big ? 1.0 : 0.8, z0 - bd / 2 + 0.1, 0.12, 0.12, { seg: 4, ry: Math.PI / 4 });
  sign(kit, 'emissive_red', -bw * 0.2, 0.33, z0 + bd / 2 + 0.01, 0.3, 0.05);
  if (D2(c)) for (let i = 0; i < Math.min(2, n); i++) { const x = -bw / 2 + bw * (i + 0.5) / n; kit.box('paint_red', x, 0.03, D / 2 - 0.12, 0.1, 0.12, 0.3); kit.light(x, 0.16, D / 2 - 0.12, 0x3f7dff, 0.2); }
  return kit.build();
});
fb('clinic hospital', 2, (c) => {
  const { kit, key, W, D } = c;
  if (key === 'clinic') {
    const o = civic(c, { floors: 2, wall: 'plaster_white', band: 'paint_green', frame: 'window_frame_white' });
    kit.box('emissive_red', 0, o.top + 0.04, o.z0 + o.bd / 2 - 0.05, 0.16, 0.05, 0.02); kit.box('emissive_red', 0, o.top - 0.01, o.z0 + o.bd / 2 - 0.05, 0.05, 0.16, 0.02);
    return kit.build();
  }
  ground(kit, W, D, 'pavers', 0.01);
  const fl = 6;
  kit.box('plaster_white', -0.2, 0, -0.2, 1.2, fl * FLOOR, 0.9);
  for (const s of ['front', 'back', 'left', 'right']) kit.windows(s, -0.2, -0.2, 1.2, 0.9, 0, fl, FLOOR, { winW: 1.8 * M, spacing: 2.4 * M, frame: 'window_frame_dark' });
  for (let f = 1; f < fl; f++) kit.band('trim_stone', -0.2, -0.2, 1.2, 0.9, f * FLOOR - 0.1 * M, 0.2 * M, 0.05 * M);
  roof(kit, 'flat', null, -0.2, fl * FLOOR, -0.2, 1.2, 0.9, {});
  kit.cyl('concrete_dark', -0.2, fl * FLOOR + 0.06 * M, -0.2, 0.3, 0.03, { seg: 20 });
  kit.box('paint_white', -0.2, fl * FLOOR + 0.04, -0.2, 0.06, 0.005, 0.25); kit.box('paint_white', -0.2, fl * FLOOR + 0.04, -0.2, 0.2, 0.005, 0.05);
  kit.box('plaster_white', 0.55, 0, 0.45, 0.75, 0.5, 0.75);
  kit.windows('front', 0.55, 0.45, 0.75, 0.75, 0, 2, 0.25, { spacing: 2.4 * M });
  roof(kit, 'flat', null, 0.55, 0.5, 0.45, 0.75, 0.75, { clutter: 2 });
  kit.box('emissive_red', -0.2, fl * FLOOR - 0.3, 0.255, 0.22, 0.07, 0.02); kit.box('emissive_red', -0.2, fl * FLOOR - 0.375, 0.255, 0.07, 0.22, 0.02);
  kit.box('concrete', 0.55, 0, 0.9, 0.6, 0.18, 0.08);
  kit.light(0.55, 0.2, 0.92, 0xffe0b0, 0.4);
  return kit.build();
});
fb('townhall', 1, (c) => {
  const { kit, W, D } = c;
  ground(kit, W, D, 'pavers', 0.01);
  const bw = 1.6, bd = 1.05, z0 = -0.25;
  const top = body(kit, 0, z0, bw, bd, 3, 'stone_sandstone', { sill: 'trim_stone', cornice: 'trim_stone', spacing: 2.4 * M, frame: 'window_frame_white' });
  roof(kit, 'hip', 'roof_slate', 0, top, z0, bw, bd, { h: 0.3 });
  kit.box('stone_sandstone', 0, 0, z0 + bd / 2 - 0.05, 0.45, 1.25, 0.35);
  kit.windows('front', 0, z0 + bd / 2 - 0.05, 0.45, 0.35, 0.95, 1, 0.3, { winW: 1 * M, spacing: 2 * M });
  kit.box('emissive_warm', 0, 1.02, z0 + bd / 2 + 0.13, 0.16, 0.16, 0.02);
  kit.hipRoof('roof_copper', 0, 1.25, z0 + bd / 2 - 0.05, 0.47, 0.37, 0.4, { overhang: 0.02, ridgeK: 1 });
  kit.door(0, z0 + bd / 2 - 0.05, 0.35, { w: 2 * M, h: 3 * M, canopy: null });
  for (let i = -2; i <= 2; i++) if (i) kit.cyl('marble', i * 0.11, 0, z0 + bd / 2 + 0.17, 0.02, 0.32, { seg: 8 });
  if (D2(c)) { kit.cyl('metal_light', 0.6, 0, 0.65, 0.008, 0.7, { seg: 5 }); kit.box('paint_red', 0.65, 0.58, 0.65, 0.1, 0.06, 0.004); trees(kit, c.rng, [[-0.7, 0.7], [0.75, 0.75], [-0.75, 0.35]]); }
  return kit.build();
});
fb('elderly_care shelter', 1, (c) => {
  const o = civic(c, { floors: 3, wall: c.key === 'shelter' ? 'concrete_panel' : 'plaster_cream', roof: c.key === 'shelter' ? 'flat' : 'gable', roofMat: 'roof_tiles_red', band: c.key === 'shelter' ? 'paint_orange' : null, bd: 0.55 });
  if (c.key !== 'shelter') c.kit.balconies('front', 0, o.z0, o.bw, o.bd, 0, 3, FLOOR, {});
  if (D2(c)) trees(c.kit, c.rng, [[-c.W * 0.4, c.D * 0.38], [c.W * 0.4, c.D * 0.38]]);
  return c.kit.build();
});
fb('cemetery', 1, (c) => {
  const { kit, rng, W, D } = c;
  parkBase(c, { trees: 5, paths: true });
  kit.hedge(0, -D / 2 + 0.04, W - 0.08, 0.06); kit.hedge(-W / 2 + 0.04, 0, 0.06, D - 0.08); kit.hedge(W / 2 - 0.04, 0, 0.06, D - 0.08);
  const n = c.detail >= 2 ? 6 : c.detail === 1 ? 4 : 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = -W / 2 + 0.2 + i * ((W - 0.4) / (n - 1)), z = -D / 2 + 0.2 + j * ((D - 0.4) / (n - 1));
    if (Math.abs(x) < 0.12 || Math.abs(z) < 0.12) continue;
    kit.box(pick(rng, ['stone_grey', 'stone_dark', 'marble']), x, 0, z, 0.05, 0.06 + rng() * 0.03, 0.015);
  }
  kit.box('stone_grey', 0.55, 0, -0.55, 0.35, 0.3, 0.5);
  roof(kit, 'gable', 'roof_slate', 0.55, 0.3, -0.55, 0.35, 0.5, { wall: 'stone_grey', ridge: 'z', h: 0.2 });
  kit.box('stone_grey', 0.55, 0, -0.32, 0.1, 0.55, 0.1);
  kit.cone('roof_slate', 0.55, 0.55, -0.32, 0.08, 0.2, { seg: 4 });
  return kit.build();
});
fb('crematorium', 1, (c) => {
  const o = civic(c, { floors: 1, wall: 'stone_grey', roof: 'flat', bd: 0.55 });
  stack(c.kit, o.bw / 2 - 0.1, o.z0 - o.bd / 2 + 0.1, 0.05, 0.85, 'brick_dark', { amount: 0.4 });
  return c.kit.build();
});
fb('prison', 1, (c) => {
  const { kit, W, D } = c;
  ground(kit, W, D, 'concrete', 0.01);
  kit.box('concrete', 0, 0, -D / 2 + 0.05, W - 0.04, 0.32, 0.06); kit.box('concrete', 0, 0, D / 2 - 0.05, W - 0.04, 0.32, 0.06);
  kit.box('concrete', -W / 2 + 0.05, 0, 0, 0.06, 0.32, D - 0.04); kit.box('concrete', W / 2 - 0.05, 0, 0, 0.06, 0.32, D - 0.04);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { kit.box('concrete', x * (W / 2 - 0.08), 0, z * (D / 2 - 0.08), 0.14, 0.55, 0.14); kit.box('glass_window', x * (W / 2 - 0.08), 0.45, z * (D / 2 - 0.08), 0.15, 0.06, 0.15, { lit: 0.9 }); kit.box('roof_metal_grey', x * (W / 2 - 0.08), 0.52, z * (D / 2 - 0.08), 0.18, 0.03, 0.18); }
  for (const x of [-0.7, 0.7]) { body(kit, x, -0.15, 0.8, 0.6, 4, 'concrete_panel', { winW: 0.6 * M, winH: 1.0 * M, spacing: 1.8 * M, frame: 'window_frame_dark' }); roof(kit, 'flat', null, x, 4 * FLOOR, -0.15, 0.8, 0.6, {}); }
  kit.box('sports_turf', 0, 0, 0.55, 0.8, 0.012, 0.45);
  return kit.build();
});

// --- Bildung
fb('school highschool kindergarten', 2, (c) => {
  const { kit, rng, key, W, D } = c;
  ground(kit, W, D, 'grass', 0.01);
  if (key === 'kindergarten') {
    const wall = pick(rng, ['plaster_yellow', 'plaster_pink', 'plaster_green']);
    house(kit, c, -0.1, -0.15, 0.62, 0.5, 1, wall, 'roof_tiles_red', { chimney: false });
    kit.box('sand', 0.25, 0, 0.3, 0.3, 0.012, 0.25);
    if (D2(c)) { kit.box('paint_red', 0.2, 0, 0.3, 0.06, 0.12, 0.06); kit.box('paint_blue', 0.32, 0, 0.25, 0.03, 0.08, 0.16, { rx: 0.5 }); }
    kit.fence(0, D / 2 - 0.03, W - 0.06, 0, 'paint_white', 0.8 * M);
    return kit.build();
  }
  const big = key === 'highschool';
  const bw = W * (big ? 0.62 : 0.55), bd = big ? 0.6 : 0.62, x0 = -W / 2 + bw / 2 + 0.06, z0 = -D / 2 + bd / 2 + 0.06;
  const wall = pick(rng, ['brick_yellow', 'brick_red', 'plaster_cream']);
  const top = body(kit, x0, z0, bw, bd, big ? 4 : 3, wall, { sill: 'trim_stone', cornice: 'trim_stone', spacing: 2.4 * M, winW: 1.6 * M });
  kit.door(x0, z0, bd, { w: 2.2 * M, canopy: 'concrete' });
  roof(kit, 'gable', 'roof_tiles_red', x0, top, z0, bw, bd, { wall, ridge: 'x' });
  if (big) { body(kit, x0 - bw / 2 + 0.25, z0 + bd / 2 + 0.35, 0.5, 0.7, 3, wall, { spacing: 2.4 * M }); roof(kit, 'flat', null, x0 - bw / 2 + 0.25, 3 * FLOOR, z0 + bd / 2 + 0.35, 0.5, 0.7, {}); }
  const cx = W / 2 - (W - bw) / 2 + 0.02, cw = W - bw - 0.18;
  kit.box('rubber_track', cx, 0, 0, cw, 0.012, D - 0.2);
  if (c.detail >= 1) { kit.box('court_blue', cx, 0.012, 0, cw * 0.7, 0.004, D * 0.6); kit.box('paint_white', cx, 0.017, 0, cw * 0.7, 0.002, 0.01); }
  if (D2(c)) trees(kit, rng, [[-W / 2 + 0.15, D / 2 - 0.15], [x0 + bw / 2 - 0.1, D / 2 - 0.15]]);
  return kit.build();
});
fb('university research library museum', 1, (c) => {
  const { kit, rng, key, W, D } = c;
  ground(kit, W, D, key === 'library' ? 'pavers' : 'grass', 0.01);
  if (key === 'research') {
    kit.box('metal_panel_white', -0.2, 0, -0.2, 1.1, 0.9, 0.8);
    for (const s of ['front', 'left', 'right']) kit.curtainWall(s, -0.2, -0.2, 1.1, 0.8, 0.05, 0.8, { glass: 'glass_curtain_green' });
    roof(kit, 'flat', null, -0.2, 0.9, -0.2, 1.1, 0.8, { clutter: 3 });
    kit.cyl('marble', 0.6, 0, 0.5, 0.25, 0.2, { seg: 20 }); kit.dome('marble', 0.6, 0.2, 0.5, 0.25, { seg: 20 });
    if (D2(c)) kit.cyl('metal_light', -0.5, 0.9, -0.4, 0.01, 0.6, { seg: 5 });
    return kit.build();
  }
  const scale = key === 'library' ? 0.5 : key === 'museum' ? 0.8 : 1;
  const bw = W * (key === 'university' ? 0.4 : 0.8), bd = D * 0.5;
  const top = body(kit, 0, -D * 0.12, bw, bd, key === 'library' ? 2 : 3, 'stone_sandstone', { sill: 'trim_stone', cornice: 'trim_stone', spacing: 2.4 * M, frame: 'window_frame_white' });
  roof(kit, key === 'museum' ? 'flat' : 'gable', 'roof_copper', 0, top, -D * 0.12, bw, bd, { wall: 'stone_sandstone', ridge: 'x', h: 0.18 * scale });
  // Säulenportikus
  const pz = -D * 0.12 + bd / 2 + 0.08;
  for (let i = 0; i < 6; i++) kit.cyl('marble', -bw * 0.35 + (i * bw * 0.7) / 5, 0.05, pz, 0.025 * (scale + 0.4), top - 0.12, { seg: 10 });
  kit.box('marble', 0, 0, pz, bw * 0.8, 0.05, 0.2);
  kit.gableRoof('marble', 0, top - 0.07, pz - 0.02, bw * 0.8, 0.22, 0.1, { ridge: 'z', overhang: 0.01 });
  kit.gableEnds('marble', 0, top - 0.07, pz - 0.02, bw * 0.8, 0.22, 0.1, { ridge: 'z' });
  if (key === 'museum') { kit.dome('glass_skylight', 0, top, -D * 0.12, Math.min(bw, bd) * 0.3, { seg: 16 }); }
  if (key === 'university') {
    for (const sx of [-1, 1]) { const x = sx * (W / 2 - 0.45); body(kit, x, -0.1, 0.7, 1.1, 3, 'brick_red', { spacing: 2.4 * M, sill: true }); roof(kit, 'gable', 'roof_slate', x, 3 * FLOOR, -0.1, 0.7, 1.1, { wall: 'brick_red', ridge: 'z' }); }
    path(kit, 0, D * 0.3, 0.2, D * 0.4);
    if (D2(c)) trees(kit, rng, [[-0.5, 0.75], [0.5, 0.75], [-0.9, 0.75], [0.9, 0.75]]);
  }
  return kit.build();
});

// --- Parks und Freizeit
fb('park dog_park', 3, (c) => { parkBase(c, {}); if (c.key === 'dog_park') chainFence(c.kit, c, c.W, c.D, { h: 1.2 * M }); return c.kit.build(); });
fb('plaza', 2, (c) => {
  const { kit, rng, W, D } = c;
  ground(kit, W, D, 'pavers', 0.005);
  kit.cyl('stone_grey', 0, 0, 0, 0.26, 0.05, { seg: 20 });
  kit.cyl('water_pool', 0, 0.04, 0, 0.23, 0.015, { seg: 20 });
  kit.cyl('stone_grey', 0, 0.04, 0, 0.04, 0.16, { seg: 10 });
  kit.cyl('stone_grey', 0, 0.2, 0, 0.09, 0.02, { seg: 12 });
  for (const [x, z] of [[-0.36, -0.36], [0.36, -0.36], [-0.36, 0.36], [0.36, 0.36]]) kit.tree(x, z, range(rng, 0.7, 0.95));
  if (D2(c)) { bench(kit, c, 0, -0.38); bench(kit, c, 0, 0.38); lamp(kit, c, -0.2, 0.2); lamp(kit, c, 0.2, -0.2); }
  return kit.build();
});
fb('citypark pond_park botanical', 2, (c) => {
  const { kit, key, W, D } = c;
  parkBase(c, { trees: Math.round(W * D * 2.2) });
  kit.cyl('sand', W * 0.12, 0, D * 0.1, Math.min(W, D) * 0.28, 0.04, { seg: 24 });
  kit.cyl('water_pool', W * 0.12, 0.02, D * 0.1, Math.min(W, D) * 0.25, 0.025, { seg: 24 });
  if (key === 'pond_park' && D2(c)) kit.box('wood_planks', W * 0.12, 0.04, D * 0.1 + Math.min(W, D) * 0.2, 0.06, 0.012, 0.3);
  if (key === 'botanical') for (let i = 0; i < 2; i++) { const x = -W / 2 + 0.5 + i * 0.8; kit.box('glass_skylight', x, 0, -D / 2 + 0.35, 0.6, 0.25, 0.4); kit.prism('glass_skylight', [[-0.2, 0], [0.2, 0], [0, 0.18]], 0.6, { x, y: 0.25, z: -D / 2 + 0.35, ry: Math.PI / 2 }); }
  return kit.build();
});
fb('sports tennis skatepark playground', 1, (c) => {
  const { kit, key, W, D } = c;
  ground(kit, W, D, 'grass', 0.01);
  if (key === 'playground' || key === 'skatepark') {
    kit.box(key === 'skatepark' ? 'concrete' : 'sand', 0, 0, 0, W - 0.2, 0.012, D - 0.2);
    if (key === 'skatepark') { kit.prism('concrete', [[-0.15, 0], [0.15, 0], [0.15, 0.1]], 0.35, { x: -0.2, z: 0 }); kit.prism('concrete', [[-0.15, 0], [0.15, 0], [-0.15, 0.1]], 0.35, { x: 0.2, z: 0 }); }
    else if (D2(c)) { kit.box('paint_red', -0.2, 0, -0.1, 0.14, 0.18, 0.14); kit.box('paint_blue', 0.0, 0, -0.1, 0.05, 0.16, 0.3, { rx: 0.55 }); kit.box('paint_yellow', 0.25, 0, 0.2, 0.25, 0.14, 0.02); kit.box('metal_dark', 0.25, 0, 0.2, 0.02, 0.16, 0.2); }
    kit.tree(-0.38, 0.38, 0.8); kit.tree(0.38, -0.38, 0.85);
    return kit.build();
  }
  const turf = key === 'tennis' ? 'court_blue' : 'sports_turf';
  kit.box(key === 'tennis' ? 'rubber_track' : 'rubber_track', 0, 0, 0, W - 0.1, 0.01, D - 0.1);
  kit.box(turf, 0, 0.01, 0, W - 0.4, 0.004, D - 0.4);
  if (c.detail >= 1) { kit.box('paint_white', 0, 0.015, 0, 0.012, 0.002, D - 0.4); kit.cyl('paint_white', 0, 0.014, 0, 0.12, 0.002, { seg: 20 }); kit.cyl(turf, 0, 0.015, 0, 0.11, 0.002, { seg: 20 }); }
  if (key === 'sports') { kit.box('concrete', 0, 0, -D / 2 + 0.12, W * 0.6, 0.12, 0.12); kit.box('roof_metal_grey', 0, 0.2, -D / 2 + 0.12, W * 0.62, 0.02, 0.16); kit.box('metal_dark', 0, 0, -D / 2 + 0.05, 0.02, 0.2, 0.02); }
  chainFence(kit, c, W, D, { h: 3 * M, gap: 0.2 });
  return kit.build();
});
fb('allotment', 2, (c) => {
  const { kit, rng, W, D } = c;
  ground(kit, W, D, 'grass', 0.01);
  path(kit, 0, 0, 0.08, D - 0.05, 'gravel');
  for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) {
    const x = (i ? 1 : -1) * W * 0.25, z = -D / 2 + 0.33 + j * (D - 0.4) / 3;
    kit.box(pick(rng, ['field_crops', 'field_soil', 'dirt']), x + 0.08, 0.005, z, W * 0.25, 0.012, 0.36);
    kit.box(pick(rng, ['wood_planks', 'siding_red', 'siding_blue', 'siding_white']), x - W * 0.14, 0, z, 0.12, 0.08, 0.1);
    kit.box('roof_tiles_brown', x - W * 0.14, 0.08, z, 0.14, 0.015, 0.12);
    if (D2(c)) kit.hedge(x, z + 0.2, W * 0.45, 0.025, 0.06);
  }
  return kit.build();
});
fb('swimming_pool beach', 1, (c) => {
  const { kit, rng, key, W, D } = c;
  ground(kit, W, D, key === 'beach' ? 'sand' : 'grass', 0.01);
  if (key === 'swimming_pool') {
    kit.box('tile_white', -0.2, 0, 0.05, 1.1, 0.04, 0.8);
    kit.box('water_pool', -0.2, 0.025, 0.05, 1.0, 0.02, 0.7);
    kit.box('tile_white', 0.65, 0, -0.5, 0.35, 0.03, 0.35); kit.box('water_pool', 0.65, 0.02, -0.5, 0.28, 0.015, 0.28);
    kit.box('plaster_white', 0.55, 0, 0.55, 0.7, 0.25, 0.4); roof(kit, 'flat', null, 0.55, 0.25, 0.55, 0.7, 0.4, {});
  }
  if (D2(c)) for (let i = 0; i < 8; i++) { const x = (rng() - 0.5) * (W - 0.3), z = key === 'beach' ? -D / 2 + 0.2 + rng() * 0.4 : D / 2 - 0.15; kit.cyl('metal_light', x, 0, z, 0.005, 0.18, { seg: 4 }); kit.cone(pick(rng, ['awning_red', 'awning_blue', 'awning_yellow', 'canvas_white']), x, 0.15, z, 0.1, 0.05, { seg: 8 }); }
  chainFence(kit, c, W, D, { h: 1.6 * M });
  return kit.build();
});

// --- Wahrzeichen
fb('ferris', 1, (c) => {
  const { kit, rng, W, D } = c;
  ground(kit, W, D, 'pavers', 0.01);
  const R = 0.85, hy = 1.12;
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) kit.box('paint_white', sx * 0.26, 0, sz * 0.14, 0.04, hy * 1.04, 0.04, { rz: -sx * 0.24, rx: sz * 0.12 });
  kit.box('stone_grey', 0, 0, 0, 0.9, 0.08, 0.5);
  kit.box('plaster_white', 0.7, 0, 0.65, 0.35, 0.2, 0.25); kit.box('awning_striped', 0.7, 0.2, 0.65, 0.4, 0.03, 0.3);
  const k2 = new Kit(rng, c.detail);
  const tor = new THREE.TorusGeometry(R, 0.022, 6, 40);
  k2.add('paint_white', tor, { x: 0, y: hy, z: 0.04 });
  k2.add('paint_white', new THREE.TorusGeometry(R, 0.022, 6, 40), { x: 0, y: hy, z: -0.04 });
  k2.cyl('metal_light', 0, hy - 0.06, 0, 0.06, 0.12, { seg: 10, rx: Math.PI / 2 });
  const cols = ['paint_red', 'paint_blue', 'paint_yellow', 'paint_green', 'paint_orange', 'paint_white'];
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    k2.box('paint_white', 0, hy, 0, 0.012, R, 0.012, { rz: -a });
    k2.box(cols[k % 6], Math.sin(a) * R, hy + Math.cos(a) * R - 0.07, 0, 0.1, 0.09, 0.09);
  }
  const res = kit.build();
  res.anim = [];
  for (const m of k2.build().meshes) res.anim.push({ geometry: m.geometry, material: m.material, pivot: [0, hy, 0], axis: 'z', speed: 0.22, local: false });
  return res;
});
fb('tvtower skytower', 1, (c) => {
  const { kit, key, W, D } = c;
  ground(kit, W, D, 'pavers', 0.01);
  if (key === 'skytower') {
    const fl = 40;
    kit.box('concrete_panel', 0, 0, 0, 0.9, fl * FLOOR, 0.9);
    for (const s of ['front', 'back', 'left', 'right']) kit.curtainWall(s, 0, 0, 0.9, 0.9, 0.3, fl * FLOOR - 0.3, { glass: 'glass_curtain_blue' });
    kit.box('metal_light', 0, fl * FLOOR, 0, 0.7, 0.4, 0.7);
    kit.box('emissive_cool', 0, fl * FLOOR + 0.2, 0, 0.72, 0.04, 0.72);
    kit.cyl('metal_light', 0, fl * FLOOR + 0.4, 0, 0.02, 1.4, { seg: 6, rTop: 0.005 });
    kit.light(0, fl * FLOOR + 1.8, 0, 0xff3020, 0.5);
    return kit.build();
  }
  kit.cyl('concrete', 0, 0, 0, 0.16, 0.25, { seg: 16 });
  kit.cyl('concrete', 0, 0.25, 0, 0.09, 4.2, { seg: 16, rTop: 0.06 });
  kit.sphere('metal_light', 0, 4.35, 0, 0.3, { seg: 20 });
  kit.cyl('glass_curtain_gold', 0, 4.28, 0, 0.305, 0.1, { seg: 24 });
  kit.cyl('paint_red', 0, 4.65, 0, 0.03, 0.6, { seg: 8 });
  kit.cyl('paint_white', 0, 5.25, 0, 0.02, 0.6, { seg: 8, rTop: 0.005 });
  kit.light(0, 5.85, 0, 0xff3020, 0.5);
  kit.light(0, 4.33, 0.31, 0xffd27a, 0.6);
  return kit.build();
});
fb('stadium arena', 1, (c) => {
  const { kit, key, W, D } = c;
  ground(kit, W, D, 'pavers', 0.01);
  const rx = W * 0.46, rz = D * 0.4;
  kit.add('concrete_panel', new THREE.CylinderGeometry(1, 1, 0.64, 40, 1, true), { x: 0, y: 0.32, z: 0, sx: rx, sz: rz });
  kit.add('concrete_dark', new THREE.LatheGeometry([new THREE.Vector2(0.99, 0.62), new THREE.Vector2(0.62, 0.04)], 40), { x: 0, y: 0, z: 0, sx: rx, sz: rz });
  if (key === 'arena') { kit.dome('roof_metal_grey', 0, 0.62, 0, 1, { seg: 32, sx: rx, sy: 0.3, sz: rz }); }
  else {
    kit.add('sports_turf', new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), { x: 0, y: 0.02, z: 0, sx: rx * 0.6, sz: rz * 0.55 });
    kit.box('sports_turf', 0, 0.01, 0, rx * 1.05, 0.012, rz * 0.95);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; const x = Math.cos(a) * rx * 1.02, z = Math.sin(a) * rz * 1.02; kit.cyl('metal_light', x, 0, z, 0.03, 1.15, { seg: 6 }); kit.box('emissive_cool', x, 1.15, z, 0.18, 0.08, 0.05, { ry: -a }); kit.light(x, 1.18, z, 0xf2f6ff, 0.7); }
    kit.add('roof_metal_grey', new THREE.RingGeometry(0.72, 1.02, 40).rotateX(-Math.PI / 2), { x: 0, y: 0.66, z: 0, sx: rx, sz: rz });
    kit.add('roof_metal_grey', new THREE.RingGeometry(0.72, 1.02, 40).rotateX(Math.PI / 2), { x: 0, y: 0.659, z: 0, sx: rx, sz: rz });
  }
  return kit.build();
});
fb('opera', 1, (c) => {
  const { kit, W, D } = c;
  ground(kit, W, D, 'marble', 0.01);
  kit.box('marble', 0, 0, 0, 1.8, 0.16, 1.6);
  for (const [x, z, s, r] of [[-0.45, 0.2, 0.6, 0.3], [0.1, 0, 0.75, 0.5], [0.55, -0.2, 0.5, 0.7]]) {
    kit.add('paint_white', new THREE.SphereGeometry(1, 20, 10, 0, Math.PI, 0, Math.PI / 2), { x, y: 0.16, z, sx: s * 0.6, sy: s * 1.2, sz: s, ry: r });
  }
  kit.curtainWall('front', 0, 0, 1.4, 1.6, 0.16, 0.25, { glass: 'glass_curtain_gold' });
  return kit.build();
});
fb('observatory', 1, (c) => {
  const { kit } = c;
  ground(kit, c.W, c.D, 'grass', 0.01);
  body(kit, 0, 0, 0.6, 0.6, 2, 'stone_sandstone', { spacing: 2.4 * M });
  kit.cyl('stone_sandstone', 0, 0.6, 0, 0.3, 0.1, { seg: 20 });
  kit.dome('metal_light', 0, 0.7, 0, 0.29, { seg: 24 });
  kit.box('metal_dark', 0, 0.72, 0.15, 0.06, 0.25, 0.04, { rx: -0.6 });
  return kit.build();
});
fb('doener', 1, (c) => {
  const { kit, rng, W, D } = c;
  ground(kit, W, D, 'pavers', 0.01);
  const bw = 0.82, bd = 0.6, z0 = -0.12;
  kit.box('brick_dark', 0, 0, z0, bw, 0.45, bd);
  shopFront(kit, c, 0, z0, bw, bd, 'awning_yellow', null, { gh: 3.4 * M });
  kit.windows('left', 0, z0, bw, bd, 0, 1, 0.42, {});
  kit.flatRoof('roof_flat_membrane', 'paint_yellow', 0, 0.45, z0, bw, bd, {});
  // Großes gelbes „M" auf dem Dach (leuchtet)
  const mx = 0, my = 0.48, mz = z0 + bd / 2 - 0.05;
  kit.box('neon_yellow', mx - 0.12, my, mz, 0.05, 0.26, 0.04);
  kit.box('neon_yellow', mx + 0.12, my, mz, 0.05, 0.26, 0.04);
  kit.box('neon_yellow', mx - 0.06, my + 0.12, mz, 0.04, 0.16, 0.04, { rz: 0.6 });
  kit.box('neon_yellow', mx + 0.06, my + 0.12, mz, 0.04, 0.16, 0.04, { rz: -0.6 });
  sign(kit, 'emissive_warm', 0, 0.3, z0 + bd / 2 + 0.01, 0.5, 0.07);
  kit.light(0, 0.6, mz + 0.05, 0xffd43f, 0.7);
  // Drehender Spieß im Schaufenster
  const k2 = new Kit(rng, c.detail);
  k2.cyl('log_wood', 0.2, 0.06, z0 + bd / 2 + 0.06, 0.035, 0.22, { rTop: 0.055, seg: 10 });
  k2.cyl('metal_light', 0.2, 0.03, z0 + bd / 2 + 0.06, 0.006, 0.3, { seg: 4 });
  const res = kit.build();
  res.anim = k2.build().meshes.map((m) => ({ geometry: m.geometry, material: m.material, pivot: [0.2, 0.1, z0 + bd / 2 + 0.06], axis: 'y', speed: 1.3, local: false }));
  if (D2(c)) for (let i = -1; i <= 1; i += 2) { kit.cyl('metal_dark', i * 0.3, 0, D / 2 - 0.15, 0.03, 0.07, { seg: 8 }); kit.cone('awning_red', i * 0.3, 0.16, D / 2 - 0.15, 0.1, 0.05, { seg: 8 }); }
  return res;
});
let beamMat = null;
function lighthouseBeam() {
  if (!beamMat) beamMat = new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false });
  return beamMat;
}
fb('lighthouse', 1, (c) => {
  const { kit } = c;
  ground(kit, c.W, c.D, 'rock', 0.01);
  kit.cyl('stone_grey', 0, 0, 0, 0.22, 0.12, { seg: 16 });
  for (let i = 0; i < 4; i++) kit.cyl(i % 2 ? 'paint_white' : 'paint_red', 0, 0.12 + i * 0.45, 0, 0.17 - i * 0.02, 0.45, { rTop: 0.15 - i * 0.02, seg: 16 });
  kit.cyl('metal_dark', 0, 1.92, 0, 0.12, 0.03, { seg: 16 });
  kit.cyl('glass_window', 0, 1.95, 0, 0.08, 0.14, { seg: 12, lit: 0.99 });
  kit.cone('metal_dark', 0, 2.09, 0, 0.1, 0.1, { seg: 12 });
  kit.light(0, 2.02, 0, 0xfff1b8, 1.0);
  const res = kit.build();
  const beam = new THREE.ConeGeometry(0.35, 3.0, 12, 1, true);
  beam.rotateZ(Math.PI / 2);
  beam.translate(1.5, 0, 0);
  res.anim = [{ geometry: beam, material: lighthouseBeam(), pivot: [0, 2.02, 0], axis: 'y', speed: 0.9, local: true, nightOnly: true }];
  return res;
});
fb('cathedral', 1, (c) => {
  const { kit, W, D } = c;
  ground(kit, W, D, 'pavers', 0.01);
  const nw = 0.7, nl = 2.1;
  kit.box('stone_sandstone', 0, 0, -0.2, nw, 0.9, nl);
  kit.windows('left', 0, -0.2, nw, nl, 0.2, 1, 0.6, { winW: 1.6 * M, winH: 4.5 * M, spacing: 3.2 * M, glass: 'glass_curtain_gold', frame: 'trim_stone' });
  kit.windows('right', 0, -0.2, nw, nl, 0.2, 1, 0.6, { winW: 1.6 * M, winH: 4.5 * M, spacing: 3.2 * M, glass: 'glass_curtain_gold', frame: 'trim_stone' });
  roof(kit, 'gable', 'roof_copper', 0, 0.9, -0.2, nw, nl, { wall: 'stone_sandstone', ridge: 'z', h: 0.5 });
  kit.box('stone_sandstone', 0, 0, -0.35, 1.6, 0.8, 0.5);
  roof(kit, 'gable', 'roof_copper', 0, 0.8, -0.35, 1.6, 0.5, { wall: 'stone_sandstone', ridge: 'x', h: 0.45 });
  for (const sx of [-1, 1]) {
    kit.box('stone_sandstone', sx * 0.32, 0, 1.0, 0.4, 2.2, 0.4);
    kit.windows('front', sx * 0.32, 1.0, 0.4, 0.4, 0.6, 3, 0.45, { winW: 1 * M, winH: 2.6 * M, spacing: 2 * M, frame: 'trim_stone' });
    kit.cone('roof_copper', sx * 0.32, 2.2, 1.0, 0.28, 1.1, { seg: 8 });
  }
  kit.add('glass_curtain_gold', new THREE.CircleGeometry(0.16, 20), { x: 0, y: 1.25, z: 1.21 });
  kit.door(0, 1.0, 0.4, { w: 2.6 * M, h: 4 * M, canopy: null });
  return kit.build();
});
fb('castle citygate', 1, (c) => {
  const { kit, key, W, D } = c;
  ground(kit, W, D, key === 'castle' ? 'grass' : 'pavers', 0.01);
  const tower = (x, z, r, h) => { kit.cyl('stone_grey', x, 0, z, r, h, { seg: 14 }); kit.cone('roof_slate', x, h, z, r * 1.2, r * 2.2, { seg: 14 }); };
  if (key === 'citygate') {
    for (const sx of [-1, 1]) { kit.box('brick_red', sx * 0.55, 0, 0, 0.6, 0.7, 0.5); }
    kit.box('brick_red', 0, 0.38, 0, 0.5, 0.32, 0.5);
    tower(-0.85, 0, 0.18, 1.1); tower(0.85, 0, 0.18, 1.1);
    kit.box('brick_red', 0, 0.7, 0, 1.2, 0.35, 0.45);
    kit.gableRoof('roof_tiles_red', 0, 1.05, 0, 1.2, 0.45, 0.32, { ridge: 'x' }); kit.gableEnds('brick_red', 0, 1.05, 0, 1.2, 0.45, 0.32, { ridge: 'x' });
    return kit.build();
  }
  kit.box('stone_grey', 0, 0, -0.2, 1.8, 0.8, 1.0);
  kit.windows('front', 0, -0.2, 1.8, 1.0, 0, 3, 0.26, { spacing: 2.4 * M, sill: 'trim_stone' });
  roof(kit, 'hip', 'roof_slate', 0, 0.8, -0.2, 1.8, 1.0, { h: 0.35 });
  for (const [x, z] of [[-0.95, -0.75], [0.95, -0.75], [-0.95, 0.35], [0.95, 0.35]]) tower(x, z, 0.2, 1.1);
  kit.cyl('water_pool', 0, 0.01, 0.95, 0.25, 0.02, { seg: 20 });
  path(kit, 0, 0.6, 0.25, 0.6);
  if (D2(c)) trees(kit, c.rng, [[-1.2, 1.1], [1.2, 1.1], [-0.6, 1.2], [0.6, 1.2]]);
  return kit.build();
});
fb('windmill', 1, (c) => {
  const { kit, rng } = c;
  ground(kit, c.W, c.D, 'grass', 0.01);
  kit.cyl('stone_grey', 0, 0, 0, 0.22, 0.65, { rTop: 0.16, seg: 12 });
  kit.cone('wood_dark', 0, 0.65, 0, 0.2, 0.22, { seg: 12 });
  kit.door(0, 0, 0.36, { w: 0.9 * M, h: 1.8 * M, canopy: null, step: false });
  const k2 = new Kit(rng, c.detail);
  const hy = 0.72, hz = 0.2;
  k2.cyl('wood_dark', 0, hy - 0.02, hz, 0.025, 0.04, { seg: 8, rx: Math.PI / 2 });
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    k2.box('wood_planks', 0, hy, hz, 0.1, 0.54, 0.01, { rz: -a });
  }
  const res = kit.build();
  res.anim = k2.build().meshes.map((m) => ({ geometry: m.geometry, material: m.material, pivot: [0, hy, hz], axis: 'z', speed: 0.7, local: false }));
  return res;
});
fb('zoo themepark fairground', 1, (c) => {
  const { kit, rng, key, W, D } = c;
  parkBase(c, { trees: key === 'fairground' ? 4 : Math.round(W * D * 1.4) });
  if (key === 'fairground') {
    for (let i = 0; i < 2; i++) { const z = -D / 2 + 0.6 + i * 1.1; kit.box('metal_panel_white', -0.2, 0, z, W - 0.8, 0.45, 0.8); kit.add('roof_metal_grey', new THREE.CylinderGeometry(0.42, 0.42, W - 0.8, 20, 1, false, 0, Math.PI), { x: -0.2, y: 0.45, z, sx: 0.5, rz: Math.PI / 2 }); kit.curtainWall('front', -0.2, z, W - 0.8, 0.8, 0.05, 0.3, { glass: 'glass_curtain_blue' }); }
    sign(kit, 'neon_cyan', W / 2 - 0.25, 0.3, D / 2 - 0.3, 0.3, 0.12);
  } else if (key === 'zoo') {
    for (let i = 0; i < 4; i++) { const x = (i % 2 ? 0.6 : -0.6), z = i < 2 ? -0.6 : 0.6; kit.box(i % 2 ? 'sand' : 'grass_dry', x, 0, z, 0.9, 0.015, 0.9); kit.box('wood_planks', x, 0, z + 0.45, 0.9, 0.08, 0.02); kit.box('wood_dark', x + 0.25, 0, z - 0.25, 0.2, 0.12, 0.15); }
    kit.cyl('water_pool', 0, 0.01, 0, 0.25, 0.02, { seg: 20 });
  } else {
    // Freizeitpark: Riesenrad, Karussell, Achterbahn-Schiene
    const res = { anim: [] };
    const k2 = new Kit(rng, c.detail);
    k2.add('paint_red', new THREE.TorusGeometry(0.6, 0.02, 6, 36), { x: -1, y: 0.75, z: -1 });
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; k2.box(pick(rng, ['paint_yellow', 'paint_blue', 'paint_green']), -1 + Math.sin(a) * 0.6, 0.75 + Math.cos(a) * 0.6 - 0.05, -1, 0.07, 0.07, 0.07); }
    for (const sx of [-1, 1]) kit.box('paint_white', -1 + sx * 0.18, 0, -1, 0.03, 0.78, 0.03, { rz: -sx * 0.22 });
    for (const m of k2.build().meshes) res.anim.push({ geometry: m.geometry, material: m.material, pivot: [-1, 0.75, -1], axis: 'z', speed: 0.3, local: false });
    const k3 = new Kit(rng, c.detail);
    k3.cyl('awning_striped', 0.9, 0.05, 0.9, 0.35, 0.05, { seg: 16 }); k3.cone('awning_red', 0.9, 0.25, 0.9, 0.38, 0.18, { seg: 16 });
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; k3.box('paint_white', 0.9 + Math.sin(a) * 0.28, 0.1, 0.9 + Math.cos(a) * 0.28, 0.05, 0.06, 0.08, { ry: a }); }
    for (const m of k3.build().meshes) res.anim.push({ geometry: m.geometry, material: m.material, pivot: [0.9, 0, 0.9], axis: 'y', speed: 0.8, local: false });
    kit.cyl('metal_dark', 0.9, 0, 0.9, 0.02, 0.25, { seg: 6 });
    const curve = new THREE.CatmullRomCurve3([[-1.6, 0.2, 1], [-0.8, 0.9, 1.4], [0, 0.3, 1.2], [0.7, 0.7, 0], [0.2, 0.15, -0.6], [-0.6, 0.6, 0], [-1.6, 0.2, 1]].map((p) => new THREE.Vector3(...p)), true);
    kit.add('paint_blue', new THREE.TubeGeometry(curve, 80, 0.025, 5, true), { x: 0, y: 0, z: 0 });
    if (c.detail >= 1) for (let i = 0; i < 18; i++) { const p = curve.getPointAt(i / 18); kit.box('metal_light', p.x, 0, p.z, 0.015, p.y, 0.015); }
    return Object.assign(kit.build(), res);
  }
  return kit.build();
});

// --- Logistik und Verkehr
fb('warehouse food_factory sawmill market_hall', 2, (c) => {
  const { kit, rng, key } = c;
  if (key === 'market_hall') {
    const o = hall(c, { wall: 'brick_red', roof: 'gable', roofMat: 'glass_skylight', doors: 3, doorMat: 'door_wood', rh: 0.22, yard: false });
    for (let i = 0; i < 3; i++) kit.box(AWN[i], -o.bw / 2 + o.bw * (i + 0.5) / 3, 0.28, o.z0 + o.bd / 2 + 0.1, 0.3, 0.02, 0.2, { rx: 0.3 });
    return kit.build();
  }
  const o = hall(c, { wall: key === 'sawmill' ? 'wood_dark' : key === 'food_factory' ? 'metal_panel_white' : pick(rng, ['metal_corrugated', 'metal_panel_blue']), roof: key === 'warehouse' ? 'flat' : 'saw', chimney: key === 'food_factory' ? 1 : 0 });
  if (key === 'food_factory') { tank(kit, o.bw / 2 - 0.1, -c.D / 2 + 0.25, 0.12, 0.6, 'tank_white', { ring: true }); tank(kit, o.bw / 2 - 0.4, -c.D / 2 + 0.25, 0.12, 0.6, 'tank_white', { ring: true }); }
  if (key === 'sawmill' && D2(c)) for (let r = 0; r < 3; r++) for (let k = 0; k < 4 - r; k++) kit.cyl('log_wood', -0.6 + k * 0.07 + r * 0.035, 0.03 + r * 0.06, c.D / 2 - 0.3, 0.032, 0.5, { seg: 7, rz: Math.PI / 2 });
  return kit.build();
});
fb('steelworks refinery', 1, (c) => {
  const { kit, key, W, D } = c;
  ground(kit, W, D, 'asphalt', 0.01);
  if (key === 'refinery') {
    for (let i = 0; i < 4; i++) tank(kit, -1.0 + i * 0.5, -0.5, 0.2, 0.35, 'tank_white', { ring: true });
    for (let i = 0; i < 3; i++) { kit.cyl('metal_light', 0.6 + i * 0.25, 0, 0.3, 0.06, 0.9 + i * 0.15, { seg: 10 }); }
    stack(kit, 1.2, -0.6, 0.04, 1.4, 'metal_dark', { amount: 0.8 });
    if (c.detail >= 1) { kit.box('pipe_metal', 0, 0.3, 0.0, 2.6, 0.04, 0.04); kit.box('pipe_metal', 0, 0.36, 0.05, 2.6, 0.04, 0.04); }
    kit.box('metal_panel_grey', -0.8, 0, 0.5, 0.8, 0.35, 0.5); roof(kit, 'flat', null, -0.8, 0.35, 0.5, 0.8, 0.5, {});
  } else {
    kit.box('metal_corrugated_red', -0.4, 0, 0, 1.6, 0.8, 1.2); roof(kit, 'gable', 'metal_corrugated', -0.4, 0.8, 0, 1.6, 1.2, { wall: 'metal_corrugated_red', ridge: 'x', h: 0.2 });
    kit.cyl('rust', 0.9, 0, -0.3, 0.22, 1.1, { seg: 14, rTop: 0.15 });
    stack(kit, 1.1, 0.4, 0.07, 1.9, 'brick_dark', { amount: 2 });
    stack(kit, 0.75, 0.45, 0.06, 1.7, 'brick_dark', { amount: 1.5 });
  }
  return kit.build();
});
fb('cargo_rail tram_depot train_station metro_hub bus_depot', 1, (c) => {
  const { kit, rng, key, W, D } = c;
  ground(kit, W, D, key === 'bus_depot' ? 'asphalt' : 'ballast', 0.01);
  if (key !== 'bus_depot') {
    const tracks = Math.max(2, Math.round(D * 2));
    for (let i = 0; i < tracks; i++) { const z = -D / 2 + 0.25 + i * (D - 0.5) / Math.max(1, tracks - 1); kit.box('rail_track', 0, 0.005, z, W - 0.1, 0.012, 0.15); if (c.detail >= 1) { kit.box('metal_light', 0, 0.017, z - 0.05, W - 0.1, 0.008, 0.01); kit.box('metal_light', 0, 0.017, z + 0.05, W - 0.1, 0.008, 0.01); } }
  }
  if (key === 'train_station' || key === 'metro_hub') {
    const ht = key === 'metro_hub' ? 0.5 : 0.65;
    kit.box('brick_red', 0, 0, D / 2 - 0.3, W * 0.5, 0.6, 0.5);
    kit.windows('front', 0, D / 2 - 0.3, W * 0.5, 0.5, 0, 2, 0.3, { winW: 1.6 * M, winH: 2.2 * M, spacing: 3 * M, frame: 'window_frame_dark' });
    roof(kit, 'hip', 'roof_slate', 0, 0.6, D / 2 - 0.3, W * 0.5, 0.5, { h: 0.2 });
    kit.add('glass_skylight', new THREE.CylinderGeometry((D - 0.8) / 2, (D - 0.8) / 2, W - 0.3, 20, 1, true, 0, Math.PI), { x: 0, y: ht, z: -0.15, rz: Math.PI / 2, sx: 0.6 });
    for (let i = 0; i < 5; i++) kit.box('metal_dark', -W / 2 + 0.2 + i * (W - 0.4) / 4, 0, -0.15, 0.03, ht, D - 0.9);
    kit.box('emissive_warm', 0, 0.62, D / 2 - 0.04, 0.6, 0.06, 0.02);
    return kit.build();
  }
  const o = hall(c, { wall: key === 'bus_depot' ? 'metal_panel_blue' : 'brick_red', roof: 'saw', doors: key === 'cargo_rail' ? 2 : 4, yard: false, bd: 0.55 });
  if (key === 'bus_depot' && D2(c)) for (let i = 0; i < 3; i++) kit.box('paint_yellow', -0.6 + i * 0.35, 0.03, D / 2 - 0.35, 0.25, 0.3, 1.1 * 0.6, { ry: 0 });
  if (key === 'cargo_rail' && D2(c)) for (let i = 0; i < 6; i++) kit.box(pick(rng, ['container_red', 'container_blue', 'container_green', 'container_yellow']), -W / 2 + 0.3 + i * 0.24, 0.03, D / 2 - 0.25, 0.22, 0.25, 0.6, { ry: Math.PI / 2 });
  void o;
  return kit.build();
});
fb('cargo_harbor', 1, (c) => {
  const { kit, rng, W, D } = c;
  ground(kit, W, D, 'concrete', 0.01);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) for (let h = 0; h < 1 + ((i + j) % 3); h++) kit.box(pick(rng, ['container_red', 'container_blue', 'container_green', 'container_yellow']), -1.1 + i * 0.3, h * 0.26, -0.4 + j * 0.3, 0.6, 0.26, 0.24);
  for (const x of [-0.8, 0.6]) {
    for (const sx of [-1, 1]) kit.box('paint_red', x + sx * 0.25, 0, 1.15, 0.05, 1.2, 0.05);
    kit.box('paint_red', x, 1.2, 0.9, 0.6, 0.08, 1.4);
    kit.box('metal_dark', x, 1.0, 1.3, 0.18, 0.18, 0.18);
  }
  return kit.build();
});
fb('airport', 1, (c) => {
  const { kit, W, D } = c;
  ground(kit, W, D, 'grass', 0.01);
  kit.box('tarmac', 0, 0, -D / 2 + 0.6, W - 0.2, 0.012, 0.6);
  if (c.detail >= 1) for (let i = 0; i < 14; i++) kit.box('runway_marking', -W / 2 + 0.5 + i * 0.38, 0.012, -D / 2 + 0.6, 0.18, 0.002, 0.03);
  kit.box('tarmac', 0, 0, 0.4, W * 0.7, 0.012, 1.4);
  kit.box('metal_panel_white', 0, 0, 1.4, W * 0.6, 0.45, 0.6);
  kit.curtainWall('back', 0, 1.4, W * 0.6, 0.6, 0.05, 0.38, { glass: 'glass_curtain_blue' });
  kit.curtainWall('front', 0, 1.4, W * 0.6, 0.6, 0.05, 0.38, { glass: 'glass_curtain_blue' });
  kit.add('roof_metal_grey', new THREE.CylinderGeometry(0.32, 0.32, W * 0.62, 24, 1, false, 0, Math.PI), { x: 0, y: 0.45, z: 1.4, rz: Math.PI / 2, sx: 0.35 });
  kit.cyl('concrete', W / 2 - 0.6, 0, 1.0, 0.08, 1.0, { seg: 12 });
  kit.cyl('glass_curtain_green', W / 2 - 0.6, 1.0, 1.0, 0.18, 0.15, { seg: 12 });
  kit.cyl('metal_dark', W / 2 - 0.6, 1.15, 1.0, 0.2, 0.03, { seg: 12 });
  kit.light(W / 2 - 0.6, 1.25, 1.0, 0xff3020, 0.4);
  return kit.build();
});
fb('parking taxi_depot snow_depot disaster_center weather_station warning_siren', 1, (c) => {
  const { kit, key, W, D } = c;
  if (key === 'parking') {
    ground(kit, W, D, 'concrete', 0.01);
    for (let f = 0; f < 4; f++) { kit.box('concrete', 0, f * 0.24, 0, W - 0.12, 0.04, D - 0.12); if (f) kit.box('concrete_panel', 0, f * 0.24 - 0.12, D / 2 - 0.07, W - 0.12, 0.08, 0.03); }
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kit.box('concrete', x * (W / 2 - 0.1), 0, z * (D / 2 - 0.1), 0.05, 0.96, 0.05);
    kit.box('concrete_panel', W / 2 - 0.15, 0, -D / 2 + 0.15, 0.2, 1.05, 0.2);
    sign(kit, 'emissive_cool', 0, 0.85, D / 2 - 0.06, 0.12, 0.12);
    return kit.build();
  }
  if (key === 'warning_siren' || key === 'weather_station') {
    ground(kit, W, D, 'grass', 0.01);
    if (key === 'warning_siren') { kit.cyl('metal_light', 0, 0, 0, 0.02, 0.9, { seg: 6 }); kit.box('paint_yellow', 0, 0.9, 0, 0.12, 0.08, 0.12); kit.cone('metal_dark', 0.08, 0.9, 0, 0.04, 0.08, { seg: 8, rz: -Math.PI / 2 }); }
    else { kit.box('paint_white', -0.15, 0, -0.1, 0.3, 0.2, 0.25); roof(kit, 'flat', null, -0.15, 0.2, -0.1, 0.3, 0.25, {}); kit.cyl('metal_light', 0.25, 0, 0.2, 0.008, 0.6, { seg: 5 }); kit.sphere('paint_white', 0.25, 0.65, 0.2, 0.06, { seg: 10 }); kit.box('paint_white', -0.3, 0, 0.3, 0.1, 0.14, 0.1); }
    return kit.build();
  }
  const o = civic(c, { floors: key === 'disaster_center' ? 3 : 2, wall: key === 'snow_depot' ? 'metal_corrugated' : 'plaster_white', band: key === 'taxi_depot' ? 'paint_yellow' : 'paint_orange', roof: key === 'snow_depot' ? 'gable' : 'flat', roofMat: 'roof_metal_grey', signMat: key === 'taxi_depot' ? 'neon_yellow' : 'emissive_warm', bd: 0.5 });
  if (key === 'snow_depot') kit.cone('sand', -c.W * 0.3, 0, c.D * 0.3, 0.16, 0.12, { seg: 8 });
  if (key === 'disaster_center') { kit.cyl('concrete', 0, 0.01, c.D / 2 - 0.3, 0.25, 0.02, { seg: 20 }); kit.box('paint_white', 0, 0.035, c.D / 2 - 0.3, 0.05, 0.004, 0.2); }
  void o;
  return kit.build();
});

// =====================================================================================================
// Baustellen-Teile
// =====================================================================================================
// Gerüst um den Baukörper (Modellkoordinaten). Wird über die Schnitthöhe mit dem Bau „hochgezogen".
function buildScaffold(rng, bx0, bx1, bz0, bz1, Ht, detail = 1) {
  const kit = new Kit(rng, 1);
  const off = 0.7 * M, dep = 0.75 * M, lift = 2 * M, bay = detail ? 2.6 * M : 6 * M, t = detail ? 0.13 * M : 0.2 * M;
  const levels = Math.max(1, Math.ceil((Ht + 0.12) / lift));
  const top = levels * lift + 1 * M;
  const sides = [
    [bx0 - off, bz1 + off, bx1 + off, bz1 + off, 0, 1], // vorne
    [bx1 + off, bz0 - off, bx0 - off, bz0 - off, 0, -1], // hinten
    [bx0 - off, bz0 - off, bx0 - off, bz1 + off, -1, 0], // links
    [bx1 + off, bz1 + off, bx1 + off, bz0 - off, 1, 0], // rechts
  ];
  for (const [ax, az, ex, ez, nx, nz] of sides) {
    const len = Math.hypot(ex - ax, ez - az);
    const n = Math.max(1, Math.round(len / bay));
    const ux = (ex - ax) / len, uz = (ez - az) / len;
    const phi = Math.atan2(-uz, ux); // lokale x-Achse entlang der Seite
    const mx = (ax + ex) / 2, mz = (az + ez) / 2;
    for (let i = 0; i <= n; i++) {
      const px = ax + ux * (i * len / n), pz = az + uz * (i * len / n);
      if (detail) kit.box('scaffold', px, 0, pz, t, top, t);
      kit.box('scaffold', px + nx * dep, 0, pz + nz * dep, t, top, t);
    }
    if (!detail) {
      // Fernansicht: Lagen als Bohlen, Netz als Bahnen
      for (let l = 2; l <= levels; l += 2) kit.box('wood_planks', mx + nx * dep / 2, l * lift - 0.06 * M, mz + nz * dep / 2, len + dep, 0.12 * M, dep, { ry: phi });
      if (rng() < 0.7) kit.box('scaffold_net', mx + nx * (dep + 0.06 * M), 0.3 * M, mz + nz * (dep + 0.06 * M), len * 0.92, top - 0.5 * M, 0.04 * M, { ry: phi });
      continue;
    }
    for (let l = 1; l <= levels; l++) {
      const y = l * lift;
      kit.box('wood_planks', mx + nx * dep / 2, y - 0.06 * M, mz + nz * dep / 2, len + dep, 0.08 * M, dep, { ry: phi });
      kit.box('scaffold', mx + nx * dep, y + 1 * M, mz + nz * dep, len + dep, 0.08 * M, 0.08 * M, { ry: phi });
      kit.box('scaffold', mx + nx * dep, y + 0.5 * M, mz + nz * dep, len + dep, 0.06 * M, 0.06 * M, { ry: phi });
      // Diagonalen auf der Außenseite (je Lage jedes zweite Feld, wechselnd)
      const bw = len / n, dl = Math.hypot(bw, lift), tilt = Math.atan2(bw, lift);
      for (let i = (l % 2); i < n; i += 2) {
        const start = (l % 4 < 2) ? i : i + 1;
        const px = ax + ux * (start * bw) + nx * (dep + 0.05 * M), pz = az + uz * (start * bw) + nz * (dep + 0.05 * M);
        kit.box('scaffold', px, y - lift, pz, 0.06 * M, dl, 0.06 * M, { ry: phi, rz: (l % 4 < 2) ? -tilt : tilt });
      }
    }
    // Schutznetze in Feldern (mit Lücken)
    for (let i = 0; i < n; i++) {
      if (rng() < 0.35) continue;
      const px = ax + ux * ((i + 0.5) * len / n) + nx * (dep + 0.06 * M), pz = az + uz * ((i + 0.5) * len / n) + nz * (dep + 0.06 * M);
      const h0 = lift * Math.floor(rng() * Math.min(2, levels));
      kit.box('scaffold_net', px, h0 + 0.2 * M, pz, len / n - 0.15 * M, top - h0 - 0.4 * M, 0.04 * M, { ry: phi });
    }
  }
  return kit.build();
}
// Bauzaun mit Tor, Baucontainer und Material; Kranmast (statisch) optional
function buildSiteGround(rng, W, D, bx0, bx1, bz0, bz1, detail = 1) {
  const kit = new Kit(rng, 2);
  const i = 0.06, h = 2 * M, panel = 3.5 * M;
  const runs = [
    [-W / 2 + i, -D / 2 + i, W / 2 - i, -D / 2 + i],
    [-W / 2 + i, -D / 2 + i, -W / 2 + i, D / 2 - i],
    [W / 2 - i, -D / 2 + i, W / 2 - i, D / 2 - i],
    [-W / 2 + i, D / 2 - i, -0.22, D / 2 - i],
    [0.22, D / 2 - i, W / 2 - i, D / 2 - i],
  ];
  for (const [ax, az, ex, ez] of runs) {
    const len = Math.hypot(ex - ax, ez - az);
    if (len < 0.05) continue;
    const phi = Math.atan2(-(ez - az), ex - ax);
    if (!detail) {
      kit.box('chain_fence', (ax + ex) / 2, 0, (az + ez) / 2, len, h, 0.05 * M, { ry: phi });
      continue;
    }
    const n = Math.max(1, Math.round(len / panel));
    for (let k = 0; k < n; k++) {
      const t0 = (k + 0.5) / n, px = ax + (ex - ax) * t0, pz = az + (ez - az) * t0;
      kit.box('chain_fence', px, 0.15 * M, pz, len / n - 0.05 * M, h - 0.15 * M, 0.04 * M, { ry: phi });
      kit.box('metal_light', px, h - 0.05 * M, pz, len / n, 0.06 * M, 0.06 * M, { ry: phi });
    }
    for (let k = 0; k <= n; k++) {
      const t0 = k / n, px = ax + (ex - ax) * t0, pz = az + (ez - az) * t0;
      kit.box('concrete', px, 0, pz, 0.25 * M, 0.15 * M, 0.6 * M, { ry: phi });
      kit.box('metal_light', px, 0, pz, 0.06 * M, h, 0.06 * M);
    }
  }
  // Tor mit rot-weißer Schranke
  for (let k = 0; k < (detail ? 6 : 2); k++) kit.box(k % 2 ? 'paint_white' : 'paint_red', -0.2 + (k + 0.5) * (0.4 / 6), 0.9 * M, D / 2 - i, 0.4 / 6, 0.12 * M, 0.06 * M);
  // Freie Fläche suchen (größter Abstand zwischen Baukörper und Grundstücksrand)
  const gaps = [
    { s: 'f', g: D / 2 - bz1, x: 0, z: (bz1 + D / 2) / 2 },
    { s: 'b', g: bz0 + D / 2, x: 0, z: (bz0 - D / 2) / 2 },
    { s: 'l', g: bx0 + W / 2, x: (bx0 - W / 2) / 2, z: 0 },
    { s: 'r', g: W / 2 - bx1, x: (bx1 + W / 2) / 2, z: 0 },
  ].sort((a, b) => b.g - a.g);
  const best = gaps[0];
  if (best.g > 0.14) {
    const along = best.s === 'f' || best.s === 'b';
    const cx = best.x + (along ? (rng() - 0.5) * W * 0.4 : 0), cz = best.z + (along ? 0 : (rng() - 0.5) * D * 0.4);
    const ry = along ? 0 : Math.PI / 2;
    kit.box('container_blue', cx, 0, cz, 0.6, 0.26, 0.24, { ry });
    if (rng() < 0.6) kit.box('container_yellow', cx + (along ? 0.05 : 0), 0.26, cz + (along ? 0 : 0.05), 0.6, 0.25, 0.24, { ry });
    if (!detail) return kit.build();
    kit.box('glass_window', cx + (along ? 0 : 0.122), 0.12, cz + (along ? 0.122 : 0), 0.3, 0.08, 0.002, { ry, lit: 0.95 });
    kit.box('wood_planks', cx + (along ? 0.42 : 0.1), 0, cz + (along ? 0.05 : 0.42), 0.12, 0.08, 0.1);
    kit.cone('gravel', cx - (along ? 0.45 : 0), 0, cz - (along ? 0 : 0.45), 0.1, 0.08, { seg: 6 });
    kit.box('paint_blue', cx + (along ? -0.38 : 0.14), 0, cz + (along ? 0.14 : -0.38), 0.11, 0.24, 0.11);
  } else {
    kit.box('wood_planks', W / 2 - 0.18, 0, D / 2 - 0.15, 0.12, 0.06, 0.1);
  }
  return kit.build();
}
// Drehbarer Kranausleger (Ursprung = Mastspitze)
function buildJib(size) {
  const kit = new Kit(mulberry32(size === 'L' ? 77 : 33), 2);
  const L = size === 'L' ? 2.7 : 1.5, Lc = size === 'L' ? 0.85 : 0.55, s = 0.15, t = 0.018;
  kit.cyl('metal_dark', 0, 0, 0, 0.11, 0.06, { seg: 12 });
  kit.box('paint_yellow', 0.05, 0.06, 0.13, 0.16, 0.16, 0.14);
  kit.box('glass_window', 0.05, 0.1, 0.205, 0.14, 0.09, 0.004, { lit: 0.95 });
  // Turmspitze
  kit.box('paint_yellow', 0, 0.06, 0, 0.05, 0.5, 0.05);
  // Ausleger (Dreiecksfachwerk) entlang +x
  for (const dz of [-1, 1]) kit.box('paint_yellow', L / 2, 0.06, dz * s / 2, L, t, t);
  kit.box('paint_yellow', L / 2, 0.06 + s * 0.85, 0, L, t, t);
  const nb = Math.round(L / 0.18);
  for (let k = 0; k <= nb; k++) {
    const x = (k * L) / nb;
    kit.box('paint_yellow', x, 0.06, 0, 0.01, 0.01, s);
    if (k < nb) for (const dz of [-1, 1]) kit.box('paint_yellow', x + L / nb / 2, 0.06, dz * s / 4, 0.01, Math.hypot(s * 0.85, s / 2) * 1.05, 0.01, { rx: dz * 0.53, rz: (k % 2 ? 1 : -1) * 0.5 });
  }
  // Gegenausleger mit Ballast
  kit.box('paint_yellow', -Lc / 2, 0.06, 0, Lc, 0.04, s);
  kit.box('concrete', -Lc + 0.12, 0.0, 0, 0.18, 0.14, 0.17);
  // Abspannungen
  const tie = (x1, y1) => kit.box('metal_dark', x1, y1, 0, 0.008, Math.hypot(x1, 0.56 - y1), 0.008, { rz: Math.atan2(x1, 0.56 - y1) });
  tie(L * 0.7, 0.06 + s * 0.85); tie(-Lc * 0.9, 0.1);
  // Laufkatze, Seil, Haken
  const tx = L * 0.62;
  kit.box('metal_dark', tx, 0.0, 0, 0.08, 0.05, s + 0.02);
  kit.box('metal_dark', tx, -0.62, 0, 0.006, 0.62, 0.006);
  kit.box('paint_red', tx, -0.7, 0, 0.05, 0.08, 0.04);
  return kit.build();
}

// =====================================================================================================
// Nachtlichter (res.lights) und Baustaub als Punktwolken
// =====================================================================================================
function makeLightMaterial(tex) {
  return new THREE.ShaderMaterial({
    uniforms: { uTex: { value: tex }, uScale: { value: 300 }, uNight: { value: 0 } },
    vertexShader: `
attribute float aSize;
attribute vec4 aColor;
varying vec4 vColor;
uniform float uScale;
uniform float uNight;
void main() {
  vColor = vec4(aColor.rgb, aColor.a * smoothstep(0.05, 0.6, uNight));
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `
uniform sampler2D uTex;
varying vec4 vColor;
void main() {
  vec4 t = texture2D(uTex, gl_PointCoord);
  gl_FragColor = vec4(vColor.rgb, vColor.a * t.a);
  if (gl_FragColor.a < 0.01) discard;
}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

// =====================================================================================================
// Ansicht
// =====================================================================================================
export class BuildingView {
  constructor(engine) {
    this.e = engine;
    this.g = engine.game;
    this.defs = BUILDINGS; // für Werkzeuge/Prüfskripte
    states.clear();
    const g = this.g;
    this.root = new THREE.Group();
    this.root.name = 'Gebäude';
    engine.scene.add(this.root);
    this.protoMgr = new ProtoManager(this.root);
    this.protoMgr.setFallback(buildFallback, fallbackVariants);
    this.batch = new Batcher(this.root, { W: g.W, H: g.H, chunk: 32, coarse: 64 });
    this.sites = new Batcher(this.root, { W: g.W, H: g.H, single: true, cull: false });
    this.recs = new Map();
    this.queue = new Set();
    this.dying = new Set();
    this.siteRecs = new Set();
    this.animRecs = new Set();
    this.emitters = new Map();
    this.constructing = new Set();
    this.tint = null;
    this.lodList = [];
    this.lodPos = 0;
    this.lodT = 0; this.gcT = 3; this.siteT = 0; this.lightT = 0;
    this.lightsDirty = true;
    this.rng = mulberry32(4711);
    this._m = new THREE.Matrix4(); this._m2 = new THREE.Matrix4(); this._m3 = new THREE.Matrix4();
    this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3();
    this.zeroM = new THREE.Matrix4().makeScale(0, 0, 0);
    // Kranausleger und Betondecke als eigene Instanzsätze
    this.jibs = {};
    for (const size of ['S', 'L']) {
      const model = prepareModel(buildJib(size));
      this.jibs[size] = new InstSet(this.root, model.parts, { radius: model.radius, mgr: this.protoMgr });
    }
    const slabKit = new Kit(mulberry32(5), 2);
    slabKit.box('concrete', 0, 0, 0, 1, 1, 1);
    const sm = prepareModel(slabKit.build());
    this.slabSet = new InstSet(this.root, sm.parts, { radius: 1, mgr: this.protoMgr });
    // Punktwolken
    const glow = makeGlowTexture();
    this.lightMat = makeLightMaterial(glow);
    this.lightBuf = new PointBuffer(12000, this.lightMat);
    this.lightBuf.points.renderOrder = 6;
    this.root.add(this.lightBuf.points);
    this.dustBuf = new PointBuffer(1400, makePointsMaterial(glow, false));
    this.dustBuf.points.renderOrder = 7;
    this.root.add(this.dustBuf.points);
    this.dust = [];
    // Beim Start steht die Kamera noch nicht: alles zuerst in Detail 0, der erste Takt verfeinert
    this.initial = true;
    for (const b of g.buildings.values()) this.add(b);
    this._work(Infinity);
    this.initial = false;
    this.lastFrame = performance.now();
  }

  // ------------------------------------------------------------------ Datensätze
  _origin(b) { return [b.x + b.w / 2 - this.g.W / 2, b.y + b.h / 2 - this.g.H / 2]; }
  _newRec(b) {
    const def = BUILDINGS[b.key];
    const [fw, fd] = frontFootprint(b, def && def.size);
    const [ox, oz] = this._origin(b);
    const rec = {
      id: b.id, b, key: archKeyFor(b), level: b.level || 1, variant: b.variant || 0, fw, fd, k: (b.rot || 0) & 3,
      bx: b.x, by: b.y, ox, oz, extra: { zone: b.zone, spec: b.spec },
      slot: states.alloc(), m4: new THREE.Matrix4(),
      p0: null, height: this._estimate(b), radius: Math.max(b.w, b.h) * 0.75,
      finished: false, shown: -1, inst: null, inBatch: false,
      anims: [], animProto: null, animT: this.rng() * 20, spin: 0,
      site: null, dist: 1e9, want: 0, win: -1,
      st: { grime: 0, char: 0, fire: 0, init: false }, dyingT: -1, dead: false,
      animRun: false, animFrozen: this.rng() * 60,
    };
    states.setv(rec.slot, 3, 2, rec.animFrozen);
    this._q.setFromAxisAngle(Y_AXIS, rec.k * Math.PI / 2);
    rec.m4.compose(this._v.set(ox, 0, oz), this._q, this._s.set(1, 1, 1));
    return rec;
  }
  _estimate(b) {
    if (b.zone) return [0, 0.6, 0.9, 1.3, 2.4, 5][b.level] || 1;
    return 1.0;
  }
  _changed(rec) {
    const b = rec.b;
    return (b.level || 1) !== rec.level || ((b.rot || 0) & 3) !== rec.k || b.x !== rec.bx || b.y !== rec.by || (b.variant || 0) !== rec.variant || archKeyFor(b) !== rec.key;
  }

  add(b) {
    const old = this.recs.get(b.id);
    if (old) this._teardown(old);
    const rec = this._newRec(b);
    if (old) rec.st = { ...old.st };
    this.recs.set(b.id, rec);
    this.queue.add(rec);
  }

  update(b) {
    const rec = this.recs.get(b.id);
    if (!rec) { this.add(b); return; }
    rec.b = b;
    if (!rec.p0) return;
    if (this._changed(rec)) { this.add(b); return; }
    this._syncPhase(rec);
    this._applyState(rec, -1);
  }

  remove(b) {
    const rec = this.recs.get(b.id);
    if (!rec) return;
    this.recs.delete(b.id);
    this.queue.delete(rec);
    this.emitters.delete(b.id);
    this.constructing.delete(b.id);
    if (!rec.p0 || this.dying.size > 60 || (!rec.inst && !rec.inBatch)) { this._teardown(rec); return; }
    this._endSite(rec);
    this._animClock(rec, false);
    rec.dyingT = 0;
    rec.dyingDur = 0.9 + 0.6 * Math.min(1, rec.height / 3);
    states.setv(rec.slot, 1, 0, 0);
    this.dying.add(rec);
    this._dustBurst(rec);
    this.lightsDirty = true;
  }

  _teardown(rec) {
    this.queue.delete(rec); this.dying.delete(rec); this.siteRecs.delete(rec); this.animRecs.delete(rec);
    this._endSite(rec);
    this._dropInst(rec);
    this._releaseAnims(rec);
    if (rec.inBatch) { this.batch.remove(rec.id); this.protoMgr.unretain(rec.p0); rec.inBatch = false; }
    if (rec.slot > SLOT_HIDDEN) { states.release(rec.slot); rec.slot = SLOT_HIDDEN; }
    if (this.recs.get(rec.id) === rec) { this.emitters.delete(rec.id); this.constructing.delete(rec.id); }
    rec.dead = true;
    this.lightsDirty = true;
  }

  // ------------------------------------------------------------------ Aufbau
  _build(rec) {
    if (rec.dead) return;
    const p0 = this.protoMgr.get(rec.key, rec.level, rec.variant, rec.fw, rec.fd, rec.extra, 0);
    if (!p0) { rec.dead = true; return; }
    rec.p0 = p0;
    rec.height = p0.height;
    rec.radius = Math.max(rec.radius, p0.radius * 0.8);
    if (p0.emitters.length) {
      const c = COS[rec.k], s = SIN[rec.k];
      this.emitters.set(rec.id, p0.emitters.map((e) => ({ x: rec.ox + e.x * c + e.z * s, y: e.y, z: rec.oz - e.x * s + e.z * c, type: e.type, amount: e.amount || 1 })));
    }
    rec.want = this._wantFor(rec);
    this.batch.add(rec.id, p0, rec.k, rec.ox, rec.oz, rec.slot);
    this.protoMgr.retain(p0);
    rec.inBatch = true;
    if (rec.b.construct >= 1) this._finish(rec, false); else this._startSite(rec);
    this._applyState(rec, 0);
    this._tintRec(rec);
  }
  _syncPhase(rec) {
    const fin = rec.b.construct >= 1;
    if (fin && !rec.finished) this._finish(rec, true);
    else if (!fin && rec.finished) this._startSite(rec);
  }
  _finish(rec, puff) {
    const wasSite = !!rec.site;
    this._endSite(rec);
    rec.finished = true;
    this.constructing.delete(rec.id);
    states.setv(rec.slot, 1, 3, 0);
    rec.shown = -1;
    if (!(rec.want > 0 && this._show(rec, rec.want))) this._show(rec, 0);
    if (wasSite && puff) this._dustPuff(rec, 16);
  }
  // Darstellung in Detailstufe d (0 = Bündel, sofern fertig)
  _show(rec, d) {
    if (rec.site && rec.site.detail !== (d >= 1 ? 1 : 0)) this._siteProps(rec, d >= 1 ? 1 : 0);
    if (d === 0 && rec.inBatch) {
      this._dropInst(rec);
      states.setv(rec.slot, 2, 0, 1);
      rec.shown = 0;
      this._setAnims(rec, rec.p0);
      this.lightsDirty = true;
      return true;
    }
    const proto = d === 0 ? rec.p0 : this.protoMgr.get(rec.key, rec.level, rec.variant, rec.fw, rec.fd, rec.extra, d);
    if (!proto) return false;
    if (!rec.inst || rec.inst.proto !== proto) {
      const h = this.protoMgr.alloc(proto, rec.slot);
      this.protoMgr.set(proto, h, rec.m4);
      this._dropInst(rec);
      rec.inst = { proto, h };
    }
    states.setv(rec.slot, 2, 0, 0);
    states.setv(rec.slot, 2, 2, 1);
    rec.shown = d;
    this._setAnims(rec, proto);
    this.lightsDirty = true;
    return true;
  }
  _dropInst(rec) {
    if (!rec.inst) return;
    this.protoMgr.release(rec.inst.proto, rec.inst.h);
    rec.inst = null;
  }
  _setAnims(rec, proto) {
    if (rec.animProto === proto) return;
    this._releaseAnims(rec);
    rec.animProto = proto;
    if (!proto.anims.length) return;
    for (const a of proto.anims) rec.anims.push({ a, h: a.set.alloc(rec.slot) });
    this.animRecs.add(rec);
  }
  _releaseAnims(rec) {
    for (const it of rec.anims) it.a.set.release(it.h);
    rec.anims = [];
    rec.animProto = null;
    this.animRecs.delete(rec);
  }

  // ------------------------------------------------------------------ Baustellen
  _startSite(rec) {
    rec.finished = false;
    this.constructing.add(rec.id);
    if (rec.site) return;
    const p0 = rec.p0, Ht = rec.height, W = rec.fw, D = rec.fd;
    const box = p0.core || p0.box;
    const bx0 = Math.max(-W / 2 + 0.08, box.min.x), bx1 = Math.min(W / 2 - 0.08, box.max.x);
    const bz0 = Math.max(-D / 2 + 0.08, box.min.z), bz1 = Math.min(D / 2 - 0.08, box.max.z);
    const rng = mulberry32(rec.id * 7 + 3);
    const site = { slots: [states.alloc(), states.alloc(), states.alloc()], crane: null, slab: -1, box: [bx0, bx1, bz0, bz1], tall: Ht > 1.6 };
    const flat = Ht < 0.16;
    const wantCrane = !flat && (Ht > 0.7 || W * D >= 4 || (!rec.b.zone && W * D >= 2 && Ht > 0.4));
    let craneLocal = null;
    if (wantCrane) {
      const cands = [[-W / 2 + 0.17, -D / 2 + 0.17], [W / 2 - 0.17, -D / 2 + 0.17], [-W / 2 + 0.17, D / 2 - 0.2], [W / 2 - 0.17, D / 2 - 0.2]];
      let best = cands[0], bd = -1;
      for (const [x, z] of cands) {
        const dx = Math.max(bx0 - x, 0, x - bx1), dz = Math.max(bz0 - z, 0, z - bz1);
        const dd = dx * dx + dz * dz + rng() * 0.001;
        if (dd > bd) { bd = dd; best = [x, z]; }
      }
      const hm = Math.max(0.9, Ht + 0.5);
      craneLocal = [best[0], best[1], hm];
      const far = Math.max(Math.hypot(bx0 - best[0], bz0 - best[1]), Math.hypot(bx1 - best[0], bz1 - best[1]), Math.hypot(bx0 - best[0], bz1 - best[1]), Math.hypot(bx1 - best[0], bz0 - best[1]));
      const size = far > 1.4 || hm > 2.5 ? 'L' : 'S';
      const reach = size === 'L' ? 2.7 * 0.62 : 1.5 * 0.62;
      const scale = clamp(far * 0.9 / reach, 0.75, 1.35);
      const c = COS[rec.k], s = SIN[rec.k];
      const wx = rec.ox + best[0] * c + best[1] * s, wz = rec.oz - best[0] * s + best[1] * c;
      const set = this.jibs[size];
      site.crane = { set, h: set.alloc(site.slots[2]), x: wx, y: hm, z: wz, scale, ph: rng() * 6, base: rng() * 6, w: 0.11 + rng() * 0.08 };
    }
    site.flat = flat;
    site.craneLocal = craneLocal;
    site.seed = rec.id * 7 + 3;
    site.detail = -1;
    if (!flat) site.slab = this.slabSet.alloc(site.slots[1]);
    rec.site = site;
    for (const s of site.slots) this._tintSlot(s, rec.b);
    this.siteRecs.add(rec);
    rec.shown = -1;
    if (!this._show(rec, rec.want)) this._show(rec, 0);
    if (site.detail < 0) this._siteProps(rec, rec.want >= 1 ? 1 : 0);
    this._siteUpdate(rec);
  }
  // Gerüst, Bauzaun und Kranmast (fern vereinfacht, nah ausführlich)
  _siteProps(rec, detail) {
    const site = rec.site;
    site.detail = detail;
    const [bx0, bx1, bz0, bz1] = site.box;
    const rng = mulberry32(site.seed);
    if (!site.flat) this.sites.add(`${rec.id}:g`, prepareModel(buildScaffold(rng, bx0, bx1, bz0, bz1, rec.height, detail)), rec.k, rec.ox, rec.oz, site.slots[0]);
    this.sites.add(`${rec.id}:f`, prepareModel(buildSiteGround(rng, rec.fw, rec.fd, bx0, bx1, bz0, bz1, detail)), rec.k, rec.ox, rec.oz, site.slots[1]);
    if (site.craneLocal) this.sites.add(`${rec.id}:c`, prepareModel(buildCraneMast(rng, site.craneLocal, detail)), rec.k, rec.ox, rec.oz, site.slots[2]);
  }
  _endSite(rec) {
    const site = rec.site;
    if (!site) return;
    this.sites.remove(`${rec.id}:g`); this.sites.remove(`${rec.id}:f`); this.sites.remove(`${rec.id}:c`);
    if (site.crane) site.crane.set.release(site.crane.h);
    if (site.slab >= 0) this.slabSet.release(site.slab);
    for (const s of site.slots) states.release(s);
    rec.site = null;
    this.siteRecs.delete(rec);
  }
  _siteUpdate(rec) {
    const site = rec.site;
    if (!site) return;
    const p = clamp(rec.b.construct, 0, 1);
    const Ht = rec.height;
    const f = clamp((p - 0.08) / 0.8, 0, 1);
    const clip = f >= 1 ? 0 : Math.max(0.003, Ht * f);
    states.setv(rec.slot, 1, 3, clip);
    const [s0, , s2] = site.slots;
    const cv = Ht * f;
    states.setv(s0, 1, 3, Math.min(Ht + 0.35, Math.max(cv, 0.003) + 0.3));
    states.setv(s0, 3, 1, site.tall ? Math.max(0, cv - 1.0) : 0);
    states.setv(s0, 2, 0, p < 0.95 ? 1 : 0);
    states.setv(s2, 2, 0, p < 0.92 ? 1 : 0);
    states.setv(s2, 2, 2, p < 0.92 ? 1 : 0);
    if (site.slab >= 0) {
      const [bx0, bx1, bz0, bz1] = site.box;
      if (clip > 0.02 && clip < Ht * 0.86) {
        const c = COS[rec.k], s = SIN[rec.k], lx = (bx0 + bx1) / 2, lz = (bz0 + bz1) / 2;
        this._q.setFromAxisAngle(Y_AXIS, rec.k * Math.PI / 2);
        this._m.compose(this._v.set(rec.ox + lx * c + lz * s, clip - 0.25 * M, rec.oz - lx * s + lz * c), this._q, this._s.set(bx1 - bx0 - 0.01, 0.25 * M, bz1 - bz0 - 0.01));
        this.slabSet.setMatrix(site.slab, this._m);
      } else this.slabSet.setMatrix(site.slab, this.zeroM);
    }
  }
  _sitesFrame(dt, time) {
    this.siteT -= dt;
    const upd = this.siteT <= 0;
    if (upd) this.siteT = 0.12;
    for (const rec of this.siteRecs) {
      if (upd) this._siteUpdate(rec);
      const c = rec.site.crane;
      if (c) {
        const ang = c.base + Math.sin(time * c.w + c.ph) * 1.25 + Math.sin(time * c.w * 0.37 + c.ph * 2) * 0.6;
        this._q.setFromAxisAngle(Y_AXIS, ang);
        this._m.compose(this._v.set(c.x, c.y, c.z), this._q, this._s.set(c.scale, c.scale, c.scale));
        c.set.setMatrix(c.h, this._m);
      }
      const p = rec.b.construct;
      if (p > 0.03 && p < 0.95 && Math.random() < dt * 0.9) {
        const w = rec.fw, d = rec.fd;
        this._emitDust(rec.ox + (Math.random() - 0.5) * w * 0.8, 0.03, rec.oz + (Math.random() - 0.5) * d * 0.8, 0.25, 0.5);
      }
    }
  }

  // ------------------------------------------------------------------ Zustände
  _needsPower(b) {
    if (b.zone) return true;
    const cat = BUILDINGS[b.key] && BUILDINGS[b.key].cat;
    return cat !== 'parks' && cat !== 'power';
  }
  // dt < 0: nur Ziele übernehmen (Übergänge laufen im Takt); dt = 0: sofort setzen
  _applyState(rec, dt) {
    const b = rec.b, st = rec.st, s = rec.slot;
    if (s <= SLOT_HIDDEN || rec.dyingT >= 0) return;
    const fin = b.construct >= 1;
    const win = fin && !b.abandoned && (!this._needsPower(b) || b.powered) ? 1 : 0;
    if (win !== rec.win) { rec.win = win; this.lightsDirty = true; }
    const gT = b.abandoned ? 1 : 0, fT = b.burning ? 1 : 0;
    if (dt === 0 || !st.init) { st.grime = gT; st.fire = fT; st.init = true; }
    else if (dt > 0) {
      st.grime = approach(st.grime, gT, dt * 0.35);
      st.fire = approach(st.fire, fT, dt * 1.5);
      st.char = b.burning ? Math.min(1, st.char + dt * 0.12) : Math.max(0, st.char - dt * 0.004);
    }
    states.setv(s, 1, 0, win);
    states.setv(s, 1, 1, st.grime);
    states.setv(s, 1, 2, st.char);
    states.setv(s, 3, 0, st.fire);
    this._animClock(rec, fin && !b.abandoned && !b.burning);
  }
  // Uhr der im Shader drehenden Teile: t = uTime · Rate + Versatz (Rate 0 = steht, ohne Sprung)
  _animClock(rec, run) {
    if (rec.animRun === run || rec.slot <= SLOT_HIDDEN) return;
    const now = shared.uTime.value;
    if (run) { states.setv(rec.slot, 3, 2, rec.animFrozen - now); states.setv(rec.slot, 3, 3, 1); }
    else { rec.animFrozen = now + states.get(rec.slot, 3, 2); states.setv(rec.slot, 3, 2, rec.animFrozen); states.setv(rec.slot, 3, 3, 0); }
    rec.animRun = run;
  }
  _tintSlot(s, b) {
    const c = this.tint ? this.tint(b) : null;
    if (c) states.set4(s, 0, c.r, c.g, c.b, 0.82);
    else states.set4(s, 0, 1, 1, 1, 0);
  }
  _tintRec(rec) {
    if (rec.slot <= SLOT_HIDDEN) return;
    this._tintSlot(rec.slot, rec.b);
    if (rec.site) for (const s of rec.site.slots) this._tintSlot(s, rec.b);
  }
  setTint(fn) {
    this.tint = fn;
    for (const rec of this.recs.values()) this._tintRec(rec);
  }

  // ------------------------------------------------------------------ Detailstufen
  _thresholds() {
    const f = LOD_SCALE[this.e.settings && this.e.settings.quality] ?? 1;
    return [LOD_NEAR * f, LOD_MID * f];
  }
  _distance(rec) {
    const cam = this.e.camera.position;
    const dx = rec.ox - cam.x, dy = rec.height * 0.4 - cam.y, dz = rec.oz - cam.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - rec.radius * 0.45;
  }
  _wantFor(rec) {
    if (this.initial) return 0;
    const [t2, t1] = this._thresholds();
    const d = this._distance(rec);
    rec.dist = d;
    return d < t2 ? 2 : d < t1 ? 1 : 0;
  }
  _lodTick() {
    const [t2, t1] = this._thresholds();
    const arr = [];
    for (const rec of this.recs.values()) {
      if (!rec.p0 || rec.dead || rec.dyingT >= 0) continue;
      if (this._changed(rec)) { this.add(rec.b); continue; }
      this._syncPhase(rec);
      this._applyState(rec, LOD_TICK);
      const d = this._distance(rec);
      rec.dist = d;
      const cur = rec.shown;
      const a2 = cur === 2 ? t2 * 1.08 : t2 * 0.95, a1 = cur >= 1 ? t1 * 1.08 : t1 * 0.95;
      rec.want = d < a2 ? 2 : d < a1 ? 1 : 0;
      arr.push(rec);
    }
    // Obergrenzen: nur die nächsten Gebäude bekommen Detail 1/2 (nach Abstand sortiert)
    const near = arr.filter((r) => r.want >= 1).sort((a, b) => a.dist - b.dist);
    let n2 = 0, n1 = 0;
    for (const rec of near) {
      if (rec.want === 2 && n2 >= MAX_D2) rec.want = 1;
      if (rec.want >= 1 && n1 >= MAX_D1) rec.want = 0;
      if (rec.want === 2) n2++;
      if (rec.want >= 1) n1++;
    }
    // Übergänge: nahe zuerst (Aufwerten), dann Abwerten
    this.lodList = near.filter((r) => r.want !== r.shown).concat(arr.filter((r) => r.want === 0 && r.shown !== 0));
    this.lodPos = 0;
  }
  _work(budget) {
    const t0 = performance.now();
    for (const rec of this.queue) {
      if (performance.now() - t0 > budget) break;
      this.queue.delete(rec);
      this._build(rec);
    }
    while (this.lodPos < this.lodList.length && performance.now() - t0 <= budget) {
      const rec = this.lodList[this.lodPos++];
      if (rec.dead || rec.dyingT >= 0 || !rec.p0 || rec.want === rec.shown) continue;
      this._show(rec, rec.want);
    }
  }

  // ------------------------------------------------------------------ Abriss, Staub
  _dyingFrame(dt) {
    for (const rec of this.dying) {
      rec.dyingT += dt;
      const f = clamp(rec.dyingT / rec.dyingDur, 0, 1);
      const e = f * f * (3 - 2 * f);
      states.setv(rec.slot, 2, 1, (rec.height + 0.1) * (f < 0.12 ? 0.02 * f / 0.12 : 0.02 + 0.98 * e));
      states.setv(rec.slot, 2, 3, 0.012 * (1 - f) * Math.min(1, f * 8));
      if (Math.random() < dt * 30 * (1 - f)) this._emitDust(rec.ox + (Math.random() - 0.5) * rec.fw * 0.9, Math.random() * 0.15, rec.oz + (Math.random() - 0.5) * rec.fd * 0.9, 0.55, 0.8);
      if (f >= 1) this._teardown(rec);
    }
  }
  _emitDust(x, y, z, size, alpha) {
    const fx = this.e.effects;
    if (fx && typeof fx.emitDust === 'function') { fx.emitDust(x, y, z, size, alpha); return; }
    if (this.dust.length >= 1300) return;
    this.dust.push({ x, y, z, vx: (Math.random() - 0.5) * 0.18, vy: 0.08 + Math.random() * 0.14, vz: (Math.random() - 0.5) * 0.18, age: 0, life: 1.8 + Math.random() * 1.6, size, alpha });
  }
  _dustBurst(rec) {
    const n = Math.min(70, 18 + Math.round(rec.height * 18));
    for (let i = 0; i < n; i++) this._emitDust(rec.ox + (Math.random() - 0.5) * rec.fw, Math.random() * rec.height * 0.6, rec.oz + (Math.random() - 0.5) * rec.fd, 0.5 + Math.random() * 0.5, 0.75);
  }
  _dustPuff(rec, n) { for (let i = 0; i < n; i++) this._emitDust(rec.ox + (Math.random() - 0.5) * rec.fw, 0.02, rec.oz + (Math.random() - 0.5) * rec.fd, 0.3, 0.45); }
  _dustFrame(dt, night) {
    const buf = this.dustBuf;
    buf.begin();
    const keep = [];
    const k = 1 - night * 0.65;
    for (const p of this.dust) {
      p.age += dt;
      if (p.age > p.life) continue;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vy *= 1 - dt * 0.6; p.vx *= 1 - dt * 0.4; p.vz *= 1 - dt * 0.4;
      const t = p.age / p.life;
      buf.add(p.x, p.y, p.z, p.size * (0.6 + t * 1.8), 0.78 * k, 0.72 * k, 0.62 * k, p.alpha * (1 - t) * Math.min(1, t * 5));
      keep.push(p);
    }
    this.dust = keep;
    buf.end();
    buf.points.visible = keep.length > 0;
  }

  // ------------------------------------------------------------------ Animation, Lichter
  _animate(dt, night) {
    const m = this._m, m2 = this._m2, m3 = this._m3;
    for (const rec of this.animRecs) {
      const b = rec.b;
      const run = rec.finished && !b.abandoned && !b.burning && rec.dyingT < 0 ? 1 : 0;
      rec.spin = approach(rec.spin, run, dt * 0.6);
      rec.animT += dt * rec.spin;
      for (const it of rec.anims) {
        const a = it.a;
        if ((a.nightOnly && (night < 0.3 || !rec.finished || !rec.win)) || rec.dyingT >= 0 && a.nightOnly) { a.set.setMatrix(it.h, this.zeroM); continue; }
        const ang = a.swing ? Math.sin(rec.animT * a.speed + a.phase) * a.swing : rec.animT * a.speed + a.phase;
        if (a.axis === 'x') m2.makeRotationX(ang); else if (a.axis === 'z') m2.makeRotationZ(ang); else m2.makeRotationY(ang);
        m.copy(rec.m4).multiply(m3.makeTranslation(a.pivot.x, a.pivot.y, a.pivot.z)).multiply(m2);
        if (!a.local) m.multiply(m3.makeTranslation(-a.pivot.x, -a.pivot.y, -a.pivot.z));
        a.set.setMatrix(it.h, m);
      }
    }
  }
  _lightsFrame(dt, night) {
    const pts = this.lightBuf.points;
    this.lightMat.uniforms.uNight.value = night;
    this.lightMat.uniforms.uScale.value = (this.e.renderer.domElement.clientHeight || 720) * 0.9;
    pts.visible = night > 0.04 && this.lightBuf.n > 0;
    this.lightT -= dt;
    if (!this.lightsDirty || this.lightT > 0) return;
    this.lightT = 0.5;
    this.lightsDirty = false;
    const buf = this.lightBuf;
    buf.begin();
    const col = new THREE.Color();
    for (const rec of this.recs.values()) {
      if (rec.win !== 1 || !rec.finished || rec.dyingT >= 0) continue;
      const proto = rec.inst ? rec.inst.proto : rec.p0;
      if (!proto || !proto.lights.length) continue;
      const c = COS[rec.k], s = SIN[rec.k];
      for (const l of proto.lights) {
        col.setHex(l.color ?? 0xffd79a);
        buf.add(rec.ox + l.x * c + l.z * s, l.y, rec.oz - l.x * s + l.z * c, (l.size ?? 0.4) * 0.9, col.r, col.g, col.b, 0.9);
      }
    }
    buf.end();
    pts.visible = night > 0.04 && buf.n > 0;
  }

  // ------------------------------------------------------------------ Bild
  frame(dt, time, night) {
    const now = performance.now();
    const gap = now - this.lastFrame;
    this.lastFrame = now;
    const budget = gap > 300 ? Infinity : clamp(gap * 0.3, 4, 60);
    this.lodT -= dt;
    if (this.lodT <= 0) { this.lodT = LOD_TICK; this._lodTick(); }
    this._work(budget);
    this._sitesFrame(dt, time);
    this._dyingFrame(dt);
    this._animate(dt, night);
    this._dustFrame(dt, night);
    this._lightsFrame(dt, night);
    this.gcT -= dt;
    if (this.gcT <= 0) { this.gcT = 3; this.protoMgr.gc(3); }
    this.protoMgr.flush();
    this.batch.flush(1);
    this.sites.flush(1);
    states.upload(this.e.renderer);
  }

  heightOf(b) {
    const rec = this.recs.get(b.id);
    return rec ? rec.height : this._estimate(b);
  }

  stats() {
    return { ...this.protoMgr.stats(), batch: this.batch.stats(), sites: this.sites.stats(), buildings: this.recs.size, queued: this.queue.size, constructing: this.constructing.size, dying: this.dying.size };
  }

  dispose() {
    this.e.scene.remove(this.root);
    this.batch.dispose();
    this.sites.dispose();
  }
}

function buildCraneMast(rng, [cx, cz, hm], detail = 1) {
  const kit = new Kit(rng, 2);
  const s = 0.17, t = 0.022;
  kit.box('concrete', cx, 0, cz, 0.36, 0.08, 0.36);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kit.box('paint_yellow', cx + dx * s / 2, 0.08, cz + dz * s / 2, t, hm - 0.08, t);
  if (!detail) {
    for (let y = 0.4; y < hm - 0.01; y += 0.4) kit.box('paint_yellow', cx, y, cz, s + t, 0.02, s + t);
    return kit.build();
  }
  const seg = 0.2;
  for (let y = 0.08, k = 0; y < hm - 0.01; y += seg, k++) {
    kit.box('paint_yellow', cx, y, cz - s / 2, s, 0.012, 0.012); kit.box('paint_yellow', cx, y, cz + s / 2, s, 0.012, 0.012);
    kit.box('paint_yellow', cx - s / 2, y, cz, 0.012, 0.012, s); kit.box('paint_yellow', cx + s / 2, y, cz, 0.012, 0.012, s);
    if (y + seg <= hm) {
      const dl = Math.hypot(s, seg), a = Math.atan2(s, seg) * (k % 2 ? 1 : -1);
      kit.box('paint_yellow', cx, y, cz + s / 2, 0.01, dl, 0.01, { rz: a }); kit.box('paint_yellow', cx, y, cz - s / 2, 0.01, dl, 0.01, { rz: -a });
      kit.box('paint_yellow', cx + s / 2, y, cz, 0.01, dl, 0.01, { rx: a }); kit.box('paint_yellow', cx - s / 2, y, cz, 0.01, dl, 0.01, { rx: -a });
    }
  }
  return kit.build();
}

// Vorschau (z. B. Baukatalog): Modell als Gruppe mit normalen Materialien, ohne Instanzierung und Zustände.
// Liefert für Schlüssel ohne Baustein das Ersatzmodell. userData: { height, triangles }.
export function previewModel(key, level = 1, variant = 0, fw, fd, extra = {}, detail = 2) {
  const size = (BUILDINGS[key] && BUILDINGS[key].size) || [1, 1];
  fw = fw ?? size[0]; fd = fd ?? size[1];
  let res = null;
  if (ARCH[key]) { try { res = buildArch(key, level, variant, fw, fd, extra, detail); } catch (e) { res = null; } }
  if (!res || !res.meshes || !res.meshes.length) res = buildFallback(key, level, variant, fw, fd, extra, detail);
  const group = new THREE.Group();
  const put = (geometry, material) => {
    const mesh = new THREE.Mesh(geometry, typeof material === 'string' ? getMaterial(material) : material || getMaterial('metal_light'));
    mesh.castShadow = mesh.receiveShadow = !mesh.material.transparent;
    group.add(mesh);
  };
  for (const m of res.meshes) put(m.geometry, m.material);
  for (const a of res.anim || []) if (a && a.geometry && !a.nightOnly) put(a.geometry, a.material);
  group.userData = { height: res.height || 0, triangles: res.triangles || 0 };
  return group;
}

export function stationHeight() { return TRANSIT.trackHeight; }
void Z;
