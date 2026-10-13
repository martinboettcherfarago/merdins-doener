// Fahrzeuge und Pulsbahn (Besitzer: G10).
// VehicleView: Straßenautos aus g.traffic.cars und alle beweglichen Objekte der Systeme (g.renderables(), Vertrag 6.3),
//   instanziert mit drei Detailstufen, Scheinwerfer/Rücklichter/Blaulicht/Blinker, Lichtkegel auf der Straße bei Nacht,
//   Sattelzüge mit nachlaufendem Auflieger.
// TransitView: Pulsbahn (U-Bahn) an der Oberfläche – Eingänge, Zielsymbole, wartende Fahrgäste. Tunnel und Züge: underground.js.
import * as THREE from 'three';
import { TRANSIT, T, R } from '../config.js';
import { VT } from '../sim/traffic.js';
import { MODELS, vehicleGeometry, carPaint, carType } from './vehicles_models.js';
import { VKit, P, F, VU, Batch, GlowPoints, getVehicleMaterial, hashf, lin } from './vehicles_kit.js';
import { buildArch } from './arch/index.js';
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
      // Schatten nur in Nahsicht – in mittlerer Entfernung sind sie wenige Pixel groß, kosten aber je Modell einen Draw Call
      b = new Batch(this.parent, geo, this.mat, { shadow: lod >= 2 && !id.startsWith('far_'), cap: 16 });
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

// ---------------------------------------------------------------- Pulsbahn (U-Bahn): Eingänge und Fahrgäste
// Tunnel, Bahnsteighallen und Züge zeichnet render/underground.js (UndergroundView). Hier oben: die U-Bahn-Eingänge
// (Architektur-Baustein 'station': Variante 0 eigener Platz, Variante 1 Abgang auf dem Gehweg) in drei Detailstufen,
// das Zielsymbol und die wartenden Fahrgäste über dem Eingang sowie der Überfüllungs-Ring (Mini-Metro-Timer).
// Symbole liegen in der HUD-Szene: immer lesbar, auch hinter Häusern und in der Untergrund-Ansicht.
const SHAPE_COLORS = { 1: 0x2d8a4e, 2: 0x2a73c4, 3: 0xc98a14, 4: 0x7b4fc0 };
const ICON_Y = 0.6;      // Zielsymbol über der U-Säule
const ICON_Y_HUB = 0.86; // über dem Dach des Umsteigebahnhofs

