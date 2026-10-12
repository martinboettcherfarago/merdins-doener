// Wasser (Besitzer G7): Oberfläche mit Wellen-Normalen, Tiefenfarbe, Strömung in Flüssen, Uferschaum,
// Himmelsspiegelung (Fresnel; nutzt scene.environment, falls vorhanden), Regenringe, Eis im Winter.
// Dazu die Wasserschnitte an den Rändern der Erdscholle und Wasserfälle, wo Flüsse die Scholle verlassen.
// Wird von TerrainView erzeugt; Daten (Höhenfeld) kommen aus terrain.js.
import * as THREE from 'three';
import { T } from '../config.js';
import { clamp, mulberry32 } from '../util.js';
import { shared } from './materials.js';
import { tileNoiseFn } from './terrain.js';

export const WATER_LEVEL = -0.14;

const GLSL = /* glsl */`
vec3 g7lin(vec3 c) { return pow(c, vec3(2.2)); }
float g7h(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
`;

let WAVE = null;
function waveTexture() {
  if (WAVE) return WAVE;
  const tn = tileNoiseFn(4711);
  const S = 256;
  const hgt = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    let h = tn.fbm(u, v, 6, 4, 0.55) * 0.9;
    h += Math.sin(Math.PI * 2 * (3 * u + 2 * v + tn.fbm(u, v, 4, 2) * 0.6)) * 0.12;
    h += Math.sin(Math.PI * 2 * (-2 * u + 5 * v + tn.fbm(u + 0.3, v, 4, 2) * 0.6)) * 0.07;
    hgt[y * S + x] = h;
  }
  const d = new Uint8Array(S * S * 4);
  const k = 7.0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const hx = hgt[y * S + ((x + 1) % S)] - hgt[y * S + ((x + S - 1) % S)];
    const hz = hgt[((y + 1) % S) * S + x] - hgt[((y + S - 1) % S) * S + x];
    let nx = -hx * k, nz = -hz * k, ny = 1;
    const l = Math.hypot(nx, ny, nz);
    nx /= l; ny /= l; nz /= l;
    const i = (y * S + x) * 4;
    d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (nz * 0.5 + 0.5) * 255; d[i + 2] = (ny * 0.5 + 0.5) * 255; d[i + 3] = clamp(hgt[y * S + x], 0, 1) * 255;
  }
  const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  WAVE = t;
  return t;
}

