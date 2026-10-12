// Baustoff-Shader (Besitzer G2): MeshStandardMaterial mit prozeduralen PBR-Texturen aus den Textur-Arrays.
// Ein und derselbe Shader dient für Einzelmaterialien (getMaterial: Materialindex als Uniform) und für das
// Atlas-Material (Vertex-Attribut aMat). Er braucht nur Position und Normale – die Texturkoordinaten entstehen
// pro Pixel in Weltkoordinaten (1 Kachel = 4 m / Maßstab):
//   – senkrechte und geneigte ebene Flächen: u entlang der Waagrechten, v die Fläche hinauf
//     (Dachziegel-Reihen laufen so immer parallel zur Traufe, Ziegelreihen waagrecht),
//   – waagrechte Flächen und Bodenmaterialien (Flag GROUND): Aufsicht x/z,
//   – gekrümmte Flächen (Zylinder, Kugeln): Projektion entlang der Hauptachse wie im Baukasten.
// Ableitungen für die Mipmap-Wahl kommen analytisch aus der Weltposition (textureGrad) – keine Nähte.
// Zusätzlich: großflächige Variation gegen Kachelwiederholung, Schmutz am Wandfuß (Objekt-y < 0,6 m),
// Schnee (shared.uSnow) auf nach oben zeigenden Flächen, Nässe (shared.uWet) mit Pfützen, Herbstlaub (uAutumn).
import * as THREE from 'three';
import { shared } from './materials.js';
import { getSurfaceArrays, LAYER_INDEX } from './textures.js';

const VERT_PARS = `
#ifdef SURF_ATTR
attribute float aMat;
flat varying int vSMat;
#endif
varying vec3 vSWPos;
varying vec3 vSWNrm;
varying float vSObjY;`;

const VERT_MAIN = `
#ifdef SURF_ATTR
vSMat = int(aMat + 0.5);
#endif
{
  vec4 sWp = vec4(transformed, 1.0);
  vec3 sWn = objectNormal;
  #ifdef USE_INSTANCING
  sWp = instanceMatrix * sWp;
  sWn = mat3(instanceMatrix) * sWn;
  #endif
  sWp = modelMatrix * sWp;
  vSWPos = sWp.xyz;
  vSWNrm = normalize(mat3(modelMatrix) * sWn);
  vSObjY = transformed.y;
}`;

const FRAG_PARS = `
uniform highp sampler2DArray uSAlb;
uniform highp sampler2DArray uSSrf;
uniform highp sampler2D uSPar;
uniform float uSnow;
uniform float uWet;
uniform float uAutumn;
#ifdef SURF_ATTR
flat varying int vSMat;
#else
uniform int uSMat;
#endif
varying vec3 vSWPos;
varying vec3 vSWNrm;
varying float vSObjY;
vec3 sNormV;
float sRough;
float sMetal;
float sAO;`;

