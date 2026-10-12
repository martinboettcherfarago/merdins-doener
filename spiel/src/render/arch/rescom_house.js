// Parametrisches Haus (Besitzer G3): Einfamilienhaus, Doppelhaus, Reihenhaus, Stadtvilla, Fachwerkhaus,
// Bungalow, Kubus – alles aus einem Generator mit Dachform, Geschossen, Kniestock, Gauben, Zwerchgiebel,
// Erker, Veranda, Balkon, Fachwerk und Fensterstil. Front zeigt nach +z.
import { M } from './kit.js';
import { F, NB, rr, rpick } from './rescom_geo.js';
import { mframe, massWalls, bays, band, balcony, pilasters, quoins } from './rescom_facade.js';
import { rectRoof, dormer, chimney, roofWindow, solarField, flatRoof, shedRoof, mansardRoof, mansardDormer } from './rescom_roofs.js';

export const PAL = {
  plaster: ['plaster_white', 'plaster_cream', 'plaster_ochre', 'plaster_pink', 'plaster_blue', 'plaster_green', 'plaster_yellow', 'plaster_grey', 'plaster_red'],
  plasterLight: ['plaster_white', 'plaster_cream', 'plaster_grey', 'plaster_white', 'plaster_yellow'],
  brick: ['brick_red', 'brick_brown', 'brick_yellow', 'brick_dark', 'brick_white'],
  roofTiles: ['roof_tiles_red', 'roof_tiles_brown', 'roof_tiles_anthracite', 'roof_tiles_red', 'roof_slate'],
  shutter: ['paint_green', 'wood_dark', 'paint_white', 'paint_blue', 'wood_planks', 'trim_dark', 'paint_red'],
  door: ['door_wood', 'wood_dark', 'paint_red', 'paint_blue', 'paint_green', 'trim_dark', 'paint_white'],
  frame: ['window_frame_white', 'window_frame_white', 'window_frame_dark', 'window_frame_wood'],
};

// Fensterstile: liefert Öffnungsvorlagen (ohne u/y)
export function winStyle(style, o = {}) {
  const fr = o.frame || 'window_frame_white';
  switch (style) {
    case 'cottage': return { kind: 'win', w: 1.0 * M, h: 1.2 * M, frame: fr, panes: { cols: 2, rows: 2, mt: 0.05 * M }, sill: o.sill ?? true };
    case 'tall': return { kind: 'win', w: 1.15 * M, h: 1.9 * M, frame: fr, panes: { cols: 2, transom: 0.28 }, sill: o.sill ?? 'trim_stone' };
    case 'modern': return { kind: 'win', w: 1.6 * M, h: 1.45 * M, frame: o.frame || 'window_frame_dark', panes: { cols: 2, ft: 0.06 * M }, sill: o.sill ?? 'metal_light' };
    case 'wide': return { kind: 'win', w: 2.2 * M, h: 1.5 * M, frame: o.frame || 'window_frame_dark', panes: { cols: 3, ft: 0.06 * M }, sill: o.sill ?? 'metal_light' };
    case 'square': return { kind: 'win', w: 1.2 * M, h: 1.2 * M, frame: fr, panes: { cols: 1 }, sill: o.sill ?? 'metal_light' };
    case 'small': return { kind: 'win', w: 0.8 * M, h: 1.0 * M, frame: fr, panes: { cols: 1 }, sill: o.sill ?? true };
    default: return { kind: 'win', w: 1.2 * M, h: 1.35 * M, frame: fr, panes: { cols: 2, transom: 0.22 }, sill: o.sill ?? true };
  }
}

