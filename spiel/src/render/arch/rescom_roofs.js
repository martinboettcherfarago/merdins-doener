// Dächer für Wohnen & Gewerbe (Besitzer G3): Sattel-, Krüppelwalm-, Walm-, Zelt-, Mansard-, Pult- und Flachdach
// als Platten mit Stärke (Traufbrett, Ortgang, Untersicht), Gauben, Dachflächenfenster, Solarmodule, Schornsteine,
// Dachrinnen, Fallrohre und Dachaufbauten.
import { M } from './kit.js';
import { F, NB } from './rescom_geo.js';
import { wall, mframe } from './rescom_facade.js';

const key = (p) => `${p[0].toFixed(4)},${p[1].toFixed(4)},${p[2].toFixed(4)}`;

// Dachplatte: tops = ebene Vielecke (Punkte [x, y, z]). Unterseite um t nach unten versetzt,
// freie Kanten bekommen eine Stirnfläche (Traufbrett/Ortgang).
export function roofSlab(g, tops, t, mats) {
  const top = mats.top, under = mats.under || mats.top, edge = mats.edge || under;
  const edges = new Map();
  for (const poly of tops) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const ka = key(a), kb = key(b);
      const k1 = ka < kb ? ka + '|' + kb : kb + '|' + ka;
      if (edges.has(k1)) edges.get(k1).n++;
      else edges.set(k1, { a, b, poly, n: 1 });
    }
  }
  for (const poly of tops) {
    g.poly(top, poly, 0, [0, 1, 0]);
    if (t > 0) g.poly(under, poly.map((p) => [p[0], p[1] - t, p[2]]), 0, [0, -1, 0]);
  }
  if (t <= 0) return;
  for (const e of edges.values()) {
    if (e.n > 1) continue;
    let cx = 0, cz = 0;
    for (const p of e.poly) { cx += p[0] / e.poly.length; cz += p[2] / e.poly.length; }
    const mx = (e.a[0] + e.b[0]) / 2 - cx, mz = (e.a[2] + e.b[2]) / 2 - cz;
    const a2 = [e.a[0], e.a[1] - t, e.a[2]], b2 = [e.b[0], e.b[1] - t, e.b[2]];
    g.quad(edge, e.a, a2, b2, e.b, 0, [mx, 0, mz]);
  }
}

