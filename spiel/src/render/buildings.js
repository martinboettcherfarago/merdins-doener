// Gebäude als instanzierte Low-Poly-Bauteile. Jedes Gebäude wird prozedural aus Teilen zusammengesetzt.
import * as THREE from 'three';
import { Z, BUILDINGS, TRANSIT } from '../config.js';
import { mulberry32 } from '../util.js';
import { makeBuildingMaterial } from './materials.js';
import { ProtoManager } from './protos.js';
import { archKeyFor, frontFootprint } from './arch/all.js';

// ---------- Geometrien
function gableGeo() {
  // Satteldach: First entlang z, Querschnitt in x/y
  const g = new THREE.BufferGeometry();
  const v = [
    // Giebel vorne/hinten
    -0.5, 0, 0.5, 0.5, 0, 0.5, 0, 1, 0.5,
    0.5, 0, -0.5, -0.5, 0, -0.5, 0, 1, -0.5,
    // Dachflächen
    -0.5, 0, -0.5, -0.5, 0, 0.5, 0, 1, 0.5, -0.5, 0, -0.5, 0, 1, 0.5, 0, 1, -0.5,
    0.5, 0, 0.5, 0.5, 0, -0.5, 0, 1, -0.5, 0.5, 0, 0.5, 0, 1, -0.5, 0, 1, 0.5,
    // Boden
    -0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5,
  ];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

const KINDS = {
  box: () => { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0); return g; },
  gable: gableGeo,
  pyramid: () => { const g = new THREE.ConeGeometry(0.7071, 1, 4, 1); g.rotateY(Math.PI / 4); g.translate(0, 0.5, 0); return g; },
  cyl: () => { const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 14); g.translate(0, 0.5, 0); return g; },
  cone: () => { const g = new THREE.CylinderGeometry(0.33, 0.5, 1, 16, 1, true); g.translate(0, 0.5, 0); return g; },
  sphere: () => { const g = new THREE.IcosahedronGeometry(0.5, 1); g.translate(0, 0.5, 0); return g; },
  hemi: () => { const g = new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); return g; },
  glow: () => { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0); return g; },
};
const POOL_SIZE = { box: 60000, gable: 14000, pyramid: 4000, cyl: 9000, cone: 600, sphere: 12000, hemi: 800, glow: 3000 };

class Pool {
  constructor(kind, scene) {
    this.kind = kind;
    const geo = KINDS[kind]();
    const max = POOL_SIZE[kind];
    this.max = max;
    const win = new Float32Array(max);
    geo.setAttribute('aWin', new THREE.InstancedBufferAttribute(win, 1));
    this.win = geo.attributes.aWin;
    let mat;
    if (kind === 'box') mat = makeBuildingMaterial();
    else if (kind === 'glow') mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    else if (kind === 'cone') mat = new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide });
    else mat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.02, flatShading: kind === 'gable' || kind === 'pyramid' || kind === 'sphere' });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.castShadow = kind !== 'glow';
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    scene.add(this.mesh);
    this.free = [];
    this.top = 0;
    this.dirty = false;
    this._zero = new THREE.Matrix4().makeScale(0, 0, 0);
  }
  alloc() {
    if (this.free.length) return this.free.pop();
    if (this.top >= this.max) return -1;
    const i = this.top++;
    this.mesh.count = this.top;
    return i;
  }
  release(i) {
    this.mesh.setMatrixAt(i, this._zero);
    this.free.push(i);
    this.dirty = true;
  }
  set(i, m4, color, win) {
    this.mesh.setMatrixAt(i, m4);
    this.mesh.setColorAt(i, color);
    this.win.array[i] = win;
    this.dirty = true;
  }
  setColor(i, color) { this.mesh.setColorAt(i, color); this.dirty = true; }
  setWin(i, w) { this.win.array[i] = w; this.dirty = true; }
  flush() {
    if (!this.dirty) return;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.win.needsUpdate = true;
    this.dirty = false;
  }
}

// ---------- Farbpaletten
const PAL = {
  resWall: [0xf3e6cf, 0xe9d3b4, 0xd8e4ea, 0xe7d8e6, 0xf1d9c6, 0xdfe8d2, 0xf4ecd8, 0xe3d2bf],
  resRoof: [0xc8644b, 0xb5503d, 0x5b6475, 0x8a5a44, 0x4f7f84, 0x9b4f3f],
  resBlock: [0xe9dccb, 0xd9c4ad, 0xcfd8dd, 0xe2cfc1, 0xd5d0c3, 0xc9b8a5],
  tower: [0xd8d3cb, 0xc6cfd6, 0xe4dbd0, 0xbfc7c9],
  com: [0xf5d76e, 0xf28f6b, 0x7cc6d6, 0xf2b5c4, 0xa7d58b, 0xf6c28b, 0x9fb6f0],
  comBlock: [0xe6e1d8, 0xd7dde3, 0xefe3d2, 0xdcd6ea],
  awning: [0xe8543f, 0x2f8fe0, 0x22a866, 0xf2b01e, 0x8f5ad8, 0xf06fae],
  ind: [0xb8beb9, 0xa7b3bd, 0xc9c2b2, 0x9ea7a0, 0xb3a89a],
  indRoof: [0x6f7c86, 0x83796b, 0x5d6b62, 0x7b858c],
  off: [0x9fb4c8, 0xb7c6d3, 0x8ea7bd, 0xa9b9c1, 0xc3cdd6, 0x93a3b6],
  offTrim: [0x4f5d6c, 0x5e6b78, 0x6c7884],
};
const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];

