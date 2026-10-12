// Effektklänge für Oberfläche und Spielereignisse. Tonale Klänge stehen im aktuellen Akkord der Musik,
// damit Klicks, Bauen und Meldungen nie schief klingen. Jeder Name hat eine Mindestpause (gegen
// Dauerfeuer beim Ziehen) und eine Priorität; die Stimmenbegrenzung verwirft bei Gedränge zuerst
// Unwichtiges. Mit { x, y } (Feld) oder { wx, wz } (Welt) wird ein Klang räumlich: Panorama und
// Entfernung relativ zur Kamera, zu weit Entferntes entfällt.
import * as S from './synths.js';
import { gainNode, filter, osc, noiseSrc, buffers, adEnv, ahrEnv, Voices, mtof, clamp, rand } from './core.js';
import { playNote } from './music.js';

// Mindestabstand (s) zwischen zwei Klängen gleichen Namens
const THROTTLE = {
  click: 0.03, hover: 0.06, tab: 0.04, toggle: 0.05, open: 0.08, close: 0.08, place: 0.05, road: 0.06, zone: 0.06,
  demolish: 0.08, error: 0.12, money: 0.08, bad: 1.2, good: 0.8, notify: 0.5, warn: 0.6, complete: 0.5, levelup: 0.4,
  busStop: 0.6, bus: 0.6, horn: 0.4, plane: 4, helicopter: 3, train: 3, ship: 4, thunder: 0.5, siren: 6, disaster: 1.5,
  card: 0.3, line: 0.15, milestone: 1, achievement: 1, unlock: 0.5, speed: 0.08, pause: 0.15, resume: 0.15, photo: 0.2,
  fire: 1, extinguish: 1, quake: 3, explosion: 0.8, meteor: 2, tornado: 3, flood: 3, storm: 3, churchbell: 10, bell: 1,
  bankrupt: 3, loan: 0.5, season: 4, pop: 0.04, whoosh: 0.06,
};
// Wichtige Klänge setzen sich gegen die Stimmenbegrenzung durch
const FORCE = new Set(['milestone', 'disaster', 'siren', 'achievement', 'bankrupt', 'error', 'quake', 'meteor', 'tornado', 'flood', 'explosion', 'thunder', 'card']);

export const SFX_NAMES = Object.keys(THROTTLE).concat(['fanfare', 'cash', 'coins', 'ui']);

export class Sfx {
  constructor(ctx, mixer, host = {}) {
    this.ctx = ctx;
    this.mixer = mixer;
    this.host = host; // { chord(), spatial(o) → {gain, pan, send} | null, lastAdded(), lastRemoved() }
    this.dest = { dry: mixer.sfx, send: mixer.sfxSend, echo: mixer.echo };
    this.voices = new Voices(16);
    this.last = {};
    this.count = 0;
  }

  chord() { return this.host.chord ? this.host.chord() : [50, 54, 57, 61]; }

  play(name, o = {}, now = this.ctx.currentTime) {
    if (name === 'fanfare') name = 'milestone';
    if (name === 'cash' || name === 'coins') name = 'money';
    if (name === 'ui') name = 'click';
    const th = THROTTLE[name];
    if (th == null) return false;
    if (now - (this.last[name] == null ? -1e9 : this.last[name]) < th) return false;
    let pos = null;
    if (o && (o.x != null || o.wx != null) && this.host.spatial) {
      pos = this.host.spatial(o);
      if (!pos) return false;
    }
    const est = name === 'milestone' || name === 'disaster' || name === 'siren' || name === 'quake' ? 8 : 2;
    if (!this.voices.take(now, now + est, FORCE.has(name))) return false;
    this.last[name] = now;
    this.count++;
    const t = now + 0.005;
    try { this.make(name, t, o || {}, pos); } catch (e) { this.lastError = `${name}: ${e.message}`; /* ein fehlerhafter Klang darf das Spiel nie stören */ }
    return true;
  }

