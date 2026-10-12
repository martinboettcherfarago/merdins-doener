// Galerie für Architektur-Bausteine: index.html?gallery=res&fp=1x1,2x1&night=0
// Zeigt alle Stufen (Zeilen) × Varianten (Spalten) eines Schlüssels – zum Prüfen per Screenshot.
import * as THREE from 'three';
import { ARCH, buildArch } from './arch/all.js';
import { getMaterial } from './matlib.js';
import { shared } from './materials.js';
import { BUILDINGS } from '../config.js';
import { VIEWS } from '../registry.js';
void VIEWS;

export function runGallery(params) {
  const filter = params.get('gallery') || 'res';
  const fps = (params.get('fp') || '1x1').split(',').map((s) => s.split('x').map(Number));
  const night = +(params.get('night') || 0);
  const levels = (params.get('levels') || '1,2,3,4,5').split(',').map(Number);
  const variants = +(params.get('variants') || 4);
  let keys;
  if (ARCH[filter]) keys = [filter];
  else if (filter.includes(',')) keys = filter.split(',');
  else keys = Object.keys(BUILDINGS).filter((k) => BUILDINGS[k].cat === filter && ARCH[k]);
  const stage = document.getElementById('stage');
  stage.innerHTML = '';
  const canvas = document.createElement('canvas');
  stage.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(night ? 0x141a33 : 0xbfd9ea);
  shared.uNight.value = night;
  scene.add(new THREE.HemisphereLight(night ? 0x7d8fc4 : 0xeaf3ff, 0x6b5a45, night ? 0.6 : 1.2));
  const sun = new THREE.DirectionalLight(night ? 0x9aaaff : 0xfff1dc, night ? 0.5 : 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  const items = [];
  const singleLevel = keys.length > 1;
  const detail = +(params.get('detail') ?? 2);
  for (const key of keys) fps.forEach((fp, fpi) => {
    const lv = singleLevel ? [1] : levels;
    lv.forEach((level, li) => { for (let v = 0; v < (singleLevel ? 1 : variants); v++) {
      const base = BUILDINGS[key] && BUILDINGS[key].size;
      const [fw, fd] = base ? base : fp;
      const res = buildArch(key, level, v, fw, fd, {}, detail);
      items.push({ key, level, v, fw, fd, res, fpi, li });
    } });
  });
  // Raster
  const cols = singleLevel ? Math.ceil(Math.sqrt(items.length * 1.6)) : variants * fps.length;
  let maxW = 1;
  for (const it of items) maxW = Math.max(maxW, it.fw, it.fd);
  const cell = maxW + 1.2;
  let tris = 0;
  items.forEach((it, i) => {
    const col = singleLevel ? i % cols : it.fpi * variants + it.v;
    const row = singleLevel ? Math.floor(i / cols) : it.li;
    const x = col * cell, z = row * cell;
    const pad = new THREE.Mesh(new THREE.BoxGeometry(it.fw + 0.4, 0.02, it.fd + 0.4), getMaterial('sidewalk'));
    pad.position.set(x, -0.01, z); pad.receiveShadow = true;
    scene.add(pad);
    const road = new THREE.Mesh(new THREE.BoxGeometry(it.fw + 0.4, 0.015, 0.5), getMaterial('asphalt'));
    road.position.set(x, -0.005, z + it.fd / 2 + 0.45); road.receiveShadow = true;
    scene.add(road);
    if (!it.res) return;
    tris += it.res.triangles || 0;
    for (const m of it.res.meshes) {
      const mesh = new THREE.Mesh(m.geometry, getMaterial(m.material));
      mesh.position.set(x, 0, z);
      mesh.castShadow = true; mesh.receiveShadow = true;
      scene.add(mesh);
    }
  });
  const rows = singleLevel ? Math.ceil(items.length / cols) : levels.length;
  const cx = ((cols - 1) * cell) / 2, cz = ((rows - 1) * cell) / 2;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(cols * cell + 20, rows * cell + 20), getMaterial('grass'));
  ground.rotation.x = -Math.PI / 2; ground.position.set(cx, -0.02, cz); ground.receiveShadow = true;
  scene.add(ground);
  const span = Math.max(cols, rows) * cell;
  const sc = sun.shadow.camera;
  sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 1; sc.far = span * 4;
  sun.position.set(cx - span * 0.6, span * 1.1, cz + span * 0.9);
  sun.target.position.set(cx, 0, cz);
  const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 1000);
  const zoom = +(params.get('zoom') || 1);
  const dist = span * 1.05 / zoom;
  const yaw = +(params.get('yaw') || 0.6), pitch = +(params.get('pitch') || 0.62);
  camera.position.set(cx + Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, cz + Math.cos(yaw) * Math.cos(pitch) * dist);
  camera.lookAt(cx, 0, cz);
  const info = document.createElement('div');
  info.style.cssText = 'position:fixed;left:10px;top:10px;font:13px sans-serif;background:#fff;padding:6px 10px;border-radius:6px';
  info.textContent = `${keys.join(', ')} · ${items.length} Modelle · ${Math.round(tris / Math.max(1, items.length))} Dreiecke/Modell`;
  document.body.appendChild(info);
  window.__gallery = { items: items.length, tris, missing: items.filter((i) => !i.res).length };
  const loop = () => { shared.uTime.value += 0.016; renderer.render(scene, camera); requestAnimationFrame(loop); };
  loop();
}
