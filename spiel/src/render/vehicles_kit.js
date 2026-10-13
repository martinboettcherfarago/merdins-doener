// Baukasten für Fahrzeuge und bewegliche Objekte (Besitzer: G10 „Fahrzeuge & Leben").
//
// Modelle werden aus wenigen Grundformen zusammengesetzt (Kästen, Profil-Prismen, Zylinder, Drehkörper).
// Jede Ecke trägt eine Farbe (Vertex-Farbe) und eine Teil-Art (Attribut aPart). Das gemeinsame Material
// wertet die Teil-Art im Shader aus: Lack (mit Instanzfarbe), Glas, beleuchteter Innenraum, Scheinwerfer,
// Rücklichter, Blaulicht, Blinker, Leuchtschilder, drehende Rotoren … So kostet jedes Modell genau einen
// Draw Call, egal wie viele Teile es hat.
//
// Pro Instanz (Attribut aInst): x = Zufallswert 0..1, y = Schalter (Bits, siehe F), z = Palettenindex
// für die Zweitfarbe (Teil PAINT2), w = frei.
//
// Andere Agenten dürfen die Modelle mitbenutzen (z. B. parkende Autos):
//   import { vehicleGeometry, getVehicleMaterial } from './vehicles_models.js'
import * as THREE from 'three';
import { shared } from './materials.js';

// Teil-Arten
export const P = {
  PAINT: 0, PLASTIC: 1, GLASS: 2, CABIN: 3, HEAD: 4, TAIL: 5, BLUE: 6, AMBER: 7, SIGN: 8, CHROME: 9,
  RUBBER: 10, IND_L: 11, IND_R: 12, GLOSS: 13, LAMP: 14, RED: 15, STROBE: 16, ROTOR_Y: 17, ROTOR_X: 18,
  PAINT2: 19, STRIPE: 20,
};

// Schalter-Bits in aInst.y
export const F = { BEACON: 1, LIGHTS: 2, LEFT: 4, RIGHT: 8, BRAKE: 16, LEAD: 32, RAIL: 64, DARK: 128 };

// Gemeinsame Uniforms der Fahrzeug-Shader
export const VU = {
  uLights: { value: 0 },   // 0..1 – Scheinwerfer an (Nacht, Nebel, Regen)
  uEnv: { value: 0 },      // 1, wenn die Szene eine Umgebungskarte hat (Metall wirkt dann richtig)
  uPal: { value: [0xf3f1ea, 0xc9ccd0, 0x22406e, 0xb8302a, 0xe8b52c, 0x2f7a4f, 0xa9b0b6, 0x3a3f45].map((h) => new THREE.Color(h)) },
};

// Gemeinsame Farben der Modelle
export const VC = {
  DARK: 0x1b1d20, TRIM: 0x2a2d32, GREY: 0x7d838a, LGREY: 0xc9cdd1, WHITE: 0xf1f1ec, CREAM: 0xefe8d6,
  PLATE: 0xf3f3ec, GLASS: 0x1d2933, CABIN: 0x26394a, CHROME: 0xc7ccd1, RED: 0xc8241a, AMBER: 0xf2951c,
  HEAD: 0xe6eaee, BLUE: 0x2a58ff, SIGN: 0xffa31a, BLACK: 0x16171a, TIRE: 0x1a1b1d, RIM: 0xb4b9bf,
};

const _c = new THREE.Color();
export function lin(hex) { _c.setHex(hex); return [_c.r, _c.g, _c.b]; }

const _v = new THREE.Vector3(), _n = new THREE.Vector3();
const _nm = new THREE.Matrix3();

// ---------------------------------------------------------------- Geometrie-Baukasten
export class VKit {
  constructor(detail = 2) {
    this.detail = detail;
    this.pos = []; this.nor = []; this.col = []; this.part = []; this.piv = [];
    this.pivot = [0, 0, 0];
    this.hasPivot = false;
    this.stack = [];
    this.m = null;
  }

