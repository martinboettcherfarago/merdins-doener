// Menschen, Fahrräder und Vögel (Besitzer: G10, Körper und Bewegung: DETAIL). Instanziert, Skelett im Vertex-Shader.
// Maßstab 1 = 10 m (Erwachsener ≈ 0,175). Ursprung = zwischen den Füßen am Boden, Blick nach +z, linke Seite = +x.
//
// Jede Figur ist ein starrer Gliederkörper (Becken, Rumpf, Kopf, Ober-/Unterschenkel, Füße, Ober-/Unterarme mit
// Händen). Der Shader rechnet die Gelenkkette pro Vertex aus wenigen Instanzwerten (Schrittphase, Gangstärke, Haltung)
// – keine Skelett-Objekte, kein Mesh pro Person. Kleidung und Zubehör (Rock, Mantel, Haare, Mütze, Rucksack, Tasche,
// Stock, Helm …) stecken alle in derselben Geometrie und werden pro Instanz über Merkmal-Bits ein- oder ausgeblendet
// (ausgeblendete Teile fallen auf einen Punkt zusammen) – ein Draw Call für alle Fußgänger einer Detailstufe.
//
// aPart = Knochen · 8 + Farbfeld.
//   Farbfeld: 0 Oberteil (Instanzfarbe), 1 Hose/Rock (Palette), 2 Haut, 3 Haare, 4 Schuhe, 5 feste Farbe,
//             6 Tasche/Rad (Palette), 7 Mütze/Schal/Helm (Palette)
// aFeat: 0 = immer; +n = nur mit Merkmal-Bit n−1; −n = nur ohne Merkmal-Bit n−1.
// aInst: x = Phase (rad; Schritt bzw. Tretkurbel), y = Gangstärke (0 Stehen … 1 Gehen … 2 Joggen; Vögel: Flügelschlag),
//        z = Zufall (Paletten), w = Haltung + 8 · Merkmale (Menschen) bzw. Vogel-Haltung.
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { VKit, hashf } from './vehicles_kit.js';

// ---------------------------------------------------------------- Knochen, Haltungen, Merkmale
export const B = {
  ROOT: 0, PELVIS: 1, SPINE: 2, HEAD: 3, THIGH_L: 4, THIGH_R: 5, SHIN_L: 6, SHIN_R: 7, FOOT_L: 8, FOOT_R: 9,
  UARM_L: 10, UARM_R: 11, FARM_L: 12, FARM_R: 13, WING_L: 14, WING_R: 15, CRANK: 16, WHEEL_F: 17, WHEEL_R: 18, STATIC: 19,
  BIRD_HEAD: 20,
};
export const MODE = { WALK: 0, CYCLE: 1, SIT: 2, BIRD_FLY: 4, BIRD_GROUND: 5 };
export const FEAT = {
  SKIRT: 1, LONGHAIR: 2, HAT: 4, BACKPACK: 8, BAG: 16, COAT: 32, SHORTSLEEVE: 64, SHORTS: 128,
  CHILD: 256, ELDER: 512, CANE: 1024, UMBRELLA: 2048, BALD: 4096, HELMET: 8192, PONY: 16384, SCARF: 32768,
};
const FBIT = (f) => Math.round(Math.log2(f)) + 1; // Merkmal → aFeat-Kennung

// Ruhehaltung (Modellraum) – identisch im Shader (PEOPLE_GLSL)
const HIP_Y = 0.09, KNEE_Y = 0.048, ANK_Y = 0.008, HIP_X = 0.0088;
const WAIST_Y = 0.104, NECK_Y = 0.146, SH_Y = 0.141, SH_X = 0.0215, EL_Y = 0.111, WR_Y = 0.086;

const PANTS = [0x2c3e5c, 0x3a3f45, 0x5b5f66, 0x22303f, 0x6b5a45, 0x1f2124, 0x7a8a99, 0x4a3b5c];
const SKIN = [0xf1c9a5, 0xe3b48f, 0xc98e66, 0xa4704c, 0x7a4f34, 0xf4d2b8];
const HAIR = [0x2a1d14, 0x4a3020, 0x6e4a2a, 0xb08a4a, 0x8f8f8f, 0x1c1c1c, 0xd8c08a, 0x7a2a1a];
const GREY = [0xc9c9c6, 0xa9a9a6, 0xdedcd6, 0x8f8f8c];
const BAG = [0x2a2d31, 0x8a3c2e, 0x2f6db3, 0x4a3b2c, 0x2f7a4f, 0xe8b52c, 0xb8302a, 0xd9dcdf];
const ACC = [0xb8302a, 0x1f3b63, 0xe8b52c, 0x2f7a4f, 0xd9dcdf, 0x2a2d31, 0x8f5ad8, 0xc9672e];

