// Prototyp-Bibliothek und Bündelung für Gebäude. Besitzer: G9 (Gebäude-Renderer).
//
// Überblick
//  • ProtoManager.get(...) baut jedes Modell (Architektur-Baustein oder Ersatzmodell) genau einmal pro
//    Detailstufe und bereitet es auf: alle undurchsichtigen Baustoffe werden zu EINER Geometrie mit dem
//    Attribut aMat zusammengefasst (Material aus getAtlasMaterial()); Glas, Leuchtendes, lod_windows und
//    Wasser bleiben getrennt. Ergebnis: meist 1–4 Draw Calls pro Prototyp.
//  • alloc/set/release/flush: instanzierte Darstellung (Nah-/Mittelbereich, Baustellen). Instanzen liegen
//    dicht gepackt (Freigabe tauscht mit der letzten), leere Prototypen zeichnen nichts.
//  • Batcher: statisches Bündeln fertiger Gebäude pro Kartenabschnitt (Fernbereich). Eine echte,
//    zusammengeführte Geometrie pro Abschnitt und Material; neue Gebäude werden angehängt, entfernte
//    werden ausgeblendet und die Lücken gelegentlich verdichtet.
//  • StateTable: Zustand jedes Gebäudes (Einfärbung, Fenster an/aus, verwittert, verkohlt, Brand,
//    Bauhöhe, Abriss, Sichtbarkeit) steht in einer Gleitkomma-Textur. Jede Ecke (Bündel) bzw. Instanz
//    trägt nur ihre Zeilennummer aG9id – Zustandswechsel kosten keine Geometrie-Uploads.
//  • g9Material(base): abgeleitetes Material, das die Shader-Erweiterungen von G2 (Atlas, Glas, Fenster)
//    unverändert übernimmt und die Zustände ergänzt. Schatten nutzen ein passendes Tiefenmaterial.
//
// Schnittstelle (bleibt): get(key, level, variant, fw, fd, extra[, detail]) → proto | null,
//   alloc(proto[, slot]) → handle, set(proto, handle, matrix[, color]), release(proto, handle), flush(), stats().
import * as THREE from 'three';
import { getMaterial, MATERIAL_DEFS } from './matlib.js';
import { getAtlasMaterial, isAtlasMaterial, ATLAS_INDEX } from './atlas.js';
import { buildArch, ARCH } from './arch/all.js';
import { Kit } from './arch/kit.js';
import { mulberry32 } from '../util.js';
import { shared } from './materials.js';

// Gleiche Form in allen Detailstufen: Einige Baukasten-Funktionen ziehen je nach Detailstufe unterschiedlich viele
// Zufallszahlen (Detail 0: eine pro Fassade, sonst eine pro Fenster). Alles, was ein Baustein danach auswürfelt
// (Dachhöhe, Farben, Bäume …), wäre sonst je Stufe anders und „springt" beim Umschalten. Diese Funktionen nutzen
// deshalb für ihre Leuchtwerte einen eigenen Generator; kit.js selbst bleibt unverändert.
for (const name of ['windows', 'window', 'curtainWall', 'rooftopClutter']) {
  const orig = Kit.prototype[name];
  if (typeof orig !== 'function' || orig.g9) continue;
  const wrapped = function (...args) {
    if (!this._g9rng) this._g9rng = mulberry32(0x5eed);
    const main = this.rng;
    if (main === this._g9rng) return orig.apply(this, args);
    this.rng = this._g9rng;
    try { return orig.apply(this, args); } finally { this.rng = main; }
  };
  wrapped.g9 = true;
  Kit.prototype[name] = wrapped;
}

// ---------------------------------------------------------------- Zustandstabelle
// Pro Gebäude 4 Texel (RGBA, float):
//   0: Einfärbung r, g, b, Stärke
//   1: Fensterlicht (0 = dunkel), verwittert 0..1, verkohlt 0..1, Bauhöhe (Weltkoordinate y, 0 = aus)
//   2: Bündel sichtbar, Absenken (Abriss), Instanz sichtbar, Wackeln
//      Sichtbarkeit: 1 = ganz, 0 = aus, 0 < v < 1 = einblenden (Raster-Dithering, Anteil v),
//      -1 < v < 0 = ausblenden (genau die Gegenmenge) – so überblenden zwei Detailstufen ohne Lücke und ohne Doppelung.
//   3: Brand 0..1, untere Schnittkante (y, 0 = aus; Klettergerüst), Animationsuhr: Versatz, Rate (0 = steht)
export const SLOT_NEUTRAL = 0;
export const SLOT_HIDDEN = 1;
const TEXW = 1024;
const TPS = 4;

export class StateTable {
  constructor(cap = 2048) {
    this.uniform = { value: null };
    this.data = null;
    this.cap = 0;
    this.top = 2;
    this.free = [];
    this.dirty = true;
    this._grow(cap);
    this.setv(SLOT_HIDDEN, 2, 0, 0); this.setv(SLOT_HIDDEN, 2, 2, 0);
  }
  _grow(cap) {
    const rows = Math.ceil((cap * TPS) / TEXW);
    const data = new Float32Array(TEXW * rows * 4);
    if (this.data) data.set(this.data);
    const old = this.cap;
    this.data = data;
    this.rowDirty = new Uint8Array(rows);
    this.cap = Math.floor((TEXW * rows) / TPS);
    for (let s = old; s < this.cap; s++) this.reset(s);
    const tex = new THREE.DataTexture(data, TEXW, rows, THREE.RGBAFormat, THREE.FloatType);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    if (this.tex) this.tex.dispose();
    this.tex = tex;
    this.uniform.value = tex;
    this.dirty = false;
    this.fresh = true; // nächster Upload komplett
    this.rlo = Infinity; this.rhi = -1;
  }
  // Geänderte Zeilen einzeln merken: Zustandswechsel verteilen sich über die ganze Tabelle (Überblendungen, Fenster,
  // Abriss) – ein Bereich von der ersten bis zur letzten geänderten Zeile wäre fast immer die ganze Textur
  _row(s, k) {
    const r = (s * TPS + k) >> 10;
    if (r < this.rlo) this.rlo = r; if (r > this.rhi) this.rhi = r;
    if (this.rowDirty && r < this.rowDirty.length) this.rowDirty[r] = 1;
    this.dirty = true;
  }
  // Neue Ansicht (neues Spiel, neue Leinwand): alle Plätze freigeben, beim nächsten Upload alles laden
  clear() {
    this.top = 2;
    this.free = [];
    for (let s = 0; s < this.cap; s++) this.reset(s);
    this.setv(SLOT_HIDDEN, 2, 0, 0); this.setv(SLOT_HIDDEN, 2, 2, 0);
    this.fresh = true;
  }
  alloc() {
    const s = this.free.length ? this.free.pop() : this.top++;
    if (s >= this.cap) this._grow(this.cap * 2);
    this.reset(s);
    return s;
  }
  release(s) {
    if (s <= SLOT_HIDDEN) return;
    this.reset(s);
    this.setv(s, 2, 0, 0); this.setv(s, 2, 2, 0);
    this.free.push(s);
  }
  reset(s) {
    const d = this.data, o = s * 16;
    d.fill(0, o, o + 16);
    d[o] = 1; d[o + 1] = 1; d[o + 2] = 1; // Einfärbung weiß, Stärke 0
    d[o + 4] = 1; // Fensterlicht an
    d[o + 8] = 1; d[o + 10] = 1; // sichtbar
    this._row(s, 0); this._row(s, 3);
  }
  get(s, k, i) { return this.data[s * 16 + k * 4 + i]; }
  // Ganze Zeile kopieren (Überblenden zweier Instanzen desselben Gebäudes: die auslaufende bekommt eine Kopie)
  copy(src, dst) {
    const d = this.data;
    d.copyWithin(dst * 16, src * 16, src * 16 + 16);
    this._row(dst, 0); this._row(dst, 3);
  }
  setv(s, k, i, v) {
    const j = s * 16 + k * 4 + i;
    if (this.data[j] !== v) { this.data[j] = v; this._row(s, k); }
  }
  set4(s, k, a, b, c, d) {
    const j = s * 16 + k * 4, t = this.data;
    if (t[j] !== a || t[j + 1] !== b || t[j + 2] !== c || t[j + 3] !== d) {
      t[j] = a; t[j + 1] = b; t[j + 2] = c; t[j + 3] = d; this._row(s, k);
    }
  }
  // Lädt nur die geänderten Zeilen hoch (texSubImage2D über copyTextureToTexture), beim ersten Mal alles.
  upload(renderer) {
    if (!this.dirty) return;
    if (this.fresh || !renderer || !renderer.copyTextureToTexture) {
      this.tex.needsUpdate = true; // komplett (erstes Mal, neue Größe oder ohne Renderer)
    } else if (this.rhi >= this.rlo) {
      this._src = this._src || { isDataTexture: true, image: { data: null, width: TEXW, height: 1 } };
      this._pos = this._pos || new THREE.Vector2();
      const D = this.rowDirty;
      // zusammenhängende Läufe geänderter Zeilen (Lücken von einer Zeile werden mitgenommen: ein Aufruf weniger)
      let r = this.rlo;
      while (r <= this.rhi) {
        if (D && !D[r]) { r++; continue; }
        let e = r;
        while (e + 1 <= this.rhi && (!D || D[e + 1] || (e + 2 <= this.rhi && D[e + 2]))) e++;
        this._src.image.data = this.data.subarray(r * TEXW * 4, (e + 1) * TEXW * 4);
        this._src.image.height = e - r + 1;
        renderer.copyTextureToTexture(this._pos.set(0, r), this._src, this.tex);
        r = e + 1;
      }
    }
    if (this.rowDirty) this.rowDirty.fill(0);
    this.fresh = false;
    this.dirty = false;
    this.rlo = Infinity; this.rhi = -1;
  }
}

