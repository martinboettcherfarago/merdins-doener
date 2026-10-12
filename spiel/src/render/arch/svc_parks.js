// Parks und Freizeit: Park, Brunnenplatz, Stadtpark, Sportplatz, Spielplatz, Skatepark, Hundewiese, Teichpark,
// Kleingärten, Freibad, Tennisplätze, Strandbad. Besitzer: G5.
import * as THREE from 'three';
import { registerArch } from './index.js';
import * as P from './svc_parts.js';
import { slide, swing, sandbox } from './svc_edu.js';

const { M, pick } = P;
const dims = (ctx) => [ctx.fw * 10 * M, ctx.fd * 10 * M];

// Ellipse (flach, nach oben)
function oval(k, mat, x, y, z, ax, az, seg) {
  const geo = new THREE.CircleGeometry(1, seg ?? P.segs(k, 20));
  geo.rotateX(-Math.PI / 2);
  geo.scale(ax, 1, az);
  return k.add(mat, geo, { x, y, z });
}
// Teich aus mehreren Ellipsen: Uferrand, Wasser, Seerosen, Schilf
function pond(k, lobes, o = {}) {
  for (const [x, z, ax, az] of lobes) oval(k, o.shore || 'sand', x, P.PAVE * 0.8, z, ax + 0.6 * M, az + 0.6 * M);
  for (const [x, z, ax, az] of lobes) oval(k, o.water || 'water_canal', x, P.PAVE * 1.3, z, ax, az);
  if (!P.D2(k)) return;
  const [x0, z0, ax0, az0] = lobes[0];
  for (let i = 0; i < (o.lilies ?? 6); i++) { const a = k.rng() * 6.28, r = 0.4 + k.rng() * 0.45; P.disk(k, 'leaves_light', x0 + Math.cos(a) * ax0 * r, P.PAVE * 1.3 + 0.03 * M, z0 + Math.sin(a) * az0 * r, (0.25 + k.rng() * 0.2) * M, { seg: 6 }); }
  for (let i = 0; i < (o.reeds ?? 10); i++) {
    const L = lobes[i % lobes.length], a = k.rng() * 6.28;
    const x = L[0] + Math.cos(a) * L[2] * 0.95, z = L[1] + Math.sin(a) * L[3] * 0.95;
    k.cyl(i % 3 ? 'grass_dry' : 'hedge', x, 0, z, 0.05 * M, (0.9 + k.rng() * 0.8) * M, { seg: 3 });
  }
}
// Bäume an festen Punkten (Mischung)
function trees(k, pts, s = 0.8) {
  for (const [x, z, t] of pts) {
    const sc = s * (0.8 + k.rng() * 0.45);
    if (t === 'c') P.conifer(k, x * M, z * M, sc * 0.8); else if (t === 'p') P.poplar(k, x * M, z * M, sc); else P.tree(k, x * M, z * M, sc);
  }
}
const UMB = ['awning_red', 'awning_blue', 'awning_yellow', 'awning_green', 'canvas_white', 'awning_striped'];
function umbrella(k, x, z, mat) {
  if (!P.D1(k)) return;
  k.cyl('metal_light', x, 0, z, 0.04 * M, 2.2 * M, { seg: 4 });
  k.cone(mat || pick(k.rng, UMB), x, 1.9 * M, z, 1.3 * M, 0.55 * M, { seg: 8 });
}
function lounger(k, x, z, ry, mat = 'paint_white') {
  if (!P.D2(k)) return;
  const g = new P.G(k, x, z, ry);
  g.box(mat, 0, 0.25 * M, 0, 0.65 * M, 0.08 * M, 1.6 * M);
  g.box(mat, 0, 0.3 * M, -0.7 * M, 0.65 * M, 0.5 * M, 0.08 * M, { rx: -0.6 });
}
function picnicTable(k, x, z, ry) {
  if (!P.D2(k)) return;
  const g = new P.G(k, x, z, ry);
  g.box('wood_planks', 0, 0.72 * M, 0, 1.8 * M, 0.07 * M, 0.8 * M);
  for (const s of [-1, 1]) { g.box('wood_planks', 0, 0.42 * M, s * 0.7 * M, 1.8 * M, 0.06 * M, 0.3 * M); g.box('wood_dark', s * 0.7 * M, 0, 0, 0.08 * M, 0.72 * M, 1.6 * M); }
}

