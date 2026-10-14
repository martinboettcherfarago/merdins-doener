// Panel „Bevölkerung" (Besitzer S2): Alterspyramide, Bildung, Gesundheit, Todesfälle & Bestattung, Versorgung.
// Dazu Inspektor-Abschnitte für Wohngebäude und die Dienste dieses Systems.
import { registerPanel, INSPECTORS } from '../../registry.js';
import { BUILDINGS, Z, MILESTONES } from '../../config.js';
import { fmt, fmtMoney, clamp, mulberry32 } from '../../util.js';
import { AGE_GROUPS, EDU_LEVELS, EDU_COLORS, STAGES, BINS, E3, E4, EA, SEWAGE_LEVEL, SEWAGE_ALL_POP, UMLAND_PER_DAY, UMLAND_FEE, buildingPeople, sumRange } from '../../sim/systems/citizens.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (v) => `${Math.round(v * 100)} %`;
const meter = (v, max, col) => `<div class="meter"><i style="width:${clamp(v / Math.max(1e-6, max), 0, 1) * 100}%;background:${col}"></i></div>`;
const PEOPLE_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="7" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2"/><circle cx="17.5" cy="9.5" r="2.2"/><path d="M16 21v-1.5a4.5 4.5 0 0 1 5.5-4.4"/></svg>';

// Eigene Stile (style.css gehört U1) – einmalig einfügen
function ensureStyles() {
  if (typeof document === 'undefined' || document.getElementById('cz-styles')) return;
  const st = document.createElement('style');
  st.id = 'cz-styles';
  st.textContent = `
.cz-tabs { display:flex; gap:4px; flex-wrap:wrap; margin:0 0 12px; }
.cz-tabs button { padding:5px 10px; border-radius:999px; background:var(--paper-2); font-size:12.5px; font-weight:600; }
.cz-tabs button.on { background:var(--ink); color:var(--paper); }
.cz-strip { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; margin-bottom:12px; }
.cz-strip div { background:var(--paper-2); border-radius:10px; padding:6px 9px; min-width:0; }
.cz-strip .k { font-size:11px; color:var(--ink-3); font-weight:700; line-height:1.15; min-height:2.3em; display:flex; align-items:flex-end; }
.cz-strip .v { font-family:var(--f-num); font-size:20px; font-weight:600; line-height:1.15; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cz-strip .v small { font-size:12px; color:var(--ink-3); font-weight:600; margin-left:2px; }
.cz-strip .v.neg { color:var(--bad); } .cz-strip .v.pos { color:var(--good); }
.cz-canvas { width:100%; display:block; }
.cz-grp { display:grid; grid-template-columns: 12px 1fr auto 46px; gap:4px 8px; align-items:center; font-size:13px; margin:2px 0; }
.cz-grp .sw { width:10px; height:10px; border-radius:3px; }
.cz-grp .n { font-family:var(--f-num); font-weight:600; text-align:right; }
.cz-grp .p { font-family:var(--f-num); color:var(--ink-3); text-align:right; }
.cz-stack { display:flex; height:16px; border-radius:6px; overflow:hidden; background:var(--paper-3); margin:6px 0 8px; }
.cz-stack i { display:block; height:100%; }
.cz-legend { display:grid; grid-template-columns:12px 1fr auto; gap:3px 8px; font-size:12.5px; align-items:center; }
.cz-legend .sw { width:10px; height:10px; border-radius:3px; }
.cz-legend .v { font-family:var(--f-num); font-weight:600; text-align:right; }
.cz-stage { display:grid; grid-template-columns: 1fr auto; gap:2px 10px; align-items:center; font-size:13px; margin:0 0 9px; }
.cz-stage .t { font-weight:700; } .cz-stage .s { font-size:11.5px; color:var(--ink-3); }
.cz-stage .v { font-family:var(--f-num); font-weight:600; text-align:right; }
.cz-stage .meter { grid-column: 1 / 3; }
.cz-flow { display:flex; align-items:stretch; gap:2px; }
.cz-flow .st { flex:1; min-width:0; border-radius:10px; padding:6px 4px; text-align:center; background:var(--paper-2); display:flex; flex-direction:column; gap:1px; }
.cz-flow .st b { font-family:var(--f-num); font-size:18px; }
.cz-flow .st span { font-size:11.5px; font-weight:700; }
.cz-flow .st em { font-style:normal; font-size:11px; color:var(--ink-3); }
.cz-flow .st.over { background:#f6dcd8; } .cz-flow .st.over em { color:#9e2b23; }
.cz-flow .st.none { background:var(--paper-3); opacity:.9; }
.cz-flow .st.none em { color:var(--bad); font-weight:700; }
.cz-flow .st.ok { background:#e6e0f3; }
.cz-flow .ar { align-self:center; color:var(--ink-3); font-weight:700; font-size:18px; }
.cz-note { font-size:12.5px; color:var(--ink-2); line-height:1.45; margin:6px 0 0; }
.cz-note b { color:var(--ink); }
.cz-warn { background:#f6dcd8; color:#7e2219; border-radius:10px; padding:8px 10px; font-size:12.5px; line-height:1.4; margin:0 0 10px; }
.cz-ok { background:#dcefe2; color:#1f5e37; border-radius:10px; padding:8px 10px; font-size:12.5px; line-height:1.4; margin:0 0 10px; }
.cz-fac { display:flex; align-items:center; gap:8px; padding:5px 0; border-bottom:1px solid var(--rule); font-size:13px; }
.cz-fac:last-child { border-bottom:0; }
.cz-fac .grow { flex:1; min-width:0; } .cz-fac .s { font-size:11.5px; color:var(--ink-3); }
.cz-fac .v { font-family:var(--f-num); font-weight:600; white-space:nowrap; }
.cz-mini { display:flex; gap:3px; align-items:flex-end; height:34px; margin:4px 0 2px; }
.cz-mini i { flex:1; border-radius:3px 3px 0 0; min-height:2px; }
.cz-mini-l { display:flex; gap:3px; font-size:11px; color:var(--ink-3); } .cz-mini-l span { flex:1; text-align:center; }
.cz-ilabel { font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--ink-3); font-weight:700; margin:12px 0 4px; }
`;
  document.head.appendChild(st);
}

