// Ratgeberin „Frieda Puls, Stadtplanerin": wertet die Stadt laufend aus und gibt priorisierte Hinweise mit Aktion.
// Erweiterbar:
//   ADVISOR_RULES.push({ id, when(g, ui) → null | { text, prio: 1..3, act?: { view, cat, panel, where: {x,y}, tool }, label? } })
//   emit('advice', { id, text, prio, act, label, minutes })  – einmaliger Hinweis (Standard 12 Spielstunden gültig)
import { R, MILESTONES, BUILDINGS } from '../config.js';
import { on } from '../registry.js';
import { fmt } from '../util.js';
import { icon } from './icons.js';
import { problems } from './notify.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (v) => `${Math.round(v * 100)} %`;

function roadCount(g) { let n = 0; for (let i = 0; i < g.N; i++) if (g.road[i] && g.road[i] !== R.HIGHWAY) n++; return n; }

export const ADVISOR_RULES = [
  { id: 'start-road', when: (g, ui) => (!g.sandbox && ui.cache.roads === 0 ? { prio: 3, text: 'Beginne am Ende der Autobahn im Westen: Ziehe von dort eine Straße ins Land.', act: { cat: 'roads', tool: { kind: 'road', type: R.STREET } }, label: 'Straße bauen' } : null) },
  { id: 'start-zone', when: (g, ui) => (!g.sandbox && ui.cache.roads > 0 && g.stats.countByZone[1] === 0 && !ui.cache.resZoned ? { prio: 3, text: 'Weise entlang der Straße Wohngebiet aus – die ersten Familien warten schon.', act: { cat: 'zones', tool: { kind: 'zone', zone: 1 } }, label: 'Wohngebiet' } : null) },
  { id: 'power-none', when: (g) => (g.buildings.size > 3 && g.countBuilt('power') === 0 ? { prio: 3, text: 'Die Stadt hat noch kein Kraftwerk. Ohne Strom zieht niemand ein.', act: { cat: 'power' }, label: 'Kraftwerk wählen' } : null) },
  { id: 'water-none', when: (g) => (g.buildings.size > 3 && g.countBuilt('water') === 0 ? { prio: 3, text: 'Es fehlt Wasser. Ein Wasserturm geht überall, ein Pumpwerk muss ans Ufer.', act: { cat: 'water' }, label: 'Wasser bauen' } : null) },
  { id: 'unpowered', when: (g) => (g.stats.unpowered > 0 && g.countBuilt('power') > 0 ? { prio: g.stats.unpowered > 6 ? 3 : 2, text: `${fmt(g.stats.unpowered)} Gebäude haben keinen Strom. Mehr Leistung oder eine Straße, die das Netz verbindet, hilft.`, act: { view: 'power', cat: 'power' }, label: 'Stromnetz zeigen' } : null) },
  { id: 'unwatered', when: (g) => (g.stats.unwatered > 0 && g.countBuilt('water') > 0 ? { prio: g.stats.unwatered > 6 ? 3 : 2, text: `${fmt(g.stats.unwatered)} Gebäude ohne Wasser. Pumpwerke brauchen Strom und Ufer.`, act: { view: 'water', cat: 'water' }, label: 'Wassernetz zeigen' } : null) },
  { id: 'powercap', when: (g) => { const u = g.util; return u.powerSupply > 0 && u.powerDemand > u.powerSupply * 0.9 ? { prio: 2, text: `Das Stromnetz ist zu ${pct(u.powerDemand / u.powerSupply)} ausgelastet. Bald gehen die Lichter aus.`, act: { cat: 'power' }, label: 'Kraftwerk bauen' } : null; } },
  { id: 'watercap', when: (g) => { const u = g.util; return u.waterSupply > 0 && u.waterDemand > u.waterSupply * 0.9 ? { prio: 2, text: `Die Wasserversorgung ist zu ${pct(u.waterDemand / u.waterSupply)} ausgelastet.`, act: { cat: 'water' }, label: 'Wasser bauen' } : null; } },
  { id: 'garbage', when: (g) => (g.stats.garbageProb > 2 ? { prio: g.stats.garbageProb > 10 ? 3 : 2, text: `Müll stapelt sich an ${fmt(g.stats.garbageProb)} Gebäuden. Eine Deponie oder Müllverbrennung in Reichweite schafft Abhilfe.`, act: { view: 'garbage', cat: 'garbage' }, label: 'Müllabfuhr zeigen' } : null) },
  { id: 'burning', when: (g) => (g.stats.burning > 0 ? { prio: 3, text: 'Es brennt! Eine Feuerwache in der Nähe löscht und verhindert neue Brände.', act: { view: 'fire', cat: 'services' }, label: 'Feuerwehr zeigen' } : null) },
  { id: 'noroad', when: (g) => (g.stats.noRoad > 0 ? { prio: 2, text: `${fmt(g.stats.noRoad)} Gebäude haben keinen Anschluss an die Autobahn. Verbinde das Straßennetz.`, act: { cat: 'roads' }, label: 'Straßen' } : null) },
  { id: 'res-demand', when: (g) => (g.demand[1] > 55 ? { prio: 2, text: 'Viele Menschen wollen zuziehen – weise mehr Wohngebiet aus.', act: { cat: 'zones', tool: { kind: 'zone', zone: 1 } }, label: 'Wohngebiet' } : null) },
  { id: 'com-demand', when: (g) => (g.demand[2] > 55 ? { prio: 1, text: 'Die Leute wollen einkaufen: Gewerbe ist gefragt.', act: { cat: 'zones', tool: { kind: 'zone', zone: 2 } }, label: 'Gewerbe' } : null) },
  { id: 'ind-demand', when: (g) => (g.demand[3] > 55 ? { prio: 1, text: 'Die Industrie sucht Flächen. Mit etwas Abstand zu Wohnhäusern ausweisen.', act: { cat: 'zones', tool: { kind: 'zone', zone: 3 } }, label: 'Industrie' } : null) },
  { id: 'off-demand', when: (g) => (g.demand[4] > 55 && g.isUnlocked('zone4') ? { prio: 1, text: 'Büros wollen sich ansiedeln – sauber und gut bezahlt.', act: { cat: 'zones', tool: { kind: 'zone', zone: 4 } }, label: 'Büro' } : null) },
  { id: 'unemp', when: (g) => (g.stats.pop > 120 && g.stats.unemployment > 0.14 ? { prio: 2, text: `${pct(g.stats.unemployment)} der Menschen sind arbeitslos. Gewerbe und Industrie schaffen Jobs.`, act: { cat: 'zones' }, label: 'Zonen' } : null) },
  { id: 'workers', when: (g) => (g.stats.jobs > 80 && g.stats.jobFill < 0.7 ? { prio: 1, text: 'Betriebe finden keine Arbeitskräfte. Mehr Wohngebiet in der Nähe hilft.', act: { cat: 'zones', tool: { kind: 'zone', zone: 1 } }, label: 'Wohngebiet' } : null) },
  { id: 'budget', when: (g) => (!g.sandbox && g.lastBudget && g.lastBudget.net < 0 && g.money < Math.max(8000, -g.lastBudget.net * 10) ? { prio: g.money < 0 ? 3 : 2, text: `Der Haushalt schreibt ${fmt(Math.round(-g.lastBudget.net))} € Minus am Tag. Steuern leicht anheben oder teure Dienste prüfen.`, act: { panel: 'budget' }, label: 'Haushalt öffnen' } : null) },
  { id: 'happy', when: (g) => (g.stats.pop > 80 && g.stats.happiness < 45 ? { prio: 2, text: `Die Stimmung ist mies (${Math.round(g.stats.happiness)} %). Klicke Wohnhäuser an – dort stehen die Gründe.`, act: { view: 'happiness' }, label: 'Glück zeigen' } : null) },
  { id: 'crime', when: (g) => (g.stats.pop > 300 && g.stats.crimeAvg > 0.32 ? { prio: 2, text: 'Die Kriminalität steigt. Polizeiwachen in Reichweite der Wohnviertel helfen.', act: { view: 'crime', cat: 'services' }, label: 'Polizei' } : null) },
  { id: 'nofire', when: (g) => (g.stats.pop > 250 && !g.hasBuilt('fire') && !g.hasBuilt('firehq') && g.isUnlocked('fire') ? { prio: 2, text: 'Noch keine Feuerwehr – ein einziger Brand kann ganze Straßen kosten.', act: { cat: 'services', view: 'fire' }, label: 'Feuerwache' } : null) },
  { id: 'nohealth', when: (g) => (g.stats.pop > 350 && !g.hasBuilt('clinic') && !g.hasBuilt('hospital') && g.isUnlocked('clinic') ? { prio: 1, text: 'Eine Arztpraxis macht die Nachbarschaft gesünder und glücklicher.', act: { cat: 'services', view: 'health' }, label: 'Arztpraxis' } : null) },
  { id: 'noschool', when: (g) => (g.stats.pop > 300 && !g.hasBuilt('school') && g.isUnlocked('school') ? { prio: 1, text: 'Ohne Schule bleiben die Häuser klein. Bildung ermöglicht höhere Stufen.', act: { cat: 'education', view: 'edu' }, label: 'Schule' } : null) },
  { id: 'noparks', when: (g) => (g.stats.pop > 200 && g.countBuilt('parks') === 0 ? { prio: 1, text: 'Parks heben Bodenwert und Laune – schon ein kleiner Park wirkt.', act: { cat: 'parks' }, label: 'Parks' } : null) },
  { id: 'traffic', when: (g) => (g.stats.pop > 300 && g.stats.trafficFlow < 0.7 ? { prio: 2, text: `Stau! Der Verkehr fließt nur zu ${pct(g.stats.trafficFlow)}. Alleen und die Pulsbahn entlasten.`, act: { view: 'traffic' }, label: 'Verkehr zeigen' } : null) },
  { id: 'transit', when: (g) => (g.isUnlocked('transit') && !g.sandbox && g.transit.lines.length === 0 ? { prio: 2, text: 'Die Pulsbahn ist frei! Zeichne eine Linie zwischen Wohnen und Arbeit – jede Ankunft spielt einen Ton.', act: { tool: { kind: 'line' } }, label: 'Linie zeichnen' } : null) },
  { id: 'stations', when: (g) => { let st = null; for (const s of g.transit.stations.values()) if (s.over > 0.02 && (!st || s.over > st.over)) st = s; return st ? { prio: 3, text: `Station ${st.name} ist überfüllt. Mehr Züge oder Waggons einsetzen.`, act: { panel: 'transit', where: { x: st.x, y: st.y } }, label: 'Linien verwalten' } : null; } },
  { id: 'voucher', when: (g) => { const k = [...g.landmarkVouchers].find((x) => !g.hasBuilt(x)); return k && BUILDINGS[k] ? { prio: 1, text: `Du hast einen Gutschein für ${BUILDINGS[k].name} – zum halben Preis.`, act: { cat: 'landmarks' }, label: 'Wahrzeichen' } : null; } },
  { id: 'abandoned', when: (g) => (g.stats.abandoned > 4 ? { prio: 2, text: `${fmt(g.stats.abandoned)} Gebäude stehen leer. Prüfe Glück, Jobs und Versorgung in der Gegend.`, act: { view: 'happiness' }, label: 'Glück zeigen' } : null) },
  { id: 'milestone', when: (g) => { const n = MILESTONES[g.milestone + 1]; return n && g.stats.pop >= n.pop * 0.85 && g.stats.pop < n.pop ? { prio: 1, text: `Nur noch ${fmt(n.pop - g.stats.pop)} Einwohner bis „${n.name}".`, act: null } : null; } },
];

