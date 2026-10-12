// Partikel (Rauch, Dampf, Feuer, Baustaub), Problem-Symbole über Gebäuden, nächtliche Lichter.
import * as THREE from 'three';
import { makeGlowTexture, makePointsMaterial, PointBuffer } from './materials.js';

function makeSmokeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(32, 32, 30, 0, Math.PI * 2); ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Symbol-Atlas 4×2: Strom, Wasser, Müll, Feuer, Keine Straße, Unglücklich, Verlassen, Überfüllt
function makeIconAtlas() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = S * 4; c.height = S * 2;
  const ctx = c.getContext('2d');
  const badge = (cx, cy, col) => {
    ctx.fillStyle = 'rgba(20,24,32,0.85)';
    ctx.beginPath(); ctx.arc(cx, cy, 54, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(cx, cy, 50, 0, Math.PI * 2); ctx.stroke();
  };
  const cell = (i) => [(i % 4) * S + S / 2, Math.floor(i / 4) * S + S / 2];
  // 0 Strom
  let [x, y] = cell(0); badge(x, y, '#f2c230');
  ctx.fillStyle = '#f2c230';
  ctx.beginPath(); ctx.moveTo(x + 6, y - 36); ctx.lineTo(x - 18, y + 4); ctx.lineTo(x - 2, y + 4); ctx.lineTo(x - 8, y + 36); ctx.lineTo(x + 18, y - 6); ctx.lineTo(x + 2, y - 6); ctx.closePath(); ctx.fill();
  // 1 Wasser
  [x, y] = cell(1); badge(x, y, '#3fa0e0');
  ctx.fillStyle = '#5ab7f0';
  ctx.beginPath(); ctx.moveTo(x, y - 34); ctx.bezierCurveTo(x + 30, y, x + 24, y + 30, x, y + 30); ctx.bezierCurveTo(x - 24, y + 30, x - 30, y, x, y - 34); ctx.fill();
  // 2 Müll
  [x, y] = cell(2); badge(x, y, '#b98a4a');
  ctx.fillStyle = '#d7a35c';
  ctx.fillRect(x - 20, y - 14, 40, 44); ctx.fillRect(x - 26, y - 24, 52, 8); ctx.fillRect(x - 8, y - 32, 16, 8);
  // 3 Feuer
  [x, y] = cell(3); badge(x, y, '#ff7a2a');
  ctx.fillStyle = '#ff8a2a';
  ctx.beginPath(); ctx.moveTo(x, y - 36); ctx.bezierCurveTo(x + 30, y - 6, x + 26, y + 32, x, y + 32); ctx.bezierCurveTo(x - 26, y + 32, x - 28, y + 2, x - 8, y - 12); ctx.bezierCurveTo(x - 6, y, x + 4, y - 14, x, y - 36); ctx.fill();
  ctx.fillStyle = '#ffd34a';
  ctx.beginPath(); ctx.arc(x, y + 16, 11, 0, Math.PI * 2); ctx.fill();
  // 4 Keine Straße
  [x, y] = cell(4); badge(x, y, '#e5483c');
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(x - 14, y - 30); ctx.lineTo(x - 20, y + 30); ctx.moveTo(x + 14, y - 30); ctx.lineTo(x + 20, y + 30); ctx.stroke();
  ctx.strokeStyle = '#e5483c'; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(x - 30, y - 30); ctx.lineTo(x + 30, y + 30); ctx.stroke();
  // 5 Unglücklich
  [x, y] = cell(5); badge(x, y, '#e5483c');
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(x, y + 26, 18, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(x - 14, y - 10, 6, 0, Math.PI * 2); ctx.arc(x + 14, y - 10, 6, 0, Math.PI * 2); ctx.fill();
  // 6 Verlassen
  [x, y] = cell(6); badge(x, y, '#9a9a9a');
  ctx.fillStyle = '#c9c9c9';
  ctx.beginPath(); ctx.moveTo(x - 26, y); ctx.lineTo(x, y - 26); ctx.lineTo(x + 26, y); ctx.closePath(); ctx.fill();
  ctx.fillRect(x - 18, y, 36, 26);
  ctx.strokeStyle = '#e5483c'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(x - 12, y + 4); ctx.lineTo(x + 12, y + 22); ctx.moveTo(x + 12, y + 4); ctx.lineTo(x - 12, y + 22); ctx.stroke();
  // 7 Personen / überfüllt
  [x, y] = cell(7); badge(x, y, '#f06fae');
  ctx.fillStyle = '#ffffff';
  for (const dx of [-16, 0, 16]) { ctx.beginPath(); ctx.arc(x + dx, y - 10, 8, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x + dx - 7, y, 14, 22); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false;
  return t;
}

export const ICON = { POWER: 0, WATER: 1, GARBAGE: 2, FIRE: 3, ROAD: 4, SAD: 5, ABANDONED: 6, CROWD: 7 };

export class EffectsView {
  constructor(engine) {
    this.e = engine;
    this.g = engine.game;
    const glow = makeGlowTexture();
    this.lights = new PointBuffer(16000, makePointsMaterial(glow, true));
    this.lights.points.renderOrder = 6;
    engine.scene.add(this.lights.points);
    this.smokeBuf = new PointBuffer(1600, makePointsMaterial(makeSmokeTexture(), false));
    this.smokeBuf.points.renderOrder = 5;
    engine.scene.add(this.smokeBuf.points);
    this.fireBuf = new PointBuffer(1200, makePointsMaterial(glow, true));
    this.fireBuf.points.renderOrder = 7;
    engine.scene.add(this.fireBuf.points);
    this.particles = [];
    this.fireParts = [];

    // Symbole
    this.iconMax = 3000;
    const geo = new THREE.BufferGeometry();
    this.iconPos = new Float32Array(this.iconMax * 3);
    this.iconIdx = new Float32Array(this.iconMax);
    geo.setAttribute('position', new THREE.BufferAttribute(this.iconPos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aIcon', new THREE.BufferAttribute(this.iconIdx, 1).setUsage(THREE.DynamicDrawUsage));
    this.iconGeo = geo;
    this.iconMat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: makeIconAtlas() }, uTime: { value: 0 }, uSize: { value: 30 } },
      vertexShader: `
attribute float aIcon;
varying float vIcon;
uniform float uTime; uniform float uSize;
void main() {
  vIcon = aIcon;
  vec3 p = position;
  p.y += sin(uTime * 3.0 + position.x * 2.0 + position.z) * 0.06;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(uSize * 24.0 / max(1.0, -mv.z), 14.0, uSize);
  gl_Position = projectionMatrix * mv;
}`,
      fragmentShader: `
uniform sampler2D uTex;
varying float vIcon;
void main() {
  float col = mod(vIcon, 4.0);
  float row = floor(vIcon / 4.0);
  vec2 uv = (vec2(col, row) + gl_PointCoord) / vec2(4.0, 2.0);
  vec4 t = texture2D(uTex, uv);
  if (t.a < 0.05) discard;
  gl_FragColor = t;
}`,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    this.icons = new THREE.Points(geo, this.iconMat);
    this.icons.frustumCulled = false;
    this.icons.renderOrder = 20;
    engine.scene.add(this.icons);
    this.iconTimer = 0;
    this.showIcons = true;
  }

  emitSmoke(x, y, z, type) {
    if (this.particles.length >= 1500) return;
    const steam = type === 'steam';
    this.particles.push({
      x: x + (Math.random() - 0.5) * 0.05, y, z: z + (Math.random() - 0.5) * 0.05,
      vx: 0.08 + Math.random() * 0.05, vy: 0.35 + Math.random() * 0.2, vz: 0.03 + (Math.random() - 0.5) * 0.06,
      age: 0, life: steam ? 3.2 : 2.6 + Math.random(), size: steam ? 0.6 : 0.32, steam,
      dark: type === 'fire',
    });
  }

  updateIcons(time) {
    const g = this.g;
    let n = 0;
    const put = (b, icon, extraY = 0) => {
      if (n >= this.iconMax) return;
      const x = b.x + b.w / 2 - g.W / 2, z = b.y + b.h / 2 - g.H / 2;
      const h = (b.zone ? [0, 0.7, 1.1, 1.5, 2.5, 4.8][b.level] : 1.2) + 0.6 + extraY;
      this.iconPos[n * 3] = x; this.iconPos[n * 3 + 1] = h; this.iconPos[n * 3 + 2] = z;
      this.iconIdx[n] = icon;
      n++;
    };
    if (this.showIcons) {
      for (const b of g.buildings.values()) {
        if (b.construct < 1) continue;
        if (b.burning) { put(b, ICON.FIRE); continue; }
        if (b.abandoned) { put(b, ICON.ABANDONED); continue; }
        if (!b.zone) {
          if (b.key !== 'park' && b.comp >= 0 && !b.powered && BUILDINGS_NEED_POWER(b)) put(b, ICON.POWER);
          continue;
        }
        if (!b.connected) put(b, ICON.ROAD);
        else if (!b.powered && b.noPower > 0) put(b, ICON.POWER);
        else if (!b.watered && b.noWater > 0) put(b, ICON.WATER);
        else if (b.problemGarbage) put(b, ICON.GARBAGE);
        else if (b.happy < 25) put(b, ICON.SAD);
      }
      for (const st of g.transit.stations.values()) {
        if (st.waiting.length > 14) {
          if (n >= this.iconMax) break;
          this.iconPos[n * 3] = st.x + 0.5 - g.W / 2; this.iconPos[n * 3 + 1] = 4.6; this.iconPos[n * 3 + 2] = st.y + 0.5 - g.H / 2;
          this.iconIdx[n] = ICON.CROWD; n++;
        }
      }
    }
    this.iconGeo.setDrawRange(0, n);
    this.iconGeo.attributes.position.needsUpdate = true;
    this.iconGeo.attributes.aIcon.needsUpdate = true;
  }

  frame(dt, simDt, time, night) {
    const g = this.g;
    this.iconMat.uniforms.uTime.value = time;
    this.iconTimer -= dt;
    if (this.iconTimer <= 0) { this.iconTimer = 0.5; this.updateIcons(time); }

    // Rauch aus Schornsteinen
    if (simDt > 0) {
      for (const [id, list] of this.e.buildings.emitters) {
        const b = g.buildings.get(id);
        if (!b || b.construct < 1 || b.abandoned || !b.powered) continue;
        const rate = (b.zone ? 1.1 * (0.3 + b.occ / Math.max(1, b.cap)) : 2.2) * simDt;
        for (const em of list) if (Math.random() < rate * em.amount) this.emitSmoke(em.x, em.y, em.z, em.type);
      }
      // Feuer
      for (const b of g.buildings.values()) {
        if (!b.burning) continue;
        const x = b.x + b.w / 2 - g.W / 2, z = b.y + b.h / 2 - g.H / 2;
        const h = b.zone ? [0, 0.5, 0.8, 1.1, 2, 4][b.level] : 0.6;
        for (let k = 0; k < 3; k++) {
          if (this.fireParts.length < 1100) this.fireParts.push({ x: x + (Math.random() - 0.5) * 0.6, y: Math.random() * h, z: z + (Math.random() - 0.5) * 0.6, vy: 0.6 + Math.random() * 0.6, age: 0, life: 0.5 + Math.random() * 0.5 });
        }
        if (Math.random() < 0.5) this.emitSmoke(x, h + 0.2, z, 'fire');
      }
    }
    const sb = this.smokeBuf;
    sb.begin();
    const keep = [];
    const dark = 1 - night * 0.7;
    for (const p of this.particles) {
      p.age += simDt > 0 ? dt : 0;
      if (p.age > p.life) continue;
      const t = p.age / p.life;
      p.x += p.vx * dt * (simDt > 0 ? 1 : 0); p.y += p.vy * dt * (simDt > 0 ? 1 : 0) * (1 - t * 0.5); p.z += p.vz * dt * (simDt > 0 ? 1 : 0);
      const a = (1 - t) * (p.steam ? 0.5 : 0.55) * Math.min(1, t * 6);
      const base = p.dark ? 0.25 : p.steam ? 0.97 : 0.72;
      sb.add(p.x, p.y, p.z, p.size * (1 + t * 2.2), base * dark, base * dark, base * dark * 1.02, a);
      keep.push(p);
    }
    this.particles = keep;
    sb.end();
    const fb = this.fireBuf;
    fb.begin();
    const keepF = [];
    for (const p of this.fireParts) {
      p.age += dt;
      if (p.age > p.life) continue;
      p.y += p.vy * dt;
      const t = p.age / p.life;
      fb.add(p.x, p.y, p.z, 0.35 * (1 - t * 0.6), 1, 0.55 - t * 0.35, 0.15, (1 - t) * 0.9);
      keepF.push(p);
    }
    this.fireParts = keepF;
    fb.end();
  }

  // Lichter werden pro Frame von mehreren Ansichten befüllt
  beginLights() { this.lights.begin(); }
  endLights() { this.lights.end(); }
  addLampLights(lampPositions, night) {
    if (night < 0.15) return;
    const a = night * 0.55;
    for (let i = 0; i < lampPositions.length; i += 3) this.lights.add(lampPositions[i], lampPositions[i + 1], lampPositions[i + 2], 0.42, 1, 0.82, 0.5, a);
  }
  addFireLights() {
    const g = this.g;
    for (const b of g.buildings.values()) {
      if (!b.burning) continue;
      this.lights.add(b.x + b.w / 2 - g.W / 2, 0.8, b.y + b.h / 2 - g.H / 2, 2.4, 1, 0.45, 0.1, 0.5 + Math.random() * 0.2);
    }
  }
}

function BUILDINGS_NEED_POWER(b) {
  return ['police', 'policehq', 'fire', 'firehq', 'clinic', 'hospital', 'school', 'university', 'library', 'pump', 'waterworks', 'watertower', 'townhall'].includes(b.key);
}
