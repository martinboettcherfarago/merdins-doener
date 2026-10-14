// Render-Engine: Szene, Himmel, Tag/Nacht und Jahreszeiten, Licht, Schatten, Nebel, Nachbearbeitung,
// Verknüpfung von Simulation und Ansichten. Besitzer: G1.
//
// Für andere Agenten nutzbar:
//   engine.scene / camera / renderer / rig / game / settings     wie bisher
//   engine.hud                Szene, die NACH der Nachbearbeitung gezeichnet wird (Symbole, Beschriftungen; ohne Nebel/Tonwert)
//   engine.night              0 = Tag … 1 = Nacht
//   engine.sun                DirectionalLight (tagsüber Sonne, nachts Mond), engine.hemi = HemisphereLight
//   engine.light              { sunDir, moonDir, sunElev, sunColor, ambient, dayLight (0..1), cloud, overcast }
//   engine.wx                 geglättetes Wetter { season, yearT, temp, rain, snow, snowCover, cloud, fog, wind, windDir, storm, wet }
//   engine.flash              aktueller Blitz (0..1) – wird von views/weatherfx.js gesetzt
//   engine.quality            aufgelöstes Qualitätsprofil (siehe QUALITY); bei „Automatisch" { …, auto: true, rung }
//   engine.device / engine.gov  Geräteeinschätzung und laufende Regelung der Stufe „Automatisch" (autoquality.js)
//   engine.autoStatus()       kurzer Text zum aktuellen Stand der Regelung (Einstellungen)
//   engine.settings           die Einstellungen; bei „Automatisch" liefert settings.quality die ermittelte Grundstufe
//                             (low|medium|high), damit Ansichten mit Stufentabellen passende Mengen wählen
//   engine.shake(stärke)      Kamerawackeln (Katastrophen)
// Qualität: settings.quality = auto|low|medium|high|ultra; settings.postfx/ao/bloom (bool) und settings.shadows (off|low|high)
// überschreiben einzelne Teile (bei „Automatisch" als Obergrenze). Änderungen an settings werden live übernommen.
import * as THREE from 'three';
import { shared, atmo } from './materials.js';
import { CameraRig } from './camera.js';
import { SkySystem } from './sky.js';
import { PostFX, postSupported } from './post.js';
import { TerrainView } from './terrain.js';
import { RoadView } from './roads.js';
import { BuildingView } from './buildings.js';
import { VehicleView, TransitView } from './agents.js';
import { OverlayView } from './overlay.js';
import { UndergroundView } from './underground.js';
import { EffectsView } from './effects.js';
import { VIEWS } from '../registry.js';
import { detectDevice, AutoGovernor } from './autoquality.js';
import { g9Materials, g9DepthMaterial } from './protos.js';

// lod: Faktor der Detailabstände der Gebäude (buildings.js)
export const QUALITY = {
  low: { pr: 1, post: false, msaa: 0, ao: false, aoSamples: 6, aoHalf: true, bloom: false, bloomLevels: 4, shadow: 0, shadowEvery: 3, weather: 0.4, lod: 0.65 },
  medium: { pr: 1.5, post: true, msaa: 4, ao: true, aoSamples: 10, aoHalf: true, bloom: true, bloomLevels: 5, shadow: 2048, shadowEvery: 2, weather: 0.7, lod: 1 },
  high: { pr: 2, post: true, msaa: 4, ao: true, aoSamples: 12, aoHalf: true, bloom: true, bloomLevels: 6, shadow: 4096, shadowEvery: 1, weather: 1, lod: 1.3 },
  ultra: { pr: 2, post: true, msaa: 8, ao: true, aoSamples: 16, aoHalf: false, bloom: true, bloomLevels: 6, shadow: 4096, shadowEvery: 1, weather: 1.3, lod: 1.7 },
};

// engine (optional): bei settings.quality = 'auto' liefert die laufende Regelung (engine.gov) das Profil
export function resolveQuality(settings = {}, engine = null) {
  if (settings.quality === 'auto' && engine && engine.gov) {
    const name = engine.device.name;
    return { ...QUALITY[name], ...engine.gov.profile(settings), name, auto: true, rung: engine.gov.rung, post: settings.postfx !== false };
  }
  const base = QUALITY[settings.quality] || QUALITY.medium;
  const q = { ...base, name: QUALITY[settings.quality] ? settings.quality : 'medium' };
  if (settings.postfx === false) q.post = false;
  if (settings.ao === false) q.ao = false;
  if (settings.bloom === false) q.bloom = false;
  if (settings.shadows === 'off') q.shadow = 0;
  else if (settings.shadows === 'low') q.shadow = 1024;
  else if (settings.shadows === 'high') q.shadow = 4096;
  return q;
}

const DEFAULT_WX = { season: 'summer', yearT: 0.375, temp: 20, rain: 0, snow: 0, snowCover: 0, cloud: 0.28, fog: 0, wind: 0.3, windDir: 0.6, storm: 0, wet: 0, lightning: 0 };
const SEASON_T = { spring: 0.125, summer: 0.375, autumn: 0.625, winter: 0.875 };
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

// Farbe des Sonnenlichts nach Luftmasse (Kasten–Young), normiert auf Zenit.
function sunLightColor(elevRad, out) {
  const e = Math.max(elevRad, -0.02);
  const deg = (e * 180) / Math.PI;
  const m = 1 / (Math.sin(Math.max(e, 0.001)) + 0.15 * Math.pow(Math.max(deg, 0) + 3.885, -1.253));
  const k = [0.085, 0.19, 0.46];
  out.setRGB(Math.exp(-(m - 1) * k[0]), Math.exp(-(m - 1) * k[1]), Math.exp(-(m - 1) * k[2]));
  return out;
}

