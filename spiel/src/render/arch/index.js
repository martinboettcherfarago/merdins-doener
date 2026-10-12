// Register der Architektur-Bausteine. Jeder Baustein erzeugt aus (Schlüssel, Stufe, Variante, Grundfläche)
// ein Modell aus dem Baukasten (kit.js). Gibt ein Baustein null zurück, zeichnet die Ansicht das alte Ersatzmodell.
import { Z } from '../../config.js';
import { mulberry32 } from '../../util.js';
import { Kit, M, FLOOR } from './kit.js';

export const ARCH = {}; // key → { variants, build(ctx) }
export function registerArch(key, def) {
  ARCH[key] = typeof def === 'function' ? { build: def, variants: 6 } : { variants: 6, ...def };
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
  const v = ((variant % def.variants) + def.variants) % def.variants;
  const rng = mulberry32((v + 1) * 7919 + level * 104729 + fw * 13 + fd * 131 + key.length * 977);
  const kit = new Kit(rng, detail);
  const ctx = { key, level, variant: v, fw, fd, W: fw, D: fd, rng, kit, M, FLOOR, detail, ...extra };
  const res = def.build(ctx);
  if (!res) return null;
  return res.meshes ? res : kit.build();
}
