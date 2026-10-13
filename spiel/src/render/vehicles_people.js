// Menschen, Radfahrer und Vögel (Besitzer: G10). Instanziert, Laufbewegung im Vertex-Shader.
// Maßstab 1 = 10 m (Mensch ≈ 0,175). Ursprung = zwischen den Füßen am Boden, Blick nach +z, linke Seite = +x.
//
// aPart = Glied · 8 + Farbfeld.
//   Glied: 0 Körper, 1/2 Bein links/rechts, 3/4 Arm links/rechts, 5/6 Bein beim Radfahren, 7/8 Flügel links/rechts
//   Farbfeld: 0 Oberteil (Instanzfarbe), 1 Hose/Rock (Palette), 2 Haut, 3 Haare/Helm, 4 Schuhe, 5 feste Farbe, 6 Tasche/Rad
// aInst: x = Schrittphase (rad), y = Bewegung 0..1, z = Zufall für Paletten, w = frei.
import * as THREE from 'three';
import { VKit } from './vehicles_kit.js';

const L = (limb, slot) => limb * 8 + slot;
const PANTS = [0x2c3e5c, 0x3a3f45, 0x5b5f66, 0x22303f, 0x6b5a45, 0x1f2124, 0x7a8a99, 0x4a3b5c];
const SKIN = [0xf1c9a5, 0xe3b48f, 0xc98e66, 0xa4704c, 0x7a4f34, 0xf4d2b8];
const HAIR = [0x2a1d14, 0x4a3020, 0x6e4a2a, 0xb08a4a, 0x8f8f8f, 0x1c1c1c, 0xd8c08a, 0x7a2a1a];
const BAG = [0x2a2d31, 0x8a3c2e, 0x2f6db3, 0x4a3b2c, 0x2f7a4f, 0xe8b52c, 0xb8302a, 0xd9dcdf];

// Kasten mit Glied + Farbfeld
function bx(k, x0, y0, z0, x1, y1, z1, limb, slot, color = 0xffffff, f) { k.box(x0, y0, z0, x1, y1, z1, color, L(limb, slot), f); }

// ---------------------------------------------------------------- Fußgänger
function person(k, d, style) {
  const hipY = 0.088, shY = 0.143;
  // Beine (Drehpunkt Hüfte)
  for (const [s, limb] of [[1, 1], [-1, 2]]) {
    k.setPivot(s * 0.0085, hipY, 0);
    const legTop = style === 'dress' ? 0.06 : hipY;
    bx(k, s * 0.0085 - 0.0062, 0.008, -0.0068, s * 0.0085 + 0.0062, legTop, 0.0068, limb, style === 'dress' ? 2 : 1, style === 'dress' ? 0xf0e0d0 : 0xffffff);
    bx(k, s * 0.0085 - 0.0065, 0.0, -0.008, s * 0.0085 + 0.0065, 0.008, 0.012, limb, 4, 0x1f1f22);
  }
  k.clearPivot();
  // Rumpf (leicht verjüngt zur Taille)
  if (style === 'dress') {
    k.prism([[-0.011, 0.058], [0.011, 0.058], [0.011, 0.1], [-0.011, 0.1]], 0.02, 0.016, 0xffffff, L(0, 1));
    k.prism([[-0.0105, 0.098], [0.0105, 0.098], [0.0105, 0.145], [-0.0105, 0.145]], 0.016, 0.019, 0xffffff, L(0, 0));
  } else {
    k.prism([[-0.0105, 0.084], [0.0105, 0.084], [0.0105, 0.094], [-0.0105, 0.094]], 0.0155, 0.0155, 0xffffff, L(0, 1));
    k.prism([[-0.0108, 0.092], [0.0108, 0.092], [0.0108, 0.145], [-0.0108, 0.145]], 0.0155, 0.0185, 0xffffff, L(0, 0));
  }
  // Arme (Drehpunkt Schulter)
  if (d >= 2) {
    for (const [s, limb] of [[1, 3], [-1, 4]]) {
      k.setPivot(s * 0.022, shY, 0);
      bx(k, s * 0.022 - 0.0045, 0.098, -0.0048, s * 0.022 + 0.0045, 0.145, 0.0048, limb, 0);
      bx(k, s * 0.022 - 0.0042, 0.086, -0.0045, s * 0.022 + 0.0042, 0.098, 0.0045, limb, 2);
    }
    k.clearPivot();
  }
  // Hals, Kopf, Haare
  bx(k, -0.004, 0.145, -0.004, 0.004, 0.151, 0.004, 0, 2);
  bx(k, -0.0085, 0.151, -0.0092, 0.0085, 0.171, 0.0092, 0, 2);
  bx(k, -0.0092, 0.165, -0.0098, 0.0092, 0.176, 0.0085, 0, 3);
  if (d >= 2) {
    bx(k, -0.0092, 0.152, -0.0099, 0.0092, 0.166, -0.006, 0, 3);
    if (style === 'long') bx(k, -0.0095, 0.138, -0.0102, 0.0095, 0.166, -0.004, 0, 3);
    if (style === 'bag') bx(k, -0.012, 0.1, -0.019, 0.012, 0.14, -0.0105, 0, 6);
  }
}

