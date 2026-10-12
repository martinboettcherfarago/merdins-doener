// Schienenfahrzeuge (Besitzer: G10): Pulsbahn-Hochbahnwagen, Straßenbahn, Lok, Reisezugwagen, Güterwagen.
// Maßstab 1 = 10 m, Ursprung = Mitte auf Schienenoberkante, Front nach +z.
// Standardlängen (wenn ein System `len` mitgibt, wird entlang z darauf skaliert):
//   metro_* 0.5 · tram 2.4 · train_loco 1.9 · train_wagon 2.6 · cargo_* 1.8
import { P, VC as C } from './vehicles_kit.js';

export const RAIL_MODELS = {};
function def(id, o) { RAIL_MODELS[id] = { id, far: 'box', beam: false, head: [], tail: [], beacons: [], rail: true, ...o }; }

// ---------------------------------------------------------------- Pulsbahn (Hochbahn)
const MW = 0.13; // halbe Breite
const MSEC = [[-MW, 0.03], [MW, 0.03], [MW, 0.19], [0.122, 0.222], [0.1, 0.24], [-0.1, 0.24], [-0.122, 0.222], [-MW, 0.19]];
const MBODY = 0xf2f3f1;

function metroBody(k, d, z0, z1, cabF, cabB) {
  // Wagenkasten
  k.extrudeZ(MSEC, z0, z1, MBODY, P.GLOSS, {
    edge: (i) => (i === 0 ? false : i >= 3 && i <= 5 ? { c: 0xd8dbde, p: P.PLASTIC } : undefined),
    capF: { c: 0x3a3e44, p: P.PLASTIC },
    capB: { c: 0x3a3e44, p: P.PLASTIC },
  });
  // Fahrwerk und Schürze
  k.box(-0.122, -0.005, z0 + 0.01, 0.122, 0.03, z1 - 0.01, 0x30343a, P.PLASTIC, { top: false });
  if (d >= 2) {
    for (const zb of [z0 + 0.09, z1 - 0.09]) {
      k.box(-0.1, -0.03, zb - 0.055, 0.1, 0.0, zb + 0.055, 0x24272b, P.PLASTIC, { top: false });
      for (const s of [1, -1]) for (const dz of [-0.032, 0.032]) k.cyl('x', [s * 0.095, -0.012, zb + dz], 0.022, 0.012, 8, 0x55595f, P.CHROME);
    }
    // Dachaufbauten (Klima)
    k.box(-0.06, 0.24, (z0 + z1) / 2 - 0.08, 0.06, 0.258, (z0 + z1) / 2 + 0.08, 0xc9cdd1, P.PLASTIC);
  }
  // Übergänge (Faltenbalg)
  if (!cabF) k.box(-0.085, 0.035, z1, 0.085, 0.215, z1 + 0.02, 0x2a2d31, P.PLASTIC);
  if (!cabB) k.box(-0.085, 0.035, z0 - 0.02, 0.085, 0.215, z0, 0x2a2d31, P.PLASTIC);
  // Fensterband, Türen, Linienstreifen
  const za = z0 + 0.015, zb = z1 - 0.015;
  const doors = [];
  const L = z1 - z0;
  const nd = L > 0.42 ? 2 : 1;
  for (let j = 0; j < nd; j++) doors.push(z0 + (L * (j + 0.5)) / nd);
  for (const s of [1, -1]) {
    let z = za;
    const segs = [];
    for (const dc of doors) { segs.push([z, dc - 0.045]); z = dc + 0.045; }
    segs.push([z, zb]);
    for (const [a, b] of segs) {
      if (b - a < 0.01) continue;
      k.rectX(s, MW + 0.0012, 0.105, 0.19, a, b, C.CABIN, P.CABIN);
      k.rectX(s, MW + 0.0012, 0.068, 0.09, a, b, 0xffffff, P.PAINT);
      if (d >= 2) for (let q = a + 0.075; q < b - 0.02; q += 0.075) k.rectX(s, MW + 0.0018, 0.105, 0.19, q - 0.003, q + 0.003, 0xd9dcdf, P.GLOSS);
    }
    for (const dc of doors) {
      k.rectX(s, MW + 0.0012, 0.035, 0.205, dc - 0.042, dc + 0.042, 0xffffff, P.PAINT);
      k.rectX(s, MW + 0.0018, 0.042, 0.198, dc - 0.036, dc - 0.002, C.CABIN, P.CABIN);
      k.rectX(s, MW + 0.0018, 0.042, 0.198, dc + 0.002, dc + 0.036, C.CABIN, P.CABIN);
    }
  }
}

