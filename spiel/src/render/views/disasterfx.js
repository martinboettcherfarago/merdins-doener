// Ansicht „Katastrophen-Effekte" (Besitzer S4).
// Flutwasser mit Strömung und Schaum, Tornado-Trichter mit Staub und Trümmern, Kamerawackeln bei Erdbeben,
// Bodenrisse, Meteor mit Feuerschweif, Druckwelle, Krater und Glut, Blitze (inkl. Himmelsflackern über
// g.ext.weather.lightning), Waldbrand mit Flammen und Rauch, Sturm-Trümmer, Gefahrenzonen, Sirenen-Wellen,
// Blaulicht an Einsatzstellen, Staub über beschädigten Gebäuden, Brand- und Schlammspuren am Boden.
// Liest nur g.ext.disasters / g.ext.weather; alle Bewegungen sind Funktionen der Spielzeit (kein Ruckeln bei 1×).
import * as THREE from 'three';
import { registerView, registerIcon } from '../../registry.js';
import { DISASTERS, floodDepth, tornadoPos, quakeShake, meteorState } from '../../sim/systems/disasters.js';
import { claimLightning } from '../../sim/systems/weather.js';

// Problemsymbol „überflutet" (Wellen)
registerIcon({
  id: 'flooded', color: '#3f9fe0',
  draw(ctx, cx, cy, r) {
    ctx.strokeStyle = '#7cc8ff'; ctx.lineWidth = r * 0.16; ctx.lineCap = 'round';
    for (let k = -1; k <= 1; k++) {
      const y = cy + k * r * 0.42;
      ctx.beginPath();
      for (let i = 0; i <= 16; i++) { const x = cx - r * 0.7 + (i / 16) * r * 1.4; const yy = y + Math.sin((i / 16) * Math.PI * 3) * r * 0.12; if (i) ctx.lineTo(x, yy); else ctx.moveTo(x, yy); }
      ctx.stroke();
    }
  },
});

const rand = Math.random;
const T_WATER = 1;
const FUNNEL_H = 21; // Wolkenbasis (Welteinheiten)
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };

// ---------- Texturen (prozedural)
function canvasTex(size, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const glowTex = () => canvasTex(64, (ctx, s) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,255,255,0.75)'); g.addColorStop(0.5, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
});
const smokeTex = () => canvasTex(128, (ctx, s) => {
  // mehrere weiche Ballen ergeben eine Wolkenform
  for (let k = 0; k < 14; k++) {
    const a = rand() * Math.PI * 2, d = rand() * s * 0.2;
    const x = s / 2 + Math.cos(a) * d, y = s / 2 + Math.sin(a) * d, r = s * (0.16 + rand() * 0.18);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.32)'); g.addColorStop(0.6, 'rgba(255,255,255,0.14)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const img = ctx.getImageData(0, 0, s, s);
  for (let i = 0; i < img.data.length; i += 4) {
    const x = (i / 4) % s, y = Math.floor(i / 4 / s);
    const d = Math.hypot(x - s / 2, y - s / 2) / (s / 2);
    img.data[i + 3] = Math.min(255, img.data[i + 3] * 1.6 * Math.max(0, 1 - d * d)) * (0.75 + rand() * 0.25);
  }
  ctx.putImageData(img, 0, 0);
});
function crackTex() {
  return canvasTex(512, (ctx, s) => {
    ctx.strokeStyle = 'rgba(20,14,10,0.95)'; ctx.lineCap = 'round';
    const branch = (x, y, a, len, w, depth) => {
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(x, y);
      let cx = x, cy = y;
      const n = 6 + Math.floor(rand() * 5);
      for (let i = 0; i < n; i++) {
        a += (rand() - 0.5) * 0.7;
        cx += Math.cos(a) * len / n; cy += Math.sin(a) * len / n;
        ctx.lineTo(cx, cy);
        if (depth < 3 && rand() < 0.28) { ctx.stroke(); branch(cx, cy, a + (rand() < 0.5 ? 1 : -1) * (0.5 + rand() * 0.6), len * 0.45, w * 0.6, depth + 1); ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(cx, cy); }
      }
      ctx.stroke();
    };
    const n = 7 + Math.floor(rand() * 4);
    for (let k = 0; k < n; k++) branch(s / 2 + (rand() - 0.5) * 20, s / 2 + (rand() - 0.5) * 20, (k / n) * Math.PI * 2 + rand() * 0.4, s * (0.32 + rand() * 0.16), 5, 0);
  });
}
function craterTex() {
  return canvasTex(256, (ctx, s) => {
    const c = s / 2;
    // Auswurf-Strahlen
    for (let k = 0; k < 40; k++) {
      const a = rand() * Math.PI * 2, l = s * (0.28 + rand() * 0.22);
      ctx.strokeStyle = `rgba(${60 + rand() * 30},${48 + rand() * 20},${36},${0.25 + rand() * 0.3})`;
      ctx.lineWidth = 2 + rand() * 6;
      ctx.beginPath(); ctx.moveTo(c + Math.cos(a) * s * 0.2, c + Math.sin(a) * s * 0.2); ctx.lineTo(c + Math.cos(a) * l, c + Math.sin(a) * l); ctx.stroke();
    }
    let g = ctx.createRadialGradient(c, c, 0, c, c, s * 0.3);
    g.addColorStop(0, 'rgba(16,12,10,1)'); g.addColorStop(0.55, 'rgba(38,30,24,1)'); g.addColorStop(0.78, 'rgba(120,98,74,1)'); g.addColorStop(0.9, 'rgba(92,74,56,0.9)'); g.addColorStop(1, 'rgba(70,58,46,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, s * 0.3, 0, Math.PI * 2); ctx.fill();
    g = ctx.createRadialGradient(c, c, s * 0.28, c, c, s * 0.5);
    g.addColorStop(0, 'rgba(60,48,38,0.55)'); g.addColorStop(1, 'rgba(60,48,38,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, s * 0.5, 0, Math.PI * 2); ctx.fill();
  });
}

// ---------- Partikel-Puffer mit eigener Größe, Farbe, Deckkraft
class Particles {
  constructor(max, tex, additive) {
    this.max = max;
    this.p = [];
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.rot = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aRot', new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: tex }, uScale: { value: 600 } },
      vertexShader: `
attribute float aSize; attribute vec4 aColor; attribute float aRot;
varying vec4 vColor; varying float vRot;
uniform float uScale;
void main() {
  vColor = aColor; vRot = aRot;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(aSize * uScale / max(0.2, -mv.z), 0.0, 900.0);
  gl_Position = projectionMatrix * mv;
}`,
      fragmentShader: `
uniform sampler2D uTex; varying vec4 vColor; varying float vRot;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float c = cos(vRot), s = sin(vRot);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
  vec4 t = texture2D(uTex, p);
  gl_FragColor = vec4(vColor.rgb, vColor.a * t.a);
  if (gl_FragColor.a < 0.004) discard;
}`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
  }
  add(o) { if (this.p.length < this.max) this.p.push(o); }
  full(f = 1) { return this.p.length >= this.max * f; }
  // Partikel: x,y,z, vx,vy,vz, age, life, s0, s1, r,g,b, a, drag, grav, rot, vr, fadeIn
  update(dt, extra) {
    const keep = [];
    let n = 0;
    const P = this.pos, C = this.col, S = this.size, Rr = this.rot;
    for (const q of this.p) {
      q.age += dt;
      if (q.age >= q.life) continue;
      const k = q.drag ? Math.exp(-q.drag * dt) : 1;
      q.vx *= k; q.vy = q.vy * k - (q.grav || 0) * dt; q.vz *= k;
      if (q.swirl) { const ang = q.swirl * dt; const dx = q.x - q.cx, dz = q.z - q.cz; const c = Math.cos(ang), s = Math.sin(ang); q.x = q.cx + dx * c - dz * s; q.z = q.cz + dx * s + dz * c; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.floor !== undefined && q.y < q.floor) { q.y = q.floor; q.vy = 0; q.vx *= 0.6; q.vz *= 0.6; }
      const t = q.age / q.life;
      const fin = q.fadeIn ? Math.min(1, t / q.fadeIn) : 1;
      const a = q.a * fin * (q.flicker ? 0.6 + 0.4 * Math.sin(q.age * q.flicker + q.ph) : 1) * (1 - Math.pow(t, q.fadeOut || 1.6));
      P[n * 3] = q.x; P[n * 3 + 1] = q.y; P[n * 3 + 2] = q.z;
      const m = q.night ? extra : 1;
      C[n * 4] = q.r * m; C[n * 4 + 1] = q.g * m; C[n * 4 + 2] = q.b * m; C[n * 4 + 3] = a;
      S[n] = q.s0 + (q.s1 - q.s0) * t;
      Rr[n] = (q.rot || 0) + (q.vr || 0) * q.age;
      keep.push(q);
      n++;
    }
    this.p = keep;
    this.n = n;
    this.flush();
  }
  flush() {
    const g = this.geo;
    g.setDrawRange(0, this.n);
    g.attributes.position.needsUpdate = true; g.attributes.aColor.needsUpdate = true; g.attributes.aSize.needsUpdate = true; g.attributes.aRot.needsUpdate = true;
  }
  // Einmalige Punkte nur für dieses Bild (Blitze, Lichter)
  addStatic(list) {
    let n = this.n;
    const P = this.pos, C = this.col, S = this.size, Rr = this.rot;
    for (const q of list) {
      if (n >= this.max) break;
      P[n * 3] = q[0]; P[n * 3 + 1] = q[1]; P[n * 3 + 2] = q[2];
      C[n * 4] = q[4]; C[n * 4 + 1] = q[5]; C[n * 4 + 2] = q[6]; C[n * 4 + 3] = q[7];
      S[n] = q[3]; Rr[n] = 0;
      n++;
    }
    this.n = n;
    this.flush();
  }
}

// ---------- Flutwasser-Material
function floodMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3) }, uSunCol: { value: new THREE.Color(1, 0.95, 0.85) },
      uSky: { value: new THREE.Color(0.7, 0.8, 0.9) }, uNight: { value: 0 }, uFlow: { value: new THREE.Vector2(0.4, 0.2) },
    }]),
    vertexShader: `
attribute float aDepth;
varying float vDepth; varying vec3 vWP;
#include <fog_pars_vertex>
void main() {
  vDepth = aDepth;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `
uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSky; uniform float uNight; uniform vec2 uFlow;
varying float vDepth; varying vec3 vWP;
#include <fog_pars_fragment>
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
void main() {
  float a = smoothstep(0.0, 0.2, vDepth);
  if (a < 0.01) discard;
  vec2 p = vWP.xz;
  vec2 fl = uFlow * uTime;
  float n1 = vn(p * 2.6 - fl * 1.4);
  float n2 = vn(p * 6.5 - fl * 2.3 + vec2(3.1, 7.7));
  float n3 = vn(p * 15.0 - fl * 3.1);
  vec3 n = normalize(vec3((n1 - 0.5) * 0.5 + (n2 - 0.5) * 0.3 + (n3 - 0.5) * 0.12, 1.0, (n2 - 0.5) * 0.45 + (n1 - 0.5) * 0.2));
  vec3 V = normalize(cameraPosition - vWP);
  // Farben im linearen Farbraum (schlammiges Flusswasser)
  vec3 mud = vec3(0.24, 0.16, 0.08), deep = vec3(0.1, 0.08, 0.048);
  vec3 base = mix(mud, deep, smoothstep(0.2, 0.9, vDepth)) * (0.85 + 0.3 * n2);
  float diff = 0.55 + 0.45 * max(0.0, dot(n, normalize(uSunDir)));
  vec3 col = base * (uSky * 0.7 + uSunCol * diff * 0.9);
  vec3 H = normalize(normalize(uSunDir) + V);
  float spec = pow(max(0.0, dot(n, H)), 90.0) * (1.0 - uNight * 0.85);
  float fres = pow(1.0 - max(0.0, dot(n, V)), 5.0);
  col = mix(col, uSky * 0.35, fres * 0.5) + uSunCol * spec * 0.9;
  float foam = smoothstep(0.3, 0.05, vDepth) * smoothstep(0.5, 0.78, vn(p * 9.0 - fl * 2.0));
  foam += smoothstep(0.9, 0.97, n2) * 0.2;
  col = mix(col, vec3(0.42, 0.38, 0.3) * (0.4 + 0.6 * (1.0 - uNight)), clamp(foam, 0.0, 1.0) * 0.55);
  gl_FragColor = vec4(col, (0.55 + 0.4 * smoothstep(0.1, 0.6, vDepth)) * a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
    transparent: true, depthWrite: false, fog: true,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
}

// ---------- Bodenspuren (Schlamm, Brand, Krater-Staub): Datentextur über die ganze Karte
function decalMaterial(tex, W, H) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uMap: { value: null }, uSize: { value: new THREE.Vector2(W, H) }, uNight: { value: 0 } }]),
    vertexShader: `
varying vec3 vWP;
#include <fog_pars_vertex>
void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `
uniform sampler2D uMap; uniform vec2 uSize; uniform float uNight;
varying vec3 vWP;
#include <fog_pars_fragment>
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 uv = (vWP.xz + uSize * 0.5) / uSize;
  vec4 m = texture2D(uMap, uv);
  float nz = vn(vWP.xz * 3.0) * 0.6 + vn(vWP.xz * 11.0) * 0.4;
  float mud = smoothstep(0.15, 0.6, m.r * (0.55 + nz * 0.8));
  float burn = smoothstep(0.12, 0.55, m.g * (0.5 + nz * 0.9));
  float ash = step(0.78, vn(vWP.xz * 23.0)) * burn;
  vec3 col = vec3(0.0); float a = 0.0;
  if (mud > 0.0) { col = mix(vec3(0.42, 0.33, 0.21), vec3(0.3, 0.24, 0.16), nz); a = mud * 0.82; }
  if (burn > a) { col = mix(vec3(0.07, 0.06, 0.05), vec3(0.16, 0.14, 0.12), nz); col = mix(col, vec3(0.42, 0.4, 0.37), ash * 0.6); a = burn * 0.88; }
  if (a < 0.01) discard;
  col *= 1.0 - uNight * 0.55;
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
    transparent: true, depthWrite: false, fog: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
}

// ---------- Tornado-Trichter
function funnelGeometry() {
  const pts = [];
  const N = 30;
  for (let i = 0; i <= N; i++) {
    const v = i / N;
    pts.push(new THREE.Vector2(0.62 + 1.1 * v + 8.5 * Math.pow(v, 2.4), v * FUNNEL_H));
  }
  const geo = new THREE.LatheGeometry(pts, 40);
  return geo;
}
function funnelMaterial(layer) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uAlpha: { value: 1 }, uLean: { value: new THREE.Vector2(0, 0) }, uLight: { value: 1 } }]),
    vertexShader: `
uniform float uTime; uniform vec2 uLean;
varying vec2 vUv; varying float vH;
#include <fog_pars_vertex>
void main() {
  vUv = uv; vH = position.y / ${FUNNEL_H.toFixed(1)};
  vec3 p = position;
  float h = vH;
  p.x += uLean.x * h * h * 8.0 + sin(h * 5.0 + uTime * 1.3) * 0.7 * h;
  p.z += uLean.y * h * h * 8.0 + cos(h * 4.0 + uTime * 1.1) * 0.7 * h;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `
uniform float uTime; uniform float uAlpha; uniform float uLight;
varying vec2 vUv; varying float vH;
#include <fog_pars_fragment>
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
void main() {
  float u = vUv.x * ${layer ? '10.0' : '14.0'};
  float sp = uTime * ${layer ? '1.6' : '3.2'};
  float band = vn(vec2(u + vH * 9.0 - sp, vH * 18.0 - uTime * 2.0));
  float band2 = vn(vec2(u * 2.0 + vH * 14.0 - sp * 1.7, vH * 40.0));
  float d = band * 0.65 + band2 * 0.35;
  float edge = smoothstep(0.0, 0.08, vH) * (1.0 - smoothstep(0.82, 1.0, vH));
  float a = (${layer ? '0.16 + 0.34' : '0.42 + 0.5'} * d) * edge * uAlpha;
  vec3 dust = vec3(0.2, 0.15, 0.11), cloud = vec3(0.13, 0.135, 0.15);
  vec3 col = mix(dust, cloud, smoothstep(0.02, 0.45, vH)) * (0.6 + 0.7 * d) * uLight;
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
  });
}
function wallCloudMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uAlpha: { value: 1 }, uLight: { value: 1 } }]),
    vertexShader: `
varying vec2 vP;
#include <fog_pars_vertex>
void main() { vP = position.xy; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `
uniform float uTime; uniform float uAlpha; uniform float uLight; varying vec2 vP;
#include <fog_pars_fragment>
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
void main() {
  float r = length(vP) / 18.0;
  float ang = atan(vP.y, vP.x);
  float sw = ang + r * 4.0 - uTime * 0.35;
  float n = vn(vec2(cos(sw), sin(sw)) * 3.0 + r * 5.0) * 0.6 + vn(vP * 0.4 + uTime * 0.05) * 0.4;
  float a = (1.0 - smoothstep(0.3, 1.0, r)) * (0.55 + 0.45 * n) * 0.92 * uAlpha;
  vec3 col = mix(vec3(0.05, 0.055, 0.065), vec3(0.17, 0.18, 0.2), n) * uLight;
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
  });
}

// Gezackter Blitzkanal (Mittelpunkt-Verschiebung) mit Verästelungen
function boltPath(x0, y0, z0, x1, y1, z1) {
  const out = [];
  const seg = (ax, ay, az, bx, by, bz, disp, depth, main) => {
    if (depth <= 0) { out.push([ax, ay, az, bx, by, bz, main]); return; }
    const mx = (ax + bx) / 2 + (rand() - 0.5) * disp, my = (ay + by) / 2 + (rand() - 0.5) * disp * 0.3, mz = (az + bz) / 2 + (rand() - 0.5) * disp;
    seg(ax, ay, az, mx, my, mz, disp * 0.55, depth - 1, main);
    seg(mx, my, mz, bx, by, bz, disp * 0.55, depth - 1, main);
    if (main && depth >= 3 && rand() < 0.35) {
      const l = Math.hypot(bx - ax, by - ay, bz - az);
      const ex = mx + (rand() - 0.5) * l * 0.9, ey = my - l * (0.35 + rand() * 0.4), ez = mz + (rand() - 0.5) * l * 0.9;
      seg(mx, my, mz, ex, Math.max(y1 + 1, ey), ez, disp * 0.5, depth - 2, false);
    }
  };
  seg(x0, y0, z0, x1, y1, z1, Math.hypot(x1 - x0, z1 - z0) * 0.25 + 6, 7, true);
  // in Punkte zerlegen
  const pts = [];
  for (const [ax, ay, az, bx, by, bz, main] of out) {
    const l = Math.hypot(bx - ax, by - ay, bz - az);
    const n = Math.max(1, Math.ceil(l / 0.22));
    for (let k = 0; k < n; k++) { const t = k / n; pts.push(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t, main ? 1 : 0.45); }
  }
  return pts;
}

