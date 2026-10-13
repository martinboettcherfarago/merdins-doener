// Begleiter und Ratgeberin „Frieda Puls, Stadtplanerin": wertet die Stadt laufend aus und liefert
//   · advisor.goal  – genau EIN nächstes Ziel bzw. den wichtigsten Tipp (für den Begleiter in onboarding.js)
//   · advisor.list  – die wichtigsten Hinweise, sortiert (für das Ratgeber-Fenster)
// Jede Regel: { id, rank, when(g, c) → null | { text, why?, act?, label?, help? } }
//   rank: 100 brennt/pleite · 85–90 Grundversorgung fehlt · 70–80 dringend · 50–65 wichtig · 20–40 Tipp · 10 Meilenstein
//   act:  { view, cat, panel, where: {x,y}, tool } – wird über ui.runAction ausgeführt
//   help: Thema der Hilfe „So funktioniert's" (Knopf „Warum?")
// Erweiterbar:
//   ADVISOR_RULES.push({ id, rank, when })
//   emit('advice', { id, text, prio, act, label, minutes })  – einmaliger Hinweis (Standard 12 Spielstunden gültig)
import { R, Z, MILESTONES, BUILDINGS } from '../config.js';
import { on } from '../registry.js';
import { fmt } from '../util.js';
import { icon } from './icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (v) => `${Math.round(v * 100)} %`;
const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : many}`;

// Einmal je Auswertung: Straßen- und Zonenflächen zählen (ohne Autobahn)
export function cityCounts(g) {
  const c = { roads: 0, zone: [0, 0, 0, 0, 0] };
  for (let i = 0; i < g.N; i++) {
    const r = g.road[i];
    if (r && r !== R.HIGHWAY) c.roads++;
    const z = g.zone[i];
    if (z) c.zone[z]++;
  }
  return c;
}
const has = (g, ...keys) => keys.some((k) => g.hasBuilt(k));
const hasWater = (g) => has(g, 'watertower', 'pump', 'waterworks');
const placeTool = (g, key, cat) => (g.isUnlocked(key) ? { cat, tool: { kind: 'place', key } } : { cat });
const zoneTool = (z) => ({ cat: 'zones', tool: { kind: 'zone', zone: z } });
// Zone mit der größten Nachfrage (für „wachse weiter")
function bestZone(g) {
  let best = Z.RES, v = -1e9;
  for (const z of [Z.RES, Z.COM, Z.IND, Z.OFF]) {
    if (z === Z.OFF && !g.isUnlocked('zone4')) continue;
    const d = (g.demand[z] || 0) + (z === Z.RES ? 6 : 0);
    if (d > v) { v = d; best = z; }
  }
  return best;
}
const ZONE_WORD = { 1: ['Wohngebiet', 'Wohnen'], 2: ['Gewerbe', 'Gewerbe'], 3: ['Industrie', 'Industrie'], 4: ['Büros', 'Büro'] };
const sewer = (g) => g.ext && g.ext.citizens;

export const ADVISOR_RULES = [
  // ---------------------------------------------------------------- akut
  { id: 'burning', rank: 100, when: (g) => (g.stats.burning > 0 ? (g.isUnlocked('fire')
    ? { text: g.hasBuilt('fire') || g.hasBuilt('firehq') ? 'Es brennt! Die Feuerwehr ist unterwegs. Eine zweite Feuerwache in der Nähe löscht schneller.' : 'Es brennt! Baue schnell eine Feuerwache in der Nähe.', act: { view: 'fire', ...placeTool(g, 'fire', 'services') }, label: 'Feuerwache', help: 'services' }
    : { text: 'Es brennt! Eine Feuerwehr gibt es ab „Dorf". Bis dahin hilft nur Abriss rund um den Brand.', act: { view: 'fire' }, label: 'Zeigen', help: 'services' }) : null) },
  { id: 'broke', rank: 96, when: (g) => (!g.sandbox && g.money < 0 ? { text: 'Die Stadtkasse ist leer. Hebe die Steuern ein wenig an oder spare bei teuren Diensten.', why: 'Bleibt die Kasse lange im Minus, droht die Pleite.', act: { panel: 'budget' }, label: 'Haushalt öffnen', help: 'money' } : null) },
  // ---------------------------------------------------------------- Grundversorgung (die ersten Minuten)
  { id: 'start-road', rank: 90, when: (g, c) => (c.roads === 0 ? { text: 'Baue eine Straße vom Ende der Autobahn ins Land.', why: 'Alles in der Stadt braucht einen Straßenanschluss.', act: { cat: 'roads', tool: { kind: 'road', type: R.STREET } }, label: 'Straße bauen', help: 'roads' } : null) },
  { id: 'start-zone', rank: 89, when: (g, c) => (c.roads > 0 && c.zone[Z.RES] === 0 ? { text: 'Weise neben der Straße Wohngebiet aus.', why: 'Dort bauen Familien ihre Häuser.', act: zoneTool(Z.RES), label: 'Wohngebiet', help: 'zones' } : null) },
  { id: 'power-none', rank: 88, when: (g, c) => (c.zone[Z.RES] > 0 && g.countBuilt('power') === 0 ? { text: 'Baue ein Kraftwerk an eine Straße.', why: 'Ohne Strom zieht niemand ein. Der Strom fließt über die Straßen.', act: { cat: 'power' }, label: 'Kraftwerk wählen', help: 'power' } : null) },
  { id: 'water-none', rank: 87, when: (g, c) => (c.zone[Z.RES] > 0 && !hasWater(g) ? { text: 'Baue einen Wasserturm an eine Straße.', why: 'Ohne Wasser zieht niemand ein. Auch Wasser fließt über die Straßen.', act: placeTool(g, 'watertower', 'water'), label: 'Wasserturm bauen', help: 'water' } : null) },
  // ---------------------------------------------------------------- dringend
  { id: 'unpowered', rank: 80, when: (g) => (g.stats.unpowered > 6 && g.countBuilt('power') > 0 ? { text: `${plural(g.stats.unpowered, 'Gebäude hat', 'Gebäude haben')} keinen Strom.`, why: 'Baue ein weiteres Kraftwerk oder verbinde die Häuser per Straße mit dem Netz.', act: { view: 'power', cat: 'power' }, label: 'Stromnetz zeigen', help: 'power' } : null) },
  { id: 'unwatered', rank: 79, when: (g) => (g.stats.unwatered > 6 && hasWater(g) ? { text: `${plural(g.stats.unwatered, 'Gebäude hat', 'Gebäude haben')} kein Wasser.`, why: 'Baue mehr Wasser oder verbinde die Häuser per Straße. Pumpwerke brauchen Strom.', act: { view: 'water', cat: 'water' }, label: 'Wassernetz zeigen', help: 'water' } : null) },
  { id: 'noroad', rank: 76, when: (g) => (g.stats.noRoad > 2 ? { text: `${plural(g.stats.noRoad, 'Gebäude ist', 'Gebäude sind')} nicht mit der Autobahn verbunden.`, why: 'Ohne Verbindung kommen keine Leute, Waren und kein Strom hin.', act: { cat: 'roads', tool: { kind: 'road', type: R.STREET } }, label: 'Straße bauen', help: 'roads' } : null) },
  { id: 'powercap', rank: 72, when: (g) => { const u = g.util; return u.powerSupply > 0 && u.powerDemand > u.powerSupply * 0.9 ? { text: `Der Strom wird knapp (${pct(u.powerDemand / u.powerSupply)} genutzt).`, why: 'Baue rechtzeitig ein weiteres Kraftwerk, sonst gehen bald Lichter aus.', act: { cat: 'power' }, label: 'Kraftwerk bauen', help: 'power' } : null; } },
  { id: 'watercap', rank: 71, when: (g) => { const u = g.util; return u.waterSupply > 0 && u.waterDemand > u.waterSupply * 0.9 ? { text: `Das Wasser wird knapp (${pct(u.waterDemand / u.waterSupply)} genutzt).`, why: 'Baue einen weiteren Wasserturm oder ein Pumpwerk am Ufer.', act: { cat: 'water' }, label: 'Wasser bauen', help: 'water' } : null; } },
  { id: 'garbage', rank: 70, when: (g) => (g.stats.garbageProb > 2 ? { text: `An ${plural(g.stats.garbageProb, 'Gebäude', 'Gebäuden')} stapelt sich Müll.`, why: 'Eine Deponie in der Nähe schickt Müllwagen los.', act: { view: 'garbage', ...placeTool(g, 'landfill', 'garbage') }, label: 'Deponie bauen', help: 'garbage' } : null) },
  { id: 'sewage', rank: 68, when: (g) => { const C = sewer(g); return C && C.sewReq && (C.unsewered || 0) > 3 ? { text: (C.sewageCap || 0) > 0 ? `${plural(C.unsewered, 'Gebäude hat', 'Gebäude haben')} keinen Abwasseranschluss.` : 'Größere Häuser brauchen jetzt Abwasser.', why: 'Baue einen Abwasserauslass am Ufer – weit weg vom Pumpwerk – oder später eine Kläranlage.', act: placeTool(g, 'sewage_outlet', 'water'), label: 'Abwasser bauen', help: 'water' } : null; } },
  // ---------------------------------------------------------------- nächste Schritte
  { id: 'jobs', rank: 64, when: (g, c) => (c.zone[Z.RES] > 0 && c.zone[Z.COM] + c.zone[Z.IND] === 0 && g.stats.pop > 0 ? { text: 'Weise Gewerbe und Industrie aus.', why: 'Deine Bürger brauchen Arbeit und Läden. Industrie mit etwas Abstand zu Wohnhäusern – sie macht Abgase.', act: zoneTool(Z.COM), label: 'Gewerbe', help: 'zones' } : null) },
  { id: 'garbage-none', rank: 62, when: (g) => (g.stats.pop > 40 && g.countBuilt('garbage') === 0 ? { text: 'Baue eine Deponie, bevor sich der Müll stapelt.', why: 'Wo Menschen wohnen, fällt Müll an. Müllwagen holen ihn ab.', act: placeTool(g, 'landfill', 'garbage'), label: 'Deponie bauen', help: 'garbage' } : null) },
  { id: 'budget', rank: 60, when: (g) => (!g.sandbox && g.money >= 0 && g.lastBudget && g.lastBudget.net < 0 && g.money < Math.max(8000, -g.lastBudget.net * 10) ? { text: `Die Stadt gibt ${fmt(Math.round(-g.lastBudget.net))} € pro Tag mehr aus, als sie einnimmt.`, why: 'Hebe die Steuern ein wenig an oder spare bei teuren Diensten.', act: { panel: 'budget' }, label: 'Haushalt öffnen', help: 'money' } : null) },
  { id: 'unemp', rank: 58, when: (g) => (g.stats.pop > 120 && g.stats.unemployment > 0.14 ? { text: `${pct(g.stats.unemployment)} der Menschen haben keine Arbeit.`, why: 'Gewerbe und Industrie schaffen Jobs.', act: zoneTool(g.demand[Z.IND] > g.demand[Z.COM] ? Z.IND : Z.COM), label: 'Jobs schaffen', help: 'demand' } : null) },
  { id: 'workers', rank: 56, when: (g) => (g.stats.jobs > 80 && g.stats.jobFill < 0.7 ? { text: 'Die Betriebe finden keine Arbeitskräfte.', why: 'Mehr Wohngebiet in der Nähe bringt neue Leute.', act: zoneTool(Z.RES), label: 'Wohngebiet', help: 'demand' } : null) },
  { id: 'pollution', rank: 57, when: (g) => (g.stats.pop > 30 && g.stats.pollutionAvg > 0.2 && g.stats.happiness < 60 ? { text: 'Abgase machen deine Bürger krank und unglücklich.', why: 'Industrie, Kohlekraftwerke und Deponien gehören mit Abstand weg von den Wohnhäusern. Parks dazwischen helfen.', act: { view: 'pollution' }, label: 'Abgase zeigen', help: 'happiness' } : null) },
  { id: 'happy', rank: 55, when: (g) => (g.stats.pop > 30 && g.stats.happiness < 45 ? { text: `Die Stimmung ist schlecht (${Math.round(g.stats.happiness)} %).`, why: 'Klicke ein Wohnhaus an: Dort stehen die Gründe.', act: { view: 'happiness' }, label: 'Glück zeigen', help: 'happiness' } : null) },
  { id: 'nofire', rank: 54, when: (g) => (g.stats.pop > 200 && !has(g, 'fire', 'firehq') && g.isUnlocked('fire') ? { text: 'Baue eine Feuerwache.', why: 'Ein einziger Brand kann sonst ganze Straßen kosten.', act: { view: 'fire', ...placeTool(g, 'fire', 'services') }, label: 'Feuerwache', help: 'services' } : null) },
  { id: 'noschool', rank: 53, when: (g) => (g.stats.pop > 250 && !g.hasBuilt('school') && g.isUnlocked('school') ? { text: 'Baue eine Schule.', why: 'Gebildete Bürger bauen größere Häuser und zahlen mehr Steuern.', act: { view: 'edu', ...placeTool(g, 'school', 'education') }, label: 'Schule', help: 'services' } : null) },
  { id: 'nohealth', rank: 52, when: (g) => (g.stats.pop > 300 && !has(g, 'clinic', 'hospital') && g.isUnlocked('clinic') ? { text: 'Baue eine Arztpraxis.', why: 'Gesunde Bürger sind glücklicher und leben länger.', act: { view: 'health', ...placeTool(g, 'clinic', 'services') }, label: 'Arztpraxis', help: 'services' } : null) },
  { id: 'nopolice', rank: 51, when: (g) => (g.stats.pop > 350 && !has(g, 'police', 'policehq') && g.isUnlocked('police') ? { text: 'Baue eine Polizeiwache.', why: 'Ohne Polizei steigt die Kriminalität, und die Leute fühlen sich unsicher.', act: { view: 'police', ...placeTool(g, 'police', 'services') }, label: 'Polizei', help: 'services' } : null) },
  { id: 'crime', rank: 50, when: (g) => (g.stats.pop > 300 && g.stats.crimeAvg > 0.32 && has(g, 'police', 'policehq') ? { text: 'Die Kriminalität steigt.', why: 'Eine weitere Polizeiwache nahe den Wohnvierteln hilft.', act: { view: 'police', ...placeTool(g, 'police', 'services') }, label: 'Polizei', help: 'services' } : null) },
  { id: 'stations', rank: 50, when: (g) => { let st = null; for (const s of g.transit.stations.values()) if (s.over > 0.02 && (!st || s.over > st.over)) st = s; return st ? { text: `Der Bahnhof ${st.name} ist überfüllt.`, why: 'Setze auf der Linie mehr Züge oder Wagen ein.', act: { panel: 'transit', where: { x: st.x, y: st.y } }, label: 'Linien verwalten', help: 'ubahn' } : null; } },
  { id: 'traffic', rank: 48, when: (g) => (g.stats.pop > 300 && g.stats.trafficFlow < 0.7 ? { text: `Stau! Der Verkehr fließt nur zu ${pct(g.stats.trafficFlow)}.`, why: 'Alleen haben mehr Platz, die U-Bahn nimmt Autos von der Straße.', act: { view: 'traffic' }, label: 'Verkehr zeigen', help: 'roads' } : null) },
  { id: 'abandoned', rank: 46, when: (g) => (g.stats.abandoned > 4 ? { text: `${plural(g.stats.abandoned, 'Gebäude steht', 'Gebäude stehen')} leer.`, why: 'Meist fehlt dort Strom, Wasser, Arbeit oder die Leute sind unglücklich.', act: { view: 'happiness' }, label: 'Glück zeigen', help: 'happiness' } : null) },
  { id: 'transit', rank: 40, when: (g) => (g.isUnlocked('transit') && !g.sandbox && g.transit.lines.length === 0 && g.stats.pop > 400 ? { text: 'Die U-Bahn ist freigeschaltet: Zeichne die erste Linie.', why: 'Verbinde Wohnviertel und Arbeitsplätze. Jeder Zug spielt bei der Ankunft einen Ton.', act: { cat: 'transit', tool: { kind: 'line' } }, label: 'Linie zeichnen', help: 'ubahn' } : null) },
  // ---------------------------------------------------------------- Tipps
  { id: 'res-demand', rank: 34, when: (g) => (g.demand[Z.RES] > 55 ? { text: 'Viele Menschen wollen hierherziehen.', why: 'Weise mehr Wohngebiet aus.', act: zoneTool(Z.RES), label: 'Wohngebiet', help: 'demand' } : null) },
  { id: 'com-demand', rank: 32, when: (g) => (g.demand[Z.COM] > 55 ? { text: 'Die Leute wollen einkaufen.', why: 'Weise mehr Gewerbe aus.', act: zoneTool(Z.COM), label: 'Gewerbe', help: 'demand' } : null) },
  { id: 'ind-demand', rank: 31, when: (g) => (g.demand[Z.IND] > 55 ? { text: 'Firmen suchen Platz für Fabriken.', why: 'Weise Industrie aus – mit Abstand zu Wohnhäusern.', act: zoneTool(Z.IND), label: 'Industrie', help: 'demand' } : null) },
  { id: 'off-demand', rank: 30, when: (g) => (g.demand[Z.OFF] > 55 && g.isUnlocked('zone4') ? { text: 'Büros wollen sich ansiedeln.', why: 'Büros sind sauber und zahlen gut, brauchen aber gebildete Leute.', act: zoneTool(Z.OFF), label: 'Büros', help: 'demand' } : null) },
  { id: 'noparks', rank: 24, when: (g) => (g.stats.pop > 200 && g.countBuilt('parks') === 0 ? { text: 'Baue einen kleinen Park zwischen die Häuser.', why: 'Parks machen froh und heben den Wert der Grundstücke.', act: placeTool(g, 'park', 'parks'), label: 'Park bauen', help: 'happiness' } : null) },
  { id: 'voucher', rank: 22, when: (g) => { const k = [...g.landmarkVouchers].find((x) => !g.hasBuilt(x)); return k && BUILDINGS[k] ? { text: `Du hast einen Gutschein: ${BUILDINGS[k].name} zum halben Preis.`, why: 'Wahrzeichen machen glücklich und locken Touristen an.', act: { cat: 'landmarks' }, label: 'Wahrzeichen', help: 'cards' } : null; } },
  // ---------------------------------------------------------------- immer da: der nächste Meilenstein
  { id: 'milestone', rank: 10, when: (g) => {
    const n = MILESTONES[g.milestone + 1];
    if (!n) return { text: 'Deine Stadt hat alle Meilensteine erreicht. Bau sie, wie es dir gefällt!', act: null };
    const z = bestZone(g);
    return { text: `Wachse zum Meilenstein „${n.name}": noch ${fmt(Math.max(0, n.pop - g.stats.pop))} Einwohner bis ${fmt(n.pop)}.`, why: `Dafür gibt es ${fmt(n.reward)} € und neue Gebäude. Gerade gefragt: ${ZONE_WORD[z][0]}.`, act: zoneTool(z), label: ZONE_WORD[z][1], help: 'cards' };
  } },
];

