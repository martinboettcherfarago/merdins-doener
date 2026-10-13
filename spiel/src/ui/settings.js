// Einstellungen (Vertrag 6.7): Grafik, Klang, Bedienung, Spielstand, Hilfe – im Spiel als Panel, im Menü als Fenster.
// app.settings: quality 'low'|'medium'|'high'|'ultra', postfx, ao, bloom, shadows 'off'|'low'|'high', alwaysDay,
// volume, music, sfx, muted, tutorialDone – dazu Oberflächen-Werte uiScale, minimap, advisor, tooltips.
// Grafikwerte liest die Engine beim Start; geänderte Werte werden mit „Übernehmen" (Neustart der Ansicht) wirksam.
import { fmt } from '../util.js';
import { icon } from './icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const PRESETS = {
  low: { postfx: false, ao: false, bloom: false, shadows: 'off' },
  medium: { postfx: true, ao: true, bloom: true, shadows: 'low' },
  high: { postfx: true, ao: true, bloom: true, shadows: 'high' },
  ultra: { postfx: true, ao: true, bloom: true, shadows: 'high' },
};
export const QUALITY = [
  ['low', 'Niedrig', 'Ohne Schatten und Nachbearbeitung – für ältere Geräte und lange Akkulaufzeit.'],
  ['medium', 'Mittel', 'Weiche Schatten, Umgebungsverdeckung und Leuchten bei Nacht. Gut für die meisten Geräte.'],
  ['high', 'Hoch', 'Feine Schatten und volle Auflösung – für starke Grafikkarten.'],
  ['ultra', 'Ultra', 'Alles auf Maximum, stärkste Kantenglättung – für sehr starke Grafikkarten.'],
];
export const GFX_KEYS = ['quality', 'postfx', 'ao', 'bloom', 'shadows'];
const UI_SCALES = [[0.9, '90 %'], [1, '100 %'], [1.1, '110 %'], [1.25, '125 %']];

