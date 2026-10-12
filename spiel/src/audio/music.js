// Generative Musik mit Liedform, Stimmungen und Jahreszeiten-Farben. Das Herzstück bleiben die
// Pulsbahn-Töne: jede Zugankunft spielt einen gezupften Ton im aktuellen Akkord, im Takt eingerastet
// und mit Echo im Tempo.
//
// Aufbau: ein 16tel-Raster mit Vorausplanung (Lookahead 0,3 s, „Tale of two clocks"). Pro Takt ein
// Akkord aus der Progression des Abschnitts. Ein Lied besteht aus Abschnitten (Intro, A, A2, B, Break,
// Outro, Ruhe); jeder Abschnitt regelt die Dichte der Instrumente. Nach der Ruhe beginnt ein neues Lied
// in einer neuen Tonart. Stimmung (Tag, Nacht, Krise, Menü) wählt Progressionen, Tempo, Muster und
// Klangfarben; die Jahreszeit färbt Arpeggio- und Melodie-Instrument und das Tempo.
// Dauerstimmen (Fläche, Streicher, Bass, Krisen-Bordun) sind feste Knoten und werden nur umgestimmt.
import { gainNode, filter, osc, noiseSrc, buffers, adEnv, ahrEnv, Voices, mtof, clamp, mulberry32 } from './core.js';
import { voiceOut } from './synths.js';

// ---------- Harmonik (Halbtöne über dem Grundton der Dur-Tonart)
const C = {
  I: [0, 4, 7, 11], I9: [0, 4, 7, 14], ii: [2, 5, 9, 12], iii: [4, 7, 11, 14], IV: [5, 9, 12, 16], IV9: [5, 9, 12, 19],
  V: [7, 11, 14, 17], Vs: [7, 12, 14, 17], vi: [9, 12, 16, 19], vi9: [9, 12, 16, 23],
  V7m: [4, 8, 11, 14], dim: [8, 11, 14, 17], N: [10, 14, 17, 22], ivm: [2, 5, 9, 14],
};
const ROOT = new Map([[C.I, 0], [C.I9, 0], [C.ii, 2], [C.iii, 4], [C.IV, 5], [C.IV9, 5], [C.V, 7], [C.Vs, 7], [C.vi, 9], [C.vi9, 9], [C.V7m, 4], [C.dim, 8], [C.N, 10], [C.ivm, 2]]);
const PROGS = {
  day: [[C.I, C.vi, C.IV, C.V], [C.IV, C.V, C.iii, C.vi], [C.I9, C.iii, C.IV, C.I], [C.ii, C.Vs, C.I, C.IV9], [C.vi, C.IV, C.I, C.V], [C.I, C.V, C.vi9, C.IV]],
  night: [[C.vi9, C.IV9, C.I, C.V], [C.vi, C.ii, C.IV, C.iii], [C.IV9, C.V, C.vi9, C.vi], [C.vi9, C.I, C.ii, C.IV9], [C.vi, C.iii, C.IV9, C.I9]],
  crisis: [[C.vi, C.vi, C.IV, C.V7m], [C.vi, C.ivm, C.V7m, C.vi], [C.IV, C.V7m, C.vi, C.dim], [C.vi, C.N, C.V7m, C.vi]],
  menu: [[C.I9, C.IV9, C.vi9, C.Vs], [C.IV9, C.I, C.ii, C.Vs]],
  resolve: [[C.IV, C.V, C.I9, C.I9]],
};
const SCALES = { day: [0, 2, 4, 7, 9], night: [9, 11, 0, 2, 4, 7], crisis: [9, 11, 0, 2, 4, 5, 8], menu: [0, 2, 4, 7, 9] };
const PULSE_SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]; // Dur-Pentatonik (wie bisher)
const KEYS = [50, 48, 53, 52, 55, 51];

