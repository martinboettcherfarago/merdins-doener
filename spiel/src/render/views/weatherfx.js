// Ansicht „Wetter“: Regen (Schlieren + Spritzer), Schnee, Blitze mit Lichtblitz, ziehende Wolken.
// Besitzer: G1. Liest das geglättete Wetter aus engine.wx (scene.js glättet g.ext.weather).
// Alles läuft im Shader (Positionen aus Zeit und Zufallswerten) – je Effekt ein Draw Call.
// Blitze: S4 setzt g.ext.weather.lightning (0..1, >0.5 = Einschlag jetzt) und optional lightningAt {x, y} (Feld);
// fehlt das Feld, aber storm ist wahr, blitzt es von selbst. Bei jedem Einschlag: emit('lightning', { x, z, strength }).
import * as THREE from 'three';
import { registerView, emit } from '../../registry.js';
import { atmo, ATMO_FOG_GLSL, cloudNoise } from '../materials.js';

// Haufenwolken rund um die schwebende Insel (nur außerhalb des Spielfelds, damit sie nie die Sicht aufs Bauen nehmen)
const CLOUD_VERT = /* glsl */`
attribute vec2 aCorner;
attribute vec4 aPuff;   // xyz Mitte, w Radius
attribute vec4 aInfo;   // x Höhenanteil in der Wolke (0 unten … 1 oben), y Zufall, z Wolkenindex/Anzahl, w -
uniform vec2 uDrift;
uniform float uSpan;
uniform float uHalf;
uniform float uCover;
uniform vec3 uCam;
uniform vec4 uAtmoFogA;
uniform vec4 uAtmoFogC;
varying vec2 vUv;
varying vec4 vInfo;
varying float vA;
varying vec3 vN0;
${ATMO_FOG_GLSL}
void main() {
  vec3 c = aPuff.xyz;
  // langsam ziehen, über den Ring wiederholen
  c.xz += uDrift;
  c.x = mod(c.x + uSpan, 2.0 * uSpan) - uSpan;
  c.z = mod(c.z + uSpan, 2.0 * uSpan) - uSpan;
  float show = step(aInfo.z, uCover);
  vec3 toCam = normalize(uCam - c);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
  vec3 up = cross(toCam, right);
  float r = aPuff.w * show;
  vec3 p = c + (right * aCorner.x + up * aCorner.y) * r;
  vUv = aCorner;
  vInfo = aInfo;
  float dc = length(uCam - c);
  vA = smoothstep(r * 1.5, r * 4.0, dc);
  // über dem Spielfeld ausblenden – und von oben betrachtet ebenfalls (das Umland bleibt frei sichtbar)
  vA *= smoothstep(uHalf + 6.0, uHalf + 22.0, max(abs(c.x), abs(c.z)));
  vA *= 1.0 - smoothstep(c.y + 2.0, c.y + 22.0, uCam.y);
  if (uAtmoFogA.w > 0.5) { vec3 rd; vA *= 1.0 - atmoFogFactor(c, uCam, uAtmoFogA, uAtmoFogC, rd) * 0.85; }
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const CLOUD_FRAG = /* glsl */`
uniform sampler2D uNoise;
uniform vec3 uSunView;
uniform vec3 uLit;
uniform vec3 uShade;
varying vec2 vUv;
varying vec4 vInfo;
varying float vA;
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  float n = texture2D(uNoise, vUv * 0.35 + vInfo.y * 7.3).r;
  float a = smoothstep(0.0, 0.45, (1.0 - sqrt(r2)) + (n - 0.5) * 0.55) * vA;
  if (a < 0.01) discard;
  vec3 nrm = normalize(vec3(vUv.x, vUv.y, sqrt(max(0.0, 1.0 - r2)) + 0.2));
  float l = clamp(dot(nrm, uSunView) * 0.55 + 0.45, 0.0, 1.0);
  float hgt = mix(0.55, 1.0, vInfo.x);
  vec3 col = mix(uShade, uLit, l * hgt) * (0.9 + 0.1 * n);
  gl_FragColor = vec4(col, a * 0.92);
}`;

const RAIN_VERT = /* glsl */`
attribute vec2 aCorner;
attribute vec4 aSeed;
uniform float uTime;
uniform vec3 uCenter;
uniform vec3 uBox;
uniform vec3 uVel;
uniform float uLen;
uniform float uWidth;
uniform vec2 uRes;
uniform float uCount;
varying float vA;
varying float vSide;
void main() {
  if (aSeed.w > uCount) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vA = 0.0; return; }
  float sp = 0.85 + 0.3 * fract(aSeed.w * 7.13);
  vec3 base = aSeed.xyz * uBox;
  vec3 head;
  float tt = uTime * sp;
  head.x = uCenter.x + mod(base.x + uVel.x * tt - uCenter.x, uBox.x) - uBox.x * 0.5;
  head.z = uCenter.z + mod(base.z + uVel.z * tt - uCenter.z, uBox.z) - uBox.z * 0.5;
  head.y = mod(base.y + uVel.y * tt, uBox.y);
  vec3 tail = head - normalize(uVel) * uLen * sp;
  vec4 ch = projectionMatrix * viewMatrix * vec4(head, 1.0);
  vec4 ct = projectionMatrix * viewMatrix * vec4(tail, 1.0);
  vec2 sh = ch.xy / ch.w, st = ct.xy / ct.w;
  vec2 dir = normalize((sh - st) * uRes + vec2(1e-4));
  vec2 nrm = vec2(-dir.y, dir.x) / uRes * uWidth;
  vec4 c = mix(ct, ch, aCorner.x);
  c.xy += nrm * aCorner.y * c.w;
  vSide = aCorner.y;
  // nahe der Kamera ausblenden, unten am Boden verschwinden
  float dz = c.w;
  vA = smoothstep(1.5, 6.0, dz) * smoothstep(0.0, 0.6, head.y) * (0.55 + 0.45 * fract(aSeed.w * 3.7));
  gl_Position = c;
}`;

const RAIN_FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uAlpha;
varying float vA;
varying float vSide;
void main() {
  float a = (1.0 - vSide * vSide) * vA * uAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
}`;

