// Bauteile für Dienst- und Versorgungsgebäude (Besitzer: G5). Ergänzt den eingefrorenen Baukasten (kit.js)
// um Rohre, Drehkörper, Tanks, Kühltürme, Schornsteine, Masten, Zäune, Fahrzeuge, Bäume, Schilder mit Schrift u. a.
// Maße in Metern × M (1 M = 1 m, 1 Feld = 10 m). Front (Straße) zeigt nach +z.
// Detailstufen: k.detail 2 = alles, 1 = ohne Kleinteile, 0 = nur Grundkörper (≤ 8 % der Dreiecke).
import * as THREE from 'three';
import { Kit, M, FLOOR, pick, range } from './kit.js';

export { M, FLOOR, pick, range };

// Bodenschichten (Oberkanten) – genug Abstand gegen Z-Fighting auch aus der Ferne
export const LOT = 0.05 * M;   // Grundstücksplatte
export const PAVE = 0.1 * M;   // Wege, Plätze, Asphalt auf dem Grundstück
export const MARK = 0.14 * M;  // Markierungen

export const segs = (k, n) => (k.detail >= 2 ? n : k.detail === 1 ? Math.max(6, Math.round(n * 0.7)) : Math.max(5, Math.round(n * 0.42)));
export const D2 = (k) => k.detail >= 2;
export const D1 = (k) => k.detail >= 1;

const _v = new THREE.Vector3(), _c = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _one = new THREE.Vector3(1, 1, 1);

// Geometrie (entlang +y, mittig) zwischen zwei Punkte legen
function orient(geo, a, b) {
  _v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = _v.length() || 1;
  _v.divideScalar(len);
  _q.setFromUnitVectors(_up, _v);
  _m.compose(_c.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), _q, _one);
  geo.applyMatrix4(_m);
  return geo;
}
const dist3 = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);

// Rohr zwischen a und b (Weltkoordinaten des Modells)
export function pipe(k, mat, a, b, r, o = {}) {
  const len = dist3(a, b);
  if (len < 1e-5) return null;
  const geo = new THREE.CylinderGeometry(o.r2 ?? r, r, len, o.seg ?? segs(k, 8), 1, o.open ?? true);
  return k.add(mat, orient(geo, a, b), { lit: o.lit });
}
// Vierkant-Träger zwischen a und b
export function beam(k, mat, a, b, w, o = {}) {
  const len = dist3(a, b);
  if (len < 1e-5) return null;
  return k.add(mat, orient(new THREE.BoxGeometry(w, len, o.d ?? w), a, b), { lit: o.lit });
}
// Rohrleitung über mehrere Punkte, mit Knickstücken
export function pipeline(k, mat, pts, r, o = {}) {
  for (let i = 0; i < pts.length - 1; i++) pipe(k, mat, pts[i], pts[i + 1], r, o);
  if (D2(k) && o.joints !== false) for (let i = 1; i < pts.length - 1; i++) k.sphere(mat, pts[i][0], pts[i][1], pts[i][2], r * 1.04, { seg: 6 });
}
// Drehkörper aus Profil [[radius, höhe], …] (von unten nach oben = Außenseite)
export function lathe(k, mat, x, y0, z, prof, seg, o = {}) {
  const pts = prof.map(([r, h]) => new THREE.Vector2(Math.max(1e-4, r), h));
  return k.add(mat, new THREE.LatheGeometry(pts, seg ?? segs(k, 20)), { ...o, x, y: y0, z });
}
// Flache Scheibe / flacher Ring (nach oben zeigend)
export function disk(k, mat, x, y, z, r, o = {}) {
  const geo = new THREE.CircleGeometry(r, o.seg ?? segs(k, 20), o.start ?? 0, o.len ?? Math.PI * 2);
  return k.add(mat, geo, { x, y, z, rx: -Math.PI / 2, ry: o.ry || 0, lit: o.lit });
}
export function ring(k, mat, x, y, z, r0, r1, o = {}) {
  const geo = new THREE.RingGeometry(r0, r1, o.seg ?? segs(k, 24), 1, o.start ?? 0, o.len ?? Math.PI * 2);
  return k.add(mat, geo, { x, y, z, rx: -Math.PI / 2, ry: o.ry || 0 });
}
// Torus liegend (Ring um die y-Achse)
export function torus(k, mat, x, y, z, R, r, o = {}) {
  const geo = new THREE.TorusGeometry(R, r, o.rseg ?? (k.detail ? 6 : 4), o.seg ?? segs(k, 24), o.arc ?? Math.PI * 2);
  return k.add(mat, geo, { x, y, z, rx: o.rx ?? Math.PI / 2, ry: o.ry || 0, rz: o.rz || 0 });
}
// Senkrechte Fläche (Quad) mit Blickrichtung ry (0 = nach +z)
export function quad(k, mat, x, y, z, w, h, ry = 0, o = {}) {
  return k.add(mat, new THREE.PlaneGeometry(w, h), { x, y, z, ry, rx: o.rx || 0, lit: o.lit, uv: o.uv });
}
export function slab(k, mat, x, z, sx, sz, top = PAVE, o = {}) {
  return k.box(mat, x, o.y0 ?? 0, z, sx, top - (o.y0 ?? 0), sz, o);
}

// Lokales Koordinatensystem (Position + Drehung um y) für zusammengesetzte Objekte
export class G {
  constructor(k, x = 0, z = 0, ry = 0, y = 0) { this.k = k; this.x = x; this.z = z; this.y = y; this.ry = ry; this.c = Math.cos(ry); this.s = Math.sin(ry); }
  get detail() { return this.k.detail; }
  p(lx, lz) { return [this.x + lx * this.c + lz * this.s, this.z - lx * this.s + lz * this.c]; }
  P(a) { const [x, z] = this.p(a[0], a[2]); return [x, this.y + a[1], z]; }
  _o(o) { return { ...o, ry: this.ry + (o.ry || 0) }; }
  box(mat, lx, y0, lz, sx, sy, sz, o = {}) { const [x, z] = this.p(lx, lz); return this.k.box(mat, x, this.y + y0, z, sx, sy, sz, this._o(o)); }
  cyl(mat, lx, y0, lz, r, h, o = {}) { const [x, z] = this.p(lx, lz); return this.k.cyl(mat, x, this.y + y0, z, r, h, this._o(o)); }
  cone(mat, lx, y0, lz, r, h, o = {}) { const [x, z] = this.p(lx, lz); return this.k.cone(mat, x, this.y + y0, z, r, h, this._o(o)); }
  sphere(mat, lx, y, lz, r, o = {}) { const [x, z] = this.p(lx, lz); return this.k.sphere(mat, x, this.y + y, z, r, this._o(o)); }
  dome(mat, lx, y0, lz, r, o = {}) { const [x, z] = this.p(lx, lz); return this.k.dome(mat, x, this.y + y0, z, r, this._o(o)); }
  prism(mat, prof, len, o = {}) { const [x, z] = this.p(o.x || 0, o.z || 0); return this.k.prism(mat, prof, len, { ...this._o(o), x, z, y: this.y + (o.y || 0) }); }
  add(mat, geo, o = {}) { const [x, z] = this.p(o.x || 0, o.z || 0); return this.k.add(mat, geo, { ...this._o(o), x, z, y: this.y + (o.y || 0) }); }
  quad(mat, lx, y, lz, w, h, o = {}) { const [x, z] = this.p(lx, lz); return quad(this.k, mat, x, this.y + y, z, w, h, this.ry + (o.ry || 0), o); }
  pipe(mat, a, b, r, o) { return pipe(this.k, mat, this.P(a), this.P(b), r, o); }
  beam(mat, a, b, w, o) { return beam(this.k, mat, this.P(a), this.P(b), w, o); }
  windows(side, lx, lz, sx, sz, y0, floors, fh, o) { // nur für ry in Vielfachen von 90°
    const [x, z] = this.p(lx, lz);
    const turn = ((Math.round(this.ry / (Math.PI / 2)) % 4) + 4) % 4;
    const order = ['front', 'right', 'back', 'left'];
    const s2 = order[(order.indexOf(side) + turn) % 4];
    const [wx, wz] = turn % 2 ? [sz, sx] : [sx, sz];
    return this.k.windows(s2, x, z, wx, wz, this.y + y0, floors, fh, o);
  }
}

