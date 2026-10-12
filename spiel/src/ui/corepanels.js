// Eingebaute Panels (Haushalt, Statistik, Verordnungen, Pulsbahn, Stadtfunk) im selben Format wie registerPanel:
// { id, title, icon, render(ui) → html, click(ui, act, el) → false = nicht neu zeichnen, input(ui, el), change(ui, el), afterRender(ui) }
import { ZONE_INFO, MILESTONES, POLICIES, LOANS, TRANSIT } from '../config.js';
import { BUDGET_LINES } from '../registry.js';
import { fmt, fmtMoney, fmtShort, clamp } from '../util.js';
import { LINE_COLORS, LINE_COLOR_NAMES } from '../sim/transit.js';
import { icon } from './icons.js';
import { drawLineChart, svgSpark, barsHTML, meterHTML, svgDonut, chartIndexAt } from './charts.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const AV_COLORS = ['#e8543f', '#2f8fe0', '#f2b01e', '#22a866', '#8f5ad8', '#f06fae', '#10a9a3', '#ff8a1f'];
const signed = (v) => `${v >= 0 ? '+' : '−'}${fmtMoney(Math.abs(v))}`;

const INC_LABEL = { res: 'Steuern Wohnen', com: 'Steuern Gewerbe', ind: 'Steuern Industrie', off: 'Steuern Büro', tourism: 'Tourismus', fares: 'Pulsbahn-Tickets' };
const EXP_LABEL = { services: 'Dienste & Versorgung', roads: 'Straßenunterhalt', transit: 'Pulsbahn', policies: 'Verordnungen', loans: 'Kreditzinsen' };
const INC_COL = { res: '#4fae67', com: '#3a8ad8', ind: '#dba22e', off: '#9466d2', tourism: '#ff8a1f', fares: '#e8543f' };
const EXP_COL = { services: '#e8543f', roads: '#5d6470', transit: '#2f8fe0', policies: '#8f5ad8', loans: '#c98a0c' };
const lineLabel = (id, map) => map[id] || (BUDGET_LINES.find((l) => l.id === id) || {}).label || id;

