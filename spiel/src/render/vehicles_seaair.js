// Schiffe, Boote, Flugzeuge, Hubschrauber und Heißluftballon (Besitzer: G10).
// Maßstab 1 = 10 m. Schiffe: Ursprung = Wasserlinie (Rumpf reicht darunter), Bug nach +z.
// Flugzeuge: Ursprung = Rumpfmitte, Nase nach +z, linke Tragfläche (+x) mit rotem, rechte mit grünem Positionslicht.
// Standardlängen: boat 0.55 · sailboat 0.7 · rowboat 0.42 · ferry 2.0 · ship_cargo 5.0 · ship_cruise 6.5 · plane 3.8 · helicopter 1.3
import { P, VC as C } from './vehicles_kit.js';

export const SEA_AIR_MODELS = {};
function def(id, o) { SEA_AIR_MODELS[id] = { id, far: null, beam: false, head: [], tail: [], beacons: [], ...o }; }

// ---------------------------------------------------------------- Rumpf-Hilfen
function outline(L, W, bowFrac, n = 6, transom = 0.82) {
  const side = [];
  const bow = L * bowFrac;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    side.push([(W / 2) * Math.pow(Math.sin((t * Math.PI) / 2), 0.75), L / 2 - bow * t]);
  }
  side.push([W / 2, -L / 2 + L * 0.04]);
  side.push([(W / 2) * transom, -L / 2]);
  const other = side.slice(1).reverse().map(([x, z]) => [-x, z]);
  return [...side, ...other];
}
const scaleOut = (o, sx, sz, dz = 0) => o.map(([x, z]) => [x * sx, z * sz + dz]);

// Band zwischen zwei Umrissen
function band(k, top, yT, bot, yB, color, part) {
  const n = top.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const mx = (top[i][0] + top[j][0]) / 2, mz = (top[i][1] + top[j][1]) / 2;
    k.quad([top[i][0], yT, top[i][1]], [top[j][0], yT, top[j][1]], [bot[j][0], yB, bot[j][1]], [bot[i][0], yB, bot[i][1]], color, part, [mx, (yB - yT) * -0.3, mz]);
  }
}
function deck(k, o, y, color, part) { k.poly(o.map(([x, z]) => [x, y, z]), color, part, [0, 1, 0]); }

// Rumpf mit Farbbändern: bands = [[y, Farbe, Teil], …] von oben nach unten, letzte y = Kiel
function hullBands(k, L, W, bowFrac, bands, o = {}) {
  const base = outline(L, W, bowFrac, o.n || 6, o.transom ?? 0.82);
  const yTop = bands[0][0], yKeel = bands[bands.length - 1][0];
  const at = (y) => {
    const t = (yTop - y) / Math.max(1e-6, yTop - yKeel);
    return scaleOut(base, 1 - t * (1 - (o.keelX ?? 0.55)), 1 - t * (1 - (o.keelZ ?? 0.9)), t * (o.keelDz ?? 0));
  };
  for (let b = 0; b < bands.length - 1; b++) band(k, at(bands[b][0]), bands[b][0], at(bands[b + 1][0]), bands[b + 1][0], bands[b][1], bands[b][2]);
  deck(k, base, yTop, o.deck ?? 0xb08a5a, o.deckPart ?? P.PLASTIC);
  return base;
}

function navLights(k, L, W, y, mastY) {
  k.box(W / 2 - 0.004, y, L * 0.1, W / 2 + 0.004, y + 0.01, L * 0.1 + 0.012, 0xff2a1a, P.LAMP);
  k.box(-W / 2 - 0.004, y, L * 0.1, -W / 2 + 0.004, y + 0.01, L * 0.1 + 0.012, 0x22e86a, P.LAMP);
  if (mastY) k.box(-0.005, mastY, -0.005, 0.005, mastY + 0.01, 0.005, 0xfff6dd, P.LAMP);
}

