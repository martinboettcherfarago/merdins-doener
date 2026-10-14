// Inhalte Verkehr. Besitzer: System-Agent „Verkehr & ÖPNV" (S3).
// Schlüssel und Grundflächen sind ein Vertrag mit den Architektur-Agenten – nicht umbenennen.
// Dazu: Wochenkarten, Ereignisse, Stadtfunk und Verordnungen rund um Bus, Bahn, Flughafen und Straße.
import { BUILDINGS, POLICIES } from '../config.js';
import { CARDS, EVENTS, CHATTER } from '../sim/progress.js';
import { fmtMoney } from '../util.js';

Object.assign(BUILDINGS, {
  bus_depot: { name: 'Busdepot', cat: 'transport', size: [2, 2], cost: 6000, upkeep: 50, unlock: 2, buses: 8, power_use: 6, noise: 0.6, desc: '8 Busse. Danach Buslinie unter „Verkehr" zeichnen.' },
  tram_depot: { name: 'Straßenbahndepot', cat: 'transport', size: [3, 2], cost: 14000, upkeep: 90, unlock: 3, trams: 6, power_use: 20, desc: '6 Straßenbahnen, Gleise auf Straßen.' },
  train_station: { name: 'Hauptbahnhof', cat: 'transport', size: [4, 2], cost: 30000, upkeep: 160, unlock: 3, tourism: 120, intercity: 1, power_use: 20, noise: 1.1, lv: 8, lvRadius: 8, desc: 'Fernzüge: Pendler und Touristen. Gut für Läden.' },
  airport: { name: 'Flughafen', cat: 'transport', size: [6, 4], cost: 90000, upkeep: 420, unlock: 5, tourism: 420, offBoost: 20, power_use: 60, water_use: 20, noise: 2.5, lv: -18, lvRadius: 10, desc: 'Viele Touristen und Büros. Sehr laut.' },
  ferry_pier: { name: 'Fähranleger', cat: 'transport', size: [1, 1], cost: 3000, upkeep: 20, unlock: 2, needsWater: true, desc: 'Zwei Anleger am Ufer bilden eine Fährlinie.' },
  parking: { name: 'Parkhaus', cat: 'transport', size: [1, 1], cost: 4000, upkeep: 25, unlock: 3, parking: 200, comBoost: 4, lvRadius: 4, desc: '15 % weniger Stau im Umkreis.' },
  taxi_depot: { name: 'Taxizentrale', cat: 'transport', size: [1, 1], cost: 3500, upkeep: 30, unlock: 3, taxis: 10, desc: '10 Taxis für Touristen und Nachtschwärmer.' },
  metro_hub: { name: 'U-Bahn-Umsteigebahnhof', cat: 'transit', size: [2, 1], cost: 6000, upkeep: 30, unlock: 3, onRoad: false, stationCapacity: 30, desc: 'Großer U-Bahnhof mit Eingangshalle: Platz für doppelt so viele Wartende, Umsteigen geht schneller. Linien wie an eine Station anschließen.' },
});

// ---------------------------------------------------------------- Verordnungen
const pol = (p) => { if (!POLICIES.find((x) => x.id === p.id)) POLICIES.push(p); };
pol({ id: 'tp_buslanes', name: 'Busspuren', desc: 'Busse fahren am Stau vorbei, Autos haben weniger Platz.', cost: 0.15, unlock: 2 });
pol({ id: 'tp_parkfee', name: 'Parkraumbewirtschaftung', desc: 'Geld je Parkhaus, +10 % Fahrgäste, Gewerbe-Glück −2.', cost: 0, unlock: 2 });
pol({ id: 'tp_nightbus', name: 'Nachtbusse', desc: 'Auch nachts Busse und Bahnen. Kosten +15 %, Wohnglück +1.', cost: 0.2, unlock: 2 });

