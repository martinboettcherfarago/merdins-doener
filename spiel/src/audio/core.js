// Gemeinsame Bausteine der Klangwelt: Tonhöhen, Zufall, geteilte Rauschpuffer, Hall-Impulsantworten,
// Hüllkurven und Stimmenbegrenzung. Alles arbeitet auf einem beliebigen BaseAudioContext
// (Echtzeit oder OfflineAudioContext für die Selbstprüfung) und bekommt Zeitpunkte immer übergeben.

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const dbToGain = (db) => Math.pow(10, db / 20);
export const gainToDb = (g) => (g > 1e-9 ? 20 * Math.log10(g) : -180);
export const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length) % arr.length];
export const rand = (a, b, r = Math.random) => a + (b - a) * r();

export function mulberry32(a) {
  a >>>= 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Geteilte Puffer (einmal pro Kontext)
const bufCache = new WeakMap();

// Nahtlos schleifbarer Puffer: die letzten Proben werden in den Anfang überblendet.
function seamless(d, fade) {
  const n = d.length;
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    d[i] = d[i] * k + d[n - fade + i] * (1 - k);
  }
  return n - fade;
}

function normalizeRms(chs, target) {
  let s = 0, n = 0;
  for (const d of chs) for (let i = 0; i < d.length; i++) { s += d[i] * d[i]; n++; }
  const rms = Math.sqrt(s / Math.max(1, n)) || 1;
  const k = target / rms;
  for (const d of chs) for (let i = 0; i < d.length; i++) d[i] *= k;
}

function makeNoise(ctx, seconds, kind, channels, rng) {
  const sr = ctx.sampleRate;
  const fade = Math.floor(sr * 0.05);
  const total = Math.floor(sr * seconds) + fade;
  const tmp = [];
  for (let ch = 0; ch < channels; ch++) {
    const d = new Float32Array(total);
    if (kind === 'white') for (let i = 0; i < total; i++) d[i] = rng() * 2 - 1;
    else if (kind === 'pink') {
      // Paul Kellets Filter für rosa Rauschen
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < total; i++) {
        const w = rng() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
        b6 = w * 0.115926;
      }
    } else {
      // braunes Rauschen (leckender Integrator), mittelwertfrei
      let last = 0;
      for (let i = 0; i < total; i++) { last = last * 0.985 + (rng() * 2 - 1) * 0.15; d[i] = last; }
      let m = 0; for (let i = 0; i < total; i++) m += d[i]; m /= total;
      for (let i = 0; i < total; i++) d[i] -= m;
    }
    tmp.push(d);
  }
  const len = total - fade;
  for (const d of tmp) seamless(d, fade);
  normalizeRms(tmp.map((d) => d.subarray(0, len)), 0.25);
  const b = ctx.createBuffer(channels, len, sr);
  for (let ch = 0; ch < channels; ch++) b.getChannelData(ch).set(tmp[ch].subarray(0, len));
  return b;
}

// Prasseln: spärliche Impulse mit kurzem Ausklang (Regentropfen, Feuerknistern).
function makeCrackle(ctx, seconds, density, decayMs, rng, bright) {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const b = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    const n = Math.floor(seconds * density);
    for (let k = 0; k < n; k++) {
      const at = Math.floor(rng() * len);
      const amp = Math.pow(rng(), 2.2) * (rng() < 0.5 ? -1 : 1);
      const dec = (decayMs * (0.4 + rng())) / 1000 * sr;
      const f = bright * (0.6 + rng() * 0.8) / sr * Math.PI * 2;
      const L = Math.min(len, at + Math.floor(dec * 5));
      for (let i = at; i < L; i++) {
        const t = i - at;
        d[i % len] += amp * Math.exp(-t / dec) * (bright ? Math.sin(t * f) : (rng() * 2 - 1));
      }
    }
  }
  normalizeRms([b.getChannelData(0), b.getChannelData(1)], 0.2);
  // Spitzen weich begrenzen (sonst ist der Scheitelfaktor zu hoch)
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = 0.8 * Math.tanh(d[i] / 0.8); }
  return b;
}

