// Render-Engine: Szene, Himmel, Tag/Nacht, Schatten, Verknüpfung von Simulation und Ansichten.
import * as THREE from 'three';
import { shared } from './materials.js';
import { CameraRig } from './camera.js';
import { TerrainView } from './terrain.js';
import { RoadView } from './roads.js';
import { BuildingView } from './buildings.js';
import { VehicleView, TransitView } from './agents.js';
import { OverlayView } from './overlay.js';
import { EffectsView } from './effects.js';
import { VIEWS } from '../registry.js';

const KEYS = [
  [0, 0x0c1430, 0x1f2a4a, 0x0a0f22],
  [4.3, 0x111b3d, 0x2b3557, 0x0a0f22],
  [5.1, 0x3a4f80, 0xb98a8e, 0x1a1a2a],
  [6.0, 0x7fb2dd, 0xf6caa0, 0x6a6a72],
  [7.8, 0x86c3ea, 0xe8f1ec, 0x8aa0a8],
  [18.2, 0x86c3ea, 0xe8f1ec, 0x8aa0a8],
  [19.7, 0x6a8fca, 0xf6b183, 0x6a6070],
  [20.6, 0x34417a, 0xc27a7c, 0x2a2232],
  [21.6, 0x141d40, 0x37406a, 0x0a0f22],
  [24, 0x0c1430, 0x1f2a4a, 0x0a0f22],
];

function skyAt(h, top, hor, bot) {
  for (let k = 0; k < KEYS.length - 1; k++) {
    const a = KEYS[k], b = KEYS[k + 1];
    if (h >= a[0] && h <= b[0]) {
      const t = (h - a[0]) / (b[0] - a[0]);
      top.setHex(a[1]).lerp(new THREE.Color(b[1]), t);
      hor.setHex(a[2]).lerp(new THREE.Color(b[2]), t);
      bot.setHex(a[3]).lerp(new THREE.Color(b[3]), t);
      return;
    }
  }
}

export class Engine {
  constructor(canvas, game, settings) {
    this.canvas = canvas;
    this.game = game;
    this.settings = settings;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.quality === 'low' ? 1 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = settings.quality !== 'low';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = renderer;
    const scene = new THREE.Scene();
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.3, 1200);
    this.rig = new CameraRig(this.camera, canvas, game.W);
    const hx = game.world.highway[game.world.highway.length - 1] % game.W;
    this.rig.focus(hx + 10 - game.W / 2, game.world.highwayY - game.H / 2, 30);
    this.rig.cur = { ...this.rig.goal, dist: 70, yaw: 0.2 };

