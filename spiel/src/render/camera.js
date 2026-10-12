// Gottperspektive: Schwenken, Drehen, Neigen, Zoomen – weich gedämpft.
import * as THREE from 'three';
import { clamp } from '../util.js';

export class CameraRig {
  constructor(camera, dom, size) {
    this.camera = camera;
    this.dom = dom;
    this.size = size;
    this.target = new THREE.Vector3(0, 0, 0);
    this.goal = { x: 0, z: 0, dist: 34, yaw: 0.7, pitch: 0.95 };
    this.cur = { ...this.goal };
    this.keys = new Set();
    this.drag = null;
    this.minDist = 6;
    this.maxDist = size * 1.5;
    this.enabled = true;
    this.autoRotate = 0;
    this._ray = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.bind();
  }

  bind() {
    const d = this.dom;
    d.addEventListener('contextmenu', (e) => e.preventDefault());
    d.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      if (e.button === 2 || e.button === 1 || (e.button === 0 && e.altKey)) {
        this.drag = { mode: e.button === 2 && !e.shiftKey ? 'pan' : 'rotate', x: e.clientX, y: e.clientY, id: e.pointerId, moved: 0 };
        d.setPointerCapture(e.pointerId);
      }
    });
    d.addEventListener('pointermove', (e) => {
      if (!this.drag || e.pointerId !== this.drag.id) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag.x = e.clientX; this.drag.y = e.clientY;
      this.drag.moved += Math.abs(dx) + Math.abs(dy);
      if (this.drag.mode === 'pan') this.panScreen(dx, dy);
      else { this.goal.yaw -= dx * 0.006; this.goal.pitch = clamp(this.goal.pitch + dy * 0.005, 0.42, 1.38); }
    });
    const end = (e) => { if (this.drag && e.pointerId === this.drag.id) this.drag = null; };
    d.addEventListener('pointerup', end);
    d.addEventListener('pointercancel', end);
    d.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      const f = Math.exp(Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) * 0.0016);
      const before = this.groundAt(e.clientX, e.clientY);
      const nd = clamp(this.goal.dist * f, this.minDist, this.maxDist);
      // zum Mauszeiger hin zoomen
      if (before && f < 1) {
        const k = 1 - nd / this.goal.dist;
        this.goal.x += (before.x - this.goal.x) * k * 0.9;
        this.goal.z += (before.z - this.goal.z) * k * 0.9;
      }
      this.goal.dist = nd;
      this.clampGoal();
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    // Touch: zwei Finger zoomen und drehen
    this.touches = new Map();
    d.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
    d.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'touch' || !this.touches.has(e.pointerId)) return;
      const prev = [...this.touches.values()];
      if (this.touches.size === 2) {
        const [a, b] = prev;
        const old = Math.hypot(a.x - b.x, a.y - b.y);
        const oldAng = Math.atan2(b.y - a.y, b.x - a.x);
        const oldMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const [c, dd] = [...this.touches.values()];
        const now = Math.hypot(c.x - dd.x, c.y - dd.y);
        const ang = Math.atan2(dd.y - c.y, dd.x - c.x);
        const mid = { x: (c.x + dd.x) / 2, y: (c.y + dd.y) / 2 };
        if (old > 10) this.goal.dist = clamp(this.goal.dist * (old / Math.max(10, now)), this.minDist, this.maxDist);
        this.goal.yaw += ang - oldAng;
        this.panScreen(mid.x - oldMid.x, mid.y - oldMid.y);
        this.pinching = true;
      } else this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });
    const tend = (e) => { this.touches.delete(e.pointerId); if (this.touches.size < 2) setTimeout(() => (this.pinching = false), 50); };
    d.addEventListener('pointerup', tend);
    d.addEventListener('pointercancel', tend);
  }

  panScreen(dx, dy) {
    const s = this.cur.dist * 0.0021;
    const cy = Math.cos(this.cur.yaw), sy = Math.sin(this.cur.yaw);
    this.goal.x -= (dx * cy + dy * sy) * s;
    this.goal.z -= (-dx * sy + dy * cy) * s;
    this.clampGoal();
  }

  clampGoal() {
    const lim = this.size / 2 + 4;
    this.goal.x = clamp(this.goal.x, -lim, lim);
    this.goal.z = clamp(this.goal.z, -lim, lim);
  }

  groundAt(clientX, clientY) {
    const r = this.dom.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this._ray.setFromCamera(v, this.camera);
    const p = new THREE.Vector3();
    return this._ray.ray.intersectPlane(this._plane, p) ? p : null;
  }

  focus(x, z, dist) {
    this.goal.x = x; this.goal.z = z;
    if (dist) this.goal.dist = dist;
    this.clampGoal();
  }

  update(dt) {
    const k = this.keys;
    const sp = this.goal.dist * 1.1 * dt;
    let mx = 0, mz = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) mz -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) mz += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
    if (mx || mz) {
      const cy = Math.cos(this.cur.yaw), sy = Math.sin(this.cur.yaw);
      this.goal.x += (mx * cy + mz * sy) * sp;
      this.goal.z += (-mx * sy + mz * cy) * sp;
      this.clampGoal();
    }
    if (k.has('KeyQ')) this.goal.yaw += dt * 1.6;
    if (k.has('KeyE')) this.goal.yaw -= dt * 1.6;
    if (k.has('PageUp')) this.goal.pitch = clamp(this.goal.pitch + dt, 0.42, 1.38);
    if (k.has('PageDown')) this.goal.pitch = clamp(this.goal.pitch - dt, 0.42, 1.38);
    if (k.has('Equal') || k.has('NumpadAdd')) this.goal.dist = clamp(this.goal.dist * (1 - dt * 1.5), this.minDist, this.maxDist);
    if (k.has('Minus') || k.has('NumpadSubtract')) this.goal.dist = clamp(this.goal.dist * (1 + dt * 1.5), this.minDist, this.maxDist);
    if (this.autoRotate) this.goal.yaw += dt * this.autoRotate;

    const a = 1 - Math.exp(-dt * 9);
    for (const key of ['x', 'z', 'dist', 'yaw', 'pitch']) this.cur[key] += (this.goal[key] - this.cur[key]) * a;
    const c = this.cur;
    this.target.set(c.x, 0, c.z);
    const cp = Math.cos(c.pitch);
    this.camera.position.set(c.x + Math.sin(c.yaw) * cp * c.dist, Math.sin(c.pitch) * c.dist, c.z + Math.cos(c.yaw) * cp * c.dist);
    this.camera.lookAt(this.target);
  }
}