const budget = {
  id: 'budget', title: 'Haushalt', icon: 'budget',
  render(ui) {
    const g = ui.g, b = g.budget();
    const nets = g.history.map((h) => h.net ?? 0).slice(-30);
    const incItems = Object.entries(b.inc).filter(([, v]) => v > 0.5).sort((a, c) => c[1] - a[1]).map(([k, v]) => ({ label: esc(lineLabel(k, INC_LABEL)), value: v, color: INC_COL[k] || '#4fae67', text: fmtMoney(v) }));
    const expItems = Object.entries(b.exp).filter(([, v]) => v > 0.5).sort((a, c) => c[1] - a[1]).map(([k, v]) => ({ label: esc(lineLabel(k, EXP_LABEL)), value: v, color: EXP_COL[k] || '#e8543f', text: '−' + fmtMoney(v) }));
    const max = Math.max(1, ...incItems.map((i) => i.value), ...expItems.map((i) => i.value));
    const taxes = [1, 2, 3, 4].map((z) => `<div class="slider tax"><label><span class="zdot" style="background:${hex(ZONE_INFO[z].color)}"></span> ${ZONE_INFO[z].name}</label><input type="range" min="0" max="25" step="1" value="${g.taxes[z]}" data-tax="${z}" id="tax-${z}" style="accent-color:${hex(ZONE_INFO[z].color)}"><span class="val num${g.taxes[z] > 12 ? ' neg' : ''}">${g.taxes[z]} %</span></div>`).join('');
    const loans = g.loans.map((l, i) => `<div class="row"><span class="grow">${fmtMoney(l.amount)} · noch ${l.weeksLeft} Wochen<br><span class="sub">Tilgung ${fmtMoney(l.amount / l.weeks)} + Zinsen ${fmtMoney(l.weekly)} pro Woche</span></span><button class="btn small ghost" data-act="repay" data-i="${i}">Ablösen</button></div>`).join('');
    const offers = LOANS.map((l, i) => `<div class="row"><span class="grow">${fmtMoney(l.amount)} über ${l.weeks} Wochen<br><span class="sub">${(l.rate * 100).toFixed(1).replace('.', ',')} % Zins pro Woche</span></span><button class="btn small" data-act="loan" data-i="${i}" ${g.loans.length >= 3 || !g.isUnlocked('loans') ? 'disabled' : ''}>Aufnehmen</button></div>`).join('');
    return `
<div class="hero ${b.net < 0 ? 'neg' : 'pos'}"><div><div class="k">Saldo pro Tag</div><div class="v num">${signed(b.net)}</div><div class="s">${g.sandbox ? 'Sandkasten – Geld spielt keine Rolle' : `Kasse ${fmtMoney(g.money)}`}</div></div>${svgSpark(nets, { w: 130, h: 44, color: b.net < 0 ? '#d4433a' : '#2b9a57', zero: true })}</div>
<div class="sec"><h3>Einnahmen · ${fmtMoney(b.income)}</h3>${incItems.length ? barsHTML(incItems, { max }) : '<p class="empty">Noch keine Einnahmen.</p>'}</div>
<div class="sec"><h3>Ausgaben · ${fmtMoney(b.expense)}</h3>${expItems.length ? barsHTML(expItems, { max }) : '<p class="empty">Noch keine Ausgaben.</p>'}</div>
<div class="sec"><h3>Steuersätze</h3>${taxes}<p class="hint">Über 10 % sinken Nachfrage und Glück spürbar, über 15 % stark.</p></div>
<div class="sec"><h3>Kredite</h3>${loans || '<p class="empty">Keine laufenden Kredite.</p>'}<div class="rule"></div>${g.isUnlocked('loans') ? offers : `<p class="hint">${g.lockReason('zone4')}</p>`}</div>`;
  },
  click(ui, act, el) {
    const g = ui.g;
    if (act === 'loan') { if (g.takeLoan(+el.dataset.i)) { ui.toast('Kredit aufgenommen.', 'good'); ui.app.audio.play('money'); } }
    if (act === 'repay') { if (!g.repayLoan(+el.dataset.i)) ui.toast('Nicht genug Geld zum Ablösen.', 'bad'); }
    return true;
  },
  input(ui, el) {
    if (el.dataset.tax) { ui.g.setTax(+el.dataset.tax, +el.value); const v = el.nextElementSibling; v.textContent = `${el.value} %`; v.classList.toggle('neg', +el.value > 12); }
  },
  change(ui, el) { if (el.dataset.tax) ui.renderPanel(); },
};

