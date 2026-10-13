// Alle Spieldaten an einem Ort: Zonen, Straßen, Gebäude, Meilensteine, Verordnungen.

// Spielstand-Format: 1 = Stadtpuls 1.x (ohne Systemdaten), 2 = Stadtpuls 2.0 (mit g.ext, Budgets, Zufallszustand)
export const VERSION = 2;

// Zeit: Ein Spieltag dauert bei 1× Geschwindigkeit 30 Sekunden.
export const GAME_MIN_PER_SEC = 48;
export const SPEEDS = [0, 1, 2, 4];
export const DAY = 1440;
export const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
// Ein Spieljahr = 4 Jahreszeiten × 28 Tage (wie das Wetterjahr in sim/systems/weather.js)
export const YEAR_DAYS = 112;
// Höchste Stufe der Spezialindustrie (Bauernhof, Forst, Bergwerk, Ölförderung); Modelle gibt es bis Stufe 5
export const SPEC_MAX_LEVEL = 5;

export const T = { GRASS: 0, WATER: 1, SAND: 2, ROCK: 3 };
export const RES = { NONE: 0, FERTILE: 1, ORE: 2, OIL: 3 };

export const Z = { NONE: 0, RES: 1, COM: 2, IND: 3, OFF: 4 };
export const ZONE_INFO = {
  1: { key: 'res', name: 'Wohnen', short: 'W', color: 0x63c27a, shape: 'circle', desc: 'Hier ziehen Menschen ein. Braucht: Straße, Strom, Wasser und Arbeit in der Nähe.' },
  2: { key: 'com', name: 'Gewerbe', short: 'G', color: 0x4c9be8, shape: 'triangle', desc: 'Läden und Cafés mit Jobs. Braucht: Kundschaft aus den Wohnvierteln und Waren.' },
  3: { key: 'ind', name: 'Industrie', short: 'I', color: 0xeeb33f, shape: 'square', desc: 'Fabriken mit vielen Jobs, aber Abgasen – mit Abstand zu Wohnhäusern. Auf Acker, Wald, Erz oder Öl entstehen Bauernhöfe, Forst, Bergwerke und Ölfelder.' },
  4: { key: 'off', name: 'Büro', short: 'B', color: 0xa77be0, shape: 'diamond', desc: 'Saubere Büros mit gut bezahlten Jobs. Braucht: gebildete Bürger (Gymnasium, Universität).' },
};

// Werte je Stufe (Index 1–5).
export const LEVELS = {
  1: { cap: [0, 8, 18, 36, 70, 140], power: [0, 2, 3, 6, 11, 20], water: [0, 2, 3, 6, 11, 20], garbage: [0, 1, 1.6, 3, 5.5, 10], need: [0, 0, 25, 40, 55, 70], edu: [0, 0, 0, 0, 0.25, 0.45] },
  2: { cap: [0, 5, 10, 20, 36, 64], power: [0, 3, 5, 8, 14, 22], water: [0, 1, 2, 4, 6, 10], garbage: [0, 1.5, 2.5, 4, 7, 11], need: [0, 0, 25, 40, 55, 70], edu: [0, 0, 0, 0, 0.1, 0.25] },
  3: { cap: [0, 8, 16, 28, 44, 64], power: [0, 5, 8, 13, 19, 26], water: [0, 3, 5, 8, 11, 14], garbage: [0, 2.5, 4, 6, 8, 10], need: [0, 0, 20, 32, 45, 58], edu: [0, 0, 0, 0.1, 0.2, 0.35], pollution: [0, 1, 1.35, 1.7, 1.9, 1.5] },
  4: { cap: [0, 10, 22, 44, 80, 140], power: [0, 4, 7, 12, 20, 32], water: [0, 2, 3, 5, 8, 12], garbage: [0, 1, 2, 3, 5, 8], need: [0, 0, 30, 45, 60, 75], edu: [0, 0.1, 0.2, 0.3, 0.4, 0.5] },
};

