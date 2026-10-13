// Spieloberfläche im Netzplan-Stil: Kopfzeile, Werkzeugleiste als Liniennetz mit Baukatalog (3D-Vorschaubilder),
// Infoansichten (links), Panels (rechts), Inspektor, Minikarte, Meldungen, Ratgeberin, Fotomodus, Modale.
// Öffentliche Schnittstelle für andere Module (Panels, Werkzeuge, Inspektoren):
//   ui.g, ui.app, ui.toast(text, 'good'|'bad'|'', { where, icon }), ui.renderPanel(), ui.openPanel(id), ui.closePanels(),
//   ui.inspect(sel), ui.setView(id), ui.tooltip(text, mouse, ok), ui.refreshHUD(), ui.openModal(html, onClick), ui.queueModal(fn),
//   ui.focusTile(x, y, dist?), ui.notify({ title, text, mood, where, icon }), ui.openTray(cat), ui.closeTray()
// Panels (registerPanel) dürfen zusätzlich input(ui, el, e), change(ui, el, e), badge(ui) → Zahl|Text, group, color haben.
import { BUILDINGS, ZONE_INFO, ROADS, MILESTONES, CATEGORIES } from '../config.js';
import { fmt, fmtMoney, fmtShort, clamp } from '../util.js';
import { PANELS, TOOLS, TRAY_ITEMS, OVERLAYS_EXTRA, INSPECTORS, MENU_SECTIONS, BUDGET_LINES, emit, on as onBus } from '../registry.js';
import { cardById } from '../sim/progress.js';
// Wetter von S4 (optional): seasonText(g) aus dem Wetter-System, wxIcon(kind, size, night) aus dem Wetter-Panel
import * as wxSys from '../sim/systems/weather.js';
import * as wxPanel from './panels/weather.js';
import { icon, iconAny, logo } from './icons.js';
import { toolbarCategories, lineById, viewList, VIEW_GROUPS, dockPanels, PANEL_GROUPS, catMeta } from './meta.js';
import { CORE_PANELS } from './corepanels.js';
import { inspectorHTML, inspectorClick } from './inspector.js';
import { catalogItems, searchCatalog, cardHTML, detailHTML, isActive, bindThumbSwap, allCatalogItems, freshCats } from './catalog.js';
import { pumpThumbs, thumbsPending } from './thumbs.js';
import { Notifier, problems } from './notify.js';
import { Advisor, tutorialSteps, adviceLevel } from './advisor.js';
import { Minimap } from './minimap.js';
import { PhotoMode } from './photo.js';
import { keysHTML, KEY_HINT } from './keys.js';
import { settingsHTML, settingsClick, settingsInput, settingsChange, ensureSettings, applyUiScale, gfxSnapshot } from './settings.js';
import { bindTips, hideTip, setTipsEnabled } from './tips.js';
import { showLoader, hideLoader, loaderVisible, setLoader, painted } from './loading.js';

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

// Zustand, der einen Neustart der Ansicht überlebt (Grafik-Einstellungen übernehmen)
let restore = null;

