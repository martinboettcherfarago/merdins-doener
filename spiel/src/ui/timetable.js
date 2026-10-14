// Fahrplan-Streifen im U-Bahn-Fenster: je Linie ein Band mit den Stationen (echte Abstände), die Züge als Marker
// (Hinfahrt oben →, Rückfahrt unten ←; im Ring beide Richtungen). Marker zeigen die Auslastung und lassen sich mit Maus
// oder Finger ziehen – der Zug steht beim Ziehen und fährt beim Loslassen von dort weiter. Die Marker laufen live mit
// (requestAnimationFrame), ohne das Fenster neu zu zeichnen.
// Einbindung: timetableHTML(ui, line) im render, timetableClick(ui, act, el) im click, timetableAfterRender(ui) im afterRender,
// timetableBusy() hält das Fenster während des Ziehens fest.
import { LINE_COLORS, cycPos, cycLen, cycToP } from '../sim/transit.js';

const PAD = 16; // Rand links/rechts im Streifen (px), damit Marker an den Endstationen ganz sichtbar bleiben
const Y_TRACK = 56; // Mitte des Gleises im Streifen (px)
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ABBR = [['straße', 'str.'], ['platz', 'pl.'], ['allee', 'al.'], ['brücke', 'br.'], ['gasse', 'g.'], ['ufer', 'uf.'], ['damm', 'd.'], ['höhe', 'h.']];
export function shortName(n) {
  n = String(n || '');
  if (n.length <= 10) return n;
  for (const [a, b] of ABBR) if (n.endsWith(a)) { n = n.slice(0, -a.length) + b; break; }
  return n.length <= 10 ? n : n.slice(0, 8) + '.';
}
export function fmtSec(s) {
  if (!Number.isFinite(s) || s <= 0) return '–';
  if (s < 59.5) return `${Math.round(s)} s`;
  const m = Math.floor(s / 60), r = Math.round(s - m * 60);
  return r === 60 ? `${m + 1}:00 min` : `${m}:${String(r).padStart(2, '0')} min`;
}

// Zustand: ein Ziehvorgang zugleich, eine laufende Schleife
const S = { ui: null, raf: 0, drag: null };
// Während des Ziehens (oder kurz danach ohne Ereignis, max. 15 s) zeichnet das Fenster nicht neu
export const timetableBusy = () => !!(S.drag && performance.now() - S.drag.t < 15000);

export const TIMETABLE_HINT = `<div class="sec tt-why"><h3>Warum Abstand gegen Überfüllung hilft</h3><p class="hint">Fahren Züge dicht hintereinander, nimmt der erste fast alle Wartenden mit, hält dadurch länger und wird noch langsamer – die folgenden fahren halb leer hinterher. Dazwischen warten die Leute lange und die Bahnsteige laufen voll. Mit gleichen Abständen kommt regelmäßig ein Zug, jeder nimmt seinen Teil mit. Der <b>Auto-Takt</b> lässt zu dicht folgende Züge kurz an der Station warten. Im Fahrplan kannst du jeden Zug mit Maus oder Finger an eine andere Stelle der Linie ziehen.</p></div>`;

function status(info) {
  const g0 = info.groups[0];
  if (!g0) return { cls: '', txt: '', msg: '' };
  const one = info.groups.every((x) => x.n < 2);
  if (one) return { cls: '', txt: '', msg: 'Ein Zug allein: Mit einem zweiten Zug halbiert sich die Wartezeit an jeder Station.' };
  const r = info.minRatio, c = info.closest;
  if (r >= 0.6) return { cls: 'ok', txt: 'gleichmäßig', msg: info.auto ? 'Auto-Takt hält die Abstände gleich.' : 'Auto-Takt ist aus: Mit der Zeit rücken die Züge zusammen.' };
  const pair = c ? `Zug ${c.behind} und ${c.ahead}` : 'Zwei Züge';
  if (r >= 0.35) return { cls: 'warn', txt: 'etwas ungleich', msg: `${pair} fahren recht nah beieinander.${info.auto ? ' Der Auto-Takt gleicht das an den nächsten Stationen aus.' : ''}`, cta: !info.auto };
  return { cls: 'bad', txt: 'Pulk', msg: `${pair} fahren dicht hintereinander – dazwischen wird es voll.${info.auto ? ' Der Auto-Takt zieht sie auseinander.' : ''}`, cta: true };
}

