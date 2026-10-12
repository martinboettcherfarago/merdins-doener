// Panel „Erfolge & Ziele", Szenario-Auswahl im Hauptmenü, Briefing-/Sieg-/Niederlagen-Fenster,
// Zielanzeige im Spiel und Erfolgs-Banner. Besitzer: System-Agent „Fortschritt & Inhalte" (S5).
//
// Die Simulation (sim/systems/progression.js) legt Meldungen in g.ext.progression.inbox ab; eine kleine
// Brücke hier holt sie ab und zeigt sie über ui.queueModal/ui.openModal an. Ein Profil im localStorage
// (pro Browser) merkt sich freigeschaltete Erfolge, Szenario-Sterne und Metro-Rekorde über Spiele hinweg.
import { registerPanel, MENU_SECTIONS } from '../../registry.js';
import { MILESTONES } from '../../config.js';
import { fmt, fmtMoney, clamp } from '../../util.js';
import { icon } from '../icons.js';
import {
  ACHIEVEMENTS, ACH_CATS, TIERS, RANKS, SCENARIOS, METRO_MAPS, METRO_STARS, ADVISORS,
  achievementState, achievementPoints, rankFor, achievementById, scenarioById, scenarioStatus, scenarioOptions,
  adviceFor, metroScore, continueFreePlay, isMetro, bannedNames, questStatus, ADVISORS as ADV,
} from '../../sim/systems/progression.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hasDom = typeof document !== 'undefined';

// ---------------------------------------------------------------------------------------------
// Profil (pro Browser, robust gegen gesperrten Speicher)
// ---------------------------------------------------------------------------------------------
const PKEY = 'stadtpuls.profile.s5';
function loadProfile() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(PKEY) || 'null'); } catch (e) { p = null; }
  return { ach: {}, scen: {}, metro: {}, ...(p || {}) };
}
function saveProfile(p) { try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch (e) { /* egal */ } }
function profileAch(id) { const p = loadProfile(); if (!p.ach[id]) { p.ach[id] = Date.now(); saveProfile(p); } }
function profileScenario(id, stars, days) {
  const p = loadProfile();
  const cur = p.scen[id] || { stars: 0, wins: 0, best: null };
  cur.wins++;
  cur.stars = Math.max(cur.stars, stars);
  cur.best = cur.best === null ? days : Math.min(cur.best, days);
  p.scen[id] = cur;
  saveProfile(p);
}
function profileMetro(map, score) {
  const p = loadProfile();
  const isRecord = score > (p.metro[map] || 0);
  if (isRecord) p.metro[map] = score;
  saveProfile(p);
  return isRecord;
}

