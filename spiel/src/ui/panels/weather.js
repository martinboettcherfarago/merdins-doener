// Panel „Wetter & Katastrophenschutz" (Besitzer S4).
// Reiter „Wetter": aktuelles Wetter, Jahreskreis, Vorhersage (Wetterstation), Wirkung auf die Stadt, Sandkasten-Wetter.
// Reiter „Schutz": Warnungen mit Vorbereitung, laufende Einsätze, Wiederaufbau, Schutz-Bewertung, Risiken, Chronik,
// Einstellung „Katastrophen" (Aus/Selten/Normal/Häufig, gespeichert in g.ext.disasters.freq), Sandkasten-Auslöser.
// Außerdem: Inspektor-Zusätze, drei Infoansichten (Hochwassergefahr, Katastrophenschutz, Winterdienst) und ein
// Abschnitt im Hauptmenü, der die Katastrophen-Häufigkeit für neue Städte festlegt (Game-Option „disasters").
import { registerPanel, INSPECTORS, registerOverlay, MENU_SECTIONS } from '../../registry.js';
import { BUILDINGS, DAY, WEEKDAYS, T, Z } from '../../config.js';
import { fmtMoney, fmt } from '../../util.js';
import { SEASONS, SEASON_INFO, SEASON_DAYS, KINDS, weatherImpact, setWeatherNow, calendar } from '../../sim/systems/weather.js';
import {
  DISASTERS, FREQS, PREP, prepOptions, prepCost, doPrep, etaText, forecastDays, stationCount, protectionScore, sirenAt,
  rebuildRuin, rebuildCost, triggerDisaster,
} from '../../sim/systems/disasters.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (v, plus = true) => `${v >= 0 ? (plus ? '+' : '') : '−'}${Math.abs(Math.round(v * 100))} %`;
const deg = (v) => `${v < 0 ? '−' : ''}${Math.abs(Math.round(v))}°`;
let tab = null;

// ---------- Eigene Stile (einmalig)
function injectCss() {
  if (typeof document === 'undefined' || document.getElementById('wx-css')) return;
  const s = document.createElement('style');
  s.id = 'wx-css';
  s.textContent = `
.wx-tabs{display:flex;gap:4px;margin:0 0 12px}
.wx-tabs button{flex:1;padding:7px 8px;border-radius:10px;background:var(--paper-2);font-weight:700;font-size:13px;position:relative}
.wx-tabs button.on{background:var(--ink);color:var(--paper)}
.wx-tabs .dot{position:absolute;top:5px;right:8px;width:8px;height:8px;border-radius:50%;background:var(--bad);box-shadow:0 0 0 2px var(--paper)}
.wx-now{border-radius:14px;padding:14px 14px 12px;color:#fff;display:grid;grid-template-columns:72px 1fr;gap:12px;align-items:center;position:relative;overflow:hidden}
.wx-now .t{font-family:var(--f-num);font-size:44px;font-weight:600;line-height:1}
.wx-now .l{font-weight:700;font-size:15px;margin-top:2px}
.wx-now .m{font-size:12.5px;opacity:.92;margin-top:2px}
.wx-now .ic{filter:drop-shadow(0 2px 6px rgba(0,0,0,.25))}
.wx-det{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:10px 0 0}
.wx-det div{background:var(--paper-2);border-radius:10px;padding:6px 8px;min-width:0}
.wx-det .k{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);font-weight:700}
.wx-det .v{font-family:var(--f-num);font-size:16px;font-weight:600;white-space:nowrap}
.wx-year{position:relative;height:10px;border-radius:5px;display:flex;margin:6px 0 4px}
.wx-year i{flex:1}.wx-year i:first-child{border-radius:5px 0 0 5px}.wx-year i:last-child{border-radius:0 5px 5px 0}
.wx-year b{position:absolute;top:-4px;width:4px;height:18px;margin-left:-2px;background:var(--ink);border-radius:2px;box-shadow:0 0 0 2px var(--paper)}
.wx-yl{display:flex;font-size:11px;color:var(--ink-3)}.wx-yl span{flex:1;text-align:center}
.wx-fc{display:grid;gap:4px}
.wx-fc .d{background:var(--paper-2);border-radius:10px;padding:6px 2px 6px;text-align:center;font-size:12px;position:relative;min-width:0}
.wx-fc .d .n{font-weight:700;font-size:11.5px}
.wx-fc .d .hi{font-family:var(--f-num);font-weight:600;font-size:15px;line-height:1.1}
.wx-fc .d .lo{color:var(--ink-3);font-family:var(--f-num);font-size:13px}
.wx-fc .d .pr{height:3px;background:var(--paper-3);border-radius:2px;margin:4px 6px 0;overflow:hidden}.wx-fc .d .pr i{display:block;height:100%;background:#2f8fe0}
.wx-fc .d.haz{box-shadow:inset 0 0 0 2px var(--bad)}
.wx-fc .d .hz{position:absolute;top:3px;right:4px;width:14px;height:14px;border-radius:50%;background:var(--bad);color:#fff;font-size:10px;font-weight:800;line-height:14px}
.wx-fc .d.unk{opacity:.42}
.wx-card{border-radius:12px;background:var(--paper-2);padding:10px 12px;margin:0 0 8px;border-left:5px solid #999}
.wx-card .hd{display:flex;gap:8px;align-items:center}
.wx-card .ttl{font-weight:700}.wx-card .sub{font-size:12px;color:var(--ink-2);line-height:1.35}
.wx-card .acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.wx-card .acts .btn.done{background:var(--good);color:#fff;opacity:1}
.wx-bar{height:6px;background:var(--paper-3);border-radius:3px;overflow:hidden;margin-top:6px}.wx-bar i{display:block;height:100%}
.wx-stats{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12.5px;margin-top:6px;color:var(--ink-2)}.wx-stats b{font-family:var(--f-num);font-size:14px;color:var(--ink)}
.wx-check{display:grid;grid-template-columns:20px 1fr auto;gap:2px 8px;align-items:start;padding:7px 0;border-bottom:1px solid var(--rule)}
.wx-check:last-child{border-bottom:0}
.wx-check .i{font-weight:800;font-size:14px;line-height:1.3}.wx-check .i.ok{color:var(--good)}.wx-check .i.no{color:var(--bad)}.wx-check .i.mid{color:var(--warn)}
.wx-check .t{font-weight:700;font-size:13.5px}.wx-check .s{grid-column:2/4;font-size:12px;color:var(--ink-3);line-height:1.35}
.wx-check .v{font-family:var(--f-num);font-weight:600;font-size:14px;white-space:nowrap}
.wx-lvl{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11.5px;font-weight:700;color:#fff}
.wx-score{display:flex;align-items:center;gap:12px;background:var(--paper-2);border-radius:12px;padding:10px 12px;margin-bottom:8px}
.wx-score .big{font-family:var(--f-num);font-size:34px;font-weight:600;line-height:1}
.wx-hist{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:12.5px}
.wx-hist .d{font-family:var(--f-num);color:var(--ink-3);white-space:nowrap}
.wx-grid{display:flex;flex-wrap:wrap;gap:6px}
.wx-note{font-size:12.5px;color:var(--ink-3);line-height:1.4;margin:6px 0 0}
.wx-insp{margin:10px 0 0;padding:8px 10px;border-radius:10px;background:var(--paper-2);font-size:12.5px;line-height:1.4}
.wx-insp b{font-weight:700}
`;
  document.head.appendChild(s);
}

