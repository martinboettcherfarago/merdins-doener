// Partikel (Rauch, Dampf, Feuer, Funken, Baustaub, Abrissstaub), Problem-Symbole über Gebäuden, nächtliche Lichter.
// Besitzer: G1.
//
// Schnittstellen für andere Agenten (engine.effects):
//   lights.add(x, y, z, größe, r, g, b, a)   Leuchtpunkt für DIESES Bild (zwischen beginLights/endLights; additiv, HDR-fähig)
//   pools.add(x, y, z, radius, r, g, b, a)   Lichtkegel/Lichtfleck auf dem Boden für DIESES Bild (z. B. Scheinwerfer)
//   addStaticLights(id, [{ x, y, z, color: 0xffcc88 | [r,g,b], size, pool? }])  dauerhafte Nachtlichter (z. B. res.lights)
//   removeStaticLights(id)
//   emitSmoke(x, y, z, 'smoke'|'steam'|'fire'|'dust'|'spark')  einzelnes Partikel
//   burst(x, y, z, 'dust'|'smoke'|'spark', anzahl, radius)       Wolke auf einmal (Abriss, Explosion …)
//   emitDust(x, y, z, größe, deckkraft)                          Baustaub (von buildings.js genutzt)
//   showIcons (bool)
import * as THREE from 'three';
import { makeGlowTexture, makePointsMaterial, PointBuffer, atmo, ATMO_FOG_GLSL, shared } from './materials.js';
import { ICONS, BUILDING_PROBLEMS } from '../registry.js';

// Index im Symbol-Atlas für registrierte Symbole (ab 8)
export const ICON_INDEX = {};

// Rauch-Atlas 2×2: jede Zelle eine unregelmäßige Wolke aus weichen Blasen
function makeSmokeAtlas() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S * 2;
  const ctx = c.getContext('2d');
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let k = 0; k < 4; k++) {
    const ox = (k % 2) * S, oy = Math.floor(k / 2) * S;
    ctx.save();
    ctx.beginPath(); ctx.rect(ox, oy, S, S); ctx.clip();
    const blobs = 9 + Math.floor(rnd() * 5);
    for (let i = 0; i < blobs; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * S * 0.2;
      const cx = ox + S / 2 + Math.cos(a) * r, cy = oy + S / 2 + Math.sin(a) * r;
      const br = S * (0.14 + rnd() * 0.16);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, br);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.28)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(ox, oy, S, S);
    }
    ctx.restore();
  }
  // feines Rauschen in die Dichte einarbeiten und zum Rand ausblenden
  const img = ctx.getImageData(0, 0, S * 2, S * 2);
  const d = img.data;
  for (let y = 0; y < S * 2; y++) for (let x = 0; x < S * 2; x++) {
    const lx = (x % S) / S - 0.5, ly = (y % S) / S - 0.5;
    const edge = Math.max(0, 1 - Math.hypot(lx, ly) * 2.05);
    const n = 0.75 + 0.25 * Math.sin(x * 0.37 + Math.sin(y * 0.23) * 2) * Math.sin(y * 0.29 + Math.sin(x * 0.17) * 2);
    const k = (y * S * 2 + x) * 4;
    d[k] = d[k + 1] = d[k + 2] = 255;
    d[k + 3] = Math.min(255, d[k + 3] * 1.25 * n * Math.min(1, edge * 3));
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

// Beleuchtete Rauchpartikel: Kugelnormale der Punktfläche × Sonnenrichtung (Kameraraum)
function makeSmokeMaterial(tex) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: tex }, uScale: { value: 300 },
      uSunView: { value: new THREE.Vector3(0, 1, 0) }, uLit: { value: new THREE.Color(1, 1, 1) }, uAmb: { value: new THREE.Color(0.5, 0.5, 0.6) },
      uAtmoFogA: { value: atmo.fogA }, uAtmoFogC: { value: atmo.fogC },
    },
    vertexShader: `
attribute float aSize;
attribute vec4 aColor;
attribute vec2 aRot;
varying vec4 vColor;
varying vec2 vRot;
uniform float uScale;
uniform vec4 uAtmoFogA;
uniform vec4 uAtmoFogC;
${ATMO_FOG_GLSL}
void main() {
  vColor = aColor;
  vRot = aRot;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec4 mv = viewMatrix * wp;
  float px = aSize * uScale / max(0.1, -mv.z);
  if (px < 2.0) { vColor.a *= px / 2.0; px = 2.0; }
  gl_PointSize = px;
  if (uAtmoFogA.w > 0.5) { vec3 rd; vColor.a *= 1.0 - atmoFogFactor(wp.xyz, cameraPosition, uAtmoFogA, uAtmoFogC, rd); }
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `
uniform sampler2D uTex;
uniform vec3 uSunView;
uniform vec3 uLit;
uniform vec3 uAmb;
varying vec4 vColor;
varying vec2 vRot;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c) * 4.0;
  if (r2 > 1.0) discard;
  float cs = cos(vRot.x), sn = sin(vRot.x);
  vec2 rc = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs);
  float v = vRot.y;
  vec2 cell = vec2(mod(v, 2.0), floor(v / 2.0));
  vec2 uv = (clamp(rc + 0.5, 0.0, 1.0) + cell) * 0.5;
  float a = texture2D(uTex, uv).a * vColor.a;
  if (a < 0.004) discard;
  vec3 n = normalize(vec3(c.x * 2.0, -c.y * 2.0, sqrt(max(0.0, 1.0 - r2)) + 0.35));
  float l = clamp(dot(n, uSunView) * 0.6 + 0.45, 0.0, 1.0);
  vec3 col = vColor.rgb * mix(uAmb, uLit, l);
  gl_FragColor = vec4(col, a);
}`,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
}

class SmokeBuffer extends PointBuffer {
  constructor(max, material) {
    super(max, material);
    this.rot = new Float32Array(max * 2);
    this.geo.setAttribute('aRot', new THREE.BufferAttribute(this.rot, 2).setUsage(THREE.DynamicDrawUsage));
  }
  addR(x, y, z, size, r, g, b, a, rot, variant) {
    const i = this.n;
    if (i >= this.max) return;
    this.add(x, y, z, size, r, g, b, a);
    this.rot[i * 2] = rot; this.rot[i * 2 + 1] = variant;
  }
  end() {
    const at = this.geo.attributes.aRot;
    if (at.addUpdateRange) { at.clearUpdateRanges(); at.addUpdateRange(0, Math.max(1, this.n) * 2); }
    at.needsUpdate = true;
    super.end();
  }
}

// Lichtflecken auf dem Boden: instanzierte Scheiben, additiv, ohne Tiefenschreiben
class PoolBuffer {
  constructor(max) {
    this.max = max;
    const geo = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    geo.index = base.index;
    geo.setAttribute('position', base.attributes.position);
    geo.setAttribute('uv', base.attributes.uv);
    this.data = new Float32Array(max * 4);
    this.col = new Float32Array(max * 4);
    this.aData = new THREE.InstancedBufferAttribute(this.data, 4).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aData', this.aData);
    geo.setAttribute('aCol', this.aCol);
    geo.instanceCount = 0;
    this.geo = geo;
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: { uAtmoFogA: { value: atmo.fogA }, uAtmoFogC: { value: atmo.fogC } },
      vertexShader: `