export const states = new StateTable();

// ---------------------------------------------------------------- Shader-Erweiterung
const VERT_HEAD = /* glsl */`
uniform highp sampler2D uG9State;
uniform float uG9Time;
attribute float aG9id;
#ifdef G9_ANIM
attribute vec4 aAnimP;
attribute vec4 aAnimA;
#endif
flat varying vec4 vG9T;
flat varying vec4 vG9S;
flat varying vec3 vG9X;
flat varying float vG9V;
flat varying float vG9F;
varying vec3 vG9P;
vec4 g9Fetch(int k) { int t = int(aG9id + 0.5) * ${TPS} + k; return texelFetch(uG9State, ivec2(t % ${TEXW}, t / ${TEXW}), 0); }
#ifdef G9_ANIM
float g9AnimAngle() {
  vec4 s3 = g9Fetch(3);
  float t = uG9Time * s3.w + s3.z;
  float a = aAnimP.w > 0.0 ? sin(t * aAnimA.y + aAnimA.z) * aAnimP.w : t * aAnimA.y + aAnimA.z;
  return a * aAnimA.w;
}
vec3 g9Rot(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  if (aAnimA.x < 1.5) return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
  if (aAnimA.x < 2.5) return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z);
}
#endif`;
const VERT_NORMAL = /* glsl */`
#ifdef G9_ANIM
objectNormal = g9Rot(objectNormal, g9AnimAngle());
#endif`;
const VERT_BEGIN = /* glsl */`
#ifdef G9_ANIM
transformed = g9Rot(transformed - aAnimP.xyz, g9AnimAngle()) + aAnimP.xyz;
#endif
vec4 g9s2 = g9Fetch(2);
#ifdef USE_INSTANCING
float g9vis = g9s2.z;
#else
float g9vis = g9s2.x;
#endif
vG9F = g9vis;
vG9T = vec4(0.0);
vG9V = fract(sin(aG9id * 12.9898 + 4.13) * 43758.5453);
vG9S = vec4(1.0, 0.0, 0.0, 0.0);
vG9X = vec3(0.0);
if (abs(g9vis) > 0.001) {
  vG9T = g9Fetch(0);
  vG9S = g9Fetch(1);
  vec4 g9s3 = g9Fetch(3);
  vG9X = vec3(g9s3.x, g9s2.y, g9s3.y);
  transformed.y -= g9s2.y;
  transformed.x += g9s2.w * sin(uG9Time * 41.0 + transformed.y * 13.0);
  transformed.z += g9s2.w * 0.6 * cos(uG9Time * 37.0 + transformed.y * 11.0);
}
#ifdef USE_INSTANCING
vG9P = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
vG9P = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif`;
const VERT_PROJECT = /* glsl */`
if (abs(g9vis) <= 0.001) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);`;
const FRAG_HEAD = /* glsl */`
uniform float uG9Time;
flat varying vec4 vG9T;
flat varying vec4 vG9S;
flat varying vec3 vG9X;
flat varying float vG9V;
flat varying float vG9F;
varying vec3 vG9P;
float g9Hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }`;
const FRAG_CLIP = /* glsl */`
if (vG9F < 0.999) {
  // Überblenden zwischen Detailstufen: festes Bildschirmraster (Interleaved Gradient Noise), Gegenmenge beim Ausblenden
  float g9dt = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  if (vG9F > 0.0 ? g9dt >= vG9F : g9dt < -vG9F) discard;
}
if (vG9S.w > 0.0 && vG9P.y > vG9S.w) discard;
if (vG9X.z > 0.0 && vG9P.y < vG9X.z) discard;
if (vG9X.y > 0.0005 && vG9P.y < -0.01) discard;`;
// Nach den Farb-/Atlas-Berechnungen (vor der Rauheit): verwittert, verkohlt, Einfärbung
const FRAG_COLOR = /* glsl */`
#ifndef G9_GLASS
{
  // Spielart pro Gebäude (Zufall aus der Zustandszeile): helle, wenig gesättigte Flächen (Putz, Beton) bekommen
  // einen leichten Pastellton, alles andere eine kleine Helligkeitsschwankung – gleiche Modelle wirken nicht geklont.
  vec3 g9d = diffuseColor.rgb;
  float g9l0 = dot(g9d, vec3(0.299, 0.587, 0.114));
  float g9sat = max(g9d.r, max(g9d.g, g9d.b)) - min(g9d.r, min(g9d.g, g9d.b));
  float g9w = smoothstep(0.2, 0.45, g9l0) * (1.0 - smoothstep(0.1, 0.3, g9sat / max(g9l0, 0.05)));
  int g9i = int(vG9V * 7.0);
  vec3 g9p = g9i == 0 ? vec3(1.05, 0.99, 0.88) : g9i == 1 ? vec3(1.06, 0.93, 0.86) : g9i == 2 ? vec3(0.94, 1.02, 0.95)
    : g9i == 3 ? vec3(0.92, 0.98, 1.06) : g9i == 4 ? vec3(1.04, 0.94, 0.96) : g9i == 5 ? vec3(1.03, 1.02, 0.9) : vec3(1.0);
  float g9br = 0.94 + 0.1 * fract(vG9V * 7.31);
  diffuseColor.rgb *= mix(vec3(0.96 + 0.08 * fract(vG9V * 3.17)), g9p * g9br, g9w);
}
#endif
{
  float g9l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  float g9st = g9Hash(floor(vG9P.xz * 26.0));
  float g9low = smoothstep(0.9, 0.0, vG9P.y);
  float g9g = vG9S.y;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(g9l) * vec3(0.8, 0.76, 0.69), min(1.0, g9g * 0.85));
  diffuseColor.rgb *= 1.0 - g9g * (0.18 + 0.3 * g9st * (0.5 + 0.5 * g9low));
  float g9c = vG9S.z * (0.6 + 0.4 * g9st);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.043, 0.038), min(1.0, g9c * 0.92));
  diffuseColor.rgb = mix(diffuseColor.rgb, vG9T.rgb, vG9T.a);
}`;
// Vor der Lichtberechnung: Fenster dunkel (kein Strom, verlassen), Feuerschein, Einfärbung dämpft Leuchten
const FRAG_EMIS = /* glsl */`
totalEmissiveRadiance *= vG9S.x * (1.0 - 0.85 * vG9T.a);
#ifdef G9_GLASS
diffuseColor.rgb *= 1.0 - 0.55 * vG9S.y - 0.6 * vG9S.z;
if (vG9S.y > 0.25) {
  // verlassen: einzelne Fenster mit Brettern vernagelt
  float g9b = g9Hash(floor(vG9P.xz * 8.0) + floor(vG9P.y * 3.4) * 7.31);
  if (g9b > 0.5) {
    float g9pl = 0.82 + 0.18 * step(0.22, fract(vG9P.y * 38.0 + g9b * 3.0));
    float g9k = smoothstep(0.25, 0.8, vG9S.y);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.34, 0.26, 0.18) * g9pl, g9k);
    #ifdef STANDARD
    roughnessFactor = mix(roughnessFactor, 0.95, g9k);
    metalnessFactor = mix(metalnessFactor, 0.0, g9k);
    #endif
    totalEmissiveRadiance *= 1.0 - g9k;
  }
}
{
  float g9f = 0.55 + 0.45 * sin(uG9Time * 11.0 + vG9P.x * 9.0 + vG9P.y * 6.0) * sin(uG9Time * 6.7 + vG9P.z * 7.0);
  float g9w = g9Hash(floor(vG9P.xz * 7.0) + floor(vG9P.y * 3.3));
  totalEmissiveRadiance += vec3(1.0, 0.36, 0.07) * vG9X.x * g9f * (0.8 + 2.2 * step(0.35, g9w)) * (1.0 - vG9T.a);
}
#endif`;