// ---------- Boden, Wege, Markierungen
export function lot(k, W, D, mat = 'concrete', o = {}) {
  const inset = o.inset ?? 0.15 * M;
  k.box(mat, 0, 0, 0, W - inset * 2, LOT, D - inset * 2);
  if (o.curb !== false && D1(k)) {
    const c = o.curbMat || 'curb', t = 0.25 * M, h = LOT + 0.1 * M;
    k.box(c, 0, 0, D / 2 - inset - t / 2, W - inset * 2, h, t);
    k.box(c, 0, 0, -D / 2 + inset + t / 2, W - inset * 2, h, t);
    k.box(c, -W / 2 + inset + t / 2, 0, 0, t, h, D - inset * 2 - t * 2);
    k.box(c, W / 2 - inset - t / 2, 0, 0, t, h, D - inset * 2 - t * 2);
  }
}
// Weg als Polylinie (flach), mit runden Gelenken
export function walk(k, mat, pts, w, top = PAVE, o = {}) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 1e-5) continue;
    k.box(mat, (x0 + x1) / 2, 0, (z0 + z1) / 2, w, top, len, { ry: Math.atan2(x1 - x0, z1 - z0) });
  }
  if (o.joints !== false && k.detail > 0) for (let i = 1; i < pts.length - 1; i++) k.cyl(mat, pts[i][0], 0, pts[i][1], w / 2, top, { seg: segs(k, 10) });
}
// Weiße Linie auf dem Boden
export function line(k, x0, z0, x1, z1, w = 0.12 * M, mat = 'paint_white', top = MARK) {
  if (!D1(k)) return;
  const len = Math.hypot(x1 - x0, z1 - z0);
  k.box(mat, (x0 + x1) / 2, 0, (z0 + z1) / 2, w, top, len, { ry: Math.atan2(x1 - x0, z1 - z0) });
}
// Parkplatz: Asphaltfläche, Stellplatzlinien, geparkte Autos. Stellplätze stehen quer zur x-Achse.
export function parking(k, x, z, sx, sz, o = {}) {
  slab(k, o.mat || 'asphalt', x, z, sx, sz);
  const n = Math.max(1, Math.floor(sx / (2.6 * M)));
  const rows = o.rows ?? (sz > 9 * M ? 2 : 1);
  const depth = 5 * M;
  const cols = o.colors || CAR_COLORS;
  for (let r = 0; r < rows; r++) {
    const zr = rows === 1 ? z : z + (r === 0 ? -1 : 1) * (sz / 2 - depth / 2 - 0.2 * M);
    const facing = rows === 1 ? (o.facing ?? 0) : (r === 0 ? Math.PI : 0);
    for (let i = 0; i <= n; i++) {
      const xi = x - (n * 2.6 * M) / 2 + i * 2.6 * M;
      if (D2(k)) line(k, xi, zr - depth / 2 + 0.3 * M, xi, zr + depth / 2 - 0.3 * M);
      if (i < n && k.detail > 0 && k.rng() < (o.fill ?? 0.6)) car(k, xi + 1.3 * M, zr, facing + (k.rng() - 0.5) * 0.06, pick(k.rng, cols));
    }
  }
}

// ---------- Pflanzen
const LEAVES = ['leaves_green', 'leaves_dark', 'leaves_light'];
// Laubbaum, Höhe ≈ 9 m × s
export function tree(k, x, z, s = 1, o = {}) {
  const leaf = o.leaf || pick(k.rng, LEAVES);
  const r = 2.6 * M * s;
  if (k.detail === 0) { k.add(leaf, new THREE.IcosahedronGeometry(r, 0), { x, y: 5.4 * M * s, z, sy: 0.9 }); return; }
  k.cyl('bark', x, 0, z, 0.2 * M * s, 4.2 * M * s, { seg: 5, rTop: 0.12 * M * s });
  k.add(leaf, new THREE.IcosahedronGeometry(r, k.detail >= 2 ? 1 : 0), { x, y: 5.6 * M * s, z, sy: 0.88, ry: k.rng() * 6 });
  if (k.detail >= 2) {
    const a = k.rng() * Math.PI * 2;
    k.add(leaf, new THREE.IcosahedronGeometry(r * 0.62, 1), { x: x + Math.cos(a) * r * 0.62, y: 4.7 * M * s, z: z + Math.sin(a) * r * 0.62, ry: a });
  }
}
// Nadelbaum, Höhe ≈ 11 m × s
export function conifer(k, x, z, s = 1, o = {}) {
  const leaf = o.leaf || (k.rng() < 0.6 ? 'leaves_dark' : 'hedge');
  if (k.detail === 0) { k.cone(leaf, x, 0.5 * M * s, z, 2.1 * M * s, 10 * M * s, { seg: 5 }); return; }
  k.cyl('bark', x, 0, z, 0.18 * M * s, 2 * M * s, { seg: 5 });
  const n = k.detail >= 2 ? 3 : 2;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    k.cone(leaf, x, (1.4 + t * 6.4) * M * s, z, (2.3 - t * 1.2) * M * s, (5.6 - t * 1.5) * M * s, { seg: 7, ry: i });
  }
}
// Säulenförmiger Baum (Pappel/Zypresse)
export function poplar(k, x, z, s = 1, o = {}) {
  const leaf = o.leaf || 'leaves_dark';
  if (k.detail > 0) k.cyl('bark', x, 0, z, 0.15 * M * s, 1.5 * M * s, { seg: 5 });
  k.add(leaf, new THREE.IcosahedronGeometry(1.1 * M * s, k.detail >= 2 ? 1 : 0), { x, y: 5 * M * s, z, sy: 4 });
}
export function bush(k, x, z, s = 1, leaf) {
  if (k.detail === 0) return;
  k.add(leaf || pick(k.rng, LEAVES), new THREE.IcosahedronGeometry(0.8 * M * s, 0), { x, y: 0.55 * M * s, z, sy: 0.75, ry: k.rng() * 3 });
}
export function flowerBed(k, x, z, sx, sz, o = {}) {
  k.box(o.edge || 'stone_grey', x, 0, z, sx, 0.35 * M, sz);
  k.box('dirt', x, 0, z, sx - 0.3 * M, 0.42 * M, sz - 0.3 * M);
  if (!D2(k)) return;
  const cols = o.colors || ['paint_red', 'paint_yellow', 'paint_white', 'awning_red', 'plaster_pink'];
  const n = Math.max(2, Math.round((sx * sz) / (0.9 * M * 0.9 * M) * 0.35));
  for (let i = 0; i < Math.min(n, 18); i++) {
    k.box(pick(k.rng, cols), x + (k.rng() - 0.5) * (sx - 0.8 * M), 0.4 * M, z + (k.rng() - 0.5) * (sz - 0.8 * M), 0.45 * M, 0.25 * M, 0.45 * M);
  }
}

// ---------- Stadtmöbel (nur Nahsicht)
export function bench(k, x, z, ry = 0) {
  if (!D2(k)) return;
  const g = new G(k, x, z, ry);
  g.box('wood_planks', 0, 0.42 * M, 0, 1.7 * M, 0.08 * M, 0.45 * M);
  g.box('wood_planks', 0, 0.55 * M, -0.22 * M, 1.7 * M, 0.4 * M, 0.06 * M);
  for (const s of [-0.7, 0.7]) g.box('metal_dark', s * M, 0, 0, 0.08 * M, 0.45 * M, 0.42 * M);
}
export function lamp(k, x, z, h = 4.5 * M, o = {}) {
  if (!D2(k)) return;
  k.cyl(o.mat || 'metal_dark', x, 0, z, 0.07 * M, h, { seg: 6 });
  if (o.globe) k.sphere('emissive_warm', x, h + 0.2 * M, z, 0.28 * M, { seg: 8 });
  else k.box('emissive_warm', x, h, z, 0.45 * M, 0.18 * M, 0.45 * M);
  k.light(x, h + 0.1 * M, z, o.color ?? 0xffd79a, o.size ?? 0.35);
}
export function bin(k, x, z) { if (D2(k)) k.cyl('metal_dark', x, 0, z, 0.25 * M, 0.9 * M, { seg: 7 }); }
export function bollards(k, x0, z0, x1, z1, n) {
  if (!D2(k)) return;
  for (let i = 0; i < n; i++) { const t = n === 1 ? 0.5 : i / (n - 1); k.cyl('metal_dark', x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, 0.08 * M, 0.9 * M, { seg: 6 }); }
}
export function flagpole(k, x, z, h = 8 * M, flag = 'paint_red', ry = 0) {
  if (!D1(k)) return;
  k.cyl('metal_light', x, 0, z, 0.06 * M, h, { seg: 6 });
  const g = new G(k, x, z, ry);
  g.box(flag, 0.8 * M, h - 1.1 * M, 0, 1.5 * M, 1.0 * M, 0.04 * M);
}
export function bikeRack(k, x, z, ry = 0, n = 4) {
  if (!D2(k)) return;
  const g = new G(k, x, z, ry);
  g.box('metal_light', 0, 0.75 * M, 0, n * 0.8 * M, 0.06 * M, 0.06 * M);
  for (let i = 0; i < n; i++) g.box(pick(k.rng, ['paint_red', 'paint_blue', 'metal_dark', 'paint_green']), (i - (n - 1) / 2) * 0.8 * M, 0.3 * M, 0, 0.08 * M, 0.7 * M, 1.7 * M);
}

