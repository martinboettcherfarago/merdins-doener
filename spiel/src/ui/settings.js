// Einstellungen (Vertrag 6.7): Grafik, Klang, Bedienung, Spielstand, Hilfe – im Spiel als Panel, im Menü als Fenster.
// app.settings: quality 'auto'|'low'|'medium'|'high'|'ultra' (Standard „Automatisch": Gerät einschätzen und laufend
// nachregeln, siehe render/autoquality.js; postfx/ao/bloom/shadows wirken dann als Obergrenze), qualityChosen (Stufe
// bewusst gewählt), postfx, ao, bloom, shadows 'off'|'low'|'high', alwaysDay,
// volume, music, sfx, muted, tutorialDone – dazu Oberflächen-Werte uiScale, minimap, advisor, tooltips,
// confirmPlace 'auto'|'always'|'never' (Bauen bestätigen, ausgewertet von TOUCH in src/input/**),
// dayLength 'normal'|'long'|'xlong' (Tageslänge: Spielminuten je Sekunde, gilt sofort; der Metro-Modus behält den Grundtakt).
// Grafikwerte liest die Engine beim Start; geänderte Werte werden mit „Übernehmen" (Neustart der Ansicht) wirksam.
import { fmt } from '../util.js';
import { icon } from './icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const PRESETS = {
  auto: { postfx: true, ao: true, bloom: true, shadows: 'high' },
  low: { postfx: false, ao: false, bloom: false, shadows: 'off' },
  medium: { postfx: true, ao: true, bloom: true, shadows: 'low' },
  high: { postfx: true, ao: true, bloom: true, shadows: 'high' },
  ultra: { postfx: true, ao: true, bloom: true, shadows: 'high' },
};
export const QUALITY = [
  ['auto', 'Automatisch', 'Passt sich deinem Gerät an und hält das Bild flüssig.'],
  ['low', 'Niedrig', 'Für ältere Geräte, schont den Akku.'],
  ['medium', 'Mittel', 'Für die meisten Geräte.'],
  ['high', 'Hoch', 'Für starke Grafikkarten.'],
  ['ultra', 'Ultra', 'Alles auf Maximum.'],
];
export const GFX_KEYS = ['quality', 'postfx', 'ao', 'bloom', 'shadows'];
const UI_SCALES = [[0.9, '90 %'], [1, '100 %'], [1.1, '110 %'], [1.25, '125 %']];
export const CONFIRM_PLACE = [
  ['auto', 'Bei Touch', 'Touch: Vorschau, dann ✓ · Maus: sofort.'],
  ['always', 'Immer', 'Immer erst Vorschau, dann ✓.'],
  ['never', 'Nie', 'Baut sofort.'],
];

// Tageslänge: [id, Name, Spielminuten je Sekunde, Dauer eines Spieltags bei ×1]
export const DAY_LENGTHS = [
  ['normal', 'Normal', 48, '30 Sekunden'],
  ['long', 'Lang', 24, 'eine Minute'],
  ['xlong', 'Sehr lang', 16, 'anderthalb Minuten'],
];
const dayLen = (s) => DAY_LENGTHS.find((x) => x[0] === (s && s.dayLength)) || DAY_LENGTHS[1];
export const dayLengthText = (s) => dayLen(s)[3];
// Takt der laufenden Stadt setzen (im Metro-Modus fester Grundtakt, damit Tageskarte und Bestenliste vergleichbar bleiben)
export function applyDayLength(app) {
  const g = app && app.game;
  if (!g) return;
  const metro = !!(g.opts && g.opts.scenario === 'metro');
  g.minPerSec = metro ? DAY_LENGTHS[0][2] : dayLen(app.settings)[2];
}