export function tutorialSteps(g, ui) {
  let res = 0, other = 0;
  for (let i = 0; i < g.N; i++) { if (g.zone[i] === 1) res++; else if (g.zone[i] === 2 || g.zone[i] === 3) other++; }
  const has = (cat) => g.countBuilt(cat) > 0;
  return [
    [ui.cache.roads > 0, 'Ziehe eine Straße vom Ende der Autobahn ins Land (Straßen → Straße).', { cat: 'roads' }],
    [res > 0 || g.stats.countByZone[1] > 0, 'Weise entlang der Straße Wohngebiet aus (Zonen → Wohnen).', { cat: 'zones' }],
    [other > 0 || g.stats.countByZone[2] + g.stats.countByZone[3] > 0, 'Gewerbe und Industrie schaffen Jobs – mit etwas Abstand zum Wohnen.', { cat: 'zones' }],
    [has('power'), 'Baue ein Kraftwerk an einer Straße. Strom fließt durchs Straßennetz.', { cat: 'power' }],
    [has('water'), 'Sorge für Wasser: Wasserturm oder Pumpwerk am Ufer.', { cat: 'water' }],
    [has('garbage'), 'Eine Deponie hält die Straßen sauber.', { cat: 'garbage' }],
    [g.milestone >= 1, `Erreiche ${MILESTONES[1].pop} Einwohner. Danach gibt es jede Woche eine Wochenkarte.`, null],
    [g.transit.lines.length > 0, 'Ab „Kleinstadt": Zeichne die erste Pulsbahn-Linie zwischen Wohnen und Arbeit.', { tool: { kind: 'line' } }],
  ];
}