// ---------------------------------------------------------------- Kleiner Park (1×1)
registerArch('park', {
  variants: 4,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'grass', { curb: false });
    if (v === 0) {
      P.walk(k, 'gravel', [[-3.8 * M, D / 2], [-2.2 * M, 1.6 * M], [0.8 * M, -0.6 * M], [2.6 * M, -3 * M], [W / 2 - 0.3 * M, -4 * M]], 1.5 * M);
      trees(k, [[-3, -3], [2.6, 2.4], [-0.6, -4], [3.8, -0.4]], 0.85);
      P.bench(k, -0.6 * M, 1.2 * M, -2.4); P.bench(k, 1.8 * M, -2.6 * M, -2.4);
      P.flowerBed(k, -3.4 * M, 3.4 * M, 1.6 * M, 1.6 * M);
      P.lamp(k, -1.4 * M, 0.2 * M, 3.6 * M, { globe: true });
      P.bin(k, 1.2 * M, -0.4 * M);
    } else if (v === 1) {
      P.ring(k, 'gravel', 0, P.PAVE, 0, 2.4 * M, 3.4 * M, { seg: P.segs(k, 24) });
      P.walk(k, 'gravel', [[0, D / 2], [0, 3.0 * M]], 1.4 * M);
      P.tree(k, 0, 0, 1.25);
      if (P.D1(k)) k.cyl('wood_planks', 0, 0, 0, 1.2 * M, 0.45 * M, { seg: P.segs(k, 12), open: true });
      for (let i = 0; i < 3; i++) { const a = 0.9 + i * 2.1; P.bench(k, Math.sin(a) * 3.9 * M, Math.cos(a) * 3.9 * M, a + Math.PI); }
      trees(k, [[-4, -4, 'c'], [4, -4], [-4.1, 3.6]], 0.7);
      P.lamp(k, 1.6 * M, 3.6 * M, 3.6 * M, { globe: true });
      for (let i = 0; i < 6; i++) { const a = i * 1.05; P.bush(k, Math.sin(a) * 1.9 * M, Math.cos(a) * 1.9 * M, 0.6, 'hedge'); }
    } else if (v === 2) {
      P.walk(k, 'pavers', [[0, -D / 2 + 0.2 * M], [0, D / 2]], 1.4 * M);
      P.walk(k, 'pavers', [[-W / 2 + 0.2 * M, 0], [W / 2 - 0.2 * M, 0]], 1.4 * M);
      k.cyl('stone_grey', 0, 0, 0, 1.5 * M, 0.5 * M, { seg: P.segs(k, 14) });
      k.cyl('water_pool', 0, 0, 0, 1.25 * M, 0.52 * M, { seg: P.segs(k, 14) });
      if (P.D1(k)) { k.cyl('stone_grey', 0, 0.5 * M, 0, 0.18 * M, 0.9 * M, { seg: 6 }); k.cyl('stone_grey', 0, 1.3 * M, 0, 0.5 * M, 0.15 * M, { seg: 8 }); }
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { P.tree(k, sx * 2.9 * M, sz * 2.9 * M, 0.75); if (P.D1(k)) { P.hedgeLine(k, sx * 1.4 * M, sz * 4.4 * M, sx * 4.4 * M, sz * 4.4 * M, 0.7 * M, 0.5 * M); P.hedgeLine(k, sx * 4.4 * M, sz * 1.4 * M, sx * 4.4 * M, sz * 4.4 * M, 0.7 * M, 0.5 * M); } }
      P.bench(k, 1.6 * M, 1.0 * M, -Math.PI / 2); P.bench(k, -1.6 * M, -1.0 * M, Math.PI / 2);
      P.lamp(k, 1.0 * M, -1.2 * M, 3.6 * M, { globe: true });
    } else {
      P.mound(k, 'grass', -1.4 * M, -1.6 * M, 3.6 * M, 1.1 * M, { sz: 0.8 });
      P.tree(k, -1.4 * M, -1.8 * M, 1.15);
      P.walk(k, 'gravel', [[-W / 2 + 0.2 * M, 4.0 * M], [W / 2 - 0.2 * M, 4.0 * M]], 1.3 * M);
      picnicTable(k, 2.6 * M, 0.6 * M, 0.3); picnicTable(k, 2.2 * M, -3.2 * M, -0.2);
      for (const [x, z] of [[4, 2.6], [-4.2, 1.6], [4.1, -4.2], [-4.2, -4.2]]) P.bush(k, x * M, z * M, 1.1);
      P.tree(k, 3.8 * M, -1.4 * M, 0.7, { leaf: 'leaves_light' });
      P.bench(k, -2.4 * M, 3.2 * M, Math.PI); P.bin(k, 0.2 * M, 3.2 * M);
    }
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Brunnenplatz (1×1)
registerArch('plaza', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'pavers', { curbMat: 'stone_grey' });
    if (P.D2(k)) for (let i = -2; i <= 2; i++) { P.line(k, i * 2 * M, -4.6 * M, i * 2 * M, 4.6 * M, 0.25 * M, 'stone_grey'); P.line(k, -4.6 * M, i * 2 * M, 4.6 * M, i * 2 * M, 0.25 * M, 'stone_grey'); }
    if (v === 0) {
      // Großer Brunnen mit Schale und Figur
      k.cyl('stone_grey', 0, 0, 0, 2.6 * M, 0.7 * M, { seg: P.segs(k, 20) });
      k.cyl('water_pool', 0, 0, 0, 2.3 * M, 0.6 * M, { seg: P.segs(k, 20) });
      k.cyl('stone_grey', 0, 0, 0, 0.4 * M, 1.8 * M, { seg: 8 });
      k.cyl('stone_grey', 0, 1.6 * M, 0, 1.2 * M, 0.3 * M, { seg: P.segs(k, 12), rTop: 1.3 * M });
      if (P.D1(k)) { k.cyl('water_pool', 0, 1.85 * M, 0, 1.1 * M, 0.08 * M, { seg: P.segs(k, 12) }); k.cyl('stone_grey', 0, 1.9 * M, 0, 0.2 * M, 1.1 * M, { seg: 6 }); k.sphere('roof_copper', 0, 3.25 * M, 0, 0.35 * M, { seg: 8 }); }
      for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2; P.bench(k, Math.sin(a) * 3.6 * M, Math.cos(a) * 3.6 * M, a + Math.PI); }
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const x = sx * 3.9 * M, z = sz * 3.9 * M;
        k.box('stone_grey', x, 0, z, 1.4 * M, 0.5 * M, 1.4 * M);
        k.box('dirt', x, 0, z, 1.1 * M, 0.55 * M, 1.1 * M);
        P.tree(k, x, z, 0.7);
      }
      P.lamp(k, -2.6 * M, 0, 4 * M, { globe: true }); P.lamp(k, 2.6 * M, 0, 4 * M, { globe: true });
    } else {
      // Caféplatz mit Pavillon, Schirmen und Denkmal
      k.box('plaster_cream', -2.6 * M, 0, -2.8 * M, 3.4 * M, 2.8 * M, 2.6 * M);
      k.box('glass_shop', -2.6 * M, 0.3 * M, -1.48 * M, 2.8 * M, 1.8 * M, 0.04 * M, { lit: 0.9 });
      k.box('awning_striped', -2.6 * M, 2.3 * M, -0.9 * M, 3.4 * M, 0.08 * M, 1.4 * M, { rx: 0.25 });
      k.flatRoof('roof_flat_membrane', 'trim_stone', -2.6 * M, 2.8 * M, -2.8 * M, 3.4 * M, 2.6 * M, { parapet: 0.3 * M });
      P.signBox(k, 'CAFE', -2.6 * M, 3.25 * M, -1.48 * M, 0, { px: 0.12 * M, bg: 'trim_dark' });
      for (const [x, z] of [[-3.4, 1.0], [-0.8, 1.6], [-3.0, 3.4]]) {
        umbrella(k, x * M, z * M, pick(k.rng, ['canvas_white', 'awning_red']));
        if (P.D2(k)) { k.cyl('metal_dark', x * M, 0, z * M, 0.4 * M, 0.75 * M, { seg: 8 }); for (const s of [-1, 1]) k.box('metal_dark', x * M + s * 0.75 * M, 0, z * M, 0.4 * M, 0.45 * M, 0.4 * M); }
      }
      k.box('stone_dark', 2.6 * M, 0, -1.6 * M, 1.4 * M, 1.4 * M, 1.4 * M);
      k.box('roof_copper', 2.6 * M, 1.4 * M, -1.6 * M, 0.5 * M, 1.6 * M, 0.5 * M);
      if (P.D1(k)) { k.sphere('roof_copper', 2.6 * M, 3.2 * M, -1.6 * M, 0.3 * M, { seg: 6 }); k.box('roof_copper', 2.6 * M, 2.4 * M, -1.6 * M, 1.2 * M, 0.15 * M, 0.15 * M); }
      P.tree(k, 3.4 * M, 3.0 * M, 0.85); P.tree(k, 3.6 * M, -4 * M, 0.7);
      P.bench(k, 1.2 * M, 3.8 * M, 0); P.bikeRack(k, 0.2 * M, -4.2 * M, 0, 4);
      P.lamp(k, 1 * M, 1 * M, 4 * M, { globe: true });
    }
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Stadtpark (2×2)
registerArch('citypark', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'grass', { curb: false });
    const fl = v ? 1 : -1;
    pond(k, [[fl * 4 * M, -4.2 * M, 4.6 * M, 3.2 * M], [fl * 6.4 * M, -1.6 * M, 2.4 * M, 2.0 * M], [fl * 1.4 * M, -6.0 * M, 2.2 * M, 1.6 * M]]);
    // Wege
    P.walk(k, 'gravel', [[0, D / 2], [-fl * 0.6 * M, 4.6 * M], [-fl * 2.4 * M, 1.6 * M], [-fl * 2.6 * M, -2.4 * M], [-fl * 1.0 * M, -7 * M], [-fl * 0.2 * M, -D / 2 + 0.2 * M]], 1.6 * M);
    P.walk(k, 'gravel', [[-fl * 2.4 * M, 1.6 * M], [fl * 2.6 * M, 1.6 * M], [fl * 7 * M, 3.4 * M], [fl * (W / 2 - 0.2 * M), 4.2 * M]], 1.4 * M);
    P.walk(k, 'gravel', [[-fl * 2.4 * M, 1.6 * M], [-fl * 6.4 * M, 3.6 * M], [-fl * (W / 2 - 0.2 * M), 3.8 * M]], 1.4 * M);
    // Musikpavillon
    const bx = -fl * 6.2 * M, bz = -4.4 * M;
    k.cyl('stone_grey', bx, 0, bz, 2.6 * M, 0.7 * M, { seg: 8 });
    if (P.D1(k)) for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; k.cyl('paint_white', bx + Math.cos(a) * 2.3 * M, 0.7 * M, bz + Math.sin(a) * 2.3 * M, 0.1 * M, 2.6 * M, { seg: 5 }); }
    k.cyl('paint_white', bx, 3.3 * M, bz, 2.7 * M, 0.3 * M, { seg: 8 });
    k.cone('roof_copper', bx, 3.6 * M, bz, 2.9 * M, 1.8 * M, { seg: 8 });
    if (P.D1(k)) k.sphere('paint_yellow', bx, 5.5 * M, bz, 0.2 * M, { seg: 6 });
    if (P.D2(k)) P.railing(k, bx - 2 * M, bz + 2.0 * M, bx + 2 * M, bz + 2.0 * M, 0.7 * M, { h: 0.8 * M });
    // Bäume, Bänke, Laternen, Beete, Denkmal
    trees(k, [[-8.4, 8.4], [8.4, 8.4], [-8.6, -8.6, 'c'], [8.6, -8.8, 'c'], [-4.6, 7.2], [4.8, 6.8], [0 + fl * 8.4, -6.2], [fl * 1.6, 5.6], [-fl * 8.4, 0], [-fl * 4.6, -8.4, 'c'], [fl * 8.6, 0.6, 'p'], [-fl * 0.6, -1.2]], 0.95);
    P.bench(k, -fl * 3.6 * M, 0.4 * M, fl > 0 ? Math.PI / 2 : -Math.PI / 2);
    P.bench(k, fl * 1.0 * M, 2.8 * M, Math.PI);
    P.bench(k, fl * 4.6 * M, 3.4 * M, Math.PI - fl * 0.3);
    P.bench(k, -fl * 1.2 * M, 5.4 * M, fl > 0 ? -Math.PI / 2 : Math.PI / 2);
    for (const [x, z] of [[-fl * 2.6 * M, -0.6 * M], [fl * 3.6 * M, 2.6 * M], [-fl * 0.6 * M, 7.8 * M], [-fl * 4.8 * M, 3.6 * M]]) P.lamp(k, x, z, 3.8 * M, { globe: true });
    P.flowerBed(k, 0, 1.6 * M, 2.4 * M, 2.4 * M, {});
    if (P.D1(k)) { k.box('stone_grey', 0, 0.42 * M, 1.6 * M, 0.7 * M, 0.9 * M, 0.7 * M); k.box('roof_copper', 0, 1.3 * M, 1.6 * M, 0.4 * M, 1.4 * M, 0.35 * M); }
    for (let i = 0; i < 6; i++) P.bush(k, (k.rng() - 0.5) * 16 * M, 6 * M + k.rng() * 3 * M, 0.9);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Sportplatz (2×2)