const SPLASH_VERT = /* glsl */`
attribute vec4 aSeed;
uniform float uTime;
uniform vec3 uCenter;
uniform vec3 uBox;
uniform float uScale;
uniform float uCount;
varying float vT;
varying float vA;
void main() {
  if (aSeed.w > uCount) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; return; }
  float rate = 1.6 + aSeed.y * 1.4;
  float cyc = uTime * rate + aSeed.z * 17.0;
  float k = floor(cyc);
  vT = fract(cyc);
  vec2 r = fract(vec2(sin(k * 12.9898 + aSeed.x * 78.233), sin(k * 39.346 + aSeed.y * 11.135)) * 43758.5453);
  vec3 p = vec3(uCenter.x + (r.x - 0.5) * uBox.x * 0.8, 0.025, uCenter.z + (r.y - 0.5) * uBox.z * 0.8);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_PointSize = max(1.0, (0.05 + vT * 0.09) * uScale / max(0.5, -mv.z));
  vA = (1.0 - vT) * smoothstep(1.5, 5.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const SPLASH_FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uAlpha;
varying float vT;
varying float vA;
void main() {
  vec2 c = (gl_PointCoord - 0.5) * vec2(2.0, 4.0);
  float r = length(c);
  float ring = smoothstep(0.25, 0.0, abs(r - 0.75)) ;
  float a = ring * vA * uAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
}`;

