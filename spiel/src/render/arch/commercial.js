// Gewerbe (Zone Gewerbe, Schlüssel 'com'). Besitzer: G3 – Architektur Wohnen & Gewerbe.
// Stufe 1: Kiosk, Bäckerei-Café mit Außenbestuhlung, Laden im Wohnhaus, Imbiss, Blumenladen, Pavillon,
//          Ladenzeile, Tankstelle, Gasthaus mit Biergarten, Supermarkt mit Parkplatz, Gärtnerei, Werkstatt
// Stufe 2: Wohn- und Geschäftshaus, Apotheke, Restaurant, Eiscafé, Bank, Fachmarkt, Drive-in
// Stufe 3: Geschäftshaus, Gründerzeit mit Läden, Hotel, Warenhaus, Kino, Glas-Eckhaus
// Stufe 4: Kaufhaus, großes Hotel, Einkaufszentrum mit Glasdach, Galerie, Geschäftshaus aus Glas
// Stufe 5: Einkaufsturm, Hotelturm, Turm mit Leuchtwerbung, Mall mit Kuppel, Glasturm mit Krone
import * as THREE from 'three';
import { registerArch } from './index.js';
import { M } from './kit.js';
import { Geo, F, NB, W, rr, rpick, chance } from './rescom_geo.js';
import { mframe, massWalls, bays, band, cornice, balcony, railing, pilasters, wall } from './rescom_facade.js';
import { rectRoof, flatRoof, rooftop, chimney, dormer, flatSolar } from './rescom_roofs.js';
import { ground, tree, bush, hedge, fence, bins, bikeRack, parkingRow, lamp, bench, planter, cafeSeating, parasol, car, CAR_COLORS } from './rescom_site.js';
import { house, winStyle, PAL } from './rescom_house.js';
import { stack, rows, entranceOp, gruenderzeit, punkthaus, towerGround, firewallOps, firewallDecor, firewallKind } from './rescom_block.js';
import { signBand, awning, bladeSign, logoDisc, display, pylon, flags, text, textWidth } from './rescom_signs.js';
import { NAMES, AWNINGS, NEON, shopDecor, curtain, glassBox, fuelCanopy, greenhouse, cartShelter, roofSign } from './rescom_shop.js';

const winT = (o) => ({ kind: 'win', ...o });
const name = (rng, k) => rpick(rng, NAMES[k]);

// Gepflasterte Ladenfläche vorne + Rest
function comGround(g, W0, D0, frontDepth, o = {}) {
  ground(g, o.rest || 'pavers', 0, 0, W0 - 0.04 * M, D0 - 0.04 * M, 0.03 * M);
  if (frontDepth > 0.2 * M) ground(g, o.front || 'sidewalk', 0, D0 / 2 - frontDepth / 2, W0 - 0.04 * M, frontDepth - 0.02 * M, 0.05 * M);
}

// ---------- Stufe 1
// Kiosk / Trinkhalle
function kiosk(ctx, g, P) {
  const { rng } = ctx;
  const { W: PW, D: PD } = P;
  const w = 4.6 * M, d = 3.6 * M, h = 2.9 * M;
  const cz = PD / 2 - 2.8 * M - d / 2, cx = rr(rng, -1, 1) * M;
  const wallM = rpick(rng, ['plaster_white', 'paint_white', 'siding_white', 'plaster_yellow', 'metal_panel_white', 'wood_planks']);
  const m = { cx, cz, sx: w, sz: d, y0: 0, y1: h, wall: wallM };
  const shop = { kind: 'shop', u: 0, y: 0.95 * M, w: 2.8 * M, h: 1.45 * M, frame: 'window_frame_dark', cols: 2, riser: 0.05 * M };
  massWalls(g, m, { front: [shop], left: [{ kind: 'door', u: -0.4 * M, y: 0.08 * M, w: 0.9 * M, h: 2.1 * M, mat: 'metal_panel_grey', frame: 'trim_dark', lamp: false, mailbox: null }], back: [], right: [winT({ u: 0, y: 1.2 * M, w: 1.2 * M, h: 0.9 * M, frame: 'window_frame_dark', panes: { cols: 1 } })] });
  // Dach mit Überstand vorne
  g.box('trim_dark', cx, h, cz + 0.5 * M, w + 0.6 * M, 0.25 * M, d + 1.4 * M);
  g.box('roof_flat_membrane', cx, h + 0.25 * M, cz + 0.5 * M, w + 0.5 * M, 0.02 * M, d + 1.3 * M);
  const f = mframe(cx, cz + 0.7 * M, w + 0.6 * M, d, 'front');
  signBand(g, { ...f, oz: cz + d / 2 + 1.2 * M }, name(rng, 'kiosk'), 0, h - 0.05 * M, w + 0.4 * M, 0.55 * M, { band: rpick(rng, ['paint_red', 'paint_blue', 'paint_green', 'trim_dark']), mat: 'sign_white' });
  const fF = mframe(cx, cz, w, d, 'front');
  if (g.detail >= 1) {
    g.wbox('metal_light', fF, 0, 0.9 * M, 0.25 * M, 3.0 * M, 0.06 * M, 0.5 * M); // Tresen
    awning(g, fF, 0, h - 0.1 * M, 3.0 * M, 0.9 * M, rpick(rng, AWNINGS), 'roll');
    display(g, fF, -w / 2 - 0.5 * M, 0.8 * M, 'news');
    logoDisc(g, fF, w / 2 - 0.4 * M, 2.1 * M, 0.04 * M, 0.35 * M, rpick(rng, ['paint_red', 'paint_yellow']));
    // Eisschild
    g.wbox('paint_white', fF, w / 2 + 0.6 * M, 0, 0.8 * M, 0.06 * M, 1.0 * M, 0.06 * M, { skip: NB });
    g.wbox('paint_blue', fF, w / 2 + 0.6 * M, 1.0 * M, 0.8 * M, 0.55 * M, 0.75 * M, 0.06 * M);
  }
  comGround(g, PW, PD, 2.6 * M);
  bench(g, cx - w / 2 - 1.6 * M, PD / 2 - 1.0 * M, 0);
  bikeRack(g, cx + w / 2 + 1.8 * M, PD / 2 - 1.2 * M, 3, 0);
  if (g.detail >= 1) {
    g.cyl('metal_dark', cx + w / 2 + 1.0 * M, 0, PD / 2 - 0.5 * M, 0.25 * M, 0.9 * M, { seg: 8 });
    tree(g, -PW / 2 + 1.6 * M, -PD / 2 + 1.8 * M, 1.0);
    if (PW > 1.5 || PD > 1.5) parkingRow(g, PW > 1.5 ? PW * 0.22 : 0, -PD / 2 + 2.8 * M, PW > 1.5 ? 4 : 2, 1, 0.6);
    hedge(g, 0, -PD / 2 + 0.3 * M, PW - 0.4 * M, 0.5 * M, 1.0 * M);
  }
}

// Bäckerei / Café mit Markise und Außenbestuhlung
function baeckerei(ctx, g, P, o = {}) {
  const { rng } = ctx;
  const { W: PW, D: PD } = P;
  const terrace = o.terrace ?? 3.2 * M;
  const w = Math.min(PW - 0.6 * M, o.w ?? 9.0 * M), d = Math.min(PD - terrace - 2.0 * M, o.d ?? 7.5 * M);
  const cz = PD / 2 - terrace - d / 2;
  const floors = o.floors ?? 1;
  const wallM = o.wall || rpick(rng, ['plaster_cream', 'plaster_white', 'brick_red', 'plaster_ochre', 'plaster_pink', 'brick_yellow']);
  const isCafe = o.kind === 'cafe';
  const nm = o.name || name(rng, isCafe ? 'cafe' : 'baker');
  const nb = Math.max(1, Math.round(w / (4.2 * M)));
  const sUs = bays(w, nb, 0.4 * M);
  const shopW = (w - 0.8 * M) / nb - 0.6 * M;
  const shops = sUs.map((u, i) => ({ kind: 'shop', u, y: 0.15 * M, w: shopW, h: 2.9 * M, frame: rpick(rng, ['wood_dark', 'window_frame_dark', 'paint_white']), door: i === 0 ? 0 : -1, cols: 3, transom: 0.5 * M }));
  const roofT = o.roof || rpick(rng, ['flat', 'gable', 'flat']);
  const top = 0.15 * M + 3.0 * M + 0.9 * M + (floors - 1) * 2.9 * M;
  const upper = [];
  if (floors > 1) for (let f = 1; f < floors; f++) for (const u of bays(w, Math.max(2, Math.round(w / (2.6 * M))), 0.5 * M)) upper.push(winT({ u, y: 4.05 * M + (f - 1) * 2.9 * M + 0.85 * M, w: 1.2 * M, h: 1.35 * M, frame: 'window_frame_white', panes: { cols: 2, transom: 0.22 }, sill: true, shutters: chance(rng, 0.3) ? rpick(rng, PAL.shutter) : null }));
  const m = { cx: 0, cz, sx: w, sz: d, y0: 0, y1: top, wall: wallM };
  const backOps = [{ kind: 'door', u: w * 0.3, y: 0.15 * M, w: 1.0 * M, h: 2.1 * M, mat: 'metal_panel_grey', frame: 'trim_dark' }, winT({ u: -w * 0.2, y: 1.2 * M, w: 1.4 * M, h: 1.0 * M, frame: 'window_frame_dark', panes: { cols: 2 } })];
  const gable = roofT === 'gable';
  massWalls(g, m, { front: [...shops, ...upper], back: backOps, left: [], right: [] });
  band(g, 'stone_grey', m, 0, 0.15 * M, 0.03 * M, { skip: F.BOTTOM });
  const fF = mframe(0, cz, w, d, 'front');
  const aw = o.awning || rpick(rng, AWNINGS);
  sUs.forEach((u, i) => shopDecor(g, fF, shops[i], { name: i === 0 || nb === 1 ? nm : (isCafe ? 'KUCHEN' : 'CAFÉ'), awning: aw, awningType: rpick(rng, ['fixed', 'fixed', 'dome']), band: o.band || rpick(rng, ['trim_dark', 'wood_dark', 'paint_green', 'paint_red']), letters: g.neon(rpick(rng, ['sign_white', 'neon_yellow', 'paint_yellow'])), blade: i === 0 && !isCafe ? 'B' : null, bladeMat: 'paint_yellow', bladePanel: 'trim_dark', bandGap: 0.12 * M }));
  if (gable) {
    const info = rectRoof(g, { cx: 0, cz, sx: w, sz: d, y0: top, pitch: rr(rng, 38, 45), ridge: 'x', mat: rpick(rng, PAL.roofTiles), under: 'wood_planks', edge: 'paint_white', wall: wallM, eave: 0.45 * M, verge: 0.3 * M });
    if (g.detail >= 1) dormer(g, info, 1, 0, { type: 'gable', w: 1.8 * M, wall: wallM });
    chimney(g, info, w * 0.3, -0.2 * M, {});
  } else {
    cornice(g, 'trim_stone', m, top - 0.35 * M, 0.9, { sides: ['front'] });
    flatRoof(g, m, top, { mat: 'roof_flat_gravel', wall: wallM, parapet: 0.6 * M });
    rooftop(g, 0, top, cz, w, d, { n: 2 });
  }
  // Außenbestuhlung
  comGround(g, PW, PD, terrace + 0.3 * M);
  if (g.detail >= 1) {
    cafeSeating(g, 0, PD / 2 - terrace * 0.45, w * 0.85, Math.max(2, Math.round(w / (2.6 * M))), { umbrella: chance(rng, 0.6) ? rpick(rng, ['canvas_white', aw, 'awning_green']) : null, table: rpick(rng, ['paint_white', 'metal_light', 'wood_planks']), chair: rpick(rng, ['metal_dark', 'paint_white', 'wood_dark']) });
    for (const sx of [-1, 1]) planter(g, sx * (w / 2 - 0.3 * M), PD / 2 - 0.4 * M, 'concrete');
    if (g.detail >= 2) { g.wbox('trim_dark', fF, w / 2 - 0.8 * M, 0, 1.4 * M, 0.6 * M, 1.0 * M, 0.05 * M, { skip: NB }); }
  }
  // Hof hinten
  const yd = cz - d / 2 + PD / 2;
  if (yd > 1.5 * M && g.detail >= 1) {
    bins(g, -PW / 2 + 1.4 * M, -PD / 2 + 0.7 * M, 3);
    if (yd > 5 * M) parkingRow(g, 0, -PD / 2 + yd / 2, Math.floor((PW - 1 * M) / (2.5 * M)), -1, 0.55);
    else tree(g, PW * 0.3, -PD / 2 + yd / 2, 0.8);
  }
}

