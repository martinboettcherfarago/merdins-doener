// Eingebaute Panels (Haushalt, Statistik, Verordnungen, Pulsbahn, Stadtfunk) im selben Format wie registerPanel:
// { id, title, icon, render(ui) → html, click(ui, act, el) → false = nicht neu zeichnen, input(ui, el), change(ui, el), afterRender(ui) }
import { ZONE_INFO, MILESTONES, POLICIES, LOANS, TRANSIT } from '../config.js';
import { BUDGET_LINES } from '../registry.js';
import { fmt, fmtMoney, fmtShort, clamp } from '../util.js';
import { LINE_COLORS, LINE_COLOR_NAMES } from '../sim/transit.js';
import { icon } from './icons.js';
import { timetableHTML, timetableClick, timetableAfterRender, timetableBusy, TIMETABLE_HINT } from './timetable.js';
import { drawLineChart, svgSpark, barsHTML, meterHTML, svgDonut, chartIndexAt } from './charts.js';
import { STATS_PANEL } from './statshub.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const AV_COLORS = ['#e8543f', '#2f8fe0', '#f2b01e', '#22a866', '#8f5ad8', '#f06fae', '#10a9a3', '#ff8a1f'];
const signed = (v) => `${v >= 0 ? '+' : '−'}${fmtMoney(Math.abs(v))}`;

const INC_LABEL = { res: 'Steuern Wohnen', com: 'Steuern Gewerbe', ind: 'Steuern Industrie', off: 'Steuern Büro', tourism: 'Tourismus', fares: 'U-Bahn-Tickets' };
const EXP_LABEL = { services: 'Dienste & Versorgung', roads: 'Straßenunterhalt', transit: 'U-Bahn', policies: 'Verordnungen', loans: 'Kreditzinsen' };
const INC_COL = { res: '#4fae67', com: '#3a8ad8', ind: '#dba22e', off: '#9466d2', tourism: '#ff8a1f', fares: '#e8543f' };
const EXP_COL = { services: '#e8543f', roads: '#5d6470', transit: '#2f8fe0', policies: '#8f5ad8', loans: '#c98a0c' };
const lineLabel = (id, map) => map[id] || (BUDGET_LINES.find((l) => l.id === id) || {}).label || id;

