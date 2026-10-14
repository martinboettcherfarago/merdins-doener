// Statistik-Zentrale (Panel „Statistik", F3): alle Zahlen der Stadt an einem Ort, nach Themen geordnet.
//   Reiter: Überblick · Versorgung · Dienste · Menschen · Geld · Verkehr · Umwelt · Verläufe
//   Je Bereich: wenige große Kennzahlen, Bedarf/Kapazität als Balken mit Ampelfarbe, Anzahl Anlagen,
//   Warnungen mit Lösungsvorschlag (die Regeln der Ratgeberin, advisor.js), „Auf Karte" (Infoansicht) und „Mehr Details"
//   (bestehendes Detail-Panel, passender Reiter). Liest nur – Simulationslogik bleibt in src/sim.
// Schnittstelle: STATS_PANEL (Panel-Objekt für corepanels.js), STATS_TABS, statsAreas(ui) → Ampel je Bereich,
//   openStats(ui, tab) öffnet die Zentrale auf einem Reiter. Der gewählte Reiter steht in app.settings.statsTab.
import { BUILDINGS, ZONE_INFO, Z } from '../config.js';
import { BUDGET_LINES } from '../registry.js';
import { fmt, fmtMoney, fmtShort, clamp } from '../util.js';
import { happinessFactors } from '../sim/services.js';
import { AGE_GROUPS, STAGES, SEWAGE_LEVEL } from '../sim/systems/citizens.js';
import { SEASON_INFO } from '../sim/systems/weather.js';
import * as TPS from '../sim/systems/transport.js';
import { wxIcon } from './panels/weather.js';
import { icon } from './icons.js';
import { drawLineChart, svgSpark, svgDonut, chartIndexAt } from './charts.js';
import { viewList, DISASTER_NAMES } from './meta.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const pct = (v) => `${Math.round((v || 0) * 100)} %`;
const signed = (v) => `${v >= 0 ? '+' : '−'}${fmtMoney(Math.abs(v))}`;
const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : many}`;
const SEV_RANK = { bad: 3, warn: 2, good: 1, off: 0, info: 0 };
const worst = (list) => list.reduce((a, s) => (SEV_RANK[s] > SEV_RANK[a] ? s : a), 'off');
// Ampel für Auslastung (Bedarf ÷ Kapazität)
const ampLoad = (r) => (r > 1 ? 'bad' : r > 0.9 ? 'warn' : 'good');
const SEV_COL = { good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)', off: 'var(--accent-line)', info: 'var(--l-blue)' };

export const STATS_TABS = [
  { id: 'overview', name: 'Überblick', icon: 'pulse', color: '#5b2fb3' },
  { id: 'versorgung', name: 'Versorgung', icon: 'power', color: '#e9a514', desc: 'Strom, Wasser, Abwasser, Müll und Fernwärme' },
  { id: 'dienste', name: 'Dienste', icon: 'services', color: '#e8543f', desc: 'Gesundheit, Bildung, Polizei, Feuerwehr und Friedhof' },
  { id: 'menschen', name: 'Menschen', icon: 'citizens', color: '#4fae67', desc: 'Einwohner, Alter, Arbeit und Glück' },
  { id: 'geld', name: 'Geld', icon: 'coin', color: '#c98a0c', desc: 'Saldo, Einnahmen, Ausgaben und Kredite' },
  { id: 'verkehr', name: 'Verkehr', icon: 'car', color: '#2f8fe0', desc: 'Verkehrsfluss, Bus, Straßenbahn und U-Bahn' },
  { id: 'umwelt', name: 'Umwelt', icon: 'tree', color: '#22a866', desc: 'Abgase, Lärm, Gewässer und Wetter' },
  { id: 'trends', name: 'Verläufe', icon: 'stats', color: '#5b2fb3', desc: 'Entwicklung der Stadt Tag für Tag' },
];
const TAB_IDS = STATS_TABS.map((t) => t.id);
const tabById = (id) => STATS_TABS.find((t) => t.id === id) || STATS_TABS[0];

// Hinweise der Ratgeberin (advisor.js) je Karte – dieselben Texte und Lösungen wie im Stadt-Check
const ADV_CARD = {
  'power-none': 'power', unpowered: 'power', powercap: 'power',
  'water-none': 'water', unwatered: 'water', watercap: 'water',
  sewage: 'sewage', garbage: 'garbage', 'garbage-none': 'garbage',
  nohealth: 'health', noschool: 'edu', nopolice: 'police', crime: 'police', burning: 'fire', nofire: 'fire',
  happy: 'happy', abandoned: 'happy', unemp: 'work', workers: 'work',
  broke: 'money', budget: 'money',
  traffic: 'roads', noroad: 'roads', stations: 'ubahn', transit: 'ubahn',
  pollution: 'pollution',
};
const CARD_AREA = {
  power: 'versorgung', water: 'versorgung', sewage: 'versorgung', garbage: 'versorgung', heat: 'versorgung',
  health: 'dienste', edu: 'dienste', police: 'dienste', fire: 'dienste', death: 'dienste',
  people: 'menschen', work: 'menschen', happy: 'menschen',
  money: 'geld',
  roads: 'verkehr', bus: 'verkehr', ubahn: 'verkehr',
  pollution: 'umwelt', noise: 'umwelt', weather: 'umwelt',
};

// Gewählter Reiter (UI-Zustand, bleibt über Neustarts erhalten wie die Minikarte)
function curTab(ui) {
  const s = ui.app && ui.app.settings;
  const t = (s && s.statsTab) || ui.statsTab;
  return TAB_IDS.includes(t) ? t : 'overview';
}
function setTab(ui, t) {
  if (!TAB_IDS.includes(t)) t = 'overview';
  ui.statsTab = t;
  const s = ui.app && ui.app.settings;
  if (s && s.statsTab !== t) { s.statsTab = t; try { ui.app.saveSettings(); } catch (e) { /* egal */ } }
}
export function openStats(ui, tab) {
  if (tab) setTab(ui, tab);
  if (ui.panel === 'stats') { ui._panelBody = null; ui.renderPanel(true); const b = ui.el.panel.querySelector('.body'); if (b) b.scrollTop = 0; } else ui.openPanel('stats');
}

// ---------------------------------------------------------------- Daten einsammeln (ein Durchlauf über alle Gebäude)
let viewIds = null;
const hasView = (id) => { if (!viewIds) { try { viewIds = new Set(viewList().map((o) => o.id)); } catch (e) { viewIds = new Set(); } } return viewIds.has(id); };

function collect(g) {
  const W = g.W, cov = g.cov || {}, fld = g.fields || {};
  const D = {
    n: { power: 0, water: 0, sewage: 0, garbage: 0, health: 0, police: 0, fire: 0, edu: 0, death: 0, heat: 0, care: 0, prison: 0, parks: 0 },
    garbage: { cap: 0, used: 0 },
    res: 0, cover: { health: 0, police: 0, fire: 0, garbage: 0 }, noGarbage: 0,
    pol: 0, noise: 0, loud: 0, smoky: 0, commute: 0, commuteN: 0,
  };
  const n = D.n;
  for (const b of g.buildings.values()) {
    if (b.zone) {
      if (b.zone !== Z.RES || b.abandoned || !(b.occ > 0)) continue;
      const i = b.y * W + b.x, w = b.occ;
      D.res += w;
      for (const k of ['health', 'police', 'fire', 'garbage']) if (cov[k] && cov[k][i] > 0.3) D.cover[k] += w;
      if (cov.garbage && cov.garbage[i] < 0.25) D.noGarbage++;
      const p = fld.pollution ? fld.pollution[i] : 0, no = fld.noise ? fld.noise[i] : 0;
      D.pol += p * w; D.noise += no * w;
      if (no > 0.45) D.loud++;
      if (p > 0.3) D.smoky++;
      if (b.commute > 0) { D.commute += b.commute * w; D.commuteN += w; }
      continue;
    }
    const d = BUILDINGS[b.key];
    if (!d) continue;
    if (d.cat === 'parks') n.parks++;
    if (d.power > 0 && !d.heat) n.power++;
    if (d.heat) n.heat++;
    if (d.water > 0) n.water++;
    if (d.sewage > 0) n.sewage++;
    if (d.seniorCare) n.care++;
    if (d.inmates) n.prison++;
    const t = d.service && d.service.type;
    if (t === 'garbage') { n.garbage++; if (b.construct >= 1) { D.garbage.cap += d.service.capacity; D.garbage.used += (b.load || 0) * d.service.capacity; } }
    else if (t === 'health') n.health++;
    else if (t === 'police') n.police++;
    else if (t === 'fire') n.fire++;
    else if (t === 'edu') n.edu++;
    else if (t === 'deathcare') n.death++;
  }
  const r = D.res || 1;
  D.share = { health: D.cover.health / r, police: D.cover.police / r, fire: D.cover.fire / r, garbage: D.cover.garbage / r };
  D.polAvg = D.pol / r; D.noiseAvg = D.noise / r;
  D.commuteAvg = D.commuteN ? D.commute / D.commuteN : 0;
  return D;
}

// Ratgeber-Hinweise je Karte (aus advisor.list, wird alle 2 s neu berechnet)
function advFor(ui) {
  const out = {};
  const list = (ui.advisor && ui.advisor.list) || [];
  for (const a of list) {
    const c = ADV_CARD[a.id];
    if (!c) continue;
    (out[c] || (out[c] = [])).push({ id: a.id, sev: a.prio >= 3 ? 'bad' : 'warn', text: a.text, why: a.why, label: a.label, adv: true });
  }
  return out;
}

// ---------------------------------------------------------------- Bausteine
// Eigene Symbole, die icons.js nicht kennt
const SVG = {
  grave: '<path d="M7 21V10a5 5 0 0 1 10 0v11"/><path d="M4 21h16M12 9.5v6M9.5 12h5"/>',
};
const ico = (name, size, stroke) => (SVG[name] ? `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVG[name]}</svg>` : icon(name, size, stroke));
const lockNote = (text) => `<div class="sz-lock">${icon('lock', 14, 2.3)}<span>${text}</span></div>`;
function issueHTML(it) {
  const btn = it.label && (it.adv || it.act) ? `<button class="btn small${it.sev === 'bad' ? '' : ' ghost'}" data-act="sz-fix" data-id="${esc(it.id)}">${esc(it.label)} ${icon('arrowR', 13, 2.6)}</button>` : '';
  return `<div class="sz-issue ${it.sev}"><span class="sz-ii">${icon(it.sev === 'good' ? 'check' : it.sev === 'info' ? 'info' : 'warn', 13, 2.6)}</span><div class="grow"><b>${esc(it.text)}</b>${it.why ? `<span>${esc(it.why)}</span>` : ''}</div>${btn}</div>`;
}
function bar(v, max, sev) {
  const w = max > 0 ? clamp(v / max, 0, 1) * 100 : v > 0 ? 100 : 0;
  return `<div class="sz-bar ${sev}"><i style="width:${w.toFixed(1)}%"></i></div>`;
}
// Karte eines Bereichs. o: { id, title, icon, color, big, bigSev, unit, sub, body, issues, view, build, more, locked }
function card(ui, o, ctx) {
  const issues = [...(ctx.adv[o.id] || []), ...(o.issues || [])];
  for (const it of issues) ctx.fix.set(it.id, it);
  const sev = o.locked ? 'off' : worst([o.bigSev || 'good', ...issues.map((i) => i.sev)]);
  ctx.sev[o.id] = sev;
  const btns = [];
  if (o.view && hasView(o.view)) btns.push(`<button class="btn small ghost${ui.view === o.view ? ' on' : ''}" data-act="sz-view" data-v="${o.view}" data-tip="Auf Karte zeigen" data-tip-desc="Farbige Karte „${esc(o.title)}" über der Stadt." data-tip-fast="1">${icon('eye', 14, 2.4)} Auf Karte</button>`);
  if (o.build && !o.locked) btns.push(`<button class="btn small ghost" data-act="sz-build" data-v="${o.build}" data-tip="Bauen" data-tip-desc="Passende Gebäude im Baukatalog." data-tip-fast="1">${icon('plus', 14, 2.6)} Bauen</button>`);
  if (o.more && ui.panelDef(o.more.panel)) btns.push(`<button class="btn small ghost sz-more" data-act="sz-more" data-p="${o.more.panel}" data-a="${o.more.act || ''}" data-k="${o.more.key || ''}" data-v="${o.more.v || ''}" data-tip="Mehr Details" data-tip-desc="${esc(o.more.desc || 'Ausführliches Fenster zu diesem Thema.')}" data-tip-fast="1">Mehr Details ${icon('arrowR', 13, 2.6)}</button>`);
  return `<section class="sz-card${o.locked ? ' locked' : ''}" style="--cc:${o.color}" data-card="${o.id}">
<div class="sz-ch"><span class="sz-ci">${ico(o.icon, 17, 2.3)}</span><div class="grow"><h4>${esc(o.title)}</h4>${o.sub ? `<small>${o.sub}</small>` : ''}</div>${o.big !== undefined && !o.locked ? `<div class="sz-big ${o.bigSev || ''}"><b class="num">${o.big}</b>${o.unit ? `<small>${o.unit}</small>` : ''}</div>` : `<i class="sz-lamp ${sev}"></i>`}</div>
${o.locked ? lockNote(o.locked) : o.body || ''}
${o.locked ? '' : issues.map(issueHTML).join('')}
${btns.length ? `<div class="sz-acts">${btns.join('')}</div>` : ''}
</section>`;
}
// Bedarf/Kapazität als beschrifteter Balken
const meterRow = (label, v, max, unit, sev, extra = '') => `<div class="sz-mr"><span>${label}</span><span class="num">${fmt(v)} / ${fmt(max)}${unit ? ' ' + unit : ''}${extra}</span></div>${bar(v, max, sev)}`;
const facts = (rows) => `<div class="sz-facts">${rows.filter(Boolean).map(([k, v, cls = '']) => `<span>${k}</span><b class="num ${cls}">${v}</b>`).join('')}</div>`;
const kpi = (k, v, sub = '', cls = '', spark = '') => `<div class="sz-kpi"><span class="k">${k}</span><b class="v num ${cls}">${v}</b>${sub ? `<span class="s">${sub}</span>` : ''}${spark}</div>`;
const histVals = (g, key, n = 30) => g.history.slice(-n).map((h) => h[key] ?? 0);
const spark = (vals, col, zero = false) => (vals.length > 1 ? svgSpark(vals, { w: 76, h: 24, color: col, zero }) : '');

