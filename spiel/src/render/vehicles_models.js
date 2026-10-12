// Fahrzeugmodelle für die Straße (Besitzer: G10). Maßstab 1 = 10 m, Ursprung = Mitte am Boden, Front nach +z,
// linke Fahrzeugseite = +x. Jedes Modell hat drei Detailstufen: 2 (nah), 1 (mittel), 0 (fern, gemeinsamer Kasten).
//
// MODELS[id] = { id, len, wid, hei, far: 'car'|'box'|'plain'|null, build(k, d), head: [[x,y,z]], tail: [[x,y,z]],
//               beacons: [[x,y,z,'blue'|'amber']], beam: bool }
// vehicleGeometry(id, detail) liefert die (zwischengespeicherte) Geometrie, z. B. für parkende Autos (G8).
import { VKit, P, VC as C, insetPoly, getVehicleMaterial } from './vehicles_kit.js';
import { RAIL_MODELS } from './vehicles_rail.js';
import { SEA_AIR_MODELS } from './vehicles_seaair.js';

export { getVehicleMaterial, C };
export const MODELS = {};
function def(id, o) { MODELS[id] = { id, far: 'car', beam: true, head: [], tail: [], beacons: [], ...o }; return MODELS[id]; }



// ---------------------------------------------------------------- Hilfen
function archPts(zc, r, yb, wy, n) {
  const ar = r + 0.006;
  const t0 = Math.asin(Math.max(-1, Math.min(1, (yb - wy) / ar)));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = (Math.PI - t0) + ((t0 - (Math.PI - t0)) * i) / n;
    out.push([zc + ar * Math.cos(a), wy + ar * Math.sin(a)]);
  }
  return out;
}

// Profil mit Radläufen: 'R'/'F' werden durch Bögen ersetzt (nur Detail 2)
function withArches(profile, S, d) {
  const pts = [], kinds = [];
  for (const p of profile) {
    if (p === 'R' || p === 'F') {
      if (d < 2) continue;
      const zc = p === 'R' ? S.axR : S.axF;
      for (const q of archPts(zc, S.wr, S.yb, S.wr, 5)) { pts.push(q); kinds.push('a'); }
      continue;
    }
    pts.push(p); kinds.push('b');
  }
  return { pts, kinds };
}

const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;

export function wheels(k, d, axles, x, r, w, o = {}) {
  const seg = d >= 2 ? 10 : 6;
  for (const z of axles) for (const s of [1, -1]) {
    const tw = (o.twin && z < 0) ? w * 1.7 : w;
    k.wheel(s * (x - tw / 2), r, z, r, tw, s, seg, o);
  }
}

function lightPair(k, z, y0, y1, x0, x1, part, color, dz = 0.012) {
  for (const s of [1, -1]) {
    const xa = s > 0 ? x0 : -x1, xb = s > 0 ? x1 : -x0;
    if (z > 0) k.box(xa, y0, z - dz, xb, y1, z + 0.0015, color, part);
    else k.box(xa, y0, z - 0.0015, xb, y1, z + dz, color, part);
  }
}

function indicators(k, z, y0, y1, x0, x1) {
  const dz = 0.008;
  if (z > 0) {
    k.box(x0, y0, z - dz, x1, y1, z + 0.0015, C.AMBER, P.IND_L);
    k.box(-x1, y0, z - dz, -x0, y1, z + 0.0015, C.AMBER, P.IND_R);
  } else {
    k.box(x0, y0, z - 0.0015, x1, y1, z + dz, C.AMBER, P.IND_L);
    k.box(-x1, y0, z - 0.0015, -x0, y1, z + dz, C.AMBER, P.IND_R);
  }
}

function plate(k, z, y, w = 0.052, h = 0.012) {
  const s = z > 0 ? 1 : -1;
  k.rectZ(s, z + s * 0.0018, -w / 2, w / 2, y, y + h, C.PLATE, P.PLASTIC);
}

function mirrors(k, x, y, z, color, part) {
  k.box(x - 0.003, y, z - 0.016, x + 0.013, y + 0.012, z, color, part);
  k.box(-x - 0.013, y, z - 0.016, -x + 0.003, y + 0.012, z, color, part);
}

// ---------------------------------------------------------------- Pkw
const CAR_STYLES = {
  compact: {
    L: 0.425, W: 0.179, wr: 0.031, yb: 0.028, axF: 0.1245, axR: -0.1385, cabT: 0.019, bp: [-0.045],
    body: [[-0.2125, 0.036], [-0.206, 0.028], 'R', 'F', [0.206, 0.028], [0.2125, 0.04], [0.2125, 0.058], [0.2, 0.075], [0.17, 0.084], [0.07, 0.095], [-0.203, 0.1], [-0.2125, 0.086]],
    cabin: [[-0.203, 0.1], [0.07, 0.095], [-0.022, 0.146], [-0.168, 0.143]],
    head: [0.06, 0.072, 0.042, 0.079], tail: [0.074, 0.088, 0.05, 0.084], plateR: 0.05,
  },
  sedan: {
    L: 0.475, W: 0.183, wr: 0.032, yb: 0.029, axF: 0.145, axR: -0.14, cabT: 0.02, bp: [-0.04],
    body: [[-0.2375, 0.04], [-0.23, 0.029], 'R', 'F', [0.23, 0.029], [0.2375, 0.04], [0.2375, 0.06], [0.225, 0.075], [0.19, 0.083], [0.085, 0.093], [-0.165, 0.097], [-0.216, 0.096], [-0.234, 0.09], [-0.2375, 0.072]],
    cabin: [[-0.165, 0.097], [0.085, 0.093], [0.0, 0.143], [-0.095, 0.142]],
    head: [0.06, 0.072, 0.045, 0.084], tail: [0.074, 0.088, 0.048, 0.086], plateR: 0.052,
  },
  kombi: {
    L: 0.48, W: 0.183, wr: 0.032, yb: 0.029, axF: 0.147, axR: -0.141, cabT: 0.019, bp: [-0.035, -0.15], rails: true,
    body: [[-0.24, 0.04], [-0.233, 0.029], 'R', 'F', [0.233, 0.029], [0.24, 0.04], [0.24, 0.06], [0.228, 0.075], [0.193, 0.083], [0.088, 0.094], [-0.228, 0.099], [-0.24, 0.088]],
    cabin: [[-0.228, 0.099], [0.088, 0.094], [0.0, 0.148], [-0.212, 0.146]],
    head: [0.06, 0.072, 0.045, 0.084], tail: [0.078, 0.094, 0.052, 0.086], plateR: 0.05,
  },
  suv: {
    L: 0.465, W: 0.19, wr: 0.037, yb: 0.04, axF: 0.142, axR: -0.137, cabT: 0.018, bp: [-0.04, -0.16], rails: true,
    body: [[-0.2325, 0.05], [-0.226, 0.04], 'R', 'F', [0.226, 0.04], [0.2325, 0.055], [0.2325, 0.078], [0.222, 0.095], [0.185, 0.104], [0.085, 0.113], [-0.215, 0.118], [-0.2325, 0.105]],
    cabin: [[-0.215, 0.118], [0.085, 0.113], [0.005, 0.168], [-0.2, 0.166]],
    head: [0.078, 0.092, 0.05, 0.088], tail: [0.095, 0.11, 0.055, 0.09], plateR: 0.062,
  },
  small: {
    L: 0.36, W: 0.165, wr: 0.029, yb: 0.028, axF: 0.112, axR: -0.115, cabT: 0.016, bp: [-0.03],
    body: [[-0.18, 0.035], [-0.174, 0.028], 'R', 'F', [0.174, 0.028], [0.18, 0.042], [0.18, 0.062], [0.165, 0.08], [0.13, 0.088], [0.075, 0.096], [-0.168, 0.1], [-0.18, 0.088]],
    cabin: [[-0.168, 0.1], [0.075, 0.096], [0.005, 0.15], [-0.15, 0.149]],
    head: [0.064, 0.078, 0.04, 0.072], tail: [0.074, 0.09, 0.046, 0.074], plateR: 0.05,
  },
  coupe: {
    L: 0.45, W: 0.185, wr: 0.032, yb: 0.024, axF: 0.14, axR: -0.13, cabT: 0.022, bp: [],
    body: [[-0.225, 0.034], [-0.218, 0.024], 'R', 'F', [0.218, 0.024], [0.225, 0.034], [0.225, 0.05], [0.21, 0.064], [0.17, 0.073], [0.06, 0.085], [-0.17, 0.089], [-0.21, 0.087], [-0.225, 0.078]],
    cabin: [[-0.17, 0.089], [0.06, 0.085], [-0.025, 0.127], [-0.09, 0.126]],
    head: [0.053, 0.063, 0.048, 0.088], tail: [0.066, 0.078, 0.05, 0.088], plateR: 0.046,
  },
};