// Dach über einem Rechteck mit First (ridge 'x' oder 'z'). Enden: k = 0 Giebel, 0 < k < 1 Krüppelwalm, 1 Walm.
// o: cx, cz, sx, sz (Wandmaße), y0 (Traufhöhe an der Wand), pitch (Neigung in Grad), eave, verge, t,
//    mat, under, edge, wall (Giebelwand), k0, k1, gable: { lo: ops, hi: ops } (Öffnungen in den Giebelwänden)
// Rückgabe: Info für Gauben, Fenster, Schornsteine.
export function rectRoof(g, o) {
  const ridgeX = (o.ridge || (o.sx >= o.sz ? 'x' : 'z')) === 'x';
  const a = (ridgeX ? o.sx : o.sz) / 2, b = (ridgeX ? o.sz : o.sx) / 2;
  const tan = Math.tan(((o.pitch ?? 40) * Math.PI) / 180);
  const oe = o.eave ?? 0.5 * M, ov = o.verge ?? 0.4 * M, t = o.t ?? 0.28 * M;
  const k0 = o.k0 ?? o.k ?? 0, k1 = o.k1 ?? o.k ?? 0;
  const ov1 = o.verge1 ?? ov, ov0 = o.verge0 ?? ov;
  const A = a + (k1 > 0 ? oe : ov1), A0 = a + (k0 > 0 ? oe : ov0), B = b + oe;
  const y0 = o.y0, h = b * tan, yE = y0 - oe * tan, yR = y0 + h, Hp = B * tan;
  // lokale (X entlang First, Z quer) → Baukasten
  const T = ridgeX ? (X, y, Z) => [o.cx + X, y, o.cz + Z] : (X, y, Z) => [o.cx - Z, y, o.cz + X];
  const yG0 = yE + (1 - k0) * Hp, yG1 = yE + (1 - k1) * Hp;
  const R0 = -A0 + k0 * B, R1 = A - k1 * B;
  const rL = Math.min(R0, R1), rH = Math.max(R0, R1);
  const dedupe = (pts) => pts.filter((p, i) => { const q = pts[(i + 1) % pts.length]; return Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) > 1e-6; });
  const tops = [];
  for (const s of [1, -1]) {
    const pts = [[-A0, yE, s * B], [A, yE, s * B], [A, yG1, s * k1 * B], [rH, yR, 0], [rL, yR, 0], [-A0, yG0, s * k0 * B]];
    let P = dedupe(pts).map(([X, y, Z]) => T(X, y, Z));
    if (s < 0) P = P.reverse();
    tops.push(P);
  }
  if (k1 > 0) tops.push([T(A, yG1, -k1 * B), T(A, yG1, k1 * B), T(rH, yR, 0)]);
  if (k0 > 0) tops.push([T(-A0, yG0, k0 * B), T(-A0, yG0, -k0 * B), T(rL, yR, 0)]);
  const mats = { top: o.mat, under: o.under || 'wood_planks', edge: o.edge || o.under || 'wood_planks' };
  roofSlab(g, tops, g.detail === 0 ? 0.0 : t, mats);
  if (g.detail === 0) g.poly(mats.under, [T(-A0, yE, B), T(A, yE, B), T(A, yE, -B), T(-A0, yE, -B)], 0, [0, -1, 0]);
  // Giebelwände
  if (o.wall) {
    for (const end of [1, -1]) {
      const k = end > 0 ? k1 : k0, ov2 = end > 0 ? A - a : A0 - a;
      let yh = yR;
      if (k > 0) yh = Math.min(yR, yE + (1 - k) * Hp + ov2 * tan);
      const zh = Math.max(0, b - (yh - y0) / tan);
      // Wandrahmen der Giebelseite
      const side = ridgeX ? (end > 0 ? 'right' : 'left') : (end > 0 ? 'front' : 'back');
      const f = mframe(o.cx, o.cz, o.sx, o.sz, side);
      const wb = o.wallBase === undefined ? y0 : typeof o.wallBase === 'number' ? o.wallBase : (end > 0 ? o.wallBase.hi : o.wallBase.lo) ?? y0;
      let outer;
      if (wb < y0 - 1e-4) outer = zh > 1e-4 ? [[-b, wb], [b, wb], [b, y0], [zh, yh], [-zh, yh], [-b, y0]] : [[-b, wb], [b, wb], [b, y0], [0, yR], [-b, y0]];
      else outer = zh > 1e-4 ? [[-b, y0], [b, y0], [zh, yh], [-zh, yh]] : [[-b, y0], [b, y0], [0, yR]];
      const ops = (o.gable && (end > 0 ? o.gable.hi : o.gable.lo)) || [];
      wall(g, f, o.wall, Math.min(wb, y0), yR, ops, { outer, reveal: o.reveal });
    }
  }
  // First- und Gratziegel
  if (g.detail >= 1 && rH - rL > 0.05 * M) {
    const c = T((rL + rH) / 2, yR - 0.03 * M, 0);
    const len = rH - rL;
    g.box(o.ridgeMat || o.mat, c[0], c[1], c[2], ridgeX ? len : 0.2 * M, 0.11 * M, ridgeX ? 0.2 * M : len, { skip: F.BOTTOM });
  }
  if (g.detail >= 2) {
    // Dachrinnen und Fallrohre an den Traufen
    const gm = o.gutter === null ? null : (o.gutter || 'metal_light');
    if (gm) {
      for (const s of [1, -1]) {
        const c = T((A - A0) / 2, yE - t * 0.6, s * (B + 0.06 * M));
        g.hcyl(gm, c[0], c[1], c[2], 0.07 * M, A + A0, ridgeX ? 'x' : 'z', 5);
        if (o.downpipes !== false) {
          for (const e of [-1, 1]) {
            const X = e > 0 ? a - 0.15 * M : -a + 0.15 * M;
            const p = T(X, 0, s * (b + 0.08 * M));
            g.box(gm, p[0], 0.1 * M, p[2], 0.08 * M, Math.max(0.1 * M, yE - t * 0.6 - 0.1 * M), 0.08 * M, { skip: F.TOP | F.BOTTOM });
          }
        }
      }
    }
  }
  return { ridgeX, cx: o.cx, cz: o.cz, a, b, A, A0, B, y0, yE, yR, tan, T, t, mat: o.mat, k0, k1, sx: o.sx, sz: o.sz };
}