// Führerstand-Bug: zA = Ansatz, zE = Spitze (zE > zA → vorne, sonst hinten)
function metroNose(k, d, zA, zE) {
  const sgn = zE > zA ? 1 : -1;
  const f = (dz) => zA + sgn * dz;
  const prof = [[zA, 0.03], [zE, 0.03], [zE, 0.1], [f(0.018), 0.225], [zA, 0.24]];
  if (sgn < 0) prof.reverse();
  k.prism(prof, MW, 0.1, MBODY, P.GLOSS, {
    yb: 0.19, yt: 0.24,
    edge: (i, nz, ny, a, b) => {
      const isA = (p) => Math.abs(p[0] - zA) < 1e-6;
      if (isA(a) && isA(b)) return false;
      if (ny < -0.9) return false;
      if (Math.abs(a[0] - zE) < 1e-6 && Math.abs(b[0] - zE) < 1e-6) return { c: 0xffffff, p: P.PAINT };
      if (Math.min(a[1], b[1]) >= 0.099 && Math.max(a[1], b[1]) <= 0.226) return { c: C.GLASS, p: P.GLASS };
      return undefined;
    },
  });
  // Lichter: innen Scheinwerfer, außen Schlusslicht (Bahn-Modus schaltet je nach Fahrtrichtung)
  const zl = zE + sgn * 0.0015;
  for (const s of [1, -1]) {
    const x0 = s > 0 ? 0.05 : -0.085, x1 = s > 0 ? 0.085 : -0.05;
    k.rectZ(sgn, zl, x0, x1, 0.05, 0.066, C.HEAD, P.HEAD);
    const t0 = s > 0 ? 0.092 : -0.112, t1 = s > 0 ? 0.112 : -0.092;
    k.rectZ(sgn, zl, t0, t1, 0.05, 0.066, C.RED, P.TAIL);
  }
  if (d >= 2) {
    k.rectZ(sgn, zl, -0.04, 0.04, 0.072, 0.09, C.SIGN, P.SIGN);
    k.box(-0.11, -0.005, Math.min(zA, zE + sgn * 0.0), 0.11, 0.03, Math.max(zA, zE), 0x30343a, P.PLASTIC, { top: false });
  }
}

def('metro_single', {
  len: 0.5, wid: 0.26, hei: 0.25,
  head: [[0.068, 0.058, 0.252]], tail: [[0.102, 0.058, -0.252]],
  build: (k, d) => { metroBody(k, d, -0.2, 0.2, true, true); metroNose(k, d, 0.2, 0.25); metroNose(k, d, -0.2, -0.25); },
});
def('metro_cab', {
  len: 0.5, wid: 0.26, hei: 0.25,
  head: [[0.068, 0.058, 0.252]],
  build: (k, d) => { metroBody(k, d, -0.25, 0.2, true, false); metroNose(k, d, 0.2, 0.25); },
});
def('metro_mid', {
  len: 0.5, wid: 0.26, hei: 0.25,
  build: (k, d) => { metroBody(k, d, -0.25, 0.25, false, false); },
});

