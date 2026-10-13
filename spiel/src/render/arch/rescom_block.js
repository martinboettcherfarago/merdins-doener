// Mehrgeschossbau für Wohnen & Gewerbe (Besitzer G3): Werkzeuge für Geschossstapel, Lochfassaden,
// Treppenhausachsen, Eingänge, Plattenfugen, Laubengänge, Staffelgeschosse – und die Wohntypen der Stufen 3–5.
import * as THREE from 'three';
import { M } from './kit.js';
import { F, NB, rr, rpick, chance } from './rescom_geo.js';
import { mframe, massWalls, bays, band, cornice, balcony, railing, erker, pilasters, quoins, rustication, wall as wallImpl } from './rescom_facade.js';
import { rectRoof, dormer, chimney, flatRoof, mansardRoof, mansardDormer, rooftop, flatSolar, satDish } from './rescom_roofs.js';
import { ground, tree, bush, hedge, fence, bins, bikeRack, parkingRow, lamp, bench, planter, play } from './rescom_site.js';
import { PAL } from './rescom_house.js';
import { text, textWidth } from './rescom_signs.js';

// ---------- Werkzeuge
// Geschossstapel: Ebenen y[0..n] (y[n] = Oberkante), gf = Erdgeschosshöhe
export function stack(pl, gf, fh, n) {
  const y = [pl];
  for (let k = 1; k <= n; k++) y.push(y[k - 1] + (k === 1 ? gf : fh));
  return { y, n, top: y[n], fh, gf, pl };
}
// Öffnungen für eine Seite aus einer Vorlage-Funktion fn(floor, bay, u) → op (y relativ zur Geschossebene) | null
export function rows(st, us, fn, from = 0, to = st.n) {
  const ops = [];
  for (let f = from; f < to; f++) us.forEach((u, b) => {
    const op = fn(f, b, u);
    if (!op) return;
    if (Array.isArray(op)) for (const o of op) ops.push({ ...o, y: st.y[f] + (o.y ?? 0) });
    else ops.push({ ...op, u: op.u ?? u, y: st.y[f] + (op.y ?? 0) });
  });
  return ops;
}
// Hauseingang mit Vordach, Lampe, Briefkasten, Stufen; liefert Öffnung
export function entranceOp(o = {}) {
  return { kind: 'door', w: o.w ?? 1.5 * M, h: o.h ?? 2.5 * M, y: 0, mat: o.mat || 'trim_dark', glazed: o.glazed ?? true, double: o.double ?? true, transom: o.transom ?? true, frame: o.frame || 'window_frame_dark', canopy: o.canopy, canopyW: o.canopyW ?? 1.2 * M, canopyD: o.canopyD ?? 1.4 * M, mailbox: o.mailbox ?? 'metal_light', depth: o.depth ?? 0.35 * M };
}
// Plattenfugen (waagrecht je Geschoss, senkrecht je Achse) als flache Leisten
export function panelJoints(g, f, st, us, bayW, o = {}) {
  if (g.detail < 1) return;
  const mat = o.mat || 'concrete_dark', t = 0.012 * M, w = 0.05 * M;
  for (let k = 1; k <= st.n; k++) g.wbox(mat, f, 0, st.y[k] - w / 2, t / 2, f.len, w, t, { skip: F.BACK });
  if (g.detail < 2) return;
  const xs = new Set();
  for (const u of us) { xs.add(+(u - bayW / 2).toFixed(4)); xs.add(+(u + bayW / 2).toFixed(4)); }
  for (const x of xs) if (Math.abs(x) < f.len / 2 - 0.05 * M) g.wbox(mat, f, x, st.y[0], t / 2, w, st.top - st.y[0], t, { skip: F.BACK | F.BOTTOM | F.TOP });
}
// Grundstücksboden für Mehrfamilienhäuser: Vorgarten/Vorplatz + Hof
export function blockGround(g, W, D, front, back, o = {}) {
  ground(g, o.lawn || 'grass', 0, 0, W - 0.04 * M, D - 0.04 * M, 0.03 * M);
  if (front > 0.3 * M) {
    if (o.paved) ground(g, o.paved, 0, D / 2 - front / 2, W - 0.04 * M, front - 0.02 * M, 0.05 * M);
    else if (g.detail >= 1 && o.fence !== false) fence(g, -W / 2 + 0.1 * M, D / 2 - 0.12 * M, W / 2 - 0.1 * M, D / 2 - 0.12 * M, o.fenceType || 'metal', { h: 0.9 * M });
  }
}

// Seitenwände eines Reihenbaus: Brandwand (wenig Fenster) oder volle Fassade
const blank = () => [];

// Brandwand: entweder ein paar nachträglich eingebrochene Fenster (Öffnungen) oder Schmuck (Efeu, alte Wandreklame).
// firewallOps liefert die Öffnungen (vor massWalls), firewallDecor den Schmuck (danach).
export function firewallOps(st, len, rng, kind) {
  if (kind !== 'windows') return [];
  const ops = [];
  const us = len > 9 * M ? [-len * 0.25, len * 0.22] : [len * 0.18];
  for (let f = 1; f < st.n; f++) for (const u of us) if (rng() < 0.8) ops.push(winT({ u, y: st.y[f] + 0.9 * M, w: 0.9 * M, h: 1.2 * M, frame: 'window_frame_white', panes: { cols: 1 }, sill: 'metal_light' }));
  return ops;
}
export const firewallKind = (rng) => rpick(rng, ['windows', 'ivy', 'ghost', 'plain', 'ivy', 'ghost']);
const GHOST = ['SEIFE', 'KAFFEE', 'MALZBIER', 'BRAUEREI', 'SCHOKOLADE', 'TABAK', 'KOLONIALWAREN', 'NÄHMASCHINEN', 'MÖBEL', 'BIER'];
export function firewallDecor(g, f, y0, y1, rng, kind) {
  if (g.detail === 0 || kind === 'windows' || kind === 'plain') return;
  const L = f.len;
  if (kind === 'ivy') {
    // unregelmäßige Efeuflächen vom Boden aufwärts
    const n = 2 + Math.floor(rng() * 2);
    for (let k = 0; k < n; k++) {
      const cu = (rng() - 0.5) * L * 0.6, w = rr(rng, 2.5, 5.0) * M, h = Math.min(y1 - y0 - 0.5 * M, rr(rng, 4, 10) * M);
      const pts = [];
      const seg = 12;
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const r = rr(rng, 0.75, 1.0);
        pts.push([cu + Math.cos(a) * w / 2 * r, y0 + h / 2 + Math.sin(a) * h / 2 * r]);
      }
      const mat = k % 2 ? 'leaves_dark' : 'ivy';
      g.shape2(mat, pts.map(([u, y]) => [u, Math.max(y0, y)]), [], (u, y) => [f.ox + f.c * u + f.s * (0.03 + k * 0.01) * M, y, f.oz - f.s * u + f.c * (0.03 + k * 0.01) * M], [f.s, 0, f.c]);
    }
    return;
  }
  // alte Wandreklame
  const word = rpick(rng, GHOST);
  const w = Math.min(L * 0.8, 9 * M), h = Math.min((y1 - y0) * 0.3, 3.2 * M);
  const yb = y1 - h - rr(rng, 1.0, 2.5) * M;
  const bg = rpick(rng, ['paint_red', 'paint_blue', 'paint_green', 'plaster_ochre', 'trim_dark']);
  g.wquad(bg, f, 0, yb, 0.012 * M, w, h);
  const px = Math.min((w * 0.85) / Math.max(1, textWidth(word)), (h * 0.6) / 5);
  text(g, f, word, 0, yb + (h - 5 * px) / 2, 0.02 * M, px, rpick(rng, ['paint_white', 'plaster_cream', 'paint_yellow']), { depth: 0 });
}

// ---------- Fassaden-Vorlagen
function winT(o) { return { kind: 'win', ...o }; }

// Gründerzeit-Fassade: Öffnungen für die Front
function gzFront(st, us, o) {
  const doorBay = o.doorBay ?? 0;
  return rows(st, us, (f, b) => {
    if (f === 0) {
      if (o.shops) return { kind: 'shop', w: Math.min(o.bay - 0.5 * M, 2.6 * M), h: st.gf - 0.7 * M, y: 0.2 * M, frame: o.shopFrame || 'wood_dark', door: b === doorBay ? 0 : -1, cols: 2 };
      if (b === doorBay) return { ...entranceOp({ mat: 'wood_dark', glazed: false, canopy: null, frame: 'wood_dark', h: 2.8 * M, w: 1.5 * M }), y: 0.05 * M };
      return winT({ w: 1.2 * M, h: 1.8 * M, y: st.gf - 2.4 * M, frame: 'window_frame_white', panes: { cols: 2, transom: 0.28 }, sill: 'trim_stone' });
    }
    const top = f === st.n - 1;
    return winT({ w: 1.2 * M, h: top ? 1.6 * M : 2.0 * M, y: 0.7 * M, frame: o.frame || 'window_frame_white', panes: { cols: 2, transom: 0.28 }, sill: 'trim_stone',
      surround: o.trim, header: f === 1 ? 'tri' : f === 2 ? 'flat' : null, headerMat: o.trim, keystone: f >= 3 && !top ? o.trim : null,
      french: o.french && f === 1 && b !== doorBay ? 'metal_dark' : null });
  });
}

// ---------- Wohntypen Stufe 3–5
// P = { W, D } in Welteinheiten; jede Funktion baut auf g und nutzt ctx.rng