// Laden im Wohnhaus (Tante-Emma-Laden): Wohnhaus mit Ladengeschoss
function ladenhaus(ctx, g, P, o = {}) {
  const { rng } = ctx;
  const { W: PW, D: PD } = P;
  const front = 2.0 * M;
  const w = Math.min(PW - 0.8 * M, o.w ?? 8.6 * M), d = Math.min(PD - front - 1.4 * M, o.d ?? 8.0 * M);
  const z = PD / 2 - front - d / 2;
  const pl = 0.25 * M, FH = 3.2 * M;
  const shopW = Math.min(w * 0.55, 4.6 * M);
  const shopU = -w / 2 + 0.6 * M + shopW / 2;
  const shop = { kind: 'shop', u: shopU, y: pl, w: shopW, h: 2.7 * M, frame: rpick(rng, ['wood_dark', 'window_frame_dark']), door: 0, cols: 3 };
  const wallM = rpick(rng, PAL.plaster);
  const floors = o.floors ?? 2;
  const r = house(g, {
    x: 0, z, w, d, floors, fh: FH, knee: 0.5 * M, plinth: pl, wall: wallM, roof: { type: o.roof || rpick(rng, ['gable', 'gableF', 'halfhip']), pitch: rr(rng, 40, 46), mat: rpick(rng, PAL.roofTiles), k: 0.35 },
    win: { ...winStyle('casement', { frame: 'window_frame_white' }), shutters: chance(rng, 0.3) ? rpick(rng, PAL.shutter) : null },
    door: { at: w / 2 - 1.3 * M, inBay: false, mat: rpick(rng, PAL.door), canopy: null }, frontGround: [shop], bays: { front: 3 }, chimney: {},
    dormers: chance(rng, 0.5) ? { n: 1, type: 'shed', w: 2.2 * M } : null,
  });
  void r;
  const fF = mframe(0, z, w, d, 'front');
  shopDecor(g, fF, shop, { name: o.name || name(rng, o.kind || 'shop'), awning: rpick(rng, AWNINGS), band: null, letters: rpick(rng, ['paint_red', 'trim_dark', 'paint_blue', 'paint_green', 'wood_dark']), maxPx: 0.12 * M, bandGap: 0.1 * M, bandH: 0.6 * M });
  if (g.detail >= 2) display(g, fF, shopU, shopW * 0.7, o.display || rpick(rng, ['fruit', 'flowers', 'rack']));
  comGround(g, PW, PD, front + 0.2 * M);
  if (g.detail >= 1) {
    bench(g, w / 2 - 0.2 * M, PD / 2 - 0.6 * M, 0);
    const yd = z - d / 2 + PD / 2;
    if (yd > 1.2 * M) { ground(g, 'grass', 0, -PD / 2 + yd / 2, PW - 0.1 * M, yd - 0.1 * M, 0.04 * M); tree(g, PW * 0.25, -PD / 2 + yd * 0.5, 0.8); bins(g, -PW / 2 + 1.2 * M, -PD / 2 + 0.6 * M, 3); }
  }
}

// Imbiss / Pizzeria: Flachbau mit großem Schriftzug, Verkaufsfenster, Stehtische
function imbiss(ctx, g, P) {
  const { rng } = ctx;
  const { W: PW, D: PD } = P;
  const w = Math.min(PW - 1.2 * M, 7.6 * M), d = 6.2 * M, h = 3.4 * M;
  const cz = PD / 2 - 3.0 * M - d / 2;
  const wallM = rpick(rng, ['plaster_yellow', 'plaster_red', 'brick_red', 'plaster_white', 'metal_panel_white', 'plaster_ochre']);
  const m = { cx: 0, cz, sx: w, sz: d, y0: 0, y1: h, wall: wallM };
  const shopA = { kind: 'shop', u: -w * 0.18, y: 0.15 * M, w: w * 0.5, h: 2.6 * M, frame: 'metal_dark', door: 0, cols: 2 };
  const counter = { kind: 'shop', u: w * 0.3, y: 1.0 * M, w: w * 0.28, h: 1.3 * M, frame: 'metal_dark', cols: 1, riser: 0.02 * M };
  massWalls(g, m, { front: [shopA, counter], back: [{ kind: 'door', u: 0, y: 0.15 * M, w: 1.0 * M, h: 2.1 * M, mat: 'metal_panel_grey' }], left: [winT({ u: 0, y: 1.0 * M, w: 2.0 * M, h: 1.4 * M, frame: 'metal_dark', panes: { cols: 2 } })], right: [] });
  flatRoof(g, m, h, { mat: 'roof_flat_membrane', wall: wallM, parapet: 1.1 * M, coping: 'metal_light' });
  const fF = mframe(0, cz, w, d, 'front');
  const nm = name(rng, 'snack');
  signBand(g, fF, nm, 0, h + 0.05 * M, w - 0.6 * M, 0.95 * M, { band: null, mat: g.neon(rpick(rng, ['neon_yellow', 'neon_pink', 'emissive_red', 'neon_cyan'])), depth: 0.08 * M, maxPx: 0.18 * M });
  awning(g, fF, counter.u, counter.y + counter.h + 0.3 * M, counter.w + 0.4 * M, 1.0 * M, rpick(rng, AWNINGS), 'fixed');
  if (g.detail >= 1) {
    g.wbox('metal_light', fF, counter.u, counter.y - 0.05 * M, 0.25 * M, counter.w + 0.2 * M, 0.06 * M, 0.5 * M);
    // Stehtische
    for (let k = 0; k < 3; k++) {
      const x = -w * 0.35 + k * 1.6 * M, z = PD / 2 - 1.6 * M;
      g.cyl('metal_dark', x, 0, z, 0.04 * M, 1.05 * M, { seg: 4, cap: false });
      g.cyl('paint_white', x, 1.05 * M, z, 0.35 * M, 0.04 * M, { seg: 8 });
    }
    logoDisc(g, fF, -w * 0.38, 3.0 * M, 0.02 * M, 0.3 * M, 'emissive_red');
  }
  comGround(g, PW, PD, 3.0 * M);
  if (g.detail >= 1) {
    bins(g, PW / 2 - 0.9 * M, PD / 2 - 0.6 * M, 1);
    const yd = cz - d / 2 + PD / 2;
    if (yd > 5 * M) parkingRow(g, 0, -PD / 2 + 2.6 * M, Math.floor((PW - 1 * M) / (2.5 * M)), 1, 0.6);
  }
}

// Blumenladen mit Auslagen
function blumen(ctx, g, P) {
  ladenhaus(ctx, g, P, { kind: 'flowers', display: 'flowers', floors: 1, roof: 'gableF', w: 7.6 * M });
  if (g.detail >= 1) {
    const { W: PW, D: PD } = P;
    for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) g.box(['paint_red', 'paint_yellow', 'plaster_pink', 'leaves_light', 'paint_white', 'paint_orange'][(k + j * 3) % 6], -PW * 0.25 + k * 1.0 * M, 0, PD / 2 - 1.0 * M - j * 0.7 * M, 0.6 * M, 0.5 * M + (k % 2) * 0.2 * M, 0.5 * M, { skip: NB });
  }
}

// Gläserner Pavillon (Friseur, Optiker, Boutique)
function pavillon(ctx, g, P) {
  const { rng } = ctx;
  const { W: PW, D: PD } = P;
  const w = Math.min(PW - 1.0 * M, 8.4 * M), d = 6.0 * M, h = 3.6 * M;
  const cz = PD / 2 - 3.0 * M - d / 2;
  const m = { cx: 0, cz, sx: w, sz: d, y0: 0.1 * M, y1: h };
  glassBox(g, m, { glass: 'glass_shop', frame: 'metal_dark', fh: h, colW: 1.6 * M, skip: ['back'] });
  const fB = mframe(0, cz, w, d, 'back');
  g.wquad('wood_planks', fB, 0, 0, 0, w, h);
  // auskragendes Flachdach
  g.box('trim_dark', 0, h, cz + 0.4 * M, w + 1.6 * M, 0.35 * M, d + 1.6 * M);
  g.box('roof_flat_gravel', 0, h + 0.35 * M, cz + 0.4 * M, w + 1.5 * M, 0.02 * M, d + 1.5 * M);
  g.box('concrete', 0, 0, cz, w + 0.2 * M, 0.1 * M, d + 0.2 * M, { skip: NB });
  const f = { ox: 0, oz: cz + d / 2 + 1.2 * M, ry: 0, c: 1, s: 0, len: w + 1.6 * M };
  signBand(g, f, name(rng, chance(rng, 0.5) ? 'hair' : 'shop'), 0, h + 0.02 * M, w, 0.32 * M, { band: null, mat: 'sign_white', depth: 0.02 * M, maxPx: 0.07 * M });
  comGround(g, PW, PD, 3.0 * M, { rest: 'grass' });
  if (g.detail >= 1) {
    for (const sx of [-1, 1]) planter(g, sx * (w / 2 + 0.2 * M), PD / 2 - 0.8 * M, 'metal_dark');
    tree(g, -PW * 0.3, -PD / 2 + 1.8 * M, 0.9);
    tree(g, PW * 0.3, -PD / 2 + 1.5 * M, 0.8);
  }
}

// Ladenzeile: mehrere kleine Läden nebeneinander mit eigenen Schildern und Markisen
function ladenzeile(ctx, g, P, o = {}) {
  const { rng } = ctx;
  const { W: PW, D: PD } = P;
  const floors = o.floors ?? 1;
  const n = o.n ?? Math.max(2, Math.round((PW - 0.6 * M) / (6.0 * M)));
  const w = PW - 0.6 * M, d = Math.min(PD - 4.0 * M, o.d ?? 9 * M);
  const front = o.front ?? 3.0 * M;
  const cz = PD / 2 - front - d / 2;
  const gfH = 4.2 * M, FH = 3.0 * M;
  const top = gfH + (floors - 1) * FH;
  const wallM = rpick(rng, ['plaster_white', 'brick_red', 'plaster_cream', 'brick_yellow', 'concrete_panel', 'plaster_grey']);
  const m = { cx: 0, cz, sx: w, sz: d, y0: 0, y1: top, wall: wallM };
  const uw = w / n;
  const ops = [], shops = [];
  const kinds = ['baker', 'shop', 'hair', 'flowers', 'pharmacy', 'snack', 'shop', 'cafe'];
  for (let k = 0; k < n; k++) {
    const u = -w / 2 + uw * (k + 0.5);
    const sh = { kind: 'shop', u, y: 0.15 * M, w: uw - 1.0 * M, h: 2.9 * M, frame: rpick(rng, ['metal_dark', 'window_frame_dark', 'wood_dark']), door: k % 2 ? 0 : Math.max(0, Math.round((uw - 1 * M) / (1.6 * M)) - 1), cols: Math.max(2, Math.round((uw - 1.0 * M) / (1.6 * M))) };
    ops.push(sh); shops.push(sh);
  }
  for (let f = 1; f < floors; f++) for (const u of bays(w, Math.round(w / (2.7 * M)), 0.5 * M)) ops.push(winT({ u, y: gfH + (f - 1) * FH + 0.85 * M, w: 1.4 * M, h: 1.45 * M, frame: 'window_frame_white', panes: { cols: 2 }, sill: 'metal_light' }));
  massWalls(g, m, { front: ops, back: rows(stack(0.15 * M, gfH, FH, floors), bays(w, n, 1 * M), (f) => f === 0 ? { kind: 'door', w: 1.0 * M, h: 2.1 * M, y: 0, mat: 'metal_panel_grey' } : winT({ w: 1.2 * M, h: 1.3 * M, y: 0.9 * M, frame: 'window_frame_white', panes: { cols: 2 } })), left: [], right: [] });
  const fF = mframe(0, cz, w, d, 'front');
  shops.forEach((sh, k) => {
    const kind = o.kinds ? o.kinds[k % o.kinds.length] : kinds[(k + Math.floor(rng() * 8)) % kinds.length];
    shopDecor(g, fF, sh, { name: name(rng, kind), awning: chance(rng, 0.7) ? rpick(rng, AWNINGS) : null, awningType: rpick(rng, ['fixed', 'roll', 'fixed']), band: rpick(rng, ['trim_dark', 'paint_white', 'wood_dark', 'paint_blue', 'paint_red', 'metal_panel_grey']), letters: g.neon(rpick(rng, NEON)), blade: kind === 'pharmacy' ? 'A' : null, bladeMat: 'emissive_red', fill: 0.7 });
    if (k < n - 1 && g.detail >= 1) g.wbox(wallM, fF, sh.u + uw / 2, 0, 0.12 * M, 0.5 * M, top - 0.2 * M, 0.24 * M, { skip: F.BACK });
  });
  cornice(g, 'trim_stone', m, top - 0.3 * M, 0.8, { sides: ['front'] });
  flatRoof(g, m, top, { mat: 'roof_flat_gravel', wall: wallM, parapet: 0.7 * M });
  rooftop(g, 0, top, cz, w, d, { n: 2 + n });
  comGround(g, PW, PD, front + 0.2 * M);
  if (g.detail >= 1) {
    for (let k = 0; k < n; k++) if (k % 2 === 0) bench(g, -w / 2 + uw * (k + 1), PD / 2 - front * 0.4, 0);
    bikeRack(g, w / 2 - 1.5 * M, PD / 2 - front * 0.5, 4);
    const yd = cz - d / 2 + PD / 2;
    if (yd > 5 * M) parkingRow(g, 0, -PD / 2 + 2.6 * M, Math.floor((PW - 1 * M) / (2.5 * M)), 1, 0.6);
    else bins(g, -w / 2 + 1.5 * M, -PD / 2 + 0.6 * M, 4);
    lamp(g, -PW / 2 + 0.5 * M, PD / 2 - 0.5 * M);
  }
}

