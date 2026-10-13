// Fahrzeuge und Pulsbahn (Besitzer: G10).
// VehicleView: Straßenautos aus g.traffic.cars und alle beweglichen Objekte der Systeme (g.renderables(), Vertrag 6.3),
//   instanziert mit drei Detailstufen, Scheinwerfer/Rücklichter/Blaulicht/Blinker, Lichtkegel auf der Straße bei Nacht,
//   Sattelzüge mit nachlaufendem Auflieger.
// TransitView: Pulsbahn – Hochbahn-Trassen auf Pfeilern, Stationen, Züge aus Führerstands- und Mittelwagen, Fahrgäste.
import * as THREE from 'three';
import { TRANSIT, T, R } from '../config.js';
import { VT } from '../sim/traffic.js';
import { LINE_COLORS, linePose } from '../sim/transit.js';
import { MODELS, vehicleGeometry, carPaint, carType } from './vehicles_models.js';
import { VKit, P, F, VU, Batch, GlowPoints, getVehicleMaterial, hashf, lin } from './vehicles_kit.js';
import { ARCH, buildArch } from './arch/index.js';
import { getMaterial } from './matlib.js';

const QUAL = { low: 0.65, medium: 1, high: 1.3, ultra: 1.6 };
const _c = new THREE.Color();

// ---------------------------------------------------------------- Flotte: Stapel je Modell und Detailstufe
export class Fleet {
  constructor(engine, o = {}) {
    this.e = engine;
    this.parent = engine.scene;
    this.mat = getVehicleMaterial();
    this.batches = new Map();
    this.list = [];
    const q = QUAL[engine.settings && engine.settings.quality] ?? 1;
    this.near2 = (o.near ?? 11 * q) ** 2;
    this.mid2 = (o.mid ?? 46 * q) ** 2;
    this.frustum = new THREE.Frustum();
    this.pm = new THREE.Matrix4();
    this.sph = new THREE.Sphere();
    this.cam = new THREE.Vector3();
    this.lastLod = 0;
  }
  batch(id, lod) {
    const key = id + '|' + lod;
    let b = this.batches.get(key);
    if (!b) {
      const src = vehicleGeometry(id, lod === 0 ? 2 : lod);
      if (!src) return null;
      const geo = src.clone();
      geo.userData.triangles = src.userData.triangles;
      b = new Batch(this.parent, geo, this.mat, { shadow: lod >= 1 && !id.startsWith('far_'), cap: 16 });
      this.batches.set(key, b);
      this.list.push(b);
    }
    return b;
  }
  begin() {
    const cam = this.e.camera;
    cam.updateMatrixWorld();
    this.cam.setFromMatrixPosition(cam.matrixWorld);
    this.pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.pm);
    for (const b of this.list) b.begin();
  }
  // Gibt den quadrierten Kameraabstand zurück oder -1 (außerhalb des Bildes)
  add(id, x, y, z, yaw, pitch, roll, col, seed, flags, pal = 0, sz = 1, uni = false) {
    const m = MODELS[id];
    if (!m) return -1;
    this.sph.center.set(x, y + m.hei * 0.5, z);
    const sw = uni ? sz : 1;
    this.sph.radius = Math.max(m.len * sz, m.wid * sw, m.hei * sw) * 0.6 + 0.15;
    if (!this.frustum.intersectsSphere(this.sph)) return -1;
    const dx = x - this.cam.x, dy = y - this.cam.y, dz = z - this.cam.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    const lod = d2 < this.near2 ? 2 : d2 < this.mid2 ? 1 : 0;
    this.lastLod = lod;
    _c.setHex(col);
    if (lod === 0 && m.far) {
      const b = this.batch('far_' + m.far, 0);
      if (b) b.push(x, y, z, yaw, pitch, roll, m.wid * sw, m.hei * sw, m.len * sz, _c.r, _c.g, _c.b, seed, flags, pal);
    } else {
      const b = this.batch(id, Math.max(1, lod));
      if (b) b.push(x, y, z, yaw, pitch, roll, sw, sw, sz, _c.r, _c.g, _c.b, seed, flags, pal);
    }
    return d2;
  }
  end() { for (const b of this.list) b.finish(); }
  stats() {
    let draws = 0, tris = 0, inst = 0;
    for (const b of this.list) if (b.n) { draws++; tris += b.n * b.triangles; inst += b.n; }
    return { draws, tris, inst };
  }
}

// ---------------------------------------------------------------- Lichtkegel der Scheinwerfer
function beamGeometry() {
  const g = new THREE.BufferGeometry();
  const nW = 0.075, fW = 0.32, L = 0.95;
  const pos = [-nW, 0, 0, nW, 0, 0, fW, 0, L, -fW, 0, L];
  const uv = [0, 0, 1, 0, 1, 1, 0, 1];
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  g.userData.triangles = 2;
  return g;
}
function beamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uI: VU.uLights },
    vertexShader: `
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 p = vec4(position, 1.0);
#ifdef USE_INSTANCING
  p = instanceMatrix * p;
#endif
  gl_Position = projectionMatrix * modelViewMatrix * p;
}`,
    fragmentShader: `
uniform float uI;
varying vec2 vUv;
void main() {
  float along = vUv.y;
  float across = abs(vUv.x - 0.5) * 2.0;
  float a = pow(1.0 - along, 1.6) * smoothstep(1.0, 0.25, across) * smoothstep(0.0, 0.1, along) * uI * 0.32;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vec3(1.0, 0.88, 0.66), a);
}`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
}

