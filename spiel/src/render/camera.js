// Gottperspektive: Schwenken, Drehen, Neigen, Zoomen – weich gedämpft. Besitzer: G1.
// - Zoomabhängige Neigung: nah flacher (Straßenblick), fern steiler (Planansicht). Eigene Neigung des Spielers
//   bleibt als Versatz erhalten.
// - Weiche Kanten: am Kartenrand wird das Schwenken sanft gebremst statt hart gestoppt.
// - Kamera bleibt über dem Gelände (Berge).
// - intro(): Kamerafahrt beim Spielstart; shake(stärke): Wackeln bei Katastrophen.
import * as THREE from 'three';
import { clamp } from '../util.js';

const PMIN = 0.32, PMAX = 1.38;
const smooth = (t) => t * t * (3 - 2 * t);

// Wunsch-Neigung abhängig vom Abstand
export function pitchFor(dist) {
  const t = clamp((Math.log(dist) - Math.log(5)) / (Math.log(150) - Math.log(5)), 0, 1);
  return 0.44 + 0.8 * smooth(t);
}

export class CameraRig {
  constructor(camera, dom, size, game = null) {
    this.camera = camera;
    this.dom = dom;
    this.size = size;
    this.game = game;
    this.target = new THREE.Vector3(0, 0, 0);
    this.goal = { x: 0, z: 0, dist: 34, yaw: 0.7, pitch: 0.95 };
    this.cur = { ...this.goal };
    this.keys = new Set();
    this.drag = null;
    this.minDist = 5;
    this.maxDist = size * 1.5;
    this.enabled = true;
    this.autoRotate = 0;
    this.autoTilt = true;
    this.flight = null;
    this.shakeAmt = 0;
    this.shakeT = 0;
    this._ray = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._listeners = [];
    this.bind();
  }

  listen(el, ev, fn, opts) { el.addEventListener(ev, fn, opts); this._listeners.push([el, ev, fn, opts]); }
  dispose() { for (const [el, ev, fn, opts] of this._listeners) el.removeEventListener(ev, fn, opts); this._listeners = []; }

  // Benutzereingabe beendet die Kamerafahrt
  interrupt() { if (this.flight) this.flight = null; }