// Tankstelle mit Dach, Shop und Preispylon
function tankstelle(ctx, g, P) {
  const { rng } = ctx;
  const { W: PW, D: PD } = P;
  const band = rpick(rng, ['paint_red', 'paint_blue', 'paint_green', 'paint_yellow', 'paint_orange']);
  ground(g, 'asphalt', 0, 0, PW - 0.04 * M, PD - 0.04 * M, 0.03 * M);
  const cw = Math.min(PW - 2.0 * M, 14 * M), cd = 7.5 * M;
  const ccz = PD / 2 - 2.5 * M - cd / 2;
  fuelCanopy(g, PW > 1.5 ? -PW * 0.12 : 0, ccz, cw, cd, 4.8 * M, { band, name: name(rng, 'fuel') });
  // Shop
  const sw = Math.min(PW * 0.45, 9 * M), sd = 6.5 * M;
  const sx = PW > 1.5 ? PW / 2 - sw / 2 - 0.6 * M : 0, sz = PD > 1.5 ? -PD / 2 + sd / 2 + 2.0 * M : ccz - cd / 2 - sd / 2 - 1.2 * M;
  if (sz - sd / 2 > -PD / 2) {
    const m = { cx: sx, cz: sz, sx: sw, sz: sd, y0: 0, y1: 3.6 * M, wall: 'metal_panel_white' };
    const sh = { kind: 'shop', u: 0, y: 0.1 * M, w: sw - 1.6 * M, h: 2.8 * M, frame: 'metal_dark', door: 1, cols: 4 };
    massWalls(g, m, { front: [sh], back: [], left: [], right: [] });
    flatRoof(g, m, 3.6 * M, { mat: 'roof_flat_membrane', wall: band, parapet: 0.7 * M, coping: 'metal_light' });
    const fF = mframe(sx, sz, sw, sd, 'front');
    shopDecor(g, fF, sh, { name: 'SHOP', band: null, letters: 'sign_white', lights: true });
  }
  // Preispylon
  const pyX = -PW / 2 + 1.2 * M, pyZ = PD / 2 - 1.2 * M;
  pylon(g, pyX, pyZ, 6.5 * M, rpick(rng, ['SUPER', 'DIESEL', 'TANK']), { panel: band, text: 'sign_white', w: 1.8 * M });
  if (g.detail >= 1) {
    const f = { ox: pyX, oz: pyZ + 0.21 * M, ry: 0, c: 1, s: 0, len: 1.6 * M };
    for (let k = 0; k < 3; k++) text(g, f, ['1.79', '1.69', '1.85'][k].replace('.', ''), 0, 1.2 * M + k * 0.9 * M, 0.02 * M, 0.11 * M, 'emissive_green', { depth: 0.01 * M });
    // Fahrzeuge an den Säulen
    for (let k = 0; k < 2; k++) if (chance(rng, 0.7)) car(g, (PW > 1.5 ? -PW * 0.12 : 0) - cw * 0.25 + k * cw * 0.5, ccz + cd * 0.38 * (k ? -1 : 1), 0, rpick(rng, CAR_COLORS));
    // Luft/Wasser, Waschstraße (2×2)
    g.box('metal_panel_grey', PW / 2 - 1.0 * M, 0, PD / 2 - 2.0 * M, 0.6 * M, 1.4 * M, 0.4 * M, { skip: NB });
  }
  if (PW > 1.5 && PD > 1.5) {
    // Waschanlage
    const wm = { cx: -PW / 2 + 4.0 * M, cz: -PD / 2 + 5.0 * M, sx: 5.0 * M, sz: 8.0 * M, y0: 0, y1: 4.0 * M, wall: 'metal_panel_white' };
    massWalls(g, wm, { front: [{ kind: 'garage', u: 0, y: 0.05 * M, w: 3.4 * M, h: 3.4 * M, mat: 'glass_shop', frame: 'metal_dark' }], back: [], left: [], right: [] });
    flatRoof(g, wm, 4.0 * M, { mat: 'roof_flat_membrane', wall: band, parapet: 0.5 * M });
    signBand(g, mframe(wm.cx, wm.cz, wm.sx, wm.sz, 'front'), 'WASCHEN', 0, 3.5 * M, 4.4 * M, 0.45 * M, { band: null, mat: 'sign_white', depth: 0.02 * M });
  }
}

// Gasthaus mit Biergarten
function gasthaus(ctx, g, P) {
  const { rng } = ctx;
  const { W: PW, D: PD } = P;
  const front = 1.8 * M;
  const w = Math.min(PW * 0.55, 11 * M), d = Math.min(PD - front - 1.0 * M, 9 * M);
  const x = -PW / 2 + 0.6 * M + w / 2, z = PD / 2 - front - d / 2;
  const fachwerk = chance(rng, 0.5);
  const wallM = fachwerk ? 'plaster_white' : rpick(rng, ['plaster_ochre', 'plaster_cream', 'plaster_yellow', 'plaster_pink']);
  const r = house(g, {
    x, z, w, d, floors: 2, fh: 3.0 * M, knee: 0.4 * M, plinth: 0.5 * M, wall: wallM, timber: fachwerk ? 'wood_dark' : null,
    roof: { type: chance(rng, 0.5) ? 'gable' : 'halfhip', k: 0.35, pitch: rr(rng, 45, 52), mat: rpick(rng, ['roof_tiles_red', 'roof_tiles_brown']) },
    win: { ...winStyle(fachwerk ? 'cottage' : 'casement', { frame: 'window_frame_white' }), shutters: fachwerk ? null : rpick(rng, ['paint_green', 'wood_dark']), flowers: ['paint_red', 'leaves_green'] },
    door: { at: 'center', mat: 'wood_dark', double: true, transom: true, canopy: 'wood_dark' }, bays: { front: 4 }, chimney: {}, dormers: { n: 2, type: 'gable' },
  });
  const fF = mframe(x, z, w, d, 'front');
  signBand(g, fF, name(rng, 'inn'), 0, r.floorY(1) - 0.35 * M, w * 0.6, 0.5 * M, { band: null, mat: rpick(rng, ['wood_dark', 'trim_dark', 'paint_red']), depth: 0.04 * M, maxPx: 0.1 * M, light: true });
  bladeSign(g, fF, w / 2 - 0.2 * M, r.floorY(1) + 0.4 * M, { glyph: 'BIER', glyphMat: 'paint_yellow', panel: 'wood_dark', w: 1.0 * M, h: 0.7 * M });
  // Biergarten unter Bäumen
  const bx0 = x + w / 2 + 0.6 * M, bx1 = PW / 2 - 0.4 * M;
  ground(g, 'gravel', 0, 0, PW - 0.04 * M, PD - 0.04 * M, 0.03 * M);
  ground(g, 'sidewalk', 0, PD / 2 - front / 2, PW - 0.04 * M, front, 0.05 * M);
  if (bx1 - bx0 > 3 * M && g.detail >= 1) {
    const cols = Math.max(1, Math.floor((bx1 - bx0) / (3.2 * M))), rws = Math.max(1, Math.floor((PD - front - 2 * M) / (3.2 * M)));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rws; j++) {
      const tx = bx0 + (bx1 - bx0) * (i + 0.5) / cols, tz = PD / 2 - front - 1.6 * M - j * 3.2 * M;
      g.box('wood_planks', tx, 0.72 * M, tz, 2.0 * M, 0.06 * M, 0.7 * M);
      if (g.detail >= 2) { for (const s of [-1, 1]) g.box('wood_planks', tx, 0.42 * M, tz + s * 0.65 * M, 2.0 * M, 0.05 * M, 0.3 * M); g.box('wood_dark', tx, 0, tz, 1.8 * M, 0.72 * M, 0.08 * M, { skip: NB }); }
      if ((i + j) % 2 === 0) tree(g, tx + 1.4 * M, tz + 1.2 * M, 1.25, { leaf: 'leaves_dark', trunk: 2.6 });
    }
    fence(g, bx0 - 0.3 * M, PD / 2 - front, bx1, PD / 2 - front, 'picket', { mat: 'wood_planks', h: 0.9 * M });
    for (let k = 0; k < 4; k++) g.kit.light(bx0 + (bx1 - bx0) * (k + 0.5) / 4, 2.5 * M, PD / 2 - front - 3 * M, 0xffd79a, 0.4);
  }
}

// Supermarkt mit Parkplatz (Discounter)
function supermarkt(ctx, g, P) {
  const { rng } = ctx;
  const { W: PW, D: PD } = P;
  const band = rpick(rng, ['paint_red', 'paint_blue', 'paint_yellow', 'paint_green', 'paint_orange']);
  ground(g, 'asphalt', 0, 0, PW - 0.04 * M, PD - 0.04 * M, 0.03 * M);
  const big = PW > 1.5 && PD > 1.5;
  const w = Math.min(PW - 1.0 * M, big ? 17 * M : 14 * M), d = big ? Math.min(PD * 0.5, 11 * M) : Math.min(PD - 6 * M, 9 * M);
  const cz = -PD / 2 + 0.5 * M + d / 2;
  const h = 5.2 * M;
  const wallM = rpick(rng, ['metal_panel_white', 'brick_red', 'concrete_panel', 'metal_panel_grey']);
  const m = { cx: 0, cz, sx: w, sz: d, y0: 0, y1: h, wall: wallM };
  const entr = { kind: 'shop', u: -w / 2 + 3.5 * M, y: 0.1 * M, w: 5.5 * M, h: 3.2 * M, frame: 'metal_dark', door: 1, cols: 3, transom: 0 };
  const b2a = entr.u + entr.w / 2 + 0.8 * M, b2b = w / 2 - 0.8 * M;
  const band2 = { kind: 'shop', u: (b2a + b2b) / 2, y: 0.1 * M, w: Math.max(0.5 * M, b2b - b2a), h: 2.2 * M, frame: 'metal_dark', cols: Math.max(2, Math.round((b2b - b2a) / (1.8 * M))) };
  massWalls(g, m, { front: [entr, band2], back: [{ kind: 'garage', u: w * 0.3, y: 0.05 * M, w: 3.2 * M, h: 3.4 * M, mat: 'metal_corrugated' }], left: [], right: [] });
  // Pultdach mit großem Vordach
  flatRoof(g, m, h, { mat: 'roof_flat_membrane', wall: wallM, parapet: 0.4 * M });
  const fF = mframe(0, cz, w, d, 'front');
  g.wbox(band, fF, 0, h - 1.2 * M, 0.25 * M, w + 0.2 * M, 1.6 * M, 0.5 * M);
  g.wbox('trim_dark', fF, entr.u, 3.6 * M, 1.4 * M, 6.5 * M, 0.25 * M, 2.8 * M);
  if (g.detail >= 1) for (const s of [-1, 1]) g.wbox('metal_dark', fF, entr.u + s * 3.1 * M, 0, 2.6 * M, 0.15 * M, 3.6 * M, 0.15 * M, { skip: F.TOP | F.BOTTOM });
  const nm = name(rng, 'market');
  signBand(g, { ...fF, oz: fF.oz + 0.5 * M * fF.c }, nm, 0, h - 1.1 * M, w * 0.6, 1.3 * M, { band: null, mat: 'sign_white', depth: 0.06 * M, maxPx: 0.3 * M });
  logoDisc(g, { ...fF, oz: fF.oz + 0.52 * M }, -w * 0.38, h - 0.4 * M, 0.02 * M, 0.55 * M, 'sign_white');
  // Parkplatz
  const pz0 = cz + d / 2 + 1.0 * M;
  const rowsN = Math.max(1, Math.floor((PD / 2 - pz0 - 0.5 * M) / (5.5 * M)));
  for (let r = 0; r < Math.min(3, rowsN); r++) parkingRow(g, 0, pz0 + 2.6 * M + r * 6.0 * M, Math.floor((PW - 2 * M) / (2.5 * M)), r % 2 ? -1 : 1, 0.55);
  cartShelter(g, w / 2 - 2.0 * M, pz0 + 0.8 * M);
  pylon(g, PW / 2 - 1.2 * M, PD / 2 - 1.0 * M, 7.0 * M, nm.length > 6 ? 'MARKT' : nm, { panel: band, text: 'sign_white', w: 2.0 * M });
  if (g.detail >= 1) {
    for (const sx of [-1, 1]) lamp(g, sx * PW * 0.25, PD / 2 - 3.5 * M, 6.0 * M);
    hedge(g, 0, PD / 2 - 0.35 * M, PW * 0.6, 0.5 * M, 0.8 * M);
    for (const sx of [-1, 1]) tree(g, sx * (PW / 2 - 1.0 * M), pz0 + 1.0 * M, 0.9);
  }
}