// ---------------------------------------------------------------- Radfahrer (Rad + Fahrer)
function cyclist(k, d) {
  const wr = 0.034, wb = 0.105;
  const seg = d >= 2 ? 10 : 6;
  for (const z of [wb / 2, -wb / 2]) {
    k.cyl('x', [0, wr, z], wr, 0.005, seg, 0x1a1b1d, L(0, 5), { capA: false, capB: false });
    if (d >= 2) k.cyl('x', [0, wr, z], wr * 0.85, 0.0025, seg, 0xb9bec4, L(0, 5), { side: false });
  }
  // Rahmen
  const frame = (a, b, w = 0.0035) => {
    const dx = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dz), ang = Math.atan2(dz, dx);
    k.group({ x: 0, y: (a[1] + b[1]) / 2, z: (a[2] + b[2]) / 2, rx: -ang + Math.PI / 2 }, () => bx(k, -w / 2, -len / 2, -w / 2, w / 2, len / 2, w / 2, 0, 6));
  };
  frame([0, wr, -wb / 2], [0, 0.085, -0.012]);
  frame([0, 0.085, -0.012], [0, 0.088, 0.04]);
  frame([0, 0.088, 0.04], [0, wr, wb / 2]);
  frame([0, wr, -wb / 2], [0, 0.04, 0.0]);
  frame([0, 0.04, 0.0], [0, 0.085, -0.012]);
  frame([0, 0.04, 0.0], [0, 0.088, 0.04]);
  bx(k, -0.018, 0.097, 0.036, 0.018, 0.101, 0.041, 0, 5, 0x2a2d31);
  bx(k, -0.005, 0.088, -0.022, 0.005, 0.094, -0.004, 0, 5, 0x1a1b1d);
  // Fahrer: sitzend, nach vorne gebeugt
  for (const [s, limb] of [[1, 5], [-1, 6]]) {
    k.setPivot(s * 0.008, 0.094, -0.012);
    k.group({ x: s * 0.008, y: 0.094, z: -0.012, rx: 0.9 }, () => bx(k, -0.006, -0.05, -0.0065, 0.006, 0.0, 0.0065, limb, 1));
    k.group({ x: s * 0.008, y: 0.094, z: -0.012, rx: 0.9 }, () => bx(k, -0.006, -0.064, -0.006, 0.006, -0.05, 0.008, limb, 4, 0x1f1f22));
  }
  k.clearPivot();
  k.group({ x: 0, y: 0.094, z: -0.012, rx: 0.55 }, () => {
    k.prism([[-0.01, 0.0], [0.01, 0.0], [0.01, 0.052], [-0.01, 0.052]], 0.0155, 0.018, 0xffffff, L(0, 0));
    bx(k, -0.004, 0.052, -0.004, 0.004, 0.058, 0.004, 0, 2);
    bx(k, -0.0085, 0.058, -0.009, 0.0085, 0.077, 0.009, 0, 2);
    bx(k, -0.0095, 0.071, -0.0105, 0.0095, 0.082, 0.0095, 0, 3);
  });
  if (d >= 2) for (const s of [1, -1]) k.group({ x: s * 0.019, y: 0.13, z: 0.012, rx: 1.0 }, () => bx(k, -0.004, -0.045, -0.004, 0.004, 0.0, 0.004, 0, 0));
}