// Haus bauen. Wichtige Optionen:
//  x, z, w, d     Mitte und Maße des Hauptbaukörpers
//  floors, fh, knee, plinth, wall, plinthMat, trim
//  roof: { type: 'gable'|'gableF'|'hip'|'halfhip'|'pyramid'|'flat'|'shed'|'mansard', pitch, mat, under, edge, eave, verge, hi }
//  win (Vorlage), winFront/winBack (Vorlage je Seite), bays: { front, back, side }
//  door: { at: 'left'|'center'|'right'|Zahl, mat, canopy, glazed, transom }, party: ['left'] Seiten ohne Fenster
//  dormers: { n, type, side: 'front'|'back'|'both' }, roofWindows, solar, chimney
//  cross: { w, out } Zwerchgiebel an der Front, porch, balconyFront, timber, erker
export function house(g, o) {
  const D = g.detail, rng = g.rng;
  const FH = o.fh ?? 2.9 * M;
  const pl = o.plinth ?? 0.45 * M;
  const floors = o.floors ?? 1;
  const knee = o.knee ?? 0;
  const yEave = pl + floors * FH + knee;
  const roof = o.roof || { type: 'gable' };
  const rt = roof.type || 'gable';
  const wallMat = o.wall || 'plaster_white';
  const trim = o.trim || 'trim_stone';
  const m = { cx: o.x || 0, cz: o.z || 0, sx: o.w, sz: o.d, y0: 0, y1: yEave, wall: wallMat };
  const win = o.win || winStyle('casement', { frame: o.frame });
  const party = o.party || [];
  const ops = { front: [], back: [], left: [], right: [] };
  const sideLen = { front: o.w, back: o.w, left: o.d, right: o.d };
  const ridgeX = rt === 'gable' || rt === 'halfhip' || rt === 'hip' ? (roof.ridge ? roof.ridge === 'x' : true) : rt === 'gableF' ? false : o.w >= o.d;
  const floorY = (f) => pl + f * FH;
  const sillH = o.sillH ?? 0.9 * M;
  // Achsen
  const nb = o.bays || {};
  const nFront = nb.front ?? Math.max(2, Math.round(o.w / (2.7 * M)));
  const nBack = nb.back ?? nFront;
  const nSide = nb.side ?? Math.max(1, Math.round(o.d / (3.6 * M)));
  const usFront = bays(o.w, nFront, 0.6 * M), usBack = bays(o.w, nBack, 0.6 * M);
  const usSide = bays(o.d, nSide, 0.9 * M);
  // Tür
  const door = o.door || {};
  let doorU = 0;
  if (door.at === 'left') doorU = usFront[0];
  else if (door.at === 'right') doorU = usFront[usFront.length - 1];
  else if (typeof door.at === 'number') doorU = door.at;
  else doorU = nFront % 2 ? usFront[(nFront - 1) >> 1] : (usFront[nFront / 2 - 1] + usFront[nFront / 2]) / 2;
  const doorW = door.w ?? 1.1 * M, doorH = door.h ?? 2.2 * M;
  const doorReplaces = door.inBay !== false && usFront.some((u) => Math.abs(u - doorU) < 0.05 * M);
  const doorOp = { kind: 'door', u: doorU, y: pl, w: doorW, h: doorH, mat: door.mat || 'door_wood', frame: door.frame || win.frame, glazed: door.glazed, transom: door.transom, canopy: door.canopy, canopyPosts: door.canopyPosts, mailbox: door.mailbox ?? 'metal_dark', double: door.double };
  const winFront = o.winFront || win, winBack = o.winBack || win, winSide = o.winSide || { ...win, shutters: null, w: Math.min(win.w, 1.0 * M) };
  for (let f = 0; f < floors; f++) {
    const yb = floorY(f) + sillH;
    for (const u of usFront) {
      if (f === 0) {
        if (o.frontGround) continue;
        if (!o.noDoor && doorReplaces && Math.abs(u - doorU) < 0.05 * M) continue;
        if (!o.noDoor && !doorReplaces && Math.abs(u - doorU) < doorW / 2 + winFront.w / 2 + 0.2 * M) continue;
      }
      ops.front.push({ ...winFront, u, y: yb });
    }
    usBack.forEach((u, i) => {
      if (f === 0 && o.terraceDoor !== false && i === (o.terraceBay ?? 0)) {
        ops.back.push({ ...winBack, kind: 'win', u, y: floorY(0) + 0.05 * M, w: Math.max(winBack.w, 1.6 * M), h: 2.2 * M, panes: { cols: 2 }, sill: null, shutters: null, flowers: null });
      } else ops.back.push({ ...winBack, u, y: yb });
    });
    for (const s of ['left', 'right']) {
      if (party.includes(s)) continue;
      if (o.sideWindows === false) continue;
      for (const u of usSide) ops[s].push({ ...winSide, u, y: yb });
    }
  }
  if (!o.noDoor) ops.front.push(doorOp);
  if (o.frontGround) for (const op of o.frontGround) ops.front.push(op);
  if (o.extraOps) for (const s of Object.keys(o.extraOps)) ops[s].push(...o.extraOps[s]);
  // Wände (bei Pultdach mit schrägen Seitenwänden)
  let shedInfo = null;
  const sides = {};
  for (const s of ['front', 'back', 'left', 'right']) sides[s] = { ops: ops[s] };
  if (rt === 'shed') {
    const tan = Math.tan(((roof.pitch ?? 10) * Math.PI) / 180);
    const hiFront = roof.hi === 'front';
    const yF = hiFront ? yEave + o.d * tan : yEave, yB = hiFront ? yEave : yEave + o.d * tan;
    const hAt = (z) => yB + ((z + o.d / 2) / o.d) * (yF - yB);
    sides.front.outer = [[-o.w / 2, 0], [o.w / 2, 0], [o.w / 2, yF], [-o.w / 2, yF]];
    sides.back.outer = [[-o.w / 2, 0], [o.w / 2, 0], [o.w / 2, yB], [-o.w / 2, yB]];
    // links: u = +z, rechts: u = -z
    sides.left.outer = [[-o.d / 2, 0], [o.d / 2, 0], [o.d / 2, hAt(o.d / 2)], [-o.d / 2, hAt(-o.d / 2)]];
    sides.right.outer = [[-o.d / 2, 0], [o.d / 2, 0], [o.d / 2, hAt(-o.d / 2)], [-o.d / 2, hAt(o.d / 2)]];
    m.y1 = Math.max(yF, yB);
  }
  const gableRoof = rt === 'gable' || rt === 'gableF' || rt === 'halfhip';
  const gableSides = gableRoof ? (ridgeX ? ['left', 'right'] : ['back', 'front']) : [];
  massWalls(g, m, sides, { reveal: o.reveal, skip: gableSides });
  // Sockel
  if (pl > 0.05 * M) band(g, o.plinthMat || 'stone_grey', m, 0, pl, 0.04 * M, { skip: F.BOTTOM });
  if (o.floorBand && floors > 1 && D >= 1) for (let f = 1; f < floors; f++) band(g, trim, m, floorY(f) - 0.08 * M, 0.16 * M, 0.05 * M);
  if (o.quoins && D >= 2) for (const s of ['front', 'left', 'right']) quoins(g, mframe(m.cx, m.cz, m.sx, m.sz, s), o.quoins, pl, yEave - 0.1 * M);
  if (o.pilasters && D >= 1) pilasters(g, mframe(m.cx, m.cz, m.sx, m.sz, 'front'), o.pilasters, [-o.w / 2 + 0.2 * M, o.w / 2 - 0.2 * M], pl, yEave);
  if (o.timber && D >= 1) timber(g, m, ops, { pl, FH, floors, knee, mat: o.timber, party, braces: true });
  // Dach
  const roofMat = roof.mat || 'roof_tiles_red';
  const under = roof.under || (rt === 'flat' ? null : rpick(rng, ['wood_planks', 'paint_white', 'wood_dark']));
  const edge = roof.edge || under;
  let info = null, top = yEave;
  const gableOps = { lo: [], hi: [] };
  if (rt === 'gable' || rt === 'gableF' || rt === 'halfhip') {
    // Fenster im Giebel (Dachgeschoss)
    const pitch = roof.pitch ?? 42;
    const span = ridgeX ? o.d : o.w;
    const tan = Math.tan((pitch * Math.PI) / 180);
    const yA = floorY(floors) + (knee > 0.5 * M ? 0.25 * M : 0.6 * M);
    const k = rt === 'halfhip' ? (roof.k ?? 0.35) : 0;
    const gw = o.gableWin || { ...win, shutters: null, flowers: null, h: Math.min(win.h, 1.25 * M) };
    const halfAt = (y) => span / 2 - (y - yEave) / tan;
    const maxY = yEave + (span / 2) * tan * (1 - k);
    const cand = span > 7.5 * M ? [-span * 0.2, span * 0.2] : [0];
    for (const end of ['lo', 'hi']) {
      const gSide = ridgeX ? (end === 'hi' ? 'right' : 'left') : (end === 'hi' ? 'front' : 'back');
      gableOps[end].push(...ops[gSide]);
      if (party.includes(gSide)) continue;
      const yTopW = yA + gw.h;
      if (yTopW > maxY - 0.1 * M) continue;
      for (const u of cand) if (Math.abs(u) + gw.w / 2 < halfAt(yTopW) - 0.25 * M) gableOps[end].push({ ...gw, u, y: yA });
      // kleines Spitzbodenfenster
      const yS = yA + gw.h + 0.9 * M;
      if (rt !== 'halfhip' && yS + 0.6 * M < maxY - 0.2 * M && halfAt(yS + 0.6 * M) > 0.6 * M && o.atticTop !== false) gableOps[end].push({ kind: 'win', u: 0, y: yS, w: 0.6 * M, h: 0.6 * M, frame: gw.frame, panes: { cols: 1 }, sill: null });
      if (o.gableBalcony && end === 'hi' && !ridgeX) gableOps[end].length = 0;
    }
    if (o.gableOps) for (const e of ['lo', 'hi']) if (o.gableOps[e]) gableOps[e].push(...o.gableOps[e]);
    info = rectRoof(g, { cx: m.cx, cz: m.cz, sx: o.w, sz: o.d, y0: yEave, pitch, ridge: ridgeX ? 'x' : 'z', mat: roofMat, under, edge, wall: wallMat, eave: roof.eave ?? 0.5 * M, verge: roof.verge ?? 0.35 * M, verge0: roof.verge0, verge1: roof.verge1, k, k0: roof.k0, k1: roof.k1, gable: gableOps, wallBase: 0, t: roof.t, gutter: roof.gutter });
    top = info.yR;
  } else if (rt === 'hip' || rt === 'pyramid') {
    info = rectRoof(g, { cx: m.cx, cz: m.cz, sx: o.w, sz: o.d, y0: yEave, pitch: roof.pitch ?? (rt === 'pyramid' ? 24 : 28), ridge: o.w >= o.d ? 'x' : 'z', mat: roofMat, under, edge, k: 1, eave: roof.eave ?? 0.6 * M, t: roof.t, gutter: roof.gutter });
    top = info.yR;
  } else if (rt === 'flat') {
    top = flatRoof(g, m, yEave, { mat: roof.mat || 'roof_flat_gravel', wall: roof.parapetMat || wallMat, parapet: roof.parapet ?? 0.5 * M, coping: roof.coping });
  } else if (rt === 'shed') {
    shedInfo = shedRoof(g, { cx: m.cx, cz: m.cz, sx: o.w, sz: o.d, y0: yEave, pitch: roof.pitch ?? 10, hi: roof.hi || 'back', mat: roofMat, under: under || 'wood_planks', edge: edge || 'trim_dark', eave: roof.eave ?? 0.6 * M, verge: roof.verge ?? 0.5 * M });
    top = shedInfo.yHi + 0.3 * M;
  } else if (rt === 'mansard') {
    band(g, trim, m, yEave - 0.25 * M, 0.25 * M, 0.12 * M);
    const mi = mansardRoof(g, { cx: m.cx, cz: m.cz, sx: o.w, sz: o.d, y0: yEave, mat: roofMat, hm: roof.hm ?? 2.5 * M, under: trim, edge: trim, kink: roof.kink });
    for (const u of usFront) mansardDormer(g, mi, 'front', u, { wall: trim, frame: win.frame, w: Math.min(1.3 * M, win.w + 0.2 * M), top: roof.dormerTop });
    for (const u of usBack) mansardDormer(g, mi, 'back', u, { wall: trim, frame: win.frame, w: Math.min(1.3 * M, win.w + 0.2 * M) });
    top = mi.yT;
    info = null;
  }
  // Gauben, Dachfenster, Solar, Schornstein
  if (info && D >= 1) {
    const dm = o.dormers;
    if (dm && dm.n) {
      const xs = dm.n === 1 ? [dm.at ?? 0] : bays(ridgeX ? o.w : o.d, dm.n, 1.2 * M);
      const sidesD = dm.side === 'both' ? [1, -1] : dm.side === 'back' ? [-1] : [1];
      const along = ridgeX ? 1 : -1;
      for (const s of sidesD) for (const X of xs) dormer(g, info, s, X * along, { type: dm.type || 'gable', w: dm.w ?? 1.8 * M, wall: dm.wall || wallMat, clad: dm.clad || (dm.type === 'shed' ? 'roof_slate' : wallMat), cheek: dm.cheek, frame: win.frame, mat: dm.mat || roofMat, under, edge, winH: dm.winH });
    }
    if (o.roofWindows) for (let k = 0; k < o.roofWindows; k++) roofWindow(g, info, -1, (k - (o.roofWindows - 1) / 2) * 1.8 * M, 0.9 * M);
    if (o.solar) solarField(g, info, o.solar.side ?? -1, o.solar.x ?? 0, o.solar.dist ?? 0.6 * M, o.solar.w ?? Math.min((ridgeX ? o.w : o.d) - 2 * M, 5 * M), o.solar.h ?? 2.2 * M);
  }
  if (o.chimney && info) {
    const cxL = o.chimney.x ?? ((ridgeX ? o.w : o.d) * 0.22), czL = o.chimney.z ?? -info.b * 0.25;
    chimney(g, info, cxL, czL, { mat: o.chimney.mat });
  } else if (o.chimney && (rt === 'flat' || rt === 'shed') && D >= 0) {
    g.box(o.chimney.mat || 'metal_light', m.cx + o.w * 0.3, top - 0.3 * M, m.cz - o.d * 0.25, 0.35 * M, 1.2 * M, 0.35 * M, { skip: F.BOTTOM });
  }
  // Zwerchgiebel an der Front
  if (o.cross && (rt === 'gable' || rt === 'halfhip' || rt === 'hip') && ridgeX) crossGable(g, o, m, info, yEave, floorY, win, wallMat, roofMat, under, edge);
  // Veranda / Vordach über die Front
  if (o.porch) porch(g, m, o.porch, pl, doorU);
  if (o.balconyFront && D >= 1) {
    const bf = mframe(m.cx, m.cz, m.sx, m.sz, 'front');
    for (const u of o.balconyFront.us || [doorU]) balcony(g, bf, u, floorY(1), o.balconyFront.w ?? 2.6 * M, o.balconyFront.d ?? 1.2 * M, { slab: o.balconyFront.slab || 'concrete', rail: o.balconyFront.rail || 'metal_dark', type: o.balconyFront.type || 'bars', plants: 'leaves_green' });
  }
  return { info, top, yEave, m, doorU, pl, FH, floorY, shedInfo };
}

