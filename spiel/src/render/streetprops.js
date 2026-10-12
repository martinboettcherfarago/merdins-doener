// Stadtmobiliar und Geometrie-Werkzeuge der Straßen-Ansicht (Besitzer: G8).
// Enthält:
//  - Layer/Brush: schnelle Sammler für zusammengeführte Block-Geometrien (ein Draw Call pro Block und Schicht)
//      solid  → Atlas-Material aus atlas.js (Vertex-Attribut aMat, weltbezogene UVs: 1 UV = 4 m)
//      paint  → Markierungen, Fahrspuren, Abnutzung (eigenes, halbtransparentes Material)
//      glow   → Schilder, Plakate, Lampenschirme und Ampel-Linsen (eigenes Material, Schilder-Atlas, Ampelphasen im Shader)
//      light  → Lichtkegel und Lichtflecken der Laternen (additiv, nur nachts sichtbar)
//      tint   → Einfärbung der Verkehrsansicht
//  - Schilder-Atlas (Canvas): Verkehrszeichen, Straßennamen, Autobahnschilder, Ortstafel, Werbeplakate
//  - Modelle: Laternen, Ampeln, Schilder, Bäume, Bänke, Mülleimer, Hydranten, Briefkästen, Fahrradständer,
//    Poller, parkende Autos, Bushaltestellen, Leitplanken, Schilderbrücken
// Ampelphasen: signalState() spiegelt die Shader-Logik (für Fahrzeuge/Simulation nutzbar).
import * as THREE from 'three';
import { ATLAS_INDEX, ATLAS_NAMES, getAtlasMaterial } from './atlas.js';
import { MATERIAL_DEFS } from './matlib.js';
import { shared } from './materials.js';
import { hash2 } from '../util.js';

export const TEXS = 2.5; // weltbezogene UVs: 1 UV-Einheit = 4 m = 0,4 Welteinheiten

// ---------------------------------------------------------------- Material-Indizes (Atlas)
const MI_CACHE = {};
export function MI(name) {
  if (MI_CACHE[name] !== undefined) return MI_CACHE[name];
  let v = ATLAS_INDEX[name];
  if (v === undefined) v = ATLAS_INDEX.metal_dark ?? 0;
  MI_CACHE[name] = v;
  return v;
}

// ---------------------------------------------------------------- Sammler
// Wachsender Float32-Puffer (vermeidet große JS-Arrays und Müllsammlung beim Neubau)
class FBuf {
  constructor(n = 768) { this.a = new Float32Array(n); this.n = 0; }
  need(k) { if (this.n + k > this.a.length) { const b = new Float32Array(Math.max(this.a.length * 2, this.n + k)); b.set(this.a); this.a = b; } }
  attr(size) { return new THREE.BufferAttribute(this.a.slice(0, this.n), size); }
}

export class Layer {
  constructor(kind) {
    this.kind = kind;
    this.p = new FBuf(); // Position
    this.n = new FBuf(); // Normale
    this.u = new FBuf(); // UV
    this.m = kind === 'solid' ? new FBuf(256) : null; // Atlas-Material
    this.c = kind === 'paint' || kind === 'glow' || kind === 'tint' ? new FBuf(1024) : null; // Farbe RGBA
    this.s = kind === 'glow' ? new FBuf(1024) : null; // Signal/Leuchtart
    this.i = kind === 'light' ? new FBuf(256) : null; // Lichtstärke
  }
  get count() { return this.p.n / 3; }
  empty() { return this.p.n === 0; }

  // Ein Vertex. Für 'solid' werden weltbezogene UVs aus Position und Normale erzeugt.
  vs(x, y, z, nx, ny, nz, mat) {
    const P = this.p, N = this.n, U = this.u, M = this.m;
    P.need(3); N.need(3); U.need(2); M.need(1);
    let k = P.n; P.a[k] = x; P.a[k + 1] = y; P.a[k + 2] = z; P.n = k + 3;
    k = N.n; N.a[k] = nx; N.a[k + 1] = ny; N.a[k + 2] = nz; N.n = k + 3;
    M.a[M.n++] = mat;
    const ax = nx < 0 ? -nx : nx, ay = ny < 0 ? -ny : ny;
    k = U.n;
    if (ay > 0.6) { U.a[k] = x * TEXS; U.a[k + 1] = z * TEXS; }
    else if (ax > 0.6) { U.a[k] = z * TEXS; U.a[k + 1] = y * TEXS; }
    else { U.a[k] = x * TEXS; U.a[k + 1] = y * TEXS; }
    U.n = k + 2;
  }
  // Flaches Dreieck (solid) mit berechneter Normale.
  tri(mat, ax, ay, az, bx, by, bz, cx, cy, cz) {
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= l; ny /= l; nz /= l;
    this.vs(ax, ay, az, nx, ny, nz, mat); this.vs(bx, by, bz, nx, ny, nz, mat); this.vs(cx, cy, cz, nx, ny, nz, mat);
  }
  // Dreieck, dessen Normale nach oben zeigen soll (Bodenflächen)
  triUp(mat, ax, ay, az, bx, by, bz, cx, cy, cz) {
    const ux = bx - ax, uz = bz - az, vx = cx - ax, vz = cz - az;
    if (uz * vx - ux * vz < 0) this.tri(mat, ax, ay, az, cx, cy, cz, bx, by, bz);
    else this.tri(mat, ax, ay, az, bx, by, bz, cx, cy, cz);
  }
  quad(mat, a, b, c, d) {
    this.tri(mat, a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.tri(mat, a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
  }
  // Farbige Vertices (paint/tint/glow)
  vc(x, y, z, nx, ny, nz, r, g, b, a, u = 0.01, v = 0.99, s0 = 0, s1 = 0, s2 = 0, s3 = 0) {
    const P = this.p, N = this.n, U = this.u, C = this.c;
    P.need(3); N.need(3); U.need(2); C.need(4);
    let k = P.n; P.a[k] = x; P.a[k + 1] = y; P.a[k + 2] = z; P.n = k + 3;
    k = N.n; N.a[k] = nx; N.a[k + 1] = ny; N.a[k + 2] = nz; N.n = k + 3;
    k = U.n; U.a[k] = u; U.a[k + 1] = v; U.n = k + 2;
    k = C.n; C.a[k] = r; C.a[k + 1] = g; C.a[k + 2] = b; C.a[k + 3] = a; C.n = k + 4;
    if (this.s) { const S = this.s; S.need(4); k = S.n; S.a[k] = s0; S.a[k + 1] = s1; S.a[k + 2] = s2; S.a[k + 3] = s3; S.n = k + 4; }
  }
  // Licht-Vertex
  vl(x, y, z, k) {
    const P = this.p, I = this.i;
    P.need(3); I.need(1);
    const j = P.n; P.a[j] = x; P.a[j + 1] = y; P.a[j + 2] = z; P.n = j + 3;
    I.a[I.n++] = k;
  }

  toGeometry() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', this.p.attr(3));
    if (this.kind !== 'light' && this.kind !== 'tint') geo.setAttribute('normal', this.n.attr(3));
    if (this.kind === 'solid') {
      geo.setAttribute('uv', this.u.attr(2));
      geo.setAttribute('aMat', this.m.attr(1));
    } else if (this.kind === 'paint' || this.kind === 'glow' || this.kind === 'tint') {
      geo.setAttribute('color', this.c.attr(4));
      if (this.kind !== 'tint') geo.setAttribute('uv', this.u.attr(2));
      if (this.kind === 'glow') {
        geo.setAttribute('aSig', this.s.attr(4));
        if (!this.instanced) geo.setAttribute('aPh', new THREE.BufferAttribute(new Float32Array(this.count * 2), 2));
      }
    } else if (this.kind === 'light') {
      geo.setAttribute('aI', this.i.attr(1));
    }
    geo.computeBoundingSphere();
    return geo;
  }
}

// Pinsel: lokales Koordinatensystem (Position + Drehung um y) für Modelle, die nach +z „schauen".
export class Brush {
  constructor(layer) {
    this.L = layer;
    this.ox = 0; this.oy = 0; this.oz = 0; this.c = 1; this.s = 0;
    this.mat = 0;
    this.col = [1, 1, 1, 1];
    this.sig = [0, 0, 0, 0];
    this.uvr = null; // [u0, v0, u1, v1] für Schilderflächen
  }
  at(x, y, z, yaw = 0) { this.ox = x; this.oy = y; this.oz = z; this.c = Math.cos(yaw); this.s = Math.sin(yaw); return this; }
  m(name) { this.mat = MI(name); return this; }
  color(r, g, b, a = 1) { this.col = [r, g, b, a]; return this; }
  hex(h, a = 1) { this.col = [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255, a]; return this; }
  signal(kind, a = 0, b = 0, c = 0) { this.sig = [kind, a, b, c]; return this; }
  wx(lx, lz) { return this.ox + lx * this.c + lz * this.s; }
  wz(lx, lz) { return this.oz - lx * this.s + lz * this.c; }
  nx(nx, nz) { return nx * this.c + nz * this.s; }
  nz(nx, nz) { return -nx * this.s + nz * this.c; }