// ---------------------------------------------------------------- Straßenbahn (Niederflur, 5 Module)
const TW = 0.12;
const TSEC = [[-TW, 0.04], [TW, 0.04], [TW, 0.262], [0.112, 0.29], [0.09, 0.305], [-0.09, 0.305], [-0.112, 0.29], [-TW, 0.262]];
def('tram', {
  len: 2.4, wid: 0.24, hei: 0.34, far: 'box', beam: true,
  head: [[0.07, 0.07, 1.2]], tail: [[0.095, 0.07, -1.2]],
  build: (k, d) => {
    const WH = 0xf1efe8, L2 = 1.2;
    k.extrudeZ(TSEC, -L2 + 0.07, L2 - 0.07, WH, P.GLOSS, { edge: (i) => (i === 0 ? false : i >= 3 && i <= 5 ? { c: 0xd5d8db, p: P.PLASTIC } : undefined), capF: { c: 0x3a3e44, p: P.PLASTIC }, capB: { c: 0x3a3e44, p: P.PLASTIC } });
    for (const sgn of [1, -1]) {
      const zA = sgn * (L2 - 0.07), zE = sgn * L2;
      const prof = [[zA, 0.04], [zE, 0.04], [zE, 0.12], [zA + sgn * 0.035, 0.29], [zA, 0.305]];
      if (sgn < 0) prof.reverse();
      k.prism(prof, TW, 0.09, 0xffffff, P.PAINT, {
        yb: 0.262, yt: 0.305,
        edge: (i, nz, ny, a, b) => {
          if (Math.abs(a[0] - zA) < 1e-6 && Math.abs(b[0] - zA) < 1e-6) return false;
          if (ny < -0.9) return false;
          if (Math.min(a[1], b[1]) >= 0.119) return Math.max(a[1], b[1]) > 0.3 ? undefined : { c: C.GLASS, p: P.GLASS };
          return undefined;
        },
      });
      const zl = zE + sgn * 0.0015;
      for (const s of [1, -1]) {
        k.rectZ(sgn, zl, s > 0 ? 0.05 : -0.085, s > 0 ? 0.085 : -0.05, 0.06, 0.078, C.HEAD, P.HEAD);
        k.rectZ(sgn, zl, s > 0 ? 0.09 : -0.11, s > 0 ? 0.11 : -0.09, 0.06, 0.078, C.RED, P.TAIL);
      }
      k.rectZ(sgn, zA + sgn * 0.037, -0.06, 0.06, 0.265, 0.283, C.SIGN, P.SIGN);
    }
    // Module: Fensterband, Türen, Gelenke
    const joints = [-0.72, -0.24, 0.24, 0.72];
    const doorsZ = [-0.96, -0.48, 0.0, 0.48, 0.96];
    for (const s of [1, -1]) {
      k.rectX(s, TW + 0.0012, 0.045, 0.1, -L2 + 0.07, L2 - 0.07, 0xffffff, P.PAINT);
      const cuts = [...joints.map((z) => [z - 0.022, z + 0.022]), ...doorsZ.map((z) => [z - 0.06, z + 0.06])].sort((a, b) => a[0] - b[0]);
      let z = -L2 + 0.08;
      for (const [a, b] of cuts) { if (a > z) k.rectX(s, TW + 0.0016, 0.115, 0.255, z, a, C.CABIN, P.CABIN); z = Math.max(z, b); }
      if (z < L2 - 0.08) k.rectX(s, TW + 0.0016, 0.115, 0.255, z, L2 - 0.08, C.CABIN, P.CABIN);
      for (const jz of joints) k.rectX(s, TW + 0.002, 0.045, 0.3, jz - 0.018, jz + 0.018, 0x2a2d31, P.PLASTIC);
      for (const dz of doorsZ) {
        k.rectX(s, TW + 0.002, 0.045, 0.262, dz - 0.056, dz + 0.056, 0x3a3e44, P.PLASTIC);
        k.rectX(s, TW + 0.0026, 0.05, 0.256, dz - 0.052, dz - 0.002, C.CABIN, P.CABIN);
        k.rectX(s, TW + 0.0026, 0.05, 0.256, dz + 0.002, dz + 0.052, C.CABIN, P.CABIN);
      }
    }
    k.box(-0.11, 0.0, -L2 + 0.05, 0.11, 0.04, L2 - 0.05, 0x30343a, P.PLASTIC, { top: false });
    // Stromabnehmer (Einholm)
    k.box(-0.07, 0.305, -0.08, 0.07, 0.318, 0.08, 0x9aa0a6, P.PLASTIC);
    if (d >= 2) {
      k.group({ y: 0.318, rx: -0.5 }, () => k.box(-0.006, 0, -0.005, 0.006, 0.006, 0.12, C.DARK, P.PLASTIC));
      k.box(-0.06, 0.37, 0.09, 0.06, 0.376, 0.1, C.DARK, P.PLASTIC);
      for (const z of [-0.6, 0.6]) k.box(-0.05, 0.305, z - 0.08, 0.05, 0.322, z + 0.08, 0xc9cdd1, P.PLASTIC);
    }
  },
});