// Baut einen Pkw. o: { color (Lack-Ecken-Farbe), part (PAINT|GLOSS), extra(k, d, S, info), band }
function buildCar(k, d, S, o = {}) {
  const color = o.color ?? 0xffffff, part = o.part ?? P.PAINT;
  const zf = S.L / 2, zr = -S.L / 2, hw = S.W / 2;
  const { pts, kinds } = withArches(S.body, S, d);
  const cab = S.cabin;
  const hwBody = S.W / 2, hwBodyT = S.W / 2 - 0.003;
  const bodyHw = k.prism(pts, hwBody, hwBodyT, color, part, {
    edge: (i, nz, ny, a, b) => {
      if (same(a, cab[1]) && same(b, cab[0])) return false;
      if (kinds[i] === 'a' && kinds[(i + 1) % kinds.length] === 'a') return { c: C.DARK, p: P.PLASTIC };
      return undefined;
    },
  });
  void bodyHw;
  const cabHwB = hwBodyT - 0.001, cabHwT = hwBodyT - S.cabT;
  const glassSide = d < 2;
  const cabHw = k.prism(cab, cabHwB, cabHwT, color, part, {
    edge: (i) => (i === 0 ? false : i === 1 || i === 3 ? { c: C.GLASS, p: P.GLASS } : undefined),
    side: glassSide ? { c: C.GLASS, p: P.GLASS } : undefined,
  });
  if (!glassSide) {
    const win = insetPoly(cab, 0.0068);
    for (const s of [1, -1]) {
      k.sidePoly(cabHw, win, s, C.GLASS, P.GLASS);
      for (const z of S.bp) {
        const y0 = Math.min(cab[0][1], cab[1][1]), y1 = cab[2][1];
        k.sidePoly(cabHw, [[z - 0.0045, y0], [z + 0.0045, y0], [z + 0.0045, y1], [z - 0.0045, y1]], s, color, part, 0.0022);
      }
    }
  }
  // Lichter
  const [hy0, hy1, hx0, hx1] = S.head;
  lightPair(k, zf, hy0, hy1, hx0, hx1, P.HEAD, C.HEAD, 0.018);
  const [ty0, ty1, tx0, tx1] = S.tail;
  lightPair(k, zr, ty0, ty1, tx0, tx1, P.TAIL, C.RED, 0.012);
  if (d >= 2) {
    // Kühlergrill, Lufteinlass, Kennzeichen, Spiegel, Blinker
    k.box(-hx0 + 0.006, hy0 - 0.006, zf - 0.012, hx0 - 0.006, hy1 - 0.002, zf + 0.0012, C.TRIM, P.PLASTIC);
    k.box(-0.05, S.yb + 0.006, zf - 0.01, 0.05, S.yb + 0.017, zf + 0.001, C.DARK, P.PLASTIC);
    plate(k, zf, S.yb + 0.019);
    plate(k, zr, S.plateR);
    indicators(k, zf, hy0 - 0.009, hy0 - 0.003, hx1 - 0.018, hx1 - 0.002);
    indicators(k, zr, ty0 - 0.008, ty0 - 0.002, tx1 - 0.02, tx1 - 0.002);
    k.box(-hw + 0.004, S.yb, zr - 0.002, hw - 0.004, S.yb + 0.012, zr + 0.01, C.TRIM, P.PLASTIC, { top: false });
    mirrors(k, cabHwB - 0.002, cab[1][1] + 0.002, cab[1][0] - 0.012, color, part);
    if (S.rails) for (const s of [1, -1]) k.box(s * (cabHwT - 0.006) - 0.003, cab[2][1], cab[3][0] + 0.01, s * (cabHwT - 0.006) + 0.003, cab[2][1] + 0.006, cab[2][0] - 0.01, C.TRIM, P.PLASTIC);
  }
  wheels(k, d, [S.axF, S.axR], hw - 0.001, S.wr, 0.023, {});
  if (o.extra) o.extra(k, d, S, { cabHw, zf, zr, roofY: cab[2][1], roofZ0: cab[3][0], roofZ1: cab[2][0], cabHwT });
}

function carDef(id, style, o = {}) {
  const S = CAR_STYLES[style];
  return def(id, {
    len: S.L, wid: S.W, hei: S.cabin[2][1], far: 'car',
    head: [[(S.head[2] + S.head[3]) / 2, (S.head[0] + S.head[1]) / 2, S.L / 2 + 0.004]],
    tail: [[(S.tail[2] + S.tail[3]) / 2, (S.tail[0] + S.tail[1]) / 2, -S.L / 2 - 0.004]],
    build: (k, d) => buildCar(k, d, S, o),
    ...o.def,
  });
}

carDef('car_compact', 'compact');
carDef('car_sedan', 'sedan');
carDef('car_kombi', 'kombi');
carDef('car_suv', 'suv');
carDef('car_small', 'small');
carDef('car_coupe', 'coupe');

// Taxi: Limousine in Hellelfenbein mit Dachschild
carDef('taxi', 'sedan', {
  color: 0xffffff, part: P.PAINT,
  extra: (k, d, S, info) => {
    const z = (info.roofZ0 + info.roofZ1) / 2;
    k.box(-0.03, info.roofY, z - 0.012, 0.03, info.roofY + 0.016, z + 0.012, 0xffd54a, P.SIGN);
    if (d >= 2) k.box(-0.032, info.roofY, z - 0.014, 0.032, info.roofY + 0.003, z + 0.014, C.DARK, P.PLASTIC);
  },
});

// Polizei: Kombi in Blau-Silber mit Lichtbalken
const POL_BLUE = 0x1f4f9c, POL_SILVER = 0xd7dbde;
function policeExtra(k, d, S, info) {
  const z = (info.roofZ0 + info.roofZ1) / 2 + 0.03;
  k.box(-0.062, info.roofY, z - 0.016, 0.062, info.roofY + 0.006, z + 0.016, C.DARK, P.PLASTIC);
  k.box(-0.06, info.roofY + 0.006, z - 0.013, 0.06, info.roofY + 0.016, z + 0.013, 0x7aa0ff, P.BLUE);
  if (d >= 2) {
    // blaue Türflächen und Motorhaube
    const zA = S.axR + S.wr + 0.012, zB = S.axF - S.wr - 0.012;
    for (const s of [1, -1]) k.rectX(s, S.W / 2 + 0.0012, S.yb + 0.012, 0.088, zA, zB, POL_BLUE, P.GLOSS);
    for (const s of [1, -1]) k.rectX(s, S.W / 2 + 0.0016, 0.07, 0.076, S.axR - 0.05, S.axF + 0.05, 0xd8f23a, P.GLOSS);
    // Frontblitzer
    k.box(-0.02, S.yb + 0.02, S.L / 2 - 0.004, 0.02, S.yb + 0.026, S.L / 2 + 0.002, 0x7aa0ff, P.BLUE);
  }
}
carDef('police', 'kombi', { color: POL_SILVER, part: P.GLOSS, extra: policeExtra, def: { beacons: [[0.045, 0.16, 0.0, 'blue'], [-0.045, 0.16, 0.0, 'blue']] } });