export class TransitView {
  constructor(engine) {
    this.e = engine;
    this.g = engine.game;
    this.group = new THREE.Group();
    engine.scene.add(this.group);
    this.hud = engine.hud || engine.scene;
    this.iconGroup = new THREE.Group();
    this.hud.add(this.iconGroup);
    this.version = -1;
    this.H = TRANSIT.trackHeight;
    this.glowList = []; // keine Zuglichter mehr an der Oberfläche (Züge fahren im Tunnel)
    this.iconY = new Map();
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
      this.hud.add(m);
      this.paxMesh[k] = m;
    }
    this.iconMats = { face: new THREE.MeshBasicMaterial({ color: 0xffffff }), rim: new THREE.MeshBasicMaterial({ color: 0x2e3440 }) };
    this.iconGeos = {};
    // Überfüllungs-Ringe
    this.ringGroup = new THREE.Group();
    this.hud.add(this.ringGroup);
    this.rings = new Map();
    this.m4 = new THREE.Matrix4(); this.p = new THREE.Vector3();
    this.highlightLine = null;
    this.stationMeshes = [];
    this.archGroup = new THREE.Group();
    this.group.add(this.archGroup);
    this.archCache = new Map();
    this.archMeshes = [];
    this.archSets = [];
    this.rebuild();
  }

  iconGeo(shape) {
    if (!this.iconGeos[shape]) {
      const geo = shape === 1 ? new THREE.CylinderGeometry(0.16, 0.16, 0.05, 20) : shape === 2 ? new THREE.CylinderGeometry(0.2, 0.2, 0.05, 3) : new THREE.BoxGeometry(0.26, 0.05, 0.26);
      if (shape === 4) geo.rotateY(Math.PI / 4);
      this.iconGeos[shape] = { face: geo, rim: geo.clone().scale(1.25, 0.8, 1.25) };
    }
    return this.iconGeos[shape];
  }

  isHub(st) {
    const g = this.g;
    const b = g.buildings.get(g.bld[st.y * g.W + st.x]);
    return !!(b && b.key === 'metro_hub');
  }

  rebuild() {
    const g = this.g, tr = g.transit;
    this.version = tr.version;
    for (const o of [...this.iconGroup.children]) this.iconGroup.remove(o);
    const lists = [[], [], []];
    this.iconY.clear();
    for (const st of tr.stations.values()) {
      const x = st.x + 0.5 - g.W / 2, z = st.y + 0.5 - g.H / 2;
      const hub = this.isHub(st);
      const base = hub ? ICON_Y_HUB : ICON_Y;
      this.iconY.set(st.id, base);
      if (!hub) {
        const onRoad = g.road[st.y * g.W + st.x] > 0;
        const ls = tr.lines.filter((l) => l.stops.includes(st.id));
        const [v, yaw] = this.entrance(st, onRoad, ls);
        lists[v].push([x, z, yaw]);
      }
      // Zielsymbol (Mini-Metro-Lesbarkeit)
      if (st.shape) {
        const geo = this.iconGeo(st.shape);
        const icon = new THREE.Mesh(geo.face, this.iconMats.face);
        icon.position.set(x, base + 0.02, z);
        icon.userData.station = st.id;
        const rim = new THREE.Mesh(geo.rim, this.iconMats.rim);
        rim.position.set(x, base, z);
        this.iconGroup.add(rim, icon);
      }
    }
    this.placeArch(lists);
    for (const r of this.rings.values()) { this.ringGroup.remove(r); r.geometry.dispose(); }
    this.rings.clear();
  }

  // Variante und Drehung des Eingangs: Platz (Treppe öffnet sich zur Straße), Gehweg (Abgang auf der straßenfreien
  // Seite) oder Kreuzung (Abgang auf der Gehweg-Ecke, bevorzugt zur bebauten Ecke)
  entrance(st, onRoad, ls) {
    const g = this.g, W = g.W, H = g.H;
    const rd = (x, y) => x >= 0 && y >= 0 && x < W && y < H && g.road[y * W + x] > 0;
    const dirs = [[0, 1, 0], [1, 0, Math.PI / 2], [0, -1, Math.PI], [-1, 0, -Math.PI / 2]];
    if (onRoad) {
      for (const [dx, dy, yaw] of dirs) if (!rd(st.x + dx, st.y + dy)) return [1, yaw];
      // Ecke (+x/+z im Modell) nach der Diagonale ohne Straße ausrichten
      const corners = [[1, 1, 0], [1, -1, Math.PI / 2], [-1, -1, Math.PI], [-1, 1, -Math.PI / 2]];
      for (const [dx, dy, yaw] of corners) if (!rd(st.x + dx, st.y + dy)) return [2, yaw];
      return [2, 0];
    }
    for (const [dx, dy, yaw] of dirs) if (rd(st.x + dx, st.y + dy)) return [0, yaw];
    return [0, this.stationYaw(st, ls)];
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

  // Eingangsmodell je Variante und Detailstufe (einmal gebaut, dann wiederverwendet)
  archModel(v, lod) {
    const key = v * 3 + lod;
    if (this.archCache.has(key)) return this.archCache.get(key);
    let parts = null;
    try {
      const res = buildArch('station', 1, v, 1, 1, {}, [2, 1, 0][lod]);
      if (res && res.meshes) parts = res.meshes.map((p) => ({ geometry: p.geometry, material: getMaterial(p.material) }));
    } catch (e) { console.warn('U-Bahn-Eingang: Baustein fehlgeschlagen', e); }
    this.archCache.set(key, parts);
    return parts;
  }

  placeArch(lists) {
    for (const m of this.archMeshes) { this.archGroup.remove(m); m.dispose(); }
    this.archMeshes = [];
    this.archSets = [];
    lists.forEach((list, v) => {
      if (!list.length) return;
      const lods = [0, 1, 2].map((lod) => {
        const parts = this.archModel(v, lod);
        if (!parts) return null;
        return parts.map((p) => {
          const mesh = new THREE.InstancedMesh(p.geometry, p.material, list.length);
          mesh.castShadow = !p.material.transparent;
          mesh.receiveShadow = true;
          mesh.frustumCulled = false;
          mesh.count = 0;
          this.archGroup.add(mesh);
          this.archMeshes.push(mesh);
          return mesh;
        });
      });
      this.archSets.push({ list, lods });
    });
    this.archTimer = 0;
    this.updateArchLods(true);
  }

  updateArchLods(force) {
    if (!this.archSets.length) return;
    if (!force && --this.archTimer > 0) return;
    this.archTimer = 20;
    const cam = this.e.camera.position;
    const m4 = this.m4, q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (const { list, lods } of this.archSets) {
      const counts = [0, 0, 0];
      for (const [x, z, yaw] of list) {
        const d = Math.hypot(x - cam.x, cam.y, z - cam.z);
        let lod = d < 16 ? 0 : d < 50 ? 1 : 2;
        while (lod < 2 && !lods[lod]) lod++;
        while (lod > 0 && !lods[lod]) lod--;
        const set = lods[lod];
        if (!set) continue;
        q.setFromAxisAngle(up, yaw); p.set(x, 0, z); m4.compose(p, q, s);
        const i = counts[lod]++;
        for (const mesh of set) mesh.setMatrixAt(i, m4);
      }
      lods.forEach((set, lod) => {
        if (!set) return;
        for (const mesh of set) { mesh.count = counts[lod]; mesh.visible = counts[lod] > 0; mesh.instanceMatrix.needsUpdate = true; }
      });
    }
  }

  frame(time, night) {
    const g = this.g, tr = g.transit;
    if (tr.version !== this.version) this.rebuild();
    this.updateArchLods(false);
    // Wartende Fahrgäste über den Eingängen
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const st of tr.stations.values()) {
      const x = st.x + 0.5 - g.W / 2, z = st.y + 0.5 - g.H / 2;
      const base = this.iconY.get(st.id) ?? ICON_Y;
      const show = Math.min(st.waiting.length, 24);
      for (let kk = 0; kk < show; kk++) {
        const p = st.waiting[kk];
        const m = this.paxMesh[p.shape];
        if (!m) continue;
        const i = counts[p.shape]++;
        if (i >= 1200) continue;
        const col = kk % 6, row = Math.floor(kk / 6);
        this.p.set(x - 0.32 + col * 0.13, base + 0.11 + row * 0.07, z - 0.05);
        this.m4.makeTranslation(this.p.x, this.p.y, this.p.z);
        m.setMatrixAt(i, this.m4);
      }
      // Ring
      let ring = this.rings.get(st.id);
      if (st.over > 0.02) {
        const segs = 48;
        const prog = Math.min(1, st.over);
        if (!ring) {
          ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.72, segs, 1, Math.PI / 2, -Math.PI * 2 * prog), new THREE.MeshBasicMaterial({ color: 0xe8543f, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
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
        ring.position.set(x, base + 0.03, z);
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

  stats() {
    const u = this.e.underground;
    return u ? { ...u.fleet.stats(), trackTris: u.stats.tris } : { draws: 0, tris: 0, inst: 0 };
  }
}

export { lin };
