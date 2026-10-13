// Gemeinsame Materialien und Shader-Erweiterungen (Fenster, Wasserwellen, Atmosphäre).
//
// Atmosphäre (Besitzer G1): Beim Import werden drei Shader-Bausteine von Three.js global erweitert,
// damit JEDES Material (auch die anderer Agenten) dieselbe Luft und dieselben Wolken sieht:
//  - fog_*            Nebel mit Höhe (dichter am Boden), Entfernungsdunst und Sonnenstreuung
//                     (Dunst leuchtet in Richtung Sonne). Ohne Werte in `atmo` verhält er sich wie THREE.Fog.
//  - lights_*         Wolkenschatten: wandernde Schattenflecken auf dem direkten Sonnenlicht.
//  - tonemapping_*    CustomToneMapping = „Neutral“ (Farben bleiben bis ~0,76 unverändert, Lichter werden
//                     weich abgerollt) – dieselbe Kurve wie in der Nachbearbeitung (post.js).
// Die Werte liegen als Float32Array in `atmo`; Three.js kopiert solche Arrays beim Klonen der Uniforms
// NICHT, alle Materialien teilen sich also dieselben Daten. Gesetzt werden sie von scene.js.
import * as THREE from 'three';

// Gemeinsame Uniforms aller Shader. uSnow: Schneedecke 0..1, uWet: Nässe 0..1,
// uSeason: Jahreszeit 0..1 (0 = Frühlingsanfang), uAutumn: Herbstfärbung 0..1. Gesetzt von der Licht-/Wetter-Ansicht.
// Zusätzlich: uRain (Regen fällt 0..1), uWind (0..1), uWindDir (rad) für Pflanzen/Wasser.
export const shared = {
  uNight: { value: 0 },
  uTime: { value: 0 },
  uSnow: { value: 0 },
  uWet: { value: 0 },
  uSeason: { value: 0.3 },
  uAutumn: { value: 0 },
  uRain: { value: 0 },
  uWind: { value: 0.2 },
  uWindDir: { value: 0.6 },
};

// Atmosphären-Daten (siehe Kopf). Nur scene.js schreibt hinein.
export const atmo = {
  fogA: new Float32Array([0, 0.3, 0, 0]),   // x Entfernungsdichte, y Höhenabfall, z Basishöhe, w aktiv (>0.5)
  fogB: new Float32Array([0, 1, 0, 0]),     // xyz Richtung zur Sonne (Welt), w Stärke des Sonnenglühens
  fogC: new Float32Array([0, 0, 1, 0]),     // x Bodennebel-Dichte, y Startentfernung, z max. Deckkraft
  fogSun: new Float32Array([1, 0.8, 0.6]),  // Horizontfarbe auf der Sonnenseite (linear)
  cloud: new Float32Array([0, 0, 0.02, 0]), // xy Versatz, z Maßstab, w Stärke (0 = aus)
  cloudB: new Float32Array([0.4, 0.18, 30, 0]), // x Bedeckung, y Weichheit, z Höhe der Wolkenschicht
  cloudDir: new Float32Array([0, 1, 0]),    // Lichtrichtung für die Projektion der Wolkenschatten
};

