// Wohngebäude (Zone Wohnen, Schlüssel 'res'). Besitzer: G3 – Architektur Wohnen & Gewerbe.
// Je Stufe (1–5) und Grundfläche (1×1, 2×1, 1×2, 2×2) mindestens sechs deutlich verschiedene Gebäudetypen:
//  1: Einfamilienhäuser (Satteldach trauf-/giebelständig, Bungalow, Fachwerk, Kubus, Schwedenhaus, Krüppelwalm …)
//  2: Stadtvilla, Doppelhaus, Reihenhauszeile, Zweifamilienhaus, Mansardhaus, Stadthaus
//  3: Gründerzeithaus, Backstein-Altbau, Nachkriegszeile, Laubenganghaus, modernes Mehrfamilienhaus, Stadthäuser
//  4: Plattenbau, Wohnblock mit Loggien, Gründerzeit-Prachtbau, Wohnhof, Terrassenhaus, Laubengang-Riegel
//  5: Wohnturm mit Staffelgeschossen, Punkthochhaus, Scheibenhochhaus, Plattenbau-Hochhaus, Turm mit Pflanzbalkonen
import { registerArch } from './index.js';
import { Geo, rr, rpick, chance } from './rescom_geo.js';
import { house, winStyle, PAL } from './rescom_house.js';
import { garden } from './rescom_garden.js';
import { buildResHigh } from './rescom_block.js';