  bind() {
    const d = this.dom;
    this.listen(d, 'contextmenu', (e) => e.preventDefault());
    this.listen(d, 'pointerdown', (e) => {
      if (!this.enabled) return;
      if (e.button === 2 || e.button === 1 || (e.button === 0 && e.altKey)) {
        this.interrupt();
        this.drag = { mode: e.button === 2 && !e.shiftKey ? 'pan' : 'rotate', x: e.clientX, y: e.clientY, id: e.pointerId, moved: 0 };
        d.setPointerCapture(e.pointerId);
      }
    });
    this.listen(d, 'pointermove', (e) => {
      if (!this.drag || e.pointerId !== this.drag.id) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag.x = e.clientX; this.drag.y = e.clientY;
      this.drag.moved += Math.abs(dx) + Math.abs(dy);
      if (this.drag.mode === 'pan') this.panScreen(dx, dy);
      else { this.goal.yaw -= dx * 0.006; this.goal.pitch = clamp(this.goal.pitch + dy * 0.005, PMIN, PMAX); }
    });
    const end = (e) => { if (this.drag && e.pointerId === this.drag.id) this.drag = null; };
    this.listen(d, 'pointerup', end);
    this.listen(d, 'pointercancel', end);
    this.listen(d, 'wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.interrupt();
      const f = Math.exp(Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) * 0.0016);
      const before = this.groundAt(e.clientX, e.clientY);
      const nd = clamp(this.goal.dist * f, this.minDist, this.maxDist);
      // zum Mauszeiger hin zoomen
      if (before && f < 1) {
        const k = 1 - nd / this.goal.dist;
        this.goal.x += (before.x - this.goal.x) * k * 0.9;
        this.goal.z += (before.z - this.goal.z) * k * 0.9;
      }
      this.zoomTo(nd);
      this.clampGoal();
    }, { passive: false });
    this.listen(window, 'keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      this.keys.add(e.code);
    });
    this.listen(window, 'keyup', (e) => this.keys.delete(e.code));
    this.listen(window, 'blur', () => this.keys.clear());

    // Touch: zwei Finger zoomen und drehen
    this.touches = new Map();
    this.listen(d, 'pointerdown', (e) => { if (e.pointerType === 'touch') { this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (this.touches.size >= 2) this.interrupt(); } });
    this.listen(d, 'pointermove', (e) => {
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
        if (old > 10) this.zoomTo(clamp(this.goal.dist * (old / Math.max(10, now)), this.minDist, this.maxDist));
        this.goal.yaw += ang - oldAng;
        this.panScreen(mid.x - oldMid.x, mid.y - oldMid.y);
        this.pinching = true;
      } else this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });
    const tend = (e) => { this.touches.delete(e.pointerId); if (this.touches.size < 2) setTimeout(() => (this.pinching = false), 50); };
    this.listen(d, 'pointerup', tend);
    this.listen(d, 'pointercancel', tend);
  }

  // Abstand ändern; die Neigung folgt der Wunschkurve, der eigene Versatz des Spielers bleibt.
  zoomTo(nd) {
    if (this.autoTilt) {
      const off = this.goal.pitch - pitchFor(this.goal.dist);
      this.goal.pitch = clamp(pitchFor(nd) + off, PMIN, PMAX);
    }
    this.goal.dist = nd;
  }

  panScreen(dx, dy) {
    const s = this.cur.dist * 0.0021;
    const cy = Math.cos(this.cur.yaw), sy = Math.sin(this.cur.yaw);
    this.goal.x -= (dx * cy + dy * sy) * s;
    this.goal.z -= (-dx * sy + dy * cy) * s;
    this.clampGoal();
  }

  // Weiche Kante: innerhalb von lim - soft frei, danach zunehmend gebremst (asymptotisch bis lim).
  clampGoal() {
    const lim = this.size / 2 + 4;
    const soft = Math.min(10, lim * 0.25);
    const f = (v) => {
      const a = Math.abs(v);
      if (a <= lim - soft) return v;
      return Math.sign(v) * (lim - soft + soft * Math.tanh((a - (lim - soft)) / soft));
    };
    this.goal.x = f(this.goal.x);
    this.goal.z = f(this.goal.z);
  }

  groundAt(clientX, clientY) {
    const r = this.dom.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this._ray.setFromCamera(v, this.camera);
    const p = new THREE.Vector3();
    return this._ray.ray.intersectPlane(this._plane, p) ? p : null;
  }

  focus(x, z, dist) {
    this.interrupt();
    this.goal.x = x; this.goal.z = z;
    if (dist) this.goal.dist = dist;
    this.clampGoal();
  }

  // Kamerafahrt: aus großer Höhe mit Drehung auf das aktuelle Ziel
  intro(dur = 3.4) {
    const g = this.goal;
    this.flight = {
      t: 0, dur,
      from: { x: g.x * 0.4, z: g.z * 0.4, dist: Math.min(this.maxDist * 1.1, Math.max(g.dist * 3.4, 90)), yaw: g.yaw - 1.25, pitch: 1.3 },
    };
    this.cur = { ...this.flight.from };
  }

  shake(amount) { this.shakeAmt = Math.min(1.5, this.shakeAmt + amount); }

  terrainHeight(x, z) {
    const g = this.game;
    if (!g || !g.world || !g.world.vh) return 0;
    const W = g.W, H = g.H;
    const fx = x + W / 2, fz = z + H / 2;
    if (fx < 0 || fz < 0 || fx > W || fz > H) return -10;
    const ix = Math.min(W - 1, Math.floor(fx)), iz = Math.min(H - 1, Math.floor(fz));
    const tx = fx - ix, tz = fz - iz;
    const vh = g.world.vh, VW = W + 1;
    const a = vh[iz * VW + ix], b = vh[iz * VW + ix + 1], c = vh[(iz + 1) * VW + ix], d = vh[(iz + 1) * VW + ix + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
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
      this.interrupt();
      const cy = Math.cos(this.cur.yaw), sy = Math.sin(this.cur.yaw);
      this.goal.x += (mx * cy + mz * sy) * sp;
      this.goal.z += (-mx * sy + mz * cy) * sp;
      this.clampGoal();
    }
    if (k.has('KeyQ')) { this.interrupt(); this.goal.yaw += dt * 1.6; }
    if (k.has('KeyE')) { this.interrupt(); this.goal.yaw -= dt * 1.6; }
    if (k.has('PageUp')) this.goal.pitch = clamp(this.goal.pitch + dt, PMIN, PMAX);
    if (k.has('PageDown')) this.goal.pitch = clamp(this.goal.pitch - dt, PMIN, PMAX);
    if (k.has('Equal') || k.has('NumpadAdd')) { this.interrupt(); this.zoomTo(clamp(this.goal.dist * (1 - dt * 1.5), this.minDist, this.maxDist)); }
    if (k.has('Minus') || k.has('NumpadSubtract')) { this.interrupt(); this.zoomTo(clamp(this.goal.dist * (1 + dt * 1.5), this.minDist, this.maxDist)); }
    if (this.autoRotate) this.goal.yaw += dt * this.autoRotate;
    if (!this.enabled || this.slow) this.flight = null;

    if (this.flight) {
      const f = this.flight;
      f.t += dt;
      const t = Math.min(1, f.t / f.dur);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      for (const key of ['x', 'z', 'dist', 'yaw', 'pitch']) {
        // Abstand logarithmisch überblenden – wirkt wie ein gleichmäßiger Sinkflug
        if (key === 'dist') this.cur.dist = Math.exp(Math.log(f.from.dist) + (Math.log(this.goal.dist) - Math.log(f.from.dist)) * e);
        else this.cur[key] = f.from[key] + (this.goal[key] - f.from[key]) * e;
      }
      if (t >= 1) this.flight = null;
    } else {
      const a = 1 - Math.exp(-dt * 9);
      for (const key of ['x', 'z', 'dist', 'yaw', 'pitch']) this.cur[key] += (this.goal[key] - this.cur[key]) * a;
    }
    const c = this.cur;
    this.target.set(c.x, 0, c.z);
    const cp = Math.cos(c.pitch);
    this.camera.position.set(c.x + Math.sin(c.yaw) * cp * c.dist, Math.sin(c.pitch) * c.dist, c.z + Math.cos(c.yaw) * cp * c.dist);
    // Nicht in Berge eintauchen
    const th = this.terrainHeight(this.camera.position.x, this.camera.position.z);
    const minY = th + 0.9 + c.dist * 0.04;
    if (this.camera.position.y < minY) this.camera.position.y = minY;
    // Wackeln
    if (this.shakeAmt > 0.001) {
      this.shakeT += dt;
      const s = this.shakeAmt * Math.min(1, c.dist / 30) * 0.35;
      const t = this.shakeT * 27;
      this.camera.position.x += (Math.sin(t * 1.1) + Math.sin(t * 2.3) * 0.5) * s;
      this.camera.position.y += (Math.sin(t * 1.7 + 1) + Math.sin(t * 3.1) * 0.4) * s * 0.6;
      this.camera.position.z += (Math.sin(t * 1.3 + 2) + Math.sin(t * 2.9) * 0.5) * s;
      this.shakeAmt *= Math.exp(-dt * 2.2);
    }
    this.camera.lookAt(this.target);
  }
}