// ---------- Zäune und Mauern
export function fence(k, x0, z0, x1, z1, o = {}) {
  if (!D1(k)) return;
  const h = o.h ?? 2 * M, mat = o.mat || 'chain_fence', post = o.post || (o.mat && o.mat !== 'chain_fence' ? o.mat : 'chain_fence');
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len < 1e-4) return;
  const ry = Math.atan2(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  if (o.solid) k.box(mat, cx, 0, cz, 0.05 * M, h, len, { ry });
  else {
    k.box(mat, cx, h - 0.06 * M, cz, 0.06 * M, 0.06 * M, len, { ry });
    k.box(mat, cx, h * 0.5, cz, 0.04 * M, 0.04 * M, len, { ry });
    if (D2(k)) k.box(mat, cx, 0.1 * M, cz, 0.04 * M, 0.04 * M, len, { ry });
  }
  if (D2(k)) {
    const n = Math.max(1, Math.round(len / (o.step ?? 3 * M)));
    for (let i = 0; i <= n; i++) { const t = i / n; k.box(post, x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, 0.07 * M, h + 0.05 * M, 0.07 * M); }
    if (o.wire) k.box('metal_light', cx, h + 0.15 * M, cz, 0.25 * M, 0.25 * M, len, { ry });
  }
}
// Zaun um ein Rechteck; gate = Lückenbreite vorne (Mitte bei gateX)
export function fenceRect(k, x, z, sx, sz, o = {}) {
  const x0 = x - sx / 2, x1 = x + sx / 2, z0 = z - sz / 2, z1 = z + sz / 2;
  fence(k, x0, z0, x1, z0, o);
  fence(k, x0, z0, x0, z1, o);
  fence(k, x1, z0, x1, z1, o);
  const gw = o.gate ?? 0;
  if (gw > 0) {
    const gx = o.gateX ?? x;
    fence(k, x0, z1, gx - gw / 2, z1, o);
    fence(k, gx + gw / 2, z1, x1, z1, o);
    if (D2(k) && o.gatePosts !== false) for (const s of [-1, 1]) k.box(o.postMat || 'metal_dark', gx + (s * gw) / 2, 0, z1, 0.2 * M, (o.h ?? 2 * M) + 0.3 * M, 0.2 * M);
  } else fence(k, x0, z1, x1, z1, o);
}
export function wall(k, x0, z0, x1, z1, h, o = {}) {
  const t = o.t ?? 0.4 * M, mat = o.mat || 'brick_red';
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len < 1e-4) return;
  const ry = Math.atan2(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  k.box(mat, cx, 0, cz, t, h, len, { ry });
  if (D1(k) && o.cap !== false) k.box(o.cap || 'trim_stone', cx, h, cz, t + 0.12 * M, 0.15 * M, len + 0.12 * M, { ry });
  if (D2(k) && o.piers) {
    const n = Math.max(1, Math.round(len / o.piers));
    for (let i = 0; i <= n; i++) { const tt = i / n; k.box(mat, x0 + (x1 - x0) * tt, 0, z0 + (z1 - z0) * tt, t * 1.6, h + 0.2 * M, t * 1.6, { ry }); }
  }
}
export function hedgeLine(k, x0, z0, x1, z1, h = 1.1 * M, w = 0.8 * M) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  k.box('hedge', (x0 + x1) / 2, 0, (z0 + z1) / 2, w, h, len, { ry: Math.atan2(x1 - x0, z1 - z0) });
}

// ---------- Gebäudeteile
// Quader-Bau mit Sockel, Fenstern, Gesims und Dach. Rückgabe: Traufhöhe
export function block(k, o) {
  const x = o.x ?? 0, z = o.z ?? 0, w = o.w, d = o.d, y0 = o.y0 ?? 0;
  const floors = o.floors ?? 1, fh = o.fh ?? FLOOR;
  const h = o.h ?? floors * fh;
  const wall = o.wall || 'plaster_white';
  k.box(wall, x, y0, z, w, h, d);
  if (o.plinth !== false) k.box(o.plinth || 'stone_grey', x, y0, z, w + 0.14 * M, o.plinthH ?? Math.min(0.6 * M, h * 0.3), d + 0.14 * M);
  if (o.win !== false) {
    const sides = o.sides || ['front', 'back', 'left', 'right'];
    for (const s of sides) k.windows(s, x, z, w, d, y0, floors, fh, { frame: 'window_frame_white', ...(o.win || {}), ...((o.winSide && o.winSide[s]) || {}), skipGround: o.skipGround === true || (o.skipGround === 'front' && s === 'front') });
  }
  if (o.bands && D1(k)) for (let f = 1; f < floors; f++) k.band(o.bands, x, z, w, d, y0 + f * fh - 0.08 * M, 0.16 * M, 0.06 * M);
  const top = y0 + h;
  if (o.cornice && D1(k)) k.band(o.cornice, x, z, w, d, top - 0.3 * M, 0.3 * M, 0.14 * M);
  const roof = o.roof ?? 'flat';
  if (roof === 'flat') {
    k.flatRoof(o.roofMat || 'roof_flat_gravel', o.parapet || o.cornice || wall, x, top, z, w, d, { parapet: o.parapetH ?? 0.6 * M });
    if (o.clutter) k.rooftopClutter(x, top, z, w, d, o.clutter);
  } else if (roof === 'gable') {
    const rh = o.roofH ?? Math.min(w, d) * 0.4;
    k.gableRoof(o.roofMat || 'roof_tiles_red', x, top, z, w, d, rh, { ridge: o.ridge, overhang: o.overhang ?? 0.45 * M });
    k.gableEnds(o.gableMat || wall, x, top, z, w, d, rh, { ridge: o.ridge });
    return top;
  } else if (roof === 'hip') {
    k.hipRoof(o.roofMat || 'roof_tiles_red', x, top, z, w, d, o.roofH ?? Math.min(w, d) * 0.35, { overhang: o.overhang ?? 0.45 * M, ridgeK: o.ridgeK });
  } else if (roof === 'shed') {
    k.shedRoof(o.roofMat || 'roof_metal_grey', x, top, z, w, d, o.roofH ?? 1 * M);
  }
  return top;
}
// Fensterband (moderne Bänder) auf einer Seite eines Quaders
export function ribbon(k, side, cx, cz, sx, sz, y, h, o = {}) {
  const along = side === 'front' || side === 'back' ? sx : sz;
  const len = along - (o.margin ?? 0.6 * M) * 2;
  const off = 0.04 * M;
  let px = cx, pz = cz, ry = 0;
  if (side === 'front') pz = cz + sz / 2 + off; else if (side === 'back') { pz = cz - sz / 2 - off; ry = Math.PI; }
  else if (side === 'right') { px = cx + sx / 2 + off; ry = Math.PI / 2; } else { px = cx - sx / 2 - off; ry = -Math.PI / 2; }
  if (k.detail === 0) {
    const n = Math.max(1, Math.round(len / (1.6 * M)));
    const geo = new THREE.PlaneGeometry(len, h);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * n, uv.getY(i) * 0.9 + 0.1);
    k.add('lod_windows', geo, { x: px, y: y + h / 2, z: pz, ry, uv: 'keep', lit: k.rng() });
    return;
  }
  const g = new G(k, px, pz, ry);
  g.box(o.frame || 'window_frame_dark', 0, y - 0.1 * M, -0.05 * M, len + 0.2 * M, h + 0.2 * M, 0.1 * M);
  const n = Math.max(1, Math.round(len / (o.pane ?? 1.4 * M)));
  for (let i = 0; i < n; i++) g.quad(o.glass || 'glass_window', -len / 2 + (i + 0.5) * (len / n), y + h / 2, 0.02 * M, len / n - 0.02 * M, h, { lit: k.rng() });
  if (D2(k)) for (let i = 1; i < n; i++) g.box(o.frame || 'window_frame_dark', -len / 2 + i * (len / n), y, 0.02 * M, 0.08 * M, h, 0.06 * M);
}
// Sprossenfenster (Industrie, Hallen): Glas + Raster
export function gridWindow(k, x, y0, z, ry, w, h, cols, rows, o = {}) {
  const g = new G(k, x, z, ry);
  const fr = o.frame || 'window_frame_dark';
  if (k.detail === 0) {
    const geo = new THREE.PlaneGeometry(w, h);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * cols, uv.getY(i) * rows);
    g.add('lod_windows', geo, { y: y0 + h / 2, z: 0.03 * M, uv: 'keep', lit: k.rng() });
    return;
  }
  g.box(fr, 0, y0 - 0.12 * M, -0.04 * M, w + 0.24 * M, h + 0.24 * M, 0.1 * M);
  g.quad(o.glass || 'glass_window', 0, y0 + h / 2, 0.03 * M, w, h, { lit: k.rng() });
  if (o.arch) { // Rundbogen oben
    const geo = new THREE.CircleGeometry(w / 2, D2(k) ? 10 : 6, 0, Math.PI);
    g.box(fr, 0, y0 + h, -0.04 * M, w + 0.24 * M, 0.12 * M, 0.1 * M);
    g.add(o.glass || 'glass_window', geo, { y: y0 + h, z: 0.03 * M, lit: k.rng() });
    const ar = new THREE.RingGeometry(w / 2, w / 2 + 0.16 * M, D2(k) ? 10 : 6, 1, 0, Math.PI);
    g.add(o.archMat || fr, ar, { y: y0 + h, z: 0.04 * M });
  }
  if (!D2(k)) return;
  for (let i = 1; i < cols; i++) g.box(fr, -w / 2 + (i * w) / cols, y0, 0.04 * M, 0.07 * M, h, 0.05 * M);
  for (let j = 1; j < rows; j++) g.box(fr, 0, y0 + (j * h) / rows - 0.035 * M, 0.04 * M, w, 0.07 * M, 0.05 * M);
}
// Reihe von Sprossenfenstern gleichmäßig auf einer Seite eines Quaders
export function gridRow(k, side, cx, cz, sx, sz, n, y0, w, h, cols, rows, o = {}) {
  const along = side === 'front' || side === 'back' ? sx : sz;
  const span = along - (o.margin ?? 1 * M) * 2;
  for (let i = 0; i < n; i++) {
    const a = -span / 2 + (span * (i + 0.5)) / n + (o.shift || 0);
    let x, z, ry;
    if (side === 'front') { x = cx + a; z = cz + sz / 2; ry = 0; }
    else if (side === 'back') { x = cx - a; z = cz - sz / 2; ry = Math.PI; }
    else if (side === 'right') { x = cx + sx / 2; z = cz - a; ry = Math.PI / 2; }
    else { x = cx - sx / 2; z = cz + a; ry = -Math.PI / 2; }
    gridWindow(k, x, y0, z, ry, w, h, cols, rows, o);
  }
}
// Position auf einer Seite eines Quaders (a = Versatz entlang der Seite) → [x, z, ry]
export function onSide(side, cx, cz, sx, sz, a = 0, out = 0) {
  if (side === 'front') return [cx + a, cz + sz / 2 + out, 0];
  if (side === 'back') return [cx - a, cz - sz / 2 - out, Math.PI];
  if (side === 'right') return [cx + sx / 2 + out, cz - a, Math.PI / 2];
  return [cx - sx / 2 - out, cz + a, -Math.PI / 2];
}
// Tür an beliebiger Stelle (Blickrichtung ry)
export function door(k, x, z, ry = 0, o = {}) {
  const g = new G(k, x, z, ry);
  const w = o.w ?? 1.2 * M, h = o.h ?? 2.3 * M;
  if (k.detail === 0) { g.box(o.glass ? 'trim_dark' : (o.mat || 'door_wood'), 0, o.y0 ?? 0, 0, w + 0.2 * M, h + 0.1 * M, 0.14 * M); return; }
  g.box(o.frame || 'trim_dark', 0, o.y0 ?? 0, 0, w + 0.24 * M, h + 0.12 * M, 0.12 * M);
  if (o.glass) g.quad('glass_window', 0, (o.y0 ?? 0) + h / 2, 0.07 * M, w, h, { lit: 0.95 });
  else g.box(o.mat || 'door_wood', 0, o.y0 ?? 0, 0.02 * M, w, h, 0.1 * M);
  if (o.canopy && D1(k)) g.box(o.canopy, 0, (o.y0 ?? 0) + h + 0.3 * M, 0.6 * M, w + 1.2 * M, 0.15 * M, 1.3 * M);
}
// Rolltor / Hallentor mit Rahmen und Lamellen
export function rollerDoor(k, x, z, ry, w, h, o = {}) {
  const g = new G(k, x, z, ry, o.y0 || 0);
  const fr = o.frame || 'concrete_dark';
  g.box(fr, 0, 0, -0.02 * M, w + 0.4 * M, h + 0.25 * M, 0.14 * M);
  if (o.open) {
    g.box('rubber', 0, 0, 0.0 * M, w, h, 0.1 * M);
    g.box(o.mat || 'metal_panel_grey', 0, h - 0.45 * M, 0.08 * M, w, 0.45 * M, 0.12 * M);
    return;
  }
  g.box(o.mat || 'metal_panel_grey', 0, 0, 0.04 * M, w, h, 0.08 * M);
  if (!D2(k)) return;
  if (o.glassRow) g.quad('glass_window', 0, h * 0.72, 0.13 * M, w * 0.9, h * 0.13, { lit: k.rng() });
  const n = o.ribs ?? 5;
  for (let i = 1; i <= n; i++) g.box(o.rib || 'metal_dark', 0, (i * h) / (n + 1), 0.1 * M, w * 0.98, 0.05 * M, 0.04 * M);
}
// Vordach mit Stützen
export function canopy(k, x, y, z, sx, sz, o = {}) {
  k.box(o.mat || 'concrete', x, y, z, sx, o.t ?? 0.25 * M, sz);
  if (o.posts !== false && D1(k)) for (const s of [-1, 1]) k.cyl(o.post || 'metal_dark', x + s * (sx / 2 - 0.3 * M), 0, z + sz / 2 - 0.3 * M, 0.1 * M, y, { seg: 6 });
}
// Treppe nach vorne (+z), n Stufen
export function steps(k, x, z, w, n, rise = 0.17 * M, run = 0.32 * M, mat = 'stone_grey') {
  if (k.detail === 0) { k.box(mat, x, 0, z + (n * run) / 2, w, n * rise * 0.6, n * run); return; }
  for (let i = 0; i < n; i++) k.box(mat, x, 0, z + (n - i - 0.5) * run - run * 0, w, (i + 1) * rise, run);
}
// Säulenreihe (in x), Basis y0
export function columns(k, x0, x1, z, y0, h, n, r = 0.3 * M, o = {}) {
  const mat = o.mat || 'trim_stone';
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (n - 1);
    k.cyl(mat, x, y0, z, r, h, { seg: segs(k, o.seg ?? 10) });
    if (D2(k)) { k.box(mat, x, y0, z, r * 2.6, 0.25 * M, r * 2.6); k.box(mat, x, y0 + h - 0.25 * M, z, r * 2.6, 0.25 * M, r * 2.6); }
  }
}
// Giebeldreieck (Tympanon) an der Front, Breite w, Höhe h, Tiefe d
export function pediment(k, x, y0, z, w, h, d, mat = 'trim_stone') {
  k.prism(mat, [[-w / 2, 0], [w / 2, 0], [0, h]], d, { x, y: y0, z });
}

