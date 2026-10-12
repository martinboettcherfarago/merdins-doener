// Schilder, Leuchtschrift, Markisen und Auslagen für Gewerbe (Besitzer G3).
// Eine kleine Pixelschrift (5 Zeilen, variable Breite, Umlaute) schreibt echte Wörter auf Fassaden:
// Leuchtbuchstaben, Leuchtkästen, Ausleger, Dachreklamen, Pylone. Markisen in mehreren Bauformen.
import { M } from './kit.js';
import { F, NB, W } from './rescom_geo.js';

// Glyphen: Zeilen von oben nach unten, '1' = Pixel. Akzent (Umlaut) als eigene Zeile darüber.
const G = {
  A: ['010', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'], C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'], E: ['111', '100', '110', '100', '111'], F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'], H: ['101', '101', '111', '101', '101'], I: ['1', '1', '1', '1', '1'],
  J: ['001', '001', '001', '101', '010'], K: ['101', '101', '110', '101', '101'], L: ['100', '100', '100', '100', '111'],
  M: ['10001', '11011', '10101', '10001', '10001'], N: ['1001', '1101', '1011', '1001', '1001'], O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'], Q: ['010', '101', '101', '110', '011'], R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'], T: ['111', '010', '010', '010', '010'], U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'], W: ['10001', '10001', '10101', '11011', '10001'], X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'], Z: ['111', '001', '010', '100', '111'], '&': ['010', '101', '010', '101', '011'],
  '-': ['00', '00', '11', '00', '00'], '.': ['0', '0', '0', '0', '1'], "'": ['1', '1', '0', '0', '0'], ' ': ['00', '00', '00', '00', '00'],
  0: ['111', '101', '101', '101', '111'], 1: ['01', '11', '01', '01', '01'], 2: ['110', '001', '010', '100', '111'], 3: ['110', '001', '010', '001', '110'],
  4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '110', '001', '110'], 7: ['111', '001', '010', '010', '010'], 9: ['111', '101', '111', '001', '110'],
};
const ACC = { Ä: ['A', '101'], Ö: ['O', '101'], Ü: ['U', '101'], É: ['E', '010'] };
const glyph = (ch) => {
  if (ACC[ch]) { const [b, a] = ACC[ch]; return { rows: G[b], acc: a }; }
  return { rows: G[ch] || G[' '], acc: null };
};
// Breite eines Worts in Pixeln (inkl. 1 Pixel Abstand)
export function textWidth(text) {
  let w = 0;
  for (const ch of text.toUpperCase()) w += glyph(ch).rows[0].length + 1;
  return Math.max(0, w - 1);
}

// Schrift in Wandkoordinaten: Mitte u, Unterkante y, Abstand d, Pixelgröße px
export function text(g, f, str, u, y, d, px, mat, o = {}) {
  const s = str.toUpperCase();
  const total = textWidth(s) * px;
  let x = u - total / 2;
  const depth = o.depth ?? 0.04 * M;
  // Tiefe nur bei großen Buchstaben in der Nahsicht (sonst flache Flächen: 2 statt 8 Dreiecke je Rechteck)
  const solid = g.detail >= 2 && depth > 0 && px >= (o.solidPx ?? 0.14 * M);
  for (const ch of s) {
    const { rows, acc } = glyph(ch);
    const gw = rows[0].length;
    for (const [c0, c1, r0, r1] of glyphRects(rows)) {
      const cu = x + ((c0 + c1) / 2) * px, w = (c1 - c0) * px;
      const yb = y + (5 - r1) * px, h = (r1 - r0) * px;
      if (solid) g.wbox(mat, f, cu, yb, d + depth / 2, w, h, depth, { skip: F.BACK });
      else g.wquad(mat, f, cu, yb, d + 0.005 * M, w, h, o.lit ?? 0);
    }
    if (acc) {
      for (let k = 0; k < gw; k++) if (acc[k] === '1') {
        const cu = x + (k + 0.5) * px;
        if (solid) g.wbox(mat, f, cu, y + 5.25 * px, d + depth / 2, px, px * 0.8, depth, { skip: F.BACK });
        else g.wquad(mat, f, cu, y + 5.25 * px, d + 0.005 * M, px, px * 0.8, o.lit ?? 0);
      }
    }
    x += (gw + 1) * px;
  }
  return total;
}
// Pixel einer Glyphe zu Rechtecken zusammenfassen: [spalte0, spalte1, zeile0, zeile1)
const rectCache = new Map();
function glyphRects(rows) {
  const k = rows.join('/');
  if (rectCache.has(k)) return rectCache.get(k);
  const runs = rows.map((row) => {
    const out = [];
    let i = 0;
    while (i < row.length) { if (row[i] !== '1') { i++; continue; } let e = i; while (e < row.length && row[e] === '1') e++; out.push([i, e]); i = e; }
    return out;
  });
  const rects = [];
  const open = new Map();
  runs.forEach((rr2, r) => {
    const next = new Map();
    for (const [a, b] of rr2) {
      const key = a + ',' + b;
      if (open.has(key)) { const rc = open.get(key); rc[3] = r + 1; next.set(key, rc); open.delete(key); }
      else { const rc = [a, b, r, r + 1]; rects.push(rc); next.set(key, rc); }
    }
    open.clear();
    for (const [kk, v] of next) open.set(kk, v);
  });
  rectCache.set(k, rects);
  return rects;
}

