// Gemeinsame Bauteile für Industrie & Büro (Besitzer: G4 – Architektur Industrie & Büro).
// Alle Maße hier in METERN (1 Feld = 10 m). Ursprung = Grundstücksmitte auf Bodenhöhe, Front (Straße) zeigt nach +z.
// Die Klasse B kapselt den Baukasten (kit.js), rechnet in Welteinheiten um und beachtet ctx.detail:
//   2 = Nahsicht (alle Kleinteile), 1 = mittlere Entfernung (ohne Kleinteile), 0 = Fernansicht (nur Großformen).
// Animierte Teile (Förderräder, Pumpenbock-Kurbeln …) entstehen mit b.spin(...) und landen in res.anim
// (Vertrag 6.2): Geometrie relativ zum Drehpunkt, pivot und axis im Modellraum (vor der Gebäudedrehung).
import * as THREE from 'three';
import { Kit, M } from './kit.js';

export const PI = Math.PI, HP = Math.PI / 2;

// Farbpaletten (nur Namen aus MATERIAL_DEFS)
export const LOGO = ['paint_red', 'paint_blue', 'paint_green', 'paint_orange', 'paint_yellow', 'container_blue', 'container_red'];
export const CAR = ['paint_red', 'paint_blue', 'paint_white', 'paint_white', 'metal_light', 'metal_light', 'metal_dark', 'trim_dark', 'paint_green', 'plaster_blue', 'siding_red', 'paint_yellow'];
export const CONT = ['container_red', 'container_blue', 'container_green', 'container_yellow', 'metal_light', 'paint_white', 'container_blue', 'rust'];
export const CAB = ['paint_white', 'paint_white', 'paint_red', 'paint_blue', 'paint_orange', 'paint_yellow', 'metal_dark', 'paint_green'];

