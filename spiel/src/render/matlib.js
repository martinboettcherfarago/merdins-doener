// Materialbibliothek (Besitzer G2): Alle Gebäude, Straßen und Objekte holen ihre Materialien per Namen.
// Die Liste der Namen ist der Vertrag zwischen Architektur-Bausteinen und dem Textur-System.
//
// getMaterial(name) liefert für jeden undurchsichtigen Baustoff ein texturiertes PBR-Material (Farbe, Normale,
// Rauheit, Verdeckung aus den prozeduralen Textur-Arrays, siehe textures.js / tex_shader.js). Die Texturen werden
// in Weltkoordinaten projiziert (1 Kachel = 4 m), das uv-Attribut wird nicht gebraucht. Alle Baustoffe zeigen
// Schnee (shared.uSnow), Nässe (shared.uWet), Herbstlaub (shared.uAutumn) und Schmutz am Wandfuß.
// Glas (glass_*, door_glass, lod_windows) bleibt ein eigenes Material: nachts beleuchtete Fenster über aLit und
// Instanzposition, tagsüber Himmels- und Häuserspiegelung (ohne Umgebungskarte) bzw. scene.environment (G1).
// Leuchtende Materialien und Wasser sind ebenfalls eigene Materialien.
// Für eigene Shader: getTexture(name) und getSurfaceArrays() aus textures.js.
import * as THREE from 'three';
import { shared } from './materials.js';
import { getSurfaceArrays, buildParamTexture, setTextureDefs } from './textures.js';
import { makeSurfaceMaterial } from './tex_shader.js';