function inject(src, anchor, code, before = false) {
  const i = src.indexOf(anchor);
  if (i < 0) return src;
  return before ? src.slice(0, i) + code + '\n' + src.slice(i) : src.slice(0, i + anchor.length) + '\n' + code + src.slice(i + anchor.length);
}
function injectFirst(src, anchors, code, before = true) {
  for (const a of anchors) if (src.includes(a)) return inject(src, a, code, before);
  return src;
}
function patchShader(shader, full) {
  shader.uniforms.uG9State = states.uniform;
  shader.uniforms.uG9Time = shared.uTime;
  let v = shader.vertexShader, f = shader.fragmentShader;
  v = inject(v, '#include <common>', VERT_HEAD);
  v = inject(v, '#include <beginnormal_vertex>', VERT_NORMAL);
  v = inject(v, '#include <begin_vertex>', VERT_BEGIN);
  v = inject(v, '#include <project_vertex>', VERT_PROJECT);
  f = inject(f, '#include <common>', FRAG_HEAD);
  f = injectFirst(f, ['#include <clipping_planes_fragment>'], FRAG_CLIP);
  if (full) {
    f = injectFirst(f, ['#include <roughnessmap_fragment>', '#include <emissivemap_fragment>', '#include <aomap_fragment>'], FRAG_COLOR);
    f = injectFirst(f, ['#include <lights_physical_fragment>', '#include <lights_lambert_fragment>', '#include <lights_phong_fragment>', '#include <aomap_fragment>'], FRAG_EMIS);
  }
  shader.vertexShader = v;
  shader.fragmentShader = f;
}

// Abgeleitete Materialien: übernehmen alles vom Grundmaterial (auch dessen onBeforeCompile) und hängen
// die Zustands-Erweiterung an. Ändert G2 das Grundmaterial (version), wird neu kopiert.
const derived = new Map(); // Grundmaterial → { mat, v, glass }
function syncDerived(d, base) {
  const m = d.mat;
  m.copy(base);
  m.defines = { ...(base.defines || {}), ...(d.glass ? { G9_GLASS: '' } : {}), ...(d.anim ? { G9_ANIM: '' } : {}) };
  m.onBeforeCompile = (shader, renderer) => {
    if (base.onBeforeCompile) base.onBeforeCompile.call(base, shader, renderer);
    patchShader(shader, true);
  };
  const key = () => (base.customProgramCacheKey ? base.customProgramCacheKey() : '') + '|g9' + (d.glass ? 'g' : '') + (d.anim ? 'a' : '');
  m.customProgramCacheKey = key;
  m.needsUpdate = true;
  d.v = base.version;
}
// inst: eigenes Material für instanzierte Meshes (Nahstufen) und für Bündel (Fernstufe). three.js merkt sich je Material
// das zuletzt gewählte Programm; nutzen InstancedMesh und Mesh dasselbe Material, wählt es bei jedem Wechsel in der
// Zeichenliste das Programm neu (getParameters + Schlüssel) – bei einer Großstadt hunderte Male je Bild.
export function g9Material(base, glass = false, anim = false, inst = false) {
  const k = base;
  let byGlass = derived.get(k);
  if (!byGlass) { byGlass = {}; derived.set(k, byGlass); }
  const slot = (glass ? 'g' : 'n') + (anim ? 'a' : '') + (inst ? 'i' : '');
  let d = byGlass[slot];
  if (!d) {
    d = { mat: base.clone(), v: -1, glass, anim, inst, base };
    syncDerived(d, base);
    byGlass[slot] = d;
  }
  return d.mat;
}
// Alle bisher abgeleiteten Materialien (Vorübersetzen der Shader hinter dem Ladebildschirm): [{ mat, anim, inst }]
export function g9Materials() {
  const out = [];
  for (const byGlass of derived.values()) for (const d of Object.values(byGlass)) out.push({ mat: d.mat, anim: d.anim, inst: d.inst });
  return out;
}
// Instanzvarianten aller bisher nur gebündelt (Fernstufe) benutzten Materialien – zum Vorübersetzen beim Laden: jede
// Gebäudeart der Stadt kann beim Heranzoomen als Nahstufe erscheinen
export function g9InstVariants() {
  const out = [];
  for (const byGlass of derived.values()) for (const d of Object.values(byGlass)) if (!d.inst) out.push(g9Material(d.base, d.glass, d.anim, true));
  return [...new Set(out)];
}
// Welche Materialien als Instanz (Nahstufen, drehende Teile) bzw. als Bündel (Fernstufe) gebraucht werden – nur diese
// Varianten werden vorübersetzt (jedes Programm kostet auf Tablets spürbar Zeit). uses: Material → { inst, batch }
const uses = new Map();
let usesVersion = 0;
function noteUse(mat, kind) {
  let u = uses.get(mat);
  if (!u) { u = { inst: false, batch: false }; uses.set(mat, u); }
  if (!u[kind]) { u[kind] = true; usesVersion++; }
}
export function g9Uses() { return uses; }
export function g9UsesVersion() { return usesVersion; }
function refreshDerived() {
  for (const byGlass of derived.values()) for (const d of Object.values(byGlass)) if (d.v !== d.base.version) syncDerived(d, d.base);
}

const depthMats = {};
// Tiefenmaterial für Schatten, ebenfalls getrennt nach Instanz/Bündel (siehe g9Material)
export function g9DepthMaterial(anim = false, inst = false) {
  const k = (anim ? 'a' : 'n') + (inst ? 'i' : '');
  if (depthMats[k]) return depthMats[k];
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  if (anim) m.defines = { G9_ANIM: '' };
  m.onBeforeCompile = (shader) => patchShader(shader, false);
  const ck = 'g9depth' + (anim ? 'a' : 'n');
  m.customProgramCacheKey = () => ck;
  depthMats[k] = m;
  return m;
}

// ---------------------------------------------------------------- Modelle aufbereiten
const opts = (name) => (MATERIAL_DEFS[name] || [])[3] || {};
export function kindOf(name) {
  if (isAtlasMaterial(name)) return 'atlas';
  const o = opts(name);
  if (o.glass || o.lodWindows) return 'glass';
  if (o.emissive) return 'emissive';
  if (o.water) return 'water';
  return 'other';
}

function plain(geo) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.normal) { if (g === geo) g = geo.clone(); g.computeVertexNormals(); }
  return g;
}
function readInto(attr, out, o, size) {
  const n = attr.count;
  if (!attr.isInterleavedBufferAttribute && attr.itemSize === size && attr.array instanceof Float32Array && !attr.normalized) {
    out.set(attr.array.subarray(0, n * size), o * size);
    return;
  }
  const get = [(i) => attr.getX(i), (i) => attr.getY(i), (i) => attr.getZ(i)];
  const k = Math.min(size, attr.itemSize);
  for (let i = 0; i < n; i++) for (let c = 0; c < k; c++) out[(o + i) * size + c] = get[c](i);
}

