// Durchmischung der Zonengebäude (nur Aussehen, die Simulation bleibt unberührt).
//
// Anzeige-Variante = Modell-Nummer + 32 × Höhenklasse + 96 × Ecklage + 384 × Farbfamilie.
//  • Stilfamilie: Jedes Modell trägt in seiner Typliste eine Epoche (0 historisch … 3 zeitgenössisch, siehe tag()).
//    Ein weiches Stilfeld über die Karte gibt jeder Straße eine Ziel-Epoche – abgetastet in der Mitte des
//    Straßenabschnitts, an dem das Gebäude liegt. Beide Straßenseiten eines Abschnitts teilen so die Epoche, benachbarte
//    Abschnitte unterscheiden sich höchstens um eine Stufe. Bezirke ziehen die Epoche leicht zu ihrem eigenen Charakter.
//    Gewählt wird unter den Modellen, deren Epoche am nächsten liegt: innerhalb der Familie mit festem Farbraster
//    (gierige Färbung, direkte Nachbarn selten dasselbe Modell), damit eine Straße einheitlich, aber nicht eintönig wirkt.
//  • Höhenklasse (ab Stufe 4, nur offene Bauweise und Türme): dicht bebaute Viertel bekommen höhere Türme, Ränder und
//    Türme neben niedriger Bebauung niedrigere (Höhenstaffelung statt Sprung).
//  • Ecklage (geschlossene Bauweise): Seiten, die an eine Straße grenzen, bekommen eine Fassade statt einer Brandwand.
//  • Farbfamilie: Dachdeckung und Putzfarben einer Straße passen zusammen (Bausteine mit ctx.pal).
// Alles hängt nur von Lage, Straßennetz, Bezirk und Grundfläche ab: Spielstände zeigen nach dem Laden dieselben Häuser,
// und ein Gebäude ändert sein Aussehen nicht, wenn weiter weg gebaut oder abgerissen wird.
export const MIX_STRIDE = 32;
export const HEIGHT_FACTOR = [1, 1.32, 0.8];
export const PALETTES = 4;
export const MIX_VARIANTS = MIX_STRIDE * 3 * 4 * PALETTES;

export function encodeVariant(idx, hc = 0, corner = 0, pal = 0) {
  return (idx % MIX_STRIDE) + MIX_STRIDE * (hc % 3) + MIX_STRIDE * 3 * (corner & 3) + MIX_STRIDE * 12 * (pal % PALETTES);
}
export function decodeVariant(v) {
  const n = ((Math.floor(v) % MIX_VARIANTS) + MIX_VARIANTS) % MIX_VARIANTS;
  const base = n % (MIX_STRIDE * 3);
  return { idx: base % MIX_STRIDE, hc: Math.floor(base / MIX_STRIDE), corner: Math.floor(n / (MIX_STRIDE * 3)) & 3, pal: Math.floor(n / (MIX_STRIDE * 12)) % PALETTES, base };
}

// Kennzeichnung eines Modells in einer Typliste: Epoche (0 historisch, 1 traditionell, 2 Nachkriegsmoderne,
// 3 zeitgenössisch; Zwischenwerte erlaubt) und Bauweise ('D' offen, 'A' geschlossen, 'S' Solitär, 'P' Solitär mit Sockel
// oder Staffelung – vermittelt zu niedriger Nachbarschaft –, 'E' Eckhaus nur an Straßenecken, 'R' Reihe)
// corner: true → der Baustein kann an Straßenecken Seitenfassaden statt Brandwänden zeigen (liest ctx.cornerL/R)
export function tag(fn, era, typ = 'D', corner = false) { fn.era = era; fn.typ = typ; fn.corner = !!corner; return fn; }
export const tagOf = (fn) => ({ era: fn && fn.era !== undefined ? fn.era : 1.5, typ: (fn && fn.typ) || 'D', corner: !!(fn && fn.corner) });

