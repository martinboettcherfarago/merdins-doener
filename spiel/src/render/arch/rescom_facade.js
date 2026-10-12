// Fassaden für Wohnen & Gewerbe (Besitzer G3): Wände mit echten Fensteröffnungen (Laibung, Rahmen, Sprossen,
// Glas), Türen, Schaufenster, Garagentore, Loggien, Balkone, Erker, Gesimse, Sockel, Lisenen.
// Detailstufen: 2 = alles, 1 = ohne Kleinteile (Fensterbänke, Läden, Faschen, Griffe, Lampen), 0 = Wände als
// Flächen + Fensterraster 'lod_windows' (automatisch aus den Öffnungen abgeleitet).
import { M } from './kit.js';
import { F, W, NB } from './rescom_geo.js';

// Rahmen einer Seite eines (optional gedrehten) Baukörpers
export function mframe(cx, cz, sx, sz, side, ry0 = 0) {
  let lx = 0, lz = 0, ry = ry0, len = sx;
  if (side === 'front') { lz = sz / 2; }
  else if (side === 'back') { lz = -sz / 2; ry = ry0 + Math.PI; }
  else if (side === 'right') { lx = sx / 2; ry = ry0 + Math.PI / 2; len = sz; }
  else { lx = -sx / 2; ry = ry0 - Math.PI / 2; len = sz; }
  const c0 = Math.cos(ry0), s0 = Math.sin(ry0);
  const c = Math.round(Math.cos(ry) * 1e9) / 1e9, s = Math.round(Math.sin(ry) * 1e9) / 1e9;
  return { ox: cx + c0 * lx + s0 * lz, oz: cz - s0 * lx + c0 * lz, ry, c, s, len, side };
}
const nOut = (f) => [f.s, 0, f.c];
const nU = (f) => [f.c, 0, -f.s];

// Gleichmäßige Achsen entlang einer Wand: n Positionen, Abstand vom Rand margin
export function bays(len, n, margin = 0) {
  if (n <= 0) return [];
  const span = len - margin * 2;
  const step = span / n;
  return Array.from({ length: n }, (_, i) => -span / 2 + step * (i + 0.5));
}
// Anzahl Achsen für eine Wandlänge bei gewünschtem Achsmaß
export const bayCount = (len, bay, min = 1) => Math.max(min, Math.round(len / bay));

