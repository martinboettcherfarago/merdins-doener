// Inhalte Wetter & Katastrophenschutz. Besitzer: System-Agent „Wetter & Katastrophen" (S4).
// Schlüssel und Grundflächen sind ein Vertrag mit den Architektur-Agenten – nicht umbenennen.
// Zusätzlich: zwei neue Abdeckungsarten (Katastrophenschutz, Winterdienst), jahreszeitliche Ereignisse
// mit Entscheidung und Stadtfunk-Meldungen zum Wetter.
import { BUILDINGS } from '../config.js';
import { registerServiceType } from '../registry.js';
import { EVENTS, CHATTER } from '../sim/progress.js';
import { fmtMoney } from '../util.js';

// g.cov.disaster: Reichweite des Katastrophenschutzes (Rettung, Aufräumen, Reparatur)
// g.cov.snow: vom Winterdienst geräumte Straßen
registerServiceType('disaster');
registerServiceType('snow');

Object.assign(BUILDINGS, {
  disaster_center: { name: 'Katastrophenschutz', cat: 'safety', size: [2, 2], cost: 16000, upkeep: 110, unlock: 3, response: 1, power_use: 10, service: { type: 'disaster', radius: 22, capacity: 40000 }, desc: 'Rettet und repariert nach Katastrophen ×3 schneller.' },
  shelter: { name: 'Notunterkunft', cat: 'safety', size: [2, 1], cost: 6000, upkeep: 30, unlock: 3, shelterCap: 800, power_use: 4, water_use: 4, desc: 'Schützt 800 Menschen bei Sturm und Flut.' },
  warning_siren: { name: 'Warnsirene', cat: 'safety', size: [1, 1], cost: 900, upkeep: 4, unlock: 2, warnRadius: 12, desc: 'Warnt im Umkreis vor Unwettern.' },
  weather_station: { name: 'Wetterstation', cat: 'safety', size: [1, 1], cost: 2500, upkeep: 12, unlock: 2, forecast: 1, desc: 'Wetter 5 Tage im Voraus (zwei Stationen: 7).' },
  snow_depot: { name: 'Winterdienst', cat: 'safety', size: [1, 1], cost: 3000, upkeep: 26, unlock: 2, snowPlows: 6, service: { type: 'snow', radius: 18, capacity: 30000 }, desc: 'Hält im Winter die Straßen frei.' },
  flood_barrier: { name: 'Hochwasserschutz', cat: 'safety', size: [1, 1], cost: 2000, upkeep: 6, unlock: 2, needsWater: true, floodProtect: 6, desc: 'Deich: schützt das Ufer vor Hochwasser.' },
});

// ---------- Helfer für Bedingungen
const W = (g) => (g.ext && g.ext.weather) || {};
const season = (g) => W(g).season;
const has = (g, key) => g.hasBuilt(key);

