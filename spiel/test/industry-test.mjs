// Prüfstand „Wirtschaft & Industrie" (headless).
// Baut eine Stadt mit allen vier Rohstoffketten, Verarbeitung, Lagerhallen, Güterbahnhof, Frachthafen und
// Markthalle, simuliert 60+ Tage und prüft, dass Warenströme, Preise und Haushalt plausibel und stabil sind.
//   node test/industry-test.mjs [tage=70] [--quiet]
import { Game } from '../src/sim/game.js';
import { R, Z, RES, T, BUILDINGS } from '../src/config.js';
import { GOODS, GOOD_KEYS } from '../src/content/industry.js';
import { setServiceBudget, setExportPrice, setDensityTax, setWarehouseMode, marketDemand, worldPrice, budgetOf } from '../src/sim/systems/industry.js';
import { happinessFactors } from '../src/sim/services.js';

const days = +(process.argv.find((a) => /^\d+$/.test(a)) || 70);
const quiet = process.argv.includes('--quiet');
const g = new Game({ size: 96, seed: 4242, mapType: 'river', difficulty: 'normal', name: 'Werkstadt' });
const W = g.W, H = g.H;
const idx = (x, y) => y * W + x;
const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const st = () => g.ext.industry;
let fails = 0;
const check = (ok, text) => { console.log(`${ok ? '  ok ' : '  FEHLER'}  ${text}`); if (!ok) fails++; };
const offered = [], events = [];
g.on('cards', (ids) => { offered.push(...ids); const own = ids.find((id) => id.startsWith('ind_')); g.chooseCard(own || ids[0]); });
g.on('event', (ev) => { events.push(ev.id); g.resolveEvent(0); });
g.on('bankrupt', () => console.log('BANKROTT'));
const newsSeen = [];
g.on('news', (n) => { if (n.kind === 'economy') newsSeen.push(`Tag ${g.day()}: ${n.text}`); });

// Startkapital für den Aufbau; geprüft wird der laufende Haushalt, nicht der Kontostand
g.money = 400000;
g.milestone = 4; // Verarbeitung, Hafen und Stufen bis 5 freischalten

function road(ax, ay, bx, by, t = R.STREET) {
  if (ay === by) for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) { if (inb(x, ay)) g.buildRoad([idx(x, ay)], t); }
  else for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) { if (inb(ax, y)) g.buildRoad([idx(ax, y)], t); }
}
function zone(ax, ay, bx, by, z, filter = null) {
  const tiles = [];
  for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) if (inb(x, y) && (!filter || filter(idx(x, y)))) tiles.push(idx(x, y));
  g.zoneTiles(tiles, z);
}
function place(key, x, y, maxD = 8) {
  for (let d = 0; d <= maxD; d++) for (const [ox, oy] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, -d], [d, -d], [-d, d]]) {
    for (const rot of [0, 1]) {
      const r = g.placeBuilding(key, x + ox, y + oy, rot);
      if (r.ok) return r.building;
    }
  }
  console.log('  platzieren fehlgeschlagen:', key, x, y, g.checkPlace(key, x, y));
  return null;
}
const res = g.world.resource, forest = g.world.forest, ter = g.world.terrain;
const plain = (i) => !res[i] && !forest[i];

// ---------------------------------------------------------------- Aufbau
const hy = g.world.highwayY; // 54
road(6, hy, 36, hy, R.AVENUE);
for (const x of [8, 13, 18, 23, 28, 33]) road(x, 40, x, 66);
for (const y of [40, 45, 49, 59, 64]) road(8, y, 33, y);
// Bauernland im Nordosten
road(33, 36, 33, 40); road(28, 36, 46, 36); road(38, 36, 38, 46); road(43, 36, 43, 46); road(33, 41, 46, 41); road(33, 46, 46, 46);
// Bergwerk im Südwesten
road(7, hy, 7, 69); road(2, 60, 7, 60); road(2, 65, 7, 65);
// Ölfeld im Nordwesten
road(8, 8, 8, 40); road(1, 14, 8, 14); road(1, 20, 8, 20); road(1, 26, 8, 26);