attribute vec4 aData;
attribute vec4 aCol;
varying vec2 vUv;
varying vec4 vCol;
uniform vec4 uAtmoFogA;
uniform vec4 uAtmoFogC;
${ATMO_FOG_GLSL}
void main() {
  vUv = uv * 2.0 - 1.0;
  vCol = aCol;
  vec3 p = vec3(aData.x + position.x * aData.w, aData.y, aData.z + position.z * aData.w);
  if (uAtmoFogA.w > 0.5) { vec3 rd; vCol.a *= 1.0 - atmoFogFactor(p, cameraPosition, uAtmoFogA, uAtmoFogC, rd); }
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`,
      fragmentShader: `
varying vec2 vUv;
varying vec4 vCol;
void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  float f = pow(1.0 - r, 1.6) * (0.75 + 0.25 * (1.0 - r * r));
  gl_FragColor = vec4(vCol.rgb * f * vCol.a, 1.0);
}`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.n = 0;
  }
  begin() { this.n = 0; }
  add(x, y, z, radius, r, g, b, a) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.data[i * 4] = x; this.data[i * 4 + 1] = y; this.data[i * 4 + 2] = z; this.data[i * 4 + 3] = radius;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = a;
  }
  end() {
    this.geo.instanceCount = this.n;
    for (const at of [this.aData, this.aCol]) {
      if (at.addUpdateRange) { at.clearUpdateRanges(); at.addUpdateRange(0, Math.max(1, this.n) * 4); }
      at.needsUpdate = true;
    }
    this.mesh.visible = this.n > 0;
  }
}

// Symbol-Atlas 8×8 (128 px je Zelle): Zeilen 0–3 Einzelsymbole (Strom, Wasser, Müll, Feuer, Keine Straße, Unglücklich,
// Verlassen, Überfüllt, danach registrierte Symbole), Zeilen 4–7 dieselben Symbole als Stapel (gebündelte Probleme).
// Gestaltung: Stecknadel mit Schatten, farbigem Grund, weißem Rand und Spitze.
const BASE_COLORS = ['#e8a812', '#2f8fd8', '#9a7444', '#e8501e', '#d8402f', '#d8402f', '#7d8288', '#d8569a'];
export const ICON_STACK = 32; // Versatz der Stapel-Variante im Atlas
function makeIconAtlas() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = S * 8; c.height = S * 8;
  const ctx = c.getContext('2d');
  const R = 40;
  const shade = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
    return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
  };
  const pin = (cx, cy, col) => {
    const top = cy - 12;
    // Schatten
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.filter = 'blur(4px)';
    ctx.beginPath(); ctx.arc(cx + 2, top + 5, R + 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 14, top + R - 4); ctx.lineTo(cx + 2, cy + 50); ctx.lineTo(cx + 18, top + R - 4); ctx.fill();
    ctx.restore();
    // Spitze
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(cx - 16, top + R - 10); ctx.lineTo(cx, cy + 46); ctx.lineTo(cx + 16, top + R - 10); ctx.closePath(); ctx.fill();
    // Rand
    ctx.beginPath(); ctx.arc(cx, top, R + 4, 0, Math.PI * 2); ctx.fill();
    // Grund mit Verlauf
    const grd = ctx.createLinearGradient(cx, top - R, cx, top + R);
    grd.addColorStop(0, shade(col, 1.12));
    grd.addColorStop(1, shade(col, 0.78));
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(cx, top, R, 0, Math.PI * 2); ctx.fill();
    // Glanz
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.ellipse(cx, top - R * 0.45, R * 0.7, R * 0.38, 0, 0, Math.PI * 2); ctx.fill();
    return [cx, top];
  };
  // Hintere Scheibe eines Stapels (nur Rand + Grund, etwas dunkler)
  const ghost = (cx, cy, col) => {
    const top = cy - 12;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.filter = 'blur(3px)';
    ctx.beginPath(); ctx.arc(cx + 2, top + 4, R + 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#f2f2f2';
    ctx.beginPath(); ctx.arc(cx, top, R + 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(col, 0.72);
    ctx.beginPath(); ctx.arc(cx, top, R, 0, Math.PI * 2); ctx.fill();
  };
  const W = '#ffffff';
  const glyphs = [
    (x, y) => { // 0 Strom
      ctx.fillStyle = W;
      ctx.beginPath(); ctx.moveTo(x + 6, y - 27); ctx.lineTo(x - 14, y + 4); ctx.lineTo(x - 1, y + 4); ctx.lineTo(x - 6, y + 27); ctx.lineTo(x + 14, y - 5); ctx.lineTo(x + 1, y - 5); ctx.closePath(); ctx.fill();
    },
    (x, y) => { // 1 Wasser
      ctx.fillStyle = W;
      ctx.beginPath(); ctx.moveTo(x, y - 26); ctx.bezierCurveTo(x + 22, y - 2, x + 18, y + 22, x, y + 22); ctx.bezierCurveTo(x - 18, y + 22, x - 22, y - 2, x, y - 26); ctx.fill();
    },
    (x, y) => { // 2 Müll
      ctx.fillStyle = W;
      ctx.fillRect(x - 15, y - 9, 30, 32); ctx.fillRect(x - 20, y - 17, 40, 6); ctx.fillRect(x - 6, y - 23, 12, 6);
      ctx.fillStyle = '#9a7444'; ctx.fillRect(x - 7, y - 4, 3, 22); ctx.fillRect(x + 4, y - 4, 3, 22);
    },
    (x, y) => { // 3 Feuer
      ctx.fillStyle = W;
      ctx.beginPath(); ctx.moveTo(x, y - 28); ctx.bezierCurveTo(x + 24, y - 4, x + 20, y + 24, x, y + 24); ctx.bezierCurveTo(x - 20, y + 24, x - 22, y + 2, x - 7, y - 9); ctx.bezierCurveTo(x - 5, y, x + 3, y - 11, x, y - 28); ctx.fill();
      ctx.fillStyle = '#ffc93a';
      ctx.beginPath(); ctx.arc(x, y + 11, 9, 0, Math.PI * 2); ctx.fill();
    },
    (x, y) => { // 4 Keine Straße
      ctx.strokeStyle = W; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(x - 11, y - 24); ctx.lineTo(x - 16, y + 24); ctx.moveTo(x + 11, y - 24); ctx.lineTo(x + 16, y + 24); ctx.stroke();
      ctx.setLineDash([6, 7]); ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x, y - 22); ctx.lineTo(x, y + 24); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = '#ffd8d2'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(x - 24, y - 22); ctx.lineTo(x + 24, y + 22); ctx.stroke();
    },
    (x, y) => { // 5 Unglücklich
      ctx.strokeStyle = W; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(x, y + 22, 15, Math.PI * 1.18, Math.PI * 1.82); ctx.stroke();
      ctx.fillStyle = W;
      ctx.beginPath(); ctx.arc(x - 11, y - 8, 5.5, 0, Math.PI * 2); ctx.arc(x + 11, y - 8, 5.5, 0, Math.PI * 2); ctx.fill();
    },
    (x, y) => { // 6 Verlassen
      ctx.fillStyle = W;
      ctx.beginPath(); ctx.moveTo(x - 22, y - 1); ctx.lineTo(x, y - 22); ctx.lineTo(x + 22, y - 1); ctx.closePath(); ctx.fill();
      ctx.fillRect(x - 15, y - 1, 30, 22);
      ctx.strokeStyle = '#7d8288'; ctx.lineWidth = 4.5;
      ctx.beginPath(); ctx.moveTo(x - 8, y + 3); ctx.lineTo(x + 8, y + 17); ctx.moveTo(x + 8, y + 3); ctx.lineTo(x - 8, y + 17); ctx.stroke();
    },
    (x, y) => { // 7 Personen / überfüllt
      ctx.fillStyle = W;
      for (const dx of [-14, 0, 14]) { ctx.beginPath(); ctx.arc(x + dx, y - 9, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x + dx - 6, y, 12, 18, 4) : ctx.rect(x + dx - 6, y, 12, 18); ctx.fill(); }
    },
  ];
  const colors = BASE_COLORS.slice();
  // Registrierte Symbole (bis zu 24 weitere)
  ICONS.slice(0, 24).forEach((icon, k) => {
    ICON_INDEX[icon.id] = 8 + k;
    colors.push(icon.color || '#5a6470');
    glyphs.push((px, py) => {
      ctx.save();
      ctx.beginPath(); ctx.arc(px, py, R - 1, 0, Math.PI * 2); ctx.clip();
      try { icon.draw(ctx, px, py, 30); } catch (e) { console.error('Symbol', icon.id, e); }
      ctx.restore();
    });
  });
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  glyphs.forEach((draw, i) => {
    const cx = (i % 8) * S + S / 2, cy = Math.floor(i / 8) * S + S / 2;
    draw(...pin(cx, cy, colors[i]));
    // Stapel: zwei Scheiben dahinter, vorderes Symbol etwas kleiner
    const sy = cy + 4 * S;
    ctx.save();
    ctx.beginPath(); ctx.rect(cx - S / 2, sy - S / 2, S, S); ctx.clip();
    ctx.translate(cx, sy); ctx.scale(0.84, 0.84); ctx.translate(-cx, -sy);
    ghost(cx + 22, sy - 16, colors[i]);
    ghost(cx + 11, sy - 8, colors[i]);
    draw(...pin(cx - 4, sy + 4, colors[i]));
    ctx.restore();
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
  return t;
}

export const ICON = { POWER: 0, WATER: 1, GARBAGE: 2, FIRE: 3, ROAD: 4, SAD: 5, ABANDONED: 6, CROWD: 7 };

const SMOKE_TYPES = {
  smoke: { life: [4.2, 6.0], size: [0.22, 1.25], vy: [0.32, 0.5], alpha: 0.5, albedo: [0.66, 0.66, 0.68], spin: 0.35, drift: 1 },
  steam: { life: [2.4, 3.4], size: [0.36, 1.7], vy: [0.42, 0.62], alpha: 0.42, albedo: [1.0, 1.0, 1.0], spin: 0.25, drift: 1.2 },
  fire: { life: [4.5, 6.5], size: [0.4, 1.9], vy: [0.55, 0.85], alpha: 0.62, albedo: [0.16, 0.15, 0.15], spin: 0.4, drift: 0.8 },
  dust: { life: [2.0, 3.2], size: [0.18, 0.75], vy: [0.05, 0.14], alpha: 0.32, albedo: [0.8, 0.7, 0.55], spin: 0.5, drift: 0.6 },
  debris: { life: [2.8, 4.2], size: [0.3, 1.5], vy: [0.12, 0.35], alpha: 0.55, albedo: [0.72, 0.66, 0.58], spin: 0.4, drift: 0.7 },
};

export class EffectsView {
  constructor(engine) {
    this.e = engine;
    this.g = engine.game;
    const glow = makeGlowTexture();
    this.glowTex = glow;
    this.lights = new PointBuffer(16000, makePointsMaterial(glow, true));
    this.lights.points.renderOrder = 6;
    engine.scene.add(this.lights.points);
    this.pools = new PoolBuffer(6000);
    engine.scene.add(this.pools.mesh);
    this.smokeBuf = new SmokeBuffer(2400, makeSmokeMaterial(makeSmokeAtlas()));
    this.smokeBuf.points.renderOrder = 5;
    engine.scene.add(this.smokeBuf.points);
    this.fireBuf = new PointBuffer(2400, makePointsMaterial(glow, true));
    this.fireBuf.points.renderOrder = 7;
    engine.scene.add(this.fireBuf.points);
    this.particles = [];
    this.fireParts = [];
    this.sparks = [];
    this.staticLights = new Map();
    this.sunView = new THREE.Vector3();

    // Symbole (in der HUD-Szene: scharf, ohne Nebel und Nachbearbeitung)
    this.iconMax = 3000;
    const geo = new THREE.BufferGeometry();
    this.iconPos = new Float32Array(this.iconMax * 3);
    this.iconIdx = new Float32Array(this.iconMax);
    this.iconBorn = new Float32Array(this.iconMax);
    geo.setAttribute('position', new THREE.BufferAttribute(this.iconPos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aIcon', new THREE.BufferAttribute(this.iconIdx, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aBorn', new THREE.BufferAttribute(this.iconBorn, 1).setUsage(THREE.DynamicDrawUsage));
    this.iconGeo = geo;
    this.iconMat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: makeIconAtlas() }, uTime: { value: 0 }, uSize: { value: 25 }, uPR: { value: 1 } },
      vertexShader: `
