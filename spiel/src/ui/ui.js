// Spieloberfläche (Runde 3: ruhig und aufgeräumt). Die Stadt steht im Mittelpunkt, die Bedienung sitzt an den Rändern:
//   oben    eine schlanke Kopfzeile (Stadt, Einwohner, Kasse, Glück, Nachfrage · Wetter, Zeit, Tempo, Stadt-Check, Meldungen, Hilfe, Menü)
//   unten   „Ansichten" · Werkzeugleiste mit wenigen beschrifteten Hauptgruppen (Unterpunkte als Reiter im Baukatalog) · „Stadt"
//   rechts  Panels und Inspektor, links Ratgeberin und Minikarte (eingeklappt)
// Ansichten, Stadt-Panels, Stadt-Check und Menü öffnen ein gemeinsames Aufklappmenü (auf dem Handy ein Blatt von unten).
// Öffentliche Schnittstelle für andere Module (Panels, Werkzeuge, Inspektoren, Einführung):
//   ui.g, ui.app, ui.toast(text, 'good'|'bad'|'', { where, icon }), ui.renderPanel(), ui.openPanel(id), ui.closePanels(),
//   ui.inspect(sel), ui.setView(id), ui.tooltip(text, mouse, ok), ui.refreshHUD(), ui.openModal(html, onClick), ui.queueModal(fn),
//   ui.focusTile(x, y, dist?), ui.notify({ title, text, mood, where, icon }), ui.openTray(cat), ui.openGroup(id), ui.closeTray(),
//   ui.openHelp(topic?), ui.openHelpFor(hinweis), ui.tourTarget(id) → Element | null, ui.openPop(art), ui.closePop()
// Panels (registerPanel) dürfen zusätzlich input(ui, el, e), change(ui, el, e), badge(ui) → Zahl|Text, group, color, desc,
// available(ui) → bool (erst zeigen, wenn es gebraucht wird) haben.
import { BUILDINGS, ZONE_INFO, ROADS, MILESTONES, CATEGORIES } from '../config.js';
import { fmt, fmtMoney, fmtShort, clamp } from '../util.js';
import { PANELS, TOOLS, TRAY_ITEMS, OVERLAYS_EXTRA, INSPECTORS, MENU_SECTIONS, BUDGET_LINES, emit, on as onBus } from '../registry.js';
import { cardById } from '../sim/progress.js';
// Wetter von S4 (optional): seasonText(g) aus dem Wetter-System, wxIcon(kind, size, night) aus dem Wetter-Panel
import * as wxSys from '../sim/systems/weather.js';
import * as wxPanel from './panels/weather.js';
import { icon, iconAny, logo, badge } from './icons.js';
import { viewList, VIEW_GROUPS, dockPanels, PANEL_GROUPS, catMeta, catLabel, toolbarGroups, groupOfCat, panelAvailable } from './meta.js';
import { CORE_PANELS } from './corepanels.js';
import { inspectorHTML, inspectorClick } from './inspector.js';
import { catalogItems, searchCatalog, cardHTML, detailHTML, isActive, bindThumbSwap, allCatalogItems, freshCats, tourKey } from './catalog.js';
import { pumpThumbs, thumbsPending } from './thumbs.js';
import { Notifier, problems } from './notify.js';
import { Advisor, tutorialSteps, adviceLevel } from './advisor.js';
import { Minimap } from './minimap.js';
import { PhotoMode } from './photo.js';
import { keysHTML } from './keys.js';
import { settingsHTML, settingsClick, settingsInput, settingsChange, ensureSettings, applyUiScale, gfxSnapshot } from './settings.js';
import { bindTips, hideTip, setTipsEnabled } from './tips.js';
import { showLoader, hideLoader, loaderVisible, setLoader, painted } from './loading.js';
import { Onboarding } from './onboarding.js';
import { openHelp, helpTopics } from './help.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const WX_TEXT = 'seasonText', WX_ICON = 'wxIcon';
// Wetterart wie im Wetter-Panel (für wxIcon)
function wxKind(w) {
  if (w.storm && (w.stormI ?? 1) > 0.2) return 'thunder';
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
const itemKey = (it) => `${it.kind}:${it.key || it.type || it.zone || it.panel || ''}`;
const SEASON = { spring: 'Frühling', summer: 'Sommer', autumn: 'Herbst', winter: 'Winter' };
const DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
// Themen der Hilfe zu Kategorien und Begriffen (die Hilfe gehört EINSTIEG – hier nur die Zuordnung, erste Übereinstimmung gewinnt)
const HELP_HINTS = {
  roads: ['roads', 'strassen', 'street'], zones: ['zones', 'zonen', 'demand', 'nachfrage'], districts: ['districts', 'bezirke'],
  power: ['power', 'strom', 'utilities', 'versorgung'], water: ['water', 'wasser', 'utilities', 'versorgung'], garbage: ['garbage', 'muell', 'waste'],
  services: ['services', 'dienste'], education: ['education', 'bildung', 'services', 'dienste'], safety: ['safety', 'services', 'dienste', 'disasters'],
  parks: ['parks', 'happiness', 'glueck'], landmarks: ['landmarks', 'parks', 'happiness'], transit: ['ubahn', 'metro', 'transit', 'pulsbahn'],
  transport: ['transport', 'verkehr', 'traffic', 'ubahn'], industry: ['industry', 'zones'], money: ['money', 'geld', 'budget'], happy: ['happiness', 'glueck'],
  demand: ['demand', 'nachfrage', 'zones'], cards: ['cards', 'karten', 'wochenkarten'], disasters: ['disasters', 'katastrophen', 'weather'],
};

// Zustand, der einen Neustart der Ansicht überlebt (Grafik-Einstellungen übernehmen)
let restore = null;

// System-Panels (über Kopfzeile und Menü erreichbar, nicht im Stadt-Menü)
const SYS_PANELS = [
  { id: 'advisor', title: 'Ratgeberin', desc: 'Lagebericht und Tipps für die nächsten Schritte', icon: 'advisor', hidden: true, color: '#e8543f', render: (ui) => ui.advisor.html(), click: (ui, act, el) => ui.advisor.click(act, el) },
  { id: 'notes', title: 'Meldungen', desc: 'Wichtiges der letzten Tage mit Ort und Zeit', icon: 'bell', hidden: true, color: '#1d2330', render: (ui) => ui.notes.html(), click: (ui, act, el) => ui.notes.click(act, el), opened: (ui) => ui.notes.markRead() },
  {
    id: 'settings', title: 'Optionen', desc: 'Grafik, Klang, Bedienung und Spielstände', icon: 'settings', hidden: true, color: '#5d6470',
    render: (ui) => settingsHTML(ui.setCtx()),
    click: (ui, act, el) => {
      const ctx = ui.setCtx();
      if (settingsClick(ctx, act, el)) { ui.setTab = ctx.tab; return true; }
      const app = ui.app;
      switch (act) {
        case 'applygfx': ui.restartView(); return false;
        case 'keys': ui.showKeys(); return false;
        case 'save': if (app.save(+el.dataset.k) !== false) ui.toast(`Gespeichert in Platz ${el.dataset.k}.`, 'good'); return true;
        case 'load': ui.withLoader('Spielstand wird geladen', () => app.loadSlot(+el.dataset.k)); return false;
        case 'export': if (!window.STADTPULS_EMBED) app.exportSave(); return true;
        case 'copy': try { app.copySave(); } catch (e) { ui.toast('Zwischenablage nicht verfügbar.', 'bad'); } return true;
        case 'tomenu': app.toMenu(); return false;
        case 'openpanel': ui.openPanel(el.dataset.v); return false;
      }
      return true;
    },
    input: (ui, el) => settingsInput(ui.setCtx(), el),
    change: (ui, el) => settingsChange(ui.setCtx(), el),
  },
];

export class UI {
  constructor(app) {
    this.app = app;
    this.g = app.game;
    ensureSettings(app.settings);
    applyUiScale(app.settings);
    this.root = document.getElementById('hud');
    this.tip = document.getElementById('tooltip');
    this.toasts = document.getElementById('toasts');
    this.modalRoot = document.getElementById('modal-root');
    this.cat = null;
    this.group = null;
    this.groupCat = {};
    this.groups = [];
    this.pop = null;
    this.panel = null;
    this.sel = null;
    this.view = 'none';
    this.ugManual = false;
    this.timer = 0;
    this.panelTimer = 0;
    this.chartKey = 'pop';
    this.tutorialHidden = !!app.settings.tutorialDone;
    this.modalQueue = [];
    this.cache = { roads: 0 };
    this.search = '';
    this.hoverItem = null;
    this.recent = [];
    this.setTab = 'grafik';
    this.gfxSnap = gfxSnapshot(app.settings);
    this.hudHidden = false;
    this.frames = 0;
    this.newsUnread = false;
    this.notes = new Notifier(this);
    this.advisor = new Advisor(this);
    this.photo = new PhotoMode(this);
    this.advisor.compute();
    this.mount();
    this.bindGame();
    try { this.onboarding = new Onboarding(this); } catch (e) { console.warn('Einführung', e); this.onboarding = null; }
    // Hilfe (EINSTIEG). Solange es noch keine Themen gibt, öffnet sich der Reiter „Hilfe" der Optionen.
    this.openHelp = (topic) => {
      let n = 0;
      try { n = (helpTopics() || []).length; } catch (e) { n = 0; }
      this.closePop();
      if (!n) { this.setTab = 'hilfe'; this.openPanel('settings'); return; }
      try { openHelp(this, topic); } catch (e) { console.warn('Hilfe', e); }
    };
    this.helpTopics = helpTopics;
    bindTips();
    setTipsEnabled(app.settings.tooltips !== false);
    this.refreshBadges();
    this.refreshTutorial();
    this.unbus = [
      onBus('ui:rebuild', () => this.rebuild()),
      onBus('simError', (e) => { try { this.notes.push({ title: 'Technischer Hinweis', text: `Ein Spielsystem${e && e.where ? ` (${e.where})` : ''} ist gestolpert und wurde übersprungen. Das Spiel läuft weiter.`, mood: 'info', icon: 'info', key: 'simError', silent: true }); } catch (err) { /* egal */ } }),
    ];
    // Für Prüfskripte (tools/shot.mjs --eval): Register erreichbar machen
    window.__stadtpulsReg = { PANELS, TOOLS, TRAY_ITEMS, OVERLAYS_EXTRA, INSPECTORS, MENU_SECTIONS, BUDGET_LINES, CATEGORIES, emit };
    if (restore) this.applyRestore();
  }

  // ---------- Aufbau
  mount() {
    const r = this.root;
    r.hidden = false;
    const zoneCol = (z) => hex(ZONE_INFO[z].color);
    const sp = (v, inner, name, desc, key) => `<button class="spd" data-speed="${v}" data-tip="${name}" data-tip-desc="${desc}" data-key="${key}" aria-label="${name}">${inner}</button>`;
    // Runde 3b (Vorlage): oben links Rang- und Nachfrage-Chip, oben rechts Pillen für Kasse, Einwohner und Glück samt
    // Stadt-Check, Meldungen und Hilfe; unten links das Dock (Menü, Bau-Gruppen, Abriss, Ansichten, Stadt), unten rechts die Zeit-Karte.
    r.innerHTML = `
<div class="topbar">
  <div class="hud-l">
    <button class="hchip cityplate" id="u-plate" data-tour="rank" data-tip="Stadtrang" data-tip-desc="Der Balken zeigt den Weg zum nächsten Meilenstein. Klick: Ziele und Meilensteine." data-tip-pos="bottom">
      <span class="rk-star">${badge('star', 36)}<b class="num" id="u-lvl">1</b></span>
      <span class="cp-txt"><span class="name" id="u-name"></span><span class="rank" id="u-rank"></span><span class="rankbar"><i id="u-rankbar"></i></span></span>
    </button>
    <button class="hchip demand" id="u-demand" data-tour="demand" data-tip="Nachfrage" data-tip-desc="Was die Stadt gerade braucht: Wohnen, Gewerbe, Industrie, Büro. Hoher Balken – mehr davon ausweisen. Klick: Zonen." data-tip-pos="bottom">
      <span class="k">Nachfrage</span>
      <span class="bars">${[1, 2, 3, 4].map((z) => `<span class="col" id="u-demc${z}"><span class="bar"><i id="u-dem${z}" style="background:${zoneCol(z)}"></i></span><span class="lbl">${ZONE_INFO[z].short}</span></span>`).join('')}</span>
    </button>
  </div>
  <div class="spacer"></div>
  <div class="hud-r">
    <div class="stats">
      <button class="hchip stat" data-stat="money" data-tour="stat-money" data-tip="Stadtkasse" data-tip-desc="Geld für neue Bauten, darunter Gewinn oder Verlust pro Tag. Klick: Haushalt." data-tip-pos="bottom"><span class="sb">${badge('coin', 32)}</span><span class="st"><span class="v num" id="u-money"></span><span class="d num" id="u-net"></span></span><span class="trend" id="u-trend"></span></button>
      <button class="hchip stat" data-stat="pop" data-tour="stat-pop" data-tip="Einwohner" data-tip-desc="So viele Menschen leben in der Stadt, darunter die Veränderung seit gestern. Klick: Bevölkerung." data-tip-pos="bottom"><span class="sb">${badge('person', 32)}</span><span class="st"><span class="v num" id="u-pop">0</span><span class="d num" id="u-popd"></span></span></button>
      <span class="brk" aria-hidden="true"></span>
      <button class="hchip stat happy" data-stat="happy" data-tour="stat-happy" data-tip="Glück" data-tip-desc="Wie zufrieden die Leute sind. Unglückliche ziehen weg. Klick: Glückskarte der Stadt." data-tip-pos="bottom"><span class="sb" id="u-smile">${badge('smile', 32)}</span><span class="st"><span class="v num" id="u-happy"></span><span class="d" id="u-happyd"></span></span></button>
    </div>
    <div class="sysbtns" id="u-sys">
      <button class="hchip check ok" id="u-check" data-pop="check" data-tour="check" data-tip="Stadt-Check" data-tip-desc="Zeigt, was gerade Aufmerksamkeit braucht – mit einem Klick zur Lösung." data-key="H" data-tip-pos="bottom" aria-label="Stadt-Check"><span class="ck-i">${icon('pulse', 17, 2.6)}</span><span class="ck-l">Stadt-Check</span><span class="ck-n num" id="u-checkn"></span></button>
      <button class="rbtn" data-sys="notes" data-tour="notes" data-tip="Meldungen" data-tip-desc="Alles Wichtige der letzten Tage mit Ort und Zeit." data-key="N" data-tip-pos="bottom" aria-label="Meldungen">${icon('bell', 19, 2.4)}<span class="count" id="u-notecount" hidden></span></button>
      <button class="rbtn" data-sys="help" data-tour="help" data-tip="Hilfe" data-tip-desc="So funktioniert's: Straßen, Zonen, Versorgung, Glück, Geld und U-Bahn kurz erklärt." data-key="F1" data-tip-pos="bottom" aria-label="Hilfe">${icon('help', 19, 2.4)}</button>
    </div>
  </div>
</div>
<div class="sign timecard" id="u-timecard">
  <button class="wx" id="u-weather" hidden></button>
  <div class="when" data-tour="time" data-tip="Uhrzeit und Datum" data-tip-desc="Ein Spieltag dauert 30 Sekunden. Steuern, Wachstum und Wochenkarten richten sich danach."><span class="date" id="u-date"></span><span class="time num" id="u-time"></span></div>
  <div class="speed" id="u-speed" data-tour="speed">
    ${sp(0, icon('pause', 17, 3.2), 'Pause', 'Die Zeit anhalten und in Ruhe planen. Noch einmal drücken: weiter.', 'Leertaste')}${sp(1, '<b>×1</b>', 'Normal', 'Ein Spieltag in 30 Sekunden.', '1')}${sp(2, '<b>×2</b>', 'Schnell', 'Doppeltes Tempo.', '2')}${sp(3, '<b>×3</b>', 'Sehr schnell', 'Dreifaches Tempo – gut, wenn die Stadt rund läuft.', '3')}
  </div>
</div>
<div class="toolhint" id="u-toolhint" hidden></div>
<div class="rstack" id="u-rstack"><div id="u-objectives"></div></div>
<div class="sign legend" id="u-legend" hidden></div>
<div class="leftstack" id="u-leftstack"><div class="sign bubble" id="u-bubble" hidden></div><div class="sign tutorial" id="u-tutorial" hidden></div></div>
<div class="sign minimap" id="u-mini"></div>
<button class="sign mm-open" id="u-mmopen" data-tip="Minikarte" data-tip-desc="Übersichtskarte der ganzen Stadt. Ein Klick in die Karte springt dorthin." data-key="K" aria-label="Minikarte zeigen" hidden>${icon('minimap', 19, 2.3)}</button>
<div class="tray" id="u-tray" data-tour="tray" hidden></div>
<div class="bottombar" id="u-bottom">
  <div class="sign dock" id="u-dock">
    <button class="dk-menu" data-pop="menu" data-tour="settings" id="u-menubtn" data-tip="Menü" data-tip-desc="Speichern und Laden, Optionen, Fotomodus und Hauptmenü." aria-label="Menü"><span class="stop">${icon('menu', 26, 2.8)}</span><span class="lbl">Menü</span></button>
    <div class="toolbar" id="u-toolbar" data-tour="toolbar"><div class="track" id="u-cats"></div></div>
    <div class="cap"><span class="dk-sep"></span><button class="capbtn" id="u-viewsbtn" data-pop="views" data-tour="views" data-tip="Ansichten" data-tip-desc="Farbige Karten für Strom, Wasser, Glück, Verkehr und mehr – und der Blick in den U-Bahn-Untergrund." aria-label="Ansichten"><span class="stop">${icon('layers', 21, 2.3)}</span><span class="lbl" id="u-viewlbl">Ansichten</span></button><button class="capbtn" id="u-citybtn" data-pop="city" data-tour="city" data-tip="Stadt" data-tip-desc="Stadtverwaltung: Haushalt, Statistik, Verordnungen, U-Bahn-Linien und mehr." aria-label="Stadt"><span class="stop">${icon('city', 21, 2.3)}<span class="dot" id="u-citydot" hidden></span></span><span class="lbl">Stadt</span></button></div>
  </div>
</div>
<div class="sign panel" id="u-panel" hidden></div>
<div class="sign inspector" id="u-insp" hidden></div>
<div class="pop-scrim" id="u-scrim" hidden></div>
<div class="sign pop" id="u-popover" role="dialog" aria-label="Menü" hidden></div>
`;
    const $ = (id) => document.getElementById(id);
    this.el = {};
    for (const id of ['name', 'rank', 'rankbar', 'lvl', 'plate', 'trend', 'smile', 'timecard', 'dock', 'pop', 'popd', 'money', 'net', 'happy', 'happyd', 'demand', 'date', 'time', 'speed', 'weather', 'sys', 'check', 'checkn', 'notecount', 'menubtn', 'toolhint', 'legend', 'leftstack', 'bubble', 'tutorial', 'mini', 'mmopen', 'tray', 'bottom', 'viewsbtn', 'viewlbl', 'citybtn', 'citydot', 'toolbar', 'cats', 'panel', 'insp', 'scrim', 'popover', 'pop', 'dem1', 'dem2', 'dem3', 'dem4']) this.el[id] = $('u-' + id);
    this.el.name.textContent = this.g.name;
    this.renderToolbar();
    this.minimap = new Minimap(this, this.el.mini);
    // Minikarte standardmäßig eingeklappt (Einstellung „Minikarte" oder Taste K blendet sie ein)
    this.toggleMinimap(this.app.settings.minimapOpen === true && !this.mobile(), true);
    this.unswap = bindThumbSwap(this.root);

    const on = (el, ev, fn) => el.addEventListener(ev, fn);
    on(this.el.speed, 'click', (e) => {
      const b = e.target.closest('button[data-speed]');
      if (!b) return;
      this.app.audio.play('click');
      const v = +b.dataset.speed;
      // Der erste Knopf schaltet zwischen Pause und Weiter (wie in der Vorlage: ▶ bzw. ❚❚)
      this.setSpeed(v === 0 && this.g.speed === 0 ? (this.lastSpeed || 1) : v);
    });
    on(this.el.sys, 'click', (e) => { const b = e.target.closest('button[data-sys]'); if (b) this.sysAction(b.dataset.sys); });
    on(this.root, 'click', (e) => { const b = e.target.closest('[data-pop]'); if (b && this.root.contains(b)) { this.app.audio.play('click'); this.togglePop(b.dataset.pop, b); } });
    on(this.root.querySelector('.topbar'), 'click', (e) => { const b = e.target.closest('[data-stat]'); if (b) { if (b.dataset.stat === 'happy') this.app.audio.play('click'); this.statAction(b.dataset.stat); } });
    on(this.el.plate, 'click', () => { this.togglePanel(this.panelDef('progression') ? 'progression' : 'stats'); });
    on(this.el.demand, 'click', () => { this.app.audio.play('click'); if (this.group === 'zones') this.closeTray(); else this.openTray('zones'); });
    on(this.el.weather, 'click', () => { if (this.panelDef('weather')) this.togglePanel('weather'); });
    on(this.el.cats, 'click', (e) => {
      const b = e.target.closest('button.cat');
      if (!b) return;
      this.app.audio.play('click');
      if (b.dataset.tool) { this.closeTray(); this.app.input.setTool({ kind: b.dataset.tool }); }
      else if (b.dataset.group) { if (this.group === b.dataset.group && !this.el.tray.hidden) this.closeTray(); else this.openGroup(b.dataset.group); }
    });
    on(this.el.tray, 'click', (e) => this.trayClick(e));
    on(this.el.tray, 'input', (e) => { if (e.target.id === 'u-search') { this.search = e.target.value; this.renderTrayBody(); } });
    on(this.el.tray, 'keydown', (e) => {
      if (e.target.id !== 'u-search') return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (this.search) { this.search = ''; e.target.value = ''; this.renderTrayBody(); } else { e.target.blur(); this.closeTray(); } }
      if (e.key === 'Enter') { const first = this.el.tray.querySelector('.strip button.item:not(.locked)'); if (first) { first.click(); e.target.blur(); } }
    });
    on(this.el.tray, 'pointerover', (e) => {
      const b = e.target.closest('button.item');
      if (!b || !this.trayList) return;
      const it = this.trayList[+b.dataset.i];
      if (it && it !== this.hoverItem) { this.hoverItem = it; const d = this.el.tray.querySelector('.detail'); if (d) d.innerHTML = detailHTML(it); }
    });
    on(this.el.tray, 'wheel', (e) => {
      const strip = e.target.closest('.tr-tabs');
      if (!strip || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      strip.scrollLeft += e.deltaY;
    });
    on(this.el.toolhint, 'click', (e) => this.toolHintClick(e));
    on(this.el.popover, 'click', (e) => this.popClick(e));
    on(this.el.scrim, 'click', () => this.closePop());
    on(this.el.panel, 'pointerdown', (e) => {
      this.panelBusy = true;
      if (this.mobile() && e.target.closest('header') && !e.target.closest('button')) this.swipe = { y: e.clientY, id: e.pointerId };
    });
    on(this.el.panel, 'pointermove', (e) => {
      if (!this.swipe || this.swipe.id !== e.pointerId) return;
      const dy = Math.max(0, e.clientY - this.swipe.y);
      this.el.panel.style.transform = dy ? `translateY(${dy}px)` : '';
      if (dy > 110) { this.swipe = null; this.el.panel.style.transform = ''; this.closePanels(); }
    });
    on(this.el.panel, 'pointerup', () => { this.swipe = null; this.el.panel.style.transform = ''; });
    this.onUp = () => { this.panelBusy = false; };
    window.addEventListener('pointerup', this.onUp);
    // Aufklappmenü schließt bei Klick daneben (auch in die Stadt)
    this.onDown = (e) => {
      if (!this.pop) return;
      const t = e.target;
      if (this.el.popover.contains(t) || (t.closest && t.closest('[data-pop]'))) return;
      if (t.closest && t.closest('#uitip')) return;
      this.closePop();
    };
    window.addEventListener('pointerdown', this.onDown, true);
    on(this.el.panel, 'click', (e) => this.panelClick(e));
    on(this.el.panel, 'input', (e) => this.panelEvent(e, 'input'));
    on(this.el.panel, 'change', (e) => this.panelEvent(e, 'change'));
    on(this.el.insp, 'click', (e) => inspectorClick(this, e));
    on(this.el.bubble, 'click', (e) => this.advisor.bubbleClick(e));
    on(this.el.tutorial, 'click', (e) => {
      if (e.target.closest('[data-act=hidetut]')) { this.tutorialHidden = true; this.app.settings.tutorialDone = true; this.app.saveSettings(); this.el.tutorial.hidden = true; return; }
      if (e.target.closest('[data-act=tuttoggle]')) { this.tutOpen = !this.tutOpen; this.refreshTutorial(); return; }
      const li = e.target.closest('[data-step]');
      if (li) { const st = tutorialSteps(this.g, this)[+li.dataset.step]; if (st && st[2]) this.runAction(st[2]); }
    });
    on(this.el.mmopen, 'click', () => { this.app.audio.play('click'); this.toggleMinimap(true); });
    on(this.el.panel, 'animationend', () => this.el.panel.classList.remove('enter'));
    on(this.el.tray, 'animationend', () => this.el.tray.classList.remove('enter'));
    on(this.el.insp, 'animationend', () => this.el.insp.classList.remove('enter'));
    this.onKey = (e) => this.key(e);
    window.addEventListener('keydown', this.onKey);
    this.onResize = () => { this.fitTop(); if (this.minimap) this.minimap.resize(); if (this.pop) this.positionPop(); };
    window.addEventListener('resize', this.onResize);
    this.refreshSpeed();
    this.refreshHUD();
    requestAnimationFrame(() => this.fitTop());
  }

  // Kopfzeile kann (Handy, schmale Fenster) umbrechen – Hinweise, Ziele und Meldungen beginnen darunter
  fitTop() {
    const de = document.documentElement.style;
    const tb = this.root.querySelector('.topbar');
    if (!tb || this.root.hidden) return;
    const z = this.uiZoom();
    const v = Math.round(tb.getBoundingClientRect().bottom / z + 10) + 'px';
    if (de.getPropertyValue('--top') !== v) de.setProperty('--top', v);
  }
  uiZoom() { return parseFloat(getComputedStyle(this.root).zoom) || parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui')) || 1; }

  dispose() {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointerdown', this.onDown, true);
    window.removeEventListener('resize', this.onResize);
    if (this.photo.active) this.photo.exit();
    for (const u of this.unbind || []) u();
    for (const u of this.unbus || []) u();
    this.notes.dispose();
    this.advisor.dispose();
    if (this.onboarding) { try { this.onboarding.dispose(); } catch (e) { /* egal */ } }
    if (this.minimap) this.minimap.dispose();
    if (this.unswap) this.unswap();
    try { if (this.app.engine && this.app.engine.undergroundActive && typeof this.app.engine.setUnderground === 'function') this.app.engine.setUnderground(false); } catch (e) { /* egal */ }
    hideTip();
    this.root.innerHTML = '';
    this.root.hidden = true;
    this.root.className = '';
    document.documentElement.style.removeProperty('--top');
    this.modalRoot.innerHTML = '';
    this.tooltip(null);
  }

  bindGame() {
    const g = this.g;
    this.unbind = [
      g.on('news', (n) => this.onNews(n)),
      g.on('milestone', (i) => { setTimeout(() => { this.renderToolbar(); }, 0); this.notes.push({ title: 'Meilenstein', text: `${MILESTONES[i].name} erreicht!`, mood: 'good', icon: 'trophy', kind: 'milestone', silent: true }); this.queueModal(() => this.showMilestone(i)); if (this.cat) this.renderTray(); }),
      g.on('cards', (ids) => this.queueModal(() => this.showCards(ids))),
      g.on('event', (ev) => this.queueModal(() => this.showEvent(ev))),
      g.on('bankrupt', () => this.queueModal(() => this.showBankrupt())),
      g.on('day', () => { if (this.panel) this.renderPanel(); this.refreshAvail(); }),
      g.on('transitChanged', () => { if (this.cat === 'transit') this.renderTray(); }),
    ];
  }

  mobile() { return window.innerWidth <= 760; }

  // Einführung (EINSTIEG) über Bedienschritte informieren – Fehler dort stören die Oberfläche nie
  ob(name, data) {
    const o = this.onboarding;
    if (!o || typeof o.onEvent !== 'function') return;
    try { o.onEvent(name, data); } catch (e) { console.warn('Einführung', e); }
  }

  // Register neu einlesen (falls Module nach dem Start Panels, Kategorien oder Ansichten ergänzen)
  rebuild() {
    this.renderToolbar();
    if (this.pop) this.renderPop();
    this.markPanelButtons();
    this.refreshBadges();
  }

  // ---------- Kopfzeile
  setSpeed(s) {
    if (this.photo.active && s > 0 && !this.photo.opts.run) return;
    if (s > 0) this.lastSpeed = s;
    this.g.speed = s;
    this.refreshSpeed();
  }
  refreshSpeed() {
    for (const b of this.el.speed.querySelectorAll('button')) b.classList.toggle('on', +b.dataset.speed === this.g.speed);
    const paused = this.g.speed === 0;
    this.root.classList.toggle('paused', paused);
    // Pause-Knopf zeigt, was er tut: ❚❚ hält an, ▶ läuft weiter
    const pb = this.el.speed.querySelector('[data-speed="0"]');
    if (pb && pb.dataset.p !== String(paused)) {
      pb.dataset.p = String(paused);
      pb.innerHTML = icon(paused ? 'play' : 'pause', 17, 3.2);
      pb.dataset.tip = paused ? 'Weiter' : 'Pause';
      pb.dataset.tipDesc = paused ? 'Die Zeit läuft wieder mit dem letzten Tempo.' : 'Die Zeit anhalten und in Ruhe planen. Noch einmal drücken: weiter.';
      pb.setAttribute('aria-label', paused ? 'Weiter' : 'Pause');
    }
  }
  sysAction(a) {
    if (a === 'photo') { this.app.audio.play('click'); this.closePop(); this.photo.toggle(); return; }
    if (a === 'keys') { this.app.audio.play('click'); this.closePop(); this.showKeys(); return; }
    if (a === 'help') { this.app.audio.play('click'); this.openHelp(); return; }
    this.closePop();
    this.togglePanel(a);
  }
  statAction(s) {
    if (s === 'pop') { const c = this.panelDef('citizens'); this.togglePanel(c && panelAvailable(c, this) ? 'citizens' : 'stats'); }
    else if (s === 'money') this.togglePanel('budget');
    else if (s === 'happy') this.setView(this.view === 'happiness' ? 'none' : 'happiness');
  }

  refreshHUD() {
    const g = this.g, s = g.stats;
    const ms = MILESTONES[g.milestone], next = MILESTONES[g.milestone + 1];
    const rank = next ? `${ms.name} → ${next.name}` : ms.name;
    if (this.el.rank.textContent !== rank) this.el.rank.textContent = rank;
    this.el.plate.dataset.tipDesc = next ? `Jetzt: ${ms.name}. Nächster Rang: ${next.name} ab ${fmt(next.pop)} Einwohnern – das schaltet Neues frei. Klick: Ziele und Meilensteine.` : `${ms.name} – der höchste Rang. Klick: Ziele und Meilensteine.`;
    this.el.rankbar.style.width = next ? `${clamp((s.pop - ms.pop) / (next.pop - ms.pop), 0, 1) * 100}%` : '100%';
    const lvl = String(g.milestone + 1);
    if (this.el.lvl.textContent !== lvl) this.el.lvl.textContent = lvl;
    this.el.pop.textContent = fmt(s.pop);
    const hist = g.history;
    const prev = hist.length >= 2 ? hist[hist.length - 2].pop : 0;
    const dp = hist.length ? hist[hist.length - 1].pop - prev : 0;
    this.el.popd.textContent = hist.length >= 2 ? `${dp >= 0 ? '+' : '−'}${fmt(Math.abs(dp))} / Tag` : 'Neugründung';
    this.el.popd.className = 'd num ' + (hist.length < 2 ? '' : dp >= 0 ? 'pos' : 'neg');
    this.el.money.textContent = g.sandbox ? '∞' : (Math.abs(g.money) >= 1e6 ? fmtShort(g.money) : fmt(g.money)) + ' €';
    this.el.money.className = 'v num' + (g.money < 0 ? ' neg' : '');
    const net = g.lastBudget ? g.lastBudget.net : 0;
    this.el.net.textContent = `${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))} € / Tag`;
    this.el.net.className = 'd num ' + (net >= 0 ? 'pos' : 'neg');
    // Trendpfeil wie in der Vorlage (grün steigt, rot fällt)
    const tr = g.sandbox ? '' : net > 0 ? 'up' : net < 0 ? 'down' : '';
    if (this.el.trend.dataset.t !== tr) { this.el.trend.dataset.t = tr; this.el.trend.innerHTML = tr ? icon('arrowR', 15, 3) : ''; }
    this.el.happy.textContent = `${Math.round(s.happiness)} %`;
    const hp = s.happiness;
    this.el.happyd.textContent = hp >= 75 ? 'begeistert' : hp >= 60 ? 'zufrieden' : hp >= 45 ? 'durchwachsen' : hp >= 30 ? 'unzufrieden' : 'wütend';
    this.el.happyd.className = 'd ' + (hp >= 50 ? 'pos' : 'neg');
    const mood = hp >= 60 ? 'smile' : hp >= 42 ? 'meh' : 'sad';
    if (this.el.smile.dataset.m !== mood) { this.el.smile.dataset.m = mood; this.el.smile.innerHTML = badge(mood, 32); }
    // Zeit-Karte: „Montag · Tag 37" (Woche und Jahr im Tooltip)
    const wd = DAY_NAMES[g.weekday()] || '';
    const dl = `${wd} · Tag ${fmt(g.day() + 1)}`;
    if (this.el.date.textContent !== dl) this.el.date.textContent = dl;
    const when = this.el.date.parentElement;
    const wt = `${g.dateText()} · ${g.clockText()} Uhr`;
    if (when.dataset.tip !== wt) when.dataset.tip = wt;
    this.el.time.textContent = g.clockText();
    const best = [1, 2, 3, 4].reduce((a, z) => (g.demand[z] > g.demand[a] ? z : a), 1);
    for (let z = 1; z <= 4; z++) {
      const v = g.demand[z];
      const el = this.el['dem' + z];
      const hgt = Math.min(50, Math.abs(v) / 2);
      el.style.height = hgt + '%';
      el.style.bottom = v >= 0 ? '50%' : `${50 - hgt}%`;
      el.style.opacity = v >= 0 ? 1 : 0.45;
      el.parentElement.parentElement.classList.toggle('top', z === best && v > 8);
    }
    const dd = `Was die Stadt gerade braucht – hoher Balken: mehr davon ausweisen. ${[1, 2, 3, 4].map((z) => { const v = g.demand[z]; return `${ZONE_INFO[z].name} ${v > 40 ? 'stark gefragt' : v > 8 ? 'gefragt' : v < -8 ? 'zu viel' : 'ausgeglichen'}`; }).join(' · ')}. Klick: Zonen.`;
    if (this.el.demand.dataset.tipDesc !== dd) this.el.demand.dataset.tipDesc = dd;
    // Wetter (falls ein Wetter-System läuft)
    const w = g.ext && g.ext.weather;
    if (w && typeof w.temp === 'number') {
      const night = this.app.engine && this.app.engine.night > 0.5;
      const ic = w.storm || w.lightning > 0 ? 'storm' : w.snow > 0.15 ? 'snow' : w.rain > 0.15 ? 'rain' : w.fog > 0.5 ? 'cloud' : w.cloud > 0.6 ? 'cloud' : night ? 'moon' : 'sun';
      const fIcon = wxPanel[WX_ICON], fText = wxSys[WX_TEXT];
      let st = '';
      try { st = typeof fText === 'function' ? fText(g) : ''; } catch (e) { st = ''; }
      const season = (st.split(' · ')[0]) || SEASON[w.season] || '';
      let pic = '';
      try { pic = typeof fIcon === 'function' ? fIcon(wxKind(w), 24, night) : ''; } catch (e) { pic = ''; }
      const html = `${pic || icon(ic, 18)}<span class="wt"><b class="num">${Math.round(w.temp)}°</b>${season ? `<small>${esc(season)}</small>` : ''}</span>`;
      if (this._wx !== html) { this._wx = html; this.el.weather.innerHTML = html; }
      this.el.weather.dataset.tip = st || SEASON[w.season] || 'Wetter';
      this.el.weather.dataset.tipDesc = `${Math.round(w.temp)} °C${w.rain > 0.15 ? ' · Regen' : ''}${w.snow > 0.15 ? ' · Schnee' : ''}${w.fog > 0.4 ? ' · Nebel' : ''}${w.wind > 0.6 ? ' · windig' : ''}${this.panelDef('weather') ? ' · Klick: Wetter und Katastrophenschutz' : ''}`;
      this.el.weather.dataset.tipPos = 'bottom';
      this.el.weather.hidden = false;
      this.el.weather.parentElement.classList.add('has-wx');
    } else { this.el.weather.hidden = true; this.el.weather.parentElement.classList.remove('has-wx'); }
  }

  refreshBadges() {
    const n = this.notes.unread;
    this.el.notecount.hidden = !n;
    this.el.notecount.textContent = n > 99 ? '99+' : String(n);
    // Stadt-Check: ein Knopf mit Zähler statt vieler Chips; die Ratgeberin meldet sich als Punkt
    const probs = problems(this.g);
    const lvl = adviceLevel(this.advisor);
    const sev = probs.some((p) => p.sev === 'bad') ? 'bad' : probs.length ? 'warn' : 'ok';
    const key = probs.map((p) => p.id + p.count + p.sev).join('|') + '/' + lvl;
    if (key !== this._probKey) {
      this._probKey = key;
      const c = this.el.check;
      c.classList.remove('ok', 'warn', 'bad');
      c.classList.add(sev);
      c.classList.toggle('adv', lvl >= 2 && !probs.length);
      this.el.checkn.textContent = probs.length ? String(probs.length) : '';
      c.dataset.tipDesc = probs.length ? `${probs.length === 1 ? 'Eine Sache braucht' : `${probs.length} Dinge brauchen`} Aufmerksamkeit: ${probs.slice(0, 3).map((p) => p.text).join(' · ')}. Klick: Lösungen zeigen.` : 'Alles im grünen Bereich. Klick: Lagebericht und Rat der Ratgeberin.';
      if (this.pop === 'check') this.renderPop();
    }
    // Abzeichen der Stadt-Panels (z. B. neue Aufträge) als Punkt am Knopf „Stadt"
    let any = false;
    for (const { p } of this.cityPanels()) {
      if (!p.badge) continue;
      let v = null;
      try { v = p.badge(this); } catch (e) { v = null; }
      if (v !== null && v !== undefined && v !== 0 && v !== '') { any = true; break; }
    }
    this.el.citydot.hidden = !any;
  }

  // ---------- Werkzeugleiste: wenige beschriftete Hauptgruppen, die Kategorien sind Reiter im Katalog
  // Sichtbare Kategorien einer Gruppe: ganz gesperrte Reiter bleiben weg (fortschreitende Enthüllung), der erste bleibt immer.
  visibleCats(gr) {
    if (!gr) return [];
    const out = [];
    for (const c of gr.cats) {
      let items = [];
      try { items = catalogItems(this, c); } catch (e) { items = []; }
      const open = items.some((it) => !it.locked || it.built);
      if (open || c === gr.cats[0] || c === this.cat) out.push(c);
    }
    return out;
  }
  groupById(id) { return this.groups.find((x) => x.id === id) || null; }
  renderToolbar() {
    const groups = toolbarGroups();
    this.groups = groups;
    this.visCache = new Map(groups.map((gr) => [gr.id, this.visibleCats(gr)]));
    const stop = (gr) => {
      const vis = this.visCache.get(gr.id) || [];
      const single = vis.length === 1;
      const locked = vis.every((c) => { try { return catalogItems(this, c).every((it) => it.locked && !it.built); } catch (e) { return false; } });
      const desc = locked ? `${gr.desc} Noch gesperrt – kommt, wenn die Stadt wächst.` : gr.desc;
      return `<button class="cat${locked ? ' dim' : ''}" data-group="${gr.id}" data-tour="${single ? `cat-${vis[0]}` : `group-${gr.id}`}" style="--lc:${gr.color}" data-tip="${esc(gr.name)}" data-tip-desc="${esc(desc)}" ${gr.key ? `data-key="${gr.key}"` : ''} aria-label="${esc(gr.name)}"><span class="stop">${iconAny(gr.icon, 'layers', 22, 2.4)}</span><span class="lbl">${esc(gr.name)}</span></button>`;
    };
    this.el.cats.innerHTML = `<div class="line">${groups.map(stop).join('')}</div><span class="tb-sep"></span><button class="cat danger" data-tool="bulldoze" data-tour="cat-bulldoze" data-tip="Abriss" data-tip-desc="Gebäude, Straßen und Zonen entfernen: Fläche aufziehen. Rechtsklick oder Esc beendet." data-key="B" aria-label="Abriss"><span class="stop">${icon('bulldoze', 22, 2.4)}</span><span class="lbl">Abriss</span></button>`;
    this.markToolButtons();
    this.markFresh();
    if (this.cat && !this.el.tray.hidden) this.renderTray();
  }
  // Punkt an Gruppen (und Reitern) mit neu freigeschalteten Gebäuden, bis man sie geöffnet hat
  markFresh() {
    const fresh = freshCats(this);
    const seen = this.seenFresh || (this.seenFresh = new Map());
    const isNew = (c) => fresh.has(c) && seen.get(c) !== this.g.milestone;
    for (const b of this.el.cats.querySelectorAll('.cat[data-group]')) {
      const gr = this.groupById(b.dataset.group);
      const on = !!gr && gr.cats.some(isNew);
      let d = b.querySelector('.nd');
      if (on && !d) { d = document.createElement('span'); d.className = 'nd'; b.querySelector('.stop').appendChild(d); }
      else if (!on && d) d.remove();
    }
    this._isNew = isNew;
  }
  // Gruppe zum aktiven Werkzeug (Ring an der Haltestelle, auch wenn der Katalog zu ist)
  toolGroup(t) {
    if (!t) return null;
    if (t.kind === 'road') return 'roads';
    if (t.kind === 'zone' || t.kind === 'dezone') return 'zones';
    if (t.kind === 'line' || t.kind === 'extend') return groupOfCat('transit');
    if (t.kind === 'place') { const d = BUILDINGS[t.key]; return d ? groupOfCat(d.cat) : null; }
    const tr = TRAY_ITEMS.find((x) => { try { const it = x.item(this.g); return it && it.kind === 'tool' && it.key === t.kind; } catch (e) { return false; } });
    return tr ? groupOfCat(tr.cat) : null;
  }
  markToolButtons() {
    const t = this.app.input ? this.app.input.tool : { kind: 'select' };
    const tg = this.toolGroup(t);
    for (const b of this.el.cats.querySelectorAll('.cat')) {
      if (b.dataset.tool) b.classList.toggle('on', b.dataset.tool === t.kind && !this.cat);
      else { b.classList.toggle('on', b.dataset.group === this.group && !this.el.tray.hidden); b.classList.toggle('using', b.dataset.group === tg && t.kind !== 'select'); }
    }
  }
  updateTrackNav() { /* alte Schnittstelle: die Leiste scrollt nicht mehr */ }

  openGroup(gid) {
    const gr = this.groupById(gid);
    if (!gr) return;
    const vis = this.visCache && this.visCache.get(gid) || this.visibleCats(gr);
    const last = this.groupCat[gid];
    this.openTray(last && vis.includes(last) ? last : vis[0] || gr.cats[0]);
  }
  openTray(cat) {
    if (!cat) return;
    const gid = cat === '__search' ? null : groupOfCat(cat);
    this.cat = cat;
    this.group = gid;
    if (gid) this.groupCat[gid] = cat;
    if (this.seenFresh || freshCats(this).has(cat)) { (this.seenFresh || (this.seenFresh = new Map())).set(cat, this.g.milestone); this.markFresh(); }
    if (cat !== '__search') this.search = '';
    this.hoverItem = null;
    this.closePop();
    const wasHidden = this.el.tray.hidden;
    this.renderTray();
    this.el.tray.hidden = false;
    if (wasHidden) this.el.tray.classList.add('enter');
    this.root.classList.add('tray-open');
    this.el.tutorial.hidden = true;
    if (!this.el.insp.hidden && this.mobile()) this.closeInspector();
    this.markToolButtons();
    this.ob('cat', cat);
  }
  openSearch() {
    this.openTray('__search');
    const inp = document.getElementById('u-search');
    if (inp) { inp.focus(); inp.select(); }
  }
  closeTray() {
    this.cat = null;
    this.group = null;
    this.el.tray.hidden = true;
    this.root.classList.remove('tray-open');
    this.markToolButtons();
    this.refreshTutorial();
  }
  trayItems(cat) { return catalogItems(this, cat); }
  // Baukatalog als Liste im Stil der Vorlage: Reiter oben (aktiv = Lavendel wie der Kopf darunter), Lavendel-Kopf mit
  // Suche und violettem X, darunter weiße und lavendelfarbene Zeilen mit Bild, Name, „Mehr Infos" und orangem Preis-Knopf.
  renderTray() {
    const cat = this.cat;
    if (!cat) return;
    const isSearch = cat === '__search';
    const gr = isSearch ? null : this.groupById(this.group);
    const cm = isSearch ? { name: 'Baukatalog', color: '#5b2fb3', icon: 'search' } : gr ? { name: gr.name, color: gr.color, icon: gr.icon } : catMeta(cat);
    const vis = gr ? (this.visibleCats(gr)) : [];
    if (gr && this.visCache) this.visCache.set(gr.id, vis);
    this.el.tray.style.setProperty('--lc', cm.color);
    const tabs = vis.length > 1 ? `<div class="tr-tabs" role="tablist">${vis.map((c) => { const m = catMeta(c); const lbl = catLabel(c); return `<button class="tr-tab${c === cat ? ' on' : ''}" role="tab" aria-selected="${c === cat}" data-tab="${c}" data-tour="cat-${c}" style="--tc:${m.color}" data-tip="${esc(lbl)}" data-tip-desc="${esc(this.catDesc(c))}" data-tip-fast="1">${iconAny(m.icon, 'layers', 16, 2.4)}<span>${esc(lbl)}</span>${this._isNew && this._isNew(c) ? '<i class="nd"></i>' : ''}</button>`; }).join('')}</div>` : '';
    const title = isSearch ? 'Suche' : vis.length > 1 ? cm.name : catLabel(cat);
    const sub = isSearch ? 'Alle Gebäude und Werkzeuge' : this.catDesc(cat);
    this.el.tray.classList.toggle('has-tabs', !!tabs);
    this.el.tray.innerHTML = `${tabs}<div class="sign tr-card"><div class="tr-head"><span class="tr-badge">${iconAny(cm.icon, 'layers', 18, 2.4)}</span><div class="tr-t"><span class="tr-name">${esc(title)}</span><span class="tr-sub">${esc(sub)}</span></div>
<label class="tr-search" data-tip="Suchen" data-tip-desc="Alle Gebäude und Werkzeuge nach Namen durchsuchen." data-key="F" data-tip-fast="1">${icon('search', 15, 2.6)}<input id="u-search" type="search" placeholder="Suchen …" value="${esc(this.search)}" autocomplete="off" spellcheck="false" aria-label="Gebäude suchen"></label>
<button class="close" data-act="closetray" data-tip="Schließen" data-tip-desc="Baukatalog zuklappen." data-key="Esc" data-tip-fast="1" aria-label="Schließen">${icon('close', 18, 3.2)}</button></div>
<div class="tr-body"><div class="strip list" id="u-strip" role="list"></div></div></div>`;
    this.renderTrayBody();
  }
  catDesc(c) {
    const D = { roads: 'Gassen, Straßen und Alleen.', zones: 'Wohnen, Gewerbe, Industrie und Büro ausweisen.', districts: 'Stadtteile zeichnen und eigene Regeln geben.', power: 'Kraftwerke für Strom. Ohne Strom wächst nichts.', water: 'Wasser und Abwasser für alle Häuser.', garbage: 'Müllabfuhr, Deponien und Recycling.', services: 'Arztpraxen, Krankenhäuser und Friedhöfe.', education: 'Schulen und Hochschulen für gute Jobs.', safety: 'Polizei, Feuerwehr und Katastrophenschutz.', parks: 'Parks und Plätze machen glücklich.', landmarks: 'Besondere Bauten, einmal pro Stadt.', transit: 'Die U-Bahn fährt im Tunnel und nimmt Autos von der Straße.', transport: 'Buslinien, Straßenbahn und Ampeln.', industry: 'Lager, Güterbahnhof und Hafen für Waren.' };
    return D[c] || catMeta(c).name;
  }
  renderTrayBody() {
    const strip = document.getElementById('u-strip');
    if (!strip) return;
    const q = this.search.trim();
    const isSearch = this.cat === '__search' || !!q;
    let list;
    if (q) list = searchCatalog(this, q);
    else if (this.cat === '__search') {
      // ohne Suchbegriff: zuletzt benutzte Einträge
      const all = allCatalogItems(this);
      list = this.recent.map((k) => all.find((it) => itemKey(it) === k)).filter(Boolean);
    } else list = this.trayItems(this.cat);
    this.trayList = list;
    const t = this.app.input ? this.app.input.tool : { kind: 'select' };
    const st = strip.scrollTop;
    strip.innerHTML = list.length ? list.map((it, i) => cardHTML(it, i, isActive(it, t), isSearch, this.moreKey === itemKey(it))).join('') : `<div class="empty strip-empty">${q ? `Nichts gefunden für „${esc(q)}".` : 'Tippe einen Namen, z. B. „Schule", „Park" oder „Strom". Hier erscheint auch, was du zuletzt gebaut hast.'}</div>`;
    strip.scrollTop = st;
    const active = list.find((it) => isActive(it, t));
    if (!this.hoverItem || !list.includes(this.hoverItem)) this.hoverItem = active || list.find((it) => !it.locked) || list[0] || null;
  }
  trayClick(e) {
    if (e.target.closest('[data-act=closetray]')) { this.app.audio.play('close'); this.closeTray(); return; }
    const tab = e.target.closest('[data-tab]');
    if (tab) { this.app.audio.play('tab'); this.moreKey = null; this.openTray(tab.dataset.tab); return; }
    const rowOf = (el) => { const b = el && el.closest('button.item'); return b && this.trayList ? this.trayList[+b.dataset.i] : null; };
    const th = e.target.closest('[data-act=trayhelp]');
    if (th) { const it = rowOf(th) || this.hoverItem; this.openHelpFor(it ? (it.kind === 'place' ? it.key : it.cat) : this.cat); return; }
    // „Mehr Infos" klappt die Zeile auf (Beschreibung, alle Werte), statt zu bauen
    const more = e.target.closest('[data-more]');
    if (more) {
      const it = rowOf(more);
      if (it) { const k = itemKey(it); this.moreKey = this.moreKey === k ? null : k; this.hoverItem = it; this.app.audio.play('tab'); this.renderTrayBody(); }
      return;
    }
    const b = e.target.closest('button.item');
    if (!b || !this.trayList) return;
    const it = this.trayList[+b.dataset.i];
    if (!it) return;
    this.app.audio.play('click');
    this.pickItem(it);
  }
  pickItem(it) {
    if (it.locked) { this.toast(it.built ? 'Gibt es schon in deiner Stadt.' : it.locked, 'bad'); this.app.audio.play('error'); return; }
    const k = itemKey(it);
    if (it.kind !== 'panel') this.recent = [k, ...this.recent.filter((x) => x !== k)].slice(0, 10);
    const input = this.app.input;
    if (it.kind === 'road') input.setTool({ kind: 'road', type: +it.type });
    else if (it.kind === 'zone') input.setTool({ kind: 'zone', zone: +it.zone });
    else if (it.kind === 'dezone') input.setTool({ kind: 'dezone' });
    else if (it.kind === 'place') input.setTool({ kind: 'place', key: it.key });
    else if (it.kind === 'line') input.setTool({ kind: 'line' });
    else if (it.kind === 'panel') { this.closeTray(); this.openPanel(it.panel); return; }
    else if (it.kind === 'tool') input.setTool({ kind: it.key, ...(it.type !== undefined && it.type !== '' ? { type: it.type } : {}), ...(it.tool || {}) });
    if (this.mobile()) this.closeTray();
    else this.renderTrayBody();
  }
  toolChanged(tool) {
    if (tool.kind === 'select' && this.cat && !this.search) this.closeTray();
    if (this.cat) this.renderTrayBody();
    this.markToolButtons();
    if (tool.kind === 'line' && this.view === 'none') this.setView('transit', true);
    if (tool.kind !== 'line' && tool.kind !== 'extend' && this.autoTransitView) this.setView('none');
    this.renderToolHint();
    this.syncUnderground();
    this.ob('tool', tool);
  }

  // Hinweisleiste zum aktiven Werkzeug (auf dem Handy mit Knöpfen statt Rechtsklick)
  renderToolHint() {
    const input = this.app.input;
    const t = input ? input.tool : { kind: 'select' };
    const el = this.el.toolhint;
    if (!t || t.kind === 'select' || this.photo.active) { el.hidden = true; this.root.classList.remove('tool-on'); return; }
    let name = '', hint = '', ic = 'select', col = '#1d2330';
    const extra = [];
    if (t.kind === 'road') { name = ROADS[t.type].name; hint = 'Ziehen zum Bauen'; ic = 'roads'; col = '#5d6470'; }
    else if (t.kind === 'zone') { name = ZONE_INFO[t.zone].name; hint = 'Fläche aufziehen'; ic = 'zones'; col = hex(ZONE_INFO[t.zone].color); }
    else if (t.kind === 'dezone') { name = 'Zonen entfernen'; hint = 'Fläche aufziehen'; ic = 'dezone'; }
    else if (t.kind === 'bulldoze') { name = 'Abriss'; hint = 'Fläche aufziehen'; ic = 'bulldoze'; col = '#d4433a'; }
    else if (t.kind === 'place') {
      const d = BUILDINGS[t.key]; name = d ? d.name : t.key; ic = d ? catMeta(d.cat).icon : 'layers'; col = d ? catMeta(d.cat).color : col;
      hint = `${d ? fmtMoney(this.g.buildingCost(t.key)) : ''}${d && d.size[0] !== d.size[1] ? ' · R dreht' : ''}`;
      if (d && d.size[0] !== d.size[1]) extra.push(['rotate', 'Drehen', 'rotate', 'Gebäude um 90° drehen.']);
    } else if (t.kind === 'line' || t.kind === 'extend') {
      name = t.kind === 'line' ? 'U-Bahn-Linie zeichnen' : 'Linie verlängern'; ic = 'line'; col = '#e8543f';
      hint = `${input.lineStops.length} ${input.lineStops.length === 1 ? 'Station' : 'Stationen'} · Rechtsklick oder Enter beendet`;
      extra.push(['finish', 'Fertig', 'check', 'Linie abschließen und Züge fahren lassen.']);
    } else {
      const T2 = TOOLS[t.kind] || {};
      name = T2.name || (this.trayList && (this.trayList.find((x) => x.kind === 'tool' && x.key === t.kind) || {}).name) || t.kind;
      try { hint = T2.hint ? T2.hint(input) || '' : ''; } catch (e) { hint = ''; }
      ic = T2.icon || 'brush';
    }
    const html = `<span class="th-i" style="background:${col}">${iconAny(ic, 'select', 14, 2.3)}</span><b>${esc(name)}</b>${hint ? `<span class="th-h">${esc(hint)}</span>` : ''}${extra.map(([a, n, ii, d]) => `<button class="th-b" data-th="${a}" data-tip="${n}" data-tip-desc="${d}" data-tip-fast="1">${icon(ii, 14, 2.4)}${n}</button>`).join('')}<button class="th-x" data-th="cancel" data-tip="Abbrechen" data-tip-desc="Werkzeug weglegen und wieder auswählen." data-key="Esc" data-tip-fast="1" aria-label="Werkzeug abbrechen">${icon('close', 14, 2.4)}</button>`;
    if (html !== this._thHtml) { this._thHtml = html; el.innerHTML = html; }
    el.style.setProperty('--tc', col);
    el.hidden = false;
    this.root.classList.add('tool-on');
  }
  toolHintClick(e) {
    const b = e.target.closest('[data-th]');
    if (!b) return;
    const input = this.app.input;
    this.app.audio.play('click');
    if (b.dataset.th === 'cancel') input.setTool({ kind: 'select' });
    else if (b.dataset.th === 'finish') input.finishLine();
    else if (b.dataset.th === 'rotate') { input.rot = (input.rot + 1) % 4; if (input.lastMove) input.pointerMove(input.lastMove); }
  }

  // ---------- Untergrund-Ansicht (V1): an beim Linien-Werkzeug, im U-Bahn-Panel oder per Schalter in den Ansichten
  undergroundAvailable() { const e = this.app.engine; return !!(e && typeof e.setUnderground === 'function'); }
  undergroundOn() { const e = this.app.engine; return this.undergroundAvailable() ? !!e.undergroundActive : this.ugManual; }
  syncUnderground() {
    const e = this.app.engine;
    if (!this.undergroundAvailable()) return;
    const t = this.app.input ? this.app.input.tool : null;
    const want = !!(this.ugManual || (t && (t.kind === 'line' || t.kind === 'extend')) || this.panel === 'transit');
    if (!!e.undergroundActive !== want) { try { e.setUnderground(want); } catch (err) { console.warn('Untergrund', err); } }
    this.root.classList.toggle('ug-on', want);
    this.markViewButton();
  }
  toggleUnderground(v) {
    this.ugManual = v === undefined ? !this.ugManual : !!v;
    if (this.undergroundAvailable()) this.syncUnderground();
    else this.setView(this.ugManual ? 'transit' : (this.view === 'transit' ? 'none' : this.view));
    this.ob('view', this.ugManual ? 'underground' : 'surface');
    this.markViewButton();
  }

  // ---------- Infoansichten
  setView(id, auto = false) {
    this.view = id;
    this.autoTransitView = auto;
    this.app.engine.overlay.setMode(id);
    const def = viewList().find((o) => o.id === id);
    this.root.classList.toggle('view-on', id !== 'none' && !!def);
    this.markViewButton();
    if (this.pop === 'views' || this.pop === 'menu') this.renderPop();
    if (!auto) this.ob('view', id);
    if (id === 'none' || !def) { this.el.legend.hidden = true; return; }
    const bad = def.bad;
    let ramp = `linear-gradient(90deg, ${bad ? '#45c46b, #f2c230, #e5483c' : '#e5483c, #f2c230, #45c46b'})`;
    let ends = id === 'resources' ? ['fruchtbar', 'Erz'] : bad ? ['gering', 'hoch'] : id === 'traffic' ? ['frei', 'Stau'] : ['schlecht', 'gut'];
    if (id === 'traffic') ramp = 'linear-gradient(90deg,#45c46b,#f2c230,#e5483c)';
    let leg = `<div class="ramp" style="background:${ramp}"></div><div class="ends"><span>${ends[0]}</span><span>${ends[1]}</span></div>`;
    let lg = def.legend;
    if (typeof lg === 'function') { try { lg = lg(this.g); } catch (e) { console.warn(e); lg = null; } }
    const items = Array.isArray(lg) ? lg : lg && lg.items;
    if (id === 'resources' && !def.legend) leg = `<div class="litems"><span><i style="background:#78be46"></i>Acker</span><span><i style="background:#2e6b3a"></i>Wald</span><span><i style="background:#966e5a"></i>Erz</span><span><i style="background:#4a4a58"></i>Öl</span></div>`;
    else if (items) leg = `<div class="litems">${items.map(([c, l]) => `<span><i style="background:${typeof c === 'number' ? hex(c) : c}"></i>${esc(l)}</span>`).join('')}</div>`;
    else if (lg && lg.gradient) { leg = `<div class="ramp" style="background:${lg.gradient}"></div><div class="ends"><span>${esc((lg.ends || [])[0] || '')}</span><span>${esc((lg.ends || [])[1] || '')}</span></div>`; }
    else if (id === 'power' || id === 'water') leg = `<div class="litems"><span><i style="background:${id === 'power' ? '#45c46b' : '#3fa0e0'}"></i>versorgt</span><span><i style="background:#e5483c"></i>fehlt</span></div>`;
    this.el.legend.innerHTML = `<h4><span class="lg-i">${iconAny(def.icon, 'layers', 15, 2.2)}</span><span>${esc(def.name)}</span><button class="close" data-act="offview" data-tip="Ansicht schließen" data-tip-desc="Zurück zur normalen Stadt." data-key="V" data-tip-fast="1" aria-label="Ansicht schließen">${icon('close', 14)}</button></h4>${leg}<p>${esc(def.text || '')}</p>`;
    this.el.legend.hidden = false;
    this.el.legend.onclick = (e) => { if (e.target.closest('[data-act=offview]')) { this.app.audio.play('close'); this.setView('none'); } };
  }
  markViewButton() {
    if (!this.el || !this.el.viewsbtn) return;
    const def = this.view !== 'none' ? viewList().find((o) => o.id === this.view) : null;
    const ug = this.undergroundOn();
    this.el.viewsbtn.classList.toggle('on', !!def || ug);
    const lbl = def ? (def.name.length <= 10 ? def.name : 'Ansichten') : ug ? 'Untergrund' : 'Ansichten';
    if (this.el.viewlbl.textContent !== lbl) this.el.viewlbl.textContent = lbl;
  }

  // ---------- Stadt-Panels (fortschreitend: nur, was schon relevant ist)
  panelDef(id) { return PANELS.find((p) => p.id === id) || CORE_PANELS.find((p) => p.id === id) || SYS_PANELS.find((p) => p.id === id) || null; }
  cityPanels(all = false) { return dockPanels(CORE_PANELS).filter(({ p }) => all || this.showAllPanels || panelAvailable(p, this) || this.panel === p.id); }
  // Neu verfügbare Panels einmal kurz ankündigen
  refreshAvail() {
    const ids = this.cityPanels().map(({ p }) => p.id).join(',');
    if (this._availIds && ids !== this._availIds) {
      const before = new Set(this._availIds.split(','));
      const fresh = this.cityPanels().filter(({ p }) => !before.has(p.id));
      if (fresh.length) { this.freshPanels = new Set([...(this.freshPanels || []), ...fresh.map(({ p }) => p.id)]); this.el.citydot.hidden = false; }
    }
    this._availIds = ids;
  }

  // ---------- Aufklappmenüs: Ansichten, Stadt, Stadt-Check, Menü (Handy: Blatt von unten)
  togglePop(kind, anchor) { if (this.pop === kind) this.closePop(); else this.openPop(kind, anchor); }
  openPop(kind, anchor) {
    hideTip();
    this.pop = kind;
    this.popAnchor = anchor || this.root.querySelector(`[data-pop="${kind}"]`);
    if (kind === 'city') this.refreshAvail();
    this.renderPop();
    const el = this.el.popover;
    el.hidden = false;
    el.className = `sign pop pop-${kind}${this.mobile() ? ' sheet' : ''}`;
    el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter');
    this.el.scrim.hidden = !this.mobile();
    this.positionPop();
    for (const b of this.root.querySelectorAll('[data-pop]')) { const on = b.dataset.pop === kind; b.classList.toggle('open', on); b.setAttribute('aria-expanded', on ? 'true' : 'false'); }
    this.ob('pop', kind);
  }
  closePop() {
    if (!this.pop) return;
    this.pop = null;
    this.el.popover.hidden = true;
    this.el.scrim.hidden = true;
    for (const b of this.root.querySelectorAll('[data-pop]')) { b.classList.remove('open'); b.setAttribute('aria-expanded', 'false'); }
  }
  positionPop() {
    const el = this.el.popover, st = el.style, a = this.popAnchor;
    st.left = st.right = st.top = st.bottom = '';
    if (this.mobile() || !a) return;
    const z = this.uiZoom();
    const r = a.getBoundingClientRect();
    const W = window.innerWidth / z, H = window.innerHeight / z;
    const L = r.left / z, R = r.right / z, T = r.top / z, B = r.bottom / z;
    const w = el.offsetWidth;
    const below = T < H / 2;
    if (below) { st.top = Math.round(B + 8) + 'px'; } else { st.bottom = Math.round(H - T + 10) + 'px'; }
    // Dock unten links (Menü, Ansichten, Stadt): links bündig; Kopfzeile rechts (Stadt-Check): rechts bündig
    const alignLeft = (L + R) / 2 < W / 2;
    const x = clamp(alignLeft ? L : R - w, 10, Math.max(10, W - w - 10));
    st.left = Math.round(x) + 'px';
    el.style.setProperty('--ox', `${Math.round(clamp((alignLeft ? L + 24 : R - 24) - x, 0, w))}px`);
    el.style.setProperty('--oy', below ? '0%' : '100%');
    // nie über die Kopfzeile ragen (oben) bzw. über die Werkzeugleiste (unten)
    const tb = this.root.querySelector('.topbar'), bb = this.el.bottom;
    const topLimit = tb ? tb.getBoundingClientRect().bottom / z + 10 : 24;
    const botLimit = bb ? bb.getBoundingClientRect().top / z - 10 : H - 24;
    const maxH = below ? botLimit - B - 8 : T - 10 - topLimit;
    st.maxHeight = Math.max(200, Math.round(maxH)) + 'px';
  }
  renderPop() {
    const k = this.pop;
    if (!k) return;
    let html = '';
    try {
      if (k === 'views') html = this.popViews();
      else if (k === 'city') html = this.popCity();
      else if (k === 'check') html = this.popCheck();
      else if (k === 'menu') html = this.popMenu();
    } catch (e) { console.warn('Menü', e); html = `<p class="empty">${esc(e.message)}</p>`; }
    const sc = this.el.popover.scrollTop;
    this.el.popover.innerHTML = html;
    this.el.popover.scrollTop = sc;
  }
  popHead(title, sub, ic) {
    return `<div class="pop-h">${this.mobile() ? '<div class="sh-grab"></div>' : ''}<span class="pop-hi">${icon(ic, 16, 2.2)}</span><div class="grow"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div><button class="close" data-pa="close" data-tip="Schließen" data-key="Esc" data-tip-fast="1" aria-label="Schließen">${icon('close', 16)}</button></div>`;
  }
  popViewsBody() {
    const list = viewList().filter((o) => o.id !== 'none');
    const ug = this.undergroundOn();
    const groups = VIEW_GROUPS.map((gr) => ({ ...gr, items: list.filter((o) => o.group === gr.id) }));
    const rest = list.filter((o) => !VIEW_GROUPS.some((gr) => gr.id === o.group));
    if (rest.length) { const m = groups.find((gr) => gr.id === 'mehr'); if (m) m.items.push(...rest.filter((o) => !m.items.includes(o))); }
    return `<button class="pop-row ug${ug ? ' on' : ''}" data-pa="underground" data-tour="underground" data-tip="Untergrund" data-tip-desc="Die Oberwelt tritt zurück: Tunnel, Bahnsteige und fahrende U-Bahn-Züge werden sichtbar."><span class="pi" style="--pc:#2f8fe0">${icon('underground', 17, 2.1)}</span><span class="t"><b>Untergrund</b><small>U-Bahn-Tunnel und Züge sehen</small></span><span class="switch${ug ? ' on' : ''}" aria-hidden="true"></span></button>
<div class="pop-cols">${groups.filter((gr) => gr.items.length).map((gr) => `<div class="pop-sec"><h4>${esc(gr.name)}</h4><div class="pop-list">${gr.items.map((o) => `<button class="pop-tile${this.view === o.id ? ' on' : ''}" data-pa="view" data-v="${esc(o.id)}" data-tip="${esc(o.name)}" data-tip-desc="${esc(o.text || '')}">${iconAny(o.icon, 'layers', 16, 2.1)}<span>${esc(o.name)}</span></button>`).join('')}</div></div>`).join('')}</div>
${this.view !== 'none' ? `<button class="pop-foot" data-pa="view" data-v="none" data-tip="Normale Ansicht" data-tip-desc="Farbige Karte ausblenden." data-key="V">${icon('eye', 15)}<span>Normale Ansicht</span><kbd>V</kbd></button>` : ''}`;
  }
  popViews() { return `${this.popHead('Ansichten', 'Farbige Karten über der Stadt', 'layers')}<div class="pop-b">${this.popViewsBody()}</div>`; }
  popCityBody() {
    const list = this.cityPanels();
    const hidden = this.cityPanels(true).length - list.length;
    const groups = PANEL_GROUPS.map((gr) => ({ ...gr, items: list.filter(({ m }) => m.group === gr.id) })).filter((gr) => gr.items.length);
    const row = ({ p, m }) => {
      let v = null;
      if (p.badge) { try { v = p.badge(this); } catch (e) { v = null; } }
      if (p.id === 'news' && this.newsUnread) v = v || 'neu';
      if (this.freshPanels && this.freshPanels.has(p.id)) v = v || 'neu';
      const title = p.id === 'transit' ? 'U-Bahn' : p.title;
      return `<button class="pop-row${this.panel === p.id ? ' on' : ''}" data-pa="panel" data-v="${esc(p.id)}" style="--pc:${m.color}" data-tip="${esc(title)}" data-tip-desc="${esc(m.desc || title)}" ${m.key ? `data-key="${m.key}"` : ''}><span class="pi">${iconAny(p.icon, 'layers', 17, 2.1)}</span><span class="t"><b>${esc(title)}</b>${m.desc ? `<small>${esc(m.desc)}</small>` : ''}</span>${v !== null && v !== undefined && v !== 0 && v !== '' ? `<span class="pb">${esc(v)}</span>` : ''}</button>`;
    };
    return `<div class="pop-cols">${groups.map((gr) => `<div class="pop-sec"><h4>${esc(gr.name)}</h4>${gr.items.map(row).join('')}</div>`).join('')}</div>${hidden > 0 ? `<p class="pop-note">${icon('lock', 13, 2.2)}<span>${hidden === 1 ? 'Ein weiterer Bereich kommt' : `${hidden} weitere Bereiche kommen`} dazu, wenn die Stadt wächst.</span><button class="pop-more" data-pa="allpanels" data-tip="Alle zeigen" data-tip-desc="Auch Bereiche zeigen, die erst später wichtig werden.">Alle zeigen</button></p>` : ''}`;
  }
  popCity() { return `${this.popHead('Stadt', 'Verwaltung, Zahlen und Pläne', 'city')}<div class="pop-b">${this.popCityBody()}</div>`; }
  popCheck() {
    const probs = problems(this.g);
    const lvl = adviceLevel(this.advisor);
    const how = (p) => p.panel ? 'Öffnet das passende Fenster' : p.view && p.cat ? 'Zeigt, wo es hakt, und passende Gebäude' : p.view ? 'Zeigt auf der Karte, wo es hakt' : p.cat ? 'Öffnet passende Gebäude' : '';
    const body = probs.length
      ? probs.map((p) => `<button class="pop-row prob ${p.sev}" data-pa="prob" data-v="${esc(p.id)}" data-tip="${esc(p.text)}" data-tip-desc="${esc(how(p))}."><span class="pi">${icon(p.icon, 16, 2.3)}</span><span class="t"><b>${esc(p.text)}</b><small>${esc(how(p))}</small></span><span class="go">${icon('arrowR', 15, 2.4)}</span></button>`).join('')
      : `<div class="allgood">${icon('check', 18, 2.6)}<span><b>Alles im grünen Bereich.</b><small>Strom, Wasser, Müll, Geld und Verkehr laufen.</small></span></div>`;
    return `${this.popHead('Stadt-Check', probs.length ? 'Was gerade Aufmerksamkeit braucht' : 'Deine Stadt läuft rund', 'pulse')}<div class="pop-b">${body}
<button class="pop-foot" data-pa="advisor" data-tip="Ratgeberin" data-tip-desc="Lagebericht und Tipps, was als Nächstes sinnvoll ist." data-key="H">${icon('advisor', 15)}<span>Ratgeberin fragen</span>${lvl >= 2 ? '<i class="pdot"></i>' : ''}<kbd>H</kbd></button></div>`;
  }
  popMenu() {
    const mm = !this.el.mini.hidden && (!this.mobile() || this.el.mini.classList.contains('force'));
    const item = (pa, ic, n, d, key = '', extra = '') => `<button class="pop-row slim" data-pa="${pa}" data-tip="${esc(n)}" data-tip-desc="${esc(d)}" ${key ? `data-key="${key}"` : ''}><span class="pi">${icon(ic, 16, 2.1)}</span><span class="t"><b>${esc(n)}</b></span>${extra}${key ? `<kbd>${key}</kbd>` : ''}</button>`;
    const game = `<div class="pop-sec">${this.mobile() ? '<h4>Spiel</h4>' : ''}
${item('save', 'save', 'Schnell speichern', 'Spielstand in Platz 1 sichern.', 'Strg+S')}
${item('slots', 'download', 'Spielstände', 'Speichern, Laden und als Datei sichern.')}
${item('settings', 'settings', 'Optionen', 'Grafik, Klang und Bedienung einstellen.')}
${item('help', 'help', 'Hilfe', 'So funktioniert\'s – kurz erklärt.', 'F1')}
${item('keys', 'keyboard', 'Tastenkürzel', 'Alle Tasten auf einen Blick.', '?')}
</div><div class="pop-sec">
${item('photo', 'camera', 'Fotomodus', 'Oberfläche ausblenden, Kamera frei bewegen, Bild speichern.', 'P')}
${item('mini', 'minimap', 'Minikarte', 'Übersichtskarte der Stadt ein- oder ausblenden.', 'K', `<span class="switch${mm ? ' on' : ''}" aria-hidden="true"></span>`)}
${this.mobile() ? '' : item('hud', 'eyeOff', 'Oberfläche ausblenden', 'Nur die Stadt zeigen. U blendet alles wieder ein.', 'U')}
</div><div class="pop-sec">${item('tomenu', 'menu', 'Zum Hauptmenü', 'Das Spiel wird vorher automatisch gesichert.')}</div>`;
    if (!this.mobile()) return `${this.popHead('Menü', 'Spiel, Optionen, Fotomodus', 'menu')}<div class="pop-b">${game}</div>`;
    // Handy: ein Blatt mit allem, was auf dem Desktop an den Rändern sitzt
    return `${this.popHead('Menü', 'Stadt, Ansichten und Spiel', 'menu')}<div class="pop-b">
<div class="pop-sec"><h4>Stadt</h4><div class="pop-grid city">${this.cityPanels().map(({ p, m }) => `<button class="pop-tile${this.panel === p.id ? ' on' : ''}" data-pa="panel" data-v="${esc(p.id)}" style="--pc:${m.color}">${iconAny(p.icon, 'layers', 18, 2.1)}<span>${esc(p.id === 'transit' ? 'U-Bahn' : p.short || (p.title.length > 14 ? p.title.split(' & ')[0] : p.title))}</span></button>`).join('')}</div></div>
<div class="pop-sec"><h4>Ansichten</h4>${this.popViewsBody()}</div>${game}</div>`;
  }
  popClick(e) {
    const b = e.target.closest('[data-pa]');
    if (!b) return;
    const a = b.dataset.pa, v = b.dataset.v;
    this.app.audio.play(a === 'close' ? 'close' : a === 'underground' || a === 'mini' ? 'toggle' : 'click');
    switch (a) {
      case 'close': this.closePop(); return;
      case 'view': this.setView(this.view === v ? 'none' : v); if (this.mobile()) this.closePop(); return;
      case 'underground': this.toggleUnderground(); this.renderPop(); return;
      case 'panel': this.closePop(); if (this.freshPanels) this.freshPanels.delete(v); this.openPanel(v); this.refreshBadges(); return;
      case 'prob': { const p = problems(this.g).find((x) => x.id === v); this.closePop(); if (p) this.runAction(p); return; }
      case 'advisor': this.closePop(); this.openPanel('advisor'); return;
      case 'allpanels': this.showAllPanels = true; this.renderPop(); return;
      case 'save': this.closePop(); if (this.app.save(1) !== false) this.toast('Gespeichert in Platz 1.', 'good'); return;
      case 'slots': this.closePop(); this.setTab = 'spiel'; this.openPanel('settings'); return;
      case 'settings': this.closePop(); if (this.setTab === 'spiel' || this.setTab === 'hilfe') this.setTab = 'grafik'; this.openPanel('settings'); return;
      case 'help': this.openHelp(); return;
      case 'keys': this.closePop(); this.showKeys(); return;
      case 'photo': this.closePop(); this.photo.enter(); return;
      case 'mini': this.toggleMinimap(); this.renderPop(); return;
      case 'hud': this.closePop(); this.toggleHud(true); return;
      case 'tomenu': this.closePop(); this.app.toMenu(); return;
    }
  }

  // ---------- Spotlight-Ziele für die Einführung (V2): liefert das sichtbare Element oder null
  tourTarget(id) {
    if (!id || this.root.hidden) return null;
    const vis = (el) => (el && el.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' ? el : null);
    const q = (sel) => this.root.querySelector(sel);
    const sel = (t) => `[data-tour="${CSS.escape(t)}"]`;
    try {
      // Handy: Ansichten, Stadt und Hilfe stecken im Menü ☰ (links im Dock)
      if ((id === 'views' || id === 'city' || id === 'help') && this.mobile()) return vis(this.el.menubtn);
      if (id === 'group-roads' || id === 'group-zones' || id.startsWith('group-')) {
        const b = q(`.toolbar [data-group="${CSS.escape(id.slice(6))}"]`);
        return vis(b);
      }
      if (id.startsWith('cat-') && id !== 'cat-bulldoze') {
        const c = id.slice(4);
        const direct = vis(q(`.toolbar ${sel(id)}`));
        if (direct) return direct;
        const gid = groupOfCat(c);
        const gr = this.groupById(gid);
        if (!gr || !this.visibleCats(gr).includes(c)) return null;
        if (this.group !== gid || this.el.tray.hidden) this.openGroup(gid);
        return vis(q(`.tray ${sel(id)}`));
      }
      if (id.startsWith('item-')) {
        const key = id.slice(5);
        let el = vis(q(`.tray ${sel(id)}`));
        if (!el) {
          for (const gr of this.groups) {
            for (const c of this.visibleCats(gr)) {
              let items = [];
              try { items = catalogItems(this, c); } catch (e) { items = []; }
              if (items.some((it) => tourKey(it) === key)) { this.openTray(c); el = vis(q(`.tray ${sel(id)}`)); break; }
            }
            if (el) break;
          }
        }
        if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        return el;
      }
      if (id === 'tray') return vis(this.el.tray);
      if (id === 'menu') return vis(this.el.menubtn);
      return vis(q(sel(id)));
    } catch (e) { console.warn('tourTarget', id, e); return null; }
  }

  // ---------- Hilfe zu einer Kategorie, einem Gebäude oder Begriff
  helpFor(hint) {
    let topics = [];
    try { topics = this.helpTopics() || []; } catch (e) { topics = []; }
    if (!topics.length || !hint) return null;
    const d = BUILDINGS[hint];
    const cands = [hint, ...(HELP_HINTS[hint] || []), ...(d ? HELP_HINTS[d.cat] || [d.cat] : [])];
    for (const c of cands) {
      const t = topics.find((x) => x.id === c) || topics.find((x) => String(x.id).includes(c));
      if (t) return t.id;
    }
    return null;
  }
  openHelpFor(hint) { this.openHelp(this.helpFor(hint) || undefined); }

  // ---------- Erste Schritte (alte Karte – entfällt, sobald die geführte Einführung sie ersetzt)
  refreshTutorial() {
    const g = this.g;
    const ob = this.onboarding;
    let obActive = false;
    try { obActive = !!(ob && (ob.replacesTutorial || (typeof ob.active === 'function' && ob.active()))); } catch (e) { obActive = false; }
    this.root.classList.toggle('tour-on', !!(ob && (() => { try { return ob.active(); } catch (e) { return false; } })()));
    // Im Metro-Modus baut sich die Stadt selbst – dort passt die Einstiegsliste nicht
    if (obActive || this.tutorialHidden || g.sandbox || (g.opts && g.opts.scenario === 'metro') || this.cat || this.panel || this.photo.active || this.mobile()) { this.el.tutorial.hidden = true; return; }
    const steps = tutorialSteps(g, this);
    const firstOpen = steps.findIndex((s) => !s[0]);
    if (firstOpen < 0) { this.el.tutorial.hidden = true; return; }
    const done = steps.filter((s) => s[0]).length;
    const open = !!this.tutOpen;
    const cur = steps[firstOpen];
    const line = `<div class="tline">${steps.map((s, i) => `<i class="${s[0] ? 'done' : i === firstOpen ? 'now' : ''}" data-tip="${esc(s[1])}" data-tip-fast="1"></i>`).join('')}</div>`;
    const body = open
      ? `<ol>${steps.map((s, i) => `<li class="${s[0] ? 'done' : i === firstOpen ? 'now' : ''}" ${s[2] && !s[0] ? `data-step="${i}"` : ''}>${esc(s[1])}</li>`).join('')}</ol>`
      : `<div class="tnow" ${cur[2] ? `data-step="${firstOpen}"` : ''}><span class="tn num">${firstOpen + 1}</span><span class="tt">${esc(cur[1])}</span>${cur[2] ? `<span class="tgo">${icon('arrowR', 14, 2.4)}</span>` : ''}</div>`;
    const html = `<h4><span>Erste Schritte</span><span class="tprog num">${done} / ${steps.length}</span><button class="close" data-act="tuttoggle" data-tip="${open ? 'Weniger zeigen' : 'Alle Schritte'}" data-tip-desc="${open ? 'Nur den nächsten Schritt zeigen.' : 'Die ganze Liste aufklappen.'}" data-tip-fast="1" aria-label="Aufklappen">${icon(open ? 'chevronD' : 'chevronU', 15)}</button><button class="close" data-act="hidetut" data-tip="Ausblenden" data-tip-desc="Die Liste lässt sich in den Optionen wieder einschalten." data-tip-fast="1" aria-label="Ausblenden">${icon('close', 15)}</button></h4>${line}${body}`;
    if (html !== this._tutHtml) { this._tutHtml = html; this.el.tutorial.innerHTML = html; }
    this.el.tutorial.hidden = false;
  }

  // ---------- Aktionen (Ratgeber, Lage, Tutorial)
  runAction(a) {
    if (!a) return;
    if (a.where) this.focusTile(a.where.x, a.where.y, 22);
    if (a.view) this.setView(a.view);
    if (a.panel) this.openPanel(a.panel);
    else if (a.cat && !a.tool) { this.closePanels(); this.openTray(a.cat); }
    if (a.tool) {
      if (a.cat) { this.closePanels(); this.openTray(a.cat); }
      const t = a.tool;
      if (t.kind === 'line' && !this.g.isUnlocked('transit')) return;
      this.app.input.setTool({ ...t });
    }
  }
  focusTile(x, y, dist) {
    const g = this.g, rig = this.app.engine.rig;
    rig.focus(x + 0.5 - g.W / 2, y + 0.5 - g.H / 2, dist ? Math.min(rig.goal.dist, dist) : Math.min(rig.goal.dist, 28));
  }
  notify(n) { return this.notes.push(n); }

  // ---------- Nachrichten (kein Laufband mehr: Wichtiges kommt als Meldung, Stadtgespräch steht im Stadtfunk)
  onNews(n) {
    if (this.panel !== 'news') this.newsUnread = true; else this.renderPanel();
    if (n.kind !== 'chatter') this.notes.fromNews(n);
    if (n.kind !== 'chatter' && n.kind !== 'report' && n.kind !== 'card') {
      const where = n.x !== undefined && n.y !== undefined ? { x: n.x, y: n.y } : null;
      this.toast(n.text, n.mood === 'bad' ? 'bad' : n.mood === 'good' ? 'good' : '', { where });
    }
  }

  // ---------- Tooltip am Zeiger, Toasts
  tooltip(text, mouse, ok = true) {
    if (!text || !mouse) { this.tip.hidden = true; return; }
    this.tip.hidden = false;
    if (this.tip.textContent !== text) this.tip.textContent = text;
    this.tip.className = ok ? '' : 'bad';
    const w = this.tip.offsetWidth;
    const x = Math.min(mouse.x, window.innerWidth - w - 24);
    this.tip.style.left = x + 'px';
    this.tip.style.top = Math.min(mouse.y, window.innerHeight - 60) + 'px';
  }
  toast(msg, type = '', opts = {}) {
    if (this._muteToast && / geladen\.$/.test(msg)) { this._muteToast = false; return; }
    // Dieselbe Meldung steht schon da: nur auffrischen statt stapeln
    // Kurzform und ausführliche Meldung zum selben Ereignis („Tornado!" / „Tornado! Ein Wirbelsturm …") nur einmal zeigen
    for (const t of [...this.toasts.children]) {
      if (!t._msg || t._msg === msg || t.classList.contains('out')) continue;
      if (t._msg.startsWith(msg)) return;
      if (msg.startsWith(t._msg)) t.remove();
    }
    for (const t of this.toasts.children) {
      if (t._msg === msg && !t.classList.contains('out')) { clearTimeout(t._t); t._t = setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, opts.where ? 5200 : 3400); return; }
    }
    if (type === 'bad') this._badToastAt = performance.now();
    const d = document.createElement('div');
    d._msg = msg;
    d.className = 'toast ' + type + (opts.where ? ' link' : '');
    const ic = opts.icon || (type === 'bad' ? 'warn' : type === 'good' ? 'check' : 'info');
    d.innerHTML = `<span class="ti">${icon(ic, 14, 2.4)}</span><span class="tt"></span>${opts.where ? `<span class="tg">${icon('pin', 14, 2.2)}</span>` : ''}`;
    d.querySelector('.tt').textContent = msg;
    if (opts.where) d.addEventListener('click', () => { this.focusTile(opts.where.x, opts.where.y, 20); d.remove(); });
    this.toasts.appendChild(d);
    // Höchstens zwei Meldungen gleichzeitig (Handy: eine) – alles andere steht unter der Glocke
    while (this.toasts.children.length > (this.mobile() ? 1 : 2)) this.toasts.firstChild.remove();
    d._t = setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 300); }, opts.where ? 5200 : 3400);
  }
  floatMoney(amount, mouse) {
    if (!mouse || !amount || this.g.sandbox) return;
    const d = document.createElement('div');
    d.className = 'float-money' + (amount > 0 ? ' pos' : '');
    d.textContent = (amount > 0 ? '+' : '−') + fmtMoney(Math.abs(amount)).replace('−', '');
    d.style.left = mouse.x + 12 + 'px';
    d.style.top = mouse.y - 10 + 'px';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 1300);
  }

  // ---------- Panels
  togglePanel(name) { if (this.panel === name) { this.app.audio.play('close'); this.closePanels(); } else { this.app.audio.play('open'); this.openPanel(name); } }
  openPanel(name) {
    const def = this.panelDef(name);
    if (!def) return;
    const changed = this.panel !== name;
    this.panel = name;
    this.markPanelButtons();
    if (name === 'news') this.newsUnread = false;
    this.el.panel.hidden = false;
    this.el.insp.hidden = true;
    this.sel = null;
    this.app.engine.overlay.select(null);
    this.closePop();
    if (this.mobile()) this.closeTray();
    if (changed) { this.el.panel.classList.remove('enter'); void this.el.panel.offsetWidth; this.el.panel.classList.add('enter'); this.panelScroll = 0; }
    if (def.opened) def.opened(this);
    this.renderPanel(changed);
    this.refreshTutorial();
    this.syncUnderground();
    if (changed) this.ob('panel', name);
  }
  closePanels() {
    this.panel = null;
    this.el.panel.hidden = true;
    this.markPanelButtons();
    this.closeInspector();
    this.refreshTutorial();
    this.syncUnderground();
  }
  markPanelButtons() {
    for (const b of this.root.querySelectorAll('#u-sys button[data-sys]')) b.classList.toggle('on', b.dataset.sys === this.panel);
    const isCity = !!this.panel && this.cityPanels(true).some(({ p }) => p.id === this.panel);
    if (this.el.citybtn) this.el.citybtn.classList.toggle('on', isCity);
    if (this.el.check) this.el.check.classList.toggle('on', this.panel === 'advisor');
    if (this.el.menubtn) this.el.menubtn.classList.toggle('on', this.panel === 'settings');
  }
  setCtx() {
    if (!this._setCtx) this._setCtx = { app: this.app, inGame: true, ui: this, tab: this.setTab, snap: this.gfxSnap, onTips: (v) => setTipsEnabled(v) };
    this._setCtx.tab = this.setTab;
    // Verweise auf Einstellungen in Panels anderer Module (z. B. Katastrophen im Wetter-Panel)
    this._setCtx.extraPanels = PANELS.filter((p) => p.id === 'weather').map((p) => [p.id, 'Katastrophen & Wetter']);
    return this._setCtx;
  }

  renderPanel(fresh = false) {
    if (!this.panel) return;
    const def = this.panelDef(this.panel);
    if (!def) { this.closePanels(); return; }
    let body = '';
    try { body = def.render(this); } catch (e) { console.error('Panel', this.panel, e); body = `<p class="empty">Fehler im Panel: ${esc(e.message)}</p>`; }
    const old = this.el.panel.querySelector('.body');
    const scroll = fresh ? 0 : old ? old.scrollTop : 0;
    const meta = dockPanels(CORE_PANELS).find((x) => x.p.id === def.id);
    const m = def.color || (meta ? meta.m.color : '') || '#1d2330';
    const desc = meta ? meta.m.desc : def.desc || '';
    const title = def.id === 'transit' ? 'U-Bahn' : def.title;
    const help = this.helpFor(def.id === 'transit' ? 'transit' : def.id === 'budget' ? 'money' : def.id);
    const headHtml = `<header style="--pc:${m}"><span class="ph-badge">${iconAny(def.icon, 'layers', 16, 2.2)}</span><div class="ph-t"><h2>${esc(title)}</h2>${desc ? `<small>${esc(desc)}</small>` : ''}</div>${help ? `<button class="close" data-act="panelhelp" data-v="${esc(help)}" data-tip="Was ist das?" data-tip-desc="Kurz erklärt in der Hilfe." data-tip-fast="1" aria-label="Hilfe">${icon('help', 17)}</button>` : ''}<button class="close" data-act="close" data-tip="Schließen" data-key="Esc" data-tip-fast="1" aria-label="Schließen">${icon('close', 18)}</button></header>`;
    if (!old || this._panelHead !== headHtml) {
      this._panelHead = headHtml;
      this.el.panel.innerHTML = `${headHtml}<div class="body">${body}</div>`;
    } else if (this._panelBody !== body) old.innerHTML = body;
    this._panelBody = body;
    const nb = this.el.panel.querySelector('.body');
    if (nb) nb.scrollTop = scroll;
    if (def.afterRender) { try { def.afterRender(this); } catch (e) { console.error(e); } }
  }
  panelClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    this.app.audio.play(act === 'close' ? 'close' : b.classList.contains('switch') ? 'toggle' : act === 'settab' || b.closest('.tabs, .chart-tabs, .filt') ? 'tab' : 'click');
    if (act === 'close') { this.closePanels(); return; }
    if (act === 'panelhelp') { this.openHelp(b.dataset.v); return; }
    const def = this.panelDef(this.panel);
    if (!def) return;
    let again = true;
    if (def.click) { try { again = def.click(this, act, b) !== false; } catch (err) { console.error(err); } }
    if (again && this.panel) { this._panelBody = null; this.renderPanel(); }
    this.refreshHUD();
  }
  panelEvent(e, kind) {
    const def = this.panelDef(this.panel);
    if (def && def[kind]) { try { def[kind](this, e.target, e); } catch (err) { console.error(err); } }
  }

  // ---------- Inspektor
  inspect(sel) {
    if (!sel) { this.closeInspector(); return; }
    const fresh = !this.sel || this.sel.type !== sel.type || this.sel.id !== sel.id || this.sel.i !== sel.i;
    this.sel = sel;
    this.closePop();
    if (this.mobile()) { this.closeTray(); if (this.panel) this.closePanels(); this.sel = sel; }
    this._inspHead = null;
    this.renderInspector();
    if (fresh) { this.el.insp.classList.remove('enter'); void this.el.insp.offsetWidth; this.el.insp.classList.add('enter'); }
  }
  selectedBox() {
    const s = this.sel, g = this.g;
    if (!s) return null;
    if (s.type === 'building') {
      const b = g.buildings.get(s.id);
      return b ? { x: b.x, y: b.y, w: b.w, h: b.h, height: this.app.input.buildingHeight(b) } : null;
    }
    if (s.type === 'station') {
      const st = g.transit.stations.get(s.id);
      return st ? { x: st.x, y: st.y, w: 1, h: 1, station: true } : null;
    }
    if (s.type === 'road' || s.type === 'tile') return { x: s.i % g.W, y: Math.floor(s.i / g.W), w: 1, h: 1, flat: true };
    return null;
  }
  closeInspector() {
    this.sel = null;
    this.el.insp.hidden = true;
    this.app.engine.overlay.select(null);
  }
  renderInspector() {
    if (!this.sel) return;
    const html = inspectorHTML(this);
    if (html === null) { this.closeInspector(); return; }
    const k = html.indexOf('<div class="body">');
    const headH = k >= 0 ? html.slice(0, k) : html;
    const bodyH = k >= 0 ? html.slice(k + 18, html.lastIndexOf('</div>')) : '';
    const body = this.el.insp.querySelector('.body');
    if (this._inspHead === headH && body) { if (this._inspBody !== bodyH) body.innerHTML = bodyH; }
    else { this.el.insp.innerHTML = html; }
    this._inspHead = headH; this._inspBody = bodyH;
    this.el.insp.hidden = false;
    const box = this.selectedBox();
    this.app.engine.overlay.select(box && !box.flat ? box : null);
  }

  // ---------- Minikarte, Oberfläche ausblenden
  toggleMinimap(v, silent = false) {
    if (v === undefined) v = this.el.mini.hidden || (this.mobile() && !this.el.mini.classList.contains('force'));
    this.el.mini.classList.toggle('force', v && this.mobile());
    this.minimap.setVisible(v);
    this.el.mmopen.hidden = v || this.mobile();
    this.root.classList.toggle('mm-off', !v);
    if (!silent) { this.app.settings.minimapOpen = v; this.app.saveSettings(); }
  }
  toggleHud(v) {
    this.hudHidden = v === undefined ? !this.hudHidden : v;
    this.root.classList.toggle('hud-hidden', this.hudHidden);
    if (this.hudHidden) this.toast('Oberfläche ausgeblendet · U zeigt sie wieder');
  }
  // alte Schnittstelle (Übersicht auf dem Handy) – jetzt das Menü
  toggleSheet() { this.togglePop('menu', this.el.menubtn); }
  closeSheet() { if (this.pop === 'menu') this.closePop(); }

  // ---------- Tastatur
  key(e) {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (this.photo.active) { if (this.photo.key(e)) { e.preventDefault(); e.stopImmediatePropagation(); } return; }
    if (this.modalOpen()) {
      if (e.code === 'Escape') {
        const top = this.modalRoot.lastElementChild;
        const ok = top && top.querySelector('[data-act=ok]');
        if (top && top.querySelector('.keysheet')) this.closeTopModal();
        else if (ok && !top.querySelector('[data-card], [data-opt], [data-act=menu], [data-act=rescue]')) ok.click();
      }
      return;
    }
    if (e.code === 'Escape' && this.pop) { e.preventDefault(); e.stopImmediatePropagation(); this.closePop(); return; }
    const k = (e.key || '').toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.code === 'Space') { e.preventDefault(); this.setSpeed(this.g.speed === 0 ? (this.lastSpeed || 1) : 0); }
    else if (e.code === 'Digit1' || e.code === 'Numpad1') this.setSpeed(1);
    else if (e.code === 'Digit2' || e.code === 'Numpad2') this.setSpeed(2);
    else if (e.code === 'Digit3' || e.code === 'Numpad3') this.setSpeed(3);
    else if (ctrl && e.code === 'KeyS') { e.preventDefault(); if (this.app.save(1) !== false) this.toast('Gespeichert in Platz 1.', 'good'); }
    else if (ctrl) return;
    else if (e.code === 'F1') { e.preventDefault(); this.openHelp(); }
    else if (e.key === '?') { e.preventDefault(); this.showKeys(); }
    else if (k === 'm') { this.app.settings.muted = !this.app.settings.muted; this.app.audio.applyVolumes(); this.app.saveSettings(); this.toast(this.app.settings.muted ? 'Ton aus' : 'Ton an'); }
    else if (k === 'i') { this.app.engine.effects.showIcons = !this.app.engine.effects.showIcons; this.toast(this.app.engine.effects.showIcons ? 'Problem-Symbole an' : 'Problem-Symbole aus'); }
    else if (k === 'p') { this.closePop(); this.photo.enter(); }
    else if (k === 'u') this.toggleHud();
    else if (k === 'n') this.togglePanel('notes');
    else if (k === 'h') this.togglePop('check', this.el.check);
    else if (k === 'k') this.toggleMinimap();
    else if (k === 'v') this.setView('none');
    else if (k === 'f') { e.preventDefault(); this.openSearch(); }
    else if (k === 'g') { if (this.group === 'roads') this.closeTray(); else this.openGroup('roads'); }
    else if (k === 'z') { if (this.group === 'zones') this.closeTray(); else this.openGroup('zones'); }
    else if (k === 'l') { if (this.g.isUnlocked('transit')) this.app.input.setTool({ kind: 'line' }); else this.toast(this.g.lockReason('station') || 'Noch nicht freigeschaltet.', 'bad'); }
    else if (e.code === 'Escape' && this.hudHidden) this.toggleHud(false);
  }

  // ---------- Modale
  modalOpen() { return this.modalRoot.children.length > 0; }
  queueModal(fn) {
    this.modalQueue.push(fn);
    if (!this.modalOpen()) this.nextModal();
  }
  nextModal() {
    const fn = this.modalQueue.shift();
    if (fn) fn();
  }
  openModal(html, onClick) {
    hideTip();
    this.closePop();
    const wrap = document.createElement('div');
    wrap.className = 'backdrop enter';
    wrap.innerHTML = html;
    this.modalRoot.appendChild(wrap);
    const close = () => { wrap.classList.add('out'); setTimeout(() => { wrap.remove(); this.nextModal(); }, 180); };
    wrap.addEventListener('click', (e) => onClick(e, close));
    wrap._close = close;
    return wrap;
  }
  closeTopModal() { const w = this.modalRoot.lastElementChild; if (w && w._close) w._close(); }
  showKeys() {
    if (this.modalRoot.querySelector('.keysheet')) return;
    this.openModal(keysHTML(), (e, close) => { if (e.target.closest('[data-act=ok]') || e.target.classList.contains('backdrop')) close(); });
  }

  showMilestone(i) {
    const m = MILESTONES[i];
    this.app.audio.play('milestone');
    const unlocks = [];
    for (const [, d] of Object.entries(BUILDINGS)) if (!d.landmark && d.unlock === i) unlocks.push([catMeta(d.cat).icon, d.name, catMeta(d.cat).color]);
    if (i === 2) unlocks.unshift(['zones', 'Büro-Zone', '#9466d2'], ['roads', 'Alleen', '#5d6470'], ['transit', 'U-Bahn (2 Linien)', '#e8543f'], ['budget', 'Kredite', '#c98a0c']);
    if (i >= 3 && i <= 5) unlocks.push(['line', '+1 U-Bahn-Linie', '#e8543f']);
    const lvl = [0, 0, 3, 4, 5][i];
    if (lvl) unlocks.push(['house', `Gebäude bis Stufe ${lvl}`, '#4fae67']);
    for (const [, d] of Object.entries(BUILDINGS)) if (d.landmark && d.unlock + 1 === i) unlocks.push(['landmarks', `Wahrzeichen: ${d.name}`, '#c06a2b']);
    this.refreshTutorial();
    if (unlocks.length) setTimeout(() => this.app.audio.play('unlock'), 800);
    const prevName = MILESTONES[i - 1] ? MILESTONES[i - 1].name : '';
    this.openModal(`<div class="modal milestone"><div class="ms-line">${MILESTONES.map((x, k) => `<i class="${k < i ? 'past' : k === i ? 'now' : ''}" data-tip="${esc(x.name)}"></i>`).join('')}</div><div class="eyebrow">Meilenstein erreicht${prevName ? ' · nach ' + esc(prevName) : ''}</div><div class="ms-title">${esc(m.name)}</div><p>${fmt(m.pop)} Menschen nennen ${esc(this.g.name)} jetzt ihr Zuhause.${m.reward && !this.g.sandbox ? ` Das Land gratuliert mit <b>${fmtMoney(m.reward)}</b>.` : ''}</p>${unlocks.length ? `<div class="unlocks"><div class="eyebrow">Neu freigeschaltet</div><div class="ul">${unlocks.map(([ic, n, c]) => `<span style="--c:${c}">${icon(ic, 15, 2.2)}${esc(n)}</span>`).join('')}</div></div>` : ''}<div class="acts" style="justify-content:center"><button class="btn big" data-act="ok">Weiter bauen</button></div></div>`, (e, close) => { if (e.target.closest('[data-act=ok]')) close(); });
  }

  showCards(ids) {
    const g = this.g;
    this.app.audio.play('card');
    const cards = ids.map((id) => cardById(g, id)).filter(Boolean);
    const html = `<div class="cards-wrap"><div class="head"><div class="eyebrow" style="color:#c9cdd8">Woche ${g.week()}</div><h2>Wähle deine Wochenkarte</h2><p>Eine von drei – die anderen verfallen.</p></div>
<div class="cards">${cards.map((c, k) => `<button class="ticket" data-card="${esc(c.id)}" style="--d:${k * 70}ms"><div class="band" style="background:${c.color}"><span class="tag">${esc(c.tag)}</span><span class="no">Nr. ${String(g.week()).padStart(3, '0')}-${k + 1}</span></div><div class="perf"></div><div class="bd"><div class="nm">${esc(c.name)}</div><div class="ds">${esc(c.text(g))}</div><div class="go">Diese nehmen ${icon('arrowR', 15, 2.4)}</div></div><span class="stamp" style="color:${c.color}">STADT<br>PULS</span></button>`).join('')}</div></div>`;
    this.openModal(html, (e, close) => {
      const t = e.target.closest('[data-card]');
      if (!t) return;
      g.chooseCard(t.dataset.card);
      this.app.audio.play('money');
      close();
      if (this.cat) this.renderTray();
      this.refreshHUD();
    });
  }

  showEvent(ev) {
    const g = this.g;
    const html = `<div class="paper-news"><div class="mast"><b>${esc(g.name)}er Anzeiger</b><span>${g.dateText()}</span></div><h2>${esc(ev.title)}</h2><p>${esc(ev.text)}</p>${ev.options.map((o, i) => `<button class="choice" data-opt="${i}"><b>${esc(o.label)}</b><span>${esc(o.hint(g))}</span></button>`).join('')}</div>`;
    this.openModal(html, (e, close) => {
      const t = e.target.closest('[data-opt]');
      if (!t) return;
      g.resolveEvent(+t.dataset.opt);
      this.app.audio.play('click');
      close();
      this.refreshHUD();
    });
  }

  showBankrupt() {
    const g = this.g;
    g.gameOver = true;
    this.openModal(`<div class="modal"><div class="eyebrow">Zahlungsunfähig</div><h2>${esc(g.name)} ist pleite</h2><p>Die Stadtkasse war zehn Tage lang tief im Minus. Das Land übernimmt die Verwaltung.</p><div class="acts"><button class="btn ghost" data-act="menu">Hauptmenü</button><button class="btn" data-act="rescue">Mit Rettungspaket weiterspielen</button></div></div>`, (e, close) => {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      if (t.dataset.act === 'menu') { close(); this.app.toMenu(); return; }
      g.gameOver = false;
      g.money = 30000;
      g.debtDays = 0;
      g.addEffect('happy', -6, 7, 'Rettungspaket');
      g.news('money', 'Das Land hat ein Rettungspaket über 30.000 € geschnürt – unter strengen Auflagen.', 'info');
      close();
    });
  }

  // ---------- Neustart der Ansicht (Grafik-Einstellungen) und Laden mit Ladebildschirm
  withLoader(title, fn) {
    showLoader(title, 'Einen Moment …');
    painted().then(() => { try { fn(); } catch (e) { console.error(e); hideLoader(); } });
  }
  restartView() {
    const app = this.app, g = this.g, rig = app.engine.rig;
    if (this.photo.active) this.photo.exit();
    restore = { goal: { ...rig.goal }, panel: this.panel, view: this.view, setTab: this.setTab, speed: g.speed };
    const data = g.serialize();
    this.withLoader('Ansicht wird neu gestartet', () => app.loadData(data));
  }
  applyRestore() {
    const r = restore;
    restore = null;
    this._muteToast = true;
    setTimeout(() => { this._muteToast = false; }, 100);
    const rig = this.app.engine.rig;
    Object.assign(rig.goal, r.goal);
    rig.cur = { ...rig.goal };
    this.g.speed = r.speed;
    this.refreshSpeed();
    this.setTab = r.setTab || 'grafik';
    requestAnimationFrame(() => {
      if (r.view && r.view !== 'none') this.setView(r.view);
      if (r.panel) this.openPanel(r.panel);
      this.toast('Grafik-Einstellungen übernommen.', 'good');
    });
  }

  // ---------- pro Bild
  update(dt) {
    this.frames++;
    // Langsame Geräte (und der Software-Renderer der Prüfwerkzeuge): Übergänge abschalten, damit nichts hinterherhängt
    this.dtAvg = this.dtAvg === undefined ? dt : this.dtAvg * 0.85 + dt * 0.15;
    const slow = this.dtAvg > 0.07 || dt >= 0.1;
    if (slow !== this.slowFx && (slow || this.dtAvg < 0.045)) { this.slowFx = slow; document.documentElement.classList.toggle('lowfps', slow); }
    if (this.frames === 1 && loaderVisible()) { setLoader(1, 'Fertig'); hideLoader(dt >= 0.09); }
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.25;
      if (!this.hudHidden && !this.photo.active) { this.refreshHUD(); if (window.innerWidth <= 1100) this.fitTop(); }
      if (this.sel && !this.el.insp.hidden) this.renderInspector();
      if (this.app.input && this.app.input.tool.kind === 'line') this.renderToolHint();
    }
    this.panelTimer -= dt;
    if (this.panelTimer <= 0) {
      this.panelTimer = 1.2;
      const p = this.panel;
      if (p && !this.panelBusy && p !== 'settings' && !(p === 'budget' && this.el.panel.matches(':hover'))) {
        const def = this.panelDef(p);
        if (def && def.live !== false) this.renderPanel();
      }
      this.refreshTutorial();
    }
    this.advisor.update(dt);
    if (this.onboarding) { try { this.onboarding.update(dt); } catch (e) { if (!this._obErr) { this._obErr = true; console.warn('Einführung', e); } } }
    this.photo.update(dt);
    if (this.minimap && !this.photo.active && !this.hudHidden) this.minimap.update(dt);
    // Vorschaubilder nur bei flüssiger Bildrate (Shader-Übersetzung kann auf schwachen Geräten und im Software-Renderer lange blockieren)
    if (thumbsPending() && (!this.slowFx || window.__stadtpulsThumbsForce)) pumpThumbs(this.app.engine);
  }
}

export { esc, hex };