// ---------------------------------------------------------------- Bereiche
function areaVersorgung(ui, ctx) {
  const g = ui.g, u = g.util, s = g.stats, D = ctx.D, Cz = g.ext.citizens, S = Cz && Cz.stats;
  const pr = u.powerSupply ? u.powerDemand / u.powerSupply : s.pop ? 2 : 0;
  const wr = u.waterSupply ? u.waterDemand / u.waterSupply : s.pop ? 2 : 0;
  const out = [];
  out.push(card(ui, {
    id: 'power', title: 'Strom', icon: 'power', color: '#e9a514', view: 'power', build: 'power',
    big: u.powerSupply ? pct(pr).replace(' %', '') : '–', unit: u.powerSupply ? '% genutzt' : 'kein Kraftwerk', bigSev: u.powerSupply ? ampLoad(pr) : s.pop ? 'bad' : 'off',
    sub: `${plural(D.n.power, 'Kraftwerk', 'Kraftwerke')}${D.n.heat ? ` · ${plural(D.n.heat, 'Heizkraftwerk', 'Heizkraftwerke')}` : ''}`,
    body: meterRow('Bedarf / Leistung', u.powerDemand, u.powerSupply, 'MW', ampLoad(pr)) + (s.unpowered ? facts([['Gebäude ohne Strom', fmt(s.unpowered), 'neg']]) : ''),
  }, ctx));
  out.push(card(ui, {
    id: 'water', title: 'Wasser', icon: 'water', color: '#2f8fe0', view: 'water', build: 'water',
    big: u.waterSupply ? pct(wr).replace(' %', '') : '–', unit: u.waterSupply ? '% genutzt' : 'keine Anlage', bigSev: u.waterSupply ? ampLoad(wr) : s.pop ? 'bad' : 'off',
    sub: plural(D.n.water, 'Wasseranlage', 'Wasseranlagen'),
    body: meterRow('Bedarf / Förderung', u.waterDemand, u.waterSupply, 'm³', ampLoad(wr)) + (s.unwatered ? facts([['Gebäude ohne Wasser', fmt(s.unwatered), 'neg']]) : '') + (S && S.contam > 0.03 ? facts([['Trinkwasser verschmutzt', pct(S.contam), 'neg']]) : ''),
    issues: S && S.contam > 0.03 ? [{ id: 'contam', sev: S.contam > 0.1 ? 'bad' : 'warn', text: 'Das Trinkwasser ist verschmutzt.', why: 'Ein Pumpwerk zieht Wasser nahe einem Abwasserauslass. Auslass flussabwärts verlegen oder eine Kläranlage bauen.', label: 'Kläranlage', act: g.isUnlocked('sewage_plant') ? { cat: 'water', tool: { kind: 'place', key: 'sewage_plant' } } : { cat: 'water' } }] : [],
  }, ctx));
  // Abwasser
  if (S) {
    const sr = S.sewageCap > 0 ? S.sewageDemand / S.sewageCap : S.sewageDemand > 0 ? 2 : 0;
    const iss = [];
    if (S.sewageRequired && S.sewageCap > 0 && S.sewageCap < S.sewageDemand) iss.push({ id: 'sewover', sev: 'bad', text: `Das Kanalnetz ist überlastet (${pct(sr)}).`, why: 'Baue eine weitere Abwasseranlage – eine Kläranlage schafft 1.800 m³ und reinigt fast alles.', label: 'Abwasser bauen', act: { cat: 'water' } });
    if (S.waterPolMax > 0.25) iss.push({ id: 'sewpol', sev: 'warn', text: 'Abwasser färbt das Gewässer braun.', why: 'Pumpwerke in der Nähe fördern verschmutztes Wasser. Eine Kläranlage reinigt 88 % des Abwassers.', label: 'Kläranlage', act: g.isUnlocked('sewage_plant') ? { cat: 'water', tool: { kind: 'place', key: 'sewage_plant' } } : { cat: 'water' } });
    if (S.sewBlocked > 0) iss.push({ id: 'sewblock', sev: 'info', text: `${plural(S.sewBlocked, 'Haus wartet', 'Häuser warten')} nur noch auf den Kanal, um auf Stufe ${SEWAGE_LEVEL} zu wachsen.` });
    out.push(card(ui, {
      id: 'sewage', title: 'Abwasser', icon: 'water', color: '#9a6a3a', view: 'sewage', build: 'water',
      more: { panel: 'citizens', act: 'tab', key: 't', v: 'supply', desc: 'Bevölkerung → Versorgung: Anlagen, Kanalnetz und Gewässer.' },
      big: S.sewageRequired ? (S.sewageCap > 0 ? pct(sr).replace(' %', '') : '–') : '✓', unit: S.sewageRequired ? (S.sewageCap > 0 ? '% genutzt' : 'keine Anlage') : 'Sickergruben reichen', bigSev: !S.sewageRequired ? 'good' : S.sewageCap > 0 ? ampLoad(sr) : 'bad',
      sub: `${plural(D.n.sewage, 'Anlage', 'Anlagen')} · ${fmt(Cz.sewConnected || 0)} Gebäude angeschlossen`,
      body: (S.sewageRequired || S.sewageCap > 0 ? meterRow('Abwasser / Kapazität', S.sewageDemand, S.sewageCap, 'm³', S.sewageRequired ? ampLoad(sr) : 'good') : '<p class="sz-note">Noch reichen Sickergruben. Sobald größere Häuser (Stufe 3) entstehen, brauchen sie einen Kanalanschluss.</p>')
        + facts([S.sewageRequired && ['Ohne Anschluss', fmt(S.unsewered), S.unsewered ? 'neg' : ''], S.waterPolMax > 0.05 && ['Gewässer verschmutzt (stärkste Stelle)', pct(S.waterPolMax), S.waterPolMax > 0.3 ? 'neg' : '']]),
      issues: iss,
    }, ctx));
  }
  // Müll
  const gr = D.garbage.cap > 0 ? D.garbage.used / D.garbage.cap : 0;
  out.push(card(ui, {
    id: 'garbage', title: 'Müll', icon: 'garbage', color: '#a07a4a', view: 'garbage', build: 'garbage',
    big: D.garbage.cap ? pct(gr).replace(' %', '') : '–', unit: D.garbage.cap ? '% ausgelastet' : 'keine Deponie', bigSev: D.garbage.cap ? ampLoad(gr) : s.pop > 40 ? 'warn' : 'off',
    sub: plural(D.n.garbage, 'Anlage', 'Anlagen'),
    body: (D.garbage.cap ? meterRow('Müll / Kapazität', D.garbage.used, D.garbage.cap, 't', ampLoad(gr)) : '') + facts([['Gebäude mit Müllproblem', fmt(s.garbageProb), s.garbageProb ? 'neg' : ''], ['Wohnhäuser ohne Müllabfuhr', fmt(D.noGarbage), D.noGarbage ? 'neg' : '']]),
    issues: gr > 0.95 ? [{ id: 'garbfull', sev: gr > 1.05 ? 'bad' : 'warn', text: 'Die Müllabfuhr ist am Limit.', why: 'Eine weitere Deponie, Müllverbrennung oder ein Recyclinghof entlastet. Die Verordnung „Recycling" senkt die Müllmenge.', label: 'Müllanlage', act: { cat: 'garbage' } }] : [],
  }, ctx));
  // Fernwärme
  if (S) {
    const unlocked = g.isUnlocked('district_heating') || D.n.heat > 0;
    const hr = S.heatDemand > 0 ? S.heatSupply / S.heatDemand : 1;
    out.push(card(ui, {
      id: 'heat', title: 'Fernwärme', icon: 'thermo', color: '#e8543f', build: 'power',
      more: { panel: 'citizens', act: 'tab', key: 't', v: 'supply', desc: 'Bevölkerung → Versorgung: Wärmebedarf und Heizkraftwerke.' },
      locked: !unlocked && !(S.hd > 0 && S.cold > 0) ? `Heizkraftwerke kommen ${g.lockReason('district_heating') ? g.lockReason('district_heating').replace(/^Ab/, 'ab') : 'später'}. Bis dahin heizen die kleinen Häuser selbst.` : '',
      big: S.hd > 0 ? pct(Math.min(1, hr)).replace(' %', '') : '✓', unit: S.hd > 0 ? '% gedeckt' : 'kein Bedarf', bigSev: S.hd > 0 ? (S.cold > 0 ? (hr < 0.7 ? 'bad' : 'warn') : 'good') : 'good',
      sub: `${plural(D.n.heat, 'Heizkraftwerk', 'Heizkraftwerke')} · ${Math.round(S.temp)} °C`,
      body: S.hd > 0 ? meterRow('Wärme / Bedarf', S.heatSupply, S.heatDemand, '', S.cold ? 'bad' : 'good') + (S.cold ? facts([['Gebäude frieren', fmt(S.cold), 'neg']]) : '') : `<p class="sz-note">Bei ${Math.round(S.temp)} °C braucht niemand Fernwärme. Unter 10 °C steigt der Bedarf – größere Häuser ohne Wärme frieren, die Leute werden krank.</p>`,
      issues: S.hd > 0 && S.cold > 0 ? [{ id: 'cold', sev: S.cold > 10 ? 'bad' : 'warn', text: `${plural(S.cold, 'Gebäude friert', 'Gebäude frieren')}.`, why: 'Ein Heizkraftwerk im selben Straßennetz liefert Fernwärme.', label: 'Heizkraftwerk', act: g.isUnlocked('district_heating') ? { cat: 'power', tool: { kind: 'place', key: 'district_heating' } } : { cat: 'power' } }] : [],
    }, ctx));
  }
  return out.join('');
}