registerArch('sports', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'grass', { curb: false });
    const zc = 0.8 * M;
    // Laufbahn (Stadionform) und Spielfeld
    const tl = 18.4 * M, tw = 13 * M, tr = tw / 2;
    k.box('rubber_track', 0, 0, zc, tl - tw, P.PAVE, tw);
    for (const s of [-1, 1]) k.cyl('rubber_track', s * (tl / 2 - tr), 0, zc, tr, P.PAVE, { seg: P.segs(k, 24) });
    const fw = 12.4 * M, fd = 8.4 * M, ft = P.PAVE + 0.04 * M;
    k.box('sports_turf', 0, 0, zc, fw + 0.8 * M, ft, fd + 0.8 * M);
    for (const s of [-1, 1]) k.cyl('sports_turf', s * (tl / 2 - tr), 0, zc, tr - 1.6 * M, ft, { seg: P.segs(k, 20) });
    if (P.D2(k)) for (let i = 0; i < 6; i++) k.box(i % 2 ? 'sports_turf' : 'grass', -fw / 2 + fw * (i + 0.5) / 6, 0, zc, fw / 6, ft + 0.02 * M, fd, {});
    const mt = ft + 0.05 * M;
    if (P.D1(k)) {
      const l = (x0, z0, x1, z1) => P.line(k, x0, zc + z0, x1, zc + z1, 0.12 * M, 'paint_white', mt);
      l(-fw / 2, -fd / 2, fw / 2, -fd / 2); l(-fw / 2, fd / 2, fw / 2, fd / 2); l(-fw / 2, -fd / 2, -fw / 2, fd / 2); l(fw / 2, -fd / 2, fw / 2, fd / 2); l(0, -fd / 2, 0, fd / 2);
      P.ring(k, 'paint_white', 0, mt, zc, 1.5 * M, 1.62 * M, { seg: P.segs(k, 24) });
      for (const s of [-1, 1]) { const x0 = s * fw / 2, x1 = s * (fw / 2 - 2 * M); l(x0, -2.4 * M, x1, -2.4 * M); l(x0, 2.4 * M, x1, 2.4 * M); l(x1, -2.4 * M, x1, 2.4 * M); }
      if (P.D2(k)) for (const r of [tr - 0.5 * M, tr - 1.0 * M]) for (const s of [-1, 1]) P.line(k, -(tl - tw) / 2, zc + s * r, (tl - tw) / 2, zc + s * r, 0.06 * M, 'paint_white', P.MARK);
    }
    // Tore
    for (const s of [-1, 1]) {
      const x = s * (fw / 2 + 0.05 * M);
      for (const zz of [-1.2, 1.2]) k.box('paint_white', x, 0, zc + zz * M, 0.12 * M, 2.4 * M, 0.12 * M);
      k.box('paint_white', x, 2.3 * M, zc, 0.12 * M, 0.12 * M, 2.5 * M);
      if (P.D2(k)) k.box('chain_fence', x + s * 0.8 * M, 0, zc, 0.04 * M, 2.2 * M, 2.4 * M);
    }
    // Tribüne mit Dach
    const gz = -8.1 * M, gw = 12 * M;
    k.prism('concrete', [[-1.6 * M, 0], [1.6 * M, 0], [1.6 * M, 0.5 * M], [0.6 * M, 0.5 * M], [0.6 * M, 1.1 * M], [-0.4 * M, 1.1 * M], [-0.4 * M, 1.7 * M], [-1.6 * M, 1.7 * M]], gw, { x: 0, y: 0, z: gz, ry: -Math.PI / 2 });
    if (P.D1(k)) for (const [y, z] of [[0.5, gz + 1.0 * M], [1.1, gz + 0.1 * M], [1.7, gz - 0.9 * M]]) k.box(v ? 'paint_blue' : 'paint_red', 0, y * M, z, gw - 0.4 * M, 0.3 * M, 0.5 * M);
    for (const s of [-1, 0, 1]) k.box('metal_dark', s * 5.6 * M, 0, gz - 1.5 * M, 0.2 * M, 4.2 * M, 0.2 * M);
    k.box('roof_metal_grey', 0, 4.2 * M, gz - 0.2 * M, gw + 0.4 * M, 0.15 * M, 3.6 * M, { rx: 0.12 });
    // Flutlicht
    for (const [x, z] of [[-9.3, -5.6], [9.3, -5.6], [-9.3, 8.4], [9.3, 8.4]]) {
      k.cyl('metal_light', x * M, 0, z * M, 0.15 * M, 11 * M, { seg: 6 });
      if (P.D1(k)) { k.box('metal_dark', x * M, 11 * M, z * M, 1.6 * M, 1.0 * M, 0.3 * M, { ry: Math.atan2(-x, -(z - 0.8)) }); k.box('emissive_cool', x * M, 11.1 * M, z * M, 1.4 * M, 0.8 * M, 0.34 * M, { ry: Math.atan2(-x, -(z - 0.8)) }); k.light(x * M, 11.5 * M, z * M, 0xeaf4ff, 0.8); }
    }
    // Vereinsheim
    k.box('wood_planks', 8.0 * M, 0, -8.2 * M, 3.4 * M, 3.0 * M, 2.8 * M);
    k.gableRoof('roof_tiles_red', 8.0 * M, 3 * M, -8.2 * M, 3.4 * M, 2.8 * M, 1.2 * M, { ridge: 'x' });
    k.gableEnds('wood_planks', 8.0 * M, 3 * M, -8.2 * M, 3.4 * M, 2.8 * M, 1.2 * M, { ridge: 'x' });
    P.door(k, 8.6 * M, -6.8 * M, 0, { w: 0.9 * M, h: 2.0 * M });
    if (P.D1(k)) k.window(7.2 * M, 1.0 * M, -6.78 * M, 0, 1.0 * M, 1.0 * M, { frame: 'window_frame_white' });
    P.signBox(k, 'SV', 8 * M, 2.8 * M, -6.78 * M, 0, { px: 0.12 * M, bg: v ? 'paint_blue' : 'paint_red' });
    P.fence(k, -W / 2 + 0.3 * M, D / 2 - 0.3 * M, W / 2 - 0.3 * M, D / 2 - 0.3 * M, { h: 1.2 * M, mat: 'metal_dark' });
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Spielplatz (1×1) mit Karussell
registerArch('playground', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'grass', { curb: false });
    P.slab(k, 'sand', -0.4 * M, -0.6 * M, 7.8 * M, 7.2 * M);
    slide(k, -2.4 * M, -1.6 * M, v ? Math.PI / 2 : 0, v ? 'paint_blue' : 'paint_red');
    swing(k, 2.0 * M, -2.6 * M, 0);
    sandbox(k, -2.6 * M, 2.4 * M, 2.6 * M);
    // Klettergerüst
    if (P.D1(k)) {
      const cx = 2.2 * M, cz = 1.4 * M, s = 1.6 * M;
      for (const a of [-1, 1]) for (const b of [-1, 1]) k.box('paint_yellow', cx + a * s / 2, 0, cz + b * s / 2, 0.1 * M, 2.0 * M, 0.1 * M);
      for (const y of [1.0, 2.0]) for (const b of [-1, 1]) { k.box('paint_yellow', cx, y * M, cz + b * s / 2, s, 0.08 * M, 0.08 * M); k.box('paint_yellow', cx + b * s / 2, y * M, cz, 0.08 * M, 0.08 * M, s); }
      k.prism('paint_green', [[-s / 2 - 0.1 * M, 0], [s / 2 + 0.1 * M, 0], [0, 0.9 * M]], s + 0.2 * M, { x: cx, y: 2.0 * M, z: cz });
    }
    // Wippe
    if (P.D1(k)) { k.box('metal_dark', -0.2 * M, 0, 3.6 * M, 0.3 * M, 0.5 * M, 0.3 * M); k.box('paint_orange', -0.2 * M, 0.55 * M, 3.6 * M, 3 * M, 0.1 * M, 0.3 * M, { rz: 0.18 }); }
    // Karussell (dreht sich)
    const qx = 0.4 * M, qz = -0.4 * M;
    k.cyl('metal_dark', qx, 0, qz, 0.15 * M, 0.3 * M, { seg: 6 });
    P.anim(k, [qx, 0.3 * M, qz], 'y', 0.9, (s) => {
      s.cyl(v ? 'paint_red' : 'paint_blue', 0, 0, 0, 1.2 * M, 0.12 * M, { seg: P.segs(s, 14) });
      if (s.detail < 1) return;
      s.cyl('metal_light', 0, 0.12 * M, 0, 0.06 * M, 0.9 * M, { seg: 5 });
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; s.box('metal_light', Math.cos(a) * 0.55 * M, 0.9 * M, Math.sin(a) * 0.55 * M, 1.1 * M, 0.06 * M, 0.06 * M, { ry: -a }); s.box('metal_light', Math.cos(a) * 1.05 * M, 0.12 * M, Math.sin(a) * 1.05 * M, 0.06 * M, 0.8 * M, 0.06 * M); }
    });
    P.bench(k, 4.2 * M, 3.4 * M, -Math.PI / 2); P.bench(k, -4.3 * M, -0.4 * M, Math.PI / 2);
    P.tree(k, 4.0 * M, -4.2 * M, 0.85); P.tree(k, -4.0 * M, 4.2 * M, 0.7, { leaf: 'leaves_light' });
    P.fenceRect(k, 0, 0, W - 0.5 * M, D - 0.5 * M, { h: 1.0 * M, mat: 'wood_planks', post: 'wood_planks', gate: 1.4 * M, gateX: 1.8 * M, step: 1.5 * M, gatePosts: false });
    P.bin(k, 2.8 * M, 4.2 * M);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Skatepark (1×1)
