// Panel „Bezirke" (Besitzer S2): Werkzeuge, Liste, Kennzahlen je Bezirk, Steuerzuschläge und Verordnungen.
import { registerPanel, INSPECTORS } from '../../registry.js';
import { MILESTONES } from '../../config.js';
import { fmt, fmtMoney, clamp } from '../../util.js';
import { districtsOf, districtStats, computeDistrictStats, renameDistrict, deleteDistrict, cycleDistrictColor, toggleDistrictPolicy, setDistrictTax, DISTRICT_POLICIES, districtAt, anchorTile, MAX_DISTRICTS } from '../../sim/systems/districts.js';
import { districtTool, BRUSH_MAX } from '../../input/districts.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const css = (n) => '#' + n.toString(16).padStart(6, '0');
const pct = (v) => `${Math.round(v * 100)} %`;
const MAP_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z"/><path d="M9 4v14M15 6v14"/><circle cx="12" cy="11" r="2" fill="currentColor"/></svg>';
const view = { sel: 0, confirmDel: 0 };

function ensureStyles() {
  if (typeof document === 'undefined' || document.getElementById('dist-styles')) return;
  const st = document.createElement('style');
  st.id = 'dist-styles';
  st.textContent = `
.dt-tools { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin-bottom:8px; }
.dt-tools button { background:var(--paper-2); border-radius:10px; padding:7px 4px; font-size:12px; font-weight:700; line-height:1.15; border:2px solid transparent; }
.dt-tools button.on { border-color:var(--ink); background:#fff; }
.dt-tools button:disabled { opacity:.45; }
.dt-brush { display:flex; align-items:center; gap:4px; margin-bottom:12px; font-size:12.5px; color:var(--ink-2); }
.dt-brush button { width:28px; height:28px; border-radius:8px; background:var(--paper-2); font-family:var(--f-num); font-weight:650; }
.dt-brush button.on { background:var(--ink); color:var(--paper); }
.dt-card { border-radius:12px; background:var(--paper-2); padding:9px 11px; margin-bottom:8px; border:2px solid transparent; }
.dt-card.sel { border-color:var(--ink); background:#fff; }
.dt-card .hd { display:flex; align-items:center; gap:10px; }
.dt-card .sw { width:26px; height:26px; border-radius:8px; flex:none; box-shadow: inset 0 0 0 2px rgba(255,255,255,.55); }
.dt-card .nm { font-weight:700; font-size:14.5px; }
.dt-card .sub { font-size:12px; color:var(--ink-3); }
.dt-card .acts { display:flex; gap:5px; margin-top:7px; flex-wrap:wrap; }
.dt-card .pol { display:flex; gap:4px; flex-wrap:wrap; margin-top:6px; }
.dt-card .pol span { font-size:10.5px; font-weight:700; padding:2px 7px; border-radius:999px; background:rgba(0,0,0,.06); color:var(--ink-2); }
.dt-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin:8px 0 12px; }
.dt-grid div { background:var(--paper-2); border-radius:9px; padding:6px 8px; }
.dt-grid .k { font-size:11px; color:var(--ink-3); font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dt-grid .v { font-family:var(--f-num); font-size:18px; font-weight:600; }
.dt-grid .v.neg { color:var(--bad); }
.dt-ages { display:flex; height:12px; border-radius:5px; overflow:hidden; background:var(--paper-3); margin:4px 0 2px; }
.dt-ages i { display:block; height:100%; }
.dt-tax { display:grid; grid-template-columns:1fr 64px; gap:10px; align-items:center; }
.dt-tax .val { font-family:var(--f-num); font-weight:650; font-size:16px; text-align:right; }
.dt-group { font-size:10.5px; letter-spacing:.12em; text-transform:uppercase; color:var(--ink-3); font-weight:700; margin:10px 0 0; }
.dt-note { font-size:12.5px; color:var(--ink-2); line-height:1.45; margin:6px 0 0; }
.dt-cmp { display:grid; grid-template-columns: minmax(0,1fr) auto auto auto auto; gap:3px 10px; font-size:12.5px; align-items:center; }
.dt-cmp span { font-family:var(--f-num); font-weight:600; text-align:right; }
.dt-cmp span.h { font-family:var(--f-ui); font-size:10.5px; color:var(--ink-3); font-weight:700; text-align:right; }
.dt-cmp span.h:first-child { text-align:left; }
.dt-cmp span.n { font-family:var(--f-ui); text-align:left; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:6px; }
.dt-cmp span.n i { width:9px; height:9px; border-radius:50%; flex:none; }
.dt-cmp span.neg { color:var(--bad); }
.dt-chip { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:700; padding:3px 9px 3px 6px; border-radius:999px; background:var(--paper-2); }
.dt-chip i { width:10px; height:10px; border-radius:50%; display:inline-block; }
`;
  document.head.appendChild(st);
}

