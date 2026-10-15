// Ansicht „Leben in der Stadt" (Besitzer: G10): Fußgänger, Radfahrer, Vogelschwärme, Boote, Flugzeuge mit
// Kondensstreifen und ab und zu ein Heißluftballon. Alles rein darstellend (keine Simulation nötig), instanziert,
// mit Detailstufen und nur in der Nähe der Kamera – dort, wo man es sieht.
//
// Fußgänger laufen auf einem Gehweg-Graphen (vier Ecken je Straßenfeld, Zebrastreifen an Kreuzungen), entstehen und
// verschwinden an Hauseingängen. Ihre Dichte folgt Bewohnern, Arbeitsplätzen, Geschäften und der Tageszeit.
import * as THREE from 'three';
import { registerView } from '../../registry.js';
import { R, T, Z, ROAD_GEOM } from '../../config.js';
import { roadMask } from '../../sim/network.js';
import { Batch, GlowPoints, hashf, VU } from '../vehicles_kit.js';
import { lifeGeometry, getPeopleMaterial, getPeopleDepthMaterial, setPeopleTime, FEAT, MODE, baseFeatures, wearFeatures, wearOf } from '../vehicles_people.js';
import { Fleet } from '../agents.js';

const QUAL = { low: 0.4, medium: 1, high: 1.7, ultra: 2.4 };
const SHIRTS = [0x2f6db3, 0xb8302a, 0xf2f2ee, 0x2a2d31, 0x2f7a4f, 0xe8b52c, 0x8f5ad8, 0xd26a8a, 0x5d7f8f, 0xc9672e, 0x6f747a, 0x1f3b63, 0xe6e2d8, 0x8a3c2e, 0x3ab6d8];
const COATS = [0x3a3f45, 0x5a4636, 0x1f3b63, 0x6b2f2a, 0x7a7466, 0x2a2d31, 0x45544a, 0x8a6a4a];
const SPORT = [0xe8452c, 0x2fb3d8, 0x9ad82f, 0xf06fae, 0xf2f2ee, 0x2a2d31, 0xe8b52c];
const UMBRELLAS = [0x1f3b63, 0xb8302a, 0x2a2d31, 0xe8b52c, 0x2f7a4f, 0x8f5ad8, 0xf06fae];
const _c = new THREE.Color();
const gauss = (h, m, s) => Math.exp(-0.5 * ((h - m) / s) ** 2);
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Tageskurven (Anteil der Menschen draußen)
function resCurve(h) { return 0.05 + 0.5 * gauss(h, 8, 1.2) + 0.65 * gauss(h, 17.5, 2.2) + 0.35 * gauss(h, 12.5, 3) + 0.15 * gauss(h, 20.5, 1.5); }
function comCurve(h) { return 0.03 + 0.95 * gauss(h, 14, 3.6) + 0.35 * gauss(h, 19.5, 1.6); }
function jobCurve(h) { return 0.02 + 0.8 * gauss(h, 7.8, 1) + 0.6 * gauss(h, 12.3, 0.8) + 0.8 * gauss(h, 17, 1.1); }

// ---------------------------------------------------------------- Gehweg-Graph
// Knoten = Feld * 4 + Ecke (0: −x−z, 1: +x−z, 2: +x+z, 3: −x+z)
const CX = [-1, 1, 1, -1], CZ = [-1, -1, 1, 1];

class Walkways {
  constructor(view) { this.v = view; this.g = view.g; this.dirty = true; }
  rebuild() {
    const g = this.g, W = g.W, N = g.N;
    this.dirty = false;
    this.mask = new Uint8Array(N);
    this.off = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const r = g.road[i];
      if (!r || r === R.HIGHWAY) continue;
      this.mask[i] = roadMask(g, i);
      const geo = ROAD_GEOM[r] || ROAD_GEOM[2];
      this.off[i] = geo.width / 2 + geo.sidewalk / 2;
    }
    void W;
  }
  ok(i) { return i >= 0 && i < this.g.N && this.off[i] > 0; }
  // Nachbarknoten von n: [[knoten, überquert?], …]
  neighbors(n, out) {
    out.length = 0;
    const g = this.g, W = g.W;
    const i = n >> 2, c = n & 3;
    const m = this.mask[i];
    const x = i % W, y = (i / W) | 0;
    const nb = (dx, dy) => { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= g.H) return -1; const j = yy * W + xx; return this.ok(j) ? j : -1; };
    // innerhalb des Feldes: Nachbarecken (überquert einen Straßenarm, wenn es ihn gibt)
    const across = [m & 1, m & 2, m & 4, m & 8]; // N, O, S, W
    const intra = [[1, 0], [3, 3], [0, 0], [2, 1], [1, 1], [3, 2], [2, 2], [0, 3]];
    // Ecke c → (Ziel-Ecke, Arm-Index)
    const pairs = { 0: [[1, 0], [3, 3]], 1: [[0, 0], [2, 1]], 2: [[3, 2], [1, 1]], 3: [[2, 2], [0, 3]] }[c];
    void intra;
    for (const [cc, arm] of pairs) out.push([i * 4 + cc, across[arm] ? 1 : 0]);
    // zu Nachbarfeldern entlang der Straße
    if (c === 0 || c === 1) { if (m & 1) { const j = nb(0, -1); if (j >= 0) out.push([j * 4 + (c === 0 ? 3 : 2), 0]); } }
    if (c === 2 || c === 3) { if (m & 4) { const j = nb(0, 1); if (j >= 0) out.push([j * 4 + (c === 3 ? 0 : 1), 0]); } }
    if (c === 1 || c === 2) { if (m & 2) { const j = nb(1, 0); if (j >= 0) out.push([j * 4 + (c === 1 ? 0 : 3), 0]); } }
    if (c === 0 || c === 3) { if (m & 8) { const j = nb(-1, 0); if (j >= 0) out.push([j * 4 + (c === 0 ? 1 : 2), 0]); } }
    return out;
  }
  pos(n, out) {
    const g = this.g, W = g.W;
    const i = n >> 2, c = n & 3;
    const o = this.off[i];
    out[0] = (i % W) + 0.5 - g.W / 2 + CX[c] * o;
    out[1] = ((i / W) | 0) + 0.5 - g.H / 2 + CZ[c] * o;
    return out;
  }
  isJunction(i) { const m = this.mask[i]; return ((m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1)) >= 3; }
}

// ---------------------------------------------------------------- Fußgänger
class Pedestrians {
  constructor(view) {
    this.v = view; this.g = view.g; this.e = view.e;
    const q = QUAL[this.e.settings && this.e.settings.quality] ?? 1;
    this.max = Math.round(1300 * q);
    const n = this.max;
    this.ax = new Float32Array(n); this.az = new Float32Array(n);
    this.bx = new Float32Array(n); this.bz = new Float32Array(n);
    this.t = new Float32Array(n); this.len = new Float32Array(n);
    this.node = new Int32Array(n); this.prev = new Int32Array(n);
    this.speed = new Float32Array(n); this.phase = new Float32Array(n);
    this.seed = new Float32Array(n); this.lane = new Float32Array(n);
    this.steps = new Int16Array(n); this.state = new Uint8Array(n); // 0 frei, 1 kommt heraus, 2 läuft, 3 geht hinein
    this.scale = new Float32Array(n); this.kind = new Uint8Array(n); this.age = new Float32Array(n);
    this.feat = new Int32Array(n); this.amt = new Float32Array(n); this.wait = new Float32Array(n); this.gait = new Float32Array(n);
    this.count = 0;
    this.free = [];
    for (let i = n - 1; i >= 0; i--) this.free.push(i);
    const mat = getPeopleMaterial(), depth = getPeopleDepthMaterial();
    const parent = this.e.scene;
    // Eine Geometrie je Detailstufe für alle Fußgänger (Kleidung/Zubehör über Merkmale im Shader)
    this.near = new Batch(parent, lifeGeometry('human', 2).clone(), mat, { shadow: true, cap: 128, depth });
    this.mid = new Batch(parent, lifeGeometry('human', 1).clone(), mat, { shadow: false, cap: 256 });
    this.far = new Batch(parent, lifeGeometry('human', 0).clone(), mat, { shadow: false, cap: 512 });
    this.umb = new Batch(parent, lifeGeometry('umbrella', 2).clone(), mat, { shadow: false, cap: 32 });
    this.tmp = [0, 0];
    this.nbs = [];
    this.spawnAcc = 0;
  }
  live() { return this.max - this.free.length; }

