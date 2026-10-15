// Vegetation (Besitzer G7): Laubbäume, Fichten, Kiefern, Birken, Pappeln, Obstbäume, Büsche, Felsen, Schilf
// und Grasbüschel in Kameranähe – alles instanziert, mit zwei Detailstufen (nah/fern), Wind-Wiegen im Shader,
// Jahreszeiten (Frühlingsgrün, Obstblüte, Herbstfärbung, kahle Kronen im Winter) und Schnee.
// Ein gemeinsames Material für alle Arten; Draw Calls = Arten × Detailstufen (leere werden übersprungen).
import * as THREE from 'three';
import { T, R, RES } from '../config.js';
import { hash2, makeNoise, mulberry32, clamp, smoothstep } from '../util.js';
import { shared } from './materials.js';
import { tileNoiseFn } from './terrain.js';

const GLSL = /* glsl */`
vec3 g7lin(vec3 c) { return pow(c, vec3(2.2)); }
vec3 g7bump(vec3 surfPos, vec3 n, float hgt, float fd) {
  vec2 dH = vec2(dFdx(hgt), dFdy(hgt));
  vec3 sx = normalize(dFdx(surfPos)), sy = normalize(dFdy(surfPos));
  vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1) * fd;
  vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
  return normalize(abs(det) * n - grad);
}
`;

// Arten des Laubs im Shader (aKind): 0 Holz, 1 Laub, 2 Nadeln, 3 Fels, 4 Obstbaum-Laub, 5 Birken-Laub, 6 Halme, 7 Busch, 8 Birkenrinde
const K = { WOOD: 0, LEAF: 1, NEEDLE: 2, ROCK: 3, FRUIT: 4, BIRCH: 5, BLADE: 6, BUSH: 7, BIRCHBARK: 8 };

// ---------------------------------------------------------------------------------------------
// Blatt-Textur (Blattbüschel, Mittelwert 0.5, Alpha = Höhe)
let LEAF = null;
function leafTexture() {
  if (LEAF) return LEAF;
  const S = 256, N = S * S;
  const tn = tileNoiseFn(2024);
  const col = new Float32Array(N), hgt = new Float32Array(N);
  for (let i = 0; i < N; i++) { const x = i % S, y = (i / S) | 0; col[i] = 0.55 + 0.25 * tn.fbm(x / S, y / S, 8, 3); hgt[i] = 0.2; }
  const r = mulberry32(31);
  for (let k = 0; k < 2600; k++) {
    const cx = r() * S, cy = r() * S, a = r() * Math.PI, len = 4 + r() * 6, wid = len * (0.35 + r() * 0.2);
    const l = 0.75 + r() * 0.6;
    const ca = Math.cos(a), sa = Math.sin(a);
    const rr = Math.ceil(len);
    for (let oy = -rr; oy <= rr; oy++) for (let ox = -rr; ox <= rr; ox++) {
      const u = (ox * ca + oy * sa) / len, v = (-ox * sa + oy * ca) / wid;
      const d = u * u + v * v;
      if (d > 1) continue;
      const px = (((cx + ox) | 0) % S + S) % S, py = (((cy + oy) | 0) % S + S) % S;
      const i = py * S + px;
      const hh = 0.4 + 0.6 * (1 - d) * (0.6 + 0.4 * r());
      if (hh > hgt[i]) { hgt[i] = hh; col[i] = l * (0.75 + 0.35 * (1 - d) + u * 0.1); }
    }
  }
  let m = 0;
  for (let i = 0; i < N; i++) m += col[i];
  m = 0.5 / (m / N);
  const d = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    const c = clamp(col[i] * m, 0, 1) * 255;
    d[i * 4] = c * 0.98; d[i * 4 + 1] = c; d[i * 4 + 2] = c * 0.94; d[i * 4 + 3] = clamp(hgt[i], 0, 1) * 255;
  }
  const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  LEAF = t;
  return t;
}