// Fasst Geometrien zu einem kompakten Teil zusammen (Position float, Normale int8, UV float, aMat/aLit uint8).
// Animierte Teile tragen zusätzlich aAnimP (Drehpunkt xyz, Schwingweite) und aAnimA (Achse 1/2/3 = x/y/z,
// Tempo, Phase, Vorzeichen) – gedreht wird im Vertex-Shader, Takt pro Gebäude aus der Zustandstabelle.
// Zweigeteilt: compactArrays rechnet nur mit Feldern (läuft auch im Bau-Worker, Ergebnis übertragbar), partGeometry
// macht daraus die Geometrie mit Grenzen (Hauptfaden).
function compactArrays(list, kind, anim = false) {
  let n = 0;
  const gs = list.map(([g, mi, an]) => { const p = plain(g); n += p.attributes.position.count; return [p, mi, an]; });
  const P = new Float32Array(n * 3), N = new Int8Array(n * 3), U = new Float32Array(n * 2);
  const A = kind === 'atlas' ? new Uint8Array(n) : kind === 'glass' ? new Uint8Array(n) : null;
  const AP = anim ? new Float32Array(n * 4) : null, AA = anim ? new Float32Array(n * 4) : null;
  const tmpN = new Float32Array(n * 3);
  let o = 0;
  for (const [g, mi, an] of gs) {
    const c = g.attributes.position.count;
    readInto(g.attributes.position, P, o, 3);
    readInto(g.attributes.normal, tmpN, o, 3);
    if (g.attributes.uv) readInto(g.attributes.uv, U, o, 2);
    if (kind === 'atlas') A.fill(mi, o, o + c);
    else if (kind === 'glass') {
      const l = g.attributes.aLit;
      for (let i = 0; i < c; i++) A[o + i] = l ? Math.max(0, Math.min(255, Math.round(l.getX(i) * 255))) : 0;
    }
    if (anim) for (let i = 0; i < c; i++) { AP.set(an.subarray(0, 4), (o + i) * 4); AA.set(an.subarray(4, 8), (o + i) * 4); }
    o += c;
  }
  for (let i = 0; i < n * 3; i++) N[i] = Math.max(-127, Math.min(127, Math.round(tmpN[i] * 127)));
  // Drehpunkte der animierten Eingaben (für die Hüllkugel)
  let piv = null;
  if (anim) { piv = new Float32Array(gs.length * 3); gs.forEach(([, , an], i) => { piv[i * 3] = an[0]; piv[i * 3 + 1] = an[1]; piv[i * 3 + 2] = an[2]; }); }
  return { count: n, P, N, U, A, AP, AA, piv };
}
function partGeometry(src, kind, anim = false) {
  const { P, N, U, A, AP, AA } = src;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3, true));
  geo.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  if (kind === 'atlas') geo.setAttribute('aMat', new THREE.BufferAttribute(A, 1, false));
  if (kind === 'glass') geo.setAttribute('aLit', new THREE.BufferAttribute(A, 1, true));
  if (anim) { geo.setAttribute('aAnimP', new THREE.BufferAttribute(AP, 4)); geo.setAttribute('aAnimA', new THREE.BufferAttribute(AA, 4)); }
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  if (anim && src.piv && src.piv.length) {
    // Drehende Teile überstreichen eine Kugel um den Drehpunkt
    let r = 0;
    const c = geo.boundingSphere.center, pv = src.piv;
    for (let i = 0; i < pv.length; i += 3) r = Math.max(r, Math.hypot(c.x - pv[i], c.y - pv[i + 1], c.z - pv[i + 2]) + geo.boundingSphere.radius);
    geo.boundingSphere.center.set(pv[0], pv[1], pv[2]);
    geo.boundingSphere.radius = r;
    geo.boundingBox.expandByPoint(new THREE.Vector3(pv[0], pv[1] + r, pv[2]));
  }
  return geo;
}
function compactPart(list, kind, anim = false) {
  const src = compactArrays(list, kind, anim);
  return { geometry: partGeometry(src, kind, anim), src };
}

function groupMeshes(meshes) {
  const atlas = [], groups = new Map();
  for (const m of meshes || []) {
    if (!m || !m.geometry || !m.geometry.attributes.position || !m.geometry.attributes.position.count) continue;
    const name = typeof m.material === 'string' ? m.material : (m.material && m.material.name) || 'other';
    if (isAtlasMaterial(name)) atlas.push([m.geometry, ATLAS_INDEX[name], m.anim]);
    else { if (!groups.has(name)) groups.set(name, []); groups.get(name).push([m.geometry, 0, m.anim]); }
  }
  return { atlas, groups };
}

// Rechenteil von prepareModel: Teile als reine Felder (übertragbar). animMeshes siehe prepareModel.
export function packModel(res, animMeshes = null) {
  const parts = [];
  const add = (meshes, anim) => {
    const { atlas, groups } = groupMeshes(meshes);
    const suf = anim ? '~a' : '';
    if (atlas.length) parts.push({ name: '@atlas' + suf, mat: null, kind: 'atlas', anim, cast: true, src: compactArrays(atlas, 'atlas', anim) });
    for (const [name, list] of groups) {
      const kind = kindOf(name);
      parts.push({ name: name + suf, mat: name, kind, anim, cast: kind === 'other', src: compactArrays(list, kind, anim) });
    }
  };
  add(res.meshes, false);
  const nStatic = parts.length;
  if (animMeshes && animMeshes.length) add(animMeshes, true);
  return { parts, nStatic, height: res.height, hasAnim: !!(animMeshes && animMeshes.length) };
}
// Alle Puffer eines Pakets (zum Übertragen ohne Kopie)
export function packBuffers(pack) {
  const out = [];
  for (const p of pack.parts) for (const k of ['P', 'N', 'U', 'A', 'AP', 'AA', 'piv']) if (p.src[k]) out.push(p.src[k].buffer);
  return out;
}
// Darstellungsteil: aus dem Paket Geometrien, Materialien und Grenzen
export function modelFromPack(pack) {
  const parts = pack.parts.map((q) => ({
    name: q.name, kind: q.kind, anim: q.anim, cast: q.cast, base: q.kind === 'atlas' ? getAtlasMaterial() : getMaterial(q.mat),
    geometry: partGeometry(q.src, q.kind, q.anim), src: q.src,
  }));
  const staticBox = new THREE.Box3();
  for (let i = 0; i < pack.nStatic; i++) staticBox.union(parts[i].geometry.boundingBox);
  for (const p of parts) {
    p.material = g9Material(p.base, p.kind === 'glass', !!p.anim, true);
    p.batchMaterial = g9Material(p.base, p.kind === 'glass', !!p.anim, false);
  }
  const box = new THREE.Box3();
  for (const p of parts) box.union(p.geometry.boundingBox);
  let tris = 0;
  for (const p of parts) tris += p.src.count / 3;
  let radius = 0;
  for (const p of parts) { const sp = p.geometry.boundingSphere; radius = Math.max(radius, sp.center.length() + sp.radius); }
  return { parts, box: staticBox.isEmpty() ? box : staticBox, core: coreBox(parts, staticBox), top: box.max.y, radius, triangles: Math.round(tris), height: pack.height ?? staticBox.max.y, hasAnim: pack.hasAnim };
}

// Aus dem Ergebnis von kit.build() (oder eigenem { meshes }) ein Modell mit wenigen Teilen machen.
// animMeshes: [{ material, geometry (Modellkoordinaten), anim: Float32Array(8) }]
export function prepareModel(res, animMeshes = null) {
  return modelFromPack(packModel(res, animMeshes));
}