const SNOW_VERT = /* glsl */`
attribute vec4 aSeed;
uniform float uTime;
uniform vec3 uCenter;
uniform vec3 uBox;
uniform vec3 uWindV;
uniform float uScale;
uniform float uCount;
uniform vec4 uAtmoFogA;
uniform vec4 uAtmoFogC;
varying float vA;
${ATMO_FOG_GLSL}
void main() {
  if (aSeed.w > uCount) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; return; }
  float sp = 0.6 + 0.5 * fract(aSeed.w * 5.31);
  vec3 base = aSeed.xyz * uBox;
  float t = uTime * sp;
  vec3 p;
  p.y = mod(base.y - t * 0.75, uBox.y);
  float fallen = uBox.y - p.y;
  vec2 drift = uWindV.xz * (t + fallen) * 0.6 + vec2(sin(t * 1.3 + aSeed.x * 40.0), cos(t * 1.1 + aSeed.z * 40.0)) * 0.25;
  p.x = uCenter.x + mod(base.x + drift.x - uCenter.x, uBox.x) - uBox.x * 0.5;
  p.z = uCenter.z + mod(base.z + drift.y - uCenter.z, uBox.z) - uBox.z * 0.5;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float size = 0.07 + 0.06 * fract(aSeed.w * 9.7);
  gl_PointSize = clamp(size * uScale / max(0.5, -mv.z), 1.0, 40.0);
  vA = smoothstep(1.0, 4.0, -mv.z) * smoothstep(0.0, 0.5, p.y);
  if (uAtmoFogA.w > 0.5) { vec3 rd; vA *= 1.0 - atmoFogFactor(p, cameraPosition, uAtmoFogA, uAtmoFogC, rd) * 0.8; }
  gl_Position = projectionMatrix * mv;
}`;