// Gärtnerei / Gartencenter mit Gewächshäusern
function gaertnerei(ctx, g, P) {
  const { rng } = ctx;
  const { W: PW, D: PD } = P;
  ground(g, 'gravel', 0, 0, PW - 0.04 * M, PD - 0.04 * M, 0.03 * M);
  const sw = Math.min(PW - 2 * M, 9 * M), sd = 6 * M;
  const sz = PD / 2 - 3.0 * M - sd / 2;
  const m = { cx: -PW / 2 + 0.8 * M + sw / 2, cz: sz, sx: sw, sz: sd, y0: 0, y1: 3.6 * M, wall: 'wood_planks' };
  const sh = { kind: 'shop', u: 0, y: 0.1 * M, w: sw - 2.0 * M, h: 2.8 * M, frame: 'window_frame_dark', door: 0, cols: 3 };
  massWalls(g, m, { front: [sh] });
  rectRoof(g, { cx: m.cx, cz: sz, sx: sw, sz: sd, y0: 3.6 * M, pitch: 25, ridge: 'x', mat: 'roof_metal_grey', under: 'wood_planks', edge: 'wood_dark', wall: 'wood_planks' });
  shopDecor(g, mframe(m.cx, sz, sw, sd, 'front'), sh, { name: name(rng, 'garden'), awning: 'awning_green', band: 'paint_green', letters: 'sign_white' });
  const gw = Math.min(PW - 1.5 * M, 12 * M), gd = 6.0 * M;
  const nG = Math.max(1, Math.floor((sz - sd / 2 + PD / 2 - 1 * M) / (gd + 1.5 * M)));
  for (let k = 0; k < Math.min(2, nG); k++) greenhouse(g, 0, sz - sd / 2 - 1.2 * M - gd / 2 - k * (gd + 1.5 * M), gw, gd, 2.8 * M);
  if (g.detail >= 1) {
    const x0 = m.cx + sw / 2 + 1.0 * M;
    for (let k = 0; k < 4; k++) display(g, { ox: x0 + k * 1.2 * M, oz: PD / 2 - 2.6 * M, ry: 0, c: 1, s: 0, len: 1 }, 0, 1.0 * M, 'flowers');
    for (let k = 0; k < 3; k++) bush(g, PW / 2 - 1.0 * M, PD / 2 - 1.5 * M - k * 1.2 * M, 1.0, 'leaves_green');
  }
  ground(g, 'sidewalk', 0, PD / 2 - 1.2 * M, PW - 0.04 * M, 2.4 * M, 0.05 * M);
}

// Werkstatt / Autohaus
function werkstatt(ctx, g, P, o = {}) {
  const { rng } = ctx;
  const { W: PW, D: PD } = P;
  ground(g, 'asphalt', 0, 0, PW - 0.04 * M, PD - 0.04 * M, 0.03 * M);
  const show = o.show ?? chance(rng, 0.5);
  const w = Math.min(PW - 1.0 * M, 14 * M), d = Math.min(PD - 5 * M, 9 * M);
  const cz = -PD / 2 + 0.5 * M + d / 2;
  const h = 5.0 * M;
  const wallM = show ? 'metal_panel_white' : rpick(rng, ['metal_corrugated', 'brick_red', 'metal_panel_grey']);
  const m = { cx: 0, cz, sx: w, sz: d, y0: 0, y1: h, wall: wallM };
  const ops = show ? [{ kind: 'shop', u: -w * 0.15, y: 0.1 * M, w: w * 0.6, h: 4.0 * M, frame: 'metal_dark', door: 1, cols: 5 }, { kind: 'garage', u: w * 0.35, y: 0.05 * M, w: 3.2 * M, h: 3.6 * M, mat: 'metal_panel_white' }]
    : bays(w, 3, 0.8 * M).map((u, i) => i < 2 ? { kind: 'garage', u, y: 0.05 * M, w: 3.4 * M, h: 3.8 * M, mat: 'metal_panel_grey' } : { kind: 'door', u, y: 0.05 * M, w: 1.1 * M, h: 2.2 * M, mat: 'trim_dark', glazed: true });
  massWalls(g, m, { front: ops });
  flatRoof(g, m, h, { mat: 'roof_flat_membrane', wall: wallM, parapet: 0.6 * M });
  const fF = mframe(0, cz, w, d, 'front');
  signBand(g, fF, name(rng, 'garage'), 0, h - 0.95 * M, w * 0.7, 0.8 * M, { band: rpick(rng, ['paint_blue', 'paint_red', 'trim_dark']), mat: 'sign_white', depth: 0.04 * M });
  const nCars = Math.max(2, Math.floor((PW - 2 * M) / (2.8 * M)));
  for (let k = 0; k < nCars; k++) if (chance(rng, show ? 0.95 : 0.6)) car(g, -PW / 2 + 1.6 * M + k * 2.8 * M, PD / 2 - 3.2 * M, Math.PI / 2, rpick(rng, CAR_COLORS), { van: !show && chance(rng, 0.3) });
  if (show) flags(g, PW / 2 - 1.0 * M, PD / 2 - 1.0 * M, 3, Math.PI / 2, ['paint_blue', 'paint_white', 'paint_red']);
}

// Drive-in-Schnellrestaurant
function driveIn(ctx, g, P) {
  const { rng } = ctx;
  const { W: PW, D: PD } = P;
  ground(g, 'asphalt', 0, 0, PW - 0.04 * M, PD - 0.04 * M, 0.03 * M);
  const w = Math.min(PW * 0.5, 11 * M), d = 9 * M, h = 4.6 * M;
  const cx = -PW / 2 + 1.5 * M + w / 2, cz = 0;
  const wallM = rpick(rng, ['brick_red', 'plaster_white', 'metal_panel_grey', 'wood_dark']);
  const m = { cx, cz, sx: w, sz: d, y0: 0, y1: h, wall: wallM };
  const sh = { kind: 'shop', u: 0, y: 0.1 * M, w: w - 2 * M, h: 3.0 * M, frame: 'metal_dark', door: 0, cols: 4 };
  massWalls(g, m, { front: [sh], right: [{ kind: 'shop', u: -1.0 * M, y: 0.9 * M, w: 1.6 * M, h: 1.4 * M, frame: 'metal_dark', cols: 1 }] });
  flatRoof(g, m, h, { mat: 'roof_flat_membrane', wall: wallM, parapet: 1.0 * M });
  const band = rpick(rng, ['paint_red', 'paint_yellow', 'paint_orange']);
  const fF = mframe(cx, cz, w, d, 'front');
  g.wbox(band, fF, 0, h - 0.4 * M, 0.2 * M, w + 0.3 * M, 1.1 * M, 0.4 * M);
  signBand(g, { ...fF, oz: fF.oz + 0.42 * M }, name(rng, 'fast'), 0, h - 0.3 * M, w * 0.8, 0.9 * M, { band: null, mat: 'sign_white', depth: 0.05 * M });
  // Fahrspur und Pylon
  if (g.detail >= 1) {
    for (let k = 0; k < 6; k++) g.hquad('paint_white', cx + w / 2 + 1.6 * M, 0.04 * M, PD / 2 - 2 * M - k * 1.4 * M, 0.12 * M, 0.7 * M);
    cafeSeating(g, cx, PD / 2 - 2.2 * M, w * 0.8, 3, { umbrella: band });
    parkingRow(g, cx, -PD / 2 + 2.6 * M, Math.floor(w / (2.5 * M)), 1, 0.6);
  }
  pylon(g, PW / 2 - 1.0 * M, PD / 2 - 1.0 * M, 8.0 * M, 'DRIVE', { panel: band, text: 'sign_white', w: 2.0 * M });
}

// ---------- Stufe 2–3: Wohn- und Geschäftshäuser
function wohnGeschaeft(ctx, g, P, o = {}) {
  const { rng } = ctx;
  const { W: PW, D: PD } = P;
  const n = o.floors ?? 3;
  const front = o.front ?? 2.6 * M;
  const w = PW - 0.3 * M, d = Math.min(PD - front - 1.5 * M, o.d ?? 10 * M);
  const cz = PD / 2 - front - d / 2;
  const old = o.old ?? chance(rng, 0.5);
  const wallM = o.wall || (old ? rpick(rng, ['plaster_cream', 'plaster_ochre', 'plaster_pink', 'plaster_blue', 'brick_red', 'plaster_yellow']) : rpick(rng, ['plaster_white', 'plaster_grey', 'brick_dark', 'brick_red', 'concrete_panel', 'metal_panel_grey']));
  const st = stack(0.15 * M, 4.2 * M, 3.1 * M, n);
  const m = { cx: 0, cz, sx: w, sz: d, y0: 0, y1: st.top, wall: wallM };
  const nS = Math.max(1, Math.round(w / (6 * M)));
  const sUs = bays(w, nS, 0.3 * M);
  const shops = sUs.map((u, i) => ({ kind: 'shop', u: u + (i === nS - 1 ? -0.7 * M : 0), y: 0.15 * M, w: (w - 0.6 * M) / nS - (i === nS - 1 ? 2.4 * M : 1.0 * M), h: 3.2 * M, frame: old ? 'wood_dark' : 'metal_dark', door: 0, cols: 3, transom: old ? 0.6 * M : 0 }));
  const doorU = w / 2 - 1.2 * M;
  const ops = [...shops, { ...entranceOp({ canopy: null, mat: old ? 'wood_dark' : 'trim_dark', glazed: !old, w: 1.2 * M, h: 2.6 * M, double: false }), u: doorU, y: 0.15 * M }];
  const us = bays(w, Math.max(2, Math.round(w / (2.8 * M))), 0.4 * M);
  ops.push(...rows(st, us, (f) => f === 0 ? null : winT({ w: old ? 1.2 * M : 1.6 * M, h: old ? 1.8 * M : 1.6 * M, y: old ? 0.75 * M : 0.8 * M, frame: old ? 'window_frame_white' : 'window_frame_dark', panes: { cols: 2, transom: old ? 0.25 : 0 }, sill: old ? 'trim_stone' : 'metal_light', surround: old ? 'trim_stone' : null, french: !old && chance(rng, 0.3) ? 'metal_dark' : null }), 1));
  const backOps = rows(st, bays(w, Math.max(2, Math.round(w / (3 * M))), 0.6 * M), (f) => f === 0 ? { kind: 'door', w: 1.0 * M, h: 2.1 * M, y: 0, mat: 'metal_panel_grey' } : winT({ w: 1.2 * M, h: 1.4 * M, y: 0.85 * M, frame: 'window_frame_white', panes: { cols: 2 } }));
  const fwk = [firewallKind(rng), firewallKind(rng)];
  massWalls(g, m, { front: ops, back: backOps, left: firewallOps(st, d, rng, fwk[0]), right: firewallOps(st, d, rng, fwk[1]) });
  firewallDecor(g, mframe(0, cz, w, d, 'left'), st.y[1], st.top, rng, fwk[0]);
  firewallDecor(g, mframe(0, cz, w, d, 'right'), st.y[1], st.top, rng, fwk[1]);
  const fF = mframe(0, cz, w, d, 'front');
  const kinds = o.kinds || ['shop', 'baker', 'pharmacy', 'cafe', 'hair', 'bank', 'shop', 'rest'];
  shops.forEach((sh) => {
    const kind = rpick(rng, kinds);
    shopDecor(g, fF, sh, { name: name(rng, kind), awning: chance(rng, old ? 0.7 : 0.4) ? rpick(rng, AWNINGS) : null, band: old ? null : rpick(rng, ['trim_dark', 'metal_panel_grey', 'paint_white']), letters: old ? rpick(rng, ['trim_dark', 'paint_red', 'wood_dark', 'paint_blue']) : g.neon(rpick(rng, NEON)), blade: kind === 'pharmacy' ? 'A' : kind === 'baker' ? 'B' : null, bladeMat: kind === 'pharmacy' ? 'emissive_red' : 'paint_yellow', maxPx: old ? 0.13 * M : 0.16 * M, bandGap: 0.1 * M, bandH: 0.65 * M });
  });
  band(g, old ? 'trim_stone' : 'concrete', m, st.y[1] - 0.12 * M, 0.25 * M, old ? 0.12 * M : 0.2 * M, { sides: ['front'] });
  if (old) {
    cornice(g, 'trim_stone', m, st.top - 0.35 * M, 1.0, { sides: ['front', 'back'] });
    const info = rectRoof(g, { cx: 0, cz, sx: w, sz: d, y0: st.top, pitch: rr(rng, 38, 46), ridge: 'x', mat: rpick(rng, PAL.roofTiles), under: 'trim_stone', edge: 'trim_stone', wall: wallM, eave: 0.25 * M, verge: 0.001 * M });
    if (g.detail >= 1) for (const X of bays(w, Math.max(1, Math.round(w / (4 * M))), 1 * M)) dormer(g, info, 1, X, { type: rpick(rng, ['gable', 'flat']), w: 1.6 * M, wall: 'plaster_white' });
    chimney(g, info, w / 2 - 0.5 * M, -0.3 * M, { w: 0.8 * M });
  } else {
    flatRoof(g, m, st.top, { mat: chance(rng, 0.4) ? 'green_roof' : 'roof_flat_gravel', wall: wallM, parapet: 0.6 * M, coping: 'metal_light' });
    rooftop(g, 0, st.top, cz, w, d, { n: 3 });
    if (g.detail >= 1) { const fB = mframe(0, cz, w, d, 'back'); for (let f = 1; f < n; f++) for (const u of bays(w, Math.max(1, Math.round(w / 6 * 0.1 / M)), 1.5 * M)) balcony(g, fB, u, st.y[f], 2.4 * M, 1.3 * M, { type: 'panel', rail: 'metal_light' }); }
  }
  comGround(g, PW, PD, front + 0.2 * M);
  if (g.detail >= 1) {
    for (const sh of shops) { if (chance(rng, 0.5)) cafeSeating(g, sh.u, PD / 2 - front * 0.45, sh.w * 0.8, 2, { umbrella: chance(rng, 0.5) ? 'canvas_white' : null }); else display(g, fF, sh.u, sh.w * 0.6, rpick(rng, ['fruit', 'flowers', 'rack'])); }
    lamp(g, PW / 2 - 0.4 * M, PD / 2 - 0.4 * M);
    bikeRack(g, -PW / 2 + 1.4 * M, PD / 2 - front * 0.5, 3, 0);
    bins(g, -w / 2 + 1.2 * M, -PD / 2 + 0.6 * M, 3);
  }
  return { st, m, cz, fF };
}