// ---------- Abschnitte (Dichte 0..1 je Instrument)
const SECTIONS = {
  intro: { bars: 4, pad: 0.75, str: 0, bass: 0, arp: 0.1, mel: 0, perc: 0, next: [['A', 1]] },
  A: { bars: 8, pad: 1, str: 0, bass: 1, arp: 0.55, mel: 0.35, perc: 0.15, next: [['B', 0.6], ['A2', 0.2], ['break', 0.2]] },
  A2: { bars: 8, pad: 1, str: 0.35, bass: 1, arp: 0.7, mel: 0.55, perc: 0.3, next: [['B', 0.7], ['break', 0.3]] },
  B: { bars: 8, pad: 1, str: 0.65, bass: 1, arp: 0.9, mel: 0.85, perc: 0.55, next: [['A', 0.35], ['break', 0.3], ['outro', 0.35]], progB: true },
  break: { bars: 4, pad: 0.6, str: 0, bass: 0, arp: 0.12, mel: 0, perc: 0, next: [['B', 0.5], ['A2', 0.5]], progB: true },
  outro: { bars: 4, pad: 0.7, str: 0.25, bass: 0.5, arp: 0.3, mel: 0.2, perc: 0, next: [['rest', 1]] },
  rest: { bars: 6, pad: 0.22, str: 0, bass: 0, arp: 0, mel: 0, perc: 0, next: [['intro', 1]], newSong: true },
  tension: { bars: 8, pad: 0.9, str: 0.8, bass: 1, arp: 0.65, mel: 0.25, perc: 0.75, next: [['tension', 1]] },
  resolve: { bars: 4, pad: 1, str: 0.6, bass: 1, arp: 0.5, mel: 0.6, perc: 0.1, next: [['A', 1]] },
  celebrate: { bars: 8, pad: 1, str: 0.8, bass: 1, arp: 1, mel: 1, perc: 0.6, next: [['A2', 0.6], ['outro', 0.4]], progB: true },
};
const MOOD = {
  day: { arp: 1, mel: 1, perc: 1, bass: 1, pad: 1, cut: 1350, q: 0.7, level: 1 },
  night: { arp: 0.6, mel: 0.65, perc: 0.15, bass: 0.7, pad: 1, cut: 650, q: 0.8, level: 0.85 },
  crisis: { arp: 0.9, mel: 0.5, perc: 1, bass: 1, pad: 0.9, cut: 820, q: 3.2, level: 1 },
  menu: { arp: 1, mel: 0.8, perc: 0, bass: 0.6, pad: 1, cut: 1000, q: 0.7, level: 0.9 },
};
const TEMPO = { day: { spring: 88, summer: 84, autumn: 80, winter: 76 }, night: 68, crisis: 96, menu: 74 };
const ARP = {
  day: [[0, -1, 1, -1, 2, -1, 3, -1, 2, -1, 1, -1, 2, -1, 3, -1], [0, -1, 2, -1, 1, -1, 3, -1, 0, -1, 2, -1, 4, -1, 3, -1], [0, 2, 1, 3, -1, 2, -1, 4, 0, 2, 1, 3, -1, 2, 4, -1], [0, -1, -1, 2, -1, -1, 1, -1, 3, -1, -1, 2, -1, -1, 4, -1]],
  night: [[0, -1, -1, -1, 2, -1, -1, -1, 1, -1, -1, 3, -1, -1, -1, -1], [0, -1, -1, 2, -1, -1, 1, -1, -1, -1, 3, -1, -1, -1, 2, -1], [2, -1, -1, -1, -1, -1, 1, -1, 3, -1, -1, -1, -1, -1, 0, -1]],
  crisis: [[0, -1, 0, -1, 1, -1, 0, -1, 2, -1, 0, -1, 1, -1, 3, -1], [0, 0, -1, 1, 0, -1, 2, -1, 0, 0, -1, 1, 3, -1, 2, -1]],
  menu: [[0, -1, 2, -1, 1, -1, 3, -1, 2, -1, 1, -1, 4, -1, 3, -1], [0, -1, -1, 2, -1, -1, 1, -1, 3, -1, -1, 2, 4, -1, -1, -1]],
};
const RHYTHMS = [ // Melodie-Rhythmen über zwei Takte: [Start-16tel, Länge]
  [[0, 4], [4, 2], [6, 2], [8, 6], [16, 4], [20, 4], [24, 8]],
  [[2, 2], [4, 4], [8, 4], [12, 4], [18, 2], [20, 2], [22, 2], [24, 8]],
  [[0, 6], [6, 2], [8, 8], [16, 2], [18, 2], [20, 4], [24, 4], [28, 4]],
  [[4, 4], [8, 2], [10, 2], [12, 4], [20, 4], [24, 8]],
  [[0, 3], [3, 3], [6, 2], [8, 4], [12, 4], [16, 8], [26, 6]],
];
const ARP_INSTR = { spring: 'kalimba', summer: 'marimba', autumn: 'guitar', winter: 'celesta' };
const MEL_INSTR = { spring: 'flute', summer: 'bell', autumn: 'epiano', winter: 'musicbox' };