export function buffers(ctx) {
  let c = bufCache.get(ctx);
  if (c) return c;
  const rng = mulberry32(0x5eed);
  c = {
    white: makeNoise(ctx, 2, 'white', 2, rng),
    pink: makeNoise(ctx, 3, 'pink', 2, rng),
    brown: makeNoise(ctx, 3, 'brown', 2, rng),
    drops: makeCrackle(ctx, 2.5, 260, 3, rng, 2600),
    crackle: makeCrackle(ctx, 3, 70, 6, rng, 0),
  };
  bufCache.set(ctx, c);
  return c;
}

// Stereo-Impulsantwort: frühe Reflexionen + Nachhall, der mit der Zeit dunkler wird.
export function makeImpulse(ctx, seconds, { decay = 3, damp = 0.5, pre = 0.012, early = 6, seed = 7 } = {}) {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(sr * seconds));
  const ir = ctx.createBuffer(2, len, sr);
  const rng = mulberry32(seed);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    const p0 = Math.floor(pre * sr);
    for (let i = p0; i < len; i++) {
      const t = (i - p0) / (len - p0);
      const env = Math.pow(1 - t, decay) * Math.exp(-t * 2);
      const a = 0.95 - damp * 0.85 * t; // Luftdämpfung: später weniger Höhen
      lp += a * ((rng() * 2 - 1) - lp);
      d[i] = lp * env;
    }
    for (let k = 0; k < early; k++) {
      const at = p0 + Math.floor((0.004 + rng() * 0.07) * sr);
      if (at < len) d[at] += (rng() < 0.5 ? -1 : 1) * (0.5 - k * 0.05);
    }
  }
  return ir;
}

// ---------- Kleine Knoten-Helfer
export function gainNode(ctx, v = 1) { const g = ctx.createGain(); g.gain.value = v; return g; }

export function filter(ctx, type, freq, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  return f;
}

export function panner(ctx, v = 0) {
  if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(v, -1, 1); return p; }
  const g = ctx.createGain(); g.pan = { value: 0, setValueAtTime() {}, setTargetAtTime() {}, linearRampToValueAtTime() {} }; return g;
}

export function osc(ctx, type, freq, t) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  return o;
}

// Puffer-Quelle aus einem geteilten Rauschpuffer mit zufälligem Einstieg.
export function noiseSrc(ctx, buf, t, dur, loop = false, rate = 1) {
  const s = ctx.createBufferSource();
  s.buffer = buf;
  s.loop = loop;
  s.playbackRate.value = rate;
  const off = Math.random() * Math.max(0.01, buf.duration - (loop ? 0 : Math.min(dur, buf.duration * 0.5)));
  if (loop) s.start(t, off);
  else {
    s.loop = dur > buf.duration - off;
    s.start(t, off, dur);
  }
  return s;
}

// Hüllkurve: schneller Anstieg, exponentielles Abklingen. Gibt das Ende zurück.
export function adEnv(param, t, peak, a, d, floor = 0.0001) {
  param.cancelScheduledValues(t);
  param.setValueAtTime(floor, t);
  param.linearRampToValueAtTime(peak, t + a);
  param.exponentialRampToValueAtTime(floor, t + a + d);
  return t + a + d;
}

// Hüllkurve mit Halten: Anstieg, Halten, Ausklang (für Flächen, Sirenen, Rauschstöße).
export function ahrEnv(param, t, peak, a, h, r, floor = 0.0001) {
  param.cancelScheduledValues(t);
  param.setValueAtTime(floor, t);
  param.linearRampToValueAtTime(peak, t + a);
  param.setValueAtTime(peak, t + a + h);
  param.exponentialRampToValueAtTime(floor, t + a + h + r);
  return t + a + h + r;
}

// Gibt die Kette frei, sobald die Quelle endet (schnellere Speicherbereinigung).
export function autoFree(src, ...nodes) {
  src.onended = () => { try { src.disconnect(); for (const n of nodes) n.disconnect(); } catch (e) { /* schon getrennt */ } };
}

// ---------- Stimmenbegrenzung
// Zählt laufende Ereignisse pro Gruppe und lehnt neue ab, wenn die Grenze erreicht ist.
export class Voices {
  constructor(max) { this.max = max; this.ends = []; }
  prune(now) { if (this.ends.length) this.ends = this.ends.filter((e) => e > now); }
  count(now) { this.prune(now); return this.ends.length; }
  take(now, end, force = false) {
    this.prune(now);
    if (!force && this.ends.length >= this.max) return false;
    this.ends.push(end);
    return true;
  }
}