// name: [Farbe, Rauheit, Metall, Optionen]
export const MATERIAL_DEFS = {
  // Wände
  plaster_white: [0xf1ede4, 0.9, 0], plaster_cream: [0xece0c6, 0.9, 0], plaster_ochre: [0xd9b77a, 0.9, 0],
  plaster_pink: [0xe8c4bc, 0.9, 0], plaster_blue: [0xc9d8e2, 0.9, 0], plaster_green: [0xc9dcc4, 0.9, 0], plaster_grey: [0xc8c6c0, 0.9, 0],
  brick_red: [0xa8533f, 0.92, 0], brick_brown: [0x7e5240, 0.92, 0], brick_yellow: [0xd2b27a, 0.92, 0], brick_white: [0xe2ddd2, 0.92, 0], brick_dark: [0x5a3d33, 0.92, 0],
  concrete: [0xbdbab3, 0.88, 0], concrete_dark: [0x8c8a85, 0.9, 0], concrete_panel: [0xd2cfc6, 0.85, 0],
  stone_sandstone: [0xd8c39a, 0.9, 0], stone_grey: [0xa9a8a2, 0.88, 0], stone_dark: [0x6f6d6a, 0.88, 0],
  wood_planks: [0x9a7250, 0.85, 0], wood_dark: [0x5e4433, 0.85, 0], siding_white: [0xeeeeea, 0.8, 0], siding_blue: [0x9fb8c8, 0.8, 0], siding_red: [0xa84a3c, 0.8, 0],
  metal_panel_grey: [0xa9b0b5, 0.55, 0.5], metal_panel_blue: [0x6d8aa3, 0.5, 0.5], metal_panel_white: [0xe4e6e7, 0.5, 0.4],
  metal_corrugated: [0x9aa1a6, 0.6, 0.6], metal_corrugated_red: [0x9b4a3e, 0.6, 0.5], metal_corrugated_green: [0x5f7f68, 0.6, 0.5],
  // Dächer
  roof_tiles_red: [0xb4553f, 0.85, 0], roof_tiles_brown: [0x7a4a36, 0.85, 0], roof_tiles_anthracite: [0x45474c, 0.8, 0],
  roof_slate: [0x4f5560, 0.75, 0], roof_copper: [0x7a9f90, 0.6, 0.3], roof_metal_grey: [0x7d8287, 0.5, 0.6],
  roof_flat_gravel: [0x8f8c86, 0.95, 0], roof_flat_membrane: [0x5e6166, 0.8, 0], green_roof: [0x789a62, 0.95, 0], solar_panel: [0x1f3554, 0.25, 0.4],
  // Glas
  glass_window: [0x2c3e4d, 0.1, 0.6, { glass: true }], glass_shop: [0x3a5566, 0.08, 0.6, { glass: true, shop: true }],
  glass_curtain_blue: [0x41617e, 0.06, 0.8, { glass: true, curtain: true }], glass_curtain_green: [0x3f6a64, 0.06, 0.8, { glass: true, curtain: true }],
  glass_curtain_dark: [0x23282f, 0.05, 0.85, { glass: true, curtain: true }], glass_curtain_gold: [0x7d6a45, 0.08, 0.9, { glass: true, curtain: true }],
  // Details
  window_frame_white: [0xf3f1ec, 0.6, 0], window_frame_dark: [0x3a3d42, 0.5, 0.3], window_frame_wood: [0x6e4f38, 0.7, 0],
  trim_stone: [0xe2dccd, 0.85, 0], trim_dark: [0x4d4f53, 0.7, 0.1], door_wood: [0x6b4a33, 0.7, 0], door_glass: [0x3a5566, 0.1, 0.6, { glass: true }],
  metal_dark: [0x3b3f45, 0.45, 0.7], metal_light: [0xb9bec3, 0.4, 0.8], rubber: [0x222326, 0.9, 0], chimney_brick: [0x8e4b3a, 0.9, 0],
  paint_red: [0xc7392d, 0.6, 0], paint_white: [0xf2f2ef, 0.6, 0], paint_yellow: [0xe9b630, 0.6, 0], paint_blue: [0x2f6fb5, 0.6, 0], paint_green: [0x2f8a52, 0.6, 0], paint_orange: [0xe8742a, 0.6, 0],
  awning_red: [0xc9463a, 0.85, 0], awning_blue: [0x2f6fb5, 0.85, 0], awning_green: [0x2f8a52, 0.85, 0], awning_yellow: [0xe0b23a, 0.85, 0], awning_striped: [0xd9584a, 0.85, 0, { striped: true }],
  canvas_white: [0xf0ede4, 0.9, 0],
  // Boden
  asphalt: [0x4d5158, 0.95, 0], asphalt_dark: [0x3a3d42, 0.95, 0], pavers: [0xb9b2a5, 0.9, 0], sidewalk: [0xc8c3b7, 0.9, 0], curb: [0xbcb7ad, 0.85, 0],
  grass: [0x7fae5e, 0.95, 0], grass_dry: [0xa8a865, 0.95, 0], dirt: [0x8c7a62, 0.97, 0], gravel: [0x9c968c, 0.97, 0], sand: [0xe2d3a2, 0.95, 0], rock: [0x8f877c, 0.9, 0],
  field_soil: [0x7a5a3d, 0.98, 0], field_crops: [0x8fb24f, 0.95, 0], field_wheat: [0xd8bf63, 0.95, 0], field_rapeseed: [0xe6d23c, 0.95, 0],
  water_pool: [0x3fa3c9, 0.08, 0.2, { water: true }], sports_turf: [0x4f9e4d, 0.9, 0], rubber_track: [0xb5503d, 0.9, 0], court_blue: [0x3a6fa8, 0.85, 0],
  // Pflanzen
  leaves_green: [0x5b9a4f, 0.9, 0], leaves_dark: [0x3f7a45, 0.9, 0], leaves_light: [0x7fb85a, 0.9, 0], leaves_autumn: [0xc98a3a, 0.9, 0], bark: [0x6e5240, 0.95, 0], hedge: [0x4d8a46, 0.95, 0],
  // Leuchtend (Schilder, Neon, Lampen) – nachts stärker
  emissive_warm: [0xffd79a, 0.5, 0, { emissive: 0xffc46b }], emissive_cool: [0xdcefff, 0.5, 0, { emissive: 0xbfe2ff }],
  emissive_red: [0xff5040, 0.5, 0, { emissive: 0xff3020 }], emissive_green: [0x60ff90, 0.5, 0, { emissive: 0x30ff70 }],
  neon_pink: [0xff6fb5, 0.4, 0, { emissive: 0xff4fa5 }], neon_cyan: [0x6ff4ff, 0.4, 0, { emissive: 0x3fe8ff }], neon_yellow: [0xffe46f, 0.4, 0, { emissive: 0xffd43f }],
  sign_white: [0xf6f6f2, 0.5, 0, { emissive: 0xffffff, emissiveDay: 0.15 }],
  // Fernansicht: Fensterraster aus UVs (eine Zelle = ein Fenster), Zwischenräume werden verworfen
  lod_windows: [0x2c3e4d, 0.15, 0.5, { lodWindows: true }],
  // Ergänzungen
  plaster_red: [0xc98a7a, 0.9, 0], plaster_yellow: [0xe8d38a, 0.9, 0], tile_white: [0xe9e9e4, 0.4, 0], marble: [0xeeebe4, 0.3, 0.05],
  glass_skylight: [0x7fa7c2, 0.05, 0.4, { glass: true }], chain_fence: [0x8a9096, 0.6, 0.6], scaffold: [0xc8a96a, 0.8, 0.2], scaffold_net: [0x8aa394, 0.9, 0],
  container_red: [0xa8402f, 0.7, 0.3], container_blue: [0x2f5f9a, 0.7, 0.3], container_green: [0x3f7a4a, 0.7, 0.3], container_yellow: [0xd4a32a, 0.7, 0.3],
  tank_white: [0xe6e6e1, 0.5, 0.4], pipe_metal: [0x8c9399, 0.4, 0.8], rust: [0x8a4b2f, 0.9, 0.2], tarmac: [0x55585d, 0.95, 0], runway_marking: [0xf0f0ea, 0.8, 0],
  rail_track: [0x5a4a3c, 0.9, 0.3], ballast: [0x7d776e, 0.97, 0], water_canal: [0x3f8fb0, 0.1, 0.2, { water: true }], hay: [0xd7b866, 0.95, 0], log_wood: [0x8b6a48, 0.9, 0],
  // Ergänzungen G2: Kopfsteinpflaster, Biberschwanz, Reetdach, Brettschalungsbeton, Klinker, Kiesweg, Wiese, Waldboden, Gitterrost, Holzdeck
  cobblestone: [0x8d8a84, 0.8, 0], roof_tiles_beaver: [0xa4503c, 0.85, 0], roof_thatch: [0x8a7448, 0.95, 0], concrete_board: [0xb3afa6, 0.9, 0],
  brick_clinker: [0x6b3a2e, 0.75, 0], gravel_path: [0xb8ab92, 0.95, 0], meadow: [0x8fb162, 0.95, 0], forest_floor: [0x6a5638, 0.97, 0],
  metal_grating: [0x7d8388, 0.5, 0.7], wood_deck: [0x9a7655, 0.8, 0],
  // Wünsche G5/G6: schwarzer und petrolfarbener Lack, Klärbecken-Wasser, Milchglas (nachts beleuchtet wie Fenster)
  paint_black: [0x26272a, 0.55, 0], paint_teal: [0x2f7f80, 0.6, 0],
  water_sewage: [0x5f6a3e, 0.2, 0.1, { water: true }], glass_frosted: [0xb7c6cc, 0.45, 0.05, { glass: true }],
  // Wünsche G3 (Q1): Glasbrüstung (mattes, bläuliches Glas ohne Nachtlicht, undurchsichtig im Atlas), Efeu für Brandwände
  glass_railing: [0xb9cdd6, 0.2, 0.3], ivy: [0x3d6b3a, 0.95, 0],
  // Ergänzungen MODELLE: Terrakotta-Paneele und Bronze-/Cortenblech für Büro- und Wohnfassaden
  terracotta: [0xb5704f, 0.85, 0], metal_panel_bronze: [0x7d5f42, 0.45, 0.65],
};

