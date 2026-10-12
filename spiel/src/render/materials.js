// Gemeinsame Materialien und Shader-Erweiterungen (Fenster, Wasserwellen).
import * as THREE from 'three';

// Gemeinsame Uniforms aller Shader. uSnow: Schneedecke 0..1, uWet: Nässe 0..1,
// uSeason: Jahreszeit 0..1 (0 = Frühlingsanfang), uAutumn: Herbstfärbung 0..1. Gesetzt von der Licht-/Wetter-Ansicht.
export const shared = {
  uNight: { value: 0 },
  uTime: { value: 0 },
  uSnow: { value: 0 },
  uWet: { value: 0 },
  uSeason: { value: 0.3 },
  uAutumn: { value: 0 },
};

// Gebäudematerial: prozedurale Fenster auf allen Seitenflächen, nachts beleuchtet.
export function makeBuildingMaterial(opts = {}) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.02, ...opts });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = shared.uNight;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aWin;
varying float vWin;
varying vec3 vWPos;
varying vec3 vWNorm;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vWin = aWin;
#ifdef USE_INSTANCING
  vec4 wpW = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
  vWNorm = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
#else
  vec4 wpW = modelMatrix * vec4(transformed, 1.0);
  vWNorm = normalize(mat3(modelMatrix) * objectNormal);
#endif
vWPos = wpW.xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uNight;
varying float vWin;
varying vec3 vWPos;
varying vec3 vWNorm;
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (vWin > 0.5) {
  vec3 nW = normalize(vWNorm);
  if (abs(nW.y) < 0.4) {
    float u = abs(nW.x) > 0.5 ? vWPos.z : vWPos.x;
    float v = vWPos.y;
    float sx = 0.15; float sy = 0.21; float wx = 0.48; float wy = 0.52; float base = 0.1;
    vec3 glass = vec3(0.22, 0.3, 0.38);
    if (vWin > 1.5 && vWin < 2.5) { sx = 0.11; sy = 0.17; wx = 0.82; wy = 0.64; glass = vec3(0.32, 0.45, 0.55); base = 0.06; }
    else if (vWin > 2.5 && vWin < 3.5) { sx = 0.2; sy = 0.26; wx = 0.72; wy = 0.6; base = 0.05; }
    else if (vWin > 3.5) { sx = 0.3; sy = 0.32; wx = 0.6; wy = 0.28; glass = vec3(0.4, 0.45, 0.5); base = 0.18; }
    vec2 g = vec2(u / sx, (v - base) / sy);
    vec2 cell = floor(g);
    vec2 f = fract(g);
    float m = step(abs(f.x - 0.5), wx * 0.5) * step(abs(f.y - 0.5), wy * 0.5) * step(base, v);
    vec2 tileId = floor(vWPos.xz + 0.5 * nW.xz);
    float h = hash21(cell + tileId * 17.13);
    float litAmount = smoothstep(0.0, 1.0, uNight);
    float lit = step(1.0 - litAmount * 0.62, h);
    vec3 warm = mix(vec3(1.0, 0.78, 0.45), vec3(0.85, 0.92, 1.0), step(0.86, h));
    vec3 dayGlass = glass * (0.85 + 0.3 * h);
    diffuseColor.rgb = mix(diffuseColor.rgb, dayGlass * (1.0 - 0.6 * litAmount), m * 0.88);
    totalEmissiveRadiance += m * lit * warm * (0.55 + 0.9 * litAmount);
    roughnessFactor = mix(roughnessFactor, 0.18, m);
  }
}`);
  };
  mat.customProgramCacheKey = () => 'bldWin';
  return mat;
}

export function makeWaterMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x3f9fb8, transparent: true, opacity: 0.84, roughness: 0.1, metalness: 0.1, depthWrite: false });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.uniforms.uNight = shared.uNight;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uTime;
varying vec2 vXZ;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vXZ = (modelMatrix * vec4(transformed, 1.0)).xz;
transformed.z += sin(vXZ.x * 1.7 + uTime * 1.3) * 0.025 + cos(vXZ.y * 1.3 + uTime * 0.9) * 0.025;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uTime;
uniform float uNight;
varying vec2 vXZ;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float rip = sin(vXZ.x * 3.1 + uTime * 1.6) * sin(vXZ.y * 2.7 - uTime * 1.2);
diffuseColor.rgb += vec3(0.05, 0.07, 0.07) * smoothstep(0.55, 1.0, rip);
diffuseColor.rgb *= 1.0 - uNight * 0.35;`);
  };
  mat.customProgramCacheKey = () => 'water';
  return mat;
}

// Einfache Glow-Textur für Lichter (Laternen, Scheinwerfer, Feuer).
export function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Punktwolke mit individueller Größe, Farbe und Deckkraft.
export function makePointsMaterial(tex, additive = true) {
  return new THREE.ShaderMaterial({
    uniforms: { uTex: { value: tex }, uScale: { value: 300 } },
    vertexShader: `
attribute float aSize;
attribute vec4 aColor;
varying vec4 vColor;
uniform float uScale;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `
uniform sampler2D uTex;
varying vec4 vColor;
void main() {
  vec4 t = texture2D(uTex, gl_PointCoord);
  gl_FragColor = vec4(vColor.rgb, vColor.a * t.a);
  if (gl_FragColor.a < 0.01) discard;
}`,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

// Wiederverwendbarer Punkt-Puffer.
export class PointBuffer {
  constructor(max, material) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(this.geo, material);
    this.points.frustumCulled = false;
    this.n = 0;
  }
  begin() { this.n = 0; }
  add(x, y, z, size, r, g, b, a) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = a;
    this.size[i] = size;
  }
  end() {
    this.geo.setDrawRange(0, this.n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }
}
