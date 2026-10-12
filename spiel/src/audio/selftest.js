// Selbstprüfung der Klangwelt mit OfflineAudioContext: rendert Effekte, Musikstimmungen und
// Umgebungsszenen und misst Spitze, RMS, Kurzzeit-Maximum (400 ms), Übersteuerung, Gleichanteil,
// spektralen Schwerpunkt und Bandpegel. Läuft im Browser (z. B. per tools/shot.mjs --eval):
//   const r = await window.__stadtpuls.audio.selfTest({ parts: ['sfx', 'music', 'amb', 'beds', 'mix'] })
// Pegel werden vor dem Limiter gemessen (limiter: false), die Gesamtmischung mit Limiter.
import { Mixer } from './mixer.js';
import { Music } from './music.js';
import { Ambience } from './ambience.js';
import { Sfx, SFX_NAMES } from './sfx.js';
import { emptyScene } from './scene.js';
import { gainToDb } from './core.js';
import * as S from './synths.js';

const SR = 44100;
const VOL = { volume: 1, music: 1, sfx: 1, muted: false };

// ---------- Messung
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

const BANDS = [['sub', 20, 60], ['bass', 60, 250], ['lowmid', 250, 1000], ['mid', 1000, 4000], ['high', 4000, 10000], ['air', 10000, 20000]];

export function analyze(buf, from = 0) {
  const sr = buf.sampleRate;
  const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  const n0 = Math.floor(from * sr);
  let peak = 0, sum = 0, clips = 0, dc = 0, n = 0;
  const win = Math.floor(sr * 0.4);
  let st = 0, stMax = 0, ws = 0, wc = 0, silent = 0, wins = 0;
  for (let i = n0; i < L.length; i++) {
    const a = L[i], b = R[i];
    const m = Math.max(Math.abs(a), Math.abs(b));
    if (m > peak) peak = m;
    if (m >= 0.999) clips++;
    const e = (a * a + b * b) * 0.5;
    sum += e; dc += (a + b) * 0.5; n++;
    ws += e; wc++;
    if (wc === win) { st = ws / wc; if (st > stMax) stMax = st; if (st < 1e-8) silent++; wins++; ws = 0; wc = 0; }
  }
  // Spektrum: gemittelt über Fenster zu 4096 Proben
  const N = 4096;
  const pow = new Float64Array(N / 2);
  let frames = 0;
  const hop = Math.max(N, Math.floor((L.length - n0) / 24));
  for (let s0 = n0; s0 + N <= L.length; s0 += hop) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) { const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)); re[i] = (L[s0 + i] + R[s0 + i]) * 0.5 * w; }
    fft(re, im);
    for (let k = 0; k < N / 2; k++) pow[k] += re[k] * re[k] + im[k] * im[k];
    frames++;
  }
  let tot = 0, cen = 0;
  const bands = {};
  for (const [name] of BANDS) bands[name] = 0;
  for (let k = 1; k < N / 2; k++) {
    const f = (k * sr) / N;
    tot += pow[k]; cen += pow[k] * f;
    for (const [name, a, b] of BANDS) if (f >= a && f < b) bands[name] += pow[k];
  }
  const bandsDb = {};
  for (const [name] of BANDS) bandsDb[name] = tot > 0 ? +(10 * Math.log10(bands[name] / tot + 1e-12)).toFixed(1) : -120;
  return {
    peakDb: +gainToDb(peak).toFixed(1),
    rmsDb: +(10 * Math.log10(sum / Math.max(1, n) + 1e-20)).toFixed(1),
    stMaxDb: +(10 * Math.log10(stMax + 1e-20)).toFixed(1),
    clips,
    dc: +(dc / Math.max(1, n)).toFixed(5),
    centroid: tot > 0 ? Math.round(cen / tot) : 0,
    silentShare: wins ? +(silent / wins).toFixed(2) : 1,
    bands: bandsDb,
    frames,
  };
}

function offline(seconds) {
  const C = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  return new C(2, Math.ceil(SR * seconds), SR);
}

