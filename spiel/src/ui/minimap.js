// Minikarte: Gelände mit Schummerung, Wald, Zonen, Gebäude, Straßen und Pulsbahn-Linien auf Canvas,
// darüber das Sichtfeld der Kamera. Klicken/Ziehen springt, Mausrad zoomt. Bei aktiver Infoansicht (Feldwerte)
// zeigt sie dieselbe Wärmekarte. Die Grundebene wird nur nach Änderungen neu gezeichnet.
import { T, ZONE_INFO, BUILDINGS, R } from '../config.js';
import { LINE_COLORS } from '../sim/transit.js';
import { allOverlays } from '../render/overlay.js';
import { icon } from './icons.js';
import { catMeta } from './meta.js';

const hexRGB = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const cssRGB = (s) => { const n = parseInt(s.slice(1), 16); return hexRGB(n); };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const RAMP = [[229, 72, 60], [242, 194, 48], [69, 196, 107]];
function ramp(v, bad) { if (bad) v = 1 - v; v = Math.max(0, Math.min(1, v)); return v < 0.5 ? mix(RAMP[0], RAMP[1], v * 2) : mix(RAMP[1], RAMP[2], (v - 0.5) * 2); }

export class Minimap {
  constructor(ui, el) {
    this.ui = ui;
    this.g = ui.g;
    this.el = el;
    this.big = false;
    this.layer = 'auto';
    this.dirty = true;
    this.timer = 0;
    this.lastView = null;
    el.innerHTML = `<div class="mm-head"><span class="mm-t">${icon('map', 14, 2.2)}<b>Karte</b></span><span class="grow"></span>
<button data-mm="north" data-tip="Nach Norden ausrichten" data-tip-fast="1">${icon('target', 15)}</button>
<button data-mm="size" data-tip="Größer / kleiner" data-tip-fast="1">${icon('expand', 15)}</button>
<button data-mm="hide" data-tip="Minikarte ausblenden" data-key="K" data-tip-fast="1">${icon('close', 15)}</button></div>
<div class="mm-body"><canvas class="mm-c"></canvas><span class="mm-n">N</span></div>`;
    this.canvas = el.querySelector('canvas');
    this.base = document.createElement('canvas');
    const g = this.g;
    this.s = Math.max(2, Math.min(4, Math.floor(256 / g.W)));
    this.base.width = g.W * this.s; this.base.height = g.H * this.s;
    this.bctx = this.base.getContext('2d');
    this.heat = null;
    const mark = () => { this.dirty = true; };
    this.unbind = ['roadsChanged', 'zonesChanged', 'buildingAdded', 'buildingRemoved', 'buildingRebuilt', 'treesChanged', 'transitChanged', 'rubbleChanged'].map((ev) => g.on(ev, mark));
    this.unbind.push(g.on('hour', () => { if (this.ui.view !== 'none') this.heatDirty = true; }));
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mm]');
      if (!b) return;
      const a = b.dataset.mm;
      if (a === 'hide') this.ui.toggleMinimap(false);
      else if (a === 'size') { this.big = !this.big; el.classList.toggle('big', this.big); this.resize(); }
      else if (a === 'north') { const r = this.ui.app.engine.rig; r.goal.yaw = Math.round(r.goal.yaw / (Math.PI * 2)) * Math.PI * 2; }
    });
    const c = this.canvas;
    const jump = (e) => {
      const r = c.getBoundingClientRect();
      const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
      this.ui.app.engine.rig.focus(u * g.W - g.W / 2, v * g.H - g.H / 2);
    };
    c.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; this.drag = true; c.setPointerCapture(e.pointerId); jump(e); });
    c.addEventListener('pointermove', (e) => { if (this.drag) jump(e); });
    c.addEventListener('pointerup', () => { this.drag = false; });
    c.addEventListener('pointercancel', () => { this.drag = false; });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rig = this.ui.app.engine.rig;
      rig.goal.dist = Math.max(rig.minDist, Math.min(rig.maxDist, rig.goal.dist * Math.exp(Math.sign(e.deltaY) * 0.12)));
    }, { passive: false });
    this.resize();
  }

  dispose() { for (const u of this.unbind) u(); }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth || 176;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(w * dpr);
    this.ctx = this.canvas.getContext('2d');
    this.dpr = dpr;
  }

  renderBase() {
    const g = this.g, s = this.s, W = g.W, H = g.H, VW = W + 1;
    const img = this.bctx.createImageData(W, H);
    const d = img.data, wt = g.world;
    const GR = [143, 190, 104], GR2 = [120, 172, 88], SAND = [228, 214, 162], ROCK = [165, 158, 148], WATER = [86, 164, 214], DEEP = [56, 128, 188], FOREST = [70, 128, 74], ROAD = [78, 83, 94], HWY = [50, 54, 62], RUBBLE = [140, 110, 82];
    const zc = {}; for (const z of [1, 2, 3, 4]) zc[z] = hexRGB(ZONE_INFO[z].color);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const a = wt.vh[y * VW + x], b = wt.vh[y * VW + x + 1], c = wt.vh[(y + 1) * VW + x], e = wt.vh[(y + 1) * VW + x + 1];
      const gx = (b + e - a - c) / 2, gy = (c + e - a - b) / 2;
      let shade = 1 - (gx + gy) * 0.22;
      shade = Math.max(0.68, Math.min(1.3, shade));
      const t = wt.terrain[i];
      let col;
      if (t === T.WATER) { const dd = Math.min(1, -(a + b + c + e) / 4 / 2.2); col = mix(WATER, DEEP, Math.max(0, dd)); shade = 1; }
      else if (t === T.SAND) col = SAND;
      else if (t === T.ROCK) { const hh = Math.min(1, (a + b + c + e) / 4 / 5); col = mix(ROCK, [222, 218, 210], hh * 0.7); }
      else col = ((x * 7 + y * 13) % 5 === 0) ? GR2 : GR;
      if (t !== T.WATER && wt.trees[i]) col = mix(col, FOREST, Math.min(1, 0.45 + wt.trees[i] * 0.2));
      if (g.zone[i] && !g.bld[i]) col = mix(col, zc[g.zone[i]], 0.4);
      if (g.rubble[i]) col = RUBBLE;
      const r = g.road[i];
      if (r) { col = r === R.HIGHWAY ? HWY : ROAD; shade = 1; }
      const k = i * 4;
      d[k] = col[0] * shade; d[k + 1] = col[1] * shade; d[k + 2] = col[2] * shade; d[k + 3] = 255;
    }
    // Gebäude
    for (const bd of g.buildings.values()) {
      let col;
      if (bd.zone) col = mix(zc[bd.zone], [30, 35, 48], 0.12 + bd.level * 0.07);
      else col = cssRGB(catMeta(BUILDINGS[bd.key] ? BUILDINGS[bd.key].cat : 'mehr').color);
      if (bd.abandoned) col = [120, 116, 110];
      if (bd.burning) col = [255, 96, 40];
      for (let yy = bd.y; yy < bd.y + bd.h; yy++) for (let xx = bd.x; xx < bd.x + bd.w; xx++) {
        const k = (yy * W + xx) * 4;
        if (k < 0 || k >= d.length) continue;
        d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2];
      }
    }
    // auf die Zielgröße bringen (weich), dann Linien darüber
    const tmp = this._tmp || (this._tmp = document.createElement('canvas'));
    tmp.width = W; tmp.height = H;
    tmp.getContext('2d').putImageData(img, 0, 0);
    const bc = this.bctx;
    bc.imageSmoothingEnabled = false;
    bc.clearRect(0, 0, W * s, H * s);
    bc.drawImage(tmp, 0, 0, W * s, H * s);
    // Pulsbahn
    bc.lineJoin = 'round'; bc.lineCap = 'round';
    for (const line of g.transit.lines) {
      if (!line.pts || line.pts.length < 2) continue;
      const col = '#' + LINE_COLORS[line.color].toString(16).padStart(6, '0');
      bc.beginPath();
      line.pts.forEach(([px, py], k) => (k ? bc.lineTo(px * s, py * s) : bc.moveTo(px * s, py * s)));
      if (line.loop) bc.closePath();
      bc.strokeStyle = 'rgba(255,255,255,0.9)'; bc.lineWidth = s * 1.3 + 2; bc.stroke();
      bc.strokeStyle = col; bc.lineWidth = s * 1.3; bc.stroke();
    }
    for (const st of g.transit.stations.values()) {
      bc.beginPath(); bc.arc((st.x + 0.5) * s, (st.y + 0.5) * s, s * 0.9 + 1, 0, Math.PI * 2);
      bc.fillStyle = '#fff'; bc.fill(); bc.lineWidth = Math.max(1, s * 0.45); bc.strokeStyle = '#1d2330'; bc.stroke();
    }
    this.dirty = false;
    this.heatDirty = true;
  }

  renderHeat(def) {
    const g = this.g;
    if (!def || !def.field) { this.heat = null; return; }
    let arr, key = '';
    try {
      if (typeof def.field === 'function') arr = def.field(g);
      else { const p = def.field.split(':'); key = p[1]; arr = g[p[0]] && g[p[0]][key]; }
    } catch (e) { arr = null; }
    if (!arr) { this.heat = null; return; }
    const c = this.heat || document.createElement('canvas');
    c.width = g.W; c.height = g.H;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.H);
    const sc = def.scale || 1;
    for (let i = 0; i < g.N; i++) {
      const t = g.world.terrain[i];
      if (t === T.WATER || t === T.ROCK) continue;
      const col = ramp(arr[i] / sc, def.bad);
      img.data[i * 4] = col[0]; img.data[i * 4 + 1] = col[1]; img.data[i * 4 + 2] = col[2]; img.data[i * 4 + 3] = 170;
    }
    ctx.putImageData(img, 0, 0);
    this.heat = c;
    this.heatDirty = false;
  }

  setVisible(v) { this.el.hidden = !v; if (v) { this.resize(); this.dirty = true; } }

  update(dt) {
    if (this.el.hidden) return;
    this.timer -= dt;
    const view = this.ui.view;
    if (view !== this.lastView) { this.lastView = view; this.heatDirty = true; }
    if (this.dirty && this.timer <= 0) { this.renderBase(); this.timer = 1.2; }
    if (this.heatDirty) {
      const def = view !== 'none' ? allOverlays().find((o) => o.id === view) : null;
      if (def && def.field) this.renderHeat(def); else { this.heat = null; this.heatDirty = false; }
    }
    this.draw();
  }

  draw() {
    const ctx = this.ctx, g = this.g;
    const cw = this.canvas.width, ch = this.canvas.height;
    ctx.clearRect(0, 0, cw, ch);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.base, 0, 0, cw, ch);
    if (this.heat) { ctx.imageSmoothingEnabled = true; ctx.drawImage(this.heat, 0, 0, cw, ch); }
    // Sichtfeld
    const eng = this.ui.app.engine;
    const rig = eng.rig, rect = eng.canvas.getBoundingClientRect();
    const pts = [];
    const sx = cw / g.W, sy = ch / g.H;
    for (const [u, v] of [[0, 0.06], [1, 0.06], [1, 1], [0, 1]]) {
      const p = rig.groundAt(rect.left + u * rect.width, rect.top + v * rect.height);
      if (!p) continue;
      pts.push([(p.x + g.W / 2) * sx, (p.z + g.H / 2) * sy]);
    }
    if (pts.length >= 3) {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, cw, ch); ctx.clip();
      ctx.beginPath();
      pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill();
      ctx.lineWidth = 1.6 * this.dpr; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.stroke();
      ctx.restore();
    }
    const t = rig.target;
    const cx = (t.x + g.W / 2) * sx, cy = (t.z + g.H / 2) * sy;
    ctx.beginPath(); ctx.arc(cx, cy, 3.2 * this.dpr, 0, Math.PI * 2);
    ctx.fillStyle = '#e8543f'; ctx.fill(); ctx.lineWidth = 1.5 * this.dpr; ctx.strokeStyle = '#fff'; ctx.stroke();
  }
}