zone(9, 41, 32, 53, Z.RES);
zone(24, 55, 32, 58, Z.COM);
zone(9, 55, 17, 58, Z.COM);
zone(9, 60, 17, 66, Z.IND, plain); // Fabriken (ohne Rohstoffe)
zone(19, 55, 27, 63, Z.IND, (i) => forest[i] && !res[i]); // Forst
zone(34, 37, 46, 45, Z.IND, (i) => res[i] === RES.FERTILE); // Bauernhöfe
zone(0, 58, 6, 69, Z.IND, (i) => res[i] === RES.ORE); // Bergwerk
zone(0, 9, 7, 30, Z.IND, (i) => res[i] === RES.OIL); // Ölförderung

// Versorgung und Dienste
place('coal', 30, 66); place('coal', 24, 66); place('wind', 34, 60); place('wind', 34, 62);
for (const [x, y] of [[9, 39], [12, 39], [15, 39], [20, 39], [25, 39], [34, 50], [34, 52], [34, 56]]) place('watertower', x, y, 3);
place('landfill', 14, 67); place('landfill', 29, 37);
place('police', 20, 46); place('fire', 25, 50); place('clinic', 15, 47); place('school', 10, 50); place('park', 12, 43); place('park', 27, 43);
place('police', 11, 61); place('fire', 21, 64);
// Warenwirtschaft
const food = place('food_factory', 39, 47);
const saw = place('sawmill', 24, 60);
const steel = place('steelworks', 8, 66);
const refi = place('refinery', 9, 16);
const wh1 = place('warehouse', 19, 50);
const wh2 = place('warehouse', 14, 60);
const rail = place('cargo_rail', 9, 51);
const harbor = place('cargo_harbor', 35, 55, 10);
const market = place('market_hall', 29, 55);
console.log('Aufbau fertig. Gebäude:', g.buildings.size, 'Geld:', Math.round(g.money));
console.log('  Ketten:', [food, saw, steel, refi, wh1, wh2, rail, harbor, market].map((b) => (b ? BUILDINGS[b.key].name : '–')).join(', '));

