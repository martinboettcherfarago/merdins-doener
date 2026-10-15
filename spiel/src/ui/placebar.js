// Bestätigungsleiste für sicheres Bauen per Touch (TOUCH, Runde 3b).
// Solange eine Bauvorschau auf Bestätigung wartet (input.pend), schwebt sie nahe der Vorschau – nie unter dem Finger:
//   ✕ Abbrechen · ↶ Zurück (Linien) · ◯ Ring (U-Bahn) · ↻ Drehen (Gebäude) · ✓ Bauen/Ausweisen/Abreißen/Fertig mit Preis (oranger Knopf).
// Ist der Platz ungültig, ist ✓ gesperrt und die Zeile darüber nennt den Grund.
// Griffe (Straßen-/Flächenenden, Verschiebe-Marke der Gebäudevorschau) sind reine Anzeige (pointer-events: none):
// Die Geste wertet input.js auf der Karte aus, damit Zwei-Finger-Zoom und Kamera immer greifen.
// Ebenen: Leiste z-index 47 (über der Einführungskarte #ob-layer 46, der sie zusätzlich ausweicht), Griffe 27.
// Aussehen über die CSS-Variablen von DESIGN (--accent, --accent-ink, --accent-soft, --cta, --cta-2, --cta-edge, --card,
// --r-pill, --f-ui) – jeweils mit Rückfallwert, falls sie (noch) fehlen.
//
// Schnittstelle für input.js:
//   bar.show(st)  st = { title, sub, warn, ok, okLabel, price, reason, rotate, undo, undoOff, ring: 'close' | 'open' | null }
//   bar.hide()
//   input.pendScreen() → { box: {x0, y0, x1, y1}, handles: [{x, y, kind: 's'|'e'|'m', on}], finger: {x, y} | null,
//                          draw?: { lines: [{pts, color, w, op, dash, halo}], dots: [{x, y, r, fill, stroke, sw, dash, glow}] },
//                          pop?: { x, y, items: [{a, label, icon}] } } | null
//     draw: Linienentwurf der U-Bahn als Bildschirm-Zeichnung (SVG, unter den Griffen, ohne Zeiger-Ereignisse),
//     pop: kleines Menü an einer Station (Knöpfe → input.barAction('pop:' + a)).
//   input.pendTick(dt)  (jedes Bild, solange die Leiste sichtbar ist)
//   input.barAction('ok' | 'cancel' | 'rotate' | 'undo' | 'ring' | 'pop:…')