registerArch('skatepark', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'concrete');
    const qp = (x, z, ry, len, R = 1.8 * M, deck = 1.0 * M) => {
      const n = k.detail >= 2 ? 6 : 3, prof = [[-deck, 0], [R, 0]];
      for (let i = 1; i <= n; i++) { const t = (i / n) * Math.PI / 2; prof.push([R - R * Math.sin(t), R - R * Math.cos(t)]); }
      prof.push([-deck, R]);
      k.prism('concrete_panel', prof, len, { x, y: 0, z, ry });
      if (P.D1(k)) { const g = new P.G(k, x, z, ry); g.pipe('metal_light', [0, R + 0.05 * M, -len / 2], [0, R + 0.05 * M, len / 2], 0.06 * M, { seg: 5 }); }
    };
    qp(0, -D / 2 + 1.3 * M, -Math.PI / 2, W - 1.2 * M);
    qp(-W / 2 + 1.3 * M, 0.6 * M, 0, 6 * M, 1.4 * M);
    // Funbox mit Rampen und Rail
    const fx = 1.2 * M, fz = 1.2 * M;
    k.box('concrete_panel', fx, 0, fz, 2.4 * M, 0.6 * M, 2.0 * M);
    for (const s of [-1, 1]) k.prism('concrete_panel', [[0, 0], [1.6 * M, 0], [0, 0.6 * M]], 2.0 * M, { x: fx + s * 1.2 * M, y: 0, z: fz, ry: s > 0 ? 0 : Math.PI });
    if (P.D1(k)) { P.pipe(k, 'metal_light', [fx - 1 * M, 0.95 * M, fz], [fx + 1 * M, 0.95 * M, fz], 0.05 * M, { seg: 5 }); for (const s of [-1, 1]) k.box('metal_light', fx + s * 0.9 * M, 0.6 * M, fz, 0.06 * M, 0.35 * M, 0.06 * M); }
    if (P.D1(k)) { P.pipe(k, 'metal_light', [2.2 * M, 0.45 * M, 3.8 * M], [-1.8 * M, 0.45 * M, 3.8 * M], 0.05 * M, { seg: 5 }); for (const x of [-1.6, 2.0]) k.box('metal_dark', x * M, 0, 3.8 * M, 0.06 * M, 0.45 * M, 0.06 * M); }
    // Graffitiwand
    const gx = 4.4 * M;
    k.box('concrete', gx, 0, 0, 0.4 * M, 2.4 * M, 6 * M);
    if (P.D1(k)) {
      const cols = ['neon_pink', 'paint_yellow', 'paint_green', 'paint_blue', 'paint_orange', 'neon_cyan'];
      for (let i = 0; i < (P.D2(k) ? 12 : 5); i++) k.box(pick(k.rng, cols), gx - 0.22 * M, (0.3 + k.rng() * 1.4) * M, (k.rng() - 0.5) * 5 * M, 0.04 * M, (0.5 + k.rng() * 0.6) * M, (0.8 + k.rng() * 1.4) * M);
      if (v === 0) P.text(k, 'SKATE', gx - 0.24 * M, 1.4 * M, 0, -Math.PI / 2, 0.18 * M, 'neon_pink');
    }
    P.bench(k, 3.2 * M, 4.2 * M, Math.PI); P.bin(k, -0.8 * M, 4.3 * M);
    P.lamp(k, -4.2 * M, 4.2 * M, 4 * M);
    P.tree(k, 3.8 * M, -4.0 * M, 0.6);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Hundewiese (1×1)
