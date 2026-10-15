// Galerie für Architektur-Bausteine: index.html?gallery=res&fp=1x1,2x1&night=0 (Menschen: index.html?gallery=people, siehe gallery_people.js)
// Zeigt alle Stufen (Zeilen) × Varianten (Spalten) eines Schlüssels – zum Prüfen per Screenshot.
// Weitere Parameter: levels=1,2  variants=4  v0=0  detail=0|1|2  zoom=1.5  yaw  pitch  ty=<Blickhöhe>  t=<Animationszeit>
// Animierte Teile (res.anim) drehen mit, Glas/Metall spiegeln eine Himmels-Umgebungskarte (wie im Spiel).
import * as THREE from 'three';
import { ARCH, buildArch } from './arch/all.js';
import { getMaterial } from './matlib.js';
import { shared } from './materials.js';
import { BUILDINGS } from '../config.js';
import { VIEWS } from '../registry.js';
import { peopleGallery } from './gallery_people.js';
void VIEWS;

export function runGallery(params) {
  const filter = params.get('gallery') || 'res';
  const fps = (params.get('fp') || '1x1').split(',').map((s) => s.split('x').map(Number));
  const night = +(params.get('night') || 0);
  const levels = (params.get('levels') || '1,2,3,4,5').split(',').map(Number);
  const variants = +(params.get('variants') || 4);
  const v0 = +(params.get('v0') || 0); // erste gezeigte Variante (z. B. v0=6 für die neueren Modelle)
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
  renderer.toneMapping = THREE.CustomToneMapping; // „Neutral“ wie im Spiel (materials.js)
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(night ? 0x141a33 : 0xbfd9ea);
  scene.environment = skyEnvironment(renderer, night);
  shared.uNight.value = night;
  scene.add(new THREE.HemisphereLight(night ? 0x7d8fc4 : 0xeaf3ff, 0x6b5a45, night ? 0.6 : 1.2));
  const sun = new THREE.DirectionalLight(night ? 0x9aaaff : 0xfff1dc, night ? 0.5 : 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  if (filter === 'people') { peopleGallery(params, renderer, scene, sun); return; }
  const items = [];
  const spinners = [];
  const singleLevel = keys.length > 1;
  const detail = +(params.get('detail') ?? 2);
  let buildMs = 0;
  for (const key of keys) fps.forEach((fp, fpi) => {
    const lv = singleLevel ? [1] : levels;
    lv.forEach((level, li) => { for (let v = v0; v < v0 + (singleLevel ? 1 : variants); v++) {
      const base = BUILDINGS[key] && BUILDINGS[key].size;
      const [fw, fd] = base ? base : fp;
      const tb = performance.now();
      const res = buildArch(key, level, v, fw, fd, {}, detail);
      const ms = performance.now() - tb;
      buildMs += ms;
      items.push({ key, level, v, fw, fd, res, fpi, li, ms });
    } });
  });
  // Raster
  const cols = singleLevel ? Math.ceil(Math.sqrt(items.length * 1.6)) : variants * fps.length;
  let maxW = 1;
  for (const it of items) maxW = Math.max(maxW, it.fw, it.fd);
  const cell = maxW + 1.2;
  let tris = 0;
  items.forEach((it, i) => {
    const col = singleLevel ? i % cols : it.fpi * variants + it.v - v0;
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
    // Animierte Teile (Vertrag 6.2, Lesart wie protos.js): Geometrie relativ zum Drehpunkt (local, Standard)
    // oder schon in Modellkoordinaten; Baustoff-Name oder eigenes THREE.Material; swing = Pendeln statt Drehen.
    for (const a of it.res.anim || []) {
      if (!a || !a.geometry || !a.geometry.attributes || !a.geometry.attributes.position) continue;
      if (a.nightOnly && !night) continue;
      const pv = new THREE.Vector3().fromArray(a.pivot || [0, 0, 0]);
      let geo = a.geometry;
      if (!geo.boundingBox) geo.computeBoundingBox();
      const c = geo.boundingBox.getCenter(new THREE.Vector3());
      const local = a.local ?? !(pv.lengthSq() > 1e-6 && c.distanceTo(pv) < 0.5 * c.length());
      if (!local) { geo = geo.clone(); geo.translate(-pv.x, -pv.y, -pv.z); }
      const mat = a.material && a.material.isMaterial ? a.material : getMaterial(a.material || 'metal_light');
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x + pv.x, pv.y, z + pv.z);
      mesh.castShadow = !mat.transparent; mesh.receiveShadow = true;
      mesh.userData.spin = { axis: a.axis || 'y', speed: a.speed ?? 1, phase: a.phase || 0, swing: a.swing || 0 };
      scene.add(mesh);
      spinners.push(mesh);
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
  const ty = +(params.get('ty') || 0);
  camera.position.set(cx + Math.sin(yaw) * Math.cos(pitch) * dist, ty + Math.sin(pitch) * dist, cz + Math.cos(yaw) * Math.cos(pitch) * dist);
  camera.lookAt(cx, ty, cz);
  const info = document.createElement('div');
  info.style.cssText = 'position:fixed;left:10px;top:10px;font:13px sans-serif;background:#fff;padding:6px 10px;border-radius:6px';
  info.textContent = `${keys.join(', ')} · ${items.length} Modelle · ${Math.round(tris / Math.max(1, items.length))} Dreiecke/Modell`;
  document.body.appendChild(info);
  window.__gallery = { items: items.length, tris, missing: items.filter((i) => !i.res).length, anim: spinners.length,
    buildMs: Math.round(buildMs), slowest: items.filter((i) => i.ms > 60).sort((a, b) => b.ms - a.ms).slice(0, 5).map((i) => `${i.key}:${i.level}/${i.v} ${Math.round(i.ms)} ms`) };
  const t0 = +(params.get('t') || 0);
  const loop = () => {
    shared.uTime.value += 0.016;
    const t = t0 + shared.uTime.value;
    for (const m of spinners) {
      const sp = m.userData.spin;
      m.rotation[sp.axis] = sp.swing > 0 ? Math.sin(t * sp.speed + sp.phase) * sp.swing : t * sp.speed + sp.phase;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  loop();
}

// Umgebungskarte aus einem einfachen Himmelsverlauf (tags hell, nachts dunkel) – Glas und Metall wirken sonst schwarz
function skyEnvironment(renderer, night) {
  const sky = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      uZen: { value: new THREE.Color(night ? 0x0b1024 : 0x4f86c6) },
      uHor: { value: new THREE.Color(night ? 0x1d2440 : 0xd8e6f0) },
      uGround: { value: new THREE.Color(night ? 0x0a0b10 : 0x6a6458) },
      uSun: { value: new THREE.Vector3(-0.45, 0.62, 0.64).normalize() },
      uSunK: { value: night ? 0 : 6 },
    },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uGround; uniform vec3 uSun; uniform float uSunK; varying vec3 vD;
void main(){ vec3 d = normalize(vD); float h = d.y;
  vec3 c = h > 0.0 ? mix(uHor, uZen, pow(h, 0.6)) : mix(uHor * 0.7, uGround, smoothstep(0.0, 0.25, -h));
  c += vec3(1.0, 0.92, 0.8) * uSunK * pow(max(dot(d, uSun), 0.0), 400.0);
  gl_FragColor = vec4(c, 1.0); }`,
  });
  sky.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), mat));
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(sky, 0.02);
  pm.dispose();
  return rt.texture;
}
