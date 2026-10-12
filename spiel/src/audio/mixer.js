// Mischpult: Busse für Musik, Effekte und Umgebung, zwei Hallräume, Tempo-Echo, Ducking und Limiter.
//
//   Musik  ─ music ──────────── musicVol ─ musicDuck ─┐
//            musicSend ─ musicSendVol ─ Saal-Hall ─────┤
//   Echo (punktierte Achtel, für Pulsbahn-Töne) → music│
//   Effekte ─ sfx ───────────── sfxVol ────────────────┤
//            sfxSend ─ sfxSendVol ─ Raum-Hall ─────────┤── master ─ Hochpass 28 Hz ─ Limiter ─ Ausgang
//   Umgebung ─ amb ─ Dämpfung ─ ambVol ─ ambDuck ──────┤
//            ambSend ─ ambSendVol ─ Raum-Hall ─────────┘
//
// Die Sendewege liegen hinter den Lautstärkereglern, damit „Musik 0" auch den Musikhall stumm macht.
import { makeImpulse, gainNode, filter, clamp } from './core.js';

export class Mixer {
  constructor(ctx, { quality = 'medium', limiter = true } = {}) {
    this.ctx = ctx;
    const low = quality === 'low';
    this.master = gainNode(ctx, 0);
    this.hp = filter(ctx, 'highpass', 28, 0.6);
    this.master.connect(this.hp);
    if (limiter) {
      const c = ctx.createDynamicsCompressor();
      c.threshold.value = -4; c.knee.value = 4; c.ratio.value = 12; c.attack.value = 0.002; c.release.value = 0.2;
      // Sicherheitsnetz hinter dem Limiter: linear bis 0,8, darüber weich bis höchstens 0,98
      const sh = ctx.createWaveShaper();
      const N = 2048, curve = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const x = (i / (N - 1)) * 2 - 1, a = Math.abs(x);
        curve[i] = Math.sign(x) * (a < 0.8 ? a : 0.8 + 0.18 * Math.tanh((a - 0.8) / 0.18));
      }
      sh.curve = curve;
      this.hp.connect(c); c.connect(sh); sh.connect(ctx.destination);
      this.limiter = c;
      this.out = sh;
    } else { this.hp.connect(ctx.destination); this.out = this.hp; }

    // Hallräume: weiter Saal für Musik, kurzer Straßenraum für Effekte und Umgebung
    this.hall = ctx.createConvolver();
    this.hall.buffer = makeImpulse(ctx, low ? 1.8 : 3.2, { decay: 2.4, damp: 0.6, pre: 0.02, seed: 11 });
    this.room = ctx.createConvolver();
    this.room.buffer = makeImpulse(ctx, low ? 0.7 : 1.1, { decay: 3.5, damp: 0.4, pre: 0.006, early: 9, seed: 23 });
    this.hallOut = gainNode(ctx, 0.55); this.hall.connect(this.hallOut); this.hallOut.connect(this.master);
    this.roomOut = gainNode(ctx, 0.5); this.room.connect(this.roomOut); this.roomOut.connect(this.master);

    // Musik
    this.music = gainNode(ctx, 2); // Musik-Grundpegel +6 dB
    this.musicVol = gainNode(ctx, 0);
    this.musicDuck = gainNode(ctx, 1);
    this.music.connect(this.musicVol); this.musicVol.connect(this.musicDuck); this.musicDuck.connect(this.master);
    this.musicSend = gainNode(ctx, 2);
    this.musicSendVol = gainNode(ctx, 0);
    this.musicSend.connect(this.musicSendVol); this.musicSendVol.connect(this.hall);

    // Effekte
    this.sfx = gainNode(ctx, 1.4); // Effekte +3 dB
    this.sfxVol = gainNode(ctx, 0);
    this.sfx.connect(this.sfxVol); this.sfxVol.connect(this.master);
    this.sfxSend = gainNode(ctx, 1.4);
    this.sfxSendVol = gainNode(ctx, 0);
    this.sfxSend.connect(this.sfxSendVol); this.sfxSendVol.connect(this.room);