attribute float aIcon;
attribute float aBorn;
varying float vIcon;
varying float vA;
uniform float uTime; uniform float uSize; uniform float uPR;
void main() {
  vIcon = aIcon;
  vec3 p = position;
  p.y += sin(uTime * 2.0 + position.x * 2.0 + position.z) * 0.03; // sanftes Schweben (ruhiger als zuvor)
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float d = max(1.0, -mv.z);
  float t = clamp((uTime - aBorn) / 0.35, 0.0, 1.0);
  float pop = 1.0 + 2.70158 * pow(t - 1.0, 3.0) + 1.70158 * pow(t - 1.0, 2.0);
  float pulse = abs(mod(aIcon, 32.0) - 3.0) < 0.5 ? 1.0 + 0.08 * sin(uTime * 9.0) : 1.0;
  float stack = aIcon > 31.5 ? 1.14 : 1.0;
  float px = clamp(uSize * 20.0 / d, 16.0, uSize) * uPR * pop * pulse * stack;
  vA = smoothstep(2.5, 5.0, d) * clamp(t * 3.0, 0.0, 1.0);
  gl_PointSize = px;
  gl_Position = projectionMatrix * mv;
}`,
      fragmentShader: `
uniform sampler2D uTex;
varying float vIcon;
varying float vA;
void main() {
  float col = mod(vIcon, 8.0);
  float row = floor(vIcon / 8.0 + 0.01);
  vec2 uv = (vec2(col, row) + gl_PointCoord) / 8.0;
  vec4 t = texture2D(uTex, uv);
  if (t.a * vA < 0.02) discard;
  gl_FragColor = vec4(t.rgb, t.a * vA);
  #include <colorspace_fragment>
}`,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    this.icons = new THREE.Points(geo, this.iconMat);
    this.icons.frustumCulled = false;
    this.icons.renderOrder = 20;
    (engine.hud || engine.scene).add(this.icons);
    this.iconTimer = 0;
    this.iconState = new Map(); // Schlüssel → Geburtszeit
    this.showIcons = true;

    // Abrissstaub
    this.unbind = [
      this.g.on('buildingRemoved', (b) => {
        const g = this.g;
        const x = b.x + b.w / 2 - g.W / 2, z = b.y + b.h / 2 - g.H / 2;
        const n = Math.min(40, 12 + b.w * b.h * 6 + (b.level || 1) * 3);
        this.burst(x, 0.15, z, 'debris', n, Math.max(b.w, b.h) * 0.45);
      }),
    ];
  }

  dispose() { for (const u of this.unbind) u(); }

  resize(scale, pr) {
    this.lights.points.material.uniforms.uScale.value = scale * 0.69;
    this.lights.points.material.uniforms.uMinPx.value = 1.5 * pr;
    this.fireBuf.points.material.uniforms.uScale.value = scale * 0.69;
    this.smokeBuf.points.material.uniforms.uScale.value = scale * 0.69;
    this.iconMat.uniforms.uPR.value = pr;
  }

  // Ein Partikel
  emitSmoke(x, y, z, type = 'smoke') {
    if (type === 'spark') { this.emitSpark(x, y, z); return; }
    if (this.particles.length >= 2200) return;
    const T = SMOKE_TYPES[type] || SMOKE_TYPES.smoke;
    const r = Math.random;
    const jitter = 0.94 + r() * 0.12;
    this.particles.push({
      x: x + (r() - 0.5) * 0.06, y, z: z + (r() - 0.5) * 0.06,
      vx: (r() - 0.5) * 0.06, vy: T.vy[0] + r() * (T.vy[1] - T.vy[0]), vz: (r() - 0.5) * 0.06,
      age: 0, life: T.life[0] + r() * (T.life[1] - T.life[0]), s0: T.size[0] * (0.85 + r() * 0.3), s1: T.size[1] * (0.8 + r() * 0.4),
      rot: r() * 6.28, vr: (r() - 0.5) * T.spin, v: Math.floor(r() * 4), a: T.alpha, y0: y, drift: T.drift,
      cr: T.albedo[0] * jitter, cg: T.albedo[1] * jitter, cb: T.albedo[2] * jitter,
    });
  }

  // Baustaub/Abrissstaub (Schnittstelle für buildings.js): Größe und Deckkraft wie dort gewünscht
  emitDust(x, y, z, size = 0.3, alpha = 0.5) {
    const n = this.particles.length;
    this.emitSmoke(x, y, z, 'dust');
    if (this.particles.length === n) return;
    const p = this.particles[n];
    const k = size / 0.4;
    p.s0 *= k; p.s1 *= k;
    p.a = Math.min(0.5, 0.18 + alpha * 0.3);
    p.vx += (Math.random() - 0.5) * 0.16; p.vz += (Math.random() - 0.5) * 0.16;
  }

  burst(x, y, z, type, count, radius = 0.5) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * radius;
      if (type === 'spark') { this.emitSpark(x, y, z, 1.5); continue; }
      this.emitSmoke(x + Math.cos(a) * rr, y + Math.random() * 0.2, z + Math.sin(a) * rr, type);
      const p = this.particles[this.particles.length - 1];
      if (p) { const sp = 0.25 + Math.random() * 0.35; p.vx += Math.cos(a) * sp; p.vz += Math.sin(a) * sp; p.life *= 0.8 + Math.random() * 0.4; }
    }
  }

  emitSpark(x, y, z, power = 1) {
    if (this.sparks.length >= 900) return;
    const r = Math.random;
    this.sparks.push({ x, y, z, vx: (r() - 0.5) * 0.5 * power, vy: (0.5 + r() * 0.9) * power, vz: (r() - 0.5) * 0.5 * power, age: 0, life: 0.8 + r() * 1.2, ph: r() * 6.28 });
  }

  // Dauerhafte Nachtlichter (z. B. von Gebäuden): Liste mit { x, y, z, color, size, pool }
  addStaticLights(id, list) {
    const arr = [];
    const c = new THREE.Color();
    for (const l of list || []) {
      if (Array.isArray(l.color)) c.setRGB(l.color[0], l.color[1], l.color[2]); else c.set(l.color ?? 0xffd49a);
      arr.push({ x: l.x, y: l.y, z: l.z, r: c.r, g: c.g, b: c.b, size: l.size ?? 0.2, pool: l.pool ?? 0 });
    }
    if (arr.length) this.staticLights.set(id, arr); else this.staticLights.delete(id);
  }
  removeStaticLights(id) { this.staticLights.delete(id); }

  iconHeight(b) {
    const h = this.e.buildings && this.e.buildings.heightOf ? this.e.buildings.heightOf(b) : null;
    if (h) return h * (b.construct < 1 ? b.construct : 1) + 0.55;
    return (b.zone ? [0, 0.7, 1.1, 1.5, 2.5, 4.8][b.level] : 1.2) + 0.6;
  }

  // Bündelstufe der Symbole aus dem Kameraabstand: Zellgröße 2^stufe Felder (nah 1, Stadt 8, Übersicht 16)
  iconLevel() {
    const dist = this.e.rig && this.e.rig.cur ? this.e.rig.cur.dist : 30;
    return Math.max(0, Math.min(5, Math.round(Math.log2(Math.max(1, dist * 0.22)))));
  }

  // Problemsymbole: Kandidaten nach Schwere sammeln, dann pro Zelle (Weltraster, abhängig vom Zoom) nur das
  // wichtigste zeigen. Mehrere Probleme in einer Zelle → Stapel-Symbol. Fern entfallen leichte Probleme.
  updateIcons(time) {
    const g = this.g;
    let n = 0;
    const seen = new Set();
    const state = this.iconState;
    const put = (key, x, h, z, icon) => {
      if (n >= this.iconMax) return;
      const sk = key + ':' + icon;
      seen.add(sk);
      let born = state.get(sk);
      if (born === undefined) { born = time; state.set(sk, born); }
      this.iconPos[n * 3] = x; this.iconPos[n * 3 + 1] = h; this.iconPos[n * 3 + 2] = z;
      this.iconIdx[n] = icon;
      this.iconBorn[n] = born;
      n++;
    };
    this.iconLevelNow = this.iconLevel();
    const cam = this.e.camera.position;
    const cells = new Map();
    const cand = (key, x, h, z, icon) => {
      const pr = iconPrio(icon);
      // Bündelstufe nach dem Abstand des Symbols zur Kamera (fern = größere Zellen, leichte Probleme entfallen)
      const d = Math.hypot(x - cam.x, h - cam.y, z - cam.z);
      const level = Math.max(0, Math.min(5, Math.round(Math.log2(Math.max(1, d * 0.22)))));
      if (pr < (level >= 4 ? 30 : level >= 3 ? 18 : 0)) return;
      const cellSize = 1 << level;
      const ck = level * 1e8 + Math.floor((x + g.W / 2) / cellSize) * 4096 + Math.floor((z + g.H / 2) / cellSize);
      const c = cells.get(ck);
      if (!c) { cells.set(ck, { key, x, h, z, icon, pr, n: 1 }); return; }
      c.n++;
      if (pr > c.pr || (pr === c.pr && h > c.h)) { c.key = key; c.x = x; c.h = h; c.z = z; c.icon = icon; c.pr = pr; }
    };
    const putB = (b, icon) => cand(b.id, b.x + b.w / 2 - g.W / 2, this.iconHeight(b), b.y + b.h / 2 - g.H / 2, icon);
    const extraIcon = (b) => {
      for (const fn of BUILDING_PROBLEMS) {
        const id = fn(g, b);
        if (id && ICON_INDEX[id] !== undefined) return ICON_INDEX[id];
      }
      return -1;
    };
    const extra = (b) => { const i = extraIcon(b); if (i >= 0) putB(b, i); };
    if (this.showIcons) {
      for (const b of g.buildings.values()) {
        if (b.construct < 1) {
          if (g.isRepairing && g.isRepairing(b) && ICON_INDEX.repair !== undefined) putB(b, ICON_INDEX.repair);
          continue;
        }
        if (b.burning) { putB(b, ICON.FIRE); continue; }
        if (b.abandoned) { putB(b, ICON.ABANDONED); continue; }
        if (!b.zone) {
          if (b.key !== 'park' && b.comp >= 0 && !b.powered && BUILDINGS_NEED_POWER(b)) putB(b, ICON.POWER);
          else extra(b);
          continue;
        }
        if (!b.connected) putB(b, ICON.ROAD);
        else if (!b.powered && b.noPower > 0) putB(b, ICON.POWER);
        else if (!b.watered && b.noWater > 0) putB(b, ICON.WATER);
        else {
          // schwerstes Problem des Gebäudes (Müll/Unglück oder registrierte wie Hochwasser, Krankheit, Stau)
          let best = b.problemGarbage ? ICON.GARBAGE : b.happy < 25 ? ICON.SAD : -1;
          const id = extraIcon(b);
          if (id >= 0 && (best < 0 || iconPrio(id) > iconPrio(best))) best = id;
          if (best >= 0) putB(b, best);
        }
      }
      for (const st of g.transit.stations.values()) {
        if (st.waiting.length > 14) cand('st' + st.x + ',' + st.y, st.x + 0.5 - g.W / 2, 4.6, st.y + 0.5 - g.H / 2, ICON.CROWD);
      }
      for (const c of cells.values()) put(c.key, c.x, c.h, c.z, c.icon + (c.n > 1 ? ICON_STACK : 0));
    }
    for (const k of state.keys()) if (!seen.has(k)) state.delete(k);
    this.iconCount = n;
    this.iconGeo.setDrawRange(0, n);
    for (const name of ['position', 'aIcon', 'aBorn']) this.iconGeo.attributes[name].needsUpdate = true;
  }

  // Licht- und Farbwerte der Szene für beleuchtete Partikel
  updateLighting() {
    const e = this.e, L = e.light;
    const u = this.smokeBuf.points.material.uniforms;
    if (!L) return;
    this.sunView.copy(L.keyDir || L.sunDir).transformDirection(e.camera.matrixWorldInverse);
    u.uSunView.value.copy(this.sunView);
    const sunI = e.sun ? e.sun.intensity : 2;
    u.uLit.value.copy(e.sun ? e.sun.color : L.sunColor).multiplyScalar(sunI * 0.3);
    const amb = u.uAmb.value.copy(e.hemi ? e.hemi.color : L.ambient).multiplyScalar((e.hemi ? e.hemi.intensity : 0.6) * 0.42);
    // nachts warmes Streulicht der Stadt von unten
    amb.r += 0.02 * e.night; amb.g += 0.014 * e.night; amb.b += 0.01 * e.night;
    u.uLit.value.add(amb);
  }

  frame(dt, simDt, time, night) {
    const g = this.g, e = this.e;
    this.iconMat.uniforms.uTime.value = time;
    this.iconTimer -= dt;
    if (this.iconTimer <= 0 || this.iconLevel() !== this.iconLevelNow) { this.iconTimer = 0.5; this.updateIcons(time); }
    this.updateLighting();
    const wx = e.wx || { wind: 0.3, windDir: 0.6 };
    const wsp = 0.08 + wx.wind * 0.55;
    const wdx = Math.cos(wx.windDir) * wsp, wdz = Math.sin(wx.windDir) * wsp;
    const running = simDt > 0;
    const qd = e.quality && e.quality.weather !== undefined ? Math.min(1, 0.5 + e.quality.weather * 0.5) : 1;

    if (running) {
      // Rauch aus Schornsteinen
      for (const [id, list] of e.buildings.emitters) {
        const b = g.buildings.get(id);
        if (!b || b.construct < 1 || b.abandoned || !b.powered) continue;
        const rate = (b.zone ? 1.1 * (0.3 + b.occ / Math.max(1, b.cap)) : 2.2) * simDt * qd;
        for (const em of list) if (Math.random() < rate * em.amount) this.emitSmoke(em.x, em.y, em.z, em.type);
      }
      // Baustaub (nur falls der Gebäude-Renderer ihn nicht selbst über emitDust erzeugt – sonst doppelt)
      if (e.buildings.constructing && typeof e.buildings._emitDust !== 'function') {
        for (const id of e.buildings.constructing) {
          const b = g.buildings.get(id);
          if (!b) continue;
          if (Math.random() < simDt * 0.9 * b.w * b.h * qd) {
            const x = b.x + Math.random() * b.w - g.W / 2, z = b.y + Math.random() * b.h - g.H / 2;
            this.emitSmoke(x, 0.05, z, 'dust');
          }
        }
      }
      // Feuer
      for (const b of g.buildings.values()) {
        if (!b.burning) continue;
        const x = b.x + b.w / 2 - g.W / 2, z = b.y + b.h / 2 - g.H / 2;
        const h = Math.max(0.3, (this.iconHeight(b) - 0.6) * 0.9);
        const sx = b.w * 0.42, sz = b.h * 0.42;
        for (let k = 0; k < 4; k++) {
          if (this.fireParts.length < 2000) this.fireParts.push({ x: x + (Math.random() - 0.5) * 2 * sx, y: Math.random() * h * 0.9, z: z + (Math.random() - 0.5) * 2 * sz, vy: 0.5 + Math.random() * 0.7, age: 0, life: 0.45 + Math.random() * 0.5, s: 0.22 + Math.random() * 0.25 });
        }
        if (Math.random() < 0.7) this.emitSmoke(x + (Math.random() - 0.5) * sx, h + 0.15, z + (Math.random() - 0.5) * sz, 'fire');
        if (Math.random() < 0.6) this.emitSpark(x + (Math.random() - 0.5) * sx, h * 0.8, z + (Math.random() - 0.5) * sz);
      }
    }

    // Rauch, Dampf, Staub
    const sb = this.smokeBuf;
    sb.begin();
    const keep = [];
    const step = running ? dt : 0;
    for (const p of this.particles) {
      p.age += step;
      if (p.age > p.life) continue;
      const t = p.age / p.life;
      const rise = Math.min(1, (p.y - p.y0) * 0.6 + 0.25) * p.drift;
      p.vy *= Math.exp(-step * 0.35);
      p.vx += (wdx * rise - p.vx) * step * 0.9;
      p.vz += (wdz * rise - p.vz) * step * 0.9;
      // leichte Verwirbelung
      const sw = Math.sin(p.age * 1.7 + p.rot * 3) * 0.04;
      p.x += (p.vx + sw) * step; p.y += p.vy * step; p.z += (p.vz - sw * 0.6) * step;
      p.rot += p.vr * step;
      const grow = 1 - Math.pow(1 - t, 2.2);
      const a = p.a * Math.min(1, t * 7) * Math.pow(1 - t, 1.4);
      sb.addR(p.x, p.y, p.z, p.s0 + (p.s1 - p.s0) * grow, p.cr, p.cg, p.cb, a, p.rot, p.v);
      keep.push(p);
    }
    this.particles = keep;
    sb.end();

    // Flammen und Funken (leuchtend, HDR)
    const fb = this.fireBuf;
    fb.begin();
    const keepF = [];
    for (const p of this.fireParts) {
      p.age += dt;
      if (p.age > p.life) continue;
      p.y += p.vy * dt;
      p.x += wdx * dt * 0.3; p.z += wdz * dt * 0.3;
      const t = p.age / p.life;
      const hot = 1 - t;
      fb.add(p.x, p.y, p.z, p.s * (1 - t * 0.55), 2.6 * (0.8 + hot * 0.5), (0.55 + hot * 0.9) * 1.2, 0.12 + hot * 0.25, (1 - t) * 0.85);
      keepF.push(p);
    }
    this.fireParts = keepF;
    const keepS = [];
    for (const s of this.sparks) {
      s.age += dt;
      if (s.age > s.life) continue;
      s.vy -= dt * 0.25;
      s.vx += (wdx * 1.4 - s.vx) * dt; s.vz += (wdz * 1.4 - s.vz) * dt;
      s.x += s.vx * dt + Math.sin(s.age * 9 + s.ph) * 0.004; s.y += s.vy * dt; s.z += s.vz * dt;
      const t = s.age / s.life;
      const fl = 0.6 + 0.4 * Math.sin(s.age * 31 + s.ph);
      fb.add(s.x, s.y, s.z, 0.05, 3.2, 1.5 - t, 0.3, (1 - t) * fl);
      keepS.push(s);
    }
    this.sparks = keepS;
    fb.end();
  }

  // Lichter werden pro Frame von mehreren Ansichten befüllt
  beginLights() { this.lights.begin(); this.pools.begin(); }
  endLights() {
    const night = this.e.night || 0;
    if (night > 0.15 && this.staticLights.size) {
      const a = Math.min(1, (night - 0.15) * 1.6);
      for (const list of this.staticLights.values()) {
        for (const l of list) {
          this.lights.add(l.x, l.y, l.z, l.size, l.r * 1.6, l.g * 1.6, l.b * 1.6, a * 0.8);
          if (l.pool > 0) this.pools.add(l.x, 0.02, l.z, l.pool, l.r, l.g, l.b, a * 0.35 * (1 - 0.5 * ((shared.uSnow && shared.uSnow.value) || 0)));
        }
      }
    }
    this.lights.end();
    this.pools.end();
  }
  addLampLights(lampPositions, night) {
    if (night < 0.15) return;
    const a = Math.min(1, (night - 0.15) * 1.5);
    for (let i = 0; i < lampPositions.length; i += 3) {
      const x = lampPositions[i], y = lampPositions[i + 1], z = lampPositions[i + 2];
      // Lichtfleck und Kegel zeichnet die Straßenansicht selbst (streetprops 'pool'/'cone') – hier nur der Leuchtpunkt
      this.lights.add(x, y, z, 0.09, 1.3, 0.95, 0.55, a * 0.5);
    }
  }
  addFireLights() {
    const g = this.g;
    const t = this.e.time || 0;
    for (const b of g.buildings.values()) {
      if (!b.burning) continue;
      const x = b.x + b.w / 2 - g.W / 2, z = b.y + b.h / 2 - g.H / 2;
      const fl = 0.75 + 0.25 * Math.sin(t * 17 + b.id) * Math.sin(t * 7.3 + b.id * 3);
      this.lights.add(x, 0.8, z, 2.2, 1.6, 0.6, 0.15, 0.45 * fl);
      this.pools.add(x, 0.03, z, 1.4 + Math.max(b.w, b.h) * 0.6, 1.0, 0.45, 0.12, 0.9 * fl);
    }
  }
}

// Schwere der Probleme (höher = wichtiger); unbekannte registrierte Symbole liegen in der Mitte
const PRIO_BASE = [70, 65, 32, 100, 80, 15, 45, 40];
const PRIO_REG = { flooded: 90, cz_dead: 60, cz_sick: 55, cz_cold: 50, cz_sewage: 38, tp_jam: 26, tp_depot: 22, eco_short: 24, eco_unsold: 20, repair: 12 };
let prioCache = null;
function iconPrio(icon) {
  if (icon < 8) return PRIO_BASE[icon];
  if (!prioCache) { prioCache = {}; for (const [id, i] of Object.entries(ICON_INDEX)) prioCache[i] = PRIO_REG[id] ?? 30; }
  return prioCache[icon] ?? 30;
}

function BUILDINGS_NEED_POWER(b) {
  return ['police', 'policehq', 'fire', 'firehq', 'clinic', 'hospital', 'school', 'university', 'library', 'pump', 'waterworks', 'watertower', 'townhall'].includes(b.key);
}
