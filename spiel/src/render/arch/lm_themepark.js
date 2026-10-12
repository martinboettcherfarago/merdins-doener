// Freizeitpark (4 × 4): Achterbahn mit Looping, Riesenrad, Pferdekarussell und Kettenkarussell (drehen sich),
// Freifallturm, Wildwasserbahn, Eingangstor, Plätze und Buden. Besitzer: G6.
import * as THREE from 'three';
import { registerArch } from './index.js';
import { M } from './kit.js';
import { beam, rod, lathe, torus, tube, railing, lamp, bench, tree, flag, hut, fountain, path, face, flat, addAnim } from './lm_parts.js';
import { ferrisStand, ferrisWheel } from './lm_ferris.js';
import { text } from './lm_text.js';

// Achterbahn: geschlossene Kurve durch Kontrollpunkte (x, y, z in Metern)
const COASTER = [
  [-14, 1.8, -3.2], [-9, 1.8, -3.2], [-5, 1.9, -3.4], [-2.4, 2.6, -5.5], [-2.0, 5.5, -9.5], [-2.0, 12.0, -14.0], [-2.6, 16.0, -17.0],
  [-5.0, 16.6, -18.6], [-8.0, 14.0, -18.8], [-10.6, 4.0, -18.2], [-12.4, 2.2, -16.4],
  [-13.4, 2.2, -14.4], [-16.4, 2.5, -14.0], [-18.6, 6.8, -13.6], [-16.6, 11.2, -13.2], [-14.4, 6.8, -12.8], [-16.4, 2.6, -12.4],
  [-18.6, 2.6, -10.8], [-19.0, 4.0, -7.6], [-17.6, 6.0, -5.6], [-16.0, 2.4, -3.8],
];

function coaster(kit) {
  const d = kit.detail;
  const curve = new THREE.CatmullRomCurve3(COASTER.map(([x, y, z]) => new THREE.Vector3(x * M, y * M, z * M)), true, 'centripetal');
  const N = d === 2 ? 220 : d === 1 ? 120 : 60;
  const pts = curve.getSpacedPoints(N).slice(0, N);
  // Rotationsminimierender Rahmen für die Schienenlage
  const T = [], S = [];
  let s = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < N; i++) {
    const t = pts[(i + 1) % N].clone().sub(pts[i]).normalize();
    s = s.clone().sub(t.clone().multiplyScalar(s.dot(t))).normalize();
    T.push(t); S.push(s.clone());
  }
  const gauge = 0.55 * M;
  if (d === 0) {
    tube(kit, 'paint_red', pts.filter((_, i) => i % 2 === 0).map((p) => [p.x, p.y, p.z]), 0.3 * M, { closed: true, tubular: 60, radial: 3 });
  } else {
    for (const side of [-1, 1]) {
      const rail = pts.map((p, i) => { const q = p.clone().addScaledVector(S[i], side * gauge); return [q.x, q.y, q.z]; });
      tube(kit, 'paint_red', rail, 0.11 * M, { closed: true, tubular: N, radial: d === 2 ? 5 : 3 });
    }
    // Rückgrat unter der Mitte
    if (d === 2) {
      const spine = pts.map((p, i) => { const up = new THREE.Vector3().crossVectors(S[i], T[i]).normalize(); const q = p.clone().addScaledVector(up, -0.35 * M); return [q.x, q.y, q.z]; });
      tube(kit, 'paint_yellow', spine, 0.16 * M, { closed: true, tubular: N, radial: 4 });
    }
    for (let i = 0; i < N; i += d === 2 ? 2 : 4) {
      const a = pts[i].clone().addScaledVector(S[i], -gauge), b = pts[i].clone().addScaledVector(S[i], gauge);
      beam(kit, 'metal_dark', [a.x, a.y - 0.05 * M, a.z], [b.x, b.y - 0.05 * M, b.z], 0.12 * M, 0.1 * M);
    }
  }
  // Stützen (außer im Looping-Innenraum) bis zum Boden
  for (let i = 0; i < N; i += d === 2 ? 4 : 8) {
    const p = pts[i];
    if (p.y < 2.4 * M) continue;
    const inLoop = p.x < -14.2 * M && p.z < -12.1 * M && p.z > -14.1 * M && p.y > 3.0 * M;
    if (inLoop && p.y > 7.5 * M) continue;
    beam(kit, 'paint_white', [p.x, 0, p.z], [p.x, p.y - 0.4 * M, p.z], 0.28 * M, 0.28 * M);
    if (d === 2 && p.y > 6 * M) {
      const off = S[i].clone().multiplyScalar(1.6 * M);
      beam(kit, 'paint_white', [p.x + off.x, 0, p.z + off.z], [p.x, p.y * 0.55, p.z], 0.14 * M, 0.14 * M);
    }
    kit.box('concrete', p.x, 0, p.z, 0.6 * M, 0.25 * M, 0.6 * M);
  }
  // Zug in der Station
  for (let k = 0; k < 4; k++) {
    const x = (-12.8 + k * 1.6) * M, z = -3.2 * M;
    kit.box(k % 2 ? 'paint_blue' : 'paint_yellow', x, 1.85 * M, z, 1.4 * M, 0.7 * M, 1.3 * M);
    if (d === 2) kit.box('metal_dark', x, 2.55 * M, z - 0.3 * M, 1.2 * M, 0.5 * M, 0.08 * M);
  }
}

