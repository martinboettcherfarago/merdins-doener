// Geometrie-Sammler für Wohnen & Gewerbe (Besitzer G3).
// Statt vieler kleiner Three.js-Geometrien sammelt „Geo" Dreiecke direkt pro Material und übergibt am Ende
// pro Material EINE Geometrie an den Baukasten (kit.add mit uv:'keep'). Das ist schnell und erlaubt
// eigene UVs: Jede Fläche bekommt Texturkoordinaten in ihrer eigenen Ebene (u = waagrecht entlang der Fläche,
// v = hangaufwärts bzw. nach oben, 1 UV-Einheit = 4 m) – Dachziegel liegen so auf jeder Dachfläche richtig.
//
// Wandrahmen: frame(cx, cz, sx, sz, side) beschreibt eine Seite eines Baukörpers. Wandkoordinaten:
// u = entlang der Wand (von außen gesehen links → rechts), y = Höhe, d = Abstand vor der Wand (außen positiv).
import * as THREE from 'three';
import { M } from './kit.js';

const TEX = 1 / (4 * M);
const _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3(), _n = new THREE.Vector3(), _t = new THREE.Vector3(), _bt = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _eu = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const _nm = new THREE.Matrix3();
const UP = new THREE.Vector3(0, 1, 0);

// Flächen einer Box, die weggelassen werden können
export const F = { FRONT: 1, BACK: 2, RIGHT: 4, LEFT: 8, TOP: 16, BOTTOM: 32 };
export const NB = F.BOTTOM; // „steht auf dem Boden"

export function frame(cx, cz, sx, sz, side) {
  switch (side) {
    case 'front': return { ox: cx, oz: cz + sz / 2, ry: 0, c: 1, s: 0, len: sx, side };
    case 'back': return { ox: cx, oz: cz - sz / 2, ry: Math.PI, c: -1, s: 0, len: sx, side };
    case 'right': return { ox: cx + sx / 2, oz: cz, ry: Math.PI / 2, c: 0, s: 1, len: sz, side };
    default: return { ox: cx - sx / 2, oz: cz, ry: -Math.PI / 2, c: 0, s: -1, len: sz, side: 'left' };
  }
}
export const SIDES = ['front', 'back', 'left', 'right'];
// Wandkoordinaten → Baukasten-Koordinaten
export const W = (f, u, y, d = 0) => [f.ox + f.c * u + f.s * d, y, f.oz - f.s * u + f.c * d];

export class Geo {
  constructor(kit) {
    this.kit = kit;
    this.detail = kit.detail;
    this.rng = kit.rng;
    this.bufs = new Map();
    this._neon = null;
    this.lamp = 'emissive_warm'; // Material kleiner Leuchten (Gewerbe: 'sign_white')
  }
  // Leuchtmaterial pro Gebäude festhalten (jedes Sondermaterial kostet einen eigenen Draw Call)
  neon(m) { if (!this._neon) this._neon = m; return this._neon; }
  buf(mat) {
    let b = this.bufs.get(mat);
    if (!b) { b = { p: [], n: [], uv: [], lit: [] }; this.bufs.set(mat, b); }
    return b;
  }
  // Dreieck (Punkte gegen den Uhrzeigersinn von außen gesehen); want = gewünschte Normalenrichtung (optional, dreht um)
  tri(mat, a, b, c, lit = 0, want) {
    _e1.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    _e2.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    _n.crossVectors(_e1, _e2);
    const len = _n.length();
    if (len < 1e-10) return;
    _n.multiplyScalar(1 / len);
    if (want && _n.x * want[0] + _n.y * want[1] + _n.z * want[2] < 0) { const t = b; b = c; c = t; _n.negate(); }
    if (Math.abs(_n.y) > 0.995) { _t.set(1, 0, 0); _bt.set(0, 0, -1); } else { _t.crossVectors(UP, _n).normalize(); _bt.crossVectors(_n, _t); }
    const B = this.buf(mat);
    for (const p of [a, b, c]) {
      B.p.push(p[0], p[1], p[2]);
      B.n.push(_n.x, _n.y, _n.z);
      B.uv.push((p[0] * _t.x + p[1] * _t.y + p[2] * _t.z) * TEX, (p[0] * _bt.x + p[1] * _bt.y + p[2] * _bt.z) * TEX);
      B.lit.push(lit);
    }
  }
  quad(mat, a, b, c, d, lit = 0, want) { this.tri(mat, a, b, c, lit, want); this.tri(mat, a, c, d, lit, want); }
  // Ebenes, konvexes Vieleck (Fächer)
  poly(mat, pts, lit = 0, want) { for (let i = 1; i < pts.length - 1; i++) this.tri(mat, pts[0], pts[i], pts[i + 1], lit, want); }
  // Ebenes Vieleck mit Löchern (beliebig, per Earcut). pts/holes in 2D (a, b), map(a, b) → [x, y, z]
  shape2(mat, outer, holes, map, want, lit = 0) {
    const c = outer.map(([a, b]) => new THREE.Vector2(a, b));
    const hs = holes.map((h) => h.map(([a, b]) => new THREE.Vector2(a, b)));
    const faces = THREE.ShapeUtils.triangulateShape(c, hs);
    const all = c.concat(...hs);
    for (const [i, j, k] of faces) this.tri(mat, map(all[i].x, all[i].y), map(all[j].x, all[j].y), map(all[k].x, all[k].y), lit, want);
  }

