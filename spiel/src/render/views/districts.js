// Ansichten „Bezirke" und „Gewässer" (Besitzer S2).
//  · DistrictView: Bezirksgrenzen als weich leuchtende Bänder, Flächenfarbe beim Malen, schwebende Namensschilder.
//  · WaterPollutionView: Abwasser färbt Gewässer trüb-braun (immer sichtbar, Stärke = Verschmutzung).
// Außerdem: Problemsymbole (Verstorbene, Abwasser, Krankheit, Kälte) und Infoansichten
// (Abwasser, Bestattung, Altersstruktur, Bildungsstand, Bezirke).
import * as THREE from 'three';
import { registerView, registerOverlay, registerIcon, BUILDING_PROBLEMS } from '../../registry.js';
import { districtsOf, anchorTile, districtStats } from '../../sim/systems/districts.js';
import { BINS, avgAgeOf, eduIndex } from '../../sim/systems/citizens.js';
import { BUILDINGS, T } from '../../config.js';

const BORDER_Y = 0.047;
const svg = (body) => `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

// ---------- Hilfen
function cornerH(g, x, y) {
  const VW = g.W + 1;
  const h = g.world.vh[Math.max(0, Math.min(g.H, y)) * VW + Math.max(0, Math.min(g.W, x))];
  return Math.max(0, h);
}
function hexToRgb(n) { return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }

// Ort für das Namensschild: das Feld mit dem größten Abstand zum Rand (Distanztransformation)
function labelSpots(g, D) {
  const { W, H, N } = g;
  const map = D.map;
  const dist = new Int16Array(N);
  const q = new Int32Array(N);
  let qt = 0;
  for (let i = 0; i < N; i++) {
    if (!map[i]) continue;
    const x = i % W, y = (i / W) | 0;
    const id = map[i];
    const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1 || map[i - 1] !== id || map[i + 1] !== id || map[i - W] !== id || map[i + W] !== id;
    if (edge) { dist[i] = 1; q[qt++] = i; } else dist[i] = 0;
  }
  for (let qh = 0; qh < qt; qh++) {
    const i = q[qh];
    const x = i % W, y = (i / W) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
      if (j < 0 || map[j] !== map[i] || dist[j]) continue;
      dist[j] = dist[i] + 1;
      q[qt++] = j;
    }
  }
  const best = {};
  const cent = {};
  for (let i = 0; i < N; i++) {
    const id = map[i];
    if (!id) continue;
    const c = cent[id] || (cent[id] = [0, 0, 0]);
    c[0] += i % W; c[1] += (i / W) | 0; c[2]++;
  }
  for (let i = 0; i < N; i++) {
    const id = map[i];
    if (!id) continue;
    const c = cent[id];
    const cx = c[0] / c[2], cy = c[1] / c[2];
    // Abstand zum Rand zählt, Nähe zum Schwerpunkt entscheidet bei Gleichstand
    const score = dist[i] * 10 - Math.hypot((i % W) - cx, ((i / W) | 0) - cy) * 0.6;
    if (!best[id] || score > best[id][1]) best[id] = [i, score, c[2]];
  }
  return best;
}

function drawLabel(ctx, w, h, name, sub, color) {
  ctx.clearRect(0, 0, w, h);
  const css = '#' + color.toString(16).padStart(6, '0');
  const label = name.toUpperCase();
  const spacing = 4;
  // Schrift so wählen, dass der Name auf das Schild passt
  let fs = 62;
  const maxText = w - 130;
  const measure = () => { let t = 0; for (const ch of label) t += ctx.measureText(ch).width + spacing; return t - spacing; };
  ctx.font = `700 ${fs}px "Barlow Condensed", "Barlow", "Arial Narrow", sans-serif`;
  let tw = measure();
  if (tw > maxText) { fs = Math.max(30, Math.floor((fs * maxText) / tw)); ctx.font = `700 ${fs}px "Barlow Condensed", "Barlow", "Arial Narrow", sans-serif`; tw = measure(); }
  const pw = Math.min(w - 8, Math.max(tw + 100, 220));
  const x0 = (w - pw) / 2, y0 = 10, ph = h - 20;
  // Schild: dunkle Pille mit Farbkante und weichem Schatten
  const r = ph / 2;
  const pill = () => { ctx.beginPath(); ctx.moveTo(x0 + r, y0); ctx.lineTo(x0 + pw - r, y0); ctx.arc(x0 + pw - r, y0 + r, r, -Math.PI / 2, Math.PI / 2); ctx.lineTo(x0 + r, y0 + ph); ctx.arc(x0 + r, y0 + r, r, Math.PI / 2, Math.PI * 1.5); ctx.closePath(); };
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  ctx.fillStyle = 'rgba(20,24,34,0.86)'; pill(); ctx.fill(); ctx.restore();
  ctx.lineWidth = 6; ctx.strokeStyle = css; pill(); ctx.stroke();
  // Farbpunkt
  ctx.fillStyle = css;
  ctx.beginPath(); ctx.arc(x0 + 42, y0 + ph / 2 - (sub ? 12 : 0), 13, 0, Math.PI * 2); ctx.fill();
  // Name mit Sperrung
  ctx.fillStyle = '#f6f2ea';
  ctx.textBaseline = 'middle';
  let x = x0 + 68 + Math.max(0, (pw - 100 - tw) / 2);
  const ty = y0 + ph / 2 - (sub ? 15 : 0);
  for (const ch of label) { ctx.fillText(ch, x, ty); x += ctx.measureText(ch).width + spacing; }
  if (sub) {
    ctx.font = '600 31px "Barlow", "Arial", sans-serif';
    ctx.fillStyle = 'rgba(246,242,234,0.8)';
    ctx.textAlign = 'center';
    ctx.fillText(sub, w / 2 + 14, y0 + ph / 2 + 27);
    ctx.textAlign = 'left';
  }
}

// ---------- Bezirke
class DistrictView {
  constructor(engine) {
    this.e = engine;
    this.g = engine.game;
    this.group = new THREE.Group();
    this.group.name = 'Bezirke';
    engine.scene.add(this.group);
    const mat = (o) => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, toneMapped: false, fog: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, side: THREE.DoubleSide, ...o });
    this.borderMat = mat({});
    this.fillMat = mat({ opacity: 1 });
    this.border = new THREE.Mesh(new THREE.BufferGeometry(), this.borderMat);
    this.border.renderOrder = 3;
    this.border.frustumCulled = false;
    this.fill = new THREE.Mesh(new THREE.BufferGeometry(), this.fillMat);
    this.fill.renderOrder = 2;
    this.fill.frustumCulled = false;
    this.fill.visible = false;
    this.group.add(this.fill, this.border);
    this.labels = new Map(); // id → { sprite, canvas, ctx, tex, text }
    this.version = -1;
    this.labelTimer = 0;
    this.fade = 0;
  }

  rebuild() {
    const g = this.g, D = districtsOf(g);
    this.version = D.version;
    const { W, H } = g;
    const ox = -W / 2, oz = -H / 2;
    const map = D.map;
    const bp = [], bc = [], bi = [];
    const fp = [], fc = [], fi = [];
    const quad = (P, C, I, a, b, c, d, ca, cb, cc, cd) => {
      const v = P.length / 3;
      P.push(...a, ...b, ...c, ...d);
      C.push(...ca, ...cb, ...cc, ...cd);
      I.push(v, v + 1, v + 2, v, v + 2, v + 3);
    };
    const W1 = 0.09, W2 = 0.42;
    for (let i = 0; i < g.N; i++) {
      const id = map[i];
      if (!id) continue;
      const d = D.byId[id];
      if (!d) continue;
      const [r, gg, b] = hexToRgb(d.color);
      const x = i % W, y = (i / W) | 0;
      const X0 = x + ox, X1 = x + 1 + ox, Z0 = y + oz, Z1 = y + 1 + oz;
      const h00 = cornerH(g, x, y) + BORDER_Y, h10 = cornerH(g, x + 1, y) + BORDER_Y, h01 = cornerH(g, x, y + 1) + BORDER_Y, h11 = cornerH(g, x + 1, y + 1) + BORDER_Y;
      // Fläche
      const fa = [r, gg, b, 0.3];
      quad(fp, fc, fi, [X0, h00 - 0.004, Z0], [X1, h10 - 0.004, Z0], [X1, h11 - 0.004, Z1], [X0, h01 - 0.004, Z1], fa, fa, fa, fa);
      // Ränder: Kanten, an denen der Nachbar zu einem anderen Bezirk gehört
      const edges = [
        [y === 0 || map[i - W] !== id, [X0, h00, Z0], [X1, h10, Z0], [0, 0, 1]],
        [y === H - 1 || map[i + W] !== id, [X1, h11, Z1], [X0, h01, Z1], [0, 0, -1]],
        [x === 0 || map[i - 1] !== id, [X0, h01, Z1], [X0, h00, Z0], [1, 0, 0]],
        [x === W - 1 || map[i + 1] !== id, [X1, h10, Z0], [X1, h11, Z1], [-1, 0, 0]],
      ];
      for (const [on, A, B, n] of edges) {
        if (!on) continue;
        const in1 = (P, k) => [P[0] + n[0] * k, P[1], P[2] + n[2] * k];
        const solid = [r, gg, b, 1], mid = [r, gg, b, 0.62], clear = [r, gg, b, 0];
        const white = [Math.min(1, r * 0.5 + 0.55), Math.min(1, gg * 0.5 + 0.55), Math.min(1, b * 0.5 + 0.55), 0.95];
        quad(bp, bc, bi, A, B, in1(B, W1), in1(A, W1), white, white, solid, solid);
        quad(bp, bc, bi, in1(A, W1), in1(B, W1), in1(B, W2), in1(A, W2), mid, mid, clear, clear);
      }
    }
    const set = (mesh, P, C, I) => {
      mesh.geometry.dispose();
      const geo = new THREE.BufferGeometry();
      if (P.length) {
        geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 4));
        geo.setIndex(I.length > 65535 ? new THREE.Uint32BufferAttribute(I, 1) : new THREE.Uint16BufferAttribute(I, 1));
      }
      mesh.geometry = geo;
    };
    set(this.border, bp, bc, bi);
    set(this.fill, fp, fc, fi);
    // Namensschilder
    const spots = labelSpots(g, D);
    const seen = new Set();
    for (const d of D.list) {
      const s = spots[d.id];
      if (!s) continue;
      seen.add(d.id);
      let L = this.labels.get(d.id);
      if (!L) {
        const canvas = document.createElement('canvas');
        canvas.width = 640; canvas.height = 160;
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        const sm = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
        const sprite = new THREE.Sprite(sm);
        sprite.renderOrder = 30;
        sprite.center.set(0.5, 0);
        this.group.add(sprite);
        L = { sprite, canvas, ctx: canvas.getContext('2d'), tex, text: '' };
        this.labels.set(d.id, L);
      }
      const x = s[0] % W, y = (s[0] / W) | 0;
      L.base = new THREE.Vector3(x + 0.5 + ox, 0, y + 0.5 + oz);
      L.size = s[2];
      L.id = d.id;
      L.text = '';
    }
    for (const [id, L] of this.labels) {
      if (seen.has(id)) continue;
      this.group.remove(L.sprite);
      L.tex.dispose(); L.sprite.material.dispose();
      this.labels.delete(id);
    }
    this.updateLabelTexts(true);
    if (this.e.overlay.mode === 'districts') this.e.overlay.refresh();
  }

  updateLabelTexts(force) {
    const g = this.g, D = districtsOf(g);
    for (const [id, L] of this.labels) {
      const d = D.byId[id];
      if (!d) continue;
      const s = districtStats(g, id);
      const pop = s ? s.residents : 0;
      const jobs = s ? s.jobs : 0;
      const sub = pop > 0 ? `${pop.toLocaleString('de-DE')} Einw.${jobs ? ` · ${jobs.toLocaleString('de-DE')} Jobs` : ''}` : jobs ? `${jobs.toLocaleString('de-DE')} Arbeitsplätze` : '';
      const key = `${d.name}|${sub}|${d.color}`;
      if (!force && key === L.text) continue;
      L.text = key;
      drawLabel(L.ctx, L.canvas.width, L.canvas.height, d.name, sub, d.color);
      L.tex.needsUpdate = true;
    }
  }

  frame(dt) {
    const g = this.g, D = districtsOf(g);
    if (!D) return;
    // Beim Malen höchstens achtmal pro Sekunde neu aufbauen
    this.since = (this.since || 0) + dt;
    if (D.version !== this.version && (!this.e._districtPainting || this.since > 0.12)) { this.since = 0; this.rebuild(); }
    const active = !!this.e._districtTool || this.e.overlay.mode === 'districts';
    this.fade += ((active ? 1 : 0) - this.fade) * Math.min(1, dt * 6);
    this.fill.visible = this.fade > 0.02 && D.list.length > 0;
    this.fillMat.opacity = this.fade;
    this.borderMat.opacity = 0.8 + 0.2 * this.fade;
    this.border.visible = D.list.length > 0;
    this.labelTimer -= dt;
    if (this.labelTimer <= 0) { this.labelTimer = 2; this.updateLabelTexts(false); }
    this.refreshTints(dt);
    const cam = this.e.camera;
    const dist = this.e.rig.cur.dist;
    const show = Math.max(this.fade, Math.min(1, Math.max(0, (dist - 13) / 9)));
    for (const L of this.labels.values()) {
      if (!L.base) continue;
      const sp = L.sprite;
      // Konstante Bildschirmgröße (≈ 46 px hoch bei 720 px Bildhöhe), große Bezirke etwas größere Schilder
      const k = Math.hypot(cam.position.x - L.base.x, cam.position.y, cam.position.z - L.base.z);
      const px = 40 * (1 + Math.min(0.25, L.size / 2500));
      const hWorld = (px / Math.max(400, this.e.canvas.clientHeight || 720)) * 2 * k * Math.tan((cam.fov * Math.PI) / 360);
      sp.scale.set(hWorld * 4, hWorld, 1);
      sp.position.set(L.base.x, 1.2 + Math.min(6, dist * 0.04), L.base.z);
      sp.material.opacity = show;
      sp.visible = show > 0.03;
    }
  }

  // Übergangslösung (Bitte an G9): setTint() färbt bisher nur Kisten-Gebäude, nicht die Prototyp-Gebäude.
  // Solange eine Infoansicht aktiv ist, frischen wir deren Farben selbst auf.
  refreshTints(dt) {
    const bv = this.e.buildings;
    if (!bv || !bv.protoInst || typeof bv.update !== 'function' || bv.tintsProtos) return;
    const mode = this.e.overlay.mode;
    this.tintTimer = (this.tintTimer || 0) - dt;
    if (mode === this.lastMode && (mode === 'none' || this.tintTimer > 0)) return;
    this.lastMode = mode;
    this.tintTimer = 2;
    const g = this.g;
    for (const id of bv.protoInst.keys()) { const b = g.buildings.get(id); if (b) bv.update(b); }
  }

  dispose() {
    for (const L of this.labels.values()) { L.tex.dispose(); L.sprite.material.dispose(); }
    this.border.geometry.dispose(); this.fill.geometry.dispose();
    this.borderMat.dispose(); this.fillMat.dispose();
    this.e.scene.remove(this.group);
  }
}
registerView(DistrictView);

// ---------- Gewässerverschmutzung
class WaterPollutionView {
  constructor(engine) {
    this.e = engine;
    this.g = engine.game;
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    engine.scene.add(this.mesh);
    this.version = -1;
  }
  rebuild(C) {
    const g = this.g, { W, H } = g;
    const pol = C.waterPol;
    this.version = C.polVersion;
    const VW = W + 1;
    const vA = new Float32Array(VW * (H + 1));
    const vN = new Uint8Array(VW * (H + 1));
    for (let i = 0; i < g.N; i++) {
      if (g.world.terrain[i] !== T.WATER) continue;
      const x = i % W, y = (i / W) | 0;
      const p = pol[i];
      for (const k of [y * VW + x, y * VW + x + 1, (y + 1) * VW + x, (y + 1) * VW + x + 1]) { vA[k] += p; vN[k]++; }
    }
    const P = [], Cc = [], I = [];
    const TR = this.e.terrain, wpos = TR && TR.water && TR.water.position;
    const wy = (TR && typeof TR.waterLevel === 'number' ? TR.waterLevel : wpos ? wpos.y : -0.14) + 0.025;
    const ox = -W / 2, oz = -H / 2;
    const vidx = new Int32Array(VW * (H + 1)).fill(-1);
    const vert = (vx, vy) => {
      const k = vy * VW + vx;
      if (vidx[k] >= 0) return vidx[k];
      const p = vN[k] ? vA[k] / vN[k] : 0;
      const a = Math.min(0.86, Math.sqrt(p) * 0.95);
      // trübes Braun, stark verschmutzt fast schlammig
      const t = Math.min(1, p * 1.2);
      P.push(vx + ox, wy, vy + oz);
      Cc.push(0.5 - t * 0.14, 0.36 - t * 0.12, 0.13 - t * 0.05, a);
      vidx[k] = P.length / 3 - 1;
      return vidx[k];
    };
    let any = false;
    for (let i = 0; i < g.N; i++) {
      if (g.world.terrain[i] !== T.WATER) continue;
      const x = i % W, y = (i / W) | 0;
      const m = Math.max(pol[i], ...[i - 1, i + 1, i - W, i + W].filter((j) => j >= 0 && j < g.N).map((j) => pol[j]));
      if (m < 0.015) continue;
      any = true;
      const a = vert(x, y), b = vert(x + 1, y), c = vert(x + 1, y + 1), d = vert(x, y + 1);
      I.push(a, c, b, a, d, c);
    }
    this.mesh.geometry.dispose();
    const geo = new THREE.BufferGeometry();
    if (any) {
      geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 4));
      geo.setIndex(P.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(I, 1) : new THREE.Uint16BufferAttribute(I, 1));
    }
    this.mesh.geometry = geo;
    this.mesh.visible = any;
  }
  frame() {
    const C = this.g.ext && this.g.ext.citizens;
    if (!C || !C.waterPol) return;
    if (C.polVersion !== this.version) this.rebuild(C);
  }
  dispose() { this.mesh.geometry.dispose(); this.mat.dispose(); this.e.scene.remove(this.mesh); }
}
registerView(WaterPollutionView);

// ---------- Problemsymbole
registerIcon({
  id: 'cz_dead', color: '#aab2bd',
  draw(ctx, x, y) {
    // Sarg mit Kreuz
    ctx.fillStyle = '#8a6a4a';
    ctx.beginPath(); ctx.moveTo(x - 10, y - 34); ctx.lineTo(x + 10, y - 34); ctx.lineTo(x + 20, y - 14); ctx.lineTo(x + 13, y + 34); ctx.lineTo(x - 13, y + 34); ctx.lineTo(x - 20, y - 14); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#f2ece0'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y - 20); ctx.lineTo(x, y + 20); ctx.moveTo(x - 9, y - 7); ctx.lineTo(x + 9, y - 7); ctx.stroke();
  },
});
registerIcon({
  id: 'cz_sewage', color: '#a07a4a',
  draw(ctx, x, y) {
    // Rohr mit braunen Tropfen
    ctx.fillStyle = '#c9c3b6';
    ctx.fillRect(x - 30, y - 26, 34, 16);
    ctx.fillRect(x - 6, y - 30, 14, 24);
    ctx.fillStyle = '#9a7040';
    for (const [dx, dy, s] of [[1, 6, 9], [-12, 20, 7], [14, 24, 8]]) {
      ctx.beginPath(); ctx.moveTo(x + dx, y + dy - s * 1.8); ctx.bezierCurveTo(x + dx + s, y + dy - s * 0.4, x + dx + s, y + dy + s, x + dx, y + dy + s); ctx.bezierCurveTo(x + dx - s, y + dy + s, x + dx - s, y + dy - s * 0.4, x + dx, y + dy - s * 1.8); ctx.fill();
    }
  },
});
registerIcon({
  id: 'cz_sick', color: '#f06f6f',
  draw(ctx, x, y) {
    // Thermometer
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y + 20, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(x - 7, y - 32, 14, 50);
    ctx.beginPath(); ctx.arc(x, y - 32, 7, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#e8543f';
    ctx.beginPath(); ctx.arc(x, y + 20, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(x - 3, y - 18, 6, 36);
  },
});
registerIcon({
  id: 'cz_cold', color: '#7fd0ff',
  draw(ctx, x, y) {
    // Schneeflocke
    ctx.strokeStyle = '#dff3ff'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI) / 3;
      const c = Math.cos(a) * 32, s = Math.sin(a) * 32;
      ctx.beginPath(); ctx.moveTo(x - c, y - s); ctx.lineTo(x + c, y + s); ctx.stroke();
      for (const sg of [-1, 1]) {
        const ex = x + sg * c * 0.62, ey = y + sg * s * 0.62;
        ctx.beginPath();
        ctx.moveTo(ex + Math.cos(a + sg * 2.4) * 10, ey + Math.sin(a + sg * 2.4) * 10); ctx.lineTo(ex, ey); ctx.lineTo(ex + Math.cos(a - sg * 2.4) * 10, ey + Math.sin(a - sg * 2.4) * 10);
        ctx.stroke();
      }
    }
  },
});
BUILDING_PROBLEMS.push((g, b) => {
  const cz = b.cz;
  if (!cz) return null;
  if (cz.dead >= 1 && cz.deadDays >= 1) return 'cz_dead';
  if (cz.sewNeed && !cz.sew && cz.noSew >= 1) return 'cz_sewage';
  if (cz.sick > 0.16) return 'cz_sick';
  if (cz.cold > 0.3) return 'cz_cold';
  return null;
});

// ---------- Infoansichten
const ramp3 = (v, a, b, c) => {
  v = Math.max(0, Math.min(1, v));
  const lerp = (p, q, t) => Math.round(p + (q - p) * t);
  const [p, q, t] = v < 0.5 ? [a, b, v * 2] : [b, c, (v - 0.5) * 2];
  return (lerp(p >> 16, q >> 16, t) << 16) | (lerp((p >> 8) & 255, (q >> 8) & 255, t) << 8) | lerp(p & 255, q & 255, t);
};
registerOverlay({
  id: 'sewage', name: 'Abwasser', bad: false,
  icon: svg('<path d="M3 7h9v4H3zM12 5h3v8h-3"/><path d="M15 9h4l2 2"/><path d="M8 14c1.5 2 2.5 3.3 2.5 4.5a2.5 2.5 0 0 1-5 0C5.5 17.3 6.5 16 8 14Z"/>'),
  text: 'Grün: am Kanal. Grau: Sickergrube (nur kleine Häuser). Rot: braucht einen Kanalanschluss. Ab Stufe 3 brauchen Gebäude Kläranlage oder Auslass im selben Straßennetz.',
  building(g, b) {
    const cz = b.cz;
    const d = b.zone ? null : BUILDINGS[b.key];
    if (d && d.sewage) return 0x9a6a3a;
    if (!cz || !cz.water) return null;
    const hasNet = g.ext.citizens && g.ext.citizens.sewCap && b.comp >= 0 && g.ext.citizens.sewCap[b.comp] > 0;
    if (cz.sew && hasNet) return 0x45c46b;
    if (cz.sewNeed) return 0xe5483c;
    return 0xb9b2a5;
  },
});
registerOverlay({
  id: 'deathcare', name: 'Bestattung', bad: false,
  icon: svg('<path d="M12 3v18M7 8h10"/><path d="M5 21h14"/>'),
  text: 'Reichweite von Friedhöfen und Krematorien. Leichenwagen holen Verstorbene nur in ihrem Umkreis ab.',
  field: (g) => g.cov.deathcare || new Float32Array(g.N),
});
registerOverlay({
  id: 'age', name: 'Altersstruktur', bad: false,
  icon: svg('<circle cx="8" cy="6" r="2.5"/><circle cx="17" cy="8" r="2"/><path d="M4 21v-6a4 4 0 0 1 8 0v6M14 21v-5a3 3 0 0 1 6 0v5"/>'),
  text: 'Durchschnittsalter der Bewohner: gelb = junge Familien, blau = mittleres Alter, violett = viele Senioren.',
  building(g, b) {
    if (b.zone !== 1 || !b.cz || !b.cz.a || b.occ <= 0) return null;
    const age = avgAgeOf(b.cz.a);
    return ramp3((age - 18) / 42, 0xf2c230, 0x4c9be8, 0x8f5ad8);
  },
});
registerOverlay({
  id: 'eduLevel', name: 'Bildungsstand', bad: false,
  icon: svg('<path d="M2 9l10-5 10 5-10 5L2 9Z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5"/><path d="M12 14v7"/>'),
  text: 'Bildungsstand der Bewohner (Schulabschluss, Abitur, Hochschule). Hohe Wohnstufen und Büros brauchen gebildete Menschen.',
  building(g, b) {
    if (b.zone !== 1 || !b.cz || !b.cz.a || b.occ <= 0) return null;
    const e = eduIndex(b.cz.a);
    return e < 0 ? null : ramp3(e / 0.6, 0xe5483c, 0xf2c230, 0x45c46b);
  },
});
registerOverlay({
  id: 'districts', name: 'Bezirke', bad: false,
  icon: svg('<path d="M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2V5Z"/><path d="M9 3v16M15 5v16" stroke-dasharray="2 2.5"/>'),
  text: 'Gebäude in der Farbe ihres Bezirks. Bezirke malst du unter Zonen → Bezirk malen.',
  building(g, b) {
    const D = districtsOf(g);
    if (!D) return null;
    const id = D.map[anchorTile(g, b)];
    const d = id ? D.byId[id] : null;
    return d ? d.color : null;
  },
});
void BINS;