// System-Panels (über die Kopfzeile erreichbar, nicht im Panel-Dock)
const SYS_PANELS = [
  { id: 'advisor', title: 'Ratgeberin', icon: 'advisor', hidden: true, color: '#e8543f', render: (ui) => ui.advisor.html(), click: (ui, act, el) => ui.advisor.click(act, el) },
  { id: 'notes', title: 'Meldungen', icon: 'bell', hidden: true, color: '#1d2330', render: (ui) => ui.notes.html(), click: (ui, act, el) => ui.notes.click(act, el), opened: (ui) => ui.notes.markRead() },
  {
    id: 'settings', title: 'Optionen', icon: 'settings', hidden: true, color: '#5d6470',
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
    this.panel = null;
    this.sel = null;
    this.view = 'none';
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
    this.notes = new Notifier(this);
    this.advisor = new Advisor(this);
    this.photo = new PhotoMode(this);
    this.advisor.compute();
    this.mount();
    this.bindGame();
    bindTips();
    setTipsEnabled(app.settings.tooltips !== false);
    this.refreshBadges();
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
    r.innerHTML = `
<div class="topbar">
  <div class="sign cityplate" data-tip="Stadtrang" data-tip-desc="Der Balken zeigt den Weg zum nächsten Meilenstein.">
    <div class="logo">${logo(24)}</div>
    <div class="cp-txt">
      <div class="name" id="u-name"></div>
      <div class="rank" id="u-rank"></div>
      <div class="rankbar"><i id="u-rankbar"></i></div>
    </div>
  </div>
  <div class="sign stats">
    <button class="stat" data-stat="pop" data-tip="Einwohner" data-tip-desc="Veränderung seit gestern. Klick: Statistik"><span class="k">Einwohner</span><span class="v" id="u-pop">0</span><span class="d" id="u-popd"></span></button>
    <button class="stat" data-stat="money" data-tip="Stadtkasse" data-tip-desc="Saldo pro Tag. Klick: Haushalt"><span class="k">Kasse</span><span class="v" id="u-money"></span><span class="d" id="u-net"></span></button>
    <button class="stat opt" data-stat="happy" data-tip="Glück" data-tip-desc="Durchschnitt aller Bewohner. Klick: Infoansicht Glück"><span class="k">Glück</span><span class="v" id="u-happy"></span><span class="d" id="u-happyd"></span></button>
    <button class="stat opt opt-wide" data-stat="jobs" data-tip="Arbeitsmarkt" data-tip-desc="Arbeitslosenquote und Arbeitsplätze"><span class="k">Arbeitslos</span><span class="v" id="u-unemp"></span><span class="d" id="u-jobs"></span></button>
    <button class="stat opt opt-wide" data-stat="transit" data-tip="Pulsbahn" data-tip-desc="Fahrgäste heute und Verkehrsfluss"><span class="k">Pulsbahn</span><span class="v" id="u-riders"></span><span class="d" id="u-flow"></span></button>
  </div>
  <div class="sign demand">
    ${[1, 2, 3, 4].map((z) => `<div class="col" id="u-demc${z}" data-tip="Nachfrage ${ZONE_INFO[z].name}" data-tip-pos="bottom"><div class="bar"><i id="u-dem${z}" style="background:${zoneCol(z)}"></i></div><div class="lbl" style="color:color-mix(in srgb, ${zoneCol(z)} 58%, #1d2330)">${ZONE_INFO[z].short}</div></div>`).join('')}
  </div>
  <div class="spacer"></div>
  <div class="sign clock">
    <button class="wx" id="u-weather" hidden></button>
    <div class="when"><span class="time num" id="u-time"></span><span class="date" id="u-date"></span></div>
    <div class="speed" id="u-speed">
      <button data-speed="0" data-tip="Pause" data-key="Leertaste" data-tip-pos="bottom" aria-label="Pause">${icon('pause', 16, 2.4)}</button>
      <button data-speed="1" data-tip="Normal" data-key="1" data-tip-pos="bottom" aria-label="Normal">${icon('play', 15, 2.2)}</button>
      <button data-speed="2" data-tip="Schnell" data-key="2" data-tip-pos="bottom" aria-label="Schnell">${icon('fast', 17, 2)}</button>
      <button data-speed="3" data-tip="Sehr schnell" data-key="3" data-tip-pos="bottom" aria-label="Sehr schnell">${icon('faster', 19, 1.8)}</button>
    </div>
  </div>
  <div class="sign sysbtns" id="u-sys">
    <button data-sys="advisor" data-tip="Ratgeberin" data-tip-desc="Hinweise und Lagebericht" data-key="H" data-tip-pos="bottom" aria-label="Ratgeberin">${icon('advisor')}<span class="dot" id="u-advdot" hidden></span></button>
    <button data-sys="notes" data-tip="Meldungen" data-tip-desc="Wichtiges mit Ort und Zeit" data-key="N" data-tip-pos="bottom" aria-label="Meldungen">${icon('bell')}<span class="count" id="u-notecount" hidden></span></button>
    <button data-sys="photo" class="dk" data-tip="Fotomodus" data-key="P" data-tip-pos="bottom" aria-label="Fotomodus">${icon('camera')}</button>
    <button data-sys="keys" class="dk" data-tip="Tastenkürzel" data-key="?" data-tip-pos="bottom" aria-label="Tastenkürzel">${icon('keyboard')}</button>
    <button data-sys="settings" data-tip="Optionen" data-tip-desc="Grafik, Klang, Spielstand" data-tip-pos="bottom" aria-label="Optionen">${icon('settings')}</button>
    <button data-sys="more" class="mb" aria-label="Übersicht">${icon('grid')}</button>
  </div>
</div>
<div class="ticker" id="u-ticker" hidden><span class="pip" id="u-tickpip"></span><span class="who" id="u-tickwho"></span><span class="txt" id="u-ticktxt"></span></div>
<div class="toolhint" id="u-toolhint" hidden></div>
<div class="rstack" id="u-rstack"><div id="u-objectives"></div><div class="probs-hud" id="u-probs"></div></div>
<div class="sign dock views" id="u-views"></div>
<div class="sign legend" id="u-legend" hidden></div>
<div class="sign dock panels" id="u-dock"></div>
<div class="leftstack" id="u-leftstack"><div class="sign bubble" id="u-bubble" hidden></div><div class="sign tutorial" id="u-tutorial" hidden></div></div>
<div class="sign minimap" id="u-mini"></div>
<button class="sign mm-open" id="u-mmopen" data-tip="Minikarte zeigen" data-key="K" hidden>${icon('minimap', 20)}</button>
<div class="sign tray" id="u-tray" hidden></div>
<div class="sign toolbar" id="u-toolbar"><button class="tb-nav l" data-nav="-1" aria-label="Zurück">${icon('chevronL', 18, 2.4)}</button><div class="track" id="u-cats"></div><button class="tb-nav r" data-nav="1" aria-label="Weiter">${icon('chevronR', 18, 2.4)}</button></div>
<div class="sign panel" id="u-panel" hidden></div>
<div class="sign inspector" id="u-insp" hidden></div>
<div class="sheet" id="u-sheet" hidden></div>
`;
    const $ = (id) => document.getElementById(id);
    this.el = {};
    for (const id of ['name', 'rank', 'rankbar', 'pop', 'popd', 'money', 'net', 'happy', 'happyd', 'unemp', 'jobs', 'riders', 'flow', 'date', 'time', 'speed', 'weather', 'sys', 'advdot', 'notecount', 'ticker', 'tickpip', 'tickwho', 'ticktxt', 'toolhint', 'probs', 'views', 'legend', 'dock', 'leftstack', 'bubble', 'tutorial', 'mini', 'mmopen', 'tray', 'toolbar', 'cats', 'panel', 'insp', 'sheet', 'dem1', 'dem2', 'dem3', 'dem4']) this.el[id] = $('u-' + id);
    this.el.name.textContent = this.g.name;
    this.renderToolbar();
    this.renderViews();
    this.renderDock();
    this.minimap = new Minimap(this, this.el.mini);
    this.toggleMinimap(this.app.settings.minimap !== false && !this.mobile(), true);
    this.unswap = bindThumbSwap(this.root);

    const on = (el, ev, fn) => el.addEventListener(ev, fn);
    on(this.el.speed, 'click', (e) => { const b = e.target.closest('button[data-speed]'); if (b) { this.app.audio.play('click'); this.setSpeed(+b.dataset.speed); } });
    on(this.el.sys, 'click', (e) => { const b = e.target.closest('button[data-sys]'); if (b) { if (b.dataset.sys === 'photo' || b.dataset.sys === 'keys' || b.dataset.sys === 'more') this.app.audio.play('click'); this.sysAction(b.dataset.sys); } });
    on(this.root.querySelector('.stats'), 'click', (e) => { const b = e.target.closest('[data-stat]'); if (b) this.statAction(b.dataset.stat); });
    on(this.el.weather, 'click', () => { if (PANELS.find((p) => p.id === 'weather')) this.togglePanel('weather'); });
    on(this.el.dock, 'click', (e) => { const b = e.target.closest('button[data-panel]'); if (b) this.togglePanel(b.dataset.panel); });
    on(this.el.views, 'click', (e) => { const b = e.target.closest('button[data-view]'); if (b) { this.app.audio.play('click'); this.setView(this.view === b.dataset.view ? 'none' : b.dataset.view); } });
    on(this.el.cats, 'click', (e) => {
      const b = e.target.closest('button.cat');
      if (!b) return;
      this.app.audio.play('click');
      if (b.dataset.tool) { this.closeTray(); this.app.input.setTool({ kind: b.dataset.tool }); }
      else if (b.dataset.cat) { if (this.cat === b.dataset.cat) this.closeTray(); else this.openTray(b.dataset.cat); }
    });
    on(this.el.toolbar, 'click', (e) => { const b = e.target.closest('[data-nav]'); if (b) this.el.cats.scrollBy({ left: +b.dataset.nav * 240, behavior: 'smooth' }); });
    on(this.el.cats, 'scroll', () => this.updateTrackNav());
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
      const strip = e.target.closest('.strip');
      if (!strip || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      strip.scrollLeft += e.deltaY;
    });
    on(this.el.ticker, 'click', () => this.openPanel('news'));
    on(this.el.toolhint, 'click', (e) => this.toolHintClick(e));
    on(this.el.probs, 'click', (e) => { const b = e.target.closest('[data-prob]'); if (b) { const p = problems(this.g).find((x) => x.id === b.dataset.prob); if (p) { this.app.audio.play('click'); this.runAction(p); } } });
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
    on(this.el.mmopen, 'click', () => this.toggleMinimap(true));
    on(this.el.sheet, 'click', (e) => this.sheetClick(e));
    on(this.el.panel, 'animationend', () => this.el.panel.classList.remove('enter'));
    on(this.el.tray, 'animationend', () => this.el.tray.classList.remove('enter'));
    on(this.el.insp, 'animationend', () => this.el.insp.classList.remove('enter'));
    this.onKey = (e) => this.key(e);
    window.addEventListener('keydown', this.onKey);
    this.onResize = () => { this.updateTrackNav(); this.fitTop(); if (this.minimap) this.minimap.resize(); };
    window.addEventListener('resize', this.onResize);
    this.refreshSpeed();
    this.refreshHUD();
    this.refreshTutorial();
    requestAnimationFrame(() => { this.updateTrackNav(); this.fitTop(); });
  }

  // Handy: Die Kopfzeile bricht auf zwei bis drei Zeilen um – Lage-Chips, Laufband und Meldungen beginnen darunter
  fitTop() {
    const de = document.documentElement.style;
    const tb = this.root.querySelector('.topbar');
    if (!tb || this.root.hidden || (!this.mobile() && tb.offsetHeight <= 84)) { if (de.getPropertyValue('--top')) de.removeProperty('--top'); return; }
    const v = Math.round(tb.getBoundingClientRect().bottom + 8) + 'px';
    if (de.getPropertyValue('--top') !== v) de.setProperty('--top', v);
  }

  dispose() {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('resize', this.onResize);
    if (this.photo.active) this.photo.exit();
    for (const u of this.unbind || []) u();
    for (const u of this.unbus || []) u();
    this.notes.dispose();
    this.advisor.dispose();
    if (this.minimap) this.minimap.dispose();
    if (this.unswap) this.unswap();
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
      g.on('milestone', (i) => { setTimeout(() => this.markFresh(), 0); this.notes.push({ title: 'Meilenstein', text: `${MILESTONES[i].name} erreicht!`, mood: 'good', icon: 'trophy', kind: 'milestone', silent: true }); this.queueModal(() => this.showMilestone(i)); if (this.cat) this.renderTray(); }),
      g.on('cards', (ids) => this.queueModal(() => this.showCards(ids))),
      g.on('event', (ev) => this.queueModal(() => this.showEvent(ev))),
      g.on('bankrupt', () => this.queueModal(() => this.showBankrupt())),
      g.on('day', () => { if (this.panel) this.renderPanel(); }),
      g.on('transitChanged', () => { if (this.cat === 'transit') this.renderTray(); }),
    ];
  }

  mobile() { return window.innerWidth <= 760; }

  // Register neu einlesen (falls Module nach dem Start Panels, Kategorien oder Ansichten ergänzen)
  rebuild() {
    this.renderToolbar();
    this.renderViews();
    this.renderDock();
    this.markPanelButtons();
    this.refreshBadges();
    requestAnimationFrame(() => this.updateTrackNav());
  }

  // ---------- Kopfzeile, Werkzeuge der Kopfzeile
  setSpeed(s) {
    if (this.photo.active && s > 0 && !this.photo.opts.run) return;
    if (s > 0) this.lastSpeed = s;
    this.g.speed = s;
    this.refreshSpeed();
  }
  refreshSpeed() {
    for (const b of this.el.speed.querySelectorAll('button')) b.classList.toggle('on', +b.dataset.speed === this.g.speed);
    this.root.classList.toggle('paused', this.g.speed === 0);
  }
  sysAction(a) {
    if (a === 'photo') { this.photo.toggle(); return; }
    if (a === 'keys') { this.showKeys(); return; }
    if (a === 'more') { this.toggleSheet(); return; }
    this.togglePanel(a);
  }
  statAction(s) {
    if (s === 'pop') this.togglePanel(PANELS.find((p) => p.id === 'citizens') ? 'citizens' : 'stats');
    else if (s === 'money') this.togglePanel('budget');
    else if (s === 'happy') this.setView(this.view === 'happiness' ? 'none' : 'happiness');
    else if (s === 'jobs') this.togglePanel(PANELS.find((p) => p.id === 'economy') ? 'economy' : 'stats');
    else if (s === 'transit') this.togglePanel(PANELS.find((p) => p.id === 'transport') ? 'transport' : 'transit');
  }

  refreshHUD() {
    const g = this.g, s = g.stats;
    const ms = MILESTONES[g.milestone], next = MILESTONES[g.milestone + 1];
    this.el.rank.textContent = next ? `${ms.name} → ${next.name} (${fmt(next.pop)})` : ms.name;
    this.el.rankbar.style.width = next ? `${clamp((s.pop - ms.pop) / (next.pop - ms.pop), 0, 1) * 100}%` : '100%';
    this.el.pop.textContent = fmt(s.pop);
    const hist = g.history;
    const prev = hist.length >= 2 ? hist[hist.length - 2].pop : 0;
    const dp = hist.length ? hist[hist.length - 1].pop - prev : 0;
    this.el.popd.textContent = hist.length >= 2 ? `${dp >= 0 ? '+' : '−'}${fmt(Math.abs(dp))} / Tag` : 'Neugründung';
    this.el.popd.className = 'd ' + (dp >= 0 ? 'pos' : 'neg');
    this.el.money.textContent = g.sandbox ? '∞' : (Math.abs(g.money) >= 1e6 ? fmtShort(g.money) : fmt(g.money)) + ' €';
    this.el.money.className = 'v' + (g.money < 0 ? ' neg' : '');
    const net = g.lastBudget ? g.lastBudget.net : 0;
    this.el.net.textContent = `${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))} € / Tag`;
    this.el.net.className = 'd ' + (net >= 0 ? 'pos' : 'neg');
    this.el.happy.textContent = `${Math.round(s.happiness)} %`;
    const hp = s.happiness;
    this.el.happyd.textContent = hp >= 75 ? 'begeistert' : hp >= 60 ? 'zufrieden' : hp >= 45 ? 'durchwachsen' : hp >= 30 ? 'unzufrieden' : 'wütend';
    this.el.happyd.className = 'd ' + (hp >= 50 ? 'pos' : 'neg');
    this.el.unemp.textContent = `${Math.round(s.unemployment * 100)} %`;
    this.el.jobs.textContent = `${fmt(s.jobs)} Jobs`;
    // ÖPNV: Pulsbahn heute + Bus und Tram (S3, gestern), falls vorhanden
    const tp = g.ext && g.ext.transport && g.ext.transport.day;
    const busRiders = tp && typeof tp.riders === 'number' ? tp.riders : null;
    this.el.riders.textContent = fmt((s.ridersToday || 0) + (busRiders || 0));
    if (busRiders !== null && !this._oepnv) {
      this._oepnv = true;
      const st = this.el.riders.parentElement;
      st.querySelector('.k').textContent = 'ÖPNV';
      st.dataset.tip = 'Öffentlicher Verkehr';
      st.dataset.tipDesc = 'Fahrgäste Pulsbahn (heute) plus Bus und Tram (gestern) · Verkehrsfluss';
    }
    this.el.flow.textContent = `Verkehr ${Math.round((s.trafficFlow || 1) * 100)} %`;
    this.el.date.textContent = g.dateText();
    this.el.time.textContent = g.clockText();
    for (let z = 1; z <= 4; z++) {
      const v = g.demand[z];
      const el = this.el['dem' + z];
      const hgt = Math.min(50, Math.abs(v) / 2);
      el.style.height = hgt + '%';
      el.style.bottom = v >= 0 ? '50%' : `${50 - hgt}%`;
      el.style.opacity = v >= 0 ? 1 : 0.45;
      const col = el.parentElement.parentElement;
      const d = `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(Math.round(v))} · ${v > 40 ? 'stark gefragt' : v > 8 ? 'gefragt' : v < -8 ? 'Überangebot' : 'ausgeglichen'}`;
      if (col.dataset.tipDesc !== d) col.dataset.tipDesc = d;
    }
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
      try { pic = typeof fIcon === 'function' ? fIcon(wxKind(w), 26, night) : ''; } catch (e) { pic = ''; }
      const html = `${pic || icon(ic, 18)}<span class="wt"><b class="num">${Math.round(w.temp)}°</b>${season ? `<small>${esc(season)}</small>` : ''}</span>`;
      if (this._wx !== html) { this._wx = html; this.el.weather.innerHTML = html; }
      this.el.weather.dataset.tip = st || SEASON[w.season] || 'Wetter';
      this.el.weather.dataset.tipDesc = `${Math.round(w.temp)} °C${w.rain > 0.15 ? ' · Regen' : ''}${w.snow > 0.15 ? ' · Schnee' : ''}${w.fog > 0.4 ? ' · Nebel' : ''}${w.wind > 0.6 ? ' · windig' : ''}${PANELS.find((p) => p.id === 'weather') ? ' · Klick: Wetter & Katastrophenschutz' : ''}`;
      this.el.weather.hidden = false;
      this.el.weather.parentElement.classList.add('has-wx');
    } else { this.el.weather.hidden = true; this.el.weather.parentElement.classList.remove('has-wx'); }
  }

  refreshBadges() {
    const n = this.notes.unread;
    this.el.notecount.hidden = !n;
    this.el.notecount.textContent = n > 99 ? '99+' : String(n);
    const lvl = adviceLevel(this.advisor);
    this.el.advdot.hidden = lvl < 2;
    this.el.advdot.className = 'dot' + (lvl >= 3 ? '' : ' warn');
    // Lage-Chips
    const probs = problems(this.g).slice(0, 5);
    const key = probs.map((p) => p.id + p.count + p.sev).join('|');
    if (key !== this._probKey) {
      this._probKey = key;
      this.el.probs.innerHTML = probs.map((p) => `<button class="pchip ${p.sev}" data-prob="${p.id}" data-tip="${esc(p.text)}" data-tip-desc="${p.view ? 'Klick: Infoansicht' : p.panel ? 'Klick: Fenster öffnen' : 'Klick: Bauen'}" data-tip-pos="bottom">${icon(p.icon, 15, 2.3)}<span class="num">${p.count > 1 ? fmt(p.count) : '!'}</span></button>`).join('');
    }
    // Badges im Panel-Dock
    for (const b of this.el.dock.querySelectorAll('button[data-panel]')) {
      const p = PANELS.find((x) => x.id === b.dataset.panel);
      if (!p || !p.badge) continue;
      let v = null;
      try { v = p.badge(this); } catch (e) { v = null; }
      let el = b.querySelector('.count');
      if (v === null || v === undefined || v === 0 || v === '') { if (el) el.remove(); continue; }
      if (!el) { el = document.createElement('span'); el.className = 'count'; b.appendChild(el); }
      el.textContent = String(v);
    }
  }

  // ---------- Werkzeugleiste (Liniennetz)
  renderToolbar() {
    const cats = toolbarCategories();
    const groups = [];
    for (const c of cats) { let gr = groups.find((x) => x.line === c.line); if (!gr) groups.push(gr = { line: c.line, cats: [] }); gr.cats.push(c); }
    const stop = (c) => `<button class="cat" data-cat="${c.id}" data-tip="${esc(c.name)}" data-tip-desc="Linie ${esc(lineById(c.line).name)}" ${c.key ? `data-key="${c.key.toUpperCase()}"` : ''} aria-label="${esc(c.name)}"><span class="stop">${iconAny(c.icon, 'layers', 21)}</span><span class="lbl">${esc(c.name)}</span></button>`;
    this.el.cats.innerHTML = `<div class="lg term"><button class="cat" data-tool="select" data-tip="Auswählen" data-tip-desc="Gebäude und Felder anklicken" data-key="Esc" aria-label="Auswählen"><span class="stop">${icon('select', 20)}</span><span class="lbl">Info</span></button></div>
${groups.map((gr) => { const L = lineById(gr.line); return `<div class="lg" style="--lc:${L.color}" data-line="${gr.line}"><i class="rail"></i>${gr.cats.map(stop).join('')}</div>`; }).join('')}
<div class="lg term"><button class="cat danger" data-tool="bulldoze" data-tip="Abriss" data-tip-desc="Fläche aufziehen zum Abreißen" data-key="B" aria-label="Abriss"><span class="stop">${icon('bulldoze', 21)}</span><span class="lbl">Abriss</span></button></div>`;
    this.markToolButtons();
    this.markFresh();
  }
  // Punkt an Haltestellen mit neu freigeschalteten Gebäuden (bis die Kategorie geöffnet wurde)
  markFresh() {
    const fresh = freshCats(this);
    const seen = this.seenFresh || (this.seenFresh = new Map());
    for (const b of this.el.cats.querySelectorAll('.cat[data-cat]')) {
      const c = b.dataset.cat;
      const on = fresh.has(c) && seen.get(c) !== this.g.milestone;
      let d = b.querySelector('.nd');
      if (on && !d) { d = document.createElement('span'); d.className = 'nd'; b.querySelector('.stop').appendChild(d); }
      else if (!on && d) d.remove();
    }
  }
  updateTrackNav() {
    const t = this.el.cats;
    if (!t) return;
    const over = t.scrollWidth > t.clientWidth + 4;
    this.el.toolbar.classList.toggle('scrolls', over);
    this.el.toolbar.classList.toggle('at-start', t.scrollLeft <= 2);
    this.el.toolbar.classList.toggle('at-end', t.scrollLeft + t.clientWidth >= t.scrollWidth - 2);
  }

  openTray(cat) {
    this.cat = cat;
    if (this.seenFresh || freshCats(this).has(cat)) { (this.seenFresh || (this.seenFresh = new Map())).set(cat, this.g.milestone); this.markFresh(); }
    if (cat !== '__search') this.search = '';
    this.hoverItem = null;
    for (const b of this.el.cats.querySelectorAll('.cat')) b.classList.toggle('on', b.dataset.cat === cat);
    const wasHidden = this.el.tray.hidden;
    this.renderTray();
    this.el.tray.hidden = false;
    if (wasHidden) this.el.tray.classList.add('enter');
    this.root.classList.add('tray-open');
    this.el.tutorial.hidden = true;
    if (!this.el.insp.hidden && this.mobile()) this.closeInspector();
    const btn = this.el.cats.querySelector(`.cat[data-cat="${cat}"]`);
    if (btn) btn.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }
  openSearch() {
    this.openTray('__search');
    const inp = document.getElementById('u-search');
    if (inp) { inp.focus(); inp.select(); }
  }
  closeTray() {
    this.cat = null;
    this.el.tray.hidden = true;
    this.root.classList.remove('tray-open');
    for (const b of this.el.cats.querySelectorAll('.cat')) b.classList.toggle('on', false);
    this.markToolButtons();
    this.refreshTutorial();
  }
  trayItems(cat) { return catalogItems(this, cat); }
  renderTray() {
    const cat = this.cat;
    if (!cat) return;
    const isSearch = cat === '__search';
    const cm = isSearch ? { name: 'Baukatalog', color: '#1d2330', icon: 'search', line: 'bau' } : catMeta(cat);
    const L = lineById(cm.line);
    this.el.tray.style.setProperty('--lc', isSearch ? '#1d2330' : cm.color);
    this.el.tray.innerHTML = `<div class="tr-head"><span class="tr-badge" style="background:${isSearch ? '#1d2330' : cm.color}">${iconAny(cm.icon, 'layers', 16, 2.2)}</span><span class="tr-name">${esc(cm.name)}</span><span class="tr-line">${isSearch ? 'Alle Kategorien' : 'Linie ' + esc(L.name)}</span><span class="tr-count" id="u-traycount"></span><span class="grow"></span>
<label class="tr-search">${icon('search', 15)}<input id="u-search" type="search" placeholder="Gebäude suchen …" value="${esc(this.search)}" autocomplete="off" spellcheck="false"><kbd>F</kbd></label>
<button class="close" data-act="closetray" aria-label="Schließen">${icon('close', 16)}</button></div>
<div class="tr-body"><div class="detail"></div><div class="strip" id="u-strip"></div></div>`;
    this.renderTrayBody();
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
    const sl = strip.scrollLeft;
    strip.innerHTML = list.length ? list.map((it, i) => cardHTML(it, i, isActive(it, t), isSearch)).join('') : `<div class="empty strip-empty">${q ? `Nichts gefunden für „${esc(q)}".` : 'Tippe einen Namen, z. B. „Schule", „Park" oder „Strom". Hier erscheint auch, was du zuletzt gebaut hast.'}</div>`;
    strip.scrollLeft = sl;
    const cnt = document.getElementById('u-traycount');
    if (cnt) cnt.textContent = list.length ? `${list.length} ${list.length === 1 ? 'Eintrag' : 'Einträge'}` : '';
    const active = list.find((it) => isActive(it, t));
    if (!this.hoverItem || !list.includes(this.hoverItem)) this.hoverItem = active || list.find((it) => !it.locked) || list[0] || null;
    const d = this.el.tray.querySelector('.detail');
    if (d) d.innerHTML = detailHTML(this.hoverItem);
  }
  trayClick(e) {
    const c = e.target.closest('[data-act=closetray]');
    if (c) { this.closeTray(); return; }
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
  }
  markToolButtons() {
    const k = this.app.input ? this.app.input.tool.kind : 'select';
    for (const b of this.el.cats.querySelectorAll('.cat[data-tool]')) b.classList.toggle('on', b.dataset.tool === k && !this.cat);
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
      if (d && d.size[0] !== d.size[1]) extra.push(['rotate', 'Drehen', 'rotate']);
    } else if (t.kind === 'line' || t.kind === 'extend') {
      name = t.kind === 'line' ? 'Linie zeichnen' : 'Linie verlängern'; ic = 'line'; col = '#e8543f';
      hint = `${input.lineStops.length} ${input.lineStops.length === 1 ? 'Station' : 'Stationen'} · Rechtsklick oder Enter beendet`;
      extra.push(['finish', 'Fertig', 'check']);
    } else {
      const T2 = TOOLS[t.kind] || {};
      name = T2.name || (this.trayList && (this.trayList.find((x) => x.kind === 'tool' && x.key === t.kind) || {}).name) || t.kind;
      try { hint = T2.hint ? T2.hint(input) || '' : ''; } catch (e) { hint = ''; }
      ic = T2.icon || 'brush';
    }
    const html = `<span class="th-i" style="background:${col}">${iconAny(ic, 'select', 15, 2.3)}</span><b>${esc(name)}</b>${hint ? `<span class="th-h">${esc(hint)}</span>` : ''}${extra.map(([a, n, ii]) => `<button class="th-b" data-th="${a}">${icon(ii, 14, 2.4)}${n}</button>`).join('')}<button class="th-x" data-th="cancel" data-tip="Abbrechen" data-key="Esc" data-tip-fast="1" aria-label="Werkzeug abbrechen">${icon('close', 14, 2.4)}</button>`;
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

  // ---------- Infoansichten
  renderViews() {
    const list = viewList();
    let last = null, html = '';
    for (const o of list) {
      if (o.group !== last && o.id !== 'none' && last !== null) html += '<div class="sep"></div>';
      last = o.group;
      html += `<button data-view="${o.id}" data-tip="${esc(o.id === 'none' ? 'Normale Ansicht' : o.name)}" data-tip-desc="${esc(o.id === 'none' ? 'Infoansicht ausschalten' : o.text || (VIEW_GROUPS.find((g) => g.id === o.group) || {}).name || '')}" ${o.id === 'none' ? 'data-key="V"' : ''} data-tip-pos="right" aria-label="${esc(o.name)}">${iconAny(o.icon, 'layers', 19)}</button>`;
    }
    this.el.views.innerHTML = html;
    const two = list.length > 11;
    this.el.views.classList.toggle('two', two);
    this.root.style.setProperty('--legend-x', two ? '104px' : '66px');
    for (const b of this.el.views.querySelectorAll('button')) b.classList.toggle('on', b.dataset.view === this.view);
  }
  setView(id, auto = false) {
    this.view = id;
    this.autoTransitView = auto;
    this.app.engine.overlay.setMode(id);
    for (const b of this.el.views.querySelectorAll('button')) b.classList.toggle('on', b.dataset.view === id);
    if (this.el.sheet && !this.el.sheet.hidden) this.renderSheet();
    const def = viewList().find((o) => o.id === id);
    this.root.classList.toggle('view-on', id !== 'none' && !!def);
    if (id === 'none' || !def) { this.el.legend.hidden = true; return; }
    const bad = def.bad;
    let ramp = `linear-gradient(90deg, ${bad ? '#45c46b, #f2c230, #e5483c' : '#e5483c, #f2c230, #45c46b'})`;
    let ends = id === 'resources' ? ['fruchtbar', 'Erz'] : bad ? ['gering', 'hoch'] : id === 'traffic' ? ['frei', 'Stau'] : ['schlecht', 'gut'];
    if (id === 'traffic') ramp = 'linear-gradient(90deg,#45c46b,#f2c230,#e5483c)';
    let leg = `<div class="ramp" style="background:${ramp}"></div><div class="ends"><span>${ends[0]}</span><span>${ends[1]}</span></div>`;
    let lg = def.legend;
    if (typeof lg === 'function') { try { lg = lg(this.g); } catch (e) { console.error(e); lg = null; } }
    const items = Array.isArray(lg) ? lg : lg && lg.items;
    if (id === 'resources' && !def.legend) leg = `<div class="litems"><span><i style="background:#78be46"></i>Acker</span><span><i style="background:#2e6b3a"></i>Wald</span><span><i style="background:#966e5a"></i>Erz</span><span><i style="background:#4a4a58"></i>Öl</span></div>`;
    else if (items) leg = `<div class="litems">${items.map(([c, l]) => `<span><i style="background:${typeof c === 'number' ? hex(c) : c}"></i>${esc(l)}</span>`).join('')}</div>`;
    else if (lg && lg.gradient) { leg = `<div class="ramp" style="background:${lg.gradient}"></div><div class="ends"><span>${esc((lg.ends || [])[0] || '')}</span><span>${esc((lg.ends || [])[1] || '')}</span></div>`; }
    else if (id === 'power' || id === 'water') leg = `<div class="litems"><span><i style="background:${id === 'power' ? '#45c46b' : '#3fa0e0'}"></i>versorgt</span><span><i style="background:#e5483c"></i>fehlt</span></div>`;
    this.el.legend.innerHTML = `<h4>${iconAny(def.icon, 'layers', 16)}<span>${esc(def.name)}</span><button class="close" data-act="offview" aria-label="Ansicht schließen">${icon('close', 14)}</button></h4>${leg}<p>${esc(def.text || '')}</p>`;
    this.el.legend.hidden = false;
    this.el.legend.onclick = (e) => { if (e.target.closest('[data-act=offview]')) this.setView('none'); };
  }

  // ---------- Panel-Dock
  panelDef(id) { return PANELS.find((p) => p.id === id) || CORE_PANELS.find((p) => p.id === id) || SYS_PANELS.find((p) => p.id === id) || null; }
  renderDock() {
    const list = dockPanels(CORE_PANELS);
    let last = null, html = '';
    for (const { p, m } of list) {
      if (last !== null && m.group !== last) html += '<div class="sep"></div>';
      last = m.group;
      html += `<button data-panel="${p.id}" style="--pc:${m.color}" data-tip="${esc(p.title)}" data-tip-desc="${esc((PANEL_GROUPS.find((g) => g.id === m.group) || {}).name || '')}" data-tip-pos="left" aria-label="${esc(p.title)}">${iconAny(p.icon, 'layers', 20)}${p.id === 'news' ? '<span class="dot" id="u-newsdot" hidden></span>' : ''}</button>`;
    }
    this.el.dock.innerHTML = html;
    this.el.newsdot = document.getElementById('u-newsdot');
  }

  // ---------- Erste Schritte
  refreshTutorial() {
    const g = this.g;
    // Im Metro-Modus baut sich die Stadt selbst – dort passt die Einstiegsliste nicht
    if (this.tutorialHidden || g.sandbox || (g.opts && g.opts.scenario === 'metro') || this.cat || this.panel || this.photo.active || this.mobile()) { this.el.tutorial.hidden = true; return; }
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
    const html = `<h4><span>Erste Schritte</span><span class="tprog num">${done} / ${steps.length}</span><button class="close" data-act="tuttoggle" data-tip="${open ? 'Weniger' : 'Alle Schritte'}" data-tip-fast="1" aria-label="Aufklappen">${icon(open ? 'chevronD' : 'chevronU', 15)}</button><button class="close" data-act="hidetut" data-tip="Ausblenden" data-tip-fast="1" aria-label="Ausblenden">${icon('close', 15)}</button></h4>${line}${body}`;
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

  // ---------- Nachrichten
  onNews(n) {
    this.el.ticker.hidden = false;
    this.el.tickwho.textContent = n.author;
    this.el.ticktxt.textContent = n.text;
    this.el.tickpip.style.background = n.mood === 'bad' ? 'var(--bad)' : n.mood === 'good' ? 'var(--good)' : 'var(--l-blue)';
    this.el.ticker.classList.remove('flash'); void this.el.ticker.offsetWidth; this.el.ticker.classList.add('flash');
    if (this.panel !== 'news') { if (this.el.newsdot) this.el.newsdot.hidden = false; } else this.renderPanel();
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
      if (t._msg === msg && !t.classList.contains('out')) { clearTimeout(t._t); t._t = setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, opts.where ? 5200 : 3400); return; }
    }
    if (type === 'bad') this._badToastAt = performance.now();
    const d = document.createElement('div');
    d._msg = msg;
    d.className = 'toast ' + type + (opts.where ? ' link' : '');
    const ic = opts.icon || (type === 'bad' ? 'warn' : type === 'good' ? 'check' : 'info');
    d.innerHTML = `<span class="ti">${icon(ic, 15, 2.4)}</span><span class="tt"></span>${opts.where ? `<span class="tg">${icon('pin', 14, 2.2)}</span>` : ''}`;
    d.querySelector('.tt').textContent = msg;
    if (opts.where) d.addEventListener('click', () => { this.focusTile(opts.where.x, opts.where.y, 20); d.remove(); });
    this.toasts.appendChild(d);
    while (this.toasts.children.length > (this.mobile() ? 2 : 3)) this.toasts.firstChild.remove();
    d._t = setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 400); }, opts.where ? 5200 : 3400);
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
    if (name === 'news' && this.el.newsdot) this.el.newsdot.hidden = true;
    this.el.panel.hidden = false;
    this.el.insp.hidden = true;
    this.sel = null;
    this.app.engine.overlay.select(null);
    this.closeSheet();
    if (this.mobile()) this.closeTray();
    if (changed) { this.el.panel.classList.remove('enter'); void this.el.panel.offsetWidth; this.el.panel.classList.add('enter'); this.panelScroll = 0; }
    if (def.opened) def.opened(this);
    this.renderPanel(changed);
    this.refreshTutorial();
  }
  closePanels() {
    this.panel = null;
    this.el.panel.hidden = true;
    this.markPanelButtons();
    this.closeInspector();
    this.refreshTutorial();
  }
  markPanelButtons() {
    for (const b of this.root.querySelectorAll('#u-dock button[data-panel], #u-sys button[data-sys]')) b.classList.toggle('on', (b.dataset.panel || b.dataset.sys) === this.panel);
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
    const m = def.color || (dockPanels(CORE_PANELS).find((x) => x.p.id === def.id) || { m: {} }).m.color || '#1d2330';
    const headHtml = `<header style="--pc:${m}"><span class="ph-badge">${iconAny(def.icon, 'layers', 17, 2.2)}</span><h2>${esc(def.title)}</h2><button class="close" data-act="close" aria-label="Schließen">${icon('close', 18)}</button></header>`;
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

  // ---------- Minikarte, Übersicht (Handy), Oberfläche ausblenden
  toggleMinimap(v, silent = false) {
    if (v === undefined) v = this.el.mini.hidden || (this.mobile() && !this.el.mini.classList.contains('force'));
    this.el.mini.classList.toggle('force', v && this.mobile());
    this.minimap.setVisible(v);
    this.el.mmopen.hidden = v || this.mobile();
    this.root.classList.toggle('mm-off', !v);
    if (!silent) { this.app.settings.minimap = v; this.app.saveSettings(); }
  }
  toggleHud(v) {
    this.hudHidden = v === undefined ? !this.hudHidden : v;
    this.root.classList.toggle('hud-hidden', this.hudHidden);
    if (this.hudHidden) this.toast('Oberfläche ausgeblendet · U zeigt sie wieder');
  }
  toggleSheet() { if (this.el.sheet.hidden) this.openSheet(); else this.closeSheet(); }
  openSheet() { this.renderSheet(); this.el.sheet.hidden = false; this.el.sheet.classList.remove('enter'); void this.el.sheet.offsetWidth; this.el.sheet.classList.add('enter'); }
  closeSheet() { if (this.el.sheet) this.el.sheet.hidden = true; }
  renderSheet() {
    const panels = dockPanels(CORE_PANELS);
    const views = viewList();
    this.el.sheet.innerHTML = `<div class="sh-card"><div class="sh-grab"></div>
<div class="sh-head"><b>Übersicht</b><button class="close" data-sh="close" aria-label="Schließen">${icon('close', 18)}</button></div>
<h3>Fenster</h3><div class="sh-grid">${panels.map(({ p, m }) => `<button data-sh="panel" data-v="${p.id}" style="--pc:${m.color}" class="${this.panel === p.id ? 'on' : ''}">${iconAny(p.icon, 'layers', 22)}<span>${esc(p.short || (p.title.length > 16 ? p.title.split(' & ')[0] : p.title))}</span></button>`).join('')}
<button data-sh="photo">${icon('camera', 22)}<span>Fotomodus</span></button><button data-sh="keys">${icon('keyboard', 22)}<span>Tasten</span></button><button data-sh="mini">${icon('minimap', 22)}<span>Minikarte</span></button></div>
<h3>Infoansichten</h3><div class="sh-grid views">${views.map((o) => `<button data-sh="view" data-v="${o.id}" class="${this.view === o.id ? 'on' : ''}">${iconAny(o.icon, 'layers', 20)}<span>${esc(o.id === 'none' ? 'Normal' : o.name)}</span></button>`).join('')}</div></div>`;
  }
  sheetClick(e) {
    const b = e.target.closest('[data-sh]');
    if (!b) { if (e.target === this.el.sheet) this.closeSheet(); return; }
    this.app.audio.play('click');
    const a = b.dataset.sh, v = b.dataset.v;
    if (a === 'close') this.closeSheet();
    else if (a === 'panel') { this.closeSheet(); this.openPanel(v); }
    else if (a === 'view') { this.setView(v); this.closeSheet(); }
    else if (a === 'photo') { this.closeSheet(); this.photo.enter(); }
    else if (a === 'keys') { this.closeSheet(); this.showKeys(); }
    else if (a === 'mini') { this.closeSheet(); this.toggleMinimap(); }
  }

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
    const k = (e.key || '').toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.code === 'Space') { e.preventDefault(); this.setSpeed(this.g.speed === 0 ? (this.lastSpeed || 1) : 0); }
    else if (e.code === 'Digit1' || e.code === 'Numpad1') this.setSpeed(1);
    else if (e.code === 'Digit2' || e.code === 'Numpad2') this.setSpeed(2);
    else if (e.code === 'Digit3' || e.code === 'Numpad3') this.setSpeed(3);
    else if (ctrl && e.code === 'KeyS') { e.preventDefault(); if (this.app.save(1) !== false) this.toast('Gespeichert in Platz 1.', 'good'); }
    else if (ctrl) return;
    else if (e.key === '?' || e.code === 'F1') { e.preventDefault(); this.showKeys(); }
    else if (k === 'm') { this.app.settings.muted = !this.app.settings.muted; this.app.audio.applyVolumes(); this.app.saveSettings(); this.toast(this.app.settings.muted ? 'Ton aus' : 'Ton an'); }
    else if (k === 'i') { this.app.engine.effects.showIcons = !this.app.engine.effects.showIcons; this.toast(this.app.engine.effects.showIcons ? 'Problem-Symbole an' : 'Problem-Symbole aus'); }
    else if (k === 'p') this.photo.enter();
    else if (k === 'u') this.toggleHud();
    else if (k === 'n') this.togglePanel('notes');
    else if (k === 'h') this.togglePanel('advisor');
    else if (k === 'k') this.toggleMinimap();
    else if (k === 'v') this.setView('none');
    else if (k === 'f') { e.preventDefault(); this.openSearch(); }
    else if (k === 'g') { if (this.cat === 'roads') this.closeTray(); else this.openTray('roads'); }
    else if (k === 'z') { if (this.cat === 'zones') this.closeTray(); else this.openTray('zones'); }
    else if (k === 'l') { if (this.g.isUnlocked('transit')) this.app.input.setTool({ kind: 'line' }); else this.toast(this.g.lockReason('station') || 'Noch nicht freigeschaltet.', 'bad'); }
    else if (e.code === 'Escape' && this.hudHidden) this.toggleHud(false);
    else if (e.code === 'Escape' && !this.el.sheet.hidden) this.closeSheet();
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
    if (i === 2) unlocks.unshift(['zones', 'Büro-Zone', '#9466d2'], ['roads', 'Alleen', '#5d6470'], ['transit', 'Pulsbahn (2 Linien)', '#e8543f'], ['budget', 'Kredite', '#c98a0c']);
    if (i >= 3 && i <= 5) unlocks.push(['line', '+1 Pulsbahn-Linie', '#e8543f']);
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
      if (!this.hudHidden && !this.photo.active) { this.refreshHUD(); if (window.innerWidth <= 960) this.fitTop(); }
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
    this.photo.update(dt);
    if (this.minimap && !this.photo.active && !this.hudHidden) this.minimap.update(dt);
    // Vorschaubilder nur bei flüssiger Bildrate (Shader-Übersetzung kann auf schwachen Geräten und im Software-Renderer lange blockieren)
    if (thumbsPending() && (!this.slowFx || window.__stadtpulsThumbsForce)) pumpThumbs(this.app.engine);
  }
}

export { esc, hex };
