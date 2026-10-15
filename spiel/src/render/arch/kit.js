// Baukasten für prozedurale Architektur.
// Maßstab: 1 Welteinheit = 1 Feld = 10 m. M = 1 Meter. Ursprung = Mitte des Grundstücks auf Bodenhöhe.
// Konvention: Die Straßenseite (Front) zeigt nach +z. Die Ansicht dreht das fertige Modell passend.
// Alle Teile werden pro Material gesammelt und am Ende zu wenigen Geometrien zusammengeführt.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fitLot } from './fit.js';

export const M = 0.1;           // ein Meter
export const FLOOR = 0.3;       // Geschosshöhe (3 m)
const TEX = 1 / (4 * M);        // Texturwiederholung: eine Kachel ≈ 4 m

// Weltbezogene UVs: gleiche Texturdichte auf allen Flächen, unabhängig von der Skalierung.
function worldUV(geo, scale = TEX) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    let u, v;
    if (ny > 0.6) { u = x; v = z; } else if (nx > 0.6) { u = z; v = y; } else { u = x; v = y; }
    uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function ensureLit(geo, value) {
  if (geo.attributes.aLit) return;
  const a = new Float32Array(geo.attributes.position.count).fill(value);
  geo.setAttribute('aLit', new THREE.BufferAttribute(a, 1));
}

// Zwischenspeicher für Grundformen (Quader, Zylinder, Kegel, Kugeln, Prismen) mit gleichen Maßen: spart die
// Erzeugung und das Entindizieren bei jedem Aufruf. Die gespeicherte Geometrie wird nie verändert – kit.add kopiert sie.
const PRIM = new Map();
function prim(key, make) {
  let g = PRIM.get(key);
  if (!g) {
    g = make();
    if (g.index) g = g.toNonIndexed();
    if (PRIM.size > 6000) PRIM.clear();
    PRIM.set(key, g);
  }
  return g;
}
const qk = (v) => Math.round(v * 1e5);

// Detailstufen: 2 = volles Modell, 1 = mittlere Entfernung (keine Kleinteile), 0 = Fernansicht
// (Fenster nur als Muster-Flächen mit Material 'lod_windows', keine Sprossen, Balkone, Dachaufbauten).
export class Kit {
  constructor(rng, detail = 2) {
    this.rng = rng || Math.random;
    this.detail = detail;
    this.groups = new Map(); // Material → [Geometrie]
    this.emitters = [];      // Rauch/Dampf: {x, y, z, type: 'smoke'|'steam', amount}
    this.lights = [];        // Nachtlichter: {x, y, z, color, size}
    this.height = 0;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
  }