function areaDienste(ui, ctx) {
  const g = ui.g, s = g.stats, D = ctx.D, Cz = g.ext.citizens, S = Cz && Cz.stats;
  const out = [];
  const lockOf = (key, what) => (g.isUnlocked(key) ? '' : `${what} ${String(g.lockReason(key) || 'später').replace(/^Ab/, 'ab')}.`);
  // Gesundheit
  {
    const iss = [];
    if (S && S.beds.q < 0.9 && S.beds.severe > 2) iss.push({ id: 'beds', sev: S.beds.q < 0.6 ? 'bad' : 'warn', text: 'Krankenhausbetten fehlen.', why: `${fmt(S.beds.severe)} schwere Fälle, ${fmt(S.beds.beds)} Betten. Ein Krankenhaus hat 180 Betten, eine Praxis 12.`, label: 'Krankenhaus', act: g.isUnlocked('hospital') ? { view: 'health', cat: 'services', tool: { kind: 'place', key: 'hospital' } } : { view: 'health', cat: 'services' } });
    if (S && S.sickShare > 0.08) iss.push({ id: 'sick', sev: 'warn', text: `Viele Kranke (${pct(S.sickShare)}).`, why: 'Praxen und Krankenhäuser heilen schneller. Abgase, fehlendes Abwasser und Kälte machen krank.' });
    if (S && S.care.demand > S.care.cap * 1.1 && S.care.demand > 30 && g.isUnlocked('elderly_care')) iss.push({ id: 'care', sev: 'info', text: `Pflegeplätze fehlen: ${fmt(S.care.demand)} Hochbetagte, ${fmt(S.care.cap)} Plätze.`, why: 'Seniorenheime verlängern das Leben der Ältesten.', label: 'Seniorenheim', act: { cat: 'services', tool: { kind: 'place', key: 'elderly_care' } } });
    out.push(card(ui, {
      id: 'health', title: 'Gesundheit', icon: 'cross', color: '#e8543f', view: 'health', build: 'services',
      more: { panel: 'citizens', act: 'tab', key: 't', v: 'health', desc: 'Bevölkerung → Gesundheit: Krankenstand, Betten und Pflege.' },
      locked: lockOf('clinic', 'Arztpraxen kommen'),
      big: pct(D.share.health).replace(' %', ''), unit: '% versorgt', bigSev: s.pop > 300 ? (D.share.health < 0.5 ? 'warn' : 'good') : 'good',
      sub: `${plural(D.n.health, 'Praxis oder Klinik', 'Praxen und Kliniken')}${D.n.care ? ` · ${plural(D.n.care, 'Seniorenheim', 'Seniorenheime')}` : ''}`,
      body: S ? meterRow('Schwere Fälle / Betten', S.beds.severe, Math.max(S.beds.beds, 1), '', S.beds.q < 0.9 && S.beds.severe > 2 ? 'warn' : 'good') + facts([['Krank', `${fmt(S.sick)} · ${pct(S.sickShare)}`, S.sickShare > 0.08 ? 'neg' : ''], ['Lebenserwartung', `${S.lifeExp.toFixed(0)} Jahre`], S.care.demand > 0 && ['Pflegeplätze / Hochbetagte', `${fmt(S.care.cap)} / ${fmt(S.care.demand)}`]]) : '',
      issues: iss,
    }, ctx));
  }
  // Bildung
  if (S) {
    const chain = ['kita', 'school', 'gym', 'uni'].map((id) => {
      const st = S.stage[id] || { pupils: 0, seats: 0 };
      const name = (STAGES.find((x) => x.id === id) || {}).name || id;
      const fill = st.seats > 0 ? st.pupils / st.seats : st.pupils > 0 ? 9 : 0;
      const sev = !st.seats ? 'off' : fill > 1.05 ? 'bad' : fill > 0.9 ? 'warn' : 'good';
      return `<div class="sz-step ${sev}"><span class="n">${name === 'Universität' ? 'Uni' : name}</span><b class="num">${st.seats ? pct(Math.min(fill, 9)) : 'fehlt'}</b><small class="num">${st.seats ? `${fmt(st.pupils)} / ${fmt(st.seats)}` : `${fmt(st.pupils)} ohne Platz`}</small></div>`;
    }).join('<i class="sz-arr">›</i>');
    const iss = [];
    const st = S.stage;
    const over = ['kita', 'school', 'gym', 'uni'].find((k) => st[k] && st[k].seats > 0 && st[k].pupils > st[k].seats * 1.05);
    if (over) iss.push({ id: 'eduover', sev: 'warn', text: `${(STAGES.find((x) => x.id === over) || {}).name || 'Einrichtungen'}: zu wenig Plätze.`, why: 'Überfüllte Einrichtungen bringen weniger Abschlüsse. Eine weitere in der Nähe der Wohnviertel hilft.', label: 'Bildung bauen', act: { view: 'edu', cat: 'education' } });
    if (st.gym && st.gym.seats === 0 && g.isUnlocked('highschool') && s.pop > 1500) iss.push({ id: 'nogym', sev: 'info', text: 'Ein Gymnasium bringt Abiture – Voraussetzung fürs Studium.', label: 'Gymnasium', act: { cat: 'education', tool: { kind: 'place', key: 'highschool' } } });
    if (st.uni && st.uni.seats === 0 && g.isUnlocked('university') && s.pop > 3000) iss.push({ id: 'nouni', sev: 'info', text: 'Eine Universität bildet Akademiker aus – Büros und Wohntürme brauchen sie.', label: 'Universität', act: { cat: 'education', tool: { kind: 'place', key: 'university' } } });
    out.push(card(ui, {
      id: 'edu', title: 'Bildung', icon: 'book', color: '#8f5ad8', view: 'edu', build: 'education',
      more: { panel: 'citizens', act: 'tab', key: 't', v: 'edu', desc: 'Bevölkerung → Bildung: Bildungskette, Plätze und Abschlüsse.' },
      locked: lockOf('school', 'Schulen kommen'),
      big: pct(S.eduIndex).replace(' %', ''), unit: '% Bildungsindex', bigSev: 'good',
      sub: `${plural(D.n.edu, 'Einrichtung', 'Einrichtungen')} · Akademiker ${pct(S.uniShare)}`,
      body: `<div class="sz-chain">${chain}</div><p class="sz-note">Belegte Plätze je Stufe der Bildungskette. Über 100 %: überfüllt, weniger Abschlüsse.</p>`,
      issues: iss,
    }, ctx));
  }
  // Polizei
  out.push(card(ui, {
    id: 'police', title: 'Polizei', icon: 'shield', color: '#2f6fd0', view: 'police', build: 'services',
    locked: lockOf('police', 'Polizeiwachen kommen'),
    big: pct(s.crimeAvg).replace(' %', ''), unit: '% Kriminalität', bigSev: s.crimeAvg > 0.32 ? 'warn' : 'good',
    sub: `${plural(D.n.police, 'Wache', 'Wachen')}${D.n.prison ? ` · ${plural(D.n.prison, 'Gefängnis', 'Gefängnisse')}` : ''}`,
    body: meterRow('Einwohner im Schutz einer Wache', Math.round(D.cover.police), Math.max(1, Math.round(D.res)), '', D.share.police < 0.5 && s.pop > 350 ? 'warn' : 'good') + (S && S.prison && S.prison.cap ? facts([['Haftplätze / Straftäter', `${fmt(S.prison.cap)} / ${fmt(S.prison.criminals)}`]]) : ''),
  }, ctx));
  // Feuerwehr
  out.push(card(ui, {
    id: 'fire', title: 'Feuerwehr', icon: 'flame', color: '#d9622b', view: 'fire', build: 'services',
    locked: lockOf('fire', 'Feuerwachen kommen'),
    big: pct(D.share.fire).replace(' %', ''), unit: '% geschützt', bigSev: s.burning ? 'bad' : D.share.fire < 0.5 && s.pop > 200 ? 'warn' : 'good',
    sub: plural(D.n.fire, 'Feuerwache', 'Feuerwachen'),
    body: meterRow('Einwohner im Einsatzgebiet', Math.round(D.cover.fire), Math.max(1, Math.round(D.res)), '', D.share.fire < 0.5 && s.pop > 200 ? 'warn' : 'good') + (s.burning ? facts([['Brennende Gebäude', fmt(s.burning), 'neg']]) : ''),
  }, ctx));
  // Friedhof
  if (S) {
    const unlocked = g.isUnlocked('cemetery');
    const iss = [];
    if (S.bodies >= 1) iss.push({ id: 'bodies', sev: S.maxDeadDays >= 2 ? 'bad' : 'warn', text: `${plural(Math.round(S.bodies), 'Verstorbener wartet', 'Verstorbene warten')} auf die Bestattung.`, why: 'Die Nachbarn sind entsetzt – nach einigen Tagen ziehen Menschen weg. Ein Friedhof in Reichweite schickt Leichenwagen.', label: 'Friedhof', act: unlocked ? { view: 'deathcare', cat: 'services', tool: { kind: 'place', key: 'cemetery' } } : { view: 'deathcare' } });
    if (S.graveFill > 0.85) iss.push({ id: 'graves', sev: 'warn', text: `Die Friedhöfe sind zu ${pct(S.graveFill)} belegt.`, why: 'Gräber werden erst nach 25 Jahren wieder frei – ein Krematorium braucht keine.', label: 'Krematorium', act: g.isUnlocked('crematorium') ? { cat: 'services', tool: { kind: 'place', key: 'crematorium' } } : { cat: 'services' } });
    out.push(card(ui, {
      id: 'death', title: 'Friedhof', icon: 'grave', color: '#7a8294', view: 'deathcare', build: unlocked ? 'services' : '',
      more: { panel: 'citizens', act: 'tab', key: 't', v: 'death', desc: 'Bevölkerung → Todesfälle: Bestattungen, Gräber und Leichenwagen.' },
      big: fmt(Math.round(S.bodies)), unit: 'warten', bigSev: S.bodies >= 1 ? 'bad' : 'good',
      sub: unlocked ? `${plural(D.n.death, 'Friedhof oder Krematorium', 'Friedhöfe und Krematorien')}` : 'Das Umland bestattet',
      body: (S.graves.cap ? meterRow('Gräber belegt', S.graves.used, S.graves.cap, '', S.graveFill > 0.85 ? 'warn' : 'good') : '') + facts([['Sterbefälle heute', fmt(S.deathsToday)], ['Vom Umland abgeholt', `${fmt(S.umland)}${S.umlandCost ? ` · ${fmtMoney(S.umlandCost)}` : ''}`]]) + (!unlocked ? `<p class="sz-note">Friedhöfe kommen ${String(g.lockReason('cemetery') || 'später').replace(/^Ab/, 'ab')}. Bis dahin übernimmt das Umland gegen Gebühr.</p>` : ''),
      issues: iss,
    }, ctx));
  }
  return out.join('');
}