// ---------- Öffnungen
// op: { u, y, w, h, kind: 'win'|'door'|'shop'|'garage'|'loggia'|'vent', depth, frame, glass, panes, sill, … }
export function opening(g, f, op, wallMat) {
  const D = g.detail;
  const { u, y, w, h } = op;
  const u0 = u - w / 2, u1 = u + w / 2, y1 = y + h;
  const r = op.depth ?? (op.kind === 'loggia' ? 1.4 * M : op.kind === 'shop' ? 0.12 * M : 0.15 * M);
  const rev = op.reveal || wallMat;
  const no = nOut(f), nu = nU(f);
  // Laibungen
  g.quad(rev, W(f, u0, y, 0), W(f, u0, y, -r), W(f, u0, y1, -r), W(f, u0, y1, 0), 0, nu);
  g.quad(rev, W(f, u1, y, 0), W(f, u1, y1, 0), W(f, u1, y1, -r), W(f, u1, y, -r), 0, [-nu[0], 0, -nu[2]]);
  g.quad(op.soffit || rev, W(f, u0, y1, 0), W(f, u0, y1, -r), W(f, u1, y1, -r), W(f, u1, y1, 0), 0, [0, -1, 0]);
  g.quad(op.floor || rev, W(f, u0, y, 0), W(f, u1, y, 0), W(f, u1, y, -r), W(f, u0, y, -r), 0, [0, 1, 0]);
  const lit = op.lit ?? g.rng();
  const back = -r;
  if (op.kind === 'loggia') {
    // Rückwand mit Balkontür und Fenster, Brüstung vorne
    g.wquad(op.backWall || wallMat, f, u, y, back, w, h);
    const fr = op.frame || 'window_frame_white', gl = op.glass || 'glass_window';
    const dw = Math.min(w * 0.42, 1.0 * M), ww = Math.min(w * 0.4, 1.6 * M);
    const du = u - w / 2 + 0.3 * M + dw / 2, wu = u + w / 2 - 0.3 * M - ww / 2;
    const dh = Math.min(h - 0.25 * M, 2.2 * M);
    paneSet(g, f, du, y + 0.02 * M, back + 0.02 * M, dw, dh, fr, gl, { cols: 1, transom: 0 }, lit);
    if (w > 2.4 * M) paneSet(g, f, wu, y + 0.9 * M, back + 0.02 * M, ww, Math.min(1.3 * M, dh - 0.9 * M), fr, gl, { cols: 2 }, lit);
    const ph = op.parapetH ?? 1.0 * M;
    if (op.rail === 'bars' && D >= 2) railing(g, f, u, y, -0.05 * M, w - 0.02 * M, ph, op.parapet || 'metal_dark', 'bars');
    else g.wbox(op.parapet || wallMat, f, u, y, -0.08 * M, w - 0.004 * M, ph, 0.12 * M, { skip: F.BOTTOM });
    if (D >= 2 && op.plants) shrubRow(g, f, u, y + ph, -0.08 * M, w * 0.8, op.plants);
    return;
  }
  const fr = op.frame || 'window_frame_white';
  if (op.kind === 'door') {
    g.wquad(fr, f, u, y, back, w, h);
    const ft = 0.08 * M;
    const tr = op.transom ? Math.min(0.6 * M, h * 0.22) : 0;
    const leafH = h - ft - tr - (tr ? 0.05 * M : 0);
    const leaves = op.double ? 2 : 1;
    const lw = (w - ft * 2 - (leaves - 1) * 0.04 * M) / leaves;
    for (let k = 0; k < leaves; k++) {
      const lu = u - w / 2 + ft + lw / 2 + k * (lw + 0.04 * M);
      g.wquad(op.mat || 'door_wood', f, lu, y, back + 0.02 * M, lw, leafH);
      if (op.glazed) g.wquad(op.glass || 'glass_window', f, lu, y + leafH * 0.45, back + 0.03 * M, lw * 0.55, leafH * 0.45, lit);
      else if (D >= 2) {
        // Füllungen
        g.wquad(op.panel || 'trim_dark', f, lu, y + leafH * 0.12, back + 0.03 * M, lw * 0.6, leafH * 0.3);
        g.wquad(op.panel || 'trim_dark', f, lu, y + leafH * 0.52, back + 0.03 * M, lw * 0.6, leafH * 0.36);
      }
      if (D >= 2) g.wbox('metal_light', f, lu + (k === 0 && leaves === 2 ? lw * 0.36 : -lw * 0.36), y + leafH * 0.45, back + 0.06 * M, 0.04 * M, 0.25 * M, 0.06 * M, { skip: F.BACK });
    }
    if (tr) g.wquad(op.glass || 'glass_window', f, u, y + h - ft - tr, back + 0.02 * M, w - ft * 2, tr, lit);
    if (y > 0.04 * M && y < 1.3 * M && op.steps !== false) steps(g, f, u, y, w + 0.5 * M, op.stepMat || 'stone_grey');
    if (op.canopy && D >= 1) {
      const cw = w + (op.canopyW ?? 0.8 * M), cd = op.canopyD ?? 1.1 * M;
      g.wbox(op.canopy, f, u, y1 + 0.12 * M, cd / 2, cw, 0.1 * M, cd);
      if (D >= 2 && op.canopyPosts) for (const s of [-1, 1]) g.wbox('metal_dark', f, u + s * (cw / 2 - 0.08 * M), y, cd - 0.08 * M, 0.06 * M, y1 + 0.12 * M - y, 0.06 * M, { skip: NB });
    }
    if (op.lamp !== false && D >= 1) {
      const lu = u + w / 2 + 0.35 * M, ly = y + Math.min(h, 2.2 * M) * 0.85;
      if (D >= 2) g.wbox(g.lamp, f, lu, ly, 0.08 * M, 0.14 * M, 0.22 * M, 0.14 * M);
      const [lx, , lz] = W(f, lu, ly, 0.2 * M);
      g.kit.light(lx, ly + 0.1 * M, lz, 0xffd79a, 0.35);
    }
    if (op.mailbox && D >= 2) g.wbox(op.mailbox, f, u - w / 2 - 0.4 * M, y + 0.9 * M, 0.06 * M, 0.35 * M, 0.4 * M, 0.12 * M, { skip: F.BACK });
    return;
  }
  if (op.kind === 'garage') {
    g.wquad(op.mat || 'metal_panel_white', f, u, y, back, w, h);
    if (D >= 2) for (let k = 1; k < 5; k++) g.wquad('trim_dark', f, u, y + (h * k) / 5 - 0.015 * M, back + 0.01 * M, w * 0.98, 0.03 * M);
    return;
  }
  if (op.kind === 'shop') {
    g.wquad(fr, f, u, y, back, w, h);
    const ft = 0.1 * M;
    const riser = op.riser ?? 0.35 * M;
    const tr = op.transom ?? (h > 3.2 * M ? 0.7 * M : 0);
    const gh = h - riser - ft - (tr ? tr + 0.08 * M : 0);
    const n = Math.max(1, op.cols ?? Math.round(w / (1.6 * M)));
    const pw = (w - ft * 2 - (n - 1) * 0.08 * M) / n;
    const doorAt = op.door ?? -1;
    for (let k = 0; k < n; k++) {
      const pu = u - w / 2 + ft + pw / 2 + k * (pw + 0.08 * M);
      if (k === doorAt) {
        g.wquad(op.glass || 'glass_shop', f, pu, y + 0.04 * M, back + 0.02 * M, pw, gh + riser - 0.04 * M, lit);
        if (D >= 2) g.wbox('metal_light', f, pu - pw * 0.3, y + 0.9 * M, back + 0.06 * M, 0.04 * M, 0.5 * M, 0.05 * M, { skip: F.BACK });
      } else g.wquad(op.glass || 'glass_shop', f, pu, y + riser, back + 0.02 * M, pw, gh, lit);
    }
    if (tr) {
      const tn = Math.max(1, Math.round(w / (1.2 * M))), tw = (w - ft * 2 - (tn - 1) * 0.08 * M) / tn;
      for (let k = 0; k < tn; k++) g.wquad(op.glass || 'glass_shop', f, u - w / 2 + ft + tw / 2 + k * (tw + 0.08 * M), y + h - ft - tr, back + 0.02 * M, tw, tr, lit);
    }
    if (op.door !== undefined && op.door >= 0 && y > 0.04 * M && y < 1.3 * M) steps(g, f, u - w / 2 + ft + pw / 2 + doorAt * (pw + 0.08 * M), y, pw + 0.3 * M, op.stepMat || 'stone_grey');
    return;
  }
  // Fenster (auch Balkontür, Lüftung)
  g.wquad(fr, f, u, y, back, w, h);
  paneSet(g, f, u, y, back + 0.02 * M, w, h, null, op.glass || 'glass_window', op.panes || {}, lit, op.ft);
  if (D < 2) return;
  if (op.sill) g.wbox(op.sill === true ? 'trim_stone' : op.sill, f, u, y - 0.05 * M, -r / 2 + 0.03 * M, w + 0.12 * M, 0.06 * M, r + 0.06 * M);
  if (op.surround) {
    const s = op.surroundW ?? 0.16 * M, t = 0.04 * M, sm = op.surround;
    const yb = y - (op.sill ? 0.02 * M : s), hh = h + (op.sill ? 0.02 * M : s) + s;
    g.wbox(sm, f, u0 - s / 2, yb, t / 2, s, hh, t, { skip: F.BACK | F.TOP | F.BOTTOM });
    g.wbox(sm, f, u1 + s / 2, yb, t / 2, s, hh, t, { skip: F.BACK | F.TOP | F.BOTTOM });
    g.wbox(sm, f, u, y1, t / 2, w, s, t, { skip: F.BACK | F.BOTTOM | F.LEFT | F.RIGHT });
    if (!op.sill) g.wbox(sm, f, u, y - s, t / 2, w, s, t, { skip: F.BACK | F.TOP | F.LEFT | F.RIGHT });
  }
  if (op.header) {
    const hw = w + (op.surround ? 0.5 * M : 0.3 * M), hy = y1 + (op.surround ? 0.16 * M : 0.02 * M);
    const hm = op.headerMat || op.surround || 'trim_stone';
    g.wbox(hm, f, u, hy, 0.08 * M, hw, 0.1 * M, 0.16 * M);
    if (op.header === 'tri') {
      const ph = hw * 0.22, d0 = 0.02 * M;
      const a = W(f, u - hw / 2, hy + 0.1 * M, 0.14 * M), b = W(f, u + hw / 2, hy + 0.1 * M, 0.14 * M), c = W(f, u, hy + 0.1 * M + ph, 0.14 * M);
      g.tri(hm, a, b, c, 0, no);
      const a2 = W(f, u - hw / 2, hy + 0.1 * M, d0), b2 = W(f, u + hw / 2, hy + 0.1 * M, d0), c2 = W(f, u, hy + 0.1 * M + ph, d0);
      g.quad(hm, a, c, c2, a2, 0, [-nu[0] * 0.5, 0.8, -nu[2] * 0.5]);
      g.quad(hm, c, b, b2, c2, 0, [nu[0] * 0.5, 0.8, nu[2] * 0.5]);
    } else if (op.header === 'seg') {
      g.wbox(hm, f, u, hy + 0.1 * M, 0.06 * M, hw * 0.5, 0.08 * M, 0.12 * M);
    }
  }
  if (op.keystone) g.wbox(op.keystone, f, u, y1 - 0.06 * M, 0.04 * M, 0.2 * M, 0.26 * M, 0.08 * M, { skip: F.BACK });
  if (op.shutters) {
    const sw = w / 2 + 0.02 * M;
    for (const sgn of [-1, 1]) g.wbox(op.shutters, f, u + sgn * (w / 2 + sw / 2 + 0.03 * M), y, 0.03 * M, sw, h, 0.04 * M, { skip: F.BACK });
  }
  if (op.french) railing(g, f, u, y, 0.06 * M, w + 0.1 * M, 0.95 * M, op.french, 'bars', true);
  if (op.flowers) {
    g.wbox(op.flowerBox || 'wood_dark', f, u, y - 0.02 * M, 0.14 * M, w * 0.9, 0.2 * M, 0.22 * M);
    shrubRow(g, f, u, y + 0.18 * M, 0.14 * M, w * 0.85, op.flowers);
  }
  if (op.awning) {
    // kleine Fenstermarkise
    const aw = w + 0.2 * M, ad = 0.7 * M;
    const [x, , z] = W(f, u, 0, ad / 2);
    g.rbox(op.awning, x, y1 + 0.05 * M, z, aw, 0.04 * M, ad, -0.5, f.ry, 0);
  }
}