export function timetableHTML(ui, line) {
  const tr = ui.g.transit;
  const L = line.length;
  const stops = line.stops.map((id) => tr.stations.get(id));
  if (stops.length < 2 || !(L > 0) || stops.some((s) => !s)) return '';
  const col = hex(LINE_COLORS[line.color]);
  const info = tr.taktInfo(line);
  const st = status(info);
  const takt = info.groups.length > 1 ? info.groups.map((x) => `${x.dir > 0 ? '↻' : '↺'} ${fmtSec(x.headSec)}`).join(' · ') : info.groups.length ? fmtSec(info.groups[0].headSec) : '–';
  const pos = (d) => `calc(${PAD}px + (100% - ${2 * PAD}px) * ${(d / L).toFixed(5)})`;
  const stHTML = (s, d, extra = '') => {
    // Name der letzten Station einer Pendellinie endet am rechten Rand
    const full = s.waiting.length > 10;
    return `<button class="tt-st${full ? ' full' : ''}${extra}" style="left:${pos(d)}" data-act="gost" data-x="${s.x}" data-y="${s.y}" data-tip="${esc(s.name)}" data-tip-desc="${s.waiting.length} wartend${full ? ' – überfüllt' : ''}" data-tip-fast="1" aria-label="${esc(s.name)}, ${s.waiting.length} wartend"><span class="tt-nm">${esc(shortName(s.name))}${full ? ` <b>${s.waiting.length}</b>` : ''}</span><i></i></button>`;
  };
  const last = stops[stops.length - 1], first = stops[0];
  const dirA = line.loop ? '↻ vorwärts →' : `→ ${esc(shortName(last.name))}`;
  const dirB = line.loop ? '← ↺ rückwärts' : `${esc(shortName(first.name))} ←`;
  // im Ring folgt nach der letzten Station wieder die erste (rechts, blass)
  const stations = stops.map((s, k) => stHTML(s, line.stopD[k], !line.loop && k === stops.length - 1 ? ' end' : '')).join('') + (line.loop ? stHTML(first, L, ' ghost') : '');
  return `<div class="tt" style="--lc:${col}">
  <div class="tt-top"><div class="tt-takt"><span class="tt-k">Takt</span> <b class="num">${info.groups.length > 1 ? takt : `alle ${takt}`}</b>${st.txt ? ` <span class="tt-state ${st.cls}">${st.txt}</span>` : ''}</div>
  <label class="tt-auto" data-tip="Automatischer Takt" data-tip-desc="Züge warten an der Station kurz, wenn sie dem vorderen Zug zu dicht folgen. So bleiben die Abstände gleich und die Bahnsteige leerer." data-tip-fast="1"><span>Auto-Takt</span><button class="switch${info.auto ? ' on' : ''}" data-act="tt-auto" data-l="${line.id}" role="switch" aria-checked="${info.auto}" aria-label="Automatischer Takt"></button></label></div>
  <div class="tt-strip${line.loop ? ' loop' : ''}" data-tt-line="${line.id}" role="group" aria-label="Fahrplan Linie ${line.id}: Züge ziehen, um sie zu verschieben">
    <div class="tt-lane a"><span>${dirA}</span></div><div class="tt-lane b"><span>${dirB}</span></div>
    <div class="tt-track"></div>${stations}
  </div>
  ${st.msg || info.groups.some((x) => x.n > 1) ? `<div class="tt-msg${st.cta ? ' warn' : ''}"><span>${st.msg}</span>${info.groups.some((x) => x.n > 1) ? `<button class="btn small${st.cta ? '' : ' ghost'}" data-act="tt-even" data-l="${line.id}">Gleichmäßig verteilen</button>` : ''}</div>` : ''}
</div>`;
}

export function timetableClick(ui, act, el) {
  const g = ui.g;
  if (act === 'tt-even') {
    const r = g.evenOutLine(+el.dataset.l);
    if (r.ok) ui.toast('Züge gleichmäßig verteilt', 'good'); else if (r.msg) ui.toast(r.msg, 'bad');
    return true;
  }
  if (act === 'tt-auto') {
    const line = g.transit.lines.find((l) => l.id === +el.dataset.l);
    if (line) g.setLineTakt(line.id, line.takt === false);
    return true;
  }
  return undefined;
}

// ---------- Live-Marker
function geom(strip) {
  const w = strip.clientWidth;
  return { w, span: Math.max(1, w - 2 * PAD) };
}

