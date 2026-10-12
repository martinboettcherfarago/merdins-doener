// Klanglandschaft: Dauerklänge („Betten") und zufällige Ereignisse, gesteuert vom Hörort (scene.js).
//
// Betten sind kleine, dauerhaft verdrahtete Ketten (Rauschpuffer/Oszillator → Filter → Pegel → Panorama).
// Sie werden wiederverwendet und nur ihr Pegel wird nachgeführt; ist ein Bett einige Sekunden stumm,
// schläft es (Quellen gestoppt, kein Rechenaufwand) und wacht bei Bedarf mit neuen Quellen wieder auf.
// Ereignisse (Vögel, Hupen, Hämmern, Donner …) entstehen nach Poisson-Raten pro Sekunde; eine
// Stimmenbegrenzung und Abklingzeiten pro Art halten die Dichte in Grenzen.
import { buffers, gainNode, filter, panner, osc, noiseSrc, Voices, clamp, rand, pick, mtof } from './core.js';
import * as S from './synths.js';

// ---------- Betten
class Bed {
  constructor(amb, name, def) {
    const ctx = amb.ctx;
    this.name = name;
    this.ctx = ctx;
    this.k = def.k || 1;
    this.level = gainNode(ctx, 0);
    this.panNode = panner(ctx, 0);
    this.level.connect(this.panNode);
    this.panNode.connect(amb.dest.dry);
    if (def.send) { this.sendG = gainNode(ctx, def.send); this.panNode.connect(this.sendG); this.sendG.connect(amb.dest.send); }
    this.head = gainNode(ctx, 1);
    this.head.connect(this.level);
    this.p = def.build(ctx, this.head, amb.bufs);
    this.awake = false;
    this.srcs = [];
    this.quietSince = 0;
    this.v = 0;
  }
  set(v, t, tc = 0.8, pan = null) {
    v = Number.isFinite(v) ? Math.max(0, v) : 0;
    this.v = v;
    if (v > 0.0008 && !this.awake) this.wake(t);
    if (this.awake) this.level.gain.setTargetAtTime(v * this.k, t, tc);
    if (pan != null && Number.isFinite(pan)) this.panNode.pan.setTargetAtTime(clamp(pan, -1, 1), t, 0.7);
    if (v <= 0.0008) {
      if (!this.quietSince) this.quietSince = t;
      else if (this.awake && t - this.quietSince > 3 + tc * 6) this.sleep(t);
    } else this.quietSince = 0;
  }
  wake(t) { this.srcs = this.p.start(t); this.awake = true; this.quietSince = 0; }
  sleep(t) {
    for (const s of this.srcs) { try { s.stop(t); } catch (e) { /* schon gestoppt */ } }
    const old = this.srcs;
    setTimeout(() => { for (const s of old) { try { s.disconnect(); } catch (e) { /* egal */ } } }, 200);
    this.srcs = [];
    this.awake = false;
  }
}

const loop = (ctx, buf, t, dest, rate = 1) => { const s = noiseSrc(ctx, buf, t, 0, true, rate); s.connect(dest); return s; };
const lfo = (ctx, t, f, depth, param, type = 'sine') => { const o = osc(ctx, type, f, t); const d = gainNode(ctx, depth); o.connect(d); d.connect(param); o.start(t); return o; };