// 3a Gründerzeithaus mit Stuck, Erker, Mansard- oder Satteldach
function gruenderzeit(ctx, g, P, o = {}) {
  const { rng, level } = ctx;
  const { W, D } = P;
  const n = o.floors ?? (level >= 4 ? 5 + (rng() < 0.5 ? 1 : 0) : 4);
  const st = stack(0.5 * M, 3.9 * M, 3.4 * M, n);
  const front = rr(rng, 1.0, 1.8) * M;
  const bw = W - 0.2 * M, bd = Math.min(D - front - 2.0 * M, (D > 1.5 ? 14 : 9.8) * M);
  const cz = D / 2 - front - bd / 2;
  const wall = o.wall || rpick(rng, ['plaster_cream', 'plaster_ochre', 'plaster_pink', 'plaster_blue', 'plaster_yellow', 'plaster_green', 'stone_sandstone', 'plaster_grey', 'plaster_red']);
  const trim = rpick(rng, ['trim_stone', 'plaster_white', 'trim_stone']);
  const m = { cx: 0, cz, sx: bw, sz: bd, y0: 0, y1: st.top, wall };
  const nb = Math.max(3, Math.round(bw / (3.0 * M)));
  const bay = bw / nb;
  const us = bays(bw, nb, 0.3 * M);
  const doorBay = o.shops ? -1 : (nb >= 4 ? Math.floor(nb / 2) - (rng() < 0.5 ? 1 : 0) : 0);
  const fF = mframe(0, cz, bw, bd, 'front');
  const frontOps = gzFront(st, us, { bay, trim, doorBay, shops: o.shops, french: chance(rng, 0.5), shopFrame: o.shopFrame });
  const backUs = bays(bw, Math.max(2, nb - 1), 0.6 * M);
  const backOps = rows(st, backUs, (f) => winT({ w: 1.15 * M, h: f === 0 ? 1.5 * M : 1.7 * M, y: f === 0 ? st.gf - 2.2 * M : 0.75 * M, frame: 'window_frame_white', panes: { cols: 2, transom: 0.25 }, sill: 'metal_light' }));
  // Treppenhaus-Fenster hinten (halbgeschossig versetzt)
  const sideOps = W > 1.5 || o.corner ? rows(st, bays(bd, Math.max(1, Math.round(bd / (3.4 * M))), 0.8 * M), (f) => f === 0 ? null : winT({ w: 1.1 * M, h: 1.8 * M, y: 0.75 * M, frame: 'window_frame_white', panes: { cols: 2, transom: 0.25 }, sill: 'trim_stone', surround: trim })) : [];
  const fwk = [firewallKind(rng), firewallKind(rng)];
  const fwL = o.corner === 'left' ? sideOps : firewallOps(st, bd, rng, fwk[0]), fwR = o.corner === 'right' ? sideOps : firewallOps(st, bd, rng, fwk[1]);
  massWalls(g, m, { front: frontOps, back: backOps, left: fwL, right: fwR });
  if (o.corner !== 'left') firewallDecor(g, mframe(0, cz, bw, bd, 'left'), st.y[1], st.top, rng, fwk[0]);
  if (o.corner !== 'right') firewallDecor(g, mframe(0, cz, bw, bd, 'right'), st.y[1], st.top, rng, fwk[1]);
  // Gliederung: Sockel, Rustika im EG, Gurtgesimse, Traufgesims
  band(g, 'stone_sandstone', m, 0, st.pl + 0.05 * M, 0.05 * M, { skip: F.BOTTOM });
  if (!o.shops) rustication(g, fF, 'trim_dark', st.pl + 0.3 * M, st.y[1] - 0.2 * M, 0.45 * M);
  band(g, trim, m, st.y[1] - 0.15 * M, 0.3 * M, 0.08 * M, { sides: ['front', 'back'] });
  if (n >= 4) band(g, trim, m, st.y[2] - 0.1 * M, 0.16 * M, 0.05 * M, { sides: ['front'] });
  const wide = W > 1.5;
  cornice(g, trim, m, st.top - 0.4 * M, 1.2, { dentils: !wide, sides: ['front', 'back'] });
  if (g.detail >= 2 && !wide) quoins(g, fF, trim, st.y[1], st.top - 0.4 * M);
  if (g.detail >= 1 && o.lisenen !== false) pilasters(g, fF, trim, [-bw / 2 + 0.25 * M, bw / 2 - 0.25 * M], st.y[1], st.top - 0.4 * M, 0.4 * M, 0.05 * M);
  // Erker / Balkone
  if (g.detail >= 1) {
    const erkers = o.erker ?? (nb >= 4 ? (W > 1.5 ? 2 : 1) : (chance(rng, 0.6) ? 1 : 0));
    const eBays = erkers === 1 ? [us[Math.floor(nb / 2)]] : erkers === 2 ? [us[0] * 0.55, us[nb - 1] * 0.55] : [];
    for (const u of eBays) {
      erker(g, fF, u, st.y[1] + 0.1 * M, st.y[n - 1] + 0.1 * M, 3.0 * M, 0.9 * M, {
        wall, trim, top: chance(rng, 0.6) ? 'balcony' : 'cap',
        rows: st.y.slice(1, n - 1).map((y) => ({ y: y + 0.75 * M, h: 1.9 * M })), win: { frame: 'window_frame_white', panes: { cols: 2, transom: 0.28 }, sill: null },
      });
    }
    // Balkone an den übrigen Achsen
    for (const [i, u] of us.entries()) {
      if (eBays.some((e) => Math.abs(e - u) < 1.6 * M)) continue;
      if (i === doorBay && chance(rng, 0.5)) continue;
      if (chance(rng, wide ? 0.3 : 0.45)) for (let f = 2; f < n; f += 1 + (rng() < 0.5 ? 1 : 0)) balcony(g, fF, u, st.y[f], 1.9 * M, 0.85 * M, { slab: trim, rail: wide ? trim : 'metal_dark', type: wide ? 'solid' : 'bars', railH: wide ? 0.8 * M : 1.0 * M });
    }
    // Hinten: Balkonturm
    const fB = mframe(0, cz, bw, bd, 'back');
    for (let f = 1; f < n; f++) balcony(g, fB, backUs[backUs.length - 1] * 0.0 + (W > 1.5 ? -bw * 0.25 : 0), st.y[f], 3.0 * M, 1.5 * M, { slab: 'concrete', rail: 'metal_dark', type: 'bars' });
  }
  // Dach
  const roofT = o.roof || (chance(rng, 0.55) ? 'mansard' : 'gable');
  const roofMat = roofT === 'mansard' ? rpick(rng, ['roof_slate', 'roof_tiles_anthracite', 'roof_slate']) : rpick(rng, ['roof_tiles_red', 'roof_tiles_brown', 'roof_slate', 'roof_tiles_anthracite']);
  if (roofT === 'mansard') {
    const mi = mansardRoof(g, { cx: 0, cz, sx: bw, sz: bd, y0: st.top, mat: roofMat, hm: 2.8 * M, under: trim, edge: trim });
    for (const u of us) mansardDormer(g, mi, 'front', u, { wall: trim, w: 1.4 * M, top: chance(rng, 0.5) ? 'tri' : 'flat' });
    for (const u of backUs) mansardDormer(g, mi, 'back', u, { wall: 'plaster_white', w: 1.3 * M });
    if (g.detail >= 1) for (const sx of [-1, 1]) g.box('chimney_brick', sx * (bw / 2 - 0.5 * M), mi.yB - 0.2 * M, cz - bd * 0.1, 0.7 * M, 1.4 * M, 0.5 * M, { skip: F.BOTTOM });
  } else {
    const info = rectRoof(g, { cx: 0, cz, sx: bw, sz: bd, y0: st.top, pitch: rr(rng, 38, 46), ridge: 'x', mat: roofMat, under: trim, edge: trim, wall, eave: 0.25 * M, verge: 0.001 * M, t: 0.3 * M });
    if (g.detail >= 1) {
      for (const X of bays(bw, Math.max(2, nb - 1), 1.0 * M)) dormer(g, info, 1, X, { type: rpick(rng, ['gable', 'flat']), w: 1.6 * M, wall: 'plaster_white', clad: trim, mat: roofMat });
      for (const X of bays(bw, Math.max(1, nb - 2), 1.2 * M)) dormer(g, info, -1, X, { type: 'shed', w: 2.2 * M, clad: 'roof_slate', mat: roofMat });
    }
    for (const sx of [-1, 1]) chimney(g, info, sx * (bw / 2 - 0.4 * M), -0.2 * M, { w: 0.9 * M, d: 0.5 * M });
  }
  // Grundstück
  blockGround(g, W, D, front, 0, { fenceType: 'metal' });
  if (front > 0.5 * M && g.detail >= 1 && !o.shops) {
    for (const u of us) if (Math.abs(u - (us[doorBay] ?? 99)) > 1 * M) bush(g, u, D / 2 - front / 2, 0.9, rpick(rng, ['hedge', 'leaves_green']));
  }
  if (!o.shops && doorBay >= 0) ground(g, 'pavers', us[doorBay], D / 2 - front / 2, 1.6 * M, front, 0.05 * M);
  backyard(g, W, D, cz - bd / 2, rng);
  return { st, m, cz, bw, bd };
}

// Hinterhof: Pflaster, Fahrräder, Mülltonnen, Baum, Teppichstange
function backyard(g, W, D, zEdge, rng, o = {}) {
  const depth = zEdge + D / 2;
  if (depth < 0.8 * M) return;
  const zc = -D / 2 + depth / 2;
  ground(g, o.mat || rpick(rng, ['pavers', 'grass', 'gravel']), 0, zc, W - 0.1 * M, depth - 0.1 * M, 0.04 * M);
  if (g.detail < 1) return;
  if (depth > 2.5 * M) tree(g, W * rr(rng, -0.3, 0.3), -D / 2 + depth * 0.45, rr(rng, 0.8, 1.1));
  bins(g, -W / 2 + 1.4 * M, -D / 2 + 0.7 * M, 4);
  bikeRack(g, W / 2 - 2.0 * M, zEdge - 0.8 * M, 5);
  if (o.wall !== false) fence(g, -W / 2 + 0.1 * M, -D / 2 + 0.15 * M, W / 2 - 0.1 * M, -D / 2 + 0.15 * M, 'wall', { h: 1.8 * M, mat: 'brick_red' });
}

// 3b Backstein-Altbau (hanseatisch): Klinker, weiße Sprossenfenster, Segmentbögen, Zwerchhaus
function backstein(ctx, g, P) {
  const { rng, level } = ctx;
  const { W, D } = P;
  const n = level >= 4 ? 5 : 4;
  const st = stack(0.6 * M, 3.4 * M, 3.1 * M, n);
  const front = rr(rng, 1.2, 2.2) * M;
  const bw = W - 0.2 * M, bd = Math.min(D - front - 2.2 * M, (D > 1.5 ? 13 : 9.5) * M);
  const cz = D / 2 - front - bd / 2;
  const wall = rpick(rng, ['brick_red', 'brick_brown', 'brick_dark', 'brick_red', 'brick_yellow']);
  const trim = wall === 'brick_yellow' ? 'brick_red' : rpick(rng, ['trim_stone', 'brick_dark', 'plaster_white']);
  const m = { cx: 0, cz, sx: bw, sz: bd, y0: 0, y1: st.top, wall };
  const nb = Math.max(3, Math.round(bw / (2.6 * M)));
  const us = bays(bw, nb, 0.4 * M);
  const doorBay = nb % 2 ? (nb - 1) / 2 : 0;
  const fF = mframe(0, cz, bw, bd, 'front');
  const frontOps = rows(st, us, (f, b) => {
    if (f === 0 && b === doorBay) return { ...entranceOp({ mat: rpick(rng, ['paint_green', 'wood_dark', 'paint_blue', 'paint_red']), glazed: false, canopy: null, frame: 'window_frame_white', h: 2.6 * M, w: 1.3 * M, double: true }), y: 0.05 * M };
    return winT({ w: 1.1 * M, h: f === 0 ? 1.6 * M : 1.75 * M, y: f === 0 ? 1.0 * M : 0.75 * M, frame: 'window_frame_white', panes: { cols: 2, rows: 2, transom: 0.25 }, sill: 'trim_stone', header: 'seg', headerMat: trim });
  });
  const backOps = rows(st, bays(bw, nb, 0.5 * M), () => winT({ w: 1.1 * M, h: 1.6 * M, y: 0.8 * M, frame: 'window_frame_white', panes: { cols: 2, transom: 0.25 }, sill: 'metal_light' }));
  const fwk = [firewallKind(rng), firewallKind(rng)];
  massWalls(g, m, { front: frontOps, back: backOps, left: firewallOps(st, bd, rng, fwk[0]), right: firewallOps(st, bd, rng, fwk[1]) });
  firewallDecor(g, mframe(0, cz, bw, bd, 'left'), st.y[1], st.top, rng, fwk[0]);
  firewallDecor(g, mframe(0, cz, bw, bd, 'right'), st.y[1], st.top, rng, fwk[1]);
  band(g, 'stone_dark', m, 0, st.pl, 0.05 * M, { skip: F.BOTTOM });
  for (let k = 1; k < n; k++) band(g, trim, m, st.y[k] - 0.12 * M, 0.14 * M, 0.04 * M, { sides: ['front'] });
  cornice(g, trim, m, st.top - 0.35 * M, 0.9, { sides: ['front', 'back'] });
  // Zwerchhaus mit Treppengiebel über der Mitte
  const info = rectRoof(g, { cx: 0, cz, sx: bw, sz: bd, y0: st.top, pitch: rr(rng, 44, 50), ridge: 'x', mat: rpick(rng, ['roof_tiles_red', 'roof_tiles_anthracite', 'roof_tiles_brown']), under: 'wood_dark', edge: 'trim_dark', wall, eave: 0.25 * M, verge: 0.001 * M });
  const zw = Math.min(4.2 * M, bw * 0.4);
  if (g.detail >= 1) {
    const zh = 3.2 * M;
    const zf = mframe(0, cz + bd / 2 - 0.4 * M, zw, 0.8 * M, 'front');
    const ops = [winT({ u: 0, y: st.top + 0.4 * M, w: 1.4 * M, h: 1.6 * M, frame: 'window_frame_white', panes: { cols: 2, rows: 2 }, sill: 'trim_stone' })];
    // Treppengiebel als gestufte Wand
    const steps = 3, sw = zw / 2 / steps;
    const outer = [[-zw / 2, st.top - 0.4 * M], [zw / 2, st.top - 0.4 * M]];
    for (let k = 0; k < steps; k++) { outer.push([zw / 2 - k * sw, st.top + zh * (k + 1) / steps]); outer.push([zw / 2 - (k + 1) * sw, st.top + zh * (k + 1) / steps]); }
    outer.pop();
    outer.push([0, st.top + zh + 0.6 * M]);
    for (let k = steps - 1; k >= 0; k--) { outer.push([-zw / 2 + (k + 1) * sw, st.top + zh * (k + 1) / steps]); outer.push([-zw / 2 + k * sw, st.top + zh * (k + 1) / steps]); }
    outer.splice(outer.length - 1, 1);
    wallImpl(g, zf, wall, st.top - 0.4 * M, st.top + zh + 0.6 * M, ops, { outer });
    // Seiten + Dach des Zwerchhauses
    const zm = { cx: 0, cz: cz + bd / 2 - 1.6 * M, sx: zw - 0.1 * M, sz: 2.4 * M, y0: st.top - 0.4 * M, y1: st.top + zh * 0.6, wall };
    massWalls(g, zm, {}, { skip: ['front', 'back'] });
    rectRoof(g, { cx: 0, cz: zm.cz, sx: zw - 0.1 * M, sz: 2.6 * M, y0: zm.y1, pitch: 48, ridge: 'z', mat: info.mat, under: 'wood_dark', edge: 'trim_dark', t: 0.15 * M, eave: 0.05 * M, verge: 0.05 * M, gutter: null });
  }
  for (const sx of [-1, 1]) chimney(g, info, sx * (bw / 2 - 0.4 * M), -0.3 * M, { w: 0.8 * M });
  if (g.detail >= 1) for (const X of [-bw * 0.32, bw * 0.32]) dormer(g, info, -1, X, { type: 'shed', w: 2.0 * M, clad: 'roof_slate' });
  blockGround(g, W, D, front, 0, { fenceType: 'wall' });
  ground(g, 'pavers', us[doorBay], D / 2 - front / 2, 1.5 * M, front, 0.05 * M);
  if (g.detail >= 1) for (const u of us) if (u !== us[doorBay]) bush(g, u, D / 2 - front * 0.55, 0.8, 'hedge');
  backyard(g, W, D, cz - bd / 2, rng, { mat: 'grass' });
}