// ---------------------------------------------------------------- Wochenkarten
const T = (g) => g.ext && g.ext.transport;
const hasLines = (g, mode) => { const t = T(g); return !!t && t.lines.some((l) => !mode || l.mode === mode); };
const card = (c) => { if (!CARDS.find((x) => x.id === c.id)) CARDS.push(c); };
card({ id: 'tp_buses', name: 'Neue Busse', tag: 'Verkehr', color: '#1c7ed6', w: 1.8, cond: (g) => g.hasBuilt('bus_depot'), text: () => 'Drei Stadtbusse gratis. Im Verkehrsfenster einer Linie zuteilen.', apply: (g) => { const t = T(g); if (t) t.free.bus += 3; } });
card({ id: 'tp_jobticket', name: 'Jobticket', tag: 'Verkehr', color: '#2b8a3e', w: 1.5, cond: (g) => hasLines(g), text: () => 'Firmen zahlen ihren Leuten das Ticket: Bus und Tram 10 Tage lang 30 % mehr Fahrgäste.', apply: (g) => g.addEffect('busRidership', 0.3, 10, 'Jobticket') });
card({ id: 'tp_greenwave', name: 'Grüne Welle', tag: 'Verkehr', color: '#22a866', w: 1.2, cond: (g) => { const t = T(g); return !!t && t.signals.length >= 3; }, text: () => 'Abgestimmte Ampeln: 7 Tage lang kein Zeitverlust an Ampeln.', apply: (g) => g.addEffect('greenWave', 1, 7, 'Grüne Welle') });
card({ id: 'tp_trams', name: 'Straßenbahn-Förderung', tag: 'Verkehr', color: '#c92a2a', w: 1.1, cond: (g) => g.hasBuilt('tram_depot'), text: () => 'Das Land schenkt eine Straßenbahn und 4.000 € für Gleise.', apply: (g) => { const t = T(g); if (t) t.free.tram += 1; g.money += 4000; } });
card({ id: 'tp_safety', name: 'Verkehrswacht', tag: 'Sicherheit', color: '#f08c00', w: 1, cond: (g) => { const t = T(g); return !!t && t.totals.accidents >= 2; }, text: () => 'Schulwegdienst und Blitzer: 10 Tage lang Tempo 30-Wirkung auf Unfälle, Glück +2.', apply: (g) => { g.addEffect('happy', 2, 10, 'Verkehrswacht'); g.addEffect('safeRoads', 1, 10, 'Verkehrswacht'); } });