    // Himmel
    this.skyTop = new THREE.Color(); this.skyHor = new THREE.Color(); this.skyBot = new THREE.Color();
    const skyMat = new THREE.ShaderMaterial({
      uniforms: { top: { value: this.skyTop }, hor: { value: this.skyHor }, bot: { value: this.skyBot } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 bot; varying vec3 vP;
void main(){ float y = vP.y; vec3 c = y > 0.0 ? mix(hor, top, pow(min(1.0, y * 1.6), 0.7)) : mix(hor, bot, min(1.0, -y * 2.5));
gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), skyMat);
    this.sky.renderOrder = -10;
    scene.add(this.sky);
    // Sterne
    const starGeo = new THREE.BufferGeometry();
    const sp = [];
    for (let i = 0; i < 900; i++) {
      const u = Math.random() * Math.PI * 2, v = Math.acos(Math.random() * 0.9);
      sp.push(Math.sin(v) * Math.cos(u) * 700, Math.cos(v) * 700, Math.sin(v) * Math.sin(u) * 700);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    scene.add(this.stars);

    scene.fog = new THREE.Fog(0xe8f1ec, 120, 420);
    this.hemi = new THREE.HemisphereLight(0xdfeeff, 0x6b5a45, 1.0);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(settings.quality === 'high' ? 4096 : 2048, settings.quality === 'high' ? 4096 : 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun);
    scene.add(this.sun.target);

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
    this.resize();
    window.addEventListener('resize', () => this.resize());
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
    for (const v of this.views) if (v.dispose) { try { v.dispose(); } catch (e) { console.error(e); } }
    this.renderer.dispose();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.effects && (this.effects.lights.points.material.uniforms.uScale.value = h * 0.9);
    if (this.effects) {
      this.effects.smokeBuf.points.material.uniforms.uScale.value = h * 0.9;
      this.effects.fireBuf.points.material.uniforms.uScale.value = h * 0.9;
    }
  }

  pickTile(clientX, clientY) {
    const p = this.rig.groundAt(clientX, clientY);
    if (!p) return null;
    const g = this.game;
    const x = Math.floor(p.x + g.W / 2), y = Math.floor(p.z + g.H / 2);
    if (x < 0 || y < 0 || x >= g.W || y >= g.H) return { x, y, i: -1, wx: p.x, wz: p.z, out: true };
    return { x, y, i: y * g.W + x, wx: p.x, wz: p.z };
  }

  dayNight(hour) {
    if (this.settings.alwaysDay) hour = 12;
    const theta = ((hour - 5.4) / 15.4) * Math.PI;
    const elev = Math.sin(theta);
    const night = 1 - Math.max(0, Math.min(1, (elev + 0.08) / 0.3));
    this.night = night;
    shared.uNight.value = night;
    skyAt(hour, this.skyTop, this.skyHor, this.skyBot);
    this.scene.fog.color.copy(this.skyHor);
    const t = this.rig.target;
    let dir;
    if (elev > -0.05) dir = new THREE.Vector3(-Math.cos(theta), Math.max(0.12, elev), 0.45).normalize();
    else dir = new THREE.Vector3(Math.cos(theta) * 0.5, 0.75, -0.35).normalize();
    const span = Math.min(90, Math.max(18, this.rig.cur.dist * 1.15));
    this.sun.position.copy(t).addScaledVector(dir, 80);
    this.sun.target.position.copy(t);
    const sc = this.sun.shadow.camera;
    if (sc.right !== span) {
      sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 1; sc.far = 220;
      sc.updateProjectionMatrix();
    }
    const dayI = Math.max(0, elev);
    const warm = 1 - Math.min(1, elev / 0.45);
    if (elev > -0.05) {
      this.sun.color.setRGB(1, 0.93 - warm * 0.25, 0.85 - warm * 0.45);
      this.sun.intensity = 0.4 + dayI * 2.4;
    } else {
      this.sun.color.setRGB(0.6, 0.7, 1.0);
      this.sun.intensity = 0.75;
    }
    this.hemi.intensity = 0.75 + (1 - night) * 0.6;
    if (night > 0.5) this.hemi.color.setHex(0x7d8fc4); else this.hemi.color.copy(this.skyTop).lerp(new THREE.Color(0xffffff), 0.55);
    this.hemi.groundColor.setHex(night > 0.5 ? 0x2a2a3e : 0x6b5a45);
    this.stars.material.opacity = night * 0.9;
    this.renderer.toneMappingExposure = 1.0 + night * 0.25;
    this.roads.setNight(night);
  }

  frame(dt, simDt) {
    this.time += dt;
    shared.uTime.value = this.time;
    const g = this.game;
    const d = this.dirty;
    if (d.roads) { this.roads.rebuild(); d.roads = false; if (this.overlay.mode === 'traffic') this.roads.setTrafficTint(true); }
    if (d.trees) { this.terrain.refreshTrees(); d.trees = false; }
    if (d.zones) { this.overlay.refreshZones(); d.zones = false; }
    if (d.terrainColors) { this.terrain.refreshColors(); d.terrainColors = false; }
    this.overlayTimer -= dt;
    if (d.overlay && this.overlay.mode !== 'none' && this.overlayTimer <= 0) { this.overlay.refresh(); d.overlay = false; this.overlayTimer = 0.6; }

    this.rig.update(dt);
    this.dayNight(g.hour());
    this.sky.position.copy(this.camera.position);
    this.stars.position.copy(this.camera.position);
    const dist = this.rig.cur.dist;
    this.scene.fog.near = dist * 2.2 + 30;
    this.scene.fog.far = dist * 6 + 200;

    const night = this.night;
    this.buildings.frame(dt, this.time, night);
    this.effects.beginLights();
    this.effects.addLampLights(this.roads.lampPositions, night);
    this.effects.addFireLights();
    this.vehicles.frame(this.time, night, this.effects.lights);
    this.effects.endLights();
    this.transit.frame(this.time, night);
    this.effects.frame(dt, simDt, this.time, night);
    for (const v of this.views) if (v.frame) v.frame(dt, simDt, this.time, night);
    this.renderer.render(this.scene, this.camera);
  }
}
