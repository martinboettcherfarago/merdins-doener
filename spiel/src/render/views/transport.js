// Ansicht „Verkehrsanlagen" (Agent S3): Linienwege, Haltestellen (Schild, Markierung, Bahnsteig, Wartende),
// Straßenbahngleise mit Oberleitung, Gleise/Bahnsteige/Tunnelportale am Hauptbahnhof, Fährrouten, Ampeln (falls G8
// keine zeichnet), Unfallstellen, Vorschau des Linien-Werkzeugs, Infoansicht „Bus & Bahn" und Problem-Symbole.
// Fahrzeuge zeichnet G10 aus den renderables; solange die Fahrzeug-Ansicht nicht meldet, dass sie sie zeichnet
// (engine.vehicles.drawsRenderables === true oder engine.vehicles.drawsKinds = Set), stellt diese Ansicht einfache Platzhalter dar.
import * as THREE from 'three';
import { registerView, registerOverlay, registerIcon, on } from '../../registry.js';
import { R, T as TER, BUILDINGS } from '../../config.js';
import * as TPS from '../../sim/systems/transport.js';
import { LC } from '../../sim/roadnet.js';
import { ARCH } from '../arch/index.js';
import { Batch } from '../vehicles_kit.js';
import { lifeGeometry, getPeopleMaterial, getPeopleDepthMaterial, baseFeatures, wearFeatures, wearOf, MODE } from '../vehicles_people.js';

const BUS_ICON = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M8 21v-3M16 21v-3"/><circle cx="8" cy="14.5" r="0.9" fill="currentColor"/><circle cx="16" cy="14.5" r="0.9" fill="currentColor"/><path d="M9 6.5h6"/></svg>';

// ---------------------------------------------------------------- Infoansicht und Symbole
let covBuf = null;
registerOverlay({
  id: 'ptransport', name: 'Bus & Bahn', icon: BUS_ICON,
  text: 'Einzugsgebiet von Bus, Straßenbahn und Pulsbahn. Je dichter der Takt, desto kräftiger. Linienwege werden hervorgehoben.',
  field(g) {
    const T = TPS.TS(g);
    if (!covBuf || covBuf.length !== g.N) covBuf = new Float32Array(g.N);
    const a = T && T.covField, b = g.cov.transit;
    for (let i = 0; i < g.N; i++) covBuf[i] = Math.max(a ? a[i] : 0, b ? b[i] : 0);
    return covBuf;
  },
});
registerIcon({
  id: 'tp_depot', color: '#1c7ed6',
  draw(ctx, x, y, r) {
    ctx.fillStyle = '#ffffff';
    const w = r * 1.1, h = r * 0.8;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y - h / 2 - 4, w, h, 6) : ctx.rect(x - w / 2, y - h / 2 - 4, w, h); ctx.fill();
    ctx.fillStyle = '#1c7ed6'; ctx.fillRect(x - w / 2 + 5, y - h / 2 + 2, w - 10, h * 0.35);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x - w / 3, y + h / 2, 5, 0, Math.PI * 2); ctx.arc(x + w / 3, y + h / 2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c230'; ctx.font = `bold ${Math.round(r * 0.75)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', x + r * 0.75, y - r * 0.55);
  },
});
registerIcon({
  id: 'tp_jam', color: '#e5483c',
  draw(ctx, x, y, r) {
    ctx.fillStyle = '#ffffff';
    for (const [dx, dy] of [[-12, 8], [12, -8]]) {
      ctx.beginPath(); ctx.moveTo(x + dx - 16, y + dy + 8); ctx.lineTo(x + dx - 12, y + dy - 4); ctx.lineTo(x + dx + 12, y + dy - 4); ctx.lineTo(x + dx + 16, y + dy + 8); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#e5483c'; ctx.beginPath(); ctx.arc(x + r * 0.7, y - r * 0.7, 9, 0, Math.PI * 2); ctx.fill();
    void r;
  },
});

// ---------------------------------------------------------------- Geometrie-Helfer
function part(geo, color, m4) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (m4) g.applyMatrix4(m4);
  const n = g.attributes.position.count;
  const c = new THREE.Color(color);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}
function merge(parts) {
  let n = 0;
  for (const p of parts) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const p of parts) {
    pos.set(p.attributes.position.array, o * 3);
    nor.set(p.attributes.normal.array, o * 3);
    col.set(p.attributes.color.array, o * 3);
    o += p.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const M = new THREE.Matrix4();
const box = (w, h, d, x, y, z, color, ry = 0) => part(new THREE.BoxGeometry(w, h, d), color, M.makeRotationY(ry).setPosition(x, y, z));
const cyl = (r1, r2, h, x, y, z, color, seg = 8, rx = 0) => part(new THREE.CylinderGeometry(r1, r2, h, seg), color, new THREE.Matrix4().makeRotationX(rx).setPosition(x, y, z));

// Streifen entlang eines Linienzugs (Feld-Koordinaten) mit seitlichem Versatz (rechts positiv)
function strip(out, cols, g, pts, off, width, yBase, color, yLift = 0) {
  const W2 = g.W / 2, H2 = g.H / 2;
  const c = color !== null ? new THREE.Color(color) : null;
  const n = pts.length / 2;
  for (let k = 0; k < n - 1; k++) {
    const ax = pts[k * 2], ay = pts[k * 2 + 1], bx = pts[k * 2 + 2], by = pts[k * 2 + 3];
    const L = Math.hypot(bx - ax, by - ay);
    if (L < 1e-5) continue;
    const dx = (bx - ax) / L, dy = (by - ay) / L;
    const nx = -dy, ny = dx;
    const o1 = off - width / 2, o2 = off + width / 2;
    const ya = yAt(g, ax, ay, yBase) + yLift, yb = yAt(g, bx, by, yBase) + yLift;
    const p = [
      ax + nx * o1 - W2, ya, ay + ny * o1 - H2, ax + nx * o2 - W2, ya, ay + ny * o2 - H2, bx + nx * o2 - W2, yb, by + ny * o2 - H2,
      ax + nx * o1 - W2, ya, ay + ny * o1 - H2, bx + nx * o2 - W2, yb, by + ny * o2 - H2, bx + nx * o1 - W2, yb, by + ny * o1 - H2,
    ];
    for (const v of p) out.push(v);
    if (c && cols) for (let q = 0; q < 6; q++) cols.push(c.r, c.g, c.b);
  }
}
// Gleismitten einer Straßenbahnlinie aus den Fahrwegen (roadnet.Route): Punkte in Feldkoordinaten je Gleis
const _tq = { x: 0, z: 0, hx: 0, hz: 1, k: 0 };
function trackLines(g, l) {
  const vr = l.vr;
  if (!vr) return [];
  const out = [];
  for (const r of [vr.f, vr.b, vr.cyc]) {
    if (!r || r.len < 0.2) continue;
    const pts = [];
    const S0 = r.cyclic ? 0 : -0.5, S1 = r.cyclic ? r.len : r.len + 0.5;
    _tq.k = 0;
    for (let S = S0; ; S += 0.08) {
      const s = Math.min(S, S1);
      r.at(s, LC.TRAM, _tq, 2);
      pts.push(_tq.x + g.W / 2, _tq.z + g.H / 2);
      if (s >= S1) break;
    }
    if (r.cyclic) pts.push(pts[0], pts[1]);
    out.push(pts);
  }
  return out;
}
function yAt(g, x, y, base) {
  const tx = Math.min(g.W - 1, Math.max(0, Math.floor(x))), ty = Math.min(g.H - 1, Math.max(0, Math.floor(y)));
  return (g.world.terrain[ty * g.W + tx] === TER.WATER && g.road[ty * g.W + tx] ? 0.24 : 0) + base;
}
function flatMesh(pos, cols, mat) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (cols) geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  return m;
}

function signTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#f2f2ee'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#f2c230'; x.beginPath(); x.arc(32, 32, 28, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#1b7a3a'; x.lineWidth = 4; x.beginPath(); x.arc(32, 32, 28, 0, Math.PI * 2); x.stroke();
  x.fillStyle = '#1b7a3a'; x.font = 'bold 38px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('H', 32, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Platzhalter-Fahrzeuge: Einheitslänge entlang +z, Breite/Höhe fest, Farbe pro Instanz (weiße Teile tragen die Farbe)
function placeholderGeos() {
  const glass = 0x20262e, white = 0xffffff, dark = 0x2a2d33, light = 0xe9e6df;
  return {
    bus: merge([box(0.24, 0.2, 1, 0, 0.13, 0, white), box(0.245, 0.075, 0.9, 0, 0.17, 0.02, glass), box(0.2, 0.02, 0.6, 0, 0.24, -0.05, light), box(0.25, 0.05, 1.01, 0, 0.045, 0, dark)]),
    tram: merge([box(0.25, 0.22, 1, 0, 0.15, 0, white), box(0.255, 0.085, 0.94, 0, 0.19, 0, glass), box(0.26, 0.04, 1.01, 0, 0.055, 0, dark), box(0.06, 0.05, 0.2, 0, 0.29, 0, dark)]),
    car: merge([box(0.18, 0.08, 1, 0, 0.06, 0, white), box(0.16, 0.06, 0.5, 0, 0.125, -0.04, glass)]),
    taxi: merge([box(0.18, 0.08, 1, 0, 0.06, 0, white), box(0.16, 0.06, 0.5, 0, 0.125, -0.04, glass), box(0.07, 0.025, 0.12, 0, 0.17, -0.04, 0xfff3c0)]),
    police: merge([box(0.18, 0.08, 1, 0, 0.06, 0, light), box(0.182, 0.03, 0.6, 0, 0.07, 0, 0x1f5fbf), box(0.16, 0.06, 0.5, 0, 0.125, -0.04, glass), box(0.1, 0.025, 0.08, 0, 0.17, -0.04, 0x2d6bff)]),
    ambulance: merge([box(0.2, 0.16, 1, 0, 0.1, -0.05, light), box(0.202, 0.03, 0.9, 0, 0.1, -0.05, 0xd8261c), box(0.18, 0.06, 0.3, 0, 0.08, 0.38, glass), box(0.1, 0.025, 0.08, 0, 0.19, 0.2, 0xff3a2a)]),
    train_loco: merge([box(0.27, 0.26, 0.9, 0, 0.17, -0.05, white), box(0.27, 0.18, 0.12, 0, 0.13, 0.44, white), box(0.272, 0.07, 0.15, 0, 0.24, 0.39, glass), box(0.28, 0.05, 1, 0, 0.04, 0, dark)]),
    train_wagon: merge([box(0.27, 0.26, 1, 0, 0.17, 0, white), box(0.272, 0.07, 0.92, 0, 0.21, 0, glass), box(0.28, 0.05, 1.0, 0, 0.04, 0, dark)]),
    plane: merge([cyl(0.075, 0.075, 1, 0, 0.12, 0, white, 10, Math.PI / 2), box(1.0, 0.02, 0.2, 0, 0.1, 0.02, light), box(0.36, 0.015, 0.1, 0, 0.14, -0.44, light), box(0.015, 0.16, 0.14, 0, 0.22, -0.43, white), box(0.08, 0.05, 0.12, 0.25, 0.07, 0.06, dark), box(0.08, 0.05, 0.12, -0.25, 0.07, 0.06, dark)]),
    ferry: merge([box(0.36, 0.1, 1, 0, 0.05, 0, white), box(0.37, 0.03, 1.01, 0, 0.02, 0, 0x2f5f9a), box(0.26, 0.12, 0.5, 0, 0.16, -0.05, light), box(0.265, 0.045, 0.45, 0, 0.18, -0.05, glass), box(0.05, 0.12, 0.05, 0, 0.27, -0.1, 0xe8543f)]),
  };
}