// ---------- Einzelnoten-Instrumente (je Ton eine kleine Kette)
function play(ctx, dest, kind, t, f, vel, dur, o = {}) {
  const v = voiceOut(ctx, dest, { gain: vel, pan: o.pan || 0, send: o.send == null ? 0.35 : o.send });
  if (o.echo && dest.echo) { const e = gainNode(ctx, o.echo); v.pan.connect(e); e.connect(dest.echo); }
  const end = (src, e) => { v.release(src); return e; };
  const part = (type, fr, a, at, dc) => {
    const x = osc(ctx, type, fr, t), g = gainNode(ctx, 0);
    x.connect(g); g.connect(v.node);
    adEnv(g.gain, t, a, at, dc);
    x.start(t); x.stop(t + at + dc + 0.05);
    return x;
  };
  switch (kind) {
    case 'pluck': { // Pulsbahn-Ton (Klang wie bisher: Sinus + Dreieck eine Oktave höher)
      const a = osc(ctx, 'sine', f, t), b = osc(ctx, 'triangle', f * 2, t);
      const g = gainNode(ctx, 0), g2 = gainNode(ctx, 0.25);
      a.connect(g); b.connect(g2); g2.connect(g); g.connect(v.node);
      adEnv(g.gain, t, 1, 0.008, 1.6);
      a.start(t); b.start(t); a.stop(t + 1.7); b.stop(t + 1.7);
      return end(a, t + 1.7);
    }
    case 'marimba': part('sine', f * 4, 0.22, 0.002, 0.12); part('sine', f * 10, 0.04, 0.001, 0.03); return end(part('sine', f, 1, 0.004, 0.8), t + 0.85);
    case 'kalimba': part('sine', f * 5.9, 0.1, 0.002, 0.22); part('triangle', f * 2, 0.08, 0.003, 0.4); return end(part('sine', f, 1, 0.003, 1.2), t + 1.25);
    case 'celesta': part('sine', f * 3, 0.16, 0.002, 0.6); part('sine', f * 7.1, 0.05, 0.001, 0.2); return end(part('sine', f, 0.9, 0.002, 1.8), t + 1.85);
    case 'guitar': {
      const a = osc(ctx, 'triangle', f, t), b = osc(ctx, 'sawtooth', f * 1.003, t);
      const lp = filter(ctx, 'lowpass', 3200, 0.9), bg = gainNode(ctx, 0.25), g = gainNode(ctx, 0);
      lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.5);
      a.connect(lp); b.connect(bg); bg.connect(lp); lp.connect(g); g.connect(v.node);
      adEnv(g.gain, t, 1, 0.004, 1.4);
      a.start(t); b.start(t); a.stop(t + 1.5); b.stop(t + 1.5);
      return end(a, t + 1.5);
    }
    case 'epiano': {
      const c = osc(ctx, 'sine', f, t), m = osc(ctx, 'sine', f, t), mi = gainNode(ctx, 0), g = gainNode(ctx, 0);
      m.connect(mi); mi.connect(c.frequency);
      mi.gain.setValueAtTime(f * 1.3, t); mi.gain.exponentialRampToValueAtTime(f * 0.12, t + 0.7);
      c.connect(g); g.connect(v.node);
      adEnv(g.gain, t, 1, 0.006, Math.max(1.2, dur + 0.6));
      const e2 = t + Math.max(1.2, dur + 0.6) + 0.05;
      c.start(t); m.start(t); c.stop(e2); m.stop(e2);
      return end(c, e2);
    }
    case 'bell': { // FM-Glocke
      const c = osc(ctx, 'sine', f, t), m = osc(ctx, 'sine', f * 3.5, t), mi = gainNode(ctx, 0), g = gainNode(ctx, 0);
      m.connect(mi); mi.connect(c.frequency);
      mi.gain.setValueAtTime(f * 1.6, t); mi.gain.exponentialRampToValueAtTime(f * 0.05, t + 1.3);
      c.connect(g); g.connect(v.node);
      adEnv(g.gain, t, 1, 0.003, 2.2);
      c.start(t); m.start(t); c.stop(t + 2.25); m.stop(t + 2.25);
      return end(c, t + 2.25);
    }
    case 'musicbox': part('sine', f * 5.4, 0.17, 0.002, 0.25); part('sine', f * 3, 0.11, 0.002, 0.4); return end(part('sine', f, 0.7, 0.002, 0.9), t + 0.95);
    case 'flute': {
      const a = osc(ctx, 'sine', f, t), vib = osc(ctx, 'sine', 5.2, t), vd = gainNode(ctx, 0), g = gainNode(ctx, 0);
      vib.connect(vd); vd.connect(a.frequency);
      vd.gain.setValueAtTime(0, t); vd.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.4, dur));
      a.connect(g); g.connect(v.node);
      const B = buffers(ctx);
      const br = noiseSrc(ctx, B.white, t, dur + 0.3), bp = filter(ctx, 'bandpass', f * 2, 6), bg = gainNode(ctx, 0);
      br.connect(bp); bp.connect(bg); bg.connect(v.node);
      ahrEnv(g.gain, t, 0.9, 0.07, Math.max(0.05, dur - 0.07), 0.25);
      ahrEnv(bg.gain, t, 0.12, 0.03, 0.05, 0.2);
      a.start(t); vib.start(t); a.stop(t + dur + 0.35); vib.stop(t + dur + 0.35);
      return end(a, t + dur + 0.35);
    }
    case 'lead': {
      const a = osc(ctx, 'sawtooth', f, t), lp = filter(ctx, 'lowpass', 1100, 2), g = gainNode(ctx, 0);
      a.connect(lp); lp.connect(g); g.connect(v.node);
      ahrEnv(g.gain, t, 0.5, 0.05, Math.max(0.05, dur - 0.05), 0.3);
      a.start(t); a.stop(t + dur + 0.4);
      return end(a, t + dur + 0.4);
    }
    case 'pulse': {
      const a = osc(ctx, 'triangle', f, t), lp = filter(ctx, 'lowpass', 900, 1.5), g = gainNode(ctx, 0);
      a.connect(lp); lp.connect(g); g.connect(v.node);
      adEnv(g.gain, t, 1, 0.005, 0.45);
      a.start(t); a.stop(t + 0.5);
      return end(a, t + 0.5);
    }
    // Schlagwerk
    case 'kick': {
      const a = osc(ctx, 'sine', 120, t), g = gainNode(ctx, 0);
      a.frequency.exponentialRampToValueAtTime(44, t + 0.18);
      a.connect(g); g.connect(v.node);
      adEnv(g.gain, t, 1, 0.003, 0.28);
      a.start(t); a.stop(t + 0.32);
      return end(a, t + 0.32);
    }
    case 'tom': {
      const a = osc(ctx, 'sine', f || 110, t), g = gainNode(ctx, 0);
      a.frequency.exponentialRampToValueAtTime((f || 110) * 0.62, t + 0.3);
      a.connect(g); g.connect(v.node);
      adEnv(g.gain, t, 1, 0.004, 0.4);
      a.start(t); a.stop(t + 0.45);
      return end(a, t + 0.45);
    }
    case 'shaker': case 'rim': case 'tick': {
      const B = buffers(ctx);
      const d = kind === 'shaker' ? 0.06 : kind === 'rim' ? 0.035 : 0.018;
      const s = noiseSrc(ctx, B.white, t, d + 0.02);
      const fl = kind === 'shaker' ? filter(ctx, 'highpass', 6500, 0.7) : kind === 'rim' ? filter(ctx, 'bandpass', 1900, 5) : filter(ctx, 'bandpass', 8500, 2);
      const g = gainNode(ctx, 0);
      s.connect(fl); fl.connect(g); g.connect(v.node);
      adEnv(g.gain, t, kind === 'rim' ? 2.5 : 1, 0.002, d);
      return end(s, t + d + 0.02);
    }
  }
  return t;
}

