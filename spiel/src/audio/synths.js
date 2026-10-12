// Klangerzeuger für Einzelereignisse: Tiere, Stadtgeräusche, Wetter, Fahrzeuge, Katastrophen.
// Jede Funktion baut eine kleine Knotenkette, plant sie ab Zeitpunkt t und gibt das Ende zurück.
// Signatur: fn(ctx, dest, t, o) – dest = { dry, send } (Bus-Eingänge), o = { gain, pan, send, … }.
// Wo es geht, steuert EIN Oszillator mehrere Töne über Automation (spart Knoten).
import { buffers, gainNode, filter, panner, osc, noiseSrc, adEnv, ahrEnv, rand, pick, clamp } from './core.js';

// Ausgang eines Ereignisses: Pegel → Stereo-Position → trocken (+ Hall). release(src) trennt beim Ende.
export function voiceOut(ctx, dest, o = {}) {
  const g = gainNode(ctx, o.gain == null ? 1 : o.gain);
  const p = panner(ctx, o.pan || 0);
  g.connect(p);
  p.connect(dest.dry);
  let s = null;
  if (o.send > 0 && dest.send) { s = gainNode(ctx, o.send); p.connect(s); s.connect(dest.send); }
  return {
    node: g, pan: p,
    release(src) {
      src.onended = () => { try { p.disconnect(); if (s) s.disconnect(); g.disconnect(); } catch (e) { /* schon getrennt */ } };
    },
  };
}

// Gepulste Hüllkurve auf einem Gain-Parameter (mehrere kurze Töne mit einem Knoten).
function pulses(param, list, floor = 0) {
  for (const [t0, peak, a, d] of list) {
    param.setValueAtTime(floor, t0);
    param.linearRampToValueAtTime(peak, t0 + a);
    param.linearRampToValueAtTime(floor, t0 + a + d);
  }
}

// ======================================================= Vögel und Tiere
// Gezwitscher: 2–5 fallende Pfiffe
export function birdTweet(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const o1 = osc(ctx, 'sine', 4000, t);
  const g = gainNode(ctx, 0);
  o1.connect(g); g.connect(v.node);
  const n = 2 + Math.floor(Math.random() * 4);
  const base = (o.f || rand(3200, 5200)) ;
  const dur = rand(0.05, 0.09), gap = rand(0.09, 0.16);
  const list = [];
  for (let k = 0; k < n; k++) {
    const tk = t + k * gap;
    const f0 = base * rand(0.95, 1.08);
    o1.frequency.setValueAtTime(f0, tk);
    o1.frequency.exponentialRampToValueAtTime(f0 * rand(0.5, 0.65), tk + dur);
    list.push([tk, rand(0.6, 1), 0.008, dur - 0.008]);
  }
  pulses(g.gain, list);
  const end = t + n * gap + 0.05;
  o1.start(t); o1.stop(end);
  v.release(o1);
  return end;
}

// Triller: viele kurze, steigende Töne
export function birdTrill(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const o1 = osc(ctx, 'sine', 4000, t);
  const g = gainNode(ctx, 0);
  o1.connect(g); g.connect(v.node);
  const n = 8 + Math.floor(Math.random() * 9);
  const f = o.f || rand(3600, 5000), dur = 0.03, gap = rand(0.045, 0.065);
  const list = [];
  for (let k = 0; k < n; k++) {
    const tk = t + k * gap;
    const fk = f * (1 + 0.04 * Math.sin(k * 0.9)) * rand(0.98, 1.02);
    o1.frequency.setValueAtTime(fk * 0.85, tk);
    o1.frequency.exponentialRampToValueAtTime(fk * 1.1, tk + dur);
    list.push([tk, 0.5 + 0.5 * Math.sin((k / n) * Math.PI), 0.005, dur - 0.005]);
  }
  pulses(g.gain, list);
  const end = t + n * gap + 0.05;
  o1.start(t); o1.stop(end);
  v.release(o1);
  return end;
}

// Trällern: frequenzmodulierter Pfiff
export function birdWarble(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const f = o.f || rand(2600, 3800);
  const dur = rand(0.4, 0.9);
  const o1 = osc(ctx, 'sine', f, t);
  const lfo = osc(ctx, 'sine', rand(22, 38), t);
  const depth = gainNode(ctx, rand(250, 600));
  lfo.connect(depth); depth.connect(o1.frequency);
  o1.frequency.linearRampToValueAtTime(f * rand(0.85, 1.2), t + dur);
  const g = gainNode(ctx, 0);
  o1.connect(g); g.connect(v.node);
  ahrEnv(g.gain, t, 0.8, 0.04, dur - 0.12, 0.08);
  o1.start(t); lfo.start(t); o1.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  v.release(o1);
  return t + dur;
}

// Amsel: flötende Strophe mit Gleittönen und hohem Abschluss (Morgen- und Abendgesang)
export function blackbird(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const o1 = osc(ctx, 'sine', 2000, t);
  const vib = osc(ctx, 'sine', 6.5, t);
  const vd = gainNode(ctx, 28);
  vib.connect(vd); vd.connect(o1.frequency);
  const g = gainNode(ctx, 0);
  o1.connect(g); g.connect(v.node);
  const notes = [1700, 1950, 2200, 2450, 2750, 3050];
  let tk = t;
  const n = 4 + Math.floor(Math.random() * 4);
  g.gain.setValueAtTime(0, t);
  for (let k = 0; k < n; k++) {
    const d = rand(0.09, 0.22);
    const f0 = pick(notes) * rand(0.97, 1.03), f1 = pick(notes);
    o1.frequency.setValueAtTime(f0, tk);
    o1.frequency.linearRampToValueAtTime(f1, tk + d);
    g.gain.setValueAtTime(0, tk);
    g.gain.linearRampToValueAtTime(rand(0.5, 1), tk + 0.02);
    g.gain.linearRampToValueAtTime(0, tk + d);
    tk += d + rand(0.02, 0.07);
  }
  // hohes Zwitschern am Ende
  for (let k = 0; k < 4; k++) {
    o1.frequency.setValueAtTime(rand(5000, 6200), tk);
    o1.frequency.exponentialRampToValueAtTime(4200, tk + 0.03);
    g.gain.setValueAtTime(0, tk); g.gain.linearRampToValueAtTime(0.35, tk + 0.005); g.gain.linearRampToValueAtTime(0, tk + 0.03);
    tk += 0.045;
  }
  o1.start(t); vib.start(t); o1.stop(tk + 0.05); vib.stop(tk + 0.05);
  v.release(o1);
  return tk;
}

// Spatz: „tschilp" – kurze, etwas raue Töne
export function sparrow(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const o1 = osc(ctx, 'triangle', 3500, t);
  const g = gainNode(ctx, 0);
  o1.connect(g); g.connect(v.node);
  const n = 2 + Math.floor(Math.random() * 3);
  const list = [];
  let tk = t;
  for (let k = 0; k < n; k++) {
    const f0 = rand(3300, 3900);
    o1.frequency.setValueAtTime(f0, tk);
    o1.frequency.linearRampToValueAtTime(f0 * 1.12, tk + 0.02);
    o1.frequency.exponentialRampToValueAtTime(f0 * 0.78, tk + 0.07);
    list.push([tk, rand(0.5, 0.9), 0.006, 0.064]);
    tk += rand(0.12, 0.25);
  }
  pulses(g.gain, list);
  o1.start(t); o1.stop(tk + 0.05);
  v.release(o1);
  return tk;
}