// ---------- Technik
// Schornstein mit Ringen, Plattform und Rauch
export function stack(k, x, z, h, o = {}) {
  const r = o.r ?? 1 * M, rt = o.rTop ?? r * 0.72, mat = o.mat || 'concrete', y0 = o.y0 ?? 0;
  const seg = segs(k, o.seg ?? 16);
  k.cyl(mat, x, y0, z, r, h, { rTop: rt, seg });
  const rAt = (y) => r + (rt - r) * (y / h);
  const nb = o.bands ?? 0;
  if (nb && k.detail >= 1) {
    const bh = o.bandH ?? h * 0.06;
    for (let i = 0; i < nb; i++) {
      const y1 = h - (i * 2 + 1) * bh - (o.capH ?? 0.6 * M), y2 = y1 + bh;
      k.cyl(o.bandMat || 'paint_red', x, y0 + y1, z, rAt(y1) + 0.03 * M, bh, { rTop: rAt(y2) + 0.03 * M, seg, open: true });
    }
  }
  k.cyl(o.capMat || 'concrete_dark', x, y0 + h - (o.capH ?? 0.6 * M), z, rt + 0.08 * M, o.capH ?? 0.6 * M, { seg });
  if (D2(k) && o.platform !== false && h > 15 * M) {
    const py = h * (o.platformAt ?? 0.7), pr = rAt(py) + 0.6 * M;
    k.cyl('metal_dark', x, y0 + py, z, pr, 0.15 * M, { seg });
    k.cyl('metal_dark', x, y0 + py + 0.15 * M, z, pr, 1 * M, { seg, open: true, rTop: pr });
  }
  if (D2(k) && o.ladder !== false) beam(k, 'metal_dark', [x, y0 + 0.5 * M, z + r + 0.15 * M], [x, y0 + h - 0.6 * M, z + rt + 0.15 * M], 0.12 * M, { d: 0.05 * M });
  if (o.smoke !== false) k.smoke(x, y0 + h + 0.2 * M, z, o.type || 'smoke', o.amount ?? 1);
  if (o.light !== false && h > 25 * M) { k.light(x, y0 + h + 0.1 * M, z, 0xff3a2a, 0.25); }
}
// Naturzug-Kühlturm (Hyperboloid) mit Dampf
export function coolingTower(k, x, z, rb, h, o = {}) {
  const seg = segs(k, o.seg ?? 30);
  const rT = rb * (o.throat ?? 0.6), yT = h * (o.ty ?? 0.8), y0 = h * 0.07;
  const b = (yT - y0) / Math.sqrt((rb / rT) ** 2 - 1);
  const rAt = (y) => rT * Math.sqrt(1 + ((y - yT) / b) ** 2);
  const n = k.detail >= 2 ? 11 : k.detail === 1 ? 7 : 4;
  const prof = [];
  for (let i = 0; i <= n; i++) { const y = y0 + ((h - y0) * i) / n; prof.push([rAt(y), y]); }
  const wt = Math.max(0.25 * M, rb * 0.03);
  prof.push([rAt(h) - wt, h]);
  if (k.detail > 0) for (let i = 1; i <= 3; i++) { const y = h - (h * 0.35 * i) / 3; prof.push([rAt(y) - wt, y]); }
  lathe(k, o.mat || 'concrete', x, 0, z, prof, seg);
  // dunkle Öffnung zwischen den Stützen + Stützenkranz
  k.cyl('concrete_dark', x, 0, z, rb * 0.97, y0 + 0.05 * M, { seg, open: true });
  if (k.detail > 0) disk(k, 'concrete_dark', x, y0 * 0.6, z, rb * 0.96, { seg });
  if (D2(k)) {
    const nc = Math.round(seg * 0.7);
    for (let i = 0; i < nc; i++) {
      const a = (i / nc) * Math.PI * 2, a2 = a + Math.PI / nc;
      beam(k, o.mat || 'concrete', [x + Math.cos(a) * rb * 1.02, 0, z + Math.sin(a) * rb * 1.02], [x + Math.cos(a2) * rb, y0 + 0.05 * M, z + Math.sin(a2) * rb], 0.3 * M);
    }
  }
  if (k.detail > 0) k.cyl(o.mat || 'concrete', x, 0, z, rb * 1.1, 0.7 * M, { seg, open: true });
  if (D2(k) && o.bands) for (const t of [0.86, 0.92]) { const y = h * t; k.cyl(o.bands, x, y, z, rAt(y) + 0.04 * M, h * 0.03, { rTop: rAt(y + h * 0.03) + 0.04 * M, seg, open: true }); }
  if (o.steam !== false) { k.smoke(x, h + 0.3 * M, z, 'steam', o.steam ?? 2); if (rb > 4 * M) k.smoke(x + rT * 0.3, h + 0.3 * M, z - rT * 0.3, 'steam', (o.steam ?? 2) * 0.6); }
  return rAt;
}
// Stehender Tank mit Kuppel-, Kegel- oder Flachdach
export function tank(k, x, z, r, h, o = {}) {
  const mat = o.mat || 'tank_white', y0 = o.y0 ?? 0, seg = segs(k, o.seg ?? 18);
  k.cyl(mat, x, y0, z, r, h, { seg });
  const roof = o.roof || 'dome';
  if (roof === 'dome') k.dome(o.roofMat || mat, x, y0 + h, z, r, { seg, sy: o.domeK ?? 0.22 });
  else if (roof === 'cone') k.cone(o.roofMat || mat, x, y0 + h, z, r * 1.02, r * (o.coneK ?? 0.35), { seg });
  if (D2(k)) {
    if (o.rings !== false) for (const t of o.ringsAt || [0.33, 0.66]) k.cyl(o.ringMat || 'metal_light', x, y0 + h * t, z, r + 0.05 * M, 0.18 * M, { seg, open: true });
    if (o.ladder !== false) {
      const a = o.ladderA ?? Math.PI * 0.25;
      beam(k, 'metal_dark', [x + Math.sin(a) * (r + 0.2 * M), y0, z + Math.cos(a) * (r + 0.2 * M)], [x + Math.sin(a) * (r + 0.2 * M), y0 + h, z + Math.cos(a) * (r + 0.2 * M)], 0.14 * M, { d: 0.06 * M });
    }
    if (o.rail) k.cyl('metal_dark', x, y0 + h + (roof === 'flat' ? 0 : r * 0.05), z, r * 0.98, 0.9 * M, { seg, open: true });
  }
  if (o.band && k.detail > 0) k.cyl(o.band, x, y0 + h * 0.78, z, r + 0.03 * M, h * 0.1, { seg, open: true });
}
// Kugelbehälter auf Stützen
export function sphereTank(k, x, z, r, o = {}) {
  const mat = o.mat || 'tank_white', cy = o.y ?? r * 1.25;
  k.sphere(mat, x, cy, z, r, { seg: segs(k, 18) });
  if (k.detail === 0) return;
  const n = o.legs ?? 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2;
    pipe(k, o.legMat || 'metal_light', [x + Math.cos(a) * r * 0.98, 0, z + Math.sin(a) * r * 0.98], [x + Math.cos(a) * r * 0.98, cy, z + Math.sin(a) * r * 0.98], 0.2 * M, { seg: 6, open: false });
  }
  if (D2(k)) {
    k.cyl('metal_light', x, cy - 0.15 * M, z, r + 0.05 * M, 0.3 * M, { seg: segs(k, 18), open: true });
    if (o.stair !== false) beam(k, 'metal_dark', [x + r * 1.4, 0, z], [x + r * 0.15, cy + r * 0.98, z], 0.45 * M, { d: 0.08 * M });
  }
}
// Hochsilo mit Trichter auf Stützen
export function silo(k, x, z, r, h, o = {}) {
  const mat = o.mat || 'metal_light', seg = segs(k, o.seg ?? 14), leg = o.leg ?? 2.5 * M, hop = r * 0.9;
  if (o.hopper !== false) {
    if (k.detail > 0) for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2; k.box('metal_dark', x + Math.cos(a) * r * 0.85, 0, z + Math.sin(a) * r * 0.85, 0.25 * M, leg + hop, 0.25 * M); }
    k.add(mat, new THREE.CylinderGeometry(r, 0.25 * M, hop, seg), { x, y: leg + hop / 2, z });
    k.cyl(mat, x, leg + hop, z, r, h, { seg });
    k.cone(o.roofMat || mat, x, leg + hop + h, z, r * 1.03, r * 0.45, { seg });
  } else {
    k.cyl(mat, x, 0, z, r, h, { seg });
    k.cone(o.roofMat || mat, x, h, z, r * 1.03, r * 0.45, { seg });
  }
  if (D2(k) && o.rings !== false) { const y0 = o.hopper === false ? 0 : leg + hop; for (let i = 1; i < 4; i++) k.cyl('metal_dark', x, y0 + (h * i) / 4, z, r + 0.04 * M, 0.12 * M, { seg, open: true }); }
}
// Trafo mit Kühlrippen und Durchführungen
export function transformer(k, x, z, ry = 0, s = 1) {
  const g = new G(k, x, z, ry);
  g.box('concrete', 0, 0, 0, 3.2 * M * s, 0.3 * M, 2.6 * M * s);
  g.box('metal_panel_grey', 0, 0.3 * M, 0, 2.2 * M * s, 2.3 * M * s, 1.5 * M * s);
  if (k.detail === 0) return;
  g.cyl('metal_panel_grey', -0.6 * M * s, 0.3 * M + 2.3 * M * s, 0, 0.35 * M * s, 0.4 * M * s, { seg: 8 });
  if (!D2(k)) return;
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) g.box('metal_panel_grey', (-0.75 + i * 0.5) * M * s, 0.45 * M, side * 0.95 * M * s, 0.08 * M, 1.9 * M * s, 0.45 * M * s);
  for (let i = 0; i < 3; i++) g.cyl('trim_dark', (-0.6 + i * 0.6) * M * s, 0.3 * M + 2.3 * M * s, 0.25 * M * s, 0.1 * M * s, 1.1 * M * s, { seg: 6 });
}
// Gitter-Strommast
export function pylon(k, x, z, h, ry = 0, o = {}) {
  const g = new G(k, x, z, ry);
  const mat = o.mat || 'metal_light', b = (o.base ?? 2.6) * M, t = 0.5 * M;
  if (k.detail === 0) { g.cyl(mat, 0, 0, 0, b * 0.6, h, { seg: 4, rTop: t * 0.6 }); g.box(mat, 0, h * 0.78, 0, 6 * M, 0.25 * M, 0.25 * M); return; }
  const lv = (y) => b + (t - b) * (y / h);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of corners) g.beam(mat, [sx * b / 2, 0, sz * b / 2], [sx * t / 2, h, sz * t / 2], 0.14 * M);
  const arms = o.arms || [[0.72, 7], [0.9, 5]];
  for (const [ty, len] of arms) {
    const y = h * ty;
    g.beam(mat, [-len / 2 * M, y, 0], [len / 2 * M, y, 0], 0.16 * M);
    if (D2(k)) for (const s of [-1, 1]) {
      g.beam(mat, [s * lv(y) / 2, y - 1.2 * M, 0], [s * (len / 2) * M, y, 0], 0.08 * M);
      g.cyl('trim_dark', s * (len / 2 - 0.3) * M, y - 1.1 * M, 0, 0.07 * M, 1.1 * M, { seg: 5 });
    }
  }
  if (D2(k)) {
    const nl = 4;
    for (let i = 0; i < nl; i++) {
      const y1 = (h * 0.7 * i) / nl, y2 = (h * 0.7 * (i + 1)) / nl;
      for (const [ax, az, bx, bz] of [[-1, 1, 1, 1], [1, -1, -1, -1]]) {
        g.beam(mat, [ax * lv(y1) / 2, y1, az * lv(y1) / 2], [bx * lv(y2) / 2, y2, bz * lv(y2) / 2], 0.06 * M);
        g.beam(mat, [az * lv(y1) / 2, y1, ax * lv(y1) / 2], [bz * lv(y2) / 2, y2, bx * lv(y2) / 2], 0.06 * M);
      }
    }
  }
  g.cone(mat, 0, h, 0, t * 0.6, 1.2 * M, { seg: 4 });
}
// Portal (zwei Stützen + Riegel), z. B. im Umspannwerk
export function gantry(k, x, z, w, h, ry = 0, mat = 'metal_light') {
  const g = new G(k, x, z, ry);
  for (const s of [-1, 1]) g.box(mat, (s * w) / 2, 0, 0, 0.3 * M, h, 0.3 * M);
  g.box(mat, 0, h - 0.3 * M, 0, w + 0.3 * M, 0.3 * M, 0.3 * M);
  if (D2(k)) for (let i = 0; i < 3; i++) g.cyl('trim_dark', (i - 1) * (w / 3), h - 1.4 * M, 0, 0.08 * M, 1.1 * M, { seg: 5 });
}
// Umspannfeld: Kies, Trafos, Portale, Zaun
export function substation(k, x, z, sx, sz, o = {}) {
  slab(k, 'gravel', x, z, sx, sz, PAVE * 0.8);
  const n = o.n ?? Math.max(1, Math.floor(sx / (4.2 * M)));
  for (let i = 0; i < n; i++) {
    const tx = x - sx / 2 + (i + 0.5) * (sx / n);
    transformer(k, tx, z + sz * 0.12, 0, o.s ?? 0.9);
    if (k.detail > 0 && o.gantry !== false) gantry(k, tx, z - sz * 0.28, Math.min(3.4 * M, sx / n - 0.4 * M), 5.5 * M);
  }
  if (o.fence !== false) fenceRect(k, x, z, sx, sz, { h: 2.2 * M, gate: 2.5 * M });
}
// Lüftungs-/Rückkühler-Ventilator (liegender Ring mit dunkler Öffnung)
export function fanUnit(k, x, y0, z, r, o = {}) {
  const seg = segs(k, 14);
  k.cyl(o.mat || 'metal_panel_grey', x, y0, z, r, o.h ?? 0.9 * M, { seg, open: true });
  disk(k, 'metal_dark', x, y0 + (o.h ?? 0.9 * M) * 0.6, z, r * 0.98, { seg });
  if (D2(k)) { const g = new G(k, x, z, k.rng() * 3); g.box('metal_light', 0, y0 + (o.h ?? 0.9 * M) * 0.62, 0, r * 1.8, 0.05 * M, 0.25 * M); g.box('metal_light', 0, y0 + (o.h ?? 0.9 * M) * 0.62, 0, 0.25 * M, 0.05 * M, r * 1.8); }
}
// Rohrbrücke: Stützen + mehrere parallele Rohre von a nach b (in x/z, Höhe h)
export function pipeRack(k, a, b, h, o = {}) {
  const n = o.n ?? 3, r = o.r ?? 0.22 * M, mats = o.mats || ['pipe_metal', 'metal_light', 'paint_yellow'];
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
  const nx = -dz / len, nz = dx / len;
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * (r * 2.6);
    pipe(k, mats[i % mats.length], [a[0] + nx * off, h + r, a[1] + nz * off], [b[0] + nx * off, h + r, b[1] + nz * off], r, { seg: segs(k, 8) });
  }
  if (k.detail === 0) return;
  const ns = Math.max(1, Math.round(len / (o.step ?? 4 * M)));
  const wv = n * r * 2.6 + 0.3 * M;
  for (let i = 0; i <= ns; i++) {
    const t = i / ns, px = a[0] + dx * t, pz = a[1] + dz * t;
    const ry = Math.atan2(dx, dz);
    k.box('metal_dark', px, h - 0.15 * M, pz, wv, 0.15 * M, 0.2 * M, { ry });
    if (D2(k)) for (const s of [-1, 1]) k.box('metal_dark', px + nx * s * wv / 2, 0, pz + nz * s * wv / 2, 0.15 * M, h, 0.15 * M, { ry });
    else k.box('metal_dark', px, 0, pz, 0.2 * M, h, 0.2 * M, { ry });
  }
}
// Leiter/Treppenturm (einfach)
export function ladder(k, x, y0, z, h, ry = 0) {
  if (!D2(k)) return;
  const g = new G(k, x, z, ry);
  for (const s of [-1, 1]) g.box('metal_dark', s * 0.25 * M, y0, 0, 0.06 * M, h, 0.06 * M);
  const n = Math.min(12, Math.floor(h / (0.6 * M)));
  for (let i = 1; i <= n; i++) g.box('metal_dark', 0, y0 + (i * h) / (n + 1), 0, 0.5 * M, 0.04 * M, 0.04 * M);
}
// Geländer entlang einer Strecke (Höhe y)
export function railing(k, x0, z0, x1, z1, y, o = {}) {
  if (!D2(k)) return;
  const h = o.h ?? 1 * M, mat = o.mat || 'metal_dark';
  const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
  k.box(mat, (x0 + x1) / 2, y + h - 0.05 * M, (z0 + z1) / 2, 0.06 * M, 0.06 * M, len, { ry });
  k.box(mat, (x0 + x1) / 2, y + h * 0.5, (z0 + z1) / 2, 0.04 * M, 0.04 * M, len, { ry });
  const n = Math.max(1, Math.round(len / (o.step ?? 1.5 * M)));
  for (let i = 0; i <= n; i++) { const t = i / n; k.box(mat, x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t, 0.05 * M, h, 0.05 * M); }
}
// Hubschrauberlandeplatz (Oberkante y0)
export function helipad(k, x, y0, z, r, o = {}) {
  const seg = segs(k, 24);
  k.cyl(o.base || 'concrete_dark', x, y0, z, r, 0.3 * M, { seg });
  const y = y0 + 0.3 * M + 0.02 * M;
  if (k.detail > 0) ring(k, o.ringMat || 'paint_yellow', x, y, z, r * 0.78, r * 0.88, { seg });
  const s = r * 0.42, w = s * 0.24;
  k.box('paint_white', x - s * 0.42, y - 0.02 * M, z, w, 0.04 * M, s * 1.2);
  k.box('paint_white', x + s * 0.42, y - 0.02 * M, z, w, 0.04 * M, s * 1.2);
  k.box('paint_white', x, y - 0.02 * M, z, s * 0.84, 0.04 * M, w);
  if (D2(k)) for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; k.light(x + Math.cos(a) * r * 0.95, y + 0.1 * M, z + Math.sin(a) * r * 0.95, 0x9fe8a0, 0.12); }
}
// Kreuz (z. B. Rotes Kreuz) als flaches Relief, Blickrichtung ry
export function cross(k, x, y, z, s, mat = 'paint_red', ry = 0, o = {}) {
  const g = new G(k, x, z, ry);
  const t = s * 0.34;
  if (o.plate) g.box(o.plate, 0, y - s * 0.6, -0.03 * M, s * 1.2, s * 1.2, 0.08 * M);
  g.box(mat, 0, y - s / 2, 0.02 * M, t, s, 0.06 * M);
  g.box(mat, 0, y - t / 2, 0.02 * M, s, t, 0.06 * M);
}
// Uhr an der Fassade
export function clock(k, x, y, z, r, ry = 0) {
  const g = new G(k, x, z, ry);
  g.add('trim_dark', new THREE.CylinderGeometry(r * 1.12, r * 1.12, 0.12 * M, segs(k, 16)), { y, z: 0.04 * M, rx: Math.PI / 2 });
  g.add('paint_white', new THREE.CylinderGeometry(r, r, 0.16 * M, segs(k, 16)), { y, z: 0.06 * M, rx: Math.PI / 2 });
  if (!D1(k)) return;
  g.box('metal_dark', 0, y, 0.16 * M, 0.08 * M, r * 0.75, 0.04 * M);
  g.box('metal_dark', r * 0.25, y - 0.04 * M, 0.17 * M, r * 0.55, 0.08 * M, 0.04 * M);
}

