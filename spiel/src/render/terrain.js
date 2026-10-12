// Gelände als schwebendes Diorama: Kacheln, Berge, Wasser, Erdschichten an den Rändern, Wälder.
import * as THREE from 'three';
import { T, RES, R } from '../config.js';
import { hash2 } from '../util.js';
import { makeWaterMaterial } from './materials.js';

const C = (hex) => new THREE.Color(hex);
const COL = {
  grass: [C(0x9bc887), C(0x93c27f), C(0xa3cd8c), C(0x8fbd7b)],
  fertile: C(0x8fae6a),
  ore: C(0xa69a85),
  sand: C(0xe9dcab),
  rockLow: C(0x9c9184),
  rockHigh: C(0xc4bcb0),
  snow: C(0xf3f1ec),
  bed: C(0x6f8c80),
  bedDeep: C(0x557672),
  rubble: C(0x7d746b),
};

export class TerrainView {
  constructor(engine) {
    this.e = engine;
    this.g = engine.game;
    this.group = new THREE.Group();
    engine.scene.add(this.group);
    this.build();
    this.buildTrees();
  }

  tileColor(i, out) {
    const w = this.g.world;
    const t = w.terrain[i];
    const x = i % this.g.W, y = (i / this.g.W) | 0;
    if (this.g.rubble[i]) return out.copy(COL.rubble);
    if (t === T.SAND) return out.copy(COL.sand).offsetHSL(0, 0, (hash2(x, y, 3) - 0.5) * 0.03);
    if (t === T.WATER) return out.copy(COL.bed);
    const base = COL.grass[Math.floor(hash2(x, y, 1) * 4) % 4];
    out.copy(base);
    if (w.resource[i] === RES.FERTILE) out.lerp(COL.fertile, 0.55);
    else if (w.resource[i] === RES.ORE) out.lerp(COL.ore, 0.45);
    return out.offsetHSL(0, 0, (hash2(x, y, 2) - 0.5) * 0.025);
  }