// Kohlmeise: „zi-zi-bäh"
export function greatTit(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const o1 = osc(ctx, 'sine', 5000, t);
  const g = gainNode(ctx, 0);
  o1.connect(g); g.connect(v.node);
  const hi = rand(4600, 5600), lo = hi * rand(0.66, 0.74);
  const reps = 2 + Math.floor(Math.random() * 2);
  const list = [];
  let tk = t;
  for (let r = 0; r < reps; r++) {
    for (const [f, d] of [[hi, 0.08], [lo, 0.13]]) {
      o1.frequency.setValueAtTime(f, tk);
      o1.frequency.linearRampToValueAtTime(f * 0.96, tk + d);
      list.push([tk, 0.8, 0.01, d - 0.01]);
      tk += d + 0.05;
    }
  }
  pulses(g.gain, list);
  o1.start(t); o1.stop(tk + 0.05);
  v.release(o1);
  return tk;
}

// Taube: weiches „gru-guu-gu"
export function pigeon(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const f = rand(380, 470);
  const o1 = osc(ctx, 'sine', f, t);
  const am = osc(ctx, 'sine', rand(10, 14), t);
  const amd = gainNode(ctx, 0.25);
  const g = gainNode(ctx, 0);
  const g2 = gainNode(ctx, 0.75);
  am.connect(amd); amd.connect(g2.gain);
  o1.connect(g2); g2.connect(g); g.connect(v.node);
  let tk = t;
  g.gain.setValueAtTime(0, t);
  for (const [mul, d] of [[1, 0.22], [1.12, 0.42], [0.95, 0.25]]) {
    o1.frequency.setValueAtTime(f * mul * 0.94, tk);
    o1.frequency.linearRampToValueAtTime(f * mul, tk + d * 0.4);
    o1.frequency.linearRampToValueAtTime(f * mul * 0.9, tk + d);
    g.gain.setValueAtTime(0, tk);
    g.gain.linearRampToValueAtTime(0.9, tk + 0.06);
    g.gain.linearRampToValueAtTime(0, tk + d);
    tk += d + 0.08;
  }
  o1.start(t); am.start(t); o1.stop(tk); am.stop(tk);
  v.release(o1);
  return tk;
}

// Krähe: raues „kraa", 2–3 Mal
export function crow(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const o1 = osc(ctx, 'sawtooth', 560, t);
  const bp = filter(ctx, 'bandpass', 1350, 4);
  const rasp = osc(ctx, 'square', 34, t);
  const rd = gainNode(ctx, 0.35);
  const g = gainNode(ctx, 0);
  const ga = gainNode(ctx, 0.65);
  rasp.connect(rd); rd.connect(ga.gain);
  o1.connect(bp); bp.connect(ga); ga.connect(g); g.connect(v.node);
  const n = 2 + Math.floor(Math.random() * 2);
  let tk = t;
  for (let k = 0; k < n; k++) {
    const d = rand(0.26, 0.36);
    o1.frequency.setValueAtTime(rand(540, 600), tk);
    o1.frequency.linearRampToValueAtTime(rand(440, 480), tk + d);
    g.gain.setValueAtTime(0, tk);
    g.gain.linearRampToValueAtTime(1, tk + 0.03);
    g.gain.linearRampToValueAtTime(0.7, tk + d * 0.6);
    g.gain.linearRampToValueAtTime(0, tk + d);
    tk += d + rand(0.2, 0.35);
  }
  o1.start(t); rasp.start(t); o1.stop(tk); rasp.stop(tk);
  v.release(o1);
  return tk;
}

// Kuckuck (Frühling, Waldrand)
export function cuckoo(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const o1 = osc(ctx, 'sine', 680, t);
  const g = gainNode(ctx, 0);
  o1.connect(g); g.connect(v.node);
  const f1 = rand(660, 720), f2 = f1 * 0.81;
  const reps = 2 + Math.floor(Math.random() * 3);
  let tk = t;
  for (let r = 0; r < reps; r++) {
    o1.frequency.setValueAtTime(f1, tk);
    g.gain.setValueAtTime(0, tk); g.gain.linearRampToValueAtTime(0.9, tk + 0.03); g.gain.linearRampToValueAtTime(0, tk + 0.17);
    o1.frequency.setValueAtTime(f2, tk + 0.24);
    o1.frequency.linearRampToValueAtTime(f2 * 0.97, tk + 0.56);
    g.gain.setValueAtTime(0, tk + 0.24); g.gain.linearRampToValueAtTime(0.85, tk + 0.28); g.gain.linearRampToValueAtTime(0, tk + 0.56);
    tk += 0.95;
  }
  o1.start(t); o1.stop(tk);
  v.release(o1);
  return tk;
}

// Specht: schneller Trommelwirbel
export function woodpecker(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const B = buffers(ctx);
  const n = 12 + Math.floor(Math.random() * 10);
  const rate = rand(14, 19);
  const dur = n / rate + 0.1;
  const src = noiseSrc(ctx, B.white, t, dur);
  const bp = filter(ctx, 'bandpass', rand(900, 1400), 3);
  const g = gainNode(ctx, 0);
  src.connect(bp); bp.connect(g); g.connect(v.node);
  const list = [];
  for (let k = 0; k < n; k++) list.push([t + k / rate, 1.6 * (1 - k / n * 0.6), 0.001, 0.012]);
  pulses(g.gain, list);
  v.release(src);
  return t + dur;
}

// Waldkauz nachts: „huu … hu-hu-huuuu"
export function owl(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const f = rand(380, 440);
  const o1 = osc(ctx, 'sine', f, t);
  const vib = osc(ctx, 'sine', 7, t);
  const vd = gainNode(ctx, 0);
  vib.connect(vd); vd.connect(o1.frequency);
  const g = gainNode(ctx, 0);
  o1.connect(g); g.connect(v.node);
  const seq = [[0, 0.6, 1, 0], [1.6, 0.16, 0.8, 0], [1.85, 0.16, 0.8, 0], [2.1, 1.1, 1, 9]];
  for (const [dt, d, a, vibAmt] of seq) {
    const tk = t + dt;
    o1.frequency.setValueAtTime(f * 0.92, tk);
    o1.frequency.linearRampToValueAtTime(f, tk + Math.min(0.12, d * 0.5));
    vd.gain.setValueAtTime(vibAmt, tk);
    g.gain.setValueAtTime(0, tk); g.gain.linearRampToValueAtTime(a, tk + 0.06); g.gain.setValueAtTime(a, tk + d * 0.7); g.gain.linearRampToValueAtTime(0, tk + d);
  }
  o1.start(t); vib.start(t); o1.stop(t + 3.4); vib.stop(t + 3.4);
  v.release(o1);
  return t + 3.3;
}