// Bauanleitungen der Betten. build(ctx, out, B) → { start(t) → Quellen, …Stellglieder }
const BEDS = {
  // Reifen und Motoren: tiefes Rollen + Reifenzischen (lauter bei nasser Fahrbahn)
  traffic: { send: 0.12, k: 0.3, build(ctx, out, B) {
    const lp = filter(ctx, 'lowpass', 420, 0.5), hp = filter(ctx, 'highpass', 70, 0.5), bp = filter(ctx, 'bandpass', 1500, 0.6);
    const hg = gainNode(ctx, 0.3);
    lp.connect(hp); hp.connect(out); bp.connect(hg); hg.connect(out);
    return { lp, hg, start: (t) => [loop(ctx, B.brown, t, lp), loop(ctx, B.pink, t, bp)] };
  } },
  highway: { send: 0.08, k: 0.29, build(ctx, out, B) {
    const lp = filter(ctx, 'lowpass', 300, 0.5), bp = filter(ctx, 'bandpass', 900, 0.4);
    const bg = gainNode(ctx, 0.45);
    lp.connect(out); bp.connect(bg); bg.connect(out);
    return { start: (t) => [loop(ctx, B.brown, t, lp), loop(ctx, B.pink, t, bp, 0.9)] };
  } },
  // fernes Stadtrauschen (aus der Höhe)
  cityHum: { send: 0.2, k: 0.3, build(ctx, out, B) {
    const lp = filter(ctx, 'lowpass', 170, 0.5), bp = filter(ctx, 'bandpass', 520, 0.5);
    const bg = gainNode(ctx, 0.35);
    lp.connect(out); bp.connect(bg); bg.connect(out);
    return { start: (t) => [loop(ctx, B.brown, t, lp, 0.8), loop(ctx, B.pink, t, bp, 0.7)] };
  } },
  // Stimmengewirr: Rauschen durch drei Formantfilter mit Silbenrhythmus
  murmur: { send: 0.25, k: 1.5, build(ctx, out, B) {
    const am = gainNode(ctx, 0.6);
    am.connect(out);
    const fs = [[480, 2.6, 1], [1150, 3.2, 0.7], [2500, 3.8, 0.35]];
    const bands = fs.map(([f, q, a]) => { const b = filter(ctx, 'bandpass', f, q); const g = gainNode(ctx, a); b.connect(g); g.connect(am); return b; });
    return { start: (t) => {
      const src = noiseSrc(ctx, B.pink, t, 0, true);
      for (const b of bands) src.connect(b);
      return [src, lfo(ctx, t, 3.7, 0.22, am.gain), lfo(ctx, t, 5.9, 0.14, am.gain), lfo(ctx, t, 0.31, 0.12, am.gain)];
    } };
  } },
  // Baustelle: Generatorbrummen + Arbeitsgeräusch
  construction: { send: 0.15, k: 0.5, build(ctx, out, B) {
    const lp = filter(ctx, 'lowpass', 220, 1.5), bp = filter(ctx, 'bandpass', 1900, 1);
    const og = gainNode(ctx, 0.25), ng = gainNode(ctx, 0.5);
    lp.connect(og); og.connect(out); bp.connect(ng); ng.connect(out);
    return { start: (t) => { const o = osc(ctx, 'sawtooth', 61, t); o.connect(lp); o.start(t); return [o, loop(ctx, B.pink, t, bp)]; } };
  } },
  // Industrie: Netzbrummen 50/100 Hz, tiefes Rumpeln, Dampfzischen
  industry: { send: 0.18, k: 0.2, build(ctx, out, B) {
    const lp = filter(ctx, 'lowpass', 170, 2), bp = filter(ctx, 'bandpass', 300, 3), deep = filter(ctx, 'lowpass', 95, 0.7), hs = filter(ctx, 'bandpass', 3300, 1.2);
    const g1 = gainNode(ctx, 0.5), g2 = gainNode(ctx, 0.12), g3 = gainNode(ctx, 1), g4 = gainNode(ctx, 0.12);
    lp.connect(g1); bp.connect(g2); deep.connect(g3); hs.connect(g4);
    for (const g of [g1, g2, g3, g4]) g.connect(out);
    return { start: (t) => {
      const a = osc(ctx, 'sawtooth', 50, t), b = osc(ctx, 'sawtooth', 100.4, t);
      a.connect(lp); b.connect(bp); a.start(t); b.start(t);
      return [a, b, loop(ctx, B.brown, t, deep), loop(ctx, B.pink, t, hs)];
    } };
  } },
  // Blätterrauschen im Wind (Böen)
  leaves: { send: 0.15, k: 0.88, build(ctx, out, B) {
    const bp = filter(ctx, 'bandpass', 2600, 0.55), hp = filter(ctx, 'highpass', 600, 0.5);
    const gust = gainNode(ctx, 0.55);
    bp.connect(hp); hp.connect(gust); gust.connect(out);
    return { gust, bp, start: (t) => [loop(ctx, B.pink, t, bp), lfo(ctx, t, 0.13, 0.25, gust.gain), lfo(ctx, t, 0.31, 0.18, gust.gain)] };
  } },
  // Wasser: Wellenschlag (langsam schwellend) + Plätschern
  water: { send: 0.2, k: 0.37, build(ctx, out, B) {
    const lp = filter(ctx, 'lowpass', 520, 0.6), bp = filter(ctx, 'bandpass', 1250, 0.9);
    const w1 = gainNode(ctx, 0.6), w2 = gainNode(ctx, 0.18);
    lp.connect(w1); bp.connect(w2); w1.connect(out); w2.connect(out);
    return { lp, start: (t) => [loop(ctx, B.brown, t, lp), loop(ctx, B.pink, t, bp), lfo(ctx, t, 0.16, 0.38, w1.gain), lfo(ctx, t, 0.23, 0.1, w2.gain)] };
  } },
  // Regen: Fläche + starker Regen (Zischen) + Tropfen in der Nähe
  rain: { send: 0.12, k: 0.44, build(ctx, out, B) {
    const hp = filter(ctx, 'highpass', 450, 0.6), lp = filter(ctx, 'lowpass', 5200, 0.5), hv = filter(ctx, 'highpass', 3200, 0.6), dr = filter(ctx, 'bandpass', 3000, 0.7);
    const g1 = gainNode(ctx, 1), heavy = gainNode(ctx, 0), drops = gainNode(ctx, 0);
    hp.connect(lp); lp.connect(g1); hv.connect(heavy); dr.connect(drops);
    for (const g of [g1, heavy, drops]) g.connect(out);
    return { lp, heavy, drops, start: (t) => [loop(ctx, B.pink, t, hp), loop(ctx, B.white, t, hv), loop(ctx, B.drops, t, dr)] };
  } },
  // Wind: wanderndes Bandpassrauschen mit Böen, bei Sturm ein Pfeifen
  wind: { send: 0.1, k: 0.97, build(ctx, out, B) {
    const bp = filter(ctx, 'bandpass', 520, 1.1), lp = filter(ctx, 'lowpass', 1800, 0.5);
    const gust = gainNode(ctx, 0.6);
    bp.connect(lp); lp.connect(gust); gust.connect(out);
    const wh = filter(ctx, 'bandpass', 950, 16);
    const whistle = gainNode(ctx, 0);
    wh.connect(whistle); whistle.connect(out);
    return { whistle, bp, start: (t) => [
      loop(ctx, B.pink, t, bp), loop(ctx, B.white, t, wh, 0.97),
      lfo(ctx, t, 0.07, 230, bp.frequency), lfo(ctx, t, 0.11, 0.25, gust.gain), lfo(ctx, t, 0.27, 0.15, gust.gain), lfo(ctx, t, 0.05, 160, wh.frequency),
    ] };
  } },
  // Lüftung und Klimaanlagen der Bürohäuser
  hvac: { send: 0.1, k: 1, build(ctx, out, B) {
    const bp = filter(ctx, 'bandpass', 190, 1), lp = filter(ctx, 'lowpass', 400, 4);
    const tg = gainNode(ctx, 0.12);
    bp.connect(out); lp.connect(tg); tg.connect(out);
    return { start: (t) => { const o = osc(ctx, 'sawtooth', 120, t); o.connect(lp); o.start(t); return [o, loop(ctx, B.brown, t, bp, 1.3)]; } };
  } },
  // Brand: Fauchen + Knistern
  fire: { send: 0.15, k: 0.23, build(ctx, out, B) {
    const lp = filter(ctx, 'lowpass', 380, 0.7), hp = filter(ctx, 'highpass', 900, 0.6);
    const cg = gainNode(ctx, 0.9);
    lp.connect(out); hp.connect(cg); cg.connect(out);
    return { start: (t) => [loop(ctx, B.brown, t, lp, 1.2), loop(ctx, B.crackle, t, hp)] };
  } },
  // Menschenmenge (Stadion, Freizeitpark, Freibad)
  crowd: { send: 0.3, k: 0.65, build(ctx, out, B) {
    const b1 = filter(ctx, 'bandpass', 950, 0.9), b2 = filter(ctx, 'bandpass', 2300, 1.2);
    const g = gainNode(ctx, 0.7);
    b1.connect(g); b2.connect(g); g.connect(out);
    return { start: (t) => { const s = loop(ctx, B.pink, t, b1); s.connect(b2); return [s, lfo(ctx, t, 0.19, 0.25, g.gain)]; } };
  } },
  // Brunnen
  fountain: { send: 0.2, k: 0.42, build(ctx, out, B) {
    const bp = filter(ctx, 'bandpass', 2600, 0.5), hp = filter(ctx, 'highpass', 700, 0.6);
    const dg = gainNode(ctx, 0.5);
    bp.connect(hp); hp.connect(out); dg.connect(out);
    return { start: (t) => [loop(ctx, B.white, t, bp), loop(ctx, B.drops, t, dg, 0.8)] };
  } },
  // Einsatzfahrzeug mit Martinshorn (Doppler über die Frequenz)
  siren: { send: 0.25, k: 0.45, build(ctx, out) {
    const bp = filter(ctx, 'bandpass', 1100, 0.7), lp = filter(ctx, 'lowpass', 3200, 0.7);
    bp.connect(lp); lp.connect(out);
    const st = { o: null };
    return { st, start: (t) => { const o = osc(ctx, 'sawtooth', 440, t); o.connect(bp); o.start(t); st.o = o; st.next = t; st.phase = 0; return [o]; } };
  } },
  // Pulsbahn: Elektromotor-Singen + Rollen
  pulsbahn: { send: 0.15, k: 0.29, build(ctx, out, B) {
    const bp = filter(ctx, 'bandpass', 330, 4), lp = filter(ctx, 'lowpass', 320, 0.6);
    const mg = gainNode(ctx, 0.3);
    bp.connect(mg); mg.connect(out); lp.connect(out);
    const st = { o: null };
    return { st, start: (t) => { const o = osc(ctx, 'triangle', 165, t); o.connect(bp); o.start(t); st.o = o; return [o, loop(ctx, B.brown, t, lp, 1.1)]; } };
  } },
  // Flugzeuge (über dem Kopf, Flughafen)
  jet: { send: 0.2, k: 0.38, build(ctx, out, B) {
    const lp = filter(ctx, 'lowpass', 850, 0.6), bp = filter(ctx, 'bandpass', 3800, 3);
    const wg = gainNode(ctx, 0.08);
    lp.connect(out); bp.connect(wg); wg.connect(out);
    return { start: (t) => [loop(ctx, B.pink, t, lp, 0.9), loop(ctx, B.white, t, bp)] };
  } },
  // Hubschrauber: Rotorschlag
  heli: { send: 0.15, k: 0.63, build(ctx, out, B) {
    const lp = filter(ctx, 'lowpass', 420, 0.8);
    const am = gainNode(ctx, 0.35);
    lp.connect(am); am.connect(out);
    return { start: (t) => [loop(ctx, B.brown, t, lp), lfo(ctx, t, 11.5, 0.33, am.gain, 'square')] };
  } },
  // Schneepflug: Kratzen
  plow: { send: 0.1, k: 0.29, build(ctx, out, B) {
    const bp = filter(ctx, 'bandpass', 750, 1.4), lp = filter(ctx, 'lowpass', 200, 0.7);
    bp.connect(out); lp.connect(out);
    return { start: (t) => [loop(ctx, B.pink, t, bp), loop(ctx, B.brown, t, lp)] };
  } },
  // Dönerspieß: Brutzeln
  doener: { send: 0.1, k: 0.42, build(ctx, out, B) {
    const hp = filter(ctx, 'highpass', 2400, 0.6), h2 = filter(ctx, 'highpass', 6000, 0.6);
    const g2 = gainNode(ctx, 0.15);
    hp.connect(out); h2.connect(g2); g2.connect(out);
    return { start: (t) => [loop(ctx, B.crackle, t, hp, 1.4), loop(ctx, B.white, t, h2)] };
  } },
  // Windrad: rhythmisches Rauschen der Rotorblätter
  turbine: { send: 0.15, k: 1.4, build(ctx, out, B) {
    const bp = filter(ctx, 'bandpass', 800, 1);
    const am = gainNode(ctx, 0.45);
    bp.connect(am); am.connect(out);
    return { start: (t) => [loop(ctx, B.pink, t, bp), lfo(ctx, t, 0.85, 0.4, am.gain)] };
  } },
  // ferne Grillenfläche (Wiesen bei Nacht)
  crickets: { send: 0.25, k: 1.6, build(ctx, out, B) {
    const bp = filter(ctx, 'bandpass', 4600, 14);
    const am = gainNode(ctx, 0.5);
    bp.connect(am); am.connect(out);
    return { start: (t) => [loop(ctx, B.white, t, bp), lfo(ctx, t, 29, 0.5, am.gain, 'square')] };
  } },
};