// ---------------------------------------------------------------- Baukasten mit Merkmalen und weichen Normalen
class PKit extends VKit {
  constructor(d) { super(d); this.feat = []; this.cf = 0; }
  _pad() { const n = this.pos.length / 3; while (this.feat.length < n) this.feat.push(this.cf); }
  tri(a, b, c, color, part) { super.tri(a, b, c, color, part); this._pad(); }
  on(f, fn) { const o = this.cf; this.cf = f; fn(); this.cf = o; }
  // ein Vertex mit eigener Normale (für runde Körperteile)
  v(p, n, col, part) {
    this.pos.push(p[0], p[1], p[2]); this.nor.push(n[0], n[1], n[2]);
    this.col.push(col[0], col[1], col[2]); this.part.push(part); this.piv.push(0, 0, 0); this.feat.push(this.cf);
  }
  // Ellipsoid (Mitte c, Halbachsen r) – segU Teilungen um y, segV von unten nach oben. o.v0/o.v1 schneiden (0..1)
  ell(c, r, segU, segV, color, part, o = {}) {
    const col = lin(color);
    const v0 = o.v0 ?? 0, v1 = o.v1 ?? 1, sq = o.sq ?? 1;
    const P = (u, v) => {
      const th = (u / segU) * Math.PI * 2 + (o.rot || 0), ph = Math.PI * (v0 + (v1 - v0) * (v / segV)) - Math.PI / 2;
      const cy = Math.cos(ph), sy = Math.sin(ph);
      const x = Math.cos(th) * cy, z = Math.sin(th) * cy, y = sy;
      return [[c[0] + x * r[0], c[1] + y * r[1] * (y < 0 ? sq : 1), c[2] + z * r[2]], norm([x / r[0], y / r[1], z / r[2]])];
    };
    for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) {
      const a = P(i, j), b = P(i + 1, j), cc = P(i + 1, j + 1), d = P(i, j + 1);
      this.v(a[0], a[1], col, part); this.v(cc[0], cc[1], col, part); this.v(b[0], b[1], col, part);
      this.v(a[0], a[1], col, part); this.v(d[0], d[1], col, part); this.v(cc[0], cc[1], col, part);
    }
  }
  // Röhre entlang y mit elliptischem Querschnitt: rings [x, y, z, rx, rz]; Kappen oben/unten optional
  tube(rings, seg, color, part, o = {}) {
    const col = lin(color);
    const ring = (R, k) => {
      const out = [];
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2 + (o.rot || 0);
        const ca = Math.cos(a), sa = Math.sin(a);
        const prev = rings[Math.max(0, k - 1)], next = rings[Math.min(rings.length - 1, k + 1)];
        const dy = next[1] - prev[1] || 1e-6, dr = ((next[3] + next[4]) - (prev[3] + prev[4])) / 2;
        const rm = (R[3] + R[4]) / 2;
        out.push([[R[0] + ca * R[3], R[1], R[2] + sa * R[4]], norm([ca * rm / R[3], -dr / dy, sa * rm / R[4]])]);
      }
      return out;
    };
    const rs = rings.map((R, k) => ring(R, k));
    for (let k = 0; k < rings.length - 1; k++) {
      const A = rs[k], Bq = rs[k + 1];
      const up = rings[k + 1][1] > rings[k][1];
      for (let i = 0; i < seg; i++) {
        if (up) { this.v(A[i][0], A[i][1], col, part); this.v(Bq[i][0], Bq[i][1], col, part); this.v(A[i + 1][0], A[i + 1][1], col, part); this.v(A[i + 1][0], A[i + 1][1], col, part); this.v(Bq[i][0], Bq[i][1], col, part); this.v(Bq[i + 1][0], Bq[i + 1][1], col, part); }
        else { this.v(A[i][0], A[i][1], col, part); this.v(A[i + 1][0], A[i + 1][1], col, part); this.v(Bq[i][0], Bq[i][1], col, part); this.v(A[i + 1][0], A[i + 1][1], col, part); this.v(Bq[i + 1][0], Bq[i + 1][1], col, part); this.v(Bq[i][0], Bq[i][1], col, part); }
      }
    }
    const cap = (k, dir, cc) => {
      const R = rings[k], A = rs[k];
      const cen = [R[0], R[1], R[2]], n = [0, dir, 0];
      const c2 = cc ? lin(cc) : col;
      for (let i = 0; i < seg; i++) {
        if (dir > 0) { this.v(cen, n, c2, part); this.v(A[i + 1][0], n, c2, part); this.v(A[i][0], n, c2, part); }
        else { this.v(cen, n, c2, part); this.v(A[i][0], n, c2, part); this.v(A[i + 1][0], n, c2, part); }
      }
    };
    const top = rings[rings.length - 1][1] > rings[0][1] ? rings.length - 1 : 0, bot = top ? 0 : rings.length - 1;
    if (o.capTop) cap(top, 1, o.capTop === true ? null : o.capTop);
    if (o.capBot) cap(bot, -1, o.capBot === true ? null : o.capBot);
  }
  build() {
    this._pad();
    const geo = super.build();
    geo.setAttribute('aFeat', new THREE.Float32BufferAttribute(this.feat, 1));
    if (!geo.attributes.aPiv) geo.setAttribute('aPiv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
    return geo;
  }
}
const _lc = new THREE.Color();
function lin(c) { if (Array.isArray(c)) return c; _lc.setHex(c); return [_lc.r, _lc.g, _lc.b]; }
function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
const L = (bone, slot) => bone * 8 + slot;
// Riemen: Band entlang einer Punktfolge, nach außen (vom Körpermittelpunkt weg) zeigend
function strap(k, pts, w, color, part) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const out = norm([(a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2]);
    // Querrichtung = Richtung × außen
    let cx = dy * out[2] - dz * out[1], cy = dz * out[0] - dx * out[2], cz = dx * out[1] - dy * out[0];
    const l = Math.hypot(cx, cy, cz) || 1; cx *= w / 2 / l; cy *= w / 2 / l; cz *= w / 2 / l;
    k.quad([a[0] - cx, a[1] - cy, a[2] - cz], [a[0] + cx, a[1] + cy, a[2] + cz], [b[0] + cx, b[1] + cy, b[2] + cz], [b[0] - cx, b[1] - cy, b[2] - cz], color, part, out);
  }
}