// Glücksfaktoren gemittelt über alle Wohnhäuser (je Spielstunde einmal berechnet)
let happyCache = { key: '', list: [] };
function happyFactors(g) {
  const key = `${g.name}:${Math.floor(g.time / 60)}:${g.buildings.size}`;
  if (happyCache.key === key) return happyCache.list;
  const agg = new Map();
  let wsum = 0;
  for (const b of g.buildings.values()) {
    if (b.zone !== Z.RES || b.abandoned || b.construct < 1 || !(b.occ > 0)) continue;
    const out = [];
    try { happinessFactors(g, b, out); } catch (e) { continue; }
    const w = b.occ;
    wsum += w;
    for (const [l, v] of out) agg.set(l, (agg.get(l) || 0) + v * w);
  }
  const list = wsum ? [...agg.entries()].map(([l, v]) => [l, v / wsum]).filter(([, v]) => Math.abs(v) >= 0.4) : [];
  happyCache = { key, list };
  return list;
}

function areaMenschen(ui, ctx) {
  const g = ui.g, s = g.stats, Cz = g.ext.citizens, S = Cz && Cz.stats;
  const out = [];
  // Einwohner
  {
    const groups = S ? S.groups : null;
    const tot = groups ? groups.reduce((a, b) => a + b, 0) || 1 : 1;
    const stack = groups ? `<div class="sz-stack">${AGE_GROUPS.map((gr, k) => `<i style="width:${((groups[k] / tot) * 100).toFixed(1)}%;background:${gr.color}" title="${esc(gr.name)}"></i>`).join('')}</div><div class="sz-legend">${AGE_GROUPS.map((gr, k) => `<span><i style="background:${gr.color}"></i>${esc(gr.name)} <b class="num">${pct(groups[k] / tot)}</b></span>`).join('')}</div>` : '';
    const mig = S ? S.moveIn - S.moveOut : 0;
    out.push(card(ui, {
      id: 'people', title: 'Einwohner', icon: 'citizens', color: '#4fae67', view: hasView('age') ? 'age' : '',
      more: { panel: 'citizens', act: 'tab', key: 't', v: 'overview', desc: 'Bevölkerung: Alterspyramide, Geburten und Sterbefälle.' },
      big: fmt(s.pop), unit: 'Einwohner', bigSev: 'good',
      sub: S ? `Ø ${S.avgAge.toFixed(0)} Jahre · Lebenserwartung ${S.lifeExp.toFixed(0)}` : '',
      body: stack + (S ? facts([['Geburten / Sterbefälle heute', `${fmt(S.birthsToday)} / ${fmt(S.deathsToday)}`], ['Zuzug − Wegzug', `${mig >= 0 ? '+' : '−'}${fmt(Math.abs(mig))}`, mig < 0 ? 'neg' : 'pos'], s.tourism > 0 && ['Touristen pro Tag', fmt(s.tourism)]]) : ''),
    }, ctx));
  }
  // Arbeit
  {
    const j = s.jobsByZone || [0, 0, 0, 0, 0];
    const free = Math.max(0, Math.round(s.jobs - s.employed));
    out.push(card(ui, {
      id: 'work', title: 'Arbeit', icon: 'office', color: '#3a8ad8',
      big: pct(s.unemployment).replace(' %', ''), unit: '% arbeitslos', bigSev: s.unemployment > 0.14 ? 'bad' : s.unemployment > 0.08 ? 'warn' : 'good',
      sub: `${fmt(s.workers)} Arbeitskräfte · ${fmt(s.jobs)} Arbeitsplätze`,
      body: meterRow('Arbeitsplätze besetzt', Math.round(s.employed), Math.max(1, Math.round(s.jobs)), '', s.jobFill < 0.7 && s.jobs > 80 ? 'warn' : 'good')
        + facts([['Freie Stellen', fmt(free)], ['Jobs Gewerbe · Industrie · Büro', `${fmt(j[2])} · ${fmt(j[3])} · ${fmt(j[4])}`], ['Bildung Ø', pct(s.edu)], s.pop > 0 && ctx.D.commuteAvg > 0 && ['Ø Pendelzeit', `${Math.round(ctx.D.commuteAvg)} Min.`]]),
    }, ctx));
  }
  // Glück
  {
    const f = happyFactors(g).filter(([l]) => l !== 'Strom' && l !== 'Wasser');
    const pos = f.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const neg = f.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]).slice(0, 4);
    const max = Math.max(4, ...f.map(([, v]) => Math.abs(v)));
    const row = ([l, v]) => `<div class="sz-fac ${v < 0 ? 'neg' : 'pos'}"><span class="l">${esc(l)}</span><span class="t"><i style="width:${((Math.abs(v) / max) * 100).toFixed(0)}%"></i></span><b class="num">${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1).replace('.', ',')}</b></div>`;
    const h = s.happiness;
    out.push(card(ui, {
      id: 'happy', title: 'Glück', icon: 'heart', color: '#f06fae', view: 'happiness',
      big: Math.round(h), unit: '% zufrieden', bigSev: h < 45 ? 'bad' : h < 60 ? 'warn' : 'good',
      sub: `${plural(s.abandoned, 'Gebäude', 'Gebäude')} verlassen`,
      body: f.length ? `<div class="sz-facs"><div><h5>Macht froh</h5>${pos.map(row).join('') || '<p class="sz-note">–</p>'}</div><div><h5>Stört</h5>${neg.map(row).join('') || '<p class="sz-note">Nichts Nennenswertes.</p>'}</div></div><p class="sz-note">Ø Punkte je Wohnhaus. Ein Klick auf ein Haus zeigt seine eigenen Gründe.</p>` : '<p class="sz-note">Sobald Menschen hier wohnen, stehen hier die Gründe für ihre Stimmung.</p>',
    }, ctx));
  }
  return out.join('');
}