// Bestattungswagen: verlängerter schwarzer Kombi
def('hearse', {
  len: 0.53, wid: 0.185, hei: 0.15, far: 'car',
  head: [[0.06, 0.066, 0.268]], tail: [[0.06, 0.086, -0.268]],
  build: (k, d) => {
    k.push({ sz: 1.1 });
    buildCar(k, d, CAR_STYLES.kombi, {
      color: 0x18191b, part: P.GLOSS,
      extra: (k2, d2, S) => {
        if (d2 < 2) return;
        for (const s of [1, -1]) k2.rectX(s, S.W / 2 - 0.006, 0.1, 0.14, -0.2, -0.05, 0x3a3d40, P.PLASTIC);
        for (const s of [1, -1]) k2.rectX(s, S.W / 2 + 0.0014, 0.092, 0.095, -0.23, 0.2, C.CHROME, P.CHROME);
      },
    });
    k.pop();
  },
});

// ---------------------------------------------------------------- Transporter / Kleinbus
const VAN_S = { L: 0.52, W: 0.196, wr: 0.034, yb: 0.034, axF: 0.165, axR: -0.17 };
function buildVanBase(k, d, o = {}) {
  const S = VAN_S;
  const color = o.color ?? 0xffffff, part = o.part ?? P.PAINT;
  const zf = S.L / 2, zr = -S.L / 2, hw = S.W / 2;
  const prof = [[-0.26, 0.042], [-0.255, 0.034], 'R', 'F', [0.255, 0.034], [0.26, 0.046], [0.26, 0.07], [0.252, 0.09], [0.22, 0.104], [0.175, 0.113], [0.1, 0.205], [0.085, 0.218], [-0.25, 0.22], [-0.26, 0.21]];
  const { pts, kinds } = withArches(prof, S, d);
  const hwf = k.prism(pts, hw, hw - 0.006, color, part, {
    edge: (i, nz, ny, a, b) => {
      if (same(a, [0.175, 0.113]) && same(b, [0.1, 0.205])) return { c: C.GLASS, p: P.GLASS };
      if (kinds[i] === 'a' && kinds[(i + 1) % kinds.length] === 'a') return { c: C.DARK, p: P.PLASTIC };
      return undefined;
    },
  });
  // Fenster: Fahrerhaus, optional Fahrgastraum
  for (const s of [1, -1]) {
    k.sidePoly(hwf, [[0.16, 0.122], [0.09, 0.2], [0.03, 0.2], [0.03, 0.122]], s, C.GLASS, P.GLASS);
    if (o.windows) {
      k.sidePoly(hwf, [[0.015, 0.125], [0.015, 0.2], [-0.115, 0.2], [-0.115, 0.125]], s, C.GLASS, P.GLASS);
      k.sidePoly(hwf, [[-0.125, 0.125], [-0.125, 0.2], [-0.235, 0.2], [-0.235, 0.125]], s, C.GLASS, P.GLASS);
    }
  }
  if (o.rearWindow !== false) k.rectZ(-1, zr - 0.0012, -0.07, 0.07, 0.13, 0.2, C.GLASS, P.GLASS);
  lightPair(k, zf, 0.07, 0.084, 0.05, 0.088, P.HEAD, C.HEAD, 0.016);
  for (const s of [1, -1]) k.box(s > 0 ? 0.084 : -0.097, 0.07, zr - 0.0015, s > 0 ? 0.097 : -0.084, 0.13, zr + 0.01, C.RED, P.TAIL);
  if (d >= 2) {
    k.box(-0.045, 0.066, zf - 0.012, 0.045, 0.086, zf + 0.0012, C.TRIM, P.PLASTIC);
    k.box(-hw + 0.003, S.yb, zf - 0.012, hw - 0.003, S.yb + 0.022, zf + 0.0035, C.TRIM, P.PLASTIC);
    k.box(-hw + 0.003, S.yb, zr - 0.0035, hw - 0.003, S.yb + 0.018, zr + 0.01, C.TRIM, P.PLASTIC);
    plate(k, zf, S.yb + 0.005);
    plate(k, zr, S.yb + 0.022);
    indicators(k, zf, 0.06, 0.068, 0.07, 0.088);
    mirrors(k, hw - 0.004, 0.122, 0.16, C.TRIM, P.PLASTIC);
    for (const s of [1, -1]) k.rectX(s, hw - 0.006 + 0.0016, 0.05, 0.19, 0.0, 0.005, C.TRIM, P.PLASTIC);
  }
  wheels(k, d, [S.axF, S.axR], hw - 0.002, S.wr, 0.024);
  return hwf;
}

def('van', {
  len: 0.52, wid: 0.196, hei: 0.22, far: 'plain',
  head: [[0.07, 0.077, 0.264]], tail: [[0.09, 0.1, -0.264]],
  build: (k, d) => buildVanBase(k, d, { windows: false }),
});
def('minibus', {
  len: 0.52, wid: 0.196, hei: 0.22, far: 'plain',
  head: [[0.07, 0.077, 0.264]], tail: [[0.09, 0.1, -0.264]],
  build: (k, d) => buildVanBase(k, d, { windows: true }),
});
// Polizei-Bulli
def('police_van', {
  len: 0.52, wid: 0.196, hei: 0.24, far: 'plain',
  head: [[0.07, 0.077, 0.264]], tail: [[0.09, 0.1, -0.264]], beacons: [[0.05, 0.23, 0.07, 'blue'], [-0.05, 0.23, 0.07, 'blue']],
  build: (k, d) => {
    buildVanBase(k, d, { color: POL_SILVER, part: P.GLOSS, windows: true });
    k.box(-0.07, 0.22, 0.04, 0.07, 0.227, 0.1, C.DARK, P.PLASTIC);
    k.box(-0.068, 0.227, 0.05, 0.068, 0.238, 0.09, 0x7aa0ff, P.BLUE);
    if (d >= 2) for (const s of [1, -1]) {
      k.rectX(s, 0.0995, 0.045, 0.118, -0.13, 0.12, POL_BLUE, P.GLOSS);
      k.rectX(s, 0.0997, 0.1, 0.108, -0.255, 0.255, 0xd8f23a, P.GLOSS);
    }
  },
});

// ---------------------------------------------------------------- Lkw-Bausteine
// Frontlenker-Fahrerhaus: z1 = Front, z0 = Rückwand, hw halbe Breite, yb Unterkante, yt Dach
function cabOver(k, d, o) {
  const { z0, z1, hw, yb, yt } = o;
  const color = o.color ?? 0xffffff, part = o.part ?? P.PAINT;
  const yw = yb + (yt - yb) * 0.42; // Unterkante Frontscheibe
  const prof = [[z0, yb], [z1, yb], [z1, yb + 0.03], [z1 - 0.004, yw], [z1 - 0.016, yt - 0.012], [z1 - 0.03, yt], [z0, yt]];
  const hwf = k.prism(prof, hw, hw - 0.008, color, part, {
    edge: (i) => (i === 3 ? { c: C.GLASS, p: P.GLASS } : i === 0 ? false : undefined),
  });
  for (const s of [1, -1]) {
    k.sidePoly(hwf, [[z1 - 0.012, yw + 0.006], [z1 - 0.022, yt - 0.016], [z0 + (z1 - z0) * 0.45, yt - 0.016], [z0 + (z1 - z0) * 0.45, yw + 0.006]], s, C.GLASS, P.GLASS);
    if (o.crew) k.sidePoly(hwf, [[z0 + (z1 - z0) * 0.4, yw + 0.006], [z0 + (z1 - z0) * 0.4, yt - 0.016], [z0 + 0.012, yt - 0.016], [z0 + 0.012, yw + 0.006]], s, C.GLASS, P.GLASS);
  }
  // Stoßfänger, Grill, Scheinwerfer
  k.box(-hw - 0.002, yb - 0.012, z1 - 0.02, hw + 0.002, yb + 0.03, z1 + 0.006, o.bumper ?? C.TRIM, P.PLASTIC);
  lightPair(k, z1 + 0.006, yb + 0.006, yb + 0.022, hw - 0.05, hw - 0.012, P.HEAD, C.HEAD, 0.004);
  if (d >= 2) {
    k.box(-hw + 0.03, yb + 0.034, z1 - 0.01, hw - 0.03, yw - 0.008, z1 + 0.0004, o.grille ?? C.TRIM, P.PLASTIC);
    for (let y = yb + 0.04; y < yw - 0.012; y += 0.012) k.box(-hw + 0.032, y, z1, hw - 0.032, y + 0.004, z1 + 0.0016, C.CHROME, P.CHROME);
    indicators(k, z1 + 0.006, yb + 0.024, yb + 0.03, hw - 0.012, hw);
    // Spiegel an Auslegern
    for (const s of [1, -1]) {
      k.box(s * hw - 0.004, yw + 0.01, z1 - 0.03, s * hw + 0.004 + s * 0.012, yw + 0.016, z1 - 0.024, C.DARK, P.PLASTIC);
      const xm = s * (hw + 0.016);
      k.box(xm - 0.004, yw - 0.02, z1 - 0.034, xm + 0.004, yw + 0.04, z1 - 0.02, C.DARK, P.PLASTIC);
    }
    // Trittstufen
    for (const s of [1, -1]) k.box(s > 0 ? hw - 0.01 : -hw - 0.004, yb - 0.02, z1 - 0.07, s > 0 ? hw + 0.004 : -hw + 0.01, yb - 0.012, z1 - 0.03, C.DARK, P.PLASTIC);
  }
  return hwf;
}

