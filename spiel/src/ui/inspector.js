// Inspektor: Infokarte für Gebäude, Stationen, Straßen und Felder – mit 3D-Porträt aus dem Prototyp-System,
// Stufenanzeige im Netzplan-Stil, Glücksfaktoren als Balken und Zusätzen anderer Module (INSPECTORS).
import { BUILDINGS, ZONE_INFO, ROADS, Z, MILESTONES, TRANSIT, LEVELS, T, RES } from '../config.js';
import { INSPECTORS } from '../registry.js';
import { fmt, fmtMoney } from '../util.js';
import { LINE_COLORS, LINE_COLOR_NAMES } from '../sim/transit.js';
import { happinessFactors } from '../sim/services.js';
import { archKeyFor, frontFootprint } from '../render/arch/all.js';
import { icon } from './icons.js';
import { catMeta } from './meta.js';
import { getThumb, thumbId, hasArch } from './thumbs.js';
import { meterHTML } from './charts.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const ZONE_LEVEL_NAMES = {
  1: ['', 'Häuschen', 'Einfamilienhaus', 'Stadthaus', 'Wohnblock', 'Wohnturm'],
  2: ['', 'Kiosk', 'Ladenzeile', 'Kaufhaus', 'Geschäftshaus', 'Einkaufsturm'],
  3: ['', 'Werkstatt', 'Fabrik', 'Werk', 'Großwerk', 'Hightech-Werk'],
  4: ['', 'Kanzlei', 'Bürohaus', 'Bürokomplex', 'Büroturm', 'Wolkenkratzer'],
};
const SPEC_NAMES = { farm: 'Bauernhof', mine: 'Bergwerk', forest: 'Forstbetrieb', oil: 'Ölfeld' };

function portrait(b, color) {
  const key = archKeyFor(b);
  if (!hasArch(key)) return `<div class="portrait art" style="--c:${color}">${icon(b.zone ? 'house' : catMeta(BUILDINGS[b.key]?.cat || 'mehr').icon, 40, 1.6)}</div>`;
  const def = BUILDINGS[b.key];
  const [fw, fd] = frontFootprint(b, def && def.size);
  const spec = { key, level: b.level || 1, variant: b.variant || 0, fw, fd, extra: { zone: b.zone, spec: b.spec } };
  const url = getThumb(spec, 5);
  return url ? `<div class="portrait" style="--c:${color}"><img class="thumb" src="${url}" alt=""></div>` : `<div class="portrait" style="--c:${color}"><span class="ph" data-thumb="${esc(thumbId(spec))}" style="--c:${color}">${icon('house', 34, 1.6)}</span></div>`;
}

const head = (stripe, title, sub, pic = '') => `<div class="stripe" style="background:${stripe}"></div>
<header>${pic}<div class="grow"><h2>${title}</h2><div class="sub">${sub}</div></div><div class="hbtns"><button class="close" data-act="focus" data-tip="Hinfliegen" data-tip-fast="1">${icon('target', 16)}</button><button class="close" data-act="close" aria-label="Schließen">${icon('close', 16)}</button></div></header>`;

const pips = (level, color) => `<span class="pips" style="--c:${color}">${[1, 2, 3, 4, 5].map((k) => `<i class="${k <= level ? 'on' : ''}"></i>`).join('')}</span>`;