// Strömungsfeld pro Feld: schmale Wasserläufe fließen von der Quelle (Rand oder fern vom See) weg.
function flowField(g) {
  const W = g.W, H = g.H, N = g.N, ter = g.world.terrain, type = g.world.type;
  const fx = new Float32Array(N), fz = new Float32Array(N);
  if (!(type === 'river' || type === 'mountains' || type === 'coast')) return { fx, fz };
  const wd = new Int16Array(N).fill(-1);
  const q = [];
  for (let i = 0; i < N; i++) if (ter[i] !== T.WATER) { wd[i] = 0; q.push(i); }
  const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % W, y = (i / W) | 0;
    for (const [ox, oy] of nb) {
      const nx = x + ox, ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (wd[j] < 0) { wd[j] = wd[i] + 1; q.push(j); }
    }
  }
  // lokale Breite: größter Uferabstand in der Umgebung
  const R = 4;
  const narrow = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (ter[i] !== T.WATER) continue;
    let m = 0;
    for (let oy = -R; oy <= R; oy++) for (let ox = -R; ox <= R; ox++) {
      const xx = x + ox, yy = y + oy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) { m = Math.max(m, wd[i]); continue; }
      m = Math.max(m, wd[yy * W + xx]);
    }
    if (m <= 3) narrow[i] = 1;
  }
  // Komponenten schmaler Läufe, Quelle wählen, geodätische Entfernung
  const comp = new Int32Array(N).fill(-1);
  const dist = new Int32Array(N).fill(-1);
  let cid = 0;
  for (let s = 0; s < N; s++) {
    if (!narrow[s] || comp[s] >= 0) continue;
    const tiles = [s];
    comp[s] = cid;
    for (let h = 0; h < tiles.length; h++) {
      const i = tiles[h], x = i % W, y = (i / W) | 0;
      for (const [ox, oy] of nb) {
        const nx = x + ox, ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (narrow[j] && comp[j] < 0) { comp[j] = cid; tiles.push(j); }
      }
    }
    // Quelle: Randfeld im Norden/Westen, sonst das Feld, das am weitesten vom offenen Wasser entfernt ist
    let src = -1;
    for (const i of tiles) {
      const x = i % W, y = (i / W) | 0;
      if (y === 0 || x === 0) { if (src < 0 || i < src) src = i; }
    }
    if (src < 0) {
      // Abstand zu breitem Wasser (Mündung)
      const md = new Int32Array(N).fill(-1);
      const qq = [];
      for (const i of tiles) {
        const x = i % W, y = (i / W) | 0;
        for (const [ox, oy] of nb) {
          const nx = x + ox, ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (ter[j] === T.WATER && !narrow[j]) { md[i] = 0; qq.push(i); break; }
        }
      }
      if (!qq.length) { qq.push(tiles[0]); md[tiles[0]] = 0; }
      for (let h = 0; h < qq.length; h++) {
        const i = qq[h], x = i % W, y = (i / W) | 0;
        for (const [ox, oy] of nb) {
          const nx = x + ox, ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (comp[j] === cid && md[j] < 0) { md[j] = md[i] + 1; qq.push(j); }
        }
      }
      let best = -1;
      for (const i of tiles) if (md[i] > best) { best = md[i]; src = i; }
    }
    dist[src] = 0;
    const qq = [src];
    for (let h = 0; h < qq.length; h++) {
      const i = qq[h], x = i % W, y = (i / W) | 0;
      for (const [ox, oy] of nb) {
        const nx = x + ox, ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (comp[j] === cid && dist[j] < 0) { dist[j] = dist[i] + 1; qq.push(j); }
      }
    }
    cid++;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (dist[i] < 0) continue;
    let gx = 0, gz = 0;
    for (const [ox, oy] of nb) {
      const nx = x + ox, ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) { gx += ox; gz += oy; continue; }
      const j = ny * W + nx;
      if (dist[j] < 0) continue;
      const dd = dist[j] - dist[i];
      gx += ox * dd; gz += oy * dd;
    }
    const l = Math.hypot(gx, gz);
    if (l > 0) { fx[i] = gx / l; fz[i] = gz / l; }
  }
  // glätten
  for (let pass = 0; pass < 3; pass++) {
    const ax = fx.slice(), az = fz.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (ter[i] !== T.WATER) continue;
      let sx = ax[i] * 2, sz = az[i] * 2, c = 2;
      for (const [ox, oy] of nb) {
        const nx = x + ox, ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (ter[j] !== T.WATER) continue;
        sx += ax[j]; sz += az[j]; c++;
      }
      fx[i] = sx / c; fz[i] = sz / c;
    }
  }
  return { fx, fz };
}

const SURF_PARS = /* glsl */`
uniform sampler2D tWave;
uniform sampler2D tNoise;
uniform float uTime;
uniform vec3 uSkyTop;
uniform vec3 uSkyHor;
uniform float uOwnRefl;
uniform float uIce;
uniform float uRain;
uniform float uSnowK;
varying float vDepth;
varying vec2 vFlow;
varying vec3 vWP;
float g7Foam = 0.0;
float g7IceA = 0.0;
vec3 g7N = vec3(0.0, 1.0, 0.0);
${GLSL}
`;