  // Vertex im lokalen System
  v(lx, ly, lz, nx, ny, nz, uu, vv) {
    const x = this.wx(lx, lz), y = this.oy + ly, z = this.wz(lx, lz);
    const wnx = this.nx(nx, nz), wnz = this.nz(nx, nz);
    const L = this.L;
    if (L.kind === 'solid') L.vs(x, y, z, wnx, ny, wnz, this.mat);
    else {
      const c = this.col, s = this.sig;
      L.vc(x, y, z, wnx, ny, wnz, c[0], c[1], c[2], c[3], uu ?? 0.008, vv ?? 0.992, s[0], s[1], s[2], s[3]);
    }
  }
  // Flaches Viereck aus 4 lokalen Punkten (gegen den Uhrzeigersinn von außen gesehen), optional mit UV-Rechteck
  face(a, b, c, d, n, uvr) {
    const u = uvr || null;
    const uv = u ? [[u[0], u[1]], [u[2], u[1]], [u[2], u[3]], [u[0], u[3]]] : [[], [], [], []];
    this.v(a[0], a[1], a[2], n[0], n[1], n[2], uv[0][0], uv[0][1]);
    this.v(b[0], b[1], b[2], n[0], n[1], n[2], uv[1][0], uv[1][1]);
    this.v(c[0], c[1], c[2], n[0], n[1], n[2], uv[2][0], uv[2][1]);
    this.v(a[0], a[1], a[2], n[0], n[1], n[2], uv[0][0], uv[0][1]);
    this.v(c[0], c[1], c[2], n[0], n[1], n[2], uv[2][0], uv[2][1]);
    this.v(d[0], d[1], d[2], n[0], n[1], n[2], uv[3][0], uv[3][1]);
  }
  tri3(a, b, c) {
    let ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    this.v(a[0], a[1], a[2], nx, ny, nz); this.v(b[0], b[1], b[2], nx, ny, nz); this.v(c[0], c[1], c[2], nx, ny, nz);
  }
  // Quader: Mitte (cx, cz), Unterkante y0
  box(cx, y0, cz, sx, sy, sz, skip = 0) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, z0 = cz - sz / 2, z1 = cz + sz / 2, y1 = y0 + sy;
    if (!(skip & 1)) this.face([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]); // oben
    if (!(skip & 2)) this.face([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]); // unten
    this.face([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]); // vorne (+z)
    this.face([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]); // hinten
    this.face([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]);
    this.face([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
  }
  // Schräger Balken zwischen zwei lokalen Punkten (quadratischer Querschnitt)
  beam(ax, ay, az, bx, by, bz, w, h = w) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.hypot(dx, dy, dz) || 1e-6;
    const fx = dx / len, fy = dy / len, fz = dz / len;
    // Seitenvektor waagrecht
    let sx = -fz, sz = fx; let sl = Math.hypot(sx, sz);
    if (sl < 1e-4) { sx = 1; sz = 0; sl = 1; }
    sx /= sl; sz /= sl;
    // Hochvektor
    const ux = fy * sz - 0, uy = fz * sx - fx * sz, uz = 0 - fy * sx;
    const hw = w / 2, hh = h / 2;
    const P = (t, a, b) => [ax + dx * t + sx * a + ux * b, ay + dy * t + uy * b, az + dz * t + sz * a + uz * b];
    const c = [P(0, -hw, -hh), P(0, hw, -hh), P(0, hw, hh), P(0, -hw, hh), P(1, -hw, -hh), P(1, hw, -hh), P(1, hw, hh), P(1, -hw, hh)];
    const quad = (a, b, cc, d) => { this.tri3(a, b, cc); this.tri3(a, cc, d); };
    quad(c[0], c[1], c[5], c[4]);
    quad(c[1], c[2], c[6], c[5]);
    quad(c[2], c[3], c[7], c[6]);
    quad(c[3], c[0], c[4], c[7]);
    quad(c[4], c[5], c[6], c[7]);
    quad(c[0], c[3], c[2], c[1]);
  }
  // Zylinder (senkrecht) mit Radius unten r0 und oben r1
  cyl(cx, y0, cz, r0, r1, h, seg = 6, caps = 1) {
    const y1 = y0 + h;
    const slope = (r0 - r1) / h;
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const nl0 = Math.hypot(1, slope), n0 = [c0 / nl0, slope / nl0, s0 / nl0], n1 = [c1 / nl0, slope / nl0, s1 / nl0];
      const A = [cx + c0 * r0, y0, cz + s0 * r0], B = [cx + c1 * r0, y0, cz + s1 * r0], C = [cx + c1 * r1, y1, cz + s1 * r1], D = [cx + c0 * r1, y1, cz + s0 * r1];
      this.v(A[0], A[1], A[2], n0[0], n0[1], n0[2]); this.v(D[0], D[1], D[2], n0[0], n0[1], n0[2]); this.v(C[0], C[1], C[2], n1[0], n1[1], n1[2]);
      this.v(A[0], A[1], A[2], n0[0], n0[1], n0[2]); this.v(C[0], C[1], C[2], n1[0], n1[1], n1[2]); this.v(B[0], B[1], B[2], n1[0], n1[1], n1[2]);
      if (caps & 1 && r1 > 0) { this.v(cx, y1, cz, 0, 1, 0); this.v(C[0], C[1], C[2], 0, 1, 0); this.v(D[0], D[1], D[2], 0, 1, 0); }
      if (caps & 2 && r0 > 0) { this.v(cx, y0, cz, 0, -1, 0); this.v(A[0], A[1], A[2], 0, -1, 0); this.v(B[0], B[1], B[2], 0, -1, 0); }
    }
  }
  // Liegender Zylinder entlang lokaler x-Achse (Räder, Rohre)
  cylX(cx, cy, cz, r, len, seg = 8) {
    const x0 = cx - len / 2, x1 = cx + len / 2;
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const A = [x0, cy + c0 * r, cz + s0 * r], B = [x1, cy + c0 * r, cz + s0 * r], C = [x1, cy + c1 * r, cz + s1 * r], D = [x0, cy + c1 * r, cz + s1 * r];
      this.v(A[0], A[1], A[2], 0, c0, s0); this.v(C[0], C[1], C[2], 0, c1, s1); this.v(B[0], B[1], B[2], 0, c0, s0);
      this.v(A[0], A[1], A[2], 0, c0, s0); this.v(D[0], D[1], D[2], 0, c1, s1); this.v(C[0], C[1], C[2], 0, c1, s1);
      this.v(x1, cy, cz, 1, 0, 0); this.v(B[0], B[1], B[2], 1, 0, 0); this.v(C[0], C[1], C[2], 1, 0, 0);
      this.v(x0, cy, cz, -1, 0, 0); this.v(D[0], D[1], D[2], -1, 0, 0); this.v(A[0], A[1], A[2], -1, 0, 0);
    }
  }
  // Scheibe (für Ampel-Linsen) in der lokalen xy-Ebene, Blick nach +z
  disc(cx, cy, cz, r, seg = 8, uvr = null) {
    const um = uvr ? (uvr[0] + uvr[2]) / 2 : undefined, vm = uvr ? (uvr[1] + uvr[3]) / 2 : undefined;
    const ur = uvr ? (uvr[2] - uvr[0]) / 2 : 0, vr = uvr ? (uvr[3] - uvr[1]) / 2 : 0;
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2;
      this.v(cx, cy, cz, 0, 0, 1, um, vm);
      this.v(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cz, 0, 0, 1, uvr ? um + Math.cos(a0) * ur : undefined, uvr ? vm + Math.sin(a0) * vr : undefined);
      this.v(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, cz, 0, 0, 1, uvr ? um + Math.cos(a1) * ur : undefined, uvr ? vm + Math.sin(a1) * vr : undefined);
    }
  }
  // Ikosaeder-Klumpen (Baumkronen), smooth, leicht verbeult
  blob(cx, cy, cz, rx, ry, rz, seed, detail = 1, flat = true) {
    const ico = icoData(detail);
    const pts = ico.v;
    const jit = (i) => 0.86 + hash2(i, seed | 0, 7) * 0.26;
    const P = pts.map((p, i) => { const s = jit(i); return [cx + p[0] * rx * s, cy + p[1] * ry * s, cz + p[2] * rz * s]; });
    for (let f = 0; f < ico.f.length; f += 3) {
      const a = P[ico.f[f]], b = P[ico.f[f + 1]], c = P[ico.f[f + 2]];
      if (flat) { this.tri3(a, b, c); continue; }
      for (let k = 0; k < 3; k++) {
        const p = pts[ico.f[f + k]], q = P[ico.f[f + k]];
        this.v(q[0], q[1], q[2], p[0], p[1], p[2]);
      }
    }
  }
}

// Ikosaeder (indiziert, normierte Punkte) als Datensatz
const ICO = {};
function icoData(detail) {
  if (ICO[detail]) return ICO[detail];
  const g = new THREE.IcosahedronGeometry(1, detail);
  const pos = g.attributes.position;
  const v = [], f = [];
  const key = (x, y, z) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
  const map = new Map();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = key(x, y, z);
    let id = map.get(k);
    if (id === undefined) { id = v.length; v.push([x, y, z]); map.set(k, id); }
    f.push(id);
  }
  g.dispose();
  ICO[detail] = { v, f };
  return ICO[detail];
}

// ---------------------------------------------------------------- Schilder-Atlas
const SA = 1024;
export const SIGN = {}; // Name → [u0, v0, u1, v1]
function reg(name, x, y, w, h) { SIGN[name] = [x / SA, 1 - (y + h) / SA, (x + w) / SA, 1 - y / SA]; }

const STREET_NAMES = ['Hauptstraße', 'Bahnhofstraße', 'Lindenallee', 'Goethestraße', 'Schillerstraße', 'Gartenweg', 'Kirchgasse', 'Mühlenweg',
  'Am Markt', 'Rosenstraße', 'Schulstraße', 'Bergstraße', 'Ahornweg', 'Brunnengasse', 'Wiesenstraße', 'Uferstraße'];
const FONT = '"Barlow Condensed", "DIN Condensed", "Arial Narrow", "Liberation Sans Narrow", "DejaVu Sans Condensed", Arial, sans-serif';