const view = { tab: 'overview' };
const TABS = [['overview', 'Übersicht'], ['edu', 'Bildung'], ['health', 'Gesundheit'], ['death', 'Todesfälle'], ['supply', 'Versorgung']];

function C(ui) { return ui.g.ext.citizens; }
// Knopf, der die Kamera auf das Gebäude mit der höchsten Bewertung richtet
function hotspot(g, score, label) {
  let best = null, bs = 0;
  for (const b of g.buildings.values()) { const v = score(b); if (v > bs) { bs = v; best = b; } }
  return best ? `<button class="btn small ghost" data-act="focus" data-id="${best.id}" style="margin-top:6px">${label}</button>` : '';
}

function strip(cells) {
  return `<div class="cz-strip">${cells.map(([k, v, cls = '', small = '']) => `<div><div class="k">${k}</div><div class="v ${cls}">${v}${small ? `<small>${small}</small>` : ''}</div></div>`).join('')}</div>`;
}

function overview(ui) {
  const S = C(ui).stats;
  const g = ui.g;
  const tot = S.groups.reduce((a, b) => a + b, 0) || 1;
  const grp = AGE_GROUPS.map((gr, k) => `<span class="sw" style="background:${gr.color}"></span><span>${gr.name} <span style="color:var(--ink-3)">${gr.range}</span></span><span class="n">${fmt(S.groups[k])}</span><span class="p">${pct(S.groups[k] / tot)}</span>`).join('');
  const lr = S.laborRatio || 1;
  const laborTxt = lr < 0.92 ? '<b>Fachkräftemangel</b> – Firmen wachsen langsamer.' : lr > 1.08 ? 'Viele Erwerbstätige – Firmen finden leicht Personal.' : 'Altersstruktur passt zum Arbeitsmarkt.';
  const nat = S.birthsToday - S.deathsToday;
  return `
${strip([['Einwohner', fmt(g.stats.pop)], ['Ø Alter', S.avgAge.toFixed(0), '', ' J.'], ['Lebens­erwartung', S.lifeExp.toFixed(0), '', ' J.']])}
${strip([['Geburten heute', fmt(S.birthsToday), 'pos'], ['Sterbefälle heute', fmt(S.deathsToday), S.deathsToday > S.birthsToday ? 'neg' : ''], ['Zuzug − Wegzug', `${S.moveIn - S.moveOut >= 0 ? '+' : '−'}${fmt(Math.abs(S.moveIn - S.moveOut))}`, S.moveIn >= S.moveOut ? 'pos' : 'neg']])}
<div class="sec"><h3>Alterspyramide</h3><canvas class="cz-canvas" id="cz-pyr" style="height:250px"></canvas></div>
<div class="sec"><h3>Altersgruppen</h3><div class="cz-grp">${grp}</div>
<p class="cz-note">Geburten − Sterbefälle heute: <b>${nat >= 0 ? '+' : '−'}${fmt(Math.abs(nat))}</b></p></div>
<div class="sec"><h3>Geburten und Sterbefälle</h3><canvas class="cz-canvas" id="cz-hist" style="height:120px"></canvas>
<div class="cz-legend" style="margin-top:6px"><span class="sw" style="background:#22a866"></span><span>Geburten pro Tag</span><span></span><span class="sw" style="background:#5d6470"></span><span>Sterbefälle pro Tag</span><span></span></div></div>
<div class="sec"><h3>Arbeitsmarkt</h3><div class="kv"><span>Erwerbspersonen (20–64)</span><span class="v">${fmt(S.workforce)}</span><span>Verhältnis zur Annahme der Stadtplanung</span><span class="v ${lr < 0.92 ? 'neg' : ''}">${Math.round(lr * 100)} %</span></div><p class="cz-note">${laborTxt}</p></div>`;
}

