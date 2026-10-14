// Gelände, Wasser & Natur (Besitzer G7).
// Hochaufgelöstes Höhenfeld (weiche Hügel, Felsklippen, natürliche Uferlinien), ein Shader mit Texturmischung
// (Wiese mit Blumen, Rasen, Waldboden, Erde, Kies, Fels, Sand, Schnee – alles prozedural, eigene Detailtexturen),
// Diorama-Ränder mit Erdschichten, schwebende Unterseite der Erdscholle und ein Umland im Dunst.
// Wasser: water.js, Pflanzen: vegetation.js.
//
// Öffentliche Schnittstelle (scene.js): group, refreshColors(), refreshTrees().
// Zusätzlich für andere Ansichten: heightAt(wx, wz) – Geländehöhe in Weltkoordinaten (Land = 0, Fels > 0, Seegrund < 0),
// waterLevel (−0.14), isWater(wx, wz). Bäume stehen nie auf Straßen oder Gebäuden.
import * as THREE from 'three';
import { T, RES } from '../config.js';
import { makeNoise, mulberry32, clamp, smoothstep } from '../util.js';
import { shared } from './materials.js';
import { registerView } from '../registry.js';
import { WaterView, WATER_LEVEL } from './water.js';
import { Vegetation } from './vegetation.js';

const BOTTOM = -3.2;          // Unterkante der Seitenwände
const OUTER_Y = -16;          // Höhe des Umlands (tief unter der schwebenden Scholle)

// ---------------------------------------------------------------------------------------------
// Kachelbare Rauschfunktionen für die Texturerzeugung (einmal pro Seite, zwischengespeichert)

function tileNoise(seed) {
  const lats = new Map();
  const lat = (n) => {
    let a = lats.get(n);
    if (!a) {
      const r = mulberry32((seed * 7919 + n * 104729) >>> 0);
      a = new Float32Array(n * n);
      for (let i = 0; i < n * n; i++) a[i] = r();
      lats.set(n, a);
    }
    return a;
  };
  function vn(u, v, n) {
    const a = lat(n);
    const x = u * n, y = v * n;
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const x0 = ((xi % n) + n) % n, y0 = ((yi % n) + n) % n;
    const x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
    const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
    const a00 = a[y0 * n + x0], a10 = a[y0 * n + x1], a01 = a[y1 * n + x0], a11 = a[y1 * n + x1];
    return a00 + (a10 - a00) * sx + (a01 - a00) * sy + (a00 - a10 - a01 + a11) * sx * sy;
  }
  function fbm(u, v, n, oct, gain = 0.5) {
    let s = 0, amp = 1, norm = 0;
    for (let o = 0; o < oct; o++) { s += amp * vn(u, v, n << o); norm += amp; amp *= gain; }
    return s / norm;
  }
  // Zellrauschen: [F1, F2] in Zellgrößen
  const pts = new Map();
  function cellPts(n) {
    let p = pts.get(n);
    if (!p) {
      const r = mulberry32((seed * 31337 + n) >>> 0);
      p = new Float32Array(n * n * 2);
      for (let i = 0; i < n * n * 2; i++) p[i] = r();
      pts.set(n, p);
    }
    return p;
  }
  function worley(u, v, n, out) {
    const p = cellPts(n);
    const x = u * n, y = v * n;
    const cx = Math.floor(x), cy = Math.floor(y);
    let f1 = 9, f2 = 9;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const gx = cx + ox, gy = cy + oy;
      const wx = ((gx % n) + n) % n, wy = ((gy % n) + n) % n;
      const k = (wy * n + wx) * 2;
      const dx = gx + p[k] - x, dy = gy + p[k + 1] - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    out[0] = f1; out[1] = f2;
    return out;
  }
  return { vn, fbm, worley };
}

// Für water.js und vegetation.js (Funktionsdeklaration: auch bei zyklischem Import sofort verfügbar)
export function tileNoiseFn(seed) { return tileNoise(seed); }

