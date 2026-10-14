// Hauptmenü: weiterspielen, neue Stadt anlegen, Spielstände laden, Einstellungen, Tastenkürzel.
// Abschnitte anderer Module (z. B. Szenarien) über MENU_SECTIONS: { render(menu) → html, click(menu, act, el) → true }.
// Beim ersten Anzeigen übernimmt der Ladebildschirm (Texturen vorbereiten, dann Menü-Stadt aufbauen).
import { MAP_TYPES, MAP_SIZES, DIFFICULTIES } from '../config.js';
import { cityName, mulberry32, fmt } from '../util.js';
import { icon, logo } from './icons.js';
import { MENU_SECTIONS } from '../registry.js';
import { ensureSettings, applyUiScale, settingsHTML, settingsClick, settingsInput, settingsChange, gfxSnapshot, gfxChanged } from './settings.js';
import { keysHTML } from './keys.js';
import { bindTips, setTipsEnabled } from './tips.js';
import { bootSequence, loaderVisible, showLoader, painted, hideLoader, loaderEl } from './loading.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// kleine Landschafts-Piktogramme
const MAP_ART = {
  river: '<path d="M2 15c4-1 5-6 9-6s5 5 11 4" stroke="#56a4d6" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M3 20l4-5 3 3 3-4 5 6" stroke="#7b8a6a" stroke-width="1.6" fill="none"/>',
  coast: '<path d="M15 2c-3 5 2 8-1 12s1 7 1 8h7V2Z" fill="#56a4d6"/><path d="M14 2c-3 5 2 8-1 12s1 7 1 8" stroke="#e4d6a2" stroke-width="2" fill="none"/>',
  lakes: '<ellipse cx="7" cy="8" rx="4" ry="3" fill="#56a4d6"/><ellipse cx="16" cy="15" rx="5" ry="3.5" fill="#56a4d6"/><circle cx="17" cy="6" r="1.8" fill="#4f8a50"/><circle cx="6" cy="17" r="2" fill="#4f8a50"/>',
  islands: '<rect x="1" y="1" width="22" height="22" rx="4" fill="#56a4d6"/><path d="M4 9c2-3 6-3 7 0s-2 5-4 5-4-2-3-5ZM13 15c1-3 6-4 7-1s-1 6-4 6-4-2-3-5Z" fill="#8fbf6a"/>',
  mountains: '<path d="M1 20l7-12 4 6 3-4 8 10Z" fill="#a59d92"/><path d="M8 8l2 3-2 1-2-1Z" fill="#f2f0ea"/>',
};

let booted = false;

export class Menu {
  constructor(app) {
    this.app = app;
    ensureSettings(app.settings);
    applyUiScale(app.settings);
    this.root = document.getElementById('menu');
    const rng = mulberry32(Date.now() & 0xffffff);
    this.opts = { name: cityName(rng), mapType: 'river', size: 96, difficulty: 'normal', seed: Math.floor(rng() * 99999) };
    this.view = 'main';
    this.previewing = false;
    bindTips();
    setTipsEnabled(app.settings.tooltips !== false);
  }

  show() {
    this.root.hidden = false;
    this._introDone = false;
    this.render();
    // Erster Start: Ladebildschirm übernimmt die Reihenfolge (Texturen, dann Menü-Stadt)
    if (!booted) {
      booted = true;
      if (loaderVisible()) {
        this.app.mode = 'boot';
        bootSequence(this.app).catch((e) => { console.error(e); this.app.mode = 'menu'; hideLoader(); });
      }
    }
  }
  hide() { this.root.hidden = true; this.root.innerHTML = ''; }