const SURF_COLOR = /* glsl */`
{
  float d = vDepth;
  float dd = max(d, 0.0);
  vec2 p = vWP.xz;
  float fl = length(vFlow);
  float ph = fract(uTime * 0.16);
  vec2 fo0 = vFlow * ph * 2.6;
  vec2 fo1 = vFlow * fract(ph + 0.5) * 2.6;
  float fw = abs(ph * 2.0 - 1.0);
  vec3 nF0 = texture2D(tWave, p * 0.52 - fo0).xyz * 2.0 - 1.0;
  vec3 nF1 = texture2D(tWave, p * 0.52 - fo1 + 0.5).xyz * 2.0 - 1.0;
  vec2 sFlow = mix(nF0.xy, nF1.xy, fw);
  vec3 nA = texture2D(tWave, p * 0.29 + vec2(uTime * 0.016, uTime * 0.011)).xyz * 2.0 - 1.0;
  vec3 nB = texture2D(tWave, p * 0.71 + vec2(-uTime * 0.024, uTime * 0.019)).xyz * 2.0 - 1.0;
  vec3 nC = texture2D(tWave, p * 1.9 + vec2(uTime * 0.05, -uTime * 0.04)).xyz * 2.0 - 1.0;
  vec2 sl = (nA.xy * 0.55 + nB.xy * 0.45) + nC.xy * 0.25;
  sl = mix(sl, sFlow * 1.2 + nC.xy * 0.2, smoothstep(0.05, 0.3, fl));
  // Regenringe
  if (uRain > 0.01) {
    vec2 rp = p * 9.0;
    vec2 rid = floor(rp);
    vec2 rf = fract(rp) - 0.5;
    float rt = fract(uTime * 0.9 + g7h(rid) * 7.0);
    float rr = length(rf) - rt * 0.45;
    float ring = (1.0 - smoothstep(0.0, 0.06, abs(rr))) * (1.0 - rt) * step(g7h(rid + 2.3), uRain * 0.8);
    sl += normalize(rf + 1e-4) * ring * 1.6;
  }
  float px = length(fwidth(p));
  sl *= 1.0 / (1.0 + px * 5.0);
  // Eis auf stehendem Wasser
  vec4 nz = texture2D(tNoise, p * 0.8 + vec2(uTime * 0.02, 0.0));
  g7IceA = uIce * (1.0 - smoothstep(0.05, 0.3, fl)) * smoothstep(0.0, 0.03, dd);
  g7IceA = clamp(g7IceA * (1.0 + (nz.r - 0.5) * 0.6) * smoothstep(0.0, 0.25, uIce * 1.6 - dd * 0.2), 0.0, 1.0);
  sl *= 1.0 - g7IceA * 0.92;
  g7N = normalize(vec3(sl.x * 0.55, 1.0, sl.y * 0.55));

  vec3 cShallow = g7lin(vec3(0.40, 0.73, 0.69));
  vec3 cMid = g7lin(vec3(0.15, 0.49, 0.58));
  vec3 cDeep = g7lin(vec3(0.05, 0.23, 0.36));
  vec3 wc = mix(cShallow, cMid, smoothstep(0.0, 0.3, dd));
  wc = mix(wc, cDeep, smoothstep(0.28, 1.5, dd));
  float alpha = mix(0.16, 0.94, smoothstep(0.0, 0.62, dd));
  // Uferschaum (Wellen laufen auf das Ufer zu) und Strömungsschaum
  float shore = 1.0 - smoothstep(0.0, 0.05 + nz.g * 0.07, dd);
  float band = 0.5 + 0.5 * sin(dd * 80.0 - uTime * 2.0 + nz.b * 6.0);
  float foam = shore * smoothstep(0.35, 0.85, band * 0.55 + nz.r * 0.55);
  foam = max(foam, (1.0 - smoothstep(0.0, 0.022, dd)) * 0.85);
  float streak = smoothstep(0.7, 0.92, texture2D(tNoise, (p - fo0 * 0.6) * vec2(0.9, 0.9)).g);
  foam += streak * smoothstep(0.25, 0.8, fl) * 0.35 * (1.0 - shore);
  foam *= 1.0 / (1.0 + px * 3.0);
  foam = clamp(foam * (1.0 - g7IceA), 0.0, 1.0);
  g7Foam = foam;
  vec3 iceC = mix(g7lin(vec3(0.78, 0.86, 0.9)), g7lin(vec3(0.93, 0.95, 0.97)), smoothstep(0.4, 0.8, nz.g) * 0.6 + uSnowK * 0.6);
  float crack = 1.0 - smoothstep(0.0, 0.05, texture2D(tNoise, p * 0.35).a);
  iceC *= 1.0 - crack * 0.25;
  vec3 col = mix(wc, g7lin(vec3(0.94, 0.97, 0.97)), foam);
  col = mix(col, iceC, g7IceA);
  diffuseColor.rgb = col;
  diffuseColor.a = clamp(max(max(alpha, foam * 0.92), g7IceA * 0.96), 0.0, 1.0) * smoothstep(-0.004, 0.006, d);
}
`;