// ---------------------------------------------------------------- Vogel (Flügelschlag im Shader)
function bird(k) {
  k.lathe([[0.022, 0.0, 0.0, 0.0], [0.012, 0.005, 0.005, 0.0], [-0.008, 0.006, 0.005, 0.0], [-0.024, 0.0, 0.0, 0.002]], 5, 0xffffff, L(0, 0));
  for (const [s, limb] of [[1, 7], [-1, 8]]) {
    k.setPivot(0, 0.0, 0);
    const pts = [[0.0, 0.0, 0.012], [s * 0.03, 0.0, 0.0], [s * 0.032, 0.0, -0.012], [0.0, 0.0, -0.008]];
    k.poly(pts, 0xffffff, L(limb, 0), [0, 1, 0]);
    k.poly(pts, 0xd0d0d0, L(limb, 0), [0, -1, 0]);
  }
  k.clearPivot();
  k.tri([0, 0.0, -0.02], [0.008, 0.0, -0.032], [-0.008, 0.0, -0.032], 0xffffff, L(0, 0));
  k.tri([0, 0.0, -0.02], [-0.008, 0.0, -0.032], [0.008, 0.0, -0.032], 0xffffff, L(0, 0));
}

// Regenschirm über dem Kopf
function umbrella(k) {
  k.latheY([[0.18, 0.042], [0.192, 0.03], [0.2, 0.0]], 8, 0xffffff, L(0, 0));
  k.latheY([[0.2, 0.0], [0.192, 0.03], [0.18, 0.042]], 8, 0x9a9a9a, L(0, 0));
  k.box(-0.0012, 0.11, -0.0012, 0.0012, 0.2, 0.0012, 0x2a2d31, L(0, 5));
}

const BUILDERS = {
  man: (k, d) => person(k, d, 'plain'),
  woman: (k, d) => person(k, d, 'dress'),
  long: (k, d) => person(k, d, 'long'),
  bag: (k, d) => person(k, d, 'bag'),
  cyclist: (k, d) => cyclist(k, d),
  bird: (k) => bird(k),
  umbrella: (k) => umbrella(k),
};

const cache = new Map();
export function lifeGeometry(id, d = 2) {
  const key = id + '|' + d;
  if (cache.has(key)) return cache.get(key);
  const k = new VKit(d);
  BUILDERS[id](k, d);
  const geo = k.build();
  if (!geo.attributes.aPiv) geo.setAttribute('aPiv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
  cache.set(key, geo);
  return geo;
}

let _mat = null;
export function getPeopleMaterial() {
  if (_mat) return _mat;
  const pal = (arr) => arr.map((h) => new THREE.Color(h));
  const U = { uPants: { value: pal(PANTS) }, uSkin: { value: pal(SKIN) }, uHair: { value: pal(HAIR) }, uBag: { value: pal(BAG) } };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aPart;
attribute vec4 aInst;
attribute vec3 aPiv;
uniform vec3 uPants[8];
uniform vec3 uSkin[6];
uniform vec3 uHair[8];
uniform vec3 uBag[8];`)
      .replace('#include <color_vertex>', `
vColor = vec3(1.0);
vColor *= color;
{
  int slot = int(mod(aPart + 0.5, 8.0));
  float sd = aInst.z;
  if (slot == 0) {
#ifdef USE_INSTANCING_COLOR
    vColor *= instanceColor.xyz;
#endif
  }
  else if (slot == 1) vColor *= uPants[int(fract(sd * 7.13) * 7.99)];
  else if (slot == 2) vColor *= uSkin[int(fract(sd * 3.71) * 5.99)];
  else if (slot == 3) vColor *= uHair[int(fract(sd * 5.37) * 7.99)];
  else if (slot == 6) vColor *= uBag[int(fract(sd * 9.91) * 7.99)];
}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  int limb = int((aPart + 0.5) / 8.0);
  float ph = aInst.x, amt = aInst.y;
  float ang = 0.0;
  if (limb == 1 || limb == 6) ang = sin(ph) * 0.55 * amt;
  else if (limb == 2 || limb == 5) ang = -sin(ph) * 0.55 * amt;
  else if (limb == 3) ang = -sin(ph) * 0.45 * amt;
  else if (limb == 4) ang = sin(ph) * 0.45 * amt;
  if (limb >= 1 && limb <= 6) {
    vec3 q = transformed - aPiv;
    float c = cos(ang), s = sin(ang);
    q = vec3(q.x, q.y * c - q.z * s, q.y * s + q.z * c);
    transformed = q + aPiv;
  } else if (limb == 7 || limb == 8) {
    float w = (sin(ph) * 0.85 + 0.15) * amt * (limb == 7 ? 1.0 : -1.0);
    vec3 q = transformed - aPiv;
    float c = cos(w), s = sin(w);
    q = vec3(q.x * c - q.y * s, q.x * s + q.y * c, q.z);
    transformed = q + aPiv;
  }
  if (limb < 7) transformed.y += abs(sin(ph)) * 0.0035 * amt * step(aInst.w, 0.5);
}`);
  };
  mat.customProgramCacheKey = () => 'people1';
  _mat = mat;
  return mat;
}