const cache = new Map();

// Tagsüber: Spiegelung von Himmel und Häuserkante (nur ohne Umgebungskarte; mit scene.environment übernimmt
// MeshStandardMaterial die echte Spiegelung), leichte Unterschiede pro Scheibe, manche mit hellen Vorhängen.
const GLASS_DAY = (strength, curtain) => `
{
  float nkD = smoothstep(0.0, 1.0, uNight);
  float pv = fract(vLit * 13.71), pc = fract(vLit * 5.37);
  diffuseColor.rgb *= 0.78 + 0.44 * pv;
  ${curtain ? '' : 'if (pc < 0.28) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.57, 0.48), 0.45 * (1.0 - nkD));'}
  #ifndef USE_ENVMAP
  vec3 vdir = normalize(vViewPosition);
  vec3 rW = inverseTransformDirection(reflect(-vdir, normal), viewMatrix);
  ${curtain ? 'rW = normalize(rW + vec3(fract(vLit * 91.3) - 0.5, 0.0, fract(vLit * 47.7) - 0.5) * 0.05);' : ''}
  float fres = pow(1.0 - clamp(dot(normal, vdir), 0.0, 1.0), 4.0);
  vec3 sky = mix(vec3(0.16, 0.17, 0.18), vec3(0.66, 0.74, 0.82), smoothstep(-0.3, 0.02, rW.y));
  sky = mix(sky, vec3(0.3, 0.47, 0.74), smoothstep(0.06, 0.75, rW.y));
  float az = atan(rW.z, rW.x) * 7.0;
  float sk = 0.02 + 0.13 * fract(sin(floor(az) * 43.13) * 1753.37) * step(0.25, fract(sin(floor(az * 2.3) * 17.7) * 931.1));
  sky = mix(sky, vec3(0.2, 0.22, 0.25) + 0.05 * step(0.5, fract(az * 3.0)), step(rW.y, sk) * step(-0.02, rW.y));
  float refl = (0.1 + 0.8 * fres) * (1.0 - 0.9 * nkD) * ${strength};
  totalEmissiveRadiance += sky * refl;
  diffuseColor.rgb *= 1.0 - 0.5 * refl;
  #endif
}`;