// Taktplätze (Ziehhilfe): wo ein Zug im gleichmäßigen Abstand zum ersten anderen Zug seiner Richtung stünde.
// Liefert Spurpositionen P; der gezogene Zug zählt mit, zählt aber nicht als Bezug.
function taktSlots(tr, line, dragId, dir) {
  const C = cycLen(line);
  const others = tr.trains.filter((t) => t.line === line.id && t.id !== dragId && (!line.loop || t.dir === dir));
  if (!others.length || !(C > 0)) return [];
  const n = others.length + 1, s = C / n, q0 = cycPos(others[0], line);
  const out = [];
  for (let k = 1; k < n; k++) out.push(cycToP(line, dir, (q0 + k * s) % C));
  return out;
}
const laneOf = (line, P) => (P <= line.length ? 1 : -1);
const dOf = (line, P) => (P <= line.length ? P : 2 * line.length - P);

function syncGhosts(strip, line, span) {
  const D = S.drag;
  const pool = strip._gh || (strip._gh = []);
  const slots = D && D.moved && D.lineId === line.id && D.last ? D.slots || [] : [];
  while (pool.length < slots.length) { const el = document.createElement('div'); el.className = 'tt-g'; strip.appendChild(el); pool.push(el); }
  pool.forEach((el, k) => {
    if (k >= slots.length) { if (!el.hidden) el.hidden = true; return; }
    el.hidden = false;
    const P = slots[k], up = laneOf(line, P) > 0;
    const x = PAD + span * Math.max(0, Math.min(1, dOf(line, P) / line.length));
    el.style.transform = `translate3d(${(x - 15).toFixed(1)}px, ${up ? Y_TRACK - 30 : Y_TRACK + 6}px, 0)`;
    el.classList.toggle('on', D.last.slot === k);
  });
}

// ---------- Anordnung der Marker einer Spur (ohne Überlappung)
const MW = 30;   // Markerbreite (px)
const STEP = 35; // Mindestabstand zweier Marker (Mitte zu Mitte), Pfeil bleibt sichtbar
const DMAX = 18; // so weit darf ein Marker höchstens neben seiner echten Stelle stehen
const NEAR = 12; // noch dichter folgende Züge werden gleich zu einer Gruppe gebündelt
const meanX = (ms) => ms.reduce((a, m) => a + m.x, 0) / ms.length;

// Einheiten (einzelne Züge oder Gruppen) mit Mindestabstand STEP um ihre Wunschstellen anordnen (1D, Cluster zentriert)
function spread(units, lo, hi) {
  const cl = [];
  // Mitte eines Clusters: Mittel der Wunschstellen, an den Rändern so weit nach innen, dass alle Marker sichtbar bleiben
  const center = (c) => {
    const half = ((c.us.length - 1) * STEP) / 2;
    c.c = meanX(c.us);
    if (hi - lo > 2 * half) c.c = Math.max(lo + half, Math.min(hi - half, c.c));
    return c;
  };
  for (const u of units) {
    cl.push(center({ us: [u] }));
    while (cl.length > 1) {
      const b = cl[cl.length - 1], a = cl[cl.length - 2];
      if (b.c - ((b.us.length - 1) * STEP) / 2 - (a.c + ((a.us.length - 1) * STEP) / 2) >= STEP - 1e-6) break;
      a.us.push(...b.us);
      center(a);
      cl.pop();
    }
  }
  for (const c of cl) {
    const half = ((c.us.length - 1) * STEP) / 2;
    c.disp = 0;
    c.us.forEach((u, k) => { u.px = c.c - half + k * STEP; c.disp = Math.max(c.disp, Math.abs(u.px - u.x)); });
  }
  return cl;
}

