// 3D-Vorschaubilder für Baukatalog und Inspektor.
// Ein Architektur-Modell (buildArch) wird auf eine kleine Diorama-Scholle gestellt, in ein WebGL-Rendertarget
// des laufenden Renderers gezeichnet (eigene Szene, eigenes Licht, immer Tag), tonwertkorrigiert ausgelesen und als
// Bild zwischengespeichert. Die Warteschlange arbeitet höchstens ein Modell pro Bild ab, damit nichts ruckelt.
// Zustand des Renderers (Ziel, Löschfarbe, Tonwert, Statistik) wird vollständig wiederhergestellt.
import * as THREE from 'three';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ARCH, buildArch } from '../render/arch/all.js';
import { getMaterial } from '../render/matlib.js';
import { shared } from '../render/materials.js';
import { Kit, M, FLOOR } from '../render/arch/kit.js';
import { mulberry32 } from '../util.js';

export const THUMB_W = 256, THUMB_H = 192;
const cache = new Map();      // Schlüssel → dataURL | '' (fehlgeschlagen)
const queue = [];             // { id, spec, prio }
const listeners = new Set();  // fn(id, url)
let ctx = null;
let busy = null;              // gerade im Aufbau (wartet auf compileAsync)

export const hasArch = (key) => !!ARCH[key];
export function thumbId(s) { if (s.id) return s.id; return `${s.key}|${s.level || 1}|${s.variant || 0}|${s.fw || 1}x${s.fd || 1}${s.extra ? '|' + JSON.stringify(s.extra) : ''}`; }

// Liefert die URL, falls vorhanden (sonst null) und stellt das Modell in die Warteschlange.
export function getThumb(spec, prio = 1) {
  if (!spec || (!spec.build && !ARCH[spec.key])) return null;
  const id = thumbId(spec);
  const c = cache.get(id);
  if (c !== undefined) return c || null;
  const q = queue.find((x) => x.id === id);
  if (q) q.prio = Math.max(q.prio, prio);
  else queue.push({ id, spec, prio });
  return null;
}
export const thumbFailed = (spec) => cache.get(thumbId(spec)) === '';
export function onThumb(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export const thumbsPending = () => queue.length + (busy ? 1 : 0);
export function clearThumbQueue() { queue.length = 0; }

function setup(renderer) {
  if (ctx && ctx.renderer === renderer) return ctx;
  disposeCtx();
  const rtA = new THREE.WebGLRenderTarget(THUMB_W, THUMB_H, { type: THREE.HalfFloatType, samples: 4 });
  const rtB = new THREE.WebGLRenderTarget(THUMB_W, THUMB_H);
  const out = new OutputPass();
  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0xeef4ff, 0x8c7b62, 1.35);
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.015;
  const fill = new THREE.DirectionalLight(0xcfe0ff, 0.45);
  scene.add(hemi, sun, sun.target, fill, fill.target);
  const cam = new THREE.PerspectiveCamera(22, THUMB_W / THUMB_H, 0.02, 400);
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_W; canvas.height = THUMB_H;
  ctx = { renderer, rtA, rtB, out, scene, sun, fill, cam, canvas, c2d: canvas.getContext('2d'), buf: new Uint8Array(THUMB_W * THUMB_H * 4) };
  return ctx;
}
function disposeCtx() {
  if (!ctx) return;
  ctx.disposed = true;
  ctx.rtA.dispose(); ctx.rtB.dispose(); ctx.out.dispose && ctx.out.dispose();
  ctx = null;
}

// Diorama-Scholle mit Gehweg und Straße an der Front (+z)
function plinth(fw, fd, plain = false) {
  const g = new THREE.Group();
  const m = 0.09, front = plain ? m : 0.4, th = 0.16;
  const w = fw + 2 * m, d = fd + m + front;
  const zc = (front - m) / 2;
  const dirt = getMaterial('dirt'), grass = getMaterial('grass');
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, th, d), [dirt, dirt, grass, dirt, dirt, dirt]);
  box.position.set(0, -th / 2 - 0.004, zc);
  box.receiveShadow = true;
  g.add(box);
  g.userData.dispose = () => g.traverse((o) => o.geometry && o.geometry.dispose());
  if (plain) return g;
  const walk = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, 0.11), getMaterial('sidewalk'));
  walk.position.set(0, 0.002, fd / 2 + 0.055);
  walk.receiveShadow = true;
  const road = new THREE.Mesh(new THREE.BoxGeometry(w, 0.006, front - 0.11), getMaterial('asphalt'));
  road.position.set(0, -0.001, fd / 2 + 0.11 + (front - 0.11) / 2);
  road.receiveShadow = true;
  g.add(walk, road);
  const dashes = Math.max(2, Math.round(w / 0.22));
  for (let k = 0; k < dashes; k++) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.003, 0.012), getMaterial('runway_marking'));
    dash.position.set(-w / 2 + (k + 0.5) * (w / dashes), 0.003, fd / 2 + 0.11 + (front - 0.11) / 2);
    g.add(dash);
  }
  g.userData.dispose = () => g.traverse((o) => o.geometry && o.geometry.dispose());
  return g;
}