const SEASON_BIRDS = { spring: 1.25, summer: 1, autumn: 0.55, winter: 0.25 };
const CRICKET_SEASON = { spring: 0.35, summer: 1, autumn: 0.55, winter: 0 };

export class Ambience {
  constructor(ctx, mixer, host = {}) {
    this.ctx = ctx;
    this.mixer = mixer;
    this.host = host; // { chord() → MIDI-Noten des aktuellen Akkords }
    this.bufs = buffers(ctx);
    this.dest = { dry: mixer.amb, send: mixer.ambSend };
    this.beds = {};
    for (const [name, def] of Object.entries(BEDS)) this.beds[name] = new Bed(this, name, def);
    this.voices = new Voices(10);
    this.cool = {};
    this.lastTick = 0;
    this.crickets = [];
    this.lastLightning = 0;
    this.lastThunder = -99;
    this.events = 0;
    this.enabled = true;
  }

  // Abklingzeit pro Art: true, wenn die Art wieder dran sein darf (und setzt die nächste Sperre)
  ready(name, now, cool) {
    if ((this.cool[name] || 0) > now) return false;
    this.cool[name] = now + cool;
    return true;
  }

  fire(name, fn, now, end, o, force = false) {
    if (!this.voices.take(now, end, force)) return false;
    this.events++;
    fn(this.ctx, this.dest, now + rand(0.02, 0.12), o);
    return true;
  }