// ---------------------------------------------------------------------------------------------
// Geometrie-Baukasten (nicht indiziert, eigene Attribute)
class GB {
  constructor() { this.p = []; this.n = []; this.c = []; this.k = []; this.h = []; }
  v(x, y, z, nx, ny, nz, col, kind, hh) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(col[0], col[1], col[2]); this.k.push(kind); this.h.push(hh);
  }
  // Klumpen aus einem verbeulten Ikosaeder; Normalen weich um den Kronenmittelpunkt
  blob(cx, cy, cz, rx, ry, rz, detail, seed, kind, center, H, opts = {}) {
    const geo = new THREE.IcosahedronGeometry(1, detail);
    const a = geo.attributes.position.array;
    const jit = opts.jitter ?? 0.32;
    const pos = [];
    for (let i = 0; i < a.length; i += 3) {
      const ux = a[i], uy = a[i + 1], uz = a[i + 2];
      const j = 1 + (hash2(Math.round(ux * 1000) + 3 * seed, Math.round(uy * 1000) * 7 + Math.round(uz * 1000), seed + 11) - 0.5) * jit;
      let y = cy + uy * ry * j;
      if (opts.flatBottom !== undefined) y = Math.max(y, opts.flatBottom);
      pos.push(cx + ux * rx * j, y, cz + uz * rz * j, ux, uy, uz);
    }
    const flat = !!opts.flat;
    // jeder Klumpen etwas anders getönt (Blattbüschel)
    const tintF = 0.84 + hash2(seed, 5, 17) * 0.3, tintH = (hash2(seed, 9, 23) - 0.5) * 0.14;
    for (let i = 0; i < pos.length; i += 18) {
      let fn = null;
      if (flat) {
        const ax = pos[i], ay = pos[i + 1], az = pos[i + 2];
        const e1 = [pos[i + 6] - ax, pos[i + 7] - ay, pos[i + 8] - az], e2 = [pos[i + 12] - ax, pos[i + 13] - ay, pos[i + 14] - az];
        fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        const l = Math.hypot(fn[0], fn[1], fn[2]) || 1;
        fn = fn.map((q) => q / l);
      }
      for (let t = 0; t < 3; t++) {
        const o = i + t * 6;
        const x = pos[o], y = pos[o + 1], z = pos[o + 2];
        let nx, ny, nz;
        if (fn) { nx = fn[0]; ny = fn[1]; nz = fn[2]; }
        else {
          let sx = x - center[0], sy = (y - center[1]) * 1.2, sz = z - center[2];
          const sl = Math.hypot(sx, sy, sz) || 1;
          nx = sx / sl * 0.8 + pos[o + 3] * 0.2; ny = sy / sl * 0.8 + pos[o + 4] * 0.2; nz = sz / sl * 0.8 + pos[o + 5] * 0.2;
          const nl = Math.hypot(nx, ny, nz) || 1;
          nx /= nl; ny /= nl; nz /= nl;
        }
        // Verdeckung: unten und innen dunkler
        const out = flat ? 1 : clamp((Math.hypot(x - center[0], z - center[2]) / Math.max(0.05, opts.crownR || rx)) * 0.6 + 0.4, 0, 1);
        const up = clamp((y - (center[1] - (opts.crownH || ry))) / (2 * (opts.crownH || ry)), 0, 1);
        const ao = opts.col ? 1 : 0.5 + 0.5 * (0.35 * out + 0.65 * up);
        const c = opts.col || [ao * tintF * (1 + tintH), ao * tintF, ao * tintF * (1 - tintH * 1.5)];
        this.v(x, y, z, nx, ny, nz, c, kind, clamp(y / H, 0, 1));
      }
    }
    geo.dispose();
  }
  // Kegelstumpf zwischen zwei Punkten (Stamm, Äste), ohne Deckel
  cyl(x0, y0, z0, x1, y1, z1, r0, r1, sides, col, kind, H) {
    const ax = x1 - x0, ay = y1 - y0, az = z1 - z0;
    const al = Math.hypot(ax, ay, az) || 1;
    const d = [ax / al, ay / al, az / al];
    let ux = [0, 0, 0];
    const ref = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    ux = [d[1] * ref[2] - d[2] * ref[1], d[2] * ref[0] - d[0] * ref[2], d[0] * ref[1] - d[1] * ref[0]];
    const ul = Math.hypot(ux[0], ux[1], ux[2]);
    ux = ux.map((q) => q / ul);
    const vx = [d[1] * ux[2] - d[2] * ux[1], d[2] * ux[0] - d[0] * ux[2], d[0] * ux[1] - d[1] * ux[0]];
    const ring = (cx, cy, cz, r, a) => {
      const ca = Math.cos(a), sa = Math.sin(a);
      const nx = ux[0] * ca + vx[0] * sa, ny = ux[1] * ca + vx[1] * sa, nz = ux[2] * ca + vx[2] * sa;
      return [cx + nx * r, cy + ny * r, cz + nz * r, nx, ny, nz];
    };
    for (let s = 0; s < sides; s++) {
      const a0 = (s / sides) * Math.PI * 2, a1 = ((s + 1) / sides) * Math.PI * 2;
      const p00 = ring(x0, y0, z0, r0, a0), p01 = ring(x0, y0, z0, r0, a1), p10 = ring(x1, y1, z1, r1, a0), p11 = ring(x1, y1, z1, r1, a1);
      for (const q of [p00, p11, p10, p00, p01, p11]) this.v(q[0], q[1], q[2], q[3], q[4], q[5], col, kind, clamp(q[1] / H, 0, 1));
    }
  }
  // Gezackter Nadelbaum-Kegel mit Unterseite
  cone(y0, y1, r, sides, seed, col, kind, H, lean = 0) {
    const pts = [];
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2 + seed * 0.7;
      const rr = r * (s % 2 === 0 ? 1 : 0.7) * (0.9 + hash2(s, seed, 5) * 0.2);
      const yy = y0 + (s % 2 === 0 ? -0.025 : 0.035);
      pts.push([Math.cos(a) * rr, yy, Math.sin(a) * rr]);
    }
    const apex = [lean, y1, 0];
    const mid = [0, y0 + (y1 - y0) * 0.3, 0];
    const under = [0, y0 + 0.06, 0];
    for (let s = 0; s < sides; s++) {
      const a = pts[s], b = pts[(s + 1) % sides];
      for (const q of [a, apex, b]) {
        let nx = q[0] - mid[0], ny = (q[1] - mid[1]) * 0.6 + 0.25, nz = q[2] - mid[2];
        if (q === apex) { nx = (a[0] + b[0]) * 0.5; ny = r * 0.9; nz = (a[2] + b[2]) * 0.5; }
        const l = Math.hypot(nx, ny, nz) || 1;
        const ao = q === apex ? 1 : 0.62 + 0.25 * ((q[1] - y0) / (y1 - y0) + 0.3);
        this.v(q[0], q[1], q[2], nx / l, ny / l, nz / l, [col[0] * ao, col[1] * ao, col[2] * ao], kind, clamp(q[1] / H, 0, 1));
      }
      for (const q of [a, b, under]) this.v(q[0], q[1], q[2], 0, -1, 0, [col[0] * 0.45, col[1] * 0.45, col[2] * 0.45], kind, clamp(q[1] / H, 0, 1));
    }
  }
  // dünne Halme (Schilf, Gras): je ein spitzes Dreieck
  blades(n, hMin, hMax, spread, seed, colBase, colTip, kind, H, width = 0.012) {
    const r = mulberry32(seed);
    for (let b = 0; b < n; b++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * spread;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const h = hMin + r() * (hMax - hMin);
      const la = r() * Math.PI * 2, lean = h * (0.15 + r() * 0.3);
      const tx = x + Math.cos(la) * lean, tz = z + Math.sin(la) * lean;
      const wa = la + Math.PI / 2;
      const wx = Math.cos(wa) * width, wz = Math.sin(wa) * width;
      const nx = Math.cos(la), nz = Math.sin(la);
      this.v(x - wx, 0, z - wz, nx, 0.4, nz, colBase, kind, 0);
      this.v(x + wx, 0, z + wz, nx, 0.4, nz, colBase, kind, 0);
      this.v(tx, h, tz, nx, 0.6, nz, colTip, kind, clamp(h / H, 0, 1));
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aKind', new THREE.Float32BufferAttribute(this.k, 1));
    g.setAttribute('aH', new THREE.Float32BufferAttribute(this.h, 1));
    g.computeBoundingSphere();
    return g;
  }
}

const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const BARK = lin(0x5a4636), BARK_DARK = lin(0x463628), BARK_PINE = lin(0x7a4e35), BARK_FRUIT = lin(0x5e4a3a);