// Hinweise, die „Erste Schritte" (alte Checkliste) schon abdeckt
const TUTORIAL_COVERED = new Set(['start-road', 'start-zone', 'power-none', 'water-none', 'jobs', 'garbage-none', 'transit', 'res-demand', 'com-demand', 'ind-demand']);

// Alte Checkliste „Erste Schritte" (ui.js zeigt sie, solange die Einführung sie nicht ersetzt)
export function tutorialSteps(g, ui) {
  const c = cityCounts(g);
  ui.cache.roads = c.roads;
  const built = (cat) => g.countBuilt(cat) > 0;
  return [
    [c.roads > 0, 'Baue eine Straße vom Ende der Autobahn ins Land.', { cat: 'roads' }],
    [c.zone[Z.RES] > 0 || g.stats.countByZone[Z.RES] > 0, 'Weise neben der Straße Wohngebiet aus.', { cat: 'zones' }],
    [built('power'), 'Baue ein Kraftwerk an eine Straße.', { cat: 'power' }],
    [hasWater(g), 'Baue einen Wasserturm an eine Straße.', { cat: 'water' }],
    [c.zone[Z.COM] + c.zone[Z.IND] > 0, 'Weise Gewerbe und Industrie aus – sie schaffen Arbeit.', { cat: 'zones' }],
    [built('garbage'), 'Baue eine Deponie für den Müll.', { cat: 'garbage' }],
    [g.milestone >= 1, `Wachse auf ${MILESTONES[1].pop} Einwohner. Dann gibt es jede Woche eine Wochenkarte.`, null],
    [g.transit.lines.length > 0, `Ab „${MILESTONES[2].name}": Zeichne die erste U-Bahn-Linie.`, { tool: { kind: 'line' } }],
  ];
}

