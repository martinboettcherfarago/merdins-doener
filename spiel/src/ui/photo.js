// Fotomodus: Oberfläche ausblenden, freie Kamera (tiefer, näher, Bildwinkel), Tageszeit, Filter, Raster,
// Kinoformat, Kamerafahrt und „Foto speichern". Tiefenschärfe, falls die Engine es anbietet:
//   engine.photoFxSupported = true  →  U1 setzt engine.photoFx = { dof, focus (0..1, 0 = Bildmitte), aperture (0..1) }
// und beim Verlassen engine.photoFx = null.
import { icon } from './icons.js';

const FILTERS = [
  ['none', 'Natur', ''],
  ['warm', 'Sommer', 'saturate(1.12) contrast(1.04) sepia(0.12) brightness(1.03)'],
  ['cool', 'Morgen', 'saturate(0.92) contrast(1.05) hue-rotate(-8deg) brightness(1.04)'],
  ['vivid', 'Postkarte', 'saturate(1.35) contrast(1.1)'],
  ['film', 'Analog', 'sepia(0.32) saturate(0.85) contrast(1.08) brightness(1.02)'],
  ['mono', 'Schwarzweiß', 'grayscale(1) contrast(1.15)'],
];

export class PhotoMode {
  constructor(ui) {
    this.ui = ui;
    this.active = false;
    this.opts = { filter: 'none', grid: false, cine: false, vignette: true, orbit: false, fov: 42, hour: null, dof: false, tilt: false, focus: 0, aperture: 0.6, run: false };
  }

  get engine() { return this.ui.app.engine; }

  toggle() { if (this.active) this.exit(); else this.enter(); }

  enter() {
    if (this.active) return;
    const ui = this.ui, e = this.engine, g = ui.g, rig = e.rig;
    this.active = true;
    ui.closeTray(); ui.closePanels();
    ui.app.input && ui.app.input.setTool({ kind: 'select' });
    this.saved = {
      speed: g.speed, time: g.time, alwaysDay: ui.app.settings.alwaysDay, icons: e.effects ? e.effects.showIcons : true,
      view: ui.view, minDist: rig.minDist, fov: e.camera.fov, near: e.camera.near, rigEnabled: rig.enabled, auto: rig.autoRotate,
    };
    this.opts.hour = Math.round(g.hour() * 4) / 4;
    this.opts.fov = Math.round(e.camera.fov);
    if (!this.opts.run) g.speed = 0;
    ui.refreshSpeed();
    if (e.effects) { e.effects.showIcons = false; e.effects.iconTimer = 0; }
    if (ui.view !== 'none') ui.setView('none');
    e.overlay.select(null); e.overlay.hideGhost(); e.overlay.hideRadius();
    // Zonenflächen stören auf Fotos
    if (e.overlay.zones) { this.saved.zonesVisible = e.overlay.zones.visible; e.overlay.zones.visible = false; }
    rig.minDist = 0.7;
    rig.enabled = false;
    e.camera.near = 0.04; e.camera.updateProjectionMatrix();
    document.getElementById('app').classList.add('photo');
    this.mount();
    this.bindCam();
    this.applyFilter();
    ui.toast('Fotomodus · Ziehen dreht · Esc beendet');
  }

  exit() {
    if (!this.active) return;
    const ui = this.ui, e = this.engine, g = ui.g, rig = e.rig, s = this.saved;
    this.active = false;
    this.unbindCam();
    if (s.time !== null) g.time = s.time;
    g.speed = s.speed;
    ui.app.settings.alwaysDay = s.alwaysDay;
    if (e.effects) { e.effects.showIcons = s.icons; e.effects.iconTimer = 0; }
    rig.minDist = s.minDist; rig.enabled = s.rigEnabled; rig.autoRotate = s.auto;
    rig.goal.pitch = Math.max(0.42, Math.min(1.38, rig.goal.pitch));
    rig.goal.dist = Math.max(rig.minDist, rig.goal.dist);
    e.camera.fov = s.fov; e.camera.near = s.near; e.camera.updateProjectionMatrix();
    e.photoFx = null;
    if (typeof e.setDepthOfField === 'function') { try { e.setDepthOfField(0); } catch (err) { console.error(err); } }
    if (e.overlay.zones && s.zonesVisible !== undefined) e.overlay.zones.visible = s.zonesVisible;
    e.canvas.style.filter = '';
    document.getElementById('app').classList.remove('photo');
    if (this.el) { this.el.remove(); this.el = null; }
    if (this.fx) { this.fx.remove(); this.fx = null; }
    if (s.view !== 'none') ui.setView(s.view);
    ui.refreshSpeed();
  }

