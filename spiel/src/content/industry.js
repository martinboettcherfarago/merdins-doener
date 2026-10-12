// Inhalte Wirtschaft & Logistik. Besitzer: System-Agent „Wirtschaft & Industrie".
// Schlüssel und Grundflächen sind ein Vertrag mit den Architektur-Agenten – nicht umbenennen.
// Felder wie input/output/throughput/storage/cargo werden von sim/systems/industry.js ausgewertet.
// Hier stehen außerdem der Warenkatalog (GOODS), die Kennzahlen der Warenwirtschaft (ECON)
// sowie Wochenkarten, Anzeiger-Ereignisse und Stadtfunk rund um Handel und Konjunktur.
import { BUILDINGS } from '../config.js';
import { CARDS, EVENTS, CHATTER } from '../sim/progress.js';
import { fmtMoney } from '../util.js';

// ---------------------------------------------------------------- Waren
// tier 0 = Rohstoff, 1 = verarbeitet, 2 = Endprodukt. price = Erlös der Stadt in € pro Tonne beim Export:
// Rohstoffe und Konsumgüter kommen von privaten Betrieben (die Stadt erhält die Ausfuhrabgabe), verarbeitete
// Waren aus städtischen Betrieben (voller Verkaufspreis). buy = Einkaufspreis, wenn die Verarbeitung Rohstoffe
// zukauft. market = Aufnahme des Weltmarkts in t/Tag bei Reichweite 1 und Preis 100 %.
export const GOODS = {
  crops: { name: 'Ernte', color: '#a3c13a', tier: 0, price: 0.35, buy: 1.0, market: 90, from: 'Bauernhöfe', desc: 'Getreide, Gemüse und Obst. Geht an Lebensmittelfabriken, Markthallen und frisch in die Läden.' },
  wood: { name: 'Rundholz', color: '#8b5a2b', tier: 0, price: 0.4, buy: 1.1, market: 80, from: 'Forstbetriebe', desc: 'Stämme aus dem Stadtwald. Das Sägewerk macht daraus Holzwaren.' },
  ore: { name: 'Erz', color: '#8f7d72', tier: 0, price: 0.45, buy: 1.25, market: 80, from: 'Bergwerke', desc: 'Eisenerz aus den Hügeln. Das Stahlwerk verhüttet es zu Stahl.' },
  oil: { name: 'Rohöl', color: '#4a4a58', tier: 0, price: 0.55, buy: 1.5, market: 90, from: 'Ölförderung', desc: 'Rohöl aus Pumpenböcken. Die Raffinerie macht Kunststoff und Treibstoff daraus.' },
  food: { name: 'Lebensmittel', color: '#e8892c', tier: 1, price: 2.4, market: 60, from: 'Lebensmittelfabrik', desc: 'Brot, Konserven, Molkereiprodukte. Ein Viertel des Warenbedarfs der Läden.' },
  timber: { name: 'Holzwaren', color: '#c9935a', tier: 1, price: 2.6, market: 50, from: 'Sägewerk', desc: 'Bretter und Möbelteile. Vorprodukt für Fabriken oder Export.' },
  steel: { name: 'Stahl', color: '#6e88a6', tier: 1, price: 3.2, market: 50, from: 'Stahlwerk', desc: 'Träger, Bleche, Draht. Vorprodukt für Fabriken oder Export.' },
  plastics: { name: 'Kunststoff', color: '#8e66c4', tier: 1, price: 3.6, market: 50, from: 'Raffinerie', desc: 'Granulat und Treibstoff. Vorprodukt für Fabriken oder Export.' },
  goods: { name: 'Konsumgüter', color: '#2f8fe0', tier: 2, price: 0.7, market: 110, from: 'Fabriken (Industriezone)', desc: 'Alles, was Läden verkaufen: Kleidung, Technik, Haushaltswaren.' },
};
export const GOOD_KEYS = Object.keys(GOODS);
export const RAW_KEYS = ['crops', 'wood', 'ore', 'oil'];
export const INPUT_KEYS = ['timber', 'steel', 'plastics']; // Vorprodukte für Fabriken
export const RAW_OF_SPEC = { farm: 'crops', forest: 'wood', mine: 'ore', oil: 'oil' };
export const SPEC_NAMES = { farm: 'Bauernhof', forest: 'Forstbetrieb', mine: 'Bergwerk', oil: 'Ölförderung' };
export const SPEC_PLURAL = { farm: 'Bauernhöfe', forest: 'Forstbetriebe', mine: 'Bergwerke', oil: 'Ölfelder' };
export const SPEC_DATIVE = { farm: 'Bauernhöfen', forest: 'Forstbetrieben', mine: 'Bergwerken', oil: 'Ölfeldern' };
export const SPEC_HOWTO = { farm: 'Industrie auf fruchtbarem Boden ausweisen', forest: 'Industrie im Wald ausweisen', mine: 'Industrie auf Erzvorkommen ausweisen', oil: 'Industrie auf Ölvorkommen ausweisen' };