// ---------------------------------------------------------------- Kleine Boote
def('boat', {
  len: 0.55, wid: 0.19, hei: 0.13,
  build: (k, d) => {
    const L = 0.55, W = 0.19;
    hullBands(k, L, W, 0.42, [[0.05, 0xffffff, P.PAINT], [0.03, 0xf4f4ef, P.GLOSS], [-0.045, 0xf4f4ef, P.GLOSS]], { deck: 0xe9e6dc, keelX: 0.35 });
    // Windschutz + Konsole
    k.prism([[-0.02, 0.05], [0.09, 0.05], [0.055, 0.098], [-0.02, 0.098]], 0.075, 0.06, 0xf4f4ef, P.GLOSS, {
      edge: (i) => (i === 0 ? false : i === 1 ? { c: C.GLASS, p: P.GLASS } : undefined),
    });
    if (d >= 2) {
      k.box(-0.05, 0.05, -0.12, 0.05, 0.075, -0.05, 0xd8d2c0, P.PLASTIC);
      k.box(-0.03, 0.05, -0.29, 0.03, 0.12, -0.25, 0x2a2d31, P.GLOSS);
      k.box(-0.012, -0.04, -0.285, 0.012, 0.05, -0.27, 0x2a2d31, P.PLASTIC);
    }
    navLights(k, L, W, 0.05, d >= 2 ? 0.13 : 0);
  },
});

def('sailboat', {
  len: 0.7, wid: 0.22, hei: 1.0,
  build: (k, d) => {
    const L = 0.7, W = 0.22;
    hullBands(k, L, W, 0.45, [[0.05, 0xffffff, P.PAINT], [0.035, 0xf6f6f1, P.GLOSS], [-0.05, 0xf6f6f1, P.GLOSS]], { deck: 0xb08a5a, keelX: 0.3 });
    k.prism([[-0.14, 0.05], [0.12, 0.05], [0.08, 0.085], [-0.12, 0.085]], 0.065, 0.055, 0xf4f4ef, P.GLOSS);
    if (d >= 2) for (const s of [1, -1]) k.rectX(s, 0.0625, 0.058, 0.075, -0.08, 0.06, C.GLASS, P.GLASS);
    // Mast, Baum, Segel
    k.cyl('y', [0, 0.52, 0.06], 0.006, 0.94, 6, 0xd9dcdf, P.CHROME, { capA: false });
    k.box(-0.004, 0.13, -0.27, 0.004, 0.14, 0.06, 0xd9dcdf, P.CHROME);
    const sailC = 0xf8f7f2;
    const main = [[0, 0.15, 0.055], [0, 0.95, 0.055], [0, 0.15, -0.26]];
    const jib = [[0, 0.12, 0.33], [0, 0.82, 0.07], [0, 0.12, 0.09]];
    for (const tri of [main, jib]) { k.tri(tri[0], tri[1], tri[2], sailC, P.PLASTIC); k.tri(tri[0], tri[2], tri[1], sailC, P.PLASTIC); }
    if (d >= 2) {
      const st = [[0.0005, 0.6, 0.055], [0.0005, 0.62, 0.055], [0.0005, 0.6, -0.12]];
      k.tri(st[0], st[1], st[2], 0x2f6db3, P.PLASTIC); k.tri(st[0], st[2], st[1], 0x2f6db3, P.PLASTIC);
    }
    navLights(k, L, W, 0.05, 0.98);
  },
});

def('rowboat', {
  len: 0.42, wid: 0.15, hei: 0.06,
  build: (k, d) => {
    const L = 0.42, W = 0.15;
    hullBands(k, L, W, 0.4, [[0.035, 0x9a6b40, P.PLASTIC], [-0.03, 0xffffff, P.PAINT]], { deck: 0x6e4a2c, keelX: 0.4, transom: 0.6 });
    if (d >= 2) for (const z of [-0.08, 0.06]) k.box(-0.065, 0.02, z - 0.012, 0.065, 0.03, z + 0.012, 0x8a5e38, P.PLASTIC);
  },
});

