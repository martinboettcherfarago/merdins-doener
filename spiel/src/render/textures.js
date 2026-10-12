// Textur-System (Besitzer G2): prozedurale PBR-Texturen für alle Baustoffe, Böden und Pflanzen.
//
// Die Muster entstehen einmal beim ersten Bedarf (tex_gen.js, reines JavaScript, ca. 0,5–1 s) und liegen dann
//   a) als zwei WebGL2-Textur-Arrays vor (eine Schicht pro Muster, 256² mit Mipmaps und Anisotropie):
//      albedo  – RGB Detail (×255/128, 1 = neutral), A Maske für die Zweitfarbe
//      surface – RG Normale (Tangentenraum), B Rauheit, A Umgebungsverdeckung
//      Diese nutzen getMaterial() (matlib.js) und das Atlas-Material (atlas.js).
//   b) auf Wunsch als fertige 2D-Texturen für eigene Shader (Gelände G7, Straßen G8 …):
//
//   import { getTexture, getSurfaceArrays, prepareTextures, textureStats } from './textures.js';
//   const t = getTexture('grass');   // Materialname aus MATERIAL_DEFS (matlib.js)
//   t.map         – sRGB-Farbe (Grund- und Zweitfarbe eingerechnet), RepeatWrapping, Mipmaps
//   t.normalMap   – Normalen (OpenGL-Konvention, Tangentenraum, RGB)
//   t.ormMap      – R = Verdeckung, G = Rauheit, B = Metall (passt zu aoMap/roughnessMap/metalnessMap)
//   t.metersPerTile – eine Texturkachel entspricht so vielen Metern (4 m / Maßstab); Welteinheit = 10 m,
//                     also uv = weltXZ * 10 / t.metersPerTile
//   getSurfaceArrays() → { albedo, surface, layers, layerIndex } für Shader mit vielen Mustern
//                     (z. B. Geländemischung: sampler2DArray, Schicht = layerIndex['grass'] …)
//   prepareTextures(onProgress) → Promise; erzeugt die Muster stückweise (für einen Ladebildschirm).
import * as THREE from 'three';
import { TS, LAYERS, LAYER_INDEX, SURFACE, generateLayer, clearFieldCache, F_GROUND, F_CUTOUT, F_PUDDLE, F_LEAVES } from './tex_gen.js';

export { LAYERS, LAYER_INDEX, SURFACE, F_GROUND, F_CUTOUT, F_PUDDLE, F_LEAVES };

const BYTES = TS * TS * 4;
const stats = { ms: 0, layers: LAYERS.length, size: TS, bytes: 0, textures2d: 0 };
export const textureStats = () => ({ ...stats });

// --- CPU-Daten aller Schichten
let data = null, pending = null;
function now() { return (typeof performance !== 'undefined' ? performance : Date).now(); }
function allocData() { return { albedo: new Uint8Array(BYTES * LAYERS.length), surface: new Uint8Array(BYTES * LAYERS.length), done: 0 }; }
export function textureData() {
  if (data && data.done === LAYERS.length) return data;
  const t0 = now();
  if (!data) data = allocData();
  for (let k = data.done; k < LAYERS.length; k++) { generateLayer(LAYERS[k], data.albedo, data.surface, k * BYTES); data.done = k + 1; }
  clearFieldCache();
  stats.ms += now() - t0; stats.bytes = data.albedo.length * 2;
  return data;
}
// Stückweise Erzeugung mit Pausen (für Ladebildschirme). onProgress(0..1)
export function prepareTextures(onProgress) {
  if (data && data.done === LAYERS.length) { if (onProgress) onProgress(1); return Promise.resolve(); }
  if (pending) return pending;
  pending = new Promise((resolve) => {
    if (!data) data = allocData();
    const step = () => {
      const t0 = now();
      while (data.done < LAYERS.length && now() - t0 < 24) { generateLayer(LAYERS[data.done], data.albedo, data.surface, data.done * BYTES); data.done++; }
      stats.ms += now() - t0;
      if (onProgress) onProgress(data.done / LAYERS.length);
      if (data.done < LAYERS.length) setTimeout(step, 0);
      else { clearFieldCache(); stats.bytes = data.albedo.length * 2; resolve(); }
    };
    step();
  });
  return pending;
}

