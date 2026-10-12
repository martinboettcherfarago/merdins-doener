// Atlas-Material für Gebäude: Alle undurchsichtigen Baustoffe in EINEM Material, damit ein Gebäude-Prototyp
// mit 1–4 Draw Calls auskommt. Jeder Vertex trägt das Attribut aMat (Index in ATLAS_INDEX).
// Besitzer: G2 (Materialien & Texturen). Diese Startfassung nutzt nur Farbe und Rauheit aus MATERIAL_DEFS
// (als kleine Datentextur). G2 ersetzt das Innere durch echte Texturen (z. B. Textur-Atlas mit weltbezogenen UVs),
// die Schnittstelle bleibt: ATLAS_INDEX, isAtlasMaterial(name), getAtlasMaterial().
import * as THREE from 'three';
import { MATERIAL_DEFS, MATERIAL_NAMES } from './matlib.js';
import { shared } from './materials.js';

const special = (n) => { const o = (MATERIAL_DEFS[n] || [])[3] || {}; return o.glass || o.emissive || o.lodWindows || o.water; };
export const ATLAS_NAMES = MATERIAL_NAMES.filter((n) => !special(n));
export const ATLAS_INDEX = Object.fromEntries(ATLAS_NAMES.map((n, i) => [n, i]));
export const isAtlasMaterial = (name) => ATLAS_INDEX[name] !== undefined;

let mat = null;
export function getAtlasMaterial() {
  if (mat) return mat;
  const n = ATLAS_NAMES.length;
  const data = new Uint8Array(n * 4);
  const c = new THREE.Color();
  ATLAS_NAMES.forEach((name, i) => {
    const [color, rough, metal] = MATERIAL_DEFS[name];
    c.setHex(color); // sRGB-Werte; Umrechnung im Shader
    data[i * 4] = Math.round(c.r * 255); data[i * 4 + 1] = Math.round(c.g * 255); data[i * 4 + 2] = Math.round(c.b * 255);
    data[i * 4 + 3] = Math.round((rough * 0.8 + metal * 0.2) * 255);
  });
  const tex = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.02 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uAtlasData = { value: tex };
    shader.uniforms.uSnow = shared.uSnow;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aMat;\nflat varying int vMat;\nvarying float vUpN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = int(aMat + 0.5);\nvUpN = normal.y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uAtlasData;\nuniform float uSnow;\nflat varying int vMat;\nvarying float vUpN;')
      .replace('#include <color_fragment>', `#include <color_fragment>
vec4 ad = texelFetch(uAtlasData, ivec2(vMat, 0), 0);
diffuseColor.rgb *= pow(ad.rgb, vec3(2.2));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.94, 0.97), uSnow * smoothstep(0.55, 0.85, vUpN));`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = ad.a;');
  };
  mat.customProgramCacheKey = () => 'atlasStub';
  return mat;
}