const prioOf = (rank) => (rank >= 76 ? 3 : rank >= 46 ? 2 : 1);

export class Advisor {
  constructor(ui) {
    this.ui = ui;
    this.list = [];
    this.goal = null;          // das eine nächste Ziel
    this.goalSince = 0;
    this.seen = new Map();
    this.snoozed = new Map();  // id → bis Spielzeit
    this.external = new Map();
    this.bubble = null;
    this.timer = 0.5;
    this.unbind = [on('advice', (a) => { if (a && a.id && a.text) this.external.set(a.id, { ...a, until: ui.g.time + (a.minutes ?? 720) }); })];
  }
  dispose() { for (const u of this.unbind) u(); }

  compute() {
    const g = this.ui.g, ui = this.ui;
    const c = cityCounts(g);
    ui.cache.roads = c.roads;
    ui.cache.resZoned = c.zone[Z.RES] > 0;
    this.counts = c;
    const out = [];
    for (const r of ADVISOR_RULES) {
      let a = null;
      try { a = r.when(g, c, ui); } catch (e) { a = null; }
      if (!a) continue;
      const rank = a.rank ?? r.rank ?? (a.prio ? a.prio * 25 : 30);
      out.push({ id: r.id, ...a, rank, prio: a.prio || prioOf(rank) });
    }
    for (const [id, a] of this.external) {
      if (a.until < g.time) { this.external.delete(id); continue; }
      const rank = a.rank ?? (a.prio || 2) * 25;
      out.push({ id, ...a, rank, prio: a.prio || prioOf(rank) });
    }
    out.sort((a, b) => b.rank - a.rank);
    this.list = out;
    this.pickGoal();
    return out;
  }