const budget = {
  id: 'budget', title: 'Haushalt', icon: 'budget',
  render(ui) {
    const g = ui.g, b = g.budget();
    const nets = g.history.map((h) => h.net ?? 0).slice(-30);
    // feste Posten und alle BUDGET_LINES anderer Module (Beträge können negativ sein, z. B. Konjunktur)
    const incItems = Object.entries(b.inc).filter(([, v]) => Math.abs(v || 0) >= 0.5).sort((a, c) => c[1] - a[1]).map(([k, v]) => ({ label: esc(lineLabel(k, INC_LABEL)), value: v, color: v < 0 ? '#d4433a' : INC_COL[k] || '#4fae67', text: (v < 0 ? '−' : '') + fmtMoney(Math.abs(v)) }));
    const expItems = Object.entries(b.exp).filter(([, v]) => Math.abs(v || 0) >= 0.5).sort((a, c) => c[1] - a[1]).map(([k, v]) => ({ label: esc(lineLabel(k, EXP_LABEL)), value: v, color: v < 0 ? '#2b9a57' : EXP_COL[k] || '#e8543f', text: (v < 0 ? '+' : '−') + fmtMoney(Math.abs(v)) }));
    const max = Math.max(1, ...incItems.map((i) => i.value), ...expItems.map((i) => i.value));
    const taxes = [1, 2, 3, 4].map((z) => `<div class="slider tax"><label><span class="zdot" style="background:${hex(ZONE_INFO[z].color)}"></span> ${ZONE_INFO[z].name}</label><input type="range" min="0" max="25" step="1" value="${g.taxes[z]}" data-tax="${z}" id="tax-${z}" style="accent-color:${hex(ZONE_INFO[z].color)}"><span class="val num${g.taxes[z] > 12 ? ' neg' : ''}">${g.taxes[z]} %</span></div>`).join('');
    const loans = g.loans.map((l, i) => `<div class="row"><span class="grow">${fmtMoney(l.amount)} · noch ${l.weeksLeft} Wochen<br><span class="sub">Tilgung ${fmtMoney(l.amount / l.weeks)} + Zinsen ${fmtMoney(l.weekly)} pro Woche</span></span><button class="btn small ghost" data-act="repay" data-i="${i}">Ablösen</button></div>`).join('');
    const offers = LOANS.map((l, i) => `<div class="row"><span class="grow">${fmtMoney(l.amount)} über ${l.weeks} Wochen<br><span class="sub">${(l.rate * 100).toFixed(1).replace('.', ',')} % Zins pro Woche</span></span><button class="btn small" data-act="loan" data-i="${i}" ${g.loans.length >= 3 || !g.isUnlocked('loans') ? 'disabled' : ''}>Aufnehmen</button></div>`).join('');
    return `
<div class="hero ${b.net < 0 ? 'neg' : 'pos'}"><div><div class="k">Saldo pro Tag</div><div class="v num">${signed(b.net)}</div><div class="s">${g.sandbox ? 'Sandkasten' : `Kasse ${fmtMoney(g.money)}`}</div></div>${svgSpark(nets, { w: 130, h: 44, color: b.net < 0 ? '#d4433a' : '#2b9a57', zero: true })}</div>
<div class="sec"><h3>Einnahmen · ${fmtMoney(b.income)}</h3>${incItems.length ? barsHTML(incItems, { max }) : '<p class="empty">Noch keine Einnahmen.</p>'}</div>
<div class="sec"><h3>Ausgaben · ${fmtMoney(b.expense)}</h3>${expItems.length ? barsHTML(expItems, { max }) : '<p class="empty">Noch keine Ausgaben.</p>'}</div>
<div class="sec"><h3>Steuersätze</h3>${taxes}<p class="hint">Über 10 %: weniger Nachfrage und Glück.</p></div>
<div class="sec"><h3>Kredite</h3>${loans || '<p class="empty">Keine Kredite.</p>'}<div class="rule"></div>${g.isUnlocked('loans') ? offers : `<p class="hint">${g.lockReason('zone4')}</p>`}</div>`;
  },
  click(ui, act, el) {
    const g = ui.g;
    if (act === 'loan') { if (g.takeLoan(+el.dataset.i)) { ui.toast('Kredit aufgenommen.', 'good'); ui.app.audio.play('loan'); } }
    if (act === 'repay') { if (!g.repayLoan(+el.dataset.i)) ui.toast('Zu wenig Geld.', 'bad'); }
    return true;
  },
  input(ui, el) {
    if (el.dataset.tax) { ui.g.setTax(+el.dataset.tax, +el.value); const v = el.nextElementSibling; v.textContent = `${el.value} %`; v.classList.toggle('neg', +el.value > 12); }
  },
  change(ui, el) { if (el.dataset.tax) ui.renderPanel(); },
};

// Statistik-Zentrale: eigene Datei (statshub.js), nach Themen geordnet
const stats = STATS_PANEL;

const policies = {
  id: 'policies', title: 'Verordnungen', icon: 'policies',
  render(ui) {
    const g = ui.g;
    const active = POLICIES.filter((p) => g.policies.has(p.id));
    const total = active.reduce((a, p) => a + p.cost * (g.stats.pop / 100), 0);
    return `
<div class="res-strip two"><div><div class="k">Aktiv</div><div class="v">${active.length} / ${POLICIES.length}</div></div><div><div class="k">Kosten</div><div class="v">${fmtMoney(total)}<small> / Tag</small></div></div></div>` + POLICIES.map((p) => {
      const locked = !g.sandbox && g.milestone < p.unlock;
      const on = g.policies.has(p.id);
      const cost = p.cost * (g.stats.pop / 100);
      return `<div class="toggle${locked ? ' locked' : ''}${on ? ' active' : ''}"><button class="switch${on ? ' on' : ''}" data-act="policy" data-id="${p.id}" ${locked ? 'disabled' : ''} aria-label="${esc(p.name)}"></button><div class="grow"><div class="t">${esc(p.name)}</div><div class="s">${esc(p.desc)} ${p.cost ? `· ${fmtMoney(cost)}/Tag` : '· kostenlos'}${locked ? ` · ab „${MILESTONES[p.unlock].name}"` : ''}</div></div></div>`;
    }).join('');
  },
  click(ui, act, el) { if (act === 'policy') { ui.g.togglePolicy(el.dataset.id); ui.app.audio.play('toggle'); } return true; },
};