  mount() {
    const app = document.getElementById('app');
    this.fx = document.createElement('div');
    this.fx.className = 'photo-fx';
    this.fx.innerHTML = '<div class="pf-vig"></div><div class="pf-grid"><i></i><i></i><i></i><i></i></div><div class="pf-bar top"></div><div class="pf-bar bot"></div><div class="pf-flash"></div>';
    app.appendChild(this.fx);
    this.el = document.createElement('div');
    this.el.className = 'photo-ui sign';
    app.appendChild(this.el);
    this.render();
    this.el.addEventListener('click', (ev) => this.click(ev));
    this.el.addEventListener('input', (ev) => this.input(ev));
  }

  render() {
    const o = this.opts, e = this.engine;
    const hh = Math.floor(o.hour), mm = Math.round((o.hour - hh) * 60);
    const dofOk = this.dofOk();
    this.el.innerHTML = `
<div class="pu-head"><span class="pu-t">${icon('camera', 16)} Fotomodus</span><span class="grow"></span><button class="close" data-pa="exit" data-tip="Beenden" data-key="Esc">${icon('close', 16)}</button></div>
<div class="pu-row"><label>${icon('sun', 14)} Tageszeit</label><input type="range" min="0" max="23.75" step="0.25" value="${o.hour}" data-pi="hour" ${o.run ? 'disabled' : ''}><span class="num pv">${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}</span></div>
<div class="pu-row"><label>${icon('aperture', 14)} Bildwinkel</label><input type="range" min="14" max="80" step="1" value="${o.fov}" data-pi="fov"><span class="num pv">${o.fov}°</span></div>
${dofOk ? `<div class="pu-row"><label>${icon('target', 14)} Schärfe</label><input type="range" min="0" max="1" step="0.02" value="${o.aperture}" data-pi="aperture" ${o.dof ? '' : 'disabled'}><button class="chip${o.dof ? ' on' : ''}" data-pa="dof" data-tip="Tiefenschärfe">Tiefenschärfe</button><button class="chip${o.tilt ? ' on' : ''}" data-pa="tilt" data-tip="Miniatur-Look" ${o.dof ? '' : 'disabled'}>Miniatur</button></div>` : ''}
<div class="pu-filters">${FILTERS.map(([id, n]) => `<button class="pf${o.filter === id ? ' on' : ''}" data-pa="filter" data-v="${id}" data-tip="Filter: ${n}"><span class="sw f-${id}"></span>${n}</button>`).join('')}</div>
<div class="pu-toggles">
  <button class="chip${o.grid ? ' on' : ''}" data-pa="grid" data-tip="Raster">${icon('grid', 14)} Raster</button>
  <button class="chip${o.cine ? ' on' : ''}" data-pa="cine" data-tip="Kino">${icon('film', 14)} Kino</button>
  <button class="chip${o.vignette ? ' on' : ''}" data-pa="vignette" data-tip="Vignette">${icon('aperture', 14)} Vignette</button>
  <button class="chip${o.orbit ? ' on' : ''}" data-pa="orbit" data-tip="Kamerafahrt">${icon('orbit', 14)} Kamerafahrt</button>
  <button class="chip${o.run ? ' on' : ''}" data-pa="run" data-tip="Zeit läuft">${icon('play', 14)} Zeit läuft</button>
</div>
<div class="pu-acts"><button class="btn" data-pa="shot" data-tip="Foto aufnehmen" data-key="Leertaste">${icon('camera', 16)} Foto aufnehmen</button><button class="btn ghost" data-pa="exit" data-tip="Fertig" data-key="Esc">Fertig</button></div>`;
    this.applyFilter();
  }

