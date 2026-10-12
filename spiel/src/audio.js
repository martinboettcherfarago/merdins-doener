// Klangwelt von Stadtpuls – alles mit WebAudio erzeugt, keine Klangdateien.
//
// KLANGIDEE
// Die Stadt soll klingen wie ein Diorama, an das man sich heranbeugt: von weit oben ein weiches
// Stadtrauschen und Höhenwind, aus der Nähe die Straße unter der Kamera – rollende Reifen, vorbei-
// fahrende Autos mit Doppler, Stimmengewirr vor den Läden, Hämmern auf der Baustelle, Brummen der
// Industrie, Wellen am Ufer, Blätter im Wind. Tageszeit und Jahreszeit färben die Natur (Amsel im
// Morgengrauen, Spatzen und Tauben in der Stadt, Krähen im Winter, Kuckuck im Frühling, Grillen in
// Sommernächten – ihr Zirpen folgt der Temperatur –, Frösche am Wasser, der Waldkauz). Das Wetter aus
// g.ext.weather bringt Regen (nasse Straßen zischen lauter), Wind, Sturmpfeifen, Donner nach jedem
// Blitz mit Laufzeit, und Schnee, der die Höhen schluckt. Sondergebäude haben eigene Stimmen
// (Glocken zur Mittagszeit, Schulklingel, Brunnen, Stadion, Spieluhr am Riesenrad, Nebelhorn am
// Leuchtturm bei Nebel, Dönerspieß), Fahrzeuge in der Nähe ebenso (Martinshorn mit Doppler,
// Pulsbahn-Singen, Flugzeuge, Hubschrauber, Schiffshorn, Schneepflug).
//
// Darüber liegt generative Musik in Liedform (Intro, A, B, Break, Outro, Ruhe – danach neue Tonart).
// Tag: helle Dur-Progressionen mit Marimba/Kalimba/Celesta/Gitarre je Jahreszeit; Nacht: Moll-
// Färbung, langsamer, E-Piano und Flöte, mehr Hall; Krise (Brand, Katastrophe, Schulden, Mangel):
// Spannungsabschnitt mit Bordun, pochenden Tom-Schlägen und Ticken, danach eine Auflösung; ein
// Meilenstein löst einen festlichen Abschnitt aus. Das Herzstück bleiben die Pulsbahn-Töne: jede
// Zugankunft zupft einen Ton der Dur-Pentatonik im aktuellen Akkord, auf Achtel eingerastet und mit
// Echo im Tempo. Effektklänge (Bauen, Abriss, Meilenstein, Karten, Katastrophen, Sirene, Bus, Flugzeug …)
// stehen im Akkord der Musik und können räumlich sein ({ x, y } Feld oder { wx, wz } Welt).
//
// MISCHUNG (Pegel vor dem Gesamtregler, gemessen per OfflineAudioContext, siehe audio/selftest.js)
// - Musik ≈ −24 dBFS RMS (Fläche leise, Arpeggio-Spitzen ≈ −14 dBFS), Nacht −1,5 dB.
// - Umgebung ≈ −30 dBFS RMS in belebter Nahsicht, −36 dBFS ruhig; Regen/Sturm bis ≈ −24 dBFS.
// - Oberfläche ≈ −24 dBFS Spitze (Klick), Bauen ≈ −12 dBFS, Meilenstein/Katastrophe ≈ −6 dBFS.
// - Große Ereignisse ducken Musik und Umgebung kurz. Summe → Hochpass 28 Hz → Limiter (−9 dBFS,
//   10:1, 3 ms), damit nichts übersteuert. Hall: Saal (3,2 s) für Musik, Straßenraum (1,1 s) für
//   Effekte und Umgebung; die Sendewege hängen hinter den Reglern (Musik 0 = auch kein Musikhall).
// - Regler aus app.settings: volume (gesamt), music, sfx (Effekte und Umgebung), muted; optional
//   ambience (0..1, Umgebung relativ zu Effekten), quality ('low' = kürzere Hallräume).
//
// LEISTUNG
// Dauerklänge sind fest verdrahtete Knoten (nur Pegel werden nachgeführt) und schlafen nach einigen
// Sekunden Stille. Einzelereignisse sind begrenzt: Umgebung 10, Effekte 16, Musik 26 gleichzeitige
// Stimmen; jeder Effektname hat eine Mindestpause. Der Hörort wird 5×/s ausgewertet (< 0,5 ms).
// Taktgeber per setInterval mit 0,3 s Vorausplanung, damit die Musik auch im Menü und bei
// ruckelnder Bildrate sauber läuft; im Hintergrund-Tab wird der Kontext angehalten.
//
// SCHNITTSTELLE
//   new Audio(settings) · start() · applyVolumes() · update(game, engine, dt) · play(name, opts)
//   Namen: click hover tab toggle open close pop whoosh speed pause resume photo place road zone
//   demolish complete levelup line error milestone achievement unlock card money loan bad good notify
//   warn bankrupt season busStop plane helicopter train ship horn bell churchbell fire extinguish
//   thunder storm siren disaster quake explosion meteor tornado flood (+ Aliasse fanfare, cash, ui).
//   Ereignisbus (registry.js): emit('sound', name, opts) · emit('disaster', {type, phase, x, y,
//   intensity}) · emit('busStop', {x, y}) · emit('plane', {x, y}) · emit('achievement') · emit('season', s).
//   Prüfen: window.__stadtpuls.audio.stats() und await window.__stadtpuls.audio.selfTest().
import { on as onBus } from './registry.js';
import { BUILDINGS } from './config.js';
import { clamp } from './audio/core.js';
import { Mixer } from './audio/mixer.js';
import { Music } from './audio/music.js';
import { Ambience } from './audio/ambience.js';
import { Sfx, SFX_NAMES } from './audio/sfx.js';
import { Listener } from './audio/scene.js';
import { selfTest } from './audio/selftest.js';