const transit = {
  id: 'transit', title: 'U-Bahn', icon: 'transit',
  render(ui) {
    const g = ui.g, tr = g.transit;
    if (timetableBusy() && ui._panelBody) return ui._panelBody; // Zug wird im Fahrplan gezogen: nicht neu zeichnen
    if (!g.isUnlocked('transit')) {
      return `<div class="lockcard">${icon('lock', 20)}<div><b>Ab „${MILESTONES[2].name}"</b><br>${fmt(MILESTONES[2].pop)} Einwohner</div></div>
<p class="lede">Die <b>Pulsbahn</b> ist die U-Bahn deiner Stadt: Ihre Züge fahren im Tunnel unter den Straßen, oben sieht man nur die Eingänge. Fahrgäste warten an den Stationen. Ihre Form zeigt das Ziel: <b>●</b> nach Hause, <b>▲</b> zum Einkaufen, <b>■</b> in die Industrie, <b>◆</b> ins Büro. Ist eine Station zu lange überfüllt, geben die Leute auf und die Gegend wird unzufrieden.</p>`;
    }
    const linesHtml = tr.lines.map((l) => {
      const ts = tr.trains.filter((t) => t.line === l.id);
      const wag = ts.reduce((a, t) => a + t.wagons, 0);
      const pax = ts.reduce((a, t) => a + t.pax.length, 0);
      const cap = ts.reduce((a, t) => a + tr.trainCapacity(t), 0);
      const col = hex(LINE_COLORS[l.color]);
      const stops = l.stops.map((id) => tr.stations.get(id)).filter(Boolean);
      const load = cap ? pax / cap : 0;
      return `<div class="line-card" style="--lc:${col}">
  <div class="hd"><span class="badge" style="background:${col}">${l.id}</span><div class="grow"><div class="ttl">Linie ${LINE_COLOR_NAMES[l.color]}${l.loop ? ' · Ring' : ''}</div><div class="sub">${stops.length} Stationen · ${l.length.toFixed(0)} Felder · gestern ${fmt(l.riders)} Fahrgäste</div></div></div>
  ${timetableHTML(ui, l)}
  <div class="ctrl">
    <span>Züge <b>${ts.length}</b> · Auslastung <b class="${load > 0.9 ? 'neg' : ''}">${Math.round(load * 100)} %</b></span>
    <span class="grp"><button class="mini" data-act="train-" data-l="${l.id}" ${ts.length <= 1 ? 'disabled' : ''} aria-label="Zug entfernen">${icon('minus', 14, 2.6)}</button><button class="mini" data-act="train+" data-l="${l.id}" data-tip="${tr.freeTrains > 0 ? 'Zug aus dem Depot' : 'Zug kaufen · ' + fmtMoney(TRANSIT.trainCost * g.costMul)}" aria-label="Zug hinzufügen">${icon('plus', 14, 2.6)}</button></span>
    <span>Waggons <b>${wag}</b> <small>(+${TRANSIT.wagonCapacity} Plätze je Waggon)</small></span>
    <span class="grp"><button class="mini" data-act="wagon+" data-l="${l.id}" data-tip="${tr.freeWagons > 0 ? 'Waggon aus dem Depot' : 'Waggon kaufen · ' + fmtMoney(TRANSIT.wagonCost * g.costMul)}" aria-label="Waggon hinzufügen">${icon('plus', 14, 2.6)}</button></span>
  </div>
  ${meterHTML(load, 1, load > 0.9 ? 'var(--bad)' : col)}
  <div class="acts">
    <button class="btn small" data-act="extend" data-l="${l.id}" data-tip="Enden ziehen, Stationen antippen">${icon('line', 14)} Bearbeiten</button>
    <button class="btn small ghost danger-t" data-act="delline" data-l="${l.id}">${ui.confirmDel === l.id ? 'Wirklich löschen?' : 'Löschen'}</button>
  </div>
</div>`;
    }).join('');
    return `
<div class="res-strip"><div><div class="k">Linien</div><div class="v">${tr.lines.length} / ${tr.linesMax}</div></div><div><div class="k">Züge frei</div><div class="v">${tr.freeTrains}</div></div><div><div class="k">Wagen frei</div><div class="v">${tr.freeWagons}</div></div></div>
<div class="acts row-acts"><button class="btn" data-act="newline" ${tr.lines.length >= tr.linesMax ? 'disabled' : ''}>${icon('line', 16)} Neue Linie zeichnen</button><button class="btn ghost" data-act="station">${icon('station', 16)} Station setzen</button></div>
${linesHtml || '<p class="lede">Noch keine Linie. Stationen antippen, ✓ baut.</p>'}
${tr.lines.length ? TIMETABLE_HINT : ''}<div class="sec" style="margin-top:14px"><h3>Ziele der Fahrgäste</h3><div class="chips" style="margin:0"><span class="chip">● Wohnen</span><span class="chip">▲ Gewerbe</span><span class="chip">■ Industrie</span><span class="chip">◆ Büro</span></div><p class="hint">Einzugsgebiet ${String(TRANSIT.catchment).replace(".", ",")} Felder · roter Ring = überfüllt</p></div>`;
  },
  click(ui, act, el) {
    const g = ui.g;
    const res = (r) => { if (r && r.ok === false && r.msg) ui.toast(r.msg, 'bad'); };
    const tt = timetableClick(ui, act, el);
    if (tt !== undefined) return tt;
    switch (act) {
      case 'newline': ui.app.input.setTool({ kind: 'line' }); ui.closePanels(); return false;
      case 'station': ui.app.input.setTool({ kind: 'place', key: 'station' }); ui.closePanels(); return false;
      case 'train+': res(g.addTrain(+el.dataset.l)); break;
      case 'train-': res(g.removeTrain(+el.dataset.l)); break;
      case 'wagon+': res(g.addWagon(+el.dataset.l)); break;
      case 'gost': ui.focusTile(+el.dataset.x, +el.dataset.y, 22); return false;
      case 'extend': ui.app.input.setTool({ kind: 'extend', line: +el.dataset.l }); ui.closePanels(); return false;
      case 'delline': if (ui.confirmDel === +el.dataset.l) { g.removeLine(+el.dataset.l); ui.confirmDel = null; } else { ui.confirmDel = +el.dataset.l; setTimeout(() => { ui.confirmDel = null; }, 4000); } break;
    }
    return true;
  },
  afterRender(ui) { timetableAfterRender(ui); },
};