// ---------------------------------------------------------------- Simulation
const series = [];
const anyNaN = (o, path = '') => {
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'number' && !Number.isFinite(v)) return path + k;
    if (v && typeof v === 'object' && !(v instanceof Map)) { const r = anyNaN(v, path + k + '.'); if (r) return r; }
  }
  return null;
};
let nanAt = null, overStock = null, negStock = null, priceOut = null;
const t0 = Date.now();
const pad = (v, n = 6) => String(v).padStart(n);
if (!quiet) console.log('\n  Tag   Einw    Kasse  Saldo  Export  Betr. Zukauf Versorg Absatz Fracht Konj  Lager  Lkw/T');
const advisor = []; // Was der „Spieler" an den Exportpreisen gedreht hat
for (let d = 1; d <= days; d++) {
  for (let s = 0; s < 300; s++) g.update(0.1);
  const S = st(), t = S.tot, L = S.lines;
  // Ab Tag 35 reagiert der Spieler wie im Wirtschaftsfenster empfohlen: bleibt Ware liegen, wird sie
  // billiger angeboten; reißt sich der Weltmarkt darum, wird sie teurer.
  if (d >= 35 && d % 3 === 0) {
    for (const k of GOOD_KEYS) {
      const f = S.flow[k];
      if (f.prod < 5) continue;
      const p = S.prices[k];
      if (f.unsold > f.prod * 0.08 && p > 0.7) { setExportPrice(g, k, p - 0.05); advisor.push(`Tag ${d}: ${GOODS[k].name} billiger (${Math.round((p - 0.05) * 100)} %)`); }
      else if (f.unsold < 1 && f.exp > 5 && marketDemand(g, k) > f.exp * 1.4 && p < 1.5) { setExportPrice(g, k, p + 0.05); advisor.push(`Tag ${d}: ${GOODS[k].name} teurer (${Math.round((p + 0.05) * 100)} %)`); }
    }
  }
  if (!nanAt) nanAt = anyNaN({ tot: t, lines: L, flow: S.flow, market: S.market, cycle: S.cycle });
  for (const [id, w] of Object.entries(S.wh)) {
    const b = g.buildings.get(+id);
    const cap = BUILDINGS[b.key].storage * S.perm.storage;
    let sum = 0;
    for (const v of Object.values(w.stock)) { sum += v; if (v < -1e-6) negStock = `Tag ${d}`; }
    if (sum > cap + 1e-3) overStock = `Tag ${d}: ${sum.toFixed(1)} > ${cap}`;
  }
  for (const k of GOOD_KEYS) { const p = S.market[k].idx; if (p < 0.5 || p > 1.9) priceOut = `${k} ${p}`; }
  series.push({ d, pop: g.stats.pop, money: g.money, net: g.lastBudget.net, exp: L.export, loc: L.local, raw: L.rawbuy, sup: t.supplyCom, sal: t.salesInd, fr: t.freightUse, cyc: S.cycle.value, stock: t.stock, trucks: t.trucksDay, expT: L.exportT, impT: L.importT });
  if (!quiet && (d % 5 === 0 || d === days)) {
    console.log(`${pad(d, 5)} ${pad(g.stats.pop, 6)} ${pad(Math.round(g.money), 8)} ${pad(Math.round(g.lastBudget.net))} ${pad(Math.round(L.export), 7)} ${pad(Math.round(L.local))} ${pad(Math.round(L.rawbuy))} ${pad(Math.round(t.supplyCom * 100) + '%', 7)} ${pad(Math.round(t.salesInd * 100) + '%')} ${pad(Math.round(t.freightUse * 100) + '%')} ${pad(S.cycle.value.toFixed(2))} ${pad(Math.round(t.stock))} ${pad(Math.round(t.trucksDay))}`);
  }
}
const secs = (Date.now() - t0) / 1000;
const S = st(), t = S.tot;

