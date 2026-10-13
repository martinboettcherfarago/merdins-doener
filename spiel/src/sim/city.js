// Zonen-Simulation: Nachfrage, Wachstum, Belegung, Stufenaufstieg, Verfall, Brände, Bildung.
import { LEVELS, Z, T, RES, MILESTONES, BUILDINGS, SPEC_MAX_LEVEL } from '../config.js';
import { clamp } from '../util.js';
import { DEMAND_MODIFIERS, CAPACITY_MODIFIERS, warnOnce } from '../registry.js';

const LEVEL_GATE = [2, 2, 3, 4, 5, 5, 5, 5];

export function maxLevelAt(g, x, y) {
  let m = g.sandbox ? 5 : LEVEL_GATE[g.milestone] ?? 5;
  if (g.policies.has('lowrise')) m = Math.min(m, 3);
  // Die Pulsbahn fährt im Tunnel: über der Strecke gibt es keine Höhenbegrenzung mehr.
  return m;
}

export function capacityOf(b, g) {
  let c = LEVELS[b.zone].cap[b.level] * (b.w || 1) * (b.h || 1);
  if (b.spec) c = Math.round(c * 1.2);
  if (g) for (const fn of CAPACITY_MODIFIERS) {
    try { const v = fn(g, b, c); if (Number.isFinite(v)) c = v; } catch (e) { warnOnce('CAPACITY_MODIFIERS', e); }
  }
  return Math.max(0, Math.round(c));
}

// Kennzahlen der Stadt aufsummieren.
export function aggregate(g) {
  const s = g.stats;
  let pop = 0, resCap = 0, eduSum = 0;
  const cap = [0, 0, 0, 0, 0];
  const planned = [0, 0, 0, 0, 0];
  const count = [0, 0, 0, 0, 0];
  let abandoned = 0, unpowered = 0, unwatered = 0, burning = 0, noRoad = 0, garbageProb = 0, offBoost = 0;
  // Forschungszentren wertet das Bürger-System selbst aus (Büro-Nachfrage), alle anderen offBoost-Gebäude der Kern
  const skipResearch = !!(g.ext && g.ext.citizens);
  for (const b of g.buildings.values()) {
    if (!b.zone) {
      const d = BUILDINGS[b.key];
      if (d && d.offBoost && b.powered && b.construct >= 1 && !b.abandoned && !(skipResearch && b.key === 'research')) offBoost += d.offBoost * 0.5;
      continue;
    }
    count[b.zone]++;
    if (b.abandoned) { abandoned++; continue; }
    if (b.burning) burning++;
    planned[b.zone] += b.cap;
    if (b.construct < 1) continue;
    if (!b.powered) unpowered++;
    if (!b.watered) unwatered++;
    if (!b.connected) noRoad++;
    if (b.problemGarbage) garbageProb++;
    if (b.zone === Z.RES) {
      pop += b.occ;
      resCap += b.cap;
      eduSum += b.occ * b.edu;
    } else cap[b.zone] += b.cap;
  }
  const workers = pop * 0.62;
  const jobs = cap[2] + cap[3] + cap[4];
  const employed = Math.min(workers, jobs);
  s.pop = pop;
  s.resCap = resCap;
  s.workers = workers;
  s.jobs = jobs;
  s.jobsByZone = cap;
  s.plannedByZone = planned;
  s.countByZone = count;
  s.employed = employed;
  s.unemployment = workers > 0 ? (workers - employed) / workers : 0;
  s.jobFill = jobs > 0 ? employed / jobs : 1;
  s.edu = pop > 0 ? eduSum / pop : 0;
  s.eduWorkers = eduSum * 0.62;
  s.abandoned = abandoned;
  s.unpowered = unpowered;
  s.unwatered = unwatered;
  s.burning = burning;
  s.noRoad = noRoad;
  s.garbageProb = garbageProb;
  s.offBoost = offBoost;
  // Arbeitsplätze füllen
  for (const b of g.buildings.values()) {
    if (!b.zone || b.zone === Z.RES || b.abandoned || b.construct < 1) continue;
    b.occ = Math.round(b.cap * s.jobFill);
  }
}