// Glasflächen mit Rahmenstegen in einer Öffnung (Rahmenplatte liegt dahinter)
export function paneSet(g, f, u, y, d, w, h, frameMat, glass, p = {}, lit = 0, ftIn) {
  if (frameMat) g.wquad(frameMat, f, u, y, d - 0.015 * M, w, h);
  const ft = ftIn ?? p.ft ?? 0.08 * M, mt = p.mt ?? 0.06 * M;
  const iw = w - ft * 2, ih = h - ft * 2;
  if (iw <= 0 || ih <= 0) return;
  // Mittlere Entfernung: Sprossen nicht sichtbar → eine Scheibe je Fenster
  const coarse = g.detail === 1 && !p.keep;
  const cols = coarse ? 1 : p.cols ?? (w > 1.1 * M ? 2 : 1);
  const tr = coarse ? 0 : p.transom ?? 0; // Anteil Oberlicht
  const rows = coarse ? 1 : p.rows ?? 1;
  const y0 = y + ft;
  let mainH = ih, topH = 0;
  if (tr > 0) { topH = (ih - mt) * tr; mainH = ih - mt - topH; }
  const cw = (iw - (cols - 1) * mt) / cols, rh = (mainH - (rows - 1) * mt) / rows;
  for (let c = 0; c < cols; c++) for (let rI = 0; rI < rows; rI++) {
    g.wquad(glass, f, u - iw / 2 + cw / 2 + c * (cw + mt), y0 + rI * (rh + mt), d, cw, rh, lit);
  }
  if (topH > 0) {
    const tc = p.transomCols ?? (cols > 2 ? cols : 1);
    const tw = (iw - (tc - 1) * mt) / tc;
    for (let c = 0; c < tc; c++) g.wquad(glass, f, u - iw / 2 + tw / 2 + c * (tw + mt), y0 + mainH + mt, d, tw, topH, lit);
  }
}

