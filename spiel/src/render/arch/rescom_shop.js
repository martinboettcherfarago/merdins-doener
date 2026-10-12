// Ladenbau-Werkzeuge für Gewerbe (Besitzer G3): Schaufensterzonen mit Schildband, Markise und Licht,
// Vorhangfassaden, Vordächer, Tankstellendach, Gewächshaus, Einkaufswagen-Unterstand.
import { M } from './kit.js';
import { F, NB, W, rpick } from './rescom_geo.js';
import { mframe } from './rescom_facade.js';
import { signBand, awning, bladeSign, text, textWidth } from './rescom_signs.js';

export const NAMES = {
  baker: ['BÄCKEREI', 'BACKSTUBE', 'BROT & CAFÉ', 'BÄCKER'],
  cafe: ['CAFÉ', 'KAFFEEHAUS', 'EISCAFÉ', 'BISTRO', 'CAFÉ CENTRAL'],
  kiosk: ['KIOSK', 'TRINKHALLE', 'LOTTO'],
  snack: ['IMBISS', 'PIZZA', 'GRILL', 'CURRYWURST', 'PIZZERIA'],
  flowers: ['BLUMEN', 'FLORISTIK', 'BLUMENHAUS'],
  hair: ['FRISEUR', 'SALON', 'HAARWERK'],
  shop: ['MODE', 'SCHUHE', 'OPTIK', 'BÜCHER', 'ELEKTRO', 'SPIELWAREN', 'FAHRRÄDER', 'BIOLADEN', 'FEINKOST', 'UHREN', 'TEXTIL', 'GESCHENKE', 'TABAK', 'WEIN'],
  market: ['MARKT', 'SUPERMARKT', 'FRISCHMARKT', 'BIOMARKT', 'NAHKAUF'],
  pharmacy: ['APOTHEKE'],
  hotel: ['HOTEL', 'HOTEL AM PARK', 'PENSION', 'HOTEL ZENTRAL', 'GRAND HOTEL'],
  inn: ['GASTHAUS', 'WIRTSHAUS', 'ZUM ANKER', 'ZUR LINDE', 'BRAUHAUS'],
  rest: ['RESTAURANT', 'TRATTORIA', 'BRASSERIE', 'TAVERNE'],
  kino: ['KINO', 'LICHTSPIELE', 'FILMPALAST'],
  store: ['KAUFHAUS', 'WARENHAUS', 'MODEHAUS'],
  center: ['CENTER', 'GALERIE', 'PASSAGE', 'STADTPULS CENTER', 'ARKADEN'],
  bank: ['BANK', 'VOLKSBANK', 'STADTBANK'],
  fuel: ['TANKSTELLE'],
  garden: ['GARTENCENTER', 'GÄRTNEREI'],
  diy: ['BAUMARKT'],
  fast: ['BURGER', 'DRIVE-IN'],
  garage: ['WERKSTATT', 'AUTOHAUS'],
};
export const AWNINGS = ['awning_red', 'awning_blue', 'awning_green', 'awning_yellow', 'awning_striped', 'awning_striped', 'canvas_white'];
export const NEON = ['neon_pink', 'neon_cyan', 'neon_yellow', 'sign_white', 'emissive_red', 'emissive_green'];

// Dekoration über einer Schaufensteröffnung (op schon in der Wand): Schildband mit Schrift, Markise, Ausleger, Licht
export function shopDecor(g, f, op, o = {}) {
  const top = op.y + op.h;
  const w = op.w + (o.extra ?? 0.2 * M);
  if (o.name) {
    const bh = o.bandH ?? 0.75 * M;
    signBand(g, f, o.name, op.u, top + (o.bandGap ?? 0.12 * M), w, bh, { band: o.band === undefined ? 'trim_dark' : o.band, mat: o.letters || rpick(g.rng, ['sign_white', 'neon_yellow', 'sign_white', 'neon_cyan', 'neon_pink']), maxPx: o.maxPx, fill: o.fill });
  }
  if (o.awning) awning(g, f, op.u, top + (o.name ? -0.02 * M : 0.15 * M), op.w + 0.3 * M, o.awningD ?? 1.5 * M, o.awning, o.awningType || 'fixed');
  if (o.blade) bladeSign(g, f, op.u + op.w / 2 + 0.5 * M, top + 0.15 * M, { glyph: o.blade, glyphMat: o.bladeMat || 'paint_red', panel: o.bladePanel || 'sign_white' });
  if (o.lights !== false) {
    const [x, , z] = W(f, op.u, 0, 0.6 * M);
    g.kit.light(x, op.y + op.h * 0.5, z, 0xffe2b0, Math.min(1.4, op.w * 1.2));
  }
}