  spawn(tile, wx) {
    if (!this.free.length) return;
    const ww = wx;
    const c = Math.floor(Math.random() * 4);
    const n = tile * 4 + c;
    const k = this.free.pop();
    ww.pos(n, this.tmp);
    // aus der Haustür: Startpunkt am Feldrand hinter der Ecke
    const W = this.g.W;
    const cx = (tile % W) + 0.5 - this.g.W / 2, cz = ((tile / W) | 0) + 0.5 - this.g.H / 2;
    const m = ww.mask[tile];
    const sideX = !(m & (CX[c] > 0 ? 2 : 8)), sideZ = !(m & (CZ[c] > 0 ? 4 : 1));
    let sx = this.tmp[0], sz = this.tmp[1];
    if (sideZ) sz = cz + CZ[c] * 0.5;
    else if (sideX) sx = cx + CX[c] * 0.5;
    this.ax[k] = sx; this.az[k] = sz;
    this.bx[k] = this.tmp[0]; this.bz[k] = this.tmp[1];
    this.len[k] = Math.max(0.01, Math.hypot(this.bx[k] - sx, this.bz[k] - sz));
    this.t[k] = 0;
    this.node[k] = n; this.prev[k] = -1;
    const u = Math.random();
    this.kind[k] = u < 0.08 ? 2 : u < 0.15 ? 3 : u < 0.2 ? 4 : 0; // 2 Kind, 3 Senior, 4 Jogger
    const kd = this.kind[k];
    this.speed[k] = (kd === 3 ? 0.075 : kd === 2 ? 0.1 : kd === 4 ? 0.24 + Math.random() * 0.05 : 0.11 + Math.random() * 0.05);
    this.gait[k] = kd === 4 ? 1.85 : 1;
    this.amt[k] = this.gait[k]; this.wait[k] = 0;
    this.feat[k] = baseFeatures(kd, Math.random());
    this.phase[k] = Math.random() * 6.28;
    this.seed[k] = Math.random();
    this.lane[k] = (Math.random() < 0.85 ? 1 : -1) * (0.012 + Math.random() * 0.018);
    this.steps[k] = 4 + Math.floor(Math.random() * 22);
    this.state[k] = 1;
    this.scale[k] = 0;
    this.age[k] = 0;
  }

  // nächstes Ziel wählen
  advance(k, wx) {
    const n = this.node[k];
    const nbs = wx.neighbors(n, this.nbs);
    if (!nbs.length) { this.state[k] = 3; return; }
    let tot = 0;
    const i = n >> 2;
    const jn = wx.isJunction(i);
    for (const q of nbs) { q[2] = q[0] === this.prev[k] ? 0.02 : q[1] ? (jn ? 0.35 : 0.03) : 1; tot += q[2]; }
    let r = Math.random() * tot, pick = nbs[0];
    for (const q of nbs) { r -= q[2]; if (r <= 0) { pick = q; break; } }
    this.ax[k] = this.bx[k]; this.az[k] = this.bz[k];
    wx.pos(pick[0], this.tmp);
    this.bx[k] = this.tmp[0]; this.bz[k] = this.tmp[1];
    this.len[k] = Math.max(0.01, Math.hypot(this.bx[k] - this.ax[k], this.bz[k] - this.az[k]));
    this.t[k] = 0;
    this.prev[k] = n; this.node[k] = pick[0];
    if (pick[1]) this.speed[k] = Math.max(this.speed[k], this.kind[k] === 4 ? 0.24 : 0.13);
    // kurz stehen bleiben: vor dem Überqueren (Ampel/Verkehr), sonst ab und zu (Schaufenster, Gespräch)
    if (this.kind[k] !== 4) {
      if (pick[1] && jn && Math.random() < 0.55) this.wait[k] = 1.5 + Math.random() * 4;
      else if (!pick[1] && Math.random() < 0.07) this.wait[k] = 2 + Math.random() * 6;
    }
  }

  // ins Haus gehen: vom Knoten zum Feldrand
  enter(k, wx) {
    const n = this.node[k], c = n & 3, tile = n >> 2;
    const W = this.g.W;
    const cx = (tile % W) + 0.5 - this.g.W / 2, cz = ((tile / W) | 0) + 0.5 - this.g.H / 2;
    const m = wx.mask[tile];
    this.ax[k] = this.bx[k]; this.az[k] = this.bz[k];
    let ex = this.ax[k], ez = this.az[k];
    if (!(m & (CZ[c] > 0 ? 4 : 1))) ez = cz + CZ[c] * 0.5;
    else if (!(m & (CX[c] > 0 ? 2 : 8))) ex = cx + CX[c] * 0.5;
    this.bx[k] = ex; this.bz[k] = ez;
    this.len[k] = Math.max(0.01, Math.hypot(ex - this.ax[k], ez - this.az[k]));
    this.t[k] = 0;
    this.state[k] = 3;
  }

  kill(k) { this.state[k] = 0; this.free.push(k); }

  update(dt, ctx) {
    const wx = this.v.walk;
    const g = this.g;
    // Zielanzahl
    const target = Math.min(this.max, Math.round(ctx.pedTarget));
    let live = this.live();
    if (live < target && ctx.cand && ctx.cand.total > 0) {
      this.spawnAcc += Math.min(80, (target - live) * 0.5 + 2) * Math.max(dt, 0.016) * 6;
      let guard = 0;
      while (this.spawnAcc >= 1 && guard++ < 60 && this.free.length) {
        this.spawnAcc -= 1;
        const tile = ctx.cand.sample(Math.random());
        if (tile >= 0) this.spawn(tile, wx);
      }
    } else this.spawnAcc = 0;
    const tooMany = live > target * 1.15 + 5;
    const R2 = ctx.radius * ctx.radius;
    const cx = ctx.cx, cz = ctx.cz;
    for (let k = 0; k < this.max; k++) {
      const st = this.state[k];
      if (!st) continue;
      this.age[k] += dt;
      // Warten: auslaufen lassen (Gangstärke → 0), dann wieder anlaufen
      let go = 1;
      if (this.wait[k] > 0 && st === 2) { this.wait[k] -= dt; go = 0; }
      const want = go ? this.gait[k] : 0;
      const a0 = this.amt[k];
      this.amt[k] = a0 + (want - a0) * Math.min(1, dt * (want > a0 ? 5 : 7));
      const mv = Math.min(1, this.amt[k] / Math.max(0.01, this.gait[k]));
      const v = this.speed[k] * dt * mv;
      this.t[k] += v / this.len[k];
      // Schrittfrequenz passend zur Geschwindigkeit (Joggen: längere Schritte)
      this.phase[k] += (this.speed[k] / (this.kind[k] === 4 ? 0.105 : this.kind[k] === 2 ? 0.055 : 0.068)) * Math.PI * dt * mv;
      if (st === 1 || st === 2) this.scale[k] = Math.min(1, this.scale[k] + dt * 4);
      else if (st === 3 && this.t[k] > 0.6) this.scale[k] = Math.max(0, this.scale[k] - dt * 5);
      while (this.t[k] >= 1) {
        if (st === 3) { this.kill(k); break; }
        this.state[k] = 2;
        if (--this.steps[k] <= 0 || (tooMany && Math.random() < 0.3)) { this.enter(k, wx); break; }
        if (!wx.ok(this.node[k] >> 2)) { this.kill(k); break; }
        this.advance(k, wx);
      }
      if (!this.state[k]) continue;
      // weit weg von der Kamera → sofort entfernen
      const dx = this.bx[k] - cx, dz = this.bz[k] - cz;
      if (dx * dx + dz * dz > R2 * 1.3) this.kill(k);
    }
    void g;
  }

  begin() { this.near.begin(); this.mid.begin(); this.far.begin(); this.umb.begin(); }
  finish() { this.near.finish(); this.mid.finish(); this.far.finish(); this.umb.finish(); }
  // Detailstufe nach Abstand²: volle Figur, vereinfacht, Fernform
  pick(d2, ctx) { return d2 < ctx.near2 ? this.near : d2 < ctx.midNear2 ? this.mid : this.far; }
  draw(ctx) {
    const fr = ctx.frustum, sph = ctx.sph, cam = ctx.cam;
    const swY = ctx.swY;
    const rain = ctx.rain > 0.25;
    const mid2 = ctx.mid2;
    const wf = ctx.wearFeat;
    for (let k = 0; k < this.max; k++) {
      if (!this.state[k]) continue;
      const t = Math.min(1, this.t[k]);
      let dx = this.bx[k] - this.ax[k], dz = this.bz[k] - this.az[k];
      const l = this.len[k];
      dx /= l; dz /= l;
      const ln = this.lane[k];
      const x = this.ax[k] + (this.bx[k] - this.ax[k]) * t - dz * ln;
      const z = this.az[k] + (this.bz[k] - this.az[k]) * t + dx * ln;
      const y = ctx.yAt(x, z) + swY;
      const ex = x - cam.x, ey = y - cam.y, ez = z - cam.z;
      const d2 = ex * ex + ey * ey + ez * ez;
      if (d2 > mid2) continue;
      sph.center.set(x, y + 0.09, z);
      if (!fr.intersectsSphere(sph)) continue;
      const kind = this.kind[k];
      const sd = this.seed[k];
      const s = this.scale[k] * (kind === 2 ? 0.6 + sd * 0.12 : kind === 3 ? 0.95 : 0.93 + sd * 0.13);
      if (s <= 0.01) continue;
      // Statur: Breite unabhängig von der Größe
      const wdt = s * (kind === 2 ? 1.06 : 0.92 + ((sd * 7.31) % 1) * 0.2);
      let yaw = Math.atan2(dx, dz);
      // Wartende drehen sich etwas zur Straße/zum Schaufenster
      if (this.amt[k] < 0.6 && kind !== 4) yaw += Math.sin(sd * 40) * 0.9 * (1 - this.amt[k] / 0.6);
      let f = this.feat[k] | wearFeatures(wf, kind, sd);
      const umb = rain && kind !== 2 && kind !== 4 && sd > 0.25;
      if (umb) f |= FEAT.UMBRELLA;
      _c.setHex(kind === 4 ? SPORT[Math.floor(sd * 911) % SPORT.length] : (f & FEAT.COAT) ? COATS[Math.floor(sd * 7919) % COATS.length] : SHIRTS[Math.floor(sd * 7919) % SHIRTS.length]);
      const b = this.pick(d2, ctx);
      const w = MODE.WALK + 8 * f;
      b.push(x, y, z, yaw, 0, 0, wdt, s, wdt, _c.r, _c.g, _c.b, this.phase[k], this.amt[k], sd, w);
      if (umb && d2 < ctx.midNear2) {
        _c.setHex(UMBRELLAS[Math.floor(sd * 131) % UMBRELLAS.length]);
        this.umb.push(x, y, z, yaw, 0, 0, wdt, s, wdt, _c.r, _c.g, _c.b, this.phase[k], this.amt[k], sd, w);
      }
    }
  }
}