// ---------------------------------------------------------------- Fernbahn
const LW = 0.15;
const LSEC = [[-LW, 0.06], [LW, 0.06], [LW, 0.31], [0.142, 0.35], [0.115, 0.37], [-0.115, 0.37], [-0.142, 0.35], [-LW, 0.31]];

function bogie(k, d, z, hw = 0.12) {
  k.box(-hw, 0.0, z - 0.14, hw, 0.06, z + 0.14, 0x26292d, P.PLASTIC, { top: false });
  if (d >= 2) for (const s of [1, -1]) for (const dz of [-0.09, 0.09]) k.cyl('x', [s * (hw - 0.005), 0.042, z + dz], 0.042, 0.014, 10, 0x4a4e54, P.CHROME, { capA: s < 0 ? {} : false, capB: s > 0 ? {} : false });
}

// Lok-Führerstand (eine Seite)
function locoCab(k, d, zA, zE, col) {
  const sgn = zE > zA ? 1 : -1;
  const f = (dz) => zA + sgn * dz;
  const prof = [[zA, 0.06], [zE, 0.06], [zE, 0.2], [f(0.075), 0.32], [f(0.04), 0.37], [zA, 0.37]];
  if (sgn < 0) prof.reverse();
  k.prism(prof, LW, 0.115, col.c, col.p, {
    yb: 0.31, yt: 0.37,
    edge: (i, nz, ny, a, b) => {
      if (Math.abs(a[0] - zA) < 1e-6 && Math.abs(b[0] - zA) < 1e-6) return false;
      if (ny < -0.9) return false;
      if (Math.min(a[1], b[1]) >= 0.199 && Math.max(a[1], b[1]) <= 0.321) return { c: C.GLASS, p: P.GLASS };
      return undefined;
    },
  });
  const zl = zE + sgn * 0.0015;
  for (const s of [1, -1]) {
    k.rectZ(sgn, zl, s > 0 ? 0.06 : -0.1, s > 0 ? 0.1 : -0.06, 0.1, 0.122, C.HEAD, P.HEAD);
    k.rectZ(sgn, zl, s > 0 ? 0.105 : -0.13, s > 0 ? 0.13 : -0.105, 0.1, 0.122, C.RED, P.TAIL);
  }
  if (d >= 2) {
    k.rectZ(sgn, zl, -0.12, 0.12, 0.13, 0.15, 0xf2f2ee, P.GLOSS);
    k.box(-0.13, 0.04, Math.min(zE, zE + sgn * 0.03), 0.13, 0.07, Math.max(zE, zE + sgn * 0.03), C.DARK, P.PLASTIC);
  }
}

