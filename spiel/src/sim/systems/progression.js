// System „Fortschritt & Inhalte" (Agent S5): Erfolge, Szenarien, Metro-Modus, Ratgeber.
// Läuft headless (keine Imports aus render/ oder ui/). Zustand in g.ext.progression.
//
// Überblick
//   ACHIEVEMENTS  – über 60 Erfolge mit Fortschritt (Bronze/Silber/Gold, Punkte → Bürgermeister-Rang)
//   SCENARIOS     – Szenarien mit Startbedingungen, Zielen, Zeitlimit, Sieg/Niederlage
//                   Start: newGame({ ..., scenario: 'id' }) – die Daten liegen dann in g.opts.scenario.
//   Metro-Modus   – Szenario 'metro': Die Stadt wächst von selbst in Vierteln, jedes Viertel bekommt eine
//                   Station. Der Spieler baut nur die Pulsbahn. Läuft eine Station über, ist Schluss.
//                   Punkte = beförderte Fahrgäste.
//   adviceFor(g)  – Ratgeber-Hinweise (sortiert nach Dringlichkeit), auch für andere Oberflächen nutzbar.
//
// Benachrichtigungen an die Oberfläche: g.ext.progression.inbox (nicht gespeichert) und
// Ereignisse g.emit('achievement', a) / g.emit('scenario', zustand) sowie emit('achievement', { g, a }) im Register.
import { registerSystem, SYSTEMS, BUDGET_LINES, emit as busEmit, on as busOn } from '../../registry.js';
import { BUILDINGS, MILESTONES, R, Z, T, TRANSIT, POLICIES, DAY } from '../../config.js';
import { clamp, fmt, fmtMoney, hash2, MinHeap, mulberry32, cityName, hashStr } from '../../util.js';
import { isBuildableZoneTile, chooseFootprint } from '../city.js';
import { computeUtilities, computeCoverage, computeFields, computeHappiness } from '../services.js';
import { CARDS, EVENTS } from '../progress.js';
import { FOLLOWUPS } from '../../content/events.js';

const S = (g) => g.ext.progression;

// ---------------------------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------------------------
export function isMetro(g) { return g.opts?.scenario === 'metro'; }
// Im Sandkasten und in der Menü-Vorschau gibt es keine Erfolge.
export function achievementsEnabled(g) { return !g.sandbox && (!g.sandboxNoEvents || isMetro(g)); }
const pct = (v) => `${Math.round(v * 100)} %`;
const RENEWABLE = new Set(['wind', 'solar', 'hydro', 'geothermal', 'battery']);
const FOSSIL = new Set(['coal', 'gas', 'nuclear', 'district_heating', 'incinerator']);
const PROCESSING = ['food_factory', 'sawmill', 'steelworks', 'refinery'];
export const LANDMARK_KEYS = () => Object.keys(BUILDINGS).filter((k) => BUILDINGS[k].landmark);

// Katastrophen kommen über den Ereignisbus des Registers (Agent S4). Zähler auf Modulebene, jedes
// Spiel merkt sich, was es schon gesehen hat.
let disasterSeq = 0;
let lastDisaster = null;
busOn('disaster', (e) => {
  if (!e) return;
  if (e.phase === 'end' || e.phase === 'start') { disasterSeq++; lastDisaster = { ...e }; }
});

// Kennzahlen, die mehrere Erfolge, Ziele und der Ratgeber brauchen – einmal am Tag berechnet.
export function cityFacts(g) {
  const F = {
    byKey: {}, byCat: {}, level5: 0, level4: 0, zoneCount: [0, 0, 0, 0, 0], landmarks: 0, parks: 0,
    bridges: 0, avenue: 0, roads: 0, lanes: 0, renewMW: 0, fossilMW: 0, construct: 0,
    lines: 0, loopStops: 0, hubLines: 0, wagons: 0, trains: 0, stations: 0, maxLineLen: 0, crowded: 0,
  };
  let cSum = 0, cW = 0;
  for (const b of g.buildings.values()) {
    if (b.zone) {
      F.zoneCount[b.zone]++;
      if (b.zone === Z.RES && !b.abandoned && b.occ > 0) { cSum += b.commute * b.occ; cW += b.occ; }
      if (!b.abandoned && b.level >= 5) F.level5++;
      if (!b.abandoned && b.level >= 4) F.level4++;
      if (b.construct < 1) F.construct++;
      continue;
    }
    F.byKey[b.key] = (F.byKey[b.key] || 0) + 1;
    const d = BUILDINGS[b.key];
    if (!d) continue;
    F.byCat[d.cat] = (F.byCat[d.cat] || 0) + 1;
    if (d.landmark) F.landmarks++;
    if (d.cat === 'parks') F.parks++;
    if (d.power && b.construct >= 1) {
      if (RENEWABLE.has(b.key)) F.renewMW += d.power * g.mods.power;
      else F.fossilMW += d.power * g.mods.power;
    }
  }
  F.commute = cW > 0 ? cSum / cW : 0;
  const road = g.road, ter = g.world.terrain;
  for (let i = 0; i < g.N; i++) {
    const r = road[i];
    if (!r || r === R.HIGHWAY) continue;
    F.roads++;
    if (ter[i] === T.WATER) F.bridges++;
    if (r === R.AVENUE) F.avenue++;
    if (r === R.LANE) F.lanes++;
  }
  const tr = g.transit;
  F.lines = tr.lines.length;
  F.trains = tr.trains.length;
  F.wagons = tr.totalWagons();
  F.stations = tr.stations.size;
  for (const l of tr.lines) {
    if (l.loop) F.loopStops = Math.max(F.loopStops, l.stops.length);
    F.maxLineLen = Math.max(F.maxLineLen, l.length || 0);
  }
  if (tr.stationLines) for (const set of tr.stationLines.values()) F.hubLines = Math.max(F.hubLines, set.size);
  for (const st of tr.stations.values()) if (st.waiting.length > TRANSIT.stationCapacity) F.crowded++;
  return F;
}
const has = (F, key) => (F.byKey[key] || 0) > 0;

// ---------------------------------------------------------------------------------------------
// Erfolge
// ---------------------------------------------------------------------------------------------
export const TIERS = {
  1: { name: 'Bronze', pts: 10, color: '#b9783f' },
  2: { name: 'Silber', pts: 25, color: '#8d99a8' },
  3: { name: 'Gold', pts: 50, color: '#d9a21b' },
};
export const RANKS = [
  { pts: 0, name: 'Bürgerbeauftragte:r' },
  { pts: 40, name: 'Ortsvorsteher:in' },
  { pts: 120, name: 'Bürgermeister:in' },
  { pts: 260, name: 'Oberbürgermeister:in' },
  { pts: 480, name: 'Ehrenbürger:in' },
  { pts: 800, name: 'Stadtlegende' },
  { pts: 1200, name: 'Mythos der Region' },
];
export const ACH_CATS = [
  { id: 'growth', name: 'Wachstum' },
  { id: 'money', name: 'Wirtschaft' },
  { id: 'transit', name: 'Verkehr' },
  { id: 'eco', name: 'Umwelt & Versorgung' },
  { id: 'people', name: 'Gesellschaft' },
  { id: 'culture', name: 'Kultur' },
  { id: 'challenge', name: 'Herausforderungen' },
  { id: 'secret', name: 'Geheim' },
];