// ---------------------------------------------------------------- Fahrzeug-Arten der Systeme (6.3)
const ONE = (id) => () => id;
const KIND = {
  car: (r, u) => carType(u),
  van: (r, u) => (u < 0.5 ? 'van' : 'van_box'),
  truck: (r, u) => (r.freight ? (u < 0.75 ? 'truck_box' : 'tanker') : u < 0.6 ? 'truck_box' : 'tanker'),
  bus: ONE('bus'), tram: ONE('tram'), taxi: ONE('taxi'),
  police: (r, u) => (u < 0.8 ? 'police' : 'police_van'),
  fire: (r, u) => (u < 0.75 ? 'fire' : 'fire_ladder'),
  ambulance: ONE('ambulance'), garbage: ONE('garbage'), hearse: ONE('hearse'), snowplow: ONE('snowplow'), tanker: ONE('tanker'),
  train_loco: (r) => (r.len && r.len < 0.85 ? 'train_power_s' : r.len && r.len < 1.4 ? 'train_loco_s' : 'train_loco'),
  train_wagon: (r) => (r.len && r.len < 1.3 ? 'train_wagon_s' : 'train_wagon'),
  cargo_wagon: (r, u) => (u < 0.45 ? 'cargo_container' : u < 0.7 ? 'cargo_box' : u < 0.85 ? 'cargo_tank' : 'cargo_hopper') + (r.len && r.len < 1.3 ? '_s' : ''),
  ship_cargo: (r) => (r.len && r.len < 3.5 ? 'ship_barge' : 'ship_cargo'), ferry: ONE('ferry'), boat: ONE('boat'), sailboat: ONE('sailboat'), plane: ONE('plane'),
  helicopter: ONE('helicopter'), ship_cruise: ONE('ship_cruise'), metro: ONE('metro_mid'), minibus: ONE('minibus'),
};
const KIND_COLOR = {
  bus: 0xd9472f, tram: 0xc8342b, train_loco: 0xc1121c, train_wagon: 0xc1121c, ship_cargo: 0x1f3b63, ferry: 0x2f6db3,
  ship_cruise: 0x1f3b63, plane: 0x2f6db3, helicopter: 0xd8261c, boat: 0x2f6db3, sailboat: 0x1f3b63, cargo_wagon: 0x2f6db3,
  truck: 0xf2f2ee, van: 0xf2f2ee, tanker: 0xf2f2ee, metro: 0xe8543f, minibus: 0xf2f2ee, taxi: 0xe9dcb8,
};
const EMERGENCY = { police: 1, fire: 1, ambulance: 1 };
const AMBERS = { garbage: 1, snowplow: 1 };
const RAILK = { train_loco: 1, train_wagon: 1, cargo_wagon: 1, tram: 1, metro: 1 };
const SCALABLE = { tram: 1, train_loco: 1, train_wagon: 1, cargo_wagon: 1, metro: 1 };
const UNIFORM = { plane: 1, ferry: 1, ship_cruise: 1, ship_cargo: 1, boat: 1, sailboat: 1, helicopter: 1 };
const TRUCK_CABS = [0xf2f2ee, 0xf2f2ee, 0xb8302a, 0x22406e, 0x3a3f45, 0xe8b52c, 0x2f7a4f, 0x6f747a, 0x8a3c2e];
const BOX_PAL = [0, 0, 0, 0, 1, 1, 6, 2, 3, 4, 5, 7];

// Lichtpositionen (lokal) → Welt
function toWorld(out, lx, ly, lz, x, y, z, cy, sy, cp, sp) {
  // Ry(yaw) * Rx(pitch)
  const yy = ly * cp - lz * sp;
  const zz = ly * sp + lz * cp;
  out[0] = x + lx * cy + zz * sy;
  out[1] = y + yy;
  out[2] = z - lx * sy + zz * cy;
  return out;
}

export class VehicleView {
  constructor(engine) {
    this.e = engine;
    this.g = engine.game;
    this.fleet = new Fleet(engine);
    this.glow = new GlowPoints(engine.scene, 9000);
    this.beams = new Batch(engine.scene, beamGeometry(), beamMaterial(), { shadow: false, receive: false, cap: 256, renderOrder: 3 });
    this.hist = new Map();
    this.frameNo = 0;
    this.v3 = [0, 0, 0];
    this.warned = false;
    this.glowR2 = (70 * (QUAL[engine.settings && engine.settings.quality] ?? 1)) ** 2;
    // S3: G10 zeichnet alle Arten aus renderables selbst (Platzhalter entfallen)
    this.drawsRenderables = true;
    this.tramLast = new Map();
  }

  // Fahrbahnhöhe an Rasterposition (gx, gz in Feldern), mit weichen Rampen zu Brücken
  roadY(gx, gz) {
    const g = this.g, W = g.W, H = g.H;
    const rv = this.e.roads;
    if (rv && typeof rv.surfaceY === 'function') return rv.surfaceY(gx - W / 2, gz - H / 2);
    const ix = Math.floor(gx), iz = Math.floor(gz);
    const th = (x, z) => {
      if (x < 0 || z < 0 || x >= W || z >= H) return 0.012;
      const i = z * W + x;
      if (!g.road[i]) return null;
      return g.world.terrain[i] === T.WATER ? 0.24 : 0.012;
    };
    const h0 = th(ix, iz) ?? 0.012;
    const fx = gx - ix - 0.5, fz = gz - iz - 0.5;
    let y = h0;
    const hx = th(ix + (fx > 0 ? 1 : -1), iz), hz = th(ix, iz + (fz > 0 ? 1 : -1));
    if (hx !== null && hx !== h0) { const w = smooth(0.15, 0.5, Math.abs(fx)) * 0.5; y += (hx - h0) * w; }
    if (hz !== null && hz !== h0) { const w = smooth(0.15, 0.5, Math.abs(fz)) * 0.5; y += (hz - h0) * w; }
    return y;
  }