  // Pegel aller Betten nachführen (aufgerufen ~5×/s mit der Szene)
  update(s, now) {
    const b = this.beds;
    if (!this.enabled || !s.valid) { for (const k in b) b[k].set(0, now, 0.6); return; }
    const w = s.weather;
    const zoom = s.zoom, near = 0.25 + 0.75 * zoom, far = 1 - zoom;
    const paused = s.paused;
    const night = s.night;
    const rain = clamp(w.rain), snow = clamp(w.snow), wind = clamp(w.wind);
    const rainMask = 1 - rain * 0.4;
    const winter = w.season === 'winter';
    const dense = clamp(s.res + s.com + s.off + s.ind);

    b.traffic.set((s.traffic * 0.7 + s.cars * 0.45) * near * (paused ? 0.15 : 1) * rainMask * (1 - w.snowCover * 0.3), now, 0.8, s.pan.traffic * 0.7);
    b.traffic.p.hg.gain.setTargetAtTime(0.25 + rain * 0.9 + w.snowCover * 0.2, now, 1);
    b.traffic.p.lp.frequency.setTargetAtTime(280 + 320 * clamp(s.traffic + s.cars * 0.5), now, 1);
    b.highway.set(s.highway * near * (paused ? 0.2 : 1) * (0.45 + s.trafficCity * 0.55), now, 1, s.pan.highway * 0.8);
    b.cityHum.set(s.cityScale * (0.1 + 0.5 * far * far) * (paused ? 0.4 : 1) * (1 - night * 0.45), now, 1.5);
    const people = (s.com * 0.85 + s.res * 0.3 + s.off * 0.35 + s.poi.pool.p * (w.season === 'summer' ? 0.8 : 0)) * (1 - night * 0.7) * (s.weekend ? 1.15 : 1);
    b.murmur.set(people * near * Math.sqrt(zoom) * (1 - rain * 0.6) * (paused ? 0.5 : 1), now, 1.2, (s.pan.com + s.pan.res) * 0.4);
    const work = s.hour >= 6.5 && s.hour <= 19 && s.weekday !== 6 ? 1 : 0;
    b.construction.set(s.construction * near * work * (paused ? 0 : 1), now, 1, s.pan.construction);
    b.hvac.set(s.off * near * 0.6 * (paused ? 0.7 : 1), now, 1.5, s.pan.off * 0.6);
    b.industry.set((s.ind * 0.8 + s.poi.heavy.p * 0.55 + s.poi.cargo.p * 0.2) * (0.3 + 0.7 * near) * (paused ? 0.5 : 1) * (1 - night * 0.25), now, 1.2, s.pan.ind * 0.8);
    b.leaves.set((s.trees * 0.9 + s.park * 0.4) * (0.25 + wind * 1.1) * near * (winter ? 0.35 : 1), now, 1.5, s.pan.trees * 0.6);
    b.leaves.p.bp.frequency.setTargetAtTime(winter ? 3600 : 2600, now, 3);
    b.water.set(s.water * (0.45 + wind * 0.7) * near, now, 1.2, s.pan.water * 0.8);
    b.water.p.lp.frequency.setTargetAtTime(420 + wind * 400, now, 2);
    const rainV = rain * (0.65 + 0.35 * near);
    b.rain.set(rainV, now, 1.5);
    b.rain.p.lp.frequency.setTargetAtTime(3200 + rain * 5000, now, 2);
    b.rain.p.heavy.gain.setTargetAtTime(rain * rain * 0.8, now, 1.5);
    b.rain.p.drops.gain.setTargetAtTime(rain > 0.05 ? (0.3 + zoom) * 0.9 : 0, now, 1.5);
    const windV = 0.05 + wind * 0.75 + far * far * 0.12 + s.edge * 0.12 + (w.storm ? 0.3 : 0) + snow * 0.1;
    b.wind.set(windV, now, 2, Math.sin((w.windDir || 0) - s.yaw) * 0.35);
    b.wind.p.whistle.gain.setTargetAtTime(clamp((wind - 0.5) * 1.6 + (w.storm ? 0.4 : 0) + far * far * 0.08, 0, 0.9) * 0.6, now, 2);
    b.fire.set(s.fire * near * 1.4 + (s.burning > 0 ? 0.03 * far : 0), now, 0.8, s.pan.fire);
    const crowdTime = (s.weekend && s.hour > 13 && s.hour < 22) || (s.hour > 18 && s.hour < 22) ? 1 : 0.35;
    b.crowd.set(s.poi.crowd.p * crowdTime * (1 - night * 0.5) * (1 - rain * 0.5) * (paused ? 0.6 : 1), now, 1.5, s.poi.crowd.pan);
    b.fountain.set(s.poi.fountain.p * zoom * near * (winter ? 0 : 1), now, 1, s.poi.fountain.pan);
    const sv = s.veh.siren;
    b.siren.set(sv.p * near * (paused ? 0 : 1), now, 0.4, sv.pan);
    const pb = s.veh.pulsbahn;
    b.pulsbahn.set(pb.p * near * 0.9 * (paused ? 0 : 1), now, 0.5, pb.pan);
    if (b.pulsbahn.p.st.o) b.pulsbahn.p.st.o.frequency.setTargetAtTime(150 + pb.p * 60 - pb.vr * 3, now, 0.5);
    b.jet.set((s.veh.plane.p * 0.9 + s.poi.airport.p * 0.22 * (1 - night * 0.6)) * (paused ? 0.3 : 1), now, 1, s.veh.plane.p > 0.05 ? s.veh.plane.pan : s.poi.airport.pan);
    b.heli.set(s.veh.heli.p * (paused ? 0.3 : 1), now, 0.6, s.veh.heli.pan);
    b.plow.set(s.veh.plow.p * near * (paused ? 0 : 1), now, 0.6, s.veh.plow.pan);
    b.doener.set(s.poi.doener.p * zoom * zoom, now, 1, s.poi.doener.pan);
    b.turbine.set(s.poi.turbine.p * zoom * (0.4 + wind), now, 1, s.poi.turbine.pan);
    b.crickets.set(this.cricketLevel(s) * 0.6 * (1 - dense * 0.5), now, 2);

    // Schnee schluckt die Höhen, Nebel ein wenig
    this.mixer.setMuffle(18000 * (1 - w.snowCover * 0.6) * (1 - clamp(w.fog) * 0.3) * (1 - snow * 0.2), now);
  }