// 3c Nachkriegs-Zeilenbau: schlicht, Treppenhausachse, Balkone mit farbigen Brüstungen, flaches Satteldach
function nachkrieg(ctx, g, P) {
  const { rng, level } = ctx;
  const { W, D } = P;
  const n = level >= 4 ? 5 : 4;
  const st = stack(0.7 * M, 2.8 * M, 2.8 * M, n);
  const front = rr(rng, 2.0, 3.0) * M;
  const bw = W - 0.6 * M, bd = Math.min(D - front - 2.5 * M, (D > 1.5 ? 12 : 9.5) * M);
  const cz = D / 2 - front - bd / 2;
  const wall = rpick(rng, ['plaster_cream', 'plaster_yellow', 'plaster_pink', 'plaster_green', 'plaster_blue', 'plaster_white', 'plaster_ochre']);
  const m = { cx: 0, cz, sx: bw, sz: bd, y0: 0, y1: st.top, wall };
  const nb = Math.max(3, Math.round(bw / (2.5 * M)));
  const us = bays(bw, nb, 0.4 * M);
  const stairs = W > 1.5 ? [Math.floor(nb / 4), Math.floor((3 * nb) / 4)] : [Math.floor(nb / 2)];
  const fr = rpick(rng, ['window_frame_white', 'window_frame_wood']);
  const fF = mframe(0, cz, bw, bd, 'front');
  const frontOps = rows(st, us, (f, b) => {
    if (stairs.includes(b)) {
      if (f === 0) return { ...entranceOp({ mat: 'trim_dark', canopy: 'concrete', canopyW: 0.9 * M, frame: 'window_frame_dark', h: 2.3 * M, w: 1.2 * M, double: false, depth: 0.25 * M }), y: -0.65 * M };
      return winT({ w: 0.9 * M, h: 1.3 * M, y: -st.fh * 0.5 + 1.0 * M, frame: fr, panes: { cols: 1, rows: 2 }, sill: 'metal_light' });
    }
    return winT({ w: 1.25 * M, h: 1.35 * M, y: 0.9 * M, frame: fr, panes: { cols: 2 }, sill: 'metal_light' });
  });
  const backBal = bays(bw, W > 1.5 ? 4 : 2, 0.8 * M);
  const backOps = rows(st, us, (f, b, u) => {
    const nearBal = backBal.some((x) => Math.abs(x - u) < 1.3 * M);
    if (nearBal) return winT({ w: 0.95 * M, h: 2.15 * M, y: 0.05 * M, frame: fr, panes: { cols: 1, transom: 0.2 }, sill: null });
    return winT({ w: 1.25 * M, h: 1.35 * M, y: 0.9 * M, frame: fr, panes: { cols: 2 }, sill: 'metal_light' });
  });
  const sideOps = rows(st, bays(bd, 2, 1.2 * M), () => winT({ w: 0.8 * M, h: 1.0 * M, y: 1.1 * M, frame: fr, panes: { cols: 1 }, sill: 'metal_light' }));
  massWalls(g, m, { front: frontOps, back: backOps, left: sideOps, right: sideOps });
  band(g, 'plaster_grey', m, 0, st.pl, 0.04 * M, { skip: F.BOTTOM });
  const fB = mframe(0, cz, bw, bd, 'back');
  const panel = rpick(rng, ['paint_yellow', 'paint_red', 'paint_blue', 'paint_green', 'paint_white', 'paint_orange']);
  if (g.detail >= 1) {
    for (const u of backBal) for (let f = 1; f < n; f++) balcony(g, fB, u, st.y[f], 2.6 * M, 1.3 * M, { slab: 'concrete', rail: panel, type: 'panel' });
  }
  const info = rectRoof(g, { cx: 0, cz, sx: bw, sz: bd, y0: st.top, pitch: rr(rng, 28, 35), ridge: 'x', mat: rpick(rng, ['roof_tiles_red', 'roof_tiles_brown', 'roof_tiles_anthracite']), under: 'paint_white', edge: 'paint_white', wall, eave: 0.4 * M, verge: 0.3 * M, gable: { lo: sideOps.filter(() => false), hi: [] } });
  for (const k of stairs) chimney(g, info, us[k] + 1.2 * M, -0.4 * M, { mat: 'plaster_grey', w: 0.5 * M });
  if (g.detail >= 2 && chance(rng, 0.5)) for (let k = 0; k < 3; k++) satDish(g, fB, us[(k * 2) % nb], st.y[1 + k] + 2.0 * M);
  // Grundstück: Rasen mit Wäschespinne, Weg, Hecke
  blockGround(g, W, D, front, 0, { fence: false });
  for (const k of stairs) ground(g, 'pavers', us[k], D / 2 - front / 2, 1.8 * M, front, 0.05 * M);
  if (g.detail >= 1) {
    hedge(g, 0, D / 2 - 0.4 * M, W - 0.6 * M, 0.5 * M, 0.7 * M);
    bins(g, W / 2 - 1.2 * M, D / 2 - front + 0.5 * M, 4);
    const yd = cz - bd / 2 + D / 2;
    if (yd > 2.0 * M) {
      tree(g, -W * 0.3, -D / 2 + yd * 0.45, 1.0);
      if (W > 1.5) tree(g, W * 0.3, -D / 2 + yd * 0.4, 0.9);
      if (g.detail >= 2) { g.cyl('metal_light', W * 0.05, 0, -D / 2 + yd * 0.5, 0.03 * M, 1.8 * M, { seg: 4, cap: false }); g.cyl('metal_light', W * 0.05, 1.7 * M, -D / 2 + yd * 0.5, 1.0 * M, 0.05 * M, { seg: 8, rTop: 0.9 * M }); }
    }
  }
}

// 3d Modernes Mehrfamilienhaus: bodentiefe Fenster, Loggien, Staffelgeschoss, Holz- oder Metallakzente
function modernMfh(ctx, g, P, o = {}) {
  const { rng, level } = ctx;
  const { W, D } = P;
  const n = o.floors ?? (level >= 4 ? 6 + (rng() < 0.4 ? 1 : 0) : 4);
  const st = stack(0.3 * M, 3.2 * M, 3.05 * M, n);
  const front = rr(rng, 1.5, 2.5) * M;
  const bw = W - 0.4 * M, bd = Math.min(D - front - 2.0 * M, (D > 1.5 ? 14 : 10) * M);
  const cz = D / 2 - front - bd / 2;
  const wall = o.wall || rpick(rng, ['plaster_white', 'plaster_white', 'plaster_grey', 'brick_white', 'brick_dark', 'brick_red', 'concrete_panel']);
  const accent = rpick(rng, ['wood_planks', 'metal_panel_grey', 'wood_dark', 'metal_panel_white', 'brick_dark']);
  const fr = 'window_frame_dark';
  const nb = Math.max(3, Math.round(bw / (2.9 * M)));
  const us = bays(bw, nb, 0.3 * M);
  const loggiaBays = new Set();
  for (let b = 0; b < nb; b++) if ((b + (rng() < 0.5 ? 0 : 1)) % 3 === 1) loggiaBays.add(b);
  const entrBay = Math.floor(nb / 2);
  const m = { cx: 0, cz, sx: bw, sz: bd, y0: 0, y1: st.top, wall };
  const frontOps = rows(st, us, (f, b) => {
    if (f === 0) {
      if (b === entrBay) return { ...entranceOp({ canopy: null, depth: 1.2 * M, w: 1.8 * M, h: 2.7 * M, frame: fr }), y: 0.0 };
      return winT({ w: 1.6 * M, h: 1.6 * M, y: 0.9 * M, frame: fr, panes: { cols: 2, ft: 0.06 * M }, sill: 'metal_light' });
    }
    if (loggiaBays.has(b)) return { kind: 'loggia', w: 2.5 * M, h: st.fh - 0.25 * M, y: 0.05 * M, depth: 1.5 * M, frame: fr, backWall: accent, reveal: accent, parapet: o.glassRail ? 'glass_railing' : wall, rail: chance(rng, 0.5) ? 'bars' : null, plants: chance(rng, 0.4) ? 'leaves_green' : null };
    return winT({ w: 1.3 * M, h: 2.3 * M, y: 0.05 * M, frame: fr, panes: { cols: 2, ft: 0.06 * M }, sill: null, french: 'metal_dark' });
  });
  const backOps = rows(st, us, (f, b) => {
    if (f > 0 && b % 2 === 0) return winT({ w: 1.0 * M, h: 2.3 * M, y: 0.05 * M, frame: fr, panes: { cols: 1 }, sill: null });
    return winT({ w: 1.6 * M, h: 1.5 * M, y: 0.9 * M, frame: fr, panes: { cols: 2, ft: 0.06 * M }, sill: 'metal_light' });
  });
  const sOps = rows(st, bays(bd, Math.max(1, Math.round(bd / (3.6 * M))), 1.0 * M), () => winT({ w: 1.2 * M, h: 1.5 * M, y: 0.9 * M, frame: fr, panes: { cols: 1 }, sill: 'metal_light' }));
  const party = W <= 1.5 && chance(rng, 0.5);
  const fwk = firewallKind(rng);
  massWalls(g, m, { front: frontOps, back: backOps, left: party ? firewallOps(st, bd, rng, fwk) : sOps, right: party ? blank() : sOps });
  if (party) firewallDecor(g, mframe(0, cz, bw, bd, 'left'), st.y[1], st.top, rng, fwk === 'ghost' ? 'ivy' : fwk);
  band(g, 'concrete_dark', m, 0, st.pl, 0.02 * M, { skip: F.BOTTOM });
  const fB = mframe(0, cz, bw, bd, 'back');
  if (g.detail >= 1) for (let f = 1; f < n; f++) for (let b = 0; b < nb; b += 2) balcony(g, fB, us[b], st.y[f], 2.6 * M, 1.6 * M, { slab: 'concrete', rail: rpick(rng, ['metal_dark', 'metal_light']), type: chance(rng, 0.5) ? 'bars' : 'panel', plants: chance(rng, 0.3) ? 'leaves_green' : null });
  // Staffelgeschoss mit Dachterrasse
  const sb = 1.8 * M;
  const sm = { cx: -sb * 0.3, cz: cz - sb * 0.4, sx: bw - sb * 1.6, sz: bd - sb * 1.2, y0: st.top, y1: st.top + 3.0 * M, wall: accent };
  const sUs = bays(sm.sx, Math.max(2, nb - 1), 0.4 * M);
  massWalls(g, sm, { front: sUs.map((u, i) => winT({ u, y: st.top + 0.05 * M, w: i % 2 ? 2.2 * M : 1.2 * M, h: 2.4 * M, frame: fr, panes: { cols: i % 2 ? 2 : 1 }, sill: null })), back: sUs.map((u) => winT({ u, y: st.top + 0.9 * M, w: 1.3 * M, h: 1.4 * M, frame: fr, panes: { cols: 1 } })), left: [], right: [] });
  flatRoof(g, m, st.top, { mat: 'pavers', wall, parapet: 0.25 * M, coping: 'metal_light' });
  if (g.detail >= 1) {
    const fT = mframe(0, cz, bw, bd, 'front');
    railing(g, fT, 0, st.top + 0.25 * M, -0.12 * M, bw - 0.3 * M, 0.85 * M, 'metal_dark', 'bars');
  }
  flatRoof(g, sm, sm.y1, { mat: chance(rng, 0.5) ? 'green_roof' : 'roof_flat_gravel', wall: accent, parapet: 0.3 * M, coping: 'metal_light' });
  if (g.detail >= 1) { planter(g, bw * 0.35, cz + bd / 2 - 0.9 * M); planter(g, -bw * 0.38, cz + bd / 2 - 0.9 * M); }
  if (chance(rng, 0.5)) flatSolar(g, sm.cx, sm.y1 + 0.3 * M, sm.cz, sm.sx * 0.7, sm.sz * 0.6);
  // Grundstück: Vorplatz, Fahrräder, Bänke
  blockGround(g, W, D, front, 0, { paved: 'pavers' });
  if (g.detail >= 1) {
    for (const u of us) if (u !== us[entrBay]) { hedge(g, u, D / 2 - front * 0.5, 1.8 * M, 0.6 * M, 0.6 * M); }
    bikeRack(g, us[entrBay] + 2.2 * M, D / 2 - front * 0.4, 4);
  }
  backyard(g, W, D, cz - bd / 2, rng, { mat: 'grass', wall: false });
  return { st, m, cz };
}