const popGate = (g, need) => Math.min(0.95, g.stats.pop / need);
// v(g, F, C) → aktueller Wert, goal → Ziel. hint(g, F, C) → kurzer Text zum Stand (optional).
export const ACHIEVEMENTS = [
  // --- Wachstum
  { id: 'pop100', cat: 'growth', tier: 1, name: 'Erste Siedler', desc: '100 Menschen leben in deiner Stadt.', goal: 100, v: (g, F, C) => C.maxPop },
  { id: 'pop1k', cat: 'growth', tier: 1, name: 'Kleinstadtflair', desc: '1.000 Einwohner.', goal: 1000, v: (g, F, C) => C.maxPop },
  { id: 'pop5k', cat: 'growth', tier: 2, name: 'Großstadtluft', desc: '5.000 Einwohner.', goal: 5000, v: (g, F, C) => C.maxPop },
  { id: 'pop10k', cat: 'growth', tier: 2, name: 'Metropole', desc: '10.000 Einwohner.', goal: 10000, v: (g, F, C) => C.maxPop },
  { id: 'pop25k', cat: 'growth', tier: 3, name: 'Weltstadt', desc: '25.000 Einwohner.', goal: 25000, v: (g, F, C) => C.maxPop },
  { id: 'pop50k', cat: 'growth', tier: 3, name: 'Megastadt', desc: '50.000 Einwohner – ein Häusermeer bis zum Horizont.', goal: 50000, v: (g, F, C) => C.maxPop },
  { id: 'level5', cat: 'growth', tier: 2, name: 'Skyline', desc: '10 Gebäude auf Stufe 5.', goal: 10, v: (g, F) => F.level5 },
  { id: 'mixed', cat: 'growth', tier: 1, name: 'Bunte Mischung', desc: 'Je 20 Gebäude in allen vier Zonen.', goal: 20, v: (g, F) => Math.min(F.zoneCount[1], F.zoneCount[2], F.zoneCount[3], F.zoneCount[4]) },
  { id: 'days100', cat: 'growth', tier: 2, name: 'Langer Atem', desc: '100 Tage im Amt.', goal: 100, v: (g) => g.day() },
  { id: 'year1', cat: 'growth', tier: 3, name: 'Ein Jahr im Amt', desc: 'Ein ganzes Spieljahr (364 Tage) regiert.', goal: 364, v: (g) => g.day() },
  // --- Wirtschaft
  { id: 'rich100k', cat: 'money', tier: 1, name: 'Sparschwein', desc: '100.000 € in der Stadtkasse.', goal: 100000, v: (g, F, C) => C.maxMoney, fmt: fmtMoney },
  { id: 'rich1m', cat: 'money', tier: 3, name: 'Goldene Stadtkasse', desc: '1 Million € in der Stadtkasse.', goal: 1000000, v: (g, F, C) => C.maxMoney, fmt: fmtMoney },
  { id: 'net5k', cat: 'money', tier: 2, name: 'Schwarze Zahlen', desc: 'Eine Tagesbilanz von mindestens +5.000 €.', goal: 5000, v: (g, F, C) => C.maxNet, fmt: fmtMoney },
  { id: 'loanfree', cat: 'money', tier: 1, name: 'Schuldenfrei', desc: 'Einen Kredit vollständig zurückgezahlt.', goal: 1, v: (g, F, C) => C.loansRepaid },
  { id: 'lowtax', cat: 'money', tier: 2, name: 'Steueroase', desc: '14 Tage alle Steuern ≤ 6 % – bei mindestens 1.000 Einwohnern und positiver Bilanz.', goal: 14, v: (g, F, C) => C.lowTaxStreak },
  { id: 'comeback', cat: 'money', tier: 2, name: 'Phönix aus der Asche', desc: 'Nach über 10.000 € Schulden wieder 50.000 € in der Kasse.', goal: 1, v: (g, F, C) => (C.comeback ? 1 : 0), hint: (g, F, C) => (C.deepDebt ? 'Tief im Minus gewesen – jetzt wieder hoch!' : 'Erst einmal tief ins Minus …') },
  { id: 'tourism1k', cat: 'money', tier: 2, name: 'Reiseziel', desc: '1.000 Touristen an einem Tag.', goal: 1000, v: (g, F, C) => C.maxTourism },
  { id: 'industry', cat: 'money', tier: 2, name: 'Werkbank der Region', desc: '1.500 Arbeitsplätze in der Industrie.', goal: 1500, v: (g) => g.stats.jobsByZone[3] },
  { id: 'chain', cat: 'money', tier: 1, name: 'Wertschöpfung', desc: 'Eine Verarbeitungsfabrik gebaut (Lebensmittel, Säge, Stahl oder Raffinerie).', goal: 1, v: (g, F) => PROCESSING.reduce((a, k) => a + (F.byKey[k] || 0), 0) },
  { id: 'export', cat: 'money', tier: 2, name: 'Exportweltmeister', desc: 'Güterbahnhof und Frachthafen gebaut.', goal: 2, v: (g, F) => (has(F, 'cargo_rail') ? 1 : 0) + (has(F, 'cargo_harbor') ? 1 : 0) },
  // --- Verkehr
  { id: 'firstline', cat: 'transit', tier: 1, metro: true, name: 'Erste Fahrt', desc: 'Die erste Pulsbahn-Linie fährt.', goal: 1, v: (g, F) => F.lines },
  { id: 'lines5', cat: 'transit', tier: 2, metro: true, name: 'Liniennetz', desc: 'Fünf Pulsbahn-Linien gleichzeitig.', goal: 5, v: (g, F) => F.lines },
  { id: 'ring', cat: 'transit', tier: 2, metro: true, name: 'Ringbahn', desc: 'Eine Ringlinie mit mindestens 6 Stationen.', goal: 6, v: (g, F) => F.loopStops },
  { id: 'hub', cat: 'transit', tier: 2, metro: true, name: 'Umsteigeknoten', desc: 'Eine Station, an der drei Linien halten.', goal: 3, v: (g, F) => F.hubLines },
  { id: 'riders500', cat: 'transit', tier: 2, metro: true, name: 'Volle Züge', desc: '500 Fahrgäste an einem Tag.', goal: 500, v: (g, F, C) => C.maxRiders },
  { id: 'riders10k', cat: 'transit', tier: 3, metro: true, name: 'Pulsschlag', desc: '10.000 Fahrgäste insgesamt befördert.', goal: 10000, v: (g) => g.transit.deliveredTotal },
  { id: 'wagons', cat: 'transit', tier: 1, metro: true, name: 'Lange Züge', desc: '15 Waggons im Einsatz.', goal: 15, v: (g, F) => F.wagons },
  { id: 'longline', cat: 'transit', tier: 1, metro: true, name: 'Langstrecke', desc: 'Eine Linie mit mindestens 60 Feldern Länge.', goal: 60, v: (g, F) => Math.round(F.maxLineLen) },
  { id: 'flow', cat: 'transit', tier: 3, name: 'Grüne Welle', desc: 'Ø Verkehrsfluss ≥ 95 % an einem Tag – bei mindestens 5.000 Einwohnern.', goal: 1, v: (g, F, C) => (g.stats.pop >= 5000 && C.dayFlow >= 0.95 ? 1 : popGate(g, 5000) * 0.9), hint: (g, F, C) => `Ø Fluss gestern ${pct(C.dayFlow)}` },
  { id: 'bridges', cat: 'transit', tier: 1, name: 'Brückenbauer', desc: '25 Brückenfelder über Wasser.', goal: 25, v: (g, F) => F.bridges },
  { id: 'avenue', cat: 'transit', tier: 1, name: 'Prachtboulevard', desc: '60 Felder Allee.', goal: 60, v: (g, F) => F.avenue },
  { id: 'buses', cat: 'transit', tier: 1, name: 'Bitte einsteigen', desc: 'Ein Busdepot oder Straßenbahndepot gebaut.', goal: 1, v: (g, F) => (F.byKey.bus_depot || 0) + (F.byKey.tram_depot || 0) },
  { id: 'airport', cat: 'transit', tier: 3, name: 'Abflug!', desc: 'Einen Flughafen gebaut.', goal: 1, v: (g, F) => F.byKey.airport || 0 },
  // --- Umwelt & Versorgung
  { id: 'green', cat: 'eco', tier: 2, name: 'Grüne Lunge', desc: '25 Parks und Freizeitanlagen.', goal: 25, v: (g, F) => F.parks },
  { id: 'clean', cat: 'eco', tier: 2, name: 'Saubere Luft', desc: 'Ø Verschmutzung unter 3 % – bei mindestens 3.000 Einwohnern.', goal: 1, v: (g) => (g.stats.pop >= 3000 && g.stats.pollutionAvg < 0.03 ? 1 : popGate(g, 3000) * 0.9), hint: (g) => `Ø Verschmutzung ${pct(g.stats.pollutionAvg)}` },
  { id: 'renew', cat: 'eco', tier: 3, name: 'Energiewende', desc: '1.500 MW aus Wind, Sonne, Wasser und Erdwärme – ohne ein einziges fossiles Kraftwerk.', goal: 1500, v: (g, F) => (F.fossilMW > 0 ? Math.min(1499, F.renewMW * 0.5) : F.renewMW), hint: (g, F) => (F.fossilMW > 0 ? 'Fossile Kraftwerke zählen dagegen.' : `${fmt(F.renewMW)} MW sauber`) },
  { id: 'fusion', cat: 'eco', tier: 3, name: 'Sternenfeuer', desc: 'Einen Fusionsreaktor gebaut.', goal: 1, v: (g, F) => F.byKey.fusion || 0 },
  { id: 'recycle', cat: 'eco', tier: 1, name: 'Kreislaufwirtschaft', desc: 'Recyclinghof gebaut und Mülltrennung eingeführt.', goal: 2, v: (g, F) => (has(F, 'recycling') ? 1 : 0) + (g.policies.has('recycling') ? 1 : 0) },
  { id: 'sewage', cat: 'eco', tier: 1, name: 'Klare Sache', desc: 'Eine Kläranlage gebaut.', goal: 1, v: (g, F) => F.byKey.sewage_plant || 0 },
  { id: 'forest', cat: 'eco', tier: 1, name: 'Waldschützer', desc: 'Mit 1.500 Einwohnern noch mindestens 800 Bäume auf der Karte.', goal: 1, v: (g, F, C) => (g.stats.pop >= 1500 && C.trees >= 800 ? 1 : popGate(g, 1500) * (C.trees >= 800 ? 0.95 : 0.5)), hint: (g, F, C) => `${fmt(C.trees)} Bäume` },
  // --- Gesellschaft
  { id: 'happy80', cat: 'people', tier: 3, name: 'Glückliche Stadt', desc: '7 Tage in Folge mindestens 80 % Glück – bei mindestens 500 Einwohnern.', goal: 7, v: (g, F, C) => C.happyStreak },
  { id: 'edu', cat: 'people', tier: 2, name: 'Bildungsrepublik', desc: 'Ø Bildung ≥ 60 % – bei mindestens 2.000 Einwohnern.', goal: 1, v: (g) => (g.stats.pop >= 2000 && g.stats.edu >= 0.6 ? 1 : Math.min(popGate(g, 2000), g.stats.edu / 0.6) * 0.95), hint: (g) => `Ø Bildung ${pct(g.stats.edu)}` },
  { id: 'fullemploy', cat: 'people', tier: 2, name: 'Vollbeschäftigung', desc: 'Arbeitslosigkeit unter 3 % – bei mindestens 3.000 Einwohnern.', goal: 1, v: (g) => (g.stats.pop >= 3000 && g.stats.unemployment < 0.03 ? 1 : popGate(g, 3000) * 0.9), hint: (g) => `Arbeitslos ${pct(g.stats.unemployment)}` },
  { id: 'safe', cat: 'people', tier: 2, name: 'Sichere Straßen', desc: 'Ø Kriminalität unter 8 % – bei mindestens 3.000 Einwohnern.', goal: 1, v: (g) => (g.stats.pop >= 3000 && g.stats.crimeAvg < 0.08 ? 1 : popGate(g, 3000) * 0.9), hint: (g) => `Ø Kriminalität ${pct(g.stats.crimeAvg)}` },
  { id: 'healthy', cat: 'people', tier: 1, name: 'Gesund und munter', desc: 'Ø Gesundheitsversorgung ≥ 80 % – bei mindestens 2.000 Einwohnern.', goal: 1, v: (g) => (g.stats.pop >= 2000 && g.stats.healthAvg >= 0.8 ? 1 : popGate(g, 2000) * 0.9), hint: (g) => `Ø Gesundheit ${pct(g.stats.healthAvg)}` },
  { id: 'policies', cat: 'people', tier: 1, name: 'Paragrafenreiter', desc: 'Sechs verschiedene Verordnungen ausprobiert.', goal: 6, v: (g, F, C) => C.policies.length },
  { id: 'cards25', cat: 'people', tier: 2, name: 'Kartenspieler', desc: '25 Wochenkarten gewählt.', goal: 25, v: (g) => g.cardsTaken.length },
  { id: 'events20', cat: 'people', tier: 2, name: 'Volksnah', desc: '20 Ereignisse im Anzeiger entschieden.', goal: 20, v: (g, F, C) => C.events },
  { id: 'firefighter', cat: 'people', tier: 1, name: 'Brandmeister', desc: '15 Brände gelöscht.', goal: 15, v: (g, F, C) => C.fires },
  { id: 'seasons', cat: 'people', tier: 2, name: 'Vier Jahreszeiten', desc: 'Frühling, Sommer, Herbst und Winter erlebt.', goal: 4, v: (g, F, C) => C.seasons.length, req: (g) => typeof g.ext.weather?.season === 'string' },
  { id: 'districts', cat: 'people', tier: 1, name: 'Kiezgefühl', desc: 'Vier Bezirke mit eigenem Namen.', goal: 4, v: (g) => g.ext.districts?.list?.length || 0, req: (g) => Array.isArray(g.ext.districts?.list) },
  { id: 'disaster', cat: 'people', tier: 2, name: 'Krisenfest', desc: 'Eine Katastrophe überstanden.', goal: 1, v: (g, F, C) => C.disasters },
  // --- Kultur
  { id: 'landmark1', cat: 'culture', tier: 1, name: 'Postkartenmotiv', desc: 'Das erste Wahrzeichen steht.', goal: 1, v: (g, F) => F.landmarks },
  { id: 'landmarks5', cat: 'culture', tier: 2, name: 'Sehenswürdigkeiten', desc: 'Fünf Wahrzeichen.', goal: 5, v: (g, F) => F.landmarks },
  { id: 'landmarksAll', cat: 'culture', tier: 3, name: 'Alle Wunder der Stadt', desc: 'Jedes Wahrzeichen gebaut.', goal: 0, goalFn: () => LANDMARK_KEYS().length, v: (g, F) => LANDMARK_KEYS().filter((k) => has(F, k)).length },
  { id: 'doener', cat: 'culture', tier: 1, name: 'Chili-Cheese-Diplomat', desc: 'Mêrdîn’s Dönerpalast eröffnet.', goal: 1, v: (g, F) => F.byKey.doener || 0 },
  { id: 'culture3', cat: 'culture', tier: 2, name: 'Kulturhauptstadt', desc: 'Museum, Opernhaus und Dom.', goal: 3, v: (g, F) => ['museum', 'opera', 'cathedral'].filter((k) => has(F, k)).length },
  { id: 'fun', cat: 'culture', tier: 2, name: 'Rummelplatz', desc: 'Riesenrad, Freizeitpark und Stadion.', goal: 3, v: (g, F) => ['ferris', 'themepark', 'stadium'].filter((k) => has(F, k)).length },
  // --- Herausforderungen
  { id: 'scenario', cat: 'challenge', tier: 2, metro: true, name: 'Auftrag erfüllt', desc: 'Ein Szenario gewonnen.', goal: 1, v: (g, F, C) => C.scenarioWins },
  { id: 'scenario3', cat: 'challenge', tier: 3, metro: true, name: 'Drei Sterne', desc: 'Ein Szenario mit drei Sternen abgeschlossen.', goal: 3, v: (g, F, C) => C.bestStars },
  { id: 'metro1k', cat: 'challenge', tier: 2, metro: true, name: 'Netzplaner', desc: '1.000 Punkte im Metro-Modus.', goal: 1000, v: (g) => metroScore(g) },
  { id: 'metro5k', cat: 'challenge', tier: 3, metro: true, name: 'Netzplan-Meister', desc: '3.000 Punkte im Metro-Modus.', goal: 3000, v: (g) => metroScore(g) },
  { id: 'quests3', cat: 'challenge', tier: 1, name: 'Hilfsbereit', desc: 'Drei Bürgeraufträge erfüllt.', goal: 3, v: (g, F, C) => C.questsDone },
  { id: 'quests12', cat: 'challenge', tier: 2, name: 'Auftragnehmer', desc: 'Zwölf Bürgeraufträge erfüllt.', goal: 12, v: (g, F, C) => C.questsDone },
  { id: 'metroweeks', cat: 'challenge', tier: 2, metro: true, name: 'Pünktlich wie die Uhr', desc: 'Im Metro-Modus 5 Wochen ohne Überlauf.', goal: 5, v: (g) => (isMetro(g) && S(g).metro ? Math.floor((g.day() - S(g).metro.startDay) / 7) : 0) },
  // --- Geheim
  { id: 'demolish', cat: 'secret', tier: 1, secret: true, name: 'Abrissbirne', desc: '50 Gebäude eigenhändig abgerissen.', goal: 50, v: (g, F, C) => C.demolished },
  { id: 'debt', cat: 'secret', tier: 1, secret: true, name: 'Pleitegeier', desc: 'Die Stadtkasse stand bei unter −20.000 €.', goal: 1, v: (g, F, C) => (C.minMoney <= -20000 ? 1 : 0) },
  { id: 'jam', cat: 'secret', tier: 1, secret: true, name: 'Stauprofi', desc: 'Ø Verkehrsfluss unter 55 % bei mindestens 1.000 Einwohnern.', goal: 1, v: (g, F, C) => (C.worstFlow < 0.55 ? 1 : 0) },
  { id: 'ghost', cat: 'secret', tier: 1, secret: true, name: 'Geisterstadt', desc: '20 verlassene Gebäude gleichzeitig.', goal: 20, v: (g, F, C) => C.maxAbandoned },
  { id: 'pixel', cat: 'secret', tier: 2, secret: true, name: 'Pixel ist wieder da!', desc: 'Die entlaufene Katze Pixel wurde gefunden.', goal: 1, v: (g, F, C) => (C.pixel ? 1 : 0) },
  { id: 'nightowl', cat: 'secret', tier: 1, secret: true, name: 'Nachteule', desc: 'Nach Mitternacht (echte Uhrzeit) an der Stadt gebaut.', goal: 1, v: (g, F, C) => (C.nightowl ? 1 : 0) },
];
const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
export const achievementById = (id) => ACH_BY_ID[id] || null;
const goalOf = (a) => (a.goalFn ? a.goalFn() : a.goal);

function freshCounters() {
  return {
    maxPop: 0, maxMoney: 0, minMoney: 0, maxNet: 0, maxTourism: 0, maxRiders: 0, maxAbandoned: 0,
    happyStreak: 0, lowTaxStreak: 0, loansRepaid: 0, lastLoans: 0, deepDebt: false, comeback: false,
    fires: 0, demolished: 0, events: 0, disasters: 0, policies: [], seasons: [], trees: 0,
    dayFlow: 1, worstFlow: 1, scenarioWins: 0, bestStars: 0, pixel: false, nightowl: false, questsDone: 0, questsFailed: 0,
  };
}

// Stand aller Erfolge für die Oberfläche.
export function achievementState(g) {
  const st = S(g);
  if (!st) return [];
  const F = st.facts || cityFacts(g);
  const C = st.counters;
  return ACHIEVEMENTS.map((a) => {
    const skipped = st.skip.includes(a.id);
    const avail = (!a.req || a.req(g)) && !skipped;
    const goal = goalOf(a) || 1;
    let value = 0;
    try { value = a.v(g, F, C) || 0; } catch (e) { value = 0; }
    const unlocked = st.ach[a.id] !== undefined;
    const progress = unlocked ? 1 : clamp(value / goal, 0, 0.999);
    let hint = '';
    try { hint = a.hint ? a.hint(g, F, C) : ''; } catch (e) { hint = ''; }
    return { a, avail, skipped, goal, value, unlocked, day: st.ach[a.id], progress, hint };
  });
}
export function achievementPoints(g) {
  const st = S(g);
  if (!st) return 0;
  let p = 0;
  for (const id of Object.keys(st.ach)) { const a = ACH_BY_ID[id]; if (a) p += TIERS[a.tier].pts; }
  return p;
}
export function rankFor(points) {
  let r = RANKS[0], next = null;
  for (let i = 0; i < RANKS.length; i++) if (points >= RANKS[i].pts) { r = RANKS[i]; next = RANKS[i + 1] || null; }
  return { rank: r, next };
}

function unlock(g, a) {
  const st = S(g);
  if (st.ach[a.id] !== undefined) return;
  st.ach[a.id] = g.day();
  const tier = TIERS[a.tier];
  g.pushNews({ kind: 'report', author: 'Ehrentafel', text: `Erfolg freigeschaltet: „${a.name}" (${tier.name}, +${tier.pts} Punkte) – ${a.desc}`, mood: 'good' });
  pushInbox(g, { type: 'achievement', id: a.id });
  g.emit('achievement', a);
  busEmit('achievement', { g, a });
}

function checkAchievements(g) {
  const st = S(g);
  if (!achievementsEnabled(g)) return;
  if (!st.facts) st.facts = cityFacts(g);
  const F = st.facts;
  const C = st.counters;
  const metro = isMetro(g);
  for (const a of ACHIEVEMENTS) {
    if (st.ach[a.id] !== undefined) continue;
    if (metro && !a.metro) continue; // im Metro-Modus zählt nur, was der Spieler selbst geleistet hat
    if (st.skip.includes(a.id)) continue;
    if (a.req && !a.req(g)) continue;
    let v = 0;
    try { v = a.v(g, F, C) || 0; } catch (e) { continue; }
    if (v >= (goalOf(a) || 1)) unlock(g, a);
  }
}

function updateCounters(g) {
  const st = S(g), C = st.counters, s = g.stats;
  C.maxPop = Math.max(C.maxPop, s.pop);
  C.maxMoney = Math.max(C.maxMoney, g.money);
  C.minMoney = Math.min(C.minMoney, g.money);
  const net = g.lastBudget ? g.lastBudget.net : 0;
  C.maxNet = Math.max(C.maxNet, net);
  C.maxTourism = Math.max(C.maxTourism, s.tourism || 0);
  C.maxRiders = Math.max(C.maxRiders, s.ridersToday || 0);
  C.maxAbandoned = Math.max(C.maxAbandoned, s.abandoned || 0);
  C.happyStreak = s.pop >= 500 && s.happiness >= 80 ? C.happyStreak + 1 : 0;
  const lowTax = [1, 2, 3, 4].every((z) => g.taxes[z] <= 6);
  C.lowTaxStreak = lowTax && s.pop >= 1000 && net > 0 ? C.lowTaxStreak + 1 : 0;
  if (g.loans.length < C.lastLoans) C.loansRepaid += C.lastLoans - g.loans.length;
  C.lastLoans = g.loans.length;
  if (g.money < -10000) C.deepDebt = true;
  if (C.deepDebt && g.money >= 50000) C.comeback = true;
  for (const id of g.policies) if (!C.policies.includes(id)) C.policies.push(id);
  const season = g.ext.weather?.season;
  if (typeof season === 'string' && !C.seasons.includes(season)) C.seasons.push(season);
  // Tagesmittel des Verkehrsflusses
  const d = st.day;
  if (d.flowN > 0) {
    C.dayFlow = d.flowSum / d.flowN;
    if (s.pop >= 1000) C.worstFlow = Math.min(C.worstFlow, C.dayFlow);
  }
  d.flowSum = 0; d.flowN = 0;
  let trees = 0;
  const tr = g.world.trees;
  for (let i = 0; i < g.N; i++) if (tr[i]) trees++;
  C.trees = trees;
}