const INC_LABEL = { res: 'Steuern Wohnen', com: 'Steuern Gewerbe', ind: 'Steuern Industrie', off: 'Steuern Büro', tourism: 'Tourismus', fares: 'U-Bahn-Tickets' };
const EXP_LABEL = { services: 'Dienste & Versorgung', roads: 'Straßenunterhalt', transit: 'U-Bahn', policies: 'Verordnungen', loans: 'Kreditzinsen' };
const lineLabel = (id, map) => map[id] || (BUDGET_LINES.find((l) => l.id === id) || {}).label || id;

function areaGeld(ui, ctx) {
  const g = ui.g, b = g.budget();
  const top = (o, map) => Object.entries(o).filter(([, v]) => (v || 0) >= 0.5).sort((a, c) => c[1] - a[1]).slice(0, 3);
  const inc = top(b.inc, INC_LABEL), exp = top(b.exp, EXP_LABEL);
  const max = Math.max(1, b.income, b.expense);
  const row = (l, v, col) => `<div class="sz-mr"><span>${esc(l)}</span><span class="num">${fmtMoney(v)}</span></div><div class="sz-bar"><i style="width:${clamp(v / max, 0, 1) * 100}%;background:${col}"></i></div>`;
  const loans = g.loans.reduce((a, l) => a + l.amount, 0);
  const avgTax = [1, 2, 3, 4].map((z) => g.taxes[z]);
  const I = g.ext.industry;
  const out = [];
  out.push(card(ui, {
    id: 'money', title: 'Haushalt', icon: 'budget', color: '#c98a0c',
    more: { panel: 'budget', desc: 'Haushalt: alle Posten, Steuersätze und Kredite.' },
    big: g.sandbox ? '∞' : signed(b.net), unit: g.sandbox ? 'Sandkasten' : 'pro Tag', bigSev: g.sandbox ? 'good' : g.money < 0 ? 'bad' : b.net < 0 ? 'warn' : 'good',
    sub: g.sandbox ? 'Geld spielt keine Rolle' : `Kasse ${fmtMoney(g.money)}`,
    body: `<div class="sz-spark">${spark(histVals(g, 'net', 30), b.net < 0 ? '#d4433a' : '#2b9a57', true)}<span>Saldo der letzten 30 Tage</span></div>
<h5 class="sz-h5">Einnahmen · ${fmtMoney(b.income)}</h5>${inc.map(([k, v]) => row(lineLabel(k, INC_LABEL), v, '#2b9a57')).join('') || '<p class="sz-note">Noch keine Einnahmen.</p>'}
<h5 class="sz-h5">Ausgaben · ${fmtMoney(b.expense)}</h5>${exp.map(([k, v]) => row(lineLabel(k, EXP_LABEL), v, '#e0434a')).join('') || '<p class="sz-note">Noch keine Ausgaben.</p>'}
${facts([['Steuersätze W · G · I · B', `${avgTax.join(' · ')} %`], ['Kredite', g.loans.length ? `${g.loans.length} · ${fmtMoney(loans)}` : 'keine'], I && I.cycle && ['Konjunktur', esc(I.cycle.label)]])}`,
  }, ctx));
  return out.join('') + (ui.panelDef('economy') ? `<button class="sz-link" data-act="sz-more" data-p="economy" data-a="eco-tab" data-k="k" data-v="overview">${icon('economy', 16, 2.2)}<span><b>Wirtschaft</b><small>Konjunktur, Waren, Handel und Firmen</small></span>${icon('arrowR', 15, 2.4)}</button>` : '');
}