const SIDES = ['front', 'back', 'left', 'right'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class B {
  constructor(ctx, kit) {
    this.ctx = ctx;
    this.k = kit || ctx.kit;
    this.r = ctx.rng;
    this.d = ctx.detail ?? 2;
    this.fw = ctx.fw; this.fd = ctx.fd;
    this.W = ctx.fw * 10; this.D = ctx.fd * 10; // Grundstück in m
    this.L = ctx.level;
    this.anim = [];
    this.extraTris = 0;
    this.extraTop = 0;
  }

  // ---------- Zufall
  rnd(a = 0, b = 1) { return a + (b - a) * this.r(); }
  chance(p) { return this.r() < p; }
  pick(arr) { return arr[Math.floor(this.r() * arr.length) % arr.length]; }
  int(a, b) { return a + Math.floor(this.r() * (b - a + 1) * 0.99999); }
  seg(n) { return n <= 6 ? n : this.d >= 2 ? n : this.d === 1 ? Math.max(6, Math.round(n * 0.7)) : Math.max(6, Math.round(n * 0.5)); }

  // ---------- Grundformen (Meter)
  // Geometrie in Metern hinzufügen; o: {rx, ry, rz, lit, uv}
  g(mat, geo, x, y, z, o = {}) {
    geo.scale(M, M, M);
    return this.k.add(mat, geo, { ...o, x: x * M, y: y * M, z: z * M });
  }
  // Quader, Unterkante y
  box(mat, x, y, z, sx, sy, sz, ry = 0, lit) {
    if (sx <= 0 || sy <= 0 || sz <= 0) return null;
    const o = {};
    if (ry) o.ry = ry;
    if (lit !== undefined) o.lit = lit;
    return this.k.box(mat, x * M, y * M, z * M, sx * M, sy * M, sz * M, o);
  }
  // Quader um Mittelpunkt mit beliebiger Drehung
  boxc(mat, x, y, z, sx, sy, sz, o = {}) { return this.g(mat, new THREE.BoxGeometry(sx, sy, sz), x, y, z, o); }
  cyl(mat, x, y, z, r, h, o = {}) {
    const seg = o.exact ? o.seg : this.seg(o.seg || 12);
    const geo = new THREE.CylinderGeometry(o.rTop ?? r, r, h, seg, 1, !!o.open, o.t0 || 0, o.tl ?? PI * 2);
    geo.translate(0, h / 2, 0);
    return this.g(mat, geo, x, y, z, { ry: o.ry || 0, lit: o.lit });
  }
  // liegender Zylinder (Mitte bei x,y,z) entlang 'x' oder 'z'
  hcyl(mat, x, y, z, r, len, axis = 'x', o = {}) {
    const geo = new THREE.CylinderGeometry(o.rTop ?? r, r, len, o.exact ? o.seg : this.seg(o.seg || 10), 1, !!o.open);
    if (axis === 'x') geo.rotateZ(HP); else geo.rotateX(HP);
    return this.g(mat, geo, x, y, z, { ry: o.ry || 0 });
  }
  cone(mat, x, y, z, r, h, o = {}) {
    const geo = new THREE.ConeGeometry(r, h, o.exact ? o.seg : this.seg(o.seg || 12), 1, !!o.open);
    geo.translate(0, h / 2, 0);
    return this.g(mat, geo, x, y, z, { ry: o.ry || 0 });
  }
  sphere(mat, x, y, z, r, o = {}) {
    const s = this.seg(o.seg || 12);
    const geo = new THREE.SphereGeometry(r, s, Math.max(4, s >> 1));
    if (o.sy) geo.scale(1, o.sy, 1);
    return this.g(mat, geo, x, y, z, {});
  }
  // Halbkugel (Kuppel), Unterkante y, Höhenfaktor sy
  dome(mat, x, y, z, r, sy = 1, o = {}) {
    const s = this.seg(o.seg || 14);
    const geo = new THREE.SphereGeometry(r, s, Math.max(3, s >> 2), 0, PI * 2, 0, HP);
    geo.scale(1, sy, 1);
    return this.g(mat, geo, x, y, z, {});
  }
  // Prisma: Profil [[u, v], …] in Metern (u quer, v hoch), extrudiert entlang lokaler z-Achse (Länge len), Drehung ry
  prism(mat, prof, len, x, y, z, ry = 0, o = {}) {
    const shape = new THREE.Shape(prof.map(([a, b]) => new THREE.Vector2(a, b)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false, curveSegments: 4 });
    geo.translate(0, 0, -len / 2);
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    return this.g(mat, geo, x, y, z, { ry, rx: o.rx || 0 });
  }
  // Balken zwischen zwei Punkten [x,y,z]; t = Breite, t2 = Höhe des Querschnitts
  beam(mat, a, b, t = 0.3, t2 = t) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return null;
    const geo = new THREE.BoxGeometry(t, t2, len);
    return this.g(mat, geo, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, { rx: -Math.asin(clamp(dy / len, -1, 1)), ry: Math.atan2(dx, dz) });
  }
  // Rohr zwischen zwei Punkten
  pipe(mat, a, b, r = 0.2, seg = 8) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return null;
    const geo = new THREE.CylinderGeometry(r, r, len, this.seg(seg), 1, true);
    geo.rotateX(HP);
    return this.g(mat, geo, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, { rx: -Math.asin(clamp(dy / len, -1, 1)), ry: Math.atan2(dx, dz) });
  }
  // Senkrechte Fläche (Mitte x, y, z), zeigt in Richtung ry
  plane(mat, x, y, z, w, h, ry = 0, lit) {
    if (w <= 0 || h <= 0) return null;
    return this.g(mat, new THREE.PlaneGeometry(w, h), x, y, z, { ry, lit: lit ?? this.r() });
  }
  // Fernansicht: Fensterraster als lod_windows-Fläche (nx × ny Zellen)
  lodWin(x, y, z, w, h, nx, ny, ry = 0) {
    const geo = new THREE.PlaneGeometry(w * M, h * M);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * nx, uv.getY(i) * ny);
    return this.k.add('lod_windows', geo, { x: x * M, y: y * M, z: z * M, ry, uv: 'keep', lit: this.r() });
  }

  // ---------- Fassaden-Rahmen: Position a entlang der Fassade (von außen gesehen links → rechts), off = Abstand nach außen
  face(cx, cz, sx, sz, side) {
    switch (side) {
      case 'front': return { side, len: sx, ry: 0, at: (a, off = 0) => [cx + a, cz + sz / 2 + off] };
      case 'back': return { side, len: sx, ry: PI, at: (a, off = 0) => [cx - a, cz - sz / 2 - off] };
      case 'right': return { side, len: sz, ry: HP, at: (a, off = 0) => [cx + sx / 2 + off, cz - a] };
      default: return { side: 'left', len: sz, ry: -HP, at: (a, off = 0) => [cx - sx / 2 - off, cz + a] };
    }
  }
  faces(cx, cz, sx, sz) { const o = {}; for (const s of SIDES) o[s] = this.face(cx, cz, sx, sz, s); return o; }
  // Quader auf einer Fassade: a = Mitte entlang, y0 Unterkante, w × h, Tiefe t (ragt off … off+t heraus)
  fbox(mat, f, a, y0, w, h, t, off = 0) { const [x, z] = f.at(a, off + t / 2); return this.box(mat, x, y0, z, w, h, t, f.ry); }
  fplane(mat, f, a, y0, w, h, off = 0.03, lit) { const [x, z] = f.at(a, off); return this.plane(mat, x, y0 + h / 2, z, w, h, f.ry, lit); }

  // ---------- Animierte Teile
  // fn(sub) baut Geometrie um den Ursprung (= Drehpunkt) mit einem eigenen Baukasten.
  spin(pivot, axis, speed, fn) {
    const kit = new Kit(this.r, this.d);
    kit.__sub = true;
    const sub = new B(this.ctx, kit);
    fn(sub);
    const res = kit.build();
    for (const m of res.meshes) this.anim.push({ geometry: m.geometry, material: m.material, pivot: [pivot[0] * M, pivot[1] * M, pivot[2] * M], axis, speed });
    this.extraTris += res.triangles;
    this.extraTop = Math.max(this.extraTop, pivot[1] * M + res.height);
  }

  // Rauch/Dampf und Nachtlicht in Metern
  smoke(x, y, z, type = 'smoke', amount = 1) { this.k.smoke(x * M, y * M, z * M, type, amount); }
  light(x, y, z, color = 0xffd79a, size = 0.3) { this.k.light(x * M, y * M, z * M, color, size); }

  finish() {
    const res = this.k.build();
    if (this.anim.length) res.anim = this.anim;
    res.triangles += this.extraTris;
    if (this.extraTop > res.height) res.height = this.extraTop;
    return res;
  }

  // ---------- Boden
  ground(mat, x, z, sx, sz, h = 0.1) { return this.box(mat, x, 0, z, sx, h, sz); }
  // Ganze Parzelle (mit kleinem Rand)
  lot(mat, h = 0.1) { return this.ground(mat, 0, 0, this.W - 0.2, this.D - 0.2, h); }
  // Fahrbahnmarkierung
  stripe(x, z, sx, sz, mat = 'paint_white', y = 0.1) { if (this.d >= 1) this.box(mat, x, y, z, sx, 0.03, sz); }

  // Parkplatz im Rechteck (x, z, sx, sz). Ab 5 m Tiefe Querparker (Autos entlang z), sonst Längsparker (entlang x).
  // o: { fill, front (eine Reihe vorne statt hinten), mat }
  parking(x, z, sx, sz, o = {}) {
    this.ground(o.mat || 'asphalt', x, z, sx, sz, 0.1);
    const fill = o.fill ?? 0.7;
    if (sz >= 5.0) {
      const rows = sz >= 11 ? 2 : 1;
      const n = Math.max(1, Math.floor((sx - 0.3) / 2.5)), w = (sx - 0.3) / n;
      const rz = rows === 2 ? [z - sz / 2 + 2.5, z + sz / 2 - 2.5] : [o.front ? z + sz / 2 - 2.5 : z - sz / 2 + 2.5];
      rz.forEach((zz, ri) => {
        const facing = rows === 2 ? (ri ? PI : 0) : o.front ? PI : 0;
        for (let i = 0; i <= n; i++) this.stripe(x - (sx - 0.3) / 2 + i * w, zz, 0.12, 4.6);
        for (let i = 0; i < n; i++) if (this.r() < fill) this.car(x - (sx - 0.3) / 2 + (i + 0.5) * w, zz + (this.r() - 0.5) * 0.2, facing + (this.r() - 0.5) * 0.06, this.pick(CAR));
      });
    } else {
      const n = Math.max(1, Math.floor((sx - 0.3) / 5.6)), w = (sx - 0.3) / n;
      for (let i = 0; i <= n; i++) this.stripe(x - (sx - 0.3) / 2 + i * w, z, 0.12, Math.min(2.2, sz - 0.2));
      for (let i = 0; i < n; i++) if (this.r() < fill) this.car(x - (sx - 0.3) / 2 + (i + 0.5) * w, z, this.r() < 0.5 ? HP : -HP, this.pick(CAR));
    }
  }

  // Passt ein Rechteck (Länge len entlang Richtung ry, Breite wid) ganz aufs Grundstück?
  fits(x, z, ry, len, wid, tol = 0.15) {
    const s = Math.sin(ry), c = Math.cos(ry);
    for (const a of [-len / 2, len / 2]) for (const b of [-wid / 2, wid / 2]) {
      const px = x + s * a + c * b, pz = z + c * a - s * b;
      if (Math.abs(px) > this.W / 2 + tol || Math.abs(pz) > this.D / 2 + tol) return false;
    }
    return true;
  }

  // ---------- Belegungsplan (siehe Plan unten): Hauptbauten eintragen, Nebenteile automatisch platzieren
  get plan() { return this._plan || (this._plan = new Plan(this)); }
  take(x, z, sx, sz, pad = 0.3) { this.plan.take(x, z, sx, sz, pad); }
  takeC(x, z, r, pad = 0.3) { this.plan.takeC(x, z, r, pad); }
  // Objekt mit Länge len (entlang Fahrtrichtung) und Breite wid frei platzieren; draw(x, z, ry)
  put(len, wid, f, draw) {
    const p = this.plan.find(wid, len, { rot: true, pad: 0.35, ...f });
    if (!p) return null;
    const ry = p[2] ? (f.ryX ?? (this.r() < 0.5 ? HP : -HP)) : (f.ryZ ?? (this.r() < 0.5 ? 0 : PI));
    draw(p[0], p[1], ry);
    return p;
  }
  putCar(f = {}) { return this.put(4.3, 1.8, f, (x, z, ry) => this.car(x, z, ry, this.pick(CAR))); }
  putVan(f = {}, color) { return this.put(5.6, 2.0, f, (x, z, ry) => this.van(x, z, ry, color || this.pick(['paint_white', 'paint_white', 'paint_red', 'paint_blue', 'metal_light']))); }
  putTruck(o = {}, f = {}) {
    if (o.type === 'semi') { const p = this.put(16.5, 2.6, f, (x, z, ry) => this.truck(x, z, ry, o)); if (p) return p; }
    return this.put(8.5, 2.6, f, (x, z, ry) => this.truck(x, z, ry, { ...o, type: 'rigid' }));
  }
  putContainer(long = false, f = {}, tiers = 1) {
    return this.put(long ? 12.2 : 6.1, 2.45, f, (x, z, ry) => { for (let k = 0; k < tiers; k++) this.container(x, k * 2.6, z, ry, long); });
  }
  putTree(s = 1, kind = 'laub', f = {}) {
    const r = (kind === 'nadel' ? 2.0 : kind === 'pappel' ? 1.5 : kind === 'busch' ? 1.0 : kind === 'obst' ? 1.3 : 2.2) * s;
    const p = this.plan.find(2 * r, 2 * r, { pad: 0, ...f });
    if (p) this.tree(p[0], p[1], s, kind);
    return p;
  }
  putPallets(n = 3, f = {}) { return this.put(1.4 * n, 1.0, f, (x, z, ry) => this.pallets(x, z, n, ry + HP)); }

  // ---------- Fahrzeuge (Fahrtrichtung ry: 0 = Front nach +z). Passt ein Fahrzeug nicht aufs Grundstück, entfällt es.
  // Auto 4,4 × 1,8 m, Richtung ry (0 = Front nach +z)
  car(x, z, ry, color) {
    if (!this.fits(x, z, ry, 4.3, 1.8)) return;
    const s = Math.sin(ry), c = Math.cos(ry);
    const P = (f) => [x + s * f, z + c * f];
    if (this.d === 0) { this.box(color, x, 0.3, z, 1.8, 1.0, 4.3, ry); return; }
    this.box(color, x, 0.32, z, 1.8, 0.72, 4.3, ry);
    let [px, pz] = P(-0.25);
    this.box('trim_dark', px, 1.04, pz, 1.62, 0.5, 2.3, ry);
    this.box(color, px, 1.52, pz, 1.56, 0.08, 2.0, ry);
    if (this.d >= 2) {
      for (const f of [1.35, -1.35]) { [px, pz] = P(f); this.box('rubber', px, 0, pz, 1.86, 0.62, 0.62, ry); }
    }
  }
  // Lieferwagen / Transporter
  van(x, z, ry, color = 'paint_white') {
    if (!this.fits(x, z, ry, 5.6, 2.0)) return;
    const s = Math.sin(ry), c = Math.cos(ry);
    const P = (f) => [x + s * f, z + c * f];
    if (this.d === 0) { this.box(color, x, 0.3, z, 2.0, 2.2, 5.6, ry); return; }
    let [px, pz] = P(-0.4);
    this.box(color, px, 0.35, pz, 2.0, 2.15, 4.4, ry);
    [px, pz] = P(2.1);
    this.box(color, px, 0.35, pz, 1.96, 1.1, 1.2, ry);
    [px, pz] = P(1.95);
    this.box('trim_dark', px, 1.45, pz, 1.9, 0.75, 0.9, ry);
    if (this.d >= 2) for (const f of [1.8, -1.6]) { [px, pz] = P(f); this.box('rubber', px, 0, pz, 2.05, 0.68, 0.68, ry); }
  }
  // Lkw: o.type 'semi' (Sattelzug 16,5 m) | 'rigid' (8 m); o.load 'box'|'tarp'|'container'|'tank'|'logs'|'tipper'|'flat'
  truck(x, z, ry, o = {}) {
    let semi = (o.type || 'semi') === 'semi';
    if (semi && !this.fits(x, z, ry, 16.5, 2.6)) semi = false;
    if (!semi && !this.fits(x, z, ry, 8.5, 2.6)) return;
    const s = Math.sin(ry), c = Math.cos(ry);
    const P = (f) => [x + s * f, z + c * f];
    const len = semi ? 16.5 : 8.5;
    const cab = o.cab || this.pick(CAB);
    const load = o.load || 'box';
    const loadMat = o.loadMat || (load === 'tarp' ? 'canvas_white' : load === 'container' ? this.pick(CONT) : load === 'tank' ? 'tank_white' : 'metal_panel_white');
    const front = len / 2;
    // Fahrerhaus
    let [px, pz] = P(front - 1.2);
    this.box(cab, px, 0.9, pz, 2.5, 2.7, 2.3, ry);
    if (this.d >= 1) {
      [px, pz] = P(front - 0.06);
      this.box('trim_dark', px, 2.3, pz, 2.2, 1.0, 0.1, ry);
      [px, pz] = P(front - 1.2);
      this.box('metal_dark', px, 3.6, pz, 2.3, 0.35, 1.8, ry);
    }
    // Fahrgestell
    [px, pz] = P(0);
    if (this.d >= 1) this.box('metal_dark', px, 0.55, pz, 2.3, 0.4, len - 0.4, ry);
    // Ladung
    const lLen = semi ? 13.4 : 6.0, lc = -front + lLen / 2 + 0.2;
    [px, pz] = P(lc);
    if (load === 'tank') {
      this.g(loadMat, new THREE.CylinderGeometry(1.25, 1.25, lLen, this.seg(12)).rotateX(HP), px, 2.35, pz, { ry });
    } else if (load === 'logs') {
      this.box('metal_dark', px, 1.05, pz, 2.4, 0.2, lLen, ry);
      if (this.d >= 2) {
        for (let i = 0; i < 3; i++) for (let j = 0; j < 4 - i; j++) {
          const yy = 1.6 + i * 0.6, xx = -0.9 + j * 0.6 + i * 0.3;
          const geo = new THREE.CylinderGeometry(0.3, 0.3, lLen + 0.4, 6).rotateX(HP).translate(xx, 0, 0);
          this.g('log_wood', geo, px, yy, pz, { ry });
        }
        for (const f of [-lLen / 2 + 0.6, 0, lLen / 2 - 0.6]) { const [qx, qz] = P(lc + f); this.box('metal_dark', qx, 1.25, qz, 2.5, 1.9, 0.15, ry); }
      } else this.box('log_wood', px, 1.25, pz, 2.3, 1.6, lLen + 0.3, ry);
    } else if (load === 'tipper') {
      this.box(o.loadMat || cab, px, 1.1, pz, 2.5, 1.5, lLen, ry);
      if (this.d >= 1) this.box(o.fill || 'gravel', px, 2.4, pz, 2.2, 0.3, lLen - 0.4, ry);
    } else if (load === 'flat') {
      this.box('metal_dark', px, 1.05, pz, 2.5, 0.25, lLen, ry);
      if (this.d >= 1 && o.cargo !== false) this.box(o.cargoMat || 'wood_planks', px, 1.3, pz, 2.2, 1.0, lLen * 0.7, ry);
    } else {
      this.box(loadMat, px, 1.05, pz, 2.55, 2.85, lLen, ry);
      if (this.d >= 2 && load === 'box' && o.logo) { const [qx, qz] = [px + c * 1.29, pz - s * 1.29]; this.box(o.logo, qx, 2.0, qz, 0.04, 1.0, lLen * 0.45, ry); }
    }
    // Räder
    if (this.d >= 2) {
      const axles = semi ? [front - 1.4, front - 4.4, -front + 3.6, -front + 2.3, -front + 1.0] : [front - 1.4, -front + 1.8];
      for (const f of axles) { [px, pz] = P(f); this.box('rubber', px, 0, pz, 2.6, 1.0, 1.0, ry); }
    }
  }
  // Gabelstapler
  forklift(x, z, ry, color = 'paint_orange') {
    if (this.d < 2) return;
    const s = Math.sin(ry), c = Math.cos(ry);
    this.box(color, x, 0.25, z, 1.1, 1.0, 2.0, ry);
    this.box('metal_dark', x - s * 0.3, 1.25, z - c * 0.3, 1.0, 1.0, 0.08, ry);
    this.box('metal_dark', x + s * 1.1, 0.1, z + c * 1.1, 0.9, 2.4, 0.12, ry);
    this.box('rubber', x, 0, z, 1.15, 0.5, 1.6, ry);
  }

  // ---------- Kleinteile
  // Container 20' (6,06 m) oder 40' (12,19 m), Unterkante y, Länge entlang lokaler z bei ry
  container(x, y, z, ry, long = false, mat) {
    const L = long ? 12.19 : 6.06;
    mat = mat || this.pick(CONT);
    this.box(mat, x, y, z, 2.44, 2.59, L, ry);
    if (this.d >= 2) {
      const s = Math.sin(ry), c = Math.cos(ry);
      for (const f of [L / 2 - 0.08, -L / 2 + 0.08]) this.box('metal_dark', x + s * f, y, z + c * f, 2.5, 2.62, 0.14, ry);
    }
  }
  // Containerstapel: Reihen entlang x, Länge entlang z
  containerStack(x, z, cols, tiers, long = false, ry = 0) {
    const s = Math.sin(ry), c = Math.cos(ry);
    for (let i = 0; i < cols; i++) {
      const t = Math.max(1, tiers - (this.r() < 0.35 ? 1 : 0) - (this.r() < 0.15 ? 1 : 0));
      for (let k = 0; k < t; k++) {
        const a = (i - (cols - 1) / 2) * 2.6;
        this.container(x + c * a, k * 2.6, z - s * a, ry, long);
      }
    }
  }
  // Paletten mit Ware
  pallets(x, z, n = 4, ry = 0, y = 0) {
    if (this.d < 1) return;
    const s = Math.sin(ry), c = Math.cos(ry);
    for (let i = 0; i < n; i++) {
      const a = (i - (n - 1) / 2) * 1.35, px = x + c * a, pz = z - s * a;
      const t = 1 + Math.floor(this.r() * 3);
      for (let k = 0; k < t; k++) {
        this.box('wood_planks', px, y + k * 1.25, pz, 1.2, 0.15, 0.8, ry);
        this.box(this.pick(['canvas_white', 'canvas_white', 'wood_planks', 'metal_panel_blue', 'hay']), px, y + k * 1.25 + 0.15, pz, 1.12, 1.05, 0.76, ry);
      }
    }
  }
  barrels(x, z, n = 4, mat = 'paint_blue') {
    if (this.d < 2) return;
    for (let i = 0; i < n; i++) this.cyl(mat, x + (i % 3) * 0.65, 0, z + Math.floor(i / 3) * 0.65, 0.3, 0.9, { seg: 8 });
  }
  // Mast-Leuchte; der Ausleger zeigt immer zur Grundstücksmitte. Licht nachts über kit.light
  lamp(x, z, h = 7) {
    const ry = Math.atan2(-x, -z);
    if (this.d >= 1) {
      this.box('metal_dark', x, 0, z, 0.18, h, 0.18);
      if (this.d >= 2) {
        const s = Math.sin(ry), c = Math.cos(ry);
        this.box('metal_dark', x + s * 0.6, h - 0.15, z + c * 0.6, 0.3, 0.18, 1.3, ry);
      }
    }
    this.k.light((x + Math.sin(ry) * 1.0) * M, (h - 0.2) * M, (z + Math.cos(ry) * 1.0) * M, 0xffd9a0, 0.32);
  }
  // Wandleuchte über Tor/Tür
  wallLight(f, a, y) {
    const [x, z] = f.at(a, 0.4);
    if (this.d >= 2) this.fbox('metal_dark', f, a, y, 0.3, 0.2, 0.35);
    this.k.light(x * M, y * M, z * M, 0xffe2b0, 0.22);
  }
  // Zaun zwischen zwei Punkten (Maschendraht mit Pfosten)
  // Zaun als Pfosten + Holme (durchsichtig wirkend, da das Atlas-Material undurchsichtig ist)
  fence(ax, az, bx, bz, h = 2, mat = 'chain_fence') {
    if (this.d < 1) return;
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.2) return;
    const ry = Math.atan2(bx - ax, bz - az);
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const post = mat === 'chain_fence' ? 'metal_dark' : mat;
    const rails = this.d >= 2 ? [0.12, h * 0.5, h - 0.06] : [h - 0.08];
    for (const y of rails) this.box(mat, mx, y, mz, 0.06, 0.07, len, ry);
    const n = Math.max(1, Math.round(len / (this.d >= 2 ? 2.5 : 5)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      this.box(post, ax + (bx - ax) * t, 0, az + (bz - az) * t, 0.09, h + 0.05, 0.09);
    }
  }
  // Umzäuntes Rechteck mit Tor an der Front (gate = Breite der Lücke, ga = Mitte der Lücke)
  fenceLot(x, z, sx, sz, o = {}) {
    const h = o.h ?? 2, gate = o.gate ?? 6, ga = o.ga ?? 0;
    const x0 = x - sx / 2, x1 = x + sx / 2, z0 = z - sz / 2, z1 = z + sz / 2;
    if (o.back !== false) this.fence(x0, z0, x1, z0, h);
    if (o.left !== false) this.fence(x0, z0, x0, z1, h);
    if (o.right !== false) this.fence(x1, z0, x1, z1, h);
    if (o.front !== false) {
      const g0 = clamp(x + ga - gate / 2, x0, x1), g1 = clamp(x + ga + gate / 2, x0, x1);
      if (g0 - x0 > 0.3) this.fence(x0, z1, g0, z1, h);
      if (x1 - g1 > 0.3) this.fence(g1, z1, x1, z1, h);
      if (this.d >= 2 && o.barrier !== false && gate > 3) {
        this.box('paint_white', g0 + 0.3, 0, z1, 0.5, 1.0, 0.5);
        this.box('paint_red', g0 + gate * 0.5, 0.95, z1 - 0.3, gate * 0.9, 0.12, 0.1);
      }
    }
  }
  // Bäume
  tree(x, z, s = 1, kind = 'laub') {
    // Krone bleibt auf dem Grundstück
    const cr = (kind === 'nadel' ? 2.1 : kind === 'pappel' ? 1.6 : kind === 'busch' ? 1.0 : kind === 'obst' ? 1.4 : 2.4) * s + 0.15;
    x = clamp(x, -this.W / 2 + cr, this.W / 2 - cr); z = clamp(z, -this.D / 2 + cr, this.D / 2 - cr);
    if (kind === 'nadel') {
      if (this.d >= 1) this.cyl('bark', x, 0, z, 0.22 * s, 2.0 * s, { seg: 5, exact: true });
      const leaf = this.chance(0.5) ? 'leaves_dark' : 'hedge';
      this.cone(leaf, x, 1.2 * s, z, 2.0 * s, 4.2 * s, { seg: this.d >= 1 ? 7 : 5, exact: true });
      if (this.d >= 1) this.cone(leaf, x, 3.6 * s, z, 1.45 * s, 3.4 * s, { seg: 6, exact: true });
      return;
    }
    if (kind === 'pappel') {
      if (this.d >= 1) this.cyl('bark', x, 0, z, 0.2 * s, 2.0 * s, { seg: 5, exact: true });
      this.sphere('leaves_green', x, 5.2 * s, z, 1.5 * s, { seg: this.d >= 1 ? 8 : 5, sy: 2.6 });
      return;
    }
    if (kind === 'busch') { this.sphere(this.chance(0.5) ? 'hedge' : 'leaves_dark', x, 0.5 * s, z, 1.0 * s, { seg: this.d >= 1 ? 7 : 5, sy: 0.75 }); return; }
    if (kind === 'obst') {
      if (this.d >= 1) this.cyl('bark', x, 0, z, 0.14 * s, 1.3 * s, { seg: 5, exact: true });
      this.sphere(this.chance(0.3) ? 'leaves_light' : 'leaves_green', x, 2.0 * s, z, 1.3 * s, { seg: this.d >= 1 ? 7 : 5, sy: 0.85 });
      return;
    }
    const leaf = this.pick(['leaves_green', 'leaves_dark', 'leaves_green', 'leaves_light']);
    if (this.d >= 1) this.cyl('bark', x, 0, z, 0.24 * s, 2.6 * s, { seg: 5, exact: true });
    this.sphere(leaf, x, 4.2 * s, z, 2.0 * s, { seg: this.d >= 1 ? 8 : 5, sy: 0.9 });
    if (this.d >= 2 && this.chance(0.6)) this.sphere(leaf, x + 0.6 * s, 3.3 * s, z + 0.4 * s, 1.4 * s, { seg: 7 });
  }
  hedge(x, z, sx, sz, h = 1.1) { if (this.d >= 1) this.box('hedge', x, 0, z, sx, h, sz); }
  // Grünstreifen mit Bäumen entlang x
  greenStrip(x, z, sx, sz, nTrees = 0, kind = 'laub') {
    this.ground('grass', x, z, sx, sz, 0.12);
    for (let i = 0; i < nTrees; i++) this.tree(x - sx / 2 + (i + 0.5) * (sx / nTrees), z + (this.r() - 0.5) * sz * 0.3, this.rnd(0.75, 1.05), kind);
  }

  // Schild an Fassade: weißer Leuchtkasten mit Logo und „Schrift"
  sign(f, a, y, w, h, o = {}) {
    this.fbox(o.bg || 'sign_white', f, a, y, w, h, 0.14, 0.02);
    if (this.d >= 1) {
      const logo = o.logo || this.pick(LOGO);
      const s = h * 0.72;
      if (o.disc) {
        const [lx, lz] = f.at(a - w / 2 + h * 0.55, 0.18);
        const geo = new THREE.CylinderGeometry(s / 2, s / 2, 0.06, this.seg(14)).rotateX(HP);
        this.g(logo, geo, lx, y + h / 2, lz, { ry: f.ry });
      } else this.fbox(logo, f, a - w / 2 + h * 0.55, y + h * 0.14, s, s, 0.05, 0.16);
      if (this.d >= 2 && w > h * 2) {
        const tw = w - h * 1.4;
        this.fbox(o.text || 'trim_dark', f, a + h * 0.45, y + h * 0.52, tw, h * 0.22, 0.03, 0.16);
        this.fbox(o.text || 'trim_dark', f, a + h * 0.45 - tw * 0.15, y + h * 0.2, tw * 0.7, h * 0.16, 0.03, 0.16);
      }
    }
  }
  // Werbepylon an der Einfahrt
  pylon(x, z, h = 6, logo, ry = 0) {
    logo = logo || this.pick(LOGO);
    this.box('metal_dark', x, 0, z, 1.4, h, 0.4, ry);
    this.box('sign_white', x, h * 0.45, z, 1.3, h * 0.5, 0.5, ry);
    if (this.d >= 1) {
      const s = Math.sin(ry), c = Math.cos(ry);
      for (const sd of [1, -1]) this.box(logo, x + s * 0.27 * sd, h * 0.72, z + c * 0.27 * sd, 0.9, 0.9, 0.04, ry);
    }
  }
  flags(x, z, n = 3, ry = 0) {
    if (this.d < 2) return;
    const s = Math.sin(ry), c = Math.cos(ry);
    for (let i = 0; i < n; i++) {
      const a = (i - (n - 1) / 2) * 1.6, px = x + c * a, pz = z - s * a;
      this.cyl('metal_light', px, 0, pz, 0.06, 8, { seg: 5, exact: true });
      this.box(this.pick(LOGO), px + c * 0.75, 6.3, pz - s * 0.75, 1.5, 1.0, 0.04, ry);
    }
  }

  // ---------- Dachaufbauten
  hvac(x, y, z, s = 1, ry = 0) {
    if (this.d < 1) return;
    this.box('metal_light', x, y, z, 2.2 * s, 1.1 * s, 1.4 * s, ry);
    if (this.d >= 2) {
      const sn = Math.sin(ry), c = Math.cos(ry);
      for (const a of [-0.55, 0.55]) this.cyl('metal_dark', x + c * a * s, y + 1.1 * s, z - sn * a * s, 0.42 * s, 0.08, { seg: 10 });
    }
  }
  vents(x, y, z, sx, sz, n = 3) {
    if (this.d < 1) return;
    for (let i = 0; i < n; i++) {
      const px = x + (this.r() - 0.5) * sx, pz = z + (this.r() - 0.5) * sz, t = this.r();
      if (t < 0.4) this.hvac(px, y, pz, this.rnd(0.7, 1.1), this.chance(0.5) ? 0 : HP);
      else if (t < 0.75) { this.cyl('metal_light', px, y, pz, 0.3, 1.0, { seg: 8 }); if (this.d >= 2) this.cone('metal_light', px, y + 1.0, pz, 0.45, 0.3, { seg: 8 }); }
      else this.box('metal_panel_grey', px, y, pz, 1.6, 0.8, 1.2);
    }
  }
  // Lichtkuppeln auf Flachdach
  domelights(x, y, z, sx, sz, nx, nz, glass = 'glass_skylight') {
    if (this.d < 1) return;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const px = x - sx / 2 + (i + 0.5) * (sx / nx), pz = z - sz / 2 + (j + 0.5) * (sz / nz);
      this.box('metal_light', px, y, pz, 1.6, 0.3, 1.6);
      this.box(glass, px, y + 0.3, pz, 1.3, 0.25, 1.3, 0, this.r());
    }
  }
  // Lichtfirste (verglaste Satteldach-Streifen) entlang x
  skylightRidges(x, y, z, sx, sz, n, glass = 'glass_skylight') {
    for (let j = 0; j < n; j++) {
      const pz = z - sz / 2 + (j + 0.5) * (sz / n);
      this.box('metal_light', x, y, pz, sx, 0.35, 2.4);
      this.prism(glass, [[-1.0, 0], [1.0, 0], [0, 0.8]], sx - 0.4, x, y + 0.35, pz, HP);
    }
  }
  // Solarmodule in Reihen (Reihen entlang x), geneigt nach +z
  solar(x, y, z, sx, sz, o = {}) {
    if (this.d === 0) { this.box('solar_panel', x, y + 0.2, z, sx, 0.3, sz); return; }
    const rowD = o.rowD ?? 2.6, tilt = o.tilt ?? 0.32;
    const n = Math.max(1, Math.floor(sz / rowD));
    for (let j = 0; j < n; j++) {
      const pz = z - sz / 2 + (j + 0.5) * (sz / n);
      this.boxc('solar_panel', x, y + 0.65, pz, sx, 0.06, rowD * 0.62, { rx: tilt });
      if (this.d >= 2) this.box('metal_light', x, y, pz - rowD * 0.18, sx * 0.98, 0.5, 0.08);
    }
  }
  // Dachgeländer (Absturzsicherung)
  roofRail(x, y, z, sx, sz) {
    if (this.d < 2) return;
    for (const s of [-1, 1]) {
      this.box('metal_light', x, y + 1.0, z + s * (sz / 2 - 0.3), sx - 0.6, 0.06, 0.06);
      this.box('metal_light', x + s * (sx / 2 - 0.3), y + 1.0, z, 0.06, 0.06, sz - 0.6);
    }
  }

  // ---------- Fassadenelemente
  // Rolltor
  rollerDoor(f, a, w, h, o = {}) {
    const y0 = o.y0 || 0, fr = o.frame || 'metal_dark';
    this.fbox(o.mat || 'metal_panel_grey', f, a, y0, w, h, 0.08, 0.02);
    if (this.d >= 1) {
      for (const s of [-1, 1]) this.fbox(fr, f, a + s * (w / 2 + 0.1), y0, 0.2, h + 0.15, 0.14, 0.0);
      this.fbox(fr, f, a, y0 + h, w + 0.4, 0.45, 0.25, 0.0);
    }
    if (this.d >= 2) {
      for (let k = 1; k < 5; k++) this.fbox(fr, f, a, y0 + (h * k) / 5, w - 0.05, 0.05, 0.02, 0.1);
      if (o.window !== false && h > 3) this.fplane(o.glass || 'glass_window', f, a, y0 + h * 0.55, w * 0.8, 0.45, 0.115);
      if (!y0 && o.bollards !== false) for (const s of [-1, 1]) { const [px, pz] = f.at(a + s * (w / 2 + 0.45), 0.5); this.cyl('paint_yellow', px, 0, pz, 0.12, 1.1, { seg: 6, exact: true }); }
    }
  }
  // Ladetor mit Torabdichtung (moderne Rampe), Torunterkante 1,2 m
  dockDoor(f, a, o = {}) {
    const w = o.w ?? 3, h = o.h ?? 3;
    this.rollerDoor(f, a, w, h, { y0: 1.2, mat: o.mat || 'metal_panel_white', bollards: false, window: false });
    if (this.d >= 1) {
      // Torabdichtung (schwarzer Rahmen) und Puffer
      this.fbox('rubber', f, a, 1.0, w + 1.0, 0.5, 0.6, 0.1);
      for (const s of [-1, 1]) this.fbox('rubber', f, a + s * (w / 2 + 0.35), 1.2, 0.35, h + 0.3, 0.6, 0.1);
      this.fbox('rubber', f, a, 1.2 + h, w + 1.0, 0.45, 0.6, 0.1);
    }
    if (this.d >= 2) {
      for (const s of [-1, 1]) this.fbox('rubber', f, a + s * (w / 2 - 0.2), 0.7, 0.3, 0.4, 0.3, 0.7);
      if (o.pad !== false) this.fbox('stone_dark', f, a, 0, w + 1.0, 0.12, o.padD ?? 3.5, 0.0);
      this.wallLight(f, a + w / 2 + 0.9, 1.2 + h + 0.4);
    }
  }
  // Rampe (Betonsockel) über mehrere Tore mit Vordach
  dockPlatform(f, a0, a1, o = {}) {
    const dep = o.depth ?? 2.6, h = o.h ?? 1.2;
    this.fbox('concrete', f, (a0 + a1) / 2, 0, a1 - a0, h, dep, 0);
    if (this.d >= 1 && o.canopy !== false) {
      this.fbox(o.canopyMat || 'metal_panel_grey', f, (a0 + a1) / 2, o.canopyY ?? h + 3.6, a1 - a0 + 0.6, 0.25, dep + 0.8, 0);
    }
    if (this.d >= 2) {
      this.fbox('metal_dark', f, a0 - 0.6, 0, 1.2, 0.15, 0.9, dep - 0.9);
      const n = Math.max(1, Math.round((a1 - a0) / 3));
      for (let i = 0; i < n; i++) this.fbox('rubber', f, a0 + (i + 0.5) * ((a1 - a0) / n), 0.6, 0.3, 0.45, 0.25, dep);
    }
  }
  // Personaltür mit Vordach und Leuchte
  door(f, a, o = {}) {
    const w = o.w ?? 1.1, h = o.h ?? 2.2;
    this.fbox(o.mat || 'metal_panel_grey', f, a, 0, w, h, 0.08, 0.02);
    if (this.d >= 1) this.fbox(o.frame || 'metal_dark', f, a, h, w + 0.3, 0.15, 0.1, 0.02);
    if (this.d >= 2) {
      if (o.canopy !== false) this.fbox(o.canopy || 'metal_dark', f, a, h + 0.35, w + 1.0, 0.1, 1.1, 0);
      this.wallLight(f, a, h + 0.2);
    }
  }
  // Glaseingang mit Vordach
  entrance(f, a, w, h, o = {}) {
    const glass = o.glass || 'glass_window';
    this.fbox('metal_dark', f, a, 0, w + 0.3, h + 0.2, 0.12, 0);
    this.fplane(glass, f, a, 0.05, w, h, 0.14);
    if (this.d >= 1) {
      this.fbox(o.canopy || 'metal_light', f, a, h + 0.25, w + 2.0, 0.22, o.canopyD ?? 1.5, 0);
      if (this.d >= 2) {
        const n = Math.max(2, Math.round(w / 1.2));
        for (let i = 1; i < n; i++) this.fbox('metal_dark', f, a - w / 2 + (i * w) / n, 0, 0.08, h, 0.06, 0.14);
        this.fbox('metal_dark', f, a, 2.3, w, 0.08, 0.06, 0.14);
        this.wallLight(f, a, h + 0.1);
      }
    }
  }
  // Fensterband (Lichtband) auf einer Fassade zwischen a0 und a1
  band(f, a0, a1, y, h, o = {}) {
    const glass = o.glass || 'glass_window', fr = o.frame || 'metal_dark';
    const w = a1 - a0, a = (a0 + a1) / 2;
    if (w <= 0.3) return;
    // in Abschnitte teilen, damit nachts nicht ganze Bänder auf einmal leuchten
    const parts = Math.max(1, Math.round(w / (o.part || 6)));
    for (let p = 0; p < parts; p++) this.fplane(glass, f, a0 + (p + 0.5) * (w / parts), y, w / parts, h, 0.04);
    if (this.d >= 1) {
      this.fbox(fr, f, a, y - 0.12, w + 0.1, 0.12, 0.12, 0);
      this.fbox(fr, f, a, y + h, w + 0.1, 0.12, 0.12, 0);
    }
    if (this.d >= 2) {
      const n = Math.max(1, Math.round(w / (o.mull ?? 1.4)));
      for (let i = 1; i < n; i++) this.fbox(fr, f, a0 + (i * w) / n, y, 0.08, h, 0.08, 0.02);
    }
  }
  // Einzelfenster-Reihe (mit Rahmen) über den Baukasten; Fernansicht als lod_windows
  winRow(f, a0, a1, y, w, h, o = {}) {
    const sp = o.spacing ?? w + 1.4;
    const len = a1 - a0;
    const n = Math.max(1, Math.floor((len + sp - w) / sp));
    const used = (n - 1) * sp, ac = (a0 + a1) / 2;
    if (this.d === 0) {
      if (o.lod !== false) { const [x, z] = f.at(ac, 0.04); this.lodWin(x, y + h / 2, z, n * sp, h / 0.6, n, 1, f.ry); }
      return;
    }
    for (let k = 0; k < n; k++) {
      const a = ac - used / 2 + k * sp;
      const [x, z] = f.at(a, 0.03);
      this.k.window(x * M, y * M, z * M, f.ry, w * M, h * M, { glass: o.glass || 'glass_window', frame: o.frame || 'window_frame_dark', sill: o.sill, lit: this.r(), mullion: o.mullion });
      if (o.lintel && this.d >= 2) this.fbox(o.lintel, f, a, y + h + 0.1, w + 0.5, 0.35, 0.08, 0);
      if (o.arch && this.d >= 1) {
        const [ax, az] = f.at(a, 0.05);
        const r = w / 2 + 0.2;
        const prof = [];
        for (let i = 0; i <= 6; i++) { const t = PI - (i / 6) * PI; prof.push([Math.cos(t) * r, Math.sin(t) * r * 0.55]); }
        for (let i = 6; i >= 0; i--) { const t = PI - (i / 6) * PI; prof.push([Math.cos(t) * (r - 0.3), Math.sin(t) * (r - 0.3) * 0.5]); }
        this.prism(o.arch, prof, 0.12, ax, y + h + 0.05, az, f.ry);
      }
    }
  }

  // ---------- Hallen
  // o: { x, z, sx, sz, h, wall, plinth, plinthH, roof: 'flat'|'gable'|'saw'|'shed'|'barrel'|'monitor', roofMat, pitch,
  //      ridge 'x'|'z', over, trim, bay, ribs, ribMat, ribSides, parapet, parMat, sawGlass, teeth, toothH, gutter }
  // Rückgabe: { f: Fassaden, bays: Feldmitten je Seite, top: Traufhöhe, ridgeTop }
  hall(o) {
    const x = o.x ?? 0, z = o.z ?? 0, sx = o.sx, sz = o.sz, h = o.h;
    const wall = o.wall || 'metal_corrugated', trim = o.trim || 'metal_dark';
    const roof = o.roof || 'gable', roofMat = o.roofMat || 'roof_metal_grey';
    const parapet = roof === 'flat' ? (o.parapet ?? 0.8) : 0;
    const d = this.d;
    // Wandkörper (in der Fernansicht inkl. Attika)
    this.box(wall, x, 0, z, sx, h + (d === 0 ? parapet : 0), sz);
    if (d >= 1 && (o.plinthH ?? 0.7) > 0) this.box(o.plinth || 'concrete', x, 0, z, sx + 0.12, o.plinthH ?? 0.7, sz + 0.12);
    const f = this.faces(x, z, sx, sz);
    const bay = o.bay ?? 6;
    const bays = {};
    for (const s of SIDES) {
      const fc = f[s];
      const n = Math.max(1, Math.round(fc.len / bay));
      const w = fc.len / n;
      bays[s] = Array.from({ length: n }, (_, i) => -fc.len / 2 + w * (i + 0.5));
      if (d >= 1 && o.ribs !== false && (o.ribSides || SIDES).includes(s)) {
        for (let i = 0; i <= n; i++) {
          const a = clamp(-fc.len / 2 + w * i, -fc.len / 2 + 0.16, fc.len / 2 - 0.16);
          this.fbox(o.ribMat || trim, fc, a, 0, 0.32, h + (roof === 'flat' ? parapet : 0), o.ribDepth ?? 0.16, 0);
        }
      }
    }
    let ridgeTop = h;
    if (roof === 'flat') {
      if (d === 0) {
        this.box(o.roofMat || 'roof_flat_membrane', x, h + parapet, z, sx - 0.5, 0.03, sz - 0.5);
      } else {
        this.box(o.roofMat || 'roof_flat_membrane', x, h, z, sx - 0.3, 0.1, sz - 0.3);
        const t = 0.3, pm = o.parMat || wall;
        if (parapet > 0) {
          this.box(pm, x, h, z + sz / 2 - t / 2, sx, parapet, t);
          this.box(pm, x, h, z - sz / 2 + t / 2, sx, parapet, t);
          this.box(pm, x - sx / 2 + t / 2, h, z, t, parapet, sz - 2 * t);
          this.box(pm, x + sx / 2 - t / 2, h, z, t, parapet, sz - 2 * t);
          if (d >= 2) {
            const cp = o.coping || 'metal_light';
            this.box(cp, x, h + parapet, z + sz / 2 - t / 2, sx + 0.08, 0.08, t + 0.08);
            this.box(cp, x, h + parapet, z - sz / 2 + t / 2, sx + 0.08, 0.08, t + 0.08);
            this.box(cp, x - sx / 2 + t / 2, h + parapet, z, t + 0.08, 0.08, sz - 2 * t);
            this.box(cp, x + sx / 2 - t / 2, h + parapet, z, t + 0.08, 0.08, sz - 2 * t);
          }
        }
      }
      ridgeTop = h + parapet;
    } else if (roof === 'gable' || roof === 'monitor') {
      const ridge = o.ridge || (sx >= sz ? 'x' : 'z');
      const span = ridge === 'x' ? sz : sx, len = ridge === 'x' ? sx : sz;
      const rise = Math.tan(((o.pitch ?? 8) * PI) / 180) * (span / 2);
      const ov = o.over ?? 0.5, t = 0.3;
      const w = span / 2 + ov, dy = (ov * rise) / (span / 2);
      const ry = ridge === 'x' ? HP : 0;
      this.prism(roofMat, [[-w, -dy], [w, -dy], [w, -dy + t], [0, rise + t], [-w, -dy + t]], len + ov * 2 * (o.gableOver ?? 0.6), x, h, z, ry);
      this.prism(wall, [[-span / 2, 0], [span / 2, 0], [0, rise]], len - 0.02, x, h, z, ry);
      ridgeTop = h + rise + t;
      if (d >= 2 && o.gutter !== false) {
        for (const s of [-1, 1]) {
          if (ridge === 'x') this.box(trim, x, h - dy - 0.1, z + s * (w - 0.08), len + ov * 1.2, 0.18, 0.18);
          else this.box(trim, x + s * (w - 0.08), h - dy - 0.1, z, 0.18, 0.18, len + ov * 1.2);
        }
        // Fallrohre an den Ecken
        for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
          const px = ridge === 'x' ? x + sa * (sx / 2 - 0.4) : x + sb * (sx / 2 + 0.12);
          const pz = ridge === 'x' ? z + sb * (sz / 2 + 0.12) : z + sa * (sz / 2 - 0.4);
          this.box(trim, px, 0.3, pz, 0.14, h - 0.3, 0.14);
        }
      }
      if (roof === 'monitor') {
        const lw = o.lanternW ?? Math.min(span * 0.3, 5), lh = o.lanternH ?? 1.8, ll = len * (o.lanternL ?? 0.82);
        const ly = h + rise - (lw / 2) * (rise / (span / 2)) - 0.05;
        const lsx = ridge === 'x' ? ll : lw, lsz = ridge === 'x' ? lw : ll;
        this.box(o.lanternWall || wall, x, ly, z, lsx, lh + 0.1, lsz);
        const lf = this.faces(x, z, lsx, lsz);
        const sides = ridge === 'x' ? ['front', 'back'] : ['left', 'right'];
        for (const s of sides) this.band(lf[s], -lf[s].len / 2 + 0.4, lf[s].len / 2 - 0.4, ly + 0.35, lh - 0.55, { glass: o.sawGlass || 'glass_window', part: 5, mull: 1.2 });
        const lr = Math.tan((14 * PI) / 180) * (lw / 2 + 0.4);
        this.prism(roofMat, [[-lw / 2 - 0.4, 0], [lw / 2 + 0.4, 0], [lw / 2 + 0.4, 0.2], [0, lr + 0.2], [-lw / 2 - 0.4, 0.2]], ll + 0.6, x, ly + lh + 0.1, z, ry);
        ridgeTop = ly + lh + lr + 0.3;
      }
    } else if (roof === 'shed') {
      const rise = o.rise ?? Math.tan(((o.pitch ?? 8) * PI) / 180) * sz;
      const ov = o.over ?? 0.4;
      // höher an der Front (o.high = 'front') oder hinten
      const hiFront = o.high !== 'back';
      const prof = hiFront ? [[-sz / 2 - ov, 0], [sz / 2 + ov, rise], [sz / 2 + ov, rise + 0.3], [-sz / 2 - ov, 0.3]] : [[-sz / 2 - ov, rise], [sz / 2 + ov, 0], [sz / 2 + ov, 0.3], [-sz / 2 - ov, rise + 0.3]];
      // Profil u entlang z (u → Welt +z bei ry = -HP)
      this.prism(roofMat, prof, sx + ov * 2, x, h, z, -HP);
      const wp = hiFront ? [[-sz / 2, 0], [sz / 2, 0], [sz / 2, rise * (sz / (sz + 2 * ov)) + rise * (ov / (sz + 2 * ov))], [-sz / 2, rise * (ov / (sz + 2 * ov))]] : [[-sz / 2, 0], [sz / 2, 0], [sz / 2, rise * (ov / (sz + 2 * ov))], [-sz / 2, rise * ((sz + ov) / (sz + 2 * ov))]];
      this.prism(wall, wp, sx - 0.02, x, h, z, -HP);
      ridgeTop = h + rise + 0.3;
    } else if (roof === 'saw') {
      const teeth = o.teeth ?? Math.max(2, Math.round(sz / 6));
      const dd = sz / teeth, ht = o.toothH ?? Math.min(3.2, dd * 0.55);
      const glass = o.sawGlass || 'glass_skylight';
      for (let k = 0; k < teeth; k++) {
        const zc = z - sz / 2 + dd * (k + 0.5);
        // Profil (u → Welt -z bei ry = HP): senkrechte Glasseite vorne (+z)
        this.prism(wall, [[-dd / 2, 0], [dd / 2, 0], [-dd / 2, ht]], sx - 0.02, x, h, zc, HP);
        if (d >= 1) this.beam(roofMat, [x, h + 0.05, zc - dd / 2 - 0.15], [x, h + ht + 0.12, zc + dd / 2 + 0.05], sx + 0.4, 0.2);
        else this.beam(roofMat, [x, h + 0.02, zc - dd / 2], [x, h + ht + 0.06, zc + dd / 2], sx + 0.1, 0.1);
        const parts = Math.max(1, Math.round(sx / 6));
        for (let p = 0; p < parts; p++) this.plane(glass, x - sx / 2 + (p + 0.5) * (sx / parts), h + ht * 0.47, zc + dd / 2 + 0.03, (sx / parts) * 0.97, ht * 0.8, 0);
        if (d >= 2) {
          const n = Math.max(2, Math.round(sx / 1.5));
          for (let i = 1; i < n; i++) this.box(trim, x - sx / 2 + (i * sx) / n, h + 0.06, zc + dd / 2 + 0.05, 0.1, ht * 0.86, 0.08);
          this.box(trim, x, h + ht * 0.07, zc + dd / 2 + 0.05, sx, 0.12, 0.1);
        }
      }
      ridgeTop = h + ht + 0.3;
    } else if (roof === 'barrel') {
      const ridge = o.ridge || (sx >= sz ? 'x' : 'z');
      const span = ridge === 'x' ? sz : sx, len = ridge === 'x' ? sx : sz;
      const rise = o.rise ?? span * 0.14;
      const n = d >= 2 ? 12 : d === 1 ? 8 : 6;
      const arc = (sp, rs, off) => {
        const R = (sp * sp / 4 + rs * rs) / (2 * rs), cy = rs - R;
        const a0 = Math.asin(clamp(sp / 2 / R, -1, 1));
        const pts = [];
        for (let i = 0; i <= n; i++) { const t = -a0 + (2 * a0 * i) / n; pts.push([Math.sin(t) * (R + off), cy + Math.cos(t) * (R + off)]); }
        return pts;
      };
      const inner = arc(span, rise, 0);
      this.prism(wall, inner, len - 0.02, x, h, z, ridge === 'x' ? HP : 0);
      const outer = arc(span + 0.8, rise + 0.12, 0.05).map(([u, v]) => [u, v - 0.0]);
      const shell = outer.concat(arc(span + 0.8, rise + 0.12, -0.22).reverse());
      this.prism(roofMat, shell, len + 0.6, x, h - 0.08, z, ridge === 'x' ? HP : 0);
      ridgeTop = h + rise + 0.2;
    }
    return { f, bays, top: h, ridgeTop, x, z, sx, sz };
  }

  // ---------- Industrie-Großteile
  // Schornstein: o: { r, h, mat, rTop, type: 'round'|'square'|'steel', bands, smoke, kind: 'smoke'|'steam', base }
  chimney(x, z, o = {}) {
    const type = o.type || 'round', h = o.h ?? 25, r = o.r ?? 1.2;
    const mat = o.mat || (type === 'steel' ? 'metal_light' : 'chimney_brick');
    const d = this.d;
    if (type === 'steel') {
      this.cyl(mat, x, 0, z, r, h, { seg: 12 });
      if (d >= 1) {
        if (o.stripes) for (let k = 0; k < 3; k++) this.cyl(k % 2 ? 'paint_white' : 'paint_red', x, h - 3.2 * (k + 1), z, r + 0.04, 3.2, { seg: 12, open: true });
        this.cyl('metal_dark', x, h - 0.6, z, r + 0.12, 0.6, { seg: 12 });
        this.cyl('concrete', x, 0, z, r + 0.6, 0.8, { seg: 12 });
      }
      if (d >= 2) {
        // Ringsteifen und Steigleiter
        for (let k = 1; k < 4; k++) this.cyl('metal_dark', x, (h * k) / 4, z, r + 0.08, 0.18, { seg: 12, open: true });
        this.box('metal_dark', x + r + 0.12, 0.8, z, 0.08, h - 1.2, 0.5);
      }
    } else if (type === 'square') {
      const rt = o.rTop ?? r * 0.72;
      const base = o.base ?? Math.min(4, h * 0.12);
      this.box(o.baseMat || mat, x, 0, z, r * 2.6, base, r * 2.6);
      this.cyl(mat, x, base, z, r * 1.414, h - base, { seg: 4, exact: true, rTop: rt * 1.414, ry: PI / 4 });
      if (d >= 1) {
        this.box(o.bands || 'brick_dark', x, h - 1.4, z, rt * 2.3, 1.4, rt * 2.3);
        if (d >= 2) this.box(o.bands || 'brick_dark', x, base + (h - base) * 0.45, z, (r + (rt - r) * 0.45) * 2.15, 0.6, (r + (rt - r) * 0.45) * 2.15);
      }
    } else {
      const rt = o.rTop ?? r * 0.66;
      const base = o.base ?? Math.min(5, h * 0.12);
      if (o.base !== 0) {
        this.box(o.baseMat || mat, x, 0, z, r * 2.7, base, r * 2.7);
        if (d >= 1) this.box(o.bands || 'stone_grey', x, base, z, r * 2.9, 0.4, r * 2.9);
      }
      this.cyl(mat, x, base, z, r, h - base, { seg: 14, rTop: rt });
      if (d >= 1) {
        const rr = (t) => r + (rt - r) * t;
        this.cyl(o.bands || 'brick_dark', x, h - 1.6, z, rt * 1.16, 1.6, { seg: 14, rTop: rt * 1.22 });
        if (d >= 2) for (const t of [0.35, 0.65]) { const yy = base + (h - base) * t; this.cyl(o.bands || 'brick_dark', x, yy, z, rr(t) * 1.07, 0.5, { seg: 14, open: true }); }
      }
    }
    if (o.smoke !== 0) this.k.smoke(x * M, (h + 0.5) * M, z * M, o.kind || 'smoke', o.smoke ?? 1);
    if (h >= 30) this.k.light(x * M, (h + 0.4) * M, z * M, 0xff3020, 0.28);
    return h;
  }
  // Stehender Tank: o: { mat, roof: 'cone'|'dome'|'flat', band, stair, seg }
  tank(x, z, r, h, o = {}) {
    const mat = o.mat || 'tank_white', seg = o.seg || (r > 3 ? 18 : 14), d = this.d;
    const y0 = o.y0 || 0;
    this.cyl(mat, x, y0, z, r, h, { seg });
    if (o.roof === 'dome') this.dome(mat, x, y0 + h, z, r, 0.28, { seg });
    else if (o.roof === 'flat') { if (d >= 1) this.cyl('metal_dark', x, y0 + h, z, r + 0.05, 0.25, { seg, open: true }); }
    else this.cone(mat, x, y0 + h, z, r * 1.01, Math.max(0.3, r * 0.22), { seg });
    if (d >= 1 && o.band) this.cyl(o.band, x, y0 + h * 0.72, z, r + 0.03, Math.max(0.5, h * 0.1), { seg, open: true });
    if (d >= 1 && y0 === 0) this.cyl('concrete', x, 0, z, r + 0.3, 0.3, { seg });
    if (d >= 2) {
      // Geländerring
      this.cyl('metal_dark', x, y0 + h + 0.95, z, r * 0.98, 0.07, { seg, open: true });
      // Wendeltreppe aus Balken am Mantel
      if (o.stair !== false && h > 3) {
        const steps = Math.max(3, Math.round(h / 2.5)), a0 = o.stairA ?? this.rnd(0, PI * 2), span = Math.min(PI * 0.9, (h / r) * 0.45);
        let pa = null;
        for (let i = 0; i <= steps; i++) {
          const a = a0 + (span * i) / steps, yy = y0 + (h * i) / steps;
          const p = [x + Math.cos(a) * (r + 0.45), yy, z + Math.sin(a) * (r + 0.45)];
          if (pa) { this.beam('metal_dark', pa, p, 0.7, 0.12); this.beam('metal_dark', [pa[0], pa[1] + 1.0, pa[2]], [p[0], p[1] + 1.0, p[2]], 0.06, 0.06); }
          pa = p;
        }
      }
      if (o.pipe !== false) { const a = o.pipeA ?? Math.atan2(-z, -x); this.pipe('pipe_metal', [x + Math.cos(a) * (r - 0.1), 0.8, z + Math.sin(a) * (r - 0.1)], [x + Math.cos(a) * (r + 1.4), 0.8, z + Math.sin(a) * (r + 1.4)], 0.22); }
    }
  }
  // Kugelbehälter auf Stützen
  sphereTank(x, z, r, o = {}) {
    const mat = o.mat || 'tank_white';
    const cy = r * 1.15 + 1.2;
    this.sphere(mat, x, cy, z, r, { seg: 16 });
    const n = this.d >= 1 ? 8 : 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PI * 2 + PI / n;
      this.beam(o.legMat || 'metal_dark', [x + Math.cos(a) * r * 0.98, 0, z + Math.sin(a) * r * 0.98], [x + Math.cos(a) * r * 0.98, cy, z + Math.sin(a) * r * 0.98], 0.4);
    }
    if (this.d >= 2) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * PI * 2 + PI / n, b2 = ((i + 1) / n) * PI * 2 + PI / n;
        this.beam('metal_dark', [x + Math.cos(a) * r * 0.98, 0.5, z + Math.sin(a) * r * 0.98], [x + Math.cos(b2) * r * 0.98, cy * 0.75, z + Math.sin(b2) * r * 0.98], 0.12);
      }
      this.beam('metal_dark', [x + r + 1.5, 0, z], [x + r * 0.2, cy + r * 0.98, z], 0.8, 0.12);
      this.cyl('metal_dark', x, cy + r * 0.98, z, 1.2, 0.08, { seg: 10, open: true });
    }
    if (this.d >= 1) this.cyl('concrete', x, 0, z, r + 0.4, 0.25, { seg: 12 });
    return cy + r;
  }
  // Silo: o: { mat, top: 'cone'|'dome', legs (Höhe), hopper, ladder }
  silo(x, z, r, h, o = {}) {
    const mat = o.mat || 'concrete', d = this.d;
    const y0 = o.legs || 0;
    if (y0 > 0) {
      const n = d >= 1 ? 4 : 0;
      for (let i = 0; i < n; i++) { const a = PI / 4 + (i * PI) / 2; this.box('metal_dark', x + Math.cos(a) * r * 0.8, 0, z + Math.sin(a) * r * 0.8, 0.3, y0, 0.3); }
      const hop = Math.min(y0 * 0.7, r * 1.1);
      const geo = new THREE.ConeGeometry(r, hop, this.seg(12)).rotateX(PI).translate(0, -hop / 2, 0);
      this.g(mat, geo, x, y0, z, {});
      if (d === 0) this.box('metal_dark', x, 0, z, r, y0, r);
    }
    this.cyl(mat, x, y0, z, r, h, { seg: o.seg || 14 });
    if (o.top === 'dome') this.dome(o.roofMat || mat, x, y0 + h, z, r, 0.55, { seg: o.seg || 14 });
    else if (o.top !== 'flat') this.cone(o.roofMat || mat, x, y0 + h, z, r * 1.03, r * 0.42, { seg: o.seg || 14 });
    if (d >= 1 && o.rings) for (let k = 1; k < o.rings; k++) this.cyl(o.ringMat || 'metal_dark', x, y0 + (h * k) / o.rings, z, r + 0.05, 0.2, { seg: o.seg || 14, open: true });
    if (d >= 2 && o.ladder !== false) {
      const a = o.ladderA ?? HP;
      this.box('metal_dark', x + Math.cos(a) * (r + 0.25), y0 + 0.5, z + Math.sin(a) * (r + 0.25), 0.5, h - 0.4, 0.5, -a + HP);
    }
    return y0 + h + r * 0.45;
  }
  // Rohrbrücke (achsparallel) mit Portalen und Rohren
  pipeRack(ax, az, bx, bz, h = 5, o = {}) {
    const alongX = Math.abs(bx - ax) >= Math.abs(bz - az);
    const len = alongX ? Math.abs(bx - ax) : Math.abs(bz - az);
    const cx = (ax + bx) / 2, cz = (az + bz) / 2, w = o.w ?? 2.4, d = this.d;
    const mat = o.mat || 'metal_dark';
    const nb = Math.max(2, Math.round(len / 6) + 1);
    for (let i = 0; i < nb; i++) {
      const t = -len / 2 + (len * i) / (nb - 1);
      const px = alongX ? cx + t : cx, pz = alongX ? cz : cz + t;
      for (const s of [-1, 1]) {
        if (d >= 1 || i === 0 || i === nb - 1) this.box(mat, alongX ? px : px + s * w / 2, 0, alongX ? pz + s * w / 2 : pz, 0.3, h, 0.3);
      }
      if (d >= 1) this.box(mat, px, h - 0.3, pz, alongX ? 0.3 : w + 0.3, 0.3, alongX ? w + 0.3 : 0.3);
    }
    const pipes = o.pipes || [['pipe_metal', 0.3], ['paint_yellow', 0.18], ['pipe_metal', 0.22], ['paint_green', 0.16]];
    const np = d === 0 ? 1 : pipes.length;
    for (let j = 0; j < np; j++) {
      const [pm, pr] = d === 0 ? ['pipe_metal', w * 0.35] : pipes[j];
      const off = d === 0 ? 0 : -w / 2 + 0.3 + (j + 0.5) * ((w - 0.6) / np);
      this.hcyl(pm, alongX ? cx : cx + off, h + pr, alongX ? cz + off : cz, pr, len + 0.4, alongX ? 'x' : 'z', { seg: 8 });
    }
  }
  // Förderband (Galerie) von a nach b (Bandoberkante), o: { w, covered, mat }
  conveyor(a, b, o = {}) {
    const w = o.w ?? 1.4, d = this.d;
    const covered = o.covered ?? true;
    const up = covered ? 0.8 : 0.25;
    this.beam(covered ? (o.mat || 'metal_corrugated') : 'metal_dark', [a[0], a[1] + up, a[2]], [b[0], b[1] + up, b[2]], w, covered ? 1.6 : 0.5);
    if (!covered && d >= 1) this.beam('rubber', [a[0], a[1] + 0.55, a[2]], [b[0], b[1] + 0.55, b[2]], w * 0.8, 0.08);
    if (!covered && d >= 2 && o.fill) this.beam(o.fill, [a[0], a[1] + 0.62, a[2]], [b[0], b[1] + 0.62, b[2]], w * 0.45, 0.18);
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const n = Math.max(1, Math.round(len / 8));
    const dx = (b[0] - a[0]) / (len || 1), dz = (b[2] - a[2]) / (len || 1);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t, pz = a[2] + (b[2] - a[2]) * t;
      if (py < 1.2 || (d === 0 && i % 2)) continue;
      if (o.noEnd && (i === 0 || i === n)) continue;
      for (const s of [-1, 1]) this.box('metal_dark', px - dz * s * (w / 2 - 0.1), 0, pz + dx * s * (w / 2 - 0.1), 0.25, py, 0.25);
      if (d >= 2 && py > 4) this.beam('metal_dark', [px - dz * (w / 2), 0.3, pz + dx * (w / 2)], [px + dz * (w / 2), py - 0.2, pz - dx * (w / 2)], 0.1);
    }
  }
  // Portalkran: Schienen entlang z (Länge len), Spannweite span in x, Höhe h; pos = Lage entlang Schiene (-0.5 … 0.5)
  gantry(x, z, span, len, h, o = {}) {
    const mat = o.mat || 'paint_yellow', d = this.d;
    const pos = o.pos ?? this.rnd(-0.25, 0.25);
    const zc = z + clamp(pos * len, -len / 2 + Math.min(2.6, len * 0.4 + 0.4), len / 2 - Math.min(2.6, len * 0.4 + 0.4));
    if (d >= 1) for (const s of [-1, 1]) this.box('rail_track', x + s * span / 2, 0, z, 0.4, 0.12, len);
    const leg = Math.min(2.2, len * 0.4);
    for (const s of [-1, 1]) {
      const px = x + s * span / 2;
      this.beam(mat, [px, 0.6, zc - leg], [px, h, zc - 0.4], 0.5, 0.6);
      this.beam(mat, [px, 0.6, zc + leg], [px, h, zc + 0.4], 0.5, 0.6);
      if (d >= 1) this.box(mat, px, 0, zc, 0.8, 0.7, leg * 2 + 0.8);
    }
    this.box(mat, x, h, zc, span + (o.over ?? 1.6), 1.4, 1.3);
    if (d >= 1) {
      const tx = x + (o.trolley ?? this.rnd(-0.3, 0.3)) * span;
      this.box('metal_dark', tx, h + 1.4, zc, 2.0, 1.1, 2.2);
      if (d >= 2) {
        const hy = o.hookY ?? h * 0.45;
        for (const s of [-0.25, 0.25]) this.box('metal_dark', tx + s, hy + 0.6, zc, 0.04, h - hy - 0.6, 0.04);
        this.box('paint_orange', tx, hy, zc, 0.8, 0.6, 0.5);
        if (o.grab) this.box('metal_dark', tx, hy - 1.2, zc, 1.6, 1.2, 1.6);
      }
    }
  }
  // Leiter (senkrecht) an einer Fassade
  ladder(f, a, y0, h) { if (this.d >= 2) this.fbox('metal_dark', f, a, y0, 0.5, h, 0.08, 0.15); }
  // Treppenturm außen (Stahl) an Fassade
  stairTower(f, a, h, o = {}) {
    if (this.d < 1) return;
    const w = 2.8, dp = 2.6;
    const [x, z] = f.at(a, dp / 2 + 0.05);
    const mat = o.mat || 'metal_dark';
    for (const s of [-1, 1]) for (const t of [-1, 1]) {
      const px = x + Math.cos(f.ry) * s * w / 2 + Math.sin(f.ry) * t * dp / 2, pz = z - Math.sin(f.ry) * s * w / 2 + Math.cos(f.ry) * t * dp / 2;
      this.box(mat, px, 0, pz, 0.15, h, 0.15);
    }
    if (this.d >= 2) {
      const n = Math.max(2, Math.round(h / 3));
      for (let i = 0; i < n; i++) {
        const y = (h * (i + 1)) / n;
        this.box(mat, x, y - 0.1, z, f.ry % PI ? dp : w, 0.12, f.ry % PI ? w : dp);
        const s = i % 2 ? 1 : -1;
        const p0 = f.at(a - s * (w / 2 - 0.4), 0.6), p1 = f.at(a + s * (w / 2 - 0.4), 0.6);
        this.beam(mat, [p0[0], y - (h / n), p0[1]], [p1[0], y, p1[1]], 0.9, 0.12);
      }
    }
  }
}