// Bauteile eines Gebäudes beschreiben (lokale Koordinaten, Front zeigt nach +z).
export function composeBuilding(b) {
  const P = [];
  const r = mulberry32(b.variant + b.level * 977 + (b.spec ? 31 : 0));
  const add = (k, x, y, z, sx, sy, sz, c, w = 0, ry = 0, extra) => { P.push({ k, x, y, z, sx, sy, sz, c, w, ry, ...extra }); };
  const L = b.level;
  if (b.zone === Z.RES) {
    if (L === 1) {
      const wall = pick(r, PAL.resWall), roof = pick(r, PAL.resRoof);
      if (r() < 0.35) {
        // zwei kleine Häuser
        for (const sx of [-0.22, 0.22]) {
          add('box', sx, 0, 0.02, 0.34, 0.32, 0.36, r() < 0.5 ? wall : pick(r, PAL.resWall), 1);
          add('gable', sx, 0.32, 0.02, 0.38, 0.2, 0.4, roof, 0, 0);
        }
      } else {
        const w = 0.46 + r() * 0.12, d = 0.4 + r() * 0.1, h = 0.34 + r() * 0.08;
        add('box', 0, 0, 0.0, w, h, d, wall, 1);
        add('gable', 0, h, 0.0, w + 0.06, 0.24, d + 0.06, roof, 0, Math.PI / 2);
        add('box', w * 0.25, h + 0.05, -0.05, 0.06, 0.2, 0.06, 0x8b6f5c);
        if (r() < 0.6) add('sphere', -0.32, 0, -0.32, 0.22, 0.3, 0.22, 0x5f9f52);
        add('box', 0, 0, 0.36, 0.1, 0.012, 0.28, 0xd9d1c1);
      }
    } else if (L === 2) {
      const wall = pick(r, PAL.resWall), roof = pick(r, PAL.resRoof);
      const w = 0.62 + r() * 0.12, d = 0.52 + r() * 0.08, h = 0.62 + r() * 0.1;
      add('box', 0, 0, -0.02, w, h, d, wall, 1);
      add('gable', 0, h, -0.02, w + 0.06, 0.28, d + 0.06, roof, 0, Math.PI / 2);
      if (r() < 0.5) add('box', -w / 2 + 0.08, 0, d / 2 + 0.02, 0.18, 0.28, 0.14, wall, 1);
      if (r() < 0.5) add('sphere', 0.36, 0, 0.34, 0.18, 0.26, 0.18, 0x5f9f52);
    } else if (L === 3) {
      const wall = pick(r, PAL.resBlock);
      const h = 0.95 + r() * 0.25;
      add('box', 0, 0, 0, 0.84, h, 0.72, wall, 1);
      add('box', 0, h, 0, 0.88, 0.04, 0.76, 0x8f8a83);
      if (r() < 0.6) add('gable', 0, h, 0, 0.86, 0.22, 0.74, pick(r, PAL.resRoof), 0, Math.PI / 2);
      else add('box', 0.2, h, -0.1, 0.2, 0.14, 0.2, 0xb8b1a6);
      for (let k = 0; k < 3; k++) add('box', -0.28 + k * 0.28, 0.3, 0.37, 0.18, 0.03, 0.06, 0xf6f2ea);
    } else if (L === 4) {
      const wall = pick(r, PAL.resBlock);
      const h = 1.8 + r() * 0.5;
      add('box', 0, 0, 0, 0.86, h, 0.84, wall, 1);
      add('box', 0, h, 0, 0.6, 0.22, 0.56, wall, 1);
      add('box', 0, h + 0.22, 0, 0.64, 0.03, 0.6, 0x8f8a83);
      add('cyl', -0.24, h, 0.22, 0.14, 0.2, 0.14, 0x9aa3a8);
      for (let k = 0; k < 4; k++) add('box', 0, 0.35 + k * 0.42, 0.43, 0.7, 0.03, 0.06, 0xf1ede6);
    } else {
      const c = pick(r, PAL.tower);
      const h = 3.4 + r() * 1.6;
      add('box', 0, 0, 0, 0.94, 0.42, 0.94, pick(r, PAL.resBlock), 3);
      add('box', 0, 0.42, 0, 0.62, h, 0.62, c, 1);
      add('box', 0, 0.42 + h, 0, 0.5, 0.18, 0.5, c, 1);
      if (r() < 0.5) add('box', 0, 0.6 + h, 0, 0.04, 0.5, 0.04, 0x9aa3a8);
      else add('pyramid', 0, 0.6 + h, 0, 0.5, 0.35, 0.5, pick(r, PAL.resRoof));
    }
  } else if (b.zone === Z.COM) {
    const col = pick(r, PAL.com), aw = pick(r, PAL.awning);
    if (L === 1) {
      add('box', 0, 0, -0.02, 0.66, 0.4, 0.58, col, 3);
      add('box', 0, 0.3, 0.32, 0.68, 0.035, 0.14, aw, 0, 0, { tilt: 0.25 });
      add('box', 0, 0.4, -0.02, 0.7, 0.04, 0.62, 0xe9e4da);
      add('glow', 0, 0.44, 0.12, 0.34, 0.1, 0.03, aw);
    } else if (L === 2) {
      add('box', 0, 0, -0.02, 0.86, 0.72, 0.76, col, 3);
      add('box', 0, 0.3, 0.41, 0.86, 0.035, 0.14, aw, 0, 0, { tilt: 0.25 });
      add('box', 0, 0.72, -0.02, 0.9, 0.04, 0.8, 0xe9e4da);
      add('glow', 0.2, 0.76, 0.2, 0.36, 0.12, 0.03, pick(r, PAL.awning));
    } else if (L === 3) {
      add('box', 0, 0, 0, 0.9, 1.2, 0.9, pick(r, PAL.comBlock), 3);
      add('box', 0, 0.36, 0.46, 0.9, 0.04, 0.12, aw);
      add('glow', 0, 0.95, 0.46, 0.6, 0.14, 0.02, aw);
      add('box', 0.2, 1.2, -0.2, 0.3, 0.16, 0.3, 0xb9b3aa);
    } else if (L === 4) {
      const h = 1.9 + r() * 0.4;
      add('box', 0, 0, 0, 0.94, h, 0.94, pick(r, PAL.comBlock), 3);
      add('box', 0, 0.4, 0.48, 0.94, 0.04, 0.12, aw);
      add('glow', 0, h + 0.05, 0.1, 0.7, 0.32, 0.04, aw);
      add('box', 0, h, 0.1, 0.06, 0.08, 0.06, 0x555);
    } else {
      const h = 3.3 + r() * 1.4;
      add('box', 0, 0, 0, 0.96, 0.6, 0.96, pick(r, PAL.comBlock), 3);
      add('box', 0, 0.6, 0, 0.7, h, 0.7, pick(r, PAL.off), 2);
      add('glow', 0, 0.6 + h - 0.3, 0.355, 0.5, 0.18, 0.02, aw);
      add('box', 0, 0.6 + h, 0, 0.56, 0.12, 0.56, 0x7e8790);
    }
  } else if (b.zone === Z.IND) {
    if (b.spec === 'farm') {
      add('box', 0, 0, 0, 0.94, 0.015, 0.94, 0x9a7b55);
      const crop = r() < 0.5 ? 0xd8c25a : 0x7fb14f;
      for (let k = 0; k < 4; k++) add('box', -0.33 + k * 0.17, 0.015, 0.1, 0.1, 0.04 + L * 0.01, 0.62, crop);
      add('box', 0.3, 0, -0.3, 0.3, 0.22, 0.26, 0xb5473a, 0);
      add('gable', 0.3, 0.22, -0.3, 0.32, 0.14, 0.28, 0x6b4a3a, 0, Math.PI / 2);
      if (L >= 2) add('cyl', 0.38, 0, 0.0, 0.14, 0.42 + L * 0.06, 0.14, 0xd5d2c8);
      if (L >= 3) add('cyl', 0.2, 0, 0.0, 0.12, 0.38, 0.12, 0xc9c5b8);
    } else if (b.spec === 'mine') {
      add('box', 0, 0, 0, 0.94, 0.015, 0.94, 0x8b8177);
      add('pyramid', -0.2, 0, 0.18, 0.42, 0.24 + L * 0.04, 0.42, 0x5a544e);
      const hx = 0.22, h = 0.7 + L * 0.12;
      for (const [dx, dz] of [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]]) add('box', hx + dx, 0, -0.18 + dz, 0.03, h, 0.03, 0x6d4b3a);
      add('box', hx, h, -0.18, 0.24, 0.04, 0.24, 0x6d4b3a);
      add('cyl', hx, h + 0.04, -0.18, 0.18, 0.04, 0.18, 0x3f444a);
      add('box', 0.25, 0, 0.25, 0.32, 0.22, 0.26, pick(r, PAL.ind), 4);
    } else {
      const col = pick(r, PAL.ind), roof = pick(r, PAL.indRoof);
      if (L === 1) {
        add('box', 0, 0, 0, 0.74, 0.38, 0.6, col, 4);
        add('gable', 0, 0.38, 0, 0.78, 0.14, 0.64, roof, 0, Math.PI / 2);
        add('cyl', 0.26, 0.2, -0.18, 0.08, 0.55, 0.08, 0x8d6b5b, 0, 0, { smoke: 1 });
      } else if (L === 2) {
        add('box', 0, 0, 0, 0.88, 0.46, 0.8, col, 4);
        for (let k = 0; k < 3; k++) add('gable', -0.29 + k * 0.29, 0.46, 0, 0.3, 0.16, 0.8, roof, 0, 0);
        add('cyl', -0.3, 0.2, -0.3, 0.1, 0.8, 0.1, 0x8d6b5b, 0, 0, { smoke: 1 });
      } else if (L === 3) {
        add('box', -0.1, 0, 0, 0.66, 0.55, 0.84, col, 4);
        add('box', -0.1, 0.55, 0, 0.7, 0.04, 0.88, roof);
        add('cyl', 0.34, 0, -0.22, 0.2, 0.62, 0.2, 0xd5d2c8);
        add('cyl', 0.34, 0, 0.12, 0.2, 0.62, 0.2, 0xcbc7bb);
        add('cyl', -0.3, 0.5, -0.3, 0.1, 0.9, 0.1, 0x9d5b4b, 0, 0, { smoke: 1 });
      } else if (L === 4) {
        add('box', 0, 0, 0.05, 0.92, 0.7, 0.8, col, 4);
        add('box', 0, 0.7, 0.05, 0.94, 0.04, 0.84, roof);
        add('cyl', -0.3, 0.7, -0.3, 0.12, 1.2, 0.12, 0xb35245, 0, 0, { smoke: 1 });
        add('cyl', 0.0, 0.7, -0.3, 0.12, 1.0, 0.12, 0xe8e4dc, 0, 0, { smoke: 1 });
        add('sphere', 0.3, 0.7, -0.25, 0.3, 0.3, 0.3, 0xdcd8cc);
      } else {
        add('box', 0, 0, 0, 0.92, 0.82, 0.9, 0xeceff1, 2);
        add('box', 0, 0.82, 0, 0.94, 0.03, 0.92, 0x8e9aa4);
        for (let k = 0; k < 3; k++) add('box', -0.25 + k * 0.25, 0.86, 0, 0.2, 0.02, 0.7, 0x29405e, 0, 0, { tilt: 0.3 });
        add('glow', 0, 0.6, 0.455, 0.6, 0.04, 0.01, 0x7fd6ff);
      }
    }
  } else if (b.zone === Z.OFF) {
    const col = pick(r, PAL.off), trim = pick(r, PAL.offTrim);
    const hs = [0, 0.9, 1.6, 2.6, 3.7, 5.4];
    const h = hs[L] * (0.9 + r() * 0.25);
    const w = L >= 4 ? 0.72 : 0.78;
    add('box', 0, 0, 0, w, h, w, col, 2);
    add('box', 0, h, 0, w + 0.03, 0.05, w + 0.03, trim);
    if (L >= 3) add('box', 0, h * 0.55, 0, w + 0.04, 0.04, w + 0.04, trim);
    if (L >= 4) add('box', 0, h + 0.05, 0, w * 0.7, h * 0.12, w * 0.7, col, 2);
    if (L === 5) {
      add('cyl', 0, h * 1.17, 0, 0.05, 0.9, 0.05, 0xcfd6dc);
      add('glow', 0, h * 1.17 + 0.9, 0, 0.05, 0.05, 0.05, 0xff5a4a);
    }
    if (L <= 2) add('box', 0, 0, 0.42, 0.3, 0.2, 0.06, trim);
  } else {
    composeService(b, add, r);
  }
  return P;
}