const SNOW_FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uAlpha;
varying float vA;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.35, r) * vA * uAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor, a);
}`;

const BOLT_VERT = /* glsl */`
attribute vec3 aNext;
attribute float aSide;
attribute float aW;
uniform vec2 uRes;
varying float vSide;
varying float vW;
void main() {
  vec4 a = projectionMatrix * viewMatrix * vec4(position, 1.0);
  vec4 b = projectionMatrix * viewMatrix * vec4(aNext, 1.0);
  vec2 d = normalize((b.xy / b.w - a.xy / a.w) * uRes + vec2(1e-4));
  vec2 n = vec2(-d.y, d.x) / uRes * aW;
  a.xy += n * aSide * a.w;
  vSide = aSide;
  vW = aW;
  gl_Position = a;
}`;

const BOLT_FRAG = /* glsl */`
uniform float uI;
varying float vSide;
varying float vW;
void main() {
  float core = smoothstep(1.0, 0.0, abs(vSide));
  float hot = smoothstep(0.35, 0.0, abs(vSide));
  vec3 c = vec3(0.55, 0.62, 1.0) * core * 2.0 + vec3(1.0) * hot * 6.0;
  gl_FragColor = vec4(c * uI, 1.0);
}`;

function seedAttr(n) {
  const a = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { a[i * 4] = Math.random(); a[i * 4 + 1] = Math.random(); a[i * 4 + 2] = Math.random(); a[i * 4 + 3] = i / n; }
  return a;
}

registerView(class WeatherView {
  constructor(engine) {
    this.e = engine;
    const q = (engine.quality && engine.quality.weather) || 0.7;
    this.q = q;
    this.res = new THREE.Vector2(1280, 720);
    // Regen
    const nRain = Math.round(7000 * q);
    const rg = new THREE.InstancedBufferGeometry();
    rg.setAttribute('aCorner', new THREE.Float32BufferAttribute([0, -1, 1, -1, 1, 1, 0, 1], 2));
    rg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
    rg.setIndex([0, 1, 2, 0, 2, 3]);
    rg.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seedAttr(nRain), 4));
    rg.instanceCount = nRain;
    this.rainU = {
      uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(40, 20, 40) },
      uVel: { value: new THREE.Vector3(0, -12, 0) }, uLen: { value: 0.5 }, uWidth: { value: 1.2 }, uRes: { value: this.res },
      uCount: { value: 0 }, uColor: { value: new THREE.Color(0.7, 0.75, 0.82) }, uAlpha: { value: 0.3 },
    };
    this.rain = new THREE.Mesh(rg, new THREE.ShaderMaterial({ uniforms: this.rainU, vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG, transparent: true, depthWrite: false }));
    this.rain.frustumCulled = false;
    this.rain.renderOrder = 8;
    this.rain.visible = false;
    engine.scene.add(this.rain);
    // Spritzer
    const nSplash = Math.round(2400 * q);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(nSplash * 3), 3));
    sg.setAttribute('aSeed', new THREE.BufferAttribute(seedAttr(nSplash), 4));
    this.splashU = {
      uTime: { value: 0 }, uCenter: this.rainU.uCenter, uBox: this.rainU.uBox, uScale: { value: 600 }, uCount: { value: 0 },
      uColor: { value: new THREE.Color(0.8, 0.85, 0.9) }, uAlpha: { value: 0.35 },
    };
    this.splash = new THREE.Points(sg, new THREE.ShaderMaterial({ uniforms: this.splashU, vertexShader: SPLASH_VERT, fragmentShader: SPLASH_FRAG, transparent: true, depthWrite: false }));
    this.splash.frustumCulled = false;
    this.splash.renderOrder = 8;
    this.splash.visible = false;
    engine.scene.add(this.splash);
    // Schnee
    const nSnow = Math.round(6000 * q);
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(nSnow * 3), 3));
    ng.setAttribute('aSeed', new THREE.BufferAttribute(seedAttr(nSnow), 4));
    this.snowU = {
      uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(40, 20, 40) }, uWindV: { value: new THREE.Vector3() },
      uScale: { value: 600 }, uCount: { value: 0 }, uColor: { value: new THREE.Color(1, 1, 1) }, uAlpha: { value: 0.9 },
      uAtmoFogA: { value: atmo.fogA }, uAtmoFogC: { value: atmo.fogC },
    };
    this.snow = new THREE.Points(ng, new THREE.ShaderMaterial({ uniforms: this.snowU, vertexShader: SNOW_VERT, fragmentShader: SNOW_FRAG, transparent: true, depthWrite: false }));
    this.snow.frustumCulled = false;
    this.snow.renderOrder = 8;
    this.snow.visible = false;
    engine.scene.add(this.snow);
    // Haufenwolken
    this.buildClouds();
    // Blitz
    this.boltU = { uRes: { value: this.res }, uI: { value: 0 } };
    this.bolt = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
      uniforms: this.boltU, vertexShader: BOLT_VERT, fragmentShader: BOLT_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    this.bolt.frustumCulled = false;
    this.bolt.renderOrder = 9;
    this.bolt.visible = false;
    engine.scene.add(this.bolt);
    this.boltLife = 0;
    this.nextAuto = 3 + Math.random() * 5;
    this.lastLightning = 0;
    this.flash = 0;
    this.flashSeq = [];
    this.wTime = 0;
  }

  buildClouds() {
    const g = this.e.game;
    const half = Math.max(g.W, g.H) / 2;
    const span = half * 3.2;
    const nClouds = Math.round(34 * Math.min(1.2, this.q + 0.3));
    const puffs = [], info = [];
    let seed = 99;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let k = 0; k < nClouds; k++) {
      // Position außerhalb des Spielfelds
      let x, z;
      for (let tries = 0; tries < 20; tries++) {
        x = (rnd() * 2 - 1) * span; z = (rnd() * 2 - 1) * span;
        if (Math.max(Math.abs(x), Math.abs(z)) > half + 22) break;
      }
      const y = 20 + rnd() * 18;
      const size = 6 + rnd() * 8;
      const order = k / nClouds;
      const n = 6 + Math.floor(rnd() * 6);
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * size;
        const py = Math.pow(rnd(), 1.5) * size * 0.45;
        const pr = size * (0.38 + rnd() * 0.32) * (1 - (py / (size * 0.45)) * 0.35);
        puffs.push(x + Math.cos(a) * rr, y + py, z + Math.sin(a) * rr * 0.6, pr);
        info.push(py / (size * 0.45), rnd(), order, 0);
      }
    }
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('aCorner', new THREE.Float32BufferAttribute([-1, -1, 1, -1, 1, 1, -1, 1], 2));
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.setAttribute('aPuff', new THREE.InstancedBufferAttribute(new Float32Array(puffs), 4));
    geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(new Float32Array(info), 4));
    geo.instanceCount = puffs.length / 4;
    this.cloudU = {
      uDrift: { value: new THREE.Vector2() }, uSpan: { value: span }, uHalf: { value: half }, uCover: { value: 0.4 }, uCam: { value: new THREE.Vector3() },
      uNoise: { value: cloudNoise }, uSunView: { value: new THREE.Vector3(0, 1, 0) }, uLit: { value: new THREE.Color(1, 1, 1) }, uShade: { value: new THREE.Color(0.6, 0.65, 0.75) },
      uAtmoFogA: { value: atmo.fogA }, uAtmoFogC: { value: atmo.fogC },
    };
    this.clouds = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: this.cloudU, vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG, transparent: true, depthWrite: false }));
    this.clouds.frustumCulled = false;
    this.clouds.renderOrder = 2;
    this.e.scene.add(this.clouds);
    this.cloudDrift = new THREE.Vector2();
  }

  updateClouds(dt, simDt) {
    const e = this.e, wx = e.wx, L = e.light;
    const u = this.cloudU;
    const sp = (0.3 + wx.wind * 1.6) * (dt * 0.4 + simDt * 0.6);
    this.cloudDrift.x += Math.cos(wx.windDir) * sp; this.cloudDrift.y += Math.sin(wx.windDir) * sp;
    u.uDrift.value.copy(this.cloudDrift);
    u.uCam.value.copy(e.camera.position);
    u.uCover.value = Math.min(1, 0.25 + Math.max(wx.cloud, wx.rain, wx.snow) * 0.9);
    if (L) {
      u.uSunView.value.copy(L.keyDir).transformDirection(e.camera.matrixWorldInverse);
      const sky = e.sky && e.sky.uniforms;
      const exp = e.exposure || 1;
      const sunI = e.sun ? e.sun.intensity : 2;
      u.uLit.value.copy(e.sun.color).multiplyScalar(sunI * 0.32);
      if (sky) {
        u.uShade.value.copy(sky.uZenith.value).lerp(sky.uHorizon.value, 0.6).multiplyScalar(0.85);
        u.uLit.value.add(sky.uHorizon.value.clone().multiplyScalar(0.45));
      }
      const grey = Math.max(wx.storm * 0.8, (wx.cloud - 0.6) * 1.5, wx.rain * 0.6);
      if (grey > 0) { u.uLit.value.multiplyScalar(1 - Math.min(0.55, grey * 0.5)); u.uShade.value.multiplyScalar(1 - Math.min(0.5, grey * 0.45)); }
      u.uLit.value.multiplyScalar(1 + this.flash * 2);
      void exp;
    }
  }

  resize(scale) {
    const r = this.e.renderer;
    const v = r.getDrawingBufferSize(new THREE.Vector2());
    this.res.copy(v);
    this.splashU.uScale.value = scale;
    this.snowU.uScale.value = scale;
    this.rainU.uWidth.value = Math.max(1, (this.e.pixelRatio || 1) * 1.1);
  }

  // Zickzack-Blitz mit Verästelungen bauen
  makeBolt(x, z) {
    const top = 34 + Math.random() * 10;
    const pts = [[x + (Math.random() - 0.5) * 6, top, z + (Math.random() - 0.5) * 6], [x, 0, z]];
    const subdiv = (arr, disp, depth) => {
      if (depth === 0) return arr;
      const out = [arr[0]];
      for (let i = 0; i < arr.length - 1; i++) {
        const a = arr[i], b = arr[i + 1];
        const m = [(a[0] + b[0]) / 2 + (Math.random() - 0.5) * disp, (a[1] + b[1]) / 2 + (Math.random() - 0.5) * disp * 0.3, (a[2] + b[2]) / 2 + (Math.random() - 0.5) * disp];
        out.push(m, b);
      }
      return subdiv(out, disp * 0.55, depth - 1);
    };
    const main = subdiv(pts, 7, 6);
    const strokes = [[main, 3.2]];
    for (let k = 0; k < 3; k++) {
      const i0 = 6 + Math.floor(Math.random() * (main.length * 0.5));
      const s = main[i0];
      const len = 6 + Math.random() * 10;
      const end = [s[0] + (Math.random() - 0.5) * len, Math.max(2, s[1] - len * (0.6 + Math.random() * 0.4)), s[2] + (Math.random() - 0.5) * len];
      strokes.push([subdiv([s, end], 3, 4), 1.6]);
    }
    const pos = [], next = [], side = [], w = [], idx = [];
    let base = 0;
    for (const [line, width] of strokes) {
      for (let i = 0; i < line.length; i++) {
        const p = line[i], nx = line[Math.min(line.length - 1, i + 1)], pv = line[Math.max(0, i - 1)];
        const dir = i < line.length - 1 ? nx : [p[0] * 2 - pv[0], p[1] * 2 - pv[1], p[2] * 2 - pv[2]];
        for (const sd of [-1, 1]) { pos.push(p[0], p[1], p[2]); next.push(dir[0], dir[1], dir[2]); side.push(sd); w.push(width * (1 - (i / line.length) * 0.4)); }
        if (i < line.length - 1) { const a = base + i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
      }
      base += line.length * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aNext', new THREE.Float32BufferAttribute(next, 3));
    geo.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
    geo.setAttribute('aW', new THREE.Float32BufferAttribute(w.map((v) => v * (this.e.pixelRatio || 1)), 1));
    geo.setIndex(idx);
    this.bolt.geometry.dispose();
    this.bolt.geometry = geo;
  }

  strike(x, z, strength = 1) {
    this.makeBolt(x, z);
    this.boltLife = 0.32;
    this.bolt.visible = true;
    // Flackerfolge: Hauptblitz, kurze Pause, Nachblitze
    this.flashSeq = [[0, 1 * strength], [0.07, 0.35], [0.12, 0.85 * strength], [0.2, 0.5]];
    this.flashT = 0;
    try { emit('lightning', { x, z, strength }); } catch (e) { /* egal */ }
  }

  frame(dt, simDt) {
    const e = this.e, wx = e.wx;
    if (!wx) return;
    this.wTime += dt;
    const t = this.wTime;
    const cam = e.camera.position;
    const tg = e.rig.target;
    const dist = e.rig.cur.dist;
    const B = Math.min(110, Math.max(16, dist * 1.7));
    const Hb = Math.max(6, Math.min(cam.y * 0.8, 40));
    // Mittelpunkt etwas zur Kamera hin, damit der sichtbare Bereich gefüllt ist
    const cx = tg.x + (cam.x - tg.x) * 0.25, cz = tg.z + (cam.z - tg.z) * 0.25;
    const night = e.night || 0;
    const amb = e.hemi ? e.hemi.intensity : 0.6;
    const wv = 0.4 + wx.wind * 3.2;
    const wdx = Math.cos(wx.windDir) * wv, wdz = Math.sin(wx.windDir) * wv;

    this.updateClouds(dt, simDt);
    // Regen
    const rain = wx.rain;
    if (rain > 0.02) {
      const u = this.rainU;
      this.rain.visible = true;
      u.uTime.value = t;
      u.uCenter.value.set(cx, 0, cz);
      u.uBox.value.set(B, Hb, B);
      u.uVel.value.set(wdx, -(11 + rain * 4), wdz);
      u.uLen.value = 0.35 + dist * 0.012;
      u.uCount.value = Math.min(1, 0.15 + rain * 0.95) * (wx.storm > 0.5 ? 1 : 0.85);
      const lum = 0.35 + 0.65 * (1 - night);
      u.uColor.value.setRGB(0.62, 0.68, 0.76).multiplyScalar(lum * (0.6 + amb * 0.35) * (1 + this.flash * 3));
      u.uAlpha.value = (0.2 + 0.14 * rain) * (1 - 0.25 * wx.storm);
      this.splash.visible = dist < 60;
      this.splashU.uTime.value = t;
      this.splashU.uCount.value = rain;
      this.splashU.uColor.value.copy(u.uColor.value).multiplyScalar(1.15);
    } else { this.rain.visible = false; this.splash.visible = false; }

    // Schnee
    const snow = wx.snow;
    if (snow > 0.02) {
      const u = this.snowU;
      this.snow.visible = true;
      u.uTime.value = t;
      u.uCenter.value.set(cx, 0, cz);
      u.uBox.value.set(B, Hb, B);
      u.uWindV.value.set(wdx * 0.35, 0, wdz * 0.35);
      u.uCount.value = Math.min(1, 0.1 + snow);
      const lum = 0.25 + 0.75 * (1 - night);
      u.uColor.value.setRGB(0.95, 0.97, 1.0).multiplyScalar(lum * 1.05 + 0.1);
      u.uAlpha.value = 0.85;
    } else this.snow.visible = false;

    // Blitze
    const src = (e.game.ext && e.game.ext.weather) || {};
    const hasField = typeof src.lightning === 'number';
    let strikeNow = false;
    // S4 zeichnet die Blitzkanäle selbst und liefert das Flackern in lightning (0..1, jedes Bild) –
    // dann übernimmt G1 nur den Lichtblitz. Ohne Wetter-System blitzt es hier bei Sturm von selbst.
    if (hasField) {
      this.flash = Math.max(this.flash, Math.min(1, src.lightning));
    } else if (wx.storm > 0.5) {
      this.nextAuto -= dt;
      if (this.nextAuto <= 0) { strikeNow = true; this.nextAuto = 3 + Math.random() * 9; }
    }
    if (strikeNow) {
      this.lastLightning = t;
      let x, z;
      if (src.lightningAt && typeof src.lightningAt.x === 'number') {
        const g = e.game;
        x = src.lightningAt.x + 0.5 - g.W / 2; z = src.lightningAt.y + 0.5 - g.H / 2;
      } else {
        const a = Math.random() * Math.PI * 2, r = (0.4 + Math.random() * 0.8) * Math.max(14, dist);
        x = tg.x + Math.cos(a) * r; z = tg.z + Math.sin(a) * r;
      }
      this.strike(x, z, 0.8 + Math.random() * 0.2);
    }
    // Flackern auswerten
    let f = 0;
    if (this.flashSeq.length) {
      this.flashT += dt;
      for (const [t0, v] of this.flashSeq) if (this.flashT >= t0 && this.flashT < t0 + 0.06) f = Math.max(f, v);
      if (this.flashT > 0.5) this.flashSeq = [];
    }
    this.flash = Math.max(f, this.flash * Math.exp(-dt * 9));
    e.flash = this.flash;
    if (this.bolt.visible) {
      this.boltLife -= dt;
      this.boltU.uI.value = Math.max(0, Math.min(1, this.boltLife / 0.12)) * (0.6 + 0.4 * f);
      if (this.boltLife <= 0) this.bolt.visible = false;
    }
  }

  dispose() {
    for (const m of [this.rain, this.splash, this.snow, this.bolt, this.clouds]) { m.geometry.dispose(); m.material.dispose(); }
  }
});