// ---------------------------------------------------------------------------------------------
// Stil (eigene Klassen mit Präfix s5-, Farben aus den Variablen der Oberfläche)
// ---------------------------------------------------------------------------------------------
const CSS = `
.s5-tabs{display:flex;gap:4px;margin:0 0 14px;background:var(--paper-2);border-radius:11px;padding:3px}
.s5-tabs button{flex:1;padding:7px 6px;border-radius:9px;font-weight:700;font-size:13px;color:var(--ink-2)}
.s5-tabs button.on{background:var(--ink);color:var(--paper)}
.s5-rank{display:flex;align-items:center;gap:12px;background:var(--ink);color:var(--paper);border-radius:14px;padding:12px 14px;margin-bottom:14px}
.s5-rank .lvl{font-family:var(--f-display);font-weight:700;font-size:15px;line-height:1.15}
.s5-rank .sub{font-size:12px;color:#b9c0cf;margin-top:2px}
.s5-rank .pts{font-family:var(--f-num);font-size:26px;font-weight:700;margin-left:auto;text-align:right;line-height:1}
.s5-rank .pts small{display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#b9c0cf;font-family:var(--f-ui)}
.s5-rank .bar{height:5px;border-radius:3px;background:rgba(255,255,255,.18);margin-top:7px;overflow:hidden}
.s5-rank .bar i{display:block;height:100%;background:var(--l-yellow);border-radius:3px}
.s5-chips{display:flex;flex-wrap:wrap;gap:5px;margin:0 0 12px}
.s5-chips button{padding:4px 10px;border-radius:999px;background:var(--paper-2);font-size:12px;font-weight:700;color:var(--ink-2)}
.s5-chips button.on{background:var(--ink);color:var(--paper)}
.s5-ach{display:grid;grid-template-columns:44px 1fr;gap:10px;align-items:center;padding:9px 10px;border-radius:12px;background:var(--paper-2);margin-bottom:7px;position:relative}
.s5-ach.done{background:#fff;box-shadow:inset 0 0 0 2px var(--tier)}
.s5-ach.locked{opacity:.55}
.s5-ach .nm{font-weight:700;font-size:13.5px;line-height:1.2;display:flex;gap:6px;align-items:baseline}
.s5-ach .nm .t{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--tier);font-weight:800}
.s5-ach .ds{font-size:12px;color:var(--ink-2);line-height:1.35;margin-top:2px}
.s5-ach .pg{display:flex;align-items:center;gap:8px;margin-top:5px;font-family:var(--f-num);font-size:12.5px;font-weight:600;color:var(--ink-3)}
.s5-ach .pg .meter{flex:1;height:6px}
.s5-medal{width:44px;height:44px;display:grid;place-items:center;position:relative}
.s5-medal svg.m{position:absolute;inset:0}
.s5-medal .g{position:relative;color:#fff;display:grid;place-items:center;margin-top:-4px}
.s5-ach.locked .s5-medal .g,.s5-ach:not(.done) .s5-medal .g{color:var(--ink-3)}
.s5-goal{display:grid;grid-template-columns:20px 1fr auto;gap:4px 9px;align-items:center;padding:7px 0;border-bottom:1px solid var(--rule)}
.s5-goal:last-child{border-bottom:0}
.s5-goal .ck{width:16px;height:16px;border-radius:50%;border:3px solid var(--ink);background:var(--paper)}
.s5-goal.done .ck{background:var(--good);border-color:var(--good)}
.s5-goal .lb{font-weight:600;font-size:13.5px}
.s5-goal .vl{font-family:var(--f-num);font-weight:700;font-size:14px;text-align:right;white-space:nowrap}
.s5-goal .meter{grid-column:2 / 4;height:5px}
.s5-scen-hd{border-radius:14px;padding:13px 15px;color:#fff;margin-bottom:12px;position:relative;overflow:hidden}
.s5-scen-hd .ey{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;opacity:.85}
.s5-scen-hd .nm{font-family:var(--f-display);font-weight:700;font-size:19px;margin:3px 0 2px}
.s5-scen-hd .kk{font-size:13px;opacity:.9}
.s5-scen-hd .days{position:absolute;right:14px;top:12px;font-family:var(--f-num);font-weight:700;font-size:28px;line-height:1;text-align:right}
.s5-scen-hd .days small{display:block;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;font-family:var(--f-ui);font-weight:700;opacity:.85}
.s5-timebar{height:6px;border-radius:3px;background:rgba(255,255,255,.3);margin-top:10px;overflow:hidden}
.s5-timebar i{display:block;height:100%;background:#fff;border-radius:3px}
.s5-tip{display:grid;grid-template-columns:34px 1fr;gap:10px;padding:10px 0;border-bottom:1px solid var(--rule)}
.s5-tip:last-child{border-bottom:0}
.s5-tip .av{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:800;font-size:12px}
.s5-tip .who{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);font-weight:700}
.s5-tip .tt{font-weight:700;font-size:13.5px;margin:1px 0 2px}
.s5-tip .tx{font-size:12.5px;color:var(--ink-2);line-height:1.4}
.s5-tip.hot .tt{color:var(--bad)}
.s5-big{font-family:var(--f-num);font-weight:700;font-size:44px;line-height:1}
.s5-stars{color:var(--l-yellow);letter-spacing:2px;font-size:18px}
.s5-stars .off{color:var(--paper-3)}
/* Hauptmenü */
.menu .card.s5-menu{padding-bottom:12px}
.s5-sc{display:grid;grid-template-columns:6px 1fr auto;gap:0 12px;align-items:center;width:100%;text-align:left;padding:9px 10px 9px 0;border-radius:11px;margin:0 0 4px;background:transparent}
.s5-sc:hover{background:var(--paper-2)}
.s5-sc.on{background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.08)}
.s5-sc .sw{align-self:stretch;border-radius:3px}
.s5-sc .t{font-weight:700;font-size:14px}
.s5-sc .s{font-size:12px;color:var(--ink-3)}
.s5-sc .r{text-align:right;font-size:12px;color:var(--ink-3);white-space:nowrap}
.s5-detail{background:#fff;border-radius:12px;padding:12px 14px;margin:2px 0 10px;font-size:13px;color:var(--ink-2);line-height:1.45}
.s5-detail ul{margin:6px 0 10px;padding-left:18px}
.s5-detail li{margin:2px 0}
.s5-detail .acts{margin-top:10px}
.s5-prof{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:6px}
.s5-prof div{background:var(--paper-2);border-radius:10px;padding:8px 10px}
.s5-prof .k{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);font-weight:700}
.s5-prof .v{font-family:var(--f-num);font-size:20px;font-weight:700}
/* Zielanzeige im Spiel */
.s5-hud{position:absolute;right:12px;top:calc(76px + var(--safe-t));width:262px;padding:11px 13px 9px;font-size:12.5px;z-index:5;transition:opacity .25s}
.s5-hud .hd{display:flex;align-items:center;gap:8px;cursor:pointer}
.s5-hud .hd .ey{font-size:10px;letter-spacing:.14em;text-transform:uppercase;font-weight:800;color:var(--ink-3)}
.s5-hud .hd .nm{font-family:var(--f-display);font-weight:700;font-size:13px;line-height:1.15}
.s5-hud .hd .pill{margin-left:auto;font-family:var(--f-num);font-weight:700;font-size:15px;white-space:nowrap}
.s5-hud .gl{display:grid;grid-template-columns:12px 1fr auto;gap:3px 7px;align-items:center;margin-top:8px}
.s5-hud .gl .ck{width:11px;height:11px;border-radius:50%;border:2.5px solid var(--ink)}
.s5-hud .gl .ck.ok{background:var(--good);border-color:var(--good)}
.s5-hud .gl .lb{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ink-2);font-weight:600}
.s5-hud .gl .vl{font-family:var(--f-num);font-weight:700;font-size:13px;text-align:right}
.s5-hud .gl .bar{grid-column:2 / 4;height:3px;border-radius:2px;background:var(--paper-3);overflow:hidden;margin-bottom:2px}
.s5-hud .gl .bar i{display:block;height:100%;border-radius:2px}
.s5-hud .tb{height:4px;border-radius:2px;background:var(--paper-3);margin-top:7px;overflow:hidden}
.s5-hud .tb i{display:block;height:100%;border-radius:2px}
.s5-hud.mini .gl,.s5-hud.mini .tb,.s5-hud.mini .warn{display:none}
.s5-hud .warn{margin-top:8px;padding:6px 8px;border-radius:9px;background:#f6dcd8;color:#9e2b23;font-weight:700;font-size:12px}
.s5-hud .metro{display:flex;align-items:flex-end;gap:10px;margin-top:6px}
.s5-hud .metro .sc{font-family:var(--f-num);font-weight:700;font-size:30px;line-height:.95}
.s5-hud .metro .lb{font-size:11px;color:var(--ink-3);font-weight:700;letter-spacing:.08em;text-transform:uppercase}
/* Erfolgs-Banner */
.s5-banner{position:absolute;left:66px;top:calc(96px + var(--safe-t));z-index:45;display:flex;gap:12px;align-items:center;padding:10px 16px 10px 10px;border-radius:16px;background:var(--ink);color:var(--paper);box-shadow:var(--shadow);animation:s5in .45s cubic-bezier(.2,1.4,.4,1);max-width:min(420px,calc(100vw - 32px));pointer-events:none}
.s5-banner .ey{font-size:10px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:var(--tier)}
.s5-banner .nm{font-family:var(--f-display);font-weight:700;font-size:15px;line-height:1.2}
.s5-banner .ds{font-size:12px;color:#c4cad6;line-height:1.3;margin-top:1px}
.s5-banner.out{transition:opacity .5s,transform .5s;opacity:0;transform:translateY(-8px)}
@keyframes s5in{from{opacity:0;transform:translateY(-14px) scale(.96)}to{opacity:1;transform:none}}
/* Fenster */
.s5-modal .s5-goallist{margin:10px 0 4px;padding:0;list-style:none}
.s5-modal .s5-goallist li{display:flex;gap:9px;align-items:center;padding:5px 0;font-weight:600;color:var(--ink)}
.s5-modal .s5-goallist li::before{content:'';width:12px;height:12px;border-radius:50%;border:3px solid var(--ink);flex:none}
.s5-modal .s5-goallist li.ok::before{background:var(--good);border-color:var(--good)}
.s5-modal .hero{border-radius:14px;color:#fff;padding:16px 18px;margin:-6px -8px 14px}
.s5-modal .hero .eyebrow{color:rgba(255,255,255,.85)}
.s5-modal .hero h2{color:#fff;margin:4px 0 2px}
.s5-modal .hero p{color:rgba(255,255,255,.92);margin:0}
.s5-modal .facts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}
.s5-modal .facts div{background:var(--paper-2);border-radius:10px;padding:8px 10px}
.s5-modal .facts .k{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);font-weight:700}
.s5-modal .facts .v{font-family:var(--f-num);font-size:20px;font-weight:700}
.s5-modal .bigstars{font-size:40px;letter-spacing:6px;text-align:center;color:var(--l-yellow);margin:4px 0}
.s5-modal .bigstars .off{color:var(--paper-3)}
@media (max-width:760px){
  .s5-hud{left:8px;right:8px;width:auto;top:calc(104px + var(--safe-t));padding:8px 11px}
  .s5-banner{left:8px;right:8px;top:calc(60px + var(--safe-t))}
  .s5-modal .facts{grid-template-columns:repeat(2,1fr)}
}
`;
let cssDone = false;
function ensureCss() {
  if (cssDone || !hasDom) return;
  cssDone = true;
  const el = document.createElement('style');
  el.id = 's5-style';
  el.textContent = CSS;
  document.head.appendChild(el);
}