// ---------------------------------------------------------------- Radfahrer
class Cyclists {
  constructor(view) {
    this.v = view; this.g = view.g; this.e = view.e;
    const q = QUAL[this.e.settings && this.e.settings.quality] ?? 1;
    this.max = Math.round(110 * q);
    this.list = [];
    const mat = getPeopleMaterial();
    this.near = new Batch(this.e.scene, lifeGeometry('bicycle', 2).clone(), mat, { shadow: true, cap: 32, depth: getPeopleDepthMaterial() });
    this.mid = new Batch(this.e.scene, lifeGeometry('bicycle', 1).clone(), mat, { shadow: false, cap: 64 });
  }
  nextTile(c) {
    const g = this.g, W = g.W;
    const x = c.cur % W, y = (c.cur / W) | 0;
    const opts = [];
    const m = roadMask(g, c.cur);
    const dirs = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]];
    for (const [dx, dy, bit] of dirs) {
      if (!(m & bit)) continue;
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= g.H) continue;
      const j = yy * W + xx;
      if (j === c.prev || g.road[j] === R.HIGHWAY) continue;
      opts.push(j);
    }
    if (!opts.length) return c.prev >= 0 && g.road[c.prev] ? c.prev : -1;
    return opts[Math.floor(Math.random() * opts.length)];
  }
  spawn(tile) {
    const c = { prev: -1, cur: tile, next: -1, t: 0, speed: 0.32 + Math.random() * 0.16, phase: Math.random() * 6, seed: Math.random(), life: 8 + Math.random() * 30 };
    c.feat = (Math.random() < 0.45 ? FEAT.HELMET : 0) | (Math.random() < 0.25 ? FEAT.BACKPACK : 0) | (Math.random() < 0.3 ? FEAT.LONGHAIR : 0);
    c.next = this.nextTile(c);
    if (c.next < 0) return;
    // vorheriges Feld = entgegengesetzt
    const g = this.g, W = g.W;
    const dx = (c.next % W) - (tile % W), dy = ((c.next / W) | 0) - ((tile / W) | 0);
    const px = (tile % W) - dx, py = ((tile / W) | 0) - dy;
    c.prev = px >= 0 && py >= 0 && px < W && py < g.H ? py * W + px : tile;
    c.t = Math.random();
    this.list.push(c);
  }
  update(dt, ctx) {
    const target = Math.min(this.max, Math.round(ctx.bikeTarget));
    if (this.list.length < target && ctx.cand && ctx.cand.total > 0 && Math.random() < 0.5) {
      const t = ctx.cand.sample(Math.random());
      if (t >= 0) this.spawn(t);
    }
    const g = this.g;
    const R2 = ctx.radius * ctx.radius * 1.3;
    let w = 0;
    for (const c of this.list) {
      c.t += c.speed * dt;
      c.life -= dt;
      c.phase += c.speed * dt * 11; // Tretkurbel ≈ 0,7 Umdrehungen/s
      let alive = true;
      while (c.t >= 1) {
        c.t -= 1;
        c.prev = c.cur; c.cur = c.next;
        if (!g.road[c.cur] || c.life < 0) { alive = false; break; }
        c.next = this.nextTile(c);
        if (c.next < 0) { alive = false; break; }
      }
      if (alive && (!g.road[c.cur] || !g.road[c.next])) alive = false;
      if (alive) {
        this.pose(c);
        const dx = c.x - ctx.cx, dz = c.z - ctx.cz;
        if (dx * dx + dz * dz > R2) alive = false;
      }
      if (alive) this.list[w++] = c;
    }
    this.list.length = w;
    if (this.list.length > target + 4) this.list.length = target + 4;
  }
  pose(c) {
    const g = this.g, W = g.W;
    const cxp = (i) => (i % W), cyp = (i) => ((i / W) | 0);
    const Ax = (cxp(c.prev) + cxp(c.cur)) / 2, Ay = (cyp(c.prev) + cyp(c.cur)) / 2;
    const Bx = cxp(c.cur), By = cyp(c.cur);
    const Cx = (cxp(c.cur) + cxp(c.next)) / 2, Cy = (cyp(c.cur) + cyp(c.next)) / 2;
    const t = c.t, u = 1 - t;
    let x = u * u * Ax + 2 * u * t * Bx + t * t * Cx;
    let y = u * u * Ay + 2 * u * t * By + t * t * Cy;
    let tx = 2 * u * (Bx - Ax) + 2 * t * (Cx - Bx), ty = 2 * u * (By - Ay) + 2 * t * (Cy - By);
    const l = Math.hypot(tx, ty) || 1;
    tx /= l; ty /= l;
    const geo = ROAD_GEOM[g.road[c.cur]] || ROAD_GEOM[2];
    const off = geo.width / 2 - 0.045;
    c.x = x + 0.5 - g.W / 2 - ty * off;
    c.z = y + 0.5 - g.H / 2 + tx * off;
    c.yaw = Math.atan2(tx, ty);
    c.lean = 0;
  }
  begin() { this.near.begin(); this.mid.begin(); }
  finish() { this.near.finish(); this.mid.finish(); }
  // Rad und Fahrer (Fahrer als Mensch in Haltung „Rad" im Fußgänger-Stapel: gleiche Phase → Beine treten die Pedale)
  draw(ctx, peds) {
    const wf = ctx.wearFeat;
    for (const c of this.list) {
      if (c.x === undefined) continue;
      const y = ctx.yAt(c.x, c.z);
      const ex = c.x - ctx.cam.x, ey = y - ctx.cam.y, ez = c.z - ctx.cam.z;
      const d2 = ex * ex + ey * ey + ez * ez;
      if (d2 > ctx.mid2) continue;
      ctx.sph.center.set(c.x, y + 0.08, c.z);
      if (!ctx.frustum.intersectsSphere(ctx.sph)) continue;
      const near = d2 < ctx.near2;
      _c.setHex(BIKES[Math.floor(c.seed * 557) % BIKES.length]);
      (near ? this.near : this.mid).push(c.x, y, c.z, c.yaw, 0, 0, 1, 1, 1, _c.r, _c.g, _c.b, c.phase, 1, c.seed, 0);
      const f = (c.feat | wearFeatures(wf, 0, c.seed)) & ~(FEAT.COAT | FEAT.SKIRT);
      _c.setHex(SHIRTS[Math.floor(c.seed * 7919) % SHIRTS.length]);
      (near ? peds.near : peds.mid).push(c.x, y, c.z, c.yaw, 0, 0, 1, 1, 1, _c.r, _c.g, _c.b, c.phase, 1, c.seed, MODE.CYCLE + 8 * f); // Fahrer nie als Fernform (sitzt)
    }
  }
}
const BIKES = [0x2a2d31, 0xb8302a, 0x1f3b63, 0xd9dcdf, 0x2f7a4f, 0x8a9096, 0xe8b52c, 0x3ab6d8];