function arrayTex(buf) {
  const t = new THREE.DataArrayTexture(buf, TS, TS, LAYERS.length);
  t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true; t.anisotropy = 8; t.unpackAlignment = 4;
  t.needsUpdate = true;
  return t;
}
let arrays = null;
export function getSurfaceArrays() {
  if (arrays) return arrays;
  const d = textureData();
  arrays = { albedo: arrayTex(d.albedo), surface: arrayTex(d.surface), layers: LAYERS, layerIndex: LAYER_INDEX, size: TS };
  return arrays;
}

// --- Farben
const _c = new THREE.Color();
const lin = (hex) => { _c.setHex(hex); return [_c.r, _c.g, _c.b]; }; // sRGB-Hex → linear (ColorManagement)
// Zweitfarbe auflösen: Zahl (sRGB-Hex) | 'base' | 'dark' | 'dirt'
export function secondColor(spec, base) {
  if (typeof spec === 'number') return lin(spec);
  if (spec === 'base') return base.slice();
  if (spec === 'dark') return base.map((c) => c * 0.35);
  if (spec === 'dirt' || spec === undefined) return base.map((c, i) => (c * 0.55 + [0.3, 0.28, 0.24][i] * 0.45) * 0.8);
  return base.map((c) => c * 0.6);
}
// typische Rauheit einer Schicht (Mittelwert des Musters) – damit die Rauheit aus MATERIAL_DEFS stimmt
const LAYER_ROUGH = {
  macro: 0.8, plaster: 0.84, brick: 0.85, concrete: 0.86, platte: 0.88, ashlar: 0.85, stone: 0.8, granite: 0.62, marble: 0.26, wood: 0.78,
  siding: 0.68, cassette: 0.52, corrugated: 0.56, pantile: 0.74, beaver: 0.75, slate: 0.6, seam: 0.47, gravel: 0.88, membrane: 0.78,
  sedum: 0.9, solar: 0.2, asphalt: 0.88, pavers: 0.85, slabs: 0.86, setts: 0.78, grass: 0.94, turf: 0.9, dirt: 0.94, rows: 0.9,
  sand: 0.94, rock: 0.85, leaves: 0.82, bark: 0.94, fabric: 0.86, paint: 0.6, metal: 0.53, rust: 0.9, tiles: 0.22, epdm: 0.92,
  straw: 0.9, thatch: 0.9, chain: 0.5, net: 0.9,
};

// Ersatz für Materialnamen ohne Eintrag in SURFACE (neue Namen anderer Agenten): nach Wortteilen raten
function guessSurface(name) {
  const rules = [['brick', 'brick'], ['plaster', 'plaster'], ['concrete', 'concrete'], ['stone', 'ashlar'], ['wood', 'wood'], ['siding', 'siding'],
    ['corrug', 'corrugated'], ['metal', 'metal'], ['roof_tiles', 'pantile'], ['slate', 'slate'], ['roof', 'seam'], ['grass', 'grass'], ['asphalt', 'asphalt'],
    ['paver', 'pavers'], ['gravel', 'gravel'], ['sand', 'sand'], ['dirt', 'dirt'], ['soil', 'dirt'], ['leaves', 'leaves'], ['field', 'rows'], ['tile', 'tiles']];
  for (const [k, l] of rules) if (name.includes(k)) return { layer: l };
  return { layer: 'paint', second: 'base' };
}
export function surfaceOf(name) { return SURFACE[name] || guessSurface(name); }