// Glas: zufällig beleuchtete Fenster in der Nacht. aLit (pro Scheibe) + Instanz-Hash entscheiden.
function patchGlass(mat, opts) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = shared.uNight;
    shader.uniforms.uTime = shared.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aLit;
varying float vLit;
varying vec3 vWorldP;
varying float vGY;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vGY = transformed.y;
vec3 ip = vec3(0.0);
#ifdef USE_INSTANCING
ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
#endif
vLit = fract(aLit + fract(sin(dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453));
vWorldP = ip;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uNight;
uniform float uTime;
varying float vLit;
varying vec3 vWorldP;
varying float vGY;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
${GLASS_DAY(opts.curtain ? '1.15' : opts.shop ? '0.8' : '1.0', !!opts.curtain)}
float nightK = smoothstep(0.0, 1.0, uNight);
float on = step(1.0 - nightK * ${opts.curtain ? '0.45' : opts.shop ? '0.9' : '0.62'}, vLit);
vec3 warm = mix(vec3(1.0, 0.76, 0.45), vec3(0.82, 0.9, 1.0), step(0.85, fract(vLit * 7.13)));
// Raumtiefe: Lage im Geschoss (3 m) – oben Deckenlicht heller, tagsüber Sturzschatten
float fy = fract(vGY / 0.3);
diffuseColor.rgb *= mix(1.0, 0.62, smoothstep(0.62, 0.8, fy) * (1.0 - nightK));
float lampK = 0.72 + 0.5 * smoothstep(0.3, 0.78, fy);
// wenige Fenster mit flackerndem Fernsehlicht
float tv = step(0.93, fract(vLit * 3.71));
warm = mix(warm, vec3(0.55, 0.7, 1.0) * (0.75 + 0.25 * sin(uTime * 7.0 + vLit * 40.0) * sin(uTime * 2.3)), tv);
totalEmissiveRadiance += on * warm * lampK * (0.35 + 1.25 * nightK) * ${opts.shop ? '1.3' : '1.0'};
diffuseColor.rgb *= 1.0 - 0.5 * nightK;`);
  };
  mat.customProgramCacheKey = () => 'glass3' + (opts.curtain ? 'c' : '') + (opts.shop ? 's' : '');
}

function patchLodWindows(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = shared.uNight;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aLit;
varying float vSeed;
varying vec2 vCell;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vec3 ipW = vec3(0.0);
#ifdef USE_INSTANCING
ipW = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
#endif
vSeed = fract(aLit + fract(sin(dot(ipW.xz, vec2(12.9898, 78.233))) * 43758.5453));
vCell = uv;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uNight;
varying float vSeed;
varying vec2 vCell;`)
      .replace('#include <alphatest_fragment>', `vec2 fc = fract(vCell);
if (abs(fc.x - 0.5) > 0.24 || abs(fc.y - 0.55) > 0.3) discard;
#include <alphatest_fragment>`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float nk = smoothstep(0.0, 1.0, uNight);
vec2 cid = floor(vCell);
float hh = fract(sin(dot(cid + vSeed * 31.7, vec2(41.3, 289.1))) * 15731.743);
float vLit = hh;
${GLASS_DAY('0.9', false)}
float on = step(1.0 - nk * 0.62, hh);
totalEmissiveRadiance += on * mix(vec3(1.0, 0.76, 0.45), vec3(0.82, 0.9, 1.0), step(0.85, hh)) * (0.72 + 0.5 * smoothstep(0.3, 0.8, fc.y)) * (0.35 + 1.25 * nk);
diffuseColor.rgb *= 1.0 - 0.5 * nk;`);
  };
  mat.customProgramCacheKey = () => 'lodwin2';
}

function patchEmissive(mat, dayLevel) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = shared.uNight;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance *= ${dayLevel.toFixed(2)} + (1.0 - ${dayLevel.toFixed(2)}) * smoothstep(0.0, 1.0, uNight) * 1.6;`);
  };
  mat.customProgramCacheKey = () => 'emis' + dayLevel;
}