// Frosch: gepulstes Quaken
export function frog(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const o1 = osc(ctx, 'sawtooth', rand(95, 135), t);
  const bp = filter(ctx, 'bandpass', rand(550, 800), 5);
  const g = gainNode(ctx, 0);
  o1.connect(bp); bp.connect(g); g.connect(v.node);
  const croaks = 1 + Math.floor(Math.random() * 3);
  const list = [];
  let tk = t;
  for (let c = 0; c < croaks; c++) {
    const n = 6 + Math.floor(Math.random() * 5), rate = rand(20, 26);
    for (let k = 0; k < n; k++) list.push([tk + k / rate, 1, 0.006, 0.026]);
    tk += n / rate + rand(0.25, 0.5);
  }
  pulses(g.gain, list);
  o1.start(t); o1.stop(tk);
  v.release(o1);
  return tk;
}

// Hahn: „Ki-ke-ri-kiii" (Bauernhof, Morgengrauen)
export function rooster(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const o1 = osc(ctx, 'sawtooth', 600, t);
  const b1 = filter(ctx, 'bandpass', 1500, 2.2), b2 = filter(ctx, 'bandpass', 2900, 3);
  const g2 = gainNode(ctx, 0.5);
  const rough = osc(ctx, 'sine', 31, t), rd = gainNode(ctx, 0.25), ga = gainNode(ctx, 0.75);
  rough.connect(rd); rd.connect(ga.gain);
  const g = gainNode(ctx, 0);
  o1.connect(b1); o1.connect(b2); b2.connect(g2); b1.connect(ga); g2.connect(ga); ga.connect(g); g.connect(v.node);
  const syl = [[0, 0.12, 620, 880], [0.17, 0.12, 820, 860], [0.34, 0.14, 950, 1050], [0.54, 0.75, 1100, 700]];
  for (const [dt, d, f0, f1] of syl) {
    const tk = t + dt;
    o1.frequency.setValueAtTime(f0, tk);
    o1.frequency.linearRampToValueAtTime(f1, tk + d);
    g.gain.setValueAtTime(0, tk); g.gain.linearRampToValueAtTime(1, tk + 0.03); g.gain.setValueAtTime(1, tk + d * 0.75); g.gain.linearRampToValueAtTime(0, tk + d);
  }
  o1.start(t); rough.start(t); o1.stop(t + 1.4); rough.stop(t + 1.4);
  v.release(o1);
  return t + 1.4;
}

// Kuh: „Muuuh" – das Maul öffnet sich (Filter auf) und schließt sich wieder
export function cow(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const f = rand(100, 125);
  const o1 = osc(ctx, 'sawtooth', f, t);
  o1.frequency.linearRampToValueAtTime(f * 1.12, t + 0.5);
  o1.frequency.linearRampToValueAtTime(f * 0.85, t + 1.5);
  const lp = filter(ctx, 'lowpass', 300, 3);
  lp.frequency.setValueAtTime(280, t); lp.frequency.linearRampToValueAtTime(1000, t + 0.6); lp.frequency.linearRampToValueAtTime(350, t + 1.5);
  const g = gainNode(ctx, 0);
  o1.connect(lp); lp.connect(g); g.connect(v.node);
  ahrEnv(g.gain, t, 0.7, 0.15, 1.1, 0.35);
  o1.start(t); o1.stop(t + 1.7);
  v.release(o1);
  return t + 1.7;
}

// Rasenmäher in der Ferne (Sommerwochenende im Wohngebiet)
export function lawnmower(ctx, dest, t, o = {}) {
  const B = buffers(ctx);
  const v = voiceOut(ctx, dest, o);
  const dur = o.dur || rand(5, 9);
  const f = rand(85, 105);
  const eng = osc(ctx, 'sawtooth', f, t);
  const wob = osc(ctx, 'sine', rand(0.2, 0.4), t), wd = gainNode(ctx, 6);
  wob.connect(wd); wd.connect(eng.frequency);
  const lp = filter(ctx, 'lowpass', 1300, 1.2);
  const n = noiseSrc(ctx, B.pink, t, dur + 1), bp = filter(ctx, 'bandpass', 2600, 1), ng = gainNode(ctx, 0.25);
  const g = gainNode(ctx, 0);
  eng.connect(lp); lp.connect(g); n.connect(bp); bp.connect(ng); ng.connect(g); g.connect(v.node);
  // Lastwechsel beim Mähen: Pegel schwankt langsam
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + 1);
  for (let k = 1; k < dur - 1; k += 1.3) g.gain.linearRampToValueAtTime(rand(0.3, 0.6), t + k);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  eng.start(t); wob.start(t); eng.stop(t + dur + 0.05); wob.stop(t + dur + 0.05);
  v.release(eng);
  return t + dur;
}

// Schienenstoß der Pulsbahn: „ta-dam"
export function railClack(ctx, dest, t, o = {}) {
  const B = buffers(ctx);
  const v = voiceOut(ctx, dest, o);
  const src = noiseSrc(ctx, B.white, t, 0.2);
  const bp = filter(ctx, 'bandpass', 1700, 2);
  const g = gainNode(ctx, 0);
  src.connect(bp); bp.connect(g); g.connect(v.node);
  pulses(g.gain, [[t, 1, 0.002, 0.018], [t + 0.095, 0.8, 0.002, 0.022]]);
  const p = osc(ctx, 'sine', 2350, t), pg = gainNode(ctx, 0);
  p.connect(pg); pg.connect(v.node);
  adEnv(pg.gain, t, 0.12, 0.002, 0.05);
  p.start(t); p.stop(t + 0.15);
  v.release(src);
  return t + 0.2;
}

// Möwe: „kjau"
export function gull(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const o1 = osc(ctx, 'triangle', 1300, t);
  const bp = filter(ctx, 'bandpass', 1900, 1.6);
  const g = gainNode(ctx, 0);
  o1.connect(bp); bp.connect(g); g.connect(v.node);
  const n = 2 + Math.floor(Math.random() * 3);
  let tk = t;
  for (let k = 0; k < n; k++) {
    const d = rand(0.28, 0.42), f = rand(1150, 1400);
    o1.frequency.setValueAtTime(f, tk);
    o1.frequency.linearRampToValueAtTime(f * 1.6, tk + d * 0.3);
    o1.frequency.exponentialRampToValueAtTime(f * 0.8, tk + d);
    g.gain.setValueAtTime(0, tk); g.gain.linearRampToValueAtTime(1, tk + 0.04); g.gain.linearRampToValueAtTime(0, tk + d);
    tk += d + rand(0.08, 0.3);
  }
  o1.start(t); o1.stop(tk);
  v.release(o1);
  return tk;
}

// Grille: ein Zirpen (3–4 Pulse) auf einem Dauer-Gain einer Grillenstimme
export function cricketChirp(param, t, peak) {
  const n = 3 + (Math.random() < 0.4 ? 1 : 0);
  for (let k = 0; k < n; k++) {
    const tk = t + k * 0.024;
    param.setValueAtTime(0, tk);
    param.linearRampToValueAtTime(peak, tk + 0.004);
    param.linearRampToValueAtTime(peak * 0.8, tk + 0.011);
    param.linearRampToValueAtTime(0, tk + 0.014);
  }
  return t + n * 0.024;
}