// ---------------------------------------------------------------------------------------------
// Planer: baut Straßen, Zonen und Versorgung für Szenarien und den Metro-Modus
// ---------------------------------------------------------------------------------------------
const inb = (g, x, y) => x >= 0 && y >= 0 && x < g.W && y < g.H;

// Kostenlos bauen (automatisches Wachstum im Metro-Modus). Die Kasse bleibt unberührt,
// Gutscheine und Abriss-Zähler werden nicht angetastet.
export function freeBuild(g, fn) {
  const cm = g.costMul, money = g.money, st = S(g);
  g.costMul = 0;
  if (st) st.auto = (st.auto || 0) + 1;
  try { return fn(); } finally { g.costMul = cm; g.money = money; if (st) st.auto--; }
}

// Straße als gerade Linie; Fels, Gebäude und Stationen werden übersprungen.
function roadLine(g, ax, ay, bx, by, type = R.STREET, bridges = true) {
  const tiles = [];
  if (ay === by) { for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) if (inb(g, x, ay)) tiles.push(ay * g.W + x); }
  else if (ax === bx) { for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) if (inb(g, ax, y)) tiles.push(y * g.W + ax); }
  return roadTiles(g, tiles, type, bridges);
}
function roadTiles(g, tiles, type = R.STREET, bridges = true) {
  const ok = tiles.filter((i) => {
    const ter = g.world.terrain[i];
    if (ter === T.ROCK || g.bld[i] || g.road[i] === R.HIGHWAY) return false;
    if (g.stationAt[i] && !g.road[i]) return false;
    if (!bridges && ter === T.WATER) return false;
    return g.road[i] !== type;
  });
  if (!ok.length) return 0;
  const r = g.buildRoad(ok, type);
  return r.ok ? ok.length : 0;
}
function zoneRect(g, x0, y0, x1, y1, z) {
  const tiles = [];
  for (let y = Math.max(0, y0); y <= Math.min(g.H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(g.W - 1, x1); x++) tiles.push(y * g.W + x);
  if (tiles.length) g.zoneTiles(tiles, z);
}

function touchesMainRoad(g, x, y, w, h) {
  for (let yy = y - 1; yy <= y + h; yy++) for (let xx = x - 1; xx <= x + w; xx++) {
    if (!inb(g, xx, yy)) continue;
    const inside = xx >= x && xx < x + w && yy >= y && yy < y + h;
    const corner = (xx === x - 1 || xx === x + w) && (yy === y - 1 || yy === y + h);
    if (inside || corner) continue;
    const i = yy * g.W + xx;
    if (g.road[i] && g.road[i] !== R.HIGHWAY && g.roadComp[i] === g.outsideComp) return true;
  }
  return false;
}

// Spiralsuche nach einem freien Bauplatz an einer Straße des Hauptnetzes.
export function placeNear(g, key, cx, cy, maxR = 18, opts = {}) {
  const d = BUILDINGS[key];
  if (!d) return null;
  const avoidZones = opts.avoidZones !== false;
  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = Math.round(cx + dx), y = Math.round(cy + dy);
      for (const rot of [0, 1]) {
        const [w, h] = g.footprint(key, rot);
        if (!inb(g, x, y) || !inb(g, x + w - 1, y + h - 1)) continue;
        if (avoidZones) {
          let zoned = false;
          for (let yy = y; yy < y + h && !zoned; yy++) for (let xx = x; xx < x + w; xx++) if (g.zone[yy * g.W + xx]) { zoned = true; break; }
          if (zoned) continue;
        }
        if (g.checkPlace(key, x, y, rot)) continue;
        if (!touchesMainRoad(g, x, y, w, h)) continue;
        const res = g.placeBuilding(key, x, y, rot);
        if (res.ok) {
          if (opts.instant) res.building.construct = 1;
          return res.building;
        }
      }
    }
  }
  return null;
}

// Zonen mit fertigen Gebäuden füllen (Startstädte). levelFn(x, y) → gewünschte Stufe.
function populate(g, { fill = 0.85, levelFn = () => 1, occ = [0.75, 1], rng = g.rng, abandon = 0 } = {}) {
  let n = 0;
  for (let t = 0; t < g.N; t++) {
    const z = g.zone[t];
    if (!z || g.bld[t] || g.road[t]) continue;
    if (!isBuildableZoneTile(g, t)) continue;
    if (rng() > fill) continue;
    const [w, h] = chooseFootprint(g, t, z);
    const b = g.spawnZoneBuilding(t, z, w, h);
    const lv = clamp(Math.round(levelFn(b.x, b.y, z)), 1, g.maxLevelAt(b.x, b.y));
    if (lv > 1) g.setBuildingLevel(b, lv);
    b.construct = 1;
    b.age = 10 + Math.floor(rng() * 40);
    if (z === Z.RES) {
      b.occ = Math.round(b.cap * (occ[0] + rng() * (occ[1] - occ[0])));
      b.edu = 0.1 + rng() * 0.25;
    }
    if (abandon > 0 && rng() < abandon) g.abandonBuilding(b);
    n++;
  }
  return n;
}

// Strom und Wasser im Hauptnetz auf Bedarf bringen (kostenlos, sofort fertig).
function ensureUtilities(g, { margin = 1.3, powerKey = 'coal', near = null, waterKeys = ['pump', 'watertower'], extra = 40 } = {}) {
  const hy = g.world.highwayY, x0 = g.world.highwayEnd % g.W + 1;
  const [nx, ny] = near || [x0 + 4, hy + 4];
  let placed = 0;
  computeUtilities(g);
  for (let guard = 0; guard < 24; guard++) {
    const oc = g.outsideComp;
    const ps = g.util.pSup?.[oc] || 0, pd = g.util.pDem?.[oc] || 0;
    if (ps >= pd * margin + extra) break;
    const b = placeNear(g, powerKey, nx, ny, 26, { instant: true }) || placeNear(g, 'wind', nx, ny, 26, { instant: true });
    if (!b) break;
    placed++;
    computeUtilities(g);
  }
  for (let guard = 0; guard < 30; guard++) {
    const oc = g.outsideComp;
    const ws = g.util.wSup?.[oc] || 0, wd = g.util.wDem?.[oc] || 0;
    if (ws >= wd * margin + extra) break;
    let b = null;
    for (const k of waterKeys) { b = placeNear(g, k, nx, ny, 30, { instant: true }); if (b) break; }
    if (!b) break;
    placed++;
    computeUtilities(g);
  }
  return placed;
}

// Dienste dort ergänzen, wo Zonengebäude keine Abdeckung haben.
function ensureServices(g, keys = ['fire', 'police', 'clinic', 'school', 'landfill'], maxEach = 4) {
  computeCoverage(g);
  const covType = { fire: 'fire', police: 'police', clinic: 'health', school: 'edu', landfill: 'garbage', hospital: 'health' };
  for (const key of keys) {
    const type = covType[key];
    if (!type || !g.isUnlocked(key)) continue;
    for (let k = 0; k < maxEach; k++) {
      let worst = null, wv = 1e9;
      for (const b of g.buildings.values()) {
        if (!b.zone || b.abandoned) continue;
        const v = g.cov[type][b.y * g.W + b.x];
        if (v < 0.15 && v < wv) { wv = v; worst = b; }
      }
      if (!worst) break;
      if (!placeNear(g, key, worst.x, worst.y, 9, { instant: true, avoidZones: false })) break;
      computeCoverage(g);
    }
  }
}

// Simulation ohne Oberfläche vorspulen (Karten/Ereignisse werden verworfen).
function settle(g, days) {
  const sp = g.speed, noEv = g.sandboxNoEvents;
  g.speed = 3;
  g.sandboxNoEvents = true;
  const steps = Math.round(days * 75);
  for (let k = 0; k < steps; k++) {
    g.update(0.1);
    g.pendingCards = null;
    g.pendingEvent = null;
    g.gameOver = false;
  }
  g.speed = sp;
  g.sandboxNoEvents = noEv;
}

// Eine kleine Stadt nach Rastermuster an der Autobahn (für Szenarien mit Startstadt).
function buildTown(g, o = {}) {
  const W = g.W, hy = g.world.highwayY, x0 = g.world.highwayEnd % W + 1;
  const len = Math.min(o.len || 34, W - x0 - 4);
  const rows = o.rows || 2, gap = o.rowGap || 6, step = o.step || 5;
  const ext = rows * gap;
  roadLine(g, x0, hy, x0 + len, hy, o.main || R.AVENUE);
  for (let x = x0 + 3; x <= x0 + len; x += step) roadLine(g, x, hy - ext, x, hy + ext, o.cross || R.STREET);
  for (let k = 1; k <= rows; k++) for (const s of [-1, 1]) roadLine(g, x0 + 3, hy + s * k * gap, x0 + len, hy + s * k * gap, o.ring || R.STREET);
  const split = Math.round(x0 + 4 + (len - 4) * (o.comShare ?? 0.45));
  zoneRect(g, x0 + 4, hy - ext + 1, x0 + len, hy - 1, Z.RES);
  zoneRect(g, x0 + 4, hy + 1, split, hy + ext - 1, Z.COM);
  zoneRect(g, split + 1, hy + 1, x0 + len, hy + ext - 1, Z.IND);
  if (o.office) zoneRect(g, x0 + 4, hy - ext - gap + 1, x0 + len, hy - ext - 1, Z.OFF);
  return { x0, hy, len, ext };
}

// Landflächen (zusammenhängendes Land ohne Wasser) – für „Inselbrücken".
function landComponents(g) {
  const { W, H, N } = g;
  const comp = new Int32Array(N).fill(-1);
  const sizes = [];
  const ter = g.world.terrain;
  for (let i = 0; i < N; i++) {
    if (ter[i] === T.WATER || comp[i] >= 0) continue;
    const c = sizes.length;
    let sz = 0;
    const stack = [i];
    comp[i] = c;
    while (stack.length) {
      const k = stack.pop();
      sz++;
      const x = k % W, y = (k / W) | 0;
      if (x > 0 && ter[k - 1] !== T.WATER && comp[k - 1] < 0) { comp[k - 1] = c; stack.push(k - 1); }
      if (x < W - 1 && ter[k + 1] !== T.WATER && comp[k + 1] < 0) { comp[k + 1] = c; stack.push(k + 1); }
      if (y > 0 && ter[k - W] !== T.WATER && comp[k - W] < 0) { comp[k - W] = c; stack.push(k - W); }
      if (y < H - 1 && ter[k + W] !== T.WATER && comp[k + W] < 0) { comp[k + W] = c; stack.push(k + W); }
    }
    sizes.push(sz);
  }
  return { comp, sizes };
}
function settledIslands(g, minBuildings = 6) {
  const st = S(g);
  if (!st._land) st._land = landComponents(g);
  const { comp, sizes } = st._land;
  const cnt = new Map();
  for (const b of g.buildings.values()) {
    if (!b.zone || b.abandoned || b.occ <= 0) continue;
    const c = comp[b.y * g.W + b.x];
    if (c >= 0 && sizes[c] >= 60) cnt.set(c, (cnt.get(c) || 0) + 1);
  }
  let n = 0;
  for (const v of cnt.values()) if (v >= minBuildings) n++;
  return n;
}

// ---------------------------------------------------------------------------------------------
// Szenarien
// ---------------------------------------------------------------------------------------------
// goal: { id, label, cur(g, sc) → Zahl, target, cmp: '>=' | '<=', hold?: Tage, fmt?(v) }
const G = {
  pop: (target, hold) => ({ id: 'pop', label: `${fmt(target)} Einwohner`, cur: (g) => g.stats.pop, target, hold, fmt }),
  happy: (target, hold) => ({ id: 'happy', label: `Glück ≥ ${target} %`, cur: (g) => g.stats.happiness, target, hold, fmt: (v) => `${Math.round(v)} %` }),
  money: (target) => ({ id: 'money', label: `${fmtMoney(target)} in der Kasse`, cur: (g) => g.money, target, fmt: fmtMoney }),
  net: (target, hold) => ({ id: 'net', label: `Tagesbilanz ≥ +${fmtMoney(target)}`, cur: (g) => g.lastBudget?.net || 0, target, hold, fmt: fmtMoney }),
  riders: (target, hold) => ({ id: 'riders', label: `${fmt(target)} Pulsbahn-Fahrgäste pro Tag`, cur: (g) => g.stats.ridersToday || 0, target, hold, fmt }),
  flow: (target, hold) => ({ id: 'flow', label: `Ø Verkehrsfluss ≥ ${target} %`, cur: (g) => (S(g).counters.dayFlow || 0) * 100, target, hold, fmt: (v) => `${Math.round(v)} %` }),
  tourism: (target) => ({ id: 'tourism', label: `${fmt(target)} Touristen pro Tag`, cur: (g) => g.stats.tourism || 0, target, fmt }),
  edu: (target) => ({ id: 'edu', label: `Ø Bildung ≥ ${target} %`, cur: (g) => g.stats.edu * 100, target, fmt: (v) => `${Math.round(v)} %` }),
  pollution: (target, hold) => ({ id: 'pollution', label: `Ø Verschmutzung ≤ ${target} %`, cur: (g) => g.stats.pollutionAvg * 100, target, cmp: '<=', hold, fmt: (v) => `${v.toFixed(1).replace('.', ',')} %` }),
  jobs: (zone, target, name) => ({ id: 'jobs' + zone, label: `${fmt(target)} Arbeitsplätze ${name}`, cur: (g) => g.stats.jobsByZone[zone] || 0, target, fmt }),
  built: (key, label) => ({ id: 'built_' + key, label: label || `${BUILDINGS[key]?.name || key} gebaut`, cur: (g) => (g.hasBuilt(key) ? 1 : 0), target: 1, fmt: (v) => (v >= 1 ? 'ja' : 'nein') }),
  landmarks: (target) => ({ id: 'landmarks', label: `${target} Wahrzeichen`, cur: (g) => S(g).facts?.landmarks || 0, target, fmt }),
  parks: (target) => ({ id: 'parks', label: `${target} Parks`, cur: (g) => S(g).facts?.parks || 0, target, fmt }),
  noLoans: () => ({ id: 'loans', label: 'Alle Kredite getilgt', cur: (g) => g.loans.length, target: 0, cmp: '<=', fmt: (v) => (v ? `${v} offen` : 'keine') }),
  watered: (hold) => ({ id: 'water', label: 'Alle Häuser mit Wasser', cur: (g) => g.stats.unwatered, target: 0, cmp: '<=', hold, fmt: (v) => (v ? `${fmt(v)} ohne` : 'alle') }),
  islands: (target) => ({ id: 'islands', label: `${target} besiedelte Inseln`, cur: (g) => settledIslands(g), target, fmt }),
  unemp: (target) => ({ id: 'unemp', label: `Arbeitslosigkeit ≤ ${target} %`, cur: (g) => g.stats.unemployment * 100, target, cmp: '<=', fmt: (v) => `${Math.round(v)} %` }),
  commute: (target, hold) => ({ id: 'commute', label: `Ø Pendelzeit ≤ ${target} Min.`, cur: (g) => (S(g).facts || cityFacts(g)).commute, target, cmp: '<=', hold, fmt: (v) => `${Math.round(v)} Min.` }),
  share: (target) => ({ id: 'share', label: `Pulsbahn-Anteil ≥ ${target} %`, cur: (g) => (g.stats.transitShare || 0) * 100, target, fmt: (v) => `${Math.round(v)} %` }),
  popMax: (target) => ({ id: 'popmax', label: `Höchstens ${fmt(target)} Einwohner`, cur: (g) => g.stats.pop, target, cmp: '<=', fmt }),
};