registerArch('dog_park', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, v ? 'grass_dry' : 'grass', { curb: false });
    P.walk(k, 'gravel', [[-1 * M, D / 2], [-1 * M, 2.8 * M], [-3.2 * M, 0.6 * M], [-3.2 * M, -3.4 * M]], 1.2 * M);
    if (P.D1(k)) {
      // Hürden
      for (const [x, z] of [[1.4, 2.4], [3.0, 0.6]]) { for (const s of [-1, 1]) k.box('paint_white', x * M + s * 0.6 * M, 0, z * M, 0.08 * M, 0.8 * M, 0.08 * M); k.box('paint_red', x * M, 0.55 * M, z * M, 1.2 * M, 0.06 * M, 0.06 * M); }
      // Tunnel (Halbröhre)
      const geo = new THREE.CylinderGeometry(0.45 * M, 0.45 * M, 2.6 * M, P.segs(k, 10), 1, true, 0, Math.PI);
      geo.rotateZ(Math.PI / 2); geo.rotateY(0.6);
      k.add('paint_blue', geo, { x: 1.6 * M, y: 0, z: -2.0 * M });
      // A-Wand
      k.prism('paint_yellow', [[-1.4 * M, 0], [1.4 * M, 0], [0, 1.2 * M]], 0.9 * M, { x: -0.6 * M, y: 0, z: -3.0 * M, ry: 0.2 });
      // Slalomstangen
      for (let i = 0; i < 6; i++) k.cyl(i % 2 ? 'paint_red' : 'paint_white', 3.6 * M, 0, -3.6 * M + i * 0.6 * M, 0.04 * M, 1.0 * M, { seg: 4 });
    }
    // Hunde
    if (P.D2(k)) for (const [x, z, a, c] of [[0.4, 0.4, 0.7, 'wood_dark'], [2.4, -0.6, 2.4, 'paint_white'], [-2.4, 3.6, -0.6, 'dirt']]) {
      const g = new P.G(k, x * M, z * M, a);
      g.box(c, 0, 0.3 * M, 0, 0.3 * M, 0.3 * M, 0.75 * M);
      g.box(c, 0, 0.5 * M, 0.42 * M, 0.25 * M, 0.25 * M, 0.3 * M);
      for (const [lx, lz] of [[-0.1, -0.28], [0.1, -0.28], [-0.1, 0.28], [0.1, 0.28]]) g.box(c, lx * M, 0, lz * M, 0.07 * M, 0.3 * M, 0.07 * M);
      g.box(c, 0, 0.5 * M, -0.42 * M, 0.05 * M, 0.05 * M, 0.25 * M, { rx: 0.6 });
    }
    if (P.D1(k)) { k.box('metal_dark', -4.0 * M, 0, 3.0 * M, 0.08 * M, 1.0 * M, 0.08 * M); k.box('paint_green', -4.0 * M, 0.8 * M, 3.1 * M, 0.4 * M, 0.5 * M, 0.3 * M); }
    P.bench(k, -4.1 * M, -0.6 * M, Math.PI / 2); P.bench(k, -2.0 * M, 4.1 * M, Math.PI);
    P.tree(k, -3.6 * M, -3.8 * M, 0.9); P.tree(k, 3.8 * M, 3.8 * M, 0.75, { leaf: 'leaves_light' });
    P.fenceRect(k, 0, 0, W - 0.5 * M, D - 0.5 * M, { h: 1.3 * M, mat: 'metal_dark', gate: 1.4 * M, gateX: -1 * M, step: 2 * M });
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Teichpark (2×2)
registerArch('pond_park', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'grass', { curb: false });
    const fl = v ? -1 : 1;
    pond(k, [[fl * 1 * M, -2.0 * M, 6.8 * M, 5.2 * M], [fl * -4.6 * M, -4.6 * M, 3.6 * M, 3.0 * M], [fl * 5.4 * M, 1.6 * M, 3.0 * M, 2.4 * M]], { lilies: 10, reeds: 18 });
    // Insel mit Baum
    oval(k, 'grass', fl * 2.6 * M, P.PAVE * 1.6, -3.6 * M, 1.6 * M, 1.3 * M, P.segs(k, 12));
    P.tree(k, fl * 2.6 * M, -3.6 * M, 0.9, { leaf: 'leaves_light' });
    // Steg
    const sx = -fl * 2.4 * M;
    k.box('wood_planks', sx, 0.35 * M, 3.0 * M, 1.6 * M, 0.15 * M, 4.4 * M);
    k.box('wood_planks', sx, 0.35 * M, 0.6 * M, 3.2 * M, 0.15 * M, 1.6 * M);
    if (P.D1(k)) for (const [x, z] of [[-0.7, 4.8], [0.7, 4.8], [-0.7, 2.6], [0.7, 2.6], [-1.5, 0], [1.5, 0], [-1.5, 1.3], [1.5, 1.3]]) k.cyl('wood_dark', sx + x * M, 0, z * M, 0.1 * M, 0.5 * M, { seg: 5 });
    if (P.D2(k)) { P.railing(k, sx - 1.6 * M, -0.2 * M, sx + 1.6 * M, -0.2 * M, 0.5 * M, { h: 0.9 * M, mat: 'wood_dark' }); }
    // Ruderboote
    if (P.D1(k)) for (const [x, z, a] of [[sx + 2.4 * M, 0.2 * M, 0.3], [fl * 4.2 * M, -5.4 * M, 1.6]]) {
      const g = new P.G(k, x, z, a);
      g.box('paint_white', 0, P.PAVE * 1.2, 0, 1.0 * M, 0.35 * M, 2.4 * M);
      g.box('wood_planks', 0, P.PAVE * 1.2 + 0.1 * M, 0, 0.8 * M, 0.3 * M, 2.2 * M);
      g.prism('paint_white', [[-0.5 * M, 0], [0.5 * M, 0], [0, 0.8 * M]], 0.35 * M, { y: P.PAVE * 1.2 + 0.175 * M, z: 1.2 * M, rx: Math.PI / 2 });
    }
    // Enten
    if (P.D2(k)) for (let i = 0; i < 5; i++) { const x = fl * (-1 + k.rng() * 4) * M, z = (-3 + k.rng() * 3) * M; k.box('paint_white', x, P.PAVE * 1.3, z, 0.2 * M, 0.18 * M, 0.35 * M); k.box('paint_green', x, P.PAVE * 1.3 + 0.18 * M, z + 0.15 * M, 0.12 * M, 0.14 * M, 0.12 * M); }
    // Wege
    P.walk(k, 'gravel', [[sx, D / 2], [sx, 5.0 * M]], 1.6 * M);
    P.walk(k, 'gravel', [[-W / 2 + 0.2 * M, 6.2 * M], [-fl * 6 * M, 5.6 * M], [0, 6.0 * M], [fl * 6.6 * M, 5.2 * M], [fl * 8.4 * M, 2.2 * M], [fl * 8.6 * M, -4 * M], [fl * 6.4 * M, -8.6 * M], [0, -9.0 * M], [-fl * 6 * M, -8.6 * M], [-fl * 8.8 * M, -6 * M], [-fl * 8.8 * M, 1 * M], [-fl * 6 * M, 5.6 * M]], 1.3 * M);
    trees(k, [[-8.6, 8.6], [8.6, 8.6], [-fl * 9, -2.6, 'p'], [-fl * 9, -0.8, 'p'], [fl * 9, -8.8, 'c'], [-fl * 3, -9.6, 'c'], [fl * 3, 8.6], [-fl * 6, 8.8], [fl * 9.2, 5.6]], 0.95);
    P.bench(k, 0, 6.9 * M, Math.PI); P.bench(k, fl * 7.8 * M, -1.2 * M, fl > 0 ? -Math.PI / 2 : Math.PI / 2); P.bench(k, -fl * 3 * M, -8.2 * M, 0);
    for (const [x, z] of [[fl * 4 * M, 6.4 * M], [-fl * 8.2 * M, 3 * M], [fl * 7.6 * M, -6.4 * M]]) P.lamp(k, x, z, 3.8 * M, { globe: true });
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Kleingärten (2×2)
registerArch('allotment', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'grass', { curb: false });
    P.walk(k, 'gravel', [[0, D / 2], [0, -D / 2 + 0.3 * M]], 1.4 * M);
    P.walk(k, 'gravel', [[-W / 2 + 0.3 * M, 0], [W / 2 - 0.3 * M, 0]], 1.2 * M);
    const shedCols = ['paint_green', 'paint_red', 'paint_blue', 'wood_planks', 'plaster_yellow', 'siding_white'];
    const plots = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const half of [0, 1]) plots.push([sx * (half ? 7.2 : 3.0) * M, sz * 4.9 * M, sx, sz]);
    plots.forEach(([px, pz, sx, sz], idx) => {
      const pw = 4.0 * M, pd = 8.6 * M;
      if (P.D1(k)) {
        P.hedgeLine(k, px - pw / 2, pz - sz * pd / 2, px + pw / 2, pz - sz * pd / 2, 0.8 * M, 0.35 * M);
        P.hedgeLine(k, px + sx * pw / 2, pz - pd / 2, px + sx * pw / 2, pz + pd / 2, 0.8 * M, 0.35 * M);
      }
      // Beete
      const crops = ['field_crops', 'field_soil', 'field_crops', 'dirt'];
      for (let r = 0; r < 4; r++) k.box(crops[(r + idx) % 4], px - 0.4 * M, 0, pz + sz * (0.4 + r * 0.9) * M - sz * 1.4 * M, 2.6 * M, 0.25 * M, 0.6 * M);
      if (P.D2(k)) for (let r = 0; r < 3; r++) k.box(pick(k.rng, ['paint_red', 'paint_yellow', 'leaves_light', 'plaster_pink']), px - 0.4 * M, 0.25 * M, pz + sz * (0.4 + r * 1.8) * M - sz * 1.4 * M, 2.4 * M, 0.15 * M, 0.3 * M);
      // Laube
      const lz = pz + sz * 2.8 * M, lx = px + (k.rng() < 0.5 ? -0.6 : 0.6) * M, col = shedCols[(idx * 5 + v) % shedCols.length];
      const g = new P.G(k, lx, lz, sz > 0 ? 0 : Math.PI);
      g.box(col, 0, 0, 0, 2.4 * M, 2.1 * M, 1.9 * M);
      g.prism(idx % 2 ? 'roof_tiles_red' : 'roof_metal_grey', [[-1.2 * M - 0.25 * M, 0], [1.2 * M + 0.25 * M, 0], [1.2 * M + 0.25 * M, 0.08 * M], [0, 0.9 * M], [-1.2 * M - 0.25 * M, 0.08 * M]], 2.3 * M, { y: 2.1 * M });
      g.prism(col, [[-1.2 * M, 0], [1.2 * M, 0], [0, 0.82 * M]], 1.9 * M, { y: 2.1 * M });
      if (P.D1(k)) { g.box('door_wood', -0.5 * M, 0, 0.96 * M, 0.7 * M, 1.8 * M, 0.06 * M); g.quad('glass_window', 0.55 * M, 1.3 * M, 0.98 * M, 0.7 * M, 0.6 * M, { lit: k.rng() }); }
      if (P.D2(k)) { g.box('wood_planks', 0, 0, 1.4 * M, 2.4 * M, 0.12 * M, 0.9 * M); g.cyl('paint_green', 1.4 * M, 0, 0.6 * M, 0.3 * M, 0.8 * M, { seg: 8 }); }
      if (idx % 3 === 0) P.tree(k, px + sx * 1.2 * M, pz - sz * 2.6 * M, 0.55, { leaf: 'leaves_light' });
      else if (idx % 3 === 1 && P.D1(k)) k.box('glass_skylight', px + sx * 1.0 * M, 0, pz - sz * 2.8 * M, 1.4 * M, 1.4 * M, 1.8 * M, { lit: 0.99 });
      // Gartenzwerg
      if (P.D2(k)) { k.box('paint_blue', px - 1.2 * M, 0, pz + sz * 1.2 * M, 0.18 * M, 0.25 * M, 0.18 * M); k.cone('paint_red', px - 1.2 * M, 0.25 * M, pz + sz * 1.2 * M, 0.12 * M, 0.25 * M, { seg: 5 }); }
    });
    P.signBox(k, 'KLEINGARTEN', 0, 2.6 * M, D / 2 - 0.4 * M, 0, { px: 0.1 * M, bg: 'paint_green' });
    if (P.D1(k)) for (const s of [-1, 1]) k.box('wood_dark', s * 1.6 * M, 0, D / 2 - 0.4 * M, 0.12 * M, 2.4 * M, 0.12 * M);
    P.fenceRect(k, 0, 0, W - 0.4 * M, D - 0.4 * M, { h: 1.1 * M, mat: 'wood_planks', post: 'wood_planks', gate: 1.6 * M, step: 2 * M, gatePosts: false });
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Freibad (2×2) mit Rutsche
registerArch('swimming_pool', {
  variants: 1,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx);
    P.lot(k, W, D, 'grass', { curb: false });
    // Schwimmerbecken
    const px = -2.4 * M, pz = -4.4 * M, pw = 12.4 * M, pd = 7.4 * M;
    k.box('tile_white', px, 0, pz, pw + 2.4 * M, 0.3 * M, pd + 2.4 * M);
    k.box('water_pool', px, 0, pz, pw, 0.32 * M, pd);
    if (P.D1(k)) for (let i = 1; i < 5; i++) k.box(i % 2 ? 'paint_red' : 'paint_white', px, 0.32 * M, pz - pd / 2 + (i * pd) / 5, pw - 0.4 * M, 0.04 * M, 0.07 * M);
    if (P.D2(k)) for (let i = 0; i < 6; i++) k.box('paint_white', px - pw / 2 - 0.5 * M, 0.3 * M, pz - pd / 2 + (i + 0.5) * pd / 6, 0.6 * M, 0.35 * M, 0.5 * M);
    // Sprungturm
    const tx = px + pw / 2 + 0.1 * M;
    k.box('concrete', tx + 0.6 * M, 0, pz, 1.2 * M, 5.4 * M, 1.0 * M);
    for (const [y, l] of [[3.0, 2.4], [5.4, 2.8]]) k.box('concrete', tx - l / 2 * M + 0.6 * M, y * M, pz, l * M, 0.2 * M, 1.6 * M);
    if (P.D1(k)) { P.railing(k, tx - 2.2 * M, pz - 0.8 * M, tx + 1.2 * M, pz - 0.8 * M, 5.6 * M); P.railing(k, tx - 2.2 * M, pz + 0.8 * M, tx + 1.2 * M, pz + 0.8 * M, 5.6 * M); k.box('paint_white', tx - 0.6 * M, 1.0 * M, pz + 2.4 * M, 2.2 * M, 0.1 * M, 0.5 * M); k.box('metal_dark', tx + 0.4 * M, 0, pz + 2.4 * M, 0.3 * M, 1.0 * M, 0.3 * M); }
    // Kinderbecken + Rutsche
    const kx = 6.4 * M, kz = -1.8 * M;
    k.cyl('tile_white', kx, 0, kz, 2.8 * M, 0.3 * M, { seg: P.segs(k, 18) });
    k.cyl('water_pool', kx, 0, kz, 2.4 * M, 0.32 * M, { seg: P.segs(k, 18) });
    const sx = 7.6 * M, sz = -7.4 * M, sh = 5.6 * M;
    for (const a of [-1, 1]) for (const b of [-1, 1]) k.box('metal_dark', sx + a * 0.8 * M, 0, sz + b * 0.8 * M, 0.15 * M, sh, 0.15 * M);
    k.box('paint_blue', sx, sh, sz, 2.0 * M, 0.2 * M, 2.0 * M);
    if (P.D1(k)) { P.beam(k, 'metal_dark', [sx - 1.0 * M, 0, sz - 3.0 * M], [sx - 1.0 * M, sh, sz - 0.6 * M], 0.8 * M, { d: 0.12 * M }); k.box('paint_blue', sx, sh + 1.0 * M, sz, 2.0 * M, 0.15 * M, 2.0 * M); for (const a of [-1, 1]) for (const b of [-1, 1]) k.box('metal_dark', sx + a * 0.9 * M, sh, sz + b * 0.9 * M, 0.08 * M, 1.0 * M, 0.08 * M); }
    const curve = new THREE.CatmullRomCurve3([[sx, sh + 0.4 * M, sz + 0.8 * M], [sx + 1.2 * M, sh - 0.8 * M, sz + 2.6 * M], [sx - 0.6 * M, sh - 1.8 * M, sz + 4.0 * M], [sx - 2.4 * M, sh - 2.8 * M, sz + 2.8 * M], [sx - 1.6 * M, sh - 3.8 * M, sz + 1.0 * M], [sx - 0.6 * M, sh - 4.6 * M, kz - 1.8 * M], [kx - 0.4 * M, 0.6 * M, kz - 1.4 * M]].map((p) => new THREE.Vector3(...p)));
    k.add('paint_yellow', new THREE.TubeGeometry(curve, k.detail >= 2 ? 40 : k.detail ? 18 : 8, 0.45 * M, k.detail >= 2 ? 8 : 5, false), {});
    // Liegewiese
    for (const [x, z] of [[-7.6, 1.4], [-4.0, 2.2], [-0.4, 1.0], [2.6, 2.4]]) { umbrella(k, x * M, z * M); lounger(k, x * M + 0.9 * M, z * M + 0.4 * M, 0.2); lounger(k, x * M - 0.9 * M, z * M + 0.4 * M, -0.1, 'paint_blue'); }
    if (P.D2(k)) for (let i = 0; i < 6; i++) k.box(pick(k.rng, ['paint_red', 'paint_yellow', 'paint_blue', 'paint_green', 'neon_pink']), (-8 + k.rng() * 11) * M, P.LOT, (3.4 + k.rng() * 1.2) * M, 0.9 * M, 0.03 * M, 1.8 * M, { ry: k.rng() });
    // Eingangsgebäude mit Kiosk
    const ex = -4.0 * M, ez = 7.8 * M;
    k.box('plaster_blue', ex, 0, ez, 10 * M, 3.2 * M, 3.4 * M);
    k.flatRoof('roof_flat_membrane', 'paint_white', ex, 3.2 * M, ez, 10 * M, 3.4 * M, { parapet: 0.4 * M });
    P.ribbon(k, 'back', ex, ez, 10 * M, 3.4 * M, 1.4 * M, 1.0 * M);
    P.ribbon(k, 'front', ex + 2.4 * M, ez, 5 * M, 3.4 * M, 1.2 * M, 1.2 * M, { margin: 0.2 * M });
    P.door(k, ex - 2.6 * M, ez + 1.7 * M, 0, { glass: true, w: 1.8 * M, canopy: 'paint_white' });
    P.signBox(k, 'FREIBAD', ex - 2.6 * M, 3.0 * M, ez + 1.72 * M, 0, { px: 0.15 * M, bg: 'paint_blue' });
    k.box('wood_planks', 5.6 * M, 0, 6.6 * M, 3.0 * M, 2.6 * M, 2.4 * M);
    k.box('awning_striped', 5.6 * M, 2.1 * M, 8.1 * M, 3.2 * M, 0.08 * M, 1.2 * M, { rx: 0.3 });
    k.flatRoof('roof_flat_membrane', 'wood_dark', 5.6 * M, 2.6 * M, 6.6 * M, 3.0 * M, 2.4 * M, { parapet: 0.2 * M });
    P.signBox(k, 'KIOSK', 5.6 * M, 2.95 * M, 7.82 * M, 0, { px: 0.08 * M, bg: 'paint_red' });
    P.hedgeLine(k, -W / 2 + 0.4 * M, -D / 2 + 0.4 * M, W / 2 - 0.4 * M, -D / 2 + 0.4 * M, 1.4 * M, 0.7 * M);
    P.hedgeLine(k, -W / 2 + 0.4 * M, -D / 2 + 0.4 * M, -W / 2 + 0.4 * M, 5.6 * M, 1.4 * M, 0.7 * M);
    P.hedgeLine(k, W / 2 - 0.4 * M, -D / 2 + 0.4 * M, W / 2 - 0.4 * M, 5.0 * M, 1.4 * M, 0.7 * M);
    P.tree(k, 8.4 * M, 3.6 * M, 0.8); P.tree(k, -8.6 * M, 4.6 * M, 0.7);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Tennisplätze (2×1)
registerArch('tennis', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, v ? 'sports_turf' : 'grass', { curb: false });
    const cx = -1.6 * M, cw = 15.4 * M, cd = 8.4 * M;
    P.slab(k, v ? 'court_blue' : 'rubber_track', cx, 0, cw, cd);
    const mt = P.MARK, L = 12.6 * M, Wd = 6.2 * M, ws = 4.8 * M, sl = 3.4 * M;
    if (P.D1(k)) {
      const l = (x0, z0, x1, z1) => P.line(k, cx + x0, z0, cx + x1, z1, 0.1 * M, 'paint_white', mt);
      l(-L / 2, -Wd / 2, L / 2, -Wd / 2); l(-L / 2, Wd / 2, L / 2, Wd / 2); l(-L / 2, -Wd / 2, -L / 2, Wd / 2); l(L / 2, -Wd / 2, L / 2, Wd / 2);
      l(-L / 2, -ws / 2, L / 2, -ws / 2); l(-L / 2, ws / 2, L / 2, ws / 2);
      l(-sl, -ws / 2, -sl, ws / 2); l(sl, -ws / 2, sl, ws / 2); l(-sl, 0, sl, 0);
    }
    // Netz
    for (const s of [-1, 1]) k.box('metal_dark', cx, 0, s * (Wd / 2 + 0.4 * M), 0.1 * M, 1.1 * M, 0.1 * M);
    k.box('chain_fence', cx, 0.1 * M, 0, 0.04 * M, 0.85 * M, Wd + 0.8 * M);
    k.box('paint_white', cx, 0.92 * M, 0, 0.07 * M, 0.08 * M, Wd + 0.8 * M);
    if (P.D2(k)) { k.box('metal_dark', cx, 0, Wd / 2 + 1.1 * M, 0.6 * M, 1.8 * M, 0.6 * M); k.box('wood_planks', cx, 1.8 * M, Wd / 2 + 1.1 * M, 0.7 * M, 0.1 * M, 0.7 * M); }
    P.fenceRect(k, cx, 0, cw + 0.2 * M, cd + 0.2 * M, { h: 3 * M, mat: 'chain_fence', gate: 1.2 * M, gateX: cx + 4 * M });
    // Vereinshütte
    const hx = 8.0 * M;
    k.box('wood_planks', hx, 0, -1.6 * M, 3.4 * M, 2.8 * M, 5.2 * M);
    k.gableRoof('roof_tiles_red', hx, 2.8 * M, -1.6 * M, 3.4 * M, 5.2 * M, 1.3 * M, { ridge: 'z' });
    k.gableEnds('wood_planks', hx, 2.8 * M, -1.6 * M, 3.4 * M, 5.2 * M, 1.3 * M, { ridge: 'z' });
    if (P.D1(k)) { k.window(hx - 1.73 * M, 1.0 * M, -2.6 * M, -Math.PI / 2, 1.2 * M, 1.0 * M, { frame: 'window_frame_white' }); k.box('wood_dark', hx, 0, 1.6 * M, 3.4 * M, 0.2 * M, 1.4 * M); }
    P.door(k, hx, 1.0 * M, 0, { w: 0.9 * M, h: 2.0 * M });
    P.bench(k, hx, 3.6 * M, Math.PI);
    P.bush(k, 9.2 * M, 4.2 * M, 0.9); P.tree(k, 8.6 * M, -4.2 * M, 0.6);
    return P.finish(k);
  },
});

