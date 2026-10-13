// Panel „Wirtschaft" (Produktion, Handel, Logistik, Dienstbudgets, Steuern). Besitzer: System-Agent Wirtschaft & Industrie.
// registerPanel({ id, title, icon, order, render(ui) → HTML, click(ui, act, el), afterRender(ui) })
// ui.g = Spiel, ui.app = App (settings, audio, input, engine). Knöpfe mit data-act="..." lösen click aus.
// Außerdem hier: Infoansicht „Waren", Problemsymbole (Warenmangel, Absatzflaute), Inspektor-Abschnitte
// und ein Eintrag in der Werkzeugleiste „Logistik". Die Simulation steckt in sim/systems/industry.js.
import { registerPanel, registerOverlay, registerIcon, INSPECTORS, BUILDING_PROBLEMS, TRAY_ITEMS } from '../../registry.js';
import { BUILDINGS, ZONE_INFO, MILESTONES } from '../../config.js';
import { fmt, fmtMoney, clamp } from '../../util.js';
import { drawLineChart } from '../charts.js';
import { INSPECTOR_ACTIONS } from '../inspector.js';
import { GOODS, GOOD_KEYS, RAW_KEYS, SPEC_PLURAL, SPEC_DATIVE, SPEC_HOWTO, ECON } from '../../content/industry.js';
import {
  BUDGET_CATS, budgetOf, categoryUpkeep, setServiceBudget, setExportPrice, setBuyRaw, setAutoPrice, setWarehouseMode, cycleWarehouseGood,
  WH_MODES, setDensityTax, worldPrice, marketDemand, goodsColor, buildingEconomy, cycleForecast, cycleLabel, SEASON_NAMES,
} from '../../sim/systems/industry.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const T = (v) => `${fmt(v)} t`;
const P = (v) => `${Math.round(v * 100)} %`;
const money = (v) => (v >= 0 ? '+' : '−') + fmtMoney(Math.abs(v)).replace('−', '');
const hexS = (n) => '#' + n.toString(16).padStart(6, '0');
const TIER = ['Rohstoff', 'Verarbeitet', 'Konsumgut'];
const PROC_KEYS = ['food_factory', 'sawmill', 'steelworks', 'refinery'];

// ---------------------------------------------------------------- Symbole (SVG für Knöpfe)
const SVG_FACTORY = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21V11l5 3V11l5 3V11l5 3V4h3v17H3Z"/><path d="M7 18h2M12 18h2M17 18h1"/></svg>';
const SVG_CRATES = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="12" width="8" height="8" rx="1"/><rect x="13" y="12" width="8" height="8" rx="1"/><rect x="8" y="4" width="8" height="8" rx="1"/><path d="M7 12v3M17 12v3M12 4v3"/></svg>';

// ---------------------------------------------------------------- Stil (nur für dieses Panel, Präfix eco-)
function injectStyle() {
  if (typeof document === 'undefined' || document.getElementById('eco-style')) return;
  const s = document.createElement('style');
  s.id = 'eco-style';
  s.textContent = `
.eco-tabs{display:flex;gap:4px;margin:0 0 12px;flex-wrap:wrap}
.eco-tabs button{padding:5px 10px;border-radius:999px;background:var(--paper-2);font-size:12.5px;font-weight:600}
.eco-tabs button:hover:not(.on){background:var(--paper-3)}
.eco-tabs button.on{background:var(--ink);color:var(--paper)}
.eco-cycle{background:var(--paper-2);border-radius:12px;padding:9px 12px 8px;margin-bottom:12px}
.eco-cycle .hd{display:flex;align-items:baseline;gap:8px}
.eco-cycle .lab{font-family:var(--f-display);font-weight:700;font-size:14px;white-space:nowrap}
.eco-cycle .sub{font-size:11.5px;color:var(--ink-3);margin-left:auto;text-align:right;line-height:1.3}
.eco-cycle .trk{position:relative;height:8px;border-radius:4px;margin:9px 0 4px;background:linear-gradient(90deg,#e5483c,#f2b01e 32%,#d6cdbd 50%,#9fd27a 68%,#22a866)}
.eco-cycle .trk i{position:absolute;top:-4px;width:5px;height:16px;border-radius:3px;background:var(--ink);transform:translateX(-2.5px);box-shadow:0 0 0 2px var(--paper)}
.eco-cycle .ends{display:flex;justify-content:space-between;font-size:10px;color:var(--ink-3);letter-spacing:.06em;text-transform:uppercase;font-weight:700}
.eco-kpi{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:8px}
.eco-kpi>div{background:var(--paper-2);border-radius:10px;padding:7px 9px;min-width:0}
.eco-kpi .k{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eco-kpi .v{font-family:var(--f-num);font-size:19px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.eco-kpi .d{font-size:11px;color:var(--ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eco-bar{display:flex;height:9px;border-radius:5px;overflow:hidden;background:var(--paper-3)}
.eco-bar i{display:block;height:100%}
.eco-row{display:grid;grid-template-columns:106px 1fr 48px;gap:8px;align-items:center;font-size:12.5px;padding:3px 0}
.eco-row .n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}
.eco-row .v{font-family:var(--f-num);font-weight:600;text-align:right;white-space:nowrap}
.eco-legend{display:flex;flex-wrap:wrap;gap:3px 10px;font-size:11px;color:var(--ink-3);margin-top:6px}
.eco-legend span{white-space:nowrap}
.eco-legend span::before{content:'';display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px;background:var(--c)}
.eco-hint{display:flex;gap:9px;padding:6px 0;font-size:12.5px;line-height:1.4;color:var(--ink-2);border-bottom:1px solid var(--rule)}
.eco-hint:last-child{border-bottom:0}
.eco-hint .dot{width:8px;height:8px;border-radius:50%;flex:none;margin-top:5px}
.eco-good{padding:9px 0;border-bottom:1px solid var(--rule)}
.eco-good.off{opacity:.55}
.eco-good .hd{display:flex;align-items:center;gap:8px;font-size:13.5px}
.eco-good .hd b{font-weight:700;white-space:nowrap}
.eco-good .tier{font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);font-weight:700}
.eco-good .px{margin-left:auto;font-family:var(--f-num);font-weight:600;white-space:nowrap;font-size:14px}
.eco-good .tag{font-size:10.5px;font-weight:700;padding:1px 6px;border-radius:999px;white-space:nowrap}
.eco-good .nums{display:flex;gap:4px 10px;font-size:11.5px;color:var(--ink-3);margin:5px 0 6px;flex-wrap:wrap}
.eco-good .nums b{color:var(--ink-2);font-family:var(--f-num);font-weight:600;font-size:12.5px}
.eco-price{display:grid;grid-template-columns:44px 1fr 40px;gap:8px;align-items:center;font-size:12px;color:var(--ink-2)}
.eco-price .val{font-family:var(--f-num);font-weight:700;text-align:right;color:var(--ink)}
.eco-price input{margin:0}
.eco-note{font-size:11.5px;color:var(--ink-3);margin-top:3px;line-height:1.35}
.eco-seg{display:inline-flex;background:var(--paper-3);border-radius:8px;padding:2px;gap:2px}
.eco-seg button{padding:3px 8px;border-radius:6px;font-size:12px;font-weight:600;color:var(--ink-2)}
.eco-seg button.on{background:var(--ink);color:var(--paper)}
.eco-card{background:var(--paper-2);border-radius:12px;padding:9px 11px;margin-bottom:8px}
.eco-card .hd{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.eco-card .t{font-weight:700;font-size:13.5px}
.eco-card .s{font-size:11.5px;color:var(--ink-3)}
.eco-card .r{margin-left:auto;font-family:var(--f-num);font-weight:700;white-space:nowrap}
.eco-card .ln{display:flex;gap:8px;align-items:center;font-size:12px;color:var(--ink-2);margin-top:5px;flex-wrap:wrap}
.eco-mini{height:24px;padding:0 8px;border-radius:7px;background:var(--paper-3);font-size:12px;font-weight:600}
.eco-mini:hover{background:var(--rule)}
.eco-budget{padding:8px 0;border-bottom:1px solid var(--rule)}
.eco-budget .top{display:grid;grid-template-columns:70px 1fr 50px;gap:8px;align-items:center}
.eco-budget .top label{font-weight:700;font-size:13px}
.eco-budget .top .val{font-family:var(--f-num);font-weight:700;text-align:right;white-space:nowrap}
.eco-good.mini{display:flex;align-items:center;gap:8px;padding:6px 0;font-size:12.5px}
.eco-good.mini .px{font-size:13px}
.eco-budget .info{display:flex;justify-content:space-between;gap:8px;font-size:11.5px;color:var(--ink-3);margin-top:2px;line-height:1.35}
.eco-budget .info b{color:var(--ink-2);font-weight:600}
.eco-tax{display:grid;grid-template-columns:minmax(0,1fr) repeat(3,70px);gap:6px;align-items:center;font-size:12.5px}
.eco-tax .h{font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);font-weight:700;text-align:center;line-height:1.2}
.eco-tax .z{display:flex;align-items:center;gap:6px;font-weight:700;white-space:nowrap;overflow:hidden}
.eco-tax .c{display:flex;align-items:center;justify-content:center;gap:2px;background:var(--paper-2);border-radius:8px;padding:3px 2px}
.eco-tax .c .n{font-family:var(--f-num);font-weight:700;min-width:30px;text-align:center}
.eco-tax .c .n.up{color:var(--bad)}.eco-tax .c .n.dn{color:var(--good)}
.eco-tax .c button{width:20px;height:20px;border-radius:6px;font-weight:700;color:var(--ink-2);display:grid;place-items:center}
.eco-tax .c button:hover{background:var(--paper-3)}
.eco-tax .c.base{background:transparent}
.eco-sankey{width:100%;height:200px;display:block}
.eco-spark{width:70px;height:22px;display:block;flex:none}
.eco-insp{margin:10px 0 6px;padding:9px 10px;background:var(--paper-2);border-radius:10px}
.eco-insp h3{margin:0 0 6px;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3);font-weight:700}
.eco-insp .kv{font-size:12.5px}
.eco-insp .kv .v{font-size:13.5px}
.eco-insp p{margin:6px 0 0;font-size:12px;color:var(--ink-2);line-height:1.4}
`;
  document.head.appendChild(s);
}