// ---------------------------------------------------------------- Fähre
def('ferry', {
  len: 2.0, wid: 0.48, hei: 0.45,
  build: (k, d) => {
    const L = 2.0, W = 0.48;
    hullBands(k, L, W, 0.25, [[0.12, 0xffffff, P.PAINT], [0.09, 0xf3f3ee, P.GLOSS], [0.0, 0x9a2c22, P.PLASTIC], [-0.09, 0x9a2c22, P.PLASTIC]], { deck: 0x7b8086, transom: 0.92, keelX: 0.75 });
    // Aufbau Deck 1 + 2 + Brücke
    k.box(-0.2, 0.12, -0.85, 0.2, 0.22, 0.55, 0xf4f4ef, P.GLOSS);
    k.box(-0.17, 0.22, -0.7, 0.17, 0.3, 0.35, 0xf4f4ef, P.GLOSS);
    k.box(-0.13, 0.3, 0.12, 0.13, 0.36, 0.33, 0xf4f4ef, P.GLOSS);
    for (const s of [1, -1]) {
      k.rectX(s, 0.2012, 0.15, 0.2, -0.82, 0.52, C.CABIN, P.CABIN);
      k.rectX(s, 0.1712, 0.24, 0.285, -0.67, 0.32, C.CABIN, P.CABIN);
      k.rectX(s, 0.1312, 0.315, 0.35, 0.14, 0.31, C.GLASS, P.GLASS);
    }
    k.rectZ(1, 0.5512, -0.18, 0.18, 0.15, 0.2, C.CABIN, P.CABIN);
    k.rectZ(1, 0.3312, -0.12, 0.12, 0.315, 0.35, C.GLASS, P.GLASS);
    // Schornstein
    k.cyl('y', [0, 0.4, -0.45], [0.07, 0.06], 0.2, d >= 2 ? 10 : 6, 0xffffff, P.PAINT);
    k.cyl('y', [0, 0.505, -0.45], 0.061, 0.01, d >= 2 ? 10 : 6, C.DARK, P.PLASTIC, { capA: false });
    if (d >= 2) {
      // Rettungsboote, Reling, Mast
      for (const s of [1, -1]) for (const z of [-0.45, -0.1]) k.box(s * 0.19 - 0.03, 0.31, z - 0.08, s * 0.19 + 0.03, 0.35, z + 0.08, 0xf28a1e, P.GLOSS);
      for (const s of [1, -1]) k.box(s * 0.235 - 0.003, 0.12, -0.9, s * 0.235 + 0.003, 0.15, 0.7, 0xe6e6e1, P.PLASTIC);
      k.cyl('y', [0, 0.45, 0.22], 0.008, 0.18, 6, 0xd9dcdf, P.CHROME);
    }
    navLights(k, L, W, 0.36, 0.54);
  },
});