// Kachelbare Rauschtextur (256², RGBA): R/G = zwei unabhängige FBM-Wolkenmuster, B = feines Detail.
// Wird für Wolkenschatten, Himmelswolken und Sterne genutzt (Texturzugriff statt teurem Rauschen im Shader).
function makeCloudNoise(N = 256) {
  const data = new Uint8Array(N * N * 4);
  const lattice = (seed, P) => {
    const v = new Float32Array(P * P);
    let s = seed;
    for (let i = 0; i < P * P; i++) { s = (s * 16807) % 2147483647; v[i] = s / 2147483647; }
    return v;
  };
  const layers = [];
  for (let ch = 0; ch < 3; ch++) {
    const oct = [];
    const base = ch === 2 ? 16 : 4;
    const n = ch === 2 ? 2 : 5;
    for (let o = 0; o < n; o++) { const P = base << o; oct.push({ P, v: lattice(1234 + ch * 977 + o * 131, P), a: Math.pow(0.5, o + 1) }); }
    layers.push(oct);
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    for (let ch = 0; ch < 3; ch++) {
      let s = 0, norm = 0;
      for (const { P, v, a } of layers[ch]) {
        const fx = (x / N) * P, fy = (y / N) * P;
        const ix = Math.floor(fx), iy = Math.floor(fy);
        let tx = fx - ix, ty = fy - iy;
        tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
        const x0 = ix % P, y0 = iy % P, x1 = (ix + 1) % P, y1 = (iy + 1) % P;
        const a0 = v[y0 * P + x0], b0 = v[y0 * P + x1], a1 = v[y1 * P + x0], b1 = v[y1 * P + x1];
        s += a * ((a0 + (b0 - a0) * tx) * (1 - ty) + (a1 + (b1 - a1) * tx) * ty);
        norm += a;
      }
      // Kontrast etwas spreizen (FBM drängt sich um 0,5)
      const val = Math.min(1, Math.max(0, (s / norm - 0.5) * 1.6 + 0.5));
      data[(y * N + x) * 4 + ch] = Math.round(val * 255);
    }
    data[(y * N + x) * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}
export const cloudNoise = makeCloudNoise();

const ATMO_FOG_UNIFORMS = () => ({
  uAtmoFogA: { value: atmo.fogA }, uAtmoFogB: { value: atmo.fogB }, uAtmoFogC: { value: atmo.fogC }, uAtmoFogSun: { value: atmo.fogSun },
});
const ATMO_LIGHT_UNIFORMS = () => ({
  uAtmoCloud: { value: atmo.cloud }, uAtmoCloudB: { value: atmo.cloudB }, uAtmoCloudDir: { value: atmo.cloudDir }, uAtmoCloudTex: { value: cloudNoise },
});

// GLSL: Welt-Position aus einer Kamera-Position (viewMatrix ist starr, R^T = Inverse).
const VIEW_TO_WORLD = (v) => `(vec3(dot(viewMatrix[0].xyz, ${v}), dot(viewMatrix[1].xyz, ${v}), dot(viewMatrix[2].xyz, ${v})) - vec3(dot(viewMatrix[0].xyz, viewMatrix[3].xyz), dot(viewMatrix[1].xyz, viewMatrix[3].xyz), dot(viewMatrix[2].xyz, viewMatrix[3].xyz)))`;

// Nebel als GLSL-Funktion – auch für eigene Shader (Punkte, Wolken) nutzbar.
export const ATMO_FOG_GLSL = /* glsl */`
float atmoFogFactor(vec3 wp, vec3 camPos, vec4 fa, vec4 fc, out vec3 rd) {
  vec3 r = wp - camPos;
  float dist = length(r);
  rd = r / max(dist, 1e-4);
  float fd = max(dist - fc.y, 0.0);
  float b = max(fa.y, 1e-3);
  float h0 = camPos.y - fa.z;
  float h1 = wp.y - fa.z;
  float dh = h1 - h0;
  float avgD = abs(dh) > 1e-3 ? (exp(-b * max(h0, -4.0)) - exp(-b * max(h1, -4.0))) / (b * dh) : exp(-b * max(h0, -4.0));
  float tau = fd * (fa.x + fc.x * avgD);
  return min(1.0 - exp(-tau), fc.z);
}
vec3 atmoFogTint(vec3 rd, vec3 horizon, vec3 sunSide, vec4 fb) {
  vec2 hd = normalize(rd.xz + vec2(1e-5));
  vec2 sd = normalize(fb.xz + vec2(1e-5));
  float az = pow(0.5 + 0.5 * dot(hd, sd), 3.0);
  float glow = pow(max(dot(rd, fb.xyz), 0.0), 6.0) * fb.w;
  return mix(horizon, sunSide, clamp(az * 0.9 + glow, 0.0, 1.0));
}
`;

// Diagnose: index.html?g1skip=fog|light|all schaltet die globalen Shader-Erweiterungen ab.
const SKIP = (() => { try { return new URLSearchParams(location.search).get('g1skip') || ''; } catch (e) { return ''; } })();

function patchChunks() {
  const C = THREE.ShaderChunk;
  if (C.fog_fragment.includes('atmoFog')) return;
  if (SKIP.includes('all')) return;
  if (!SKIP.includes('fog')) {
  C.fog_pars_vertex = `#ifdef USE_FOG
	varying float vFogDepth;
	varying vec3 vFogWorld;
#endif`;
  C.fog_vertex = `#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
	vFogWorld = ${VIEW_TO_WORLD('mvPosition.xyz')};
#endif`;
  C.fog_pars_fragment = `#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	varying vec3 vFogWorld;
	uniform vec4 uAtmoFogA;
	uniform vec4 uAtmoFogB;
	uniform vec4 uAtmoFogC;
	uniform vec3 uAtmoFogSun;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
	${ATMO_FOG_GLSL}
#endif`;
  C.fog_fragment = `#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	vec3 fogTint = fogColor;
	if ( uAtmoFogA.w > 0.5 ) {
		vec3 atmoRd;
		fogFactor = atmoFogFactor( vFogWorld, cameraPosition, uAtmoFogA, uAtmoFogC, atmoRd );
		fogTint = atmoFogTint( atmoRd, fogColor, uAtmoFogSun, uAtmoFogB );
	}
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogTint, fogFactor );
#endif`;
  }

  // Wolkenschatten auf dem direkten Licht
  if (!SKIP.includes('light')) {
  C.lights_pars_begin = C.lights_pars_begin + `
uniform vec4 uAtmoCloud;
uniform vec4 uAtmoCloudB;
uniform vec3 uAtmoCloudDir;
uniform sampler2D uAtmoCloudTex;
float atmoCloudShadow(vec3 viewPos) {
  if (uAtmoCloud.w <= 0.001) return 1.0;
  vec3 wp = ${VIEW_TO_WORLD('viewPos')};
  vec3 L = uAtmoCloudDir;
  vec2 p = wp.xz + L.xz * ((uAtmoCloudB.z - wp.y) / max(L.y, 0.25));
  p = p * uAtmoCloud.z + uAtmoCloud.xy;
  float n = texture2D(uAtmoCloudTex, p * 0.25).r;
  float edge = 1.0 - uAtmoCloudB.x;
  float c = smoothstep(edge - uAtmoCloudB.y, edge + uAtmoCloudB.y, n);
  return 1.0 - c * uAtmoCloud.w;
}
`;
  C.lights_fragment_begin = C.lights_fragment_begin.replace(
    'getDirectionalLightInfo( directionalLight, directLight );',
    'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= atmoCloudShadow( geometryPosition );',
  );
  }

  // Tonwertkurve „Neutral“ (Khronos PBR Neutral) als CustomToneMapping
  C.tonemapping_pars_fragment = C.tonemapping_pars_fragment.replace(
    'vec3 CustomToneMapping( vec3 color ) { return color; }',
    `vec3 CustomToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < 0.76 ) return color;
	float d = 0.24;
	float newPeak = 1.0 - d * d / ( peak + d - 0.76 );
	color *= newPeak / peak;
	float g = 1.0 - 1.0 / ( 0.15 * ( peak - newPeak ) + 1.0 );
	return mix( color, vec3( newPeak ), g );
}`,
  );

  // Uniforms an alle eingebauten Shader hängen (gleiche Float32Array-Objekte)
  const addFog = (u) => { if (u && u.fogColor && !u.uAtmoFogA) Object.assign(u, ATMO_FOG_UNIFORMS()); };
  const addLight = (u) => { if (u && u.directionalLights && !u.uAtmoCloud) Object.assign(u, ATMO_LIGHT_UNIFORMS()); };
  addFog(THREE.UniformsLib.fog);
  addLight(THREE.UniformsLib.lights);
  for (const k of Object.keys(THREE.ShaderLib)) {
    const u = THREE.ShaderLib[k].uniforms;
    addFog(u); addLight(u);
  }
}
patchChunks();

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
  const mat = new THREE.MeshStandardMaterial({ color: 0x3f9fb8, transparent: true, opacity: 0.84, roughness: 0.08, metalness: 0.1, depthWrite: false });
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
diffuseColor.rgb *= 1.0 - uNight * 0.35;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  vec2 q = vXZ * 2.3;
  float t = uTime;
  vec3 wn = vec3(
    cos(q.x * 1.9 + t * 1.4) * 0.5 + cos(q.x * 4.3 - q.y * 2.1 + t * 2.1) * 0.3 + cos(q.y * 7.7 + q.x * 3.1 - t * 2.9) * 0.12,
    6.0,
    sin(q.y * 1.7 - t * 1.1) * 0.5 + sin(q.y * 3.9 + q.x * 2.7 + t * 1.7) * 0.3 + sin(q.x * 8.3 - q.y * 2.3 + t * 3.3) * 0.12);
  normal = normalize(mix(normal, normalize((viewMatrix * vec4(normalize(wn), 0.0)).xyz), 0.9));
}`);
  };
  mat.customProgramCacheKey = () => 'water2';
  return mat;
}

// Glow-Textur für Lichter (Laternen, Scheinwerfer, Feuer): heller Kern + weicher Hof.
export function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const dx = (x + 0.5 - 32) / 32, dy = (y + 0.5 - 32) / 32;
    const r = Math.sqrt(dx * dx + dy * dy);
    const core = Math.exp(-r * r * 38);
    const halo = Math.max(0, 1 - r) ** 2.2 * 0.55;
    const a = Math.min(1, core + halo);
    const k = (y * 64 + x) * 4;
    img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
    img.data[k + 3] = Math.round(a * 255);
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Punktwolke mit individueller Größe, Farbe und Deckkraft. aSize = Größe in Welteinheiten.
// uScale wird von der Engine gesetzt (Bildpuffer-Höhe / (2·tan(fov/2))), damit Größen bei jeder Pixeldichte stimmen.
// Ferne Punkte werden mit dem Atmosphären-Nebel ausgeblendet.
export function makePointsMaterial(tex, additive = true) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: tex }, uScale: { value: 300 }, uMinPx: { value: 1.5 },
      uAtmoFogA: { value: atmo.fogA }, uAtmoFogC: { value: atmo.fogC },
    },
    vertexShader: `
attribute float aSize;
attribute vec4 aColor;
varying vec4 vColor;
uniform float uScale;
uniform float uMinPx;
uniform vec4 uAtmoFogA;
uniform vec4 uAtmoFogC;
${ATMO_FOG_GLSL}
void main() {
  vColor = aColor;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec4 mv = viewMatrix * wp;
  float px = aSize * uScale / max(0.1, -mv.z);
  // sehr kleine Punkte nicht flackern lassen: Mindestgröße, dafür blasser
  if (px < uMinPx) { vColor.a *= px / uMinPx; px = uMinPx; }
  gl_PointSize = px;
  if (uAtmoFogA.w > 0.5) { vec3 rd; vColor.a *= 1.0 - atmoFogFactor(wp.xyz, cameraPosition, uAtmoFogA, uAtmoFogC, rd); }
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `
uniform sampler2D uTex;
varying vec4 vColor;
void main() {
  vec4 t = texture2D(uTex, gl_PointCoord);
  gl_FragColor = vec4(vColor.rgb, vColor.a * t.a);
  if (gl_FragColor.a < 0.004) discard;
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
    // nur den benutzten Teil hochladen
    for (const [name, k] of [['position', 3], ['aColor', 4], ['aSize', 1]]) {
      const at = this.geo.attributes[name];
      if (at.addUpdateRange) { at.clearUpdateRanges(); at.addUpdateRange(0, Math.max(1, this.n) * k); }
      at.needsUpdate = true;
    }
    this.points.visible = this.n > 0;
  }
}