// ---------------------------------------------------------------- Bericht
console.log(`\nWarenbilanz am Tag ${days} (t/Tag, geglättet):`);
console.log('  Ware            Erzeugt  Stadt  Export  Import  →Lager  Lager→  Unverk.  Preis  Spielerpreis  Weltmarkt-Nachfrage');
for (const k of GOOD_KEYS) {
  const f = S.flow[k];
  console.log(`  ${GOODS[k].name.padEnd(14)} ${pad(f.prod.toFixed(0), 8)} ${pad(f.local.toFixed(0))} ${pad(f.exp.toFixed(0), 7)} ${pad(f.imp.toFixed(0), 7)} ${pad(f.whIn.toFixed(0), 7)} ${pad(f.whOut.toFixed(0), 7)} ${pad(f.unsold.toFixed(0), 8)} ${pad(worldPrice(g, k).toFixed(2), 6)} € ${pad(Math.round(S.prices[k] * 100) + ' %', 10)} ${pad(marketDemand(g, k).toFixed(0), 12)}`);
}
console.log(`  Fracht: Lkw ${Math.round(t.truckUsed)}/${Math.round(t.truckCap)} · Bahn ${Math.round(t.railUsed)}/${Math.round(t.railCap)} · Hafen ${Math.round(t.harborUsed)}/${Math.round(t.harborCap)} t/Tag · Routenbonus +${(t.routeBonus * 100).toFixed(1)} % · Reichweite ${t.reach.toFixed(2)}`);
console.log(`  Vorprodukte für Fabriken: ${Math.round(t.boost * 100)} % · städtische Jobs ${S.jobs} (besetzt ${Math.round(t.staff * 100)} %) · Lager ${Math.round(t.stock)}/${Math.round(t.stockCap)} t`);
const procs = [food, saw, steel, refi].filter(Boolean).map((b) => { const r = S.rec.get(b.id); return `${BUILDINGS[b.key].name} ${Math.round(r.in)}/${Math.round(r.cap)} t → ${Math.round(r.out)} t (${r.profit >= 0 ? '+' : ''}${Math.round(r.profit)} €/Tag)`; });
console.log('  Verarbeitung:', procs.join(' · '));
console.log(`  Preisanpassungen des Spielers: ${advisor.length}${advisor.length ? ' – zuletzt ' + advisor.slice(-3).join(', ') : ''}`);
const b = g.lastBudget;
console.log('  Haushalt (€/Tag):', Object.entries({ ...b.inc, ...Object.fromEntries(Object.entries(b.exp).map(([k, v]) => ['−' + k, v])) }).filter(([, v]) => Math.abs(v) >= 1).map(([k, v]) => `${k} ${Math.round(v)}`).join(', '));
const lv = {};
for (const bb of g.buildings.values()) if (bb.zone) lv[bb.zone + ':' + bb.level] = (lv[bb.zone + ':' + bb.level] || 0) + 1;
console.log('  Stufen', JSON.stringify(lv), '· verlassen', g.stats.abandoned, '· Glück', g.stats.happiness.toFixed(0), '· Arbeitslos', (g.stats.unemployment * 100).toFixed(1) + ' %');
const spec = { farm: 0, forest: 0, mine: 0, oil: 0 };
for (const bb of g.buildings.values()) if (bb.spec) spec[bb.spec]++;
console.log('  Spezialindustrie', JSON.stringify(spec));
// Glücksfaktoren der Wirtschaft im Gewerbe und in der Industrie
for (const z of [2, 3]) {
  const agg = {}; let n = 0;
  for (const bb of g.buildings.values()) {
    if (bb.zone !== z || bb.abandoned || bb.construct < 1) continue;
    n++;
    const out = []; happinessFactors(g, bb, out);
    for (const [l, v] of out) agg[l] = (agg[l] || 0) + v;
  }
  console.log(`  Ø Glücksfaktoren ${z === 2 ? 'Gewerbe' : 'Industrie'}:`, Object.entries(agg).sort((a, c) => Math.abs(c[1]) - Math.abs(a[1])).slice(0, 9).map(([l, v]) => `${l} ${(v / n).toFixed(1)}`).join(', '));
}
const trucks = g.traffic.cars.filter((c) => c.freight).length;
console.log(`  Fahrzeuge: ${g.traffic.cars.length}, davon Lieferverkehr ${trucks} · Lkw-Fahrten/Tag (echt) ${Math.round(t.trucksDay)}`);
const ships = g.renderables().filter((r) => r.kind === 'ship_cargo').length;
const trains = g.renderables().filter((r) => r.kind === 'cargo_wagon' || r.kind === 'train_loco').length;
console.log(`  Renderables: ${ships} Frachtschiffe, ${trains} Zugteile`);
console.log(`  Wochenkarten angeboten: ${offered.length} (Wirtschaft: ${offered.filter((id) => id.startsWith('ind_')).join(', ') || '–'}) · gewählt: ${g.cardsTaken.map((c) => c.id).join(', ')}`);
console.log(`  Ereignisse: ${events.join(', ') || '–'}`);
console.log('  Wirtschaftsmeldungen:', newsSeen.length);
for (const n of newsSeen.slice(-8)) console.log('    ' + n);
console.log(`  Laufzeit ${secs.toFixed(1)} s`);

