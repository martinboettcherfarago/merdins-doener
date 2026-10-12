// Logiktest der Klangwelt in Node (ohne Browser) mit einem Schein-AudioContext: spielt 40 Minuten
// Musik mit wechselnden Stimmungen, je 10 Minuten jeder Umgebungsszene und alle Effekte und prüft auf
// NaN/Unendlich, ungültige Rampen, Ausnahmen, Knotenzahlen, Abschnittsfolgen und Ereignisraten.
// Aufruf (im Ordner spiel/): node src/audio/logiktest.js   – Ende mit Code 1 bei Fehlern.
const root = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
const errs = [];
let nodes = 0, starts = 0;
const ok = (v, what) => { if (!Number.isFinite(v)) errs.push(`${what}: ${v}`); };
class Param {
  constructor(v) { this.value = v; this._v = v; }
  setValueAtTime(v, t) { ok(v, 'setValueAtTime v'); ok(t, 'setValueAtTime t'); return this; }
  linearRampToValueAtTime(v, t) { ok(v, 'linRamp v'); ok(t, 'linRamp t'); return this; }
  exponentialRampToValueAtTime(v, t) { ok(v, 'expRamp v'); ok(t, 'expRamp t'); if (!(v > 0) && !(v < 0)) errs.push('expRamp auf 0: ' + v); return this; }
  setTargetAtTime(v, t, c) { ok(v, 'setTarget v'); ok(t, 'setTarget t'); ok(c, 'setTarget c'); if (c <= 0) errs.push('setTarget c<=0'); return this; }
  cancelScheduledValues(t) { ok(t, 'cancel t'); return this; }
}
class N {
  constructor() { nodes++; }
  connect(n) { if (!n) errs.push('connect undefined'); return n; }
  disconnect() {}
}
class Buf { constructor(ch, len, sr) { this.numberOfChannels = ch; this.length = len; this.sampleRate = sr; this.duration = len / sr; this.d = Array.from({ length: ch }, () => new Float32Array(len)); } getChannelData(i) { return this.d[i]; } }
class Ctx {
  constructor() { this.sampleRate = 8000; this.currentTime = 0; this.destination = new N(); this.state = 'running'; }
  createGain() { const n = new N(); n.gain = new Param(1); return n; }
  createOscillator() { const n = new N(); n.type = 'sine'; n.frequency = new Param(440); n.detune = new Param(0); n.start = (t) => { ok(t, 'osc start'); starts++; }; n.stop = (t) => { if (t !== undefined) ok(t, 'osc stop'); }; return n; }
  createBufferSource() { const n = new N(); n.playbackRate = new Param(1); n.start = (t, o, d) => { ok(t, 'buf start'); if (o !== undefined) ok(o, 'buf off'); if (d !== undefined) { ok(d, 'buf dur'); if (d < 0) errs.push('dur<0'); } starts++; }; n.stop = () => {}; return n; }
  createBiquadFilter() { const n = new N(); n.frequency = new Param(350); n.Q = new Param(1); n.gain = new Param(0); return n; }
  createStereoPanner() { const n = new N(); n.pan = new Param(0); return n; }
  createConvolver() { return new N(); }
  createDelay() { const n = new N(); n.delayTime = new Param(0); return n; }
  createDynamicsCompressor() { const n = new N(); for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new Param(0); return n; }
  createWaveShaper() { return new N(); }
  createBuffer(ch, len, sr) { return new Buf(ch, len, sr); }
}
globalThis.setTimeout = ((orig) => (fn, ms) => orig(fn, 0))(setTimeout);

const { Mixer } = await import(root + '/src/audio/mixer.js');
const { Music } = await import(root + '/src/audio/music.js');
const { Ambience } = await import(root + '/src/audio/ambience.js');
const { Sfx, SFX_NAMES } = await import(root + '/src/audio/sfx.js');
const { emptyScene } = await import(root + '/src/audio/scene.js');
const { AMB_SCENES } = await import(root + '/src/audio/selftest.js');

const ctx = new Ctx();
const mixer = new Mixer(ctx, {});
mixer.setVolumes({ volume: 0.7, music: 0.7, sfx: 0.8 }, 0);