// Belegungsplan eines Grundstücks: Hauptbauten werden mit take() eingetragen, Nebenteile suchen mit find()
// einen freien Platz (in Metern, Rechtecke achsparallel). So bleiben Fahrzeuge, Tanks und Bäume auf allen
// Grundflächen auf dem Grundstück und überschneiden sich nicht.
export class Plan {
  constructor(b, margin = 0.35) { this.b = b; this.W = b.W; this.D = b.D; this.m = margin; this.rects = []; }
  take(x, z, sx, sz, pad = 0) { this.rects.push([x - sx / 2 - pad, z - sz / 2 - pad, x + sx / 2 + pad, z + sz / 2 + pad]); return [x, z]; }
  takeC(x, z, r, pad = 0) { return this.take(x, z, 2 * r, 2 * r, pad); }
  free(x, z, sx, sz) {
    const x0 = x - sx / 2, x1 = x + sx / 2, z0 = z - sz / 2, z1 = z + sz / 2, e = 1e-6;
    if (x0 < -this.W / 2 + this.m - e || x1 > this.W / 2 - this.m + e || z0 < -this.D / 2 + this.m - e || z1 > this.D / 2 - this.m + e) return false;
    for (const [a0, b0, a1, b1] of this.rects) if (x0 < a1 - e && x1 > a0 + e && z0 < b1 - e && z1 > b0 + e) return false;
    return true;
  }
  // Sucht einen freien Platz für sx × sz. o: { prefer: 'back'|'front'|'left'|'right'|'center', near: [x, z], rot (auch gedreht prüfen),
  //   pad (Abstand), step, zMin, zMax, xMin, xMax }. Rückgabe [x, z, gedreht] oder null.
  find(sx, sz, o = {}) {
    const step = o.step ?? 0.5, pad = o.pad ?? 0.3;
    const best = [];
    const tries = o.rot ? [[sx, sz, false], [sz, sx, true]] : [[sx, sz, false]];
    for (const [ax, az, rot] of tries) {
      const w = ax + 2 * pad, d = az + 2 * pad;
      for (let z = -this.D / 2 + this.m + d / 2; z <= this.D / 2 - this.m - d / 2 + 1e-6; z += step) {
        if ((o.zMin !== undefined && z < o.zMin) || (o.zMax !== undefined && z > o.zMax)) continue;
        for (let x = -this.W / 2 + this.m + w / 2; x <= this.W / 2 - this.m - w / 2 + 1e-6; x += step) {
          if ((o.xMin !== undefined && x < o.xMin) || (o.xMax !== undefined && x > o.xMax)) continue;
          if (!this.free(x, z, w, d)) continue;
          let sc = 0;
          const p = o.prefer || 'front';
          if (p === 'front') sc = -z; else if (p === 'back') sc = z; else if (p === 'left') sc = x; else if (p === 'right') sc = -x; else sc = Math.hypot(x, z);
          if (o.near) sc = Math.hypot(x - o.near[0], z - o.near[1]);
          sc += (rot ? 0.01 : 0) + Math.abs(o.near ? 0 : (p === 'front' || p === 'back' ? x : z)) * 0.02;
          best.push([sc, x, z, rot, w, d]);
        }
      }
    }
    if (!best.length) return null;
    best.sort((a, b2) => a[0] - b2[0]);
    const [, x, z, rot, w, d] = best[0];
    this.take(x, z, w, d);
    return [x, z, rot];
  }
}

// Hilfen für Archetypen
export const lerp = (a, b, t) => a + (b - a) * t;
export { clamp };