// Treppenstufen vor einer Tür (y = Schwellenhöhe)
export function steps(g, f, u, y, w, mat = 'stone_grey') {
  const n = Math.max(1, Math.round(y / (0.17 * M)));
  const sh = y / n;
  for (let k = 0; k < n; k++) g.wbox(mat, f, u, 0, 0.3 * M * (n - k) / 2, w, sh * (k + 1), 0.3 * M * (n - k), { skip: NB });
}

// Geländer entlang einer Wand (vor der Wand im Abstand d). type: 'bars' | 'solid' | 'panel'
export function railing(g, f, u, y, d, w, h, mat, type = 'bars', small = false) {
  const D = g.detail;
  if (D === 0) return;
  if (type === 'solid' || type === 'panel' || D < 2) {
    g.wbox(mat, f, u, y, d, w, h, small ? 0.03 * M : 0.06 * M, { skip: NB });
    return;
  }
  const rail = small ? 0.035 * M : 0.05 * M;
  g.wbox(mat, f, u, y + h - rail, d, w, rail, rail * 1.2);
  g.wbox(mat, f, u, y + 0.08 * M, d, w, rail * 0.7, rail);
  const n = Math.max(2, Math.round(w / (small ? 0.18 * M : 0.3 * M)));
  for (let k = 0; k <= n; k++) g.wbox(mat, f, u - w / 2 + (w * k) / n, y, d, 0.025 * M, h - rail, 0.025 * M, { skip: F.TOP | F.BOTTOM });
}

