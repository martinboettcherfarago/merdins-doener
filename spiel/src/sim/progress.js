// Fortschritt: Wochenkarten, Ereignisse mit Entscheidungen, Stadtfunk (Bürgerstimmen).
import { BUILDINGS, MILESTONES } from '../config.js';
import { fmtMoney, citizenName, pick } from '../util.js';

const grantAmount = (g) => Math.round((6000 + g.stats.pop * 3.2) / 500) * 500;

export const CARDS = [
  { id: 'grant', name: 'Fördermittel', tag: 'Geld', color: '#e3a925', w: 3, text: (g) => `${fmtMoney(grantAmount(g))} vom Land – sofort.`, apply: (g) => { g.money += grantAmount(g); } },
  { id: 'line', name: 'Neue Linie', tag: 'Pulsbahn', color: '#e8543f', w: 2.4, cond: (g) => g.isUnlocked('transit') && g.transit.linesMax < 10, text: () => 'Ein zusätzlicher Linienplatz für die Pulsbahn.', apply: (g) => { g.transit.linesMax++; } },
  { id: 'trains', name: 'Zwei Züge', tag: 'Pulsbahn', color: '#2f8fe0', w: 2.2, cond: (g) => g.isUnlocked('transit'), text: () => 'Zwei Züge gratis im Depot. Setze sie im Linienfenster ein.', apply: (g) => { g.transit.freeTrains += 2; } },
  { id: 'wagons', name: 'Waggons', tag: 'Pulsbahn', color: '#22a866', w: 2, cond: (g) => g.isUnlocked('transit'), text: () => 'Drei Waggons gratis: +6 Plätze je Waggon.', apply: (g) => { g.transit.freeWagons += 3; } },
  { id: 'festival', name: 'Stadtfest', tag: 'Glück', color: '#f06fae', w: 2, text: () => '+8 Glück in der ganzen Stadt für 7 Tage.', apply: (g) => g.addEffect('happy', 8, 7, 'Stadtfest') },
  { id: 'boom', name: 'Konjunktur', tag: 'Geld', color: '#e3a925', w: 1.6, cond: (g) => g.stats.pop > 200, text: () => '+25 % Steuereinnahmen für 7 Tage.', apply: (g) => g.addEffect('taxMul', 0.25, 7, 'Konjunktur') },
  { id: 'immigration', name: 'Zuzugswelle', tag: 'Wachstum', color: '#63c27a', w: 2, text: () => 'Wohnnachfrage +35 für 6 Tage.', apply: (g) => g.addEffect('resDemand', 35, 6, 'Zuzugswelle') },
  { id: 'investors', name: 'Investoren', tag: 'Wachstum', color: '#4c9be8', w: 1.8, cond: (g) => g.stats.pop > 150, text: () => 'Gewerbe- und Büronachfrage +30 für 6 Tage.', apply: (g) => { g.addEffect('comDemand', 30, 6, 'Investoren'); g.addEffect('offDemand', 30, 6, 'Investoren'); } },
  { id: 'admin', name: 'Schlanke Verwaltung', tag: 'Dauerhaft', color: '#7d8a99', w: 1.4, cond: (g) => (g.cardCount.admin || 0) < 3, text: () => 'Unterhaltskosten dauerhaft −8 %.', apply: (g) => { g.mods.upkeep *= 0.92; } },
  { id: 'grid', name: 'Smart Grid', tag: 'Dauerhaft', color: '#f2b01e', w: 1.4, cond: (g) => (g.cardCount.grid || 0) < 3, text: () => 'Alle Kraftwerke liefern dauerhaft 12 % mehr Strom.', apply: (g) => { g.mods.power *= 1.12; } },
  { id: 'pipes', name: 'Rohrsanierung', tag: 'Dauerhaft', color: '#38a3d1', w: 1.3, cond: (g) => (g.cardCount.pipes || 0) < 3, text: () => 'Wasserversorgung dauerhaft +12 %.', apply: (g) => { g.mods.water *= 1.12; } },
  { id: 'teachers', name: 'Lehrkräfte', tag: 'Dauerhaft', color: '#8f5ad8', w: 1.3, cond: (g) => g.milestone >= 1 && (g.cardCount.teachers || 0) < 2, text: () => 'Bildung wächst dauerhaft 30 % schneller.', apply: (g) => { g.mods.edu *= 1.3; } },
  { id: 'firesafety', name: 'Brandschutz', tag: 'Dauerhaft', color: '#e8543f', w: 1.1, cond: (g) => (g.cardCount.firesafety || 0) < 2, text: () => 'Brandrisiko dauerhaft −30 %.', apply: (g) => { g.mods.fire *= 0.7; } },
  { id: 'roadcrew', name: 'Straßenbaukolonne', tag: 'Bauen', color: '#5f6b78', w: 1.6, text: () => 'Straßen kosten 7 Tage lang nur die Hälfte.', apply: (g) => g.addEffect('roadCost', -0.5, 7, 'Straßenbaukolonne') },
  { id: 'express', name: 'Expresszüge', tag: 'Pulsbahn', color: '#10a9a3', w: 1.2, cond: (g) => g.isUnlocked('transit') && (g.cardCount.express || 0) < 2, text: () => 'Pulsbahn-Züge dauerhaft 20 % schneller.', apply: (g) => { g.mods.trainSpeed *= 1.2; } },
  { id: 'filters', name: 'Filteranlagen', tag: 'Dauerhaft', color: '#22a866', w: 1.2, cond: (g) => g.stats.jobsByZone[3] > 40 && (g.cardCount.filters || 0) < 3, text: () => 'Industrie-Abgase dauerhaft −15 %.', apply: (g) => { g.mods.pollution *= 0.85; } },
  { id: 'tourism', name: 'Werbekampagne', tag: 'Tourismus', color: '#ff8a1f', w: 1.1, cond: (g) => g.stats.tourism > 50, text: () => 'Touristen +50 % für 7 Tage.', apply: (g) => g.addEffect('tourism', 50, 7, 'Werbekampagne') },
];

