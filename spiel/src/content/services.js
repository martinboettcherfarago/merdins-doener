// Inhalte Bürger & Dienste. Besitzer: System-Agent „Bürger & Dienste" (S2).
// Schlüssel und Grundflächen sind ein Vertrag mit den Architektur-Agenten – nicht umbenennen.
// Zusätzliche Felder (graves, hearses, seats, inmates, careRadius …) wertet sim/systems/citizens.js aus.
import { BUILDINGS, POLICIES } from '../config.js';
import { registerServiceType } from '../registry.js';
import { CARDS, EVENTS, CHATTER } from '../sim/progress.js';
import { fmtMoney } from '../util.js';

registerServiceType('deathcare');

Object.assign(BUILDINGS, {
  kindergarten: { name: 'Kita', cat: 'education', size: [1, 1], cost: 1800, upkeep: 22, unlock: 1, service: { type: 'edu', radius: 6, capacity: 900, eduMax: 0.25 }, seats: 140, resBoost: 4, parkRadius: 5, power_use: 2, water_use: 2, desc: 'Betreuung für die Kleinsten. Kita-Kinder schaffen später leichter den Schulabschluss, Familien ziehen gern in die Nähe.' },
  highschool: { name: 'Gymnasium', cat: 'education', size: [2, 2], cost: 11000, upkeep: 120, unlock: 3, service: { type: 'edu', radius: 14, capacity: 5000, eduMax: 0.8 }, seats: 520, power_use: 10, water_use: 8, desc: 'Abitur für Jugendliche (15–19). Ohne Abitur kein Studium – nötig für Büros und Wohntürme.' },
  research: { name: 'Forschungszentrum', cat: 'education', size: [2, 2], cost: 30000, upkeep: 220, unlock: 5, offBoost: 25, eduCity: 0.06, lv: 10, lvRadius: 8, power_use: 30, water_use: 10, desc: 'Zieht Büros und Hightech-Industrie an. Bildung wächst in der ganzen Stadt schneller.' },
  elderly_care: { name: 'Seniorenheim', cat: 'services', size: [2, 1], cost: 6000, upkeep: 60, unlock: 2, seniorCare: 300, careRadius: 12, happy: 3, lvRadius: 6, power_use: 6, water_use: 6, desc: 'Pflege für bis zu 300 Senioren im Umkreis: längeres Leben, zufriedenere Ältere.' },
  cemetery: { name: 'Friedhof', cat: 'services', size: [2, 2], cost: 4000, upkeep: 30, unlock: 2, service: { type: 'deathcare', radius: 14, capacity: 6000 }, graves: 2400, hearses: 5, lv: -4, lvRadius: 4, desc: 'Leichenwagen holen Verstorbene ab. 2.400 Gräber – nach 25 Jahren Ruhefrist werden sie wieder frei.' },
  crematorium: { name: 'Krematorium', cat: 'services', size: [1, 1], cost: 8000, upkeep: 70, unlock: 3, service: { type: 'deathcare', radius: 18, capacity: 12000 }, hearses: 12, needsPower: true, pollution: 0.4, power_use: 12, desc: 'Große Kapazität auf kleiner Fläche, braucht keine Gräber – aber Strom.' },
  sewage_plant: { name: 'Kläranlage', cat: 'water', size: [2, 2], cost: 9000, upkeep: 80, unlock: 2, sewage: 1800, needsPower: true, residual: 0.12, needsWater: true, power_use: 14, pollution: 0.6, lv: -10, lvRadius: 5, desc: 'Reinigt Abwasser fast vollständig. Das Kanalnetz liegt wie die Wasserleitungen unter den Straßen.' },
  sewage_outlet: { name: 'Abwasserauslass', cat: 'water', size: [1, 1], cost: 1200, upkeep: 8, unlock: 0, sewage: 500, residual: 1, needsWater: true, waterPollution: 1, lv: -14, lvRadius: 6, desc: 'Billig – leitet Abwasser ungeklärt ins Gewässer. Pumpwerke flussabwärts fördern dann verschmutztes Wasser.' },
  district_heating: { name: 'Heizkraftwerk', cat: 'power', size: [2, 2], cost: 15000, upkeep: 120, unlock: 3, heat: 2400, power: 300, pollution: 1.5, water_use: 16, desc: 'Fernwärme für kalte Winter, dazu etwas Strom. Ohne Wärme frieren die Leute bei Frost und werden krank.' },
  prison: { name: 'Gefängnis', cat: 'services', size: [3, 2], cost: 20000, upkeep: 150, unlock: 4, crimeCity: 0.12, inmates: 600, lv: -12, lvRadius: 6, power_use: 16, water_use: 12, desc: 'Platz für 600 Häftlinge. Senkt die Kriminalität in der ganzen Stadt.' },
});