// ======================================================= Straße
// Vorbeifahrendes Auto (Doppler): Reifenrauschen + Motor, wandert durchs Stereobild
export function carPass(ctx, dest, t, o = {}) {
  const B = buffers(ctx);
  const dir = o.dir || (Math.random() < 0.5 ? -1 : 1);
  const heavy = !!o.heavy;
  const dur = (heavy ? rand(3.2, 4.2) : rand(2, 3.2)) / (o.speed || 1);
  const v = voiceOut(ctx, dest, { ...o, pan: 0 });
  v.pan.pan.setValueAtTime(-0.85 * dir, t);
  v.pan.pan.linearRampToValueAtTime(0.85 * dir, t + dur);
  const mid = t + dur * rand(0.42, 0.55);
  const src = noiseSrc(ctx, B.pink, t, dur + 0.1);
  const bp = filter(ctx, 'bandpass', 450, 0.8);
  bp.frequency.setValueAtTime(heavy ? 300 : 450, t);
  bp.frequency.exponentialRampToValueAtTime(heavy ? 700 : 1150, mid);
  bp.frequency.exponentialRampToValueAtTime(heavy ? 260 : 420, t + dur);
  const eng = osc(ctx, 'sawtooth', 1, t);
  const f0 = heavy ? rand(48, 62) : rand(70, 115);
  eng.frequency.setValueAtTime(f0 * 1.05, t);
  eng.frequency.linearRampToValueAtTime(f0 * 1.04, mid - 0.15);
  eng.frequency.linearRampToValueAtTime(f0 * 0.93, mid + 0.25);
  const lp = filter(ctx, 'lowpass', heavy ? 260 : 360, 1.2);
  const eg = gainNode(ctx, heavy ? 0.9 : 0.55);
  const g = gainNode(ctx, 0);
  src.connect(bp); bp.connect(g);
  eng.connect(lp); lp.connect(eg); eg.connect(g);
  g.connect(v.node);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1, mid);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  eng.start(t); eng.stop(t + dur + 0.05);
  v.release(eng);
  return t + dur;
}

// Hupe (manchmal doppelt)
export function horn(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const f = o.f || rand(370, 440);
  const a = osc(ctx, 'square', f, t), b = osc(ctx, 'square', f * 1.26, t);
  const lp = filter(ctx, 'lowpass', 1700, 0.8);
  const g = gainNode(ctx, 0);
  a.connect(lp); b.connect(lp); lp.connect(g); g.connect(v.node);
  const dbl = Math.random() < 0.4;
  pulses(g.gain, dbl ? [[t, 0.5, 0.01, 0.13], [t + 0.2, 0.5, 0.01, 0.3]] : [[t, 0.5, 0.01, rand(0.2, 0.45)]]);
  const end = t + (dbl ? 0.55 : 0.5);
  a.start(t); b.start(t); a.stop(end); b.stop(end);
  v.release(a);
  return end;
}

// Fahrradklingel
export function bikeBell(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const parts = [[2650, 0.5, 0.45], [4120, 0.3, 0.3], [6900, 0.12, 0.15]];
  let last = null;
  for (const [f, a, d] of parts) {
    const o1 = osc(ctx, 'sine', f * rand(0.98, 1.02), t);
    const g = gainNode(ctx, 0);
    o1.connect(g); g.connect(v.node);
    g.gain.setValueAtTime(0, t);
    for (const tk of [t, t + 0.13]) { g.gain.setValueAtTime(0.0001, tk); g.gain.linearRampToValueAtTime(a, tk + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, tk + d); }
    o1.start(t); o1.stop(t + 0.13 + d + 0.02);
    last = o1;
  }
  v.release(last);
  return t + 0.6;
}

// Bremsen und Türgong des Busses an der Haltestelle
export function busStop(ctx, dest, t, o = {}) {
  const B = buffers(ctx);
  const v = voiceOut(ctx, dest, o);
  const hiss = noiseSrc(ctx, B.white, t, 0.9);
  const hp = filter(ctx, 'highpass', 2600, 0.7);
  const hg = gainNode(ctx, 0);
  hiss.connect(hp); hp.connect(hg); hg.connect(v.node);
  ahrEnv(hg.gain, t, 0.28, 0.01, 0.12, 0.6);
  const dies = osc(ctx, 'sawtooth', 56, t);
  const lp = filter(ctx, 'bandpass', 220, 0.9);
  const dg = gainNode(ctx, 0);
  dies.connect(lp); lp.connect(dg); dg.connect(v.node);
  ahrEnv(dg.gain, t, 0.22, 0.2, 1.4, 0.6);
  // Türgong (Ding-Dong)
  const f1 = o.f1 || 784, f2 = o.f2 || 659;
  const c = osc(ctx, 'sine', f1, t + 0.6);
  const cg = gainNode(ctx, 0);
  c.connect(cg); cg.connect(v.node);
  c.frequency.setValueAtTime(f2, t + 1.0);
  cg.gain.setValueAtTime(0, t + 0.6); cg.gain.linearRampToValueAtTime(0.22, t + 0.605); cg.gain.exponentialRampToValueAtTime(0.03, t + 0.98);
  cg.gain.setValueAtTime(0.03, t + 1.0); cg.gain.linearRampToValueAtTime(0.22, t + 1.005); cg.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
  dies.start(t); c.start(t + 0.6); dies.stop(t + 2.3); c.stop(t + 2.0);
  v.release(dies);
  return t + 2.3;
}

// ======================================================= Baustelle und Industrie
// Hammerschläge: Gruppe aus 3–6 Schlägen (ein Rauschquell + ein Oszillator für alle)
export function hammer(ctx, dest, t, o = {}) {
  const B = buffers(ctx);
  const v = voiceOut(ctx, dest, o);
  const n = 3 + Math.floor(Math.random() * 4);
  const gap = rand(0.36, 0.52);
  const dur = n * gap + 0.2;
  const src = noiseSrc(ctx, B.white, t, dur);
  const bp = filter(ctx, 'bandpass', rand(1800, 2600), 1.8);
  const ng = gainNode(ctx, 0);
  src.connect(bp); bp.connect(ng); ng.connect(v.node);
  const ping = osc(ctx, 'sine', rand(1400, 1900), t);
  const pg = gainNode(ctx, 0);
  ping.connect(pg); pg.connect(v.node);
  for (let k = 0; k < n; k++) {
    const tk = t + k * gap + rand(-0.02, 0.02);
    const a = k === n - 1 ? 1 : rand(0.6, 0.9);
    ng.gain.setValueAtTime(0, tk); ng.gain.linearRampToValueAtTime(1.6 * a, tk + 0.002); ng.gain.exponentialRampToValueAtTime(0.0001, tk + 0.04);
    pg.gain.setValueAtTime(0, tk); pg.gain.linearRampToValueAtTime(0.25 * a, tk + 0.002); pg.gain.exponentialRampToValueAtTime(0.0001, tk + 0.12);
  }
  ping.start(t); ping.stop(t + dur);
  v.release(ping);
  return t + dur;
}

