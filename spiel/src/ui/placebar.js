// Bestätigungsleiste für sicheres Bauen per Touch (TOUCH, Runde 3b).
// Solange eine Bauvorschau auf Bestätigung wartet (input.pend), schwebt sie nahe der Vorschau – nie unter dem Finger:
//   ✕ Abbrechen · ↶ Zurück (Linien) · ↻ Drehen (Gebäude) · ✓ Bauen/Ausweisen/Abreißen/Fertig mit Preis (oranger Knopf).
// Ist der Platz ungültig, ist ✓ gesperrt und die Zeile darüber nennt den Grund.
// Griffe (Straßen-/Flächenenden, Verschiebe-Marke der Gebäudevorschau) sind reine Anzeige (pointer-events: none):
// Die Geste wertet input.js auf der Karte aus, damit Zwei-Finger-Zoom und Kamera immer greifen.
// Ebenen: Leiste z-index 47 (über der Einführungskarte #ob-layer 46, der sie zusätzlich ausweicht), Griffe 27.
// Aussehen über die CSS-Variablen von DESIGN (--accent, --accent-ink, --accent-soft, --cta, --cta-2, --cta-edge, --card,
// --r-pill, --f-ui) – jeweils mit Rückfallwert, falls sie (noch) fehlen.
//
// Schnittstelle für input.js:
//   bar.show(st)  st = { title, sub, warn, ok, okLabel, price, reason, rotate, undo }
//   bar.hide()
//   input.pendScreen() → { box: {x0, y0, x1, y1}, handles: [{x, y, kind: 's'|'e'|'m', on}], finger: {x, y} | null } | null
//   input.pendTick(dt)  (jedes Bild, solange die Leiste sichtbar ist)
//   input.barAction('ok' | 'cancel' | 'rotate' | 'undo')