// ---------------------------------------------------------------- Zustand der Oberfläche
const view = { tab: 'overview', chart: 'trade' };
const CHARTS = [
  ['trade', 'Handel €', '#10a9a3', (e) => e.exp + e.loc + e.mkt - e.raw, (v) => fmtMoney(v)],
  ['sup', 'Versorgung', '#4c9be8', (e) => e.sup, (v) => Math.round(v) + ' %'],
  ['sal', 'Absatz', '#e3a925', (e) => e.sal, (v) => Math.round(v) + ' %'],
  ['cyc', 'Konjunktur', '#22a866', (e) => e.cyc * 100, (v) => Math.round(v)],
  ['fr', 'Fracht', '#8f5ad8', (e) => e.fr, (v) => Math.round(v) + ' %'],
  ['trade_t', 'Export/Import', '#10a9a3', null, (v) => fmt(v) + ' t', [['Export', '#10a9a3', (e) => e.expT], ['Import', '#9aa3b2', (e) => e.impT]]],
];

// ---------------------------------------------------------------- Ratgeber
function hints(g, S) {
  const t = S.tot, out = [];
  const bad = (text) => out.push(['bad', text]);
  const info = (text) => out.push(['info', text]);
  const good = (text) => out.push(['good', text]);
  if (t.shortCom > 0.08) bad(`Den Läden fehlen ${P(t.shortCom)} ihrer Waren. Mehr Industrie ausweisen, eine Lagerhalle nahe der Läden bauen oder die Frachtkapazität erhöhen.`);
  else if (t.importCom > 0.3) info(`${P(t.importCom)} der Ware in den Läden ist teure Importware. Eigene Fabriken${g.isUnlocked('food_factory') ? ' und eine Lebensmittelfabrik' : ''} machen das Gewerbe glücklicher.`);
  const wanted = [];
  for (const k of GOOD_KEYS) {
    const f = S.flow[k];
    if (f.prod > 5 && f.unsold > f.prod * 0.08) bad(`${GOODS[k].name}: ${T(f.unsold)} am Tag finden keinen Abnehmer. Exportpreis senken (jetzt ${P(S.prices[k])}), eine Lagerhalle bauen oder ${f.exp + f.unsold > marketDemand(g, k) ? 'neue Märkte über Bahn oder Hafen erschließen' : 'mehr Frachtkapazität schaffen'}.`);
    else if (f.exp > 10 && f.unsold < 1 && S.prices[k] < 1.5 && marketDemand(g, k) > f.exp * 1.6) wanted.push(GOODS[k].name);
  }
  if (wanted.length) good(`Der Weltmarkt reißt sich um ${wanted.length > 1 ? wanted.slice(0, -1).join(', ') + ' und ' + wanted[wanted.length - 1] : wanted[0]}. Ein höherer Exportpreis (Reiter „Waren & Preise") bringt mehr Geld pro Tonne.`);
  if (t.freightUse > 0.9 && t.freightCap > 0) bad(`Die Fracht ist zu ${P(t.freightUse)} ausgelastet.${g.hasBuilt('cargo_rail') ? '' : g.isUnlocked('cargo_rail') ? ' Ein Güterbahnhof bringt 900 t am Tag.' : ''}${!g.hasBuilt('cargo_harbor') && g.isUnlocked('cargo_harbor') ? ' Ein Frachthafen am Wasser bringt 2.000 t.' : ''}`);
  for (const b of g.buildings.values()) {
    if (b.zone || !BUILDINGS[b.key]?.output || b.construct < 1) continue;
    const r = S.rec.get(b.id);
    if (!r) continue;
    const d = BUILDINGS[b.key];
    if (r.cap > 0 && r.util < 0.3) bad(`${d.name} steht fast still: kaum ${GOODS[d.input].name}. ${SPEC_HOWTO[d.process]} – dort entstehen ${SPEC_PLURAL[d.process]}${S.buyRaw ? '' : ' –, oder den Zukauf erlauben'}.`);
    else if (r.profit < -10) info(`${d.name} arbeitet mit Verlust (${money(r.profit)}/Tag)${r.impShare > 0.3 ? `: ${P(r.impShare)} der Rohstoffe werden teuer zugekauft. Eigene ${SPEC_PLURAL[d.process]} machen es rentabel` : ''}.`);
  }
  const rawProd = RAW_KEYS.reduce((a, k) => a + S.flow[k].prod, 0);
  for (const k of RAW_KEYS) {
    const key = PROC_KEYS.find((p) => BUILDINGS[p].input === k);
    if (S.flow[k].prod > 60 && !g.hasBuilt(key) && g.isUnlocked(key)) { info(`Deine Betriebe liefern ${T(S.flow[k].prod)} ${GOODS[k].name} am Tag. ${BUILDINGS[key].name} macht daraus ${GOODS[BUILDINGS[key].output].name} – ein Vielfaches wert.`); break; }
  }
  if (S.cycle.value < -0.35 && t.stockCap > 0) info('Rezession: Lagerhallen auf „Füllen" stellen und die Ware im nächsten Aufschwung teurer verkaufen.');
  if (S.cycle.value > 0.45 && t.stock > 50) good('Boom! Ein guter Moment, um Lagerhallen auf „Leeren" zu stellen.');
  if (!g.hasBuilt('warehouse') && g.isUnlocked('warehouse') && g.stats.pop > 600 && (rawProd > 50 || t.shortCom > 0.03)) info('Eine Lagerhalle puffert Schwankungen und beliefert Läden in ihrer Nähe zuerst.');
  if (!out.length) good('Alles im Lot: Die Läden sind versorgt und die Industrie verkauft ihre Ware.');
  const rank = { bad: 0, info: 1, good: 2 };
  return out.sort((a, c) => rank[a[0]] - rank[c[0]]).slice(0, 5);
}