function dataTex(size, data, { repeat = true, mips = true } = {}) {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.generateMipmaps = mips;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

const b8 = (v) => (v <= 0 ? 0 : v >= 1 ? 255 : (v * 255 + 0.5) | 0);

// Normiert die Farbkanäle auf Mittelwert 0.5 (Detailtexturen werden im Shader mit 2 multipliziert).
function normalizeMean(col, n) {
  const m = [0, 0, 0];
  for (let i = 0; i < n; i++) { m[0] += col[i * 3]; m[1] += col[i * 3 + 1]; m[2] += col[i * 3 + 2]; }
  for (let c = 0; c < 3; c++) m[c] = 0.5 / Math.max(1e-4, m[c] / n);
  for (let i = 0; i < n; i++) { col[i * 3] *= m[0]; col[i * 3 + 1] *= m[1]; col[i * 3 + 2] *= m[2]; }
}

let TEX = null;
export function natureTextures() {
  if (TEX) return TEX;
  const t0 = performance.now();
  const tn = tileNoise(1337);
  const wo = [0, 0];
  // Rauschen: R grob, G mittel, B Zell-F1, A Zellkanten (F2−F1)
  const NS = 256;
  const nd = new Uint8Array(NS * NS * 4);
  for (let y = 0; y < NS; y++) for (let x = 0; x < NS; x++) {
    const u = x / NS, v = y / NS, i = (y * NS + x) * 4;
    nd[i] = b8((tn.fbm(u, v, 4, 5) - 0.5) * 1.6 + 0.5);
    nd[i + 1] = b8((tn.fbm(u + 0.37, v + 0.71, 8, 4) - 0.5) * 1.6 + 0.5);
    tn.worley(u, v, 8, wo);
    nd[i + 2] = b8(wo[0] / 0.85);
    nd[i + 3] = b8((wo[1] - wo[0]) / 0.6);
  }
  const noise = dataTex(NS, nd);

  // Gras: Halme von oben, farbige Abweichung um den Mittelwert, Alpha = Höhe
  const GS = 512, GN = GS * GS;
  const gc = new Float32Array(GN * 3), gh = new Float32Array(GN);
  for (let y = 0; y < GS; y++) for (let x = 0; x < GS; x++) {
    const u = x / GS, v = y / GS, i = y * GS + x;
    const l = 0.72 + 0.5 * tn.fbm(u, v, 16, 3);
    const w = tn.vn(u + 0.5, v, 32);
    gc[i * 3] = l * (0.95 + w * 0.12); gc[i * 3 + 1] = l; gc[i * 3 + 2] = l * 0.9;
    gh[i] = 0.25 * l;
  }
  {
    const r = mulberry32(99);
    const pal = [[0.55, 0.66, 0.5, 0.42], [0.95, 1.0, 0.92, 0.75], [1.25, 1.22, 0.98, 0.9], [1.42, 1.26, 0.78, 0.97], [0.75, 0.88, 0.62, 1]];
    for (let k = 0; k < 30000; k++) {
      let x = r() * GS, y = r() * GS;
      const a = r() * Math.PI * 2, len = 3 + r() * 8;
      const pr = r();
      const c = pal.find((p) => pr < p[3]);
      const dx = Math.cos(a), dy = Math.sin(a);
      for (let s = 0; s < len; s++) {
        const px = ((x | 0) % GS + GS) % GS, py = ((y | 0) % GS + GS) % GS;
        const i = py * GS + px;
        const f = 0.65 + 0.45 * (s / len);
        gc[i * 3] = gc[i * 3] * 0.25 + c[0] * f * 0.75;
        gc[i * 3 + 1] = gc[i * 3 + 1] * 0.25 + c[1] * f * 0.75;
        gc[i * 3 + 2] = gc[i * 3 + 2] * 0.25 + c[2] * f * 0.75;
        gh[i] = Math.max(gh[i], 0.35 + 0.65 * s / len);
        x += dx; y += dy;
      }
    }
  }
  normalizeMean(gc, GN);
  const gd = new Uint8Array(GN * 4);
  for (let i = 0; i < GN; i++) { gd[i * 4] = b8(gc[i * 3]); gd[i * 4 + 1] = b8(gc[i * 3 + 1]); gd[i * 4 + 2] = b8(gc[i * 3 + 2]); gd[i * 4 + 3] = b8(gh[i]); }
  const grass = dataTex(GS, gd);

  // Fels: Schichtung entlang v (Seitenprojektion nutzt Weltöhe als v), Risse, Flechten
  const RS = 512, RN = RS * RS;
  const rc = new Float32Array(RN * 3), rh = new Float32Array(RN);
  for (let y = 0; y < RS; y++) for (let x = 0; x < RS; x++) {
    const u = x / RS, v = y / RS, i = y * RS + x;
    const warp = (tn.fbm(u, v, 4, 3) - 0.5) * 0.18;
    const band = tn.fbm(0.13 + u * 0.08, v + warp, 16, 3);
    const fine = tn.fbm(u, v, 32, 3);
    tn.worley(u, v + warp * 0.5, 12, wo);
    const crack = 1 - smoothstep(0.0, 0.07, wo[1] - wo[0]);
    tn.worley(u + 0.5, v + 0.25, 40, wo);
    const pits = smoothstep(0.25, 0.0, wo[0]) * 0.5;
    let l = 0.68 + 0.42 * band + 0.25 * (fine - 0.5) - crack * 0.42 - pits * 0.12;
    const lichen = smoothstep(0.62, 0.75, tn.fbm(u + 0.21, v + 0.63, 8, 3));
    rc[i * 3] = l * (1.0 + (band - 0.5) * 0.12 + lichen * 0.08);
    rc[i * 3 + 1] = l * (0.98 + lichen * 0.12);
    rc[i * 3 + 2] = l * (0.95 - (band - 0.5) * 0.1 - lichen * 0.12);
    rh[i] = clamp(0.25 + 0.45 * band + 0.3 * fine - crack * 0.45 - pits * 0.2, 0, 1);
  }
  normalizeMean(rc, RN);
  const rd = new Uint8Array(RN * 4);
  for (let i = 0; i < RN; i++) { rd[i * 4] = b8(rc[i * 3]); rd[i * 4 + 1] = b8(rc[i * 3 + 1]); rd[i * 4 + 2] = b8(rc[i * 3 + 2]); rd[i * 4 + 3] = b8(rh[i]); }
  const rock = dataTex(RS, rd);

  // Sand: Rippel (kachelbar: ganzzahlige Frequenzen), Körnung, dunkle Körner
  const SS = 256, SN = SS * SS;
  const sc = new Float32Array(SN * 3), sh = new Float32Array(SN);
  const sr = mulberry32(5);
  for (let y = 0; y < SS; y++) for (let x = 0; x < SS; x++) {
    const u = x / SS, v = y / SS, i = y * SS + x;
    const w = (tn.fbm(u, v, 4, 3) - 0.5) * 0.12;
    const rip = 0.5 + 0.5 * Math.sin(Math.PI * 2 * (14 * (v + w) + 2 * u));
    const grain = sr();
    let l = 0.9 + rip * 0.12 + (grain - 0.5) * 0.18 + (tn.fbm(u, v, 16, 3) - 0.5) * 0.2;
    if (grain > 0.985) l *= 0.6;
    sc[i * 3] = l; sc[i * 3 + 1] = l * 0.98; sc[i * 3 + 2] = l * 0.95;
    sh[i] = clamp(rip * 0.7 + grain * 0.15, 0, 1);
  }
  normalizeMean(sc, SN);
  const sd = new Uint8Array(SN * 4);
  for (let i = 0; i < SN; i++) { sd[i * 4] = b8(sc[i * 3]); sd[i * 4 + 1] = b8(sc[i * 3 + 1]); sd[i * 4 + 2] = b8(sc[i * 3 + 2]); sd[i * 4 + 3] = b8(sh[i]); }
  const sand = dataTex(SS, sd);

  TEX = { noise, grass, rock, sand, ms: performance.now() - t0 };
  return TEX;
}

// ---------------------------------------------------------------------------------------------
// GLSL-Bausteine

export const GLSL_COMMON = /* glsl */`
vec3 g7lin(vec3 c) { return pow(c, vec3(2.2)); }
float g7h(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec3 g7bump(vec3 surfPos, vec3 n, float hgt, float fd) {
  vec2 dH = vec2(dFdx(hgt), dFdy(hgt));
  vec3 sx = normalize(dFdx(surfPos)), sy = normalize(dFdy(surfPos));
  vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1) * fd;
  vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
  return normalize(abs(det) * n - grad);
}
`;

const TERRAIN_FRAG_PARS = /* glsl */`
uniform sampler2D tNoise;
uniform sampler2D tGrass;
uniform sampler2D tRock;
uniform sampler2D tSand;
uniform sampler2D tMapA;
uniform sampler2D tMapB;
uniform vec2 uMapSize;
uniform float uTime;
uniform float uSnowK;
uniform float uWetK;
uniform float uFlowers;
uniform float uDry;
uniform float uLitter;
uniform vec3 uGrassTint;
uniform float uWL;
varying vec3 vWP;
varying vec3 vWN;
varying vec2 vEx;
float g7Hgt = 0.0;
float g7Rough = 0.95;
vec3 g7Spark = vec3(0.0);
${GLSL_COMMON}
`;

const TERRAIN_COLOR = /* glsl */`
{
  vec3 wp = vWP;
  vec3 wn = normalize(vWN);
  float slope = 1.0 - wn.y;
  // Ableitungen außerhalb der Verzweigungen (texture in Verzweigungen nur mit textureGrad)
  vec2 dX = dFdx(wp.xz), dY = dFdy(wp.xz);
  vec3 dX3 = dFdx(wp), dY3 = dFdy(wp);
  float px = length(fwidth(wp.xz)) * 15.0;
  vec4 nA = texture2D(tNoise, wp.xz * 0.011);
  vec4 nB = texture2D(tNoise, wp.xz * 0.053 + vec2(0.31, 0.17));
  vec4 nC = texture2D(tNoise, wp.xz * 0.23 + vec2(0.71, 0.43));
  vec2 warp = (vec2(nB.r, nC.g) - 0.5) * 1.1 + (vec2(nC.r, nB.g) - 0.5) * 0.35;
  vec2 tuv = (wp.xz + warp + uMapSize * 0.5) / uMapSize;
  vec4 mA = texture2D(tMapA, tuv);
  vec4 mB = texture2D(tMapB, tuv);
  float urban = mA.a;
  float forest = smoothstep(0.1, 0.62, mA.b);

  // Gras: zwei Maßstäbe gegen Wiederholung
  vec4 gt1 = texture2D(tGrass, wp.xz * 0.93);
  vec4 gt2 = texture2D(tGrass, wp.xz * 0.29 + 0.5);
  vec3 gdet = (gt1.rgb * 0.6 + gt2.rgb * 0.4) * 2.0;
  float gh = gt1.a * 0.6 + gt2.a * 0.4;

  vec3 gLush = g7lin(vec3(0.44, 0.57, 0.28));
  vec3 gFresh = g7lin(vec3(0.53, 0.64, 0.32));
  vec3 gDry = g7lin(vec3(0.65, 0.62, 0.38));
  vec3 gDeep = g7lin(vec3(0.34, 0.47, 0.24));
  vec3 grass = mix(gLush, gFresh, smoothstep(0.25, 0.75, nB.g));
  grass = mix(grass, gDeep, smoothstep(0.52, 0.85, nB.r) * 0.5);
  grass = mix(grass, gDry, clamp(smoothstep(0.45, 0.85, nA.r) * (0.3 + uDry * 0.6) + uDry * 0.22, 0.0, 1.0));
  grass = mix(grass, gDry * vec3(0.95, 0.9, 0.82), smoothstep(1.2, 4.2, wp.y) * 0.45);
  vec3 lawn = g7lin(vec3(0.47, 0.6, 0.3));
  grass = mix(grass, lawn, urban * 0.7);
  grass *= uGrassTint * gdet;
  grass = mix(grass, grass * vec3(0.84, 1.0, 0.8), mB.r * 0.7);
  // Waldboden: Moos, Nadeln, im Herbst Laub
  vec3 floorC = mix(g7lin(vec3(0.29, 0.35, 0.19)), g7lin(vec3(0.40, 0.33, 0.22)), smoothstep(0.35, 0.7, nC.r));
  floorC = mix(floorC, g7lin(vec3(0.62, 0.38, 0.15)), uLitter * 0.65 * smoothstep(0.3, 0.6, nC.b));
  vec3 col = mix(grass, floorC * gdet, forest * 0.85);
  // Fruchtbarer Boden: Erdflecken, Öl: dunkle Stellen
  vec3 soil = g7lin(vec3(0.43, 0.33, 0.22)) * (0.8 + 0.4 * gh);
  col = mix(col, soil, mB.r * smoothstep(0.6, 0.78, nC.r * 0.7 + nB.b * 0.3) * 0.5);
  col = mix(col, col * vec3(0.55, 0.56, 0.5), mB.a * smoothstep(0.5, 0.75, nB.b) * 0.55);
  float stoneAmt = mB.g * smoothstep(0.35, 0.65, nC.r) * 0.8 + mB.b;
  if (stoneAmt > 0.004) {
    vec4 rkS = textureGrad(tRock, wp.xz * 1.6, dX * 1.6, dY * 1.6);
    col = mix(col, g7lin(vec3(0.58, 0.55, 0.5)) * rkS.rgb * 2.0, mB.g * smoothstep(0.35, 0.65, nC.r) * 0.8);
    col = mix(col, g7lin(vec3(0.52, 0.49, 0.45)) * rkS.rgb * 2.0, mB.b);
  }

  // Blumen in freien Wiesen
  float meadow = (1.0 - urban) * (1.0 - forest) * (1.0 - mA.g) * (1.0 - mB.b) * (1.0 - mB.g) * smoothstep(0.3, 0.12, slope) * step(-0.01, wp.y);
  float fdens = meadow * uFlowers * smoothstep(0.4, 0.78, nB.b * 0.8 + nA.g * 0.45);
  if (fdens > 0.01) {
    vec2 fp = wp.xz * 15.0;
    vec2 cid = floor(fp);
    vec2 cf = fract(fp);
    vec2 cc = vec2(g7h(cid + 3.7), g7h(cid + 9.1)) * 0.6 + 0.2;
    float on = step(1.0 - fdens * 0.5, g7h(cid)) * (1.0 - smoothstep(0.09, 0.17 + px * 0.5, length(cf - cc)));
    float k = g7h(cid + 5.3);
    vec3 fc = k < 0.34 ? vec3(0.96, 0.95, 0.9) : k < 0.6 ? vec3(0.98, 0.83, 0.2) : k < 0.78 ? vec3(0.72, 0.48, 0.88) : k < 0.92 ? vec3(0.9, 0.22, 0.18) : vec3(0.42, 0.56, 0.95);
    float near = 1.0 - smoothstep(0.7, 1.5, px);
    col = mix(col, g7lin(fc), on * near * 0.85);
    col += g7lin(vec3(0.5, 0.45, 0.3)) * 0.06 * fdens * (1.0 - near);
  }

  // Sand, Strand und Uferböschung
  float sandM = 0.0, bank = 0.0, under = 0.0, wetLine = 0.0;
  float sandH = 0.5;
  if (mA.g > 0.004 || wp.y < -0.002) {
    vec4 sdT = textureGrad(tSand, wp.xz * 0.75, dX * 0.75, dY * 0.75);
    sandH = sdT.a;
    vec3 sandC = g7lin(vec3(0.86, 0.78, 0.58)) * sdT.rgb * 2.0;
    sandM = smoothstep(0.35, 0.65, mA.g + (nC.r - 0.5) * 0.35);
    bank = smoothstep(-0.004, -0.04, wp.y);
    float lowBank = smoothstep(-0.07, -0.125, wp.y + (nC.r - 0.5) * 0.04);
    vec3 mud = mix(g7lin(vec3(0.5, 0.44, 0.33)), g7lin(vec3(0.56, 0.54, 0.4)), smoothstep(0.35, 0.65, nC.r)) * (0.85 + 0.3 * gh);
    vec3 bankC = mix(col * vec3(0.86, 0.9, 0.76), mud, lowBank);
    bankC = mix(bankC, sandC * mix(1.0, 0.86, lowBank), max(sandM, smoothstep(0.62, 0.8, nB.b) * 0.5));
    col = mix(col, sandC, sandM * (1.0 - bank));
    col = mix(col, bankC, bank);
    // Unter Wasser: Sand, Schlick, Kiesel, Lichtnetz (Kaustik)
    if (wp.y < uWL + 0.012) {
      under = smoothstep(uWL + 0.01, uWL - 0.02, wp.y);
      float depth = max(0.0, uWL - wp.y);
      vec4 rkS = textureGrad(tRock, wp.xz * 1.6, dX * 1.6, dY * 1.6);
      vec3 bed = mix(g7lin(vec3(0.66, 0.6, 0.45)) * sdT.rgb * 2.0, g7lin(vec3(0.33, 0.37, 0.28)), smoothstep(0.08, 0.7, depth));
      bed = mix(bed, g7lin(vec3(0.52, 0.5, 0.46)) * rkS.rgb * 2.0, smoothstep(0.58, 0.8, nC.g) * 0.55);
      vec2 cu = wp.xz * 0.9;
      float c1 = textureGrad(tNoise, cu + vec2(uTime * 0.021, uTime * 0.013), dX * 0.9, dY * 0.9).a;
      float c2 = textureGrad(tNoise, cu * 1.27 + vec2(-uTime * 0.017, uTime * 0.019), dX * 1.14, dY * 1.14).a;
      float caus = pow(1.0 - smoothstep(0.0, 0.22, min(c1, c2)), 2.0);
      bed += caus * 0.32 * (1.0 - smoothstep(0.0, 0.9, depth)) * g7lin(vec3(0.95, 1.0, 0.9));
      col = mix(col, bed, under);
    }
    wetLine = smoothstep(uWL + 0.045, uWL + 0.004, wp.y) * (1.0 - under);
    col *= 1.0 - wetLine * 0.2;
  }

  // Fels an Hängen und in der Höhe, Geröll am Hangfuß (Dreifachprojektion, Schichtung waagerecht)
  float rockAmt = 0.0, scree = 0.0, rockH = 0.5;
  if (wp.y > 0.03 && (slope > 0.1 || wp.y > 2.2)) {
    vec3 bw = pow(abs(wn), vec3(4.0));
    bw /= (bw.x + bw.y + bw.z);
    vec2 sx = vec2(0.42, 0.7);
    vec4 rx = textureGrad(tRock, vec2(wp.z, wp.y) * sx, vec2(dX3.z, dX3.y) * sx, vec2(dY3.z, dY3.y) * sx);
    vec4 rz = textureGrad(tRock, vec2(wp.x, wp.y) * sx + vec2(0.0, 0.5), vec2(dX3.x, dX3.y) * sx, vec2(dY3.x, dY3.y) * sx);
    vec4 ry = textureGrad(tRock, wp.xz * 0.42, dX * 0.42, dY * 0.42);
    vec4 rk = rx * bw.x + ry * bw.y + rz * bw.z;
    rockH = rk.a;
    vec3 rockC = mix(g7lin(vec3(0.5, 0.47, 0.43)), g7lin(vec3(0.66, 0.63, 0.58)), smoothstep(0.3, 0.7, nB.g));
    rockC = mix(rockC, g7lin(vec3(0.6, 0.5, 0.39)), smoothstep(0.55, 0.8, nA.g) * 0.5);
    rockC *= rk.rgb * 2.0;
    float above = smoothstep(0.03, 0.2, wp.y);
    rockAmt = smoothstep(0.30, 0.5, slope + (nC.r - 0.5) * 0.28 + (rk.a - 0.5) * 0.25);
    rockAmt = max(rockAmt, smoothstep(3.2, 5.2, wp.y + (nB.r - 0.5) * 2.0) * smoothstep(0.08, 0.26, slope));
    rockAmt *= above;
    scree = above * smoothstep(0.12, 0.3, slope) * (1.0 - rockAmt) * smoothstep(0.45, 0.75, nC.b + mA.r * 0.2);
    col = mix(col, rockC * 1.08, scree * 0.65);
    col = mix(col, rockC, rockAmt);
  }

  // Schnee: Gipfel immer, im Winter überall auf flachen Flächen
  float sN = (nC.g - 0.5) * 0.5 + (gh - 0.5) * 0.25;
  float snowLine = 5.1 + (nB.r - 0.5) * 2.2;
  float peak = smoothstep(snowLine, snowLine + 0.7, wp.y + sN * 2.0) * smoothstep(0.74, 0.32, slope + sN * 0.3);
  // Winterdecke: großräumige Verwehungen, dünnere Stellen unter Bäumen, Grasbüschel und Halme schauen durch
  vec4 nD = texture2D(tNoise, wp.xz * 0.021 + vec2(0.13, 0.57));
  vec4 nF = texture2D(tNoise, wp.xz * 0.61 + vec2(0.47, 0.29));
  float drift = nD.g * 0.6 + nB.b * 0.4;
  float sDepth = uSnowK * (1.2 + (drift - 0.5) * 0.7 - forest * 0.3 - urban * 0.08) - (gh - 0.5) * 0.35;
  float seas = smoothstep(0.32, 0.62, sDepth) * smoothstep(0.62 - 0.32 * uSnowK, 0.86, wn.y + sN) * (1.0 - under) * (1.0 - wetLine * 0.6);
  float snow = clamp(max(peak, seas), 0.0, 1.0);
  // Farbe: Kämme hell und leicht warm, Mulden und Windschatten kühl bläulich, feine Körnung, am Stadtrand etwas grauer
  float crest = smoothstep(0.3, 0.75, drift * 0.7 + nC.g * 0.3);
  vec3 snowC = mix(g7lin(vec3(0.80, 0.85, 0.95)), g7lin(vec3(0.97, 0.97, 0.98)), crest);
  snowC *= 0.93 + 0.09 * nF.r + 0.04 * gh;
  snowC = mix(snowC, snowC * vec3(0.9, 0.89, 0.87), urban * 0.45 * smoothstep(0.4, 0.7, nC.b));
  // Wo die Decke dünn wird: welkes, olivbraunes Wintergras statt Sommergrün
  vec3 winterGrass = mix(g7lin(vec3(0.42, 0.40, 0.27)), g7lin(vec3(0.55, 0.50, 0.33)), nB.g) * gdet;
  col = mix(col, winterGrass, uSnowK * (1.0 - forest * 0.6) * (1.0 - rockAmt) * (1.0 - scree) * (1.0 - sandM) * (1.0 - bank) * (1.0 - under) * 0.85);
  col = mix(col, snowC, snow);

  col *= 1.0 - uWetK * 0.28 * (1.0 - snow) * (1.0 - under);
  col *= vEx.x;
  diffuseColor.rgb = col;

  g7Hgt = mix(gh * 0.22 * (1.0 - urban * 0.5), rockH * 1.1, max(rockAmt, scree * 0.6));
  g7Hgt = mix(g7Hgt, sandH * 0.35, sandM * (1.0 - bank) + under * 0.6);
  // Schneerelief: weiche Verwehungen und vom Wind geriffelte Oberfläche (nur in der Nähe)
  float sNear = 1.0 - smoothstep(0.35, 1.2, px);
  vec2 wdir = vec2(0.8, 0.6);
  float rip = sin(dot(wp.xz, wdir) * 21.0 + nB.r * 7.0 + nC.g * 3.0) * 0.5 + 0.5;
  float snowH = drift * 0.5 + nC.g * 0.18 + (rip * 0.1 + nF.r * 0.08) * sNear;
  g7Hgt = mix(g7Hgt, snowH, snow * 0.8);
  // Glitzern: einzelne Kristallfacetten (nur nah, damit in der Ferne nichts flimmert)
  vec2 gc = floor(wp.xz * 30.0);
  float gk = step(0.95, g7h(gc + 0.37)) * snow * (1.0 - smoothstep(0.2, 0.55, px));
  g7Spark = vec3(g7h(gc + 7.1) - 0.5, 0.0, g7h(gc + 2.9) - 0.5) * 1.4 * gk;
  g7Rough = mix(0.97, 0.84, rockAmt);
  g7Rough = mix(g7Rough, 0.93, sandM);
  g7Rough = mix(g7Rough, 0.45, wetLine);
  g7Rough = mix(g7Rough, mix(0.55, 0.72, nF.g), snow);
  g7Rough = mix(g7Rough, 0.15, gk);
  g7Rough -= uWetK * 0.4 * (1.0 - snow);
}
`;

function makeTerrainMaterial(tv) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  const u = tv.uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec2 aEx;
varying vec3 vWP;
varying vec3 vWN;
varying vec2 vEx;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vEx = aEx;
vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWN = normalize(mat3(modelMatrix) * objectNormal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${TERRAIN_FRAG_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${TERRAIN_COLOR}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(g7Rough, 0.04, 1.0);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = g7bump(-vViewPosition, normal, g7Hgt * 0.9, faceDirection);\nnormal = normalize(normal + (viewMatrix * vec4(g7Spark, 0.0)).xyz);');
  };
  mat.customProgramCacheKey = () => 'g7terrain';
  return mat;
}

// Seitenwände und Unterseite der Erdscholle: Erdschichten, Kiesel, Wurzeln, Fels in der Tiefe.
function makeSlabMaterial(tv) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, tv.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aTop;
varying float vTop;
varying vec3 vWP;
varying vec3 vWN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vTop = aTop;
vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWN = normalize(mat3(modelMatrix) * objectNormal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tNoise;
uniform sampler2D tRock;
uniform sampler2D tGrass;
uniform float uSnowK;
uniform float uNightK;
varying float vTop;
varying vec3 vWP;
varying vec3 vWN;
float g7Hgt = 0.0;
${GLSL_COMMON}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 wp = vWP;
  vec3 wn = normalize(vWN);
  float hx = abs(wn.x) > abs(wn.z) ? wp.z : wp.x;
  float dep = vTop - wp.y;
  float isRock = smoothstep(0.25, 0.6, vTop);
  float dG = min(vTop, 0.0) - wp.y;
  vec4 n1 = texture2D(tNoise, vec2(hx * 0.043, 0.37));
  vec4 n2 = texture2D(tNoise, vec2(hx, wp.y) * vec2(0.19, 0.55));
  vec4 n3 = texture2D(tNoise, vec2(hx, wp.y) * vec2(0.9, 1.3));
  float wob = (n1.r - 0.5) * 0.7 + (n2.g - 0.5) * 0.18;
  float d = mix(dep, max(dG, 0.0) + 0.5, isRock) + wob * 0.5;
  vec3 c = g7lin(vec3(0.38, 0.54, 0.24));
  c = mix(c, g7lin(vec3(0.27, 0.2, 0.14)), smoothstep(0.035, 0.08, dep + (n3.r - 0.5) * 0.03));
  c = mix(c, g7lin(vec3(0.48, 0.36, 0.24)), smoothstep(0.32, 0.46, d));
  c = mix(c, g7lin(vec3(0.6, 0.47, 0.33)), smoothstep(1.0, 1.12, d));
  c = mix(c, g7lin(vec3(0.72, 0.62, 0.45)), smoothstep(1.42, 1.52, d) * (1.0 - smoothstep(1.72, 1.82, d)));
  c = mix(c, g7lin(vec3(0.52, 0.42, 0.33)), smoothstep(1.82, 1.9, d) * (1.0 - smoothstep(2.1, 2.2, d)));
  vec4 rkS = texture2D(tRock, vec2(hx * 0.42, wp.y * 0.7));
  vec3 rockC = g7lin(vec3(0.5, 0.47, 0.44)) * rkS.rgb * 2.0;
  c = mix(c, rockC, smoothstep(2.2, 2.5, d));
  c = mix(c, g7lin(vec3(0.34, 0.31, 0.3)) * rkS.rgb * 2.0, smoothstep(4.0, 7.0, d));
  // Kiesel und Steine im Lehm
  float peb = (1.0 - smoothstep(0.08, 0.16, n3.b)) * smoothstep(0.3, 0.5, d) * (1.0 - smoothstep(2.2, 2.5, d));
  c = mix(c, g7lin(vec3(0.62, 0.58, 0.52)) * (0.8 + 0.4 * n2.r), peb * 0.85);
  // Wurzeln unter der Grasnarbe
  float root = (1.0 - smoothstep(0.0, 0.05, abs(n2.a - 0.5) * 2.0 - 0.8)) * smoothstep(0.06, 0.1, dep) * (1.0 - smoothstep(0.3, 0.55, dep));
  c = mix(c, g7lin(vec3(0.2, 0.15, 0.1)), root * 0.6);
  // Felsige Säulen (Berge an der Kante)
  float rockCol = isRock;
  vec3 mtn = mix(g7lin(vec3(0.6, 0.57, 0.52)), g7lin(vec3(0.68, 0.64, 0.58)), n2.g) * rkS.rgb * 2.0;
  c = mix(c, mtn, rockCol * smoothstep(0.02, 0.1, dep) * smoothstep(-0.3, 0.1, wp.y));
  c *= 0.86 + 0.28 * n2.r;
  // Schnee auf der Grasnarbe
  c = mix(c, vec3(0.86, 0.88, 0.92), uSnowK * (1.0 - smoothstep(0.02, 0.05, dep)));
  // Unterseite (zeigt nach unten): dunkler, Fels
  c *= mix(1.0, 0.7, smoothstep(0.0, -0.6, wn.y));
  diffuseColor.rgb = c;
  g7Hgt = mix(n3.r * 0.2 + peb * 0.4, rkS.a, smoothstep(2.2, 2.5, d) + rockCol) * 0.7;
}`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = g7bump(-vViewPosition, normal, g7Hgt, faceDirection);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.16 * (1.0 - uNightK);');
  };
  mat.customProgramCacheKey = () => 'g7slab';
  return mat;
}

// Umland im Dunst: Felder, Hecken, Wälder, Dörfer, Hügel, ferne Berge, Meer/Seen/Flüsse – ein einziger Draw Call.
function makeOuterMaterial(tv) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, fog: false });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, tv.uniforms, tv.outerUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aWet;
varying float vWet;
varying vec3 vWP;
varying vec3 vWN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vWet = aWet;
vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWN = normalize(mat3(modelMatrix) * objectNormal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tNoise;
uniform sampler2D tGrass;
uniform float uSnowK;
uniform float uFlowers;
uniform float uDry;
uniform float uSeasonT;
uniform vec3 uGrassTint;
uniform vec3 uHaze;
uniform vec3 uSkyTop;
uniform float uHazeK;
uniform float uTime;
varying float vWet;
varying vec3 vWP;
varying vec3 vWN;
float g7Hgt = 0.0;
float g7Water = 0.0;
${GLSL_COMMON}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 wp = vWP;
  vec3 wn = normalize(vWN);
  float slope = 1.0 - wn.y;
  vec4 nA = texture2D(tNoise, wp.xz * 0.0021);
  vec4 nB = texture2D(tNoise, wp.xz * 0.0093 + 0.3);
  vec4 nC = texture2D(tNoise, wp.xz * 0.041 + 0.6);
  // Felder: gedrehtes Raster mit Hecken an den Rändern
  float ang = 0.35 + step(0.5, nA.g) * 0.95 + step(0.62, nA.r) * 0.4;
  mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  vec2 q = rot * wp.xz / vec2(7.0, 4.6);
  q.x += floor(q.y) * 0.37;
  vec2 id = floor(q);
  vec2 f = fract(q);
  float hh = g7h(id);
  float spring = 1.0 - smoothstep(0.18, 0.3, uSeasonT) ;
  float autumn = smoothstep(0.5, 0.65, uSeasonT) * (1.0 - smoothstep(0.85, 0.95, uSeasonT));
  vec3 fc;
  if (hh < 0.22) fc = mix(vec3(0.80, 0.70, 0.40), vec3(0.55, 0.42, 0.28), autumn);           // Weizen / Stoppel
  else if (hh < 0.4) fc = mix(vec3(0.47, 0.6, 0.29), vec3(0.6, 0.55, 0.32), autumn);         // grüne Saat
  else if (hh < 0.52) fc = vec3(0.52, 0.41, 0.29);                                            // gepflügt
  else if (hh < 0.6) fc = mix(vec3(0.62, 0.66, 0.35), vec3(0.88, 0.8, 0.28), spring);        // Raps im Frühling
  else if (hh < 0.8) fc = vec3(0.53, 0.64, 0.33);                                             // Weide
  else fc = vec3(0.66, 0.64, 0.4);                                                            // Heu
  vec3 col = g7lin(fc) * uGrassTint;
  // Furchen (verblassen in der Ferne)
  float fpx = length(fwidth(q * 30.0));
  col *= 1.0 - 0.06 * (0.5 + 0.5 * sin(f.y * 30.0 * 6.2832 / 6.5 + hh * 10.0)) * (1.0 - smoothstep(0.3, 1.0, fpx));
  col *= 0.9 + 0.2 * g7h(id + 0.5);
  float edge = min(min(f.x, 1.0 - f.x) * 10.0, min(f.y, 1.0 - f.y) * 6.5);
  float hedge = 1.0 - smoothstep(0.12, 0.3, edge);
  col = mix(col, g7lin(vec3(0.27, 0.38, 0.19)), hedge * step(0.55, g7h(id + 7.0)) * 0.8);
  // Wälder: große Flecken, an steilen Hängen häufiger
  float fm = smoothstep(0.49, 0.55, nB.r + slope * 0.6 + (nC.g - 0.5) * 0.14);
  vec3 forestC = mix(g7lin(vec3(0.18, 0.3, 0.15)), g7lin(vec3(0.26, 0.36, 0.17)), nC.r);
  forestC = mix(forestC, g7lin(vec3(0.55, 0.36, 0.14)), autumn * 0.55 * step(0.45, nC.b));
  col = mix(col, forestC * (0.75 + 0.5 * nC.b), fm);
  // Dörfer: kleine Dächer
  float vil = step(0.985, g7h(floor(wp.xz / 46.0) + 3.1)) * (1.0 - fm);
  if (vil > 0.5) {
    vec2 lp = wp.xz / 2.2;
    vec2 lid = floor(lp), lf = fract(lp);
    float hr = g7h(lid + 1.7);
    float house = step(0.45, hr) * step(0.15, lf.x) * step(lf.x, 0.85) * step(0.2, lf.y) * step(lf.y, 0.8);
    vec3 roof = hr > 0.8 ? vec3(0.35, 0.36, 0.38) : vec3(0.66, 0.3, 0.22);
    col = mix(col, g7lin(roof) * (lf.x > 0.5 ? 0.75 : 1.0), house);
  }
  // Fels und Schnee in den Bergen
  float rockM = smoothstep(0.35, 0.6, slope + (nC.r - 0.5) * 0.3) * smoothstep(${(OUTER_Y + 12).toFixed(1)}, ${(OUTER_Y + 30).toFixed(1)}, wp.y);
  vec3 rockC = mix(g7lin(vec3(0.5, 0.48, 0.46)), g7lin(vec3(0.62, 0.6, 0.58)), nC.g);
  col = mix(col, rockC, max(rockM, smoothstep(${(OUTER_Y + 45).toFixed(1)}, ${(OUTER_Y + 70).toFixed(1)}, wp.y)));
  float snow = smoothstep(${(OUTER_Y + 70).toFixed(1)}, ${(OUTER_Y + 95).toFixed(1)}, wp.y + (nC.g - 0.5) * 20.0) * smoothstep(0.8, 0.45, slope);
  snow = max(snow, uSnowK * smoothstep(0.55, 0.85, wn.y));
  col = mix(col, g7lin(vec3(0.92, 0.94, 0.98)), snow);
  // Wasser
  g7Water = smoothstep(0.0, 0.05, vWet);
  vec3 waterC = mix(g7lin(vec3(0.2, 0.45, 0.52)), g7lin(vec3(0.1, 0.27, 0.4)), smoothstep(0.2, 4.0, vWet));
  col = mix(col, waterC, g7Water);
  col = mix(col, vec3(dot(col, vec3(0.3, 0.59, 0.11))), 0.22);
  diffuseColor.rgb = col;
  g7Hgt = (fm * nC.b * 0.9 + hedge * 0.3) * (1.0 - g7Water);
}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.95, 0.15, g7Water);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
normal = g7bump(-vViewPosition, normal, g7Hgt * 0.6, faceDirection);
if (g7Water > 0.5) {
  vec2 wv = vec2(texture2D(tNoise, vWP.xz * 0.05 + uTime * 0.004).g, texture2D(tNoise, vWP.xz * 0.05 - uTime * 0.005 + 0.5).r) - 0.5;
  normal = normalize((viewMatrix * vec4(normalize(vec3(wv.x * 0.25, 1.0, wv.y * 0.25)), 0.0)).xyz);
}`)
      .replace('#include <opaque_fragment>', `
{
  vec3 vdir = normalize(vViewPosition);
  vec3 nW = inverseTransformDirection(normal, viewMatrix);
  vec3 vW = inverseTransformDirection(vdir, viewMatrix);
  vec3 rW = reflect(-vW, nW);
  float fres = 0.04 + 0.6 * pow(1.0 - clamp(dot(nW, vW), 0.0, 1.0), 4.0);
  vec3 sky = mix(uHaze, uSkyTop, clamp(rW.y * 1.4, 0.0, 1.0));
  outgoingLight = mix(outgoingLight, sky, fres * g7Water);
}
#include <opaque_fragment>`)
      .replace('#include <fog_fragment>', `#include <fog_fragment>
{
  float dist = length(vViewPosition);
  float hz = 1.0 - exp(-dist / 230.0);
  hz = clamp(0.44 + 0.56 * hz, 0.0, 0.965) * uHazeK;
  float low = smoothstep(${(OUTER_Y + 60).toFixed(1)}, ${OUTER_Y.toFixed(1)}, vWP.y);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze, clamp(hz + low * 0.05, 0.0, 0.97));
}`);
  };
  mat.customProgramCacheKey = () => 'g7outer';
  return mat;
}