const stats = {
  id: 'stats', title: 'Statistik', icon: 'stats',
  render(ui) {
    const g = ui.g, s = g.stats, u = g.util;
    const tabs = [['pop', 'Einwohner'], ['money', 'Kasse'], ['net', 'Saldo'], ['happy', 'Glück'], ['riders', 'Fahrgäste'], ['flow', 'Verkehrsfluss']];
    const counts = s.countByZone;
    const pw = u.powerSupply ? u.powerDemand / u.powerSupply : 0, wt = u.waterSupply ? u.waterDemand / u.waterSupply : 0;
    const zoneParts = [1, 2, 3, 4].map((z) => ({ value: counts[z], color: hex(ZONE_INFO[z].color) }));
    return `
<div class="sec"><h3>Verlauf</h3>
  <div class="chart-tabs">${tabs.map(([k, n]) => `<button data-act="chart" data-k="${k}" class="${ui.chartKey === k ? 'on' : ''}">${n}</button>`).join('')}</div>
  <canvas class="chart" id="chart-main"></canvas>
</div>
<div class="sec"><h3>Versorgung</h3>
  <div class="kv"><span>${icon('power', 14)} Strom ${fmt(u.powerDemand)} / ${fmt(u.powerSupply)} MW</span><span class="v ${pw > 1 ? 'neg' : ''}">${Math.round(pw * 100)} %</span></div>
  ${meterHTML(u.powerDemand, u.powerSupply, pw > 1 ? 'var(--bad)' : pw > 0.9 ? 'var(--warn)' : 'var(--l-yellow)')}
  <div class="kv" style="margin-top:8px"><span>${icon('water', 14)} Wasser ${fmt(u.waterDemand)} / ${fmt(u.waterSupply)} m³</span><span class="v ${wt > 1 ? 'neg' : ''}">${Math.round(wt * 100)} %</span></div>
  ${meterHTML(u.waterDemand, u.waterSupply, wt > 1 ? 'var(--bad)' : wt > 0.9 ? 'var(--warn)' : 'var(--l-blue)')}
</div>
<div class="sec"><h3>Bevölkerung & Arbeit</h3>
  <div class="tiles">
    <div class="tile"><span class="k">Einwohner</span><span class="v num">${fmt(s.pop)}</span></div>
    <div class="tile"><span class="k">Arbeitskräfte</span><span class="v num">${fmt(s.workers)}</span></div>
    <div class="tile"><span class="k">Arbeitslos</span><span class="v num ${s.unemployment > 0.12 ? 'neg' : ''}">${Math.round(s.unemployment * 100)} %</span></div>
    <div class="tile"><span class="k">Bildung Ø</span><span class="v num">${Math.round(s.edu * 100)} %</span></div>
    <div class="tile"><span class="k">Touristen/Tag</span><span class="v num">${fmt(s.tourism)}</span></div>
    <div class="tile"><span class="k">Jobs G/I/B</span><span class="v num sm">${fmt(s.jobsByZone[2])} · ${fmt(s.jobsByZone[3])} · ${fmt(s.jobsByZone[4])}</span></div>
  </div>
</div>
<div class="sec"><h3>Gebäude</h3>
  <div class="donutrow">${svgDonut(zoneParts, { size: 92, thickness: 13, label: fmt(counts[1] + counts[2] + counts[3] + counts[4]) })}
  <div class="kv grow">
    ${[1, 2, 3, 4].map((z) => `<span><span class="zdot" style="background:${hex(ZONE_INFO[z].color)}"></span> ${ZONE_INFO[z].name}</span><span class="v">${fmt(counts[z])}</span>`).join('')}
    <span>Verlassen</span><span class="v ${s.abandoned ? 'neg' : ''}">${fmt(s.abandoned)}</span>
    <span>Ohne Strom / Wasser</span><span class="v ${s.unpowered + s.unwatered ? 'neg' : ''}">${fmt(s.unpowered)} / ${fmt(s.unwatered)}</span>
  </div></div>
</div>
<div class="sec"><h3>Aktive Effekte</h3>${g.effects.length ? g.effects.map((e) => `<div class="row"><span class="grow">${esc(e.label)}</span><span class="val">noch ${Math.max(1, Math.ceil((e.until - g.time) / 1440))} T.</span></div>`).join('') : '<p class="empty">Keine.</p>'}</div>`;
  },
  afterRender(ui) {
    const c = document.getElementById('chart-main');
    if (!c) return;
    const h = ui.g.history, k = ui.chartKey;
    const vals = h.map((e) => e[k] ?? 0);
    const col = { pop: '#4fae67', money: '#c98a0c', net: '#2f8fe0', happy: '#f06fae', riders: '#e8543f', flow: '#5d6470' }[k];
    const opts = { color: col, zero: k === 'net' || k === 'money', startLabel: h.length ? `Tag ${h[0].d}` : '', endLabel: h.length ? `Tag ${h[h.length - 1].d}` : '', fmt: (v) => (Math.abs(v) >= 10000 ? fmtShort(v) : Math.round(v).toLocaleString('de-DE')) + (k === 'happy' || k === 'flow' ? ' %' : ''), label: (i) => `Tag ${h[i].d}` };
    drawLineChart(c, vals, opts);
    c.onpointermove = (e) => { const r = c.getBoundingClientRect(); drawLineChart(c, vals, { ...opts, hover: chartIndexAt(c, e.clientX - r.left, vals.length) }); };
    c.onpointerleave = () => drawLineChart(c, vals, opts);
  },
  click(ui, act, el) { if (act === 'chart') ui.chartKey = el.dataset.k; return true; },
};