// Parameter-Tabelle aller Oberflächen-Materialien (DataTexture, Breite = Anzahl, Höhe = 4, Float):
// Zeile 0: Grundfarbe (linear) rgb, Schicht | 1: Zweitfarbe rgb, Normalenstärke | 2: Maßstab u, v, Rauheitsfaktor, Metall
// Zeile 3: Flags, Wandfuß-Schmutz, Nässe-Abdunklung, Schneehaftung
export function buildParamTexture(names, defs) {
  const n = Math.max(1, names.length), arr = new Float32Array(n * 4 * 4);
  names.forEach((name, i) => {
    const def = defs[name] || [0xff00ff, 0.8, 0];
    const s = surfaceOf(name);
    const base = lin(def[0]), sec = secondColor(s.second, base);
    const layer = LAYER_INDEX[s.layer] ?? LAYER_INDEX.paint;
    const sc = Array.isArray(s.scale) ? s.scale : [s.scale ?? 1, s.scale ?? 1];
    const rough = (def[1] ?? 0.8) / (LAYER_ROUGH[s.layer] || 0.8) * (s.rough ?? 1);
    const metal = def[2] ?? 0;
    const flags = s.flags || 0;
    const ground = flags & F_GROUND;
    const grime = s.grime ?? (ground ? 0 : 1);
    const porous = s.porous ?? (metal >= 0.35 ? 0.25 : ground ? 0.85 : 0.7);
    const snow = s.snow ?? 1;
    const put = (row, a, b, c, d) => { const o = (row * n + i) * 4; arr[o] = a; arr[o + 1] = b; arr[o + 2] = c; arr[o + 3] = d; };
    put(0, base[0], base[1], base[2], layer);
    put(1, sec[0], sec[1], sec[2], s.normal ?? 1);
    put(2, sc[0], sc[1], rough, metal);
    put(3, flags, grime, porous, snow);
  });
  const t = new THREE.DataTexture(arr, n, 4, THREE.RGBAFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

// --- Einzelne 2D-Texturen für andere Agenten (Farbe, Normale, ORM) – zwischengespeichert
const tex2d = new Map();
function dataTex(arr, srgb) {
  const t = new THREE.DataTexture(arr, TS, TS, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true; t.anisotropy = 8; t.flipY = false;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}
const toS = (c) => { c = Math.max(0, Math.min(1, c)); return 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055); };
// defs: MATERIAL_DEFS (wird von matlib.js gesetzt, damit hier kein Import-Kreis entsteht)
let defsRef = null;
export function setTextureDefs(defs) { defsRef = defs; }
export function getTexture(name) {
  if (tex2d.has(name)) return tex2d.get(name);
  const def = (defsRef && defsRef[name]) || [0x808080, 0.8, 0];
  const s = surfaceOf(name), layer = LAYER_INDEX[s.layer] ?? LAYER_INDEX.paint;
  const d = textureData(), off = layer * BYTES;
  const base = lin(def[0]), sec = secondColor(s.second, base);
  const col = new Uint8ClampedArray(BYTES), nor = new Uint8ClampedArray(BYTES), orm = new Uint8ClampedArray(BYTES);
  const rough = (def[1] ?? 0.8) / (LAYER_ROUGH[s.layer] || 0.8) * (s.rough ?? 1), metal = (def[2] ?? 0) * 255, ns = s.normal ?? 1;
  for (let i = 0; i < TS * TS; i++) {
    const o = i * 4, a = d.albedo, f = d.surface, m = a[off + o + 3] / 255;
    for (let c = 0; c < 3; c++) col[o + c] = toS((base[c] * (1 - m) + sec[c] * m) * a[off + o + c] / 128);
    col[o + 3] = 255;
    let nx = (f[off + o] / 127.5 - 1), ny = (f[off + o + 1] / 127.5 - 1);
    const nz = Math.sqrt(Math.max(1e-4, 1 - nx * nx - ny * ny)); nx *= ns; ny *= ns;
    const l = 1 / Math.hypot(nx, ny, nz);
    nor[o] = (nx * l * 0.5 + 0.5) * 255; nor[o + 1] = (ny * l * 0.5 + 0.5) * 255; nor[o + 2] = (nz * l * 0.5 + 0.5) * 255; nor[o + 3] = 255;
    orm[o] = f[off + o + 3]; orm[o + 1] = f[off + o + 2] * rough; orm[o + 2] = metal; orm[o + 3] = 255;
  }
  const sc = Array.isArray(s.scale) ? s.scale[0] : s.scale ?? 1;
  const r = { map: dataTex(new Uint8Array(col.buffer), true), normalMap: dataTex(new Uint8Array(nor.buffer), false), ormMap: dataTex(new Uint8Array(orm.buffer), false), metersPerTile: 4 / sc, layer, name };
  r.roughnessMap = r.ormMap; r.aoMap = r.ormMap;
  tex2d.set(name, r);
  stats.textures2d = tex2d.size;
  return r;
}
