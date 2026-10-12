// Zusätzliche Ereignisse mit Entscheidungen. Besitzer: System-Agent „Fortschritt & Inhalte" (S5).
// Form wie in sim/progress.js: { id, title, minPop, cond?(g), text, options: [{ label, hint(g), apply(g) }] }.
// Zeitversetzte Folgen: later(g, tage, id, daten) → FOLLOWUPS[id](g, daten) läuft am Zieltag
// (ausgeführt von sim/systems/progression.js). Bedingungen prüfen fremde Systeme defensiv.
import { EVENTS } from '../sim/progress.js';
import { BUILDINGS } from '../config.js';
import { fmtMoney } from '../util.js';

const P = (g) => g.ext.progression || null;
const later = (g, days, id, data = {}) => { const st = P(g); if (st) st.fu.push({ day: g.day() + days, id, data }); };
const once = (g, id) => { const st = P(g); return !st || !(st.once && st.once[id]); };
const markOnce = (g, id) => { const st = P(g); if (st) (st.once ||= {})[id] = g.day(); };
// Beträge wachsen etwas mit der Stadt
const sc = (g, base) => Math.round((base * (1 + g.stats.pop / 9000)) / 100) * 100;
const money = (g, v) => { if (!g.sandbox) g.money += v; };
const season = (g) => g.ext.weather?.season;
const lines = (g) => g.transit.lines.length;
const chance = (g, p) => g.rng() < p;

export const FOLLOWUPS = {
  pixelFound(g) {
    const st = P(g);
    if (st) st.counters.pixel = true;
    g.addEffect('happy', 3, 4, 'Pixel ist wieder da');
    g.news('event', 'Pixel ist wieder da! Die graue Katze saß drei Tage lang auf dem Dach der Bäckerei und hat sich durchfüttern lassen.', 'good');
  },
  pixelLost(g) {
    g.news('event', 'Von Katze Pixel fehlt weiter jede Spur. Die Nachbarschaft hält die Augen offen.', 'info');
    if (chance(g, 0.5)) later(g, 4 + Math.floor(g.rng() * 5), 'pixelFound');
  },
  ufoReveal(g) { g.news('event', 'Auflösung: Das „UFO" war ein Wetterballon der Volkshochschule. Die Souvenirs verkaufen sich trotzdem prächtig.', 'good'); g.addEffect('tourismAdd', 40, 3, 'UFO-Souvenirs'); },
  doenerStays(g) {
    if (g.hasBuilt('doener') || g.landmarkVouchers.has('doener')) return;
    g.landmarkVouchers.add('doener');
    g.news('event', 'Mêrdîn ist begeistert von der Stadt: Sein Foodtruck soll ein Dönerpalast werden. Du kannst ihn jetzt zum halben Preis bauen!', 'good');
  },
  potholesWorse(g) { g.news('event', 'Aus Schlaglöchern werden Krater – die Autofahrer sind sauer.', 'bad'); g.addEffect('happy', -3, 5, 'Kraterlandschaft'); },
  bondRepay(g, d) { if (!g.sandbox) g.money -= d.amount || 0; g.news('money', `Die Bürgeranleihe ist fällig: ${fmtMoney(d.amount || 0)} zurückgezahlt.`, 'info'); },
  festivalBoom(g) { g.news('event', 'Nach dem Fest: Die Gastronomie meldet Rekordumsätze.', 'good'); g.addEffect('comDemand', 15, 4, 'Nachklang des Festes'); },
  derbyRiot(g) { g.news('event', 'Nach dem Derby gab es Krawall in der Innenstadt. Ein paar Schaufenster sind zu Bruch gegangen.', 'bad'); g.addEffect('happy', -3, 3, 'Derby-Krawall'); },
  wolfPup(g) { g.news('event', 'Die Wölfin im Stadtwald hat Junge bekommen. Die Ranger bieten jetzt Führungen an.', 'good'); g.addEffect('tourismAdd', 60, 5, 'Wolfsführungen'); },
  dataCenterHeat(g) { g.news('event', 'Das Rechenzentrum heizt mit seiner Abwärme jetzt das Freibad. Win-win!', 'good'); g.addEffect('happy', 2, 6, 'Warmes Freibad'); },
  electionResult(g, d) {
    if (g.stats.happiness >= (d.need || 55)) { g.news('event', `Wahlabend: Du wurdest mit ${Math.round(50 + (g.stats.happiness - 50) * 0.8)} % im Amt bestätigt!`, 'good'); g.addEffect('happy', 3, 7, 'Wahlsieg'); money(g, sc(g, 3000)); }
    else { g.news('event', 'Wahlabend: knapp! Die Opposition hat stark zugelegt und blockiert eine Woche lang den Haushalt.', 'bad'); g.addEffect('taxMul', -0.15, 7, 'Haushaltssperre'); }
  },
  artistFamous(g) { g.news('event', 'Die Streetart in der Stadt landet auf einem Kunstblog. Fotografen strömen herbei.', 'good'); g.addEffect('tourismAdd', 70, 6, 'Streetart-Ruhm'); },
  startupExit(g) { g.news('event', 'Ein Start-up aus dem Coworking-Space wurde für viel Geld gekauft – und zahlt die Gewerbesteuer brav vor Ort.', 'good'); money(g, sc(g, 6000)); },
  hollywoodPremiere(g) { g.news('event', 'Premiere des Films, der hier gedreht wurde: Die ganze Stadt sitzt im Kino.', 'good'); g.addEffect('tourismAdd', 150, 7, 'Drehort-Tourismus'); g.addEffect('happy', 2, 5, 'Filmpremiere'); },
  beesBack(g) { g.news('event', 'Die Blühwiesen summen: Imker melden die beste Honigernte seit Jahren.', 'good'); g.addEffect('happy', 2, 5, 'Stadthonig'); },
};