// Punkt auf einer Dachfläche: s = +1/-1 (Seite), X entlang First, dist = waagrechter Abstand von der Wandflucht nach innen
export function slopePoint(info, s, X, dist, lift = 0) {
  const Z = s * (info.b - dist), y = info.y0 + dist * info.tan;
  const nY = 1 / Math.sqrt(1 + info.tan * info.tan), nZ = info.tan * nY;
  return info.T(X, y + lift * nY, Z + s * lift * nZ);
}
// Normale/Achsen einer Dachseite im Baukasten
function slopeAxes(info, s) {
  const nY = 1 / Math.sqrt(1 + info.tan * info.tan), nZ = info.tan * nY;
  const dir = (X, y, Z) => { const p = info.T(X, y, Z), o = info.T(0, 0, 0); return [p[0] - o[0], p[1] - o[1], p[2] - o[2]]; };
  return { along: dir(1, 0, 0), up: dir(0, nZ, -s * nY), n: dir(0, nY, s * nZ) };
}

// Gaube auf der Dachseite s (+1/-1) bei X; type: 'gable' | 'shed' | 'flat'
export function dormer(g, info, s, X, o = {}) {
  if (g.detail === 0) return;
  const dw = o.w ?? 1.6 * M, wh = o.winH ?? 1.2 * M;
  const set = o.setback ?? 0.4 * M;
  const yb = info.y0 + set * info.tan;
  const fh = wh + 0.55 * M;
  const yt = yb + fh;
  const depth = (yt - info.y0) / info.tan - set + 0.2 * M; // bis in die Dachfläche
  // Gaubenkörper als kleiner Baukörper (Front zeigt zur Traufe)
  const pf = info.T(X, 0, s * (info.b - set)), pb = info.T(X, 0, s * (info.b - set - depth));
  const cx = (pf[0] + pb[0]) / 2, cz = (pf[2] + pb[2]) / 2;
  // Drehung so, dass „front" nach außen zeigt
  const out = info.T(0, 0, s), o0 = info.T(0, 0, 0);
  const ry = Math.atan2(out[0] - o0[0], out[2] - o0[2]);
  const m = { cx, cz, sx: dw, sz: depth, ry };
  const clad = o.clad || o.wall;
  const ops = [{ kind: 'win', u: 0, y: yb + 0.3 * M, w: dw - 0.5 * M, h: wh, frame: o.frame, panes: { cols: dw > 1.4 * M ? 2 : 1 }, depth: 0.08 * M }];
  const ff = mframe(cx, cz, dw, depth, 'front', ry);
  wall(g, ff, clad, yb, yt, ops);
  for (const side of ['left', 'right']) {
    const f = mframe(cx, cz, dw, depth, side, ry);
    // Wangen: Dreieck/Trapez über der Dachfläche (u läuft hier entlang der Gaubentiefe)
    const L = depth, ytop = yt;
    const sgn = side === 'left' ? 1 : -1; // u-Richtung relativ zur Front
    const uFront = sgn * L / 2, uBack = -sgn * L / 2;
    const yBack = info.y0 + (set + depth) * info.tan;
    const outer = sgn > 0 ? [[uBack, Math.min(yBack, ytop)], [uFront, yb], [uFront, ytop], [uBack, ytop]] : [[uFront, yb], [uBack, Math.min(yBack, ytop)], [uBack, ytop], [uFront, ytop]];
    wall(g, f, o.cheek || clad, yb, ytop, [], { outer });
  }
  const rm = o.mat || info.mat;
  const type = o.type || 'gable';
  if (type === 'gable') {
    const rp = o.pitch ?? 42;
    const sub = rectRoof(g, { cx, cz: cz, sx: 0, sz: 0, y0: yt, pitch: rp, mat: rm, under: o.under, edge: o.edge, t: 0.12 * M, eave: 0.18 * M, verge: 0.15 * M, gutter: null, ...dormerRoofDims(dw, depth, ry, cx, cz), wall: clad });
    void sub;
  } else {
    const slope = type === 'shed' ? Math.tan((12 * Math.PI) / 180) : 0.02;
    const ov = 0.18 * M;
    const zF = depth / 2 + ov, zB = -depth / 2 - 0.1 * M;
    const yF = yt + 0.05 * M, yB = yF + (zF - zB) * slope;
    const c = Math.cos(ry), sn = Math.sin(ry);
    const P = (u, y, d) => [cx + c * u + sn * d, y, cz - sn * u + c * d];
    const hw = dw / 2 + ov;
    roofSlab(g, [[P(-hw, yF, zF), P(hw, yF, zF), P(hw, yB, zB), P(-hw, yB, zB)]], 0.12 * M, { top: rm, under: o.under || 'wood_planks', edge: o.edge || 'trim_dark' });
  }
}
// Hilfsmaße für das Gaubendach (Satteldach mit First zur Hauptdachmitte)
function dormerRoofDims(dw, depth, ry, cx, cz) {
  // rectRoof kennt nur achsparallele Dächer: Gauben auf Front/Rückseite → First entlang z, auf Seiten → entlang x
  const alongZ = Math.abs(Math.cos(ry)) > 0.5;
  return alongZ ? { ridge: 'z', sx: dw, sz: depth, cx, cz } : { ridge: 'x', sx: depth, sz: dw, cx, cz };
}