export const SCENARIOS = [
  {
    id: 'flusstal', name: 'Flusstal-Rettung', city: 'Altmühlbrück', level: 'mittel', map: 'river', size: 96, seed: 2024, difficulty: 'normal', days: 50,
    color: '#2f8fe0', kicker: 'Eine Stadt am Boden wieder aufrichten',
    desc: 'Die alte Flussstadt ist heruntergewirtschaftet: Die Kasse ist fast leer, ein Kredit drückt, die Wasserversorgung ist marode und viele Häuser stehen leer. Bring Altmühlbrück zurück auf Kurs.',
    script: [
      { day: 0, who: 'umwelt', text: 'Erst das Wasser, dann alles andere! Pumpwerke am Ufer liefern viel mehr als Wassertürme.' },
      { day: 3, who: 'geld', text: 'Die Steuern sind mit 12 % zu hoch für eine Stadt in der Krise. Etwas weniger bringt Zuzug und Glück.' },
      { day: 9, who: 'buerger', text: 'Die Leute fassen wieder Mut. Parks und eine Arztpraxis würden jetzt Wunder wirken.' },
      { day: 20, event: 'floodwarn' },
      { day: 25, who: 'bau', text: 'Halbzeit! Die Nachbarstadt hat schon Wetten gegen uns abgeschlossen. Zeigen wir es ihnen.' },
    ],
    goals: [G.pop(3000), G.happy(60), G.net(500, 2), G.watered(3)],
    fails: ['bankrupt'],
    setup(g) {
      g.milestone = 2;
      buildTown(g, { len: 30, rows: 2 });
      populate(g, { fill: 0.82, levelFn: (x) => (x < 22 ? 2 : 1 + (hash2(x, 3) < 0.4 ? 1 : 0)), occ: [0.6, 0.95], abandon: 0.08 });
      ensureUtilities(g, { margin: 1.4 });
      ensureServices(g, ['fire', 'landfill'], 2);
      settle(g, 2);
      // Die Wasserversorgung ist marode: nur ein kleiner Turm bleibt übrig
      for (const b of [...g.buildings.values()]) if (!b.zone && BUILDINGS[b.key]?.water) g.removeBuilding(b);
      placeNear(g, 'watertower', g.world.highwayEnd % g.W + 3, g.world.highwayY - 2, 10, { instant: true });
      for (const b of g.buildings.values()) b.noWater = -2; // etwas Schonfrist
      g.money = 6000;
      g.loans.push({ amount: 25000, weeks: 20, weeksLeft: 16, rate: 0.012, weekly: 25000 * 0.012 });
      g.taxes = { 1: 12, 2: 12, 3: 12, 4: 12 };
    },
  },
  {
    id: 'inseln', name: 'Inselbrücken', city: 'Siebeninseln', level: 'mittel', map: 'islands', size: 96, seed: 89, difficulty: 'normal', days: 70,
    color: '#10a9a3', kicker: 'Brücken schlagen, Inseln verbinden',
    desc: 'Die Autobahn endet auf einer kleinen Insel. Drüben locken die große Hauptinsel und ein paar Eilande. Brücken sind teuer – plane klug und verbinde mindestens drei Inseln zu einer Stadt.',
    script: [
      { day: 0, who: 'bau', text: 'Unsere Insel ist klein. Eine Brücke zur Hauptinsel ist teuer – aber erst dahinter ist Platz für eine echte Stadt.' },
      { day: 6, who: 'verkehr', text: 'Die Pulsbahn fährt über das Wasser, ohne dass wir eine Brücke für Autos brauchen.' },
      { day: 30, who: 'bau', text: 'Die kleinen Eilande im Norden warten noch auf Siedler.' },
    ],
    goals: [G.pop(2500), G.islands(3), G.riders(100)],
    fails: ['bankrupt'],
    setup(g) {
      g.money = 65000;
      g.addEffect('roadCost', -0.4, 14, 'Brückenbau-Förderung');
    },
  },
  {
    id: 'gruen', name: 'Grüne Stadt', city: 'Lindenhain', level: 'mittel', map: 'lakes', size: 96, seed: 1312, difficulty: 'normal', days: 75,
    color: '#22a866', kicker: 'Wachsen ohne Abgase',
    desc: 'Lindenhain will Modellstadt für Klimaschutz werden. Kohle, Gas, Müllverbrennung und Raffinerien sind tabu – sie werden sofort wieder abgerissen. Schaffe eine große, saubere und grüne Stadt.',
    script: [
      { day: 0, who: 'umwelt', text: 'Windräder sind der Anfang. Ab „Stadt" kommen Solarparks und Wasserkraft dazu.' },
      { day: 10, who: 'umwelt', text: 'Industrie macht Abgase – halte sie fern von den Wohngebieten oder setz auf Büros.' },
      { day: 35, event: 'bees' },
    ],
    goals: [G.pop(3500), G.pollution(4, 3), G.parks(12)],
    banned: ['coal', 'gas', 'incinerator', 'refinery', 'district_heating'],
    fails: ['bankrupt'],
    setup(g) { g.money = 52000; },
  },
  {
    id: 'erz', name: 'Erzrausch', city: 'Glückauf', level: 'schwer', map: 'mountains', size: 96, seed: 4711, difficulty: 'normal', days: 60,
    color: '#8a6a55', kicker: 'Reich werden im Bergland',
    desc: 'In den Tälern wurde Erz gefunden. Die Kasse ist knapp, das Land ist schroff – aber wer Industrie und Bergbau geschickt aufzieht, wird reich.',
    script: [
      { day: 0, who: 'bau', text: 'Industrie auf Erzfeldern wird zum Bergwerk. Die Rohstoffansicht zeigt dir die Vorkommen.' },
      { day: 12, who: 'geld', text: 'Jeder Euro zählt im Bergland. Prüfe den Haushalt, bevor du baust.' },
      { day: 30, event: 'plantclose' },
    ],
    goals: [G.jobs(3, 500, 'in der Industrie'), G.money(60000), G.pop(1500)],
    fails: ['bankrupt'],
    setup(g) { g.money = 30000; g.addEffect('indDemand', 30, 10, 'Erzfund'); },
  },
  {
    id: 'ferien', name: 'Ferienparadies', city: 'Seebad Sonnenstrand', level: 'mittel', map: 'coast', size: 96, seed: 909, difficulty: 'normal', days: 60,
    color: '#ff8a1f', kicker: 'Strand, Sehenswürdigkeiten, Touristen',
    desc: 'Die Küste ist traumhaft, nur kennt sie noch niemand. Locke Gäste mit Wahrzeichen und Strandbädern an – die Tourismusbehörde hat zwei Gutscheine spendiert.',
    script: [
      { day: 0, who: 'buerger', text: 'Leuchtturm und Riesenrad sind schon genehmigt – zum halben Preis!' },
      { day: 8, who: 'geld', text: 'Ein Strandbad am Ufer bringt Touristen und gute Laune.' },
      { day: 20, event: 'touristbus' },
    ],
    goals: [G.tourism(800), G.landmarks(3), G.happy(65)],
    fails: ['bankrupt'],
    setup(g) {
      g.money = 50000;
      g.landmarkVouchers.add('lighthouse');
      g.landmarkVouchers.add('ferris');
    },
  },
  {
    id: 'schulden', name: 'Schuldenberg', city: 'Pleitenburg', level: 'schwer', map: 'river', size: 96, seed: 31, difficulty: 'normal', days: 50,
    color: '#d4433a', kicker: 'Sanieren statt resignieren',
    desc: 'Dein Vorgänger hat Pleitenburg in die roten Zahlen geführt: zwei Kredite, eine leere Kasse und teure Verordnungen. Tilge alle Schulden und bring die Kasse ins Plus – ohne die Stadt schrumpfen zu lassen.',
    script: [
      { day: 0, who: 'geld', text: 'Kostenlose Pulsbahn, Fahrradstadt, Mülltrennung – schön, aber teuer. Prüfe die Verordnungen.' },
      { day: 4, who: 'geld', text: 'Kredite kannst du im Haushalt vorzeitig ablösen. Jede Woche ohne Kredit spart Zinsen.' },
      { day: 15, event: 'citizenbond' },
      { day: 30, who: 'buerger', text: 'Die Bürger halten zu dir. Noch ein Endspurt!' },
    ],
    goals: [G.noLoans(), G.money(20000), G.pop(1600, 3)],
    fails: ['bankrupt'],
    setup(g) {
      g.milestone = 2;
      buildTown(g, { len: 26, rows: 2 });
      populate(g, { fill: 0.85, levelFn: (x) => (x < 20 ? 2 : 1 + (hash2(x, 9) < 0.35 ? 1 : 0)), occ: [0.7, 0.95] });
      ensureUtilities(g, { margin: 1.35 });
      ensureServices(g, ['fire', 'police', 'clinic', 'school', 'landfill'], 3);
      settle(g, 3);
      g.money = -8000;
      g.loans.push({ amount: 60000, weeks: 30, weeksLeft: 22, rate: 0.015, weekly: 60000 * 0.015 });
      g.loans.push({ amount: 25000, weeks: 20, weeksLeft: 16, rate: 0.012, weekly: 25000 * 0.012 });
      for (const id of ['smoke', 'bikes', 'freetransit', 'recycling']) if (POLICIES.find((p) => p.id === id)) g.policies.add(id);
    },
  },
  {
    id: 'stau', name: 'Verkehrsinfarkt', city: 'Blechhausen', level: 'mittel', map: 'river', size: 96, seed: 58, difficulty: 'normal', days: 40,
    color: '#5d6470', kicker: 'Die Stadt steht still – bring sie in Fahrt',
    desc: 'Blechhausen ist mit dem Auto gewachsen: enge Gassen, ein einziger Weg zu den Fabriken und jeden Morgen endlose Pendlerschlangen. Bring die Leute schneller zur Arbeit – mit Pulsbahn, Alleen und klugem Umbau – ohne dass die Stadt schrumpft.',
    script: [
      { day: 0, who: 'verkehr', text: 'Eine einzige Gasse verbindet Wohnen und Arbeit. Eine Pulsbahn-Linie dazwischen wäre ein Anfang.' },
      { day: 3, who: 'verkehr', text: 'Alleen haben die doppelte Kapazität und sind schneller. Die Gassen sind das Nadelöhr.' },
      { day: 12, event: 'bikelanes' },
    ],
    goals: [G.commute(28, 3), G.riders(400, 2), G.pop(3500, 3)],
    fails: ['bankrupt', 'unhappy'],
    setup(g) {
      g.milestone = 3;
      const W = g.W, hy = g.world.highwayY, x0 = g.world.highwayEnd % W + 1;
      // Wohnviertel im Westen, Arbeit im Osten, dazwischen eine einzige Gasse
      roadLine(g, x0, hy, x0 + 44, hy, R.LANE);
      for (let x = x0 + 3; x <= x0 + 19; x += 4) roadLine(g, x, hy - 13, x, hy + 13, R.LANE);
      for (const dy of [-13, -9, -5, 5, 9, 13]) roadLine(g, x0 + 3, hy + dy, x0 + 19, hy + dy, R.LANE);
      for (let x = x0 + 28; x <= x0 + 44; x += 4) roadLine(g, x, hy - 13, x, hy + 13, R.LANE);
      for (const dy of [-13, -9, -5, 5, 9, 13]) roadLine(g, x0 + 28, hy + dy, x0 + 44, hy + dy, R.LANE);
      zoneRect(g, x0 + 4, hy - 12, x0 + 18, hy + 12, Z.RES);
      zoneRect(g, x0 + 29, hy - 12, x0 + 36, hy + 12, Z.COM);
      zoneRect(g, x0 + 37, hy - 12, x0 + 44, hy + 12, Z.IND);
      zoneRect(g, x0 + 29, hy - 12, x0 + 44, hy - 10, Z.OFF);
      populate(g, { fill: 0.88, levelFn: (x, y, z) => (z === Z.RES ? 2 + (hash2(x, y) < 0.15 ? 1 : 0) : 2 + (hash2(x, y) < 0.5 ? 1 : 0)), occ: [0.8, 1] });
      ensureUtilities(g, { margin: 1.35, near: [x0 + 24, hy + 15] });
      ensureServices(g, ['fire', 'police', 'clinic', 'school', 'landfill'], 3);
      settle(g, 3);
      g.transit.linesMax = 3;
      g.money = 60000;
    },
  },
  {
    id: 'wissen', name: 'Wissenschaftsstadt', city: 'Neu-Gelehrtenheim', level: 'schwer', map: 'lakes', size: 96, seed: 333, difficulty: 'relaxed', days: 90,
    color: '#8f5ad8', kicker: 'Bildung als Standortfaktor',
    desc: 'Die Landesregierung sucht einen Standort für ein Wissenschaftszentrum. Gewinne den Zuschlag mit einer gebildeten Bevölkerung, Gymnasium, Universität und vielen Büros.',
    script: [
      { day: 0, who: 'buerger', text: 'Schulen und Bibliotheken zuerst – ohne Bildung keine Büros.' },
      { day: 25, event: 'coworking' },
      { day: 45, who: 'bau', text: 'Ab „Großstadt" (4.000 Einwohner) dürfen wir eine Universität bauen.' },
    ],
    goals: [G.pop(4500), G.edu(60), G.built('highschool'), G.built('university'), G.jobs(4, 700, 'in Büros')],
    fails: ['bankrupt'],
    setup(g) { g.money = 90000; },
  },
  {
    id: 'boom', name: 'Boomtown', city: 'Goldgrube', level: 'schwer', map: 'coast', size: 128, seed: 4242, difficulty: 'relaxed', days: 70,
    color: '#e3a925', kicker: 'Zur Metropole im Eiltempo',
    desc: 'Investoren, Zuzug, Goldgräberstimmung: Mach aus dem Nichts in 70 Tagen eine Metropole mit 10.000 Einwohnern.',
    script: [
      { day: 0, who: 'bau', text: 'Groß denken: breite Straßen, viel Wohngebiet und genug Jobs. Die Investoren warten nicht.' },
      { day: 20, who: 'verkehr', text: 'Bei diesem Tempo braucht die Stadt bald die Pulsbahn.' },
      { day: 40, event: 'techfair' },
    ],
    goals: [G.pop(10000)],
    fails: ['bankrupt'],
    setup(g) { g.money = 100000; g.addEffect('resDemand', 25, 14, 'Goldgräberstimmung'); },
  },
  {
    id: 'idylle', name: 'Dorfidylle', city: 'Kleinwiesental', level: 'leicht', map: 'lakes', size: 64, seed: 64, difficulty: 'normal', days: 45,
    color: '#63c27a', kicker: 'Klein, fein und glücklich',
    desc: 'Kein Hochhaus, kein Schornstein – Kleinwiesental soll das glücklichste Dorf der Region werden. Halte die Bewohner fünf Tage lang begeistert, ohne zu groß zu werden.',
    script: [
      { day: 0, who: 'buerger', text: 'Niedrige Steuern, viele Parks und ein Spielplatz in jeder Straße – so wird man glücklich.' },
      { day: 15, event: 'market' },
    ],
    goals: [G.happy(78, 5), G.pop(600), G.popMax(1800), G.jobs(3, 60, 'in der Industrie (höchstens)')].map((x) => (x.id === 'jobs3' ? { ...x, label: 'Höchstens 60 Industrie-Jobs', cmp: '<=' } : x)),
    fails: ['bankrupt'],
    setup(g) { g.money = 45000; },
  },
  {
    id: 'doener', name: 'Döner-Hauptstadt', city: 'Mêrdînsfeld', level: 'leicht', map: 'river', size: 96, seed: 1999, difficulty: 'relaxed', days: 50,
    color: '#f2b01e', kicker: 'Chili-Cheese für alle',
    desc: 'Mêrdîn will seinen Dönerpalast eröffnen – in der lebendigsten Einkaufsstadt der Region. Bau ihn mit dem Gutschein, sorg für Kundschaft und gute Laune.',
    script: [
      { day: 0, who: 'buerger', text: 'Mêrdîn hat den Gutschein schon in der Tasche. Such ihm einen Platz mitten im Einkaufsviertel!' },
      { day: 10, event: 'foodtruck' },
      { day: 25, who: 'geld', text: 'Brunnenplätze und Parkhäuser bringen Kundschaft ins Gewerbe.' },
    ],
    goals: [G.built('doener', 'Mêrdîn’s Dönerpalast eröffnet'), G.jobs(2, 450, 'im Gewerbe'), G.happy(68), G.pop(2000)],
    fails: ['bankrupt'],
    setup(g) { g.money = 70000; g.landmarkVouchers.add('doener'); },
  },
  {
    id: 'metro', name: 'Metro-Modus', city: 'Pulsstadt', level: 'Herausforderung', map: 'river', size: 96, seed: 0, difficulty: 'normal', days: null, metro: true,
    color: '#e8543f', kicker: 'Nur du und die Pulsbahn',
    desc: 'Die Stadt wächst von selbst – Viertel für Viertel, jedes mit einer neuen Station. Du baust nur die Pulsbahn: Linien, Züge, Waggons. Jede Woche gibt es Nachschub. Läuft eine Station über, ist das Spiel vorbei. Wie viele Fahrgäste schaffst du?',
    goals: [],
    setup(g) { metroSetup(g); },
  },
];
export const scenarioById = (id) => SCENARIOS.find((s) => s.id === id) || null;
export const METRO_MAPS = [
  { id: 'river', name: 'Flusstal' },
  { id: 'coast', name: 'Küste' },
  { id: 'lakes', name: 'Seenplatte' },
  { id: 'islands', name: 'Inselreich' },
];