const hash = (x, y, s) => {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export { hash as mixHash };

const R = 3;
// Abstoßung gleicher Modelle nach Lage: Nachbarn in derselben Zeile/Spalte (an der Straße nebeneinander, gegenüber,
// hintereinander) sehr stark, über Eck schwächer, in zweiter Reihe leicht
const weight = (dx, dy) => {
  const a = Math.abs(dx), b = Math.abs(dy);
  if (a + b === 1) return 100;
  if (a === 1 && b === 1) return 20;
  if (Math.max(a, b) === 2) return a === 0 || b === 0 ? 14 : 6;
  return 2;
};

export class MixGrid {
  constructor(W, H, seed = 1) {
    this.W = W; this.H = H; this.seed = seed | 0;
    this.grids = new Map();
    this.order = null;
    this.fields = new Map();
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
    const choose = (i) => {
      const x = i % W, y = (i / W) | 0;
      cost.fill(0);
      for (let dy = -R; dy <= R; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= W || (!dx && !dy)) continue;
          const c = g[yy * W + xx];
          if (c >= 0) cost[c] += weight(dx, dy);
        }
      }
      let best = 0, bc = Infinity;
      for (let c = 0; c < n; c++) {
        const v = cost[c] + hash(i, c, this.seed + 17) * 1.5;
        if (v < bc) { bc = v; best = c; }
      }
      return best;
    };
    // gierige Färbung in fester Zufallsreihenfolge, danach ein Durchgang Nachbesserung (jede Zelle nimmt die günstigste
    // Nummer, nun mit allen Nachbarn): bei vier Modellen sind direkte Nachbarn so fast nie gleich
    const ord = this._order();
    for (const i of ord) g[i] = choose(i);
    for (const i of ord) g[i] = choose(i);
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
  noise(x, y, s = 6, salt = 3) {
    // weiches Rauschen (Zellgröße s) für Höhenstaffelung und Stilfeld
    const fx = x / s, fy = y / s, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const sm = (t) => t * t * (3 - 2 * t);
    const a = hash(ix, iy, this.seed + salt), b = hash(ix + 1, iy, this.seed + salt), c = hash(ix, iy + 1, this.seed + salt), d = hash(ix + 1, iy + 1, this.seed + salt);
    const u = sm(tx), v = sm(ty);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  // Gleichverteiltes, weiches Feld 0..1 über die Karte (zwei Oktaven, nach Rang gleichverteilt): jede Stufe kommt
  // gleich oft vor, Nachbarfelder liegen dicht beieinander.
  field(kind = 0) {
    let f = this.fields.get(kind);
    if (f) return f;
    const { W, H } = this, N = W * H;
    const raw = new Float32Array(N), ord = new Uint32Array(N);
    const salt = 41 + kind * 13, s1 = kind ? 9 : 13, s2 = kind ? 4 : 5.5;
    for (let i = 0; i < N; i++) {
      const x = i % W, y = (i / W) | 0;
      raw[i] = this.noise(x, y, s1, salt) + 0.35 * this.noise(x, y, s2, salt + 5);
      ord[i] = i;
    }
    ord.sort((a, b) => raw[a] - raw[b] || a - b);
    f = new Float32Array(N);
    for (let r = 0; r < N; r++) f[ord[r]] = (r + 0.5) / N;
    this.fields.set(kind, f);
    return f;
  }
  at(kind, x, y) {
    const cx = Math.max(0, Math.min(this.W - 1, Math.round(x))), cy = Math.max(0, Math.min(this.H - 1, Math.round(y)));
    return this.field(kind)[cy * this.W + cx];
  }
}

// Modell aus einer Typliste wählen: Epoche möglichst nahe am Ziel e (0..3), innerhalb der Familie per Farbraster.
// tags: [{ era, typ }] in Listenreihenfolge. Liefert die Listen-Nummer.
// corner (Bit 1 links, Bit 2 rechts): Grundstück grenzt seitlich an eine Straße – dann nur Modelle, die dort keine Brandwand
// zeigen (offene Bauweise, geschlossene mit Eckfassade, Eckhaus), sofern die Familie welche hat.
// low: direkt daneben steht deutlich niedrigere Bebauung – dann bevorzugt Türme mit Sockel oder Staffelung ('P').
export function pickByStyle(tags, e, mix, x, y, salt = 0, corner = 0, low = false) {
  const n = tags.length;
  if (n <= 1) return 0;
  // Eckhäuser ('E', gerundete Ecke vorne rechts) nur, wenn rechts eine Straße liegt (corner: Bit 1 links, Bit 2 rechts)
  const eOk = (corner & 2) !== 0;
  let ok = (t) => t.typ !== 'E' || eOk;
  if (low && tags.some((t) => t.typ === 'P')) ok = (t) => t.typ === 'P';
  else if (corner && tags.some((t) => (t.typ !== 'A' && t.typ !== 'E') || t.corner || (t.typ === 'E' && eOk))) ok = (t) => (t.typ !== 'A' && t.typ !== 'E') || t.corner || (t.typ === 'E' && eOk);
  if (!tags.some(ok)) ok = () => true;
  // Kandidaten nach Nähe der Epoche: alle bis 0,75 Stufen über der nächsten, mindestens drei (sonst wiederholt sich ein
  // Modell zu oft), höchstens vier (sonst verwässert die Familie)
  const all = [];
  for (let i = 0; i < n; i++) if (ok(tags[i])) all.push(i);
  all.sort((a, b) => Math.abs(tags[a].era - e) - Math.abs(tags[b].era - e) || a - b);
  const dmin = Math.abs(tags[all[0]].era - e);
  let k = 0;
  while (k < all.length && (k < 3 || Math.abs(tags[all[k]].era - e) <= dmin + 0.75) && k < 4) k++;
  const cand = all.slice(0, Math.max(1, k)).sort((a, b) => a - b);
  return cand[mix.pick(cand.length, x, y, salt)];
}

// Anzeige-Varianten auch für Porträts (Inspektor): Die Gebäudeansicht meldet hier, wie sie eine Sim-Variante
// darstellt. buildArch fragt nach, wenn ein Zonengebäude ohne ausgewählte Variante gebaut wird.
let resolver = null;
export function setVariantResolver(fn) { resolver = fn; }
export function resolveVariant(key, level, variant, fw, fd, extra) {
  if (!resolver || !extra || !extra.zone || extra.mixed) return variant;
  try { const v = resolver(key, level, variant, fw, fd); return v ?? variant; } catch (e) { return variant; }
}