// Fehlende Werte ergänzen (ältere Einstellungen) – vor dem Start der ersten Engine aufrufen.
export function ensureSettings(s) {
  if (!PRESETS[s.quality]) s.quality = 'medium';
  const p = PRESETS[s.quality];
  for (const k of ['postfx', 'ao', 'bloom', 'shadows']) if (s[k] === undefined) s[k] = p[k];
  // ältere Standardwerte (main.js) speichern Schatten als true/false
  if (typeof s.shadows === 'boolean') s.shadows = s.shadows ? p.shadows : 'off';
  if (s.uiScale === undefined) s.uiScale = 1;
  if (s.ambience === undefined) s.ambience = 1;
  if (s.minimap === undefined) s.minimap = true;
  if (s.advisor === undefined) s.advisor = true;
  if (s.tooltips === undefined) s.tooltips = true;
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
    const q = QUALITY.find((x) => x[0] === s.quality) || QUALITY[1];
    const pending = gfxChanged(s, ctx.snap);
    // Die Engine übernimmt Grafikwerte sofort (G1, prüft alle 0,5 s); ältere Engines brauchen einen Neustart der Ansicht
    const eng = ctx.app.engine;
    const live = !!(eng && typeof eng.applyQuality === 'function');
    const caps = eng && eng.caps ? eng.caps : { shadows: true, postfx: true, ao: true, bloom: true };
    const noPost = eng && eng.canPost === false;
    body = `
<div class="sec"><h3>Qualitätsstufe</h3>${seg('quality', s.quality, QUALITY.map((x) => [x[0], x[1]]))}<p class="hint">${esc(q[2])}</p></div>
${caps.shadows ? `<div class="sec"><h3>Schatten</h3>${seg('shadows', s.shadows, [['off', 'Aus'], ['low', 'Weich'], ['high', 'Fein']])}</div>` : ''}
${caps.postfx || caps.ao || caps.bloom ? `<div class="sec"><h3>Effekte</h3>
  ${caps.postfx ? sw('postfx', s.postfx && !noPost, 'Nachbearbeitung', noPost ? 'Dieser Browser unterstützt keine Nachbearbeitung (WebGL 2 fehlt).' : 'Farbkorrektur, Kantenglättung und Licht-Effekte.', noPost) : ''}
  ${caps.ao ? sw('ao', s.ao && s.postfx && !noPost, 'Umgebungsverdeckung', 'Weiche Schatten in Ecken und Fugen – kostet Leistung.', !s.postfx || noPost) : ''}
  ${caps.bloom ? sw('bloom', s.bloom && s.postfx && !noPost, 'Leuchten (Bloom)', 'Fenster, Laternen und Neon strahlen bei Nacht.', !s.postfx || noPost) : ''}
</div>` : ''}
<div class="sec"><h3>Darstellung</h3>
  ${sw('alwaysDay', s.alwaysDay, 'Immer Tag', 'Schaltet den Tag-Nacht-Wechsel ab.')}
  ${ctx.inGame ? sw('icons', ctx.app.engine && ctx.app.engine.effects ? ctx.app.engine.effects.showIcons : true, 'Problem-Symbole', 'Blitz, Tropfen, Müll und Co. über Gebäuden (Taste I). Eine gestapelte Nadel bündelt mehrere Probleme in der Nähe – näher heranzoomen.') : ''}
</div>
${live ? `<div class="apply">${icon('check', 16)}<span>Änderungen gelten sofort.</span></div>` : `<div class="apply${pending ? ' pending' : ''}">${pending ? `${icon('info', 16)}<span>Geänderte Grafikwerte gelten nach einem Neustart der Ansicht.</span>` : `${icon('check', 16)}<span>Die Ansicht entspricht diesen Einstellungen.</span>`}<button class="btn small" data-act="applygfx" ${pending ? '' : 'disabled'}>${ctx.inGame ? 'Ansicht neu starten' : 'Übernehmen'}</button></div>`}`;
  } else if (tab === 'klang') {
    body = `<div class="sec"><h3>Lautstärke</h3>${slider('volume', 'Gesamt', s.volume)}${slider('music', 'Musik', s.music)}${slider('sfx', 'Effekte', s.sfx)}${slider('ambience', 'Umgebung', s.ambience ?? 1)}</div>
<div class="sec">${sw('mute', !s.muted, 'Ton an', 'Taste M schaltet stumm.')}</div>`;
  } else if (tab === 'bedienung') {
    body = `<div class="sec"><h3>Größe der Oberfläche</h3>${seg('uiScale', s.uiScale, UI_SCALES)}</div>
<div class="sec"><h3>Hilfen</h3>
  ${sw('minimap', s.minimap, 'Minikarte', 'Übersichtskarte unten links (Taste K).')}
  ${sw('advisor', s.advisor, 'Ratgeber-Hinweise', 'Die Stadtplanerin meldet sich, wenn etwas fehlt.')}
  ${sw('tooltips', s.tooltips, 'Tooltips', 'Erklärungen beim Überfahren von Knöpfen.')}
  ${sw('tutorial', !s.tutorialDone, 'Erste Schritte', 'Die Checkliste für den Einstieg anzeigen.')}
</div>`;
  } else if (tab === 'spiel') {
    const slots = [1, 2, 3].map((k) => {
      const meta = ctx.app.slotMeta(k);
      return `<div class="slot"><div class="grow"><div class="t">Platz ${k}${meta ? ': ' + esc(meta.name) : ''}</div><div class="s">${meta ? `${fmt(meta.pop)} Einwohner · ${new Date(meta.savedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}` : 'leer'}</div></div><button class="btn small" data-act="save" data-k="${k}">Speichern</button>${meta ? `<button class="btn small ghost" data-act="load" data-k="${k}">Laden</button>` : ''}</div>`;
    }).join('');
    body = `<div class="sec"><h3>Spielstände</h3>${slots}
  <div class="acts">${window.STADTPULS_EMBED ? '' : '<button class="btn small ghost" data-act="export">Als Datei exportieren</button>'}<button class="btn small ghost" data-act="copy">In Zwischenablage</button></div>
  <p class="hint">Automatisch gespeichert wird jeden Spieltag. Schnellspeichern mit Strg+S.</p></div>
${ctx.extraPanels && ctx.extraPanels.length ? `<div class="sec"><h3>Weitere Einstellungen</h3><div class="acts">${ctx.extraPanels.map(([id, n]) => `<button class="btn small ghost" data-act="openpanel" data-v="${esc(id)}">${esc(n)}</button>`).join('')}</div></div>` : ''}
<div class="sec"><button class="btn ghost" data-act="tomenu">${icon('menu', 16)} Zum Hauptmenü</button></div>`;
  } else {
    body = `<div class="sec help"><h3>So wächst deine Stadt</h3><ul>
  <li>Zonen brauchen eine Straße höchstens zwei Felder entfernt, die mit der Autobahn verbunden ist.</li>
  <li>Strom und Wasser fließen durch das Straßennetz. Ein getrenntes Straßennetz braucht eigene Kraftwerke.</li>
  <li>Gebäude steigen auf, wenn Bodenwert, Bildung und Glück stimmen. Höhere Stufen werden mit Meilensteinen frei.</li>
  <li>Die Nachfrage-Balken (W G I B) zeigen, was die Stadt gerade braucht.</li>
  <li>Jeden Montag wählst du eine von drei Wochenkarten. Gelegentlich musst du über Ereignisse entscheiden.</li>
  <li>Symbole über Gebäuden zeigen Probleme (fehlender Strom, Wasser, Müll …). Eine gestapelte Nadel heißt: mehrere Probleme in diesem Viertel – näher heranzoomen.</li>
  <li>Die Ratgeberin (oben rechts) sagt dir, wo es gerade hakt.</li></ul></div>
<div class="sec"><button class="btn ghost" data-act="keys">${icon('keyboard', 16)} Alle Tastenkürzel</button></div>`;
  }
  return `<div class="tabs">${tabs.map(([id, n, ic]) => `<button data-act="settab" data-v="${id}" class="${id === tab ? 'on' : ''}">${icon(ic, 15)}<span>${n}</span></button>`).join('')}</div><div class="tabbody">${body}</div>`;
}

