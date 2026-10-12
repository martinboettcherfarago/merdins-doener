// Prozedurale Kartenerzeugung: Gelände, Wasser, Berge, Wald, Rohstoffe, Autobahnanbindung.
import { T, RES } from '../config.js';
import { mulberry32, makeNoise, clamp, smoothstep } from '../util.js';

export function generateWorld(size, seed, type) {
  const W = size, H = size, N = W * H;
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const nA = makeNoise(seed), nB = makeNoise(seed + 101), nC = makeNoise(seed + 202), nD = makeNoise(seed + 303), nE = makeNoise(seed + 404);
  const terrain = new Uint8Array(N);
  const trees = new Uint8Array(N);
  const resource = new Uint8Array(N);
  const idx = (x, y) => y * W + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const s = 64 / size; // Merkmale sollen auf jeder Kartengröße ähnlich groß wirken
  const f = (n, x, y, sc, o = 4) => n.fbm((x * s) / sc, (y * s) / sc, o);

  const cx = W / 2, cy = H / 2;
  const highwayY = Math.floor(H / 2 + (rng() - 0.5) * H * 0.25);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      const e = f(nA, x, y, 14);
      const edge = Math.max(Math.abs(x - cx), Math.abs(y - cy)) / (W / 2);
      let t = T.GRASS;
      if (type === 'river') {
        const m = e * 0.78 + smoothstep(0.62, 1.0, edge) * 0.42;
        if (m > 0.74) t = T.ROCK;
        if (f(nB, x, y, 9) < 0.24 && edge < 0.85) t = T.WATER;
      } else if (type === 'coast') {
        const xc = W * 0.68 + (nB.fbm(y * s / 16, 1.7) - 0.5) * W * 0.32;
        if (x > xc) t = T.WATER;
        else {
          const m = e * 0.75 + smoothstep(0.55, 1, (xc - x) / W + Math.abs(y - cy) / H * 0.6) * 0.3;
          if (m > 0.76 && x < xc - 6) t = T.ROCK;
          if (f(nB, x + 50, y, 8) < 0.2 && x < xc - 5) t = T.WATER;
        }
      } else if (type === 'lakes') {
        if (f(nB, x, y, 9) < 0.34) t = T.WATER;
        else if (e > 0.72 + (1 - edge) * 0.08) t = T.ROCK;
      } else if (type === 'islands') {
        const dx = (x - cx) / (W / 2), dy = (y - cy) / (H / 2);
        const radial = 1 - Math.sqrt(dx * dx + dy * dy);
        const v = f(nB, x, y, 11) * 0.95 + radial * 0.45;
        if (v < 0.6) t = T.WATER;
        else if (e > 0.76) t = T.ROCK;
      } else if (type === 'mountains') {
        const m = f(nA, x, y, 11, 5);
        if (m > 0.56 - (1 - edge) * 0.06) t = T.ROCK;
        if (f(nB, x, y, 7) < 0.2) t = T.WATER;
      }
      terrain[i] = t;
    }
  }

  // Flüsse
  const carveRiver = (pts, width) => {
    for (const [px, py, w] of pts) {
      const r = Math.ceil(w + 1);
      for (let yy = Math.floor(py - r); yy <= py + r; yy++) {
        for (let xx = Math.floor(px - r); xx <= px + r; xx++) {
          if (!inb(xx, yy)) continue;
          const d = Math.hypot(xx + 0.5 - px, yy + 0.5 - py);
          if (d < w) terrain[idx(xx, yy)] = T.WATER;
        }
      }
    }
  };
  if (type === 'river' || type === 'mountains') {
    const pts = [];
    const phase = rng() * Math.PI * 2;
    const base = type === 'river' ? W * 0.58 : W * (0.35 + rng() * 0.3);
    for (let y = -2; y < H + 2; y += 0.5) {
      const px = base + Math.sin((y / H) * Math.PI * 2.2 + phase) * W * 0.11 + (nC.fbm(y * s / 14, 3.3) - 0.5) * W * 0.22;
      const w = (type === 'river' ? 1.5 : 1.0) + nD.fbm(y * s / 10, 7.1) * 1.6;
      pts.push([px, y, w]);
    }
    carveRiver(pts);
    // Felsen am Flussufer abtragen, damit Täler entstehen
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (terrain[idx(x, y)] !== T.ROCK) continue;
      let near = false;
      for (let d = 1; d <= 3 && !near; d++) {
        for (const [ox, oy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) {
          if (inb(x + ox, y + oy) && terrain[idx(x + ox, y + oy)] === T.WATER) { near = true; break; }
        }
      }
      if (near) terrain[idx(x, y)] = T.GRASS;
    }
  }
  if (type === 'coast') {
    // kleiner Fluss, der ins Meer mündet
    const pts = [];
    let py = H * (0.2 + rng() * 0.2);
    for (let x = W * 0.2; x < W; x += 0.5) {
      py += (nC.noise(x * 0.1, 9.1) - 0.5) * 1.2;
      pts.push([x, py, 1.1]);
    }
    carveRiver(pts);
  }
  if (type === 'mountains') {
    // Täler von der Autobahn aus in die Karte schlagen
    const valleys = 3;
    for (let v = 0; v < valleys; v++) {
      let px = 2, py = highwayY + 0.5;
      let ang = (rng() - 0.5) * 1.6;
      for (let step = 0; step < W * 1.4; step++) {
        ang += (rng() - 0.5) * 0.35;
        ang = clamp(ang, -1.3, 1.3);
        px += Math.cos(ang) * 0.9;
        py += Math.sin(ang) * 0.9;
        if (!inb(Math.floor(px), Math.floor(py))) break;
        const r = 4 + nD.noise(step * 0.05, v * 3) * 3;
        for (let yy = Math.floor(py - r); yy <= py + r; yy++) for (let xx = Math.floor(px - r); xx <= px + r; xx++) {
          if (!inb(xx, yy)) continue;
          if (Math.hypot(xx - px, yy - py) < r && terrain[idx(xx, yy)] === T.ROCK) terrain[idx(xx, yy)] = T.GRASS;
        }
      }
    }
  }

  // Startgebiet an der Autobahn freiräumen
  const HL = 6;
  for (let y = highwayY - 7; y <= highwayY + 7; y++) {
    for (let x = 0; x < HL + 12; x++) {
      if (!inb(x, y)) continue;
      const d = Math.hypot((x - HL) * 0.8, y - highwayY);
      if (x < HL + 1 && Math.abs(y - highwayY) <= 1) terrain[idx(x, y)] = T.GRASS;
      else if (d < 9) terrain[idx(x, y)] = T.GRASS;
    }
  }

  // Einzelne Felsen-/Wasserfelder glätten (Inselchen entfernen)
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      const t = terrain[i];
      let same = 0, cnt = 0;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!inb(x + ox, y + oy)) continue;
        cnt++;
        if (terrain[idx(x + ox, y + oy)] === t) same++;
      }
      if (same === 0 && cnt > 0 && t !== T.GRASS) terrain[i] = T.GRASS;
    }
  }

  // Strände
  const waterDist = new Uint8Array(N).fill(255);
  {
    const q = [];
    for (let i = 0; i < N; i++) if (terrain[i] === T.WATER) { waterDist[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      const d = waterDist[i];
      if (d >= 8) continue;
      const x = i % W, y = (i / W) | 0;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ox, ny = y + oy;
        if (!inb(nx, ny)) continue;
        const j = idx(nx, ny);
        if (waterDist[j] > d + 1) { waterDist[j] = d + 1; q.push(j); }
      }
    }
  }
  const beachWidth = type === 'coast' || type === 'islands' ? 2 : 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y);
    if (terrain[i] !== T.GRASS) continue;
    if (waterDist[i] <= beachWidth && (beachWidth > 1 || nE.noise(x * 0.4, y * 0.4) > 0.45)) terrain[i] = T.SAND;
  }

  // Wald
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y);
    if (terrain[i] !== T.GRASS) continue;
    const fv = f(nC, x, y, 7);
    const dStart = Math.hypot(x - HL, y - highwayY);
    const thr = 0.55 + (dStart < 12 ? 0.12 : 0);
    if (fv > thr) trees[i] = clamp(1 + Math.floor((fv - thr) / 0.05), 1, 3);
    else if (nE.noise(x * 0.9, y * 0.9) > 0.93 && dStart > 6) trees[i] = 1;
  }

  // Rohstoffe: fruchtbarer Boden und Erz
  const rockDist = new Uint8Array(N).fill(255);
  {
    const q = [];
    for (let i = 0; i < N; i++) if (terrain[i] === T.ROCK) { rockDist[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      const d = rockDist[i];
      if (d >= 10) continue;
      const x = i % W, y = (i / W) | 0;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ox, ny = y + oy;
        if (!inb(nx, ny)) continue;
        const j = idx(nx, ny);
        if (rockDist[j] > d + 1) { rockDist[j] = d + 1; q.push(j); }
      }
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y);
    if (terrain[i] !== T.GRASS && terrain[i] !== T.SAND) continue;
    const fert = f(nD, x, y, 9);
    const ore = f(nE, x, y, 6);
    if (rockDist[i] <= 4 && ore > 0.52) resource[i] = RES.ORE;
    else if (fert > 0.63 && rockDist[i] > 3 && terrain[i] === T.GRASS) resource[i] = RES.FERTILE;
  }

  // Autobahn
  const highway = [];
  for (let x = 0; x < HL; x++) {
    const i = idx(x, highwayY);
    terrain[i] = T.GRASS;
    trees[i] = 0;
    resource[i] = 0;
    highway.push(i);
  }

  // Tiefe für Berge
  const rockDepth = new Uint8Array(N);
  {
    const q = [];
    const dist = new Int16Array(N).fill(-1);
    for (let i = 0; i < N; i++) if (terrain[i] !== T.ROCK) { dist[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      const x = i % W, y = (i / W) | 0;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ox, ny = y + oy;
        if (!inb(nx, ny)) continue;
        const j = idx(nx, ny);
        if (dist[j] < 0) { dist[j] = dist[i] + 1; q.push(j); }
      }
    }
    for (let i = 0; i < N; i++) rockDepth[i] = Math.max(0, Math.min(255, dist[i] < 0 ? 12 : dist[i]));
  }

  // Eckpunkthöhen (W+1)×(H+1)
  const VW = W + 1;
  const vh = new Float32Array(VW * (H + 1));
  for (let vy = 0; vy <= H; vy++) {
    for (let vx = 0; vx <= W; vx++) {
      let land = 0, rock = 0, water = 0, depthSum = 0, wd = 0;
      for (const [ox, oy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
        const tx = clamp(vx + ox, 0, W - 1), ty = clamp(vy + oy, 0, H - 1);
        const i = idx(tx, ty);
        const t = terrain[i];
        if (t === T.ROCK) { rock++; depthSum += rockDepth[i]; }
        else if (t === T.WATER) { water++; wd += waterDist[i]; }
        else land++;
      }
      let h = 0;
      if (land > 0) h = rock > 0 ? 0.1 : 0;
      else if (rock > 0 && water === 0) {
        const d = depthSum / rock;
        h = 0.45 + d * 0.55 + nA.noise(vx * 0.35, vy * 0.35) * (0.6 + d * 0.35);
        h = Math.min(h, 7.5);
      } else if (water > 0 && rock === 0) {
        h = -0.85;
      } else h = 0.15;
      vh[vy * VW + vx] = h;
    }
  }
  // Wasserflächen: Tiefe nach Abstand zum Ufer
  {
    const shore = new Int16Array(N).fill(-1);
    const q = [];
    for (let i = 0; i < N; i++) if (terrain[i] !== T.WATER) { shore[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      const x = i % W, y = (i / W) | 0;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ox, ny = y + oy;
        if (!inb(nx, ny)) continue;
        const j = idx(nx, ny);
        if (shore[j] < 0) { shore[j] = shore[i] + 1; q.push(j); }
      }
    }
    for (let vy = 0; vy <= H; vy++) for (let vx = 0; vx <= W; vx++) {
      const k = vy * VW + vx;
      if (vh[k] !== -0.85) continue;
      let m = 99;
      for (const [ox, oy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
        const tx = clamp(vx + ox, 0, W - 1), ty = clamp(vy + oy, 0, H - 1);
        m = Math.min(m, shore[idx(tx, ty)]);
      }
      vh[k] = -0.35 - Math.min(m, 4) * 0.22;
    }
  }

  return { W, H, seed, type, terrain, trees, resource, vh, waterDist, highway, entry: highway[0], highwayEnd: highway[highway.length - 1], highwayY };
}