  updateLights(night) {
    const w = this.g.ext && this.g.ext.weather;
    let L = smooth(0.12, 0.45, night);
    if (w) L = Math.max(L, (w.fog || 0) * 0.9, (w.rain || 0) * 0.6, (w.snow || 0) * 0.6, w.storm ? 0.7 : 0, (w.cloud || 0) > 0.85 ? 0.3 : 0);
    VU.uLights.value = L;
    VU.uEnv.value = this.e.scene.environment ? 1 : 0;
    return L;
  }

  frame(time, night, lights) {
    void lights;
    const g = this.g;
    this.frameNo++;
    const L = this.updateLights(night);
    this.L = L;
    this.time = time;
    this.night = night;
    this.fleet.begin();
    this.glow.begin();
    this.beams.begin();
    const cars = g.traffic.cars;
    for (let i = 0; i < cars.length; i++) this.drawCar(cars[i]);
    let list = null;
    try { list = g.renderables ? g.renderables() : null; } catch (e) { if (!this.warned) { console.error('renderables fehlgeschlagen', e); this.warned = true; } }
    if (list) {
      this.tramLast.clear();
      for (const r of list) if (r.kind === 'tram' && r.segment !== undefined && r.id !== undefined) { const key = Math.floor(r.id / 4); this.tramLast.set(key, Math.max(this.tramLast.get(key) || 0, r.segment)); }
      for (let i = 0; i < list.length; i++) this.drawRenderable(list[i], i);
    }
    // Lichter der Pulsbahn (aus dem letzten Bild)
    const tv = this.e.transit;
    if (tv && tv.glowList && L > 0.05) for (const q of tv.glowList) this.glow.add(q[0], q[1], q[2], q[3], q[4], q[5], q[6], q[7] * L);
    this.fleet.end();
    this.beams.finish();
    this.glow.end(this.e.renderer);
    if (this.frameNo % 120 === 0) for (const [id, h] of this.hist) if (h.seen < this.frameNo - 10) this.hist.delete(id);
  }

  // Licht-Glanz und Lichtkegel für ein Fahrzeug
  lightsFor(m, x, y, z, yaw, pitch, d2, flags, seed, sz = 1) {
    const L = this.L;
    const beacon = (flags & F.BEACON) !== 0;
    if (L < 0.08 && !beacon && !(flags & F.BRAKE)) return;
    if (d2 > this.glowR2) return;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const v = this.v3, G = this.glow;
    // Lichter wachsen mit dem Abstand, damit nächtliche Verkehrsströme aus der Ferne lesbar bleiben
    const grow = 1 + Math.sqrt(d2) * 0.045;
    if (L >= 0.08) {
      for (const h of m.head) for (const s of [1, -1]) {
        toWorld(v, h[0] * s, h[1], h[2] * sz, x, y, z, cy, sy, cp, sp);
        G.add(v[0], v[1], v[2], 0.055 * grow, 1.0, 0.9, 0.72, 0.85 * L);
      }
      for (const t of m.tail) for (const s of [1, -1]) {
        toWorld(v, t[0] * s, t[1], t[2] * sz, x, y, z, cy, sy, cp, sp);
        G.add(v[0], v[1], v[2], 0.04 * grow, 1.0, 0.08, 0.04, (flags & F.BRAKE ? 0.95 : 0.65) * L);
      }
      if (m.beam && m.head.length && d2 < this.fleet.mid2) {
        const hz = m.head[0][2] * sz;
        this.beams.push(x + sy * hz, y + 0.004, z + cy * hz, yaw, pitch, 0, m.wid / 0.18, 1, 1 + (m.wid - 0.18) * 1.5, 1, 1, 1, 0, 0);
      }
    } else if (flags & F.BRAKE) {
      for (const t of m.tail) for (const s of [1, -1]) {
        toWorld(v, t[0] * s, t[1], t[2] * sz, x, y, z, cy, sy, cp, sp);
        G.add(v[0], v[1], v[2], 0.035, 1.0, 0.1, 0.05, 0.25);
      }
    }
    if (beacon) {
      const t = this.time;
      for (const b of m.beacons) {
        const amber = b[3] === 'amber';
        const ph = amber ? t * 6 + seed * 6.2831 : t * 9 + seed * 6.2831 + (b[0] > 0 ? Math.PI : 0);
        const f = Math.pow(Math.max(0, Math.sin(ph)), amber ? 4 : 5);
        if (f < 0.05) continue;
        toWorld(v, b[0], b[1], b[2] * sz, x, y, z, cy, sy, cp, sp);
        if (amber) G.add(v[0], v[1], v[2], 0.16, 1.0, 0.55, 0.08, f * (0.35 + this.night * 0.6));
        else G.add(v[0], v[1], v[2], 0.2, 0.2, 0.42, 1.0, f * (0.45 + this.night * 0.7));
        // nachts färbt das Blaulicht die Straße (Lichtfleck von effects.js, G1)
        const P = this.night > 0.2 && d2 < this.fleet.mid2 && this.e.effects && this.e.effects.pools;
        if (P) P.add(v[0], 0.02, v[2], amber ? 0.3 : 0.38, amber ? 1.0 : 0.22, amber ? 0.55 : 0.4, amber ? 0.1 : 1.0, f * 0.45 * this.night);
      }
    }
  }