async function render(seconds, setup, limiter = false) {
  const ctx = offline(seconds);
  const mixer = new Mixer(ctx, { limiter, quality: 'medium' });
  mixer.setVolumes(VOL, 0);
  // Regler sofort setzen (setTargetAtTime würde sonst die ersten Millisekunden dämpfen)
  for (const g of [mixer.master, mixer.musicVol, mixer.musicSendVol, mixer.sfxVol, mixer.sfxSendVol, mixer.ambVol, mixer.ambSendVol]) { g.gain.cancelScheduledValues(0); g.gain.setValueAtTime(1, 0); }
  const info = setup(ctx, mixer) || {};
  const t0 = performance.now();
  const buf = await ctx.startRendering();
  return { buf, ms: Math.round(performance.now() - t0), info };
}

// ---------- Szenen für die Umgebung
function scene(over) {
  const s = emptyScene();
  s.valid = true;
  s.hour = 12; s.night = 0; s.zoom = 0.7; s.dist = 14; s.radius = 8;
  const { weather, poi, veh, ...rest } = over;
  Object.assign(s, rest);
  if (weather) Object.assign(s.weather, weather);
  if (poi) for (const k in poi) Object.assign(s.poi[k], typeof poi[k] === 'number' ? { p: poi[k], d: 5 } : poi[k]);
  if (veh) for (const k in veh) Object.assign(s.veh[k], typeof veh[k] === 'number' ? { p: veh[k], d: 5 } : veh[k]);
  s.dawn = Math.exp(-0.5 * ((s.hour - 6.3) / 1.2) ** 2);
  s.dusk = Math.exp(-0.5 * ((s.hour - 19.5) / 1.3) ** 2);
  return s;
}

export const AMB_SCENES = {
  strasse_tag: { zoom: 0.85, traffic: 0.6, cars: 0.7, com: 0.55, res: 0.3, trees: 0.1, hour: 11, cityScale: 0.5, trafficCity: 0.5 },
  wohnen_morgen: { zoom: 0.8, res: 0.7, trees: 0.35, park: 0.2, traffic: 0.15, cars: 0.1, hour: 6.4 },
  industrie: { zoom: 0.75, ind: 0.85, traffic: 0.3, cars: 0.3, poi: { heavy: 0.5, saw: 0.3 }, hour: 10 },
  baustelle: { zoom: 0.85, construction: 0.6, res: 0.3, traffic: 0.2, hour: 9 },
  wald: { zoom: 0.8, trees: 0.95, hour: 15, weather: { wind: 0.3, season: 'spring' } },
  ufer: { zoom: 0.8, water: 0.7, trees: 0.2, poi: { harbor: 0.4 }, veh: { ship: 0.3 }, hour: 14, weather: { wind: 0.35 } },
  regen_sturm: { zoom: 0.6, traffic: 0.4, cars: 0.3, res: 0.4, weather: { rain: 0.9, wind: 0.85, storm: true, cloud: 1 }, hour: 16, lightningAt: [2, 9] },
  winternacht: { zoom: 0.6, res: 0.5, traffic: 0.2, night: 1, hour: 23, weather: { season: 'winter', temp: -4, snow: 0.5, snowCover: 0.8, wind: 0.2 } },
  sommernacht: { zoom: 0.7, trees: 0.5, park: 0.3, res: 0.2, water: 0.15, night: 1, hour: 23, weather: { temp: 22 } },
  uebersicht: { zoom: 0.08, dist: 90, cityScale: 0.75, traffic: 0.3, cars: 0.2, res: 0.3, com: 0.2, ind: 0.1, trees: 0.2, water: 0.1, edge: 0.1, hour: 13 },
  einsatz: { zoom: 0.8, traffic: 0.4, cars: 0.4, res: 0.4, veh: { siren: { p: 0.8, pan: -0.3, vr: -3, d: 3 } }, burning: 1, fire: 0.3, hour: 15 },
  sonder: { zoom: 0.8, com: 0.3, poi: { fountain: 0.7, crowd: 0.5, musicbox: 0.5, doener: 0.6 }, veh: { pulsbahn: 0.6 }, hour: 19, weekend: true },
};