// Schriftzug passend in eine Breite (Pixelgröße automatisch), mit optionalem Schildband dahinter
export function signBand(g, f, str, u, y, w, h, o = {}) {
  if (g.detail === 0) {
    if (o.band) g.wquad(o.band, f, u, y, 0.02 * M, w, h);
    return;
  }
  const pxW = (w * (o.fill ?? 0.82)) / Math.max(1, textWidth(str));
  const px = Math.min(pxW, (h * 0.7) / 5, o.maxPx ?? 0.22 * M);
  const d0 = o.d ?? 0.02 * M;
  if (o.band) g.wbox(o.band, f, u, y, d0 / 2 + 0.01 * M, w, h, d0 + 0.02 * M, { skip: F.BACK });
  const ty = y + (h - 5 * px) / 2;
  text(g, f, str, u, ty, d0 + 0.02 * M, px, o.mat || 'sign_white', { depth: o.depth ?? 0.04 * M });
  if (o.light !== false) {
    const [x, , z] = W(f, u, 0, 0.4 * M);
    g.kit.light(x, y + h / 2, z, o.color ?? 0xfff2d8, Math.min(1.2, w * 1.5));
  }
}

// Leuchtkasten / Logo-Scheibe
export function logoDisc(g, f, u, y, d, r, mat, o = {}) {
  if (g.detail === 0) return;
  const seg = 12;
  const pts = [];
  for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI * 2; pts.push(W(f, u + Math.cos(a) * r, y + Math.sin(a) * r, d)); }
  g.poly(mat, pts, 0, [f.s, 0, f.c]);
  if (o.ring && g.detail >= 2) {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      g.quad(o.ring, W(f, u + Math.cos(a0) * r, y + Math.sin(a0) * r, d), W(f, u + Math.cos(a1) * r, y + Math.sin(a1) * r, d), W(f, u + Math.cos(a1) * r, y + Math.sin(a1) * r, d - 0.06 * M), W(f, u + Math.cos(a0) * r, y + Math.sin(a0) * r, d - 0.06 * M), 0);
    }
  }
}

// Ausleger (Nasenschild) senkrecht zur Wand, zweiseitig beschriftet
export function bladeSign(g, f, u, y, o = {}) {
  if (g.detail === 0) return;
  const w = o.w ?? 0.9 * M, h = o.h ?? 0.9 * M, out = o.out ?? 0.25 * M;
  // Halter
  g.wbox(o.bracket || 'metal_dark', f, u, y + h + 0.05 * M, (out + w) / 2, 0.05 * M, 0.05 * M, out + w);
  // Schildtafel als Rahmen senkrecht zur Wand
  const [cx, , cz] = W(f, u, 0, out + w / 2);
  g.box(o.panel || 'sign_white', cx, y, cz, 0.06 * M, h, w, { ry: f.ry });
  if (g.detail >= 1 && o.glyph) {
    // Symbol auf beiden Seiten (Seitenrahmen der Tafel)
    for (const sg of [1, -1]) {
      const fs = { ox: cx + f.c * 0.035 * M * sg, oz: cz - f.s * 0.035 * M * sg, ry: f.ry + sg * Math.PI / 2, c: Math.cos(f.ry + sg * Math.PI / 2), s: Math.sin(f.ry + sg * Math.PI / 2), len: w };
      const px = Math.min(w, h) * 0.8 / Math.max(5, textWidth(o.glyph));
      text(g, fs, o.glyph, 0, y + (h - 5 * px) / 2, 0.0, px, o.glyphMat || 'paint_red', { depth: 0.015 * M });
    }
  }
}