const locked = (g) => (g.sandbox || g.milestone >= 1 ? null : `Bezirke gibt es ab „${MILESTONES[1].name}" (${MILESTONES[1].pop} Einwohner).`);

function focusDistrict(ui, id) {
  const g = ui.g, D = districtsOf(g);
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < g.N; i++) if (D.map[i] === id) { sx += i % g.W; sy += (i / g.W) | 0; n++; }
  if (!n) return;
  ui.app.engine.rig.focus(sx / n + 0.5 - g.W / 2, sy / n + 0.5 - g.H / 2, clamp(Math.sqrt(n) * 2.2 + 14, 18, 80));
}

function openRename(ui, d) {
  const html = `<div class="modal"><div class="eyebrow">Bezirk</div><h2>Umbenennen</h2><div class="field"><label for="dist-name">Neuer Name</label><input type="text" id="dist-name" maxlength="32" value="${esc(d.name)}" autocomplete="off"></div><div class="acts"><button class="btn ghost" data-act="cancel">Abbrechen</button><button class="btn" data-act="ok">Übernehmen</button></div></div>`;
  let wrap = null;
  const done = (ok) => {
    if (ok) {
      const v = wrap.querySelector('#dist-name').value;
      if (renameDistrict(ui.g, d.id, v)) ui.toast(`Der Bezirk heißt jetzt „${v.trim()}".`, 'good');
    }
    wrap.remove();
    ui.nextModal();
    if (ui.panel === 'districts') ui.renderPanel();
  };
  wrap = ui.openModal(html, (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    done(b.dataset.act === 'ok');
  });
  const inp = wrap.querySelector('#dist-name');
  setTimeout(() => { inp.focus(); inp.select(); }, 30);
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); done(true); }
    else if (e.key === 'Escape') { e.preventDefault(); done(false); }
    e.stopPropagation();
  });
}

function toolRow(ui) {
  const t = ui.app.input ? ui.app.input.tool : { kind: 'select' };
  const lk = locked(ui.g);
  const btn = (type, label) => `<button data-act="tool" data-t="${type}" class="${t.kind === 'district' && (t.type || 'paint') === type ? 'on' : ''}" ${lk ? 'disabled' : ''}>${label}</button>`;
  const brush = [];
  for (let k = 1; k <= BRUSH_MAX; k++) brush.push(`<button data-act="brush" data-n="${k}" class="${districtTool.brush === k ? 'on' : ''}">${k}</button>`);
  return `<div class="dt-tools">${btn('paint', 'Malen')}${btn('fill', 'Block füllen')}${btn('new', 'Neuer Bezirk')}${btn('erase', 'Radieren')}</div>
<div class="dt-brush"><span style="margin-right:4px">Pinsel</span>${brush.join('')}<span style="margin-left:auto;color:var(--ink-3);font-size:11.5px" data-tip="Pinselgröße ändern" data-tip-desc="Tasten , und . auf der Tastatur">Tasten , / .</span></div>${lk ? `<p class="dt-note" style="color:var(--bad)">${lk}</p>` : ''}`;
}

