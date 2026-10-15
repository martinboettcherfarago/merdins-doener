// Straßen-Galerie (index.html?gallery=street): Zonengebäude wie in der Stadt – zwei Häuserzeilen je Straße, Modelle nach
// Stilfamilie (mix.js) gewählt und auf ihre Grundstücke eingepasst (fit.js). Zum Prüfen von Abständen, Bauflucht,
// Brandwänden und Familien per Screenshot.
// Parameter: key=res|com|off  level=1..5  fp=1x1  n=6 (Grundstücke je Zeile)  eras=0,1,2,3 (eine Straße je Epoche)
//   pal=0..3 (Farbfamilie)  seed  detail=2|1|0  zoom  yaw  pitch
import * as THREE from 'three';
import { buildArch } from './arch/all.js';
import { archTags } from './arch/index.js';
import { MixGrid, pickByStyle, encodeVariant } from './arch/mix.js';
import { getMaterial } from './matlib.js';

export function streetGallery(params, renderer, scene, sun) {
  const key = params.get('key') || 'res';
  const level = +(params.get('level') || 1);
  const [fw, fd] = (params.get('fp') || '1x1').split('x').map(Number);
  const n = +(params.get('n') || 6);
  const eras = (params.get('eras') || '0,1,2,3').split(',').map(Number);
  const detail = +(params.get('detail') ?? 2);
  const mix = new MixGrid(64, 64, +(params.get('seed') || 7));
  const tags = archTags(key, level, fw, fd);
  const roadW = 0.9;
  const rowPitch = fd * 2 + roadW + 0.8;
  let tris = 0;
  const add = (res, x, z, ry) => {
    if (!res) return;
    tris += res.triangles || 0;
    for (const m of res.meshes) {
      const mesh = new THREE.Mesh(m.geometry, getMaterial(m.material));
      mesh.position.set(x, 0, z); mesh.rotation.y = ry;
      mesh.castShadow = true; mesh.receiveShadow = true;
      scene.add(mesh);
    }
  };
  const flat = (mat, x, z, sx, sz, y) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.01, sz), getMaterial(mat));
    m.position.set(x, y, z); m.receiveShadow = true; scene.add(m);
  };
  const L = n * fw;
  eras.forEach((e, r) => {
    const zr = r * rowPitch;
    flat('asphalt', L / 2, zr, L + 1, roadW - 0.3, -0.004);
    for (const s of [-1, 1]) flat('sidewalk', L / 2, zr + s * (roadW / 2 - 0.075), L + 1, 0.15, -0.002);
    const pal = params.has('pal') ? +params.get('pal') : r % 4;
    for (const side of [0, 1]) {
      for (let i = 0; i < n; i++) {
        // Zeile 0 nördlich der Straße (Front nach +z), Zeile 1 südlich (gedreht)
        const gx = i * fw + 1, gy = r * 6 + side * 3 + 1;
        const end = i === 0 ? 1 : i === n - 1 ? 2 : 0; // Grundstück am Zeilenende: Seite zur Querstraße
        const cornerBits = side === 0 ? end : end === 1 ? 2 : end === 2 ? 1 : 0;
        const idx = pickByStyle(tags, e, mix, gx, gy, level, cornerBits);
        const t = tags[idx];
        const v = encodeVariant(idx, 0, t.typ === 'A' && t.corner ? cornerBits : 0, key === 'res' && level <= 2 ? pal : 0);
        const res = buildArch(key, level, v, fw, fd, { zone: 1, mixed: true }, detail);
        const x = i * fw + fw / 2;
        add(res, x, side === 0 ? zr - roadW / 2 - fd / 2 : zr + roadW / 2 + fd / 2, side === 0 ? 0 : Math.PI);
      }
    }
  });
  const W = L, H = eras.length * rowPitch;
  const g = new THREE.Mesh(new THREE.PlaneGeometry(W + 20, H + 20), getMaterial('grass'));
  g.rotation.x = -Math.PI / 2; g.position.set(W / 2, -0.012, H / 2 - rowPitch / 2); g.receiveShadow = true;
  scene.add(g);
  const cx = W / 2, cz = (eras.length - 1) * rowPitch / 2;
  const span = Math.max(W, H);
  const sc = sun.shadow.camera;
  sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 1; sc.far = span * 4;
  sun.position.set(cx - span * 0.6, span * 1.1, cz + span * 0.9);
  sun.target.position.set(cx, 0, cz);
  const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.05, 1000);
  const zoom = +(params.get('zoom') || 1);
  const dist = span * 1.0 / zoom;
  const yaw = +(params.get('yaw') || 0.5), pitch = +(params.get('pitch') || 0.6);
  camera.position.set(cx + Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, cz + Math.cos(yaw) * Math.cos(pitch) * dist);
  camera.lookAt(cx, 0, cz);
  window.__gallery = { items: n * 2 * eras.length, tris };
  const loop = () => { renderer.render(scene, camera); requestAnimationFrame(loop); };
  loop();
}