// Arten: Geometrie nah (hi) und fern (lo), Farbpalette der Krone, Schatten
const SPECIES = {
  laub: {
    decid: true,
    pal: [0x5f8f3e, 0x6b9a44, 0x557f38, 0x76a24a, 0x4f7a35, 0x688f3a],
    hi() {
      const b = new GB(), H = 1.1, C = [0, 0.72, 0];
      b.cyl(0, 0, 0, 0.02, 0.5, 0.01, 0.052, 0.032, 6, BARK, K.WOOD, H);
      for (let k = 0; k < 3; k++) {
        const a = k * 2.1 + 0.4;
        b.cyl(0.015, 0.36 + k * 0.04, 0.0, Math.cos(a) * 0.22, 0.66 + k * 0.03, Math.sin(a) * 0.22, 0.026, 0.01, 4, BARK, K.WOOD, H);
      }
      const o = { crownR: 0.4, crownH: 0.34 };
      b.blob(C[0], C[1], C[2], 0.3, 0.26, 0.3, 0, 1, K.LEAF, C, H, o);
      for (let k = 0; k < 5; k++) {
        const a = k * 1.2566 + 0.3;
        b.blob(Math.cos(a) * 0.21, 0.64 + (k % 2) * 0.12, Math.sin(a) * 0.21, 0.19 + (k % 3) * 0.02, 0.17, 0.19, 0, 10 + k, K.LEAF, C, H, o);
      }
      b.blob(0.03, 0.93, -0.02, 0.17, 0.14, 0.17, 0, 20, K.LEAF, C, H, o);
      return b.geometry();
    },
    lo() {
      const b = new GB(), H = 1.1, C = [0, 0.72, 0];
      b.cyl(0, 0, 0, 0, 0.5, 0, 0.05, 0.03, 3, BARK, K.WOOD, H);
      b.blob(C[0], C[1], C[2], 0.38, 0.33, 0.38, 0, 3, K.LEAF, C, H, { crownR: 0.4, crownH: 0.33, jitter: 0.2 });
      return b.geometry();
    },
  },
  fichte: {
    pal: [0x2f5a35, 0x34623a, 0x2a5232, 0x3b6a3f, 0x2d5638],
    hi() {
      const b = new GB(), H = 1.3, G = [1, 1, 1];
      b.cyl(0, 0, 0, 0, 1.15, 0, 0.042, 0.012, 5, BARK_DARK, K.WOOD, H);
      const tiers = 5;
      for (let t = 0; t < tiers; t++) {
        const y0 = 0.14 + t * 0.21, y1 = y0 + 0.42 - t * 0.03, r = 0.31 - t * 0.055;
        b.cone(y0, y1, r, 10, t * 3 + 1, G, K.NEEDLE, H);
      }
      return b.geometry();
    },
    lo() {
      const b = new GB(), H = 1.3;
      b.cyl(0, 0, 0, 0, 0.3, 0, 0.04, 0.03, 3, BARK_DARK, K.WOOD, H);
      b.cone(0.12, 1.3, 0.31, 6, 2, [1, 1, 1], K.NEEDLE, H);
      return b.geometry();
    },
  },
  kiefer: {
    pal: [0x3e6537, 0x46703c, 0x365c33, 0x4a6e3a],
    hi() {
      const b = new GB(), H = 1.3, C = [0.03, 1.08, 0];
      b.cyl(0, 0, 0, 0.04, 0.6, 0.01, 0.045, 0.032, 5, BARK_DARK, K.WOOD, H);
      b.cyl(0.04, 0.6, 0.01, 0.02, 1.05, 0.03, 0.032, 0.02, 5, BARK_PINE, K.WOOD, H);
      b.cyl(0.03, 0.85, 0.02, 0.2, 1.0, -0.06, 0.018, 0.008, 4, BARK_PINE, K.WOOD, H);
      const o = { crownR: 0.32, crownH: 0.16 };
      b.blob(0.02, 1.1, 0.02, 0.24, 0.11, 0.22, 0, 31, K.NEEDLE, C, H, o);
      b.blob(0.18, 1.02, -0.07, 0.15, 0.08, 0.14, 0, 32, K.NEEDLE, C, H, o);
      b.blob(-0.12, 1.04, 0.1, 0.15, 0.09, 0.15, 0, 33, K.NEEDLE, C, H, o);
      b.blob(0.0, 1.2, -0.02, 0.14, 0.07, 0.13, 0, 34, K.NEEDLE, C, H, o);
      return b.geometry();
    },
    lo() {
      const b = new GB(), H = 1.3, C = [0.02, 1.08, 0];
      b.cyl(0, 0, 0, 0.02, 1.05, 0.02, 0.04, 0.025, 3, BARK_PINE, K.WOOD, H);
      b.blob(C[0], C[1], C[2], 0.28, 0.13, 0.27, 0, 35, K.NEEDLE, C, H, { crownR: 0.3, crownH: 0.14, jitter: 0.2 });
      return b.geometry();
    },
  },
  birke: {
    decid: true,
    pal: [0x86ad4f, 0x7ea64a, 0x92b55a, 0x7b9f45],
    hi() {
      const b = new GB(), H = 1.05, C = [0.02, 0.74, 0];
      b.cyl(0, 0, 0, 0.012, 0.5, 0.0, 0.03, 0.022, 5, lin(0xe6e2d6), K.BIRCHBARK, H);
      b.cyl(0.012, 0.5, 0.0, 0.03, 0.92, 0.01, 0.022, 0.012, 5, lin(0xe6e2d6), K.BIRCHBARK, H);
      b.cyl(0.02, 0.6, 0.0, -0.12, 0.8, 0.06, 0.012, 0.006, 4, lin(0xd6d0c2), K.BIRCHBARK, H);
      const o = { crownR: 0.25, crownH: 0.3 };
      b.blob(0.02, 0.62, 0.0, 0.17, 0.2, 0.17, 0, 41, K.BIRCH, C, H, o);
      b.blob(0.08, 0.8, 0.05, 0.15, 0.19, 0.14, 0, 42, K.BIRCH, C, H, o);
      b.blob(-0.08, 0.78, -0.04, 0.14, 0.18, 0.14, 0, 43, K.BIRCH, C, H, o);
      b.blob(0.03, 0.97, 0.0, 0.11, 0.14, 0.11, 0, 44, K.BIRCH, C, H, o);
      return b.geometry();
    },
    lo() {
      const b = new GB(), H = 1.05, C = [0.02, 0.74, 0];
      b.cyl(0, 0, 0, 0.02, 0.6, 0, 0.03, 0.02, 3, lin(0xe6e2d6), K.BIRCHBARK, H);
      b.blob(C[0], 0.76, C[2], 0.2, 0.3, 0.2, 0, 45, K.BIRCH, C, H, { crownR: 0.22, crownH: 0.3, jitter: 0.2 });
      return b.geometry();
    },
  },
  pappel: {
    decid: true,
    pal: [0x5d8c3c, 0x678f40, 0x557f37, 0x60873a],
    hi() {
      const b = new GB(), H = 1.55, C = [0, 0.9, 0];
      b.cyl(0, 0, 0, 0, 0.4, 0, 0.045, 0.035, 5, BARK, K.WOOD, H);
      const o = { crownR: 0.18, crownH: 0.65 };
      b.blob(0, 0.58, 0, 0.17, 0.3, 0.17, 0, 51, K.LEAF, C, H, o);
      b.blob(0.02, 0.95, 0.01, 0.16, 0.33, 0.16, 0, 52, K.LEAF, C, H, o);
      b.blob(0, 1.3, 0, 0.11, 0.24, 0.11, 0, 53, K.LEAF, C, H, o);
      return b.geometry();
    },
    lo() {
      const b = new GB(), H = 1.55, C = [0, 0.9, 0];
      b.cyl(0, 0, 0, 0, 0.4, 0, 0.045, 0.035, 3, BARK, K.WOOD, H);
      b.blob(0, 0.92, 0, 0.18, 0.62, 0.18, 0, 54, K.LEAF, C, H, { crownR: 0.18, crownH: 0.62, jitter: 0.15 });
      return b.geometry();
    },
  },
  obst: {
    decid: true,
    pal: [0x6f9c45, 0x79a64c, 0x64913f, 0x739a42],
    hi() {
      const b = new GB(), H = 0.62, C = [0, 0.42, 0];
      b.cyl(0, 0, 0, 0.01, 0.24, 0, 0.036, 0.028, 5, BARK_FRUIT, K.WOOD, H);
      for (let k = 0; k < 3; k++) {
        const a = k * 2.1;
        b.cyl(0.0, 0.22, 0.0, Math.cos(a) * 0.17, 0.4, Math.sin(a) * 0.17, 0.02, 0.008, 4, BARK_FRUIT, K.WOOD, H);
      }
      const o = { crownR: 0.3, crownH: 0.2 };
      b.blob(0, 0.42, 0, 0.25, 0.17, 0.25, 0, 61, K.FRUIT, C, H, o);
      for (let k = 0; k < 4; k++) {
        const a = k * 1.57 + 0.5;
        b.blob(Math.cos(a) * 0.15, 0.4 + (k % 2) * 0.06, Math.sin(a) * 0.15, 0.15, 0.12, 0.15, 0, 62 + k, K.FRUIT, C, H, o);
      }
      return b.geometry();
    },
    lo() {
      const b = new GB(), H = 0.62, C = [0, 0.42, 0];
      b.cyl(0, 0, 0, 0, 0.26, 0, 0.035, 0.028, 3, BARK_FRUIT, K.WOOD, H);
      b.blob(0, 0.43, 0, 0.29, 0.2, 0.29, 0, 66, K.FRUIT, C, H, { crownR: 0.3, crownH: 0.2, jitter: 0.2 });
      return b.geometry();
    },
  },
  busch: {
    decid: true,
    pal: [0x557f3a, 0x4d7534, 0x618a40, 0x6b8c3a, 0x5a7d36],
    hi() {
      const b = new GB(), H = 0.26, C = [0, 0.08, 0];
      const o = { crownR: 0.2, crownH: 0.12 };
      b.blob(0, 0.1, 0, 0.16, 0.13, 0.16, 0, 71, K.BUSH, C, H, { ...o, flatBottom: -0.01 });
      b.blob(0.12, 0.08, 0.05, 0.11, 0.1, 0.11, 0, 72, K.BUSH, C, H, { ...o, flatBottom: -0.01 });
      b.blob(-0.09, 0.07, -0.07, 0.1, 0.09, 0.1, 0, 73, K.BUSH, C, H, { ...o, flatBottom: -0.01 });
      return b.geometry();
    },
    lo() {
      const b = new GB(), H = 0.26, C = [0, 0.08, 0];
      b.blob(0.01, 0.09, 0, 0.21, 0.14, 0.2, 0, 74, K.BUSH, C, H, { crownR: 0.2, crownH: 0.12, flatBottom: -0.01, jitter: 0.2 });
      return b.geometry();
    },
  },
  hecke: {
    decid: true,
    pal: [0x4f7b36, 0x567f39, 0x4a7232, 0x5b843a],
    hi() {
      const b = new GB(), H = 0.2, C = [0, 0.07, 0];
      const o = { crownR: 0.5, crownH: 0.1, flatBottom: -0.01 };
      for (let k = 0; k < 3; k++) {
        const x = -0.33 + k * 0.33;
        b.blob(x, 0.075, (hash2(k, 1, 3) - 0.5) * 0.02, 0.24, 0.085 + hash2(k, 4, 3) * 0.02, 0.085, 1, 101 + k, K.BUSH, [x, 0.06, 0], H, { ...o, jitter: 0.38 });
      }
      return b.geometry();
    },
    lo() {
      const b = new GB(), H = 0.2, C = [0, 0.07, 0];
      b.blob(0, 0.075, 0, 0.52, 0.095, 0.08, 0, 107, K.BUSH, C, H, { crownR: 0.5, crownH: 0.1, flatBottom: -0.01, jitter: 0.15 });
      return b.geometry();
    },
  },
  fels: {
    pal: [0x8a857c, 0x9a958c, 0x7d786f, 0xa39b8e, 0x8f8578],
    hi() {
      const b = new GB(), H = 1;
      b.blob(0, 0.05, 0, 0.22, 0.15, 0.19, 1, 81, K.ROCK, [0, 0, 0], H, { flat: true, jitter: 0.55, flatBottom: -0.04, col: [1, 1, 1] });
      b.blob(0.2, 0.0, 0.1, 0.09, 0.07, 0.08, 0, 82, K.ROCK, [0, 0, 0], H, { flat: true, jitter: 0.5, flatBottom: -0.03, col: [0.92, 0.92, 0.92] });
      return b.geometry();
    },
    lo() {
      const b = new GB(), H = 1;
      b.blob(0, 0.04, 0, 0.24, 0.15, 0.2, 0, 83, K.ROCK, [0, 0, 0], H, { flat: true, jitter: 0.5, flatBottom: -0.04, col: [1, 1, 1] });
      return b.geometry();
    },
  },
  schilf: {
    pal: [0x8e9c50, 0x86964a, 0x9aa55a, 0x7f9045],
    shadow: false,
    blade: true,
    hi() {
      const b = new GB(), H = 0.24;
      b.blades(11, 0.11, 0.24, 0.07, 91, [0.35, 0.42, 0.3], [1.15, 1.1, 0.85], K.BLADE, H, 0.011);
      return b.geometry();
    },
    lo() {
      const b = new GB(), H = 0.24;
      b.blades(5, 0.13, 0.22, 0.06, 92, [0.35, 0.42, 0.3], [1.1, 1.05, 0.85], K.BLADE, H, 0.016);
      return b.geometry();
    },
  },
  gras: {
    pal: [0x6f9a45, 0x7aa24c, 0x86a852, 0x648f3e],
    shadow: false,
    blade: true,
    near: true,
    hi() {
      const b = new GB(), H = 0.07;
      b.blades(9, 0.025, 0.07, 0.05, 93, [0.45, 0.5, 0.4], [1.12, 1.12, 0.95], K.BLADE, H, 0.006);
      return b.geometry();
    },
    lo() { return SPECIES.gras.hi(); },
  },
};
const SPECIES_KEYS = Object.keys(SPECIES);

