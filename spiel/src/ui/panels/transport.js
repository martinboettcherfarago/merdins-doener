// Panel „Verkehr & ÖPNV" (Agent S3) und Zusätze im Inspektor (Haltestellen, Ampeln, Verkehrsbauten, Anbindung).
// registerPanel({ id, title, icon, order, render(ui) → HTML, click(ui, act, el), afterRender(ui) })
// ui.g = Spiel, ui.app = App (settings, audio, input, engine). Knöpfe mit data-act="..." lösen click aus.
import { registerPanel, INSPECTORS, emit, on } from '../../registry.js';
import { BUILDINGS, MILESTONES, Z, ROADS, POLICIES } from '../../config.js';
import { fmt, fmtMoney, clamp } from '../../util.js';
import * as TPS from '../../sim/systems/transport.js';
import { drawLineChart } from '../charts.js';
import { LINE_COLORS } from '../../sim/transit.js';

const BUS_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M8 21v-3M16 21v-3"/><circle cx="8" cy="14.5" r="0.9" fill="currentColor"/><circle cx="16" cy="14.5" r="0.9" fill="currentColor"/><path d="M9 6.5h6"/></svg>';
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const S = { tab: 'overview', chart: 'riders', confirmDel: null, open: new Set() };
on('transport:panelTab', (t) => { S.tab = t; });

const pct = (v) => `${Math.round(v * 100)} %`;
const muted = (t) => `<p style="font-size:12.5px;color:var(--ink-3);line-height:1.45;margin:6px 0 0">${t}</p>`;
const meter = (v, col) => `<div class="meter"><i style="width:${clamp(v, 0, 1) * 100}%;background:${col}"></i></div>`;
const taktText = (t) => (t === Infinity || !t ? '–' : t < 1.5 ? 'unter 2 Min.' : `${Math.round(t)} Min.`);
const badge = (l, size = 30) => `<span class="badge" style="background:${hex(TPS.lineColor(l))};width:${size}px;height:${size}px;border-radius:${l.mode === 'tram' ? '8px' : '50%'};font-size:${l.num >= 10 ? 13 : 15}px">${l.mode === 'tram' ? 'T' : ''}${l.num}</span>`;

function spark(vals, col) {
  if (!vals || vals.length < 2) return '';
  const max = Math.max(1, ...vals);
  const w = 92, h = 22;
  const pts = vals.map((v, i) => `${((i / (vals.length - 1)) * w).toFixed(1)},${(h - (v / max) * (h - 2) - 1).toFixed(1)}`).join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
}