registerView(class DisasterView {
  constructor(engine) {
    this.e = engine;
    this.g = engine.game;
    const g = this.g;
    const q = engine.settings && engine.settings.quality;
    this.budget = q === 'low' ? 0.45 : q === 'high' || q === 'ultra' ? 1.2 : 1;
    this.group = new THREE.Group();
    this.group.name = 'Katastrophen-Effekte';
    engine.scene.add(this.group);
    this.glow = new Particles(Math.round(5000 * this.budget), glowTex(), true);
    this.glow.points.renderOrder = 9;
    this.smoke = new Particles(Math.round(3600 * this.budget), smokeTex(), false);
    this.smoke.points.renderOrder = 8;
    this.group.add(this.smoke.points, this.glow.points);
    this.floods = new Map();
    this.floodMat = floodMaterial();
    // Bodenspuren
    this.decalData = new Uint8Array(g.W * g.H * 4);
    this.decalTex = new THREE.DataTexture(this.decalData, g.W, g.H, THREE.RGBAFormat);
    this.decalTex.magFilter = THREE.LinearFilter; this.decalTex.minFilter = THREE.LinearFilter; this.decalTex.flipY = false;
    this.decalTex.needsUpdate = true;
    this.decalMat = decalMaterial(this.decalTex, g.W, g.H);
    this.decalMat.uniforms.uMap.value = this.decalTex;
    const dgeo = new THREE.PlaneGeometry(g.W, g.H, 1, 1); dgeo.rotateX(-Math.PI / 2);
    this.decal = new THREE.Mesh(dgeo, this.decalMat);
    this.decal.position.y = 0.018;
    this.decal.renderOrder = 2;
    this.decal.visible = false;
    this.decal.frustumCulled = false;
    this.group.add(this.decal);
    this.decalKey = '';
    // Tornado
    this.funnel = null;
    // Krater, Risse, Ringe
    this.craters = new Map();
    this.cracks = new Map();
    this.ringGeo = new THREE.RingGeometry(0.92, 1, 72, 1); this.ringGeo.rotateX(-Math.PI / 2);
    this.discGeo = new THREE.CircleGeometry(1, 72); this.discGeo.rotateX(-Math.PI / 2);
    this.rings = [];
    this.waves = [];
    this.bolts = [];
    this.seenStrikes = new Set();
    this.seenImpacts = new Set();
    this.impacts = [];
    this.flash = 0;
    this.shake = 0;
    this.emitAcc = 0;
    this.sirenTimer = 0;
    this.lastTime = this.g.time;
    claimLightning(g);
    this._v = new THREE.Vector3();
    this._v2 = new THREE.Vector2();
  }

  W2(x) { return x - this.g.W / 2; }
  H2(y) { return y - this.g.H / 2; }

  // ---------- pro Bild
  frame(dt, simDt) {
    const g = this.g, st = g.ext && g.ext.disasters, w = (g.ext && g.ext.weather) || {};
    if (!st) return;
    const running = simDt > 0;
    const pdt = running ? dt : 0;
    this.running = running; this.pdt = pdt;
    const night = this.e.night || 0;
    const time = performance.now() / 1000;
    this.e.renderer.getDrawingBufferSize(this._v2);
    const scale = this._v2.y * 0.9;
    this.glow.mat.uniforms.uScale.value = scale;
    this.smoke.mat.uniforms.uScale.value = scale;
    const cam = this.e.camera.position;
    const tgt = this.e.rig ? this.e.rig.target : new THREE.Vector3();
    const camDist = this.e.rig ? this.e.rig.cur.dist : 40;
    const statics = [];

    this.updateFloods(st, time);
    this.updateDecals(st);
    this.updateTornado(st, w, pdt, time, night, running);
    this.updateQuakes(st, dt, time);
    this.updateMeteors(st, pdt, time, statics, running);
    this.updateWildfires(st, w, pdt, night, running);
    this.updateLightning(st, w, dt, statics, tgt, camDist);
    this.updateStormDebris(st, w, pdt, tgt, camDist, running);
    this.updateHazards(st, time, statics, night);
    this.updateRescue(st, time, statics);
    this.updateRepairs(st, pdt, night, tgt, camDist, running);

    // Kamerawackeln (Erdbeben, Einschläge, nahe Tornados)
    if (this.shake > 0.001) {
      const a = this.shake * Math.min(30, camDist) * 0.02;
      const t = time;
      const ox = (Math.sin(t * 37.1) + Math.sin(t * 23.7 + 1.3) * 0.6) * a;
      const oy = (Math.sin(t * 41.3 + 0.7) * 0.6 + Math.sin(t * 17.9) * 0.4) * a * 0.6;
      const oz = (Math.sin(t * 29.3 + 2.1) + Math.sin(t * 19.1 + 0.4) * 0.5) * a;
      cam.x += ox; cam.y += oy; cam.z += oz;
      this.e.camera.rotateZ(Math.sin(t * 31.7) * this.shake * 0.012);
      this.e.camera.updateMatrixWorld();
    }
    this.shake = 0;

    // Blitzflackern für den Himmel (G1 liest g.ext.weather.lightning)
    this.flash = Math.max(0, this.flash - dt * 7);
    if (g.ext.weather) g.ext.weather.lightning = clamp(this.flash, 0, 1);

    this.smoke.update(pdt, 1 - night * 0.7);
    this.glow.update(pdt, 1);
    if (statics.length) this.glow.addStatic(statics);
    this.lastTime = g.time;
  }

  // ---------- Hochwasser
  updateFloods(st, time) {
    const g = this.g;
    const live = new Set();
    for (const a of st.active) {
      if (a.type !== 'flood' || !a.data.tiles) continue;
      live.add(a.id);
      let F = this.floods.get(a.id);
      if (!F) { F = this.buildFlood(a); if (!F) continue; this.floods.set(a.id, F); }
      // Pegel aktualisieren
      const T = g.time;
      const depth = F.tileDepth;
      const lvl = clamp(floodDepth(a, 1, T) * 1.1, 0, 1);
      for (let k = 0; k < F.tiles.length; k++) depth[F.tiles[k]] = F.dist[k] ? floodDepth(a, F.dist[k], T) : lvl;
      F.level = lvl;
      F.T = T;
      const { bw, bh } = F;
      const pos = F.geo.attributes.position.array, dep = F.geo.attributes.aDepth.array;
      let vi = 0, maxD = 0;
      for (let vy = 0; vy <= bh; vy++) for (let vx = 0; vx <= bw; vx++) {
        let s = 0, n = 0;
        for (const [ox, oy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
          const tx = vx + ox, ty = vy + oy;
          if (tx < 0 || ty < 0 || tx >= bw || ty >= bh) { n++; continue; }
          s += depth[ty * bw + tx]; n++;
        }
        const d = s / n;
        maxD = Math.max(maxD, d);
        dep[vi] = d;
        pos[vi * 3 + 1] = 0.012 + d * 0.13;
        vi++;
      }
      F.geo.attributes.position.needsUpdate = true;
      F.geo.attributes.aDepth.needsUpdate = true;
      F.mesh.visible = maxD > 0.01;
    }
    for (const [id, F] of this.floods) if (!live.has(id)) { this.group.remove(F.mesh); F.geo.dispose(); this.floods.delete(id); }
    // Treibgut und Schaumflocken, die mit der Strömung ziehen
    if (this.running && this.floods.size) {
      const wd = this.g.ext.weather?.windDir ?? 0;
      for (const F of this.floods.values()) {
        if (!F.level || F.level < 0.3) continue;
        const n = Math.round(F.tiles.length * 0.02 * this.budget * this.pdt * 6);
        for (let k = 0; k < n && !this.smoke.full(0.85); k++) {
          const j = Math.floor(rand() * F.tiles.length);
          const ti = F.tiles[j];
          const d = F.tileDepth[ti];
          if (d < 0.4) continue;
          const x = this.W2(F.x0 + (ti % F.bw) + rand()), z = this.H2(F.y0 + Math.floor(ti / F.bw) + rand());
          const wood = rand() < 0.45;
          const c = wood ? 0.16 + rand() * 0.1 : 0.62 + rand() * 0.1;
          this.smoke.add({ x, y: 0.014 + d * 0.13, z, vx: Math.cos(wd) * 0.18, vy: 0, vz: Math.sin(wd) * 0.18, age: 0, life: 5 + rand() * 5, s0: wood ? 0.08 : 0.16, s1: wood ? 0.08 : 0.3, r: c, g: c * 0.85, b: c * 0.7, a: wood ? 0.95 : 0.35, fadeIn: 0.2, fadeOut: 3, night: true, rot: rand() * 6, vr: (rand() - 0.5) * 0.4 });
        }
      }
    }
    if (this.floods.size) {
      const u = this.floodMat.uniforms;
      u.uTime.value = time;
      const sun = this.e.sun;
      if (sun) {
        this._v.copy(sun.position).sub(sun.target ? sun.target.position : new THREE.Vector3()).normalize();
        u.uSunDir.value.copy(this._v);
        u.uSunCol.value.copy(sun.color).multiplyScalar(Math.min(1.3, sun.intensity / 2.2));
      }
      if (this.e.hemi) u.uSky.value.copy(this.e.hemi.color).multiplyScalar(Math.min(1.2, this.e.hemi.intensity * 0.75));
      u.uNight.value = this.e.night || 0;
      const wd = this.g.ext.weather?.windDir ?? 0;
      u.uFlow.value.set(Math.cos(wd) * 0.35, Math.sin(wd) * 0.35);
    }
  }
  buildFlood(a) {
    const g = this.g, T = a.data.tiles;
    if (!T.length) return null;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let k = 0; k < T.length; k += 2) { const x = T[k] % g.W, y = Math.floor(T[k] / g.W); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    x0 -= 1; y0 -= 1; x1 += 1; y1 += 1;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const tiles = [], dist = [];
    for (let k = 0; k < T.length; k += 2) { const x = T[k] % g.W, y = Math.floor(T[k] / g.W); tiles.push((y - y0) * bw + (x - x0)); dist.push(T[k + 1]); }
    // Wasserfelder im Umfeld: die Flut deckt Ufer und Böschungen zu (Abstand 0)
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= g.W || y >= g.H) continue;
      if (g.world.terrain[y * g.W + x] === T_WATER) { tiles.push((y - y0) * bw + (x - x0)); dist.push(0); }
    }
    const nv = (bw + 1) * (bh + 1);
    const pos = new Float32Array(nv * 3), dep = new Float32Array(nv);
    let vi = 0;
    for (let vy = 0; vy <= bh; vy++) for (let vx = 0; vx <= bw; vx++) { pos[vi * 3] = this.W2(x0 + vx); pos[vi * 3 + 1] = 0.01; pos[vi * 3 + 2] = this.H2(y0 + vy); vi++; }
    const idx = [];
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const i0 = y * (bw + 1) + x, i1 = i0 + 1, i2 = i0 + bw + 1, i3 = i2 + 1;
      idx.push(i0, i2, i1, i1, i2, i3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aDepth', new THREE.BufferAttribute(dep, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, this.floodMat);
    mesh.renderOrder = 3;
    mesh.frustumCulled = false;
    this.group.add(mesh);
    return { mesh, geo, bw, bh, x0, y0, tiles, dist, tileDepth: new Float32Array(bw * bh), level: 0 };
  }

  // ---------- Schlamm-, Brand- und Aschespuren
  updateDecals(st) {
    const key = `${st.mud.length}:${st.scorch.length}:${st.mud[1] || 0}:${st.scorch[st.scorch.length - 1] || 0}:${st.active.filter((a) => a.type === 'wildfire').map((a) => a.data.burning.length).join(',')}`;
    if (key === this.decalKey) return;
    this.decalKey = key;
    const d = this.decalData;
    d.fill(0);
    let any = false;
    for (let k = 0; k < st.mud.length; k += 2) { const i = st.mud[k]; d[i * 4] = Math.min(255, 110 + st.mud[k + 1] * 48); any = true; }
    for (let k = 0; k < st.scorch.length; k += 2) { const i = st.scorch[k]; d[i * 4 + 1] = Math.max(d[i * 4 + 1], Math.min(255, 120 + st.scorch[k + 1] * 17)); any = true; }
    for (const a of st.active) {
      if (a.type !== 'wildfire') continue;
      const B = a.data.burning;
      for (let k = 0; k < B.length; k += 2) { d[B[k] * 4 + 1] = Math.max(d[B[k] * 4 + 1], 90 + Math.min(120, B[k + 1] * 30)); any = true; }
    }
    this.decalTex.needsUpdate = true;
    this.decal.visible = any;
  }

  // ---------- Tornado
  updateTornado(st, w, dt, time, night, running) {
    const g = this.g;
    const a = st.active.find((x) => x.type === 'tornado' && x.data && x.data.x0 !== undefined);
    if (!a) { if (this.funnel) this.funnel.group.visible = false; return; }
    if (!this.funnel) {
      const grp = new THREE.Group();
      const geo = funnelGeometry();
      const inner = new THREE.Mesh(geo, funnelMaterial(0));
      const outer = new THREE.Mesh(geo, funnelMaterial(1));
      outer.scale.set(1.45, 1.02, 1.45);
      const cloud = new THREE.Mesh(new THREE.CircleGeometry(18, 48), wallCloudMaterial());
      cloud.rotation.x = -Math.PI / 2;
      cloud.position.y = FUNNEL_H - 0.4;
      const shade = new THREE.Mesh(this.discGeo, new THREE.ShaderMaterial({
        uniforms: { uAlpha: { value: 0.3 } },
        vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform float uAlpha; varying vec2 vP; void main(){ float r = length(vP); gl_FragColor = vec4(0.02, 0.025, 0.04, uAlpha * (1.0 - smoothstep(0.25, 1.0, r))); }',
        transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      }));
      shade.scale.set(24, 1, 24);
      shade.position.y = 0.03;
      inner.renderOrder = outer.renderOrder = cloud.renderOrder = 10;
      shade.renderOrder = 4;
      inner.frustumCulled = outer.frustumCulled = cloud.frustumCulled = shade.frustumCulled = false;
      grp.add(shade, outer, inner, cloud);
      this.group.add(grp);
      this.funnel = { group: grp, inner, outer, cloud, shade };
    }
    const F = this.funnel;
    const p = tornadoPos(a, g.time);
    const x = this.W2(p.x), z = this.H2(p.y);
    const s = clamp(p.strength, 0, 1);
    F.group.visible = s > 0.02;
    F.group.position.set(x, 0, z);
    const r = (a.data.rad || 1.5) * (0.55 + 0.45 * s);
    F.inner.scale.set(r * 0.8, 1, r * 0.8);
    F.outer.scale.set(r * 1.25, 1.02, r * 1.25);
    F.shade.material.uniforms.uAlpha.value = 0.5 * smooth(s * 2) * (1 - night * 0.6);
    const wd = w.windDir ?? 0;
    const light = 1 - night * 0.65;
    for (const m of [F.inner, F.outer, F.cloud]) {
      const u = m.material.uniforms;
      u.uTime.value = time;
      u.uAlpha.value = smooth(s * 1.6);
      u.uLight.value = light;
      if (u.uLean) u.uLean.value.set(Math.cos(wd) * 0.6, Math.sin(wd) * 0.6);
    }
    F.cloud.rotation.z = time * 0.08;
    // Kamerawackeln in der Nähe
    const tg = this.e.rig ? this.e.rig.target : null;
    if (tg) { const d = Math.hypot(tg.x - x, tg.z - z); this.shake = Math.max(this.shake, s * 0.35 / (1 + (d / 8) ** 2)); }
    if (!running) return;
    // Staubwalze am Boden und Trümmer
    const B = this.budget;
    const n = Math.round(110 * dt * s * B * 6) + (rand() < 0.5 ? 1 : 0);
    for (let k = 0; k < n && !this.smoke.full(0.9); k++) {
      const ang = rand() * Math.PI * 2, rr = r * (0.5 + rand() * 1.6);
      const sh = 0.75 + rand() * 0.3;
      const hi = rand() < 0.3;
      this.smoke.add({ x: x + Math.cos(ang) * rr, y: 0.1 + rand() * (hi ? 2.5 : 0.8), z: z + Math.sin(ang) * rr, cx: x, cz: z, swirl: 2.4 + rand() * 1.8, vx: 0, vy: 0.5 + rand() * (hi ? 3 : 1.2), vz: 0, drag: 0.5, age: 0, life: 1.8 + rand() * 2, s0: 1.4 + rand() * 0.8, s1: 3.5 + rand() * 2.5, r: 0.42 * sh, g: 0.35 * sh, b: 0.27 * sh, a: 0.62, fadeIn: 0.12, night: true, rot: rand() * 6, vr: (rand() - 0.5) * 2 });
    }
    const nd = Math.round(40 * dt * s * B * 5);
    for (let k = 0; k < nd && !this.smoke.full(0.95); k++) {
      const ang = rand() * Math.PI * 2, rr = r * (0.4 + rand() * 1.2);
      const c = 0.12 + rand() * 0.2;
      this.smoke.add({ x: x + Math.cos(ang) * rr, y: 0.2 + rand() * 1, z: z + Math.sin(ang) * rr, cx: x, cz: z, swirl: 3 + rand() * 2.5, vx: 0, vy: 2 + rand() * 4, vz: 0, drag: 0.3, grav: 0.4, age: 0, life: 2 + rand() * 2.5, s0: 0.06 + rand() * 0.1, s1: 0.06, r: c, g: c * 0.9, b: c * 0.8, a: 0.95, night: true, rot: rand() * 6, vr: (rand() - 0.5) * 12 });
    }
  }

  // ---------- Erdbeben: Wackeln, Staub, Risse
  updateQuakes(st, dt, time) {
    const g = this.g;
    for (const a of st.active) {
      if (a.type !== 'quake') continue;
      const s = quakeShake(a, g.time);
      const tg = this.e.rig ? this.e.rig.target : null;
      let f = 1;
      if (tg) { const d = Math.hypot(tg.x - this.W2(a.x), tg.z - this.H2(a.y)); f = 1 / (1 + (d / Math.max(8, a.r * 1.4)) ** 2); }
      this.shake = Math.max(this.shake, s * f * 1.4);
      if (!this.cracks.has(a.id) && !a.aftershock) {
        const tex = crackTex();
        const m = new THREE.Mesh(this.discGeo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
        const size = Math.min(14, 3 + a.r * 0.45);
        m.scale.set(size, 1, size);
        m.position.set(this.W2(a.x), 0.022, this.H2(a.y));
        m.rotation.y = rand() * Math.PI * 2;
        m.renderOrder = 3;
        this.group.add(m);
        this.cracks.set(a.id, { mesh: m, t0: a.t0 });
      }
      // Staubwolken über einstürzenden Gebäuden
      if (s > 0.05 && rand() < dt * 30 * s) this.dustBurst(a.x + (rand() - 0.5) * a.r * 1.2, a.y + (rand() - 0.5) * a.r * 1.2, 1);
    }
    for (const [id, c] of this.cracks) {
      const age = g.time - c.t0;
      const op = age < 2 * 1440 ? 0.85 * (1 - smooth((age - 1440) / 1440)) : 0;
      c.mesh.material.opacity = op;
      if (op <= 0.01) { this.group.remove(c.mesh); c.mesh.material.map.dispose(); c.mesh.material.dispose(); this.cracks.delete(id); }
    }
  }
  dustBurst(tx, ty, k = 1) {
    const x = this.W2(tx), z = this.H2(ty);
    for (let i = 0; i < 6 * k && !this.smoke.full(0.92); i++) {
      const c = 0.62 + rand() * 0.15;
      this.smoke.add({ x: x + (rand() - 0.5) * 0.8, y: 0.1 + rand() * 0.4, z: z + (rand() - 0.5) * 0.8, vx: (rand() - 0.5) * 1.2, vy: 0.4 + rand() * 0.8, vz: (rand() - 0.5) * 1.2, drag: 1.4, age: 0, life: 2.5 + rand() * 2, s0: 0.6, s1: 2.6 + rand(), r: c, g: c * 0.92, b: c * 0.82, a: 0.55, fadeIn: 0.1, night: true, rot: rand() * 6, vr: (rand() - 0.5) });
    }
  }

  // ---------- Meteor: Anflug, Einschlag, Krater mit Glut
  updateMeteors(st, dt, time, statics, running) {
    const g = this.g;
    for (const a of st.active) {
      if (a.type !== 'meteor' || !a.data) continue;
      const m = meteorState(a, g.time);
      const tx = this.W2(a.x), tz = this.H2(a.y);
      if (!m.impacted) {
        const u = m.u;
        const dx = Math.cos(m.az), dz = Math.sin(m.az);
        const D = 170 * (1 - u), Hh = 130 * (1 - u);
        const x = tx + dx * D, y = Hh + 0.2, z = tz + dz * D;
        const sz = 1.2 + u * 1.8;
        statics.push([x, y, z, sz * 5, 1, 0.55, 0.2, 0.55], [x, y, z, sz * 2.2, 1, 0.85, 0.55, 0.9], [x, y, z, sz, 1, 1, 0.95, 1]);
        this.flash = Math.max(this.flash, u > 0.85 ? (u - 0.85) * 2 : 0);
        this.shake = Math.max(this.shake, u > 0.7 ? (u - 0.7) * 0.5 : 0);
        if (running) {
          const n = Math.ceil(dt * 90 * this.budget);
          for (let k = 0; k < n; k++) {
            const j = rand() * 0.6;
            this.glow.add({ x: x + dx * j * 3, y: y + j * 2.3, z: z + dz * j * 3, vx: (rand() - 0.5) * 0.6, vy: (rand() - 0.5) * 0.6, vz: (rand() - 0.5) * 0.6, drag: 1, age: 0, life: 0.5 + rand() * 0.6, s0: sz * (1.4 + rand()), s1: sz * 0.3, r: 1, g: 0.45 + rand() * 0.3, b: 0.12, a: 0.7, fadeOut: 1.2 });
            if (rand() < 0.5) this.smoke.add({ x: x + dx * j * 2, y: y + j * 1.5, z: z + dz * j * 2, vx: 0, vy: 0.1, vz: 0, drag: 0.5, age: 0, life: 4 + rand() * 3, s0: sz * 1.2, s1: sz * 4, r: 0.36, g: 0.34, b: 0.33, a: 0.35, night: true, rot: rand() * 6 });
          }
        }
        // Ziel markieren
        statics.push([tx, 0.15, tz, 3.5 + Math.sin(time * 8) * 0.5, 1, 0.25, 0.15, 0.5]);
      } else if (!this.seenImpacts.has(a.id)) {
        this.seenImpacts.add(a.id);
        this.impacts.push({ x: tx, z: tz, r: a.r, t0: time });
      }
    }
    // Einschlagsanimation in Echtzeit (2,5 s)
    const keep = [];
    for (const im of this.impacts) {
      const t = time - im.t0;
      if (t > 3) { if (im.ring) { this.group.remove(im.ring); im.ring.material.dispose(); } continue; }
      keep.push(im);
      if (!im.burst) {
        im.burst = true;
        this.flash = 1.4;
        for (let k = 0; k < 260 * this.budget; k++) {
          const ang = rand() * Math.PI * 2, el = 0.3 + rand() * 1.1, v = 4 + rand() * 9;
          const hot = rand() < 0.55;
          (hot ? this.glow : this.smoke).add({ x: im.x, y: 0.3, z: im.z, vx: Math.cos(ang) * Math.cos(el) * v, vy: Math.sin(el) * v, vz: Math.sin(ang) * Math.cos(el) * v, drag: 0.7, grav: 6, floor: 0.05, age: 0, life: 1.4 + rand() * 1.6, s0: hot ? 0.35 : 0.25, s1: hot ? 0.1 : 0.2, r: hot ? 1 : 0.2, g: hot ? 0.5 + rand() * 0.3 : 0.17, b: hot ? 0.15 : 0.14, a: 0.95, night: !hot });
        }
        for (let k = 0; k < 70 * this.budget; k++) {
          const ang = rand() * Math.PI * 2, v = 2 + rand() * 4;
          const c = 0.45 + rand() * 0.15;
          this.smoke.add({ x: im.x, y: 0.4 + rand(), z: im.z, vx: Math.cos(ang) * v, vy: 0.5 + rand() * 2.5, vz: Math.sin(ang) * v, drag: 0.9, age: 0, life: 4 + rand() * 3, s0: 1.5, s1: 5 + rand() * 3, r: c, g: c * 0.9, b: c * 0.8, a: 0.6, night: true, rot: rand() * 6, vr: (rand() - 0.5) * 0.6 });
        }
        im.ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xffe3b0, transparent: true, depthWrite: false, opacity: 0.9, blending: THREE.AdditiveBlending }));
        im.ring.position.set(im.x, 0.2, im.z);
        im.ring.renderOrder = 11;
        this.group.add(im.ring);
      }
      const rr = 0.5 + smooth(t / 1.4) * (im.r * 6 + 6);
      im.ring.scale.set(rr, 1, rr);
      im.ring.material.opacity = Math.max(0, 0.9 * (1 - t / 1.6));
      statics.push([im.x, 1.5, im.z, (12 + im.r * 4) * Math.max(0, 1 - t / 0.6), 1, 0.8, 0.55, Math.max(0, 1 - t / 0.6)]);
      this.shake = Math.max(this.shake, Math.max(0, 1.3 * (1 - t / 2)));
    }
    this.impacts = keep;
    // Krater: Schüssel, Glut, Rauch
    const live = new Set();
    for (const c of st.craters) {
      const id = `${c.x},${c.y},${c.t}`;
      live.add(id);
      let K = this.craters.get(id);
      if (!K) {
        const mat = new THREE.MeshBasicMaterial({ map: craterTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
        const mesh = new THREE.Mesh(this.discGeo, mat);
        const s = c.r * 2.5;
        mesh.scale.set(s, 1, s);
        mesh.position.set(this.W2(c.x), 0.024, this.H2(c.y));
        mesh.rotation.y = rand() * 6.28;
        mesh.renderOrder = 3;
        this.group.add(mesh);
        K = { mesh, embers: Array.from({ length: 60 }, () => { const ang = rand() * 6.28, d = Math.sqrt(rand()) * c.r * 0.8; return [Math.cos(ang) * d, Math.sin(ang) * d, rand() * 6.28, 0.4 + rand()]; }) };
        this.craters.set(id, K);
      }
      const age = g.time - c.t;
      const heat = clamp(1 - age / (1.6 * 1440), 0, 1);
      K.mesh.material.opacity = clamp(c.days / 2, 0, 1);
      if (heat > 0) {
        const cx = this.W2(c.x), cz = this.H2(c.y);
        for (const e of K.embers) {
          const fl = 0.55 + 0.45 * Math.sin(time * (2 + e[3] * 3) + e[2]);
          const h = heat * fl;
          statics.push([cx + e[0], 0.08, cz + e[1], 0.35 + e[3] * 0.5, 1, 0.3 + 0.35 * h, 0.06, 0.6 * h + 0.1 * heat]);
        }
        statics.push([cx, 0.3, cz, c.r * 4, 1, 0.35, 0.08, 0.25 * heat]);
        if (running && rand() < dt * 10 * heat) {
          const s = 0.18 + rand() * 0.1;
          this.smoke.add({ x: cx + (rand() - 0.5) * c.r, y: 0.2, z: cz + (rand() - 0.5) * c.r, vx: 0.2, vy: 0.7 + rand() * 0.5, vz: 0.1, drag: 0.2, age: 0, life: 6 + rand() * 4, s0: 0.8, s1: 4 + rand() * 2, r: s, g: s, b: s, a: 0.45 * Math.min(1, heat * 2), fadeIn: 0.1, night: true, rot: rand() * 6, vr: 0.2 });
        }
      }
    }
    for (const [id, K] of this.craters) if (!live.has(id)) { this.group.remove(K.mesh); K.mesh.material.map.dispose(); K.mesh.material.dispose(); this.craters.delete(id); }
  }

  // ---------- Waldbrand
  updateWildfires(st, w, dt, night, running) {
    if (!running) return;
    const g = this.g;
    const wd = w.windDir ?? 0, wind = w.wind ?? 0.2;
    const wx = Math.cos(wd) * (0.2 + wind * 1.2), wz = Math.sin(wd) * (0.2 + wind * 1.2);
    const cam = this.e.rig ? this.e.rig.target : new THREE.Vector3();
    for (const a of st.active) {
      if (a.type !== 'wildfire' || !a.data.burning) continue;
      const B = a.data.burning;
      // die nächsten 180 Felder zur Kamera
      let list = [];
      for (let k = 0; k < B.length; k += 2) { const i = B[k]; const x = this.W2(i % g.W + 0.5), z = this.H2(Math.floor(i / g.W) + 0.5); list.push([x, z, B[k + 1], (x - cam.x) ** 2 + (z - cam.z) ** 2]); }
      if (list.length > 180) list = list.sort((p, q) => p[3] - q[3]).slice(0, 180);
      const fr = this.budget;
      for (const [x, z, h] of list) {
        const young = h < 1 ? 0.6 : 1;
        if (rand() < dt * 9 * fr * young && !this.glow.full(0.9)) {
          this.glow.add({ x: x + (rand() - 0.5) * 0.8, y: 0.15 + rand() * 0.6, z: z + (rand() - 0.5) * 0.8, vx: wx * 0.3, vy: 0.9 + rand() * 0.9, vz: wz * 0.3, drag: 0.8, age: 0, life: 0.5 + rand() * 0.5, s0: 0.55 + rand() * 0.5, s1: 0.15, r: 1, g: 0.42 + rand() * 0.3, b: 0.1, a: 0.75, flicker: 18, ph: rand() * 6 });
        }
        if (rand() < dt * 2.2 * fr && !this.smoke.full(0.9)) {
          const c = 0.18 + rand() * 0.12;
          this.smoke.add({ x: x + (rand() - 0.5) * 0.6, y: 0.8 + rand() * 0.4, z: z + (rand() - 0.5) * 0.6, vx: wx, vy: 0.9 + rand() * 0.6, vz: wz, drag: 0.15, age: 0, life: 4.5 + rand() * 3, s0: 0.9, s1: 3.6 + rand() * 2.2, r: c, g: c * 0.95, b: c * 0.9, a: 0.5, fadeIn: 0.12, night: true, rot: rand() * 6, vr: (rand() - 0.5) * 0.5 });
        }
        if (rand() < dt * 1.2 * fr) this.glow.add({ x, y: 0.5, z, vx: wx * 1.5 + (rand() - 0.5), vy: 1.5 + rand() * 2, vz: wz * 1.5 + (rand() - 0.5), drag: 0.6, grav: 0.4, age: 0, life: 1.5 + rand() * 1.5, s0: 0.08, s1: 0.05, r: 1, g: 0.6, b: 0.2, a: 1, flicker: 25, ph: rand() * 6 });
      }
      // Glühen am Boden (nachts besonders sichtbar)
      if (night > 0.2) for (let k = 0; k < Math.min(list.length, 60); k++) { const [x, z] = list[k]; this.glow.add({ x, y: 0.3, z, vx: 0, vy: 0, vz: 0, age: 0, life: 0.05, s0: 2.4, s1: 2.4, r: 1, g: 0.4, b: 0.1, a: 0.12 * night }); }
    }
  }

  // ---------- Blitze
  updateLightning(st, w, dt, statics, tgt, camDist) {
    const g = this.g;
    const time = performance.now() / 1000;
    for (const s of st.strikes) {
      if (this.seenStrikes.has(s.seed)) continue;
      this.seenStrikes.add(s.seed);
      if (g.time - s.t > 30) continue;
      const x = this.W2(s.x), z = this.H2(s.y), y = s.h || 0;
      this.bolts.push({ pts: boltPath(x + (rand() - 0.5) * 10, 38, z + (rand() - 0.5) * 10, x, y, z), t0: time, life: 0.55, x, y, z, ground: true });
      this.flash = Math.max(this.flash, 1);
    }
    if (this.seenStrikes.size > 200) this.seenStrikes = new Set([...this.seenStrikes].slice(-60));
    // Wetterleuchten und Zierblitze in der Ferne
    const si = w.stormI || 0;
    if (si > 0.1 && dt > 0) {
      if (rand() < dt * 0.5 * si) this.flash = Math.max(this.flash, 0.35 + rand() * 0.45);
      if (rand() < dt * 0.22 * si) {
        const ang = rand() * Math.PI * 2, d = Math.max(18, camDist * (0.6 + rand() * 0.8));
        const x = tgt.x + Math.cos(ang) * d, z = tgt.z + Math.sin(ang) * d;
        this.bolts.push({ pts: boltPath(x + (rand() - 0.5) * 8, 40, z + (rand() - 0.5) * 8, x, 0, z), t0: time, life: 0.45, x, y: 0, z, ground: true });
        this.flash = Math.max(this.flash, 0.7);
      }
    }
    const keep = [];
    for (const b of this.bolts) {
      const t = time - b.t0;
      if (t > b.life) continue;
      keep.push(b);
      // dreifaches Aufflackern
      const vis = (t < 0.08 ? 1 : t < 0.14 ? 0.15 : t < 0.22 ? 0.85 : t < 0.3 ? 0.1 : 0.6 * (1 - (t - 0.3) / (b.life - 0.3)));
      if (vis < 0.05) continue;
      const P = b.pts;
      for (let k = 0; k < P.length; k += 4) {
        const m = P[k + 3];
        statics.push([P[k], P[k + 1], P[k + 2], 0.32 * m + 0.1, 0.9, 0.95, 1, vis * (0.55 + 0.45 * m)]);
        if ((k / 4) % 3 === 0) statics.push([P[k], P[k + 1], P[k + 2], 1.6 * m + 0.4, 0.45, 0.55, 1, vis * 0.16 * m]);
      }
      if (b.ground) statics.push([b.x, b.y + 0.3, b.z, 5, 0.7, 0.8, 1, vis * 0.6]);
    }
    this.bolts = keep;
  }

  // ---------- Sturm: fliegende Blätter und Trümmer
  updateStormDebris(st, w, dt, tgt, camDist, running) {
    if (!running) return;
    const wind = w.wind || 0;
    const storm = st.active.some((a) => a.type === 'storm');
    const k = storm ? Math.max(0.6, wind) : wind > 0.62 ? (wind - 0.62) * 2.5 : 0;
    if (k <= 0) return;
    const wd = w.windDir ?? 0;
    const sp = 3 + wind * 6;
    const vx = Math.cos(wd) * sp, vz = Math.sin(wd) * sp;
    const R = Math.min(40, camDist * 0.7);
    const n = Math.round(dt * 120 * k * this.budget) + (rand() < dt * 30 * k ? 1 : 0);
    for (let i = 0; i < n && !this.smoke.full(0.8); i++) {
      const x = tgt.x + (rand() - 0.5) * R * 2 - vx * 0.8, z = tgt.z + (rand() - 0.5) * R * 2 - vz * 0.8;
      const leaf = rand() < 0.7;
      const r = leaf ? 0.35 + rand() * 0.3 : 0.8, g = leaf ? 0.4 + rand() * 0.25 : 0.78, b = leaf ? 0.12 : 0.72;
      this.smoke.add({ x, y: 0.2 + rand() * 2.5, z, vx: vx * (0.7 + rand() * 0.6), vy: (rand() - 0.3) * 1.2, vz: vz * (0.7 + rand() * 0.6), drag: 0.05, grav: 0.3, floor: 0.03, age: 0, life: 2 + rand() * 2.5, s0: 0.07 + rand() * 0.06, s1: 0.07, r, g, b, a: 0.95, fadeOut: 4, night: true, rot: rand() * 6, vr: (rand() - 0.5) * 14 });
    }
    // Regenschleier am Boden bei Orkan
    if (storm && rand() < dt * 8 * this.budget) {
      const x = tgt.x + (rand() - 0.5) * R * 2, z = tgt.z + (rand() - 0.5) * R * 2;
      this.smoke.add({ x, y: 0.3, z, vx: vx * 0.8, vy: 0.1, vz: vz * 0.8, drag: 0.3, age: 0, life: 2.5, s0: 2, s1: 5, r: 0.78, g: 0.8, b: 0.84, a: 0.14, fadeIn: 0.3, night: true, rot: rand() * 6 });
    }
  }

  // ---------- Gefahrenzonen, Sirenen
  updateHazards(st, time, statics, night) {
    const g = this.g;
    const want = [];
    for (const p of st.planned) {
      if (!p.known || p.aftershock) continue;
      if (p.type === 'storm' || p.type === 'tornado' || p.type === 'quake') continue;
      const eta = p.at - g.time;
      if (eta > 3 * 1440) continue;
      const r = p.type === 'flood' ? 10 : p.type === 'meteor' ? p.r * 2.7 : p.r;
      want.push({ x: this.W2(p.x), z: this.H2(p.y), r, color: DISASTERS[p.type].color, urgent: eta < 240 });
      if (p.type === 'meteor') statics.push([this.W2(p.x), 0.4, this.H2(p.y), 2 + Math.sin(time * 6) * 0.4, 1, 0.3, 0.2, 0.6]);
    }
    while (this.rings.length < want.length) {
      const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, opacity: 0.6 }));
      const disc = new THREE.Mesh(this.discGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, opacity: 0.1 }));
      ring.renderOrder = disc.renderOrder = 4;
      this.group.add(ring, disc);
      this.rings.push({ ring, disc });
    }
    this.rings.forEach((R, k) => {
      const h = want[k];
      R.ring.visible = R.disc.visible = !!h;
      if (!h) return;
      const pulse = 0.5 + 0.5 * Math.sin(time * (h.urgent ? 6 : 2.5));
      R.ring.position.set(h.x, 0.05, h.z); R.disc.position.set(h.x, 0.045, h.z);
      R.ring.scale.set(h.r, 1, h.r); R.disc.scale.set(h.r, 1, h.r);
      R.ring.material.color.set(h.color); R.disc.material.color.set(h.color);
      R.ring.material.opacity = 0.45 + 0.4 * pulse;
      R.disc.material.opacity = 0.06 + 0.08 * pulse;
    });
    // Sirenen heulen, solange gewarnt wird oder kurz nach Beginn
    const alarm = st.planned.some((p) => p.siren && !p.aftershock) || st.active.some((a) => !a.aftershock && g.time - a.t0 < 180 && a.type !== 'wildfire');
    if (!alarm) return;
    const sirens = [];
    for (const b of g.buildings.values()) if (b.key === 'warning_siren' && b.construct >= 1) sirens.push(b);
    if (!sirens.length) return;
    this.sirenTimer -= 1 / 60;
    for (const b of sirens) {
      const x = this.W2(b.x + 0.5), z = this.H2(b.y + 0.5);
      const on = Math.sin(time * 5) > 0;
      statics.push([x, 0.95, z, 0.9, 1, on ? 0.25 : 0.7, 0.1, 0.9]);
      statics.push([x, 0.95, z, 3, 1, 0.3, 0.1, 0.12 + 0.2 * night]);
    }
    if (this.sirenTimer <= 0) {
      this.sirenTimer = 1.1;
      for (const b of sirens.slice(0, 8)) {
        const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, depthWrite: false, opacity: 0.7, blending: THREE.AdditiveBlending }));
        m.position.set(this.W2(b.x + 0.5), 0.08, this.H2(b.y + 0.5));
        m.renderOrder = 5;
        this.group.add(m);
        this.waves.push({ m, t0: time, r: Math.min(8, (b.warnRadius || 12) * 0.5) });
      }
    }
    const keep = [];
    for (const v of this.waves) {
      const t = time - v.t0;
      if (t > 2) { this.group.remove(v.m); v.m.material.dispose(); continue; }
      const rr = 0.3 + smooth(t / 2) * v.r;
      v.m.scale.set(rr, 1, rr);
      v.m.material.opacity = 0.7 * (1 - t / 2);
      keep.push(v);
    }
    this.waves = keep;
  }

  // ---------- Blaulicht an Einsatzstellen
  updateRescue(st, time, statics) {
    for (const op of st.ops) {
      const x = this.W2(op.x), z = this.H2(op.y);
      const ph = Math.floor(time * 6) % 2;
      for (let k = 0; k < 3; k++) {
        const ang = k * 2.1 + op.id;
        const lx = x + Math.cos(ang) * 0.7, lz = z + Math.sin(ang) * 0.7;
        const blue = (k + ph) % 2 === 0;
        statics.push([lx, 0.18, lz, 0.55, blue ? 0.25 : 1, blue ? 0.45 : 0.2, blue ? 1 : 0.2, 0.9]);
        statics.push([lx, 0.18, lz, 2.2, blue ? 0.2 : 1, blue ? 0.35 : 0.15, blue ? 1 : 0.15, 0.18]);
      }
    }
  }

  // ---------- Staub und Schweißfunken über beschädigten Gebäuden
  updateRepairs(st, dt, night, tgt, camDist, running) {
    if (!running) return;
    const g = this.g;
    const ids = Object.keys(st.repairs);
    if (!ids.length) return;
    const R2 = (camDist * 1.4) ** 2;
    let n = 0;
    for (const id of ids) {
      if (n > 50) break;
      const b = g.buildings.get(+id);
      if (!b) continue;
      const x = this.W2(b.x + b.w / 2), z = this.H2(b.y + b.h / 2);
      if ((x - tgt.x) ** 2 + (z - tgt.z) ** 2 > R2) continue;
      n++;
      const rec = st.repairs[id];
      const fresh = clamp(rec.left / rec.total, 0, 1);
      const hgt = b.zone ? [0, 0.5, 0.8, 1.1, 2, 3.8][b.level] : 0.7;
      if (rand() < dt * (0.4 + fresh * 1.5)) {
        const c = 0.62 + rand() * 0.12;
        this.smoke.add({ x: x + (rand() - 0.5) * b.w * 0.6, y: hgt * (0.3 + rand() * 0.6), z: z + (rand() - 0.5) * b.h * 0.6, vx: 0.15, vy: 0.25 + rand() * 0.3, vz: 0.05, drag: 0.4, age: 0, life: 3 + rand() * 2, s0: 0.4, s1: 1.6 + rand(), r: c, g: c * 0.95, b: c * 0.88, a: 0.35 * (0.4 + fresh), fadeIn: 0.15, night: true, rot: rand() * 6 });
      }
      if (rand() < dt * (0.6 + night * 1.5)) {
        const sx = x + (rand() - 0.5) * b.w * 0.7, sy = hgt * (0.4 + rand() * 0.5), sz = z + (rand() - 0.5) * b.h * 0.7;
        for (let k = 0; k < 6; k++) this.glow.add({ x: sx, y: sy, z: sz, vx: (rand() - 0.5) * 1.2, vy: rand() * 0.8, vz: (rand() - 0.5) * 1.2, drag: 0.5, grav: 3, age: 0, life: 0.25 + rand() * 0.35, s0: 0.07, s1: 0.03, r: 1, g: 0.8, b: 0.45, a: 1 });
      }
    }
  }

  dispose() {
    this.e.scene.remove(this.group);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const m of [this.floodMat, this.decalMat, this.glow.mat, this.smoke.mat]) m.dispose();
    this.decalTex.dispose();
  }
});