// ---------------------------------------------------------------------------------------------
// Euklidische Abstandstransformation (Felzenszwalb & Huttenlocher), in Gitterschritten.
function edt(seed, w, h) {
  const INF = 1e20;
  const n = Math.max(w, h);
  const f = new Float64Array(n), d = new Float64Array(n), z = new Float64Array(n + 1);
  const v = new Int32Array(n);
  const grid = new Float64Array(w * h);
  let any = false;
  for (let i = 0; i < w * h; i++) { grid[i] = seed[i] ? 0 : INF; if (seed[i]) any = true; }
  const out = new Float32Array(w * h);
  if (!any) { out.fill(1e4); return out; }
  const dt = (len) => {
    let k = 0;
    v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < len; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
  };
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    dt(h);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    dt(w);
    for (let x = 0; x < w; x++) out[y * w + x] = Math.sqrt(Math.min(grid[y * w + x] = d[x], 1e8));
  }
  return out;
}

// Separabler Kastenfilter (Radius r) und Maximumfilter auf dem Gitter.
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < w) { s += src[y * w + xx]; n++; } }
    tmp[y * w + x] = s / n;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < h) { s += tmp[yy * w + x]; n++; } }
    out[y * w + x] = s / n;
  }
  return out;
}
function maxFilter(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let m = 0;
    for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < w && src[y * w + xx] > m) m = src[y * w + xx]; }
    tmp[y * w + x] = m;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let m = 0;
    for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < h && tmp[yy * w + x] > m) m = tmp[yy * w + x]; }
    out[y * w + x] = m;
  }
  return out;
}