// ---------- Hausstile (Stufe 1–2)
// Liefert Maße (m) und Hausoptionen. Maße werden später auf das Grundstück begrenzt.
function style(name, rng) {
  const M = 0.1;
  const tiles = rpick(rng, PAL.roofTiles);
  const fr = rpick(rng, PAL.frame);
  switch (name) {
    case 'trauf': return {
      w: rr(rng, 8.0, 8.8), d: rr(rng, 6.6, 7.4),
      o: { floors: 1, knee: rr(rng, 0.9, 1.2) * M, wall: rpick(rng, PAL.plaster), roof: { type: 'gable', pitch: rr(rng, 38, 46), mat: tiles },
        win: { ...winStyle('casement', { frame: fr }), shutters: chance(rng, 0.35) ? rpick(rng, PAL.shutter) : null },
        door: { at: chance(rng, 0.5) ? 'center' : 'left', canopy: rpick(rng, ['roof_metal_grey', 'concrete', 'wood_dark']), mat: rpick(rng, PAL.door) },
        dormers: { n: chance(rng, 0.5) ? 1 : 2, type: rpick(rng, ['gable', 'shed', 'gable']) }, chimney: {}, bays: { front: 3 } },
    };
    case 'giebel': return {
      w: rr(rng, 7.0, 7.8), d: rr(rng, 7.6, 8.6),
      o: { floors: chance(rng, 0.5) ? 2 : 1, knee: rr(rng, 0.4, 0.8) * M, wall: rpick(rng, PAL.plaster), roof: { type: 'gableF', pitch: rr(rng, 42, 50), mat: tiles },
        win: { ...winStyle('casement', { frame: fr }), shutters: chance(rng, 0.4) ? rpick(rng, PAL.shutter) : null, flowers: chance(rng, 0.3) ? ['paint_red', 'leaves_green'] : null },
        door: { at: 'right', canopy: 'roof_metal_grey', mat: rpick(rng, PAL.door) }, bays: { front: 2, side: 2 }, chimney: { z: 0.3 } },
    };
    case 'bungalow': return {
      w: rr(rng, 8.8, 9.4), d: rr(rng, 7.0, 8.0),
      o: { floors: 1, plinth: 0.2 * M, wall: rpick(rng, ['plaster_white', 'plaster_cream', 'brick_yellow', 'brick_red', 'plaster_grey']),
        roof: chance(rng, 0.6) ? { type: 'hip', pitch: rr(rng, 20, 26), mat: rpick(rng, ['roof_tiles_anthracite', 'roof_tiles_brown', 'roof_tiles_red']) } : { type: 'flat', mat: 'roof_flat_gravel', parapet: 0.35 * M, coping: 'metal_light' },
        win: winStyle(chance(rng, 0.5) ? 'wide' : 'modern', { frame: rpick(rng, ['window_frame_white', 'window_frame_dark']) }),
        door: { at: 'left', canopy: 'concrete', glazed: true, mat: rpick(rng, ['wood_dark', 'trim_dark', 'door_wood']) }, bays: { front: 3, side: 2 }, chimney: chance(rng, 0.5) ? {} : null },
    };
    case 'fachwerk': return {
      w: rr(rng, 7.6, 8.4), d: rr(rng, 6.6, 7.2),
      o: { floors: 2, knee: 0.2 * M, fh: 2.7 * M, plinth: 0.6 * M, plinthMat: rpick(rng, ['stone_sandstone', 'stone_grey']), wall: rpick(rng, ['plaster_white', 'plaster_cream', 'plaster_white']), timber: rpick(rng, ['wood_dark', 'wood_dark', 'brick_dark']),
        roof: { type: 'gable', pitch: rr(rng, 48, 54), mat: rpick(rng, ['roof_tiles_red', 'roof_tiles_brown', 'roof_tiles_red']), under: 'wood_dark', edge: 'wood_dark' },
        win: { ...winStyle('cottage', { frame: 'window_frame_white' }), shutters: chance(rng, 0.5) ? rpick(rng, ['paint_green', 'wood_dark', 'paint_red']) : null, flowers: chance(rng, 0.6) ? ['paint_red', 'leaves_green', 'paint_white'] : null },
        door: { at: 'center', mat: rpick(rng, ['wood_dark', 'paint_green', 'door_wood']), canopy: null }, bays: { front: 3, side: 2 }, chimney: { mat: 'chimney_brick' }, atticTop: true },
    };
    case 'kubus': return {
      w: rr(rng, 8.2, 8.8), d: rr(rng, 7.4, 8.2),
      o: { floors: 2, plinth: 0.15 * M, wall: rpick(rng, ['plaster_white', 'plaster_grey', 'plaster_white', 'concrete_panel']), roof: { type: 'flat', mat: 'roof_flat_gravel', parapet: 0.4 * M, coping: 'metal_light' },
        win: winStyle(rpick(rng, ['modern', 'wide', 'square']), { frame: 'window_frame_dark' }), door: { at: 'left', glazed: true, mat: 'wood_dark', canopy: 'concrete', canopyW: 1.6 * M },
        bays: { front: 3, side: 2 }, sillH: 0.5 * M, floorBand: false },
    };
    case 'schweden': return {
      w: rr(rng, 7.6, 8.4), d: rr(rng, 6.4, 7.0),
      o: { floors: 1, knee: 1.0 * M, plinth: 0.5 * M, plinthMat: 'stone_dark', wall: rpick(rng, ['siding_red', 'siding_red', 'siding_blue', 'siding_white']), roof: { type: 'gable', pitch: rr(rng, 34, 40), mat: rpick(rng, ['roof_tiles_anthracite', 'roof_slate', 'roof_tiles_red']), under: 'paint_white', edge: 'paint_white' },
        win: { ...winStyle('cottage', { frame: 'window_frame_white' }), sill: 'paint_white' }, door: { at: 'center', mat: rpick(rng, ['paint_white', 'paint_blue', 'paint_green']) },
        porch: { w: 4.2 * M, d: 1.8 * M, post: 'paint_white', rail: true }, dormers: { n: 1, type: 'gable', w: 2.0 * M }, bays: { front: 3 }, chimney: {}, trim: 'paint_white' },
    };
    case 'krueppel': return {
      w: rr(rng, 8.2, 8.8), d: rr(rng, 6.8, 7.4),
      o: { floors: 1, knee: rr(rng, 1.0, 1.3) * M, wall: rpick(rng, PAL.plaster), roof: { type: 'halfhip', k: rr(rng, 0.3, 0.42), pitch: rr(rng, 42, 48), mat: tiles },
        win: { ...winStyle('casement', { frame: fr }), shutters: chance(rng, 0.4) ? rpick(rng, PAL.shutter) : null }, door: { at: 'center', canopy: 'roof_metal_grey', mat: rpick(rng, PAL.door) },
        dormers: { n: 1, type: 'shed', w: 2.6 * M }, chimney: {}, bays: { front: 3 } },
    };
    case 'zwerch': return {
      w: rr(rng, 8.6, 9.2), d: rr(rng, 7.0, 7.6),
      o: { floors: 1, knee: rr(rng, 0.8, 1.0) * M, wall: rpick(rng, PAL.plaster), roof: { type: 'gable', pitch: rr(rng, 40, 45), mat: tiles },
        win: winStyle('casement', { frame: fr }), door: { at: 'left', canopy: 'roof_metal_grey', mat: rpick(rng, PAL.door) }, cross: { w: 3.4 * M, out: chance(rng, 0.5) ? 0.8 * M : 0, balcony: chance(rng, 0.4) }, bays: { front: 3 }, chimney: { x: -2.5 * M } },
    };
    case 'pult': return {
      w: rr(rng, 8.4, 9.0), d: rr(rng, 7.0, 7.8),
      o: { floors: 2, plinth: 0.15 * M, wall: rpick(rng, ['plaster_white', 'wood_planks', 'plaster_grey', 'wood_dark']), roof: { type: 'shed', pitch: rr(rng, 14, 20), hi: chance(rng, 0.5) ? 'front' : 'back', mat: 'roof_metal_grey', under: 'wood_planks', edge: 'metal_dark' },
        win: winStyle(rpick(rng, ['modern', 'square', 'wide']), { frame: 'window_frame_dark' }), door: { at: 'right', glazed: true, mat: 'wood_dark', canopy: 'metal_dark' }, bays: { front: 3, side: 2 }, sillH: 0.6 * M, chimney: {} },
    };
    case 'villa': return {
      w: rr(rng, 8.6, 9.2), d: rr(rng, 8.2, 8.8),
      o: { floors: 2, plinth: 0.6 * M, wall: rpick(rng, ['plaster_cream', 'plaster_white', 'plaster_ochre', 'plaster_yellow', 'plaster_blue']), trim: 'trim_stone', roof: { type: 'pyramid', pitch: rr(rng, 22, 27), mat: rpick(rng, ['roof_tiles_anthracite', 'roof_tiles_red', 'roof_slate']), under: 'paint_white', edge: 'paint_white', eave: 0.7 * M },
        win: { ...winStyle('tall', { frame: 'window_frame_white' }), h: 1.6 * M, surround: 'trim_stone' }, floorBand: true, door: { at: 'center', canopy: 'roof_copper', mat: rpick(rng, ['door_wood', 'wood_dark', 'paint_green']), double: true, transom: true },
        bays: { front: 3, side: 3 }, chimney: { x: 1.6 * M, z: -1.6 * M }, quoins: chance(rng, 0.5) ? 'trim_stone' : null, balconyFront: chance(rng, 0.5) ? { w: 2.4 * M, d: 1.1 * M, slab: 'trim_stone', rail: 'metal_dark' } : null },
    };
    case 'zweifam': return {
      w: rr(rng, 8.8, 9.4), d: rr(rng, 7.8, 8.6),
      o: { floors: 2, knee: 0.5 * M, wall: rpick(rng, PAL.plaster), roof: { type: chance(rng, 0.6) ? 'gable' : 'halfhip', k: 0.3, pitch: rr(rng, 40, 46), mat: tiles },
        win: { ...winStyle('casement', { frame: fr }), shutters: chance(rng, 0.3) ? rpick(rng, PAL.shutter) : null }, door: { at: 'center', canopy: 'concrete', mat: rpick(rng, PAL.door), glazed: true },
        dormers: { n: 2, type: rpick(rng, ['gable', 'shed']), side: 'both' }, bays: { front: 3 }, chimney: {}, floorBand: chance(rng, 0.5), balconyFront: chance(rng, 0.5) ? { w: 2.8 * M, d: 1.3 * M } : null },
    };
    case 'mansard': return {
      w: rr(rng, 8.8, 9.4), d: rr(rng, 8.0, 8.8),
      o: { floors: 2, plinth: 0.7 * M, wall: rpick(rng, ['plaster_cream', 'plaster_ochre', 'plaster_white', 'stone_sandstone', 'brick_red']), trim: 'trim_stone', roof: { type: 'mansard', mat: rpick(rng, ['roof_slate', 'roof_tiles_anthracite', 'roof_slate']), hm: 2.6 * M },
        win: { ...winStyle('tall', { frame: 'window_frame_white' }), surround: 'trim_stone', header: chance(rng, 0.5) ? 'flat' : null }, floorBand: true, door: { at: 'center', canopy: null, double: true, transom: true, mat: 'wood_dark' }, bays: { front: 3, side: 2 } },
    };
    case 'stadthaus': return {
      w: rr(rng, 6.4, 7.2), d: rr(rng, 8.6, 9.2),
      o: { floors: 3, plinth: 0.3 * M, wall: rpick(rng, ['brick_red', 'brick_dark', 'plaster_white', 'wood_planks', 'brick_yellow']), roof: { type: 'flat', mat: chance(rng, 0.5) ? 'green_roof' : 'roof_flat_gravel', parapet: 0.5 * M, coping: 'metal_light' },
        win: { ...winStyle('tall', { frame: 'window_frame_dark' }), h: 2.0 * M, w: 1.4 * M, sill: 'metal_light', panes: { cols: 1, transom: 0.2 } }, door: { at: 'left', glazed: true, mat: 'wood_dark', canopy: 'metal_dark' }, bays: { front: 2, side: 2 }, sillH: 0.5 * M },
    };
  }
  return style('trauf', rng);
}

