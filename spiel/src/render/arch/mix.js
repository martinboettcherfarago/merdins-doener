// Durchmischung der Zonengebäude (nur Aussehen, die Simulation bleibt unberührt).
//
// Anzeige-Variante = Modell-Nummer + 32 × Höhenklasse (0 normal, 1 hoch, 2 niedrig).
//  • Modell-Nummer: Für jede Anzahl n verschiedener Modelle gibt es ein festes Farbraster über die Karte
//    (gierige Färbung in zufälliger, fester Reihenfolge). Jede Zelle meidet die Nummern ihrer Nachbarn –
//    direkte Nachbarn sehr stark, Abstand 2 stark, Abstand 3 leicht. Gleiche Modelle stehen so nie
//    nebeneinander und kommen erst mit Abstand wieder, ohne erkennbares Muster.
//  • Höhenklasse (ab Stufe 4): dicht bebaute Viertel bekommen höhere Türme, Ränder niedrigere.
// Die Nummer hängt nur von Lage und Grundfläche ab: Spielstände zeigen nach dem Laden dieselben Häuser.
export const MIX_STRIDE = 32;
export const HEIGHT_FACTOR = [1, 1.32, 0.8];

export function encodeVariant(idx, hc = 0) { return (idx % MIX_STRIDE) + MIX_STRIDE * (hc % 3); }
export function decodeVariant(v) {
  const n = ((Math.floor(v) % (MIX_STRIDE * 3)) + MIX_STRIDE * 3) % (MIX_STRIDE * 3);
  return { idx: n % MIX_STRIDE, hc: Math.floor(n / MIX_STRIDE) };
}

const hash = (x, y, s) => {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const R = 3;
const WEIGHT = [0, 100, 12, 2];

export class MixGrid {
  constructor(W, H, seed = 1) {
    this.W = W; this.H = H; this.seed = seed | 0;
    this.grids = new Map();
    this.order = null;
  }
  _order() {
    if (this.order) return this.order;
    const N = this.W * this.H, pr = new Float32Array(N), ord = new Uint32Array(N);
    for (let i = 0; i < N; i++) { pr[i] = hash(i % this.W, (i / this.W) | 0, this.seed); ord[i] = i; }
    ord.sort((a, b) => pr[a] - pr[b]);
    return (this.order = ord);
  }
  grid(n) {
    let g = this.grids.get(n);
    if (g) return g;
    const { W, H } = this;
    g = new Int8Array(W * H).fill(-1);
    const cost = new Float32Array(n);
    for (const i of this._order()) {
      const x = i % W, y = (i / W) | 0;
      cost.fill(0);
      for (let dy = -R; dy <= R; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= W || (!dx && !dy)) continue;
          const c = g[yy * W + xx];
          if (c >= 0) cost[c] += WEIGHT[Math.max(Math.abs(dx), Math.abs(dy))];
        }
      }
      let best = 0, bc = Infinity;
      for (let c = 0; c < n; c++) {
        const v = cost[c] + hash(i, c, this.seed + 17) * 1.5;
        if (v < bc) { bc = v; best = c; }
      }
      g[i] = best;
    }
    this.grids.set(n, g);
    return g;
  }
  // Modell-Nummer für ein Grundstück (Ankerfeld x, y); salt trennt Zonen voneinander
  pick(n, x, y, salt = 0) {
    if (n <= 1) return 0;
    const cx = Math.max(0, Math.min(this.W - 1, x | 0)), cy = Math.max(0, Math.min(this.H - 1, y | 0));
    const c = this.grid(n)[cy * this.W + cx];
    // Zonen bekommen eine feste Verschiebung, damit Wohnen und Gewerbe nicht im Gleichtakt wechseln
    return (c + salt) % n;
  }
  noise(x, y) {
    // weiches Rauschen (Zellgröße 6) für die Höhenstaffelung
    const s = 6, fx = x / s, fy = y / s, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const sm = (t) => t * t * (3 - 2 * t);
    const a = hash(ix, iy, this.seed + 3), b = hash(ix + 1, iy, this.seed + 3), c = hash(ix, iy + 1, this.seed + 3), d = hash(ix + 1, iy + 1, this.seed + 3);
    const u = sm(tx), v = sm(ty);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
}

// Anzeige-Varianten auch für Porträts (Inspektor): Die Gebäudeansicht meldet hier, wie sie eine Sim-Variante
// darstellt. buildArch fragt nach, wenn ein Zonengebäude ohne ausgewählte Variante gebaut wird.
let resolver = null;
export function setVariantResolver(fn) { resolver = fn; }
export function resolveVariant(key, level, variant, fw, fd, extra) {
  if (!resolver || !extra || !extra.zone || extra.mixed) return variant;
  try { const v = resolver(key, level, variant, fw, fd); return v ?? variant; } catch (e) { return variant; }
}