// 3e Laubenganghaus: offene Erschließung vorne, Treppenturm seitlich
function laubengang(ctx, g, P) {
  const { rng, level } = ctx;
  const { W, D } = P;
  const n = level >= 4 ? 6 + (rng() < 0.5 ? 1 : 0) : 4;
  const st = stack(0.3 * M, 3.0 * M, 2.9 * M, n);
  const gal = 1.6 * M; // Laubengangtiefe
  const front = 1.2 * M + gal;
  const tw = 3.2 * M; // Treppenturm
  const bw = W - 0.4 * M - tw, bd = Math.min(D - front - 2.0 * M, (D > 1.5 ? 12 : 8.6) * M);
  const cx = W > 1.5 ? -tw / 2 + 0.1 * M : -tw / 2 + 0.1 * M;
  const cz = D / 2 - front - bd / 2;
  const wall = rpick(rng, ['plaster_white', 'brick_red', 'plaster_grey', 'brick_yellow', 'concrete_panel']);
  const fr = rpick(rng, ['window_frame_dark', 'window_frame_white']);
  const unitW = 4.2 * M;
  const nu = Math.max(2, Math.round(bw / unitW));
  const uw = bw / nu;
  const m = { cx, cz, sx: bw, sz: bd, y0: 0, y1: st.top, wall };
  const doorCol = rpick(rng, ['paint_red', 'paint_blue', 'paint_yellow', 'paint_green', 'wood_dark', 'trim_dark']);
  const frontOps = [];
  for (let f = 0; f < n; f++) for (let k = 0; k < nu; k++) {
    const u0 = -bw / 2 + uw * k;
    frontOps.push({ kind: 'door', u: u0 + 0.9 * M, y: st.y[f] + 0.02 * M, w: 1.0 * M, h: 2.2 * M, mat: doorCol, frame: fr, lamp: f > 0, mailbox: null, depth: 0.1 * M });
    frontOps.push(winT({ u: u0 + uw * 0.6, y: st.y[f] + 1.1 * M, w: Math.min(1.8 * M, uw - 2.4 * M), h: 1.0 * M, frame: fr, panes: { cols: 2 }, sill: 'metal_light' }));
  }
  const backOps = rows(st, bays(bw, nu * 2, 0.4 * M), (f, b) => b % 2 ? winT({ w: 1.0 * M, h: 2.3 * M, y: 0.05 * M, frame: fr, panes: { cols: 1 } }) : winT({ w: 1.5 * M, h: 1.4 * M, y: 0.9 * M, frame: fr, panes: { cols: 2 }, sill: 'metal_light' }));
  massWalls(g, m, { front: frontOps, back: backOps, left: [], right: [] });
  // Laubengänge
  const slab = 'concrete', rail = rpick(rng, ['metal_dark', 'metal_light', 'paint_white']);
  const zF = cz + bd / 2;
  for (let f = 1; f < n; f++) {
    g.box(slab, cx, st.y[f] - 0.2 * M, zF + gal / 2, bw, 0.2 * M, gal);
    const fr2 = mframe(cx, zF + gal / 2, bw, gal, 'front');
    railing(g, fr2, 0, st.y[f], -0.03 * M, bw, 1.05 * M, rail, chance(rng, 0.5) ? 'bars' : 'panel');
  }
  g.box(slab, cx, st.top, zF + gal / 2, bw + 0.2 * M, 0.25 * M, gal + 0.2 * M);
  if (g.detail >= 1) for (const u of bays(bw, nu + 1, 0)) g.box('concrete', cx + u, 0, zF + gal - 0.2 * M, 0.25 * M, st.top, 0.25 * M, { skip: F.TOP | F.BOTTOM });
  // Treppenturm mit Glasfuge
  const tx = cx + bw / 2 + tw / 2;
  const tm = { cx: tx, cz: zF - 1.6 * M + gal / 2, sx: tw, sz: 4.2 * M, y0: 0, y1: st.top + 1.2 * M, wall: rpick(rng, ['concrete', 'brick_dark', 'metal_panel_grey']) };
  const tf = mframe(tm.cx, tm.cz, tm.sx, tm.sz, 'front');
  massWalls(g, tm, { front: [{ ...entranceOp({ canopy: 'concrete', w: 1.4 * M, h: 2.4 * M }), u: 0 }, ...rows(st, [0], (f) => winT({ w: 0.9 * M, h: st.fh - 0.4 * M, y: -st.fh * 0.4, frame: 'metal_dark', panes: { cols: 1, rows: 3 } }), 2)] });
  void tf;
  flatRoof(g, tm, tm.y1, { mat: 'roof_flat_membrane', wall: tm.wall, parapet: 0.2 * M });
  flatRoof(g, m, st.top, { mat: 'roof_flat_gravel', wall, parapet: 0.5 * M });
  rooftop(g, cx, st.top, cz, bw, bd, { n: 3 });
  blockGround(g, W, D, 1.2 * M, 0, { paved: 'pavers' });
  if (g.detail >= 1) { bikeRack(g, tx, D / 2 - 0.5 * M, 3, 0); for (let k = 0; k < Math.min(3, nu); k++) planter(g, cx - bw / 2 + uw * (k + 0.5), D / 2 - 0.5 * M); }
  backyard(g, W, D, cz - bd / 2, rng, { mat: 'grass', wall: false });
}

// 3f Stadthäuser: schmale Häuser mit eigenen Giebeln (Treppen-, Schweif-, Dreiecksgiebel)
function stadthaeuser(ctx, g, P) {
  const { rng, level } = ctx;
  const { W, D } = P;
  const nU = Math.max(2, Math.round(W / (5.0 * M)));
  const uw = (W - 0.2 * M) / nU;
  const bd = Math.min(D - 2.0 * M, (D > 1.5 ? 13 : 9.0) * M);
  const front = 0.6 * M;
  const cz = D / 2 - front - bd / 2;
  for (let k = 0; k < nU; k++) {
    const x = -W / 2 + 0.1 * M + uw * (k + 0.5);
    const n = (level >= 4 ? 5 : 4) - (k % 2 && rng() < 0.5 ? 1 : 0);
    const st = stack(0.6 * M, 3.4 * M, 3.0 * M, n);
    const wall = rpick(rng, ['brick_red', 'brick_dark', 'plaster_white', 'plaster_blue', 'brick_brown', 'plaster_cream', 'plaster_green', 'brick_yellow']);
    const trim = wall.startsWith('brick') ? 'plaster_white' : 'trim_stone';
    const m = { cx: x, cz, sx: uw - 0.01 * M, sz: bd, y0: 0, y1: st.top, wall };
    const us = bays(uw, 2, 0.3 * M);
    const frontOps = rows(st, us, (f, b) => {
      if (f === 0 && b === (k % 2)) return { ...entranceOp({ mat: rpick(rng, PAL.door), glazed: false, canopy: null, frame: 'window_frame_white', h: 2.5 * M, w: 1.1 * M, double: false }), y: 0.05 * M };
      return winT({ w: 1.15 * M, h: f === 0 ? 1.7 * M : 1.9 * M, y: f === 0 ? 1.0 * M : 0.7 * M, frame: 'window_frame_white', panes: { cols: 2, transom: 0.25 }, sill: trim, header: f > 0 && wall.startsWith('brick') ? 'seg' : null, headerMat: trim });
    });
    const backOps = rows(st, us, () => winT({ w: 1.1 * M, h: 1.6 * M, y: 0.8 * M, frame: 'window_frame_white', panes: { cols: 2 }, sill: 'metal_light' }));
    massWalls(g, m, { front: frontOps, back: backOps, left: [], right: [] });
    band(g, 'stone_dark', m, 0, st.pl, 0.04 * M, { skip: F.BOTTOM, sides: ['front', 'back'] });
    band(g, trim, m, st.y[1] - 0.1 * M, 0.15 * M, 0.04 * M, { sides: ['front'] });
    // Schaugiebel
    const gt = rpick(rng, ['tri', 'step', 'bell', 'flat']);
    const fF = mframe(x, cz, uw - 0.01 * M, bd, 'front');
    if (gt === 'flat') {
      cornice(g, trim, m, st.top - 0.3 * M, 0.8, { sides: ['front'] });
      flatRoof(g, m, st.top, { mat: 'roof_flat_membrane', wall, parapet: 0.6 * M });
    } else {
      const gh = 3.4 * M;
      const hw = (uw - 0.01 * M) / 2;
      let outer;
      if (gt === 'tri') outer = [[-hw, st.top], [hw, st.top], [0, st.top + gh]];
      else if (gt === 'step') outer = [[-hw, st.top], [hw, st.top], [hw, st.top + gh * 0.33], [hw * 0.66, st.top + gh * 0.33], [hw * 0.66, st.top + gh * 0.66], [hw * 0.33, st.top + gh * 0.66], [hw * 0.33, st.top + gh], [-hw * 0.33, st.top + gh], [-hw * 0.33, st.top + gh * 0.66], [-hw * 0.66, st.top + gh * 0.66], [-hw * 0.66, st.top + gh * 0.33], [-hw, st.top + gh * 0.33]];
      else { outer = [[-hw, st.top], [hw, st.top]]; for (let a = 0; a <= 8; a++) { const t = a / 8; outer.push([hw * (1 - t) * (0.55 + 0.45 * Math.cos(t * Math.PI / 2)), st.top + gh * Math.sin(t * Math.PI / 2)]); } outer.splice(outer.length - 1, 1, [0, st.top + gh]); for (let a = 7; a >= 0; a--) { const t = a / 8; outer.push([-hw * (1 - t) * (0.55 + 0.45 * Math.cos(t * Math.PI / 2)), st.top + gh * Math.sin(t * Math.PI / 2)]); } outer.splice(outer.length - 1, 1); }
      wallImpl(g, fF, wall, st.top, st.top + gh, [winT({ u: 0, y: st.top + 0.5 * M, w: 1.0 * M, h: 1.3 * M, frame: 'window_frame_white', panes: { cols: 2 }, sill: trim })], { outer });
      if (g.detail >= 1) band(g, trim, { cx: x, cz: cz + bd / 2, sx: uw - 0.01 * M, sz: 0.01 * M }, st.top - 0.12 * M, 0.14 * M, 0.06 * M, { sides: ['front'] });
      rectRoof(g, { cx: x, cz: cz - 0.05 * M, sx: uw - 0.02 * M, sz: bd - 0.1 * M, y0: st.top, pitch: Math.atan(gh / (uw / 2)) * 180 / Math.PI * 0.92, ridge: 'z', mat: rpick(rng, ['roof_tiles_red', 'roof_slate', 'roof_tiles_anthracite']), under: 'wood_dark', edge: 'trim_dark', eave: 0.001 * M, verge: 0.001 * M, t: 0.15 * M, gutter: null });
    }
  }
  blockGround(g, W, D, front, 0, { paved: 'pavers' });
  backyard(g, W, D, cz - bd / 2, rng, { mat: 'grass' });
}

