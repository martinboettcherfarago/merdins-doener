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
//   prepareTextures(onProgress) → Promise, erfüllt wenn alle Muster fertig sind (für einen Ladebildschirm);
//   texturesReady(), textureStats() → { ms, mode: 'worker'|'chunked'|'sync', ready, bytes … }.
// Im Browser startet die Erzeugung beim Laden dieses Moduls in einem Web Worker; der Hauptfaden wird nicht
// blockiert. Bis die Muster da sind, zeigen die Materialien ihre Grundfarben (neutrale Platzhalter).
import * as THREE from 'three';
import { TS, LAYERS, LAYER_INDEX, SURFACE, generateLayer, clearFieldCache, texGenFactory, F_GROUND, F_CUTOUT, F_PUDDLE, F_LEAVES } from './tex_gen.js';

export { LAYERS, LAYER_INDEX, SURFACE, F_GROUND, F_CUTOUT, F_PUDDLE, F_LEAVES };

const BYTES = TS * TS * 4;
const stats = { ms: 0, layers: LAYERS.length, size: TS, bytes: 0, textures2d: 0, ready: false, mode: '' };
export const textureStats = () => ({ ...stats });

// --- CPU-Daten aller Schichten
// Im Browser rechnet ein Web Worker die Muster im Hintergrund (Start beim Laden des Moduls). Bis sie da sind,
// enthalten die Puffer neutrale Werte (Materialien zeigen ihre Grundfarbe); danach werden die Textur-Arrays
// einmal neu hochgeladen. Ohne Worker (Node, gesperrte Blob-URLs) wird synchron bzw. stückweise erzeugt.
const NL = LAYERS.length;
let data = null, worker = null, readyResolve = null;
const ready = new Promise((r) => { readyResolve = r; });
function now() { return (typeof performance !== 'undefined' ? performance : Date).now(); }
function allocData() {
  const albedo = new Uint8Array(BYTES * NL), surface = new Uint8Array(BYTES * NL);
  new Uint32Array(albedo.buffer).fill(0x00808080);  // Detail 1.0, keine Zweitfarbe
  new Uint32Array(surface.buffer).fill(0xffcc8080); // flache Normale, Rauheit 0.8, keine Verdeckung
  return { albedo, surface, done: new Uint8Array(NL), count: 0 };
}
function ensureData() { if (!data) data = allocData(); return data; }
function finish() {
  if (data.count < NL) return;
  clearFieldCache();
  stats.bytes = data.albedo.length * 2; stats.ready = true;
  if (arrays) { arrays.albedo.needsUpdate = true; arrays.surface.needsUpdate = true; }
  if (worker) { worker.terminate(); worker = null; }
  readyResolve();
}
function ensureLayer(k) {
  const d = ensureData();
  if (d.done[k]) return;
  generateLayer(LAYERS[k], d.albedo, d.surface, k * BYTES);
  d.done[k] = 1; d.count++;
}
// Synchron: alle Schichten fertig (blockiert, falls der Worker noch rechnet)
export function textureData() {
  const d = ensureData();
  if (d.count < NL) {
    const t0 = now();
    for (let k = 0; k < NL; k++) ensureLayer(k);
    stats.ms += now() - t0; stats.mode = stats.mode || 'sync';
    finish();
  }
  return d;
}
// Stückweise auf dem Hauptfaden (Ersatz, wenn kein Worker möglich ist)
function chunked() {
  const d = ensureData();
  stats.mode = 'chunked';
  const step = () => {
    const t0 = now();
    for (let k = 0; k < NL && now() - t0 < 20; k++) ensureLayer(k);
    stats.ms += now() - t0;
    if (d.count < NL) setTimeout(step, 0); else finish();
  };
  step();
}
function startWorker() {
  if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return false;
  try {
    const src = `const G = (${texGenFactory.toString()})();
onmessage = (e) => { const B = G.TS * G.TS * 4, t0 = performance.now();
  for (const k of e.data.layers) { const a = new Uint8Array(B), s = new Uint8Array(B); G.generateLayer(G.LAYERS[k], a, s, 0); postMessage({ k, a, s }, [a.buffer, s.buffer]); }
  G.clearFieldCache(); postMessage({ done: true, ms: performance.now() - t0 }); };`;
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const w = new Worker(url);
    URL.revokeObjectURL(url);
    const d = ensureData(), t0 = now();
    let heard = false;
    const fail = () => { if (worker !== w) return; w.terminate(); worker = null; if (d.count < NL) chunked(); };
    w.onmessage = (e) => {
      heard = true;
      const m = e.data;
      if (m.done) { stats.workerMs = m.ms; stats.ms = now() - t0; if (d.count < NL) textureData(); else finish(); return; }
      if (!d.done[m.k]) { d.albedo.set(m.a, m.k * BYTES); d.surface.set(m.s, m.k * BYTES); d.done[m.k] = 1; d.count++; }
      if (d.count === NL) { stats.ms = now() - t0; finish(); }
    };
    w.onerror = (e) => { if (e && e.preventDefault) e.preventDefault(); fail(); };
    setTimeout(() => { if (!heard) fail(); }, 5000);
    worker = w; stats.mode = 'worker';
    const todo = []; for (let k = 0; k < NL; k++) if (!d.done[k]) todo.push(k);
    w.postMessage({ layers: todo });
    return true;
  } catch (e) { worker = null; return false; }
}
let started = false;
// Startet die Erzeugung im Hintergrund (idempotent). Rückgabe: Promise, erfüllt wenn alle Muster fertig sind.
export function startTextures() {
  if (!started) { started = true; if (!startWorker()) { if (typeof setTimeout !== 'undefined' && typeof window !== 'undefined') chunked(); else textureData(); } }
  return ready;
}
// Für Ladebildschirme: onProgress(0..1); erfüllt, wenn alle Muster fertig sind
export function prepareTextures(onProgress) {
  startTextures();
  if (onProgress) {
    const tick = () => { const p = data ? data.count / NL : 0; onProgress(p); if (p < 1) setTimeout(tick, 50); };
    tick();
  }
  return ready;
}
export const texturesReady = () => !!(data && data.count === NL);
if (typeof window !== 'undefined' && typeof document !== 'undefined') startTextures();

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
// Textur-Arrays; im Browser sofort verfügbar (anfangs neutral, die Muster folgen aus dem Worker)
export function getSurfaceArrays() {
  if (arrays) return arrays;
  const d = started ? ensureData() : textureData();
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
  ensureLayer(layer);
  const d = data, off = layer * BYTES;
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
