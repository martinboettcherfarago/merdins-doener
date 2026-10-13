// Straßen-Ansicht (Besitzer: G8): echte Straßengeometrie statt Kacheltextur.
//  - Fahrbahn, erhöhte Bordsteine mit Bordsteinkante, Gehwege, Mittelstreifen mit Bäumen, Kurven als Kreisbögen,
//    abgerundete Ecken an Kreuzungen, Wendehammer an Sackgassen, Übergänge zwischen Straßenbreiten (ROAD_GEOM).
//  - Markierungen: Leitlinien, Fahrstreifen, Randlinien, Zebrastreifen, Haltelinien, Haifischzähne, Pfeile,
//    Bus-Zickzack, dazu Abnutzung (Reifenspuren, Flicken, Risse, Kanaldeckel, Gullys).
//  - Ampeln mit wechselnden Phasen (Shader, Spielzeit), Vorfahrtschilder, Straßennamen.
//  - Brücken (Steinbögen bzw. Betonpfeiler, Brüstung/Geländer, Rampen), Autobahn mit Leitplanken, Betonschutzwand,
//    Schilderbrücke, Ortstafel und Viadukt in den Dunst.
//  - Stadtmobiliar über streetprops.js (Laternen mit Lichtkegel, Bäume, Bänke, Haltestellen, parkende Autos …).
// Aufteilung in Blöcke (CHUNK × CHUNK Felder): Neubau nur für Blöcke, deren Felder sich geändert haben.
// Pro Block: 1 Draw Call Atlas (Flächen + große Teile), 1 Detail (Kleinteile, nur nah), 1 Markierungen, 1 Leuchtteile,
// nachts 1 Lichtkegel, in der Verkehrsansicht 1 Einfärbung.
// Öffentliche Schnittstelle (scene.js, overlay.js): rebuild(), setTrafficTint(on), setNight(n), lampPositions, group.
// Zusätzlich: surfaceY(x, z) – Fahrbahnhöhe an einer Weltposition (Brücken/Rampen), signalAt(feld) – Ampelzustand.
import * as THREE from 'three';
import { R, T, Z, ROAD_GEOM, GAME_MIN_PER_SEC } from '../config.js';
import { roadMask } from '../sim/network.js';
import { hash2 } from '../util.js';
import { registerView } from '../registry.js';
import {
  Layer, Brush, MI, roadMaterials, sigTime, signalState, lensOn, busShelter, guardrail, concreteBarrier, gantry, streetNamePlate, SIGN,
  PropSystem, InstanceList,
} from './streetprops.js';

const CHUNK = 32;
export const Y_ROAD = 0.012;
export const Y_BRIDGE = 0.24;
const CW = 0.018;               // Breite des Bordsteins
const PAINT_Y = 0.0018;         // Markierungen über der Fahrbahn
const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N O S W (u = x, v = z)
const CURB_H = { 1: 0.007, 2: 0.014, 3: 0.014, 4: 0.007 };
const DETAIL_DIST = 44;         // Kleinteile nur unterhalb dieser Kameradistanz
const TREE_NEAR = 58;           // darüber Bäume in der einfachen Fassung
const geomW = (t) => (ROAD_GEOM[t] ? ROAD_GEOM[t].width : 0.6);
const lerp = (a, b, t) => a + (b - a) * t;

// Markierungsfarben (RGBA)
const WHITE = [0.95, 0.95, 0.91, 0.93];
const YELLOW = [0.97, 0.74, 0.16, 0.95];
const DARK = (a) => [0.04, 0.04, 0.05, a];

// Kreuzungsart
const J_NONE = 0, J_RVL = 1, J_YIELD_NS = 2, J_YIELD_EW = 3, J_SIGNAL = 4;

export class RoadView {
  constructor(engine) {
    this.e = engine;
    this.g = engine.game;
    const g = this.g;
    this.mats = roadMaterials(engine.renderer, g.name);
    this.group = new THREE.Group();
    this.group.name = 'Straßen';
    engine.scene.add(this.group);
    this.props = new PropSystem(this.group, this.mats);
    this.nCx = Math.ceil(g.W / CHUNK);
    this.nCy = Math.ceil(g.H / CHUNK);
    this.chunks = new Array(this.nCx * this.nCy).fill(null);
    this.sig = new Uint32Array(g.N);
    this.mask = new Uint8Array(g.N);
    this.jclass = new Uint8Array(g.N);
    this.cornerY = new Float32Array((g.W + 1) * (g.H + 1)).fill(Y_ROAD);
    this.lampPositions = [];
    this.signalList = [];
    // Haltestellen-Häuschen und Ampeln zeichnet dieses Modul selbst; die Verkehrsansicht (S3) lässt ihre Platzhalter dann weg.
    this.drawsBusStops = true;
    this.drawsSignals = true;
    this.tintOn = false;
    this.detailOn = true;
    this.night = 0;
    this.first = true;
    this.stopSig = '';
    this.recheckTimer = 0;
    this.softDirty = false;
    this.buildStats = { chunks: 0, ms: 0 };
    this.unbind = [
      g.on('zonesChanged', () => { this.softDirty = true; }),
      g.on('transitChanged', () => { this.softDirty = true; }),
    ];
    this.buildViaduct();
    this.rebuild();
    // Alleebäume zeichnet G8 im Mittelstreifen selbst → die des Geländes abschalten (falls unterstützt)
    const ter = engine.terrain;
    if (ter && typeof ter.avenueTrees === 'boolean' && ter.avenueTrees) { ter.avenueTrees = false; if (ter.refreshTrees) ter.refreshTrees(); }
  }

  // ------------------------------------------------------------ Öffentlich
  rebuild() {
    const t0 = performance.now();
    const g = this.g, W = g.W, H = g.H, N = g.N;
    for (let i = 0; i < N; i++) this.mask[i] = g.road[i] ? roadMask(g, i) : 0;
    this.computeCornerY();
    for (let i = 0; i < N; i++) this.jclass[i] = g.road[i] ? this.junctionClass(i) : J_NONE;
    this.stopMap = this.collectStops();
    const dirty = new Set();
    for (let i = 0; i < N; i++) {
      const s = this.tileSig(i);
      if (s !== this.sig[i]) {
        this.sig[i] = s;
        dirty.add(((((i / W) | 0) / CHUNK) | 0) * this.nCx + (((i % W) / CHUNK) | 0));
      }
    }
    if (this.first) { for (let k = 0; k < this.chunks.length; k++) dirty.add(k); this.first = false; }
    for (const k of dirty) this.buildChunk(k);
    this.props.flush();
    if (dirty.size) {
      this.lampPositions = [...this.viaductLamps];
      this.signalList = [...(this.viaductSignals || [])];
      for (const c of this.chunks) {
        if (!c) continue;
        for (let k = 0; k < c.lamps.length; k++) this.lampPositions.push(c.lamps[k]);
        for (let k = 0; k < c.signals.length; k++) this.signalList.push(c.signals[k]);
      }
      if (this.tintOn) this.setTrafficTint(true);
    }
    this.buildStats = { chunks: dirty.size, ms: Math.round(performance.now() - t0) };
    void H;
  }

  setTrafficTint(on) {
    this.tintOn = on;
    const g = this.g;
    const c = new THREE.Color();
    const green = new THREE.Color(0x45c46b), yellow = new THREE.Color(0xf2c230), red = new THREE.Color(0xe5483c);
    for (const ch of this.chunks) {
      if (!ch || !ch.tint) continue;
      ch.tint.visible = on;
      if (!on) continue;
      const col = ch.tint.geometry.attributes.color;
      for (let k = 0; k < ch.tintTiles.length; k += 3) {
        const i = ch.tintTiles[k], v0 = ch.tintTiles[k + 1], v1 = ch.tintTiles[k + 2];
        const q = g.congestion[i] || 0;
        if (q < 0.6) c.copy(green).lerp(yellow, q / 0.6);
        else c.copy(yellow).lerp(red, Math.min(1, (q - 0.6) / 0.6));
        for (let v = v0; v < v1; v++) col.setXYZW(v, c.r, c.g, c.b, 1);
      }
      col.needsUpdate = true;
    }
  }

  setNight(n) {
    this.night = n;
    const vis = n > 0.04;
    for (const ch of this.chunks) if (ch && ch.light) ch.light.visible = vis;
    if (this.viaduct && this.viaduct.light) this.viaduct.light.visible = vis;
  }

  // Wird jedes Bild von der Hilfsansicht aufgerufen (Ampeltakt, Detailstufe, Haltestellen, Zonen)
  tick(dt) {
    const g = this.g;
    sigTime.value = g.time / GAME_MIN_PER_SEC;
    const fog = this.e.scene.fog;
    if (fog) { this.mats.fog.fogNear.value = fog.near; this.mats.fog.fogFar.value = fog.far; }
    const dist = this.e.rig.cur.dist;
    const det = dist < DETAIL_DIST;
    if (det !== this.detailOn) {
      this.detailOn = det;
      for (const ch of this.chunks) if (ch && ch.detail) ch.detail.visible = det;
    }
    this.props.setState(det, dist < TREE_NEAR, this.night > 0.04);
    this.recheckTimer -= dt;
    if (this.recheckTimer <= 0) {
      this.recheckTimer = 0.5;
      const st = g.ext && g.ext.transport && g.ext.transport.stops;
      const ss = Array.isArray(st) ? st.length + ':' + st.map((s) => `${s.tile}/${s.side}`).join(',') : '';
      if (ss !== this.stopSig) { this.stopSig = ss; this.softDirty = true; }
      const sk = g.ext && g.ext.transport && g.ext.transport._sigKey;
      if (sk !== undefined && sk !== this.sigKey) { this.sigKey = sk; this.softDirty = true; }
      if (this.softDirty) { this.softDirty = false; this.rebuild(); }
    }
    this.signalGlow();
  }

  // Leuchtpunkte der aktiven Ampel-Linsen (für Glanz/Bloom, nachts kräftiger)
  signalGlow() {
    const fx = this.e.effects, L = fx && fx.lights;
    const S = this.signalList;
    if (!L || !L.add || !S || !S.length) return;
    const t = sigTime.value, nk = this.night;
    const size = 0.035 + 0.06 * nk, a = 0.35 + 0.6 * nk;
    const COL = [[1, 0.18, 0.08], [1, 0.62, 0.08], [0.2, 1, 0.5], [1, 0.2, 0.1], [0.3, 1, 0.6]];
    const tg = this.e.rig.target, rad = Math.max(12, this.e.rig.cur.dist * 1.6), r2 = rad * rad;
    for (let k = 0; k < S.length; k += 6) {
      const dx = S[k] - tg.x, dz = S[k + 2] - tg.z;
      if (dx * dx + dz * dz > r2) continue;
      const slot = S[k + 5];
      if (!lensOn(t, S[k + 4], S[k + 3], slot)) continue;
      const c = COL[slot];
      L.add(S[k], S[k + 1], S[k + 2], slot >= 3 ? size * 0.6 : size, c[0], c[1], c[2], a);
    }
    L.end();
  }

  // Fahrbahnhöhe an einer Weltposition (für Fahrzeuge auf Brücken und Rampen)
  surfaceY(wx, wz) {
    const g = this.g, W = g.W, H = g.H;
    const fx = wx + W / 2, fz = wz + H / 2;
    const x = Math.floor(fx), y = Math.floor(fz);
    if (x < 0 || y < 0 || x >= W || y >= H) return Y_ROAD;
    const s = fx - x, r = fz - y, VW = W + 1, cy = this.cornerY;
    const a = cy[y * VW + x], b = cy[y * VW + x + 1], c = cy[(y + 1) * VW + x], d = cy[(y + 1) * VW + x + 1];
    return (1 - s) * (1 - r) * a + s * (1 - r) * b + (1 - s) * r * c + s * r * d;
  }

  // Ampelzustand eines Kreuzungsfelds: null (keine Ampel) oder { ns, ew } mit 'green'|'yellow'|'red'|'redyellow'
  signalAt(i) {
    if (this.jclass[i] !== J_SIGNAL) return null;
    const ph = this.phaseOf(i);
    return { ns: signalState(sigTime.value, ph, 0), ew: signalState(sigTime.value, ph, 1) };
  }

  dispose() {
    for (const u of this.unbind) u();
  }