function composeService(b, add, r) {
  const k = b.key;
  const [W, D] = BUILDINGS[k] ? BUILDINGS[k].size : [b.w, b.h];
  const ground = (c) => add('box', 0, 0, 0, W - 0.06, 0.02, D - 0.06, c);
  switch (k) {
    case 'coal':
      ground(0x8d8478);
      add('box', -0.35, 0, 0.3, 1.1, 0.7, 0.9, 0x9b8f84, 4);
      add('box', -0.35, 0.7, 0.3, 1.14, 0.05, 0.94, 0x5e5a55);
      add('cone', 0.5, 0, -0.45, 0.9, 1.25, 0.9, 0xd9d4ca, 0, 0, { steam: 1 });
      add('cyl', -0.7, 0, -0.5, 0.16, 2.3, 0.16, 0xb84a3c, 0, 0, { smoke: 2 });
      add('cyl', -0.7, 1.3, -0.5, 0.165, 0.25, 0.165, 0xf0ece4);
      add('pyramid', 0.55, 0, 0.55, 0.5, 0.25, 0.5, 0x2f2c2a);
      break;
    case 'wind':
      add('cyl', 0, 0, 0, 0.07, 2.1, 0.07, 0xf2f3f3);
      add('box', 0, 2.08, -0.06, 0.1, 0.1, 0.22, 0xe7e9ea);
      add('box', 0, 0, 0, 0.3, 0.02, 0.3, 0xa8a49b);
      break;
    case 'solar':
      ground(0x9fb08c);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) add('box', -0.7 + i * 0.47, 0.08, -0.55 + j * 0.55, 0.4, 0.03, 0.4, 0x2a4a74, 0, 0, { tilt: -0.45 });
      break;
    case 'gas':
      ground(0x8d8a82);
      add('box', -0.3, 0, 0.3, 1.0, 0.65, 0.8, 0xc2c6c8, 4);
      add('sphere', 0.5, 0, -0.45, 0.65, 0.65, 0.65, 0xe7e3d8);
      add('cyl', -0.6, 0.6, -0.5, 0.12, 1.3, 0.12, 0xd5d0c6, 0, 0, { smoke: 1 });
      break;
    case 'fusion':
      ground(0xc9cfd4);
      add('hemi', 0, 0, 0, 2.0, 1.6, 2.0, 0xf2f4f6);
      add('cyl', 0, 0, 0, 2.5, 0.12, 2.5, 0x8fa0ad);
      add('glow', 0, 0.12, 0, 2.3, 0.05, 2.3, 0x63e3ff);
      add('box', 1.1, 0, 1.1, 0.5, 0.5, 0.5, 0xdfe5ea, 2);
      break;
    case 'watertower':
      add('cyl', 0, 0, 0, 0.12, 0.9, 0.12, 0xb7b0a4);
      add('sphere', 0, 0.75, 0, 0.55, 0.45, 0.55, 0x8ec5df);
      add('box', 0, 0, 0, 0.4, 0.02, 0.4, 0xa8a49b);
      break;
    case 'pump':
      add('box', 0, 0, 0, 0.6, 0.4, 0.55, 0xc7d6dd, 4);
      add('gable', 0, 0.4, 0, 0.64, 0.14, 0.59, 0x4f7f9a, 0, Math.PI / 2);
      add('cyl', 0.3, 0.1, 0.3, 0.08, 0.08, 0.5, 0x5f7f8f);
      break;
    case 'waterworks':
      ground(0xb7b9b1);
      add('cyl', -0.45, 0, -0.45, 0.8, 0.12, 0.8, 0x9aa5ab);
      add('cyl', -0.45, 0.1, -0.45, 0.7, 0.03, 0.7, 0x4aa3c7);
      add('cyl', 0.45, 0, -0.45, 0.8, 0.12, 0.8, 0x9aa5ab);
      add('cyl', 0.45, 0.1, -0.45, 0.7, 0.03, 0.7, 0x4aa3c7);
      add('box', 0, 0, 0.5, 1.6, 0.5, 0.7, 0xd6dee2, 4);
      break;
    case 'landfill':
      ground(0x7e6a52);
      add('pyramid', -0.4, 0, -0.3, 0.8, 0.35, 0.8, 0x8a7d62);
      add('pyramid', 0.35, 0, -0.35, 0.6, 0.25, 0.6, 0x6f7b5a);
      add('pyramid', 0.1, 0, 0.35, 0.7, 0.3, 0.6, 0x9a8a6c);
      add('box', 0.6, 0, 0.6, 0.35, 0.25, 0.3, 0x9ba49a, 4);
      break;
    case 'incinerator':
      ground(0x8d8a82);
      add('box', 0, 0, 0.2, 1.4, 0.8, 1.0, 0xb9bcbf, 4);
      add('cyl', -0.55, 0, -0.55, 0.2, 2.2, 0.2, 0xd8d3c9, 0, 0, { smoke: 2 });
      add('box', 0, 0.8, 0.2, 1.44, 0.04, 1.04, 0x6a6f74);
      break;
    case 'recycling':
      ground(0xa5ad9c);
      add('box', -0.25, 0, -0.2, 1.1, 0.55, 0.9, 0x6fae6b, 4);
      for (let i = 0; i < 4; i++) add('box', -0.6 + i * 0.4, 0, 0.65, 0.3, 0.2, 0.25, [0x2f8fe0, 0xf2b01e, 0xe8543f, 0x22a866][i]);
      break;
    case 'police':
      add('box', 0, 0, 0, 0.78, 0.52, 0.66, 0xdfe5ec, 1);
      add('box', 0, 0.36, 0.335, 0.78, 0.08, 0.02, 0x2a5fb0);
      add('box', 0, 0.52, 0, 0.82, 0.04, 0.7, 0x2a3f66);
      add('glow', 0, 0.56, 0.1, 0.16, 0.05, 0.06, 0x3c8dff);
      add('cyl', 0.36, 0, 0.38, 0.02, 0.8, 0.02, 0xcccccc);
      break;
    case 'policehq':
      ground(0xc9cdd1);
      add('box', 0, 0, 0, 1.6, 0.8, 1.2, 0xdfe5ec, 1);
      add('box', 0, 0.8, -0.1, 0.6, 0.6, 0.6, 0xc7d0da, 1);
      add('box', 0, 0.55, 0.605, 1.6, 0.1, 0.02, 0x2a5fb0);
      add('glow', 0, 1.42, -0.1, 0.2, 0.06, 0.2, 0x3c8dff);
      break;
    case 'fire':
      add('box', 0, 0, 0, 0.8, 0.5, 0.66, 0xc9473b, 1);
      add('box', -0.18, 0, 0.335, 0.26, 0.32, 0.02, 0x3a3a3a);
      add('box', 0.18, 0, 0.335, 0.26, 0.32, 0.02, 0x3a3a3a);
      add('box', 0.3, 0.5, -0.2, 0.18, 0.42, 0.18, 0xb63c31);
      add('box', 0, 0.5, 0, 0.84, 0.04, 0.7, 0x6e2a24);
      break;
    case 'firehq':
      ground(0xc9c3bb);
      add('box', 0, 0, 0, 1.6, 0.7, 1.2, 0xc9473b, 1);
      for (let i = 0; i < 4; i++) add('box', -0.6 + i * 0.4, 0, 0.605, 0.3, 0.42, 0.02, 0x3a3a3a);
      add('box', 0.55, 0.7, -0.35, 0.3, 0.8, 0.3, 0xb63c31);
      break;
    case 'clinic':
      add('box', 0, 0, 0, 0.78, 0.55, 0.66, 0xf6f7f8, 1);
      add('box', 0, 0.55, 0, 0.82, 0.04, 0.7, 0xb7c2c9);
      add('box', 0, 0.6, 0, 0.32, 0.03, 0.1, 0xe3443a);
      add('box', 0, 0.6, 0, 0.1, 0.03, 0.32, 0xe3443a);
      break;
    case 'hospital':
      ground(0xc5ccc9);
      add('box', -0.2, 0, 0, 1.2, 1.3, 1.0, 0xf4f6f7, 2);
      add('box', 0.6, 0, 0.3, 0.6, 0.6, 0.9, 0xe9eef0, 1);
      add('box', -0.2, 1.3, 0, 0.5, 0.03, 0.15, 0xe3443a);
      add('box', -0.2, 1.3, 0, 0.15, 0.03, 0.5, 0xe3443a);
      add('cyl', 0.6, 0.6, 0.3, 0.45, 0.03, 0.45, 0x5b6470);
      break;
    case 'school':
      add('box', 0, 0, 0, W - 0.06, 0.02, D - 0.06, 0x9cbf7c);
      add('box', -0.45, 0, -0.05, 0.9, 0.5, 0.7, 0xf0d58a, 1);
      add('gable', -0.45, 0.5, -0.05, 0.94, 0.2, 0.74, 0xb5503d, 0, Math.PI / 2);
      add('box', 0.5, 0.02, 0, 0.8, 0.01, 0.7, 0xc76b4b);
      add('box', 0.5, 0.03, 0, 0.02, 0.01, 0.7, 0xffffff);
      break;
    case 'university':
      add('box', 0, 0, 0, W - 0.06, 0.02, D - 0.06, 0x94bd78);
      add('box', -0.9, 0, -0.3, 1.0, 0.75, 1.0, 0xb7674f, 1);
      add('box', 0.9, 0, -0.3, 1.0, 0.75, 1.0, 0xb7674f, 1);
      add('box', 0, 0, -0.55, 0.9, 1.0, 0.7, 0xd9cbb3, 1);
      add('hemi', 0, 1.0, -0.55, 0.6, 0.5, 0.6, 0x6b8f8a);
      add('box', 0, 0.02, 0.55, 1.6, 0.01, 0.12, 0xe6dccb);
      break;
    case 'library':
      add('box', 0, 0, 0, 0.8, 0.5, 0.66, 0xe8e0cf, 1);
      add('gable', 0, 0.5, 0, 0.84, 0.16, 0.7, 0x7d8a8f, 0, Math.PI / 2);
      for (let i = 0; i < 4; i++) add('cyl', -0.27 + i * 0.18, 0, 0.36, 0.05, 0.45, 0.05, 0xf5f1e8);
      break;
    case 'park': parkTile(add, r, 0, 0, 1); break;
    case 'citypark':
      add('box', 0, 0, 0, W - 0.04, 0.025, D - 0.04, 0x86c46f);
      add('cyl', 0.3, 0.02, 0.3, 0.8, 0.02, 0.6, 0x4aa3c7);
      add('box', 0, 0.03, -0.3, 1.8, 0.008, 0.1, 0xe2d6bf);
      add('box', -0.3, 0.03, 0, 0.1, 0.008, 1.8, 0xe2d6bf);
      for (let i = 0; i < 9; i++) add('sphere', -0.8 + r() * 1.6, 0.12, -0.8 + r() * 1.6, 0.26, 0.36, 0.26, [0x5f9f52, 0x4f8f4a, 0x6aa95a][i % 3]);
      break;
    case 'plaza':
      add('box', 0, 0, 0, 0.96, 0.02, 0.96, 0xe0d8c8);
      add('cyl', 0, 0.02, 0, 0.5, 0.08, 0.5, 0xbab2a3);
      add('cyl', 0, 0.06, 0, 0.42, 0.03, 0.42, 0x5ab3d6);
      add('cyl', 0, 0.06, 0, 0.06, 0.25, 0.06, 0xd0c8b8);
      for (const [x, z] of [[-0.38, -0.38], [0.38, 0.38]]) add('sphere', x, 0.02, z, 0.18, 0.26, 0.18, 0x5f9f52);
      break;
    case 'sports':
      add('box', 0, 0, 0, W - 0.04, 0.02, D - 0.04, 0x58a85a);
      add('box', 0, 0.02, 0, 1.5, 0.004, 0.02, 0xffffff);
      add('cyl', 0, 0.02, 0, 0.35, 0.004, 0.35, 0xffffff);
      add('cyl', 0, 0.022, 0, 0.32, 0.004, 0.32, 0x58a85a);
      add('box', 0, 0, -0.85, 1.6, 0.25, 0.2, 0xd1cbc0);
      break;
    case 'playground':
      add('box', 0, 0, 0, 0.96, 0.02, 0.96, 0xe6d39a);
      add('box', -0.2, 0, -0.1, 0.24, 0.3, 0.24, 0xe8543f);
      add('box', 0.2, 0, 0.2, 0.06, 0.25, 0.4, 0x2f8fe0, 0, 0, { tilt: 0.5 });
      add('box', 0.25, 0, -0.25, 0.3, 0.2, 0.04, 0xf2b01e);
      add('sphere', -0.35, 0.02, 0.35, 0.2, 0.28, 0.2, 0x5f9f52);
      break;
    case 'townhall':
      ground(0xd8d0c0);
      add('box', 0, 0, 0, 1.5, 0.8, 1.1, 0xeee4d0, 1);
      add('gable', 0, 0.8, 0, 1.54, 0.3, 1.14, 0x5b6475, 0, Math.PI / 2);
      add('box', 0, 0, -0.1, 0.36, 1.6, 0.36, 0xe8ddc6, 1);
      add('pyramid', 0, 1.6, -0.1, 0.44, 0.45, 0.44, 0x4f7f84);
      add('glow', 0, 1.3, 0.085, 0.18, 0.18, 0.02, 0xfff0c0);
      break;
    case 'ferris':
      ground(0xd8d0c0);
      add('box', 0, 0, 0, 0.5, 0.2, 0.3, 0x8f5ad8);
      break;
    case 'tvtower':
      add('cyl', 0, 0, 0, 0.3, 0.2, 0.3, 0xcfd2d4);
      add('cyl', 0, 0, 0, 0.14, 5.0, 0.14, 0xe9ecee);
      add('sphere', 0, 4.4, 0, 0.62, 0.62, 0.62, 0xb8c0c6);
      add('glow', 0, 4.68, 0, 0.64, 0.06, 0.64, 0xffd27a);
      add('cyl', 0, 5.0, 0, 0.05, 0.9, 0.05, 0xe9ecee);
      add('glow', 0, 5.9, 0, 0.07, 0.07, 0.07, 0xff4040);
      break;
    case 'stadium':
      add('box', 0, 0, 0, 2.9, 0.02, 2.9, 0xb9b3a6);
      add('cyl', 0, 0, 0, 2.7, 0.55, 2.3, 0xe6e4df);
      add('cyl', 0, 0.02, 0, 2.1, 0.56, 1.7, 0x9b2f3a);
      add('cyl', 0, 0.03, 0, 1.6, 0.56, 1.2, 0x4f9e4d);
      for (const [x, z] of [[-1.25, -1.25], [1.25, -1.25], [-1.25, 1.25], [1.25, 1.25]]) {
        add('cyl', x, 0, z, 0.05, 1.3, 0.05, 0xb0b0b0);
        add('glow', x, 1.3, z, 0.2, 0.08, 0.1, 0xfff6d8);
      }
      break;
    case 'opera':
      add('box', 0, 0, 0, 1.9, 0.18, 1.9, 0xe8e2d6);
      add('sphere', -0.4, 0.05, 0.1, 0.8, 1.1, 1.2, 0xf8f8f5, 0, 0.4);
      add('sphere', 0.15, 0.05, -0.1, 0.7, 0.95, 1.0, 0xf3f2ee, 0, 0.6);
      add('sphere', 0.55, 0.05, 0.25, 0.5, 0.7, 0.7, 0xf8f8f5, 0, 0.8);
      add('box', 0, 0.18, 0.75, 1.4, 0.02, 0.2, 0x5ab3d6);
      break;
    case 'observatory':
      add('box', 0, 0, 0, 0.66, 0.42, 0.66, 0xe2ddd3, 1);
      add('cyl', 0, 0.42, 0, 0.62, 0.08, 0.62, 0xcbc6bc);
      add('hemi', 0, 0.5, 0, 0.6, 0.55, 0.6, 0xf3f4f5);
      add('box', 0, 0.62, 0.12, 0.08, 0.04, 0.3, 0x3b4048, 0, 0, { tilt: -0.5 });
      break;
    case 'doener':
      add('box', 0, 0, 0, 0.82, 0.5, 0.7, 0x231c16, 3);
      add('box', 0, 0.38, 0.36, 0.84, 0.04, 0.14, 0xf5b935, 0, 0, { tilt: 0.25 });
      add('box', 0, 0.5, 0, 0.86, 0.04, 0.74, 0xf5b935);
      add('glow', 0, 0.54, 0.25, 0.42, 0.2, 0.04, 0xf5b935);
      add('box', 0, 0.54, -0.15, 0.04, 0.06, 0.04, 0x777777);
      break;
    case 'lighthouse':
      add('cyl', 0, 0, 0, 0.42, 0.12, 0.42, 0x9aa0a4);
      add('cone', 0, 0.1, 0, 0.32, 0.5, 0.32, 0xf4f4f2);
      add('cyl', 0, 0.6, 0, 0.22, 0.5, 0.22, 0xd84a3e);
      add('cyl', 0, 1.1, 0, 0.21, 0.5, 0.21, 0xf4f4f2);
      add('cyl', 0, 1.6, 0, 0.2, 0.4, 0.2, 0xd84a3e);
      add('glow', 0, 2.0, 0, 0.16, 0.18, 0.16, 0xfff1b8);
      add('pyramid', 0, 2.18, 0, 0.26, 0.18, 0.26, 0x333a40);
      break;
    default:
      add('box', 0, 0, 0, W * 0.8, 0.5, D * 0.8, 0xcccccc, 1);
  }
}

