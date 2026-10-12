// Fahrzeuge (instanziert) und die Pulsbahn: Stationen, Hochbahn-Trassen, Züge, wartende Fahrgäste.
import * as THREE from 'three';
import { TRANSIT } from '../config.js';
import { VT } from '../sim/traffic.js';
import { LINE_COLORS, linePose } from '../sim/transit.js';

function mergeBoxes(list) {
  // list: [sx, sy, sz, x, y, z]
  const pos = [], nor = [];
  for (const [sx, sy, sz, x, y, z] of list) {
    const g = new THREE.BoxGeometry(sx, sy, sz).toNonIndexed();
    g.translate(x, y, z);
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return geo;
}

function mergeRotated(list) {
  // list: [sx, sy, sz, x, y, z, yaw]
  const pos = [], nor = [];
  const m = new THREE.Matrix4();
  for (const [sx, sy, sz, x, y, z, yaw] of list) {
    const g = new THREE.BoxGeometry(sx, sy, sz).toNonIndexed();
    m.makeRotationY(yaw).setPosition(x, y, z);
    g.applyMatrix4(m);
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return geo;
}

const CAR_COLORS = [0xe8543f, 0x2f8fe0, 0xf2f2f0, 0x3b4048, 0xf2b01e, 0x22a866, 0x9aa3ab, 0x8f5ad8, 0xc9c3b6, 0x1f4e79, 0xb5473a, 0xffffff];

export class VehicleView {
  constructor(engine) {
    this.e = engine;
    this.g = engine.game;
    const max = 1400;
    this.max = max;
    const carGeo = mergeBoxes([[0.14, 0.06, 0.26, 0, 0.05, 0], [0.12, 0.05, 0.13, 0, 0.105, -0.015]]);
    const truckGeo = mergeBoxes([[0.15, 0.13, 0.2, 0, 0.09, -0.06], [0.15, 0.09, 0.1, 0, 0.065, 0.11]]);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.2 });
    this.cars = new THREE.InstancedMesh(carGeo, mat, max);
    this.trucks = new THREE.InstancedMesh(truckGeo, mat.clone(), max);
    for (const m of [this.cars, this.trucks]) {
      m.castShadow = true; m.frustumCulled = false; m.count = 0;
      m.setColorAt(0, new THREE.Color(1, 1, 1));
      engine.scene.add(m);
    }
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.p = new THREE.Vector3(); this.s = new THREE.Vector3(1, 1, 1);
    this.c = new THREE.Color();
    this.yAxis = new THREE.Vector3(0, 1, 0);
  }

  frame(time, night, lights) {
    const cars = this.g.traffic.cars;
    let nc = 0, nt = 0;
    const blink = Math.floor(time * 6) % 2 === 0;
    for (const c of cars) {
      const truck = c.type === VT.TRUCK || c.type === VT.GARBAGE;
      const mesh = truck ? this.trucks : this.cars;
      const i = truck ? nt++ : nc++;
      if (i >= this.max) continue;
      this.q.setFromAxisAngle(this.yAxis, c.yaw);
      const r = this.g.road[c.path[Math.min(c.piece, c.path.length - 1)]];
      const y = r && this.g.world.terrain[c.path[Math.min(c.piece, c.path.length - 1)]] === 1 ? 0.24 : 0.012;
      this.p.set(c.x, y, c.z);
      this.m4.compose(this.p, this.q, this.s);
      mesh.setMatrixAt(i, this.m4);
      let col;
      if (c.type === VT.FIRE) col = blink ? 0xff2a1a : 0xd8261c;
      else if (c.type === VT.POLICE) col = blink ? 0x2d6bff : 0xf4f4f4;
      else if (c.type === VT.GARBAGE) col = 0xf28c28;
      else if (c.type === VT.VAN) col = 0xf3efe6;
      else if (c.type === VT.TRUCK) col = [0xd9d4ca, 0x6f7c86, 0xb5473a, 0x2f8fe0][c.color % 4];
      else col = CAR_COLORS[c.color % CAR_COLORS.length];
      this.c.setHex(col);
      mesh.setColorAt(i, this.c);
      // Scheinwerfer bei Nacht
      if (night > 0.25 && lights) {
        const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
        lights.add(c.x + fx * 0.16, y + 0.06, c.z + fz * 0.16, 0.16, 1.0, 0.92, 0.7, 0.55 * night);
        if (c.type === VT.FIRE || c.type === VT.POLICE) lights.add(c.x, y + 0.16, c.z, 0.3, c.type === VT.FIRE ? 1 : 0.2, 0.2, c.type === VT.FIRE ? 0.1 : 1, blink ? 0.9 : 0.2);
      }
    }
    this.cars.count = Math.min(nc, this.max);
    this.trucks.count = Math.min(nt, this.max);
    for (const m of [this.cars, this.trucks]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
}

// ---------- Pulsbahn
const SHAPE_COLORS = { 1: 0x2d8a4e, 2: 0x2a73c4, 3: 0xc98a14, 4: 0x7b4fc0 };

export class TransitView {
  constructor(engine) {
    this.e = engine;
    this.g = engine.game;
    this.group = new THREE.Group();
    engine.scene.add(this.group);
    this.version = -1;
    this.H = TRANSIT.trackHeight;
    // Züge: Köpfe und Waggons
    const carGeo = mergeBoxes([[0.26, 0.2, 0.5, 0, 0.1, 0], [0.22, 0.04, 0.44, 0, 0.22, 0]]);
    this.trainMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.25, emissive: 0x000000 });
    this.trainCars = new THREE.InstancedMesh(carGeo, this.trainMat, 400);
    this.trainCars.castShadow = true;
    this.trainCars.frustumCulled = false;
    this.trainCars.count = 0;
    this.trainCars.setColorAt(0, new THREE.Color(1, 1, 1));
    engine.scene.add(this.trainCars);
    // Fahrgast-Symbole
    const shapes = {
      1: new THREE.CylinderGeometry(0.07, 0.07, 0.03, 14),
      2: new THREE.CylinderGeometry(0.085, 0.085, 0.03, 3),
      3: new THREE.BoxGeometry(0.12, 0.03, 0.12),
      4: (() => { const g = new THREE.BoxGeometry(0.11, 0.03, 0.11); g.rotateY(Math.PI / 4); return g; })(),
    };
    this.paxMesh = {};
    for (const k of [1, 2, 3, 4]) {
      const m = new THREE.InstancedMesh(shapes[k], new THREE.MeshBasicMaterial({ color: SHAPE_COLORS[k] }), 1200);
      m.frustumCulled = false; m.count = 0;
      engine.scene.add(m);
      this.paxMesh[k] = m;
    }
    // Überfüllungs-Ringe (Mini-Metro-Timer)
    this.ringGroup = new THREE.Group();
    engine.scene.add(this.ringGroup);
    this.rings = new Map();
    this.tmp = { x: 0, z: 0, yaw: 0 };
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.p = new THREE.Vector3(); this.s = new THREE.Vector3(1, 1, 1);
    this.c = new THREE.Color();
    this.yAxis = new THREE.Vector3(0, 1, 0);
    this.highlightLine = null;
    this.rebuild();
  }

  rebuild() {
    const g = this.g, tr = g.transit;
    this.version = tr.version;
    for (const o of [...this.group.children]) {
      this.group.remove(o);
      o.traverse((x) => { if (x.geometry) x.geometry.dispose(); });
    }
    const H = this.H;
    const pillarGeo = new THREE.CylinderGeometry(0.05, 0.07, H, 6); pillarGeo.translate(0, H / 2, 0);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.7 });
    const pillars = [];
    // Trassen: pro Linie eine zusammengeführte Geometrie
    for (const line of tr.lines) {
      const col = new THREE.Color(LINE_COLORS[line.color]);
      const beams = [], stripes = [];
      for (let k = 0; k < line.pts.length - 1; k++) {
        const [ax, ay] = line.pts[k], [bx, by] = line.pts[k + 1];
        const l = Math.hypot(bx - ax, by - ay);
        if (l < 1e-4) continue;
        const dx = (bx - ax) / l, dy = (by - ay) / l;
        const off = (line.segOffset && line.segOffset[line.pair[k + 1]]) || 0;
        const x0 = ax - dy * off - g.W / 2, z0 = ay + dx * off - g.H / 2;
        const x1 = bx - dy * off - g.W / 2, z1 = by + dx * off - g.H / 2;
        const yaw = Math.atan2(dx, dy);
        beams.push([0.2, 0.08, l + 0.2, (x0 + x1) / 2, H - 0.04, (z0 + z1) / 2, yaw]);
        stripes.push([0.215, 0.03, l + 0.2, (x0 + x1) / 2, H - 0.085, (z0 + z1) / 2, yaw]);
        const np = Math.max(1, Math.round(l / 2.5));
        for (let j = 0; j < np; j++) {
          const t = (j + 0.5) / np;
          pillars.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]);
        }
      }
      if (!beams.length) continue;
      const beam = new THREE.Mesh(mergeRotated(beams), new THREE.MeshStandardMaterial({ color: 0xf1eee8, roughness: 0.6 }));
      const stripe = new THREE.Mesh(mergeRotated(stripes), new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, emissive: col, emissiveIntensity: 0.25 }));
      beam.castShadow = beam.receiveShadow = true;
      stripe.userData.line = line.id;
      this.group.add(beam, stripe);
    }
    const pm = new THREE.InstancedMesh(pillarGeo, pillarMat, Math.max(1, pillars.length));
    pillars.forEach(([x, z], i) => { this.m4.makeTranslation(x, 0, z); pm.setMatrixAt(i, this.m4); });
    pm.count = pillars.length;
    pm.castShadow = true;
    this.group.add(pm);
    // Stationen
    for (const st of tr.stations.values()) {
      const x = st.x + 0.5 - g.W / 2, z = st.y + 0.5 - g.H / 2;
      const s = new THREE.Group();
      const white = new THREE.MeshStandardMaterial({ color: 0xf7f5f0, roughness: 0.6 });
      const dark = new THREE.MeshStandardMaterial({ color: 0x2e3440, roughness: 0.5 });
      const plat = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.1, 0.86), white);
      plat.position.y = H - 0.12;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.9), dark);
      roof.position.y = H + 0.42;
      s.add(plat, roof);
      for (const [px, pz] of [[-0.36, -0.36], [0.36, -0.36], [-0.36, 0.36], [0.36, 0.36]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, H + 0.42, 6), white);
        leg.position.set(px, (H + 0.42) / 2, pz);
        s.add(leg);
      }
      // Linienfarben als Bänder am Dach
      const ls = tr.lines.filter((l) => l.stops.includes(st.id));
      ls.forEach((l, i) => {
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.035, 0.08), new THREE.MeshStandardMaterial({ color: LINE_COLORS[l.color], emissive: LINE_COLORS[l.color], emissiveIntensity: 0.35 }));
        band.position.set(0, H + 0.38, 0.38 - i * 0.1);
        s.add(band);
      });
      // Stationssymbol (Form der dominanten Zone)
      if (st.shape) {
        const geo = st.shape === 1 ? new THREE.CylinderGeometry(0.16, 0.16, 0.05, 20) : st.shape === 2 ? new THREE.CylinderGeometry(0.2, 0.2, 0.05, 3) : new THREE.BoxGeometry(0.26, 0.05, 0.26);
        if (st.shape === 4) geo.rotateY(Math.PI / 4);
        const icon = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.2 }));
        icon.position.y = H + 0.47;
        const rim = new THREE.Mesh(geo.clone().scale(1.25, 0.8, 1.25), dark);
        rim.position.y = H + 0.45;
        s.add(rim, icon);
      }
      s.position.set(x, 0, z);
      s.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      s.userData.station = st.id;
      this.group.add(s);
    }
    // Ringe
    for (const r of this.rings.values()) this.ringGroup.remove(r);
    this.rings.clear();
  }

  frame(time, night) {
    const g = this.g, tr = g.transit;
    if (tr.version !== this.version) this.rebuild();
    const H = this.H;
    // Züge
    let n = 0;
    for (const t of tr.trains) {
      const line = tr.lines.find((l) => l.id === t.line);
      if (!line) continue;
      const cars = 1 + t.wagons;
      for (let k = 0; k < cars && n < 400; k++) {
        const d = t.d - t.dir * k * 0.54;
        const pose = linePose(tr, line, d, this.tmp);
        this.q.setFromAxisAngle(this.yAxis, pose.yaw);
        this.p.set(pose.x, H, pose.z);
        this.m4.compose(this.p, this.q, this.s);
        this.trainCars.setMatrixAt(n, this.m4);
        this.c.setHex(LINE_COLORS[line.color]);
        if (k > 0) this.c.lerp(new THREE.Color(1, 1, 1), 0.25);
        this.trainCars.setColorAt(n, this.c);
        n++;
      }
    }
    this.trainCars.count = n;
    this.trainCars.instanceMatrix.needsUpdate = true;
    if (this.trainCars.instanceColor) this.trainCars.instanceColor.needsUpdate = true;
    this.trainMat.emissive.setRGB(night * 0.25, night * 0.22, night * 0.15);

    // Wartende Fahrgäste über den Stationen
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const st of tr.stations.values()) {
      const x = st.x + 0.5 - g.W / 2, z = st.y + 0.5 - g.H / 2;
      const show = Math.min(st.waiting.length, 24);
      for (let k = 0; k < show; k++) {
        const p = st.waiting[k];
        const m = this.paxMesh[p.shape];
        const i = counts[p.shape]++;
        if (i >= 1200) continue;
        const col = k % 6, row = Math.floor(k / 6);
        this.p.set(x - 0.32 + col * 0.13, H + 0.58 + row * 0.07, z - 0.05);
        this.m4.makeTranslation(this.p.x, this.p.y, this.p.z);
        m.setMatrixAt(i, this.m4);
      }
      // Ring
      let ring = this.rings.get(st.id);
      if (st.over > 0.02) {
        const segs = 48;
        const prog = Math.min(1, st.over);
        if (!ring) {
          ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.72, segs, 1, 0, Math.PI * 2 * prog), new THREE.MeshBasicMaterial({ color: 0xe8543f, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
          ring.rotation.x = -Math.PI / 2;
          ring.userData.prog = prog;
          this.ringGroup.add(ring);
          this.rings.set(st.id, ring);
        }
        if (Math.abs(ring.userData.prog - prog) > 0.01) {
          ring.geometry.dispose();
          ring.geometry = new THREE.RingGeometry(0.62, 0.72, segs, 1, Math.PI / 2, -Math.PI * 2 * prog);
          ring.userData.prog = prog;
        }
        ring.position.set(x, H + 0.5, z);
        ring.material.opacity = 0.6 + 0.4 * Math.sin(time * 6) ** 2;
      } else if (ring) {
        this.ringGroup.remove(ring);
        ring.geometry.dispose();
        this.rings.delete(st.id);
      }
    }
    for (const k of [1, 2, 3, 4]) {
      this.paxMesh[k].count = Math.min(counts[k], 1200);
      this.paxMesh[k].instanceMatrix.needsUpdate = true;
    }
  }
}