// Kennzahlen der Warenwirtschaft (alles in Tonnen pro Tag).
export const ECON = {
  rawRate: { farm: 1.4, forest: 1.2, mine: 1.25, oil: 1.3 }, // je Beschäftigtem
  factoryRate: 1.1, // Konsumgüter je Beschäftigtem in Fabriken
  levelProd: [0, 1, 1.1, 1.22, 1.36, 1.5], // Produktivität je Stufe
  inputRate: 0.25, // Vorprodukte je Tonne Grundproduktion
  inputBoost: 0.4, // +40 % Ausstoß mit vollen Vorprodukten aus der Stadt
  comNeed: 0.8, // Warenbedarf je Beschäftigtem im Gewerbe
  comLevel: [0, 1, 1.05, 1.1, 1.16, 1.22],
  foodShare: 0.25, // Anteil Lebensmittel am Bedarf der Läden
  freshShare: 0.5, // so viel vom Lebensmittelbedarf kann frische Ernte vom Hof decken
  tourismNeed: 0.04, // Einkäufe je Tourist
  truckBase: 200, truckPerPop: 0.1, warehouseTruck: 80, // Lkw-Frachtkapazität über die Autobahn
  elasticity: 1.8, // Preiselastizität des Weltmarkts
  localShare: 0.7, // Erlösanteil, wenn städtische Betriebe in der Stadt verkaufen
  marketFee: 2.4, // Standgebühren der Markthallen je Tonne
  reachPerMilestone: 0.45, reachPerPop: 1 / 8000, // Reichweite des Handels
  truckLoad: 12, vanLoad: 4, // Tonnen je Lkw bzw. Lieferwagen
};

// ---------------------------------------------------------------- Gebäude
Object.assign(BUILDINGS, {
  warehouse: { name: 'Lagerhalle', cat: 'industry', size: [2, 2], cost: 6000, upkeep: 40, unlock: 2, storage: 400, jobs: 20, power_use: 6, noise: 0.5, desc: 'Puffert 400 t Waren: hält bei niedrigen Preisen zurück, beliefert Läden in der Nähe zuerst und bündelt Lieferungen (+80 t/Tag Lkw-Fracht).' },
  food_factory: { name: 'Lebensmittelfabrik', cat: 'industry', size: [2, 2], cost: 12000, upkeep: 90, unlock: 3, process: 'farm', input: 'crops', output: 'food', throughput: 200, yield: 0.6, jobs: 60, power_use: 18, water_use: 14, pollution: 0.6, desc: 'Verarbeitet bis zu 200 t Ernte am Tag zu Lebensmitteln – dreifacher Wert pro Tonne, und die Läden bekommen Ware aus der Stadt.' },
  sawmill: { name: 'Sägewerk', cat: 'industry', size: [2, 2], cost: 10000, upkeep: 75, unlock: 3, process: 'forest', input: 'wood', output: 'timber', throughput: 180, yield: 0.6, jobs: 50, power_use: 14, noise: 1, pollution: 0.5, desc: 'Macht aus Rundholz Bretter und Möbelteile – Vorprodukte, die Fabriken 40 % produktiver machen.' },
  steelworks: { name: 'Stahlwerk', cat: 'industry', size: [3, 2], cost: 24000, upkeep: 170, unlock: 4, process: 'mine', input: 'ore', output: 'steel', throughput: 320, yield: 0.55, jobs: 120, power_use: 40, water_use: 20, pollution: 3, noise: 1.2, desc: 'Verhüttet bis zu 320 t Erz am Tag. Viele Jobs, viel Rauch, wertvoller Stahl.' },
  refinery: { name: 'Raffinerie', cat: 'industry', size: [3, 2], cost: 26000, upkeep: 180, unlock: 4, process: 'oil', input: 'oil', output: 'plastics', throughput: 340, yield: 0.55, jobs: 110, power_use: 30, water_use: 24, pollution: 3.5, noise: 1, desc: 'Verarbeitet Rohöl zu Kunststoff und Treibstoff – das wertvollste Exportgut.' },
  cargo_rail: { name: 'Güterbahnhof', cat: 'industry', size: [3, 2], cost: 20000, upkeep: 120, unlock: 3, cargo: 900, priceBonus: 0.06, reach: 0.6, jobs: 40, power_use: 10, noise: 1.3, desc: 'Bis zu 900 t Fracht am Tag per Zug: entlastet die Autobahn, erschließt neue Märkte und bringt +6 % Exportpreis.' },
  cargo_harbor: { name: 'Frachthafen', cat: 'industry', size: [3, 3], cost: 36000, upkeep: 200, unlock: 4, cargo: 2000, priceBonus: 0.12, reach: 1.2, jobs: 80, needsWater: true, power_use: 16, noise: 1.4, desc: 'Containerhafen am Wasser: 2.000 t Fracht am Tag, Zugang zum Weltmarkt und +12 % Exportpreis.' },
  market_hall: { name: 'Markthalle', cat: 'industry', size: [2, 1], cost: 5000, upkeep: 30, unlock: 2, comBoost: 8, lvRadius: 6, goodsDemand: 40, jobs: 15, tourism: 20, desc: 'Verkauft bis zu 40 t regionale Ernte und Lebensmittel am Tag (Standgebühren), lockt Besucher an und belebt das Gewerbe im Umkreis.' },
});