// Bohrmaschine / Akkuschrauber
export function drill(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const dur = rand(0.8, 1.8);
  const f = rand(150, 210);
  const o1 = osc(ctx, 'sawtooth', f * 0.4, t);
  o1.frequency.exponentialRampToValueAtTime(f, t + 0.25);
  o1.frequency.setValueAtTime(f, t + dur - 0.2);
  o1.frequency.exponentialRampToValueAtTime(f * 0.5, t + dur);
  const wob = osc(ctx, 'sine', 7, t);
  const wd = gainNode(ctx, 6);
  wob.connect(wd); wd.connect(o1.frequency);
  const bp = filter(ctx, 'bandpass', 1500, 1.4);
  const g = gainNode(ctx, 0);
  o1.connect(bp); bp.connect(g); g.connect(v.node);
  ahrEnv(g.gain, t, 0.5, 0.08, dur - 0.25, 0.15);
  o1.start(t); wob.start(t); o1.stop(t + dur + 0.05); wob.stop(t + dur + 0.05);
  v.release(o1);
  return t + dur;
}

// Rückfahrwarner
export function beeper(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const o1 = osc(ctx, 'sine', 1040, t);
  const g = gainNode(ctx, 0);
  o1.connect(g); g.connect(v.node);
  const n = 4 + Math.floor(Math.random() * 3);
  const list = [];
  for (let k = 0; k < n; k++) list.push([t + k * 0.7, 0.35, 0.01, 0.34]);
  pulses(g.gain, list);
  o1.start(t); o1.stop(t + n * 0.7);
  v.release(o1);
  return t + n * 0.7;
}

// Metallisches Klirren (inharmonische Teiltöne)
export function clank(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const base = o.f || rand(300, 520);
  let last;
  for (const [r, a, d] of [[1, 0.5, 0.5], [2.7, 0.35, 0.3], [5.6, 0.2, 0.15]]) {
    const o1 = osc(ctx, 'sine', base * r * rand(0.98, 1.02), t);
    const g = gainNode(ctx, 0);
    o1.connect(g); g.connect(v.node);
    adEnv(g.gain, t, a, 0.002, d);
    o1.start(t); o1.stop(t + d + 0.05);
    last = o1;
  }
  v.release(last);
  return t + 0.55;
}

// Stampfende Presse: tiefe Schläge im Maschinentakt
export function press(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const n = 3 + Math.floor(Math.random() * 6);
  const per = rand(0.7, 1.1);
  const o1 = osc(ctx, 'sine', 70, t);
  const g = gainNode(ctx, 0);
  o1.connect(g); g.connect(v.node);
  for (let k = 0; k < n; k++) {
    const tk = t + k * per;
    o1.frequency.setValueAtTime(rand(78, 90), tk);
    o1.frequency.exponentialRampToValueAtTime(38, tk + 0.16);
    g.gain.setValueAtTime(0, tk); g.gain.linearRampToValueAtTime(0.9, tk + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, tk + 0.22);
  }
  const end = t + n * per;
  o1.start(t); o1.stop(end);
  v.release(o1);
  return end;
}

// Dampf ablassen
export function steam(ctx, dest, t, o = {}) {
  const B = buffers(ctx);
  const v = voiceOut(ctx, dest, o);
  const dur = rand(0.8, 1.8);
  const src = noiseSrc(ctx, B.white, t, dur + 0.6);
  const hp = filter(ctx, 'highpass', rand(1600, 2600), 0.7);
  const g = gainNode(ctx, 0);
  src.connect(hp); hp.connect(g); g.connect(v.node);
  ahrEnv(g.gain, t, 0.35, 0.05, dur * 0.4, dur * 0.6);
  v.release(src);
  return t + dur + 0.1;
}

// Kreissäge im Sägewerk
export function saw(ctx, dest, t, o = {}) {
  const B = buffers(ctx);
  const v = voiceOut(ctx, dest, o);
  const dur = rand(1.6, 2.8);
  const f = rand(850, 1050);
  const o1 = osc(ctx, 'sawtooth', f, t);
  o1.frequency.setValueAtTime(f, t + 0.3);
  o1.frequency.linearRampToValueAtTime(f * 0.8, t + 0.6);
  o1.frequency.setValueAtTime(f * 0.8, t + dur - 0.5);
  o1.frequency.linearRampToValueAtTime(f, t + dur - 0.25);
  const bp = filter(ctx, 'bandpass', 2300, 2);
  const chips = noiseSrc(ctx, B.white, t, dur);
  const cb = filter(ctx, 'bandpass', 4200, 1);
  const cg = gainNode(ctx, 0.4);
  const g = gainNode(ctx, 0);
  o1.connect(bp); bp.connect(g); chips.connect(cb); cb.connect(cg); cg.connect(g); g.connect(v.node);
  ahrEnv(g.gain, t, 0.3, 0.15, dur - 0.4, 0.25);
  o1.start(t); o1.stop(t + dur + 0.05);
  v.release(o1);
  return t + dur;
}

// ======================================================= Wasser
export function lap(ctx, dest, t, o = {}) {
  const B = buffers(ctx);
  const v = voiceOut(ctx, dest, o);
  const dur = rand(0.6, 1.2);
  const src = noiseSrc(ctx, B.brown, t, dur + 0.2);
  const bp = filter(ctx, 'bandpass', rand(320, 650), 1.2);
  const g = gainNode(ctx, 0);
  src.connect(bp); bp.connect(g); g.connect(v.node);
  ahrEnv(g.gain, t, 1.2, dur * 0.35, 0.05, dur * 0.6);
  v.release(src);
  return t + dur;
}

export function splash(ctx, dest, t, o = {}) {
  const B = buffers(ctx);
  const v = voiceOut(ctx, dest, o);
  const src = noiseSrc(ctx, B.white, t, 0.6);
  const bp = filter(ctx, 'bandpass', 1500, 0.9);
  bp.frequency.setValueAtTime(900, t); bp.frequency.exponentialRampToValueAtTime(2600, t + 0.15);
  const g = gainNode(ctx, 0);
  src.connect(bp); bp.connect(g); g.connect(v.node);
  adEnv(g.gain, t, 0.5, 0.01, 0.45);
  v.release(src);
  return t + 0.6;
}

// Wasserblasen (für Wasser-Gebäude)
export function bubbles(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const o1 = osc(ctx, 'sine', 300, t);
  const g = gainNode(ctx, 0);
  o1.connect(g); g.connect(v.node);
  const n = o.n || 4;
  for (let k = 0; k < n; k++) {
    const tk = t + k * rand(0.06, 0.11);
    const f = rand(350, 700);
    o1.frequency.setValueAtTime(f, tk); o1.frequency.exponentialRampToValueAtTime(f * 2.2, tk + 0.05);
    g.gain.setValueAtTime(0, tk); g.gain.linearRampToValueAtTime(0.5, tk + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, tk + 0.06);
  }
  o1.start(t); o1.stop(t + n * 0.12 + 0.1);
  v.release(o1);
  return t + n * 0.12;
}