// 4a Plattenbau (WBS 70): Plattenraster mit Fugen, Loggiastapel, Treppenhausachsen, saniert mit Farbfeldern
function platte(ctx, g, P, o = {}) {
  const { rng, level } = ctx;
  const { W, D } = P;
  const n = o.floors ?? (level >= 5 ? 16 + Math.floor(rng() * 5) : 6 + Math.floor(rng() * 5));
  const st = stack(0.9 * M, 2.8 * M, 2.8 * M, n);
  const front = rr(rng, 2.0, 3.0) * M;
  const bw = W - 0.6 * M, bd = Math.min(D - front - 2.4 * M, (D > 1.5 ? 12 : (level >= 5 ? 9.5 : 9.2)) * M);
  const cz = D / 2 - front - bd / 2;
  const renov = o.renov ?? chance(rng, 0.6);
  const wall = renov ? rpick(rng, ['plaster_white', 'plaster_cream', 'plaster_grey', 'plaster_white']) : rpick(rng, ['concrete_panel', 'concrete']);
  const accentA = rpick(rng, ['plaster_yellow', 'plaster_blue', 'plaster_green', 'plaster_red', 'plaster_ochre', 'paint_orange']);
  const bayW = 2.4 * M;
  const nb = Math.max(3, Math.floor(bw / bayW));
  const realW = nb * bayW;
  const m = { cx: 0, cz, sx: realW, sz: bd, y0: 0, y1: st.top, wall };
  const us = bays(realW, nb, 0);
  const stairs = realW > 18 * M ? [Math.floor(nb / 4), Math.floor((3 * nb) / 4)] : [Math.floor(nb / 2)];
  const loggias = new Set();
  for (let b = 0; b < nb; b++) if (!stairs.includes(b) && (b % 3 === 1)) loggias.add(b);
  const fr = renov ? 'window_frame_white' : 'window_frame_wood';
  const frontOps = rows(st, us, (f, b) => {
    if (stairs.includes(b)) {
      if (f === 0) return { ...entranceOp({ canopy: 'concrete', canopyW: 1.6 * M, h: 2.3 * M, w: 1.4 * M, frame: 'metal_dark' }), y: -0.85 * M };
      return winT({ w: 1.0 * M, h: 1.2 * M, y: -st.fh * 0.5 + 0.9 * M, frame: fr, panes: { cols: 1, rows: 2 }, sill: null });
    }
    if (f === 0) return winT({ w: 1.5 * M, h: 1.0 * M, y: 1.2 * M, frame: fr, panes: { cols: 2 } });
    return winT({ w: 1.5 * M, h: 1.45 * M, y: 0.85 * M, frame: fr, panes: { cols: 2 }, sill: 'metal_light' });
  });
  const backOps = rows(st, us, (f, b) => {
    if (f > 0 && loggias.has(b)) return { kind: 'loggia', w: bayW * 1.0 - 0.2 * M, h: st.fh - 0.3 * M, y: 0.05 * M, depth: 1.3 * M, frame: fr, parapet: renov ? accentA : 'concrete', backWall: wall, reveal: wall };
    return winT({ w: 1.5 * M, h: 1.45 * M, y: 0.85 * M, frame: fr, panes: { cols: 2 }, sill: 'metal_light' });
  });
  const sideOps = rows(st, [-bd * 0.25, bd * 0.25], () => winT({ w: 0.9 * M, h: 1.2 * M, y: 1.0 * M, frame: fr, panes: { cols: 1 } }));
  massWalls(g, m, { front: frontOps, back: backOps, left: sideOps, right: sideOps });
  const fF = mframe(0, cz, realW, bd, 'front'), fB = mframe(0, cz, realW, bd, 'back');
  panelJoints(g, fF, st, us, bayW);
  panelJoints(g, fB, st, us, bayW);
  band(g, 'concrete_dark', m, 0, st.pl, 0.05 * M, { skip: F.BOTTOM });
  // Farbfelder (saniert) an den Stirnseiten bzw. Treppenhausachsen
  if (renov && g.detail >= 1) {
    for (const s of ['left', 'right']) { const f = mframe(0, cz, realW, bd, s); g.wbox(accentA, f, 0, st.y[1], 0.015 * M, bd * 0.5, st.top - st.y[1] - 0.3 * M, 0.03 * M, { skip: F.BACK }); }
    for (const b of stairs) g.wbox(accentA, fF, us[b], st.y[1] - 0.3 * M, 0.012 * M, bayW * 0.9, st.top - st.y[1], 0.02 * M, { skip: F.BACK });
  }
  // Kragbalkone an der Front (Typ mit Balkonen)
  if (g.detail >= 1 && o.frontBalconies !== false) for (const b of [...loggias]) for (let f = 1; f < n; f++) balcony(g, fF, us[b], st.y[f], bayW - 0.15 * M, 1.2 * M, { slab: 'concrete', rail: renov ? accentA : 'concrete', type: 'panel' });
  flatRoof(g, m, st.top, { mat: 'roof_flat_membrane', wall: 'concrete', parapet: 0.6 * M, coping: 'metal_light' });
  for (const b of stairs) {
    g.box('concrete', us[b], st.top, cz, bayW + 0.4 * M, 2.4 * M, 3.4 * M, { skip: F.BOTTOM });
    if (g.detail >= 1) g.box('metal_light', us[b], st.top + 2.4 * M, cz, bayW + 0.6 * M, 0.06 * M, 3.6 * M);
  }
  rooftop(g, 0, st.top, cz, realW, bd, { n: 2 + (level >= 5 ? 3 : 1), sat: true });
  // Außenanlagen: Parkplatz oder Rasen mit Bäumen
  blockGround(g, W, D, front, 0, { fence: false });
  for (const b of stairs) ground(g, 'pavers', us[b], D / 2 - front / 2 + 0.05 * M, 2.4 * M, front, 0.05 * M);
  if (g.detail >= 1) {
    for (let k = 0; k < Math.min(4, Math.round(W / (4 * M))); k++) bush(g, -W / 2 + (k + 0.5) * W / Math.max(1, Math.round(W / (4 * M))), D / 2 - 0.6 * M, 1.0, 'hedge');
  }
  const yd = cz - bd / 2 + D / 2;
  if (yd > 4.5 * M && g.detail >= 1 && W > 1.5) parkingRow(g, 0, -D / 2 + 2.6 * M, Math.floor((W - 1.0 * M) / (2.5 * M)), 1, 0.65);
  else if (yd > 1.5 * M) { ground(g, 'grass', 0, -D / 2 + yd / 2, W, yd, 0.04 * M); if (g.detail >= 1) { tree(g, -W * 0.25, -D / 2 + yd * 0.5, 1.0); tree(g, W * 0.28, -D / 2 + yd * 0.45, 0.9); } }
  return { st, m, cz };
}

// 4b Wohnblock mit Loggien (modern, größer) → modernMfh mit mehr Geschossen
// 4c Gründerzeit-Prachtbau: Mittelrisalit, Eckturm, reicher Stuck
function prachtbau(ctx, g, P) {
  const { rng } = ctx;
  const r = gruenderzeit(ctx, g, P, { floors: 5 + (rng() < 0.5 ? 1 : 0), roof: 'mansard', erker: P.W > 1.5 ? 2 : 1, wall: rpick(rng, ['stone_sandstone', 'plaster_cream', 'plaster_ochre', 'plaster_white']) });
  // Turmhaube auf der Mitte (Risalit mit Kuppel)
  const { st, cz, bw, bd } = r;
  const tw = Math.min(4.0 * M, bw * 0.38);
  const ty = st.top;
  const tm = { cx: 0, cz: cz + bd / 2 - tw / 2 + 0.3 * M, sx: tw, sz: tw, y0: ty - 0.4 * M, y1: ty + 3.2 * M, wall: 'stone_sandstone' };
  const ops = (side) => [winT({ u: 0, y: ty + 0.6 * M, w: 1.2 * M, h: 1.9 * M, frame: 'window_frame_white', panes: { cols: 2, transom: 0.3 }, sill: 'trim_stone', surround: side === 'front' ? 'trim_stone' : null })];
  massWalls(g, tm, { front: ops('front'), left: ops('left'), right: ops('right'), back: [] });
  cornice(g, 'trim_stone', tm, tm.y1 - 0.3 * M, 0.8);
  const dome = g.detail === 0 ? 4 : 10;
  g.geom('roof_copper', new THREE.SphereGeometry(tw * 0.62, dome, Math.max(3, dome / 2), 0, Math.PI * 2, 0, Math.PI / 2), { x: 0, y: tm.y1 + 0.1 * M, z: tm.cz, sy: 1.2 });
  if (g.detail >= 1) {
    g.cyl('roof_copper', 0, tm.y1 + tw * 0.62 * 1.2, tm.cz, 0.2 * M, 1.2 * M, { seg: 6, rTop: 0.05 * M });
    g.box('metal_dark', 0, tm.y1 + tw * 0.75 + 1.2 * M, tm.cz, 0.05 * M, 1.0 * M, 0.05 * M);
  }
}