// ---------------------------------------------------------------------------------------------
// Material
const VERT_PARS = /* glsl */`
uniform float uTime;
uniform float uWind;
uniform vec2 uWindDir;
attribute vec3 aCol;
attribute float aKind;
attribute float aH;
varying vec3 vCol;
varying float vKind;
varying float vSeed;
varying float vH;
varying vec3 vWP;
`;
const VERT_SWAY = /* glsl */`
vec3 g7ip = vec3(0.0);
mat3 g7im = mat3(1.0);
#ifdef USE_INSTANCING
g7ip = instanceMatrix[3].xyz;
g7im = mat3(instanceMatrix);
#endif
float g7seed = fract(sin(dot(g7ip.xz, vec2(12.9898, 78.233))) * 43758.5453);
vSeed = g7seed;
vCol = aCol;
vKind = aKind;
vH = aH;
float g7still = step(0.5, abs(aKind - 3.0));
float g7sy = length(g7im[1]);
float g7ph = uTime * (1.1 + g7seed * 0.7) + g7ip.x * 0.31 + g7ip.z * 0.23;
float g7gust = 0.55 + 0.45 * sin(uTime * 0.47 + g7ip.x * 0.045 + g7ip.z * 0.035);
float g7blade = 1.0 - step(0.5, abs(aKind - 6.0));
float g7amp = (0.008 + uWind * 0.045) * g7gust * g7sy * aH * aH * g7still * (1.0 + g7blade * 3.0);
vec3 g7off = vec3(uWindDir.x, 0.0, uWindDir.y) * (sin(g7ph) * 0.7 + 0.35 + uWind * 0.5) * g7amp;
float g7leafy = step(0.5, aKind) * g7still;
g7off += vec3(sin(uTime * 5.3 + position.y * 23.0 + g7seed * 6.0), sin(uTime * 4.1 + position.x * 19.0) * 0.5, cos(uTime * 4.7 + position.z * 21.0)) * 0.0035 * (0.3 + uWind) * aH * g7leafy * g7sy;
transformed += inverse(g7im) * g7off;
vec4 g7w = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
g7w = instanceMatrix * g7w;
#endif
vWP = (modelMatrix * g7w).xyz;
`;

const FRAG_PARS = /* glsl */`
uniform sampler2D tLeaf;
uniform sampler2D tRock;
uniform sampler2D tNoise;
uniform float uLeaf;
uniform float uAutumnK;
uniform float uBlossom;
uniform float uFresh;
uniform float uSnowK;
uniform float uDryK;
varying vec3 vCol;
varying float vKind;
varying float vSeed;
varying float vH;
varying vec3 vWP;
`;

// Gemeinsame Laubmengen-Logik (auch für die Schatten): kahle Kronen im Winter – nur in der Winter-Variante (G7_BARE),
// damit das Sommer-Material ohne discard auskommt (frühe Tiefenprüfung bleibt aktiv).
const FRAG_LEAFCUT = /* glsl */`
bool g7decid = (abs(vKind - 1.0) < 0.5) || (abs(vKind - 4.0) < 0.5) || (abs(vKind - 5.0) < 0.5) || (abs(vKind - 7.0) < 0.5);
bool g7twig = false;
#ifdef G7_BARE
float g7leafA = abs(vKind - 7.0) < 0.5 ? mix(0.5, 1.0, uLeaf) : uLeaf;
float g7cutN = texture2D(tNoise, vWP.xz * 3.1 + vWP.y * 1.7).g * 0.62 + texture2D(tLeaf, vWP.xz * 5.5 + vWP.y * 2.0).a * 0.38;
if (g7decid && g7leafA < 0.995 && g7cutN > g7leafA) {
  if (g7cutN > g7leafA + 0.3 * (1.0 - g7leafA) + 0.02) discard;
  g7twig = true;
}
#endif
`;