function card(ui, d) {
  const s = districtStats(ui.g, d.id) || {};
  const sel = view.sel === d.id;
  const active = districtTool.active === d.id;
  const pols = d.policies.map((pid) => DISTRICT_POLICIES.find((p) => p.id === pid)).filter(Boolean);
  return `<div class="dt-card ${sel ? 'sel' : ''}">
  <div class="hd"><button class="sw" style="background:${css(d.color)}" data-act="color" data-id="${d.id}" title="Farbe wechseln"></button>
    <div style="flex:1;min-width:0"><div class="nm">${esc(d.name)}${active ? ' <span style="font-size:10.5px;color:var(--ink-3);font-weight:700">· AKTIV</span>' : ''}</div>
    <div class="sub">${fmt(s.residents || 0)} Einw. · ${fmt(s.jobs || 0)} Jobs · Glück ${Math.round(s.happiness || 0)} % · ${fmt(s.tiles || 0)} Felder</div></div></div>
  ${(() => { const w = []; if (s.dead) w.push(`${fmt(s.dead)} Verstorbene warten`); if (s.unsewered) w.push(`${fmt(s.unsewered)} ohne Kanal`); if (s.abandoned) w.push(`${fmt(s.abandoned)} verlassen`); if ((s.sickShare || 0) > 0.1) w.push(`${pct(s.sickShare)} krank`); if ((s.crime || 0) > 0.4) w.push('hohe Kriminalität'); return w.length ? `<div class="pol">${w.map((x) => `<span style="background:#f6dcd8;color:#9e2b23">${x}</span>`).join('')}</div>` : ''; })()}
  ${pols.length || d.tax ? `<div class="pol">${d.tax ? `<span>Steuern ${d.tax > 0 ? '+' : '−'}${Math.abs(d.tax)} %</span>` : ''}${pols.map((p) => `<span>${esc(p.name)}</span>`).join('')}</div>` : ''}
  <div class="acts"><button class="btn small ${sel ? '' : 'ghost'}" data-act="sel" data-id="${d.id}">${sel ? 'Ausgewählt' : 'Details'}</button><button class="btn small ghost" data-act="paintin" data-id="${d.id}">Malen</button><button class="btn small ghost" data-act="show" data-id="${d.id}">Zeigen</button><button class="btn small ghost" data-act="rename" data-id="${d.id}">Umbenennen</button></div>
</div>`;
}

