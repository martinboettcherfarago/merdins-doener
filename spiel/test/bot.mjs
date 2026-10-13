// Spieler-Bot für Prüfstände (Besitzer Q2). Spielt wie ein vernünftiger Mensch:
// Straßenraster in 4×4-Blöcken, Zonen nach Nachfrage (Wohnen im Norden, Gewerbe an der Hauptstraße,
// Industrie im Süden, Büros zwischen den Wohnblöcken), Strom und Wasser mit Reserve, Abwasser, Müll,
// Dienste dort, wo die Abdeckung fehlt, Friedhof, Bildung, Parks, später Pulsbahn und Busse.
// Der Bot sieht nur, was ein Mensch auch sieht (Nachfrage, Bilanz, Abdeckung, Meldungen) und handelt einmal pro Spieltag.
import { R, Z, T, BUILDINGS, MILESTONES } from '../src/config.js';
import { computeCoverage, computeUtilities } from '../src/sim/services.js';
import * as TPS from '../src/sim/systems/transport.js';

const B = 5; // Straßen alle 5 Felder → Blöcke mit 4×4 Bauland

export class Bot {
  constructor(g, o = {}) {
    this.g = g;
    this.o = { transit: true, buses: true, ...o };
    this.W = g.W; this.H = g.H;
    this.hy = g.world.highwayY;
    this.x0 = (g.world.highwayEnd % g.W) + 1;
    this.blocks = new Map();
    this.log = [];
    this.count = {};
    this.unlockDay = {};
    this.rng = 12345;
    this.lastMs = g.milestone;
    this.loanTaken = 0;
    g.on('cards', (ids) => g.chooseCard(this.pickCard(ids)));
    g.on('event', () => g.resolveEvent(this.pickEvent()));
  }

  say(t) { this.log.push(`T${this.g.day()} ${t}`); }
  tally(k) { this.count[k] = (this.count[k] || 0) + 1; }
  rand() { this.rng = (this.rng * 1103515245 + 12345) & 0x7fffffff; return this.rng / 0x7fffffff; }
  // Verfügbares Geld. Dienste und Parks warten, solange der Bot auf die erste Pulsbahn-Linie spart (wie ein Mensch).
  free(kind = 'core') {
    const g = this.g;
    let res = (this.o.reserve ?? 1200) + g.stats.pop * 0.4;
    if (kind === 'svc' && this.savingForTransit()) res += 12000;
    return g.money - res;
  }
  savingForTransit() {
    const g = this.g;
    return this.o.transit && g.isUnlocked('transit') && !g.transit.lines.length && g.stats.pop > 900 && g.day() > (this.saveFrom ?? 0);
  }

  // Karten: Ein Mensch nimmt meist die erste brauchbare; Ereignisse: die erste Antwort (meist die „vernünftige").
  pickCard(ids) { return ids[0]; }
  pickEvent() { return 0; }