// Haus auf ein Grundstück setzen (Breite W, Tiefe D) und Garten anlegen
function plotHouse(ctx, g, name, opt = {}) {
  const { rng, fw, fd } = ctx;
  const M = 0.1;
  const W = fw, D = fd;
  const st = style(name, rng);
  const sideMin = opt.sideMin ?? 0.9 * M;
  const frontY = opt.frontYard ?? rr(rng, 1.4, 2.2) * M;
  let w = st.w * M, d = st.d * M;
  if (opt.wScale) w *= opt.wScale;
  if (opt.dScale) d *= opt.dScale;
  w = Math.min(w, W - sideMin * 2 - (opt.reserve || 0));
  d = Math.min(d, D - frontY - (opt.backMin ?? 1.4 * M));
  let x = opt.x ?? 0;
  const rside = opt.reserveSide ?? (rng() < 0.5 ? 1 : -1);
  if (opt.reserve) x = rside > 0 ? -W / 2 + sideMin + w / 2 : W / 2 - sideMin - w / 2;
  const z = D / 2 - frontY - d / 2;
  const hopt = { ...st.o, ...(opt.house || {}), x, z, w, d };
  if (opt.solar) hopt.solar = {};
  const res = house(g, hopt);
  if (opt.garden !== false) garden(g, { W, D }, { x, z, w, d, doorU: res.doorU }, { drive: opt.drive, driveSide: opt.reserve ? rside : undefined, ...(opt.gardenOpt || {}) });
  return res;
}