  // ---- Bausteine
  tone(f, t, dur, type = 'sine', vel = 0.1, o = {}) {
    const ctx = this.ctx;
    const v = S.voiceOut(ctx, this.dest, { gain: vel, pan: o.pan || 0, send: o.send == null ? 0.25 : o.send });
    const x = osc(ctx, type, f, t);
    if (o.to) x.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur * 0.5));
    let node = x;
    if (o.lp) { const lp = filter(ctx, 'lowpass', o.lp, 0.7); x.connect(lp); node = lp; }
    const g = gainNode(ctx, 0);
    node.connect(g); g.connect(v.node);
    adEnv(g.gain, t, 1, o.a || 0.006, dur);
    x.start(t); x.stop(t + dur + (o.a || 0.006) + 0.05);
    v.release(x);
  }

  noise(t, dur, type, freq, vel, o = {}) {
    const ctx = this.ctx;
    const B = buffers(ctx);
    const v = S.voiceOut(ctx, this.dest, { gain: vel, pan: o.pan || 0, send: o.send == null ? 0.2 : o.send });
    const src = noiseSrc(ctx, B[o.buf || 'white'], t, dur + 0.05);
    const f = filter(ctx, type, freq, o.q || 0.8);
    if (o.to) { f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(o.to, t + dur); }
    const g = gainNode(ctx, 0);
    src.connect(f); f.connect(g); g.connect(v.node);
    if (o.hold) ahrEnv(g.gain, t, 1, o.a || 0.005, o.hold, dur);
    else adEnv(g.gain, t, 1, o.a || 0.003, dur);
    v.release(src);
  }

  note(kind, t, f, vel, dur = 0.3, o = {}) { playNote(this.ctx, this.dest, kind, t, f, vel, dur, o); }

  make(name, t, o, pos) {
    const ch = this.chord();
    const n = (i) => mtof(ch[((i % 4) + 4) % 4] + 24 + 12 * Math.floor(i / 4));
    const det = () => rand(0.985, 1.015);
    const P = pos ? { pan: pos.pan, send: pos.send } : {};
    const G = pos ? pos.gain : 1;
    const ctx = this.ctx, dest = pos ? { ...this.dest } : this.dest;
    const sp = (x) => ({ ...x, ...(pos ? { pan: pos.pan, send: Math.max(x.send || 0, pos.send) } : {}), gain: (x.gain == null ? 1 : x.gain) * G });

    switch (name) {
      // ---------- Oberfläche
      case 'click':
        this.tone(n(2) * det(), t, 0.08, 'sine', 0.075, { to: n(2) * 0.75, glide: 0.03, send: 0.1 });
        this.noise(t, 0.008, 'highpass', 5000, 0.07, { send: 0 });
        break;
      case 'hover': this.noise(t, 0.01, 'bandpass', 5500, 0.09, { q: 1.5, send: 0 }); break;
      case 'tab': this.tone(n(3) * det(), t, 0.06, 'sine', 0.04, { send: 0.1 }); break;
      case 'toggle':
        this.tone(n(0) * 2, t, 0.04, 'triangle', 0.04, { send: 0.05, lp: 3000 });
        this.tone(n(2) * 2, t + 0.06, 0.05, 'triangle', 0.04, { send: 0.05, lp: 3000 });
        break;
      case 'open': S.whoosh(ctx, dest, t, { f0: 600, f1: 2200, dur: 0.18, peak: 0.6, gain: 0.07 }); this.tone(n(2), t + 0.06, 0.18, 'sine', 0.035); break;
      case 'close': S.whoosh(ctx, dest, t, { f0: 2200, f1: 600, dur: 0.16, peak: 0.6, gain: 0.06 }); this.tone(n(0), t + 0.04, 0.15, 'sine', 0.03); break;
      case 'pop': this.tone(600 * det(), t, 0.05, 'sine', 0.06, { to: 1300, glide: 0.03 }); break;
      case 'whoosh': S.whoosh(ctx, dest, t, { gain: 0.3 }); break;
      case 'speed': {
        const k = clamp(o.level || 1, 1, 3);
        for (let i = 0; i < k; i++) this.tone(n(i + 1) * 1.0, t + i * 0.06, 0.06, 'triangle', 0.04, { lp: 2500, send: 0.1 });
        break;
      }
      case 'pause': this.tone(n(2), t, 0.12, 'sine', 0.045); this.tone(n(0), t + 0.09, 0.2, 'sine', 0.045); break;
      case 'resume': this.tone(n(0), t, 0.12, 'sine', 0.045); this.tone(n(2), t + 0.09, 0.2, 'sine', 0.045); break;
      case 'photo':
        this.noise(t, 0.03, 'highpass', 2000, 0.2, { send: 0.05 });
        this.noise(t + 0.09, 0.04, 'bandpass', 900, 0.25, { q: 1.5, send: 0.05 });
        this.noise(t + 0.1, 0.02, 'highpass', 3000, 0.12, { send: 0.05 });
        break;

      // ---------- Bauen
      case 'place': {
        this.tone(n(0) / 4, t, 0.2, 'sine', 0.2, { to: n(0) / 6, glide: 0.12, send: 0.1 });
        this.noise(t, 0.04, 'bandpass', 1100, 0.55, { q: 1.6, send: 0.15 });
        this.tone(n(2) * det(), t + 0.04, 0.32, 'triangle', 0.08, { lp: 2600 });
        this.tone(n(4) * det(), t + 0.07, 0.4, 'sine', 0.035, { send: 0.35 });
        const b = this.host.lastAdded ? this.host.lastAdded() : null;
        const cat = b ? b.cat : '';
        if (cat === 'parks') { this.noise(t + 0.05, 0.25, 'bandpass', 3500, 0.12, { q: 0.7, hold: 0.08, a: 0.03 }); S.birdTweet(ctx, dest, t + 0.2, { gain: 0.04, send: 0.3 }); }
        else if (cat === 'power') {
          const v = S.voiceOut(ctx, dest, { gain: 0.06, send: 0.2 });
          const x = osc(ctx, 'sawtooth', 110, t), bp = filter(ctx, 'bandpass', 400, 2), g = gainNode(ctx, 0);
          bp.frequency.setValueAtTime(400, t + 0.05); bp.frequency.exponentialRampToValueAtTime(3000, t + 0.3);
          x.connect(bp); bp.connect(g); g.connect(v.node);
          ahrEnv(g.gain, t + 0.05, 1, 0.02, 0.15, 0.25);
          x.start(t); x.stop(t + 0.6); v.release(x);
        } else if (cat === 'water') S.bubbles(ctx, dest, t + 0.06, { gain: 0.14, send: 0.25, n: 5 });
        else if (cat === 'landmarks') [0, 1, 2, 3].forEach((i) => this.note('bell', t + 0.08 + i * 0.07, n(i) / 2, 0.05, 0.5, { send: 0.5 }));
        else if (cat === 'transit' || cat === 'transport') { this.note('bell', t + 0.08, n(2), 0.04, 0.4, { send: 0.4 }); this.note('bell', t + 0.3, n(0), 0.04, 0.4, { send: 0.4 }); }
        else if (cat === 'services' || cat === 'education' || cat === 'safety') this.note('bell', t + 0.1, n(3), 0.035, 0.4, { send: 0.4 });
        else if (cat === 'industry' || cat === 'garbage') S.clank(ctx, dest, t + 0.06, { gain: 0.05, send: 0.25 });
        break;
      }
      case 'road':
        this.noise(t, 0.16, 'bandpass', 480, 0.5, { buf: 'brown', q: 0.6, hold: 0.1, a: 0.01, send: 0.1 });
        this.noise(t, 0.1, 'bandpass', 1800, 0.12, { send: 0.1 });
        this.tone(n(1) / 2 * det(), t, 0.15, 'triangle', 0.06, { lp: 1800 });
        break;
      case 'zone':
        this.noise(t, 0.16, 'bandpass', 2800, 0.12, { to: 1400, hold: 0.06, a: 0.02, send: 0.15 });
        this.tone(n(3) * det(), t + 0.02, 0.25, 'sine', 0.045);
        break;
      case 'demolish': {
        const big = clamp(o.size || (this.host.lastRemoved ? this.host.lastRemoved() : 1), 1, 6);
        const k = 0.7 + Math.min(1, (big - 1) / 4) * 0.5;
        this.noise(t, 0.5 + big * 0.06, 'bandpass', 380, 0.6 * k, { buf: 'brown', q: 0.5, send: 0.25 });
        this.noise(t + 0.03, 0.35, 'bandpass', 2000, 0.4 * k, { buf: 'crackle', q: 0.6, hold: 0.15, a: 0.02, send: 0.25 });
        this.tone(72, t, 0.4, 'sine', 0.22 * k, { to: 40, glide: 0.3, send: 0.05 });
        break;
      }
      case 'complete':
        this.noise(t, 0.025, 'bandpass', 1300, 0.2 * G, { q: 4, ...P });
        this.note('marimba', t + 0.02, n(2), 0.07 * G, 0.3, { ...P });
        this.note('marimba', t + 0.14, n(4), 0.05 * G, 0.3, { ...P });
        break;
      case 'levelup':
        this.note('marimba', t, n(0), 0.06 * G, 0.3, { ...P });
        this.note('marimba', t + 0.1, n(2), 0.06 * G, 0.3, { ...P });
        this.note('celesta', t + 0.2, n(4), 0.04 * G, 0.3, { ...P });
        break;
      case 'line': [0, 1, 2, 3].forEach((i) => this.note('pluck', t + i * 0.07, n(i), 0.07, 0, { send: 0.4, echo: 0.4 })); break;
      case 'error':
        this.tone(220, t, 0.14, 'square', 0.035, { lp: 1100, send: 0.1 });
        this.tone(185, t + 0.12, 0.2, 'square', 0.035, { lp: 1000, send: 0.1 });
        break;

      // ---------- Fortschritt und Meldungen
      case 'milestone': {
        this.mixer.duck(t, 0.4, 0.5, 2.4);
        [0, 1, 2, 3].forEach((i) => {
          this.tone(n(i) / 2, t + i * 0.12, 2.2, 'triangle', 0.07, { lp: 3000, send: 0.5 });
          this.tone(n(i), t + i * 0.12 + 0.05, 2.4, 'sine', 0.05, { send: 0.5 });
          this.note('bell', t + i * 0.12, n(i), 0.05, 1, { send: 0.6 });
        });
        [0, 1, 2, 3, 4].forEach((i) => this.tone(n(i) * 2, t + 0.7 + i * 0.08, 1.2, 'sine', 0.02, { send: 0.7 }));
        this.noise(t, 1.4, 'lowpass', 180, 0.3, { buf: 'brown', hold: 0.4, a: 0.5, send: 0.3 });
        this.tone(80, t + 0.95, 0.5, 'sine', 0.2, { to: 48, glide: 0.25, send: 0.2 });
        break;
      }
      case 'achievement':
        this.mixer.duck(t, 0.6, 0.7, 1.2);
        [0, 1, 2, 3, 4].forEach((i) => this.note('bell', t + i * 0.08, n(i), 0.06, 1, { send: 0.55 }));
        [0, 2, 4].forEach((i) => this.tone(n(i) * 2, t + 0.45 + i * 0.05, 0.9, 'sine', 0.018, { send: 0.6 }));
        break;
      case 'unlock': [0, 1, 2, 3, 4].forEach((i) => this.note('celesta', t + i * 0.06, n(i), 0.055, 0.3, { send: 0.45 })); break;
      case 'card':
        S.whoosh(ctx, dest, t, { f0: 3000, f1: 6000, dur: 0.16, peak: 0.6, gain: 0.06 });
        [3, 2, 1, 0].forEach((i, k) => this.tone(n(i) * 2, t + 0.05 + k * 0.05, 0.6, 'sine', 0.045, { send: 0.4 }));
        break;
      case 'money':
        this.tone(n(2) * 2, t, 0.15, 'sine', 0.06, { send: 0.2 });
        this.tone(n(3) * 2, t + 0.07, 0.25, 'sine', 0.06, { send: 0.2 });
        this.tone(n(3) * 2 * 2.76, t + 0.07, 0.1, 'sine', 0.015, { send: 0.2 });
        break;
      case 'loan':
        S.whoosh(ctx, dest, t, { f0: 2500, f1: 5000, dur: 0.14, gain: 0.05 });
        this.play('money', {}, t + 0.1);
        break;
      case 'bad':
        this.tone(n(0) / 2, t, 0.6, 'sine', 0.09, { send: 0.3 });
        this.tone(n(0) / 2 * 1.06, t, 0.6, 'sine', 0.07, { send: 0.3 });
        break;
      case 'good':
        this.note('bell', t, n(0), 0.05, 0.6, { send: 0.45 });
        this.note('bell', t + 0.11, n(2), 0.05, 0.6, { send: 0.45 });
        break;
      case 'notify': this.note('bell', t, n(2), 0.045, 0.5, { send: 0.45 }); break;
      case 'warn':
        this.tone(n(1), t, 0.12, 'triangle', 0.06, { lp: 2200, send: 0.2 });
        this.tone(n(1), t + 0.2, 0.12, 'triangle', 0.06, { lp: 2200, send: 0.2 });
        break;
      case 'bankrupt': {
        const base = n(0) / 2;
        [0, -1, -2, -3.5].forEach((st, k) => this.tone(base * Math.pow(2, st / 12), t + k * 0.42, k === 3 ? 1.2 : 0.38, 'sawtooth', 0.05, { lp: 900, to: k === 3 ? base * Math.pow(2, -5 / 12) : undefined, glide: 1, send: 0.3 }));
        break;
      }
      case 'season': {
        const sea = o.season || 'summer';
        const kind = sea === 'winter' ? 'celesta' : sea === 'spring' ? 'kalimba' : sea === 'autumn' ? 'guitar' : 'marimba';
        const seq = sea === 'winter' ? [4, 2, 1, 0] : sea === 'autumn' ? [2, 1, 0, -1] : [0, 1, 2, 4];
        seq.forEach((i, k) => this.note(kind, t + k * 0.14, n(i), 0.06, 0.4, { send: 0.5 }));
        break;
      }

      // ---------- Stadt
      case 'busStop': case 'bus': S.busStop(ctx, dest, t, sp({ gain: 0.45, send: 0.2, f1: n(2), f2: n(0) })); break;
      case 'plane': S.jetFlyby(ctx, dest, t, sp({ gain: 0.18, send: 0.3 })); break;
      case 'helicopter': {
        const B = buffers(ctx);
        const v = S.voiceOut(ctx, dest, sp({ gain: 0.35, send: 0.2 }));
        const src = noiseSrc(ctx, B.brown, t, 3.6), lp = filter(ctx, 'bandpass', 260, 0.6), am = gainNode(ctx, 0.5), g = gainNode(ctx, 0);
        const r = osc(ctx, 'square', 11.5, t), rd = gainNode(ctx, 0.45);
        r.connect(rd); rd.connect(am.gain);
        src.connect(lp); lp.connect(am); am.connect(g); g.connect(v.node);
        ahrEnv(g.gain, t, 1, 0.9, 1.2, 1.3);
        r.start(t); r.stop(t + 3.6); v.release(r);
        break;
      }
      case 'train': S.stationChime(ctx, dest, t, sp({ gain: 0.18, send: 0.5, fs: [n(4), n(2), n(0)] })); break;
      case 'ship': S.shipHorn(ctx, dest, t, sp({ gain: 0.22, send: 0.6 })); break;
      case 'horn': S.horn(ctx, dest, t, sp({ gain: 0.12, send: 0.2 })); break;
      case 'bell': S.bikeBell(ctx, dest, t, sp({ gain: 0.1, send: 0.2 })); break;
      case 'churchbell': for (let k = 0; k < (o.count || 3); k++) S.churchBell(ctx, dest, t + k * 2.3, sp({ gain: 0.08, send: 0.7, f: o.f || 220 })); break;

      // ---------- Feuer, Wetter, Katastrophen
      case 'fire': S.ignite(ctx, dest, t, sp({ gain: 0.16, send: 0.3 })); break;
      case 'extinguish': S.hiss(ctx, dest, t, sp({ gain: 0.35, send: 0.3 })); S.bubbles(ctx, dest, t + 0.3, sp({ gain: 0.08, send: 0.3, n: 3 })); break;
      case 'thunder': S.thunder(ctx, dest, t, sp({ close: o.close == null ? 0.8 : o.close, gain: 0.25, send: 0.4 })); break;
      case 'storm': S.thunder(ctx, dest, t, sp({ close: 0.3, gain: 0.28, send: 0.6 })); S.tornado(ctx, dest, t, sp({ gain: 0.13, send: 0.3, dur: 3 })); break;
      case 'siren': S.civilSiren(ctx, dest, t, sp({ gain: 0.32, send: 0.65, cycles: o.cycles || 2 })); this.mixer.duck(t, 0.55, 0.75, 7); break;
      case 'disaster': {
        this.mixer.duck(t, 0.35, 0.6, 3);
        S.boom(ctx, dest, t, sp({ gain: 0.3, send: 0.4, big: 1 }));
        const v = S.voiceOut(ctx, dest, { gain: 0.05, send: 0.5 });
        const lp = filter(ctx, 'lowpass', 300, 2), g = gainNode(ctx, 0);
        lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(1300, t + 0.5); lp.frequency.exponentialRampToValueAtTime(260, t + 2.4);
        lp.connect(g); g.connect(v.node);
        let last;
        for (const r of [0.25, 0.25 * 1.059, 0.25 * 1.498, 0.5 * 1.06]) { const x = osc(ctx, 'sawtooth', n(0) * r, t); x.connect(lp); x.start(t); x.stop(t + 2.6); last = x; }
        ahrEnv(g.gain, t, 1, 0.05, 0.7, 1.6);
        v.release(last);
        break;
      }
      case 'quake': this.mixer.duck(t, 0.5, 0.7, 4); S.quake(ctx, dest, t, sp({ gain: 0.22, send: 0.2, dur: o.dur || 4 })); break;
      case 'explosion': S.boom(ctx, dest, t, sp({ gain: 0.35, send: 0.35, big: 0.8 })); this.noise(t + 0.05, 0.8, 'bandpass', 2200, 0.2 * G, { buf: 'crackle', q: 0.6, hold: 0.3, ...P }); break;
      case 'meteor': this.mixer.duck(t + 1.6, 0.4, 0.6, 3); S.meteor(ctx, dest, t, sp({ gain: 0.28, send: 0.4 })); break;
      case 'tornado': S.tornado(ctx, dest, t, sp({ gain: 0.28, send: 0.3, dur: o.dur || 5 })); break;
      case 'flood': S.waterRush(ctx, dest, t, sp({ gain: 0.32, send: 0.3, dur: o.dur || 4 })); break;
    }
  }
}