  // ------------------------------------------------------------ Raster
  rect(k, m) { const xa = this.x0 + B * k, ya = this.hy + B * m; return { xa, ya, xb: xa + B, yb: ya + B }; }
  inMap(x, y) { return x >= 1 && y >= 1 && x < this.W - 1 && y < this.H - 1; }
  perim(k, m) {
    const { xa, ya, xb, yb } = this.rect(k, m), t = [];
    for (let x = xa; x <= xb; x++) { t.push(ya * this.W + x, yb * this.W + x); }
    for (let y = ya + 1; y < yb; y++) { t.push(y * this.W + xa, y * this.W + xb); }
    return t;
  }
  interior(k, m) {
    const { xa, ya } = this.rect(k, m), t = [];
    for (let y = ya + 1; y < ya + B; y++) for (let x = xa + 1; x < xa + B; x++) t.push(y * this.W + x);
    return t;
  }
  blockOk(k, m) {
    const { xa, ya, xb, yb } = this.rect(k, m);
    if (!this.inMap(xa, ya) || !this.inMap(xb, yb)) return false;
    const g = this.g, ter = g.world.terrain;
    let water = 0;
    for (const i of this.perim(k, m)) {
      if (ter[i] === T.ROCK) return false;
      if (ter[i] === T.WATER) water++;
      if (g.bld[i] && !g.road[i]) return false;
    }
    if (water > 0) return false;
    let land = 0;
    for (const i of this.interior(k, m)) if (ter[i] !== T.WATER && ter[i] !== T.ROCK && !g.bld[i]) land++;
    return land >= 10;
  }
  sector(k, m) { return m <= -1 ? 'north' : m === 0 ? 'main' : 'south'; }
  zonesFor(k, m) {
    const s = this.sector(k, m);
    if (s === 'north') return [Z.RES, Z.OFF];
    if (s === 'main') return [Z.COM, Z.OFF];
    return [Z.IND];
  }
  frontier() {
    const out = [];
    const seen = new Set();
    const add = (k, m) => {
      const key = k + ',' + m;
      if (seen.has(key) || this.blocks.has(key) || k < 0) return;
      seen.add(key);
      if (this.blockOk(k, m)) out.push([k, m]);
    };
    if (!this.blocks.size) { add(0, -1); add(0, 0); }
    for (const b of this.blocks.values()) { add(b.k + 1, b.m); add(b.k - 1, b.m); add(b.k, b.m + 1); add(b.k, b.m - 1); }
    return out;
  }
  blockCost(k, m) {
    const g = this.g;
    let c = 0;
    for (const i of this.perim(k, m)) if (!g.road[i]) c += g.roadTileCost(i, R.STREET);
    return c + 16 * 2 * g.costMul;
  }
  buildBlock(k, m, z) {
    const g = this.g;
    const tiles = this.perim(k, m).filter((i) => !g.road[i]);
    if (tiles.length && !g.buildRoad(tiles, R.STREET).ok) return false;
    // Jeder zweite Block behält eine 2×2-Ecke für Dienste und Parks
    const reserve = (k + m) % 2 === 0 && z !== Z.IND;
    const { xa, ya } = this.rect(k, m);
    const cx = (k % 2 === 0) ? xa + 1 : xa + 3, cy = (m % 2 === 0) ? ya + 1 : ya + 3;
    const zt = this.interior(k, m).filter((i) => {
      if (!reserve) return true;
      const x = i % this.W, y = (i / this.W) | 0;
      return !(x >= cx && x <= cx + 1 && y >= cy && y <= cy + 1);
    });
    g.zoneTiles(zt, z);
    this.blocks.set(k + ',' + m, { k, m, zone: z, day: g.day() });
    this.tally('block' + z);
    return true;
  }
  freeZoneTiles(z) {
    const g = this.g;
    let n = 0;
    for (const i of g.zoneFree[z]) if (!g.bld[i] && !g.rubble[i] && g.access[i] >= 0) n++;
    return n;
  }
  expand() {
    const g = this.g;
    let built = 0;
    const zones = [Z.RES, Z.COM, Z.IND];
    if (g.isUnlocked('zone4')) zones.push(Z.OFF);
    const want = zones.map((z) => [z, g.demand[z], this.freeZoneTiles(z)])
      .filter(([z, d, f]) => d > 12 && f < (z === Z.RES ? 14 : 8))
      .sort((a, b) => b[1] - a[1]);
    for (const [z] of want) {
      if (built >= 2) break;
      const front = this.frontier();
      let cands = front.filter(([k, m]) => this.zonesFor(k, m).includes(z));
      // Kein Platz im Wunschsektor (Fluss, Fels): wie ein Mensch woanders hin, Industrie möglichst weit weg vom Wohnen
      if (!cands.length && z === Z.IND) cands = front.filter(([k, m]) => m >= 0 || m <= -3);
      if (!cands.length && z !== Z.IND) cands = front.filter(([k, m]) => m <= 0);
      if (!cands.length) cands = front;
      if (!cands.length) continue;
      // Nächster Block am Zentrum; Büros bevorzugt nahe der Hauptstraße
      cands.sort((a, b) => this.blockScore(a, z) - this.blockScore(b, z));
      const [k, m] = cands[0];
      if (this.free() < this.blockCost(k, m) + 300) continue;
      if (this.buildBlock(k, m, z)) built++;
    }
    return built;
  }
  blockScore([k, m], z) {
    let s = Math.abs(k) * 1.0 + Math.abs(m + 0.5) * 1.15;
    if (z === Z.OFF) s += Math.abs(m + 1) * 0.6;
    if (z === Z.IND) {
      s += m <= 0 ? 5 : 0;
      // Abstand zu Wohnblöcken
      for (const b of this.blocks.values()) if (b.zone === Z.RES && Math.abs(b.k - k) + Math.abs(b.m - m) <= 1) s += 4;
    }
    return s;
  }