  render() {
    const app = this.app;
    const auto = app.slotMeta('auto');
    const slots = [1, 2, 3].map((k) => [k, app.slotMeta(k)]).filter(([, m]) => m);
    const o = this.opts;
    const mt = MAP_TYPES.find((m) => m.id === o.mapType) || MAP_TYPES[0];
    const df = DIFFICULTIES.find((d) => d.id === o.difficulty) || DIFFICULTIES[1];
    if (this.formOpen === undefined) this.formOpen = !auto;
    const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'gerade eben' : m < 60 ? `vor ${m} Min.` : m < 1440 ? `vor ${Math.round(m / 60)} Std.` : new Date(t).toLocaleDateString('de-DE'); };
    // Abschnitte anderer Module: place 'newcity' landet im Formular (z. B. Katastrophen), alles andere unter „Herausforderungen"
    const secHTML = (place) => MENU_SECTIONS.filter((sec) => (sec.place || 'modes') === place).map((sec) => { try { return sec.render(this); } catch (e) { console.error(e); return ''; } }).join('');
    const formExtra = secHTML('newcity');
    const modes = secHTML('modes');
    const tab = modes && this.tab === 'modes' ? 'modes' : 'free';
    const more = !!this.moreOpts;
    this.root.innerHTML = `
<div class="menu${this.previewing ? ' previewing' : ''}${this._introDone ? '' : ' intro'}">
  <div class="side">
    <div class="brand">${logo(58)}<div><h1>Stadtpuls</h1><div class="tag">Städtebau im Takt der U-Bahn</div></div></div>
    <p class="lede">Baue eine Stadt, die im Takt schlägt – mit einer U&#8209;Bahn, deren Züge bei jeder Ankunft einen Ton spielen.</p>
    ${auto ? `<div class="card continue"><div class="cc-line"></div><div class="cc-row"><div class="grow"><div class="eyebrow">Weiterspielen</div><div class="cc-name">${esc(auto.name)}</div><div class="cc-sub">${fmt(auto.pop)} Einwohner · ${ago(auto.savedAt)}</div></div><button class="btn big go" data-act="continue" data-tip="Fortsetzen" data-tip-desc="Dort weiterspielen, wo du aufgehört hast.">${icon('play', 16, 2.4)} Fortsetzen</button></div>${slots.length ? `<div class="cc-slots">${slots.map(([k, m]) => `<div class="slot"><span class="sn num">${k}</span><div class="grow"><div class="t">${esc(m.name)}</div><div class="s">${fmt(m.pop)} Einwohner · ${new Date(m.savedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</div></div><button class="btn small ghost" data-act="slot" data-k="${k}" data-tip="Laden" data-tip-desc="Spielstand aus Platz ${k} laden.">Laden</button></div>`).join('')}</div>` : ''}</div>` : ''}
    ${modes ? `<div class="mtabs" role="tablist"><button role="tab" class="${tab === 'free' ? 'on' : ''}" data-act="mtab" data-v="free" data-tip="Freies Spiel" data-tip-desc="Eine eigene Stadt gründen – ohne Zeitdruck.">${icon('city', 16, 2.1)}<span>Freies Spiel</span></button><button role="tab" class="${tab === 'modes' ? 'on' : ''}" data-act="mtab" data-v="modes" data-tip="Herausforderungen" data-tip-desc="Szenarien mit Zielen, Metro-Modus und Ehrentafel.">${icon('trophy', 16, 2.1)}<span>Herausforderungen</span></button></div>` : ''}
    ${tab === 'free' ? `<div class="card newcity${this.formOpen ? '' : ' closed'}">
      <button class="nc-head" data-act="toggleform" aria-expanded="${this.formOpen}"><h3>Neue Stadt gründen</h3>${auto ? `<span class="nc-chev">${icon(this.formOpen ? 'chevronU' : 'chevronD', 18, 2.4)}</span>` : ''}</button>
      ${this.formOpen ? '' : `<p class="nc-sub">Name, Landschaft und Schwierigkeit wählen.</p>`}
      <div class="nc-form">
      <div class="field"><label for="m-name">Name der Stadt</label><div class="inline"><input type="text" id="m-name" maxlength="28" value="${esc(o.name)}"><button class="btn ghost" data-act="rname" style="flex:none" data-tip="Würfeln" data-tip-desc="Einen zufälligen Stadtnamen vorschlagen.">Würfeln</button></div></div>
      <div class="field"><label>Landschaft</label><div class="maps">${MAP_TYPES.map((m) => `<button data-act="map" data-v="${m.id}" class="mapbtn${m.id === o.mapType ? ' on' : ''}" data-tip="${esc(m.name)}" data-tip-desc="${esc(m.desc)}"><svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">${MAP_ART[m.id] || ''}</svg><span>${esc(m.name)}</span></button>`).join('')}</div><div class="seg-hint">${esc(mt.desc)}</div></div>
      <div class="field"><label>Schwierigkeit</label><div class="seg">${DIFFICULTIES.map((d) => `<button data-act="diff" data-v="${d.id}" class="${d.id === o.difficulty ? 'on' : ''}" data-tip="${esc(d.name)}" data-tip-desc="${esc(d.desc)}">${d.name}</button>`).join('')}</div><div class="seg-hint">${esc(df.desc)}</div></div>
      <button class="nc-more" data-act="moreopts" aria-expanded="${more}">${icon(more ? 'chevronU' : 'chevronD', 15, 2.4)}<span>${more ? 'Weniger Optionen' : 'Mehr Optionen: Größe, Startwert, Katastrophen'}</span></button>
      <div class="nc-adv${more ? '' : ' closed'}">
        <div class="inline">
          <div class="field"><label for="m-size">Größe</label><select id="m-size">${MAP_SIZES.map((s) => `<option value="${s.id}" ${s.id === o.size ? 'selected' : ''}>${s.name}</option>`).join('')}</select></div>
          <div class="field"><label for="m-seed">Startwert</label><div class="inline"><input type="number" id="m-seed" value="${o.seed}" min="0" max="999999"><button class="btn ghost" data-act="rseed" style="flex:none" data-tip="Neue Karte" data-tip-desc="Eine andere Landschaft würfeln." aria-label="Neue Karte">↻</button></div></div>
        </div>
        ${formExtra}
      </div>
      <div class="acts"><button class="btn big go" data-act="start" data-tip="Stadt gründen" data-tip-desc="Los geht's – die Einführung zeigt die ersten Schritte.">Stadt gründen ${icon('arrowR', 16, 2.4)}</button><button class="btn big ghost" data-act="preview" data-tip="${this.previewing ? 'Beispielstadt' : 'Karte ansehen'}" data-tip-desc="${this.previewing ? 'Zurück zur Beispielstadt im Hintergrund.' : 'Die gewählte Landschaft im Hintergrund zeigen.'}">${icon('map', 16)} ${this.previewing ? 'Beispielstadt' : 'Karte ansehen'}</button></div>
      </div>
    </div>` : `<div class="modes">${modes}</div>`}
    <div class="menu-foot">
      <button class="btn ghost dark" data-act="settings" data-tip="Einstellungen" data-tip-desc="Grafik, Klang und Bedienung.">${icon('settings', 16)} Einstellungen</button>
      <button class="btn ghost dark" data-act="keys" data-tip="Tastenkürzel" data-tip-desc="Alle Tasten auf einen Blick.">${icon('keyboard', 16)} Tasten</button>
      ${window.STADTPULS_EMBED ? '' : `<label class="btn ghost dark file" data-tip="Spielstand aus Datei" data-tip-desc="Eine gesicherte Stadt (.json) öffnen.">${icon('download', 16)} Aus Datei<input type="file" id="m-file" accept=".json,application/json"></label>`}
    </div>
    <div class="foot">Rechte Maus verschiebt · Mausrad zoomt · Q/E dreht · Tageslänge unter Einstellungen → Bedienung</div>
  </div>
  <div class="stage-note">${this.previewing ? `<span class="pv-tag">${icon('map', 14)} Vorschau · ${esc(mt.name)} · ${esc((MAP_SIZES.find((s) => s.id === o.size) || {}).name || '')} · Startwert ${o.seed}</span>` : ''}</div>
</div>`;
    const r = this.root;
    this._introDone = true;
    r.querySelector('.menu').addEventListener('click', (e) => this.click(e));
    r.querySelector('.menu').addEventListener('pointerdown', (e) => this.prelaunch(e));
    const nm = r.querySelector('#m-name'), sz = r.querySelector('#m-size'), sd = r.querySelector('#m-seed');
    if (nm) nm.addEventListener('input', (e) => { this.opts.name = e.target.value; });
    if (sz) sz.addEventListener('change', (e) => { this.opts.size = +e.target.value; this.preview(); this.render(); });
    if (sd) sd.addEventListener('change', (e) => { this.opts.seed = Math.max(0, Math.floor(+e.target.value || 0)); this.preview(); this.render(); });
    const mf = r.querySelector('#m-file');
    if (mf) mf.addEventListener('change', (e) => { const f = e.target.files[0]; if (f) { showLoader('Spielstand wird geladen'); painted().then(() => this.app.importFile(f)); setTimeout(() => { if (this.app.mode !== 'game') hideLoader(); }, 4000); } });
  }

  click(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const o = this.opts;
    const act = b.dataset.act;
    for (const sec of MENU_SECTIONS) { try { if (sec.click && sec.click(this, act, b)) return; } catch (err) { console.error(err); } }
    if (this.app.audio) this.app.audio.play('click');
    if (act === 'start') {
      o.name = (o.name || '').trim() || 'Neustadt';
      this.launch(`${o.name} wird gegründet`, 'Landschaft formen, Straßen und Häuser vorbereiten …', () => this.app.newGame({ ...o }));
      return;
    }
    if (act === 'continue') { this.launch('Weiterspielen', 'Spielstand wird geladen …', () => this.app.loadSlot('auto')); return; }
    if (act === 'slot') { const k = +b.dataset.k; this.launch('Spielstand wird geladen', `Platz ${k}`, () => this.app.loadSlot(k)); return; }
    if (act === 'settings') { this.openSettings(); return; }
    if (act === 'keys') { this.openModal(keysHTML(), (ev, close) => { if (ev.target.closest('[data-act=ok]') || ev.target.classList.contains('backdrop')) close(); }); return; }
    if (act === 'toggleform') { if (!this.app.slotMeta('auto')) return; this.formOpen = !this.formOpen; this.render(); return; }
    if (act === 'mtab') { this.tab = b.dataset.v; this.render(); return; }
    if (act === 'moreopts') { this.moreOpts = !this.moreOpts; this.render(); return; }
    if (act === 'rname') { o.name = cityName(mulberry32(Date.now() & 0xffff)); }
    if (act === 'map') { o.mapType = b.dataset.v; this.preview(); }
    if (act === 'diff') o.difficulty = b.dataset.v;
    if (act === 'rseed') { o.seed = Math.floor(Math.random() * 99999); this.preview(); }
    if (act === 'preview') { if (this.previewing) { this.previewing = false; this.app.menuPreview(null); } else this.preview(); }
    this.render();
  }

  // Ladebildschirm zeigen, Menü-Stadt anhalten (schnelles Bild), dann starten
  // Synchron starten (Prüfwerkzeuge erwarten das Spiel direkt nach dem Klick). Der Ladebildschirm erscheint schon beim
  // Drücken der Maustaste (pointerdown, siehe prelaunch), damit er während der Arbeit sichtbar ist.
  launch(title, step, fn) {
    const app = this.app;
    clearTimeout(this._preT);
    const prev = this._preMode || app.mode;
    this._preMode = null;
    showLoader(title, step);
    try { fn(); } catch (e) { console.error(e); }
    if (app.mode !== 'game') { app.mode = prev === 'loading' ? 'menu' : prev; hideLoader(); }
  }
  prelaunch(e) {
    const b = e.target.closest('[data-act=start], [data-act=continue], [data-act=slot], [data-act=s5-start], [data-act=s5-daily], [data-act=s5-metro]');
    if (!b || e.button > 0) return;
    const app = this.app;
    this._preMode = app.mode;
    app.mode = 'loading';  // Menü-Stadt anhalten, damit das nächste Bild sofort kommt
    const act = b.dataset.act;
    showLoader(act === 'start' ? `${(this.opts.name || '').trim() || 'Neustadt'} wird gegründet` : act === 's5-start' ? 'Szenario wird vorbereitet' : act.startsWith('s5-') ? 'Metro-Modus' : 'Spielstand wird geladen', 'Einen Moment …');
    loaderEl().classList.add('pre'); // Klick muss den Knopf noch erreichen
    clearTimeout(this._preT);
    this._preT = setTimeout(() => { if (this._preMode !== null && app.mode === 'loading') { app.mode = this._preMode; this._preMode = null; hideLoader(true); } }, 1500);
  }

  preview() {
    this.previewing = true;
    clearTimeout(this._pt);
    this._pt = setTimeout(() => this.app.menuPreview({ ...this.opts }), 60);
  }

  // kleine Modale im Menü (ohne Spiel-Oberfläche)
  openModal(html, onClick) {
    const root = document.getElementById('modal-root');
    const wrap = document.createElement('div');
    wrap.className = 'backdrop enter';
    wrap.innerHTML = html;
    root.appendChild(wrap);
    const close = () => { wrap.classList.add('out'); setTimeout(() => wrap.remove(), 180); };
    wrap.addEventListener('click', (e) => onClick(e, close, wrap));
    return wrap;
  }

  openSettings() {
    const app = this.app;
    const snap = gfxSnapshot(app.settings);
    const ctx = { app, inGame: false, tab: 'grafik', snap, onTips: (v) => setTipsEnabled(v) };
    const body = () => `<div class="modal settings-modal"><div class="ks-head"><div><div class="eyebrow">Stadtpuls</div><h2>Einstellungen</h2></div><button class="close" data-act="ok" aria-label="Schließen">${icon('close', 18)}</button></div><div class="panelish">${settingsHTML(ctx)}</div></div>`;
    const wrap = this.openModal(body(), (e, close) => {
      if (e.target.classList.contains('backdrop')) { finish(); close(); return; }
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'ok') { finish(); close(); return; }
      if (act === 'applygfx') { ctx.snap = gfxSnapshot(app.settings); app.menuPreview(this.previewing ? { ...this.opts } : null); }
      else if (act === 'keys') { this.openModal(keysHTML(), (ev, c2) => { if (ev.target.closest('[data-act=ok]') || ev.target.classList.contains('backdrop')) c2(); }); return; }
      else settingsClick(ctx, act, b);
      const scroll = wrap.querySelector('.panelish').scrollTop;
      wrap.innerHTML = body();
      wrap.querySelector('.panelish').scrollTop = scroll;
    });
    wrap.addEventListener('input', (e) => settingsInput(ctx, e.target));
    wrap.addEventListener('change', (e) => settingsChange(ctx, e.target));
    const finish = () => { if (gfxChanged(app.settings, ctx.snap) && !(app.engine && typeof app.engine.applyQuality === 'function')) app.menuPreview(this.previewing ? { ...this.opts } : null); };
  }
}