  cricketLevel(s) {
    const w = s.weather;
    if (s.night < 0.4) return 0;
    const season = CRICKET_SEASON[w.season] == null ? 1 : CRICKET_SEASON[w.season];
    const warm = clamp((w.temp - 9) / 8);
    return clamp((s.night - 0.4) / 0.4) * season * warm * (1 - clamp(w.rain) * 0.9) * (s.trees * 0.7 + s.park * 0.7 + 0.3 * (1 - clamp(s.res + s.com + s.ind + s.off))) * (0.35 + 0.65 * s.zoom);
  }

  birdLevel(s) {
    const w = s.weather;
    const h = s.hour;
    const day = h > 4.5 && h < 21.5 ? 1 : 0;
    const curve = (0.55 + s.dawn * 1.4 + s.dusk * 0.7) * day * (1 - s.night * 0.85);
    const habitat = s.trees * 1.1 + s.park * 1.3 + s.res * 0.35 + s.com * 0.12 + 0.04;
    return curve * habitat * (SEASON_BIRDS[w.season] || 1) * (1 - clamp(w.rain) * 0.85) * (1 - clamp(w.snow) * 0.6) * (1 - clamp(w.wind - 0.6) * 1.5) * (0.2 + 0.8 * s.zoom);
  }

  // Ereignisse planen (aufgerufen jedes Bild; arbeitet mit ~10 Hz)
  tick(s, now) {
    if (!this.enabled || !s.valid) return;
    let dt = now - this.lastTick;
    if (dt < 0.1) return;
    this.lastTick = now;
    if (dt > 5) return; // nach langen Aussetzern nichts nachholen
    dt = Math.min(dt, 0.5);
    const P = (rate) => Math.random() < 1 - Math.exp(-Math.max(0, rate) * dt);
    const w = s.weather, zoom = s.zoom, near = 0.25 + 0.75 * zoom;
    const day = s.night < 0.5;
    const paused = s.paused;
    const panAround = (p) => clamp(p + rand(-0.5, 0.5), -1, 1);
    const ev = (name, fn, o, est, force) => this.fire(name, fn, now, now + est, o, force);

    // Martinshorn: a1–d2 im Wechsel; nähert sich das Fahrzeug, klingt es höher (Doppler)
    const sb = this.beds.siren, st = sb.p.st;
    if (sb.awake && st.o) {
      const dop = clamp(1 - s.veh.siren.vr * 0.012, 0.92, 1.08);
      if (st.next < now) st.next = now + 0.02;
      while (st.next < now + 0.8) { st.o.frequency.setValueAtTime((st.phase ? 587 : 440) * dop, st.next); st.phase ^= 1; st.next += 0.65; }
    }

    // --- Vögel
    const bl = this.birdLevel(s);
    if (P(bl * 1.4)) {
      const d = rand(0.15, 1);
      const o = { gain: 0.14 * (1.1 - d * 0.7), pan: rand(-0.9, 0.9), send: 0.15 + d * 0.4 };
      const city = s.res + s.com * 1.5 + s.off;
      const green = s.trees + s.park;
      let fn;
      const r = Math.random();
      if ((s.dawn > 0.4 || s.dusk > 0.4) && r < 0.45) fn = S.blackbird;
      else if (w.season === 'winter' || w.season === 'autumn') fn = r < 0.35 ? S.crow : r < 0.7 ? S.greatTit : S.birdTweet;
      else if (city > green * 1.5) fn = r < 0.4 ? S.sparrow : r < 0.6 ? S.pigeon : r < 0.8 ? S.birdTweet : S.greatTit;
      else fn = pick([S.birdTweet, S.birdTrill, S.birdWarble, S.greatTit, S.blackbird, S.birdTweet]);
      if (fn === S.crow) o.gain *= 2;
      if (fn === S.pigeon) o.gain *= 1.3;
      ev('bird', fn, o, 2);
    }
    if (day && w.season === 'spring' && s.trees > 0.2 && P(0.012) && this.ready('cuckoo', now, 40)) ev('cuckoo', S.cuckoo, { gain: 0.06, pan: rand(-0.8, 0.8), send: 0.5 }, 4);
    if (day && w.season !== 'winter' && s.trees > 0.25 && P(0.012 * zoom) && this.ready('wood', now, 25)) ev('wood', S.woodpecker, { gain: 0.2, pan: rand(-0.8, 0.8), send: 0.35 }, 2);

    // --- Wohngebiet im Sommer: Rasenmäher (am Wochenende öfter)
    if (day && s.res > 0.3 && s.hour > 9 && s.hour < 18.5 && w.rain < 0.1 && (w.season === 'summer' || w.season === 'spring') && !paused &&
      P(0.012 * s.res * (s.weekend ? 2.5 : 1)) && this.ready('mower', now, 40)) ev('mower', S.lawnmower, { gain: 0.035 * near, pan: rand(-0.8, 0.8), send: 0.4 }, 9);

    // --- Bauernhof: Hahn im Morgengrauen, Kühe am Tag
    const farm = s.poi.farm.p;
    if (farm > 0.05) {
      if ((s.dawn > 0.5 ? P(0.06 * farm) : day && P(0.003 * farm)) && this.ready('rooster', now, 20)) ev('rooster', S.rooster, { gain: 0.07 * (0.4 + farm), pan: s.poi.farm.pan, send: 0.45 }, 1.5);
      if (day && P(0.03 * farm) && this.ready('cow', now, 9)) ev('cow', S.cow, { gain: 0.09 * (0.3 + farm) * near, pan: clamp(s.poi.farm.pan + rand(-0.3, 0.3), -1, 1), send: 0.35 }, 1.8);
    }

    // --- Pulsbahn: Schienenstöße, wenn ein Zug nah vorbeifährt
    const pbv = s.veh.pulsbahn;
    if (!paused && pbv.p > 0.25 && P(1.8 * pbv.p)) ev('rail', S.railClack, { gain: 0.08 * pbv.p * near, pan: pbv.pan, send: 0.25 }, 0.25);

    // --- Nacht: Grillen, Frösche, Kauz
    const cl = this.cricketLevel(s);
    this.tickCrickets(cl, now, s);
    if (cl > 0.05 && s.water > 0.06 && (w.season === 'spring' || w.season === 'summer') && P(0.12 * s.water * near)) ev('frog', S.frog, { gain: 0.18, pan: panAround(s.pan.water), send: 0.3 }, 2.5);
    if (s.night > 0.6 && s.trees > 0.15 && P(0.015) && this.ready('owl', now, 22)) ev('owl', S.owl, { gain: 0.07, pan: rand(-0.9, 0.9), send: 0.55 }, 3.5);

    // --- Straße
    if (!paused && zoom > 0.35) {
      const rate = Math.min(1.1, (s.traffic * 0.45 + s.cars * 0.9) * zoom * 0.9);
      if (P(rate) && this.voices.count(now) < 8) {
        const heavy = Math.random() < 0.1 + s.ind * 0.4;
        ev('car', S.carPass, { gain: 0.13 * zoom * (heavy ? 1.1 : 1) * (1 - w.snowCover * 0.3), heavy, send: 0.1 }, 3.5);
      }
      if (day && s.traffic > 0.25 && P(0.03 * s.traffic * (0.4 + s.cityScale)) && this.ready('horn', now, 6)) ev('horn', S.horn, { gain: 0.07 * zoom, pan: panAround(s.pan.traffic), send: 0.25 }, 0.6);
      if (day && w.rain < 0.2 && !w.snowCover && s.res + s.com + s.park > 0.25 && P(0.025 * zoom) && this.ready('bike', now, 12)) ev('bike', S.bikeBell, { gain: 0.05 * zoom, pan: rand(-0.7, 0.7), send: 0.2 }, 0.6);
    }

    // --- Baustelle
    const work = s.hour >= 6.5 && s.hour <= 19 && s.weekday !== 6 && !paused;
    if (work && s.construction > 0.02) {
      const c = s.construction * near;
      const pan = panAround(s.pan.construction);
      if (P(c * 0.9)) ev('hammer', S.hammer, { gain: 0.15 * near, pan, send: 0.25 }, 2.5);
      if (P(c * 0.22)) ev('drill', S.drill, { gain: 0.1 * near, pan, send: 0.2 }, 2);
      if (P(c * 0.06) && this.ready('beep', now, 10)) ev('beep', S.beeper, { gain: 0.08 * near, pan, send: 0.3 }, 4);
      if (P(c * 0.2)) ev('clank', S.clank, { gain: 0.065 * near, pan, send: 0.3 }, 0.6);
    }

    // --- Industrie
    const ind = s.ind + s.poi.heavy.p * 0.6;
    if (!paused && ind > 0.08) {
      const pan = panAround(s.pan.ind);
      if (P(ind * 0.1) && this.ready('press', now, 5)) ev('press', S.press, { gain: 0.14 * near, pan, send: 0.3 }, 8);
      if (P(ind * 0.07)) ev('steam', S.steam, { gain: 0.1 * near, pan, send: 0.3 }, 2);
      if (P(ind * 0.09)) ev('iclank', S.clank, { gain: 0.04 * near, pan, send: 0.35, f: rand(200, 330) }, 0.6);
    }
    if (work && s.poi.saw.p > 0.05 && P(s.poi.saw.p * 0.12) && this.ready('saw', now, 5)) ev('saw', S.saw, { gain: 0.12 * s.poi.saw.p * near, pan: s.poi.saw.pan, send: 0.3 }, 3);

    // --- Wasser, Hafen, Leuchtturm
    if (s.water > 0.05) {
      if (P(s.water * 0.45 * near)) ev('lap', S.lap, { gain: 0.07 * near, pan: panAround(s.pan.water), send: 0.25 }, 1.3);
      if (P(s.water * 0.05 * zoom)) ev('splash', S.splash, { gain: 0.12 * zoom, pan: panAround(s.pan.water), send: 0.3 }, 0.7);
    }
    const harbor = Math.max(s.poi.harbor.p, s.water > 0.3 ? s.water * 0.5 : 0);
    if (day && harbor > 0.15 && P(harbor * 0.07)) ev('gull', S.gull, { gain: 0.1, pan: rand(-0.9, 0.9), send: 0.45 }, 2);
    if ((s.veh.ship.p > 0.2 || s.poi.harbor.p > 0.25) && P(0.012) && this.ready('ship', now, 30)) ev('ship', S.shipHorn, { gain: 0.09 * Math.max(s.veh.ship.p, s.poi.harbor.p), pan: s.veh.ship.p > 0.2 ? s.veh.ship.pan : s.poi.harbor.pan, send: 0.6 }, 4);
    if (s.poi.lighthouse.p > 0.03 && w.fog > 0.3 && this.ready('fog', now, rand(14, 20))) ev('fog', S.foghorn, { gain: 0.12 * Math.max(0.3, s.poi.lighthouse.p), pan: s.poi.lighthouse.pan, send: 0.7 }, 3.2, true);

    // --- Bahn, Flughafen, Menge, Spieluhr
    if (s.poi.railway.p > 0.08) {
      if (P(s.poi.railway.p * 0.02) && this.ready('thorn', now, 20)) ev('thorn', S.trainHorn, { gain: 0.09 * s.poi.railway.p, pan: s.poi.railway.pan, send: 0.5 }, 1.6);
      if (P(s.poi.railway.p * 0.012) && this.ready('chime', now, 30)) {
        const ch = this.host.chord ? this.host.chord() : [74, 71, 67];
        ev('chime', S.stationChime, { gain: 0.12 * s.poi.railway.p, pan: s.poi.railway.pan, send: 0.6, fs: [mtof(ch[2] + 12), mtof(ch[1] + 12), mtof(ch[0] + 12)] }, 3);
      }
    }
    if (s.veh.train.p > 0.3 && this.ready('trainNear', now, 25)) ev('thorn2', S.trainHorn, { gain: 0.07 * s.veh.train.p, pan: s.veh.train.pan, send: 0.4 }, 1.6);
    if (s.poi.airport.p > 0.1 && P(s.poi.airport.p * 0.02) && this.ready('jet', now, 25)) ev('jet', S.jetFlyby, { gain: 0.12 * s.poi.airport.p, send: 0.3 }, 7);
    if (s.poi.crowd.p > 0.1 && P(s.poi.crowd.p * 0.03) && this.ready('cheer', now, 15)) ev('cheer', S.cheer, { gain: 0.1 * s.poi.crowd.p, pan: s.poi.crowd.pan, send: 0.4 }, 4);
    if (s.poi.musicbox.p > 0.15 && !paused && s.night < 0.8 && P(1.6) && this.host.chord) {
      const ch = this.host.chord();
      const m = ch[Math.floor(Math.random() * ch.length)] + 24 + (Math.random() < 0.3 ? 12 : 0);
      ev('mbox', (c, d, t, o) => S.musicBoxNote(c, d, t, mtof(m), o), { gain: 0.05 * s.poi.musicbox.p, pan: s.poi.musicbox.pan, send: 0.3 }, 1);
    }

    // --- Gewitter: Blitz (Wetterzustand) → Donner mit Laufzeit; Rückfall ohne Blitzangabe bei Sturm
    const li = clamp(w.lightning || 0);
    if (li > 0.4 && this.lastLightning <= 0.2) {
      const close = li > 0.8 ? rand(0.65, 1) : rand(0, 0.6);
      const delay = close > 0.6 ? rand(0.1, 0.6) : rand(1.2, 4);
      this.thunder(now + delay, close);
    }
    this.lastLightning = li;
    if (w.storm && w.rain > 0.5 && now - this.lastThunder > 18 && P(0.03)) this.thunder(now + rand(0, 1), rand(0, 0.5));
  }