// ---------------------------------------------------------------- Ereignisse mit Entscheidung
const ev = (e) => { if (!EVENTS.find((x) => x.id === e.id)) EVENTS.push(e); };
ev({
  id: 'tp_strike', title: 'Busfahrer streiken', minPop: 400, cond: (g) => hasLines(g, 'bus'),
  text: 'Die Gewerkschaft fordert mehr Lohn und kürzere Schichten. Ohne Einigung bleiben morgen alle Busse im Depot.',
  options: [
    { label: 'Lohnerhöhung zahlen', hint: (g) => `−${fmtMoney(2000 + (T(g) ? T(g).vehicles.length * 300 : 0))}`, apply: (g) => { g.money -= 2000 + (T(g) ? T(g).vehicles.length * 300 : 0); } },
    { label: 'Hart bleiben', hint: () => '3 Tage keine Busse, Glück −3', apply: (g) => { g.addEffect('busStrike', 1, 3, 'Busstreik'); g.addEffect('happy', -3, 3, 'Busstreik'); } },
  ],
});
ev({
  id: 'tp_ticket', title: 'Das Land bietet ein Monatsticket', minPop: 900, cond: (g) => hasLines(g),
  text: 'Für 49 Euro im Monat sollen alle Busse und Bahnen fahren. Die Stadt muss die Ausfälle beim Fahrgeld zum Teil selbst tragen.',
  options: [
    { label: 'Mitmachen', hint: () => '14 Tage: Fahrgäste +40 %, Glück +3, dafür −2.500 €', apply: (g) => { g.money -= 2500; g.addEffect('busRidership', 0.4, 14, 'Monatsticket'); g.addEffect('happy', 3, 14, 'Monatsticket'); } },
    { label: 'Ablehnen', hint: () => 'Glück −2 für 5 Tage', apply: (g) => g.addEffect('happy', -2, 5, 'Kein Monatsticket') },
  ],
});
ev({
  id: 'tp_carfree', title: 'Autofreier Sonntag', minPop: 700,
  text: 'Eine Bürgerinitiative möchte die Hauptstraßen einen Tag lang für Fahrräder, Spielstraßen und Flohmärkte öffnen.',
  options: [
    { label: 'Unterstützen', hint: () => 'Glück +5 für 3 Tage, Gewerbenachfrage −10, Fahrgäste +25 %', apply: (g) => { g.addEffect('happy', 5, 3, 'Autofreier Sonntag'); g.addEffect('comDemand', -10, 3, 'Autofreier Sonntag'); g.addEffect('busRidership', 0.25, 3, 'Autofreier Sonntag'); } },
    { label: 'Absagen', hint: () => 'Glück −2 für 3 Tage', apply: (g) => g.addEffect('happy', -2, 3, 'Absage') },
  ],
});
ev({
  id: 'tp_airshow', title: 'Flugtage am Flughafen', minPop: 4000, cond: (g) => g.hasBuilt('airport'),
  text: 'Kunstflieger und Oldtimer-Maschinen – ein Spektakel, das Besucher von weit her anlockt. Die Nachbarschaft fürchtet den Lärm.',
  options: [
    { label: 'Genehmigen', hint: () => 'Touristen +250 für 4 Tage, Glück −2', apply: (g) => { g.addEffect('tourismAdd', 250, 4, 'Flugtage'); g.addEffect('happy', -2, 4, 'Fluglärm'); } },
    { label: 'Ablehnen', hint: () => 'Nichts passiert.', apply: () => {} },
  ],
});
ev({
  id: 'tp_potholes', title: 'Schlaglöcher nach dem Winter', minPop: 1200,
  text: 'Frost hat die Straßen aufgebrochen. Die Busfahrer klagen, die Autofahrer schimpfen.',
  options: [
    { label: 'Sofort sanieren', hint: (g) => `−${fmtMoney(1500 + g.stats.pop * 0.8)}`, apply: (g) => { g.money -= 1500 + g.stats.pop * 0.8; } },
    { label: 'Später', hint: () => 'Glück −3 für 6 Tage, Fahrgäste −15 %', apply: (g) => { g.addEffect('happy', -3, 6, 'Schlaglöcher'); g.addEffect('busRidership', -0.15, 6, 'Schlaglöcher'); } },
  ],
});
ev({
  id: 'tp_rail', title: 'Neue Fernverbindung', minPop: 2500, cond: (g) => g.hasBuilt('train_station'),
  text: 'Die Bahn will einen Intercity-Halt einrichten – wenn die Stadt den Bahnsteig modernisiert.',
  options: [
    { label: 'Modernisieren', hint: () => '−6.000 €, Touristen +90 und Büronachfrage +15 für 14 Tage', apply: (g) => { g.money -= 6000; g.addEffect('tourismAdd', 90, 14, 'Intercity-Halt'); g.addEffect('offDemand', 15, 14, 'Intercity-Halt'); } },
    { label: 'Verzichten', hint: () => 'Nichts passiert.', apply: () => {} },
  ],
});