// ---------------------------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------------------------
const TROPHY = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v3M8.5 20h7M10 17h4l.5 3h-5l.5-3Z"/></svg>';
const CAT_ICON = { growth: 'zones', money: 'coin', transit: 'transit', eco: 'parks', people: 'heart', culture: 'landmarks', challenge: 'line', secret: 'mask' };
function medal(a, done, size = 44) {
  const t = TIERS[a.tier];
  const col = done ? t.color : '#cfc6b4';
  return `<span class="s5-medal" style="width:${size}px;height:${size}px"><svg class="m" viewBox="0 0 44 44" aria-hidden="true"><path d="M14 28 9 42l6-3 4 4 3-11" fill="${done ? '#e8543f' : '#ddd5c5'}"/><path d="M30 28l5 14-6-3-4 4-3-11" fill="${done ? '#2f8fe0' : '#ddd5c5'}"/><circle cx="22" cy="19" r="15" fill="${col}"/><circle cx="22" cy="19" r="11.5" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.6"/></svg><span class="g">${icon(CAT_ICON[a.cat] || 'heart', Math.round(size * 0.4), 2.4)}</span></span>`;
}
const stars = (n, max = 3) => `<span class="s5-stars">${'★'.repeat(n)}<span class="off">${'★'.repeat(Math.max(0, max - n))}</span></span>`;
const meter = (p, col) => `<div class="meter"><i style="width:${clamp(p, 0, 1) * 100}%;background:${col}"></i></div>`;
const levelColor = (lvl) => ({ leicht: 'var(--good)', mittel: 'var(--warn)', schwer: 'var(--bad)' }[lvl] || 'var(--l-red)');
const daysLabel = (d) => (d === 1 ? '1 Tag' : `${d} Tage`);
const daysDat = (d) => (d === 1 ? '1 Tag' : `${d} Tagen`); // „nach/in … Tagen"

