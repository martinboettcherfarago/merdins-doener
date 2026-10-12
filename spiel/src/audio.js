// Generative Klangwelt: Flächenklang in wechselnden Akkorden, jede Zugankunft spielt einen Ton.
// Dazu kurze Effekte für Bauen, Abriss, Fehler und Meilensteine. Alles mit WebAudio erzeugt.

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]; // Dur-Pentatonik
const CHORDS = [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]]; // Imaj7, vi, IV, V
const BASE = 50; // D3

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Audio {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.started = false;
    this.chordIdx = 0;
    this.nextChord = 0;
    this.lastNote = 0;
  }

  start() {
    if (this.started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    } catch (e) { return; }
    const ctx = this.ctx;
    this.started = true;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.music = ctx.createGain();
    this.sfx = ctx.createGain();
    this.music.connect(this.master);
    this.sfx.connect(this.master);
    // Hall aus einer kurzen Rausch-Impulsantwort
    this.reverb = ctx.createConvolver();
    const len = ctx.sampleRate * 2.6;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    this.reverb.buffer = ir;
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.35;
    this.reverb.connect(this.wet);
    this.wet.connect(this.master);
    // Echo für Zugtöne
    this.delay = ctx.createDelay(1);
    this.delay.delayTime.value = 0.38;
    this.fb = ctx.createGain();
    this.fb.gain.value = 0.32;
    this.delay.connect(this.fb); this.fb.connect(this.delay);
    this.delay.connect(this.music);
    // Flächenklang
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0;
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 900;
    this.padFilter.Q.value = 0.6;
    this.padFilter.connect(this.padGain);
    this.padGain.connect(this.music);
    this.padGain.connect(this.reverb);
    this.padOsc = [];
    for (let k = 0; k < 4; k++) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = k === 0 ? 'triangle' : 'sine';
        o.detune.value = det;
        o.frequency.value = mtof(BASE + CHORDS[0][k]);
        const gg = ctx.createGain();
        gg.gain.value = k === 0 ? 0.11 : 0.07;
        o.connect(gg); gg.connect(this.padFilter);
        o.start();
        this.padOsc.push({ o, k });
      }
    }
    // Stadtrauschen
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    let last = 0;
    for (let i = 0; i < nd.length; i++) { last = last * 0.97 + (Math.random() * 2 - 1) * 0.03; nd[i] = last * 3; }
    this.noise = ctx.createBufferSource();
    this.noise.buffer = nb;
    this.noise.loop = true;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0;
    const nf = ctx.createBiquadFilter();
    nf.type = 'lowpass'; nf.frequency.value = 500;
    this.noise.connect(nf); nf.connect(this.noiseGain); this.noiseGain.connect(this.sfx);
    this.noise.start();
    this.applyVolumes();
    this.padGain.gain.setTargetAtTime(1, ctx.currentTime, 3);
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = this.settings;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.volume, t, 0.1);
    this.music.gain.setTargetAtTime(s.music, t, 0.2);
    this.sfx.gain.setTargetAtTime(s.sfx, t, 0.1);
    this.wet.gain.setTargetAtTime(0.35 * s.music, t, 0.2);
  }

  // pro Frame: Akkordwechsel, Zugankünfte, Stadtrauschen
  update(game, engine, dt) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    if (t > this.nextChord) {
      this.chordIdx = (this.chordIdx + 1) % CHORDS.length;
      const ch = CHORDS[this.chordIdx];
      for (const { o, k } of this.padOsc) o.frequency.setTargetAtTime(mtof(BASE + ch[k]), t, 1.2);
      const night = engine ? engine.night : 0;
      this.padFilter.frequency.setTargetAtTime(500 + (1 - night) * 900, t, 2);
      this.nextChord = t + 7.5;
    }
    const arr = game.transit.arrivals;
    if (arr.length) {
      for (const a of arr.splice(0, arr.length)) {
        if (t - this.lastNote < 0.09) continue;
        this.lastNote = t;
        const ch = CHORDS[this.chordIdx];
        const deg = (a.line * 2 + a.station) % SCALE.length;
        let m = BASE + 12 + SCALE[deg];
        // in den Akkord ziehen
        const pc = ((m - BASE) % 12 + 12) % 12;
        if (!ch.some((c) => c % 12 === pc) && Math.random() < 0.6) m += 2;
        this.pluck(mtof(m), 0.12 + Math.min(0.12, a.n * 0.01));
      }
    }
    if (engine && game.speed > 0) {
      const zoom = Math.max(0, Math.min(1, 1 - engine.rig.cur.dist / 120));
      const busy = Math.min(1, game.traffic.cars.length / 400);
      this.noiseGain.gain.setTargetAtTime(0.05 * zoom * (0.3 + busy), t, 0.5);
    } else this.noiseGain.gain.setTargetAtTime(0, t, 0.3);
    void dt;
  }

  pluck(freq, vol = 0.15) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = freq * 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 1.6);
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    o.connect(g); o2.connect(g2); g2.connect(g);
    g.connect(this.music); g.connect(this.delay); g.connect(this.reverb);
    o.start(t); o2.start(t);
    o.stop(t + 1.7); o2.stop(t + 1.7);
  }

  tone(freq, dur, type = 'sine', vol = 0.15, when = 0, dest) {
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(dest || this.sfx);
    if (!dest) g.connect(this.reverb);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }

  noiseBurst(dur, freq, vol, when = 0) {
    const ctx = this.ctx, t = ctx.currentTime + when;
    const len = Math.floor(ctx.sampleRate * dur);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource();
    s.buffer = b;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.sfx);
    s.start(t);
  }

  play(name) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ch = CHORDS[this.chordIdx];
    const n = (i) => mtof(BASE + 24 + ch[i % 4]);
    switch (name) {
      case 'click': this.tone(n(2), 0.12, 'sine', 0.06); break;
      case 'place': this.tone(n(0) / 2, 0.25, 'triangle', 0.16); this.tone(n(2), 0.3, 'sine', 0.08, 0.04); this.noiseBurst(0.08, 900, 0.25); break;
      case 'road': this.noiseBurst(0.14, 1800, 0.22); this.tone(n(1) / 2, 0.15, 'triangle', 0.07); break;
      case 'zone': this.noiseBurst(0.2, 3000, 0.08); this.tone(n(3), 0.25, 'sine', 0.05); break;
      case 'demolish': this.noiseBurst(0.35, 300, 0.5); this.tone(70, 0.4, 'sine', 0.25); break;
      case 'error': this.tone(220, 0.14, 'square', 0.04); this.tone(185, 0.2, 'square', 0.04, 0.12); break;
      case 'line': [0, 1, 2, 3].forEach((i) => this.tone(n(i), 0.5, 'sine', 0.08, i * 0.07)); break;
      case 'milestone': [0, 1, 2, 3].forEach((i) => { this.tone(n(i) / 2, 2.2, 'triangle', 0.08, i * 0.12); this.tone(n(i), 2.4, 'sine', 0.06, i * 0.12 + 0.05); }); break;
      case 'card': [3, 2, 1, 0].forEach((i, k) => this.tone(n(i) * 2, 0.6, 'sine', 0.05, k * 0.05)); break;
      case 'money': this.tone(n(2) * 2, 0.15, 'sine', 0.06); this.tone(n(3) * 2, 0.25, 'sine', 0.06, 0.07); break;
      case 'bad': this.tone(n(0) / 2, 0.6, 'sine', 0.1); this.tone(n(0) / 2 * 1.06, 0.6, 'sine', 0.08); break;
    }
  }
}