// ---------------------------------------------------------------- Containerschiff (Feeder)
const BOX_COLS = [0x2f6db3, 0xb8302a, 0x2f7a4f, 0xd59a2a, 0x6b6f75, 0x8a3c2e, 0x1f3b63, 0xe6e2d8, 0x3a8f8c, 0xc96a2a];
def('ship_cargo', {
  len: 5.0, wid: 0.85, hei: 0.95,
  build: (k, d) => {
    const L = 5.0, W = 0.85;
    hullBands(k, L, W, 0.22, [[0.28, 0xf2f2ee, P.GLOSS], [0.24, 0xffffff, P.PAINT], [0.02, 0x9a2c22, P.PLASTIC], [-0.2, 0x9a2c22, P.PLASTIC]], { deck: 0x6b7178, transom: 0.9, keelX: 0.8 });
    // Container: 3 nebeneinander, 2–3 Lagen
    let h = 7;
    for (let bay = 0; bay < 6; bay++) {
      const z = 1.65 - bay * 0.62;
      const tiers = bay === 0 ? 2 : 3;
      for (let row = 0; row < 3; row++) for (let t = 0; t < tiers; t++) {
        h = (h * 1103515245 + 12345) & 0x7fffffff;
        if ((h >> 8) % 11 === 0) continue;
        const col = BOX_COLS[(h >> 4) % BOX_COLS.length];
        const x = (row - 1) * 0.255;
        k.box(x - 0.122, 0.28 + t * 0.26, z - 0.3, x + 0.122, 0.28 + t * 0.26 + 0.255, z + 0.3, col, P.PLASTIC);
      }
    }
    // Brückenhaus am Heck
    k.box(-0.36, 0.28, -2.35, 0.36, 0.86, -1.95, 0xf4f4ef, P.GLOSS);
    k.box(-0.44, 0.8, -2.08, 0.44, 0.86, -1.97, 0xf4f4ef, P.GLOSS);
    for (const s of [1, -1]) for (const y of [0.42, 0.56, 0.7]) k.rectX(s, 0.3612, y, y + 0.06, -2.32, -1.98, C.CABIN, P.CABIN);
    k.rectZ(1, -1.9488, -0.33, 0.33, 0.42, 0.48, C.CABIN, P.CABIN);
    k.rectZ(1, -1.9488, -0.33, 0.33, 0.56, 0.62, C.CABIN, P.CABIN);
    k.rectZ(1, -1.9688, -0.42, 0.42, 0.81, 0.85, C.GLASS, P.GLASS);
    k.box(-0.08, 0.86, -2.3, 0.08, 1.02, -2.15, 0x2a2d31, P.PLASTIC);
    k.box(-0.081, 0.96, -2.302, 0.081, 0.99, -2.148, 0xffffff, P.PAINT2);
    if (d >= 2) {
      k.cyl('y', [0, 1.0, -2.05], 0.008, 0.28, 6, 0xd9dcdf, P.CHROME);
      k.box(-0.14, 1.06, -2.06, 0.14, 1.07, -2.04, 0xd9dcdf, P.CHROME);
      k.cyl('y', [0, 0.5, 2.2], 0.012, 0.44, 6, 0xd9dcdf, P.CHROME);
    }
    navLights(k, L, W, 0.86, 1.14);
  },
});