const NEW_EVENTS = [
  {
    id: 'pixel', title: 'Katze Pixel entlaufen', minPop: 80, cond: (g) => !P(g)?.counters?.pixel,
    text: 'Lena aus der Lindenstraße vermisst ihre graue Katze Pixel. Halb Stadtfunk sucht schon mit – und alle schauen auf dich.',
    options: [
      { label: 'Suchtrupp losschicken', hint: () => '−500 €, gute Chancen, Pixel bald zu finden', apply: (g) => { money(g, -500); later(g, 2 + Math.floor(g.rng() * 3), chance(g, 0.75) ? 'pixelFound' : 'pixelLost'); } },
      { label: 'Plakate drucken', hint: () => '−100 €, vielleicht taucht sie auf', apply: (g) => { money(g, -100); later(g, 3 + Math.floor(g.rng() * 4), chance(g, 0.45) ? 'pixelFound' : 'pixelLost'); } },
      { label: 'Katzen finden immer heim', hint: () => 'Nichts tun und hoffen', apply: (g) => { if (chance(g, 0.25)) later(g, 6, 'pixelFound'); } },
    ],
  },
  {
    id: 'ufo', title: 'Lichter am Himmel', minPop: 400,
    text: 'Dutzende Bürger melden seltsame Lichter über dem Stadtrand. Die Zeitung titelt „Besuch aus dem All?". Ein Professor will messen, ein Wirt will feiern.',
    options: [
      { label: 'Wissenschaftlich untersuchen', hint: (g) => `−${fmtMoney(sc(g, 1500))}, Bildung wächst 7 Tage schneller`, apply: (g) => { money(g, -sc(g, 1500)); g.addEffect('happy', 1, 4, 'Forschergeist'); later(g, 3, 'ufoReveal'); } },
      { label: 'UFO-Festival ausrufen', hint: (g) => `−${fmtMoney(sc(g, 3000))}, +180 Touristen für 5 Tage`, apply: (g) => { money(g, -sc(g, 3000)); g.addEffect('tourismAdd', 180, 5, 'UFO-Festival'); later(g, 5, 'ufoReveal'); } },
      { label: 'Kein Kommentar', hint: () => 'Die Gerüchte bleiben', apply: () => {} },
    ],
  },
  {
    id: 'potholes', title: 'Schlaglöcher nach dem Winter', minPop: 300,
    text: 'Frost und Lastwagen haben die Straßen zerlöchert. Radfahrer fluchen, Autowerkstätten freuen sich.',
    options: [
      { label: 'Sofort sanieren', hint: (g) => `−${fmtMoney(sc(g, 2500))}`, apply: (g) => money(g, -sc(g, 2500)) },
      { label: 'Flicken und abwarten', hint: (g) => `−${fmtMoney(sc(g, 600))}, Risiko für Ärger`, apply: (g) => { money(g, -sc(g, 600)); if (chance(g, 0.5)) later(g, 4, 'potholesWorse'); } },
    ],
  },
  {
    id: 'market', title: 'Wochenmarkt', minPop: 200,
    text: 'Bauern aus dem Umland möchten jeden Samstag auf dem Marktplatz Obst, Käse und Blumen verkaufen.',
    options: [
      { label: 'Erlauben', hint: () => 'Gewerbenachfrage +15 und Glück +2 für 10 Tage', apply: (g) => { g.addEffect('comDemand', 15, 10, 'Wochenmarkt'); g.addEffect('happy', 2, 10, 'Wochenmarkt'); } },
      { label: 'Die Läden schützen', hint: () => 'Gewerbesteuer +10 % für 7 Tage, Glück −1', apply: (g) => { g.addEffect('comTax', 0.1, 7, 'Kein Wochenmarkt'); g.addEffect('happy', -1, 7, 'Kein Wochenmarkt'); } },
    ],
  },
  {
    id: 'hollywood', title: 'Hollywood ruft', minPop: 1500,
    text: 'Ein Filmstudio will einen Actionfilm in deiner Innenstadt drehen. Drei Tage Absperrungen, Explosionen (nur gespielt) und ein Star im Hotel.',
    options: [
      { label: 'Drehgenehmigung erteilen', hint: (g) => `+${fmtMoney(sc(g, 8000))}, Glück −2 für 3 Tage, später Touristen`, apply: (g) => { money(g, sc(g, 8000)); g.addEffect('happy', -2, 3, 'Filmdreh-Sperrungen'); later(g, 12, 'hollywoodPremiere'); } },
      { label: 'Ablehnen', hint: () => 'Ruhe in der Stadt', apply: () => {} },
    ],
  },
  {
    id: 'bikelanes', title: 'Radentscheid', minPop: 800,
    text: 'Tausende Unterschriften für sichere Radwege. Die Autolobby ist dagegen, die Bäckerinnung dafür.',
    options: [
      { label: 'Radwege bauen', hint: (g) => `−${fmtMoney(sc(g, 5000))}, Glück +3 für 12 Tage, Pulsbahn +10 %`, apply: (g) => { money(g, -sc(g, 5000)); g.addEffect('happy', 3, 12, 'Neue Radwege'); g.addEffect('ridership', 0.1, 12, 'Radwege zur Station'); } },
      { label: 'Ablehnen', hint: () => 'Glück −3 für 6 Tage', apply: (g) => g.addEffect('happy', -3, 6, 'Radentscheid abgelehnt') },
    ],
  },
  {
    id: 'tropicalnights', title: 'Tropennächte', minPop: 400, cond: (g) => season(g) === 'summer' || (g.ext.weather?.temp ?? 0) > 28,
    text: 'Seit einer Woche kühlt es nachts nicht mehr ab. Niemand schläft, alle sind gereizt.',
    options: [
      { label: 'Kühle Räume öffnen', hint: (g) => `−${fmtMoney(sc(g, 1500))}, Glück +2 für 4 Tage`, apply: (g) => { money(g, -sc(g, 1500)); g.addEffect('happy', 2, 4, 'Kühle Räume'); } },
      { label: 'Freibäder bis Mitternacht', hint: () => 'Wasserverbrauch +20 %, Glück +4 für 4 Tage', cond: (g) => g.hasBuilt('swimming_pool'), apply: (g) => { g.addEffect('waterUse', 0.2, 4, 'Nachtbaden'); g.addEffect('happy', 4, 4, 'Nachtbaden'); } },
      { label: 'Durchhalten', hint: () => 'Glück −3 für 4 Tage', apply: (g) => g.addEffect('happy', -3, 4, 'Schlaflose Nächte') },
    ],
  },
  {
    id: 'snowchaos', title: 'Schneechaos', minPop: 300, cond: (g) => season(g) === 'winter' || (g.ext.weather?.snow ?? 0) > 0.3,
    text: 'Über Nacht 40 Zentimeter Neuschnee. Busse stecken fest, Kinder bauen Iglus auf der Hauptstraße.',
    options: [
      { label: 'Winterdienst aufstocken', hint: (g) => `−${fmtMoney(sc(g, 3500))}`, apply: (g) => money(g, -sc(g, 3500)) },
      { label: 'Schneefrei für alle!', hint: () => 'Steuern −20 % für 2 Tage, Glück +3, Pulsbahn +25 %', apply: (g) => { g.addEffect('taxMul', -0.2, 2, 'Schneefrei'); g.addEffect('happy', 3, 3, 'Schneefrei'); g.addEffect('ridership', 0.25, 3, 'Alle fahren Bahn'); } },
      { label: 'Abwarten', hint: () => 'Glück −4 für 3 Tage', apply: (g) => g.addEffect('happy', -4, 3, 'Schneechaos') },
    ],
  },
  {
    id: 'floodwarn', title: 'Hochwasserwarnung', minPop: 300, cond: (g) => g.opts.mapType === 'river' || (g.ext.weather?.rain ?? 0) > 0.6,
    text: 'Nach tagelangem Regen steigt der Pegel. Der Katastrophenschutz rät zu Sandsäcken an den Ufern.',
    options: [
      { label: 'Sandsäcke verteilen', hint: (g) => `−${fmtMoney(sc(g, 3000))}`, apply: (g) => money(g, -sc(g, 3000)) },
      { label: 'Wird schon halten', hint: () => 'Ungewiss: vielleicht nasse Keller und Ärger', apply: (g) => { if (chance(g, 0.55)) { g.addEffect('happy', -5, 4, 'Nasse Keller'); money(g, -sc(g, 1500)); g.news('event', 'Das Wasser kam doch: nasse Keller in den Ufervierteln.', 'bad'); } else g.news('event', 'Glück gehabt – der Pegel sinkt wieder.', 'good'); } },
    ],
  },
  {
    id: 'scandal', title: 'Spesenaffäre', minPop: 1000,
    text: 'Der Anzeiger berichtet über deine Dienstreise zur „Kanalisationsmesse" auf Mallorca. Die Leserbriefe kochen.',
    options: [
      { label: 'Alles offenlegen und zurückzahlen', hint: () => '−1.200 €, Glück −1 für 3 Tage', apply: (g) => { money(g, -1200); g.addEffect('happy', -1, 3, 'Spesenaffäre'); } },
      { label: 'Abstreiten', hint: () => 'Ungewiss: Glück −6 für 7 Tage, falls es auffliegt', apply: (g) => { if (chance(g, 0.4)) { g.addEffect('happy', -6, 7, 'Spesenaffäre'); g.news('event', 'Fotos vom Strand sind aufgetaucht. Peinlich.', 'bad'); } } },
    ],
  },
  {
    id: 'techfair', title: 'Technikmesse', minPop: 3000, cond: (g) => g.isUnlocked('zone4'),
    text: 'Die Region sucht einen Ort für die große Technikmesse. Dein Stadtmarketing hat sich ungefragt beworben – und gewonnen.',
    options: [
      { label: 'Ausrichten', hint: (g) => `−${fmtMoney(sc(g, 9000))}, Büronachfrage +40 für 10 Tage, +150 Touristen für 4 Tage`, apply: (g) => { money(g, -sc(g, 9000)); g.addEffect('offDemand', 40, 10, 'Technikmesse'); g.addEffect('tourismAdd', 150, 4, 'Technikmesse'); } },
      { label: 'Absagen', hint: () => 'Nichts passiert', apply: () => {} },
    ],
  },
  {
    id: 'zoobaby', title: 'Nachwuchs im Zoo', minPop: 500, cond: (g) => g.hasBuilt('zoo'),
    text: 'Im Zoo ist ein Elefantenbaby zur Welt gekommen! Das ganze Land will es sehen.',
    options: [
      { label: 'Namenswettbewerb', hint: () => '+220 Touristen für 7 Tage, Glück +3', apply: (g) => { g.addEffect('tourismAdd', 220, 7, 'Elefantenbaby'); g.addEffect('happy', 3, 7, 'Elefantenbaby'); } },
      { label: 'Ganz in Ruhe aufziehen', hint: () => '+80 Touristen für 5 Tage', apply: (g) => g.addEffect('tourismAdd', 80, 5, 'Elefantenbaby') },
    ],
  },
  {
    id: 'derby', title: 'Lokalderby', minPop: 800, cond: (g) => g.hasBuilt('stadium'),
    text: 'Am Samstag kommt der Erzrivale aus der Nachbarstadt. Die Polizei rechnet mit hitzigen Fans.',
    options: [
      { label: 'Großes Polizeiaufgebot', hint: (g) => `−${fmtMoney(sc(g, 2500))}, Glück +4 für 3 Tage`, apply: (g) => { money(g, -sc(g, 2500)); g.addEffect('happy', 4, 3, 'Derbysieg'); } },
      { label: 'Wird schon friedlich', hint: () => 'Ungewiss: Volksfest oder Krawall', apply: (g) => { if (chance(g, 0.5)) later(g, 1, 'derbyRiot'); else g.addEffect('happy', 4, 3, 'Derbysieg'); } },
    ],
  },
  {
    id: 'foodtruck', title: 'Mêrdîns Foodtruck', minPop: 250, cond: (g) => !g.hasBuilt('doener') && !g.landmarkVouchers.has('doener'),
    text: 'Ein Foodtruck mit gelbem „M" parkt seit Tagen am Marktplatz. Die Schlange reicht bis zur Kirche: Chili-Cheese-Döner mit eigener Soße.',
    options: [
      { label: 'Festen Standplatz genehmigen', hint: () => 'Glück +3, Gewerbe +15 für 5 Tage – vielleicht bleibt Mêrdîn für immer', apply: (g) => { g.addEffect('happy', 3, 5, 'Mêrdîns Foodtruck'); g.addEffect('comDemand', 15, 5, 'Mêrdîns Foodtruck'); if (chance(g, 0.6)) later(g, 4, 'doenerStays'); } },
      { label: 'Ordnungsamt schicken', hint: () => 'Glück −2 für 4 Tage', apply: (g) => g.addEffect('happy', -2, 4, 'Kein Döner mehr') },
    ],
  },
  {
    id: 'coworking', title: 'Coworking-Space', minPop: 1500, cond: (g) => g.isUnlocked('zone4'),
    text: 'In der alten Post wollen Gründerinnen einen Coworking-Space eröffnen. Sie fragen nach einem Zuschuss für schnelles Internet.',
    options: [
      { label: 'Zuschuss geben', hint: (g) => `−${fmtMoney(sc(g, 4000))}, Büronachfrage +30 für 8 Tage, mit Glück ein Erfolg`, apply: (g) => { money(g, -sc(g, 4000)); g.addEffect('offDemand', 30, 8, 'Coworking'); if (chance(g, 0.4)) later(g, 14, 'startupExit'); } },
      { label: 'Der Markt regelt das', hint: () => 'Büronachfrage +8 für 4 Tage', apply: (g) => g.addEffect('offDemand', 8, 4, 'Coworking') },
    ],
  },
  {
    id: 'seniors', title: 'Seniorenrat', minPop: 1200,
    text: 'Der Seniorenrat fordert mehr Bänke, Ärzte in Laufnähe und langsamere Ampeln. Sie haben 300 Stricksocken als Druckmittel.',
    options: [
      { label: 'Bänke und Hausbesuche', hint: (g) => `−${fmtMoney(sc(g, 4500))}, Glück +4 für 10 Tage, Gesundheit +20 %`, apply: (g) => { money(g, -sc(g, 4500)); g.addEffect('happy', 4, 10, 'Seniorenfreundlich'); g.addEffect('healthCov', 0.2, 10, 'Hausbesuche'); } },
      { label: 'Vertrösten', hint: () => 'Glück −3 für 7 Tage', apply: (g) => g.addEffect('happy', -3, 7, 'Enttäuschte Senioren') },
    ],
  },
  {
    id: 'youth', title: 'Jugendparlament', minPop: 700,
    text: 'Das Jugendparlament will Skateparks, Bolzplätze und einen Ort zum Abhängen. Die Rede der Sprecherin ging viral.',
    options: [
      { label: 'Ja – Parks eine Woche gratis', hint: () => 'Parks 6 Tage kostenlos', apply: (g) => g.addEffect('parkFree', 1, 6, 'Jugendparlament') },
      { label: 'Kein Budget', hint: () => 'Glück −2 für 5 Tage', apply: (g) => g.addEffect('happy', -2, 5, 'Frust bei der Jugend') },
    ],
  },
  {
    id: 'datacenter', title: 'Rechenzentrum', minPop: 2500,
    text: 'Ein Cloud-Anbieter will ein riesiges Rechenzentrum bauen. Viel Gewerbesteuer – aber auch ein enormer Stromhunger.',
    options: [
      { label: 'Ansiedeln', hint: (g) => `+${fmtMoney(sc(g, 12000))}, Büronachfrage +25, Kraftwerke 14 Tage −12 %`, apply: (g) => { money(g, sc(g, 12000)); g.addEffect('offDemand', 25, 10, 'Rechenzentrum'); g.addEffect('powerMul', -0.12, 14, 'Rechenzentrum'); if (g.hasBuilt('swimming_pool')) later(g, 8, 'dataCenterHeat'); } },
      { label: 'Ablehnen', hint: () => 'Nichts passiert', apply: () => {} },
    ],
  },
  {
    id: 'wolf', title: 'Ein Wolf im Stadtwald', minPop: 300, cond: (g) => !!g.world.forest,
    text: 'Spaziergänger haben einen Wolf gesichtet. Die einen haben Angst, die anderen sind entzückt.',
    options: [
      { label: 'Ranger beauftragen', hint: (g) => `−${fmtMoney(sc(g, 1200))}, Glück +1`, apply: (g) => { money(g, -sc(g, 1200)); g.addEffect('happy', 1, 4, 'Ranger im Wald'); if (chance(g, 0.5)) later(g, 10, 'wolfPup'); } },
      { label: 'Zur Attraktion machen', hint: () => '+60 Touristen für 6 Tage, Glück −1', apply: (g) => { g.addEffect('tourismAdd', 60, 6, 'Wolfsland'); g.addEffect('happy', -1, 6, 'Angst vor dem Wolf'); } },
    ],
  },
  {
    id: 'meteors', title: 'Sternschnuppennacht', minPop: 500,
    text: 'Heute Nacht erreicht der Meteorstrom seinen Höhepunkt. Sternfreunde bitten darum, die Straßenlaternen für zwei Stunden auszuschalten.',
    options: [
      { label: 'Licht aus!', hint: () => 'Glück +4 für 2 Tage, Gewerbe −20 % Steuer an diesen Tagen', apply: (g) => { g.addEffect('happy', 4, 2, 'Sternschnuppen'); g.addEffect('comTax', -0.2, 2, 'Dunkle Nacht'); } },
      { label: 'Sicherheit geht vor', hint: () => 'Nichts passiert', apply: () => {} },
    ],
  },
  {
    id: 'trainstrike', title: 'Streik bei der Pulsbahn', minPop: 600, cond: (g) => lines(g) >= 1,
    text: 'Die Lokführer der Pulsbahn fordern mehr Lohn und kürzere Schichten. Ab morgen soll gestreikt werden.',
    options: [
      { label: 'Tarifeinigung', hint: (g) => `−${fmtMoney(sc(g, 3500))}`, apply: (g) => money(g, -sc(g, 3500)) },
      { label: 'Durchhalten', hint: () => 'Pulsbahn-Fahrgäste −60 % und Glück −3 für 3 Tage', apply: (g) => { g.addEffect('ridership', -0.6, 3, 'Bahnstreik'); g.addEffect('happy', -3, 3, 'Bahnstreik'); } },
    ],
  },
  {
    id: 'rents', title: 'Mietenwahnsinn', minPop: 2500,
    text: 'Die Mieten steigen schneller als die Löhne. Auf dem Marktplatz demonstrieren Tausende.',
    options: [
      { label: 'Mietpreisbremse', hint: () => 'Wohnglück +4 für 14 Tage, Wohnnachfrage −15', apply: (g) => { g.addEffect('happyRes', 4, 14, 'Mietpreisbremse'); g.addEffect('resDemand', -15, 14, 'Mietpreisbremse'); } },
      { label: 'Bauoffensive', hint: (g) => `−${fmtMoney(sc(g, 7000))}, Wohnnachfrage +35 für 10 Tage`, apply: (g) => { money(g, -sc(g, 7000)); g.addEffect('resDemand', 35, 10, 'Bauoffensive'); } },
      { label: 'Aussitzen', hint: () => 'Glück −4 für 8 Tage', apply: (g) => g.addEffect('happy', -4, 8, 'Mietenwahnsinn') },
    ],
  },
  {
    id: 'smog', title: 'Smogalarm', minPop: 600, cond: (g) => g.stats.pollutionAvg > 0.12,
    text: 'Eine braune Dunstglocke hängt über der Stadt. Der Arzt im Fernsehen rät, die Fenster geschlossen zu halten.',
    options: [
      { label: 'Fahrverbote und Werksdrosselung', hint: () => 'Industrie-Nachfrage −20, Pulsbahn +30 %, Glück −1 für 5 Tage', apply: (g) => { g.addEffect('indDemand', -20, 5, 'Smog-Fahrverbot'); g.addEffect('ridership', 0.3, 5, 'Smog-Fahrverbot'); g.addEffect('happy', -1, 5, 'Smog-Fahrverbot'); } },
      { label: 'Abwarten, bis Wind kommt', hint: () => 'Glück −5 und Gesundheit −20 % für 5 Tage', apply: (g) => { g.addEffect('happy', -5, 5, 'Smog'); g.addEffect('healthCov', -0.2, 5, 'Smog'); } },
    ],
  },
  {
    id: 'streetart', title: 'Streetart-Künstlerin', minPop: 600,
    text: 'Über Nacht ist an der Brandmauer am Bahnhof ein riesiges Wandbild aufgetaucht: ein Wal, der über die Dächer schwimmt.',
    options: [
      { label: 'Wände freigeben', hint: () => 'Bodenwert +3 für 12 Tage, Glück +2', apply: (g) => { g.addEffect('lvAdd', 3, 12, 'Streetart'); g.addEffect('happy', 2, 6, 'Streetart'); if (chance(g, 0.5)) later(g, 7, 'artistFamous'); } },
      { label: 'Übermalen lassen', hint: () => '−800 €', apply: (g) => money(g, -800) },
    ],
  },
  {
    id: 'touristbus', title: 'Eine Busladung Touristen', minPop: 400,
    text: 'Ein Reisebus hat sich verfahren und steht nun mit 50 ratlosen Touristen auf dem Marktplatz.',
    options: [
      { label: 'Spontane Stadtführung', hint: () => '−600 €, +100 Touristen für 3 Tage', apply: (g) => { money(g, -600); g.addEffect('tourismAdd', 100, 3, 'Spontanführung'); } },
      { label: 'Wegbeschreibung geben', hint: () => 'Nichts passiert', apply: () => {} },
    ],
  },
  {
    id: 'substation', title: 'Umspannwerk überlastet', minPop: 400, cond: (g) => g.util.powerSupply > 0 && g.util.powerDemand > g.util.powerSupply * 0.85,
    text: 'Die Stadtwerke warnen: Das Netz läuft am Limit. Bei der nächsten Lastspitze droht ein Ausfall.',
    options: [
      { label: 'Notstromaggregate mieten', hint: (g) => `−${fmtMoney(sc(g, 4000))}, Kraftwerke +20 % für 6 Tage`, apply: (g) => { money(g, -sc(g, 4000)); g.addEffect('powerMul', 0.2, 6, 'Notstrom'); } },
      { label: 'Lastabwurf riskieren', hint: () => 'Ungewiss: kurze Stromausfälle', apply: (g) => { if (chance(g, 0.6)) { g.addEffect('powerMul', -0.3, 2, 'Lastabwurf'); g.news('event', 'Lastabwurf: In einigen Vierteln gingen die Lichter aus.', 'bad'); } } },
    ],
  },
  {
    id: 'watermain', title: 'Rohrbruch!', minPop: 700,
    text: 'Unter der Hauptstraße ist ein Wasserrohr geplatzt. Eine Fontäne steigt bis in den dritten Stock.',
    options: [
      { label: 'Notreparatur über Nacht', hint: (g) => `−${fmtMoney(sc(g, 3000))}`, apply: (g) => money(g, -sc(g, 3000)) },
      { label: 'Provisorium legen', hint: () => 'Wasserverbrauch +30 % und Glück −2 für 3 Tage', apply: (g) => { g.addEffect('waterUse', 0.3, 3, 'Rohrbruch'); g.addEffect('happy', -2, 3, 'Rohrbruch'); } },
    ],
  },
  {
    id: 'deposit', title: 'Pfandsystem für Becher', minPop: 1000,
    text: 'Eine Initiative will Einwegbecher verbannen und ein Pfandsystem für die ganze Stadt einführen.',
    options: [
      { label: 'Einführen', hint: () => 'Müllabfuhr +30 % für 14 Tage, Gewerbesteuer −10 %', apply: (g) => { g.addEffect('garbageCov', 0.3, 14, 'Pfandbecher'); g.addEffect('comTax', -0.1, 14, 'Pfandbecher'); } },
      { label: 'Freiwillig lassen', hint: () => 'Nichts passiert', apply: () => {} },
    ],
  },
  {
    id: 'testament', title: 'Ein großzügiges Testament', minPop: 500,
    text: 'Die verstorbene Fabrikantenwitwe Hildegard Sommer hat der Stadt ihr Vermögen vermacht – mit dem Wunsch nach „mehr Grün".',
    options: [
      { label: 'Für Parks verwenden', hint: (g) => `+${fmtMoney(sc(g, 5000))}, Parks 5 Tage kostenlos`, apply: (g) => { money(g, sc(g, 5000)); g.addEffect('parkFree', 1, 5, 'Sommer-Stiftung'); } },
      { label: 'In die Stadtkasse', hint: (g) => `+${fmtMoney(sc(g, 8000))}, Glück −1 für 3 Tage`, apply: (g) => { money(g, sc(g, 8000)); g.addEffect('happy', -1, 3, 'Letzter Wille missachtet'); } },
    ],
  },
  {
    id: 'oldtown', title: 'Altstadtfest', minPop: 1500,
    text: 'Das Altstadtfest steht an. Die Schausteller fragen, wie groß es dieses Jahr werden darf.',
    options: [
      { label: 'Groß feiern', hint: (g) => `−${fmtMoney(sc(g, 5000))}, Glück +6 und +160 Touristen für 4 Tage`, apply: (g) => { money(g, -sc(g, 5000)); g.addEffect('happy', 6, 4, 'Altstadtfest'); g.addEffect('tourismAdd', 160, 4, 'Altstadtfest'); later(g, 5, 'festivalBoom'); } },
      { label: 'Klein feiern', hint: (g) => `−${fmtMoney(sc(g, 1000))}, Glück +2 für 3 Tage`, apply: (g) => { money(g, -sc(g, 1000)); g.addEffect('happy', 2, 3, 'Altstadtfest'); } },
    ],
  },
  {
    id: 'chess', title: 'Schach-Weltmeisterschaft', minPop: 4000,
    text: 'Der Weltschachbund sucht einen Austragungsort. Der Bürgermeister der Nachbarstadt hat sich auch beworben – mit Freibier.',
    options: [
      { label: 'Bewerben', hint: (g) => `−${fmtMoney(sc(g, 14000))}, +380 Touristen für 7 Tage, Glück +3`, apply: (g) => { money(g, -sc(g, 14000)); g.addEffect('tourismAdd', 380, 7, 'Schach-WM'); g.addEffect('happy', 3, 7, 'Schach-WM'); } },
      { label: 'Nicht unser Spiel', hint: () => 'Nichts passiert', apply: () => {} },
    ],
  },
  {
    id: 'nobel', title: 'Nobelpreis!', minPop: 2000, cond: (g) => g.hasBuilt('university') || g.hasBuilt('research'),
    text: 'Eine Professorin deiner Universität hat den Nobelpreis gewonnen! Die Presse belagert den Campus.',
    options: [
      { label: 'Ehrenbürgerschaft und Feier', hint: (g) => `−${fmtMoney(sc(g, 2000))}, Glück +3, Büronachfrage +20 für 10 Tage`, apply: (g) => { money(g, -sc(g, 2000)); g.addEffect('happy', 3, 6, 'Nobelpreis'); g.addEffect('offDemand', 20, 10, 'Nobelpreis'); } },
      { label: 'Glückwunschkarte schicken', hint: () => 'Büronachfrage +5 für 5 Tage', apply: (g) => g.addEffect('offDemand', 5, 5, 'Nobelpreis') },
    ],
  },
  {
    id: 'speedcams', title: 'Blitzer-Debatte', minPop: 1000,
    text: 'Die Polizei schlägt neue Blitzer an den Hauptstraßen vor. „Abzocke!", rufen die einen. „Endlich!", die anderen.',
    options: [
      { label: 'Mehr Blitzer', hint: () => '+Einnahmen für 10 Tage, Glück −2', apply: (g) => { g.addEffect('incomeAdd', Math.round(60 + g.stats.pop * 0.03), 10, 'Blitzer'); g.addEffect('happy', -2, 10, 'Blitzer'); } },
      { label: 'Lieber Tempo-30-Schilder', hint: () => 'Glück +2 für 5 Tage', apply: (g) => g.addEffect('happy', 2, 5, 'Keine Blitzer') },
    ],
  },
  {
    id: 'bees', title: 'Bienensterben', minPop: 800,
    text: 'Imker schlagen Alarm: Die Bienen finden in der Stadt kaum noch Blüten.',
    options: [
      { label: 'Blühwiesen anlegen', hint: (g) => `−${fmtMoney(sc(g, 2200))}, Glück +2, Bodenwert +1`, apply: (g) => { money(g, -sc(g, 2200)); g.addEffect('happy', 2, 6, 'Blühwiesen'); g.addEffect('lvAdd', 1, 14, 'Blühwiesen'); later(g, 12, 'beesBack'); } },
      { label: 'Kein Geld dafür', hint: () => 'Glück −1 für 5 Tage', apply: (g) => g.addEffect('happy', -1, 5, 'Stille Wiesen') },
    ],
  },
  {
    id: 'fog', title: 'Dichter Nebel', minPop: 500, cond: (g) => (g.ext.weather?.fog ?? 0) > 0.5 || season(g) === 'autumn',
    text: 'Seit dem Morgen sieht man keine zehn Meter weit. Autofahrer kriechen, die Pulsbahn fährt hoch über dem Nebel.',
    options: [
      { label: 'Pulsbahn verstärken', hint: (g) => `−${fmtMoney(sc(g, 1500))}, Pulsbahn +30 % für 3 Tage`, apply: (g) => { money(g, -sc(g, 1500)); g.addEffect('ridership', 0.3, 3, 'Nebel-Takt'); } },
      { label: 'Nichts unternehmen', hint: () => 'Glück −1 für 2 Tage', apply: (g) => g.addEffect('happy', -1, 2, 'Nebelfrust') },
    ],
  },
  {
    id: 'harborfest', title: 'Hafengeburtstag', minPop: 800, cond: (g) => g.hasBuilt('cargo_harbor') || g.hasBuilt('ferry_pier') || g.hasBuilt('lighthouse'),
    text: 'Der Hafen feiert Jubiläum: Schiffsparade, Fischbrötchen und Feuerwerk über dem Wasser.',
    options: [
      { label: 'Groß feiern', hint: (g) => `−${fmtMoney(sc(g, 4000))}, +220 Touristen für 5 Tage, Glück +3`, apply: (g) => { money(g, -sc(g, 4000)); g.addEffect('tourismAdd', 220, 5, 'Hafengeburtstag'); g.addEffect('happy', 3, 5, 'Hafengeburtstag'); } },
      { label: 'Nur Fischbrötchen', hint: () => 'Glück +1 für 3 Tage', apply: (g) => g.addEffect('happy', 1, 3, 'Fischbrötchen') },
    ],
  },
  {
    id: 'plantclose', title: 'Werk droht mit Schließung', minPop: 1000, cond: (g) => g.stats.jobsByZone[3] > 300,
    text: 'Der größte Arbeitgeber der Industriezone droht mit Verlagerung ins Ausland – es sei denn, die Stadt hilft.',
    options: [
      { label: 'Subventionen zahlen', hint: (g) => `−${fmtMoney(sc(g, 7000))}, Industrie-Nachfrage +20 für 7 Tage`, apply: (g) => { money(g, -sc(g, 7000)); g.addEffect('indDemand', 20, 7, 'Werksrettung'); } },
      { label: 'Ziehen lassen', hint: () => 'Industrie-Nachfrage −30 für 10 Tage, Glück −2', apply: (g) => { g.addEffect('indDemand', -30, 10, 'Werksschließung'); g.addEffect('happy', -2, 7, 'Werksschließung'); } },
    ],
  },
  {
    id: 'newspaper', title: '100 Jahre Anzeiger', minPop: 300,
    text: 'Deine Lokalzeitung wird 100 Jahre alt. Die Chefredaktion fragt höflich nach einem Grußwort – und einer Anzeige.',
    options: [
      { label: 'Jubiläumsausgabe sponsern', hint: () => '−1.000 €, Glück +2 für 5 Tage', apply: (g) => { money(g, -1000); g.addEffect('happy', 2, 5, 'Gute Presse'); } },
      { label: 'Nur das Grußwort', hint: () => 'Nichts passiert', apply: () => {} },
    ],
  },
  {
    id: 'boars', title: 'Die Wildschweine sind los', minPop: 300,
    text: 'Eine Rotte Wildschweine durchwühlt nachts die Vorgärten. Ein Keiler hat sich im Freibad häuslich eingerichtet.',
    options: [
      { label: 'Jäger beauftragen', hint: () => '−800 €', apply: (g) => money(g, -800) },
      { label: 'Zum Stadtmaskottchen machen', hint: () => 'Glück +2, +40 Touristen für 3 Tage, Gärten leiden', apply: (g) => { g.addEffect('happy', 2, 3, 'Keiler Karl'); g.addEffect('tourismAdd', 40, 3, 'Keiler Karl'); g.addEffect('happyRes', -1, 4, 'Zerwühlte Gärten'); } },
    ],
  },
  {
    id: 'wifi', title: 'Freies WLAN', minPop: 1200,
    text: 'Die Jugend will freies WLAN in der ganzen Innenstadt. Die Wirtschaft auch. Die Oma von nebenan fragt, was das ist.',
    options: [
      { label: 'Ausbauen', hint: (g) => `−${fmtMoney(sc(g, 5500))}, Glück +3 und Büronachfrage +15 für 14 Tage`, apply: (g) => { money(g, -sc(g, 5500)); g.addEffect('happy', 3, 14, 'Stadt-WLAN'); g.addEffect('offDemand', 15, 14, 'Stadt-WLAN'); } },
      { label: 'Später', hint: () => 'Nichts passiert', apply: () => {} },
    ],
  },
  {
    id: 'trainfans', title: 'Pulsbahn-Fanclub', minPop: 800, cond: (g) => lines(g) >= 3,
    text: 'Ein Verein von Bahnfans will die erste Pulsbahn-Fahrzeugschau organisieren – mit Führerstandsmitfahrten.',
    options: [
      { label: 'Fahrzeugschau unterstützen', hint: () => '−1.500 €, Pulsbahn +25 % für 7 Tage, Glück +2', apply: (g) => { money(g, -1500); g.addEffect('ridership', 0.25, 7, 'Bahn-Fanfest'); g.addEffect('happy', 2, 5, 'Bahn-Fanfest'); } },
      { label: 'Nein danke', hint: () => 'Nichts passiert', apply: () => {} },
    ],
  },
  {
    id: 'busstrike', title: 'Busfahrerstreik', minPop: 600, cond: (g) => (g.ext.transport?.lines?.length || 0) > 0 || g.hasBuilt('bus_depot'),
    text: 'Die Busfahrer legen die Arbeit nieder. An den Haltestellen stehen Menschen und tippen ungeduldig auf ihre Uhren.',
    options: [
      { label: 'Schnelle Einigung', hint: (g) => `−${fmtMoney(sc(g, 3000))}`, apply: (g) => money(g, -sc(g, 3000)) },
      { label: 'Die Pulsbahn springt ein', hint: () => 'Pulsbahn +30 % und Glück −2 für 4 Tage', apply: (g) => { g.addEffect('ridership', 0.3, 4, 'Busstreik'); g.addEffect('happy', -2, 4, 'Busstreik'); } },
    ],
  },
  {
    id: 'districtfest', title: 'Bezirksfest', minPop: 800, cond: (g) => (g.ext.districts?.list?.length || 0) >= 2,
    text: 'Die Bezirke wetteifern um das schönste Straßenfest des Jahres. Jeder will Bühne, Bratwurst und Bürgermeister.',
    options: [
      { label: 'Alle Bezirke fördern', hint: (g) => `−${fmtMoney(sc(g, 3000))}, Glück +4 für 5 Tage`, apply: (g) => { money(g, -sc(g, 3000)); g.addEffect('happy', 4, 5, 'Bezirksfeste'); } },
      { label: 'Nur einen Preis ausloben', hint: () => '−500 €, Glück +1 für 4 Tage', apply: (g) => { money(g, -500); g.addEffect('happy', 1, 4, 'Bezirkspreis'); } },
    ],
  },
  {
    id: 'shortage', title: 'Lieferengpass', minPop: 1000, cond: (g) => ['food_factory', 'sawmill', 'steelworks', 'refinery', 'warehouse'].some((k) => g.hasBuilt(k)),
    text: 'Ein Lieferant im Ausland fällt aus. Den Läden gehen die Waren aus, die Fabriken könnten einspringen.',
    options: [
      { label: 'Heimische Produktion ankurbeln', hint: () => 'Industrie-Nachfrage +25, Gewerbe −10 für 7 Tage', apply: (g) => { g.addEffect('indDemand', 25, 7, 'Lieferengpass'); g.addEffect('comDemand', -10, 7, 'Lieferengpass'); } },
      { label: 'Teuer importieren', hint: (g) => `−${fmtMoney(sc(g, 3500))}`, apply: (g) => money(g, -sc(g, 3500)) },
    ],
  },
  {
    id: 'exportdeal', title: 'Großauftrag aus Übersee', minPop: 1500, cond: (g) => g.hasBuilt('cargo_rail') || g.hasBuilt('cargo_harbor'),
    text: 'Ein Konzern aus Übersee will für ein Jahr alles kaufen, was deine Fabriken liefern können. Das heißt aber: Lkw rund um die Uhr.',
    options: [
      { label: 'Annehmen', hint: (g) => `+${fmtMoney(sc(g, 15000))}, Glück −2 für 7 Tage (Lärm)`, apply: (g) => { money(g, sc(g, 15000)); g.addEffect('happy', -2, 7, 'Lkw-Lärm'); g.addEffect('indDemand', 20, 7, 'Großauftrag'); } },
      { label: 'Ablehnen', hint: () => 'Nichts passiert', apply: () => {} },
    ],
  },
  {
    id: 'drill', title: 'Katastrophenschutzübung', minPop: 800, cond: (g) => g.hasBuilt('disaster_center') || g.hasBuilt('warning_siren') || !!g.ext.disasters?.active,
    text: 'Der Katastrophenschutz möchte eine große Übung mit Sirenen, Evakuierung und Schlauchboot-Rallye abhalten.',
    options: [
      { label: 'Groß üben', hint: (g) => `−${fmtMoney(sc(g, 2500))}, Glück +1, Brandrisiko dauerhaft −3 %`, apply: (g) => { money(g, -sc(g, 2500)); g.addEffect('happy', 1, 4, 'Gut vorbereitet'); g.mods.fire *= 0.97; } },
      { label: 'Nur auf dem Papier', hint: () => 'Nichts passiert', apply: () => {} },
    ],
  },
  {
    id: 'newyear', title: 'Silvester', minPop: 300, cond: (g) => g.day() % 364 >= 357 && once(g, 'newyear' + Math.floor(g.day() / 364)),
    text: 'Das Jahr geht zu Ende. Die Stadt fragt sich: klassisches Feuerwerk oder Lichtershow vom Rathausdach?',
    options: [
      { label: 'Großes Feuerwerk', hint: (g) => `−${fmtMoney(sc(g, 3000))}, Glück +5 für 2 Tage`, apply: (g) => { markOnce(g, 'newyear' + Math.floor(g.day() / 364)); money(g, -sc(g, 3000)); g.addEffect('happy', 5, 2, 'Silvester'); } },
      { label: 'Leise Lichtershow', hint: (g) => `−${fmtMoney(sc(g, 4000))}, Glück +4 für 2 Tage, Haustiere danken`, apply: (g) => { markOnce(g, 'newyear' + Math.floor(g.day() / 364)); money(g, -sc(g, 4000)); g.addEffect('happy', 4, 2, 'Lichtershow'); } },
    ],
  },
  {
    id: 'election', title: 'Kommunalwahl', minPop: 600, cond: (g) => g.day() >= 50 && once(g, 'election' + Math.floor(g.day() / 120)),
    text: 'In einer Woche wird gewählt. Deine Beraterin fragt: teurer Wahlkampf oder Vertrauen auf die eigene Bilanz?',
    options: [
      { label: 'Großer Wahlkampf', hint: (g) => `−${fmtMoney(sc(g, 5000))}, gewinnt ab 50 % Glück`, apply: (g) => { markOnce(g, 'election' + Math.floor(g.day() / 120)); money(g, -sc(g, 5000)); later(g, 7, 'electionResult', { need: 50 }); } },
      { label: 'Die Bilanz spricht für sich', hint: () => 'Kostenlos, gewinnt ab 62 % Glück', apply: (g) => { markOnce(g, 'election' + Math.floor(g.day() / 120)); later(g, 7, 'electionResult', { need: 62 }); } },
    ],
  },
  {
    id: 'donation', title: 'Anonyme Spende', minPop: 600,
    text: 'Im Briefkasten des Rathauses lag ein Umschlag voller Geldscheine und ein Zettel: „Für etwas Gutes."',
    options: [
      { label: 'Für die Schulen', hint: (g) => `+${fmtMoney(sc(g, 3000))}, Bildung wächst dauerhaft 3 % schneller`, apply: (g) => { money(g, sc(g, 3000)); g.mods.edu *= 1.03; } },
      { label: 'Für ein Stadtfest', hint: () => 'Glück +4 für 4 Tage', apply: (g) => g.addEffect('happy', 4, 4, 'Spendenfest') },
      { label: 'In die Kasse', hint: (g) => `+${fmtMoney(sc(g, 4000))}`, apply: (g) => money(g, sc(g, 4000)) },
    ],
  },
  {
    id: 'citizenbond', title: 'Bürgeranleihe', minPop: 1500, cond: (g) => g.money < 20000,
    text: 'Die Sparkasse schlägt eine Bürgeranleihe vor: Bürger leihen der Stadt Geld und bekommen es in drei Wochen mit Zinsen zurück.',
    options: [
      { label: 'Anleihe ausgeben', hint: (g) => `+${fmtMoney(sc(g, 20000))} jetzt, in 21 Tagen ${fmtMoney(Math.round(sc(g, 20000) * 1.08))} zurück`, apply: (g) => { const a = sc(g, 20000); money(g, a); later(g, 21, 'bondRepay', { amount: Math.round(a * 1.08) }); } },
      { label: 'Lieber nicht', hint: () => 'Nichts passiert', apply: () => {} },
    ],
  },
  {
    id: 'heatwave2', title: 'Eiswagen-Krieg', minPop: 500, cond: (g) => season(g) === 'summer' || season(g) === undefined,
    text: 'Zwei Eiswagen streiten sich um den besten Platz im Stadtpark. Es gab bereits Streusel-Würfe.',
    options: [
      { label: 'Feste Stellplätze vergeben', hint: () => 'Gewerbenachfrage +10 für 5 Tage', apply: (g) => g.addEffect('comDemand', 10, 5, 'Eis für alle') },
      { label: 'Eis-Wettbewerb ausrichten', hint: () => '−500 €, Glück +3 für 3 Tage', apply: (g) => { money(g, -500); g.addEffect('happy', 3, 3, 'Eis-Wettbewerb'); } },
    ],
  },
  {
    id: 'pigeon', title: 'Taubenplage am Bahnhof', minPop: 900, cond: (g) => lines(g) >= 1 || g.hasBuilt('train_station'),
    text: 'Tausende Tauben haben die Pulsbahn-Stationen für sich entdeckt. Die Fahrgäste klagen über Hinterlassenschaften.',
    options: [
      { label: 'Taubenschläge bauen', hint: () => '−1.800 €, Glück +1', apply: (g) => { money(g, -1800); g.addEffect('happy', 1, 5, 'Saubere Stationen'); } },
      { label: 'Ignorieren', hint: () => 'Pulsbahn −10 % für 5 Tage', apply: (g) => g.addEffect('ridership', -0.1, 5, 'Taubenplage') },
    ],
  },
];

// Optionen mit eigener Bedingung (z. B. nur mit Freibad) werden bei Bedarf entfernt – die Oberfläche
// zeigt immer alle Optionen eines Ereignisses, darum wird hier vorab gefiltert.
for (const ev of NEW_EVENTS) {
  const opts = ev.options;
  if (!opts.some((o) => o.cond)) continue;
  const base = ev.cond;
  const all = opts.slice();
  // Getter: liefert je nach Spielstand nur die erlaubten Optionen
  let lastG = null;
  ev.cond = (g) => { lastG = g; return !base || base(g); };
  Object.defineProperty(ev, 'options', { get: () => all.filter((o) => !o.cond || (lastG && o.cond(lastG))), enumerable: true, configurable: true });
}

for (const ev of NEW_EVENTS) if (!EVENTS.find((e) => e.id === ev.id)) EVENTS.push(ev);
export const S5_EVENT_IDS = NEW_EVENTS.map((e) => e.id);
void BUILDINGS;