// Steuersatz-Faktor pro Einwohner bzw. Arbeitsplatz und Tag (× Steuersatz in %).
export const TAX_RATE = { 1: 0.058, 2: 0.068, 3: 0.058, 4: 0.088 };

export const R = { NONE: 0, LANE: 1, STREET: 2, AVENUE: 3, HIGHWAY: 4 };
export const ROADS = {
  1: { key: 'lane', name: 'Gasse', cost: 8, upkeep: 0.12, capacity: 260, speed: 0.75, lv: 0, noise: 0.4, desc: 'Günstig und leise, aber wenig Platz für Autos. Gut für ruhige Wohnstraßen.' },
  2: { key: 'street', name: 'Straße', cost: 16, upkeep: 0.25, capacity: 650, speed: 1, lv: 0, noise: 0.7, desc: 'Die normale Straße mit zwei Spuren. Damit fängst du an.' },
  3: { key: 'avenue', name: 'Allee', cost: 40, upkeep: 0.6, capacity: 1400, speed: 1.2, lv: 7, noise: 0.85, desc: 'Breiter Boulevard mit Bäumen: viel Platz für Autos und wertvollere Grundstücke.' },
  4: { key: 'highway', name: 'Autobahn', cost: 0, upkeep: 0, capacity: 3200, speed: 1.7, lv: -6, noise: 1.3, desc: 'Verbindet die Stadt mit dem Umland.' },
};
export const BRIDGE_FACTOR = 5;
export const CLEAR_TREE_COST = 6;
export const ZONE_COST = 2;

// Meilensteine nach Einwohnerzahl.
export const MILESTONES = [
  { pop: 0, name: 'Weiler', reward: 0 },
  { pop: 150, name: 'Dorf', reward: 6000 },
  { pop: 500, name: 'Kleinstadt', reward: 12000 },
  { pop: 1500, name: 'Stadt', reward: 25000 },
  { pop: 4000, name: 'Großstadt', reward: 45000 },
  { pop: 10000, name: 'Metropole', reward: 90000 },
  { pop: 25000, name: 'Weltstadt', reward: 160000 },
  { pop: 50000, name: 'Megastadt', reward: 300000 },
];