// ---------- Schrift (Pixel-Schrift 5×5, Glyphen als Flächen) und Schilder
const FONT = {
  A: ['.###.', '#...#', '#####', '#...#', '#...#'], B: ['####.', '#...#', '####.', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '.####'], D: ['####.', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '####.', '#....', '#####'], F: ['#####', '#....', '####.', '#....', '#....'],
  G: ['.####', '#....', '#..##', '#...#', '.###.'], H: ['#...#', '#...#', '#####', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '###'], K: ['#...#', '#..#.', '###..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#####'], M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#'], O: ['.###.', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '####.', '#....', '#....'], R: ['####.', '#...#', '####.', '#..#.', '#...#'],
  S: ['.####', '#....', '.###.', '....#', '####.'], T: ['#####', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '.###.'], V: ['#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'], Y: ['#...#', '.#.#.', '..#..', '..#..', '..#..'],
  Z: ['#####', '...#.', '..#..', '.#...', '#####'], Ä: ['#.#', '...', '###', '#.#', '#.#'],
  0: ['.###.', '#..##', '#.#.#', '##..#', '.###.'], 1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['####.', '....#', '.###.', '#....', '#####'], 3: ['####.', '....#', '.###.', '....#', '####.'],
  4: ['#...#', '#...#', '#####', '....#', '....#'], 5: ['#####', '#....', '####.', '....#', '####.'],
  6: ['.###.', '#....', '####.', '#...#', '.###.'], 7: ['#####', '....#', '...#.', '..#..', '..#..'],
  8: ['.###.', '#...#', '.###.', '#...#', '.###.'], 9: ['.###.', '#...#', '.####', '....#', '.###.'],
  '-': ['...', '...', '###', '...', '...'], '.': ['.', '.', '.', '.', '#'], ' ': ['..', '..', '..', '..', '..'],
};
export function textWidth(str, px) {
  let w = 0;
  for (const ch of str) w += ((FONT[ch] || FONT[' '])[0].length + 1) * px;
  return w - px;
}
// Schriftzug auf einer senkrechten Fläche bei (x, y=Mitte, z), Blickrichtung ry. px = Pixelgröße
export function text(k, str, x, y, z, ry, px, mat = 'paint_white') {
  if (!D1(k)) return;
  const g = new G(k, x, z, ry);
  let cx = -textWidth(str, px) / 2;
  for (const ch of str.toUpperCase()) {
    const gl = FONT[ch] || FONT[' '];
    gl.forEach((row, ri) => {
      let i = 0;
      while (i < row.length) {
        if (row[i] !== '#') { i++; continue; }
        let j = i;
        while (j < row.length && row[j] === '#') j++;
        g.quad(mat, cx + ((i + j) / 2) * px, y + (2 - ri) * px, 0, (j - i) * px, px * 1.02);
        i = j;
      }
    });
    cx += (gl[0].length + 1) * px;
  }
}
// Schrift um einen Zylinder (Tank) herum, Mitte bei Winkel a0 (0 = +z), Radius r
export function textArc(k, str, cx, y, cz, r, a0, px, mat = 'paint_white') {
  if (!D1(k)) return;
  const total = textWidth(str, px);
  let s = -total / 2;
  for (const ch of str.toUpperCase()) {
    const gl = FONT[ch] || FONT[' '];
    const gw = gl[0].length * px;
    const a = a0 + (s + gw / 2) / r;
    text(k, ch, cx + Math.sin(a) * (r + 0.04 * M), y, cz + Math.cos(a) * (r + 0.04 * M), a, px, mat);
    s += gw + px;
  }
}
// Schild mit Schrift: Tafel (bg) mit Rahmen, Text (fg). Rückseite flach an der Wand bei z.
export function sign(k, str, x, y, z, ry = 0, o = {}) {
  const px = o.px ?? 0.18 * M;
  const w = o.w ?? textWidth(str, px) + px * 4, h = o.h ?? px * 9;
  const g = new G(k, x, z, ry);
  const d = o.d ?? 0.12 * M;
  if (o.frame !== false) g.box(o.frame || 'trim_dark', 0, y - h / 2 - 0.06 * M, d / 2, w + 0.12 * M, h + 0.12 * M, d);
  g.box(o.bg || 'paint_blue', 0, y - h / 2, d / 2 + 0.02 * M, w, h, d);
  const [tx, tz] = g.p(0, d + 0.045 * M);
  text(k, str, tx, y, tz, ry, px, o.fg || 'sign_white');
}
// Leuchtschild ohne Schrift (Fernsicht) bzw. mit Schrift ab Detail 1
export function signBox(k, str, x, y, z, ry, o = {}) {
  if (k.detail === 0) { const g = new G(k, x, z, ry); g.box(o.bg || 'paint_blue', 0, y - (o.h ?? 0.16) / 2, 0, o.w ?? 0.4, o.h ?? 0.16, 0.12 * M); return; }
  sign(k, str, x, y, z, ry, o);
}

