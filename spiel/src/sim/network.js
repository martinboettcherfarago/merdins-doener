// Straßennetz: Zusammenhangskomponenten, Straßenanbindung der Felder, Wegesuche (A*).
import { ROADS, R } from '../config.js';
import { MinHeap } from '../util.js';

// Reihenfolge der Suche nach einer Zufahrt (max. 2 Felder entfernt).
const ACCESS_OFFSETS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [2, 0], [-2, 0], [0, 2], [0, -2],
  [1, 1], [-1, 1], [1, -1], [-1, -1],
];

export function rebuildNetwork(g) {
  const { W, H, N, road } = g;
  const comp = g.roadComp;
  comp.fill(-1);
  let nComp = 0;
  const stack = [];
  for (let i = 0; i < N; i++) {
    if (!road[i] || comp[i] >= 0) continue;
    const c = nComp++;
    comp[i] = c;
    stack.push(i);
    while (stack.length) {
      const k = stack.pop();
      const x = k % W, y = (k / W) | 0;
      if (x > 0 && road[k - 1] && comp[k - 1] < 0) { comp[k - 1] = c; stack.push(k - 1); }
      if (x < W - 1 && road[k + 1] && comp[k + 1] < 0) { comp[k + 1] = c; stack.push(k + 1); }
      if (y > 0 && road[k - W] && comp[k - W] < 0) { comp[k - W] = c; stack.push(k - W); }
      if (y < H - 1 && road[k + W] && comp[k + W] < 0) { comp[k + W] = c; stack.push(k + W); }
    }
  }
  g.compCount = nComp;
  g.outsideComp = road[g.world.entry] ? comp[g.world.entry] : -1;

  // Zufahrt für jedes Feld
  const access = g.access;
  access.fill(-1);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (road[i]) continue;
      for (const [ox, oy] of ACCESS_OFFSETS) {
        const nx = x + ox, ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (road[j] && road[j] !== R.HIGHWAY) { access[i] = j; break; }
      }
    }
  }
  // Gebäude neu anbinden
  for (const b of g.buildings.values()) updateBuildingAccess(g, b);
  g.pathCache.clear();
  g.netVersion++;
}

export function updateBuildingAccess(g, b) {
  const { W, H, road } = g;
  if (b.zone && b.w * b.h === 1) {
    const i = b.y * W + b.x;
    b.access = g.access[i];
  } else if (b.key === 'station') {
    b.access = -1;
  } else {
    // Mehrfeldgebäude: Straße direkt angrenzend
    let best = -1;
    for (let yy = b.y - 1; yy <= b.y + b.h && best < 0; yy++) {
      for (let xx = b.x - 1; xx <= b.x + b.w; xx++) {
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const inside = xx >= b.x && xx < b.x + b.w && yy >= b.y && yy < b.y + b.h;
        const corner = (xx === b.x - 1 || xx === b.x + b.w) && (yy === b.y - 1 || yy === b.y + b.h);
        if (inside || corner) continue;
        const j = yy * W + xx;
        if (road[j] && road[j] !== R.HIGHWAY) { best = j; break; }
      }
    }
    if (best < 0 && b.zone) {
      // Zusammengelegte Grundstücke: Zufahrt über eines der Felder (max. 2 Felder entfernt)
      for (let yy = b.y; yy < b.y + b.h && best < 0; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) {
        const a = g.access[yy * W + xx];
        if (a >= 0) { best = a; break; }
      }
    }
    b.access = best;
  }
  b.comp = b.access >= 0 ? g.roadComp[b.access] : -1;
  b.connected = b.comp >= 0 && b.comp === g.outsideComp;
  // Ausrichtung zur Straße
  if (b.zone && b.access >= 0) {
    const ax = b.access % W, ay = (b.access / W) | 0;
    const dx = ax + 0.5 - (b.x + b.w / 2), dy = ay + 0.5 - (b.y + b.h / 2);
    if (Math.abs(dx) >= Math.abs(dy)) b.rot = dx > 0 ? 1 : 3;
    else b.rot = dy > 0 ? 0 : 2;
  }
}