const policies = {
  id: 'policies', title: 'Verordnungen', icon: 'policies',
  render(ui) {
    const g = ui.g;
    const active = POLICIES.filter((p) => g.policies.has(p.id));
    const total = active.reduce((a, p) => a + p.cost * (g.stats.pop / 100), 0);
    return `<p class="lede">Verordnungen gelten für die ganze Stadt. Die Kosten steigen mit der Einwohnerzahl.</p>
<div class="res-strip two"><div><div class="k">Aktiv</div><div class="v">${active.length} / ${POLICIES.length}</div></div><div><div class="k">Kosten</div><div class="v">${fmtMoney(total)}<small> / Tag</small></div></div></div>` + POLICIES.map((p) => {
      const locked = !g.sandbox && g.milestone < p.unlock;
      const on = g.policies.has(p.id);
      const cost = p.cost * (g.stats.pop / 100);
      return `<div class="toggle${locked ? ' locked' : ''}${on ? ' active' : ''}"><button class="switch${on ? ' on' : ''}" data-act="policy" data-id="${p.id}" ${locked ? 'disabled' : ''} aria-label="${esc(p.name)}"></button><div class="grow"><div class="t">${esc(p.name)}</div><div class="s">${esc(p.desc)} ${p.cost ? `· ${fmtMoney(cost)}/Tag` : '· kostenlos'}${locked ? ` · ab „${MILESTONES[p.unlock].name}"` : ''}</div></div></div>`;
    }).join('');
  },
  click(ui, act, el) { if (act === 'policy') ui.g.togglePolicy(el.dataset.id); return true; },
};