const FRAG_SURF = `
{
#ifdef SURF_ATTR
  int sm = vSMat;
#else
  int sm = uSMat;
#endif
  vec4 p0 = texelFetch(uSPar, ivec2(sm, 0), 0);
  vec4 p1 = texelFetch(uSPar, ivec2(sm, 1), 0);
  vec4 p2 = texelFetch(uSPar, ivec2(sm, 2), 0);
  vec4 p3 = texelFetch(uSPar, ivec2(sm, 3), 0);
  int flags = int(p3.x + 0.5);
  vec3 N = normalize(vSWNrm) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 P = vSWPos;
  vec3 A = abs(N);
  bool curved = dot(fwidth(vSWNrm), vec3(1.0)) > 1e-4;
  vec3 T, B;
  if (((flags & 1) != 0 && N.y > 0.5) || A.y > 0.995 || (curved && A.y > 0.6)) { T = vec3(1.0, 0.0, 0.0); B = vec3(0.0, 0.0, 1.0); }
  else if (curved) { T = A.x > A.z ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0); B = vec3(0.0, 1.0, 0.0); }
  else { T = normalize(vec3(N.z, 0.0, -N.x)); B = cross(N, T); }
  vec2 wuv = vec2(dot(P, T), dot(P, B));
  vec3 dPx = dFdx(P), dPy = dFdy(P);
  vec2 wgx = vec2(dot(dPx, T), dot(dPx, B)), wgy = vec2(dot(dPy, T), dot(dPy, B));
  vec2 sc = p2.xy * 2.5;
  float layer = p0.w;
  vec4 ta = textureGrad(uSAlb, vec3(wuv * sc, layer), wgx * sc, wgy * sc);
  vec4 ts = textureGrad(uSSrf, vec3(wuv * sc, layer), wgx * sc, wgy * sc);
  vec4 mc = textureGrad(uSAlb, vec3(wuv * 0.11 + vec2(0.37, 0.71) * layer, 0.0), wgx * 0.11, wgy * 0.11);
  // Farbe
  vec3 alb = mix(p0.rgb, p1.rgb, ta.a) * ta.rgb * 1.9922;
  alb *= 0.9 + 0.2 * mc.r;
  alb *= vec3(1.0 + 0.04 * (mc.g - 0.5), 1.0, 1.0 - 0.04 * (mc.g - 0.5));
  sAO = ts.a;
  alb *= mix(1.0, sAO, 0.45);
  float wallK = 1.0 - smoothstep(0.35, 0.65, A.y);
  float grime = (1.0 - smoothstep(0.0, 0.05 + 0.06 * mc.b, vSObjY)) * wallK * p3.y;
  alb = mix(alb, alb * vec3(0.62, 0.6, 0.55), grime * 0.55);
  sRough = clamp(ts.b * p2.z, 0.03, 1.0);
  sMetal = p2.w;
  #ifndef USE_ENVMAP
  // Ohne Umgebungskarte spiegeln Metalle nur Schwärze – dann überwiegend als Dielektrikum zeigen
  alb *= 1.0 + 0.35 * sMetal;
  sMetal *= 0.25;
  #endif
  // Normale
  vec2 nt = ts.rg * 2.0 - 1.0;
  vec3 tn = normalize(vec3(nt * p1.w, sqrt(max(1e-4, 1.0 - dot(nt, nt)))));
  vec3 Tn = normalize(T - N * dot(N, T));
  vec3 Bn = B - N * dot(N, B); Bn = normalize(Bn - Tn * dot(Tn, Bn));
  vec3 nW = normalize(Tn * tn.x + Bn * tn.y + N * tn.z);
  // Löcher (Maschendraht): nur in der Nähe verwerfen, in der Ferne als Fläche
  if ((flags & 2) != 0) {
    float lod = log2(max(length(wgx * sc), length(wgy * sc)) * 256.0);
    if (lod < 1.6 && ta.a < 0.5) discard;
    alb *= mix(1.0, 0.75, smoothstep(1.6, 3.0, lod));
  }
  // Herbstlaub
  if ((flags & 8) != 0 && uAutumn > 0.0) {
    float k = uAutumn * smoothstep(0.25, 0.6, mc.b + 0.25 * mc.r);
    vec3 aut = mix(vec3(0.62, 0.2, 0.04), vec3(0.78, 0.5, 0.08), mc.g) * (0.6 + 0.8 * dot(ta.rgb, vec3(0.333)));
    alb = mix(alb, aut * 0.55, k);
  }
  // Schnee auf nach oben zeigenden Flächen
  float up = N.y;
  float snowCap = smoothstep(0.3, 0.72, up) * p3.w;
  float snowK = 0.0;
  if (uSnow > 0.001 && snowCap > 0.0) {
    float cov = uSnow * snowCap * 1.35 - (0.55 * mc.b + 0.25 * (1.0 - sAO) + 0.2 * mc.a) * 0.6;
    snowK = smoothstep(0.15, 0.45, cov);
    vec3 snowC = vec3(0.86, 0.89, 0.94) * (0.93 + 0.07 * mc.r) * (0.86 + 0.14 * sAO);
    alb = mix(alb, snowC, snowK);
    sRough = mix(sRough, 0.62, snowK);
    sMetal = mix(sMetal, 0.0, snowK);
    nW = normalize(mix(nW, N, snowK * 0.7));
    sAO = mix(sAO, 1.0, snowK * 0.7);
  }
  // Nässe: dunkler, glatter; Pfützen auf ebenen Böden
  if (uWet > 0.001) {
    float wet = uWet * mix(0.55, 1.0, smoothstep(0.2, 0.9, up)) * (1.0 - snowK);
    alb *= 1.0 - wet * p3.z * 0.42;
    sRough = mix(sRough, max(0.07, sRough * 0.32), wet);
    if ((flags & 4) != 0 && up > 0.97) {
      float pd = smoothstep(0.6, 0.72, mc.a + (1.0 - sAO) * 0.25 + (uWet - 1.0) * 0.35) * uWet;
      sRough = mix(sRough, 0.025, pd);
      nW = normalize(mix(nW, N, pd));
      alb *= 1.0 - 0.3 * pd;
      sMetal = mix(sMetal, 0.0, pd);
    }
  }
  diffuseColor.rgb *= alb;
  sNormV = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
}`;