// items: [{ x, … }] (x = echte Stelle in px). Ergebnis: Einheiten { x, px, members } – px ist die Anzeigestelle.
// Dicht folgende Züge werden zu Gruppen gebündelt, sobald Ausweichen allein mehr als DMAX verschieben müsste.
export function layoutLane(items, lo, hi) {
  const xs = items.slice().sort((a, b) => a.x - b.x);
  const units = [];
  for (const it of xs) {
    const u = units[units.length - 1];
    if (u && it.x - u.members[u.members.length - 1].x < NEAR) u.members.push(it);
    else units.push({ members: [it] });
  }
  for (;;) {
    for (const u of units) u.x = meanX(u.members);
    const cl = spread(units, lo, hi);
    let worst = null;
    for (const c of cl) if (c.us.length > 1 && c.disp > DMAX && (!worst || c.disp > worst.disp)) worst = c;
    if (!worst) return units;
    // engstes Paar im schlimmsten Cluster zusammenlegen und neu anordnen
    let bi = 0, bd = Infinity;
    for (let k = 0; k < worst.us.length - 1; k++) { const d = worst.us[k + 1].x - worst.us[k].x; if (d < bd) { bd = d; bi = k; } }
    const a = worst.us[bi], b = worst.us[bi + 1];
    a.members.push(...b.members);
    units.splice(units.indexOf(b), 1);
  }
}

