// Himmel: Himmelskuppel mit Sonne, Dämmerungsfarben, Wolkendecke, Mond mit Phasen und Sternen.
// Dazu eine Umgebungskarte (PMREM) aus demselben Himmel – für Spiegelungen auf Glas und Wasser und das
// Himmelslicht aller Standard-Materialien (scene.environment). Nachts ist sie automatisch dunkel.
// Besitzer: G1. Farben werden als Display-Farben (sRGB) entworfen und linear in den HDR-Puffer geschrieben;
// die Tonwertkurve „Neutral“ lässt sie im Mittelbereich unverändert.
import * as THREE from 'three';
import { cloudNoise } from './materials.js';

const lin = (hex) => new THREE.Color(hex); // Color.setHex wandelt sRGB → linear

// Paletten über der Sonnenhöhe (Sinus der Höhe). [s, Zenit, Horizont (Gegenseite), Horizont (Sonnenseite), unten]
const PALETTE = [
  [-0.32, 0x03050f, 0x0a1022, 0x0c1226, 0x070b18],
  [-0.16, 0x070d24, 0x18224a, 0x221f48, 0x0e1430],
  [-0.07, 0x13234e, 0x3a4374, 0x8a5a6a, 0x1c2242],
  [-0.015, 0x25417e, 0x7c7aa0, 0xe88a5c, 0x3a4060],
  [0.04, 0x3866ac, 0xb2b2c4, 0xf6b27a, 0x6c7488],
  [0.12, 0x447dc6, 0xc6d2de, 0xf3d2a8, 0x8c9cad],
  [0.3, 0x3f7fd0, 0xbcd6ec, 0xe4ebee, 0x9db3c4],
  [1.0, 0x3574cc, 0xb4d2ee, 0xd8e6f2, 0x9cb5c8],
].map(([s, a, b, c, d]) => [s, lin(a), lin(b), lin(c), lin(d)]);

// Bedeckter Himmel (Tag) und Sturm
const OVERCAST = { zen: lin(0x8c97a6), hor: lin(0xb9c0c8), below: lin(0x9aa3ad) };
const STORM = { zen: lin(0x3c434e), hor: lin(0x6a717a), below: lin(0x555c66) };

const _a = new THREE.Color(), _b = new THREE.Color();
function samplePalette(s, out) {
  let k = 0;
  while (k < PALETTE.length - 2 && s > PALETTE[k + 1][0]) k++;
  const A = PALETTE[k], B = PALETTE[k + 1];
  const t = THREE.MathUtils.clamp((s - A[0]) / (B[0] - A[0]), 0, 1);
  const st = t * t * (3 - 2 * t);
  out.zen.copy(A[1]).lerp(B[1], st);
  out.hor.copy(A[2]).lerp(B[2], st);
  out.horSun.copy(A[3]).lerp(B[3], st);
  out.below.copy(A[4]).lerp(B[4], st);
}

const NOISE_GLSL = /* glsl */`
float skHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float skNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(skHash(i), skHash(i + vec2(1.0, 0.0)), f.x), mix(skHash(i + vec2(0.0, 1.0)), skHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float skFbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * skNoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return s;
}
// Wolkendichte in Blickrichtung d (nur oberhalb des Horizonts)
float skCloud(vec3 d, vec2 off, float cover) {
  if (d.y <= 0.0 || cover <= 0.01) return 0.0;
  vec2 p = d.xz / (d.y + 0.12) * 0.55 + off;
  float f = skFbm(p);
  float thr = mix(0.78, 0.28, cover);
  return smoothstep(thr, thr + 0.22, f) * smoothstep(0.0, 0.16, d.y);
}
`;