function apotheke(ctx, g, P) {
  g.neon('emissive_red');
  const r = wohnGeschaeft(ctx, g, P, { floors: 3, old: true, kinds: ['pharmacy'] });
  if (g.detail >= 1) {
    // großes rotes Apotheken-A an der Fassade
    const px = 0.14 * M;
    text(g, r.fF, 'A', P.W / 2 - 1.2 * M, r.st.y[1] + 0.5 * M, 0.06 * M, px * 2, 'emissive_red', { depth: 0.06 * M });
  }
}
function restaurant(ctx, g, P) {
  baeckerei(ctx, g, P, { kind: 'cafe', name: name(ctx.rng, 'rest'), floors: 2, roof: 'gable', terrace: 3.6 * M, awning: rpick(ctx.rng, ['awning_red', 'awning_green', 'canvas_white']) });
}
function eiscafe(ctx, g, P) {
  baeckerei(ctx, g, P, { kind: 'cafe', name: 'EISCAFÉ', floors: 2, roof: 'flat', awning: rpick(ctx.rng, ['awning_striped', 'awning_yellow', 'awning_blue']) });
}
// Bankfiliale: zweigeschossiger Glasbau mit Steinrahmen
function bank(ctx, g, P) {
  const { rng } = ctx;
  const { W: PW, D: PD } = P;
  const front = 3.0 * M;
  const w = Math.min(PW - 1.0 * M, 9.6 * M), d = Math.min(PD - front - 1.4 * M, 9 * M);
  const cz = PD / 2 - front - d / 2;
  const h = 7.6 * M;
  const stone = rpick(rng, ['stone_sandstone', 'stone_grey', 'concrete_panel', 'stone_dark']);
  const m = { cx: 0, cz, sx: w, sz: d, y0: 0, y1: h, wall: stone };
  massWalls(g, m, { back: [winT({ u: 0, y: 1.0 * M, w: 2 * M, h: 1.4 * M, frame: 'metal_dark', panes: { cols: 2 } })], left: [], right: [], front: [{ kind: 'shop', u: 0, y: 0.2 * M, w: w - 1.6 * M, h: h - 1.4 * M, frame: 'metal_dark', door: 1, cols: 4, transom: 0, depth: 0.5 * M, riser: 0.05 * M }] });
  flatRoof(g, m, h, { mat: 'roof_flat_gravel', wall: stone, parapet: 0.5 * M });
  const fF = mframe(0, cz, w, d, 'front');
  if (g.detail >= 1) for (let k = 1; k < 4; k++) g.wbox('metal_dark', fF, -w / 2 + 0.8 * M + (w - 1.6 * M) * k / 4, 0.2 * M, -0.2 * M, 0.25 * M, h - 1.4 * M, 0.3 * M, { skip: F.BACK });
  g.wbox(stone, fF, 0, 3.6 * M, -0.25 * M, w - 1.6 * M, 0.4 * M, 0.5 * M, { skip: F.BACK });
  signBand(g, fF, name(rng, 'bank'), 0, h - 1.1 * M, w * 0.6, 0.6 * M, { band: null, mat: 'sign_white', depth: 0.04 * M });
  comGround(g, PW, PD, front + 0.2 * M);
  if (g.detail >= 1) { for (const sx of [-1, 1]) planter(g, sx * (w / 2 - 0.5 * M), PD / 2 - 1.0 * M); g.wbox('metal_panel_grey', fF, w / 2 + 0.6 * M, 0, 0.3 * M, 0.9 * M, 1.8 * M, 0.5 * M, { skip: NB }); }
}

// ---------- Stufe 3–4
// Geschäftshaus: Läden im EG + 1. OG verglast, darüber Büros/Wohnungen
function geschaeftshaus(ctx, g, P, o = {}) {
  const { rng, level } = ctx;
  const { W: PW, D: PD } = P;
  const n = o.floors ?? (level >= 4 ? 6 + Math.floor(rng() * 2) : 4 + Math.floor(rng() * 2));
  const front = 3.0 * M;
  const w = PW - 0.3 * M, d = Math.min(PD - front - 1.2 * M, (PD > 1.5 ? 16 : 10.5) * M);
  const cz = PD / 2 - front - d / 2;
  const st = stack(0.15 * M, 4.4 * M, 3.4 * M, n);
  const wallM = o.wall || rpick(rng, ['stone_sandstone', 'concrete_panel', 'plaster_white', 'stone_grey', 'brick_dark', 'metal_panel_grey']);
  const m = { cx: 0, cz, sx: w, sz: d, y0: 0, y1: st.top, wall: wallM };
  const fF = mframe(0, cz, w, d, 'front');
  const nS = Math.max(1, Math.round(w / (5.5 * M)));
  const sUs = bays(w, nS, 0.3 * M);
  const shops = sUs.map((u) => ({ kind: 'shop', u, y: 0.15 * M, w: (w - 0.6 * M) / nS - 0.8 * M, h: 3.6 * M, frame: 'metal_dark', door: 0, cols: 3 }));
  // 1. OG: Bandfenster als Vorhangfassade (über Öffnung mit flacher Laibung)
  const cg = rpick(rng, ['glass_curtain_blue', 'glass_curtain_dark', 'glass_curtain_green']);
  const band1 = { kind: 'shop', u: 0, y: st.y[1] + 0.3 * M, w: w - 1.0 * M, h: st.fh - 0.6 * M, frame: 'metal_dark', cols: Math.round(w / (1.8 * M)), riser: 0.05 * M, depth: 0.25 * M, glass: cg };
  const upper = rows(st, bays(w, Math.max(2, Math.round(w / (2.4 * M))), 0.4 * M), (f) => f < 2 ? null : winT({ w: 1.7 * M, h: 1.9 * M, y: 0.7 * M, frame: 'metal_dark', panes: { cols: 2 }, sill: 'metal_light' }), 2);
  massWalls(g, m, { front: [...shops, band1, ...upper], back: rows(st, bays(w, Math.max(2, Math.round(w / (3 * M))), 0.5 * M), (f) => f === 0 ? null : winT({ w: 1.5 * M, h: 1.5 * M, y: 0.9 * M, frame: 'metal_dark', panes: { cols: 2 } })), left: o.corner ? rows(st, bays(d, 3, 0.8 * M), (f) => f === 0 ? null : winT({ w: 1.6 * M, h: 1.8 * M, y: 0.7 * M, frame: 'metal_dark', panes: { cols: 2 } })) : [], right: [] });
  shops.forEach((sh) => shopDecor(g, fF, sh, { name: name(rng, rpick(rng, ['shop', 'shop', 'cafe', 'bank', 'pharmacy'])), band: null, letters: g.neon(rpick(rng, NEON)), awning: chance(rng, 0.3) ? rpick(rng, AWNINGS) : null, maxPx: 0.15 * M, bandGap: 0.05 * M, bandH: 0.6 * M }));
  // Gliederung: Kragplatte über EG, Lisenen, Dachrand
  g.wbox('concrete', fF, 0, st.y[1] - 0.2 * M, 0.6 * M, w + 0.2 * M, 0.25 * M, 1.2 * M, { skip: F.BACK });
  pilasters(g, fF, wallM === 'stone_sandstone' ? 'stone_grey' : 'concrete', bays(w, Math.max(2, Math.round(w / (2.4 * M))), 0.4 * M).map((u, i, a) => i < a.length - 1 ? (u + a[i + 1]) / 2 : null).filter((x) => x !== null), st.y[2], st.top, 0.3 * M, 0.12 * M);
  band(g, 'concrete_dark', m, st.top - 0.4 * M, 0.4 * M, 0.1 * M);
  // Staffelgeschoss
  const sm = { cx: 0, cz: cz - 1.0 * M, sx: w - 3 * M, sz: d - 3 * M, y0: st.top, y1: st.top + 3.2 * M, wall: 'metal_panel_grey' };
  if (sm.sz > 3 * M) {
    glassBox(g, sm, { glass: cg, frame: 'metal_dark', fh: 3.2 * M, colW: 2.0 * M });
    flatRoof(g, sm, sm.y1, { mat: 'roof_flat_gravel', wall: 'metal_dark', parapet: 0.3 * M });
    rooftop(g, 0, sm.y1 + 0.3 * M, sm.cz, sm.sx, sm.sz, { n: 2 });
  }
  flatRoof(g, m, st.top, { mat: 'pavers', wall: wallM, parapet: 0.4 * M });
  if (g.detail >= 1) railing(g, mframe(0, cz, w, d, 'front'), 0, st.top + 0.4 * M, -0.1 * M, w - 0.4 * M, 0.7 * M, 'metal_light', 'bars');
  comGround(g, PW, PD, front + 0.2 * M);
  if (g.detail >= 1) { for (const sx of [-1, 1]) tree(g, sx * (w / 2 - 1.5 * M), PD / 2 - front * 0.4, 0.8); lamp(g, 0, PD / 2 - 0.4 * M); bikeRack(g, -w / 4, PD / 2 - front * 0.5, 4); }
  return { st, m, cz, fF, w, d };
}

// Gründerzeithaus mit Läden im Erdgeschoss
function gzLaeden(ctx, g, P) {
  const r = gruenderzeit(ctx, g, P, { shops: true, floors: ctx.level >= 4 ? 6 : 4 + (ctx.rng() < 0.5 ? 1 : 0) });
  // Ladenschilder über den Schaufenstern (Achsen aus der Fassade nachrechnen)
  const { rng } = ctx;
  const nb = Math.max(3, Math.round(r.bw / (3.0 * M)));
  const fF = mframe(0, r.cz, r.bw, r.bd, 'front');
  for (const u of bays(r.bw, nb, 0.3 * M)) {
    const sh = { u, y: 0.2 * M, w: Math.min(r.bw / nb - 0.5 * M, 2.6 * M), h: r.st.gf - 0.7 * M };
    shopDecor(g, fF, sh, { name: name(rng, rpick(rng, ['shop', 'baker', 'cafe', 'flowers', 'shop', 'pharmacy'])), band: null, letters: g.neon(rpick(rng, ['sign_white', 'paint_yellow', 'neon_yellow', 'paint_white'])), awning: chance(rng, 0.6) ? rpick(rng, AWNINGS) : null, awningType: rpick(rng, ['fixed', 'dome', 'roll']), maxPx: 0.09 * M, bandH: 0.45 * M, bandGap: 0.05 * M });
  }
}