// ---------------------------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------------------------
function tabZiele(ui) {
  const g = ui.g;
  const ss = scenarioStatus(g);
  let html = '';
  if (ss && isMetro(g)) {
    const m = g.ext.progression.metro;
    const score = metroScore(g);
    const best = loadProfile().metro[g.opts.mapType] || 0;
    const weeks = Math.floor((g.day() - m.startDay) / 7) + 1;
    const nextIn = Math.max(0, m.next - g.day());
    html += `<div class="s5-scen-hd" style="background:${ss.sc.color}"><div class="ey">Metro-Modus · ${esc(METRO_MAPS.find((x) => x.id === g.opts.mapType)?.name || '')}</div><div class="nm">${esc(g.name)}</div><div class="kk">Woche ${weeks} · ${m.districts.length} Viertel · ${g.transit.stations.size} Stationen</div><div class="days">${fmt(score)}<small>Fahrgäste</small></div></div>
<div class="res-strip"><div><div class="k">Rekord</div><div class="v">${fmt(Math.max(best, score))}</div></div><div><div class="k">Sterne</div><div class="v">${stars(metroStarsFor(score))}</div></div><div><div class="k">Neues Viertel</div><div class="v">${m.ended ? '–' : nextIn ? daysLabel(nextIn) : 'heute'}</div></div></div>
${m.worst > 0.05 && !m.ended ? `<div class="sec"><h3>Höchste Gefahr</h3><div class="row"><span class="grow"><b>${esc(m.worstName)}</b> ist zu ${Math.round(m.worst * 100)} % übergelaufen</span></div>${meter(m.worst, m.worst > 0.6 ? 'var(--bad)' : 'var(--warn)')}</div>` : ''}
<div class="sec"><h3>Sterne</h3><p style="margin:0;font-size:13px;color:var(--ink-2);line-height:1.5">${METRO_STARS.map((v, i) => `${'★'.repeat(i + 1)} ab ${fmt(v)} Fahrgästen`).join(' · ')}</p></div>
<div class="sec"><h3>Regeln</h3><p style="margin:0;font-size:13px;color:var(--ink-2);line-height:1.5">Alle paar Tage entsteht ein neues Viertel mit eigener Station – auch ohne Linie sammeln sich dort Fahrgäste. Wird eine Station zu voll, füllt sich ihr roter Ring. Ist er voll, ist das Spiel vorbei. Jede Woche gibt es Nachschub zur Wahl, Meilensteine bringen Geld und Linien.</p></div>`;
  } else if (ss) {
    const sc = ss.sc, st = ss.st;
    const status = st.status === 'won' ? `Geschafft ${stars(st.stars)}` : st.status === 'lost' ? 'Gescheitert' : st.free ? 'Freies Spiel' : null;
    html += `<div class="s5-scen-hd" style="background:${sc.color}"><div class="ey">Szenario · ${esc(sc.level)}</div><div class="nm">${esc(sc.name)}</div><div class="kk">${esc(sc.kicker)}</div>${status ? '' : `<div class="days">${ss.left}<small>Tage übrig</small></div>`}${sc.days ? `<div class="s5-timebar"><i style="width:${clamp(ss.elapsed / sc.days, 0, 1) * 100}%"></i></div>` : ''}</div>
${status ? `<div class="chips"><span class="chip ${st.status === 'won' ? 'ok' : st.status === 'lost' ? 'no' : ''}">${status}</span>${st.reason ? `<span class="chip">${esc(st.reason)}</span>` : ''}</div>` : ''}
<div class="sec"><h3>Ziele</h3>${ss.goals.map((r) => `<div class="s5-goal${r.done ? ' done' : ''}"><span class="ck"></span><span class="lb">${esc(r.goal.label)}${r.goal.hold ? ` <span style="color:var(--ink-3);font-weight:500">(${Math.min(r.held, r.goal.hold)}/${r.goal.hold} Tage)</span>` : ''}</span><span class="vl">${esc(r.text)}</span>${meter(r.progress, r.done ? 'var(--good)' : sc.color)}</div>`).join('')}</div>
<div class="sec"><h3>Auftrag</h3><p style="margin:0;font-size:13px;color:var(--ink-2);line-height:1.5">${esc(sc.desc)}</p>${bannedNames(sc).length ? `<p style="margin:8px 0 0;font-size:13px;color:var(--bad);font-weight:600">Verboten: ${esc(bannedNames(sc).join(', '))}</p>` : ''}</div>
<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn small ghost" data-act="s5-brief">Briefing anzeigen</button><button class="btn small ghost" data-act="s5-restart">Neu starten</button></div>`;
  } else {
    const ms = MILESTONES[g.milestone], next = MILESTONES[g.milestone + 1];
    html += `<div class="s5-scen-hd" style="background:var(--ink)"><div class="ey">Freies Spiel</div><div class="nm">${esc(g.name)}</div><div class="kk">${esc(ms.name)}${next ? ` · nächster Meilenstein „${esc(next.name)}" bei ${fmt(next.pop)} Einwohnern` : ''}</div>${next ? `<div class="s5-timebar"><i style="width:${clamp((g.stats.pop - ms.pop) / (next.pop - ms.pop), 0, 1) * 100}%"></i></div>` : ''}</div>`;
    const qs = questStatus(g);
    if (qs.length) html += `<div class="sec"><h3>Bürgeraufträge</h3>${qs.map(questRow).join('')}</div>`;
    else if (!g.sandbox) html += '<div class="sec"><h3>Bürgeraufträge</h3><p style="margin:0;font-size:13px;color:var(--ink-3)">Gerade kein Auftrag – dein Stab meldet sich bald mit neuen Wünschen der Bürger.</p></div>';
    if (g.sandbox) html += '<p style="color:var(--ink-3);font-size:13px">Im Sandkasten werden keine Erfolge und Aufträge vergeben.</p>';
    else {
      const near = achievementState(g).filter((x) => !x.unlocked && x.avail && !x.a.secret && x.progress > 0).sort((a, b) => b.progress - a.progress).slice(0, 4);
      if (near.length) html += `<div class="sec"><h3>Fast geschafft</h3>${near.map((x) => achRow(x)).join('')}</div>`;
    }
  }
  const tips = adviceFor(g).slice(0, 3);
  if (tips.length) html += `<div class="sec" style="margin-top:14px"><h3>Ratgeber</h3>${tips.map(tipRow).join('')}</div>`;
  return html;
}
function metroStarsFor(score) { return score >= METRO_STARS[2] ? 3 : score >= METRO_STARS[1] ? 2 : score >= METRO_STARS[0] ? 1 : 0; }

function achRow(x) {
  const a = x.a, t = TIERS[a.tier];
  const hidden = a.secret && !x.unlocked;
  const valTxt = x.unlocked ? `Tag ${x.day}` : x.goal > 1 ? `${a.fmt ? a.fmt(x.value) : fmt(x.value)} / ${a.fmt ? a.fmt(x.goal) : fmt(x.goal)}` : x.hint || `${Math.round(x.progress * 100)} %`;
  return `<div class="s5-ach${x.unlocked ? ' done' : ''}${!x.avail ? ' locked' : ''}" style="--tier:${t.color}">${medal(a, x.unlocked)}<div><div class="nm">${hidden ? 'Geheimer Erfolg' : esc(a.name)}<span class="t">${t.name}</span></div><div class="ds">${hidden ? 'Wird verraten, sobald du ihn freischaltest.' : !x.avail ? `${esc(a.desc)} (${x.skipped ? 'war beim Start des Szenarios schon erfüllt' : 'braucht ein Spielsystem, das hier fehlt'})` : esc(a.desc)}</div>${hidden ? '' : `<div class="pg">${meter(x.progress, x.unlocked ? t.color : 'var(--ink-3)')}<span>${esc(valTxt)}</span></div>`}</div></div>`;
}
function questRow(r) {
  const a = ADV[r.t.who] || ADV.bau;
  return `<div class="s5-goal${r.ok ? ' done' : ''}" style="grid-template-columns:20px 1fr auto"><span class="ck"></span><span class="lb">${esc(r.title)}<br><span style="font-weight:500;color:var(--ink-2);font-size:12.5px">${esc(r.desc)}</span><br><span style="font-weight:600;color:var(--ink-3);font-size:11.5px">${esc(a.role)} ${esc(a.name)} · Belohnung: ${esc(r.reward)}</span></span><span class="vl">${esc(r.text)}<br><span style="font-size:11.5px;color:${r.left <= 2 ? 'var(--bad)' : 'var(--ink-3)'}">noch ${daysLabel(r.left)}</span></span>${meter(r.progress, r.ok ? 'var(--good)' : a.color)}</div>`;
}
function tipRow(t) {
  const a = ADVISORS[t.who] || ADVISORS.bau;
  const ini = a.name.split(' ').map((p) => p[0]).join('');
  return `<div class="s5-tip${t.prio >= 85 ? ' hot' : ''}"><span class="av" style="background:${a.color}">${esc(ini)}</span><div><div class="who">${esc(a.role)} ${esc(a.name)}</div><div class="tt">${esc(t.title)}</div><div class="tx">${esc(t.text)}</div></div></div>`;
}