    // Umgebung (mit Dämpfungsfilter für Schnee/Nebel)
    this.amb = gainNode(ctx, 1);
    this.ambMuffle = filter(ctx, 'lowpass', 18000, 0.5);
    this.ambVol = gainNode(ctx, 0);
    this.ambDuck = gainNode(ctx, 1);
    this.amb.connect(this.ambMuffle); this.ambMuffle.connect(this.ambVol); this.ambVol.connect(this.ambDuck); this.ambDuck.connect(this.master);
    this.ambSend = gainNode(ctx, 1);
    this.ambSendVol = gainNode(ctx, 0);
    this.ambSend.connect(this.ambSendVol); this.ambSendVol.connect(this.room);

    // Echo im Tempo (für Pulsbahn-Töne und Glocken)
    this.echo = gainNode(ctx, 1);
    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = 0.38;
    this.echoFb = gainNode(ctx, 0.34);
    this.echoTone = filter(ctx, 'lowpass', 2800, 0.5);
    this.echo.connect(this.delay);
    this.delay.connect(this.echoTone); this.echoTone.connect(this.echoFb); this.echoFb.connect(this.delay);
    this.echoOut = gainNode(ctx, 0.8);
    this.echoTone.connect(this.echoOut); this.echoOut.connect(this.music);
    this.echoWide = gainNode(ctx, 0.25); this.echoOut.connect(this.echoWide); this.echoWide.connect(this.musicSend);

    this.vol = { master: 0, music: 0, sfx: 0, amb: 0 };
  }

  // Lautstärken aus den Einstellungen (settings.volume, music, sfx, muted; optional ambience)
  setVolumes(s, t) {
    const amb = s.ambience == null ? 1 : s.ambience;
    const m = s.muted ? 0 : clamp(+s.volume || 0, 0, 1);
    this.vol = { master: m, music: clamp(+s.music || 0, 0, 1), sfx: clamp(+s.sfx || 0, 0, 1), amb: clamp(+s.sfx || 0, 0, 1) * clamp(+amb, 0, 1) };
    const curve = (v) => v; // linear wie bisher
    this.master.gain.setTargetAtTime(curve(this.vol.master), t, 0.08);
    this.musicVol.gain.setTargetAtTime(curve(this.vol.music), t, 0.15);
    this.musicSendVol.gain.setTargetAtTime(curve(this.vol.music), t, 0.15);
    this.sfxVol.gain.setTargetAtTime(curve(this.vol.sfx), t, 0.08);
    this.sfxSendVol.gain.setTargetAtTime(curve(this.vol.sfx), t, 0.08);
    this.ambVol.gain.setTargetAtTime(curve(this.vol.amb), t, 0.2);
    this.ambSendVol.gain.setTargetAtTime(curve(this.vol.amb), t, 0.2);
  }

  // Lautheit kurz absenken, damit große Ereignisse durchkommen.
  duck(t, music = 0.5, amb = 0.6, hold = 1.5) {
    const d = (p, v) => { p.cancelScheduledValues(t); p.setTargetAtTime(v, t, 0.06); p.setTargetAtTime(1, t + hold, 0.9); };
    d(this.musicDuck.gain, music);
    d(this.ambDuck.gain, amb);
  }

  // Schnee schluckt Höhen, Nebel ein wenig.
  setMuffle(freq, t) { this.ambMuffle.frequency.setTargetAtTime(freq, t, 1.5); }

  setTempo(bpm, t) {
    const d = clamp((60 / bpm) * 0.75, 0.2, 1.2); // punktierte Achtel
    this.delay.delayTime.setTargetAtTime(d, t, 0.5);
  }

  setEcho(fb, t) { this.echoFb.gain.setTargetAtTime(clamp(fb, 0, 0.6), t, 0.5); }
}