// Wahrzeichen-Karten werden dynamisch erzeugt.
function landmarkCards(g) {
  const out = [];
  for (const [key, d] of Object.entries(BUILDINGS)) {
    if (!d.landmark) continue;
    if (g.landmarkVouchers.has(key) || g.hasBuilt(key)) continue;
    if (g.milestone < d.unlock - 1) continue;
    out.push({
      id: 'lm:' + key, name: d.name, tag: 'Wahrzeichen', color: '#c06a2b', w: 1.5, landmark: key,
      text: () => `Schaltet ${d.name} frei – zum halben Preis. ${d.desc}`,
      apply: (gg) => { gg.landmarkVouchers.add(key); },
    });
  }
  return out;
}

export function cardById(g, id) {
  return CARDS.find((c) => c.id === id) || landmarkCards(g).find((c) => c.id === id) || null;
}

export function offerCards(g) {
  const pool = [...CARDS.filter((c) => !c.cond || c.cond(g)), ...landmarkCards(g)];
  const chosen = [];
  for (let k = 0; k < 3 && pool.length; k++) {
    let total = pool.reduce((a, c) => a + c.w, 0);
    let r = g.rng() * total;
    let idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) { r -= pool[i].w; if (r <= 0) { idx = i; break; } }
    chosen.push(pool[idx].id);
    pool.splice(idx, 1);
  }
  g.pendingCards = chosen;
  g.emit('cards', chosen);
}

export function chooseCard(g, id) {
  const c = cardById(g, id);
  g.pendingCards = null;
  if (!c) return;
  c.apply(g);
  g.cardCount[c.id] = (g.cardCount[c.id] || 0) + 1;
  g.cardsTaken.push({ id: c.id, day: g.day() });
  g.news('card', `Wochenkarte gewählt: ${c.name}.`, 'good');
  g.emit('cardChosen', c);
}