// Vorhangfassade auf einer Wandfläche (u0..u1, y0..y1): Glas je Geschoss, Pfosten und Riegel
export function curtain(g, f, u0, u1, y0, y1, o = {}) {
  const glass = o.glass || 'glass_curtain_blue', frame = o.frame || 'metal_dark';
  const fh = o.fh ?? 3.6 * M, colW = o.colW ?? 1.5 * M;
  const d = o.d ?? 0.03 * M;
  const len = u1 - u0, uc = (u0 + u1) / 2;
  const floors = Math.max(1, Math.round((y1 - y0) / fh));
  const fhh = (y1 - y0) / floors;
  if (g.detail === 0) { g.wquad(glass, f, uc, y0, d, len, y1 - y0, g.rng()); return; }
  for (let k = 0; k < floors; k++) g.wquad(glass, f, uc, y0 + k * fhh + 0.02 * M, d, len - 0.02 * M, fhh - 0.04 * M, g.rng());
  const cols = Math.max(1, Math.round(len / colW));
  for (let k = 0; k <= cols; k++) g.wbox(frame, f, u0 + (k * len) / cols, y0, d + 0.04 * M, 0.08 * M, y1 - y0, 0.1 * M, { skip: F.BACK | F.BOTTOM | F.TOP });
  for (let k = 0; k <= floors; k++) g.wbox(frame, f, uc, y0 + k * fhh - 0.06 * M, d + 0.05 * M, len, 0.12 * M, 0.12 * M, { skip: F.BACK });
  if (o.spandrel && g.detail >= 1) for (let k = 1; k < floors; k++) g.wquad(o.spandrel, f, uc, y0 + k * fhh - 0.45 * M, d + 0.01 * M, len - 0.04 * M, 0.5 * M);
}

// Glasbox (Pavillon) als Baukörper aus Vorhangfassaden auf allen Seiten
export function glassBox(g, m, o = {}) {
  for (const side of ['front', 'back', 'left', 'right']) {
    if (o.skip && o.skip.includes(side)) continue;
    const f = mframe(m.cx, m.cz, m.sx, m.sz, side, m.ry || 0);
    g.wquad(o.back || 'trim_dark', f, 0, m.y0, -0.01 * M, f.len, m.y1 - m.y0);
    curtain(g, f, -f.len / 2, f.len / 2, m.y0, m.y1, o);
  }
}

// Tankstellendach mit Zapfsäulen
export function fuelCanopy(g, x, z, sx, sz, h = 4.8 * M, o = {}) {
  const mat = o.mat || 'paint_white', band = o.band || 'paint_red';
  g.box(mat, x, h, z, sx, 0.25 * M, sz);
  g.box(band, x, h + 0.25 * M, z, sx + 0.04 * M, 0.55 * M, sz + 0.04 * M, { skip: F.BOTTOM });
  g.hquad('emissive_cool', x, h - 0.005 * M, z, sx * 0.9, sz * 0.8);
  if (g.detail >= 1) {
    const f = { ox: x, oz: z + sz / 2 + 0.02 * M, ry: 0, c: 1, s: 0, len: sx };
    signBand(g, f, o.name || 'TANKSTELLE', 0, h + 0.27 * M, sx * 0.9, 0.5 * M, { band: null, mat: 'sign_white', depth: 0.02 * M, light: false });
  }
  const nP = Math.max(2, Math.round(sx / (4.0 * M)));
  for (let k = 0; k < nP; k++) {
    const px = x - sx / 2 + (sx * (k + 0.5)) / nP;
    g.box('concrete', px, 0, z, 1.0 * M, 0.2 * M, sz * 0.55, { skip: NB });
    g.box('metal_dark', px, 0, z, 0.25 * M, h, 0.25 * M, { skip: F.TOP | F.BOTTOM });
    if (g.detail >= 1) for (const sg of [-1, 1]) {
      g.box(o.pump || 'paint_white', px, 0.2 * M, z + sg * sz * 0.17, 0.7 * M, 1.7 * M, 0.45 * M, { skip: NB });
      g.box(band, px, 1.75 * M, z + sg * sz * 0.17, 0.72 * M, 0.25 * M, 0.47 * M);
    }
  }
  for (let k = 0; k < 4; k++) g.kit.light(x - sx / 2 + sx * (k + 0.5) / 4, h - 0.2 * M, z, 0xe8f4ff, 0.9);
}