  // Genau ein Ziel: das wichtigste, das nicht weggeklickt wurde. Ruhig: ein Ziel bleibt mindestens 20 s stehen,
  // außer es ist erledigt oder etwas deutlich Dringenderes taucht auf.
  pickGoal() {
    const g = this.ui.g, now = performance.now();
    const cand = this.list.find((a) => !(this.snoozed.get(a.id) > g.time)) || null;
    const cur = this.goal && this.list.find((a) => a.id === this.goal.id && !(this.snoozed.get(a.id) > g.time));
    if (cur && cand && cand.id !== cur.id && cand.rank < cur.rank + 10 && now - this.goalSince < 20000) { this.goal = cur; return; }
    if (!cand) { this.goal = null; return; }
    if (!this.goal || this.goal.id !== cand.id) this.goalSince = now;
    this.goal = cand;
  }
  snooze(id, days = 2) { this.snoozed.set(id, this.ui.g.time + 1440 * days); this.compute(); }

  top() { return this.list[0] || null; }

  update(dt) {
    // alle 2 s Echtzeit (nicht Bildzeit: bei wenigen Bildern pro Sekunde bliebe das Ziel sonst lange stehen)
    void dt;
    const now = performance.now();
    if (now < (this.nextAt || 0)) return;
    this.nextAt = now + 2000;
    this.compute();
    this.ui.refreshBadges();
    // Keine Sprechblasen mehr: Das eine Ziel steht ruhig im Begleiter (onboarding.js).
  }