  drawCar(c) {
    const g = this.g;
    const id = c.id;
    const seed = hashf(id * 31 + 7);
    let model, col = 0xffffff, pal = 0, flags = 0, trailer = null;
    switch (c.type) {
      case VT.CAR: model = carType(hashf(id * 7 + 1)); col = carPaint(hashf(id * 13 + 5)); break;
      case VT.TRUCK: {
        const u = hashf(id * 17 + 3);
        if (u < 0.42) model = 'truck_box';
        else { model = 'truck_tractor'; trailer = u < 0.72 ? 'trailer_box' : u < 0.86 ? 'trailer_tank' : 'trailer_container'; }
        col = TRUCK_CABS[Math.floor(hashf(id * 5 + 11) * TRUCK_CABS.length)];
        pal = BOX_PAL[Math.floor(hashf(id * 3 + 2) * BOX_PAL.length)];
        break;
      }
      case VT.VAN: model = hashf(id * 19 + 4) < 0.6 ? 'van_box' : 'van'; col = hashf(id * 23) < 0.8 ? 0xf2f2ee : carPaint(hashf(id * 29)); pal = BOX_PAL[Math.floor(hashf(id * 3 + 9) * 6)]; break;
      case VT.FIRE: model = hashf(id * 23 + 1) < 0.75 ? 'fire' : 'fire_ladder'; flags |= F.BEACON; break;
      case VT.POLICE: model = hashf(id * 37 + 2) < 0.8 ? 'police' : 'police_van'; if (hashf(id * 41 + 3) < 0.35) flags |= F.BEACON; break;
      case VT.GARBAGE: model = 'garbage'; flags |= F.BEACON; break;
      default: model = 'car_compact';
    }
    const W = g.W, H = g.H;
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    // Allee und Autobahn: zwei Spuren je Richtung (Versatz nach Fahrzeug-ID)
    let cx = c.x, cz = c.z;
    const p0 = c.path[Math.min(c.piece, c.path.length - 1)];
    const rt = g.road[p0];
    if (rt === R.AVENUE || rt === R.HIGHWAY) {
      const lane = (hashf(id * 53 + 9) < 0.55 ? -1 : 1) * 0.09;
      cx += -fz * lane; cz += fx * lane;
    }
    const gx = cx + W / 2, gz = cz + H / 2;
    const y = this.roadY(gx, gz);
    const yA = this.roadY(gx + fx * 0.16, gz + fz * 0.16), yB = this.roadY(gx - fx * 0.16, gz - fz * 0.16);
    const pitch = -Math.atan2(yA - yB, 0.32);
    // Blinker vor Kurven, Bremslicht im Stau
    const p = c.path, k = c.piece, n = p.length - 1;
    const turnAt = (j) => {
      if (j <= 0 || j >= n) return 0;
      const a = p[j - 1], b = p[j], d = p[j + 1];
      const dx1 = (b % W) - (a % W), dy1 = ((b / W) | 0) - ((a / W) | 0);
      const dx2 = (d % W) - (b % W), dy2 = ((d / W) | 0) - ((b / W) | 0);
      return dx1 * dy2 - dy1 * dx2;
    };
    let tn = turnAt(k);
    if (!tn && c.s > 0.4) tn = turnAt(k + 1);
    if (tn < 0) flags |= F.LEFT; else if (tn > 0) flags |= F.RIGHT;
    const tile = p[Math.min(k, n)];
    if ((g.congestion && g.congestion[tile] > 0.85) || (tn && c.s < 0.3)) flags |= F.BRAKE;
    // Rot an der nächsten Ampel → Bremslicht
    const rv = this.e.roads;
    if (k < n && c.s > 0.35 && rv && typeof rv.signalAt === 'function') {
      const nt = p[k + 1], sig = rv.signalAt(nt);
      if (sig) {
        const alongX = Math.abs(fx) > Math.abs(fz);
        const st = alongX ? sig.ew : sig.ns;
        if (st === 'red' || st === 'yellow' || st === 'redyellow') flags |= F.BRAKE;
      }
    }
    const m = MODELS[model];
    const d2 = this.fleet.add(model, cx, y, cz, c.yaw, pitch, 0, col, seed, flags, pal);
    if (d2 >= 0) this.lightsFor(m, cx, y, cz, c.yaw, pitch, d2, flags, seed);
    if (trailer) this.drawTrailer(c, cx, cz, trailer, y, col, pal, seed, flags);
  }