// Kosten, um ein Straßenfeld zu durchfahren (in "Minuten").
export function tileCost(g, i) {
  const r = g.road[i];
  const def = ROADS[r];
  if (!def) return 99;
  const cong = g.congestion[i];
  const slow = cong > 0.75 ? 1 + (cong - 0.75) * 3 : 1;
  // g.tileDelay: zusätzliche Wartezeit (z. B. Ampeln), als Anteil der Fahrzeit
  return (2 / def.speed) * slow * (1 + (g.tileDelay ? g.tileDelay[i] : 0));
}

export class PathCache {
  constructor() { this.map = new Map(); }
  clear() { this.map.clear(); }
  get(a, b) { return this.map.get(a * 65536 + b); }
  set(a, b, p) {
    if (this.map.size > 5000) this.map.clear();
    this.map.set(a * 65536 + b, p);
  }
}

// A* auf dem Straßenraster. Liefert {path: Int32Array, cost} oder null.
export function findPath(g, from, to) {
  if (from < 0 || to < 0) return null;
  if (from === to) return { path: new Int32Array([from]), cost: 0 };
  const cached = g.pathCache.get(from, to);
  if (cached !== undefined) return cached;
  const { W, road, N } = g;
  if (g.roadComp[from] !== g.roadComp[to] || g.roadComp[from] < 0) { g.pathCache.set(from, to, null); return null; }
  const gScore = g._gScore || (g._gScore = new Float32Array(N));
  const came = g._came || (g._came = new Int32Array(N));
  const stamp = g._stamp || (g._stamp = new Uint32Array(N));
  g._stampId = (g._stampId || 0) + 1;
  const sid = g._stampId;
  const tx = to % W, ty = (to / W) | 0;
  const heap = new MinHeap();
  gScore[from] = 0; came[from] = -1; stamp[from] = sid;
  heap.push(from, 0);
  const hMul = 2 / 1.7;
  let found = false, iter = 0;
  while (heap.size) {
    const cur = heap.pop();
    if (cur === to) { found = true; break; }
    if (++iter > 40000) break;
    const cx = cur % W, cy = (cur / W) | 0;
    const gc = gScore[cur];
    for (let d = 0; d < 4; d++) {
      let nx = cx, ny = cy;
      if (d === 0) nx++; else if (d === 1) nx--; else if (d === 2) ny++; else ny--;
      if (nx < 0 || ny < 0 || nx >= W || ny >= g.H) continue;
      const n = ny * W + nx;
      if (!road[n]) continue;
      const ng = gc + tileCost(g, n);
      if (stamp[n] !== sid || ng < gScore[n]) {
        stamp[n] = sid; gScore[n] = ng; came[n] = cur;
        heap.push(n, ng + (Math.abs(nx - tx) + Math.abs(ny - ty)) * hMul);
      }
    }
  }
  if (!found) { g.pathCache.set(from, to, null); return null; }
  const rev = [];
  for (let c = to; c !== -1; c = came[c]) rev.push(c);
  rev.reverse();
  const res = { path: Int32Array.from(rev), cost: gScore[to] };
  g.pathCache.set(from, to, res);
  return res;
}

// Verbindungsmaske eines Straßenfelds (N=1, O=2, S=4, W=8).
export function roadMask(g, i) {
  const { W, H, road } = g;
  if (!road[i]) return 0;
  const x = i % W, y = (i / W) | 0;
  let m = 0;
  if (y > 0 && road[i - W]) m |= 1;
  if (x < W - 1 && road[i + 1]) m |= 2;
  if (y < H - 1 && road[i + W]) m |= 4;
  if (x > 0 && road[i - 1]) m |= 8;
  // Autobahn läuft aus der Karte heraus
  if (road[i] === R.HIGHWAY && x === 0) m |= 8;
  return m;
}