// Pferdekarussell (drehender Teil, relativ zur Achse)
function carouselTop(k, R) {
  const d = k.detail, seg = d === 2 ? 20 : 12;
  k.cyl('wood_planks', 0, 0, 0, R, 0.25 * M, { seg });
  k.cyl('paint_red', 0, -0.05 * M, 0, R + 0.05 * M, 0.12 * M, { seg });
  k.cyl('paint_white', 0, 0.25 * M, 0, 1.0 * M, 3.4 * M, { seg: 10 });
  k.cyl('paint_red', 0, 3.6 * M, 0, R + 0.3 * M, 0.5 * M, { seg, open: true });
  k.cone('awning_striped', 0, 4.1 * M, 0, R + 0.4 * M, 1.8 * M, { seg });
  k.cyl('paint_yellow', 0, 5.8 * M, 0, 0.08 * M, 0.8 * M, { seg: 4 });
  k.sphere('paint_yellow', 0, 6.7 * M, 0, 0.22 * M, { seg: 6 });
  const n = d === 0 ? 0 : d === 2 ? 12 : 8;
  const cols = ['paint_white', 'wood_dark', 'paint_white', 'plaster_cream'];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, r = R * (i % 2 ? 0.6 : 0.82);
    const x = Math.cos(a) * r, z = Math.sin(a) * r, h = (1.0 + (i % 3) * 0.25) * M;
    k.cyl('paint_yellow', x, 0.25 * M, z, 0.04 * M, 3.4 * M, { seg: 4 });
    const ry = -a;
    const f = face(x, z, ry);
    k.add(cols[i % 4], new THREE.BoxGeometry(0.35 * M, 0.45 * M, 1.2 * M), { x, y: h, z, ry });
    const [hx, hz] = f.at(0, 0.65 * M);
    k.add(cols[i % 4], new THREE.BoxGeometry(0.25 * M, 0.6 * M, 0.35 * M), { x: hx, y: h + 0.35 * M, z: hz, ry, rx: -0.4 });
    if (d === 2) for (const [u, w] of [[-0.1, 0.4], [0.1, 0.4], [-0.1, -0.4], [0.1, -0.4]]) {
      const [lx, lz] = f.at(u * M, w * M);
      k.add(cols[i % 4], new THREE.BoxGeometry(0.08 * M, 0.55 * M, 0.08 * M), { x: lx, y: h - 0.45 * M, z: lz, ry, rx: w > 0 ? -0.5 : 0.5 });
    }
  }
  if (d > 0) for (let i = 0; i < (d === 2 ? 24 : 12); i++) {
    const a = (i / (d === 2 ? 24 : 12)) * Math.PI * 2;
    k.box('emissive_warm', Math.cos(a) * (R + 0.32 * M), 3.75 * M, Math.sin(a) * (R + 0.32 * M), 0.15 * M, 0.15 * M, 0.15 * M);
  }
}