// Optionen für newGame() aus einem Szenario (für Menü und „Nochmal").
export function scenarioOptions(id, extra = {}) {
  const sc = scenarioById(id);
  if (!sc) return null;
  const o = { name: sc.city, mapType: sc.map, size: sc.size, seed: sc.seed, difficulty: sc.difficulty, scenario: sc.id };
  if (sc.metro) {
    o.mapType = extra.mapType || 'river';
    o.seed = extra.seed ?? Math.floor(Math.random() * 99999);
    o.name = extra.name || cityName(mulberry32(o.seed + 5));
  }
  return { ...o, ...extra, scenario: sc.id };
}

function setupScenario(g) {
  const sc = scenarioById(g.opts.scenario);
  const st = S(g);
  if (!sc) return;
  st.setupRunning = true;
  // Systeme, die nach uns registriert sind, haben noch kein init – während des Vorspulens weglassen.
  const myIdx = SYSTEMS.findIndex((s) => s.id === 'progression');
  const later = myIdx >= 0 ? SYSTEMS.splice(myIdx + 1) : [];
  // Startbebauung ist kostenlos; das Startgeld legt setup() selbst fest.
  const cm = g.costMul;
  g.costMul = 0;
  try {
    sc.setup(g);
  } catch (e) {
    console.error('Szenario-Aufbau fehlgeschlagen', e);
  } finally {
    g.costMul = cm;
    SYSTEMS.push(...later);
    st.setupRunning = false;
  }
  if (sc.metro) applyMetroRules(g);
  // Meilenstein still an die Startbevölkerung anpassen (ohne Belohnung)
  while (g.milestone < MILESTONES.length - 1 && g.stats.pop >= MILESTONES[g.milestone + 1].pop) g.milestone++;
  g.opts.scenarioSetupDone = true;
  g.newsLog = [];
  g.nextEventDay = g.day() + 6;
  g.debtDays = 0;
  st.counters.lastLoans = g.loans.length;
  st.scen = { id: sc.id, startDay: g.day(), status: 'running', hold: {}, done: {}, endDay: null, stars: 0, reason: '', unhappyDays: 0 };
  // Erfolge, die die Startstadt schon erfüllt, gibt es in diesem Spiel nicht geschenkt
  st.facts = cityFacts(g);
  updateCounters(g);
  for (const a of ACHIEVEMENTS) {
    let v = 0;
    try { v = a.v(g, st.facts, st.counters) || 0; } catch (e) { v = 0; }
    if (v >= (goalOf(a) || 1)) st.skip.push(a.id);
  }
  pushInbox(g, { type: 'scenarioIntro' });
  if (!sc.metro) runScript(g, sc); // erste Ratgeber-Meldung gleich zum Start
  g.speed = 0; // Start nach dem Briefing
}

// Ist ein Gebäude im laufenden Szenario verboten? (für Werkzeugleiste/Oberfläche)
export function isBanned(g, key) {
  const st = S(g);
  const sc = st?.scen && st.scen.status === 'running' ? scenarioById(st.scen.id) : null;
  return !!(sc && sc.banned && sc.banned.includes(key));
}
export function bannedNames(sc) { return (sc?.banned || []).map((k) => BUILDINGS[k]?.name).filter(Boolean); }

function goalOk(goal, v) { return goal.cmp === '<=' ? v <= goal.target : v >= goal.target; }
export function goalProgress(goal, v) {
  if (goal.cmp === '<=') return v <= goal.target ? 1 : clamp(goal.target / Math.max(1e-6, v), 0, 0.99);
  return clamp(v / (goal.target || 1), 0, 1);
}

// Zustand eines laufenden Szenarios für Oberfläche und Tests.
export function scenarioStatus(g) {
  const st = S(g);
  const sc = st?.scen ? scenarioById(st.scen.id) : null;
  if (!sc) return null;
  const goals = sc.goals.map((goal) => {
    let v = 0;
    try { v = goal.cur(g, st.scen) || 0; } catch (e) { v = 0; }
    const ok = goalOk(goal, v);
    const held = st.scen.hold[goal.id] || 0;
    const done = ok && (!goal.hold || held >= goal.hold);
    return { goal, value: v, ok, held, done, progress: goal.hold && ok ? Math.min(1, 0.6 + 0.4 * (held / goal.hold)) : goalProgress(goal, v), text: goal.fmt ? goal.fmt(v) : fmt(v) };
  });
  const elapsed = g.day() - st.scen.startDay;
  return { sc, st: st.scen, goals, elapsed, left: sc.days ? Math.max(0, sc.days - elapsed) : null };
}

function starsFor(sc, used) {
  if (!sc.days) return 1;
  const f = used / sc.days;
  return f <= 0.6 ? 3 : f <= 0.85 ? 2 : 1;
}

function endScenario(g, won, reason) {
  const st = S(g), sc = scenarioById(st.scen.id);
  if (st.scen.status !== 'running') return;
  st.scen.status = won ? 'won' : 'lost';
  st.scen.endDay = g.day();
  st.scen.reason = reason || '';
  if (won) {
    st.scen.stars = starsFor(sc, g.day() - st.scen.startDay);
    st.counters.scenarioWins++;
    st.counters.bestStars = Math.max(st.counters.bestStars, st.scen.stars);
    g.news('scenario', `Szenario „${sc.name}" geschafft – ${'★'.repeat(st.scen.stars)}${'☆'.repeat(3 - st.scen.stars)}!`, 'good');
    g.speed = 0;
  } else {
    g.news('scenario', `Szenario „${sc.name}" gescheitert: ${reason}`, 'bad');
    g.gameOver = true;
  }
  pushInbox(g, { type: 'scenarioEnd', won });
  g.emit('scenario', st.scen);
  busEmit('scenario', { g, scen: st.scen });
  checkAchievements(g);
}

// Szenario ohne Ziel weiterspielen (nach Sieg oder Niederlage).
export function continueFreePlay(g) {
  const st = S(g);
  if (!st?.scen) return;
  if (st.scen.status === 'running') st.scen.status = 'aborted';
  st.scen.free = true;
  g.gameOver = false;
  if (isMetro(g) && st.metro) st.metro.ended = true;
}

// Erzählte Momente eines Szenarios: Ratgeber melden sich, manche Ereignisse kommen zu festen Tagen.
function runScript(g, sc) {
  const st = S(g);
  const day = g.day() - st.scen.startDay;
  st.scen.script ||= {};
  for (let k = 0; k < (sc.script || []).length; k++) {
    const s = sc.script[k];
    if (s.day > day || st.scen.script[k]) continue;
    if (s.event) {
      if (g.pendingEvent || g.pendingCards) continue; // später nochmal
      const ev = EVENTS.find((e) => e.id === s.event);
      st.scen.script[k] = g.day();
      if (!ev || (ev.cond && !ev.cond(g))) continue;
      g.pendingEvent = ev.id;
      g.lastEventId = ev.id;
      g.nextEventDay = Math.max(g.nextEventDay, g.day() + 5);
      g.emit('event', ev);
    } else {
      st.scen.script[k] = g.day();
      const a = ADVISORS[s.who] || ADVISORS.bau;
      g.pushNews({ kind: 'advisor', author: `${a.role} ${a.name}`, text: s.text, mood: 'info' });
    }
  }
}

function dailyScenario(g) {
  const st = S(g);
  const sc = st.scen && scenarioById(st.scen.id);
  if (!sc || st.scen.status !== 'running' || sc.metro) return;
  runScript(g, sc);
  const status = scenarioStatus(g);
  for (const r of status.goals) st.scen.hold[r.goal.id] = r.ok ? (st.scen.hold[r.goal.id] || 0) + 1 : 0;
  const fresh = scenarioStatus(g);
  for (const r of fresh.goals) {
    if (r.done && !st.scen.done[r.goal.id]) {
      st.scen.done[r.goal.id] = g.day();
      g.news('scenario', `Ziel erreicht: ${r.goal.label}.`, 'good');
    }
  }
  if (fresh.goals.length && fresh.goals.every((r) => r.done)) { endScenario(g, true); return; }
  // Niederlagen
  if ((sc.fails || []).includes('unhappy')) {
    st.scen.unhappyDays = g.stats.happiness < 35 ? (st.scen.unhappyDays || 0) + 1 : 0;
    if (st.scen.unhappyDays >= 5) { endScenario(g, false, 'Die Bürger haben fünf Tage lang gestreikt (Glück unter 35 %).'); return; }
  }
  if (sc.days && fresh.elapsed >= sc.days) endScenario(g, false, 'Die Zeit ist abgelaufen.');
  else if (sc.days && sc.days - fresh.elapsed === 5) g.news('scenario', `Noch 5 Tage für „${sc.name}"!`, 'bad');
}

// Verbotene Gebäude im Szenario „Grüne Stadt" & Co.
function enforceBans(g) {
  const st = S(g);
  if (!st.pendingBan.length) return;
  const ids = st.pendingBan.splice(0);
  for (const id of ids) {
    const b = g.buildings.get(id);
    if (!b) continue;
    const d = BUILDINGS[b.key];
    st.removing = true;
    g.removeBuilding(b);
    st.removing = false;
    if (!g.sandbox) g.money += Math.round(d.cost * g.costMul);
    g.news('scenario', `${d.name} ist in diesem Szenario nicht erlaubt – der Bau wurde gestoppt und erstattet.`, 'bad', b);
  }
}

// ---------------------------------------------------------------------------------------------
// Metro-Modus
// ---------------------------------------------------------------------------------------------
const DIST = 11; // Viertel: 11 × 11 Felder, Straßen bei 0, 5, 10
const METRO_BAG = [Z.RES, Z.COM, Z.RES, Z.IND, Z.OFF, Z.RES, Z.COM, Z.RES, Z.OFF, Z.IND, Z.RES, Z.COM];
const DIST_NAMES = ['Altstadt', 'Rosenhöhe', 'Hafenviertel', 'Lindenau', 'Nordend', 'Mühlenkamp', 'Sonnenhang', 'Werksviertel', 'Kirchberg', 'Wiesengrund',
  'Neue Mitte', 'Bachtal', 'Uhrenviertel', 'Am Turm', 'Gartenstadt', 'Südpark', 'Brunnenhof', 'Weidenau', 'Schlossblick', 'Glockenfeld',
  'Ostkreuz', 'Westend', 'Felsenkeller', 'Inselspitze', 'Sternwarte', 'Hügelstadt', 'Seeblick', 'Ahornplatz', 'Fuchsbau', 'Kranichsteig'];

export const METRO_STARS = [400, 1200, 3000];
// Tageskarte: für alle am selben Tag gleich (Karte und Startwert aus dem Datum)
export function dailyMetro(date = new Date()) {
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const h = hashStr('metro-' + key);
  const map = METRO_MAPS[h % METRO_MAPS.length].id;
  return { key, label: `${date.getDate()}.${date.getMonth() + 1}.`, opts: { mapType: map, seed: h % 99991, daily: key } };
}
export const metroStars = (score) => (score >= METRO_STARS[2] ? 3 : score >= METRO_STARS[1] ? 2 : score >= METRO_STARS[0] ? 1 : 0);
export function metroScore(g) {
  const m = S(g)?.metro;
  if (!m) return 0;
  return Math.max(0, g.transit.deliveredTotal - (m.base || 0));
}

function districtSites(g) {
  const sites = [];
  const ter = g.world.terrain;
  for (let y = 2; y + DIST < g.H - 2; y += 4) for (let x = 6; x + DIST < g.W - 2; x += 4) {
    let bad = 0, water = 0;
    for (let yy = y; yy < y + DIST; yy++) for (let xx = x; xx < x + DIST; xx++) {
      const t = ter[yy * g.W + xx];
      if (t === T.ROCK) bad++;
      if (t === T.WATER) water++;
    }
    if (bad > 4 || water > 10) continue;
    sites.push({ x, y, score: bad * 3 + water });
  }
  return sites;
}
function siteFree(g, m, s) {
  // 3 Felder Abstand zu bestehenden Vierteln, keine Bebauung im Bereich
  for (const d of m.districts) {
    if (s.x < d.x + DIST + 3 && s.x + DIST + 3 > d.x && s.y < d.y + DIST + 3 && s.y + DIST + 3 > d.y) return false;
  }
  for (let yy = s.y; yy < s.y + DIST; yy++) for (let xx = s.x; xx < s.x + DIST; xx++) {
    const i = yy * g.W + xx;
    if (g.bld[i] || g.road[i] === R.HIGHWAY) return false;
  }
  return true;
}