// 4d Wohnhof: Blockrand um einen Innenhof (U- oder O-Form)
function wohnhof(ctx, g, P) {
  const { rng, level } = ctx;
  const { W, D } = P;
  const n = level >= 5 ? 8 : 5 + (rng() < 0.5 ? 1 : 0);
  const st = stack(0.4 * M, 3.4 * M, 3.0 * M, n);
  const wall = rpick(rng, ['brick_red', 'plaster_cream', 'brick_dark', 'plaster_white', 'brick_yellow', 'plaster_ochre']);
  const trim = wall.startsWith('brick') ? 'concrete' : 'trim_stone';
  const fr = rpick(rng, ['window_frame_white', 'window_frame_dark']);
  const front = 0.8 * M;
  const x0 = -W / 2 + 0.3 * M, x1 = W / 2 - 0.3 * M, z1 = D / 2 - front, z0 = -D / 2 + 0.6 * M;
  const win = (f) => winT({ w: 1.3 * M, h: f === 0 ? 1.5 * M : 1.6 * M, y: f === 0 ? 1.0 * M : 0.8 * M, frame: fr, panes: { cols: 2, transom: 0.2 }, sill: 'metal_light' });
  const wings = [];
  // Flügelanordnung je Grundfläche: 1×1/2×1 ein Vorderhaus mit Durchfahrt, 1×2 Vorder- und Hinterhaus,
  // 2×2 U-Form mit Vorderhaus und zwei Seitenflügeln um einen Gartenhof
  const zl = z1 - z0;
  const dF = D > 1.5 ? (W > 1.5 ? 7.0 * M : 6.5 * M) : Math.min(9.5 * M, zl - 1.2 * M);
  wings.push({ cx: (x0 + x1) / 2, cz: z1 - dF / 2, sx: x1 - x0, sz: dF, gate: true });
  let hof = null;
  if (D > 1.5 && W < 1.5) {
    wings.push({ cx: (x0 + x1) / 2, cz: z0 + dF / 2, sx: x1 - x0, sz: dF });
    hof = { x: 0, z: (z0 + dF + z1 - dF) / 2, w: x1 - x0, d: zl - dF * 2 };
  } else if (D > 1.5) {
    const dS = 6.5 * M, sl = zl - dF;
    for (const sg of [-1, 1]) wings.push({ cx: sg > 0 ? x1 - dS / 2 : x0 + dS / 2, cz: z0 + sl / 2, sx: dS, sz: sl, side: true });
    hof = { x: 0, z: z0 + sl / 2, w: x1 - x0 - dS * 2, d: sl };
  }
  for (const wg of wings) {
    const m = { cx: wg.cx, cz: wg.cz, sx: wg.sx, sz: wg.sz, y0: 0, y1: st.top, wall };
    const sides = {};
    for (const s of ['front', 'back', 'left', 'right']) {
      const f = mframe(m.cx, m.cz, m.sx, m.sz, s);
      const inner = wg.side ? false : (s === 'front' || s === 'back');
      if (wg.side && (s === 'front' || s === 'back')) { sides[s] = []; continue; }
      if (!wg.side && (s === 'left' || s === 'right')) { sides[s] = []; continue; }
      void inner;
      const nb = Math.max(2, Math.round((f.len - 1.0 * M) / (2.7 * M)));
      const us = bays(f.len, nb, 0.5 * M);
      const gateU = wg.gate && s === 'front' ? 0 : null;
      sides[s] = rows(st, us, (fl, b, u) => {
        if (gateU !== null && Math.abs(u - gateU) < 2.2 * M) {
          if (fl === 0) return Math.abs(u - gateU) < 1.4 * M ? { kind: 'door', w: 3.6 * M, h: 3.1 * M, y: -0.35 * M, mat: 'metal_dark', frame: trim, lamp: true, mailbox: 'metal_light', double: true, depth: 0.5 * M } : null;
        }
        if (wg.gate && s === 'back' && fl === 0 && Math.abs(u) < 2.2 * M) return null;
        return win(fl);
      });
    }
    massWalls(g, m, sides);
    band(g, 'stone_grey', m, 0, st.pl, 0.04 * M, { skip: F.BOTTOM });
    if (g.detail >= 1) band(g, trim, m, st.y[1] - 0.15 * M, 0.25 * M, 0.06 * M);
    cornice(g, trim, m, st.top - 0.3 * M, 0.8);
    // Satteldach je Flügel
    rectRoof(g, { cx: m.cx, cz: m.cz, sx: m.sx, sz: m.sz, y0: st.top, pitch: 38, ridge: wg.side ? 'z' : 'x', mat: rpick(rng, ['roof_tiles_red', 'roof_tiles_anthracite']), under: trim, edge: trim, wall, k: 1, eave: 0.3 * M });
    // Balkone zum Hof
    if (g.detail >= 1) {
      const hofSide = wg.side ? (wg.cx < 0 ? 'right' : 'left') : (wg.cz > 0 ? 'back' : 'front');
      const f = mframe(m.cx, m.cz, m.sx, m.sz, hofSide);
      for (const u of bays(f.len, Math.max(1, Math.round(f.len / (6 * M))), 1.5 * M)) for (let fl = 1; fl < n; fl++) balcony(g, f, u, st.y[fl], 2.8 * M, 1.4 * M, { slab: 'concrete', rail: 'metal_dark', type: 'bars' });
    }
  }
  // Durchfahrt: Tunnel im Vorderflügel als dunkle Laibung bereits über 'door'; Hof
  ground(g, 'pavers', 0, 0, W - 0.04 * M, D - 0.04 * M, 0.03 * M);
  if (hof && g.detail >= 1) {
    ground(g, 'grass', hof.x, hof.z, Math.max(1 * M, hof.w - 2 * M), Math.max(1 * M, hof.d - 2 * M), 0.05 * M);
    tree(g, hof.x, hof.z, 1.2);
    if (hof.w > 5 * M && hof.d > 5 * M) { play(g, hof.x - hof.w * 0.25, hof.z + hof.d * 0.25, 'sand'); bench(g, hof.x + hof.w * 0.25, hof.z, 0); tree(g, hof.x + hof.w * 0.28, hof.z - hof.d * 0.3, 0.9); }
    if (W > 1.5) fence(g, x0 + 6.5 * M, z0 - 0.3 * M, x1 - 6.5 * M, z0 - 0.3 * M, 'wall', { h: 1.6 * M, mat: wall.startsWith('brick') ? wall : 'brick_red' });
  } else if (g.detail >= 1) {
    backyard(g, W, D, z1 - dF, rng, { mat: 'grass' });
  }
}

// 4e Terrassenhaus: Geschosse treppen nach hinten zurück, Pflanztröge
function terrassen(ctx, g, P) {
  const { rng, level } = ctx;
  const { W, D } = P;
  const n = level >= 5 ? 10 : 6;
  const fh = 3.0 * M;
  const step = Math.min(1.6 * M, (D - 4 * M) / (n + 2));
  const front = 1.5 * M;
  const bw = W - 0.4 * M;
  const wall = rpick(rng, ['plaster_white', 'concrete_panel', 'plaster_cream', 'brick_white']);
  const fr = 'window_frame_dark';
  const zB = -D / 2 + 1.5 * M;
  const nb = Math.max(2, Math.round(bw / (3.0 * M)));
  const us = bays(bw, nb, 0.4 * M);
  for (let f = 0; f < n; f++) {
    const zF = D / 2 - front - f * step;
    const sz = zF - zB;
    if (sz < 3 * M) break;
    const y0 = 0.3 * M + f * fh, y1 = y0 + fh;
    const m = { cx: 0, cz: (zF + zB) / 2, sx: bw, sz, y0, y1, wall };
    const ops = us.map((u, b) => (f === 0 && b === Math.floor(nb / 2)) ? { ...entranceOp({ canopy: null, depth: 0.8 * M }), u, y: y0 } : winT({ u, y: y0 + 0.05 * M, w: 2.2 * M, h: 2.4 * M, frame: fr, panes: { cols: 2 }, sill: null }));
    const backUs = bays(bw, nb, 0.5 * M);
    const backOps = f === n - 1 ? backUs.map((u) => winT({ u, y: y0 + 0.9 * M, w: 1.4 * M, h: 1.4 * M, frame: fr, panes: { cols: 2 } })) : [];
    massWalls(g, m, { front: ops, back: f === 0 ? backUs.map((u) => winT({ u, y: y0 + 0.9 * M, w: 1.4 * M, h: 1.4 * M, frame: fr, panes: { cols: 2 } })) : backOps, left: [], right: [] });
    if (f > 0 || true) {
      // Terrasse vor dem nächsten Geschoss: Brüstung mit Pflanztrog
      if (f < n - 1) {
        const zt = zF - step / 2;
        g.box('wood_planks', 0, y1, zt, bw, 0.05 * M, step);
        if (g.detail >= 1) {
          g.box('concrete', 0, y1, zF - 0.2 * M, bw, 0.55 * M, 0.4 * M, { skip: F.BOTTOM });
          g.box('hedge', 0, y1 + 0.55 * M, zF - 0.2 * M, bw - 0.2 * M, 0.35 * M, 0.3 * M, { skip: F.BOTTOM });
          railing(g, mframe(0, zF - 0.2 * M, bw, 0.4 * M, 'front'), 0, y1 + 0.55 * M, -0.3 * M, bw, 0.5 * M, 'metal_light', 'bars');
          if (g.detail >= 2 && f % 2 === 0) for (const u of [us[0], us[nb - 1]]) g.geom('leaves_green', new THREE.IcosahedronGeometry(0.7 * M, 0), { x: u, y: y1 + 1.0 * M, z: zF - 0.25 * M });
        }
      }
    }
    if (f === n - 1) flatRoof(g, m, y1, { mat: 'green_roof', wall, parapet: 0.4 * M });
  }
  ground(g, 'grass', 0, 0, W - 0.04 * M, D - 0.04 * M, 0.03 * M);
  ground(g, 'pavers', us[Math.floor(nb / 2)], D / 2 - front / 2, 2.0 * M, front, 0.05 * M);
  if (g.detail >= 1) { hedge(g, -W * 0.3, D / 2 - 0.5 * M, W * 0.3, 0.5 * M, 0.7 * M); hedge(g, W * 0.3, D / 2 - 0.5 * M, W * 0.3, 0.5 * M, 0.7 * M); }
}

// ---------- Hochhäuser (Stufe 5)
// Turmgeschosse: Seitenansichten mit Fenster-/Balkonmustern
function towerFloors(g, m, st, o) {
  const sides = {};
  for (const s of ['front', 'back', 'left', 'right']) {
    const f = mframe(m.cx, m.cz, m.sx, m.sz, s);
    const nb = Math.max(2, Math.round((f.len - 0.6 * M) / (o.bay ?? 2.7 * M)));
    const us = bays(f.len, nb, 0.3 * M);
    sides[s] = rows(st, us, (fl, b) => o.win(fl, b, nb, s, f), o.from ?? 0, o.to ?? st.n);
  }
  massWalls(g, m, sides);
}

// 5a Wohnturm mit Staffelgeschossen
function wohnturm(ctx, g, P) {
  const { rng } = ctx;
  const { W, D } = P;
  const small = W < 1.5 && D < 1.5;
  const n = small ? 11 + Math.floor(rng() * 4) : 14 + Math.floor(rng() * 6);
  const fh = 2.95 * M;
  const wall = rpick(rng, ['plaster_white', 'concrete_panel', 'brick_white', 'plaster_grey', 'brick_red', 'metal_panel_white']);
  const accent = rpick(rng, ['metal_panel_grey', 'wood_planks', 'brick_dark', 'metal_panel_blue', 'concrete']);
  const fr = 'window_frame_dark';
  const front = 2.5 * M;
  const s0 = Math.min(W - 1.2 * M, 18 * M), d0 = Math.min(D - front - 2.2 * M, (D > 1.5 ? 16 : 8.6) * M);
  const cz = D / 2 - front - d0 / 2;
  // Sockel (2 Geschosse, etwas breiter, Eingangshalle)
  const pod = stack(0.2 * M, 4.0 * M, 3.4 * M, 2);
  const pm = { cx: 0, cz, sx: s0, sz: d0, y0: 0, y1: pod.top, wall: accent };
  const pf = mframe(0, cz, s0, d0, 'front');
  const pus = bays(s0, Math.max(2, Math.round(s0 / (3.2 * M))), 0.4 * M);
  massWalls(g, pm, { front: rows(pod, pus, (f, b) => f === 0 && b === Math.floor(pus.length / 2) ? { ...entranceOp({ canopy: 'metal_dark', canopyW: 2.4 * M, canopyD: 2.0 * M, w: 2.4 * M, h: 3.0 * M }), y: 0 } : winT({ w: 2.4 * M, h: f === 0 ? 2.8 * M : 2.4 * M, y: f === 0 ? 0.3 * M : 0.4 * M, frame: fr, panes: { cols: 3 } })), back: rows(pod, pus, () => winT({ w: 1.6 * M, h: 1.5 * M, y: 1.0 * M, frame: fr, panes: { cols: 2 } })), left: [], right: [] });
  void pf;
  // Turm in Abschnitten, jeder schmaler
  const secs = [Math.floor(n * 0.6), Math.floor(n * 0.25), n - Math.floor(n * 0.6) - Math.floor(n * 0.25)];
  let y = pod.top, sx = s0 - 0.6 * M, sz = d0 - 0.6 * M;
  for (let i = 0; i < secs.length; i++) {
    const k = secs[i];
    if (k <= 0) continue;
    const st = stack(y, fh, fh, k);
    const m = { cx: 0, cz: cz - i * 0.3 * M, sx, sz, y0: y, y1: st.top, wall: i === 2 ? accent : wall };
    towerFloors(g, m, st, { bay: 2.6 * M, win: (fl, b, nb) => (b === 0 || b === nb - 1) && i < 2 ? winT({ w: 1.0 * M, h: 2.3 * M, y: 0.05 * M, frame: fr, panes: { cols: 1 } }) : winT({ w: 1.6 * M, h: 1.6 * M, y: 0.75 * M, frame: fr, panes: { cols: 2 }, sill: 'metal_light' }) });
    if (g.detail >= 1) {
      for (const s of ['front', 'back']) {
        const f = mframe(m.cx, m.cz, m.sx, m.sz, s);
        for (let fl = 0; fl < k; fl++) for (const sg of [-1, 1]) balcony(g, f, sg * (m.sx / 2 - 1.3 * M), st.y[fl] + 0.02 * M, 2.4 * M, 1.4 * M, { slab: 'concrete', rail: 'glass_railing', type: 'panel' });
      }
    }
    band(g, 'concrete', m, st.top - 0.25 * M, 0.25 * M, 0.08 * M);
    // Dachterrasse auf dem Rücksprung
    if (i < secs.length - 1 && g.detail >= 1) {
      const fT = mframe(m.cx, m.cz, sx, sz, 'front');
      railing(g, fT, 0, st.top, -0.15 * M, sx - 0.3 * M, 1.0 * M, 'metal_dark', 'panel');
      if (g.detail >= 2) for (const u of [-sx * 0.3, sx * 0.3]) planter(g, u, m.cz + sz / 2 - 0.6 * M);
    }
    y = st.top;
    sx -= 2.4 * M; sz -= 1.6 * M;
    if (sx < 6 * M || sz < 5 * M) break;
  }
  flatRoof(g, { cx: 0, cz: cz - 0.6 * M, sx: sx + 2.4 * M, sz: sz + 1.6 * M }, y, { mat: 'roof_flat_gravel', wall, parapet: 0.8 * M });
  rooftop(g, 0, y, cz - 0.6 * M, sx, sz, { stair: true, n: 3 });
  flatRoof(g, pm, pod.top, { mat: 'green_roof', wall: accent, parapet: 0.4 * M });
  towerGround(g, W, D, front, rng);
}
function towerGround(g, W, D, front, rng) {
  ground(g, 'pavers', 0, D / 2 - front / 2, W - 0.04 * M, front, 0.05 * M);
  ground(g, 'grass', 0, -front / 2, W - 0.04 * M, D - front - 0.04 * M, 0.03 * M);
  if (g.detail >= 1) {
    for (const sx of [-1, 1]) { tree(g, sx * (W / 2 - 1.2 * M), D / 2 - front * 0.5, 0.9); bench(g, sx * (W / 2 - 3.0 * M), D / 2 - front * 0.5, 0); }
    lamp(g, 0, D / 2 - 0.4 * M);
    if (D > 1.5) parkingRow(g, 0, -D / 2 + 2.8 * M, Math.floor((W - 1 * M) / (2.5 * M)), 1, 0.7);
    else { bikeRack(g, W / 2 - 1.8 * M, -D / 2 + 1.0 * M, 4); bins(g, -W / 2 + 1.4 * M, -D / 2 + 0.7 * M, 4); }
  }
}