  thunder(t, close) {
    this.lastThunder = t;
    if (!this.voices.take(t, t + 9, true)) return;
    S.thunder(this.ctx, this.dest, t, { close, gain: 0.22 + close * 0.2, send: 0.35 + (1 - close) * 0.4 });
    if (close > 0.7) this.mixer.duck(t, 0.75, 1, 0.8);
  }

  // Bis zu drei Grillenstimmen mit eigenem Takt (Zirpfrequenz nach Temperatur, Dolbear-Gesetz)
  tickCrickets(level, now, s) {
    const want = level > 0.04 ? Math.min(3, 1 + Math.floor(level * 4)) : 0;
    const ctx = this.ctx;
    while (this.crickets.length < want) {
      const g = gainNode(ctx, 0), p = panner(ctx, rand(-0.9, 0.9)), out = gainNode(ctx, 0);
      g.connect(out); out.connect(p); p.connect(this.dest.dry);
      const send = gainNode(ctx, 0.3); p.connect(send); send.connect(this.dest.send);
      this.crickets.push({ g, p, out, f: rand(4200, 4900), o: null, next: now + rand(0, 1), bout: now + rand(4, 12), resting: false, rate: rand(0.9, 1.1), quiet: 0 });
    }
    const temp = s.weather.temp;
    const perSec = clamp((7 * temp - 30) / 60, 0.6, 3);
    for (let k = 0; k < this.crickets.length; k++) {
      const c = this.crickets[k];
      const active = k < want;
      if (active && !c.o) { c.o = osc(ctx, 'sine', c.f, now); c.o.connect(c.g); c.o.start(now); c.next = Math.max(c.next, now + 0.05); }
      c.out.gain.setTargetAtTime(active ? level * 0.06 * (1 - k * 0.2) : 0, now, 0.8);
      if (!active) {
        if (c.o) { c.quiet += 0.1; if (c.quiet > 4) { c.o.stop(now + 0.1); c.o = null; c.quiet = 0; } }
        continue;
      }
      c.quiet = 0;
      while (c.next < now + 0.6) {
        if (c.next >= c.bout) { c.resting = !c.resting; c.bout = c.next + (c.resting ? rand(1.5, 6) : rand(5, 15)); }
        if (!c.resting && c.next > now) S.cricketChirp(c.g.gain, c.next, 1);
        c.next += 1 / (perSec * c.rate);
      }
    }
  }