// ---------- Fahrzeuge (Länge entlang lokal z, Front nach +z). Ab Detail 1.
export const CAR_COLORS = ['paint_white', 'metal_dark', 'paint_red', 'paint_blue', 'metal_light', 'roof_metal_grey', 'paint_green', 'trim_dark'];
function wheels(g, xs, zs, r, w = 0.25 * M) {
  if (g.detail < 2) return;
  for (const z of zs) for (const s of [-1, 1]) g.pipe('rubber', [s * xs - w / 2, r, z], [s * xs + w / 2, r, z], r, { seg: 8, open: false });
}
// Fahrerhaus: Kasten, umlaufendes Glasband, Stoßfänger (lokal, Front nach +z)
function cabin(g, zc, L, w, h, y0, mat, o = {}) {
  g.box(mat, 0, y0, zc, w, h, L);
  if (g.detail >= 1) g.box('glass_window', 0, y0 + h * (o.gy ?? 0.52), zc + 0.06 * M, w + 0.04 * M, h * (o.gh ?? 0.34), L - 0.25 * M, { lit: 0 });
  if (g.detail >= 1) g.box('metal_dark', 0, y0 - 0.1 * M, zc + L / 2 - 0.1 * M, w + 0.04 * M, 0.5 * M, 0.3 * M);
  if (g.detail >= 2) for (const s of [-1, 1]) g.box('emissive_warm', s * (w / 2 - 0.3 * M), y0 + 0.3 * M, zc + L / 2 + 0.01 * M, 0.35 * M, 0.2 * M, 0.04 * M);
}
// Fahrwerk: dunkler Unterbau (Detail 1) bzw. Räder (Detail 2)
function chassis(g, len, w, zs, r, zc = 0) {
  g.box('metal_dark', 0, r * 0.4, zc, w - 0.5 * M, r * 1.3, len);
  if (g.detail >= 2) wheels(g, w / 2 - 0.2 * M, zs, r, 0.35 * M);
  else for (const z of zs) g.box('rubber', 0, 0, z, w - 0.1 * M, r * 2, r * 1.9);
}
export function car(k, x, z, ry, color = 'paint_red') {
  if (!D1(k)) return;
  const g = new G(k, x, z, ry);
  g.box(color, 0, 0.3 * M, 0, 1.75 * M, 0.62 * M, 4.3 * M);
  g.box(color, 0, 0.92 * M, -0.25 * M, 1.55 * M, 0.55 * M, 2.2 * M);
  g.box('glass_window', 0, 0.95 * M, -0.25 * M, 1.58 * M, 0.42 * M, 2.05 * M, { lit: 0 });
  wheels(g, 0.78 * M, [-1.35 * M, 1.35 * M], 0.32 * M);
}
export function van(k, x, z, ry, color = 'paint_white', o = {}) {
  if (!D1(k)) return;
  const g = new G(k, x, z, ry);
  const L = o.len ?? 5.2 * M;
  g.box(color, 0, 0.35 * M, -0.3 * M, 1.95 * M, 2.0 * M, L - 0.8 * M);
  g.box(color, 0, 0.35 * M, L / 2 - 0.6 * M, 1.9 * M, 1.25 * M, 1.2 * M);
  g.box('glass_window', 0, 1.25 * M, L / 2 - 0.9 * M, 1.98 * M, 0.7 * M, 0.9 * M, { lit: 0 });
  if (D2(k)) g.box('glass_window', 0, 1.3 * M, L / 2 - 0.5 * M, 1.8 * M, 0.75 * M, 0.5 * M, { lit: 0, rx: -0.45 });
  if (o.stripe) g.box(o.stripe, 0, 0.95 * M, -0.3 * M, 1.98 * M, 0.3 * M, L - 0.85 * M);
  if (o.lights) { g.box(o.lights, 0, 2.35 * M, L / 2 - 1.2 * M, 1.2 * M, 0.18 * M, 0.3 * M); if (D2(k)) g.box(o.lights, 0, 2.35 * M, -L / 2 + 0.3 * M, 1.4 * M, 0.15 * M, 0.2 * M); }
  wheels(g, 0.85 * M, [-L / 2 + 1.0 * M, L / 2 - 1.1 * M], 0.36 * M);
}
export function policeCar(k, x, z, ry) {
  if (!D1(k)) return;
  car(k, x, z, ry, 'paint_white');
  const g = new G(k, x, z, ry);
  g.box('paint_blue', 0, 0.55 * M, 0, 1.78 * M, 0.28 * M, 4.32 * M);
  g.box('emissive_cool', 0, 1.47 * M, -0.2 * M, 1.0 * M, 0.14 * M, 0.3 * M);
}
// Löschfahrzeug (HLF) bzw. mit Drehleiter (ladder: true)
export function fireTruck(k, x, z, ry, o = {}) {
  if (!D1(k)) return;
  const g = new G(k, x, z, ry);
  const L = o.len ?? 8.5 * M, W = 2.5 * M;
  chassis(g, L - 1.2 * M, W, [-L / 2 + 1.4 * M, -L / 2 + 2.7 * M, L / 2 - 1.3 * M], 0.5 * M);
  cabin(g, L / 2 - 1.1 * M, 2.2 * M, W, 2.35 * M, 0.55 * M, 'paint_red');
  g.box('paint_red', 0, 0.6 * M, -1.15 * M, W, 2.7 * M, L - 2.3 * M);
  g.box('paint_white', 0, 1.2 * M, -1.15 * M, W + 0.03 * M, 0.22 * M, L - 2.35 * M);
  g.box('paint_white', 0, 0.62 * M, L / 2 - 0.02 * M, W * 0.6, 0.15 * M, 0.06 * M);
  if (D2(k)) for (const s of [-1, 1]) for (let i = 0; i < 3; i++) g.box('metal_light', s * (W / 2 + 0.01 * M), 1.5 * M, -L / 2 + 0.9 * M + i * ((L - 2.6 * M) / 3), 0.04 * M, 1.6 * M, (L - 2.8 * M) / 3 - 0.15 * M);
  if (o.ladder) {
    g.cyl('metal_dark', 0, 3.3 * M, -L / 2 + 1.3 * M, 0.8 * M, 0.4 * M, { seg: 10 });
    for (const s of [-1, 1]) g.box('metal_light', s * 0.55 * M, 3.7 * M, 0.2 * M, 0.14 * M, 0.35 * M, L - 0.6 * M);
    if (D2(k)) for (let i = 0; i < 9; i++) g.box('metal_light', 0, 3.75 * M, -L / 2 + 1.2 * M + i * ((L - 1.6 * M) / 8), 1.1 * M, 0.06 * M, 0.08 * M);
  } else {
    g.box('metal_light', 0, 3.3 * M, -1.6 * M, 2.0 * M, 0.3 * M, L - 3.6 * M);
    if (D2(k)) g.box('metal_dark', 0.6 * M, 3.6 * M, -1.2 * M, 0.4 * M, 0.08 * M, L - 4.2 * M);
  }
  g.box('emissive_cool', 0, 2.9 * M, L / 2 - 1.3 * M, 1.6 * M, 0.16 * M, 0.3 * M);
  if (D2(k)) for (const s of [-1, 1]) g.box('emissive_cool', s * 1.0 * M, 3.3 * M, -L / 2 + 0.2 * M, 0.3 * M, 0.2 * M, 0.2 * M);
}
export function ambulance(k, x, z, ry) {
  van(k, x, z, ry, 'paint_white', { len: 6.2 * M, stripe: 'paint_red', lights: 'emissive_cool' });
}
// Lastwagen: Fahrerhaus + Aufbau/Auflieger (body: Material des Aufbaus, false = nur Pritsche)
export function truck(k, x, z, ry, o = {}) {
  if (!D1(k)) return;
  const g = new G(k, x, z, ry);
  const L = o.len ?? 12 * M, cab = o.cab || 'paint_white', W = 2.5 * M;
  chassis(g, L - 0.6 * M, W, [-L / 2 + 1.0 * M, -L / 2 + 2.3 * M, L / 2 - 1.3 * M], 0.5 * M, -0.1 * M);
  cabin(g, L / 2 - 1.1 * M, 2.2 * M, 2.45 * M, 2.5 * M, 0.6 * M, cab);
  g.box('metal_dark', 0, 0.85 * M, -1.25 * M, 2.4 * M, 0.25 * M, L - 2.6 * M);
  if (o.body !== false) g.box(o.body || 'metal_panel_white', 0, 1.1 * M, -1.25 * M, W, o.bodyH ?? 2.7 * M, L - 2.6 * M);
  if (o.stripe) g.box(o.stripe, 0, 1.6 * M, -1.25 * M, W + 0.03 * M, 0.5 * M, L - 2.7 * M);
}
// Müllwagen (Hecklader, orange, gewölbter Aufbau)
export function garbageTruck(k, x, z, ry) {
  if (!D1(k)) return;
  const g = new G(k, x, z, ry);
  chassis(g, 6.8 * M, 2.5 * M, [-2.2 * M, -1.0 * M, 2.6 * M], 0.5 * M);
  cabin(g, 2.65 * M, 1.9 * M, 2.5 * M, 2.2 * M, 0.55 * M, 'paint_orange', { gy: 0.5, gh: 0.38 });
  g.box('paint_orange', 0, 0.65 * M, -0.85 * M, 2.5 * M, 1.7 * M, 4.6 * M);
  g.pipe('paint_orange', [0, 2.3 * M, -3.1 * M], [0, 2.3 * M, 1.45 * M], 1.24 * M, { seg: segs(k, 12), open: false });
  g.box('metal_dark', 0, 0.75 * M, -3.5 * M, 2.4 * M, 2.6 * M, 0.9 * M, { rx: 0.12 });
  if (D2(k)) for (let i = 0; i < 4; i++) g.box(i % 2 ? 'paint_white' : 'paint_red', -0.9 * M + i * 0.6 * M, 1.0 * M, -3.98 * M, 0.3 * M, 1.4 * M, 0.04 * M);
  g.box('paint_white', 0, 1.6 * M, -0.85 * M, 2.53 * M, 0.22 * M, 4.5 * M);
  g.box('emissive_warm', 0, 2.75 * M, 2.9 * M, 0.5 * M, 0.2 * M, 0.3 * M);
}
// Tanklastzug
export function tanker(k, x, z, ry, o = {}) {
  if (!D1(k)) return;
  const g = new G(k, x, z, ry);
  const L = o.len ?? 11 * M;
  chassis(g, L - 0.6 * M, 2.5 * M, [-L / 2 + 1.0 * M, -L / 2 + 2.3 * M, L / 2 - 1.3 * M], 0.5 * M, -0.1 * M);
  cabin(g, L / 2 - 1.1 * M, 2.2 * M, 2.45 * M, 2.5 * M, 0.6 * M, o.cab || 'paint_white');
  g.pipe(o.body || 'tank_white', [0, 2.2 * M, -L / 2 + 0.3 * M], [0, 2.2 * M, L / 2 - 2.4 * M], 1.15 * M, { seg: segs(k, 12), open: false });
  if (D2(k)) g.box('metal_dark', 0, 3.3 * M, -1.2 * M, 0.5 * M, 0.15 * M, L - 4 * M);
}
// Güterwagen auf Gleis (Länge entlang lokal z): kind 'flat' (mit Containern) | 'box' | 'tank' | 'hopper'
export function wagon(k, x, z, ry, kind = 'box', o = {}) {
  const g = new G(k, x, z, ry);
  const L = o.len ?? 14 * M;
  g.box('metal_dark', 0, 0.5 * M, 0, 2.6 * M, 0.6 * M, L);
  if (D2(k)) for (const s of [-1, 1]) g.box('metal_dark', 0, 0, s * (L / 2 - 2 * M), 2.2 * M, 0.6 * M, 2.6 * M);
  if (kind === 'flat' && L < 12.6 * M) {
    const [ax, az] = g.p(0, 0);
    container(k, ax, 1.1 * M, az, ry, o.mat || pick(k.rng, ['container_red', 'container_blue', 'container_green', 'container_yellow']));
  } else if (kind === 'flat') {
    const [ax, az] = g.p(0, -L / 4 + 0.1 * M), [bx, bz] = g.p(0, L / 4 - 0.1 * M);
    container(k, ax, 1.1 * M, az, ry, o.mat || pick(k.rng, ['container_red', 'container_blue', 'container_green', 'container_yellow']));
    container(k, bx, 1.1 * M, bz, ry, o.mat2 || pick(k.rng, ['container_red', 'container_blue', 'container_green', 'metal_panel_grey']));
  } else if (kind === 'tank') {
    g.pipe(o.mat || 'tank_white', [0, 2.4 * M, -L / 2 + 0.6 * M], [0, 2.4 * M, L / 2 - 0.6 * M], 1.3 * M, { seg: segs(k, 12), open: false });
  } else if (kind === 'hopper') {
    g.box(o.mat || 'rust', 0, 1.1 * M, 0, 2.8 * M, 2.4 * M, L - 0.8 * M);
    g.box(o.fill || 'asphalt_dark', 0, 3.3 * M, 0, 2.5 * M, 0.3 * M, L - 1.2 * M);
  } else {
    g.box(o.mat || 'metal_corrugated_red', 0, 1.1 * M, 0, 2.8 * M, 3.0 * M, L - 0.4 * M);
    if (D2(k)) g.box('metal_dark', 0, 1.3 * M, 0, 2.84 * M, 2.4 * M, 2.2 * M);
  }
}
// Gleis entlang x von x0 bis x1 bei z (Schotterbett, Schienen, Schwellen)
export function track(k, x0, x1, z, o = {}) {
  const len = x1 - x0, cx = (x0 + x1) / 2;
  k.box('ballast', cx, 0, z, len, 0.35 * M, 3.0 * M);
  if (D2(k)) { const n = Math.floor(len / (1.2 * M)); for (let i = 0; i < n; i++) k.box('wood_dark', x0 + (i + 0.5) * (len / n), 0.35 * M, z, 0.25 * M, 0.12 * M, 2.4 * M); }
  for (const s of [-1, 1]) k.box('rail_track', cx, 0.35 * M, z + s * 0.72 * M, len, k.detail ? 0.2 * M : 0.15 * M, 0.12 * M);
}
// Seecontainer (20 oder 40 Fuß), Unterkante y0
export function container(k, x, y0, z, ry, mat, long = false) {
  const g = new G(k, x, z, ry);
  const L = (long ? 12.2 : 6.06) * M;
  g.box(mat, 0, y0, 0, 2.44 * M, 2.59 * M, L);
  if (D2(k)) {
    g.box('metal_dark', 0, y0 + 0.1 * M, L / 2 + 0.01 * M, 2.3 * M, 2.4 * M, 0.04 * M);
    g.box(mat, 0, y0 + 0.15 * M, L / 2 + 0.03 * M, 0.06 * M, 2.3 * M, 0.04 * M);
  }
}
// Stapel von Containern auf einer Fläche (Reihen entlang z)
export function containerStack(k, x, z, nx, nz, maxH, o = {}) {
  const cols = o.colors || ['container_red', 'container_blue', 'container_green', 'container_yellow', 'metal_panel_grey', 'container_blue', 'paint_orange', 'metal_panel_white'];
  const L = (o.long ? 12.2 : 6.06) * M, gap = 0.35 * M;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const hgt = 1 + Math.floor(k.rng() * maxH);
    for (let l = 0; l < hgt; l++) {
      if (k.detail === 0 && l < hgt - 1) continue;
      const px = x + (i - (nx - 1) / 2) * (2.44 * M + gap), pz = z + (j - (nz - 1) / 2) * (L + gap);
      if (k.detail === 0) { k.box(pick(k.rng, cols), px, 0, pz, 2.44 * M, 2.59 * M * hgt, L); continue; }
      container(k, px, l * 2.59 * M, pz, 0, pick(k.rng, cols), o.long);
    }
  }
}
// Palettenstapel/Kisten
export function crates(k, x, z, n, o = {}) {
  if (!D2(k)) return;
  for (let i = 0; i < n; i++) {
    const px = x + (k.rng() - 0.5) * (o.spread ?? 3 * M), pz = z + (k.rng() - 0.5) * (o.spread ?? 3 * M);
    k.box('wood_planks', px, 0, pz, 1.2 * M, 0.15 * M, 1.0 * M);
    k.box(o.mat || pick(k.rng, ['canvas_white', 'wood_planks', 'metal_panel_white']), px, 0.15 * M, pz, 1.1 * M, (0.6 + k.rng() * 0.8) * M, 0.95 * M);
  }
}
// Gabelstapler
export function forklift(k, x, z, ry) {
  if (!D2(k)) return;
  const g = new G(k, x, z, ry);
  g.box('paint_yellow', 0, 0.2 * M, 0, 1.1 * M, 1.0 * M, 2.0 * M);
  g.box('metal_dark', 0, 1.2 * M, -0.3 * M, 1.0 * M, 0.08 * M, 1.1 * M);
  for (const s of [-1, 1]) g.box('metal_dark', s * 0.45 * M, 1.2 * M, -0.85 * M, 0.06 * M, 1.0 * M, 0.06 * M);
  g.box('metal_dark', 0, 0, 1.15 * M, 0.9 * M, 2.4 * M, 0.12 * M);
  g.box('metal_dark', 0, 0.1 * M, 1.6 * M, 0.9 * M, 0.08 * M, 0.9 * M);
}