// ---------------------------------------------------------------- Prüfungen
console.log('\nPrüfungen:');
const last = series.slice(-20);
const avg = (arr, k) => arr.reduce((a, e) => a + e[k], 0) / arr.length;
check(!nanAt, `keine NaN/Unendlich in Zustand und Kennzahlen${nanAt ? ' (' + nanAt + ')' : ''}`);
for (const k of GOOD_KEYS) check(S.flow[k].prod > 1, `${GOODS[k].name} wird erzeugt (${S.flow[k].prod.toFixed(0)} t/Tag)`);
check(series.filter((e) => e.exp > 0).length >= days - 3, `Exporterlöse an fast allen Tagen (${series.filter((e) => e.exp > 0).length}/${days})`);
check(avg(last, 'sup') >= 0.75, `Läden in den letzten 20 Tagen gut versorgt (Ø ${(avg(last, 'sup') * 100).toFixed(0)} %)`);
check(avg(last, 'sal') >= 0.8, `Industrie verkauft ihre Ware (Ø Absatz ${(avg(last, 'sal') * 100).toFixed(0)} %)`);
check(!overStock && !negStock, `Lagerbestände zwischen 0 und Kapazität${overStock ? ' – ' + overStock : ''}${negStock ? ' – negativ ' + negStock : ''}`);
check(!priceOut, `Weltmarktpreise im Rahmen 0,5–1,9${priceOut ? ' – ' + priceOut : ''}`);
const expAvg = avg(last, 'exp'), expSd = Math.sqrt(avg(last.map((e) => ({ v: (e.exp - expAvg) ** 2 })), 'v'));
check(expAvg > 0 && expSd / expAvg < 0.5, `Exporterlöse stabil (Ø ${Math.round(expAvg)} €/Tag, Streuung ${(expSd / Math.max(1, expAvg) * 100).toFixed(0)} %)`);
const incAvg = avg(last.map((e, i) => ({ v: series[series.length - 20 + i] ? g.lastBudget.income : 0 })), 'v');
check(expAvg < incAvg * 0.6, `Export ist wichtig, aber nicht alles (${Math.round(expAvg / Math.max(1, g.lastBudget.income) * 100)} % der Einnahmen)`);
check(avg(last, 'net') > 0 && avg(last, 'net') < g.lastBudget.income, `Haushalt im Plus, aber nicht absurd (Ø Saldo ${Math.round(avg(last, 'net'))} €/Tag)`);
check(Math.min(...series.map((e) => e.cyc)) < 0 && Math.max(...series.map((e) => e.cyc)) > 0.3, `Konjunktur schwankt (${Math.min(...series.map((e) => e.cyc)).toFixed(2)} … ${Math.max(...series.map((e) => e.cyc)).toFixed(2)})`);
check(t.trucksDay > 20 && trucks > 0, `Lieferverkehr fährt (${trucks} Lkw unterwegs)`);
check(ships > 0, 'Frachtschiffe am Hafen');
check(S.tot.stock > 1, `Lagerhallen puffern (${Math.round(S.tot.stock)} t)`);
check(g.stats.pop > 1500, `Stadt wächst (${g.stats.pop} Einwohner)`);