export function inspectorHTML(ui) {
  const s = ui.sel, g = ui.g;
  if (!s) return '';
  let html = '';
  if (s.type === 'building') {
    const b = g.buildings.get(s.id);
    if (!b) return null;
    html = b.zone ? inspZone(ui, b) : inspService(ui, b);
  } else if (s.type === 'station') {
    const st = g.transit.stations.get(s.id);
    if (!st) return null;
    html = inspStation(ui, st);
  } else if (s.type === 'road') {
    const i = s.i, r = g.road[i];
    if (!r) return null;
    const d = ROADS[r];
    const cong = g.congestion[i];
    html = `${head('#5d6470', d.name, `${g.world.terrain[i] === T.WATER ? 'Brücke · ' : ''}Feld ${i % g.W}, ${Math.floor(i / g.W)}`)}
<div class="body"><div class="kv"><span>Verkehr pro Stunde</span><span class="v">${fmt(g.trafficLoad[i])}</span><span>Kapazität</span><span class="v">${fmt(d.capacity)}</span><span>Auslastung</span><span class="v ${cong > 0.9 ? 'neg' : ''}">${Math.round(cong * 100)} %</span></div>
${meterHTML(cong, 1, cong > 0.9 ? 'var(--bad)' : cong > 0.6 ? 'var(--warn)' : 'var(--good)')}
<p class="desc">${esc(d.desc)}</p></div>`;
  } else if (s.type === 'tile') {
    const i = s.i;
    const ter = ['Wiese', 'Wasser', 'Strand', 'Fels'][g.world.terrain[i]] || 'Gelände';
    const res = g.world.resource[i] === RES.FERTILE ? 'fruchtbarer Boden' : g.world.resource[i] === RES.ORE ? 'Erzvorkommen' : g.world.resource[i] === RES.OIL ? 'Ölvorkommen' : '';
    html = `${head('#9bc887', ter + (res ? ' · ' + res : ''), `Feld ${i % g.W}, ${Math.floor(i / g.W)}${g.zone[i] ? ' · Zone ' + ZONE_INFO[g.zone[i]].name : ''}`)}
<div class="body"><div class="kv"><span>Bodenwert</span><span class="v">${Math.round(g.fields.landValue[i])}</span><span>Verschmutzung</span><span class="v">${Math.round(g.fields.pollution[i] * 100)} %</span><span>Lärm</span><span class="v">${Math.round(g.fields.noise[i] * 100)} %</span>${g.world.trees[i] ? '<span>Wald</span><span class="v">ja</span>' : ''}</div>
${g.zone[i] && !g.bld[i] ? `<p class="desc">${g.access[i] < 0 ? 'Keine Straße in Reichweite (max. 2 Felder).' : g.roadComp[g.access[i]] !== g.outsideComp ? 'Die Straße ist nicht mit der Autobahn verbunden.' : g.demand[g.zone[i]] <= 4 ? 'Wartet auf Nachfrage.' : 'Bereit zum Bebauen.'}</p>` : ''}</div>`;
  }
  for (const fn of INSPECTORS) {
    try { const extra = fn(ui, s); if (extra) html = html.replace(/<\/div>\s*$/, `<div class="ext">${extra}</div></div>`); } catch (e) { console.error(e); }
  }
  return html;
}