// Gewächshaus (Gärtnerei, Gartencenter)
export function greenhouse(g, x, z, sx, sz, h = 3.0 * M) {
  const glass = 'glass_skylight';
  const m = { cx: x, cz: z, sx, sz };
  for (const side of ['front', 'back', 'left', 'right']) {
    const f = mframe(m.cx, m.cz, sx, sz, side);
    g.wquad(glass, f, 0, 0.3 * M, 0, f.len, h - 0.3 * M, 0.99);
    g.wquad('concrete', f, 0, 0, 0.01 * M, f.len, 0.3 * M);
    if (g.detail >= 1) { const n = Math.max(2, Math.round(f.len / (1.5 * M))); for (let k = 0; k <= n; k++) g.wbox('metal_light', f, -f.len / 2 + (f.len * k) / n, 0, 0.02 * M, 0.06 * M, h, 0.06 * M, { skip: F.BACK | F.BOTTOM }); }
  }
  // Satteldach aus Glas
  const rh = Math.min(sz, sx) * 0.25;
  const along = sx >= sz;
  const L = along ? sx : sz, B = along ? sz : sx;
  const P = (a, y, b) => along ? [x + a, y, z + b] : [x + b, y, z + a];
  g.quad(glass, P(-L / 2, h, B / 2), P(L / 2, h, B / 2), P(L / 2, h + rh, 0), P(-L / 2, h + rh, 0), 0.99, [0, 1, 0]);
  g.quad(glass, P(L / 2, h, -B / 2), P(-L / 2, h, -B / 2), P(-L / 2, h + rh, 0), P(L / 2, h + rh, 0), 0.99, [0, 1, 0]);
  for (const e of [-1, 1]) g.tri(glass, P(e * L / 2, h, -B / 2), P(e * L / 2, h, B / 2), P(e * L / 2, h + rh, 0), 0.99, along ? [e, 0, 0] : [0, 0, e]);
  if (g.detail >= 1) {
    g.box('metal_light', x, h + rh - 0.03 * M, z, along ? L : 0.08 * M, 0.08 * M, along ? 0.08 * M : L);
    // Pflanzentische drinnen sind nicht sichtbar – Pflanzreihen davor
  }
}

// Einkaufswagen-Unterstand
export function cartShelter(g, x, z, w = 3.0 * M, ry = 0) {
  if (g.detail < 1) return;
  g.box('metal_light', x, 2.1 * M, z, w, 0.06 * M, 1.6 * M, { ry });
  const c = Math.cos(ry), s = Math.sin(ry);
  for (const e of [-1, 1]) g.box('metal_dark', x + c * e * (w / 2 - 0.1 * M), 0, z - s * e * (w / 2 - 0.1 * M), 0.06 * M, 2.1 * M, 0.06 * M, { ry, skip: F.TOP | F.BOTTOM });
  if (g.detail >= 2) g.box('chain_fence', x, 0.2 * M, z, w - 0.3 * M, 0.9 * M, 1.2 * M, { ry, skip: NB });
}

// Großer Dachschriftzug (Leuchtbuchstaben auf Gestell) über einer Kante
export function roofSign(g, f, str, u, y, w, mat = 'sign_white', o = {}) {
  const px = Math.min((w * 0.95) / Math.max(1, textWidth(str)), o.maxPx ?? 0.5 * M);
  const h = 5 * px;
  if (g.detail >= 1) {
    g.wbox('metal_dark', f, u, y, -0.4 * M, textWidth(str) * px, 0.1 * M, 0.1 * M);
    const n = Math.max(2, Math.round((textWidth(str) * px) / (2.5 * M)));
    for (let k = 0; k <= n; k++) g.wbox('metal_dark', f, u - textWidth(str) * px / 2 + (textWidth(str) * px * k) / n, y, -0.4 * M, 0.06 * M, h * 0.9, 0.06 * M, { skip: F.TOP | F.BOTTOM });
  }
  if (g.detail === 0) { g.wquad(mat, f, u, y + 0.1 * M, -0.3 * M, textWidth(str) * px, h); return h; }
  text(g, f, str, u, y + 0.1 * M, -0.32 * M, px, mat, { depth: 0.12 * M });
  const [x, , z] = W(f, u, 0, 0.5 * M);
  g.kit.light(x, y + h / 2, z, 0xffffff, w * 0.8);
  return h;
}