function tabErfolge(ui) {
  const g = ui.g;
  const list = achievementState(g);
  const pts = achievementPoints(g);
  const { rank, next } = rankFor(pts);
  const done = list.filter((x) => x.unlocked).length;
  const avail = list.filter((x) => x.avail).length;
  const cat = ui._s5cat || 'all';
  const shown = list.filter((x) => cat === 'all' || x.a.cat === cat).sort((a, b) => (b.unlocked - a.unlocked) || (b.avail - a.avail) || (b.progress - a.progress));
  const prog = next ? (pts - rank.pts) / (next.pts - rank.pts) : 1;
  return `<div class="s5-rank"><div style="flex:1;min-width:0"><div class="lvl">${esc(rank.name)}</div><div class="sub">${done} von ${avail} Erfolgen${next ? ` · nächster Rang „${esc(next.name)}" bei ${next.pts} Punkten` : ' · höchster Rang'}</div><div class="bar"><i style="width:${clamp(prog, 0, 1) * 100}%"></i></div></div><div class="pts">${pts}<small>Punkte</small></div></div>
${g.sandbox ? '<p style="color:var(--ink-3);font-size:13px;margin:0 0 12px">Im Sandkasten werden keine Erfolge vergeben – hier siehst du trotzdem alle.</p>' : ''}${isMetro(g) ? '<p style="color:var(--ink-3);font-size:13px;margin:0 0 12px">Im Metro-Modus zählen nur Pulsbahn- und Herausforderungs-Erfolge.</p>' : ''}
<div class="s5-chips"><button data-act="s5-cat" data-c="all" class="${cat === 'all' ? 'on' : ''}">Alle</button>${ACH_CATS.map((c) => `<button data-act="s5-cat" data-c="${c.id}" class="${cat === c.id ? 'on' : ''}">${esc(c.name)}</button>`).join('')}</div>
${shown.map(achRow).join('')}`;
}

function tabRatgeber(ui) {
  const tips = adviceFor(ui.g);
  if (!tips.length) return '<p style="color:var(--ink-3)">Alles im Lot – der Stab hat gerade keine Hinweise.</p>';
  return `<p style="margin:0 0 8px;font-size:13px;color:var(--ink-2);line-height:1.45">Dein Stab meldet, was gerade am meisten drückt. Die dringendsten Hinweise stehen oben.</p>${tips.map(tipRow).join('')}`;
}

registerPanel({
  id: 'progression',
  title: 'Ziele & Erfolge',
  icon: TROPHY,
  order: 60,
  render(ui) {
    ensureCss();
    const tab = ui._s5tab || 'ziele';
    const tabs = [['ziele', 'Ziele'], ['erfolge', 'Erfolge'], ['ratgeber', 'Ratgeber']];
    const body = tab === 'erfolge' ? tabErfolge(ui) : tab === 'ratgeber' ? tabRatgeber(ui) : tabZiele(ui);
    return `<div class="s5-tabs">${tabs.map(([k, n]) => `<button data-act="s5-tab" data-t="${k}" class="${tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>${body}`;
  },
  click(ui, act, el) {
    if (act === 's5-tab') ui._s5tab = el.dataset.t;
    else if (act === 's5-cat') ui._s5cat = el.dataset.c;
    else if (act === 's5-brief') { ui.closePanels(); showIntro(ui, false); }
    else if (act === 's5-restart') restartScenario(ui.app);
  },
});

// ---------------------------------------------------------------------------------------------
// Fenster: Briefing, Sieg, Niederlage, Metro-Ende
// ---------------------------------------------------------------------------------------------
function openModal(ui, html, onClick) {
  if (ui && typeof ui.openModal === 'function') return ui.openModal(html, onClick);
  // Rückfall, falls die Oberfläche anders aufgebaut ist
  const root = document.getElementById('modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'backdrop';
  wrap.innerHTML = html;
  root.appendChild(wrap);
  wrap.addEventListener('click', (e) => onClick(e, () => wrap.remove()));
  return wrap;
}
function queue(ui, fn) {
  if (ui && typeof ui.queueModal === 'function') ui.queueModal(fn); else fn();
}

function restartScenario(app) {
  const g = app.game;
  if (!g || !g.opts.scenario) return;
  const extra = isMetro(g) ? { mapType: g.opts.mapType, seed: Math.floor(Math.random() * 99999) } : {};
  app.newGame(scenarioOptions(g.opts.scenario, extra));
}

function showIntro(ui, start = true) {
  ensureCss();
  const g = ui.g;
  const ss = scenarioStatus(g);
  if (!ss) return;
  const sc = ss.sc;
  const metro = isMetro(g);
  const best = metro ? loadProfile().metro[g.opts.mapType] || 0 : 0;
  const prof = loadProfile().scen[sc.id];
  const html = `<div class="modal s5-modal"><div class="hero" style="background:${sc.color}"><div class="eyebrow">${metro ? 'Herausforderung' : `Szenario · ${esc(sc.level)}`}</div><h2>${esc(sc.name)}</h2><p>${esc(sc.kicker)}</p></div>
<p>${esc(sc.desc)}</p>
${metro ? `<ul class="s5-goallist"><li>Verbinde die Stationen mit Linien – neue Viertel kommen von selbst.</li><li>Setze Züge und Waggons ein, bevor eine Station überläuft.</li><li>Jede Woche wählst du Nachschub. Punkte = beförderte Fahrgäste.</li></ul>${best ? `<p style="margin:6px 0 0">Dein Rekord auf dieser Karte: <b>${fmt(best)}</b></p>` : ''}`
    : `<div class="eyebrow" style="margin-top:12px">Ziele${sc.days ? ` – in ${sc.days} Tagen` : ''}</div><ul class="s5-goallist">${ss.goals.map((r) => `<li class="${r.done ? 'ok' : ''}">${esc(r.goal.label)}${r.goal.hold ? ` (${r.goal.hold} Tage halten)` : ''}</li>`).join('')}</ul>${bannedNames(sc).length ? `<p style="margin:4px 0 0;color:var(--bad);font-weight:600">Verboten: ${esc(bannedNames(sc).join(', '))}</p>` : ''}${prof ? `<p style="margin:6px 0 0">Bisher bestes Ergebnis: ${stars(prof.stars)} in ${daysDat(prof.best)}</p>` : ''}`}
<div class="acts">${start ? '<button class="btn ghost" data-act="menu">Zurück zum Menü</button>' : ''}<button class="btn" data-act="go">${start ? 'Los geht’s!' : 'Weiter'}</button></div></div>`;
  openModal(ui, html, (e, close) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    close();
    if (b.dataset.act === 'menu') { ui.app.toMenu(); return; }
    if (start && typeof ui.setSpeed === 'function') ui.setSpeed(1);
  });
}