// Weg vom Viertel zum bestehenden Straßennetz (Dijkstra über das Raster; Wasser teuer, Fels gesperrt).
function connectToNetwork(g, fromTiles) {
  const { W, H, N } = g;
  const dist = new Float32Array(N).fill(1e9);
  const prev = new Int32Array(N).fill(-1);
  const heap = new MinHeap();
  const target = (i) => g.road[i] && g.roadComp[i] === g.outsideComp && g.outsideComp >= 0;
  for (const i of fromTiles) { dist[i] = 0; heap.push(i, 0); }
  let hit = -1;
  while (heap.size) {
    const k = heap.pop();
    if (target(k) && !fromTiles.includes(k)) { hit = k; break; }
    const x = k % W, y = (k / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      const ter = g.world.terrain[j];
      if (ter === T.ROCK || g.bld[j] || (g.stationAt[j] && !g.road[j])) continue;
      let c = g.road[j] ? 0.2 : ter === T.WATER ? 7 : g.zone[j] ? 4 : 1;
      if (g.world.trees[j]) c += 0.3;
      const nd = dist[k] + c;
      if (nd < dist[j]) { dist[j] = nd; prev[j] = k; heap.push(j, nd); }
    }
  }
  if (hit < 0) return false;
  const path = [];
  for (let k = prev[hit]; k >= 0 && !fromTiles.includes(k); k = prev[k]) if (!g.road[k]) path.push(k);
  if (path.length) roadTiles(g, path, R.STREET, true);
  return true;
}

// Grünfläche in einem 4×4-Block: Stadtpark oder Spielplatz, Bänke, Bäume
function greenBlock(g, x, y) {
  const r = hash2(x, y, 41);
  const big = r < 0.55 ? 'citypark' : r < 0.8 ? 'allotment' : 'sports';
  const key = g.isUnlocked(big) ? big : 'park';
  const ox = r < 0.3 ? 0 : 2, oy = r < 0.6 ? 0 : 2;
  if (g.checkPlace(key, x + ox, y + oy, 0) === null) g.placeBuilding(key, x + ox, y + oy, 0);
  for (let yy = y; yy < y + 4; yy++) for (let xx = x; xx < x + 4; xx++) {
    const i = yy * g.W + xx;
    if (g.bld[i] || g.road[i]) continue;
    const h = hash2(xx, yy, 43);
    if (h < 0.18 && g.checkPlace('park', xx, yy, 0) === null) g.placeBuilding(xx === x ? 'playground' : 'park', xx, yy, 0);
    else if (h < 0.6 && g.world.terrain[i] === T.GRASS && !g.world.trees[i]) g.world.trees[i] = 1;
  }
}

function openDistrict(g, site, zoneType, first = false) {
  const m = S(g).metro;
  const { x, y } = site;
  const name = DIST_NAMES[m.districts.length % DIST_NAMES.length];
  // Straßenraster des Viertels
  for (const k of [0, 5, 10]) {
    roadLine(g, x, y + k, x + 10, y + k, R.STREET, false);
    roadLine(g, x + k, y, x + k, y + 10, R.STREET, false);
  }
  // Anschluss ans Netz
  const border = [];
  for (let k = 0; k <= 10; k++) for (const [xx, yy] of [[x + k, y], [x + k, y + 10], [x, y + k], [x + 10, y + k]]) {
    const i = yy * g.W + xx;
    if (g.road[i] && g.roadComp[i] !== g.outsideComp) border.push(i);
  }
  if (border.length) connectToNetwork(g, border);
  // Zwei Blöcke werden bebaut, die anderen beiden werden Grünanlagen (wie kleine Mini-Metro-Stationen)
  const flip = hash2(x, y, m.seed) < 0.5;
  const built = flip ? [[1, 1], [6, 6]] : [[6, 1], [1, 6]];
  const green = flip ? [[6, 1], [1, 6]] : [[1, 1], [6, 6]];
  for (const [bx, by] of built) zoneRect(g, x + bx, y + by, x + bx + 3, y + by + 3, zoneType);
  for (const [bx, by] of green) greenBlock(g, x + bx, y + by);
  // Station in der Mitte (auf der Kreuzung)
  let st = null;
  for (const [ox, oy] of [[5, 5], [5, 4], [4, 5], [6, 5], [5, 6]]) {
    if (!g.transit.canPlaceStation(x + ox, y + oy)) { st = g.placeBuilding('station', x + ox, y + oy).station || null; if (st) break; }
  }
  const d = { x, y, zone: zoneType, name, station: st ? st.id : 0, day: g.day() };
  m.districts.push(d);
  if (!first) g.news('metro', `Neues Viertel: ${name} (${['', 'Wohnen ●', 'Gewerbe ▲', 'Industrie ■', 'Büro ◆'][zoneType]}). ${st ? `Station ${st.name} wartet auf Anschluss.` : ''}`, 'info', { x: x + 5, y: y + 5 });
  return d;
}

function nextDistrict(g) {
  const m = S(g).metro;
  if (!m.sites) m.sites = districtSites(g);
  // Mittelpunkt der bisherigen Viertel
  let cx = g.world.highwayEnd % g.W + 8, cy = g.world.highwayY;
  if (m.districts.length) {
    cx = 0; cy = 0;
    for (const d of m.districts) { cx += d.x + 5; cy += d.y + 5; }
    cx /= m.districts.length; cy /= m.districts.length;
  }
  let best = null, bv = 1e9;
  for (const s of m.sites) {
    if (!siteFree(g, m, s)) continue;
    const dd = Math.hypot(s.x + 5 - cx, s.y + 5 - cy);
    // nicht zu nah, nicht zu fern; etwas Zufall
    const v = Math.abs(dd - 14 - m.districts.length * 0.6) + s.score * 1.5 + hash2(s.x, s.y, m.seed) * 8;
    if (v < bv) { bv = v; best = s; }
  }
  if (!best) return null;
  const zone = METRO_BAG[m.districts.length % METRO_BAG.length];
  return freeBuild(g, () => openDistrict(g, best, zone));
}

// Metro-Regeln, die nicht im Spielstand liegen (beim Laden erneut anwenden)
export const METRO_RULES = { costMul: 0.6, ridership: -0.5, subsidy: 1.5 };
function applyMetroRules(g) {
  g.costMul = METRO_RULES.costMul;
  g.mods.upkeep = 0;
  g.sandboxNoEvents = true;
  if (!g.effects.some((e) => e.label === 'Metro-Takt')) g.effects.push({ key: 'ridership', value: METRO_RULES.ridership, until: 1e12, label: 'Metro-Takt' });
}
BUDGET_LINES.push({ id: 'metroSubsidy', label: 'Verkehrsverbund-Zuschuss', kind: 'income', amount: (g) => (isMetro(g) && S(g)?.metro && !S(g).metro.ended ? (g.transit.faresToday || 0) * METRO_RULES.subsidy : 0) });

function metroSetup(g) {
  const st = S(g);
  g.milestone = 2;
  g.taxes = { 1: 0, 2: 0, 3: 0, 4: 0 };
  applyMetroRules(g);
  g.transit.linesMax = 3;
  g.transit.freeTrains = 3;
  g.transit.freeWagons = 0;
  st.metro = { base: 0, startDay: 0, next: 3, interval: 3, districts: [], seed: (g.opts.seed | 0) + 17, ended: false, worst: 0, worstName: '', over: false };
  const m = st.metro;
  m.sites = districtSites(g);
  const hy = g.world.highwayY, x0 = g.world.highwayEnd % g.W + 1;
  // Erstes Viertel direkt an der Autobahn (Wohnen), danach Gewerbe und Industrie
  const firstSite = m.sites.filter((s) => siteFree(g, m, s)).sort((a, b) => Math.hypot(a.x - x0 - 1, a.y + 5 - hy) - Math.hypot(b.x - x0 - 1, b.y + 5 - hy))[0];
  if (firstSite) openDistrict(g, firstSite, Z.RES, true);
  for (const z of [Z.COM, Z.IND]) {
    const d = nextDistrict(g);
    if (d) {
      d.zone = z;
      for (let yy = d.y; yy < d.y + DIST; yy++) for (let xx = d.x; xx < d.x + DIST; xx++) { const i = yy * g.W + xx; if (g.zone[i]) zoneRect(g, xx, yy, xx, yy, z); }
    }
  }
  g.emit('treesChanged');
  // Versorgung und etwas Startbevölkerung
  populate(g, { fill: 0.35, levelFn: () => 1, occ: [0.6, 0.9] });
  ensureUtilities(g, { margin: 1.6, near: [x0 + 2, hy + 8], extra: 120 });
  ensureServices(g, ['fire', 'landfill'], 2);
  settle(g, 1);
  g.newsLog = [];
  g.money = 8000;
  m.base = g.transit.deliveredTotal;
  m.startDay = g.day();
  m.next = g.day() + 3;
}

// Wartende an Stationen ohne Linie (wie in Mini Metro: neue Stationen füllen sich sofort).
function metroStep(g, minutes) {
  const st = S(g), m = st.metro;
  if (!m || m.ended || st.scen?.status !== 'running') return;
  const tr = g.transit;
  const h = g.hour();
  const night = h < 5 || h > 23 ? 0.25 : 1;
  const k = (minutes / 60) * night * 0.18;
  const list = [...tr.stations.values()];
  let worst = 0, worstSt = null;
  for (const s of list) {
    if (!s.active) {
      const w = s.w || [0, 0, 0, 0, 0];
      const rate = (w[1] * 0.012 + (w[2] + w[3] + w[4]) * 0.009) * k;
      s.acc = (s.acc || 0) + rate;
      let guard = 0;
      while (s.acc >= 1 && guard++ < 4) {
        s.acc -= 1;
        // Ziel: andere Station mit passender Nutzung
        const wantHome = g.rng() < (w[2] + w[3] + w[4]) / Math.max(1, w[1] + w[2] + w[3] + w[4]);
        let total = 0;
        const cands = [];
        for (const t of list) {
          if (t === s) continue;
          for (const z of wantHome ? [1] : [2, 3, 4]) { const v = t.w?.[z] || 0; if (v > 0) { cands.push([t, z, v]); total += v; } }
        }
        if (total <= 0) break;
        let q = g.rng() * total, pickC = cands[cands.length - 1];
        for (const c of cands) { q -= c[2]; if (q <= 0) { pickC = c; break; } }
        s.waiting.push({ dest: pickC[0].id, shape: pickC[1], t: g.time });
      }
      if (s.acc > 3) s.acc = 3;
      if (s.waiting.length > TRANSIT.stationCapacity) s.over = Math.min(1, (s.over || 0) + minutes / (TRANSIT.overcrowdDays * 1.5 * 1440));
      else s.over = Math.max(0, (s.over || 0) - minutes / 720);
      if (s.waiting.length > 40) s.waiting.splice(0, s.waiting.length - 40);
    }
    if ((s.over || 0) > worst) { worst = s.over; worstSt = s; }
    // Überlauf = Ende (aktive Stationen setzt der Kern bei 1 zurück, darum knapp davor prüfen)
    if ((s.over || 0) >= 0.99 || s.penaltyUntil > g.time) {
      endMetro(g, s);
      return;
    }
  }
  m.worst = worst;
  m.worstName = worstSt ? worstSt.name : '';
}

function endMetro(g, s) {
  const st = S(g), m = st.metro;
  m.ended = true;
  m.overStation = s ? s.name : '';
  st.scen.status = 'lost';
  st.scen.endDay = g.day();
  st.scen.score = metroScore(g);
  st.scen.stars = metroStars(st.scen.score);
  st.scen.reason = s ? `Station ${s.name} ist übergelaufen.` : 'Das Netz ist zusammengebrochen.';
  st.counters.bestStars = Math.max(st.counters.bestStars, st.scen.stars);
  if (st.scen.stars > 0) st.counters.scenarioWins++;
  g.news('metro', `Endstation! ${st.scen.reason} ${fmt(st.scen.score)} Fahrgäste befördert.`, 'bad', s ? { x: s.x, y: s.y } : null);
  g.gameOver = true;
  pushInbox(g, { type: 'scenarioEnd', won: false, metro: true });
  g.emit('scenario', st.scen);
  busEmit('scenario', { g, scen: st.scen });
  checkAchievements(g);
}

function metroDaily(g) {
  const st = S(g), m = st.metro;
  if (!m || m.ended || st.scen?.status !== 'running') return;
  if (g.day() >= m.next) {
    const d = nextDistrict(g);
    m.interval = Math.max(1.6, m.interval * 0.94);
    m.next = g.day() + Math.round(m.interval + (d ? 0 : 2));
  }
  // Versorgung mitwachsen lassen (kostenlos – die Stadtwerke kümmern sich)
  freeBuild(g, () => {
    ensureUtilities(g, { margin: 1.5, extra: 120, near: [m.districts[0] ? m.districts[0].x : 10, m.districts[0] ? m.districts[0].y + 13 : g.world.highwayY + 8] });
    if (g.day() % 3 === 0) ensureServices(g, ['fire', 'landfill', 'clinic', 'police'], 1);
  });
}

// Wochenkarten im Metro-Modus: nur Pulsbahn-Nachschub.
function metroCards(g, ids) {
  const pool = CARDS.filter((c) => c.metro && (!c.cond || c.cond(g)));
  const chosen = [];
  const rng = g.rng;
  const p = [...pool];
  for (let k = 0; k < 3 && p.length; k++) {
    const total = p.reduce((a, c) => a + (c.w || 1), 0);
    let r = rng() * total, idx = p.length - 1;
    for (let i = 0; i < p.length; i++) { r -= p[i].w || 1; if (r <= 0) { idx = i; break; } }
    chosen.push(p[idx].id);
    p.splice(idx, 1);
  }
  ids.length = 0;
  ids.push(...chosen);
}