// Reihe kleiner Büsche/Blumen (Blumenkästen, Pflanztröge)
export function shrubRow(g, f, u, y, d, w, mat = 'leaves_green') {
  const n = Math.max(1, Math.round(w / (0.35 * M)));
  for (let k = 0; k < n; k++) {
    const pu = u - w / 2 + (w * (k + 0.5)) / n;
    const m = Array.isArray(mat) ? mat[k % mat.length] : mat;
    g.wbox(m, f, pu, y, d, w / n * 0.95, 0.12 * M + (k % 2) * 0.05 * M, 0.2 * M, { skip: F.BOTTOM | F.BACK });
  }
}

// Kragbalkon vor der Wand: Bodenplatte + Geländer (vorne + Seiten)
export function balcony(g, f, u, yFloor, w, dep, o = {}) {
  if (g.detail === 0) return;
  const slab = o.slab || 'concrete', rail = o.rail || 'metal_dark', type = o.type || 'bars', rh = o.railH ?? 1.0 * M;
  const st = o.slabT ?? 0.16 * M;
  g.wbox(slab, f, u, yFloor - st, dep / 2, w, st, dep, { skip: F.BACK });
  const rt = type === 'bars' ? 0.03 * M : 0.05 * M;
  railing(g, f, u, yFloor, dep - rt / 2, w, rh, rail, type);
  if (g.detail >= 2 || type !== 'bars') {
    // Seiten: Geländer senkrecht zur Wand – als Rahmen dieser Seite
    for (const s of [-1, 1]) {
      const [x, , z] = W(f, u + s * (w / 2 - rt / 2), 0, dep / 2);
      if (type === 'bars' && g.detail >= 2) {
        g.box(rail, x, yFloor + rh - 0.05 * M, z, 0.05 * M, 0.05 * M, dep, { ry: f.ry });
        g.box(rail, x, yFloor, z, 0.03 * M, rh, 0.03 * M, { ry: f.ry, skip: F.TOP | F.BOTTOM });
      } else g.box(rail, x, yFloor, z, rt, rh, dep - rt, { ry: f.ry, skip: NB });
    }
  }
  if (o.plants && g.detail >= 2) {
    const [x, , z] = W(f, u + w / 2 - 0.35 * M, 0, dep * 0.45);
    g.box('wood_dark', x, yFloor, z, 0.4 * M, 0.35 * M, 0.4 * M, { skip: NB });
    g.box(o.plants, x, yFloor + 0.35 * M, z, 0.5 * M, 0.35 * M, 0.5 * M, { skip: NB });
  }
}