// ---------- Wettersymbole (SVG)
function cloud(x, y, s, fill) {
  return `<path d="M${x - 14 * s} ${y + 6 * s}h${28 * s}a${7 * s} ${7 * s} 0 0 0 0-${14 * s}a${10 * s} ${10 * s} 0 0 0-${19 * s}-${3 * s}a${8 * s} ${8 * s} 0 0 0-${9 * s} ${17 * s}z" fill="${fill}"/>`;
}
export function wxIcon(kind, size = 48, night = false) {
  const sun = (x, y, r, col = '#ffc93c') => `<g><circle cx="${x}" cy="${y}" r="${r}" fill="${col}"/>${[0, 1, 2, 3, 4, 5, 6, 7].map((k) => { const a = (k / 8) * Math.PI * 2; return `<line x1="${x + Math.cos(a) * (r + 3)}" y1="${y + Math.sin(a) * (r + 3)}" x2="${x + Math.cos(a) * (r + 7)}" y2="${y + Math.sin(a) * (r + 7)}" stroke="${col}" stroke-width="3" stroke-linecap="round"/>`; }).join('')}</g>`;
  const moon = (x, y, r) => `<path d="M${x + r * 0.3} ${y - r}a${r} ${r} 0 1 0 ${r * 0.7} ${r * 1.55}a${r * 0.8} ${r * 0.8} 0 0 1-${r * 0.7}-${r * 1.55}z" fill="#f3e7b5"/>`;
  const drops = (n, col = '#5bb4f2') => Array.from({ length: n }, (_, k) => `<line x1="${16 + k * 8}" y1="34" x2="${13 + k * 8}" y2="42" stroke="${col}" stroke-width="3" stroke-linecap="round"/>`).join('');
  const flakes = () => [16, 26, 36].map((x, k) => `<g transform="translate(${x} ${37 + (k % 2) * 4})" stroke="#e9f4ff" stroke-width="2" stroke-linecap="round"><line x1="-4" y1="0" x2="4" y2="0"/><line x1="-2" y1="-3.5" x2="2" y2="3.5"/><line x1="2" y1="-3.5" x2="-2" y2="3.5"/></g>`).join('');
  const sky = night ? moon(18, 16, 9) : sun(18, 17, 8);
  let body = '';
  switch (kind) {
    case 'clear': body = night ? moon(24, 24, 13) : sun(24, 24, 10); break;
    case 'heat': body = sun(24, 24, 11, '#ff8a2a') + '<path d="M10 42c4-3 8 3 12 0s8 3 12 0 6 2 6 2" stroke="#ff8a2a" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".8"/>'; break;
    case 'frost': body = (night ? moon(24, 22, 12) : sun(24, 22, 9, '#bfe3ff')) + '<g transform="translate(36 36)" stroke="#bfe3ff" stroke-width="2.4" stroke-linecap="round"><line x1="-7" y1="0" x2="7" y2="0"/><line x1="-3.5" y1="-6" x2="3.5" y2="6"/><line x1="3.5" y1="-6" x2="-3.5" y2="6"/></g>'; break;
    case 'fair': body = sky + cloud(30, 28, 0.85, '#ffffff'); break;
    case 'cloudy': body = sky + cloud(26, 28, 1, '#f1f4f8'); break;
    case 'overcast': body = cloud(30, 22, 0.8, '#c9d1dc') + cloud(22, 30, 1, '#e3e8ef'); break;
    case 'rain': body = cloud(24, 24, 1.05, '#d4dbe5') + drops(4); break;
    case 'showers': body = sky + cloud(26, 24, 0.95, '#eef2f7') + drops(3); break;
    case 'thunder': body = cloud(24, 22, 1.05, '#8f99aa') + drops(2, '#8fc9f5') + '<path d="M26 26l-6 10h5l-3 9 9-12h-5l3-7z" fill="#ffd23c"/>'; break;
    case 'storm': body = cloud(26, 20, 1, '#aeb7c4') + '<path d="M6 32h22a4 4 0 1 0-4-4M8 39h28a4 4 0 1 1-4 4M4 46h16" stroke="#e8eef6" stroke-width="3" fill="none" stroke-linecap="round"/>'; break;
    case 'fog': body = cloud(26, 18, 0.85, '#e3e8ef') + [28, 34, 40].map((y, k) => `<line x1="${8 + k * 3}" y1="${y}" x2="${40 - k * 2}" y2="${y}" stroke="#e3e8ef" stroke-width="3.2" stroke-linecap="round"/>`).join(''); break;
    case 'snow': body = cloud(24, 24, 1.05, '#e9eef5') + flakes(); break;
    default: body = sun(24, 24, 10);
  }
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${body}</svg>`;
}
function nowKind(w) {
  if (w.storm && w.stormI > 0.2) return 'thunder';
  if (w.kind === 'storm' && w.wind > 0.55) return 'storm';
  if (w.snow > 0.05) return 'snow';
  if (w.rain > 0.05) return w.cloud < 0.78 ? 'showers' : 'rain';
  if (w.fog > 0.4) return 'fog';
  if (w.temp >= 30 && w.cloud < 0.4) return 'heat';
  if (w.temp <= -4 && w.cloud < 0.4) return 'frost';
  if (w.cloud < 0.15) return 'clear';
  if (w.cloud < 0.4) return 'fair';
  if (w.cloud < 0.75) return 'cloudy';
  return 'overcast';
}
function compass(windDir) {
  const a = windDir + Math.PI; // woher der Wind kommt
  const fx = Math.cos(a), fz = Math.sin(a);
  const b = (Math.atan2(fx, -fz) * 180) / Math.PI;
  const names = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  return names[(Math.round(((b + 360) % 360) / 45)) % 8];
}
const kmh = (w) => Math.round(w * 130);
function nowGradient(w, night) {
  if (night > 0.5) return 'linear-gradient(135deg,#1b2648,#36406a)';
  if (w.storm || w.kind === 'storm') return 'linear-gradient(135deg,#4c5566,#6d7889)';
  if (w.snow > 0.05 || w.snowCover > 0.5) return 'linear-gradient(135deg,#7c9cc0,#b4c8de)';
  if (w.rain > 0.05) return 'linear-gradient(135deg,#55708f,#7f97b2)';
  if (w.fog > 0.4) return 'linear-gradient(135deg,#8892a0,#b1b8c2)';
  if (w.temp >= 28) return 'linear-gradient(135deg,#ef8a2c,#f6b54c)';
  if (w.cloud > 0.6) return 'linear-gradient(135deg,#6f8fb2,#9db4cc)';
  return 'linear-gradient(135deg,#3f8fd8,#7cc0ef)';
}

// ---------- Reiter „Wetter"
function renderWeather(ui) {
  const g = ui.g, w = g.ext.weather;
  if (!w || !w.season) return '<p>Kein Wetter.</p>';
  const night = ui.app.engine ? ui.app.engine.night || 0 : 0;
  const cal = calendar(g);
  const imp = weatherImpact(g) || {};
  const k = nowKind(w);
  const h = g.hour();
  const isNight = night > 0.5 || h < 5.5 || h > 21;
  let html = `<div class="wx-now" style="background:${nowGradient(w, night)}">
  ${wxIcon(k, 72, isNight)}
  <div><div class="t">${deg(w.temp)}</div><div class="l">${esc(w.label)}</div>
  <div class="m">${SEASON_INFO[w.season].name} · Tag ${w.seasonDay} von ${SEASON_DAYS} · Jahr ${w.year}</div></div>
</div>
<div class="wx-det">
  <div><div class="k">Wind</div><div class="v">${kmh(w.wind)} km/h</div><div class="k" style="text-transform:none;letter-spacing:0">aus ${compass(w.windDir)}</div></div>
  <div><div class="k">${w.snow > w.rain ? 'Schnee' : 'Regen'}</div><div class="v">${Math.round(Math.max(w.rain, w.snow) * 100)} %</div><div class="k" style="text-transform:none;letter-spacing:0">Boden ${w.wet > 0.6 ? 'nass' : w.wet > 0.2 ? 'feucht' : w.dry > 0.6 ? 'staubtrocken' : 'trocken'}</div></div>
  <div><div class="k">Schneedecke</div><div class="v">${Math.round(w.snowCover * 100)} %</div><div class="k" style="text-transform:none;letter-spacing:0">${w.snowCover > 0.15 ? (g.hasBuilt('snow_depot') ? 'Winterdienst fährt' : 'ungeräumt!') : '—'}</div></div>
  <div><div class="k">Wolken</div><div class="v">${Math.round(w.cloud * 100)} %</div><div class="k" style="text-transform:none;letter-spacing:0">${w.fog > 0.3 ? 'Nebel' : 'Sicht gut'}</div></div>
</div>`;
  // Jahreskreis
  html += `<div class="sec" style="margin-top:14px"><h3>Jahreszeiten</h3>
  <div class="wx-year">${SEASONS.map((s) => `<i style="background:${SEASON_INFO[s].color}"></i>`).join('')}<b style="left:${(cal.yearT * 100).toFixed(1)}%"></b></div>
  <div class="wx-yl">${SEASONS.map((s) => `<span>${SEASON_INFO[s].name}</span>`).join('')}</div>
  <p class="wx-note">Ein Jahr hat vier Jahreszeiten zu je ${SEASON_DAYS} Tagen. ${seasonHint(w.season)}</p></div>`;
  // Vorhersage
  const fcDays = forecastDays(g);
  const st = g.ext.disasters;
  const today = Math.floor(g.time / DAY);
  const haz = new Map();
  for (const p of st ? st.planned : []) if (p.known && !p.aftershock) haz.set(Math.floor(p.at / DAY), p);
  const fc = (w.forecast || []).slice(0, 7);
  html += `<div class="sec"><h3>Vorhersage${stationCount(g) ? ` · ${stationCount(g)} Wetterstation${stationCount(g) > 1 ? 'en' : ''}` : ''}</h3>
  <div class="wx-fc" style="grid-template-columns:repeat(${fc.length},1fr)">${fc.map((f, i) => {
    const known = i <= fcDays;
    const name = f.day === today ? 'Heute' : f.day === today + 1 ? 'Morgen' : WEEKDAYS[f.day % 7];
    const hz = haz.get(f.day);
    if (!known) return `<div class="d unk"><div class="n">${name}</div>${wxIcon('cloudy', 30)}<div class="hi">?</div><div class="lo">–</div></div>`;
    const blur = i >= 3 ? '~' : '';
    return `<div class="d${hz ? ' haz' : ''}" title="${esc(KINDS[f.kind]?.name || f.kind)}${hz ? ' – Warnung: ' + esc(hz.name) : ''}">${hz ? '<span class="hz">!</span>' : ''}<div class="n">${name}</div>${wxIcon(f.kind, 30)}<div class="hi">${blur}${deg(f.tMax)}</div><div class="lo">${deg(f.tMin)}</div><div class="pr"><i style="width:${Math.round(f.precip * 100)}%"></i></div></div>`;
  }).join('')}</div>
  ${stationCount(g) ? '' : `<p class="wx-note">Ohne Wetterstation gibt es nur den Wetterbericht für heute und morgen – und Unwetter kündigen sich erst kurz vorher an. Eine <b>Wetterstation</b> (Schutz) sagt fünf Tage voraus, zwei sagen sieben.</p>`}</div>`;
  // Wirkung
  const rows = [];
  const row = (k, v, cls = '', sub = '') => rows.push(`<div class="row"><span class="grow">${k}${sub ? `<br><span style="font-size:12px;color:var(--ink-3)">${sub}</span>` : ''}</span><span class="val ${cls}">${v}</span></div>`);
  if (imp.water !== undefined) row('Wasserverbrauch', pct(imp.water), imp.water > 0.05 ? 'neg' : imp.water < -0.02 ? 'pos' : '', imp.water > 0.05 ? 'Hitze und Trockenheit: Gärten, Duschen, Freibäder' : imp.water < 0 ? 'Kühles oder nasses Wetter' : '');
  if (imp.powerMul !== undefined) {
    const parts = [];
    if (imp.Ss) parts.push(`Solar ${Math.round(imp.fs * 100)} %`);
    if (imp.Sw) parts.push(`Wind ${Math.round(imp.fw * 100)} %`);
    if (imp.Sh) parts.push(`Wasserkraft ${Math.round(imp.fh * 100)} %`);
    if (imp.heatElec > 0.005) parts.push(`Heizen +${Math.round(imp.heatElec * 100)} %`);
    if (imp.cool > 0.005) parts.push(`Klimaanlagen +${Math.round(imp.cool * 100)} %`);
    row('Strombilanz', pct(imp.powerMul), imp.powerMul < -0.05 ? 'neg' : imp.powerMul > 0.02 ? 'pos' : '', parts.join(' · ') || 'Keine Wettereinflüsse');
  }
  if (w.heatNeed > 0.2) row('Fernwärme deckt', `${Math.round((imp.cover || 0) * 100)} %`, (imp.cover || 0) < 0.5 ? 'neg' : 'pos', (imp.cover || 0) < 0.9 ? 'Ohne Fernwärme heizen viele mit Strom. Heizkraftwerke helfen.' : 'Die Wohnungen sind warm.');
  if (imp.tour !== undefined) row('Touristen', `${imp.tour >= 0 ? '+' : '−'}${Math.abs(Math.round(imp.tour))} %`, imp.tour < 0 ? 'neg' : 'pos', imp.beach > 0 ? `Badewetter: +${Math.round(imp.beach)} Badegäste pro Tag` : '');
  if (imp.rid !== undefined && Math.abs(imp.rid) > 0.005) row('Pulsbahn-Fahrgäste', pct(imp.rid), '', imp.rid > 0 ? 'Bei Schmuddelwetter lassen viele das Auto stehen.' : 'Bei Sonne gehen viele zu Fuß oder fahren Rad.');
  if (imp.mood !== undefined && Math.abs(imp.mood) >= 0.5) row('Stimmung durch das Wetter', `${imp.mood >= 0 ? '+' : '−'}${Math.abs(imp.mood).toFixed(0)}`, imp.mood < 0 ? 'neg' : 'pos');
  const farms = [...g.buildings.values()].some((b) => b.spec === 'farm');
  if (farms) row('Bauernhöfe', { spring: 'Aussaat', summer: 'Wachstum +10 %', autumn: 'Ernte +25 %', winter: 'Winterruhe −40 %' }[w.season], w.season === 'winter' ? 'neg' : w.season === 'autumn' ? 'pos' : '', 'Saisonale Arbeitsplätze auf den Höfen');
  if (imp.frostBuild) row('Baustellen', '−35 %', 'neg', 'Frost und Schnee verlangsamen den Bau.');
  if (w.season === 'summer' || w.temp > 22) row('Freibäder', w.temp > 19 ? 'geöffnet' : 'zu kalt', '', g.hasBuilt('swimming_pool') || g.hasBuilt('beach') ? 'Badestellen kühlen und machen glücklich.' : 'Ein Freibad macht Hitzetage erträglich.');
  html += `<div class="sec"><h3>Wirkung auf die Stadt</h3>${rows.join('') || '<p class="wx-note">Das Wetter hat gerade keinen spürbaren Einfluss.</p>'}</div>`;
  if (g.sandbox) {
    const kinds = ['clear', 'fair', 'cloudy', 'rain', 'showers', 'thunder', 'storm', 'fog', 'snow', 'heat', 'frost'];
    html += `<div class="sec"><h3>Sandkasten: Wetter wählen</h3><div class="wx-grid">${kinds.map((k2) => `<button class="btn small ghost" data-act="wx-set" data-k="${k2}" title="${esc(KINDS[k2].name)}">${wxIcon(k2, 20)} ${esc(KINDS[k2].name)}</button>`).join('')}</div>
    <div class="wx-grid" style="margin-top:6px"><button class="btn small ghost" data-act="wx-set" data-k="snow" data-cover="1">Tiefer Schnee</button><button class="btn small ghost" data-act="wx-set" data-k="clear" data-cover="0">Schnee weg</button></div></div>`;
  }
  return html;
}
function seasonHint(s) {
  return {
    spring: 'Im Frühling ziehen Menschen gern um, Schauer und erste Gewitter kommen. Achtung: Schneeschmelze kann Hochwasser bringen.',
    summer: 'Sommer heißt Hitze, Touristen, hoher Wasserverbrauch und Gewitter mit Blitzeinschlägen. Trockene Wochen bringen Waldbrandgefahr.',
    autumn: 'Im Herbst wird geerntet, morgens liegt Nebel – und Herbststürme fegen über das Land.',
    winter: 'Im Winter steigt der Heizbedarf, die Sonne liefert wenig Solarstrom, Schnee legt Straßen lahm. Weihnachtsmärkte locken Besucher.',
  }[s];
}

// ---------- Reiter „Schutz"
function lvl(v) {
  if (v >= 0.66) return '<span class="wx-lvl" style="background:var(--bad)">hoch</span>';
  if (v >= 0.33) return '<span class="wx-lvl" style="background:var(--warn)">mittel</span>';
  return '<span class="wx-lvl" style="background:var(--good)">gering</span>';
}
function floodProneCount(g) {
  let n = 0, prot = 0;
  const P = protectedTiles(g);
  for (const b of g.buildings.values()) {
    const i = b.y * g.W + b.x;
    if (g.world.waterDist[i] <= 3) { if (P[i]) prot++; else n++; }
  }
  return [n, prot];
}
let protCache = { key: '', arr: null };
function protectedTiles(g) {
  let key = '';
  for (const b of g.buildings.values()) if (b.key === 'flood_barrier' && b.construct >= 1) key += b.id + ',';
  key += g.N;
  if (protCache.key === key && protCache.arr) return protCache.arr;
  const arr = new Uint8Array(g.N);
  for (const b of g.buildings.values()) {
    if (b.key !== 'flood_barrier' || b.construct < 1) continue;
    const r = BUILDINGS.flood_barrier.floodProtect || 6;
    for (let y = Math.max(0, b.y - r); y <= Math.min(g.H - 1, b.y + r); y++) for (let x = Math.max(0, b.x - r); x <= Math.min(g.W - 1, b.x + r); x++) if (Math.hypot(x - b.x, y - b.y) <= r) arr[y * g.W + x] = 1;
  }
  protCache = { key, arr };
  return arr;
}
function residentsCovered(g, fn) {
  let all = 0, cov = 0;
  for (const b of g.buildings.values()) {
    if (b.zone !== Z.RES || !b.occ) continue;
    all += b.occ;
    if (fn(b.y * g.W + b.x)) cov += b.occ;
  }
  return all ? cov / all : 0;
}
function risks(g) {
  const w = g.ext.weather || {}, s = w.season || 'summer';
  const pop = g.stats.pop;
  const [prone] = floodProneCount(g);
  let forestNear = 0;
  for (let i = 0; i < g.N; i += 2) if (g.world.trees[i] >= 2) forestNear++;
  return [
    ['flood', prone >= 3 ? Math.min(1, prone / 30) * ({ spring: 1, autumn: 0.85, summer: 0.4, winter: 0.4 }[s]) * (g.eff('floodShield') > 0 ? 0.5 : 1) : 0, prone ? `${prone} Gebäude in Ufernähe ohne Hochwasserschutz` : 'Keine gefährdeten Ufer'],
    ['storm', { spring: 0.3, summer: 0.2, autumn: 0.8, winter: 0.7 }[s], 'Herbst und Winter sind Sturmzeit'],
    ['tornado', pop >= DISASTERS.tornado.minPop ? { spring: 0.45, summer: 0.6, autumn: 0.15, winter: 0 }[s] : 0, pop >= DISASTERS.tornado.minPop ? 'Gewitterlagen im Frühling und Sommer' : `erst ab ${fmt(DISASTERS.tornado.minPop)} Einwohnern`],
    ['quake', pop >= DISASTERS.quake.minPop ? (g.world.type === 'mountains' ? 0.5 : 0.25) : 0, g.world.type === 'mountains' ? 'Im Bergland bebt die Erde öfter' : 'Selten, aber ohne Vorwarnung'],
    ['wildfire', forestNear > 12 ? clamp01((w.dry || 0) * (s === 'summer' ? 1.2 : 0.4) + (w.temp > 28 ? 0.2 : 0)) : 0, forestNear > 12 ? `Trockenheit ${Math.round((w.dry || 0) * 100)} %` : 'Kaum Wald'],
    ['meteor', pop >= DISASTERS.meteor.minPop ? 0.1 : 0, g.hasBuilt('observatory') ? 'Die Sternwarte beobachtet den Himmel' : 'Eine Sternwarte würde Tage vorher warnen'],
  ];
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function renderSafety(ui) {
  const g = ui.g, st = g.ext.disasters;
  if (!st) return '<p>Keine Daten.</p>';
  let html = '';
  // Warnungen
  const warns = st.planned.filter((p) => p.known && !p.aftershock);
  const act = st.active.filter((a) => !a.aftershock || a.stats?.damaged);
  if (warns.length || act.length || st.ops.length) {
    html += '<div class="sec"><h3>Warnungen & Einsätze</h3>';
    for (const p of warns) {
      const D = DISASTERS[p.type];
      const opts = prepOptions(p);
      html += `<div class="wx-card" style="border-color:${D.color}"><div class="hd"><div class="grow"><div class="ttl">⚠ ${esc(D.name)} · ${esc(etaText(g, p))}</div>
<div class="sub">${p.type === 'storm' ? 'Ganze Stadt betroffen' : p.type === 'tornado' ? 'Genauer Ort unbekannt' : `Bei Feld ${Math.floor(p.x)}, ${Math.floor(p.y)}`} · Stärke ${Math.round(p.intensity * 10)}/10${p.residents ? ` · ${fmt(p.residents)} Bewohner im Gefahrengebiet` : ''}</div></div>
${p.type !== 'storm' && p.type !== 'tornado' ? `<button class="btn small ghost" data-act="wx-focus" data-x="${p.x}" data-y="${p.y}">Zeigen</button>` : ''}</div>
<div class="wx-bar"><i style="width:${Math.round(p.intensity * 100)}%;background:${D.color}"></i></div>
<div class="acts">${opts.map((k) => p.prep[k] ? `<button class="btn small done" disabled>✓ ${esc(PREP[k].name)}</button>` : `<button class="btn small" data-act="wx-prep" data-id="${p.id}" data-k="${k}" title="${esc(PREP[k].desc)}">${esc(PREP[k].name)} · ${fmtMoney(prepCost(g, p, k))}</button>`).join('')}</div></div>`;
    }
    for (const a of act) {
      const D = DISASTERS[a.type];
      const prog = Math.min(1, (g.time - a.t0) / a.dur);
      const op = st.ops.find((o) => o.id === a.id);
      const extra = a.type === 'wildfire' ? `Brennende Waldfelder <b>${a.data.burning.length / 2}</b> · verbrannt <b>${a.stats.burned || 0}</b>` : a.type === 'flood' ? `Pegel ${Math.round(100 * Math.min(1, (g.time - a.t0) / 480))} % · überflutete Gebäude <b>${a.stats.flooded}</b>` : a.type === 'quake' ? `Stärke <b>${a.data.mag}</b>` : '';
      const opts = prepOptions(a).filter((k) => k !== 'evacuate' || a.type === 'wildfire');
      html += `<div class="wx-card" style="border-color:${D.color};background:#f7e7e2"><div class="hd"><div class="grow"><div class="ttl">● ${esc(D.name)} läuft${a.aftershock ? ' (Nachbeben)' : ''}</div><div class="sub">Zerstört <b>${a.stats.destroyed}</b> · beschädigt <b>${a.stats.damaged}</b>${op ? ` · verschüttet <b>${op.trapped}</b> · gerettet <b>${op.rescued}</b>` : ''}</div></div>
<button class="btn small ghost" data-act="wx-focus" data-x="${a.type === 'tornado' && a.data.x0 !== undefined ? '' : a.x}" data-y="${a.y}" data-id="${a.id}">Zeigen</button></div>
${extra ? `<div class="wx-stats">${extra}</div>` : ''}<div class="wx-bar"><i style="width:${Math.round(prog * 100)}%;background:${D.color}"></i></div>
${opts.some((k) => !a.prep[k]) ? `<div class="acts">${opts.filter((k) => !a.prep[k]).map((k) => `<button class="btn small" data-act="wx-prep" data-id="${a.id}" data-k="${k}" title="${esc(PREP[k].desc)}">${esc(PREP[k].name)} · ${fmtMoney(prepCost(g, a, k))}</button>`).join('')}</div>` : ''}</div>`;
    }
    for (const op of st.ops) {
      if (act.some((a) => a.id === op.id) || (!op.trapped && !op.injured)) continue;
      html += `<div class="wx-card" style="border-color:#2f8fe0"><div class="ttl">Rettungseinsatz nach ${esc(DISASTERS[op.type]?.name || op.type)}</div><div class="wx-stats">Verschüttet <b>${op.trapped}</b> · gerettet <b>${op.rescued}</b> · Verletzte in Behandlung <b>${op.injured}</b></div>
${g.hasBuilt('disaster_center') ? '' : '<p class="wx-note">Ein Katastrophenschutz in der Nähe rettet Verschüttete viel schneller.</p>'}</div>`;
    }
    html += '</div>';
  }
  // Wiederaufbau
  const reps = Object.entries(st.repairs);
  if (reps.length || st.rubble.length || st.ruins.length || st.displaced > 0) {
    let prog = 0;
    for (const [, r] of reps) prog += 1 - r.left / r.total;
    prog = reps.length ? prog / reps.length : 1;
    html += `<div class="sec"><h3>Wiederaufbau</h3>
<div class="row"><span class="grow">Beschädigte Gebäude in Reparatur</span><span class="val">${reps.length}</span></div>
${reps.length ? `<div class="wx-bar"><i style="width:${Math.round(prog * 100)}%;background:var(--good)"></i></div>` : ''}
<div class="row"><span class="grow">Trümmerfelder${g.hasBuilt('disaster_center') ? ' (werden geräumt)' : ''}</span><span class="val">${st.rubble.length}</span></div>
<div class="row"><span class="grow">Betroffene Bewohner<br><span style="font-size:12px;color:var(--ink-3)">davon in Notunterkünften: ${fmt(st.sheltered)} von ${fmt(st.shelterCap)} Plätzen</span></span><span class="val ${st.displaced > st.shelterCap ? 'neg' : ''}">${fmt(st.displaced)}</span></div>
${st.ruins.map((r, i) => `<div class="row"><span class="grow">Zerstört: <b>${esc(r.name)}</b><br><span style="font-size:12px;color:var(--ink-3)">Feld ${r.x}, ${r.y} · Tag ${r.day} · ${esc(DISASTERS[r.cause]?.name || (r.cause === 'fire' ? 'Brand' : ''))}</span></span><button class="btn small" data-act="wx-rebuild" data-i="${i}">Aufbauen · ${fmtMoney(rebuildCost(g, r))}</button></div>`).join('')}
${st.ruins.length > 1 ? `<button class="btn small ghost" data-act="wx-rebuild-all">Alle wiederaufbauen</button>` : ''}
<div class="toggle"><button class="switch${st.autoRebuild ? ' on' : ''}" data-act="wx-auto" aria-label="Automatischer Wiederaufbau"></button><div class="grow"><div class="t">Automatischer Wiederaufbau</div><div class="s">${g.hasBuilt('disaster_center') ? 'Der Katastrophenschutz baut zerstörte Dienstgebäude wieder auf, sobald die Trümmer weg sind (Eigenanteil 35 %).' : 'Die Versicherung baut zerstörte Dienstgebäude nach zwei Tagen wieder auf (Eigenanteil 50 %). Mit Katastrophenschutz geht es schneller und billiger.'}</div></div></div></div>`;
  }
  // Schutz-Bewertung
  const score = protectionScore(g);
  const nSt = stationCount(g);
  const nSi = countB(g, 'warning_siren');
  const sirenCov = residentsCovered(g, (i) => sirenAt(g, i) > 0);
  const dcCov = residentsCovered(g, (i) => (g.cov.disaster ? g.cov.disaster[i] : 0) > 0.2);
  const snowCov = residentsCovered(g, (i) => (g.cov.snow ? g.cov.snow[i] : 0) > 0.2);
  const [prone, prot] = floodProneCount(g);
  const need = Math.round(g.stats.pop * 0.12);
  const check = (ok, t, v, s) => `<div class="wx-check"><span class="i ${ok === true ? 'ok' : ok === 'mid' ? 'mid' : 'no'}">${ok === true ? '✓' : ok === 'mid' ? '◐' : '✗'}</span><span class="t">${t}</span><span class="v">${v}</span><span class="s">${s}</span></div>`;
  html += `<div class="sec"><h3>Katastrophenschutz</h3>
<div class="wx-score"><div class="big">${Math.round(score * 100)}</div><div class="grow"><div style="font-weight:700">${score > 0.7 ? 'Gut vorbereitet' : score > 0.4 ? 'Teilweise vorbereitet' : 'Kaum vorbereitet'}</div><div class="wx-bar" style="margin-top:4px"><i style="width:${Math.round(score * 100)}%;background:${score > 0.7 ? 'var(--good)' : score > 0.4 ? 'var(--warn)' : 'var(--bad)'}"></i></div><div class="wx-note" style="margin-top:4px">Gute Vorsorge mindert Schäden, Verletzte und die Sorgen der Bürger – und bringt mehr Katastrophenhilfe vom Land.</div></div></div>
${check(nSt > 0, 'Wetterstation', nSt ? `${nSt} · ${forecastDays(g)} Tage` : 'keine', nSt ? 'Unwetter, Fluten und Waldbrandgefahr werden Tage im Voraus gemeldet – Zeit für Sandsäcke und Evakuierung.' : 'Ohne Station kommen Warnungen erst kurz vorher.')}
${check(sirenCov > 0.8 ? true : sirenCov > 0.3 ? 'mid' : false, 'Warnsirenen', `${nSi} · ${Math.round(sirenCov * 100)} %`, 'Anteil der Bewohner in Hörweite. Gewarnte Menschen bringen sich in Sicherheit – viel weniger Verletzte und Verschüttete.')}
${check(st.shelterCap >= need && need > 0 ? true : st.shelterCap > 0 ? 'mid' : false, 'Notunterkünfte', `${fmt(st.shelterCap)} / ${fmt(need)} Plätze`, 'Empfohlen: Plätze für 12 % der Einwohner. Obdachlose ohne Platz ziehen weg und drücken auf die Stimmung.')}
${check(dcCov > 0.8 ? true : dcCov > 0.3 ? 'mid' : false, 'Katastrophenschutz', `${Math.round(dcCov * 100)} %`, 'Rettet Verschüttete, räumt Trümmer und repariert bis zu dreimal schneller. Ab „Stadt".')}
${check(prone === 0 ? true : prot > 0 ? 'mid' : false, 'Hochwasserschutz', prone ? `${prone} ungeschützt` : prot ? `${prot} geschützt` : 'kein Ufer', 'Deiche am Ufer schützen alle Felder im Umkreis von 6 Feldern vor Überflutung.')}
${check(snowCov > 0.8 ? true : snowCov > 0.3 ? 'mid' : false, 'Winterdienst', `${Math.round(snowCov * 100)} %`, 'Räumfahrzeuge halten im Winter die Straßen frei – sonst ärgern sich alle über Glätte.')}
</div>`;
  // Risiken
  html += `<div class="sec"><h3>Risiken jetzt</h3>${risks(g).map(([t, v, why]) => `<div class="row"><span class="grow"><b>${esc(DISASTERS[t].name)}</b><br><span style="font-size:12px;color:var(--ink-3)">${esc(why)}</span></span>${lvl(v)}</div>`).join('')}</div>`;
  // Chronik
  const hist = st.history.slice(-8).reverse();
  html += `<div class="sec"><h3>Chronik</h3>${hist.length ? `<div class="wx-hist">${hist.map((h) => `<span class="d">Tag ${h.day}</span><span><b>${esc(h.name)}</b>${h.aftershock ? ' (Nachbeben)' : ''} · ${h.destroyed} zerstört, ${h.damaged} beschädigt${h.burned ? `, ${h.burned} Waldfelder verbrannt` : ''}${h.rescued ? `, ${h.rescued} gerettet` : ''}${h.lost ? `, ${h.lost} vermisst` : ''} · ${fmtMoney(h.cost)}${h.warned ? '' : ' · ohne Vorwarnung'}</span>`).join('')}</div>
<p class="wx-note">Insgesamt: ${fmt(st.totals.destroyed)} Gebäude zerstört, ${fmt(st.totals.damaged)} beschädigt, ${fmt(st.totals.rescued)} Menschen gerettet${st.totals.aid ? `, ${fmtMoney(st.totals.aid)} Katastrophenhilfe erhalten` : ''}.</p>` : '<p class="wx-note">Bisher ist nichts Schlimmes passiert.</p>'}</div>`;
  // Einstellungen
  html += `<div class="sec"><h3>Einstellung: Katastrophen</h3><div class="seg">${FREQS.map((f) => `<button data-act="wx-freq" data-v="${f.id}" class="${st.freq === f.id ? 'on' : ''}">${f.name}</button>`).join('')}</div>
<p class="wx-note">${st.freq === 'off' ? 'Keine zufälligen Katastrophen. Wetter und Jahreszeiten laufen weiter, Blitze richten keinen Schaden an.' : 'Zufällige Katastrophen frühestens ab Tag 30 und 800 Einwohnern. Größere Unglücke erst in größeren Städten.'}</p></div>`;
  if (g.sandbox) {
    html += `<div class="sec"><h3>Sandkasten: Katastrophe auslösen</h3><div class="wx-grid">${Object.keys(DISASTERS).map((t) => `<button class="btn small ghost" data-act="wx-trigger" data-t="${t}" style="border-left:4px solid ${DISASTERS[t].color}">${esc(DISASTERS[t].name)}</button>`).join('')}</div><p class="wx-note">Trifft die Mitte des Bildschirms (Hochwasser: das nächste Ufer, Orkan: die ganze Stadt).</p></div>`;
  }
  return html;
}
function countB(g, key) { let n = 0; for (const b of g.buildings.values()) if (b.key === key && b.construct >= 1) n++; return n; }

registerPanel({
  id: 'weather',
  title: 'Wetter & Katastrophenschutz',
  order: 45,
  icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 17Z"/><path d="m12.5 13-2 3.5h3L11.5 20"/></svg>',
  render(ui) {
    injectCss();
    const g = ui.g, st = g.ext.disasters;
    const alarm = st && (st.planned.some((p) => p.known && !p.aftershock) || st.active.length > 0 || st.ruins.length > 0);
    const cur = tab || (alarm ? 'safety' : 'weather');
    return `<div class="wx-tabs"><button data-act="wx-tab" data-v="weather" class="${cur === 'weather' ? 'on' : ''}">Wetter</button><button data-act="wx-tab" data-v="safety" class="${cur === 'safety' ? 'on' : ''}">Schutz${alarm ? '<span class="dot"></span>' : ''}</button></div>${cur === 'weather' ? renderWeather(ui) : renderSafety(ui)}`;
  },
  click(ui, act, el) {
    const g = ui.g;
    const res = (r) => { if (r && r.ok === false && r.msg) ui.toast(r.msg, 'bad'); else if (r && r.ok) ui.app.audio && ui.app.audio.play && ui.app.audio.play('money'); };
    switch (act) {
      case 'wx-tab': tab = el.dataset.v; break;
      case 'wx-prep': res(doPrep(g, +el.dataset.id, el.dataset.k)); break;
      case 'wx-focus': {
        let x = parseFloat(el.dataset.x), y = parseFloat(el.dataset.y);
        if (Number.isNaN(x) && el.dataset.id) {
          const a = g.ext.disasters.active.find((q) => q.id === +el.dataset.id);
          if (a && a.data && a.data.x0 !== undefined) { const t = (g.time - a.t0) / a.dur; x = a.data.x0 + (a.data.x1 - a.data.x0) * t; y = a.data.y0 + (a.data.y1 - a.data.y0) * t; }
        }
        if (!Number.isNaN(x) && ui.app.engine) ui.app.engine.rig.focus(x - g.W / 2, y - g.H / 2, 34);
        break;
      }
      case 'wx-rebuild': { const r = rebuildRuin(g, +el.dataset.i); res(r); if (r.ok) ui.toast('Wiederaufbau begonnen.', 'good'); break; }
      case 'wx-rebuild-all': { const st = g.ext.disasters; let n = 0; for (let k = st.ruins.length - 1; k >= 0; k--) { const r = rebuildRuin(g, k); if (r.ok) n++; } ui.toast(n ? `${n} Gebäude werden wiederaufgebaut.` : 'Nicht genug Geld oder Platz.', n ? 'good' : 'bad'); break; }
      case 'wx-auto': g.ext.disasters.autoRebuild = !g.ext.disasters.autoRebuild; break;
      case 'wx-freq': g.ext.disasters.freq = el.dataset.v; ui.toast(`Katastrophen: ${FREQS.find((f) => f.id === el.dataset.v)?.name}`); break;
      case 'wx-set': setWeatherNow(g, el.dataset.k, el.dataset.cover !== undefined ? { snowCover: +el.dataset.cover } : {}); break;
      case 'wx-trigger': {
        const t = el.dataset.t;
        const tg = ui.app.engine ? ui.app.engine.rig.target : { x: 0, z: 0 };
        const x = tg.x + g.W / 2, y = tg.z + g.H / 2;
        const opts = t === 'flood' || t === 'storm' || t === 'wildfire' ? {} : { x, y, r: t === 'meteor' ? 2.5 : t === 'quake' ? 14 : 2 };
        if (t === 'wildfire') {
          // nächstes Waldfeld zur Bildschirmmitte
          let best = -1, bd = 1e9;
          for (let i = 0; i < g.N; i++) if (g.world.trees[i] >= 1) { const d = Math.hypot(i % g.W - x, Math.floor(i / g.W) - y); if (d < bd) { bd = d; best = i; } }
          if (best >= 0) Object.assign(opts, { x: best % g.W + 0.5, y: Math.floor(best / g.W) + 0.5, r: 5 });
        }
        if (t === 'flood') {
          let best = -1, bd = 1e9;
          for (let i = 0; i < g.N; i++) if (g.world.terrain[i] === T.WATER) { const d = Math.hypot(i % g.W - x, Math.floor(i / g.W) - y); if (d < bd) { bd = d; best = i; } }
          if (best >= 0) Object.assign(opts, { x: best % g.W + 0.5, y: Math.floor(best / g.W) + 0.5, r: 12 });
        }
        const a = triggerDisaster(g, t, { ...opts, intensity: 0.85 });
        if (!a) ui.toast('Hier nicht möglich.', 'bad');
        break;
      }
    }
  },
});

// ---------- Inspektor
const CAUSE = (t) => (DISASTERS[t] ? DISASTERS[t].name : t === 'fire' ? 'Feuer' : 'Unwetter');
INSPECTORS.push((ui, sel) => {
  const g = ui.g, st = g.ext.disasters;
  if (!st || !sel) return null;
  injectCss();
  const lines = [];
  let i = -1, b = null;
  if (sel.type === 'building') { b = g.buildings.get(sel.id); if (!b) return null; i = b.y * g.W + b.x; }
  else if (sel.type === 'tile') i = sel.i;
  else return null;
  if (b) {
    const rec = st.repairs[b.id];
    if (rec) {
      const cd = g.cov.disaster ? g.cov.disaster[i] : 0;
      const hrs = Math.max(1, Math.round(rec.left / (0.55 + 1.7 * cd)));
      lines.push(`<b style="color:var(--bad)">Beschädigt durch ${esc(CAUSE(rec.cause))}</b> · Reparatur ${Math.round((1 - rec.left / rec.total) * 100)} % · noch etwa ${hrs < 30 ? hrs + ' Std.' : Math.round(hrs / 24) + ' Tage'}${cd < 0.2 ? '<br>Ein Katastrophenschutz in der Nähe repariert dreimal schneller.' : ''}`);
    }
    const d = BUILDINGS[b.key];
    if (b.key === 'weather_station') lines.push(`Vorhersage: <b>${forecastDays(g)} Tage</b> · Unwetterwarnungen ${stationCount(g) >= 2 ? '7' : '5'} Tage im Voraus.`);
    if (b.key === 'warning_siren') lines.push(`Warnt alle im Umkreis von <b>${d.warnRadius} Feldern</b> – ${Math.round(residentsCovered(g, (k) => sirenAt(g, k) > 0) * 100)} % der Bewohner sind in Hörweite einer Sirene.`);
    if (b.key === 'shelter') lines.push(`Belegt: <b>${fmt(Math.min(st.sheltered, d.shelterCap))} / ${fmt(d.shelterCap)}</b> Plätze · stadtweit ${fmt(st.shelterCap)} Plätze.`);
    if (b.key === 'disaster_center') lines.push(`Einsätze: <b>${st.ops.length}</b> · Reparaturen: <b>${Object.keys(st.repairs).length}</b> · Trümmerfelder: <b>${st.rubble.length}</b> · gerettet bisher: <b>${fmt(st.totals.rescued)}</b>`);
    if (b.key === 'snow_depot') { const w = g.ext.weather || {}; lines.push(`${w.snowCover > 0.18 ? `<b>Räumfahrzeuge unterwegs</b> · Schneedecke ${Math.round(w.snowCover * 100)} %` : 'Bereit für den nächsten Schnee.'}`); }
    if (b.key === 'flood_barrier') lines.push(`Schützt alle Felder im Umkreis von <b>${d.floodProtect}</b> vor Hochwasser.`);
  }
  if (i >= 0) {
    const chips = [];
    if (g.world.waterDist[i] <= 3 && g.world.terrain[i] !== T.WATER) chips.push(protectedTiles(g)[i] ? '<span class="chip ok">Hochwasser: geschützt</span>' : '<span class="chip no">Hochwassergefahr</span>');
    if (sirenAt(g, i) > 0) chips.push('<span class="chip ok">Sirene</span>');
    if (g.cov.disaster && g.cov.disaster[i] > 0.2) chips.push('<span class="chip ok">Katastrophenschutz</span>');
    const w = g.ext.weather || {};
    if (w.snowCover > 0.15) chips.push(g.cov.snow && g.cov.snow[i] > 0.2 ? '<span class="chip ok">Geräumt</span>' : '<span class="chip no">Ungeräumt</span>');
    if (chips.length) lines.push(`<div class="chips" style="margin:0">${chips.join('')}</div>`);
  }
  return lines.length ? `<div class="wx-insp">${lines.join('<br>')}</div>` : null;
});

// ---------- Infoansichten
const ovIcon = (path) => `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
registerOverlay({
  id: 'floodrisk', name: 'Hochwassergefahr', bad: true,
  icon: ovIcon('<path d="M3 16c2 0 2-1.5 4.5-1.5S10 16 12 16s2-1.5 4.5-1.5S19 16 21 16M3 20c2 0 2-1.5 4.5-1.5S10 20 12 20s2-1.5 4.5-1.5S19 20 21 20"/><path d="M12 3v8M9 8l3 3 3-3"/>'),
  text: 'Rot: Ufer, die bei Hochwasser überflutet werden können. Ein Hochwasserschutz sichert den Umkreis von 6 Feldern.',
  field(g) {
    const f = new Float32Array(g.N);
    const P = protectedTiles(g);
    for (let i = 0; i < g.N; i++) {
      const d = g.world.waterDist[i];
      if (g.world.terrain[i] === T.WATER || d > 6) continue;
      f[i] = P[i] ? 0.15 : Math.max(0, 1 - (d - 1) / 6);
    }
    return f;
  },
});
registerOverlay({
  id: 'safety', name: 'Katastrophenschutz',
  icon: ovIcon('<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z"/><path d="M12 8v5M12 16h.01"/>'),
  text: 'Wie gut jedes Feld geschützt ist: Sirenen warnen, der Katastrophenschutz rettet und repariert.',
  field(g) {
    const f = new Float32Array(g.N);
    const cd = g.cov.disaster;
    for (let i = 0; i < g.N; i++) f[i] = Math.min(1, (sirenAt(g, i) > 0 ? 0.45 : 0) + (cd ? cd[i] * 0.6 : 0));
    return f;
  },
});
registerOverlay({
  id: 'snowcov', name: 'Winterdienst',
  icon: ovIcon('<path d="M12 2v20M4.9 6l14.2 12M19.1 6 4.9 18"/><path d="M9 3.5 12 6l3-2.5M9 20.5l3-2.5 3 2.5"/>'),
  text: 'Grün: Straßen, die der Winterdienst bei Schnee räumt.',
  field: (g) => g.cov.snow || new Float32Array(g.N),
});

// ---------- Hauptmenü: Katastrophen für neue Städte
MENU_SECTIONS.push({
  render(menu) {
    const o = menu.opts;
    const v = o.disasters || (o.difficulty === 'sandbox' ? 'off' : o.difficulty === 'relaxed' ? 'rare' : 'normal');
    return `<div class="card"><h3>Wetter & Katastrophen</h3><div class="field"><label>Katastrophen</label><div class="seg">${FREQS.map((f) => `<button data-act="wx-mfreq" data-v="${f.id}" class="${v === f.id ? 'on' : ''}">${f.name}</button>`).join('')}</div><div class="seg-hint">${v === 'off' ? 'Nur Wetter und Jahreszeiten – keine Unglücke.' : 'Hochwasser, Stürme, Tornados, Erdbeben, Blitze, Waldbrände und Meteoriten – mit Vorwarnung und Wiederaufbau. Jederzeit im Panel „Wetter" änderbar.'}</div></div></div>`;
  },
  click(menu, act, el) {
    if (act !== 'wx-mfreq') return false;
    menu.opts.disasters = el.dataset.v;
    menu.render();
    return true;
  },
});