// Markise: 'fixed' (schräg mit Volant), 'roll' (Kassette + Tuch), 'dome' (Korbmarkise)
export function awning(g, f, u, y, w, dep, mat, type = 'fixed') {
  if (g.detail === 0) {
    const [x, , z] = W(f, u, 0, dep / 2);
    g.rbox(mat, x, y - dep * 0.2, z, w, 0.03 * M, dep, 0.42, f.ry, 0);
    return;
  }
  const drop = dep * (type === 'roll' ? 0.35 : 0.45);
  const a = W(f, u - w / 2, y, 0.02 * M), b = W(f, u + w / 2, y, 0.02 * M);
  const c = W(f, u + w / 2, y - drop, dep), d = W(f, u - w / 2, y - drop, dep);
  const n = [f.s * 0.6, 0.8, f.c * 0.6];
  if (type === 'dome') {
    // Korbmarkise: Viertelkreis-Profil aus 4 Segmenten
    const segs = 4;
    let prev = [W(f, u - w / 2, y + 0.2 * M, 0.02 * M), W(f, u + w / 2, y + 0.2 * M, 0.02 * M)];
    for (let k = 1; k <= segs; k++) {
      const t = (k / segs) * Math.PI / 2;
      const dd = Math.sin(t) * dep, yy = y + 0.2 * M - (1 - Math.cos(t)) * drop * 1.6;
      const cur = [W(f, u - w / 2, yy, dd), W(f, u + w / 2, yy, dd)];
      g.quad(mat, prev[0], prev[1], cur[1], cur[0], 0, [f.s, 1, f.c]);
      g.quad(mat, prev[0], cur[0], cur[1], prev[1], 0, [-f.s, -1, -f.c]);
      prev = cur;
    }
    // Seitenwangen
    for (const sg of [-1, 1]) {
      const pts = [W(f, u + sg * w / 2, y + 0.2 * M, 0.02 * M)];
      for (let k = 1; k <= segs; k++) { const t = (k / segs) * Math.PI / 2; pts.push(W(f, u + sg * w / 2, y + 0.2 * M - (1 - Math.cos(t)) * drop * 1.6, Math.sin(t) * dep)); }
      pts.push(W(f, u + sg * w / 2, y + 0.2 * M - drop * 1.6, 0.02 * M));
      g.poly(mat, pts, 0, [f.c * sg, 0, -f.s * sg]);
    }
    return;
  }
  g.quad(mat, a, b, c, d, 0, n);
  g.quad(mat, a, d, c, b, 0, [-n[0], -n[1], -n[2]]);
  // Volant (Behang vorne)
  const vh = 0.28 * M;
  g.quad(mat, d, c, [c[0], c[1] - vh, c[2]], [d[0], d[1] - vh, d[2]], 0, [f.s, 0, f.c]);
  g.quad(mat, c, d, [d[0], d[1] - vh, d[2]], [c[0], c[1] - vh, c[2]], 0, [-f.s, 0, -f.c]);
  if (type === 'roll') g.wbox('metal_light', f, u, y - 0.02 * M, 0.12 * M, w + 0.1 * M, 0.2 * M, 0.22 * M, { skip: F.BACK });
  if (g.detail >= 2) {
    // Gelenkarme
    for (const sg of [-0.42, 0.42]) {
      const p0 = W(f, u + sg * w, y - drop * 1.6, 0.02 * M), p1 = W(f, u + sg * w, y - drop, dep * 0.95);
      const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2, mz = (p0[2] + p1[2]) / 2;
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
      const ang = Math.atan2(p1[1] - p0[1], Math.hypot(p1[0] - p0[0], p1[2] - p0[2]));
      g.rbox('metal_light', mx, my, mz, 0.04 * M, 0.04 * M, len, -ang, f.ry, 0);
    }
  }
}

