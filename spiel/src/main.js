// Einstieg: Hauptmenü, Spielstart, Hauptschleife, Speichern/Laden.
import { Game } from './sim/game.js';
import { buildDemoCity } from './sim/demo.js';
import { Engine } from './render/scene.js';
import { Input } from './input.js';
import { UI } from './ui/ui.js';
import { Menu } from './ui/menu.js';
import { Audio } from './audio.js';

const LS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* egal */ } },
};
const KEY = (slot) => `stadtpuls.save.${slot}`;

function loadSettings() {
  const def = { volume: 0.7, music: 0.7, sfx: 0.8, muted: false, alwaysDay: false, quality: 'medium', tutorialDone: false };
  try { return { ...def, ...(JSON.parse(LS.get('stadtpuls.settings') || '{}')) }; } catch (e) { return def; }
}

function webglOk() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) { return false; }
}

const app = {
  settings: loadSettings(),
  mode: 'menu',
  game: null, engine: null, input: null, ui: null, menu: null,
  last: performance.now(),
  saveSettings() { LS.set('stadtpuls.settings', JSON.stringify(this.settings)); },

  makeStage() {
    const stage = document.getElementById('stage');
    stage.innerHTML = '';
    const canvas = document.createElement('canvas');
    stage.appendChild(canvas);
    return canvas;
  },

  teardown() {
    if (this.ui) { this.ui.dispose(); this.ui = null; }
    if (this.input) { this.input.dispose(); this.input = null; }
    if (this.engine) { this.engine.dispose(); this.engine = null; }
    this.game = null;
  },

  // ---------- Menü
  showMenu() {
    this.teardown();
    this.mode = 'menu';
    if (!this.menu) this.menu = new Menu(this);
    this.menu.show();
    this.menuPreview(null);
  },
  menuPreview(opts) {
    if (this.mode !== 'menu') return;
    if (this.engine) { this.engine.dispose(); this.engine = null; }
    let g;
    if (opts) {
      g = new Game({ size: opts.size, seed: opts.seed, mapType: opts.mapType, difficulty: 'sandbox', name: 'Vorschau' });
      g.speed = 0;
    } else {
      g = new Game({ size: 64, seed: 7, mapType: 'river', difficulty: 'sandbox', name: 'Demo' });
      g.sandboxNoEvents = true;
      buildDemoCity(g);
      g.speed = 3;
      g.on('cards', (ids) => g.chooseCard(ids[0]));
    }
    const canvas = this.makeStage();
    this.demo = g;
    this.engine = new Engine(canvas, g, { ...this.settings, quality: this.settings.quality === 'high' ? 'medium' : this.settings.quality });
    this.engine.rig.autoRotate = 0.05;
    this.engine.rig.enabled = false;
    const hx = (g.world.highwayEnd % g.W) + 18 - g.W / 2;
    this.engine.rig.focus(opts ? 0 : hx - 4, opts ? 0 : g.world.highwayY - g.H / 2, opts ? g.W * 0.95 : 40);
    this.engine.rig.goal.pitch = opts ? 0.95 : 0.72;
    this.engine.rig.goal.yaw = 0.9;
    this.engine.rig.cur = { ...this.engine.rig.goal, dist: this.engine.rig.goal.dist * 1.15 };
  },

  // ---------- Spiel
  newGame(opts) {
    const g = new Game(opts);
    g.news('info', `Willkommen in ${g.name}! Die Autobahn endet am Westrand – von dort aus beginnt deine Stadt.`, 'good');
    this.startGame(g);
  },

  startGame(g) {
    this.audio.start();
    if (this.menu) this.menu.hide();
    this.teardown();
    this.mode = 'game';
    this.game = g;
    const canvas = this.makeStage();
    try {
      this.engine = new Engine(canvas, g, this.settings);
    } catch (e) {
      console.error(e);
      document.getElementById('stage').innerHTML = '<p class="noscript">WebGL konnte nicht gestartet werden.</p>';
      return;
    }
    this.ui = new UI(this);
    this.input = new Input(this.engine, this.ui, this.audio);
    this.ui.markToolButtons();
    g.on('day', () => this.save('auto'));
    window.__stadtpuls = this;
    this.debug = { buildDemoCity };
  },

  toMenu() {
    if (this.game) this.save('auto');
    this.showMenu();
  },

  // ---------- Speichern
  save(slot) {
    if (!this.game) return false;
    const data = this.game.serialize();
    const ok = LS.set(KEY(slot), JSON.stringify(data));
    if (ok) LS.set(KEY(slot) + '.meta', JSON.stringify({ name: data.name, pop: data.pop, savedAt: data.savedAt }));
    return ok;
  },
  slotMeta(slot) {
    try { return JSON.parse(LS.get(KEY(slot) + '.meta') || 'null'); } catch (e) { return null; }
  },
  loadSlot(slot) {
    const raw = LS.get(KEY(slot));
    if (!raw) { this.ui ? this.ui.toast('Kein Spielstand gefunden.', 'bad') : null; return; }
    this.loadData(JSON.parse(raw));
  },
  loadData(data) {
    try {
      const g = Game.fromSave(data);
      this.startGame(g);
      this.ui.toast(`${g.name} geladen.`, 'good');
    } catch (e) {
      console.error(e);
      alertBox('Der Spielstand konnte nicht geladen werden.');
    }
  },
  exportSave() {
    if (!this.game) return;
    const blob = new Blob([JSON.stringify(this.game.serialize())], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `stadtpuls-${this.game.name.replace(/[^a-z0-9äöüß-]+/gi, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    this.ui.toast('Export gestartet. Falls nichts passiert: „In Zwischenablage" nutzen.');
  },
  copySave() {
    if (!this.game) return;
    const txt = JSON.stringify(this.game.serialize());
    navigator.clipboard?.writeText(txt).then(() => this.ui.toast('Spielstand in die Zwischenablage kopiert.', 'good'), () => this.ui.toast('Zwischenablage nicht verfügbar.', 'bad'));
  },
  importFile(file) {
    const r = new FileReader();
    r.onload = () => {
      try { this.loadData(JSON.parse(r.result)); } catch (e) { alertBox('Die Datei ist kein gültiger Stadtpuls-Spielstand.'); }
    };
    r.readAsText(file);
  },

  // ---------- Schleife
  frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    try {
      if (this.mode === 'game' && this.game && this.engine) {
        const simDt = this.game.update(dt);
        this.engine.frame(dt, simDt);
        this.ui.update(dt);
        this.audio.update(this.game, this.engine, dt);
      } else if (this.mode === 'menu' && this.engine && this.demo) {
        const simDt = this.demo.update(dt);
        this.engine.frame(dt, simDt);
      }
    } catch (e) {
      console.error(e);
      if (!this._errShown) { this._errShown = true; alertBox('Es ist ein Fehler aufgetreten: ' + e.message); }
    }
    requestAnimationFrame((t) => this.frame(t));
  },
};

function alertBox(msg) {
  const root = document.getElementById('modal-root');
  const d = document.createElement('div');
  d.className = 'backdrop';
  d.innerHTML = `<div class="modal"><h2>Hinweis</h2><p></p><div class="acts"><button class="btn">OK</button></div></div>`;
  d.querySelector('p').textContent = msg;
  d.querySelector('button').onclick = () => d.remove();
  root.appendChild(d);
}

function boot(hotData) {
  if (!webglOk()) {
    document.getElementById('menu').innerHTML = '<div class="loading">Dein Browser unterstützt kein WebGL – Stadtpuls braucht 3D-Grafik.</div>';
    return;
  }
  app.audio = new Audio(app.settings);
  // Ton startet nach der ersten Interaktion
  const unlock = () => { app.audio.start(); if (app.audio.ctx && app.audio.ctx.state === 'suspended') app.audio.ctx.resume(); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  if (hotData && hotData.save) {
    try { app.startGame(Game.fromSave(hotData.save)); } catch (e) { app.showMenu(); }
  } else app.showMenu();
  requestAnimationFrame((t) => { app.last = t; app.frame(t); });
}

// Artifact-Viewer: Spielstand bei Updates behalten
const hot = typeof window !== 'undefined' && window.claude && window.claude.hot;
if (hot && hot.snapshot) {
  try { hot.snapshot(() => (app.game ? { save: app.game.serialize() } : {})); } catch (e) { /* optional */ }
}
if (hot && hot.ready) hot.ready(boot);
else boot(hot && hot.data ? hot.data : {});
