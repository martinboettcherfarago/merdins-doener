// Haushalt: Steuern, Unterhalt, Fahrgeld, Tourismus, Kredite.
import { BUILDINGS, ROADS, TAX_RATE, TRANSIT, POLICIES, Z, T, R } from '../config.js';
import { BUDGET_LINES } from '../registry.js';

export function computeBudget(g) {
  const inc = { res: 0, com: 0, ind: 0, off: 0, tourism: 0, fares: 0 };
  const exp = { services: 0, roads: 0, transit: 0, policies: 0, loans: 0 };
  const taxMul = 1 + g.eff('taxMul') + (g.hasBuilt('townhall') ? 0.08 : 0);
  for (const b of g.buildings.values()) {
    if (b.zone) {
      if (b.abandoned || b.construct < 1) continue;
      const base = b.occ * TAX_RATE[b.zone] * g.taxes[b.zone] * taxMul;
      if (b.zone === Z.RES) inc.res += base * (g.policies.has('tenants') ? 0.9 : 1);
      else if (b.zone === Z.COM) inc.com += base * (g.policies.has('nightquiet') ? 0.9 : 1) * (1 + g.eff('comTax'));
      else if (b.zone === Z.IND) inc.ind += base;
      else inc.off += base;
    } else {
      const d = BUILDINGS[b.key];
      if (b.key === 'station') continue;
      exp.services += d.upkeep * g.upkeepMul() * (g.serviceBudget[d.cat] ?? 1);
    }
  }
  inc.tourism = g.stats.tourism * 0.55;
  inc.fares = g.policies.has('freetransit') ? 0 : g.transit.faresToday;
  // Straßen
  let roadCost = 0;
  for (let i = 0; i < g.N; i++) {
    const r = g.road[i];
    if (!r || r === R.HIGHWAY) continue;
    roadCost += ROADS[r].upkeep * (g.world.terrain[i] === T.WATER ? 3 : 1);
  }
  exp.roads = roadCost * g.upkeepMul();
  // Pulsbahn
  const tr = g.transit;
  exp.transit = (tr.stations.size * TRANSIT.stationUpkeep + tr.lines.length * TRANSIT.lineUpkeep + tr.trains.length * TRANSIT.trainUpkeep + tr.totalWagons() * TRANSIT.wagonUpkeep) * g.upkeepMul();
  // Verordnungen
  for (const p of POLICIES) if (g.policies.has(p.id)) exp.policies += p.cost * (g.stats.pop / 100);
  // Kredite (Zinsen anteilig pro Tag)
  for (const l of g.loans) exp.loans += l.weekly / 7;
  for (const l of BUDGET_LINES) {
    const v = l.amount(g) || 0;
    if (l.kind === 'income') inc[l.id] = (inc[l.id] || 0) + v; else exp[l.id] = (exp[l.id] || 0) + v;
  }
  const income = Object.values(inc).reduce((a, b) => a + b, 0);
  const expense = Object.values(exp).reduce((a, b) => a + b, 0);
  return { inc, exp, income, expense, net: income - expense };
}

export function dailyEconomy(g) {
  const b = computeBudget(g);
  g.lastBudget = b;
  if (!g.sandbox) g.money += b.net;
  g.weekIncome += b.income;
  g.weekExpense += b.expense;
  g.transit.faresToday = 0;
  // Bankrott-Überwachung
  if (!g.sandbox) {
    const limit = g.difficulty === 'hard' ? -10000 : -25000;
    if (g.money < limit) {
      g.debtDays++;
      if (g.debtDays === 1) g.news('money', 'Die Stadtkasse ist tief im Minus! Steuern erhöhen oder Kosten senken.', 'bad');
      if (g.debtDays >= 10) g.emit('bankrupt');
    } else g.debtDays = 0;
  }
}

export function weeklyLoans(g) {
  for (const l of g.loans) {
    l.weeksLeft--;
    // Tilgung + Zinsen sind in weekly enthalten; Zinsen laufen über dailyEconomy
    if (!g.sandbox) g.money -= l.amount / l.weeks;
  }
  g.loans = g.loans.filter((l) => l.weeksLeft > 0);
}