const andList = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} und ${a[a.length - 1]}`);

function markerEl(strip, m, t) {
  let el = m.get(t.id);
  if (!el) {
    el = document.createElement('div');
    el.className = 'tt-m';
    el.dataset.tid = t.id;
    el.tabIndex = 0;
    el.setAttribute('role', 'slider');
    el.innerHTML = '<i class="tt-f"></i><b></b>';
    strip.appendChild(el);
    m.set(t.id, el);
  }
  return el;
}

function sync(ui) {
  const g = ui.g, tr = g.transit;
  const strips = ui.el.panel.querySelectorAll('.tt-strip[data-tt-line]');
  if (!strips.length) return false;
  const geoms = [...strips].map(geom); // erst messen, dann schreiben
  const D = S.drag;
  strips.forEach((strip, si) => {
    const line = tr.lines.find((l) => l.id === +strip.dataset.ttLine);
    if (!line || !(line.length > 0)) return;
    const { span } = geoms[si];
    const L = line.length;
    const ts = tr.trains.filter((t) => t.line === line.id);
    const m = strip._tt || (strip._tt = new Map());
    const seen = new Set();
    const lanes = [[], []];
    ts.forEach((t, i) => {
      seen.add(t.id);
      const cap = tr.trainCapacity(t);
      const it = { t, num: i + 1, el: markerEl(strip, m, t), x: PAD + span * Math.max(0, Math.min(1, t.d / L)), up: t.dir > 0, cap, load: cap ? Math.min(1, t.pax.length / cap) : 0 };
      // der gezogene Zug steht für sich (genau an seiner Stelle, obenauf)
      if (D && D.moved && D.tid === t.id) { it.px = it.x; place(it, [it], true); return; }
      lanes[it.up ? 0 : 1].push(it);
    });
    for (const items of lanes) {
      for (const u of layoutLane(items, PAD, PAD + span)) {
        const ms = u.members;
        // Gruppe: der vorderste Zug (in Fahrtrichtung) trägt den Marker, die anderen ruhen
        const lead = ms.reduce((a, b) => (a.up ? (b.x > a.x ? b : a) : (b.x < a.x ? b : a)));
        lead.px = u.px;
        lead.gx = u.x;
        place(lead, ms, false);
        for (const o of ms) if (o !== lead && !o.el.hidden) { o.el.hidden = true; o.el.tabIndex = -1; }
      }
    }
    for (const [id, el] of m) if (!seen.has(id)) { el.remove(); m.delete(id); }
    syncGhosts(strip, line, span);
  });
  return true;

  // Marker eines Zuges (bzw. einer Gruppe ms) an die Anzeigestelle setzen und beschriften (nur bei Änderung)
  function place(it, ms, dragging) {
    const { t, el, up } = it;
    const n = ms.length;
    if (el.hidden) { el.hidden = false; el.tabIndex = 0; }
    const y = up ? Y_TRACK - 30 : Y_TRACK + 6;
    const key = `${it.px.toFixed(1)}|${y}`;
    if (el._k !== key) { el._k = key; el.style.transform = `translate3d(${(it.px - MW / 2).toFixed(1)}px, ${y}px, 0)`; }
    // Strich zur echten Stelle, wenn der Marker ausweicht
    const dx = Math.round(it.px - (n > 1 ? it.gx : it.x));
    if (el._dx !== dx) { el._dx = dx; el.style.setProperty('--dx', dx + 'px'); }
    const load = Math.max(...ms.map((q) => q.load));
    const lv = load >= 0.9 ? 'full' : load >= 0.6 ? 'busy' : '';
    const hold = ms.some((q) => (q.t.hold || 0) > 0);
    const cls = `tt-m${up ? ' a' : ' b'}${lv ? ' ' + lv : ''}${hold ? ' hold' : ''}${t.state === 'dwell' ? ' at' : ''}${n > 1 ? ' grp' : ''}${Math.abs(dx) > 2 ? ' off' : ''}${dragging ? ' drag' : ''}`;
    if (el.className !== cls) el.className = cls;
    const f = Math.round(load * 100);
    if (el._f !== f) { el._f = f; el.style.setProperty('--f', f + '%'); }
    const label = n > 1 ? `${n}×` : String(it.num);
    if (el._n !== label) { el._n = label; el.lastChild.textContent = label; }
    // Beschriftung (Tooltip, Bildschirmleser) nur bei Änderung
    let tip, desc;
    if (n > 1) {
      const nums = ms.map((q) => q.num).sort((a, b) => a - b);
      const pax = ms.reduce((a, q) => a + q.t.pax.length, 0), cap = ms.reduce((a, q) => a + q.cap, 0);
      tip = `${n} Züge im Pulk`;
      desc = `Zug ${andList(nums)} fahren dicht hintereinander · zusammen ${pax} von ${cap} Plätzen besetzt. Ziehen holt Zug ${it.num} heraus – gestrichelte Plätze zeigen den gleichmäßigen Takt.`;
    } else {
      const line = tr.lines.find((l) => l.id === t.line);
      const where = t.state === 'dwell' ? `hält in ${(tr.stations.get(line.stops[t.cur]) || {}).name || '–'}` : `fährt nach ${(tr.stations.get(line.stops[t.to]) || {}).name || '–'}`;
      tip = `Zug ${it.num}`;
      desc = `${t.pax.length} von ${it.cap} Plätzen besetzt · ${where}${(t.hold || 0) > 0 ? ' · wartet kurz auf den Takt' : ''}. Ziehen, um den Zug zu verschieben – gestrichelte Plätze zeigen den gleichmäßigen Takt.`;
    }
    if (el._d !== desc || el.dataset.tip !== tip) {
      el._d = desc;
      el.dataset.tip = tip;
      el.dataset.tipDesc = desc;
      el.setAttribute('aria-label', tip);
      el.setAttribute('aria-valuetext', desc);
    }
  }
}

function loop() {
  S.raf = 0;
  const ui = S.ui;
  if (!ui || ui.panel !== 'transit' || ui.el.panel.hidden) return;
  if (!sync(ui)) return;
  S.raf = requestAnimationFrame(loop);
}

// Zeigerposition → Spurposition P (0 … L Hinfahrt oben, L … 2L Rückfahrt unten), Einrasten an Stationen
function pointerP(strip, line, cx, cy) {
  const r = strip.getBoundingClientRect();
  const span = Math.max(1, r.width - 2 * PAD);
  const frac = Math.max(0, Math.min(1, (cx - r.left - PAD) / span));
  const d = frac * line.length;
  const dir = cy - r.top < Y_TRACK ? 1 : -1;
  return { P: dir > 0 ? d : 2 * line.length - d, dir, snap: (10 / span) * line.length };
}

function bind(ui, strip) {
  if (strip._ttBound) return;
  strip._ttBound = true;
  strip.addEventListener('pointerdown', (e) => {
    const mk = e.target.closest('.tt-m');
    if (!mk || e.button > 0) return;
    e.preventDefault();
    const tid = +mk.dataset.tid;
    S.drag = { tid, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, t: performance.now(), tol: e.pointerType === 'mouse' ? 4 : 9, strip, lineId: +strip.dataset.ttLine, last: null };
    try { mk.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
    const move = (ev) => {
      const D = S.drag;
      if (!D || ev.pointerId !== D.id) return;
      D.t = performance.now();
      if (!D.moved && Math.hypot(ev.clientX - D.x, ev.clientY - D.y) < D.tol) return;
      ev.preventDefault();
      const line = ui.g.transit.lines.find((l) => l.id === D.lineId);
      if (!line) return;
      // Streifen kann neu gezeichnet worden sein: aktuellen suchen
      const st = D.strip.isConnected ? D.strip : ui.el.panel.querySelector(`.tt-strip[data-tt-line="${D.lineId}"]`);
      if (!st) return;
      D.strip = st;
      D.moved = true;
      D.last = pointerP(st, line, ev.clientX, ev.clientY);
      // Taktplätze: nahe dran → genau dorthin (vor dem Einrasten an Stationen)
      D.slots = taktSlots(ui.g.transit, line, D.tid, D.last.dir);
      D.last.slot = -1;
      let best = D.last.snap * 1.3;
      D.slots.forEach((P, k) => {
        if (laneOf(line, P) !== D.last.dir) return;
        const dd = Math.abs(dOf(line, P) - dOf(line, D.last.P));
        if (dd <= best) { best = dd; D.last.slot = k; }
      });
      if (D.last.slot >= 0) { D.last.P = D.slots[D.last.slot]; D.last.snap = 1e-3; }
      ui.g.placeTrain(D.tid, D.last.P, { hold: true, snap: D.last.snap, dir: D.last.dir });
      if (!S.raf) S.raf = requestAnimationFrame(loop);
    };
    const end = (ev) => {
      const D = S.drag;
      if (!D || (ev && ev.pointerId !== D.id)) return;
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', end, true);
      window.removeEventListener('pointercancel', end, true);
      S.drag = null;
      ui.panelBusy = false;
      if (D.moved && D.last) {
        // loslassen: Zug fährt von hier weiter (bzw. hält an der Station, auf die er gezogen wurde)
        ui.g.placeTrain(D.tid, D.last.P, { snap: D.last.snap, dir: D.last.dir });
        if (ui.app && ui.app.audio) ui.app.audio.play('click');
      } else if (ev && ev.type === 'pointerup') {
        // kurzer Klick: Kamera zum Zug
        const t = ui.g.transit.trains.find((x) => x.id === D.tid);
        if (t) ui.focusTile(Math.floor(t.x + ui.g.W / 2), Math.floor(t.z + ui.g.H / 2), 22);
      }
      sync(ui);
    };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', end, true);
    window.addEventListener('pointercancel', end, true);
  });
  // Tastatur: ←/→ verschiebt den Zug um etwa ein Feld, ↑/↓ wechselt die Fahrtrichtung
  strip.addEventListener('keydown', (e) => {
    const mk = e.target.closest('.tt-m');
    if (!mk || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const g = ui.g, t = g.transit.trains.find((x) => x.id === +mk.dataset.tid);
    const line = t && g.transit.lines.find((l) => l.id === t.line);
    if (!line) return;
    let d = t.d, dir = t.dir;
    if (e.key === 'ArrowLeft') d -= e.shiftKey ? 5 : 1;
    if (e.key === 'ArrowRight') d += e.shiftKey ? 5 : 1;
    if (e.key === 'ArrowUp') dir = 1;
    if (e.key === 'ArrowDown') dir = -1;
    d = Math.max(0, Math.min(line.length, d));
    g.placeTrain(t.id, dir > 0 ? d : 2 * line.length - d, { snap: 0.5, dir });
    sync(ui);
    const again = ui.el.panel.querySelector(`.tt-m[data-tid="${t.id}"]`);
    if (again) again.focus();
  });
}

// Stationsnamen, die sich überlappen würden, ausblenden: erst Anfang und Ende, dann überfüllte Stationen, dann der Rest
// von links nach rechts – ein Name erscheint nur, wenn er mit 4 px Luft neben alle schon gezeigten passt
function layoutNames(strip) {
  const names = [...strip.querySelectorAll('.tt-st:not(.ghost) .tt-nm')];
  if (!names.length) return;
  const boxes = names.map((n) => { n.classList.remove('hide'); return n.getBoundingClientRect(); });
  const r = strip.getBoundingClientRect();
  const last = names.length - 1;
  const order = names.map((n, k) => k).sort((p, q) => rank(p) - rank(q) || p - q);
  function rank(k) { return k === 0 || k === last ? 0 : names[k].parentNode.classList.contains('full') ? 1 : 2; }
  const kept = [];
  const keep = new Array(names.length).fill(false);
  for (const k of order) {
    const bx = boxes[k];
    if (rank(k) > 0 && (bx.left < r.left + 1 || bx.right > r.right - 1)) continue;
    if (kept.some((o) => bx.left < o.right + 4 && bx.right > o.left - 4)) continue;
    keep[k] = true;
    kept.push(bx);
  }
  names.forEach((n, k) => { if (!keep[k]) n.classList.add('hide'); });
}

export function timetableAfterRender(ui) {
  injectStyle();
  S.ui = ui;
  const strips = ui.el.panel.querySelectorAll('.tt-strip[data-tt-line]');
  if (!strips.length) return;
  for (const s of strips) { bind(ui, s); layoutNames(s); }
  sync(ui);
  if (!S.raf) S.raf = requestAnimationFrame(loop);
}

// ---------- Gestaltung (eigene Klassen mit Präfix tt-)
function injectStyle() {
  if (typeof document === 'undefined' || document.getElementById('tt-style')) return;
  const el = document.createElement('style');
  el.id = 'tt-style';
  el.textContent = `