// Zwerchgiebel (Querhaus) in der Frontmitte
function crossGable(g, o, m, info, yEave, floorY, win, wallMat, roofMat, under, edge) {
  const c = o.cross;
  const w = c.w ?? Math.min(o.w * 0.42, 3.8 * M), out = c.out ?? 0.6 * M;
  const pitch = c.pitch ?? 45;
  const extra = c.up ?? 1.4 * M; // Wand höher als Traufe
  const yTop = yEave + extra;
  // Baukörper von der Front nach innen bis unter den First
  const depth = out + info.b;
  const cz = m.cz + o.d / 2 + out - depth / 2;
  const cx = m.cx + (c.u ?? 0);
  const mm = { cx, cz, sx: w, sz: depth, y0: 0, y1: yTop, wall: wallMat };
  const fl = o.floors ?? 1;
  const ops = [];
  for (let f = 0; f < fl; f++) if (f > 0 || out > 0.1 * M) ops.push({ ...win, u: 0, y: floorY(f) + 0.9 * M, w: Math.min(win.w * 1.3, w - 1.0 * M), panes: { cols: 2, transom: 0.2 } });
  if (out > 0.1 * M) massWalls(g, mm, { left: [], right: [] }, { skip: ['back', 'front'] });
  else massWalls(g, { ...mm, y0: yEave - 0.05 * M }, { left: [], right: [] }, { skip: ['back', 'front'] });
  if (o.plinth > 0.05 * M && out > 0.1 * M) band(g, o.plinthMat || 'stone_grey', { ...mm }, 0, o.plinth, 0.04 * M, { sides: ['front', 'left', 'right'], skip: F.BOTTOM });
  const yA = Math.max(floorY(fl) + 0.3 * M, out > 0.1 * M ? 0 : yEave + 0.15 * M);
  const gw = Math.min(win.w * 1.4, w - 1.4 * M);
  const gh = Math.min(1.3 * M, (w / 2) * Math.tan((pitch * Math.PI) / 180) * 0.7 + (yTop - yA) - 0.3 * M);
  const gOps = { hi: [...(out > 0.1 * M ? ops : []), { ...win, u: 0, y: yA, w: gw, h: gh, panes: { cols: 2 }, shutters: null, flowers: null }] };
  if (c.balcony && g.detail >= 1) {
    gOps.hi[gOps.hi.length - 1] = { ...win, kind: 'win', u: 0, y: floorY(fl) + 0.05 * M, w: gw, h: Math.min(2.1 * M, yTop + 0.6 * M - floorY(fl)), panes: { cols: 2 }, sill: null, shutters: null };
  }
  rectRoof(g, { cx, cz, sx: w, sz: depth, y0: yTop, pitch, ridge: 'z', mat: roofMat, under, edge, wall: wallMat, eave: 0.35 * M, verge: 0.3 * M, k0: 0, k1: 0, gable: gOps, wallBase: { hi: out > 0.1 * M ? 0 : yEave - 0.05 * M }, gutter: null });
  if (c.balcony && g.detail >= 1) {
    const f = mframe(cx, cz, w, depth, 'front');
    balcony(g, f, 0, floorY(fl), w + 0.2 * M, 1.1 * M, { slab: 'concrete', rail: c.rail || 'metal_dark', type: 'bars' });
  }
}

