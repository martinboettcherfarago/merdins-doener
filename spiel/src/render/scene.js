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
//   engine.quality            aufgelöstes Qualitätsprofil (siehe QUALITY)
//   engine.shake(stärke)      Kamerawackeln (Katastrophen)
// Qualität: settings.quality = low|medium|high|ultra; settings.postfx/ao/bloom (bool) und settings.shadows (off|low|high)
// überschreiben einzelne Teile. Änderungen an settings werden live übernommen.
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
import { EffectsView } from './effects.js';
import { VIEWS } from '../registry.js';

export const QUALITY = {
  low: { pr: 1, post: false, msaa: 0, ao: false, aoSamples: 6, aoHalf: true, bloom: false, bloomLevels: 4, shadow: 0, shadowEvery: 3, weather: 0.4 },
  medium: { pr: 1.5, post: true, msaa: 4, ao: true, aoSamples: 10, aoHalf: true, bloom: true, bloomLevels: 5, shadow: 2048, shadowEvery: 2, weather: 0.7 },
  high: { pr: 2, post: true, msaa: 4, ao: true, aoSamples: 12, aoHalf: true, bloom: true, bloomLevels: 6, shadow: 4096, shadowEvery: 1, weather: 1 },
  ultra: { pr: 2, post: true, msaa: 8, ao: true, aoSamples: 16, aoHalf: false, bloom: true, bloomLevels: 6, shadow: 4096, shadowEvery: 1, weather: 1.3 },
};

export function resolveQuality(settings = {}) {
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
  constructor(canvas, game, settings) {
    this.canvas = canvas;
    this.game = game;
    this.settings = settings;
    this.quality = resolveQuality(settings);
    const q = this.quality;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !q.post, powerPreference: 'high-performance', stencil: false });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.CustomToneMapping; // „Neutral“, siehe materials.js
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = q.shadow > 0;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false; // gezielt aktualisiert, siehe fitShadow()
    renderer.info.autoReset = false;
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

    this.terrain = new TerrainView(this);
    this.roads = new RoadView(this);
    this.buildings = new BuildingView(this);
    this.vehicles = new VehicleView(this);
    this.transit = new TransitView(this);
    this.overlay = new OverlayView(this);
    this.effects = new EffectsView(this);
    this.views = [];
    for (const V of VIEWS) { try { this.views.push(new V(this)); } catch (e) { console.error('Ansicht fehlgeschlagen', V.name, e); } }

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
    const s = this.settings || {};
    return [s.quality, s.postfx, s.ao, s.bloom, s.shadows].join('|');
  }

  // Qualitätsprofil anwenden (beim Start und wenn sich settings ändern).
  applyQuality(initial = false) {
    const q = resolveQuality(this.settings);
    // Ohne Kantenglättung im Kontext auch bei „niedrig“ den schlanken HDR-Weg nehmen (MSAA im Puffer)
    const ctxAA = this.renderer.getContextAttributes ? !!(this.renderer.getContextAttributes() || {}).antialias : true;
    const usePost = this.canPost && (q.post || !ctxAA);
    if (!q.post && usePost) { q.ao = false; q.bloom = false; q.msaa = 4; }
    this.quality = q;
    this.usePost = usePost;
    const r = this.renderer;
    if (usePost) {
      const cfg = { msaa: q.msaa, ao: q.ao, aoSamples: q.aoSamples, aoHalf: q.aoHalf, bloom: q.bloom, bloomLevels: q.bloomLevels, dof: !!this.dofEnabled };
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
    const sunAtt = (1 - 0.82 * overcast) * (1 - 0.5 * storm) * (1 - 0.35 * wx.fog) * (1 - 0.25 * wx.rain);
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
    const exposure = 1 + night * 0.4 + overcast * 0.12 * (1 - night) + wx.fog * 0.05;
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
    const hemiDay = 0.42 + 0.35 * overcast;
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
    atmo.fogA[0] = (0.0016 + 0.012 * wf + 0.0035 * wx.rain + 0.003 * wx.snow + 0.002 * storm) * (1 - 0.35 * night);
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
      p.threshold = 1.7 - 0.95 * night;
      p.knee = 0.6;
      p.bloom = (0.22 + 0.6 * night) * (this.quality.name === 'ultra' ? 1.1 : 1);
      p.aoRadius = Math.min(1.1, Math.max(0.1, dist * 0.011));
      p.aoIntensity = 1.0;
      p.aoStrength = 0.85 - 0.3 * night - 0.25 * overcast;
      const golden = sunUp * (1 - smooth(0.05, 0.35, s));
      p.wb.setRGB(1.0 + 0.05 * golden, 1.0 + 0.005 * golden, 0.98 - 0.06 * golden);
      if (night > 0) p.wb.lerp(_c2.setRGB(0.93, 0.98, 1.08), night);
      p.contrast = 0.1 + 0.04 * (1 - overcast) - 0.03 * night;
      p.saturation = 1.06 - 0.16 * overcast - 0.12 * night - 0.06 * wx.fog;
      p.vignette = 0.22 + 0.1 * night;
      p.shadowTint.setRGB(0.02, 0.05, 0.12).multiplyScalar(1 - night * 0.5);
    }
    this.roads.setNight(night);
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

  frame(dt, simDt) {
    this.time += dt;
    this.frameNo++;
    // Echte Bildzeit messen: sehr langsame Systeme (Software-WebGL) bekommen keine Überblendungen
    const now = performance.now();
    if (this._lastNow) this.realDt = this.realDt * 0.7 + Math.min(5, (now - this._lastNow) / 1000) * 0.3;
    this._lastNow = now;
    this.slow = this.realDt > 0.25;
    this.rig.slow = this.slow;
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

    this.rig.update(dt);
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
    this.effects.frame(dt, simDt, this.time, night);
    // Eine fehlerhafte Ansicht darf das Bild nicht verhindern (Fehler je Ansicht nur einmal melden)
    for (const v of this.views) {
      if (!v.frame) continue;
      try { v.frame(dt, simDt, this.time, night); } catch (e) {
        if (!v.__g1err) { v.__g1err = true; console.error('Ansicht', v.constructor && v.constructor.name, e); }
      }
    }

    const r = this.renderer;
    if (this.post) this.post.render(this.scene, this.camera);
    else { r.setRenderTarget(null); r.render(this.scene, this.camera); }
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
  }
}

const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]];
const _up = new THREE.Vector3(0, 1, 0);
const _u = new THREE.Vector3(), _v = new THREE.Vector3(), _p = new THREE.Vector3(), _p2 = new THREE.Vector3(), _p3 = new THREE.Vector3();
const _c1 = new THREE.Color(), _c2 = new THREE.Color(), _c3 = new THREE.Color();