// ---------------------------------------------------------------- Kreuzfahrtschiff
def('ship_cruise', {
  len: 6.5, wid: 0.95, hei: 1.5,
  build: (k, d) => {
    const L = 6.5, W = 0.95;
    hullBands(k, L, W, 0.24, [[0.32, 0xf6f6f2, P.GLOSS], [0.08, 0xffffff, P.PAINT], [0.0, 0x9a2c22, P.PLASTIC], [-0.22, 0x9a2c22, P.PLASTIC]], { deck: 0xa6b0b6, transom: 0.9, keelX: 0.8 });
    for (const s of [1, -1]) k.rectX(s, 0.4712, 0.17, 0.21, -2.9, 2.2, C.CABIN, P.CABIN);
    // Decks, nach vorne abgestuft
    const decks = 7;
    for (let j = 0; j < decks; j++) {
      const y0 = 0.32 + j * 0.13, y1 = y0 + 0.13;
      const zf = 2.1 - j * 0.12 - (j > 4 ? 0.4 : 0), zb = -3.0 + j * 0.05;
      const hw = 0.44 - j * 0.012 - (j > 5 ? 0.08 : 0);
      k.box(-hw, y0, zb, hw, y1, zf, 0xf6f6f2, P.GLOSS);
      for (const s of [1, -1]) {
        k.rectX(s, hw + 0.0012, y0 + 0.035, y0 + 0.1, zb + 0.06, zf - 0.06, C.CABIN, P.CABIN);
        if (d >= 2 && j < 5) for (let z = zb + 0.2; z < zf - 0.1; z += 0.2) k.rectX(s, hw + 0.002, y0 + 0.035, y0 + 0.1, z - 0.006, z + 0.006, 0xe6e6e1, P.GLOSS);
      }
      k.rectZ(1, zf + 0.0012, -hw + 0.04, hw - 0.04, y0 + 0.035, y0 + 0.1, j === decks - 1 ? C.GLASS : C.CABIN, j === decks - 1 ? P.GLASS : P.CABIN);
    }
    const topY = 0.32 + decks * 0.13;
    // Pool, Schornstein, Rettungsboote
    k.rectY(topY + 0.002, -0.18, 0.18, -1.2, -0.6, 0x3ab6d8, P.GLOSS);
    k.prism([[-2.2, topY], [-1.6, topY], [-1.75, topY + 0.38], [-2.2, topY + 0.38]], 0.12, 0.09, 0xffffff, P.PAINT);
    k.box(-0.095, topY + 0.38, -2.2, 0.095, topY + 0.42, -1.78, C.DARK, P.PLASTIC);
    if (d >= 2) {
      for (const s of [1, -1]) for (let z = -2.4; z < 1.4; z += 0.38) k.box(s * 0.47 - 0.035, 0.46, z - 0.13, s * 0.47 + 0.035, 0.53, z + 0.13, 0xf2b01e, P.GLOSS);
      k.cyl('y', [0, topY + 0.2, 0.6], 0.012, 0.4, 6, 0xd9dcdf, P.CHROME);
      k.box(-0.2, topY + 0.36, 0.58, 0.2, topY + 0.37, 0.62, 0xd9dcdf, P.CHROME);
    }
    navLights(k, L, W, 0.5, topY + 0.42);
  },
});

// ---------------------------------------------------------------- Verkehrsflugzeug
function wing(k, root, tip, yR, yT, th, color, part) {
  // root/tip: [x, zFront, zBack]; Unterseite mit Dicke th
  const [xr, zr0, zr1] = root, [xt, zt0, zt1] = tip;
  const top = [[xr, yR + th, zr0], [xt, yT + th * 0.5, zt0], [xt, yT + th * 0.5, zt1], [xr, yR + th, zr1]];
  const bot = [[xr, yR, zr0], [xt, yT, zt0], [xt, yT, zt1], [xr, yR, zr1]];
  k.poly(top, color, part, [0, 1, 0]);
  k.poly(bot, color, part, [0, -1, 0]);
  k.quad(top[0], top[1], bot[1], bot[0], color, part, [0, 0, 1]);
  k.quad(top[1], top[2], bot[2], bot[1], color, part, [Math.sign(xt), 0, 0]);
  k.quad(top[2], top[3], bot[3], bot[2], color, part, [0, 0, -1]);
}