  applyFilter() {
    const o = this.opts, e = this.engine;
    if (!this.active) return;
    const f = FILTERS.find((x) => x[0] === o.filter) || FILTERS[0];
    e.canvas.style.filter = f[2];
    if (this.fx) {
      this.fx.classList.toggle('grid', o.grid);
      this.fx.classList.toggle('cine', o.cine);
      this.fx.classList.toggle('vig', o.vignette);
    }
    e.rig.autoRotate = o.orbit ? 0.06 : 0;
    e.camera.fov = o.fov; e.camera.updateProjectionMatrix();
    e.photoFx = e.photoFxSupported ? { dof: o.dof, focus: o.focus, aperture: o.aperture } : null;
    // Tiefenschärfe der Engine (G1): Stärke 0..1, optional Tilt-Shift
    if (typeof e.setDepthOfField === 'function') { try { e.setDepthOfField(o.dof ? Math.max(0.05, o.aperture) : 0, { tilt: !!o.tilt }); } catch (err) { console.error(err); } }
  }
  dofOk() { const e = this.engine; return !!e.photoFxSupported || (typeof e.setDepthOfField === 'function' && !!e.post); }

  setHour(h) {
    const g = this.ui.g;
    this.opts.hour = h;
    this.ui.app.settings.alwaysDay = false;
    g.time = Math.floor(g.time / 1440) * 1440 + h * 60;
  }

  click(ev) {
    const b = ev.target.closest('[data-pa]');
    if (!b) return;
    const o = this.opts, a = b.dataset.pa;
    this.ui.app.audio.play('click');
    if (a === 'exit') { this.exit(); return; }
    if (a === 'filter') o.filter = b.dataset.v;
    else if (a === 'shot') { this.capture(); return; }
    else if (a === 'run') { o.run = !o.run; this.ui.g.speed = o.run ? (this.saved.speed || 1) : 0; if (o.run) this.saved.time = null; this.ui.refreshSpeed(); }
    else if (a in o) o[a] = !o[a];
    this.render();
  }

  input(ev) {
    const t = ev.target;
    const k = t.dataset.pi;
    if (!k) return;
    const v = +t.value;
    if (k === 'hour') this.setHour(v);
    else this.opts[k] = v;
    const pv = t.parentElement.querySelector('.pv');
    if (pv) pv.textContent = k === 'hour' ? `${String(Math.floor(v)).padStart(2, '0')}:${String(Math.round((v % 1) * 60)).padStart(2, '0')}` : k === 'fov' ? `${v}°` : pv.textContent;
    this.applyFilter();
  }