function chassis(k, z0, z1, hw, y0, y1) {
  k.box(-hw, y0, z0, hw, y1, z1, C.DARK, P.PLASTIC, { top: false });
}

// Kofferaufbau mit Rücklichtern
function boxBody(k, d, o) {
  const { z0, z1, hw, yb, yt } = o;
  const col = o.color ?? 0xffffff, part = o.part ?? P.PAINT2;
  k.box(-hw, yb, z0, hw, yt, z1, col, part, { back: { c: o.backColor ?? col, p: part } });
  if (d >= 2) {
    // Kanten-Profile
    for (const s of [1, -1]) {
      k.box(s * hw - 0.003, yb, z0 - 0.002, s * hw + 0.003, yt + 0.002, z0 + 0.006, C.LGREY, P.CHROME);
      k.box(s * hw - 0.003, yb, z1 - 0.004, s * hw + 0.003, yt + 0.002, z1 + 0.002, C.LGREY, P.CHROME);
      k.box(s * hw - 0.002, yt - 0.006, z0, s * hw + 0.002, yt + 0.002, z1, C.LGREY, P.CHROME);
    }
    // Hecktüren-Fuge
    k.rectZ(-1, z0 - 0.0012, -0.002, 0.002, yb + 0.01, yt - 0.01, C.TRIM, P.PLASTIC);
    // Unterfahrschutz
    k.box(-hw + 0.01, yb - 0.04, z0 - 0.004, hw - 0.01, yb - 0.028, z0 + 0.004, C.DARK, P.PLASTIC);
    if (o.stripe !== undefined) for (const s of [1, -1]) k.rectX(s, hw + 0.0012, yb + 0.02, yb + 0.045, z0 + 0.02, z1 - 0.02, o.stripe, P.GLOSS);
  }
  for (const s of [1, -1]) k.box(s > 0 ? hw - 0.04 : -hw + 0.008, yb - 0.035, z0 - 0.003, s > 0 ? hw - 0.008 : -hw + 0.04, yb - 0.018, z0 + 0.004, C.RED, P.TAIL);
}

// ---------------------------------------------------------------- Lkw
def('truck_box', {
  len: 0.84, wid: 0.25, hei: 0.36, far: 'plain',
  head: [[0.085, 0.07, 0.43]], tail: [[0.095, 0.083, -0.425]],
  build: (k, d) => {
    const hw = 0.125;
    cabOver(k, d, { z0: 0.235, z1: 0.42, hw, yb: 0.06, yt: 0.32 });
    chassis(k, -0.4, 0.24, 0.085, 0.04, 0.07);
    boxBody(k, d, { z0: -0.42, z1: 0.225, hw: hw + 0.002, yb: 0.105, yt: 0.36, stripe: undefined });
    wheels(k, d, [0.3, -0.2], hw - 0.004, 0.047, 0.032, { twin: true });
  },
});

// Sattelzugmaschine (Anhänger kommt separat)
def('truck_tractor', {
  len: 0.6, wid: 0.25, hei: 0.37, far: 'plain',
  head: [[0.085, 0.07, 0.31]], tail: [[0.09, 0.07, -0.3]],
  build: (k, d) => {
    const hw = 0.125;
    cabOver(k, d, { z0: 0.07, z1: 0.3, hw, yb: 0.065, yt: 0.355 });
    if (d >= 2) {
      // Dachspoiler, Auspuff, Tanks
      k.prism([[0.08, 0.355], [0.25, 0.355], [0.08, 0.4]], hw - 0.01, hw - 0.03, 0xffffff, P.PAINT);
      k.cyl('y', [0.113, 0.3, 0.06], 0.008, 0.2, 6, C.CHROME, P.CHROME);
      for (const s of [1, -1]) k.cyl('z', [s * 0.1, 0.07, -0.02], 0.026, 0.12, 8, C.CHROME, P.CHROME, { ry: 0.9 });
      k.cyl('y', [0, 0.072, -0.17], 0.06, 0.012, 10, 0x30343a, P.PLASTIC);
    }
    chassis(k, -0.3, 0.08, 0.085, 0.04, 0.072);
    k.box(-0.11, 0.04, -0.3, 0.11, 0.06, -0.27, C.DARK, P.PLASTIC);
    wheels(k, d, [0.21, -0.17], hw - 0.004, 0.047, 0.032, { twin: true });
  },
});

// Auflieger: Ursprung = Mitte, Länge 1.32, Königszapfen bei z = +0.56
def('trailer_box', {
  len: 1.32, wid: 0.255, hei: 0.4, far: 'plain', beam: false,
  tail: [[0.1, 0.085, -0.665]],
  build: (k, d) => {
    const hw = 0.1275;
    boxBody(k, d, { z0: -0.66, z1: 0.66, hw, yb: 0.115, yt: 0.4, stripe: d >= 2 ? undefined : undefined });
    chassis(k, -0.62, 0.6, 0.09, 0.07, 0.115);
    if (d >= 2) {
      for (const s of [1, -1]) k.box(s * hw - 0.004, 0.06, -0.3, s * hw + 0.002, 0.1, 0.3, 0x3a3e44, P.PLASTIC);
      k.box(-0.06, 0.0, 0.25, -0.05, 0.08, 0.26, C.DARK, P.PLASTIC);
      k.box(0.05, 0.0, 0.25, 0.06, 0.08, 0.26, C.DARK, P.PLASTIC);
    }
    wheels(k, d, [-0.36, -0.48, -0.6], hw - 0.004, 0.044, 0.05);
  },
});

def('trailer_tank', {
  len: 1.24, wid: 0.25, hei: 0.37, far: 'plain', beam: false,
  tail: [[0.1, 0.085, -0.625]],
  build: (k, d) => {
    const seg = d >= 2 ? 14 : 8;
    k.cyl('z', [0, 0.245, -0.02], 0.12, 1.16, seg, 0xd9dde0, P.CHROME, { ry: 1.05 });
    if (d >= 2) {
      for (const z of [-0.4, 0.0, 0.38]) k.cyl('z', [0, 0.245, z], 0.123, 0.012, seg, 0xa8adb2, P.CHROME, { ry: 1.05, capA: false, capB: false });
      k.box(-0.03, 0.37, -0.5, 0.03, 0.378, 0.45, C.GREY, P.PLASTIC);
      k.box(-0.11, 0.1, -0.64, 0.11, 0.115, -0.6, C.DARK, P.PLASTIC);
      k.rectZ(-1, -0.605, -0.04, 0.04, 0.2, 0.235, 0xf2a01e, P.GLOSS);
    }
    chassis(k, -0.62, 0.56, 0.09, 0.07, 0.12);
    for (const s of [1, -1]) k.box(s > 0 ? 0.06 : -0.09, 0.06, -0.635, s > 0 ? 0.09 : -0.06, 0.085, -0.62, C.RED, P.TAIL);
    wheels(k, d, [-0.36, -0.48], 0.121, 0.044, 0.05);
  },
});