// ---------- Wände
// Wand einer Seite: Umriss (Rechteck oder Vieleck in (u, y)), Öffnungen → Löcher + Einbauten.
// Bei Detail 0 nur Fläche + Fensterraster.
export function wall(g, f, wallMat, y0, y1, ops = [], o = {}) {
  const u0 = o.u0 ?? -f.len / 2, u1 = o.u1 ?? f.len / 2;
  const outer = o.outer || [[u0, y0], [u1, y0], [u1, y1], [u0, y1]];
  if (g.detail === 0) {
    g.wallShape(wallMat, f, outer, [], o.d || 0);
    lodWindows(g, f, ops, o.d || 0);
    return;
  }
  const holes = [], ok = [];
  const pad = 0.03 * M;
  for (const op of ops) {
    const hu0 = Math.max(u0 + 0.02 * M, op.u - op.w / 2), hu1 = Math.min(u1 - 0.02 * M, op.u + op.w / 2);
    if (hu1 - hu0 < 0.05 * M) continue;
    const h = { u0: hu0, u1: hu1, y0: op.y, y1: op.y + op.h };
    // Überlappung mit bereits gesetzten Öffnungen oder außerhalb des Umrisses → weglassen
    // (Prüfhilfe: globalThis.__g3drop = [] sammelt verworfene Öffnungen)
    if (holes.some((q) => h.u0 < q.u1 + pad && h.u1 > q.u0 - pad && h.y0 < q.y1 + pad && h.y1 > q.y0 - pad)) { if (globalThis.__g3drop) globalThis.__g3drop.push('ov:' + op.kind); continue; }
    if (!insidePoly(outer, h.u0, h.y0 + 0.01 * M) || !insidePoly(outer, h.u1, h.y0 + 0.01 * M) || !insidePoly(outer, h.u0, h.y1 + 0.01 * M) || !insidePoly(outer, h.u1, h.y1 + 0.01 * M)) { if (globalThis.__g3drop) globalThis.__g3drop.push('out:' + op.kind); continue; }
    op.u = (hu0 + hu1) / 2; op.w = hu1 - hu0;
    holes.push(h); ok.push(op);
  }
  g.wallShape(wallMat, f, outer, holes, o.d || 0);
  for (const op of ok) opening(g, o.d ? { ...f, ox: f.ox + f.s * o.d, oz: f.oz + f.c * o.d } : f, op, o.reveal || wallMat);
}