// Dachflächenfenster
export function roofWindow(g, info, s, X, dist, w = 0.8 * M, h = 1.1 * M) {
  if (g.detail === 0) return;
  const ax = slopeAxes(info, s);
  const c = slopePoint(info, s, X, dist + h / 2, 0.05 * M);
  const hx = ax.along.map((v) => v * w / 2), hy = ax.up.map((v) => v * h / 2), hz = ax.n.map((v) => v * 0.04 * M);
  g.obox('metal_dark', c, hx, hz, hy.map((v) => -v), { skip: F.BOTTOM });
  const cg = slopePoint(info, s, X, dist + h / 2, 0.095 * M);
  const gx = hx.map((v) => v * 0.82), gy = hy.map((v) => v * 0.86);
  g.quad('glass_window', [cg[0] - gx[0] - gy[0], cg[1] - gx[1] - gy[1], cg[2] - gx[2] - gy[2]], [cg[0] + gx[0] - gy[0], cg[1] + gx[1] - gy[1], cg[2] + gx[2] - gy[2]],
    [cg[0] + gx[0] + gy[0], cg[1] + gx[1] + gy[1], cg[2] + gx[2] + gy[2]], [cg[0] - gx[0] + gy[0], cg[1] - gx[1] + gy[1], cg[2] - gx[2] + gy[2]], g.rng(), ax.n);
}
// Solarmodul-Feld auf einer Dachseite
export function solarField(g, info, s, X, dist, w, h) {
  if (g.detail === 0) return;
  const ax = slopeAxes(info, s);
  const c = slopePoint(info, s, X, dist + h / 2, 0.08 * M);
  g.obox('solar_panel', c, ax.along.map((v) => v * w / 2), ax.n.map((v) => v * 0.035 * M), ax.up.map((v) => -v * h / 2), { skip: F.BOTTOM });
  if (g.detail >= 2) {
    // Modulfugen
    const n = Math.max(1, Math.round(w / (1.05 * M)));
    for (let k = 1; k < n; k++) {
      const p = slopePoint(info, s, X - w / 2 + (w * k) / n, dist + h / 2, 0.118 * M);
      g.obox('metal_light', p, ax.along.map((v) => v * 0.015 * M), ax.n.map((v) => v * 0.004 * M), ax.up.map((v) => -v * h / 2), { skip: F.BOTTOM });
    }
  }
}
// Schornstein auf einem Satteldach (lokal X, Z), ragt über den First
export function chimney(g, info, X, Z, o = {}) {
  const p = info.T(X, 0, Z);
  // Regel: nahe am First 0,4 m über First, sonst 1 m über der Dachfläche
  const surf = info.y0 + Math.max(0, info.b - Math.abs(Z)) * info.tan;
  const top = Math.abs(Z) < 1.5 * M ? info.yR + (o.over ?? 0.45 * M) : Math.min(info.yR + 0.45 * M, surf + 1.1 * M);
  const w = o.w ?? 0.6 * M, d = o.d ?? 0.6 * M;
  const yb = info.y0;
  g.box(o.mat || 'chimney_brick', p[0], yb, p[2], w, top - yb, d, { skip: F.BOTTOM });
  if (g.detail >= 1) {
    g.box('concrete_dark', p[0], top, p[2], w + 0.12 * M, 0.1 * M, d + 0.12 * M);
    if (g.detail >= 2) g.box('metal_dark', p[0], top + 0.1 * M, p[2], w * 0.5, 0.12 * M, d * 0.5, { skip: F.BOTTOM });
  }
  if (o.smoke) g.kit.smoke(p[0], top + 0.2 * M, p[2], 'smoke', o.smoke);
}