// ---------------------------------------------------------------------------------------------
// Bürgeraufträge (freies Spiel): kleine Ziele mit Frist und Belohnung gegen die Mid-Game-Leere
// ---------------------------------------------------------------------------------------------
const roundTo = (v, step) => Math.max(step, Math.round(v / step) * step);
const cashReward = (g, base) => ({ type: 'money', amount: roundTo(base + g.stats.pop * 1.2, 500) });
// make(g, F) → { target, days, hold?, reward } | null; cur(g, F) → Zahl; cmp '<=' für Obergrenzen
export const QUESTS = [
  { id: 'grow', who: 'bau', title: 'Wachstumsschub', text: (q) => `Bring die Stadt auf ${fmt(q.target)} Einwohner.`, cond: (g) => g.stats.pop >= 80,
    make: (g) => ({ target: roundTo(g.stats.pop * 1.22 + 80, 50), days: 9, reward: cashReward(g, 2500) }), cur: (g) => g.stats.pop },
  { id: 'happy', who: 'buerger', title: 'Gute Laune', text: (q) => `Halte das Glück zwei Tage lang bei mindestens ${q.target} %.`, cond: (g) => g.stats.pop >= 200 && g.stats.happiness < 80,
    make: (g) => ({ target: Math.min(85, Math.round(g.stats.happiness + 7)), days: 8, hold: 2, reward: { type: 'happy', amount: 4, days: 7 } }), cur: (g) => g.stats.happiness, fmt: (v) => `${Math.round(v)} %` },
  { id: 'jobs', who: 'bau', title: 'Arbeit für alle', text: () => 'Drück die Arbeitslosigkeit unter 4 %.', cond: (g) => g.stats.pop > 300 && g.stats.unemployment > 0.07,
    make: (g) => ({ target: 4, days: 7, reward: cashReward(g, 3000) }), cur: (g) => g.stats.unemployment * 100, cmp: '<=', fmt: (v) => `${Math.round(v)} %` },
  { id: 'parks', who: 'umwelt', title: 'Mehr Grün', text: (q) => `Baue Parks, bis es ${q.target} Grünanlagen gibt.`, cond: (g) => g.stats.pop > 150,
    make: (g, F) => ({ target: (F.parks || 0) + 3, days: 7, reward: cashReward(g, 1500) }), cur: (g, F) => F.parks || 0 },
  { id: 'riders', who: 'verkehr', title: 'Steig ein!', text: (q) => `${fmt(q.target)} Pulsbahn-Fahrgäste an einem Tag.`, cond: (g) => g.transit.lines.length >= 1,
    make: (g) => ({ target: roundTo(Math.max(60, (g.stats.ridersToday || 0) * 1.4 + 20), 10), days: 8, reward: { type: 'trains', amount: 2 } }), cur: (g) => g.stats.ridersToday || 0 },
  { id: 'supply', who: 'umwelt', title: 'Licht und Wasser für alle', text: () => 'Zwei Tage lang kein Gebäude ohne Strom oder Wasser.', cond: (g) => g.stats.unpowered + g.stats.unwatered > 2,
    make: (g) => ({ target: 0, days: 6, hold: 2, reward: cashReward(g, 2000) }), cur: (g) => g.stats.unpowered + g.stats.unwatered, cmp: '<=', fmt: (v) => (v ? `${fmt(v)} ohne` : 'alle') },
  { id: 'edu', who: 'buerger', title: 'Schlaue Köpfe', text: (q) => `Hebe die Bildung auf ${q.target} %.`, cond: (g) => g.stats.pop > 500 && g.countBuilt('education') > 0 && g.stats.edu < 0.8,
    make: (g) => ({ target: Math.min(90, Math.round(g.stats.edu * 100 + 10)), days: 10, reward: { type: 'edu', amount: 1.1 } }), cur: (g) => g.stats.edu * 100, fmt: (v) => `${Math.round(v)} %` },
  { id: 'tourism', who: 'geld', title: 'Besuchermagnet', text: (q) => `Locke ${fmt(q.target)} Touristen am Tag an.`, cond: (g, F) => (F.landmarks || 0) > 0 || (g.stats.tourism || 0) > 50,
    make: (g) => ({ target: roundTo((g.stats.tourism || 0) * 1.4 + 80, 10), days: 9, reward: cashReward(g, 4000) }), cur: (g) => g.stats.tourism || 0 },
  { id: 'savings', who: 'geld', title: 'Rücklage bilden', text: (q) => `Spare ${fmtMoney(q.target)} an.`, cond: (g) => (g.lastBudget?.net || 0) > 200 && g.money > 0,
    make: (g) => ({ target: roundTo(g.money + Math.max(8000, (g.lastBudget?.net || 0) * 5), 1000), days: 8, reward: { type: 'upkeep', amount: 0.2, days: 10 } }), cur: (g) => g.money, fmt: fmtMoney },
  { id: 'landmark', who: 'buerger', title: 'Ein neues Wahrzeichen', text: () => 'Baue ein weiteres Wahrzeichen.', cond: (g) => LANDMARK_KEYS().some((k) => g.isUnlocked(k) && !g.hasBuilt(k)),
    make: (g, F) => ({ target: (F.landmarks || 0) + 1, days: 12, reward: { type: 'tourism', amount: 150, days: 10 } }), cur: (g, F) => F.landmarks || 0 },
  { id: 'flow', who: 'verkehr', title: 'Freie Fahrt', text: (q) => `Ø Verkehrsfluss zwei Tage lang über ${q.target} %.`, cond: (g) => (S(g).counters.dayFlow || 1) < 0.85 && g.stats.pop > 500,
    make: () => ({ target: 90, days: 8, hold: 2, reward: { type: 'roads', amount: 0.6, days: 6 } }), cur: (g) => (S(g).counters.dayFlow || 0) * 100, fmt: (v) => `${Math.round(v)} %` },
  { id: 'crime', who: 'buerger', title: 'Sichere Viertel', text: () => 'Senke die Kriminalität unter 12 %.', cond: (g) => g.stats.crimeAvg > 0.2 && g.stats.pop > 400,
    make: (g) => ({ target: 12, days: 8, reward: cashReward(g, 2500) }), cur: (g) => g.stats.crimeAvg * 100, cmp: '<=', fmt: (v) => `${Math.round(v)} %` },
  { id: 'health', who: 'buerger', title: 'Ärzte für alle', text: () => 'Bring die Gesundheitsversorgung auf 60 %.', cond: (g) => g.stats.pop > 300 && g.stats.healthAvg < 0.45,
    make: (g) => ({ target: 60, days: 8, reward: cashReward(g, 2500) }), cur: (g) => g.stats.healthAvg * 100, fmt: (v) => `${Math.round(v)} %` },
  { id: 'tall', who: 'bau', title: 'Hoch hinaus', text: (q) => `${q.target} Gebäude auf Stufe 4 oder höher.`, cond: (g) => g.milestone >= 3,
    make: (g, F) => ({ target: (F.level4 || 0) + 5, days: 10, reward: cashReward(g, 4000) }), cur: (g, F) => F.level4 || 0 },
  { id: 'clean', who: 'umwelt', title: 'Durchatmen', text: (q) => `Senke die Verschmutzung auf ${q.target} %.`, cond: (g) => g.stats.pollutionAvg > 0.1,
    make: (g) => ({ target: Math.max(2, Math.round(g.stats.pollutionAvg * 60)), days: 9, reward: { type: 'happy', amount: 3, days: 7 } }), cur: (g) => g.stats.pollutionAvg * 100, cmp: '<=', fmt: (v) => `${Math.round(v)} %` },
  { id: 'vacancy', who: 'bau', title: 'Leerstand beseitigen', text: () => 'Zwei Tage lang kein verlassenes Gebäude.', cond: (g) => g.stats.abandoned > 3,
    make: (g) => ({ target: 0, days: 7, hold: 2, reward: cashReward(g, 2000) }), cur: (g) => g.stats.abandoned, cmp: '<=', fmt: (v) => (v ? `${fmt(v)} leer` : 'keins') },
  { id: 'garbage', who: 'umwelt', title: 'Saubere Straßen', text: () => 'Zwei Tage lang keine Müllberge.', cond: (g) => g.stats.garbageProb > 3,
    make: (g) => ({ target: 0, days: 7, hold: 2, reward: cashReward(g, 1500) }), cur: (g) => g.stats.garbageProb, cmp: '<=', fmt: (v) => (v ? `${fmt(v)} Häuser` : 'sauber') },
  { id: 'avenue', who: 'verkehr', title: 'Prachtstraße', text: (q) => `Baue Alleen auf insgesamt ${q.target} Feldern.`, cond: (g) => g.isUnlocked('avenue') && g.stats.pop > 600,
    make: (g, F) => ({ target: (F.avenue || 0) + 15, days: 7, reward: { type: 'lv', amount: 4, days: 10 } }), cur: (g, F) => F.avenue || 0 },
  { id: 'line', who: 'verkehr', title: 'Neue Verbindung', text: (q) => `Betreibe ${q.target} Pulsbahn-Linien.`, cond: (g) => g.isUnlocked('transit') && g.transit.lines.length < g.transit.linesMax,
    make: (g) => ({ target: g.transit.lines.length + 1, days: 8, reward: { type: 'wagons', amount: 3 } }), cur: (g) => g.transit.lines.length },
];
const QUEST_BY_ID = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
export const questById = (id) => QUEST_BY_ID[id] || null;

export function rewardText(r) {
  if (!r) return '';
  switch (r.type) {
    case 'money': return fmtMoney(r.amount);
    case 'happy': return `Glück +${r.amount} für ${r.days} Tage`;
    case 'trains': return `${r.amount} Züge`;
    case 'wagons': return `${r.amount} Waggons`;
    case 'edu': return 'Bildung dauerhaft 10 % schneller';
    case 'upkeep': return `${Math.round(r.amount * 100)} % Unterhalt zurück für ${r.days} Tage`;
    case 'tourism': return `+${r.amount} Touristen für ${r.days} Tage`;
    case 'roads': return `Straßen ${r.days} Tage lang 60 % billiger`;
    case 'lv': return `Bodenwert +${r.amount} für ${r.days} Tage`;
    default: return '';
  }
}
function giveReward(g, r) {
  switch (r.type) {
    case 'money': if (!g.sandbox) g.money += r.amount; break;
    case 'happy': g.addEffect('happy', r.amount, r.days, 'Bürgerauftrag'); break;
    case 'trains': g.transit.freeTrains += r.amount; break;
    case 'wagons': g.transit.freeWagons += r.amount; break;
    case 'edu': g.mods.edu *= r.amount; break;
    case 'upkeep': g.addEffect('upkeepRebate', r.amount, r.days, 'Bürgerauftrag'); break;
    case 'tourism': g.addEffect('tourismAdd', r.amount, r.days, 'Bürgerauftrag'); break;
    case 'roads': g.addEffect('roadCost', -r.amount, r.days, 'Bürgerauftrag'); break;
    case 'lv': g.addEffect('lvAdd', r.amount, r.days, 'Bürgerauftrag'); break;
    default: break;
  }
}
const questsAllowed = (g) => achievementsEnabled(g) && !isMetro(g) && !(S(g).scen && S(g).scen.status === 'running');

// Stand der Aufträge für Oberfläche und Tests
export function questStatus(g) {
  const st = S(g);
  if (!st?.quests) return [];
  const F = st.facts || cityFacts(g);
  return st.quests.active.map((q) => {
    const t = questById(q.tid);
    if (!t) return null;
    let v = 0;
    try { v = t.cur(g, F) || 0; } catch (e) { v = 0; }
    const goal = { target: q.target, cmp: t.cmp, hold: q.hold };
    const ok = goalOk(goal, v);
    return { q, t, value: v, ok, text: t.fmt ? t.fmt(v) : fmt(v), progress: q.hold && ok ? Math.min(1, 0.6 + 0.4 * ((q.held || 0) / q.hold)) : goalProgress(goal, v), left: Math.max(0, q.until - g.day()), title: t.title, desc: t.text(q), reward: rewardText(q.reward) };
  }).filter(Boolean);
}

function dailyQuests(g) {
  const st = S(g);
  const Q = st.quests;
  if (!questsAllowed(g)) return;
  const F = st.facts;
  // Fortschritt prüfen
  for (const q of [...Q.active]) {
    const t = questById(q.tid);
    if (!t) { Q.active.splice(Q.active.indexOf(q), 1); continue; }
    let v = 0;
    try { v = t.cur(g, F) || 0; } catch (e) { v = 0; }
    const ok = goalOk({ target: q.target, cmp: t.cmp }, v);
    q.held = ok ? (q.held || 0) + 1 : 0;
    if (ok && (!q.hold || q.held >= q.hold)) {
      Q.active.splice(Q.active.indexOf(q), 1);
      giveReward(g, q.reward);
      st.counters.questsDone++;
      const a = ADVISORS[t.who] || ADVISORS.bau;
      g.pushNews({ kind: 'report', author: `${a.role} ${a.name}`, text: `Auftrag erfüllt: ${t.title}! Belohnung: ${rewardText(q.reward)}.`, mood: 'good' });
      pushInbox(g, { type: 'quest', ok: true, title: t.title, reward: rewardText(q.reward) });
      Q.next = Math.min(Q.next, g.day() + 2);
    } else if (g.day() >= q.until) {
      Q.active.splice(Q.active.indexOf(q), 1);
      st.counters.questsFailed++;
      g.pushNews({ kind: 'report', author: 'Stadtfunk', text: `Auftrag verpasst: ${t.title}. Vielleicht beim nächsten Mal.`, mood: 'info' });
      Q.next = Math.min(Q.next, g.day() + 3);
    }
  }
  // Neue Aufträge (höchstens zwei gleichzeitig)
  if (Q.active.length >= 2 || g.day() < Q.next || g.stats.pop < 60) return;
  const pool = QUESTS.filter((t) => !Q.active.some((q) => q.tid === t.id) && !Q.recent.includes(t.id) && (!t.cond || t.cond(g, F)));
  if (!pool.length) { Q.recent = Q.recent.slice(-2); return; }
  const t = pool[Math.floor(g.rng() * pool.length)];
  const made = t.make(g, F);
  if (!made) return;
  const q = { tid: t.id, target: made.target, hold: made.hold || 0, held: 0, start: g.day(), until: g.day() + made.days, reward: made.reward };
  Q.active.push(q);
  Q.recent.push(t.id);
  if (Q.recent.length > 6) Q.recent.shift();
  Q.next = g.day() + (Q.active.length >= 2 ? 4 : 2);
  const a = ADVISORS[t.who] || ADVISORS.bau;
  g.pushNews({ kind: 'quest', author: `${a.role} ${a.name}`, text: `Neuer Auftrag: ${t.title} – ${t.text(q)} Frist: ${made.days} Tage. Belohnung: ${rewardText(q.reward)}.`, mood: 'info' });
  pushInbox(g, { type: 'quest', ok: false, title: t.title });
}

// ---------------------------------------------------------------------------------------------
// Ratgeber
// ---------------------------------------------------------------------------------------------
export const ADVISORS = {
  bau: { name: 'Ilse Brandt', role: 'Stadtbaurätin', color: '#4fae67' },
  geld: { name: 'Otto Pfennig', role: 'Kämmerer', color: '#c98a0c' },
  verkehr: { name: 'Aylin Demir', role: 'Verkehrsplanerin', color: '#e8543f' },
  umwelt: { name: 'Jonas Grünwald', role: 'Umweltreferent', color: '#22a866' },
  buerger: { name: 'Frieda Lang', role: 'Bürgerbeauftragte', color: '#8f5ad8' },
};

