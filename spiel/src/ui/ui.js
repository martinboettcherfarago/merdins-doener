// Spieloberfläche: Kopfzeile, Werkzeugleiste (als Bahnlinie), Infoansichten, Panels, Inspektor, Modale.
import { BUILDINGS, CATEGORIES, ZONE_INFO, ROADS, R, Z, MILESTONES, POLICIES, LOANS, TRANSIT, TAX_RATE, LEVELS, T, RES, SPEEDS } from '../config.js';
import { fmt, fmtMoney, fmtShort, clamp } from '../util.js';
import { icon, logo } from './icons.js';
import { OVERLAYS } from '../render/overlay.js';
import { LINE_COLORS, LINE_COLOR_NAMES } from '../sim/transit.js';
import { cardById, EVENTS } from '../sim/progress.js';
import { happinessFactors } from '../sim/services.js';
import { drawLineChart } from './charts.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CAT_ICON = { roads: 'roads', zones: 'zones', power: 'power', water: 'water', garbage: 'garbage', services: 'services', education: 'education', parks: 'parks', transit: 'transit', landmarks: 'landmarks' };
const CAT_COLOR = { roads: '#5d6470', zones: '#4fae67', power: '#f2b01e', water: '#2f8fe0', garbage: '#a07a4a', services: '#e8543f', education: '#8f5ad8', parks: '#22a866', transit: '#e8543f', landmarks: '#c06a2b' };
const VIEW_ICON = { none: 'eye', power: 'power', water: 'water', garbage: 'garbage', health: 'cross', police: 'shield', fire: 'flame', edu: 'book', landValue: 'coin', pollution: 'smoke', noise: 'sound', crime: 'mask', happiness: 'heart', traffic: 'car', transit: 'line', resources: 'map' };
const VIEW_TEXT = {
  power: 'Grün: versorgt. Rot: kein Strom. Strom fließt durch die Leitungen unter den Straßen – jedes zusammenhängende Straßennetz ist ein eigenes Stromnetz.',
  water: 'Blau: versorgt. Rot: kein Wasser. Pumpwerke brauchen Strom und müssen am Ufer stehen.',
  garbage: 'Wie gut die Müllabfuhr die Gegend erreicht. Jede Anlage hat eine begrenzte Kapazität.',
  health: 'Abdeckung durch Arztpraxen und Krankenhäuser.',
  police: 'Abdeckung durch Polizeiwachen.',
  fire: 'Abdeckung durch die Feuerwehr. Ohne Feuerwehr brennen Gebäude ab.',
  edu: 'Bildungsniveau, das hier erreichbar ist. Hohe Stufen brauchen gebildete Bewohner.',
  landValue: 'Bodenwert lässt Gebäude wachsen: Parks, Wasser, Dienste und die Pulsbahn heben ihn, Lärm und Abgase senken ihn.',
  pollution: 'Abgase von Industrie, Kraftwerken und Verkehr. Senkt Glück und Bodenwert.',
  noise: 'Lärm von Straßen, Industrie und Stadien.',
  crime: 'Kriminalität steigt mit Arbeitslosigkeit und Unzufriedenheit.',
  happiness: 'Grün: glücklich. Rot: unglücklich. Klicke ein Gebäude an, um die Gründe zu sehen.',
  traffic: 'Grün: freie Fahrt. Rot: Stau. Alleen haben die doppelte Kapazität, die Pulsbahn nimmt Autos von der Straße.',
  transit: 'Einzugsgebiet der Pulsbahn-Stationen mit Zugverkehr.',
  resources: 'Grün: fruchtbarer Boden (Bauernhöfe). Braun: Erz (Bergwerke). Industrie dort spezialisiert sich.',
};
const ZONE_LEVEL_NAMES = {
  1: ['', 'Häuschen', 'Einfamilienhaus', 'Stadthaus', 'Wohnblock', 'Wohnturm'],
  2: ['', 'Kiosk', 'Ladenzeile', 'Kaufhaus', 'Geschäftshaus', 'Einkaufsturm'],
  3: ['', 'Werkstatt', 'Fabrik', 'Werk', 'Großwerk', 'Hightech-Werk'],
  4: ['', 'Kanzlei', 'Bürohaus', 'Bürokomplex', 'Büroturm', 'Wolkenkratzer'],
};
const AV_COLORS = ['#e8543f', '#2f8fe0', '#f2b01e', '#22a866', '#8f5ad8', '#f06fae', '#10a9a3', '#ff8a1f'];

export class UI {
  constructor(app) {
    this.app = app;
    this.g = app.game;
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
    this.newsSeen = this.g.newsLog.length;
    this.chartKey = 'pop';
    this.tutorialHidden = !!app.settings.tutorialDone;
    this.modalQueue = [];
    this.mount();
    this.bindGame();
  }