// --- Ereignisse
export const EVENTS = [
  {
    id: 'mall', title: 'Ein Investor klopft an', minPop: 300,
    text: 'Eine Handelskette möchte sich ansiedeln und bietet eine Spende – im Gegenzug will sie zwei Wochen lang Steuernachlass.',
    options: [
      { label: 'Annehmen', hint: (g) => `+${fmtMoney(8000 + g.stats.pop * 2)}, Gewerbesteuer −40 % für 14 Tage, Gewerbenachfrage +25`, apply: (g) => { g.money += 8000 + g.stats.pop * 2; g.addEffect('comTax', -0.4, 14, 'Steuerdeal'); g.addEffect('comDemand', 25, 10, 'Handelskette'); } },
      { label: 'Ablehnen', hint: () => 'Nichts passiert.', apply: () => {} },
    ],
  },
  {
    id: 'storm', title: 'Sturmwarnung', minPop: 150,
    text: 'Ein Orkan zieht über die Region. Die Stadtwerke wollen Leitungen vorsorglich sichern.',
    options: [
      { label: 'Sichern lassen', hint: () => '−4.000 €', apply: (g) => { g.money -= 4000; } },
      { label: 'Riskieren', hint: () => 'Möglicherweise 2 Tage nur 55 % Kraftwerksleistung', apply: (g) => { if (g.rng() < 0.65) { g.addEffect('powerMul', -0.45, 2, 'Sturmschäden'); g.news('event', 'Der Sturm hat Stromleitungen beschädigt.', 'bad'); } else g.news('event', 'Glück gehabt – der Sturm ist vorbeigezogen.', 'good'); } },
    ],
  },
  {
    id: 'heat', title: 'Hitzewelle', minPop: 200,
    text: 'Seit Tagen über 35 Grad. Alle wollen duschen, gießen und baden.',
    options: [
      { label: 'Wasser rationieren', hint: () => 'Glück −4 für 3 Tage', apply: (g) => g.addEffect('happy', -4, 3, 'Wasserrationierung') },
      { label: 'Laufen lassen', hint: () => 'Wasserverbrauch +35 % für 3 Tage', apply: (g) => g.addEffect('waterUse', 0.35, 3, 'Hitzewelle') },
    ],
  },
  {
    id: 'concert', title: 'Open-Air-Konzert', minPop: 500,
    text: 'Eine bekannte Band möchte am Wochenende in deiner Stadt spielen.',
    options: [
      { label: 'Bühne bezahlen', hint: () => '−6.000 €, Glück +6 und Touristen +120 für 5 Tage', apply: (g) => { g.money -= 6000; g.addEffect('happy', 6, 5, 'Konzert'); g.addEffect('tourismAdd', 120, 5, 'Konzert'); } },
      { label: 'Absagen', hint: () => 'Glück −2 für 3 Tage', apply: (g) => g.addEffect('happy', -2, 3, 'Konzert abgesagt') },
    ],
  },
  {
    id: 'strike', title: 'Streik bei der Müllabfuhr', minPop: 250, cond: (g) => g.countBuilt('garbage') > 0,
    text: 'Die Müllwerker fordern mehr Lohn und legen die Arbeit nieder.',
    options: [
      { label: 'Lohnerhöhung zahlen', hint: () => '−5.000 €', apply: (g) => { g.money -= 5000; } },
      { label: 'Aussitzen', hint: () => 'Müllabfuhr 4 Tage stark eingeschränkt', apply: (g) => g.addEffect('garbageCov', -0.6, 4, 'Müllstreik') },
    ],
  },
  {
    id: 'partner', title: 'Städtepartnerschaft', minPop: 400,
    text: 'Eine Stadt am Meer möchte Partnerstadt werden. Das kostet ein Fest, bringt aber Besucher.',
    options: [
      { label: 'Feiern', hint: () => '−3.000 €, Touristen +80 für 10 Tage, Glück +3', apply: (g) => { g.money -= 3000; g.addEffect('tourismAdd', 80, 10, 'Partnerstadt'); g.addEffect('happy', 3, 10, 'Partnerstadt'); } },
      { label: 'Freundlich ablehnen', hint: () => 'Nichts passiert.', apply: () => {} },
    ],
  },
  {
    id: 'startup', title: 'Gründerszene', minPop: 1200, cond: (g) => g.isUnlocked('zone4'),
    text: 'Junge Firmen suchen Büros. Ein Gründerzentrum würde helfen.',
    options: [
      { label: 'Fördern', hint: () => '−7.000 €, Büronachfrage +45 für 8 Tage', apply: (g) => { g.money -= 7000; g.addEffect('offDemand', 45, 8, 'Gründerzentrum'); } },
      { label: 'Abwarten', hint: () => 'Nichts passiert.', apply: () => {} },
    ],
  },
  {
    id: 'green', title: 'Bürgerinitiative „Mehr Grün"', minPop: 300,
    text: 'Hunderte unterschreiben für mehr Parks in der Stadt.',
    options: [
      { label: 'Versprechen', hint: () => 'Parks 7 Tage kostenlos', apply: (g) => g.addEffect('parkFree', 1, 7, 'Parkoffensive') },
      { label: 'Ignorieren', hint: () => 'Glück −4 für 5 Tage', apply: (g) => g.addEffect('happy', -4, 5, 'Enttäuschte Initiative') },
    ],
  },
  {
    id: 'flu', title: 'Grippewelle', minPop: 600,
    text: 'Die Wartezimmer sind voll. Das Gesundheitsamt rät zur Impfkampagne.',
    options: [
      { label: 'Impfkampagne', hint: () => '−5.000 €', apply: (g) => { g.money -= 5000; } },
      { label: 'Nichts tun', hint: () => 'Gesundheitsversorgung −35 % und Glück −3 für 4 Tage', apply: (g) => { g.addEffect('healthCov', -0.35, 4, 'Grippewelle'); g.addEffect('happy', -3, 4, 'Grippewelle'); } },
    ],
  },
  {
    id: 'doener', title: 'Döner-Festival', minPop: 350,
    text: 'Mêrdîn lädt zum großen Chili-Cheese-Döner-Festival auf dem Marktplatz ein.',
    options: [
      { label: 'Unterstützen', hint: () => '−2.500 €, Glück +5 und Gewerbenachfrage +20 für 5 Tage', apply: (g) => { g.money -= 2500; g.addEffect('happy', 5, 5, 'Döner-Festival'); g.addEffect('comDemand', 20, 5, 'Döner-Festival'); } },
      { label: 'Keine Zeit', hint: () => 'Nichts passiert.', apply: () => {} },
    ],
  },
  {
    id: 'traffic', title: 'Stau-Beschwerden', minPop: 800, cond: (g) => g.stats.trafficFlow < 0.75,
    text: 'Pendler beschweren sich über den täglichen Stau. Die Zeitung fordert Lösungen.',
    options: [
      { label: 'Verkehrsgutachten', hint: () => '−3.000 €, Pulsbahn-Fahrgäste +25 % für 7 Tage', apply: (g) => { g.money -= 3000; g.addEffect('ridership', 0.25, 7, 'Kampagne „Steig um"'); } },
      { label: 'Abwiegeln', hint: () => 'Glück −3 für 4 Tage', apply: (g) => g.addEffect('happy', -3, 4, 'Stau-Frust') },
    ],
  },
];