// Liefert Hinweise [{ id, who, prio (0–100), title, text }] – die dringendsten zuerst.
export function adviceFor(g) {
  const s = g.stats, u = g.util || {};
  const out = [];
  const add = (id, who, prio, title, text) => out.push({ id, who, prio, title, text });
  const pop = s.pop;
  let roads = 0;
  for (let i = 0; i < g.N; i++) if (g.road[i] && g.road[i] !== R.HIGHWAY) { roads++; if (roads > 3) break; }
  if (isMetro(g)) {
    const m = S(g)?.metro;
    const tr = g.transit;
    const idle = [...tr.stations.values()].filter((st) => !st.active);
    if (idle.length) add('m_idle', 'verkehr', 90, `${idle.length} Station${idle.length > 1 ? 'en' : ''} ohne Anschluss`, `${idle.map((x) => x.name).slice(0, 3).join(', ')} füllen sich trotzdem. Verlängere eine Linie dorthin oder zeichne eine neue.`);
    if (m && m.worst > 0.4) add('m_over', 'verkehr', 95, `${m.worstName} läuft über`, `Der rote Ring ist zu ${Math.round(m.worst * 100)} % gefüllt. Mehr Züge oder Waggons auf die Linie – oder eine zweite Linie durch die Station.`);
    if (tr.freeTrains > 0) add('m_trains', 'verkehr', 70, `${tr.freeTrains} Zug${tr.freeTrains > 1 ? 'e' : ''} im Depot`, 'Setze sie im Pulsbahn-Fenster auf die vollsten Linien.');
    if (tr.freeWagons > 0) add('m_wagons', 'verkehr', 65, `${tr.freeWagons} Waggon${tr.freeWagons > 1 ? 's' : ''} im Depot`, 'Waggons erhöhen die Kapazität eines Zuges um je 6 Plätze.');
    if (tr.lines.length < tr.linesMax) add('m_lines', 'verkehr', 60, 'Freie Linie', `Du hast ${tr.linesMax - tr.lines.length} ungenutzte Linie(n). Eine Linie zwischen Wohnen ● und Arbeit ■▲◆ bringt die meisten Fahrgäste.`);
    add('m_tip', 'verkehr', 20, 'Tipp: Ringe und Umsteigen', 'Ringlinien haben keine Wendezeiten. Stationen, an denen sich zwei Linien kreuzen, verteilen Fahrgäste schneller.');
    return out.sort((a, b) => b.prio - a.prio);
  }
  if (roads === 0) add('road', 'bau', 100, 'Die erste Straße', 'Ziehe eine Straße vom Ende der Autobahn ins Land. Dort beginnt deine Stadt.');
  if (u.powerDemand > u.powerSupply && pop > 0) add('power', 'umwelt', 95, 'Strom reicht nicht', `Bedarf ${fmt(u.powerDemand)} MW, Erzeugung ${fmt(u.powerSupply)} MW. Baue ein Kraftwerk – ohne Strom werden Häuser verlassen.`);
  else if (u.powerSupply && u.powerDemand > u.powerSupply * 0.88) add('power2', 'umwelt', 60, 'Stromnetz am Limit', `${Math.round((u.powerDemand / u.powerSupply) * 100)} % Auslastung. Plane rechtzeitig das nächste Kraftwerk.`);
  if (u.waterDemand > u.waterSupply && pop > 0) add('water', 'umwelt', 92, 'Wasser reicht nicht', `Bedarf ${fmt(u.waterDemand)} m³, Förderung ${fmt(u.waterSupply)} m³. Pumpwerke am Ufer liefern viel Wasser.`);
  if (s.unpowered > 3 && u.powerSupply >= u.powerDemand) add('grid', 'bau', 80, 'Getrennte Stromnetze', `${s.unpowered} Gebäude ohne Strom, obwohl genug erzeugt wird. Strom fließt nur durch verbundene Straßen.`);
  if (s.garbageProb > 3) add('garbage', 'umwelt', 75, 'Müll stapelt sich', `${s.garbageProb} Gebäude ohne Müllabfuhr. Eine Deponie oder Müllverbrennung in der Nähe hilft.`);
  if (g.money < 0) add('debt', 'geld', 90, 'Die Kasse ist im Minus', 'Erhöhe vorsichtig die Steuern, streiche teure Verordnungen oder nimm einen Kredit auf. Nach zehn Tagen tief im Minus droht der Bankrott.');
  else if (g.lastBudget && g.lastBudget.net < -200) add('deficit', 'geld', 70, 'Wir geben mehr aus, als wir einnehmen', `Tagesbilanz ${fmtMoney(g.lastBudget.net)}. Prüfe Unterhalt und Steuern im Haushalt.`);
  if (g.taxes[1] >= 14) add('tax', 'geld', 55, 'Steuern sind hoch', 'Über 10 % sinken Nachfrage und Glück spürbar. Senke die Sätze, sobald die Kasse es erlaubt.');
  if (g.money > 80000 && pop > 300 && g.lastBudget?.net > 500) add('rich', 'geld', 35, 'Volle Kasse', 'Investiere in Bildung, Parks oder ein Wahrzeichen – Geld auf dem Konto lässt die Stadt nicht wachsen.');
  if (s.unemployment > 0.12 && pop > 200) add('jobs', 'bau', 72, 'Zu wenig Arbeit', `${Math.round(s.unemployment * 100)} % sind arbeitslos. Weise Gewerbe, Industrie oder Büros aus.`);
  for (const [z, name] of [[1, 'Wohngebiet'], [2, 'Gewerbe'], [3, 'Industrie'], [4, 'Büros']]) {
    if (g.demand[z] > 45 && (z !== 4 || g.isUnlocked('zone4'))) {
      const free = g.zoneFree[z].size;
      if (free < 8) add('demand' + z, 'bau', 58, `Gefragt: ${name}`, `Die Nachfrage ist hoch, aber es gibt kaum freie Flächen (${free}). Weise mehr ${name} aus.`);
    }
  }
  if (s.trafficFlow < 0.75 && pop > 400) add('traffic', 'verkehr', 70, 'Stau in der Stadt', `Verkehrsfluss ${Math.round(s.trafficFlow * 100)} %. Alleen haben doppelte Kapazität, die Pulsbahn nimmt Autos von der Straße.`);
  if (g.isUnlocked('transit') && g.transit.lines.length === 0 && pop > 500) add('transit', 'verkehr', 62, 'Die Pulsbahn wartet', 'Du kannst jetzt Hochbahn-Linien zeichnen. Verbinde Wohnviertel mit Arbeitsplätzen – das senkt Stau und hebt den Bodenwert.');
  const crowded = [...g.transit.stations.values()].filter((st) => st.over > 0.4);
  if (crowded.length) add('crowd', 'verkehr', 85, `Station ${crowded[0].name} überfüllt`, 'Mehr Züge oder Waggons einsetzen, sonst geben die Fahrgäste auf und das Viertel wird unzufrieden.');
  if (g.transit.freeTrains > 0) add('freetrains', 'verkehr', 45, 'Züge im Depot', `${g.transit.freeTrains} Zug/Züge warten im Depot. Setze sie im Pulsbahn-Fenster ein.`);
  if (pop > 300 && s.healthAvg < 0.35) add('health', 'buerger', 60, 'Ärzte fehlen', 'Viele Wohngebiete haben keine Arztpraxis in der Nähe. Das kostet Glück.');
  if (pop > 300 && s.edu < 0.15 && g.isUnlocked('school')) add('school', 'buerger', 58, 'Bildung fehlt', 'Ohne Schulen bleiben die Gebäude klein. Ab Stufe 4 braucht es gebildete Bewohner.');
  if (pop > 300 && s.crimeAvg > 0.3) add('crime', 'buerger', 62, 'Kriminalität steigt', 'Polizeiwachen senken die Kriminalität im Umkreis. Arbeitslosigkeit treibt sie nach oben.');
  if (s.pollutionAvg > 0.2) add('pollution', 'umwelt', 55, 'Dicke Luft', `Ø Verschmutzung ${Math.round(s.pollutionAvg * 100)} %. Halte Industrie und Kraftwerke von Wohngebieten fern, Filteranlagen und saubere Industrie helfen.`);
  if (s.burning > 0 && g.countBuilt('services') === 0) add('fire', 'buerger', 88, 'Es brennt!', 'Ohne Feuerwache brennen Gebäude nieder. Baue eine Feuerwache.');
  if (s.abandoned > 5) add('abandoned', 'bau', 66, 'Leerstand', `${s.abandoned} Gebäude sind verlassen. Prüfe Strom, Wasser, Straßenanbindung und Glück.`);
  if (s.happiness < 45 && pop > 150) add('happy', 'buerger', 68, 'Schlechte Stimmung', 'Klicke ein Wohnhaus an: Der Inspektor zeigt, was das Glück drückt. Parks und Dienste helfen fast immer.');
  if (g.landmarkVouchers.size) add('voucher', 'buerger', 40, 'Wahrzeichen-Gutschein', `Du kannst ${[...g.landmarkVouchers].map((k) => BUILDINGS[k]?.name).filter(Boolean).join(', ')} zum halben Preis bauen.`);
  if (g.milestone >= 1 && !g.policies.size && pop > 400) add('policies', 'buerger', 30, 'Verordnungen nutzen', 'Rauchmelderpflicht und Tempo 30 kosten wenig und wirken sofort.');
  const next = MILESTONES[g.milestone + 1];
  if (next && pop > 0) add('milestone', 'bau', 15, `Nächster Meilenstein: ${next.name}`, `Noch ${fmt(Math.max(0, next.pop - pop))} Einwohner bis „${next.name}" – dann gibt es ${fmtMoney(next.reward)} und neue Gebäude.`);
  // Szenario: am weitesten entferntes Ziel
  const ss = scenarioStatus(g);
  if (ss && ss.st.status === 'running' && ss.goals.length) {
    const open = ss.goals.filter((r) => !r.done).sort((a, b) => a.progress - b.progress)[0];
    if (open) add('scen', 'bau', 50, `Szenario-Ziel: ${open.goal.label}`, `Stand: ${open.text}${ss.left !== null ? ` · noch ${ss.left} Tage` : ''}.`);
  }
  return out.sort((a, b) => b.prio - a.prio);
}

function advisorDaily(g) {
  const st = S(g);
  if (g.sandboxNoEvents && !isMetro(g)) return;
  if (g.day() < (st.advisor.next || 0)) return;
  const tips = adviceFor(g).filter((t) => t.prio >= 70);
  const tip = tips.find((t) => !st.advisor.seen[t.id] || g.day() - st.advisor.seen[t.id] >= 6);
  if (!tip) return;
  st.advisor.seen[tip.id] = g.day();
  st.advisor.next = g.day() + 3;
  const a = ADVISORS[tip.who] || ADVISORS.bau;
  g.pushNews({ kind: 'advisor', author: `${a.role} ${a.name}`, text: `${tip.title}: ${tip.text}`, mood: tip.prio >= 85 ? 'bad' : 'info' });
}

// ---------------------------------------------------------------------------------------------
// Verbindung zur Oberfläche
// ---------------------------------------------------------------------------------------------
function pushInbox(g, msg) {
  const st = S(g);
  if (!st) return;
  st.inbox.push({ ...msg, day: g.day() });
  if (st.inbox.length > 30) st.inbox.shift();
}

// Gutscheine aus Wochenkarten (content/cards.js schreibt st.vouchers[kategorie]++)
function redeemVoucher(g, b) {
  const st = S(g);
  const d = BUILDINGS[b.key];
  if (!d || !st.vouchers) return;
  const n = st.vouchers[d.cat] || 0;
  if (n <= 0) return;
  st.vouchers[d.cat] = n - 1;
  const refund = Math.round(d.cost * g.costMul);
  if (refund > 0 && !g.sandbox) g.money += refund;
  g.news('card', `Gutschein eingelöst: ${d.name} war gratis (+${fmtMoney(refund)}).`, 'good', b);
}

// Zeitversetzte Folgen von Ereignissen (content/events.js: FOLLOWUPS[id](g, daten))
function runFollowUps(g) {
  const st = S(g);
  if (!st.fu.length) return;
  const due = st.fu.filter((f) => f.day <= g.day());
  if (!due.length) return;
  st.fu = st.fu.filter((f) => f.day > g.day());
  for (const f of due) {
    const fn = FOLLOWUPS[f.id];
    if (fn) { try { fn(g, f.data || {}); } catch (e) { console.error('Folgeereignis', f.id, e); } }
  }
}

function freshState() {
  return {
    v: 1, ach: {}, counters: freshCounters(), scen: null, metro: null, advisor: { seen: {}, next: 3 },
    fu: [], vouchers: {}, once: {}, skip: [], quests: { active: [], recent: [], next: 4 }, inbox: [], pendingBan: [], day: { flowSum: 0, flowN: 0 }, facts: null,
    burning: new Set(), disSeen: disasterSeq, setupRunning: false, removing: false, calm: 0, auto: 0,
  };
}

registerSystem({
  id: 'progression',
  init(g) {
    g.ext.progression = freshState();
    const st = S(g);
    st.counters.lastLoans = g.loans.length;
    // Lose Kopplung an die Spielereignisse
    g.on('eventResolved', () => { S(g).counters.events++; });
    g.on('cards', (ids) => { if (isMetro(g) && Array.isArray(ids)) metroCards(g, ids); });
    g.on('bankrupt', () => {
      const s2 = S(g);
      const sc = s2.scen && scenarioById(s2.scen.id);
      if (sc && s2.scen.status === 'running' && (sc.fails || []).includes('bankrupt')) endScenario(g, false, 'Die Stadt ist bankrott.');
    });
    g.on('buildingAdded', (b) => {
      const s2 = S(g);
      if (!s2 || s2.setupRunning || s2.auto > 0 || b.zone) return;
      const sc = s2.scen && scenarioById(s2.scen.id);
      if (sc?.banned && s2.scen.status === 'running' && sc.banned.includes(b.key)) { s2.pendingBan.push(b.id); return; }
      redeemVoucher(g, b);
    });
    g.on('buildingRemoved', (b) => {
      const s2 = S(g);
      if (!s2 || s2.setupRunning || s2.removing || s2.auto > 0) return;
      if (!b.burning && !b.abandoned) s2.counters.demolished++;
    });
    if (g.opts.scenario && !g.opts.scenarioSetupDone) setupScenario(g);
  },
  step(g, minutes) {
    const st = S(g);
    if (!st || st.setupRunning) return;
    if (st.pendingBan.length) enforceBans(g);
    if (isMetro(g)) metroStep(g, minutes);
  },
  hourly(g, h) {
    const st = S(g);
    if (!st || st.setupRunning) return;
    st.day.flowSum += g.stats.trafficFlow ?? 1;
    st.day.flowN++;
    // Gelöschte Brände zählen
    const now = new Set();
    for (const b of g.buildings.values()) if (b.burning) now.add(b.id);
    for (const id of st.burning) if (!now.has(id) && g.buildings.has(id)) st.counters.fires++;
    st.burning = now;
    if (disasterSeq > st.disSeen) {
      st.disSeen = disasterSeq;
      if (lastDisaster && lastDisaster.phase === 'end') st.counters.disasters++;
      st.lastDisaster = lastDisaster ? { type: lastDisaster.type, day: g.day() } : null;
    }
    // Nachteule: echte Uhrzeit nach Mitternacht (nur im Browser, damit Tests reproduzierbar bleiben)
    if (typeof window !== 'undefined' && !st.counters.nightowl) { const rh = new Date().getHours(); if (rh >= 0 && rh < 4) st.counters.nightowl = true; }
  },
  daily(g) {
    const st = S(g);
    if (!st || st.setupRunning) return;
    st.facts = cityFacts(g);
    updateCounters(g);
    runFollowUps(g);
    dailyScenario(g);
    if (isMetro(g)) metroDaily(g);
    dailyQuests(g);
    checkAchievements(g);
    advisorDaily(g);
  },
  serialize(g) {
    const st = S(g);
    if (!st) return null;
    return {
      v: st.v, ach: st.ach, counters: st.counters, scen: st.scen, advisor: st.advisor, fu: st.fu, vouchers: st.vouchers, once: st.once, skip: st.skip, quests: st.quests, calm: st.calm,
      metro: st.metro ? { ...st.metro, sites: undefined } : null,
    };
  },
  load(g, d) {
    if (!d) return;
    const st = S(g);
    st.ach = d.ach || {};
    st.counters = { ...freshCounters(), ...(d.counters || {}) };
    st.scen = d.scen || null;
    st.advisor = d.advisor || { seen: {}, next: 0 };
    st.fu = d.fu || [];
    st.vouchers = d.vouchers || {};
    st.once = d.once || {};
    st.skip = d.skip || [];
    st.quests = d.quests || { active: [], recent: [], next: g.day() + 2 };
    st.calm = d.calm || 0;
    st.metro = d.metro || null;
    st.facts = cityFacts(g);
    if (isMetro(g)) applyMetroRules(g);
  },
});

// Für Tests und Werkzeuge
export const _internal = { buildTown, populate, ensureUtilities, ensureServices, settle, placeNear, nextDistrict, settledIslands, cityFacts, mulberry32 };