// ---------------------------------------------------------------- Sitzende auf Straßenbänken und Tauben davor
// Belegung je Bank deterministisch aus Ort und Spielzeit (wechselt alle ~45 Spielminuten), weich ein- und ausgeblendet.
class Sitters {
  constructor(view) {
    this.v = view; this.g = view.g; this.e = view.e;
    this.seats = new Map(); // Schlüssel → { x, y, z, yaw, seed, s, on, kind, feat }
    this.birds = new Map(); // Bank → [{ x, z, h, ph, rate, peck, t }]
    this.timer = 0;
    this.tmp = [];
    this.pigeons = new Batch(this.e.scene, lifeGeometry('pigeon', 2).clone(), getPeopleMaterial(), { shadow: false, cap: 64 });
  }
  occupancy(h, ctx) {
    const day = gauss(h, 11, 2.5) * 0.55 + gauss(h, 16.5, 2.4) * 0.8 + gauss(h, 20, 1.2) * 0.25;
    return Math.min(0.85, day) * (1 - Math.min(1, ctx.rain * 1.6)) * (ctx.cold ? 0.35 : 1);
  }
  update(dt, ctx) {
    const roads = this.e.roads;
    this.timer -= dt;
    if (this.timer <= 0 && roads && roads.benchesNear) {
      this.timer = 1.2;
      const g = this.g;
      const list = roads.benchesNear(ctx.cx, ctx.cz, Math.min(ctx.radius, 26), this.tmp);
      const occ = this.occupancy(g.hour(), ctx);
      const period = Math.floor(g.time / 45);
      const seen = new Set();
      for (let i = 0; i < list.length; i += 4) {
        const x = list[i], y = list[i + 1], z = list[i + 2], yaw = list[i + 3];
        const bk = Math.round(x * 50) * 73856093 ^ Math.round(z * 50) * 19349663;
        for (let j = 0; j < 2; j++) {
          const key = bk * 2 + j;
          seen.add(key);
          const r = hashf((bk & 0xffff) * 0.37 + j * 13.1 + period * 7.77);
          const on = r < occ * (j ? 0.45 : 1);
          let st = this.seats.get(key);
          if (!st) {
            if (!on) continue;
            const off = j ? -0.038 : 0.036;
            const seed = hashf(r * 917 + j);
            const kind = seed < 0.3 ? 3 : seed < 0.36 ? 2 : 0;
            st = { x: x + Math.cos(yaw) * off, y, z: z - Math.sin(yaw) * off, yaw, seed, s: 0, on: true, kind, feat: baseFeatures(kind, seed) & ~(FEAT.CANE) };
            this.seats.set(key, st);
          }
          st.on = on;
        }
        // Tauben: an einem Teil der Bänke tagsüber, nicht bei Regen/Kälte
        const pk = bk;
        const want = occ > 0.15 && hashf((bk & 0xfffff) * 0.013 + 3.3) < 0.35;
        if (want && !this.birds.has(pk)) {
          const n = 2 + Math.floor(hashf(bk * 0.001 + 5) * 4);
          const arr = [];
          const fx = Math.sin(yaw), fz = Math.cos(yaw);
          for (let q = 0; q < n; q++) {
            const a = Math.random() * 6.28, rr = 0.02 + Math.random() * 0.045;
            arr.push({ x: x + fx * 0.055 + Math.cos(a) * rr, y, z: z + fz * 0.055 + Math.sin(a) * rr, cx: x + fx * 0.055, cz: z + fz * 0.055, h: Math.random() * 6.28, ph: Math.random() * 6, peck: Math.random() < 0.5 ? 1 : 0, t: Math.random() * 3, s: 0 });
          }
          this.birds.set(pk, { list: arr, on: true, seen: true });
        } else if (this.birds.has(pk)) { const b = this.birds.get(pk); b.on = want; b.seen = true; }
      }
      for (const [key, st] of this.seats) if (!seen.has(key)) st.on = false;
      for (const b of this.birds.values()) { if (!b.seen) b.on = false; b.seen = false; }
    }
    for (const [key, st] of this.seats) {
      st.s = Math.max(0, Math.min(1, st.s + (st.on ? dt * 2 : -dt * 2)));
      if (!st.on && st.s <= 0) this.seats.delete(key);
    }
    for (const [key, b] of this.birds) {
      let alive = 0;
      for (const p of b.list) {
        p.s = Math.max(0, Math.min(1, p.s + (b.on ? dt * 1.5 : -dt * 3)));
        if (p.s > 0) alive++;
        p.t -= dt;
        if (p.t <= 0) { p.peck = p.peck ? 0 : 1; p.t = p.peck ? 1 + Math.random() * 3 : 0.6 + Math.random() * 1.6; if (!p.peck) p.h += (Math.random() - 0.5) * 2.2; }
        if (!p.peck) {
          // trippeln, zurück zur Mitte ziehen
          const sp = 0.03 * dt;
          p.x += Math.sin(p.h) * sp; p.z += Math.cos(p.h) * sp;
          const dx = p.cx - p.x, dz = p.cz - p.z;
          if (dx * dx + dz * dz > 0.0042) p.h = Math.atan2(dx, dz) + (Math.random() - 0.5) * 0.8;
          p.ph += dt * 9;
        } else p.ph += dt * 3.2;
      }
      if (!b.on && !alive) this.birds.delete(key);
    }
  }
  draw(ctx, peds) {
    this.pigeons.begin();
    const wf = ctx.wearFeat;
    for (const st of this.seats.values()) {
      if (st.s <= 0.01) continue;
      const ex = st.x - ctx.cam.x, ey = st.y - ctx.cam.y, ez = st.z - ctx.cam.z;
      const d2 = ex * ex + ey * ey + ez * ez;
      if (d2 > ctx.mid2) continue;
      ctx.sph.center.set(st.x, st.y + 0.08, st.z);
      if (!ctx.frustum.intersectsSphere(ctx.sph)) continue;
      const sc = (st.kind === 2 ? 0.66 : 0.97) * st.s, w = sc * (0.94 + st.seed * 0.15);
      const f = st.feat | wearFeatures(wf, st.kind, st.seed);
      _c.setHex((f & FEAT.COAT) ? COATS[Math.floor(st.seed * 7919) % COATS.length] : SHIRTS[Math.floor(st.seed * 7919) % SHIRTS.length]);
      (d2 < ctx.near2 ? peds.near : peds.mid).push(st.x, st.y, st.z, st.yaw, 0, 0, w, sc, w, _c.r, _c.g, _c.b, 0, 0, st.seed, MODE.SIT + 8 * f);
    }
    const lim = ctx.near2 * 1.3;
    _c.setHex(0xffffff);
    for (const b of this.birds.values()) for (const p of b.list) {
      if (p.s <= 0.01) continue;
      const ex = p.x - ctx.cam.x, ey = p.y - ctx.cam.y, ez = p.z - ctx.cam.z;
      if (ex * ex + ey * ey + ez * ez > lim) continue;
      const sc = p.s;
      this.pigeons.push(p.x, p.y, p.z, p.h, 0, 0, sc, sc, sc, 1, 1, 1, p.ph, p.peck, 0.5, MODE.BIRD_GROUND);
    }
    this.pigeons.finish();
  }
}