// Doppelhaus: zwei gespiegelte Hälften mit gemeinsamer Wand
function doubleHouse(ctx, g, o = {}) {
  const { rng, fw, fd } = ctx;
  const M = 0.1;
  const W = fw, D = fd;
  const frontY = rr(rng, 1.6, 2.4) * M;
  const halfW = Math.min(o.halfW ?? (W > 1.5 ? 6.8 : 4.4) * M, W / 2 - 0.5 * M);
  const d = Math.min(o.d ?? rr(rng, 8.0, 9.0) * M, D - frontY - 1.4 * M);
  const z = D / 2 - frontY - d / 2;
  const tiles = rpick(rng, PAL.roofTiles);
  const rtype = o.roof || rpick(rng, ['gable', 'gable', 'halfhip', 'hip']);
  const walls = chance(rng, 0.5) ? [rpick(rng, PAL.plaster), rpick(rng, PAL.plaster)] : (() => { const w0 = rpick(rng, PAL.plaster); return [w0, w0]; })();
  const pitch = rr(rng, 38, 45);
  const floors = o.floors ?? 1;
  for (const s of [-1, 1]) {
    const x = s * halfW / 2;
    const dm = chance(rng, 0.6) ? { n: 1, type: rpick(rng, ['gable', 'shed']), at: s * halfW * 0.1 } : null;
    house(g, {
      x, z, w: halfW, d, floors, knee: floors === 1 ? 1.0 * M : 0.4 * M, wall: walls[s > 0 ? 1 : 0], party: [s > 0 ? 'left' : 'right'],
      roof: (() => { const k = rtype === 'hip' ? 0.99 : rtype === 'halfhip' ? 0.35 : 0; return { type: k > 0 ? 'halfhip' : 'gable', k, k0: s > 0 ? 0 : k, k1: s > 0 ? k : 0, verge0: s > 0 ? 0.001 * M : undefined, verge1: s > 0 ? undefined : 0.001 * M, pitch, mat: tiles, ridge: 'x' }; })(),
      win: { ...winStyle('casement', { frame: 'window_frame_white' }), shutters: chance(rng, 0.25) ? rpick(rng, PAL.shutter) : null }, bays: { front: 2, back: 2, side: 2 },
      door: { at: s > 0 ? 'right' : 'left', canopy: rpick(rng, ['roof_metal_grey', 'concrete']), mat: rpick(rng, PAL.door) },
      dormers: dm, chimney: chance(rng, 0.5) ? { x: s * halfW * 0.25 } : null,
      terraceBay: s > 0 ? 1 : 0,
    });
  }
  // Garten (beide Hälften), Trennhecke
  garden(g, { W, D }, { x: 0, z, w: halfW * 2, d, doorU: halfW * 0.8 }, { drive: W > 1.5 ? 'carport' : null, sideTree: false, trees: W > 1.5 ? 3 : 2 });
  if (g.detail >= 1) {
    // Trennung zwischen den Gärten
    g.box('hedge', 0, 0, (z - d / 2 - D / 2) / 2, 0.4 * M, 1.2 * M, Math.max(0.2 * M, z - d / 2 + D / 2 - 0.2 * M), { skip: 32 });
  }
}