// Gebäude außerhalb der Zonen. size = [Breite, Tiefe] in Feldern.
// service: Art der Abdeckung, radius in Feldern, capacity in Einwohner-/Müll-Einheiten.
export const BUILDINGS = {
  // --- Strom
  coal: { name: 'Kohlekraftwerk', cat: 'power', size: [2, 2], cost: 7000, upkeep: 85, unlock: 0, power: 700, water_use: 10, pollution: 5, noise: 1, lv: -18, lvRadius: 7, desc: 'Viel Strom für wenig Geld. Macht aber Abgase und Lärm – nicht direkt neben Wohnhäuser setzen.' },
  wind: { name: 'Windrad', cat: 'power', size: [1, 1], cost: 2200, upkeep: 18, unlock: 0, power: 90, noise: 0.3, lv: -2, lvRadius: 2, desc: 'Sauberer Strom ohne Abgase, aber nur wenig. Gut für den Anfang oder als Ergänzung.' },
  solar: { name: 'Solarpark', cat: 'power', size: [2, 2], cost: 9500, upkeep: 30, unlock: 3, power: 380, desc: 'Sauberer und leiser Strom aus Sonnenlicht.' },
  gas: { name: 'Gaskraftwerk', cat: 'power', size: [2, 2], cost: 14000, upkeep: 110, unlock: 3, power: 1400, water_use: 12, pollution: 2, noise: 0.8, lv: -8, lvRadius: 5, desc: 'Viel Strom mit deutlich weniger Abgasen als Kohle.' },
  fusion: { name: 'Fusionsreaktor', cat: 'power', size: [3, 3], cost: 120000, upkeep: 600, unlock: 5, power: 9000, water_use: 40, lv: -4, lvRadius: 4, desc: 'Riesige Mengen sauberer Strom für eine Großstadt. Braucht: Wasser.' },
  // --- Wasser
  watertower: { name: 'Wasserturm', cat: 'water', size: [1, 1], cost: 1500, upkeep: 14, unlock: 0, water: 220, power_use: 4, desc: 'Liefert Wasser für ein paar Straßen und passt überall hin. Braucht: Strom.' },
  pump: { name: 'Pumpwerk', cat: 'water', size: [1, 1], cost: 3200, upkeep: 32, unlock: 0, water: 800, power_use: 10, needsWater: true, desc: 'Pumpt viel Wasser aus Fluss oder See. Braucht: Platz am Ufer und Strom.' },
  waterworks: { name: 'Wasserwerk', cat: 'water', size: [2, 2], cost: 16000, upkeep: 120, unlock: 4, water: 3200, power_use: 30, needsWater: true, desc: 'Großes Wasserwerk für eine ganze Stadt. Braucht: Platz am Ufer und Strom.' },
  // --- Müll
  landfill: { name: 'Deponie', cat: 'garbage', size: [2, 2], cost: 3000, upkeep: 38, unlock: 0, service: { type: 'garbage', radius: 15, capacity: 650 }, pollution: 1.2, lv: -14, lvRadius: 5, desc: 'Müllwagen holen den Müll aus der Umgebung ab. Riecht – etwas abseits bauen.' },
  incinerator: { name: 'Müllverbrennung', cat: 'garbage', size: [2, 2], cost: 11000, upkeep: 110, unlock: 3, service: { type: 'garbage', radius: 20, capacity: 2200 }, power: 220, pollution: 2.5, lv: -10, lvRadius: 5, desc: 'Verbrennt viel Müll und macht daraus etwas Strom. Macht Abgase.' },
  recycling: { name: 'Recyclinghof', cat: 'garbage', size: [2, 2], cost: 15000, upkeep: 95, unlock: 4, service: { type: 'garbage', radius: 18, capacity: 1600 }, lv: -3, lvRadius: 3, desc: 'Verwertet viel Müll – sauber und leise.' },
  // --- Dienste
  police: { name: 'Polizeiwache', cat: 'services', size: [1, 1], cost: 3200, upkeep: 45, unlock: 1, service: { type: 'police', radius: 10, capacity: 2600 }, power_use: 5, water_use: 3, desc: 'Senkt die Kriminalität im Umkreis. Braucht: Strom und Wasser.' },
  policehq: { name: 'Polizeipräsidium', cat: 'services', size: [2, 2], cost: 14000, upkeep: 150, unlock: 4, service: { type: 'police', radius: 18, capacity: 14000 }, power_use: 14, water_use: 8, desc: 'Große Polizeiwache für viele Viertel. Braucht: Strom und Wasser.' },
  fire: { name: 'Feuerwache', cat: 'services', size: [1, 1], cost: 3000, upkeep: 42, unlock: 1, service: { type: 'fire', radius: 10, capacity: 3200 }, power_use: 5, water_use: 6, desc: 'Löscht Brände und senkt die Brandgefahr im Umkreis. Braucht: Strom und Wasser.' },
  firehq: { name: 'Feuerwehrzentrale', cat: 'services', size: [2, 2], cost: 13000, upkeep: 130, unlock: 4, service: { type: 'fire', radius: 18, capacity: 14000 }, power_use: 12, water_use: 14, desc: 'Große Feuerwache für viele Viertel. Braucht: Strom und Wasser.' },
  clinic: { name: 'Arztpraxis', cat: 'services', size: [1, 1], cost: 2800, upkeep: 40, unlock: 1, service: { type: 'health', radius: 8, capacity: 2200 }, power_use: 4, water_use: 4, desc: 'Hält die Nachbarschaft gesund. Braucht: Strom und Wasser.' },
  hospital: { name: 'Krankenhaus', cat: 'services', size: [2, 2], cost: 15000, upkeep: 160, unlock: 3, service: { type: 'health', radius: 17, capacity: 12000 }, power_use: 18, water_use: 16, desc: 'Versorgt Kranke aus vielen Vierteln. Braucht: Strom und Wasser.' },
  // --- Bildung
  school: { name: 'Schule', cat: 'education', size: [2, 1], cost: 4200, upkeep: 60, unlock: 1, service: { type: 'edu', radius: 10, capacity: 2800, eduMax: 0.6 }, power_use: 6, water_use: 5, desc: 'Bildung für Kinder. Gebildete Bürger bauen größere Häuser. Braucht: Strom und Wasser.' },
  university: { name: 'Universität', cat: 'education', size: [3, 2], cost: 26000, upkeep: 260, unlock: 4, service: { type: 'edu', radius: 22, capacity: 11000, eduMax: 1 }, power_use: 20, water_use: 14, lv: 12, lvRadius: 8, desc: 'Hochschule für die ganze Stadt – nötig für Büros und Hochhäuser. Braucht: Strom und Wasser.' },
  library: { name: 'Bibliothek', cat: 'education', size: [1, 1], cost: 2400, upkeep: 28, unlock: 2, service: { type: 'edu', radius: 7, capacity: 1600, eduMax: 0.45 }, lv: 6, lvRadius: 5, power_use: 3, desc: 'Etwas Bildung für die Nachbarschaft und wertvollere Grundstücke. Braucht: Strom.' },
  // --- Parks
  park: { name: 'Kleiner Park', cat: 'parks', size: [1, 1], cost: 450, upkeep: 4, unlock: 0, park: 0.55, parkRadius: 4, desc: 'Bäume und Bänke: Die Leute ringsum sind glücklicher.' },
  plaza: { name: 'Brunnenplatz', cat: 'parks', size: [1, 1], cost: 800, upkeep: 6, unlock: 1, park: 0.45, parkRadius: 4, comBoost: 4, desc: 'Platz mit Brunnen. Macht froh und lockt Kundschaft in die Läden.' },
  citypark: { name: 'Stadtpark', cat: 'parks', size: [2, 2], cost: 2600, upkeep: 16, unlock: 2, park: 0.85, parkRadius: 7, desc: 'Großer Park mit Teich. Macht viele Häuser ringsum glücklicher.' },
  sports: { name: 'Sportplatz', cat: 'parks', size: [2, 2], cost: 3600, upkeep: 22, unlock: 2, park: 0.7, parkRadius: 8, noise: 0.5, desc: 'Sport am Wochenende macht froh. Etwas laut.' },
  playground: { name: 'Spielplatz', cat: 'parks', size: [1, 1], cost: 600, upkeep: 5, unlock: 1, park: 0.5, parkRadius: 3, resBoost: 3, desc: 'Familien ziehen gern in die Nähe eines Spielplatzes.' },
  // --- Verwaltung
  townhall: { name: 'Rathaus', cat: 'services', size: [2, 2], cost: 9000, upkeep: 60, unlock: 2, unique: true, lv: 10, lvRadius: 8, happy: 3, taxBonus: 0.08, power_use: 8, water_use: 4, desc: 'Einmalig. Bringt 8 % mehr Steuern und etwas mehr Glück. Braucht: Strom und Wasser.' },
  // --- ÖPNV
  station: { name: 'Pulsbahn-Station', cat: 'transit', size: [1, 1], cost: 1400, upkeep: 12, unlock: 2, onRoad: true, desc: 'Hochbahn-Haltestelle. Auch über Straßen baubar. Einzugsradius 4 Felder.' },
  // --- Wahrzeichen (einmalig, meist über Wochenkarten)
  ferris: { name: 'Riesenrad', cat: 'landmarks', size: [2, 2], cost: 18000, upkeep: 60, unlock: 3, unique: true, landmark: true, lv: 25, lvRadius: 12, happy: 5, tourism: 140, desc: 'Wahrzeichen: Dreht sich, macht glücklich und lockt Touristen an.' },
  tvtower: { name: 'Fernsehturm', cat: 'landmarks', size: [1, 1], cost: 22000, upkeep: 70, unlock: 4, unique: true, landmark: true, lv: 20, lvRadius: 16, happy: 4, tourism: 170, desc: 'Wahrzeichen, weithin sichtbar: lockt Touristen an.' },
  stadium: { name: 'Stadion', cat: 'landmarks', size: [3, 3], cost: 40000, upkeep: 160, unlock: 4, unique: true, landmark: true, lv: 8, lvRadius: 12, happy: 8, tourism: 260, noise: 1.6, desc: 'Wahrzeichen: Heimspiele machen sehr glücklich – sind aber laut.' },
  opera: { name: 'Opernhaus', cat: 'landmarks', size: [2, 2], cost: 32000, upkeep: 120, unlock: 4, unique: true, landmark: true, lv: 30, lvRadius: 12, happy: 5, tourism: 190, desc: 'Wahrzeichen: Kultur macht die Grundstücke ringsum viel wertvoller.' },
  observatory: { name: 'Sternwarte', cat: 'landmarks', size: [1, 1], cost: 16000, upkeep: 50, unlock: 3, unique: true, landmark: true, lv: 15, lvRadius: 10, happy: 2, tourism: 90, eduCity: 0.08, desc: 'Wahrzeichen: In der ganzen Stadt wächst die Bildung schneller.' },
  doener: { name: 'Mêrdîn’s Dönerpalast', cat: 'landmarks', size: [1, 1], cost: 9000, upkeep: 25, unlock: 2, unique: true, landmark: true, lv: 12, lvRadius: 10, happy: 7, tourism: 110, comBoost: 10, desc: 'Der cheesyste Döner der Stadt. Macht glücklich und bringt Kundschaft in die Läden ringsum.' },
  lighthouse: { name: 'Leuchtturm', cat: 'landmarks', size: [1, 1], cost: 12000, upkeep: 30, unlock: 3, unique: true, landmark: true, needsWater: true, lv: 18, lvRadius: 10, happy: 3, tourism: 120, desc: 'Wahrzeichen am Wasser: romantisch und gut für Touristen. Braucht: Platz am Ufer.' },
};