  // --- Transformationen für Baugruppen
  push(o = {}) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ'));
    const s = o.s ?? 1;
    m.compose(new THREE.Vector3(o.x || 0, o.y || 0, o.z || 0), q, new THREE.Vector3(o.sx ?? s, o.sy ?? s, o.sz ?? s));
    this.stack.push(this.m);
    this.m = this.m ? this.m.clone().multiply(m) : m;
    return this;
  }
  pop() { this.m = this.stack.pop() || null; return this; }
  group(o, fn) { this.push(o); fn(this); this.pop(); return this; }
  setPivot(x, y, z) { this.pivot = [x, y, z]; this.hasPivot = true; }
  clearPivot() { this.pivot = [0, 0, 0]; }

  // --- Dreieck mit Wicklung = Außenseite
  tri(a, b, c, color, part) {
    let A = a, B = b, C = c;
    if (this.m) {
      A = _v.set(a[0], a[1], a[2]).applyMatrix4(this.m).toArray();
      B = _v.set(b[0], b[1], b[2]).applyMatrix4(this.m).toArray();
      C = _v.set(c[0], c[1], c[2]).applyMatrix4(this.m).toArray();
    }
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
    const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-14) return;
    nx /= l; ny /= l; nz /= l;
    const col = typeof color === 'number' ? lin(color) : color;
    const pv = this.pivot;
    for (const p of [A, B, C]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(nx, ny, nz);
      this.col.push(col[0], col[1], col[2]);
      this.part.push(part);
      this.piv.push(pv[0], pv[1], pv[2]);
    }
  }

  // Dreieck so ausrichten, dass die Normale zu „out" zeigt
  triOut(a, b, c, color, part, out) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * out[0] + ny * out[1] + nz * out[2] < 0) this.tri(a, c, b, color, part);
    else this.tri(a, b, c, color, part);
  }

  quad(a, b, c, d, color, part, out) {
    if (out) { this.triOut(a, b, c, color, part, out); this.triOut(a, c, d, color, part, out); }
    else { this.tri(a, b, c, color, part); this.tri(a, c, d, color, part); }
  }

  // Ebenes Polygon (auch nicht-konvex). out = gewünschte Außenrichtung (sonst Wicklung)
  poly(pts, color, part, out) {
    const n = pts.length;
    if (n < 3) return;
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    const o = out || [nx, ny, nz];
    if (n === 3) { this.triOut(pts[0], pts[1], pts[2], color, part, o); return; }
    // in die Hauptebene projizieren
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    const proj = ax >= ay && ax >= az ? (p) => new THREE.Vector2(p[1], p[2]) : ay >= az ? (p) => new THREE.Vector2(p[0], p[2]) : (p) => new THREE.Vector2(p[0], p[1]);
    let faces;
    if (n === 4 && this._convex(pts.map(proj))) faces = [[0, 1, 2], [0, 2, 3]];
    else faces = THREE.ShapeUtils.triangulateShape(pts.map(proj), []);
    for (const [i, j, k] of faces) this.triOut(pts[i], pts[j], pts[k], color, part, o);
  }
  _convex(p2) {
    let sign = 0;
    for (let i = 0; i < p2.length; i++) {
      const a = p2[i], b = p2[(i + 1) % p2.length], c = p2[(i + 2) % p2.length];
      const cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      if (Math.abs(cr) < 1e-12) continue;
      if (!sign) sign = Math.sign(cr); else if (Math.sign(cr) !== sign) return false;
    }
    return true;
  }

  // Achsparalleler Kasten. f: { top, bottom, front(+z), back(-z), left(+x), right(-x) } → false | {c, p}
  // Der Boden fehlt standardmäßig (Fahrzeuge sieht man von oben).
  box(x0, y0, z0, x1, y1, z1, color, part, f = {}) {
    const fc = (k, def) => {
      const v = f[k];
      if (v === false) return null;
      if (v === undefined) return def ? { c: color, p: part } : null;
      return { c: v.c ?? color, p: v.p ?? part };
    };
    let t;
    if ((t = fc('top', true))) this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], t.c, t.p, [0, 1, 0]);
    if ((t = fc('bottom', false))) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], t.c, t.p, [0, -1, 0]);
    if ((t = fc('front', true))) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], t.c, t.p, [0, 0, 1]);
    if ((t = fc('back', true))) this.quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], t.c, t.p, [0, 0, -1]);
    if ((t = fc('left', true))) this.quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], t.c, t.p, [1, 0, 0]);
    if ((t = fc('right', true))) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], t.c, t.p, [-1, 0, 0]);
  }
  // Kasten über Mittelpunkt/Größe (y0 = Unterkante)
  cbox(cx, y0, cz, sx, sy, sz, color, part, f) {
    this.box(cx - sx / 2, y0, cz - sz / 2, cx + sx / 2, y0 + sy, cz + sz / 2, color, part, f);
  }

  // Seitenprofil (Punkte [z, y]) entlang x extrudiert, mit Verjüngung nach oben (hwB unten, hwT oben).
  // edge(i, nz, ny) → undefined (Standard) | false (weglassen) | {c, p}. side → {c, p} | false.
  prism(profile, hwB, hwT, color, part, o = {}) {
    let pts = profile.slice();
    // Orientierung gegen den Uhrzeigersinn (z nach rechts, y nach oben)
    let area = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
    const rev = area < 0;
    if (rev) pts = pts.reverse();
    let ymin = Infinity, ymax = -Infinity;
    for (const p of pts) { ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]); }
    const yb = o.yb ?? ymin, yt = o.yt ?? ymax;
    const hw = (y) => hwB + (hwT - hwB) * Math.max(0, Math.min(1, (y - yb) / Math.max(1e-6, yt - yb)));
    this._lastHw = hw;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const dz = b[0] - a[0], dy = b[1] - a[1];
      const l = Math.hypot(dz, dy);
      if (l < 1e-9) continue;
      const onz = dy / l, ony = -dz / l; // Außennormale im Profil
      const idx = rev ? (2 * n - 2 - i) % n : i;
      let st = o.edge ? o.edge(idx, onz, ony, a, b) : undefined;
      if (st === false) continue;
      if (!st) st = { c: color, p: part };
      const ha = hw(a[1]), hb = hw(b[1]);
      this.quad([-ha, a[1], a[0]], [ha, a[1], a[0]], [hb, b[1], b[0]], [-hb, b[1], b[0]], st.c ?? color, st.p ?? part, [0, ony, onz]);
    }
    const side = o.side === undefined ? { c: color, p: part } : o.side;
    if (side) {
      for (const s of [1, -1]) {
        if (o.only && o.only !== s) continue;
        this.poly(pts.map((p) => [s * hw(p[1]), p[1], p[0]]), side.c ?? color, side.p ?? part, [s, 0, 0]);
      }
    }
    return hw;
  }

  // Fläche auf der (verjüngten) Seitenwand eines Prismas: Profilpunkte [z, y], s = ±1
  sidePoly(hw, pts, s, color, part, lift = 0.0012) {
    this.poly(pts.map((p) => [s * (hw(p[1]) + lift), p[1], p[0]]), color, part, [s, 0, 0]);
  }

  // Zylinder entlang einer Achse. axis 'x' | 'y' | 'z'. Mittelpunkt c=[x,y,z], Radius r (oder [ra, rb] konisch), Länge len
  cyl(axis, c, r, len, seg, color, part, o = {}) {
    const ra = Array.isArray(r) ? r[0] : r, rb = Array.isArray(r) ? r[1] : r;
    const ry = o.ry ?? 1; // Stauchung quer
    const P3 = (t, ang, rr) => {
      const u = Math.cos(ang) * rr, v = Math.sin(ang) * rr * ry;
      if (axis === 'x') return [c[0] + t, c[1] + v, c[2] + u];
      if (axis === 'y') return [c[0] + u, c[1] + t, c[2] + v];
      return [c[0] + u, c[1] + v, c[2] + t];
    };
    const ax = axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1];
    const h = len / 2;
    const a0 = o.a0 ?? 0, a1 = o.a1 ?? Math.PI * 2;
    const full = Math.abs(a1 - a0 - Math.PI * 2) < 1e-6;
    for (let i = 0; i < seg; i++) {
      const t0 = a0 + ((a1 - a0) * i) / seg, t1 = a0 + ((a1 - a0) * (i + 1)) / seg;
      const tm = (t0 + t1) / 2;
      const outp = P3(0, tm, 1); const out = [outp[0] - c[0], outp[1] - c[1], outp[2] - c[2]];
      if (o.side !== false) this.quad(P3(-h, t0, ra), P3(-h, t1, ra), P3(h, t1, rb), P3(h, t0, rb), color, part, out);
    }
    const cap = (t, rr, sign, st) => {
      if (!st) return;
      const pts = [];
      for (let i = 0; i < seg; i++) pts.push(P3(t, a0 + ((a1 - a0) * i) / seg, rr));
      if (!full) { pts.push(P3(t, a1, rr)); pts.push(P3(t, 0, 0)); }
      this.poly(pts, st.c ?? color, st.p ?? part, [ax[0] * sign, ax[1] * sign, ax[2] * sign]);
    };
    cap(h, rb, 1, o.capB === undefined ? { c: color, p: part } : o.capB);
    cap(-h, ra, -1, o.capA === undefined ? { c: color, p: part } : o.capA);
  }

  // Rad: Reifen + Felge. s = ±1 (Außenseite), x = Mitte der Lauffläche
  wheel(x, y, z, r, w, s, seg, o = {}) {
    const tire = o.tire ?? 0x1d1f22, rim = o.rim ?? 0xb9bec4;
    this.cyl('x', [x, y, z], r, w, seg, tire, P.RUBBER, { capA: s < 0 ? { c: tire } : false, capB: s > 0 ? { c: tire } : false });
    if (this.detail >= 2 && o.rimR !== 0) {
      const rr = r * (o.rimR ?? 0.6);
      const xo = x + s * (w / 2 + 0.0008);
      const pts = [];
      for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI * 2; pts.push([xo, y + Math.sin(a) * rr, z + Math.cos(a) * rr]); }
      this.poly(pts, rim, P.CHROME, [s, 0, 0]);
    }
  }

  // Drehkörper entlang z: Ringe [z, rx, ry, yc]. Kappen vorne/hinten optional.
  lathe(rings, seg, color, part, o = {}) {
    const ringPts = rings.map(([z, rx, ry, yc]) => {
      const pts = [];
      for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI * 2 + (o.rot || 0); pts.push([Math.cos(a) * rx, yc + Math.sin(a) * ry, z]); }
      return pts;
    });
    for (let k = 0; k < rings.length - 1; k++) {
      const A = ringPts[k], B = ringPts[k + 1];
      const zc = (rings[k][0] + rings[k + 1][0]) / 2;
      for (let i = 0; i < seg; i++) {
        const j = (i + 1) % seg;
        const a = (((i + 0.5) / seg) * Math.PI * 2) + (o.rot || 0);
        const out = [Math.cos(a), Math.sin(a), 0];
        let st = o.band ? o.band(k, i, a) : undefined;
        if (st === false) continue;
        st = st || {};
        void zc;
        this.quad(A[i], A[j], B[j], B[i], st.c ?? color, st.p ?? part, out);
      }
    }
    if (o.capA) this.poly(ringPts[0].slice(), o.capA.c ?? color, o.capA.p ?? part, [0, 0, -1]);
    if (o.capB) this.poly(ringPts[ringPts.length - 1].slice(), o.capB.c ?? color, o.capB.p ?? part, [0, 0, 1]);
  }

  // Drehkörper um y: Ringe [y, r]
  latheY(rings, seg, color, part, o = {}) {
    for (let k = 0; k < rings.length - 1; k++) {
      const [ya, ra] = rings[k], [yb, rb] = rings[k + 1];
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2, am = (a0 + a1) / 2;
        let st = o.band ? o.band(k, i) : undefined;
        if (st === false) continue;
        st = st || {};
        const out = [Math.cos(am), (ra - rb) * 0.5, Math.sin(am)];
        const pa0 = [Math.cos(a0) * ra, ya, Math.sin(a0) * ra], pa1 = [Math.cos(a1) * ra, ya, Math.sin(a1) * ra];
        const pb0 = [Math.cos(a0) * rb, yb, Math.sin(a0) * rb], pb1 = [Math.cos(a1) * rb, yb, Math.sin(a1) * rb];
        if (rb < 1e-6) this.triOut(pa0, pa1, pb0, st.c ?? color, st.p ?? part, out);
        else if (ra < 1e-6) this.triOut(pa0, pb1, pb0, st.c ?? color, st.p ?? part, out);
        else this.quad(pa0, pa1, pb1, pb0, st.c ?? color, st.p ?? part, out);
      }
    }
  }

  // Rumpf: Umriss oben (Punkte [x, z]) auf Höhe yTop, unten skaliert (sx, sz) auf Höhe yBot
  hull(outline, yTop, yBot, sx, sz, color, part, o = {}) {
    const n = outline.length;
    const top = outline.map(([x, z]) => [x, yTop, z]);
    const bot = outline.map(([x, z]) => [x * sx, yBot, z * sz + (o.dz || 0)]);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const mx = (outline[i][0] + outline[j][0]) / 2, mz = (outline[i][1] + outline[j][1]) / 2;
      let st = o.edge ? o.edge(i) : undefined;
      if (st === false) continue;
      st = st || {};
      this.quad(top[i], top[j], bot[j], bot[i], st.c ?? color, st.p ?? part, [mx, -0.2, mz]);
    }
    if (o.deck !== false) this.poly(top, o.deck?.c ?? color, o.deck?.p ?? part, [0, 1, 0]);
  }


  // Rechteck auf der Ebene x = s·x (Außenseite s)
  rectX(s, x, y0, y1, z0, z1, color, part) {
    const X = s * x;
    this.quad([X, y0, z0], [X, y0, z1], [X, y1, z1], [X, y1, z0], color, part, [s, 0, 0]);
  }
  // Rechteck auf der Ebene z (Außenseite s = ±1)
  rectZ(s, z, x0, x1, y0, y1, color, part) {
    this.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], color, part, [0, 0, s]);
  }
  // Rechteck waagerecht (nach oben)
  rectY(y, x0, x1, z0, z1, color, part, down = false) {
    this.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], color, part, [0, down ? -1 : 1, 0]);
  }

  // Querschnitt (Punkte [x, y], von vorne gesehen) entlang z extrudiert.
  // edge(i, nx, ny) → undefined | false | {c, p}; capF/capB → {c, p} | false
  extrudeZ(sec, z0, z1, color, part, o = {}) {
    let pts = sec.slice();
    let area = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
    const rev = area < 0;
    if (rev) pts = pts.reverse();
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
      if (l < 1e-9) continue;
      const nx = dy / l, ny = -dx / l;
      const idx = rev ? (2 * n - 2 - i) % n : i;
      let st = o.edge ? o.edge(idx, nx, ny, a, b) : undefined;
      if (st === false) continue;
      st = st || {};
      this.quad([a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1], st.c ?? color, st.p ?? part, [nx, ny, 0]);
    }
    const capF = o.capF === undefined ? { c: color, p: part } : o.capF;
    const capB = o.capB === undefined ? { c: color, p: part } : o.capB;
    if (capF) this.poly(pts.map(([x, y]) => [x, y, z1]), capF.c ?? color, capF.p ?? part, [0, 0, 1]);
    if (capB) this.poly(pts.map(([x, y]) => [x, y, z0]), capB.c ?? color, capB.p ?? part, [0, 0, -1]);
  }

  // Verbindet zwei Querschnitte gleicher Punktzahl (z. B. Bug, Zugspitze)
  loftZ(secA, zA, secB, zB, color, part, o = {}) {
    const n = secA.length;
    const sgn = zB > zA ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a0 = [secA[i][0], secA[i][1], zA], a1 = [secA[j][0], secA[j][1], zA];
      const b0 = [secB[i][0], secB[i][1], zB], b1 = [secB[j][0], secB[j][1], zB];
      const mx = (secA[i][0] + secA[j][0] + secB[i][0] + secB[j][0]) / 4, my = (secA[i][1] + secA[j][1] + secB[i][1] + secB[j][1]) / 4;
      const cy = o.cy ?? 0;
      let st = o.edge ? o.edge(i) : undefined;
      if (st === false) continue;
      st = st || {};
      this.quad(a0, a1, b1, b0, st.c ?? color, st.p ?? part, [mx, my - cy, sgn * 0.3]);
    }
    if (o.cap !== false) this.poly(secB.map(([x, y]) => [x, y, zB]), o.cap?.c ?? color, o.cap?.p ?? part, [0, 0, sgn]);
  }

  get triangles() { return this.pos.length / 9; }

  build() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geo.setAttribute('aPart', new THREE.Float32BufferAttribute(this.part, 1));
    if (this.hasPivot) geo.setAttribute('aPiv', new THREE.Float32BufferAttribute(this.piv, 3));
    geo.computeBoundingSphere();
    geo.userData.triangles = this.triangles;
    return geo;
  }
}