  // Einmalige Ereignisse von außen (Stundenglocken, Schulklingel …)
  bells(now, count, gainV, pan, f = 220) {
    if (!this.ready('bells', now, 40)) return;
    for (let k = 0; k < count; k++) {
      const t = now + 0.1 + k * 2.3;
      if (!this.voices.take(now, t + 4.6, true)) break;
      S.churchBell(this.ctx, this.dest, t, { f, gain: gainV, pan, send: 0.7 });
    }
  }

  peal(now, gainV, pan, root = 57) {
    if (!this.ready('bells', now, 60)) return;
    const fs = [mtof(root), mtof(root - 3), mtof(root - 5), mtof(root - 7)];
    for (let k = 0; k < 10; k++) S.churchBell(this.ctx, this.dest, now + 0.1 + k * 0.85 + rand(-0.05, 0.05), { f: fs[k % fs.length], gain: gainV * 0.8, pan: clamp(pan + rand(-0.3, 0.3), -1, 1), send: 0.7 });
  }

  schoolBell(now, gainV, pan) {
    if (!this.ready('school', now, 25)) return;
    S.schoolBell(this.ctx, this.dest, now + 0.05, { gain: gainV, pan, send: 0.4 });
  }

  stats() {
    let awake = 0;
    for (const k in this.beds) if (this.beds[k].awake) awake++;
    return { bedsAwake: awake, beds: Object.keys(this.beds).length, events: this.events, voices: this.voices.count(this.ctx.currentTime), crickets: this.crickets.filter((c) => c.o).length };
  }

  // Alles schlafen legen (z. B. stumm geschaltet)
  sleepAll(now) {
    for (const k in this.beds) { const b = this.beds[k]; b.set(0, now, 0.3); if (b.awake) b.sleep(now + 1); }
    for (const c of this.crickets) { c.out.gain.setTargetAtTime(0, now, 0.2); if (c.o) { c.o.stop(now + 1); c.o = null; } }
  }
}