function inspZone(ui, b) {
  const g = ui.g, i = b.y * g.W + b.x;
  const col = hex(ZONE_INFO[b.zone].color);
  const title = SPEC_NAMES[b.spec] || ZONE_LEVEL_NAMES[b.zone][b.level];
  const factors = [];
  const target = happinessFactors(g, b, factors);
  factors.sort((a, c) => Math.abs(c[1]) - Math.abs(a[1]));
  const chip = (ok, txt) => `<span class="chip ${ok ? 'ok' : 'no'}">${txt}</span>`;
  const L = LEVELS[b.zone];
  const ml = g.maxLevelAt(b.x, b.y);
  let next = '';
  if (b.abandoned) next = '<span class="chip no">Verlassen – wird bald abgerissen</span>';
  else if (b.construct < 1) next = `<span class="chip warn">Im Bau · ${Math.round(b.construct * 100)} %</span>`;
  else if (b.level >= 5) next = 'Höchste Stufe erreicht.';
  else if (b.level >= ml) next = g.trackCount[i] > 0 && ml === TRANSIT.maxLevelUnderTrack ? 'Unter der Hochbahn ist keine höhere Stufe möglich.' : g.policies.has('lowrise') && ml === 3 ? 'Hochhausverbot begrenzt die Höhe.' : `Höhere Stufen ab Meilenstein „${MILESTONES[[0, 0, 2, 3, 4, 4][b.level + 1] ?? 4].name}".`;
  else {
    const need = L.need[b.level + 1];
    const score = b.zone === Z.IND ? null : g.fields.landValue[i];
    const parts = [];
    if (score !== null) parts.push(`Bodenwert ${Math.round(score)} / ${need}`);
    else parts.push(`Infrastruktur ${need}+ (Dienste, Müll)`);
    if (L.edu[b.level + 1] > 0) parts.push(`Bildung ${Math.round((b.zone === Z.RES ? b.edu : g.stats.edu) * 100)} / ${Math.round(L.edu[b.level + 1] * 100)} %`);
    if (b.happy < 45) parts.push(`Glück ${Math.round(b.happy)} / 45`);
    next = `Für Stufe ${b.level + 1}: ${parts.join(' · ')}`;
  }
  const occLabel = b.zone === Z.RES ? 'Bewohner' : 'Beschäftigte';
  const fmax = Math.max(4, ...factors.map((f) => Math.abs(f[1])));
  return `${head(col, esc(title), `${ZONE_INFO[b.zone].name} · Feld ${b.x}, ${b.y}`, portrait(b, col))}
<div class="body">
  <div class="lvl"><span>Stufe ${b.level}</span>${pips(b.level, col)}</div>
  <div class="chips">${chip(b.connected, 'Straße')}${chip(b.powered, 'Strom')}${chip(b.watered, 'Wasser')}${chip(g.cov.garbage[i] > 0.3, 'Müllabfuhr')}${b.burning ? '<span class="chip no">Brennt!</span>' : ''}${g.cov.transit[i] > 0 ? '<span class="chip ok">Pulsbahn</span>' : ''}</div>
  <div class="kv"><span>${occLabel}</span><span class="v">${fmt(b.occ)} / ${fmt(b.cap)}</span>
  <span>Glück</span><span class="v ${b.happy < 40 ? 'neg' : ''}">${Math.round(b.happy)} % → ${Math.round(target)} %</span>
  <span>Bodenwert</span><span class="v">${Math.round(g.fields.landValue[i])}</span>
  ${b.zone === Z.RES ? `<span>Bildung</span><span class="v">${Math.round(b.edu * 100)} %</span><span>Pendelzeit</span><span class="v">${Math.round(b.commute)} Min.</span>` : ''}
  </div>
  <div class="sec"><h3>Was das Glück beeinflusst</h3><div class="fbars">${factors.slice(0, 9).map(([l, v]) => `<div class="fb"><span class="fl">${esc(l)}</span><span class="ft"><i class="${v < 0 ? 'n' : 'p'}" style="width:${(Math.abs(v) / fmax) * 50}%"></i></span><span class="fv ${v < 0 ? 'neg' : 'pos'}">${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(0)}</span></div>`).join('') || '<p class="empty">Alles im Lot.</p>'}</div></div>
  <p class="desc">${next}</p>
  <div class="acts"><button class="btn small ghost danger-t" data-act="demolish">${icon('bulldoze', 14)} Abreißen</button></div>
</div>`;
}

function inspService(ui, b) {
  const g = ui.g, d = BUILDINGS[b.key];
  if (!d) return `${head('#999', 'Gebäude', `Feld ${b.x}, ${b.y}`)}<div class="body"></div>`;
  const facts = [];
  if (d.power) facts.push(['Stromerzeugung', `${fmt(d.power * g.mods.power)} MW`]);
  if (d.water) facts.push(['Wasserförderung', `${fmt(d.water * g.mods.water)} m³${b.powered ? '' : ' (ohne Strom: 0)'}`]);
  if (d.service) facts.push(['Reichweite', `${d.service.radius} Felder`]);
  if (d.tourism) facts.push(['Touristen', `${d.tourism} / Tag`]);
  if (d.park) facts.push(['Erholung', `Radius ${d.parkRadius}`]);
  if (d.jobs) facts.push(['Arbeitsplätze', fmt(d.jobs)]);
  facts.push(['Unterhalt', `${fmtMoney(d.upkeep * g.upkeepMul() * (g.serviceBudget[d.cat] ?? 1))} / Tag`]);
  const cm = catMeta(d.cat);
  const col = cm.color;
  const load = d.service ? b.load || 0 : null;
  return `${head(col, esc(d.name), `${esc(cm.name)} · Feld ${b.x}, ${b.y}`, portrait(b, col))}
<div class="body">
  <div class="chips"><span class="chip ${b.connected || b.comp >= 0 ? 'ok' : 'no'}">Straße</span><span class="chip ${b.powered ? 'ok' : d.power ? 'ok' : 'no'}">${d.power ? 'Kraftwerk' : 'Strom'}</span>${d.unique ? '<span class="chip">Einmalig</span>' : ''}${b.construct < 1 ? `<span class="chip warn">Im Bau · ${Math.round(b.construct * 100)} %</span>` : ''}${b.burning ? '<span class="chip no">Brennt!</span>' : ''}</div>
  <div class="kv">${facts.map(([k, v]) => `<span>${k}</span><span class="v">${v}</span>`).join('')}</div>
  ${load !== null ? `<div class="kv" style="margin-top:6px"><span>Auslastung</span><span class="v ${load > 1 ? 'neg' : ''}">${Math.round(load * 100)} %</span></div>${meterHTML(load, 1, load > 1 ? 'var(--bad)' : load > 0.85 ? 'var(--warn)' : col)}` : ''}
  <p class="desc">${esc(d.desc)}</p>
  <div class="acts"><button class="btn small ghost danger-t" data-act="demolish">${icon('bulldoze', 14)} Abreißen (+${fmtMoney(d.cost * g.costMul * 0.4)})</button></div>
</div>`;
}