// Dauerstimmen: Fläche (4 Stimmen × 2 verstimmte Oszillatoren), Streicher, Bass, Krisen-Bordun.
class Sustain {
  constructor(ctx, dest) {
    this.ctx = ctx;
    this.dest = dest;
    this.padFilter = filter(ctx, 'lowpass', 900, 0.7);
    this.padGain = gainNode(ctx, 0);
    this.padFilter.connect(this.padGain);
    this.padGain.connect(dest.dry);
    this.padSend = gainNode(ctx, 0.9); this.padGain.connect(this.padSend); this.padSend.connect(dest.send);
    this.strFilter = filter(ctx, 'lowpass', 1500, 0.6);
    this.strGain = gainNode(ctx, 0);
    this.strFilter.connect(this.strGain); this.strGain.connect(dest.dry);
    this.strSend = gainNode(ctx, 1.2); this.strGain.connect(this.strSend); this.strSend.connect(dest.send);
    this.bassFilter = filter(ctx, 'lowpass', 520, 0.8);
    this.bassGain = gainNode(ctx, 0);
    this.bassFilter.connect(this.bassGain); this.bassGain.connect(dest.dry);
    this.droneFilter = filter(ctx, 'lowpass', 260, 2);
    this.droneGain = gainNode(ctx, 0);
    this.droneAm = gainNode(ctx, 0.7);
    this.droneFilter.connect(this.droneAm); this.droneAm.connect(this.droneGain); this.droneGain.connect(dest.dry);
    this.droneSend = gainNode(ctx, 0.6); this.droneGain.connect(this.droneSend); this.droneSend.connect(dest.send);
    this.oscs = [];
    this.awake = false;
    this.voicing = [50, 54, 57, 61];
  }
  wake(t) {
    if (this.awake) return;
    const ctx = this.ctx;
    const mk = (type, f, det, gain, dest) => { const o = osc(ctx, type, f, t); o.detune.value = det; const g = gainNode(ctx, gain); o.connect(g); g.connect(dest); o.start(t); this.oscs.push(o); return o; };
    this.pad = [];
    for (let k = 0; k < 4; k++) {
      const f = mtof(this.voicing[k]);
      this.pad.push([mk(k === 0 ? 'triangle' : 'sine', f, -6, k === 0 ? 0.1 : 0.065, this.padFilter), mk('sine', f, 6, k === 0 ? 0.08 : 0.065, this.padFilter)]);
    }
    this.str = [];
    for (let k = 0; k < 4; k++) this.str.push(mk('sawtooth', mtof(this.voicing[k] + 12), k % 2 ? 7 : -7, 0.03, this.strFilter));
    this.bass = [mk('triangle', mtof(38), 0, 0.5, this.bassFilter), mk('sine', mtof(38), 0, 0.3, this.bassFilter)];
    this.drone = [mk('sawtooth', mtof(38), -4, 0.3, this.droneFilter), mk('sawtooth', mtof(45), 5, 0.2, this.droneFilter)];
    const trem = osc(ctx, 'sine', 4.6, t); const td = gainNode(ctx, 0.3); trem.connect(td); td.connect(this.droneAm.gain); trem.start(t); this.oscs.push(trem);
    const breath = osc(ctx, 'sine', 0.05, t); const bd = gainNode(ctx, 140); breath.connect(bd); bd.connect(this.padFilter.frequency); breath.start(t); this.oscs.push(breath);
    this.awake = true;
  }
  sleep(t) {
    for (const o of this.oscs) { try { o.stop(t); } catch (e) { /* egal */ } }
    this.oscs = [];
    this.awake = false;
  }
  setChord(voicing, t, glide = 0.3) {
    this.voicing = voicing;
    if (!this.awake) return;
    for (let k = 0; k < 4; k++) {
      const f = mtof(voicing[k]);
      for (const o of this.pad[k]) o.frequency.setTargetAtTime(f, t, glide);
      this.str[k].frequency.setTargetAtTime(mtof(voicing[k] + 12), t, glide * 1.5);
    }
  }
  bassNote(m, t, dur, vel) {
    if (!this.awake) return;
    const f = mtof(m);
    this.bass[0].frequency.setTargetAtTime(f, t, 0.012);
    this.bass[1].frequency.setTargetAtTime(f, t, 0.012);
    const g = this.bassGain.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(vel, t, 0.008);
    g.setTargetAtTime(vel * 0.6, t + 0.06, 0.25);
    g.setTargetAtTime(0, t + dur, 0.07);
  }
  droneRoot(m, t) {
    if (!this.awake) return;
    this.drone[0].frequency.setTargetAtTime(mtof(m), t, 0.5);
    this.drone[1].frequency.setTargetAtTime(mtof(m + 7), t, 0.5);
  }
}