// --- Stadtweite Verordnungen (erscheinen im Panel „Verordnungen")
POLICIES.push(
  { id: 'vaccination', name: 'Impfprogramm', desc: 'Krankheiten −35 %, etwas weniger Sterbefälle.', cost: 0.4, unlock: 2 },
  { id: 'familybonus', name: 'Familiengeld', desc: 'Geburten +35 %, Wohnglück +2.', cost: 0.5, unlock: 2 },
  { id: 'fullday', name: 'Ganztagsschule', desc: 'Mehr Schulabschlüsse und Abiture (+15 %).', cost: 0.45, unlock: 3 },
  { id: 'forestburial', name: 'Friedwald & Urnen', desc: 'Friedhöfe fassen 40 % mehr Gräber.', cost: 0.08, unlock: 3 },
);

// --- Wochenkarten
const czDead = (g) => (g.ext.citizens && g.ext.citizens.stats ? g.ext.citizens.stats.bodies : 0);
CARDS.push(
  { id: 'cz_babyboom', name: 'Babyboom', tag: 'Bürger', color: '#f06fae', w: 1.2, cond: (g) => g.stats.pop > 300, text: () => 'Geburten +60 % für 10 Tage. Bald braucht es mehr Kitas und Schulen!', apply: (g) => g.addEffect('births', 0.6, 10, 'Babyboom') },
  { id: 'cz_doctors', name: 'Ärzteoffensive', tag: 'Gesundheit', color: '#e8543f', w: 1.1, cond: (g) => g.stats.pop > 400, text: () => 'Krankheiten −40 % für 10 Tage.', apply: (g) => g.addEffect('sickness', -0.4, 10, 'Ärzteoffensive') },
  { id: 'cz_undertaker', name: 'Bestatter aus dem Umland', tag: 'Bürger', color: '#5d6470', w: 1.6, cond: (g) => czDead(g) > 4, text: () => 'Das Umland holt 7 Tage lang bis zu 25 Verstorbene pro Tag kostenlos ab.', apply: (g) => g.addEffect('umland', 25, 7, 'Bestatter aus dem Umland') },
  { id: 'cz_scholarship', name: 'Stipendien', tag: 'Dauerhaft', color: '#8f5ad8', w: 1, cond: (g) => g.milestone >= 3 && (g.cardCount.cz_scholarship || 0) < 2, text: () => 'Dauerhaft 20 % mehr Abiture und Hochschulabschlüsse.', apply: (g) => { g.mods.czStudy = (g.mods.czStudy || 1) * 1.2; } },
  { id: 'cz_sewerfund', name: 'Kanalbau-Förderung', tag: 'Dauerhaft', color: '#7a5a3a', w: 1, cond: (g) => g.stats.pop > 500 && (g.cardCount.cz_sewerfund || 0) < 3, text: () => 'Alle Abwasseranlagen leisten dauerhaft 15 % mehr.', apply: (g) => { g.mods.czSewage = (g.mods.czSewage || 1) * 1.15; } },
);