// ---------- Jahreszeitliche Ereignisse (Anzeiger) – erscheinen nur zur passenden Jahreszeit
EVENTS.push(
  {
    id: 'wx_xmas', title: 'Weihnachtsmarkt', minPop: 400, cond: (g) => season(g) === 'winter' && W(g).seasonDay <= 12,
    text: 'Der Gewerbeverein möchte einen Weihnachtsmarkt mit Glühwein, Lichterketten und Eisbahn auf dem Marktplatz.',
    options: [
      { label: 'Unterstützen', hint: () => '−3.000 €, Glück +5, Gewerbenachfrage +20 und Touristen +100 für 8 Tage', apply: (g) => { g.money -= 3000; g.addEffect('happy', 5, 8, 'Weihnachtsmarkt'); g.addEffect('comDemand', 20, 8, 'Weihnachtsmarkt'); g.addEffect('tourismAdd', 100, 8, 'Weihnachtsmarkt'); } },
      { label: 'Keine Zeit', hint: () => 'Glück −2 für 4 Tage', apply: (g) => g.addEffect('happy', -2, 4, 'Kein Weihnachtsmarkt') },
    ],
  },
  {
    id: 'wx_salt', title: 'Streusalz wird knapp', minPop: 300, cond: (g) => season(g) === 'winter' && W(g).snowCover > 0.3 && has(g, 'snow_depot'),
    text: 'Der Winterdienst meldet: Die Salzvorräte reichen nur noch zwei Tage. Nachkaufen ist teuer – Splitt ist billig, aber rutschig.',
    options: [
      { label: 'Salz nachkaufen', hint: () => '−4.000 €', apply: (g) => { g.money -= 4000; } },
      { label: 'Splitt streuen', hint: () => 'Glück −3 für 4 Tage (glatte Gehwege)', apply: (g) => g.addEffect('happy', -3, 4, 'Glatte Gehwege') },
    ],
  },
  {
    id: 'wx_pool', title: 'Rekordhitze', minPop: 300, cond: (g) => season(g) === 'summer' && W(g).temp > 27 && has(g, 'swimming_pool'),
    text: 'Seit Tagen über 30 Grad. Familien bitten darum, das Freibad bis Mitternacht zu öffnen.',
    options: [
      { label: 'Länger öffnen', hint: () => '−1.500 €, Glück +4 für 5 Tage', apply: (g) => { g.money -= 1500; g.addEffect('happy', 4, 5, 'Mitternachtsschwimmen'); } },
      { label: 'Normale Zeiten', hint: () => 'Glück −2 für 3 Tage', apply: (g) => g.addEffect('happy', -2, 3, 'Freibad zu früh zu') },
    ],
  },
  {
    id: 'wx_dike', title: 'Ingenieure warnen vor Hochwasser', minPop: 800, cond: (g) => (season(g) === 'spring' || season(g) === 'autumn') && g.world.type !== 'mountains' && !has(g, 'flood_barrier') && !(g.ext.disasters && g.ext.disasters.freq === 'off'),
    text: 'Gutachter halten die Ufer für zu niedrig. Ein Sofortprogramm würde die Deiche für einen Monat verstärken.',
    options: [
      { label: 'Deiche verstärken', hint: () => '−8.000 €, Hochwasser 30 Tage lang deutlich schwächer', apply: (g) => { g.money -= 8000; g.addEffect('floodShield', 1, 30, 'Verstärkte Deiche'); } },
      { label: 'Ablehnen', hint: () => 'Nichts passiert – vorerst.', apply: () => {} },
    ],
  },
  {
    id: 'wx_spring', title: 'Frühjahrsputz', minPop: 200, cond: (g) => season(g) === 'spring',
    text: 'Hunderte Freiwillige wollen am Wochenende Parks und Ufer säubern. Die Stadt soll Säcke und Imbiss stellen.',
    options: [
      { label: 'Mitmachen', hint: () => '−1.200 €, Glück +3 für 6 Tage', apply: (g) => { g.money -= 1200; g.addEffect('happy', 3, 6, 'Frühjahrsputz'); } },
      { label: 'Lieber nicht', hint: () => 'Nichts passiert.', apply: () => {} },
    ],
  },
  {
    id: 'wx_drought', title: 'Dürre', minPop: 300, cond: (g) => season(g) === 'summer' && W(g).dry > 0.6,
    text: 'Wochenlang kein Regen. Die Wasserwerke bitten, Rasensprenger und Autowäsche zu verbieten.',
    options: [
      { label: 'Wasser sparen', hint: () => 'Wasserverbrauch −20 %, Glück −3 für 5 Tage', apply: (g) => { g.addEffect('waterUse', -0.2, 5, 'Sprengverbot'); g.addEffect('happy', -3, 5, 'Sprengverbot'); } },
      { label: 'Laufen lassen', hint: () => 'Wasserverbrauch +20 % für 5 Tage', apply: (g) => g.addEffect('waterUse', 0.2, 5, 'Dürre') },
    ],
  },
  {
    id: 'wx_harvest', title: 'Erntedankfest', minPop: 300, cond: (g) => season(g) === 'autumn' && [...g.buildings.values()].some((b) => b.spec === 'farm'),
    text: 'Die Bauernhöfe laden zum Erntedankfest mit Hofmarkt, Traktorparade und Kürbissuppe ein.',
    options: [
      { label: 'Fest ausrichten', hint: () => '−2.000 €, Glück +4, Touristen +60, Industrienachfrage +10 für 6 Tage', apply: (g) => { g.money -= 2000; g.addEffect('happy', 4, 6, 'Erntedank'); g.addEffect('tourismAdd', 60, 6, 'Erntedank'); g.addEffect('indDemand', 10, 6, 'Erntedank'); } },
      { label: 'Absagen', hint: () => 'Nichts passiert.', apply: () => {} },
    ],
  },
  {
    id: 'wx_ac', title: 'Klimaanlagen-Boom', minPop: 1500, cond: (g) => season(g) === 'summer' && W(g).coolNeed > 0.3,
    text: 'Die Baumärkte sind leergekauft, überall brummen Klimageräte. Ein Förderprogramm für Dämmung und Begrünung würde helfen.',
    options: [
      { label: 'Fördern', hint: () => '−6.000 €, Hitze-Unmut halbiert für 25 Tage', apply: (g) => { g.money -= 6000; g.addEffect('heatShield', 1, 25, 'Dämmung & Dachgärten'); } },
      { label: 'Nicht eingreifen', hint: () => 'Strombilanz −8 % für 5 Tage', apply: (g) => g.addEffect('powerMul', -0.08, 5, 'Klimaanlagen-Boom') },
    ],
  },
  {
    id: 'wx_snowday', title: 'Schneechaos', minPop: 400, cond: (g) => season(g) === 'winter' && W(g).snowCover > 0.5 && !has(g, 'snow_depot'),
    text: 'Busse stecken fest, Schulwege sind zugeschneit. Eltern fordern schulfrei – Firmen wollen, dass alles weiterläuft.',
    options: [
      { label: 'Schulfrei geben', hint: () => 'Glück +2, Steuereinnahmen −10 % für 2 Tage', apply: (g) => { g.addEffect('happy', 2, 2, 'Schneefrei'); g.addEffect('taxMul', -0.1, 2, 'Schneechaos'); } },
      { label: 'Weitermachen', hint: () => 'Glück −3 für 3 Tage', apply: (g) => g.addEffect('happy', -3, 3, 'Schneechaos') },
    ],
  },
  {
    id: 'wx_insurance', title: 'Elementarversicherung', minPop: 1200, cond: (g) => !!(g.ext.disasters && g.ext.disasters.history && g.ext.disasters.history.length) && g.eff('insurance') <= 0,
    text: 'Nach dem letzten Unglück bietet ein Versicherer eine Police gegen Elementarschäden an.',
    options: [
      { label: 'Abschließen', hint: (g) => `−${fmtMoney(3000 + g.stats.pop * 1.5)}, Wiederaufbau 60 Tage lang 40 % günstiger`, apply: (g) => { g.money -= 3000 + g.stats.pop * 1.5; g.addEffect('insurance', 0.4, 60, 'Elementarversicherung'); } },
      { label: 'Ablehnen', hint: () => 'Nichts passiert.', apply: () => {} },
    ],
  },
  {
    id: 'wx_sledge', title: 'Rodelberg', minPop: 250, cond: (g) => season(g) === 'winter' && W(g).snowCover > 0.4,
    text: 'Kinder wünschen sich einen gesicherten Rodelhang mit Flutlicht am Stadtrand.',
    options: [
      { label: 'Einrichten', hint: () => '−900 €, Glück +3 für 5 Tage', apply: (g) => { g.money -= 900; g.addEffect('happy', 3, 5, 'Rodelberg'); } },
      { label: 'Kein Geld', hint: () => 'Nichts passiert.', apply: () => {} },
    ],
  },
  {
    id: 'wx_openair', title: 'Sommerkino', minPop: 600, cond: (g) => season(g) === 'summer' && W(g).dry > 0.2,
    text: 'Ein Verein möchte im Park ein Open-Air-Kino mit Liegestühlen veranstalten.',
    options: [
      { label: 'Zuschießen', hint: () => '−1.800 €, Glück +3 und Touristen +50 für 6 Tage', apply: (g) => { g.money -= 1800; g.addEffect('happy', 3, 6, 'Sommerkino'); g.addEffect('tourismAdd', 50, 6, 'Sommerkino'); } },
      { label: 'Ablehnen', hint: () => 'Nichts passiert.', apply: () => {} },
    ],
  },
);