const SURF_REFL = /* glsl */`
{
  vec3 vW = normalize(cameraPosition - vWP);
  float ndv = clamp(dot(g7N, vW), 0.0, 1.0);
  vec3 rW = reflect(-vW, g7N);
  float fres = 0.05 + 0.75 * pow(1.0 - ndv, 3.0);
  vec3 sky = mix(uSkyHor, uSkyTop, smoothstep(0.0, 0.55, rW.y));
  float k = fres * uOwnRefl * (1.0 - g7Foam) * (1.0 - g7IceA * 0.8);
  outgoingLight = mix(outgoingLight, sky, k);
  diffuseColor.a = max(diffuseColor.a, k * 0.85 * step(0.004, vDepth));
}
`;

export class WaterView {
  constructor(tv) {
    this.tv = tv;
    this.e = tv.e;
    this.g = tv.g;
    this.group = tv.group;
    const wave = waveTexture();
    this.uniforms = {
      tWave: { value: wave }, tNoise: { value: tv.tex.noise }, uTime: shared.uTime,
      uSkyTop: { value: new THREE.Color(0x86c3ea) }, uSkyHor: { value: new THREE.Color(0xe8f1ec) },
      uOwnRefl: { value: 1 }, uIce: { value: 0 }, uRain: { value: 0 }, uSnowK: tv.uniforms.uSnowK,
    };
    this.buildSurface();
    this.buildEdges();
    this.buildFalls();
  }

  buildSurface() {
    const g = this.g, F = this.tv.field, S = F.S, GW = F.GW, GH = F.GH;
    const ox = -g.W / 2, oz = -g.H / 2;
    const WL = WATER_LEVEL;
    const flow = flowField(g);
    const used = new Int32Array(F.GN).fill(-1);
    const pos = [], dep = [], flw = [], idx = [];
    let nv = 0;
    const vert = (gx, gy) => {
      const k = gy * GW + gx;
      if (used[k] >= 0) return used[k];
      used[k] = nv++;
      pos.push(gx / S + ox, WL, gy / S + oz);
      dep.push(WL - F.h[k]);
      // Strömung bilinear aus dem Feldraster
      const tx = clamp(gx / S - 0.5, 0, g.W - 1), ty = clamp(gy / S - 0.5, 0, g.H - 1);
      const x0 = Math.floor(tx), y0 = Math.floor(ty), x1 = Math.min(g.W - 1, x0 + 1), y1 = Math.min(g.H - 1, y0 + 1);
      const fx = tx - x0, fy = ty - y0;
      const s = (a, i00, i10, i01, i11) => a[i00] * (1 - fx) * (1 - fy) + a[i10] * fx * (1 - fy) + a[i01] * (1 - fx) * fy + a[i11] * fx * fy;
      const i00 = y0 * g.W + x0, i10 = y0 * g.W + x1, i01 = y1 * g.W + x0, i11 = y1 * g.W + x1;
      flw.push(s(flow.fx, i00, i10, i01, i11) * 0.45, s(flow.fz, i00, i10, i01, i11) * 0.45);
      return used[k];
    };
    for (let gy = 0; gy < GH - 1; gy++) for (let gx = 0; gx < GW - 1; gx++) {
      const k = gy * GW + gx;
      const m = Math.min(F.h[k], F.h[k + 1], F.h[k + GW], F.h[k + GW + 1]);
      if (m >= WL - 0.002) continue;
      const a = vert(gx, gy), b = vert(gx + 1, gy), c = vert(gx, gy + 1), d = vert(gx + 1, gy + 1);
      idx.push(a, c, d, a, d, b);
    }
    this.hasWater = idx.length > 0;
    if (!this.hasWater) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(nv * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    geo.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1));
    geo.setAttribute('aFlow', new THREE.Float32BufferAttribute(flw, 2));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.07, metalness: 0, transparent: true, depthWrite: false });
    const u = this.uniforms;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