  // Eigene Kamerasteuerung: tiefer und näher als im Spiel
  bindCam() {
    const c = this.engine.canvas, rig = this.engine.rig;
    const clampP = (p) => Math.max(0.035, Math.min(1.5, p));
    this.onDown = (e) => {
      this.drag = { x: e.clientX, y: e.clientY, mode: e.button === 2 || e.shiftKey ? 'pan' : 'rot', id: e.pointerId };
      c.setPointerCapture(e.pointerId);
    };
    this.onMove = (e) => {
      const d = this.drag;
      if (!d || d.id !== e.pointerId || (rig.touches && rig.touches.size > 1)) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      d.x = e.clientX; d.y = e.clientY;
      if (d.mode === 'pan') rig.panScreen(dx, dy);
      else { rig.goal.yaw -= dx * 0.005; rig.goal.pitch = clampP(rig.goal.pitch + dy * 0.004); }
    };
    this.onUp = () => { this.drag = null; };
    this.onWheel = (e) => {
      e.preventDefault();
      rig.goal.dist = Math.max(0.7, Math.min(rig.maxDist, rig.goal.dist * Math.exp(Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) * 0.0014)));
    };
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointercancel', this.onUp);
    c.addEventListener('wheel', this.onWheel, { passive: false });
  }
  unbindCam() {
    const c = this.engine.canvas;
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('pointermove', this.onMove);
    c.removeEventListener('pointerup', this.onUp);
    c.removeEventListener('pointercancel', this.onUp);
    c.removeEventListener('wheel', this.onWheel);
  }

  update() {
    if (!this.active) return;
    const rig = this.engine.rig;
    // Kamera nicht unter die Straße sinken lassen
    const minH = 0.16;
    if (Math.sin(rig.goal.pitch) * rig.goal.dist < minH) rig.goal.pitch = Math.min(1.5, Math.asin(Math.min(1, minH / Math.max(0.01, rig.goal.dist))));
    if (this.opts.run && this.el) {
      const h = Math.round(this.ui.g.hour() * 4) / 4;
      if (h !== this.opts.hour) {
        this.opts.hour = h;
        const r = this.el.querySelector('[data-pi=hour]');
        if (r && document.activeElement !== r) { r.value = h; const pv = r.parentElement.querySelector('.pv'); if (pv) pv.textContent = `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`; }
      }
    }
  }

  key(e) {
    if (!this.active) return false;
    if (e.code === 'Escape' || e.key === 'p' || e.key === 'P') { this.exit(); return true; }
    if (e.code === 'Space') { e.preventDefault(); this.capture(); return true; }
    return true;
  }

  // Foto: einmal frisch zeichnen und sofort aus dem Zeichenpuffer kopieren (ohne preserveDrawingBuffer)
  capture() {
    const e = this.engine, ui = this.ui, o = this.opts;
    const src = e.canvas;
    const w = src.width, h = src.height;
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const ctx = out.getContext('2d');
    try { e.frame(0, 0); } catch (err) { console.error(err); }
    const f = FILTERS.find((x) => x[0] === o.filter) || FILTERS[0];
    if (f[2]) ctx.filter = f[2];
    ctx.drawImage(src, 0, 0);
    ctx.filter = 'none';
    if (o.vignette) {
      const gr = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.6);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(10,12,20,0.42)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    }
    if (o.cine) { const bh = Math.max(0, (h - w / 2.39) / 2); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, bh); ctx.fillRect(0, h - bh, w, bh); }
    const s = Math.max(1, w / 1400);
    ctx.font = `600 ${Math.round(13 * s)}px "Stadtpuls Rund", Outfit, system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 6 * s;
    ctx.fillText(`${ui.g.name} · ${ui.g.dateText()} · Stadtpuls`, w - 18 * s, h - (o.cine ? Math.max(0, (h - w / 2.39) / 2) : 0) - 16 * s);
    if (this.fx) { const fl = this.fx.querySelector('.pf-flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); }
    ui.app.audio.play('photo');
    let url = '';
    try { url = out.toDataURL('image/png'); } catch (err) { ui.toast('Foto konnte nicht erstellt werden.', 'bad'); return; }
    const name = `stadtpuls-${ui.g.name.replace(/[^a-z0-9äöüß-]+/gi, '_')}-tag${ui.g.day()}.png`;
    ui.openModal(`<div class="modal photo-prev"><div class="eyebrow">Fotomodus</div><h2>Dein Foto von ${ui.g.name.replace(/[<>&"]/g, '')}</h2><img src="${url}" alt="Foto der Stadt"><div class="acts"><button class="btn ghost" data-act="copyimg">${icon('copy', 15)} Kopieren</button>${window.STADTPULS_EMBED ? '' : `<a class="btn ghost" download="${name}" href="${url}">${icon('download', 15)} Speichern</a>`}<button class="btn" data-act="ok">Weiter fotografieren</button></div>${window.STADTPULS_EMBED ? '' : '<p class="hint">Tipp: Rechtsklick aufs Bild → „Bild speichern unter …“ geht auch.</p>'}</div>`, (ev, close) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'copyimg') {
        try {
          out.toBlob((blob) => {
            try { navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(() => ui.toast('Foto kopiert.', 'good'), () => ui.toast('Zwischenablage nicht verfügbar.', 'bad')); } catch (err2) { ui.toast('Zwischenablage nicht verfügbar.', 'bad'); }
          });
        } catch (err3) { ui.toast('Zwischenablage nicht verfügbar.', 'bad'); }
        return;
      }
      if (b.dataset.act === 'ok') close();
    });
  }
}
