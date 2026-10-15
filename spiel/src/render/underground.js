// Pulsbahn unter der Erde (Besitzer: UBAHN).
// UndergroundView zeichnet das ganze U-Bahn-Netz unterhalb des Geländes: Tunnel (Trog mit Gleisbett, Schienen,
// Linienfarben an den Wänden, gläserne Röhre aus Spanten), Bahnsteighallen unter jeder Station, Schächte zu den
// Eingängen und die fahrenden, beleuchteten Züge.
// Vertrag V1: engine.setUnderground(on) / engine.undergroundActive.
//   Aus (normale Ansicht): Der Tunnel ist unsichtbar; eine feine, gestrichelte Spur in Linienfarbe auf dem Boden
//     zeigt den Linienverlauf, ein sanfter Lichtpunkt („Puls") wandert mit jedem Zug mit.
//   An (Untergrund-Ansicht): Die Oberwelt wird über einen Schleier abgedunkelt und entsättigt, danach wird die eigene
//     Szene (Tiefenpuffer geleert) darüber gezeichnet – wie ein Röntgenblick unter die Stadt. Weiches Ein-/Ausblenden.
// Jede Linie liegt auf einer eigenen Ebene (Linie 1 −9,5 m, Linie 2 −12,9 m, Linie 3 −16,3 m …), so kreuzen sich
// Linien in Umsteigebahnhöfen übereinander.
import * as THREE from 'three';
import { TRANSIT } from '../config.js';
import { LINE_COLORS, linePose } from '../sim/transit.js';
import { Fleet } from './agents.js';
import { VKit, P, F, GlowPoints, getVehicleMaterial, hashf } from './vehicles_kit.js';

const LEVEL_STEP = 0.34;
const HALL_HL = 1.15;          // halbe Bahnsteiglänge (4 Wagen ≈ 2,2 Felder)
const CAR_SPACING = 0.54;
const BOGIE = 0.17;
const TILES = [0xe9e2cf, 0xd3e6db, 0xf0dcac, 0xdbe2ec, 0xead6cf, 0xe4e4dc];
const FADE = 3.2;              // Überblendung ≈ 0,3 s

const _c = new THREE.Color();
const _w = new THREE.Color(0xffffff);
const smooth = (x) => x * x * (3 - 2 * x);

// Material für alles unter der Erde: Fahrzeug-Shader, aber Fenster und Lampen immer an, ohne Nebel, ausblendbar
const UGU = { uNight: { value: 1 }, uLights: { value: 1 } };
let _ugMat = null;
function ugMaterial() {
  if (_ugMat) return _ugMat;
  const base = getVehicleMaterial();
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05, transparent: true, opacity: 1, fog: false });
  m.onBeforeCompile = (sh, r) => {
    base.onBeforeCompile(sh, r);
    sh.uniforms.uNight = UGU.uNight;
    sh.uniforms.uLights = UGU.uLights;
  };
  m.customProgramCacheKey = () => 'vehPartsUG1';
  _ugMat = m;
  return m;
}

// Einfache Dreiecksliste mit Farben (für leuchtende, durchscheinende Teile)
class Glass {
  constructor() { this.p = []; this.c = []; }
  tri(a, b, c, col) { this.p.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) this.c.push(col.r, col.g, col.b); }
  quad(a, b, c, d, col) { this.tri(a, b, c, col); this.tri(a, c, d, col); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return g;
  }
}

// Bodenspur: Mittellinie + Seitenvektor je Ecke; die Breite wächst im Shader mit dem Kameraabstand (bleibt lesbar)
class Trace {
  constructor() { this.p = []; this.s = []; this.c = []; }
  dash(a, b, nx, nz, col) {
    const v = [[a, -1], [b, -1], [b, 1], [a, -1], [b, 1], [a, 1]];
    for (const [q, sd] of v) { this.p.push(q[0], q[1], q[2]); this.s.push(nx * sd, nz * sd); this.c.push(col.r, col.g, col.b); }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('aSide', new THREE.Float32BufferAttribute(this.s, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return g;
  }
}

function traceMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uW: { value: 0.05 }, uOpacity: { value: 0.5 } },
    vertexShader: `attribute vec2 aSide; uniform float uW; varying vec3 vCol;
void main() {
  vCol = color;
  vec3 p = position + vec3(aSide.x, 0.0, aSide.y) * uW;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`,
    fragmentShader: `uniform float uOpacity; varying vec3 vCol;
void main() {
  gl_FragColor = vec4(vCol, uOpacity);
  #include <colorspace_fragment>
}`,
    vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
}