// ---------------------------------------------------------------- Teile
function cycleBox(g, S) {
  const c = S.cycle, v = c.value;
  const fc = cycleForecast(g, 7);
  const fl = cycleLabel(fc);
  const arrow = S.hist.length > 1 ? (v > S.hist[S.hist.length - 2].cyc + 0.01 ? '↗' : v < S.hist[S.hist.length - 2].cyc - 0.01 ? '↘' : '→') : '→';
  const sg = (x, unit = ' %') => `${x > 0 ? '+' : x < 0 ? '−' : '±'}${Math.abs(x)}${unit}`;
  const desc = { Boom: 'Der Weltmarkt reißt sich um Waren.', Aufschwung: 'Die Wirtschaft zieht an.', Stabil: 'Ruhige Wirtschaftslage.', Abschwung: 'Die Nachfrage lässt nach.', Rezession: 'Flaute: weniger Exporte und Steuern.' }[c.label] || '';
  return `<div class="eco-cycle"><div class="hd"><span class="lab">Konjunktur: ${esc(c.label)} ${arrow}</span><span class="sub">${esc(desc)}</span></div>
<div class="trk"><i style="left:${((clamp(v, -1, 1) + 1) / 2) * 100}%"></i><i style="left:${((fc + 1) / 2) * 100}%;opacity:.35;width:4px" title="Prognose in 7 Tagen"></i></div><div class="ends"><span>Rezession</span><span>Prognose 7 Tage: ${esc(fl)}</span><span>Boom</span></div>
<div class="sub" style="margin-top:5px;font-size:11.5px;color:var(--ink-2)">Preise ${sg(Math.round(18 * v))} · Menge ${sg(Math.round(35 * v))} · Steuern G/I/B ${sg(Math.round(10 * v))} · Nachfrage ${sg(Math.round(10 * v), '')}</div></div>`;
}
function kpis(g, S) {
  const t = S.tot, L = S.lines;
  const trade = L.export + L.local + L.market - L.rawbuy;
  const tile = (k, v, d, cls = '') => `<div><div class="k">${k}</div><div class="v ${cls}">${v}</div><div class="d">${d}</div></div>`;
  return `<div class="eco-kpi">
  ${tile('Handel/Tag', money(trade), `Export ${fmtMoney(L.export)}`, trade < 0 ? 'neg' : '')}
  ${tile('Versorgung', P(t.supplyCom ?? 1), `Import ${P(t.importCom || 0)}`, (t.shortCom || 0) > 0.08 ? 'neg' : '')}
  ${tile('Absatz', P(t.salesInd ?? 1), `${T(t.exportT || 0)} Export`, (t.salesInd ?? 1) < 0.85 ? 'neg' : '')}
</div><div class="eco-kpi">
  ${tile('Fracht', P(t.freightUse || 0), `von ${T(t.freightCap || 0)}`, (t.freightUse || 0) > 0.92 ? 'neg' : '')}
  ${tile('Lager', t.stockCap ? T(t.stock) : '–', t.stockCap ? `von ${T(t.stockCap)}` : 'keine Halle')}
  ${tile('Lkw/Tag', fmt(t.trucksDay || 0), 'Lieferfahrten')}
</div>`;
}
function balanceRows(S) {
  const rows = [];
  let maxT = 1;
  for (const k of GOOD_KEYS) { const f = S.flow[k]; maxT = Math.max(maxT, f.prod + f.imp + f.whOut); }
  for (const k of GOOD_KEYS) {
    const f = S.flow[k];
    const tot = f.prod + f.imp + f.whOut;
    if (tot < 1) continue;
    const w = (v) => (v / maxT) * 100;
    const loc = Math.max(0, f.local), exp = Math.max(0, f.exp - f.expWh), wh = Math.max(0, f.whIn), left = Math.max(0, f.unsold), imp = Math.max(0, f.imp);
    rows.push(`<div class="eco-row" title="${esc(GOODS[k].desc)}"><span class="n"><span class="zdot" style="background:${GOODS[k].color};margin-right:5px"></span>${esc(GOODS[k].name)}</span>
<div class="eco-bar" style="background:transparent"><i style="width:${w(loc)}%;background:#22a866"></i><i style="width:${w(exp)}%;background:#10a9a3"></i><i style="width:${w(wh)}%;background:#8f5ad8"></i><i style="width:${w(left)}%;background:#e5483c"></i><i style="width:${w(imp)}%;background:repeating-linear-gradient(135deg,#9aa3b2 0 3px,#c9cfd8 3px 6px)"></i></div>
<span class="v">${fmt(f.prod)} t</span></div>`);
  }
  if (!rows.length) return '<p style="color:var(--ink-3);margin:0;font-size:12.5px">Noch keine Warenströme. Weise Industrie aus – auf Feldern, Wäldern, Erz und Öl entstehen Rohstoffbetriebe.</p>';
  return rows.join('') + '<div class="eco-legend"><span style="--c:#22a866">in der Stadt</span><span style="--c:#10a9a3">Export</span><span style="--c:#8f5ad8">ins Lager</span><span style="--c:#e5483c">unverkauft</span><span style="--c:#9aa3b2">Import</span></div>';
}

// Laufende Wirtschaftseffekte (Karten, Ereignisse) und Marktereignisse als Chips
function activeBox(g, S) {
  const chips = [];
  const seen = new Set();
  for (const e of g.effects) {
    if (!e.key.startsWith('eco') || seen.has(e.label)) continue;
    seen.add(e.label);
    const days = Math.max(1, Math.ceil((e.until - g.time) / 1440));
    chips.push(`<span class="chip ${e.value < 0 && !/Happy|Local/.test(e.key) ? 'no' : e.key === 'ecoHappy' && e.value < 0 ? 'no' : 'ok'}">${esc(e.label)} · ${days} T.</span>`);
  }
  for (const k of GOOD_KEYS) {
    const m = S.market[k];
    if (m.shock) chips.push(`<span class="chip ${m.shock > 0 ? 'ok' : 'no'}">${esc(GOODS[k].name)} ${m.shock > 0 ? '+' : '−'}${Math.round(Math.abs(m.shock) * 100)} % · ${m.shockDays} T.</span>`);
  }
  const p = S.perm;
  const perm = [];
  if (p.market > 1.001) perm.push(`Weltmarkt +${Math.round((p.market - 1) * 100)} %`);
  if (p.proc > 1.001) perm.push(`Betriebe +${Math.round((p.proc - 1) * 100)} %`);
  if (p.storage > 1.001) perm.push(`Lager +${Math.round((p.storage - 1) * 100)} %`);
  if (p.harbor > 1.001) perm.push(`Hafen +${Math.round((p.harbor - 1) * 100)} %`);
  for (const x of perm) chips.push(`<span class="chip">${x} · dauerhaft</span>`);
  return chips.length ? `<div class="sec"><h3>Laufende Effekte</h3><div class="chips" style="margin:0">${chips.join('')}</div></div>` : '';
}

function tabOverview(g, S) {
  const h = hints(g, S);
  const dotCol = { bad: 'var(--bad)', info: 'var(--l-blue)', good: 'var(--good)' };
  return `${kpis(g, S)}
<div class="sec" style="margin-top:12px"><h3>Ratgeber</h3>${h.map(([m, tx]) => `<div class="eco-hint"><span class="dot" style="background:${dotCol[m]}"></span><span>${esc(tx)}</span></div>`).join('')}</div>
${activeBox(g, S)}
<div class="sec"><h3>Warenstrom (t/Tag)</h3><canvas class="eco-sankey" id="eco-sankey"></canvas></div>
<div class="sec"><h3>Verlauf</h3><div class="chart-tabs">${CHARTS.map(([k, n]) => `<button data-act="eco-chart" data-k="${k}" class="${view.chart === k ? 'on' : ''}">${n}</button>`).join('')}</div><canvas class="chart" id="eco-chart"></canvas></div>
<div class="sec"><h3>Warenbilanz</h3>${balanceRows(S)}</div>
<div class="acts" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn small ghost" data-act="eco-view">${SVG_CRATES} Infoansicht „Waren"</button><button class="btn small ghost" data-act="eco-openbudget">Haushalt öffnen</button></div>`;
}