// Punkt im Vieleck (gerade-ungerade-Regel), Rand zählt als außen
function insidePoly(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Fensterraster für die Fernansicht aus den Öffnungen ableiten
export function lodWindows(g, f, ops, d = 0) {
  const off = d + 0.02 * M;
  const rows = new Map();
  for (const op of ops) {
    if (op.kind === 'shop') { g.wquad(op.glass || 'glass_shop', f, op.u, op.y + 0.3 * M, off, op.w, op.h - 0.3 * M, g.rng()); continue; }
    if (op.kind === 'door' || op.kind === 'garage') { g.wquad(op.kind === 'door' ? (op.mat || 'door_wood') : (op.mat || 'metal_panel_white'), f, op.u, op.y, off, op.w, op.h); continue; }
    if (op.kind === 'loggia') { g.wquad('trim_dark', f, op.u, op.y + 1.0 * M, off, op.w, op.h - 1.0 * M); continue; }
    const cy = op.y + op.h / 2;
    const key = cy.toFixed(4);
    if (!rows.has(key)) rows.set(key, { cy, h: op.h, us: [] });
    rows.get(key).us.push({ u: op.u, w: op.w });
  }
  // Zeilen mit gleicher Spaltenfolge zusammenfassen
  const list = [...rows.values()].sort((a, b) => a.cy - b.cy);
  const sig = (r) => r.us.map((x) => x.u.toFixed(3)).sort().join(',');
  let i = 0;
  while (i < list.length) {
    const r = list[i];
    r.us.sort((a, b) => a.u - b.u);
    const n = r.us.length;
    let spacing = n > 1 ? (r.us[n - 1].u - r.us[0].u) / (n - 1) : r.us[0].w / 0.48;
    let uniform = true;
    for (let k = 1; k < n; k++) if (Math.abs(r.us[k].u - r.us[k - 1].u - spacing) > 0.02 * M) uniform = false;
    if (n > 1 && spacing < r.us[0].w * 1.15) spacing = r.us[0].w * 1.15;
    // gleichartige Folgezeilen suchen
    let j = i + 1, pitch = 0;
    if (uniform) {
      while (j < list.length && sig(list[j]) === sig(r)) {
        const p = list[j].cy - list[j - 1].cy;
        if (pitch === 0) pitch = p;
        if (Math.abs(p - pitch) > 0.02 * M) break;
        j++;
      }
    }
    const nRows = uniform ? j - i : 1;
    if (!pitch) pitch = r.h / 0.6;
    if (uniform) {
      const wq = spacing * n, hq = pitch * nRows;
      const yb = r.cy - pitch * 0.55;
      const umid = (r.us[0].u + r.us[n - 1].u) / 2;
      lodQuad(g, f, umid, yb, off, wq, hq, n, nRows);
      i += nRows;
    } else {
      for (const x of r.us) lodQuad(g, f, x.u, r.cy - (r.h / 0.6) * 0.55, off, x.w / 0.48, r.h / 0.6, 1, 1);
      i++;
    }
  }
}
function lodQuad(g, f, u, y0, d, w, h, cols, rows) {
  const lit = g.rng();
  const a = W(f, u - w / 2, y0, d), b = W(f, u + w / 2, y0, d), c = W(f, u + w / 2, y0 + h, d), e = W(f, u - w / 2, y0 + h, d);
  // eigene UVs: eine Zelle je Fenster
  const B = g.buf('lod_windows');
  const n = [f.s, 0, f.c];
  const pts = [a, b, c, a, c, e], uvs = [[0, 0], [cols, 0], [cols, rows], [0, 0], [cols, rows], [0, rows]];
  for (let k = 0; k < 6; k++) { B.p.push(...pts[k]); B.n.push(...n); B.uv.push(...uvs[k]); B.lit.push(lit); }
}

// Baukörper mit vier Wänden (ohne Deckel). m: {cx, cz, sx, sz, ry?, y0, y1, wall}; sides: {front: ops, …}
// sides[x] darf auch { ops, outer, mat } sein. Fehlende Seiten werden geschlossen (ohne Öffnungen).
export function massWalls(g, m, sides = {}, o = {}) {
  for (const side of ['front', 'back', 'left', 'right']) {
    if (o.skip && o.skip.includes(side)) continue;
    const f = mframe(m.cx, m.cz, m.sx, m.sz, side, m.ry || 0);
    const s = sides[side];
    const spec = Array.isArray(s) ? { ops: s } : (s || { ops: [] });
    wall(g, f, spec.mat || m.wall, m.y0, m.y1, spec.ops || [], { outer: spec.outer, reveal: o.reveal || m.reveal });
  }
}

// ---------- Gliederung
// Waagrechtes Band (Gesims, Sockel) um einen Baukörper; out = Ausladung
export function band(g, mat, m, y, h, out, o = {}) {
  const sides = o.sides || ['front', 'back', 'left', 'right'];
  if (sides.length === 4 && !m.ry) {
    g.box(mat, m.cx, y, m.cz, m.sx + out * 2, h, m.sz + out * 2, { skip: o.skip || 0 });
    return;
  }
  for (const side of sides) {
    const f = mframe(m.cx, m.cz, m.sx, m.sz, side, m.ry || 0);
    g.wbox(mat, f, 0, y, out / 2 - 0.01 * M, f.len + out * 2, h, out + 0.02 * M, { skip: F.BACK | (o.skip || 0) });
  }
}
// Profiliertes Traufgesims (gestuft) – liest sich aus der Entfernung als Stuckprofil
export function cornice(g, mat, m, y, size = 1, o = {}) {
  if (g.detail === 0) { band(g, mat, m, y, 0.35 * M * size, 0.25 * M * size, o); return; }
  band(g, mat, m, y, 0.12 * M * size, 0.08 * M * size, o);
  band(g, mat, m, y + 0.12 * M * size, 0.1 * M * size, 0.18 * M * size, o);
  band(g, mat, m, y + 0.22 * M * size, 0.16 * M * size, 0.3 * M * size, o);
  if (g.detail >= 2 && o.dentils) {
    // Zahnschnitt an der Front
    const f = mframe(m.cx, m.cz, m.sx, m.sz, 'front', m.ry || 0);
    const n = Math.floor(f.len / (0.32 * M));
    for (let k = 0; k < n; k++) g.wbox(mat, f, -f.len / 2 + (k + 0.5) * (f.len / n), y - 0.12 * M * size, 0.06 * M * size, 0.14 * M, 0.12 * M * size, 0.12 * M * size, { skip: F.BACK | F.TOP });
  }
}
// Lisenen / Pilaster: senkrechte Streifen auf einer Wand an den Positionen us
export function pilasters(g, f, mat, us, y0, y1, w = 0.35 * M, t = 0.06 * M) {
  if (g.detail === 0) return;
  for (const u of us) g.wbox(mat, f, u, y0, t / 2, w, y1 - y0, t, { skip: F.BACK | F.BOTTOM });
}
// Eckquaderung an den beiden Ecken einer Wand
export function quoins(g, f, mat, y0, y1, o = {}) {
  if (g.detail < 2) return;
  const bh = o.h ?? 0.32 * M, gap = o.gap ?? 0.06 * M;
  const n = Math.floor((y1 - y0) / (bh + gap));
  for (const s of [-1, 1]) {
    for (let k = 0; k < n; k++) {
      const wq = k % 2 ? 0.45 * M : 0.7 * M;
      g.wbox(mat, f, s * (f.len / 2 - wq / 2 + 0.005 * M), y0 + k * (bh + gap), 0.025 * M, wq, bh, 0.05 * M, { skip: F.BACK });
    }
  }
}
// Rustika-Fugen (waagrechte Rillen) im Erdgeschoss
export function rustication(g, f, mat, y0, y1, step = 0.4 * M) {
  if (g.detail < 2) return;
  for (let y = y0 + step; y < y1 - 0.05 * M; y += step) g.wquad(mat, f, 0, y, 0.008 * M, f.len, 0.04 * M);
}

// ---------- Erker (vorspringender Fensterbau über mehrere Geschosse)
// f: Wand, u: Mitte, yb/yt: Unter-/Oberkante, w × dep. o.wall, o.win (Fenster-Optionen), o.floors [{y, h}]
export function erker(g, f, u, yb, yt, w, dep, o = {}) {
  const [cx, , cz] = W(f, u, 0, dep / 2);
  const m = { cx, cz, sx: w, sz: dep, ry: f.ry, y0: yb, y1: yt, wall: o.wall };
  const wins = o.rows || [];
  const sides = { front: [], left: [], right: [] };
  for (const r of wins) {
    const nf = w > 2.6 * M ? 2 : 1;
    const fw = Math.min(1.2 * M, (w - 0.5 * M) / nf - 0.3 * M);
    for (const uu of bays(w, nf, 0.15 * M)) sides.front.push({ ...o.win, u: uu, y: r.y, w: fw, h: r.h, kind: 'win' });
    if (dep >= 0.7 * M) {
      const sw = Math.min(0.7 * M, dep - 0.3 * M);
      sides.left.push({ ...o.win, u: 0, y: r.y, w: sw, h: r.h, kind: 'win', panes: { cols: 1 }, shutters: null });
      sides.right.push({ ...o.win, u: 0, y: r.y, w: sw, h: r.h, kind: 'win', panes: { cols: 1 }, shutters: null });
    }
  }
  massWalls(g, m, sides, { skip: ['back'] });
  // Unterseite mit Konsole
  const mb = { ...m };
  g.wbox(o.trim || o.wall, f, u, yb - 0.25 * M, dep / 2 + 0.02 * M, w + 0.1 * M, 0.25 * M, dep + 0.04 * M, { skip: F.BACK });
  if (g.detail >= 1) g.wbox(o.trim || o.wall, f, u, yb - 0.55 * M, dep * 0.3, w * 0.7, 0.3 * M, dep * 0.6, { skip: F.BACK });
  // Abschluss
  if (o.top === 'balcony') {
    g.wbox(o.trim || o.wall, f, u, yt, dep / 2 + 0.03 * M, w + 0.12 * M, 0.15 * M, dep + 0.06 * M, { skip: F.BACK });
    if (g.detail >= 1) {
      const fr = { ...f, ox: f.ox, oz: f.oz };
      railing(g, fr, u, yt + 0.15 * M, dep + 0.02 * M, w + 0.08 * M, 0.95 * M, o.rail || 'metal_dark', 'bars');
      for (const sgn of [-1, 1]) {
        const [x, , z] = W(f, u + sgn * (w / 2 + 0.02 * M), 0, dep / 2);
        g.box(o.rail || 'metal_dark', x, yt + 0.15 * M, z, 0.04 * M, 0.95 * M, dep, { ry: f.ry, skip: NB });
      }
    }
  } else {
    cornice(g, o.trim || o.wall, { ...mb, sz: dep, cz }, yt, 0.6, { sides: ['front', 'left', 'right'] });
    g.box(o.roof || 'roof_metal_grey', cx, yt + 0.38 * M * 0.6, cz, w, 0.04 * M, dep, { ry: f.ry, skip: F.BOTTOM });
  }
  return m;
}