// Hotel mit Vordach, Fahnen, Balkonen
function hotel(ctx, g, P, o = {}) {
  const { rng, level } = ctx;
  const { W: PW, D: PD } = P;
  const n = o.floors ?? (level >= 5 ? 14 : level >= 4 ? 8 + Math.floor(rng() * 2) : 5);
  const front = 3.6 * M;
  const w = PW - 0.6 * M, d = Math.min(PD - front - 1.5 * M, (PD > 1.5 ? 15 : 10.5) * M);
  const cz = PD / 2 - front - d / 2;
  const st = stack(0.3 * M, 4.6 * M, 3.1 * M, n);
  const wallM = o.wall || rpick(rng, ['plaster_white', 'stone_sandstone', 'plaster_cream', 'brick_dark', 'concrete_panel', 'metal_panel_white']);
  const accent = rpick(rng, ['trim_dark', 'stone_dark', 'metal_dark', 'wood_dark']);
  const m = { cx: 0, cz, sx: w, sz: d, y0: 0, y1: st.top, wall: wallM };
  const nb = Math.max(3, Math.round(w / (2.9 * M)));
  const us = bays(w, nb, 0.3 * M);
  const lobby = { kind: 'shop', u: 0, y: 0.3 * M, w: Math.min(w - 2 * M, 9 * M), h: 3.8 * M, frame: 'metal_dark', door: 1, cols: 5, transom: 0, glass: 'glass_shop' };
  const ops = [lobby, ...rows(st, us, (f) => f === 0 ? null : winT({ w: 1.4 * M, h: 2.2 * M, y: 0.1 * M, frame: 'window_frame_dark', panes: { cols: 2 }, sill: null, french: 'metal_dark' }), 1)];
  massWalls(g, m, { front: ops, back: rows(st, us, (f) => f === 0 ? null : winT({ w: 1.4 * M, h: 1.6 * M, y: 0.7 * M, frame: 'window_frame_dark', panes: { cols: 2 } })), left: rows(st, bays(d, 2, 1 * M), (f) => f === 0 ? null : winT({ w: 1.2 * M, h: 1.6 * M, y: 0.7 * M, frame: 'window_frame_dark', panes: { cols: 2 } })), right: rows(st, bays(d, 2, 1 * M), (f) => f === 0 ? null : winT({ w: 1.2 * M, h: 1.6 * M, y: 0.7 * M, frame: 'window_frame_dark', panes: { cols: 2 } })) });
  const fF = mframe(0, cz, w, d, 'front');
  // Vordach (Marquise) mit Stützen und Licht
  const cw = Math.min(w - 2 * M, 7 * M);
  g.wbox(accent, fF, 0, 4.0 * M, 1.6 * M, cw, 0.35 * M, 3.2 * M);
  if (g.detail >= 1) for (const s of [-1, 1]) g.wbox('metal_light', fF, s * (cw / 2 - 0.2 * M), 0, 3.0 * M, 0.12 * M, 4.0 * M, 0.12 * M, { skip: F.TOP | F.BOTTOM });
  signBand(g, { ...fF, ox: fF.ox + fF.s * 3.2 * M, oz: fF.oz + fF.c * 3.2 * M }, 'HOTEL', 0, 4.38 * M, cw * 0.6, 0.5 * M, { band: null, mat: 'sign_white', depth: 0.03 * M });
  for (let k = 0; k < 3; k++) g.kit.light(fF.ox + fF.c * (k - 1) * cw * 0.3 + fF.s * 1.6 * M, 3.9 * M, fF.oz - fF.s * (k - 1) * cw * 0.3 + fF.c * 1.6 * M, 0xffd79a, 0.6);
  // Senkrechter Schriftzug an der Ecke (Nasenschild über mehrere Geschosse)
  const nm = o.name || name(rng, 'hotel');
  if (n >= 6 && g.detail >= 1) {
    const vx = w / 2 - 0.2 * M;
    const vf = { ox: fF.ox + fF.c * vx + fF.s * 0.8 * M, oz: fF.oz - fF.s * vx + fF.c * 0.8 * M, ry: fF.ry + Math.PI / 2, c: Math.cos(fF.ry + Math.PI / 2), s: Math.sin(fF.ry + Math.PI / 2), len: 1 };
    const word = nm.split(' ')[0];
    const px = 0.22 * M;
    g.wbox(accent, fF, vx, st.y[2], 0.8 * M, 0.25 * M, Math.min(st.top - st.y[2] - 0.5 * M, word.length * 7 * px + 1 * M), 1.5 * M);
    for (const sg of [1, -1]) {
      const ff = { ...vf, ox: vf.ox + vf.s * 0 + fF.c * 0.13 * M * sg, oz: vf.oz + -fF.s * 0.13 * M * sg, ry: fF.ry + sg * Math.PI / 2, c: Math.cos(fF.ry + sg * Math.PI / 2), s: Math.sin(fF.ry + sg * Math.PI / 2) };
      [...word].forEach((ch, i) => text(g, ff, ch, 0, st.y[2] + 0.5 * M + (word.length - 1 - i) * 6.5 * px, 0, px, g.neon(rpick(rng, ['neon_yellow', 'sign_white', 'neon_pink'])), { depth: 0.03 * M }));
    }
  }
  // Balkone an den Seitenachsen
  if (g.detail >= 1) for (let f = 2; f < n; f++) for (const u of [us[0], us[nb - 1]]) balcony(g, fF, u, st.y[f], 2.2 * M, 1.0 * M, { slab: 'concrete', rail: 'metal_dark', type: 'bars' });
  band(g, accent, m, st.y[1] - 0.3 * M, 0.3 * M, 0.05 * M);
  cornice(g, 'trim_stone', m, st.top - 0.35 * M, 1.0);
  flatRoof(g, m, st.top, { mat: 'roof_flat_gravel', wall: wallM, parapet: 0.8 * M });
  rooftop(g, 0, st.top, cz, w, d, { stair: true, n: 4 });
  if (n >= 8) roofSign(g, mframe(0, cz, w, d, 'front'), nm, 0, st.top + 0.8 * M, w * 0.8, 'sign_white');
  comGround(g, PW, PD, front + 0.2 * M);
  flags(g, 0, PD / 2 - 0.5 * M, 3, 0, ['paint_blue', 'paint_white', 'paint_red']);
  if (g.detail >= 1) { for (const sx of [-1, 1]) planter(g, sx * (cw / 2 + 0.6 * M), PD / 2 - 1.6 * M); if (chance(rng, 0.6)) car(g, -cw * 0.25, PD / 2 - 1.8 * M, 0, 'metal_dark'); }
}

// Warenhaus (historisch): Steinpfeiler über alle Geschosse, große Glasfelder, Eckturm
function warenhaus(ctx, g, P) {
  const { rng, level } = ctx;
  const { W: PW, D: PD } = P;
  const n = level >= 4 ? 5 : 4;
  const front = 3.0 * M;
  const w = PW - 0.3 * M, d = Math.min(PD - front - 1.0 * M, (PD > 1.5 ? 16 : 11) * M);
  const cz = PD / 2 - front - d / 2;
  const st = stack(0.2 * M, 4.6 * M, 3.8 * M, n);
  const stone = rpick(rng, ['stone_sandstone', 'stone_grey', 'brick_red', 'plaster_cream']);
  const m = { cx: 0, cz, sx: w, sz: d, y0: 0, y1: st.top, wall: stone };
  const nb = Math.max(3, Math.round(w / (3.6 * M)));
  const us = bays(w, nb, 0.5 * M);
  const bw = (w - 1.0 * M) / nb - 0.9 * M;
  const ops = [];
  us.forEach((u, b) => {
    ops.push({ kind: 'shop', u, y: 0.2 * M, w: bw, h: 3.8 * M, frame: 'metal_dark', door: b === Math.floor(nb / 2) ? 1 : -1, cols: 2, transom: 0.8 * M });
    // Obergeschosse: hohe Glasfelder über je ein Geschoss mit Brüstungsfeld
    for (let f = 1; f < n; f++) ops.push({ kind: 'win', u, y: st.y[f] + 0.5 * M, w: bw, h: st.fh - 0.8 * M, frame: 'metal_dark', panes: { cols: 3, transom: 0.25, transomCols: 3 }, depth: 0.35 * M });
  });
  massWalls(g, m, { front: ops, back: rows(st, bays(w, nb, 0.6 * M), (f) => f === 0 ? null : winT({ w: 1.6 * M, h: 1.8 * M, y: 0.9 * M, frame: 'metal_dark', panes: { cols: 2 } })), left: [], right: [] });
  for (const sd of ['left', 'right']) firewallDecor(g, mframe(0, cz, w, d, sd), st.y[1], st.top, rng, rpick(rng, ['ghost', 'plain', 'ivy']));
  const fF = mframe(0, cz, w, d, 'front');
  pilasters(g, fF, stone === 'brick_red' ? 'trim_stone' : 'stone_grey', us.map((u, i) => u + (w - 1.0 * M) / nb / 2).slice(0, -1).concat([-w / 2 + 0.3 * M, w / 2 - 0.3 * M]), st.y[1], st.top - 0.5 * M, 0.5 * M, 0.2 * M);
  band(g, 'trim_stone', m, st.y[1] - 0.3 * M, 0.35 * M, 0.15 * M, { sides: ['front'] });
  cornice(g, 'trim_stone', m, st.top - 0.5 * M, 1.4, { dentils: true, sides: ['front'] });
  const nm = name(rng, 'store');
  signBand(g, fF, nm, 0, st.y[1] - 0.25 * M - 0.0 * M, w * 0.5, 0.0001, { band: null, light: false });
  roofSign(g, fF, nm, 0, st.top + 0.7 * M, w * 0.7, g.neon(rpick(rng, ['sign_white', 'neon_yellow', 'emissive_red'])));
  // Mansarddach mit Kupfer
  rectRoof(g, { cx: 0, cz, sx: w, sz: d, y0: st.top, pitch: 30, ridge: 'x', mat: 'roof_copper', under: 'trim_stone', edge: 'trim_stone', k: 1, eave: 0.2 * M });
  if (g.detail >= 1) {
    // Eckkuppel
    const tx = w / 2 - 1.8 * M, tz = cz + d / 2 - 1.8 * M;
    g.box(stone, tx, st.top, tz, 3.4 * M, 2.4 * M, 3.4 * M, { skip: F.BOTTOM });
    g.geom('roof_copper', new THREE.SphereGeometry(2.0 * M, g.detail >= 2 ? 10 : 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), { x: tx, y: st.top + 2.4 * M, z: tz, sy: 1.3 });
    g.cyl('metal_dark', tx, st.top + 4.9 * M, tz, 0.05 * M, 1.4 * M, { seg: 4 });
  }
  comGround(g, PW, PD, front + 0.2 * M);
  if (g.detail >= 1) { for (const u of us) lamp(g, u, PD / 2 - 0.4 * M, 4.2 * M); }
}

// Kino: geschlossener Saalbau mit Leuchtvordach und Plakatkästen
function kino(ctx, g, P) {
  const { rng } = ctx;
  const { W: PW, D: PD } = P;
  const front = 3.4 * M;
  const w = PW - 0.6 * M, d = Math.min(PD - front - 0.6 * M, (PD > 1.5 ? 17 : 11) * M);
  const cz = PD / 2 - front - d / 2;
  const h = (PD > 1.5 ? 14 : 11) * M;
  const wallM = rpick(rng, ['brick_dark', 'concrete_panel', 'metal_panel_grey', 'plaster_red', 'brick_red']);
  const m = { cx: 0, cz, sx: w, sz: d, y0: 0, y1: h, wall: wallM };
  const foyer = { kind: 'shop', u: 0, y: 0.2 * M, w: w - 2.0 * M, h: 3.6 * M, frame: 'metal_dark', door: 2, cols: 5, glass: 'glass_shop' };
  massWalls(g, m, { front: [foyer, { kind: 'shop', u: 0, y: 5.6 * M, w: w * 0.5, h: 2.6 * M, frame: 'metal_dark', cols: 4 }], left: [{ kind: 'door', u: d * 0.3, y: 0.1 * M, w: 1.4 * M, h: 2.2 * M, mat: 'metal_panel_grey', double: true }], right: [{ kind: 'door', u: -d * 0.3, y: 0.1 * M, w: 1.4 * M, h: 2.2 * M, mat: 'metal_panel_grey', double: true }], back: [] });
  const fF = mframe(0, cz, w, d, 'front');
  // Leuchtvordach mit Lauflicht-Kanten
  g.wbox('trim_dark', fF, 0, 4.1 * M, 1.3 * M, w - 1.0 * M, 0.6 * M, 2.6 * M);
  g.wbox(g.neon(rpick(rng, ['neon_yellow', 'emissive_warm', 'sign_white'])), fF, 0, 4.1 * M, 2.62 * M, w - 1.0 * M, 0.08 * M, 0.04 * M);
  g.wbox(g.neon(rpick(rng, ['neon_yellow', 'emissive_warm', 'neon_pink'])), fF, 0, 4.62 * M, 2.62 * M, w - 1.0 * M, 0.08 * M, 0.04 * M);
  const nm = name(rng, 'kino');
  signBand(g, { ...fF, ox: fF.ox + fF.s * 2.6 * M, oz: fF.oz + fF.c * 2.6 * M }, nm, 0, 4.18 * M, w * 0.7, 0.42 * M, { band: null, mat: 'sign_white', depth: 0.03 * M });
  // Plakatkästen
  if (g.detail >= 1) for (const u of bays(w, 4, 1.0 * M)) { g.wbox('metal_dark', fF, u, 8.8 * M, 0.08 * M, 1.6 * M, 2.2 * M, 0.15 * M, { skip: F.BACK }); g.wquad(g.neon(rpick(rng, ['paint_blue', 'paint_red', 'paint_yellow', 'neon_cyan', 'neon_pink', 'paint_orange'])), fF, u, 8.95 * M, 0.16 * M, 1.4 * M, 1.9 * M); }
  roofSign(g, fF, nm, 0, h + 0.1 * M, w * 0.8, g.neon(rpick(rng, ['neon_pink', 'neon_cyan', 'emissive_red', 'neon_yellow'])));
  band(g, 'metal_dark', m, h - 0.4 * M, 0.4 * M, 0.08 * M);
  flatRoof(g, m, h, { mat: 'roof_flat_membrane', wall: wallM, parapet: 0.2 * M });
  rooftop(g, 0, h, cz, w, d, { n: 4 });
  comGround(g, PW, PD, front + 0.2 * M);
  if (g.detail >= 1) { for (const sx of [-1, 1]) { bench(g, sx * w * 0.3, PD / 2 - 0.8 * M, 0); planter(g, sx * (w / 2 - 0.6 * M), PD / 2 - 1.6 * M); } }
}