// Höhenfeld in S Teilschritten pro Feld. Land bleibt exakt auf Höhe 0 (Straßen und Gebäude stehen darauf),
// Fels wird zu Hügeln und Klippen, Wasser bekommt flache Ufer und tiefe Mitte.
function buildField(g) {
  const W = g.W, H = g.H, w = g.world;
  const S = W <= 64 ? 4 : W <= 96 ? 3 : 2;
  const GW = W * S + 1, GH = H * S + 1, GN = GW * GH;
  const ter = w.terrain;
  const rockAll = new Uint8Array(GN), waterAll = new Uint8Array(GN);
  const notRock = new Uint8Array(GN), notWater = new Uint8Array(GN);
  for (let gy = 0; gy < GH; gy++) {
    const y1 = Math.min(H - 1, Math.floor(gy / S)), y0 = gy % S === 0 ? Math.max(0, gy / S - 1) : y1;
    for (let gx = 0; gx < GW; gx++) {
      const x1 = Math.min(W - 1, Math.floor(gx / S)), x0 = gx % S === 0 ? Math.max(0, gx / S - 1) : x1;
      let aR = true, aW = true;
      for (const ty of [y0, y1]) for (const tx of [x0, x1]) {
        const t = ter[ty * W + tx];
        if (t !== T.ROCK) aR = false;
        if (t !== T.WATER) aW = false;
      }
      const k = gy * GW + gx;
      rockAll[k] = aR ? 1 : 0; notRock[k] = aR ? 0 : 1;
      waterAll[k] = aW ? 1 : 0; notWater[k] = aW ? 0 : 1;
    }
  }
  const dIn = edt(notRock, GW, GH);
  const dWin = edt(notWater, GW, GH);
  const dToW = edt(waterAll, GW, GH);
  const dToR = edt(rockAll, GW, GH);
  // Weiche Uferlinien: geglätteter Wasseranteil rundet Treppenstufen ab, die lokale Breite hält schmale Kanäle offen
  const wf = new Float32Array(GN);
  for (let k = 0; k < GN; k++) wf[k] = waterAll[k];
  const B = boxBlur(boxBlur(wf, GW, GH, S), GW, GH, S);
  const M = maxFilter(dWin, GW, GH, S + 1);
  const seed = w.seed | 0;
  const nA = makeNoise(seed + 7001), nB = makeNoise(seed + 7002), nC = makeNoise(seed + 7003);
  const nD = makeNoise(seed + 7004), nE = makeNoise(seed + 7005), nF = makeNoise(seed + 7006);
  const h = new Float32Array(GN);
  const WL = WATER_LEVEL;
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const k = gy * GW + gx;
    const tx = gx / S, ty = gy / S;
    if (rockAll[k]) {
      const d = dIn[k] / S;
      const inset = 0.1 + 0.55 * nA.fbm(tx * 0.45, ty * 0.45, 3);
      const dd = d - inset;
      if (dd > 0) {
        const ridge = 1 - Math.abs(2 * nB.fbm(tx * 0.15, ty * 0.15, 4) - 1);
        const big = nC.fbm(tx * 0.06, ty * 0.06, 3);
        let m = 1.4 * Math.pow(dd, 0.9) * (0.45 + 1.05 * ridge * (0.5 + 0.95 * big));
        const rug = 1 - Math.abs(2 * nE.fbm(tx * 0.42 + 7, ty * 0.42, 3) - 1);
        m += rug * rug * 0.9 * smoothstep(0.6, 3.5, dd);
        // Terrassen und Klippen in manchen Gegenden
        const cliff = smoothstep(0.48, 0.64, nD.fbm(tx * 0.11 + 30, ty * 0.11, 3));
        const step = 0.85;
        const qv = m / step, fl = Math.floor(qv);
        const terr = (fl + smoothstep(0.55, 0.92, qv - fl)) * step;
        m += (terr - m) * cliff * 0.85;
        m += (nE.fbm(tx * 0.9, ty * 0.9, 3) - 0.5) * 0.45 * Math.min(1, dd);
        m = 9.5 * (1 - Math.exp(-Math.max(0, m) / 9.5));
        h[k] = m * smoothstep(0, 0.75, dd);
      }
    } else if (waterAll[k]) {
      const d = dWin[k] / S;
      const nf = nF.fbm(tx * 0.55 + 11, ty * 0.55, 3), nf2 = nE.fbm(tx * 0.21 + 3, ty * 0.21, 2);
      let inset = 0.06 + 0.58 * clamp((nf - 0.3) / 0.4, 0, 1) * (0.45 + 0.8 * nf2) + Math.max(0, 0.66 - B[k]) * 1.35;
      inset = Math.min(inset, 0.58 * M[k] / S);
      const dd = d - inset;
      if (dd <= 0) h[k] = WL * Math.pow(clamp(d / inset, 0, 1), 1.25);
      else {
        const maxD = clamp(0.42 + d * 0.15, 0.42, 2.1);
        h[k] = WL - maxD * (1 - Math.exp(-dd / 0.55)) + (nE.fbm(tx * 0.7, ty * 0.7, 2) - 0.5) * 0.08 * Math.min(1, dd);
      }
    }
  }
  // Seegrund glätten (nur unter Wasserfeldern, Land bleibt exakt 0): weichere Uferlinien ohne Zacken
  for (let pass = 0; pass < 3; pass++) {
    const src = h.slice();
    for (let gy = 1; gy < GH - 1; gy++) for (let gx = 1; gx < GW - 1; gx++) {
      const k = gy * GW + gx;
      if (!waterAll[k]) continue;
      let sum = 0, n = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const j = k + oy * GW + ox;
        if (!waterAll[j]) continue;
        const wgt = ox === 0 && oy === 0 ? 2 : 1;
        sum += src[j] * wgt; n += wgt;
      }
      h[k] = sum / n;
    }
  }
  return { S, GW, GH, GN, h, dIn, dWin, dToW, dToR, rockAll, waterAll };
}