def('trailer_container', {
  len: 1.3, wid: 0.25, hei: 0.4, far: 'plain', beam: false,
  tail: [[0.1, 0.085, -0.655]],
  build: (k, d) => {
    const hw = 0.122;
    k.box(-hw, 0.125, -0.62, hw, 0.385, 0.6, 0xffffff, P.PAINT2);
    if (d >= 2) {
      for (let z = -0.6; z < 0.6; z += 0.03) for (const s of [1, -1]) k.rectX(s, hw + 0.001, 0.13, 0.38, z, z + 0.012, 0xc4c4c4, P.PAINT2);
      k.rectZ(-1, -0.6215, -hw + 0.01, hw - 0.01, 0.13, 0.38, 0xa8a8a8, P.PAINT2);
    }
    k.box(-0.11, 0.09, -0.64, 0.11, 0.125, 0.62, C.DARK, P.PLASTIC);
    for (const s of [1, -1]) k.box(s > 0 ? 0.07 : -0.1, 0.06, -0.645, s > 0 ? 0.1 : -0.07, 0.085, -0.63, C.RED, P.TAIL);
    wheels(k, d, [-0.36, -0.48, -0.6], hw - 0.004, 0.044, 0.05);
  },
});

// Tankwagen (Solo-Lkw)
def('tanker', {
  len: 0.9, wid: 0.25, hei: 0.34, far: 'plain',
  head: [[0.085, 0.07, 0.46]], tail: [[0.09, 0.083, -0.45]],
  build: (k, d) => {
    const hw = 0.125;
    cabOver(k, d, { z0: 0.27, z1: 0.45, hw, yb: 0.06, yt: 0.32 });
    chassis(k, -0.44, 0.28, 0.085, 0.04, 0.075);
    const seg = d >= 2 ? 14 : 8;
    k.cyl('z', [0, 0.2, -0.08], 0.11, 0.66, seg, 0xdfe2e4, P.CHROME, { ry: 1.0 });
    if (d >= 2) {
      for (const z of [-0.3, -0.08, 0.14]) k.cyl('z', [0, 0.2, z], 0.113, 0.012, seg, 0xa8adb2, P.CHROME, { capA: false, capB: false });
      k.box(-0.025, 0.31, -0.35, 0.025, 0.318, 0.2, C.GREY, P.PLASTIC);
      for (const s of [1, -1]) k.rectX(s, 0.1135, 0.17, 0.2, -0.35, 0.15, 0xf2a01e, P.GLOSS);
    }
    for (const s of [1, -1]) k.box(s > 0 ? 0.07 : -0.105, 0.065, -0.445, s > 0 ? 0.105 : -0.07, 0.085, -0.43, C.RED, P.TAIL);
    wheels(k, d, [0.33, -0.22, -0.34], hw - 0.004, 0.047, 0.032, { twin: true });
  },
});

// Müllwagen (kommunalorange, Hecklader)
def('garbage', {
  len: 0.92, wid: 0.25, hei: 0.34, far: 'plain',
  head: [[0.085, 0.07, 0.47]], tail: [[0.1, 0.1, -0.47]], beacons: [[0.07, 0.33, 0.33, 'amber'], [-0.07, 0.33, 0.33, 'amber'], [0.08, 0.36, -0.42, 'amber']],
  build: (k, d) => {
    const hw = 0.125, OR = 0xe8731c;
    // Niederflur-Fahrerhaus mit großer Scheibe
    cabOver(k, d, { z0: 0.26, z1: 0.46, hw, yb: 0.04, yt: 0.31, color: OR, part: P.GLOSS, crew: true });
    k.box(-0.06, 0.31, 0.33, 0.06, 0.322, 0.36, 0xffb030, P.AMBER);
    chassis(k, -0.45, 0.27, 0.085, 0.04, 0.075);
    // Aufbau mit abgerundetem Dach
    const sec = [[-0.124, 0.085], [0.124, 0.085], [0.124, 0.3], [0.105, 0.33], [-0.105, 0.33], [-0.124, 0.3]];
    k.extrudeZ(sec, -0.32, 0.25, OR, P.GLOSS, { capB: false });
    if (d >= 2) {
      for (const s of [1, -1]) k.rectX(s, 0.1252, 0.12, 0.14, -0.31, 0.24, 0xf2f2ee, P.GLOSS);
      for (let z = -0.28; z < 0.24; z += 0.09) for (const s of [1, -1]) k.rectX(s, 0.1253, 0.09, 0.3, z, z + 0.006, 0xc5621a, P.GLOSS);
    }
    // Schüttung (Heck)
    k.prism([[-0.47, 0.06], [-0.32, 0.06], [-0.32, 0.34], [-0.38, 0.34], [-0.47, 0.22]], 0.12, 0.12, 0x5a5f66, P.PLASTIC, {
      edge: (i) => (i === 4 ? { c: 0x3a3e44, p: P.PLASTIC } : undefined),
    });
    if (d >= 2) {
      k.box(-0.1, 0.05, -0.475, 0.1, 0.1, -0.45, C.DARK, P.PLASTIC);
      k.box(-0.11, 0.035, -0.46, 0.11, 0.045, -0.4, C.DARK, P.PLASTIC);
      k.rectZ(-1, -0.4705, -0.11, 0.11, 0.07, 0.085, 0xe6402a, P.GLOSS);
      k.box(0.06, 0.34, -0.43, 0.09, 0.355, -0.4, 0xffb030, P.AMBER);
    }
    for (const s of [1, -1]) k.box(s > 0 ? 0.09 : -0.115, 0.08, -0.472, s > 0 ? 0.115 : -0.09, 0.13, -0.462, C.RED, P.TAIL);
    wheels(k, d, [0.33, -0.2, -0.32], hw - 0.004, 0.047, 0.032, { twin: true });
  },
});

// Feuerwehr: Löschgruppenfahrzeug (LF) und Drehleiter (DLK)
const FIRE_RED = 0xb4231c;
function fireBody(k, d, o) {
  const hw = 0.125;
  const { z0, zc, z1 } = o;
  cabOver(k, d, { z0: zc, z1, hw, yb: 0.065, yt: 0.31, color: FIRE_RED, part: P.GLOSS, crew: true, bumper: 0xe9e9e4 });
  chassis(k, z0 + 0.02, zc + 0.02, 0.085, 0.04, 0.08);
  k.box(-hw, 0.09, z0, hw, o.top, zc - 0.01, FIRE_RED, P.GLOSS);
  // weißer Streifen unten, Rollläden
  if (d >= 2) {
    for (const s of [1, -1]) {
      k.rectX(s, hw + 0.0012, 0.095, 0.115, z0 + 0.005, z1 - 0.01, 0xf3f3ee, P.GLOSS);
      k.rectX(s, hw + 0.0012, 0.071, 0.077, zc + 0.01, z1 - 0.01, 0xf3f3ee, P.GLOSS);
      const n = 3, seg = (zc - 0.02 - z0) / n;
      for (let j = 0; j < n; j++) {
        const za = z0 + 0.012 + j * seg, zb = za + seg - 0.012;
        k.rectX(s, hw + 0.0014, 0.125, o.top - 0.02, za, zb, 0xbfc4c9, P.CHROME);
      }
    }
    // Blaulicht vorne im Grill + Heck
    k.box(-0.08, 0.1, z1 + 0.004, -0.06, 0.112, z1 + 0.008, 0x7aa0ff, P.BLUE);
    k.box(0.06, 0.1, z1 + 0.004, 0.08, 0.112, z1 + 0.008, 0x7aa0ff, P.BLUE);
    k.box(-hw + 0.01, o.top, z0 + 0.005, -hw + 0.035, o.top + 0.018, z0 + 0.03, 0x7aa0ff, P.BLUE);
    k.box(hw - 0.035, o.top, z0 + 0.005, hw - 0.01, o.top + 0.018, z0 + 0.03, 0x7aa0ff, P.BLUE);
  }
  // Blaulichtbalken auf dem Fahrerhaus
  k.box(-0.1, 0.31, z1 - 0.07, 0.1, 0.318, z1 - 0.035, C.DARK, P.PLASTIC);
  k.box(-0.095, 0.318, z1 - 0.066, 0.095, 0.33, z1 - 0.039, 0x7aa0ff, P.BLUE);
  for (const s of [1, -1]) k.box(s > 0 ? 0.09 : -0.115, 0.1, z0 - 0.003, s > 0 ? 0.115 : -0.09, 0.14, z0 + 0.004, C.RED, P.TAIL);
}