// ======================================================= Schiffe, Bahn, Flugzeug
export function shipHorn(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const f = o.f || rand(68, 82);
  const a = osc(ctx, 'sawtooth', f, t), b = osc(ctx, 'sawtooth', f * 1.5, t);
  const lp = filter(ctx, 'lowpass', 520, 0.9);
  const g = gainNode(ctx, 0);
  a.connect(lp); b.connect(lp); lp.connect(g); g.connect(v.node);
  const d = o.dur || rand(1.4, 2.2);
  ahrEnv(g.gain, t, 0.6, 0.25, d, 0.8);
  const end = t + d + 1.1;
  a.start(t); b.start(t); a.stop(end); b.stop(end);
  v.release(a);
  return end;
}

// Nebelhorn am Leuchtturm: tiefer Ton mit „Grunzen" am Ende
export function foghorn(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const a = osc(ctx, 'sawtooth', 98, t), b = osc(ctx, 'square', 98.6, t);
  a.frequency.setValueAtTime(98, t + 2.1); a.frequency.exponentialRampToValueAtTime(78, t + 2.6);
  b.frequency.setValueAtTime(98.6, t + 2.1); b.frequency.exponentialRampToValueAtTime(78.5, t + 2.6);
  const lp = filter(ctx, 'lowpass', 360, 1.4);
  const g = gainNode(ctx, 0);
  const bg = gainNode(ctx, 0.35);
  a.connect(lp); b.connect(bg); bg.connect(lp); lp.connect(g); g.connect(v.node);
  ahrEnv(g.gain, t, 0.7, 0.4, 1.9, 0.6);
  a.start(t); b.start(t); a.stop(t + 3.1); b.stop(t + 3.1);
  v.release(a);
  return t + 3.1;
}

// Zughorn (Fernbahn) – zweistimmig
export function trainHorn(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const a = osc(ctx, 'sawtooth', 311, t), b = osc(ctx, 'sawtooth', 370, t);
  const lp = filter(ctx, 'lowpass', 1400, 0.8);
  const g = gainNode(ctx, 0);
  a.connect(lp); b.connect(lp); lp.connect(g); g.connect(v.node);
  const d = rand(0.6, 1.1);
  ahrEnv(g.gain, t, 0.3, 0.04, d, 0.3);
  a.start(t); b.start(t); a.stop(t + d + 0.4); b.stop(t + d + 0.4);
  v.release(a);
  return t + d + 0.4;
}

// Flugzeug zieht vorbei: Düsenrauschen, Pfeifen mit Doppler, wandert durchs Bild
export function jetFlyby(ctx, dest, t, o = {}) {
  const B = buffers(ctx);
  const dur = o.dur || rand(5, 7);
  const dir = Math.random() < 0.5 ? -1 : 1;
  const v = voiceOut(ctx, dest, { ...o, pan: 0 });
  v.pan.pan.setValueAtTime(-0.7 * dir, t); v.pan.pan.linearRampToValueAtTime(0.7 * dir, t + dur);
  const mid = t + dur * 0.45;
  const src = noiseSrc(ctx, B.pink, t, dur + 0.2);
  const lp = filter(ctx, 'lowpass', 400, 0.7);
  lp.frequency.setValueAtTime(350, t); lp.frequency.exponentialRampToValueAtTime(2000, mid); lp.frequency.exponentialRampToValueAtTime(450, t + dur);
  const w = osc(ctx, 'sine', 3900, t);
  w.frequency.setValueAtTime(4100, t); w.frequency.linearRampToValueAtTime(3950, mid - 0.3); w.frequency.linearRampToValueAtTime(3300, mid + 0.6);
  const wg = gainNode(ctx, 0.025);
  const g = gainNode(ctx, 0);
  src.connect(lp); lp.connect(g); w.connect(wg); wg.connect(g); g.connect(v.node);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, mid); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  w.start(t); w.stop(t + dur + 0.1);
  v.release(w);
  return t + dur;
}

// ======================================================= Glocken und Signale
// Glockenschlag (Kirchenglocke): Summton, Prime, kleine Terz, Quinte, Oktave, …
export function churchBell(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const f = o.f || 220;
  const parts = [[0.5, 0.45, 4.5], [1, 0.8, 3.4], [1.19, 0.55, 2.6], [1.5, 0.3, 2], [2, 0.42, 1.7], [2.52, 0.18, 1.1], [2.99, 0.12, 0.8]];
  let last;
  for (const [r, a, d] of parts) {
    const o1 = osc(ctx, 'sine', f * r, t);
    const g = gainNode(ctx, 0);
    o1.connect(g); g.connect(v.node);
    adEnv(g.gain, t, a, 0.004, d);
    o1.start(t); o1.stop(t + d + 0.05);
    last = o1;
  }
  v.release(last);
  return t + 4.6;
}

// Elektrische Schulklingel
export function schoolBell(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const o1 = osc(ctx, 'square', 1250, t);
  const bp = filter(ctx, 'bandpass', 1250, 2);
  const g = gainNode(ctx, 0);
  o1.connect(bp); bp.connect(g); g.connect(v.node);
  const dur = o.dur || 2.2;
  const list = [];
  for (let k = 0; k < dur * 22; k++) list.push([t + k / 22, 0.4, 0.004, 0.03]);
  pulses(g.gain, list);
  o1.start(t); o1.stop(t + dur + 0.05);
  v.release(o1);
  return t + dur;
}

// FM-Glocke (für Gong, Spieluhr, Meldungen)
export function fmBell(ctx, dest, t, f, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const c = osc(ctx, 'sine', f, t);
  const m = osc(ctx, 'sine', f * (o.ratio || 3.5), t);
  const mi = gainNode(ctx, 0);
  m.connect(mi); mi.connect(c.frequency);
  const dur = o.dur || 2;
  mi.gain.setValueAtTime(f * (o.index || 2.2), t);
  mi.gain.exponentialRampToValueAtTime(f * 0.05, t + dur * 0.6);
  const g = gainNode(ctx, 0);
  c.connect(g); g.connect(v.node);
  adEnv(g.gain, t, o.peak || 0.6, 0.003, dur);
  c.start(t); m.start(t); c.stop(t + dur + 0.05); m.stop(t + dur + 0.05);
  v.release(c);
  return t + dur;
}

// Bahnhofsgong: drei absteigende Glockentöne
export function stationChime(ctx, dest, t, o = {}) {
  const fs = o.fs || [784, 659, 523];
  let end = t;
  fs.forEach((f, k) => { end = fmBell(ctx, dest, t + k * 0.55, f, { ...o, ratio: 2, index: 1.2, dur: 1.6, peak: 0.45 }); });
  return end;
}

// Spieluhr-Ton (Freizeitpark, Riesenrad)
export function musicBoxNote(ctx, dest, t, f, o = {}) {
  const v = voiceOut(ctx, dest, o);
  let last;
  for (const [r, a, d] of [[1, 0.5, 0.9], [5.4, 0.12, 0.25], [3, 0.08, 0.4]]) {
    const o1 = osc(ctx, 'sine', f * r, t);
    const g = gainNode(ctx, 0);
    o1.connect(g); g.connect(v.node);
    adEnv(g.gain, t, a, 0.002, d);
    o1.start(t); o1.stop(t + d + 0.05);
    last = o1;
  }
  v.release(last);
  return t + 0.95;
}