// Detailstufen-Blende (FLUSS, Runde 4): feines (lod 1) und einfaches Modell (lod 2) überlappen in einem Band um den
// Radius uLodR um uLodC; je Bildpunkt zeigt ein festes Raster genau eines von beiden (Gegenmengen) – kein Aufpoppen.
const LOD_VERT = /* glsl */`
#ifdef G7_LOD
{ vec2 g7c = (modelMatrix * vec4(g7ip, 1.0)).xz; vG7L = smoothstep(uLodR - uLodB, uLodR, distance(g7c, uLodC)); }
#endif`;
const LOD_FRAG = /* glsl */`
#ifdef G7_LOD
{
  float g7n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  #if G7_LOD == 1
  if (g7n < vG7L) discard;
  #else
  if (g7n >= vG7L) discard;
  #endif
}
#endif`;
function makeVegMaterial(u, variant = 'solid', lod = 0) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, side: variant === 'solid' ? THREE.FrontSide : THREE.DoubleSide });
  mat.defines = { ...(variant === 'bare' ? { G7_BARE: '' } : {}), ...(lod ? { G7_LOD: lod } : {}) };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}\nvarying vec3 vWN;\n#ifdef G7_LOD\nuniform vec2 uLodC;\nuniform float uLodR;\nuniform float uLodB;\nflat varying float vG7L;\n#endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_SWAY}\nvWN = normalize(mat3(modelMatrix) * g7im * objectNormal);\n${LOD_VERT}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${LOD_FRAG}`)
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}\nvarying vec3 vWN;\n#ifdef G7_LOD\nflat varying float vG7L;\n#endif\nfloat g7Hgt = 0.0;\nfloat g7Rough = 0.85;\n${GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  ${FRAG_LEAFCUT}
  vec3 inst = vec3(1.0);
  #ifdef USE_COLOR
  inst = vColor;
  #endif
  float k = vKind;
  vec3 wn = normalize(vWN) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 bw = wn * wn;
  bw /= (bw.x + bw.y + bw.z + 1e-4);
  vec3 col;
  bool conifer = abs(k - 2.0) < 0.5;
  bool blade = abs(k - 6.0) < 0.5;
  if (k < 0.5 || abs(k - 8.0) < 0.5) {
    col = vCol;
    vec4 rb = texture2D(tRock, vec2((vWP.x + vWP.z) * 3.0, vWP.y * 1.6));
    if (abs(k - 8.0) < 0.5) {
      float band = texture2D(tNoise, vec2((vWP.x - vWP.z) * 2.0 + vSeed * 7.0, vWP.y * 6.0)).g;
      col = mix(g7lin(vec3(0.9, 0.89, 0.84)), g7lin(vec3(0.16, 0.15, 0.14)), smoothstep(0.6, 0.68, band) * step(0.12, vH));
      col = mix(g7lin(vec3(0.3, 0.27, 0.24)), col, smoothstep(0.03, 0.12, vH));
    }
    col *= rb.rgb + 0.5;
    g7Hgt = rb.a * 0.35;
    if (k < 0.5) {
      // Borke: senkrechte Furchen (gestreckte Rauschtextur), dunkle Rillen, etwas Moos am Stammfuß
      vec3 an = normalize(vec3(wn.x, 0.0, wn.z) + 1e-4);
      float ang = atan(an.z, an.x);
      float fur = texture2D(tNoise, vec2(ang * 0.95493 + vSeed * 5.0, vWP.y * 2.2)).r; // 6 Furchen-Perioden je Umlauf (nahtlos)
      fur = smoothstep(0.35, 0.7, fur);
      col *= mix(0.62, 1.08, fur);
      col = mix(col, g7lin(vec3(0.33, 0.4, 0.2)) * (0.6 + 0.4 * rb.a), (1.0 - smoothstep(0.02, 0.09, vH)) * 0.35 * (1.0 - uSnowK));
      g7Hgt = rb.a * 0.2 + fur * 0.5;
    }
    g7Rough = 0.95;
  } else if (abs(k - 3.0) < 0.5) {
    vec4 r1 = texture2D(tRock, vWP.zy * 1.4) * bw.x + texture2D(tRock, vWP.xz * 1.4) * bw.y + texture2D(tRock, vWP.xy * 1.4) * bw.z;
    col = vCol * inst * r1.rgb * 2.0;
    float moss = smoothstep(0.4, 0.85, wn.y + (r1.a - 0.5) * 0.7) * (1.0 - uSnowK);
    col = mix(col, g7lin(vec3(0.38, 0.46, 0.23)) * (0.7 + 0.6 * r1.a), moss * 0.6);
    g7Hgt = r1.a * 0.9;
    g7Rough = 0.9;
  } else if (blade) {
    vec3 green = vCol * inst;
    vec3 straw = g7lin(vec3(0.74, 0.64, 0.4)) * (0.55 + 0.45 * vH);
    col = mix(green, straw, clamp(uAutumnK * 0.75 + uDryK * 0.25 + (1.0 - uLeaf) * 0.9, 0.0, 1.0));
    g7Rough = 0.8;
  } else {
    vec2 sideUv = abs(wn.x) > abs(wn.z) ? vWP.zy : vWP.xy;
    vec4 lt = mix(texture2D(tLeaf, sideUv * 5.5 + 0.6), texture2D(tLeaf, vWP.xz * 5.5 + 0.3), smoothstep(0.2, 0.8, abs(wn.y)));
    vec3 ltc = mix(vec3(1.0), lt.rgb * 2.0, 1.35);
    ltc = max(ltc, vec3(0.25));
    vec3 g = vCol * inst * ltc;
    if (g7decid) {
      g = mix(g, g * vec3(1.14, 1.2, 0.78), uFresh);
      float late = step(0.8, fract(vSeed * 3.31)) * 0.45;
      float turn = smoothstep(vSeed * 0.5 + late, vSeed * 0.5 + late + 0.38, uAutumnK) * (abs(k - 7.0) < 0.5 ? 0.7 : 1.0);
      float s2 = fract(vSeed * 7.13);
      vec3 ac = s2 < 0.36 ? vec3(0.84, 0.66, 0.2) : s2 < 0.64 ? vec3(0.82, 0.48, 0.15) : s2 < 0.78 ? vec3(0.66, 0.24, 0.1) : vec3(0.56, 0.42, 0.2);
      ac = mix(ac, vec3(0.6, 0.56, 0.22), step(0.9, fract(vSeed * 11.7)));
      if (abs(k - 5.0) < 0.5) ac = vec3(0.88, 0.74, 0.24);
      if (abs(k - 7.0) < 0.5) ac = mix(ac, vec3(0.55, 0.38, 0.18), 0.55);
      g = mix(g, g7lin(ac) * vCol * ltc, turn);
      if (abs(k - 4.0) < 0.5 && uBlossom > 0.01) {
        float bl = smoothstep(0.42, 0.58, lt.a + (fract(vSeed * 3.7) - 0.5) * 0.25);
        vec3 bc = fract(vSeed * 5.1) < 0.5 ? vec3(0.98, 0.96, 0.95) : vec3(0.98, 0.8, 0.86);
        g = mix(g, g7lin(bc) * (0.7 + 0.3 * vCol), bl * uBlossom);
      }
      if (g7twig) g = g7lin(vec3(0.4, 0.35, 0.31)) * (0.55 + 0.45 * vCol);
    }
    col = g;
    g7Hgt = lt.a * 1.0;
    g7Rough = 0.8;
  }
  float sn = uSnowK * smoothstep(0.1, 0.65, wn.y + (fract(vSeed * 13.0) - 0.5) * 0.25) * (conifer ? 1.0 : 0.8) * (blade ? 0.35 : 1.0);
  // Schnee auf Zweigen: oben hell, an den Flanken kühl bläulich, mit leichter Körnung
  vec3 snC = mix(g7lin(vec3(0.74, 0.8, 0.92)), g7lin(vec3(0.95, 0.96, 0.98)), smoothstep(0.35, 0.9, wn.y));
  col = mix(col, snC * (0.93 + 0.1 * fract(vSeed * 29.0)), sn);
  diffuseColor.rgb = col;
}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = g7Rough;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = g7bump(-vViewPosition, normal, g7Hgt * 0.7, faceDirection);');
  };
  mat.customProgramCacheKey = () => 'g7veg-' + variant + (lod ? '-lod' + lod : '');
  return mat;
}

function makeVegDepthMaterial(u, bare) {
  const mat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: bare ? THREE.DoubleSide : THREE.FrontSide });
  if (bare) mat.defines = { G7_BARE: '' };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_SWAY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('void main() {', `void main() {\n{\n${FRAG_LEAFCUT}\n}`);
  };
  mat.customProgramCacheKey = () => 'g7vegDepth-' + (bare ? 'bare' : 'solid');
  return mat;
}

// ---------------------------------------------------------------------------------------------