// ---------------------------------------------------------------- Hilfen für Karten und Ereignisse
const ind = (g) => g.ext.industry || null;
const tot = (g) => (ind(g) && ind(g).tot) || {};
const produces = (g, k) => ((ind(g) && ind(g).flow[k] && ind(g).flow[k].prod) || 0) > 1;
const hasKey = (g, key) => g.hasBuilt(key);
const shockGood = (g, k, value, days, text) => {
  const st = ind(g);
  if (!st || !st.market[k]) return;
  st.market[k].shock = value;
  st.market[k].shockDays = days;
  if (text) g.news('economy', text, value >= 0 ? 'good' : 'bad');
};

// ---------------------------------------------------------------- Wochenkarten
CARDS.push(
  { id: 'ind_export', name: 'Exportoffensive', tag: 'Handel', color: '#2f8fe0', w: 1.3, cond: (g) => (tot(g).exportT || 0) > 30, text: () => 'Alle Exportpreise +15 % für 10 Tage.', apply: (g) => g.addEffect('ecoPrice', 0.15, 10, 'Exportoffensive') },
  { id: 'ind_fta', name: 'Freihandelsabkommen', tag: 'Dauerhaft', color: '#10a9a3', w: 1, cond: (g) => g.milestone >= 2 && (g.cardCount.ind_fta || 0) < 2, text: () => 'Der Weltmarkt nimmt dauerhaft 20 % mehr Waren aus deiner Stadt ab.', apply: (g) => { if (ind(g)) ind(g).perm.market *= 1.2; } },
  { id: 'ind_automation', name: 'Automatisierung', tag: 'Dauerhaft', color: '#6e88a6', w: 0.9, cond: (g) => ['food_factory', 'sawmill', 'steelworks', 'refinery', 'warehouse', 'cargo_rail', 'cargo_harbor'].some((k) => g.hasBuilt(k)) && (g.cardCount.ind_automation || 0) < 2, text: () => 'Städtische Betriebe (Verarbeitung, Lager, Güterumschlag) arbeiten dauerhaft 15 % schneller.', apply: (g) => { if (ind(g)) ind(g).perm.proc *= 1.15; } },
  { id: 'ind_logistics', name: 'Logistik-Förderung', tag: 'Handel', color: '#c98a0c', w: 1.1, cond: (g) => g.stats.pop > 300, text: () => 'Frachtkapazität +40 % für 14 Tage – mehr Exporte und Importe.', apply: (g) => g.addEffect('ecoFreight', 0.4, 14, 'Logistik-Förderung') },
  { id: 'ind_storage', name: 'Lager-Zuschuss', tag: 'Dauerhaft', color: '#8f5ad8', w: 0.9, cond: (g) => g.hasBuilt('warehouse') && (g.cardCount.ind_storage || 0) < 2, text: () => 'Alle Lagerhallen fassen dauerhaft 50 % mehr.', apply: (g) => { if (ind(g)) ind(g).perm.storage *= 1.5; } },
  { id: 'ind_buylocal', name: 'Kauf regional!', tag: 'Gewerbe', color: '#a3c13a', w: 1.1, cond: (g) => g.stats.jobsByZone[2] > 60, text: () => 'Kampagne für Waren aus der Stadt: Läden mit Ware aus der Region +4 Glück, Gewerbenachfrage +10 für 10 Tage.', apply: (g) => { g.addEffect('ecoLocal', 4, 10, 'Kauf regional!'); g.addEffect('comDemand', 10, 10, 'Kauf regional!'); } },
);