export class Music {
  constructor(ctx, mixer, opts = {}) {
    this.ctx = ctx;
    this.mixer = mixer;
    this.dest = { dry: mixer.music, send: mixer.musicSend, echo: mixer.echo };
    this.rng = mulberry32(opts.seed == null ? (Math.random() * 1e9) | 0 : opts.seed);
    this.voices = new Voices(opts.maxVoices || 26);
    this.sus = new Sustain(ctx, this.dest);
    this.state = { mood: 'menu', season: 'summer', night: 0, crisis: 0, activity: 0.3 };
    this.mood = 'menu';
    this.key = 50;
    this.bpm = 74;
    this.step = 0;
    this.abs = 0;
    this.nextTime = 0;
    this.section = null;
    this.secName = '';
    this.secBar = 0;
    this.progA = PROGS.menu[0];
    this.progB = PROGS.menu[1];
    this.chord = C.I9;
    this.voicing = [50, 54, 57, 64];
    this.queue = [];
    this.mel = [];
    this.motif = null;
    this.arpPat = ARP.menu[0];
    this.awake = false;
    this.notes = 0;
    this.celebrateReq = false;
    this.history = [];
    this.mute = new Set(); // zum Prüfen: 'pad', 'str', 'bass', 'arp', 'mel', 'perc', 'pulse'
  }

  // Stimmung von außen: { night, crisis, season, menu, activity }
  setState(st) { Object.assign(this.state, st); }
  celebrate() { this.celebrateReq = true; }
  arrival(a) { if (this.queue.length < 8) this.queue.push(a); }