// Reihenhauszeile: n schmale Einheiten mit Versatz und Farbwechsel
function rowHouses(ctx, g, o = {}) {
  const { rng, fw, fd } = ctx;
  const M = 0.1;
  const W = fw, D = fd;
  const n = o.n ?? Math.max(2, Math.round((W - 0.6 * M) / (5.2 * M)));
  const uw = (W - 0.4 * M) / n;
  const d = Math.min(o.d ?? rr(rng, 8.4, 9.6) * M, D - 2.6 * M);
  const modern = o.modern ?? chance(rng, 0.35);
  const tiles = rpick(rng, PAL.roofTiles);
  const pitch = rr(rng, 36, 44);
  const baseWall = modern ? rpick(rng, ['brick_red', 'brick_dark', 'plaster_white', 'brick_yellow']) : rpick(rng, PAL.plaster);
  const floors = o.floors ?? (modern ? 2 : (chance(rng, 0.5) ? 2 : 1));
  for (let k = 0; k < n; k++) {
    const x = -W / 2 + 0.2 * M + uw * (k + 0.5);
    const stagger = o.stagger ?? (chance(rng, 0.5) ? 0.6 * M : 0);
    const frontY = 2.2 * M + (k % 2) * stagger;
    const z = D / 2 - frontY - d / 2;
    const wall = modern ? (k % 2 ? baseWall : rpick(rng, ['plaster_white', 'wood_planks', 'plaster_grey', baseWall])) : rpick(rng, PAL.plaster);
    const party = [];
    if (k > 0) party.push('left');
    if (k < n - 1) party.push('right');
    const r = house(g, {
      x, z, w: uw - 0.01 * M, d, floors, knee: floors === 1 ? 1.1 * M : 0.3 * M, wall, party, plinth: 0.35 * M,
      roof: modern ? { type: 'flat', mat: chance(rng, 0.5) ? 'green_roof' : 'roof_flat_gravel', parapet: 0.45 * M, coping: 'metal_light', parapetMat: wall } : { type: 'gable', pitch, mat: tiles, ridge: 'x', verge0: k > 0 ? 0.001 * M : 0.35 * M, verge1: k < n - 1 ? 0.001 * M : 0.35 * M },
      win: modern ? winStyle('modern', { frame: 'window_frame_dark' }) : winStyle('casement', { frame: rpick(rng, ['window_frame_white', 'window_frame_wood']) }),
      bays: { front: 2, back: 2 }, door: { at: k % 2 ? 'right' : 'left', canopy: modern ? 'metal_dark' : rpick(rng, ['roof_metal_grey', 'concrete', 'wood_dark']), mat: rpick(rng, PAL.door), glazed: modern },
      dormers: !modern && chance(rng, 0.6) ? { n: 1, type: rpick(rng, ['shed', 'gable']), w: 1.8 * M } : null, chimney: !modern && chance(rng, 0.4) ? { x: 0 } : null,
      terraceBay: 0,
    });
    void r;
    // Vorgarten je Einheit
    const det = g.detail;
    const zf = D / 2;
    g.box('grass', x, 0, (zf + z + d / 2) / 2, uw - 0.05 * M, 0.03 * M, zf - (z + d / 2), { skip: 32 });
    g.box('pavers', x + (k % 2 ? 1 : -1) * (uw / 2 - 1.3 * M), 0, (zf + z + d / 2) / 2, 1.3 * M, 0.05 * M, zf - (z + d / 2), { skip: 32 });
    if (det >= 1) {
      g.box('hedge', x + (k % 2 ? -1 : 1) * 0.5 * M, 0, zf - 0.4 * M, uw - 2.2 * M, 0.8 * M, 0.45 * M, { skip: 32 });
      if (det >= 2) {
        for (let b = 0; b < 2; b++) g.box(['metal_dark', 'paint_blue'][b], x + (k % 2 ? 1 : -1) * (uw / 2 - 0.35 * M), 0, z + d / 2 + 0.5 * M + b * 0.75 * M, 0.6 * M, 1.05 * M, 0.7 * M, { skip: 32 });
      }
    }
    // Garten hinten
    const zb0 = -D / 2, zb1 = z - d / 2;
    g.box('grass', x, 0, (zb0 + zb1) / 2, uw - 0.05 * M, 0.03 * M, zb1 - zb0, { skip: 32 });
    if (det >= 1 && k < n - 1) g.box('wood_planks', x + uw / 2, 0, (zb0 + zb1) / 2, 0.06 * M, 1.6 * M, zb1 - zb0, { skip: 32 });
    if (det >= 1 && zb1 - zb0 > 2.5 * M) g.box('pavers', x, 0, zb1 - 1.2 * M, uw * 0.8, 0.06 * M, 2.2 * M, { skip: 32 });
  }
}

