// Hauptmenü: neue Stadt anlegen, weiterspielen, Spielstände laden.
import { MAP_TYPES, MAP_SIZES, DIFFICULTIES } from '../config.js';
import { cityName, mulberry32, fmt } from '../util.js';
import { logo } from './icons.js';
import { esc } from './ui.js';

export class Menu {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('menu');
    const rng = mulberry32(Date.now() & 0xffffff);
    this.opts = { name: cityName(rng), mapType: 'river', size: 96, difficulty: 'normal', seed: Math.floor(rng() * 99999) };
    this.view = 'main';
  }

  show() {
    this.root.hidden = false;
    this.render();
  }
  hide() { this.root.hidden = true; this.root.innerHTML = ''; }

  render() {
    const app = this.app;
    const auto = app.slotMeta('auto');
    const slots = [1, 2, 3].map((k) => [k, app.slotMeta(k)]).filter(([, m]) => m);
    const o = this.opts;
    const mt = MAP_TYPES.find((m) => m.id === o.mapType);
    const df = DIFFICULTIES.find((d) => d.id === o.difficulty);
    this.root.innerHTML = `
<div class="menu">
  <div class="side">
    <div class="brand">${logo(64)}<div><h1>Stadtpuls</h1></div></div>
    <p class="lede">Baue eine Stadt, die im Takt schlägt. Zonen, Strom und Wasser, Feuerwehr und Schulen – und eine Hochbahn über den Dächern, deren Züge bei jeder Ankunft einen Ton spielen.</p>
    ${auto ? `<div class="card"><h3>Weiterspielen</h3><div class="slot"><div class="grow"><div class="t">${esc(auto.name)}</div><div class="s">${fmt(auto.pop)} Einwohner · ${new Date(auto.savedAt).toLocaleString('de-DE')}</div></div><button class="btn" data-act="continue">Fortsetzen</button></div>${slots.map(([k, m]) => `<div class="slot"><div class="grow"><div class="t">Platz ${k}: ${esc(m.name)}</div><div class="s">${fmt(m.pop)} Einwohner · ${new Date(m.savedAt).toLocaleString('de-DE')}</div></div><button class="btn small ghost" data-act="slot" data-k="${k}">Laden</button></div>`).join('')}</div>` : ''}
    <div class="card">
      <h3>Neue Stadt gründen</h3>
      <div class="field"><label for="m-name">Name der Stadt</label><div class="inline"><input type="text" id="m-name" maxlength="28" value="${esc(o.name)}"><button class="btn ghost" data-act="rname" style="flex:none" title="Zufälliger Name">Würfeln</button></div></div>
      <div class="field"><label>Landschaft</label><div class="seg">${MAP_TYPES.map((m) => `<button data-act="map" data-v="${m.id}" class="${m.id === o.mapType ? 'on' : ''}">${m.name}</button>`).join('')}</div><div class="seg-hint">${esc(mt.desc)}</div></div>
      <div class="inline">
        <div class="field"><label for="m-size">Größe</label><select id="m-size">${MAP_SIZES.map((s) => `<option value="${s.id}" ${s.id === o.size ? 'selected' : ''}>${s.name}</option>`).join('')}</select></div>
        <div class="field"><label for="m-seed">Startwert</label><div class="inline"><input type="number" id="m-seed" value="${o.seed}" min="0" max="999999"><button class="btn ghost" data-act="rseed" style="flex:none" title="Neue Karte">↻</button></div></div>
      </div>
      <div class="field"><label>Schwierigkeit</label><div class="seg">${DIFFICULTIES.map((d) => `<button data-act="diff" data-v="${d.id}" class="${d.id === o.difficulty ? 'on' : ''}">${d.name}</button>`).join('')}</div><div class="seg-hint">${esc(df.desc)}</div></div>
      <div class="acts"><button class="btn big go" data-act="start">Stadt gründen</button><button class="btn big ghost" data-act="preview">Karte ansehen</button></div>
    </div>
    <div class="card"><h3>Spielstand aus Datei</h3><input type="file" id="m-file" accept=".json,application/json"><p class="seg-hint" style="margin:8px 0 0">Exportierte Stände (.json) lassen sich hier wieder laden.</p></div>
    <div class="foot">Rechte Maus verschiebt, Mausrad zoomt, Q/E dreht. Ein Spieltag dauert 30 Sekunden. · Das Konzept steht in <code>spiel/docs/</code>.</div>
  </div>
  <div></div>
</div>`;
    const r = this.root;
    r.querySelector('.menu').addEventListener('click', (e) => this.click(e));
    r.querySelector('#m-name').addEventListener('input', (e) => { this.opts.name = e.target.value; });
    r.querySelector('#m-size').addEventListener('change', (e) => { this.opts.size = +e.target.value; this.preview(); });
    r.querySelector('#m-seed').addEventListener('change', (e) => { this.opts.seed = Math.max(0, Math.floor(+e.target.value || 0)); this.preview(); });
    r.querySelector('#m-file').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) this.app.importFile(f); });
  }

  click(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const o = this.opts;
    const act = b.dataset.act;
    if (act === 'start') {
      o.name = (o.name || '').trim() || 'Neustadt';
      this.app.newGame({ ...o });
      return;
    }
    if (act === 'continue') { this.app.loadSlot('auto'); return; }
    if (act === 'slot') { this.app.loadSlot(+b.dataset.k); return; }
    if (act === 'rname') { o.name = cityName(mulberry32(Date.now() & 0xffff)); }
    if (act === 'map') { o.mapType = b.dataset.v; this.preview(); }
    if (act === 'diff') o.difficulty = b.dataset.v;
    if (act === 'rseed') { o.seed = Math.floor(Math.random() * 99999); this.preview(); }
    if (act === 'preview') { this.preview(); }
    this.render();
  }

  preview() {
    clearTimeout(this._pt);
    this._pt = setTimeout(() => this.app.menuPreview({ ...this.opts }), 60);
  }
}