// Gemeinsame Klick-Logik. Rückgabe: true = neu zeichnen
export function settingsClick(ctx, act, el) {
  const app = ctx.app, s = app.settings;
  const save = () => app.saveSettings();
  switch (act) {
    case 'settab': ctx.tab = el.dataset.v; return true;
    case 'quality': s.quality = el.dataset.v; Object.assign(s, PRESETS[s.quality]); save(); return true;
    case 'shadows': s.shadows = el.dataset.v; save(); return true;
    case 'postfx': s.postfx = !s.postfx; save(); return true;
    case 'ao': if (s.postfx) { s.ao = !s.ao; save(); } return true;
    case 'bloom': if (s.postfx) { s.bloom = !s.bloom; save(); } return true;
    case 'alwaysDay': s.alwaysDay = !s.alwaysDay; save(); return true;
    case 'icons': if (app.engine && app.engine.effects) app.engine.effects.showIcons = !app.engine.effects.showIcons; return true;
    case 'mute': s.muted = !s.muted; app.audio && app.audio.applyVolumes(); save(); return true;
    case 'uiScale': s.uiScale = +el.dataset.v; applyUiScale(s); save(); return true;
    case 'minimap': s.minimap = !s.minimap; save(); ctx.ui && ctx.ui.minimap && ctx.ui.minimap.setVisible(s.minimap); return true;
    case 'advisor': s.advisor = !s.advisor; save(); return true;
    case 'tooltips': s.tooltips = !s.tooltips; save(); ctx.onTips && ctx.onTips(s.tooltips); return true;
    case 'tutorial': s.tutorialDone = !s.tutorialDone; save(); if (ctx.ui) { ctx.ui.tutorialHidden = s.tutorialDone; ctx.ui.refreshTutorial(); } return true;
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