// ---------------------------------------------------------------------------------------------

export class TerrainView {
  constructor(engine) {
    this.e = engine;
    this.g = engine.game;
    this.group = new THREE.Group();
    this.group.name = 'Gelände';
    engine.scene.add(this.group);
    this.waterLevel = WATER_LEVEL;
    this.outerY = OUTER_Y;
    this.avenueTrees = true;
    const tex = natureTextures();
    const aniso = Math.min(8, engine.renderer.capabilities.getMaxAnisotropy());
    for (const k of ['grass', 'rock', 'sand']) tex[k].anisotropy = aniso;
    this.tex = tex;
    this.field = buildField(this.g);
    this.buildMaps();
    const fogCol = engine.scene.fog ? engine.scene.fog.color.clone() : new THREE.Color(0xe8f1ec);
    this.uniforms = {
      tNoise: { value: tex.noise }, tGrass: { value: tex.grass }, tRock: { value: tex.rock }, tSand: { value: tex.sand },
      tMapA: { value: this.texA }, tMapB: { value: this.texB }, uMapSize: { value: new THREE.Vector2(this.g.W, this.g.H) },
      uTime: shared.uTime, uSnowK: { value: 0 }, uWetK: { value: 0 }, uFlowers: { value: 0.7 }, uDry: { value: 0.25 },
      uLitter: { value: 0 }, uNightK: shared.uNight, uGrassTint: { value: new THREE.Vector3(1, 1, 1) }, uSeasonT: { value: 0.33 }, uWL: { value: WATER_LEVEL },
    };
    this.outerUniforms = { uHaze: { value: fogCol }, uSkyTop: { value: new THREE.Color(0x86c3ea) }, uHazeK: { value: 1 } };
    this.build();
    this.buildSlab();
    this.buildUnderside();
    this.buildOuter();
    this.water = new WaterView(this);
    this.veg = new Vegetation(this);
    this.bindGame();
    this.refreshTrees();
  }