  // ---------- Aufbau
  mount() {
    const r = this.root;
    r.hidden = false;
    r.innerHTML = `
<div class="topbar">
  <div class="sign cityplate">
    <div class="logo">${logo(24)}</div>
    <div style="min-width:0">
      <div class="name" id="u-name"></div>
      <div class="rank" id="u-rank"></div>
      <div class="rankbar"><i id="u-rankbar"></i></div>
    </div>
  </div>
  <div class="sign stats">
    <div class="stat"><span class="k">Einwohner</span><span class="v" id="u-pop">0</span><span class="d" id="u-popd"></span></div>
    <div class="stat"><span class="k">Kasse</span><span class="v" id="u-money"></span><span class="d" id="u-net"></span></div>
    <div class="stat opt"><span class="k">Glück</span><span class="v" id="u-happy"></span><span class="d" id="u-happyd"></span></div>
    <div class="stat opt opt-wide"><span class="k">Arbeitslos</span><span class="v" id="u-unemp"></span><span class="d" id="u-jobs"></span></div>
    <div class="stat opt opt-wide"><span class="k">Pulsbahn</span><span class="v" id="u-riders"></span><span class="d" id="u-flow"></span></div>
  </div>
  <div class="sign demand" title="Nachfrage: Wohnen, Gewerbe, Industrie, Büro">
    ${[1, 2, 3, 4].map((z) => `<div class="col"><div class="bar"><i id="u-dem${z}" style="background:${hex(ZONE_INFO[z].color)}"></i></div><div class="lbl" style="color:${hex(ZONE_INFO[z].color)}">${ZONE_INFO[z].short}</div></div>`).join('')}
  </div>
  <div class="spacer"></div>
  <div class="sign clock">
    <div class="when"><span class="time num" id="u-time"></span><span class="date" id="u-date"></span></div>
    <div class="speed" id="u-speed">
      <button data-speed="0" title="Pause (Leertaste)">${icon('pause', 16, 2.4)}</button>
      <button data-speed="1" title="Normal (1)">${icon('play', 15, 2.2)}</button>
      <button data-speed="2" title="Schnell (2)">${icon('fast', 17, 2)}</button>
      <button data-speed="3" title="Sehr schnell (3)">${icon('faster', 19, 1.8)}</button>
    </div>
  </div>
  <div class="sign menubtns" id="u-menu">
    <button data-panel="budget" title="Haushalt">${icon('budget')}</button>
    <button data-panel="stats" title="Statistik">${icon('stats')}</button>
    <button data-panel="policies" title="Verordnungen">${icon('policies')}</button>
    <button data-panel="transit" title="Pulsbahn">${icon('transit')}</button>
    <button data-panel="news" title="Stadtfunk">${icon('news')}<span class="dot" id="u-newsdot" hidden></span></button>
    <button data-panel="settings" title="Optionen, Hilfe, Speichern">${icon('settings')}</button>
  </div>
</div>
<div class="ticker" id="u-ticker" hidden><span class="pip" id="u-tickpip"></span><span class="who" id="u-tickwho"></span><span class="txt" id="u-ticktxt"></span></div>
<div class="sign views" id="u-views">
  ${OVERLAYS.map((o, i) => `${i === 1 || i === 13 ? '<div class="sep"></div>' : ''}<button data-view="${o.id}" title="${o.name}">${icon(VIEW_ICON[o.id] || 'eye', 19)}</button>`).join('')}
</div>
<div class="sign legend" id="u-legend" hidden></div>
<div class="sign tutorial" id="u-tutorial" hidden></div>
<div class="sign tray" id="u-tray" hidden></div>
<div class="sign toolbar">
  <div class="track" id="u-cats">
    <div class="rail"></div>
    <button class="cat" data-tool="select" title="Auswählen (Esc)"><span class="stop">${icon('select', 20)}</span><span class="lbl">Info</span></button>
    ${CATEGORIES.map((c) => `<button class="cat" data-cat="${c.id}"><span class="stop">${icon(CAT_ICON[c.id], 21)}</span><span class="lbl">${c.name}</span></button>`).join('')}
    <button class="cat danger" data-tool="bulldoze" title="Abreißen (B)"><span class="stop">${icon('bulldoze', 21)}</span><span class="lbl">Abriss</span></button>
  </div>
</div>
<div class="sign panel" id="u-panel" hidden></div>
<div class="sign inspector" id="u-insp" hidden></div>
`;
    const $ = (id) => document.getElementById(id);
    this.el = {};
    for (const id of ['name', 'rank', 'rankbar', 'pop', 'popd', 'money', 'net', 'happy', 'happyd', 'unemp', 'jobs', 'riders', 'flow', 'date', 'time', 'speed', 'menu', 'ticker', 'tickpip', 'tickwho', 'ticktxt', 'views', 'legend', 'tutorial', 'tray', 'cats', 'panel', 'insp', 'newsdot', 'dem1', 'dem2', 'dem3', 'dem4']) this.el[id] = $('u-' + id);
    this.el.name.textContent = this.g.name;

    this.el.speed.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-speed]');
      if (!b) return;
      this.setSpeed(+b.dataset.speed);
    });
    this.el.menu.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-panel]');
      if (!b) return;
      this.app.audio.play('click');
      this.togglePanel(b.dataset.panel);
    });
    this.el.views.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-view]');
      if (!b) return;
      this.app.audio.play('click');
      this.setView(this.view === b.dataset.view ? 'none' : b.dataset.view);
    });
    this.el.cats.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      this.app.audio.play('click');
      if (b.dataset.tool) {
        this.closeTray();
        this.app.input.setTool({ kind: b.dataset.tool });
      } else if (b.dataset.cat) {
        if (this.cat === b.dataset.cat) this.closeTray();
        else this.openTray(b.dataset.cat);
      }
    });
    this.el.tray.addEventListener('click', (e) => {
      const b = e.target.closest('button.item');
      if (!b) return;
      this.app.audio.play('click');
      this.pickItem(b.dataset);
    });
    this.el.ticker.addEventListener('click', () => this.openPanel('news'));
    this.el.panel.addEventListener('pointerdown', () => { this.panelBusy = true; });
    window.addEventListener('pointerup', () => { this.panelBusy = false; });
    this.el.panel.addEventListener('click', (e) => this.panelClick(e));
    this.el.panel.addEventListener('input', (e) => this.panelInput(e));
    this.el.panel.addEventListener('change', (e) => this.panelChange(e));
    this.el.insp.addEventListener('click', (e) => this.inspClick(e));
    this.el.tutorial.addEventListener('click', (e) => {
      if (e.target.closest('[data-act=hidetut]')) { this.tutorialHidden = true; this.app.settings.tutorialDone = true; this.app.saveSettings(); this.el.tutorial.hidden = true; }
    });
    // Tastatur
    this.onKey = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
      if (this.modalOpen()) return;
      if (e.code === 'Space') { e.preventDefault(); this.setSpeed(this.g.speed === 0 ? (this.lastSpeed || 1) : 0); }
      else if (e.code === 'Digit1') this.setSpeed(1);
      else if (e.code === 'Digit2') this.setSpeed(2);
      else if (e.code === 'Digit3') this.setSpeed(3);
      else if (e.code === 'KeyM') { this.app.settings.muted = !this.app.settings.muted; this.app.audio.applyVolumes(); this.app.saveSettings(); this.toast(this.app.settings.muted ? 'Ton aus' : 'Ton an'); }
      else if (e.code === 'KeyI') this.app.engine.effects.showIcons = !this.app.engine.effects.showIcons;
      else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') { e.preventDefault(); this.app.save(1); this.toast('Gespeichert in Platz 1.', 'good'); }
    };
    window.addEventListener('keydown', this.onKey);
    this.refreshSpeed();
    this.refreshHUD();
    this.refreshTutorial();
  }

  dispose() {
    window.removeEventListener('keydown', this.onKey);
    for (const u of this.unbind || []) u();
    this.root.innerHTML = '';
    this.root.hidden = true;
    this.modalRoot.innerHTML = '';
    this.tooltip(null);
  }

  bindGame() {
    const g = this.g;
    this.unbind = [
      g.on('news', (n) => this.onNews(n)),
      g.on('milestone', (i) => this.queueModal(() => this.showMilestone(i))),
      g.on('cards', (ids) => this.queueModal(() => this.showCards(ids))),
      g.on('event', (ev) => this.queueModal(() => this.showEvent(ev))),
      g.on('bankrupt', () => this.queueModal(() => this.showBankrupt())),
      g.on('day', () => { if (this.panel) this.renderPanel(); }),
    ];
  }

  // ---------- Geschwindigkeit
  setSpeed(s) {
    if (s > 0) this.lastSpeed = s;
    this.g.speed = s;
    this.refreshSpeed();
  }
  refreshSpeed() {
    for (const b of this.el.speed.querySelectorAll('button')) b.classList.toggle('on', +b.dataset.speed === this.g.speed);
  }

  // ---------- Werkzeugleiste
  openTray(cat) {
    this.cat = cat;
    for (const b of this.el.cats.querySelectorAll('.cat')) b.classList.toggle('on', b.dataset.cat === cat);
    this.renderTray();
    this.el.tray.hidden = false;
    this.el.tutorial.hidden = true;
  }
  closeTray() {
    this.cat = null;
    this.el.tray.hidden = true;
    for (const b of this.el.cats.querySelectorAll('.cat')) b.classList.toggle('on', false);
    this.markToolButtons();
  }
  trayItems(cat) {
    const g = this.g;
    const items = [];
    if (cat === 'roads') {
      for (const t of [R.LANE, R.STREET, R.AVENUE]) {
        const d = ROADS[t];
        const locked = t === R.AVENUE && !g.isUnlocked('avenue') ? g.lockReason('zone4') : null;
        items.push({ kind: 'road', type: t, name: d.name, cost: `${fmtMoney(d.cost * g.costMul)} / Feld`, desc: d.desc, color: '#5d6470', locked });
      }
    } else if (cat === 'zones') {
      for (const z of [1, 2, 3, 4]) {
        const locked = z === 4 && !g.isUnlocked('zone4') ? g.lockReason('zone4') : null;
        const desc = { 1: 'Hier ziehen Menschen ein. Braucht Strom, Wasser und Jobs in der Nähe.', 2: 'Läden und Kaufhäuser. Leben von Kundschaft und Waren.', 3: 'Fabriken schaffen Jobs, machen aber Abgase. Auf Erz oder fruchtbarem Boden entstehen Bergwerke und Höfe.', 4: 'Saubere Büros für gebildete Arbeitskräfte.' }[z];
        items.push({ kind: 'zone', zone: z, name: ZONE_INFO[z].name, cost: `${fmtMoney(2 * g.costMul)} / Feld`, desc, color: hex(ZONE_INFO[z].color), locked });
      }
      items.push({ kind: 'dezone', name: 'Zonen entfernen', cost: 'kostenlos', desc: 'Entfernt Zonen von unbebauten Feldern.', color: '#9a9a9a' });
    } else if (cat === 'transit') {
      const locked = g.isUnlocked('transit') ? null : g.lockReason('station');
      items.push({ kind: 'line', name: 'Linie zeichnen', cost: `ab ${fmtMoney(TRANSIT.lineCost * g.costMul)}`, desc: 'Stationen nacheinander anklicken – leere Felder bekommen automatisch eine Station. Rechtsklick oder Enter beendet.', color: '#e8543f', locked });
      items.push({ kind: 'place', key: 'station', name: BUILDINGS.station.name, cost: fmtMoney(g.buildingCost('station')), desc: BUILDINGS.station.desc, color: '#e8543f', locked });
      items.push({ kind: 'panel', panel: 'transit', name: 'Linien verwalten', cost: `${g.transit.lines.length} / ${g.transit.linesMax} Linien`, desc: 'Züge und Waggons einsetzen, Linien verlängern.', color: '#2f8fe0', locked });
    } else {
      for (const [key, d] of Object.entries(BUILDINGS)) {
        if (d.cat !== cat || key === 'station') continue;
        const locked = g.isUnlocked(key) ? (d.unique && g.hasBuilt(key) ? 'Schon gebaut' : null) : g.lockReason(key);
        let desc = d.desc;
        const facts = [];
        if (d.power) facts.push(`${d.power} MW`);
        if (d.water) facts.push(`${d.water} m³`);
        if (d.service) facts.push(`Radius ${d.service.radius}`);
        if (d.upkeep) facts.push(`${fmtMoney(d.upkeep * g.upkeepMul())}/Tag`);
        items.push({ kind: 'place', key, name: d.name, cost: fmtMoney(g.buildingCost(key)), desc, facts: facts.join(' · '), color: CAT_COLOR[cat], locked, tag: d.landmark && g.landmarkVouchers.has(key) ? '−50 %' : '' });
      }
    }
    return items;
  }
  renderTray() {
    const items = this.trayItems(this.cat);
    const t = this.app.input.tool;
    this.el.tray.innerHTML = items.map((it, i) => {
      const on = (it.kind === t.kind) && ((it.kind === 'road' && t.type === it.type) || (it.kind === 'zone' && t.zone === it.zone) || (it.kind === 'place' && t.key === it.key) || it.kind === 'dezone' || it.kind === 'line');
      return `<button class="item${on ? ' on' : ''}${it.locked ? ' locked' : ''}" data-i="${i}" data-kind="${it.kind}" data-type="${it.type || ''}" data-zone="${it.zone || ''}" data-key="${it.key || ''}" data-panel="${it.panel || ''}" ${it.locked ? 'data-locked="1"' : ''} title="${esc(it.desc)}">
        ${it.tag ? `<span class="tag">${it.tag}</span>` : ''}
        <span class="sw" style="background:${it.color}"></span>
        <span class="n">${esc(it.name)}</span>
        <span class="c">${it.cost}</span>
        ${it.locked ? `<span class="lock">${esc(it.locked)}</span>` : `<span class="x">${esc(it.facts || it.desc).slice(0, 90)}</span>`}
      </button>`;
    }).join('');
  }
  pickItem(ds) {
    if (ds.locked) { this.toast('Noch nicht freigeschaltet.', 'bad'); return; }
    const input = this.app.input;
    if (ds.kind === 'road') input.setTool({ kind: 'road', type: +ds.type });
    else if (ds.kind === 'zone') input.setTool({ kind: 'zone', zone: +ds.zone });
    else if (ds.kind === 'dezone') input.setTool({ kind: 'dezone' });
    else if (ds.kind === 'place') input.setTool({ kind: 'place', key: ds.key });
    else if (ds.kind === 'line') input.setTool({ kind: 'line' });
    else if (ds.kind === 'panel') this.openPanel(ds.panel);
    this.renderTray();
  }
  toolChanged(tool) {
    if (tool.kind === 'select' && this.cat) this.closeTray();
    if (this.cat) this.renderTray();
    this.markToolButtons();
    if (tool.kind === 'line' && this.view === 'none') this.setView('transit', true);
    if (tool.kind !== 'line' && tool.kind !== 'extend' && this.autoTransitView) this.setView('none');
  }
  markToolButtons() {
    const k = this.app.input ? this.app.input.tool.kind : 'select';
    for (const b of this.el.cats.querySelectorAll('.cat[data-tool]')) b.classList.toggle('on', b.dataset.tool === k && !this.cat);
  }

  // ---------- Infoansichten
  setView(id, auto = false) {
    this.view = id;
    this.autoTransitView = auto;
    this.app.engine.overlay.setMode(id);
    for (const b of this.el.views.querySelectorAll('button')) b.classList.toggle('on', b.dataset.view === id);
    const def = OVERLAYS.find((o) => o.id === id);
    if (id === 'none' || !def) { this.el.legend.hidden = true; return; }
    const bad = def.bad;
    const ramp = id === 'resources' ? 'linear-gradient(90deg,#78be46,#966e5a)' : `linear-gradient(90deg, ${bad ? '#45c46b, #f2c230, #e5483c' : '#e5483c, #f2c230, #45c46b'})`;
    const ends = id === 'resources' ? ['fruchtbar', 'Erz'] : bad ? ['gering', 'hoch'] : id === 'traffic' ? ['frei', 'Stau'] : ['schlecht', 'gut'];
    const r2 = id === 'traffic' ? 'linear-gradient(90deg,#45c46b,#f2c230,#e5483c)' : ramp;
    this.el.legend.innerHTML = `<h4>${def.name}</h4><div class="ramp" style="background:${r2}"></div><div class="ends"><span>${ends[0]}</span><span>${ends[1]}</span></div><p>${VIEW_TEXT[id] || ''}</p>`;
    this.el.legend.hidden = false;
  }

  // ---------- Kopfzeile
  refreshHUD() {
    const g = this.g, s = g.stats;
    const ms = MILESTONES[g.milestone], next = MILESTONES[g.milestone + 1];
    this.el.rank.textContent = next ? `${ms.name} → ${next.name} (${fmt(next.pop)})` : ms.name;
    this.el.rankbar.style.width = next ? `${clamp((s.pop - ms.pop) / (next.pop - ms.pop), 0, 1) * 100}%` : '100%';
    this.el.pop.textContent = fmt(s.pop);
    const hist = g.history;
    const prev = hist.length >= 2 ? hist[hist.length - 2].pop : 0;
    const dp = hist.length ? hist[hist.length - 1].pop - prev : 0;
    this.el.popd.textContent = hist.length >= 2 ? `${dp >= 0 ? '+' : '−'}${fmt(Math.abs(dp))} / Tag` : '';
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
    this.el.riders.textContent = fmt(s.ridersToday || 0);
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
    }
  }

  refreshTutorial() {
    const g = this.g;
    if (this.tutorialHidden || g.sandbox || this.cat || this.panel) { this.el.tutorial.hidden = true; return; }
    let roads = 0;
    for (let i = 0; i < g.N; i++) if (g.road[i] && g.road[i] !== R.HIGHWAY) roads++;
    let res = 0, other = 0;
    for (let i = 0; i < g.N; i++) { if (g.zone[i] === 1) res++; else if (g.zone[i] === 2 || g.zone[i] === 3) other++; }
    const has = (cat) => g.countBuilt(cat) > 0;
    const steps = [
      [roads > 0, 'Ziehe eine Straße vom Ende der Autobahn ins Land (Straßen → Straße).'],
      [res > 0 || g.stats.countByZone[1] > 0, 'Weise entlang der Straße Wohngebiet aus (Zonen → Wohnen).'],
      [other > 0 || g.stats.countByZone[2] + g.stats.countByZone[3] > 0, 'Gewerbe und Industrie schaffen Jobs – mit etwas Abstand zum Wohnen.'],
      [has('power'), 'Baue ein Kraftwerk an einer Straße. Strom fließt durchs Straßennetz.'],
      [has('water'), 'Sorge für Wasser: Wasserturm oder Pumpwerk am Ufer.'],
      [has('garbage'), 'Eine Deponie hält die Straßen sauber.'],
      [g.milestone >= 1, `Erreiche ${MILESTONES[1].pop} Einwohner. Danach gibt es jede Woche eine Wochenkarte.`],
      [g.transit.lines.length > 0, 'Ab „Kleinstadt": Zeichne die erste Pulsbahn-Linie zwischen Wohnen und Arbeit.'],
    ];
    const firstOpen = steps.findIndex((s) => !s[0]);
    if (firstOpen < 0) { this.el.tutorial.hidden = true; return; }
    this.el.tutorial.hidden = false;
    this.el.tutorial.innerHTML = `<h4><span>Erste Schritte</span><button class="close" data-act="hidetut" title="Ausblenden">${icon('close', 16)}</button></h4><ol>${steps.map((s, i) => `<li class="${s[0] ? 'done' : i === firstOpen ? 'now' : ''}">${s[1]}</li>`).join('')}</ol>`;
  }

  // ---------- Nachrichten
  onNews(n) {
    this.el.ticker.hidden = false;
    this.el.tickwho.textContent = n.author;
    this.el.ticktxt.textContent = n.text;
    this.el.tickpip.style.background = n.mood === 'bad' ? 'var(--bad)' : n.mood === 'good' ? 'var(--good)' : 'var(--l-blue)';
    if (this.panel !== 'news') this.el.newsdot.hidden = false;
    else this.renderPanel();
    if (n.kind !== 'chatter' && n.kind !== 'report' && n.kind !== 'card') {
      this.toast(n.text, n.mood === 'bad' ? 'bad' : n.mood === 'good' ? 'good' : '');
      if (n.mood === 'bad') this.app.audio.play('bad');
    }
  }

  // ---------- Tooltip, Toasts
  tooltip(text, mouse, ok = true) {
    if (!text || !mouse) { this.tip.hidden = true; return; }
    this.tip.hidden = false;
    this.tip.textContent = text;
    this.tip.className = ok ? '' : 'bad';
    const w = this.tip.offsetWidth;
    const x = Math.min(mouse.x, window.innerWidth - w - 24);
    this.tip.style.left = x + 'px';
    this.tip.style.top = mouse.y + 'px';
  }
  toast(msg, type = '') {
    const d = document.createElement('div');
    d.className = 'toast ' + type;
    d.textContent = msg;
    this.toasts.appendChild(d);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    setTimeout(() => { d.style.transition = 'opacity 0.4s'; d.style.opacity = '0'; setTimeout(() => d.remove(), 400); }, 3200);
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
  togglePanel(name) { if (this.panel === name) this.closePanels(); else this.openPanel(name); }
  openPanel(name) {
    this.panel = name;
    for (const b of this.el.menu.querySelectorAll('button')) b.classList.toggle('on', b.dataset.panel === name);
    if (name === 'news') this.el.newsdot.hidden = true;
    this.el.panel.hidden = false;
    this.el.insp.hidden = true;
    this.sel = null;
    this.app.engine.overlay.select(null);
    this.renderPanel();
  }
  closePanels() {
    this.panel = null;
    this.el.panel.hidden = true;
    for (const b of this.el.menu.querySelectorAll('button')) b.classList.remove('on');
    this.closeInspector();
  }

  renderPanel() {
    if (!this.panel) return;
    const fn = { budget: this.pBudget, stats: this.pStats, policies: this.pPolicies, transit: this.pTransit, news: this.pNews, settings: this.pSettings }[this.panel];
    const titles = { budget: 'Haushalt', stats: 'Statistik', policies: 'Verordnungen', transit: 'Pulsbahn', news: 'Stadtfunk', settings: 'Optionen & Hilfe' };
    const body = fn.call(this);
    const scroll = this.el.panel.querySelector('.body')?.scrollTop || 0;
    this.el.panel.innerHTML = `<header><h2>${titles[this.panel]}</h2><button class="close" data-act="close">${icon('close', 18)}</button></header><div class="body">${body}</div>`;
    this.el.panel.querySelector('.body').scrollTop = scroll;
    if (this.panel === 'stats') this.drawCharts();
  }

  pBudget() {
    const g = this.g, b = g.budget();
    const line = (k, v, neg) => `<div class="row"><span class="grow">${k}</span><span class="val ${neg ? 'neg' : ''}">${neg ? '−' : ''}${fmtMoney(v)}</span></div>`;
    const taxes = [1, 2, 3, 4].map((z) => `<div class="slider"><label><span class="zdot" style="background:${hex(ZONE_INFO[z].color)}"></span> ${ZONE_INFO[z].name}</label><input type="range" min="0" max="25" step="1" value="${g.taxes[z]}" data-tax="${z}" id="tax-${z}"><span class="val num">${g.taxes[z]} %</span></div>`).join('');
    const loans = g.loans.map((l, i) => `<div class="row"><span class="grow">${fmtMoney(l.amount)} · noch ${l.weeksLeft} Wochen<br><span style="font-size:12px;color:var(--ink-3)">Tilgung ${fmtMoney(l.amount / l.weeks)} + Zinsen ${fmtMoney(l.weekly)} pro Woche</span></span><button class="btn small ghost" data-act="repay" data-i="${i}">Ablösen</button></div>`).join('');
    const offers = LOANS.map((l, i) => `<div class="row"><span class="grow">${fmtMoney(l.amount)} über ${l.weeks} Wochen · ${(l.rate * 100).toFixed(1).replace('.', ',')} % Zins/Woche</span><button class="btn small" data-act="loan" data-i="${i}" ${g.loans.length >= 3 || !g.isUnlocked('loans') ? 'disabled' : ''}>Aufnehmen</button></div>`).join('');
    return `
<div class="sec"><h3>Bilanz pro Tag</h3>
  <div class="row"><span class="grow" style="font-weight:700">Saldo</span><span class="val ${b.net < 0 ? 'neg' : 'pos'}" style="font-size:20px">${b.net >= 0 ? '+' : '−'}${fmtMoney(Math.abs(b.net))}</span></div>
</div>
<div class="sec"><h3>Einnahmen · ${fmtMoney(b.income)}</h3>
  ${line('Steuern Wohnen', b.inc.res)}${line('Steuern Gewerbe', b.inc.com)}${line('Steuern Industrie', b.inc.ind)}${line('Steuern Büro', b.inc.off)}${line('Tourismus', b.inc.tourism)}${line('Pulsbahn-Tickets', b.inc.fares)}
</div>
<div class="sec"><h3>Ausgaben · ${fmtMoney(b.expense)}</h3>
  ${line('Dienste & Versorgung', b.exp.services, true)}${line('Straßenunterhalt', b.exp.roads, true)}${line('Pulsbahn', b.exp.transit, true)}${line('Verordnungen', b.exp.policies, true)}${line('Kreditzinsen', b.exp.loans, true)}
</div>
<div class="sec"><h3>Steuersätze</h3>${taxes}<p style="font-size:12.5px;color:var(--ink-3);margin:6px 0 0">Über 10 % sinken Nachfrage und Glück spürbar.</p></div>
<div class="sec"><h3>Kredite</h3>${loans || '<p style="color:var(--ink-3);margin:0 0 6px">Keine laufenden Kredite.</p>'}<div class="rule"></div>${g.isUnlocked('loans') ? offers : `<p style="color:var(--ink-3);margin:0">${g.lockReason('zone4')}</p>`}</div>`;
  }

  pStats() {
    const g = this.g, s = g.stats, u = g.util;
    const tabs = [['pop', 'Einwohner'], ['money', 'Kasse'], ['net', 'Saldo'], ['happy', 'Glück'], ['riders', 'Fahrgäste'], ['flow', 'Verkehrsfluss']];
    const meter = (v, max, col) => `<div class="meter"><i style="width:${clamp(v / Math.max(1, max), 0, 1) * 100}%;background:${col}"></i></div>`;
    const counts = s.countByZone;
    return `
<div class="sec"><h3>Verlauf</h3>
  <div class="chart-tabs">${tabs.map(([k, n]) => `<button data-act="chart" data-k="${k}" class="${this.chartKey === k ? 'on' : ''}">${n}</button>`).join('')}</div>
  <canvas class="chart" id="chart-main"></canvas>
</div>
<div class="sec"><h3>Versorgung</h3>
  <div class="kv"><span>Strom ${fmt(u.powerDemand)} / ${fmt(u.powerSupply)} MW</span><span class="v ${u.powerDemand > u.powerSupply ? 'neg' : ''}">${u.powerSupply ? Math.round((u.powerDemand / u.powerSupply) * 100) : 0} %</span></div>
  ${meter(u.powerDemand, u.powerSupply, u.powerDemand > u.powerSupply ? 'var(--bad)' : 'var(--l-yellow)')}
  <div class="kv" style="margin-top:8px"><span>Wasser ${fmt(u.waterDemand)} / ${fmt(u.waterSupply)} m³</span><span class="v ${u.waterDemand > u.waterSupply ? 'neg' : ''}">${u.waterSupply ? Math.round((u.waterDemand / u.waterSupply) * 100) : 0} %</span></div>
  ${meter(u.waterDemand, u.waterSupply, u.waterDemand > u.waterSupply ? 'var(--bad)' : 'var(--l-blue)')}
</div>
<div class="sec"><h3>Bevölkerung & Arbeit</h3>
  <div class="kv">
    <span>Einwohner</span><span class="v">${fmt(s.pop)}</span>
    <span>Arbeitskräfte</span><span class="v">${fmt(s.workers)}</span>
    <span>Arbeitsplätze (G / I / B)</span><span class="v">${fmt(s.jobsByZone[2])} / ${fmt(s.jobsByZone[3])} / ${fmt(s.jobsByZone[4])}</span>
    <span>Arbeitslosigkeit</span><span class="v">${Math.round(s.unemployment * 100)} %</span>
    <span>Bildung (Ø)</span><span class="v">${Math.round(s.edu * 100)} %</span>
    <span>Touristen pro Tag</span><span class="v">${fmt(s.tourism)}</span>
  </div>
</div>
<div class="sec"><h3>Gebäude</h3>
  <div class="kv">
    ${[1, 2, 3, 4].map((z) => `<span><span class="zdot" style="background:${hex(ZONE_INFO[z].color)}"></span> ${ZONE_INFO[z].name}</span><span class="v">${fmt(counts[z])}</span>`).join('')}
    <span>Verlassen</span><span class="v ${s.abandoned ? 'neg' : ''}">${fmt(s.abandoned)}</span>
    <span>Ohne Strom / Wasser</span><span class="v ${s.unpowered + s.unwatered ? 'neg' : ''}">${fmt(s.unpowered)} / ${fmt(s.unwatered)}</span>
  </div>
</div>
<div class="sec"><h3>Aktive Effekte</h3>${g.effects.length ? g.effects.map((e) => `<div class="row"><span class="grow">${esc(e.label)}</span><span class="val">noch ${Math.max(1, Math.ceil((e.until - g.time) / 1440))} T.</span></div>`).join('') : '<p style="color:var(--ink-3);margin:0">Keine.</p>'}</div>`;
  }

  drawCharts() {
    const c = document.getElementById('chart-main');
    if (!c) return;
    const h = this.g.history;
    const k = this.chartKey;
    const vals = h.map((e) => e[k] ?? 0);
    const col = { pop: '#4fae67', money: '#c98a0c', net: '#2f8fe0', happy: '#f06fae', riders: '#e8543f', flow: '#5d6470' }[k];
    drawLineChart(c, vals, { color: col, zero: k === 'net' || k === 'money', startLabel: h.length ? `Tag ${h[0].d}` : '', endLabel: h.length ? `Tag ${h[h.length - 1].d}` : '', fmt: (v) => (Math.abs(v) >= 10000 ? fmtShort(v) : Math.round(v).toLocaleString('de-DE')) + (k === 'happy' || k === 'flow' ? ' %' : '') });
  }

  pPolicies() {
    const g = this.g;
    return `<p style="margin:0 0 10px;color:var(--ink-2);line-height:1.45">Verordnungen gelten für die ganze Stadt. Die Kosten steigen mit der Einwohnerzahl.</p>` + POLICIES.map((p) => {
      const locked = !g.sandbox && g.milestone < p.unlock;
      const on = g.policies.has(p.id);
      const cost = p.cost * (g.stats.pop / 100);
      return `<div class="toggle${locked ? ' locked' : ''}"><button class="switch${on ? ' on' : ''}" data-act="policy" data-id="${p.id}" ${locked ? 'disabled' : ''} aria-label="${esc(p.name)}"></button><div class="grow"><div class="t">${esc(p.name)}</div><div class="s">${esc(p.desc)} ${p.cost ? `· ${fmtMoney(cost)}/Tag` : '· kostenlos'}${locked ? ` · ab „${MILESTONES[p.unlock].name}"` : ''}</div></div></div>`;
    }).join('');
  }

  pTransit() {
    const g = this.g, tr = g.transit;
    if (!g.isUnlocked('transit')) {
      return `<p style="line-height:1.5;color:var(--ink-2)">Die <b>Pulsbahn</b> ist eine Hochbahn, die über den Dächern fährt. Sie wird ab „${MILESTONES[2].name}" (${fmt(MILESTONES[2].pop)} Einwohner) freigeschaltet.</p>
<p style="line-height:1.5;color:var(--ink-2)">Fahrgäste warten an den Stationen. Ihre Form zeigt das Ziel: <b>●</b> nach Hause, <b>▲</b> zum Einkaufen, <b>■</b> in die Industrie, <b>◆</b> ins Büro. Ist eine Station zu lange überfüllt, geben die Leute auf und die Gegend wird unzufrieden.</p>`;
    }
    const linesHtml = tr.lines.map((l) => {
      const ts = tr.trains.filter((t) => t.line === l.id);
      const wag = ts.reduce((a, t) => a + t.wagons, 0);
      const pax = ts.reduce((a, t) => a + t.pax.length, 0);
      const cap = ts.reduce((a, t) => a + tr.trainCapacity(t), 0);
      const col = hex(LINE_COLORS[l.color]);
      const stops = l.stops.map((id) => tr.stations.get(id)).filter(Boolean);
      return `<div class="line-card">
  <div class="hd"><span class="badge" style="background:${col}">${l.id}</span><div class="grow"><div class="ttl">Linie ${LINE_COLOR_NAMES[l.color]}${l.loop ? ' · Ring' : ''}</div><div class="sub">${stops.length} Stationen · ${l.length.toFixed(0)} Felder · gestern ${fmt(l.riders)} Fahrgäste</div></div></div>
  <div class="stops" style="color:${col}">${stops.map((s) => `<span style="color:var(--ink)">${esc(s.name)}${s.waiting.length > 10 ? ` <b style="color:var(--bad)">(${s.waiting.length})</b>` : ''}</span>`).join('')}</div>
  <div class="ctrl">
    <span>Züge: <b>${ts.length}</b> · Auslastung ${cap ? Math.round((pax / cap) * 100) : 0} %</span>
    <span class="grp"><button class="mini" data-act="train-" data-l="${l.id}" ${ts.length <= 1 ? 'disabled' : ''}>${icon('minus', 14, 2.6)}</button><button class="mini" data-act="train+" data-l="${l.id}" title="${tr.freeTrains > 0 ? 'Aus dem Depot' : fmtMoney(TRANSIT.trainCost * g.costMul)}">${icon('plus', 14, 2.6)}</button></span>
    <span>Waggons: <b>${wag}</b> (+${TRANSIT.wagonCapacity} Plätze je Waggon)</span>
    <span class="grp"><button class="mini" data-act="wagon+" data-l="${l.id}" title="${tr.freeWagons > 0 ? 'Aus dem Depot' : fmtMoney(TRANSIT.wagonCost * g.costMul)}">${icon('plus', 14, 2.6)}</button></span>
  </div>
  <div class="acts">
    ${l.loop ? '' : `<button class="btn small ghost" data-act="extend" data-l="${l.id}" data-start="1">Anfang verlängern</button><button class="btn small ghost" data-act="extend" data-l="${l.id}" data-start="0">Ende verlängern</button>`}
    <button class="btn small ghost" data-act="delline" data-l="${l.id}" style="color:var(--bad)">${this.confirmDel === l.id ? 'Wirklich löschen?' : 'Löschen'}</button>
  </div>
</div>`;
    }).join('');
    return `
<div class="res-strip"><div><div class="k">Linien</div><div class="v">${tr.lines.length} / ${tr.linesMax}</div></div><div><div class="k">Züge im Depot</div><div class="v">${tr.freeTrains}</div></div><div><div class="k">Waggons</div><div class="v">${tr.freeWagons}</div></div></div>
<div class="acts" style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap"><button class="btn" data-act="newline" ${tr.lines.length >= tr.linesMax ? 'disabled' : ''}>${icon('line', 16)} Neue Linie zeichnen</button><button class="btn ghost" data-act="station">${icon('station', 16)} Station setzen</button></div>
${linesHtml || '<p style="color:var(--ink-2);line-height:1.5">Noch keine Linie. Klicke auf „Neue Linie zeichnen" und dann nacheinander auf Felder in Wohn- und Arbeitsvierteln. Ein Klick auf die erste Station schließt einen Ring.</p>'}
<div class="sec" style="margin-top:14px"><h3>So funktioniert es</h3><p style="font-size:13px;line-height:1.5;color:var(--ink-2);margin:0">Jede Station sammelt Fahrgäste im Umkreis von ${TRANSIT.catchment} Feldern. Symbole über den Stationen zeigen das Ziel: ● Wohnen, ▲ Gewerbe, ■ Industrie, ◆ Büro. Wird eine Station zu voll, läuft ein roter Ring – mehr Züge oder Waggons helfen. Unter der Trasse wachsen Gebäude höchstens bis Stufe ${TRANSIT.maxLevelUnderTrack}.</p></div>`;
  }

  pNews() {
    const g = this.g;
    const list = [...g.newsLog].reverse();
    if (!list.length) return '<p style="color:var(--ink-3)">Noch ist es ruhig in der Stadt.</p>';
    return list.map((n, i) => {
      const off = n.author === 'Stadtfunk';
      const ini = off ? 'SF' : n.author.split(' ').map((p) => p[0]).join('');
      const col = off ? (n.mood === 'bad' ? '#d4433a' : n.mood === 'good' ? '#2b9a57' : '#1d2330') : AV_COLORS[(n.author.length + i) % AV_COLORS.length];
      const day = Math.floor(n.time / 1440);
      const hh = String(Math.floor((n.time % 1440) / 60)).padStart(2, '0');
      return `<div class="post"><span class="av" style="background:${col}">${esc(ini)}</span><div><div class="who">${esc(n.author)}<span class="when">Tag ${day}, ${hh} Uhr</span></div><div class="txt">${esc(n.text)}</div></div></div>`;
    }).join('');
  }

  pSettings() {
    const s = this.app.settings;
    const slots = [1, 2, 3].map((k) => {
      const meta = this.app.slotMeta(k);
      return `<div class="slot"><div class="grow"><div class="t">Platz ${k}${meta ? ': ' + esc(meta.name) : ''}</div><div class="s">${meta ? `${fmt(meta.pop)} Einwohner · ${new Date(meta.savedAt).toLocaleString('de-DE')}` : 'leer'}</div></div><button class="btn small" data-act="save" data-k="${k}">Speichern</button>${meta ? `<button class="btn small ghost" data-act="load" data-k="${k}">Laden</button>` : ''}</div>`;
    }).join('');
    return `
<div class="sec"><h3>Spielstand</h3>${slots}
  <div class="acts" style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn small ghost" data-act="export">Als Datei exportieren</button><button class="btn small ghost" data-act="copy">In Zwischenablage</button><button class="btn small ghost" data-act="tomenu">Hauptmenü</button></div>
  <p style="font-size:12px;color:var(--ink-3);margin:8px 0 0">Automatisch gespeichert wird jeden Spieltag.</p>
</div>
<div class="sec"><h3>Klang</h3>
  <div class="slider"><label>Gesamt</label><input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-set="volume" id="set-volume"><span class="val num">${Math.round(s.volume * 100)}</span></div>
  <div class="slider"><label>Musik</label><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-set="music" id="set-music"><span class="val num">${Math.round(s.music * 100)}</span></div>
  <div class="slider"><label>Effekte</label><input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-set="sfx" id="set-sfx"><span class="val num">${Math.round(s.sfx * 100)}</span></div>
  <div class="toggle"><button class="switch${s.muted ? '' : ' on'}" data-act="mute" aria-label="Ton"></button><div class="grow"><div class="t">Ton an</div><div class="s">Taste M schaltet stumm.</div></div></div>
</div>
<div class="sec"><h3>Darstellung</h3>
  <div class="toggle"><button class="switch${s.alwaysDay ? ' on' : ''}" data-act="alwaysDay" aria-label="Immer Tag"></button><div class="grow"><div class="t">Immer Tag</div><div class="s">Schaltet den Tag-Nacht-Wechsel ab.</div></div></div>
  <div class="toggle"><button class="switch${this.app.engine.effects.showIcons ? ' on' : ''}" data-act="icons" aria-label="Symbole"></button><div class="grow"><div class="t">Problem-Symbole</div><div class="s">Blitz, Tropfen, Müll und Co. über Gebäuden (Taste I).</div></div></div>
  <div class="field" style="margin-top:8px"><label for="set-quality">Grafikqualität (ab nächster Stadt)</label><select id="set-quality" data-set="quality"><option value="high" ${s.quality === 'high' ? 'selected' : ''}>Hoch – feine Schatten</option><option value="medium" ${s.quality === 'medium' ? 'selected' : ''}>Mittel</option><option value="low" ${s.quality === 'low' ? 'selected' : ''}>Niedrig – ohne Schatten</option></select></div>
</div>
<div class="sec help"><h3>Steuerung</h3>
  <div class="keys">
    <kbd>Rechte Maus</kbd><span>Karte verschieben</span>
    <kbd>Mittlere Maus / Alt+Links</kbd><span>Drehen und neigen</span>
    <kbd>Mausrad</kbd><span>Zoomen</span>
    <kbd>W A S D</kbd><span>Kamera bewegen</span>
    <kbd>Q / E</kbd><span>Kamera drehen</span>
    <kbd>Leertaste</kbd><span>Pause</span>
    <kbd>1 2 3</kbd><span>Geschwindigkeit</span>
    <kbd>R</kbd><span>Gebäude drehen</span>
    <kbd>B</kbd><span>Abriss</span>
    <kbd>Esc</kbd><span>Werkzeug abbrechen</span>
    <kbd>Strg+S</kbd><span>Schnellspeichern</span>
  </div>
  <h4>So wächst deine Stadt</h4>
  <ul>
    <li>Zonen brauchen eine Straße höchstens zwei Felder entfernt, die mit der Autobahn verbunden ist.</li>
    <li>Strom und Wasser fließen durch das Straßennetz. Ein getrenntes Straßennetz braucht eigene Kraftwerke.</li>
    <li>Gebäude steigen auf, wenn Bodenwert, Bildung und Glück stimmen. Höhere Stufen werden mit Meilensteinen frei.</li>
    <li>Die Nachfrage-Balken (W G I B) zeigen, was die Stadt gerade braucht.</li>
    <li>Jeden Montag wählst du eine von drei Wochenkarten. Gelegentlich musst du über Ereignisse entscheiden.</li>
  </ul>
</div>`;
  }

  panelClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const g = this.g, act = b.dataset.act;
    this.app.audio.play('click');
    const res = (r) => { if (r && r.ok === false && r.msg) this.toast(r.msg, 'bad'); };
    switch (act) {
      case 'close': this.closePanels(); return;
      case 'loan': if (g.takeLoan(+b.dataset.i)) { this.toast('Kredit aufgenommen.', 'good'); this.app.audio.play('money'); } break;
      case 'repay': if (!g.repayLoan(+b.dataset.i)) this.toast('Nicht genug Geld zum Ablösen.', 'bad'); break;
      case 'chart': this.chartKey = b.dataset.k; break;
      case 'policy': g.togglePolicy(b.dataset.id); break;
      case 'newline': this.app.input.setTool({ kind: 'line' }); this.closePanels(); this.toast('Klicke nacheinander auf Stationen oder freie Felder. Rechtsklick beendet die Linie.'); return;
      case 'station': this.app.input.setTool({ kind: 'place', key: 'station' }); this.closePanels(); return;
      case 'train+': res(g.addTrain(+b.dataset.l)); break;
      case 'train-': res(g.removeTrain(+b.dataset.l)); break;
      case 'wagon+': res(g.addWagon(+b.dataset.l)); break;
      case 'extend': this.app.input.setTool({ kind: 'extend', line: +b.dataset.l, atStart: b.dataset.start === '1' }); this.closePanels(); this.toast('Klicke auf Stationen oder freie Felder, um die Linie zu verlängern. Rechtsklick beendet.'); return;
      case 'delline': if (this.confirmDel === +b.dataset.l) { g.removeLine(+b.dataset.l); this.confirmDel = null; } else { this.confirmDel = +b.dataset.l; setTimeout(() => { this.confirmDel = null; }, 4000); } break;
      case 'save': this.app.save(+b.dataset.k); this.toast(`Gespeichert in Platz ${b.dataset.k}.`, 'good'); break;
      case 'load': this.app.loadSlot(+b.dataset.k); return;
      case 'export': this.app.exportSave(); break;
      case 'copy': this.app.copySave(); break;
      case 'tomenu': this.app.toMenu(); return;
      case 'mute': this.app.settings.muted = !this.app.settings.muted; this.app.audio.applyVolumes(); this.app.saveSettings(); break;
      case 'alwaysDay': this.app.settings.alwaysDay = !this.app.settings.alwaysDay; this.app.saveSettings(); break;
      case 'icons': this.app.engine.effects.showIcons = !this.app.engine.effects.showIcons; break;
    }
    this.renderPanel();
    this.refreshHUD();
  }
  panelInput(e) {
    const t = e.target;
    if (t.dataset.tax) {
      this.g.setTax(+t.dataset.tax, +t.value);
      t.nextElementSibling.textContent = `${t.value} %`;
    } else if (t.dataset.set && t.type === 'range') {
      this.app.settings[t.dataset.set] = +t.value;
      t.nextElementSibling.textContent = Math.round(t.value * 100);
      this.app.audio.applyVolumes();
    }
  }
  panelChange(e) {
    const t = e.target;
    if (t.dataset.tax) this.renderPanel();
    else if (t.dataset.set) {
      if (t.dataset.set === 'quality') { this.app.settings.quality = t.value; this.toast('Gilt ab der nächsten geladenen Stadt.'); }
      this.app.saveSettings();
    }
  }

  // ---------- Inspektor
  inspect(sel) {
    if (!sel) { this.closeInspector(); return; }
    this.sel = sel;
    this.renderInspector();
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
    return null;
  }
  closeInspector() {
    this.sel = null;
    this.el.insp.hidden = true;
    this.app.engine.overlay.select(null);
  }

  renderInspector() {
    const s = this.sel, g = this.g;
    if (!s) return;
    let html = '';
    if (s.type === 'building') {
      const b = g.buildings.get(s.id);
      if (!b) { this.closeInspector(); return; }
      html = b.zone ? this.inspZone(b) : this.inspService(b);
    } else if (s.type === 'station') {
      const st = g.transit.stations.get(s.id);
      if (!st) { this.closeInspector(); return; }
      html = this.inspStation(st);
    } else if (s.type === 'road') {
      const i = s.i, r = g.road[i];
      if (!r) { this.closeInspector(); return; }
      const d = ROADS[r];
      const cong = g.congestion[i];
      html = `<div class="stripe" style="background:#5d6470"></div><header><div class="grow"><h2>${d.name}</h2><div class="sub">${g.world.terrain[i] === T.WATER ? 'Brücke · ' : ''}Feld ${i % g.W}, ${Math.floor(i / g.W)}</div></div><button class="close" data-act="close">${icon('close', 16)}</button></header>
<div class="body"><div class="kv"><span>Verkehr pro Stunde</span><span class="v">${fmt(g.trafficLoad[i])}</span><span>Kapazität</span><span class="v">${fmt(d.capacity)}</span><span>Auslastung</span><span class="v ${cong > 0.9 ? 'neg' : ''}">${Math.round(cong * 100)} %</span></div>
<p style="font-size:12.5px;color:var(--ink-2);line-height:1.45;margin:8px 0 0">${esc(d.desc)}</p></div>`;
    } else if (s.type === 'tile') {
      const i = s.i;
      const ter = ['Wiese', 'Wasser', 'Strand', 'Fels'][g.world.terrain[i]];
      const res = g.world.resource[i] === RES.FERTILE ? 'fruchtbarer Boden' : g.world.resource[i] === RES.ORE ? 'Erzvorkommen' : '';
      html = `<div class="stripe" style="background:#9bc887"></div><header><div class="grow"><h2>${ter}${res ? ' · ' + res : ''}</h2><div class="sub">Feld ${i % g.W}, ${Math.floor(i / g.W)}${g.zone[i] ? ' · Zone ' + ZONE_INFO[g.zone[i]].name : ''}</div></div><button class="close" data-act="close">${icon('close', 16)}</button></header>
<div class="body"><div class="kv"><span>Bodenwert</span><span class="v">${Math.round(g.fields.landValue[i])}</span><span>Verschmutzung</span><span class="v">${Math.round(g.fields.pollution[i] * 100)} %</span><span>Lärm</span><span class="v">${Math.round(g.fields.noise[i] * 100)} %</span>${g.world.trees[i] ? '<span>Wald</span><span class="v">ja</span>' : ''}</div>
${g.zone[i] && !g.bld[i] ? `<p style="font-size:12.5px;color:var(--ink-2);margin:8px 0 0">${g.access[i] < 0 ? 'Keine Straße in Reichweite (max. 2 Felder).' : g.roadComp[g.access[i]] !== g.outsideComp ? 'Die Straße ist nicht mit der Autobahn verbunden.' : g.demand[g.zone[i]] <= 4 ? 'Wartet auf Nachfrage.' : 'Bereit zum Bebauen.'}</p>` : ''}</div>`;
    }
    this.el.insp.innerHTML = html;
    this.el.insp.hidden = false;
    this.app.engine.overlay.select(this.selectedBox());
  }

  inspZone(b) {
    const g = this.g, i = b.y * g.W + b.x;
    const col = hex(ZONE_INFO[b.zone].color);
    let title = ZONE_LEVEL_NAMES[b.zone][b.level];
    if (b.spec === 'farm') title = 'Bauernhof'; else if (b.spec === 'mine') title = 'Bergwerk';
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
    return `<div class="stripe" style="background:${col}"></div>
<header><div class="grow"><h2>${title}</h2><div class="sub">${ZONE_INFO[b.zone].name} · Stufe ${b.level} · Feld ${b.x}, ${b.y}</div></div><button class="close" data-act="close">${icon('close', 16)}</button></header>
<div class="body">
  <div class="chips">${chip(b.connected, 'Straße')}${chip(b.powered, 'Strom')}${chip(b.watered, 'Wasser')}${chip(g.cov.garbage[i] > 0.3, 'Müllabfuhr')}${b.burning ? '<span class="chip no">Brennt!</span>' : ''}${g.cov.transit[i] > 0 ? '<span class="chip ok">Pulsbahn</span>' : ''}</div>
  <div class="kv"><span>${occLabel}</span><span class="v">${fmt(b.occ)} / ${fmt(b.cap)}</span>
  <span>Glück</span><span class="v ${b.happy < 40 ? 'neg' : ''}">${Math.round(b.happy)} % → ${Math.round(target)} %</span>
  <span>Bodenwert</span><span class="v">${Math.round(g.fields.landValue[i])}</span>
  ${b.zone === Z.RES ? `<span>Bildung</span><span class="v">${Math.round(b.edu * 100)} %</span><span>Pendelzeit</span><span class="v">${Math.round(b.commute)} Min.</span>` : ''}
  </div>
  <div class="sec" style="margin:12px 0 8px"><h3>Was das Glück beeinflusst</h3><div class="factors">${factors.slice(0, 9).map(([l, v]) => `<span>${esc(l)}</span><span class="v ${v < 0 ? 'neg' : 'pos'}">${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(0)}</span>`).join('') || '<span>Alles im Lot.</span><span></span>'}</div></div>
  <p style="font-size:12.5px;color:var(--ink-2);line-height:1.45;margin:6px 0 10px">${next}</p>
  <button class="btn small ghost" data-act="demolish" style="color:var(--bad)">Abreißen</button>
</div>`;
  }

  inspService(b) {
    const g = this.g, d = BUILDINGS[b.key];
    const facts = [];
    if (d.power) facts.push(['Stromerzeugung', `${fmt(d.power * g.mods.power)} MW`]);
    if (d.water) facts.push(['Wasserförderung', `${fmt(d.water * g.mods.water)} m³${b.powered ? '' : ' (ohne Strom: 0)'}`]);
    if (d.service) facts.push(['Reichweite', `${d.service.radius} Felder`], ['Auslastung', `${Math.round((b.load || 0) * 100)} %`]);
    if (d.tourism) facts.push(['Touristen', `${d.tourism} / Tag`]);
    if (d.park) facts.push(['Erholung', `Radius ${d.parkRadius}`]);
    facts.push(['Unterhalt', `${fmtMoney(d.upkeep * g.upkeepMul())} / Tag`]);
    const col = CAT_COLOR[d.cat] || '#999';
    return `<div class="stripe" style="background:${col}"></div>
<header><div class="grow"><h2>${esc(d.name)}</h2><div class="sub">Feld ${b.x}, ${b.y}</div></div><button class="close" data-act="close">${icon('close', 16)}</button></header>
<div class="body">
  <div class="chips"><span class="chip ${b.connected || b.comp >= 0 ? 'ok' : 'no'}">Straße</span><span class="chip ${b.powered ? 'ok' : d.power ? 'ok' : 'no'}">${d.power ? 'Kraftwerk' : 'Strom'}</span>${b.construct < 1 ? `<span class="chip warn">Im Bau · ${Math.round(b.construct * 100)} %</span>` : ''}</div>
  <div class="kv">${facts.map(([k, v]) => `<span>${k}</span><span class="v">${v}</span>`).join('')}</div>
  <p style="font-size:12.5px;color:var(--ink-2);line-height:1.45;margin:8px 0 10px">${esc(d.desc)}</p>
  <button class="btn small ghost" data-act="demolish" style="color:var(--bad)">Abreißen (+${fmtMoney(d.cost * g.costMul * 0.4)})</button>
</div>`;
  }

  inspStation(st) {
    const g = this.g, tr = g.transit;
    const lines = tr.lines.filter((l) => l.stops.includes(st.id));
    const byShape = [0, 0, 0, 0, 0];
    for (const p of st.waiting) byShape[p.shape]++;
    const sym = ['', '●', '▲', '■', '◆'];
    const over = st.over > 0.02 ? `<span class="chip no">Überfüllt · ${Math.round(st.over * 100)} %</span>` : '';
    return `<div class="stripe" style="background:${lines.length ? hex(LINE_COLORS[lines[0].color]) : '#999'}"></div>
<header><div class="grow"><h2>${esc(st.name)}</h2><div class="sub">Pulsbahn-Station · Feld ${st.x}, ${st.y}</div></div><button class="close" data-act="close">${icon('close', 16)}</button></header>
<div class="body">
  <div class="chips">${lines.map((l) => `<span class="chip" style="background:${hex(LINE_COLORS[l.color])};color:#fff">Linie ${LINE_COLOR_NAMES[l.color]}</span>`).join('') || '<span class="chip no">Keine Linie</span>'}${over}</div>
  <div class="kv"><span>Wartende Fahrgäste</span><span class="v ${st.waiting.length > TRANSIT.stationCapacity ? 'neg' : ''}">${st.waiting.length} / ${TRANSIT.stationCapacity}</span>
  <span>Ziele</span><span class="v">${[1, 2, 3, 4].map((z) => `${sym[z]} ${byShape[z]}`).join('  ')}</span>
  <span>Einzugsgebiet</span><span class="v">${fmt(st.w[1])} Bew. · ${fmt(st.w[2] + st.w[3] + st.w[4])} Jobs</span>
  <span>Fahrgäste angekommen</span><span class="v">${fmt(st.served)}</span></div>
  <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap"><button class="btn small" data-act="linefrom">Linie von hier</button><button class="btn small ghost" data-act="demolish" style="color:var(--bad)">Abreißen</button></div>
</div>`;
  }

  inspClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const g = this.g, s = this.sel;
    const act = b.dataset.act;
    if (act === 'close') { this.closeInspector(); return; }
    if (act === 'demolish' && s) {
      let tiles = [];
      if (s.type === 'building') { const bd = g.buildings.get(s.id); if (bd) for (let y = bd.y; y < bd.y + bd.h; y++) for (let x = bd.x; x < bd.x + bd.w; x++) tiles.push(y * g.W + x); }
      else if (s.type === 'station') { const st = g.transit.stations.get(s.id); if (st) { g.transit.removeStation(st.id); g.afterTransitChange(); this.closeInspector(); this.app.audio.play('demolish'); return; } }
      const r = g.bulldoze(tiles);
      if (r.ok) this.app.audio.play('demolish');
      this.closeInspector();
      return;
    }
    if (act === 'linefrom' && s && s.type === 'station') {
      this.app.input.setTool({ kind: 'line' });
      this.app.input.lineStops = [s.id];
      this.closeInspector();
    }
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
    const wrap = document.createElement('div');
    wrap.className = 'backdrop';
    wrap.innerHTML = html;
    this.modalRoot.appendChild(wrap);
    wrap.addEventListener('click', (e) => onClick(e, () => { wrap.remove(); this.nextModal(); }));
    return wrap;
  }

  showMilestone(i) {
    const m = MILESTONES[i];
    this.app.audio.play('milestone');
    const unlocks = [];
    for (const [k, d] of Object.entries(BUILDINGS)) if (!d.landmark && d.unlock === i) unlocks.push(d.name);
    if (i === 2) unlocks.unshift('Büro-Zone', 'Alleen', 'Pulsbahn (2 Linien)', 'Kredite');
    if (i >= 3 && i <= 5) unlocks.push('+1 Pulsbahn-Linie');
    const lvl = [0, 0, 3, 4, 5][i];
    if (lvl) unlocks.push(`Gebäude bis Stufe ${lvl}`);
    for (const [k, d] of Object.entries(BUILDINGS)) if (d.landmark && d.unlock + 1 === i) unlocks.push(`Wahrzeichen: ${d.name}`);
    this.refreshTutorial();
    this.openModal(`<div class="modal milestone"><div class="eyebrow">Meilenstein erreicht</div><div class="big">${m.name}</div><p>${fmt(m.pop)} Menschen nennen ${esc(this.g.name)} jetzt ihr Zuhause.${m.reward && !this.g.sandbox ? ` Das Land gratuliert mit <b>${fmtMoney(m.reward)}</b>.` : ''}</p>${unlocks.length ? `<ul>${unlocks.map((u) => `<li>${esc(u)}</li>`).join('')}</ul>` : ''}<div class="acts" style="justify-content:center"><button class="btn" data-act="ok">Weiter bauen</button></div></div>`, (e, close) => { if (e.target.closest('[data-act=ok]')) close(); });
  }

  showCards(ids) {
    const g = this.g;
    this.app.audio.play('card');
    const cards = ids.map((id) => cardById(g, id)).filter(Boolean);
    const html = `<div class="cards-wrap"><div class="head"><div class="eyebrow" style="color:#c9cdd8">Woche ${g.week()}</div><h2>Wähle deine Wochenkarte</h2><p>Eine von drei – die anderen verfallen.</p></div>
<div class="cards">${cards.map((c, k) => `<button class="ticket" data-card="${c.id}"><div class="band" style="background:${c.color}"><span class="tag">${esc(c.tag)}</span><span class="no">Nr. ${String(g.week()).padStart(3, '0')}-${k + 1}</span></div><div class="perf"></div><div class="bd"><div class="nm">${esc(c.name)}</div><div class="ds">${esc(c.text(g))}</div><div class="go">Diese nehmen →</div></div><span class="stamp" style="color:${c.color}">STADT<br>PULS</span></button>`).join('')}</div></div>`;
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

  // ---------- pro Frame
  update(dt) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.25;
      this.refreshHUD();
      if (this.sel && !this.el.insp.hidden) this.renderInspector();
    }
    this.panelTimer -= dt;
    if (this.panelTimer <= 0) {
      this.panelTimer = 1.2;
      if (this.panel && !this.panelBusy && this.panel !== 'settings' && this.panel !== 'budget') this.renderPanel();
      else if (this.panel === 'budget' && !this.panelBusy && !this.el.panel.matches(':hover')) this.renderPanel();
      this.refreshTutorial();
    }
  }
}

export { esc, hex };
void SPEEDS; void TAX_RATE; void EVENTS;