// Ein Oberflächen-Material. opts: { attribute: true (Atlas) | index: Zahl, params: DataTexture, arrays }
export function makeSurfaceMaterial(opts) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  const attr = !!opts.attribute;
  mat.defines = attr ? { SURF_ATTR: '' } : {};
  mat.userData.surfaceIndex = attr ? -1 : opts.index;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSAlb = { value: opts.arrays.albedo };
    shader.uniforms.uSSrf = { value: opts.arrays.surface };
    shader.uniforms.uSPar = { value: opts.params };
    shader.uniforms.uSnow = shared.uSnow;
    shader.uniforms.uWet = shared.uWet;
    shader.uniforms.uAutumn = shared.uAutumn;
    if (!attr) shader.uniforms.uSMat = { value: opts.index };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>' + VERT_PARS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>' + VERT_MAIN);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>' + FRAG_PARS)
      .replace('#include <color_fragment>', '#include <color_fragment>' + FRAG_SURF)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = sRough;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = sMetal;')
      .replace('#include <normal_fragment_maps>', 'normal = sNormV;')
      .replace('#include <aomap_fragment>', `{ float aoK = mix(1.0, sAO, 0.85);
reflectedLight.indirectDiffuse *= aoK; reflectedLight.indirectSpecular *= aoK; }`);
  };
  mat.customProgramCacheKey = () => 'g2surf' + (attr ? 'A' : 'U');
  return mat;
}