// ---------------------------------------------------------------- Mensch, volle Figur (Nahstufe)
// Alle Varianten in einer Geometrie; Merkmale entscheiden im Shader, was sichtbar ist.
function humanNear(k) {
  const W = 0xffffff;
  const seg = 7;
  const on = (f, fn) => k.on(FBIT(f), fn), off = (f, fn) => k.on(-FBIT(f), fn);
  for (const s of [1, -1]) {
    const th = s > 0 ? B.THIGH_L : B.THIGH_R, sh = s > 0 ? B.SHIN_L : B.SHIN_R, ft = s > 0 ? B.FOOT_L : B.FOOT_R;
    const x = s * HIP_X;
    // Oberschenkel (Hose) – unter Rock/Mantel trotzdem vorhanden (Bewegung sichtbar)
    k.tube([[x, HIP_Y + 0.004, 0, 0.0074, 0.0084], [x, 0.07, 0.0004, 0.0066, 0.0072], [x, KNEE_Y + 0.002, 0.0006, 0.0052, 0.0055]], seg, W, L(th, 1));
    // Knie und Unterschenkel
    k.ell([x, KNEE_Y, 0.0006], [0.0053, 0.0054, 0.0056], 6, 2, W, L(sh, 1));
    k.tube([[x, KNEE_Y, 0.0004, 0.0052, 0.0054], [x, 0.03, -0.0006, 0.0050, 0.0054], [x, ANK_Y + 0.003, -0.0004, 0.0034, 0.0036]], seg, W, L(sh, 1), { capBot: true });
    // Schuh (Profil [z, y] seitlich extrudiert), Sohle dunkler
    k.group({ x }, () => k.prism([[-0.0058, 0], [0.0148, 0], [0.0158, 0.0026], [0.0128, 0.0056], [0.0042, 0.0074], [-0.0038, 0.0086], [-0.0064, 0.005]], 0.0047, 0.0043, 0x2b2a2c, L(ft, 4), { edge: (i) => (i === 0 ? { c: 0x161616 } : undefined) }));
  }
  // Becken/Hüfte (Hose)
  k.tube([[0, 0.081, -0.0003, 0.0142, 0.0098], [0, 0.092, -0.0006, 0.0156, 0.0106], [0, WAIST_Y, -0.0004, 0.0136, 0.0094]], 9, W, L(B.PELVIS, 1), { capBot: true });
  // Gürtel
  k.tube([[0, WAIST_Y - 0.0018, -0.0004, 0.0137, 0.0097], [0, WAIST_Y + 0.0006, -0.0004, 0.0137, 0.0097]], 9, 0x2a2420, L(B.PELVIS, 5));
  // Rock / Kleid
  on(FEAT.SKIRT, () => k.tube([[0, WAIST_Y + 0.001, -0.0004, 0.0140, 0.0102], [0, 0.085, 0.0006, 0.0168, 0.0138], [0, 0.062, 0.0014, 0.0194, 0.0166]], 9, W, L(B.PELVIS, 1), { capBot: 0x2a2a2a }));
  // Mantelschöße (Oberteilfarbe)
  on(FEAT.COAT, () => k.tube([[0, WAIST_Y + 0.004, -0.0004, 0.0144, 0.0106], [0, 0.082, 0.0004, 0.0166, 0.0138], [0, 0.066, 0.0012, 0.0178, 0.0162]], 9, W, L(B.PELVIS, 0), { capBot: 0x3a3a3a }));
  // Rumpf (Oberteil): Taille → Brust → Schultern
  k.tube([[0, WAIST_Y - 0.001, -0.0004, 0.0133, 0.0094], [0, 0.118, 0.0006, 0.0146, 0.0104], [0, 0.131, 0.0012, 0.0162, 0.0112], [0, 0.141, 0.0004, 0.0172, 0.0102], [0, 0.1465, -0.0002, 0.0110, 0.0075]], 9, W, L(B.SPINE, 0), { capTop: true });
  // Kragen / Schal
  off(FEAT.SCARF, () => k.tube([[0, 0.1455, 0, 0.0064, 0.0058], [0, 0.149, 0, 0.0057, 0.0053]], 7, W, L(B.SPINE, 0)));
  on(FEAT.SCARF, () => k.tube([[0, 0.1425, 0, 0.0098, 0.0084], [0, 0.1505, 0.0002, 0.0078, 0.0068]], 8, W, L(B.SPINE, 7), { capTop: true }));
  // Hals
  k.tube([[0, 0.144, -0.0006, 0.0041, 0.0041], [0, 0.153, -0.0006, 0.0038, 0.0039]], 6, W, L(B.HEAD, 2));
  // Kopf (leicht eiförmig, Kinn nach vorn) und Ohren
  k.ell([0, 0.1632, 0.0006], [0.0094, 0.0115, 0.0103], 8, 5, W, L(B.HEAD, 2), { sq: 0.86 });
  k.ell([0, 0.1603, 0.0105], [0.0013, 0.0017, 0.0015], 4, 2, W, L(B.HEAD, 2)); // Nase
  for (const s of [1, -1]) k.ell([s * 0.0093, 0.162, -0.0004], [0.0014, 0.0026, 0.0018], 4, 2, W, L(B.HEAD, 2));
  // Haare: Kappe (nicht bei Glatze), lang, Zopf
  off(FEAT.BALD, () => k.ell([0, 0.1652, -0.0006], [0.0101, 0.0115, 0.0108], 8, 3, W, L(B.HEAD, 3), { v0: 0.46, v1: 1, rot: 0.2 }));
  off(FEAT.BALD, () => k.ell([0, 0.1615, -0.0038], [0.0098, 0.0080, 0.0076], 8, 2, W, L(B.HEAD, 3), { v0: 0.35, v1: 0.75 }));
  on(FEAT.BALD, () => k.ell([0, 0.1615, -0.003], [0.0099, 0.0058, 0.008], 8, 2, W, L(B.HEAD, 3), { v0: 0.3, v1: 0.7 }));
  on(FEAT.LONGHAIR, () => k.tube([[0, 0.167, -0.0046, 0.0104, 0.0069], [0, 0.152, -0.0064, 0.0102, 0.0061], [0, 0.137, -0.0072, 0.009, 0.0046]], 8, W, L(B.HEAD, 3), { capBot: true, rot: 0 }));
  on(FEAT.PONY, () => k.ell([0, 0.1585, -0.0128], [0.0034, 0.0076, 0.0032], 5, 3, W, L(B.HEAD, 3)));
  // Mütze / Helm
  on(FEAT.HAT, () => { k.ell([0, 0.1675, -0.0006], [0.0106, 0.0104, 0.0112], 8, 2, W, L(B.HEAD, 7), { v0: 0.5, v1: 1 }); k.ell([0, 0.1782, -0.0008], [0.0028, 0.0026, 0.0028], 5, 2, W, L(B.HEAD, 7)); });
  on(FEAT.HELMET, () => k.ell([0, 0.168, -0.0008], [0.0113, 0.0108, 0.0123], 8, 2, W, L(B.HEAD, 7), { v0: 0.5, v1: 1 }));
  // Arme: Schulter, Oberarm (Ärmel), Ellbogen, Unterarm (Ärmel oder Haut), Hand
  for (const s of [1, -1]) {
    const ua = s > 0 ? B.UARM_L : B.UARM_R, fa = s > 0 ? B.FARM_L : B.FARM_R;
    const x = s * SH_X;
    k.ell([x, SH_Y, 0], [0.0055, 0.0054, 0.0058], 7, 2, W, L(ua, 0), { v0: 0.45, v1: 1 });
    k.tube([[x, SH_Y, 0, 0.0054, 0.0057], [x, 0.125, 0, 0.0048, 0.005], [x, EL_Y + 0.001, 0, 0.0041, 0.0042]], 7, W, L(ua, 0));
    k.ell([x, EL_Y, 0], [0.0041, 0.0041, 0.0042], 6, 2, W, L(fa, 0));
    off(FEAT.SHORTSLEEVE, () => k.tube([[x, EL_Y, 0, 0.0041, 0.0042], [x, 0.096, 0.0003, 0.0038, 0.0039], [x, WR_Y + 0.001, 0.0005, 0.0033, 0.0034]], 7, W, L(fa, 0)));
    on(FEAT.SHORTSLEEVE, () => k.tube([[x, EL_Y, 0, 0.0037, 0.0038], [x, 0.096, 0.0003, 0.0033, 0.0034], [x, WR_Y + 0.001, 0.0005, 0.0029, 0.003]], 7, W, L(fa, 2)));
    k.ell([x - s * 0.0003, WR_Y - 0.004, 0.0008], [0.0028, 0.0052, 0.0035], 5, 3, W, L(fa, 2));
  }
  // Kurzarm: Oberarm unten Haut; Shorts: Unterschenkel Haut – über Farbfeld-Regeln im Shader
  // Rucksack, Umhängetasche, Gehstock
  on(FEAT.BACKPACK, () => {
    k.box(-0.0105, 0.108, -0.0188, 0.0105, 0.1395, -0.0092, W, L(B.SPINE, 6));
    k.box(-0.0094, 0.109, -0.0203, 0.0094, 0.1235, -0.0188, W, L(B.SPINE, 6));
    for (const s of [1, -1]) strap(k, [[s * 0.0076, 0.1468, -0.0066], [s * 0.0082, 0.1468, 0.0044], [s * 0.0084, 0.137, 0.0122], [s * 0.0082, 0.12, 0.0118]], 0.0026, 0x2a2a2a, L(B.SPINE, 5));
  });
  on(FEAT.BAG, () => {
    k.box(0.0146, 0.087, -0.0072, 0.0188, 0.104, 0.0072, W, L(B.PELVIS, 6), { bottom: true });
    strap(k, [[-0.0114, 0.1468, -0.002], [-0.0108, 0.1415, 0.0115], [-0.002, 0.1285, 0.0132], [0.0082, 0.115, 0.0119], [0.0152, 0.104, 0.0086]], 0.0024, 0x2a2a2a, L(B.SPINE, 5));
  });
  on(FEAT.CANE, () => k.tube([[-SH_X, WR_Y - 0.006, 0.006, 0.0011, 0.0011], [-SH_X, 0.002, 0.012, 0.0011, 0.0011]], 4, 0x4a3424, L(B.FARM_R, 5), { capBot: true }));
}

