// Register der Architektur-Bausteine. Jeder Baustein erzeugt aus (Schlüssel, Stufe, Variante, Grundfläche)
// ein Modell aus dem Baukasten (kit.js). Gibt ein Baustein null zurück, zeichnet die Ansicht das alte Ersatzmodell.
import { Z } from '../../config.js';
import { mulberry32 } from '../../util.js';
import { Kit, M, FLOOR } from './kit.js';
import { MIX_STRIDE, MIX_VARIANTS, HEIGHT_FACTOR, decodeVariant, resolveVariant, tagOf } from './mix.js';
import { fitLot } from './fit.js';

export const ARCH = {}; // key → { variants, build(ctx) [, mix, count(level, fw, fd), list(level, fw, fd)] }
// mix: true → Zonen-Baustein mit Durchmischung (mix.js): variant = Modell-Nummer + 32 × Höhenklasse + …,
// count(level, fw, fd) nennt die Zahl verschiedener Modelle je Stufe und Grundfläche, list(level, fw, fd) die Typliste
// selbst (Funktionen mit Epoche und Bauweise, siehe tag() in mix.js).
export function registerArch(key, def) {
  const d = typeof def === 'function' ? { build: def, variants: 6 } : { variants: 6, ...def };
  if (d.mix) d.variants = MIX_VARIANTS;
  ARCH[key] = d;
}
// Zahl verschiedener Modelle eines Bausteins für Stufe und Grundfläche
export function archCount(key, level, fw, fd) {
  const def = ARCH[key];
  if (!def) return 1;
  if (def.list) return Math.max(1, Math.min(MIX_STRIDE, def.list(level, fw, fd).length));
  if (def.count) return Math.max(1, Math.min(MIX_STRIDE, def.count(level, fw, fd) | 0));
  return Math.max(1, Math.min(MIX_STRIDE, def.variants || 6));
}
// Epoche und Bauweise aller Modelle einer Typliste (ohne Liste: neutral, Solitär); die Listen stehen nach dem Laden fest
const TAGS = new Map();
export function archTags(key, level, fw, fd) {
  const id = `${key}|${level}|${fw}x${fd}`;
  let t = TAGS.get(id);
  if (t) return t;
  const def = ARCH[key];
  const n = archCount(key, level, fw, fd);
  if (!def || !def.list) t = Array.from({ length: n }, () => ({ era: 1.5, typ: 'S' }));
  else {
    const list = def.list(level, fw, fd);
    t = Array.from({ length: n }, (_, i) => tagOf(list[i % list.length]));
  }
  TAGS.set(id, t);
  return t;
}

const ZONE_KEY = { [Z.RES]: 'res', [Z.COM]: 'com', [Z.IND]: 'ind', [Z.OFF]: 'off' };
const NO_FIT = new Set(['oil', 'mine']); // Pumpenböcke und Fördertürme drehen (res.anim)

// Schlüssel für ein Gebäude der Simulation: Zonen nach Zone/Spezialisierung, sonst der Gebäudeschlüssel
export function archKeyFor(b) {
  if (b.zone) return b.spec || ZONE_KEY[b.zone];
  return b.key;
}

// Grundfläche relativ zur Front: fw = Breite an der Straße, fd = Tiefe (in Feldern)
export function frontFootprint(b, baseSize) {
  if (b.zone) return b.rot % 2 === 0 ? [b.w, b.h] : [b.h, b.w];
  return baseSize ? [baseSize[0], baseSize[1]] : [b.w, b.h];
}

// Baut ein Modell. Rückgabe: { meshes: [{material, geometry}], height, emitters, lights, triangles } oder null
export function buildArch(key, level, variant, fw, fd, extra = {}, detail = 2) {
  const def = ARCH[key];
  if (!def) return null;
  if (def.mix) variant = resolveVariant(key, level, variant, fw, fd, extra);
  const v = ((variant % def.variants) + def.variants) % def.variants;
  const dv = def.mix ? decodeVariant(v) : null;
  // Zufall nur aus Modell und Höhenklasse: Ecklage und Farbfamilie ändern nur, was der Baustein ausdrücklich liest
  const sv = dv ? dv.base : v;
  const rng = mulberry32((sv + 1) * 7919 + level * 104729 + fw * 13 + fd * 131 + key.length * 977);
  const kit = new Kit(rng, detail);
  const ctx = { key, level, variant: v, fw, fd, W: fw, D: fd, rng, kit, M, FLOOR, detail, ...extra };
  if (dv) {
    // Modell-Nummer und Höhenklasse; hf = Faktor für die Geschosszahl (Türme im dichten Zentrum höher)
    ctx.variant = dv.idx; ctx.hc = dv.hc; ctx.hf = HEIGHT_FACTOR[dv.hc];
    ctx.count = archCount(key, level, fw, fd);
    // Ecklage: 1 = linke, 2 = rechte Seite grenzt an eine Straße (von der Straße aus gesehen); pal = Farbfamilie
    ctx.cornerL = !!(dv.corner & 1); ctx.cornerR = !!(dv.corner & 2); ctx.pal = dv.pal;
    const t = archTags(key, level, fw, fd)[dv.idx % ctx.count];
    ctx.typ = t.typ; ctx.era = t.era;
    // Grundstücks-Einpassung (fit.js): Abstände, Bauflucht, keine Überstände ins Nachbargrundstück
    // (nicht bei Bausteinen mit drehenden Teilen – deren Drehpunkte liegen außerhalb des Baukastens)
    if (extra.fit !== false && !NO_FIT.has(key)) kit.fitCfg = { W: fw, D: fd, typ: t.typ, key, level, id: `${key}|${level}|${v}|${fw}x${fd}` };
  }
  const res = def.build(ctx);
  if (!res) return null;
  return res.meshes ? res : kit.build();
}
export { fitLot };