// Veranda / überdachter Eingangsbereich entlang der Front
function porch(g, m, p, pl, doorU) {
  const D = g.detail;
  const w = p.w ?? m.sx * 0.6, dep = p.d ?? 1.8 * M, h = p.h ?? 2.7 * M;
  const u = p.u ?? doorU;
  const z = m.cz + m.sz / 2;
  g.box(p.floor || 'wood_planks', m.cx + u, 0, z + dep / 2, w, pl, dep, { skip: NB });
  const post = p.post || 'paint_white';
  const n = Math.max(2, Math.round(w / (2.2 * M)) + 1);
  if (D >= 1) for (let k = 0; k < n; k++) g.box(post, m.cx + u - w / 2 + 0.1 * M + ((w - 0.2 * M) * k) / (n - 1), pl, z + dep - 0.12 * M, 0.14 * M, h - pl, 0.14 * M, { skip: F.TOP | F.BOTTOM });
  // Pultdach
  const tan = 0.3;
  const y0 = h, y1 = h + dep * tan;
  const P = (x, y, zz) => [m.cx + u + x, y, z + zz];
  g.quad(p.roof || 'roof_metal_grey', P(-w / 2 - 0.15 * M, y0, dep + 0.2 * M), P(w / 2 + 0.15 * M, y0, dep + 0.2 * M), P(w / 2 + 0.15 * M, y1, 0), P(-w / 2 - 0.15 * M, y1, 0), 0, [0, 1, 0.3]);
  g.quad(p.under || 'wood_planks', P(-w / 2 - 0.15 * M, y0 - 0.1 * M, dep + 0.2 * M), P(-w / 2 - 0.15 * M, y1 - 0.1 * M, 0), P(w / 2 + 0.15 * M, y1 - 0.1 * M, 0), P(w / 2 + 0.15 * M, y0 - 0.1 * M, dep + 0.2 * M), 0, [0, -1, 0]);
  g.box(post, m.cx + u, y0 - 0.1 * M, z + dep + 0.15 * M, w + 0.3 * M, 0.12 * M, 0.08 * M);
  if (D >= 2 && p.rail) {
    for (const s of [-1, 1]) g.box(post, m.cx + u + s * (w / 2 - 0.05 * M), pl, z + dep / 2, 0.06 * M, 0.9 * M, dep - 0.2 * M, { skip: NB });
  }
}