export function updateDemand(g) {
  const s = g.stats;
  const d = g.demand;
  const tax = g.taxes;
  const pop = s.pop;
  const happy = s.happiness;
  const P = s.plannedByZone;
  // Zuzug: Menschen kommen, wenn es Jobs gibt und die Stadt attraktiv ist
  const vacantJobs = s.jobs * 0.98 - s.workers;
  const attract = happy > 50 ? 6 : 0;
  const boot = pop < 400 ? 50 * (1 - pop / 400) : 0;
  let people = boot + clamp((vacantJobs / Math.max(30, s.workers * 0.12)) * 45, -70, 70);
  people += attract + (happy - 52) * 0.5 - (tax[1] - 10) * 4.5;
  people += g.eff('resDemand') + Math.min(15, s.tourism * 0.02);
  if (s.unemployment > 0.12) people -= (s.unemployment - 0.12) * 140;
  g.peopleDemand = clamp(people, -100, 100);
  // Neubau-Nachfrage Wohnen: abzüglich leerer Wohnungen
  const emptyHomes = Math.max(0, P[1] - pop);
  const R = people - clamp((emptyHomes / Math.max(40, P[1] * 0.1)) * 25, 0, 60);
  // Arbeitskräfte, die noch keinen (geplanten) Job haben
  const plannedJobs = P[2] + P[3] + P[4];
  const labor = clamp(((s.workers * 1.12 + 10 - plannedJobs) / Math.max(20, plannedJobs * 0.15)) * 40, -90, 60);
  // Gewerbe: Kaufkraft und Tourismus
  const comNeed = pop * 0.2 + s.tourism * 0.5 + 8;
  let C = clamp(((comNeed - P[2]) / Math.max(14, P[2] * 0.25)) * 40, -80, 80) * 0.6 + labor * 0.5 - (tax[2] - 10) * 4 + g.eff('comDemand');
  // Industrie: Waren für Geschäfte und Export
  const indNeed = P[2] * 0.8 + 30 + pop * 0.12;
  let I = clamp(((indNeed - P[3]) / Math.max(18, P[3] * 0.25)) * 40, -80, 80) * 0.6 + labor * (0.6 - s.edu * 0.3) - (tax[3] - 10) * 4 + g.eff('indDemand');
  if (g.policies.has('cleanind')) I -= 20;
  // Büro: gebildete Arbeitskräfte
  const offNeed = s.eduWorkers * 0.6 + pop * 0.03;
  let O = clamp(((offNeed - P[4]) / Math.max(18, P[4] * 0.25)) * 40, -80, 80) * 0.6 + labor * s.edu * 0.8 - (tax[4] - 10) * 4 + g.eff('offDemand');
  // Wahrzeichen und Verkehrsknoten mit offBoost (Pulsturm, Flughafen, Messe …) ziehen Büros an
  O += s.offBoost || 0;
  if (!g.isUnlocked('zone4')) O = 0;
  d[1] = clamp(R, -100, 100);
  d[2] = clamp(C, -100, 100);
  d[3] = clamp(I, -100, 100);
  d[4] = clamp(O, -100, 100);
  for (const fn of DEMAND_MODIFIERS) {
    try { fn(g, d); } catch (e) { warnOnce('DEMAND_MODIFIERS', e); }
  }
  for (let z = 1; z <= 4; z++) d[z] = Number.isFinite(d[z]) ? clamp(d[z], -100, 100) : 0;
}

// Neue Gebäude auf freien Zonenfeldern.
export function growthStep(g) {
  for (let z = 1; z <= 4; z++) {
    const dem = g.demand[z];
    if (dem <= 4) continue;
    g.growAcc[z] += dem / 110;
    let tries = 0;
    while (g.growAcc[z] >= 1 && tries < 8) {
      g.growAcc[z] -= 1;
      tries++;
      const t = pickCandidate(g, z);
      if (t >= 0) {
        const [w, h] = chooseFootprint(g, t, z);
        g.spawnZoneBuilding(t, z, w, h);
      }
    }
    g.growAcc[z] = Math.min(g.growAcc[z], 3);
  }
}