  // Auflieger folgt der Spur der Zugmaschine
  drawTrailer(c, px0, pz0, trailer, y, col, pal, seed, flags) {
    const cpos = { x: px0, z: pz0 };
    let h = this.hist.get(c.id);
    if (!h) { h = { xs: new Float32Array(48), zs: new Float32Array(48), n: 0, head: -1, seen: 0 }; this.hist.set(c.id, h); }
    h.seen = this.frameNo;
    const N = 48;
    if (h.n === 0 || Math.hypot(cpos.x - h.xs[h.head], cpos.z - h.zs[h.head]) > 0.04) {
      if (h.n > 0 && Math.hypot(cpos.x - h.xs[h.head], cpos.z - h.zs[h.head]) > 1.5) h.n = 0; // Sprung (neue Fahrt)
      h.head = (h.head + 1) % N;
      h.xs[h.head] = cpos.x; h.zs[h.head] = cpos.z;
      h.n = Math.min(N, h.n + 1);
    }
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    const kx = cpos.x - fx * 0.17, kz = cpos.z - fz * 0.17; // Königszapfen
    // Punkt im Abstand S hinter der Zugmaschine entlang der Spur
    const S = 1.2;
    let px = cpos.x, pz = cpos.z, acc = 0, ax = 0, az = 0, found = false;
    for (let j = 0; j < h.n; j++) {
      const idx = (h.head - j + N) % N;
      const qx = h.xs[idx], qz = h.zs[idx];
      const l = Math.hypot(qx - px, qz - pz);
      if (acc + l >= S && l > 1e-6) { const t = (S - acc) / l; ax = px + (qx - px) * t; az = pz + (qz - pz) * t; found = true; break; }
      acc += l; px = qx; pz = qz;
    }
    if (!found) { const rest = S - acc; ax = px - fx * rest; az = pz - fz * rest; }
    let dx = kx - ax, dz = kz - az;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    const tyaw = Math.atan2(dx, dz);
    const tx = kx - dx * 0.56, tz = kz - dz * 0.56;
    const m = MODELS[trailer];
    const d2 = this.fleet.add(trailer, tx, y, tz, tyaw, 0, 0, col, seed, flags & (F.BRAKE | F.LEFT | F.RIGHT), pal);
    if (d2 >= 0) this.lightsFor(m, tx, y, tz, tyaw, 0, d2, flags & F.BRAKE, seed);
  }

  drawRenderable(r, i) {
    const kind = r.kind;
    const pickFn = KIND[kind];
    const u = r.variant !== undefined ? hashf(r.variant * 13 + 1) : hashf((r.id ?? i) * 7 + (kind ? kind.length : 0));
    let model = pickFn ? pickFn(r, u) : (MODELS[kind] ? kind : 'car_compact');
    let yaw = r.yaw || 0;
    let lead = kind === 'train_loco' || kind === 'tram' || !!r.lead;
    // Straßenbahn aus Teilen: 0 = Kopf, letztes = gedrehter Kopf, dazwischen Mittelteile
    if (kind === 'tram' && r.segment !== undefined) {
      const last = this.tramLast.get(r.id !== undefined ? Math.floor(r.id / 4) : -1) ?? 0;
      if (r.segment === 0) model = 'tram_head';
      else if (r.segment === last) { model = 'tram_head'; yaw += Math.PI; lead = false; }
      else { model = 'tram_mid'; lead = false; }
    }
    const m = MODELS[model];
    if (!m) return;
    let col = r.color;
    if (col === undefined || col === null) col = kind === 'car' ? carPaint(hashf((r.id ?? i) * 13 + 5)) : (KIND_COLOR[kind] ?? 0xf2f2ee);
    if (typeof col === 'string') col = parseInt(col.replace('#', ''), 16) || 0xffffff;
    let flags = 0, roll = r.roll || 0;
    const siren = r.siren !== undefined ? !!r.siren : r.lights !== false;
    if ((EMERGENCY[kind] || AMBERS[kind]) && siren) flags |= F.BEACON;
    if (r.lights === true) flags |= F.LIGHTS;
    if (RAILK[kind]) flags |= F.RAIL | (lead ? F.LEAD : 0);
    if (r.brake) flags |= F.BRAKE;
    if (r.wreck) { _c.setHex(col).multiplyScalar(0.5); col = _c.getHex(); roll += 0.07; flags |= F.DARK; }
    let sz = 1, uni = false;
    if (r.len) {
      if (UNIFORM[kind]) { sz = r.len / m.len; uni = true; }
      else if (SCALABLE[kind] || (kind === 'bus' && r.len > 1.4)) sz = r.len / m.len;
      if (sz > 0.85 && sz < 1.15 && !uni) sz = 1;
    }
    let y = r.y;
    if (y === undefined || y === null) y = this.roadY(r.x + this.g.W / 2, r.z + this.g.H / 2);
    const pitch = r.pitch || 0;
    const seed = hashf((r.id ?? i) * 31 + 3);
    const pal = r.pal ?? Math.floor(u * 8);
    const d2 = this.fleet.add(model, r.x, y, r.z, yaw, pitch, roll, col, seed, flags, pal, sz, uni);
    if (d2 < 0) return;
    if (!m.rail) this.lightsFor(m, r.x, y, r.z, yaw, pitch, d2, flags, seed, sz);
    else if (this.L > 0.08 && (flags & F.LEAD)) {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      for (const h of m.head) for (const s of [1, -1]) {
        toWorld(this.v3, h[0] * s, h[1], h[2] * sz, r.x, y, r.z, cy, sy, cp, sp);
        this.glow.add(this.v3[0], this.v3[1], this.v3[2], 0.08, 1, 0.92, 0.75, 0.5 * this.L);
      }
    }
  }

  stats() { return this.fleet.stats(); }
}

