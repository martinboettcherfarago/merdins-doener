// Nachbearbeitung (Besitzer G1): Szene in einen HDR-Puffer (HalfFloat, MSAA), dann
//  1. Umgebungsverdeckung NUR aus dem Tiefenpuffer (SAO, Normalen aus Tiefe rekonstruiert, halbe Auflösung,
//     tiefenbewusster Weichzeichner) – kein zweiter Szenen-Durchgang, also keine zusätzlichen Draw Calls der Szene.
//  2. Bloom über eine Mip-Kette (Dual-Filter, weiche Schwelle) – nur Helles leuchtet (Fenster, Laternen, Neon).
//  3. Zusammensetzen: Verdeckung, Bloom, Belichtung, Tonwertkurve „Neutral“, Weißabgleich, Kontrast, Sättigung,
//     Vignette, Dithering, sRGB.
//  4. Optional Tiefenschärfe (Tilt-Shift/Fotomodus) über `dof` (0 = aus).
// Danach zeichnet die Engine ihre HUD-Szene (Symbole) unbearbeitet darüber.
import * as THREE from 'three';

const VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const COMMON = /* glsl */`
varying vec2 vUv;
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
`;

const AO_FRAG = /* glsl */`
#include <packing>
${COMMON}
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform vec2 uFullTexel;
uniform vec4 uProj;
uniform float uRadius;
uniform float uIntensity;
uniform float uProjScale;
uniform float uMaxPx;
float viewZAt(vec2 uv) { return perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uProj.z, uProj.w); }
vec3 viewPos(vec2 uv, float z) { return vec3((uv * 2.0 - 1.0) * uProj.xy * -z, z); }
void main() {
  float d = texture2D(tDepth, vUv).x;
  if (d >= 0.999999) { gl_FragColor = vec4(1.0, uProj.w, 0.0, 1.0); return; }
  float z = perspectiveDepthToViewZ(d, uProj.z, uProj.w);
  vec3 P = viewPos(vUv, z);
  vec2 tx = uFullTexel;
  vec3 Pr = viewPos(vUv + vec2(tx.x, 0.0), viewZAt(vUv + vec2(tx.x, 0.0)));
  vec3 Pl = viewPos(vUv - vec2(tx.x, 0.0), viewZAt(vUv - vec2(tx.x, 0.0)));
  vec3 Pu = viewPos(vUv + vec2(0.0, tx.y), viewZAt(vUv + vec2(0.0, tx.y)));
  vec3 Pd = viewPos(vUv - vec2(0.0, tx.y), viewZAt(vUv - vec2(0.0, tx.y)));
  vec3 dx = abs(Pr.z - P.z) < abs(P.z - Pl.z) ? Pr - P : P - Pl;
  vec3 dy = abs(Pu.z - P.z) < abs(P.z - Pd.z) ? Pu - P : P - Pd;
  vec3 N = normalize(cross(dx, dy));
  float rad = uRadius;
  float ssR = min(rad * uProjScale / -z, uMaxPx);
  if (ssR < 1.0) { gl_FragColor = vec4(1.0, -z, 0.0, 1.0); return; }
  float rot = ign(gl_FragCoord.xy) * 6.2831853;
  float sum = 0.0;
  float r2 = rad * rad;
  float bias = 0.0015 * -z + 0.004;
  for (int i = 0; i < AO_SAMPLES; i++) {
    float a = (float(i) + 0.5) / float(AO_SAMPLES);
    float ang = float(i) * 2.3999632 + rot;
    vec2 off = vec2(cos(ang), sin(ang)) * (sqrt(a) * ssR) / uRes;
    vec2 suv = vUv + off;
    if (suv.x < 0.0 || suv.y < 0.0 || suv.x > 1.0 || suv.y > 1.0) continue;
    vec3 Q = viewPos(suv, viewZAt(suv));
    vec3 v = Q - P;
    float vv = dot(v, v);
    float vn = dot(v, N);
    float f = max(r2 - vv, 0.0);
    sum += f * f * f * max((vn - bias) / (0.0004 + vv), 0.0);
  }
  float A = max(0.0, 1.0 - sum * uIntensity * 5.0 / (r2 * r2 * r2 * float(AO_SAMPLES)));
  gl_FragColor = vec4(A, -z, 0.0, 1.0);
}`;