// Grundstücke zusammenlegen: Gewerbe, Industrie und Büros wachsen gern auf 2×1 oder 2×2 Feldern,
// Wohnen gelegentlich als 2×1-Reihe. Alle Felder müssen frei, gleich gezont und bebaubar sein.
const FOOTPRINTS = {
  1: [[2, 1, 0.14], [1, 2, 0.14]],
  2: [[2, 2, 0.18], [2, 1, 0.2], [1, 2, 0.2]],
  3: [[2, 2, 0.35], [2, 1, 0.2], [1, 2, 0.2]],
  4: [[2, 2, 0.3], [2, 1, 0.18], [1, 2, 0.18]],
};
export function lotFree(g, i, z) {
  if (i < 0 || i >= g.N) return false;
  if (g.zone[i] !== z || g.bld[i] || g.road[i] || g.stationAt[i] || g.rubble[i]) return false;
  const ter = g.world.terrain[i];
  return ter !== T.WATER && ter !== T.ROCK;
}
export function chooseFootprint(g, t, z) {
  const x = t % g.W, y = (t / g.W) | 0;
  for (const [w, h, p] of FOOTPRINTS[z] || []) {
    if (g.rng() > p) continue;
    if (x + w > g.W || y + h > g.H) continue;
    let ok = true;
    for (let yy = y; yy < y + h && ok; yy++) for (let xx = x; xx < x + w; xx++) if (!lotFree(g, yy * g.W + xx, z)) { ok = false; break; }
    if (ok) return [w, h];
  }
  return [1, 1];
}

function pickCandidate(g, z) {
  const arr = g.zoneFreeArray(z);
  if (!arr.length) return -1;
  let best = -1, bestScore = -1e9;
  for (let k = 0; k < 4; k++) {
    const t = arr[Math.floor(g.rng() * arr.length)];
    if (!isBuildableZoneTile(g, t)) continue;
    const lv = g.fields.landValue[t];
    let score = z === Z.IND ? g.rng() * 20 - lv * 0.2 : lv + g.rng() * 15;
    const ad = Math.abs(g.access[t] - t);
    if (ad === 1 || ad === g.W) score += 12;
    if (score > bestScore) { bestScore = score; best = t; }
  }
  return best;
}

export function isBuildableZoneTile(g, t) {
  if (g.bld[t] || g.road[t] || g.stationAt[t] || g.rubble[t]) return false;
  const ter = g.world.terrain[t];
  if (ter === T.WATER || ter === T.ROCK) return false;
  const a = g.access[t];
  if (a < 0) return false;
  return g.roadComp[a] === g.outsideComp && g.outsideComp >= 0;
}

export function constructionStep(g, minutes) {
  for (const b of g.buildings.values()) {
    if (b.construct >= 1) continue;
    const days = b.zone ? (b.level > 1 ? 0.35 : 0.5) : 0.6;
    b.construct = Math.min(1, b.construct + minutes / (days * 1440));
    if (b.construct >= 1) {
      b.construct = 1;
      g.emit('buildingUpdated', b);
    }
  }
}

function industryScore(g, i) {
  const c = g.cov;
  return 18 + (c.fire[i] + c.police[i]) * 15 + c.garbage[i] * 10 + c.transit[i] * 6 + Math.max(0, c.lvBonus[i]) * 0.3 + (g.world.resource[i] ? 6 : 0);
}

