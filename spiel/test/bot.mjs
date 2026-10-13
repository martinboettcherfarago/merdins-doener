// Spieler-Bot für Prüfstände (Besitzer Q2). Spielt wie ein vernünftiger Mensch:
// Straßenraster in 4×4-Blöcken, Zonen nach Nachfrage (Wohnen im Norden, Gewerbe an der Hauptstraße,
// Industrie im Süden, Büros zwischen den Wohnblöcken), Strom und Wasser mit Reserve, Abwasser, Müll,
// Dienste dort, wo die Abdeckung fehlt, Friedhof, Bildung, Parks, später Pulsbahn und Busse.
// Der Bot sieht nur, was ein Mensch auch sieht (Nachfrage, Bilanz, Abdeckung, Meldungen) und handelt einmal pro Spieltag.
import { R, Z, T, BUILDINGS, MILESTONES } from '../src/config.js';
import { computeCoverage, computeUtilities } from '../src/sim/services.js';
import * as TPS from '../src/sim/systems/transport.js';
import { EVENTS } from '../src/sim/progress.js';

const B = 5; // Straßen alle 5 Felder → Blöcke mit 4×4 Bauland
// Versorgung und Grunddienste: werden auch gebaut, während der Bot für etwas Größeres spart
const CORE = new Set(['coal', 'gas', 'wind', 'solar', 'watertower', 'pump', 'landfill', 'incinerator', 'station', 'bus_depot', 'cemetery', 'clinic', 'fire', 'police', 'school', 'kindergarten']);

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
    for (const b of g.buildings.values()) if (!b.zone) this.tally(b.key);
    g.on('cards', (ids) => g.chooseCard(this.pickCard(ids)));
    g.on('event', () => g.resolveEvent(this.pickEvent()));
  }

  banned(key) { return !!(this.o.banned && this.o.banned.includes(key)); }
  say(t) { this.log.push(`T${this.g.day()} ${t}`); }
  tally(k) { this.count[k] = (this.count[k] || 0) + 1; }
  rand() { this.rng = (this.rng * 1103515245 + 12345) & 0x7fffffff; return this.rng / 0x7fffffff; }
  // Verfügbares Geld. Dienste und Parks warten, solange der Bot auf die erste Pulsbahn-Linie spart (wie ein Mensch).
  free(kind = 'core') {
    const g = this.g;
    let res = (this.o.reserve ?? 1200) + g.stats.pop * 0.4;
    // Geldziel im Szenario: ab dem ersten Drittel wird gespart (Ausbau läuft nur noch aus dem Überschuss)
    const mg = this.goal('money');
    if (mg && !mg.done && kind !== 'core' && this.o.status(g).elapsed > (this.o.status(g).sc.days || 60) * 0.35) res = Math.max(res, mg.goal.target * 0.9);
    // Schuldenziel: für die Tilgung des kleinsten Kredits zurücklegen (Ausbau nur aus dem Überschuss)
    if (this.goal('loans') && g.loans.length) res = Math.max(res, kind === 'core' ? 3000 : Math.min(...g.loans.map((l) => (l.amount / l.weeks) * l.weeksLeft)) + 3000);
    // Fahrgastziel: Geld für Züge und Waggons zurückhalten
    const rg = this.goal('riders');
    if (rg && !rg.done && kind === 'svc') res += 8000;
    if (kind === 'svc' && this.savingForTransit()) res += 12000;
    return g.money - res;
  }
  savingForTransit() {
    const g = this.g;
    return this.o.transit && g.isUnlocked('transit') && !g.transit.lines.length && g.stats.pop > 900 && g.day() > (this.saveFrom ?? 0);
  }

  // Karten: Ein Mensch nimmt meist die erste brauchbare; Ereignisse: die erste Antwort (meist die „vernünftige").
  pickCard(ids) { return ids[Math.min(ids.length - 1, this.o.cardPick || 0)]; }
  // Wer sparen muss (Schulden- oder Geldziel), liest den Hinweis und lehnt Angebote ab, die später Geld zurückfordern.
  pickEvent() {
    const g = this.g, ev = EVENTS.find((e) => e.id === g.pendingEvent);
    if (!ev || !(this.goal('loans') || this.goal('money'))) return 0;
    const hint = (o) => { try { return String(o.hint ? o.hint(g) : ''); } catch (e) { return ''; } };
    const k = ev.options.findIndex((o) => !/zurück/.test(hint(o)));
    return k >= 0 ? k : 0;
  }

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
  // Mögliche neue Blöcke: frei, bebaubar und am Straßennetz (auch an einer vorhandenen Startstadt)
  frontier() {
    const g = this.g, out = [];
    const endT = g.world.highwayEnd;
    for (let m = -9; m <= 9; m++) for (let k = 0; k <= 17; k++) {
      if (this.blocks.has(k + ',' + m) || !this.blockOk(k, m)) continue;
      const touch = this.perim(k, m).some((i) => (g.road[i] && g.road[i] !== R.HIGHWAY && g.roadComp[i] === g.outsideComp) || i === endT + 1);
      if (touch) out.push([k, m]);
    }
    return out;
  }
  blockCost(k, m) {
    const g = this.g;
    let c = 0;
    for (const i of this.perim(k, m)) if (!g.road[i]) c += g.roadTileCost(i, R.STREET);
    return c + 16 * 2 * g.costMul;
  }
  buildBlock(k, m, z, maxTiles = 16) {
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
    g.zoneTiles(zt.slice(0, maxTiles), z);
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
    let zones = [Z.RES, Z.COM, Z.IND];
    if (g.isUnlocked('zone4')) zones.push(Z.OFF);
    if (this.noExpand()) return 0;
    const pmax = this.goal('popmax'), ind = this.goal('jobs3');
    if (pmax && g.stats.pop > pmax.goal.target * 0.55) zones = zones.filter((z) => z !== Z.RES);
    // Einwohnerziel klar übertroffen, aber Glück/Bildung/Pendelzeit fehlen noch: nicht weiter wachsen, sondern verbessern
    const st = this.o.status && this.o.status(g), pg = this.goal('pop');
    if (st && pg && pg.done && g.stats.pop > pg.goal.target * 1.3 && st.goals.some((x) => !x.done && ['happy', 'edu', 'commute', 'water', 'pollution'].includes(x.goal.id))) zones = zones.filter((z) => z !== Z.RES);
    if (ind && ind.goal.cmp === '<=' && (g.stats.plannedByZone[Z.IND] || 0) > ind.goal.target * 0.4) zones = zones.filter((z) => z !== Z.IND);
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
    if (!g.isUnlocked(key) || this.banned(key)) return null;
    const cost = g.buildingCost(key);
    const core = CORE.has(key);
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
    let ps = g.util.pSup?.[oc] || 0;
    const pd = g.util.pDem?.[oc] || 0;
    for (const b of g.buildings.values()) if (!b.zone && b.construct < 1 && b.comp === oc) ps += BUILDINGS[b.key].power || 0;
    const need = pd * 1.2 + 40;
    if (ps >= need) return false;
    const deficit = need - ps;
    const [cx] = this.center();
    // Große Lücke und genug Geld: Kohlekraftwerk weit weg im Süden, sonst Windräder
    if (deficit > 160 && this.free() > g.buildingCost('coal') + 1500) {
      if (this.placeNear('coal', cx + 4, this.southEdge() + 3, 14, { avoid: 5 })) return true;
    }
    if (this.banned('coal') && g.isUnlocked('solar') && deficit > 200 && this.free() > g.buildingCost('solar') + 1500) {
      if (this.placeNear('solar', cx, this.southEdge() + 3, 14)) return true;
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
    let ws = g.util.wSup?.[oc] || 0;
    const wd = g.util.wDem?.[oc] || 0;
    for (const b of g.buildings.values()) if (!b.zone && b.construct < 1 && b.comp === oc) ws += BUILDINGS[b.key].water || 0;
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
    if (!g.isUnlocked(key) || this.banned(key) || this.free(key === 'pump' ? 'core' : 'svc') < g.buildingCost(key) + 400) return false;
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
    if (this.free(CORE.has(key) ? 'core' : 'svc') < g.buildingCost(key)) return false;
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
    // Fernwärme, sobald Wohnungen frieren (Ratgeber: „Kalte Wohnung")
    if (C && C.cold > 4 && g.isUnlocked('district_heating') && (this.count.district_heating || 0) < 1 + pop / 8000 && this.free('svc') > 16000) { const [cx] = this.center(); if (this.placeNear('district_heating', cx, this.southEdge() + 3, 14, { avoid: 3 })) n++; }
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
  // Straßenfelder, auf denen eine Station stehen kann, mit Einwohnern und Arbeitsplätzen im Einzugsbereich
  stationSites() {
    const g = this.g, W = this.W, out = [];
    const blds = [...g.buildings.values()].filter((b) => b.zone && !b.abandoned && b.occ > 0);
    for (let i = 0; i < g.N; i += 1) {
      if (!g.road[i] || g.road[i] === R.HIGHWAY) continue;
      const x = i % W, y = (i / W) | 0;
      if ((x + y) % 2) continue;
      if (g.checkPlace('station', x, y)) continue;
      let res = 0, jobs = 0;
      for (const b of blds) { if (Math.abs(b.x - x) > 4 || Math.abs(b.y - y) > 4 || Math.hypot(b.x - x, b.y - y) > 4.5) continue; if (b.zone === Z.RES) res += b.occ; else jobs += b.occ; }
      if (res + jobs > 0) out.push({ x, y, res, jobs });
    }
    return out;
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
    // Linien wie ein Mensch: vom dichtesten Wohngebiet über die Mitte zum größten Arbeitsplatzgebiet
    const rg = this.goal('riders');
    const maxLines = rg ? T.linesMax : Math.min(T.linesMax, g.stats.pop > 4000 ? 3 : 2);
    const needPop = T.lines.length === 0 ? 900 : 1800 * T.lines.length;
    if (T.lines.length < maxLines && (g.stats.pop > needPop || rg) && this.free('transit') > (T.lines.length ? 9000 : 12000)) {
      const sites = this.stationSites();
      const taken = [...T.stations.values()];
      const far = (t, list, d) => list.every((s) => Math.hypot(s.x - t.x, s.y - t.y) >= d);
      const A = sites.filter((t) => far(t, taken, 7)).sort((a, b) => b.res - a.res)[0];
      const C = A && sites.filter((t) => far(t, taken, 7) && Math.hypot(t.x - A.x, t.y - A.y) >= 9).sort((a, b) => b.jobs - a.jobs)[0];
      if (A && C && A.res > 60 && C.jobs > 60) {
        const mx = (A.x + C.x) / 2, my = (A.y + C.y) / 2;
        // Umsteigen an einer vorhandenen Station, sonst eine neue in der Mitte
        let mid = taken.length ? taken.sort((p, q) => Math.hypot(p.x - mx, p.y - my) - Math.hypot(q.x - mx, q.y - my))[0] : null;
        if (mid && Math.hypot(mid.x - mx, mid.y - my) > Math.hypot(A.x - C.x, A.y - C.y) * 0.45) mid = null;
        const st = [];
        const put = (t) => { const r = g.placeBuilding('station', t.x, t.y); return r.ok ? r.station : null; };
        const a = put(A);
        if (!mid) { const M = sites.filter((t) => far(t, [A, C], 5)).sort((p, q) => Math.hypot(p.x - mx, p.y - my) - Math.hypot(q.x - mx, q.y - my))[0]; mid = M ? put(M) : null; }
        const c = put(C);
        for (const x of [a, mid, c]) if (x && !st.includes(x)) st.push(x);
        if (st.length >= 2) {
          const r = g.createLine(st.map((x) => x.id), false);
          if (r.ok) { this.tally('line'); this.say(`Pulsbahn-Linie ${T.lines.length} (${st.length} Stationen)`); }
        }
      }
      return true;
    }
    // Überfüllte Stationen: Waggons, dann Züge
    for (const l of T.lines) {
      const sts = l.stops.map((id) => T.stations.get(id)).filter(Boolean);
      const crowded = sts.some((s) => s.waiting.length > 10 || s.penaltyUntil > g.time) || (rg && !rg.done);
      if (!crowded || this.free('transit') < 4000) continue;
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
    const cm = this.goal('commute');
    if (g.stats.pop < (cm ? 300 : 1400)) return false;
    if (!this.count.bus_depot) {
      if (this.free() < 9000) return false;
      const [cx, cy] = this.center();
      return !!this.placeNear('bus_depot', cx, cy + 4, 12, { avoid: 1 });
    }
    // Volle Linien verdichten (mehr Busse), dann neue Linien
    for (const l of TS.lines) if (l.load > 0.75 && l.nveh < 6 && this.free() > 3000) TPS.setVehicles(g, l.id, l.nveh + 1);
    const maxL = cm ? 5 : g.stats.pop > 5000 ? 3 : 2;
    if (TS.lines.length >= maxL || this.free() < 5000 || g.day() % 2) return false;
    // Haltestellen wie ein Mensch: durch das dichteste Wohngebiet ohne Bus zu den meisten Arbeitsplätzen
    const W = this.W, cov = TS.covField;
    const blds = [...g.buildings.values()].filter((b) => b.zone && !b.abandoned && b.occ > 0);
    const cands = [];
    for (let i = 0; i < g.N; i += 1) {
      if (!g.road[i] || g.road[i] === R.HIGHWAY || TPS.canStop(g, i, 'bus')) continue;
      const x = i % W, y = (i / W) | 0;
      let res = 0, jobs = 0;
      for (const b of blds) { if (Math.abs(b.x - x) > 3 || Math.abs(b.y - y) > 3) continue; if (b.zone === Z.RES) res += b.occ; else jobs += b.occ; }
      const served = cov ? cov[i] : 0;
      cands.push({ i, x, y, res: res * (1 - 0.8 * served), jobs });
    }
    const pick = (key, n, list) => {
      const out = [];
      for (const c of [...cands].sort((a, b) => b[key] - a[key])) {
        if (out.length >= n) break;
        if (c[key] <= 20) break;
        if ([...out, ...list].some((o) => Math.hypot(o.x - c.x, o.y - c.y) < 5)) continue;
        out.push(c);
      }
      return out;
    };
    const rs = pick('res', 3, []), js = pick('jobs', 2, rs);
    if (rs.length < 2 || !js.length) return false;
    // Reihenfolge: nächster Nachbar ab der Wohnhaltestelle, die am weitesten von der Arbeit liegt
    const all = [...rs, ...js];
    const jc = js[0];
    all.sort((a, b) => Math.hypot(b.x - jc.x, b.y - jc.y) - Math.hypot(a.x - jc.x, a.y - jc.y));
    const seq = [all.shift()];
    while (all.length) { const l = seq[seq.length - 1]; all.sort((a, b) => Math.hypot(a.x - l.x, a.y - l.y) - Math.hypot(b.x - l.x, b.y - l.y)); seq.push(all.shift()); }
    const r = TPS.createLine(g, 'bus', seq.map((c) => c.i), false);
    if (r.ok) { this.tally('busline'); TPS.setVehicles(g, r.line.id, 2); this.say(`Buslinie ${TS.lines.length} (${seq.length} Halte)`); }
    return r.ok;
  }

  // ------------------------------------------------------------ Geld
  // Szenario-Ziele lesen (was ein Mensch in der Zieltafel sieht)
  goal(id) {
    const st = this.o.status && this.o.status(this.g);
    if (!st) return null;
    if (id === 'riders') return st.goals.find((x) => x.goal.id === 'riders' || x.goal.id === 'oepnv') || null;
    return st.goals.find((x) => x.goal.id === id) || null;
  }
  finances() {
    const g = this.g;
    // Szenario „Schulden": Kredite so früh wie möglich tilgen
    if (this.goal('loans') && g.loans.length) {
      const rests = g.loans.map((l) => (l.amount / l.weeks) * l.weeksLeft);
      const k = rests.indexOf(Math.min(...rests));
      if (g.money > rests[k] + 3000) { g.repayLoan(k); this.say('tilgt einen Kredit vorzeitig'); }
      return;
    }
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
    const indCap = this.goal('jobs3')?.goal.cmp === '<=' ? 6 : 16; // Industrie-Obergrenze: nur ein paar Felder
    if (this.blockOk(0, 1)) this.buildBlock(0, 1, Z.IND, indCap); else if (this.blockOk(1, 1)) this.buildBlock(1, 1, Z.IND, indCap);
    this.power(); this.water();
  }
  // Alle Ziele außer Geld erfüllt → nicht mehr ausbauen, nur noch sparen (wie ein Mensch kurz vor dem Ziel)
  noExpand() {
    const st = this.o.status && this.o.status(this.g);
    if (!st) return false;
    const mg = st.goals.find((x) => x.goal.id === 'money');
    if (mg && !mg.done && st.goals.every((x) => x === mg || x.done)) return true;
    const cm = st.goals.find((x) => x.goal.id === 'commute');
    const pg = st.goals.find((x) => x.goal.id === 'pop');
    if (cm && pg && this.g.stats.pop > pg.goal.target * 1.1) return true;
    return false;
  }
  // Was ein Mensch aus der Zieltafel eines Szenarios ableitet
  scenarioGoals() {
    const g = this.g;
    const st = this.o.status && this.o.status(g);
    if (!st || st.st.status !== 'running') return;
    const G = (id) => st.goals.find((x) => x.goal.id === id);
    const [cx, cy] = this.center();
    // Teure Verordnungen abschaffen, wenn gespart werden muss
    if ((G('loans') || G('money')) && !this.policiesDone) {
      for (const id of [...g.policies]) if (id !== 'tenants' && id !== 'lowrise') g.togglePolicy(id);
      this.policiesDone = true; this.say('schafft teure Verordnungen ab');
    }
    // Höchstzahl an Einwohnern: freie Wohnfelder entzonen und Hochhausverbot (wie ein Mensch, der bremst)
    // Industrie-Obergrenze: freie Industriefelder entzonen, bei Überschreitung den größten Betrieb abreißen
    const ic = G('jobs3');
    if (ic && ic.goal.cmp === '<=') {
      const jobs = g.stats.jobsByZone[Z.IND] || 0;
      if (jobs > ic.goal.target * 0.8) { const free = [...g.zoneFree[Z.IND]].filter((i) => !g.bld[i]); if (free.length) g.zoneTiles(free, 0); }
      if (jobs > ic.goal.target) {
        const big = [...g.buildings.values()].filter((b) => b.zone === Z.IND).sort((a, b) => b.cap - a.cap)[0];
        if (big) { const r = g.bulldoze([big.y * this.W + big.x]); if (r && r.ok !== false) this.say('reißt einen Industriebetrieb ab (Obergrenze)'); }
      }
    }
    const pm = G('popmax');
    if (pm && g.stats.pop > pm.goal.target * 0.65) {
      const free = [...g.zoneFree[Z.RES]].filter((i) => !g.bld[i]);
      if (free.length) { g.zoneTiles(free, 0); this.say(`entzont ${free.length} Wohnfelder`); }
    }
    if (pm && !g.policies.has('lowrise') && g.milestone >= 2) { g.togglePolicy('lowrise'); this.say('beschließt das Hochhausverbot'); }
    // Geld- oder Schuldenziel: Steuern maßvoll anheben, solange die Stimmung trägt und genug Einwohner bleiben
    if ((G('loans') || G('money')) && !G('happy') && g.day() % 2 === 0) {
      const pg = G('pop'), roomy = !pg || g.stats.pop > pg.goal.target * 1.2;
      for (const z of [1, 2, 3, 4]) {
        if (g.stats.happiness > 57 && roomy && g.taxes[z] < 13) g.setTax(z, g.taxes[z] + 1);
        else if ((g.stats.happiness < 50 || !roomy) && g.taxes[z] > 10) g.setTax(z, g.taxes[z] - 1);
      }
    }
    // Steuern: zu hoch für das Glücksziel?
    const hp = G('happy');
    if (hp && !hp.done && (g.lastBudget?.net || 0) > 600 && this.free('svc') > 4000 && g.day() % 3 === 0) {
      for (const z of [1, 2, 3, 4]) if (g.taxes[z] > 8) g.setTax(z, g.taxes[z] - 1);
    }
    // Gebäude, die das Szenario verlangt, und Gutscheine für Wahrzeichen
    for (const x of st.goals) if (x.goal.id.startsWith('built_') && !x.done) {
      const key = x.goal.id.slice(6);
      if (BUILDINGS[key]?.needsWater) this.shorePlace(key, cx, cy, { maxDist: 30 }); else this.placeNear(key, cx, cy + 2, 12);
    }
    for (const key of [...g.landmarkVouchers]) {
      if (BUILDINGS[key]?.needsWater) this.shorePlace(key, cx, cy, { maxDist: 30 }); else this.placeNear(key, cx, cy + 2, 12);
    }
    // Tourismus und Wahrzeichen: jedes freigeschaltete Wahrzeichen, Strandbäder, Hauptbahnhof
    const tg = G('tourism'), lg = G('landmarks');
    if ((tg && !tg.done) || (lg && !lg.done)) {
      const lms = Object.keys(BUILDINGS).filter((k) => BUILDINGS[k].landmark && g.isUnlocked(k) && !g.hasBuilt(k)).sort((a, b) => BUILDINGS[b].tourism / BUILDINGS[b].cost - BUILDINGS[a].tourism / BUILDINGS[a].cost);
      for (const key of lms.slice(0, 1)) {
        if (BUILDINGS[key].needsWater) this.shorePlace(key, cx, cy, { maxDist: 30 }); else this.placeNear(key, cx, cy + 2, 14);
      }
      if (tg && (this.count.beach || 0) < 4) this.shorePlace('beach', cx, cy, { maxDist: 30 });
      if (tg && g.isUnlocked('train_station') && !this.count.train_station) this.placeNear('train_station', cx, cy + 4, 14);
      if (tg && g.isUnlocked('taxi_depot') && !this.count.taxi_depot) this.placeNear('taxi_depot', cx, cy + 2, 10);
    }
    // Parks zählen
    const pk = G('parks');
    if (pk && !pk.done) {
      const key = g.isUnlocked('allotment') && this.free('svc') > 4000 ? 'allotment' : 'park';
      this.placeNear(key, cx + ((g.day() * 7) % 11) - 5, cy + ((g.day() * 5) % 9) - 4, 10);
    }
    // Bildung: Universität, Gymnasium, Bibliotheken, Bildungsoffensive
    const ed = G('edu');
    if (ed && !ed.done) {
      if (g.isUnlocked('university') && (this.count.university || 0) < 1 + Math.floor(g.stats.pop / 9000)) this.placeNear('university', cx, cy, 14);
      if (g.isUnlocked('highschool') && (this.count.highschool || 0) < 1 + Math.floor(g.stats.pop / 4000)) this.placeNear('highschool', cx, cy, 12);
      if (g.isUnlocked('library') && (this.count.library || 0) < g.stats.pop / 1200) this.gap('edu', 'library', 0.7, { zones: [Z.RES], r: 6 });
      if (g.isUnlocked('policies') && !g.policies.has('education') && g.milestone >= 3) g.togglePolicy('education');
    }
    // Pendelzeit: Lücken im Straßenraster schließen (mehr Wege zur Arbeit), Gassen ausbauen
    const cm = G('commute');
    if (cm && !cm.done && this.free() > 3000 && !this.gapsDone) { this.connectGaps(); this.gapsDone = true; }
    if (cm && !cm.done && this.free() > 3000) {
      const lanes = [];
      for (let i = 0; i < g.N && lanes.length < 60; i++) if (g.road[i] === R.LANE) lanes.push(i);
      if (lanes.length) { const r = g.buildRoad(lanes, g.isUnlocked('avenue') ? R.AVENUE : R.STREET); if (r.ok) this.say(`baut ${lanes.length} Gassenfelder aus`); }
    }
  }
  // Waagrechte und senkrechte Lücken (bis 12 Felder) zwischen Straßenenden schließen, wenn das Land frei ist
  connectGaps() {
    const g = this.g, W = this.W, H = this.H;
    let n = 0;
    const free = (i) => !g.road[i] && !g.bld[i] && !g.stationAt[i] && g.world.terrain[i] !== T.WATER && g.world.terrain[i] !== T.ROCK;
    for (const horiz of [true, false]) {
      for (let a = 1; a < (horiz ? H : W) - 1; a++) {
        let last = -1;
        for (let b = 1; b < (horiz ? W : H) - 1; b++) {
          const i = horiz ? a * W + b : b * W + a;
          if (!g.road[i] || g.road[i] === R.HIGHWAY) continue;
          if (last >= 0 && b - last > 1 && b - last <= 12) {
            const tiles = [];
            for (let c = last + 1; c < b; c++) tiles.push(horiz ? a * W + c : c * W + a);
            if (tiles.every(free) && this.free() > tiles.length * 50 + 2000) { if (g.buildRoad(tiles, R.STREET).ok) n += tiles.length; }
          }
          last = b;
        }
      }
    }
    if (n) this.say(`schließt Lücken im Straßennetz (${n} Felder)`);
    return n;
  }
  daily() {
    const g = this.g;
    if (g.gameOver) return;
    this.scenarioGoals();
    if (g.milestone !== this.lastMs) {
      for (let m = this.lastMs + 1; m <= g.milestone; m++) this.unlockDay[MILESTONES[m].name] = g.day();
      this.lastMs = g.milestone;
    }
    this.finances();
    for (let k = 0; k < 3 && this.power(); k++);
    for (let k = 0; k < 4 && this.water(); k++);
    this.sewage();
    this.garbage();
    this.services(); // Dienste vor neuen Blöcken: erst versorgen, dann wachsen
    this.expand();
    this.buses();
    this.transit();
    this.upgradeRoads();
  }
}

// Spielt einen Tag in kleinen Schritten (wie bei 1×: 30 s = 1 Tag).
export function runDay(g) { for (let s = 0; s < 300; s++) g.update(0.1); }

// Der Kernverkehr nutzt noch Math.random – für reproduzierbare Prüfstände durch einen festen Zufall ersetzen.
export function seedMathRandom(seed = 1) {
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