  wake(t) { if (this.awake) return; this.awake = true; this.sus.wake(t); this.nextTime = t + 0.05; this.sus.setChord(this.voicing, t, 0.01); }
  sleep(t) {
    if (!this.awake) return;
    this.awake = false;
    const s = this.sus;
    for (const g of [s.padGain, s.strGain, s.bassGain, s.droneGain]) { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, 0.3); }
    s.sleep(t + 2);
  }

  targetMood() {
    const st = this.state;
    if (st.menu) return 'menu';
    if (st.crisis > 0.55 || (this.mood === 'crisis' && st.crisis > 0.35)) return 'crisis';
    return st.night > 0.55 ? 'night' : 'day';
  }

  // Midi-Noten des aktuellen Akkords (für Effektklänge im Akkord)
  chordNotes() { return this.chord.map((c) => this.key + c); }
  scale() { return SCALES[this.mood] || SCALES.day; }

  tick(now) {
    if (!this.awake) return;
    const LOOK = 0.3;
    if (this.nextTime < now - 0.25) this.nextTime = now + 0.05; // nach Aussetzern neu einrasten
    // Krise duldet keinen Aufschub: Abschnitt zum nächsten Takt beenden
    const tm = this.targetMood();
    if (this.section && ((tm === 'crisis') !== (this.mood === 'crisis')) && this.secBar < this.section.bars) this.secBar = this.section.bars;
    let guard = 0;
    while (this.nextTime < now + LOOK && guard++ < 64) {
      this.scheduleStep(this.nextTime);
      this.nextTime += 60 / this.bpm / 4;
    }
  }

  nextSection(t) {
    const tm = this.targetMood();
    const r = this.rng;
    let name;
    if (this.celebrateReq && tm !== 'crisis') { name = 'celebrate'; this.celebrateReq = false; }
    else if (tm === 'crisis') name = 'tension';
    else if (this.mood === 'crisis') name = 'resolve';
    else if (!this.section) name = this.state.start && SECTIONS[this.state.start] ? this.state.start : 'intro';
    else {
      const list = this.section.next;
      let x = r(), acc = 0;
      name = list[list.length - 1][0];
      for (const [n, p] of list) { acc += p; if (x < acc) { name = n; break; } }
    }
    const moodChanged = tm !== this.mood;
    this.mood = tm;
    if (!this.section || this.section.newSong || moodChanged || name === 'intro' || name === 'tension') this.newSong(name === 'intro' || !this.section);
    this.section = SECTIONS[name];
    this.secName = name;
    this.secBar = 0;
    const season = this.state.season;
    const bpm = tm === 'day' ? (TEMPO.day[season] || 84) : TEMPO[tm];
    this.bpm = bpm + (name === 'celebrate' ? 6 : 0);
    this.mixer.setTempo(this.bpm, t);
    this.mixer.setEcho(tm === 'night' ? 0.42 : tm === 'crisis' ? 0.25 : 0.34, t);
    const pats = ARP[tm] || ARP.day;
    this.arpPat = pats[Math.floor(r() * pats.length)];
    const md = MOOD[tm];
    const s = this.sus;
    s.padFilter.frequency.setTargetAtTime(md.cut * (season === 'spring' ? 1.15 : season === 'autumn' ? 0.85 : 1) + (name === 'B' || name === 'celebrate' ? 250 : 0), t, 2);
    s.padFilter.Q.setTargetAtTime(md.q, t, 2);
    s.strFilter.frequency.setTargetAtTime(tm === 'crisis' ? 1100 : 1600, t, 2);
    this.history.push(`${tm}:${name}`);
    if (this.history.length > 40) this.history.shift();
  }

  newSong(newKey) {
    const r = this.rng;
    if (newKey && this.history.length) this.key = KEYS[Math.floor(r() * KEYS.length)];
    const list = PROGS[this.mood] || PROGS.day;
    this.progA = list[Math.floor(r() * list.length)];
    this.progB = list.length > 1 ? list[(list.indexOf(this.progA) + 1 + Math.floor(r() * (list.length - 1))) % list.length] : this.progA;
    this.motif = null;
  }

  // Stimmführung: jede Flächenstimme nimmt den nächstgelegenen Akkordton.
  voice(chord) {
    const pcs = chord.map((c) => ((this.key + c) % 12 + 12) % 12);
    const prev = this.voicing;
    const used = new Set();
    const out = [];
    for (let k = 0; k < 4; k++) {
      let best = null, bd = 99;
      for (let j = 0; j < pcs.length; j++) {
        if (used.has(j) && used.size < pcs.length) continue;
        for (let m = this.key - 6; m <= this.key + 22; m++) {
          if (((m % 12) + 12) % 12 !== pcs[j]) continue;
          const d = Math.abs(m - prev[k]) + (out.includes(m) ? 50 : 0);
          if (d < bd) { bd = d; best = [m, j]; }
        }
      }
      out.push(best[0]); used.add(best[1]);
    }
    out.sort((a, b) => a - b);
    // Lage halten: nicht zu tief, nicht zu hoch
    if (out[0] < this.key - 5) for (let k = 0; k < 4; k++) out[k] += 12;
    if (out[3] > this.key + 23) for (let k = 0; k < 4; k++) out[k] -= 12;
    return out;
  }

  onBar(t) {
    if (!this.section || this.secBar >= this.section.bars) this.nextSection(t);
    const sec = this.section, md = MOOD[this.mood];
    const prog = sec === SECTIONS.resolve ? PROGS.resolve[0] : sec.progB ? this.progB : this.progA;
    this.chord = prog[this.secBar % prog.length];
    this.voicing = this.voice(this.chord);
    this.sus.setChord(this.voicing, t, this.mood === 'night' ? 0.5 : 0.25);
    const s = this.sus;
    const act = 0.85 + 0.15 * clamp(this.state.activity);
    const mu = (k) => (this.mute.has(k) ? 0 : 1);
    s.padGain.gain.setTargetAtTime(sec.pad * md.pad * md.level * 0.28 * act * mu('pad'), t, 1.2);
    s.strGain.gain.setTargetAtTime(sec.str * md.level * 0.5 * (this.state.season === 'winter' ? 1.2 : 1) * mu('str'), t, 1.8);
    const cr = clamp((this.state.crisis - 0.25) / 0.5);
    s.droneGain.gain.setTargetAtTime(cr * 0.07, t, 2);
    s.droneRoot(this.key + 9 - 24, t);
    // Melodie: Phrase über zwei Takte planen
    if (this.secBar % 2 === 0 && sec.mel > 0 && this.rng() < sec.mel * md.mel) this.planPhrase();
    this.secBar++;
  }

  planPhrase() {
    const r = this.rng;
    const scale = this.scale();
    const prog = this.section.progB ? this.progB : this.progA;
    const chordAt = (bar) => (this.section === SECTIONS.resolve ? PROGS.resolve[0] : prog)[(this.secBar + bar) % prog.length];
    const rhythm = this.motif && r() < 0.5 ? this.motif.rhythm : RHYTHMS[Math.floor(r() * RHYTHMS.length)];
    // Tonvorrat im Melodieregister
    const lo = this.key + 12, hi = this.key + 31;
    const pool = [];
    for (let m = lo; m <= hi; m++) if (scale.includes((((m - this.key) % 12) + 12) % 12)) pool.push(m);
    let idx = this.motif ? Math.min(pool.length - 1, Math.max(0, this.motif.endIdx + Math.floor(r() * 3) - 1)) : Math.floor(pool.length * 0.4 + r() * 3);
    const notes = [];
    rhythm.forEach(([st, len], k) => {
      const ch = chordAt(st >= 16 ? 1 : 0).map((c) => ((((this.key + c) % 12) + 12) % 12));
      if (k > 0) {
        const jump = r() < 0.15 ? (r() < 0.5 ? -3 : 3) : r() < 0.5 ? -1 : 1;
        idx = Math.max(0, Math.min(pool.length - 1, idx + (r() < 0.25 ? 2 * Math.sign(jump) : jump)));
      }
      const strong = st % 8 === 0 || k === rhythm.length - 1;
      if (strong) {
        // auf betonten Zählzeiten zum nächsten Akkordton
        let best = idx, bd = 99;
        for (let j = 0; j < pool.length; j++) if (ch.includes(((pool[j] % 12) + 12) % 12) && Math.abs(j - idx) < bd) { bd = Math.abs(j - idx); best = j; }
        idx = best;
      }
      notes.push({ at: this.abs + st, m: pool[idx], len, vel: strong ? 1 : 0.75 });
    });
    this.motif = { rhythm, endIdx: idx };
    this.mel = notes;
  }

  scheduleStep(t) {
    if (this.step === 0) this.onBar(t);
    const sec = this.section, md = MOOD[this.mood];
    const r = this.rng;
    const ctx = this.ctx;
    const st = this.step;
    const season = this.state.season;
    const night = this.mood === 'night', crisis = this.mood === 'crisis';
    const spb = 60 / this.bpm;
    const hum = () => (r() - 0.5) * 0.012;
    const can = (dur) => this.voices.take(t, t + dur);

    const mute = this.mute;
    // Bass
    if (sec.bass > 0 && !mute.has('bass')) {
      let root = this.key + ROOT.get(this.chord) - 12;
      if (root > this.key - 5) root -= 12;
      const v = 0.095 * sec.bass * md.bass;
      if (crisis) { if (st % 2 === 0) this.sus.bassNote(root, t, spb * 0.4, v * (st % 8 === 0 ? 1 : 0.7)); }
      else if (night || this.mood === 'menu') { if (st === 0) this.sus.bassNote(root, t, spb * 3.6, v * 0.85); }
      else {
        if (st === 0) this.sus.bassNote(root, t, spb * 1.6, v);
        if (st === 8) this.sus.bassNote(root + (r() < 0.6 ? 7 : 12), t, spb * 1.2, v * 0.8);
        if (st === 14 && sec.bass >= 1 && r() < 0.35) this.sus.bassNote(root + 12, t, spb * 0.4, v * 0.6);
      }
    }

    // Arpeggio
    const ai = this.arpPat[st];
    if (ai >= 0 && sec.arp > 0 && !mute.has('arp')) {
      const strong = st % 4 === 0;
      if (r() < sec.arp * md.arp * (strong ? 1 : 0.8)) {
        const kind = crisis ? 'pulse' : night ? 'epiano' : this.mood === 'menu' ? 'kalimba' : ARP_INSTR[season] || 'marimba';
        const m = (ai >= 4 ? this.voicing[3] + 12 : this.voicing[ai]) + 12 + (night ? 0 : 0);
        const vel = (strong ? 0.28 : 0.2) * (0.9 + r() * 0.2) * (night ? 0.8 : 1) * md.level;
        if (can(1.2)) { this.notes++; play(ctx, this.dest, kind, t + hum(), mtof(m), vel, spb, { pan: (r() - 0.5) * 0.6, send: night ? 0.55 : 0.35, echo: night ? 0.25 : 0.1 }); }
      }
    }

    // Melodie
    for (const n of this.mel) {
      if (n.at !== this.abs || mute.has('mel')) continue;
      const kind = crisis ? 'lead' : night ? (season === 'winter' ? 'musicbox' : 'flute') : this.mood === 'menu' ? 'bell' : MEL_INSTR[season] || 'bell';
      const dur = n.len * spb / 4;
      const vel = 0.25 * n.vel * md.level * (kind === 'lead' ? 0.6 : kind === 'flute' ? 0.9 : 1);
      if (can(dur + 1)) { this.notes++; play(ctx, this.dest, kind, t + hum(), mtof(n.m), vel, dur, { pan: 0.15, send: 0.5, echo: 0.12 }); }
    }

    // Schlagwerk
    if (sec.perc > 0 && md.perc > 0 && !mute.has('perc')) {
      const p = sec.perc * md.perc;
      if (crisis) {
        if ((st === 0 || st === 3 || st === 8 || st === 11) && can(0.5)) play(ctx, this.dest, 'tom', t, st % 8 === 0 ? 92 : 78, 0.22 * p, 0, { send: 0.3 });
        if (st % 2 === 1 && r() < 0.6 * p && can(0.05)) play(ctx, this.dest, 'tick', t, 0, 0.05 * p, 0, { pan: 0.3, send: 0.2 });
      } else {
        if ((st === 0 || (st === 8 && p > 0.4)) && r() < p + 0.2 && can(0.35)) play(ctx, this.dest, 'kick', t, 0, 0.16 * p, 0, { send: 0.05 });
        if (st % 4 === 2 && r() < p && can(0.08)) play(ctx, this.dest, 'shaker', t + hum(), 0, 0.06 * p, 0, { pan: 0.35, send: 0.15 });
        if ((st === 4 || st === 12) && r() < p * 0.8 && can(0.05)) play(ctx, this.dest, 'rim', t + hum(), 0, 0.05 * p, 0, { pan: -0.25, send: 0.3 });
        if (st % 2 === 1 && r() < p * 0.25 && can(0.05)) play(ctx, this.dest, 'shaker', t + hum(), 0, 0.03 * p, 0, { pan: 0.4, send: 0.15 });
      }
    }

    // Pulsbahn-Ankünfte: auf Achteln, höchstens zwei je Achtel
    if (st % 2 === 0 && this.queue.length) {
      const take = this.queue.splice(0, 2);
      if (this.queue.length > 4) this.queue.length = 4;
      take.forEach((a, k) => this.pulseNote(a, t + k * 0.06));
    }

    this.step = (this.step + 1) % 16;
    this.abs++;
  }

  // Der Pulsbahn-Ton: Linie und Station bestimmen die Stufe, der Akkord zieht ihn an.
  pulseNote(a, t) {
    const deg = (((a.line | 0) * 2 + (a.station | 0)) % PULSE_SCALE.length + PULSE_SCALE.length) % PULSE_SCALE.length;
    let m = this.key + 12 + PULSE_SCALE[deg];
    const pcs = this.chord.map((c) => ((this.key + c) % 12 + 12) % 12);
    const pc = ((m % 12) + 12) % 12;
    if (!pcs.includes(pc) && (this.mood === 'crisis' || this.rng() < 0.6)) { // in der Krise immer in den Akkord
      let best = m, bd = 99;
      for (let d = -2; d <= 2; d++) if (pcs.includes((((m + d) % 12) + 12) % 12) && Math.abs(d) < bd) { bd = Math.abs(d); best = m + d; }
      m = best;
    }
    const vel = (0.12 + Math.min(0.12, (a.n || 0) * 0.01)) * (this.mood === 'night' ? 0.85 : 1);
    if (this.mute.has('pulse') || !this.voices.take(t, t + 1.7, true)) return;
    this.notes++;
    play(this.ctx, this.dest, 'pluck', t, mtof(m), vel, 0, { pan: (((a.line | 0) % 5) - 2) * 0.15, send: 0.45, echo: this.mood === 'night' ? 0.7 : 0.55 });
  }

  info() {
    return { mood: this.mood, section: this.secName, bar: this.secBar, bpm: this.bpm, key: this.key, chord: this.chord.join(','), notes: this.notes, voices: this.voices.count(this.ctx.currentTime), queue: this.queue.length };
  }
}

export { play as playNote };