  build() {
    const g = this.g, w = g.world, W = g.W, H = g.H;
    const VW = W + 1;
    const pos = new Float32Array(W * H * 18);
    const col = new Float32Array(W * H * 18);
    const ox = -W / 2, oz = -H / 2;
    const c = new THREE.Color(), cm = new THREE.Color();
    let p = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const h00 = w.vh[y * VW + x], h10 = w.vh[y * VW + x + 1], h01 = w.vh[(y + 1) * VW + x], h11 = w.vh[(y + 1) * VW + x + 1];
        const tris = [
          [[x, h00, y], [x, h01, y + 1], [x + 1, h11, y + 1]],
          [[x, h00, y], [x + 1, h11, y + 1], [x + 1, h10, y]],
        ];
        this.tileColor(i, c);
        for (const tri of tris) {
          const avgH = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
          let tc = c;
          if (w.terrain[i] === T.ROCK) {
            cm.copy(COL.rockLow).lerp(COL.rockHigh, Math.min(1, avgH / 4));
            if (avgH > 4.3) cm.lerp(COL.snow, Math.min(1, (avgH - 4.3) / 1.2));
            cm.offsetHSL(0, 0, (hash2(x * 2 + (tri === tris[0] ? 0 : 1), y, 9) - 0.5) * 0.06);
            tc = cm;
          } else if (w.terrain[i] === T.WATER) {
            cm.copy(COL.bed).lerp(COL.bedDeep, Math.min(1, -avgH / 1.1));
            tc = cm;
          }
          for (const v of tri) {
            pos[p] = v[0] + ox; pos[p + 1] = v[1]; pos[p + 2] = v[2] + oz;
            col[p] = tc.r; col[p + 1] = tc.g; col[p + 2] = tc.b;
            p += 3;
          }
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    this.colAttr = geo.attributes.color;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
    this.group.add(this.mesh);

    // Wasseroberfläche
    const wgeo = new THREE.PlaneGeometry(W, H, Math.min(128, W), Math.min(128, H));
    const water = new THREE.Mesh(wgeo, makeWaterMaterial());
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.14;
    water.receiveShadow = true;
    water.renderOrder = 1;
    this.group.add(water);
    this.water = water;

    this.buildSlab();
  }

  // Erdschichten an den Kartenrändern + Wasserkanten wie in einem Aquarium.
  buildSlab() {
    const g = this.g, w = g.world, W = g.W, H = g.H, VW = W + 1;
    const ox = -W / 2, oz = -H / 2;
    const bottom = -3.2;
    const pos = [], col = [];
    const wpos = [];
    const layers = [
      [0, C(0x6d8a52)], [-0.25, C(0x7a5f43)], [-1.2, C(0x8c6d4d)], [-2.2, C(0x6b5038)], [bottom, C(0x4f3b2a)],
    ];
    const colAt = (yv) => {
      for (let k = 0; k < layers.length - 1; k++) {
        if (yv >= layers[k + 1][0]) {
          const t = (layers[k][0] - yv) / (layers[k][0] - layers[k + 1][0]);
          return layers[k][1].clone().lerp(layers[k + 1][1], Math.max(0, Math.min(1, t)));
        }
      }
      return layers[layers.length - 1][1].clone();
    };
    const edge = (ax, az, ha, bx, bz, hb, outward) => {
      // Viereck von (a,ha)-(b,hb) bis zum Boden; outward bestimmt die Wicklung
      const quad = [[ax, ha, az], [bx, hb, bz], [bx, bottom, bz], [ax, bottom, az]];
      const order = outward ? [0, 3, 2, 0, 2, 1] : [0, 1, 2, 0, 2, 3];
      for (const k of order) {
        const v = quad[k];
        pos.push(v[0], v[1], v[2]);
        const cc = colAt(v[1] > -0.01 ? 0 : v[1]);
        col.push(cc.r, cc.g, cc.b);
      }
      const wl = -0.14;
      if (ha < wl || hb < wl) {
        const q = [[ax, wl, az], [bx, wl, bz], [bx, Math.min(hb, wl), bz], [ax, Math.min(ha, wl), az]];
        for (const k of order) wpos.push(q[k][0], q[k][1], q[k][2]);
      }
    };
    for (let x = 0; x < W; x++) {
      edge(x + ox, oz, w.vh[x], x + 1 + ox, oz, w.vh[x + 1], false);
      edge(x + ox, H + oz, w.vh[H * VW + x], x + 1 + ox, H + oz, w.vh[H * VW + x + 1], true);
    }
    for (let y = 0; y < H; y++) {
      edge(ox, y + oz, w.vh[y * VW], ox, y + 1 + oz, w.vh[(y + 1) * VW], true);
      edge(W + ox, y + oz, w.vh[y * VW + W], W + ox, y + 1 + oz, w.vh[(y + 1) * VW + W], false);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const slab = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: THREE.DoubleSide }));
    slab.receiveShadow = true;
    this.group.add(slab);
    // Unterseite
    const under = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ color: 0x3e2f22, roughness: 1 }));
    under.rotation.x = Math.PI / 2;
    under.position.y = bottom;
    this.group.add(under);
    if (wpos.length) {
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
      wg.computeVertexNormals();
      const wm = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ color: 0x3f9fb8, transparent: true, opacity: 0.6, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false }));
      this.group.add(wm);
    }
  }

  refreshColors() {
    const g = this.g, W = g.W, H = g.H;
    const col = this.colAttr.array;
    const c = new THREE.Color();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const t = g.world.terrain[i];
      if (t === T.ROCK || t === T.WATER) continue;
      this.tileColor(i, c);
      const base = i * 18;
      for (let k = 0; k < 6; k++) { col[base + k * 3] = c.r; col[base + k * 3 + 1] = c.g; col[base + k * 3 + 2] = c.b; }
    }
    this.colAttr.needsUpdate = true;
  }

  // ---------- Bäume (Wald und Alleen)
  buildTrees() {
    const max = this.g.N * 4 + 4000;
    this.treeMax = max;
    const trunkGeo = new THREE.CylinderGeometry(0.025, 0.04, 0.22, 5); trunkGeo.translate(0, 0.11, 0);
    const leafGeo = new THREE.IcosahedronGeometry(0.17, 0); leafGeo.translate(0, 0.33, 0);
    const pineGeo = new THREE.ConeGeometry(0.15, 0.48, 6); pineGeo.translate(0, 0.42, 0);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
    this.trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x7a5a3e, roughness: 1 }), max);
    this.leaves = new THREE.InstancedMesh(leafGeo, mat, max);
    this.pines = new THREE.InstancedMesh(pineGeo, mat.clone(), max);
    for (const m of [this.trunks, this.leaves, this.pines]) {
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      m.count = 0;
      this.group.add(m);
    }
    this.leaves.setColorAt(0, new THREE.Color(1, 1, 1));
    this.pines.setColorAt(0, new THREE.Color(1, 1, 1));
    this.refreshTrees();
  }

  refreshTrees() {
    const g = this.g, W = g.W, H = g.H;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const c = new THREE.Color();
    const greens = [0x5b9a4f, 0x4f8f4a, 0x6aa95a, 0x447f43, 0x78ad5c];
    const pinesC = [0x3f7a4a, 0x356e43, 0x4a8650];
    let nt = 0, nl = 0, np = 0;
    const add = (x, z, scale, pine, seed) => {
      if (nt >= this.treeMax) return;
      q.setFromAxisAngle(yAxis, seed * 6.28);
      s.set(scale, scale * (0.9 + (seed * 7 % 1) * 0.3), scale);
      p.set(x, 0, z);
      m4.compose(p, q, s);
      this.trunks.setMatrixAt(nt++, m4);
      if (pine) { this.pines.setMatrixAt(np, m4); c.setHex(pinesC[Math.floor(seed * 97) % 3]); this.pines.setColorAt(np++, c); }
      else { this.leaves.setMatrixAt(nl, m4); c.setHex(greens[Math.floor(seed * 89) % 5]); this.leaves.setColorAt(nl++, c); }
    };
    const ox = -W / 2, oz = -H / 2;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const d = g.world.trees[i];
      if (d && !g.bld[i] && !g.road[i]) {
        const n = d + 1;
        for (let k = 0; k < n; k++) {
          const hx = hash2(x, y, 31 + k), hy = hash2(x, y, 71 + k);
          const pine = hash2(x >> 2, y >> 2, 5) > 0.55 ? hash2(x, y, 11 + k) > 0.25 : hash2(x, y, 11 + k) > 0.85;
          add(x + ox + 0.18 + hx * 0.64, y + oz + 0.18 + hy * 0.64, 0.8 + hash2(x, y, 51 + k) * 0.6, pine, hash2(x, y, 91 + k));
        }
      }
      // Alleebäume am Rand der Allee
      if (g.road[i] === R.AVENUE) {
        const horiz = (x > 0 && g.road[i - 1]) || (x < W - 1 && g.road[i + 1]);
        const vert = (y > 0 && g.road[i - W]) || (y < H - 1 && g.road[i + W]);
        if (horiz && !vert) { add(x + ox + 0.5, y + oz + 0.5, 0.55, false, hash2(x, y, 3)); }
        else if (vert && !horiz) { add(x + ox + 0.5, y + oz + 0.5, 0.55, false, hash2(x, y, 4)); }
      }
    }
    this.trunks.count = nt; this.leaves.count = nl; this.pines.count = np;
    for (const m of [this.trunks, this.leaves, this.pines]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
}