// ---------------------------------------------------------------- Bauarbeiter auf Baustellen (tagsüber, werktags)
// Zwei bis drei Leute vor dem Gerüst: einer hämmert, einer schaut zu, manchmal geht einer auf und ab.
class Workers {
  constructor(view) { this.v = view; this.g = view.g; this.e = view.e; this.list = []; this.timer = 0; }
  update(dt, ctx) {
    this.timer -= dt;
    for (const w of this.list) { w.t += dt; w.s = Math.max(0, Math.min(1, w.s + (w.on ? dt * 2 : -dt * 2))); }
    if (this.timer > 0) return;
    this.timer = 1.5;
    const B = this.e.buildings, g = this.g;
    const h = g.hour(), work = h >= 7 && h < 17.5 && g.weekday() < 5 && ctx.rain < 0.6;
    const seen = new Set();
    if (work && B && B.recs) {
      const R2 = Math.min(ctx.radius, 24) ** 2;
      for (const rec of B.recs.values()) {
        if (!rec.site || rec.dead || !rec.site.box) continue;
        const dx = rec.ox - ctx.cx, dz = rec.oz - ctx.cz;
        if (dx * dx + dz * dz > R2) continue;
        const [bx0, bx1, , bz1] = rec.site.box;
        const n = 2 + (rec.id % 2);
        for (let j = 0; j < n; j++) {
          const key = rec.id * 4 + j;
          seen.add(key);
          let w = this.list.find((q) => q.key === key);
          if (!w) {
            const sd = hashf(rec.id * 13.7 + j * 3.1);
            const lx = bx0 + (bx1 - bx0) * (0.2 + 0.6 * ((j + 0.5) / n)) + (sd - 0.5) * 0.05;
            const lz = bz1 + 0.06 + sd * 0.05;
            const yaw0 = rec.k * Math.PI / 2;
            const c = Math.cos(yaw0), s = Math.sin(yaw0);
            w = { key, seed: sd, x0: rec.ox + lx * c + lz * s, z0: rec.oz - lx * s + lz * c, ax: c, az: -s, span: (bx1 - bx0) * 0.3, yaw: yaw0 + Math.PI + (sd - 0.5) * 0.8, role: j === 0 ? 'work' : j === 2 ? 'walk' : 'stand', t: sd * 10, s: 0, on: true };
            this.list.push(w);
          }
          w.on = true;
        }
      }
    }
    for (const w of this.list) if (!seen.has(w.key)) w.on = false;
    this.list = this.list.filter((w) => w.on || w.s > 0);
  }
  draw(ctx, peds) {
    for (const w of this.list) {
      if (w.s <= 0.01) continue;
      let x = w.x0, z = w.z0, yaw = w.yaw, amt = 0, ph = 0, mode = MODE.WORK;
      if (w.role === 'stand') mode = MODE.WALK;
      else if (w.role === 'walk') {
        // auf und ab vor dem Gerüst, an den Enden kurz stehen
        const T = 9, u = (w.t % T) / T;
        const go = u < 0.4 ? u / 0.4 : u < 0.5 ? 1 : u < 0.9 ? 1 - (u - 0.5) / 0.4 : 0;
        const moving = (u < 0.4 || (u >= 0.5 && u < 0.9));
        x += w.ax * (go - 0.5) * w.span * 2; z += w.az * (go - 0.5) * w.span * 2;
        yaw = Math.atan2(w.ax, w.az) + (u >= 0.5 ? Math.PI : 0);
        amt = moving ? 1 : 0; ph = w.t * 7.2; mode = MODE.WALK;
      }
      const ex = x - ctx.cam.x, ey = -ctx.cam.y, ez = z - ctx.cam.z;
      const d2 = ex * ex + ey * ey + ez * ez;
      if (d2 > ctx.mid2) continue;
      ctx.sph.center.set(x, 0.09, z);
      if (!ctx.frustum.intersectsSphere(ctx.sph)) continue;
      _c.setHex(w.seed < 0.5 ? 0xf07a1a : 0xe6d21c);
      const sc = (0.95 + w.seed * 0.1) * w.s;
      peds.pick(d2, ctx).push(x, 0.002, z, yaw, 0, 0, sc * 1.04, sc, sc * 1.04, _c.r, _c.g, _c.b, ph, amt, w.seed, mode + 8 * FEAT.HELMET);
    }
  }
}

// ---------------------------------------------------------------- Vogelschwärme
class Birds {
  constructor(view) {
    this.v = view; this.g = view.g; this.e = view.e;
    this.flocks = [];
    this.batch = new Batch(this.e.scene, lifeGeometry('bird', 2).clone(), getPeopleMaterial(), { shadow: false, cap: 128 });
    this.timer = 0;
  }
  newFlock(ctx) {
    const sea = ctx.waterNear && Math.random() < 0.5;
    const n = sea ? 4 + Math.floor(Math.random() * 6) : 8 + Math.floor(Math.random() * 18);
    const a = Math.random() * Math.PI * 2;
    const r = Math.min(ctx.radius, 30) * (0.3 + Math.random() * 0.6);
    const f = {
      x: ctx.cx + Math.cos(a) * r, z: ctx.cz + Math.sin(a) * r, y: 1.6 + Math.random() * 2.6,
      vx: 0, vz: 0, tx: 0, tz: 0, sea, life: 25 + Math.random() * 40, speed: sea ? 0.9 : 1.3 + Math.random() * 0.6,
      birds: [],
    };
    this.retarget(f, ctx);
    for (let i = 0; i < n; i++) f.birds.push({ a: Math.random() * 6.28, r: 0.15 + Math.random() * (sea ? 1.2 : 0.7), h: (Math.random() - 0.5) * 0.4, w: 0.6 + Math.random() * 0.8, ph: Math.random() * 6.28, fr: 9 + Math.random() * 5, glide: Math.random() });
    this.flocks.push(f);
  }
  retarget(f, ctx) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * ctx.radius * 0.8;
    f.tx = ctx.cx + Math.cos(a) * r; f.tz = ctx.cz + Math.sin(a) * r;
  }
  update(dt, ctx) {
    const want = ctx.birdTarget;
    this.timer -= dt;
    if (this.flocks.length < want && this.timer <= 0) { this.newFlock(ctx); this.timer = this.flocks.length < 2 ? 0.4 : 2 + Math.random() * 4; }
    let w = 0;
    for (const f of this.flocks) {
      f.life -= dt;
      const dx = f.tx - f.x, dz = f.tz - f.z, d = Math.hypot(dx, dz);
      if (d < 2) this.retarget(f, ctx);
      const ax = (dx / (d || 1)) * f.speed - f.vx, az = (dz / (d || 1)) * f.speed - f.vz;
      f.vx += ax * Math.min(1, dt * 0.7); f.vz += az * Math.min(1, dt * 0.7);
      f.x += f.vx * dt; f.z += f.vz * dt;
      f.y += Math.sin(f.life * 0.3) * dt * 0.15;
      for (const b of f.birds) { b.a += dt * b.w * (f.sea ? 0.35 : 0.6); b.ph += dt * b.fr * (f.sea ? (b.glide > 0.5 ? 0.25 : 0.7) : 1); }
      const ddx = f.x - ctx.cx, ddz = f.z - ctx.cz;
      if (f.life > 0 && ddx * ddx + ddz * ddz < (Math.max(ctx.radius, 24) * 2.4) ** 2 && want > 0) this.flocks[w++] = f;
    }
    this.flocks.length = w;
  }
  draw(ctx) {
    this.batch.begin();
    for (const f of this.flocks) {
      const yaw = Math.atan2(f.vx, f.vz);
      const col = f.sea ? 0xf4f4f0 : 0x3a3d42;
      _c.setHex(col);
      const sc = f.sea ? 1.6 : 1;
      for (const b of f.birds) {
        const x = f.x + Math.cos(b.a) * b.r, z = f.z + Math.sin(b.a) * b.r * 0.7, y = f.y + b.h + Math.sin(b.a * 2) * 0.08;
        ctx.sph.center.set(x, y, z);
        if (!ctx.frustum.intersectsSphere(ctx.sph)) continue;
        const flap = f.sea ? (b.glide > 0.5 ? 0.25 : 0.8) : 1;
        this.batch.push(x, y, z, yaw + Math.sin(b.a) * 0.3, 0, Math.sin(b.a * 1.3) * 0.2, sc, sc, sc, _c.r, _c.g, _c.b, b.ph, flap, 0.5, MODE.BIRD_FLY);
      }
    }
    this.batch.finish();
  }
}

