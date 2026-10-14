// Register der Architektur-Bausteine. Jeder Baustein erzeugt aus (Schlüssel, Stufe, Variante, Grundfläche)
// ein Modell aus dem Baukasten (kit.js). Gibt ein Baustein null zurück, zeichnet die Ansicht das alte Ersatzmodell.
import { Z } from '../../config.js';
import { mulberry32 } from '../../util.js';
import { Kit, M, FLOOR } from './kit.js';
import { MIX_STRIDE, HEIGHT_FACTOR, decodeVariant, resolveVariant } from './mix.js';

export const ARCH = {}; // key → { variants, build(ctx) [, mix, count(level, fw, fd)] }
// mix: true → Zonen-Baustein mit Durchmischung (mix.js): variant = Modell-Nummer + 32 × Höhenklasse,
// count(level, fw, fd) nennt die Zahl verschiedener Modelle je Stufe und Grundfläche.
export function registerArch(key, def) {
  const d = typeof def === 'function' ? { build: def, variants: 6 } : { variants: 6, ...def };
  if (d.mix) d.variants = MIX_STRIDE * 3;
  ARCH[key] = d;
}
// Zahl verschiedener Modelle eines Bausteins für Stufe und Grundfläche
export function archCount(key, level, fw, fd) {
  const def = ARCH[key];
  if (!def) return 1;
  if (def.count) return Math.max(1, Math.min(MIX_STRIDE, def.count(level, fw, fd) | 0));
  return Math.max(1, Math.min(MIX_STRIDE, def.variants || 6));
}

const ZONE_KEY = { [Z.RES]: 'res', [Z.COM]: 'com', [Z.IND]: 'ind', [Z.OFF]: 'off' };

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
  const rng = mulberry32((v + 1) * 7919 + level * 104729 + fw * 13 + fd * 131 + key.length * 977);
  const kit = new Kit(rng, detail);
  const ctx = { key, level, variant: v, fw, fd, W: fw, D: fd, rng, kit, M, FLOOR, detail, ...extra };
  if (def.mix) {
    // Modell-Nummer und Höhenklasse; hf = Faktor für die Geschosszahl (Türme im dichten Zentrum höher)
    const { idx, hc } = decodeVariant(v);
    ctx.variant = idx; ctx.hc = hc; ctx.hf = HEIGHT_FACTOR[hc];
    ctx.count = archCount(key, level, fw, fd);
  }
  const res = def.build(ctx);
  if (!res) return null;
  return res.meshes ? res : kit.build();
}