function parkTile(add, r, cx, cz, s) {
  add('box', cx, 0, cz, 0.97 * s, 0.025, 0.97 * s, 0x8fcb74);
  add('box', cx, 0.025, cz, 0.12 * s, 0.006, 0.97 * s, 0xe2d6bf);
  const n = 3 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const x = cx + (r() < 0.5 ? -1 : 1) * (0.18 + r() * 0.22) * s;
    const z = cz + (-0.4 + r() * 0.8) * s;
    add('cyl', x, 0, z, 0.04, 0.16, 0.04, 0x7a5a3e);
    add('sphere', x, 0.1, z, 0.24, 0.3, 0.24, [0x5f9f52, 0x4f8f4a, 0x6aa95a, 0x78ad5c][i % 4]);
  }
  add('box', cx + 0.12 * s, 0.025, cz + 0.2 * s, 0.05, 0.05, 0.16, 0x8a6b4f);
}

// ---------- Ansicht
export class BuildingView {
  constructor(engine) {
    this.e = engine;
    this.g = engine.game;
    this.pools = {};
    for (const k of Object.keys(KINDS)) this.pools[k] = new Pool(k, engine.scene);
    this.inst = new Map(); // id → {parts:[{pool, idx, base: Color, part}], anim:[]}
    this.animated = new Map(); // id → Object3D
    this.tint = null;
    this.m4 = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e3 = new THREE.Euler();
    this.v = new THREE.Vector3();
    this.s = new THREE.Vector3();
    this.c = new THREE.Color();
    this.emitters = new Map(); // id → [{x,y,z,type}]
    this.constructing = new Set();
    this.protoMgr = new ProtoManager(engine.scene);
    this.protoInst = new Map(); // id → {proto, slot, b}
    for (const b of this.g.buildings.values()) this.add(b);
  }