  // ------------------------------------------------------------ Vorberechnung
  computeCornerY() {
    const g = this.g, W = g.W, H = g.H, VW = W + 1;
    const cy = this.cornerY;
    cy.fill(Y_ROAD);
    const ter = g.world.terrain;
    for (let i = 0; i < g.N; i++) {
      if (!g.road[i] || ter[i] !== T.WATER) continue;
      const x = i % W, y = (i / W) | 0;
      cy[y * VW + x] = cy[y * VW + x + 1] = cy[(y + 1) * VW + x] = cy[(y + 1) * VW + x + 1] = Y_BRIDGE;
    }
    void H;
  }

  junctionClass(i) {
    const g = this.g, W = g.W, m = this.mask[i];
    const deg = (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
    if (deg < 3) return J_NONE;
    let maxT = g.road[i], minT = g.road[i];
    const nbs = [i - W, i + 1, i + W, i - 1];
    for (let d = 0; d < 4; d++) {
      if (!(m & (1 << d))) continue;
      const t = (d === 3 && i % W === 0) ? R.HIGHWAY : g.road[nbs[d]];
      if (t > maxT) maxT = t;
      if (t < minT) minT = t;
    }
    if (maxT <= R.LANE) return J_RVL;
    // Hat das Verkehrssystem (S3) eine Ampelliste, gilt sie (Spieler kann Ampeln an/aus schalten).
    const T = g.ext && g.ext.transport;
    if (T && T.signalSet) { if (T.signalSet.has(i)) return J_SIGNAL; }
    else if (deg === 4 || maxT >= R.AVENUE) return J_SIGNAL;
    // T-Kreuzung von Straßen: Durchgangsachse hat Vorfahrt
    if ((m & 5) === 5) return J_YIELD_NS;
    return J_YIELD_EW;
  }

  phaseOf(i) { return hash2(i % this.g.W, (i / this.g.W) | 0, 913); }

  collectStops() {
    const g = this.g;
    const map = new Map();
    const st = g.ext && g.ext.transport && g.ext.transport.stops;
    if (!Array.isArray(st)) return map;
    for (const s of st) {
      if (!s || typeof s.tile !== 'number' || s.tile < 0 || s.tile >= g.N || !g.road[s.tile]) continue;
      if (!map.has(s.tile)) map.set(s.tile, []);
      map.get(s.tile).push(s);
    }
    return map;
  }

  tileSig(i) {
    const g = this.g, W = g.W;
    const t = g.road[i];
    if (!t) return 0;
    const x = i % W, y = (i / W) | 0;
    let h = Math.imul(t + 7, 2654435761) ^ Math.imul(this.mask[i] + 3, 40503) ^ (g.world.terrain[i] << 9) ^ (this.jclass[i] << 12);
    const VW = W + 1, cy = this.cornerY;
    const cbits = (cy[y * VW + x] > Y_ROAD ? 1 : 0) | (cy[y * VW + x + 1] > Y_ROAD ? 2 : 0) | (cy[(y + 1) * VW + x] > Y_ROAD ? 4 : 0) | (cy[(y + 1) * VW + x + 1] > Y_ROAD ? 8 : 0);
    h = Math.imul(h ^ (cbits << 16), 16777619);
    const nbs = [y > 0 ? i - W : -1, x < W - 1 ? i + 1 : -1, y < g.H - 1 ? i + W : -1, x > 0 ? i - 1 : -1];
    for (let d = 0; d < 4; d++) {
      const j = nbs[d];
      let v = 0;
      if (j >= 0) v = g.road[j] | (this.mask[j] << 3) | (g.world.terrain[j] << 7) | (this.jclass[j] << 9) | (g.zone[j] << 12);
      h = Math.imul(h ^ (v + d * 131071), 16777619);
    }
    if (g.stationAt[i]) h = Math.imul(h ^ 0x5bd1e995, 16777619);
    const st = this.stopMap.get(i);
    if (st) for (const s of st) h = Math.imul(h ^ (Math.imul((s.side | 0) + 11, 97) + 0x9e37), 16777619);
    return (h >>> 0) || 1;
  }

  // ------------------------------------------------------------ Blöcke
  buildChunk(k) {
    const g = this.g, W = g.W;
    const cx = k % this.nCx, cy = (k / this.nCx) | 0;
    const old = this.chunks[k];
    if (old) { for (const m of old.meshes) { this.group.remove(m); m.geometry.dispose(); } }
    this.chunks[k] = null;
    const ctx = this.newCtx();
    const x0 = cx * CHUNK, y0 = cy * CHUNK, x1 = Math.min(g.W, x0 + CHUNK), y1 = Math.min(g.H, y0 + CHUNK);
    let any = false;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * W + x;
      if (!g.road[i]) continue;
      any = true;
      try { this.buildTile(ctx, this.describe(i)); } catch (e) { console.warn('Straßenfeld', i, e); }
    }
    if (!any) { this.props.setChunk(k, null); return; }
    this.chunks[k] = this.finishCtx(ctx);
    this.props.setChunk(k, ctx.inst);
  }

  newCtx() {
    const L = { solid: new Layer('solid', true), detail: new Layer('solid'), paint: new Layer('paint', true), glow: new Layer('glow', true), light: new Layer('light'), tint: new Layer('tint', true) };
    return { L, solid: new Brush(L.solid), detail: new Brush(L.detail), paint: new Brush(L.paint), glow: new Brush(L.glow), light: L.light, lamps: [], tintTiles: [], signals: [], inst: new InstanceList() };
  }

  finishCtx(ctx) {
    const M = this.mats, L = ctx.L;
    const ch = { meshes: [], lamps: ctx.lamps, signals: ctx.signals, tintTiles: ctx.tintTiles, solid: null, detail: null, paint: null, glow: null, light: null, tint: null };
    const inst = (geo, shadow) => {
      const m = new THREE.InstancedMesh(geo, M.solid, 1);
      m.setMatrixAt(0, new THREE.Matrix4());
      m.instanceMatrix.needsUpdate = true;
      m.castShadow = shadow; m.receiveShadow = true;
      m.computeBoundingSphere();
      return m;
    };
    if (!L.solid.empty()) { ch.solid = inst(L.solid.toGeometry(), true); }
    if (!L.detail.empty()) { ch.detail = inst(L.detail.toGeometry(), true); ch.detail.visible = this.detailOn; }
    if (!L.paint.empty()) { ch.paint = new THREE.Mesh(L.paint.toGeometry(), M.paint); ch.paint.receiveShadow = true; ch.paint.renderOrder = 1; }
    if (!L.glow.empty()) { ch.glow = new THREE.Mesh(L.glow.toGeometry(), M.glow); ch.glow.receiveShadow = true; }
    if (!L.light.empty()) { ch.light = new THREE.Mesh(L.light.toGeometry(), M.light); ch.light.renderOrder = 6; ch.light.visible = this.night > 0.04; }
    if (!L.tint.empty()) { ch.tint = new THREE.Mesh(L.tint.toGeometry(), M.tint); ch.tint.renderOrder = 5; ch.tint.visible = this.tintOn; }
    for (const key of ['solid', 'detail', 'paint', 'glow', 'light', 'tint']) if (ch[key]) { ch.meshes.push(ch[key]); this.group.add(ch[key]); }
    return ch;
  }

  // ------------------------------------------------------------ Feldbeschreibung
  describe(i) {
    const g = this.g, W = g.W, H = g.H;
    const x = i % W, y = (i / W) | 0;
    const t = g.road[i];
    const m = this.mask[i];
    const nbs = [y > 0 ? i - W : -1, x < W - 1 ? i + 1 : -1, y < H - 1 ? i + W : -1, x > 0 ? i - 1 : -1];
    const conn = [!!(m & 1), !!(m & 2), !!(m & 4), !!(m & 8)];
    const nt = [0, 0, 0, 0], ndeg = [0, 0, 0, 0], nj = [0, 0, 0, 0], nzone = [0, 0, 0, 0], nwater = [false, false, false, false];
    for (let d = 0; d < 4; d++) {
      const j = nbs[d];
      if (j >= 0) {
        nzone[d] = g.zone[j];
        nwater[d] = g.world.terrain[j] === T.WATER;
        if (g.road[j]) {
          nt[d] = g.road[j]; nj[d] = this.jclass[j];
          const mm = this.mask[j]; ndeg[d] = (mm & 1) + ((mm >> 1) & 1) + ((mm >> 2) & 1) + ((mm >> 3) & 1);
          ndeg[d] |= ((mm & 5) === 5 || (mm & 10) === 10) && ndeg[d] === 2 ? 16 : 0; // 16 = gerade
        }
      } else if (d === 3 && conn[3]) { nt[d] = R.HIGHWAY; ndeg[d] = 2 | 16; }
    }
    const VW = W + 1, cy = this.cornerY;
    const yc = [cy[y * VW + x], cy[y * VW + x + 1], cy[(y + 1) * VW + x], cy[(y + 1) * VW + x + 1]];
    return this.makeDesc({ i, x, y, t, conn, nt, ndeg, nj, nzone, nwater, yc, water: g.world.terrain[i] === T.WATER,
      jclass: this.jclass[i], station: !!g.stationAt[i], stops: this.stopMap.get(i) || null, open: conn.map((c, d) => !c && !(nbs[d] < 0 && d === 3 && t === R.HIGHWAY)) });
  }

  makeDesc(D) {
    const g = this.g;
    D.cx = D.x + 0.5 - g.W / 2;
    D.cz = D.y + 0.5 - g.H / 2;
    D.deg = D.conn.filter(Boolean).length;
    D.own = geomW(D.t) / 2;
    D.hw = D.conn.map((c, d) => (c ? Math.max(D.own, geomW(D.nt[d]) / 2) : D.own));
    D.curbH = CURB_H[D.t] || 0.012;
    D.flat = D.yc[0] === D.yc[1] && D.yc[1] === D.yc[2] && D.yc[2] === D.yc[3];
    D.raised = Math.max(...D.yc) > Y_ROAD + 0.001;
    const [a, b, c, d] = D.yc;
    D.hY = D.flat ? () => a : (u, v) => { const s = u + 0.5, r = v + 0.5; return (1 - s) * (1 - r) * a + s * (1 - r) * b + (1 - s) * r * c + s * r * d; };
    D.straight = D.deg === 2 && ((D.conn[0] && D.conn[2]) || (D.conn[1] && D.conn[3]));
    D.axis = D.straight ? (D.conn[0] ? 0 : 1) : -1; // 0 = Nord-Süd, 1 = Ost-West
    D.median = (D.t === R.AVENUE || D.t === R.HIGHWAY) && ROAD_GEOM[D.t].median ? ROAD_GEOM[D.t].median / 2 : 0;
    D.seed = hash2(D.x, D.y, 4711);
    return D;
  }

  // Welt: Feldmitte + (u, v)
  W(D, u, v, dy = 0) { return [D.cx + u, D.hY(u, v) + dy, D.cz + v]; }

  // ------------------------------------------------------------ Ein Feld
  buildTile(ctx, D) {
    const surf = D.t === R.LANE ? 'pavers' : D.t === R.HIGHWAY ? 'asphalt_dark' : 'asphalt';
    this.emitDeck(ctx, D, surf);
    const P = this.pieces(D);
    const style = this.pieceStyle(D);
    for (const pc of P.side) this.emitPiece(ctx, D, pc.pts, pc.curb, style);
    for (const pc of P.median) this.emitPiece(ctx, D, pc.pts, pc.curb, { top: D.t === R.HIGHWAY ? 'concrete' : 'grass', curb: 'curb', h: D.curbH, wall: 'curb' });
    if (D.water) this.emitBridge(ctx, D);
    else if (D.raised) this.emitRamp(ctx, D);
    this.emitMarkings(ctx, D, P);
    this.emitProps(ctx, D, P);
    // Einfärbung (Verkehrsansicht)
    const tl = ctx.L.tint, v0 = tl.count;
    const y = Math.max(...D.yc) + D.curbH + 0.006;
    const e = 0.5;
    const q = [[D.cx - e, y, D.cz - e], [D.cx + e, y, D.cz - e], [D.cx + e, y, D.cz + e], [D.cx - e, y, D.cz + e]];
    for (const k of [0, 2, 1, 0, 3, 2]) tl.vc(q[k][0], q[k][1], q[k][2], 0, 1, 0, 1, 1, 1, 1);
    ctx.tintTiles.push(D.i, v0, tl.count);
  }

