// Atlas-Material für Gebäude (Besitzer G2): Alle undurchsichtigen Baustoffe in EINEM Material, damit ein
// Gebäude-Prototyp mit 1–4 Draw Calls auskommt. Jeder Vertex trägt das Attribut aMat (Index in ATLAS_INDEX).
//
// Inhalt: echte prozedurale PBR-Texturen aus WebGL2-Textur-Arrays (eine Schicht pro Muster: Putz, Ziegel, Beton,
// Dachziegel, Asphalt, Gras …) plus Parameter-Tabelle pro Material (Grund-/Zweitfarbe, Maßstab, Rauheit, Metall,
// Flags). Gleicher Shader wie getMaterial() – Atlas-Teile und Einzelmaterialien sehen identisch aus.
// Texturkoordinaten entstehen im Shader aus Weltposition und Normale; die Geometrie braucht nur
// position, normal und aMat (uv und aLit dürfen fehlen). Schnee, Nässe und Herbstlaub wie bei getMaterial().
// Mipmaps über textureGrad mit analytischen Ableitungen – keine Säume an Kanten oder Projektionswechseln.
//
// Schnittstelle (unverändert): ATLAS_NAMES, ATLAS_INDEX, isAtlasMaterial(name), getAtlasMaterial()
import { SURFACE_NAMES, SURFACE_INDEX, surfaceMaterial } from './matlib.js';

export const ATLAS_NAMES = SURFACE_NAMES;
export const ATLAS_INDEX = SURFACE_INDEX;
export const isAtlasMaterial = (name) => ATLAS_INDEX[name] !== undefined;

let mat = null;
export function getAtlasMaterial() {
  if (!mat) { mat = surfaceMaterial(0, true); mat.name = 'atlas'; }
  return mat;
}