// Glas-Eckhaus: Vorhangfassade mit Steinrahmen, auskragende Obergeschosse
function glasEcke(ctx, g, P, o = {}) {
  const { rng, level } = ctx;
  const { W: PW, D: PD } = P;
  const n = o.floors ?? (level >= 4 ? 7 + Math.floor(rng() * 3) : 5);
  const front = 3.0 * M;
  const w = PW - 0.3 * M, d = Math.min(PD - front - 1.0 * M, (PD > 1.5 ? 16 : 11) * M);
  const cz = PD / 2 - front - d / 2;
  const st = stack(0.15 * M, 4.6 * M, 3.6 * M, n);
  const glass = o.glass || rpick(rng, ['glass_curtain_blue', 'glass_curtain_green', 'glass_curtain_dark', 'glass_curtain_gold']);
  const frameM = rpick(rng, ['metal_dark', 'metal_light', 'metal_panel_grey']);
  // EG: Läden mit Glas, zurückgesetzt
  const gm = { cx: 0, cz: cz - 0.6 * M, sx: w - 1.2 * M, sz: d - 1.2 * M, y0: 0, y1: st.y[1] };
  glassBox(g, gm, { glass: 'glass_shop', frame: 'metal_dark', fh: st.gf, colW: 2.0 * M });
  // Obergeschosse: Glaskörper
  const um = { cx: 0, cz, sx: w, sz: d, y0: st.y[1], y1: st.top };
  g.box('concrete', 0, st.y[1] - 0.3 * M, cz, w, 0.3 * M, d);
  glassBox(g, um, { glass, frame: frameM, fh: st.fh, colW: 1.5 * M, spandrel: o.spandrel || 'metal_panel_grey' });
  // Steinrahmen an Front
  const fF = mframe(0, cz, w, d, 'front');
  if (g.detail >= 1) {
    g.wbox('stone_grey', fF, -w / 2 + 0.2 * M, st.y[1], 0.15 * M, 0.4 * M, st.top - st.y[1], 0.3 * M, { skip: F.BACK });
    g.wbox('stone_grey', fF, w / 2 - 0.2 * M, st.y[1], 0.15 * M, 0.4 * M, st.top - st.y[1], 0.3 * M, { skip: F.BACK });
  }
  g.box('stone_grey', 0, st.top, cz, w + 0.3 * M, 0.6 * M, d + 0.3 * M);
  flatRoof(g, { cx: 0, cz, sx: w, sz: d }, st.top + 0.6 * M, { mat: 'roof_flat_gravel', wall: 'stone_grey', parapet: 0.2 * M });
  rooftop(g, 0, st.top + 0.6 * M, cz, w, d, { stair: true, n: 3 });
  const fG = mframe(0, gm.cz, gm.sx, gm.sz, 'front');
  signBand(g, fG, name(rng, rpick(rng, ['shop', 'bank', 'cafe'])), 0, st.y[1] - 0.95 * M, gm.sx * 0.5, 0.5 * M, { band: null, mat: g.neon(rpick(rng, NEON)), depth: 0.03 * M });
  comGround(g, PW, PD, front + 0.2 * M);
  if (g.detail >= 1) { for (const sx of [-1, 1]) tree(g, sx * (w / 2 - 1.2 * M), PD / 2 - front * 0.4, 0.8); bikeRack(g, 0, PD / 2 - front * 0.4, 5); }
}

// Kaufhaus: großer geschlossener Block mit Fassadenpaneelen, Glasfoyer, riesigem Schriftzug
function kaufhaus(ctx, g, P) {
  const { rng } = ctx;
  const { W: PW, D: PD } = P;
  const n = 5 + Math.floor(rng() * 2);
  const front = 3.4 * M;
  const w = PW - 0.3 * M, d = PD - front - 0.4 * M;
  const cz = PD / 2 - front - d / 2;
  const st = stack(0.15 * M, 5.0 * M, 4.2 * M, n);
  const panelM = rpick(rng, ['stone_sandstone', 'metal_panel_white', 'concrete_panel', 'stone_grey', 'metal_panel_grey']);
  const m = { cx: 0, cz, sx: w, sz: d, y0: 0, y1: st.top, wall: panelM };
  const foyerW = Math.min(w * 0.4, 10 * M);
  const ops = [{ kind: 'shop', u: 0, y: 0.15 * M, w: foyerW, h: 4.2 * M, frame: 'metal_dark', door: 1, cols: 5, transom: 0 }];
  for (const u of [-1, 1]) ops.push({ kind: 'shop', u: u * (foyerW / 2 + (w - foyerW) / 4), y: 0.15 * M, w: (w - foyerW) / 2 - 1.6 * M, h: 4.2 * M, frame: 'metal_dark', cols: 3 });
  // Glasschlitz über dem Eingang
  ops.push({ kind: 'win', u: 0, y: st.y[1] + 0.3 * M, w: foyerW * 0.5, h: st.top - st.y[1] - 1.2 * M, frame: 'metal_dark', panes: { cols: 3, rows: n - 1 }, depth: 0.3 * M, glass: 'glass_curtain_blue' });
  massWalls(g, m, { front: ops, back: [{ kind: 'garage', u: w * 0.3, y: 0.05 * M, w: 4 * M, h: 4 * M, mat: 'metal_corrugated' }], left: [], right: [] });
  const fF = mframe(0, cz, w, d, 'front');
  // Paneelraster
  if (g.detail >= 1) {
    for (let k = 2; k < n; k++) g.wbox('concrete_dark', fF, 0, st.y[k] - 0.03 * M, 0.015 * M, w, 0.06 * M, 0.03 * M, { skip: F.BACK });
    for (const u of bays(w, Math.round(w / (2.5 * M)), 0)) if (Math.abs(u) > foyerW * 0.3) g.wbox('concrete_dark', fF, u - w / Math.round(w / (2.5 * M)) / 2, st.y[1], 0.015 * M, 0.06 * M, st.top - st.y[1], 0.03 * M, { skip: F.BACK | F.TOP | F.BOTTOM });
  }
  const nm = name(rng, 'store');
  const letters = g.neon(rpick(rng, ['emissive_red', 'sign_white', 'neon_cyan', 'paint_blue']));
  for (const sg of [-1, 1]) signBand(g, fF, nm, sg * (foyerW / 2 + (w - foyerW) / 4), st.top - 3.2 * M, (w - foyerW) / 2 - 1 * M, 2.4 * M, { band: null, mat: letters, depth: 0.12 * M, maxPx: 0.45 * M });
  g.wbox('trim_dark', fF, 0, st.y[1] - 0.4 * M, 1.4 * M, w * 0.7, 0.4 * M, 2.8 * M);
  band(g, 'metal_dark', m, st.top - 0.3 * M, 0.3 * M, 0.1 * M);
  flatRoof(g, m, st.top, { mat: 'roof_flat_membrane', wall: panelM, parapet: 0.6 * M });
  rooftop(g, 0, st.top, cz, w, d, { stair: true, n: 6, sat: true });
  if (PW > 1.5 && PD > 1.5) flatSolar(g, -w * 0.2, st.top, cz - d * 0.15, w * 0.4, d * 0.4);
  comGround(g, PW, PD, front + 0.2 * M);
  if (g.detail >= 1) { for (const u of bays(w, 4, 1 * M)) tree(g, u, PD / 2 - front * 0.45, 0.85); bikeRack(g, foyerW / 2 + 1.5 * M, PD / 2 - front * 0.5, 6); }
}

// Einkaufszentrum mit Glasdach-Passage (2×2) bzw. Galerie (kleinere Grundflächen)
function einkaufszentrum(ctx, g, P) {
  const { rng } = ctx;
  const { W: PW, D: PD } = P;
  const n = 3;
  const front = 3.2 * M;
  const w = PW - 0.4 * M, d = PD - front - 0.4 * M;
  const cz = PD / 2 - front - d / 2;
  const st = stack(0.15 * M, 5.0 * M, 4.4 * M, n);
  const wallM = rpick(rng, ['concrete_panel', 'metal_panel_white', 'stone_sandstone', 'brick_red']);
  const passW = Math.min(8 * M, w * 0.3);
  // zwei Flügel links/rechts, dazwischen Glasdach
  for (const sg of [-1, 1]) {
    const ww = (w - passW) / 2;
    const m = { cx: sg * (passW / 2 + ww / 2), cz, sx: ww, sz: d, y0: 0, y1: st.top, wall: wallM };
    const us = bays(ww, Math.max(1, Math.round(ww / (5 * M))), 0.4 * M);
    const fOps = us.map((u) => ({ kind: 'shop', u, y: 0.15 * M, w: Math.min(4.6 * M, ww / us.length - 1.0 * M), h: 4.2 * M, frame: 'metal_dark', door: 0, cols: 3 }));
    const nIn = Math.max(1, Math.round(d / (6 * M)));
    const sw = Math.min(4.4 * M, (d - 2.0 * M) / nIn - 0.8 * M);
    const inner = rows(st, bays(d, nIn, 1.0 * M), (f) => f === 0 ? { kind: 'shop', w: sw, h: 4.0 * M, y: 0, frame: 'metal_dark', door: 0, cols: 2 } : { kind: 'shop', w: sw, h: 3.6 * M, y: 0.3 * M, frame: 'metal_dark', cols: 2, riser: 1.0 * M });
    const sides = { front: fOps, back: [], left: sg > 0 ? inner : [], right: sg < 0 ? inner : [] };
    massWalls(g, m, sides);
    const fF = mframe(m.cx, cz, ww, d, 'front');
    fOps.forEach((sh) => shopDecor(g, fF, sh, { name: name(rng, rpick(rng, ['shop', 'shop', 'cafe', 'snack'])), band: rpick(rng, ['trim_dark', 'metal_panel_grey']), letters: g.neon(rpick(rng, NEON)), maxPx: 0.16 * M }));
    band(g, 'metal_dark', m, st.top - 0.4 * M, 0.4 * M, 0.08 * M);
    flatRoof(g, m, st.top, { mat: 'roof_flat_membrane', wall: wallM, parapet: 0.5 * M });
    rooftop(g, m.cx, st.top, cz, ww, d, { n: 4 });
    // Galerien innen
    if (g.detail >= 1) {
      const fI = mframe(m.cx, cz, ww, d, sg > 0 ? 'left' : 'right');
      for (let f = 1; f < n; f++) { g.wbox('concrete', fI, 0, st.y[f] - 0.25 * M, 0.9 * M, d - 1 * M, 0.25 * M, 1.8 * M); railing(g, fI, 0, st.y[f], 1.75 * M, d - 1 * M, 1.0 * M, 'metal_light', 'panel'); }
    }
  }
  // Glastonnendach über der Passage
  const segs = g.detail === 0 ? 3 : 8;
  const ry = st.top - 0.2 * M;
  for (let k = 0; k < segs; k++) {
    const a0 = Math.PI * k / segs, a1 = Math.PI * (k + 1) / segs;
    const x0 = -Math.cos(a0) * passW / 2, y0 = ry + Math.sin(a0) * passW * 0.45, x1 = -Math.cos(a1) * passW / 2, y1 = ry + Math.sin(a1) * passW * 0.45;
    g.quad('glass_skylight', [x0, y0, cz + d / 2], [x1, y1, cz + d / 2], [x1, y1, cz - d / 2], [x0, y0, cz - d / 2], 0.99, [-(x0 + x1) / 2, 1, 0]);
    if (g.detail >= 1) g.quad('glass_skylight', [x0, y0 - 0.02 * M, cz + d / 2], [x0, y0 - 0.02 * M, cz - d / 2], [x1, y1 - 0.02 * M, cz - d / 2], [x1, y1 - 0.02 * M, cz + d / 2], 0.99, [(x0 + x1) / 2, -1, 0]);
  }
  if (g.detail >= 1) for (let k = 0; k <= Math.round(d / (3 * M)); k++) {
    const z = cz - d / 2 + k * d / Math.round(d / (3 * M));
    for (let s = 0; s < segs; s++) {
      const a0 = Math.PI * s / segs, a1 = Math.PI * (s + 1) / segs;
      const x0 = -Math.cos(a0) * passW / 2, y0 = ry + Math.sin(a0) * passW * 0.45, x1 = -Math.cos(a1) * passW / 2, y1 = ry + Math.sin(a1) * passW * 0.45;
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, len = Math.hypot(x1 - x0, y1 - y0);
      g.rbox('metal_light', mx, my + 0.04 * M, z, len, 0.12 * M, 0.12 * M, 0, 0, Math.atan2(y1 - y0, x1 - x0));
    }
  }
  // Portal vorne
  const fP = { ox: 0, oz: cz + d / 2, ry: 0, c: 1, s: 0, len: passW };
  g.wquad('glass_shop', fP, 0, 0.1 * M, 0.02 * M, passW, st.top - 0.5 * M, 0.95);
  if (g.detail >= 1) for (let k = 0; k <= 4; k++) g.wbox('metal_dark', fP, -passW / 2 + passW * k / 4, 0, 0.06 * M, 0.12 * M, st.top - 0.4 * M, 0.12 * M, { skip: F.BACK });
  g.wbox('metal_dark', fP, 0, st.top - 0.9 * M, 0.3 * M, passW + 1.0 * M, 1.2 * M, 0.6 * M);
  const nm = name(rng, 'center');
  signBand(g, { ...fP, oz: fP.oz + 0.62 * M }, nm, 0, st.top - 0.85 * M, passW + 0.6 * M, 1.1 * M, { band: null, mat: 'sign_white', depth: 0.06 * M });
  comGround(g, PW, PD, front + 0.2 * M);
  if (g.detail >= 1) { for (const sx of [-1, 1]) { tree(g, sx * (passW / 2 + 2.5 * M), PD / 2 - front * 0.45, 0.9); bench(g, sx * (passW / 2 + 5 * M), PD / 2 - front * 0.45, 0); } pylon(g, PW / 2 - 1.2 * M, PD / 2 - 1.0 * M, 8 * M, nm.split(' ')[0], { panel: 'trim_dark', text: 'sign_white', w: 2.0 * M }); }
}