function education(ui) {
  const S = C(ui).stats;
  const g = ui.g;
  const sh = S.eduShares;
  const stack = sh.map((v, l) => `<i style="width:${v * 100}%;background:${EDU_COLORS[l]}"></i>`).join('');
  const leg = EDU_LEVELS.map((n, l) => `<span class="sw" style="background:${EDU_COLORS[l]}"></span><span>${n}</span><span class="v">${pct(sh[l])}</span>`).join('');
  const idx = S.eduIndex;
  const stages = STAGES.map((st) => {
    const s = S.stage[st.id] || { pupils: 0, seats: 0, missing: 0 };
    const fill = s.seats > 0 ? s.pupils / s.seats : s.pupils > 0 ? 9 : 0;
    const col = fill > 1.05 ? 'var(--bad)' : fill > 0.85 ? 'var(--warn)' : 'var(--l-violet)';
    const miss = s.missing >= 1 ? ` · ${fmt(s.missing)} ohne Platz in Reichweite` : '';
    return `<div class="cz-stage"><div><div class="t">${st.name}</div><div class="s">${st.who}${miss}</div></div><div class="v ${fill > 1.05 ? 'neg' : ''}">${fmt(s.pupils)} / ${fmt(s.seats)}</div>${meter(s.pupils, Math.max(s.seats, s.pupils), col)}</div>`;
  }).join('');
  const tips = [];
  const st = S.stage;
  if (st.school && st.school.seats === 0 && g.stats.pop > 150) tips.push('Ohne <b>Schule</b> machen kaum Kinder einen Abschluss.');
  if (st.school && st.school.pupils > st.school.seats * 1.05 && st.school.seats > 0) tips.push('Die <b>Schulen sind überfüllt</b> – weniger Kinder schaffen den Abschluss.');
  if (st.gym && st.gym.seats === 0 && g.milestone >= 3) tips.push('Ein <b>Gymnasium</b> bringt Abiture – Voraussetzung fürs Studium.');
  if (st.uni && st.uni.seats === 0 && g.milestone >= 4) tips.push('Eine <b>Universität</b> bildet Akademiker aus – Büros und Wohntürme brauchen sie.');
  if (st.kita && st.kita.seats === 0 && g.stats.pop > 300) tips.push('<b>Kitas</b> verbessern den Schulerfolg und machen Familien glücklich.');
  return `
${strip([['Bildungsindex', pct(idx)], ['Abschlüsse heute', fmt(S.graduates[1] + S.graduates[2] + S.graduates[3])], ['Akademiker', pct(S.uniShare)]])}
<div class="sec"><h3>Bildungsstand der Erwachsenen</h3><div class="cz-stack">${stack}</div><div class="cz-legend">${leg}</div>
<p class="cz-note">Stufe 4: Bildung 25 % · Stufe 5: 45 %</p></div>
<div class="sec"><h3>Bildungskette</h3><div class="cz-flow">${['kita', 'school', 'gym', 'uni'].map((id, k) => {
    const st2 = S.stage[id] || { pupils: 0, seats: 0 };
    const fill = st2.seats > 0 ? st2.pupils / st2.seats : st2.pupils > 0 ? 9 : 0;
    const cls = !st2.seats ? 'none' : fill > 1.05 ? 'over' : 'ok';
    const nm = ['Kita', 'Schule', 'Gymnasium', 'Uni'][k];
    return `${k ? '<span class="ar">›</span>' : ''}<div class="st ${cls}"><b>${fmt(st2.pupils)}</b><span>${nm}</span><em>${st2.seats ? `${Math.round(fill * 100)} % belegt` : 'fehlt'}</em></div>`;
  }).join('')}</div>
<p class="cz-note">Abschlüsse je Jahrgang: Schule <b>${pct(S.rates[0])}</b> · Abitur <b>${pct(S.rates[1])}</b> · Hochschule <b>${pct(S.rates[2])}</b></p></div>
<div class="sec"><h3>Plätze in den Einrichtungen</h3>${stages}</div>
<div class="sec"><h3>So läuft die Bildungskette</h3><p class="cz-note">Kita 0–4 → Schule 5–14 → Gymnasium 15–19 → Uni 20–24</p>
${tips.length ? `<div class="cz-warn" style="margin-top:8px">${tips.join('<br>')}</div>` : ''}</div>
<div class="sec"><h3>Abschlüsse heute</h3><div class="kv"><span>Schulabschlüsse</span><span class="v">${fmt(S.graduates[1])}</span><span>Abiture</span><span class="v">${fmt(S.graduates[2])}</span><span>Hochschulabschlüsse</span><span class="v">${fmt(S.graduates[3])}</span></div></div>`;
}

function health(ui) {
  const S = C(ui).stats;
  const g = ui.g;
  const tips = [];
  if (S.contam > 0.03) tips.push(`<b>Trinkwasser verschmutzt (${pct(S.contam)})</b>: Ein Pumpwerk zieht Wasser aus der Nähe eines Abwasserauslasses. Auslass flussabwärts verlegen oder eine Kläranlage bauen.`);
  if (S.sickShare > 0.08) tips.push('<b>Viele Kranke</b> – mehr Ärzte, weniger Abgase.');
  if (S.beds.q < 0.9 && S.beds.severe > 2) tips.push(`<b>Krankenhausbetten fehlen</b>: ${fmt(S.beds.severe)} schwere Fälle, ${fmt(S.beds.beds)} Betten. Ohne Bett sterben mehr Kranke – ein Krankenhaus hat 180 Betten, eine Praxis 12.`);
  if (S.care.demand > S.care.cap * 1.1 && S.care.demand > 30) tips.push(`<b>Pflegeplätze fehlen</b>: ${fmt(S.care.demand)} Hochbetagte, ${fmt(S.care.cap)} Plätze in Seniorenheimen.`);
  const hist = C(ui).hist.slice(-60);
  return `
${strip([['Krank', fmt(S.sick)], ['Krankenstand', pct(S.sickShare), S.sickShare > 0.08 ? 'neg' : ''], ['Lebens­erwartung', S.lifeExp.toFixed(0), '', ' J.']])}
${tips.length ? `<div class="cz-warn">${tips.join('<br><br>')}</div>` : '<div class="cz-ok">Die Gesundheitslage ist stabil.</div>'}
<div class="sec"><h3>Krankenstand im Verlauf</h3><canvas class="cz-canvas" id="cz-sick" style="height:110px"></canvas></div>
<div class="sec"><h3>Versorgung</h3><div class="kv">
<span>Ärztliche Versorgung (Ø Wohnungen)</span><span class="v">${pct(g.stats.healthAvg || 0)}</span>
<span>Rettungseinsätze heute</span><span class="v">${fmt(S.ambulances)}</span>
<span>Krankenhausbetten (schwere Fälle / Betten)</span><span class="v ${S.beds.q < 0.95 ? 'neg' : ''}">${fmt(S.beds.severe)} / ${fmt(S.beds.beds)}</span>
<span>Trinkwasser verschmutzt</span><span class="v ${S.contam > 0.03 ? 'neg' : ''}">${pct(S.contam)}</span>
<span>Gewässer (stärkste Stelle)</span><span class="v ${S.waterPolMax > 0.3 ? 'neg' : ''}">${pct(S.waterPolMax)}</span>
<span>Pflegeplätze / Hochbetagte (75+)</span><span class="v">${fmt(S.care.cap)} / ${fmt(S.care.demand)}</span>
</div><p class="cz-note">Krank machen: Abgase, kein Kanal, schmutziges Wasser, Kälte.</p></div>
${hist.length < 2 ? '' : ''}`;
}