// --- Ereignisse mit Entscheidung
const czStats = (g) => (g.ext.citizens && g.ext.citizens.stats) || {};
EVENTS.push(
  {
    id: 'cz_sewerburst', title: 'Rohrbruch im Kanal', minPop: 800, cond: (g) => (czStats(g).sewageCap || 0) > 0,
    text: 'Unter der Hauptstraße ist ein alter Abwasserkanal gebrochen. Es riecht schon im ganzen Viertel.',
    options: [
      { label: 'Sofort reparieren', hint: (g) => `−${fmtMoney(3000 + g.stats.pop * 0.6)}`, apply: (g) => { g.money -= 3000 + g.stats.pop * 0.6; } },
      { label: 'Notdürftig flicken', hint: () => 'Abwasserkapazität −40 % für 4 Tage', apply: (g) => g.addEffect('sewageCap', -0.4, 4, 'Kanal-Provisorium') },
    ],
  },
  {
    id: 'cz_cemetery', title: 'Der Friedhof wird knapp', minPop: 600, cond: (g) => (czStats(g).graveFill || 0) > 0.8,
    text: 'Die Friedhofsverwaltung meldet: Bald gibt es keine freien Gräber mehr. Die Kirchengemeinde schlägt eine Erweiterung vor.',
    options: [
      { label: 'Friedhof erweitern', hint: () => '−6.000 €, +800 Gräber auf jedem Friedhof', apply: (g) => { g.money -= 6000; for (const b of g.buildings.values()) if (b.key === 'cemetery') { b.cz ||= {}; b.cz.extraGraves = (b.cz.extraGraves || 0) + 800; } } },
      { label: 'Urnenwand statt Gräber', hint: () => 'Glück −2 für 5 Tage, 400 Gräber werden frei', apply: (g) => { g.addEffect('happy', -2, 5, 'Urnenwand-Streit'); for (const b of g.buildings.values()) if (b.key === 'cemetery' && b.cz) b.cz.used = Math.max(0, (b.cz.used || 0) - 400); } },
    ],
  },
  {
    id: 'cz_school', title: 'Elternabend: Schulen überfüllt', minPop: 700, cond: (g) => (czStats(g).schoolFill || 0) > 1.1,
    text: 'In den Klassen sitzen 35 Kinder. Die Eltern fordern schnelle Abhilfe.',
    options: [
      { label: 'Container-Klassenzimmer', hint: () => '−4.500 €, Schulplätze +30 % für 14 Tage', apply: (g) => { g.money -= 4500; g.addEffect('seats', 0.3, 14, 'Container-Klassen'); } },
      { label: 'Vertrösten', hint: () => 'Glück −3 für 6 Tage', apply: (g) => g.addEffect('happy', -3, 6, 'Enttäuschte Eltern') },
    ],
  },
  {
    id: 'cz_care', title: 'Pflegenotstand', minPop: 1000, cond: (g) => (czStats(g).seniorShare || 0) > 0.2,
    text: 'Immer mehr ältere Menschen brauchen Pflege. Ein Wohlfahrtsverband bietet einen Pflegedienst an.',
    options: [
      { label: 'Pflegedienst bezahlen', hint: () => '−5.000 €, Senioren 10 Tage besser versorgt', apply: (g) => { g.money -= 5000; g.addEffect('care', 0.5, 10, 'Ambulanter Pflegedienst'); } },
      { label: 'Ablehnen', hint: () => 'Glück −2 für 5 Tage', apply: (g) => g.addEffect('happy', -2, 5, 'Pflegenotstand') },
    ],
  },
);

// --- Stadtfunk (vor dem allgemeinen Eintrag am Ende einfügen)
const MY_CHATTER = [
  { when: (g) => czStats(g).bodies > 3, texts: ['Unser Nachbar ist vor Tagen gestorben – und niemand holt ihn ab. Wo bleibt der Leichenwagen?', 'Ein Friedhof wäre schön. Nur so als Vorschlag.', 'Die Bestatter im Umland sind ausgebucht. Was ist das für eine Stadt?'] },
  { when: (g) => czStats(g).unsewered > 3, texts: ['Aus dem Gully blubbert es. Ich will gar nicht wissen, was das ist.', 'Die Toilettenspülung geht nicht mehr. Wir brauchen eine Kläranlage!', 'Es stinkt im ganzen Viertel nach Kanal.'] },
  { when: (g) => czStats(g).contam > 0.15, texts: ['Das Leitungswasser schmeckt komisch. Ich kaufe nur noch Flaschen.', 'Wer hat den Abwasserauslass flussaufwärts vom Pumpwerk gebaut?!'] },
  { when: (g) => czStats(g).sickShare > 0.08, texts: ['Die halbe Firma liegt mit Fieber im Bett.', 'Im Wartezimmer beim Arzt sitzt man drei Stunden.', 'Hatschi! Halb Neustadt ist erkältet.'] },
  { when: (g) => czStats(g).schoolFill > 1.1, texts: ['35 Kinder in einer Klasse – so kann doch niemand lernen.', 'Meine Tochter hat keinen Schulplatz bekommen.'] },
  { when: (g) => czStats(g).kitaFill > 1.1, texts: ['Seit Monaten auf der Warteliste für die Kita…', 'Ohne Kitaplatz kann ich nicht arbeiten gehen.'] },
  { when: (g) => czStats(g).birthsToday > 25, texts: ['Auf dem Spielplatz ist es so voll wie nie!', 'Schon wieder ein Kinderwagen im Bus. Die Stadt wird jünger!'] },
  { when: (g) => czStats(g).seniorShare > 0.24, texts: ['Unser Viertel wird immer älter. Ein Seniorenheim fehlt.', 'Im Seniorentreff ist mehr los als im Club.'] },
  { when: (g) => czStats(g).cold > 3, texts: ['Die Heizung ist kalt und draußen friert es. Fernwärme, bitte!', 'Ich sitze mit Mütze im Wohnzimmer.'] },
  { when: (g) => czStats(g).uniShare > 0.18, texts: ['Hier wohnen so viele Akademiker – die Mieten steigen schon.', 'Doktorhut-Party im Hinterhof!'] },
  { when: (g) => g.ext.districts && g.ext.districts.list && g.ext.districts.list.length > 0, texts: ['Unser Bezirk hat jetzt einen eigenen Namen. Ich fühle mich gleich heimischer.', 'Bezirksversammlung heute Abend: Es geht um Tempo 30.'] },
];
CHATTER.unshift(...MY_CHATTER);