function inspStation(ui, st) {
  const g = ui.g, tr = g.transit;
  const lines = tr.lines.filter((l) => l.stops.includes(st.id));
  const byShape = [0, 0, 0, 0, 0];
  for (const p of st.waiting) byShape[p.shape]++;
  const sym = ['', '●', '▲', '■', '◆'];
  const over = st.over > 0.02 ? `<span class="chip no">Überfüllt · ${Math.round(st.over * 100)} %</span>` : '';
  const cap = TRANSIT.stationCapacity;
  return `${head(lines.length ? hex(LINE_COLORS[lines[0].color]) : '#999', esc(st.name), 'Pulsbahn-Station · Feld ' + st.x + ', ' + st.y, `<div class="portrait art roundel" style="--c:${lines.length ? hex(LINE_COLORS[lines[0].color]) : '#999'}">${icon('station', 34, 2)}</div>`)}
<div class="body">
  <div class="chips">${lines.map((l) => `<span class="chip" style="background:${hex(LINE_COLORS[l.color])};color:#fff">Linie ${LINE_COLOR_NAMES[l.color]}</span>`).join('') || '<span class="chip no">Keine Linie</span>'}${over}</div>
  <div class="kv"><span>Wartende Fahrgäste</span><span class="v ${st.waiting.length > cap ? 'neg' : ''}">${st.waiting.length} / ${cap}</span></div>
  ${meterHTML(st.waiting.length, cap, st.waiting.length > cap ? 'var(--bad)' : 'var(--l-blue)')}
  <div class="kv" style="margin-top:6px"><span>Ziele</span><span class="v">${[1, 2, 3, 4].map((z) => `${sym[z]} ${byShape[z]}`).join('  ')}</span>
  <span>Einzugsgebiet</span><span class="v">${fmt(st.w[1])} Bew. · ${fmt(st.w[2] + st.w[3] + st.w[4])} Jobs</span>
  <span>Fahrgäste angekommen</span><span class="v">${fmt(st.served)}</span></div>
  <div class="acts"><button class="btn small" data-act="linefrom">${icon('line', 14)} Linie von hier</button><button class="btn small ghost danger-t" data-act="demolish">Abreißen</button></div>
</div>`;
}

export function inspectorClick(ui, e) {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const g = ui.g, s = ui.sel;
  const act = b.dataset.act;
  if (act === 'close') { ui.closeInspector(); return; }
  if (act === 'focus') { const box = ui.selectedBox(); if (box) ui.focusTile(box.x + (box.w - 1) / 2, box.y + (box.h - 1) / 2, 16); return; }
  if (act === 'demolish' && s) {
    const tiles = [];
    if (s.type === 'building') { const bd = g.buildings.get(s.id); if (bd) for (let y = bd.y; y < bd.y + bd.h; y++) for (let x = bd.x; x < bd.x + bd.w; x++) tiles.push(y * g.W + x); }
    else if (s.type === 'station') { const st = g.transit.stations.get(s.id); if (st) { g.transit.removeStation(st.id); g.afterTransitChange(); ui.closeInspector(); ui.app.audio.play('demolish'); return; } }
    const r = g.bulldoze(tiles);
    if (r.ok) ui.app.audio.play('demolish');
    ui.closeInspector();
    return;
  }
  if (act === 'linefrom' && s && s.type === 'station') {
    ui.app.input.setTool({ kind: 'line' });
    ui.app.input.lineStops = [s.id];
    ui.closeInspector();
  }
}