  // ------------------------------------------------------------ Platzieren
  // Sucht in wachsendem Abstand um (tx, ty) einen gültigen Bauplatz. avoid: Abstand zu Wohnzonen halten.
  placeNear(key, tx, ty, maxR = 10, { avoid = 0, preferFree = true } = {}) {
    const g = this.g, W = this.W;
    if (!g.isUnlocked(key)) return null;
    const cost = g.buildingCost(key);
    const core = ['coal', 'gas', 'wind', 'watertower', 'pump', 'landfill', 'incinerator', 'station', 'bus_depot'].includes(key);
    if (this.free(core ? 'core' : 'svc') < cost) return null;
    const cands = [];
    for (let y = Math.max(1, ty - maxR); y <= Math.min(this.H - 2, ty + maxR); y++) {
      for (let x = Math.max(1, tx - maxR); x <= Math.min(W - 2, tx + maxR); x++) {
        const d = Math.hypot(x - tx, y - ty);
        if (d > maxR) continue;
        const i = y * W + x;
        let s = d;
        if (preferFree && g.zone[i]) s += 2.5;
        if (avoid) {
          let res = 0;
          for (let yy = y - avoid; yy <= y + avoid; yy++) for (let xx = x - avoid; xx <= x + avoid; xx++) {
            if (xx < 0 || yy < 0 || xx >= W || yy >= this.H) continue;
            const j = yy * W + xx;
            if (g.zone[j] === Z.RES || (g.bld[j] && g.buildings.get(g.bld[j])?.zone === Z.RES)) res++;
          }
          s += res * 1.5;
        }
        cands.push([s, x, y]);
      }
    }
    cands.sort((a, b) => a[0] - b[0]);
    for (const [, x, y] of cands.slice(0, 500)) {
      for (const rot of [0, 1]) {
        if (g.checkPlace(key, x, y, rot)) continue;
        const r = g.placeBuilding(key, x, y, rot);
        if (r.ok) { this.tally(key); this.say(`baut ${BUILDINGS[key].name} (${x},${y})`); return r.building || r.station || true; }
      }
    }
    return null;
  }
  center() {
    let sx = 0, sy = 0, n = 0;
    for (const b of this.g.buildings.values()) if (b.zone === Z.RES && !b.abandoned) { sx += b.x; sy += b.y; n++; }
    return n ? [Math.round(sx / n), Math.round(sy / n)] : [this.x0 + 3, this.hy - 3];
  }
  southEdge() {
    let my = this.hy + 6;
    for (const b of this.blocks.values()) if (b.m >= 1) my = Math.max(my, this.rect(b.k, b.m).yb);
    return my;
  }