// Modell bauen (Architektur-Baustein, sonst Ersatzmodell): kit-Ergebnis oder null
function buildRes(key, level, v, fw, fd, extra, detail, fallback, id) {
  let res = null;
  if (ARCH[key]) {
    try { res = buildArch(key, level, v, fw, fd, extra, detail); } catch (e) { console.warn('Architektur-Fehler', id, e); res = null; }
    if (res && (!res.meshes || !res.meshes.length)) res = null;
  }
  if (!res && fallback) {
    try { res = fallback(key, level, v, fw, fd, extra, detail); } catch (e) { console.warn('Ersatzmodell-Fehler', id, e); res = null; }
  }
  return res && res.meshes && res.meshes.length ? res : null;
}
// res.anim: Teile mit Baustoff-Namen drehen im Shader (gebündelt wie der Rest), Teile mit eigenem
// THREE.Material oder nightOnly laufen als eigener Instanzsatz (legacy).
function splitAnims(res) {
  const gpu = [], legacy = [];
  for (const a of res.anim || []) {
    if (!a || !a.geometry || !a.geometry.attributes || !a.geometry.attributes.position) continue;
    const isMat = !!(a.material && a.material.isMaterial);
    const pv = new THREE.Vector3().fromArray(a.pivot || [0, 0, 0]);
    let geo = a.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const c = geo.boundingBox.getCenter(new THREE.Vector3());
    // Vertrag (G5/G6): Geometrie relativ zum Drehpunkt, pivot in Modellkoordinaten, axis dreht mit dem Gebäude,
    // speed in rad/s. Ohne a.local gilt das auch – außer die Geometrie liegt erkennbar schon am Drehpunkt
    // (Mitte viel näher am Drehpunkt als am Ursprung), dann wird sie als Modellkoordinaten gelesen.
    const local = a.local ?? !(pv.lengthSq() > 1e-6 && c.distanceTo(pv) < 0.5 * c.length());
    if (isMat || a.nightOnly) { legacy.push({ a, isMat, pv, local }); continue; }
    if (local) { geo = geo.clone(); geo.translate(pv.x, pv.y, pv.z); }
    const axis = a.axis === 'x' ? 1 : a.axis === 'z' ? 3 : 2;
    gpu.push({ material: a.material || 'metal_light', geometry: geo, anim: new Float32Array([pv.x, pv.y, pv.z, a.swing || 0, axis, a.speed ?? 1, a.phase || 0, 1]) });
  }
  return { gpu, legacy };
}
// Für den Bau-Worker: Modell bauen und als übertragbares Paket liefern.
// Rückgabe: { pack, meta } | { fail: true } | { sync: true } (Teile mit eigenem Material: nur im Hauptfaden)
export function buildProtoPack(key, level, v, fw, fd, extra, detail, fallback) {
  const res = buildRes(key, level, v, fw, fd, extra || {}, detail, fallback, key);
  if (!res) return { fail: true };
  const { gpu, legacy } = splitAnims(res);
  if (legacy.length) return { sync: true };
  const pack = packModel(res, gpu);
  return { pack, meta: { height: res.height, emitters: res.emitters || [], lights: res.lights || [] } };
}

// Baukörper ohne Garten, Zaun und Bodenplatte (für Gerüst und Baustelle): aus den Fassaden (Fenster),
// sonst aus allem oberhalb von 1,5 m, sonst die ganze Box.
function coreBox(parts, all) {
  const b = new THREE.Box3();
  for (const p of parts) if (p.kind === 'glass' && !p.anim) b.union(p.geometry.boundingBox);
  if (!b.isEmpty() && b.max.x - b.min.x > 0.08 && b.max.z - b.min.z > 0.08) return b.expandByScalar(0.004);
  const P = parts.find((p) => p.kind === 'atlas' && !p.anim);
  if (P) {
    const a = P.src.P;
    for (let i = 0; i < P.src.count; i++) if (a[i * 3 + 1] > 0.15) { b.expandByPoint(new THREE.Vector3(a[i * 3], a[i * 3 + 1], a[i * 3 + 2])); }
    if (!b.isEmpty()) return b;
  }
  return all.clone();
}

// ---------------------------------------------------------------- Instanzen
const _v = new THREE.Vector3();
export class InstSet {
  constructor(parent, parts, opts = {}) {
    this.parent = parent;
    this.parts = parts; // [{geometry, material, cast}]
    this.cap = 0;
    this.count = 0;
    this.meshes = null;
    this.im = null;
    this.ids = null;
    this.handleOf = new Int32Array(0);
    this.denseOf = [];
    this.freeH = [];
    this.nextH = 0;
    this.lo = Infinity; this.hi = -1;
    this.bounds = true;
    this.sphere = new THREE.Sphere();
    this.radius = opts.radius ?? 1;
    this.renderOrder = opts.renderOrder || 0;
    this.idle = 0;
    this.mgr = opts.mgr || null;
  }
  _grow(cap) {
    const im = new THREE.InstancedBufferAttribute(new Float32Array(cap * 16), 16);
    im.setUsage(THREE.DynamicDrawUsage);
    const ids = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    ids.setUsage(THREE.DynamicDrawUsage);
    if (this.im) { im.array.set(this.im.array.subarray(0, this.count * 16)); ids.array.set(this.ids.array.subarray(0, this.count)); }
    const ho = new Int32Array(cap);
    ho.set(this.handleOf.subarray(0, Math.min(this.handleOf.length, cap)));
    this.handleOf = ho;
    if (!this.meshes) {
      this.meshes = this.parts.map((p) => {
        const mesh = new THREE.InstancedMesh(p.geometry, p.material, 0);
        mesh.castShadow = !!p.cast;
        mesh.receiveShadow = true;
        mesh.customDepthMaterial = g9DepthMaterial(!!p.anim, true);
        noteUse(p.material, 'inst');
        mesh.matrixAutoUpdate = false;
        mesh.renderOrder = this.renderOrder;
        mesh.boundingSphere = this.sphere;
        mesh.visible = false;
        this.parent.add(mesh);
        return mesh;
      });
    } else {
      for (const mesh of this.meshes) { mesh.dispose(); mesh.geometry.dispose(); }
    }
    for (const mesh of this.meshes) {
      mesh.instanceMatrix = im;
      mesh.geometry.setAttribute('aG9id', ids);
    }
    this.im = im;
    this.ids = ids;
    this.cap = cap;
    this.lo = 0; this.hi = this.count;
  }
  _mark(d) { if (d < this.lo) this.lo = d; if (d + 1 > this.hi) this.hi = d + 1; this.bounds = true; if (this.mgr) this.mgr.dirty.add(this); }
  alloc(slot = SLOT_NEUTRAL) {
    if (this.count >= this.cap) this._grow(Math.max(8, this.cap * 2));
    const h = this.freeH.length ? this.freeH.pop() : this.nextH++;
    const d = this.count++;
    this.handleOf[d] = h;
    this.denseOf[h] = d;
    this.ids.array[d] = slot;
    this.im.array.fill(0, d * 16, d * 16 + 16);
    this._mark(d);
    return h;
  }
  has(h) { const d = this.denseOf[h]; return d !== undefined && d >= 0 && d < this.count && this.handleOf[d] === h; }
  setMatrix(h, m4) {
    const d = this.denseOf[h];
    if (d === undefined || d < 0) return;
    m4.toArray(this.im.array, d * 16);
    this._mark(d);
  }
  setSlot(h, slot) {
    const d = this.denseOf[h];
    if (d === undefined || d < 0) return;
    this.ids.array[d] = slot;
    this._mark(d);
  }
  release(h) {
    const d = this.denseOf[h];
    if (d === undefined || d < 0) return;
    const last = this.count - 1;
    if (d !== last) {
      this.im.array.copyWithin(d * 16, last * 16, last * 16 + 16);
      this.ids.array[d] = this.ids.array[last];
      const hl = this.handleOf[last];
      this.handleOf[d] = hl;
      this.denseOf[hl] = d;
      this._mark(d);
    }
    this.denseOf[h] = -1;
    this.freeH.push(h);
    this.count--;
    this.bounds = true;
    if (this.mgr) this.mgr.dirty.add(this);
  }
  flush() {
    if (!this.meshes) return;
    if (this.hi > this.lo) {
      const lo = this.lo, n = Math.min(this.hi, this.cap) - lo;
      if (n > 0) {
        this.im.addUpdateRange(lo * 16, n * 16); this.im.needsUpdate = true;
        this.ids.addUpdateRange(lo, n); this.ids.needsUpdate = true;
      }
    }
    this.lo = Infinity; this.hi = -1;
    if (this.bounds) {
      this.bounds = false;
      const a = this.im.array;
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity, sc = 1;
      for (let d = 0; d < this.count; d++) {
        const o = d * 16;
        const x = a[o + 12], y = a[o + 13], z = a[o + 14];
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
        const s = Math.max(a[o] * a[o] + a[o + 1] * a[o + 1] + a[o + 2] * a[o + 2], a[o + 4] * a[o + 4] + a[o + 5] * a[o + 5] + a[o + 6] * a[o + 6], a[o + 8] * a[o + 8] + a[o + 9] * a[o + 9] + a[o + 10] * a[o + 10]);
        if (s > sc) sc = s;
      }
      if (this.count) {
        this.sphere.center.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
        this.sphere.radius = _v.set(x1 - x0, y1 - y0, z1 - z0).length() / 2 + this.radius * Math.sqrt(sc);
      }
    }
    for (const mesh of this.meshes) { mesh.count = this.count; mesh.visible = this.count > 0; }
  }
  dispose() {
    if (!this.meshes) return;
    for (const mesh of this.meshes) { this.parent.remove(mesh); mesh.dispose(); }
    this.meshes = null;
  }
}