.tt { margin: 10px 0 8px; }
.tt-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; min-height: 30px; }
.tt-takt { font-size: 13px; color: var(--ink-2); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; min-width: 0; }
.tt-takt .tt-k { font-family: var(--f-display); font-weight: 600; color: var(--accent-ink); }
.tt-takt b { color: var(--accent-ink); font-size: 13.5px; }
.tt-state { font-family: var(--f-display); font-weight: 600; font-size: 12px; padding: 1px 9px; border-radius: var(--r-pill); background: var(--accent-soft); color: var(--accent); line-height: 1.5; white-space: nowrap; }
.tt-state.ok { background: color-mix(in srgb, var(--good) 14%, #fff); color: var(--good); }
.tt-state.warn { background: color-mix(in srgb, var(--cta-2) 16%, #fff); color: #a35a00; }
.tt-state.bad { background: color-mix(in srgb, var(--bad) 14%, #fff); color: var(--bad); }
.tt-auto { display: inline-flex; align-items: center; gap: 7px; font-family: var(--f-display); font-weight: 600; font-size: 12.5px; color: var(--ink-2); cursor: pointer; flex: none; }
.tt-auto .switch { margin-top: 0; }
.tt-strip { position: relative; height: 92px; border-radius: var(--r-md); background: linear-gradient(180deg, #fff 0%, #fbf8ff 100%); box-shadow: inset 0 0 0 1px rgba(91, 47, 179, 0.1), inset 0 1px 2px rgba(42, 20, 99, 0.06); overflow: hidden; user-select: none; -webkit-user-select: none; touch-action: pan-y; }
.tt-lane { position: absolute; left: 6px; right: 6px; height: 26px; border-radius: 9px; background: color-mix(in srgb, var(--lc) 6%, transparent); display: flex; align-items: center; pointer-events: none; }
.tt-lane.a { top: ${Y_TRACK - 31}px; justify-content: flex-end; }
.tt-lane.b { top: ${Y_TRACK + 5}px; justify-content: flex-start; }
.tt-lane span { font-size: 10.5px; font-weight: 800; color: color-mix(in srgb, var(--lc) 60%, var(--ink-3)); opacity: 0.75; padding: 0 6px; white-space: nowrap; }
.tt-track { position: absolute; left: ${PAD}px; right: ${PAD}px; top: ${Y_TRACK - 2}px; height: 4px; border-radius: 2px; background: var(--lc); pointer-events: none; }
.tt-strip.loop .tt-track { background: repeating-linear-gradient(90deg, var(--lc) 0 100%); box-shadow: 0 0 0 1px color-mix(in srgb, var(--lc) 20%, transparent); }
.tt-st { position: absolute; top: 0; width: 0; height: ${Y_TRACK + 7}px; padding: 0; background: none; border: 0; box-shadow: none; z-index: 1; }
.tt-st i { position: absolute; left: -6px; top: ${Y_TRACK - 6}px; width: 12px; height: 12px; border-radius: 50%; background: #fff; border: 3px solid var(--lc); box-sizing: border-box; cursor: pointer; }
.tt-st .tt-nm { position: absolute; top: 3px; left: 0; transform: translateX(-50%); font-size: 10.5px; font-weight: 800; color: var(--accent-ink); white-space: nowrap; line-height: 1.2; cursor: pointer; padding: 1px 3px; border-radius: 5px; }
.tt-st:first-of-type .tt-nm { transform: translateX(-${PAD - 3}px); }
.tt-st.end .tt-nm { transform: translateX(calc(-100% + ${PAD - 3}px)); }
.tt-st .tt-nm.hide { visibility: hidden; }
.tt-st.full i { border-color: var(--bad); background: #fde3df; box-shadow: 0 0 0 3px color-mix(in srgb, var(--bad) 22%, transparent); }
.tt-st.full .tt-nm { color: var(--bad); }
.tt-st.full .tt-nm b { font-family: var(--f-num); }
.tt-st.ghost { opacity: 0.45; }
.tt-st.ghost .tt-nm { display: none; }
@media (hover: hover) and (pointer: fine) { .tt-st:hover .tt-nm { background: var(--accent-soft); } }
.tt-m { position: absolute; left: 0; top: 0; width: 30px; height: 24px; border-radius: 8px; z-index: 3; cursor: grab; touch-action: none;
  --stk: 0 0 0 0 transparent;
  background: linear-gradient(to top, var(--fc, var(--lc)) var(--f, 0%), #fff var(--f, 0%)); box-shadow: inset 0 0 0 2.5px var(--lc), 0 2px 4px rgba(42, 20, 99, 0.22), 0 0 0 1.5px #fff, var(--stk);
  display: grid; place-items: center; transition: box-shadow 0.15s, filter 0.15s; will-change: transform; }
.tt-m::before { content: ''; position: absolute; inset: -10px -1px; }
.tt-m::after { content: ''; position: absolute; top: 7px; width: 0; height: 0; border: 5px solid transparent; }
.tt-m.a::after { right: -9px; border-left-color: var(--lc); }
.tt-m.b::after { left: -9px; border-right-color: var(--lc); }
.tt-m b { position: relative; font-family: var(--f-num); font-weight: 800; font-size: 12.5px; color: var(--accent-ink); text-shadow: 0 0 2px #fff, 0 0 3px #fff; line-height: 1; }
/* Strich zur echten Stelle, wenn der Marker einem Nachbarn ausweicht */
.tt-m .tt-f { display: none; position: absolute; left: calc(50% - 1px - var(--dx, 0px)); width: 2px; height: 7px; border-radius: 1px; background: var(--lc); pointer-events: none; }
.tt-m.a .tt-f { top: 100%; }
.tt-m.b .tt-f { bottom: 100%; }
.tt-m.off .tt-f { display: block; }
/* Gruppe dicht folgender Züge: Stapel aus Karten, Zahl = Anzahl */
.tt-m.grp { --stk: 4px -4px 0 0 #fff, 4px -4px 0 2px var(--lc); }
.tt-m.grp.b { --stk: 4px 4px 0 0 #fff, 4px 4px 0 2px var(--lc); }
.tt-m.grp b { font-size: 12px; letter-spacing: -0.02em; }
.tt-m.busy { --fc: var(--cta-2); }
.tt-m.full { --fc: var(--bad); box-shadow: inset 0 0 0 2.5px var(--bad), 0 2px 5px rgba(160, 20, 30, 0.35), 0 0 0 1.5px #fff, var(--stk); }
.tt-m.full b { color: #fff; text-shadow: 0 1px 1px rgba(80, 0, 10, 0.5); }
.tt-m.hold { box-shadow: inset 0 0 0 2.5px var(--lc), 0 0 0 1.5px #fff, 0 0 0 4px color-mix(in srgb, var(--cta-2) 70%, transparent), var(--stk); animation: tt-hold 1.1s ease-in-out infinite; }
@keyframes tt-hold { 50% { box-shadow: inset 0 0 0 2.5px var(--lc), 0 0 0 1.5px #fff, 0 0 0 6px color-mix(in srgb, var(--cta-2) 25%, transparent), var(--stk); } }
.tt-m.drag { cursor: grabbing; z-index: 5; filter: drop-shadow(0 6px 8px rgba(42, 20, 99, 0.35)); animation: none; }
.tt-g { position: absolute; left: 0; top: 0; width: 30px; height: 24px; border-radius: 8px; box-sizing: border-box; border: 2px dashed var(--lc); opacity: 0.6; z-index: 2; pointer-events: none; background: color-mix(in srgb, var(--lc) 8%, transparent); }
.tt-g.on { opacity: 1; border-style: solid; background: color-mix(in srgb, var(--lc) 20%, transparent); }
.tt-m:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.tt-m[hidden], .tt-g[hidden] { display: none; }
.tt-msg { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; font-size: 12px; color: var(--ink-3); line-height: 1.35; flex-wrap: wrap; }
.tt-msg span { flex: 1 1 180px; min-width: 0; }
.tt-msg.warn span { color: #a35a00; font-weight: 700; }
.tt-msg .btn { flex: none; }
@media (prefers-reduced-motion: reduce) { .tt-m.hold { animation: none; } }
`;
  document.head.appendChild(el);
}