function deaths(ui) {
  const S = C(ui).stats;
  const g = ui.g;
  const facs = [];
  for (const b of g.buildings.values()) {
    if (b.zone) continue;
    const d = BUILDINGS[b.key];
    if (!d || !d.service || d.service.type !== 'deathcare') continue;
    const cz = b.cz || {};
    const sub = d.graves ? `Gräber ${fmt(cz.used || 0)} / ${fmt(cz.graveCap || d.graves)}` : `${fmt(cz.cremated || 0)} Einäscherungen insgesamt`;
    facs.push(`<div class="cz-fac"><div class="grow"><div><b>${esc(d.name)}</b> <span class="s">Feld ${b.x}, ${b.y}</span></div><div class="s">${sub}${b.construct < 1 ? ' · im Bau' : ''}${d.needsPower && !b.powered ? ' · <span style="color:var(--bad)">ohne Strom</span>' : ''}</div>${d.graves ? meter(cz.used || 0, cz.graveCap || d.graves, (cz.used || 0) / (cz.graveCap || d.graves) > 0.9 ? 'var(--bad)' : '#7a8294') : ''}</div><div class="v">heute ${fmt(cz.today || 0)} / ${fmt(cz.capToday || 0)}</div></div>`);
  }
  const hist = C(ui).hist.slice(-60);
  const warn = [];
  const unlocked = g.isUnlocked('cemetery');
  if (S.bodies >= 1) warn.push(`<b>${fmt(S.bodies)} Verstorbene</b> warten in ${fmt(S.deadBuildings)} Gebäuden auf ihre Bestattung (am längsten seit ${fmt(S.maxDeadDays)} Tagen). Die Nachbarn sind entsetzt – nach einigen Tagen ziehen Menschen weg. ${hotspot(g, (b) => (b.cz && b.cz.dead >= 1 ? b.cz.deadDays * 10 + b.cz.dead : 0), 'Schlimmsten Fall zeigen')}`);
  if (!unlocked) warn.push(`Bis „${MILESTONES[2].name}" übernimmt das Umland alle Bestattungen (${fmtMoney(UMLAND_FEE)} je Verstorbenem).`);
  else if (!facs.length) warn.push(`Ohne Friedhof holt das Umland höchstens ${UMLAND_PER_DAY} Verstorbene pro Tag ab – gegen ${fmtMoney(UMLAND_FEE)} Gebühr.`);
  if (S.graveFill > 0.85) warn.push(`Die Friedhöfe sind zu <b>${pct(S.graveFill)}</b> belegt. Gräber werden erst nach 25 Jahren Ruhefrist wieder frei – ein Krematorium braucht keine.`);
  const dg = S.deathsByGroup.map((v) => Math.round(v * 10) / 10);
  return `
${strip([['Sterbefälle heute', fmt(S.deathsToday)], ['Warten auf Bestattung', fmt(S.bodies), S.bodies >= 1 ? 'neg' : 'pos'], ['Lebens­erwartung', S.lifeExp.toFixed(0), '', ' J.']])}
${warn.length ? `<div class="${S.bodies >= 1 || S.graveFill > 0.85 ? 'cz-warn' : 'cz-ok'}">${warn.join('<br><br>')}</div>` : '<div class="cz-ok">Alle Verstorbenen werden würdig bestattet.</div>'}
<div class="sec"><h3>Sterbefälle und wartende Verstorbene</h3><canvas class="cz-canvas" id="cz-dead" style="height:110px"></canvas>
<div class="cz-legend" style="margin-top:6px"><span class="sw" style="background:#5d6470"></span><span>Sterbefälle pro Tag</span><span></span><span class="sw" style="background:#e8543f"></span><span>wartende Verstorbene</span><span></span></div></div>
<div class="sec"><h3>Heute bestattet</h3><div class="kv"><span>Von eigenen Leichenwagen abgeholt</span><span class="v">${fmt(S.collected)}</span><span>Vom Umland abgeholt</span><span class="v">${fmt(S.umland)}${S.umlandCost ? ` · ${fmtMoney(S.umlandCost)}` : ''}</span><span>Gräber belegt</span><span class="v">${fmt(S.graves.used)} / ${fmt(S.graves.cap)}</span></div></div>
<div class="sec"><h3>Friedhöfe und Krematorien</h3>${facs.join('') || '<p class="cz-note">Noch keine – unter Dienste.</p>'}</div>
<div class="sec"><h3>Wer stirbt?</h3><div class="kv">${AGE_GROUPS.map((gr, k) => `<span>${gr.name} (${gr.range})</span><span class="v">${dg[k].toLocaleString('de-DE')}</span>`).join('')}</div>
<p class="cz-note">Leichenwagen: Friedhof ${BUILDINGS.cemetery.hearses} · Krematorium ${BUILDINGS.crematorium.hearses}</p></div>
${hist.length ? '' : ''}`;
}