export function maybeEvent(g) {
  if (g.pendingEvent || g.pendingCards || g.milestone < 1 || g.sandboxNoEvents) return;
  if (g.day() < g.nextEventDay) return;
  const pool = EVENTS.filter((e) => g.stats.pop >= e.minPop && (!e.cond || e.cond(g)) && e.id !== g.lastEventId);
  if (!pool.length) return;
  const ev = pick(g.rng, pool);
  g.pendingEvent = ev.id;
  g.lastEventId = ev.id;
  g.nextEventDay = g.day() + 6 + Math.floor(g.rng() * 7);
  g.emit('event', ev);
}

export function resolveEvent(g, optIndex) {
  const ev = EVENTS.find((e) => e.id === g.pendingEvent);
  g.pendingEvent = null;
  if (!ev) return;
  const opt = ev.options[optIndex];
  if (opt) opt.apply(g);
  g.emit('eventResolved', ev, optIndex);
}

// --- Stadtfunk: Bürger melden sich zu Wort
export const CHATTER = [
  { when: (g) => g.stats.unpowered > 2, texts: ['Schon wieder kein Strom! Mein Kühlschrank taut ab. #Stromausfall', 'Kerzenlicht ist romantisch, aber nicht jeden Abend. Wann kommt der Strom?', 'Ohne Strom kein WLAN. Ohne WLAN kein Leben.'] },
  { when: (g) => g.stats.unwatered > 2, texts: ['Kein Wasser aus dem Hahn. Ich dusche jetzt mit Mineralwasser.', 'Die Wasserversorgung reicht nicht. Bitte mehr Pumpwerke!'] },
  { when: (g) => g.stats.garbageProb > 3, texts: ['Vor meinem Haus stapeln sich die Mülltüten. Es riecht…', 'Die Müllabfuhr war seit Tagen nicht da. #Müllberg'] },
  { when: (g) => g.stats.trafficFlow < 0.7, texts: ['45 Minuten für drei Kreuzungen. Ich steige aufs Fahrrad um.', 'Stau, Stau, Stau. Eine Pulsbahn-Linie wäre schön.', 'Ich kenne jetzt jedes Nummernschild auf meinem Arbeitsweg.'] },
  { when: (g) => g.taxes[1] >= 14, texts: ['Die Steuern sind viel zu hoch! Ich überlege wegzuziehen.', 'Mehr Steuern, aber wofür?'] },
  { when: (g) => g.taxes[1] <= 7, texts: ['Niedrige Steuern – hier lässt es sich leben!'] },
  { when: (g) => g.stats.unemployment > 0.12, texts: ['Ich suche seit Wochen Arbeit. Gibt es hier keine Firmen?', 'Zu wenig Jobs in der Stadt. Wir brauchen Gewerbe und Industrie.'] },
  { when: (g) => g.stats.happiness > 75, texts: ['Ich liebe diese Stadt! ❤', 'Sonnenschein, Parks und nette Nachbarn. Perfekt.', 'Bester Bürgermeister aller Zeiten.'] },
  { when: (g) => g.stats.happiness < 40 && g.stats.pop > 100, texts: ['Die Stimmung in der Stadt ist mies. Irgendwer muss was tun.', 'Ich packe die Umzugskartons.'] },
  { when: (g) => g.stats.ridersToday > 40, texts: ['Mit der Pulsbahn in 6 Minuten zur Arbeit. Herrlich!', 'Die Aussicht aus der Hochbahn ist der Wahnsinn.', 'Ich habe heute in der Pulsbahn meine Jugendliebe getroffen.'] },
  { when: (g) => g.transit.lines.length && [...g.transit.stations.values()].some((s) => s.waiting.length > 10), texts: ['Die Station ist rappelvoll. Mehr Züge, bitte!', 'Drei Bahnen sind an mir vorbeigefahren – alle voll.'] },
  { when: (g) => g.stats.pollutionAvg > 0.25, texts: ['Die Luft schmeckt nach Industrie. Ich will Bäume!', 'Mein Balkon ist voller Ruß.'] },
  { when: (g) => g.stats.crimeAvg > 0.35 && g.stats.pop > 300, texts: ['Mir wurde das Fahrrad geklaut. Schon wieder.', 'Nachts fühle ich mich hier nicht mehr sicher. Mehr Polizei!'] },
  { when: (g) => g.stats.pop > 300 && g.stats.healthAvg < 0.3, texts: ['Der nächste Arzt ist ewig weit weg.', 'Wir brauchen eine Arztpraxis im Viertel.'] },
  { when: (g) => g.stats.pop > 300 && g.stats.edu < 0.15, texts: ['Meine Kinder brauchen eine Schule!', 'Ohne Schule keine Zukunft.'] },
  { when: (g) => g.hasBuilt('doener'), texts: ['Der Chili-Cheese-Döner bei Mêrdîn ist unschlagbar.', 'Eigene Soßen, ofenfrische Pide – Mêrdîn’s ist ein Muss.'] },
  { when: (g) => g.stats.burning > 0, texts: ['Es brennt! Ich sehe Rauch über den Dächern.', 'Wo bleibt die Feuerwehr?!'] },
  { when: () => true, texts: ['Schöner Tag heute.', 'Hat jemand meine Katze gesehen? Grau, heißt Pixel.', 'Neue Bäckerei an der Ecke. Die Brezeln sind top.', 'Ich habe beim Joggen einen Fuchs gesehen!', 'Wer baut eigentlich all diese Straßen? Respekt.', 'Gestern Abend der Sonnenuntergang über der Stadt – wow.'] },
];

export function chatter(g) {
  if (g.stats.pop < 20) return;
  const opts = CHATTER.filter((c) => c.when(g));
  // Probleme bevorzugen
  const c = opts.length > 1 && g.rng() < 0.75 ? opts[Math.floor(g.rng() * (opts.length - 1))] : opts[opts.length - 1];
  if (!c) return;
  const text = pick(g.rng, c.texts);
  g.pushNews({ kind: 'chatter', author: citizenName(g.rng), text, mood: 'info' });
}

export function milestoneText(i) {
  const m = MILESTONES[i];
  return m ? m.name : '';
}