// Mansarddach: steiler Unterteil (Neigung lowPitch bis Höhe hm), flaches Walmdach darüber
export function mansardRoof(g, o) {
  const { cx, cz, sx, sz, y0 } = o;
  const lp = Math.tan(((o.lowPitch ?? 72) * Math.PI) / 180), up = Math.tan(((o.upPitch ?? 18) * Math.PI) / 180);
  const hm = o.hm ?? 2.6 * M, oe = o.eave ?? 0.1 * M;
  const i = hm / lp;
  const ax = sx / 2 + oe, az = sz / 2 + oe, yE = y0 - oe * lp;
  const bx = sx / 2 - i, bz = sz / 2 - i, yB = y0 + hm;
  const P = (x, y, z) => [cx + x, y, cz + z];
  const tops = [
    [P(-ax, yE, az), P(ax, yE, az), P(bx, yB, bz), P(-bx, yB, bz)],
    [P(ax, yE, -az), P(-ax, yE, -az), P(-bx, yB, -bz), P(bx, yB, -bz)],
    [P(ax, yE, az), P(ax, yE, -az), P(bx, yB, -bz), P(bx, yB, bz)],
    [P(-ax, yE, -az), P(-ax, yE, az), P(-bx, yB, bz), P(-bx, yB, -bz)],
  ];
  // Oberteil: flaches Walmdach
  const r = Math.min(bx, bz);
  const h2 = r * up;
  const rx = Math.max(0, bx - r), rz = Math.max(0, bz - r);
  const yT = yB + h2;
  if (rx >= rz) {
    tops.push([P(-bx, yB, bz), P(bx, yB, bz), P(rx, yT, 0), P(-rx, yT, 0)].filter((p, k, arr) => k === 0 || key(p) !== key(arr[k - 1])));
    tops.push([P(bx, yB, -bz), P(-bx, yB, -bz), P(-rx, yT, 0), P(rx, yT, 0)].filter((p, k, arr) => k === 0 || key(p) !== key(arr[k - 1])));
    tops.push([P(bx, yB, bz), P(bx, yB, -bz), P(rx, yT, 0)]);
    tops.push([P(-bx, yB, -bz), P(-bx, yB, bz), P(-rx, yT, 0)]);
  } else {
    tops.push([P(-bx, yB, bz), P(bx, yB, bz), P(0, yT, rz)]);
    tops.push([P(bx, yB, -bz), P(-bx, yB, -bz), P(0, yT, -rz)]);
    tops.push([P(bx, yB, bz), P(bx, yB, -bz), P(0, yT, -rz), P(0, yT, rz)]);
    tops.push([P(-bx, yB, -bz), P(-bx, yB, bz), P(0, yT, rz), P(0, yT, -rz)]);
  }
  for (const t of tops) for (let k = t.length - 1; k > 0; k--) if (key(t[k]) === key(t[k - 1])) t.splice(k, 1);
  roofSlab(g, tops, g.detail === 0 ? 0 : 0.2 * M, { top: o.mat, under: o.under || 'trim_stone', edge: o.edge || 'trim_stone' });
  if (g.detail === 0) g.poly(o.under || 'trim_stone', [P(-ax, yE, az), P(ax, yE, az), P(ax, yE, -az), P(-ax, yE, -az)], 0, [0, -1, 0]);
  // Blechabdeckung am Knick
  if (g.detail >= 1) {
    const km = o.kink || 'roof_metal_grey';
    g.box(km, cx, yB - 0.04 * M, cz + bz, bx * 2 + 0.1 * M, 0.08 * M, 0.12 * M);
    g.box(km, cx, yB - 0.04 * M, cz - bz, bx * 2 + 0.1 * M, 0.08 * M, 0.12 * M);
    g.box(km, cx + bx, yB - 0.04 * M, cz, 0.12 * M, 0.08 * M, bz * 2 + 0.1 * M);
    g.box(km, cx - bx, yB - 0.04 * M, cz, 0.12 * M, 0.08 * M, bz * 2 + 0.1 * M);
  }
  return { cx, cz, sx, sz, y0, yB, yT, lp, i, hm };
}
// Mansardgaube: senkrechte Fensterfront im steilen Unterteil, Seite side, Position u (entlang der Wand)
export function mansardDormer(g, mi, side, u, o = {}) {
  if (g.detail === 0) return;
  const f0 = mframe(mi.cx, mi.cz, mi.sx, mi.sz, side);
  const w = o.w ?? 1.3 * M, h = o.h ?? 1.7 * M;
  const set = 0.25 * M;
  const yb = mi.y0 + set * mi.lp;
  const yt = Math.min(mi.yB - 0.1 * M, yb + h + 0.35 * M);
  const depth = (yt - mi.y0) / mi.lp - set + 0.15 * M;
  // Körper als gedrehter Baukörper
  const pc = [f0.ox + f0.c * u + f0.s * (-set - depth / 2), f0.oz - f0.s * u + f0.c * (-set - depth / 2)];
  const m = { cx: pc[0], cz: pc[1], sx: w, sz: depth, ry: f0.ry };
  const ff = mframe(m.cx, m.cz, w, depth, 'front', f0.ry);
  wall(g, ff, o.wall || 'trim_stone', yb, yt, [{ kind: 'win', u: 0, y: yb + 0.15 * M, w: w - 0.4 * M, h: yt - yb - 0.4 * M, frame: o.frame, panes: { cols: 2, transom: 0.25 }, depth: 0.1 * M }]);
  for (const side2 of ['left', 'right']) wall(g, mframe(m.cx, m.cz, w, depth, side2, f0.ry), o.wall || 'trim_stone', yb, yt, []);
  // Abdeckung (Segment/Dreieck angedeutet)
  const top = o.top || 'flat';
  g.wbox(o.roof || 'roof_metal_grey', ff, 0, yt, -depth / 2 + 0.06 * M, w + 0.16 * M, 0.08 * M, depth + 0.12 * M);
  if (top === 'tri' && g.detail >= 1) {
    const a = [ff.ox + ff.c * (-w / 2 - 0.08 * M) + ff.s * 0.06 * M, yt + 0.08 * M, ff.oz - ff.s * (-w / 2 - 0.08 * M) + ff.c * 0.06 * M];
    const b = [ff.ox + ff.c * (w / 2 + 0.08 * M) + ff.s * 0.06 * M, yt + 0.08 * M, ff.oz - ff.s * (w / 2 + 0.08 * M) + ff.c * 0.06 * M];
    const c = [ff.ox + ff.s * 0.06 * M, yt + 0.08 * M + w * 0.28, ff.oz + ff.c * 0.06 * M];
    g.tri(o.wall || 'trim_stone', a, b, c, 0, [ff.s, 0, ff.c]);
    const back = (p) => [p[0] - ff.s * (depth * 0.9), p[1], p[2] - ff.c * (depth * 0.9)];
    g.quad(o.roof || 'roof_metal_grey', a, c, back(c), back(a), 0, [-ff.c, 1, ff.s]);
    g.quad(o.roof || 'roof_metal_grey', c, b, back(b), back(c), 0, [ff.c, 1, -ff.s]);
  }
}