const transit = {
  id: 'transit', title: 'Pulsbahn', icon: 'transit',
  render(ui) {
    const g = ui.g, tr = g.transit;
    if (!g.isUnlocked('transit')) {
      return `<div class="lockcard">${icon('lock', 20)}<div><b>Ab „${MILESTONES[2].name}"</b><br>${fmt(MILESTONES[2].pop)} Einwohner</div></div>
<p class="lede">Die <b>Pulsbahn</b> ist eine Hochbahn, die über den Dächern fährt. Fahrgäste warten an den Stationen. Ihre Form zeigt das Ziel: <b>●</b> nach Hause, <b>▲</b> zum Einkaufen, <b>■</b> in die Industrie, <b>◆</b> ins Büro. Ist eine Station zu lange überfüllt, geben die Leute auf und die Gegend wird unzufrieden.</p>`;
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
  <div class="diagram${l.loop ? ' loop' : ''}">${stops.map((s) => `<button class="st${s.waiting.length > 10 ? ' full' : ''}" data-act="gost" data-x="${s.x}" data-y="${s.y}" data-tip="${esc(s.name)}" data-tip-desc="${s.waiting.length} wartend" data-tip-fast="1"><i></i><span>${esc(s.name)}${s.waiting.length > 10 ? ` (${s.waiting.length})` : ''}</span></button>`).join('')}</div>
  <div class="ctrl">
    <span>Züge <b>${ts.length}</b> · Auslastung <b class="${load > 0.9 ? 'neg' : ''}">${Math.round(load * 100)} %</b></span>
    <span class="grp"><button class="mini" data-act="train-" data-l="${l.id}" ${ts.length <= 1 ? 'disabled' : ''} aria-label="Zug entfernen">${icon('minus', 14, 2.6)}</button><button class="mini" data-act="train+" data-l="${l.id}" data-tip="${tr.freeTrains > 0 ? 'Zug aus dem Depot' : 'Zug kaufen · ' + fmtMoney(TRANSIT.trainCost * g.costMul)}" aria-label="Zug hinzufügen">${icon('plus', 14, 2.6)}</button></span>
    <span>Waggons <b>${wag}</b> <small>(+${TRANSIT.wagonCapacity} Plätze je Waggon)</small></span>
    <span class="grp"><button class="mini" data-act="wagon+" data-l="${l.id}" data-tip="${tr.freeWagons > 0 ? 'Waggon aus dem Depot' : 'Waggon kaufen · ' + fmtMoney(TRANSIT.wagonCost * g.costMul)}" aria-label="Waggon hinzufügen">${icon('plus', 14, 2.6)}</button></span>
  </div>
  ${meterHTML(load, 1, load > 0.9 ? 'var(--bad)' : col)}
  <div class="acts">
    ${l.loop ? '' : `<button class="btn small ghost" data-act="extend" data-l="${l.id}" data-start="1">Anfang verlängern</button><button class="btn small ghost" data-act="extend" data-l="${l.id}" data-start="0">Ende verlängern</button>`}
    <button class="btn small ghost danger-t" data-act="delline" data-l="${l.id}">${ui.confirmDel === l.id ? 'Wirklich löschen?' : 'Löschen'}</button>
  </div>
</div>`;
    }).join('');
    return `
<div class="res-strip"><div><div class="k">Linien</div><div class="v">${tr.lines.length} / ${tr.linesMax}</div></div><div><div class="k">Züge im Depot</div><div class="v">${tr.freeTrains}</div></div><div><div class="k">Waggons</div><div class="v">${tr.freeWagons}</div></div></div>
<div class="acts row-acts"><button class="btn" data-act="newline" ${tr.lines.length >= tr.linesMax ? 'disabled' : ''}>${icon('line', 16)} Neue Linie zeichnen</button><button class="btn ghost" data-act="station">${icon('station', 16)} Station setzen</button></div>
${linesHtml || '<p class="lede">Noch keine Linie. Klicke auf „Neue Linie zeichnen" und dann nacheinander auf Felder in Wohn- und Arbeitsvierteln. Ein Klick auf die erste Station schließt einen Ring.</p>'}
<div class="sec" style="margin-top:14px"><h3>So funktioniert es</h3><p class="hint">Jede Station sammelt Fahrgäste im Umkreis von ${TRANSIT.catchment} Feldern. Symbole über den Stationen zeigen das Ziel: ● Wohnen, ▲ Gewerbe, ■ Industrie, ◆ Büro. Wird eine Station zu voll, läuft ein roter Ring – mehr Züge oder Waggons helfen. Unter der Trasse wachsen Gebäude höchstens bis Stufe ${TRANSIT.maxLevelUnderTrack}.</p></div>`;
  },
  click(ui, act, el) {
    const g = ui.g;
    const res = (r) => { if (r && r.ok === false && r.msg) ui.toast(r.msg, 'bad'); };
    switch (act) {
      case 'newline': ui.app.input.setTool({ kind: 'line' }); ui.closePanels(); return false;
      case 'station': ui.app.input.setTool({ kind: 'place', key: 'station' }); ui.closePanels(); return false;
      case 'train+': res(g.addTrain(+el.dataset.l)); break;
      case 'train-': res(g.removeTrain(+el.dataset.l)); break;
      case 'wagon+': res(g.addWagon(+el.dataset.l)); break;
      case 'gost': ui.focusTile(+el.dataset.x, +el.dataset.y, 22); return false;
      case 'extend': ui.app.input.setTool({ kind: 'extend', line: +el.dataset.l, atStart: el.dataset.start === '1' }); ui.closePanels(); return false;
      case 'delline': if (ui.confirmDel === +el.dataset.l) { g.removeLine(+el.dataset.l); ui.confirmDel = null; } else { ui.confirmDel = +el.dataset.l; setTimeout(() => { ui.confirmDel = null; }, 4000); } break;
    }
    return true;
  },
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