// Bestehende Ereignisse passen jetzt zum Wetter: Hitzewelle nur im Sommer, Sturmwarnung im Herbst und Winter.
for (const ev of EVENTS) {
  const prev = ev.cond;
  if (ev.id === 'heat') ev.cond = (g) => (!prev || prev(g)) && (!g.ext.weather || (season(g) === 'summer' && W(g).temp > 24));
  if (ev.id === 'storm') ev.cond = (g) => (!prev || prev(g)) && (!g.ext.weather || season(g) === 'autumn' || season(g) === 'winter');
}

// ---------- Stadtfunk zum Wetter (vor dem allgemeinen Rückfall-Eintrag einfügen, der muss der letzte bleiben)
CHATTER.splice(Math.max(0, CHATTER.length - 1), 0,
  { when: (g) => W(g).rain > 0.3, texts: ['Regen, Regen, Regen. Mein Schirm hat schon aufgegeben.', 'Bei dem Wetter nehme ich lieber die Pulsbahn.', 'Die Pfützen an der Kreuzung sind tief genug zum Schwimmen.', 'Endlich Regen – mein Garten dankt.', 'Kinder in Gummistiefeln, Hunde mit nassem Fell. Herbststimmung.'] },
  { when: (g) => W(g).snow > 0.2, texts: ['Es schneit! Die Kinder sind nicht mehr zu halten.', 'Schnee auf den Dächern, warm in der U-Bahn – wie im Bilderbuch.', 'Wer hat den Schneemann vor dem Rathaus gebaut? Großartig.', 'Schnee bis zu den Knöcheln. Ich hole den Schlitten raus.'] },
  { when: (g) => W(g).snowCover > 0.4 && !g.hasBuilt('snow_depot'), texts: ['Die Straßen sind spiegelglatt! Wo bleibt der Winterdienst?', 'Drei Autos im Graben an einem Morgen. Wir brauchen Räumfahrzeuge!', 'Mit dem Auto komme ich nicht mehr aus der Einfahrt.'] },
  { when: (g) => W(g).snowCover > 0.3 && g.hasBuilt('snow_depot'), texts: ['Um fünf Uhr kam schon der Räumdienst. Danke!', 'Die Straßen sind frei, die Gehwege gestreut. Vorbildlich.'] },
  { when: (g) => W(g).temp > 30, texts: ['Über 30 Grad! Ich wohne jetzt im Freibad.', 'Mein Ventilator läuft auf Stufe drei und schwitzt mit mir.', 'Eis zum Frühstück? Bei der Hitze absolut vertretbar.', 'Asphalt so heiß, dass man Spiegeleier braten könnte.', 'Bitte mehr Bäume an den Straßen. Schatten ist Gold wert.'] },
  { when: (g) => W(g).temp < -5, texts: ['Minus fünf Grad. Mein Auto springt nicht an.', 'Eiskristalle am Fenster – schön, aber kalt.', 'Die Heizung bollert, die Stromrechnung auch.', 'Der Teich im Park ist zugefroren. Schlittschuhe raus!'] },
  { when: (g) => W(g).fog > 0.5, texts: ['So dicker Nebel, dass ich mein eigenes Haus nicht finde.', 'Nebel über der Stadt – zum Glück fährt die U-Bahn unter der Erde.', 'Gespenstisch schön heute Morgen.'] },
  { when: (g) => W(g).storm, texts: ['Es donnert und blitzt! Der Hund liegt unter dem Bett.', 'Was für ein Gewitter! Die ganze Stadt war kurz taghell.', 'Sturm! Mein Gartenstuhl ist jetzt beim Nachbarn.', 'Bei dem Wind fliegen die Mülltonnen durch die Straße.'] },
  { when: (g) => season(g) === 'spring' && W(g).temp > 14 && W(g).rain < 0.05, texts: ['Die Kirschbäume blühen! Endlich Frühling.', 'Erste Eisdiele hat geöffnet. Saison eröffnet!', 'Vogelgezwitscher um fünf Uhr morgens. Schön – und früh.', 'Frühlingsputz auf dem Balkon. Die Tomaten kommen bald.'] },
  { when: (g) => season(g) === 'summer' && W(g).temp > 22 && W(g).rain < 0.05, texts: ['Sommer in der Stadt: Grillgeruch über allen Höfen.', 'Biergarten bis Mitternacht. So soll es sein.', 'Die Touristen fotografieren unsere gekachelten U-Bahnhöfe. Wir sind berühmt!', 'Barfuß im Park – bester Feierabend.'] },
  { when: (g) => season(g) === 'autumn', texts: ['Bunte Blätter überall. Der Herbst ist hier wunderschön.', 'Kürbissuppe, Wollpullover, Kastanien sammeln.', 'Die Laubbläser sind wieder unterwegs. Laut, aber nötig.', 'Drachen steigen lassen auf der Wiese am Fluss!'] },
  { when: (g) => season(g) === 'winter' && W(g).seasonDay >= 4 && W(g).seasonDay <= 16, texts: ['Glühwein auf dem Weihnachtsmarkt – mein Abendprogramm steht.', 'Lichterketten in jedem Fenster. Die Stadt glitzert.', 'Plätzchenduft im ganzen Treppenhaus.'] },
  { when: (g) => W(g).dry > 0.65, texts: ['Der Rasen ist braun, der Fluss ist niedrig. Wann regnet es endlich?', 'Bitte keine Grillfeuer im Wald – es ist staubtrocken!'] },
  { when: (g) => g.ext.disasters && g.ext.disasters.fear > 0.3, texts: ['Seit dem Unglück schlafe ich schlecht. Hoffentlich ist die Stadt jetzt besser vorbereitet.', 'Wir brauchen mehr Sirenen und eine Notunterkunft!', 'Die Helfer vom Katastrophenschutz sind echte Heldinnen und Helden.'] },
  { when: (g) => g.ext.disasters && g.ext.disasters.displaced > 30, texts: ['Wir wohnen seit Tagen in der Turnhalle. Wann dürfen wir zurück?', 'Danke an alle, die Decken und Suppe gespendet haben!'] },
  { when: (g) => g.ext.disasters && g.ext.disasters.rubbleCount > 6, texts: ['Überall noch Trümmer. Wann wird endlich aufgeräumt?', 'Die Bagger arbeiten Tag und Nacht. Es geht voran.'] },
  { when: (g) => g.hasBuilt('weather_station'), texts: ['Die Wetterstation hat recht behalten – gut, dass ich den Schirm dabeihatte.', 'Laut Wetterstation wird es morgen schön. Ich plane schon das Picknick.'] },
);