const SVG = {
  ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  cancel: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  rotate: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4.6h-4.6"/>',
  undo: '<path d="M9 14.5L4.5 10 9 5.5"/><path d="M4.5 10h9.5a5.5 5.5 0 0 1 0 11h-3"/>',
  move: '<path d="M12 3.5v17M3.5 12h17"/><path d="M9.2 6.3L12 3.5l2.8 2.8M9.2 17.7l2.8 2.8 2.8-2.8M6.3 9.2L3.5 12l2.8 2.8M17.7 9.2l2.8 2.8-2.8 2.8"/>',
};
const svg = (k, s = 22, w = 2.6) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVG[k]}</svg>`;

const STYLE = `
.placebar {
  --pb-accent: var(--accent, #7b3fe4); --pb-ink: var(--accent-ink, #3b1d78); --pb-soft: var(--accent-soft, #efe7ff);
  --pb-card: var(--card, #ffffff); --pb-cta: var(--cta, #ffb12b); --pb-cta2: var(--cta-2, #ff7417); --pb-edge: var(--cta-edge, #c4500a);
  position: fixed; left: 0; top: 0; z-index: 47; display: flex; flex-direction: column; align-items: stretch; gap: 6px;
  padding: 8px; min-width: 216px; max-width: calc(100vw - 16px); box-sizing: border-box;
  background: var(--pb-card); color: var(--pb-ink); border-radius: 20px;
  box-shadow: 0 12px 30px -8px rgba(76, 38, 160, 0.42), 0 2px 0 rgba(76, 38, 160, 0.12);
  font-family: var(--f-ui, 'Nunito', system-ui, sans-serif); font-weight: 700; touch-action: manipulation;
  -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent;
  transition: opacity 0.12s ease; will-change: transform;
}
.placebar[hidden] { display: none; }
.placebar.pb-drag { opacity: 0.55; pointer-events: none; }
.placebar .pb-info { display: flex; flex-direction: column; gap: 1px; padding: 2px 6px 0; min-width: 0; text-align: center; }
.placebar .pb-t { font-size: 14px; font-weight: 800; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.placebar .pb-s { font-size: 12px; font-weight: 700; line-height: 1.25; color: var(--pb-accent); max-width: 300px; }
.placebar .pb-s.bad { color: var(--bad, #d6363a); }
.placebar .pb-s.warn { color: #b8620a; }
.placebar .pb-s:empty { display: none; }
.placebar .pb-row { display: flex; align-items: stretch; gap: 8px; }
.placebar button { font: inherit; border: 0; margin: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.placebar .pb-k {
  flex: none; width: 48px; height: 48px; display: grid; place-items: center; border-radius: 15px;
  background: var(--pb-soft); color: var(--pb-accent); box-shadow: inset 0 -3px 0 rgba(76, 38, 160, 0.16);
}
.placebar .pb-k:active { transform: translateY(1px); box-shadow: inset 0 -1px 0 rgba(76, 38, 160, 0.16); }
.placebar .pb-k[hidden] { display: none; }
.placebar .pb-x { background: var(--pb-accent); color: #fff; box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.22); }
.placebar .pb-ok {
  flex: 1; min-width: 132px; height: 48px; padding: 0 14px 3px; display: flex; align-items: center; justify-content: center; gap: 8px;
  border-radius: 15px; color: #fff; background: linear-gradient(180deg, var(--pb-cta), var(--pb-cta2));
  box-shadow: inset 0 -4px 0 var(--pb-edge), 0 4px 10px -4px rgba(196, 80, 10, 0.55); text-shadow: 0 1px 0 rgba(120, 40, 0, 0.35);
}
.placebar .pb-ok:active { transform: translateY(2px); box-shadow: inset 0 -2px 0 var(--pb-edge); }
.placebar .pb-ok .pb-l { font-size: 15px; font-weight: 800; }
.placebar .pb-ok .pb-p { font-size: 16px; font-weight: 900; font-variant-numeric: tabular-nums; white-space: nowrap; }
.placebar .pb-ok .pb-p:empty { display: none; }
.placebar .pb-ok:disabled { background: linear-gradient(180deg, #d9d4e6, #c3bdd3); box-shadow: inset 0 -4px 0 #a9a2bd; color: #f7f5fb; text-shadow: none; cursor: not-allowed; }
.pb-hs { position: fixed; inset: 0; z-index: 27; pointer-events: none; overflow: hidden; }
.pb-hs[hidden] { display: none; }
.pb-h {
  position: absolute; left: 0; top: 0; width: 30px; height: 30px; margin: -15px 0 0 -15px; border-radius: 50%; box-sizing: border-box;
  display: grid; place-items: center; color: #fff; background: var(--accent, #7b3fe4); border: 3px solid #fff;
  box-shadow: 0 3px 10px rgba(40, 16, 96, 0.45), 0 0 0 6px rgba(123, 63, 228, 0.18); transition: width 0.1s, height 0.1s, margin 0.1s;
}
.pb-h.s { background: #fff; border-color: var(--accent, #7b3fe4); }
.pb-h.m { width: 36px; height: 36px; margin: -18px 0 0 -18px; background: rgba(123, 63, 228, 0.82); }
.pb-h.on { width: 40px; height: 40px; margin: -20px 0 0 -20px; }
@media (prefers-reduced-motion: reduce) { .pb-h { transition: none; } .placebar { transition: none; } }
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
<div class="pb-row"><button type="button" class="pb-k pb-x" data-pb="cancel" data-tour="place-cancel" aria-label="Abbrechen" title="Abbrechen">${svg('cancel')}</button><button type="button" class="pb-k" data-pb="undo" aria-label="Zurück: letzte Station entfernen" title="Zurück">${svg('undo')}</button><button type="button" class="pb-k" data-pb="rotate" data-tour="place-rotate" aria-label="Drehen" title="Drehen">${svg('rotate')}</button><button type="button" class="pb-ok" data-pb="ok" data-tour="place-ok">${svg('ok', 22, 3)}<span class="pb-l">Bauen</span><span class="pb-p"></span></button></div>`;
    this.el = el;
    this.q = {
      t: el.querySelector('.pb-t'), s: el.querySelector('.pb-s'), ok: el.querySelector('.pb-ok'), l: el.querySelector('.pb-l'), p: el.querySelector('.pb-p'),
      rot: el.querySelector('[data-pb=rotate]'), undo: el.querySelector('[data-pb=undo]'),
    };
    this.hs = document.createElement('div');
    this.hs.className = 'pb-hs';
    this.hs.hidden = true;
    document.body.append(this.hs, el);
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
    if (!this.visible) {
      this.visible = true;
      this.el.hidden = false;
      this.hs.hidden = false;
      this.pos.side = 0;
      this.place(true);
      this.loop();
    }
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.el.hidden = true;
    this.hs.hidden = true;
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
    if (off) return;
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
      const cls = 'pb-h ' + h.kind + (h.on ? ' on' : '');
      if (d.className !== cls) { d.className = cls; d.innerHTML = h.kind === 'm' ? svg('move', 18, 2.4) : ''; }
      d.style.transform = `translate(${Math.round(h.x)}px, ${Math.round(h.y)}px)`;
    });
    // Leiste: über der Vorschau, sonst darunter; nie unter dem Finger
    const dragging = !!s.dragging;
    this.el.classList.toggle('pb-drag', dragging);
    const W = window.innerWidth, H = window.innerHeight;
    const bw = this.el.offsetWidth, bh = this.el.offsetHeight;
    const top0 = 64, bottom0 = H - 86;
    const b = s.box;
    const cx = (b.x0 + b.x1) / 2;
    const above = b.y0 - 26 - bh, below = b.y1 + 30;
    const fitsAbove = above >= top0, fitsBelow = below + bh <= bottom0;
    let side = this.pos.side;
    if (first || !side || (side < 0 && !fitsAbove && fitsBelow) || (side > 0 && !fitsBelow && fitsAbove)) side = fitsAbove || !fitsBelow ? -1 : 1;
    const x = Math.max(8, Math.min(W - bw - 8, cx - bw / 2));
    const cl = (y) => Math.max(top0, Math.min(bottom0 - bh, y));
    // Hindernisse: Finger (großzügig) und die Karte der Einführung (#ob-layer .ob-card) – die Leiste weicht beiden aus
    const f = s.finger;
    const obst = [];
    if (f) obst.push({ left: f.x - 24, right: f.x + 24, top: f.y - 24, bottom: f.y + 24 });
    for (const oc of document.querySelectorAll('#ob-layer .ob-card, #ob-guide')) {
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
  }
}