// Fachwerk: dunkle Balken auf den Wänden (Schwelle, Rähm, Ständer neben Fenstern, Streben)
export function timber(g, m, ops, o) {
  const { pl, FH, floors, knee, mat, party } = o;
  const t = 0.03 * M, bw = 0.18 * M;
  for (const side of ['front', 'back', 'left', 'right']) {
    if (party && party.includes(side)) continue;
    const f = mframe(m.cx, m.cz, m.sx, m.sz, side);
    const L = f.len;
    const tops = [];
    for (let fl = 0; fl < floors; fl++) {
      const y0 = pl + fl * FH, y1 = fl === floors - 1 ? pl + floors * FH + knee - 0.07 * M : y0 + FH;
      tops.push(y1);
      g.wbox(mat, f, 0, y0, t / 2, L, bw, t, { skip: F.BACK | F.BOTTOM });
      // Ständer: Ecken + neben jedem Fenster dieses Geschosses
      const posts = [-L / 2 + bw / 2, L / 2 - bw / 2];
      const wins = ops[side].filter((op) => op.y >= y0 && op.y < y1 && (op.kind === 'win' || op.kind === 'door'));
      for (const op of wins) { posts.push(op.u - op.w / 2 - bw / 2 - 0.02 * M, op.u + op.w / 2 + bw / 2 + 0.02 * M); }
      posts.sort((a, b) => a - b);
      const ps = posts.filter((p, i) => i === 0 || p - posts[i - 1] > bw * 1.5);
      for (const p of ps) g.wbox(mat, f, p, y0 + bw, t / 2, bw, y1 - y0 - bw * 2, t, { skip: F.BACK | F.BOTTOM | F.TOP });
      // Riegel unter/über Fenstern
      for (const op of wins) {
        if (op.kind === 'win') g.wbox(mat, f, op.u, op.y - bw - 0.04 * M, t / 2, op.w + bw * 2, bw * 0.8, t, { skip: F.BACK });
        g.wbox(mat, f, op.u, op.y + op.h + 0.04 * M, t / 2, op.w + bw * 2, bw * 0.8, t, { skip: F.BACK });
      }
      // Streben in freien Feldern (zwischen Ständern ohne Fenster)
      if (o.braces && g.detail >= 1) {
        for (let i = 0; i + 1 < ps.length; i++) {
          const a = ps[i] + bw / 2, b = ps[i + 1] - bw / 2;
          if (b - a < 0.9 * M) continue;
          const mid = (a + b) / 2;
          if (wins.some((op) => Math.abs(op.u - mid) < op.w / 2 + 0.1 * M)) continue;
          const h = y1 - y0 - bw * 2, wdt = b - a;
          const len = Math.hypot(wdt, h), ang = Math.atan2(h, wdt) * ((i + fl) % 2 ? 1 : -1);
          const [x, , z] = [f.ox + f.c * mid + f.s * t, 0, f.oz - f.s * mid + f.c * t];
          g.rbox(mat, x, y0 + bw + h / 2, z, len, bw * 0.85, t, 0, f.ry, ang, { skip: F.BACK });
        }
      }
    }
    g.wbox(mat, f, 0, tops[tops.length - 1] - bw - 0.07 * M, t / 2, L, bw, t, { skip: F.BACK });
  }
}