// Sondermaterialien (eigene Shader): Glas, Leuchtendes, Fernansichts-Fenster, Wasser. Alles andere sind Baustoffe.
export const isSpecialMaterial = (name) => { const o = (MATERIAL_DEFS[name] || [])[3] || {}; return !!(o.glass || o.emissive || o.lodWindows || o.water); };
export const MATERIAL_NAMES = Object.keys(MATERIAL_DEFS);
// Reihenfolge = Index in der Parameter-Tabelle und im Atlas (atlas.js: ATLAS_INDEX)
export const SURFACE_NAMES = MATERIAL_NAMES.filter((n) => !isSpecialMaterial(n));
export const SURFACE_INDEX = Object.fromEntries(SURFACE_NAMES.map((n, i) => [n, i]));
setTextureDefs(MATERIAL_DEFS);

let params = null;
// Parameter-Tabelle aller Baustoffe (für tex_shader.js / atlas.js)
export function surfaceParams() { if (!params) params = buildParamTexture(SURFACE_NAMES, MATERIAL_DEFS); return params; }
export function surfaceMaterial(index, attribute = false) {
  return makeSurfaceMaterial({ attribute, index, params: surfaceParams(), arrays: getSurfaceArrays() });
}

// Optionaler Ersatz durch eine eigene Fabrik (gibt null zurück → Standardweg)
let factory = null;
export function setMaterialFactory(fn) { factory = fn; cache.clear(); }

function specialMaterial(name) {
  const def = MATERIAL_DEFS[name];
  const [color, roughness, metalness, opts = {}] = def;
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  // Glas spiegelt den Himmel (scene.environment, G1) etwas kräftiger; Fassadenglas am stärksten
  if (opts.glass) { patchGlass(m, opts); m.envMapIntensity = opts.curtain ? 1.4 : opts.shop ? 1.0 : 1.2; }
  if (opts.water) m.envMapIntensity = 1.1;
  if (opts.emissive) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = 1; patchEmissive(m, opts.emissiveDay ?? 0.35); }
  if (opts.water) { m.transparent = true; m.opacity = 0.85; }
  if (opts.lodWindows) patchLodWindows(m);
  return m;
}

export function getMaterial(name) {
  if (cache.has(name)) return cache.get(name);
  let m = factory ? factory(name, MATERIAL_DEFS[name]) : null;
  if (!m) {
    if (!MATERIAL_DEFS[name]) {
      // Unbekannter Name: auffällig, aber nicht kaputt (Ersatz-Baustoff in Magenta)
      m = new THREE.MeshStandardMaterial({ color: 0xff00ff, roughness: 0.8 });
    } else if (isSpecialMaterial(name)) m = specialMaterial(name);
    else m = surfaceMaterial(SURFACE_INDEX[name]);
  }
  m.name = name;
  cache.set(name, m);
  return m;
}