  origin(b) {
    const g = this.g;
    return [b.x + b.w / 2 - g.W / 2, b.y + b.h / 2 - g.H / 2];
  }

  add(b) {
    this.remove(b);
    if (this.addProto(b)) return;
    const parts = composeBuilding(b);
    const rec = { parts: [], b };
    const [ox, oz] = this.origin(b);
    const rot = b.zone ? b.rot * (Math.PI / 2) : 0;
    const cosR = Math.cos(rot), sinR = Math.sin(rot);
    const em = [];
    for (const p of parts) {
      const pool = this.pools[p.k];
      const idx = pool.alloc();
      if (idx < 0) continue;
      // Service-Gebäude mit gedrehtem Grundriss: Teile vertauschen x/z
      let lx = p.x, lz = p.z, sx = p.sx, sz = p.sz, ry = p.ry || 0;
      if (!b.zone && b.rot % 2 === 1 && BUILDINGS[b.key] && BUILDINGS[b.key].size[0] !== BUILDINGS[b.key].size[1]) {
        [lx, lz] = [lz, -lx];
        ry += Math.PI / 2;
      }
      const wx = ox + lx * cosR + lz * sinR;
      const wz = oz - lx * sinR + lz * cosR;
      const part = { ...p, wx, wz, ry: ry + rot, sx, sz };
      const base = new THREE.Color(p.c);
      rec.parts.push({ pool, idx, base, part });
      if (p.smoke || p.steam) em.push({ x: wx, y: p.y + p.sy, z: wz, type: p.steam ? 'steam' : 'smoke', amount: p.smoke || 1 });
    }
    this.inst.set(b.id, rec);
    if (em.length) this.emitters.set(b.id, em);
    this.addAnimated(b);
    this.update(b);
  }