  // ---------- Abfragen für andere Ansichten
  heightAt(wx, wz) {
    const F = this.field, S = F.S;
    const gx = clamp((wx + this.g.W / 2) * S, 0, F.GW - 1.001), gy = clamp((wz + this.g.H / 2) * S, 0, F.GH - 1.001);
    const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    const k = y0 * F.GW + x0;
    const a = F.h[k], b = F.h[k + 1], c = F.h[k + F.GW], d = F.h[k + F.GW + 1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  isWater(wx, wz) { return this.heightAt(wx, wz) < WATER_LEVEL - 0.01; }
  // Gitterwert eines Feldes (Höhe) über Gitterkoordinaten
  fieldH(gx, gy) {
    const F = this.field;
    return F.h[clamp(gy, 0, F.GH - 1) * F.GW + clamp(gx, 0, F.GW - 1)];
  }

  // ---------- Datentexturen: Feldtypen für den Shader (lineare Filterung = weiche Übergänge)
  buildMaps() {
    const g = this.g, W = g.W, H = g.H;
    this.mapA = new Uint8Array(W * H * 4);
    this.mapB = new Uint8Array(W * H * 4);
    const mk = (d) => {
      const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat);
      t.magFilter = t.minFilter = THREE.LinearFilter;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.generateMipmaps = false;
      return t;
    };
    this.texA = mk(this.mapA);
    this.texB = mk(this.mapB);
    this.updateMaps();
  }

  updateMaps() {
    const g = this.g, w = g.world, A = this.mapA, B = this.mapB;
    for (let i = 0; i < g.N; i++) {
      const t = w.terrain[i], r = w.resource[i], o = i * 4;
      A[o] = t === T.ROCK ? 255 : 0;
      A[o + 1] = t === T.SAND ? 255 : 0;
      A[o + 2] = Math.min(255, w.trees[i] * 85);
      A[o + 3] = (g.zone[i] || g.bld[i] || g.road[i]) ? 255 : 0;
      B[o] = r === RES.FERTILE ? 255 : 0;
      B[o + 1] = r === RES.ORE ? 255 : 0;
      B[o + 2] = g.rubble[i] ? 255 : 0;
      B[o + 3] = r === RES.OIL ? 255 : 0;
    }
    this.texA.needsUpdate = true;
    this.texB.needsUpdate = true;
    this.mapsDirty = false;
  }

  // ---------- Geländenetz
  build() {
    const g = this.g, F = this.field, S = F.S, GW = F.GW, GH = F.GH, GN = F.GN;
    const ox = -g.W / 2, oz = -g.H / 2;
    const pos = new Float32Array(GN * 3), nor = new Float32Array(GN * 3), ex = new Float32Array(GN * 2);
    const hh = F.h;
    const inv = 1 / S;
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const k = gy * GW + gx;
      pos[k * 3] = gx * inv + ox; pos[k * 3 + 1] = hh[k]; pos[k * 3 + 2] = gy * inv + oz;
      const hl = this.fieldH(gx - 1, gy), hr = this.fieldH(gx + 1, gy), hu = this.fieldH(gx, gy - 1), hd = this.fieldH(gx, gy + 1);
      let nx = -(hr - hl) * S * 0.5, nz = -(hd - hu) * S * 0.5;
      const l = Math.hypot(nx, 1, nz);
      nor[k * 3] = nx / l; nor[k * 3 + 1] = 1 / l; nor[k * 3 + 2] = nz / l;
      ex[k * 2] = 1;
      ex[k * 2 + 1] = F.waterAll[k] ? 0 : Math.min(4, F.dToW[k] / S);
    }
    // Umgebungsverdeckung aus dem Höhenfeld (Horizont in 8 Richtungen), nur wo es Relief gibt
    const dirs = [];
    for (let a = 0; a < 8; a++) dirs.push([Math.cos(a * Math.PI / 4), Math.sin(a * Math.PI / 4)]);
    const steps = [0.35, 0.8, 1.5, 2.6, 4.2];
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const k = gy * GW + gx;
      if (F.dToR[k] > S * 5 && F.dWin[k] === 0 && F.dToW[k] > S * 1.5) continue;
      const h0 = hh[k];
      let occ = 0;
      for (const [dx, dy] of dirs) {
        let mx = 0;
        for (const s of steps) {
          const hs = this.fieldH(Math.round(gx + dx * s * S), Math.round(gy + dy * s * S));
          const sl = (hs - h0) / s;
          if (sl > mx) mx = sl;
        }
        occ += Math.atan(mx) / (Math.PI / 2);
      }
      ex[k * 2] = 1 - Math.min(0.55, (occ / 8) * 1.1);
    }
    // Anpassungsfähiges Netz: ebene Felder ohne Relief in der Nähe brauchen nur zwei Dreiecke
    // (ihre Ränder liegen exakt auf Höhe 0, daher keine Risse zu fein unterteilten Nachbarn).
    const idx = [];
    for (let ty = 0; ty < g.H; ty++) for (let tx = 0; tx < g.W; tx++) {
      let flat = true, aoMin = 1, aoMax = 0;
      for (let sy = 0; sy <= S && flat; sy++) for (let sx = 0; sx <= S; sx++) {
        const k = (ty * S + sy) * GW + tx * S + sx;
        if (hh[k] !== 0) { flat = false; break; }
        aoMin = Math.min(aoMin, ex[k * 2]); aoMax = Math.max(aoMax, ex[k * 2]);
      }
      if (aoMax - aoMin > 0.035) flat = false;
      if (flat) {
        const a = ty * S * GW + tx * S, b = a + S, c = a + S * GW, d = c + S;
        if (((tx + ty) & 1) === 0) idx.push(a, c, d, a, d, b); else idx.push(a, c, b, b, c, d);
        continue;
      }
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const gx = tx * S + sx, gy = ty * S + sy;
        const a = gy * GW + gx, b = a + 1, c = a + GW, d = c + 1;
        // kürzere Diagonale (kleinerer Höhenunterschied) → Uferlinien ohne Sägezahn
        const dAD = Math.abs(hh[a] - hh[d]), dBC = Math.abs(hh[b] - hh[c]);
        const useAD = Math.abs(dAD - dBC) < 1e-4 ? ((gx + gy) & 1) === 0 : dAD < dBC;
        if (useAD) idx.push(a, c, d, a, d, b); else idx.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('aEx', new THREE.BufferAttribute(ex, 2));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
    geo.computeBoundingSphere();
    this.mat = makeTerrainMaterial(this);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
    this.mesh.name = 'Gelände-Netz';
    this.group.add(this.mesh);
  }