// Flachdach mit Attika und Abdeckung. m: {cx, cz, sx, sz}, y = Oberkante Wand
export function flatRoof(g, m, y, o = {}) {
  const ph = o.parapet ?? 0.7 * M, pt = o.pt ?? 0.25 * M;
  const mat = o.mat || 'roof_flat_gravel', wm = o.wall || 'concrete';
  g.hquad(mat, m.cx, y + 0.02 * M, m.cz, m.sx - 0.02 * M, m.sz - 0.02 * M);
  if (ph > 0) {
    const { cx, cz, sx, sz } = m;
    const sk = { skip: F.BOTTOM };
    g.box(wm, cx, y, cz + sz / 2 - pt / 2, sx, ph, pt, sk);
    g.box(wm, cx, y, cz - sz / 2 + pt / 2, sx, ph, pt, sk);
    g.box(wm, cx + sx / 2 - pt / 2, y, cz, pt, ph, sz - pt * 2, sk);
    g.box(wm, cx - sx / 2 + pt / 2, y, cz, pt, ph, sz - pt * 2, sk);
    if (g.detail >= 1 && o.coping !== null) {
      const cm = o.coping || 'metal_light', ct = 0.05 * M, co = 0.04 * M;
      g.box(cm, cx, y + ph, cz + sz / 2 - pt / 2, sx + co * 2, ct, pt + co * 2);
      g.box(cm, cx, y + ph, cz - sz / 2 + pt / 2, sx + co * 2, ct, pt + co * 2);
      g.box(cm, cx + sx / 2 - pt / 2, y + ph, cz, pt + co * 2, ct, sz - pt * 2, { skip: F.FRONT | F.BACK });
      g.box(cm, cx - sx / 2 + pt / 2, y + ph, cz, pt + co * 2, ct, sz - pt * 2, { skip: F.FRONT | F.BACK });
    }
  }
  return y + ph;
}