function showEnd(ui, msg) {
  ensureCss();
  const g = ui.g, app = ui.app;
  const ss = scenarioStatus(g);
  if (!ss) return;
  const sc = ss.sc, st = ss.st;
  let html;
  if (msg.metro) {
    const score = st.score ?? metroScore(g);
    const record = profileMetro(g.opts.mapType, score);
    const m = g.ext.progression.metro;
    html = `<div class="modal s5-modal"><div class="hero" style="background:${sc.color}"><div class="eyebrow">Endstation</div><h2>${esc(st.reason || 'Das Netz ist überlastet.')}</h2><p>${record ? 'Neuer Rekord auf dieser Karte!' : 'Die Fahrgäste haben aufgegeben.'}</p></div>
<div style="text-align:center"><div class="s5-big">${fmt(score)}</div><div class="eyebrow" style="margin-top:4px">beförderte Fahrgäste</div><div class="bigstars">${'★'.repeat(st.stars)}<span class="off">${'★'.repeat(3 - st.stars)}</span></div></div>
<div class="facts"><div><div class="k">Tage</div><div class="v">${g.day() - m.startDay}</div></div><div><div class="k">Viertel</div><div class="v">${m.districts.length}</div></div><div><div class="k">Linien</div><div class="v">${g.transit.lines.length}</div></div><div><div class="k">Züge</div><div class="v">${g.transit.trains.length}</div></div><div><div class="k">Waggons</div><div class="v">${g.transit.totalWagons()}</div></div><div><div class="k">Rekord</div><div class="v">${fmt(loadProfile().metro[g.opts.mapType] || score)}</div></div></div>
<div class="acts"><button class="btn ghost" data-act="menu">Hauptmenü</button><button class="btn ghost" data-act="free">Stadt weiter ansehen</button><button class="btn" data-act="again">Nochmal (neue Karte)</button></div></div>`;
  } else if (msg.won) {
    profileScenario(sc.id, st.stars, st.endDay - st.startDay);
    const idx = SCENARIOS.findIndex((x) => x.id === sc.id);
    const nextSc = SCENARIOS.slice(idx + 1).find((x) => !x.metro) || null;
    html = `<div class="modal s5-modal"><div class="hero" style="background:${sc.color}"><div class="eyebrow">Szenario geschafft</div><h2>${esc(sc.name)}</h2><p>${esc(g.name)} hat es geschafft – nach ${daysDat(st.endDay - st.startDay)}.</p></div>
<div class="bigstars">${'★'.repeat(st.stars)}<span class="off">${'★'.repeat(3 - st.stars)}</span></div>
<p style="text-align:center;margin:0 0 6px">${st.stars === 3 ? 'Meisterhaft! Schneller geht es kaum.' : st.stars === 2 ? 'Stark! Mit etwas mehr Tempo gibt es den dritten Stern.' : 'Geschafft! Für mehr Sterne musst du schneller sein.'}</p>
<ul class="s5-goallist">${ss.goals.map((r) => `<li class="ok">${esc(r.goal.label)} – ${esc(r.text)}</li>`).join('')}</ul>
<div class="acts"><button class="btn ghost" data-act="menu">Hauptmenü</button>${nextSc ? `<button class="btn ghost" data-act="next" data-id="${nextSc.id}">Nächstes: ${esc(nextSc.name)}</button>` : ''}<button class="btn" data-act="free">Weiterbauen</button></div></div>`;
  } else {
    html = `<div class="modal s5-modal"><div class="hero" style="background:#5d6470"><div class="eyebrow">Szenario gescheitert</div><h2>${esc(sc.name)}</h2><p>${esc(st.reason)}</p></div>
<ul class="s5-goallist">${ss.goals.map((r) => `<li class="${r.done ? 'ok' : ''}">${esc(r.goal.label)} – ${esc(r.text)}</li>`).join('')}</ul>
<div class="acts"><button class="btn ghost" data-act="menu">Hauptmenü</button><button class="btn ghost" data-act="free">Ohne Ziel weiterspielen</button><button class="btn" data-act="again">Nochmal versuchen</button></div></div>`;
  }
  try { app.audio?.play?.(msg.won ? 'milestone' : 'bad'); } catch (e) { /* egal */ }
  openModal(ui, html, (e, close) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    close();
    if (act === 'menu') { app.toMenu(); return; }
    if (act === 'again') { restartScenario(app); return; }
    if (act === 'next') { app.newGame(scenarioOptions(b.dataset.id)); return; }
    if (act === 'free') { continueFreePlay(g); if (typeof ui.setSpeed === 'function') ui.setSpeed(1); }
  });
}