  // Für alte Aufrufer (ui.js bindet die Sprechblase noch ein)
  showBubble() {}
  hideBubble() { this.bubble = null; if (this.ui.el && this.ui.el.bubble) this.ui.el.bubble.hidden = true; }
  bubbleClick() { this.hideBubble(); }

  html() {
    const ui = this.ui, g = ui.g;
    const list = this.compute().slice(0, 6);
    const s = g.stats, u = g.util;
    const lamp = (ok, warn) => `<i class="lamp ${ok ? 'ok' : warn ? 'warn' : 'bad'}"></i>`;
    const powerR = u.powerSupply ? u.powerDemand / u.powerSupply : (s.pop ? 2 : 0), waterR = u.waterSupply ? u.waterDemand / u.waterSupply : (s.pop ? 2 : 0);
    const board = [
      ['Strom', lamp(powerR < 0.85 && !s.unpowered, powerR < 1 && s.unpowered < 5), u.powerSupply ? `${pct(powerR)} genutzt` : 'fehlt'],
      ['Wasser', lamp(waterR < 0.85 && !s.unwatered, waterR < 1 && s.unwatered < 5), u.waterSupply ? `${pct(waterR)} genutzt` : 'fehlt'],
      ['Müll', lamp(!s.garbageProb, s.garbageProb < 8), s.garbageProb ? `${fmt(s.garbageProb)} Probleme` : 'sauber'],
      ['Arbeit', lamp(s.unemployment < 0.08, s.unemployment < 0.15), `${pct(s.unemployment)} ohne Job`],
      ['Glück', lamp(s.happiness >= 60, s.happiness >= 45), `${Math.round(s.happiness)} %`],
      ['Kasse', lamp(g.sandbox || (g.lastBudget && g.lastBudget.net >= 0), g.money > 0), g.sandbox ? 'Sandkasten' : `${g.lastBudget && g.lastBudget.net >= 0 ? '+' : '−'}${fmt(Math.abs(Math.round(g.lastBudget ? g.lastBudget.net : 0)))} € am Tag`],
      ['Verkehr', lamp(s.trafficFlow >= 0.85, s.trafficFlow >= 0.7), `${pct(s.trafficFlow || 1)} fließt`],
    ];
    const say = !list.length ? 'Alles im grünen Bereich. Weiter so!' : list[0].prio >= 3 ? 'Darum sollten wir uns sofort kümmern:' : 'Das würde ich als Nächstes tun:';
    return `
<div class="persona"><div class="av big">FP</div><div><div class="who">Frieda Puls</div><div class="role">Stadtplanerin von ${esc(g.name)}</div><div class="say">${say}</div></div></div>
${list.length ? `<div class="advice">${list.map((a, i) => `<div class="adv p${a.prio}"><div class="at">${esc(a.text)}${a.why ? `<br><span style="opacity:.75">${esc(a.why)}</span>` : ''}</div>${a.act ? `<button class="btn small${a.prio >= 3 ? '' : ' ghost'}" data-act="advice" data-i="${i}">${esc(a.label || 'Zeigen')} ${icon('arrowR', 14)}</button>` : ''}</div>`).join('')}</div>` : ''}
<div class="sec"><h3>Lagebericht</h3><div class="board">${board.map(([k, l, v]) => `<div class="br">${l}<span class="bk">${k}</span><span class="bv num">${v}</span></div>`).join('')}</div></div>
<div class="sec"><button class="btn small ghost" data-act="advhelp">${icon('help', 14)} So funktioniert's</button></div>`;
  }

  click(act, el) {
    if (act === 'advice') { const a = this.list.slice(0, 6)[+el.dataset.i]; if (a && a.act) this.ui.runAction(a.act); return false; }
    if (act === 'advhelp') { if (this.ui.openHelp) this.ui.openHelp(); return false; }
    return false;
  }
}

export function adviceLevel(adv) { const t = adv.top(); return t ? t.prio || 1 : 0; }
export { TUTORIAL_COVERED };