// Konvexes Polygon (Profilpunkte [z, y]) gleichmäßig nach innen versetzen
export function insetPoly(pts, m) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const s = area > 0 ? 1 : -1;
  const n = pts.length;
  const lines = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const dz = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dz, dy) || 1;
    // Innennormale (links bei CCW)
    const nz = (-dy / l) * s, ny = (dz / l) * s;
    lines.push([a[0] + nz * m, a[1] + ny * m, dz, dy]);
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const L1 = lines[(i + n - 1) % n], L2 = lines[i];
    const den = L1[2] * L2[3] - L1[3] * L2[2];
    if (Math.abs(den) < 1e-12) { out.push([L2[0], L2[1]]); continue; }
    const t = ((L2[0] - L1[0]) * L2[3] - (L2[1] - L1[1]) * L2[2]) / den;
    out.push([L1[0] + L1[2] * t, L1[1] + L1[3] * t]);
  }
  return out;
}

// ---------------------------------------------------------------- Material
let _mat = null;
export function getVehicleMaterial() {
  if (_mat) return _mat;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.1 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.uTime;
    sh.uniforms.uNight = shared.uNight;
    sh.uniforms.uLights = VU.uLights;
    sh.uniforms.uEnv = VU.uEnv;
    sh.uniforms.uPal = VU.uPal;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aPart;
attribute vec4 aInst;
attribute vec3 aPiv;
uniform float uTime;
uniform vec3 uPal[8];
varying float vPart;
varying vec4 vInst;
varying vec3 vLocal;`)
      .replace('#include <color_vertex>', `
vColor = vec3(1.0);
vColor *= color;
#ifdef USE_INSTANCING_COLOR
  if (aPart < 0.5) vColor *= instanceColor.xyz;
#endif
if (aPart > 18.5 && aPart < 19.5) vColor *= uPal[int(clamp(aInst.z, 0.0, 7.0))];
vPart = aPart;
vInst = aInst;
vLocal = position;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
if (aPart > 16.5 && aPart < 18.5) {
  float ang = uTime * (aPart < 17.5 ? 17.0 : 31.0) + aInst.x * 6.2831;
  float cs = cos(ang), sn = sin(ang);
  vec3 q = transformed - aPiv;
  if (aPart < 17.5) q = vec3(q.x * cs - q.z * sn, q.y, q.x * sn + q.z * cs);
  else q = vec3(q.x, q.y * cs - q.z * sn, q.y * sn + q.z * cs);
  transformed = q + aPiv;
}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uTime;
uniform float uNight;
uniform float uLights;
uniform float uEnv;
varying float vPart;
varying vec4 vInst;
varying vec3 vLocal;
float vhash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
int part = int(vPart + 0.5);
int flags = int(vInst.y + 0.5);
float vseed = vInst.x;
if (part == 0 || part == 13 || part == 19) { roughnessFactor = 0.3; metalnessFactor = mix(0.04, 0.4, uEnv); }
else if (part == 2 || part == 3) { roughnessFactor = 0.06; metalnessFactor = mix(0.1, 0.7, uEnv); }
else if (part == 9) { roughnessFactor = 0.25; metalnessFactor = mix(0.12, 0.95, uEnv); }
else if (part == 10) { roughnessFactor = 0.92; metalnessFactor = 0.0; }
else if (part == 1 || part == 20 || part == 17 || part == 18) { roughnessFactor = 0.75; metalnessFactor = 0.02; }
else { roughnessFactor = 0.35; metalnessFactor = 0.0; }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  vec3 em = vec3(0.0);
  bool rail = (flags & 64) != 0;
  bool lead = (flags & 32) != 0;
  bool dark = (flags & 128) != 0;
  bool isFront = lead && vLocal.z > 0.0;
  float lightsOn = dark ? 0.0 : max(uLights, (flags & 2) != 0 ? 1.0 : 0.0);
  if (part == 4) {
    float on = rail ? (isFront ? max(0.35, lightsOn) : 0.0) : lightsOn;
    diffuseColor.rgb = mix(vec3(0.75, 0.78, 0.8), vec3(1.0, 0.97, 0.9), on);
    em = vec3(1.0, 0.9, 0.72) * on * 1.3;
  } else if (part == 5) {
    float on = rail ? (isFront ? 0.0 : max(0.3, lightsOn)) : lightsOn;
    float brake = (flags & 16) != 0 ? 1.0 : 0.0;
    em = vec3(1.0, 0.05, 0.02) * (on * 0.8 + brake * uNight * 0.9);
  } else if (part == 6) {
    if ((flags & 1) != 0) {
      float ph = uTime * 9.0 + vseed * 6.2831 + (vLocal.x > 0.0 ? 3.14159 : 0.0) + vLocal.z * 8.0;
      float f = pow(max(0.0, sin(ph)), 5.0);
      em = vec3(0.12, 0.32, 1.0) * f * (0.15 + uNight * 1.2);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.5, 0.65, 1.0), f);
    }
  } else if (part == 7) {
    if ((flags & 1) != 0) {
      float f = pow(max(0.0, sin(uTime * 6.0 + vseed * 6.2831 + atan(vLocal.z, vLocal.x) * 1.0)), 4.0);
      em = vec3(1.0, 0.55, 0.05) * f * (0.12 + uNight * 1.0);
    }
  } else if (part == 8) {
    em = diffuseColor.rgb * (0.08 + uNight * 0.6);
  } else if (part == 11 || part == 12) {
    bool on = part == 11 ? (flags & 4) != 0 : (flags & 8) != 0;
    if (on) {
      float f = step(0.5, fract(uTime * 1.5 + vseed));
      em = vec3(1.0, 0.5, 0.04) * f * (0.1 + uNight * 0.8);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.7, 0.2), f);
    }
  } else if (part == 3) {
    float h = vhash(floor(vLocal.xz * vec2(3.0, 11.0)) + vseed * 13.0);
    float lit = dark ? 0.0 : uNight * (0.55 + 0.45 * h);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.85, 0.65), lit * 0.7);
    em = vec3(1.0, 0.84, 0.58) * lit * 1.15;
  } else if (part == 14) {
    em = diffuseColor.rgb * (dark ? 0.0 : uNight) * 2.2;
  } else if (part == 15) {
    em = vec3(1.0, 0.06, 0.04) * pow(max(0.0, sin(uTime * 3.4 + vseed * 6.2831)), 14.0) * (0.2 + uNight * 1.5);
  } else if (part == 16) {
    em = vec3(1.0) * step(0.92, fract(uTime * 1.05 + vseed)) * (0.2 + uNight * 1.8);
  } else if (part == 20) {
    em = diffuseColor.rgb * (0.12 + uNight * 0.55);
  }
  // Spiegelung des Himmels auf Glas (Ersatz, solange keine Umgebungskarte da ist)
  if (part == 2 || part == 3) {
    float fres = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.2);
    vec3 sky = mix(vec3(0.36, 0.46, 0.56), vec3(0.78, 0.85, 0.9), fres);
    em += sky * (0.07 + 0.45 * fres) * (1.0 - uNight * 0.85) * (1.0 - uEnv * 0.75);
  }
  totalEmissiveRadiance += em;
}`);
  };
  mat.customProgramCacheKey = () => 'vehParts1';
  _mat = mat;
  return mat;
}

// ---------------------------------------------------------------- Instanz-Stapel
const MAXCAP = 1 << 15;
// Ein InstancedMesh, das jedes Bild neu befüllt wird (wächst bei Bedarf).
export class Batch {
  constructor(parent, geometry, material, o = {}) {
    this.parent = parent;
    this.geo = geometry;
    this.mat = material;
    this.shadow = o.shadow ?? true;
    this.receive = o.receive ?? true;
    this.renderOrder = o.renderOrder || 0;
    this.triangles = geometry.userData.triangles || (geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3);
    this.n = 0;
    this.mesh = null;
    this.alloc(o.cap || 16);
  }
  alloc(cap, keep = 0) {
    const old = this.mesh;
    const inst = new Float32Array(cap * 4);
    const mtx = new Float32Array(cap * 16);
    const col = new Float32Array(cap * 3);
    if (old && keep) {
      inst.set(this.inst.subarray(0, keep * 4));
      mtx.set(this.mtx.subarray(0, keep * 16));
      col.set(this.col.subarray(0, keep * 3));
    }
    this.geo.setAttribute('aInst', new THREE.InstancedBufferAttribute(inst, 4).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.InstancedMesh(this.geo, this.mat, cap);
    m.instanceMatrix = new THREE.InstancedBufferAttribute(mtx, 16).setUsage(THREE.DynamicDrawUsage);
    m.instanceColor = new THREE.InstancedBufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.castShadow = this.shadow;
    m.receiveShadow = this.receive;
    m.renderOrder = this.renderOrder;
    m.count = 0;
    m.visible = false;
    if (old) { this.parent.remove(old); old.dispose(); this.geo.dispose(); }
    this.parent.add(m);
    this.mesh = m;
    this.cap = cap;
    this.inst = inst; this.mtx = mtx; this.col = col;
  }
  begin() { this.n = 0; }
  // Stellung: Position, Gierwinkel (Front +z → Fahrtrichtung), Neigung (Euler-X in Reihenfolge YXZ, negativ = Nase hoch), Rollen, Skalierung
  push(x, y, z, yaw, pitch, roll, sx, sy, sz, r, g, b, seed, flags, pal = 0, w = 0) {
    if (this.n >= this.cap) {
      if (this.cap >= MAXCAP) return -1;
      this.alloc(this.cap * 2, this.n);
    }
    const i = this.n++;
    const cy = Math.cos(yaw), syw = Math.sin(yaw);
    const p = pitch, cp = Math.cos(p), sp = Math.sin(p);
    // Ry * Rx
    let a0x = cy, a0y = 0, a0z = -syw;
    let a1x = syw * sp, a1y = cp, a1z = cy * sp;
    const a2x = syw * cp, a2y = -sp, a2z = cy * cp;
    if (roll) {
      const cr = Math.cos(roll), sr = Math.sin(roll);
      const b0x = a0x * cr + a1x * sr, b0y = a0y * cr + a1y * sr, b0z = a0z * cr + a1z * sr;
      const b1x = -a0x * sr + a1x * cr, b1y = -a0y * sr + a1y * cr, b1z = -a0z * sr + a1z * cr;
      a0x = b0x; a0y = b0y; a0z = b0z; a1x = b1x; a1y = b1y; a1z = b1z;
    }
    const m = this.mtx, o = i * 16;
    m[o] = a0x * sx; m[o + 1] = a0y * sx; m[o + 2] = a0z * sx; m[o + 3] = 0;
    m[o + 4] = a1x * sy; m[o + 5] = a1y * sy; m[o + 6] = a1z * sy; m[o + 7] = 0;
    m[o + 8] = a2x * sz; m[o + 9] = a2y * sz; m[o + 10] = a2z * sz; m[o + 11] = 0;
    m[o + 12] = x; m[o + 13] = y; m[o + 14] = z; m[o + 15] = 1;
    const c = this.col, k = i * 3;
    c[k] = r; c[k + 1] = g; c[k + 2] = b;
    const a = this.inst, q = i * 4;
    a[q] = seed; a[q + 1] = flags; a[q + 2] = pal; a[q + 3] = w;
    return i;
  }
  finish() {
    const m = this.mesh;
    m.count = this.n;
    m.visible = this.n > 0;
    if (this.n > 0) {
      m.instanceMatrix.needsUpdate = true;
      m.instanceColor.needsUpdate = true;
      this.geo.attributes.aInst.needsUpdate = true;
    }
  }
  dispose() {
    this.parent.remove(this.mesh);
    this.mesh.dispose();
    this.geo.dispose();
  }
}

// ---------------------------------------------------------------- Leuchtpunkte (Glanz um Lichter, für Bloom)
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let _glowTex = null;

export class GlowPoints {
  constructor(parent, max = 6000) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;
    _glowTex ||= glowTexture();
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: _glowTex }, uScale: { value: 600 } },
      vertexShader: `