// 5b Punkthochhaus: quadratischer Turm mit Eckbalkonen und Krone
function punkthaus(ctx, g, P, o = {}) {
  const { rng } = ctx;
  const { W, D } = P;
  const n = o.floors ?? (W < 1.5 && D < 1.5 ? 13 + Math.floor(rng() * 5) : 18 + Math.floor(rng() * 6));
  const fh = 2.9 * M;
  const front = 2.0 * M;
  const s = Math.min(W - 1.0 * M, D - front - 1.2 * M, o.size ?? 15 * M);
  const cx = o.cx ?? 0, cz = o.cz ?? (D / 2 - front - s / 2);
  const wall = o.wall || rpick(rng, ['plaster_white', 'concrete_panel', 'brick_white', 'plaster_grey', 'brick_yellow', 'metal_panel_white']);
  const rail = rpick(rng, ['metal_light', 'metal_dark', 'paint_white', 'concrete']);
  const fr = 'window_frame_dark';
  const st = stack(0.3 * M, 4.0 * M, fh, n);
  const m = { cx, cz, sx: s, sz: s, y0: 0, y1: st.top, wall };
  towerFloors(g, m, st, { bay: 2.5 * M, win: (fl, b, nb, side) => {
    if (fl === 0) return side === 'front' && b === Math.floor(nb / 2) ? { ...entranceOp({ canopy: 'concrete', canopyW: 2.0 * M, w: 2.2 * M, h: 2.9 * M }), y: 0 } : winT({ w: 1.8 * M, h: 2.6 * M, y: 0.4 * M, frame: fr, panes: { cols: 2 } });
    if (b === 0 || b === nb - 1) return winT({ w: 1.0 * M, h: 2.3 * M, y: 0.05 * M, frame: fr, panes: { cols: 1 } });
    return winT({ w: 1.4 * M, h: 1.5 * M, y: 0.8 * M, frame: fr, panes: { cols: 2 }, sill: 'metal_light' });
  } });
  // Eckbalkone (über Eck laufend, je Geschoss)
  if (g.detail >= 1) {
    for (let fl = 1; fl < n; fl++) for (const [ax, az] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const x = cx + ax * (s / 2 + 0.55 * M - 1.1 * M), z = cz + az * (s / 2 + 0.55 * M);
      g.box('concrete', x, st.y[fl] - 0.15 * M, z, 2.6 * M, 0.15 * M, 1.1 * M);
      g.box(rail, x, st.y[fl], z + az * 0.5 * M, 2.6 * M, 1.0 * M, 0.05 * M, { skip: NB });
      const x2 = cx + ax * (s / 2 + 0.55 * M), z2 = cz + az * (s / 2 + 0.55 * M - 1.1 * M);
      g.box('concrete', x2, st.y[fl] - 0.15 * M, z2, 1.1 * M, 0.15 * M, 2.6 * M);
      g.box(rail, x2 + ax * 0.5 * M, st.y[fl], z2, 0.05 * M, 1.0 * M, 2.6 * M, { skip: NB });
    }
  }
  band(g, 'concrete_dark', m, 0, st.pl, 0.04 * M, { skip: F.BOTTOM });
  band(g, 'concrete', m, st.y[1] - 0.2 * M, 0.3 * M, 0.15 * M);
  // Krone: zurückgesetztes Technikgeschoss mit Lamellen
  const top = flatRoof(g, m, st.top, { mat: 'roof_flat_gravel', wall, parapet: 0.9 * M });
  const cw = s * 0.55;
  g.box(o.crown || 'metal_panel_grey', cx, st.top, cz, cw, 3.2 * M, cw * 0.8, { skip: F.BOTTOM });
  if (g.detail >= 1) {
    g.box('metal_light', cx, st.top + 3.2 * M, cz, cw + 0.2 * M, 0.1 * M, cw * 0.8 + 0.2 * M);
    for (let k = 0; k < 6; k++) g.box('metal_dark', cx - cw / 2 + cw * (k + 0.5) / 6, st.top + 0.3 * M, cz + cw * 0.4 + 0.02 * M, 0.08 * M, 2.6 * M, 0.06 * M, { skip: F.BACK });
    g.cyl('metal_dark', cx + cw * 0.3, st.top + 3.3 * M, cz, 0.05 * M, 3.0 * M, { seg: 4 });
  }
  void top;
  if (o.ground !== false) towerGround(g, W, D, front, rng);
}

// 5c Scheibenhochhaus: breite Scheibe mit Loggiabändern
function scheibe(ctx, g, P) {
  const { rng } = ctx;
  const { W, D } = P;
  const n = 12 + Math.floor(rng() * 5);
  const fh = 2.85 * M;
  const front = 2.6 * M;
  const bw = W - 0.8 * M, bd = Math.min(D - front - 2.2 * M, 11.5 * M);
  const cz = D / 2 - front - bd / 2;
  const wall = rpick(rng, ['concrete_panel', 'plaster_white', 'plaster_cream', 'brick_white']);
  const color = rpick(rng, ['paint_blue', 'paint_red', 'paint_yellow', 'paint_green', 'paint_orange', 'metal_panel_blue']);
  const fr = 'window_frame_white';
  const st = stack(0.6 * M, 3.4 * M, fh, n);
  const m = { cx: 0, cz, sx: bw, sz: bd, y0: 0, y1: st.top, wall };
  const nb = Math.max(3, Math.round(bw / (2.6 * M)));
  const us = bays(bw, nb, 0.2 * M);
  const front0 = rows(st, us, (fl, b) => {
    const step = (bw - 0.4 * M) / nb;
    if (fl === 0) return b === Math.floor(nb / 2) ? { ...entranceOp({ canopy: 'concrete', canopyW: 3 * M, w: Math.min(2.4 * M, step - 0.4 * M), h: 2.8 * M }), y: 0 } : winT({ w: Math.min(2.0 * M, step - 0.5 * M), h: 2.2 * M, y: 0.6 * M, frame: 'metal_dark', panes: { cols: 2 } });
    return { kind: 'loggia', w: 2.6 * M * (bw / (nb * 2.6 * M)) - 0.3 * M, h: fh - 0.3 * M, y: 0.05 * M, depth: 1.3 * M, frame: fr, parapet: b % 2 ? color : wall, backWall: 'plaster_white', reveal: wall };
  });
  const back0 = rows(st, us, (fl) => fl === 0 ? null : winT({ w: 1.4 * M, h: 1.4 * M, y: 0.85 * M, frame: fr, panes: { cols: 2 }, sill: 'metal_light' }));
  const side0 = rows(st, [0], (fl) => fl === 0 ? null : winT({ w: 0.8 * M, h: 1.2 * M, y: 1.0 * M, frame: fr, panes: { cols: 1 } }));
  massWalls(g, m, { front: front0, back: back0, left: side0, right: side0 });
  // Stirnseiten mit Farbstreifen, Dachrand auskragend
  for (const s of ['left', 'right']) { const f = mframe(0, cz, bw, bd, s); if (g.detail >= 1) g.wbox(color, f, 0, st.y[1], 0.02 * M, 1.2 * M, st.top - st.y[1], 0.04 * M, { skip: F.BACK }); }
  band(g, 'concrete', m, st.top, 0.6 * M, 0.35 * M);
  flatRoof(g, m, st.top + 0.6 * M, { mat: 'roof_flat_membrane', wall: 'concrete', parapet: 0.1 * M });
  rooftop(g, 0, st.top + 0.6 * M, cz, bw, bd, { stair: true, n: 4, sat: true });
  // Erdgeschoss zurückgesetzt mit Stützen (Pilotis)
  if (g.detail >= 1) for (const u of bays(bw, nb, 0.2 * M)) g.box('concrete', u + 1.3 * M * (bw / (nb * 2.6 * M)), 0, cz + bd / 2 + 0.25 * M, 0.35 * M, st.y[1], 0.35 * M, { skip: F.TOP | F.BOTTOM });
  towerGround(g, W, D, front, rng);
}

// 5d Plattenbau-Hochhaus (WHH GT 18)
function platteHoch(ctx, g, P) {
  const small = P.W < 1.5 && P.D < 1.5;
  platte(ctx, g, P, { floors: (small ? 11 : 17) + Math.floor(ctx.rng() * (small ? 3 : 4)), frontBalconies: true });
}

// 5e Turm mit Pflanzbalkonen („vertikaler Wald“)
function gruenTurm(ctx, g, P) {
  const { rng } = ctx;
  const { W, D } = P;
  const n = W < 1.5 && D < 1.5 ? 12 + Math.floor(rng() * 4) : 16 + Math.floor(rng() * 6);
  const fh = 3.1 * M;
  const front = 2.4 * M;
  const s = Math.min(W - 2.4 * M, D - front - 1.6 * M, 14 * M);
  const cz = D / 2 - front - s / 2 - 0.2 * M;
  const wall = rpick(rng, ['concrete', 'stone_grey', 'plaster_grey', 'metal_panel_grey']);
  const st = stack(0.3 * M, 4.2 * M, fh, n);
  const m = { cx: 0, cz, sx: s, sz: s, y0: 0, y1: st.top, wall };
  towerFloors(g, m, st, { bay: 2.4 * M, win: (fl, b, nb, side, f) => { const ww = Math.min(2.0 * M, (f.len - 0.6 * M) / nb - 0.45 * M); return fl === 0 ? (side === 'front' && b === Math.floor(nb / 2) ? { ...entranceOp({ canopy: null, w: ww, h: 3.2 * M }), y: 0 } : winT({ w: ww, h: 3.4 * M, y: 0.3 * M, frame: 'metal_dark', panes: { cols: 2 } })) : winT({ w: ww, h: 2.5 * M, y: 0.05 * M, frame: 'metal_dark', panes: { cols: 2 } }); } });
  // umlaufende, versetzte Balkonplatten mit Pflanztrögen und Bäumchen
  const out = 1.4 * M;
  for (let fl = 1; fl < n; fl++) {
    const sh = (fl % 2) * 1.2 * M;
    for (const side of ['front', 'back', 'left', 'right']) {
      const f = mframe(0, cz, s, s, side);
      const len = s * 0.62;
      const u = (fl % 2 ? 1 : -1) * (s / 2 - len / 2) * 0.6 + (side === 'left' ? sh : 0);
      g.wbox('concrete', f, u, st.y[fl] - 0.25 * M, out / 2, len, 0.25 * M, out, { skip: F.BACK });
      if (g.detail >= 1) {
        g.wbox('concrete', f, u, st.y[fl], out - 0.25 * M, len, 0.6 * M, 0.5 * M, { skip: F.BOTTOM });
        g.wbox('hedge', f, u, st.y[fl] + 0.6 * M, out - 0.25 * M, len - 0.1 * M, 0.35 * M, 0.42 * M, { skip: F.BOTTOM });
        if ((fl + side.length) % 3 === 0) {
          const [x, , z] = [f.ox + f.c * u + f.s * (out - 0.25 * M), 0, f.oz - f.s * u + f.c * (out - 0.25 * M)];
          g.geom(rpick(rng, ['leaves_green', 'leaves_dark', 'leaves_light']), new THREE.IcosahedronGeometry(0.9 * M, 0), { x, y: st.y[fl] + 1.6 * M, z, sy: 1.1 });
        }
      }
    }
  }
  flatRoof(g, m, st.top, { mat: 'green_roof', wall, parapet: 0.8 * M });
  if (g.detail >= 1) { tree(g, -s * 0.2, cz, 1.0); tree(g, s * 0.2, cz - s * 0.2, 0.8); }
  towerGround(g, W, D, front, rng);
}