const news = {
  id: 'news', title: 'Stadtfunk', icon: 'news',
  render(ui) {
    const g = ui.g;
    const f = ui.newsFilter || 'all';
    const list = [...g.newsLog].reverse().filter((n) => f === 'all' || (f === 'people' ? n.author !== 'Stadtfunk' : n.author === 'Stadtfunk'));
    const chips = `<div class="chips filt">${[['all', 'Alle'], ['people', 'Bürgerstimmen'], ['official', 'Meldungen']].map(([k, n]) => `<button class="chip${f === k ? ' on' : ''}" data-act="nf" data-v="${k}">${n}</button>`).join('')}</div>`;
    if (!list.length) return chips + '<p class="empty">Noch ist es ruhig in der Stadt.</p>';
    return chips + list.map((n, i) => {
      const off = n.author === 'Stadtfunk';
      const ini = off ? 'SF' : n.author.split(' ').map((p) => p[0]).join('');
      const col = off ? (n.mood === 'bad' ? '#d4433a' : n.mood === 'good' ? '#2b9a57' : '#1d2330') : AV_COLORS[(n.author.length + i) % AV_COLORS.length];
      const day = Math.floor(n.time / 1440);
      const hh = String(Math.floor((n.time % 1440) / 60)).padStart(2, '0');
      const where = n.x !== undefined && n.y !== undefined;
      return `<div class="post${off ? ' official' : ''}"><span class="av" style="background:${col}">${esc(ini)}</span><div class="grow"><div class="who">${esc(n.author)}<span class="when">Tag ${day}, ${hh} Uhr</span></div><div class="txt">${esc(n.text)}</div></div>${where ? `<button class="mini" data-act="gonews" data-x="${n.x}" data-y="${n.y}" data-tip="Hinfliegen" data-tip-fast="1">${icon('pin', 15, 2.2)}</button>` : ''}</div>`;
    }).join('');
  },
  click(ui, act, el) {
    if (act === 'nf') { ui.newsFilter = el.dataset.v; return true; }
    if (act === 'gonews') { ui.focusTile(+el.dataset.x, +el.dataset.y); return false; }
    return true;
  },
};

export const CORE_PANELS = [budget, stats, policies, transit, news];
void clamp;