// ---------------------------------------------------------------- Ansicht
registerView(class TransportView {
  constructor(engine) {
    this.e = engine;
    this.g = engine.game;
    this.ver = -1;
    this.group = new THREE.Group();
    this.group.name = 'Verkehrsanlagen';
    engine.scene.add(this.group);
    this.dyn = new THREE.Group();
    engine.scene.add(this.dyn);
    this.highlight = 0;
    this.panelSeen = -1e9;
    this.toolActive = false;
    this.preview = null;
    this.peopleTimer = 0;
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.p = new THREE.Vector3(); this.s = new THREE.Vector3(1, 1, 1);
    this.c = new THREE.Color();
    this.yAxis = new THREE.Vector3(0, 1, 0);
    this.e2 = new THREE.Euler();
    this.unsub = [
      on('transport:panel', () => { this.panelSeen = performance.now(); }),
      on('transport:tool', (d) => { this.toolActive = !!(d && d.active); }),
      on('transport:preview', (d) => { this.preview = d; this.previewDirty = true; }),
      on('transport:focusLine', (id) => { this.focusLine = id; this.focusUntil = performance.now() + 5000; this.focusDirty = true; }),
    ];
    this.focusMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
    this.focusMesh = null;
    // Materialien
    this.ribbonMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, toneMapped: false });
    this.dotMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
    this.glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -3, toneMapped: false });
    this.railMat = new THREE.MeshStandardMaterial({ color: 0x5b6068, roughness: 0.35, metalness: 0.7, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    this.solidMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.05 });
    this.glassMat = new THREE.MeshStandardMaterial({ color: 0x9fc4d8, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.45, depthWrite: false });
    this.wireMat = new THREE.LineBasicMaterial({ color: 0x2a2d33, transparent: true, opacity: 0.7 });
    this.signMat = new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.6, emissive: 0x000000 });
    this.instMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15 });
    this.lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    this.previewMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.92, depthTest: false, depthWrite: false, toneMapped: false });
    // Dynamisch: Wartende, Ampel-Lampen, Unfälle, Vorschau, Platzhalter
    // Wartende als stehende Menschen (gleiche Figuren wie die Fußgänger, Gewicht verlagern im Shader)
    const pm = getPeopleMaterial();
    this.people = { near: new Batch(this.dyn, lifeGeometry('human', 2).clone(), pm, { shadow: true, cap: 64, depth: getPeopleDepthMaterial() }), mid: new Batch(this.dyn, lifeGeometry('human', 1).clone(), pm, { shadow: false, cap: 128 }), far: new Batch(this.dyn, lifeGeometry('human', 0).clone(), pm, { shadow: false, cap: 256 }) };
    this.lamps = this.inst(new THREE.BoxGeometry(0.03, 0.03, 0.03), this.lampMat, 2400);
    this.triangles = this.inst(merge([part(new THREE.ConeGeometry(0.06, 0.09, 3), 0xd8261c, new THREE.Matrix4().makeTranslation(0, 0.045, 0)), box(0.02, 0.02, 0.02, 0, 0.012, 0, 0xffffff)]), this.instMat, 64);
    this.hoverRing = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.4, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, toneMapped: false }));
    this.hoverRing.renderOrder = 12; this.hoverRing.visible = false;
    this.dyn.add(this.hoverRing);
    this.pendingDots = this.inst(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, toneMapped: false }), 64);
    this.pendingDots.renderOrder = 12;
    this.previewMesh = null;
    this.ph = {};
    for (const [k, geo] of Object.entries(placeholderGeos())) { this.ph[k] = this.inst(geo, this.instMat, k === 'bus' || k === 'tram' ? 400 : 160); this.ph[k].castShadow = true; }
    this.rebuild();
  }

  inst(geo, mat, max) {
    const m = new THREE.InstancedMesh(geo, mat, max);
    m.count = 0;
    m.frustumCulled = false;
    m.setColorAt(0, new THREE.Color(1, 1, 1));
    this.dyn.add(m);
    return m;
  }

  dispose() {
    for (const u of this.unsub) u();
    this.e.scene.remove(this.group);
    this.e.scene.remove(this.dyn);
    this.clearGroup();
  }

  clearGroup() {
    for (const o of [...this.group.children]) {
      this.group.remove(o);
      o.traverse((x) => { if (x.geometry) x.geometry.dispose(); });
    }
  }

  // ------------------------------------------------------------ statische Anlagen
  rebuild() {
    const g = this.g, T = TPS.TS(g);
    if (!T) return;
    this.ver = T.version;
    this.clearGroup();
    const W2 = g.W / 2, H2 = g.H / 2;
    // Linienwege
    // dünne Linie (immer sichtbar, dezent) und breites Band (nur hervorgehoben: Panel, Werkzeug, Infoansicht)
    const rp = [], rc = [], gp = [], gc = [];
    // Versatz: allein fahrende Linien in der Mitte, gemeinsame Abschnitte nebeneinander
    const onTile = new Map();
    T.lines.forEach((l, idx) => { for (const t of new Set(l.path)) { if (!onTile.has(t)) onTile.set(t, []); onTile.get(t).push(idx); } });
    const offs = T.lines.map((l, idx) => {
      let slot = 0, cnt = 1;
      for (const t of new Set(l.path)) { const a = onTile.get(t); if (a.length > cnt) { cnt = a.length; slot = a.indexOf(idx); } }
      return (slot - (cnt - 1) / 2) * 0.1;
    });
    T.lines.forEach((l, idx) => {
      if (!l.pts || l.pts.length < 4) return;
      const off = offs[idx];
      strip(rp, rc, g, l.pts, off, l.mode === 'tram' ? 0.07 : 0.06, 0.032, TPS.lineColor(l));
      strip(gp, gc, g, l.pts, off, 0.2, 0.028, TPS.lineColor(l));
    });
    if (rp.length) {
      const m = flatMesh(rp, rc, this.ribbonMat); m.renderOrder = 4; this.group.add(m);
      const w = flatMesh(gp, gc, this.glowMat); w.renderOrder = 3; this.group.add(w);
    }
    // Straßenbahngleise und Oberleitung
    const rails = [], wires = [], poles = [];
    const seenPole = new Set();
    for (const l of T.lines) {
      if (l.mode !== 'tram' || !l.pts || l.pts.length < 4) continue;
      // Gleise genau dort, wo die Bahnen fahren (Fahrwege der Fahrzeuge: je Richtung ein Gleis, in engen Kurven weiter
      // ausholend, hinter den Endhaltestellen der Gleiswechsel); ohne Fahrwege die alte Lage neben der Linienmitte
      const tracks = trackLines(g, l);
      if (tracks.length) {
        for (const pts of tracks) {
          for (const o of [-0.065, 0.065]) strip(rails, null, g, pts, o, 0.018, 0.021, null);
          const n = pts.length / 2;
          for (let k = 0; k < n - 1; k++) wires.push(pts[k * 2] - W2, yAt(g, pts[k * 2], pts[k * 2 + 1], 0.5), pts[k * 2 + 1] - H2, pts[k * 2 + 2] - W2, yAt(g, pts[k * 2 + 2], pts[k * 2 + 3], 0.5), pts[k * 2 + 3] - H2);
        }
      } else {
        for (const o of [-0.215, -0.085, 0.085, 0.215]) strip(rails, null, g, l.pts, o, 0.018, 0.021, null);
        const n = l.pts.length / 2;
        for (let k = 0; k < n - 1; k++) {
          const ax = l.pts[k * 2], ay = l.pts[k * 2 + 1], bx = l.pts[k * 2 + 2], by = l.pts[k * 2 + 3];
          const L = Math.hypot(bx - ax, by - ay); if (L < 1e-5) continue;
          const nx = -(by - ay) / L, ny = (bx - ax) / L;
          for (const o of [-0.15, 0.15]) wires.push(ax + nx * o - W2, yAt(g, ax, ay, 0.5), ay + ny * o - H2, bx + nx * o - W2, yAt(g, bx, by, 0.5), by + ny * o - H2);
        }
      }
      for (const t of l.path) {
        const x = t % g.W, y = (t / g.W) | 0;
        if ((x + y) % 2 || seenPole.has(t) || g.world.terrain[t] === TER.WATER) continue;
        seenPole.add(t);
        const m = (g.road[t - 1] || g.road[t + 1]) && !(g.road[t - g.W] || g.road[t + g.W]) ? 'ew' : 'ns';
        const half = g.road[t] === R.AVENUE ? 0.43 : 0.33;
        poles.push([x + 0.5 - W2, y + 0.5 - H2, m, half]);
      }
    }
    if (rails.length) this.group.add(flatMesh(rails, null, this.railMat));
    if (wires.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3));
      const ls = new THREE.LineSegments(geo, this.wireMat);
      ls.frustumCulled = false;
      this.group.add(ls);
    }
    if (poles.length) {
      const pg = merge([cyl(0.012, 0.014, 0.56, 0, 0.28, 0, 0x4a4f57, 6)]);
      const bar = merge([box(1, 0.012, 0.012, 0, 0.52, 0, 0x4a4f57)]);
      const pm = new THREE.InstancedMesh(pg, this.solidMat, poles.length * 2);
      const bm = new THREE.InstancedMesh(bar, this.solidMat, poles.length);
      let n = 0;
      poles.forEach(([x, z, m, half], i) => {
        for (const s of [-1, 1]) { this.m4.makeTranslation(m === 'ew' ? x : x + s * half, 0, m === 'ew' ? z + s * half : z); pm.setMatrixAt(n++, this.m4); }
        this.m4.makeRotationY(m === 'ew' ? Math.PI / 2 : 0).scale(new THREE.Vector3(half * 2, 1, 1)).setPosition(x, 0, z);
        bm.setMatrixAt(i, this.m4);
      });
      pm.count = n; bm.count = poles.length;
      pm.castShadow = true;
      this.group.add(pm, bm);
    }
    // Haltestellen
    this.buildStops(T);
    // Hauptbahnhof: Gleise, Bahnsteig, Tunnelportale
    this.buildStations(T);
    // Fährrouten (gestrichelt)
    const fr = [];
    for (const f of T.ferries) {
      const n = f.pts.length / 2;
      for (let k = 0; k < n - 1; k += 2) fr.push(f.pts[k * 2] - W2, -0.12, f.pts[k * 2 + 1] - H2, f.pts[k * 2 + 2] - W2, -0.12, f.pts[k * 2 + 3] - H2);
    }
    if (fr.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(fr, 3));
      this.ferryLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
      this.ferryLines.frustumCulled = false;
      this.group.add(this.ferryLines);
    } else this.ferryLines = null;
    // Ampeln (Masten)
    this.buildSignals(T);
  }

  buildStops(T) {
    const g = this.g;
    const stops = T.stops;
    this.stopPos = [];
    if (!stops.length) return;
    const shelters = !(this.e.roads && this.e.roads.drawsBusStops);
    const poleGeo = merge([cyl(0.01, 0.012, 0.3, 0, 0.15, 0, 0x8a9099, 6)]);
    const signGeo = new THREE.BoxGeometry(0.1, 0.1, 0.012);
    const bandGeo = merge([box(0.1, 0.022, 0.014, 0, 0, 0, 0xffffff)]);
    const markGeo = merge([box(1, 0.004, 0.022, 0, 0, 0, 0xf2c230)]);
    const platGeo = merge([box(1, 0.035, 0.14, 0, 0.0175, 0, 0xc9c4b8), box(1, 0.037, 0.018, 0, 0.0185, -0.06, 0xf2f2ee)]);
    const shelterGeo = merge([box(0.34, 0.018, 0.15, 0, 0.27, 0, 0x3a4048), box(0.012, 0.26, 0.012, -0.16, 0.13, 0.06, 0x6a7078), box(0.012, 0.26, 0.012, 0.16, 0.13, 0.06, 0x6a7078), box(0.3, 0.025, 0.06, 0, 0.07, -0.02, 0x8a6a4a)]);
    const glassGeo = new THREE.BoxGeometry(0.32, 0.22, 0.008);
    const n = stops.length;
    const pole = new THREE.InstancedMesh(poleGeo, this.solidMat, n);
    const sign = new THREE.InstancedMesh(signGeo, this.signMat, n);
    const band = new THREE.InstancedMesh(bandGeo, this.solidMat, n * 4);
    const mark = new THREE.InstancedMesh(markGeo, this.solidMat, n);
    const plat = new THREE.InstancedMesh(platGeo, this.solidMat, n);
    const shel = shelters ? new THREE.InstancedMesh(shelterGeo, this.solidMat, n) : null;
    const glass = shelters ? new THREE.InstancedMesh(glassGeo, this.glassMat, n) : null;
    let nb = 0, np = 0;
    const lm = new Map(T.lines.map((l) => [l.id, l]));
    stops.forEach((s, i) => {
      const w = TPS.stopWorld(g, s);
      const dirx = -w.nz, dirz = w.nx; // entlang der Straße
      const yaw = Math.atan2(dirx, dirz);
      const y0 = g.world.terrain[s.tile] === TER.WATER ? 0.24 : 0.012;
      const px = w.x + w.nx * 0.06, pz = w.z + w.nz * 0.06;
      this.stopPos.push({ x: px, z: pz, nx: w.nx, nz: w.nz, dx: dirx, dz: dirz, y: y0, s });
      this.m4.makeTranslation(px + dirx * 0.3, y0, pz + dirz * 0.3); pole.setMatrixAt(i, this.m4);
      this.q.setFromAxisAngle(this.yAxis, yaw);
      this.p.set(px + dirx * 0.3, y0 + 0.33, pz + dirz * 0.3); this.m4.compose(this.p, this.q, this.s); sign.setMatrixAt(i, this.m4);
      s.lines.slice(0, 4).forEach((id, k) => {
        const l = lm.get(id); if (!l) return;
        this.p.set(px + dirx * 0.3, y0 + 0.265 - k * 0.026, pz + dirz * 0.3); this.m4.compose(this.p, this.q, this.s);
        band.setMatrixAt(nb, this.m4); band.setColorAt(nb, this.c.setHex(TPS.lineColor(l))); nb++;
      });
      // Markierung auf der Fahrbahn (gelb) bzw. Bahnsteigkante (Straßenbahn)
      const road = g.road[s.tile];
      const half = road === R.AVENUE ? 0.42 : road === R.LANE ? 0.21 : 0.3;
      const cx = s.x + 0.5 - g.W / 2, cz = s.y + 0.5 - g.H / 2;
      if (s.hasTram) {
        this.p.set(cx + w.nx * (half - 0.07), y0, cz + w.nz * (half - 0.07));
        this.q.setFromAxisAngle(this.yAxis, Math.atan2(w.nx, w.nz));
        this.m4.compose(this.p, this.q, new THREE.Vector3(0.9, 1, 1)); plat.setMatrixAt(np++, this.m4);
      } else {
        this.p.set(cx + w.nx * (half - 0.05), y0 + 0.006, cz + w.nz * (half - 0.05));
        this.q.setFromAxisAngle(this.yAxis, Math.atan2(w.nx, w.nz));
        this.m4.compose(this.p, this.q, new THREE.Vector3(0.75, 1, 1)); mark.setMatrixAt(i, this.m4);
      }
      if (shel) {
        this.q.setFromAxisAngle(this.yAxis, Math.atan2(w.nx, w.nz) + Math.PI);
        this.p.set(px + w.nx * 0.06, y0, pz + w.nz * 0.06); this.m4.compose(this.p, this.q, this.s); shel.setMatrixAt(i, this.m4);
        this.p.set(px + w.nx * 0.12, y0 + 0.14, pz + w.nz * 0.12); this.m4.compose(this.p, this.q, this.s); glass.setMatrixAt(i, this.m4);
      }
    });
    // Netzplan-Punkte auf der Fahrbahn (nur hervorgehoben)
    const dotGeo = merge([
      part(new THREE.CircleGeometry(0.17, 20).rotateX(-Math.PI / 2), 0xffffff),
      part(new THREE.RingGeometry(0.17, 0.25, 20).rotateX(-Math.PI / 2), 0x1d2330),
    ]);
    const dots = new THREE.InstancedMesh(dotGeo, this.dotMat, n);
    stops.forEach((s, i) => {
      const y0 = g.world.terrain[s.tile] === TER.WATER ? 0.24 : 0;
      const big = s.lines.length > 1 || s.feeder;
      this.m4.makeScale(big ? 1.25 : 1, 1, big ? 1.25 : 1).setPosition(s.x + 0.5 - g.W / 2, y0 + 0.045, s.y + 0.5 - g.H / 2);
      dots.setMatrixAt(i, this.m4);
      dots.setColorAt(i, this.c.setHex(s.crowd > 0.15 ? 0xffb0a8 : 0xffffff));
    });
    dots.count = n;
    dots.renderOrder = 5;
    dots.frustumCulled = false;
    this.group.add(dots);
    mark.count = n; plat.count = np; band.count = nb;
    if (band.instanceColor) band.instanceColor.needsUpdate = true;
    for (const m of [pole, sign, band, mark, plat, shel, glass]) if (m) { m.castShadow = m !== mark; m.receiveShadow = true; m.frustumCulled = false; this.group.add(m); }
    this.shelterMesh = shel;
  }

  buildStations(T) {
    // Gibt es ein Architektur-Modell (G6) für den Hauptbahnhof, zeichnet es Gleise, Bahnsteig und Portale selbst
    if (ARCH && ARCH.train_station) return;
    const g = this.g;
    const L0 = TPS.STATION_LAYOUT;
    const parts = [], railP = [];
    const sleepers = [];
    for (const [bid] of T.rail) {
      const b = g.buildings.get(bid);
      if (!b) continue;
      const def = BUILDINGS.train_station;
      const hw = def.size[0] / 2;
      const rot = (b.rot || 0) * (Math.PI / 2);
      const cx = b.x + b.w / 2 - g.W / 2, cz = b.y + b.h / 2 - g.H / 2;
      const T4 = new THREE.Matrix4().makeRotationY(rot).setPosition(cx, 0, cz);
      const add = (geo) => { geo.applyMatrix4(T4); parts.push(geo); };
      for (const z of L0.tracks) {
        add(box(hw * 2, 0.02, 0.36, 0, 0.01, z, 0x8d877c));
        for (let x = -hw + 0.06; x < hw; x += 0.13) sleepers.push([x, z]);
        for (const o of [-0.072, 0.072]) add(box(hw * 2, 0.014, 0.014, 0, 0.034, z + o, 0x6a6f77));
      }
      const [pz0, pz1] = L0.platform;
      const pw = hw * 2 - L0.portal * 2 - 0.05;
      add(box(pw, 0.07, pz1 - pz0, 0, 0.035, (pz0 + pz1) / 2, 0xbdb6a8));
      add(box(pw, 0.072, 0.014, 0, 0.036, pz0 + 0.012, 0xf2f2ee));
      add(box(pw, 0.072, 0.014, 0, 0.036, pz1 - 0.012, 0xf2f2ee));
      // Tunnelportale an beiden Enden (Betonrahmen, dunkle Öffnung zum Bahnsteig)
      const zMin = -1.0, zMax = -0.03;
      const dz = zMax - zMin, zc = (zMin + zMax) / 2;
      for (const s of [-1, 1]) {
        const xc = s * (hw - L0.portal / 2);
        add(box(L0.portal, 0.46, dz, xc, 0.23, zc, 0x9a958c));
        add(box(L0.portal + 0.06, 0.06, dz + 0.06, xc, 0.47, zc, 0x7d786f));
        add(box(0.006, 0.36, dz - 0.1, s * (hw - L0.portal) - s * 0.004, 0.18, zc, 0x0b0d10));
      }
      void railP;
    }
    if (sleepers.length) {
      // Schwellen pro Bahnhof (Instanzen)
      const sg = merge([box(0.05, 0.012, 0.28, 0, 0.026, 0, 0x5a4a3c)]);
      const sm = new THREE.InstancedMesh(sg, this.solidMat, sleepers.length);
      let k = 0;
      for (const [bid] of T.rail) {
        const b = g.buildings.get(bid); if (!b) continue;
        const rot = (b.rot || 0) * (Math.PI / 2);
        const cx = b.x + b.w / 2 - g.W / 2, cz = b.y + b.h / 2 - g.H / 2;
        const cs = Math.cos(rot), sn = Math.sin(rot);
        const hw = BUILDINGS.train_station.size[0] / 2;
        for (const z of L0.tracks) for (let x = -hw + 0.06; x < hw; x += 0.13) {
          this.q.setFromAxisAngle(this.yAxis, rot);
          this.p.set(cx + x * cs + z * sn, 0, cz - x * sn + z * cs);
          this.m4.compose(this.p, this.q, this.s);
          if (k < sleepers.length) sm.setMatrixAt(k++, this.m4);
        }
      }
      sm.count = k;
      sm.receiveShadow = true;
      this.group.add(sm);
    }
    if (parts.length) { const m = new THREE.Mesh(merge(parts), this.solidMat); m.castShadow = m.receiveShadow = true; this.group.add(m); }
  }

  buildSignals(T) {
    this.sigPoles = [];
    if (this.e.roads && this.e.roads.drawsSignals) { this.sigMesh = null; return; }
    const g = this.g;
    const list = T.signals;
    if (!list.length) { this.sigMesh = null; return; }
    const pg = merge([cyl(0.011, 0.013, 0.36, 0, 0.18, 0, 0x3c4048, 6), box(0.036, 0.11, 0.036, 0, 0.372, 0, 0x22262c)]);
    const pm = new THREE.InstancedMesh(pg, this.solidMat, list.length * 4);
    let n = 0;
    // Ecken: SO (Richtung Norden), NW (Richtung Süden), NO (Richtung Westen), SW (Richtung Osten)
    const corners = [[0.36, 0.36, 'ns'], [-0.36, -0.36, 'ns'], [0.36, -0.36, 'ew'], [-0.36, 0.36, 'ew']];
    for (const i of list) {
      const x = (i % g.W) + 0.5 - g.W / 2, z = ((i / g.W) | 0) + 0.5 - g.H / 2;
      const half = g.road[i] === R.AVENUE ? 0.44 : 0.36;
      for (const [dx, dz, ax] of corners) {
        const px = x + Math.sign(dx) * half, pz = z + Math.sign(dz) * half;
        this.m4.makeTranslation(px, 0.012, pz);
        pm.setMatrixAt(n++, this.m4);
        // Lampe zeigt zum ankommenden Verkehr (rechts vor der Kreuzung)
        this.sigPoles.push({ i, x: px, z: pz, ax, fx: ax === 'ew' ? Math.sign(dx) : 0, fz: ax === 'ns' ? Math.sign(dz) : 0 });
      }
    }
    pm.count = n;
    pm.castShadow = true;
    this.group.add(pm);
    this.sigMesh = pm;
  }

  // ------------------------------------------------------------ pro Bild
  frame(dt, simDt, time, night) {
    const g = this.g, T = TPS.TS(g);
    if (!T) return;
    if (T.version !== this.ver) this.rebuild();
    const hl = this.toolActive || performance.now() - this.panelSeen < 2500 || (this.e.overlay && this.e.overlay.mode === 'ptransport');
    this.highlight += ((hl ? 1 : 0) - this.highlight) * Math.min(1, dt * 6);
    this.ribbonMat.opacity = 0.35 + 0.65 * this.highlight;
    this.glowMat.opacity = 0.5 * this.highlight;
    this.glowMat.visible = this.highlight > 0.02;
    this.dotMat.opacity = this.highlight;
    this.dotMat.visible = this.highlight > 0.02;
    if (this.ferryLines) this.ferryLines.material.opacity = 0.15 + 0.55 * this.highlight;
    this.signMat.emissive.setRGB(night * 0.35, night * 0.32, night * 0.22);
    this.updateSignals(g);
    this.peopleTimer -= dt;
    if (this.peopleTimer <= 0) { this.peopleTimer = 0.4; this.updatePeople(T); }
    this.updateAccidents(g, T, time);
    if (this.previewDirty) { this.previewDirty = false; this.updatePreview(); }
    this.updateFocus(T);
    this.updatePlaceholders(g, T, night, time);
    this.addLights(T, night, time);
  }

  updateSignals(g) {
    const pm = this.sigPoles;
    const lamps = this.lamps;
    if (!this.sigMesh || !pm || !pm.length) { lamps.count = 0; lamps.visible = false; return; }
    let n = 0;
    for (const p of pm) {
      if (n >= 2400) break;
      const ph = TPS.signalPhase(g, p.i);
      const green = p.ax === 'ns' ? ph === 0 : ph === 2;
      const yellow = p.ax === 'ns' ? ph === 1 : ph === 3;
      this.m4.makeTranslation(p.x + p.fx * 0.024, 0.012 + 0.372 + (green ? -0.032 : yellow ? 0 : 0.032), p.z + p.fz * 0.024);
      lamps.setMatrixAt(n, this.m4);
      lamps.setColorAt(n, this.c.setHex(green ? 0x3cff6a : yellow ? 0xffc21a : 0xff2a1a));
      n++;
    }
    lamps.count = n;
    lamps.visible = n > 0;
    lamps.instanceMatrix.needsUpdate = true;
    if (lamps.instanceColor) lamps.instanceColor.needsUpdate = true;
  }

  updatePeople(T) {
    const P = this.people;
    P.near.begin(); P.mid.begin(); P.far.begin();
    const cols = [0x2f5f9a, 0xb5473a, 0x3b4048, 0xe0c060, 0x22a866, 0x8f5ad8, 0xd9d4ca, 0x7a5a3a, 0x5d7f8f, 0x6b2f2a];
    const cam = this.e.camera.position;
    const q = { low: 0.4, medium: 1, high: 1.7, ultra: 2.4 }[this.e.settings && this.e.settings.quality] ?? 1;
    const n2 = (7.5 * Math.sqrt(q)) ** 2, m2 = (15 * Math.sqrt(q)) ** 2;
    const g = this.e.game;
    const wf = wearOf(g.ext && g.ext.weather, g.hour());
    for (const sp of this.stopPos || []) {
      const s = sp.s;
      const w = s.waiting || 0;
      const k = Math.min(7, w > 0 ? Math.max(1, Math.round(Math.sqrt(w) * 1.3)) : 0);
      for (let j = 0; j < k; j++) {
        const along = 0.3 - 0.11 - j * 0.075 + ((s.id * 7 + j * 3) % 5) * 0.006;
        const out = 0.03 + ((s.id + j) % 3) * 0.035;
        const x = sp.x + sp.dx * along + sp.nx * out, z = sp.z + sp.dz * along + sp.nz * out;
        // zur Straße schauen, etwas gestreut; manche zur Seite (Ausschau nach dem Bus)
        const sd = ((s.id * 0.6180339 + j * 0.3819) % 1);
        const yaw = Math.atan2(-sp.nx, -sp.nz) + (sd - 0.5) * 1.2 + (j % 3 === 1 ? 0.7 : 0);
        const kind = sd < 0.08 ? 2 : sd < 0.22 ? 3 : 0;
        const f = baseFeatures(kind, sd) | wearFeatures(wf, kind, sd);
        const sc = kind === 2 ? 0.64 : 0.94 + sd * 0.12;
        this.c.setHex(cols[(s.id * 3 + j * 5) % cols.length]);
        const dx = x - cam.x, dy = sp.y - cam.y, dz = z - cam.z, d2 = dx * dx + dy * dy + dz * dz;
        const b = d2 < n2 ? P.near : d2 < m2 ? P.mid : P.far;
        b.push(x, sp.y, z, yaw, 0, 0, sc, sc, sc, this.c.r, this.c.g, this.c.b, 0, 0, sd, MODE.WALK + 8 * f);
      }
    }
    P.near.finish(); P.mid.finish(); P.far.finish();
  }

  updateAccidents(g, T, time) {
    const m = this.triangles;
    let n = 0;
    for (const a of T.accidents) {
      if (g.time >= a.until || n >= 60) continue;
      const cx = a.x + 0.5 - g.W / 2, cz = a.y + 0.5 - g.H / 2;
      for (const [dx, dz] of [[0.55, 0.16], [-0.55, -0.16]]) {
        this.m4.makeTranslation(cx + dx, 0.012, cz + dz);
        m.setMatrixAt(n++, this.m4);
      }
    }
    m.count = n;
    m.visible = n > 0;
    m.instanceMatrix.needsUpdate = true;
    void time;
  }

  // Hervorgehobene Linie (Panel → „Zeigen"): breites, pulsierendes Band für einige Sekunden
  updateFocus(T) {
    const now = performance.now();
    if (this.focusDirty || (this.focusMesh && now > this.focusUntil)) {
      this.focusDirty = false;
      if (this.focusMesh) { this.dyn.remove(this.focusMesh); this.focusMesh.geometry.dispose(); this.focusMesh = null; }
      const l = now < this.focusUntil ? T.lines.find((x) => x.id === this.focusLine) : null;
      if (l && l.pts && l.pts.length >= 4) {
        const pos = [], cols = [];
        strip(pos, cols, this.g, l.pts, 0, 0.3, 0.05, TPS.lineColor(l));
        this.focusMesh = flatMesh(pos, cols, this.focusMat);
        this.focusMesh.renderOrder = 6;
        this.dyn.add(this.focusMesh);
      }
    }
    if (this.focusMesh) this.focusMat.opacity = 0.45 + 0.4 * Math.sin(now / 160) ** 2;
  }

  updatePreview() {
    const d = this.preview, g = this.g;
    if (this.previewMesh) { this.dyn.remove(this.previewMesh); this.previewMesh.geometry.dispose(); this.previewMesh = null; }
    this.pendingDots.count = 0;
    this.hoverRing.visible = false;
    if (!d) return;
    const col = d.color || 0xffffff;
    const pos = [], cols = [];
    const tilesToPts = (p) => { const a = new Float32Array(p.length * 2); for (let k = 0; k < p.length; k++) { a[k * 2] = (p[k] % g.W) + 0.5; a[k * 2 + 1] = ((p[k] / g.W) | 0) + 0.5; } return a; };
    for (const p of d.segs || []) strip(pos, cols, g, tilesToPts(p), 0, 0.14, 0.06, col);
    if (d.hoverPath) strip(pos, cols, g, tilesToPts(d.hoverPath), 0, 0.09, 0.06, d.ok ? 0xffffff : 0xff6050);
    if (pos.length) {
      this.previewMesh = flatMesh(pos, cols, this.previewMat);
      this.previewMesh.renderOrder = 11;
      this.dyn.add(this.previewMesh);
    }
    let n = 0;
    for (const t of d.tiles || []) {
      if (n >= 64) break;
      const x = (t % g.W) + 0.5 - g.W / 2, z = ((t / g.W) | 0) + 0.5 - g.H / 2;
      this.m4.makeTranslation(x, yAt(g, x + g.W / 2, z + g.H / 2, 0.08), z);
      this.pendingDots.setMatrixAt(n, this.m4);
      this.pendingDots.setColorAt(n, this.c.setHex(n === 0 ? 0xffffff : col));
      n++;
    }
    this.pendingDots.count = n;
    this.pendingDots.visible = n > 0;
    this.pendingDots.instanceMatrix.needsUpdate = true;
    if (this.pendingDots.instanceColor) this.pendingDots.instanceColor.needsUpdate = true;
    if (d.hover >= 0) {
      const x = (d.hover % g.W) + 0.5 - g.W / 2, z = ((d.hover / g.W) | 0) + 0.5 - g.H / 2;
      this.hoverRing.position.set(x, yAt(g, x + g.W / 2, z + g.H / 2, 0.09), z);
      this.hoverRing.material.color.setHex(d.ok ? 0xffffff : 0xff6050);
      this.hoverRing.visible = true;
    }
  }

  drawsKind(kind) {
    const v = this.e.vehicles;
    if (!v) return false;
    if (v.drawsRenderables === true) return true;
    if (v.drawsKinds && typeof v.drawsKinds.has === 'function') return v.drawsKinds.has(kind);
    return false;
  }

  updatePlaceholders(g, T, night, time) {
    const counts = {};
    for (const k in this.ph) counts[k] = 0;
    const vv = this.e.vehicles;
    if (vv && vv.drawsRenderables === true) {
      // Die Fahrzeug-Ansicht zeichnet alles selbst
      for (const k in this.ph) { this.ph[k].count = 0; this.ph[k].visible = false; }
      this.lastRenderables = [];
      return;
    }
    const sys = g.system('transport');
    const list = sys ? sys.renderables(g) : [];
    this.lastRenderables = list;
    for (const o of list) {
      const m = this.ph[o.kind];
      if (!m || this.drawsKind(o.kind)) continue;
      const i = counts[o.kind]++;
      if (i >= m.instanceMatrix.count) continue;
      this.e2.set(o.pitch || 0, o.yaw || 0, 0, 'YXZ');
      this.q.setFromEuler(this.e2);
      this.p.set(o.x, o.y || 0, o.z);
      const len = o.len || 1;
      this.s.set(o.kind === 'plane' ? len : 1, o.kind === 'plane' ? len : 1, len);
      this.m4.compose(this.p, this.q, this.s);
      m.setMatrixAt(i, this.m4);
      let col = o.color !== undefined ? o.color : 0xffffff;
      if (o.kind === 'police' || o.kind === 'ambulance' || o.kind === 'plane' || o.kind === 'ferry') col = o.kind === 'plane' ? (o.color || 0xffffff) : 0xffffff;
      if (o.wreck) col = 0x6a6f77;
      m.setColorAt(i, this.c.setHex(col));
    }
    this.s.set(1, 1, 1);
    for (const k in this.ph) {
      const m = this.ph[k];
      m.count = Math.min(counts[k], m.instanceMatrix.count);
      m.visible = m.count > 0;
      if (m.count) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    }
    void night; void time;
  }

  addLights(T, night, time) {
    const L = this.e.effects && this.e.effects.lights;
    if (!L || typeof L.add !== 'function') return;
    const g = this.g;
    let added = 0;
    if (night > 0.2) {
      for (const sp of this.stopPos || []) { L.add(sp.x + sp.nx * 0.08, sp.y + 0.27, sp.z + sp.nz * 0.08, 0.22, 1, 0.92, 0.75, 0.45 * night); added++; }
      for (const o of this.lastRenderables || []) {
        if (!o.lights || o.kind === 'plane' && (o.y || 0) > 0.5) continue;
        const fx = Math.sin(o.yaw), fz = Math.cos(o.yaw);
        const h = (o.len || 0.5) / 2 + 0.02;
        L.add(o.x + fx * h, (o.y || 0) + 0.08, o.z + fz * h, 0.16, 1, 0.94, 0.75, 0.5 * night);
        added++;
      }
    }
    // Flugzeuge: Positionslichter, auch am Tag
    for (const o of this.lastRenderables || []) {
      if (o.kind !== 'plane') continue;
      const blink = Math.floor(time * 2 + (o.id || 0)) % 2 === 0;
      if (blink) { L.add(o.x, (o.y || 0) + 0.2, o.z, 0.2, 1, 0.25, 0.2, 0.9); added++; }
    }
    // Unfälle: Warnblinker und Blaulicht
    for (const a of T.accidents) {
      if (g.time >= a.until) continue;
      const cx = a.x + 0.5 - g.W / 2, cz = a.y + 0.5 - g.H / 2;
      const on = Math.floor(time * 5) % 2 === 0;
      L.add(cx, 0.15, cz, 0.35, 1, 0.6, 0.1, on ? 0.9 : 0.2);
      if (a.police) L.add(cx + 0.42, 0.2, cz + 0.3, 0.3, 0.2, 0.3, 1, on ? 0.2 : 0.9);
      added += 2;
    }
    if (added && typeof L.end === 'function') L.end();
  }
});