function tabGoods(g, S) {
  const t = S.tot;
  const later = [];
  const cards = GOOD_KEYS.map((k, gi) => {
    const G = GOODS[k], f = S.flow[k], m = S.market[k];
    const active = f.prod > 0.5 || f.exp > 0.5 || f.need > 0.5;
    const wp = worldPrice(g, k);
    const idx = m.idx * (1 + (m.shock || 0));
    const trend = m.trend > 0.004 ? '↗' : m.trend < -0.004 ? '↘' : '→';
    const shock = m.shock ? `<span class="tag" style="background:${m.shock > 0 ? '#dcefe2' : '#f6dcd8'};color:${m.shock > 0 ? '#1f6e40' : '#9e2b23'}">${m.shock > 0 ? '+' : '−'}${Math.round(Math.abs(m.shock) * 100)} % · ${m.shockDays} T.</span>` : '';
    const px = `<canvas class="eco-spark" data-spark="${gi}" data-col="${G.color}" style="margin-left:auto"></canvas><span class="px" title="Weltmarktpreis je Tonne (Index ${idx.toFixed(2).replace('.', ',')})">${wp.toFixed(2).replace('.', ',')} € ${trend}</span>`;
    if (!active) {
      later.push(`<div class="eco-good mini off"><span class="zdot" style="background:${G.color}"></span><b>${esc(G.name)}</b><span class="eco-note" style="margin:0">${esc(G.from)}</span>${shock}${px}</div>`);
      return '';
    }
    const D = marketDemand(g, k);
    const p = S.prices[k];
    const realized = wp * p * (1 + (t.routeBonus || 0));
    return `<div class="eco-good">
  <div class="hd"><span class="zdot" style="background:${G.color}"></span><b>${esc(G.name)}</b><span class="tier">${TIER[G.tier]}</span>${px}</div>
  <div class="nums">${shock}<span>erzeugt <b>${T(f.prod)}</b></span><span>Stadt <b>${T(f.local)}</b></span><span>Export <b>${T(f.exp)}</b></span>${f.imp > 0.5 ? `<span>Import <b>${T(f.imp)}</b></span>` : ''}${f.unsold > 0.5 ? `<span style="color:var(--bad)">liegt <b style="color:var(--bad)">${T(f.unsold)}</b></span>` : ''}</div>
  <div class="eco-price"><span>Preis</span><input type="range" min="70" max="150" step="5" value="${Math.round(p * 100)}" data-eco-price="${k}" aria-label="Exportpreis ${esc(G.name)}"${S.autoPrice ? ' disabled title="Die Handelskammer stellt den Preis ein"' : ''}><span class="val">${Math.round(p * 100)} %</span></div>
  <div class="eco-note" data-eco-pricenote="${k}">Weltmarkt nimmt bis ${T(D)} am Tag · ${realized.toFixed(2).replace('.', ',')} € je t${f.exp > 0.5 ? ` · <span style="white-space:nowrap">Erlös ${fmtMoney(f.exp * realized)}/Tag</span>` : ''}</div>
</div>`;
  }).join('') + (later.length ? `<div class="sec" style="margin:12px 0 0"><h3>Noch nicht in deiner Stadt</h3>${later.join('')}</div>` : '');
  return `<p style="margin:0 0 6px;font-size:12.5px;color:var(--ink-2);line-height:1.45">Der Preis gilt für den Export. <b>Höher</b> bringt mehr pro Tonne, aber der Weltmarkt nimmt weniger ab – bleibt Ware liegen, drückt das auf die Stimmung in der Industrie. <b>Niedriger</b> verkauft mehr.</p>
<div class="toggle"><button class="switch${S.autoPrice ? ' on' : ''}" data-act="eco-autoprice" aria-label="Preise automatisch"></button><div class="grow"><div class="t">Handelskammer passt Preise an</div><div class="s">Jeden Tag 5 % billiger, wenn Ware liegen bleibt, 5 % teurer, wenn der Weltmarkt mehr will. Die Regler zeigen dann ihre Wahl.</div></div></div>
<div class="toggle"><button class="switch${S.buyRaw ? ' on' : ''}" data-act="eco-buyraw" aria-label="Rohstoffe zukaufen"></button><div class="grow"><div class="t">Rohstoffe zukaufen</div><div class="s">Verarbeitungsbetriebe kaufen fehlende Rohstoffe am Weltmarkt (${fmtMoney(S.lines.rawbuy)} gestern). Das kostet Geld und Frachtkapazität.</div></div></div>
${cards}
<div class="acts" style="margin-top:10px"><button class="btn small ghost" data-act="eco-price-reset">Alle Preise auf 100 %</button></div>`;
}

function meter(used, cap, col, warnFull = true) {
  const f = cap > 0 ? clamp(used / cap, 0, 1) : 0;
  return `<div class="meter"><i style="width:${f * 100}%;background:${warnFull && f > 0.95 ? 'var(--bad)' : col}"></i></div>`;
}
function tabLogistics(g, S) {
  const t = S.tot;
  const lines = [
    ['Lkw über die Autobahn', t.truckUsed, t.truckCap, '#e3a925', 'Grundkapazität wächst mit der Stadt, sinkt bei Stau.'],
    ['Güterbahnhof', t.railUsed, t.railCap, '#2f8fe0', g.hasBuilt('cargo_rail') ? `+${Math.round(BUILDINGS.cargo_rail.priceBonus * 100)} % Exportpreis, neue Märkte` : g.isUnlocked('cargo_rail') ? 'Noch keiner gebaut (Kategorie Logistik)' : `ab „${MILESTONES[BUILDINGS.cargo_rail.unlock].name}"`],
    ['Frachthafen', t.harborUsed, t.harborCap, '#10a9a3', g.hasBuilt('cargo_harbor') ? `+${Math.round(BUILDINGS.cargo_harbor.priceBonus * 100)} % Exportpreis, Weltmarkt` : g.isUnlocked('cargo_harbor') ? 'Noch keiner gebaut – muss am Wasser stehen' : `ab „${MILESTONES[BUILDINGS.cargo_harbor.unlock].name}"`],
  ];
  const freight = lines.map(([n, u, c, col, note]) => `<div style="margin-bottom:8px"><div class="kv"><span>${n}</span><span class="v">${c > 0 ? `${fmt(u || 0)} / ${fmt(c)} t` : '–'}</span></div>${meter(u || 0, c || 0, col)}<div class="eco-note">${esc(note)}</div></div>`).join('');
  const whs = [], procs = [], others = [];
  for (const b of g.buildings.values()) {
    if (b.zone) continue;
    const d = BUILDINGS[b.key];
    const r = S.rec.get(b.id);
    if (!d || !r) continue;
    const goto = `<button class="eco-mini" data-act="eco-goto" data-id="${b.id}" title="Zum Gebäude springen">Zeigen</button>`;
    if (r.kind === 'wh') {
      const ws = S.wh[b.id] || { mode: 'balance', good: 'auto', stock: {} };
      const segs = GOOD_KEYS.filter((k) => (ws.stock[k] || 0) > 0.5).map((k) => `<i style="width:${(ws.stock[k] / r.cap) * 100}%;background:${GOODS[k].color}" title="${esc(GOODS[k].name)} ${T(ws.stock[k])}"></i>`).join('');
      const list = GOOD_KEYS.filter((k) => (ws.stock[k] || 0) > 0.5).map((k) => `${esc(GOODS[k].name)} ${fmt(ws.stock[k])}`).join(' · ');
      whs.push(`<div class="eco-card"><div class="hd"><span class="t">${esc(d.name)}</span><span class="s">${fmt(r.used || 0)} / ${fmt(r.cap)} t</span><span class="r">${goto}</span></div>
<div class="eco-bar">${segs}</div><div class="eco-note">${list || 'leer'}${b.construct < 1 ? ' · im Bau' : ''}</div>
<div class="ln"><span class="eco-seg">${Object.entries(WH_MODES).map(([m, n]) => `<button data-act="eco-whmode" data-id="${b.id}" data-m="${m}" class="${ws.mode === m ? 'on' : ''}">${n}</button>`).join('')}</span><button class="eco-mini" data-act="eco-whgood" data-id="${b.id}" title="Welche Ware die Halle annimmt">${ws.good === 'auto' ? 'Alle Waren' : esc(GOODS[ws.good].name)} ▸</button></div></div>`);
    } else if (r.kind === 'proc') {
      const inp = GOODS[d.input].name, outp = GOODS[d.output].name;
      procs.push(`<div class="eco-card"><div class="hd"><span class="t">${esc(d.name)}</span><span class="r ${r.profit < 0 ? 'neg' : 'pos'}">${money(r.profit || 0)}/Tag</span></div>
<div class="kv" style="font-size:12.5px;margin-bottom:3px"><span>${esc(inp)} verarbeitet</span><span class="v">${fmt(r.in || 0)} / ${fmt(d.throughput)} t</span></div>
${meter(r.in || 0, d.throughput, '#e8892c', false)}
<div class="kv" style="font-size:12.5px;margin-top:4px"><span>${esc(outp)} erzeugt</span><span class="v">${T(r.out || 0)}</span></div>
<div class="ln"><span>Personal ${P(r.staff ?? 1)} · Zukauf ${P(r.impShare || 0)} · Absatz ${P(r.sales ?? 1)}</span><span style="margin-left:auto">${goto}</span></div></div>`);
    } else if (r.kind === 'cargo') {
      others.push(`<div class="eco-card"><div class="hd"><span class="t">${esc(d.name)}</span><span class="r">${P(r.util || 0)}</span></div>${meter(r.used || 0, r.cap || 0, '#2f8fe0')}<div class="ln"><span>Umschlag ${fmt(r.used || 0)} / ${fmt(r.cap || 0)} t am Tag</span><span style="margin-left:auto">${goto}</span></div></div>`);
    } else if (r.kind === 'market') {
      others.push(`<div class="eco-card"><div class="hd"><span class="t">${esc(d.name)}</span><span class="r ${r.profit < 0 ? 'neg' : 'pos'}">${money(r.profit || 0)}/Tag</span></div>${meter(r.in || 0, r.need || d.goodsDemand, '#a3c13a', false)}<div class="ln"><span>Regionale Ware ${fmt(r.in || 0)} / ${fmt(r.need || d.goodsDemand)} t</span><span style="margin-left:auto">${goto}</span></div></div>`);
    }
  }
  return `<div class="sec"><h3>Frachtkapazität · ${P(t.freightUse || 0)} genutzt</h3>${freight}
<div class="eco-note">Heute: ${T(t.importT || 0)} Import${t.rawImportT > 0.5 ? ` (davon ${T(t.rawImportT)} Rohstoffe)` : ''} · ${T(t.exportT || 0)} Export · Exportpreis-Bonus +${((t.routeBonus || 0) * 100).toFixed(0)} % · Reichweite ${(t.reach || 1).toFixed(1).replace('.', ',')}×</div></div>
<div class="sec"><h3>Lagerhallen</h3>${whs.join('') || `<p style="color:var(--ink-3);margin:0;font-size:12.5px">${g.isUnlocked('warehouse') ? 'Noch keine Lagerhalle gebaut.' : `Lagerhallen ab „${MILESTONES[BUILDINGS.warehouse.unlock].name}".`}</p>`}
<div class="eco-note" style="margin-top:4px"><b>Ausgleich:</b> nimmt Überschüsse, hält bei niedrigen Preisen zurück, verkauft bei hohen und beliefert Läden. <b>Füllen:</b> lagert ein, gibt nichts ab. <b>Leeren:</b> verkauft den Bestand zuerst.</div></div>
<div class="sec"><h3>Verarbeitung</h3>${procs.join('') || `<p style="color:var(--ink-3);margin:0;font-size:12.5px">${g.isUnlocked('food_factory') ? 'Noch kein Verarbeitungsbetrieb. Lebensmittelfabrik, Sägewerk, Stahlwerk und Raffinerie machen aus Rohstoffen wertvolle Waren.' : `Verarbeitung ab „${MILESTONES[BUILDINGS.food_factory.unlock].name}".`}</p>`}</div>
${others.length ? `<div class="sec"><h3>Umschlag & Markthallen</h3>${others.join('')}</div>` : ''}
<div class="sec"><h3>Arbeitsplätze</h3><div class="kv" style="font-size:12.5px"><span>in städtischen Betrieben</span><span class="v">${fmt(S.jobs || 0)}</span><span>besetzt</span><span class="v">${P(t.staff ?? 1)}</span><span>Leistung durch Budget Logistik</span><span class="v">${P(t.logEff || 1)}</span></div></div>`;
}