function details(ui, d) {
  const g = ui.g;
  const s = districtStats(g, d.id) || {};
  const agesTot = (s.ages || []).reduce((a, b) => a + b, 0) || 1;
  const ageCols = ['#f2b01e', '#22a866', '#2f8fe0', '#8f5ad8'];
  const ages = (s.ages || [0, 0, 0, 0]).map((v, k) => `<i style="width:${(v / agesTot) * 100}%;background:${ageCols[k]}"></i>`).join('');
  const groups = {};
  for (const p of DISTRICT_POLICIES) (groups[p.group] ||= []).push(p);
  const res = s.residents || 0;
  const pols = Object.entries(groups).map(([grp, list]) => `<div class="dt-group">${grp}</div>` + list.map((p) => {
    const on = d.policies.includes(p.id);
    const cost = p.cost * (res + (s.jobs || 0) * 0.5) / 100;
    return `<div class="toggle"><button class="switch${on ? ' on' : ''}" data-act="dpol" data-id="${d.id}" data-p="${p.id}" aria-label="${esc(p.name)}"></button><div class="grow"><div class="t">${esc(p.name)}</div><div class="s">${esc(p.desc)} ${p.cost ? `· ${fmtMoney(cost)}/Tag` : '· kostenlos'}</div></div></div>`;
  }).join('')).join('');
  const zoneTxt = (s.byZone || [0, 0, 0, 0, 0]).slice(1).join(' / ');
  return `<div class="sec" style="margin-top:4px"><h3>${esc(d.name)} im Detail</h3>
<div class="dt-grid">
  <div><div class="k">Einwohner</div><div class="v">${fmt(res)}</div></div>
  <div><div class="k">Arbeitsplätze</div><div class="v">${fmt(s.jobs || 0)}</div></div>
  <div><div class="k">Glück</div><div class="v ${(s.happiness || 0) < 40 ? 'neg' : ''}">${Math.round(s.happiness || 0)} %</div></div>
  <div><div class="k">Bodenwert</div><div class="v">${Math.round(s.lv || 0)}</div></div>
  <div><div class="k">Bildung</div><div class="v">${pct(s.edu || 0)}</div></div>
  <div><div class="k">Krankenstand</div><div class="v ${(s.sickShare || 0) > 0.08 ? 'neg' : ''}">${pct(s.sickShare || 0)}</div></div>
  <div><div class="k">Kriminalität</div><div class="v ${(s.crime || 0) > 0.35 ? 'neg' : ''}">${pct(s.crime || 0)}</div></div>
  <div><div class="k">Lärm</div><div class="v">${pct(s.noise || 0)}</div></div>
  <div><div class="k">Abgase</div><div class="v ${(s.pollution || 0) > 0.3 ? 'neg' : ''}">${pct(s.pollution || 0)}</div></div>
</div>
<div class="kv"><span>Gebäude W / G / I / B</span><span class="v">${zoneTxt}</span><span>Dienstgebäude</span><span class="v">${fmt(s.services || 0)}</span>
${s.dead ? `<span>Verstorbene warten</span><span class="v neg">${fmt(s.dead)}</span>` : ''}${s.unsewered ? `<span>Ohne Kanalanschluss</span><span class="v neg">${fmt(s.unsewered)}</span>` : ''}${s.abandoned ? `<span>Verlassen</span><span class="v neg">${fmt(s.abandoned)}</span>` : ''}
<span>Steuereinnahmen</span><span class="v">${fmtMoney(s.taxIncome || 0)}/Tag</span><span>Kosten der Verordnungen</span><span class="v">${fmtMoney(s.policyCost || 0)}/Tag</span></div>
<div class="dt-group">Altersstruktur</div><div class="dt-ages">${ages}</div>
<div class="dt-note" style="margin-top:2px">Kinder · Jugendliche · Erwachsene · Senioren</div>
</div>
<div class="sec"><h3>Steuern im Bezirk</h3>
<div class="dt-tax"><input type="range" min="-5" max="5" step="1" value="${d.tax}" id="dist-tax" data-id="${d.id}"><span class="val" id="dist-tax-v">${d.tax > 0 ? '+' : d.tax < 0 ? '−' : '±'}${Math.abs(d.tax)} %</span></div>
<p class="dt-note">Je Prozentpunkt ±1,7 Glück im Bezirk.</p></div>
<div class="sec"><h3>Verordnungen im Bezirk</h3>${pols}</div>
<div class="sec"><button class="btn small ghost" data-act="del" data-id="${d.id}" style="color:var(--bad)">${view.confirmDel === d.id ? 'Wirklich auflösen?' : 'Bezirk auflösen'}</button></div>`;
}