// ---------------------------------------------------------------- Strandbad (2×2), Wasser hinten
registerArch('beach', {
  variants: 2,
  build(ctx) {
    const k = ctx.kit, [W, D] = dims(ctx), v = ctx.variant;
    P.lot(k, W, D, 'sand', { curb: false });
    k.box('dirt', 0, 0, -D / 2 + 1.2 * M, W - 0.3 * M, P.LOT + 0.02 * M, 2.1 * M);
    P.slab(k, 'grass', 0, D / 2 - 1.0 * M, W - 0.3 * M, 1.7 * M);
    // Holzsteg vom Eingang bis ins Wasser
    P.slab(k, 'wood_planks', -1.4 * M, 3.0 * M, 1.8 * M, 9.6 * M, 0.25 * M);
    k.box('wood_planks', -1.4 * M, 0.3 * M, -6.6 * M, 1.8 * M, 0.15 * M, 6.4 * M);
    if (P.D1(k)) for (let i = 0; i < 4; i++) for (const s of [-1, 1]) k.cyl('wood_dark', -1.4 * M + s * 0.8 * M, 0, -9.6 * M + i * 1.8 * M, 0.1 * M, 0.45 * M, { seg: 5 });
    // Strandkörbe
    const korb = (x, z, ry, c) => {
      if (!P.D1(k)) { k.box('hay', x, 0, z, 1.3 * M, 1.5 * M, 1.0 * M, { ry }); return; }
      const g = new P.G(k, x, z, ry);
      g.box('hay', 0, 0, 0, 1.3 * M, 0.9 * M, 1.0 * M);
      g.box('hay', 0, 0.9 * M, -0.3 * M, 1.3 * M, 0.7 * M, 0.4 * M);
      g.box('hay', 0, 1.5 * M, -0.05 * M, 1.3 * M, 0.15 * M, 0.85 * M, { rx: -0.25 });
      g.box(c, 0, 0.5 * M, 0.06 * M, 1.12 * M, 1.0 * M, 0.9 * M);
    };
    const kc = ['awning_blue', 'awning_striped', 'awning_red', 'canvas_white', 'awning_blue', 'awning_green'];
    for (let i = 0; i < 6; i++) korb((-8.4 + (i % 3) * 2.2 + (i > 2 ? 0.8 : 0)) * M, (i > 2 ? -1.2 : 1.8) * M, Math.PI + (k.rng() - 0.5) * 0.4, kc[i]);
    for (const [x, z] of [[3.0, 1.2], [6.4, -0.8], [4.6, -4.0], [8.4, 2.6]]) { umbrella(k, x * M, z * M); if (P.D2(k)) k.box(pick(k.rng, ['paint_red', 'paint_yellow', 'paint_blue', 'neon_pink']), x * M + 0.9 * M, P.LOT, z * M + 0.6 * M, 0.9 * M, 0.03 * M, 1.8 * M, { ry: 0.3 }); }
    // Beachvolleyball
    if (P.D1(k)) { const nx = 4.4 * M, nz = 5.2 * M; for (const s of [-1, 1]) k.box('wood_dark', nx + s * 3 * M, 0, nz, 0.12 * M, 2.4 * M, 0.12 * M); k.box('paint_white', nx, 1.7 * M, nz, 6 * M, 0.7 * M, 0.04 * M); }
    // Rettungsturm
    const rx = -5.6 * M, rz = -4.2 * M;
    for (const a of [-1, 1]) for (const b of [-1, 1]) k.box('wood_dark', rx + a * 0.9 * M, 0, rz + b * 0.9 * M, 0.15 * M, 3.2 * M, 0.15 * M);
    k.box('wood_planks', rx, 3.2 * M, rz, 2.4 * M, 0.15 * M, 2.4 * M);
    k.box('paint_white', rx, 3.35 * M, rz - 0.3 * M, 1.8 * M, 1.6 * M, 1.4 * M);
    k.box('paint_red', rx, 4.95 * M, rz - 0.3 * M, 2.1 * M, 0.2 * M, 1.7 * M);
    if (P.D1(k)) { P.beam(k, 'wood_dark', [rx + 0.6 * M, 0, rz + 2.6 * M], [rx + 0.6 * M, 3.2 * M, rz + 1.2 * M], 0.6 * M, { d: 0.1 * M }); k.box('glass_window', rx, 4.0 * M, rz - 1.02 * M, 1.4 * M, 0.7 * M, 0.04 * M, { lit: 0 }); P.flagpole(k, rx + 1.0 * M, rz - 1.0 * M, 6.8 * M, 'paint_red'); }
    // Kiosk und Duschen
    k.box('siding_white', 6.6 * M, 0, 8.0 * M, 4.0 * M, 2.8 * M, 2.4 * M);
    k.box('awning_striped', 6.6 * M, 2.2 * M, 6.4 * M, 4.2 * M, 0.08 * M, 1.2 * M, { rx: -0.3 });
    k.flatRoof('roof_flat_membrane', 'paint_blue', 6.6 * M, 2.8 * M, 8.0 * M, 4.0 * M, 2.4 * M, { parapet: 0.2 * M });
    P.signBox(k, 'STRANDBAD', -1.4 * M, 2.6 * M, D / 2 - 0.3 * M, 0, { px: 0.12 * M, bg: 'paint_blue' });
    if (P.D1(k)) for (const s of [-1, 1]) k.box('wood_dark', -1.4 * M + s * 1.6 * M, 0, D / 2 - 0.3 * M, 0.12 * M, 2.4 * M, 0.12 * M);
    if (P.D2(k)) for (const x of [1.2, 2.0]) { k.box('metal_light', x * M, 0, 7.6 * M, 0.08 * M, 2.4 * M, 0.08 * M); k.box('metal_light', x * M, 2.3 * M, 7.4 * M, 0.08 * M, 0.08 * M, 0.5 * M); }
    for (let i = 0; i < 8; i++) { if (!P.D1(k)) break; k.cone('grass_dry', (-9 + i * 2.5) * M + k.rng() * M, 0, (6.4 + k.rng() * 0.8) * M, 0.4 * M, 0.7 * M, { seg: 5 }); }
    void v;
    return P.finish(k);
  },
});