// ---------------------------------------------------------------- Mensch, vereinfacht (mittlere Entfernung)
function humanMid(k) {
  const W = 0xffffff;
  const bx = (x0, y0, z0, x1, y1, z1, bone, slot, c = W) => k.box(x0, y0, z0, x1, y1, z1, c, L(bone, slot));
  const on = (f, fn) => k.on(FBIT(f), fn);
  for (const s of [1, -1]) {
    const x = s * HIP_X;
    const th = s > 0 ? B.THIGH_L : B.THIGH_R, sh = s > 0 ? B.SHIN_L : B.SHIN_R;
    k.group({ x }, () => k.prism([[-0.0068, KNEE_Y], [0.0072, KNEE_Y], [0.0084, HIP_Y + 0.004], [-0.0078, HIP_Y + 0.004]], 0.0053, 0.0076, W, L(th, 1), { yb: KNEE_Y, yt: HIP_Y }));
    bx(x - 0.0048, ANK_Y, -0.0052, x + 0.0048, KNEE_Y + 0.002, 0.0056, sh, 1);
    bx(x - 0.0042, 0, -0.006, x + 0.0042, ANK_Y + 0.001, 0.0152, s > 0 ? B.FOOT_L : B.FOOT_R, 4, 0x262628);
    const ua = s > 0 ? B.UARM_L : B.UARM_R, fa = s > 0 ? B.FARM_L : B.FARM_R;
    const ax = s * SH_X;
    bx(ax - 0.005, EL_Y, -0.0052, ax + 0.005, SH_Y + 0.0045, 0.0052, ua, 0);
    bx(ax - 0.0041, WR_Y, -0.0042, ax + 0.0041, EL_Y + 0.002, 0.0042, fa, 0);
    bx(ax - 0.003, WR_Y - 0.009, -0.0028, ax + 0.003, WR_Y, 0.0038, fa, 2);
  }
  k.prism([[-0.0102, 0.082], [0.0098, 0.082], [0.0098, WAIST_Y], [-0.0102, WAIST_Y]], 0.0142, 0.0134, W, L(B.PELVIS, 1));
  on(FEAT.SKIRT, () => k.prism([[-0.0105, WAIST_Y], [0.0105, WAIST_Y], [0.0152, 0.062], [-0.0152, 0.062]], 0.0192, 0.0140, W, L(B.PELVIS, 1)));
  on(FEAT.COAT, () => k.prism([[-0.0108, WAIST_Y], [0.0108, WAIST_Y], [0.0135, 0.066], [-0.0135, 0.066]], 0.0175, 0.0144, W, L(B.PELVIS, 0)));
  k.prism([[-0.0096, WAIST_Y - 0.001], [0.0104, WAIST_Y - 0.001], [0.0112, 0.136], [0.0096, 0.1465], [-0.0094, 0.1465], [-0.0104, 0.136]], 0.0133, 0.0168, W, L(B.SPINE, 0), { yb: WAIST_Y, yt: 0.141 });
  bx(-0.0039, 0.145, -0.0041, 0.0039, 0.153, 0.0039, B.HEAD, 2);
  bx(-0.0091, 0.152, -0.0098, 0.0091, 0.1742, 0.0106, B.HEAD, 2);
  k.on(-FBIT(FEAT.BALD), () => { bx(-0.0098, 0.1665, -0.0106, 0.0098, 0.1765, 0.0094, B.HEAD, 3); bx(-0.0098, 0.1555, -0.0108, 0.0098, 0.1665, -0.0058, B.HEAD, 3); });
  on(FEAT.LONGHAIR, () => bx(-0.0102, 0.138, -0.0112, 0.0102, 0.167, -0.0046, B.HEAD, 3));
  on(FEAT.PONY, () => bx(-0.003, 0.151, -0.016, 0.003, 0.166, -0.0098, B.HEAD, 3));
  on(FEAT.HAT, () => bx(-0.0104, 0.1675, -0.0108, 0.0104, 0.1785, 0.0104, B.HEAD, 7));
  on(FEAT.HELMET, () => bx(-0.0111, 0.1675, -0.0122, 0.0111, 0.1785, 0.0116, B.HEAD, 7));
  on(FEAT.SCARF, () => bx(-0.0088, 0.142, -0.0078, 0.0088, 0.1505, 0.0082, B.SPINE, 7));
  on(FEAT.BACKPACK, () => bx(-0.0104, 0.108, -0.0188, 0.0104, 0.139, -0.0092, B.SPINE, 6));
  on(FEAT.BAG, () => bx(0.0146, 0.087, -0.007, 0.0186, 0.104, 0.007, B.PELVIS, 6));
  on(FEAT.CANE, () => bx(-SH_X - 0.0011, 0.002, 0.008, -SH_X + 0.0011, WR_Y - 0.006, 0.0102, B.FARM_R, 5, 0x4a3424));
}
// ---------------------------------------------------------------- Fahrrad (ohne Fahrer; der fährt als Mensch mit Haltung „Rad")
// Tretlager (Kurbelmitte) bei y 0,03 / z 0, Sattel oben bei y 0,095 / z −0,016, Lenker bei y 0,103 / z 0,04.
export const BIKE = { bbY: 0.03, bbZ: 0, crank: 0.017, saddleY: 0.095, saddleZ: -0.017, barY: 0.104, barZ: 0.041 };
function bicycle(k, d) {
  const wr = 0.034, wb = 0.106;
  const seg = d >= 2 ? 14 : 8;
  const fz = wb / 2 - 0.004, rz = -wb / 2 - 0.004;
  for (const [z, bone] of [[fz, B.WHEEL_F], [rz, B.WHEEL_R]]) {
    // Reifen: Lauffläche + Flanken als Ringe (durchsichtiges Rad), Felge, Speichen, Nabe
    k.cyl('x', [0, wr, z], wr, 0.0048, seg, 0x1a1b1d, L(bone, 5), { capA: false, capB: false });
    for (const sx of [1, -1]) {
      annulus(k, sx * 0.0024, wr, z, wr * 0.86, wr, seg, 0x1a1b1d, L(bone, 5), sx);
      if (d >= 2) annulus(k, sx * 0.0022, wr, z, wr * 0.8, wr * 0.86, seg, 0xb9bec4, L(bone, 5), sx);
    }
    if (d >= 2) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI;
        const cy = Math.cos(a) * wr * 0.8, sz = Math.sin(a) * wr * 0.8;
        for (const sx of [1, -1]) k.quad([sx * 0.0015, wr - cy, z - sz], [sx * 0.0015, wr + cy, z + sz], [sx * 0.0015, wr + cy + 0.0007, z + sz], [sx * 0.0015, wr - cy + 0.0007, z - sz], 0xc9ced4, L(bone, 5), [sx, 0, 0]);
      }
      k.cyl('x', [0, wr, z], 0.0032, 0.007, 6, 0x9aa0a6, L(bone, 5));
    }
  }
  // Rahmen (Rohre als schmale Kästen zwischen Punkten [y, z])
  const tubeYZ = (a, b, w = 0.0034) => {
    const dy = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dy, dz), ang = Math.atan2(dz, dy);
    k.group({ x: 0, y: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, rx: ang }, () => k.box(-w / 2, -len / 2, -w / 2, w / 2, len / 2, w / 2, 0xffffff, L(B.STATIC, 0)));
  };
  const BB = [BIKE.bbY, BIKE.bbZ], seatTop = [0.083, -0.012], head = [0.083, 0.036], headLow = [0.064, 0.04];
  tubeYZ(BB, seatTop); tubeYZ(seatTop, head, 0.0032); tubeYZ(BB, headLow, 0.0038);
  tubeYZ([wr, rz], seatTop, 0.0026); tubeYZ([wr, rz], BB, 0.0026);
  tubeYZ(headLow, [wr, fz], 0.0028); tubeYZ(head, headLow, 0.0042);
  // Sattelstütze, Sattel, Vorbau, Lenker, Griffe
  tubeYZ(seatTop, [BIKE.saddleY - 0.004, BIKE.saddleZ - 0.001], 0.0022);
  k.prism([[BIKE.saddleZ - 0.009, BIKE.saddleY - 0.004], [BIKE.saddleZ + 0.011, BIKE.saddleY - 0.003], [BIKE.saddleZ + 0.011, BIKE.saddleY - 0.0005], [BIKE.saddleZ - 0.009, BIKE.saddleY + 0.0005]], 0.0062, 0.0062, 0x1f1f22, L(B.STATIC, 5));
  tubeYZ(head, [BIKE.barY - 0.002, BIKE.barZ - 0.004], 0.0026);
  k.box(-0.023, BIKE.barY - 0.0018, BIKE.barZ - 0.0045, 0.023, BIKE.barY + 0.0012, BIKE.barZ - 0.0018, 0x2a2d31, L(B.STATIC, 5));
  for (const s of [1, -1]) k.box(Math.min(s * 0.019, s * 0.0245), BIKE.barY - 0.0022, BIKE.barZ - 0.0048, Math.max(s * 0.019, s * 0.0245), BIKE.barY + 0.0016, BIKE.barZ - 0.0014, 0x1a1a1a, L(B.STATIC, 5));
  if (d >= 2) {
    // Schutzbleche, Gepäckträger, Lampe
    k.cyl('x', [0, wr, fz], wr + 0.004, 0.0062, 8, 0xffffff, L(B.STATIC, 0), { a0: Math.PI * 0.35, a1: Math.PI * 0.95, capA: false, capB: false });
    k.cyl('x', [0, wr, rz], wr + 0.004, 0.0062, 8, 0xffffff, L(B.STATIC, 0), { a0: Math.PI * 0.05, a1: Math.PI * 0.62, capA: false, capB: false });
    k.box(-0.0055, wr + 0.012, rz - 0.006, 0.0055, wr + 0.0145, rz + 0.026, 0x2a2d31, L(B.STATIC, 5));
    k.box(-0.0025, 0.077, fz - 0.005, 0.0025, 0.083, fz + 0.0005, 0xd9dcdf, L(B.STATIC, 5));
  }
  // Kurbel mit Pedalen (dreht sich): Kettenblatt, Arme, Pedale
  k.cyl('x', [0.0045, BIKE.bbY, BIKE.bbZ], d >= 2 ? 0.0085 : 0.007, 0.0016, d >= 2 ? 10 : 6, 0x9aa0a6, L(B.CRANK, 5));
  for (const s of [1, -1]) {
    const x = s * 0.0068, py = BIKE.bbY - s * BIKE.crank;
    k.box(x - 0.0012, Math.min(BIKE.bbY, py) - 0.0012, BIKE.bbZ - 0.0014, x + 0.0012, Math.max(BIKE.bbY, py) + 0.0012, BIKE.bbZ + 0.0014, 0x8a9096, L(B.CRANK, 5));
    k.box(s * 0.0072 + (s > 0 ? 0 : -0.0078), py - 0.0012, BIKE.bbZ - 0.0035, s * 0.0072 + (s > 0 ? 0.0078 : 0), py + 0.0012, BIKE.bbZ + 0.0035, 0x2a2a2a, L(B.CRANK, 5));
  }
  if (d >= 2) k.box(-0.0006, BIKE.bbY - 0.0016, rz, 0.0006, BIKE.bbY + 0.0016, BIKE.bbZ, 0x3a3a3a, L(B.STATIC, 5)); // Kette
}