// ---------------------------------------------------------------------------------------------
// Erfolgs-Banner
// ---------------------------------------------------------------------------------------------
const bannerQueue = [];
let bannerBusy = false;
function showBanner(a) {
  bannerQueue.push(a);
  if (!bannerBusy) nextBanner();
}
function nextBanner() {
  const a = bannerQueue.shift();
  const host = document.getElementById('app');
  if (!a || !host) { bannerBusy = false; return; }
  bannerBusy = true;
  ensureCss();
  const t = TIERS[a.tier];
  const d = document.createElement('div');
  d.className = 's5-banner';
  d.style.setProperty('--tier', t.color);
  d.innerHTML = `${medal(a, true, 46)}<div><div class="ey">${a.eyebrow ? esc(a.eyebrow) : `Erfolg · ${t.name} · +${t.pts}`}</div><div class="nm">${esc(a.name)}</div><div class="ds">${esc(a.desc)}</div></div>`;
  host.appendChild(d);
  setTimeout(() => { d.classList.add('out'); setTimeout(() => { d.remove(); nextBanner(); }, 520); }, 4200);
}

// ---------------------------------------------------------------------------------------------
// Zielanzeige im Spiel (rechts oben, verschwindet, wenn ein Panel offen ist)
// ---------------------------------------------------------------------------------------------
let hudEl = null, hudGame = null, hudMini = false;
function renderHud(ui) {
  const g = ui.g;
  const hud = document.getElementById('hud');
  if (!hud || hud.hidden) return;
  const ss = scenarioStatus(g);
  const active = ss && (ss.st.status === 'running' || (isMetro(g) && !g.ext.progression.metro?.ended)) && !ss.st.free;
  const quests = active ? [] : questStatus(g);
  if (!active && !quests.length) { if (hudEl) { hudEl.remove(); hudEl = null; } return; }
  if (!hudEl || !hudEl.isConnected || hudGame !== g) {
    if (hudEl) hudEl.remove();
    ensureCss();
    hudEl = document.createElement('div');
    hudEl.className = 'sign s5-hud';
    hudEl.addEventListener('click', (e) => {
      if (e.target.closest('[data-s5=open]')) { ui._s5tab = 'ziele'; ui.openPanel('progression'); return; }
      hudMini = !hudMini;
      renderHud(ui);
    });
    hud.appendChild(hudEl);
    hudGame = g;
  }
  const insp = ui.el?.insp && !ui.el.insp.hidden;
  hudEl.style.display = ui.panel ? 'none' : '';
  hudEl.classList.toggle('mini', hudMini || !!insp);
  const sc = ss?.sc;
  let html;
  if (!active) {
    html = `<div class="hd"><div style="min-width:0"><div class="ey">Bürgeraufträge</div><div class="nm">${quests.length === 1 ? '1 offener Auftrag' : `${quests.length} offene Aufträge`}</div></div><span class="pill">${quests.filter((r) => r.ok).length}/${quests.length}</span></div>
<div class="gl">${quests.map((r) => { const a = ADV[r.t.who] || ADV.bau; return `<span class="ck${r.ok ? ' ok' : ''}"></span><span class="lb" title="${esc(r.desc)}">${esc(r.title)}</span><span class="vl">${esc(r.text)} · ${r.left} T.</span><span class="bar"><i style="width:${clamp(r.progress, 0, 1) * 100}%;background:${r.ok ? 'var(--good)' : a.color}"></i></span>`; }).join('')}</div>`;
  } else if (isMetro(g)) {
    const m = g.ext.progression.metro;
    const weeks = Math.floor((g.day() - m.startDay) / 7) + 1;
    const nextIn = Math.max(0, m.next - g.day());
    html = `<div class="hd"><div style="min-width:0"><div class="ey" style="color:${sc.color}">Metro · Woche ${weeks}</div><div class="nm">${m.districts.length} Viertel · ${g.transit.stations.size} Stationen</div></div><span class="pill">${fmt(metroScore(g))}</span></div>
<div class="gl"><span class="ck${nextIn > 1 ? ' ok' : ''}"></span><span class="lb">Neues Viertel</span><span class="vl">${nextIn ? `in ${daysDat(nextIn)}` : 'heute'}</span>
<span class="ck${g.transit.freeTrains + g.transit.freeWagons > 0 ? '' : ' ok'}"></span><span class="lb">Im Depot</span><span class="vl">${g.transit.freeTrains} Züge · ${g.transit.freeWagons} Wagg.</span>
<span class="ck ok"></span><span class="lb">Linien</span><span class="vl">${g.transit.lines.length} / ${g.transit.linesMax}</span></div>
${m.worst > 0.15 ? `<div class="warn">⚠ ${esc(m.worstName)} läuft über: ${Math.round(m.worst * 100)} %</div>` : ''}
<div class="tb"><i style="width:${clamp(m.worst, 0, 1) * 100}%;background:${m.worst > 0.6 ? 'var(--bad)' : 'var(--warn)'}"></i></div>`;
  } else {
    const done = ss.goals.filter((r) => r.done).length;
    html = `<div class="hd"><div style="min-width:0"><div class="ey" style="color:${sc.color}">Szenario · ${done}/${ss.goals.length} Ziele</div><div class="nm">${esc(sc.name)}</div></div><span class="pill" title="Verbleibende Tage">${ss.left !== null ? `${ss.left} T.` : ''}</span></div>
<div class="gl">${ss.goals.map((r) => `<span class="ck${r.done ? ' ok' : ''}"></span><span class="lb" title="${esc(r.goal.label)}">${esc(r.goal.label)}</span><span class="vl">${esc(r.text)}</span><span class="bar"><i style="width:${clamp(r.progress, 0, 1) * 100}%;background:${r.done ? 'var(--good)' : sc.color}"></i></span>`).join('')}</div>
${sc.days ? `<div class="tb"><i style="width:${clamp(ss.elapsed / sc.days, 0, 1) * 100}%;background:${ss.left <= 5 ? 'var(--bad)' : 'var(--ink-3)'}"></i></div>` : ''}`;
  }
  html += `<div style="display:flex;justify-content:flex-end;margin-top:6px"><button class="btn small ghost" data-s5="open" style="height:24px;font-size:12px">Details</button></div>`;
  if (hudEl._html !== html) { hudEl.innerHTML = html; hudEl._html = html; }
}