// Netzplan: Bus-, Tram- und Pulsbahnlinien schematisch (Haltestellen als Punkte, Umstiege größer)
function netMap(g) {
  const T = TPS.TS(g);
  const tr = g.transit;
  const pts = [];
  for (const s of T.stops) if (s.lines.length) pts.push([s.x, s.y]);
  for (const st of tr.stations.values()) pts.push([st.x, st.y]);
  if (pts.length < 2) return '';
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const pad = 2;
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  const W = 340, H = Math.round(clamp(((y1 - y0) / Math.max(1, x1 - x0)) * W, 120, 230));
  const sx = (x) => (((x + 0.5 - x0) / (x1 - x0)) * W).toFixed(1), sy = (y) => (((y + 0.5 - y0) / (y1 - y0)) * H).toFixed(1);
  let svg = '';
  for (const l of tr.lines) {
    const ss = l.stops.map((id) => tr.stations.get(id)).filter(Boolean);
    if (l.loop && ss.length) ss.push(ss[0]);
    svg += `<polyline points="${ss.map((st) => sx(st.x) + ',' + sy(st.y)).join(' ')}" fill="none" stroke="${hex(LINE_COLORS[l.color])}" stroke-width="5" stroke-opacity="0.3" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  T.lines.forEach((l, idx) => {
    const ss = l.stops.map((id) => TPS.stopById(g, id)).filter(Boolean);
    if (l.loop && ss.length) ss.push(ss[0]);
    const o = ((idx % 3) - 1) * 1.6;
    svg += `<polyline points="${ss.map((st) => (+sx(st.x) + o).toFixed(1) + ',' + (+sy(st.y) + o).toFixed(1)).join(' ')}" fill="none" stroke="${hex(TPS.lineColor(l))}" stroke-width="${l.mode === 'tram' ? 3.4 : 2.6}" stroke-linejoin="round" stroke-linecap="round"${l.broken ? ' stroke-dasharray="4 3"' : ''}/>`;
  });
  for (const st of tr.stations.values()) svg += `<rect x="${(+sx(st.x) - 3.5).toFixed(1)}" y="${(+sy(st.y) - 3.5).toFixed(1)}" width="7" height="7" rx="1.5" fill="#fff" stroke="#e8543f" stroke-width="1.6"/>`;
  for (const s of T.stops) {
    if (!s.lines.length) continue;
    const big = s.lines.length > 1 || s.feeder;
    svg += `<circle cx="${sx(s.x)}" cy="${sy(s.y)}" r="${big ? 3.6 : 2.4}" fill="#fff" stroke="${s.crowd > 0.15 ? '#d4433a' : '#1d2330'}" stroke-width="${big ? 1.6 : 1.2}"><title>${esc(s.name)}</title></circle>`;
  }
  for (const l of T.lines) {
    const st = TPS.stopById(g, l.stops[0]);
    if (!st) continue;
    svg += `<g transform="translate(${(+sx(st.x) - 7).toFixed(1)},${(+sy(st.y) - 16).toFixed(1)})"><rect width="14" height="11" rx="${l.mode === 'tram' ? 2 : 5.5}" fill="${hex(TPS.lineColor(l))}"/><text x="7" y="8.6" font-size="8.5" font-weight="700" fill="#fff" text-anchor="middle" font-family="Barlow Condensed, sans-serif">${l.mode === 'tram' ? 'T' : ''}${l.num}</text></g>`;
  }
  return `<div class="sec"><h3>Netzplan</h3><svg viewBox="-8 -18 ${W + 16} ${H + 26}" style="width:100%;height:auto;display:block;background:var(--paper-2);border-radius:10px">${svg}</svg>${muted('Kreise: Haltestellen (groß = Umstieg) · Quadrate: Pulsbahn-Stationen · rot umrandet: überfüllt · gestrichelt: unterbrochen')}</div>`;
}

function focus(ui, x, y, dist = 22) {
  const g = ui.g;
  ui.app.engine.rig.focus(x + 0.5 - g.W / 2, y + 0.5 - g.H / 2, dist);
}

// ---------------------------------------------------------------- Kennzahlen
function modal(g) {
  const T = TPS.TS(g);
  const bus = T ? T.share * 0.9 : 0;
  const puls = Math.max(0, (T ? T.shareBase : g.stats.transitShare) || 0);
  const walk = 0.05 + (g.policies.has('bikes') ? 0.08 : 0) + (g.stats.pop < 800 ? 0.04 : 0);
  const car = Math.max(0.05, 1 - bus - puls - walk);
  const tot = car + bus + puls + walk;
  return [['Auto', car / tot, '#7a8294'], ['Bus & Tram', bus / tot, '#1c7ed6'], ['Pulsbahn', puls / tot, '#e8543f'], ['Fuß & Rad', walk / tot, '#22a866']];
}
function avgCommute(g) {
  let s = 0, n = 0;
  for (const b of g.buildings.values()) if (b.zone === Z.RES && !b.abandoned && b.occ > 0) { s += b.commute * b.occ; n += b.occ; }
  return n ? s / n : 0;
}
function hotspots(g, k = 5) {
  const out = [];
  for (let i = 0; i < g.N; i++) if (g.road[i] && g.congestion[i] > 0.85) out.push(i);
  out.sort((a, b) => g.congestion[b] - g.congestion[a]);
  return out.slice(0, k);
}
function unserved(g) {
  const T = TPS.TS(g);
  let n = 0, pop = 0;
  for (const b of g.buildings.values()) {
    if (b.zone !== Z.RES || b.abandoned || !b.occ) continue;
    const i = b.y * g.W + b.x;
    if ((T && T.covField ? T.covField[i] : 0) < 0.05 && (g.cov.transit[i] || 0) < 0.05) { n++; pop += b.occ; }
  }
  return { n, pop };
}

function advice(g) {
  const T = TPS.TS(g);
  const tips = [];
  if (!T) return tips;
  const busOk = TPS.modeUnlocked(g, 'bus');
  if (busOk && !g.hasBuilt('bus_depot') && g.stats.pop > 250) tips.push(['Baue ein Busdepot an einer Straße – danach kannst du Buslinien zeichnen.', 'good']);
  if (g.hasBuilt('bus_depot') && !T.lines.some((l) => l.mode === 'bus')) tips.push(['Das Busdepot steht leer: Zeichne eine Buslinie von einem Wohngebiet zu Arbeitsplätzen.', 'warn']);
  for (const l of T.lines) {
    if (l.broken) tips.push([`${TPS.lineLabel(l)} ist unterbrochen: ${l.broken}. Straße reparieren oder Haltestellen ändern.`, 'bad']);
    else if (l.load > 1.05) tips.push([`${TPS.lineLabel(l)} ist überfüllt (${pct(l.load)}). Mehr oder größere Fahrzeuge einsetzen.`, 'bad']);
    else if (l.takt > 22 && l.riders > 5) tips.push([`${TPS.lineLabel(l)} fährt nur alle ${Math.round(l.takt)} Minuten – ein weiteres Fahrzeug macht sie attraktiver.`, 'warn']);
    else if (l.riders < 8 && g.day() - (l.created || 0) > 3) tips.push([`${TPS.lineLabel(l)} hat kaum Fahrgäste. Verbinde Wohnen mit Arbeit, Läden oder einer Pulsbahn-Station.`, 'warn']);
  }
  const u = unserved(g);
  if (T.lines.length && u.pop > g.stats.pop * 0.25) tips.push([`${fmt(u.pop)} Menschen wohnen ohne Haltestelle in der Nähe (${String(TPS.TP.stopRadius).replace('.', ',')} Felder).`, 'warn']);
  const recent = T.accidentLog.filter((a) => g.day() - a.day <= 2);
  if (recent.length >= 2) tips.push([`${recent.length} Unfälle in den letzten Tagen. Ampeln an belebten Kreuzungen verhindern die meisten.`, 'bad']);
  if ((g.stats.trafficFlow || 1) < 0.8) tips.push(['Viel Stau: Busspuren, Straßenbahnen, Parkhäuser und Alleen entlasten die Straßen.', 'warn']);
  if (T.stops.some((s) => s.feeder) && T.day && T.day.feeder > 5) tips.push([`Gut: ${fmt(T.day.feeder)} Fahrgäste sind gestern zwischen Bus und Pulsbahn umgestiegen.`, 'good']);
  if (!tips.length && T.lines.length) tips.push(['Der Verkehr läuft. Wachsende Viertel brauchen bald neue Linien.', 'good']);
  return tips.slice(0, 5);
}

// ---------------------------------------------------------------- Reiter
function tabOverview(ui) {
  const g = ui.g, T = TPS.TS(g), s = g.stats;
  const y = T.day || {};
  const ms = modal(g);
  const bar = `<div style="display:flex;height:16px;border-radius:8px;overflow:hidden;margin:4px 0 6px">${ms.map(([n, v, c]) => `<i title="${n} ${pct(v)}" style="display:block;width:${v * 100}%;background:${c}"></i>`).join('')}</div>
  <div style="display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12.5px">${ms.map(([n, v, c]) => `<span><span class="zdot" style="background:${c}"></span> ${n} <b>${pct(v)}</b></span>`).join('')}</div>`;
  const tips = advice(g).map(([t, k]) => `<div class="row" style="align-items:flex-start"><span class="chip ${k === 'bad' ? 'no' : k === 'good' ? 'ok' : 'warn'}" style="margin-top:1px">${k === 'bad' ? '!' : k === 'good' ? '✓' : 'i'}</span><span class="grow" style="font-size:13px;line-height:1.4">${esc(t)}</span></div>`).join('');
  const hs = hotspots(g).map((i) => `<div class="row"><span class="grow">${esc(ROADS[g.road[i]].name)} bei ${i % g.W}/${(i / g.W) | 0}${T.signalSet.has(i) ? ' · Ampel' : ''}${T.accidents.some((a) => a.tile === i && g.time < a.until) ? ' · <b style="color:var(--bad)">Unfall</b>' : ''}</span><span class="val ${g.congestion[i] > 1 ? 'neg' : ''}">${pct(g.congestion[i])}</span><button class="btn small ghost" data-act="showtile" data-i="${i}">Zeigen</button></div>`).join('');
  const tabs = [['riders', 'Fahrgäste'], ['share', 'ÖPNV-Anteil'], ['flow', 'Verkehrsfluss'], ['acc', 'Unfälle']];
  return `
<div class="sec"><h3>Wie die Stadt unterwegs ist</h3>${bar}</div>
<div class="sec"><h3>Ratgeber</h3>${tips || muted('Noch nichts zu tun.')}</div>
<div class="sec"><h3>Kennzahlen</h3><div class="kv">
  <span>Verkehrsfluss</span><span class="v ${s.trafficFlow < 0.8 ? 'neg' : ''}">${pct(s.trafficFlow || 1)}</span>
  <span>Autos unterwegs</span><span class="v">${fmt(g.traffic.cars.length)}</span>
  <span>Ø Pendelzeit</span><span class="v">${Math.round(avgCommute(g))} Min.</span>
  <span>Fahrgäste gestern Bus / Tram</span><span class="v">${fmt(y.bus || 0)} / ${fmt(y.tram || 0)}</span>
  <span>Pulsbahn gestern</span><span class="v">${fmt(s.ridersToday || 0)}</span>
  <span>Umstiege · Zubringer</span><span class="v">${fmt(y.transfers || 0)} · ${fmt(y.feeder || 0)}</span>
  <span>Abgewiesen (zu voll)</span><span class="v ${(y.rejected || 0) > 10 ? 'neg' : ''}">${fmt(y.rejected || 0)}</span>
  <span>Ampeln</span><span class="v">${fmt(T.signals.length)}</span>
  <span>Unfälle heute / gesamt</span><span class="v ${T.today.accidents ? 'neg' : ''}">${T.today.accidents} / ${T.totals.accidents}</span>
</div></div>
<div class="sec"><h3>Verlauf</h3><div class="chart-tabs">${tabs.map(([k, n]) => `<button data-act="chart" data-k="${k}" class="${S.chart === k ? 'on' : ''}">${n}</button>`).join('')}</div><canvas class="chart" id="tp-chart"></canvas></div>
<div class="sec"><h3>Stau-Schwerpunkte</h3>${hs || muted('Kein nennenswerter Stau. Die Infoansicht „Verkehr" zeigt die Auslastung jeder Straße.')}</div>`;
}

function lineCard(ui, l) {
  const g = ui.g, T = TPS.TS(g);
  const vt = TPS.VEHICLE_TYPES[l.vtype];
  const col = hex(TPS.lineColor(l));
  const stops = l.stops.map((id) => TPS.stopById(g, id)).filter(Boolean);
  const fleet = TPS.fleetInfo(g, l.mode);
  const nextType = TPS.nextVehicleType(g, l);
  const loadCol = l.load > 1 ? 'var(--bad)' : l.load > 0.75 ? 'var(--warn)' : 'var(--good)';
  const open = S.open.has(l.id);
  const stopList = stops.map((s) => `<span style="color:var(--ink)">${esc(s.name)} <span style="color:var(--ink-3)">${fmt(s.board || 0)}</span>${s.crowd > 0.15 ? ' <b style="color:var(--bad)">●</b>' : s.feeder ? ' <b style="color:#e8543f" title="Umstieg zur Pulsbahn">⇄</b>' : ''}</span>`).join('');
  const upkeep = TPS.lineUpkeep(g, l);
  const cover = upkeep > 0 ? (l.fares || 0) / upkeep : 0;
  return `<div class="line-card">
  <div class="hd">${badge(l)}<div class="grow"><div class="ttl">${TPS.lineLabel(l)}${l.loop ? ' · Ring' : ''} <span style="font-weight:500;color:var(--ink-3)">· ${esc(stops[0] ? stops[0].name : '')} – ${esc(stops[stops.length - 1] ? stops[stops.length - 1].name : '')}</span></div>
  <div class="sub">${stops.length} Halte · ${l.len.toFixed(0)} Felder · Takt ${taktText(l.takt)} · gestern ${fmt(l.riders)} Fahrgäste</div></div>${spark(l.rHist.slice(-14), col)}</div>
  ${l.broken ? `<p style="color:var(--bad);font-size:12.5px;margin:6px 0 0"><b>Unterbrochen:</b> ${esc(l.broken)}</p>` : ''}
  <div style="margin:8px 0 2px;display:flex;align-items:center;gap:8px;font-size:12.5px"><span style="width:74px;color:var(--ink-3)">Auslastung</span><div style="flex:1">${meter(l.load, loadCol)}</div><b style="width:42px;text-align:right">${pct(l.load)}</b></div>
  ${open ? `<div class="stops" style="color:${col}">${stopList}</div>` : ''}
  <div class="ctrl" style="margin-top:6px">
    <span>${l.mode === 'tram' ? 'Züge' : 'Busse'}: <b>${l.nveh}</b> <span style="color:var(--ink-3)">(Depot ${fleet.used}/${fleet.cap}${fleet.free ? `, ${fleet.free} gratis` : ''})</span></span>
    <span class="grp"><button class="mini" data-act="veh-" data-l="${l.id}" ${l.nveh <= 1 ? 'disabled' : ''} title="Fahrzeug abziehen">−</button><button class="mini" data-act="veh+" data-l="${l.id}" ${fleet.used >= fleet.cap || l.nveh >= TPS.TP.maxVehicles ? 'disabled' : ''} title="${fleet.free ? 'Gratis aus dem Depot' : fmtMoney(vt.cost * g.costMul)}">+</button></span>
    <span>Fahrzeug: <b>${esc(vt.name)}</b> · ${vt.cap} Plätze</span>
    <span class="grp">${nextType !== l.vtype ? `<button class="btn small ghost" data-act="vtype" data-l="${l.id}" data-v="${nextType}" title="${esc(TPS.VEHICLE_TYPES[nextType].desc)}">→ ${esc(TPS.VEHICLE_TYPES[nextType].name)} (${fmtMoney(l.nveh * TPS.VEHICLE_TYPES[nextType].cost * 0.5 * g.costMul)})</button>` : ''}</span>
    <span>Kosten / Fahrgeld gestern</span><span class="grp"><b>${fmtMoney(upkeep)}</b>&nbsp;/&nbsp;<b style="color:${cover >= 1 ? 'var(--good)' : 'var(--ink)'}">${fmtMoney(l.fares || 0)}</b></span>
    <span>Kostendeckung</span><span class="grp"><b style="color:${cover >= 1 ? 'var(--good)' : cover < 0.5 ? 'var(--bad)' : 'var(--ink)'}">${pct(cover)}</b></span>
  </div>
  <div class="acts">
    <button class="btn small ghost" data-act="toggle" data-l="${l.id}">${open ? 'Halte ausblenden' : 'Halte zeigen'}</button>
    <button class="btn small ghost" data-act="showline" data-l="${l.id}">Zeigen</button>
    ${l.loop ? '' : `<button class="btn small ghost" data-act="extend" data-l="${l.id}" data-start="1">Anfang +</button><button class="btn small ghost" data-act="extend" data-l="${l.id}" data-start="0">Ende +</button>`}
    <button class="btn small ghost" data-act="color" data-l="${l.id}" title="Farbe wechseln"><span class="zdot" style="background:${col}"></span> Farbe</button>
    <button class="btn small ghost" data-act="delline" data-l="${l.id}" style="color:var(--bad)">${S.confirmDel === l.id ? 'Wirklich löschen?' : 'Löschen'}</button>
  </div>
</div>`;
  void T;
}

function tabLines(ui) {
  const g = ui.g, T = TPS.TS(g);
  const bus = TPS.fleetInfo(g, 'bus'), tram = TPS.fleetInfo(g, 'tram');
  const busOk = TPS.modeUnlocked(g, 'bus'), tramOk = TPS.modeUnlocked(g, 'tram');
  const fares = [0, 1, 1.5, 2, 2.5, 3, 4];
  const fareMul = clamp(1.3 - T.fare * 0.12, 0.6, 1.3);
  const lines = [...T.lines].sort((a, b) => (a.mode === b.mode ? a.num - b.num : a.mode === 'bus' ? -1 : 1));
  return `
<div class="res-strip"><div><div class="k">Busse</div><div class="v">${bus.used} / ${bus.cap}</div></div><div><div class="k">Straßenbahnen</div><div class="v">${tram.used} / ${tram.cap}</div></div><div><div class="k">Haltestellen</div><div class="v">${T.stops.length}</div></div></div>
<div class="acts" style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
  <button class="btn" data-act="newbus" ${busOk ? '' : 'disabled'} title="${busOk ? '' : esc(TPS.modeLockReason(g, 'bus'))}">${BUS_SVG} Neue Buslinie</button>
  <button class="btn ghost" data-act="newtram" ${tramOk ? '' : 'disabled'} title="${tramOk ? '' : esc(TPS.modeLockReason(g, 'tram'))}">Neue Straßenbahn</button>
  <button class="btn ghost" data-act="stoptool" ${busOk ? '' : 'disabled'}>Haltestelle einfügen</button>
</div>
${!g.hasBuilt('bus_depot') && busOk ? muted('Zuerst ein <b>Busdepot</b> bauen (Verkehr → Busdepot). Jedes Depot stellt 8 Busse.') : ''}
${!busOk ? muted(`Busse gibt es ab „${MILESTONES[BUILDINGS.bus_depot.unlock].name}".`) : ''}
<div class="sec" style="margin-top:6px"><h3>Fahrpreis Bus & Tram</h3>
  <div class="chart-tabs">${fares.map((f) => `<button data-act="fare" data-v="${f}" class="${T.fare === f ? 'on' : ''}">${f === 0 ? 'gratis' : fmtMoney(f).replace(' €', '') + ' €'}</button>`).join('')}</div>
  ${muted(`Fahrgäste ${fareMul >= 1 ? '+' : '−'}${Math.abs(Math.round((fareMul - 1) * 100))} % durch den Preis${T.fare === 0 ? ' · Wohnglück +2' : ''}. Umstiege sind kostenlos.`)}
</div>
${netMap(g)}
${lines.map((l) => lineCard(ui, l)).join('') || muted('Noch keine Linie. „Neue Buslinie" wählen und nacheinander Haltestellen an Straßen anklicken – erneuter Klick auf die letzte Haltestelle, Enter oder Rechtsklick beendet die Linie, ein Klick auf die erste schließt einen Ring.')}
<div class="sec" style="margin-top:14px"><h3>So funktioniert es</h3>${muted(`Jede Haltestelle sammelt Fahrgäste im Umkreis von ${String(TPS.TP.stopRadius).replace(".", ",")} Feldern. Wohnen, Arbeit, Läden und Sehenswürdigkeiten an derselben Linie erzeugen Fahrten; Umstiege zwischen Linien und zur Pulsbahn (⇄) funktionieren von selbst. Je kürzer der Takt, desto mehr Menschen lassen das Auto stehen. Ist ein Abschnitt voll, bleiben Fahrgäste stehen (●) und die Nachbarschaft ärgert sich.`)}</div>`;
}

function status(b, ok) {
  if (b.construct < 1) return '<span class="chip warn">Im Bau</span>';
  if (!b.connected) return '<span class="chip no">Keine Verbindung zur Autobahn</span>';
  if (!b.powered) return '<span class="chip no">Kein Strom</span>';
  return ok ? '<span class="chip ok">In Betrieb</span>' : '';
}
function tabLong(ui) {
  const g = ui.g, T = TPS.TS(g);
  const y = T.day || {};
  const rows = [];
  for (const [bid, R2] of T.rail) {
    const b = g.buildings.get(bid); if (!b) continue;
    rows.push(`<div class="line-card"><div class="hd"><span class="badge" style="background:#d6312b;border-radius:8px">DB</span><div class="grow"><div class="ttl">Hauptbahnhof</div><div class="sub">Feld ${b.x}, ${b.y} · Züge heute ${R2.today} · gestern ${R2.yesterday ?? '–'}</div></div><button class="btn small ghost" data-act="showtile" data-i="${b.y * g.W + b.x}">Zeigen</button></div><div class="chips">${status(b, R2.ok)}</div></div>`);
  }
  for (const [bid, A] of T.air) {
    const b = g.buildings.get(bid); if (!b) continue;
    rows.push(`<div class="line-card"><div class="hd"><span class="badge" style="background:#364fc7;border-radius:8px">✈</span><div class="grow"><div class="ttl">Flughafen</div><div class="sub">Flüge heute ${A.today} · gestern ${A.yesterday ?? '–'}</div></div><button class="btn small ghost" data-act="showtile" data-i="${b.y * g.W + b.x}">Zeigen</button></div><div class="chips">${status(b, A.ok)}</div></div>`);
  }
  for (const f of T.ferries) {
    const a = g.buildings.get(f.a), b = g.buildings.get(f.b);
    rows.push(`<div class="line-card"><div class="hd"><span class="badge" style="background:#0c8599">⛴</span><div class="grow"><div class="ttl">Fährlinie</div><div class="sub">${f.len.toFixed(0)} Felder über das Wasser · gestern ${fmt(f.riders || 0)} Fahrgäste</div></div>${a ? `<button class="btn small ghost" data-act="showtile" data-i="${a.y * g.W + a.x}">Zeigen</button>` : ''}</div></div>`);
    void b;
  }
  const piers = (T.piers || []).length;
  const taxis = (T.taxiDepots || []).length;
  const hubs = [...T.hubs.values()].map((sid) => g.transit.stations.get(sid)).filter(Boolean);
  return `
<div class="res-strip"><div><div class="k">Fernzüge gestern</div><div class="v">${fmt(y.trains || 0)}</div></div><div><div class="k">Flüge gestern</div><div class="v">${fmt(y.flights || 0)}</div></div><div><div class="k">Touristen</div><div class="v">${fmt(y.tourists || 0)}</div></div></div>
<div class="kv" style="margin-bottom:12px">
  <span>Reisende per Zug / Flug gestern</span><span class="v">${fmt(y.trainPax || 0)} / ${fmt(y.flightPax || 0)}</span>
  <span>Fähre · Taxi gestern</span><span class="v">${fmt(y.ferry || 0)} Fahrgäste · ${fmt(y.taxi || 0)} Fahrten</span>
  <span>Einnahmen gestern</span><span class="v">${fmtMoney(y.long || 0)}</span>
</div>
${rows.join('') || ''}
${!T.rail.size ? muted(`<b>Hauptbahnhof</b> (ab „${MILESTONES[BUILDINGS.train_station.unlock].name}"): Fernzüge fahren aus dem Tunnel ein und bringen Touristen, Pendler und Geschäftsreisende – Gewerbe und Büros wachsen.`) : ''}
${!T.air.size ? muted(`<b>Flughafen</b> (ab „${MILESTONES[BUILDINGS.airport.unlock].name}"): Linienflüge, viele Touristen und Büronachfrage – aber sehr laut.`) : ''}
<div class="sec" style="margin-top:12px"><h3>Fähren, Taxis, Parkhäuser</h3><div class="kv">
  <span>Fähranleger</span><span class="v">${piers}${piers === 1 ? ' (braucht einen zweiten am selben Wasser)' : ''}</span>
  <span>Taxizentralen · Taxis unterwegs</span><span class="v">${taxis} · ${T.taxis.filter((t) => t.path).length}</span>
  <span>Parkhäuser</span><span class="v">${(T.parking || []).length}</span>
  <span>Umsteigebahnhöfe</span><span class="v">${hubs.length}${hubs.length ? ' · ' + hubs.map((h) => `${esc(h.name)} ${h.waiting.length}/${BUILDINGS.metro_hub.stationCapacity}`).join(', ') : ''}</span>
</div></div>`;
}

function tabRoads(ui) {
  const g = ui.g, T = TPS.TS(g);
  const manualOn = [...T.signalMode.values()].filter((v) => v === 1).length;
  const manualOff = [...T.signalMode.values()].filter((v) => v === 0).length;
  const pol = ['tempo30', 'bikes', 'tp_buslanes', 'tp_parkfee', 'tp_nightbus'];
  const polRows = pol.map((id) => {
    const p = POLICIES.find((x) => x.id === id);
    if (!p) return '';
    const locked = !g.sandbox && g.milestone < p.unlock;
    const onp = g.policies.has(id);
    return `<div class="toggle${locked ? ' locked' : ''}"><button class="switch${onp ? ' on' : ''}" data-act="policy" data-id="${id}" ${locked ? 'disabled' : ''} aria-label="${esc(p.name)}"></button><div class="grow"><div class="t">${esc(p.name)}</div><div class="s">${esc(p.desc)}${locked ? ` · ab „${MILESTONES[p.unlock].name}"` : ''}</div></div></div>`;
  }).join('');
  const acc = T.accidentLog.slice(0, 6).map((a) => `<div class="row"><span class="grow">Tag ${a.day}, ${String(a.hour).padStart(2, '0')} Uhr · Kreuzung ${a.x}/${a.y}${T.signalSet.has(a.y * g.W + a.x) ? ' · jetzt mit Ampel' : ''}</span><button class="btn small ghost" data-act="showtile" data-i="${a.y * g.W + a.x}">Zeigen</button></div>`).join('');
  return `
<div class="res-strip"><div><div class="k">Ampeln</div><div class="v">${T.signals.length}</div></div><div><div class="k">Unfälle (7 T.)</div><div class="v">${(T.hist.slice(-7).reduce((a, h) => a + (h.acc || 0), 0)) + T.today.accidents}</div></div><div><div class="k">Fluss</div><div class="v">${pct(g.stats.trafficFlow || 1)}</div></div></div>
<div class="acts" style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap"><button class="btn" data-act="signaltool">Ampeln schalten</button><button class="btn ghost" data-act="trafficview">Infoansicht Verkehr</button></div>
${muted(`Große Kreuzungen (mit Allee oder viel Verkehr) bekommen automatisch eine Ampel. Ampeln kosten an jeder Kreuzung etwas Zeit, verhindern aber rund 90 % der Unfälle. Von Hand: ${manualOn} an, ${manualOff} aus.${g.eff('greenWave') > 0 ? ' <b>Grüne Welle aktiv.</b>' : ''}`)}
<div class="sec" style="margin-top:12px"><h3>Letzte Unfälle</h3>${acc || muted('Keine Unfälle bisher.')}</div>
<div class="sec"><h3>Verordnungen für den Verkehr</h3>${polRows}</div>`;
}

// ---------------------------------------------------------------- Panel
registerPanel({
  id: 'transport',
  title: 'Verkehr & ÖPNV',
  icon: BUS_SVG,
  order: 30,
  render(ui) {
    const g = ui.g, T = TPS.TS(g);
    emit('transport:panel', true);
    if (!T) return '<p>Verkehrssystem nicht geladen.</p>';
    const tabs = [['overview', 'Übersicht'], ['lines', `Linien${T.lines.length ? ' · ' + T.lines.length : ''}`], ['long', 'Fernverkehr'], ['roads', 'Straße & Ampeln']];
    const head = `<div class="tp-tabs">${tabs.map(([k, n]) => `<button data-act="tab" data-k="${k}" class="${S.tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    const body = S.tab === 'lines' ? tabLines(ui) : S.tab === 'long' ? tabLong(ui) : S.tab === 'roads' ? tabRoads(ui) : tabOverview(ui);
    return head + body;
  },
  click(ui, act, el) {
    const g = ui.g, input = ui.app.input;
    const res = (r) => { if (r && r.ok === false && r.msg) ui.toast(r.msg, 'bad'); else if (r && r.cost) ui.app.audio.play('money'); };
    const L = +el.dataset.l;
    switch (act) {
      case 'tab': S.tab = el.dataset.k; break;
      case 'chart': S.chart = el.dataset.k; break;
      case 'newbus': input.setTool({ kind: 'buslines', type: 'bus' }); ui.closePanels(); ui.toast('Haltestellen nacheinander an Straßen anklicken. Letzte Haltestelle erneut anklicken, Enter oder Rechtsklick: fertig.'); break;
      case 'newtram': input.setTool({ kind: 'buslines', type: 'tram' }); ui.closePanels(); ui.toast('Haltestellen an Straßen oder Alleen anklicken – die Gleise folgen der Straße.'); break;
      case 'stoptool': input.setTool({ kind: 'buslines', type: 'stop' }); ui.closePanels(); break;
      case 'signaltool': input.setTool({ kind: 'buslines', type: 'signal' }); ui.closePanels(); break;
      case 'trafficview': ui.setView('traffic'); break;
      case 'veh+': { const l = TPS.lineById(g, L); if (l) res(TPS.setVehicles(g, L, l.nveh + 1)); break; }
      case 'veh-': { const l = TPS.lineById(g, L); if (l) res(TPS.setVehicles(g, L, l.nveh - 1)); break; }
      case 'vtype': res(TPS.setVehicleType(g, L, el.dataset.v)); break;
      case 'color': TPS.cycleLineColor(g, L); break;
      case 'toggle': if (S.open.has(L)) S.open.delete(L); else S.open.add(L); break;
      case 'extend': input.setTool({ kind: 'buslines', type: 'extend', line: L, atStart: el.dataset.start === '1' }); ui.closePanels(); ui.toast('Neue Haltestellen anklicken. Enter oder Rechtsklick: fertig.'); break;
      case 'showline': {
        const l = TPS.lineById(g, L);
        if (l && l.path.length) { const t = l.path[Math.floor(l.path.length / 2)]; focus(ui, t % g.W, (t / g.W) | 0, Math.max(18, Math.min(60, l.len * 0.9))); emit('transport:focusLine', l.id); }
        break;
      }
      case 'showtile': { const i = +el.dataset.i; focus(ui, i % g.W, (i / g.W) | 0, 16); if (g.road[i]) ui.inspect({ type: 'road', i }); break; }
      case 'delline':
        if (S.confirmDel === L) { TPS.removeLine(g, L); S.confirmDel = null; ui.app.audio.play('demolish'); }
        else { S.confirmDel = L; setTimeout(() => { S.confirmDel = null; }, 4000); }
        break;
      case 'fare': TPS.setFare(g, +el.dataset.v); break;
      case 'policy': g.togglePolicy(el.dataset.id); break;
    }
  },
  afterRender(ui) {
    const c = document.getElementById('tp-chart');
    if (!c) return;
    const T = TPS.TS(ui.g);
    const h = T.hist;
    const k = S.chart;
    const vals = h.map((e) => (k === 'riders' ? e.riders : k === 'share' ? e.share : k === 'flow' ? e.flow : e.acc) || 0);
    const col = { riders: '#1c7ed6', share: '#2b8a3e', flow: '#5d6470', acc: '#d4433a' }[k];
    drawLineChart(c, vals, { color: col, zero: true, startLabel: h.length ? `Tag ${h[0].d}` : '', endLabel: h.length ? `Tag ${h[h.length - 1].d}` : '', fmt: (v) => Math.round(v).toLocaleString('de-DE') + (k === 'share' || k === 'flow' ? ' %' : '') });
  },
});

// Für Prüfskripte (tools/shot.mjs --eval) und die Konsole
if (typeof window !== 'undefined') window.__stadtpulsTransport = TPS;

// ---------------------------------------------------------------- Inspektor
const hooked = new WeakSet();
function hookInspector(ui) {
  const el = ui.el && ui.el.insp;
  if (!el || hooked.has(el)) return;
  hooked.add(el);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tp]');
    if (!b) return;
    e.stopPropagation();
    const g = ui.g;
    const act = b.dataset.tp;
    ui.app.audio.play('click');
    if (act === 'rmstop') { const r = TPS.removeStop(g, +b.dataset.id); if (r.ok) ui.toast('Haltestelle entfernt.'); }
    else if (act === 'signal') { const r = TPS.cycleSignal(g, +b.dataset.i); if (!r.ok) ui.toast(r.msg, 'bad'); }
    else if (act === 'panel') { ui.openPanel('transport'); return; }
    else if (act === 'lines') { S.tab = 'lines'; ui.openPanel('transport'); return; }
    ui.renderInspector();
  });
}

INSPECTORS.push((ui, sel) => {
  const g = ui.g, T = TPS.TS(g);
  if (!T) return null;
  hookInspector(ui);
  const parts = [];
  if (sel.type === 'road') {
    const st = TPS.stopAtTile(g, sel.i);
    if (st) {
      const lines = st.lines.map((id) => TPS.lineById(g, id)).filter(Boolean);
      parts.push(`<div class="sec" style="margin:12px 0 6px"><h3>Haltestelle ${esc(st.name)}</h3>
      <div class="chips">${lines.map((l) => `<span class="chip" style="background:${hex(TPS.lineColor(l))};color:#fff">${TPS.lineLabel(l)}</span>`).join('') || '<span class="chip no">Keine Linie</span>'}${st.feeder ? '<span class="chip ok">Umstieg zur Pulsbahn</span>' : ''}${st.crowd > 0.15 ? `<span class="chip no">Überfüllt · ${pct(st.crowd)} bleiben stehen</span>` : ''}</div>
      <div class="kv"><span>Takt</span><span class="v">${taktText(st.takt)}</span><span>Wartende</span><span class="v">${st.waiting}</span><span>Eingestiegen gestern</span><span class="v">${fmt(st.board || 0)}</span><span>Ausgestiegen gestern</span><span class="v">${fmt(st.alight || 0)}</span><span>Einzugsgebiet</span><span class="v">${fmt(st.w[1])} Bew. · ${fmt(st.w[2] + st.w[3] + st.w[4])} Jobs</span></div>
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button class="btn small" data-tp="lines">Linien</button><button class="btn small ghost" data-tp="rmstop" data-id="${st.id}" style="color:var(--bad)">Haltestelle entfernen</button></div></div>`);
    }
    const sg = TPS.signalState(g, sel.i);
    if (sg.possible) {
      parts.push(`<div class="sec" style="margin:10px 0 6px"><h3>Kreuzung</h3><div class="kv"><span>Ampel</span><span class="v">${sg.on ? 'an' : 'aus'} (${sg.mode === 'auto' ? 'automatisch' : 'von Hand'})</span><span>Unfälle hier</span><span class="v">${T.accidentLog.filter((a) => a.y * g.W + a.x === sel.i).length}</span></div>
      <button class="btn small ghost" style="margin-top:6px" data-tp="signal" data-i="${sel.i}">Umschalten: ${sg.mode === 'auto' ? 'immer an' : sg.mode === 'an' ? 'immer aus' : 'automatisch'}</button></div>`);
    }
    const onLines = T.lines.filter((l) => l.path && l.path.includes(sel.i));
    if (onLines.length && !st) parts.push(`<p style="font-size:12.5px;color:var(--ink-2);margin:8px 0 0">Linienweg: ${onLines.map((l) => `<b style="color:${hex(TPS.lineColor(l))}">${TPS.lineLabel(l)}</b>`).join(', ')}</p>`);
  } else if (sel.type === 'building') {
    const b = g.buildings.get(sel.id);
    if (!b) return null;
    if (b.zone) {
      const i = b.y * g.W + b.x;
      let best = null, bd = 1e9;
      for (const s of T.stops) { if (!s.active) continue; const d = Math.hypot(s.x - b.x, s.y - b.y); if (d < bd) { bd = d; best = s; } }
      if (best && bd <= TPS.TP.stopRadius + 0.5) parts.push(`<p style="font-size:12.5px;color:var(--ink-2);margin:6px 0 0">Haltestelle ${esc(best.name)} in ${bd.toFixed(0)} Feldern · Takt ${taktText(best.takt)}${T.covField ? ` · Anbindung ${pct(T.covField[i])}` : ''}</p>`);
      else if (b.zone === Z.RES && T.lines.length) parts.push(`<p style="font-size:12.5px;color:var(--ink-3);margin:6px 0 0">Keine Bus- oder Tramhaltestelle in Reichweite.</p>`);
    } else {
      const k = b.key;
      if (k === 'bus_depot' || k === 'tram_depot') {
        const mode = k === 'tram_depot' ? 'tram' : 'bus';
        const f = TPS.fleetInfo(g, mode);
        parts.push(`<div class="kv" style="margin-top:8px"><span>${mode === 'tram' ? 'Straßenbahnen' : 'Busse'} im Einsatz</span><span class="v">${f.used} / ${f.cap}</span><span>Linien</span><span class="v">${T.lines.filter((l) => l.mode === mode).length}</span></div><button class="btn small" style="margin-top:6px" data-tp="lines">Linien verwalten</button>`);
      } else if (k === 'train_station') {
        const R2 = T.rail.get(b.id);
        if (R2) parts.push(`<div class="kv" style="margin-top:8px"><span>Züge heute / gestern</span><span class="v">${R2.today} / ${R2.yesterday ?? '–'}</span><span>Letzter Zug</span><span class="v">${R2.lastPax ? fmt(R2.lastPax) + ' Fahrgäste' : '–'}</span></div>`);
      } else if (k === 'airport') {
        const A = T.air.get(b.id);
        if (A) parts.push(`<div class="kv" style="margin-top:8px"><span>Flüge heute / gestern</span><span class="v">${A.today} / ${A.yesterday ?? '–'}</span><span>Maschinen am Boden</span><span class="v">${A.flights.length}</span></div>`);
      } else if (k === 'ferry_pier') {
        const f = T.ferries.find((x) => x.a === b.id || x.b === b.id);
        parts.push(`<p style="font-size:12.5px;color:var(--ink-2);margin:8px 0 0">${f ? `Fährlinie über ${f.len.toFixed(0)} Felder · gestern ${fmt(f.riders || 0)} Fahrgäste` : 'Noch keine Fährlinie: Ein zweiter Anleger am selben Gewässer verbindet sich automatisch.'}</p>`);
      } else if (k === 'taxi_depot') {
        parts.push(`<p style="font-size:12.5px;color:var(--ink-2);margin:8px 0 0">${T.taxis.filter((t) => t.depot === b.id && t.path).length} Taxis unterwegs · gestern ${fmt((T.day && T.day.taxi) || 0)} Fahrten in der Stadt</p>`);
      } else if (k === 'parking') {
        parts.push(`<p style="font-size:12.5px;color:var(--ink-2);margin:8px 0 0">Weniger Parksuchverkehr im Umkreis von 4 Feldern (−15 % Stau), Geschäfte +3 Glück.</p>`);
      } else if (k === 'metro_hub') {
        const sid = T.hubs.get(b.id);
        const st = sid && g.transit.stations.get(sid);
        if (st) parts.push(`<div class="kv" style="margin-top:8px"><span>Station</span><span class="v">${esc(st.name)}</span><span>Wartende</span><span class="v">${st.waiting.length} / ${BUILDINGS.metro_hub.stationCapacity}</span></div>`);
      }
    }
  } else if (sel.type === 'station') {
    const isHub = [...T.hubs.values()].includes(sel.id);
    const feeders = T.stops.filter((s) => s.feeder === sel.id);
    if (isHub) parts.push(`<p style="font-size:12.5px;color:var(--ink-2);margin:8px 0 0"><b>Umsteigebahnhof:</b> bis ${BUILDINGS.metro_hub.stationCapacity} Wartende ohne Überfüllung, Züge halten kürzer.</p>`);
    if (feeders.length) parts.push(`<p style="font-size:12.5px;color:var(--ink-2);margin:6px 0 0">Umstieg zu Bus/Tram: ${feeders.map((s) => esc(s.name)).join(', ')}</p>`);
  }
  return parts.length ? parts.join('') : null;
});