// Detail-Überlagerung für fremde Materialien (z. B. Straßen-Atlas von G8, Gelände von G7):
// applySurfaceDetail(material, 'asphalt', { scale: 1, color: 1, normal: 1, rough: 1, snow: false, wet: true })
// multipliert die Farbe mit dem Detailmuster der Schicht (neutral = 1), stört die Normale und moduliert die Rauheit.
// Projektion in Weltkoordinaten (oben: x/z, Seiten: Hauptachse), 1 Kachel = 4 m / scale. Bestehende
// onBeforeCompile-Erweiterungen des Materials bleiben erhalten (werden vorher aufgerufen).
export function applySurfaceDetail(mat, layerName, o = {}) {
  const arrays = getSurfaceArrays();
  const layer = LAYER_INDEX[layerName] ?? LAYER_INDEX.paint;
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  const str = new THREE.Vector4(o.color ?? 1, o.normal ?? 1, o.rough ?? 1, o.scale ?? 1);
  mat.onBeforeCompile = (shader, renderer) => {
    if (prev) prev.call(mat, shader, renderer);
    shader.uniforms.uDAlb = { value: arrays.albedo };
    shader.uniforms.uDSrf = { value: arrays.surface };
    shader.uniforms.uDLayer = { value: layer };
    shader.uniforms.uDStr = { value: str };
    shader.uniforms.uSnow = shared.uSnow;
    shader.uniforms.uWet = shared.uWet;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDWPos;\nvarying vec3 vDWNrm;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{ vec4 dwp = vec4(transformed, 1.0); vec3 dwn = objectNormal;
#ifdef USE_INSTANCING
dwp = instanceMatrix * dwp; dwn = mat3(instanceMatrix) * dwn;
#endif
dwp = modelMatrix * dwp; vDWPos = dwp.xyz; vDWNrm = normalize(mat3(modelMatrix) * dwn); }`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform highp sampler2DArray uDAlb;
uniform highp sampler2DArray uDSrf;
uniform float uDLayer;
uniform vec4 uDStr;
uniform float uSnow;
uniform float uWet;
varying vec3 vDWPos;
varying vec3 vDWNrm;
vec4 gDA; vec4 gDS; vec3 gDT; vec3 gDB; vec3 gDN;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 N = normalize(vDWNrm); vec3 A = abs(N); vec3 P = vDWPos;
  if (A.y > 0.5) { gDT = vec3(1.0, 0.0, 0.0); gDB = vec3(0.0, 0.0, 1.0); }
  else if (A.x > A.z) { gDT = vec3(0.0, 0.0, 1.0); gDB = vec3(0.0, 1.0, 0.0); }
  else { gDT = vec3(1.0, 0.0, 0.0); gDB = vec3(0.0, 1.0, 0.0); }
  gDN = N;
  float sc = 2.5 * uDStr.w;
  vec2 uv = vec2(dot(P, gDT), dot(P, gDB)) * sc;
  vec3 dx = dFdx(P), dy = dFdy(P);
  vec2 gx = vec2(dot(dx, gDT), dot(dx, gDB)) * sc, gy = vec2(dot(dy, gDT), dot(dy, gDB)) * sc;
  gDA = textureGrad(uDAlb, vec3(uv, uDLayer), gx, gy);
  gDS = textureGrad(uDSrf, vec3(uv, uDLayer), gx, gy);
  vec3 det = gDA.rgb * 1.9922 * mix(1.0, gDS.a, 0.4);
  diffuseColor.rgb *= mix(vec3(1.0), det, uDStr.x);
  ${o.snow ? `float sk = uSnow * smoothstep(0.4, 0.8, N.y) * smoothstep(0.2, 0.5, uSnow * 1.3 - (1.0 - gDS.a) * 0.4);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.89, 0.94), sk);` : ''}
  ${o.wet === false ? '' : 'diffuseColor.rgb *= 1.0 - uWet * 0.35 * mix(0.6, 1.0, smoothstep(0.2, 0.9, N.y));'}
}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor * mix(1.0, gDS.b / 0.8, uDStr.z), 0.03, 1.0);
${o.wet === false ? '' : 'roughnessFactor = mix(roughnessFactor, max(0.07, roughnessFactor * 0.35), uWet);'}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  vec2 nt = (gDS.rg * 2.0 - 1.0) * uDStr.y;
  vec3 Tn = normalize(gDT - gDN * dot(gDN, gDT)); vec3 Bn = gDB - gDN * dot(gDN, gDB); Bn = normalize(Bn - Tn * dot(Tn, Bn));
  normal = normalize(normal + (viewMatrix * vec4(Tn * nt.x + Bn * nt.y, 0.0)).xyz);
}`);
  };
  mat.customProgramCacheKey = () => prevKey() + '|g2det' + layer + (o.snow ? 's' : '') + (o.wet === false ? '' : 'w');
  mat.needsUpdate = true;
  return mat;
}