function supply(ui) {
  const S = C(ui).stats;
  const g = ui.g;
  const Cz = C(ui);
  const sew = [];
  for (const b of g.buildings.values()) {
    if (b.zone) continue;
    const d = BUILDINGS[b.key];
    if (!d || !d.sewage) continue;
    const cz = b.cz || {};
    sew.push(`<div class="cz-fac"><div class="grow"><div><b>${esc(d.name)}</b> <span class="s">Feld ${b.x}, ${b.y}</span></div><div class="s">${d.residual >= 1 ? 'leitet ungeklärt ein' : `reinigt ${Math.round((1 - d.residual) * 100)} %`}${d.needsPower && !b.powered ? ' · <span style="color:var(--bad)">ohne Strom nur 30 %</span>' : ''}</div></div><div class="v">${fmt(cz.sewFlow || 0)} / ${fmt(cz.sewCap || d.sewage)} m³</div></div>`);
  }
  const sewWarn = [];
  if (!S.sewageRequired) sewWarn.push('Sickergruben reichen noch.');
  else {
    if (S.unsewered > 0) sewWarn.push(`<b>${fmt(S.unsewered)} Gebäude</b> brauchen einen Kanalanschluss und haben keinen. Ohne Kanal wachsen Häuser nicht über Stufe ${SEWAGE_LEVEL - 1} hinaus, ab ${fmt(SEWAGE_ALL_POP)} Einwohnern brauchen alle Zonengebäude den Kanal. ${hotspot(g, (b) => (b.cz && b.cz.sewNeed && !b.cz.sew ? 1 + b.cz.noSew + b.level : 0), 'Eines zeigen')}`);
    if (S.sewageCap < S.sewageDemand && S.sewageCap > 0) sewWarn.push(`Das Kanalnetz ist <b>überlastet</b>: ${fmt(S.sewageDemand)} m³ Abwasser, ${fmt(S.sewageCap)} m³ Kapazität.`);
  }
  if (S.sewBlocked > 0) sewWarn.push(`<b>${fmt(S.sewBlocked)} Häuser</b> erfüllen alles für Stufe ${SEWAGE_LEVEL} – nur der Kanalanschluss fehlt.`);
  if (S.waterPolMax > 0.25) sewWarn.push('Auslässe verschmutzen das Gewässer.');
  const heatInfo = S.hd > 0
    ? `${Math.round(S.temp)} °C · Wärme <b>${fmt(S.heatSupply)}</b> / <b>${fmt(S.heatDemand)}</b>${S.cold ? ` · <span style="color:var(--bad)">${fmt(S.cold)} frieren</span>` : ''}`
    : `${Math.round(S.temp)} °C – keine Fernwärme nötig (erst unter 10 °C).`;
  const pr = S.prison;
  return `
<div class="sec"><h3>Abwasser</h3>
${strip([['Abwasser', fmt(S.sewageDemand), '', ' m³'], ['Kapazität', fmt(S.sewageCap), S.sewageCap < S.sewageDemand && S.sewageRequired ? 'neg' : '', ' m³'], ['Ohne Anschluss', fmt(S.unsewered), S.unsewered ? 'neg' : 'pos']])}
${meter(S.sewageDemand, Math.max(S.sewageCap, 1), S.sewageDemand > S.sewageCap ? 'var(--bad)' : '#9a6a3a')}
${sewWarn.length ? `<div class="cz-warn" style="margin-top:10px">${sewWarn.join('<br><br>')}</div>` : '<div class="cz-ok" style="margin-top:10px">Alles Abwasser fließt sauber ab.</div>'}
${sew.join('') || '<p class="cz-note">Noch keine Anlage – unter Wasser, am Ufer.</p>'}
<p class="cz-note">${fmt(Cz.sewConnected || 0)} Gebäude angeschlossen · je Straßennetz eine Anlage</p></div>
<div class="sec"><h3>Fernwärme</h3><p class="cz-note" style="margin-top:0">${heatInfo}</p>${S.hd > 0 ? meter(S.heatSupply, Math.max(S.heatDemand, 1), S.heatSupply < S.heatDemand ? 'var(--bad)' : '#e8543f') : ''}</div>
<div class="sec"><h3>Gefängnis</h3><div class="kv"><span>Haftplätze</span><span class="v">${fmt(pr.cap)}</span><span>Straftäter (geschätzt)</span><span class="v">${fmt(pr.criminals)}</span><span>Kriminalität gesenkt um</span><span class="v">${pct(pr.red)}</span></div>
<p class="cz-note">Senkt die Kriminalität stadtweit.</p></div>`;
}

