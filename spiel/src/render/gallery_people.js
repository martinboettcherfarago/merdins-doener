// Galerie der Menschen (index.html?gallery=people): Körper, Kleidung, Haltungen und Bewegung zum Prüfen per Screenshot.
// Parameter: t=<Zeit in s> (Bewegungsstand), freeze (Zeit anhalten), detail=2|1, zoom, yaw, pitch, ty (Blickhöhe), rows=0,1,2,3 (Auswahl)
import * as THREE from 'three';
import { Batch } from './vehicles_kit.js';
import { lifeGeometry, getPeopleMaterial, getPeopleDepthMaterial, setPeopleTime, FEAT, MODE } from './vehicles_people.js';

const SHIRTS = [0x2f6db3, 0xb8302a, 0xf2f2ee, 0x2a2d31, 0x2f7a4f, 0xe8b52c, 0x8f5ad8, 0xd26a8a, 0x5d7f8f, 0xc9672e];

export function peopleGallery(params, renderer, scene, sun) {
  const d = +(params.get('detail') ?? 2);
  const mat = getPeopleMaterial();
  const hb = new Batch(scene, lifeGeometry('human', d).clone(), mat, { shadow: true, cap: 64 });
  hb.mesh.customDepthMaterial = getPeopleDepthMaterial();
  const bb = new Batch(scene, lifeGeometry('bicycle', d).clone(), mat, { shadow: true, cap: 8 });
  bb.mesh.customDepthMaterial = getPeopleDepthMaterial();
  const ub = new Batch(scene, lifeGeometry('umbrella', 2).clone(), mat, { shadow: true, cap: 8 });
  const pb = new Batch(scene, lifeGeometry('pigeon', 2).clone(), mat, { shadow: true, cap: 8 });
  // Darsteller: [Reihe, Spalte, Haltung, Merkmale, Gangstärke, Schrittrate, Größe]
  const F = FEAT;
  const cast = [
    [0, 0, MODE.WALK, 0, 1, 5.1, 1], [0, 1, MODE.WALK, F.SKIRT | F.LONGHAIR | F.BAG, 1, 5.1, 0.97], [0, 2, MODE.WALK, F.BACKPACK | F.SHORTSLEEVE, 1, 5.4, 1.03],
    [0, 3, MODE.WALK, F.COAT | F.HAT | F.SCARF, 1, 4.8, 1], [0, 4, MODE.WALK, F.PONY | F.SHORTS | F.SHORTSLEEVE, 1, 5.1, 0.95], [0, 5, MODE.WALK, F.BALD | F.COAT, 1, 4.9, 1.02],
    [1, 0, MODE.WALK, F.SHORTS | F.SHORTSLEEVE, 1.85, 7.2, 1], [1, 1, MODE.WALK, F.PONY | F.SHORTS | F.SHORTSLEEVE, 1.85, 7.2, 0.96], [1, 2, MODE.WALK, F.CHILD | F.BACKPACK, 1, 5.7, 0.62],
    [1, 3, MODE.WALK, F.CHILD | F.SKIRT | F.PONY, 1, 5.7, 0.6], [1, 4, MODE.WALK, F.ELDER | F.CANE | F.BALD, 1, 3.5, 0.95], [1, 5, MODE.WALK, F.ELDER | F.SKIRT | F.BAG | F.COAT, 1, 3.5, 0.94],
    [2, 0, MODE.WALK, 0, 0, 0, 1], [2, 1, MODE.WALK, F.SKIRT | F.LONGHAIR, 0, 0, 0.97], [2, 2, MODE.WALK, F.UMBRELLA | F.COAT, 1, 5.0, 1],
    [2, 3, MODE.WALK, F.UMBRELLA | F.SKIRT | F.LONGHAIR, 1, 5.0, 0.97], [2, 4, MODE.WALK, F.HAT | F.COAT, 0, 0, 1], [2, 5, MODE.WALK, F.CHILD, 0, 0, 0.62],
    [3, 0, MODE.SIT, 0, 0, 0, 1], [3, 1, MODE.SIT, F.SKIRT | F.LONGHAIR | F.BAG, 0, 0, 0.97], [3, 3, MODE.CYCLE, F.HELMET, 1, 4.4, 1], [3, 5, MODE.CYCLE, F.LONGHAIR | F.BACKPACK, 1, 4.4, 1],
    [3, 2, MODE.WORK, F.HELMET, 0, 0, 1], [3, 4, MODE.WALK, F.HELMET | F.SHORTSLEEVE, 0, 0, 1.02],
  ];
  const rowsSel = (params.get('rows') || '0,1,2,3').split(',').map(Number);
  const list = cast.filter((c) => rowsSel.includes(c[0]));
  const CX = 0.075, CZ = 0.12;
  const pos = (r, c) => [(c - 2.5) * CX, (r - 1.5) * CZ];
  // Boden, Bank für die Sitzenden
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshStandardMaterial({ color: 0x9a9da3, roughness: 0.9 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.8 }), metal = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.5, metalness: 0.4 });
  const bench = new THREE.Group();
  const add = (m, sx, sy, sz, x, y, z, rx = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.set(x, y, z); b.rotation.x = rx; b.castShadow = true; b.receiveShadow = true; bench.add(b); };
  add(wood, 0.15, 0.006, 0.036, 0, 0.045, 0.004); add(wood, 0.15, 0.012, 0.008, 0, 0.056, -0.018); add(wood, 0.15, 0.012, 0.008, 0, 0.074, -0.022);
  for (const sx of [-0.06, 0.06]) { add(metal, 0.006, 0.042, 0.04, sx, 0.021, 0); add(metal, 0.005, 0.044, 0.005, sx, 0.063, -0.02, -0.18); }
  const [bx, bz] = pos(3, 0.5);
  bench.position.set(bx, 0, bz);
  if (rowsSel.includes(3)) scene.add(bench);
  const span = 0.5;
  const sc = sun.shadow.camera;
  sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 0.1; sc.far = 6;
  sun.position.set(-1.2, 2.2, 1.6); sun.target.position.set(0, 0, 0);
  sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.002;
  const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.01, 100);
  const zoom = +(params.get('zoom') || 1);
  const dist = 0.95 / zoom;
  const yaw = +(params.get('yaw') || 0.35), pitch = +(params.get('pitch') || 0.32);
  const ty = +(params.get('ty') || 0.06);
  camera.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, ty + Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
  camera.lookAt(0, ty, 0);
  const t0 = +(params.get('t') || 0);
  const clock = { t: 0 };
  const freeze = params.has('freeze'); // Bewegungsstand festhalten (Bildfolgen)
  const _c = new THREE.Color();
  const loop = () => {
    if (!freeze) clock.t += 0.016;
    const t = t0 + clock.t;
    setPeopleTime(t);
    hb.begin(); bb.begin(); ub.begin(); pb.begin();
    list.forEach(([r, c, mode, feat, amt, rate, s], i) => {
      let [x, z] = pos(r, c);
      const sd = (i * 0.137 + 0.21) % 1;
      _c.setHex(SHIRTS[i % SHIRTS.length]);
      const ph = t * rate + i;
      if (mode === MODE.SIT) { x = bx + (c ? -0.038 : 0.036); z = bz; }
      const w = mode + 8 * feat;
      hb.push(x, 0, z, 0, 0, 0, s, s, s, _c.r, _c.g, _c.b, ph, amt, sd, w);
      if (feat & FEAT.UMBRELLA) { _c.setHex(0x1f3b63); ub.push(x, 0, z, 0, 0, 0, s, s, s, _c.r, _c.g, _c.b, ph, amt, sd, w); }
      if (mode === MODE.CYCLE) { _c.setHex(0xb8302a); bb.push(x, 0, z, 0, 0, 0, 1, 1, 1, _c.r, _c.g, _c.b, ph, 1, sd, 0); }
    });
    if (rowsSel.includes(3)) for (let k = 0; k < 3; k++) { const peck = Math.sin(t * 0.7 + k * 2) > 0 ? 1 : 0; pb.push(bx + 0.02 + k * 0.03, 0, bz + 0.07 + (k % 2) * 0.02, k * 1.3 + 0.6, 0, 0, 1, 1, 1, 1, 1, 1, t * (peck ? 3.2 : 9) + k, peck, 0.5, MODE.BIRD_GROUND); }
    hb.finish(); bb.finish(); ub.finish(); pb.finish();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  window.__gallery = { items: list.length, tris: hb.triangles, missing: 0, anim: 0, buildMs: 0, slowest: [] };
  loop();
}