// spec.build(kit, M, FLOOR) erlaubt eigene kleine Modelle (z. B. Straßenstücke) aus dem Baukasten.
function buildModel(spec) {
  let res;
  if (spec.build) { const kit = new Kit(mulberry32(97), 2); spec.build(kit, M, FLOOR); res = kit.build(); }
  else res = buildArch(spec.key, spec.level || 1, spec.variant || 0, spec.fw || 1, spec.fd || 1, spec.extra || {}, 2);
  if (!res || !res.meshes || !res.meshes.length) return null;
  const grp = new THREE.Group();
  const geos = [];
  const add = (geometry, mat) => {
    const material = typeof mat === 'string' ? getMaterial(mat) : mat || getMaterial('concrete');
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = !material.transparent;
    mesh.receiveShadow = true;
    grp.add(mesh);
    geos.push(geometry);
    return mesh;
  };
  for (const m of res.meshes) add(m.geometry, m.material);
  for (const a of res.anim || []) {
    if (!a || !a.geometry) continue;
    const mesh = add(a.geometry, a.material);
    if (a.pivot) mesh.position.set(a.pivot[0] || 0, a.pivot[1] || 0, a.pivot[2] || 0);
  }
  grp.userData.dispose = () => { for (const g of geos) g.dispose(); };
  return grp;
}

// Kamera so setzen, dass der Quader genau ins Bild passt (Blick von vorne rechts oben)
function frame(cam, box, yaw, pitch) {
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const f = dir.clone().negate();
  const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
  const u = new THREE.Vector3().crossVectors(r, f).normalize();
  const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), tanH = tanV * cam.aspect;
  const corners = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z));
  const c = box.getCenter(new THREE.Vector3());
  let D = 1;
  for (let it = 0; it < 3; it++) {
    D = 0;
    for (const p of corners) {
      const v = p.clone().sub(c);
      const x = v.dot(r), y = v.dot(u), z = v.dot(f);
      D = Math.max(D, Math.abs(x) / tanH - z, Math.abs(y) / tanV - z);
    }
    // Mittelpunkt im Bild ausgleichen
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of corners) {
      const v = p.clone().sub(c);
      const depth = D + v.dot(f);
      const sx = v.dot(r) / depth, sy = v.dot(u) / depth;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    c.addScaledVector(r, ((x0 + x1) / 2) * D).addScaledVector(u, ((y0 + y1) / 2) * D);
  }
  D *= 1.07;
  cam.position.copy(c).addScaledVector(dir, D);
  cam.near = Math.max(0.01, D * 0.05);
  cam.far = D * 4 + 50;
  cam.lookAt(c);
  cam.updateProjectionMatrix();
  return { center: c, radius: box.getSize(new THREE.Vector3()).length() / 2 };
}

function prepare(c, item, model) {
  const { scene, cam, sun, fill } = c;
  const spec = item.spec;
  const pl = plinth(spec.fw || 1, spec.fd || 1, !!spec.plain);
  scene.add(model, pl);
  const box = new THREE.Box3().setFromObject(model);
  box.union(new THREE.Box3().setFromObject(pl));
  const fr = frame(cam, box, spec.yaw ?? 0.62, spec.pitch ?? 0.5);
  const R = Math.max(1, fr.radius);
  sun.position.copy(fr.center).add(new THREE.Vector3(-0.55, 1.15, 0.75).normalize().multiplyScalar(R * 3));
  sun.target.position.copy(fr.center);
  const sc = sun.shadow.camera;
  sc.left = -R * 1.3; sc.right = R * 1.3; sc.top = R * 1.3; sc.bottom = -R * 1.3; sc.near = 0.1; sc.far = R * 7;
  sc.updateProjectionMatrix();
  fill.position.copy(fr.center).add(new THREE.Vector3(1, 0.5, -0.6).multiplyScalar(R * 3));
  fill.target.position.copy(fr.center);
  // Nebel und Umgebung wie in der Hauptszene, damit die Shader-Programme passen
  const main = c.mainScene;
  scene.environment = main ? main.environment : null;
  if (main && main.fog && main.fog.isFog) scene.fog = c.fog || (c.fog = new THREE.Fog(0xffffff, 1e4, 2e4));
  else if (main && main.fog && main.fog.isFogExp2) scene.fog = c.fogx || (c.fogx = new THREE.FogExp2(0xffffff, 0));
  else scene.fog = null;
  return pl;
}