  // ------------------------------------------------------------ Versorgung
  power() {
    const g = this.g;
    computeUtilities(g);
    const oc = g.outsideComp;
    const ps = g.util.pSup?.[oc] || 0, pd = g.util.pDem?.[oc] || 0;
    const need = pd * 1.2 + 40;
    if (ps >= need) return false;
    const deficit = need - ps;
    const [cx] = this.center();
    // Große Lücke und genug Geld: Kohlekraftwerk weit weg im Süden, sonst Windräder
    if (deficit > 160 && this.free() > g.buildingCost('coal') + 1500) {
      if (this.placeNear('coal', cx + 4, this.southEdge() + 3, 14, { avoid: 5 })) return true;
    }
    if (g.milestone >= 3 && deficit > 300 && this.free() > g.buildingCost('gas') + 3000) {
      if (this.placeNear('gas', cx, this.southEdge() + 3, 14, { avoid: 4 })) return true;
    }
    return !!this.placeNear('wind', this.x0 + 1, this.hy - 3, 16, { avoid: 1 });
  }
  water() {
    const g = this.g;
    computeUtilities(g);
    const oc = g.outsideComp;
    const ws = g.util.wSup?.[oc] || 0, wd = g.util.wDem?.[oc] || 0;
    if (ws >= wd * 1.2 + 30) return false;
    const [cx, cy] = this.center();
    // Pumpwerk am Ufer, wenn es nah genug ist (weit weg vom Abwasserauslass), sonst Wassertürme
    if (wd > 250 && this.free() > g.buildingCost('pump') + 1500 && !this.noPump) {
      if (this.shorePlace('pump', cx, cy, { maxDist: 22, awayFrom: ['sewage_outlet', 'sewage_plant'] })) return true;
      this.noPump = g.day() + 10;
    }
    if (this.noPump && g.day() > this.noPump) this.noPump = 0;
    return !!this.placeNear('watertower', this.x0 + 1, this.hy + 2, 18);
  }
  // Bauplatz am Ufer: alle Felder trocken und frei, Wasser angrenzend, Zufahrt über einen kurzen Straßenweg zum Netz.
  // awayFrom: Abstand zu diesen Gebäuden (Pumpwerk ↔ Auslass), wie es ein umsichtiger Mensch macht.
  shorePlace(key, cx, cy, { maxDist = 30, awayFrom = [], sep = 22 } = {}) {
    const g = this.g, W = this.W, H = this.H, ter = g.world.terrain;
    if (!g.isUnlocked(key) || this.free(key === 'pump' ? 'core' : 'svc') < g.buildingCost(key) + 400) return false;
    const avoid = this.o.naive ? [] : [...g.buildings.values()].filter((b) => awayFrom.includes(b.key));
    const [w0, h0] = BUILDINGS[key].size;
    const dry = (i) => ter[i] !== T.WATER && ter[i] !== T.ROCK && !g.bld[i] && !g.stationAt[i];
    const cands = [];
    for (let y = 2; y < H - 3; y++) for (let x = 2; x < W - 3; x++) {
      const d = Math.abs(x - cx) + Math.abs(y - cy);
      if (d > maxDist) continue;
      if (avoid.some((b) => Math.hypot(b.x - x, b.y - y) < sep)) continue;
      for (const rot of w0 === h0 ? [0] : [0, 1]) {
        const [w, h] = rot ? [h0, w0] : [w0, h0];
        let okk = true, wet = false;
        for (let yy = y; yy < y + h && okk; yy++) for (let xx = x; xx < x + w; xx++) { const i = yy * W + xx; if (!dry(i) || g.road[i]) { okk = false; break; } }
        if (!okk) continue;
        for (let yy = y - 1; yy <= y + h && !wet; yy++) for (let xx = x - 1; xx <= x + w; xx++) {
          const corner = (xx === x - 1 || xx === x + w) && (yy === y - 1 || yy === y + h);
          if (!corner && (xx < x || xx >= x + w || yy < y || yy >= y + h) && ter[yy * W + xx] === T.WATER) { wet = true; break; }
        }
        if (wet) cands.push([d + (g.zone[y * W + x] ? 3 : 0), x, y, rot, w, h]);
      }
    }
    cands.sort((a, b) => a[0] - b[0]);
    for (const [, x, y, rot, w, h] of cands.slice(0, 60)) {
      if (!g.checkPlace(key, x, y, rot)) { if (g.placeBuilding(key, x, y, rot).ok) return this.placed(key, x, y); continue; }
      // Kürzester Weg (Breitensuche über trockenes, freies Land) vom Grundstücksrand zum Straßennetz
      const prev = new Int32Array(g.N).fill(-2), q = [];
      for (let yy = y - 1; yy <= y + h; yy++) for (let xx = x - 1; xx <= x + w; xx++) {
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const corner = (xx === x - 1 || xx === x + w) && (yy === y - 1 || yy === y + h);
        if (corner || (xx >= x && xx < x + w && yy >= y && yy < y + h)) continue;
        const i = yy * W + xx;
        if (dry(i) && !g.road[i]) { prev[i] = -1; q.push(i); }
      }
      let hit = -1;
      for (let qi = 0; qi < q.length && hit < 0 && qi < 4000; qi++) {
        const i = q[qi], xx = i % W, yy = (i / W) | 0;
        for (const j of [i - 1, i + 1, i - W, i + W]) {
          const jx = j % W, jy = (j / W) | 0;
          if (j < 0 || j >= g.N || Math.abs(jx - xx) + Math.abs(jy - yy) !== 1) continue;
          if (jx >= x && jx < x + w && jy >= y && jy < y + h) continue;
          if (g.road[j] && g.road[j] !== R.HIGHWAY && g.roadComp[j] === g.outsideComp) { hit = i; break; }
          if (prev[j] !== -2 || !dry(j) || g.road[j]) continue;
          prev[j] = i; q.push(j);
        }
      }
      if (hit < 0) continue;
      const path = [];
      for (let i = hit; i >= 0; i = prev[i]) path.push(i);
      if (path.length > 30) continue;
      if (!g.buildRoad(path, R.STREET).ok) continue;
      if (g.placeBuilding(key, x, y, rot).ok) return this.placed(key, x, y);
    }
    return false;
  }
  placed(key, x, y) { this.tally(key); this.say(`baut ${BUILDINGS[key].name} am Ufer (${x},${y})`); return true; }
  sewage() {
    const g = this.g, C = g.ext.citizens;
    if (!C || !C.stats) return false;
    const S = C.stats;
    // Verschmutztes Trinkwasser: Kläranlage bauen und danach die Auslässe abreißen (die Ratgeberin empfiehlt es)
    if (S.contam > 0.08 && !this.o.naive) {
      if (!this.count.sewage_plant && g.isUnlocked('sewage_plant')) this.shorePlace('sewage_plant', ...this.center(), { maxDist: 40, awayFrom: ['pump'], sep: 14 });
    }
    if (this.count.sewage_plant && !this.o.naive) {
      const plants = [...g.buildings.values()].filter((b) => b.key === 'sewage_plant' && b.construct >= 1);
      const cap = plants.length * (BUILDINGS.sewage_plant.sewage || 1800);
      const outs = [...g.buildings.values()].filter((b) => b.key === 'sewage_outlet');
      if (outs.length && cap >= (S.sewageDemand || 0) * 1.1) { for (const b of outs) g.removeBuilding(b); this.say('reißt die Abwasserauslässe ab'); }
    }
    if (g.stats.pop < 220) return false;
    if ((S.sewageCap || 0) >= (S.sewageDemand || 0) * 1.15 + 40 && !(S.unsewered > 3)) return false;
    const [cx, cy] = this.center();
    if (g.isUnlocked('sewage_plant') && this.shorePlace('sewage_plant', cx, cy, { maxDist: 40, awayFrom: ['pump'], sep: 14 })) return true;
    return this.shorePlace('sewage_outlet', cx + 8, cy + 6, { maxDist: 40, awayFrom: ['pump'] });
  }