// ---------------------------------------------------------------- Boote (Freizeit)
class Boats {
  constructor(view) {
    this.v = view; this.g = view.g; this.e = view.e;
    this.list = [];
    this.dirty = true;
    this.timer = 0;
    this.wake = new Batch(this.e.scene, wakeGeometry(), wakeMaterial(), { shadow: false, receive: false, cap: 32, renderOrder: 2 });
  }
  rebuild() {
    const g = this.g, W = g.W, N = g.N;
    this.dirty = false;
    // Wasserflächen (zusammenhängend) mit genug Platz
    const comp = new Int32Array(N).fill(-1);
    const sizes = [];
    const open = new Uint8Array(N);
    const isW = (i) => g.world.terrain[i] === T.WATER;
    for (let i = 0; i < N; i++) {
      if (!isW(i)) continue;
      const x = i % W, y = (i / W) | 0;
      let ok = 1;
      for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= g.H || !isW(yy * W + xx)) { ok = 0; break; }
      }
      open[i] = ok;
    }
    for (let i = 0; i < N; i++) {
      if (!open[i] || comp[i] >= 0) continue;
      const id = sizes.length; let n = 0;
      const q = [i]; comp[i] = id;
      for (let h = 0; h < q.length; h++) {
        const j = q[h]; n++;
        const x = j % W, y = (j / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= g.H) continue;
          const k = yy * W + xx;
          if (open[k] && comp[k] < 0) { comp[k] = id; q.push(k); }
        }
      }
      sizes.push(n);
    }
    this.comp = comp; this.open = open; this.sizes = sizes;
    this.tiles = [];
    for (let i = 0; i < N; i++) if (open[i] && sizes[comp[i]] >= 12) this.tiles.push(i);
    this.list = this.list.filter((b) => this.open[b.tile]);
  }
  path(from, to, sail) {
    const g = this.g, W = g.W;
    const prev = new Map([[from, -1]]);
    const q = [from];
    for (let h = 0; h < q.length && q.length < 4000; h++) {
      const j = q[h];
      if (j === to) break;
      const x = j % W, y = (j / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= g.H) continue;
        const k = yy * W + xx;
        if (!this.open[k] || prev.has(k)) continue;
        if (sail && g.road[k]) continue;
        prev.set(k, j); q.push(k);
      }
    }
    if (!prev.has(to)) return null;
    const out = [];
    for (let j = to; j >= 0; j = prev.get(j)) out.push(j);
    return out.reverse();
  }
  spawn(ctx) {
    if (!this.tiles.length) return;
    // in Kameranähe
    let tile = -1;
    for (let tries = 0; tries < 30; tries++) {
      const t = this.tiles[Math.floor(Math.random() * this.tiles.length)];
      const x = (t % this.g.W) + 0.5 - this.g.W / 2, z = ((t / this.g.W) | 0) + 0.5 - this.g.H / 2;
      if ((x - ctx.cx) ** 2 + (z - ctx.cz) ** 2 < (ctx.radius * 1.2) ** 2) { tile = t; break; }
    }
    if (tile < 0) return;
    const u = Math.random();
    const kind = u < 0.45 ? 'sailboat' : u < 0.8 ? 'boat' : 'rowboat';
    const g = this.g, W = g.W;
    const b = { kind, tile, x: (tile % W) + 0.5 - g.W / 2, z: ((tile / W) | 0) + 0.5 - g.H / 2, yaw: Math.random() * 6.28, speed: kind === 'boat' ? 0.55 : kind === 'sailboat' ? 0.3 : 0.1, path: null, pi: 0, seed: Math.random(), color: [0x2f6db3, 0xb8302a, 0x1f3b63, 0x2f7a4f, 0xe8b52c, 0x22a866][Math.floor(Math.random() * 6)], life: 60 + Math.random() * 120, wait: 0 };
    this.list.push(b);
  }
  update(dt, ctx) {
    if (this.dirty) this.rebuild();
    this.timer -= dt;
    if (this.list.length < ctx.boatTarget && this.timer <= 0) { this.spawn(ctx); this.timer = 1.5 + Math.random() * 3; }
    const g = this.g, W = g.W;
    let w = 0;
    for (const b of this.list) {
      b.life -= dt;
      if (b.wait > 0) b.wait -= dt;
      else if (!b.path || b.pi >= b.path.length) {
        const c = this.comp[b.tile];
        let to = -1;
        for (let tries = 0; tries < 20; tries++) {
          const t = this.tiles[Math.floor(Math.random() * this.tiles.length)];
          if (this.comp[t] !== c) continue;
          const dx = (t % W) - (b.tile % W), dy = ((t / W) | 0) - ((b.tile / W) | 0);
          const d = Math.hypot(dx, dy);
          if (d > 3 && d < 18) { to = t; break; }
        }
        b.path = to >= 0 ? this.path(b.tile, to, b.kind === 'sailboat') : null;
        b.pi = 1;
        if (!b.path) b.wait = 2 + Math.random() * 4;
        if (b.kind === 'rowboat' && Math.random() < 0.4) b.wait = 6 + Math.random() * 10;
      } else {
        const t = b.path[b.pi];
        const tx = (t % W) + 0.5 - g.W / 2, tz = ((t / W) | 0) + 0.5 - g.H / 2;
        const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
        if (d < 0.35) { b.pi++; b.tile = t; }
        const want = Math.atan2(dx, dz);
        let da = want - b.yaw;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        b.yaw += Math.max(-1, Math.min(1, da)) * dt * 1.2;
        const sp = b.speed * (1 - Math.min(0.7, Math.abs(da) * 0.4));
        b.x += Math.sin(b.yaw) * sp * dt; b.z += Math.cos(b.yaw) * sp * dt;
        b.moving = sp;
      }
      if (b.wait > 0) b.moving = 0;
      const dx = b.x - ctx.cx, dz = b.z - ctx.cz;
      if ((b.life > 0 || (b.path && b.pi < b.path.length)) && dx * dx + dz * dz < (ctx.radius * 2) ** 2 && ctx.boatTarget > 0) this.list[w++] = b;
    }
    this.list.length = w;
  }
  draw(ctx, fleet, time) {
    this.wake.begin();
    for (const b of this.list) {
      const roll = Math.sin(time * 1.3 + b.seed * 9) * 0.04, pitch = Math.sin(time * 1.1 + b.seed * 5) * 0.025;
      const wl = this.e.terrain && this.e.terrain.waterLevel !== undefined ? this.e.terrain.waterLevel : -0.14;
      const y = wl + Math.sin(time * 1.7 + b.seed * 3) * 0.006;
      const d2 = fleet.add(b.kind, b.x, y, b.z, b.yaw, pitch, roll, b.color, b.seed, 0, 0, 1);
      if (d2 >= 0 && b.moving > 0.05) {
        const len = { boat: 0.27, sailboat: 0.34, rowboat: 0.2 }[b.kind];
        const sx = Math.sin(b.yaw), sz = Math.cos(b.yaw);
        const strength = Math.min(1, b.moving / 0.5);
        this.wake.push(b.x - sx * len, wl + 0.005, b.z - sz * len, b.yaw, 0, 0, b.kind === 'rowboat' ? 0.5 : 1, 1, 0.6 + strength, strength, 1, 1, 0, 0);
      }
      if (d2 >= 0 && ctx.night > 0.3) {
        ctx.glow.add(b.x + Math.cos(b.yaw) * 0.09, -0.08, b.z - Math.sin(b.yaw) * 0.09, 0.05, 1, 0.15, 0.1, 0.5 * ctx.night);
        ctx.glow.add(b.x - Math.cos(b.yaw) * 0.09, -0.08, b.z + Math.sin(b.yaw) * 0.09, 0.05, 0.15, 1, 0.35, 0.5 * ctx.night);
        if (b.kind === 'sailboat') ctx.glow.add(b.x, 0.84, b.z, 0.06, 1, 0.95, 0.85, 0.5 * ctx.night);
      }
    }
    this.wake.finish();
  }
}

function wakeGeometry() {
  const g = new THREE.BufferGeometry();
  const pos = [-0.05, 0, 0, 0.05, 0, 0, 0.32, 0, -0.9, -0.32, 0, -0.9];
  const uv = [0, 0, 1, 0, 1, 1, 0, 1];
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.userData.triangles = 2;
  return g;
}
function wakeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uNight: { value: 0 } },
    vertexShader: `
attribute vec4 aInst;
varying vec2 vUv;
varying float vS;
void main() {
  vUv = uv; vS = instanceColor.r;
  vec4 p = vec4(position, 1.0);
#ifdef USE_INSTANCING
  p = instanceMatrix * p;
#endif
  gl_Position = projectionMatrix * modelViewMatrix * p;
}`,
    fragmentShader: `
uniform float uTime;
uniform float uNight;
varying vec2 vUv;
varying float vS;
void main() {
  float across = abs(vUv.x - 0.5) * 2.0;
  float along = vUv.y;
  float edge = smoothstep(0.55, 0.95, across) * (1.0 - along);
  float core = smoothstep(0.35, 0.0, across) * (1.0 - along) * 0.6;
  float foam = 0.6 + 0.4 * sin(along * 40.0 - uTime * 6.0 + across * 8.0);
  float a = (edge + core) * foam * (1.0 - along) * vS * 0.75 * (1.0 - uNight * 0.6);
  if (a < 0.01) discard;
  gl_FragColor = vec4(vec3(0.95, 0.98, 1.0), a);
}`,
    transparent: true,
    depthWrite: false,
  });
}

