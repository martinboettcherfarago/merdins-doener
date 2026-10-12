// Prototyp-Bibliothek: Jedes Architekturmodell wird einmal gebaut und dann instanziert gezeichnet.
// Pro (Prototyp, Material) ein InstancedMesh; alle Teile eines Gebäudes teilen sich denselben Slot.
import * as THREE from 'three';
import { getMaterial } from './matlib.js';
import { buildArch } from './arch/all.js';

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class ProtoManager {
  constructor(scene) {
    this.scene = scene;
    this.protos = new Map();
    this.failed = new Set();
    this.dirty = new Set();
  }

  get(key, level, variant, fw, fd, extra) {
    const id = `${key}|${level}|${variant}|${fw}x${fd}`;
    if (this.protos.has(id)) return this.protos.get(id);
    if (this.failed.has(id)) return null;
    let res = null;
    try { res = buildArch(key, level, variant, fw, fd, extra); } catch (e) { console.warn('Architektur-Fehler', id, e); }
    if (!res || !res.meshes || !res.meshes.length) { this.failed.add(id); return null; }
    const proto = { id, height: res.height, emitters: res.emitters || [], lights: res.lights || [], parts: [], capacity: 0, free: [], top: 0, triangles: res.triangles };
    for (const m of res.meshes) proto.parts.push({ geometry: m.geometry, material: getMaterial(m.material), matName: m.material, mesh: null });
    this.grow(proto, 8);
    this.protos.set(id, proto);
    return proto;
  }

  grow(proto, cap) {
    for (const p of proto.parts) {
      const mesh = new THREE.InstancedMesh(p.geometry, p.material, cap);
      mesh.castShadow = !p.material.transparent;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.count = proto.top;
      mesh.setColorAt(0, new THREE.Color(1, 1, 1));
      if (p.mesh) {
        for (let i = 0; i < proto.top; i++) {
          const m = new THREE.Matrix4(), c = new THREE.Color();
          p.mesh.getMatrixAt(i, m); mesh.setMatrixAt(i, m);
          p.mesh.getColorAt(i, c); mesh.setColorAt(i, c);
        }
        this.scene.remove(p.mesh);
        p.mesh.dispose();
      }
      this.scene.add(mesh);
      p.mesh = mesh;
    }
    proto.capacity = cap;
  }

  alloc(proto) {
    if (proto.free.length) return proto.free.pop();
    if (proto.top >= proto.capacity) this.grow(proto, proto.capacity * 2);
    const i = proto.top++;
    for (const p of proto.parts) p.mesh.count = proto.top;
    return i;
  }

  release(proto, slot) {
    for (const p of proto.parts) p.mesh.setMatrixAt(slot, ZERO);
    proto.free.push(slot);
    this.dirty.add(proto);
  }

  set(proto, slot, matrix, color) {
    for (const p of proto.parts) {
      p.mesh.setMatrixAt(slot, matrix);
      if (color) p.mesh.setColorAt(slot, color);
    }
    this.dirty.add(proto);
  }

  flush() {
    for (const proto of this.dirty) for (const p of proto.parts) {
      p.mesh.instanceMatrix.needsUpdate = true;
      if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
    }
    this.dirty.clear();
  }

  stats() {
    let draws = 0, tris = 0, inst = 0;
    for (const proto of this.protos.values()) {
      const live = proto.top - proto.free.length;
      if (live <= 0) continue;
      draws += proto.parts.length;
      tris += proto.triangles * live;
      inst += live;
    }
    return { prototypes: this.protos.size, draws, triangles: tris, instances: inst };
  }
}