// Zivilschutz-Sirene: auf- und abschwellender Heulton
export function civilSiren(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const a = osc(ctx, 'sawtooth', 180, t), b = osc(ctx, 'square', 181, t);
  const lp = filter(ctx, 'lowpass', 1600, 0.8);
  const bg = gainNode(ctx, 0.4);
  const g = gainNode(ctx, 0);
  a.connect(lp); b.connect(bg); bg.connect(lp); lp.connect(g); g.connect(v.node);
  const cycles = o.cycles || 2;
  let tk = t;
  for (const x of [a, b]) x.frequency.setValueAtTime(x === a ? 170 : 171, t);
  for (let k = 0; k < cycles; k++) {
    for (const x of [a, b]) {
      const m = x === a ? 1 : 1.006;
      x.frequency.setValueAtTime(170 * m, tk);
      x.frequency.exponentialRampToValueAtTime(520 * m, tk + 1.6);
      x.frequency.setValueAtTime(520 * m, tk + 2.3);
      x.frequency.exponentialRampToValueAtTime(190 * m, tk + 4.1);
    }
    tk += 4.1;
  }
  ahrEnv(g.gain, t, 0.32, 0.8, tk - t - 1.4, 0.8);
  a.start(t); b.start(t); a.stop(tk + 0.1); b.stop(tk + 0.1);
  v.release(a);
  return tk;
}

// Martinshorn als Einzelklang (tatü-tata)
export function martinshorn(ctx, dest, t, o = {}) {
  const v = voiceOut(ctx, dest, o);
  const a = osc(ctx, 'sawtooth', 440, t);
  const bp = filter(ctx, 'bandpass', 1100, 0.7);
  const g = gainNode(ctx, 0);
  a.connect(bp); bp.connect(g); g.connect(v.node);
  const n = o.n || 4;
  const f1 = 440 * (o.doppler || 1), f2 = 587 * (o.doppler || 1);
  for (let k = 0; k < n; k++) { a.frequency.setValueAtTime(k % 2 ? f2 : f1, t + k * 0.65); }
  ahrEnv(g.gain, t, 0.3, 0.05, n * 0.65 - 0.3, 0.25);
  a.start(t); a.stop(t + n * 0.65 + 0.1);
  v.release(a);
  return t + n * 0.65;
}

// ======================================================= Wetter und Katastrophen
// Donner: nah mit Knall, fern als langes Grollen
export function thunder(ctx, dest, t, o = {}) {
  const B = buffers(ctx);
  const close = clamp(o.close == null ? Math.random() : o.close);
  const v = voiceOut(ctx, dest, { ...o, pan: o.pan == null ? rand(-0.6, 0.6) : o.pan });
  const dur = 4.5 + (1 - close) * 3 + Math.random() * 2;
  let end = t + dur;
  if (close > 0.6) {
    const cr = noiseSrc(ctx, B.white, t, 0.5);
    const hp = filter(ctx, 'highpass', 900, 0.6);
    const cg = gainNode(ctx, 0);
    cr.connect(hp); hp.connect(cg); cg.connect(v.node);
    adEnv(cg.gain, t, 0.9 * close, 0.003, 0.35);
  }
  const src = noiseSrc(ctx, B.brown, t, dur + 0.5);
  const lp = filter(ctx, 'lowpass', 1500, 0.4);
  lp.frequency.setValueAtTime(close > 0.6 ? 2200 : 700, t);
  lp.frequency.exponentialRampToValueAtTime(110, t + dur);
  const g = gainNode(ctx, 0);
  src.connect(lp); lp.connect(g); g.connect(v.node);
  g.gain.setValueAtTime(0.0001, t);
  // unregelmäßiges Grollen
  let tk = t + (close > 0.6 ? 0.01 : 0.25);
  const bumps = 3 + Math.floor(Math.random() * 3);
  for (let k = 0; k < bumps; k++) {
    const a = (k === 0 ? 1.6 : rand(0.6, 1.3)) * (0.55 + close * 0.6);
    g.gain.linearRampToValueAtTime(a, tk + (k === 0 ? 0.04 + (1 - close) * 0.4 : 0.15));
    g.gain.linearRampToValueAtTime(a * 0.35, tk + rand(0.5, 0.9));
    tk += rand(0.5, 1.2);
  }
  g.gain.exponentialRampToValueAtTime(0.0001, Math.max(tk + 1, t + dur));
  end = Math.max(tk + 1, t + dur);
  v.release(src);
  return end;
}

// Tiefer Einschlag (Katastrophe, Explosion, Meteorit)
export function boom(ctx, dest, t, o = {}) {
  const B = buffers(ctx);
  const v = voiceOut(ctx, dest, o);
  const big = o.big == null ? 1 : o.big;
  const s = osc(ctx, 'sine', 62, t);
  s.frequency.exponentialRampToValueAtTime(26, t + 1.3);
  const sg = gainNode(ctx, 0);
  s.connect(sg); sg.connect(v.node);
  adEnv(sg.gain, t, 0.9 * big, 0.005, 1.6 + big);
  const n = noiseSrc(ctx, B.brown, t, 3.5);
  const lp = filter(ctx, 'lowpass', 900, 0.5);
  lp.frequency.setValueAtTime(900, t);
  lp.frequency.exponentialRampToValueAtTime(140, t + 2.5);
  const ng = gainNode(ctx, 0);
  n.connect(lp); lp.connect(ng); ng.connect(v.node);
  adEnv(ng.gain, t, 1.1 * big, 0.005, 2.6);
  const c = noiseSrc(ctx, B.white, t, 0.4);
  const hp = filter(ctx, 'highpass', 700, 0.5);
  const cg = gainNode(ctx, 0);
  c.connect(hp); hp.connect(cg); cg.connect(v.node);
  adEnv(cg.gain, t, 0.5 * big, 0.002, 0.3);
  s.start(t); s.stop(t + 3.8);
  v.release(s);
  return t + 3.8;
}