def('plane', {
  len: 3.8, wid: 3.4, hei: 1.2,
  head: [[0.3, -0.08, 0.2]],
  build: (k, d) => {
    const seg = d >= 2 ? 12 : 8;
    const WH = 0xf5f6f4;
    const rings = [[1.9, 0.0, 0.0, 0.02], [1.86, 0.07, 0.07, 0.0], [1.76, 0.15, 0.16, 0.0], [1.55, 0.2, 0.215, 0.0], [-1.0, 0.2, 0.215, 0.0], [-1.5, 0.14, 0.15, 0.06], [-1.85, 0.05, 0.05, 0.14], [-1.92, 0.01, 0.01, 0.15]];
    k.lathe(rings, seg, WH, P.GLOSS, {
      band: (ri, i, a) => {
        const deg = ((a * 180) / Math.PI + 360) % 360;
        if (ri === 2 && deg > 20 && deg < 160) return { c: C.GLASS, p: P.GLASS };
        if (ri === 3 && (deg < 25 || deg > 155) && deg < 180 && d >= 2) return { c: C.CABIN, p: P.CABIN };
        if (deg > 200 && deg < 340) return { c: 0xd9dcdf, p: P.GLOSS };
        return undefined;
      },
    });
    // Tragflächen mit V-Stellung
    for (const s of [1, -1]) {
      wing(k, [s * 0.18, 0.25, -0.42], [s * 1.7, -0.5, -0.72], -0.12, -0.02, 0.035, 0xe2e5e8, P.GLOSS);
      // Winglet
      k.tri([s * 1.7, -0.0, -0.52], [s * 1.74, 0.22, -0.68], [s * 1.7, -0.0, -0.72], 0xffffff, P.PAINT);
      k.tri([s * 1.7, -0.0, -0.52], [s * 1.7, -0.0, -0.72], [s * 1.74, 0.22, -0.68], 0xffffff, P.PAINT);
      // Triebwerk
      k.cyl('z', [s * 0.62, -0.2, 0.18], [0.085, 0.095], 0.42, seg, 0xffffff, P.PAINT2, { capB: { c: 0x2a2d31, p: P.PLASTIC }, capA: { c: 0x4a4e54, p: P.CHROME } });
      k.box(s * 0.62 - 0.012, -0.13, -0.05, s * 0.62 + 0.012, -0.08, 0.2, 0xd9dcdf, P.GLOSS);
      // Höhenleitwerk
      wing(k, [s * 0.08, -1.45, -1.72], [s * 0.65, -1.78, -1.9], 0.09, 0.14, 0.02, 0xe2e5e8, P.GLOSS);
      // Positionslichter und Blitzer
      k.box(s * 1.7 - 0.012, -0.04, -0.56, s * 1.7 + 0.012, -0.0, -0.52, s > 0 ? 0xff2a1a : 0x22e86a, P.LAMP);
      k.box(s * 1.7 - 0.01, -0.04, -0.74, s * 1.7 + 0.01, -0.0, -0.71, 0xffffff, P.STROBE);
    }
    // Seitenleitwerk in Hausfarbe
    k.prism([[-1.25, 0.18], [-1.92, 0.18], [-1.92, 0.95], [-1.72, 0.95]], 0.02, 0.012, 0xffffff, P.PAINT);
    k.box(-0.012, 0.18, -1.92, 0.012, 0.22, -1.25, 0xffffff, P.PAINT);
    k.box(-0.02, 0.22, -0.15, 0.02, 0.245, -0.05, 0xff2a1a, P.RED);
    k.box(-0.02, -0.235, -0.15, 0.02, -0.21, -0.05, 0xff2a1a, P.RED);
    k.box(-0.01, 0.9, -1.93, 0.01, 0.94, -1.9, 0xffffff, P.STROBE);
    // Landescheinwerfer an der Flügelwurzel
    for (const s of [1, -1]) k.box(s * 0.25 - 0.02, -0.13, 0.22, s * 0.25 + 0.02, -0.1, 0.26, C.HEAD, P.HEAD);
    // Fahrwerk (nur sichtbar, wenn jemand es am Boden zeigt)
    if (d >= 2) {
      k.box(-0.012, -0.36, 1.25, 0.012, -0.2, 1.28, 0x55595f, P.PLASTIC);
      k.cyl('x', [0, -0.37, 1.265], 0.03, 0.05, 8, C.TIRE, P.RUBBER);
      for (const s of [1, -1]) {
        k.box(s * 0.3 - 0.012, -0.36, -0.32, s * 0.3 + 0.012, -0.15, -0.29, 0x55595f, P.PLASTIC);
        k.cyl('x', [s * 0.3, -0.36, -0.305], 0.045, 0.09, 8, C.TIRE, P.RUBBER);
      }
    }
  },
});