def('fire', {
  len: 0.86, wid: 0.25, hei: 0.34, far: 'plain',
  head: [[0.085, 0.077, 0.44]], tail: [[0.1, 0.12, -0.435]], beacons: [[0.06, 0.33, 0.37, 'blue'], [-0.06, 0.33, 0.37, 'blue'], [0.1, 0.34, -0.42, 'blue'], [-0.1, 0.34, -0.42, 'blue']],
  build: (k, d) => {
    fireBody(k, d, { z0: -0.43, zc: 0.18, z1: 0.43, top: 0.33 });
    if (d >= 2) {
      // Dachbeladung: Steckleiter, Kasten
      k.box(-0.05, 0.33, -0.4, 0.05, 0.338, 0.12, C.CHROME, P.CHROME);
      for (let z = -0.38; z < 0.12; z += 0.04) k.box(-0.05, 0.338, z, 0.05, 0.342, z + 0.006, C.CHROME, P.CHROME);
      k.box(0.06, 0.33, -0.3, 0.115, 0.35, 0.1, 0xd0d3d6, P.PLASTIC);
    }
    wheels(k, d, [0.29, -0.2], 0.121, 0.048, 0.032, { twin: true });
  },
});

def('fire_ladder', {
  len: 1.0, wid: 0.25, hei: 0.36, far: 'plain',
  head: [[0.085, 0.077, 0.51]], tail: [[0.1, 0.12, -0.505]], beacons: [[0.06, 0.33, 0.44, 'blue'], [-0.06, 0.33, 0.44, 'blue']],
  build: (k, d) => {
    fireBody(k, d, { z0: -0.5, zc: 0.27, z1: 0.5, top: 0.24 });
    // Drehkranz und Leiterpaket
    k.cyl('y', [0, 0.25, -0.38], 0.07, 0.04, d >= 2 ? 12 : 6, C.LGREY, P.PLASTIC);
    k.box(-0.055, 0.28, -0.5, 0.055, 0.3, 0.42, 0xd5d8db, P.CHROME);
    if (d >= 2) {
      for (const s of [1, -1]) k.box(s * 0.055 - 0.006, 0.3, -0.5, s * 0.055 + 0.006, 0.325, 0.42, 0xd5d8db, P.CHROME);
      for (let z = -0.48; z < 0.42; z += 0.035) k.box(-0.05, 0.3, z, 0.05, 0.306, z + 0.007, 0xbfc3c7, P.CHROME);
      k.box(-0.04, 0.28, 0.4, 0.04, 0.33, 0.46, 0xc9ccd0, P.PLASTIC);
    }
    wheels(k, d, [0.36, -0.2, -0.32], 0.121, 0.048, 0.032, { twin: true });
  },
});

// Rettungswagen (RTW)
def('ambulance', {
  len: 0.68, wid: 0.22, hei: 0.29, far: 'plain',
  head: [[0.07, 0.077, 0.345]], tail: [[0.095, 0.1, -0.345]], beacons: [[0.08, 0.29, 0.14, 'blue'], [-0.08, 0.29, 0.14, 'blue'], [0.08, 0.29, -0.33, 'blue'], [-0.08, 0.29, -0.33, 'blue']],
  build: (k, d) => {
    const hw = 0.11, WH = 0xf4f4ef, RO = 0xe8412a;
    // Fahrerhaus (Transporter-Front)
    const prof = [[0.12, 0.034], [0.335, 0.034], [0.34, 0.048], [0.34, 0.075], [0.33, 0.095], [0.3, 0.11], [0.25, 0.12], [0.175, 0.215], [0.12, 0.22]];
    const hwf = k.prism(prof, 0.098, 0.093, WH, P.GLOSS, { edge: (i) => (i === 6 ? { c: C.GLASS, p: P.GLASS } : undefined) });
    for (const s of [1, -1]) k.sidePoly(hwf, [[0.235, 0.128], [0.17, 0.205], [0.13, 0.205], [0.13, 0.128]], s, C.GLASS, P.GLASS);
    // Kofferaufbau
    k.box(-hw, 0.05, -0.34, hw, 0.28, 0.12, WH, P.GLOSS, { front: { c: WH } });
    for (const s of [1, -1]) {
      k.rectX(s, hw + 0.0012, 0.12, 0.15, -0.335, 0.115, RO, P.GLOSS);
      k.rectX(s, 0.0985, 0.075, 0.095, 0.125, 0.33, RO, P.GLOSS);
      if (d >= 2) {
        k.rectX(s, hw + 0.0014, 0.17, 0.235, -0.12, -0.02, C.GLASS, P.GLASS);
        k.rectX(s, hw + 0.0014, 0.155, 0.165, -0.335, 0.115, 0xf2c21a, P.GLOSS);
      }
    }
    k.rectZ(-1, -0.3412, -0.1, 0.1, 0.12, 0.15, RO, P.GLOSS);
    // Blaulichter (Ecken des Koffers) und Frontblitzer
    for (const [x, z] of [[0.08, 0.1], [-0.08, 0.1], [0.08, -0.32], [-0.08, -0.32]]) k.box(x - 0.022, 0.28, z - 0.012, x + 0.022, 0.296, z + 0.012, 0x7aa0ff, P.BLUE);
    lightPair(k, 0.34, 0.07, 0.084, 0.05, 0.088, P.HEAD, C.HEAD, 0.016);
    for (const s of [1, -1]) k.box(s > 0 ? 0.085 : -0.105, 0.06, -0.3415, s > 0 ? 0.105 : -0.085, 0.13, -0.335, C.RED, P.TAIL);
    if (d >= 2) {
      k.box(-0.045, 0.066, 0.329, 0.045, 0.086, 0.3412, C.TRIM, P.PLASTIC);
      k.box(-0.02, 0.09, 0.336, 0.02, 0.098, 0.343, 0x7aa0ff, P.BLUE);
      k.box(-0.097, 0.034, 0.32, 0.097, 0.056, 0.344, C.TRIM, P.PLASTIC);
      plate(k, 0.344, 0.04);
      mirrors(k, 0.094, 0.13, 0.25, C.TRIM, P.PLASTIC);
      indicators(k, 0.341, 0.06, 0.068, 0.07, 0.088);
      k.rectZ(-1, -0.3413, -0.002, 0.002, 0.06, 0.27, C.TRIM, P.PLASTIC);
    }
    wheels(k, d, [0.22, -0.2], 0.106, 0.035, 0.026, { twin: true });
  },
});