export class Advisor {
  constructor(ui) {
    this.ui = ui;
    this.list = [];
    this.seen = new Map();     // id → Spielzeit der letzten Blase
    this.snoozed = new Map();  // id → bis Spielzeit
    this.external = new Map();
    this.bubble = null;
    this.timer = 1.5;
    this.unbind = [on('advice', (a) => { if (a && a.id && a.text) this.external.set(a.id, { ...a, until: ui.g.time + (a.minutes ?? 720) }); })];
  }
  dispose() { for (const u of this.unbind) u(); }

  compute() {
    const g = this.ui.g, ui = this.ui;
    ui.cache.roads = roadCount(g);
    ui.cache.resZoned = false;
    for (let i = 0; i < g.N && !ui.cache.resZoned; i++) if (g.zone[i] === 1) ui.cache.resZoned = true;
    const out = [];
    for (const r of ADVISOR_RULES) {
      let a = null;
      try { a = r.when(g, ui); } catch (e) { a = null; }
      if (a) out.push({ id: r.id, ...a });
    }
    for (const [id, a] of this.external) { if (a.until < g.time) this.external.delete(id); else out.push({ id, prio: 2, ...a }); }
    out.sort((a, b) => (b.prio || 1) - (a.prio || 1));
    this.list = out;
    return out;
  }