// ---------------------------------------------------------------- Hubschrauber
def('helicopter', {
  len: 1.3, wid: 1.1, hei: 0.42,
  build: (k, d) => {
    const seg = d >= 2 ? 10 : 6;
    k.lathe([[0.42, 0.0, 0.0, 0.18], [0.38, 0.07, 0.07, 0.18], [0.28, 0.12, 0.13, 0.2], [0.05, 0.13, 0.14, 0.21], [-0.2, 0.1, 0.11, 0.23], [-0.3, 0.05, 0.05, 0.26]], seg, 0xffffff, P.PAINT, {
      band: (ri, i, a) => {
        const deg = ((a * 180) / Math.PI + 360) % 360;
        if ((ri === 0 || ri === 1) && deg > 0 && deg < 180) return { c: C.GLASS, p: P.GLASS };
        if (ri === 2 && deg > 10 && deg < 170 && (deg < 60 || deg > 120)) return { c: C.GLASS, p: P.GLASS };
        if (deg > 200 && deg < 340) return { c: 0xf2f2ee, p: P.GLOSS };
        return undefined;
      },
    });
    // Heckausleger, Leitwerk
    k.cyl('z', [0, 0.27, -0.55], [0.022, 0.04], 0.55, 6, 0xffffff, P.PAINT);
    k.prism([[-0.78, 0.25], [-0.7, 0.25], [-0.74, 0.38], [-0.8, 0.38]], 0.008, 0.008, 0xffffff, P.PAINT);
    k.box(-0.08, 0.3, -0.74, 0.08, 0.31, -0.7, 0xffffff, P.PAINT);
    // Kufen
    for (const s of [1, -1]) {
      k.box(s * 0.11 - 0.008, 0.0, -0.18, s * 0.11 + 0.008, 0.012, 0.25, 0x3a3e44, P.PLASTIC);
      for (const z of [-0.1, 0.15]) k.box(s * 0.09 - 0.005, 0.012, z - 0.006, s * 0.09 + 0.005, 0.1, z + 0.006, 0x3a3e44, P.PLASTIC);
    }
    // Rotormast und Rotoren (drehen im Shader)
    k.cyl('y', [0, 0.37, 0.02], 0.025, 0.05, 6, 0x3a3e44, P.PLASTIC);
    k.setPivot(0, 0.395, 0.02);
    for (let b = 0; b < 4; b++) {
      const a = (b / 4) * Math.PI * 2;
      k.group({ x: 0, y: 0.395, z: 0.02, ry: a }, () => k.box(-0.012, 0, 0.0, 0.012, 0.006, 0.56, 0x2a2d31, P.ROTOR_Y));
    }
    k.setPivot(0.035, 0.31, -0.76);
    for (let b = 0; b < 2; b++) k.group({ x: 0.035, y: 0.31, z: -0.76, rx: b * Math.PI }, () => k.box(-0.003, 0.0, -0.008, 0.003, 0.1, 0.008, 0x2a2d31, P.ROTOR_X));
    k.clearPivot();
    k.box(-0.012, 0.42, 0.0, 0.012, 0.43, 0.03, 0xff2a1a, P.RED);
    k.box(-0.01, 0.06, 0.3, 0.01, 0.075, 0.33, C.HEAD, P.HEAD);
    k.box(0.13, 0.2, 0.0, 0.14, 0.21, 0.02, 0xff2a1a, P.LAMP);
    k.box(-0.14, 0.2, 0.0, -0.13, 0.21, 0.02, 0x22e86a, P.LAMP);
  },
});