// Fehlende Werte ergänzen (ältere Einstellungen) – vor dem Start der ersten Engine aufrufen.
export function ensureSettings(s) {
  if (!PRESETS[s.quality]) s.quality = 'auto';
  const p = PRESETS[s.quality];
  for (const k of ['postfx', 'ao', 'bloom', 'shadows']) if (s[k] === undefined) s[k] = p[k];
  // ältere Standardwerte (main.js) speichern Schatten als true/false
  if (typeof s.shadows === 'boolean') s.shadows = s.shadows ? p.shadows : 'off';
  if (s.uiScale === undefined) s.uiScale = 1;
  if (s.ambience === undefined) s.ambience = 1;
  if (s.minimap === undefined) s.minimap = true;
  if (s.minimapOpen === undefined) s.minimapOpen = false; // Runde 3: Minikarte startet eingeklappt (Taste K)
  if (s.advisor === undefined) s.advisor = true;
  if (s.tooltips === undefined) s.tooltips = true;
  // Runde 3b (TOUCH): Bauen bestätigen – 'auto' = bei Touch/Stift mit Vorschau und ✓, mit der Maus sofort; 'always'; 'never'
  if (!['auto', 'always', 'never'].includes(s.confirmPlace)) s.confirmPlace = 'auto';
  // Tageslänge: Standard „Lang" (ein Spieltag bei ×1 dauert eine Minute)
  if (!DAY_LENGTHS.some((x) => x[0] === s.dayLength)) s.dayLength = 'long';
  return s;
}
export const gfxSnapshot = (s) => Object.fromEntries(GFX_KEYS.map((k) => [k, s[k]]));
export const gfxChanged = (s, snap) => !!snap && GFX_KEYS.some((k) => s[k] !== snap[k]);

export function applyUiScale(s) {
  const v = Math.max(0.8, Math.min(1.4, +s.uiScale || 1));
  document.documentElement.style.setProperty('--ui', String(v));
}

const seg = (act, cur, opts) => `<div class="seg">${opts.map(([v, n]) => `<button data-act="${act}" data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${n}</button>`).join('')}</div>`;
const sw = (act, on, title, sub, disabled = false) => `<div class="toggle${disabled ? ' locked' : ''}"><button class="switch${on ? ' on' : ''}" data-act="${act}" aria-label="${esc(title)}" ${disabled ? 'disabled' : ''}></button><div class="grow"><div class="t">${title}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div></div>`;
const slider = (key, label, v) => `<div class="slider"><label for="set-${key}">${label}</label><input type="range" min="0" max="1" step="0.05" value="${v}" data-set="${key}" id="set-${key}"><span class="val num">${Math.round(v * 100)}</span></div>`;