  pieceStyle(D) {
    if (D.t === R.HIGHWAY) return { top: 'grass', curb: 'concrete', h: D.curbH, wall: 'concrete' };
    const wall = D.water ? (this.bridgeStyle(D) === 'stone' ? 'stone_sandstone' : 'concrete') : D.raised ? 'stone_grey' : 'curb';
    return { top: D.water && D.t >= R.AVENUE ? 'concrete' : 'sidewalk', curb: 'curb', h: D.curbH, wall, wallBottom: D.water ? Y_BRIDGE - 0.09 : -0.02 };
  }

  bridgeStyle(D) { return D.t <= R.STREET ? 'stone' : 'concrete'; }

  // Fahrbahnfläche über das ganze Feld (unter den Gehwegen verdeckt)
  emitDeck(ctx, D, surf) {
    const S = ctx.L.solid, mat = MI(surf);
    const n = D.flat ? 1 : 4;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const u0 = -0.5 + a / n, u1 = -0.5 + (a + 1) / n, v0 = -0.5 + b / n, v1 = -0.5 + (b + 1) / n;
      const A = this.W(D, u0, v0), B = this.W(D, u1, v0), C = this.W(D, u1, v1), E = this.W(D, u0, v1);
      S.triUp(mat, ...A, ...B, ...C); S.triUp(mat, ...A, ...C, ...E);
    }
  }

  // ------------------------------------------------------------ Gehweg-/Inselflächen als Polygone
  // Rückgabe: { side: [{pts, curb}], median: [...], arcs: Infos für Markierungen }
  pieces(D) {
    const side = [], median = [];
    const hw = D.hw, own = D.own;
    const out = { side, median, kind: 'none' };
    if (D.deg === 0) {
      const rc = Math.min(0.36, own + 0.1);
      out.kind = 'plaza'; out.rc = rc;
      for (const sg of [-1, 1]) {
        const pts = [[-0.5, 0], [-rc, 0]], curb = [false];
        const n = 10;
        for (let k = 1; k < n; k++) { const a = Math.PI - (k / n) * Math.PI; pts.push([Math.cos(a) * rc, sg * Math.sin(a) * rc]); curb.push(true); }
        pts.push([rc, 0]); curb.push(true);
        pts.push([0.5, 0]); curb.push(false);
        pts.push([0.5, sg * 0.5]); curb.push(false);
        pts.push([-0.5, sg * 0.5]); curb.push(false);
        curb.push(false);
        side.push({ pts, curb });
      }
      return out;
    }
    if (D.deg === 1) {
      const d = D.conn.indexOf(true);
      const f = DIR[d], l = [-f[1], f[0]];
      const rc = Math.min(0.44, Math.max(0.28, own * 1.35));
      const a = Math.min(hw[d], rc * 0.92);
      out.kind = 'deadend'; out.d = d; out.rc = rc; out.a = a;
      const P = (s, lat) => [f[0] * s + l[0] * lat, f[1] * s + l[1] * lat];
      const sB = Math.sqrt(rc * rc - a * a);
      const pts = [P(0.5, a), P(sB, a)], curb = [true];
      const th0 = Math.asin(a / rc), th1 = Math.PI * 2 - th0, n = 18;
      for (let k = 1; k < n; k++) {
        const th = th0 + (k / n) * (th1 - th0);
        pts.push(P(Math.cos(th) * rc, Math.sin(th) * rc)); curb.push(true);
      }
      pts.push(P(sB, -a)); curb.push(true);
      pts.push(P(0.5, -a)); curb.push(true);
      pts.push(P(0.5, -0.5)); curb.push(false);
      pts.push(P(-0.5, -0.5)); curb.push(false);
      pts.push(P(-0.5, 0.5)); curb.push(false);
      pts.push(P(0.5, 0.5)); curb.push(false);
      curb.push(false);
      side.push({ pts, curb: curb.slice(0, pts.length) });
      return out;
    }
    if (D.straight) {
      out.kind = 'straight';
      if (D.axis === 0) {
        side.push({ pts: [[-hw[0], -0.5], [-hw[2], 0.5], [-0.5, 0.5], [-0.5, -0.5]], curb: [true, false, false, false] });
        side.push({ pts: [[hw[2], 0.5], [hw[0], -0.5], [0.5, -0.5], [0.5, 0.5]], curb: [true, false, false, false] });
      } else {
        side.push({ pts: [[0.5, -hw[1]], [-0.5, -hw[3]], [-0.5, -0.5], [0.5, -0.5]], curb: [true, false, false, false] });
        side.push({ pts: [[-0.5, hw[3]], [0.5, hw[1]], [0.5, 0.5], [-0.5, 0.5]], curb: [true, false, false, false] });
      }
      if (D.median) median.push(...this.medianStraight(D));
      return out;
    }
    if (D.deg === 2) {
      // Kurve um die Feldecke zwischen d1 und d2
      let d1 = D.conn.indexOf(true), d2 = D.conn.lastIndexOf(true);
      if (d1 === 0 && d2 === 3) { d1 = 3; d2 = 0; }
      const C = [(DIR[d1][0] + DIR[d2][0]) * 0.5, (DIR[d1][1] + DIR[d2][1]) * 0.5];
      const e1 = [-DIR[d2][0], -DIR[d2][1]], e2 = [-DIR[d1][0], -DIR[d1][1]];
      out.kind = 'curve'; out.C = C; out.e1 = e1; out.e2 = e2; out.d1 = d1; out.d2 = d2;
      const n = 12;
      const arc = (sg) => {
        const p = [];
        for (let k = 0; k <= n; k++) {
          const al = (k / n) * Math.PI / 2;
          const h = lerp(hw[d1], hw[d2], k / n);
          const r = 0.5 + sg * h;
          p.push([C[0] + r * (e1[0] * Math.cos(al) + e2[0] * Math.sin(al)), C[1] + r * (e1[1] * Math.cos(al) + e2[1] * Math.sin(al))]);
        }
        return p;
      };
      const inner = arc(-1), outer = arc(1);
      side.push({ pts: [...inner, C], curb: [...inner.slice(1).map(() => true), false, false] });
      const far = [[C[0] + e2[0], C[1] + e2[1]], [C[0] + e1[0] + e2[0], C[1] + e1[1] + e2[1]], [C[0] + e1[0], C[1] + e1[1]]];
      side.push({ pts: [...outer, ...far], curb: [...outer.slice(1).map(() => true), false, false, false, false] });
      if (D.median) median.push(...this.medianCurve(D, C, e1, e2, d1, d2));
      return out;
    }
    // Kreuzung (T oder X)
    out.kind = 'junction';
    const hx = (D.conn[0] || D.conn[2]) ? Math.max(D.conn[0] ? hw[0] : 0, D.conn[2] ? hw[2] : 0) : own;
    const hz = (D.conn[1] || D.conn[3]) ? Math.max(D.conn[1] ? hw[1] : 0, D.conn[3] ? hw[3] : 0) : own;
    out.hx = hx; out.hz = hz;
    const rf = Math.max(0.02, Math.min(0.1, (0.5 - hx) * 0.75, (0.5 - hz) * 0.75));
    out.rf = rf;
    // Randpunkte der Arme an der Feldkante und an der Kreuzungsfläche
    const armEdge = (d, sg) => {
      // sg: +1 = Seite in Richtung +Querachse
      if (d === 0) return { B: [sg * hw[0], -0.5], K: [sg * hx, -hz] };
      if (d === 2) return { B: [sg * hw[2], 0.5], K: [sg * hx, hz] };
      if (d === 1) return { B: [0.5, sg * hw[1]], K: [hx, sg * hz] };
      return { B: [-0.5, sg * hw[3]], K: [-hx, sg * hz] };
    };
    const quads = [[0, 1, 1, -1], [1, 2, 1, 1], [2, 3, -1, 1], [3, 0, -1, -1]]; // d1, d2, su, sv
    for (const [d1, d2, su, sv] of quads) {
      if (!D.conn[d1] || !D.conn[d2]) continue;
      const a1 = armEdge(d1, d1 === 0 || d1 === 2 ? su : sv), a2 = armEdge(d2, d2 === 0 || d2 === 2 ? su : sv);
      const K = a1.K;
      const un = (p) => { const dx = p[0] - K[0], dy = p[1] - K[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
      const t1 = un(a1.B), t2 = un(a2.B);
      const F1 = [K[0] + t1[0] * rf, K[1] + t1[1] * rf], F2 = [K[0] + t2[0] * rf, K[1] + t2[1] * rf];
      const pts = [a1.B, F1], curb = [true];
      const nf = 5;
      for (let k = 1; k < nf; k++) {
        const s = k / nf, w0 = (1 - s) * (1 - s), w1 = 2 * s * (1 - s), w2 = s * s;
        pts.push([w0 * F1[0] + w1 * K[0] + w2 * F2[0], w0 * F1[1] + w1 * K[1] + w2 * F2[1]]); curb.push(true);
      }
      pts.push(F2); curb.push(true);
      pts.push(a2.B); curb.push(true);
      pts.push([su * 0.5, sv * 0.5]); curb.push(false);
      curb.push(false);
      side.push({ pts, curb: curb.slice(0, pts.length) });
    }
    // fehlende Richtung → gerade Gehwegseite
    for (let dm = 0; dm < 4; dm++) {
      if (D.conn[dm]) continue;
      let pts;
      if (dm === 0) pts = [[-0.5, -hw[3]], [-hx, -hz], [hx, -hz], [0.5, -hw[1]], [0.5, -0.5], [-0.5, -0.5]];
      else if (dm === 2) pts = [[0.5, hw[1]], [hx, hz], [-hx, hz], [-0.5, hw[3]], [-0.5, 0.5], [0.5, 0.5]];
      else if (dm === 1) pts = [[hw[0], -0.5], [hx, -hz], [hx, hz], [hw[2], 0.5], [0.5, 0.5], [0.5, -0.5]];
      else pts = [[-hw[2], 0.5], [-hx, hz], [-hx, -hz], [-hw[0], -0.5], [-0.5, -0.5], [-0.5, 0.5]];
      side.push({ pts, curb: [true, true, true, false, false, false] });
    }
    return out;
  }

  // Setzt sich der Mittelstreifen über die Kante d fort?
  medianContinues(D, d) {
    if (!D.conn[d]) return false;
    const t = D.nt[d];
    if (t !== R.AVENUE && t !== R.HIGHWAY) return false;
    return (D.ndeg[d] & 15) === 2;
  }
  // Abstand des Mittelstreifen-Endes von der Kante d (wenn nicht fortgesetzt)
  medianGap(D, d) {
    if (this.zebraOn(D, d)) return 0.3;
    return 0.06;
  }

  medianStraight(D) {
    const mh = D.median;
    const ax = D.axis;
    // Längskoordinate s (−0.5 … 0.5) entlang der Achse, Querkoordinate q
    const dA = ax === 0 ? 0 : 3, dB = ax === 0 ? 2 : 1; // Enden: Nord/West = −, Süd/Ost = +
    const cA = this.medianContinues(D, dA), cB = this.medianContinues(D, dB);
    const sA = cA ? -0.5 : -0.5 + this.medianGap(D, dA), sB = cB ? 0.5 : 0.5 - this.medianGap(D, dB);
    if (sB - sA < 0.12) return [];
    const P = (s, q) => (ax === 0 ? [q, s] : [s, q]);
    const pts = [], curb = [];
    // +q-Seite von A nach B
    pts.push(P(sA, mh)); curb.push(true);
    pts.push(P(sB, mh));
    if (cB) { curb.push(false); pts.push(P(sB, -mh)); curb.push(true); }
    else {
      curb.push(true);
      const n = 6;
      for (let k = 1; k < n; k++) { const a = Math.PI / 2 - (k / n) * Math.PI; pts.push(P(sB + Math.cos(a) * mh * 0.9, Math.sin(a) * mh)); curb.push(true); }
      pts.push(P(sB, -mh)); curb.push(true);
    }
    pts.push(P(sA, -mh));
    if (cA) curb.push(false);
    else {
      curb.push(true);
      const n = 6;
      for (let k = 1; k < n; k++) { const a = -Math.PI / 2 - (k / n) * Math.PI; pts.push(P(sA + Math.cos(a) * mh * 0.9, Math.sin(a) * mh)); curb.push(true); }
      curb.push(true);
    }
    return [{ pts, curb: curb.slice(0, pts.length), sA, sB }];
  }

  medianCurve(D, C, e1, e2, d1, d2) {
    const mh = D.median;
    const c1 = this.medianContinues(D, d1), c2 = this.medianContinues(D, d2);
    const g1 = c1 ? 0 : this.medianGap(D, d1) / 0.5, g2 = c2 ? 0 : this.medianGap(D, d2) / 0.5;
    const a0 = g1, a1 = Math.PI / 2 - g2;
    if (a1 - a0 < 0.2) return [];
    const n = 12;
    const at = (al, r) => [C[0] + r * (e1[0] * Math.cos(al) + e2[0] * Math.sin(al)), C[1] + r * (e1[1] * Math.cos(al) + e2[1] * Math.sin(al))];
    const pts = [], curb = [];
    for (let k = 0; k <= n; k++) { pts.push(at(a0 + (k / n) * (a1 - a0), 0.5 + mh)); curb.push(true); }
    curb[curb.length - 1] = !c2;
    for (let k = n; k >= 0; k--) { pts.push(at(a0 + (k / n) * (a1 - a0), 0.5 - mh)); curb.push(true); }
    curb[curb.length - 1] = !c1;
    return [{ pts, curb }];
  }

  // Polygon mit Bordstein-Kanten → Oberfläche, Bordstein (Oberseite + Stirn), offene Außenwände
  emitPiece(ctx, D, ptsIn, curbIn, st) {
    let pts = ptsIn, curb = curbIn;
    const n = pts.length;
    if (n < 3) return;
    let area = 0;
    for (let k = 0; k < n; k++) { const a = pts[k], b = pts[(k + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
    if (area < 0) {
      const np = [], nc = [];
      for (let j = 0; j < n; j++) { np.push(pts[n - 1 - j]); nc.push(curb[(n - 2 - j + n) % n]); }
      pts = np; curb = nc;
    }
    const dir = [], nl = [];
    for (let k = 0; k < n; k++) {
      const a = pts[k], b = pts[(k + 1) % n];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1e-6;
      dir.push([dx / l, dy / l]); nl.push([-dy / l, dx / l]);
    }
    const q = pts.map((p, k) => {
      const kp = (k - 1 + n) % n;
      const cP = curb[kp], cN = curb[k];
      if (cP && cN) {
        let mx = nl[kp][0] + nl[k][0], my = nl[kp][1] + nl[k][1];
        const ml = Math.hypot(mx, my);
        if (ml < 1e-4) { mx = nl[k][0]; my = nl[k][1]; } else { mx /= ml; my /= ml; }
        const dd = Math.max(0.5, mx * nl[k][0] + my * nl[k][1]);
        return [p[0] + mx * CW / dd, p[1] + my * CW / dd];
      }
      if (cP && !cN) {
        const dd = Math.max(0.25, dir[k][0] * nl[kp][0] + dir[k][1] * nl[kp][1]);
        return [p[0] + dir[k][0] * CW / dd, p[1] + dir[k][1] * CW / dd];
      }
      if (!cP && cN) {
        const bx = -dir[kp][0], by = -dir[kp][1];
        const dd = Math.max(0.25, bx * nl[k][0] + by * nl[k][1]);
        return [p[0] + bx * CW / dd, p[1] + by * CW / dd];
      }
      return p;
    });
    const S = ctx.L.solid, h = st.h;
    const mTop = MI(st.top), mCurb = MI(st.curb), mWall = MI(st.wall || st.curb);
    // Oberfläche
    const contour = q.map((p) => new THREE.Vector2(p[0], p[1]));
    let faces = [];
    try { faces = THREE.ShapeUtils.triangulateShape(contour, []); } catch (e) { faces = []; }
    for (const f of faces) {
      const a = q[f[0]], b = q[f[1]], c = q[f[2]];
      S.triUp(mTop, ...this.W(D, a[0], a[1], h), ...this.W(D, b[0], b[1], h), ...this.W(D, c[0], c[1], h));
    }
    // Bordstein
    for (let k = 0; k < n; k++) {
      if (!curb[k]) continue;
      const k1 = (k + 1) % n;
      const a = pts[k], b = pts[k1], a2 = q[k], b2 = q[k1];
      const A = this.W(D, a[0], a[1], h), B = this.W(D, b[0], b[1], h), A2 = this.W(D, a2[0], a2[1], h), B2 = this.W(D, b2[0], b2[1], h);
      S.triUp(mCurb, ...A, ...B, ...B2); S.triUp(mCurb, ...A, ...B2, ...A2);
      const Ab = this.W(D, a[0], a[1], -0.003), Bb = this.W(D, b[0], b[1], -0.003);
      this.wall(S, mCurb, Ab, Bb, B, A, -nl[k][0], -nl[k][1]);
    }
    // offene Außenkanten (Feldrand ohne Nachbarstraße)
    for (let k = 0; k < n; k++) {
      if (curb[k]) continue;
      const a = pts[k], b = pts[(k + 1) % n];
      const d = edgeOf(a, b);
      if (d < 0 || !D.open[d]) continue;
      const A = this.W(D, a[0], a[1], h), B = this.W(D, b[0], b[1], h);
      const yb = st.wallBottom ?? -0.02;
      this.wall(S, mWall, [A[0], yb, A[2]], [B[0], yb, B[2]], B, A, -nl[k][0], -nl[k][1]);
    }
  }

  // senkrechte Wand (Viereck) mit gewünschter Außennormale (nx, nz)
  wall(S, mat, A, B, C, E, nx, nz) {
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const cx = uy * vz - uz * vy, cz = ux * vy - uy * vx;
    if (cx * nx + cz * nz >= 0) { S.tri(mat, ...A, ...B, ...C); S.tri(mat, ...A, ...C, ...E); }
    else { S.tri(mat, ...A, ...C, ...B); S.tri(mat, ...A, ...E, ...C); }
  }

  // ------------------------------------------------------------ Brücken und Rampen
  emitBridge(ctx, D) {
    const S = ctx.L.solid;
    const style = this.bridgeStyle(D);
    const top = Y_BRIDGE, bot = Y_BRIDGE - 0.09;
    const mStone = MI(style === 'stone' ? 'stone_sandstone' : 'concrete');
    // Unterseite
    const c = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([u, v]) => [D.cx + u, bot, D.cz + v]);
    S.tri(mStone, ...c[0], ...c[1], ...c[2]); S.tri(mStone, ...c[0], ...c[2], ...c[3]);
    // Gesims + Brüstung/Geländer an offenen Kanten
    const yTop = top + D.curbH;
    for (let d = 0; d < 4; d++) {
      if (!D.open[d]) continue;
      const f = DIR[d], l = [-f[1], f[0]];
      const P = (s, q) => [D.cx + f[0] * q + l[0] * s, D.cz + f[1] * q + l[1] * s];
      const yaw = Math.atan2(l[0], l[1]);
      const [mx, mz] = P(0, 0.5);
      const b = ctx.solid.at(mx, yTop, mz, yaw);
      // Gesims (leicht vorstehend)
      b.m(style === 'stone' ? 'stone_sandstone' : 'concrete');
      ctx.solid.at(mx + f[0] * 0.008, top - 0.012, mz + f[1] * 0.008, yaw).box(0, 0, 0, 0.016, 0.016, 1.0);
      if (style === 'stone') {
        b.at(mx - f[0] * 0.012, yTop, mz - f[1] * 0.012, yaw).m('stone_sandstone');
        b.box(0, 0, 0, 0.022, 0.05, 1.0);
        b.m('trim_stone');
        b.box(0, 0.05, 0, 0.03, 0.008, 1.0);
      } else {
        b.at(mx - f[0] * 0.01, yTop, mz - f[1] * 0.01, yaw).m('concrete');
        b.box(0, 0, 0, 0.018, 0.016, 1.0);
        b.m('metal_light');
        b.box(0, 0.06, 0, 0.012, 0.006, 1.0);
        b.box(0, 0.035, 0, 0.004, 0.004, 1.0);
        for (let k = 0; k <= 10; k++) b.box(0, 0.016, -0.5 + k * 0.1, 0.005, 0.045, 0.005);
      }
    }
    if (D.straight) {
      const ax = D.axis;
      const along = ax === 0 ? [0, 1] : [1, 0], lat = ax === 0 ? [1, 0] : [0, 1];
      const Pw = (s, q, y) => [D.cx + along[0] * s + lat[0] * q, y, D.cz + along[1] * s + lat[1] * q];
      if (style === 'stone') {
        // Segmentbogen: Kämpfer bei s = ±0.45, Scheitel knapp unter der Fahrbahnplatte
        const ys = -0.06, yc = bot - 0.035, sp = 0.45;
        const yk = (yc * yc - ys * ys - sp * sp) / (2 * (yc - ys)), rk = yc - yk;
        const ybed = -1.0;
        const arch = [];
        const na = 12;
        for (let k = 0; k <= na; k++) { const s = sp - (k / na) * 2 * sp; arch.push([s, yk + Math.sqrt(Math.max(0, rk * rk - s * s))]); }
        const poly = [[-0.5, bot], [0.5, bot], [0.5, ybed], [sp, ybed], ...arch, [-sp, ybed], [-0.5, ybed]];
        const contour = poly.map((p) => new THREE.Vector2(p[0], p[1]));
        const faces = THREE.ShapeUtils.triangulateShape(contour, []);
        for (const sg of [-1, 1]) {
          const q = sg * 0.5;
          for (const f of faces) {
            const A = Pw(poly[f[0]][0], q, poly[f[0]][1]), B = Pw(poly[f[1]][0], q, poly[f[1]][1]), C = Pw(poly[f[2]][0], q, poly[f[2]][1]);
            this.orientTri(S, mStone, A, B, C, lat[0] * sg, 0, lat[1] * sg);
          }
        }
        // Gewölbe-Unterseite
        for (let k = 0; k < na; k++) {
          const [s0, y0] = arch[k], [s1, y1] = arch[k + 1];
          const A = Pw(s0, -0.5, y0), B = Pw(s1, -0.5, y1), C = Pw(s1, 0.5, y1), E = Pw(s0, 0.5, y0);
          const sm = (s0 + s1) / 2, ym = (y0 + y1) / 2;
          const nx = -sm, ny = yk - ym;
          this.orientQuad(S, mStone, A, B, C, E, along[0] * nx, ny, along[1] * nx);
        }
        // Pfeiler-Innenflächen unter dem Kämpfer
        for (const sg of [-1, 1]) {
          const s = sg * sp;
          const A = Pw(s, -0.5, ybed), B = Pw(s, 0.5, ybed), C = Pw(s, 0.5, arch[sg > 0 ? 0 : na][1]), E = Pw(s, -0.5, arch[sg > 0 ? 0 : na][1]);
          this.orientQuad(S, mStone, A, B, C, E, -along[0] * sg, 0, -along[1] * sg);
        }
        // Pfeilerköpfe (Wellenbrecher) an der Feldgrenze, wenn das Nachbarfeld auch Brücke ist
        const dPlus = ax === 0 ? 2 : 1;
        if (D.conn[dPlus] && D.nwater[dPlus]) {
          for (const sg of [-1, 1]) {
            const [px, , pz] = Pw(0.5, sg * 0.5, 0);
            const b = ctx.solid.at(px, ybed, pz, Math.atan2(lat[0] * sg, lat[1] * sg)).m('stone_sandstone');
            b.box(0, 0, 0.025, 0.1, ys - ybed + 0.02, 0.05);
            b.m('stone_grey');
            b.box(0, ys - ybed + 0.02, 0.025, 0.11, 0.012, 0.055);
          }
        }
        // Widerlager an Land
        for (const [dd, s] of [[ax === 0 ? 0 : 3, -0.5], [dPlus, 0.5]]) {
          if (D.nwater[dd]) continue;
          const [px, , pz] = Pw(s, 0, 0);
          const b = ctx.solid.at(px, -0.5, pz, Math.atan2(along[0], along[1])).m('stone_sandstone');
          b.box(0, 0, 0, 1.06, bot + 0.5, 0.08);
        }
      } else {
        // Betonbrücke: Plattenbalken auf zwei Rundstützen mit Querträger
        const ybed = -1.0;
        const b = ctx.solid;
        const [px, , pz] = Pw(0, 0, 0);
        b.at(px, 0, pz, Math.atan2(along[0], along[1])).m('concrete');
        for (const q of [-0.26, 0.26]) b.at(px + lat[0] * q, ybed, pz + lat[1] * q, 0).cyl(0, 0, 0, 0.05, 0.045, bot - ybed - 0.04, 10, 0);
        b.at(px, bot - 0.045, pz, Math.atan2(lat[0], lat[1])).m('concrete');
        b.box(0, 0, 0, 0.09, 0.045, 0.72);
        // Längsträger-Andeutung (Kante unter der Platte)
        for (const q of [-0.4, 0.4]) {
          const [qx, , qz] = Pw(0, q, 0);
          b.at(qx, bot - 0.03, qz, Math.atan2(along[0], along[1])).m('concrete_dark').box(0, 0, 0, 0.06, 0.03, 1.0);
        }
      }
    } else {
      // Kurven/Kreuzungen auf dem Wasser: ein kräftiger Pfeiler in der Mitte
      ctx.solid.at(D.cx, -1.0, D.cz, 0).m(style === 'stone' ? 'stone_sandstone' : 'concrete').cyl(0, 0, 0, 0.12, 0.1, bot + 1.0, 12, 0);
    }
  }

  orientTri(S, mat, A, B, C, nx, ny, nz) {
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (cx * nx + cy * ny + cz * nz >= 0) S.tri(mat, ...A, ...B, ...C); else S.tri(mat, ...A, ...C, ...B);
  }
  orientQuad(S, mat, A, B, C, E, nx, ny, nz) { this.orientTri(S, mat, A, B, C, nx, ny, nz); this.orientTri(S, mat, A, C, E, nx, ny, nz); }

  // Rampe zur Brücke an Land: Stützmauer bis zum Boden (über emitPiece) + Geländer, wenn hoch
  emitRamp(ctx, D) {
    for (let d = 0; d < 4; d++) {
      if (!D.open[d]) continue;
      const f = DIR[d], l = [-f[1], f[0]];
      const steps = 6;
      for (let k = 0; k < steps; k++) {
        const s0 = -0.5 + k / steps, s1 = -0.5 + (k + 1) / steps;
        const ua = f[0] * 0.49 + l[0] * s0, va = f[1] * 0.49 + l[1] * s0, ub = f[0] * 0.49 + l[0] * s1, vb = f[1] * 0.49 + l[1] * s1;
        const ya = D.hY(ua, va) + D.curbH, yb = D.hY(ub, vb) + D.curbH;
        if (Math.max(ya, yb) < Y_ROAD + 0.07) continue;
        const b = ctx.solid.m('metal_dark');
        b.at(0, 0, 0, 0).beam(D.cx + ua, ya + 0.05, D.cz + va, D.cx + ub, yb + 0.05, D.cz + vb, 0.008);
        b.beam(D.cx + ua, ya, D.cz + va, D.cx + ua, ya + 0.05, D.cz + va, 0.006);
      }
    }
  }

  // ------------------------------------------------------------ Markierungen
  // Querschnitt eines geraden Felds als Funktion: Halbbreite an Stelle s
  zebraOn(D, d) {
    // Zebrastreifen auf diesem (geraden) Feld vor der Kreuzung in Richtung d
    if (!D.straight || !D.conn[d]) return false;
    const j = D.nj[d];
    if (j === J_NONE || j === J_RVL) return false;
    return D.t >= R.STREET || j === J_SIGNAL;
  }

  pv(ctx, D, u, v, col, dy = 0) {
    const [x, y, z] = this.W(D, u, v, PAINT_Y + dy);
    ctx.L.paint.vc(x, y, z, 0, 1, 0, col[0], col[1], col[2], col[3], x * 1.7, z * 1.7);
  }
  // Viereck auf der Fahrbahn (u,v-Punkte), Ausrichtung nach oben
  pquad(ctx, D, a, b, c, d, col, dy = 0) {
    const cr = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
    const o = cr >= 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
    for (const p of o) this.pv(ctx, D, p[0], p[1], col, dy);
  }
  ptri(ctx, D, a, b, c, col, dy = 0) {
    const cr = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
    const o = cr >= 0 ? [a, b, c] : [a, c, b];
    for (const p of o) this.pv(ctx, D, p[0], p[1], col, dy);
  }
  // Strich von a nach b mit Breite w
  pline(ctx, D, a, b, w, col, dy = 0) {
    const dx = b[0] - a[0], dv = b[1] - a[1], l = Math.hypot(dx, dv) || 1e-6;
    const nx = -dv / l * w / 2, nv = dx / l * w / 2;
    this.pquad(ctx, D, [a[0] + nx, a[1] + nv], [b[0] + nx, b[1] + nv], [b[0] - nx, b[1] - nv], [a[0] - nx, a[1] - nv], col, dy);
  }
  ppoly(ctx, D, pts, w, col, closed = false, dy = 0) {
    for (let k = 0; k < pts.length - 1; k++) this.pline(ctx, D, pts[k], pts[k + 1], w, col, dy);
    if (closed) this.pline(ctx, D, pts[pts.length - 1], pts[0], w, col, dy);
  }
  pdisc(ctx, D, u, v, r, col, seg = 10, dy = 0) {
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2;
      this.ptri(ctx, D, [u, v], [u + Math.cos(a0) * r, v + Math.sin(a0) * r], [u + Math.cos(a1) * r, v + Math.sin(a1) * r], col, dy);
    }
  }

  emitMarkings(ctx, D, P) {
    const t = D.t;
    if (P.kind === 'straight') this.markStraight(ctx, D);
    else if (P.kind === 'curve') this.markCurve(ctx, D, P);
    else if (P.kind === 'junction') this.markJunction(ctx, D, P);
    // Abnutzung und Kanaldeckel auf Asphalt
    if (t !== R.LANE) this.markWear(ctx, D, P);
    else this.markLane(ctx, D, P);
  }

  // Gerade Felder: Linien je Straßentyp, Kreuzungszufahrten
  markStraight(ctx, D) {
    const t = D.t, ax = D.axis;
    const dA = ax === 0 ? 0 : 3, dB = ax === 0 ? 2 : 1;
    const P = (s, q) => (ax === 0 ? [q, s] : [s, q]);
    const hA = D.hw[dA], hB = D.hw[dB];
    const half = (s) => lerp(hA, hB, s + 0.5);
    const zA = this.zebraOn(D, dA), zB = this.zebraOn(D, dB);
    // Bereich der Linien (vor Zebrastreifen/Haltelinie enden)
    const sA = zA ? -0.5 + 0.27 : -0.5, sB = zB ? 0.5 - 0.27 : 0.5;
    const along0 = ax === 0 ? D.cz : D.cx; // Weltkoordinate der Feldmitte entlang der Achse
    const dashes = (q, dash, gap, w, col) => {
      const per = dash + gap;
      const w0 = along0 + sA, w1 = along0 + sB;
      for (let k = Math.floor(w0 / per) - 1; k * per < w1; k++) {
        const a = Math.max(w0, k * per + 0.05), b = Math.min(w1, k * per + 0.05 + dash);
        if (b - a < 0.02) continue;
        this.pline(ctx, D, P(a - along0, q), P(b - along0, q), w, col);
      }
    };
    if (t === R.STREET) {
      dashes(0, 0.3, 0.2, 0.012, WHITE);
      // vor Kreuzungen durchgezogen
      if (zA) this.pline(ctx, D, P(sA, 0), P(sA + 0.22, 0), 0.012, WHITE);
      if (zB) this.pline(ctx, D, P(sB - 0.22, 0), P(sB, 0), 0.012, WHITE);
    } else if (t === R.AVENUE || t === R.HIGHWAY) {
      const mh = D.median;
      const lw = t === R.HIGHWAY ? 0.016 : 0.012;
      const lane = (half(0) - mh) / 2;
      for (const sg of [-1, 1]) {
        // Fahrstreifenbegrenzung innen (am Mittelstreifen) und außen
        this.pline(ctx, D, P(sA, sg * (mh + 0.014)), P(sB, sg * (mh + 0.014)), lw, WHITE);
        this.pline(ctx, D, P(-0.5, sg * (hA - 0.03)), P(0.5, sg * (hB - 0.03)), lw, WHITE);
        // Leitlinie zwischen den Spuren
        if (t === R.HIGHWAY) dashes(sg * (mh + lane), 0.6, 0.6, 0.014, WHITE);
        else dashes(sg * (mh + lane), 0.3, 0.3, 0.011, WHITE);
      }
    }
    // Zufahrten zu Kreuzungen
    for (const [d, end] of [[dA, -1], [dB, 1]]) {
      if (!D.conn[d]) continue;
      const j = D.nj[d];
      if (j === J_NONE) continue;
      const h = end < 0 ? hA : hB;
      // Fahrtrichtung zur Kreuzung: Verkehr fährt auf der rechten Seite. Rechts-Vektor von dir(d): (−dir_v, dir_u)
      const f = DIR[d];
      const right = [-f[1], f[0]];
      // Querkoordinate q der rechten Seite im (s,q)-System
      const qSign = ax === 0 ? Math.sign(right[0]) : Math.sign(right[1]);
      const mh = D.median;
      if (this.zebraOn(D, d)) {
        // Zebrastreifen: Balken parallel zur Fahrtrichtung
        const s0 = end * (0.5 - 0.03), s1 = end * (0.5 - 0.18);
        const stripe = 0.035, nS = Math.floor((2 * h - 0.04) / (stripe * 2));
        const q0 = -(nS * stripe * 2 - stripe) / 2;
        for (let k = 0; k < nS; k++) {
          const qa = q0 + k * stripe * 2, qb = qa + stripe;
          this.pquad(ctx, D, P(s0, qa), P(s1, qa), P(s1, qb), P(s0, qb), WHITE);
        }
        // Haltelinie / Haifischzähne auf der Zufahrtsseite
        const sl = end * (0.5 - 0.22);
        const qi = qSign * (mh ? mh + 0.01 : 0.008), qo = qSign * (h - 0.02);
        if (j === J_SIGNAL || (j === J_YIELD_NS && ax === 1) || (j === J_YIELD_EW && ax === 0)) {
          if (j === J_SIGNAL) this.pquad(ctx, D, P(sl, qi), P(sl + end * 0.03, qi), P(sl + end * 0.03, qo), P(sl, qo), WHITE);
          else {
            // Wartelinie als Haifischzähne
            const n = Math.max(3, Math.floor(Math.abs(qo - qi) / 0.045));
            for (let k = 0; k < n; k++) {
              const a = lerp(qi, qo, k / n), b = lerp(qi, qo, (k + 0.8) / n);
              this.ptri(ctx, D, P(sl + end * 0.035, a), P(sl + end * 0.035, b), P(sl, (a + b) / 2), WHITE);
            }
          }
        }
        // Abbiegepfeile auf breiten Zufahrten mit Ampel
        if (j === J_SIGNAL && (D.t === R.AVENUE || D.t === R.HIGHWAY)) {
          const lane = (h - mh) / 2;
          this.arrow(ctx, D, P, end * 0.02, qSign * (mh + lane * 0.5), end, 'left');
          this.arrow(ctx, D, P, end * 0.02, qSign * (mh + lane * 1.5), end, 'straight');
        } else if (j === J_SIGNAL && D.t === R.STREET) {
          this.arrow(ctx, D, P, end * 0.0, qSign * h * 0.5, end, 'straight');
        }
        // Ölflecken vor der Haltelinie
        if (D.seed > 0.4) this.pdisc(ctx, D, ...P(sl - end * 0.12, qSign * h * 0.5), 0.03, DARK(0.12), 8, -0.0002);
      }
    }
    // Bushaltestelle: gelbe Zickzacklinie am Bord
    if (D.stops) {
      for (const s of D.stops) {
        const sd = this.stopSideSign(D, s);
        const q = sd * (half(0) - 0.035);
        const pts = [];
        const n = 10;
        for (let k = 0; k <= n; k++) pts.push(P(-0.32 + (k / n) * 0.64, q + (k % 2 ? 1 : -1) * 0.018 * sd));
        this.ppoly(ctx, D, pts, 0.008, YELLOW);
        this.pline(ctx, D, P(-0.36, q - 0.018 * sd), P(-0.36, q + 0.024 * sd), 0.008, YELLOW);
        this.pline(ctx, D, P(0.36, q - 0.018 * sd), P(0.36, q + 0.024 * sd), 0.008, YELLOW);
      }
    }
  }

  // Pfeil-Markierung in Richtung end (±1 entlang der Achse)
  arrow(ctx, D, P, s, q, end, kind) {
    const L = 0.16, w = 0.012;
    const s0 = s - end * L * 0.5, s1 = s + end * L * 0.35;
    if (kind === 'straight') {
      this.pline(ctx, D, P(s0, q), P(s1, q), w, WHITE);
      this.ptri(ctx, D, P(s1, q - 0.025), P(s1, q + 0.025), P(s1 + end * 0.06, q), WHITE);
    } else {
      // Linksabbieger: Schaft + Bogen nach links (aus Sicht der Fahrtrichtung)
      const leftQ = -Math.sign(q || 1) * 0.04;
      this.pline(ctx, D, P(s0, q), P(s1 - end * 0.02, q), w, WHITE);
      this.pline(ctx, D, P(s1 - end * 0.02, q), P(s1 + end * 0.02, q + leftQ * 0.7), w, WHITE);
      this.ptri(ctx, D, P(s1 + end * 0.035, q + leftQ * 0.4), P(s1 - end * 0.005, q + leftQ * 0.95), P(s1 + end * 0.04, q + leftQ * 1.35), WHITE);
      this.pline(ctx, D, P(s1, q), P(s1 + end * 0.04, q), w, WHITE);
      this.ptri(ctx, D, P(s1 + end * 0.04, q - 0.022), P(s1 + end * 0.04, q + 0.022), P(s1 + end * 0.09, q), WHITE);
    }
  }

  stopSideSign(D, s) {
    // Seite der Haltestelle: Zahl 0–3 (N/O/S/W) oder ±1 (links/rechts der Achse); Rückgabe ±1 in Querrichtung
    const ax = D.axis >= 0 ? D.axis : 0;
    const v = s.side;
    if (v === 1 || v === -1) return v;
    if (typeof v === 'number' && v >= 0 && v <= 3) {
      if (ax === 0) return v === 1 ? 1 : v === 3 ? -1 : (D.open[1] ? 1 : -1);
      return v === 2 ? 1 : v === 0 ? -1 : (D.open[2] ? 1 : -1);
    }
    if (typeof v === 'string') { const c = v[0].toLowerCase(); return ax === 0 ? (c === 'e' || c === 'o' ? 1 : -1) : (c === 's' ? 1 : -1); }
    return 1;
  }

  markCurve(ctx, D, P) {
    const t = D.t;
    const { C, e1, e2, d1, d2 } = P;
    const n = 14;
    const at = (al, r) => [C[0] + r * (e1[0] * Math.cos(al) + e2[0] * Math.sin(al)), C[1] + r * (e1[1] * Math.cos(al) + e2[1] * Math.sin(al))];
    const hAt = (k) => lerp(D.hw[d1], D.hw[d2], k);
    const arcLine = (rFn, w, col, dash, gap) => {
      const pts = [];
      for (let k = 0; k <= n; k++) pts.push(at((k / n) * Math.PI / 2, rFn(k / n)));
      if (!dash) { this.ppoly(ctx, D, pts, w, col); return; }
      // gestrichelt nach Bogenlänge
      let acc = 0;
      for (let k = 0; k < n; k++) {
        const a = pts[k], b = pts[k + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const ph0 = acc % (dash + gap), on = ph0 < dash;
        if (on) this.pline(ctx, D, a, b, w, col);
        acc += l;
      }
    };
    if (t === R.STREET) arcLine(() => 0.5, 0.012, WHITE, 0.3, 0.2);
    else if (t === R.AVENUE || t === R.HIGHWAY) {
      const mh = D.median;
      for (const sg of [-1, 1]) {
        arcLine(() => 0.5 + sg * (mh + 0.014), 0.012, WHITE);
        arcLine((k) => 0.5 + sg * (hAt(k) - 0.03), 0.012, WHITE);
        arcLine((k) => 0.5 + sg * (mh + (hAt(k) - mh) / 2), 0.011, WHITE, 0.3, 0.3);
      }
    }
  }

  markJunction(ctx, D, P) {
    // Fußgängerfurt im Kreuzungsfeld, wenn der Zufahrtsarm lang genug ist und das Nachbarfeld keinen Zebrastreifen trägt
    const { hx, hz } = P;
    if (D.jclass === J_RVL) return;
    for (let d = 0; d < 4; d++) {
      if (!D.conn[d]) continue;
      const neighborStraight = (D.ndeg[d] & 16) !== 0;
      if (neighborStraight) continue;
      const ext = d === 0 || d === 2 ? hz : hx;
      const len = 0.5 - ext;
      if (len < 0.14) continue;
      const f = DIR[d], l = [-f[1], f[0]];
      const h = D.hw[d];
      const Q = (s, q) => [f[0] * s + l[0] * q, f[1] * s + l[1] * q];
      const s0 = ext + 0.015, s1 = Math.min(0.49, ext + 0.15);
      const stripe = 0.035, nS = Math.floor((2 * h - 0.04) / (stripe * 2));
      const q0 = -(nS * stripe * 2 - stripe) / 2;
      for (let k = 0; k < nS; k++) {
        const qa = q0 + k * stripe * 2, qb = qa + stripe;
        this.pquad(ctx, D, Q(s0, qa), Q(s1, qa), Q(s1, qb), Q(s0, qb), WHITE);
      }
    }
    // Reifenspuren in der Kreuzung
    if (D.seed > 0.3) this.pdisc(ctx, D, (D.seed - 0.5) * 0.2, (hash2(D.x, D.y, 5) - 0.5) * 0.2, 0.09, DARK(0.05), 12, -0.0003);
  }

  // Gassen: Rinne aus dunklem Pflaster am Bord
  markLane(ctx, D, P) {
    if (P.kind !== 'straight') return;
    const ax = D.axis;
    const Pq = (s, q) => (ax === 0 ? [q, s] : [s, q]);
    const h0 = D.hw[ax === 0 ? 0 : 3], h1 = D.hw[ax === 0 ? 2 : 1];
    for (const sg of [-1, 1]) this.pline(ctx, D, Pq(-0.5, sg * (h0 - 0.014)), Pq(0.5, sg * (h1 - 0.014)), 0.024, [0.32, 0.31, 0.3, 0.55]);
  }

  markWear(ctx, D, P) {
    const sd = D.seed, x = D.x, y = D.y;
    const h = D.own;
    if (P.kind === 'straight') {
      const ax = D.axis;
      const Pq = (s, q) => (ax === 0 ? [q, s] : [s, q]);
      // Reifenspuren je Fahrspur
      const lanes = D.t === R.STREET ? [0.15] : [D.median + (h - D.median) * 0.25, D.median + (h - D.median) * 0.75];
      for (const sg of [-1, 1]) for (const lc of lanes) {
        this.pline(ctx, D, Pq(-0.5, sg * lc), Pq(0.5, sg * lc), 0.075, DARK(0.055), -0.0004);
      }
      // Gullys am Bord (jedes zweite Feld)
      if (((x + y) & 1) === 0) {
        for (const sg of [-1, 1]) {
          const s = (hash2(x, y, 21 + sg) - 0.5) * 0.6;
          const q = sg * (h - 0.016);
          this.pquad(ctx, D, Pq(s - 0.018, q - 0.008), Pq(s + 0.018, q - 0.008), Pq(s + 0.018, q + 0.008), Pq(s - 0.018, q + 0.008), [0.22, 0.22, 0.23, 0.95]);
          this.pquad(ctx, D, Pq(s - 0.014, q - 0.005), Pq(s + 0.014, q - 0.005), Pq(s + 0.014, q + 0.005), Pq(s - 0.014, q + 0.005), DARK(0.9), 0.0001);
        }
      }
      // Kanaldeckel
      if (sd < 0.4) {
        const s = (hash2(x, y, 31) - 0.5) * 0.7, q = (hash2(x, y, 32) < 0.5 ? -1 : 1) * (D.median + (h - D.median) * 0.5);
        const [u, v] = Pq(s, q);
        this.pdisc(ctx, D, u, v, 0.024, [0.16, 0.16, 0.17, 0.95], 8);
        this.pdisc(ctx, D, u, v, 0.018, [0.3, 0.3, 0.31, 0.9], 8, 0.0001);
      }
      // Flicken
      if (sd > 0.62) {
        const s = (hash2(x, y, 41) - 0.5) * 0.5, q = (hash2(x, y, 42) - 0.5) * h * 1.2;
        const w = 0.05 + hash2(x, y, 43) * 0.1, l = 0.08 + hash2(x, y, 44) * 0.2;
        this.pquad(ctx, D, Pq(s - l / 2, q - w / 2), Pq(s + l / 2, q - w / 2), Pq(s + l / 2, q + w / 2), Pq(s - l / 2, q + w / 2), DARK(0.13), -0.0006);
      }
      // Risse
      if (sd > 0.35 && sd < 0.75) {
        let u = (hash2(x, y, 51) - 0.5) * 0.6, q = (hash2(x, y, 52) - 0.5) * h * 1.4;
        const pts = [Pq(u, q)];
        for (let k = 0; k < 5; k++) { u += 0.04 + hash2(x, y, 60 + k) * 0.05; q += (hash2(x, y, 70 + k) - 0.5) * 0.05; pts.push(Pq(Math.min(0.48, u), Math.max(-h + 0.02, Math.min(h - 0.02, q)))); }
        this.ppoly(ctx, D, pts, 0.0035, DARK(0.32), false, -0.0002);
      }
    } else if (P.kind === 'curve' && sd < 0.5) {
      const { C, e1, e2 } = P;
      const al = Math.PI / 4 + (sd - 0.25) * 0.8, r = 0.5 + (hash2(x, y, 3) < 0.5 ? -1 : 1) * h * 0.5;
      const u = C[0] + r * (e1[0] * Math.cos(al) + e2[0] * Math.sin(al)), v = C[1] + r * (e1[1] * Math.cos(al) + e2[1] * Math.sin(al));
      this.pdisc(ctx, D, u, v, 0.024, [0.16, 0.16, 0.17, 0.95], 8);
      this.pdisc(ctx, D, u, v, 0.018, [0.3, 0.3, 0.31, 0.9], 8, 0.0001);
    }
  }

  // ------------------------------------------------------------ Stadtmobiliar und Ampeln
  // Instanz einer Ausstattungsart setzen; Laternenlicht (Fleck + Kegel), Leuchtpunkte und Ampel-Linsen mitführen
  put(ctx, kind, x, y, z, yaw = 0, s = 1, o = {}) {
    const k = this.props.meta(kind);
    ctx.inst.add(kind, x, y, z, yaw, s, s, s, o.phase || 0, o.axis || 0, o.col || null);
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    const Wp = (lx, ly, lz) => [x + (lx * c + lz * sn) * s, y + ly * s, z + (-lx * sn + lz * c) * s];
    for (let j = 0; j < k.lamps.length; j += 3) ctx.lamps.push(...Wp(k.lamps[j], k.lamps[j + 1], k.lamps[j + 2]));
    for (let j = 0; j < k.pools.length; j += 5) {
      const [hx, hy, hz] = Wp(k.pools[j], k.pools[j + 1], k.pools[j + 2]);
      const r = k.pools[j + 3] * s, gy = o.ground ?? y;
      ctx.inst.add('pool', hx, gy + 0.004, hz, 0, r, 1, r);
      const hh = hy - gy - 0.01;
      if (k.pools[j + 4] && hh > 0.05) ctx.inst.add('cone', hx, gy + 0.01, hz, 0, r * 0.62, hh, r * 0.62);
    }
    for (let j = 0; j < k.signals.length; j += 4) {
      const [sx, sy, sz] = Wp(k.signals[j], k.signals[j + 1], k.signals[j + 2]);
      ctx.signals.push(sx, sy, sz, o.axis || 0, o.phase || 0, k.signals[j + 3]);
    }
  }
  tree(ctx, x, y, z, s, seed, tint = 1) {
    const kind = 'tree' + (Math.floor(seed * 4) % 4);
    const h = hash2(Math.floor(seed * 9973), 7, 3);
    const col = [(0.88 + h * 0.2) * tint, (0.92 + hash2(Math.floor(seed * 7919), 3, 5) * 0.16) * tint, (0.86 + h * 0.12) * tint];
    this.put(ctx, kind, x, y, z, seed * 6.283, s, { col });
  }
  car(ctx, x, y, z, yaw, seed) {
    const col = CAR_COLORS[Math.floor(seed * 9973) % CAR_COLORS.length];
    this.put(ctx, seed > 0.88 ? 'van' : 'car', x, y, z, yaw, 1, { col });
  }

  emitProps(ctx, D, P) {
    const t = D.t;
    const yS = (u, v) => D.hY(u, v) + D.curbH; // Gehweghöhe
    const place = (u, v) => [D.cx + u, yS(u, v), D.cz + v];
    const yawTo = (fu, fv) => Math.atan2(fu, fv);
    const sd = D.seed, x = D.x, y = D.y;
    const ground = D.hY(0, 0);
    if (t === R.HIGHWAY) { this.propsHighway(ctx, D, P); return; }
    if (P.kind === 'straight') {
      const ax = D.axis;
      const along = ax === 0 ? [0, 1] : [1, 0];
      const lampSide = ((x + y) & 1) ? 1 : -1;
      const busSides = new Set((D.stops || []).map((s) => this.stopSideSign(D, s)));
      if (D.water) {
        // Brücke: Laternen auf beiden Seiten versetzt, sonst frei
        for (const side of [-1, 1]) {
          const lat = ax === 0 ? [side, 0] : [0, side];
          const s = side * 0.25 * (((x + y) & 1) ? 1 : -1);
          const q = 0.5 - 0.034;
          const u = along[0] * s + lat[0] * q, v = along[1] * s + lat[1] * q;
          if (this.bridgeStyle(D) === 'stone') this.put(ctx, 'lanternB', D.cx + u, D.hY(u, v) + D.curbH + 0.058, D.cz + v, 0, 1, { ground });
          else this.put(ctx, 'lamp', D.cx + u, D.hY(u, v) + D.curbH, D.cz + v, Math.atan2(-lat[0], -lat[1]), 1, { ground });
        }
        return;
      }
      for (const side of [-1, 1]) {
        const lat = ax === 0 ? [side, 0] : [0, side];
        const dA = ax === 0 ? 0 : 3, dB = ax === 0 ? 2 : 1;
        const hAt = (s) => lerp(D.hw[dA], D.hw[dB], s + 0.5);
        const pos = (s, off) => [along[0] * s + lat[0] * (hAt(s) + off), along[1] * s + lat[1] * (hAt(s) + off)];
        const face = yawTo(-lat[0], -lat[1]); // Blick zur Fahrbahn
        const nd = ax === 0 ? (side > 0 ? 1 : 3) : (side > 0 ? 2 : 0); // Nachbar auf dieser Seite
        const zn = D.nzone[nd];
        const sideRoom = 0.5 - hAt(0);
        const sseed = hash2(x, y, side > 0 ? 101 : 102);
        if (busSides.has(side) && sideRoom > 0.14) {
          const [u, v] = pos(0, 0.06 + 0.05);
          busShelter(ctx, ...place(u, v), face, sseed, { len: t === R.LANE ? 0.32 : 0.3 });
          continue;
        }
        if (busSides.has(side)) {
          const [u, v] = pos(-0.2, sideRoom * 0.5);
          this.put(ctx, 'signBus', ...place(u, v), face);
          continue;
        }
        if (D.station) continue;
        if (t === R.STREET || (t === R.AVENUE && sideRoom > 0.12)) {
          const hasLamp = side === lampSide && t === R.STREET;
          if (hasLamp) {
            const [u, v] = pos(0, 0.055);
            this.put(ctx, 'lamp', ...place(u, v), face, 1, { ground });
          }
          // Straßenbäume
          const treeP = zn === Z.IND ? 0.2 : D.raised ? 0.3 : 0.62;
          const treeS = sseed < 0.5 ? 0.3 : -0.3;
          let tree = false;
          if (sseed < treeP && sideRoom >= 0.16) {
            const [u, v] = pos(treeS, 0.07);
            this.tree(ctx, ...place(u, v), 0.95 + hash2(x, y, 7 + side) * 0.35, hash2(x, y, 8 + side));
            tree = true;
          }
          // Parkende Autos (Gehwegparken) in Wohn- und Geschäftsstraßen, auf der Seite ohne Laterne
          if (!hasLamp && !D.raised && (zn === Z.RES || zn === Z.COM) && hash2(x, y, 120 + side) < 0.62 && sideRoom >= 0.16) {
            const s = tree ? -treeS * 0.3 : (hash2(x, y, 121) - 0.5) * 0.3;
            const [u, v] = pos(s, 0.012);
            const dirSign = hash2(x, y, 122) < 0.7 ? side : -side; // meist in Fahrtrichtung
            const yaw = ax === 0 ? (dirSign * side > 0 ? Math.PI : 0) : (dirSign * side > 0 ? Math.PI / 2 : -Math.PI / 2);
            this.car(ctx, D.cx + u, D.hY(u, v) + D.curbH * 0.5, D.cz + v, yaw + (hash2(x, y, 123) - 0.5) * 0.06, hash2(x, y, 124 + side));
          }
          // Kleinteile am äußeren Rand
          this.smallProps(ctx, D, (s) => pos(s, sideRoom - 0.035), place, face, zn, side, tree ? -treeS : treeS);
        } else if (t === R.LANE) {
          if (side === lampSide && ((x * 3 + y) % 2 === 0)) {
            const [u, v] = pos(0.1, 0.06);
            this.put(ctx, 'lantern', ...place(u, v), 0, 1, { ground });
          } else if (sseed < 0.45) {
            const [u, v] = pos(-0.2, 0.1);
            this.tree(ctx, ...place(u, v), 0.85 + hash2(x, y, 9) * 0.3, hash2(x, y, 10 + side));
          }
          if (sseed > 0.7) { const [u, v] = pos(0.28, 0.2); this.put(ctx, 'planter', ...place(u, v), hash2(x, y, 11 + side) * 6); }
          if (sseed > 0.55 && sseed < 0.68 && (zn === Z.RES || zn === Z.COM)) { const [u, v] = pos(-0.05, 0.22); this.put(ctx, 'bench', ...place(u, v), face); }
          if ((zn === Z.RES) && !D.raised && hash2(x, y, 130 + side) < 0.35) {
            const s = (hash2(x, y, 131) - 0.5) * 0.2;
            const [u, v] = pos(s, 0.075);
            const yaw = ax === 0 ? 0 : Math.PI / 2;
            this.car(ctx, ...place(u, v), yaw + (hash2(x, y, 132) < 0.5 ? Math.PI : 0), hash2(x, y, 133 + side));
          }
          this.smallProps(ctx, D, (s) => pos(s, sideRoom - 0.04), place, face, zn, side, 0.3);
        } else {
          // schmaler Gehweg der Allee: Hydranten, Mülleimer
          if (sseed < 0.12) { const [u, v] = pos(0.2, sideRoom * 0.5); this.put(ctx, 'hydrant', ...place(u, v)); }
          else if (sseed > 0.9) { const [u, v] = pos(-0.2, sideRoom * 0.5); this.put(ctx, 'bin', ...place(u, v), face); }
        }
      }
      // Mittelstreifen der Allee
      if (D.median && P.median.length) this.propsMedian(ctx, D);
      // Tempo-30-Zone am Beginn von Gassen (Übergang von einer größeren Straße)
      if (t === R.LANE) {
        for (const [d, end] of [[ax === 0 ? 0 : 3, -1], [ax === 0 ? 2 : 1, 1]]) {
          if (!D.conn[d] || D.nt[d] <= R.LANE) continue;
          const f = DIR[d];
          const r = [f[1], -f[0]];
          const u = f[0] * 0.38 + r[0] * (D.hw[d] + 0.05), v = f[1] * 0.38 + r[1] * (D.hw[d] + 0.05);
          this.put(ctx, 'signZone', ...place(u, v), yawTo(f[0], f[1]));
          void end;
        }
      }
    } else if (P.kind === 'curve') {
      const { C, e1, e2, d1, d2 } = P;
      const h = (D.hw[d1] + D.hw[d2]) / 2;
      const diag = [(e1[0] + e2[0]) / Math.SQRT2, (e1[1] + e2[1]) / Math.SQRT2];
      const ro = 0.5 + h;
      if (!D.station && t !== R.AVENUE && !D.water) {
        const r = ro + 0.065;
        if (r < 1.36) {
          const u = C[0] + diag[0] * r, v = C[1] + diag[1] * r;
          if (t === R.LANE) this.put(ctx, 'lantern', ...place(u, v), 0, 1, { ground });
          else this.put(ctx, 'lamp', ...place(u, v), yawTo(-diag[0], -diag[1]), 1, { ground });
        }
        const ri = 0.5 - h;
        if (ri > 0.13 && sd < 0.7) {
          const u = C[0] + diag[0] * (ri - 0.07), v = C[1] + diag[1] * (ri - 0.07);
          this.tree(ctx, ...place(u, v), 0.9, hash2(x, y, 17));
        }
      }
      if (D.median && P.median.length && !D.water) {
        const u = C[0] + diag[0] * 0.5, v = C[1] + diag[1] * 0.5;
        this.tree(ctx, ...place(u, v), 1.1, hash2(x, y, 18));
      }
    } else if (P.kind === 'junction') {
      this.propsJunction(ctx, D, P, place, yawTo);
    } else if (P.kind === 'deadend') {
      const f = DIR[P.d];
      const u = -f[0] * (P.rc + 0.05), v = -f[1] * (P.rc + 0.05);
      if (P.rc + 0.05 < 0.48 && !D.station) {
        if (t === R.LANE) this.put(ctx, 'lantern', ...place(u, v), 0, 1, { ground });
        else this.put(ctx, 'lamp', ...place(u, v), yawTo(f[0], f[1]), 1, { ground });
      }
      // Wendehammer-Bäume
      if (!D.water) {
        for (const sg of [-1, 1]) {
          const l = [-f[1] * sg, f[0] * sg];
          const r = P.rc + 0.05;
          if (r < 0.46 && hash2(x, y, 40 + sg) < 0.6) this.tree(ctx, ...place(l[0] * r * 0.9 - f[0] * 0.1, l[1] * r * 0.9 - f[1] * 0.1), 0.9, hash2(x, y, 41 + sg));
        }
      }
    } else if (P.kind === 'plaza') {
      this.put(ctx, 'lantern', ...place(0.42, 0.42), 0, 1, { ground });
      this.put(ctx, 'bench', ...place(-0.42, 0.3), Math.PI / 2);
    }
  }

  // Bank, Mülleimer, Hydrant, Briefkasten, Fahrradständer am äußeren Gehwegrand
  smallProps(ctx, D, posFn, place, face, zn, side, freeS) {
    const x = D.x, y = D.y;
    const r = hash2(x, y, 200 + side);
    const s = freeS * 0.9;
    const p = place(...posFn(s));
    if (zn === Z.COM || zn === Z.OFF) {
      if (r < 0.2) this.put(ctx, 'bench', ...p, face);
      else if (r < 0.34) this.put(ctx, 'bikeRack', ...p, face + Math.PI / 2);
      else if (r < 0.46) this.put(ctx, 'bin', ...p, face);
      else if (r < 0.52) this.put(ctx, 'mailbox', ...p, face);
    } else if (zn === Z.RES) {
      if (r < 0.08) this.put(ctx, 'mailbox', ...p, face);
      else if (r < 0.2) this.put(ctx, 'binG', ...p, face);
      else if (r < 0.26) this.put(ctx, 'bench', ...p, face);
    } else if (r < 0.1) this.put(ctx, 'bin', ...p, face);
    // Hydranten im Raster
    if (((x * 7 + y * 3 + (side > 0 ? 1 : 0)) % 9) === 0) this.put(ctx, 'hydrant', ...place(...posFn(-s * 0.4)));
  }

  propsMedian(ctx, D) {
    const ax = D.axis, x = D.x, y = D.y;
    const at = (s) => (ax === 0 ? [0, s] : [s, 0]);
    const mp = (s) => { const [u, v] = at(s); return [D.cx + u, D.hY(u, v) + D.curbH, D.cz + v]; };
    const med = this.medianStraight(D)[0];
    if (!med || D.water) return;
    const inside = (s) => s > med.sA + 0.05 && s < med.sB - 0.05;
    if (inside(0)) this.tree(ctx, ...mp(0), 1.08 + hash2(x, y, 3) * 0.2, hash2(x, y, 4));
    for (const s of [-0.26, 0.26]) if (inside(s) && hash2(x, y, 5 + s * 10) < 0.7) this.put(ctx, hash2(x, y, 6 + s * 10) > 0.5 ? 'shrub1' : 'shrub0', ...mp(s), hash2(x, y, 9) * 6);
    if ((x + y) % 2 === 0 && inside(-0.42)) this.put(ctx, 'lamp2', ...mp(-0.42), ax === 0 ? Math.PI / 2 : 0, 1, { ground: D.hY(0, 0) });
  }

  propsJunction(ctx, D, P, place, yawTo) {
    const { hx, hz, rf } = P;
    const j = D.jclass;
    const x = D.x, y = D.y;
    const ground = D.hY(0, 0);
    if (j === J_RVL) {
      // Gassen-Kreuzung: eine Laterne an einer Ecke
      const corners = [[1, -1], [1, 1], [-1, 1], [-1, -1]];
      const c = corners[Math.floor(D.seed * 4) % 4];
      const u = c[0] * (hx + (0.5 - hx) * 0.55), v = c[1] * (hz + (0.5 - hz) * 0.55);
      this.put(ctx, 'lantern', ...place(u, v), 0, 1, { ground });
      return;
    }
    const phase = this.phaseOf(D.i);
    const nameIdx = Math.floor(hash2(x >> 2, y >> 2, 77) * 16) % 16;
    for (let d = 0; d < 4; d++) {
      if (!D.conn[d]) continue;
      const f = DIR[d];
      const r = [f[1], -f[0]]; // rechts aus Sicht des ankommenden Verkehrs (fährt in −f)
      const ext = d === 0 || d === 2 ? hz : hx;
      const along = Math.min(0.47, ext + rf + 0.025);
      const lat = Math.min(0.47, D.hw[d] + 0.045);
      const u = f[0] * along + r[0] * lat, v = f[1] * along + r[1] * lat;
      const p = place(u, v);
      const face = yawTo(f[0], f[1]);
      const axis = d === 0 || d === 2 ? 0 : 1;
      if (j === J_SIGNAL) {
        const wide = D.hw[d] >= 0.38;
        this.put(ctx, wide ? 'signalArm' : 'signal', ...p, face, 1, { axis, phase });
        streetNamePlate(ctx, ...p, face, d === 0 || d === 1 ? nameIdx : (nameIdx + 5) % 16, 0.365);
      } else {
        // Vorfahrt: Stamm der T-Kreuzung bekommt „Vorfahrt gewähren", die Durchgangsstraße „Vorfahrtstraße"
        const through = j === J_YIELD_NS ? axis === 0 : axis === 1;
        this.put(ctx, through ? 'signPrio' : 'signYield', ...p, face);
      }
    }
    // Laterne an einer freien Ecke (Kreuzungen ohne Ampel)
    if (j !== J_SIGNAL) {
      const dm = D.conn.indexOf(false);
      if (dm >= 0) {
        const f = DIR[dm];
        const ext = dm === 0 || dm === 2 ? hz : hx;
        const off = ext + Math.min(0.06, (0.5 - ext) * 0.5);
        if (off < 0.48) this.put(ctx, 'lamp', ...place(f[0] * off, f[1] * off), yawTo(-f[0], -f[1]), 1, { ground });
      }
    }
  }

  propsHighway(ctx, D, P) {
    if (!D.straight) return;
    const ax = D.axis;
    const along = ax === 0 ? [0, 1] : [1, 0];
    const yG = D.hY(0, 0) + D.curbH;
    // Leitplanken an beiden Außenrändern
    for (const sg of [-1, 1]) {
      const lat = ax === 0 ? [sg, 0] : [0, sg];
      const q = 0.5 - 0.016;
      const a = [D.cx - along[0] * 0.5 + lat[0] * q, D.cz - along[1] * 0.5 + lat[1] * q];
      const b = [D.cx + along[0] * 0.5 + lat[0] * q, D.cz + along[1] * 0.5 + lat[1] * q];
      guardrail(ctx, a[0], a[1], b[0], b[1], yG, -sg);
    }
    // Betonschutzwand in der Mitte, Masten darauf
    if (P.median.length) {
      const med = P.median[0];
      const s0 = med.sA ?? -0.5, s1 = med.sB ?? 0.5;
      concreteBarrier(ctx, D.cx + along[0] * s0, D.cz + along[1] * s0, D.cx + along[0] * s1, D.cz + along[1] * s1, yG);
      if ((D.x + D.y) % 2 === 0) this.put(ctx, 'mast', D.cx, yG + 0.08, D.cz, ax === 0 ? Math.PI / 2 : 0, 1, { ground: D.hY(0, 0) });
    }
    // Ortstafel am rechten Rand der stadteinwärts führenden Fahrbahn (zweites Feld)
    if (ax === 1 && D.x === 2) {
      const b = ctx.solid.at(D.cx, yG, D.cz + 0.47, -Math.PI / 2).m('metal_light');
      for (const o of [-0.05, 0.05]) b.cyl(o, 0, 0, 0.005, 0.005, 0.2, 5, 1);
      b.box(0, 0.13, 0.003, 0.15, 0.05, 0.004);
      ctx.glow.at(D.cx, yG, D.cz + 0.47, -Math.PI / 2).color(1, 1, 1).signal(0)
        .face([-0.078, 0.128, 0.0056], [0.078, 0.128, 0.0056], [0.078, 0.18, 0.0056], [-0.078, 0.18, 0.0056], [0, 0, 1], SIGN.ortstafel);
    }
  }

  // ------------------------------------------------------------ Viadukt außerhalb der Karte
  buildViaduct() {
    const g = this.g;
    const hy = g.world.highwayY;
    const ctx = this.newCtx();
    const len = 18;
    for (let k = 1; k <= len; k++) {
      const D = this.makeDesc({ i: -1, x: -k, y: hy, t: R.HIGHWAY, conn: [false, true, false, true], nt: [0, R.HIGHWAY, 0, R.HIGHWAY], ndeg: [0, 18, 0, 18], nj: [0, 0, 0, 0],
        nzone: [0, 0, 0, 0], nwater: [false, false, false, false], yc: [Y_ROAD, Y_ROAD, Y_ROAD, Y_ROAD], water: false, jclass: 0, station: false, stops: null, open: [true, false, true, false] });
      this.emitDeck(ctx, D, 'asphalt_dark');
      const P = this.pieces(D);
      for (const pc of P.side) this.emitPiece(ctx, D, pc.pts, pc.curb, { top: 'grass', curb: 'concrete', h: D.curbH, wall: 'concrete', wallBottom: -0.11 });
      for (const pc of P.median) this.emitPiece(ctx, D, pc.pts, pc.curb, { top: 'concrete', curb: 'curb', h: D.curbH, wall: 'curb' });
      this.markStraight(ctx, D);
      this.markWear(ctx, D, P);
      this.propsHighway(ctx, D, P);
      // Platte, Unterseite, Pfeiler
      const S = ctx.L.solid, mC = MI('concrete');
      const c = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([u, v]) => [D.cx + u, -0.11, D.cz + v]);
      S.tri(mC, ...c[0], ...c[1], ...c[2]); S.tri(mC, ...c[0], ...c[2], ...c[3]);
      // Hohlkastenträger unter der Platte (Talbrücke): schräge Stege, Boden; Stirnfläche am fernen Ende
      const b = ctx.solid.at(D.cx, 0, D.cz, 0).m('concrete');
      const zt = 0.36, zb = 0.25, yt = -0.11, yb = -0.44;
      quad3(b, [0.5, yt, zt], [-0.5, yt, zt], [-0.5, yb, zb], [0.5, yb, zb]);
      quad3(b, [-0.5, yt, -zt], [0.5, yt, -zt], [0.5, yb, -zb], [-0.5, yb, -zb]);
      quad3(b, [0.5, yb, zb], [-0.5, yb, zb], [-0.5, yb, -zb], [0.5, yb, -zb]);
      if (k === len) quad3(b, [-0.5, yt, zt], [-0.5, yt, -zt], [-0.5, yb, -zb], [-0.5, yb, zb]);
      // Wenige kräftige, nach unten breiter werdende Pfeiler mit Pfeilerkopf (statt vieler dünner Stützen)
      if (k % 5 === 4) {
        b.box(0, -0.56, 0, 0.36, 0.12, 0.62);
        frustum(b, -0.56, 0.26, 0.44, -16.6, 0.66, 1.05);
      }
    }
    // Schilderbrücke (stadteinwärts = Fahrt nach +x, Schilder blicken nach −x)
    const D3 = { cx: -3 + 0.5 - g.W / 2, cz: hy + 0.5 - g.H / 2 };
    gantry(ctx, D3.cx, Y_ROAD + CURB_H[4], D3.cz, -Math.PI / 2, 0.98, [{ x: 0.24, w: 0.36, h: 0.1, cell: 'gantryA' }, { x: -0.22, w: 0.36, h: 0.1, cell: 'gantryB' }]);
    this.viaductLamps = ctx.lamps;
    this.viaductSignals = ctx.signals;
    this.viaduct = this.finishCtx(ctx);
    this.props.setChunk('viaduct', ctx.inst);
    this.props.flush();
  }
}

// Viereck aus vier lokalen Punkten (Pinsel), Normale aus der Fläche
function quad3(b, p0, p1, p2, p3) { b.tri3(p0, p1, p2); b.tri3(p0, p2, p3); }
// Pfeilerschaft als Pyramidenstumpf: oben (yTop, sx0 × sz0), unten (yBot, sx1 × sz1), Mitte im lokalen Ursprung
function frustum(b, yTop, sx0, sz0, yBot, sx1, sz1) {
  const T = [[-sx0 / 2, yTop, -sz0 / 2], [sx0 / 2, yTop, -sz0 / 2], [sx0 / 2, yTop, sz0 / 2], [-sx0 / 2, yTop, sz0 / 2]];
  const B = [[-sx1 / 2, yBot, -sz1 / 2], [sx1 / 2, yBot, -sz1 / 2], [sx1 / 2, yBot, sz1 / 2], [-sx1 / 2, yBot, sz1 / 2]];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad3(b, T[i], T[j], B[j], B[i]); }
}

// Farben parkender Autos (linear, als Instanzfarbe auf weißem Lack)
const CAR_COLORS = [[0.86, 0.86, 0.85], [0.5, 0.52, 0.55], [0.035, 0.035, 0.04], [0.2, 0.21, 0.22], [0.55, 0.05, 0.04], [0.05, 0.14, 0.42],
  [0.03, 0.05, 0.14], [0.06, 0.2, 0.08], [0.6, 0.5, 0.35], [0.8, 0.55, 0.05], [0.86, 0.86, 0.85], [0.45, 0.46, 0.48], [0.3, 0.06, 0.05]];

// Kante eines Segments auf dem Feldrand (0 N, 1 O, 2 S, 3 W) oder −1
function edgeOf(a, b) {
  const e = 1e-4;
  if (Math.abs(a[1] + 0.5) < e && Math.abs(b[1] + 0.5) < e) return 0;
  if (Math.abs(a[0] - 0.5) < e && Math.abs(b[0] - 0.5) < e) return 1;
  if (Math.abs(a[1] - 0.5) < e && Math.abs(b[1] - 0.5) < e) return 2;
  if (Math.abs(a[0] + 0.5) < e && Math.abs(b[0] + 0.5) < e) return 3;
  return -1;
}

// Hilfsansicht: liefert der Straßen-Ansicht einen Takt pro Bild (Ampeln, Detailstufen, Haltestellen).
registerView(class RoadTicker {
  constructor(engine) { this.e = engine; }
  frame(dt) { const r = this.e.roads; if (r && r.tick) r.tick(dt); }
  dispose() { const r = this.e.roads; if (r && r.dispose) r.dispose(); }
});