// ---------------------------------------------------------------- Prototypen
export class ProtoManager {
  constructor(parent) {
    this.parent = parent; // Szene oder Gruppe
    this.protos = new Map();
    this.failed = new Set();
    this.dirty = new Set();
    this.fallback = null; // (key, level, variant, fw, fd, extra, detail) → kit-Ergebnis | null
    this.fallbackVariants = null; // (key) → Anzahl Varianten
    this.buildMs = 0;
    this.time = 0;
  }
  setFallback(fn, variants) { this.fallback = fn; this.fallbackVariants = variants || null; }

  variantsOf(key) {
    if (ARCH[key]) return Math.max(1, ARCH[key].variants || 6);
    if (this.fallbackVariants) return Math.max(1, this.fallbackVariants(key) || 1);
    return 6;
  }
  idOf(key, level, variant, fw, fd, detail = 2) {
    const nv = this.variantsOf(key);
    const v = ((Math.floor(variant) % nv) + nv) % nv;
    return { id: `${key}|${level}|${v}|${fw}x${fd}|${detail}`, v };
  }
  peek(key, level, variant, fw, fd, detail = 2) {
    return this.protos.get(this.idOf(key, level, variant, fw, fd, detail).id) || null;
  }

  get(key, level, variant, fw, fd, extra = {}, detail = 2) {
    const { id, v } = this.idOf(key, level, variant, fw, fd, detail);
    const have = this.protos.get(id);
    if (have) { have.idle = 0; return have; }
    if (this.failed.has(id)) return null;
    const t0 = performance.now();
    const res = buildRes(key, level, v, fw, fd, extra, detail, this.fallback, id);
    if (!res) { this.failed.add(id); this.buildMs += performance.now() - t0; return null; }
    const { gpu, legacy } = splitAnims(res);
    const model = prepareModel(res, gpu);
    const proto = this._register(id, key, level, v, fw, fd, detail, res, model, legacy);
    proto.ms = performance.now() - t0;
    this.buildMs += proto.ms;
    return proto;
  }

  // Ergebnis des Bau-Workers übernehmen (job: { key, level, v, fw, fd, detail }); null, wenn schon vorhanden
  adopt(job, out, ms = 0) {
    const id = `${job.key}|${job.level}|${job.v}|${job.fw}x${job.fd}|${job.detail}`;
    if (this.protos.has(id)) return this.protos.get(id);
    if (out.fail) { this.failed.add(id); return null; }
    const model = modelFromPack(out.pack);
    const proto = this._register(id, job.key, job.level, job.v, job.fw, job.fd, job.detail, out.meta, model, []);
    proto.ms = ms;
    proto.async = true;
    this.buildMs += ms;
    return proto;
  }

  _register(id, key, level, v, fw, fd, detail, res, model, legacy) {
    const proto = {
      id, key, level, variant: v, fw, fd, detail,
      height: res.height || model.box.max.y, top: Math.max(model.top, res.height || 0), box: model.box, core: model.core, radius: model.radius,
      emitters: res.emitters || [], lights: res.lights || [], triangles: model.triangles,
      parts: model.parts, batchRefs: 0, idle: 0, hasAnim: model.hasAnim,
      set: null, anims: [],
    };
    proto.set = new InstSet(this.parent, proto.parts, { radius: model.radius, mgr: this });
    for (const { a, isMat, pv, local } of legacy) {
      let parts;
      if (isMat) {
        const c = compactPart([[a.geometry, 0]], 'other');
        parts = [{ name: a.material.name, kind: 'other', base: a.material, material: a.material, cast: !a.material.transparent, ...c }];
      } else {
        parts = prepareModel({ meshes: [{ material: a.material || 'metal_light', geometry: a.geometry }] }).parts;
        for (const p of parts) p.cast = p.kind === 'atlas' || p.kind === 'other';
      }
      let r = 0;
      for (const p of parts) { const sp = p.geometry.boundingSphere; r = Math.max(r, sp.center.length() + sp.radius); }
      const set = new InstSet(this.parent, parts, { radius: r + pv.length(), mgr: this, renderOrder: isMat && a.material.transparent ? 5 : 0 });
      proto.anims.push({ set, pivot: pv, axis: a.axis || 'y', speed: a.speed ?? 1, local, nightOnly: !!a.nightOnly, phase: a.phase || 0, swing: a.swing || 0 });
      proto.triangles += parts.reduce((sum, p) => sum + p.src.count / 3, 0);
    }
    this.protos.set(id, proto);
    for (const p of proto.parts) { if (detail >= 1) noteUse(p.material, 'inst'); else noteUse(p.batchMaterial || p.material, 'batch'); }
    for (const a of proto.anims) for (const p of a.set.parts) noteUse(p.material, 'inst');
    return proto;
  }

  // Instanz-Schnittstelle (Handle bleibt stabil, intern dicht gepackt)
  alloc(proto, slot = SLOT_NEUTRAL) { proto.idle = 0; return proto.set.alloc(slot); }
  set(proto, handle, matrix, color) { void color; proto.set.setMatrix(handle, matrix); }
  setSlot(proto, handle, slot) { proto.set.setSlot(handle, slot); }
  release(proto, handle) { proto.set.release(handle); }
  retain(proto) { proto.batchRefs++; proto.idle = 0; }
  unretain(proto) { proto.batchRefs = Math.max(0, proto.batchRefs - 1); }

  flush() {
    refreshDerived();
    for (const s of this.dirty) s.flush();
    this.dirty.clear();
  }

  // Unbenutzte Prototypen freigeben (Speicher sparen). dt in Sekunden.
  gc(dt, maxIdle = 20) {
    let n = 0;
    this.time += dt;
    const many = this.protos.size > 650; // mehr Modellvielfalt (mix.js): Fernmodelle bleiben ohnehin gebunden
    for (const [id, p] of this.protos) {
      const used = p.set.count > 0 || p.batchRefs > 0 || p.anims.some((a) => a.set.count > 0);
      if (used) { p.idle = 0; continue; }
      // vorab gebaute teure Modelle (Wahrzeichen nah/mittel) bleiben erhalten, solange buildings.js sie anfordert
      if (p.keepUntil && p.keepUntil > this.time) { p.idle = 0; continue; }
      p.idle += dt;
      if (p.idle > (many ? maxIdle * 0.25 : maxIdle)) {
        p.set.dispose();
        for (const a of p.anims) a.set.dispose();
        for (const part of p.parts) part.geometry.dispose();
        for (const a of p.anims) for (const part of a.set.parts) part.geometry.dispose();
        this.protos.delete(id);
        n++;
      }
    }
    return n;
  }

  stats() {
    let draws = 0, tris = 0, inst = 0, live = 0;
    for (const proto of this.protos.values()) {
      const c = proto.set.count;
      if (c > 0) { live++; draws += proto.parts.length; tris += proto.triangles * c; inst += c; }
      for (const a of proto.anims) if (a.set.count > 0) draws += a.set.parts.length;
    }
    return { prototypes: this.protos.size, live, draws, triangles: Math.round(tris), instances: inst, buildMs: Math.round(this.buildMs) };
  }
}

// ---------------------------------------------------------------- Bündel pro Kartenabschnitt
const COS = [1, 0, -1, 0], SIN = [0, 1, 0, -1];