function smooth(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

// ---------------------------------------------------------------- Pulsbahn
const SHAPE_COLORS = { 1: 0x2d8a4e, 2: 0x2a73c4, 3: 0xc98a14, 4: 0x7b4fc0 };
const CAR_SPACING = 0.54;
const BOGIE = 0.17;

export class TransitView {
  constructor(engine) {
    this.e = engine;
    this.g = engine.game;
    this.group = new THREE.Group();
    engine.scene.add(this.group);
    this.version = -1;
    this.H = TRANSIT.trackHeight;
    this.fleet = new Fleet(engine, { near: 12, mid: 60 });
    this.glowList = [];
    this.mat = getVehicleMaterial();
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
    this.tmpA = { x: 0, z: 0, yaw: 0 };
    this.tmpB = { x: 0, z: 0, yaw: 0 };
    this.m4 = new THREE.Matrix4(); this.p = new THREE.Vector3();
    this.highlightLine = null;
    this.stationMeshes = [];
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
    const k = new VKit(2);
    const CON = 0xe4e1da, CON2 = 0xcfccc4, RAIL = 0x5a5f66;
    // Trassen: Hohlkasten mit Linienstreifen, Schienen, Pfeiler mit Querhaupt
    const girder = [[-0.105, -0.13], [0.105, -0.13], [0.125, -0.04], [0.125, 0.0], [-0.125, 0.0], [-0.125, -0.04]];
    for (const line of tr.lines) {
      const col = LINE_COLORS[line.color];
      for (let s = 0; s < line.pts.length - 1; s++) {
        const [ax, ay] = line.pts[s], [bx, by] = line.pts[s + 1];
        const l = Math.hypot(bx - ax, by - ay);
        if (l < 1e-4) continue;
        const dx = (bx - ax) / l, dy = (by - ay) / l;
        const off = (line.segOffset && line.segOffset[line.pair[s + 1]]) || 0;
        const x0 = ax - dy * off - g.W / 2, z0 = ay + dx * off - g.H / 2;
        const x1 = bx - dy * off - g.W / 2, z1 = by + dx * off - g.H / 2;
        const yaw = Math.atan2(dx, dy);
        k.group({ x: (x0 + x1) / 2, y: H, z: (z0 + z1) / 2, ry: yaw }, () => {
          const hl = l / 2 + 0.11;
          k.extrudeZ(girder, -hl, hl, CON, P.PLASTIC, { edge: (i) => (i === 0 ? { c: CON2, p: P.PLASTIC } : undefined) });
          for (const sd of [1, -1]) k.rectX(sd, 0.1252, -0.035, -0.012, -hl, hl, col, P.STRIPE);
          for (const sd of [1, -1]) k.box(sd * 0.055 - 0.008, 0.0, -hl, sd * 0.055 + 0.008, 0.012, hl, RAIL, P.CHROME, { back: false, front: false });
          for (const sd of [1, -1]) k.box(sd * 0.125 - 0.012, 0.0, -hl, sd * 0.125, 0.03, hl, CON2, P.PLASTIC, { back: false, front: false });
        });
        const np = Math.max(1, Math.round(l / 2.2));
        for (let j = 0; j < np; j++) {
          const t = (j + 0.5) / np;
          const px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t;
          k.group({ x: px, y: 0, z: pz, ry: yaw }, () => {
            k.cyl('y', [0, (H - 0.2) / 2, 0], [0.075, 0.055], H - 0.2, 8, CON, P.PLASTIC, { capA: false });
            k.prism([[-0.07, H - 0.2], [0.07, H - 0.2], [0.07, H - 0.13], [-0.07, H - 0.13]], 0.16, 0.16, CON2, P.PLASTIC, {});
            k.box(-0.11, 0, -0.11, 0.11, 0.04, 0.11, CON2, P.PLASTIC);
          });
        }
      }
    }
    // Stationen
    const useArch = !!ARCH.station;
    const archPlace = [];
    for (const st of tr.stations.values()) {
      const x = st.x + 0.5 - g.W / 2, z = st.y + 0.5 - g.H / 2;
      const ls = tr.lines.filter((l) => l.stops.includes(st.id));
      const yaw = this.stationYaw(st, ls);
      const n = Math.max(1, ls.length);
      if (useArch) archPlace.push([x, z, yaw]);
      else this.buildStation(k, x, z, yaw, n, ls.map((l) => LINE_COLORS[l.color]));
      // Symbol der Zone über dem Dach (Mini-Metro-Lesbarkeit)
      if (st.shape) {
        const geo = st.shape === 1 ? new THREE.CylinderGeometry(0.16, 0.16, 0.05, 20) : st.shape === 2 ? new THREE.CylinderGeometry(0.2, 0.2, 0.05, 3) : new THREE.BoxGeometry(0.26, 0.05, 0.26);
        if (st.shape === 4) geo.rotateY(Math.PI / 4);
        const icon = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.25 }));
        icon.position.set(x, H + 0.53, z);
        const rim = new THREE.Mesh(geo.clone().scale(1.25, 0.8, 1.25), new THREE.MeshStandardMaterial({ color: 0x2e3440, roughness: 0.5 }));
        rim.position.set(x, H + 0.51, z);
        icon.userData.station = st.id;
        this.group.add(rim, icon);
      }
    }
    const geo = k.build();
    const mesh = new THREE.Mesh(geo, this.mat);
    mesh.castShadow = mesh.receiveShadow = true;
    this.group.add(mesh);
    this.trackTris = geo.userData.triangles;
    this.archList = null;
    if (useArch && archPlace.length) this.placeArchStations(archPlace);
    // Ringe
    for (const r of this.rings.values()) this.ringGroup.remove(r);
    this.rings.clear();
  }

  // Richtung der ersten Linie an der Station
  stationYaw(st, ls) {
    const sx = st.x + 0.5, sy = st.y + 0.5;
    for (const line of ls) {
      const pts = line.pts;
      for (let i = 0; i < pts.length; i++) {
        if (Math.abs(pts[i][0] - sx) < 1e-6 && Math.abs(pts[i][1] - sy) < 1e-6) {
          const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
          if (a === b) continue;
          return Math.atan2(b[0] - a[0], b[1] - a[1]);
        }
      }
    }
    return 0;
  }

  // Eigene Hochbahn-Station (wenn kein Architektur-Baustein 'station' registriert ist)
  buildStation(k, x, z, yaw, n, cols) {
    const H = this.H;
    const spread = (n - 1) * 0.15;
    const PL = 0.62; // halbe Bahnsteiglänge
    const CON = 0xe9e6df, ROOF = 0x3a3f47, GLS = 0x9fb8c8, STEEL = 0x8d939a;
    k.group({ x, y: 0, z, ry: yaw }, () => {
      for (const s of [1, -1]) {
        const xi = s * (spread + 0.14), xo = s * (spread + 0.4);
        const x0 = Math.min(xi, xo), x1 = Math.max(xi, xo);
        // Bahnsteig
        k.box(x0, H - 0.02, -PL, x1, H + 0.035, PL, CON, P.PLASTIC, { bottom: { c: 0xbdb9b0 } });
        k.rectY(H + 0.0362, s > 0 ? x0 : x1 - 0.018, s > 0 ? x0 + 0.018 : x1, -PL, PL, 0xf2c21a, P.GLOSS);
        // Stützen unter dem Bahnsteig
        for (const zz of [-0.45, 0.0, 0.45]) k.cyl('y', [(x0 + x1) / 2, (H - 0.02) / 2, zz], 0.035, H - 0.02, 6, CON, P.PLASTIC, { capA: false });
        // Dach auf Stützen
        const xp = s * (spread + 0.385);
        for (const zz of [-0.45, 0.0, 0.45]) k.box(xp - 0.012, H + 0.035, zz - 0.012, xp + 0.012, H + 0.34, zz + 0.012, STEEL, P.CHROME);
        k.box(x0 - 0.03, H + 0.34, -PL - 0.04, x1 + 0.03, H + 0.37, PL + 0.04, ROOF, P.PLASTIC, { bottom: { c: 0xd9d9d4 } });
        // Windschutz aus Glas an der Außenkante
        const xg = s > 0 ? x1 - 0.004 : x0 + 0.004;
        k.rectX(s, Math.abs(xg) + 0.0, H + 0.04, H + 0.3, -PL + 0.05, PL - 0.05, GLS, P.GLASS);
        k.rectX(-s, Math.abs(xg) - 0.006, H + 0.04, H + 0.3, -PL + 0.05, PL - 0.05, GLS, P.GLASS);
        // Bänke, Stationsschild, Lampen
        k.box(s * (spread + 0.32) - 0.03, H + 0.035, -0.2, s * (spread + 0.32) + 0.03, H + 0.075, 0.2, 0x7a5a3a, P.PLASTIC);
        k.box(s * (spread + 0.36) - 0.005, H + 0.22, -0.12, s * (spread + 0.36) + 0.005, H + 0.27, 0.12, 0x1f4f9c, P.GLOSS);
        for (const zz of [-0.3, 0.15]) k.box(s * (spread + 0.27) - 0.03, H + 0.325, zz - 0.06, s * (spread + 0.27) + 0.03, H + 0.335, zz + 0.06, 0xfff1d0, P.LAMP);
      }
      // Linienfarben als Bänder an der Dachkante
      cols.slice(0, 4).forEach((c, i) => {
        for (const s of [1, -1]) k.box(s * (spread + 0.41) - 0.006, H + 0.3 - i * 0.025, -PL, s * (spread + 0.41) + 0.006, H + 0.322 - i * 0.025, PL, c, P.STRIPE);
      });
      // Aufzug (Glas) und Treppenhaus an den Enden, mit Steg zum Bahnsteig
      const zt = PL - 0.02;
      const xa = spread + 0.44;
      k.box(xa, 0.0, zt - 0.14, xa + 0.14, H + 0.3, zt, 0x9fb8c8, P.GLASS);
      k.box(xa - 0.005, H + 0.3, zt - 0.145, xa + 0.145, H + 0.34, zt + 0.005, ROOF, P.PLASTIC);
      k.box(xa - 0.006, 0.0, zt - 0.146, xa + 0.004, H + 0.3, zt - 0.136, STEEL, P.CHROME);
      k.box(xa + 0.136, 0.0, zt - 0.146, xa + 0.146, H + 0.3, zt - 0.136, STEEL, P.CHROME);
      k.box(xa - 0.04, H - 0.02, zt - 0.12, xa, H + 0.035, zt - 0.02, CON, P.PLASTIC);
      const xs = -spread - 0.6;
      k.box(xs, 0.0, -zt, xs + 0.16, H + 0.32, -zt + 0.2, 0xcfcac0, P.PLASTIC);
      for (let yy = 0.3; yy < H; yy += 0.3) k.rectX(-1, -xs + 0.0012, yy, yy + 0.16, -zt + 0.03, -zt + 0.17, 0x7f98a8, P.GLASS);
      k.box(xs + 0.16, H - 0.02, -zt + 0.04, -spread - 0.4, H + 0.035, -zt + 0.16, CON, P.PLASTIC);
      k.box(xs - 0.005, H + 0.32, -zt - 0.005, xs + 0.165, H + 0.35, -zt + 0.205, ROOF, P.PLASTIC);
    });
  }

  // Stationen aus dem Architektur-Baustein von G6 (Modell-z = Fahrtrichtung), drei Detailstufen nach Kameraabstand
  placeArchStations(list) {
    this.archList = list;
    this.archLods = [];
    for (const detail of [2, 1, 0]) {
      let res = null;
      try { res = buildArch('station', 1, 0, 1, 1, { trackHeight: this.H }, detail); } catch (e) { console.warn('Station-Baustein fehlgeschlagen', e); }
      if (!res || !res.meshes) { this.archLods.push(null); continue; }
      const meshes = res.meshes.map((part) => {
        const mesh = new THREE.InstancedMesh(part.geometry, getMaterial(part.material), list.length);
        mesh.castShadow = !mesh.material.transparent;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        mesh.count = 0;
        this.group.add(mesh);
        return mesh;
      });
      this.archLods.push(meshes);
    }
    this.archTimer = 0;
    this.updateArchLods(true);
  }

  updateArchLods(force) {
    if (!this.archList || !this.archLods) return;
    if (!force && --this.archTimer > 0) return;
    this.archTimer = 20;
    const cam = this.e.camera.position;
    const m4 = this.m4, q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const counts = [0, 0, 0];
    for (const [x, z, yaw] of this.archList) {
      const d = Math.hypot(x - cam.x, this.H - cam.y, z - cam.z);
      let lod = d < 16 ? 0 : d < 50 ? 1 : 2;
      while (lod < 2 && !this.archLods[lod]) lod++;
      while (lod > 0 && !this.archLods[lod]) lod--;
      const set = this.archLods[lod];
      if (!set) continue;
      q.setFromAxisAngle(up, yaw); p.set(x, 0, z); m4.compose(p, q, s);
      const i = counts[lod]++;
      for (const mesh of set) mesh.setMatrixAt(i, m4);
    }
    this.archLods.forEach((set, lod) => {
      if (!set) return;
      for (const mesh of set) { mesh.count = counts[lod]; mesh.visible = counts[lod] > 0; mesh.instanceMatrix.needsUpdate = true; }
    });
  }

  frame(time, night) {
    const g = this.g, tr = g.transit;
    if (tr.version !== this.version) this.rebuild();
    this.updateArchLods(false);
    const H = this.H;
    const fl = this.fleet;
    fl.begin();
    const glows = this.glowList;
    glows.length = 0;
    const L = VU.uLights.value;
    // Züge: Wagen einzeln entlang der Strecke, Lage aus beiden Drehgestellen (weiche Kurven)
    for (const t of tr.trains) {
      const line = tr.lines.find((l) => l.id === t.line);
      if (!line || !line.pts.length) continue;
      const cars = 1 + t.wagons;
      const col = LINE_COLORS[line.color];
      for (let kc = 0; kc < cars; kc++) {
        const d = t.d - t.dir * kc * CAR_SPACING;
        const a = linePose(tr, line, d + BOGIE * t.dir, this.tmpA);
        const b = linePose(tr, line, d - BOGIE * t.dir, this.tmpB);
        const x = (a.x + b.x) / 2, z = (a.z + b.z) / 2;
        let yaw = Math.atan2(a.x - b.x, a.z - b.z);
        if (Math.abs(a.x - b.x) + Math.abs(a.z - b.z) < 1e-5) yaw = linePose(tr, line, d, this.tmp).yaw + (t.dir < 0 ? Math.PI : 0);
        let model, flags = F.RAIL, yy = yaw;
        if (cars === 1) { model = 'metro_single'; flags |= F.LEAD; }
        else if (kc === 0) { model = 'metro_cab'; flags |= F.LEAD; }
        else if (kc === cars - 1) { model = 'metro_cab'; yy = yaw + Math.PI; }
        else model = 'metro_mid';
        const seed = hashf(t.id * 13 + kc);
        const d2 = fl.add(model, x, H, z, yy, 0, 0, col, seed, flags, 0);
        // Spitzen- und Schlusslicht-Schein
        if (d2 >= 0 && L > 0.05 && (kc === 0 || kc === cars - 1)) {
          const fx = Math.sin(yaw), fz = Math.cos(yaw);
          if (kc === 0) for (const s of [1, -1]) glows.push([x + fx * 0.252 + fz * s * 0.068, H + 0.058, z + fz * 0.252 - fx * s * 0.068, 0.08, 1, 0.93, 0.78, 0.55]);
          if (kc === cars - 1) for (const s of [1, -1]) glows.push([x - fx * 0.252 + fz * s * 0.1, H + 0.058, z - fz * 0.252 - fx * s * 0.1, 0.05, 1, 0.08, 0.04, 0.5]);
        }
      }
    }
    fl.end();

    // Wartende Fahrgäste über den Stationen
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const st of tr.stations.values()) {
      const x = st.x + 0.5 - g.W / 2, z = st.y + 0.5 - g.H / 2;
      const show = Math.min(st.waiting.length, 24);
      for (let kk = 0; kk < show; kk++) {
        const p = st.waiting[kk];
        const m = this.paxMesh[p.shape];
        const i = counts[p.shape]++;
        if (i >= 1200) continue;
        const col = kk % 6, row = Math.floor(kk / 6);
        this.p.set(x - 0.32 + col * 0.13, H + 0.64 + row * 0.07, z - 0.05);
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
        ring.position.set(x, H + 0.56, z);
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
    void night;
  }

  stats() { return { ...this.fleet.stats(), trackTris: this.trackTris }; }
}

export { lin };