// ---------- Stufe 5: Türme
// Einkaufsturm: dreigeschossiges Einkaufspodium + Glasturm
function einkaufsturm(ctx, g, P, o = {}) {
  const { rng } = ctx;
  const { W: PW, D: PD } = P;
  const front = 3.2 * M;
  const w = PW - 0.3 * M, d = PD - front - 0.4 * M;
  const cz = PD / 2 - front - d / 2;
  const pst = stack(0.15 * M, 5.0 * M, 4.4 * M, 3);
  const wallM = rpick(rng, ['stone_grey', 'metal_panel_white', 'concrete_panel', 'stone_sandstone']);
  const pm = { cx: 0, cz, sx: w, sz: d, y0: 0, y1: pst.top, wall: wallM };
  const us = bays(w, Math.max(2, Math.round(w / (5 * M))), 0.4 * M);
  const fOps = us.map((u, i) => ({ kind: 'shop', u, y: 0.15 * M, w: Math.min(4.6 * M, w / us.length - 0.9 * M), h: 4.2 * M, frame: 'metal_dark', door: i % 2 ? 0 : 1, cols: 3 }));
  fOps.push({ kind: 'shop', u: 0, y: pst.y[1] + 0.4 * M, w: w - 1.5 * M, h: pst.top - pst.y[1] - 1.4 * M, frame: 'metal_dark', cols: Math.round(w / (2 * M)), riser: 0.05 * M, glass: 'glass_curtain_blue', depth: 0.3 * M });
  massWalls(g, pm, { front: fOps, back: [], left: [], right: [] });
  const fF = mframe(0, cz, w, d, 'front');
  fOps.slice(0, us.length).forEach((sh) => shopDecor(g, fF, sh, { name: name(rng, rpick(rng, ['shop', 'shop', 'cafe', 'snack', 'bank'])), band: null, letters: g.neon(rpick(rng, NEON)), maxPx: 0.15 * M, bandGap: 0.05 * M, bandH: 0.6 * M }));
  g.wbox('concrete', fF, 0, pst.y[1] - 0.3 * M, 0.9 * M, w + 0.2 * M, 0.3 * M, 1.8 * M, { skip: F.BACK });
  flatRoof(g, pm, pst.top, { mat: 'green_roof', wall: wallM, parapet: 1.0 * M, coping: 'metal_light' });
  // LED-Wand am Podium
  if (g.detail >= 1) { const sw = Math.min(w * 0.35, 8 * M); g.wbox('metal_dark', fF, -w / 2 + sw / 2 + 0.6 * M, pst.top - 0.2 * M, 0.2 * M, sw + 0.3 * M, 3.4 * M, 0.3 * M); g.wquad(g.neon(rpick(rng, ['neon_cyan', 'neon_pink', 'sign_white', 'neon_yellow'])), fF, -w / 2 + sw / 2 + 0.6 * M, pst.top, 0.36 * M, sw, 3.0 * M); }
  // Turm
  const n = o.floors ?? 16 + Math.floor(rng() * 8);
  const tw = Math.min(w * 0.55, 18 * M), td = Math.min(d * 0.6, 16 * M);
  const tcx = w * 0.18, tcz = cz - d * 0.1;
  const tst = stack(pst.top, 4.0 * M, 3.6 * M, n);
  const glass = rpick(rng, ['glass_curtain_blue', 'glass_curtain_green', 'glass_curtain_dark', 'glass_curtain_gold']);
  glassBox(g, { cx: tcx, cz: tcz, sx: tw, sz: td, y0: tst.y[0], y1: tst.top }, { glass, frame: rpick(rng, ['metal_dark', 'metal_light']), fh: 3.6 * M, colW: 1.5 * M, spandrel: chance(rng, 0.5) ? 'metal_panel_grey' : null });
  // Krone
  const cH = 6 * M;
  if (g.detail >= 1) {
    for (const side of ['front', 'back', 'left', 'right']) {
      const f = mframe(tcx, tcz, tw, td, side);
      const nF = Math.round(f.len / (1.5 * M));
      for (let k = 0; k <= nF; k++) g.wbox('metal_light', f, -f.len / 2 + f.len * k / nF, tst.top, 0.02 * M, 0.1 * M, cH, 0.3 * M, { skip: F.BACK });
    }
  }
  flatRoof(g, { cx: tcx, cz: tcz, sx: tw, sz: td }, tst.top, { mat: 'roof_flat_membrane', wall: 'metal_dark', parapet: 0.6 * M });
  rooftop(g, tcx, tst.top + 0.6 * M, tcz, tw, td, { stair: true, n: 3 });
  g.box('metal_dark', tcx, tst.top, tcz, tw * 0.3, cH * 0.7, td * 0.3, { skip: F.BOTTOM });
  g.cyl('metal_light', tcx, tst.top + cH * 0.7, tcz, 0.08 * M, 6 * M, { seg: 5 });
  g.kit.light(tcx, tst.top + cH * 0.7 + 6 * M, tcz, 0xff3020, 0.5);
  roofSign(g, mframe(tcx, tcz, tw, td, 'front'), o.name || name(rng, 'center').split(' ')[0], 0, tst.top - 2.2 * M, tw * 0.7, g.neon(rpick(rng, ['sign_white', 'neon_cyan', 'emissive_red'])));
  comGround(g, PW, PD, front + 0.2 * M);
  if (g.detail >= 1) for (const u of bays(w, 4, 1 * M)) tree(g, u, PD / 2 - front * 0.45, 0.85);
}

// Hotelturm mit Lichtkrone
function hotelturm(ctx, g, P) {
  const { rng } = ctx;
  hotel(ctx, g, P, { floors: 14 + Math.floor(rng() * 5), wall: rpick(rng, ['plaster_white', 'stone_sandstone', 'metal_panel_white', 'concrete_panel']), name: rpick(rng, ['GRAND HOTEL', 'HOTEL ZENTRAL', 'HOTEL']) });
}

// Turm mit Leuchtwerbung (Medienfassade)
function werbeturm(ctx, g, P) {
  const { rng } = ctx;
  const { W: PW, D: PD } = P;
  const r = geschaeftshaus(ctx, g, P, { floors: 14 + Math.floor(rng() * 5), wall: rpick(rng, ['metal_panel_grey', 'concrete_panel', 'stone_grey']) });
  if (g.detail >= 1) {
    // senkrechte Leuchtbänder an den Ecken + große Bildschirmwand
    const { st, w, fF } = r;
    for (const sg of [-1, 1]) g.wbox(g.neon(rpick(rng, ['neon_cyan', 'neon_pink', 'neon_yellow'])), fF, sg * (w / 2 - 0.15 * M), st.y[2], 0.3 * M, 0.12 * M, st.top - st.y[2], 0.08 * M, { skip: F.BACK });
    const sw = Math.min(w * 0.5, 9 * M), sh = Math.min(6 * M, (st.top - st.y[2]) * 0.3);
    g.wbox('metal_dark', fF, 0, st.y[3], 0.5 * M, sw + 0.4 * M, sh + 0.4 * M, 0.4 * M);
    g.wquad(g.neon(rpick(rng, ['neon_cyan', 'sign_white', 'neon_pink'])), fF, 0, st.y[3] + 0.2 * M, 0.71 * M, sw, sh);
    text(g, fF, rpick(rng, ['STADTPULS', 'SALE', 'NEU', 'ANGEBOT']), 0, st.y[3] + sh * 0.3, 0.72 * M, sw * 0.08, 'sign_white', { depth: 0.01 * M });
  }
  void PW; void PD;
}

// Mall mit Glaskuppel und Turm
function kuppelmall(ctx, g, P) {
  const { rng } = ctx;
  const { W: PW, D: PD } = P;
  if (PW < 1.5 || PD < 1.5) { einkaufsturm(ctx, g, P, { floors: 18 + Math.floor(rng() * 5) }); return; }
  einkaufszentrum(ctx, g, P);
  // Glaskuppel über der Passagenmitte + Turm hinten
  const st = 0.15 * M + 5.0 * M + 4.4 * M * 2;
  const r = 5.0 * M;
  g.geom('glass_skylight', new THREE.SphereGeometry(r, g.detail >= 2 ? 12 : 6, g.detail >= 2 ? 6 : 3, 0, Math.PI * 2, 0, Math.PI / 2), { x: 0, y: st + 0.2 * M, z: 0 });
  if (g.detail >= 1) g.cyl('metal_light', 0, st, 0, r + 0.1 * M, 0.4 * M, { seg: 12, cap: false });
  punkthaus(ctx, g, P, { floors: 16 + Math.floor(rng() * 6), cx: PW * 0.28, cz: -PD * 0.3, size: 11 * M, ground: false, wall: 'metal_panel_white', crown: 'glass_curtain_blue' });
}

// Glasturm mit gestaffelter Krone
function glasturm(ctx, g, P) {
  const { rng } = ctx;
  const { W: PW, D: PD } = P;
  const front = 3.4 * M;
  const s = Math.min(PW - 2.4 * M, PD - front - 2.0 * M, 20 * M);
  const cz = PD / 2 - front - s / 2 - 0.4 * M;
  const glass = rpick(rng, ['glass_curtain_blue', 'glass_curtain_green', 'glass_curtain_dark', 'glass_curtain_gold']);
  const frameM = rpick(rng, ['metal_dark', 'metal_light']);
  // Läden im Sockel (2 Geschosse)
  const pst = stack(0.15 * M, 5.0 * M, 4.0 * M, 2);
  glassBox(g, { cx: 0, cz, sx: s + 1.2 * M, sz: s + 1.2 * M, y0: 0, y1: pst.top }, { glass: 'glass_shop', frame: 'metal_dark', fh: 4.5 * M, colW: 2.2 * M });
  g.box('stone_grey', 0, pst.top, cz, s + 1.6 * M, 0.6 * M, s + 1.6 * M);
  const fP = mframe(0, cz, s + 1.2 * M, s + 1.2 * M, 'front');
  signBand(g, fP, name(rng, rpick(rng, ['shop', 'bank', 'cafe'])), 0, pst.y[1] - 0.9 * M, s * 0.5, 0.6 * M, { band: null, mat: g.neon(rpick(rng, NEON)), depth: 0.04 * M });
  // Schaft in drei Abschnitten
  let y = pst.top + 0.6 * M, sz = s;
  const parts = [10 + Math.floor(rng() * 6), 5 + Math.floor(rng() * 3), 3];
  for (const k of parts) {
    const h = k * 3.6 * M;
    glassBox(g, { cx: 0, cz, sx: sz, sz, y0: y, y1: y + h }, { glass, frame: frameM, fh: 3.6 * M, colW: 1.5 * M, spandrel: 'metal_panel_grey' });
    y += h;
    g.box('metal_light', 0, y, cz, sz + 0.2 * M, 0.3 * M, sz + 0.2 * M);
    y += 0.3 * M;
    sz -= 3.0 * M;
    if (sz < 6 * M) break;
  }
  g.box(glass, 0, y, cz, sz * 0.8, 3.0 * M, sz * 0.8, { skip: F.BOTTOM, lit: 0.99 });
  g.cyl('metal_light', 0, y + 3.0 * M, cz, 0.12 * M, 9 * M, { seg: 6, rTop: 0.03 * M });
  g.kit.light(0, y + 12 * M, cz, 0xff3020, 0.6);
  comGround(g, PW, PD, front + 0.2 * M);
  if (g.detail >= 1) { for (const u of bays(PW, 4, 1 * M)) tree(g, u, PD / 2 - front * 0.45, 0.85); flags(g, -s / 2, PD / 2 - 1.0 * M, 3, 0); }
}

// ---------- Typlisten
const L = (fn, o) => (c, g, P) => fn(c, g, P, o);
const COM = {
  1: {
    '1x1': [kiosk, baeckerei, ladenhaus, imbiss, blumen, pavillon],
    '2x1': [ladenzeile, tankstelle, gasthaus, L(baeckerei, { kind: 'cafe', w: 16 * M, terrace: 3.8 * M }), L(supermarkt), L(werkstatt, { show: false })],
    '1x2': [L(baeckerei, { d: 9 * M }), kiosk, L(ladenhaus, { roof: 'gableF' }), imbiss, gaertnerei, pavillon],
    '2x2': [supermarkt, tankstelle, gaertnerei, L(werkstatt, { show: true }), driveIn, L(ladenzeile, { n: 4, front: 4 * M })],
  },
  2: {
    '1x1': [wohnGeschaeft, apotheke, restaurant, eiscafe, bank, L(ladenhaus, { floors: 2, kind: 'shop' })],
    '2x1': [L(ladenzeile, { floors: 2, n: 3 }), gasthaus, L(wohnGeschaeft, { floors: 3 }), L(supermarkt), driveIn, L(werkstatt, { show: true })],
    '1x2': [L(wohnGeschaeft, { d: 14 * M }), apotheke, restaurant, eiscafe, bank, L(baeckerei, { floors: 2, d: 10 * M })],
    '2x2': [supermarkt, L(ladenzeile, { floors: 2, n: 4, front: 5 * M }), L(werkstatt, { show: true }), gasthaus, driveIn, L(wohnGeschaeft, { floors: 3, d: 14 * M })],
  },
  3: { '*': [geschaeftshaus, gzLaeden, hotel, warenhaus, kino, glasEcke] },
  4: { '*': [kaufhaus, hotel, einkaufszentrum, L(glasEcke, { floors: 8 }), L(geschaeftshaus, { floors: 7 }), gzLaeden] },
  5: { '*': [einkaufsturm, hotelturm, werbeturm, kuppelmall, glasturm, (c, g, P) => einkaufsturm(c, g, P, { floors: 24 + Math.floor(c.rng() * 6) })] },
};

registerArch('com', {
  variants: 6,
  build(ctx) {
    const { kit, level, fw, fd, variant } = ctx;
    const g = new Geo(kit);
    g.lamp = 'sign_white';
    const lv = COM[Math.min(5, Math.max(1, level))];
    const list = lv[`${fw}x${fd}`] || lv['*'] || lv['1x1'];
    list[variant % list.length](ctx, g, { W: fw, D: fd });
    g.flush();
    return kit.build();
  },
});
void W; void fence; void parasol; void hedge;