// ---------------------------------------------------------------- Ereignisse im Anzeiger
EVENTS.push(
  {
    id: 'ind_order', title: 'Großauftrag aus Übersee', minPop: 600,
    cond: (g) => (tot(g).exportT || 0) > 60,
    text: 'Ein Handelskonzern will zehn Tage lang deutlich mehr Konsumgüter abnehmen. Die Fabriken müssten Sonderschichten fahren.',
    options: [
      { label: 'Annehmen', hint: () => 'Weltmarkt-Nachfrage nach Konsumgütern +70 % für 10 Tage, Industrie-Glück −3', apply: (g) => { g.addEffect('ecoMarket:goods', 0.7, 10, 'Großauftrag'); g.addEffect('ecoHappy', -3, 10, 'Sonderschichten'); } },
      { label: 'Ablehnen', hint: () => 'Nichts passiert.', apply: () => {} },
    ],
  },
  {
    id: 'ind_strike', title: 'Streik in den Fabriken', minPop: 800,
    cond: (g) => g.stats.jobsByZone[3] > 200,
    text: 'Die Gewerkschaft ruft zum Warnstreik auf. Sie fordert höhere Löhne für die Beschäftigten der Industrie.',
    options: [
      { label: 'Lohnzuschuss zahlen', hint: (g) => `−${fmtMoney(1500 + g.stats.jobsByZone[3] * 4)}, Industrie-Glück +3 für 10 Tage`, apply: (g) => { g.money -= 1500 + g.stats.jobsByZone[3] * 4; g.addEffect('ecoHappy', 3, 10, 'Lohnzuschuss'); } },
      { label: 'Hart bleiben', hint: () => 'Fabriken 3 Tage nur halb so produktiv, Industrie-Glück −5 für 6 Tage', apply: (g) => { g.addEffect('ecoProd:factory', -0.5, 3, 'Streik'); g.addEffect('ecoHappy', -5, 6, 'Streik'); } },
    ],
  },
  {
    id: 'ind_oil', title: 'Ölkrise am Weltmarkt', minPop: 500,
    cond: (g) => produces(g, 'oil') || produces(g, 'plastics'),
    text: 'Ein Förderstopp im Ausland lässt den Ölpreis explodieren. Gut für die eigene Ölförderung – schlecht für alle, die tanken müssen.',
    options: [
      { label: 'Spritpreise subventionieren', hint: (g) => `−${fmtMoney(2000 + g.stats.pop)}, Öl- und Kunststoffpreise +55 % für 9 Tage`, apply: (g) => { g.money -= 2000 + g.stats.pop; shockGood(g, 'oil', 0.55, 9); shockGood(g, 'plastics', 0.4, 9); } },
      { label: 'Markt laufen lassen', hint: () => 'Öl- und Kunststoffpreise +55 % für 9 Tage, Glück −3 für 6 Tage', apply: (g) => { shockGood(g, 'oil', 0.55, 9); shockGood(g, 'plastics', 0.4, 9); g.addEffect('happy', -3, 6, 'Spritpreise'); } },
    ],
  },
  {
    id: 'ind_port', title: 'Hafenarbeiter fordern Ausbau', minPop: 1500,
    cond: (g) => g.hasBuilt('cargo_harbor'),
    text: 'Im Frachthafen stauen sich die Container. Die Hafenarbeiter wollen neue Kräne.',
    options: [
      { label: 'Kräne kaufen', hint: () => '−9.000 €, Hafenkapazität dauerhaft +30 %', apply: (g) => { g.money -= 9000; if (ind(g)) ind(g).perm.harbor *= 1.3; } },
      { label: 'Vertrösten', hint: () => 'Frachtkapazität −25 % für 5 Tage (Bummelstreik)', apply: (g) => g.addEffect('ecoFreight', -0.25, 5, 'Bummelstreik im Hafen') },
    ],
  },
  {
    id: 'ind_fair', title: 'Handelsmesse in der Region', minPop: 700,
    text: 'Auf der Regionalmesse könnte sich die Stadt als Wirtschaftsstandort präsentieren. Ein Stand ist nicht billig.',
    options: [
      { label: 'Stand buchen', hint: () => '−4.000 €, Weltmarkt-Nachfrage +25 % für 14 Tage, Gewerbe- und Industrienachfrage +10 für 7 Tage', apply: (g) => { g.money -= 4000; g.addEffect('ecoMarket', 0.25, 14, 'Handelsmesse'); g.addEffect('comDemand', 10, 7, 'Handelsmesse'); g.addEffect('indDemand', 10, 7, 'Handelsmesse'); } },
      { label: 'Verzichten', hint: () => 'Nichts passiert.', apply: () => {} },
    ],
  },
  {
    id: 'ind_drought', title: 'Dürre im Umland', minPop: 400,
    cond: (g) => produces(g, 'crops') || g.hasBuilt('food_factory'),
    text: 'Seit Wochen kein Regen: Die Ernte im ganzen Land fällt mager aus. Lebensmittel werden teurer.',
    options: [
      { label: 'Bewässerung fördern', hint: () => '−3.000 €, Ernte- und Lebensmittelpreise +45 % für 10 Tage', apply: (g) => { g.money -= 3000; shockGood(g, 'crops', 0.45, 10); shockGood(g, 'food', 0.35, 10); } },
      { label: 'Abwarten', hint: () => 'Preise +45 % für 10 Tage, aber Bauernhöfe ernten 8 Tage lang 35 % weniger', apply: (g) => { shockGood(g, 'crops', 0.45, 10); shockGood(g, 'food', 0.35, 10); g.addEffect('ecoProd:farm', -0.35, 8, 'Dürre'); } },
    ],
  },
  {
    id: 'ind_stimulus', title: 'Konjunkturprogramm des Landes', minPop: 600,
    cond: (g) => ind(g) && ind(g).cycle.value < -0.25,
    text: 'Die Wirtschaft schwächelt. Das Land legt ein Konjunkturprogramm auf – Städte müssen sich mit einem Eigenanteil beteiligen.',
    options: [
      { label: 'Mitmachen', hint: (g) => `−${fmtMoney(3000 + g.stats.pop * 1.5)}, die Konjunktur zieht spürbar an`, apply: (g) => { g.money -= 3000 + g.stats.pop * 1.5; if (ind(g)) ind(g).cycle.shock += 0.45; } },
      { label: 'Sparen', hint: () => 'Nichts passiert – die Flaute dauert an.', apply: () => {} },
    ],
  },
  {
    id: 'ind_dumping', title: 'Billigstahl überschwemmt den Markt', minPop: 1000,
    cond: (g) => produces(g, 'steel') || produces(g, 'ore'),
    text: 'Ein ausländischer Konzern verkauft Stahl unter Herstellungskosten. Die Stahlpreise brechen ein.',
    options: [
      { label: 'Beim Land protestieren', hint: () => '−1.500 €, Stahl- und Erzpreise nur −15 % für 8 Tage', apply: (g) => { g.money -= 1500; shockGood(g, 'steel', -0.15, 8); shockGood(g, 'ore', -0.15, 8); } },
      { label: 'Hinnehmen', hint: () => 'Stahl- und Erzpreise −35 % für 10 Tage', apply: (g) => { shockGood(g, 'steel', -0.35, 10); shockGood(g, 'ore', -0.3, 10); } },
    ],
  },
  {
    id: 'ind_trucks', title: 'Anwohner klagen über Lkw-Lärm', minPop: 1200,
    cond: (g) => (tot(g).trucksDay || 0) > 120,
    text: 'Nachts donnern Lastwagen durch die Wohnstraßen. Eine Bürgerinitiative fordert ein Nachtfahrverbot.',
    options: [
      { label: 'Nachtfahrverbot', hint: () => 'Lkw-Frachtkapazität −20 % für 14 Tage, Glück +3 für 14 Tage', apply: (g) => { g.addEffect('ecoTruck', -0.2, 14, 'Nachtfahrverbot'); g.addEffect('happy', 3, 14, 'Nachtruhe für Anwohner'); } },
      { label: 'Abwimmeln', hint: () => 'Glück −3 für 7 Tage', apply: (g) => g.addEffect('happy', -3, 7, 'Lkw-Ärger') },
    ],
  },
  {
    id: 'ind_startup', title: 'Logistik-Start-up sucht Partner', minPop: 1500,
    text: 'Ein junges Unternehmen will mit Software und Lastenrädern die Lieferketten der Stadt optimieren.',
    options: [
      { label: 'Fördern', hint: () => '−5.000 €, Frachtkapazität +25 % für 21 Tage', apply: (g) => { g.money -= 5000; g.addEffect('ecoFreight', 0.25, 21, 'Logistik-Start-up'); } },
      { label: 'Kein Interesse', hint: () => 'Nichts passiert.', apply: () => {} },
    ],
  },
);