def('train_loco', {
  len: 1.9, wid: 0.3, hei: 0.44,
  head: [[0.08, 0.11, 0.952]], tail: [[0.118, 0.11, -0.952]],
  build: (k, d) => {
    const col = { c: 0xffffff, p: P.PAINT };
    k.extrudeZ(LSEC, -0.82, 0.82, col.c, col.p, { edge: (i) => (i === 0 ? false : i >= 3 && i <= 5 ? { c: 0x6c7279, p: P.PLASTIC } : undefined), capF: { c: 0x3a3e44, p: P.PLASTIC }, capB: { c: 0x3a3e44, p: P.PLASTIC } });
    locoCab(k, d, 0.82, 0.95, col);
    locoCab(k, d, -0.82, -0.95, col);
    for (const s of [1, -1]) {
      k.rectX(s, LW + 0.0012, 0.07, 0.11, -0.9, 0.9, 0xe9e9e4, P.GLOSS);
      if (d >= 2) {
        for (let z = -0.55; z <= 0.55; z += 0.18) k.rectX(s, LW + 0.0014, 0.2, 0.29, z - 0.07, z + 0.07, 0x3a3e44, P.PLASTIC);
        for (const z of [-0.74, 0.74]) k.rectX(s, LW + 0.0014, 0.2, 0.3, z - 0.025, z + 0.025, C.GLASS, P.GLASS);
      }
    }
    for (const z of [-0.6, 0.6]) bogie(k, d, z, 0.135);
    // Dach: Stromabnehmer
    k.box(-0.08, 0.37, -0.25, 0.08, 0.39, 0.25, 0x9aa0a6, P.PLASTIC);
    if (d >= 2) for (const z of [-0.55, 0.55]) {
      k.box(-0.06, 0.37, z - 0.06, 0.06, 0.38, z + 0.06, C.DARK, P.PLASTIC);
      k.group({ y: 0.38, z, rx: z > 0 ? 0.35 : -0.35 }, () => k.box(-0.004, 0, -0.004, 0.004, 0.004, z > 0 ? -0.14 : 0.14, C.DARK, P.PLASTIC));
      k.box(-0.07, 0.43, z + (z > 0 ? -0.14 : 0.14) - 0.006, 0.07, 0.436, z + (z > 0 ? -0.14 : 0.14) + 0.006, C.DARK, P.PLASTIC);
    }
  },
});

// Reisezugwagen (IC-Stil): weiß mit Farbstreifen
def('train_wagon', {
  len: 2.6, wid: 0.29, hei: 0.4,
  build: (k, d) => {
    const WW = 0.145, WH = 0xeceeec;
    const sec = [[-WW, 0.07], [WW, 0.07], [WW, 0.3], [0.138, 0.34], [0.11, 0.36], [-0.11, 0.36], [-0.138, 0.34], [-WW, 0.3]];
    k.extrudeZ(sec, -1.28, 1.28, WH, P.GLOSS, { edge: (i) => (i === 0 ? false : i >= 3 && i <= 5 ? { c: 0xb9bdc1, p: P.PLASTIC } : undefined), capF: { c: 0x3a3e44, p: P.PLASTIC }, capB: { c: 0x3a3e44, p: P.PLASTIC } });
    for (const s of [1, -1]) {
      k.rectX(s, WW + 0.0012, 0.12, 0.145, -1.26, 1.26, 0xffffff, P.PAINT);
      k.rectX(s, WW + 0.0012, 0.17, 0.28, -1.05, 1.05, C.CABIN, P.CABIN);
      if (d >= 2) for (let z = -1.05 + 0.15; z < 1.05; z += 0.15) k.rectX(s, WW + 0.0018, 0.17, 0.28, z - 0.006, z + 0.006, 0xd5d8db, P.GLOSS);
      for (const z of [-1.17, 1.17]) {
        k.rectX(s, WW + 0.0016, 0.08, 0.29, z - 0.045, z + 0.045, 0x9aa0a6, P.PLASTIC);
        k.rectX(s, WW + 0.0022, 0.18, 0.27, z - 0.025, z + 0.025, C.GLASS, P.GLASS);
      }
    }
    for (const z of [-1.28, 1.28]) k.box(-0.095, 0.08, Math.min(z, z + Math.sign(z) * 0.025), 0.095, 0.32, Math.max(z, z + Math.sign(z) * 0.025), 0x2a2d31, P.PLASTIC);
    k.box(-0.13, 0.03, -1.25, 0.13, 0.07, 1.25, 0x30343a, P.PLASTIC, { top: false });
    for (const z of [-0.92, 0.92]) bogie(k, d, z, 0.13);
    if (d >= 2) for (const z of [-0.5, 0.5]) k.box(-0.07, 0.36, z - 0.12, 0.07, 0.38, z + 0.12, 0xc9cdd1, P.PLASTIC);
  },
});