const BLUR_FRAG = /* glsl */`
${COMMON}
uniform sampler2D tAO;
uniform vec2 uDir;
void main() {
  vec4 c = texture2D(tAO, vUv);
  float z0 = c.g;
  float ws = 0.2270270;
  float s = c.r * ws;
  float W[4];
  W[0] = 0.1945946; W[1] = 0.1216216; W[2] = 0.0540540; W[3] = 0.0162162;
  float tol = 0.02 * z0 + 0.03;
  for (int i = 1; i <= 4; i++) {
    for (int sgn = -1; sgn <= 1; sgn += 2) {
      vec4 t = texture2D(tAO, vUv + uDir * float(i * sgn));
      float w = W[i - 1] * max(0.0, 1.0 - abs(t.g - z0) / tol);
      s += t.r * w; ws += w;
    }
  }
  gl_FragColor = vec4(s / ws, z0, 0.0, 1.0);
}`;

const PREFILTER_FRAG = /* glsl */`
${COMMON}
uniform sampler2D tColor;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uKnee;
uniform float uClampMax;
vec3 karis(vec3 c) { return c / (1.0 + max(c.r, max(c.g, c.b))); }
void main() {
  vec3 a = texture2D(tColor, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  vec3 b = texture2D(tColor, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  vec3 c = texture2D(tColor, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
  vec3 d = texture2D(tColor, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  float wa = 1.0 / (1.0 + max(a.r, max(a.g, a.b)));
  float wb = 1.0 / (1.0 + max(b.r, max(b.g, b.b)));
  float wc = 1.0 / (1.0 + max(c.r, max(c.g, c.b)));
  float wd = 1.0 / (1.0 + max(d.r, max(d.g, d.b)));
  vec3 col = (a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd);
  col = min(col, vec3(uClampMax));
  float br = max(col.r, max(col.g, col.b));
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-5);
  float k = max(soft, br - uThreshold) / max(br, 1e-5);
  gl_FragColor = vec4(col * k, 1.0);
}`;

const DOWN_FRAG = /* glsl */`
${COMMON}
uniform sampler2D tSrc;
uniform vec2 uTexel;
void main() {
  vec2 h = uTexel;
  vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
  s += texture2D(tSrc, vUv - h).rgb;
  s += texture2D(tSrc, vUv + h).rgb;
  s += texture2D(tSrc, vUv + vec2(h.x, -h.y)).rgb;
  s += texture2D(tSrc, vUv - vec2(h.x, -h.y)).rgb;
  gl_FragColor = vec4(s / 8.0, 1.0);
}`;

const UP_FRAG = /* glsl */`
${COMMON}
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uWeight;
void main() {
  vec2 h = uTexel;
  vec3 s = texture2D(tSrc, vUv + vec2(-h.x * 2.0, 0.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(-h.x, h.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(0.0, h.y * 2.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(h.x, h.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(h.x * 2.0, 0.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(h.x, -h.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(0.0, -h.y * 2.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(-h.x, -h.y)).rgb * 2.0;
  gl_FragColor = vec4(s / 12.0 * uWeight, 1.0);
}`;