function tabBudgets(g) {
  const rows = BUDGET_CATS.map((c) => {
    const v = budgetOf(g, c.id);
    const base = categoryUpkeep(g, c.id);
    return `<div class="eco-budget"><div class="top"><label>${c.name}</label><input type="range" min="50" max="150" step="5" value="${Math.round(v * 100)}" data-eco-budget="${c.id}" aria-label="Budget ${c.name}"><span class="val" data-eco-bval="${c.id}">${Math.round(v * 100)} %</span></div>
<div class="info"><span data-eco-beff="${c.id}">${esc(c.effect(v))}</span><b data-eco-bcost="${c.id}" data-base="${base}">${fmtMoney(base * v)}/Tag</b></div><div class="eco-note">${esc(c.what)}</div></div>`;
  }).join('');
  let total = 0, total100 = 0;
  for (const c of BUDGET_CATS) { const b = categoryUpkeep(g, c.id); total += b * budgetOf(g, c.id); total100 += b; }
  return `<p style="margin:0 0 4px;font-size:12.5px;color:var(--ink-2);line-height:1.45">Mehr Budget heißt mehr Leistung – und höhere Kosten. Weniger spart Geld, bis die Kapazität nicht mehr reicht. Die Wirkung setzt sofort ein.${g.sandbox ? ' Im Sandkasten kostet der Unterhalt nichts.' : ''}</p>
${rows}
<div class="row"><span class="grow" style="font-weight:700">Unterhalt gesamt</span><span class="val">${fmtMoney(total)}/Tag</span></div>
<div class="eco-note">Bei 100 % wären es ${fmtMoney(total100)} – ${total > total100 ? 'Mehrkosten' : 'Ersparnis'} ${fmtMoney(Math.abs(total - total100))} am Tag.</div>
<div class="acts" style="margin-top:10px"><button class="btn small ghost" data-act="eco-budget-reset">Alle auf 100 %</button></div>`;
}

function tabTaxes(g, S) {
  const counts = { 1: [0, 0, 0], 2: [0, 0, 0], 3: [0, 0, 0], 4: [0, 0, 0] };
  for (const b of g.buildings.values()) {
    if (!b.zone || b.abandoned) continue;
    counts[b.zone][b.level <= 2 ? 0 : b.level >= 4 ? 2 : 1]++;
  }
  const cell = (z, k) => {
    const d = S.dens[z][k];
    const eff = clamp(g.taxes[z] + d, 0, 30);
    return `<div class="c"><button data-act="eco-dens" data-z="${z}" data-k="${k}" data-d="-1" aria-label="weniger">−</button><span class="n ${d > 0 ? 'up' : d < 0 ? 'dn' : ''}" title="${d ? (d > 0 ? '+' : '') + d + ' Punkte zum Grundsatz' : 'wie Grundsatz'}">${eff} %</span><button data-act="eco-dens" data-z="${z}" data-k="${k}" data-d="1" aria-label="mehr">+</button></div>`;
  };
  const rows = [1, 2, 3, 4].map((z) => `<div class="z"><span class="zdot" style="background:${hexS(ZONE_INFO[z].color)}"></span>${ZONE_INFO[z].name}</div>${cell(z, 0)}<div class="c base"><span class="n">${g.taxes[z]} %</span></div>${cell(z, 1)}
<div class="eco-note" style="grid-column:1/-1;margin:-3px 0 4px">Gebäude: ${counts[z][0]} klein · ${counts[z][1]} mittel · ${counts[z][2]} groß${S.densAvg[z] ? ` · Ø ${S.densAvg[z] > 0 ? '+' : ''}${S.densAvg[z].toFixed(1).replace('.', ',')} Punkte` : ''}</div>`).join('');
  const L = S.lines;
  return `<p style="margin:0 0 10px;font-size:12.5px;color:var(--ink-2);line-height:1.45">Der Grundsatz je Zone gilt für Stufe 3 und wird im Haushalt eingestellt. Für kleine Häuser (Stufe 1–2) und große Gebäude (Stufe 4–5) gibt es Zuschläge oder Nachlässe bis ±5 Punkte: Ein Zuschlag bringt Geld, kostet aber 1,7 Glück je Punkt und dämpft die Nachfrage.</p>
<div class="eco-tax"><span></span><span class="h">Stufe 1–2<br>gering</span><span class="h">Stufe 3<br>Grundsatz</span><span class="h">Stufe 4–5<br>hoch</span>${rows}</div>
<div class="rule" style="margin:10px 0"></div>
<div class="kv"><span>Dichte-Zuschläge</span><span class="v ${L.density < 0 ? 'neg' : ''}">${money(L.density)}/Tag</span><span>Konjunktur (Steuern G/I/B)</span><span class="v ${L.cycle < 0 ? 'neg' : ''}">${money(L.cycle)}/Tag</span></div>
<div class="acts" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn small ghost" data-act="eco-dens-reset">Zuschläge zurücksetzen</button><button class="btn small ghost" data-act="eco-openbudget">Grundsätze im Haushalt</button></div>`;
}