// ---------------------------------------------------------------- Stadtfunk (vor dem allgemeinen Eintrag einfügen)
const tp = (g) => T(g) || { lines: [], stops: [], signals: [], accidents: [], totals: {}, day: null };
const chat = [
  { when: (g) => tp(g).lines.some((l) => l.load > 1.05), texts: ['Im Bus stehe ich jeden Morgen wie in der Sardinendose.', 'Drei Busse sind an mir vorbeigefahren – alle voll. #Takt', 'Mehr Busse auf meiner Linie, bitte! Oder wenigstens Gelenkbusse.'] },
  { when: (g) => tp(g).lines.some((l) => l.takt > 25 && l.takt < Infinity), texts: ['Eine halbe Stunde auf den Bus warten? Da laufe ich lieber.', 'Mein Bus kommt so selten, ich kenne den Fahrplan auswendig.'] },
  { when: (g) => tp(g).lines.some((l) => l.takt <= 8), texts: ['Bus verpasst? Egal, der nächste kommt gleich.', 'Mit dem Bus bin ich schneller in der Stadt als mit dem Auto. Wer hätte das gedacht.'] },
  { when: (g) => tp(g).lines.some((l) => l.mode === 'tram'), texts: ['Das Quietschen der Straßenbahn in der Kurve – Musik in meinen Ohren.', 'Die neue Tram ist so leise, ich hätte sie fast überhört.', 'Endlich Straßenbahn! Wie früher bei Oma in der Großstadt.'] },
  { when: (g) => g.stats.pop > 600 && !tp(g).lines.length && g.hasBuilt('bus_depot'), texts: ['Wir haben ein Busdepot, aber keinen einzigen Bus auf der Straße?'] },
  { when: (g) => g.stats.pop > 900 && !g.hasBuilt('bus_depot') && g.isUnlocked('bus_depot'), texts: ['Ohne Auto kommt man hier nirgends hin. Wo bleibt der Bus?', 'Eine Buslinie zur Arbeit wäre ein Traum.'] },
  { when: (g) => tp(g).accidents.some((a) => g.time < a.until), texts: ['Schon wieder hat es an der Kreuzung gekracht. Eine Ampel muss her!', 'Unfall auf meinem Arbeitsweg – jetzt stehe ich im Stau.'] },
  { when: (g) => tp(g).signals.length > 12, texts: ['Rot, rot, rot. Ich sammle Ampeln wie andere Leute Briefmarken.', 'Grüne Welle? Bei uns gibt es nur die rote.'] },
  { when: (g) => (T(g) || {}).fare === 0 && tp(g).lines.length, texts: ['Kostenloser Bus! Ich fahre jetzt sogar zum Bäcker.', 'Nulltarif im Nahverkehr – meine Stadt ist die beste.'] },
  { when: (g) => g.policies.has('tp_buslanes'), texts: ['Der Bus rauscht auf seiner Spur am Stau vorbei. Ich steige um.'] },
  { when: (g) => g.policies.has('tp_parkfee'), texts: ['Drei Euro fürs Parken in der Innenstadt? Dann nehme ich halt den Bus.'] },
  { when: (g) => g.hasBuilt('airport'), texts: ['Die Flugzeuge über meinem Garten sind beeindruckend. Und laut.', 'Vom Flughafen in zehn Minuten ins Zentrum – praktisch!'] },
  { when: (g) => g.hasBuilt('train_station'), texts: ['Mit dem Zug in die Hauptstadt und abends zurück. Herrlich entspannt.', 'Am Hauptbahnhof gibt es den besten Kaffee der Stadt.'] },
  { when: (g) => g.hasBuilt('taxi_depot'), texts: ['Nachts um drei noch ein Taxi bekommen – danke, Taxizentrale!'] },
  { when: (g) => (T(g) || { ferries: [] }).ferries.length > 0, texts: ['Mit der Fähre zur Arbeit, Möwen inklusive.', 'Die Fähre ist mein liebster Weg über das Wasser.'] },
  { when: (g) => g.stats.trafficFlow < 0.75 && !tp(g).lines.length, texts: ['Im Stau habe ich ein ganzes Hörbuch geschafft. Ein Bus wäre schneller.'] },
];
CHATTER.splice(Math.max(0, CHATTER.length - 1), 0, ...chat);