// ---------- Erdhaufen / Halden (längliche Pyramide)
export function heap(k, mat, x, z, sx, sz, h, o = {}) {
  k.hipRoof(mat, x, o.y0 ?? 0, z, sx, sz, h, { overhang: 0, ridgeK: o.ridgeK ?? 0.95 });
}
export function mound(k, mat, x, z, r, h, o = {}) {
  const n = k.detail >= 2 ? 6 : 4;
  const prof = [];
  for (let i = 0; i <= n; i++) { const t = i / n; prof.push([r * Math.cos(t * Math.PI / 2) ** (o.pow ?? 0.8) + 0.001, h * Math.sin(t * Math.PI / 2)]); }
  return lathe(k, mat, x, o.y0 ?? 0, z, prof, segs(k, o.seg ?? 12), { sx: o.sx ?? 1, sz: o.sz ?? 1, ry: o.ry || 0 });
}

// ---------- Animierte Teile (Vertrag 6.2): Geometrie relativ zum Drehpunkt, pivot in Modellkoordinaten
export function anim(k, pivot, axis, speed, fn) {
  const sub = new Kit(k.rng, k.detail);
  fn(sub);
  const r = sub.build();
  k._anim = k._anim || [];
  for (const m of r.meshes) k._anim.push({ geometry: m.geometry, material: m.material, pivot: [...pivot], axis, speed });
  k._animTris = (k._animTris || 0) + r.triangles;
  k._animTop = Math.max(k._animTop || 0, pivot[1] + sub.height * 0.5);
}
// Fertigstellen: kit.build() + animierte Teile
export function finish(k) {
  const res = k.build();
  if (k._anim) { res.anim = k._anim; res.triangles += k._animTris; res.height = Math.max(res.height, k._animTop); }
  return res;
}