const COMPOSITE_FRAG = /* glsl */`
#include <packing>
${COMMON}
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tAO;
uniform sampler2D tBloom;
uniform sampler2D tBlur;
uniform vec2 uAOTexel;
uniform vec4 uProj;
uniform float uAOStrength;
uniform float uBloom;
uniform float uExposure;
uniform vec3 uWB;
uniform float uContrast;
uniform float uSaturation;
uniform float uVignette;
uniform vec3 uShadowTint;
uniform vec2 uAspect;
uniform float uDof;
uniform float uFocusZ;
uniform float uTiltShift;

vec3 neutralTM(vec3 color) {
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < 0.76) return color;
  float d = 0.24;
  float newPeak = 1.0 - d * d / (peak + d - 0.76);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (0.15 * (peak - newPeak) + 1.0);
  return mix(color, vec3(newPeak), g);
}
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float sceneZ(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uProj.z, uProj.w); }

void main() {
  vec3 c = texture2D(tColor, vUv).rgb;
  float z = 0.0;
#if defined(USE_AO) || defined(USE_DOF)
  z = sceneZ(vUv);
#endif
#ifdef USE_DOF
  {
    float coc = uTiltShift > 0.0 ? smoothstep(0.08, 0.42, abs(vUv.y - 0.5)) * uTiltShift
                                 : clamp(abs(z - uFocusZ) / max(uFocusZ, 1.0) * 1.6, 0.0, 1.0);
    coc *= uDof;
    vec3 b = texture2D(tBlur, vUv).rgb;
    c = mix(c, b, clamp(coc, 0.0, 1.0));
  }
#endif
#ifdef USE_AO
  {
    // tiefenbewusstes Hochskalieren (4 Nachbarn)
    vec2 base = vUv - uAOTexel * 0.5;
    float aw = 0.0, ao = 0.0;
    for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
      vec4 t = texture2D(tAO, base + uAOTexel * vec2(float(i), float(j)));
      float w = 1.0 / (0.002 + abs(t.g - z) / max(z, 0.1));
      ao += t.r * w; aw += w;
    }
    ao = ao / max(aw, 1e-5);
    float occ = 1.0 - ao;
    c *= 1.0 - occ * uAOStrength;
    c += uShadowTint * occ * uAOStrength * dot(c, vec3(0.3333));
  }
#endif
#ifdef USE_BLOOM
  c += texture2D(tBloom, vUv).rgb * uBloom;
#endif
  c *= uExposure * uWB;
  c = neutralTM(max(c, vec3(0.0)));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(l), c, uSaturation), vec3(0.0));
  vec3 s = toSRGB(c);
  s = mix(s, s * s * (3.0 - 2.0 * s), uContrast);
  vec2 q = (vUv - 0.5) * uAspect;
  float vig = smoothstep(0.95, 0.25, length(q));
  s *= mix(1.0, vig, uVignette);
  s += (ign(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(s, 1.0);
}`;

function mkMat(frag, uniforms, defines = {}) {
  return new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, defines, depthTest: false, depthWrite: false, toneMapped: false });
}

export class PostFX {
  constructor(renderer, cfg) {
    this.r = renderer;
    this.cfg = { msaa: 4, ao: true, aoSamples: 10, aoHalf: true, bloom: true, bloomLevels: 5, ...cfg };
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.quad = new THREE.Mesh(geo, null);
    this.quad.frustumCulled = false;
    this.w = 1; this.h = 1;
    this.targets = [];
    this.params = {
      exposure: 1, bloom: 0.6, threshold: 1.2, knee: 0.5, aoRadius: 0.35, aoIntensity: 1.0, aoStrength: 0.85,
      contrast: 0.12, saturation: 1.05, vignette: 0.25, wb: new THREE.Color(1, 1, 1), shadowTint: new THREE.Color(0, 0, 0),
      dof: 0, focusZ: 30, tiltShift: 0,
    };
    this.makeMaterials();
  }