  addAnimated(b) {
    const [ox, oz] = this.origin(b);
    let obj = null;
    if (b.key === 'wind') {
      obj = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0xf6f7f7, roughness: 0.6 });
      for (let k = 0; k < 3; k++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.75, 0.015), mat);
        blade.position.y = 0.36;
        const pivot = new THREE.Group();
        pivot.rotation.z = (k * Math.PI * 2) / 3;
        pivot.add(blade);
        obj.add(pivot);
      }
      obj.position.set(ox, 2.13, oz + 0.07);
      obj.userData.spin = { axis: 'z', speed: 2.2 };
    } else if (b.key === 'ferris') {
      obj = new THREE.Group();
      const ringMat = new THREE.MeshStandardMaterial({ color: 0xf5f3ef, roughness: 0.5 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.035, 6, 32), ringMat);
      obj.add(ring);
      const cols = [0xe8543f, 0x2f8fe0, 0xf2b01e, 0x22a866, 0x8f5ad8, 0xf06fae];
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.85, 0.02), ringMat);
        sp.position.set(Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0);
        sp.rotation.z = a - Math.PI / 2;
        obj.add(sp);
        const cab = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 0.12), new THREE.MeshStandardMaterial({ color: cols[k % 6], emissive: cols[k % 6], emissiveIntensity: 0.15 }));
        cab.position.set(Math.cos(a) * 0.85, Math.sin(a) * 0.85, 0);
        obj.add(cab);
      }
      const legs = new THREE.Group();
      for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.15, 0.05), ringMat);
        leg.position.set(s * 0.3, 0.55, 0);
        leg.rotation.z = s * 0.28;
        legs.add(leg);
      }
      legs.position.set(ox, 0, oz);
      this.e.scene.add(legs);
      obj.userData.extra = legs;
      obj.position.set(ox, 1.1, oz);
      obj.userData.spin = { axis: 'z', speed: 0.25 };
    } else if (b.key === 'doener') {
      obj = new THREE.Group();
      const spit = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.13, 0.38, 10), new THREE.MeshStandardMaterial({ color: 0xa8683a, roughness: 0.9 }));
      spit.position.y = 0.19;
      obj.add(spit);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.48, 4), new THREE.MeshStandardMaterial({ color: 0xbbbbbb }));
      rod.position.y = 0.22;
      obj.add(rod);
      obj.position.set(ox, 0.56, oz - 0.15);
      obj.userData.spin = { axis: 'y', speed: 1.1 };
    } else if (b.key === 'lighthouse') {
      obj = new THREE.Group();
      const beam = new THREE.Mesh(new THREE.ConeGeometry(0.4, 3.2, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      beam.rotation.z = Math.PI / 2;
      beam.position.x = 1.6;
      obj.add(beam);
      obj.position.set(ox, 2.09, oz);
      obj.userData.spin = { axis: 'y', speed: 0.9 };
      obj.userData.nightOnly = beam;
    }
    if (obj) {
      obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
      this.e.scene.add(obj);
      this.animated.set(b.id, obj);
    }
  }

  // Prototyp-Pfad: Modell aus dem Architektur-Register, instanziert
  addProto(b) {
    const key = archKeyFor(b);
    const def = BUILDINGS[b.key];
    const [fw, fd] = frontFootprint(b, def && def.size);
    const proto = this.protoMgr.get(key, b.level || 1, b.variant, fw, fd, { zone: b.zone, spec: b.spec });
    if (!proto) return false;
    const slot = this.protoMgr.alloc(proto);
    const rec = { proto, slot, b };
    this.protoInst.set(b.id, rec);
    const [ox, oz] = this.origin(b);
    const rot = this.protoRot(b);
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const em = proto.emitters.map((e) => ({ x: ox + e.x * cs + e.z * sn, y: e.y, z: oz - e.x * sn + e.z * cs, type: e.type, amount: e.amount || 1 }));
    if (em.length) this.emitters.set(b.id, em);
    this.addAnimated(b);
    this.update(b);
    return true;
  }
  protoRot(b) {
    if (b.zone) return b.rot * (Math.PI / 2);
    return (b.rot || 0) * (Math.PI / 2);
  }
  heightOf(b) {
    const r = this.protoInst.get(b.id);
    return r ? r.proto.height : null;
  }

  remove(b) {
    const pr = this.protoInst.get(b.id);
    if (pr) { this.protoMgr.release(pr.proto, pr.slot); this.protoInst.delete(b.id); }
    const rec = this.inst.get(b.id);
    if (rec) {
      for (const p of rec.parts) p.pool.release(p.idx);
      this.inst.delete(b.id);
    }
    this.emitters.delete(b.id);
    this.constructing.delete(b.id);
    const a = this.animated.get(b.id);
    if (a) {
      this.e.scene.remove(a);
      if (a.userData.extra) this.e.scene.remove(a.userData.extra);
      this.animated.delete(b.id);
    }
  }

  // Matrizen und Farben eines Gebäudes aktualisieren (Bauzustand, verlassen, Brand, Einfärbung)
  update(b) {
    const pr = this.protoInst.get(b.id);
    if (pr) {
      const building = b.construct < 1;
      if (building) this.constructing.add(b.id); else this.constructing.delete(b.id);
      const ys = building ? Math.max(0.04, b.construct) : 1;
      const [ox, oz] = this.origin(b);
      this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.protoRot(b));
      this.v.set(ox, 0, oz);
      this.s.set(1, ys, 1);
      this.m4.compose(this.v, this.q, this.s);
      const tintCol = this.tint ? this.tint(b) : null;
      const c = this.c.setRGB(1, 1, 1);
      if (tintCol) c.copy(tintCol);
      else if (b.abandoned) c.setRGB(0.45, 0.42, 0.4);
      else if (b.burning) c.setRGB(0.4, 0.36, 0.34);
      else if (building) c.setRGB(1.15, 1.1, 1.0);
      this.protoMgr.set(pr.proto, pr.slot, this.m4, c);
      return;
    }
    const rec = this.inst.get(b.id);
    if (!rec) return;
    const prog = b.construct;
    const building = prog < 1;
    if (building) this.constructing.add(b.id); else this.constructing.delete(b.id);
    const ys = building ? Math.max(0.04, prog) : 1;
    const tintCol = this.tint ? this.tint(b) : null;
    for (const p of rec.parts) {
      const pt = p.part;
      this.e3.set(pt.tilt || 0, pt.ry, 0, 'YXZ');
      this.q.setFromEuler(this.e3);
      this.v.set(pt.wx, pt.y * ys, pt.wz);
      this.s.set(pt.sx, pt.sy * ys, pt.sz);
      this.m4.compose(this.v, this.q, this.s);
      const c = this.c.copy(p.base);
      if (tintCol) c.copy(tintCol);
      else if (b.abandoned) c.lerp(new THREE.Color(0x6e675f), 0.65);
      else if (b.burning) c.lerp(new THREE.Color(0x2a2522), 0.5);
      else if (building) c.lerp(new THREE.Color(0xf3ead6), 0.55);
      const win = b.abandoned || building || tintCol ? 0 : pt.w;
      p.pool.set(p.idx, this.m4, c, win);
    }
  }

  setTint(fn) {
    this.tint = fn;
    for (const rec of this.inst.values()) this.update(rec.b);
  }

  frame(dt, time, night) {
    for (const id of this.constructing) {
      const b = this.g.buildings.get(id);
      if (b) this.update(b);
    }
    for (const obj of this.animated.values()) {
      const sp = obj.userData.spin;
      if (sp) obj.rotation[sp.axis] += dt * sp.speed;
      if (obj.userData.nightOnly) obj.userData.nightOnly.visible = night > 0.3;
    }
    for (const p of Object.values(this.pools)) p.flush();
    this.protoMgr.flush();
  }
}

export function stationHeight() { return TRANSIT.trackHeight; }