// Rundturm (Vieleck) mit umlaufenden Ringbalkonen
function ringSlab(g, mat, cx, cz, n, r0, r1, y, t) {
  const P = (k, r, yy) => { const a = (k / n) * Math.PI * 2; return [cx + Math.sin(a) * r, yy, cz + Math.cos(a) * r]; };
  for (let k = 0; k < n; k++) {
    g.quad(mat, P(k, r0, y), P(k, r1, y), P(k + 1, r1, y), P(k + 1, r0, y), 0, [0, 1, 0]);
    if (t > 0) {
      g.quad(mat, P(k, r0, y - t), P(k + 1, r0, y - t), P(k + 1, r1, y - t), P(k, r1, y - t), 0, [0, -1, 0]);
      const a = ((k + 0.5) / n) * Math.PI * 2;
      g.quad(mat, P(k, r1, y - t), P(k + 1, r1, y - t), P(k + 1, r1, y), P(k, r1, y), 0, [Math.sin(a), 0, Math.cos(a)]);
    }
  }
}
function rundturm(ctx, g, P) {
  const { rng } = ctx;
  const { W, D } = P;
  const n = 12;
  const floors = 13 + Math.floor(rng() * 4);
  const front = 1.2 * M, bd = 1.0 * M;
  const R = Math.min(W - 2.4 * M, D - front - 2.4 * M, 9 * M) / 2 / Math.cos(Math.PI / n);
  const cx = 0, cz = D / 2 - front - R - bd;
  const st = stack(0.3 * M, 4.2 * M, 2.95 * M, floors);
  const wallM = rpick(rng, ['plaster_white', 'concrete_panel', 'brick_white', 'metal_panel_white', 'plaster_cream']);
  const rail = rpick(rng, ['metal_light', 'paint_white', 'concrete', 'metal_panel_grey']);
  const fr = 'window_frame_dark';
  const seg = 2 * R * Math.sin(Math.PI / n), ap = R * Math.cos(Math.PI / n);
  for (let k = 0; k < n; k++) {
    const a = ((k + 0.5) / n) * Math.PI * 2;
    const f = { ox: cx + Math.sin(a) * ap, oz: cz + Math.cos(a) * ap, ry: a, c: Math.cos(a), s: Math.sin(a), len: seg };
    const ops = rows(st, [0], (fl) => {
      if (fl === 0) return k === 0 || k === n - 1 ? { kind: 'door', w: Math.min(seg - 0.5 * M, 1.8 * M), h: 2.8 * M, y: 0, mat: 'trim_dark', glazed: true, frame: 'metal_dark', depth: 0.3 * M } : winT({ w: seg - 0.8 * M, h: 2.8 * M, y: 0.4 * M, frame: 'metal_dark', panes: { cols: 2 } });
      return winT({ w: Math.min(seg - 0.6 * M, 2.0 * M), h: fl % 2 ? 2.3 * M : 1.6 * M, y: fl % 2 ? 0.05 * M : 0.75 * M, frame: fr, panes: { cols: 2 }, sill: fl % 2 ? null : 'metal_light' });
    });
    wallImpl(g, f, wallM, 0, st.top, ops);
  }
  // Ringbalkone jedes zweite Geschoss, Sockelband, Dach
  const Rv = R; // Eckradius des Vielecks
  for (let fl = 1; fl < floors; fl += 2) {
    ringSlab(g, 'concrete', cx, cz, n, Rv - 0.05 * M, Rv + bd, st.y[fl], 0.18 * M);
    if (g.detail >= 1) {
      // Brüstung als Ringwand
      const Pt = (k, r, yy) => { const a = (k / n) * Math.PI * 2; return [cx + Math.sin(a) * r, yy, cz + Math.cos(a) * r]; };
      for (let k = 0; k < n; k++) {
        const a = ((k + 0.5) / n) * Math.PI * 2;
        const r = Rv + bd - 0.05 * M;
        g.quad(rail, Pt(k, r, st.y[fl]), Pt(k + 1, r, st.y[fl]), Pt(k + 1, r, st.y[fl] + 1.0 * M), Pt(k, r, st.y[fl] + 1.0 * M), 0, [Math.sin(a), 0, Math.cos(a)]);
        g.quad(rail, Pt(k + 1, r - 0.04 * M, st.y[fl]), Pt(k, r - 0.04 * M, st.y[fl]), Pt(k, r - 0.04 * M, st.y[fl] + 1.0 * M), Pt(k + 1, r - 0.04 * M, st.y[fl] + 1.0 * M), 0, [-Math.sin(a), 0, -Math.cos(a)]);
      }
    }
  }
  ringSlab(g, 'concrete_dark', cx, cz, n, Rv - 0.05 * M, Rv + 0.3 * M, st.y[1], 0.5 * M);
  const Pt = (k, r, yy) => { const a = (k / n) * Math.PI * 2; return [cx + Math.sin(a) * r, yy, cz + Math.cos(a) * r]; };
  const topPoly = [];
  for (let k = 0; k < n; k++) topPoly.push(Pt(k, Rv, st.top));
  g.poly('roof_flat_gravel', topPoly, 0, [0, 1, 0]);
  ringSlab(g, 'concrete', cx, cz, n, Rv - 0.3 * M, Rv + 0.2 * M, st.top + 0.6 * M, 0.6 * M);
  // Technikaufbau mit Krone
  const cr = R * 0.45;
  g.cyl('metal_panel_grey', cx, st.top, cz, cr, 3.0 * M, { seg: n, rot: Math.PI / n });
  if (g.detail >= 1) {
    g.cyl('metal_light', cx, st.top + 3.0 * M, cz, cr + 0.15 * M, 0.12 * M, { seg: n });
    g.cyl('metal_dark', cx, st.top + 3.1 * M, cz, 0.06 * M, 5.0 * M, { seg: 4 });
  }
  g.kit.light(cx, st.top + 8.1 * M, cz, 0xff3020, 0.5);
  towerGround(g, W, D, front, rng);
}

// 5f Zwillingstürme auf einem Sockel / Rundturm (kleine Grundstücke)
function zwillinge(ctx, g, P) {
  const { rng } = ctx;
  const { W, D } = P;
  if (W < 1.5 && D < 1.5) {
    rundturm(ctx, g, P);
    return;
  }
  if (W < 1.5 || D < 1.5) {
    // zwei schlanke Punkthäuser hintereinander bzw. nebeneinander, unterschiedlich hoch
    const along = W >= D;
    const half = along ? { W: W / 2, D } : { W, D: D / 2 };
    for (const sg of [-1, 1]) {
      const n = 16 + Math.floor(rng() * 4) + (sg > 0 ? 4 : 0);
      const s2 = Math.min(half.W - 1.8 * M, half.D - 3.0 * M, 11 * M);
      const cx2 = along ? sg * W / 4 : 0, cz2 = along ? D / 2 - 2.2 * M - s2 / 2 : sg * D / 4 + (sg > 0 ? -0.6 * M : 0.6 * M);
      punkthaus(ctx, g, half, { floors: n, cx: cx2, cz: cz2, size: s2, ground: false, crown: sg > 0 ? 'glass_curtain_blue' : 'metal_panel_grey' });
    }
    towerGround(g, W, D, 2.0 * M, rng);
    return;
  }
  const pod = 2;
  const pw = W - 0.6 * M, pd = D - 4.0 * M;
  const pcz = D / 2 - 2.0 * M - pd / 2;
  const pst = stack(0.2 * M, 4.2 * M, 3.4 * M, pod);
  const pm = { cx: 0, cz: pcz, sx: pw, sz: pd, y0: 0, y1: pst.top, wall: 'stone_grey' };
  const pus = bays(pw, Math.round(pw / (3.4 * M)), 0.4 * M);
  massWalls(g, pm, { front: rows(pst, pus, (f, b) => f === 0 && b === Math.floor(pus.length / 2) ? { ...entranceOp({ canopy: 'metal_dark', canopyW: 3 * M, w: 3.0 * M, h: 3.2 * M }), y: 0 } : winT({ w: 2.6 * M, h: f === 0 ? 3.0 * M : 2.4 * M, y: 0.4 * M, frame: 'metal_dark', panes: { cols: 3 } })), back: [], left: [], right: [] });
  flatRoof(g, pm, pst.top, { mat: 'green_roof', wall: 'stone_grey', parapet: 0.9 * M });
  const sz = Math.min(pw / 2 - 2 * M, pd - 2 * M, 13 * M);
  const along = W >= D;
  for (const sg of [-1, 1]) {
    const tx = along ? sg * (pw / 4) : 0, tz = along ? pcz : pcz + sg * (pd / 4);
    const n = 18 + Math.floor(rng() * 5) + (sg > 0 ? 3 : 0);
    const st = stack(pst.top, 3.0 * M, 2.9 * M, n);
    const wall = rpick(rng, ['plaster_white', 'metal_panel_white', 'concrete_panel']);
    const m = { cx: tx, cz: tz, sx: sz, sz: sz * 0.9, y0: pst.top, y1: st.top, wall };
    towerFloors(g, m, st, { bay: 2.4 * M, win: (fl, b, nb) => winT({ w: b === nb - 1 ? 2.2 * M : 1.5 * M, h: b === nb - 1 ? 2.5 * M : 1.6 * M, y: b === nb - 1 ? 0.05 * M : 0.75 * M, frame: 'window_frame_dark', panes: { cols: 2 }, sill: 'metal_light' }) });
    if (g.detail >= 1) {
      const f = mframe(tx, tz, m.sx, m.sz, 'front');
      for (let fl = 0; fl < n; fl++) balcony(g, f, (fl % 2 ? 1 : -1) * m.sx * 0.2, st.y[fl] + 0.02 * M, 3.0 * M, 1.5 * M, { slab: 'concrete', rail: 'glass_railing', type: 'panel' });
    }
    flatRoof(g, m, st.top, { mat: 'roof_flat_gravel', wall, parapet: 1.0 * M });
    rooftop(g, tx, st.top, tz, m.sx, m.sz, { stair: true, n: 2 });
    if (g.detail >= 1) g.box('metal_panel_grey', tx, st.top + 1.0 * M, tz, m.sx * 0.9, 1.6 * M, 0.3 * M, { skip: F.BOTTOM });
  }
  ground(g, 'pavers', 0, D / 2 - 1.0 * M, W - 0.04 * M, 2.0 * M, 0.05 * M);
  if (g.detail >= 1) for (const sx of [-1, 0, 1]) tree(g, sx * W * 0.35, D / 2 - 1.0 * M, 0.8);
}

// ---------- Typlisten je Stufe und Grundfläche
const HIGH = {
  3: [gruenderzeit, backstein, nachkrieg, modernMfh, laubengang, stadthaeuser],
  4: [platte, (c, g, P) => modernMfh(c, g, P, { floors: 7 }), prachtbau, wohnhof, terrassen, (c, g, P) => laubengang(c, g, P)],
  5: [wohnturm, punkthaus, scheibe, platteHoch, gruenTurm, zwillinge],
};

export function buildResHigh(ctx, g) {
  const { level, fw, fd, variant } = ctx;
  const list = HIGH[Math.min(5, Math.max(3, level))];
  const fn = list[variant % list.length];
  fn(ctx, g, { W: fw, D: fd });
}
export { gruenderzeit, modernMfh, platte, punkthaus, towerGround, backyard };