attribute float aSize;
attribute vec4 aColor;
varying vec4 vColor;
uniform float uScale;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = min(96.0, aSize * uScale / max(0.1, -mv.z));
  // leicht zur Kamera ziehen, damit der Schein nicht im eigenen Fahrzeug verschwindet
  mv.xyz *= 1.0 - min(0.02, 0.03 / max(1.0, -mv.z));
  gl_Position = projectionMatrix * mv;
}`,
      fragmentShader: `
uniform sampler2D uTex;
varying vec4 vColor;
void main() {
  vec4 t = texture2D(uTex, gl_PointCoord);
  float a = vColor.a * t.a;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor.rgb, a);
}`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 8;
    parent.add(this.points);
    this.n = 0;
  }
  begin() { this.n = 0; }
  add(x, y, z, size, r, g, b, a) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = a;
    this.size[i] = size;
  }
  end(renderer) {
    if (renderer) this.mat.uniforms.uScale.value = renderer.domElement.height * 0.9;
    this.geo.setDrawRange(0, this.n);
    this.points.visible = this.n > 0;
    if (this.n) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.aColor.needsUpdate = true;
      this.geo.attributes.aSize.needsUpdate = true;
    }
  }
  dispose(parent) { parent.remove(this.points); this.geo.dispose(); this.mat.dispose(); }
}

// Hilfen
export function hashf(n) {
  let t = (n | 0) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