// Kreisring in der y-z-Ebene bei x (Rad-Flanke), Normale ±x
function annulus(k, x, y, z, r0, r1, seg, color, part, sx) {
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const P = (a, r) => [x, y + Math.cos(a) * r, z + Math.sin(a) * r];
    k.quad(P(a0, r0), P(a1, r0), P(a1, r1), P(a0, r1), color, part, [sx, 0, 0]);
  }
}

// ---------------------------------------------------------------- Vogel (Flügelschlag im Shader)
function bird(k) {
  k.lathe([[0.022, 0.0, 0.0, 0.0], [0.012, 0.005, 0.005, 0.0], [-0.008, 0.006, 0.005, 0.0], [-0.024, 0.0, 0.0, 0.002]], 5, 0xffffff, L(B.STATIC, 0));
  for (const [s, bone] of [[1, B.WING_L], [-1, B.WING_R]]) {
    const pts = [[0.0, 0.0, 0.012], [s * 0.03, 0.0, 0.0], [s * 0.032, 0.0, -0.012], [0.0, 0.0, -0.008]];
    k.poly(pts, 0xffffff, L(bone, 0), [0, 1, 0]);
    k.poly(pts, 0xd0d0d0, L(bone, 0), [0, -1, 0]);
  }
  k.tri([0, 0.0, -0.02], [0.008, 0.0, -0.032], [-0.008, 0.0, -0.032], 0xffffff, L(B.STATIC, 0));
  k.tri([0, 0.0, -0.02], [-0.008, 0.0, -0.032], [0.008, 0.0, -0.032], 0xffffff, L(B.STATIC, 0));
}

// Taube am Boden (pickt; Kopf nickt im Shader). Ursprung = Boden unter den Füßen, Blick +z.
function pigeon(k) {
  const g = 0x8d9199, dark = 0x5c616b;
  k.ell([0, 0.0115, -0.001], [0.0058, 0.0058, 0.0105], 7, 4, g, L(B.STATIC, 5), { sq: 0.8 });
  k.ell([0, 0.0118, -0.0112], [0.0032, 0.0016, 0.0062], 5, 2, dark, L(B.STATIC, 5)); // Schwanz
  for (const s of [1, -1]) k.ell([s * 0.0046, 0.0128, -0.002], [0.0018, 0.0042, 0.0085], 5, 2, 0x9aa0aa, L(B.STATIC, 5)); // Flügel
  k.ell([0, 0.0182, 0.0058], [0.0036, 0.0045, 0.0036], 6, 3, 0x6f7f86, L(B.BIRD_HEAD, 5)); // Hals (schillernd)
  k.ell([0, 0.0222, 0.0074], [0.0029, 0.003, 0.0033], 6, 3, g, L(B.BIRD_HEAD, 5));
  k.cyl('z', [0, 0.0216, 0.0112], [0.0009, 0.0004], 0.003, 4, 0x2a2a2a, L(B.BIRD_HEAD, 5));
  for (const s of [1, -1]) k.box(s * 0.0022 - 0.0006, 0, -0.0005, s * 0.0022 + 0.0006, 0.0065, 0.0007, 0xc0655a, L(B.STATIC, 5));
}

// Regenschirm (am Rumpf befestigt, Griff in der rechten Hand – Arm im Shader in Haltepose)
function umbrella(k, d) {
  const hand = umbrellaHand();
  const x = hand[0], z = hand[2] + 0.004, y0 = hand[1] - 0.004;
  const top = 0.205, R = 0.072;
  const seg = d >= 2 ? 10 : 7;
  // Bespannung (außen Farbe, innen etwas dunkler), Spitze, Stock, Griff
  const ring = [];
  for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI * 2; ring.push([x + Math.cos(a) * R, top - 0.018, z + Math.sin(a) * R]); }
  const apex = [x, top + 0.004, z];
  for (let i = 0; i < seg; i++) {
    const a = ring[i], b = ring[(i + 1) % seg];
    const m = [(a[0] + b[0]) / 2, top - 0.009, (a[2] + b[2]) / 2];
    k.triOut(apex, a, m, 0xffffff, L(B.SPINE, 0), [m[0] - x, 0.6, m[2] - z]);
    k.triOut(apex, m, b, 0xffffff, L(B.SPINE, 0), [m[0] - x, 0.6, m[2] - z]);
    k.triOut(apex, a, m, 0x9a9a9a, L(B.SPINE, 0), [x - m[0], -0.6, z - m[2]]);
    k.triOut(apex, m, b, 0x9a9a9a, L(B.SPINE, 0), [x - m[0], -0.6, z - m[2]]);
  }
  k.box(x - 0.0009, y0, z - 0.0009, x + 0.0009, top + 0.009, z + 0.0009, 0x2a2d31, L(B.SPINE, 5));
  k.box(x - 0.0014, y0 - 0.006, z - 0.0014, x + 0.0014, y0, z + 0.0034, 0x4a3424, L(B.SPINE, 5));
}