export function dailyBuildings(g) {
  const rng = g.rng;
  const s = g.stats;
  const R = g.peopleDemand;
  const eduMul = g.mods.edu * (g.policies.has('education') ? 1.6 : 1) * (1 + s.eduCity);
  const fireMul = g.mods.fire * (g.policies.has('smoke') ? 0.5 : 1);
  const toDemolish = [];
  for (const b of g.buildings.values()) {
    if (!b.zone || b.construct < 1) continue;
    b.age++;
    const i = b.y * g.W + b.x;
    if (b.abandoned) {
      b.abandonedDays++;
      if (b.abandonedDays >= 5) toDemolish.push(b);
      continue;
    }
    // Probleme zählen
    b.noPower = b.powered ? 0 : b.noPower + 1;
    b.noWater = b.watered ? 0 : b.noWater + 1;
    b.noRoad = b.connected ? 0 : b.noRoad + 1;
    b.unhappyDays = b.happy < 18 ? b.unhappyDays + 1 : 0;
    if (b.noPower >= 7 || b.noWater >= 7 || b.noRoad >= 4 || b.unhappyDays >= 8) {
      g.abandonBuilding(b);
      continue;
    }
    // Belegung
    if (b.zone === Z.RES) {
      const room = b.cap - b.occ;
      if (R > 0 && b.happy > 30 && b.connected && room > 0) {
        const inc = Math.min(room, Math.ceil(room * (0.25 + R / 260)));
        b.occ += inc;
        if (inc >= 3 && rng() < 0.35) g.traffic.spawnMoveIn(b);
      } else if ((R < -25 || b.happy < 24) && b.occ > 0) {
        b.occ -= Math.min(b.occ, Math.ceil(b.occ * 0.07));
      }
      // Bildung
      const target = g.cov.edu[i];
      if (target > b.edu) b.edu = Math.min(target, b.edu + 0.035 * eduMul);
      else b.edu = Math.max(target * 0.8, b.edu - 0.008);
    }
    // Stufen
    const ml = maxLevelAt(g, b.x, b.y);
    const maxSpec = b.spec ? Math.min(ml, SPEC_MAX_LEVEL) : ml;
    if (b.level > maxSpec) {
      g.setBuildingLevel(b, maxSpec);
    } else if (b.level < maxSpec && b.powered && b.watered && b.happy >= 45) {
      const L = LEVELS[b.zone];
      const next = b.level + 1;
      const score = b.zone === Z.IND ? industryScore(g, i) : g.fields.landValue[i];
      const filled = b.zone === Z.RES ? b.occ >= b.cap * 0.7 : s.jobFill >= 0.55;
      const eduOk = b.zone === Z.RES ? b.edu >= L.edu[next] : s.edu >= L.edu[next];
      if (score >= L.need[next] && filled && eduOk) {
        b.upCount++;
        if (b.upCount >= 2 && rng() < 0.3) {
          b.upCount = 0;
          g.setBuildingLevel(b, next);
        }
      } else b.upCount = 0;
    }
    // Brände
    if (!b.burning) {
      const risk = 0.0014 * (0.6 + b.level * 0.15) * (1 - g.cov.fire[i] * 0.85) * fireMul;
      if (rng() < risk) g.igniteBuilding(b);
    }
  }
  for (const b of toDemolish) g.removeBuilding(b, { silent: true });
}

// Stündlich: Brände ausbreiten bzw. Gebäude zerstören
export function hourlyFires(g) {
  const burning = [];
  for (const b of g.buildings.values()) if (b.burning) burning.push(b);
  for (const b of burning) {
    const i = b.y * g.W + b.x;
    const hours = (g.time - b.burning) / 60;
    if (b.extinguishAt && g.time >= b.extinguishAt) {
      b.burning = 0; b.extinguishAt = 0;
      g.emit('buildingUpdated', b);
      continue;
    }
    if (hours > 9) {
      g.news('fire', `Ein Gebäude ist vollständig niedergebrannt.`, 'bad', b);
      g.removeBuilding(b, { rubble: true, silent: true });
      continue;
    }
    // Ausbreitung
    if (g.rng() < 0.05 * (1 - g.cov.fire[i])) {
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const [ox, oy] = dirs[Math.floor(g.rng() * 4)];
      const nx = b.x + ox, ny = b.y + oy;
      if (nx >= 0 && ny >= 0 && nx < g.W && ny < g.H) {
        const nb = g.buildings.get(g.bld[ny * g.W + nx]);
        if (nb && nb.zone && !nb.burning && !nb.abandoned) g.igniteBuilding(nb);
      }
    }
  }
}

export function checkMilestones(g) {
  let changed = false;
  while (g.milestone < MILESTONES.length - 1 && g.stats.pop >= MILESTONES[g.milestone + 1].pop) {
    g.milestone++;
    const m = MILESTONES[g.milestone];
    if (!g.sandbox) g.money += m.reward;
    if (g.milestone >= 3 && g.milestone <= 5) g.transit.linesMax++;
    g.emit('milestone', g.milestone);
    changed = true;
  }
  return changed;
}