class BatchGroup {
  constructor(chunk, name, kind, material, cast) {
    this.chunk = chunk;
    this.name = name;
    this.kind = kind;
    this.aux = kind === 'atlas' ? 'aMat' : kind === 'glass' ? 'aLit' : null;
    this.anim = name.endsWith('~a');
    this.cap = 0; this.used = 0; this.waste = 0;
    this.list = [];
    this.lo = Infinity; this.hi = -1; this.ilo = Infinity; this.ihi = -1;
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    this.mesh.matrixAutoUpdate = false;
    this.mesh.castShadow = cast;
    this.mesh.receiveShadow = true;
    this.mesh.customDepthMaterial = g9DepthMaterial(this.anim, false);
    this.mesh.visible = false;
    this.mesh.frustumCulled = chunk.batcher.cull;
    chunk.batcher.parent.add(this.mesh);
  }
  _grow(need) {
    const cap = Math.max(need, Math.ceil(this.cap * 1.6), 1024);
    const u = this.used;
    const P = new Float32Array(cap * 3), N = new Int8Array(cap * 3), U = new Float32Array(cap * 2), I = new Uint16Array(cap);
    const A = this.aux ? new Uint8Array(cap) : null;
    const AP = this.anim ? new Float32Array(cap * 4) : null, AA = this.anim ? new Float32Array(cap * 4) : null;
    if (this.cap) {
      P.set(this.P.subarray(0, u * 3)); N.set(this.N.subarray(0, u * 3)); U.set(this.U.subarray(0, u * 2)); I.set(this.I.subarray(0, u));
      if (A) A.set(this.A.subarray(0, u));
      if (AP) { AP.set(this.AP.subarray(0, u * 4)); AA.set(this.AA.subarray(0, u * 4)); }
    }
    this.P = P; this.N = N; this.U = U; this.I = I; this.A = A; this.AP = AP; this.AA = AA;
    const geo = new THREE.BufferGeometry();
    this.aP = new THREE.BufferAttribute(P, 3); this.aN = new THREE.BufferAttribute(N, 3, true);
    this.aU = new THREE.BufferAttribute(U, 2); this.aI = new THREE.BufferAttribute(I, 1, false);
    geo.setAttribute('position', this.aP); geo.setAttribute('normal', this.aN); geo.setAttribute('uv', this.aU); geo.setAttribute('aG9id', this.aI);
    if (A) { this.aA = new THREE.BufferAttribute(A, 1, this.aux === 'aLit'); geo.setAttribute(this.aux, this.aA); }
    if (AP) { this.aAP = new THREE.BufferAttribute(AP, 4); this.aAA = new THREE.BufferAttribute(AA, 4); geo.setAttribute('aAnimP', this.aAP); geo.setAttribute('aAnimA', this.aAA); }
    geo.boundingSphere = this.chunk.sphere;
    geo.setDrawRange(0, u);
    const old = this.mesh.geometry;
    this.mesh.geometry = geo;
    old.dispose();
    this.cap = cap;
    this.lo = Infinity; this.hi = -1; this.ilo = Infinity; this.ihi = -1; // neue Puffer werden komplett geladen
  }
  append(src, k, ox, oz, slot, litOff) {
    const n = src.count;
    if (this.used + n > this.cap) this._grow(this.used + n);
    const s = this.used, c = COS[k & 3], si = SIN[k & 3];
    const P = this.P, N = this.N, sp = src.P, sn = src.N;
    for (let i = 0; i < n; i++) {
      const a = i * 3, b = (s + i) * 3;
      const x = sp[a], z = sp[a + 2];
      P[b] = ox + x * c + z * si; P[b + 1] = sp[a + 1]; P[b + 2] = oz - x * si + z * c;
      const nx = sn[a], nz = sn[a + 2];
      N[b] = nx * c + nz * si; N[b + 1] = sn[a + 1]; N[b + 2] = -nx * si + nz * c;
    }
    this.U.set(src.U.subarray(0, n * 2), s * 2);
    if (this.aux === 'aMat') this.A.set(src.A.subarray(0, n), s);
    else if (this.aux === 'aLit') { const A = this.A, sa = src.A; for (let i = 0; i < n; i++) A[s + i] = (sa[i] + litOff) & 255; }
    this.I.fill(slot, s, s + n);
    if (this.anim && src.AP) {
      // Drehpunkt mitdrehen; Achse x/z je nach Gebäudedrehung tauschen (mit Vorzeichen)
      const AP = this.AP, AA = this.AA, sp2 = src.AP, sa = src.AA;
      for (let i = 0; i < n; i++) {
        const a = i * 4, b = (s + i) * 4;
        const x = sp2[a], z = sp2[a + 2];
        AP[b] = ox + x * c + z * si; AP[b + 1] = sp2[a + 1]; AP[b + 2] = oz - x * si + z * c; AP[b + 3] = sp2[a + 3];
        let ax = sa[a], sg = sa[a + 3];
        if (ax === 1) { if (k === 1) { ax = 3; sg = -sg; } else if (k === 2) sg = -sg; else if (k === 3) ax = 3; }
        else if (ax === 3) { if (k === 1) ax = 1; else if (k === 2) sg = -sg; else if (k === 3) { ax = 1; sg = -sg; } }
        AA[b] = ax; AA[b + 1] = sa[a + 1]; AA[b + 2] = sa[a + 2]; AA[b + 3] = sg;
      }
    }
    this.used += n;
    if (s < this.lo) this.lo = s; if (s + n > this.hi) this.hi = s + n;
    const r = { start: s, count: n, live: true };
    this.list.push(r);
    return r;
  }
  kill(r) {
    if (!r.live) return;
    r.live = false;
    this.waste += r.count;
    this.I.fill(SLOT_HIDDEN, r.start, r.start + r.count);
    if (r.start < this.ilo) this.ilo = r.start; if (r.start + r.count > this.ihi) this.ihi = r.start + r.count;
  }
  setSlot(r, slot) {
    if (!r.live) return;
    this.I.fill(slot, r.start, r.start + r.count);
    if (r.start < this.ilo) this.ilo = r.start; if (r.start + r.count > this.ihi) this.ihi = r.start + r.count;
  }
  compact() {
    let dst = 0;
    const keep = [];
    for (const r of this.list) {
      if (!r.live) continue;
      if (r.start !== dst) {
        const a = r.start, e = r.start + r.count;
        this.P.copyWithin(dst * 3, a * 3, e * 3); this.N.copyWithin(dst * 3, a * 3, e * 3);
        this.U.copyWithin(dst * 2, a * 2, e * 2); this.I.copyWithin(dst, a, e);
        if (this.A) this.A.copyWithin(dst, a, e);
        if (this.AP) { this.AP.copyWithin(dst * 4, a * 4, e * 4); this.AA.copyWithin(dst * 4, a * 4, e * 4); }
        r.start = dst;
      }
      dst += r.count;
      keep.push(r);
    }
    this.list = keep;
    this.used = dst;
    this.waste = 0;
    this.lo = 0; this.hi = dst;
    this.ilo = Infinity; this.ihi = -1;
  }
  flush() {
    if (!this.cap) return;
    const geo = this.mesh.geometry;
    if (this.hi > this.lo) {
      const lo = this.lo, n = this.hi - lo;
      this.aP.addUpdateRange(lo * 3, n * 3); this.aP.needsUpdate = true;
      this.aN.addUpdateRange(lo * 3, n * 3); this.aN.needsUpdate = true;
      this.aU.addUpdateRange(lo * 2, n * 2); this.aU.needsUpdate = true;
      if (this.A) { this.aA.addUpdateRange(lo, n); this.aA.needsUpdate = true; }
      if (this.AP) { this.aAP.addUpdateRange(lo * 4, n * 4); this.aAP.needsUpdate = true; this.aAA.addUpdateRange(lo * 4, n * 4); this.aAA.needsUpdate = true; }
      if (this.ilo > lo) this.ilo = lo; if (this.ihi < this.hi) this.ihi = this.hi;
    }
    if (this.ihi > this.ilo) { this.aI.addUpdateRange(this.ilo, this.ihi - this.ilo); this.aI.needsUpdate = true; }
    this.lo = Infinity; this.hi = -1; this.ilo = Infinity; this.ihi = -1;
    geo.setDrawRange(0, this.used);
    this.mesh.visible = this.used - this.waste > 0;
  }
  dispose() {
    this.chunk.batcher.parent.remove(this.mesh);
    this.mesh.geometry.dispose();
  }
}