// --- Musik: 40 Minuten mit wechselnden Stimmungen
const m = new Music(ctx, mixer, { seed: 7 });
m.wake(0);
const moods = [];
let lastSec = '';
const t0 = performance.now();
const phases = [
  [0, { menu: true }], [120, { menu: false, night: 0, crisis: 0, season: 'spring' }], [600, { season: 'summer' }], [900, { night: 1 }],
  [1200, { crisis: 0.9 }], [1350, { crisis: 0.1 }], [1500, { night: 0, season: 'autumn' }], [1800, { season: 'winter' }], [2100, { crisis: 0.7, night: 1 }], [2250, { crisis: 0 }],
];
let pi = 0, nodes0 = nodes;
const keys = new Set();
for (let t = 0; t < 2400; t += 0.05) {
  while (pi < phases.length && t >= phases[pi][0]) { m.setState(phases[pi][1]); pi++; }
  if (Math.random() < 0.05) m.arrival({ line: Math.floor(Math.random() * 5), station: Math.floor(Math.random() * 20), n: 3 });
  if (Math.abs(t - 700) < 0.01) m.celebrate();
  ctx.currentTime = t;
  m.tick(t);
  keys.add(m.key);
  const sec = m.mood + ':' + m.secName;
  if (sec !== lastSec) { moods.push(`${t.toFixed(0)}s ${sec} ${m.bpm}bpm`); lastSec = sec; }
}
console.log('Musik: 40 min in', (performance.now() - t0).toFixed(0), 'ms, Noten', m.notes, '=', (m.notes / 40).toFixed(0), '/min, Knoten', nodes - nodes0, '=', ((nodes - nodes0) / 2400).toFixed(1), '/s, Tonarten', [...keys].join(','));
console.log('Abschnitte:', moods.length, moods.slice(0, 40).join(' | '));

// --- Umgebung: jede Szene 10 Minuten
const amb = new Ambience(ctx, mixer, { chord: () => m.chordNotes() });
for (const [name, def] of Object.entries(AMB_SCENES)) {
  const s = emptyScene();
  s.valid = true; s.hour = 12; s.night = 0; s.zoom = 0.7;
  const { weather, poi, veh, lightningAt, ...rest } = def;
  Object.assign(s, rest);
  if (weather) Object.assign(s.weather, weather);
  if (poi) for (const k in poi) Object.assign(s.poi[k], typeof poi[k] === 'number' ? { p: poi[k], d: 5 } : poi[k]);
  if (veh) for (const k in veh) Object.assign(s.veh[k], typeof veh[k] === 'number' ? { p: veh[k], d: 5 } : veh[k]);
  s.dawn = Math.exp(-0.5 * ((s.hour - 6.3) / 1.2) ** 2); s.dusk = Math.exp(-0.5 * ((s.hour - 19.5) / 1.3) ** 2);
  const e0 = amb.events, n0 = nodes;
  const base = 10000 + Object.keys(AMB_SCENES).indexOf(name) * 1000;
  let maxV = 0;
  for (let t = 0; t < 600; t += 0.1) {
    const T = base + t;
    s.weather.lightning = (lightningAt && t % 30 < 0.15) ? 1 : 0;
    ctx.currentTime = T;
    if (Math.round(t * 10) % 2 === 0) amb.update(s, T);
    amb.tick(s, T);
    maxV = Math.max(maxV, amb.voices.count(T));
  }
  const awake = Object.values(amb.beds).filter((b) => b.awake).map((b) => b.name);
  console.log('Umgebung', name.padEnd(14), 'Ereignisse/min', ((amb.events - e0) / 10).toFixed(1).padStart(5), 'max Stimmen', maxV, 'Knoten/s', ((nodes - n0) / 600).toFixed(1), 'wach:', awake.join(','));
}

// --- Effekte: alle Namen, mehrfach schnell hintereinander
const sfx = new Sfx(ctx, mixer, { chord: () => m.chordNotes(), spatial: (o) => ({ gain: 0.5, pan: 0.3, send: 0.4 }), lastAdded: () => ({ cat: 'parks' }) });
let played = 0;
for (let k = 0; k < 5; k++) for (const n of SFX_NAMES) { ctx.currentTime = 20000 + k * 20 + played * 0.01; if (sfx.play(n, k % 2 ? { x: 3, y: 4, season: 'winter', level: 2 } : {}, ctx.currentTime)) played++; }
console.log('Effekte gespielt', played, 'von', SFX_NAMES.length * 5, 'Fehler:', sfx.lastError || 'keine');
console.log(errs.length ? 'FEHLER: ' + errs.length + '\n' + [...new Set(errs)].slice(0, 20).join('\n') : 'Keine ungültigen Werte.');
process.exit(errs.length || sfx.lastError ? 1 : 0);