export const CATEGORIES = [
  { id: 'roads', name: 'Straßen', key: 'R' },
  { id: 'zones', name: 'Zonen', key: 'Z' },
  { id: 'power', name: 'Strom' },
  { id: 'water', name: 'Wasser' },
  { id: 'garbage', name: 'Müll' },
  { id: 'services', name: 'Dienste' },
  { id: 'education', name: 'Bildung' },
  { id: 'parks', name: 'Parks' },
  { id: 'industry', name: 'Logistik' },
  { id: 'transport', name: 'Verkehr' },
  { id: 'transit', name: 'U-Bahn' },
  { id: 'safety', name: 'Schutz' },
  { id: 'landmarks', name: 'Wahrzeichen' },
];

// Maße der Straßen in Welteinheiten (1 = 10 m). Vertrag zwischen Straßen-Ansicht und Fahrzeugen.
export const ROAD_GEOM = {
  1: { width: 0.42, lanes: 2, laneOffset: 0.11, sidewalk: 0.29 },
  2: { width: 0.6, lanes: 2, laneOffset: 0.16, sidewalk: 0.2 },
  3: { width: 0.84, lanes: 4, laneOffset: 0.24, sidewalk: 0.08, median: 0.1 },
  4: { width: 0.92, lanes: 4, laneOffset: 0.27, sidewalk: 0.04, median: 0.06 },
};