// ---------------------------------------------------------------- Heißluftballon
const BALLOON_COLS = [[0xe8402a, 0xf2c21a], [0x2f6db3, 0xf4f4ef], [0x22a866, 0xf2b01e], [0x8f5ad8, 0xf06fae]];
for (let v = 0; v < BALLOON_COLS.length; v++) {
  def('balloon' + v, {
    len: 1.6, wid: 1.6, hei: 2.4,
    build: (k, d) => {
      const [a, b] = BALLOON_COLS[v];
      const seg = d >= 2 ? 16 : 10;
      k.group({ y: 0.55 }, () => {
        k.latheY([[0.0, 0.12], [0.18, 0.36], [0.5, 0.72], [0.85, 0.82], [1.2, 0.74], [1.5, 0.52], [1.72, 0.22], [1.8, 0.0]], seg, a, P.PLASTIC, {
          band: (ri, i) => ({ c: i % 2 ? a : b, p: P.PLASTIC }),
        });
      });
      // Korb, Seile, Brenner
      k.box(-0.1, 0.0, -0.1, 0.1, 0.13, 0.1, 0x8a5e38, P.PLASTIC);
      for (const [x, z] of [[-0.09, -0.09], [0.09, -0.09], [-0.09, 0.09], [0.09, 0.09]]) k.box(x - 0.003, 0.13, z - 0.003, x + 0.003, 0.56, z + 0.003, 0x3a3e44, P.PLASTIC);
      k.box(-0.04, 0.3, -0.04, 0.04, 0.36, 0.04, 0x55595f, P.CHROME);
      k.box(-0.025, 0.36, -0.025, 0.025, 0.42, 0.025, 0xffa032, P.LAMP);
    },
  });
}

// Binnenschiff (Gütermotorschiff) mit Containern, Steuerhaus am Heck – für kurze Frachtschiffe (len < 3.5)
def('ship_barge', {
  len: 2.6, wid: 0.46, hei: 0.5,
  build: (k, d) => {
    const L = 2.6, W = 0.46;
    hullBands(k, L, W, 0.1, [[0.1, 0x2a2d31, P.PLASTIC], [0.07, 0xffffff, P.PAINT], [0.0, 0x9a2c22, P.PLASTIC], [-0.1, 0x9a2c22, P.PLASTIC]], { deck: 0x4a4f55, transom: 0.95, keelX: 0.9, n: 4 });
    k.box(-0.21, 0.1, -0.85, 0.21, 0.13, 1.05, 0x3a3e44, P.PLASTIC);
    let h = 3;
    for (let bay = 0; bay < 6; bay++) for (let row = 0; row < 2; row++) for (let t = 0; t < (bay % 3 === 1 ? 1 : 2); t++) {
      h = (h * 1103515245 + 12345) & 0x7fffffff;
      const col = BOX_COLS[(h >> 5) % BOX_COLS.length];
      const z = 0.92 - bay * 0.3, x = row ? 0.1 : -0.1;
      k.box(x - 0.096, 0.13 + t * 0.105, z - 0.142, x + 0.096, 0.13 + t * 0.105 + 0.1, z + 0.142, col, P.PLASTIC);
    }
    k.box(-0.2, 0.1, -1.28, 0.2, 0.22, -0.98, 0xf4f4ef, P.GLOSS);
    for (const s of [1, -1]) k.rectX(s, 0.2012, 0.14, 0.19, -1.25, -1.01, C.CABIN, P.CABIN);
    k.box(-0.12, 0.22, -1.2, 0.12, 0.33, -1.03, 0xf4f4ef, P.GLOSS);
    for (const s of [1, -1]) k.rectX(s, 0.1212, 0.25, 0.31, -1.18, -1.05, C.GLASS, P.GLASS);
    k.rectZ(1, -1.0288, -0.11, 0.11, 0.25, 0.31, C.GLASS, P.GLASS);
    k.box(-0.13, 0.33, -1.21, 0.13, 0.345, -1.02, 0x2a2d31, P.PLASTIC);
    if (d >= 2) {
      k.cyl('y', [0, 0.42, -1.1], 0.006, 0.16, 6, 0xd9dcdf, P.CHROME);
      k.box(-0.004, 0.22, -1.3, 0.004, 0.4, -1.29, 0xffffff, P.PAINT);
      k.box(-0.15, 0.1, 1.15, 0.15, 0.14, 1.22, 0x2a2d31, P.PLASTIC);
    }
    navLights(k, L, W, 0.34, 0.5);
  },
});