uniform float uTime;
attribute float aDepth;
attribute vec2 aFlow;
varying float vDepth;
varying vec2 vFlow;
varying vec3 vWP;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vDepth = aDepth;
vFlow = aFlow;
vec3 g7wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
transformed.y += sin(g7wp.x * 2.1 + uTime * 1.3) * cos(g7wp.z * 1.7 + uTime * 1.1) * 0.008 * smoothstep(0.08, 0.4, aDepth);
vWP = g7wp;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${SURF_PARS}`)
        .replace('#include <color_fragment>', `#include <color_fragment>\n${SURF_COLOR}`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(mix(0.06, 0.75, g7Foam), 0.3, g7IceA);')
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize((viewMatrix * vec4(g7N, 0.0)).xyz);')
        .replace('#include <opaque_fragment>', `${SURF_REFL}\n#include <opaque_fragment>`);
    };
    mat.customProgramCacheKey = () => 'g7water';
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;
    mesh.name = 'Wasser';
    this.group.add(mesh);
    this.mesh = mesh;
    this.mat = mat;
  }

  // Wasserschnitte an den Kanten der Scholle („Aquarium").
  buildEdges() {
    const g = this.g, F = this.tv.field, S = F.S, GW = F.GW, GH = F.GH;
    const ox = -g.W / 2, oz = -g.H / 2;
    const WL = WATER_LEVEL;
    const pos = [], nor = [], dep = [];
    const quad = (ax, az, ha, bx, bz, hb, nx, nz) => {
      if (ha >= WL && hb >= WL) return;
      const ta = Math.min(ha, WL), tb = Math.min(hb, WL);
      const v = [[ax, WL, az, 0], [bx, WL, bz, 0], [bx, tb, bz, WL - tb], [ax, ta, az, WL - ta]];
      const ord = (nz < 0 || nx > 0) ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
      for (const k of ord) { pos.push(v[k][0], v[k][1], v[k][2]); nor.push(nx, 0, nz); dep.push(v[k][3]); }
    };
    const inv = 1 / S;
    for (let gx = 0; gx < GW - 1; gx++) {
      quad(gx * inv + ox, oz, F.h[gx], (gx + 1) * inv + ox, oz, F.h[gx + 1], 0, -1);
      const r = (GH - 1) * GW;
      quad(gx * inv + ox, -oz, F.h[r + gx], (gx + 1) * inv + ox, -oz, F.h[r + gx + 1], 0, 1);
    }
    for (let gy = 0; gy < GH - 1; gy++) {
      quad(ox, gy * inv + oz, F.h[gy * GW], ox, (gy + 1) * inv + oz, F.h[(gy + 1) * GW], -1, 0);
      quad(-ox, gy * inv + oz, F.h[gy * GW + GW - 1], -ox, (gy + 1) * inv + oz, F.h[(gy + 1) * GW + GW - 1], 1, 0);
    }
    if (!pos.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('aDep', new THREE.Float32BufferAttribute(dep, 1));
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0, transparent: true, depthWrite: false });
    const u = this.uniforms;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aDep;\nvarying float vDep;\nvarying vec3 vWP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDep = aDep;\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\nuniform sampler2D tNoise;\nuniform float uTime;\nvarying float vDep;\nvarying vec3 vWP;\n${GLSL}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
{
  float y = ${WATER_LEVEL.toFixed(3)} - vWP.y;
  float hx = vWP.x + vWP.z;
  vec3 c = mix(g7lin(vec3(0.36, 0.7, 0.72)), g7lin(vec3(0.06, 0.25, 0.38)), smoothstep(0.0, 1.4, y));
  float ray = texture2D(tNoise, vec2(hx * 0.12 + uTime * 0.01, y * 0.08)).g;
  c *= 0.85 + 0.35 * ray * (1.0 - smoothstep(0.0, 1.2, y));
  float surf = 1.0 - smoothstep(0.0, 0.025, y);
  c = mix(c, g7lin(vec3(0.9, 0.97, 0.98)), surf * 0.8);
  diffuseColor.rgb = c;
  diffuseColor.a = mix(0.62, 0.9, smoothstep(0.0, 1.0, y));
}`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.25;');
    };
    mat.customProgramCacheKey = () => 'g7wateredge';
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 1;
    m.name = 'Wasserschnitt';
    this.group.add(m);
    this.edges = m;
  }

  // Wasserfälle: schmale Flüsse stürzen über die Kante der Scholle ins Umland.
  buildFalls() {
    const tv = this.tv, g = this.g;
    const exits = tv.edgeRivers();
    if (!exits.length) return;
    const WL = WATER_LEVEL;
    const drop = WL - tv.outerY;
    const pos = [], uvs = [], nor = [];
    const idx = [];
    const mist = [];
    const SEG = 28;
    for (const e of exits) {
      const w = Math.max(0.6, e.n * 0.92);
      const ax = e.dx !== 0 ? 0 : 1, az = e.dx !== 0 ? 1 : 0; // Richtung entlang der Kante
      const base = pos.length / 3;
      const cols = Math.max(3, Math.ceil(w * 3));
      for (let s = 0; s <= SEG; s++) {
        const t = s / SEG;
        const tt = t * t;
        const y = WL + 0.01 - drop * tt;
        const out = -0.03 + 0.55 * Math.sqrt(tt * drop) * 0.42 + tt * 0.6;
        const spread = 1 + tt * 0.35;
        for (let c = 0; c <= cols; c++) {
          const v = (c / cols - 0.5) * w * spread;
          pos.push(e.x + e.dx * out + ax * v, y, e.z + e.dz * out + az * v);
          nor.push(e.dx, 0.3, e.dz);
          uvs.push(c / cols, t);
        }
      }
      for (let s = 0; s < SEG; s++) for (let c = 0; c < cols; c++) {
        const a = base + s * (cols + 1) + c, b = a + 1, cc = a + cols + 1, d = cc + 1;
        idx.push(a, cc, d, a, d, b);
      }
      const r = mulberry32((e.c * 97 + e.n) | 0);
      const bottomOut = -0.03 + 0.55 * Math.sqrt(drop) * 0.42 + 0.6;
      for (let k = 0; k < 26; k++) {
        const v = (r() - 0.5) * w * 1.5;
        mist.push(e.x + e.dx * (bottomOut + r() * 1.5) + ax * v, tv.outerY + 0.2 + r() * 1.2, e.z + e.dz * (bottomOut + r() * 1.5) + az * v, r(), 1.6 + r() * 2.4);
      }
      for (let k = 0; k < 8; k++) {
        const v = (r() - 0.5) * w;
        mist.push(e.x + e.dx * (0.15 + r() * 0.3) + ax * v, WL - 0.1 - r() * 0.6, e.z + e.dz * (0.15 + r() * 0.3) + az * v, r(), 0.35 + r() * 0.4);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const u = this.uniforms;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vFu;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFu = uv;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\nuniform sampler2D tNoise;\nuniform float uTime;\nuniform float uIce;\nvarying vec2 vFu;\n${GLSL}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
{
  float sp = 1.2 + vFu.y * 2.0;
  vec2 q = vec2(vFu.x * 3.0, vFu.y * 9.0 - uTime * sp);
  float s1 = texture2D(tNoise, q * vec2(1.0, 0.25)).g;
  float s2 = texture2D(tNoise, q * vec2(2.3, 0.5) + 0.37).r;
  float streak = smoothstep(0.35, 0.8, s1 * 0.6 + s2 * 0.6);
  float edge = smoothstep(0.0, 0.18, vFu.x) * smoothstep(1.0, 0.82, vFu.x);
  float fade = 1.0 - smoothstep(0.72, 1.0, vFu.y);
  vec3 c = mix(g7lin(vec3(0.55, 0.78, 0.82)), g7lin(vec3(0.96, 0.98, 0.98)), streak * 0.8 + vFu.y * 0.3);
  diffuseColor.rgb = c;
  diffuseColor.a = clamp((0.45 + streak * 0.55) * edge * fade * (1.0 - uIce * 0.5), 0.0, 1.0);
}`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.18;');
    };
    mat.customProgramCacheKey = () => 'g7falls';
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 2;
    m.name = 'Wasserfälle';
    this.group.add(m);
    this.falls = m;
    // Gischt (Punktwolke, ein Draw Call)
    const mg = new THREE.BufferGeometry();
    const mp = [], ms = [];
    for (let k = 0; k < mist.length; k += 5) { mp.push(mist[k], mist[k + 1], mist[k + 2]); ms.push(mist[k + 3], mist[k + 4]); }
    mg.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3));
    mg.setAttribute('aMist', new THREE.Float32BufferAttribute(ms, 2));
    this.mistMat = new THREE.ShaderMaterial({
      uniforms: { uTime: shared.uTime, uScale: { value: 400 }, uCol: { value: new THREE.Color(0xf2f6f7) }, uNight: shared.uNight },
      vertexShader: `
uniform float uTime; uniform float uScale;
attribute vec2 aMist;
varying float vA;
void main() {
  float t = fract(uTime * 0.12 + aMist.x);
  vec3 p = position + vec3(0.0, t * aMist.y * 0.5, 0.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = aMist.y * (0.6 + t * 0.8) * uScale / max(0.1, -mv.z);
  vA = sin(t * 3.14159) * 0.5;
  gl_Position = projectionMatrix * mv;
}`,
      fragmentShader: `
uniform vec3 uCol; uniform float uNight;
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.0, length(c)) * vA;
  gl_FragColor = vec4(uCol * (1.0 - uNight * 0.75), a);
  if (a < 0.01) discard;
}`,
      transparent: true, depthWrite: false,
    });
    const pts = new THREE.Points(mg, this.mistMat);
    pts.frustumCulled = false;
    pts.renderOrder = 3;
    pts.name = 'Gischt';
    this.group.add(pts);
    this.mist = pts;
  }

  frame(dt, time, night, s) {
    const e = this.e, u = this.uniforms;
    if (e.skyTop) u.uSkyTop.value.copy(e.skyTop);
    if (e.skyHor) u.uSkyHor.value.copy(e.skyHor);
    else if (e.scene.fog) u.uSkyHor.value.copy(e.scene.fog.color);
    u.uOwnRefl.value = e.scene.environment ? 0.35 : 1;
    u.uRain.value = s.wet;
    // Eis bei Frost (oder tiefem Winter, falls keine Temperatur bekannt ist)
    let ice = 0;
    if (s.temp !== null) ice = clamp((-s.temp - 1) / 6, 0, 1);
    else ice = s.snow > 0.6 ? (s.snow - 0.6) * 1.5 : 0;
    u.uIce.value += (ice - u.uIce.value) * Math.min(1, dt * 0.5);
    if (this.mistMat) this.mistMat.uniforms.uScale.value = (e.renderer.domElement.clientHeight || 720) * 0.9;
  }
}