// Handposition in der Schirm-Haltepose (Rumpf-Raum) – spiegelt den Shader (Schulter beugen 0,55, abspreizen 0,14,
// Ellbogen 1,72)
function umbrellaHand() {
  const v = new THREE.Vector3(-SH_X, WR_Y - 0.004, 0.001);
  const el = new THREE.Vector3(-SH_X, EL_Y, 0), sh = new THREE.Vector3(-SH_X, SH_Y, 0);
  const rx = (a) => new THREE.Matrix4().makeRotationX(a), rz = (a) => new THREE.Matrix4().makeRotationZ(a);
  v.sub(el).applyMatrix4(rx(-UMB_POSE.el)).add(el);
  v.sub(sh).applyMatrix4(new THREE.Matrix4().multiplyMatrices(rz(-UMB_POSE.ab), rx(-UMB_POSE.sh))).add(sh);
  return [v.x, v.y, v.z];
}
const UMB_POSE = { sh: 0.55, ab: 0.14, el: 1.72 };

// ---------------------------------------------------------------- Mensch, Fernstufe (≈ 50 Dreiecke, nur Beine schwingen)
function humanFar(k) {
  const W = 0xffffff;
  for (const s of [1, -1]) k.box(s * HIP_X - 0.0058, 0, -0.0058, s * HIP_X + 0.0058, HIP_Y + 0.004, 0.0068, W, L(s > 0 ? B.THIGH_L : B.THIGH_R, 1));
  k.box(-0.0148, 0.082, -0.0102, 0.0148, WAIST_Y, 0.0098, W, L(B.PELVIS, 1), { top: false });
  k.box(-0.0215, WAIST_Y, -0.0105, 0.0215, 0.146, 0.0112, W, L(B.SPINE, 0));
  k.box(-0.0088, 0.146, -0.0095, 0.0088, 0.166, 0.0102, W, L(B.HEAD, 2), { top: false });
  k.on(-FBIT(FEAT.BALD), () => k.box(-0.0094, 0.166, -0.0102, 0.0094, 0.176, 0.0098, W, L(B.HEAD, 3), { bottom: false }));
  k.on(FBIT(FEAT.BALD), () => k.box(-0.0088, 0.166, -0.0095, 0.0088, 0.174, 0.0102, W, L(B.HEAD, 2), { bottom: false }));
}

const BUILDERS = {
  human: (k, d) => (d >= 2 ? humanNear(k) : d === 1 ? humanMid(k) : humanFar(k)),
  bicycle: (k, d) => bicycle(k, d),
  bird: (k) => bird(k),
  pigeon: (k) => pigeon(k),
  umbrella: (k, d) => umbrella(k, d),
};

const cache = new Map();
export function lifeGeometry(id, d = 2) {
  const key = id + '|' + d;
  if (cache.has(key)) return cache.get(key);
  const k = new PKit(d);
  BUILDERS[id](k, d);
  // Gemeinsame Vertizes zusammenlegen (runde Teile teilen Normalen) – spart Vertex-Shader-Arbeit pro Figur
  const raw = k.build();
  const geo = mergeVertices(raw, 1e-6);
  geo.userData.triangles = raw.userData.triangles;
  raw.dispose();
  cache.set(key, geo);
  return geo;
}

// ---------------------------------------------------------------- Merkmale je Person
// Feste Merkmale je Person (Frisur, Kleidung, Zubehör); Wetter-Merkmale kommen beim Zeichnen dazu
export function baseFeatures(kind, u) {
  const h = (n) => hashf(u * 9973 + n * 17.13);
  let f = 0;
  const fem = h(1) < 0.5;
  if (kind === 2) { // Kind: großer Kopf, oft Rucksack
    f |= FEAT.CHILD;
    if (h(2) < 0.6) f |= FEAT.BACKPACK;
    if (fem && h(3) < 0.5) f |= h(4) < 0.5 ? FEAT.PONY : FEAT.LONGHAIR;
    if (fem && h(5) < 0.35) f |= FEAT.SKIRT;
    return f;
  }
  if (kind === 4) { // Jogger
    f |= FEAT.SHORTS | FEAT.SHORTSLEEVE;
    if (fem && h(3) < 0.7) f |= FEAT.PONY;
    return f;
  }
  if (kind === 3) { // Ältere
    f |= FEAT.ELDER;
    if (h(2) < 0.3) f |= FEAT.CANE;
    if (!fem && h(3) < 0.45) f |= FEAT.BALD;
    if (fem && h(4) < 0.4) f |= FEAT.SKIRT;
    if (h(5) < 0.35) f |= FEAT.BAG;
    return f;
  }
  if (fem) {
    if (h(2) < 0.38) f |= FEAT.SKIRT;
    const hr = h(3);
    if (hr < 0.45) f |= FEAT.LONGHAIR; else if (hr < 0.7) f |= FEAT.PONY;
    if (h(4) < 0.35) f |= FEAT.BAG;
  } else {
    if (h(3) < 0.12) f |= FEAT.BALD;
    if (h(4) < 0.12) f |= FEAT.LONGHAIR;
  }
  const acc = h(6);
  if (acc < 0.2) f |= FEAT.BACKPACK; else if (acc < 0.3 && !(f & FEAT.BAG)) f |= FEAT.BAG;
  return f;
}
// Wetter: kalt → Mantel, Mütze, Schal; warm → kurze Ärmel, Shorts
export function wearFeatures(wf, kind, sd) {
  if (!wf || kind === 4) return 0;
  const r = (sd * 3.17 + 0.37) % 1, q = (sd * 5.71 + 0.11) % 1;
  let f = 0;
  if (wf.cold > 0) {
    if (r < 0.75 * wf.cold && kind !== 2) f |= FEAT.COAT;
    if (q < 0.55 * wf.cold) f |= FEAT.HAT;
    if (((sd * 8.3) % 1) < 0.35 * wf.cold) f |= FEAT.SCARF;
  } else if (wf.warm > 0) {
    if (r < 0.7 * wf.warm) f |= FEAT.SHORTSLEEVE;
    if (q < 0.3 * wf.warm && kind !== 3) f |= FEAT.SHORTS;
  }
  return f;
}