function ambSetup(def, seconds) {
  return (ctx, mixer) => {
    const chord = () => [50, 54, 57, 61];
    const amb = new Ambience(ctx, mixer, { chord });
    const s = scene(def);
    const light = def.lightningAt || [];
    let k = 0;
    for (let t = 0.05; t < seconds - 1.5; t += 0.1, k++) {
      s.weather.lightning = light.some((x) => t >= x && t < x + 0.15) ? 1 : 0;
      if (k % 2 === 0) amb.update(s, t);
      amb.lastTick = t - 0.1000001; // gleichmäßige Abstände erzwingen
      amb.tick(s, t);
    }
    return { events: amb.events };
  };
}

function musicSetup(state, seconds) {
  return (ctx, mixer) => {
    const m = new Music(ctx, mixer, { seed: 1234 });
    for (const k of state.mute || []) m.mute.add(k);
    m.setState(state);
    m.wake(0);
    let k = 0;
    for (let t = 0.05; t < seconds - 2; t += 0.05) {
      if (state.trains && t > k * 1.1 + 1) { k++; m.arrival({ line: k % 3, station: k * 7, n: (k * 3) % 9 }); }
      m.tick(t);
    }
    return { notes: m.notes, history: m.history.slice(-6) };
  };
}

function sfxSetup(name, opts = {}) {
  return (ctx, mixer) => {
    const sfx = new Sfx(ctx, mixer, { chord: () => [50, 54, 57, 61] });
    sfx.play(name, opts, 0.02);
  };
}

// [Name in synths.js, übliche Lautstärke, Länge s, Zusatz]
const AMB_EVENTS = [
  ['birdTweet', 0.1, 1.2], ['birdTrill', 0.1, 1.4], ['birdWarble', 0.1, 1.2], ['blackbird', 0.1, 2.5], ['sparrow', 0.1, 1.2], ['greatTit', 0.1, 1.5],
  ['pigeon', 0.18, 1.8], ['crow', 0.28, 2.5], ['cuckoo', 0.06, 4], ['woodpecker', 0.2, 2], ['owl', 0.07, 3.6], ['frog', 0.18, 2.5], ['gull', 0.1, 2],
  ['carPass', 0.13, 3.5], ['horn', 0.07, 0.8], ['bikeBell', 0.05, 0.8], ['hammer', 0.15, 3.2], ['drill', 0.1, 2], ['beeper', 0.08, 4.5], ['clank', 0.065, 0.8],
  ['press', 0.14, 9], ['steam', 0.1, 2.2], ['saw', 0.12, 3], ['lap', 0.07, 1.4], ['splash', 0.12, 0.8], ['shipHorn', 0.09, 4], ['foghorn', 0.12, 3.4],
  ['trainHorn', 0.09, 1.8], ['stationChime', 0.12, 3], ['jetFlyby', 0.12, 7.5], ['cheer', 0.1, 4.5], ['churchBell', 0.15, 5], ['schoolBell', 0.18, 2.5],
  ['rooster', 0.12, 1.6], ['cow', 0.12, 2], ['railClack', 0.08, 0.4], ['lawnmower', 0.035, 9],
  ['thunder', 0.4, 10, { close: 0.85 }], ['thunder', 0.26, 10, { close: 0.2 }],
];

const SFX_LEN = { milestone: 5, disaster: 5, siren: 10, quake: 9, meteor: 6, tornado: 9, flood: 8, thunder: 9, storm: 9, plane: 8, helicopter: 4, ship: 4, churchbell: 10, bankrupt: 3, busStop: 3, fire: 2.5, extinguish: 2.5, season: 2.5, achievement: 3, train: 3.5, explosion: 4.5 };