// Pulsbahn (Hochbahn) – Kosten und Werte.
export const TRANSIT = {
  lineCost: 1500,
  trackCostPerTile: 35,
  trainCost: 2600,
  trainUpkeep: 26,
  wagonCost: 1400,
  wagonUpkeep: 9,
  lineUpkeep: 15,
  stationUpkeep: 12,
  catchment: 4.5,
  baseCapacity: 12,
  wagonCapacity: 12,
  fare: 4,
  stationCapacity: 14,
  overcrowdDays: 1.4,
  trackHeight: 3.1,
  maxLevelUnderTrack: 4,
  speed: 3.2, // Felder pro Sekunde bei 1×
};

export const POLICIES = [
  { id: 'smoke', name: 'Rauchmelderpflicht', desc: 'Brände entstehen nur halb so oft.', cost: 0.35, unlock: 1 },
  { id: 'tempo30', name: 'Tempo 30', desc: '40 % weniger Lärm, aber Autos fahren langsamer.', cost: 0.05, unlock: 1 },
  { id: 'recycling', name: 'Mülltrennung', desc: '30 % weniger Müll.', cost: 0.45, unlock: 2 },
  { id: 'bikes', name: 'Fahrradstadt', desc: '15 % weniger Autos und etwas mehr Glück (+3).', cost: 0.55, unlock: 2 },
  { id: 'freetransit', name: 'Kostenlose U-Bahn', desc: '40 % mehr Fahrgäste und mehr Glück (+3), aber keine Einnahmen aus Fahrkarten.', cost: 0, unlock: 2 },
  { id: 'lowrise', name: 'Hochhausverbot', desc: 'Häuser bleiben höchstens Stufe 3. Dafür etwas mehr Wohnglück (+2).', cost: 0, unlock: 2 },
  { id: 'cleanind', name: 'Saubere Industrie', desc: '40 % weniger Abgase der Industrie, aber 20 % weniger Firmen wollen kommen.', cost: 0.5, unlock: 3 },
  { id: 'tenants', name: 'Mieterschutz', desc: 'Mehr Wohnglück (+5), aber 10 % weniger Steuern von Bürgern.', cost: 0, unlock: 3 },
  { id: 'education', name: 'Bildungsoffensive', desc: 'Die Bürger lernen 60 % schneller.', cost: 0.6, unlock: 3 },
  { id: 'nightquiet', name: 'Nachtruhe', desc: '25 % weniger Lärm, aber 10 % weniger Steuern von Läden.', cost: 0, unlock: 3 },
];