// Erdbeben: Grollen mit Rütteln
export function quake(ctx, dest, t, o = {}) {
  const B = buffers(ctx);
  const v = voiceOut(ctx, dest, o);
  const dur = o.dur || 4;
  const n = noiseSrc(ctx, B.brown, t, dur + 2.5);
  const lp = filter(ctx, 'bandpass', 110, 0.7);
  const g = gainNode(ctx, 0);
  n.connect(lp); lp.connect(g); g.connect(v.node);
  ahrEnv(g.gain, t, 1.6, 0.8, dur, 1.8);
  const sub = osc(ctx, 'sine', 42, t);
  const trem = osc(ctx, 'sine', 3.3, t);
  const td = gainNode(ctx, 0.4);
  const sg = gainNode(ctx, 0);
  const sga = gainNode(ctx, 0.6);
  trem.connect(td); td.connect(sga.gain);
  sub.connect(sga); sga.connect(sg); sg.connect(v.node);
  ahrEnv(sg.gain, t, 0.35, 1, dur - 0.5, 1.6);
  const r = noiseSrc(ctx, B.white, t, dur + 1.5);
  const bp = filter(ctx, 'bandpass', 1700, 1.5);
  const rat = osc(ctx, 'square', 13, t);
  const rd = gainNode(ctx, 0.5);
  const rg = gainNode(ctx, 0);
  const rga = gainNode(ctx, 0.5);
  rat.connect(rd); rd.connect(rga.gain);
  r.connect(bp); bp.connect(rga); rga.connect(rg); rg.connect(v.node);
  ahrEnv(rg.gain, t + 0.4, 0.4, 0.6, dur - 1, 1);
  const end = t + dur + 2.6;
  sub.start(t); trem.start(t); rat.start(t); sub.stop(end); trem.stop(end); rat.stop(end);
  v.release(sub);
  return end;
}

// Wirbelsturm: kreisender Wind
export function tornado(ctx, dest, t, o = {}) {
  const B = buffers(ctx);
  const v = voiceOut(ctx, dest, o);
  const dur = o.dur || 5;
  const src = noiseSrc(ctx, B.pink, t, dur + 2);
  const bp = filter(ctx, 'bandpass', 500, 3.5);
  const lfo = osc(ctx, 'sine', 0.7, t);
  const ld = gainNode(ctx, 280);
  lfo.connect(ld); ld.connect(bp.frequency);
  const g = gainNode(ctx, 0);
  src.connect(bp); bp.connect(g); g.connect(v.node);
  const low = noiseSrc(ctx, B.brown, t, dur + 2);
  const lp = filter(ctx, 'lowpass', 180, 0.7);
  low.connect(lp); lp.connect(g);
  ahrEnv(g.gain, t, 1.4, 1.2, dur - 1.2, 1.6);
  lfo.start(t); lfo.stop(t + dur + 1.7);
  v.release(lfo);
  return t + dur + 1.6;
}

// Flutwelle / Wasserrauschen
export function waterRush(ctx, dest, t, o = {}) {
  const B = buffers(ctx);
  const v = voiceOut(ctx, dest, o);
  const dur = o.dur || 4;
  const a = noiseSrc(ctx, B.brown, t, dur + 2);
  const b = noiseSrc(ctx, B.pink, t, dur + 2);
  const lp = filter(ctx, 'lowpass', 900, 0.6);
  const surge = osc(ctx, 'sine', 0.45, t);
  const sd = gainNode(ctx, 0.35);
  const ga = gainNode(ctx, 0.65);
  surge.connect(sd); sd.connect(ga.gain);
  const g = gainNode(ctx, 0);
  a.connect(lp); b.connect(lp); lp.connect(ga); ga.connect(g); g.connect(v.node);
  ahrEnv(g.gain, t, 1, 1, dur - 1, 1.8);
  surge.start(t); surge.stop(t + dur + 1.9);
  v.release(surge);
  return t + dur + 1.8;
}

// Fallender Meteorit: absteigendes Zischen, dann Einschlag
export function meteor(ctx, dest, t, o = {}) {
  const B = buffers(ctx);
  const v = voiceOut(ctx, dest, { ...o, pan: 0 });
  v.pan.pan.setValueAtTime(-0.6, t); v.pan.pan.linearRampToValueAtTime(0.2, t + 1.7);
  const src = noiseSrc(ctx, B.white, t, 2);
  const bp = filter(ctx, 'bandpass', 5000, 1.4);
  bp.frequency.setValueAtTime(5000, t);
  bp.frequency.exponentialRampToValueAtTime(380, t + 1.7);
  const g = gainNode(ctx, 0);
  src.connect(bp); bp.connect(g); g.connect(v.node);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + 1.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.85);
  v.release(src);
  return boom(ctx, dest, t + 1.7, { ...o, big: 1.2 });
}

// Feuer fängt: Aufflammen mit Knistern
export function ignite(ctx, dest, t, o = {}) {
  const B = buffers(ctx);
  const v = voiceOut(ctx, dest, o);
  const src = noiseSrc(ctx, B.brown, t, 1.6);
  const lp = filter(ctx, 'lowpass', 200, 0.7);
  lp.frequency.setValueAtTime(200, t);
  lp.frequency.exponentialRampToValueAtTime(2400, t + 0.35);
  lp.frequency.exponentialRampToValueAtTime(600, t + 1.4);
  const g = gainNode(ctx, 0);
  src.connect(lp); lp.connect(g); g.connect(v.node);
  ahrEnv(g.gain, t, 1.2, 0.25, 0.15, 1);
  const cr = noiseSrc(ctx, B.crackle, t, 1.6);
  const cg = gainNode(ctx, 0);
  cr.connect(cg); cg.connect(v.node);
  ahrEnv(cg.gain, t + 0.1, 0.9, 0.1, 0.6, 0.6);
  v.release(src);
  return t + 1.6;
}

// Zischen (Löschen, Dampf)
export function hiss(ctx, dest, t, o = {}) {
  const B = buffers(ctx);
  const v = voiceOut(ctx, dest, o);
  const src = noiseSrc(ctx, B.white, t, 1.8);
  const hp = filter(ctx, 'highpass', 3000, 0.6);
  const g = gainNode(ctx, 0);
  src.connect(hp); hp.connect(g); g.connect(v.node);
  ahrEnv(g.gain, t, 0.45, 0.02, 0.35, 1.2);
  v.release(src);
  return t + 1.7;
}

// Luftzug (für Oberfläche: Öffnen/Schließen, Karten)
export function whoosh(ctx, dest, t, o = {}) {
  const B = buffers(ctx);
  const v = voiceOut(ctx, dest, o);
  const d = o.dur || 0.22;
  const src = noiseSrc(ctx, B.white, t, d + 0.1);
  const bp = filter(ctx, 'bandpass', o.f0 || 700, o.q || 1.1);
  bp.frequency.setValueAtTime(o.f0 || 700, t);
  bp.frequency.exponentialRampToValueAtTime(o.f1 || 2600, t + d);
  const g = gainNode(ctx, 0);
  src.connect(bp); bp.connect(g); g.connect(v.node);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.peak || 0.5, t + d * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  v.release(src);
  return t + d;
}

// Jubel einer Menge (Stadion, Freizeitpark)
export function cheer(ctx, dest, t, o = {}) {
  const B = buffers(ctx);
  const v = voiceOut(ctx, dest, o);
  const dur = o.dur || rand(2.5, 4);
  const src = noiseSrc(ctx, B.pink, t, dur + 0.5);
  const b1 = filter(ctx, 'bandpass', 1050, 0.9);
  const b2 = filter(ctx, 'bandpass', 2400, 1.3);
  const g = gainNode(ctx, 0);
  src.connect(b1); src.connect(b2); b1.connect(g); b2.connect(g); g.connect(v.node);
  ahrEnv(g.gain, t, 1, dur * 0.25, dur * 0.25, dur * 0.5);
  v.release(src);
  return t + dur;
}