// Bedienung: Dienstbudgets
{
  const before = g.budget().exp.services;
  const supBefore = g.util.powerSupply;
  setServiceBudget(g, 'services', 0.5);
  setServiceBudget(g, 'power', 1.5);
  for (let s = 0; s < 40; s++) g.update(0.1);
  const after = g.budget().exp.services;
  check(after < before, `Dienstbudget senkt Unterhalt (${Math.round(before)} → ${Math.round(after)} €/Tag)`);
  check(g.util.powerSupply > supBefore * 1.15, `Strombudget 150 % erhöht Kraftwerksleistung (${Math.round(supBefore)} → ${Math.round(g.util.powerSupply)} MW)`);
  setServiceBudget(g, 'services', 1); setServiceBudget(g, 'power', 1);
  for (let s = 0; s < 40; s++) g.update(0.1);
  check(Math.abs(g.util.powerSupply - supBefore) < supBefore * 0.02, `Zurück auf 100 % stellt die Leistung wieder her (${Math.round(g.util.powerSupply)} MW)`);
}
// Bedienung: Exportpreise – teurer heißt weniger Nachfrage
{
  const k = 'goods';
  const d1 = marketDemand(g, k, 1), d2 = marketDemand(g, k, 1.4);
  check(d2 < d1 * 0.6, `Höherer Exportpreis senkt die Nachfrage des Weltmarkts (${Math.round(d1)} → ${Math.round(d2)} t/Tag)`);
  setExportPrice(g, k, 1.4);
  check(S.prices[k] === 1.4, 'Exportpreis lässt sich setzen');
  setExportPrice(g, k, 1);
}
// Bedienung: Dichte-Steuer
{
  setDensityTax(g, 1, 0, 3);
  for (let s = 0; s < 40; s++) g.update(0.1);
  check(g.budget().inc.ind_density > 0, `Dichte-Zuschlag bringt Einnahmen (${Math.round(g.budget().inc.ind_density)} €/Tag)`);
  setDensityTax(g, 1, 0, 0);
}
// Bedienung: Lager leeren
if (wh1) {
  setWarehouseMode(g, wh1.id, 'empty');
  const before = Object.values(S.wh[wh1.id].stock).reduce((a, v) => a + v, 0);
  for (let s = 0; s < 300; s++) g.update(0.1);
  const after = Object.values(st().wh[wh1.id].stock).reduce((a, v) => a + v, 0);
  check(after <= before + 1e-6, `Lager im Modus „Leeren" gibt Ware ab (${before.toFixed(0)} → ${after.toFixed(0)} t)`);
}
// Speichern und Laden
{
  const data = JSON.parse(JSON.stringify(g.serialize()));
  const g2 = Game.fromSave(data);
  const a = st(), c = g2.ext.industry;
  const stockA = Object.values(a.wh).reduce((s, w) => s + Object.values(w.stock).reduce((x, v) => x + v, 0), 0);
  const stockB = Object.values(c.wh).reduce((s, w) => s + Object.values(w.stock).reduce((x, v) => x + v, 0), 0);
  check(Math.abs(stockA - stockB) < 0.5, `Lagerbestand übersteht Speichern/Laden (${stockA.toFixed(0)} / ${stockB.toFixed(0)} t)`);
  check(Math.abs(a.cycle.value - c.cycle.value) < 1e-3 && a.prices.goods === c.prices.goods, 'Konjunktur und Preise übersteht Speichern/Laden');
  check(Math.abs(g.budget().net - g2.budget().net) < Math.max(50, Math.abs(g.budget().net) * 0.05), `Haushalt nach dem Laden gleich (${Math.round(g.budget().net)} / ${Math.round(g2.budget().net)} €/Tag)`);
  for (let s = 0; s < 300; s++) g2.update(0.1);
  check(g2.ext.industry.tot.exportT > 0 && !anyNaN({ tot: g2.ext.industry.tot }), 'Nach dem Laden läuft die Wirtschaft weiter');
  check(Math.abs(g2.mods.power - g.mods.power) < 1e-6, 'Budget-Faktoren werden beim Laden nicht doppelt angewandt');
}
// ---------------------------------------------------------------- Oberfläche headless rendern
{
  const { PANELS, INSPECTORS, BUILDING_PROBLEMS, OVERLAYS_EXTRA } = await import('../src/registry.js');
  await import('../src/ui/panels/economy.js');
  const panel = PANELS.find((p) => p.id === 'economy');
  const fakeUi = { g, el: { insp: { addEventListener() {} }, panel: null }, view: 'none' };
  let ok = !!panel, err = '';
  if (panel) {
    for (const tab of ['overview', 'goods', 'logistics', 'budgets', 'taxes']) {
      try {
        panel.click(fakeUi, 'eco-tab', { dataset: { k: tab } });
        const html = panel.render(fakeUi);
        if (!html || html.length < 500 || /undefined|NaN/.test(html)) { ok = false; err += ` ${tab}:${/NaN/.test(html) ? 'NaN' : /undefined/.test(html) ? 'undefined' : 'kurz'}`; }
      } catch (e) { ok = false; err += ` ${tab}:${e.message}`; }
    }
  }
  check(ok, `Panel „Wirtschaft" rendert alle Reiter ohne Fehler${err}`);
  // Frisches Spiel ohne Daten
  {
    const fresh = new Game({ size: 64, seed: 3, mapType: 'coast', difficulty: 'hard' });
    const fu = { g: fresh, el: { insp: { addEventListener() {} } }, view: 'none' };
    let ok2 = true, err2 = '';
    for (const tab of ['overview', 'goods', 'logistics', 'budgets', 'taxes']) {
      try {
        panel.click(fu, 'eco-tab', { dataset: { k: tab } });
        const html = panel.render(fu);
        if (/NaN|undefined/.test(html)) { ok2 = false; err2 += ' ' + tab; }
      } catch (e) { ok2 = false; err2 += ` ${tab}:${e.message}`; }
    }
    check(ok2, `Panel rendert auch im frischen Spiel ohne Daten${err2}`);
    panel.click(fu, 'eco-tab', { dataset: { k: 'overview' } });
  }
  let insp = 0, inspErr = '';
  for (const b of g.buildings.values()) {
    for (const fn of INSPECTORS) {
      try { const h = fn(fakeUi, { type: 'building', id: b.id }); if (h) { insp++; if (/NaN|undefined/.test(h)) inspErr = BUILDINGS[b.key]?.name || 'Zone ' + b.zone; } } catch (e) { inspErr = e.message; }
    }
  }
  check(insp > 50 && !inspErr, `Inspektor-Abschnitte für ${insp} Gebäude${inspErr ? ' – Fehler bei ' + inspErr : ''}`);
  const ov = OVERLAYS_EXTRA.find((o) => o.id === 'goods');
  let colored = 0;
  for (const b of g.buildings.values()) if (ov && ov.building(g, b) !== null) colored++;
  check(colored > 50, `Infoansicht „Waren" färbt ${colored} Gebäude`);
  void BUILDING_PROBLEMS;
}