  // Seitenwände der Erdscholle (Erdschichten) – Wasserschnitte macht water.js.
  buildSlab() {
    const g = this.g, F = this.field, S = F.S, GW = F.GW, GH = F.GH;
    const ox = -g.W / 2, oz = -g.H / 2;
    const pos = [], nor = [], top = [];
    const quad = (ax, az, ha, bx, bz, hb, nx, nz) => {
      const ta = Math.max(ha, -5), tb = Math.max(hb, -5);
      const v = [[ax, ta, az], [bx, tb, bz], [bx, BOTTOM, bz], [ax, BOTTOM, az]];
      const ord = (nz < 0 || nx > 0) ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
      for (const k of ord) {
        pos.push(v[k][0], v[k][1], v[k][2]);
        nor.push(nx, 0, nz);
        top.push(k === 0 || k === 3 ? ha : hb);
      }
    };
    const inv = 1 / S;
    for (let gx = 0; gx < GW - 1; gx++) {
      quad(gx * inv + ox, oz, F.h[gx], (gx + 1) * inv + ox, oz, F.h[gx + 1], 0, -1);
      const r = (GH - 1) * GW;
      quad(gx * inv + ox, -oz, F.h[r + gx], (gx + 1) * inv + ox, -oz, F.h[r + gx + 1], 0, 1);
    }
    for (let gy = 0; gy < GH - 1; gy++) {
      quad(ox, gy * inv + oz, F.h[gy * GW], ox, (gy + 1) * inv + oz, F.h[(gy + 1) * GW], -1, 0);
      quad(-ox, gy * inv + oz, F.h[gy * GW + GW - 1], -ox, (gy + 1) * inv + oz, F.h[(gy + 1) * GW + GW - 1], 1, 0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1));
    this.slabMat = makeSlabMaterial(this);
    const slab = new THREE.Mesh(geo, this.slabMat);
    slab.receiveShadow = true;
    slab.name = 'Erdscholle-Rand';
    this.group.add(slab);
    this.slab = slab;
  }