function areaVerkehr(ui, ctx) {
  const g = ui.g, s = g.stats, T = TPS.TS(g);
  const out = [];
  let jams = 0;
  for (let i = 0; i < g.N; i++) if (g.road[i] && g.congestion[i] > 0.85) jams++;
  const fl = s.trafficFlow ?? 1;
  out.push(card(ui, {
    id: 'roads', title: 'Straßen', icon: 'car', color: '#5d6470', view: 'traffic', build: 'roads',
    more: { panel: 'transport', act: 'tab', key: 'k', v: 'roads', desc: 'Verkehr & ÖPNV → Straße & Ampeln: Staus, Unfälle und Ampeln.' },
    big: Math.round(fl * 100), unit: '% Verkehrsfluss', bigSev: fl < 0.7 ? 'bad' : fl < 0.85 ? 'warn' : 'good',
    sub: `${fmt(g.traffic.cars.length)} Autos unterwegs`,
    body: facts([['Stau-Abschnitte', fmt(jams), jams > 20 ? 'neg' : ''], ctx.D.commuteAvg > 0 && ['Ø Pendelzeit', `${Math.round(ctx.D.commuteAvg)} Min.`], T && T.today && ['Unfälle heute', fmt(T.today.accidents || 0), T.today.accidents ? 'neg' : ''], T && T.signals && ['Ampeln', fmt(T.signals.length)]]),
  }, ctx));
  if (T) {
    const busOk = TPS.modeUnlocked(g, 'bus');
    const y = T.day || {};
    const bus = T.lines.filter((l) => l.mode === 'bus').length, tram = T.lines.filter((l) => l.mode === 'tram').length;
    const over = T.lines.filter((l) => l.load > 1.05);
    out.push(card(ui, {
      id: 'bus', title: 'Bus & Straßenbahn', icon: 'bus', color: '#10a9a3', view: 'ptransport', build: 'transport',
      more: { panel: 'transport', act: 'tab', key: 'k', v: 'lines', desc: 'Verkehr & ÖPNV → Linien: Takt, Fahrzeuge und Auslastung.' },
      locked: busOk || T.lines.length ? '' : `Busse kommen ${String(TPS.modeLockReason(g, 'bus') || 'später').replace(/^Ab/, 'ab')}.`,
      big: fmt((y.bus || 0) + (y.tram || 0)), unit: 'Fahrgäste gestern', bigSev: 'good',
      sub: `${plural(bus, 'Buslinie', 'Buslinien')}${tram ? ` · ${plural(tram, 'Tramlinie', 'Tramlinien')}` : ''}`,
      body: facts([['Bus / Tram gestern', `${fmt(y.bus || 0)} / ${fmt(y.tram || 0)}`], ['Abgewiesen (zu voll)', fmt(y.rejected || 0), (y.rejected || 0) > 10 ? 'neg' : ''], ['Umstiege zur U-Bahn', fmt(y.feeder || 0)]]),
      issues: [...over.slice(0, 2).map((l) => ({ id: `busover${l.id}`, sev: 'warn', text: `${TPS.lineLabel(l)} ist überfüllt (${pct(l.load)}).`, why: 'Mehr oder größere Fahrzeuge einsetzen.', label: 'Linien', act: { panel: 'transport' } })),
        ...(busOk && !g.hasBuilt('bus_depot') && s.pop > 250 ? [{ id: 'nodepot', sev: 'info', text: 'Ein Busdepot an einer Straße – danach kannst du Buslinien zeichnen.', label: 'Busdepot', act: { cat: 'transport' } }] : [])],
    }, ctx));
  }
  {
    const tr = g.transit;
    let overSt = 0;
    for (const st of tr.stations.values()) if (st.over > 0.02) overSt++;
    const ok = g.isUnlocked('transit') || tr.lines.length > 0;
    out.push(card(ui, {
      id: 'ubahn', title: 'U-Bahn', icon: 'ubahn', color: '#e8543f', view: 'transit',
      more: ui.panelDef('transit') ? { panel: 'transit', desc: 'U-Bahn: Linien, Züge und Takt.' } : null,
      locked: ok ? '' : `Die U-Bahn kommt ${String(g.lockReason('station') || 'später').replace(/^Ab/, 'ab')}.`,
      big: fmt(s.ridersToday || 0), unit: 'Fahrgäste heute', bigSev: overSt ? 'warn' : 'good',
      sub: `${plural(tr.lines.length, 'Linie', 'Linien')} · ${plural(tr.stations.size, 'Station', 'Stationen')}`,
      body: facts([['Anteil an allen Wegen', pct(s.transitShare)], overSt && ['Überfüllte Stationen', fmt(overSt), 'neg']]),
    }, ctx));
  }
  return out.join('');
}