// ---------------------------------------------------------------- Stadtfunk
CHATTER.unshift(
  { when: (g) => (tot(g).shortCom || 0) > 0.12, texts: ['Im Supermarkt sind schon wieder die Regale leer.', 'Mein Laden bekommt keine Ware mehr. Wo sind die Lieferwagen?', 'Drei Geschäfte abgeklappert – keine Glühbirnen. Wir brauchen mehr Industrie!', 'Ohne Nachschub kann ich meinen Laden bald dichtmachen.'] },
  { when: (g) => (tot(g).salesInd ?? 1) < 0.8 && (tot(g).indProd || 0) > 20, texts: ['Unser Hof ist voll mit Paletten, die keiner abholt.', 'Die Fabrik produziert für die Halde. Wir brauchen Abnehmer!', 'Kurzarbeit im Werk – die Ware wird nicht verkauft.'] },
  { when: (g) => (tot(g).freightUse || 0) > 0.95, texts: ['Auf der Autobahn stehen die Lastwagen Stoßstange an Stoßstange.', 'Ein Güterbahnhof würde die Autobahn entlasten.', 'Der Lkw-Stau an der Auffahrt kostet uns jeden Tag Aufträge.'] },
  { when: (g) => ind(g) && ind(g).cycle.value > 0.5, texts: ['Boom! Mein Chef hat endlich die Löhne erhöht.', 'Überall Stellenanzeigen. Die Wirtschaft brummt.', 'Die Auftragsbücher sind voll bis Weihnachten.'] },
  { when: (g) => ind(g) && ind(g).cycle.value < -0.45, texts: ['Rezession… alle sparen, keiner kauft.', 'Bei uns in der Firma wird über Kurzarbeit geredet.', 'Die Zeiten sind hart. Hoffentlich zieht die Konjunktur bald wieder an.'] },
  { when: (g) => (tot(g).exportT || 0) > 200, texts: ['Unsere Waren gehen bis nach Übersee. Stolz auf meine Stadt!', 'Made in unserer Stadt – das ist ein Gütesiegel.', 'Der Export läuft wie geschmiert.'] },
  { when: (g) => g.hasBuilt('market_hall'), texts: ['Auf dem Wochenmarkt in der Markthalle gibt es die besten Tomaten.', 'Regionales Gemüse aus der Markthalle – schmeckt einfach besser.'] },
  { when: (g) => g.hasBuilt('cargo_harbor'), texts: ['Vom Kai aus sieht man die Containerschiffe kommen. Fernweh!', 'Die Kräne im Frachthafen leuchten nachts wie Giraffen aus Licht.'] },
  { when: (g) => g.hasBuilt('cargo_rail'), texts: ['Nachts rattern die Güterzüge – ich finde das beruhigend.', 'Seit es den Güterbahnhof gibt, ist weniger Lkw-Verkehr.'] },
  { when: (g) => g.hasBuilt('steelworks'), texts: ['Wenn im Stahlwerk abgestochen wird, glüht der ganze Himmel orange.', 'Das Stahlwerk: laut, dreckig, aber 120 Jobs.'] },
  { when: (g) => (tot(g).trucksDay || 0) > 150, texts: ['Schon wieder ein Laster in unserer Spielstraße.', 'Die Lieferwagen parken jeden Morgen in zweiter Reihe.'] },
);