function drawSignAtlas(cityName) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = SA;
  const x = cv.getContext('2d');
  x.clearRect(0, 0, SA, SA);
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 32, 32);
  reg('white', 0, 0, 32, 32);
  // Linse: hell in der Mitte, Ring außen
  {
    const g = x.createRadialGradient(48, 16, 0, 48, 16, 16);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#f2f2f2'); g.addColorStop(0.8, '#b8b8b8'); g.addColorStop(1, '#5a5a5a');
    x.fillStyle = g; x.fillRect(32, 0, 32, 32);
    reg('lens', 32, 0, 32, 32);
    const g2 = x.createLinearGradient(0, 32, 0, 64);
    g2.addColorStop(0, '#ffffff'); g2.addColorStop(1, '#d8d4cc');
    x.fillStyle = g2; x.fillRect(64, 0, 32, 32);
    reg('diffuser', 64, 0, 32, 32);
    // Glasfläche (Haltestelle): leicht bläulich
    x.fillStyle = '#d9ecf5'; x.fillRect(96, 0, 32, 32);
    reg('glass', 96, 0, 32, 32);
  }
  const cell = (name, cx, cy, fn) => { x.save(); x.translate(cx, cy); fn(x); x.restore(); reg(name, cx, cy, 128, 128); };
  const tri = (c, down, border, fill, inner) => {
    c.beginPath();
    if (down) { c.moveTo(8, 14); c.lineTo(120, 14); c.lineTo(64, 116); } else { c.moveTo(64, 10); c.lineTo(122, 112); c.lineTo(6, 112); }
    c.closePath(); c.fillStyle = border; c.fill();
    c.beginPath();
    if (down) { c.moveTo(26, 24); c.lineTo(102, 24); c.lineTo(64, 94); } else { c.moveTo(64, 32); c.lineTo(104, 102); c.lineTo(24, 102); }
    c.closePath(); c.fillStyle = fill; c.fill();
    if (inner) inner(c);
  };
  // Zeichen-Zellen bleiben außerhalb der Form durchsichtig (Alpha-Test im Material)
  cell('yield', 128, 0, (c) => tri(c, true, '#c8102e', '#ffffff'));
  cell('stop', 256, 0, (c) => {
    c.beginPath();
    for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + (k / 8) * Math.PI * 2; c.lineTo(64 + Math.cos(a) * 60, 64 + Math.sin(a) * 60); }
    c.closePath(); c.fillStyle = '#ffffff'; c.fill();
    c.beginPath();
    for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + (k / 8) * Math.PI * 2; c.lineTo(64 + Math.cos(a) * 54, 64 + Math.sin(a) * 54); }
    c.closePath(); c.fillStyle = '#c8102e'; c.fill();
    c.fillStyle = '#ffffff'; c.font = `bold 38px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('STOP', 64, 66);
  });
  cell('prio', 384, 0, (c) => {
    c.translate(64, 64); c.rotate(Math.PI / 4);
    c.fillStyle = '#ffffff'; c.fillRect(-44, -44, 88, 88);
    c.fillStyle = '#2b2b2b'; c.fillRect(-40, -40, 80, 80);
    c.fillStyle = '#ffffff'; c.fillRect(-36, -36, 72, 72);
    c.fillStyle = '#f2c200'; c.fillRect(-26, -26, 52, 52);
  });
  const roundSign = (c, ring, fill, txt, txtCol, size = 54) => {
    c.beginPath(); c.arc(64, 64, 60, 0, Math.PI * 2); c.fillStyle = '#ffffff'; c.fill();
    c.beginPath(); c.arc(64, 64, 56, 0, Math.PI * 2); c.fillStyle = ring; c.fill();
    c.beginPath(); c.arc(64, 64, 44, 0, Math.PI * 2); c.fillStyle = fill; c.fill();
    if (txt) { c.fillStyle = txtCol; c.font = `bold ${size}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, 64, 67); }
  };
  cell('zone30', 512, 0, (c) => {
    c.fillStyle = '#ffffff'; c.fillRect(4, 4, 120, 120);
    c.strokeStyle = '#2b2b2b'; c.lineWidth = 3; c.strokeRect(6, 6, 116, 116);
    c.beginPath(); c.arc(64, 54, 36, 0, Math.PI * 2); c.fillStyle = '#c8102e'; c.fill();
    c.beginPath(); c.arc(64, 54, 28, 0, Math.PI * 2); c.fillStyle = '#ffffff'; c.fill();
    c.fillStyle = '#111'; c.font = `bold 34px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('30', 64, 56);
    c.font = `bold 24px ${FONT}`; c.fillText('ZONE', 64, 108);
  });
  cell('speed50', 640, 0, (c) => roundSign(c, '#c8102e', '#ffffff', '50', '#111'));
  cell('zebra', 768, 0, (c) => {
    c.fillStyle = '#ffffff'; c.fillRect(4, 4, 120, 120);
    c.fillStyle = '#1f5fae'; c.fillRect(10, 10, 108, 108);
    tri(c, false, '#ffffff', '#ffffff', (cc) => {
      cc.fillStyle = '#111';
      for (let k = 0; k < 4; k++) cc.fillRect(36 + k * 16, 88, 9, 12);
      cc.beginPath(); cc.arc(64, 52, 6, 0, Math.PI * 2); cc.fill();
      cc.fillRect(60, 58, 8, 20);
      cc.fillRect(52, 76, 7, 12); cc.fillRect(69, 76, 7, 12);
    });
  });
  cell('busH', 896, 0, (c) => {
    c.beginPath(); c.arc(64, 64, 60, 0, Math.PI * 2); c.fillStyle = '#f2c200'; c.fill();
    c.beginPath(); c.arc(64, 64, 52, 0, Math.PI * 2); c.lineWidth = 6; c.strokeStyle = '#1e8a3a'; c.stroke();
    c.fillStyle = '#1e8a3a'; c.font = `bold 70px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('H', 64, 68);
  });
  cell('parkP', 0, 128, (c) => {
    c.fillStyle = '#ffffff'; c.fillRect(4, 4, 120, 120); c.fillStyle = '#1f5fae'; c.fillRect(10, 10, 108, 108);
    c.fillStyle = '#fff'; c.font = `bold 90px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('P', 64, 70);
  });
  cell('noentry', 128, 128, (c) => {
    c.beginPath(); c.arc(64, 64, 60, 0, Math.PI * 2); c.fillStyle = '#ffffff'; c.fill();
    c.beginPath(); c.arc(64, 64, 56, 0, Math.PI * 2); c.fillStyle = '#c8102e'; c.fill();
    c.fillStyle = '#ffffff'; c.fillRect(22, 54, 84, 20);
  });
  cell('autobahn', 256, 128, (c) => {
    c.fillStyle = '#ffffff'; c.fillRect(4, 4, 120, 120); c.fillStyle = '#1f5fae'; c.fillRect(10, 10, 108, 108);
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(30, 110); c.lineTo(54, 34); c.lineTo(60, 34); c.lineTo(48, 110); c.fill();
    c.beginPath(); c.moveTo(98, 110); c.lineTo(74, 34); c.lineTo(68, 34); c.lineTo(80, 110); c.fill();
    c.fillRect(30, 30, 68, 10);
  });
  cell('spiel', 384, 128, (c) => {
    c.fillStyle = '#ffffff'; c.fillRect(4, 4, 120, 120); c.fillStyle = '#1f5fae'; c.fillRect(10, 10, 108, 108);
    c.fillStyle = '#fff';
    c.fillRect(18, 96, 92, 6);
    c.beginPath(); c.arc(40, 50, 7, 0, Math.PI * 2); c.fill(); c.fillRect(36, 58, 8, 26);
    c.fillRect(70, 70, 26, 16); c.beginPath(); c.arc(76, 90, 5, 0, Math.PI * 2); c.arc(92, 90, 5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(60, 82, 6, 0, Math.PI * 2); c.fill();
  });
  // Fußgänger-Symbole für Ampeln (Linsen)
  const ped = (c, col, walk) => {
    c.fillStyle = '#111'; c.fillRect(0, 0, 128, 128);
    c.fillStyle = col;
    c.beginPath(); c.arc(64, 26, 11, 0, Math.PI * 2); c.fill();
    if (walk) {
      c.beginPath(); c.moveTo(56, 40); c.lineTo(74, 40); c.lineTo(80, 74); c.lineTo(96, 112); c.lineTo(84, 116); c.lineTo(66, 82); c.lineTo(48, 116); c.lineTo(36, 110); c.lineTo(52, 74); c.closePath(); c.fill();
    } else {
      c.fillRect(52, 40, 24, 44); c.fillRect(52, 80, 9, 36); c.fillRect(67, 80, 9, 36); c.fillRect(42, 42, 8, 34); c.fillRect(78, 42, 8, 34);
    }
  };
  cell('pedRed', 512, 128, (c) => ped(c, '#ffffff', false));
  cell('pedGreen', 640, 128, (c) => ped(c, '#ffffff', true));
  // Fahrtrichtungspfeil (für Markierungs-Vorschau nicht nötig), Kanaldeckel-Muster
  cell('manhole', 768, 128, (c) => {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, 128, 128);
  });
  // Straßennamen (weiße Schilder mit schwarzer Schrift)
  for (let k = 0; k < 16; k++) {
    const px = (k % 4) * 256, py = 256 + Math.floor(k / 4) * 64;
    x.fillStyle = '#1b1b1b'; x.fillRect(px, py, 256, 64);
    x.fillStyle = '#f7f7f2'; x.fillRect(px + 4, py + 4, 248, 56);
    x.strokeStyle = '#1b1b1b'; x.lineWidth = 3; x.strokeRect(px + 9, py + 9, 238, 46);
    x.fillStyle = '#111'; x.font = `600 34px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(STREET_NAMES[k], px + 128, py + 34, 220);
    reg('name' + k, px, py, 256, 64);
  }
  // Autobahn-Wegweiser (blau)
  const blue = (px, py, w, h, lines, arrow) => {
    x.fillStyle = '#ffffff'; x.fillRect(px, py, w, h);
    x.fillStyle = '#1f5fae'; x.fillRect(px + 5, py + 5, w - 10, h - 10);
    x.fillStyle = '#ffffff'; x.textAlign = 'left'; x.textBaseline = 'middle';
    lines.forEach((ln, i) => { x.font = `600 ${i === 0 ? 46 : 36}px ${FONT}`; x.fillText(ln, px + 24, py + 36 + i * 46, w - 120); });
    if (arrow === 'up') {
      x.beginPath(); x.moveTo(px + w - 60, py + 22); x.lineTo(px + w - 30, py + 60); x.lineTo(px + w - 50, py + 60); x.lineTo(px + w - 50, py + 106); x.lineTo(px + w - 70, py + 106); x.lineTo(px + w - 70, py + 60); x.lineTo(px + w - 90, py + 60); x.closePath(); x.fill();
    } else if (arrow === 'right') {
      x.save(); x.translate(px + w - 60, py + 64); x.rotate(Math.PI / 4);
      x.beginPath(); x.moveTo(0, -42); x.lineTo(30, -4); x.lineTo(10, -4); x.lineTo(10, 40); x.lineTo(-10, 40); x.lineTo(-10, -4); x.lineTo(-30, -4); x.closePath(); x.fill();
      x.restore();
    }
  };
  blue(0, 512, 512, 128, [cityName || 'Zentrum', 'Zentrum · Messe'], 'up');
  reg('gantryA', 0, 512, 512, 128);
  blue(512, 512, 512, 128, ['Ausfahrt', 'Industriegebiet'], 'right');
  reg('gantryB', 512, 512, 512, 128);
  blue(0, 640, 512, 128, ['Umland', 'Flughafen · Hafen'], 'up');
  reg('gantryC', 0, 640, 512, 128);
  // Ortstafel (gelb)
  {
    const px = 512, py = 640, w = 384, h = 128;
    x.fillStyle = '#111'; x.fillRect(px, py, w, h);
    x.fillStyle = '#f2c200'; x.fillRect(px + 5, py + 5, w - 10, h - 10);
    x.strokeStyle = '#111'; x.lineWidth = 4; x.strokeRect(px + 12, py + 12, w - 24, h - 24);
    x.fillStyle = '#111'; x.font = `bold 52px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(cityName || 'Stadtpuls', px + w / 2, py + 54, w - 50);
    x.font = `500 24px ${FONT}`; x.fillText('Kreisfreie Stadt', px + w / 2, py + 96);
    reg('ortstafel', px, py, w, h);
  }
  // Werbeplakate (Hochformat 128×256)
  const posters = [
    ['#c8202a', '#ffd23f', 'Mêrdîn’s', 'DÖNER', 'der cheesyste der Stadt'],
    ['#1b2a4a', '#ff5a7a', 'PULSBAHN', 'im Takt', 'Steig ein!'],
    ['#2f8a52', '#e9f5e0', 'STADTWERKE', 'Strom', 'von hier'],
    ['#2b2140', '#ffcf5a', 'KINO', 'Heute', 'Die Stadt der Zukunft'],
    ['#f29b30', '#ffffff', 'SOMMER', 'FEST', 'am Marktplatz'],
    ['#e8e2d4', '#8a3b2e', 'MUSEUM', 'Neue', 'Ausstellung'],
    ['#3aa0d8', '#ffffff', 'ZOO', 'Pinguine', 'sind da!'],
    ['#6b3fa0', '#ffe6ff', 'KONZERT', 'Samstag', 'Stadthalle'],
  ];
  posters.forEach(([bg, fg, a, b, cc], k) => {
    const px = k * 128, py = 768;
    const gr = x.createLinearGradient(0, py, 0, py + 256);
    gr.addColorStop(0, bg); gr.addColorStop(1, shade(bg, -0.25));
    x.fillStyle = gr; x.fillRect(px, py, 128, 256);
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `bold 26px ${FONT}`; x.fillText(a, px + 64, py + 40, 116);
    x.font = `bold 40px ${FONT}`; x.fillText(b, px + 64, py + 128, 118);
    x.font = `500 17px ${FONT}`; x.fillText(cc, px + 64, py + 214, 118);
    // Motiv
    x.globalAlpha = 0.85;
    if (k === 0) { x.fillStyle = '#ffd23f'; x.font = `bold 64px ${FONT}`; x.fillText('M', px + 64, py + 82); }
    else if (k === 1) { ['#e8543f', '#2f8fe0', '#f2b01e', '#22a866'].forEach((c, j) => { x.fillStyle = c; x.beginPath(); x.arc(px + 28 + j * 24, py + 84, 9, 0, Math.PI * 2); x.fill(); }); }
    else if (k === 2) { x.fillStyle = '#ffe15a'; x.beginPath(); x.moveTo(px + 70, py + 62); x.lineTo(px + 50, py + 92); x.lineTo(px + 64, py + 92); x.lineTo(px + 56, py + 112); x.lineTo(px + 80, py + 80); x.lineTo(px + 66, py + 80); x.closePath(); x.fill(); }
    else { x.fillStyle = fg; x.fillRect(px + 30, py + 166, 68, 4); }
    x.globalAlpha = 1;
    x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 4; x.strokeRect(px + 2, py + 2, 124, 252);
    reg('poster' + k, px, py, 128, 256);
  });
  // Fahrplan-Kasten
  x.fillStyle = '#f4f4f0'; x.fillRect(896, 640, 128, 128);
  x.fillStyle = '#1e8a3a'; x.fillRect(896, 640, 128, 22);
  x.fillStyle = '#555';
  for (let k = 0; k < 9; k++) x.fillRect(906, 672 + k * 10, 60 + ((k * 37) % 40), 4);
  reg('timetable', 896, 640, 128, 128);
  return cv;
}

function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, f * 0.5);
  return '#' + c.getHexString();
}

// ---------------------------------------------------------------- Materialien (eigene)
export const sigTime = { value: 0 };
export const SIGNAL_PERIOD = 20;

// Zustand einer Ampel (wie im Shader): phase 0..1 (pro Kreuzung), axis 0 = Nord-Süd, 1 = Ost-West, time in Sekunden (Spielzeit/48)
// Ist eine Linse an? slot 0 rot, 1 gelb, 2 grün, 3 Fußgänger rot, 4 Fußgänger grün (wie im Shader)
export function lensOn(time, phase, axis, slot) {
  const P = SIGNAL_PERIOD;
  let t = (((time / P + phase) % 1) + 1) % 1 * P;
  if (axis) t = (t + P / 2) % P;
  if (slot === 0) return t >= 10;
  if (slot === 1) return (t >= 8 && t < 10) || t >= 19;
  if (slot === 2) return t < 8;
  const pedGreen = t >= 10.5 && t < 18.5;
  return slot === 4 ? pedGreen : !pedGreen;
}

export function signalState(time, phase, axis) {
  const P = SIGNAL_PERIOD;
  let t = (((time / P + phase) % 1) + 1) % 1 * P;
  if (axis) t = (t + P / 2) % P;
  if (t < 8) return 'green';
  if (t < 10) return 'yellow';
  if (t >= 19) return 'redyellow';
  return 'red';
}

function patchSnowWet(mat, opts = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSnow = shared.uSnow;
    sh.uniforms.uWet = shared.uWet;
    sh.uniforms.uNight = shared.uNight;
    sh.uniforms.uSig = sigTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
${opts.sig ? 'attribute vec4 aSig;\nattribute vec2 aPh;\nvarying vec4 vSig;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
${opts.sig ? 'vSig = aSig; vSig.y += aPh.x; vSig.z += aPh.y;' : ''}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uSnow;
uniform float uWet;
uniform float uNight;
uniform float uSig;
${opts.sig ? 'varying vec4 vSig;' : ''}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.18, uWet * ${opts.paint ? '0.8' : '0.5'});`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
${opts.paint ? 'diffuseColor.a *= 1.0 - 0.85 * uSnow;' : ''}
${opts.sig ? `
{
  float kind = vSig.x;
  vec3 base = diffuseColor.rgb;
  float nk = smoothstep(0.0, 1.0, uNight);
  if (kind > 0.5 && kind < 1.5) {
    // Lampenschirm: tags hellgrau, nachts warm leuchtend
    diffuseColor.rgb = mix(base, base * 0.25, nk);
    totalEmissiveRadiance += vec3(1.0, 0.8, 0.52) * (0.04 + 3.2 * nk);
  } else if (kind > 1.5 && kind < 2.5) {
    float P = ${SIGNAL_PERIOD.toFixed(1)};
    float t = fract(uSig / P + vSig.y) * P;
    float ta = vSig.z > 0.5 ? mod(t + P * 0.5, P) : t;
    float slot = vSig.w;
    float on = 0.0;
    if (slot < 0.5) on = step(10.0, ta);
    else if (slot < 1.5) on = step(8.0, ta) * (1.0 - step(10.0, ta)) + step(19.0, ta);
    else if (slot < 2.5) on = 1.0 - step(8.0, ta);
    else if (slot < 3.5) on = 1.0 - step(10.5, ta) * (1.0 - step(18.5, ta));
    else on = step(10.5, ta) * (1.0 - step(18.5, ta));
    diffuseColor.rgb = base * mix(0.1, 0.9, on);
    totalEmissiveRadiance += base * on * (1.4 + 2.6 * nk);
  } else if (kind > 2.5 && kind < 3.5) {
    // hinterleuchtetes Plakat / Schild
    totalEmissiveRadiance += base * (0.03 + 0.85 * nk);
  } else if (kind > 3.5) {
    totalEmissiveRadiance += base * 1.1;
  }
}` : ''}`);
  };
  mat.customProgramCacheKey = () => 'g8' + (opts.sig ? 's' : '') + (opts.paint ? 'p' : '');
}

function makeNoiseTexture() {
  const N = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const c = cv.getContext('2d');
  const img = c.createImageData(N, N);
  // mehrlagiges Wertrauschen, kachelbar
  const lay = (s, x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const h = (a, b) => hash2(((a % s) + s) % s, ((b % s) + s) % s, s * 13);
    const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
    const a = h(xi, yi), b = h(xi + 1, yi), cc = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (cc - a) * w + (a - b - cc + d) * u * w;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = lay(8, x / 32, y / 32) * 0.5 + lay(32, x / 8, y / 8) * 0.3 + lay(128, x / 2, y / 2) * 0.2;
    const k = (y * N + x) * 4;
    const a = Math.max(0, Math.min(1, 0.55 + (v - 0.5) * 1.6)) * 255;
    img.data[k] = img.data[k + 1] = img.data[k + 2] = a; img.data[k + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, 8, 8); // konstantes Alpha (Glas, Vollflächen)
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Atlas-Material für Straßenblöcke. Solange atlas.js nur die Startfassung („atlasStub") liefert, nutzen die Straßen
// eine eigene, farbrichtige Fassung mit prozeduralen Mustern (Asphaltkorn, Gehwegplatten, Pflaster, Granitbord,
// Quadermauerwerk, Rasen). Sobald G2 den echten Textur-Atlas liefert, wird dieser verwendet.
const CAT = {
  asphalt: 1, asphalt_dark: 1, tarmac: 1, sidewalk: 2, pavers: 3, curb: 4, trim_stone: 4, grass: 5, grass_dry: 5, sports_turf: 5,
  stone_sandstone: 6, stone_grey: 6, stone_dark: 6, concrete: 7, concrete_dark: 7, concrete_panel: 7,
  leaves_green: 8, leaves_dark: 8, leaves_light: 8, leaves_autumn: 8, hedge: 8, bark: 9, dirt: 9, gravel: 9,
};
function makeRoadAtlas() {
  const n = ATLAS_NAMES.length;
  const data = new Uint8Array(n * 2 * 4);
  ATLAS_NAMES.forEach((name, i) => {
    const [color, rough, metal] = MATERIAL_DEFS[name];
    data[i * 4] = (color >> 16) & 255; data[i * 4 + 1] = (color >> 8) & 255; data[i * 4 + 2] = color & 255; data[i * 4 + 3] = Math.round(rough * 255);
    const k = (n + i) * 4;
    data[k] = CAT[name] || 0; data[k + 1] = Math.round(metal * 255); data[k + 3] = 255;
  });
  const tex = new THREE.DataTexture(data, n, 2, THREE.RGBAFormat);
  tex.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uG8Atlas = { value: tex };
    sh.uniforms.uSnow = shared.uSnow;
    sh.uniforms.uWet = shared.uWet;
    sh.uniforms.uAutumn = shared.uAutumn;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aMat;
flat varying int vG8Mat;
varying vec3 vG8P;
varying vec3 vG8N;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vG8Mat = int(aMat + 0.5);
#ifdef USE_INSTANCING
vG8P = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
vG8N = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
#else
vG8P = (modelMatrix * vec4(transformed, 1.0)).xyz;
vG8N = normalize(mat3(modelMatrix) * objectNormal);
#endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D uG8Atlas;
uniform float uSnow;
uniform float uWet;
uniform float uAutumn;
flat varying int vG8Mat;
varying vec3 vG8P;
varying vec3 vG8N;
float g8h(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float g8n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(g8h(i), g8h(i + vec2(1.0, 0.0)), f.x), mix(g8h(i + vec2(0.0, 1.0)), g8h(i + vec2(1.0, 1.0)), f.x), f.y); }
float g8j(vec2 p, vec2 size, float w, out vec2 id) { vec2 q = p / size; id = floor(q); vec2 f = fract(q); vec2 d = min(f, 1.0 - f) * size; return smoothstep(0.0, w, min(d.x, d.y)); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
vec4 g8a = texelFetch(uG8Atlas, ivec2(vG8Mat, 0), 0);
vec4 g8b = texelFetch(uG8Atlas, ivec2(vG8Mat, 1), 0);
float g8cat = floor(g8b.r * 255.0 + 0.5);
vec3 g8nn = normalize(vG8N);
vec2 g8p = abs(g8nn.y) > 0.6 ? vG8P.xz : (abs(g8nn.x) > 0.6 ? vec2(vG8P.z, vG8P.y) : vG8P.xy);
float g8v = 1.0;
vec2 g8id;
if (g8cat == 1.0) {
  g8v = 0.84 + 0.2 * g8n(g8p * 90.0) + 0.14 * (g8n(g8p * 3.5) - 0.5) + 0.06 * (g8n(g8p * 0.6) - 0.5);
  g8v += step(0.972, g8h(floor(g8p * 170.0))) * 0.45;
} else if (g8cat == 2.0) {
  float j = g8j(g8p, vec2(0.05), 0.0028, g8id);
  g8v = (0.92 + 0.12 * g8h(g8id)) * mix(0.74, 1.0, j) * (0.95 + 0.1 * g8n(g8p * 26.0));
} else if (g8cat == 3.0) {
  vec2 q = g8p; q.x += step(0.5, fract(q.y / 0.044)) * 0.011;
  float j = g8j(q, vec2(0.022), 0.0035, g8id);
  g8v = (0.8 + 0.34 * g8h(g8id)) * mix(0.55, 1.0, j);
} else if (g8cat == 4.0) {
  float j = g8j(g8p, vec2(0.1), 0.0022, g8id);
  g8v = (0.92 + 0.1 * g8h(g8id)) * mix(0.78, 1.0, j) * (0.93 + 0.14 * g8n(g8p * 140.0));
} else if (g8cat == 5.0) {
  g8v = 0.8 + 0.28 * g8n(g8p * 16.0) + 0.12 * g8n(g8p * 75.0);
} else if (g8cat == 6.0) {
  vec2 q = g8p; q.x += step(0.5, fract(q.y / 0.07)) * 0.035;
  float j = g8j(q, vec2(0.07, 0.035), 0.0035, g8id);
  g8v = (0.84 + 0.22 * g8h(g8id)) * mix(0.66, 1.0, j) * (0.95 + 0.1 * g8n(g8p * 60.0));
} else if (g8cat == 7.0) {
  g8v = 0.9 + 0.12 * g8n(g8p * 22.0) + 0.06 * (g8n(g8p * 2.5) - 0.5);
} else if (g8cat == 8.0) {
  g8v = 0.82 + 0.34 * g8n(g8p * 28.0);
} else if (g8cat == 9.0) {
  g8v = 0.8 + 0.3 * g8n(g8p * 60.0);
}
float g8up = smoothstep(0.55, 0.85, g8nn.y);
diffuseColor.rgb *= pow(g8a.rgb, vec3(2.2)) * g8v;
if (g8cat == 8.0) {
  float hz = g8h(floor(vG8P.xz * 3.0));
  vec3 aut = mix(vec3(0.62, 0.3, 0.06), vec3(0.7, 0.52, 0.1), hz);
  diffuseColor.rgb = mix(diffuseColor.rgb, aut * (0.8 + 0.3 * g8v), uAutumn * smoothstep(0.15, 0.6, hz + uAutumn * 0.5));
  g8up = max(g8up, smoothstep(0.2, 0.7, g8nn.y) * 0.8);
}
diffuseColor.rgb *= 1.0 - 0.32 * uWet;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.92, 0.95), uSnow * g8up * (g8cat == 1.0 ? 0.3 : 0.92));`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(g8a.a, 0.16, uWet * g8up);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
metalnessFactor = g8b.g;`);
  };
  mat.customProgramCacheKey = () => 'g8atlas';
  return mat;
}
function solidMaterial() {
  const a = getAtlasMaterial();
  const key = a.customProgramCacheKey ? a.customProgramCacheKey() : '';
  return key === 'atlasStub' ? makeRoadAtlas() : a;
}

let MATS = null;
export function roadMaterials(renderer, cityName) {
  if (MATS && MATS.city === cityName) return MATS;
  const aniso = renderer ? renderer.capabilities.getMaxAnisotropy() : 4;
  const signTex = new THREE.CanvasTexture(drawSignAtlas(cityName));
  signTex.colorSpace = THREE.SRGBColorSpace;
  signTex.anisotropy = aniso;
  const noise = makeNoiseTexture();
  noise.anisotropy = aniso;
  const paint = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 0.72, metalness: 0, alphaMap: noise, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 });
  patchSnowWet(paint, { paint: true });
  const glow = new THREE.MeshStandardMaterial({ map: signTex, vertexColors: true, roughness: 0.5, metalness: 0.05, alphaTest: 0.5 });
  patchSnowWet(glow, { sig: true });
  const fog = { fogNear: { value: 100 }, fogFar: { value: 600 } };
  const light = new THREE.ShaderMaterial({
    uniforms: { uNight: shared.uNight, uWet: shared.uWet, ...fog },
    vertexShader: `attribute float aI; varying float vI; varying float vD;
void main(){ vI = aI; vec4 lp = vec4(position, 1.0);
#ifdef USE_INSTANCING
lp = instanceMatrix * lp;
#endif
vec4 mv = modelViewMatrix * lp; vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uNight; uniform float uWet; uniform float fogNear; uniform float fogFar; varying float vI; varying float vD;
void main(){ float f = 1.0 - smoothstep(fogNear, fogFar, vD); float k = vI * smoothstep(0.05, 0.6, uNight) * f * (1.0 + uWet * 0.7);
gl_FragColor = vec4(vec3(1.0, 0.74, 0.42) * k, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const tint = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.82, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -8 });
  MATS = { city: cityName, solid: MATS && MATS.solid ? MATS.solid : solidMaterial(), paint, glow, light, tint, signTex, noise, fog };
  return MATS;
}

// ---------------------------------------------------------------- Modelle
// ctx = { solid: Brush, detail: Brush, glow: Brush, light: Layer, lamps: [] }  – Positionen in Weltkoordinaten.

const WARM = [1, 0.86, 0.62];

// Lichtkegel + Lichtfleck unter einer Lampe
export function lightPool(L, x, y, z, gy, r = 0.34, k = 0.5, cone = true) {
  const seg = 14;
  // Lichtfleck (Ring mit Abfall)
  for (let s = 0; s < seg; s++) {
    const a0 = (s / seg) * Math.PI * 2, a1 = ((s + 1) / seg) * Math.PI * 2;
    const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    const yy = gy + 0.004;
    L.vl(x, yy, z, k); L.vl(x + c0 * r * 0.5, yy, z + s0 * r * 0.5, k * 0.5); L.vl(x + c1 * r * 0.5, yy, z + s1 * r * 0.5, k * 0.5);
    L.vl(x + c0 * r * 0.5, yy, z + s0 * r * 0.5, k * 0.5); L.vl(x + c0 * r, yy, z + s0 * r, 0); L.vl(x + c1 * r, yy, z + s1 * r, 0);
    L.vl(x + c0 * r * 0.5, yy, z + s0 * r * 0.5, k * 0.5); L.vl(x + c1 * r, yy, z + s1 * r, 0); L.vl(x + c1 * r * 0.5, yy, z + s1 * r * 0.5, k * 0.5);
  }
  if (!cone) return;
  // Kegel (offen), sehr schwach – wirkt mit Nebel/Bloom wie ein Lichtkegel
  const top = 0.02, bot = r * 0.62, kc = 0.085;
  for (let s = 0; s < 10; s++) {
    const a0 = (s / 10) * Math.PI * 2, a1 = ((s + 1) / 10) * Math.PI * 2;
    const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    L.vl(x + c0 * top, y, z + s0 * top, kc); L.vl(x + c1 * top, y, z + s1 * top, kc); L.vl(x + c1 * bot, gy + 0.01, z + s1 * bot, 0);
    L.vl(x + c0 * top, y, z + s0 * top, kc); L.vl(x + c1 * bot, gy + 0.01, z + s1 * bot, 0); L.vl(x + c0 * bot, gy + 0.01, z + s0 * bot, 0);
  }
}

// Moderne Straßenlaterne (Mast mit Ausleger zur Straße hin = lokales +z). Höhe ~6,5 m.
export function streetLamp(ctx, x, y, z, yaw, opts = {}) {
  const b = ctx.solid.at(x, y, z, yaw);
  const H = opts.h || 0.62, arm = opts.arm ?? 0.11;
  b.m('metal_dark');
  b.cyl(0, 0, 0, 0.016, 0.014, 0.05, 6, 1);
  b.cyl(0, 0.05, 0, 0.011, 0.007, H - 0.05, 6, 0);
  // gebogener Ausleger
  b.beam(0, H - 0.03, 0, 0, H + 0.01, arm * 0.45, 0.009);
  b.beam(0, H + 0.01, arm * 0.45, 0, H + 0.012, arm, 0.008);
  // Leuchtenkopf
  b.m('metal_light');
  b.box(0, H - 0.006, arm + 0.02, 0.034, 0.016, 0.07);
  const gl = ctx.glow.at(x, y, z, yaw).color(1, 0.97, 0.9).signal(1);
  gl.face([-0.014, H - 0.0065, arm + 0.052], [0.014, H - 0.0065, arm + 0.052], [0.014, H - 0.0065, arm - 0.012], [-0.014, H - 0.0065, arm - 0.012], [0, -1, 0], SIGN.diffuser);
  const hx = b.wx(0, arm + 0.02), hz = b.wz(0, arm + 0.02);
  ctx.lamps.push(hx, y + H - 0.01, hz);
  if (ctx.pools) ctx.pools.push(hx, y + H - 0.01, hz, opts.pool || 0.36, 1);
  else if (ctx.light) lightPool(ctx.light, hx, y + H - 0.01, hz, opts.ground ?? y, opts.pool || 0.36, 0.5);
}

// Doppelausleger im Mittelstreifen (Allee/Autobahn)
export function doubleLamp(ctx, x, y, z, yaw, opts = {}) {
  const b = ctx.solid.at(x, y, z, yaw);
  const H = opts.h || 0.8, arm = opts.arm || 0.16;
  b.m('metal_light');
  b.cyl(0, 0, 0, 0.018, 0.016, 0.05, 6, 1);
  b.cyl(0, 0.05, 0, 0.013, 0.008, H - 0.05, 6, 0);
  for (const sd of [-1, 1]) {
    b.m('metal_light');
    b.beam(0, H - 0.04, 0, 0, H + 0.005, sd * arm * 0.5, 0.009);
    b.beam(0, H + 0.005, sd * arm * 0.5, 0, H + 0.01, sd * arm, 0.008);
    b.box(0, H - 0.008, sd * (arm + 0.02), 0.036, 0.016, 0.074);
    const gl = ctx.glow.at(x, y, z, yaw).color(1, 0.97, 0.9).signal(1);
    const zc = sd * (arm + 0.02);
    gl.face([-0.015, H - 0.0085, zc + 0.033], [0.015, H - 0.0085, zc + 0.033], [0.015, H - 0.0085, zc - 0.033], [-0.015, H - 0.0085, zc - 0.033], [0, -1, 0], SIGN.diffuser);
    const hx = b.wx(0, zc), hz = b.wz(0, zc);
    ctx.lamps.push(hx, y + H - 0.01, hz);
    if (ctx.pools) ctx.pools.push(hx, y + H - 0.01, hz, opts.pool || 0.42, 1);
    else if (ctx.light) lightPool(ctx.light, hx, y + H - 0.01, hz, opts.ground ?? y, opts.pool || 0.42, 0.5);
  }
}

// Historische Laterne (Gassen, Brücken, Plätze)
export function lantern(ctx, x, y, z, opts = {}) {
  const b = ctx.solid.at(x, y, z, 0);
  const H = opts.h || 0.38;
  b.m(opts.mat || 'metal_dark');
  b.cyl(0, 0, 0, 0.02, 0.016, 0.03, 8, 1);
  b.cyl(0, 0.03, 0, 0.012, 0.012, 0.02, 8, 1);
  b.cyl(0, 0.05, 0, 0.008, 0.006, H - 0.08, 8, 0);
  b.cyl(0, H - 0.03, 0, 0.012, 0.018, 0.012, 6, 3);
  // Laternenkopf: sechseckiger Glaskörper + Dach
  const gl = ctx.glow.at(x, y, z, 0).color(1, 0.95, 0.82).signal(1);
  gl.cyl(0, H - 0.018, 0, 0.019, 0.026, 0.05, 6, 0);
  b.m(opts.mat || 'metal_dark');
  b.cyl(0, H + 0.032, 0, 0.032, 0.006, 0.026, 6, 3);
  b.cyl(0, H + 0.058, 0, 0.005, 0.001, 0.016, 4, 0);
  ctx.lamps.push(x, y + H + 0.008, z);
  if (ctx.pools) ctx.pools.push(x, y + H, z, opts.pool || 0.3, 1);
  else if (ctx.light) lightPool(ctx.light, x, y + H, z, opts.ground ?? y, opts.pool || 0.3, 0.45);
}

// Hoher Autobahn-Mast mit zwei Auslegern
export function highwayMast(ctx, x, y, z, yaw) {
  doubleLamp(ctx, x, y, z, yaw, { h: 1.05, arm: 0.22, pool: 0.5 });
}

// Ampel: Mast am Fahrbahnrand, Signalgeber schaut nach lokal +z (zum ankommenden Verkehr).
// axis: 0/1, phase: 0..1, armLen: Ausleger über die Fahrbahn (lokal −x), ped: Fußgängersignal (Blick lokal ±x)
export function trafficLight(ctx, x, y, z, yaw, axis, phase, opts = {}) {
  const b = ctx.solid.at(x, y, z, yaw);
  const H = opts.h || 0.36;
  b.m('metal_dark');
  b.cyl(0, 0, 0, 0.013, 0.011, 0.03, 6, 1);
  b.cyl(0, 0.03, 0, 0.0085, 0.0075, H - 0.03, 6, 1);
  const head = (hx, hy, hz, sc = 1) => {
    const scale = sc * 1.35; // spielgerecht etwas größer als real
    // Gehäuse + Kontrasttafel mit weißem Rand
    b.m('trim_dark');
    b.box(hx, hy, hz, 0.026 * scale, 0.082 * scale, 0.022 * scale);
    b.m('paint_white');
    b.box(hx, hy - 0.007 * scale, hz - 0.0125 * scale, 0.054 * scale, 0.098 * scale, 0.002);
    b.m('rubber');
    b.box(hx, hy - 0.0055 * scale, hz - 0.0115 * scale, 0.049 * scale, 0.093 * scale, 0.002);
    const g = ctx.glow.at(x, y, z, yaw);
    const cols = [[1, 0.16, 0.1], [1, 0.62, 0.08], [0.15, 1, 0.45]];
    for (let k = 0; k < 3; k++) {
      const ly = hy + (0.068 - k * 0.027) * scale;
      g.color(...cols[k]).signal(2, phase, axis, k);
      g.disc(hx, ly, hz + 0.0115 * scale, 0.0095 * scale, 8, SIGN.lens);
      b.m('trim_dark');
      b.box(hx, ly + 0.009 * scale, hz + 0.017 * scale, 0.022 * scale, 0.003, 0.012 * scale);
      if (ctx.signals) ctx.signals.push(g.wx(hx, hz + 0.02 * scale), y + ly, g.wz(hx, hz + 0.02 * scale), k);
    }
  };
  if (opts.armLen) {
    // Ausleger über die Fahrbahn mit hängendem Signal
    const L = opts.armLen;
    b.m('metal_dark');
    b.beam(0, H + 0.12, 0, -L, H + 0.12, 0, 0.012);
    b.beam(0, H - 0.04, 0, -L * 0.45, H + 0.115, 0, 0.007);
    b.cyl(0, H, 0, 0.0075, 0.0075, 0.13, 6, 1);
    head(-L * 0.62, H + 0.02, 0.012, 1.05);
    if (L > 0.25) head(-L * 0.95, H + 0.02, 0.012, 1.05);
  }
  head(0, H - 0.11, 0.016);
  if (opts.ped) {
    // Fußgängersignal seitlich (Blick quer zur Fahrbahn = lokal −x) + Anforderungstaster
    const g = ctx.glow.at(x, y, z, yaw - Math.PI / 2);
    b.m('trim_dark');
    const px = 0, py = 0.17;
    const bb = ctx.solid.at(x, y, z, yaw - Math.PI / 2).m('trim_dark');
    bb.box(px, py, 0.012, 0.024, 0.052, 0.016);
    g.color(1, 0.18, 0.12).signal(2, phase, axis, 3);
    g.face([-0.0085, py + 0.029, 0.0205], [0.0085, py + 0.029, 0.0205], [0.0085, py + 0.047, 0.0205], [-0.0085, py + 0.047, 0.0205], [0, 0, 1], SIGN.pedRed);
    g.color(0.2, 1, 0.5).signal(2, phase, axis, 4);
    g.face([-0.0085, py + 0.006, 0.0205], [0.0085, py + 0.006, 0.0205], [0.0085, py + 0.024, 0.0205], [-0.0085, py + 0.024, 0.0205], [0, 0, 1], SIGN.pedGreen);
    if (ctx.signals) {
      ctx.signals.push(g.wx(0, 0.026), y + py + 0.038, g.wz(0, 0.026), 3);
      ctx.signals.push(g.wx(0, 0.026), y + py + 0.015, g.wz(0, 0.026), 4);
    }
    bb.m('paint_yellow');
    bb.box(0, 0.1, 0.01, 0.014, 0.022, 0.01);
  }
  if (opts.name !== undefined) {
    // Straßenschild am Mast
    const g = ctx.glow.at(x, y, z, yaw + Math.PI / 2).color(1, 1, 1).signal(0);
    const w = 0.07, hh = 0.0175, yy = H + 0.005;
    const uv = SIGN['name' + opts.name];
    g.face([-w / 2, yy, 0.0105], [w / 2, yy, 0.0105], [w / 2, yy + hh, 0.0105], [-w / 2, yy + hh, 0.0105], [0, 0, 1], uv);
    g.face([w / 2, yy, -0.0105], [-w / 2, yy, -0.0105], [-w / 2, yy + hh, -0.0105], [w / 2, yy + hh, -0.0105], [0, 0, -1], uv);
  }
}

// Straßennamensschild (beidseitig) quer zum Mast, Oberkante bei Höhe h
export function streetNamePlate(ctx, x, y, z, yaw, idx, h = 0.365) {
  const g = ctx.glow.at(x, y, z, yaw + Math.PI / 2).color(1, 1, 1).signal(0);
  const w = 0.075, hh = 0.019, yy = h + 0.004;
  const uv = SIGN['name' + (idx % 16)];
  g.face([-w / 2, yy, 0.0102], [w / 2, yy, 0.0102], [w / 2, yy + hh, 0.0102], [-w / 2, yy + hh, 0.0102], [0, 0, 1], uv);
  g.face([w / 2, yy, -0.0102], [-w / 2, yy, -0.0102], [-w / 2, yy + hh, -0.0102], [w / 2, yy + hh, -0.0102], [0, 0, -1], uv);
  ctx.solid.at(x, y, z, yaw + Math.PI / 2).m('metal_light').box(0, yy - 0.001, 0, w + 0.004, hh + 0.002, 0.019);
}

// Verkehrsschild auf eigenem Pfosten. Fläche schaut nach lokal +z.
export function signPost(ctx, x, y, z, yaw, cell, opts = {}) {
  const b = ctx.solid.at(x, y, z, yaw).m('metal_light');
  const H = opts.h || 0.24, s = opts.size || 0.06;
  b.cyl(0, 0, 0, 0.004, 0.004, H, 5, 1);
  const g = ctx.glow.at(x, y, z, yaw).color(1, 1, 1).signal(opts.lit ? 3 : 0);
  const yy = H - s * 0.15;
  const uv = SIGN[cell];
  const w = opts.w || s, h = opts.hgt || s;
  g.face([-w / 2, yy, 0.006], [w / 2, yy, 0.006], [w / 2, yy + h, 0.006], [-w / 2, yy + h, 0.006], [0, 0, 1], uv);
  b.m('metal_light');
  b.box(0, yy + 0.002, 0.003, w * 0.92, h * 0.92, 0.004);
  if (opts.second) {
    const uv2 = SIGN[opts.second];
    const y2 = yy - h - 0.006;
    g.face([-w / 2, y2, 0.006], [w / 2, y2, 0.006], [w / 2, y2 + h, 0.006], [-w / 2, y2 + h, 0.006], [0, 0, 1], uv2);
    b.box(0, y2 + 0.002, 0.003, w * 0.92, h * 0.92, 0.004);
  }
}

// Straßenbaum (Linde/Ahorn) mit Baumscheibe
export function streetTree(ctx, x, y, z, scale, seed, opts = {}) {
  const b = ctx.solid.at(x, y, z, seed * 6.283);
  const s = scale;
  const leaves = ['leaves_green', 'leaves_light', 'leaves_green', 'leaves_dark'];
  if (opts.pit !== false) { b.m(opts.pitMat || 'dirt'); b.box(0, -0.0025, 0, 0.07, 0.004, 0.07, 2); }
  b.m('bark');
  const th = 0.2 * s;
  b.cyl(0, 0, 0, 0.012 * s, 0.008 * s, th + 0.06 * s, 5, 0);
  // Äste
  b.beam(0, th * 0.85, 0, 0.04 * s, th + 0.08 * s, 0.02 * s, 0.006 * s);
  b.beam(0, th * 0.8, 0, -0.035 * s, th + 0.07 * s, -0.025 * s, 0.006 * s);
  const r = 0.13 * s;
  const kind = Math.floor(seed * 17.3) % 4;
  b.m(leaves[kind]);
  b.blob(0, th + r * 0.95, 0, r, r * 0.92, r, Math.floor(seed * 1000), 1);
  b.m(leaves[(kind + 1) % 4]);
  b.blob(r * 0.55, th + r * 0.75, r * 0.2, r * 0.62, r * 0.56, r * 0.62, Math.floor(seed * 1000) + 1, 0);
  b.blob(-r * 0.45, th + r * 1.05, -r * 0.35, r * 0.6, r * 0.55, r * 0.6, Math.floor(seed * 1000) + 2, 0);
  if (opts.guard) {
    // Baumschutzbügel
    b.m('metal_dark');
    for (const sx of [-1, 1]) b.beam(sx * 0.03, 0, -0.03, sx * 0.03, 0.05, -0.03, 0.004), b.beam(sx * 0.03, 0, 0.03, sx * 0.03, 0.05, 0.03, 0.004);
    b.beam(-0.03, 0.05, -0.03, -0.03, 0.05, 0.03, 0.004); b.beam(0.03, 0.05, -0.03, 0.03, 0.05, 0.03, 0.004);
  }
}

// Baum für die Fernansicht (wenige Dreiecke)
export function streetTreeFar(ctx, x, y, z, scale, seed) {
  const b = ctx.solid.at(x, y, z, seed * 6.283);
  const s = scale;
  const leaves = ['leaves_green', 'leaves_light', 'leaves_green', 'leaves_dark'];
  b.m('bark');
  const th = 0.2 * s;
  b.cyl(0, 0, 0, 0.012 * s, 0.008 * s, th + 0.04 * s, 3, 0);
  const r = 0.13 * s;
  b.m(leaves[Math.floor(seed * 17.3) % 4]);
  b.blob(0, th + r * 0.95, 0, r * 1.12, r, r * 1.12, Math.floor(seed * 1000), 0);
}

// Kleiner Busch/Hecke (Mittelstreifen)
export function shrub(ctx, x, y, z, r, seed) {
  const b = ctx.solid.at(x, y, z, seed * 6.28).m(seed > 0.5 ? 'hedge' : 'leaves_dark');
  b.blob(0, r * 0.55, 0, r, r * 0.6, r, Math.floor(seed * 997), 0);
}

// Parkbank (Blick nach lokal +z)
export function bench(ctx, x, y, z, yaw) {
  const b = ctx.detail.at(x, y, z, yaw);
  b.m('metal_dark');
  for (const sx of [-0.06, 0.06]) { b.box(sx, 0, 0, 0.006, 0.042, 0.04); }
  b.m('wood_planks');
  b.box(0, 0.042, 0.004, 0.15, 0.006, 0.036);
  b.beam(-0.075, 0.056, -0.018, 0.075, 0.056, -0.018, 0.008, 0.012);
  b.beam(-0.075, 0.074, -0.022, 0.075, 0.074, -0.022, 0.008, 0.012);
  b.m('metal_dark');
  for (const sx of [-0.06, 0.06]) b.beam(sx, 0.042, -0.016, sx, 0.084, -0.024, 0.005);
}

export function bin(ctx, x, y, z, yaw, color = 'paint_orange') {
  const b = ctx.detail.at(x, y, z, yaw);
  b.m('metal_dark');
  b.cyl(0, 0, 0, 0.004, 0.004, 0.06, 4, 1);
  b.m(color);
  b.cyl(0, 0.02, 0.012, 0.014, 0.016, 0.042, 8, 3);
  b.m('trim_dark');
  b.cyl(0, 0.062, 0.012, 0.017, 0.016, 0.004, 8, 1);
}

export function hydrant(ctx, x, y, z) {
  const b = ctx.detail.at(x, y, z, 0).m('paint_red');
  b.cyl(0, 0, 0, 0.012, 0.01, 0.006, 8, 1);
  b.cyl(0, 0.006, 0, 0.0085, 0.0085, 0.04, 8, 0);
  b.cyl(0, 0.046, 0, 0.0105, 0.004, 0.012, 8, 1);
  b.m('paint_white');
  b.cyl(0, 0.036, 0, 0.0092, 0.0092, 0.006, 8, 0);
  b.m('paint_red');
  b.cylX(0, 0.03, 0, 0.0045, 0.03, 6);
}

export function mailbox(ctx, x, y, z, yaw) {
  const b = ctx.detail.at(x, y, z, yaw).m('metal_dark');
  b.box(0, 0, 0, 0.01, 0.05, 0.01);
  b.m('paint_yellow');
  b.box(0, 0.05, 0, 0.034, 0.042, 0.026);
  b.cylX(0, 0.092, 0, 0.013, 0.034, 8);
  b.m('trim_dark');
  b.box(0, 0.082, 0.0135, 0.022, 0.003, 0.002);
}

export function bikeRack(ctx, x, y, z, yaw, n = 4) {
  const b = ctx.detail.at(x, y, z, yaw).m('metal_light');
  for (let k = 0; k < n; k++) {
    const ox = (k - (n - 1) / 2) * 0.035;
    b.beam(ox, 0, -0.018, ox, 0.032, -0.018, 0.004);
    b.beam(ox, 0, 0.018, ox, 0.032, 0.018, 0.004);
    b.beam(ox, 0.032, -0.018, ox, 0.032, 0.018, 0.004);
  }
}

export function bollard(ctx, x, y, z) {
  const b = ctx.detail.at(x, y, z, 0).m('metal_dark');
  b.cyl(0, 0, 0, 0.006, 0.0055, 0.04, 6, 1);
  b.m('paint_white');
  b.cyl(0, 0.03, 0, 0.0062, 0.0062, 0.005, 6, 0);
}

export function planter(ctx, x, y, z, seed) {
  const b = ctx.detail.at(x, y, z, seed * 6).m('concrete');
  b.box(0, 0, 0, 0.06, 0.03, 0.06);
  b.m('dirt'); b.box(0, 0.03, 0, 0.05, 0.002, 0.05);
  b.m(seed > 0.5 ? 'leaves_light' : 'hedge');
  b.blob(0, 0.045, 0, 0.03, 0.022, 0.03, Math.floor(seed * 333), 0);
}

const CAR_PAINT = ['paint_white', 'paint_red', 'paint_blue', 'metal_light', 'metal_dark', 'paint_green', 'paint_yellow', 'metal_panel_blue', 'siding_red', 'metal_panel_grey', 'paint_white', 'trim_dark'];
// Parkendes Auto (Front nach lokal +z), Länge ~4,4 m
export function parkedCar(ctx, x, y, z, yaw, seed, tinted = false) {
  const b = ctx.detail.at(x, y, z, yaw);
  const col = tinted ? 'paint_white' : CAR_PAINT[Math.floor(seed * 997) % CAR_PAINT.length];
  const van = seed > 0.86;
  const L = van ? 0.48 : 0.42, Wd = 0.17;
  b.m('rubber');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cylX(sx * (Wd / 2 - 0.012), 0.03, sz * (L / 2 - 0.075), 0.03, 0.024, 8);
  b.m(col);
  b.box(0, 0.02, 0, Wd, 0.05, L);
  if (van) {
    b.box(0, 0.07, -0.03, Wd * 0.97, 0.09, L * 0.82);
    b.m('window_frame_dark');
    b.box(0, 0.1, L * 0.38, Wd * 0.9, 0.05, 0.02);
  } else {
    // Fahrgastzelle (Trapez)
    const y0 = 0.07, y1 = 0.115, zb = -L * 0.38, zf = L * 0.2;
    b.m('window_frame_dark');
    const hw0 = Wd * 0.47, hw1 = Wd * 0.4;
    b.face([-hw0, y0, zf], [hw0, y0, zf], [hw1, y1, zf - 0.05], [-hw1, y1, zf - 0.05], [0, 0.7, 0.7]);
    b.face([hw0, y0, zb], [-hw0, y0, zb], [-hw1, y1, zb + 0.04], [hw1, y1, zb + 0.04], [0, 0.7, -0.7]);
    b.face([hw0, y0, zf], [hw0, y0, zb], [hw1, y1, zb + 0.04], [hw1, y1, zf - 0.05], [1, 0.2, 0]);
    b.face([-hw0, y0, zb], [-hw0, y0, zf], [-hw1, y1, zf - 0.05], [-hw1, y1, zb + 0.04], [-1, 0.2, 0]);
    b.m(col);
    b.face([-hw1, y1, zf - 0.05], [hw1, y1, zf - 0.05], [hw1, y1, zb + 0.04], [-hw1, y1, zb + 0.04], [0, 1, 0]);
  }
  // Lichter
  const g = ctx.glow.at(x, y, z, yaw).signal(0);
  g.color(1, 0.98, 0.9);
  g.face([-Wd * 0.45, 0.045, L / 2 + 0.001], [-Wd * 0.25, 0.045, L / 2 + 0.001], [-Wd * 0.25, 0.06, L / 2 + 0.001], [-Wd * 0.45, 0.06, L / 2 + 0.001], [0, 0, 1]);
  g.face([Wd * 0.25, 0.045, L / 2 + 0.001], [Wd * 0.45, 0.045, L / 2 + 0.001], [Wd * 0.45, 0.06, L / 2 + 0.001], [Wd * 0.25, 0.06, L / 2 + 0.001], [0, 0, 1]);
  g.color(0.75, 0.06, 0.05);
  g.face([Wd * 0.45, 0.045, -L / 2 - 0.001], [Wd * 0.28, 0.045, -L / 2 - 0.001], [Wd * 0.28, 0.06, -L / 2 - 0.001], [Wd * 0.45, 0.06, -L / 2 - 0.001], [0, 0, -1]);
  g.face([-Wd * 0.28, 0.045, -L / 2 - 0.001], [-Wd * 0.45, 0.045, -L / 2 - 0.001], [-Wd * 0.45, 0.06, -L / 2 - 0.001], [-Wd * 0.28, 0.06, -L / 2 - 0.001], [0, 0, -1]);
}

// Bushaltestelle (Wartehalle), Rückwand bei lokal −z, offen zur Straße (+z)
export function busShelter(ctx, x, y, z, yaw, seed, opts = {}) {
  const L = opts.len || 0.3, D = 0.1, H = 0.24;
  const S = () => ctx.solid.at(x, y, z, yaw);
  const G = () => ctx.glow.at(x, y, z, yaw);
  let b = S().m('metal_dark');
  for (const sx of [-L / 2, L / 2]) for (const sz of [-D / 2, D / 2 - 0.01]) b.box(sx, 0, sz, 0.008, H, 0.008);
  // Dach
  b.m('metal_panel_white');
  b.box(0, H, 0.005, L + 0.03, 0.012, D + 0.04);
  b.m('trim_dark');
  b.box(0, H + 0.012, 0.005, L + 0.02, 0.003, D + 0.03);
  // Bank
  b.m('metal_light');
  b.box(0, 0.045, -D / 2 + 0.02, L * 0.6, 0.006, 0.03);
  b.box(-L * 0.25, 0, -D / 2 + 0.02, 0.006, 0.045, 0.02); b.box(L * 0.25, 0, -D / 2 + 0.02, 0.006, 0.045, 0.02);
  // Werbevitrine an der Seite (Rahmen)
  b.m('metal_dark');
  b.box(L / 2, 0.02, 0.0, 0.012, 0.2, D * 0.9);
  // Haltestellenmast mit Fahrplankasten
  const sx = -L / 2 - 0.05, sz = D / 2 - 0.01;
  b.m('metal_light');
  b.cyl(sx, 0, sz, 0.005, 0.005, 0.3, 6, 1);
  b.m('paint_green');
  b.box(sx, 0.13, sz + 0.006, 0.05, 0.06, 0.006);
  // Glas (halbtransparent in der Markierungs-Schicht)
  if (ctx.paint) {
    const p = ctx.paint.at(x, y, z, yaw).color(0.72, 0.84, 0.9, 0.32);
    const gx0 = -L / 2 + 0.004, gx1 = L / 2 - 0.004, gy0 = 0.025, gy1 = H - 0.01, gz = -D / 2;
    p.face([gx1, gy0, gz], [gx0, gy0, gz], [gx0, gy1, gz], [gx1, gy1, gz], [0, 0, -1]);
    p.face([gx0, gy0, gz + 0.001], [gx1, gy0, gz + 0.001], [gx1, gy1, gz + 0.001], [gx0, gy1, gz + 0.001], [0, 0, 1]);
    p.face([-L / 2, gy0, gz], [-L / 2, gy0, D / 2 - 0.02], [-L / 2, gy1, D / 2 - 0.02], [-L / 2, gy1, gz], [-1, 0, 0]);
    p.face([-L / 2 + 0.001, gy0, D / 2 - 0.02], [-L / 2 + 0.001, gy0, gz], [-L / 2 + 0.001, gy1, gz], [-L / 2 + 0.001, gy1, D / 2 - 0.02], [1, 0, 0]);
  }
  // Plakat (hinterleuchtet)
  const poster = SIGN['poster' + (Math.floor(seed * 8) % 8)];
  let g = G().color(1, 1, 1).signal(3);
  g.face([L / 2 + 0.0065, 0.03, D * 0.42], [L / 2 + 0.0065, 0.03, -D * 0.42], [L / 2 + 0.0065, 0.21, -D * 0.42], [L / 2 + 0.0065, 0.21, D * 0.42], [1, 0, 0], poster);
  g.face([L / 2 - 0.0065, 0.03, -D * 0.42], [L / 2 - 0.0065, 0.03, D * 0.42], [L / 2 - 0.0065, 0.21, D * 0.42], [L / 2 - 0.0065, 0.21, -D * 0.42], [-1, 0, 0], poster);
  // Fahrplan
  g.face([sx - 0.022, 0.134, sz + 0.0095], [sx + 0.022, 0.134, sz + 0.0095], [sx + 0.022, 0.186, sz + 0.0095], [sx - 0.022, 0.186, sz + 0.0095], [0, 0, 1], SIGN.timetable);
  // Licht unter dem Dach
  g.color(1, 0.97, 0.9).signal(1);
  g.face([-L * 0.35, H - 0.001, 0.03], [L * 0.35, H - 0.001, 0.03], [L * 0.35, H - 0.001, -0.02], [-L * 0.35, H - 0.001, -0.02], [0, -1, 0], SIGN.diffuser);
  // H-Schild beidseitig
  g.color(1, 1, 1).signal(0);
  g.disc(sx, 0.28, sz + 0.005, 0.03, 12, SIGN.busH);
  ctx.glow.at(x, y, z, yaw + Math.PI).color(1, 1, 1).signal(0).disc(-sx, 0.28, -sz + 0.005, 0.03, 12, SIGN.busH);
  b = S();
  ctx.lamps.push(b.wx(0, 0.005), y + H - 0.01, b.wz(0, 0.005));
  if (ctx.light) lightPool(ctx.light, b.wx(0, 0.01), y + H, b.wz(0, 0.01), y, 0.22, 0.4, false);
  if (ctx.detail) bin(ctx, b.wx(-L / 2 - 0.02, -0.02), y, b.wz(-L / 2 - 0.02, -0.02), yaw, 'paint_green');
}

// Schutzplanke (Leitplanke) entlang einer Strecke a→b (Welt), Höhe über y
export function guardrail(ctx, ax, az, bx, bz, y, side = 1) {
  const b = ctx.solid;
  const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);
  b.at(ax, y, az, yaw).m('metal_light');
  // Holm (W-Profil angedeutet durch zwei Kanten)
  b.box(0, 0.04, len / 2, 0.006, 0.026, len);
  b.m('metal_panel_grey');
  b.box(side * 0.004, 0.046, len / 2, 0.003, 0.012, len);
  b.m('metal_dark');
  const n = Math.max(1, Math.round(len / 0.2));
  for (let k = 0; k <= n; k++) b.box(-side * 0.006, 0, (k / n) * len, 0.006, 0.058, 0.008);
}

// Betonschutzwand (Mittelstreifen der Autobahn)
export function concreteBarrier(ctx, ax, az, bx, bz, y) {
  const b = ctx.solid;
  const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
  b.at(ax, y, az, Math.atan2(dx, dz)).m('concrete');
  const w0 = 0.028, w1 = 0.01, h0 = 0.016, h = 0.08;
  const P = [[-w0, 0], [-w0 * 0.7, h0], [-w1, h], [w1, h], [w0 * 0.7, h0], [w0, 0]];
  for (let k = 0; k < P.length - 1; k++) {
    const [x0, y0] = P[k], [x1, y1] = P[k + 1];
    const ddx = x1 - x0, ddy = y1 - y0, l = Math.hypot(ddx, ddy) || 1;
    b.face([x0, y0, 0], [x0, y0, len], [x1, y1, len], [x1, y1, 0], [-ddy / l, ddx / l, 0]);
  }
  // Stirnflächen (Profil ist am Knick konkav → zwei Trapeze)
  for (const [a, bb, c] of [[0, 5, 4], [0, 4, 1], [1, 4, 3], [1, 3, 2]]) {
    b.tri3([P[a][0], P[a][1], len], [P[bb][0], P[bb][1], len], [P[c][0], P[c][1], len]);
    b.tri3([P[a][0], P[a][1], 0], [P[c][0], P[c][1], 0], [P[bb][0], P[bb][1], 0]);
  }
}

// Schilderbrücke über der Autobahn: quer zur Fahrtrichtung, Schilder schauen nach lokal +z
export function gantry(ctx, x, y, z, yaw, span, signs) {
  const b = ctx.solid.at(x, y, z, yaw);
  const H = 0.62;
  b.m('metal_light');
  for (const sx of [-span / 2, span / 2]) {
    b.box(sx, 0, 0, 0.022, 0.012, 0.05);
    b.box(sx - 0.008, 0.012, 0, 0.008, H + 0.05, 0.008); b.box(sx + 0.008, 0.012, 0, 0.008, H + 0.05, 0.008);
    for (let k = 0; k < 5; k++) b.beam(sx - 0.008, 0.02 + k * 0.13, 0, sx + 0.008, 0.085 + k * 0.13, 0, 0.004);
  }
  // Fachwerkträger
  b.box(0, H + 0.035, -0.012, span, 0.008, 0.008); b.box(0, H + 0.035, 0.012, span, 0.008, 0.008);
  b.box(0, H - 0.005, -0.012, span, 0.008, 0.008); b.box(0, H - 0.005, 0.012, span, 0.008, 0.008);
  const n = Math.round(span / 0.06);
  for (let k = 0; k < n; k++) {
    const x0 = -span / 2 + (k / n) * span, x1 = -span / 2 + ((k + 1) / n) * span;
    b.beam(x0, H - 0.001, 0.012, x1, H + 0.031, 0.012, 0.004);
    b.beam(x0, H - 0.001, -0.012, x1, H + 0.031, -0.012, 0.004);
  }
  const g = ctx.glow.at(x, y, z, yaw).color(1, 1, 1).signal(3);
  for (const s of signs) {
    const w = s.w, h = s.h, cx = s.x, y0 = H - h * 0.55;
    b.m('metal_panel_grey');
    b.box(cx, y0, 0.018, w, h, 0.006);
    g.face([cx - w / 2, y0, 0.0215], [cx + w / 2, y0, 0.0215], [cx + w / 2, y0 + h, 0.0215], [cx - w / 2, y0 + h, 0.0215], [0, 0, 1], SIGN[s.cell]);
  }
}

// ---------------------------------------------------------------- Instanzierte Ausstattung
// Jede Art (Laterne, Ampel, Baum …) wird einmal als Prototyp gebaut (Ursprung = Fußpunkt, Blick nach +z) und dann
// pro Instanz gezeichnet. Blöcke liefern Instanzlisten; neu übertragen wird nur, was sich geändert hat.
const TREE_SEEDS = [0.137, 0.413, 0.705, 0.921];
export const PROTOS = {
  lamp: { build: (c) => streetLamp(c, 0, 0, 0, 0), shadow: true },
  lamp2: { build: (c) => doubleLamp(c, 0, 0, 0, 0), shadow: true },
  mast: { build: (c) => highwayMast(c, 0, 0, 0, 0), shadow: true },
  lantern: { build: (c) => lantern(c, 0, 0, 0), shadow: true },
  lanternB: { build: (c) => lantern(c, 0, 0, 0, { h: 0.3 }), shadow: true },
  signal: { build: (c) => trafficLight(c, 0, 0, 0, 0, 0, 0, { ped: true }), shadow: true, sig: true },
  signalArm: { build: (c) => trafficLight(c, 0, 0, 0, 0, 0, 0, { ped: true, armLen: 0.37 }), shadow: true, sig: true },
  signYield: { build: (c) => signPost(c, 0, 0, 0, 0, 'yield', { h: 0.24, size: 0.065 }), shadow: true },
  signPrio: { build: (c) => signPost(c, 0, 0, 0, 0, 'prio', { h: 0.24, size: 0.065 }), shadow: true },
  signBus: { build: (c) => signPost(c, 0, 0, 0, 0, 'busH', { h: 0.28, size: 0.06 }), shadow: true },
  signZone: { build: (c) => signPost(c, 0, 0, 0, 0, 'zone30', { h: 0.26, size: 0.07 }), shadow: true },
  shrub0: { build: (c) => shrub(c, 0, 0, 0, 0.035, 0.3) },
  shrub1: { build: (c) => shrub(c, 0, 0, 0, 0.035, 0.8) },
  bench: { build: (c) => bench(c, 0, 0, 0, 0), detail: true, shadow: true },
  bin: { build: (c) => bin(c, 0, 0, 0, 0), detail: true },
  binG: { build: (c) => bin(c, 0, 0, 0, 0, 'paint_green'), detail: true },
  hydrant: { build: (c) => hydrant(c, 0, 0, 0), detail: true },
  mailbox: { build: (c) => mailbox(c, 0, 0, 0, 0), detail: true },
  bikeRack: { build: (c) => bikeRack(c, 0, 0, 0, 0, 4), detail: true },
  bollard: { build: (c) => bollard(c, 0, 0, 0), detail: true },
  planter: { build: (c) => planter(c, 0, 0, 0, 0.7), detail: true, shadow: true },
  car: { build: (c) => parkedCar(c, 0, 0, 0, 0, 0.05, true), detail: true, shadow: true, colored: true },
  van: { build: (c) => parkedCar(c, 0, 0, 0, 0, 0.95, true), detail: true, shadow: true, colored: true },
};
TREE_SEEDS.forEach((sd, k) => {
  PROTOS['tree' + k] = { build: (c) => streetTree(c, 0, 0, 0, 1, sd), far: (c) => streetTreeFar(c, 0, 0, 0, 1, sd), shadow: true, colored: true };
});
// Lichtfleck und Lichtkegel als Einheitsformen (Radius 1 bzw. Höhe 1)
function unitPool() {
  const L = new Layer('light');
  lightPool(L, 0, 0, 0, 0, 1, 0.5, false);
  return L;
}
function unitCone() {
  const L = new Layer('light');
  const top = 0.06, kc = 0.085;
  for (let s = 0; s < 10; s++) {
    const a0 = (s / 10) * Math.PI * 2, a1 = ((s + 1) / 10) * Math.PI * 2;
    const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    L.vl(c0 * top, 1, s0 * top, kc); L.vl(c1 * top, 1, s1 * top, kc); L.vl(c1, 0, s1, 0);
    L.vl(c0 * top, 1, s0 * top, kc); L.vl(c1, 0, s1, 0); L.vl(c0, 0, s0, 0);
  }
  return L;
}

export class InstanceList {
  constructor() { this.map = new Map(); }
  add(kind, x, y, z, yaw, sx, sy, sz, ph, ax, col) {
    let e = this.map.get(kind);
    if (!e) { e = { t: [], ph: [], col: [] }; this.map.set(kind, e); }
    e.t.push(x, y, z, yaw, sx, sy, sz);
    e.ph.push(ph || 0, ax || 0);
    e.col.push(col ? col[0] : 1, col ? col[1] : 1, col ? col[2] : 1);
  }
}

export class PropSystem {
  constructor(group, mats) {
    this.group = group;
    this.mats = mats;
    this.kinds = new Map();
    this.lists = new Map(); // Block → InstanceList
    this.state = { detail: true, near: true, night: false };
    this.pending = new Set();
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._y = new THREE.Vector3(0, 1, 0);
  }

  // Prototyp (lazy) mit Metadaten: lamps/pools/signals in lokalen Koordinaten
  meta(kind) {
    let k = this.kinds.get(kind);
    if (k) return k;
    k = { kind, meshes: [], cap: 0, total: 0, lamps: [], pools: [], signals: [], def: PROTOS[kind] || null, tris: 0 };
    if (kind === 'pool' || kind === 'cone') {
      k.lightGeo = (kind === 'pool' ? unitPool() : unitCone()).toGeometry();
    } else if (k.def) {
      const L = { solid: new Layer('solid'), glow: new Layer('glow'), paint: new Layer('paint') };
      L.glow.instanced = true;
      const c = { solid: new Brush(L.solid), detail: new Brush(L.solid), glow: new Brush(L.glow), paint: new Brush(L.paint), light: null, lamps: k.lamps, pools: k.pools, signals: k.signals };
      k.def.build(c);
      k.solidGeo = L.solid.empty() ? null : L.solid.toGeometry();
      k.glowGeo = L.glow.empty() ? null : L.glow.toGeometry();
      if (k.def.far) {
        const Lf = new Layer('solid');
        k.def.far({ solid: new Brush(Lf), detail: new Brush(Lf), glow: new Brush(new Layer('glow')), light: null, lamps: [], pools: [], signals: [] });
        k.farGeo = Lf.toGeometry();
      }
      for (const g of [k.solidGeo, k.glowGeo]) if (g) k.tris += g.attributes.position.count / 3;
    }
    this.kinds.set(kind, k);
    return k;
  }

  setChunk(key, list) {
    const old = this.lists.get(key);
    const touched = new Set();
    if (old) for (const kd of old.map.keys()) touched.add(kd);
    if (list) for (const kd of list.map.keys()) touched.add(kd);
    if (list && list.map.size) this.lists.set(key, list); else this.lists.delete(key);
    for (const kd of touched) this.pending.add(kd);
  }

  // geänderte Arten übertragen (einmal pro Neubau)
  flush() {
    for (const kd of this.pending) this.commit(kd);
    this.pending.clear();
  }

  makeMeshes(k, cap) {
    for (const m of k.meshes) { this.group.remove(m.mesh); m.mesh.dispose(); }
    k.meshes = [];
    const M = this.mats;
    const mk = (geo, mat, role) => {
      if (role === 'glow') {
        if (k.def && k.def.sig) geo.setAttribute('aPh', new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2));
        else if (!geo.attributes.aPh) geo.setAttribute('aPh', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
      }
      const mesh = new THREE.InstancedMesh(geo, mat, cap);
      mesh.count = 0;
      mesh.castShadow = (role === 'solid' || role === 'far') && !!(k.def && k.def.shadow);
      mesh.receiveShadow = role !== 'light';
      if (role === 'light') mesh.renderOrder = 6;
      if (k.def && k.def.colored && (role === 'solid' || role === 'far')) mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
      this.group.add(mesh);
      k.meshes.push({ mesh, role });
    };
    if (k.lightGeo) mk(k.lightGeo, M.light, 'light');
    if (k.solidGeo) mk(k.solidGeo, M.solid, 'solid');
    if (k.farGeo) mk(k.farGeo, M.solid, 'far');
    if (k.glowGeo) mk(k.glowGeo, M.glow, 'glow');
    k.cap = cap;
  }

  commit(kind) {
    const k = this.meta(kind);
    let total = 0;
    for (const l of this.lists.values()) { const e = l.map.get(kind); if (e) total += e.t.length / 7; }
    if (total > k.cap || !k.meshes.length) this.makeMeshes(k, Math.max(16, Math.ceil(total * 1.5)));
    const m = this._m, q = this._q, p = this._p, s = this._s;
    let i = 0;
    for (const l of this.lists.values()) {
      const e = l.map.get(kind);
      if (!e) continue;
      for (let j = 0, jj = 0; j < e.t.length; j += 7, jj++, i++) {
        p.set(e.t[j], e.t[j + 1], e.t[j + 2]);
        q.setFromAxisAngle(this._y, e.t[j + 3]);
        s.set(e.t[j + 4], e.t[j + 5], e.t[j + 6]);
        m.compose(p, q, s);
        for (const { mesh, role } of k.meshes) {
          mesh.setMatrixAt(i, m);
          if (mesh.instanceColor) mesh.instanceColor.setXYZ(i, e.col[jj * 3], e.col[jj * 3 + 1], e.col[jj * 3 + 2]);
          if (role === 'glow' && k.def && k.def.sig) mesh.geometry.attributes.aPh.setXY(i, e.ph[jj * 2], e.ph[jj * 2 + 1]);
        }
      }
    }
    for (const { mesh, role } of k.meshes) {
      mesh.count = total;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      if (role === 'glow' && k.def && k.def.sig) mesh.geometry.attributes.aPh.needsUpdate = true;
      mesh.boundingSphere = null;
    }
    k.total = total;
    this.applyVis(k);
  }

  applyVis(k) {
    const st = this.state;
    for (const { mesh, role } of k.meshes) {
      let v = k.total > 0;
      if (k.def && k.def.detail) v = v && st.detail;
      if (role === 'light') v = v && st.night;
      if (k.farGeo) { if (role === 'far') v = v && !st.near; else if (role === 'solid') v = v && st.near; }
      mesh.visible = v;
    }
  }

  setState(detail, near, night) {
    const st = this.state;
    if (st.detail === detail && st.near === near && st.night === night) return;
    st.detail = detail; st.near = near; st.night = night;
    for (const k of this.kinds.values()) this.applyVis(k);
  }

  stats() {
    let inst = 0, tris = 0, meshes = 0;
    for (const k of this.kinds.values()) { inst += k.total || 0; tris += (k.tris || 0) * (k.total || 0); for (const { mesh } of k.meshes) if (mesh.visible) meshes++; }
    return { inst, tris, meshes };
  }
}