// ---------- Diagramme
function prepCanvas(c) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = c.clientWidth || 340, h = c.clientHeight || 120;
  c.width = w * dpr; c.height = h * dpr;
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  return [ctx, w, h];
}
function drawPyramid(c, ages) {
  const [ctx, w, h] = prepCanvas(c);
  const padT = 4, padB = 18, mid = w / 2, labelW = 30;
  const rows = BINS;
  const rh = (h - padT - padB) / rows;
  let max = 1;
  const fem = (k) => 0.49 + Math.max(0, k - 10) * 0.014;
  for (let k = 0; k < rows; k++) max = Math.max(max, ages[k] * Math.max(fem(k), 1 - fem(k)));
  const half = mid - labelW / 2 - 4;
  const colOf = (k) => AGE_GROUPS.find((gr) => k >= gr.from && k <= gr.to).color;
  ctx.font = '600 10.5px "Stadtpuls Rund", Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let k = 0; k < rows; k++) {
    const y = h - padB - (k + 1) * rh;
    const f = ages[k] * fem(k), m = ages[k] * (1 - fem(k));
    const wm = (m / max) * half, wf = (f / max) * half;
    const col = colOf(k);
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.95;
    ctx.fillRect(mid - labelW / 2 - wm, y + 1, wm, rh - 2);
    ctx.globalAlpha = 0.7;
    ctx.fillRect(mid + labelW / 2, y + 1, wf, rh - 2);
    ctx.globalAlpha = 1;
    if (k % 2 === 0) { ctx.fillStyle = '#7a8294'; ctx.fillText(String(k * 5), mid, y + rh / 2 + 0.5); }
  }
  ctx.fillStyle = '#4a5263';
  ctx.font = '700 11px "Stadtpuls Text", Figtree, sans-serif';
  ctx.textAlign = 'left'; ctx.fillText('Männer', 2, h - 7);
  ctx.textAlign = 'right'; ctx.fillText('Frauen', w - 2, h - 7);
  ctx.textAlign = 'center'; ctx.fillStyle = '#7a8294'; ctx.font = '600 10.5px "Stadtpuls Text", Figtree, sans-serif'; ctx.fillText('Alter', mid, h - 7);
}
function drawSeries(c, series, opts = {}) {
  const [ctx, w, h] = prepCanvas(c);
  const padL = 34, padR = 6, padT = 8, padB = 16;
  const n = Math.max(...series.map((s) => s.values.length));
  if (n < 2) { ctx.fillStyle = '#7a8294'; ctx.font = '12px "Stadtpuls Text", Figtree, sans-serif'; ctx.fillText('Daten ab dem ersten Spieltag.', 6, h / 2); return; }
  let max = 0;
  for (const s of series) for (const v of s.values) max = Math.max(max, v);
  if (opts.pct) max = Math.max(0.05, max) * 1.15;
  else {
    // runde Achsenwerte: 4, 10, 20, 50 …
    const m = Math.max(4, max * 1.1);
    const p = Math.pow(10, Math.floor(Math.log10(m)));
    max = [1, 2, 2.5, 5, 10].map((f) => f * p).find((v) => v >= m);
  }
  const X = (i) => padL + (i / (n - 1)) * (w - padL - padR);
  const Y = (v) => padT + (1 - v / max) * (h - padT - padB);
  ctx.strokeStyle = 'rgba(29,35,48,0.08)'; ctx.lineWidth = 1;
  ctx.fillStyle = '#7a8294'; ctx.font = '600 10.5px "Stadtpuls Rund", Outfit, sans-serif'; ctx.textAlign = 'right';
  for (let k = 0; k <= 2; k++) {
    const v = (max * k) / 2;
    ctx.beginPath(); ctx.moveTo(padL, Y(v)); ctx.lineTo(w - padR, Y(v)); ctx.stroke();
    ctx.fillText(opts.pct ? `${Math.round(v * 100)} %` : Math.round(v).toLocaleString('de-DE'), padL - 5, Y(v) + 3);
  }
  ctx.textAlign = 'left'; ctx.fillText(opts.start || '', padL, h - 3);
  ctx.textAlign = 'right'; ctx.fillText(opts.end || '', w - padR, h - 3);
  for (const s of series) {
    if (s.fill) {
      const grad = ctx.createLinearGradient(0, padT, 0, h - padB);
      grad.addColorStop(0, s.color + '44'); grad.addColorStop(1, s.color + '05');
      ctx.beginPath(); ctx.moveTo(X(0), Y(s.values[0] || 0));
      s.values.forEach((v, i) => ctx.lineTo(X(i), Y(v)));
      ctx.lineTo(X(s.values.length - 1), h - padB); ctx.lineTo(X(0), h - padB); ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
    }
    ctx.beginPath();
    s.values.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
    ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
  }
}
// Gleitender Mittelwert über drei Tage (Geburten/Sterbefälle sind ganzzahlig und sprunghaft)
const smooth = (a) => a.map((v, i) => (a[Math.max(0, i - 1)] + v + a[Math.min(a.length - 1, i + 1)]) / 3);

registerPanel({
  id: 'citizens', title: 'Bevölkerung', icon: PEOPLE_ICON, order: 20,
  render(ui) {
    ensureStyles();
    const Cz = C(ui);
    const tabs = `<div class="cz-tabs">${TABS.map(([id, n]) => `<button data-act="tab" data-t="${id}" class="${view.tab === id ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    if (!Cz || !Cz.stats) return `${tabs}<p class="cz-note">Daten ab dem ersten Spieltag.</p>`;
    const body = { overview, edu: education, health, death: deaths, supply }[view.tab] || overview;
    return tabs + body(ui);
  },
  click(ui, act, el) {
    if (act === 'tab') view.tab = el.dataset.t;
    else if (act === 'focus') {
      const g = ui.g, b = g.buildings.get(+el.dataset.id);
      if (!b) return;
      ui.app.engine.rig.focus(b.x + b.w / 2 - g.W / 2, b.y + b.h / 2 - g.H / 2, 16);
      setTimeout(() => ui.inspect({ type: 'building', id: b.id }), 0);
    }
  },
  afterRender(ui) {
    const Cz = C(ui);
    if (!Cz || !Cz.stats) return;
    const hist = Cz.hist.slice(-60);
    const start = hist.length ? `Tag ${hist[0].d}` : '', end = hist.length ? `Tag ${hist[hist.length - 1].d}` : '';
    const el = (id) => document.getElementById(id);
    if (el('cz-pyr')) drawPyramid(el('cz-pyr'), Cz.stats.ages);
    if (el('cz-hist')) drawSeries(el('cz-hist'), [{ values: smooth(hist.map((x) => x.b)), color: '#22a866', fill: true }, { values: smooth(hist.map((x) => x.dth)), color: '#5d6470' }], { start, end });
    if (el('cz-sick')) drawSeries(el('cz-sick'), [{ values: hist.map((x) => (x.pop ? x.sick / x.pop : 0)), color: '#e8543f', fill: true }], { start, end, pct: true });
    if (el('cz-dead')) drawSeries(el('cz-dead'), [{ values: smooth(hist.map((x) => x.dth)), color: '#5d6470', fill: true }, { values: hist.map((x) => x.dead), color: '#e8543f' }], { start, end });
  },
});