export class UndergroundView {
  constructor(engine) {
    this.e = engine;
    this.g = engine.game;
    this.on = false;
    this.k = 0;
    this.version = -1;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xe4ecff, 0x2a303a, 1.15));
    const key = new THREE.DirectionalLight(0xfff4e6, 1.25);
    key.position.set(0.35, 1, 0.55);
    this.scene.add(key);
    this.mat = ugMaterial();
    this.glassMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false });
    this.net = new THREE.Group();
    this.scene.add(this.net);
    this.fleet = new Fleet(engine, { near: 13, mid: 60 });
    this.fleet.parent = this.scene;
    this.fleet.mat = this.mat;
    this.glow = new GlowPoints(this.scene, 3000);
    // Schleier über der Oberwelt
    this.veilScene = new THREE.Scene();
    this.veilCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.veilMat = new THREE.ShaderMaterial({
      uniforms: { uK: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform float uK; varying vec2 vUv;
void main() {
  vec2 q = vUv - 0.5;
  float vig = smoothstep(0.25, 0.85, length(q * vec2(1.25, 1.0)));
  gl_FragColor = vec4(vec3(0.016, 0.026, 0.048), uK * (0.77 + 0.17 * vig));
  #include <colorspace_fragment>
}`,
      transparent: true, depthTest: false, depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.veilMat);
    quad.frustumCulled = false;
    this.veilScene.add(quad);
    // Normale Ansicht: Spur am Boden und wandernder Puls
    this.trace = null;
    this.traceMat = traceMaterial();
    this.pulse = new GlowPoints(engine.scene, 400);
    this.tmpA = { x: 0, z: 0, yaw: 0 }; this.tmpB = { x: 0, z: 0, yaw: 0 }; this.tmp = { x: 0, z: 0, yaw: 0 };
    this.lineY = new Map();
    this.hallLights = [];
    this.stats = { tris: 0 };
  }

  setActive(on) { this.on = !!on; }

  // Tiefe (Schienenoberkante) einer Linie
  depthOf(line) { return this.lineY.get(line.id) ?? -TRANSIT.tunnelDepth; }

  // Höhe für die Zeichnung des Linienentwurfs (input/linedraft.js): Ebene der bearbeiteten bzw. der nächsten neuen
  // Linie, mit der Überblendung der Untergrund-Ansicht (aus: Gelände, an: Tunnelebene) – Vorschau und Tunnel decken sich
  planDepth(lineId) {
    const tr = this.g.transit;
    const line = lineId ? tr.lines.find((l) => l.id === lineId) : null;
    const y = line ? this.depthOf(line) : -(TRANSIT.tunnelDepth + (tr.lines.length % 3) * LEVEL_STEP);
    const k = Math.max(0, Math.min(1, this.kv || 0));
    return y * k;
  }

  // Pose auf der Linie; bei offenen Linien über die Enden hinaus verlängert (Bahnsteig an Endstationen)
  pose(line, d, out) {
    const tr = this.g.transit;
    if (line.loop || (d >= 0 && d <= line.length)) return linePose(tr, line, d, out);
    const end = d < 0 ? 0 : line.length;
    linePose(tr, line, end, out);
    const over = d - end;
    out.x += Math.sin(out.yaw) * over; out.z += Math.cos(out.yaw) * over;
    return out;
  }

  // Ruft fn(a, b, l, yaw) für jedes gerade Stück der Linie zwischen den Distanzen d0 und d1 auf
  walk(line, d0, d1, fn) {
    if (d1 - d0 < 1e-4) return;
    const cuts = [d0];
    for (const c of line.cum) {
      if (line.loop) {
        for (const base of [-line.length, 0, line.length]) { const v = c + base; if (v > d0 + 1e-4 && v < d1 - 1e-4) cuts.push(v); }
      } else if (c > d0 + 1e-4 && c < d1 - 1e-4) cuts.push(c);
    }
    cuts.push(d1);
    cuts.sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++) {
      const a0 = cuts[i], a1 = cuts[i + 1];
      if (a1 - a0 < 1e-4) continue;
      const m = (a0 + a1) / 2;
      const pm = this.pose(line, m, this.tmp);
      const yaw = pm.yaw;
      const A = this.pose(line, a0 + 1e-5, this.tmpA), B = this.pose(line, a1 - 1e-5, this.tmpB);
      fn([A.x, A.z], [B.x, B.z], Math.hypot(B.x - A.x, B.z - A.z), yaw, i === 0, i === cuts.length - 2);
    }
  }

  rebuild() {
    const g = this.g, tr = g.transit;
    this.version = tr.version;
    for (const o of [...this.net.children]) { this.net.remove(o); o.geometry && o.geometry.dispose(); }
    if (this.trace) { this.e.scene.remove(this.trace); this.trace.geometry.dispose(); this.trace = null; }
    this.lineY.clear();
    tr.lines.forEach((line, i) => this.lineY.set(line.id, -(TRANSIT.tunnelDepth + (i % 3) * LEVEL_STEP)));
    const k = new VKit(2);
    const gl = new Glass();
    const tr2 = new Trace();
    const hallsAt = new Map(); // Station → oberster Bahnsteig (für den Schacht)
    this.hallLights = [];
    for (const line of tr.lines) {
      if (!line.pts || line.pts.length < 2 || !(line.length > 0)) continue;
      const col = LINE_COLORS[line.color];
      const Y = this.depthOf(line);
      const L = line.length;
      // Bahnsteige: halbe Länge je Station nach Abstand zu den Nachbarn
      const halls = [];
      const sd = line.stopD;
      const n = sd.length;
      for (let s = 0; s < n; s++) {
        let gap = Infinity;
        if (s > 0) gap = Math.min(gap, sd[s] - sd[s - 1]);
        if (s < n - 1) gap = Math.min(gap, sd[s + 1] - sd[s]);
        if (line.loop) { if (s === 0) gap = Math.min(gap, L - sd[n - 1]); if (s === n - 1) gap = Math.min(gap, L - sd[s]); }
        const hl = Math.max(0.45, Math.min(HALL_HL, gap / 2 - 0.08));
        const term = !line.loop && (s === 0 || s === n - 1);
        halls.push({ d: sd[s], hl, term, first: s === 0, sid: line.stops[s] });
      }
      // Tunnelstücke zwischen den Hallen
      const ex = [];
      for (const h of halls) {
        let a = h.d - h.hl, b = h.d + h.hl;
        if (line.loop) {
          if (a < 0) { ex.push([a + L, L]); a = 0; }
          if (b > L) { ex.push([0, b - L]); b = L; }
        }
        ex.push([Math.max(0, a), Math.min(L, b)]);
      }
      ex.sort((p, q) => p[0] - q[0]);
      let cur = 0;
      const tun = [];
      for (const [a, b] of ex) { if (a > cur + 0.02) tun.push([cur, a]); cur = Math.max(cur, b); }
      if (L > cur + 0.02) tun.push([cur, L]);
      for (const [a, b] of tun) this.walk(line, a, b, (A, B, l, yaw, isFirst, isLast) => this.tunnelPiece(k, gl, A, B, l, yaw, Y, col, !isFirst, !isLast));
      for (const h of halls) {
        const tile = TILES[h.sid % TILES.length];
        // Endstationen: Bahnsteig über das Linienende hinaus verlängern
        const a = h.d - h.hl, b = h.d + h.hl;
        this.walk(line, a, b, (A, B, l, yaw) => this.hallPiece(k, gl, A, B, l, yaw, Y, col, tile, h.sid));
        // Stirnwände mit Tunnelportal bzw. Prellbock
        for (const [dd, dir] of [[a, -1], [b, 1]]) {
          const p = this.pose(line, dd, this.tmp);
          const closed = h.term && ((h.first && dir < 0) || (!h.first && dir > 0));
          this.hallEnd(k, p.x, p.z, p.yaw, Y, tile, closed, dir);
        }
        // Schacht zum obersten Bahnsteig, quer zu dessen Linie versetzt
        const prev = hallsAt.get(h.sid);
        const pc = this.pose(line, h.d, this.tmp);
        this.hallLights.push([pc.x, Y + 0.2, pc.z, 0.6 + h.hl * 0.5]);
        if (!prev) hallsAt.set(h.sid, { top: Y, yaw: pc.yaw });
        else if (Y > prev.top) { prev.top = Y; prev.yaw = pc.yaw; }
      }
      // Spur am Boden (normale Ansicht): fein gestrichelt in Linienfarbe
      this.walk(line, 0, L, (A, B, l, yaw) => this.tracePiece(tr2, A, B, l, col));
    }
    // Schächte von den Eingängen zu den Bahnsteigen
    for (const [sid, h] of hallsAt) {
      const st = tr.stations.get(sid);
      if (!st) continue;
      this.shaft(k, gl, h, st);
    }
    const geo = k.build();
    this.stats.tris = geo.userData.triangles || 0;
    if (geo.attributes.position.count) {
      const mesh = new THREE.Mesh(geo, this.mat);
      mesh.frustumCulled = false;
      this.net.add(mesh);
      const gg = gl.build();
      const gm = new THREE.Mesh(gg, this.glassMat);
      gm.renderOrder = 5;
      gm.frustumCulled = false;
      this.net.add(gm);
      const tg = tr2.build();
      this.trace = new THREE.Mesh(tg, this.traceMat);
      this.trace.renderOrder = 2;
      this.trace.frustumCulled = false;
      this.e.scene.add(this.trace);
    }
  }

  // Tunnel: Trog mit Sohle, Gleisbett, Schienen, Wänden in Linienfarbe und Röhre aus leuchtenden Spanten
  tunnelPiece(k, gl, A, B, l, yaw, Y, col, joinA, joinB) {
    if (l < 1e-3) return;
    const cx = (A[0] + B[0]) / 2, cz = (A[1] + B[1]) / 2;
    const hl = l / 2;
    const z0 = -hl - (joinA ? 0.11 : 0), z1 = hl + (joinB ? 0.11 : 0);
    const CON = 0x8f8b84, WALL = 0xb8b2a8, BED = 0x4a4642, RAIL = 0x9aa0a6;
    k.group({ x: cx, y: 0, z: cz, ry: yaw }, () => {
      k.box(-0.225, Y - 0.1, z0, 0.225, Y - 0.06, z1, CON, P.PLASTIC, { front: false, back: false, left: { c: 0x4a4744 }, right: { c: 0x4a4744 }, bottom: { c: 0x3a3836 } });
      k.box(-0.13, Y - 0.06, z0, 0.13, Y - 0.035, z1, BED, P.RUBBER, { front: false, back: false });
      for (const s of [1, -1]) k.box(s * 0.055 - 0.008, Y - 0.035, z0, s * 0.055 + 0.008, Y, z1, RAIL, P.CHROME, { front: false, back: false });
      for (const s of [1, -1]) {
        const xa = s > 0 ? 0.2 : -0.225, xb = s > 0 ? 0.225 : -0.2;
        k.box(xa, Y - 0.1, z0, xb, Y + 0.22, z1, WALL, P.PLASTIC, { front: false, back: false, top: { c: col, p: P.STRIPE }, [s > 0 ? 'left' : 'right']: { c: 0x55524d } });
        k.quad([s * 0.199, Y + 0.1, z0], [s * 0.199, Y + 0.1, z1], [s * 0.199, Y + 0.13, z1], [s * 0.199, Y + 0.13, z0], col, P.STRIPE, [-s, 0, 0]);
      }
      // Tunnelleuchten an den Wänden
      const nl = Math.max(1, Math.round(l / 0.8));
      for (let j = 0; j < nl; j++) {
        const z = -hl + ((j + 0.5) * l) / nl;
        const s = j % 2 ? 1 : -1;
        k.box(s > 0 ? 0.185 : -0.2, Y + 0.16, z - 0.035, s > 0 ? 0.2 : -0.185, Y + 0.18, z + 0.035, 0xfff0d2, P.LAMP);
      }
    });
    // Röhre: Spanten und ein Hauch von Glas
    const c = new THREE.Color(col);
    const rib = c.clone().multiplyScalar(0.55), skin = c.clone().multiplyScalar(0.07);
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    const W = (lx, y, lz) => [cx + lx * cy + lz * sy, y, cz - lx * sy + lz * cy];
    const R = 0.225, yc = Y + 0.22, SEG = 7;
    for (let i = 0; i < SEG; i++) {
      const a0 = (Math.PI * i) / SEG, a1 = (Math.PI * (i + 1)) / SEG;
      const x0 = Math.cos(a0) * R, y0 = yc + Math.sin(a0) * R, x1 = Math.cos(a1) * R, y1 = yc + Math.sin(a1) * R;
      gl.quad(W(x0, y0, -hl), W(x1, y1, -hl), W(x1, y1, hl), W(x0, y0, hl), skin);
    }
    const nr = Math.max(1, Math.round(l / 0.42));
    for (let j = 0; j <= nr; j++) {
      const z = -hl + (j * l) / nr;
      for (let i = 0; i < SEG; i++) {
        const a0 = (Math.PI * i) / SEG, a1 = (Math.PI * (i + 1)) / SEG;
        const x0 = Math.cos(a0) * R, y0 = yc + Math.sin(a0) * R, x1 = Math.cos(a1) * R, y1 = yc + Math.sin(a1) * R;
        gl.quad(W(x0, y0, z - 0.012), W(x1, y1, z - 0.012), W(x1, y1, z + 0.012), W(x0, y0, z + 0.012), rib);
      }
    }
  }

  // Bahnsteighalle: Seitenbahnsteige mit Kante, gekachelte Wände mit Linienband, Lichtbänder, Bänke, Schilder
  hallPiece(k, gl, A, B, l, yaw, Y, col, tile, sid) {
    if (l < 1e-3) return;
    const cx = (A[0] + B[0]) / 2, cz = (A[1] + B[1]) / 2;
    const hl = l / 2 + 0.004;
    const FLOOR = 0x7c7a76, PLAT = 0xd8d2c6, EDGE = 0xf2c21a, BED = 0x4a4642, RAIL = 0x9aa0a6;
    k.group({ x: cx, y: 0, z: cz, ry: yaw }, () => {
      k.box(-0.5, Y - 0.12, -hl, 0.5, Y - 0.08, hl, FLOOR, P.PLASTIC, { front: false, back: false });
      k.box(-0.13, Y - 0.08, -hl, 0.13, Y - 0.035, hl, BED, P.RUBBER, { front: false, back: false, left: false, right: false });
      for (const s of [1, -1]) k.box(s * 0.055 - 0.008, Y - 0.035, -hl, s * 0.055 + 0.008, Y, hl, RAIL, P.CHROME, { front: false, back: false });
      for (const s of [1, -1]) {
        const xi = s * 0.165, xo = s * 0.46;
        const x0 = Math.min(xi, xo), x1 = Math.max(xi, xo);
        k.box(x0, Y - 0.08, -hl, x1, Y + 0.035, hl, PLAT, P.PLASTIC, { front: false, back: false, [s > 0 ? 'left' : 'right']: false, [s > 0 ? 'right' : 'left']: { c: 0x8a857c } });
        k.rectY(Y + 0.0362, s > 0 ? x0 : x1 - 0.022, s > 0 ? x0 + 0.022 : x1, -hl, hl, EDGE, P.GLOSS);
        // Wand: Kacheln, Band in Linienfarbe, Lichtband oben
        const wa = s > 0 ? 0.46 : -0.49, wb = s > 0 ? 0.49 : -0.46;
        k.box(wa, Y - 0.12, -hl, wb, Y + 0.22, hl, tile, P.PLASTIC, { front: false, back: false, top: { c: col, p: P.STRIPE }, [s > 0 ? 'left' : 'right']: { c: 0x8f8b84 } });
        k.quad([s * 0.459, Y + 0.125, -hl], [s * 0.459, Y + 0.125, hl], [s * 0.459, Y + 0.16, hl], [s * 0.459, Y + 0.16, -hl], col, P.STRIPE, [-s, 0, 0]);
        k.box(s > 0 ? 0.44 : -0.46, Y + 0.19, -hl * 0.94, s > 0 ? 0.46 : -0.44, Y + 0.21, hl * 0.94, 0xfff3dc, P.LAMP, { bottom: true });
        // Bänke und Stationsschilder
        const nb = Math.max(1, Math.round(l / 0.55));
        for (let j = 0; j < nb; j++) {
          const z = -hl + ((j + 0.5) * 2 * hl) / nb;
          const h = hashf(sid * 31 + j * 7 + (s > 0 ? 3 : 0));
          if (j % 2 === 0) k.box(s * 0.4 - 0.022, Y + 0.035, z - 0.07, s * 0.4 + 0.022, Y + 0.065, z + 0.07, 0x7a5a3a, P.PLASTIC);
          else k.box(s > 0 ? 0.452 : -0.46, Y + 0.065, z - 0.11, s > 0 ? 0.46 : -0.452, Y + 0.105, z + 0.11, 0x1f4f9c, P.SIGN);
          // ein paar Wartende
          if (h > 0.45) {
            const px = s * (0.24 + h * 0.12), pz = z + (h - 0.7) * 0.3;
            _c.setHSL(h * 7 % 1, 0.45, 0.45);
            k.box(px - 0.014, Y + 0.035, pz - 0.01, px + 0.014, Y + 0.105, pz + 0.01, _c.getHex(), P.PLASTIC);
            k.box(px - 0.009, Y + 0.105, pz - 0.009, px + 0.009, Y + 0.125, pz + 0.009, 0xe8c4a0, P.PLASTIC);
          }
        }
      }
    });
    // Gewölbe der Halle (durchscheinend) mit Spanten
    const c = new THREE.Color(col);
    const rib = c.clone().lerp(new THREE.Color(0xffffff), 0.35).multiplyScalar(0.42), skin = new THREE.Color(0xfff2d8).multiplyScalar(0.05);
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    const W = (lx, y, lz) => [cx + lx * cy + lz * sy, y, cz - lx * sy + lz * cy];
    const R = 0.49, yc = Y + 0.22, SEG = 9, ry = 0.5;
    for (let i = 0; i < SEG; i++) {
      const a0 = (Math.PI * i) / SEG, a1 = (Math.PI * (i + 1)) / SEG;
      gl.quad(W(Math.cos(a0) * R, yc + Math.sin(a0) * R * ry, -hl), W(Math.cos(a1) * R, yc + Math.sin(a1) * R * ry, -hl), W(Math.cos(a1) * R, yc + Math.sin(a1) * R * ry, hl), W(Math.cos(a0) * R, yc + Math.sin(a0) * R * ry, hl), skin);
    }
    const nr = Math.max(1, Math.round(l / 0.3));
    for (let j = 0; j <= nr; j++) {
      const z = -hl + (j * 2 * hl) / nr;
      for (let i = 0; i < SEG; i++) {
        const a0 = (Math.PI * i) / SEG, a1 = (Math.PI * (i + 1)) / SEG;
        gl.quad(W(Math.cos(a0) * R, yc + Math.sin(a0) * R * ry, z - 0.01), W(Math.cos(a1) * R, yc + Math.sin(a1) * R * ry, z - 0.01), W(Math.cos(a1) * R, yc + Math.sin(a1) * R * ry, z + 0.01), W(Math.cos(a0) * R, yc + Math.sin(a0) * R * ry, z + 0.01), rib);
      }
    }
  }

  // Stirnwand einer Halle: Portal zum Tunnel oder geschlossen mit Prellbock (dir: −1 Anfang, +1 Ende)
  hallEnd(k, x, z, yaw, Y, tile, closed, dir) {
    k.group({ x, y: 0, z, ry: yaw }, () => {
      const z0 = dir > 0 ? 0 : -0.03, z1 = dir > 0 ? 0.03 : 0;
      if (closed) {
        k.box(-0.49, Y - 0.12, z0, 0.49, Y + 0.22, z1, tile, P.PLASTIC);
        const zb = dir > 0 ? -0.05 : 0.02;
        k.box(-0.1, Y - 0.035, zb, 0.1, Y + 0.07, zb + 0.03, 0xc8241a, P.GLOSS);
        k.box(-0.06, Y + 0.02, dir > 0 ? zb - 0.005 : zb + 0.03, 0.06, Y + 0.05, dir > 0 ? zb : zb + 0.035, 0xffffff, P.TAIL);
      } else {
        for (const s of [1, -1]) k.box(s > 0 ? 0.225 : -0.49, Y - 0.12, z0, s > 0 ? 0.49 : -0.225, Y + 0.22, z1, tile, P.PLASTIC, { top: { c: 0x3a3f47 } });
      }
    });
  }

  // Schacht vom Eingang hinunter auf den obersten Bahnsteig (Treppe und Rolltreppe in einer Glasröhre)
  shaft(k, gl, h, st) {
    const g = this.g;
    const sx = st.x + 0.5 - g.W / 2, sz = st.y + 0.5 - g.H / 2;
    const ox = Math.cos(h.yaw) * 0.32, oz = -Math.sin(h.yaw) * 0.32;
    const x = sx + ox, z = sz + oz;
    const y0 = h.top + 0.035, y1 = -0.02;
    const sy = Math.sin(h.yaw), cy = Math.cos(h.yaw);
    const W = (lx, y, lz) => [x + lx * cy + lz * sy, y, z - lx * sy + lz * cy];
    const c = new THREE.Color(0x7fb2ff);
    const edge = c.clone().multiplyScalar(0.7), skin = c.clone().multiplyScalar(0.08);
    const hx = 0.07, hz = 0.16;
    const corners = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
      gl.quad(W(ax, y0, az), W(bx, y0, bz), W(bx, y1, bz), W(ax, y1, az), skin);
      gl.quad(W(ax - 0.006, y0, az), W(ax + 0.006, y0, az), W(ax + 0.006, y1, az), W(ax - 0.006, y1, az), edge);
    }
    for (let y = y0 + 0.12; y < y1; y += 0.16) for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
      gl.quad(W(ax, y - 0.006, az), W(bx, y - 0.006, bz), W(bx, y + 0.006, bz), W(ax, y + 0.006, az), edge);
    }
    // Rolltreppe als schräges Band im Schacht
    k.group({ x, y: 0, z, ry: h.yaw }, () => {
      const steps = 8;
      for (let i = 0; i < steps; i++) {
        const t0 = i / steps, t1 = (i + 1) / steps;
        const ya = y0 + (y1 - y0) * t0, yb = y0 + (y1 - y0) * t1;
        k.box(-0.05, ya, -hz + 2 * hz * t0, 0.05, yb, -hz + 2 * hz * t1, i % 2 ? 0x9aa0a6 : 0x6f757c, P.CHROME, {});
      }
      k.box(-0.07, y0 - 0.01, -hz - 0.04, 0.07, y0 + 0.0, hz + 0.04, 0xd8d2c6, P.PLASTIC);
    });
  }

  // Bodenspur: Striche in Linienfarbe knapp über Gelände/Straße
  tracePiece(tb, A, B, l, col) {
    const te = this.e.terrain;
    const wl = -0.05;
    const hAt = (x, z) => {
      let h = 0;
      try { if (te && te.heightAt) h = te.heightAt(x, z); } catch (e) { h = 0; }
      return Math.max(h, wl) + 0.035;
    };
    const c = new THREE.Color(col);
    const dx = (B[0] - A[0]) / (l || 1), dz = (B[1] - A[1]) / (l || 1);
    const dash = 0.3, gap = 0.16;
    for (let s = 0; s < l; s += dash + gap) {
      const e = Math.min(l, s + dash);
      const ax = A[0] + dx * s, az = A[1] + dz * s, bx = A[0] + dx * e, bz = A[1] + dz * e;
      tb.dash([ax, hAt(ax, az), az], [bx, hAt(bx, bz), bz], -dz, dx, c);
    }
  }

  frame(dt, time, night) {
    const g = this.g, tr = g.transit;
    if (tr.version !== this.version) this.rebuild();
    const goal = this.on ? 1 : 0;
    // Überblendung nach echter Zeit (auch bei sehr langsamen Bildern in ≈ 0,3 s fertig)
    const step = Math.min(1, Math.min(0.5, Math.max(dt, this.e.realDt || 0)) * FADE);
    this.k += Math.sign(goal - this.k) * Math.min(Math.abs(goal - this.k), step);
    const k = smooth(Math.max(0, Math.min(1, this.k)));
    this.kv = k;
    this.mat.opacity = k;
    this.glassMat.opacity = k;
    this.veilMat.uniforms.uK.value = k;
    const dist = this.e.rig && this.e.rig.cur ? this.e.rig.cur.dist : 30;
    const far = this.far = Math.max(0, Math.min(1, (dist - 18) / 50));
    this.traceMat.uniforms.uW.value = 0.04 + dist * 0.0026;
    this.traceMat.uniforms.uOpacity.value = (0.42 + 0.2 * far) * (1 - k) * (0.8 + 0.2 * (1 - (night || 0)));
    // Röhren in der Übersicht kräftiger (Netzplan), in der Nahsicht zart
    this.glassMat.color.setScalar(1 + 2.4 * smooth(far));
    if (this.trace) this.trace.visible = k < 0.99;
    this.net.visible = k > 0.002;
    // Linienvorschau des Linien-Werkzeugs im Untergrund oben zeichnen
    const lp = this.e.overlay && this.e.overlay.linePrev;
    if (lp) { const want = k > 0.5 ? this.scene : this.e.scene; if (lp.parent !== want) want.add(lp); }

    const fl = this.fleet;
    fl.begin();
    this.glow.begin();
    this.pulse.begin();
    const showTrains = k > 0.002;
    for (const t of tr.trains) {
      const line = tr.lines.find((l) => l.id === t.line);
      if (!line || !line.pts.length) continue;
      const col = LINE_COLORS[line.color];
      const Y = this.depthOf(line);
      if (k < 0.99) {
        // Puls an der Zugspitze
        const p = this.pose(line, t.d, this.tmp);
        _c.setHex(col);
        const moving = t.state !== 'dwell' ? 1 : 0.55;
        this.pulse.add(p.x, 0.07, p.z, 0.34, _c.r, _c.g, _c.b, 0.55 * (1 - k) * moving);
      }
      if (!showTrains) continue;
      const cars = 1 + t.wagons;
      for (let kc = 0; kc < cars; kc++) {
        const d = t.d - t.dir * kc * CAR_SPACING;
        const a = this.pose(line, d + BOGIE * t.dir, this.tmpA);
        const ax = a.x, az = a.z;
        const b = this.pose(line, d - BOGIE * t.dir, this.tmpB);
        const x = (ax + b.x) / 2, z = (az + b.z) / 2;
        let yaw = Math.atan2(ax - b.x, az - b.z);
        if (Math.abs(ax - b.x) + Math.abs(az - b.z) < 1e-5) yaw = this.pose(line, d, this.tmp).yaw + (t.dir < 0 ? Math.PI : 0);
        let model, flags = F.RAIL | F.LIGHTS, yy = yaw;
        if (cars === 1) { model = 'metro_single'; flags |= F.LEAD; }
        else if (kc === 0) { model = 'metro_cab'; flags |= F.LEAD; }
        else if (kc === cars - 1) { model = 'metro_cab'; yy = yaw + Math.PI; }
        else model = 'metro_mid';
        const d2 = fl.add(model, x, Y, z, yy, 0, 0, col, hashf(t.id * 13 + kc), flags, 0);
        // In der Übersicht leuchtet jeder Wagen in Linienfarbe (fahrende Züge bleiben erkennbar)
        if (far > 0.05) { _c.setHex(col).lerp(_w, 0.35); this.glow.add(x, Y + 0.14, z, 0.55, _c.r, _c.g, _c.b, 0.55 * far * k); }
        if (d2 >= 0 && (kc === 0 || kc === cars - 1)) {
          const fx = Math.sin(yaw), fz = Math.cos(yaw);
          if (kc === 0) for (const s of [1, -1]) this.glow.add(x + fx * 0.252 + fz * s * 0.068, Y + 0.058, z + fz * 0.252 - fx * s * 0.068, 0.09, 1, 0.93, 0.78, 0.7 * k);
          if (kc === cars - 1) for (const s of [1, -1]) this.glow.add(x - fx * 0.252 + fz * s * 0.1, Y + 0.058, z - fz * 0.252 - fx * s * 0.1, 0.06, 1, 0.1, 0.05, 0.6 * k);
          // Lichtkegel voraus auf dem Gleis
          if (kc === 0) this.glow.add(x + fx * 0.42, Y + 0.02, z + fz * 0.42, 0.22, 1, 0.9, 0.7, 0.22 * k);
        }
      }
    }
    // warmer Lichtschein über den Bahnsteighallen
    if (k > 0.002) for (const q of this.hallLights) this.glow.add(q[0], q[1], q[2], q[3], 1, 0.86, 0.62, 0.22 * k);
    fl.end();
    this.glow.end(this.e.renderer);
    this.pulse.end(this.e.renderer);
  }

  // Zweiter Durchgang nach der Oberwelt (Bild liegt schon im Ziel, z. B. im Nachbearbeitungs-Puffer)
  render(r, camera) {
    if (!(this.kv > 0.002)) return;
    const ac = r.autoClear;
    r.autoClear = false;
    r.render(this.veilScene, this.veilCam);
    r.clearDepth();
    r.render(this.scene, camera);
    r.autoClear = ac;
  }

  info() { return { active: this.on, k: this.kv || 0, tris: this.stats.tris, trains: this.fleet.stats() }; }

  dispose() {
    for (const o of [...this.net.children]) { this.net.remove(o); o.geometry && o.geometry.dispose(); }
    if (this.trace) { this.e.scene.remove(this.trace); this.trace.geometry.dispose(); }
    this.pulse.dispose(this.e.scene);
    this.glow.dispose(this.scene);
  }
}