// ---------------------------------------------------------------- Himmel: Flugzeuge mit Kondensstreifen, Heißluftballon
class Sky {
  constructor(view) {
    this.v = view; this.g = view.g; this.e = view.e;
    this.planes = [];
    this.timer = 3 + Math.random() * 6;
    this.maxTrails = 6;
    const geo = new THREE.BufferGeometry();
    this.tpos = new Float32Array(this.maxTrails * 4 * 3);
    this.tuv = new Float32Array(this.maxTrails * 4 * 2);
    this.talpha = new Float32Array(this.maxTrails * 4);
    const idx = [];
    for (let i = 0; i < this.maxTrails; i++) { const o = i * 4; idx.push(o, o + 1, o + 2, o, o + 2, o + 3); }
    geo.setAttribute('position', new THREE.BufferAttribute(this.tpos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('uv', new THREE.BufferAttribute(this.tuv, 2).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aA', new THREE.BufferAttribute(this.talpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(idx);
    this.trailGeo = geo;
    this.trailMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uDay: { value: 1 } }]),
      vertexShader: `
attribute float aA;
varying vec2 vUv;
varying float vA;
#include <fog_pars_vertex>
void main() {
  vUv = uv; vA = aA;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
      fragmentShader: `
uniform float uDay;
varying vec2 vUv;
varying float vA;
#include <fog_pars_fragment>
void main() {
  float along = vUv.y;
  float spread = mix(0.08, 0.32, along);
  float s1 = smoothstep(spread, 0.0, abs(vUv.x - mix(0.4, 0.3, along)));
  float s2 = smoothstep(spread, 0.0, abs(vUv.x - mix(0.6, 0.7, along)));
  float a = max(s1, s2) * smoothstep(0.0, 0.02, along) * pow(1.0 - along, 1.3) * vA * 0.8;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vec3(1.0) * mix(0.25, 1.0, uDay), a);
  #include <fog_fragment>
}`,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    this.trails = new THREE.Mesh(geo, this.trailMat);
    this.trails.frustumCulled = false;
    this.trails.renderOrder = 4;
    this.e.scene.add(this.trails);
    this.balloon = null;
    this.balloonDay = -1;
  }
  update(dt, ctx) {
    this.timer -= dt;
    if (this.timer <= 0 && this.planes.length < 3 && ctx.planes) {
      this.timer = 10 + Math.random() * 25;
      const a = Math.random() * Math.PI * 2;
      const R0 = 170;
      const yaw = a + Math.PI + (Math.random() - 0.5) * 0.8;
      this.planes.push({ x: ctx.cx + Math.cos(a) * R0, z: ctx.cz + Math.sin(a) * R0, y: 75 + Math.random() * 45, yaw: Math.atan2(Math.cos(yaw), Math.sin(yaw)), speed: 7 + Math.random() * 3, dist: 0, seed: Math.random(), color: [0x2f6db3, 0xb8302a, 0x1f3b63, 0xe8b52c, 0x22a866][Math.floor(Math.random() * 5)], trail: ctx.contrails });
    }
    let w = 0;
    for (const p of this.planes) {
      p.x += Math.sin(p.yaw) * p.speed * dt; p.z += Math.cos(p.yaw) * p.speed * dt;
      p.dist += p.speed * dt;
      if (p.dist < 420) this.planes[w++] = p;
    }
    this.planes.length = w;
    // Ballon: selten, bei ruhigem Wetter morgens oder abends
    const g = this.g, day = g.day(), h = g.hour();
    if (this.balloonDay !== day) {
      this.balloonDay = day;
      if (!this.balloon && hashf(day * 97 + (g.world.seed | 0)) < 0.28 && ctx.calm) {
        const morning = hashf(day * 31) < 0.6;
        this.balloonPlan = { start: morning ? 6.5 + hashf(day) * 2 : 17 + hashf(day) * 1.5, dur: 2.2 };
      } else this.balloonPlan = null;
    }
    const plan = this.balloonPlan;
    if (plan && !this.balloon && h >= plan.start && h < plan.start + 0.3) {
      const wd = (g.ext.weather && g.ext.weather.windDir) || 0.6;
      const a = wd + Math.PI + (Math.random() - 0.5);
      this.balloon = { x: ctx.cx + Math.cos(a) * 22, z: ctx.cz + Math.sin(a) * 22, y: 3, vx: Math.cos(wd) * 0.12, vz: Math.sin(wd) * 0.12, t: 0, v: Math.floor(Math.random() * 4), seed: Math.random() };
    }
    const b = this.balloon;
    if (b) {
      b.t += dt;
      b.x += b.vx * dt; b.z += b.vz * dt;
      b.y = Math.min(9, 3 + b.t * 0.15) + Math.sin(b.t * 0.2) * 0.4;
      if (!plan || h > plan.start + plan.dur || b.t > 400) b.y -= 0;
      if (b.t > 400 || (plan && h > plan.start + plan.dur + 0.5)) this.balloon = null;
    }
  }
  draw(ctx, fleet, time) {
    // Flugzeuge
    let nt = 0;
    const camPos = ctx.cam;
    for (const p of this.planes) {
      const d2 = fleet.add('plane', p.x, p.y, p.z, p.yaw, 0, 0, p.color, p.seed, 0, 0, 1);
      if (ctx.night > 0.2 && d2 >= 0) {
        const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw);
        const wing = (s) => [p.x + cy * 1.7 * s - sy * 0.55, p.y, p.z - sy * 1.7 * s - cy * 0.55];
        const L = wing(1), Rr = wing(-1);
        ctx.glow.add(L[0], L[1], L[2], 1.1, 1, 0.15, 0.1, 0.8 * ctx.night);
        ctx.glow.add(Rr[0], Rr[1], Rr[2], 1.1, 0.15, 1, 0.35, 0.8 * ctx.night);
        if ((time * 1.05 + p.seed) % 1 > 0.92) { ctx.glow.add(L[0], L[1], L[2], 2.2, 1, 1, 1, ctx.night); ctx.glow.add(Rr[0], Rr[1], Rr[2], 2.2, 1, 1, 1, ctx.night); }
      }
      if (p.trail && nt < this.maxTrails) {
        const len = Math.min(p.dist, 110);
        const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
        const hx = p.x - sy * 2.2, hz = p.z - cy * 2.2;
        const tx = hx - sy * len, tz = hz - cy * len;
        const w0 = 0.9, w1 = 4.5;
        const o = nt * 4;
        const P = this.tpos, U = this.tuv, A = this.talpha;
        const set = (j, x, y, z, u, v) => { P[(o + j) * 3] = x; P[(o + j) * 3 + 1] = y; P[(o + j) * 3 + 2] = z; U[(o + j) * 2] = u; U[(o + j) * 2 + 1] = v; A[o + j] = Math.min(1, (420 - p.dist) / 60); };
        const lv = len / 110;
        set(0, hx - cy * w0, p.y + 0.05, hz + sy * w0, 0, 0);
        set(1, hx + cy * w0, p.y + 0.05, hz - sy * w0, 1, 0);
        set(2, tx + cy * w1, p.y + 0.4, tz - sy * w1, 1, lv);
        set(3, tx - cy * w1, p.y + 0.4, tz + sy * w1, 0, lv);
        nt++;
      }
    }
    void camPos;
    this.trailGeo.setDrawRange(0, nt * 6);
    this.trails.visible = nt > 0;
    if (nt) { this.trailGeo.attributes.position.needsUpdate = true; this.trailGeo.attributes.uv.needsUpdate = true; this.trailGeo.attributes.aA.needsUpdate = true; }
    this.trailMat.uniforms.uDay.value = 1 - ctx.night;
    // Ballon
    const b = this.balloon;
    if (b) {
      fleet.add('balloon' + b.v, b.x, b.y, b.z, b.t * 0.02, 0, Math.sin(b.t * 0.5) * 0.02, 0xffffff, b.seed, 0, 0, 1);
      const flame = Math.max(0, Math.sin(time * 1.3 + b.seed * 9)) ** 6;
      if (flame > 0.1) ctx.glow.add(b.x, b.y + 0.42, b.z, 0.25 + flame * 0.25, 1, 0.6, 0.2, flame * (0.4 + ctx.night * 0.6));
    }
  }
}

// ---------------------------------------------------------------- Gewichtete Kandidaten (Straßenfelder in Kameranähe)
class Candidates {
  constructor() { this.tiles = new Int32Array(0); this.cum = new Float32Array(0); this.total = 0; this.n = 0; }
  build(tiles, weights, n) {
    if (this.tiles.length < n) { this.tiles = new Int32Array(n * 2); this.cum = new Float32Array(n * 2); }
    let s = 0;
    for (let i = 0; i < n; i++) { s += weights[i]; this.tiles[i] = tiles[i]; this.cum[i] = s; }
    this.total = s; this.n = n;
  }
  sample(u) {
    if (this.total <= 0 || !this.n) return -1;
    const r = u * this.total;
    let lo = 0, hi = this.n - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (this.cum[m] < r) lo = m + 1; else hi = m; }
    return this.tiles[lo];
  }
}

// ---------------------------------------------------------------- Ansicht
class LifeView {
  constructor(engine) {
    this.e = engine;
    this.g = engine.game;
    this.walk = new Walkways(this);
    this.peds = new Pedestrians(this);
    this.bikes = new Cyclists(this);
    this.sitters = new Sitters(this);
    this.workers = new Workers(this);
    this.birds = new Birds(this);
    this.boats = new Boats(this);
    this.sky = new Sky(this);
    this.fleet = new Fleet(engine, { near: 14, mid: 70 });
    this.glow = new GlowPoints(engine.scene, 1500);
    this.cand = new Candidates();
    this.candBike = new Candidates();
    this.tmpT = new Int32Array(4096); this.tmpW = new Float32Array(4096); this.tmpB = new Float32Array(4096);
    this.lastCand = { x: 1e9, z: 1e9, t: -1, r: 0 };
    this.weightsDirty = true;
    this.weightTimer = 0;
    this.time = 0;
    this.frustum = new THREE.Frustum(); this.pm = new THREE.Matrix4(); this.sph = new THREE.Sphere(new THREE.Vector3(), 0.2); this.cam = new THREE.Vector3();
    const g = this.g;
    this.unbind = [
      g.on('roadsChanged', () => { this.walk.dirty = true; this.weightsDirty = true; this.lastCand.t = -1; }),
      g.on('buildingAdded', () => { this.weightsDirty = true; }),
      g.on('buildingRemoved', () => { this.weightsDirty = true; }),
      g.on('zonesChanged', () => { this.weightsDirty = true; }),
    ];
    this.ctx = {};
  }

  // Gewichte je Straßenfeld: Bewohner, Kunden, Beschäftigte, Parks in der Nähe
  computeWeights() {
    const g = this.g, N = g.N, W = g.W;
    this.wRes = new Float32Array(N); this.wCom = new Float32Array(N); this.wJob = new Float32Array(N);
    const addTo = (i, f, v) => { if (i >= 0 && i < N && g.road[i] && g.road[i] !== R.HIGHWAY) f[i] += v; };
    for (const b of g.buildings.values()) {
      if (b.construct !== undefined && b.construct < 1) continue;
      let f = null, v = 0;
      if (b.zone === Z.RES) { f = this.wRes; v = (b.occ || 0) * 1.0; }
      else if (b.zone === Z.COM) { f = this.wCom; v = (b.cap || 0) * 1.6 + (b.occ || 0) * 0.5; }
      else if (b.zone === Z.OFF || b.zone === Z.IND) { f = this.wJob; v = (b.occ || 0) * (b.zone === Z.OFF ? 0.8 : 0.35); }
      else { f = this.wCom; v = 6; }
      if (b.abandoned) v *= 0.1;
      if (!v) continue;
      // auf die angrenzenden Straßenfelder verteilen
      const cells = [];
      for (let yy = b.y - 1; yy <= b.y + b.h; yy++) for (let xx = b.x - 1; xx <= b.x + b.w; xx++) {
        if (xx < 0 || yy < 0 || xx >= W || yy >= g.H) continue;
        const inside = xx >= b.x && xx < b.x + b.w && yy >= b.y && yy < b.y + b.h;
        const corner = (xx === b.x - 1 || xx === b.x + b.w) && (yy === b.y - 1 || yy === b.y + b.h);
        if (inside || corner) continue;
        const i = yy * W + xx;
        if (g.road[i] && g.road[i] !== R.HIGHWAY) cells.push(i);
      }
      if (!cells.length && b.access >= 0) cells.push(b.access);
      for (const i of cells) addTo(i, f, v / cells.length);
    }
    this.weightsDirty = false;
  }

  buildCandidates(cx, cz, r, h) {
    const g = this.g, W = g.W;
    const x0 = Math.max(0, Math.floor(cx + g.W / 2 - r)), x1 = Math.min(W - 1, Math.ceil(cx + g.W / 2 + r));
    const y0 = Math.max(0, Math.floor(cz + g.H / 2 - r)), y1 = Math.min(g.H - 1, Math.ceil(cz + g.H / 2 + r));
    const rc = resCurve(h), cc = comCurve(h), jc = jobCurve(h) * (g.weekday() >= 5 ? 0.35 : 1);
    let n = 0, total = 0;
    const r2 = r * r;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (!this.walk.off[i]) continue;
      const dx = x + 0.5 - g.W / 2 - cx, dz = y + 0.5 - g.H / 2 - cz;
      if (dx * dx + dz * dz > r2) continue;
      const w = this.wRes[i] * rc + this.wCom[i] * cc + this.wJob[i] * jc;
      if (n >= this.tmpT.length) break;
      this.tmpT[n] = i; this.tmpW[n] = w + 0.02; this.tmpB[n] = w + 0.4; n++;
      total += w;
    }
    this.cand.build(this.tmpT, this.tmpW, n);
    this.candBike.build(this.tmpT, this.tmpB, n);
    return total;
  }

  frame(dt, simDt, time, night) {
    const g = this.g, e = this.e;
    const mul = simDt > 0 ? Math.min(2, simDt / Math.max(dt, 1e-4)) : 0;
    const ldt = Math.min(0.1, dt) * mul;
    this.time += ldt;
    if (this.walk.dirty) this.walk.rebuild();
    this.weightTimer -= dt;
    if (this.weightsDirty || this.weightTimer <= 0 || !this.wRes) { this.computeWeights(); this.weightTimer = 4; }
    const cam = e.camera;
    cam.updateMatrixWorld();
    this.cam.setFromMatrixPosition(cam.matrixWorld);
    this.pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.pm);
    const rig = e.rig;
    const dist = rig.cur.dist;
    const cx = rig.target.x, cz = rig.target.z;
    const radius = Math.max(10, Math.min(46, dist * 1.05));
    const h = g.hour();
    const w = g.ext && g.ext.weather;
    const rain = w ? Math.max(w.rain || 0, (w.snow || 0) * 0.5) : 0;
    const cold = w && w.temp !== undefined ? w.temp < 2 : false;
    const lc = this.lastCand;
    let total = this.ctx.total || 0;
    if (Math.hypot(cx - lc.x, cz - lc.z) > 2.5 || Math.abs(radius - lc.r) > 3 || this.time - lc.t > 3 || lc.t < 0) {
      total = this.buildCandidates(cx, cz, radius, h);
      lc.x = cx; lc.z = cz; lc.r = radius; lc.t = this.time;
    }
    const q = QUAL[e.settings && e.settings.quality] ?? 1;
    // „Automatisch": Detailabstände folgen der laufenden Regelung (wie bei den Gebäuden)
    const eq = e.quality;
    const lodK = eq && eq.auto && Number.isFinite(eq.lod) ? Math.max(0.6, Math.min(1.25, eq.lod)) : 1;
    const vis = 1 - smooth(48, 85, dist);
    const weather = 1 - Math.min(0.7, rain * 0.6) - (cold ? 0.15 : 0);
    const ctx = this.ctx;
    Object.assign(ctx, {
      cx, cz, radius, total, rain, night, cold, wearFeat: wearOf(w, h), cand: this.cand, frustum: this.frustum, sph: this.sph, cam: this.cam, glow: this.glow,
      pedTarget: Math.min(this.peds.max, total * 0.22 * vis * weather * q),
      bikeTarget: Math.min(this.bikes.max, (total * 0.004 + 2) * vis * (g.policies && g.policies.has('bikes') ? 2.2 : 1) * (1 - rain) * (cold ? 0.3 : 1) * (night > 0.6 ? 0.25 : 1) * q),
      birdTarget: night > 0.5 || dist > 110 ? 0 : Math.round((2 + (w && w.season === 'winter' ? -1 : w && w.season === 'spring' ? 2 : 1)) * (1 - rain * 0.8)),
      boatTarget: (w && (w.snowCover || 0) > 0.5 && cold) || dist > 120 ? 0 : Math.round(Math.min(12, (this.boats.tiles ? this.boats.tiles.length : 0) / 25) * (night > 0.6 ? 0.25 : 1) * (1 - rain * 0.7) * (w && w.season === 'winter' ? 0.3 : w && w.season === 'summer' ? 1.3 : 1)),
      waterNear: this.boats.tiles && this.boats.tiles.length > 0,
      planes: true, contrails: !w || (w.cloud || 0) < 0.85,
      calm: !w || ((w.wind || 0) < 0.5 && (w.rain || 0) < 0.1 && (w.fog || 0) < 0.4),
      near2: (7.5 * Math.sqrt(q) * lodK) ** 2, midNear2: (15 * Math.sqrt(q) * lodK) ** 2, mid2: (Math.min(52, 30 + 12 * q)) ** 2,
      swY: e.roads && typeof e.roads.surfaceY === 'function' ? 0.014 : 0.012,
      yAt: (x, z) => (e.vehicles ? e.vehicles.roadY(x + g.W / 2, z + g.H / 2) : 0.012),
    });
    this.sph.radius = 0.15;
    if (g.ext && g.ext.weather === undefined) void 0;
    this.peds.update(ldt, ctx);
    this.bikes.update(ldt, ctx);
    this.sitters.update(ldt, ctx);
    this.workers.update(ldt, ctx);
    this.birds.update(ldt, ctx);
    this.boats.update(ldt, ctx);
    this.sky.update(ldt, ctx);
    // Zeichnen
    this.glow.begin();
    this.fleet.begin();
    setPeopleTime(this.time);
    this.peds.begin(); this.bikes.begin();
    this.peds.draw(ctx);
    this.bikes.draw(ctx, this.peds);
    this.sitters.draw(ctx, this.peds);
    this.workers.draw(ctx, this.peds);
    this.peds.finish(); this.bikes.finish();
    this.birds.draw(ctx);
    this.sph.radius = 1.2;
    this.boats.draw(ctx, this.fleet, this.time);
    this.sph.radius = 4;
    this.sky.draw(ctx, this.fleet, time);
    this.fleet.end();
    this.glow.end(e.renderer);
    this.boats.wake.mesh.material.uniforms.uTime.value = time;
    this.boats.wake.mesh.material.uniforms.uNight.value = night;
    void VU;
  }

  stats() {
    return { workers: this.workers.list.length, sitting: this.sitters.seats.size, peds: this.peds.live(), bikes: this.bikes.list.length, flocks: this.birds.flocks.length, boats: this.boats.list.length, planes: this.sky.planes.length, balloon: !!this.sky.balloon, fleet: this.fleet.stats() };
  }

  dispose() { for (const u of this.unbind) u(); }
}

registerView(LifeView);
