// Kleine Helfer: Zufall, Rauschen, Heap, Events, Formatierung.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function hash2(x, y, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

// Wertrauschen mit glatter Interpolation, gekachelt über ein Gitter.
export function makeNoise(seed) {
  const s = seed | 0;
  const v = (x, y) => hash2(x, y, s);
  const smooth = (t) => t * t * (3 - 2 * t);
  function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
    const u = smooth(xf), w = smooth(yf);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  }
  function fbm(x, y, oct = 4) {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += amp * noise(x * f, y * f);
      norm += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return sum / norm;
  }
  return { noise, fbm };
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Binärer Min-Heap für A*.
export class MinHeap {
  constructor() { this.items = []; this.prio = []; }
  get size() { return this.items.length; }
  push(item, p) {
    const it = this.items, pr = this.prio;
    it.push(item); pr.push(p);
    let i = it.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (pr[parent] <= p) break;
      it[i] = it[parent]; pr[i] = pr[parent];
      i = parent;
    }
    it[i] = item; pr[i] = p;
  }
  pop() {
    const it = this.items, pr = this.prio;
    const top = it[0];
    const lastI = it.pop(), lastP = pr.pop();
    if (it.length > 0) {
      let i = 0;
      const n = it.length;
      for (;;) {
        let l = 2 * i + 1, r = l + 1, m = i;
        let mp = lastP;
        if (l < n && pr[l] < mp) { m = l; mp = pr[l]; }
        if (r < n && pr[r] < mp) { m = r; mp = pr[r]; }
        if (m === i) break;
        it[i] = it[m]; pr[i] = pr[m];
        i = m;
      }
      it[i] = lastI; pr[i] = lastP;
    }
    return top;
  }
}

export class Emitter {
  constructor() { this.handlers = {}; }
  on(ev, fn) { (this.handlers[ev] ||= []).push(fn); return () => this.off(ev, fn); }
  off(ev, fn) { const h = this.handlers[ev]; if (h) this.handlers[ev] = h.filter((f) => f !== fn); }
  emit(ev, ...args) { const h = this.handlers[ev]; if (h) for (const f of h.slice()) f(...args); }
}

const nf = new Intl.NumberFormat('de-DE');
export const fmt = (n) => nf.format(Math.round(n));
export function fmtMoney(n) {
  const r = Math.round(n);
  return (r < 0 ? '−' : '') + nf.format(Math.abs(r)) + ' €';
}
export function fmtShort(n) {
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (a >= 1e6) return sign + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.', ',') + ' Mio.';
  if (a >= 1e4) return sign + Math.round(a / 1000) + ' Tsd.';
  return sign + nf.format(Math.round(a));
}

export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }

export function weightedPick(rng, items, weightFn) {
  let total = 0;
  for (const it of items) total += Math.max(0, weightFn(it));
  if (total <= 0) return null;
  let r = rng() * total;
  for (const it of items) {
    r -= Math.max(0, weightFn(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

// Kumulative Gewichtsliste für schnelles gewichtetes Ziehen.
export class WeightedList {
  constructor() { this.items = []; this.cum = []; this.total = 0; }
  build(items, weightFn) {
    this.items = [];
    this.cum = [];
    let t = 0;
    for (const it of items) {
      const w = weightFn(it);
      if (w > 0) { t += w; this.items.push(it); this.cum.push(t); }
    }
    this.total = t;
  }
  sample(rng) {
    if (this.total <= 0) return null;
    const r = rng() * this.total;
    let lo = 0, hi = this.cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] < r) lo = mid + 1; else hi = mid;
    }
    return this.items[lo];
  }
}

const NAME_A = ['Lichten', 'Rosen', 'Falken', 'Eichen', 'Sonnen', 'Linden', 'Wolken', 'Kirsch', 'Birken', 'Silber', 'Mond', 'Heide', 'Sternen', 'Weiden', 'Ahorn', 'Klee', 'Morgen', 'Bern', 'Tann', 'Wiesen'];
const NAME_B = ['berg', 'feld', 'hausen', 'au', 'stadt', 'dorf', 'brück', 'hafen', 'tal', 'heim', 'burg', 'furt', 'grund', 'hain', 'ried', 'stein'];
const NAME_P = ['', '', '', '', 'Neu-', 'Bad ', 'Alt-', 'Ober', 'Unter'];
export function cityName(rng) {
  const p = pick(rng, NAME_P);
  let a = pick(rng, NAME_A);
  if (p === 'Ober' || p === 'Unter') a = a.toLowerCase();
  return p + a + pick(rng, NAME_B);
}

const STATION_A = ['Markt', 'Rosen', 'Linden', 'Hafen', 'Park', 'Mühlen', 'Brunnen', 'Turm', 'Garten', 'Schloss', 'Werk', 'Wiesen', 'Kirch', 'Bach', 'Sonnen', 'Uhren', 'Kasten', 'Glocken', 'Weber', 'Löwen', 'Tor', 'Insel', 'Feld', 'Hügel'];
const STATION_B = ['platz', 'straße', 'allee', 'gasse', 'ring', 'brücke', 'ufer', 'tor', 'hof', 'weg', 'höhe', 'damm'];
export function stationName(rng, used) {
  for (let i = 0; i < 40; i++) {
    const n = pick(rng, STATION_A) + pick(rng, STATION_B);
    if (!used.has(n)) { used.add(n); return n; }
  }
  const n = 'Halt ' + (used.size + 1);
  used.add(n);
  return n;
}

const FIRST = ['Lena', 'Jonas', 'Mia', 'Paul', 'Emma', 'Ben', 'Hanna', 'Elias', 'Lea', 'Noah', 'Sofia', 'Finn', 'Marie', 'Luca', 'Aylin', 'Mehmet', 'Ida', 'Karl', 'Greta', 'Milan', 'Nora', 'Yusuf', 'Clara', 'Theo', 'Zeynep', 'Anton', 'Frieda', 'Emil', 'Leni', 'Oskar'];
const LAST = 'ABCDEFGHJKLMNOPRSTUVWZ';
export function citizenName(rng) {
  return pick(rng, FIRST) + ' ' + LAST[Math.floor(rng() * LAST.length)] + '.';
}

// Base64 für Typed Arrays (Spielstände).
export function typedToB64(arr) {
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64');
}
export function b64ToTyped(b64, Ctor) {
  const s = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return new Ctor(bytes.buffer);
}