// ---------------------------------------------------------------- Diagramme
function drawSankey(canvas, L) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 340, h = canvas.clientHeight || 200;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  const nodes = {
    raw: { col: 0, name: 'Rohstoffe', color: '#93b52f' }, imp: { col: 0, name: 'Import', color: '#9aa3b2' }, whS: { col: 0, name: 'aus Lager', color: '#8f5ad8' },
    proc: { col: 1, name: 'Verarbeitung', color: '#e8892c' },
    fac: { col: 2, name: 'Fabriken', color: '#d9a21b' },
    shop: { col: 3, name: 'Läden', color: '#4c9be8' }, exp: { col: 3, name: 'Export', color: '#10a9a3' }, whT: { col: 3, name: 'ins Lager', color: '#a884dc' }, left: { col: 3, name: 'liegt', color: '#e5483c' },
  };
  const v = (k) => Math.max(0, (L && L[k]) || 0);
  const links = [
    ['raw', 'proc', v('rawProc')], ['imp', 'proc', v('impProc')], ['whS', 'proc', v('whProc')],
    ['raw', 'shop', v('rawShop')], ['raw', 'exp', v('rawExp')], ['raw', 'whT', v('rawWh')], ['raw', 'left', v('rawLeft')],
    ['proc', 'fac', v('procFac')], ['whS', 'fac', v('whFac')],
    ['proc', 'shop', v('procShop')], ['proc', 'exp', v('procExp')], ['proc', 'whT', v('procWh')], ['proc', 'left', v('procLeft')],
    ['fac', 'shop', v('facShop')], ['fac', 'exp', v('facExp')], ['fac', 'whT', v('facWh')], ['fac', 'left', v('facLeft')],
    ['imp', 'shop', v('impShop')], ['whS', 'shop', v('whShop')], ['whS', 'exp', v('whExp')],
  ].filter((l) => l[2] > 0.5);
  ctx.font = '600 11px "Stadtpuls Text", Nunito, sans-serif';
  if (!links.length) {
    ctx.fillStyle = '#7a8294';
    ctx.fillText('Noch keine Warenströme – weise Industrie und Gewerbe aus.', 6, h / 2);
    return;
  }
  for (const n of Object.values(nodes)) { n.in = 0; n.out = 0; }
  for (const [a, b, x] of links) { nodes[a].out += x; nodes[b].in += x; }
  const nw = 9, padT = 6, padB = 6, gap = 10;
  const cols = [[], [], [], []];
  for (const [id, n] of Object.entries(nodes)) { n.v = Math.max(n.in, n.out); n.id = id; if (n.v > 0.5) cols[n.col].push(n); }
  let scale = 1e9;
  for (const c of cols) if (c.length) { const tot = c.reduce((a, n) => a + n.v, 0); scale = Math.min(scale, (h - padT - padB - gap * (c.length - 1)) / tot); }
  const xs = [4, w * 0.36 - nw / 2, w * 0.62 - nw / 2, w - nw - 4];
  for (let ci = 0; ci < 4; ci++) {
    const c = cols[ci];
    const tot = c.reduce((a, n) => a + Math.max(2, n.v * scale), 0) + gap * (c.length - 1);
    let y = padT + (h - padT - padB - tot) / 2;
    for (const n of c) { n.x = xs[ci]; n.y = y; n.h = Math.max(2, n.v * scale); n.oy = n.y; n.iy = n.y; y += n.h + gap; }
  }
  // Bänder (nach Ziel sortiert, damit sie sich wenig kreuzen)
  links.sort((p, q) => nodes[p[1]].y - nodes[q[1]].y || nodes[p[0]].y - nodes[q[0]].y);
  for (const [a, b, x] of links) {
    const A = nodes[a], B = nodes[b];
    if (!A.x && A.x !== 0) continue;
    const ha = Math.max(1, x * scale), hb = ha;
    const x0 = A.x + nw, x1 = B.x;
    const y0 = A.oy, y1 = B.iy;
    A.oy += ha; B.iy += hb;
    const mx = (x0 + x1) / 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(mx, y0, mx, y1, x1, y1);
    ctx.lineTo(x1, y1 + hb);
    ctx.bezierCurveTo(mx, y1 + hb, mx, y0 + ha, x0, y0 + ha);
    ctx.closePath();
    ctx.fillStyle = A.color + '55';
    ctx.fill();
  }
  // Knoten und Beschriftung
  for (const c of cols) for (const n of c) {
    ctx.fillStyle = n.color;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(n.x, n.y, nw, n.h, 3); else ctx.rect(n.x, n.y, nw, n.h);
    ctx.fill();
    const right = n.col < 3;
    const tx = right ? n.x + nw + 5 : n.x - 5;
    const ty = n.y + n.h / 2;
    ctx.textAlign = right ? 'left' : 'right';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(246,242,234,0.92)';
    ctx.font = '700 11px "Stadtpuls Text", Nunito, sans-serif';
    const label = n.name, val = `${fmt(n.v)} t`;
    const two = n.h >= 22;
    ctx.strokeText(label, tx, two ? ty - 2 : ty + 4);
    ctx.fillStyle = '#1d2330';
    ctx.fillText(label, tx, two ? ty - 2 : ty + 4);
    if (two) {
      ctx.font = '600 10.5px "Stadtpuls Rund", Fredoka, sans-serif';
      ctx.strokeText(val, tx, ty + 10);
      ctx.fillStyle = '#4a5263';
      ctx.fillText(val, tx, ty + 10);
    }
  }
}
// Mehrere Linien in einem Diagramm (gleiche Optik wie ui/charts.js), mit kleiner Legende oben rechts
function drawMulti(canvas, series, opts = {}) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 300, h = canvas.clientHeight || 120;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  const ink = '#7a8294';
  const padL = 44, padR = 8, padT = 16, padB = 18;
  const n = Math.max(...series.map((s) => s.values.length));
  ctx.font = '600 11px "Stadtpuls Rund", Fredoka, sans-serif';
  if (n < 1) { ctx.fillStyle = ink; ctx.fillText('Noch keine Daten – ein Spieltag vergeht in 30 Sekunden.', 8, h / 2); return; }
  let max = 1;
  for (const s of series) for (const v of s.values) max = Math.max(max, v);
  const X = (i) => padL + (n === 1 ? 0 : (i / (n - 1)) * (w - padL - padR));
  const Y = (v) => padT + (1 - v / max) * (h - padT - padB);
  ctx.strokeStyle = 'rgba(29,35,48,0.08)'; ctx.lineWidth = 1; ctx.fillStyle = ink; ctx.textAlign = 'right';
  for (let k = 0; k <= 3; k++) {
    const v = (max * k) / 3, y = Y(v);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    ctx.fillText(opts.fmt ? opts.fmt(v) : Math.round(v), padL - 6, y + 4);
  }
  ctx.textAlign = 'left'; ctx.fillText(opts.startLabel || '', padL, h - 4);
  ctx.textAlign = 'right'; ctx.fillText(opts.endLabel || '', w - padR, h - 4);
  let lx = w - padR;
  for (const s of [...series].reverse()) {
    ctx.textAlign = 'right'; ctx.fillStyle = s.col; ctx.fillText(s.name, lx, 10);
    lx -= ctx.measureText(s.name).width + 6;
    ctx.fillRect(lx - 8, 4, 8, 5); lx -= 16;
  }
  for (const s of series) {
    if (!s.values.length) continue;
    ctx.beginPath();
    s.values.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
    ctx.strokeStyle = s.col; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.stroke();
  }
}
function drawSpark(canvas, values, color) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 70, h = canvas.clientHeight || 22;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  if (values.length < 2) return;
  let min = Math.min(...values, 0.9), max = Math.max(...values, 1.1);
  const X = (i) => 2 + (i / (values.length - 1)) * (w - 4);
  const Y = (v) => h - 3 - ((v - min) / (max - min)) * (h - 6);
  ctx.strokeStyle = 'rgba(29,35,48,0.18)';
  ctx.setLineDash([2, 2]);
  ctx.beginPath(); ctx.moveTo(2, Y(1)); ctx.lineTo(w - 2, Y(1)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
  ctx.beginPath();
  values.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(X(values.length - 1), Y(values[values.length - 1]), 2.2, 0, Math.PI * 2); ctx.fill();
}

