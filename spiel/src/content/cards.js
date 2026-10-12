// Zusätzliche Wochenkarten. Besitzer: System-Agent „Fortschritt & Inhalte" (S5).
// Form wie in sim/progress.js: { id, name, tag, color, w, cond?(g), text(g), apply(g) }.
// metro: true → nur im Metro-Modus (dort werden ausschließlich solche Karten angeboten).
//
// Neue Effekt-Schlüssel für g.addEffect(), hier über die Register angebunden:
//   lvAdd        Bodenwert + Wert auf allen Feldern
//   happyRes     Glück + Wert nur in Wohngebäuden
//   happyWork    Glück + Wert in Gewerbe, Industrie und Büro
//   incomeAdd    € pro Tag als Sondereinnahme
//   fareBonus    Anteil zusätzlicher Pulsbahn-Einnahmen (0,5 = +50 %)
//   upkeepRebate Anteil des Dienste-Unterhalts, der erstattet wird
import { CARDS } from '../sim/progress.js';
import { LANDVALUE_TERMS, HAPPINESS_FACTORS, BUDGET_LINES } from '../registry.js';
import { BUILDINGS, Z } from '../config.js';
import { fmtMoney } from '../util.js';

const P = (g) => g.ext.progression || null;
const money = (g, v) => { if (!g.sandbox) g.money += v; };
const pop = (g) => g.stats.pop;
const count = (g, id) => g.cardCount[id] || 0;
const season = (g) => g.ext.weather?.season;
const voucher = (g, cat) => { const st = P(g); if (st) st.vouchers[cat] = (st.vouchers[cat] || 0) + 1; };
const lockedOk = (g, key) => BUILDINGS[key] && g.isUnlocked(key);
const round = (v, s = 500) => Math.round(v / s) * s;

// --- Effekt-Anbindung (pro Spielminute zwischengespeichert, weil pro Feld/Gebäude aufgerufen)
const cache = new WeakMap();
function effCached(g, key) {
  let c = cache.get(g);
  if (!c || c.t !== g.time || c.n !== g.effects.length) { c = { t: g.time, n: g.effects.length, v: {} }; cache.set(g, c); }
  if (!(key in c.v)) c.v[key] = g.effects.length ? g.eff(key) : 0;
  return c.v[key];
}
LANDVALUE_TERMS.push((g) => effCached(g, 'lvAdd'));
HAPPINESS_FACTORS.push((g, b) => {
  if (b.zone === Z.RES) { const v = effCached(g, 'happyRes'); return v ? ['Aktionen für Mieter', v] : null; }
  if (b.zone) { const v = effCached(g, 'happyWork'); return v ? ['Betriebsklima', v] : null; }
  return null;
});
BUDGET_LINES.push({ id: 'cardIncome', label: 'Sondereinnahmen', kind: 'income', amount: (g) => effCached(g, 'incomeAdd') });
BUDGET_LINES.push({ id: 'fareBonus', label: 'Tarifbonus Pulsbahn', kind: 'income', amount: (g) => { const f = effCached(g, 'fareBonus'); return f ? (g.transit.faresToday || 0) * f : 0; } });
BUDGET_LINES.push({ id: 'upkeepRebate', label: 'Verwaltungsrabatt', kind: 'income', amount: (g) => { const f = effCached(g, 'upkeepRebate'); return f ? (g.lastBudget?.exp?.services || 0) * f : 0; } });