export async function selfTest(opts = {}) {
  const parts = opts.parts || ['sfx', 'music', 'amb', 'mix'];
  const out = { sampleRate: SR, sfx: {}, music: {}, stems: {}, amb: {}, events: {}, beds: {}, mix: null, ms: 0 };
  const T0 = performance.now();
  if (parts.includes('sfx')) {
    const names = opts.sfx || SFX_NAMES.filter((n) => !['fanfare', 'cash', 'coins', 'ui'].includes(n));
    for (const name of names) {
      const len = SFX_LEN[name] || 1.6;
      const r = await render(len, sfxSetup(name));
      out.sfx[name] = analyze(r.buf);
    }
  }
  if (parts.includes('music')) {
    const sec = opts.musicSeconds || 40;
    const moods = opts.moods || {
      tag_sommer: { night: 0, crisis: 0, season: 'summer', trains: true },
      tag_fruehling: { night: 0, crisis: 0, season: 'spring', trains: true },
      tag_herbst: { night: 0, crisis: 0, season: 'autumn', trains: true },
      tag_winter: { night: 0, crisis: 0, season: 'winter', trains: true },
      nacht: { night: 1, crisis: 0, season: 'summer', trains: true },
      krise: { night: 0, crisis: 0.9, season: 'summer', trains: true },
      menue: { menu: true },
    };
    for (const [k, st] of Object.entries(moods)) {
      const r = await render(sec, musicSetup(st, sec));
      out.music[k] = { ...analyze(r.buf, 1), ...r.info, renderMs: r.ms };
    }
  }
  if (parts.includes('stems')) {
    // Instrumente einzeln (Tag, Sommer): alles außer einem stumm
    const all = ['pad', 'str', 'bass', 'arp', 'mel', 'perc', 'pulse'];
    const base = opts.stemState || { night: 0, crisis: 0, season: 'summer', trains: true, start: 'B' };
    for (const k of all.concat(['alle'])) {
      const r = await render(24, musicSetup({ ...base, mute: all.filter((x) => x !== k && k !== 'alle') }, 24));
      out.stems[k] = analyze(r.buf, 1);
    }
  }
  if (parts.includes('amb')) {
    const sec = opts.ambSeconds || 14;
    const list = opts.scenes || Object.keys(AMB_SCENES);
    for (const k of list) {
      const r = await render(sec, ambSetup(AMB_SCENES[k], sec));
      out.amb[k] = { ...analyze(r.buf, 2), ...r.info, renderMs: r.ms };
    }
  }
  if (parts.includes('events')) {
    // Einzelereignisse der Umgebung mit ihren üblichen Pegeln aus ambience.js
    for (const [name, gain, len, extra] of AMB_EVENTS) {
      const r = await render(len, (ctx, mixer) => { S[name](ctx, { dry: mixer.amb, send: mixer.ambSend }, 0.05, { gain, send: 0.3, ...(extra || {}) }); });
      out.events[name + (extra && extra.close != null ? '_' + extra.close : '')] = analyze(r.buf);
    }
  }
  if (parts.includes('beds')) {
    // jedes Bett einzeln bei Pegel 1 (zur Kalibrierung)
    const ctx0 = offline(0.1);
    const names = Object.keys(new Ambience(ctx0, new Mixer(ctx0, { limiter: false }), {}).beds);
    for (const name of names) {
      const r = await render(4, (ctx, mixer) => {
        const amb = new Ambience(ctx, mixer, {});
        amb.beds[name].set(1, 0, 0.05);
        amb.beds[name].level.gain.setValueAtTime(amb.beds[name].k, 0);
        if (amb.beds[name].p.st) { /* Sirene: zwei Töne */ }
      });
      out.beds[name] = analyze(r.buf, 1);
    }
  }
  if (parts.includes('mix')) {
    const sec = 24;
    const r = await render(sec, (ctx, mixer) => {
      musicSetup({ night: 0, crisis: 0, season: 'summer', trains: true }, sec)(ctx, mixer);
      ambSetup(AMB_SCENES.strasse_tag, sec)(ctx, mixer);
      const sfx = new Sfx(ctx, mixer, { chord: () => [50, 54, 57, 61] });
      const seq = [['click', 2], ['place', 3], ['road', 4], ['zone', 5], ['money', 6], ['demolish', 7], ['milestone', 9], ['card', 14], ['error', 16], ['disaster', 18], ['click', 21]];
      for (const [n, t] of seq) sfx.play(n, {}, t);
    }, true);
    out.mix = { ...analyze(r.buf, 1), renderMs: r.ms };
  }
  out.ms = Math.round(performance.now() - T0);
  return out;
}