// Güterwagen
function flatFrame(k, d, L2) {
  k.box(-0.13, 0.08, -L2, 0.13, 0.11, L2, 0x4a3a30, P.PLASTIC);
  for (const z of [-L2 + 0.25, L2 - 0.25]) bogie(k, d, z, 0.12);
  if (d >= 2) for (const z of [-L2, L2]) k.box(-0.12, 0.06, Math.min(z, z + Math.sign(z) * 0.02), 0.12, 0.1, Math.max(z, z + Math.sign(z) * 0.02), C.DARK, P.PLASTIC);
}
// Güterwagen in zwei Längen (lang 1.8, kurz 0.9 – für Systeme mit kurzen Zügen)
for (const [suf, L2] of [['', 0.9], ['_s', 0.45]]) {
  def('cargo_container' + suf, {
    len: L2 * 2, wid: 0.26, hei: 0.37, far: 'plain',
    build: (k, d) => {
      flatFrame(k, d, L2);
      const boxes = L2 > 0.6 ? [[-L2 / 2 + 0.01, 0], [L2 / 2 - 0.01, 1]] : [[0, 0]];
      const hl = L2 > 0.6 ? L2 / 2 - 0.03 : L2 - 0.04;
      for (const [z, ci] of boxes) {
        const pp = ci === 0 ? P.PAINT : P.PAINT2;
        k.box(-0.122, 0.11, z - hl, 0.122, 0.37, z + hl, 0xffffff, pp);
        if (d >= 2) {
          for (let q = z - hl + 0.02; q < z + hl - 0.02; q += 0.035) for (const s of [1, -1]) k.rectX(s, 0.1232, 0.118, 0.362, q, q + 0.012, 0xc4c4c4, pp);
          k.rectZ(1, z + hl + 0.001, -0.115, 0.115, 0.118, 0.362, 0xa8a8a8, pp);
          k.rectZ(-1, z - hl - 0.001, -0.115, 0.115, 0.118, 0.362, 0xa8a8a8, pp);
          for (const s of [1, -1]) k.rectZ(s, z + s * (hl + 0.0015), -0.004, 0.004, 0.118, 0.362, 0x707070, pp);
        }
      }
    },
  });
  def('cargo_box' + suf, {
    len: L2 * 2, wid: 0.28, hei: 0.4, far: 'plain',
    build: (k, d) => {
      flatFrame(k, d, L2);
      const sec = [[-0.14, 0.11], [0.14, 0.11], [0.14, 0.36], [0.1, 0.4], [-0.1, 0.4], [-0.14, 0.36]];
      k.extrudeZ(sec, -L2 + 0.02, L2 - 0.02, 0x8a3a2c, P.PLASTIC, { edge: (i) => (i === 0 ? false : i >= 2 && i <= 4 ? { c: 0x9aa0a6, p: P.PLASTIC } : undefined) });
      if (d >= 2) for (const s of [1, -1]) for (let z = -L2 + 0.1; z < L2 - 0.05; z += 0.2) k.rectX(s, 0.1412, 0.12, 0.35, z - 0.004, z + 0.004, 0x5a2a22, P.PLASTIC);
    },
  });
  def('cargo_tank' + suf, {
    len: L2 * 2, wid: 0.27, hei: 0.4, far: 'plain',
    build: (k, d) => {
      flatFrame(k, d, L2);
      k.cyl('z', [0, 0.255, 0], 0.135, L2 * 2 - 0.1, d >= 2 ? 14 : 8, 0x2b2e33, P.GLOSS, { ry: 1.0 });
      if (d >= 2) {
        k.cyl('y', [0, 0.39, 0], 0.035, 0.03, 8, 0x3a3e44, P.PLASTIC);
        for (const s of [1, -1]) k.rectX(s, 0.1365, 0.25, 0.29, -L2 * 0.35, L2 * 0.35, 0xf2a01e, P.GLOSS);
      }
    },
  });
  def('cargo_hopper' + suf, {
    len: L2 * 2, wid: 0.28, hei: 0.36, far: 'plain',
    build: (k, d) => {
      flatFrame(k, d, L2);
      const e = L2 - 0.02, m = L2 * 0.7;
      k.prism([[-e, 0.36], [-e, 0.2], [-m, 0.11], [m, 0.11], [e, 0.2], [e, 0.36]].reverse(), 0.14, 0.14, 0x5d6a74, P.PLASTIC, {});
      k.rectY(0.335, -0.13, 0.13, -e + 0.02, e - 0.02, 0x1e1e1f, P.PLASTIC);
      if (d >= 2) for (const s of [1, -1]) for (let z = -e + 0.1; z < e - 0.05; z += 0.3) k.rectX(s, 0.1412, 0.12, 0.36, z - 0.006, z + 0.006, 0x4a555e, P.PLASTIC);
    },
  });
}