// Auslagen vor dem Laden: 'flowers' | 'fruit' | 'news' | 'rack'
export function display(g, f, u, w, kind = 'fruit') {
  if (g.detail < 2) return;
  const d = 0.6 * M;
  if (kind === 'news') {
    g.wbox('metal_dark', f, u, 0, d, 0.7 * M, 1.2 * M, 0.3 * M, { skip: NB });
    for (let k = 0; k < 3; k++) g.wbox(['paint_white', 'paint_yellow', 'paint_red'][k], f, u - 0.22 * M + k * 0.22 * M, 0.5 * M + k * 0.18 * M, d + 0.16 * M, 0.2 * M, 0.25 * M, 0.02 * M, { skip: F.BACK });
    return;
  }
  const mats = kind === 'flowers' ? ['paint_red', 'paint_yellow', 'plaster_pink', 'paint_white', 'leaves_green', 'paint_orange', 'paint_blue'] : kind === 'fruit' ? ['paint_red', 'paint_orange', 'paint_yellow', 'leaves_light', 'paint_green', 'brick_red'] : ['paint_blue', 'paint_white', 'trim_dark', 'paint_red'];
  // Gestell
  g.wbox('wood_planks', f, u, 0, d, w, 0.7 * M, 0.7 * M, { skip: NB });
  const n = Math.max(2, Math.round(w / (0.35 * M)));
  for (let k = 0; k < n; k++) {
    const pu = u - w / 2 + (w * (k + 0.5)) / n;
    g.wbox(mats[k % mats.length], f, pu, 0.7 * M, d + (k % 2) * 0.1 * M - 0.05 * M, (w / n) * 0.9, kind === 'flowers' ? 0.4 * M + (k % 3) * 0.12 * M : 0.18 * M, 0.45 * M, { skip: NB });
  }
}

// Werbepylon (freistehend) mit Schriftzug
export function pylon(g, x, z, h, label, o = {}) {
  const w = o.w ?? 1.6 * M, t = 0.4 * M;
  g.box(o.mat || 'metal_dark', x, 0, z, w, h, t, { skip: NB });
  const f = { ox: x, oz: z + t / 2, ry: 0, c: 1, s: 0, len: w };
  const fb = { ox: x, oz: z - t / 2, ry: Math.PI, c: -1, s: 0, len: w };
  for (const ff of [f, fb]) {
    g.wbox(o.panel || 'sign_white', ff, 0, h - w * 0.9 - 0.1 * M, 0.02 * M, w * 0.85, w * 0.85, 0.03 * M, { skip: F.BACK });
    if (label && g.detail >= 1) {
      const px = (w * 0.75) / Math.max(5, textWidth(label));
      text(g, ff, label, 0, h - w * 0.9 - 0.1 * M + (w * 0.85 - 5 * px) / 2, 0.05 * M, px, o.text || 'paint_red', { depth: 0.02 * M });
    }
  }
  g.kit.light(x, h - w * 0.5, z, 0xffffff, 0.8);
}

// Fahnenmasten (Hotels, Autohäuser)
export function flags(g, x, z, n = 3, ry = 0, mats = ['paint_red', 'paint_blue', 'paint_white']) {
  if (g.detail < 1) return;
  const c = Math.cos(ry), s = Math.sin(ry);
  for (let k = 0; k < n; k++) {
    const a = (k - (n - 1) / 2) * 1.2 * M;
    const px = x + c * a, pz = z - s * a;
    g.cyl('metal_light', px, 0, pz, 0.04 * M, 7.0 * M, { seg: 5 });
    if (g.detail >= 2) g.box(mats[k % mats.length], px + c * 0.0 + s * 0.45 * M, 5.2 * M, pz + c * 0.45 * M, 0.02 * M, 1.6 * M, 0.9 * M, { ry });
  }
}