  makeMaterials() {
    const c = this.cfg;
    this.aoMat = mkMat(AO_FRAG, {
      tDepth: { value: null }, uRes: { value: new THREE.Vector2() }, uFullTexel: { value: new THREE.Vector2() }, uProj: { value: new THREE.Vector4() },
      uRadius: { value: 0.35 }, uIntensity: { value: 1 }, uProjScale: { value: 300 }, uMaxPx: { value: 48 },
    }, { AO_SAMPLES: c.aoSamples });
    this.blurMat = mkMat(BLUR_FRAG, { tAO: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.preMat = mkMat(PREFILTER_FRAG, { tColor: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1 }, uKnee: { value: 0.5 }, uClampMax: { value: 40 } });
    this.downMat = mkMat(DOWN_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.upMat = mkMat(UP_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uWeight: { value: 1 } });
    this.upMat.blending = THREE.CustomBlending;
    this.upMat.blendSrc = THREE.OneFactor; this.upMat.blendDst = THREE.OneFactor; this.upMat.blendEquation = THREE.AddEquation;
    this.upMat.transparent = true;
    const defs = {};
    if (c.ao) defs.USE_AO = '';
    if (c.bloom) defs.USE_BLOOM = '';
    if (c.dof) defs.USE_DOF = '';
    this.compMat = mkMat(COMPOSITE_FRAG, {
      tColor: { value: null }, tDepth: { value: null }, tAO: { value: null }, tBloom: { value: null }, tBlur: { value: null },
      uAOTexel: { value: new THREE.Vector2() }, uProj: { value: new THREE.Vector4() }, uAOStrength: { value: 0.8 }, uBloom: { value: 0.5 },
      uExposure: { value: 1 }, uWB: { value: new THREE.Color(1, 1, 1) }, uContrast: { value: 0.1 }, uSaturation: { value: 1 }, uVignette: { value: 0.2 },
      uShadowTint: { value: new THREE.Color() }, uAspect: { value: new THREE.Vector2(1, 1) }, uDof: { value: 0 }, uFocusZ: { value: 30 }, uTiltShift: { value: 0 },
    }, defs);
  }

  configure(cfg) {
    const old = JSON.stringify(this.cfg);
    this.cfg = { ...this.cfg, ...cfg };
    if (JSON.stringify(this.cfg) === old) return;
    for (const m of [this.aoMat, this.blurMat, this.preMat, this.downMat, this.upMat, this.compMat]) m.dispose();
    this.makeMaterials();
    this.allocate(true);
  }

  setSize(w, h) {
    w = Math.max(1, Math.floor(w)); h = Math.max(1, Math.floor(h));
    if (w === this.w && h === this.h && this.sceneRT) return;
    this.w = w; this.h = h;
    this.allocate(true);
  }

  allocate() {
    for (const t of this.targets) t.dispose();
    this.targets = [];
    const { w, h } = this;
    const c = this.cfg;
    const maxS = this.r.capabilities.isWebGL2 ? this.r.capabilities.maxSamples : 0;
    const depthTex = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: Math.min(c.msaa, maxS), depthTexture: depthTex, depthBuffer: true, stencilBuffer: false });
    this.targets.push(this.sceneRT);
    const lin = { type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false };
    if (c.ao) {
      const aw = c.aoHalf ? Math.ceil(w / 2) : w, ah = c.aoHalf ? Math.ceil(h / 2) : h;
      this.aoRT = new THREE.WebGLRenderTarget(aw, ah, lin);
      this.aoRT2 = new THREE.WebGLRenderTarget(aw, ah, lin);
      this.targets.push(this.aoRT, this.aoRT2);
    }
    this.mips = [];
    if (c.bloom || c.dof) {
      let mw = w, mh = h;
      const n = c.bloom ? c.bloomLevels : 2;
      for (let i = 0; i < n; i++) {
        mw = Math.max(1, Math.ceil(mw / 2)); mh = Math.max(1, Math.ceil(mh / 2));
        const t = new THREE.WebGLRenderTarget(mw, mh, lin);
        this.mips.push(t); this.targets.push(t);
      }
    }
    if (c.dof) {
      this.blurRT = new THREE.WebGLRenderTarget(Math.ceil(w / 2), Math.ceil(h / 2), lin);
      this.blurRT2 = new THREE.WebGLRenderTarget(Math.ceil(w / 2), Math.ceil(h / 2), lin);
      this.targets.push(this.blurRT, this.blurRT2);
    }
  }

  pass(mat, target, clear = true) {
    const r = this.r;
    this.quad.material = mat;
    r.setRenderTarget(target);
    if (clear) r.clear(true, false, false);
    r.render(this.quad, this.camera);
  }

  render(scene, camera) {
    const r = this.r, p = this.params, c = this.cfg;
    if (!this.sceneRT) this.allocate();
    const proj = camera.projectionMatrix.elements;
    const projV = [1 / proj[0], 1 / proj[5], camera.near, camera.far];
    r.setRenderTarget(this.sceneRT);
    r.clear(true, true, true);
    r.render(scene, camera);

    const autoClear = r.autoClear;
    r.autoClear = false;
    // Umgebungsverdeckung
    if (c.ao) {
      const u = this.aoMat.uniforms;
      u.tDepth.value = this.sceneRT.depthTexture;
      u.uRes.value.set(this.aoRT.width, this.aoRT.height);
      u.uFullTexel.value.set(1 / this.w, 1 / this.h);
      u.uProj.value.set(...projV);
      u.uRadius.value = p.aoRadius;
      u.uIntensity.value = p.aoIntensity;
      u.uProjScale.value = this.aoRT.height * proj[5] * 0.5;
      u.uMaxPx.value = this.aoRT.height * 0.09;
      this.pass(this.aoMat, this.aoRT);
      const b = this.blurMat.uniforms;
      b.tAO.value = this.aoRT.texture; b.uDir.value.set(1 / this.aoRT.width, 0);
      this.pass(this.blurMat, this.aoRT2);
      b.tAO.value = this.aoRT2.texture; b.uDir.value.set(0, 1 / this.aoRT.height);
      this.pass(this.blurMat, this.aoRT);
    }
    // Bloom
    if (c.bloom && this.mips.length) {
      const pre = this.preMat.uniforms;
      pre.tColor.value = this.sceneRT.texture;
      pre.uTexel.value.set(1 / this.w, 1 / this.h);
      pre.uThreshold.value = p.threshold; pre.uKnee.value = p.knee;
      this.pass(this.preMat, this.mips[0]);
      const d = this.downMat.uniforms;
      for (let i = 1; i < this.mips.length; i++) {
        const src = this.mips[i - 1];
        d.tSrc.value = src.texture; d.uTexel.value.set(0.5 / src.width, 0.5 / src.height);
        this.pass(this.downMat, this.mips[i]);
      }
      const up = this.upMat.uniforms;
      for (let i = this.mips.length - 1; i > 0; i--) {
        const src = this.mips[i];
        up.tSrc.value = src.texture; up.uTexel.value.set(0.5 / src.width, 0.5 / src.height);
        up.uWeight.value = 1;
        this.pass(this.upMat, this.mips[i - 1], false);
      }
    }
    // Weichzeichner für Tiefenschärfe
    if (c.dof && this.blurRT) {
      const d = this.downMat.uniforms;
      d.tSrc.value = this.sceneRT.texture; d.uTexel.value.set(1 / this.w, 1 / this.h);
      this.pass(this.downMat, this.blurRT);
      const up = this.upMat.uniforms;
      up.tSrc.value = this.blurRT.texture; up.uTexel.value.set(1 / this.blurRT.width, 1 / this.blurRT.height); up.uWeight.value = 1;
      this.upMat.blending = THREE.NoBlending;
      this.pass(this.upMat, this.blurRT2);
      this.upMat.blending = THREE.CustomBlending;
    }
    // Zusammensetzen
    const u = this.compMat.uniforms;
    u.tColor.value = this.sceneRT.texture;
    u.tDepth.value = this.sceneRT.depthTexture;
    if (c.ao) { u.tAO.value = this.aoRT.texture; u.uAOTexel.value.set(1 / this.aoRT.width, 1 / this.aoRT.height); }
    if (c.bloom && this.mips.length) u.tBloom.value = this.mips[0].texture;
    if (c.dof && this.blurRT2) u.tBlur.value = this.blurRT2.texture;
    u.uProj.value.set(...projV);
    u.uAOStrength.value = p.aoStrength;
    u.uBloom.value = p.bloom / Math.max(1, this.mips.length - 1);
    u.uExposure.value = p.exposure;
    u.uWB.value.copy(p.wb);
    u.uContrast.value = p.contrast;
    u.uSaturation.value = p.saturation;
    u.uVignette.value = p.vignette;
    u.uShadowTint.value.copy(p.shadowTint);
    u.uAspect.value.set(this.w / Math.max(this.w, this.h), this.h / Math.max(this.w, this.h));
    u.uDof.value = p.dof; u.uFocusZ.value = p.focusZ; u.uTiltShift.value = p.tiltShift;
    this.pass(this.compMat, null);
    r.autoClear = autoClear;
  }

  dispose() {
    for (const t of this.targets) t.dispose();
    for (const m of [this.aoMat, this.blurMat, this.preMat, this.downMat, this.upMat, this.compMat]) m.dispose();
    this.quad.geometry.dispose();
  }
}

// Prüft, ob HDR-Nachbearbeitung möglich ist (WebGL2 + Float-Rendering).
export function postSupported(renderer) {
  const caps = renderer.capabilities;
  if (!caps.isWebGL2) return false;
  const ext = renderer.extensions;
  return !!(ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float'));
}