// ctx: { app, inGame, ui?, tab, snap }
export function settingsHTML(ctx) {
  const s = ctx.app.settings;
  const tabs = [['grafik', 'Grafik', 'sun'], ['klang', 'Klang', 'sound'], ['bedienung', 'Bedienung', 'select'], ...(ctx.inGame ? [['spiel', 'Spielstand', 'save']] : []), ['hilfe', 'Hilfe', 'help']];
  const tab = tabs.find((t) => t[0] === ctx.tab) ? ctx.tab : 'grafik';
  let body = '';
  if (tab === 'grafik') {
    const q = QUALITY.find((x) => x[0] === s.quality) || QUALITY[0];
    const pending = gfxChanged(s, ctx.snap);
    // Die Engine übernimmt Grafikwerte sofort (G1, prüft alle 0,5 s); ältere Engines brauchen einen Neustart der Ansicht
    const eng = ctx.app.engine;
    const live = !!(eng && typeof eng.applyQuality === 'function');
    const caps = eng && eng.caps ? eng.caps : { shadows: true, postfx: true, ao: true, bloom: true };
    const noPost = eng && eng.canPost === false;
    const autoNow = s.quality === 'auto' && eng && typeof eng.autoStatus === 'function' ? eng.autoStatus() : '';
    body = `
<div class="sec"><h3>Qualitätsstufe</h3>${seg('quality', s.quality, QUALITY.map((x) => [x[0], x[1]]))}<p class="hint">${esc(q[2])}${autoNow ? `<br>${esc(autoNow)}` : ''}</p>${s.quality === 'auto' ? '<p class="hint">Schatten und Effekte unten gelten als Obergrenze.</p>' : ''}</div>
${caps.shadows ? `<div class="sec"><h3>Schatten</h3>${seg('shadows', s.shadows, [['off', 'Aus'], ['low', 'Weich'], ['high', 'Fein']])}</div>` : ''}
${caps.postfx || caps.ao || caps.bloom ? `<div class="sec"><h3>Effekte</h3>
  ${caps.postfx ? sw('postfx', s.postfx && !noPost, 'Nachbearbeitung', noPost ? 'Nicht möglich (WebGL 2 fehlt).' : '', noPost) : ''}
  ${caps.ao ? sw('ao', s.ao && s.postfx && !noPost, 'Umgebungsverdeckung', '', !s.postfx || noPost) : ''}
  ${caps.bloom ? sw('bloom', s.bloom && s.postfx && !noPost, 'Leuchten bei Nacht', '', !s.postfx || noPost) : ''}
</div>` : ''}
<div class="sec"><h3>Darstellung</h3>
  ${sw('alwaysDay', s.alwaysDay, 'Immer Tag', '')}
  ${ctx.inGame ? sw('icons', ctx.app.engine && ctx.app.engine.effects ? ctx.app.engine.effects.showIcons : true, 'Problem-Symbole (I)', '') : ''}
</div>
${live ? `<div class="apply">${icon('check', 16)}<span>Gilt sofort.</span></div>` : `<div class="apply${pending ? ' pending' : ''}">${pending ? `${icon('info', 16)}<span>Gilt nach Neustart der Ansicht.</span>` : `${icon('check', 16)}<span>Aktuell.</span>`}<button class="btn small" data-act="applygfx" ${pending ? '' : 'disabled'}>${ctx.inGame ? 'Ansicht neu starten' : 'Übernehmen'}</button></div>`}`;
  } else if (tab === 'klang') {
    body = `<div class="sec"><h3>Lautstärke</h3>${slider('volume', 'Gesamt', s.volume)}${slider('music', 'Musik', s.music)}${slider('sfx', 'Effekte', s.sfx)}${slider('ambience', 'Umgebung', s.ambience ?? 1)}</div>
<div class="sec">${sw('mute', !s.muted, 'Ton an (M)', '')}</div>`;
  } else if (tab === 'bedienung') {
    const cp = CONFIRM_PLACE.find((x) => x[0] === s.confirmPlace) || CONFIRM_PLACE[0];
    body = `<div class="sec"><h3>Größe der Oberfläche</h3>${seg('uiScale', s.uiScale, UI_SCALES)}</div>
<div class="sec"><h3>Tageslänge</h3>${seg('dayLength', s.dayLength, DAY_LENGTHS.map((x) => [x[0], x[1]]))}<p class="hint">1 Tag = ${esc(dayLengthText(s))}${ctx.app.game && ctx.app.game.opts && ctx.app.game.opts.scenario === 'metro' ? ' (Metro-Modus: immer normal)' : ''}</p></div>
<div class="sec" data-tour="confirmplace"><h3>Bauen bestätigen</h3>${seg('confirmPlace', s.confirmPlace, CONFIRM_PLACE.map((x) => [x[0], x[1]]))}<p class="hint">${esc(cp[2])}</p></div>
<div class="sec"><h3>Hilfen</h3>
  ${sw('minimap', s.minimapOpen, 'Minikarte (K)', '')}
  ${sw('advisor', s.advisor, 'Nächstes Ziel', '')}
  ${sw('tooltips', s.tooltips, 'Tooltips', '')}
  ${sw('tutorial', !s.tutorialDone, 'Einführung', '')}
</div>`;
  } else if (tab === 'spiel') {
    const slots = [1, 2, 3].map((k) => {
      const meta = ctx.app.slotMeta(k);
      return `<div class="slot"><div class="grow"><div class="t">Platz ${k}${meta ? ': ' + esc(meta.name) : ''}</div><div class="s">${meta ? `${fmt(meta.pop)} Einwohner · ${new Date(meta.savedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}` : 'leer'}</div></div><button class="btn small" data-act="save" data-k="${k}">Speichern</button>${meta ? `<button class="btn small ghost" data-act="load" data-k="${k}">Laden</button>` : ''}</div>`;
    }).join('');
    body = `<div class="sec"><h3>Spielstände</h3>${slots}
  <div class="acts">${window.STADTPULS_EMBED ? '' : '<button class="btn small ghost" data-act="export">Als Datei</button>'}<button class="btn small ghost" data-act="copy">In Zwischenablage</button></div>
  <p class="hint">Auto-Speichern jeden Tag · Strg+S</p></div>
${ctx.extraPanels && ctx.extraPanels.length ? `<div class="sec"><h3>Weitere Einstellungen</h3><div class="acts">${ctx.extraPanels.map(([id, n]) => `<button class="btn small ghost" data-act="openpanel" data-v="${esc(id)}">${esc(n)}</button>`).join('')}</div></div>` : ''}
<div class="sec"><button class="btn ghost" data-act="tomenu">${icon('menu', 16)} Zum Hauptmenü</button></div>`;
  } else {
    body = `<div class="sec help"><h3>Kurz gesagt</h3><ul>
  <li>Zonen brauchen eine Straße mit Autobahn-Anschluss.</li>
  <li>Strom und Wasser fließen über Straßen.</li>
  <li>Häuser wachsen mit Bodenwert, Bildung und Glück.</li>
  <li>Symbole über Häusern zeigen Probleme.</li>
  <li>Stadt-Check oben rechts: was gerade hakt.</li></ul></div>
<div class="sec"><button class="btn ghost" data-act="keys">${icon('keyboard', 16)} Tastenkürzel</button></div>`;
  }
  return `<div class="tabs">${tabs.map(([id, n, ic]) => `<button data-act="settab" data-v="${id}" class="${id === tab ? 'on' : ''}">${icon(ic, 15)}<span>${n}</span></button>`).join('')}</div><div class="tabbody">${body}</div>`;
}

// Gemeinsame Klick-Logik. Rückgabe: true = neu zeichnen
export function settingsClick(ctx, act, el) {
  const app = ctx.app, s = app.settings;
  const save = () => app.saveSettings();
  switch (act) {
    case 'settab': ctx.tab = el.dataset.v; return true;
    case 'quality': if (PRESETS[el.dataset.v]) { s.quality = el.dataset.v; s.qualityChosen = true; Object.assign(s, PRESETS[s.quality]); save(); } return true;
    case 'shadows': s.shadows = el.dataset.v; save(); return true;
    case 'postfx': s.postfx = !s.postfx; save(); return true;
    case 'ao': if (s.postfx) { s.ao = !s.ao; save(); } return true;
    case 'bloom': if (s.postfx) { s.bloom = !s.bloom; save(); } return true;
    case 'alwaysDay': s.alwaysDay = !s.alwaysDay; save(); return true;
    case 'icons': if (app.engine && app.engine.effects) app.engine.effects.showIcons = !app.engine.effects.showIcons; return true;
    case 'mute': s.muted = !s.muted; app.audio && app.audio.applyVolumes(); save(); return true;
    case 'uiScale': s.uiScale = +el.dataset.v; applyUiScale(s); save(); return true;
    case 'dayLength': if (DAY_LENGTHS.some((x) => x[0] === el.dataset.v)) { s.dayLength = el.dataset.v; save(); applyDayLength(app); if (ctx.ui && ctx.ui.refreshDayText) ctx.ui.refreshDayText(); } return true;
    case 'confirmPlace': if (CONFIRM_PLACE.some((x) => x[0] === el.dataset.v)) { s.confirmPlace = el.dataset.v; save(); } return true;
    case 'minimap': s.minimapOpen = !s.minimapOpen; save(); if (ctx.ui && ctx.ui.toggleMinimap) ctx.ui.toggleMinimap(s.minimapOpen, true); return true;
    case 'advisor': s.advisor = !s.advisor; save(); return true;
    case 'tooltips': s.tooltips = !s.tooltips; save(); ctx.onTips && ctx.onTips(s.tooltips); return true;
    case 'tutorial': s.tutorialDone = !s.tutorialDone; save(); if (ctx.ui) { ctx.ui.tutorialHidden = s.tutorialDone; if (!s.tutorialDone && ctx.ui.onboarding && typeof ctx.ui.onboarding.start === 'function') { try { ctx.ui.onboarding.start(); } catch (e) { console.warn('Einführung', e); } } ctx.ui.refreshTutorial(); } return true;
    default: return false;
  }
}

export function settingsInput(ctx, el) {
  if (el.dataset.set && el.type === 'range') {
    ctx.app.settings[el.dataset.set] = +el.value;
    const v = el.nextElementSibling; if (v) v.textContent = Math.round(el.value * 100);
    ctx.app.audio && ctx.app.audio.applyVolumes();
  }
}
export function settingsChange(ctx, el) {
  if (el.dataset.set) ctx.app.saveSettings();
}
