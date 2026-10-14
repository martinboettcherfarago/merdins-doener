// Einstieg: Hauptmenü, Spielstart, Hauptschleife, Speichern/Laden.
import { Game, SaveError } from './sim/game.js';
import { buildDemoCity } from './sim/demo.js';
import { Engine } from './render/scene.js';
import { Input } from './input.js';
import { UI } from './ui/ui.js';
import { Menu } from './ui/menu.js';
import { Audio } from './audio.js';
import { runGallery } from './render/gallery.js';
import { hideLoader } from './ui/loading.js';
import { applyDayLength } from './ui/settings.js';
import { registerIcon } from './registry.js';
import './sim/systems/index.js';
import './render/views/index.js';
import './ui/panels/index.js';
import './input/index.js';

const LS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* egal */ } },
};
const KEY = (slot) => `stadtpuls.save.${slot}`;

// Standardwerte laut Vertrag 6.7 (Stufe „medium“: Nachbearbeitung und Bloom an, AO aus, weiche Schatten niedrig)
function loadSettings() {
  const def = {
    volume: 0.7, music: 0.7, sfx: 0.8, ambience: 1, muted: false, alwaysDay: false, quality: 'medium', postfx: true, ao: false, bloom: true, shadows: 'low',
    tutorialDone: false, uiScale: 1, minimap: true, advisor: true, tooltips: true,
  };
  let s = def;
  try {
    const raw = JSON.parse(LS.get('stadtpuls.settings') || '{}');
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) s = { ...def, ...raw };
  } catch (e) { s = { ...def }; }
  // Ältere Einstellungen speicherten Schatten als true/false
  if (typeof s.shadows === 'boolean') s.shadows = s.shadows ? 'low' : 'off';
  if (!['off', 'low', 'high'].includes(s.shadows)) s.shadows = 'low';
  if (!['low', 'medium', 'high', 'ultra'].includes(s.quality)) s.quality = 'medium';
  for (const k of ['volume', 'music', 'sfx', 'ambience', 'uiScale']) if (!Number.isFinite(s[k])) s[k] = def[k];
  return s;
}

// Problemsymbol „wird repariert“ (Schraubenschlüssel) für Gebäude, die nach einer Katastrophe instand gesetzt werden.
// Die Anzeige liest g.isRepairing(b) (siehe render/effects.js).
registerIcon({
  id: 'repair', color: '#f08c00',
  draw(ctx, cx, cy, r) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-r * 0.12, -r * 0.2, r * 0.24, r * 0.85);
    ctx.beginPath();
    ctx.arc(0, -r * 0.38, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f08c00';
    ctx.fillRect(-r * 0.1, -r * 0.75, r * 0.2, r * 0.36);
    ctx.restore();
  },
});