const SVG = {
  ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  cancel: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  rotate: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4.6h-4.6"/>',
  undo: '<path d="M9 14.5L4.5 10 9 5.5"/><path d="M4.5 10h9.5a5.5 5.5 0 0 1 0 11h-3"/>',
  move: '<path d="M12 3.5v17M3.5 12h17"/><path d="M9.2 6.3L12 3.5l2.8 2.8M9.2 17.7l2.8 2.8 2.8-2.8M6.3 9.2L3.5 12l2.8 2.8M17.7 9.2l2.8 2.8-2.8 2.8"/>',
  ring: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="4.5" r="2.2" fill="currentColor"/>',
  open: '<path d="M8.5 5.2A7.5 7.5 0 1 0 15.5 5.2"/><circle cx="8.5" cy="5.2" r="2" fill="currentColor"/><circle cx="15.5" cy="5.2" r="2" fill="currentColor"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5"/>',
  minus: '<circle cx="12" cy="12" r="8"/><path d="M8 12h8"/>',
};
const svg = (k, s = 22, w = 2.6) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVG[k]}</svg>`;

const STYLE = `
.placebar {
  --pb-accent: var(--accent, #7b3fe4); --pb-ink: var(--accent-ink, #3b1d78); --pb-soft: var(--accent-soft, #efe7ff);
  --pb-card: var(--card, #ffffff); --pb-cta: var(--cta, #ffb12b); --pb-cta2: var(--cta-2, #ff7417); --pb-edge: var(--cta-edge, #c4500a);
  position: fixed; left: 0; top: 0; z-index: 47; display: flex; flex-direction: column; align-items: stretch; gap: 8px;
  padding: 8px; min-width: 224px; max-width: calc(100vw - 16px); box-sizing: border-box;
  background: var(--grain-soft, none), var(--glass-bg, var(--pb-card)); -webkit-backdrop-filter: var(--glass-blur, none); backdrop-filter: var(--glass-blur, none);
  color: var(--pb-ink); border-radius: 24px;
  box-shadow: var(--inner-hi, inset 0 1px 0 #fff), var(--shadow, 0 12px 30px -8px rgba(76, 38, 160, 0.42)), 0 18px 36px -14px rgba(52, 19, 122, 0.4);
  font-family: var(--f-ui, system-ui, sans-serif); font-weight: 700; touch-action: manipulation;
  -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent;
  transition: opacity 0.12s ease; will-change: transform;
}
.placebar[hidden] { display: none; }
.placebar.pb-drag { opacity: 0.55; pointer-events: none; }
.placebar .pb-info { display: flex; flex-direction: column; gap: 1px; padding: 2px 8px 0; min-width: 0; text-align: center; }
.placebar .pb-t { font-family: var(--f-display, inherit); font-size: 15px; font-weight: 600; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.placebar .pb-s { font-size: 12px; font-weight: 700; line-height: 1.3; color: var(--pb-accent); max-width: 300px; }
.placebar .pb-s.bad { color: var(--bad, #d6363a); }
.placebar .pb-s.warn { color: #b8620a; }
.placebar .pb-s:empty { display: none; }
.placebar .pb-row { display: flex; align-items: stretch; gap: 8px; }
.placebar button { font: inherit; border: 0; margin: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; transition: transform 0.1s var(--ease-out, ease), box-shadow 0.1s ease; }
.placebar .pb-k {
  flex: none; width: 52px; height: 52px; display: grid; place-items: center; border-radius: 16px;
  background: var(--m-soft, var(--pb-soft)); color: var(--pb-accent); box-shadow: var(--e-soft, inset 0 -3px 0 rgba(76, 38, 160, 0.16));
}
.placebar .pb-k:active { transform: translateY(2px); box-shadow: var(--p-soft, inset 0 -1px 0 rgba(76, 38, 160, 0.16)); }
.placebar .pb-k[hidden] { display: none; }
.placebar .pb-k:disabled { opacity: 0.4; cursor: default; transform: none; }
.placebar .pb-x { background: var(--m-violet, var(--pb-accent)); color: #fff; box-shadow: var(--e-violet, inset 0 -3px 0 rgba(0, 0, 0, 0.22)); }
.placebar .pb-x svg { filter: drop-shadow(0 1px 0 rgba(28, 6, 78, 0.5)); }
.placebar .pb-x:active { box-shadow: var(--p-violet, 0 1px 0 var(--accent-edge, #3a1a80)); }
.placebar .pb-ok {
  flex: 1; min-width: 136px; height: 52px; padding: 0 16px 2px; display: flex; align-items: center; justify-content: center; gap: 8px;
  border-radius: 16px; color: #fff; background: var(--m-amber, linear-gradient(180deg, var(--pb-cta), var(--pb-cta2)));
  box-shadow: var(--e-amber, inset 0 -4px 0 var(--pb-edge)); text-shadow: var(--ts-amber, 0 1px 0 rgba(120, 40, 0, 0.35));
}
.placebar .pb-ok svg { filter: drop-shadow(0 1px 0 rgba(140, 56, 0, 0.5)); }
.placebar .pb-ok:active { transform: translateY(2px); box-shadow: var(--p-amber, 0 1px 0 var(--pb-edge)); }
.placebar .pb-ok .pb-l { font-family: var(--f-display, inherit); font-size: 16px; font-weight: 600; }
.placebar .pb-ok .pb-p { font-family: var(--f-display, inherit); font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; padding: 2px 8px; border-radius: 999px; background: rgba(150, 60, 0, 0.18); box-shadow: inset 0 1px 2px rgba(120, 40, 0, 0.25); }
.placebar .pb-ok .pb-p:empty { display: none; }
.placebar .pb-ok:disabled { background: linear-gradient(180deg, #f1ebfc, #e6ddf8); box-shadow: inset 0 1px 3px rgba(76, 38, 160, 0.18); color: var(--ink-3, #8a80a8); text-shadow: none; cursor: not-allowed; }
.placebar .pb-ok:disabled svg { filter: none; }
.placebar .pb-ok:disabled .pb-p { background: rgba(76, 38, 160, 0.08); box-shadow: none; }
.pb-hs { position: fixed; inset: 0; z-index: 27; pointer-events: none; overflow: hidden; }
.pb-draw { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.pb-draw[hidden] { display: none; }
.pb-svg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: visible; }
.pb-pop {
  position: fixed; left: 0; top: 0; z-index: 46; display: flex; gap: 6px; padding: 6px; border-radius: 18px; pointer-events: auto;
  background: var(--grain-soft, none), var(--glass-bg, var(--card, #fff)); -webkit-backdrop-filter: var(--glass-blur, none); backdrop-filter: var(--glass-blur, none);
  box-shadow: var(--inner-hi, inset 0 1px 0 #fff), 0 10px 26px -8px rgba(52, 19, 122, 0.5); touch-action: manipulation;
  font-family: var(--f-ui, system-ui, sans-serif); -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent;
}
.pb-pop[hidden] { display: none; }
.pb-pop button {
  font: 700 13px/1 var(--f-ui, system-ui, sans-serif); border: 0; margin: 0; cursor: pointer; height: 44px; min-width: 44px; padding: 0 12px;
  display: inline-flex; align-items: center; gap: 6px; border-radius: 13px; color: var(--accent-ink, #3b1d78);
  background: var(--m-soft, var(--accent-soft, #efe7ff)); box-shadow: var(--e-soft, inset 0 -3px 0 rgba(76, 38, 160, 0.16));
}
.pb-pop button[data-pb="pop:rm"] { color: #fff; background: linear-gradient(180deg, #f06a6e, #d6363a); box-shadow: inset 0 -3px 0 #a3242a; }
.pb-pop button:active { transform: translateY(2px); }
.pb-hs[hidden] { display: none; }
.pb-h {
  position: absolute; left: 0; top: 0; width: 30px; height: 30px; margin: -15px 0 0 -15px; border-radius: 50%; box-sizing: border-box;
  display: grid; place-items: center; color: #fff; background: var(--m-violet, var(--accent, #7b3fe4)); border: 3px solid #fff;
  box-shadow: 0 3px 10px rgba(40, 16, 96, 0.45), 0 0 0 6px rgba(123, 63, 228, 0.18); transition: width 0.1s, height 0.1s, margin 0.1s;
}
.pb-h.s { background: #fff; border-color: var(--accent, #7b3fe4); }
.pb-h.m { width: 36px; height: 36px; margin: -18px 0 0 -18px; background: rgba(123, 63, 228, 0.82); }
.pb-h.on { width: 40px; height: 40px; margin: -20px 0 0 -20px; }
/* Linienenden (U-Bahn): Ring in Linienfarbe, die Station darunter bleibt sichtbar; außen ein Pfeil-Hof zum Ziehen */
.pb-h.lg { width: 40px; height: 40px; margin: -20px 0 0 -20px; background: transparent; border: 4px solid #fff;
  box-shadow: 0 0 0 4px var(--lc, #7b3fe4), 0 4px 12px 2px rgba(40, 16, 96, 0.5), 0 0 0 12px color-mix(in srgb, var(--lc, #7b3fe4) 22%, transparent); }
.pb-h.lg.on { width: 50px; height: 50px; margin: -25px 0 0 -25px; box-shadow: 0 0 0 4px var(--lc, #7b3fe4), 0 6px 16px 2px rgba(40, 16, 96, 0.55), 0 0 0 16px color-mix(in srgb, var(--lc, #7b3fe4) 28%, transparent); }
@media (prefers-reduced-motion: reduce) { .pb-h { transition: none; } .placebar, .placebar button { transition: none; } }
`;

function ensureStyle() {
  if (document.getElementById('placebar-style')) return;
  const s = document.createElement('style');
  s.id = 'placebar-style';
  s.textContent = STYLE;
  document.head.appendChild(s);
}

export class PlaceBar {
  constructor(input) {
    this.input = input;
    ensureStyle();
    const el = document.createElement('div');
    el.className = 'placebar';
    el.hidden = true;
    el.setAttribute('role', 'toolbar');
    el.setAttribute('aria-label', 'Bauvorschau bestätigen');
    el.innerHTML = `<div class="pb-info"><b class="pb-t"></b><span class="pb-s" aria-live="polite"></span></div>
<div class="pb-row"><button type="button" class="pb-k pb-x" data-pb="cancel" data-tour="place-cancel" aria-label="Abbrechen" title="Abbrechen">${svg('cancel')}</button><button type="button" class="pb-k" data-pb="undo" aria-label="Zurück: letzte Station entfernen" title="Zurück">${svg('undo')}</button><button type="button" class="pb-k" data-pb="rotate" data-tour="place-rotate" aria-label="Drehen" title="Drehen">${svg('rotate')}</button><button type="button" class="pb-k" data-pb="ring" aria-label="Ring schließen" title="Ring">${svg('ring')}</button><button type="button" class="pb-ok" data-pb="ok" data-tour="place-ok">${svg('ok', 22, 3)}<span class="pb-l">Bauen</span><span class="pb-p"></span></button></div>`;
    this.el = el;
    this.q = {
      t: el.querySelector('.pb-t'), s: el.querySelector('.pb-s'), ok: el.querySelector('.pb-ok'), l: el.querySelector('.pb-l'), p: el.querySelector('.pb-p'),
      rot: el.querySelector('[data-pb=rotate]'), undo: el.querySelector('[data-pb=undo]'), ring: el.querySelector('[data-pb=ring]'),
    };
    this.hs = document.createElement('div');
    this.hs.className = 'pb-hs';
    this.hs.hidden = true;
    // Zeichnung des Linienentwurfs: über der Karte, aber unter der Oberfläche (#hud) – Tafeln verdecken sie
    this.drawEl = document.createElement('div');
    this.drawEl.className = 'pb-draw';
    this.drawEl.hidden = true;
    this.drawEl.innerHTML = '<svg class="pb-svg" aria-hidden="true"></svg>';
    this.svgEl = this.drawEl.firstChild;
    this._svg = '';
    this.mountDraw();
    // Kleines Menü an einer Station (Linie bearbeiten)
    this.popEl = document.createElement('div');
    this.popEl.className = 'pb-pop';
    this.popEl.hidden = true;
    this.popEl.setAttribute('role', 'menu');
    this._pop = '';
    document.body.append(this.hs, el, this.popEl);
    for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'dblclick', 'contextmenu']) this.popEl.addEventListener(ev, (e) => e.stopPropagation());
    this.popEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pb]');
      if (!b) return;
      e.preventDefault();
      this.input.barAction(b.dataset.pb);
    });
    // Die Leiste gehört nicht zur Karte: Zeiger-Ereignisse nicht an Kamera und Werkzeuge durchreichen
    for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'dblclick', 'contextmenu']) el.addEventListener(ev, (e) => e.stopPropagation());
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pb]');
      if (!b || b.disabled) return;
      e.preventDefault();
      this.input.barAction(b.dataset.pb);
    });
    this.handleEls = [];
    this.visible = false;
    this.raf = 0;
    this.last = 0;
    this.pos = { x: -1, y: -1, side: 0 };
  }

  // Zeichenebene direkt vor #hud einhängen (die Oberfläche entsteht evtl. erst nach der Leiste)
  mountDraw() {
    const hud = document.getElementById('hud');
    if (hud && hud.parentNode) { if (this.drawEl.nextSibling !== hud) hud.parentNode.insertBefore(this.drawEl, hud); }
    else if (!this.drawEl.isConnected) document.body.appendChild(this.drawEl);
  }

  show(st) {
    const q = this.q;
    if (q.t.textContent !== st.title) q.t.textContent = st.title || '';
    const sub = !st.ok && st.reason ? st.reason : st.sub || '';
    if (q.s.textContent !== sub) q.s.textContent = sub;
    q.s.className = 'pb-s' + (!st.ok && st.reason ? ' bad' : st.warn ? ' warn' : '');
    q.l.textContent = st.okLabel || 'Bauen';
    q.p.textContent = st.price || '';
    q.ok.disabled = !st.ok;
    q.ok.setAttribute('aria-label', `${st.okLabel || 'Bauen'}${st.price ? ' für ' + st.price : ''}${!st.ok && st.reason ? ' – gesperrt: ' + st.reason : ''}`);
    q.rot.hidden = !st.rotate;
    q.undo.hidden = !st.undo;
    q.undo.disabled = !!st.undoOff; // Linienentwurf: Knopf bleibt stehen (gesperrt), damit die Leiste nicht springt
    q.ring.hidden = !st.ring;
    if (st.ring) {
      const lab = st.ring === 'open' ? 'Ring öffnen' : 'Ring schließen';
      if (q.ring.dataset.st !== st.ring) { q.ring.dataset.st = st.ring; q.ring.innerHTML = svg(st.ring === 'open' ? 'open' : 'ring'); q.ring.setAttribute('aria-label', lab); q.ring.title = lab; }
    }
    if (!this.visible) {
      this.visible = true;
      document.documentElement.classList.add('placebar-on');
      this.el.hidden = false;
      this.hs.hidden = false;
      this.drawEl.hidden = false;
      this.mountDraw();
      this.pos.side = 0;
      this.place(true);
      this.loop();
    }
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    document.documentElement.classList.remove('placebar-on');
    this.el.hidden = true;
    this.hs.hidden = true;
    this.drawEl.hidden = true;
    this.popEl.hidden = true;
    this._pop = '';
    if (this._svg) { this._svg = ''; this.svgEl.innerHTML = ''; }
    this.el.classList.remove('pb-drag');
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  loop() {
    this.last = performance.now();
    const step = (now) => {
      if (!this.visible) { this.raf = 0; return; }
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      try { this.input.pendTick(dt); this.place(false); } catch (e) { console.error(e); }
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  // Griffe und Leiste an die Vorschau heften (jedes Bild – die Kamera gleitet nach)
  place(first) {
    if (!this.visible) return;
    const s = this.input.pendScreen();
    const off = !s || this.input.photoActive();
    this.el.style.visibility = off ? 'hidden' : '';
    this.hs.style.visibility = off ? 'hidden' : '';
    this.popEl.style.visibility = off ? 'hidden' : '';
    this.drawEl.style.visibility = off ? 'hidden' : '';
    if (off) return;
    this.drawSvg(s.draw);
    this.placePop(s.pop);
    // Griffe
    const hs = s.handles || [];
    while (this.handleEls.length < hs.length) {
      const d = document.createElement('div');
      this.hs.appendChild(d);
      this.handleEls.push(d);
    }
    this.handleEls.forEach((d, k) => {
      const h = hs[k];
      if (!h) { if (!d.hidden) d.hidden = true; return; }
      d.hidden = false;
      const cls = 'pb-h ' + h.kind + (h.color ? ' lg' : '') + (h.on ? ' on' : '');
      if (d.className !== cls) { d.className = cls; d.innerHTML = h.kind === 'm' ? svg('move', 18, 2.4) : ''; }
      if (h.color && d._lc !== h.color) { d._lc = h.color; d.style.setProperty('--lc', h.color); }
      d.style.transform = `translate(${Math.round(h.x)}px, ${Math.round(h.y)}px)`;
    });
    // Leiste: über der Vorschau, sonst darunter; nie unter dem Finger
    const dragging = !!s.dragging;
    this.el.classList.toggle('pb-drag', dragging);
    const W = window.innerWidth, H = window.innerHeight;
    const bw = this.el.offsetWidth, bh = this.el.offsetHeight;
    const top0 = 64, bottom0 = H - this.bottomGap();
    const b = s.box;
    const cx = (b.x0 + b.x1) / 2;
    const above = b.y0 - 26 - bh, below = b.y1 + 30;
    const fitsAbove = above >= top0, fitsBelow = below + bh <= bottom0;
    let side = this.pos.side;
    if (first || !side || (side < 0 && !fitsAbove && fitsBelow) || (side > 0 && !fitsBelow && fitsAbove)) side = fitsAbove || !fitsBelow ? -1 : 1;
    const x = Math.max(8, Math.min(W - bw - 8, cx - bw / 2));
    const cl = (y) => Math.max(top0, Math.min(bottom0 - bh, y));
    // Hindernisse: Finger (großzügig), Einführungskarte, Begleiter und Legende der Ansicht – die Leiste weicht ihnen aus
    const f = s.finger;
    const obst = [];
    if (f) obst.push({ left: f.x - 24, right: f.x + 24, top: f.y - 24, bottom: f.y + 24 });
    for (const oc of document.querySelectorAll('#ob-layer .ob-card, #ob-guide, #u-legend')) {
      if (oc.hidden) continue;
      const r = oc.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && getComputedStyle(oc).visibility !== 'hidden') obst.push({ left: r.left - 8, right: r.right + 8, top: r.top - 8, bottom: r.bottom + 8 });
    }
    const free = (y) => !obst.some((r) => x < r.right && x + bw > r.left && y < r.bottom && y + bh > r.top);
    // Angedockt (Linienentwurf): unten mittig, sonst über bzw. unter den Hindernissen
    const cand = s.dock ? [[bottom0 - bh, 1]] : [[cl(side < 0 ? above : below), side], [cl(side < 0 ? below : above), -side]];
    for (const r of obst) { cand.push([cl(r.top - bh), side]); cand.push([cl(r.bottom), side]); }
    cand.push([top0, side], [bottom0 - bh, side]);
    const pick = cand.find(([y]) => free(y)) || cand[0];
    const y = pick[0];
    side = pick[1];
    this.pos.side = side;
    if (Math.abs(x - this.pos.x) > 0.5 || Math.abs(y - this.pos.y) > 0.5) {
      this.pos.x = x; this.pos.y = y;
      this.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }
  }

  // Linienentwurf zeichnen (nur neu schreiben, wenn sich etwas geändert hat)
  drawSvg(d) {
    let h = '';
    if (d) {
      const r1 = (v) => Math.round(v * 10) / 10;
      const pl = (pts) => pts.map((p) => `${r1(p.x)},${r1(p.y)}`).join(' ');
      for (const l of d.lines || []) {
        if (!l.pts || l.pts.length < 2) continue;
        const pts = pl(l.pts);
        if (l.halo) h += `<polyline points="${pts}" fill="none" stroke="#fff" stroke-opacity="0.85" stroke-width="${l.w + 5}" stroke-linecap="round" stroke-linejoin="round"/>`;
        h += `<polyline points="${pts}" fill="none" stroke="${l.color}" stroke-opacity="${l.op ?? 1}" stroke-width="${l.w}" stroke-linecap="round" stroke-linejoin="round"${l.dash ? ` stroke-dasharray="${l.dash}"` : ''}/>`;
      }
      for (const c of d.dots || []) {
        if (c.glow) h += `<circle cx="${r1(c.x)}" cy="${r1(c.y)}" r="${c.r + 4}" fill="${c.glow}" fill-opacity="0.28"/>`;
        h += `<circle cx="${r1(c.x)}" cy="${r1(c.y)}" r="${c.r}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="${c.sw}"${c.dash ? ` stroke-dasharray="${c.dash}"` : ''}/>`;
      }
    }
    if (h !== this._svg) { this._svg = h; this.svgEl.innerHTML = h; }
  }

  // Menü an der Station: darüber, sonst darunter; nie unter der Leiste
  placePop(p) {
    const el = this.popEl;
    if (!p || !p.items || !p.items.length) { if (!el.hidden) { el.hidden = true; this._pop = ''; } return; }
    const html = p.items.map((it) => `<button type="button" data-pb="pop:${it.a}" role="menuitem" aria-label="${it.label}">${SVG[it.icon] ? svg(it.icon, 18, 2.6) : ''}<span>${it.label}</span></button>`).join('');
    if (html !== this._pop) { this._pop = html; el.innerHTML = html; }
    el.hidden = false;
    const W = window.innerWidth, H = window.innerHeight;
    const w = el.offsetWidth, h = el.offsetHeight;
    let x = Math.max(8, Math.min(W - w - 8, p.x - w / 2));
    let y = p.y - 26 - h;
    if (y < 64) y = p.y + 26;
    y = Math.max(8, Math.min(H - this.bottomGap() - h, y));
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  // Für Prüfskripte: Lage der Menüknöpfe an der Station
  popRect(which) {
    const b = this.popEl.querySelector(`[data-pb="pop:${which}"]`);
    if (!b || this.popEl.hidden) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  }

  // Platz unten: Dock (DESIGN: --gap + --bb-h) plus 16 px, mit dem Zoom der Oberfläche (--ui); Rückfall 86 px
  bottomGap() {
    const now = performance.now();
    if (this._gap && now - this._gapAt < 1000) return this._gap;
    let gap = 86;
    try {
      const cs = getComputedStyle(document.documentElement);
      const px = (n, d) => { const v = parseFloat(cs.getPropertyValue(n)); return Number.isFinite(v) ? v : d; };
      gap = Math.round((px('--gap', 14) + px('--bb-h', 56) + 16) * px('--ui', 1));
    } catch (e) { /* Rückfall */ }
    this._gap = gap; this._gapAt = now;
    return gap;
  }

  // Für Prüfskripte: Lage der Knöpfe
  rect(which) {
    const b = this.el.querySelector(`[data-pb=${which}]`);
    if (!b || !this.visible || b.hidden) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, disabled: !!b.disabled };
  }

  dispose() {
    this.hide();
    this.el.remove();
    this.hs.remove();
    this.drawEl.remove();
    this.popEl.remove();
  }
}