// ---------------------------------------------------------------- Panel
registerPanel({
  id: 'economy',
  title: 'Wirtschaft',
  icon: SVG_FACTORY,
  order: 15,
  render(ui) {
    injectStyle();
    const g = ui.g, S = g.ext.industry;
    if (!S) return '<p>Die Wirtschaft startet mit dem ersten Spieltag.</p>';
    const tabs = [['overview', 'Übersicht'], ['goods', 'Waren & Preise'], ['logistics', 'Logistik'], ['budgets', 'Budgets'], ['taxes', 'Steuern']];
    const body = view.tab === 'goods' ? tabGoods(g, S) : view.tab === 'logistics' ? tabLogistics(g, S) : view.tab === 'budgets' ? tabBudgets(g) : view.tab === 'taxes' ? tabTaxes(g, S) : tabOverview(g, S);
    return `<div class="eco-tabs">${tabs.map(([k, n]) => `<button data-act="eco-tab" data-k="${k}" class="${view.tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>${cycleBox(g, S)}${body}`;
  },
  click(ui, act, el) {
    const g = ui.g, S = g.ext.industry;
    const ds = el.dataset;
    switch (act) {
      case 'eco-tab': view.tab = ds.k; break;
      case 'eco-chart': view.chart = ds.k; break;
      case 'eco-buyraw': setBuyRaw(g, !S.buyRaw); break;
      case 'eco-autoprice': setAutoPrice(g, !S.autoPrice); ui.toast(S.autoPrice ? 'Die Handelskammer kümmert sich jetzt um die Exportpreise.' : 'Exportpreise wieder selbst steuern.'); break;
      case 'eco-whmode': setWarehouseMode(g, +ds.id, ds.m); break;
      case 'eco-whgood': cycleWarehouseGood(g, +ds.id); break;
      case 'eco-dens': setDensityTax(g, +ds.z, +ds.k, S.dens[+ds.z][+ds.k] + +ds.d); break;
      case 'eco-dens-reset': for (const z of [1, 2, 3, 4]) { setDensityTax(g, z, 0, 0); setDensityTax(g, z, 1, 0); } break;
      case 'eco-budget-reset': for (const c of BUDGET_CATS) setServiceBudget(g, c.id, 1); ui.toast('Alle Dienstbudgets auf 100 %.'); break;
      case 'eco-price-reset': for (const k of GOOD_KEYS) setExportPrice(g, k, 1); break;
      case 'eco-openbudget': ui.openPanel('budget'); break;
      case 'eco-view': ui.setView(ui.view === 'goods' ? 'none' : 'goods'); break;
      case 'eco-goto': {
        const b = g.buildings.get(+ds.id);
        if (!b) break;
        ui.closePanels();
        ui.app.engine.rig.focus(b.x + b.w / 2 - g.W / 2, b.y + b.h / 2 - g.H / 2, 16);
        ui.inspect({ type: 'building', id: b.id });
        break;
      }
    }
  },
  afterRender(ui) {
    const g = ui.g, S = g.ext.industry;
    if (!S) return;
    const root = ui.el.panel;
    const sk = root.querySelector('#eco-sankey');
    if (sk) drawSankey(sk, S.links);
    const ch = root.querySelector('#eco-chart');
    if (ch) {
      const def = CHARTS.find((c) => c[0] === view.chart) || CHARTS[0];
      const h = S.hist;
      const labels = { startLabel: h.length ? `Tag ${h[0].d}` : '', endLabel: h.length ? `Tag ${h[h.length - 1].d}` : '' };
      if (def[5]) drawMulti(ch, def[5].map(([name, col, fn]) => ({ name, col, values: h.map(fn) })), { ...labels, fmt: def[4] });
      else drawLineChart(ch, h.map(def[3]), { color: def[2], zero: def[0] === 'trade' || def[0] === 'cyc', ...labels, fmt: def[4] });
    }
    for (const c of root.querySelectorAll('canvas[data-spark]')) {
      const gi = +c.dataset.spark;
      drawSpark(c, S.hist.slice(-40).map((e) => (e.px ? e.px[gi] : 1)), c.dataset.col);
    }
    // Schieberegler: Preise
    for (const inp of root.querySelectorAll('input[data-eco-price]')) {
      inp.addEventListener('input', () => {
        const k = inp.dataset.ecoPrice;
        setExportPrice(g, k, +inp.value / 100);
        inp.nextElementSibling.textContent = `${inp.value} %`;
        const note = root.querySelector(`[data-eco-pricenote="${k}"]`);
        if (note) note.textContent = `Weltmarkt nimmt bis ${T(marketDemand(g, k))} am Tag · ${(worldPrice(g, k) * S.prices[k] * (1 + (S.tot.routeBonus || 0))).toFixed(2).replace('.', ',')} € je t`;
      });
    }
    // Schieberegler: Dienstbudgets
    for (const inp of root.querySelectorAll('input[data-eco-budget]')) {
      inp.addEventListener('input', () => {
        const id = inp.dataset.ecoBudget;
        const v = +inp.value / 100;
        setServiceBudget(g, id, v);
        const cat = BUDGET_CATS.find((c) => c.id === id);
        root.querySelector(`[data-eco-bval="${id}"]`).textContent = `${inp.value} %`;
        root.querySelector(`[data-eco-beff="${id}"]`).textContent = cat.effect(v);
        const cost = root.querySelector(`[data-eco-bcost="${id}"]`);
        cost.textContent = `${fmtMoney(+cost.dataset.base * v)}/Tag`;
      });
      inp.addEventListener('change', () => { ui.renderPanel(); ui.refreshHUD(); });
    }
  },
});

// ---------------------------------------------------------------- Infoansicht „Waren"
registerOverlay({
  id: 'goods', name: 'Waren', icon: SVG_CRATES,
  text: 'Läden: grün versorgt, rot Warenmangel. Industrie: grün verkauft, rot bleibt liegen. Violett: Lagerhallen nach Füllstand, blau: Güterumschlag.',
  legend: [['#45c46b', 'versorgt · verkauft'], ['#e5483c', 'Mangel · Stau'], ['#8f5ad8', 'Lager'], ['#2f8fe0', 'Umschlag']],
  building: (g, b) => goodsColor(g, b),
});

// ---------------------------------------------------------------- Problemsymbole
registerIcon({
  id: 'eco_short', color: '#f08a24',
  draw(ctx, x, y) {
    // leeres Regal mit einer einsamen Kiste
    ctx.strokeStyle = '#f5a54a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 28, y - 20); ctx.lineTo(x + 28, y - 20); ctx.moveTo(x - 28, y + 6); ctx.lineTo(x + 28, y + 6); ctx.moveTo(x - 28, y + 30); ctx.lineTo(x + 28, y + 30);
    ctx.moveTo(x - 28, y - 30); ctx.lineTo(x - 28, y + 30); ctx.moveTo(x + 28, y - 30); ctx.lineTo(x + 28, y + 30); ctx.stroke();
    ctx.fillStyle = '#f5a54a'; ctx.fillRect(x + 4, y - 8, 16, 14);
  },
});
registerIcon({
  id: 'eco_unsold', color: '#b18fe0',
  draw(ctx, x, y) {
    // gestapelte Kisten mit Pfeil nach unten
    ctx.fillStyle = '#c7a9f0';
    ctx.fillRect(x - 30, y + 4, 26, 24); ctx.fillRect(x - 2, y + 4, 26, 24); ctx.fillRect(x - 16, y - 22, 26, 24);
    ctx.strokeStyle = 'rgba(20,24,32,0.85)'; ctx.lineWidth = 3;
    ctx.strokeRect(x - 30, y + 4, 26, 24); ctx.strokeRect(x - 2, y + 4, 26, 24); ctx.strokeRect(x - 16, y - 22, 26, 24);
    ctx.strokeStyle = '#e5483c'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x + 30, y - 30); ctx.lineTo(x + 30, y - 4); ctx.moveTo(x + 21, y - 13); ctx.lineTo(x + 30, y - 4); ctx.lineTo(x + 39, y - 13); ctx.stroke();
  },
});
BUILDING_PROBLEMS.push((g, b) => {
  const S = g.ext && g.ext.industry;
  const r = S && S.rec.get(b.id);
  if (!r || b.construct < 1) return null;
  if (r.kind === 'shop' && r.need > 0.05 && r.supply < 0.6) return 'eco_short';
  if ((r.kind === 'factory' || r.kind === 'raw') && (r.out || 0) > 0.5 && r.sales < 0.6) return 'eco_unsold';
  if (r.kind === 'proc' && r.cap > 0 && r.util < 0.25) return 'eco_unsold';
  return null;
});