export const LOANS = [
  { amount: 25000, weeks: 20, rate: 0.012 },
  { amount: 60000, weeks: 30, rate: 0.015 },
  { amount: 150000, weeks: 40, rate: 0.02 },
];

export const MAP_TYPES = [
  { id: 'river', name: 'Flusstal', desc: 'Ein Fluss teilt das Land, Hügel an den Rändern.' },
  { id: 'coast', name: 'Küste', desc: 'Strand und Meer im Osten.' },
  { id: 'lakes', name: 'Seenplatte', desc: 'Viele kleine Seen und Wälder.' },
  { id: 'islands', name: 'Inselreich', desc: 'Brücken und Bahnen verbinden die Inseln.' },
  { id: 'mountains', name: 'Bergland', desc: 'Täler zwischen schroffen Gipfeln.' },
];

export const MAP_SIZES = [
  { id: 64, name: 'Klein (64²)' },
  { id: 96, name: 'Mittel (96²)' },
  { id: 128, name: 'Groß (128²)' },
];

export const DIFFICULTIES = [
  { id: 'relaxed', name: 'Entspannt', money: 80000, costMul: 0.75, desc: 'Mehr Startgeld, günstigere Bauten.' },
  { id: 'normal', name: 'Normal', money: 40000, costMul: 1, desc: 'Ausgewogen – gut für den Einstieg.' },
  { id: 'hard', name: 'Anspruchsvoll', money: 22000, costMul: 1.25, desc: 'Knappe Kassen, Bankrott droht.' },
  { id: 'sandbox', name: 'Sandkasten', money: 9999999, costMul: 0, desc: 'Unbegrenztes Geld, alles freigeschaltet. Ohne Einführung.' },
];