// Wolken über die kachelbare Rauschtextur (schneller als Rauschen im Shader)
const TEX_CLOUD_GLSL = /* glsl */`
uniform sampler2D uNoise;
float txFbm(vec2 p) { return texture2D(uNoise, p * 0.25).g * 0.82 + texture2D(uNoise, p * 0.9 + 0.31).b * 0.18; }
float txCloud(vec3 d, vec2 off, float cover, out vec2 p) {
  p = d.xz / (d.y + 0.12) * 0.55 + off;
  if (d.y <= 0.0 || cover <= 0.01) return 0.0;
  float f = txFbm(p);
  float thr = mix(0.8, 0.3, cover);
  return smoothstep(thr, thr + 0.2, f) * smoothstep(0.0, 0.16, d.y);
}
`;

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = vec4(p.xy, p.w * 0.99995, p.w); // immer ganz hinten
}`;

const SKY_FRAG = /* glsl */`
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uHorizonSun;
uniform vec3 uBelow;
uniform vec3 uSunGlow;
uniform vec3 uSunDisc;
uniform vec3 uMoonCol;
uniform vec3 uCloudLit;
uniform vec3 uCloudShade;
uniform vec3 uGround;
uniform vec3 uCityGlow;
uniform vec2 uCloudOff;
uniform float uCloud;
uniform float uFlash;
uniform float uEnv;
uniform float uBelowClouds;
uniform float uDither;
varying vec3 vDir;
float skHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
${TEX_CLOUD_GLSL}
void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  vec2 hd = normalize(d.xz + vec2(1e-5));
  vec2 sd = normalize(uSunDir.xz + vec2(1e-5));
  float az = 0.5 + 0.5 * dot(hd, sd);
  vec3 hor = mix(uHorizon, uHorizonSun, pow(az, 3.0) * 0.9);
  float up = clamp(y, 0.0, 1.0);
  vec3 col = mix(hor, uZenith, pow(up, 0.5));
  // Dunstband am Horizont und Lichtglocke der Stadt nachts
  col += uHorizonSun * 0.12 * exp(-abs(y) * 14.0) * pow(az, 5.0);
  col += uCityGlow * exp(-max(y, 0.0) * 9.0);
  float mu = dot(d, uSunDir);
  // Sonnenhof (Mie)
  col += uSunGlow * (0.05 * pow(max(mu, 0.0), 6.0) + 0.22 * pow(max(mu, 0.0), 48.0) + 0.6 * pow(max(mu, 0.0), 600.0));
  if (y < 0.0) {
    if (uEnv > 0.5) {
      col = mix(hor, uGround, smoothstep(0.0, 0.18, -y));
    } else {
      vec3 bc = mix(hor, uBelow, smoothstep(0.0, 0.4, -y));
      // Wolkenmeer unter der Insel (sehr dezent)
      if (uBelowClouds > 0.0) {
        vec2 p = d.xz / (-y + 0.1) * 0.3 + uCloudOff * 0.4;
        float f = texture2D(uNoise, p * 0.25).r;
        float c = smoothstep(0.5, 0.85, f) * smoothstep(0.02, 0.25, -y);
        vec3 cl = mix(uCloudShade, uCloudLit, clamp(0.5 + (f - texture2D(uNoise, (p + sd * 0.08) * 0.25).r) * 4.0, 0.0, 1.0));
        bc = mix(bc, cl, c * uBelowClouds);
      }
      col = bc;
    }
  }
  // Sonnenscheibe und Mond (nicht in der Umgebungskarte)
  if (uEnv < 0.5) {
    float disc = smoothstep(0.99986, 0.99993, mu);
    col += uSunDisc * disc;
    vec3 md = uMoonDir;
    float mmu = dot(d, md);
    if (mmu > 0.9990 && uMoonCol.r > 0.0) {
      vec3 R = normalize(cross(md, vec3(0.0, 1.0, 0.0)));
      vec3 U = cross(R, md);
      vec3 rel = d - md * mmu;
      float rad = 0.024;
      vec2 l = vec2(dot(rel, R), dot(rel, U)) / rad;
      float rr = dot(l, l);
      if (rr < 1.0) {
        vec3 n = R * l.x + U * l.y - md * sqrt(1.0 - rr);
        float lit = smoothstep(-0.06, 0.12, dot(n, uSunDir));
        float maria = 0.8 + 0.2 * texture2D(uNoise, l * 0.21 + 0.4).b - 0.14 * smoothstep(0.5, 0.7, texture2D(uNoise, l * 0.09 + 0.7).r);
        float edge = smoothstep(1.0, 0.92, rr);
        col = mix(col, col * 0.6 + uMoonCol * maria * (0.04 + lit), edge);
      }
      col += uMoonCol * 0.06 * pow(max(mmu, 0.0), 2000.0);
    }
    col += uMoonCol * 0.012 * pow(max(mmu, 0.0), 60.0);
  }
  // Wolkendecke
  vec2 cp;
  float cd = txCloud(d, uCloudOff, uCloud, cp);
  if (cd > 0.0) {
    float f0 = txFbm(cp);
    float f1 = txFbm(cp + sd * 0.09);
    float shade = clamp(0.55 + (f0 - f1) * 5.0, 0.0, 1.0);
    vec3 cc = mix(uCloudShade, uCloudLit, shade);
    cc += uSunGlow * 0.35 * pow(max(mu, 0.0), 10.0) * (1.0 - cd); // Silberrand
    cc += vec3(0.7, 0.75, 0.95) * uFlash * 1.5;
    col = mix(col, cc, cd);
  }
  col += vec3(0.55, 0.6, 0.8) * uFlash * 0.35;
  // leichtes Rauschen gegen Farbstufen im Verlauf
  col += (skHash(gl_FragCoord.xy) - 0.5) * uDither * max(col, vec3(0.002));
  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
}`;

const STAR_VERT = /* glsl */`
attribute float aMag;
attribute float aSeed;
uniform float uTime;
uniform float uVis;
uniform float uScale;
uniform vec2 uCloudOff;
uniform float uCloud;
varying vec3 vCol;
varying float vA;
#ifdef USE_TEX
${TEX_CLOUD_GLSL}
#else
${NOISE_GLSL}
#endif
void main() {
  vec3 d = normalize(position);
  float tw = 0.75 + 0.25 * sin(uTime * (1.5 + aSeed * 3.0) + aSeed * 40.0);
#ifdef USE_TEX
  vec2 cp;
  float clouds = txCloud(d, uCloudOff, uCloud, cp);
#else
  float clouds = skCloud(d, uCloudOff, uCloud);
#endif
  vA = uVis * aMag * tw * (1.0 - clouds) * smoothstep(0.02, 0.2, d.y);
  vCol = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.86, 0.7), fract(aSeed * 7.31));
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = vec4(p.xy, p.w * 0.99995, p.w);
  gl_PointSize = uScale * (1.0 + aMag * 1.6);
}`;

const STAR_FRAG = /* glsl */`
varying vec3 vCol;
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.0, length(c));
  if (vA * a < 0.004) discard;
  gl_FragColor = vec4(vCol * vA * a * 2.2, 1.0);
}`;

export class SkySystem {
  constructor(renderer, scene, quality) {
    this.renderer = renderer;
    this.scene = scene;
    this.pal = { zen: new THREE.Color(), hor: new THREE.Color(), horSun: new THREE.Color(), below: new THREE.Color() };
    const u = {
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
      uZenith: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uHorizonSun: { value: new THREE.Color() },
      uBelow: { value: new THREE.Color() },
      uSunGlow: { value: new THREE.Color() },
      uSunDisc: { value: new THREE.Color() },
      uMoonCol: { value: new THREE.Color() },
      uCloudLit: { value: new THREE.Color() },
      uCloudShade: { value: new THREE.Color() },
      uGround: { value: new THREE.Color() },
      uCityGlow: { value: new THREE.Color() },
      uCloudOff: { value: new THREE.Vector2() },
      uCloud: { value: 0.3 },
      uFlash: { value: 0 },
      uEnv: { value: 0 },
      uBelowClouds: { value: 0.3 },
      uDither: { value: 0.04 },
      uNoise: { value: cloudNoise },
    };
    this.uniforms = u;
    this.mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, toneMapped: true });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), this.mat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    // Sterne
    const n = 1800;
    const pos = new Float32Array(n * 3), mag = new Float32Array(n), seed = new Float32Array(n);
    let k = 0;
    while (k < n) {
      const x = Math.random() * 2 - 1, y = Math.random(), z = Math.random() * 2 - 1;
      const l = Math.hypot(x, y, z);
      if (l > 1 || l < 0.1) continue;
      // etwas dichter entlang eines Bandes (Milchstraße)
      const band = Math.abs((x * 0.6 + z * 0.8) / l);
      if (band > 0.35 && Math.random() < 0.45) continue;
      pos[k * 3] = (x / l) * 450; pos[k * 3 + 1] = (y / l) * 450; pos[k * 3 + 2] = (z / l) * 450;
      mag[k] = Math.pow(Math.random(), 3.2);
      seed[k] = Math.random();
      k++;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
    sg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.starUniforms = { uTime: { value: 0 }, uVis: { value: 0 }, uScale: { value: 1.5 }, uCloudOff: u.uCloudOff, uCloud: u.uCloud, uNoise: u.uNoise };
    this.stars = new THREE.Points(sg, new THREE.ShaderMaterial({
      uniforms: this.starUniforms, vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
      defines: renderer.capabilities.vertexTextures ? { USE_TEX: '' } : {},
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    this.stars.renderOrder = -9;
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    // Umgebungskarte
    this.envSize = quality === 'low' || quality === 'medium' ? 32 : 64;
    this.envScene = new THREE.Scene();
    this.envMat = this.mat.clone();
    this.envMat.uniforms = { ...u, uEnv: { value: 1 }, uDither: { value: 0 } };
    this.envMat.depthTest = false;
    const envDome = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), this.envMat);
    envDome.frustumCulled = false;
    this.envScene.add(envDome);
    this.cubeRT = new THREE.WebGLCubeRenderTarget(this.envSize, { type: THREE.HalfFloatType, generateMipmaps: false });
    this.cubeCam = new THREE.CubeCamera(1, 100, this.cubeRT);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmremRT = null;
    this.envKey = null;
    this.envTimer = 0;
  }

  // Farben aus der Sonnenhöhe s (Sinus), Bedeckung, Sturm und Nacht berechnen.
  computePalette(s, cloud, storm) {
    samplePalette(s, this.pal);
    const day = THREE.MathUtils.smoothstep(s, -0.12, 0.2);
    const oc = THREE.MathUtils.clamp((cloud - 0.45) / 0.5, 0, 1) * (1 - storm * 0.3);
    const st = storm;
    const dim = 0.15 + 0.85 * day; // bedeckter Himmel nachts sehr dunkel
    const tmp = _a;
    for (const [key, ok] of [['zen', 'zen'], ['hor', 'hor'], ['horSun', 'hor'], ['below', 'below']]) {
      tmp.copy(OVERCAST[ok]).multiplyScalar(dim * (0.35 + 0.65 * day));
      _b.copy(STORM[ok]).multiplyScalar(dim * (0.35 + 0.65 * day));
      tmp.lerp(_b, st);
      this.pal[key].lerp(tmp, Math.max(oc, st * 0.9));
    }
    return this.pal;
  }

  // state: { sunDir, moonDir, s (Sonnenhöhe), night, cloud, storm, flash, time, cloudOff, sunColor, moonVis, cityGlow, ground, belowClouds, exposure }
  update(st, camera) {
    const u = this.uniforms;
    const p = this.computePalette(st.s, st.cloud, st.storm);
    const inv = 1 / Math.max(0.2, st.exposure || 1); // Himmel erscheint unabhängig von der Belichtung
    u.uZenith.value.copy(p.zen).multiplyScalar(inv);
    u.uHorizon.value.copy(p.hor).multiplyScalar(inv);
    u.uHorizonSun.value.copy(p.horSun).multiplyScalar(inv);
    u.uBelow.value.copy(p.below).multiplyScalar(inv);
    u.uSunDir.value.copy(st.sunDir);
    u.uMoonDir.value.copy(st.moonDir);
    const sunUp = THREE.MathUtils.smoothstep(st.s, -0.04, 0.02);
    const clear = 1 - THREE.MathUtils.clamp((st.cloud - 0.55) / 0.4, 0, 1);
    u.uSunGlow.value.copy(st.sunColor).multiplyScalar(sunUp * (0.35 + 0.65 * clear) * inv);
    u.uSunDisc.value.copy(st.sunColor).multiplyScalar(sunUp * clear * 30 * inv);
    u.uMoonCol.value.setRGB(0.85, 0.9, 1.0).multiplyScalar(st.moonVis * 2.4 * inv);
    // Wolkenfarben: oben Sonnenlicht, unten Himmel/Grau
    const day = THREE.MathUtils.smoothstep(st.s, -0.1, 0.15);
    _a.copy(st.sunColor).multiplyScalar(0.55 * sunUp).add(_b.copy(p.zen).multiplyScalar(0.6)).add(_b.copy(p.hor).multiplyScalar(0.25));
    _a.lerp(_b.copy(p.hor).multiplyScalar(1.05), Math.min(1, st.cloud * 0.6 + st.storm * 0.3));
    if (day < 0.5) _a.lerp(_b.setRGB(0.05, 0.06, 0.09).add(st.cityGlow), 1 - day * 2);
    u.uCloudLit.value.copy(_a).multiplyScalar(inv);
    u.uCloudShade.value.copy(p.zen).lerp(p.below, 0.4).multiplyScalar((0.75 - st.storm * 0.25) * inv);
    u.uCloud.value = st.cloud;
    u.uCloudOff.value.copy(st.cloudOff);
    u.uFlash.value = st.flash;
    u.uGround.value.copy(st.ground);
    u.uCityGlow.value.copy(st.cityGlow).multiplyScalar(inv);
    u.uBelowClouds.value = st.belowClouds ?? 0.3;
    this.starUniforms.uTime.value = st.time;
    this.starUniforms.uVis.value = THREE.MathUtils.smoothstep(st.night, 0.35, 0.95) * inv * 0.9;
    this.dome.position.copy(camera.position);
    this.stars.position.copy(camera.position);
  }

  setPixelRatio(pr) { this.starUniforms.uScale.value = 1.3 * pr; }

  // Umgebungskarte neu erzeugen, wenn sich der Himmel spürbar verändert hat (oder erzwungen).
  updateEnv(dt, force, st) {
    this.envTimer -= dt;
    const key = [Math.round(st.s * 40), Math.round(st.cloud * 8), Math.round(st.storm * 3), st.flash > 0.4 ? 1 : 0].join(',');
    if (!force && (key === this.envKey || this.envTimer > 0)) return false;
    this.envKey = key;
    this.envTimer = 1.0;
    const r = this.renderer;
    const prevTarget = r.getRenderTarget();
    const prevTone = r.toneMapping;
    r.toneMapping = THREE.NoToneMapping;
    this.cubeCam.update(r, this.envScene);
    this.pmremRT = this.pmrem.fromCubemap(this.cubeRT.texture, this.pmremRT);
    r.toneMapping = prevTone;
    r.setRenderTarget(prevTarget);
    if (this.scene.environment !== this.pmremRT.texture) this.scene.environment = this.pmremRT.texture;
    return true;
  }

  dispose() {
    this.pmrem.dispose();
    this.cubeRT.dispose();
    if (this.pmremRT) this.pmremRT.dispose();
    this.mat.dispose(); this.envMat.dispose();
    this.dome.geometry.dispose();
    this.stars.geometry.dispose(); this.stars.material.dispose();
  }
}