  // Zerklüftete Unterseite der schwebenden Erdscholle (läuft nach unten spitz zu).
  buildUnderside() {
    const g = this.g, W = g.W, H = g.H;
    const N = 40;
    const nz = makeNoise((g.world.seed | 0) + 8101);
    const D = Math.min(W, H) * 0.075;
    const pos = new Float32Array((N + 1) * (N + 1) * 3), top = new Float32Array((N + 1) * (N + 1));
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const u = i / N * 2 - 1, v = j / N * 2 - 1;
      const e = Math.max(Math.abs(u), Math.abs(v));
      const r = Math.pow(Math.pow(Math.abs(u), 4) + Math.pow(Math.abs(v), 4), 0.25);
      const k = (j * (N + 1) + i);
      const n1 = nz.fbm(u * 2.2 + 5, v * 2.2, 4), n2 = nz.fbm(u * 7 + 9, v * 7, 3);
      const depth = e >= 0.999 ? 0 : D * Math.pow(1 - Math.min(1, r * 0.92 + e * 0.08), 0.7) * (0.55 + 0.9 * n1) + D * 0.25 * (n2 - 0.5) * (1 - e);
      pos[k * 3] = u * W / 2; pos[k * 3 + 1] = BOTTOM - Math.max(0, depth); pos[k * 3 + 2] = v * H / 2;
      top[k] = 0;
    }
    const idx = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aTop', new THREE.BufferAttribute(top, 1));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, this.slabMat);
    m.name = 'Erdscholle-Unterseite';
    this.group.add(m);
    this.under = m;
  }

  // Umland: weite Landschaft unterhalb der Scholle, je nach Kartentyp mit Meer, Seen oder Bergen.
  buildOuter() {
    const g = this.g, W = g.W, H = g.H, type = g.world.type, seed = g.world.seed | 0;
    const n1 = makeNoise(seed + 9101), n2 = makeNoise(seed + 9102), n3 = makeNoise(seed + 9103), n4 = makeNoise(seed + 9104);
    const half = Math.max(W, H) / 2;
    // Flussläufe, die die Karte verlassen, setzen sich im Umland fort.
    const exits = this.edgeRivers();
    const rivers = exits.map((e, k) => {
      const pts = [];
      let x = e.x, z = e.z, a = Math.atan2(e.dz, e.dx);
      const rr = mulberry32(seed + 77 + k);
      for (let s = 0; s < 120; s++) {
        pts.push([x, z]);
        a += (rr() - 0.5) * 0.5;
        const target = Math.atan2(e.dz, e.dx);
        a += (target - a) * 0.15;
        x += Math.cos(a) * 7; z += Math.sin(a) * 7;
      }
      return { pts, w: e.w };
    });
    const seaSide = (x, z) => {
      if (type === 'coast') return smoothstep(-6, 6, x - (W * 0.2 + (n3.fbm(z * 0.006, 1.3, 3) - 0.5) * W * 1.4));
      if (type === 'islands') return 1 - smoothstep(0.6, 0.66, n3.fbm(x * 0.005 + 3, z * 0.005, 4) + smoothstep(half * 6, half * 2, Math.hypot(x, z)) * -0.2);
      return 0;
    };
    const height = (x, z) => {
      const r = Math.hypot(x, z);
      const out = Math.max(Math.abs(x), Math.abs(z)) - half;
      let hgt = (n1.fbm(x * 0.012, z * 0.012, 4) - 0.42) * (5 + 26 * smoothstep(half * 1.2, half * 6, r));
      const ridge = 1 - Math.abs(2 * n2.fbm(x * 0.0042, z * 0.0042, 4) - 1);
      const far = type === 'mountains' ? smoothstep(half * 2.5, half * 7, r) * 1.15 : smoothstep(half * 4, half * 9, r);
      hgt += Math.pow(ridge, 2.2) * 150 * far;
      if (type === 'mountains') hgt += Math.pow(ridge, 1.6) * 34 * smoothstep(half * 1.15, half * 2.4, r);
      hgt = Math.max(hgt, 1.2 - smoothstep(half * 1.5, half * 3, r) * 0.6);
      if (out < 4) hgt = Math.max(hgt, 0.6);
      let wet = 0;
      const sea = seaSide(x, z);
      if (sea > 0) { hgt = hgt * (1 - sea) - 6 * sea; }
      if (type === 'lakes' && n4.fbm(x * 0.016, z * 0.016, 3) < 0.33 && out > 6) hgt = Math.min(hgt, -3);
      for (const rv of rivers) {
        let best = 1e9;
        for (const [px, pz] of rv.pts) { const d = (px - x) * (px - x) + (pz - z) * (pz - z); if (d < best) best = d; }
        const d = Math.sqrt(best);
        const rw = rv.w * 0.5 * (1 + smoothstep(0, 200, r - half) * 1.5) + 0.8;
        if (d < rw + 5) {
          const t = smoothstep(rw * 0.5, rw + 5, d);
          hgt = Math.min(hgt, -1.6 * (1 - t) + Math.max(hgt, 0.4) * t);
        }
      }
      if (hgt < 0) { wet = -hgt; hgt = 0; }
      return [hgt, wet];
    };
    // Polares Gitter (fein in der Nähe, grob am Horizont)
    const segs = 220;
    const radii = [];
    let r = half * 0.55;
    while (r < 1150) { radii.push(r); r = r * 1.034 + 0.9; }
    const nR = radii.length;
    const pos = new Float32Array((nR * segs + 1) * 3), wetA = new Float32Array(nR * segs + 1);
    pos[0] = 0; pos[1] = OUTER_Y; pos[2] = 0; wetA[0] = 0;
    for (let ri = 0; ri < nR; ri++) for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      const x = Math.cos(a) * radii[ri], z = Math.sin(a) * radii[ri];
      const [hgt, wet] = height(x, z);
      const k = 1 + ri * segs + s;
      pos[k * 3] = x; pos[k * 3 + 1] = OUTER_Y + hgt; pos[k * 3 + 2] = z;
      wetA[k] = wet;
    }
    const idx = [];
    for (let s = 0; s < segs; s++) idx.push(0, 1 + (s + 1) % segs, 1 + s);
    for (let ri = 0; ri < nR - 1; ri++) for (let s = 0; s < segs; s++) {
      const a = 1 + ri * segs + s, b = 1 + ri * segs + (s + 1) % segs, c = a + segs, d = b + segs;
      idx.push(a, b, d, a, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aWet', new THREE.BufferAttribute(wetA, 1));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, makeOuterMaterial(this));
    m.name = 'Umland';
    m.renderOrder = -2;
    this.group.add(m);
    this.outer = m;
    this.outerRivers = rivers;
  }

  // Schmale Wasserläufe an den Kartenrändern (für Wasserfälle und das Umland).
  edgeRivers() {
    const g = this.g, W = g.W, H = g.H, ter = g.world.terrain;
    const res = [];
    const scan = (len, at, mk) => {
      let start = -1;
      for (let k = 0; k <= len; k++) {
        const wtr = k < len && ter[at(k)] === T.WATER;
        if (wtr && start < 0) start = k;
        if (!wtr && start >= 0) {
          const n = k - start;
          if (n <= 9) res.push(mk((start + k) / 2, n));
          start = -1;
        }
      }
    };
    scan(W, (k) => k, (c, n) => ({ x: c - W / 2, z: -H / 2, dx: 0, dz: -1, w: n, edge: 'n', c, n }));
    scan(W, (k) => (H - 1) * W + k, (c, n) => ({ x: c - W / 2, z: H / 2, dx: 0, dz: 1, w: n, edge: 's', c, n }));
    scan(H, (k) => k * W, (c, n) => ({ x: -W / 2, z: c - H / 2, dx: -1, dz: 0, w: n, edge: 'w', c, n }));
    scan(H, (k) => k * W + W - 1, (c, n) => ({ x: W / 2, z: c - H / 2, dx: 1, dz: 0, w: n, edge: 'e', c, n }));
    return res;
  }

  // ---------- Ereignisse der Simulation
  bindGame() {
    const g = this.g;
    const maps = () => { this.mapsDirty = true; };
    const decor = (b) => {
      maps();
      if (b && this.veg && this.veg.blocksFootprint(b)) this.markTrees();
    };
    this.unbind = [
      g.on('zonesChanged', () => { maps(); this.markTrees(); }),
      g.on('buildingAdded', decor),
      g.on('buildingRemoved', maps),
      g.on('roadsChanged', maps),
      g.on('rubbleChanged', maps),
      g.on('treesChanged', maps),
    ];
  }
  markTrees() { if (this.e.dirty) this.e.dirty.trees = true; }

  // ---------- Öffentliche Schnittstelle
  refreshColors() { this.updateMaps(); }

  refreshTrees() {
    if (this.veg) this.veg.refresh();
    this.mapsDirty = true;
  }

  // ---------- Pro Bild (über die registrierte Ansicht)
  seasonState() {
    const w = (this.g.ext && this.g.ext.weather) || {};
    let t = typeof w.yearT === 'number' ? w.yearT : null;
    if (t === null && w.season) t = { spring: 0.12, summer: 0.36, autumn: 0.64, winter: 0.88 }[w.season] ?? null;
    if (t === null) t = shared.uSeason.value;
    t = ((t % 1) + 1) % 1;
    const own = typeof w.yearT === 'number' || !!w.season;
    const autumnOwn = smoothstep(0.5, 0.62, t) * (1 - smoothstep(0.8, 0.88, t));
    return {
      t,
      autumn: Math.max(shared.uAutumn.value, own ? autumnOwn : 0),
      snow: Math.max(shared.uSnow.value, +w.snowCover || 0),
      wet: Math.max(shared.uWet.value, (+w.rain || 0) * 0.8),
      wind: typeof w.wind === 'number' ? w.wind : 0.25,
      windDir: typeof w.windDir === 'number' ? w.windDir : 0.7,
      temp: typeof w.temp === 'number' ? w.temp : null,
      storm: !!w.storm,
    };
  }

  frame(dt, time, night) {
    const s = this.seasonState();
    this.season = s;
    const u = this.uniforms;
    // Jahreszeitliche Wiesenfarbe (Schlüsselbilder über das Jahr)
    const K = [
      [0.0, 0.92, 0.95, 0.8, 0.3, 0.35, 0.2],
      [0.1, 1.0, 1.06, 0.8, 1.0, 0.0, 0.0],
      [0.25, 1.0, 1.02, 0.95, 0.85, 0.1, 0.0],
      [0.4, 1.02, 1.0, 0.93, 0.5, 0.45, 0.0],
      [0.55, 1.05, 0.97, 0.84, 0.2, 0.55, 0.3],
      [0.7, 1.06, 0.92, 0.74, 0.05, 0.7, 1.0],
      [0.85, 0.9, 0.86, 0.74, 0.0, 0.8, 0.6],
      [1.0, 0.92, 0.95, 0.8, 0.3, 0.35, 0.2],
    ];
    let a = K[0], b = K[1];
    for (let k = 0; k < K.length - 1; k++) if (s.t >= K[k][0] && s.t <= K[k + 1][0]) { a = K[k]; b = K[k + 1]; break; }
    const f = (s.t - a[0]) / Math.max(1e-6, b[0] - a[0]);
    const L = (i) => a[i] + (b[i] - a[i]) * f;
    u.uGrassTint.value.set(L(1), L(2), L(3));
    u.uFlowers.value = L(4) * (1 - s.snow);
    u.uDry.value = L(5);
    u.uLitter.value = Math.max(L(6), s.autumn * 0.8);
    u.uSnowK.value = s.snow;
    u.uWetK.value = s.wet;
    u.uSeasonT.value = s.t;
    // Dunst des Umlands folgt dem Nebel/Himmel der Engine
    const e = this.e;
    if (e.scene.fog) this.outerUniforms.uHaze.value.copy(e.scene.fog.color);
    else if (e.skyHor) this.outerUniforms.uHaze.value.copy(e.skyHor);
    if (e.skyTop) this.outerUniforms.uSkyTop.value.copy(e.skyTop);
    if (this.mapsDirty) this.updateMaps();
    if (this.water) this.water.frame(dt, time, night, s);
    if (this.veg) this.veg.frame(dt, time, night, s);
  }

  dispose() {
    if (this.unbind) for (const u of this.unbind) u();
    this.unbind = null;
  }
}

// Ansicht, damit Gelände, Wasser und Pflanzen pro Bild aktualisiert werden (scene.js ruft nur refresh* auf).
registerView(class NaturView {
  constructor(engine) { this.e = engine; }
  frame(dt, simDt, time, night) { const t = this.e.terrain; if (t && t.frame) t.frame(dt, time, night); }
  dispose() { const t = this.e.terrain; if (t && t.dispose) t.dispose(); }
});