export class Engine {
  // opts: { deferBuild } – Gebäude hinter dem Ladebildschirm in Zeitscheiben aufbauen (main.js, mit warming)
  constructor(canvas, game, settings, opts = {}) {
    this.canvas = canvas;
    this.game = game;
    this.opts = opts;
    this.rawSettings = settings;
    // Ansichten lesen settings.quality als Stufe (low…ultra): bei „Automatisch" die ermittelte Grundstufe liefern
    this.settings = new Proxy(settings, { get: (t, k) => (k === 'quality' && t.quality === 'auto' && this.device ? this.device.name : t[k]) });
    const autoMode = settings.quality === 'auto';
    this.quality = autoMode ? { ...QUALITY.medium, post: settings.postfx !== false, name: 'medium' } : resolveQuality(settings);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.quality.post, powerPreference: 'high-performance', stencil: false });
    if (autoMode) {
      this.device = detectDevice(renderer);
      this.gov = new AutoGovernor(this.device);
      this.quality = resolveQuality(settings, this);
    }
    const q = this.quality;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.CustomToneMapping; // „Neutral“, siehe materials.js
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = q.shadow > 0;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false; // gezielt aktualisiert, siehe fitShadow()
    renderer.info.autoReset = false;
    // Shader-Fehlerprüfung fragt beim ersten Gebrauch jedes Programms synchron die Protokolle ab (getProgramInfoLog,
    // getShaderInfoLog) – das wartet auf den Treiber und machte im Profil des Ladens ~80 % der Zeit aus. Für Spieler
    // aus, in Prüfwerkzeugen (navigator.webdriver) und mit ?debug an, damit Shaderfehler dort weiter auffallen.
    try {
      const forced = typeof window !== 'undefined' ? window.STADTPULS_SHADERCHECK : undefined; // Messwerkzeuge: wie beim Spieler messen
      renderer.debug.checkShaderErrors = typeof forced === 'boolean' ? forced : !!((typeof navigator !== 'undefined' && navigator.webdriver) || (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)));
    } catch (e) { /* egal */ }
    renderer.setClearColor(0x0a0f1e, 1);
    this.renderer = renderer;
    this.canPost = postSupported(renderer);
    const scene = new THREE.Scene();
    this.scene = scene;
    this.hud = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.3, 1400);
    this.rig = new CameraRig(this.camera, canvas, game.W, game);
    const hx = game.world.highway[game.world.highway.length - 1] % game.W;
    this.rig.focus(hx + 10 - game.W / 2, game.world.highwayY - game.H / 2, 30);
    this.rig.intro();

    // Himmel und Licht
    this.sky = new SkySystem(renderer, scene, q.name);
    scene.fog = new THREE.Fog(0xb4d2ee, 120, 420);
    this.hemi = new THREE.HemisphereLight(0xdfeeff, 0x6b5a45, 0.5);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.5);
    this.sun.castShadow = q.shadow > 0;
    this.sun.shadow.mapSize.set(Math.max(512, q.shadow), Math.max(512, q.shadow));
    this.sun.shadow.bias = -0.0002;
    this.sun.shadow.normalBias = 0.02;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.light = {
      sunDir: new THREE.Vector3(0, 1, 0), moonDir: new THREE.Vector3(0, 1, 0), keyDir: new THREE.Vector3(0, 1, 0),
      sunElev: 0.5, sunColor: new THREE.Color(1, 1, 1), ambient: new THREE.Color(0.5, 0.6, 0.7), dayLight: 1, cloud: 0, overcast: 0, moonPhase: 0.5,
    };
    this.atmo = atmo;
    this.wx = { ...DEFAULT_WX };
    this.skyTop = new THREE.Color(0x3f7fd0); this.skyHor = new THREE.Color(0xbcd6ec); this.skyBot = new THREE.Color(0x9db3c4);
    this.flash = 0;
    this.cloudOff = new THREE.Vector2(Math.random() * 50, Math.random() * 50);
    this.shadowOff = new THREE.Vector2(Math.random() * 50, Math.random() * 50);
    this.skyState = {
      sunDir: this.light.sunDir, moonDir: this.light.moonDir, s: 0.5, night: 0, cloud: 0.3, storm: 0, flash: 0, time: 0,
      cloudOff: this.cloudOff, sunColor: new THREE.Color(), moonVis: 0, cityGlow: new THREE.Color(), ground: new THREE.Color(), exposure: 1, belowClouds: 0.3,
    };

    this.post = null;
    this.applyQuality(true);

    // Aufbauzeiten je Teil (ms) für Messwerkzeuge: engine.loadTimes
    const lt = this.loadTimes = {};
    let t0 = performance.now();
    const lap = (k) => { const t = performance.now(); lt[k] = Math.round(t - t0); t0 = t; };
    this.terrain = new TerrainView(this); lap('terrain');
    this.roads = new RoadView(this); lap('roads');
    this.buildings = new BuildingView(this); lap('buildings');
    this.vehicles = new VehicleView(this);
    this.transit = new TransitView(this);
    this.underground = new UndergroundView(this);
    this.overlay = new OverlayView(this);
    this.effects = new EffectsView(this); lap('agents+fx');
    this.views = [];
    for (const V of VIEWS) {
      try { this.views.push(new V(this)); } catch (e) { console.error('Ansicht fehlgeschlagen', V.name, e); }
      const t = performance.now(); if (t - t0 > 15) lt['view:' + (V.name || this.views.length)] = Math.round(t - t0); t0 = t;
    }

    this.dirty = { trees: false, zones: false, roads: false, terrainColors: false, overlay: false };
    this.bindGame();
    this.time = 0;
    this.overlayTimer = 0;
    this.settingsKey = this.qualityKey();
    this.settingsTimer = 0;
    this.frameNo = 0;
    this.realDt = 1 / 60;
    this.resize();
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    if (typeof window !== 'undefined') window.__engine = this; // für Prüfwerkzeuge
  }

  qualityKey() {
    const s = this.rawSettings || {};
    return [s.quality, s.postfx, s.ao, s.bloom, s.shadows].join('|');
  }

  // Kurzbeschreibung des aktuellen Stands (Einstellungen, Stufe „Automatisch")
  autoStatus() {
    if (!this.gov || this.rawSettings.quality !== 'auto') return '';
    return this.gov.describe({ ...this.quality, post: this.usePost });
  }

  // Qualitätsprofil anwenden (beim Start und wenn sich settings ändern).
  applyQuality(initial = false) {
    if (this.rawSettings.quality === 'auto' && !this.gov) {
      // erst zur Laufzeit auf „Automatisch" umgestellt
      this.device = detectDevice(this.renderer);
      this.gov = new AutoGovernor(this.device);
    }
    const q = resolveQuality(this.rawSettings, this);
    // Ohne Kantenglättung im Kontext auch bei „niedrig“ den schlanken HDR-Weg nehmen (MSAA im Puffer)
    const ctxAA = this.renderer.getContextAttributes ? !!(this.renderer.getContextAttributes() || {}).antialias : true;
    const usePost = this.canPost && (q.post || !ctxAA);
    if (!q.post && usePost) { q.ao = false; q.bloom = false; q.msaa = 4; }
    this.quality = q;
    this.usePost = usePost;
    const r = this.renderer;
    // Umgebungsverdeckung und Leuchten werden weich ein- und ausgeblendet (fx.ao/fx.bloom = Stärke 0…1); beim Abschalten
    // bleibt der Durchgang bis zum Ende der Blende aktiv (siehe fxFrame)
    const fx = this.fx || (this.fx = { ao: 1, bloom: 1, aoT: 1, bloomT: 1 });
    if (usePost) {
      const had = this.post ? this.post.cfg : null;
      const keepAO = !initial && had && had.ao && !q.ao;
      const keepBloom = !initial && had && had.bloom && !q.bloom;
      if (!initial && q.ao && !(had && had.ao)) fx.ao = 0;
      if (!initial && q.bloom && !(had && had.bloom)) fx.bloom = 0;
      fx.aoT = q.ao ? 1 : 0; fx.bloomT = q.bloom ? 1 : 0;
      if (initial) { fx.ao = fx.aoT; fx.bloom = fx.bloomT; }
      const cfg = { msaa: q.msaa, ao: q.ao || keepAO, aoSamples: keepAO ? had.aoSamples : q.aoSamples, aoHalf: q.aoHalf, bloom: q.bloom || keepBloom, bloomLevels: keepBloom ? had.bloomLevels : q.bloomLevels, dof: !!this.dofEnabled };
      if (!this.post) this.post = new PostFX(r, cfg); else this.post.configure(cfg);
    } else if (this.post) { this.post.dispose(); this.post = null; }
    const shadowsOn = q.shadow > 0;
    if (r.shadowMap.enabled !== shadowsOn && !initial) {
      // Programme müssen neu gebaut werden
      this.scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
    }
    r.shadowMap.enabled = shadowsOn;
    this.sun.castShadow = shadowsOn;
    if (shadowsOn && this.sun.shadow.mapSize.x !== q.shadow) {
      this.sun.shadow.mapSize.set(q.shadow, q.shadow);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    if (!initial) this.resize();
  }

  // Tiefenschärfe (Fotomodus): stärke 0..1, focusZ = Fokusentfernung (Welteinheiten) oder tilt = true für Tilt-Shift
  setDepthOfField(strength, opts = {}) {
    this.dofEnabled = strength > 0;
    if (this.post) {
      this.post.configure({ dof: this.dofEnabled });
      this.post.params.dof = strength;
      this.post.params.tiltShift = opts.tilt ? 1 : 0;
      if (opts.focusZ) this.post.params.focusZ = opts.focusZ;
    }
  }

  shake(amount) { this.rig.shake(amount); }

  // Für Prüfwerkzeuge/Fotomodus: Kamera, Wetter und Umgebungskarte sofort auf Zielwerte setzen.
  snap() {
    this.rig.flight = null;
    this.rig.cur = { ...this.rig.goal };
    this._snapWx = true;
    this.sky.envKey = null; this.sky.envTimer = 0;
  }

  bindGame() {
    const g = this.game, d = this.dirty;
    this.unbind = [
      g.on('buildingAdded', (b) => { this.buildings.add(b); d.zones = true; }),
      g.on('buildingRebuilt', (b) => this.buildings.add(b)),
      g.on('buildingUpdated', (b) => this.buildings.update(b)),
      g.on('buildingRemoved', (b) => { this.buildings.remove(b); d.zones = true; d.trees = true; }),
      g.on('roadsChanged', () => { d.roads = true; d.trees = true; d.zones = true; }),
      g.on('zonesChanged', () => { d.zones = true; }),
      g.on('treesChanged', () => { d.trees = true; }),
      g.on('rubbleChanged', () => { d.terrainColors = true; d.zones = true; }),
      g.on('hour', () => { d.overlay = true; }),
    ];
  }

  dispose() {
    for (const u of this.unbind) u();
    window.removeEventListener('resize', this._onResize);
    for (const v of this.views) if (v.dispose) { try { v.dispose(); } catch (e) { console.error(e); } }
    if (this.effects.dispose) this.effects.dispose();
    if (this.rig.dispose) this.rig.dispose();
    if (this.post) this.post.dispose();
    this.sky.dispose();
    this.renderer.dispose();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, this.quality.pr);
    // Leinwand nur neu anlegen, wenn sich Größe oder Pixelverhältnis wirklich ändern (jede Zuweisung leert den Puffer)
    const key = `${w}x${h}@${pr}`;
    if (key === this._sizeKey && this.post && this.post.sceneRT) return;
    this._sizeKey = key;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const bh = h * pr;
    this.pixelRatio = pr;
    this.pointScale = bh / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    if (this.post) this.post.setSize(w * pr, h * pr);
    if (this.effects) this.effects.resize(this.pointScale, pr);
    this.sky.setPixelRatio(pr);
    for (const v of this.views || []) if (v.resize) { try { v.resize(this.pointScale, pr); } catch (e) { console.error(e); } }
  }

  pickTile(clientX, clientY) {
    const p = this.rig.groundAt(clientX, clientY);
    if (!p) return null;
    const g = this.game;
    const x = Math.floor(p.x + g.W / 2), y = Math.floor(p.z + g.H / 2);
    if (x < 0 || y < 0 || x >= g.W || y >= g.H) return { x, y, i: -1, wx: p.x, wz: p.z, out: true };
    return { x, y, i: y * g.W + x, wx: p.x, wz: p.z };
  }

  // ---------- Wetter (geglättet aus g.ext.weather)
  updateWeather(dt) {
    const src = (this.game.ext && this.game.ext.weather) || {};
    const wx = this.wx;
    // Bei sehr langsamen Bildern (Software-Rendering) oder auf Wunsch sofort übernehmen
    const snap = this._snapWx || this.slow || this.frameNo < 2;
    this._snapWx = false;
    const k = snap ? 1 : 1 - Math.exp(-dt * 0.6);
    const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
    const season = src.season || 'summer';
    wx.season = season;
    const yt = num(src.yearT, SEASON_T[season] ?? 0.375);
    // Jahreszeit ohne Sprung am Jahreswechsel glätten
    let dy = yt - wx.yearT; if (dy > 0.5) dy -= 1; if (dy < -0.5) dy += 1;
    wx.yearT = (wx.yearT + dy * k + 1) % 1;
    wx.temp += (num(src.temp, 20) - wx.temp) * k;
    for (const key of ['rain', 'snow', 'cloud', 'fog', 'wind']) wx[key] += (clamp01(num(src[key], DEFAULT_WX[key])) - wx[key]) * k;
    wx.snowCover += (clamp01(num(src.snowCover, 0)) - wx.snowCover) * (snap ? 1 : 1 - Math.exp(-dt * 0.3));
    // Gewitterstimmung: Sturm-Flag, Gewitterstärke (S4: stormI) und aktive Tornados dunkeln Himmel und Licht ab
    const dis = this.game.ext && this.game.ext.disasters;
    const tornado = dis && Array.isArray(dis.active) && dis.active.some((a) => a.type === 'tornado') ? 1 : 0;
    const stormT = Math.max(src.storm ? Math.max(0.6, num(src.stormI, 1)) : 0, clamp01((num(src.stormI, 0) - 0.1) / 0.6), tornado);
    wx.storm += (stormT - wx.storm) * k;
    let da = num(src.windDir, 0.6) - wx.windDir;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    wx.windDir += da * k;
    wx.lightning = num(src.lightning, 0);
    // Nässe: steigt bei Regen schnell, trocknet langsam (oder S4 liefert sie direkt)
    if (typeof src.wet === 'number') wx.wet += (clamp01(src.wet) - wx.wet) * k;
    else {
      const target = Math.max(wx.rain > 0.05 ? Math.min(1, 0.35 + wx.rain) : 0, wx.snowCover * 0.3);
      wx.wet += (target - wx.wet) * (snap ? 1 : 1 - Math.exp(-dt * (target > wx.wet ? 0.35 : 0.04)));
    }
    shared.uSnow.value = wx.snowCover;
    shared.uWet.value = wx.wet;
    shared.uRain.value = wx.rain;
    shared.uWind.value = wx.wind;
    shared.uWindDir.value = wx.windDir;
    shared.uSeason.value = wx.yearT;
    // Herbstfärbung: steigt im Herbst an, im Winter kahl/abgeklungen, im Frühling grün
    const t = wx.yearT;
    shared.uAutumn.value = t < 0.5 ? 0 : t < 0.72 ? smooth(0.5, 0.66, t) : 1 - smooth(0.8, 0.95, t);
  }

  // ---------- Sonne, Mond, Licht, Himmel, Nebel
  dayNight(hour, dt) {
    if (this.settings.alwaysDay) hour = 12.5;
    const wx = this.wx, L = this.light;
    const summer = Math.cos((wx.yearT - 0.375) * Math.PI * 2);
    const rise = 6.3 - 0.9 * summer, set = 19.9 + 0.9 * summer;
    const maxElev = (40 + 18 * summer) * (Math.PI / 180);
    const theta = hour >= rise && hour <= set
      ? (Math.PI * (hour - rise)) / (set - rise)
      : Math.PI + (Math.PI * (((hour - set) + 24) % 24)) / (24 - set + rise);
    const elev = theta <= Math.PI ? maxElev * Math.sin(theta) : 0.75 * Math.sin(theta);
    const dirOf = (th, el, out) => {
      const hx = -Math.cos(th), hz = 0.55 * Math.sin(th) + 0.32;
      const hl = Math.hypot(hx, hz) || 1;
      return out.set((hx / hl) * Math.cos(el), Math.sin(el), (hz / hl) * Math.cos(el));
    };
    dirOf(theta, elev, L.sunDir);
    const s = Math.sin(elev);
    L.sunElev = s;
    // Mond: Phase über 29,5 Spieltage, steht bei Vollmond der Sonne gegenüber
    const g = this.game;
    const phase = (((g.time / 1440) / 29.5) + 0.42) % 1;
    L.moonPhase = phase;
    const thM = theta - phase * Math.PI * 2;
    const elM = 0.85 * Math.sin(thM);
    dirOf(thM, elM, L.moonDir);
    const moonUp = smooth(-0.02, 0.15, Math.sin(elM));
    const illum = (1 - Math.cos(phase * Math.PI * 2)) / 2;

    const night = 1 - smooth(-0.1, 0.12, s);
    this.night = night;
    shared.uNight.value = night;
    const cloud = wx.cloud, storm = wx.storm;
    const overcast = smooth(0.45, 0.95, cloud);
    L.cloud = cloud; L.overcast = overcast;

    // Sonnenlicht
    const sunUp = smooth(-0.035, 0.06, s);
    sunLightColor(elev, L.sunColor);
    // Bei Schneedecke etwas mehr Sonne durch die Wolken: Schatten und Formen bleiben lesbar, die Welt wirkt nicht milchig-flach
    const snowCov = wx.snowCover || 0;
    const sunAtt = (1 - (0.82 - 0.3 * snowCov) * overcast) * (1 - 0.5 * storm) * (1 - 0.35 * wx.fog) * (1 - 0.25 * wx.rain);
    const sunI = 3.1 * sunUp * (0.45 + 0.55 * smooth(0.0, 0.35, s)) * sunAtt;
    // Nacht-Hauptlicht: Mond (oder heller Himmel, wenn der Mond fehlt)
    const moonKey = 0.12 + 0.3 * illum * moonUp;
    const nightI = moonKey * (1 - 0.7 * overcast) * night;
    const keyIsSun = sunI >= nightI * 1.2 || s > -0.02;
    const key = L.keyDir;
    if (keyIsSun) { key.copy(L.sunDir); if (key.y < 0.1) { key.y = 0.1; key.normalize(); } }
    else {
      key.copy(moonUp > 0.3 ? L.moonDir : this._fallbackMoon || (this._fallbackMoon = new THREE.Vector3(0.35, 0.8, -0.5).normalize()));
      if (key.y < 0.25) { key.y = 0.25; key.normalize(); }
    }
    if (key.y > 0.93) { key.y = 0.93; key.normalize(); }
    if (keyIsSun) { this.sun.color.copy(L.sunColor); this.sun.intensity = sunI; }
    else { this.sun.color.setRGB(0.62, 0.72, 1.0); this.sun.intensity = nightI; }
    L.dayLight = sunUp * sunAtt;

    // Himmel
    const st = this.skyState;
    const exposure = (1 + night * 0.4 + overcast * 0.12 * (1 - night) + wx.fog * 0.05) * (1 - 0.1 * snowCov * (1 - night));
    st.s = s; st.night = night; st.cloud = Math.max(cloud, storm * 0.95, wx.rain * 0.85, wx.snow * 0.8); st.storm = storm;
    st.flash = this.flash; st.time = this.time; st.exposure = exposure;
    st.sunColor.copy(L.sunColor).multiplyScalar(sunUp);
    st.moonVis = moonUp * night * (0.3 + 0.7 * illum);
    // Lichtglocke der Stadt (nachts, nach Bevölkerung)
    const pop = (g.stats && g.stats.pop) || 0;
    const glow = night * Math.min(1, 0.25 + pop / 20000) * (0.6 + 0.4 * cloud);
    st.cityGlow.setRGB(0.09, 0.055, 0.035).multiplyScalar(glow);
    const pal = this.sky.computePalette(s, st.cloud, storm);
    // Für andere Ansichten (Wasser, Umland): Himmelsfarben wie sie auf dem Bildschirm erscheinen (linear)
    this.skyTop.copy(pal.zen).multiplyScalar(1 / exposure);
    this.skyHor.copy(pal.hor).multiplyScalar(1 / exposure);
    this.skyBot.copy(pal.below).multiplyScalar(1 / exposure);
    // Boden für die Umgebungskarte: Gras/Stadt, beleuchtet
    const groundLum = 0.05 + 0.25 * sunUp * sunAtt + 0.03 * night;
    st.ground.setRGB(0.32, 0.36, 0.26).multiplyScalar(groundLum / exposure);
    this.sky.update(st, this.camera);
    this.sky.updateEnv(dt, false, st);

    // Himmelslicht (zusätzlich zur Umgebungskarte; nachts die Hauptquelle)
    const amb = L.ambient.copy(pal.zen).lerp(pal.hor, 0.5);
    this.hemi.color.copy(amb).lerp(new THREE.Color(1, 1, 1), 0.25);
    this.hemi.groundColor.setRGB(0.42, 0.36, 0.28).multiplyScalar(0.25 + 0.75 * sunUp);
    const hemiDay = (0.42 + 0.35 * overcast) * (1 - 0.18 * snowCov);
    const hemiNight = 0.34;
    this.hemi.intensity = (hemiDay * (1 - night) + hemiNight * night) * (1 + this.flash * 4);
    if (night > 0.5) { this.hemi.color.setRGB(0.42, 0.52, 0.85); this.hemi.groundColor.setRGB(0.16, 0.14, 0.16); }
    this.hemi.color.multiplyScalar(1 / Math.max(0.6, this.hemi.color.r * 0.3 + this.hemi.color.g * 0.6 + this.hemi.color.b * 0.1));

    // Nebel und Dunst (Atmosphäre in allen Materialien)
    const fog = this.scene.fog;
    // Bei Wetternebel neutrales, helles Grau statt Horizontfarbe (kein Sepia-Stich durch die Morgensonne)
    const wf = wx.fog;
    const mistLum = (0.12 + 0.6 * sunUp * (1 - 0.4 * overcast)) * (1 - 0.6 * night) + 0.02;
    _c3.setRGB(0.78, 0.8, 0.83).multiplyScalar(mistLum);
    fog.color.copy(pal.hor).lerp(_c3, Math.min(0.85, wf * 1.1)).multiplyScalar(1 / exposure);
    const dist = this.rig.cur.dist;
    fog.near = dist * 2.2 + 30; fog.far = dist * 6 + 200;
    atmo.fogA[0] = (0.0016 + 0.012 * wf + 0.0035 * wx.rain + 0.0018 * wx.snow + 0.002 * storm) * (1 - 0.35 * night);
    atmo.fogA[1] = 0.22 + 0.25 * wf;
    atmo.fogA[2] = 0;
    atmo.fogA[3] = 1;
    atmo.fogC[0] = 0.006 + 0.11 * wf + 0.01 * wx.rain;
    atmo.fogC[1] = Math.max(0, dist * (0.55 - 0.45 * wf));
    atmo.fogC[2] = 0.86 + 0.12 * wf;
    const sunSide = _c1.copy(pal.horSun).lerp(_c3, Math.min(0.9, wf * 1.2)).multiplyScalar(1 / exposure);
    atmo.fogSun[0] = sunSide.r; atmo.fogSun[1] = sunSide.g; atmo.fogSun[2] = sunSide.b;
    atmo.fogB[0] = L.sunDir.x; atmo.fogB[1] = L.sunDir.y; atmo.fogB[2] = L.sunDir.z;
    atmo.fogB[3] = 0.65 * sunUp * (1 - overcast * 0.8);

    // Wolkenschatten
    const coverShadow = Math.max(cloud, storm * 0.8);
    atmo.cloud[0] = this.shadowOff.x; atmo.cloud[1] = this.shadowOff.y;
    atmo.cloud[2] = 0.032;
    atmo.cloud[3] = 0.5 * smooth(0.08, 0.35, coverShadow) * (1 - smooth(0.7, 0.95, coverShadow)) * (keyIsSun ? sunUp : 0.6);
    atmo.cloudB[0] = 0.15 + 0.55 * coverShadow; atmo.cloudB[1] = 0.12; atmo.cloudB[2] = 30;
    atmo.cloudDir[0] = key.x; atmo.cloudDir[1] = key.y; atmo.cloudDir[2] = key.z;

    // Nachbearbeitung
    this.exposure = exposure;
    this.renderer.toneMappingExposure = exposure;
    if (this.post) {
      const p = this.post.params;
      p.exposure = exposure;
      // Bloom nur für echte Lichtquellen (Fenster, Laternen, Neon): Schwelle auch nachts hoch, damit Schnee, nasser Asphalt
      // und Laternen-Lichtflecken nicht zu großen weißen Wolken verschwimmen (auf echten Grafikkarten deutlich sichtbar)
      const snowK = (shared.uSnow && shared.uSnow.value) || 0;
      p.threshold = 1.8 - 0.4 * night + 0.35 * snowK;
      p.knee = 0.35;
      p.bloom = (0.18 + 0.2 * night) * (1 - 0.35 * snowK) * (this.quality.name === 'ultra' ? 1.1 : 1) * (this.fx ? this.fx.bloom : 1);
      p.aoRadius = Math.min(1.1, Math.max(0.1, dist * 0.011));
      p.aoIntensity = 1.0;
      p.aoStrength = (0.85 - 0.3 * night - 0.25 * overcast) * (this.fx ? this.fx.ao : 1);
      const golden = sunUp * (1 - smooth(0.05, 0.35, s));
      p.wb.setRGB(1.0 + 0.05 * golden, 1.0 + 0.005 * golden, 0.98 - 0.06 * golden);
      if (night > 0) p.wb.lerp(_c2.setRGB(0.93, 0.98, 1.08), night);
      p.contrast = 0.1 + 0.04 * (1 - overcast) - 0.03 * night + 0.06 * snowCov * (1 - night);
      p.saturation = 1.06 - 0.16 * overcast * (1 - 0.4 * snowCov) - 0.12 * night - 0.06 * wx.fog + 0.05 * snowCov;
      p.vignette = 0.22 + 0.1 * night;
      p.shadowTint.setRGB(0.02, 0.05 + 0.02 * snowCov, 0.12 + 0.08 * snowCov).multiplyScalar(1 - night * 0.5);
    }
    this.roads.setNight(night);
    if (this.overlay && this.overlay.setNight) this.overlay.setNight(night);
  }

  // Schatten eng an den sichtbaren Bereich koppeln; Mittelpunkt auf Texel einrasten (kein Flimmern beim Schwenken).
  fitShadow() {
    if (!this.sun.castShadow) return;
    const cam = this.camera, L = this.light.keyDir;
    const sc = this.sun.shadow.camera;
    const size0 = this.sun.shadow.mapSize.x;
    const dist = this.rig.cur.dist;
    const tMax = Math.min(220, Math.max(40, dist * 3.2));
    const u = _u.crossVectors(_up, L).normalize();
    const v = _v.crossVectors(L, u);
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity, minW = Infinity, maxW = -Infinity;
    const camPos = cam.position;
    const add = (p) => {
      const pu = p.dot(u), pv = p.dot(v), pw = p.dot(L);
      if (pu < minU) minU = pu; if (pu > maxU) maxU = pu;
      if (pv < minV) minV = pv; if (pv > maxV) maxV = pv;
      if (pw < minW) minW = pw;
      _p2.copy(p); _p2.y += 14; const tw = _p2.dot(L); if (tw > maxW) maxW = tw;
    };
    for (const [nx, ny] of CORNERS) {
      _p.set(nx, ny, 0.5).unproject(cam).sub(camPos).normalize();
      for (const h of [0, 7]) {
        let t = _p.y < -1e-4 ? (h - camPos.y) / _p.y : Infinity;
        if (t < 0) t = 0;
        t = Math.min(t, tMax);
        _p3.copy(camPos).addScaledVector(_p, t);
        _p3.y = Math.min(_p3.y, h);
        add(_p3);
      }
    }
    // Bereich um das Ziel immer abdecken
    const tg = this.rig.target;
    for (const [dx, dz] of [[-6, -6], [6, -6], [6, 6], [-6, 6]]) { _p3.set(tg.x + dx, 0, tg.z + dz); add(_p3); }
    let size = Math.max(maxU - minU, maxV - minV) * 1.04 + 2;
    size = Math.pow(2, Math.ceil(Math.log2(size) * 6) / 6);
    const texel = size / size0;
    let cu = (minU + maxU) / 2, cv = (minV + maxV) / 2;
    cu = Math.round(cu / texel) * texel; cv = Math.round(cv / texel) * texel;
    // Tiefenbereich in groben Stufen, damit er nicht bei jedem Bild springt
    const back = Math.ceil((maxW + 4) / 4) * 4;
    const far = Math.ceil((back - minW + 4) / 4) * 4;
    this.sun.position.set(0, 0, 0).addScaledVector(u, cu).addScaledVector(v, cv).addScaledVector(L, back);
    this.sun.target.position.copy(this.sun.position).sub(L);
    this.sun.target.updateMatrixWorld();
    const half = size / 2;
    const key = `${cu.toFixed(4)},${cv.toFixed(4)},${half},${back},${far}`;
    if (sc.right !== half || sc.far !== far) {
      sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half;
      sc.near = 0.5; sc.far = far;
      sc.updateProjectionMatrix();
    }
    const range = sc.far - sc.near;
    this.sun.shadow.normalBias = texel * 1.4;
    this.sun.shadow.bias = -Math.min(0.0012, 0.03 / range);
    // Schattenkarte nur neu zeichnen, wenn sich Ausschnitt oder Lichtrichtung geändert haben –
    // sonst nur jedes n-te Bild (bewegte Fahrzeuge). Spart Draw Calls und Füllrate.
    const sh = this.renderer.shadowMap;
    this.shadowAge = (this.shadowAge || 0) + 1;
    const lightMoved = !this._shadowL || this._shadowL.dot(L) < 0.999994;
    if (key !== this._shadowKey || lightMoved || this.shadowAge >= (this.quality.shadowEvery || 1)) {
      sh.needsUpdate = true;
      this.shadowAge = 0;
      this._shadowKey = key;
      (this._shadowL || (this._shadowL = new THREE.Vector3())).copy(L);
    }
  }

  // Vertrag V1: Untergrund-Ansicht der Pulsbahn ein-/ausschalten (weich überblendet)
  setUnderground(on) { if (this.underground) this.underground.setActive(on); }
  get undergroundActive() { return !!(this.underground && this.underground.on); }

  // Ruht die Kamera? (sichtbare Qualitätswechsel nur dann)
  cameraCalm() {
    const rig = this.rig, c = rig.cur, g = rig.goal;
    if (rig.drag || rig.pinching || (rig.touches && rig.touches.size) || rig.flight || rig.keys.size) return false;
    const tol = c.dist * 0.012;
    return Math.abs(g.dist - c.dist) < tol && Math.hypot(g.x - c.x, g.z - c.z) < tol && Math.abs(g.yaw - c.yaw) < 0.01 && Math.abs(g.pitch - c.pitch) < 0.01;
  }

  // Laufende Regelung der Stufe „Automatisch": Bildabstand messen, Stufe nachführen
  autoFrame(intervalMs, now) {
    if (!this.gov || this.rawSettings.quality !== 'auto') return;
    let skip = this.throttled || this.warming || (this.slow && !this.forceGovern) || (typeof document !== 'undefined' && document.hidden) || this.photoActive;
    if (this._probeSkip > 0) { this._probeSkip--; skip = true; }
    const changed = this.gov.sample(intervalMs, this.busyMs || 0, { now, calm: this.cameraCalm(), skip });
    if (changed) { this.applyQuality(); this.settingsKey = this.qualityKey(); }
  }

  // Weiche Blenden für Umgebungsverdeckung und Leuchten; abgeschaltet wird der Durchgang erst am Ende der Blende
  fxFrame(dt) {
    const fx = this.fx;
    if (!fx) return;
    const k = this.slow ? 1 : Math.min(1, dt / 0.8);
    fx.ao += Math.max(-k, Math.min(k, fx.aoT - fx.ao));
    fx.bloom += Math.max(-k, Math.min(k, fx.bloomT - fx.bloom));
    const c = this.post && this.post.cfg;
    if (c && fx.aoT === 0 && fx.ao <= 0.001 && c.ao) this.post.configure({ ao: false });
    if (c && fx.bloomT === 0 && fx.bloom <= 0.001 && c.bloom) this.post.configure({ bloom: false });
  }

  // Vorwärmen hinter dem Ladebildschirm (main.js setzt warming): Nahstufen rund um den Kamerazielpunkt bauen, die Kamera
  // wartet so lange. Höchstens ~2 s; danach übernimmt das normale Zeitbudget.
  warmFrame(now) {
    if (!this.warming) return;
    // nach dem Vorübersetzen noch zwei Bilder hinter dem Ladebildschirm zeichnen (Shader binden, Puffer hochladen)
    if (this._warmTail !== undefined) {
      if (this._pcWait && now - (this._pcT0 || now) < 4000) return; // Shader werden noch übersetzt
      if (--this._warmTail <= 0) {
        this.warming = false;
        this._warmTail = undefined;
        if (this.onWarmDone) { try { this.onWarmDone(); } catch (e) { /* egal */ } }
      }
      return;
    }
    const bv = this.buildings;
    let p, more;
    if (bv.initial) {
      // Erstaufbau der Fernstufe läuft (BuildingView.frame, Zeitscheiben)
      p = 0.8 * (bv.initialTotal ? 1 - bv.queue.size / bv.initialTotal : 1);
      more = true;
      if (this.onWarm) { try { this.onWarm(p, `Gebäude werden errichtet · ${bv.initialTotal - bv.queue.size} von ${bv.initialTotal}`); } catch (e) { /* egal */ } }
      return;
    }
    if (!this._warm0) this._warm0 = now;
    more = !this.slow && bv.warm(18);
    p = 0.8 + 0.2 * bv.warmProgress();
    if (this.onWarm) { try { this.onWarm(p, 'Gebäude in der Nähe werden fein ausgearbeitet'); } catch (e) { /* egal */ } }
    if (!more || now - this._warm0 > 2000) {
      this._pcT0 = now;
      this.precompile();
      this._warmTail = 2;
      if (this.onWarm) { try { this.onWarm(1, 'Licht, Schatten und Leben'); } catch (e) { /* egal */ } }
    }
  }

  // Shader vorab übersetzen: alles in der Szene sowie die Gebäudematerialien als Instanz- und Bündelvariante und die
  // Blendmaterialien der Straßen und Pflanzen – sonst stockt das erste Bild, in dem eine neue Variante erscheint.
  // full: zusätzlich die ganze Szene (auch ausgeblendete Meshes) – teuer, nur hinter dem Ladebildschirm
  precompile(full = true) {
    const t0 = performance.now();
    const done = this._pcMats || (this._pcMats = new WeakSet());
    try {
      const tmp = new THREE.Scene();
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 2));
      const add = (mat, inst, color = false) => {
        const m = inst ? new THREE.InstancedMesh(geo, mat, 1) : new THREE.Mesh(geo, mat);
        if (inst && color) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3), 3);
        m.castShadow = m.receiveShadow = true;
        tmp.add(m);
      };
      for (const { mat } of g9Materials()) if (!done.has(mat)) { done.add(mat); add(mat, true); add(mat, false); }
      const fm = this.roads && this.roads.fadeMats;
      if (fm) for (const m of Object.values(fm)) { add(m, true); add(m, true, true); }
      const veg = this.terrain && this.terrain.veg;
      if (veg && veg.lodMats) { for (const set of veg.lodMats) for (const m of Object.values(set)) add(m, true, true); if (veg.grassMat) add(veg.grassMat, true, true); }
      // Schattenprogramme (Tiefenmaterialien) lassen sich mit compile() nicht passend vorbereiten (anderer Zustand
      // im Schattendurchgang): stattdessen für ein Bild entartete Probe-Meshes (keine Fläche) in die Szene hängen,
      // die echte Schattendurchgang übersetzt dann genau die richtigen Programme
      if (this.renderer.shadowMap.enabled && !this._pcDepth) {
        this._pcDepth = true;
        const probe = new THREE.Group();
        const base = g9Materials()[0];
        const pm = (mat, depth, inst, color = false) => {
          const m = inst ? new THREE.InstancedMesh(geo2, mat, 1) : new THREE.Mesh(geo2, mat);
          if (inst && color) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3), 3);
          m.customDepthMaterial = depth; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
          probe.add(m);
        };
        const geo2 = geo.clone();
        if (base) for (const anim of [false, true]) { pm(base.mat, g9DepthMaterial(anim), true); pm(base.mat, g9DepthMaterial(anim), false); }
        if (veg && veg.depthMats && veg.lodMats) for (const m of Object.values(veg.depthMats)) { pm(veg.lodMats[0].solid, m, true, true); pm(veg.mats.solid, m, true, true); }
        if (this.roads && this.roads.fadeDepth) { pm(this.roads.fadeMats.detail, this.roads.fadeDepth, true); pm(this.roads.fadeMats.detail, this.roads.fadeDepth, true, true); }
        this.scene.add(probe);
        this._pcProbe = { group: probe, geo: geo2, frames: 2 };
        this.renderer.shadowMap.needsUpdate = true;
      }
      const r = this.renderer, before = r.info.programs.length;
      // Wie beim echten Zeichnen ins HDR-Ziel der Nachbearbeitung übersetzen (Tonwert und Farbraum gehören zum
      // Programm – sonst entstünden Varianten für den Bildschirm, und beim ersten Bild würde trotzdem übersetzt)
      const prevRT = r.getRenderTarget();
      if (this.post) { if (!this.post.sceneRT) this.post.allocate(); r.setRenderTarget(this.post.sceneRT); }
      else r.setRenderTarget(null);
      if (r.compileAsync) {
        // parallel übersetzen lassen (KHR_parallel_shader_compile); hinter dem Ladebildschirm wird darauf gewartet
        const jobs = [r.compileAsync(tmp, this.camera, this.scene)];
        if (full) jobs.push(r.compileAsync(this.scene, this.camera));
        const wait = Promise.all(jobs).then(() => { if (this._pcWait === wait) this._pcWait = null; }, () => { if (this._pcWait === wait) this._pcWait = null; });
        this._pcWait = wait;
      } else r.compile(tmp, this.camera, this.scene);
      r.setRenderTarget(prevRT);
      this._pcNew = r.info.programs.length - before;
      geo.dispose();
    } catch (e) { console.warn('Cityscapes: Vorübersetzen der Shader fehlgeschlagen', e); }
    const ms = performance.now() - t0;
    if (full && this.loadTimes) this.loadTimes.precompile = Math.round(ms);
    return ms;
  }

  // Im Spiel: neu hinzugekommene Materialien (neue Gebäudearten, Blendmaterialien) bei ruhender Kamera vorübersetzen,
  // bevor sie zum ersten Mal ins Bild kommen
  precompileIdle(now) {
    if (this.warming || now < (this._pcT || 0)) return;
    // nur, wenn neue Gebäudematerialien dazugekommen sind (sonst nichts zu tun)
    const n = g9Materials().length;
    if (n === this._pcCount && this._pcDepth) { this._pcT = now + 1000; return; }
    if (!this.cameraCalm() && now - (this._pcLast || 0) < 4000) { this._pcT = now + 300; return; }
    this._pcCount = n;
    this._pcLast = now;
    const ms = this.precompile(false);
    this._pcT = now + (ms > 25 ? 8000 : 1500);
  }

  frame(dt, simDt) {
    this.time += dt;
    this.frameNo++;
    // Echte Bildzeit messen: sehr langsame Systeme (Software-WebGL) bekommen keine Überblendungen
    const now = performance.now();
    const interval = this._lastNow ? now - this._lastNow : 0;
    if (this._lastNow) this.realDt = this.realDt * 0.7 + Math.min(5, interval / 1000) * 0.3;
    this._lastNow = now;
    this.slow = this.realDt > 0.25;
    this.rig.slow = this.slow;
    this.autoFrame(interval, now);
    this.fxFrame(dt);
    this.warmFrame(now);
    if (this.frameNo > 30 && !this.slow) this.precompileIdle(now);
    this.renderer.info.reset();
    shared.uTime.value = this.time;
    const g = this.game;
    const d = this.dirty;
    // Einstellungen live übernehmen
    this.settingsTimer -= dt;
    if (this.settingsTimer <= 0) {
      this.settingsTimer = 0.5;
      const k = this.qualityKey();
      if (k !== this.settingsKey) { this.settingsKey = k; this.applyQuality(); }
    }
    if (d.roads) { this.roads.rebuild(); d.roads = false; if (this.overlay.mode === 'traffic') this.roads.setTrafficTint(true); }
    if (d.trees) { this.terrain.refreshTrees(); d.trees = false; }
    if (d.zones) { this.overlay.refreshZones(); d.zones = false; }
    if (d.terrainColors) { this.terrain.refreshColors(); d.terrainColors = false; }
    this.overlayTimer -= dt;
    if (d.overlay && this.overlay.mode !== 'none' && this.overlayTimer <= 0) { this.overlay.refresh(); d.overlay = false; this.overlayTimer = 0.6; }

    this.rig.update(this.warming ? 0 : dt);
    this.updateWeather(dt);
    // Wolken ziehen mit dem Wind (auch langsam, wenn das Spiel pausiert)
    const wspd = (0.15 + this.wx.wind * 0.9) * (dt * 0.35 + simDt * 0.65);
    const wdx = Math.cos(this.wx.windDir), wdz = Math.sin(this.wx.windDir);
    this.cloudOff.x += wdx * wspd * 0.012; this.cloudOff.y += wdz * wspd * 0.012;
    this.shadowOff.x -= wdx * wspd * 0.05; this.shadowOff.y -= wdz * wspd * 0.05;
    this.dayNight(g.hour(), dt);
    this.fitShadow();

    const night = this.night;
    this.buildings.frame(dt, this.time, night);
    this.effects.beginLights();
    this.effects.addLampLights(this.roads.lampPositions, night);
    this.effects.addFireLights();
    this.vehicles.frame(this.time, night, this.effects.lights);
    this.effects.endLights();
    this.transit.frame(this.time, night);
    this.underground.frame(dt, this.time, night);
    // Problem-Symbole treten in der Untergrund-Ansicht zurück
    if (this.effects.icons) this.effects.icons.visible = !(this.underground.kv > 0.5);
    this.effects.frame(dt, simDt, this.time, night);
    // Eine fehlerhafte Ansicht darf das Bild nicht verhindern (Fehler je Ansicht nur einmal melden)
    for (const v of this.views) {
      if (!v.frame) continue;
      try { v.frame(dt, simDt, this.time, night); } catch (e) {
        if (!v.__g1err) { v.__g1err = true; console.error('Ansicht', v.constructor && v.constructor.name, e); }
      }
    }

    const r = this.renderer;
    // Während des Aufbaus hinter dem Ladebildschirm nicht zeichnen (Zeit gehört dem Aufbau; der Schirm deckt alles ab)
    if (this.warming && this.buildings.initial) return;
    // Messbild der Regelung „Automatisch" (etwa jede Sekunde): auf die GPU warten, dann Zeichnen + GPU-Zeit messen
    const probe = this.gov && this.rawSettings.quality === 'auto' && !this.throttled && !this.warming && (!this.slow || this.forceGovern) && this.gov.wantProbe(now, this.cameraCalm());
    let gl = null, pt0 = 0;
    if (probe) { gl = r.getContext(); try { gl.finish(); } catch (e) { /* egal */ } pt0 = performance.now(); }
    // Untergrund-Ansicht (U-Bahn) als zweiter Durchgang über der Oberwelt, bei Nachbearbeitung noch vor Bloom/Tonwert
    const ug = this.underground;
    if (this.post) this.post.render(this.scene, this.camera, ug.kv > 0.002 ? this._ugPass || (this._ugPass = (rr) => ug.render(rr, this.camera)) : null);
    else { r.setRenderTarget(null); r.render(this.scene, this.camera); ug.render(r, this.camera); }
    if (this.hud.children.length) {
      const ac = r.autoClear;
      r.autoClear = false;
      r.setRenderTarget(null);
      r.clearDepth();
      const tm = r.toneMapping;
      r.toneMapping = THREE.NoToneMapping;
      r.render(this.hud, this.camera);
      r.toneMapping = tm;
      r.autoClear = ac;
    }
    if (probe) {
      try { gl.finish(); } catch (e) { /* egal */ }
      this.gov.probe(performance.now() - pt0);
      this._probeSkip = 2; // Abstand des Messbilds und des nächsten nicht als Bildrate werten
    }
    // Probe-Meshes für Schattenprogramme nach ihren Bildern wieder entfernen
    const pr = this._pcProbe;
    if (pr && --pr.frames <= 0) {
      this.scene.remove(pr.group); pr.geo.dispose();
      for (const m of pr.group.children) if (m.dispose) m.dispose();
      this._pcProbe = null;
    }
  }
}

const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]];
const _up = new THREE.Vector3(0, 1, 0);
const _u = new THREE.Vector3(), _v = new THREE.Vector3(), _p = new THREE.Vector3(), _p2 = new THREE.Vector3(), _p3 = new THREE.Vector3();
const _c1 = new THREE.Color(), _c2 = new THREE.Color(), _c3 = new THREE.Color();