// ---------- Stufe 1–2: Typlisten je Grundfläche
const LOW = {
  1: {
    '1x1': [(c, g) => plotHouse(c, g, 'trauf', { gardenOpt: { fence: 'picket' } }), (c, g) => plotHouse(c, g, 'giebel'), (c, g) => plotHouse(c, g, 'bungalow', { frontYard: 1.2 * 0.1, gardenOpt: { fence: 'hedge' } }), (c, g) => plotHouse(c, g, 'fachwerk', { gardenOpt: { fence: 'picket', fenceMat: 'wood_planks' } }), (c, g) => plotHouse(c, g, 'kubus', { gardenOpt: { fence: 'wall' } }), (c, g) => plotHouse(c, g, 'schweden', { gardenOpt: { fence: 'picket' } })],
    '2x1': [(c, g) => plotHouse(c, g, 'trauf', { reserve: 4.0 * 0.1, drive: 'garage', wScale: 1.15 }), (c, g) => plotHouse(c, g, 'bungalow', { reserve: 3.6 * 0.1, drive: 'carport', wScale: 1.35 }), (c, g) => plotHouse(c, g, 'zwerch', { reserve: 3.8 * 0.1, drive: 'carport', wScale: 1.2 }), (c, g) => plotHouse(c, g, 'krueppel', { reserve: 3.6 * 0.1, drive: 'garage', wScale: 1.15 }), (c, g) => plotHouse(c, g, 'pult', { reserve: 3.6 * 0.1, drive: 'open', wScale: 1.2, solar: true }), (c, g) => plotHouse(c, g, 'fachwerk', { reserve: 3.6 * 0.1, drive: 'open', wScale: 1.3 })],
    '1x2': [(c, g) => plotHouse(c, g, 'giebel', { dScale: 1.15 }), (c, g) => plotHouse(c, g, 'trauf', { solar: true }), (c, g) => plotHouse(c, g, 'bungalow', { dScale: 1.3 }), (c, g) => plotHouse(c, g, 'schweden'), (c, g) => plotHouse(c, g, 'kubus', { dScale: 1.2 }), (c, g) => plotHouse(c, g, 'krueppel')],
    '2x2': [(c, g) => plotHouse(c, g, 'villa', { wScale: 1.3, dScale: 1.2, drive: 'garage', reserve: 3.4 * 0.1, gardenOpt: { pool: { x: 0.25, z: -0.55, w: 0.8, d: 0.4 } } }), (c, g) => plotHouse(c, g, 'bungalow', { wScale: 1.5, dScale: 1.4, drive: 'carport', reserve: 3.4 * 0.1, gardenOpt: { pool: { x: -0.3, z: -0.6, w: 0.7, d: 0.38 } } }), (c, g) => plotHouse(c, g, 'trauf', { wScale: 1.25, dScale: 1.15, drive: 'garage', reserve: 3.6 * 0.1, solar: true }), (c, g) => plotHouse(c, g, 'fachwerk', { wScale: 1.4, dScale: 1.3, drive: 'open', reserve: 3.4 * 0.1 }), (c, g) => plotHouse(c, g, 'kubus', { wScale: 1.4, dScale: 1.3, drive: 'carport', reserve: 3.4 * 0.1, gardenOpt: { pool: { x: 0.2, z: -0.6, w: 0.9, d: 0.35 } } }), (c, g) => plotHouse(c, g, 'zwerch', { wScale: 1.3, dScale: 1.2, drive: 'garage', reserve: 3.4 * 0.1 })],
  },
  2: {
    '1x1': [(c, g) => plotHouse(c, g, 'villa'), (c, g) => doubleHouse(c, g), (c, g) => plotHouse(c, g, 'zweifam', { frontYard: 1.2 * 0.1, backMin: 0.8 * 0.1 }), (c, g) => plotHouse(c, g, 'mansard', { frontYard: 1.1 * 0.1, backMin: 0.8 * 0.1 }), (c, g) => plotHouse(c, g, 'fachwerk', { house: { floors: 3, fh: 2.6 * 0.1 }, frontYard: 1.0 * 0.1 }), (c, g) => plotHouse(c, g, 'stadthaus', { wScale: 1.3, frontYard: 1.0 * 0.1, backMin: 0.5 * 0.1 })],
    '2x1': [(c, g) => rowHouses(c, g, { n: 4 }), (c, g) => doubleHouse(c, g, { floors: 2 }), (c, g) => plotHouse(c, g, 'villa', { reserve: 3.4 * 0.1, drive: 'garage', wScale: 1.2 }), (c, g) => rowHouses(c, g, { n: 3, modern: true }), (c, g) => plotHouse(c, g, 'zweifam', { wScale: 1.5, drive: null }), (c, g) => plotHouse(c, g, 'mansard', { reserve: 3.4 * 0.1, drive: 'open', wScale: 1.15 })],
    '1x2': [(c, g) => plotHouse(c, g, 'villa', { dScale: 1.15 }), (c, g) => plotHouse(c, g, 'zweifam', { dScale: 1.3, house: { floors: 2 } }), (c, g) => plotHouse(c, g, 'stadthaus', { wScale: 1.3, dScale: 1.4 }), (c, g) => doubleHouse(c, g, { floors: 2, d: 1.1 }), (c, g) => plotHouse(c, g, 'mansard', { dScale: 1.2 }), (c, g) => plotHouse(c, g, 'giebel', { house: { floors: 2 }, dScale: 1.3 })],
    '2x2': [(c, g) => rowHouses(c, g, { n: 4, d: 1.0 }), (c, g) => plotHouse(c, g, 'villa', { wScale: 1.5, dScale: 1.5, drive: 'garage', reserve: 3.6 * 0.1 }), (c, g) => doubleHouse(c, g, { floors: 2, d: 1.0 }), (c, g) => rowHouses(c, g, { n: 3, modern: true, d: 1.1 }), (c, g) => plotHouse(c, g, 'mansard', { wScale: 1.5, dScale: 1.4, drive: 'open', reserve: 3.4 * 0.1 }), (c, g) => plotHouse(c, g, 'zweifam', { wScale: 1.6, dScale: 1.4, drive: 'carport', reserve: 3.4 * 0.1 })],
  },
};

registerArch('res', {
  variants: 6,
  build(ctx) {
    const { kit, level, fw, fd, variant } = ctx;
    const g = new Geo(kit);
    const fp = `${fw}x${fd}`;
    if (level <= 2) {
      const list = (LOW[level] && LOW[level][fp]) || LOW[level]['1x1'];
      list[variant % list.length](ctx, g);
    } else {
      buildResHigh(ctx, g);
    }
    g.flush();
    return kit.build();
  },
});