function areaUmwelt(ui, ctx) {
  const g = ui.g, s = g.stats, D = ctx.D, Cz = g.ext.citizens, S = Cz && Cz.stats;
  const out = [];
  out.push(card(ui, {
    id: 'pollution', title: 'Abgase', icon: 'smoke', color: '#8a6a55', view: 'pollution',
    big: pct(D.polAvg).replace(' %', ''), unit: '% an Wohnhäusern', bigSev: D.polAvg > 0.3 ? 'bad' : D.polAvg > 0.15 ? 'warn' : 'good',
    sub: `Ø Stadt ${pct(s.pollutionAvg)} · ${plural(D.n.parks, 'Park', 'Parks')}`,
    body: meterRow('Belastung an Wohnhäusern', Math.round(D.polAvg * 100), 100, '%', D.polAvg > 0.3 ? 'bad' : D.polAvg > 0.15 ? 'warn' : 'good') + facts([['Wohnhäuser in dicker Luft', fmt(D.smoky), D.smoky ? 'neg' : ''], S && S.waterPolMax > 0.05 && ['Gewässer verschmutzt', pct(S.waterPolMax), S.waterPolMax > 0.3 ? 'neg' : '']]),
  }, ctx));
  out.push(card(ui, {
    id: 'noise', title: 'Lärm', icon: 'sound', color: '#5d6470', view: 'noise',
    big: pct(D.noiseAvg).replace(' %', ''), unit: '% an Wohnhäusern', bigSev: D.noiseAvg > 0.45 ? 'warn' : 'good',
    sub: 'Straßen, Industrie und Stadien',
    body: meterRow('Lärm an Wohnhäusern', Math.round(D.noiseAvg * 100), 100, '%', D.noiseAvg > 0.45 ? 'warn' : 'good') + facts([['Wohnhäuser in lauter Lage', fmt(D.loud), D.loud > 10 ? 'neg' : '']]),
  }, ctx));
  const w = g.ext.weather, st = g.ext.disasters;
  if (w && w.season) {
    const warns = st ? st.planned.filter((p) => p.known && !p.aftershock) : [];
    const act = st ? st.active.filter((a) => !a.aftershock) : [];
    const night = g.hour() < 5.5 || g.hour() > 21;
    const kind = w.storm ? 'thunder' : w.snow > 0.05 ? 'snow' : w.rain > 0.05 ? 'rain' : w.fog > 0.4 ? 'fog' : w.cloud < 0.15 ? 'clear' : w.cloud < 0.4 ? 'fair' : w.cloud < 0.75 ? 'cloudy' : 'overcast';
    const iss = [
      ...act.map((a) => ({ id: `dis${a.id}`, sev: 'bad', text: `${DISASTER_NAMES[a.type] || 'Katastrophe'} läuft gerade.`, why: 'Im Fenster „Wetter & Katastrophenschutz" stehen Einsätze und Wiederaufbau.', label: 'Schutz', act: { panel: 'weather' } })),
      ...warns.map((p) => ({ id: `warn${p.id}`, sev: 'warn', text: `Warnung: ${DISASTER_NAMES[p.type] || 'Unwetter'} kommt.`, why: 'Jetzt vorsorgen spart später Schäden.', label: 'Vorsorgen', act: { panel: 'weather' } })),
    ];
    out.push(card(ui, {
      id: 'weather', title: 'Wetter', icon: 'cloud', color: '#38a3d1',
      more: { panel: 'weather', act: 'wx-tab', key: 'v', v: warns.length || act.length ? 'safety' : 'weather', desc: 'Wetter & Katastrophenschutz: Vorhersage, Warnungen und Vorsorge.' },
      big: `${Math.round(w.temp)}°`, unit: esc(w.label || ''), bigSev: act.length ? 'bad' : warns.length ? 'warn' : 'good',
      sub: `${esc((SEASON_INFO[w.season] || {}).name || '')} · Tag ${w.seasonDay || 1}`,
      body: `<div class="sz-wx">${wxIcon(kind, 40, night)}${facts([['Wind', `${Math.round((w.wind || 0) * 130)} km/h`], ['Schneedecke', pct(w.snowCover || 0)], ['Warnungen', fmt(warns.length), warns.length ? 'neg' : '']])}</div>`,
      issues: iss,
    }, ctx));
  }
  return out.join('');
}

// ---------------------------------------------------------------- Überblick und Ampel je Bereich
const AREA_FN = { versorgung: areaVersorgung, dienste: areaDienste, menschen: areaMenschen, geld: areaGeld, verkehr: areaVerkehr, umwelt: areaUmwelt };
function makeCtx(ui) { return { D: collect(ui.g), adv: advFor(ui), sev: {}, fix: new Map() }; }

// Ampel und Kurztext je Bereich (für Überblick, Reiter und das Stadt-Menü)
export function statsAreas(ui, ctx) {
  ctx = ctx || makeCtx(ui);
  const g = ui.g, s = g.stats, u = g.util;
  // Karten einmal „trocken" berechnen, um ihre Ampel zu kennen
  if (!ctx.done) { for (const k of Object.keys(AREA_FN)) { try { AREA_FN[k](ui, ctx); } catch (e) { /* egal */ } } ctx.done = true; }
  const sevOf = (area) => worst(Object.entries(ctx.sev).filter(([c]) => CARD_AREA[c] === area).map(([, v]) => v));
  const issueCount = (area) => Object.entries(ctx.sev).filter(([c, v]) => CARD_AREA[c] === area && (v === 'bad' || v === 'warn')).length;
  const Cz = g.ext.citizens, S = Cz && Cz.stats;
  const b = g.lastBudget || { net: 0 };
  const text = {
    versorgung: `Strom ${u.powerSupply ? pct(u.powerDemand / u.powerSupply) : '–'} · Wasser ${u.waterSupply ? pct(u.waterDemand / u.waterSupply) : '–'}${S && S.sewageRequired ? ` · Abwasser ${S.sewageCap ? pct(S.sewageDemand / S.sewageCap) : '–'}` : ''}`,
    dienste: S ? `Versorgt ${pct(ctx.D.share.health)} · Bildung ${pct(S.eduIndex)} · Kriminalität ${pct(s.crimeAvg)}` : `Kriminalität ${pct(s.crimeAvg)}`,
    menschen: `${fmt(s.pop)} Einwohner · Glück ${Math.round(s.happiness)} % · ${pct(s.unemployment)} arbeitslos`,
    geld: g.sandbox ? 'Sandkasten – Geld spielt keine Rolle' : `${signed(b.net)} am Tag · Kasse ${fmtMoney(g.money)}`,
    verkehr: `Fluss ${pct(s.trafficFlow ?? 1)} · U-Bahn ${fmt(s.ridersToday || 0)} Fahrgäste`,
    umwelt: `Abgase ${pct(ctx.D.polAvg)} · Lärm ${pct(ctx.D.noiseAvg)}${g.ext.weather ? ` · ${Math.round(g.ext.weather.temp)} °C` : ''}`,
  };
  return STATS_TABS.filter((t) => AREA_FN[t.id]).map((t) => ({ ...t, sev: sevOf(t.id), n: issueCount(t.id), text: text[t.id] || '' }));
}