// Kleidung nach Wetter: cold/warm 0..1 (Temperatur, Abendkühle)
export function wearOf(w, h) {
  if (!w) return { cold: 0, warm: 0.5 };
  const t = (w.temp ?? 15) - (h < 8 || h > 20 ? 2 : 0);
  return { cold: sstep(12, 1, t), warm: sstep(19, 27, t) };
}
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- Shader: Skelett und Farben
const fl = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v)); // Zahl als GLSL-Fließkomma
const PEOPLE_PARS = /* glsl */`
attribute float aPart;
attribute float aFeat;
attribute vec4 aInst;
uniform float uPTime;
struct PX { mat3 R; vec3 t; };
mat3 pRX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 pRY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 pRZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
PX pxJ(mat3 Q, vec3 P) { PX o; o.R = Q; o.t = P - Q * P; return o; }
PX pxMul(PX a, PX b) { PX o; o.R = a.R * b.R; o.t = a.R * b.t + a.t; return o; }
const float L1 = ${(HIP_Y - KNEE_Y).toFixed(4)}, L2 = ${(KNEE_Y - ANK_Y).toFixed(4)};
// Zwei-Gelenk-Kette (Hüfte → Knöchel) zu einem Ziel v (y, z relativ zur Hüfte): Beugung Hüfte f und Knie k
vec2 pIK(vec2 v) {
  float d = clamp(length(v), 0.012, L1 + L2 - 0.0004);
  float base = atan(v.y, -v.x);
  float a = acos(clamp((L1 * L1 + d * d - L2 * L2) / (2.0 * L1 * d), -1.0, 1.0));
  float b = acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2.0 * L1 * L2), -1.0, 1.0));
  return vec2(base + a, 3.14159265 - b);
}
PX pBone(int bone, float ph, float amt, int mode, int feat, float seed) {
  PX I; I.R = mat3(1.0); I.t = vec3(0.0);
  if (bone == ${B.STATIC}) return I;
  // --- Vögel
  if (bone == ${B.WING_L} || bone == ${B.WING_R}) {
    float w = (sin(ph) * 0.85 + 0.15) * amt * (bone == ${B.WING_L} ? 1.0 : -1.0);
    return pxJ(pRZ(w), vec3(0.0));
  }
  if (bone == ${B.BIRD_HEAD}) {
    float pk = mode == ${MODE.BIRD_GROUND} ? pow(max(0.0, sin(ph)), 6.0) * 0.9 * amt : 0.0;
    float bob = sin(ph * 2.0) * 0.0012 * (1.0 - amt);
    PX o = pxJ(pRX(pk), vec3(0.0, 0.0165, 0.004)); o.t.z += bob; return o;
  }
  // --- Fahrrad
  if (bone == ${B.CRANK}) return pxJ(pRX(ph), vec3(0.0, ${fl(BIKE.bbY)}, ${fl(BIKE.bbZ)}));
  if (bone == ${B.WHEEL_F}) return pxJ(pRX(ph * 2.6), vec3(0.0, 0.034, 0.049));
  if (bone == ${B.WHEEL_R}) return pxJ(pRX(ph * 2.6), vec3(0.0, 0.034, -0.057));
  // --- Mensch: Gelenkwinkel je Haltung
  bool child = (feat & ${FEAT.CHILD}) != 0, elder = (feat & ${FEAT.ELDER}) != 0, umb = (feat & ${FEAT.UMBRELLA}) != 0;
  float it = uPTime * 0.5 + seed * 41.0;
  float fL = 0.0, fR = 0.0, kL = 0.0, kR = 0.0, aL = 0.0, aR = 0.0;
  float sL = 0.0, sR = 0.0, bL = 0.07, bR = 0.07, eL = 0.18, eR = 0.18;
  float pYaw = 0.0, pRoll = 0.0, sYaw = 0.0, sLean = 0.0, hYaw = 0.0, hPit = 0.0;
  vec3 rt = vec3(0.0);
  if (mode == ${MODE.WALK}) {
    float wk = clamp(amt, 0.0, 1.0), rn = clamp(amt - 1.0, 0.0, 1.0), idle = 1.0 - wk;
    float s = sin(ph), c = cos(ph);
    bool robe = (feat & ${FEAT.SKIRT | FEAT.COAT}) != 0;
    float A = mix(0.4, 0.66, rn) * wk * (elder ? 0.7 : 1.0) * (robe ? 0.85 : 1.0);
    fL = A * s + 0.04 * wk; fR = -A * s + 0.04 * wk;
    float kw = mix(0.78, 1.55, rn) * wk;
    kL = 0.06 * wk + kw * pow(max(0.0, cos(ph + 0.35)), 1.6) + 0.1 * wk * max(0.0, -cos(ph + 0.35));
    kR = 0.06 * wk + kw * pow(max(0.0, -cos(ph + 0.35)), 1.6) + 0.1 * wk * max(0.0, cos(ph + 0.35));
    // Stehen: Gewicht langsam verlagern, ein Knie locker
    float sh = sin(it * 0.42 + seed * 3.0);
    kL += idle * 0.16 * max(0.0, -sh); kR += idle * 0.16 * max(0.0, sh);
    fL += idle * 0.08 * max(0.0, -sh); fR += idle * 0.08 * max(0.0, sh);
    pRoll = idle * 0.035 * sh + 0.025 * s * wk;
    rt.x = idle * 0.0016 * sh;
    // Füße flach, beim Abdrücken Ferse heben
    aL = fL - kL + 0.34 * wk * max(0.0, -s) * max(0.0, -c);
    aR = fR - kR + 0.34 * wk * max(0.0, s) * max(0.0, c);
    // Becken aus der Beinlänge: das tiefere Bein steht am Boden
    float hl = L1 * cos(fL) + L2 * cos(fL - kL), hr = L1 * cos(fR) + L2 * cos(fR - kR);
    rt.y = (max(hl, hr) - (L1 + L2)) * 0.62 + rn * 0.005 * abs(c);
    pYaw = -0.11 * s * wk; sYaw = 0.17 * s * wk;
    sLean = 0.035 * wk + 0.12 * rn + (elder ? 0.2 : 0.0);
    float AA = mix(0.42, 0.62, rn) * wk * (elder ? 0.6 : 1.0);
    sL = -AA * s; sR = AA * s;
    eL = 0.16 + 0.32 * max(0.0, sL) + rn * 1.2 + idle * 0.04 * sin(it * 0.7);
    eR = 0.16 + 0.32 * max(0.0, sR) + rn * 1.2 + idle * 0.04 * sin(it * 0.6 + 1.0);
    bL = 0.07 + rn * 0.1; bR = bL;
    hYaw = idle * 0.45 * sin(it * 0.21 + seed * 7.0) - pYaw * 0.6 - sYaw * 0.5;
    hPit = -0.04 * wk + idle * 0.08 * sin(it * 0.33) + (elder ? 0.12 : 0.0) - 0.08 * rn;
  } else if (mode == ${MODE.CYCLE}) {
    rt = vec3(0.0, ${fl(BIKE.saddleY)} + 0.0045 - ${fl(HIP_Y)}, ${fl(BIKE.saddleZ)});
    for (int sd = 0; sd < 2; sd++) {
      float a = ph + float(sd) * 3.14159265;
      // Knöchel über dem Pedal (Fußballen auf dem Pedal)
      vec2 ped = vec2(${fl(BIKE.bbY)} - cos(a) * ${fl(BIKE.crank)} + 0.006, ${fl(BIKE.bbZ)} - sin(a) * ${fl(BIKE.crank)} - 0.0055);
      vec2 v = ped - vec2(${fl(HIP_Y)} + rt.y, rt.z);
      vec2 r = pIK(v);
      if (sd == 0) { fL = r.x; kL = r.y; aL = r.x - r.y - 0.15; } else { fR = r.x; kR = r.y; aR = r.x - r.y - 0.15; }
    }
    sLean = 0.52; sL = 1.1; sR = 1.1; eL = 0.25; eR = 0.25; bL = 0.1; bR = 0.1;
    hPit = -0.42; hYaw = 0.12 * sin(it * 0.17);
    sYaw = 0.03 * sin(ph);
  } else if (mode == ${MODE.SIT}) {
    rt = vec3(0.0, 0.054 - ${fl(HIP_Y)}, 0.0);
    float lg = sin(seed * 31.0);
    fL = 1.5; fR = 1.5; kL = 1.42 + 0.12 * lg; kR = 1.42 - 0.1 * lg; aL = fL - kL; aR = fR - kR;
    sLean = -0.07 + 0.03 * sin(it * 0.25); sL = 0.42; sR = 0.36; eL = 0.95; eR = 1.05; bL = 0.1; bR = 0.1;
    hYaw = 0.55 * sin(it * 0.16 + seed * 9.0); hPit = 0.1 + 0.06 * sin(it * 0.29);
  }
  if (umb) { sR = ${fl(UMB_POSE.sh)}; bR = ${fl(UMB_POSE.ab)}; eR = ${fl(UMB_POSE.el)}; }
  // --- Kette
  PX root; root.R = mat3(1.0); root.t = rt;
  if (bone == ${B.ROOT}) return root;
  PX pel = pxMul(root, pxJ(pRY(pYaw) * pRZ(pRoll), vec3(0.0, ${fl(HIP_Y)}, 0.0)));
  if (bone == ${B.PELVIS}) return pel;
  if (bone >= ${B.THIGH_L} && bone <= ${B.FOOT_R}) {
    bool left = (bone - ${B.THIGH_L}) % 2 == 0;
    float sx = left ? ${fl(HIP_X)} : -${fl(HIP_X)};
    PX th = pxMul(pel, pxJ(pRX(-(left ? fL : fR)), vec3(sx, ${fl(HIP_Y)}, 0.0)));
    if (bone <= ${B.THIGH_R}) return th;
    PX shn = pxMul(th, pxJ(pRX(left ? kL : kR), vec3(sx, ${fl(KNEE_Y)}, 0.0005)));
    if (bone <= ${B.SHIN_R}) return shn;
    return pxMul(shn, pxJ(pRX(left ? aL : aR), vec3(sx, ${fl(ANK_Y)}, 0.0)));
  }
  PX sp = pxMul(pel, pxJ(pRY(sYaw) * pRX(sLean), vec3(0.0, ${fl(WAIST_Y)}, 0.0)));
  if (bone == ${B.SPINE}) return sp;
  if (bone == ${B.HEAD}) {
    PX hd = pxMul(sp, pxJ(pRY(hYaw) * pRX(hPit) * (child ? 1.2 : 1.0), vec3(0.0, ${fl(NECK_Y)}, 0.0)));
    return hd;
  }
  bool la = (bone - ${B.UARM_L}) % 2 == 0;
  float ax = la ? ${fl(SH_X)} : -${fl(SH_X)};
  PX ua = pxMul(sp, pxJ(pRZ(la ? bL : -bR) * pRX(-(la ? sL : sR)), vec3(ax, ${fl(SH_Y)}, 0.0)));
  if (bone <= ${B.UARM_R}) return ua;
  return pxMul(ua, pxJ(pRX(-(la ? eL : eR)), vec3(ax, ${fl(EL_Y)}, 0.0)));
}
PX pSkin;
bool pHide;
void pPrepare() {
  int wi = int(aInst.w + 0.5);
  int mode = wi - (wi / 8) * 8;
  int feat = wi / 8;
  int bone = int((aPart + 0.5) / 8.0);
  pHide = false;
  if (aFeat > 0.5) pHide = ((feat >> (int(aFeat + 0.5) - 1)) & 1) == 0;
  else if (aFeat < -0.5) pHide = ((feat >> (int(-aFeat + 0.5) - 1)) & 1) == 1;
  pSkin = pBone(bone, aInst.x, aInst.y, mode, feat, aInst.z);
}
`;