function renderNow(c, item, model, pl) {
  const { renderer, scene, cam } = c;
  // Zustand sichern
  const st = {
    target: renderer.getRenderTarget(), clear: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(),
    tm: renderer.toneMapping, exp: renderer.toneMappingExposure, autoClear: renderer.autoClear,
    reset: renderer.info.autoReset, info: { ...renderer.info.render }, shadowNeeds: renderer.shadowMap.needsUpdate,
    night: shared.uNight.value, snow: shared.uSnow.value, wet: shared.uWet.value,
  };
  let ok = false;
  try {
    shared.uNight.value = 0; shared.uSnow.value = 0; shared.uWet.value = 0;
    renderer.info.autoReset = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setRenderTarget(c.rtA);
    renderer.clear();
    renderer.render(scene, cam);
    c.out.render(renderer, c.rtB, c.rtA);
    renderer.readRenderTargetPixels(c.rtB, 0, 0, THUMB_W, THUMB_H, c.buf);
    ok = true;
  } catch (e) {
    console.warn('Vorschaubild fehlgeschlagen', item.id, e);
  } finally {
    renderer.setRenderTarget(st.target);
    renderer.setClearColor(st.clear, st.alpha);
    renderer.toneMapping = st.tm; renderer.toneMappingExposure = st.exp; renderer.autoClear = st.autoClear;
    renderer.shadowMap.needsUpdate = st.shadowNeeds;
    renderer.info.autoReset = st.reset;
    Object.assign(renderer.info.render, st.info);
    shared.uNight.value = st.night; shared.uSnow.value = st.snow; shared.uWet.value = st.wet;
    scene.remove(model, pl);
    model.userData.dispose && model.userData.dispose();
    pl.userData.dispose && pl.userData.dispose();
  }
  if (!ok) return '';
  // Pixel umdrehen (WebGL zählt von unten) und Vormultiplikation an Kanten aufheben
  const img = c.c2d.createImageData(THUMB_W, THUMB_H);
  const src = c.buf, dst = img.data, row = THUMB_W * 4;
  for (let y = 0; y < THUMB_H; y++) {
    const so = (THUMB_H - 1 - y) * row, d0 = y * row;
    for (let x = 0; x < row; x += 4) {
      const a = src[so + x + 3];
      if (a > 0 && a < 255) {
        const k = 255 / a;
        dst[d0 + x] = Math.min(255, src[so + x] * k); dst[d0 + x + 1] = Math.min(255, src[so + x + 1] * k); dst[d0 + x + 2] = Math.min(255, src[so + x + 2] * k);
      } else { dst[d0 + x] = src[so + x]; dst[d0 + x + 1] = src[so + x + 1]; dst[d0 + x + 2] = src[so + x + 2]; }
      dst[d0 + x + 3] = a;
    }
  }
  c.c2d.clearRect(0, 0, THUMB_W, THUMB_H);
  c.c2d.putImageData(img, 0, 0);
  let url = c.canvas.toDataURL('image/webp', 0.9);
  if (!url.startsWith('data:image/webp')) url = c.canvas.toDataURL('image/png');
  return url;
}

function finish(item, url) {
  cache.set(item.id, url);
  for (const fn of listeners) { try { fn(item.id, url); } catch (e) { console.error(e); } }
}

// Pro Bild aufrufen. Baut höchstens ein Modell; wartet bei Bedarf auf die parallele Shader-Übersetzung.
export function pumpThumbs(engine) {
  if (!engine || !engine.renderer) return;
  if (busy) return;
  if (!queue.length) return;
  queue.sort((a, b) => b.prio - a.prio);
  const item = queue.shift();
  if (cache.has(item.id)) return;
  const c = setup(engine.renderer);
  c.mainScene = engine.scene;
  let model = null;
  try { model = buildModel(item.spec); } catch (e) { console.warn('Vorschau-Modell fehlgeschlagen', item.id, e); }
  if (!model) { finish(item, ''); return; }
  const pl = prepare(c, item, model);
  const ext = c.renderer.extensions;
  if (!c.renderer.compileAsync || !(ext && ext.has && ext.has('KHR_parallel_shader_compile'))) { finish(item, renderNow(c, item, model, pl)); return; }
  // Shader im Hintergrund übersetzen lassen (passend zum Rendertarget), dann zeichnen
  busy = item;
  const done = () => {
    busy = null;
    if (!ctx || ctx.renderer !== c.renderer || c.disposed) {
      c.scene.remove(model, pl); model.userData.dispose(); pl.userData.dispose();
      if (!cache.has(item.id)) queue.unshift(item);
      return;
    }
    finish(item, renderNow(c, item, model, pl));
  };
  let p = null;
  const prev = c.renderer.getRenderTarget();
  try { c.renderer.setRenderTarget(c.rtA); p = c.renderer.compileAsync(c.scene, c.cam); } catch (e) { p = null; } finally { c.renderer.setRenderTarget(prev); }
  if (p && p.then) p.then(done, done); else done();
}

export function disposeThumbs() { disposeCtx(); busy = null; }