registerPanel({
  id: 'districts', title: 'Bezirke', icon: MAP_ICON, order: 21,
  render(ui) {
    ensureStyles();
    const g = ui.g, D = districtsOf(g);
    if (!D) return '<p>Keine Bezirksdaten.</p>';
    computeDistrictStats(g);
    if (view.sel && !D.byId[view.sel]) view.sel = 0;
    if (!view.sel && D.byId[districtTool.active]) view.sel = districtTool.active;
    if (!view.sel && D.list.length) view.sel = D.list[0].id;
    const intro = D.list.length ? '' : `<div class="sec"><p class="dt-note" style="margin-top:0">Stadtteile mit Namen und eigenen Regeln. <b>Malen</b> wählen und über die Karte ziehen.</p></div>`;
    let tot = 0, totTax = 0, totCost = 0;
    for (const d of D.list) { const s = districtStats(g, d.id); if (s) { tot += s.residents; totTax += s.taxDelta; totCost += s.policyCost; } }
    const summary = D.list.length ? `<p class="dt-note" style="margin:0 0 10px">${D.list.length} von ${MAX_DISTRICTS} Bezirken · ${fmt(tot)} Einwohner · Steuern ${totTax >= 0 ? '+' : '−'}${fmtMoney(Math.abs(totTax))}/Tag · Verordnungen ${fmtMoney(totCost)}/Tag</p>` : '';
    const sel = D.byId[view.sel];
    let cmp = '';
    if (D.list.length >= 2) {
      const rows = [...D.list].map((d) => [d, districtStats(g, d.id) || {}]).sort((a, b) => (b[1].residents + b[1].jobs) - (a[1].residents + a[1].jobs));
      cmp = `<div class="sec"><h3>Vergleich</h3><div class="dt-cmp"><span class="h">Bezirk</span><span class="h">Einw.</span><span class="h">Glück</span><span class="h">Boden</span><span class="h">Bildung</span>${rows.map(([d, x]) => `<span class="n"><i style="background:${css(d.color)}"></i>${esc(d.name)}</span><span>${fmt(x.residents || 0)}</span><span class="${(x.happiness || 0) < 40 ? 'neg' : ''}">${Math.round(x.happiness || 0)}</span><span>${Math.round(x.lv || 0)}</span><span>${pct(x.edu || 0)}</span>`).join('')}</div></div>`;
    }
    return `${toolRow(ui)}${intro}${summary}${D.list.map((d) => card(ui, d)).join('')}${cmp}${sel ? details(ui, sel) : ''}`;
  },
  click(ui, act, el) {
    const g = ui.g, D = districtsOf(g);
    const id = +el.dataset.id;
    const input = ui.app.input;
    switch (act) {
      case 'tool': input.setTool({ kind: 'district', type: el.dataset.t }); break;
      case 'brush': districtTool.brush = +el.dataset.n; break;
      case 'sel': view.sel = id; districtTool.active = id; break;
      case 'paintin': districtTool.active = id; view.sel = id; input.setTool({ kind: 'district', type: 'paint' }); ui.toast(`Male jetzt ${D.byId[id] ? D.byId[id].name : 'den Bezirk'} weiter.`); break;
      case 'show': view.sel = id; focusDistrict(ui, id); break;
      case 'rename': if (D.byId[id]) openRename(ui, D.byId[id]); break;
      case 'color': cycleDistrictColor(g, id); break;
      case 'dpol': toggleDistrictPolicy(g, id, el.dataset.p); break;
      case 'del':
        if (view.confirmDel === id) { const n = D.byId[id] && D.byId[id].name; deleteDistrict(g, id); view.confirmDel = 0; ui.toast(`${n} wurde aufgelöst.`); }
        else { view.confirmDel = id; setTimeout(() => { view.confirmDel = 0; }, 4000); }
        break;
    }
  },
  afterRender(ui) {
    const inp = document.getElementById('dist-tax');
    if (!inp) return;
    inp.addEventListener('input', () => {
      const v = +inp.value;
      setDistrictTax(ui.g, +inp.dataset.id, v);
      const lab = document.getElementById('dist-tax-v');
      if (lab) lab.textContent = `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v)} %`;
    });
    inp.addEventListener('change', () => ui.renderPanel());
  },
});

// Inspektor: Zugehörigkeit zum Bezirk
INSPECTORS.push((ui, sel) => {
  const g = ui.g, D = districtsOf(g);
  if (!D || !D.list.length || !sel) return null;
  let i = -1;
  if (sel.type === 'building') { const b = g.buildings.get(sel.id); if (b) i = anchorTile(g, b); }
  else if (sel.type === 'tile' || sel.type === 'road') i = sel.i;
  const d = districtAt(g, i);
  if (!d) return null;
  ensureStyles();
  const pols = d.policies.map((pid) => DISTRICT_POLICIES.find((p) => p.id === pid)).filter(Boolean).map((p) => p.name);
  return `<div style="margin-top:8px"><span class="dt-chip"><i style="background:${css(d.color)}"></i>${esc(d.name)}</span>${pols.length ? `<span style="font-size:11.5px;color:var(--ink-3);margin-left:6px">${esc(pols.join(' · '))}</span>` : ''}</div>`;
});