const PEOPLE_COLOR = /* glsl */`
vColor = vec3(1.0);
vColor *= color;
{
  int slot = int(mod(aPart + 0.5, 8.0));
  int bone = int((aPart + 0.5) / 8.0);
  int wi = int(aInst.w + 0.5);
  int feat = wi / 8;
  float sd = aInst.z;
  // Kurze Ärmel / Shorts: Haut statt Stoff an Oberarm unten bzw. Unterschenkel; Rock: Strumpfhose oder Haut
  bool skinLeg = (bone == ${B.SHIN_L} || bone == ${B.SHIN_R}) && slot == 1 && ((feat & ${FEAT.SHORTS}) != 0 || ((feat & ${FEAT.SKIRT}) != 0 && fract(sd * 13.7) < 0.55));
  bool tights = (bone == ${B.SHIN_L} || bone == ${B.SHIN_R} || bone == ${B.THIGH_L} || bone == ${B.THIGH_R}) && slot == 1 && (feat & ${FEAT.SKIRT}) != 0 && !skinLeg;
  if (skinLeg) slot = 2;
  if (slot == 0) {
#ifdef USE_INSTANCING_COLOR
    vColor *= instanceColor.xyz;
#endif
  }
  else if (tights) vColor *= vec3(0.06, 0.06, 0.07) + uPants[int(fract(sd * 7.13) * 7.99)] * 0.25;
  else if (slot == 1) vColor *= uPants[int(fract(sd * 7.13) * 7.99)];
  else if (slot == 2) vColor *= uSkin[int(fract(sd * 3.71) * 5.99)];
  else if (slot == 3) vColor *= (feat & ${FEAT.ELDER}) != 0 ? uGrey[int(fract(sd * 5.37) * 3.99)] : uHair[int(fract(sd * 5.37) * 7.99)];
  else if (slot == 6) vColor *= uBag[int(fract(sd * 9.91) * 7.99)];
  else if (slot == 7) vColor *= uAcc[int(fract(sd * 4.33) * 7.99)];
}`;

const PEOPLE_NORMAL = /* glsl */`#include <beginnormal_vertex>
pPrepare();
objectNormal = pSkin.R * objectNormal;`;
const PEOPLE_POS = /* glsl */`#include <begin_vertex>
transformed = pHide ? vec3(0.0) : pSkin.R * transformed + pSkin.t;`;
const PEOPLE_POS_DEPTH = /* glsl */`#include <begin_vertex>
pPrepare();
transformed = pHide ? vec3(0.0) : pSkin.R * transformed + pSkin.t;`;

const U = { uPTime: { value: 0 } };
export function setPeopleTime(t) { U.uPTime.value = t; }

let _mat = null;
export function getPeopleMaterial() {
  if (_mat) return _mat;
  const pal = (arr) => arr.map((h) => new THREE.Color(h));
  const UP = { uPants: { value: pal(PANTS) }, uSkin: { value: pal(SKIN) }, uHair: { value: pal(HAIR) }, uGrey: { value: pal(GREY) }, uBag: { value: pal(BAG) }, uAcc: { value: pal(ACC) } };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, UP);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
${PEOPLE_PARS}
uniform vec3 uPants[8];
uniform vec3 uSkin[6];
uniform vec3 uHair[8];
uniform vec3 uGrey[4];
uniform vec3 uBag[8];
uniform vec3 uAcc[8];`)
      .replace('#include <beginnormal_vertex>', PEOPLE_NORMAL)
      .replace('#include <color_vertex>', PEOPLE_COLOR)
      .replace('#include <begin_vertex>', PEOPLE_POS);
  };
  mat.customProgramCacheKey = () => 'people2';
  _mat = mat;
  return mat;
}

// Schatten mit derselben Bewegung (sonst wirft die Ruhehaltung samt aller ausgeblendeten Teile Schatten)
let _depth = null;
export function getPeopleDepthMaterial() {
  if (_depth) return _depth;
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${PEOPLE_PARS}`)
      .replace('#include <begin_vertex>', PEOPLE_POS_DEPTH);
  };
  m.customProgramCacheKey = () => 'people2depth';
  _depth = m;
  return m;
}