// Kofferwagen (Umzug, Lieferdienst)
def('van_box', {
  len: 0.64, wid: 0.21, hei: 0.29, far: 'plain',
  head: [[0.07, 0.077, 0.325]], tail: [[0.09, 0.09, -0.325]],
  build: (k, d) => {
    const prof = [[0.1, 0.034], [0.315, 0.034], [0.32, 0.048], [0.32, 0.075], [0.31, 0.095], [0.28, 0.11], [0.23, 0.12], [0.155, 0.215], [0.1, 0.22]];
    const hwf = k.prism(prof, 0.098, 0.093, 0xffffff, P.PAINT, { edge: (i) => (i === 6 ? { c: C.GLASS, p: P.GLASS } : undefined) });
    for (const s of [1, -1]) k.sidePoly(hwf, [[0.215, 0.128], [0.15, 0.205], [0.11, 0.205], [0.11, 0.128]], s, C.GLASS, P.GLASS);
    boxBody(k, d, { z0: -0.32, z1: 0.1, hw: 0.105, yb: 0.075, yt: 0.29, color: 0xffffff, part: P.PAINT2, stripe: d >= 2 ? 0xd9d9d4 : undefined });
    lightPair(k, 0.32, 0.07, 0.084, 0.05, 0.088, P.HEAD, C.HEAD, 0.016);
    if (d >= 2) {
      k.box(-0.045, 0.066, 0.309, 0.045, 0.086, 0.3212, C.TRIM, P.PLASTIC);
      k.box(-0.097, 0.034, 0.3, 0.097, 0.056, 0.324, C.TRIM, P.PLASTIC);
      plate(k, 0.324, 0.04);
      mirrors(k, 0.094, 0.13, 0.23, C.TRIM, P.PLASTIC);
      indicators(k, 0.321, 0.06, 0.068, 0.07, 0.088);
    }
    chassis(k, -0.3, 0.12, 0.07, 0.03, 0.075);
    wheels(k, d, [0.2, -0.19], 0.1, 0.034, 0.026, { twin: true });
  },
});

// Winterdienst: Lkw mit Räumschild und Streuer
def('snowplow', {
  len: 0.9, wid: 0.26, hei: 0.34, far: 'plain',
  head: [[0.085, 0.07, 0.43]], tail: [[0.09, 0.09, -0.4]], beacons: [[0.07, 0.33, 0.33, 'amber'], [-0.07, 0.33, 0.33, 'amber']],
  build: (k, d) => {
    const hw = 0.125, OR = 0xe8731c;
    cabOver(k, d, { z0: 0.23, z1: 0.42, hw, yb: 0.06, yt: 0.32, color: OR, part: P.GLOSS });
    k.box(-0.08, 0.32, 0.31, 0.08, 0.334, 0.35, 0xffb030, P.AMBER);
    chassis(k, -0.39, 0.24, 0.085, 0.04, 0.075);
    // Streuer-Aufbau (Trichter)
    k.prism([[-0.39, 0.09], [0.2, 0.09], [0.2, 0.3], [-0.39, 0.3]], 0.12, 0.105, 0x585d63, P.PLASTIC);
    if (d >= 2) {
      k.box(-0.1, 0.3, -0.37, 0.1, 0.31, 0.18, 0x3a3e44, P.PLASTIC);
      k.cyl('y', [0, 0.06, -0.41], 0.05, 0.012, 10, C.DARK, P.PLASTIC);
    }
    for (const s of [1, -1]) k.box(s > 0 ? 0.09 : -0.115, 0.08, -0.392, s > 0 ? 0.115 : -0.09, 0.11, -0.386, C.RED, P.TAIL);
    // Räumschild (schräg, gelb-orange mit Warnstreifen)
    k.group({ z: 0.49, y: 0.0, ry: 0.25 }, () => {
      k.prism([[-0.02, 0.01], [0.015, 0.01], [0.03, 0.11], [0.005, 0.12], [-0.01, 0.06]], 0.17, 0.17, 0xf2b01e, P.GLOSS);
      if (d >= 2) for (let x = -0.16; x < 0.16; x += 0.05) k.box(x, 0.012, 0.014, x + 0.022, 0.03, 0.022, 0xd8261c, P.GLOSS);
    });
    wheels(k, d, [0.3, -0.22], hw - 0.004, 0.05, 0.034, { twin: true });
  },
});

// ---------------------------------------------------------------- Bus (12 m)
def('bus', {
  len: 1.2, wid: 0.255, hei: 0.31, far: 'box',
  head: [[0.1, 0.073, 0.602]], tail: [[0.112, 0.12, -0.602]],
  build: (k, d) => {
    const S = { wr: 0.048, yb: 0.035, axF: 0.33, axR: -0.26 };
    const hw = 0.1275, hwT = 0.122;
    const prof = [[-0.6, 0.045], [-0.595, 0.035], 'R', 'F', [0.595, 0.035], [0.6, 0.05], [0.6, 0.11], [0.596, 0.17], [0.588, 0.272], [0.578, 0.298], [0.55, 0.306], [-0.585, 0.306], [-0.598, 0.292], [-0.6, 0.27]];
    const { pts, kinds } = withArches(prof, S, d);
    const CR = 0xf0ebdc;
    const sideHw = k.prism(pts, hw, hwT, 0xffffff, P.PAINT, {
      edge: (i, nz, ny, a, b) => {
        if (kinds[i] === 'a' && kinds[(i + 1) % kinds.length] === 'a') return { c: C.DARK, p: P.PLASTIC };
        if ((same(a, [0.6, 0.11]) && same(b, [0.596, 0.17])) || (same(a, [0.596, 0.17]) && same(b, [0.588, 0.272]))) return { c: C.GLASS, p: P.GLASS };
        if (same(a, [0.588, 0.272])) return { c: C.DARK, p: P.PLASTIC };
        if (ny > 0.9) return { c: CR, p: P.GLOSS };
        if (same(a, [0.578, 0.298]) || same(a, [-0.585, 0.306])) return { c: CR, p: P.GLOSS };
        return undefined;
      },
    });
    const yW0 = 0.128, yW1 = 0.272;
    const doors = [[0.445, 0.555], [-0.1, 0.02]];
    for (const s of [1, -1]) {
      // obere Zierleiste in Creme
      k.sidePoly(sideHw, [[-0.598, yW1], [0.586, yW1], [0.578, 0.298], [-0.598, 0.298]], s, CR, P.GLOSS, 0.0012);
      // Fensterband
      const segs = [];
      if (s > 0) segs.push([-0.57, 0.57]);
      else {
        let z = -0.57;
        for (const [a, b] of doors.slice().reverse()) { if (a > z) segs.push([z, a - 0.008]); z = b + 0.008; }
        segs.push([z, 0.57]);
      }
      for (const [za, zb] of segs) k.sidePoly(sideHw, [[za, yW0], [zb, yW0], [zb, yW1 - 0.004], [za, yW1 - 0.004]], s, C.CABIN, P.CABIN, 0.0016);
      if (d >= 2) {
        for (let z = -0.45; z < 0.56; z += 0.15) {
          if (s < 0 && doors.some(([a, b]) => z > a - 0.02 && z < b + 0.02)) continue;
          k.sidePoly(sideHw, [[z - 0.004, yW0], [z + 0.004, yW0], [z + 0.004, yW1 - 0.004], [z - 0.004, yW1 - 0.004]], s, C.DARK, P.GLOSS, 0.0024);
        }
        // Seitliche Zielanzeige
        if (s < 0) k.sidePoly(sideHw, [[0.35, 0.236], [0.43, 0.236], [0.43, 0.262], [0.35, 0.262]], s, C.SIGN, P.SIGN, 0.0028);
      }
      // Türen (rechte Seite = -x)
      if (s < 0) for (const [a, b] of doors) {
        k.sidePoly(sideHw, [[a - 0.006, 0.042], [b + 0.006, 0.042], [b + 0.006, yW1 + 0.004], [a - 0.006, yW1 + 0.004]], s, C.DARK, P.PLASTIC, 0.0014);
        const m = (a + b) / 2;
        k.sidePoly(sideHw, [[a, 0.048], [m - 0.002, 0.048], [m - 0.002, yW1 - 0.002], [a, yW1 - 0.002]], s, C.CABIN, P.CABIN, 0.0024);
        k.sidePoly(sideHw, [[m + 0.002, 0.048], [b, 0.048], [b, yW1 - 0.002], [m + 0.002, yW1 - 0.002]], s, C.CABIN, P.CABIN, 0.0024);
      }
    }
    // Front: Zielanzeige, Scheinwerfer, Spiegel
    k.box(-0.1, 0.276, 0.582, 0.1, 0.293, 0.5855, C.SIGN, P.SIGN);
    k.box(-0.118, 0.06, 0.594, -0.082, 0.086, 0.6015, C.HEAD, P.HEAD);
    k.box(0.082, 0.06, 0.594, 0.118, 0.086, 0.6015, C.HEAD, P.HEAD);
    // Heck: Scheibe, Anzeige, Rücklichter
    k.rectZ(-1, -0.6012, -0.1, 0.1, 0.17, 0.262, C.GLASS, P.GLASS);
    k.rectZ(-1, -0.6014, -0.06, 0.06, 0.244, 0.258, C.SIGN, P.SIGN);
    for (const s of [1, -1]) k.box(s > 0 ? 0.104 : -0.124, 0.05, -0.6015, s > 0 ? 0.124 : -0.104, 0.2, -0.594, C.RED, P.TAIL);
    // Dach: Klimaanlage
    k.box(-0.085, 0.306, -0.05, 0.085, 0.33, 0.24, 0xd6d9dc, P.PLASTIC);
    if (d >= 2) {
      k.box(-0.07, 0.306, -0.42, 0.07, 0.318, -0.3, 0xd6d9dc, P.PLASTIC);
      k.box(-0.11, 0.035, 0.59, 0.11, 0.055, 0.603, C.TRIM, P.PLASTIC);
      plate(k, 0.6025, 0.039);
      plate(k, -0.6025, 0.06);
      indicators(k, 0.6015, 0.088, 0.096, 0.1, 0.118);
      // „Hasenohren"-Spiegel
      for (const s of [1, -1]) {
        k.box(s * 0.128 - 0.003, 0.27, 0.57, s * 0.128 + 0.003 + s * 0.02, 0.276, 0.578, C.DARK, P.PLASTIC);
        const xm = s * 0.15;
        k.box(xm - 0.005, 0.2, 0.6, xm + 0.005, 0.276, 0.612, C.DARK, P.PLASTIC);
      }
    }
    wheels(k, d, [S.axF, S.axR], hw - 0.002, S.wr, 0.03, { twin: true });
  },
});