export class Batcher {
  // opts: { W, H, chunk (Felder), single (ein Abschnitt für alles), cull }
  constructor(parent, opts = {}) {
    this.parent = parent;
    this.size = opts.chunk || 32;
    this.coarse = opts.coarse || this.size; // Abschnittsgröße für seltene Materialien (Glas, Leuchtendes, Wasser)
    this.W = opts.W || 128; this.H = opts.H || 128;
    this.single = !!opts.single;
    this.cull = opts.cull !== false;
    this.chunks = new Map();
    this.recs = new Map();
    this.compactions = 0;
  }
  _chunk(ox, oz, coarse = false) {
    let cx = 0, cz = 0;
    const size = coarse ? this.coarse : this.size;
    if (!this.single) { cx = Math.floor((ox + this.W / 2) / size); cz = Math.floor((oz + this.H / 2) / size); }
    const key = (coarse ? 1 << 24 : 0) + cx * 4096 + cz;
    let ch = this.chunks.get(key);
    if (!ch) {
      ch = { key, cx, cz, size, groups: new Map(), maxH: 0.5, sphere: new THREE.Sphere(), batcher: this };
      this._sphere(ch);
      this.chunks.set(key, ch);
    }
    return ch;
  }
  _sphere(ch) {
    if (this.single) { ch.sphere.center.set(0, ch.maxH / 2, 0); ch.sphere.radius = Math.hypot(this.W, this.H) / 2 + ch.maxH + 4; return; }
    const s = ch.size;
    const x = ch.cx * s + s / 2 - this.W / 2, z = ch.cz * s + s / 2 - this.H / 2;
    ch.sphere.center.set(x, ch.maxH / 2, z);
    ch.sphere.radius = Math.hypot(s / 2 + 3, s / 2 + 3, ch.maxH / 2 + 0.5);
  }
  has(id) { return this.recs.has(id); }
  // model: { parts, height } (Prototyp oder prepareModel-Ergebnis); k = Drehung in Vierteln
  add(id, model, k, ox, oz, slot) {
    this.remove(id);
    const litOff = Math.floor(Math.abs(Math.sin(ox * 12.9898 + oz * 78.233) * 43758.5453) % 1 * 255);
    const ranges = [];
    const top = Math.max(model.top || 0, model.height || 1) + 0.3;
    for (const part of model.parts) {
      const fine = part.kind === 'atlas' || part.name === 'lod_windows';
      const ch = this._chunk(ox, oz, !fine);
      if (top > ch.maxH) { ch.maxH = top; this._sphere(ch); }
      let gr = ch.groups.get(part.name);
      if (!gr) { gr = new BatchGroup(ch, part.name, part.kind, part.batchMaterial || part.material, part.cast); ch.groups.set(part.name, gr); }
      ranges.push([gr, gr.append(part.src, k, ox, oz, slot, litOff)]);
    }
    this.recs.set(id, { ranges });
  }
  remove(id) {
    const r = this.recs.get(id);
    if (!r) return false;
    for (const [gr, rg] of r.ranges) gr.kill(rg);
    this.recs.delete(id);
    return true;
  }
  setSlot(id, slot) {
    const r = this.recs.get(id);
    if (r) for (const [gr, rg] of r.ranges) gr.setSlot(rg, slot);
  }
  flush(maxCompact = 1) {
    let done = 0;
    for (const ch of this.chunks.values()) for (const gr of ch.groups.values()) {
      if (done < maxCompact && gr.waste > 6000 && gr.waste > gr.used * 0.4) { gr.compact(); done++; this.compactions++; }
      gr.flush();
    }
  }
  // Obergrenze der Draw Calls dieses Bündels (Gruppen + Schattenwurf); mit frustum nur Abschnitte im Bild
  drawEstimate(frustum = null) {
    let n = 0;
    for (const ch of this.chunks.values()) {
      if (frustum && this.cull && !frustum.intersectsSphere(ch.sphere)) continue;
      for (const gr of ch.groups.values()) if (gr.used - gr.waste > 0) n += gr.mesh.castShadow ? 2 : 1;
    }
    return n;
  }
  stats() {
    let draws = 0, verts = 0, waste = 0, groups = 0;
    for (const ch of this.chunks.values()) for (const gr of ch.groups.values()) {
      groups++;
      if (gr.mesh.visible) draws++;
      verts += gr.used; waste += gr.waste;
    }
    return { chunks: this.chunks.size, groups, draws, triangles: Math.round((verts - waste) / 3), waste: Math.round(waste / 3), members: this.recs.size };
  }
  dispose() {
    for (const ch of this.chunks.values()) for (const gr of ch.groups.values()) gr.dispose();
    this.chunks.clear();
    this.recs.clear();
  }
}

// ---------------------------------------------------------------- Bau-Worker (siehe protoworker.js)
// Adresse des eigenen Skripts (beim Laden festhalten – später ist document.currentScript leer)
const SCRIPT_URL = (() => {
  try {
    if (typeof document === 'undefined' || !document.currentScript) return null;
    const src = document.currentScript.src;
    return src && /^https?:/.test(src) ? src : null;
  } catch (e) { return null; }
})();

// Gemeinsamer Pool für alle Ansichten (Menüvorschau und Spiel); Worker sind zustandslos und bleiben erhalten.
let POOL;
export class ProtoPool {
  static get() {
    if (POOL !== undefined) return POOL;
    POOL = null;
    try {
      const off = typeof window !== 'undefined' && (window.STADTPULS_NOWORKER || /[?&]noworker\b/.test(location.search));
      if (!off && SCRIPT_URL && typeof Worker === 'function') POOL = new ProtoPool(SCRIPT_URL);
    } catch (e) { POOL = null; }
    return POOL;
  }
  constructor(url) {
    const hc = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 2;
    const n = hc >= 4 ? 2 : 1;
    this.workers = [];
    this.jobs = new Map(); // Kennung → Auftrag
    this.done = []; // fertige Ergebnisse, die die Ansicht im nächsten Bild übernimmt
    this.ok = true;
    this.seq = 0;
    for (let i = 0; i < n; i++) {
      const w = new Worker(url);
      const slot = { w, busy: 0, ready: false };
      w.onmessage = (e) => this._msg(slot, e.data);
      w.onerror = (e) => { this._fail(slot, e); };
      this.workers.push(slot);
    }
  }
  get depth() { return 2; } // Aufträge je Worker gleichzeitig (einer läuft, einer wartet)
  get free() { if (!this.ok) return 0; let n = 0; for (const s of this.workers) n += Math.max(0, this.depth - s.busy); return n; }
  // job: { id (Prototyp-Kennung), key, level, v, fw, fd, extra, detail, owner }
  submit(job) {
    if (!this.ok) return false;
    let best = null;
    for (const s of this.workers) if (s.busy < this.depth && (!best || s.busy < best.busy)) best = s;
    if (!best) return false;
    best.busy++;
    job.slot = best;
    job.t0 = performance.now();
    job.seq = ++this.seq;
    this.jobs.set(job.seq, job);
    try {
      best.w.postMessage({ type: 'build', id: job.seq, key: job.key, level: job.level, v: job.v, fw: job.fw, fd: job.fd, extra: job.extra, detail: job.detail });
    } catch (e) { best.busy--; this.jobs.delete(job.seq); this._fail(best, e); return false; }
    return true;
  }
  _msg(slot, m) {
    if (!m) return;
    if (m.type === 'ready') { slot.ready = true; return; }
    if (m.type !== 'built') return;
    const job = this.jobs.get(m.id);
    if (!job) return;
    this.jobs.delete(m.id);
    slot.busy = Math.max(0, slot.busy - 1);
    this.done.push({ job, out: m.out || { error: 'leer' }, ms: m.ms || 0, wait: performance.now() - job.t0 });
  }
  _fail(slot, e) {
    // Worker kaputt (z. B. Skript nicht ladbar): Pool abschalten, offene Aufträge zurückgeben (die Ansicht baut selbst)
    if (!this.ok) return;
    this.ok = false;
    try { console.warn('Cityscapes: Bau-Worker nicht verfügbar, Gebäude werden im Hauptfaden gebaut', e && (e.message || e)); } catch (err) { /* egal */ }
    for (const job of this.jobs.values()) this.done.push({ job, out: { retry: true }, ms: 0, wait: 0 });
    this.jobs.clear();
    for (const s of this.workers) { try { s.w.terminate(); } catch (err) { /* egal */ } }
    void slot;
  }
  // Ergebnisse für eine Ansicht abholen
  take(owner, max = Infinity) {
    const out = [];
    for (let i = 0; i < this.done.length && out.length < max;) {
      if (this.done[i].job.owner === owner) out.push(this.done.splice(i, 1)[0]); else i++;
    }
    return out;
  }
  // Aufträge einer abgebauten Ansicht vergessen
  drop(owner) {
    this.done = this.done.filter((d) => d.job.owner !== owner);
    for (const job of this.jobs.values()) if (job.owner === owner) job.owner = null;
  }
}