export class Vegetation {
  constructor(tv) {
    this.tv = tv;
    this.e = tv.e;
    this.g = tv.g;
    this.group = new THREE.Group();
    this.group.name = 'Vegetation';
    tv.group.add(this.group);
    this.uniforms = {
      uTime: shared.uTime, uWind: { value: 0.25 }, uWindDir: { value: new THREE.Vector2(0.77, 0.64) },
      tLeaf: { value: leafTexture() }, tRock: { value: tv.tex.rock }, tNoise: { value: tv.tex.noise },
      uLeaf: { value: 1 }, uAutumnK: { value: 0 }, uBlossom: { value: 0 }, uFresh: { value: 0 }, uSnowK: tv.uniforms.uSnowK, uDryK: tv.uniforms.uDry,
    };
    this.uniforms.uLodC = { value: new THREE.Vector2() };
    this.uniforms.uLodR = { value: 0 };
    this.uniforms.uLodB = { value: 1 };
    // Gras um den Kamerapunkt: eigener Radius (wächst beim Heranzoomen weich auf, statt bei 26 auf einmal zu erscheinen)
    this.grassU = { ...this.uniforms, uLodR: { value: 0 }, uLodB: { value: 3.5 } };
    const mk = (u, lod) => ({ solid: makeVegMaterial(u, 'solid', lod), bare: makeVegMaterial(u, 'bare', lod), blade: makeVegMaterial(u, 'blade', lod) });
    this.mats = mk(this.uniforms, 0);
    this.lodMats = [mk(this.uniforms, 1), mk(this.uniforms, 2)];
    this.grassMat = makeVegMaterial(this.grassU, 'blade', 1);
    this.lodOn = false;
    this.depthMats = { solid: makeVegDepthMaterial(this.uniforms, false), bare: makeVegDepthMaterial(this.uniforms, true) };
    this.bare = false;
    this.sp = {};
    for (const key of SPECIES_KEYS) {
      const S = SPECIES[key];
      this.sp[key] = { key, def: S, geo: [S.hi(), S.lo()], mesh: [null, null], cap: 0, n: 0, mats: null, cols: null, xz: null, pal: S.pal.map((h) => new THREE.Color(h)) };
    }
    this.decor = new Uint8Array(this.g.N);
    this.lodKey = null;
    this.nearKey = null;
  }

  // Gebäude auf Feldern mit Dekor (Büsche, Felsen) → neu verteilen
  blocksFootprint(b) {
    const W = this.g.W;
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (this.decor[y * W + x]) return true;
    return false;
  }