// Gelenkbus-Hinterwagen wird nicht gebraucht – Busse sind 12 m.

// ---------------------------------------------------------------- Fernansicht-Kästen (Detail 0)
// Einheitsgröße 1×1×1, werden pro Instanz auf Breite × Höhe × Länge skaliert.
def('far_car', {
  len: 1, wid: 1, hei: 1, far: null,
  build: (k) => {
    k.box(-0.5, 0.18, -0.5, 0.5, 0.62, 0.5, 0xffffff, P.PAINT, { front: { c: 0xffffff }, back: { c: 0xffffff } });
    k.prism([[-0.42, 0.62], [0.25, 0.62], [0.02, 1.0], [-0.36, 1.0]], 0.48, 0.38, 0xffffff, P.PAINT, {
      edge: (i) => (i === 0 ? false : i === 1 || i === 3 ? { c: C.GLASS, p: P.GLASS } : undefined),
      side: { c: C.GLASS, p: P.GLASS },
    });
    k.rectZ(1, 0.502, -0.45, -0.18, 0.38, 0.52, C.HEAD, P.HEAD);
    k.rectZ(1, 0.502, 0.18, 0.45, 0.38, 0.52, C.HEAD, P.HEAD);
    k.rectZ(-1, -0.502, -0.45, -0.2, 0.42, 0.56, C.RED, P.TAIL);
    k.rectZ(-1, -0.502, 0.2, 0.45, 0.42, 0.56, C.RED, P.TAIL);
    k.box(-0.47, 0.0, -0.36, 0.47, 0.2, 0.36, C.DARK, P.RUBBER, { top: false, front: false, back: false });
  },
});
def('far_box', {
  len: 1, wid: 1, hei: 1, far: null,
  build: (k) => {
    k.box(-0.5, 0.1, -0.5, 0.5, 1.0, 0.5, 0xffffff, P.PAINT);
    for (const s of [1, -1]) k.rectX(s, 0.502, 0.42, 0.86, -0.46, 0.46, C.CABIN, P.CABIN);
    k.rectZ(1, 0.502, -0.44, 0.44, 0.42, 0.9, C.GLASS, P.GLASS);
    k.rectZ(1, 0.503, -0.44, -0.24, 0.18, 0.3, C.HEAD, P.HEAD);
    k.rectZ(1, 0.503, 0.24, 0.44, 0.18, 0.3, C.HEAD, P.HEAD);
    k.rectZ(-1, -0.502, -0.46, -0.3, 0.18, 0.5, C.RED, P.TAIL);
    k.rectZ(-1, -0.502, 0.3, 0.46, 0.18, 0.5, C.RED, P.TAIL);
    k.box(-0.47, 0.0, -0.4, 0.47, 0.1, 0.4, C.DARK, P.RUBBER, { top: false });
  },
});
def('far_plain', {
  len: 1, wid: 1, hei: 1, far: null,
  build: (k) => {
    k.box(-0.5, 0.12, -0.5, 0.5, 1.0, 0.5, 0xffffff, P.PAINT);
    k.rectZ(1, 0.502, -0.44, 0.44, 0.6, 0.9, C.GLASS, P.GLASS);
    k.rectZ(1, 0.503, -0.44, -0.26, 0.2, 0.3, C.HEAD, P.HEAD);
    k.rectZ(1, 0.503, 0.26, 0.44, 0.2, 0.3, C.HEAD, P.HEAD);
    k.rectZ(-1, -0.502, -0.46, -0.32, 0.18, 0.32, C.RED, P.TAIL);
    k.rectZ(-1, -0.502, 0.32, 0.46, 0.18, 0.32, C.RED, P.TAIL);
    k.box(-0.47, 0.0, -0.42, 0.47, 0.12, 0.42, C.DARK, P.RUBBER, { top: false });
  },
});

// Schiene, See, Luft
Object.assign(MODELS, RAIL_MODELS, SEA_AIR_MODELS);
for (const [id, m] of Object.entries(MODELS)) m.id = id;

// ---------------------------------------------------------------- Geometrie-Zwischenspeicher
const cache = new Map();
export function vehicleGeometry(id, detail = 2) {
  const key = id + '|' + detail;
  if (cache.has(key)) return cache.get(key);
  const m = MODELS[id];
  if (!m) return null;
  const k = new VKit(detail);
  m.build(k, detail);
  const geo = k.build();
  cache.set(key, geo);
  return geo;
}

// Realistische Lackfarben (Häufigkeit wie auf deutschen Straßen)
export const CAR_PAINTS = [
  [0x6f747a, 9], [0x8a9096, 8], [0x4f5359, 7], [0x1e2022, 10], [0x2b2d31, 6], [0xeef0ee, 9], [0xf4f2ec, 5],
  [0xb9bec3, 6], [0xa3a8ad, 4], [0x2c4f7c, 4], [0x3e6c9e, 3], [0x1f3352, 3], [0x9e2b25, 3], [0xb93a2c, 2],
  [0x2f5d46, 2], [0xc2b59b, 2], [0xd8a93a, 1], [0xc9672e, 1], [0x6a4a35, 1], [0x5d7f8f, 1],
];
const paintTotal = CAR_PAINTS.reduce((s, p) => s + p[1], 0);
export function carPaint(u) {
  let r = u * paintTotal;
  for (const [c, w] of CAR_PAINTS) { r -= w; if (r <= 0) return c; }
  return CAR_PAINTS[0][0];
}
export const CAR_TYPES = [['car_compact', 28], ['car_sedan', 16], ['car_kombi', 20], ['car_suv', 16], ['car_small', 12], ['car_coupe', 5], ['minibus', 3]];
const typeTotal = CAR_TYPES.reduce((s, p) => s + p[1], 0);
export function carType(u) {
  let r = u * typeTotal;
  for (const [t, w] of CAR_TYPES) { r -= w; if (r <= 0) return t; }
  return CAR_TYPES[0][0];
}