// Rangierlok (kurz, Mittelführerhaus), für kurze Güterzüge
def('train_loco_s', {
  len: 1.0, wid: 0.29, hei: 0.44,
  head: [[0.07, 0.15, 0.5]], tail: [[0.1, 0.15, -0.5]],
  build: (k, d) => {
    k.box(-0.135, 0.07, -0.48, 0.135, 0.11, 0.48, 0x2a2d31, P.PLASTIC);
    k.box(-0.11, 0.11, -0.47, 0.11, 0.33, 0.12, 0xffffff, P.PAINT);
    k.box(-0.11, 0.11, 0.34, 0.11, 0.3, 0.47, 0xffffff, P.PAINT);
    k.box(-0.14, 0.11, 0.12, 0.14, 0.43, 0.34, 0xffffff, P.PAINT);
    k.box(-0.15, 0.43, 0.1, 0.15, 0.45, 0.36, 0x3a3e44, P.PLASTIC);
    for (const s of [1, -1]) k.rectX(s, 0.1412, 0.3, 0.4, 0.14, 0.32, C.GLASS, P.GLASS);
    k.rectZ(1, 0.3412, -0.12, 0.12, 0.3, 0.4, C.GLASS, P.GLASS);
    k.rectZ(-1, 0.1188, -0.12, 0.12, 0.34, 0.4, C.GLASS, P.GLASS);
    for (const sgn of [1, -1]) {
      const z = sgn * 0.47 + sgn * 0.0015;
      for (const s of [1, -1]) {
        k.rectZ(sgn, z, s > 0 ? 0.05 : -0.08, s > 0 ? 0.08 : -0.05, 0.14, 0.16, C.HEAD, P.HEAD);
        k.rectZ(sgn, z, s > 0 ? 0.085 : -0.105, s > 0 ? 0.105 : -0.085, 0.14, 0.16, C.RED, P.TAIL);
      }
      if (d >= 2) for (const s of [1, -1]) k.cyl('z', [s * 0.09, 0.09, sgn * 0.5], 0.02, 0.04, 6, 0x3a3e44, P.CHROME);
    }
    if (d >= 2) {
      for (const s of [1, -1]) k.rectX(s, 0.1112, 0.17, 0.3, -0.42, 0.08, 0x2a2d31, P.PLASTIC);
      k.cyl('y', [0.05, 0.36, -0.3], 0.018, 0.06, 6, 0x2a2d31, P.PLASTIC);
      for (let x = -0.13; x <= 0.13; x += 0.03) k.box(x - 0.004, 0.07, -0.48, x + 0.004, 0.12, -0.475, 0xf2c21a, P.GLOSS);
    }
    for (const z of [-0.3, 0.3]) bogie(k, d, z, 0.125);
  },
});