  // Dienst dort bauen, wo das Zonengebäude mit der schlechtesten Abdeckung steht.
  gap(type, key, thr, { zones = [Z.RES, Z.COM, Z.IND, Z.OFF], avoid = 0, r = 8, minPop = 0, max = 0 } = {}) {
    const g = this.g;
    if (g.stats.pop < minPop || !g.isUnlocked(key)) return false;
    if (this.free('svc') < g.buildingCost(key)) return false;
    if (max && (this.count[key] || 0) >= max) return false;
    const cov = g.cov[type];
    if (!cov) return false;
    let worst = null, wv = thr, n = 0;
    const [cx, cy] = this.center();
    for (const b of g.buildings.values()) {
      if (!b.zone || b.abandoned || b.construct < 1 || !zones.includes(b.zone)) continue;
      const v = cov[b.y * this.W + b.x];
      if (v >= thr) continue;
      n++;
      const s = v + Math.hypot(b.x - cx, b.y - cy) * 0.01;
      if (s < wv) { wv = s; worst = b; }
    }
    if (!worst || n < 3) return false;
    const ok = this.placeNear(key, worst.x, worst.y, r, { avoid });
    if (ok) computeCoverage(g);
    return !!ok;
  }
  garbage() {
    const g = this.g;
    if (g.stats.pop < 120) return false;
    // Überlastete Deponien entlasten
    for (const b of g.buildings.values()) {
      const d = BUILDINGS[b.key];
      if (b.zone || !d || d.cat !== 'garbage' || !(b.load > 0.95)) continue;
      const key = g.isUnlocked('incinerator') && this.free() > g.buildingCost('incinerator') + 4000 ? 'incinerator' : 'landfill';
      if (this.placeNear(key, b.x + 6, b.y + 3, 12, { avoid: 3 })) { computeCoverage(g); return true; }
    }
    return this.gap('garbage', 'landfill', 0.45, { avoid: 3, r: 9 });
  }
  services() {
    const g = this.g, pop = g.stats.pop;
    let n = 0;
    const lim = (per) => 1 + Math.floor(pop / per);
    if (this.gap('fire', 'fire', 0.3, { minPop: 200, max: lim(1500) })) n++;
    if (this.gap('police', 'police', 0.3, { minPop: 350, max: lim(1500) })) n++;
    if (this.gap('health', 'clinic', 0.3, { minPop: 300, zones: [Z.RES], max: lim(1200) })) n++;
    if (this.gap('edu', 'school', 0.3, { minPop: 300, zones: [Z.RES], max: lim(1500) })) n++;
    const C = g.ext.citizens?.stats;
    // Kita, wenn die Plätze knapp werden
    if (pop > 250 && g.isUnlocked('kindergarten')) {
      const kitas = this.count.kindergarten || 0;
      if (kitas < pop / 900 || (C && C.kitaFill > 0.95 && kitas < pop / 500)) { const [cx, cy] = this.center(); if (this.placeNear('kindergarten', cx, cy, 10)) n++; }
    }
    // Friedhof, sobald freigeschaltet (oder Verstorbene warten)
    if (g.isUnlocked('cemetery') && pop > 400) {
      const cem = this.count.cemetery || 0;
      if (cem === 0 || (C && (C.graveFill > 0.75 || C.maxDeadDays > 1 || C.bodies > 15) && cem < 1 + pop / 2500)) { const [cx, cy] = this.center(); if (this.placeNear('cemetery', cx, cy - 6, 12, { avoid: 1 })) n++; }
      if (cem) this.gap('deathcare', 'cemetery', 0.2, { zones: [Z.RES], r: 10, minPop: 1500 });
    }
    if (pop > 1800 && g.isUnlocked('hospital') && !this.count.hospital && this.free() > 20000) { const [cx, cy] = this.center(); if (this.placeNear('hospital', cx, cy, 12)) n++; }
    if (pop > 2000 && g.isUnlocked('highschool') && !this.count.highschool && this.free() > 15000) { const [cx, cy] = this.center(); if (this.placeNear('highschool', cx, cy, 12)) n++; }
    if (pop > 1200 && g.isUnlocked('library') && (this.count.library || 0) < pop / 2500 && this.free() > 6000) { const [cx, cy] = this.center(); if (this.placeNear('library', cx, cy, 10)) n++; }
    if (pop > 2500 && g.isUnlocked('elderly_care') && (this.count.elderly_care || 0) < pop / 4000 && this.free() > 12000) { const [cx, cy] = this.center(); if (this.placeNear('elderly_care', cx, cy, 12)) n++; }
    // Parks: einer je ~350 Einwohner, im Wohngebiet
    if (pop > 150 && (this.count.park || 0) + (this.count.playground || 0) < pop / 350 && this.free() > 2500) {
      const key = (this.count.park || 0) > (this.count.playground || 0) + 1 && g.isUnlocked('playground') ? 'playground' : 'park';
      if (this.gap('park', key, 0.25, { zones: [Z.RES], r: 6 })) n++;
    }
    if (pop > 1500 && g.isUnlocked('plaza') && (this.count.plaza || 0) < pop / 1500 && this.free() > 4000) if (this.gap('park', 'plaza', 0.4, { zones: [Z.COM], r: 6 })) n++;
    if (pop > 3000 && g.isUnlocked('citypark') && (this.count.citypark || 0) < pop / 3000 && this.free() > 8000) if (this.gap('park', 'citypark', 0.5, { zones: [Z.RES], r: 8 })) n++;
    if (pop > 1500 && g.isUnlocked('townhall') && !g.hasBuilt('townhall') && this.free() > 15000) { const [cx, cy] = this.center(); if (this.placeNear('townhall', cx, cy + 3, 10)) n++; }
    return n;
  }