// Pultdach über einem Rechteck: hoch an der Seite 'hi' ('back' Standard), Neigung in Grad
export function shedRoof(g, o) {
  const { cx, cz, sx, sz, y0 } = o;
  const tan = Math.tan(((o.pitch ?? 12) * Math.PI) / 180);
  const oe = o.eave ?? 0.5 * M, ov = o.verge ?? 0.4 * M;
  const alongZ = o.hi === 'back' || o.hi === 'front' || !o.hi;
  const sgn = o.hi === 'front' || o.hi === 'right' ? 1 : -1;
  const span = alongZ ? sz : sx, len = alongZ ? sx : sz;
  const P = (L, y, S) => alongZ ? [cx + L, y, cz + sgn * S] : [cx + sgn * S, y, cz + L];
  const yLo = y0 - oe * tan, yHi = y0 + (span + oe) * tan;
  const top = [P(-len / 2 - ov, yLo, -span / 2 - oe), P(len / 2 + ov, yLo, -span / 2 - oe), P(len / 2 + ov, yHi, span / 2 + oe), P(-len / 2 - ov, yHi, span / 2 + oe)];
  roofSlab(g, [top], g.detail === 0 ? 0 : (o.t ?? 0.25 * M), { top: o.mat, under: o.under || 'wood_planks', edge: o.edge || 'trim_dark' });
  return { yLo: y0, yHi: y0 + span * tan, tan, alongZ, sgn, span };
}