// Kettenkarussell (drehender Teil): Schirm oben, Ketten mit Sitzen schräg nach außen
function swingTop(k, R, H) {
  const d = k.detail, seg = d === 2 ? 18 : 10;
  k.cone('paint_blue', 0, H, 0, R * 0.75, 1.6 * M, { seg });
  k.cyl('paint_yellow', 0, H - 0.5 * M, 0, R * 0.75, 0.5 * M, { seg, open: true });
  const n = d === 0 ? 6 : d === 2 ? 16 : 10, tilt = 0.6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const top = [Math.cos(a) * R * 0.7, H - 0.5 * M, Math.sin(a) * R * 0.7];
    const L = 4.0 * M;
    const seat = [top[0] + Math.cos(a) * Math.sin(tilt) * L, top[1] - Math.cos(tilt) * L, top[2] + Math.sin(a) * Math.sin(tilt) * L];
    if (d > 0) beam(k, 'metal_light', top, seat, 0.04 * M, 0.04 * M);
    k.add(i % 2 ? 'paint_red' : 'paint_yellow', new THREE.BoxGeometry(0.55 * M, 0.12 * M, 0.5 * M), { x: seat[0], y: seat[1], z: seat[2], ry: -a, rz: 0 });
    if (d === 2) k.box('emissive_warm', top[0], top[1] - 0.05 * M, top[2], 0.12 * M, 0.12 * M, 0.12 * M);
  }
}

// Wildwasserbahn: Rinne mit Wasser entlang einer Punktfolge (x, y, z)
function flume(kit, pts) {
  const W = 1.4 * M;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay, az] = pts[i], [bx, by, bz] = pts[i + 1];
    const A = [ax * M, ay * M, az * M], B = [bx * M, by * M, bz * M];
    beam(kit, 'wood_planks', [A[0], A[1] - 0.25 * M, A[2]], [B[0], B[1] - 0.25 * M, B[2]], W + 0.3 * M, 0.2 * M, { extend: 0.2 * M });
    beam(kit, 'water_pool', [A[0], A[1] + 0.05 * M, A[2]], [B[0], B[1] + 0.05 * M, B[2]], W - 0.1 * M, 0.08 * M, { extend: 0.2 * M });
    if (kit.detail > 0) {
      const dx = B[0] - A[0], dz = B[2] - A[2], l = Math.hypot(dx, dz) || 1;
      const nx = -dz / l, nz = dx / l;
      for (const s of [-1, 1]) beam(kit, 'wood_planks', [A[0] + nx * s * W / 2, A[1] + 0.2 * M, A[2] + nz * s * W / 2], [B[0] + nx * s * W / 2, B[1] + 0.2 * M, B[2] + nz * s * W / 2], 0.15 * M, 0.7 * M, { extend: 0.15 * M });
    }
    if (ay > 0.8) beam(kit, 'wood_dark', [A[0], 0, A[2]], [A[0], A[1] - 0.3 * M, A[2]], 0.25 * M, 0.25 * M);
  }
}