  // ---------- Verteilung
  refresh() {
    const g = this.g, w = g.world, W = g.W, H = g.H, tv = this.tv, F = tv.field, S = F.S;
    const ox = -W / 2, oz = -H / 2;
    const seed = w.seed | 0;
    const stand = makeNoise(seed + 5501), moist = makeNoise(seed + 5502), patch = makeNoise(seed + 5503);
    const lists = {};
    for (const k of SPECIES_KEYS) lists[k] = [];
    this.decor.fill(0);
    const add = (key, x, z, s, rot, sy = 1, y = null, ci = -1) => {
      const yy = y === null ? tv.heightAt(x, z) : y;
      lists[key].push(x, yy - 0.015 * s, z, s, rot, sy, ci < 0 ? hash2((x * 97) | 0, (z * 89) | 0, 77) : ci);
    };
    const free = (i) => !g.bld[i] && !g.road[i];
    const treeAt = (x, y) => x >= 0 && y >= 0 && x < W && y < H && w.trees[y * W + x] > 0;
    const gridV = (x, y) => Math.round(y * S) * F.GW + Math.round(x * S);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const t = w.terrain[i];
      // Alleebäume (auf dem Mittelstreifen)
      if (g.road[i] === R.AVENUE && tv.avenueTrees) {
        const horiz = (x > 0 && g.road[i - 1]) || (x < W - 1 && g.road[i + 1]);
        const vert = (y > 0 && g.road[i - W]) || (y < H - 1 && g.road[i + W]);
        if (horiz !== vert && t !== T.WATER) add('laub', x + ox + 0.5, y + oz + 0.5, 0.58 + hash2(x, y, 3) * 0.1, hash2(x, y, 4) * 6.28, 1, 0.012, hash2(x, y, 5));
      }
      if (!free(i)) continue;
      const d = w.trees[i];
      const wd = F.dToW[gridV(x + 0.5, y + 0.5)] / S;
      const rd = F.dToR[gridV(x + 0.5, y + 0.5)] / S;
      if (d && t !== T.WATER && t !== T.ROCK) {
        const n = d === 1 ? (hash2(x, y, 1) < 0.45 ? 1 : 2) : d === 2 ? 3 : 4;
        const sv = stand.fbm(x * 0.09, y * 0.09, 3) + (rd < 4 ? (4 - rd) * 0.07 : 0);
        const conif = sv > 0.56;
        const nearW = wd < 2.2;
        let edge = 0;
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!treeAt(x + ax, y + ay)) edge++;
        const orchard = d === 1 && w.resource[i] === RES.FERTILE && edge >= 3;
        for (let k = 0; k < n; k++) {
          const sx = (k % 2) * 0.5, sz = ((k >> 1) % 2) * 0.5;
          const jx = n === 1 ? 0.2 + hash2(x, y, 31 + k) * 0.6 : sx + 0.08 + hash2(x, y, 31 + k) * 0.34 + (k >= 4 ? 0.2 : 0);
          const jz = n === 1 ? 0.2 + hash2(x, y, 71 + k) * 0.6 : sz + 0.08 + hash2(x, y, 71 + k) * 0.34;
          const px = x + ox + (k >= 4 ? 0.3 + hash2(x, y, 9) * 0.4 : jx), pz = y + oz + (k >= 4 ? 0.3 + hash2(x, y, 8) * 0.4 : jz);
          const r = hash2(x, y, 11 + k);
          let key;
          if (orchard) key = 'obst';
          else if (nearW && r < 0.45) key = r < 0.22 ? 'pappel' : 'birke';
          else if (conif) key = r < 0.72 ? 'fichte' : r < 0.9 ? 'kiefer' : 'laub';
          else key = edge >= 2 && r < 0.2 ? 'birke' : r < 0.86 ? 'laub' : r < 0.94 ? 'fichte' : 'kiefer';
          const s = (0.78 + hash2(x, y, 51 + k) * 0.5) * (1 + (d - 1) * 0.08) * (key === 'obst' ? 1.1 : 1);
          add(key, px, pz, s, hash2(x, y, 91 + k) * 6.28, 0.9 + hash2(x, y, 61 + k) * 0.25);
        }
        // Unterholz am Waldrand
        if (edge >= 1 && hash2(x, y, 13) < 0.55) add('busch', x + ox + 0.15 + hash2(x, y, 14) * 0.7, y + oz + 0.15 + hash2(x, y, 15) * 0.7, 0.8 + hash2(x, y, 16) * 0.6, hash2(x, y, 17) * 6.28);
        continue;
      }
      if (t === T.ROCK) {
        // Bergwald und Felsbrocken auf den Hängen
        const cx = x + ox + 0.5, cz = y + oz + 0.5;
        const hC = tv.heightAt(cx, cz);
        const sl = Math.hypot(tv.heightAt(cx + 0.3, cz) - tv.heightAt(cx - 0.3, cz), tv.heightAt(cx, cz + 0.3) - tv.heightAt(cx, cz - 0.3)) / 0.6;
        const dens = stand.fbm(x * 0.13 + 40, y * 0.13, 3);
        if (hC < 3.6 && sl < 1.1) {
          const nT = Math.floor((dens - 0.38) * 7 * (1 - hC / 4.2) * (1 - sl * 0.6));
          for (let k = 0; k < Math.min(4, nT); k++) {
            const px = x + ox + 0.1 + hash2(x, y, 131 + k) * 0.8, pz = y + oz + 0.1 + hash2(x, y, 171 + k) * 0.8;
            const ph = tv.heightAt(px, pz);
            if (ph > 3.8) continue;
            add(hash2(x, y, 141 + k) < 0.72 ? 'fichte' : 'kiefer', px, pz, 0.7 + hash2(x, y, 151 + k) * 0.45, hash2(x, y, 161 + k) * 6.28, 0.95);
          }
        }
        if (hash2(x, y, 181) < 0.16 && hC > 0.1) {
          const px = x + ox + 0.15 + hash2(x, y, 182) * 0.7, pz = y + oz + 0.15 + hash2(x, y, 183) * 0.7;
          add('fels', px, pz, 0.8 + hash2(x, y, 184) * 1.3, hash2(x, y, 185) * 6.28, 0.7 + hash2(x, y, 186) * 0.5);
        }
        continue;
      }
      if (t === T.WATER || g.zone[i] || g.rubble[i]) continue;
      // Freie Wiese: einzelne Büsche, Felsen am Bergfuß, Waldrandgebüsch
      let nearTree = 0;
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (treeAt(x + ax, y + ay)) nearTree++;
      const pv = patch.fbm(x * 0.2, y * 0.2, 2);
      if ((nearTree && hash2(x, y, 21) < 0.28) || (hash2(x, y, 22) < 0.035 * (t === T.SAND ? 0.3 : 1) * (pv > 0.55 ? 3 : 1))) {
        add('busch', x + ox + 0.15 + hash2(x, y, 23) * 0.7, y + oz + 0.15 + hash2(x, y, 24) * 0.7, 0.7 + hash2(x, y, 25) * 0.7, hash2(x, y, 26) * 6.28);
        this.decor[i] = 1;
      }
      if ((rd < 2.5 && hash2(x, y, 27) < 0.3) || hash2(x, y, 28) < 0.008) {
        add('fels', x + ox + 0.2 + hash2(x, y, 29) * 0.6, y + oz + 0.2 + hash2(x, y, 30) * 0.6, 0.35 + hash2(x, y, 32) * 0.5, hash2(x, y, 33) * 6.28, 0.8);
        this.decor[i] = 1;
      }
      // Hecken als Feldraine: gerade Reihen im Raster über fruchtbaren Wiesen, mit Lücken
      if (w.resource[i] === RES.FERTILE && t === T.GRASS) {
        const hv = patch.fbm(x * 0.07 + 9, y * 0.07, 2);
        if (hv > 0.5) {
          if (x % 7 === 0 && hash2(x, y >> 1, 37) > 0.3) { add('hecke', x + ox + 0.06, y + oz + 0.5, 1.02, Math.PI / 2, 0.9 + hash2(x, y, 38) * 0.35); this.decor[i] = 1; }
          if (y % 6 === 0 && hash2(x >> 1, y, 39) > 0.3) { add('hecke', x + ox + 0.5, y + oz + 0.06, 1.02, 0, 0.9 + hash2(x, y, 40) * 0.35); this.decor[i] = 1; }
        }
      }
      // Einzelner Obstbaum auf fruchtbarem Boden
      if (w.resource[i] === RES.FERTILE && hash2(x, y, 34) < 0.05) {
        add('obst', x + ox + 0.5, y + oz + 0.5, 0.95 + hash2(x, y, 35) * 0.2, hash2(x, y, 36) * 6.28);
        this.decor[i] = 1;
      }
    }
    // Schilf im Flachwasser (nicht an Sandstränden, nicht unter Brücken)
    const WL = tv.waterLevel;
    const reedN = moist;
    for (let gy = 1; gy < F.GH - 1; gy++) for (let gx = 1; gx < F.GW - 1; gx++) {
      const k = gy * F.GW + gx;
      const hh = F.h[k];
      if (hh > WL + 0.06 || hh < WL - 0.1) continue;
      const tx = gx / S, ty = gy / S;
      const ti = Math.min(H - 1, Math.floor(ty)) * W + Math.min(W - 1, Math.floor(tx));
      if (g.road[ti] || g.bld[ti]) continue;
      let sandy = false;
      for (const [ax, ay] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = clamp(Math.floor(tx) + ax, 0, W - 1), yy = clamp(Math.floor(ty) + ay, 0, H - 1);
        if (w.terrain[yy * W + xx] === T.SAND) sandy = true;
      }
      if (sandy || g.world.type === 'islands') continue;
      const rv = reedN.fbm(tx * 0.35, ty * 0.35, 3);
      if (rv < 0.5 || hash2(gx, gy, 401) > (rv - 0.5) * 3.2) continue;
      const px = tx + ox + (hash2(gx, gy, 402) - 0.5) / S, pz = ty + oz + (hash2(gx, gy, 403) - 0.5) / S;
      add('schilf', px, pz, 0.8 + hash2(gx, gy, 404) * 0.6, hash2(gx, gy, 405) * 6.28, 0.85 + hash2(gx, gy, 406) * 0.4, Math.max(tv.heightAt(px, pz), WL - 0.08));
    }
    // In Instanzdaten umwandeln
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), yA = new THREE.Vector3(0, 1, 0);
    const c = new THREE.Color();
    for (const key of SPECIES_KEYS) {
      const sp = this.sp[key];
      if (sp.def.near) continue;
      const L = lists[key];
      const n = L.length / 7;
      sp.n = n;
      sp.mats = new Float32Array(n * 16);
      sp.cols = new Float32Array(n * 3);
      sp.xz = new Float32Array(n * 2);
      for (let k = 0; k < n; k++) {
        const o = k * 7;
        p.set(L[o], L[o + 1], L[o + 2]);
        q.setFromAxisAngle(yA, L[o + 4]);
        sc.set(L[o + 3], L[o + 3] * L[o + 5], L[o + 3]);
        m4.compose(p, q, sc);
        m4.toArray(sp.mats, k * 16);
        const pc = sp.pal[Math.floor(L[o + 6] * sp.pal.length) % sp.pal.length];
        c.copy(pc).offsetHSL((hash2(k, n, 7) - 0.5) * 0.02, 0, (hash2(k, n, 8) - 0.5) * 0.06);
        sp.cols[k * 3] = c.r; sp.cols[k * 3 + 1] = c.g; sp.cols[k * 3 + 2] = c.b;
        sp.xz[k * 2] = L[o]; sp.xz[k * 2 + 1] = L[o + 2];
      }
      this.ensureMeshes(sp, n);
    }
    this.lodKey = null;
    this.nearKey = null;
    this.assignLOD(true);
  }

  ensureMeshes(sp, n) {
    const need = Math.max(16, n);
    if (sp.cap >= need && sp.mesh[0]) return;
    const cap = Math.ceil(need * 1.15);
    for (let l = 0; l < 2; l++) {
      if (sp.mesh[l]) { this.group.remove(sp.mesh[l]); sp.mesh[l].dispose(); }
      const m = new THREE.InstancedMesh(sp.geo[l], this.matFor(sp, l), cap);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.setColorAt(0, new THREE.Color(1, 1, 1));
      m.instanceColor.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
      m.castShadow = sp.def.shadow !== false;
      m.receiveShadow = true;
      m.frustumCulled = false;
      m.customDepthMaterial = this.depthFor(sp);
      m.name = `${sp.key}-${l ? 'fern' : 'nah'}`;
      m.visible = false;
      this.group.add(m);
      sp.mesh[l] = m;
    }
    sp.cap = cap;
  }

  // l: 0 = feines, 1 = einfaches Modell. Mit aktiver Detailstufen-Blende (lodOn) tragen beide die Blende.
  matFor(sp, l = 0) {
    if (sp.def.near) return this.grassMat;
    const set = l === 0 ? this.lodMats[0] : this.lodOn ? this.lodMats[1] : this.mats;
    return sp.def.blade ? set.blade : (sp.def.decid && this.bare) ? set.bare : set.solid;
  }
  depthFor(sp) { return (sp.def.decid && this.bare) ? this.depthMats.bare : this.depthMats.solid; }
  setBare(on) {
    if (on === this.bare) return;
    this.bare = on;
    for (const k of SPECIES_KEYS) {
      const sp = this.sp[k];
      sp.mesh.forEach((m, l) => { if (m) { m.material = this.matFor(sp, l); m.customDepthMaterial = this.depthFor(sp); } });
    }
  }

  // Detailstufen: nahe Pflanzen bekommen das feine Modell (nur wenn die Kamera nah genug ist). Der Radius folgt dem
  // Zoom stetig und schrumpft beim Herauszoomen weich auf null (früher bei 48 schlagartig); im Band um den Radius
  // liegen Pflanzen in beiden Meshes und werden im Shader gegeneinander überblendet. Die Zuordnung auf der CPU wird
  // nur in groben Schritten erneuert – der Rand (margin) deckt ab, was die Blende dazwischen wandert.
  assignLOD(force) {
    const rig = this.e.rig;
    const tx = rig.target.x, tz = rig.target.z, dist = rig.cur.dist;
    const R = clamp(dist * 0.7 + 3, 8, 22) * (1 - smoothstep(40, 52, dist));
    const B = Math.max(2, R * 0.35);
    const U = this.uniforms;
    U.uLodC.value.set(tx, tz); U.uLodR.value = R; U.uLodB.value = B;
    const on = R > 0.5;
    if (on !== this.lodOn) {
      this.lodOn = on;
      for (const k of SPECIES_KEYS) { const sp = this.sp[k]; if (sp.mesh[1] && !sp.def.near) sp.mesh[1].material = this.matFor(sp, 1); }
    }
    const q = Math.max(2, R * 0.25);
    const key = on ? [Math.round(tx / q), Math.round(tz / q), Math.round(R / 3.5)].join(':') : 'aus';
    if (!force && key === this.lodKey) return;
    this.lodKey = key;
    const margin = q + 3.5;
    const rIn = on ? R + margin : 0, rOut = on ? Math.max(0, R - B - margin) : -1;
    const RI2 = rIn * rIn, RO2 = rOut < 0 ? -1 : rOut * rOut;
    for (const k of SPECIES_KEYS) {
      const sp = this.sp[k];
      if (sp.def.near || !sp.mesh[0]) continue;
      const hi = sp.mesh[0], lo = sp.mesh[1];
      const hm = hi.instanceMatrix.array, lm = lo.instanceMatrix.array, hc = hi.instanceColor.array, lc = lo.instanceColor.array;
      let nh = 0, nl = 0;
      for (let i = 0; i < sp.n; i++) {
        const dx = sp.xz[i * 2] - tx, dz = sp.xz[i * 2 + 1] - tz;
        const d2 = dx * dx + dz * dz;
        if (d2 < RI2) {
          hm.set(sp.mats.subarray(i * 16, i * 16 + 16), nh * 16);
          hc.set(sp.cols.subarray(i * 3, i * 3 + 3), nh * 3);
          nh++;
        }
        if (d2 > RO2) {
          lm.set(sp.mats.subarray(i * 16, i * 16 + 16), nl * 16);
          lc.set(sp.cols.subarray(i * 3, i * 3 + 3), nl * 3);
          nl++;
        }
      }
      hi.count = nh; lo.count = nl;
      hi.visible = nh > 0; lo.visible = nl > 0;
      hi.instanceMatrix.needsUpdate = lo.instanceMatrix.needsUpdate = true;
      hi.instanceColor.needsUpdate = lo.instanceColor.needsUpdate = true;
    }
  }

  // Grasbüschel nur in Kameranähe (freie Wiese, keine Zonen/Gebäude/Straßen)
  updateNear(force) {
    const rig = this.e.rig;
    const sp = this.sp.gras;
    const dist = rig.cur.dist;
    const low = this.e.quality && this.e.quality.name === 'low';
    // Grasradius wächst zwischen Abstand 26 und 19 weich auf (Blende im Shader), statt bei 26 auf einmal zu erscheinen
    const Rg = low ? 0 : 13 * (1 - smoothstep(19, 26, dist));
    this.grassU.uLodC.value.set(rig.target.x, rig.target.z);
    this.grassU.uLodR.value = Rg;
    const on = Rg > 0.3;
    const tx = rig.target.x, tz = rig.target.z;
    const key = on ? `${Math.round(tx / 3)}:${Math.round(tz / 3)}` : 'aus';
    if (!force && key === this.nearKey) return;
    this.nearKey = key;
    if (!on) { if (sp.mesh[0]) { sp.mesh[0].count = 0; sp.mesh[0].visible = false; } return; }
    const g = this.g, w = g.world, W = g.W, H = g.H, tv = this.tv;
    const ox = -W / 2, oz = -H / 2;
    const Rn = 16;
    const cx = Math.floor(tx + W / 2), cz = Math.floor(tz + H / 2);
    const per = 7;
    const est = (2 * Rn + 1) * (2 * Rn + 1) * per;
    this.ensureMeshes(sp, est);
    const mesh = sp.mesh[0];
    const ma = mesh.instanceMatrix.array, ca = mesh.instanceColor.array;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), yA = new THREE.Vector3(0, 1, 0);
    const pal = sp.pal;
    let n = 0;
    for (let y = Math.max(0, cz - Rn); y <= Math.min(H - 1, cz + Rn); y++) for (let x = Math.max(0, cx - Rn); x <= Math.min(W - 1, cx + Rn); x++) {
      const i = y * W + x;
      const t = w.terrain[i];
      if (g.bld[i] || g.road[i] || g.zone[i] || g.rubble[i] || t === T.WATER) continue;
      const dx = x + 0.5 - (tx + W / 2), dz = y + 0.5 - (tz + H / 2);
      if (dx * dx + dz * dz > Rn * Rn) continue;
      const cnt = t === T.SAND ? 2 : t === T.ROCK ? 3 : per;
      for (let k = 0; k < cnt; k++) {
        if (n >= sp.cap) break;
        const px = x + ox + hash2(x, y, 301 + k), pz = y + oz + hash2(x, y, 331 + k);
        const hh = tv.heightAt(px, pz);
        if (hh < tv.waterLevel + 0.02 || hh > 3.5) continue;
        if (t === T.ROCK) {
          const sl = Math.abs(tv.heightAt(px + 0.15, pz) - tv.heightAt(px - 0.15, pz)) + Math.abs(tv.heightAt(px, pz + 0.15) - tv.heightAt(px, pz - 0.15));
          if (sl > 0.25) continue;
        }
        const s = 0.7 + hash2(x, y, 361 + k) * 0.8;
        p.set(px, hh, pz);
        q.setFromAxisAngle(yA, hash2(x, y, 391 + k) * 6.28);
        sc.set(s, s * (w.trees[i] ? 0.8 : 1), s);
        m4.compose(p, q, sc);
        m4.toArray(ma, n * 16);
        const c = pal[Math.floor(hash2(x, y, 421 + k) * pal.length) % pal.length];
        ca[n * 3] = c.r; ca[n * 3 + 1] = c.g; ca[n * 3 + 2] = c.b;
        n++;
      }
    }
    mesh.count = n;
    mesh.visible = n > 0;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  frame(dt, time, night, s) {
    const u = this.uniforms;
    // Wind: geglättetes Wetter der Engine (shared.uWind/uWindDir, G1), sonst eigener Zustand; nie NaN
    const fin = (v, d) => (Number.isFinite(v) ? v : d);
    const w0 = fin(shared.uWind.value, fin(s.wind, 0.25));
    const dir = fin(shared.uWindDir.value, fin(s.windDir, 0.7));
    const wind = clamp(w0 * (s.storm ? 1.6 : 1), 0, 1.5);
    if (!Number.isFinite(u.uWind.value)) u.uWind.value = wind;
    u.uWind.value += (wind - u.uWind.value) * Math.min(1, fin(dt, 0) * 0.8);
    u.uWindDir.value.set(Math.cos(dir), Math.sin(dir));
    // Jahreszeit: Laub, Blüte, Frühlingsgrün
    const t = s.t;
    // Austrieb schon in den letzten Wintertagen (t 0,95 → 0,03), damit die Bäume zum Spielbeginn im Frühling belaubt sind;
    // Laubfall im Spätherbst (t 0,66 → 0,76), damit der Winter kahle, verschneite Kronen zeigt statt halb belaubter
    // Herbstbäume. Über den Jahreswechsel stetig.
    const tt = (t + 0.05) % 1;
    const leaf = tt < 0.5 ? smoothstep(0.0, 0.08, tt) : 1 - smoothstep(0.71, 0.81, tt);
    u.uLeaf.value = leaf;
    this.setBare(leaf < 0.985);
    u.uAutumnK.value = s.autumn;
    u.uBlossom.value = smoothstep(0.03, 0.08, t) * (1 - smoothstep(0.15, 0.21, t));
    u.uFresh.value = t < 0.45 ? 1 - smoothstep(0.14, 0.3, t) : 0;
    this.assignLOD(false);
    this.updateNear(false);
  }
}