// ---------------------------------------------------------------------------------------------
// Brücke: Meldungen der Simulation abholen
// ---------------------------------------------------------------------------------------------
function tick() {
  const app = window.__stadtpuls;
  if (!app || app.mode !== 'game' || !app.ui || !app.game) return;
  const ui = app.ui, g = app.game;
  if (ui.g !== g) return;
  const st = g.ext?.progression;
  if (!st) return;
  if (isMetro(g) && !ui._s5tut) { ui._s5tut = true; ui.tutorialHidden = true; if (ui.el?.tutorial) ui.el.tutorial.hidden = true; }
  while (st.inbox.length) {
    const msg = st.inbox.shift();
    if (msg.type === 'achievement') {
      const a = achievementById(msg.id);
      if (a) { profileAch(a.id); showBanner(a); try { app.audio?.play?.('card'); } catch (e) { /* egal */ } }
    } else if (msg.type === 'quest' && msg.ok) {
      showBanner({ tier: 2, cat: 'challenge', name: msg.title, desc: `Belohnung: ${msg.reward}`, eyebrow: 'Auftrag erfüllt' });
      try { app.audio?.play?.('money'); } catch (e) { /* egal */ }
    } else if (msg.type === 'scenarioIntro') queue(ui, () => showIntro(ui, true));
    else if (msg.type === 'scenarioEnd') queue(ui, () => showEnd(ui, msg));
  }
  renderHud(ui);
}
if (hasDom && typeof window !== 'undefined') setInterval(() => { try { tick(); } catch (e) { console.error('Fortschritt', e); } }, 300);

// ---------------------------------------------------------------------------------------------
// Hauptmenü: Szenarien, Metro-Modus, Ehrentafel
// ---------------------------------------------------------------------------------------------
MENU_SECTIONS.push({
  render(menu) {
    ensureCss();
    const s5 = (menu._s5 ||= { sel: null, map: 'river' });
    const prof = loadProfile();
    const list = SCENARIOS.filter((x) => !x.metro);
    const metro = SCENARIOS.find((x) => x.metro);
    const achCount = Object.keys(prof.ach).filter((id) => achievementById(id)).length;
    const pts = Object.keys(prof.ach).reduce((a, id) => a + (achievementById(id) ? TIERS[achievementById(id).tier].pts : 0), 0);
    const totalStars = Object.values(prof.scen).reduce((a, x) => a + (x.stars || 0), 0);
    const rows = list.map((sc) => {
      const p = prof.scen[sc.id];
      const on = s5.sel === sc.id;
      const row = `<button class="s5-sc${on ? ' on' : ''}" data-act="s5-sel" data-id="${sc.id}"><span class="sw" style="background:${sc.color}"></span><span><span class="t">${esc(sc.name)}</span><br><span class="s">${esc(sc.kicker)}</span></span><span class="r"><span style="color:${levelColor(sc.level)};font-weight:700">${esc(sc.level)}</span> · ${sc.days} T.<br>${p ? stars(p.stars) : '<span class="s5-stars"><span class="off">★★★</span></span>'}</span></button>`;
      if (!on) return row;
      const map = { river: 'Flusstal', coast: 'Küste', lakes: 'Seenplatte', islands: 'Inselreich', mountains: 'Bergland' }[sc.map] || sc.map;
      return row + `<div class="s5-detail"><b>${esc(sc.city)}</b> · ${esc(map)} · ${sc.size}² Felder<br>${esc(sc.desc)}<div class="eyebrow" style="margin-top:8px">Ziele in ${sc.days} Tagen</div><ul>${sc.goals.map((goal) => `<li>${esc(goal.label)}${goal.hold ? ` (${goal.hold} Tage halten)` : ''}</li>`).join('')}</ul>${p ? `<div>Bestes Ergebnis: ${stars(p.stars)} in ${daysDat(p.best)} · ${p.wins}× geschafft</div>` : ''}<div class="acts"><button class="btn go" data-act="s5-start" data-id="${sc.id}">Szenario starten</button></div></div>`;
    }).join('');
    const best = prof.metro[s5.map] || 0;
    return `<div class="card s5-menu"><h3>Szenarien</h3><p class="seg-hint" style="margin:-6px 0 10px">Feste Karten, klare Ziele, knappe Zeit. Je schneller, desto mehr Sterne.</p>${rows}</div>
<div class="card s5-menu"><h3 style="display:flex;align-items:center;gap:8px"><span style="width:14px;height:14px;border-radius:50%;background:${metro.color};display:inline-block"></span>Metro-Modus</h3>
<p class="seg-hint" style="margin:-6px 0 10px">${esc(metro.desc)}</p>
<div class="field"><label>Karte</label><div class="seg">${METRO_MAPS.map((m) => `<button data-act="s5-map" data-v="${m.id}" class="${m.id === s5.map ? 'on' : ''}">${esc(m.name)}${prof.metro[m.id] ? ` · ${fmt(prof.metro[m.id])}` : ''}</button>`).join('')}</div></div>
<div class="acts" style="align-items:center"><button class="btn big go" data-act="s5-metro">Metro starten</button>${best ? `<span class="seg-hint">Rekord: <b>${fmt(best)}</b> Fahrgäste ${stars(metroStarsFor(best))}</span>` : '<span class="seg-hint">Noch kein Rekord auf dieser Karte.</span>'}</div></div>
<div class="card s5-menu"><h3>Ehrentafel</h3><div class="s5-prof"><div><div class="k">Erfolge</div><div class="v">${achCount} / ${ACHIEVEMENTS.length}</div></div><div><div class="k">Punkte</div><div class="v">${pts}</div></div><div><div class="k">Sterne</div><div class="v">${totalStars} / ${list.length * 3}</div></div></div><p class="seg-hint" style="margin:6px 0 0">${esc(rankFor(pts).rank.name)} · Erfolge sammelst du in jeder Stadt außer im Sandkasten.</p></div>`;
  },
  click(menu, act, el) {
    const s5 = (menu._s5 ||= { sel: null, map: 'river' });
    if (act === 's5-sel') { s5.sel = s5.sel === el.dataset.id ? null : el.dataset.id; menu.render(); return true; }
    if (act === 's5-map') { s5.map = el.dataset.v; menu.render(); return true; }
    if (act === 's5-start') { menu.app.newGame(scenarioOptions(el.dataset.id)); return true; }
    if (act === 's5-metro') { menu.app.newGame(scenarioOptions('metro', { mapType: s5.map, seed: Math.floor(Math.random() * 99999) })); return true; }
    return false;
  },
});

void RANKS; void fmtMoney; void scenarioById;