registerArch('themepark', {
  variants: 1,
  build(ctx) {
    const { kit, detail } = ctx;
    kit.box('grass', 0, 0, 0, 39.8 * M, 0.06 * M, 39.8 * M);
    // --- Wege und Plätze
    path(kit, 'pavers', [0, 20 * M], [0, 1 * M], 4.0 * M);
    kit.cyl('pavers', 0, 0, 2.0 * M, 6.5 * M, 0.08 * M, { seg: 24 });
    path(kit, 'pavers', [-19 * M, 1.5 * M], [19 * M, 1.5 * M], 3.0 * M);
    path(kit, 'pavers', [-10 * M, 1.5 * M], [-11.5 * M, 4.8 * M], 2.6 * M);
    path(kit, 'pavers', [9 * M, 1.5 * M], [10.5 * M, 5.6 * M], 2.6 * M);
    path(kit, 'pavers', [0, -2 * M], [2.5 * M, -11 * M], 2.6 * M);
    path(kit, 'pavers', [2.5 * M, -11 * M], [8.6 * M, -11.4 * M], 2.6 * M);
    fountain(kit, 0, 2.0 * M, 2.4 * M, { stone: 'stone_grey', jet: 2.4 * M });
    // --- Achterbahn mit Station
    coaster(kit);
    kit.box('concrete', -11.0 * M, 0, -3.2 * M, 9.0 * M, 1.5 * M, 3.4 * M);
    if (detail > 0) {
      for (const x of [-15, -11, -7]) for (const z of [-4.8, -1.6]) kit.cyl('paint_white', x * M, 1.5 * M, z * M, 0.1 * M, 2.8 * M, { seg: 6 });
      kit.box('paint_red', -11.0 * M, 4.3 * M, -3.2 * M, 9.6 * M, 0.25 * M, 4.0 * M);
      kit.prism('paint_red', [[-2.2 * M, 0], [2.2 * M, 0], [0, 1.2 * M]], 9.6 * M, { x: -11.0 * M, y: 4.55 * M, z: -3.2 * M, ry: Math.PI / 2 });
      for (let k = 0; k < 6; k++) kit.box('concrete', -11.0 * M, 0, -1.2 * M + k * 0.35 * M, 2.0 * M, 1.5 * M * (1 - k / 6), 0.36 * M);
    }
    // --- Riesenrad (hinten rechts)
    const FR = 7.0 * M, FX = 11.0 * M, FZ = -13.0 * M, FH = FR + 2.6 * M;
    ferrisStand(kit, FX, FZ, FR, FH, { width: 1.8 * M });
    kit.box('concrete', FX, 0, FZ, 4.0 * M, 0.7 * M, 3.2 * M);
    // --- Freifallturm
    const DX = 17.0 * M, DZ = 2.0 * M, DH = 36 * M;
    kit.box('concrete', DX, 0, DZ, 3.4 * M, 0.5 * M, 3.4 * M);
    kit.box('paint_red', DX, 0.5 * M, DZ, 1.6 * M, DH, 1.6 * M);
    if (detail > 0) for (let y = 3; y < DH / M; y += 3) kit.box('paint_white', DX, y * M, DZ, 1.75 * M, 0.25 * M, 1.75 * M);
    kit.box('metal_dark', DX, 14 * M, DZ, 3.2 * M, 1.2 * M, 3.2 * M);
    kit.box('paint_yellow', DX, 13.6 * M, DZ, 3.4 * M, 0.4 * M, 3.4 * M);
    kit.cone('paint_white', DX, DH + 0.5 * M, DZ, 1.4 * M, 3.0 * M, { seg: 4, ry: Math.PI / 4 });
    kit.sphere('emissive_warm', DX, DH + 3.6 * M, DZ, 0.3 * M, { seg: 6 });
    kit.light(DX, DH + 3.6 * M, DZ, 0xff3020, 0.5);
    if (detail > 0) for (const y of [8, 20, 30]) for (const s of [-1, 1]) kit.box('emissive_warm', DX + s * 0.85 * M, y * M, DZ, 0.12 * M, 1.6 * M, 0.12 * M);
    // --- Wildwasserbahn um einen Felsberg
    const FLUME = [[4, 0.5, -1], [8, 0.5, -1.5], [12, 0.6, -2.5], [14, 0.6, -5], [13, 1.0, -7.5], [10, 3.0, -7.5], [6, 6.0, -7.0], [4.5, 6.0, -5.0], [4.5, 4.0, -3.4], [4.2, 0.5, -1.2]];
    kit.add('rock', flat(new THREE.IcosahedronGeometry(3.2 * M, detail === 2 ? 1 : 0)), { x: 8.4 * M, y: 1.4 * M, z: -4.4 * M, sy: 0.75 });
    flume(kit, FLUME);
    kit.cyl('water_pool', 5.0 * M, 0.02 * M, 0.2 * M, 2.4 * M, 0.3 * M, { seg: 14 });
    if (detail > 0) for (const [x, y, z, a] of [[9.5, 0.65, -1.7, 0.2], [11.6, 3.1, -7.5, 1.6]]) kit.add('wood_dark', new THREE.CylinderGeometry(0.45 * M, 0.45 * M, 2.2 * M, 8), { x: x * M, y: (y + 0.3) * M, z: z * M, rz: Math.PI / 2, ry: a });
    // --- Pferdekarussell (Sockel) und Kettenkarussell (Turm)
    const CX = -12.0 * M, CZ = 10.0 * M, CR = 4.4 * M;
    kit.cyl('stone_grey', CX, 0, CZ, CR + 0.8 * M, 0.35 * M, { seg: 20 });
    const SX = 11.0 * M, SZ = 11.0 * M, SH = 9.0 * M, SR = 3.2 * M;
    kit.cyl('stone_grey', SX, 0, SZ, 1.2 * M, 0.4 * M, { seg: 12 });
    kit.cyl('paint_white', SX, 0.4 * M, SZ, 0.55 * M, SH - 0.4 * M, { seg: 10, rTop: 0.4 * M });
    kit.cyl('pavers', SX, 0, SZ, 5.6 * M, 0.07 * M, { seg: 18 });
    // --- Eingangstor
    const GZ = 18.4 * M;
    for (const s of [-1, 1]) {
      kit.cyl('paint_white', s * 4.2 * M, 0, GZ, 1.3 * M, 7.0 * M, { seg: 10 });
      kit.cone('roof_tiles_red', s * 4.2 * M, 7.0 * M, GZ, 1.7 * M, 3.0 * M, { seg: 10 });
      if (detail > 0) { kit.cyl('paint_yellow', s * 4.2 * M, 10.0 * M, GZ, 0.04 * M, 1.2 * M, { seg: 4 }); kit.box('paint_red', s * 4.2 * M + 0.45 * M, 10.6 * M, GZ, 0.9 * M, 0.5 * M, 0.03 * M); }
      hut(kit, s * 8.0 * M, 17.0 * M, 0, 3.0 * M, 2.4 * M, 2.8 * M, { wall: 'paint_white', roof: 'roof_tiles_red', counter: true, awning: 'awning_striped' });
      kit.box('hedge', s * 14.2 * M, 0, 19.4 * M, 11.0 * M, 1.2 * M, 0.8 * M);
    }
    kit.box('paint_white', 0, 5.2 * M, GZ, 7.4 * M, 1.6 * M, 0.5 * M);
    text(kit, 'paint_red', 'FREIZEITPARK', 0, 5.55 * M, GZ + 0.28 * M, 0, 0.75 * M, { depth: 0.08 * M });
    if (detail > 0) for (let i = 0; i < 14; i++) kit.box('emissive_warm', -3.4 * M + i * 0.52 * M, 6.9 * M, GZ + 0.2 * M, 0.14 * M, 0.14 * M, 0.14 * M);
    // --- Buden, Bänke, Bäume, Laternen, Fahnen
    if (detail > 0) {
      hut(kit, -4.2 * M, 8.0 * M, Math.PI / 2, 2.6 * M, 2.0 * M, 2.6 * M, { wall: 'plaster_pink', roof: 'roof_tiles_red', counter: true, awning: 'awning_red' });
      hut(kit, 4.2 * M, 8.0 * M, -Math.PI / 2, 2.6 * M, 2.0 * M, 2.6 * M, { wall: 'plaster_yellow', roof: 'roof_tiles_red', counter: true, awning: 'awning_yellow' });
      hut(kit, -6.0 * M, 4.6 * M, Math.PI, 2.6 * M, 2.0 * M, 2.6 * M, { wall: 'plaster_blue', roof: 'roof_metal_grey', counter: true, awning: 'awning_blue' });
      for (const [x, z, k] of [[-18, 18, 'round'], [18, 18, 'round'], [-18, 7, 'conifer'], [-6, 15, 'round'], [6, 15, 'round'], [18, -6, 'poplar'], [2, -18, 'round'], [17, -18, 'conifer'], [-1, -10, 'round'], [-7.5, 6, 'round'], [7, 5, 'round'], [-18.5, -1, 'round']]) tree(kit, x * M, z * M, 0.85, k);
      for (const [x, z, r] of [[-3.0, 12.0, Math.PI / 2], [3.0, 12.0, -Math.PI / 2], [-5.0, 0.0, 0], [5.0, 0.0, 0], [0, -5.0, Math.PI]]) bench(kit, x * M, z * M, r);
      for (const [x, z] of [[-2.4, 16], [2.4, 16], [-2.4, 9], [2.4, 9], [-7, 1.5], [7, 1.5], [-15, 1.5], [15, 1.5]]) lamp(kit, x * M, z * M, 4.0 * M, { style: 'globe' });
      for (const x of [-12, -9, 9, 12]) flag(kit, x * M, 19.3 * M, 6.0 * M, Math.abs(x) > 10 ? 'paint_yellow' : 'paint_blue');
    }
    const res = kit.build();
    // --- Animierte Fahrgeschäfte
    addAnim(ctx, res, [FX, FH, FZ], 'z', 0.18, (k) => ferrisWheel(k, FR, { width: 1.8 * M, cabins: 12, cabR: 0.7 * M }));
    addAnim(ctx, res, [CX, 0.35 * M, CZ], 'y', 0.5, (k) => carouselTop(k, CR));
    addAnim(ctx, res, [SX, 0, SZ], 'y', 1.3, (k) => swingTop(k, SR, SH));
    return res;
  },
});
void rod; void lathe; void torus;