const DISASTER_SOUND = [
  [/quake|beben/i, 'quake'], [/torn|wirbel/i, 'tornado'], [/flood|flut|hochwasser/i, 'flood'],
  [/meteor/i, 'meteor'], [/storm|sturm|orkan/i, 'storm'], [/light|blitz/i, 'thunder'], [/fire|brand|feuer/i, 'fire'],
];

export class Audio {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.started = false;
    this.game = null;
    this.engine = null;
    this.scene = null;
    this.listener = new Listener();
    this.lastUpdate = -1e9;
    this.analysisAt = -1;
    this.unsub = [];
    this.lastAdded = null;
    this.removed = { t: 0, n: 0 };
    this.bstate = new Map();
    this.lastSpeed = null;
    this.names = SFX_NAMES;
    // Andere Module lösen Klänge über den Ereignisbus aus, ohne die Audio-Instanz zu kennen.
    onBus('sound', (name, o) => this.play(name, o));
    onBus('disaster', (ev) => this.onDisaster(ev || {}));
    onBus('busStop', (ev) => this.play('busStop', ev || {}));
    onBus('plane', (ev) => this.play('plane', ev || {}));
    onBus('achievement', () => this.play('achievement'));
    onBus('season', (s) => this.play('season', { season: typeof s === 'string' ? s : s && s.season }));
  }

  start() {
    if (this.started) return;
    let ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC({ latencyHint: 'interactive' });
    } catch (e) { return; }
    this.ctx = ctx;
    this.started = true;
    this.mixer = new Mixer(ctx, { quality: this.settings.quality });
    this.music = new Music(ctx, this.mixer);
    const chord = () => this.music.chordNotes();
    this.amb = new Ambience(ctx, this.mixer, { chord });
    this.sfx = new Sfx(ctx, this.mixer, {
      chord,
      spatial: (o) => this.spatial(o),
      lastAdded: () => (this.lastAdded && performance.now() - this.lastAdded.t < 250 ? this.lastAdded : null),
      lastRemoved: () => (performance.now() - this.removed.t < 250 ? this.removed.n : 1),
    });
    this.applyVolumes();
    if (this.audible('music')) this.music.wake(ctx.currentTime + 0.05);
    this.timer = setInterval(() => this.pump(), 50);
    this.onVis = () => this.visibility();
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVis);
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.mixer.setVolumes(this.settings, this.ctx.currentTime);
    this.pump();
  }

  audible(part) {
    const s = this.settings;
    if (s.muted || !(s.volume > 0)) return false;
    if (part === 'music') return s.music > 0;
    if (part === 'amb') return s.sfx > 0 && (s.ambience == null || s.ambience > 0);
    return s.sfx > 0;
  }

  // Taktgeber (setInterval alle 50 ms und jedes Bild): Musik und Umgebungs-Ereignisse planen –
  // unabhängig von der Bildrate. Kommt einige Sekunden kein Bild aus dem Spiel, gilt das Menü.
  pump() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const inGame = !!this.game && performance.now() - this.lastUpdate < 4000;
    if (this.audible('music')) {
      this.music.wake(now);
      if (!inGame) this.music.setState({ menu: true, crisis: 0 });
      this.music.tick(now);
    } else this.music.sleep(now);
    if (!inGame || !this.audible('amb')) {
      if (!this.ambQuiet) { this.amb.sleepAll(now); this.ambQuiet = true; }
    } else if (this.scene && !this.ambQuiet) {
      try { this.amb.tick(this.scene, now); } catch (e) { /* Klang darf das Spiel nie anhalten */ }
    }
  }

  // pro Bild: Ankünfte, Hörort, Umgebung, Musikzustand
  update(game, engine, dt) {
    if (!game) return;
    if (game !== this.game) this.attach(game);
    this.engine = engine;
    this.lastUpdate = performance.now();
    const ctx = this.ctx;
    const running = ctx && ctx.state === 'running';
    // Ankünfte immer abholen, sonst läuft die Liste voll
    const arr = game.transit && game.transit.arrivals;
    if (arr && arr.length) {
      const list = arr.splice(0, arr.length);
      if (running && this.music.awake) for (const a of list) this.music.arrival(a);
    }
    if (!running) return;
    const now = ctx.currentTime;
    if (this.lastSpeed != null && game.speed !== this.lastSpeed) {
      this.play(game.speed === 0 ? 'pause' : this.lastSpeed === 0 ? 'resume' : 'speed', { level: game.speed });
    }
    this.lastSpeed = game.speed;
    const ambOn = this.audible('amb');
    if (now - this.analysisAt >= 0.2 || this.analysisAt > now) {
      this.analysisAt = now;
      try {
        const sc = this.listener.sample(game, engine, now);
        this.scene = sc;
        this.music.setState({ menu: false, night: sc.night, crisis: sc.crisis, season: sc.weather.season, activity: sc.cityScale });
        if (ambOn) { this.amb.update(sc, now); this.ambQuiet = false; }
      } catch (e) { /* Klang darf das Spiel nie anhalten */ }
    }
    this.pump();
    void dt;
  }

  attach(g) {
    for (const u of this.unsub) u();
    this.unsub = [];
    this.game = g;
    this.lastSpeed = g.speed;
    this.bstate = new Map();
    this.listener = new Listener();
    this.scene = null;
    if (!g.on) return;
    for (const b of g.buildings.values()) this.bstate.set(b.id, { c: b.construct, f: !!b.burning });
    const u = this.unsub;
    u.push(g.on('buildingAdded', (b) => {
      this.lastAdded = { t: performance.now(), cat: BUILDINGS[b.key] ? BUILDINGS[b.key].cat : b.zone ? 'zone' : '' };
      this.bstate.set(b.id, { c: b.construct, f: !!b.burning });
      this.listener.markDirty();
    }));
    u.push(g.on('buildingRemoved', (b) => {
      const t = performance.now();
      if (t - this.removed.t > 150) this.removed.n = 0;
      this.removed.t = t; this.removed.n++;
      this.bstate.delete(b.id);
      this.listener.markDirty();
    }));
    u.push(g.on('buildingUpdated', (b) => this.buildingUpdated(b)));
    u.push(g.on('buildingRebuilt', (b) => { const p = this.at(b); if (p.near) this.play('levelup', p.o); }));
    u.push(g.on('bankrupt', () => this.play('bankrupt')));
    u.push(g.on('milestone', () => { if (this.music) this.music.celebrate(); }));
    u.push(g.on('hour', (h) => this.hour(g, h)));
  }

  at(b) {
    const o = { x: b.x + (b.w - 1) / 2, y: b.y + (b.h - 1) / 2 };
    const sp = this.spatial(o);
    return { o, near: !!sp && sp.gain > 0.3 };
  }

  buildingUpdated(b) {
    const prev = this.bstate.get(b.id) || { c: 1, f: false };
    const cur = { c: b.construct, f: !!b.burning };
    this.bstate.set(b.id, cur);
    if (prev.c < 1 && cur.c >= 1) { const p = this.at(b); if (p.near) this.play('complete', p.o); }
    if (!prev.f && cur.f) { const p = this.at(b); this.play('fire', { ...p.o, far: true }); }
    if (prev.f && !cur.f && b.extinguishAt) { const p = this.at(b); if (p.near) this.play('extinguish', p.o); }
  }

  // Stundenschlag: Mittagsglocken (sonntags Geläut um 10), Schulklingel an Werktagen
  hour(g, h) {
    const sc = this.scene;
    if (!sc || !this.ctx || this.ctx.state !== 'running' || !this.audible('amb')) return;
    const now = this.ctx.currentTime;
    const bells = sc.poi.bells;
    if (bells.d < 900) {
      const gain = 0.03 + 0.12 * bells.p;
      if (h === 12) this.amb.bells(now, 3, gain, bells.pan, 196 * Math.pow(2, ((this.music.key - 43) % 12) / 12));
      else if (h === 10 && g.weekday() === 6) this.amb.peal(now, gain, bells.pan, this.music.key + 7);
    }
    const sch = sc.poi.school;
    if ((h === 8 || h === 13) && g.weekday() < 5 && sch.p > 0.12) this.amb.schoolBell(now, 0.18 * sch.p * (0.4 + 0.6 * sc.zoom), sch.pan);
  }

  onDisaster(ev) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.listener.disaster(ev, now);
    const pos = ev.x != null ? { x: ev.x, y: ev.y, far: true } : {};
    const type = String(ev.type || '');
    if (ev.phase === 'warn') { this.play('siren', pos); return; }
    if (ev.phase === 'start') {
      let name = 'disaster';
      for (const [re, n] of DISASTER_SOUND) if (re.test(type)) { name = n; break; }
      if (name !== 'meteor' && name !== 'thunder') this.play('disaster', pos);
      this.play(name, { ...pos, dur: 3 + clamp(ev.intensity == null ? 0.6 : ev.intensity) * 3, close: 0.9 });
    }
  }

  // Position → { gain, pan, send } relativ zur Kamera (null = zu weit weg)
  spatial(o) {
    const e = this.engine, g = this.game;
    if (!e || !e.rig || !g) return { gain: 1, pan: 0, send: 0.25 };
    const cur = e.rig.cur;
    const wx = o.wx != null ? o.wx : o.x + 0.5 - g.W / 2;
    const wz = o.wz != null ? o.wz : (o.y != null ? o.y : 0) + 0.5 - g.H / 2;
    const dx = wx - cur.x, dz = wz - cur.z;
    const d = Math.hypot(dx, dz);
    const R = clamp(3 + cur.dist * 0.32, 4, 26);
    const zoom = this.scene ? this.scene.zoom : 0.5;
    let gain = (1 / (1 + (d / (0.55 * R)) ** 2)) * (0.45 + 0.55 * zoom);
    if (o.far) gain = Math.max(gain, 0.35);
    if (gain < 0.04) return null;
    const pan = clamp((dx * Math.cos(cur.yaw) - dz * Math.sin(cur.yaw)) / (R * 0.8), -1, 1);
    return { gain: clamp(gain), pan, send: 0.15 + (1 - clamp(gain)) * 0.5 };
  }

  visibility() {
    const ctx = this.ctx;
    if (!ctx) return;
    if (document.hidden) {
      this.mixer.master.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      setTimeout(() => { if (document.hidden && ctx.state === 'running') ctx.suspend().catch(() => {}); }, 250);
    } else if (ctx.state !== 'closed') {
      ctx.resume().then(() => this.applyVolumes()).catch(() => {});
    }
  }

  play(name, opts) {
    if (!this.ctx || this.ctx.state !== 'running' || !this.audible('sfx')) return false;
    return this.sfx.play(name, opts || {});
  }

  // ältere Hilfen (falls jemand sie direkt nutzt)
  tone(freq, dur, type = 'sine', vol = 0.15, when = 0) { if (this.ctx && this.ctx.state === 'running') this.sfx.tone(freq, this.ctx.currentTime + when, dur, type, vol); }
  pluck(freq, vol = 0.15) { if (this.ctx && this.ctx.state === 'running') this.sfx.note('pluck', this.ctx.currentTime, freq, vol, 0, { send: 0.45, echo: 0.55 }); }
  noiseBurst(dur, freq, vol, when = 0) { if (this.ctx && this.ctx.state === 'running') this.sfx.noise(this.ctx.currentTime + when, dur, 'bandpass', freq, vol); }

  stats() {
    if (!this.ctx) return { started: false };
    const sc = this.scene;
    return {
      started: true, state: this.ctx.state, time: +this.ctx.currentTime.toFixed(2), sampleRate: this.ctx.sampleRate,
      music: this.music.info(), amb: this.amb.stats(), sfx: { played: this.sfx.count, voices: this.sfx.voices.count(this.ctx.currentTime) },
      scene: sc ? { zoom: +sc.zoom.toFixed(2), traffic: +sc.traffic.toFixed(2), res: +sc.res.toFixed(2), com: +sc.com.toFixed(2), ind: +sc.ind.toFixed(2), trees: +sc.trees.toFixed(2), water: +sc.water.toFixed(2), construction: +sc.construction.toFixed(2), night: +sc.night.toFixed(2), crisis: +sc.crisis.toFixed(2), why: sc.crisisWhy, season: sc.weather.season, rain: sc.weather.rain } : null,
    };
  }

  // Offline-Prüfung aller Klänge: Pegel, Spitzen, Übersteuerung, Spektrum (siehe audio/selftest.js)
  selfTest(opts) { return selfTest(opts); }
}