// ---------------------------------------------------------------- Mangel-Szenario: viel Gewerbe, kaum Fracht
console.log('\nMangel-Szenario (nach 20 Tagen: Generalstreik in den Fabriken, Frachtkapazität −85 %):');
{
  const m = new Game({ size: 64, seed: 99, mapType: 'river', difficulty: 'normal', name: 'Ladenstadt' });
  m.money = 200000;
  m.on('cards', (ids) => m.chooseCard(ids[0]));
  m.on('event', () => m.resolveEvent(1));
  const MW = m.W, my = m.world.highwayY, mx = m.world.highwayEnd % MW + 1;
  const mi = (x, y) => y * MW + x;
  const rd = (ax, ay, bx, by) => { if (ay === by) for (let x = ax; x <= bx; x++) m.buildRoad([mi(x, ay)], R.STREET); else for (let y = ay; y <= by; y++) m.buildRoad([mi(ax, y)], R.STREET); };
  const zn = (ax, ay, bx, by, z) => { const t = []; for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) t.push(mi(x, y)); m.zoneTiles(t, z); };
  const pl = (key, x, y) => { for (let d = 0; d < 8; d++) for (const [ox, oy] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]]) if (m.placeBuilding(key, x + ox, y + oy).ok) return true; return false; };
  rd(mx, my, mx + 24, my);
  for (const x of [mx + 3, mx + 8, mx + 13, mx + 18, mx + 23]) rd(x, my - 10, x, my + 10);
  rd(mx + 3, my - 10, mx + 23, my - 10); rd(mx + 3, my + 10, mx + 23, my + 10);
  zn(mx + 4, my - 9, mx + 22, my - 1, Z.RES);
  zn(mx + 4, my + 1, mx + 22, my + 9, Z.COM);
  zn(mx + 4, my + 6, mx + 12, my + 9, Z.IND);
  pl('coal', mx + 10, my + 11); pl('watertower', mx + 1, my - 3); pl('watertower', mx + 1, my + 3); pl('watertower', mx + 25, my - 4); pl('landfill', mx + 18, my + 11);
  const s0 = { lv: 0 };
  // 20 Tage normal wachsen lassen, dann Dauerstreik in den Fabriken und Frachtsperre
  for (let d = 1; d <= 20; d++) for (let s = 0; s < 300; s++) m.update(0.1);
  m.addEffect('ecoFreight', -0.85, 400, 'Test: Frachtsperre');
  m.addEffect('ecoProd:factory', -1, 400, 'Test: Generalstreik');
  for (let d = 1; d <= 14; d++) for (let s = 0; s < 300; s++) m.update(0.1);
  const S2 = m.ext.industry, t2 = S2.tot;
  let shortF = 0, n = 0, maxLv = 0;
  for (const b of m.buildings.values()) {
    if (b.zone !== Z.COM || b.abandoned || b.construct < 1) continue;
    n++; maxLv = Math.max(maxLv, b.level);
    const out = []; happinessFactors(m, b, out);
    for (const [l, v] of out) if (l === 'Warenmangel') shortF += v;
  }
  void s0;
  console.log(`  Einw ${m.stats.pop} · Läden ${n} · versorgt ${P2(t2.supplyCom)} · Import ${Math.round(t2.importT)} t von ${Math.round(t2.freightCap)} t Fracht · Nachfrage G ${m.demand[2].toFixed(0)} I ${m.demand[3].toFixed(0)}`);
  check(t2.shortCom > 0.2, `Ohne Fracht und Industrie entsteht Warenmangel (${P2(t2.shortCom)} fehlen)`);
  check(n > 0 && shortF / n < -2, `Warenmangel drückt das Glück im Gewerbe (Ø ${(shortF / Math.max(1, n)).toFixed(1)})`);
  {
    // Beitrag der Wirtschaft zur Nachfrage (ohne den Kern, der hier vom Arbeitskräftemangel dominiert wird)
    const { DEMAND_MODIFIERS } = await import('../src/registry.js');
    const dd = [0, 0, 0, 0, 0], d0 = [0, 0, 0, 0, 0];
    for (const fn of DEMAND_MODIFIERS) fn(m, dd);
    const keep = t2.shortCom; t2.shortCom = 0;
    for (const fn of DEMAND_MODIFIERS) fn(m, d0);
    t2.shortCom = keep;
    console.log(`  Absatz ${P2(t2.salesInd)} · Mangel ${P2(t2.shortCom)} · Konjunktur ${S2.cycle.value.toFixed(2)} · Rohstoffe/Waren ${Math.round(t2.indProd)} t (ohne Fracht unverkäuflich)`);
    check(dd[3] - d0[3] > 10 && dd[2] - d0[2] < -10, `Warenmangel weckt Nachfrage nach Industrie (+${(dd[3] - d0[3]).toFixed(0)}) und bremst neue Läden (${(dd[2] - d0[2]).toFixed(0)})`);
    check(dd[3] < d0[3] + 25, `Unverkäufliche Ware dämpft die Industrienachfrage trotzdem (gesamt ${dd[3].toFixed(0)})`);
  }
  const msgs = m.newsLog.filter((x) => x.kind === 'economy').map((x) => x.text);
  check(msgs.some((x) => /Läden bekommen nur|Warenmangel/.test(x)), 'Stadtfunk warnt vor dem Warenmangel');
}
function P2(v) { return Math.round((v || 0) * 100) + ' %'; }

void T; void budgetOf;
console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen.` : '\nAlle Prüfungen bestanden.');
process.exit(fails ? 1 : 0);