  // Orientierte Box: Mitte c, Halbachsen ax, ay, az (rechtshändig)
  obox(mat, c, ax, ay, az, o = {}) {
    const P = (i, j, k) => [c[0] + ax[0] * i + ay[0] * j + az[0] * k, c[1] + ax[1] * i + ay[1] * j + az[1] * k, c[2] + ax[2] * i + ay[2] * j + az[2] * k];
    const sk = o.skip || 0, lit = o.lit || 0;
    if (!(sk & F.FRONT)) this.quad(mat, P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1), lit, az);
    if (!(sk & F.BACK)) this.quad(mat, P(1, -1, -1), P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1), lit, [-az[0], -az[1], -az[2]]);
    if (!(sk & F.RIGHT)) this.quad(mat, P(1, -1, 1), P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), lit, ax);
    if (!(sk & F.LEFT)) this.quad(mat, P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1), lit, [-ax[0], -ax[1], -ax[2]]);
    if (!(sk & F.TOP)) this.quad(mat, P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), P(-1, 1, -1), lit, ay);
    if (!(sk & F.BOTTOM)) this.quad(mat, P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1), lit, [-ay[0], -ay[1], -ay[2]]);
  }
  // Achsenparallele Box (Mitte x/z, Unterkante y0), optional um die Hochachse gedreht (o.ry)
  box(mat, x, y0, z, sx, sy, sz, o = {}) {
    if (sx <= 0 || sy <= 0 || sz <= 0) return;
    const ry = o.ry || 0, c = Math.cos(ry), s = Math.sin(ry);
    this.obox(mat, [x, y0 + sy / 2, z], [c * sx / 2, 0, -s * sx / 2], [0, sy / 2, 0], [s * sz / 2, 0, c * sz / 2], o);
  }
  // Box mit Drehung (Mitte x, y, z; Euler YXZ wie im Baukasten)
  rbox(mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, o = {}) {
    _eu.set(rx, ry, rz, 'YXZ'); _m.makeRotationFromEuler(_eu);
    const e = _m.elements;
    const ax = [e[0] * sx / 2, e[1] * sx / 2, e[2] * sx / 2], ay = [e[4] * sy / 2, e[5] * sy / 2, e[6] * sy / 2], az = [e[8] * sz / 2, e[9] * sz / 2, e[10] * sz / 2];
    this.obox(mat, [x, y, z], ax, ay, az, o);
  }
  // Box in Wandkoordinaten: Mitte u, Unterkante y0, Mitte d vor der Wand; w entlang, t Tiefe
  wbox(mat, f, u, y0, d, w, h, t, o = {}) {
    const [x, , z] = W(f, u, 0, d);
    this.box(mat, x, y0, z, w, h, t, { ...o, ry: f.ry });
  }
  // Fläche parallel zur Wand (nach außen), Mitte u, Unterkante y0, im Abstand d
  wquad(mat, f, u, y0, d, w, h, lit = 0) {
    const n = [f.s, 0, f.c];
    this.quad(mat, W(f, u - w / 2, y0, d), W(f, u + w / 2, y0, d), W(f, u + w / 2, y0 + h, d), W(f, u - w / 2, y0 + h, d), lit, n);
  }
  // Waagrechte Fläche (nach oben)
  hquad(mat, x, y, z, sx, sz, lit = 0) {
    this.quad(mat, [x - sx / 2, y, z + sz / 2], [x + sx / 2, y, z + sz / 2], [x + sx / 2, y, z - sz / 2], [x - sx / 2, y, z - sz / 2], lit, [0, 1, 0]);
  }
  // Wandfläche mit rechteckigen Löchern. outer: [[u, y], …] (Umriss), holes: [{u0, u1, y0, y1}]
  wallShape(mat, f, outer, holes = [], d = 0) {
    const n = [f.s, 0, f.c];
    if (!holes.length) {
      if (outer.length <= 4) { this.poly(mat, outer.map(([u, y]) => W(f, u, y, d)), 0, n); return; }
    }
    this.shape2(mat, outer, holes.map((h) => [[h.u0, h.y0], [h.u0, h.y1], [h.u1, h.y1], [h.u1, h.y0]]), (u, y) => W(f, u, y, d), n);
  }
  // Zylinder mit wenigen Segmenten (glatte Mantelnormalen), Unterkante y0
  cyl(mat, x, y0, z, r, h, o = {}) {
    const seg = o.seg || 8, rt = o.rTop ?? r, B = this.buf(mat), lit = o.lit || 0;
    const y1 = y0 + h;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2 + (o.rot || 0), a1 = ((i + 1) / seg) * Math.PI * 2 + (o.rot || 0);
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const p = [[x + c0 * r, y0, z + s0 * r], [x + c1 * r, y0, z + s1 * r], [x + c1 * rt, y1, z + s1 * rt], [x + c0 * rt, y1, z + s0 * rt]];
      const ns = [[c0, 0, s0], [c1, 0, s1], [c1, 0, s1], [c0, 0, s0]];
      const circ = 2 * Math.PI * r;
      const uvs = [[i / seg * circ * TEX, y0 * TEX], [(i + 1) / seg * circ * TEX, y0 * TEX], [(i + 1) / seg * circ * TEX, y1 * TEX], [i / seg * circ * TEX, y1 * TEX]];
      for (const k of [0, 2, 1, 0, 3, 2]) { B.p.push(...p[k]); B.n.push(...ns[k]); B.uv.push(...uvs[k]); B.lit.push(lit); }
    }
    if (o.cap !== false && rt > 0) {
      const pts = [];
      for (let i = seg - 1; i >= 0; i--) { const a = (i / seg) * Math.PI * 2 + (o.rot || 0); pts.push([x + Math.cos(a) * rt, y1, z + Math.sin(a) * rt]); }
      this.poly(mat, pts, lit, [0, 1, 0]);
    }
    if (o.bottom) {
      const pts = [];
      for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI * 2 + (o.rot || 0); pts.push([x + Math.cos(a) * r, y0, z + Math.sin(a) * r]); }
      this.poly(mat, pts, lit, [0, -1, 0]);
    }
  }
  // Waagrechter Zylinder entlang x oder z (Rohre, Markisenwalzen, Dachrinnen)
  hcyl(mat, x, y, z, r, len, axis = 'x', seg = 6) {
    const B = this.buf(mat);
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const P = (a, s) => axis === 'x' ? [x + s * len / 2, y + Math.sin(a) * r, z + Math.cos(a) * r] : [x + Math.cos(a) * r, y + Math.sin(a) * r, z + s * len / 2];
      const N = (a) => axis === 'x' ? [0, Math.sin(a), Math.cos(a)] : [Math.cos(a), Math.sin(a), 0];
      const p = [P(a0, -1), P(a1, -1), P(a1, 1), P(a0, 1)], ns = [N(a0), N(a1), N(a1), N(a0)];
      const order = axis === 'x' ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
      for (const k of order) { B.p.push(...p[k]); B.n.push(...ns[k]); B.uv.push((k === 1 || k === 2 ? len : 0) * TEX, (k >= 2 ? 1 : 0) * 0.1); B.lit.push(0); }
    }
  }
  // Beliebige Three.js-Geometrie übernehmen (flache Normalen, eigene UVs). o: x, y, z, rx, ry, rz, sx, sy, sz
  geom(mat, geometry, o = {}) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    _eu.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ'); _q.setFromEuler(_eu);
    _m.compose(_v.set(o.x || 0, o.y || 0, o.z || 0), _q, _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1));
    const pos = g.attributes.position;
    const pts = [];
    for (let i = 0; i < pos.count; i++) { _v.fromBufferAttribute(pos, i).applyMatrix4(_m); pts.push([_v.x, _v.y, _v.z]); }
    if (o.smooth && g.attributes.normal) {
      _nm.getNormalMatrix(_m);
      const B = this.buf(mat), nor = g.attributes.normal;
      for (let i = 0; i < pts.length; i++) {
        _v.fromBufferAttribute(nor, i).applyMatrix3(_nm).normalize();
        B.p.push(...pts[i]); B.n.push(_v.x, _v.y, _v.z); B.uv.push(pts[i][0] * TEX + pts[i][2] * TEX, pts[i][1] * TEX); B.lit.push(o.lit || 0);
      }
    } else {
      for (let i = 0; i + 2 < pts.length; i += 3) this.tri(mat, pts[i], pts[i + 1], pts[i + 2], o.lit || 0);
    }
    if (g !== geometry) g.dispose();
    geometry.dispose();
  }
  // Prisma: 2D-Profil (a, b) in einer senkrechten Ebene, extrudiert entlang einer waagrechten Achse.
  // axis 'x': Profil in (z, y), Länge entlang x; axis 'z': Profil in (x, y), Länge entlang z.
  prism(mat, profile, x, y, z, len, axis = 'x', o = {}) {
    const n = profile.length;
    const P = (a, b, s) => axis === 'x' ? [x + s * len / 2, y + b, z + a] : [x + a, y + b, z + s * len / 2];
    const ax = axis === 'x' ? [1, 0, 0] : [0, 0, 1];
    if (o.caps !== false) {
      this.shape2(mat, profile, [], (a, b) => P(a, b, 1), ax);
      this.shape2(mat, profile, [], (a, b) => P(a, b, -1), [-ax[0], -ax[1], -ax[2]]);
    }
    // Mantel: Normale zeigt vom Profil-Schwerpunkt weg
    let ca = 0, cb = 0;
    for (const [a, b] of profile) { ca += a / n; cb += b / n; }
    for (let i = 0; i < n; i++) {
      const [a0, b0] = profile[i], [a1, b1] = profile[(i + 1) % n];
      if (o.skipEdge && o.skipEdge.includes(i)) continue;
      const ma = (a0 + a1) / 2 - ca, mb = (b0 + b1) / 2 - cb;
      // äußere Normale der Kante (senkrecht zur Kante), vom Schwerpunkt aus geprüft
      const ea = a1 - a0, eb = b1 - b0;
      let na = eb, nb = -ea;
      if (na * ma + nb * mb < 0) { na = -na; nb = -nb; }
      const w2 = axis === 'x' ? [0, nb, na] : [na, nb, 0];
      this.quad(mat, P(a0, b0, -1), P(a1, b1, -1), P(a1, b1, 1), P(a0, b0, 1), o.lit || 0, w2);
    }
  }
  // Übergibt alles an den Baukasten
  flush() {
    for (const [mat, B] of this.bufs) {
      if (!B.p.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2));
      geo.setAttribute('aLit', new THREE.Float32BufferAttribute(B.lit, 1));
      this.kit.add(mat, geo, { uv: 'keep' });
    }
    this.bufs.clear();
  }
}

// Kleine Zufallshelfer
export const rpick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];
export const rr = (rng, a, b) => a + (b - a) * rng();
export const chance = (rng, p) => rng() < p;
export function wpick(rng, pairs) {
  // [[wert, gewicht], …]
  let s = 0;
  for (const [, w] of pairs) s += w;
  let t = rng() * s;
  for (const [v, w] of pairs) { t -= w; if (t <= 0) return v; }
  return pairs[pairs.length - 1][0];
}