function areaOverview(ui, ctx) {
  const g = ui.g, s = g.stats, h = g.history;
  const last = h[h.length - 1], prev = h[h.length - 2];
  const dPop = last && prev ? last.pop - prev.pop : 0;
  const b = g.lastBudget || { net: 0 };
  const areas = statsAreas(ui, ctx);
  const counts = s.countByZone;
  const zoneParts = [1, 2, 3, 4].map((z) => ({ value: counts[z], color: hex(ZONE_INFO[z].color) }));
  const fx = g.effects.filter((e) => e.label);
  const seen = new Set();
  const chips = fx.filter((e) => (seen.has(e.label) ? false : seen.add(e.label))).map((e) => `<span class="chip">${esc(e.label)} · ${Math.max(1, Math.ceil((e.until - g.time) / 1440))} T.</span>`).join('');
  return `<div class="sz-kpis">
${kpi('Einwohner', fmt(s.pop), dPop ? `${dPop > 0 ? '+' : '−'}${fmt(Math.abs(dPop))} seit gestern` : 'seit gestern gleich', '', spark(histVals(g, 'pop'), '#4fae67'))}
${kpi('Glück', `${Math.round(s.happiness)} %`, s.happiness >= 60 ? 'zufrieden' : s.happiness >= 45 ? 'geht so' : 'unzufrieden', s.happiness < 45 ? 'neg' : '', spark(histVals(g, 'happy'), '#f06fae'))}
${kpi('Saldo am Tag', g.sandbox ? '∞' : signed(b.net), g.sandbox ? 'Sandkasten' : `Kasse ${fmtMoney(g.money)}`, !g.sandbox && b.net < 0 ? 'neg' : 'pos', g.sandbox ? '' : spark(histVals(g, 'net'), b.net < 0 ? '#d4433a' : '#2b9a57', true))}
${kpi('Arbeitslos', pct(s.unemployment), `${fmt(s.jobs)} Arbeitsplätze`, s.unemployment > 0.14 ? 'neg' : '', spark(histVals(g, 'unemp'), '#3a8ad8'))}
</div>
<div class="sec"><h3>Lage der Stadt</h3><div class="sz-lage">${areas.map((a) => `<button class="sz-area ${a.sev}" data-act="sz-tab" data-t="${a.id}" style="--cc:${a.color}"><i class="sz-lamp ${a.sev}"></i><span class="sz-ci">${icon(a.icon, 16, 2.3)}</span><span class="t"><b>${esc(a.name)}${a.n ? ` <em>${a.n}</em>` : ''}</b><small>${esc(a.text)}</small></span>${icon('chevronR', 16, 2.4)}</button>`).join('')}</div>
<p class="sz-note">Grün: läuft · Gelb: bald handeln · Rot: jetzt handeln. Ein Klick öffnet den Bereich.</p></div>
<div class="sec"><h3>Gebäude</h3><div class="donutrow">${svgDonut(zoneParts, { size: 84, thickness: 12, label: fmt(counts[1] + counts[2] + counts[3] + counts[4]) })}
<div class="kv grow">${[1, 2, 3, 4].map((z) => `<span><span class="zdot" style="background:${hex(ZONE_INFO[z].color)}"></span> ${ZONE_INFO[z].name}</span><span class="v">${fmt(counts[z])}</span>`).join('')}
<span>Verlassen</span><span class="v ${s.abandoned ? 'neg' : ''}">${fmt(s.abandoned)}</span></div></div></div>
${chips ? `<div class="sec"><h3>Laufende Effekte</h3><div class="chips" style="margin:0">${chips}</div></div>` : ''}`;
}

const SERIES = [
  ['pop', 'Einwohner', '#4fae67'], ['happy', 'Glück', '#f06fae', ' %'], ['unemp', 'Arbeitslos', '#3a8ad8', ' %'], ['jobs', 'Arbeitsplätze', '#9466d2'],
  ['money', 'Kasse', '#c98a0c'], ['net', 'Saldo', '#2f8fe0'], ['riders', 'Fahrgäste', '#e8543f'], ['flow', 'Verkehrsfluss', '#5d6470', ' %'],
];
function areaTrends(ui) {
  const g = ui.g, h = g.history;
  const k = SERIES.some((x) => x[0] === ui.chartKey) ? ui.chartKey : 'pop';
  const cmp = (key, days) => { const a = h[h.length - 1], b = h[Math.max(0, h.length - 1 - days)]; return a && b ? (a[key] ?? 0) - (b[key] ?? 0) : 0; };
  const fmtD = (key, v, unit = '') => (Math.abs(v) < 0.05 ? '±0' : `${v > 0 ? '+' : '−'}${key === 'money' || key === 'net' ? fmtMoney(Math.abs(v)) : (Math.abs(v) >= 10000 ? fmtShort(Math.abs(v)) : (Math.round(Math.abs(v) * 10) / 10).toLocaleString('de-DE'))}${unit}`);
  const rows = SERIES.filter(([key]) => key !== 'money' || !g.sandbox).map(([key, name, col, unit = '']) => { const d7 = cmp(key, 7), d30 = cmp(key, 30); return `<span><i style="background:${col}"></i>${name}</span><b class="num">${fmtD(key, d7, unit)}</b><b class="num">${fmtD(key, d30, unit)}</b>`; }).join('');
  return `<div class="sec"><h3>Verlauf</h3>
  <div class="chart-tabs">${SERIES.map(([key, n]) => `<button data-act="chart" data-k="${key}" class="${k === key ? 'on' : ''}">${n}</button>`).join('')}</div>
  <canvas class="chart" id="chart-main"></canvas>
</div>
<div class="sec"><h3>Veränderung</h3><div class="sz-cmp"><span></span><b>7 Tage</b><b>30 Tage</b>${rows}</div></div>`;
}

// ---------------------------------------------------------------- Panel
let lastCtx = null;
export const STATS_PANEL = {
  id: 'stats', title: 'Statistik', icon: 'stats',
  render(ui) {
    const tab = curTab(ui);
    const ctx = makeCtx(ui);
    let body;
    try { body = tab === 'overview' ? areaOverview(ui, ctx) : tab === 'trends' ? areaTrends(ui) : AREA_FN[tab](ui, ctx); } catch (e) { console.error('Statistik', tab, e); body = `<p class="empty">Fehler: ${esc(e.message)}</p>`; }
    let areas = [];
    try { areas = statsAreas(ui, ctx); } catch (e) { areas = []; }
    lastCtx = ctx;
    const sevOf = (id) => (areas.find((a) => a.id === id) || {}).sev || 'off';
    const t = tabById(tab);
    const nav = `<nav class="sz-nav" role="tablist" aria-label="Bereiche">${STATS_TABS.map((x) => `<button role="tab" aria-selected="${x.id === tab}" class="${x.id === tab ? 'on' : ''}" data-act="sz-tab" data-t="${x.id}" style="--cc:${x.color}" data-tip="${esc(x.name)}" data-tip-desc="${esc(x.desc || 'Alle Bereiche auf einen Blick.')}" data-tip-fast="1">${icon(x.icon, 17, 2.3)}<span>${esc(x.name)}</span>${AREA_FN[x.id] ? `<i class="sz-dot ${sevOf(x.id)}"></i>` : ''}</button>`).join('')}</nav>`;
    const lead = t.desc && tab !== 'overview' ? `<p class="sz-lead">${esc(t.desc)}</p>` : '';
    return `<div class="sz" data-tab="${tab}">${nav}${lead}${body}</div>`;
  },
  afterRender(ui) {
    const c = document.getElementById('chart-main');
    if (!c) return;
    const h = ui.g.history;
    const k = SERIES.some((x) => x[0] === ui.chartKey) ? ui.chartKey : 'pop';
    const ser = SERIES.find((x) => x[0] === k);
    const vals = h.map((e) => e[k] ?? 0);
    const opts = { color: ser[2], zero: k === 'net' || k === 'money', startLabel: h.length ? `Tag ${h[0].d}` : '', endLabel: h.length ? `Tag ${h[h.length - 1].d}` : '', fmt: (v) => (Math.abs(v) >= 10000 ? fmtShort(v) : (Math.round(v * 10) / 10).toLocaleString('de-DE')) + (ser[3] || ''), label: (i) => `Tag ${h[i].d}` };
    drawLineChart(c, vals, opts);
    c.onpointermove = (e) => { const r = c.getBoundingClientRect(); drawLineChart(c, vals, { ...opts, hover: chartIndexAt(c, e.clientX - r.left, vals.length) }); };
    c.onpointerleave = () => drawLineChart(c, vals, opts);
  },
  click(ui, act, el) {
    const ds = el.dataset;
    if (act === 'sz-tab') { setTab(ui, ds.t); const b = ui.el.panel.querySelector('.body'); if (b) b.scrollTop = 0; ui.app.audio.play('tab'); return true; }
    if (act === 'chart') { ui.chartKey = ds.k; ui.app.audio.play('tab'); return true; }
    if (act === 'sz-view') {
      ui.setView(ui.view === ds.v ? 'none' : ds.v);
      if (ui.mobile() && ui.view !== 'none') ui.closePanels();
      return true;
    }
    if (act === 'sz-build') { ui.runAction({ cat: ds.v }); return false; }
    if (act === 'sz-fix') {
      const ctx = lastCtx || makeCtx(ui);
      const it = ctx.fix.get(ds.id);
      if (it && it.adv) { const a = ((ui.advisor && ui.advisor.list) || []).find((x) => x.id === ds.id); if (a && a.act) ui.runAction(a.act); }
      else if (it && it.act) ui.runAction(it.act);
      return !!ui.panel;
    }
    if (act === 'sz-more') {
      const def = ui.panelDef(ds.p);
      if (!def) return false;
      if (ds.a && def.click) { try { def.click(ui, ds.a, { dataset: { [ds.k]: ds.v } }); } catch (e) { /* egal */ } }
      ui.openPanel(ds.p);
      return false;
    }
    return true;
  },
};