// ---------- Inspektor
const chip = (cls, txt) => `<span class="chip ${cls}">${txt}</span>`;
// Ein paar Menschen aus dem Haus – gezogen aus der echten Altersstruktur und Bildung des Gebäudes
const N_KIDS = ['Mia', 'Ben', 'Emma', 'Noah', 'Lina', 'Elias', 'Aylin', 'Finn', 'Ida', 'Yusuf', 'Leni', 'Theo', 'Zeynep', 'Emil', 'Clara', 'Milan'];
const N_MID = ['Andrea', 'Thomas', 'Sabine', 'Michael', 'Katrin', 'Jens', 'Murat', 'Ayşe', 'Olga', 'Stefan', 'Julia', 'Daniel', 'Nadine', 'Mehmet', 'Sarah', 'Tobias'];
const N_OLD = ['Gertrud', 'Heinz', 'Ursula', 'Klaus', 'Helga', 'Werner', 'Inge', 'Manfred', 'Erika', 'Günter', 'Hannelore', 'Dieter', 'Waltraud', 'Horst'];
const FAMILY = ['Weber', 'Schmidt', 'Yılmaz', 'Nowak', 'Becker', 'Hoffmann', 'Kaya', 'Wagner', 'Fischer', 'Schulz', 'Richter', 'Wolf', 'Krüger', 'Neumann', 'Braun', 'Demir', 'Koch', 'Lange', 'Hartmann', 'Popescu'];
function residents(g, b, n) {
  const cz = b.cz, a = cz && cz.a;
  if (!a) return [];
  const rng = mulberry32(b.id * 9973 + Math.floor(g.day() / 10) * 31);
  let tot = 0; for (let k = 0; k < BINS; k++) tot += a[k];
  if (tot < 0.5) return [];
  const fam = FAMILY[Math.floor(rng() * FAMILY.length)];
  const S = g.stats;
  const jobs = S.jobsByZone || [0, 0, 0, 0, 0];
  const jt = jobs[2] + jobs[3] + jobs[4] || 1;
  const out = [];
  const used = new Set();
  for (let m = 0; m < Math.min(n, Math.round(tot)); m++) {
    let r = rng() * tot, k = 0;
    while (k < BINS - 1 && (r -= a[k]) > 0) k++;
    const age = Math.min(99, Math.floor((k + rng()) * 5));
    const pool = age < 20 ? N_KIDS : age < 62 ? N_MID : N_OLD;
    let name = pool[Math.floor(rng() * pool.length)];
    for (let t = 0; t < 4 && used.has(name); t++) name = pool[Math.floor(rng() * pool.length)];
    used.add(name);
    const pickEdu = (off) => { const s = a[off] + a[off + 1] + a[off + 2] + a[off + 3]; let q = rng() * s, l = 0; while (l < 3 && (q -= a[off + l]) > 0) l++; return l; };
    let what;
    if (age < 3) what = cz.kq > 0.2 && age >= 1 ? 'geht in die Kita' : 'ist noch klein';
    else if (age < 5) what = cz.kq > 0.2 ? 'geht in die Kita' : 'wartet auf einen Kitaplatz';
    else if (age < 15) what = cz.sq > 0.1 ? 'geht zur Schule' : 'hat keinen Schulplatz';
    else if (age < 20) what = cz.gq > 0.1 && pickEdu(E3) >= 1 ? 'macht Abitur' : 'macht eine Ausbildung';
    else if (age < 25 && pickEdu(E4) >= 2 && cz.uq > 0.1) what = 'studiert';
    else if (age < 65) {
      const l = pickEdu(age < 25 ? E4 : EA);
      const deg = ['ohne Abschluss', 'mit Schulabschluss', 'mit Abitur', 'Akademiker'][l];
      if (rng() < (S.unemployment || 0)) what = `sucht Arbeit (${deg})`;
      else {
        let q = rng() * jt;
        const z = (q -= jobs[2]) < 0 ? 'im Laden' : (q -= jobs[3]) < 0 ? 'in der Fabrik' : 'im Büro';
        what = `arbeitet ${z} (${deg})`;
      }
    } else what = age >= 80 && cz.care > 0.3 ? 'wird im Seniorenheim betreut' : 'ist in Rente';
    const sick = rng() < cz.sick * 1.4 ? ' · krank' : '';
    out.push(`<span>${name} ${fam[0]}., ${age}</span><span class="v" style="font-size:12px;font-family:var(--f-ui);font-weight:500;color:var(--ink-2)">${what}${sick}</span>`);
  }
  return out;
}
function inspectResidential(ui, b) {
  const g = ui.g;
  const P = buildingPeople(b);
  const cz = b.cz;
  if (!cz) return '';
  const chips = [];
  const Cz = g.ext.citizens || {};
  if (cz.water) {
    const net = Cz.sewCap && b.comp >= 0 && Cz.sewCap[b.comp] > 0;
    if (cz.sew && net) chips.push(chip('ok', 'Kanal'));
    else if (cz.sewNeed) chips.push(chip('no', 'Kein Kanal'));
    else chips.push(chip('', 'Sickergrube'));
  }
  if (Cz.hd > 0) chips.push(cz.heat ? chip('ok', 'Fernwärme') : chip('no', 'Kalt'));
  if (b.zone === Z.RES && P) {
    if (cz.dead >= 1) chips.push(chip('no', `${cz.dead} Verstorbene`));
    if (cz.sick > 0.08) chips.push(chip('warn', `${pct(cz.sick)} krank`));
  }
  let html = chips.length ? `<div class="chips">${chips.join('')}</div>` : '';
  if (b.zone === Z.RES && P && P.tot > 0.5) {
    ensureStyles();
    const max = Math.max(...P.groups, 0.01);
    const bars = P.groups.map((v, k) => `<i style="height:${Math.max(4, (v / max) * 100)}%;background:${AGE_GROUPS[k].color}" title="${AGE_GROUPS[k].name}: ${Math.round(v)}"></i>`).join('');
    const labels = AGE_GROUPS.map((gr, k) => `<span>${Math.round(P.groups[k])}</span>`).join('');
    const eN = P.edu.reduce((a, c) => a + c, 0) || 1;
    const stack = P.edu.map((v, l) => `<i style="width:${(v / eN) * 100}%;background:${EDU_COLORS[l]}"></i>`).join('');
    const cov = [['Kita', P.kq], ['Schule', P.sq], ['Gymnasium', P.gq], ['Uni', P.uq]].filter(([, q]) => q > 0.05).map(([n, q]) => `${n} ${pct(q)}`).join(' · ');
    html += `<div class="cz-ilabel">Bewohner · Ø ${P.avgAge.toFixed(0)} Jahre</div><div class="cz-mini">${bars}</div><div class="cz-mini-l">${labels}</div><div class="cz-mini-l">${AGE_GROUPS.map((gr) => `<span>${gr.name}</span>`).join('')}</div>
<div class="cz-ilabel">Bildung · Index ${P.eduIndex >= 0 ? pct(P.eduIndex) : '–'}</div><div class="cz-stack" style="height:10px;margin:2px 0 4px">${stack}</div>
${(() => { const r = residents(g, b, 4); return r.length ? `<div class="cz-ilabel">Familie ${FAMILY[Math.floor(mulberry32(b.id * 9973 + Math.floor(g.day() / 10) * 31)() * FAMILY.length)]} und Nachbarn</div><div class="factors" style="font-size:12.5px">${r.join('')}</div>` : ''; })()}
<div class="kv" style="font-size:12.5px;margin-top:6px"><span>Plätze in Reichweite</span><span class="v" style="font-size:12.5px">${cov || 'keine'}</span><span>Geboren / gestorben hier</span><span class="v" style="font-size:12.5px">${fmt(P.born)} / ${fmt(P.died)}</span>${P.care > 0.05 ? `<span>Seniorenbetreuung</span><span class="v" style="font-size:12.5px">${pct(P.care)}</span>` : ''}</div>`;
  }
  if (b.level === SEWAGE_LEVEL - 1 && !cz.sew && Cz.sewReq) html += `<p class="cz-note" style="color:var(--bad)">Stufe ${SEWAGE_LEVEL} braucht Kanalanschluss.</p>`;
  if (cz.dead >= 1 && cz.deadDays >= 1) html += `<p class="cz-note" style="color:var(--bad)">${cz.dead} Verstorbene warten seit ${cz.deadDays} ${cz.deadDays === 1 ? 'Tag' : 'Tagen'} – Friedhof fehlt.</p>`;
  return html;
}
function inspectService(ui, b) {
  const g = ui.g;
  const d = BUILDINGS[b.key];
  const cz = b.cz || {};
  const rows = [];
  if (d.service && d.service.type === 'deathcare') {
    if (d.graves) rows.push(['Gräber belegt', `${fmt(cz.used || 0)} / ${fmt(cz.graveCap || d.graves)}`]);
    else rows.push(['Einäscherungen', fmt(cz.cremated || 0)]);
    rows.push(['Heute abgeholt', `${fmt(cz.today || 0)} / ${fmt(cz.capToday || 0)}`]);
    rows.push(['Leichenwagen', fmt(d.hearses || 0)]);
  }
  if (cz.seats !== undefined && d.service && d.service.type === 'edu') rows.push(['Plätze belegt', `${fmt(cz.pupils || 0)} / ${fmt(cz.seats || 0)}`]);
  if (d.seniorCare) rows.push(['Pflegeplätze', `${fmt(cz.residents || 0)} / ${fmt(cz.capacity || d.seniorCare)}`]);
  if (d.sewage) {
    rows.push(['Abwasser', `${fmt(cz.sewFlow || 0)} / ${fmt(cz.sewCap || d.sewage)} m³`]);
    rows.push(['Netz-Auslastung', pct(cz.sewLoad || 0)]);
    rows.push(['Einleitung', d.residual >= 1 ? 'ungeklärt' : `zu ${Math.round(d.residual * 100)} % belastet`]);
  }
  if (d.water && d.needsWater && cz.intake > 0.01) rows.push(['Rohwasser verschmutzt', pct(cz.intake)]);
  if (d.heat) rows.push(['Fernwärme', `${fmt(d.heat)} Einheiten`]);
  if (d.inmates) { const pr = (g.ext.citizens && g.ext.citizens.prison) || {}; rows.push(['Häftlinge (Stadt)', `${fmt(pr.inmates || 0)} / ${fmt(pr.cap || d.inmates)}`]); }
  if (!rows.length) return '';
  return `<div class="kv" style="margin-top:6px">${rows.map(([k, v]) => `<span>${k}</span><span class="v">${v}</span>`).join('')}</div>${d.water && d.needsWater && cz.intake > 0.05 ? '<p class="cz-note" style="color:var(--bad)">Zieht Abwasser an – Auslass flussabwärts verlegen.</p>' : ''}`;
}
INSPECTORS.push((ui, sel) => {
  if (!sel || sel.type !== 'building') return null;
  const b = ui.g.buildings.get(sel.id);
  if (!b) return null;
  try { return b.zone ? inspectResidential(ui, b) : inspectService(ui, b); } catch (e) { console.error(e); return null; }
});
INSPECTORS.push((ui, sel) => {
  if (!sel || sel.type !== 'tile') return null;
  const C2 = ui.g.ext.citizens;
  if (!C2 || !C2.waterPol) return null;
  const p = C2.waterPol[sel.i];
  return p > 0.01 ? `<p class="cz-note" style="color:var(--bad)">Gewässer durch Abwasser verschmutzt: ${pct(p)}.</p>` : null;
});
void sumRange;