// Dachaufbauten auf Flachdächern (Lüfter, Klimageräte, Treppenhaus, Aufzugsüberfahrt, Antennen)
export function rooftop(g, x, y, z, sx, sz, o = {}) {
  if (g.detail === 0) {
    if (o.stair) g.box(o.stairMat || 'concrete', x + sx * 0.2, y, z - sz * 0.15, 2.4 * M, 2.6 * M, 3.2 * M, { skip: NB });
    return;
  }
  const rng = g.rng;
  if (o.stair) {
    const sm = o.stairMat || 'concrete';
    const px = x + sx * 0.2, pz = z - sz * 0.15;
    g.box(sm, px, y, pz, 2.4 * M, 2.6 * M, 3.2 * M, { skip: NB });
    g.box('metal_light', px, y + 2.6 * M, pz, 2.6 * M, 0.06 * M, 3.4 * M);
    if (g.detail >= 2) g.box('door_wood', px, y, pz + 1.61 * M, 0.9 * M, 2.0 * M, 0.02 * M, { skip: NB });
  }
  const n = o.n ?? 3;
  for (let k = 0; k < n; k++) {
    const px = x + (rng() - 0.5) * sx * 0.65, pz = z + (rng() - 0.5) * sz * 0.65, t = rng();
    if (t < 0.35) { g.box('metal_light', px, y, pz, 1.3 * M, 0.9 * M, 0.9 * M, { skip: NB }); if (g.detail >= 2) g.box('metal_dark', px, y + 0.9 * M, pz, 0.7 * M, 0.06 * M, 0.7 * M); }
    else if (t < 0.6) { g.cyl('metal_light', px, y, pz, 0.3 * M, 0.7 * M, { seg: 7 }); if (g.detail >= 2) g.cyl('metal_dark', px, y + 0.7 * M, pz, 0.36 * M, 0.12 * M, { seg: 7, rTop: 0.1 * M }); }
    else if (t < 0.8) g.box('metal_panel_grey', px, y, pz, 1.8 * M, 1.1 * M, 1.0 * M, { skip: NB });
    else if (g.detail >= 2) { g.cyl('metal_dark', px, y, pz, 0.04 * M, 2.2 * M, { seg: 4, cap: false }); g.box('metal_dark', px, y + 1.6 * M, pz, 1.2 * M, 0.04 * M, 0.04 * M); g.box('metal_dark', px, y + 1.9 * M, pz, 0.8 * M, 0.04 * M, 0.04 * M); }
  }
  if (o.sat && g.detail >= 2) {
    const px = x - sx * 0.3, pz = z + sz * 0.2;
    g.cyl('metal_dark', px, y, pz, 0.03 * M, 0.9 * M, { seg: 4 });
    g.rbox('metal_light', px, y + 1.0 * M, pz + 0.1 * M, 0.8 * M, 0.8 * M, 0.06 * M, -0.5, 0, 0);
  }
}

// Wandmontierte Dachrinne für Flachdachbauten nicht nötig; Sat-Schüssel an der Wand
export function satDish(g, f, u, y) {
  if (g.detail < 2) return;
  const p = [f.ox + f.c * u + f.s * 0.35 * M, y, f.oz - f.s * u + f.c * 0.35 * M];
  g.rbox('metal_light', p[0], p[1], p[2], 0.6 * M, 0.6 * M, 0.05 * M, -0.35, f.ry + 0.4, 0);
  g.box('metal_dark', p[0] - f.s * 0.15 * M, y - 0.05 * M, p[2] - f.c * 0.15 * M, 0.05 * M, 0.05 * M, 0.3 * M, { ry: f.ry });
}

// Aufgeständerte Solarmodule auf einem Flachdach (Reihen, nach Süden geneigt → hier nach +z)
export function flatSolar(g, x, y, z, sx, sz, o = {}) {
  if (g.detail === 0) return;
  const rowD = 1.1 * M, gap = 0.7 * M;
  const n = Math.max(1, Math.floor(sz / (rowD + gap)));
  const tilt = 0.3;
  for (let k = 0; k < n; k++) {
    const zc = z - sz / 2 + (rowD + gap) * (k + 0.5);
    g.rbox('solar_panel', x, y + 0.35 * M, zc, sx, 0.05 * M, rowD, -tilt, 0, 0);
    if (g.detail >= 2) g.box('metal_light', x, y, zc - rowD * 0.35, sx * 0.98, 0.25 * M, 0.05 * M, { skip: F.BOTTOM });
  }
  void o;
}