const NEW_CARDS = [
  // --- Geld
  { id: 'fund', name: 'Strukturfonds', tag: 'Geld', color: '#e3a925', w: 1.0, cond: (g) => pop(g) > 1500, text: (g) => `${fmtMoney(round(15000 + pop(g) * 3.5, 1000))} aus dem Strukturfonds des Landes.`, apply: (g) => money(g, round(15000 + pop(g) * 3.5, 1000)) },
  { id: 'lottery', name: 'Stadtlotterie', tag: 'Geld', color: '#e3a925', w: 0.9, text: (g) => `${fmtMoney(round(3000 + pop(g) * 1.5))} Lotterieerlös und ein bisschen Losglück: Glück +2 für 3 Tage.`, apply: (g) => { money(g, round(3000 + pop(g) * 1.5)); g.addEffect('happy', 2, 3, 'Stadtlotterie'); } },
  { id: 'sponsor', name: 'Sponsoring', tag: 'Geld', color: '#e3a925', w: 0.9, cond: (g) => pop(g) > 400, text: (g) => `Ein Getränkehersteller sponsert die Stadt: ${fmtMoney(Math.round(80 + pop(g) * 0.05))} pro Tag, 14 Tage lang.`, apply: (g) => g.addEffect('incomeAdd', Math.round(80 + pop(g) * 0.05), 14, 'Sponsoring') },
  { id: 'taxholiday', name: 'Steuerferien', tag: 'Wachstum', color: '#63c27a', w: 0.7, cond: (g) => pop(g) > 300, text: () => 'Steuereinnahmen −30 % für 5 Tage – dafür Wohnnachfrage +40 und Gewerbe +30.', apply: (g) => { g.addEffect('taxMul', -0.3, 5, 'Steuerferien'); g.addEffect('resDemand', 40, 5, 'Steuerferien'); g.addEffect('comDemand', 30, 5, 'Steuerferien'); } },
  { id: 'bond', name: 'Stadtanleihe', tag: 'Geld', color: '#c98a0c', w: 0.6, cond: (g) => g.milestone >= 2 && count(g, 'bond') < 2, text: () => '+40.000 € sofort. Dafür steigt der Unterhalt dauerhaft um 5 %.', apply: (g) => { money(g, 40000); g.mods.upkeep *= 1.05; } },
  { id: 'audit', name: 'Rechnungsprüfung', tag: 'Geld', color: '#7d8a99', w: 0.9, cond: (g) => pop(g) > 500, text: () => '15 % des Dienste-Unterhalts werden 14 Tage lang erstattet.', apply: (g) => g.addEffect('upkeepRebate', 0.15, 14, 'Rechnungsprüfung') },
  { id: 'parkingfees', name: 'Parkgebühren', tag: 'Geld', color: '#c98a0c', w: 0.7, cond: (g) => pop(g) > 800, text: (g) => `${fmtMoney(Math.round(pop(g) * 0.08))} pro Tag für 10 Tage – aber Glück −2.`, apply: (g) => { g.addEffect('incomeAdd', Math.round(pop(g) * 0.08), 10, 'Parkgebühren'); g.addEffect('happy', -2, 10, 'Parkgebühren'); } },
  { id: 'casino', name: 'Spielbank', tag: 'Geld', color: '#a0522d', w: 0.5, cond: (g) => pop(g) > 2500, text: (g) => `${fmtMoney(Math.round(150 + pop(g) * 0.06))} pro Tag für 21 Tage. Die Kirche ist empört: Glück −2.`, apply: (g) => { g.addEffect('incomeAdd', Math.round(150 + pop(g) * 0.06), 21, 'Spielbank'); g.addEffect('happy', -2, 21, 'Spielbank'); } },
  // --- Wachstum
  { id: 'babyboom', name: 'Babyboom', tag: 'Wachstum', color: '#63c27a', w: 0.9, cond: (g) => pop(g) > 300, text: () => 'Wohnnachfrage +50 für 5 Tage.', apply: (g) => g.addEffect('resDemand', 50, 5, 'Babyboom') },
  { id: 'tradeshow', name: 'Gewerbeschau', tag: 'Wachstum', color: '#4c9be8', w: 0.9, text: () => 'Gewerbenachfrage +40 für 7 Tage.', apply: (g) => g.addEffect('comDemand', 40, 7, 'Gewerbeschau') },
  { id: 'indpark', name: 'Industrieansiedlung', tag: 'Wachstum', color: '#eeb33f', w: 0.9, cond: (g) => pop(g) > 200, text: () => 'Industrienachfrage +45 für 7 Tage.', apply: (g) => g.addEffect('indDemand', 45, 7, 'Industrieansiedlung') },
  { id: 'hq', name: 'Konzernzentrale', tag: 'Wachstum', color: '#a77be0', w: 0.8, cond: (g) => g.isUnlocked('zone4') && pop(g) > 800, text: () => 'Ein Konzern verlegt seine Zentrale hierher: Büronachfrage +60 für 7 Tage.', apply: (g) => g.addEffect('offDemand', 60, 7, 'Konzernzentrale') },
  { id: 'students', name: 'Erstsemester', tag: 'Wachstum', color: '#8f5ad8', w: 0.8, cond: (g) => g.hasBuilt('university'), text: () => 'Tausende Studierende ziehen her: Wohnnachfrage +25, Büros +20 für 8 Tage.', apply: (g) => { g.addEffect('resDemand', 25, 8, 'Erstsemester'); g.addEffect('offDemand', 20, 8, 'Erstsemester'); } },
  { id: 'pioneers', name: 'Pioniergeist', tag: 'Wachstum', color: '#63c27a', w: 1.3, cond: (g) => pop(g) < 450, text: () => 'Junge Familien entdecken die Stadt: Wohnen +40, Gewerbe und Industrie +20 für 5 Tage.', apply: (g) => { g.addEffect('resDemand', 40, 5, 'Pioniergeist'); g.addEffect('comDemand', 20, 5, 'Pioniergeist'); g.addEffect('indDemand', 20, 5, 'Pioniergeist'); } },
  { id: 'highrise', name: 'Investorenturm', tag: 'Wachstum', color: '#a77be0', w: 0.6, cond: (g) => g.isUnlocked('zone4') && pop(g) > 1500, text: () => 'Büros +40, Gewerbe +20 für 7 Tage. Die Altstadtfreunde protestieren: Glück −3.', apply: (g) => { g.addEffect('offDemand', 40, 7, 'Investorenturm'); g.addEffect('comDemand', 20, 7, 'Investorenturm'); g.addEffect('happy', -3, 7, 'Investorenturm'); } },
  // --- Glück
  { id: 'summerconcerts', name: 'Sommerkonzerte', tag: 'Glück', color: '#f06fae', w: 0.9, text: () => 'Glück +5 für 10 Tage.', apply: (g) => g.addEffect('happy', 5, 10, 'Sommerkonzerte') },
  { id: 'marathon', name: 'Stadtmarathon', tag: 'Glück', color: '#f06fae', w: 0.8, cond: (g) => pop(g) > 600, text: () => 'Glück +4 und +80 Touristen für 4 Tage.', apply: (g) => { g.addEffect('happy', 4, 4, 'Stadtmarathon'); g.addEffect('tourismAdd', 80, 4, 'Stadtmarathon'); } },
  { id: 'winefest', name: 'Winzerfest', tag: 'Glück', color: '#9c2f5a', w: 0.7, cond: (g) => pop(g) > 300, text: () => 'Glück +6 für 5 Tage, +50 Touristen.', apply: (g) => { g.addEffect('happy', 6, 5, 'Winzerfest'); g.addEffect('tourismAdd', 50, 5, 'Winzerfest'); } },
  { id: 'streetfood', name: 'Street-Food-Festival', tag: 'Glück', color: '#ff8a1f', w: 0.8, text: () => 'Glück +4 und Gewerbenachfrage +20 für 6 Tage.', apply: (g) => { g.addEffect('happy', 4, 6, 'Street Food'); g.addEffect('comDemand', 20, 6, 'Street Food'); } },
  { id: 'cleanup', name: 'Frühjahrsputz', tag: 'Glück', color: '#22a866', w: 0.8, cond: (g) => pop(g) > 250, text: () => 'Müllabfuhr +50 % für 7 Tage, Glück +2.', apply: (g) => { g.addEffect('garbageCov', 0.5, 7, 'Frühjahrsputz'); g.addEffect('happy', 2, 7, 'Frühjahrsputz'); } },
  { id: 'tenantsday', name: 'Tag der Nachbarn', tag: 'Glück', color: '#63c27a', w: 0.8, text: () => 'Wohnglück +4 für 10 Tage.', apply: (g) => g.addEffect('happyRes', 4, 10, 'Tag der Nachbarn') },
  { id: 'workparty', name: 'Betriebsfeiern', tag: 'Glück', color: '#4c9be8', w: 0.7, cond: (g) => g.stats.jobs > 200, text: () => 'Glück +6 in allen Betrieben für 7 Tage.', apply: (g) => g.addEffect('happyWork', 6, 7, 'Betriebsfeiern') },
  // --- Pulsbahn
  { id: 'twolines', name: 'Netzausbau', tag: 'Pulsbahn', color: '#e8543f', w: 0.6, cond: (g) => g.isUnlocked('transit') && g.milestone >= 3 && g.transit.linesMax <= 8, text: () => 'Zwei zusätzliche Linienplätze für die Pulsbahn.', apply: (g) => { g.transit.linesMax = Math.min(10, g.transit.linesMax + 2); } },
  { id: 'fleet', name: 'Fuhrpark', tag: 'Pulsbahn', color: '#2f8fe0', w: 0.8, cond: (g) => g.isUnlocked('transit') && g.transit.lines.length >= 2, text: () => 'Drei Züge und zwei Waggons gratis ins Depot.', apply: (g) => { g.transit.freeTrains += 3; g.transit.freeWagons += 2; } },
  { id: 'wagonpack', name: 'Waggon-Paket', tag: 'Pulsbahn', color: '#22a866', w: 0.8, cond: (g) => g.isUnlocked('transit') && g.transit.lines.length >= 1, text: () => 'Sechs Waggons gratis: +36 Plätze.', apply: (g) => { g.transit.freeWagons += 6; } },
  { id: 'ticketsale', name: 'Ticket-Aktion', tag: 'Pulsbahn', color: '#10a9a3', w: 0.8, cond: (g) => g.transit.lines.length >= 1, text: () => 'Pulsbahn-Fahrgäste +40 % für 7 Tage.', apply: (g) => g.addEffect('ridership', 0.4, 7, 'Ticket-Aktion') },
  { id: 'tariff', name: 'Tarifreform', tag: 'Pulsbahn', color: '#10a9a3', w: 0.7, cond: (g) => g.transit.lines.length >= 2, text: () => 'Pulsbahn-Einnahmen +60 % für 10 Tage.', apply: (g) => g.addEffect('fareBonus', 0.6, 10, 'Tarifreform') },
  { id: 'hubvoucher', name: 'Umsteigebahnhof', tag: 'Pulsbahn', color: '#e8543f', w: 0.6, cond: (g) => lockedOk(g, 'metro_hub') && g.transit.lines.length >= 2, text: () => 'Gutschein: Der nächste Pulsbahn-Umsteigebahnhof ist gratis.', apply: (g) => voucher(g, 'transit') },
  { id: 'signals', name: 'Neue Stellwerke', tag: 'Dauerhaft', color: '#10a9a3', w: 0.6, cond: (g) => g.isUnlocked('transit') && count(g, 'signals') < 3, text: () => 'Pulsbahn-Züge dauerhaft 10 % schneller.', apply: (g) => { g.mods.trainSpeed *= 1.1; } },
  // --- Bauen & Gutscheine
  { id: 'asphalt', name: 'Asphaltmischwerk', tag: 'Bauen', color: '#5f6b78', w: 0.9, text: () => 'Straßen kosten 5 Tage lang 70 % weniger.', apply: (g) => g.addEffect('roadCost', -0.7, 5, 'Asphaltmischwerk') },
  { id: 'eduvoucher', name: 'Bildungsgutschein', tag: 'Gutschein', color: '#8f5ad8', w: 0.8, cond: (g) => g.milestone >= 1, text: () => 'Die nächste Bildungseinrichtung (Kita, Schule, Bibliothek …) ist gratis.', apply: (g) => voucher(g, 'education') },
  { id: 'svcvoucher', name: 'Dienste-Gutschein', tag: 'Gutschein', color: '#e8543f', w: 0.8, cond: (g) => g.milestone >= 1, text: () => 'Das nächste Gebäude für Polizei, Feuerwehr oder Gesundheit ist gratis.', apply: (g) => voucher(g, 'services') },
  { id: 'powervoucher', name: 'Energiegutschein', tag: 'Gutschein', color: '#f2b01e', w: 0.7, text: () => 'Das nächste Kraftwerk ist gratis.', apply: (g) => voucher(g, 'power') },
  { id: 'watervoucher', name: 'Wassergutschein', tag: 'Gutschein', color: '#38a3d1', w: 0.7, text: () => 'Das nächste Wasser- oder Abwassergebäude ist gratis.', apply: (g) => voucher(g, 'water') },
  { id: 'gardenshow', name: 'Gartenschau', tag: 'Parks', color: '#22a866', w: 0.6, cond: (g) => pop(g) > 800, text: () => 'Parks 10 Tage kostenlos und +120 Touristen.', apply: (g) => { g.addEffect('parkFree', 1, 10, 'Gartenschau'); g.addEffect('tourismAdd', 120, 10, 'Gartenschau'); } },
  { id: 'architect', name: 'Stararchitektin', tag: 'Bodenwert', color: '#c06a2b', w: 0.7, cond: (g) => pop(g) > 600, text: () => 'Bodenwert +6 in der ganzen Stadt für 10 Tage.', apply: (g) => g.addEffect('lvAdd', 6, 10, 'Stararchitektin') },
  { id: 'renovation', name: 'Sanierungsprogramm', tag: 'Bodenwert', color: '#c06a2b', w: 0.7, cond: (g) => pop(g) > 1200, text: () => 'Bodenwert +3 für 14 Tage und Glück +2.', apply: (g) => { g.addEffect('lvAdd', 3, 14, 'Sanierungsprogramm'); g.addEffect('happy', 2, 14, 'Sanierungsprogramm'); } },
  // --- Dauerhaft
  { id: 'efficiency', name: 'Effizienzprogramm', tag: 'Dauerhaft', color: '#f2b01e', w: 0.6, cond: (g) => count(g, 'efficiency') < 2, text: () => 'Strom und Wasser dauerhaft +6 %.', apply: (g) => { g.mods.power *= 1.06; g.mods.water *= 1.06; } },
  { id: 'ecocert', name: 'Umweltzertifikat', tag: 'Dauerhaft', color: '#22a866', w: 0.6, cond: (g) => g.stats.jobsByZone[3] > 60 && count(g, 'ecocert') < 2, text: () => 'Industrie-Abgase dauerhaft −10 %.', apply: (g) => { g.mods.pollution *= 0.9; } },
  { id: 'egov', name: 'Digitale Verwaltung', tag: 'Dauerhaft', color: '#7d8a99', w: 0.6, cond: (g) => g.milestone >= 3 && count(g, 'egov') < 2, text: () => 'Unterhaltskosten dauerhaft −5 %.', apply: (g) => { g.mods.upkeep *= 0.95; } },
  { id: 'excellence', name: 'Exzellenzinitiative', tag: 'Dauerhaft', color: '#8f5ad8', w: 0.6, cond: (g) => (g.hasBuilt('university') || g.hasBuilt('highschool')) && count(g, 'excellence') < 2, text: () => 'Bildung wächst dauerhaft 20 % schneller.', apply: (g) => { g.mods.edu *= 1.2; } },
  { id: 'wells', name: 'Tiefbrunnen', tag: 'Dauerhaft', color: '#38a3d1', w: 0.5, cond: (g) => count(g, 'wells') < 2, text: () => 'Wasserversorgung dauerhaft +10 %.', apply: (g) => { g.mods.water *= 1.1; } },
  { id: 'firecode', name: 'Feuerwehrschule', tag: 'Dauerhaft', color: '#e8543f', w: 0.5, cond: (g) => g.countBuilt('services') > 0 && count(g, 'firecode') < 2, text: () => 'Brandrisiko dauerhaft −20 %.', apply: (g) => { g.mods.fire *= 0.8; } },
  // --- Tourismus
  { id: 'travelguide', name: 'Titelstory im Reiseführer', tag: 'Tourismus', color: '#ff8a1f', w: 0.7, cond: (g) => g.stats.tourism > 100, text: () => 'Touristen +80 % für 7 Tage.', apply: (g) => g.addEffect('tourism', 80, 7, 'Reiseführer') },
  { id: 'cruise', name: 'Kreuzfahrtschiff', tag: 'Tourismus', color: '#ff8a1f', w: 0.6, cond: (g) => ['coast', 'islands'].includes(g.opts.mapType) && pop(g) > 600, text: () => 'Ein Kreuzfahrtschiff legt an: +250 Touristen für 3 Tage.', apply: (g) => g.addEffect('tourismAdd', 250, 3, 'Kreuzfahrtschiff') },
  { id: 'filmset', name: 'Filmkulisse', tag: 'Tourismus', color: '#ff8a1f', w: 0.6, cond: (g) => pop(g) > 1000, text: () => '+2.000 € Drehgebühr, +150 Touristen für 5 Tage, Glück +2.', apply: (g) => { money(g, 2000); g.addEffect('tourismAdd', 150, 5, 'Filmkulisse'); g.addEffect('happy', 2, 5, 'Filmkulisse'); } },
  { id: 'doenerdeal', name: 'Mêrdîn’s Eröffnungsangebot', tag: 'Wahrzeichen', color: '#f2b01e', w: 0.8, cond: (g) => g.milestone >= 1 && !g.hasBuilt('doener') && !g.landmarkVouchers.has('doener'), text: () => 'Mêrdîn’s Dönerpalast zum halben Preis – und eine Woche Glück +2 auf die Vorfreude.', apply: (g) => { g.landmarkVouchers.add('doener'); g.addEffect('happy', 2, 7, 'Vorfreude auf Döner'); } },
  {
    id: 'surprise', name: 'Überraschungspaket', tag: 'Glück', color: '#f06fae', w: 0.6, text: () => 'Wer weiß, was drin ist? Geld, Züge oder ein Fest.',
    apply: (g) => {
      const r = g.rng();
      if (r < 0.4) { const v = round(4000 + pop(g) * 2); money(g, v); g.news('card', `Überraschung: ${fmtMoney(v)}!`, 'good'); }
      else if (r < 0.7 && g.isUnlocked('transit')) { g.transit.freeTrains += 2; g.news('card', 'Überraschung: zwei Züge im Depot!', 'good'); }
      else { g.addEffect('happy', 6, 4, 'Überraschungsfest'); g.news('card', 'Überraschung: ein spontanes Stadtfest!', 'good'); }
    },
  },
  // --- Jahreszeiten (nur mit Wettersystem)
  { id: 'saltstock', name: 'Streusalz-Vorrat', tag: 'Winter', color: '#9fb6c8', w: 1.0, cond: (g) => season(g) === 'winter', text: () => 'Freie Straßen trotz Schnee: Glück +3 für 7 Tage.', apply: (g) => g.addEffect('happy', 3, 7, 'Geräumte Straßen') },
  { id: 'icecream', name: 'Eisdielen-Sommer', tag: 'Sommer', color: '#ff8a1f', w: 1.0, cond: (g) => season(g) === 'summer', text: () => 'Gewerbenachfrage +25 und Glück +3 für 7 Tage.', apply: (g) => { g.addEffect('comDemand', 25, 7, 'Eisdielen-Sommer'); g.addEffect('happy', 3, 7, 'Eisdielen-Sommer'); } },
  { id: 'harvest', name: 'Erntedankfest', tag: 'Herbst', color: '#c06a2b', w: 1.0, cond: (g) => season(g) === 'autumn', text: () => 'Glück +3 und Gewerbe +15 für 6 Tage.', apply: (g) => { g.addEffect('happy', 3, 6, 'Erntedank'); g.addEffect('comDemand', 15, 6, 'Erntedank'); } },
  { id: 'springfest', name: 'Frühlingsfest', tag: 'Frühling', color: '#63c27a', w: 1.0, cond: (g) => season(g) === 'spring', text: () => 'Glück +5 für 5 Tage, Wohnnachfrage +15.', apply: (g) => { g.addEffect('happy', 5, 5, 'Frühlingsfest'); g.addEffect('resDemand', 15, 5, 'Frühlingsfest'); } },

  // --- Metro-Modus (werden nur dort angeboten)
  { id: 'm_line', metro: true, name: 'Neue Linie', tag: 'Metro', color: '#e8543f', w: 2.2, cond: (g) => g.transit.linesMax < 10, text: () => 'Ein zusätzlicher Linienplatz.', apply: (g) => { g.transit.linesMax++; } },
  { id: 'm_train', metro: true, name: 'Zwei Züge', tag: 'Metro', color: '#2f8fe0', w: 2.4, text: () => 'Zwei neue Züge im Depot.', apply: (g) => { g.transit.freeTrains += 2; } },
  { id: 'm_wagons', metro: true, name: 'Drei Waggons', tag: 'Metro', color: '#22a866', w: 2.2, text: () => 'Drei Waggons im Depot: +6 Plätze je Waggon.', apply: (g) => { g.transit.freeWagons += 3; } },
  { id: 'm_mix', metro: true, name: 'Zug mit zwei Waggons', tag: 'Metro', color: '#10a9a3', w: 1.6, text: () => 'Ein Zug und zwei Waggons.', apply: (g) => { g.transit.freeTrains += 1; g.transit.freeWagons += 2; } },
  { id: 'm_cash', metro: true, name: 'Infrastrukturgeld', tag: 'Metro', color: '#e3a925', w: 1.4, text: (g) => `${fmtMoney(round(5000 + (g.transit.deliveredTotal || 0) * 0.8))} für neue Gleise und Stationen.`, apply: (g) => money(g, round(5000 + (g.transit.deliveredTotal || 0) * 0.8)) },
  { id: 'm_speed', metro: true, name: 'Expressgleise', tag: 'Metro', color: '#10a9a3', w: 1.0, cond: (g) => count(g, 'm_speed') < 3, text: () => 'Alle Züge dauerhaft 15 % schneller.', apply: (g) => { g.mods.trainSpeed *= 1.15; } },
  { id: 'm_calm', metro: true, name: 'Ruhige Woche', tag: 'Metro', color: '#7d8a99', w: 1.0, text: () => 'Das nächste Viertel öffnet drei Tage später.', apply: (g) => { const st = P(g); if (st && st.metro) st.metro.next += 3; } },
  { id: 'm_tariff', metro: true, name: 'Doppelter Fahrpreis', tag: 'Metro', color: '#c98a0c', w: 1.0, text: () => 'Pulsbahn-Einnahmen +100 % für 7 Tage.', apply: (g) => g.addEffect('fareBonus', 1, 7, 'Doppelter Fahrpreis') },
];

for (const c of NEW_CARDS) {
  // Metro-Karten nur im Metro-Modus; normale Karten nie im Metro-Modus
  const base = c.cond;
  if (c.metro) c.cond = (g) => g.opts?.scenario === 'metro' && (!base || base(g));
  else c.cond = (g) => g.opts?.scenario !== 'metro' && (!base || base(g));
  if (!CARDS.find((x) => x.id === c.id)) CARDS.push(c);
}
export const S5_CARD_IDS = NEW_CARDS.map((c) => c.id);