// ---------------------------------------------------------------- Inspektor
// Knöpfe im Inspektor über das Register der Oberfläche (data-act="eco-insp"); der Inspektor zeichnet danach neu
INSPECTOR_ACTIONS['eco-insp'] = (ui, el) => {
  const g = ui.g, id = +el.dataset.id;
  if (el.dataset.ecoInsp === 'mode') setWarehouseMode(g, id, el.dataset.m);
  else if (el.dataset.ecoInsp === 'good') cycleWarehouseGood(g, id);
  else if (el.dataset.ecoInsp === 'panel') { view.tab = el.dataset.tab || 'logistics'; ui.openPanel('economy'); return; }
  ui.app.audio.play('click');
};
INSPECTORS.push((ui, sel) => {
  if (!sel || sel.type !== 'building') return null;
  const g = ui.g, b = g.buildings.get(sel.id);
  if (!b) return null;
  const info = buildingEconomy(g, b);
  if (!info) return null;
  const S = g.ext.industry;
  const kv = (rows) => `<div class="kv">${rows.map(([k, v, cls]) => `<span>${k}</span><span class="v ${cls || ''}">${v}</span>`).join('')}</div>`;
  const box = (title, inner) => `<div class="eco-insp"><h3>${title}</h3>${inner}</div>`;
  const r = info;
  if (r.kind === 'factory') {
    return box('Produktion', kv([
      ['Konsumgüter', `${T(r.out || 0)} am Tag`],
      ['Absatz', P(r.sales ?? 1), (r.sales ?? 1) < 0.8 ? 'neg' : ''],
      ['Vorprodukte aus der Stadt', `${P(r.boost || 0)} → +${Math.round((r.boost || 0) * ECON.inputBoost * 100)} %`],
    ]) + (r.sales < 0.8 ? '<p>Die Ware bleibt liegen. Im Wirtschaftsfenster den Exportpreis für Konsumgüter senken oder mehr Fracht schaffen.</p>' : r.boost < 0.5 && g.isUnlocked('sawmill') ? '<p>Holzwaren, Stahl oder Kunststoff aus der Stadt machen Fabriken bis zu 40 % produktiver.</p>' : ''));
  }
  if (r.kind === 'raw') {
    const k = r.good;
    const rows = [
      ['Erzeugt', `${T(r.out || 0)} am Tag`],
      ['Absatz', P(r.sales ?? 1), (r.sales ?? 1) < 0.8 ? 'neg' : ''],
      ['davon in der Stadt verwendet', P(r.local || 0)],
      ['Weltmarktpreis', `${worldPrice(g, k).toFixed(2).replace('.', ',')} € je t`],
    ];
    if (b.spec === 'farm' && r.season !== undefined && Math.abs(r.season - 1) > 0.01) rows.push([`Ernte im ${esc(SEASON_NAMES[g.ext.weather?.season] || 'Jahr')}`, `${r.season > 1 ? '+' : '−'}${Math.round(Math.abs(r.season - 1) * 100)} %`, r.season < 1 ? 'neg' : 'pos']);
    if ((b.spec === 'mine' || b.spec === 'oil') && r.deposit !== undefined) rows.push(['Vorkommen', P(r.deposit), r.deposit < 0.3 ? 'neg' : '']);
    return box(`${esc(r.specName || 'Rohstoffbetrieb')} · ${esc(GOODS[k].name)}`, kv(rows) + ((b.spec === 'mine' || b.spec === 'oil') && r.deposit < 0.3 ? `<p>Das Vorkommen geht zur Neige – die Förderung sinkt. Neue ${b.spec === 'mine' ? 'Erzfelder' : 'Ölvorkommen'} erschließen.</p>` : '') +((r.local || 0) < 0.3 && !g.hasBuilt(PROC_KEYS.find((p) => BUILDINGS[p].input === k)) ? `<p>Ein ${esc(BUILDINGS[PROC_KEYS.find((p) => BUILDINGS[p].input === k)].name)} würde ${esc(GOODS[k].name)} hier in der Stadt veredeln.</p>` : ''));
  }
  if (r.kind === 'shop') {
    const need = (r.need || 0);
    return box('Warenversorgung', kv([
      ['Bedarf', `${T(need)} am Tag`],
      ['Versorgt', P(r.supply ?? 1), (r.supply ?? 1) < 0.85 ? 'neg' : ''],
      ['Ware aus der Region', P(r.local || 0)],
      ['Importware (teurer)', P(r.imp || 0)],
    ]) + ((r.supply ?? 1) < 0.85 ? `<p>Liegt ${Math.round(r.dist || 0)} Felder von der nächsten Bezugsquelle entfernt und wird zuletzt beliefert. Eine Lagerhalle in der Nähe hilft.${r.shortDays >= 3 ? ` Seit ${r.shortDays} Tagen knapp – das Geschäft droht zu schrumpfen.` : ''}</p>` : ''));
  }
  if (r.kind === 'proc') {
    const d = BUILDINGS[b.key];
    return box('Verarbeitung', kv([
      [`${esc(GOODS[d.input].name)} verarbeitet`, `${fmt(r.in || 0)} / ${fmt(d.throughput)} t`],
      [`${esc(GOODS[d.output].name)} erzeugt`, `${T(r.out || 0)} am Tag`],
      ['Personal', P(r.staff ?? 1)],
      ['Zugekauft', P(r.impShare || 0)],
      ['Ergebnis', `${money(r.profit || 0)}/Tag`, (r.profit || 0) < 0 ? 'neg' : 'pos'],
    ]) + `<p>Rohstoffe kommen von ${esc(SPEC_DATIVE[d.process])} der Stadt${S.buyRaw ? ', fehlende werden am Weltmarkt zugekauft' : ''}.</p><div style="margin-top:6px"><button class="eco-mini" data-act="eco-insp" data-eco-insp="panel" data-tab="logistics" data-id="${b.id}">Im Wirtschaftsfenster ansehen</button></div>`);
  }
  if (r.kind === 'wh') {
    const list = GOOD_KEYS.filter((k) => (r.stock[k] || 0) > 0.5).map((k) => [esc(GOODS[k].name), T(r.stock[k])]);
    return box(`Lager · ${fmt(r.used || 0)} / ${fmt(r.cap || 0)} t`, (list.length ? kv(list) : '<p style="margin:0">leer</p>') + `
<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;align-items:center"><span class="eco-seg">${Object.entries(WH_MODES).map(([m, n]) => `<button data-act="eco-insp" data-eco-insp="mode" data-id="${b.id}" data-m="${m}" class="${r.mode === m ? 'on' : ''}">${n}</button>`).join('')}</span><button class="eco-mini" data-act="eco-insp" data-eco-insp="good" data-id="${b.id}">${r.goodSel === 'auto' ? 'Alle Waren' : esc(GOODS[r.goodSel].name)} ▸</button></div>
<p>Eingang ${T(r.inT || 0)} · Ausgang ${T(r.outT || 0)} am Tag. Läden in der Nähe werden zuerst beliefert.</p>`);
  }
  if (r.kind === 'cargo') {
    const d = BUILDINGS[b.key];
    return box('Güterumschlag', kv([
      ['Umschlag', `${fmt(r.used || 0)} / ${fmt(r.cap || 0)} t am Tag`],
      ['Auslastung', P(r.util || 0), (r.util || 0) > 0.95 ? 'neg' : ''],
      ['Exportpreis-Bonus', `+${Math.round((d.priceBonus || 0) * 100)} %`],
      ['Neue Märkte', `+${(d.reach || 0).toFixed(1).replace('.', ',')}× Reichweite`],
    ]));
  }
  if (r.kind === 'market') {
    return box('Markthalle', kv([
      ['Regionale Ware', `${fmt(r.in || 0)} / ${fmt(r.need || 0)} t`],
      ['Standgebühren', `${fmtMoney(r.rev || 0)}/Tag`],
      ['Ergebnis', `${money(r.profit || 0)}/Tag`, (r.profit || 0) < 0 ? 'neg' : 'pos'],
    ]) + ((r.util || 0) < 0.5 ? '<p>Es fehlt Ernte oder Lebensmittel aus der Stadt – Bauernhöfe oder eine Lebensmittelfabrik beliefern die Halle.</p>' : ''));
  }
  return null;
});

// ---------------------------------------------------------------- Werkzeugleiste
TRAY_ITEMS.push({
  cat: 'industry',
  item(g) {
    const S = g.ext && g.ext.industry;
    const t = S ? S.tot : {};
    return { kind: 'panel', panel: 'economy', name: 'Wirtschaft & Handel', cost: `Fracht ${P(t.freightUse || 0)}`, desc: 'Warenströme, Exportpreise, Lagerhallen, Dienstbudgets und Steuern.', color: '#10a9a3', locked: g.sandbox || g.milestone >= 2 ? null : 'Ab „Kleinstadt" (500 Einwohner)', unlockName: 'Kleinstadt' };
  },
});