  // ------------------------------------------------------------ ÖPNV
  stationOn(x, y) {
    const g = this.g;
    for (let d = 0; d < 4; d++) for (const [ox, oy] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]]) {
      const xx = x + ox, yy = y + oy;
      if (!this.inMap(xx, yy) || !g.road[yy * this.W + xx] || g.road[yy * this.W + xx] === R.HIGHWAY) continue;
      if (g.checkPlace('station', xx, yy)) continue;
      const r = g.placeBuilding('station', xx, yy);
      if (r.ok) return r.station;
    }
    return null;
  }
  transit() {
    const g = this.g;
    if (!this.o.transit || !g.isUnlocked('transit')) return false;
    const T = g.transit;
    // Wer zu lange spart, ohne dass es reicht, baut erst weiter Dienste (und versucht es später wieder)
    if (this.savingForTransit()) {
      this.saveStart ??= g.day();
      if (g.day() - this.saveStart > 8) { this.saveFrom = g.day() + 8; this.saveStart = null; }
    }
    // Erste Linie: Wohngebiet (Norden) – Hauptstraße – Arbeit (Süden), dazu Ost-West entlang der Hauptstraße
    if (!T.lines.length && g.stats.pop > 900 && this.free() > 12000) {
      let kmax = 0;
      for (const b of this.blocks.values()) kmax = Math.max(kmax, b.k);
      const xs = [1, Math.max(2, Math.round(kmax / 2)), Math.max(3, kmax)].map((k) => this.x0 + B * k + 3);
      const st = [];
      for (const x of xs) { const s = this.stationOn(x, this.hy); if (s) st.push(s); }
      if (st.length >= 2) {
        const r = g.createLine(st.map((s) => s.id), false);
        if (r.ok) { this.tally('line'); this.say(`Pulsbahn-Linie 1 (${st.length} Stationen)`); }
      }
      return true;
    }
    if (T.lines.length === 1 && T.linesMax > 1 && g.stats.pop > 1800 && this.free() > 9000) {
      const xm = this.x0 + B * 2 + 3;
      const b = [...T.stations.values()].sort((p, q) => Math.abs(p.x - xm) - Math.abs(q.x - xm))[0];
      const a = this.stationOn(b.x, this.hy - 2 * B), c = this.stationOn(b.x, this.hy + 2 * B);
      const ids = [...new Set([a, b, c].filter(Boolean).map((s) => s.id))];
      if (ids.length >= 2) { const r = g.createLine(ids, false); if (r.ok) { this.tally('line'); this.say('Pulsbahn-Linie 2 (Nord–Süd)'); } }
      return true;
    }
    // Überfüllte Stationen: Waggons, dann Züge
    for (const l of T.lines) {
      const sts = l.stops.map((id) => T.stations.get(id)).filter(Boolean);
      const crowded = sts.some((s) => s.waiting.length > 10 || s.penaltyUntil > g.time);
      if (!crowded || this.free() < 4000) continue;
      const r = g.addWagon(l.id);
      if (r.ok) { this.tally('wagon'); continue; }
      const r2 = g.addTrain(l.id);
      if (r2.ok) this.tally('train');
    }
    return false;
  }
  buses() {
    const g = this.g;
    if (!this.o.buses || !g.isUnlocked('bus_depot') || !g.ext.transport) return false;
    const TS = g.ext.transport;
    if (g.stats.pop < 1400) return false;
    if (!this.count.bus_depot) {
      if (this.free() < 14000) return false;
      const [cx] = this.center();
      return !!this.placeNear('bus_depot', cx, this.hy + 3, 12, { avoid: 1 });
    }
    if (TS.lines.length >= 2 || this.free() < 6000) return false;
    // Buslinie quer durch die Wohnblöcke, dann zur Arbeit
    const row = TS.lines.length === 0 ? this.hy - B : this.hy - 2 * B;
    const pts = [];
    let kmax = 0;
    for (const b of this.blocks.values()) kmax = Math.max(kmax, b.k);
    for (let k = 0; k <= kmax; k += 2) {
      const x = this.x0 + B * k + 3;
      const t = row * this.W + x;
      if (!TPS.canStop(g, t, 'bus')) pts.push(t);
    }
    const yS = this.hy + B + 3, xS = this.x0 + B * Math.max(1, Math.round(kmax / 2));
    if (!TPS.canStop(g, yS * this.W + xS, 'bus')) pts.push(yS * this.W + xS);
    if (pts.length < 3) return false;
    const r = TPS.createLine(g, 'bus', pts.slice(0, 8), false);
    if (r.ok) { this.tally('busline'); this.say(`Buslinie ${TS.lines.length} (${Math.min(8, pts.length)} Halte)`); }
    return r.ok;
  }

  // ------------------------------------------------------------ Geld
  finances() {
    const g = this.g;
    // Kredit, wenn die Kasse leer ist und die Bilanz nicht trägt (wie ein Mensch es täte)
    if (g.money < 1500 && (g.lastBudget?.net || 0) < 300 && g.isUnlocked('loans') && !g.loans.length && this.loanTaken < 2) {
      g.takeLoan(0); this.loanTaken++; this.say('nimmt einen Kredit auf');
    }
    // Kredit zurückzahlen, wenn viel Geld da ist
    if (g.loans.length && g.money > 70000) { g.repayLoan(0); this.say('tilgt einen Kredit'); }
  }
  upgradeRoads() {
    const g = this.g;
    if (!g.isUnlocked('avenue') || g.stats.trafficFlow > 0.82 || this.free() < 8000 || this.avenueDone) return false;
    let kmax = 0;
    for (const b of this.blocks.values()) kmax = Math.max(kmax, b.k);
    const tiles = [];
    for (let x = this.x0; x <= this.x0 + B * (kmax + 1); x++) tiles.push(this.hy * this.W + x);
    const r = g.buildRoad(tiles, R.AVENUE);
    if (r.ok) { this.avenueDone = true; this.say('baut die Hauptstraße zur Allee aus'); }
    return r.ok;
  }

  // ------------------------------------------------------------ Ein Spieltag
  start() {
    const g = this.g;
    // Anschluss an die Autobahn und die ersten Blöcke
    this.buildBlock(0, -1, Z.RES);
    this.buildBlock(0, 0, Z.COM);
    if (this.blockOk(1, -1)) this.buildBlock(1, -1, Z.RES);
    if (this.blockOk(0, 1)) this.buildBlock(0, 1, Z.IND); else if (this.blockOk(1, 1)) this.buildBlock(1, 1, Z.IND);
    this.power(); this.water();
  }
  daily() {
    const g = this.g;
    if (g.gameOver) return;
    if (g.milestone !== this.lastMs) {
      for (let m = this.lastMs + 1; m <= g.milestone; m++) this.unlockDay[MILESTONES[m].name] = g.day();
      this.lastMs = g.milestone;
    }
    this.finances();
    for (let k = 0; k < 3 && this.power(); k++);
    for (let k = 0; k < 4 && this.water(); k++);
    this.sewage();
    this.garbage();
    this.expand();
    this.services();
    this.transit();
    this.buses();
    this.upgradeRoads();
  }
}

// Spielt einen Tag in kleinen Schritten (wie bei 1×: 30 s = 1 Tag).
export function runDay(g) { for (let s = 0; s < 300; s++) g.update(0.1); }