  top() { return this.list[0] || null; }

  update(dt) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 2;
    this.compute();
    const ui = this.ui, g = ui.g;
    ui.refreshBadges();
    if (!ui.app.settings.advisor || ui.photo.active || ui.modalOpen() || this.bubble || ui.mobile()) return;
    const cand = this.list.find((a) => (a.prio || 1) >= 2 && !(this.snoozed.get(a.id) > g.time) && !(g.time - (this.seen.get(a.id) ?? -1e9) < 1440 * 2));
    if (cand) this.showBubble(cand);
  }

  showBubble(a) {
    const ui = this.ui;
    this.seen.set(a.id, ui.g.time);
    this.bubble = a;
    const el = ui.el.bubble;
    el.innerHTML = `<div class="av">FP</div><div class="bb"><div class="who">Frieda Puls <span>Stadtplanerin</span></div><div class="tx">${esc(a.text)}</div><div class="ba">${a.act ? `<button class="btn small" data-act="badvice">${esc(a.label || 'Zeigen')}</button>` : ''}<button class="btn small ghost" data-act="bsnooze">Später</button></div></div><button class="close" data-act="bclose" aria-label="Schließen">${icon('close', 14)}</button>`;
    el.hidden = false;
    el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter');
    clearTimeout(this.hideT);
    this.hideT = setTimeout(() => this.hideBubble(), 16000);
  }
  hideBubble() { clearTimeout(this.hideT); this.bubble = null; if (this.ui.el.bubble) this.ui.el.bubble.hidden = true; }
  bubbleClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b || !this.bubble) return;
    const a = this.bubble;
    if (b.dataset.act === 'badvice' && a.act) this.ui.runAction(a.act);
    if (b.dataset.act === 'bsnooze') this.snoozed.set(a.id, this.ui.g.time + 1440 * 4);
    this.hideBubble();
  }

  html() {
    const ui = this.ui, g = ui.g;
    const list = this.compute();
    const s = g.stats, u = g.util;
    const lamp = (ok, warn) => `<i class="lamp ${ok ? 'ok' : warn ? 'warn' : 'bad'}"></i>`;
    const powerR = u.powerSupply ? u.powerDemand / u.powerSupply : (s.pop ? 2 : 0), waterR = u.waterSupply ? u.waterDemand / u.waterSupply : (s.pop ? 2 : 0);
    const board = [
      ['Strom', lamp(powerR < 0.85 && !s.unpowered, powerR < 1 && s.unpowered < 5), u.powerSupply ? pct(powerR) : '–'],
      ['Wasser', lamp(waterR < 0.85 && !s.unwatered, waterR < 1 && s.unwatered < 5), u.waterSupply ? pct(waterR) : '–'],
      ['Müll', lamp(!s.garbageProb, s.garbageProb < 8), s.garbageProb ? `${fmt(s.garbageProb)} Probleme` : 'sauber'],
      ['Arbeit', lamp(s.unemployment < 0.08, s.unemployment < 0.15), `${pct(s.unemployment)} arbeitslos`],
      ['Glück', lamp(s.happiness >= 60, s.happiness >= 45), `${Math.round(s.happiness)} %`],
      ['Haushalt', lamp(g.sandbox || (g.lastBudget && g.lastBudget.net >= 0), g.money > 0), g.sandbox ? 'Sandkasten' : `${g.lastBudget && g.lastBudget.net >= 0 ? '+' : '−'}${fmt(Math.abs(Math.round(g.lastBudget ? g.lastBudget.net : 0)))} €/Tag`],
      ['Verkehr', lamp(s.trafficFlow >= 0.85, s.trafficFlow >= 0.7), `${pct(s.trafficFlow || 1)} Fluss`],
    ];
    const steps = !ui.app.settings.tutorialDone && !g.sandbox ? tutorialSteps(g, ui) : null;
    const firstOpen = steps ? steps.findIndex((x) => !x[0]) : -1;
    return `
<div class="persona"><div class="av big">FP</div><div><div class="who">Frieda Puls</div><div class="role">Stadtplanerin von ${esc(g.name)}</div><div class="say">${list.length ? (list[0].prio >= 3 ? 'Das hier sollten wir sofort angehen:' : 'Hier ist, was mir auffällt:') : 'Alles im grünen Bereich. Weiter so!'}</div></div></div>
${list.length ? `<div class="advice">${list.slice(0, 8).map((a, i) => `<div class="adv p${a.prio || 1}"><div class="at">${esc(a.text)}</div>${a.act ? `<button class="btn small${(a.prio || 1) >= 3 ? '' : ' ghost'}" data-act="advice" data-i="${i}">${esc(a.label || 'Zeigen')} ${icon('arrowR', 14)}</button>` : ''}</div>`).join('')}</div>` : ''}
<div class="sec"><h3>Lagebericht</h3><div class="board">${board.map(([k, l, v]) => `<div class="br">${l}<span class="bk">${k}</span><span class="bv num">${v}</span></div>`).join('')}</div></div>
${steps && firstOpen >= 0 ? `<div class="sec"><h3>Erste Schritte</h3><ol class="steps">${steps.map((st, i) => `<li class="${st[0] ? 'done' : i === firstOpen ? 'now' : ''}">${esc(st[1])}</li>`).join('')}</ol></div>` : ''}`;
  }

  click(act, el) {
    if (act === 'advice') { const a = this.list[+el.dataset.i]; if (a && a.act) this.ui.runAction(a.act); return false; }
    return false;
  }
}

export function adviceLevel(adv) { const t = adv.top(); return t ? t.prio || 1 : 0; }