  // Fügt eine Geometrie hinzu. o: {x,y,z, rx,ry,rz, sx,sy,sz, lit, uv:'keep'|Zahl}
  add(mat, geo, o = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    this._e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ');
    this._q.setFromEuler(this._e);
    this._m.compose(new THREE.Vector3(o.x || 0, o.y || 0, o.z || 0), this._q, new THREE.Vector3(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1));
    g.applyMatrix4(this._m);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (o.uv !== 'keep') worldUV(g, typeof o.uv === 'number' ? o.uv : TEX);
    ensureLit(g, o.lit ?? 0);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'aLit'].includes(k)) g.deleteAttribute(k);
    if (!this.groups.has(mat)) this.groups.set(mat, []);
    this.groups.get(mat).push(g);
    const top = this._topOf(g);
    if (top > this.height) this.height = top;
    return g;
  }
  _topOf(g) { g.computeBoundingBox(); return g.boundingBox.max.y; }

  // --- Grundformen (y0 = Unterkante)
  box(mat, x, y0, z, sx, sy, sz, o = {}) {
    const geo = prim(`b${qk(sx)},${qk(sy)},${qk(sz)}`, () => new THREE.BoxGeometry(sx, sy, sz).translate(0, sy / 2, 0));
    return this.add(mat, geo, { ...o, x, y: y0, z });
  }
  cyl(mat, x, y0, z, r, h, o = {}) {
    const rt = o.rTop ?? r, seg = o.seg || 14, open = !!o.open;
    const geo = prim(`c${qk(rt)},${qk(r)},${qk(h)},${seg},${open}`, () => new THREE.CylinderGeometry(rt, r, h, seg, 1, open).translate(0, h / 2, 0));
    return this.add(mat, geo, { ...o, x, y: y0, z });
  }
  cone(mat, x, y0, z, r, h, o = {}) {
    const seg = o.seg || 12;
    const geo = prim(`k${qk(r)},${qk(h)},${seg}`, () => new THREE.ConeGeometry(r, h, seg).translate(0, h / 2, 0));
    return this.add(mat, geo, { ...o, x, y: y0, z });
  }
  sphere(mat, x, y, z, r, o = {}) {
    const seg = o.seg || 14;
    const geo = prim(`s${qk(r)},${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1)));
    return this.add(mat, geo, { ...o, x, y, z });
  }
  dome(mat, x, y0, z, r, o = {}) {
    const seg = o.seg || 18;
    const geo = prim(`d${qk(r)},${seg}`, () => new THREE.SphereGeometry(r, seg, 8, 0, Math.PI * 2, 0, Math.PI / 2));
    return this.add(mat, geo, { ...o, x, y: y0, z, sy: o.sy ?? 1 });
  }
  // Beliebiges Prisma aus einem 2D-Profil (in x/y), extrudiert entlang z mit Länge len
  prism(mat, profile, len, o = {}) {
    const geo = prim('p' + qk(len) + ':' + profile.map(([a, b]) => qk(a) + ',' + qk(b)).join(';'), () => {
      const shape = new THREE.Shape(profile.map(([a, b]) => new THREE.Vector2(a, b)));
      return new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false }).translate(0, 0, -len / 2);
    });
    return this.add(mat, geo, o);
  }

  // --- Dächer
  // Satteldach über Rechteck sx × sz; First entlang 'x' oder 'z'; Überstand ov
  gableRoof(mat, x, y0, z, sx, sz, h, o = {}) {
    const ridge = o.ridge || (sx >= sz ? 'x' : 'z');
    const ov = o.overhang ?? 0.3 * M;
    const w = (ridge === 'x' ? sz : sx) + ov * 2, len = (ridge === 'x' ? sx : sz) + ov * 2;
    const t = o.thickness ?? 0.25 * M;
    const prof = [[-w / 2, 0], [w / 2, 0], [w / 2, t], [0, h + t], [-w / 2, t]];
    return this.prism(mat, prof, len, { x, y: y0, z, ry: ridge === 'x' ? Math.PI / 2 : 0 });
  }
  // Giebelwand (Dreieck) passend unter dem Satteldach
  gableEnds(mat, x, y0, z, sx, sz, h, o = {}) {
    const ridge = o.ridge || (sx >= sz ? 'x' : 'z');
    const w = ridge === 'x' ? sz : sx, len = ridge === 'x' ? sx : sz;
    const prof = [[-w / 2, 0], [w / 2, 0], [0, h]];
    return this.prism(mat, prof, len - 0.002, { x, y: y0, z, ry: ridge === 'x' ? Math.PI / 2 : 0 });
  }
  // Walmdach
  hipRoof(mat, x, y0, z, sx, sz, h, o = {}) {
    const ov = o.overhang ?? 0.3 * M;
    const a = sx / 2 + ov, b = sz / 2 + ov;
    const r = Math.min(a, b) * (o.ridgeK ?? 0.9);
    const ra = Math.max(0, a - r), rb = Math.max(0, b - r);
    const v = [
      [-a, 0, -b], [a, 0, -b], [a, 0, b], [-a, 0, b],
      [-ra, h, -rb], [ra, h, -rb], [ra, h, rb], [-ra, h, rb],
    ];
    const f = [[0, 4, 5], [0, 5, 1], [1, 5, 6], [1, 6, 2], [2, 6, 7], [2, 7, 3], [3, 7, 4], [3, 4, 0], [0, 1, 2], [0, 2, 3]];
    const pos = [];
    const c = new THREE.Vector3(0, h / 2, 0), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), n = new THREE.Vector3();
    for (const [i, j, k] of f) {
      A.fromArray(v[i]); B.fromArray(v[j]); C.fromArray(v[k]);
      n.subVectors(B, A).cross(C.clone().sub(A));
      const mid = A.clone().add(B).add(C).multiplyScalar(1 / 3).sub(c);
      if (n.dot(mid) < 0) pos.push(...v[i], ...v[k], ...v[j]); else pos.push(...v[i], ...v[j], ...v[k]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    return this.add(mat, geo, { x, y: y0, z });
  }
  // Pultdach (geneigt von vorne nach hinten)
  shedRoof(mat, x, y0, z, sx, sz, h, o = {}) {
    const prof = [[-sz / 2, 0], [sz / 2, 0], [sz / 2, 0.2 * M], [-sz / 2, h + 0.2 * M]];
    return this.prism(mat, prof, sx, { x, y: y0, z, ry: Math.PI / 2 });
  }
  // Flachdach mit Attika (Brüstung)
  flatRoof(matTop, matParapet, x, y0, z, sx, sz, o = {}) {
    const p = o.parapet ?? 0.6 * M, t = o.thick ?? 0.25 * M;
    this.box(matTop, x, y0, z, sx - t * 2, 0.08 * M, sz - t * 2);
    if (p > 0) {
      this.box(matParapet, x, y0, z - sz / 2 + t / 2, sx, p, t);
      this.box(matParapet, x, y0, z + sz / 2 - t / 2, sx, p, t);
      this.box(matParapet, x - sx / 2 + t / 2, y0, z, t, p, sz - t * 2);
      this.box(matParapet, x + sx / 2 - t / 2, y0, z, t, p, sz - t * 2);
      if (this.detail >= 2 && o.coping !== false) {
        // Abdeckblech auf der Attika (steht etwas über)
        const c = o.coping || 'metal_light', ct = t + 0.08 * M, ch = 0.06 * M;
        this.box(c, x, y0 + p, z - sz / 2 + t / 2, sx + 0.08 * M, ch, ct);
        this.box(c, x, y0 + p, z + sz / 2 - t / 2, sx + 0.08 * M, ch, ct);
        this.box(c, x - sx / 2 + t / 2, y0 + p, z, ct, ch, sz - t * 2);
        this.box(c, x + sx / 2 - t / 2, y0 + p, z, ct, ch, sz - t * 2);
      }
    }
  }
  // Sägezahndach (Industrie)
  sawtoothRoof(matRoof, matGlass, x, y0, z, sx, sz, teeth, h) {
    const d = sz / teeth;
    for (let k = 0; k < teeth; k++) {
      const zc = z - sz / 2 + d * (k + 0.5);
      this.prism(matRoof, [[-d / 2, 0], [d / 2, 0], [d / 2, h]], sx, { x, y: y0, z: zc, ry: Math.PI / 2 });
      this.box(matGlass, x, y0, zc + d / 2 - 0.05 * M, sx * 0.98, h * 0.92, 0.1 * M, { lit: this.rng() });
    }
  }

  // --- Fassaden
  // Fensterreihen auf einer Wand. side: 'front'(+z) | 'back'(-z) | 'left'(-x) | 'right'(+x) einer Box mit
  // Mittelpunkt (cx, cz), Größe sx × sz. floors, ab y0, Geschosshöhe fh.
  // o: {winW, winH, spacing, frame, glass, sill, frameT, skipGround, margin, shutters, style:'punch'|'band'|'grid'}
  windows(side, cx, cz, sx, sz, y0, floors, fh, o = {}) {
    const glass = o.glass || 'glass_window', frame = o.frame || 'window_frame_white';
    const winW = o.winW ?? 1.2 * M, winH = o.winH ?? 1.5 * M, spacing = o.spacing ?? 2.6 * M;
    const along = side === 'front' || side === 'back' ? sx : sz;
    const margin = o.margin ?? 0.8 * M;
    const n = Math.max(1, Math.floor((along - margin * 2 + spacing - winW) / spacing));
    const used = (n - 1) * spacing;
    const off = 0.03 * M;
    const startF = o.skipGround ? 1 : 0;
    if (this.detail === 0) {
      // Eine Fläche pro Fassade; das Material zeichnet n × Stockwerke Fenster aus den UVs
      const fl = floors - startF;
      if (fl <= 0) return;
      const wQuad = n * spacing, hQuad = fl * fh;
      const geo = new THREE.PlaneGeometry(wQuad, hQuad);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * n + (winW / spacing) * 0, uv.getY(i) * fl);
      let px, pz, ry;
      if (side === 'front') { px = cx; pz = cz + sz / 2 + off; ry = 0; }
      else if (side === 'back') { px = cx; pz = cz - sz / 2 - off; ry = Math.PI; }
      else if (side === 'right') { px = cx + sx / 2 + off; pz = cz; ry = Math.PI / 2; }
      else { px = cx - sx / 2 - off; pz = cz; ry = -Math.PI / 2; }
      this.add('lod_windows', geo, { x: px, y: y0 + startF * fh + hQuad / 2, z: pz, ry, uv: 'keep', lit: this.rng() });
      return;
    }
    for (let f = startF; f < floors; f++) {
      const yb = y0 + f * fh + (o.sillH ?? (fh - winH) * 0.55);
      for (let k = 0; k < n; k++) {
        const a = -used / 2 + k * spacing;
        let px, pz, ry;
        if (side === 'front') { px = cx + a; pz = cz + sz / 2 + off; ry = 0; }
        else if (side === 'back') { px = cx - a; pz = cz - sz / 2 - off; ry = Math.PI; }
        else if (side === 'right') { px = cx + sx / 2 + off; pz = cz - a; ry = Math.PI / 2; }
        else { px = cx - sx / 2 - off; pz = cz + a; ry = -Math.PI / 2; }
        this.window(px, yb, pz, ry, winW, winH, { glass, frame, sill: o.sill, shutters: o.shutters, lit: this.rng(), mullion: o.mullion });
      }
    }
  }
  // Einzelnes Fenster (Rahmen + Glas), Mittelpunkt unten bei (x, y0, z), Blickrichtung ry
  window(x, y0, z, ry, w, h, o = {}) {
    if (this.detail === 0) return;
    const t = 0.12 * M, d = 0.1 * M;
    const glass = o.glass || 'glass_window', frame = o.frame || 'window_frame_white';
    const dir = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
    const side = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
    const P = (a, b) => ({ x: x + side.x * a + dir.x * b, z: z + side.z * a + dir.z * b });
    // Rahmen als eine Platte hinter der Scheibe, Scheibe als nach außen zeigende Fläche
    let p = P(0, -0.02 * M);
    this.box(frame, p.x, y0 - t, p.z, w + t * 2, h + t * 2, d, { ry });
    p = P(0, d / 2 - 0.01 * M);
    const pane = new THREE.PlaneGeometry(w, h);
    this.add(glass, pane, { x: p.x, y: y0 + h / 2, z: p.z, ry, lit: o.lit ?? this.rng() });
    if (this.detail < 2) return;
    if (o.mullion !== false && w > 0.9 * M) { p = P(0, d / 2); this.box(frame, p.x, y0, p.z, t * 0.6, h, 0.04 * M, { ry }); }
    // Kämpfer (Querholz) bei hohen Fenstern
    if (o.mullion !== false && h > 1.35 * M) { p = P(0, d / 2); this.box(frame, p.x, y0 + h * 0.72, p.z, w, t * 0.6, 0.04 * M, { ry }); }
    if (o.sill) { p = P(0, 0.06 * M); this.box(o.sill === true ? 'trim_stone' : o.sill, p.x, y0 - t - 0.06 * M, p.z, w + t * 4, 0.08 * M, 0.25 * M, { ry }); }
    else if (o.sill !== false) { p = P(0, 0.05 * M); this.box(frame, p.x, y0 - t - 0.035 * M, p.z, w + t * 3, 0.035 * M, 0.18 * M, { ry }); } // schmale Blechbank
    if (o.shutters) {
      for (const s of [-1, 1]) { p = P(s * (w / 2 + t + 0.3 * M), 0.02 * M); this.box(o.shutters, p.x, y0, p.z, 0.55 * M, h, 0.05 * M, { ry }); }
    }
  }
  // Durchgehende Glasfassade (Vorhangfassade) auf einer Boxseite mit Sprossen
  curtainWall(side, cx, cz, sx, sz, y0, h, o = {}) {
    const glass = o.glass || 'glass_curtain_blue', frame = o.frame || 'metal_dark';
    if (this.detail === 0) {
      const along0 = side === 'front' || side === 'back' ? sx : sz;
      let px0 = cx, pz0 = cz, ry0 = 0;
      if (side === 'front') pz0 = cz + sz / 2 + 0.02 * M; else if (side === 'back') { pz0 = cz - sz / 2 - 0.02 * M; ry0 = Math.PI; }
      else if (side === 'right') { px0 = cx + sx / 2 + 0.02 * M; ry0 = Math.PI / 2; } else { px0 = cx - sx / 2 - 0.02 * M; ry0 = -Math.PI / 2; }
      this.add(glass, new THREE.PlaneGeometry(along0, h), { x: px0, y: y0 + h / 2, z: pz0, ry: ry0, lit: this.rng() });
      return;
    }
    const fh = o.fh ?? FLOOR, colW = o.colW ?? 1.5 * M;
    const along = side === 'front' || side === 'back' ? sx : sz;
    const off = 0.02 * M;
    let px = cx, pz = cz, ry = 0;
    if (side === 'front') { pz = cz + sz / 2 + off; ry = 0; }
    else if (side === 'back') { pz = cz - sz / 2 - off; ry = Math.PI; }
    else if (side === 'right') { px = cx + sx / 2 + off; ry = Math.PI / 2; }
    else { px = cx - sx / 2 - off; ry = -Math.PI / 2; }
    // Glas in Stockwerksstreifen (je Streifen eigener Lichtwert)
    const floors = Math.max(1, Math.round(h / fh));
    for (let f = 0; f < floors; f++) this.box(glass, px, y0 + f * fh, pz, along * 0.995, fh * 0.98, 0.04 * M, { ry, lit: this.rng() });
    const dir = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
    const sideV = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
    const cols = Math.max(1, Math.round(along / colW));
    for (let k = 0; k <= cols; k++) {
      const a = -along / 2 + (k * along) / cols;
      this.box(frame, px + sideV.x * a + dir.x * 0.04 * M, y0, pz + sideV.z * a + dir.z * 0.04 * M, 0.08 * M, h, 0.1 * M, { ry });
    }
    for (let f = 0; f <= floors; f++) this.box(frame, px + dir.x * 0.04 * M, y0 + f * fh - 0.05 * M, pz + dir.z * 0.04 * M, along, 0.1 * M, 0.12 * M, { ry });
  }
  // Tür mittig auf der Front einer Box
  door(cx, cz, sz, o = {}) {
    const w = o.w ?? 1.1 * M, h = o.h ?? 2.2 * M, x = cx + (o.offset || 0);
    const z = cz + sz / 2;
    this.box(o.mat || 'door_wood', x, 0, z + 0.02 * M, w, h, 0.06 * M);
    this.box(o.frame || 'trim_stone', x, h, z + 0.04 * M, w + 0.3 * M, 0.15 * M, 0.1 * M);
    if (o.step !== false) this.box('stone_grey', x, 0, z + 0.4 * M, w + 0.6 * M, 0.15 * M, 0.8 * M);
    if (o.canopy) this.box(o.canopy, x, h + 0.3 * M, z + 0.5 * M, w + 0.8 * M, 0.08 * M, 1.0 * M);
    if (this.detail >= 2) {
      // Türgriff, Füllung, Leuchte neben der Tür
      this.box('metal_light', x + w * 0.32, h * 0.45, z + 0.06 * M, 0.05 * M, 0.25 * M, 0.06 * M);
      this.box(o.frame || 'trim_stone', x, h * 0.55, z + 0.05 * M, w * 0.6, h * 0.3, 0.02 * M);
      if (!o.canopy) this.box('metal_dark', x - w / 2 - 0.35 * M, h * 0.78, z + 0.08 * M, 0.14 * M, 0.22 * M, 0.14 * M);
    }
  }
  // Waagrechtes Gesims/Band um eine Box
  band(mat, cx, cz, sx, sz, y, h = 0.2 * M, out = 0.08 * M) {
    this.box(mat, cx, y, cz, sx + out * 2, h, sz + out * 2);
  }
  // Balkone in Reihen auf einer Seite
  balconies(side, cx, cz, sx, sz, y0, floors, fh, o = {}) {
    if (this.detail === 0) return;
    const n = o.count ?? Math.max(1, Math.floor(sx / (3.5 * M)));
    const w = o.w ?? 2.4 * M, d = o.d ?? 1.2 * M;
    const slab = o.slab || 'concrete', rail = o.rail || 'metal_dark';
    for (let f = o.from ?? 1; f < floors; f++) {
      const y = y0 + f * fh;
      for (let k = 0; k < n; k++) {
        const a = -((n - 1) * (sx / n)) / 2 + k * (sx / n);
        if (side === 'front') {
          this.box(slab, cx + a, y, cz + sz / 2 + d / 2, w, 0.15 * M, d);
          this.box(rail, cx + a, y + 0.15 * M, cz + sz / 2 + d - 0.03 * M, w, 1.0 * M, 0.05 * M);
          this.box(rail, cx + a - w / 2 + 0.03 * M, y + 0.15 * M, cz + sz / 2 + d / 2, 0.05 * M, 1.0 * M, d);
          this.box(rail, cx + a + w / 2 - 0.03 * M, y + 0.15 * M, cz + sz / 2 + d / 2, 0.05 * M, 1.0 * M, d);
        } else if (side === 'back') {
          this.box(slab, cx - a, y, cz - sz / 2 - d / 2, w, 0.15 * M, d);
          this.box(rail, cx - a, y + 0.15 * M, cz - sz / 2 - d + 0.03 * M, w, 1.0 * M, 0.05 * M);
        }
      }
    }
  }
  // Dachaufbauten: Lüftung, Klima, Treppenhaus
  rooftopClutter(x, y0, z, sx, sz, n = 3) {
    if (this.detail === 0) return;
    for (let k = 0; k < n; k++) {
      const px = x + (this.rng() - 0.5) * sx * 0.6, pz = z + (this.rng() - 0.5) * sz * 0.6;
      const t = this.rng();
      if (t < 0.4) this.box('metal_light', px, y0, pz, 1.2 * M, 0.9 * M, 0.9 * M);
      else if (t < 0.7) this.cyl('metal_light', px, y0, pz, 0.35 * M, 0.8 * M, { seg: 10 });
      else this.box('concrete', px, y0, pz, 2.2 * M, 2.4 * M, 2.2 * M);
    }
  }
  chimney(x, y0, z, h = 1.2 * M, mat = 'chimney_brick') {
    this.box(mat, x, y0, z, 0.6 * M, h, 0.6 * M);
    this.box('concrete_dark', x, y0 + h, z, 0.75 * M, 0.1 * M, 0.75 * M);
  }
  // Baum (einfach, für Gärten und Plätze)
  tree(x, z, s = 1, o = {}) {
    this.cyl('bark', x, 0, z, 0.18 * M * s, 2.2 * M * s, { seg: 6 });
    const leaf = o.leaf || (this.rng() < 0.5 ? 'leaves_green' : 'leaves_dark');
    this.sphere(leaf, x, 3.4 * M * s, z, 1.6 * M * s, { seg: 7 });
    if (this.rng() < 0.6) this.sphere(leaf, x + 0.6 * M * s, 2.8 * M * s, z + 0.3 * M * s, 1.1 * M * s, { seg: 6 });
  }
  hedge(x, z, sx, sz, h = 0.9 * M) { this.box('hedge', x, 0, z, sx, h, sz); }
  fence(x, z, len, ry = 0, mat = 'wood_planks', h = 0.9 * M) { this.box(mat, x, 0, z, len, h, 0.06 * M, { ry }); }

  smoke(x, y, z, type = 'smoke', amount = 1) { this.emitters.push({ x, y, z, type, amount }); }
  light(x, y, z, color = 0xffd79a, size = 0.4) { this.lights.push({ x, y, z, color, size }); }

  // Fertig: pro Material eine zusammengeführte Geometrie
  build() {
    // Zonengebäude: vor dem Zusammenführen auf das Grundstück einpassen (fit.js, gesetzt von buildArch)
    if (this.fitCfg) { const cfg = this.fitCfg; this.fitCfg = null; this.fitInfo = fitLot(this, cfg); }
    const meshes = [];
    for (const [mat, list] of this.groups) {
      const geo = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (!geo) continue;
      geo.computeBoundingSphere();
      meshes.push({ material: mat, geometry: geo });
    }
    let tris = 0;
    for (const m of meshes) tris += m.geometry.attributes.position.count / 3;
    return { meshes, height: this.height, emitters: this.emitters, lights: this.lights, triangles: Math.round(tris), fit: this.fitInfo || null };
  }
}

// Hilfen für Varianten
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];
export const range = (rng, a, b) => a + (b - a) * rng();