// Ansicht abbauen und den WebGL-Kontext sofort freigeben (Browser erlauben nur ~16 gleichzeitig;
// sonst gehen nach mehreren Wechseln Menü ↔ Spiel ältere Kontexte verloren).
function releaseEngine(e) {
  if (!e) return;
  try { e.dispose(); } catch (err) { console.warn('Cityscapes: Ansicht nicht sauber abgebaut', err); }
  try { if (e.renderer && e.renderer.forceContextLoss) e.renderer.forceContextLoss(); } catch (err) { /* egal */ }
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
    if (this.engine) { releaseEngine(this.engine); this.engine = null; }
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
    if (this.engine) { releaseEngine(this.engine); this.engine = null; }
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
    applyDayLength(this);
    this.input = new Input(this.engine, this.ui, this.audio);
    this.ui.markToolButtons();
    g.on('day', () => this.queueAutosave());
    window.__stadtpuls = this;
    this.debug = { buildDemoCity };
  },

  toMenu() {
    if (this.game) this.save('auto');
    this.showMenu();
  },

  // ---------- Speichern
  // Automatisch speichern nicht mitten im Tageswechsel (der ist schon teuer), sondern im nächsten ruhigen Moment
  queueAutosave() {
    if (this._autoQ) return;
    this._autoQ = true;
    const g = this.game;
    const run = () => { this._autoQ = false; if (this.game === g && this.mode === 'game') this.save('auto'); };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 3000 });
    else setTimeout(run, 60);
  },
  save(slot) {
    if (!this.game) return false;
    let data, txt;
    try { data = this.game.serialize(); txt = JSON.stringify(data); } catch (e) {
      console.error(e);
      if (this.ui && slot !== 'auto') this.ui.toast('Speichern fehlgeschlagen.', 'bad');
      return false;
    }
    const ok = LS.set(KEY(slot), txt);
    if (ok) LS.set(KEY(slot) + '.meta', JSON.stringify({ name: data.name, pop: data.pop, savedAt: data.savedAt }));
    else if (this.ui && (slot !== 'auto' || !this._quotaWarned)) {
      // Browser-Speicher voll (große Karten brauchen über 1 MB pro Platz) – der alte Stand auf dem Platz bleibt erhalten
      this._quotaWarned = true;
      setTimeout(() => this.ui && this.ui.toast(`Speichern ${slot === 'auto' ? '(automatisch) ' : ''}fehlgeschlagen: Der Browser-Speicher ist voll. Alte Plätze löschen oder den Spielstand als Datei exportieren.`, 'bad'), 50);
    }
    return ok;
  },
  slotMeta(slot) {
    try { return JSON.parse(LS.get(KEY(slot) + '.meta') || 'null'); } catch (e) { return null; }
  },
  loadSlot(slot) {
    const raw = LS.get(KEY(slot));
    if (!raw) {
      if (this.ui) this.ui.toast('Kein Spielstand gefunden.', 'bad');
      else alertBox('Auf diesem Platz ist kein Spielstand gespeichert.');
      hideLoader();
      return false;
    }
    return this.loadData(raw);
  },
  // Lädt einen Spielstand (Objekt oder JSON-Text). Bei Fehlern bleibt das laufende Spiel bzw. das Menü erhalten.
  loadData(data, opts = {}) {
    let g;
    try {
      g = Game.fromSave(data);
    } catch (e) {
      if (!(e instanceof SaveError)) console.warn('Cityscapes: Spielstand nicht ladbar', e);
      hideLoader();
      alertBox(e instanceof SaveError ? e.message : 'Der Spielstand konnte nicht geladen werden – er ist beschädigt oder stammt aus einer unbekannten Version.');
      return false;
    }
    try {
      this.startGame(g);
    } catch (e) {
      console.error(e);
      hideLoader();
      alertBox('Der Spielstand wurde gelesen, aber das Spiel konnte nicht gestartet werden: ' + e.message);
      this.showMenu();
      return false;
    }
    if (this.ui && !opts.quiet) {
      this.ui.toast(`${g.name} geladen.`, 'good');
      for (const n of g.loadNotes || []) this.ui.toast(n, 'info');
    }
    return true;
  },
  exportSave() {
    if (!this.game) return;
    if (window.STADTPULS_EMBED) { this.ui.toast('Datei-Export ist in dieser Fassung nicht möglich – bitte „In Zwischenablage" nutzen.'); return; }
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
    try {
      const txt = JSON.stringify(this.game.serialize());
      if (!navigator.clipboard || !navigator.clipboard.writeText) { this.ui.toast('Zwischenablage nicht verfügbar.', 'bad'); return; }
      navigator.clipboard.writeText(txt).then(() => this.ui.toast('Spielstand in die Zwischenablage kopiert.', 'good'), () => this.ui.toast('Zwischenablage nicht verfügbar.', 'bad'));
    } catch (e) { this.ui.toast('Zwischenablage nicht verfügbar.', 'bad'); }
  },
  importFile(file) {
    const r = new FileReader();
    r.onload = () => { this.loadData(String(r.result || '')); };
    r.onerror = () => { hideLoader(); alertBox('Die Datei konnte nicht gelesen werden.'); };
    r.readAsText(file);
  },

  // ---------- Schleife
  frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    // Jeder Teil einzeln abgesichert: Ein Fehler in Darstellung, Oberfläche oder Klang hält die anderen nicht an.
    const part = (name, fn) => {
      try { return fn(); } catch (e) {
        console.error(e);
        if (!this._errShown) { this._errShown = true; alertBox(`Es ist ein Fehler aufgetreten (${name}): ${e.message}. Das Spiel läuft weiter; bitte speichern.`); }
        return 0;
      }
    };
    if (this.mode === 'game' && this.game && this.engine) {
      const g = this.game, en = this.engine;
      const simDt = part('Simulation', () => g.update(dt));
      part('Darstellung', () => en.frame(dt, simDt));
      if (this.ui) part('Oberfläche', () => this.ui.update(dt));
      if (this.audio) part('Klang', () => this.audio.update(g, en, dt));
    } else if (this.mode === 'menu' && this.engine && this.demo) {
      const d = this.demo, en = this.engine;
      const simDt = part('Vorschau', () => d.update(dt));
      part('Darstellung', () => en.frame(dt, simDt));
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
  const params = new URLSearchParams(location.search);
  if (params.has('gallery')) { document.getElementById('menu').hidden = true; runGallery(params); return; }
  if (!webglOk()) {
    document.getElementById('menu').innerHTML = '<div class="loading">Dein Browser unterstützt kein WebGL – Cityscapes braucht 3D-Grafik.</div>';
    return;
  }
  window.__stadtpuls = app; // Debug- und Prüfzugriff (app.mode, app.game, app.engine)
  app.audio = new Audio(app.settings);
  // Ton startet nach der ersten Interaktion
  const unlock = () => { app.audio.start(); if (app.audio.ctx && app.audio.ctx.state === 'suspended') app.audio.ctx.resume(); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  if (hotData && hotData.save) {
    try { app.startGame(Game.fromSave(hotData.save)); } catch (e) { console.warn('Cityscapes: Stand nach Aktualisierung nicht ladbar', e); app.showMenu(); }
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
