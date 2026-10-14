// U-Bahn-Linienentwurf (BAHNPLAN): Linie zeichnen und Linie bearbeiten mit derselben Mechanik wie beim Zonen-Planen –
// Vorschau, Griffe an beiden Enden, Kosten, ✓ Bauen / ✕ Abbrechen. Gebaut wird erst mit ✓ (game.buildLinePlan).
//
// Bedienung (Finger und Maus gleich; input.js leitet die Gesten weiter, Ziehen auf freier Karte schwenkt die Kamera):
//   Tippen nahe einer Station rastet auf sie ein (Fangradius in Bildschirm-Pixeln). Sonst: neue Station geplant (nur
//   Vorschau). Gerade hinzugefügte Stationen nimmt ein zweiter Tipp wieder weg (oder ↶).
//   Griff am Linienende ziehen: über Stationen hinweg verlängern, zurück zur vorletzten Station kürzt die Linie;
//   loslassen auf freiem Feld plant dort eine neue Station, auf der anderen Endstation schließt es den Ring.
//   Bearbeiten: Station der Linie antippen → kleines Menü (Entfernen; Ring schließen/öffnen). Entfernte Stationen ohne
//   andere Linie werden beim Bauen abgerissen; gekürzte Enden bleiben als Stationen stehen.
//
// Schnittstelle für input.js: tap(x, y), dragStart(end), dragMove(x, y), dragEnd(x, y), handles(), screen(), info(),
// undo(), toggleRing(), popAction(a), commit(), hoverAt(x, y) – x/y sind Bildschirmkoordinaten (clientX/Y).
import { Vector2, Vector3, Plane, Raycaster } from 'three';
import { TRANSIT } from '../config.js';
import { fmtMoney } from '../util.js';
import { LINE_COLORS, LINE_COLOR_NAMES } from '../sim/transit.js';

const SNAP = { touch: 44, mouse: 26 }; // Fangradius (px) beim Tippen und Loslassen
const PASS = { touch: 24, mouse: 15 }; // beim Ziehen: Station unter dem Finger wird mitgenommen bzw. zurückgenommen
const _v = new Vector3();
const _p = new Vector3();
const _n = new Vector2();
const _ray = new Raycaster();
const _plane = new Plane(new Vector3(0, 1, 0), 0);
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const BAD = '#e5484d';

export class LineDraft {
  constructor(input, lineId = null) {
    this.inp = input;
    this.g = input.g;
    const L = lineId ? this.g.transit.lines.find((l) => l.id === lineId) : null;
    this.line = L ? L.id : null;
    this.stops = L ? [...L.stops] : []; // Stations-Id (Zahl) oder geplante neue Station {x, y}
    this.loop = L ? !!L.loop : false;
    this.orig = new Set(L ? L.stops : []);
    this.removed = new Set(); // ausdrücklich entfernte Stationen (Abriss beim Bauen, falls ohne Linie)
    this.fresh = new Set(); // in diesem Entwurf hinzugefügt (Schlüssel) – ein Tipp nimmt sie wieder weg
    this.hist = [];
    this.color = L ? L.color : input.nextLineColor();
    this.hover = null;
    this.drag = null;
    this.pop = null;
    this.flash = null;
  }

  // ---------- Grundlagen
  get valid() { return !this.line || this.g.transit.lines.some((l) => l.id === this.line); }
  lineObj() { return this.line ? this.g.transit.lines.find((l) => l.id === this.line) : null; }
  touch() { return this.inp.lastType !== 'mouse'; }
  snapR() { return this.touch() ? SNAP.touch : SNAP.mouse; }
  passR() { return this.touch() ? PASS.touch : PASS.mouse; }
  key(r) { return typeof r === 'number' ? 'i' + r : 'p' + (r.y * this.g.W + r.x); }
  pos(r) { return typeof r === 'number' ? this.g.transit.stations.get(r) || null : r; }
  isNew(r) { return typeof r !== 'number'; }
  n() { return this.stops.length; }

  // Zeichenebene: in der Untergrund-Ansicht die Tunnelebene der Linie, sonst das Gelände
  depth() {
    const ug = this.inp.e.underground;
    try { return ug && ug.planDepth ? ug.planDepth(this.line) : 0; } catch (e) { return 0; }
  }
  // Feldkoordinaten (tx, ty, Feldmitte = +0,5) → Bildschirm
  proj(tx, ty) {
    const cam = this.inp.e.camera, rc = this.inp.e.canvas.getBoundingClientRect(), g = this.g;
    _v.set(tx - g.W / 2, this._y || 0, ty - g.H / 2).project(cam);
    return { x: rc.left + ((_v.x + 1) / 2) * rc.width, y: rc.top + ((1 - _v.y) / 2) * rc.height, z: _v.z };
  }
  // Bildschirm → Feld auf der Zeichenebene
  pick(sx, sy) {
    const y = this.depth();
    if (!y) return this.inp.e.pickTile(sx, sy);
    const cam = this.inp.e.camera, rc = this.inp.e.canvas.getBoundingClientRect(), g = this.g;
    _n.set(((sx - rc.left) / rc.width) * 2 - 1, -((sy - rc.top) / rc.height) * 2 + 1);
    _ray.setFromCamera(_n, cam);
    _plane.constant = -y;
    if (!_ray.ray.intersectPlane(_plane, _p)) return null;
    const x = Math.floor(_p.x + g.W / 2), yy = Math.floor(_p.z + g.H / 2);
    return x < 0 || yy < 0 || x >= g.W || yy >= g.H ? { x, y: yy, i: -1 } : { x, y: yy, i: yy * g.W + x };
  }
  scr(r) { const p = this.pos(r); return p ? this.proj(p.x + 0.5, p.y + 0.5) : null; }

  // Gelöschte Stationen aus dem Entwurf nehmen (die Simulation läuft weiter)
  tidy() {
    this._y = this.depth();
    const T = this.g.transit;
    const before = this.stops.length;
    this.stops = this.stops.filter((r) => typeof r !== 'number' || T.stations.has(r));
    if (this.stops.length < 3) this.loop = false;
    if (this.pop && this.stops.length !== before) this.pop = null;
  }

  // Nächste Station (Entwurf oder Karte) im Umkreis R px um (sx, sy)
  hit(sx, sy, R) {
    let best = null;
    const consider = (r, k) => {
      const p = this.scr(r);
      if (!p || p.z > 1) return;
      const d = Math.hypot(p.x - sx, p.y - sy);
      if (d <= R && (!best || d < best.d - 0.5 || (Math.abs(d - best.d) <= 0.5 && k >= 0 && best.k < 0))) best = { r, k, d, x: p.x, y: p.y };
    };
    this.stops.forEach((r, k) => consider(r, k));
    const inDraft = new Set(this.stops.filter((r) => typeof r === 'number'));
    for (const st of this.g.transit.stations.values()) if (!inDraft.has(st.id)) consider(st.id, -1);
    return best;
  }

  save() {
    this.hist.push({ stops: [...this.stops], loop: this.loop, removed: new Set(this.removed), fresh: new Set(this.fresh) });
    if (this.hist.length > 60) this.hist.shift();
  }
  undo() {
    const s = this.hist.pop();
    if (!s) return false;
    Object.assign(this, { stops: s.stops, loop: s.loop, removed: s.removed, fresh: s.fresh });
    this.pop = null;
    this.tidy();
    return true;
  }
  add(r, atStart) {
    if (atStart) this.stops.unshift(r); else this.stops.push(r);
    this.fresh.add(this.key(r));
    if (typeof r === 'number') this.removed.delete(r);
  }
  removeAt(k, mark = true) {
    const r = this.stops[k];
    if (r === undefined) return;
    this.stops.splice(k, 1);
    if (mark && typeof r === 'number' && this.orig.has(r)) this.removed.add(r);
    this.fresh.delete(this.key(r));
    if (this.stops.length < 3) this.loop = false;
  }
  // Ende, an dem ein neues Ziel (Feld x, y) angehängt wird: neue Linie hinten, beim Bearbeiten das nähere Ende
  endFor(x, y) {
    const n = this.n();
    if (!this.line || n < 2) return 'e';
    const a = this.pos(this.stops[0]), b = this.pos(this.stops[n - 1]);
    if (!a || !b) return 'e';
    return Math.hypot(a.x - x, a.y - y) < Math.hypot(b.x - x, b.y - y) ? 's' : 'e';
  }
  minStops() { return this.line ? 2 : 1; }
  planned(x, y) { return this.stops.some((r) => typeof r !== 'number' && r.x === x && r.y === y); }
  canPlan(x, y) {
    const err = this.g.transit.canPlaceStation(x, y);
    if (err) return err;
    if (this.planned(x, y)) return 'Hier ist schon eine Station geplant';
    return null;
  }
  say(msg, mood = 'bad') { this.inp.ui.toast(msg, mood); if (mood === 'bad') this.inp.audio.play('error'); }

  // ---------- Tippen
  tap(sx, sy) {
    this.tidy();
    const n = this.n();
    const h = this.hit(sx, sy, this.snapR());
    if (this.pop) {
      // Menü offen: anderer Halt der Linie → dessen Menü, sonst nur schließen
      const was = this.pop;
      this.pop = null;
      if (h && h.k >= 0 && h.k !== was.k && !this.fresh.has(this.key(h.r))) { this.pop = { k: h.k, r: h.r }; return 'pop'; }
      return 'close';
    }
    if (h && h.k >= 0) {
      if (!this.line) {
        if (h.k === 0 && n >= 3 && !this.loop) { this.save(); this.loop = true; return 'ring'; }
        if (h.k === 0 && this.loop) { this.save(); this.loop = false; return 'ring'; }
        this.save(); this.removeAt(h.k); return 'remove';
      }
      if (this.fresh.has(this.key(h.r))) { this.save(); this.removeAt(h.k); return 'remove'; }
      this.pop = { k: h.k, r: h.r };
      return 'pop';
    }
    if (this.loop) { this.say('Ring: erst öffnen ⟲'); return 'blocked'; }
    if (h) {
      const st = this.pos(h.r);
      this.save();
      this.add(h.r, this.endFor(st.x, st.y) === 's');
      return 'add';
    }
    const t = this.pick(sx, sy);
    if (!t || t.i < 0) return null;
    const err = this.canPlan(t.x, t.y);
    if (err) { this.say(err); return 'blocked'; }
    this.save();
    this.add({ x: t.x, y: t.y }, this.endFor(t.x, t.y) === 's');
    return 'new';
  }

  // ---------- Griffe ziehen
  handles() {
    const n = this.n();
    if (!n || this.loop) return [];
    const out = [];
    const d = this.drag;
    const at = (k) => this.scr(this.stops[k]);
    const color = hex(LINE_COLORS[this.color] || 0xe8543f);
    if (n >= 2) { const p = at(0); if (p) out.push({ x: p.x, y: p.y, kind: 's', on: !!(d && d.end === 's'), color }); }
    const p = at(n - 1);
    if (p) out.push({ x: p.x, y: p.y, kind: 'e', on: !!(d && d.end === 'e'), color });
    // Beim Ziehen sitzt der gezogene Griff unter dem Finger
    if (d && d.x != null) for (const h of out) if (h.kind === d.end) { h.x = d.x; h.y = d.y; }
    return out;
  }
  dragStart(end) {
    this.tidy();
    this.pop = null;
    this.save();
    const n = this.n();
    const r = end === 's' ? this.stops[0] : this.stops[n - 1];
    this.drag = { end, x: null, y: null, last: r !== undefined ? this.key(r) : null, retracted: false, snap: null, mark: this.hist.length };
  }
  dragMove(sx, sy) {
    const d = this.drag;
    if (!d) return;
    d.x = sx; d.y = sy;
    const n = this.n();
    const h = this.hit(sx, sy, this.passR());
    d.snap = this.hit(sx, sy, this.snapR());
    const hk = h ? this.key(h.r) : null;
    if (!hk) { d.last = null; return; }
    if (hk === d.last) return;
    d.last = hk;
    if (h.k >= 0) {
      // zurück auf die vorletzte Station: Ende abnehmen (Linie kürzen)
      const nb = d.end === 's' ? 1 : n - 2;
      if (n > this.minStops() && h.k === nb) { this.removeAt(d.end === 's' ? 0 : n - 1, false); d.retracted = true; this.inp.audio.play('click'); }
    } else if (!this.loop) {
      this.add(h.r, d.end === 's');
      this.inp.audio.play('click');
    }
  }
  dragEnd(sx, sy) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    const n = this.n();
    const endK = d.end === 's' ? 0 : n - 1;
    const h = this.hit(sx, sy, this.snapR());
    let changed = false;
    if (h) {
      const other = d.end === 's' ? n - 1 : 0;
      if (h.k >= 0) {
        if (h.k === other && h.k !== endK && n >= 3 && !this.loop) { this.loop = true; changed = true; }
      } else if (!this.loop) { this.add(h.r, d.end === 's'); changed = true; }
    } else if (!d.retracted && !this.loop && n) {
      const t = this.pick(sx, sy);
      const ep = this.pos(this.stops[endK]);
      if (t && t.i >= 0 && ep && Math.max(Math.abs(t.x - ep.x), Math.abs(t.y - ep.y)) >= 2) {
        const err = this.canPlan(t.x, t.y);
        if (err) this.say(err);
        else { this.add({ x: t.x, y: t.y }, d.end === 's'); changed = true; }
      }
    }
    // Nichts geändert: Rückgängig-Schritt dieser Geste verwerfen
    const top = this.hist[d.mark - 1];
    if (!changed && top && top.loop === this.loop && top.stops.length === this.stops.length && top.stops.every((r, k) => this.key(r) === this.key(this.stops[k]))) this.hist.length = d.mark - 1;
  }
  hoverAt(x, y) { this.hover = x == null ? null : { x, y }; }

  // ---------- Menü an einer Station (Bearbeiten)
  popItems() {
    const p = this.pop;
    if (!p) return [];
    const n = this.n(), k = p.k, r = this.stops[k];
    if (r === undefined) return [];
    const items = [];
    const T = this.g.transit;
    const others = typeof r === 'number' && T.lines.some((l) => l.id !== this.line && l.stops.includes(r));
    if (n > this.minStops()) items.push({ a: 'rm', label: 'Entfernen', icon: others || this.isNew(r) ? 'minus' : 'trash' });
    if (!this.loop && n >= 3 && (k === 0 || k === n - 1)) items.push({ a: 'ring', label: 'Ring', icon: 'ring' });
    if (this.loop) items.push({ a: 'open', label: 'Öffnen', icon: 'open' });
    return items;
  }
  popAction(a) {
    const p = this.pop;
    this.pop = null;
    if (!p || this.stops[p.k] === undefined) return false;
    const n = this.n();
    if (a === 'rm') {
      if (n <= this.minStops()) { this.say('Mindestens 2 Stationen'); return false; }
      this.save(); this.removeAt(p.k); return true;
    }
    if (a === 'ring' && !this.loop && n >= 3) { this.save(); this.loop = true; return true; }
    if (a === 'open' && this.loop) {
      // Ring an dieser Station öffnen: Sie wird Anfang der Linie, der Abschnitt davor entfällt
      this.save();
      this.stops = [...this.stops.slice(p.k), ...this.stops.slice(0, p.k)];
      this.loop = false;
      return true;
    }
    return false;
  }
  toggleRing() {
    if (this.n() < 3) return false;
    this.save();
    this.loop = !this.loop;
    this.pop = null;
    return true;
  }

  // ---------- Planung, Leiste, Bauen
  plan() { return this.g.planLine(this.line, this.stops, this.loop); }
  name() { return `Linie ${LINE_COLOR_NAMES[this.color] || ''}`.trim(); }
  info() {
    this.tidy();
    const n = this.n(), pl = this.plan();
    const s = (k) => `${k} ${k === 1 ? 'Station' : 'Stationen'}`;
    let sub;
    if (!this.line) sub = !n ? 'Station antippen' : n === 1 ? 'Nächste Station antippen · Griff ziehen' : `${s(n)}${pl.newSt ? ` · ${pl.newSt} neu` : ''}${this.loop ? ' · Ring' : ''}`;
    else if (!pl.changed) sub = this.loop ? 'Station antippen' : 'Enden ziehen · Station antippen';
    else sub = [`${s(n)}`, pl.add ? `+${pl.add}` : '', pl.rem ? `−${pl.rem}` : '', this.loop !== !!(this.lineObj() || {}).loop ? (this.loop ? 'Ring' : 'offen') : ''].filter(Boolean).join(' · ');
    const quiet = pl.reason === 'Keine Änderung' || (pl.reason === 'Mindestens 2 Stationen' && n < 2);
    return {
      title: this.name() || (this.line ? 'Linie' : 'Neue Linie'), sub, ok: pl.ok, reason: quiet ? '' : pl.reason,
      okLabel: 'Bauen', price: pl.cost > 0 && (this.line ? pl.changed : n >= 2) ? fmtMoney(pl.cost) : '', undo: this.hist.length > 0,
      ring: n >= 3 ? (this.loop ? 'open' : 'close') : null,
    };
  }
  commit() {
    this.tidy();
    return this.g.buildLinePlan(this.line, this.stops, this.loop, [...this.removed]);
  }

  // ---------- Vorschau (Bildschirm): Linienzug, Stationen, Gummiband, Fanghilfe
  octi(seq, loop, par) {
    const pts = [];
    const n = seq.length;
    const segs = loop ? n : n - 1;
    if (n) pts.push([seq[0].x + 0.5, seq[0].y + 0.5]);
    for (let k = 0; k < segs; k++) {
      const A = seq[k], B = seq[(k + 1) % n];
      const ax = A.x + 0.5, ay = A.y + 0.5, bx = B.x + 0.5, by = B.y + 0.5;
      const dx = bx - ax, dy = by - ay, d = Math.min(Math.abs(dx), Math.abs(dy));
      if (d > 0 && (d !== Math.abs(dx) || d !== Math.abs(dy))) {
        if ((k + par) % 2 === 0) pts.push([ax + Math.sign(dx) * d, ay + Math.sign(dy) * d]);
        else pts.push([bx - Math.sign(dx) * d, by - Math.sign(dy) * d]);
      }
      pts.push([bx, by]);
    }
    return pts;
  }
  parity() {
    const L = this.lineObj();
    if (!L) return 0;
    for (let k = 0; k < this.stops.length; k++) {
      const o = L.stops.indexOf(this.stops[k]);
      if (o >= 0) return ((((L.par || 0) + k - o) % 2) + 2) % 2;
    }
    return L.par || 0;
  }
  screen() {
    this.tidy();
    const g = this.g, T = g.transit, col = hex(LINE_COLORS[this.color] || 0xe8543f);
    const P = (x, y) => this.proj(x, y);
    const path = (pts) => pts.map(([x, y]) => P(x, y));
    const lines = [], dots = [];
    const L = this.lineObj();
    const seq = this.stops.map((r) => this.pos(r)).filter(Boolean);
    // Bestehende Linie blass, entfallende Abschnitte rot gestrichelt
    if (L && L.pts && L.pts.length > 1) {
      lines.push({ pts: path(L.pts), color: col, w: 4, op: 0.3 });
      const adj = new Set();
      const n = this.stops.length;
      for (let k = 0; k < n - 1; k++) { adj.add(this.key(this.stops[k]) + this.key(this.stops[k + 1])); adj.add(this.key(this.stops[k + 1]) + this.key(this.stops[k])); }
      if (this.loop && n > 2) { adj.add(this.key(this.stops[n - 1]) + this.key(this.stops[0])); adj.add(this.key(this.stops[0]) + this.key(this.stops[n - 1])); }
      const on = L.stops.length, segs = L.loop ? on : on - 1;
      for (let s = 0; s < segs; s++) {
        const a = L.stops[s], b = L.stops[(s + 1) % on];
        if (adj.has(this.key(a) + this.key(b))) continue;
        const pts = [];
        for (let i = 0; i < L.pts.length; i++) if (L.pair[i] === s) { if (!pts.length && i > 0) pts.push(L.pts[i - 1]); pts.push(L.pts[i]); }
        if (L.loop && s === segs - 1 && pts.length) pts.push(L.pts[0]);
        if (pts.length > 1) lines.push({ pts: path(pts), color: BAD, w: 4, dash: '4 7', op: 0.95 });
      }
    }
    if (seq.length > 1) lines.push({ pts: path(this.octi(seq, this.loop, this.parity())), color: col, w: 7, op: 0.95, halo: true });
    // Gummiband: vom gezogenen bzw. nächsten Ende zum Finger/Zeiger
    const d = this.drag, hv = !d && this.hover && !this.inp.gest ? this.hover : null;
    const tip = d && d.x != null ? { x: d.x, y: d.y } : hv;
    let cand = null;
    if (tip && !this.loop) {
      const snap = this.hit(tip.x, tip.y, this.snapR());
      const t = this.pick(tip.x, tip.y);
      let end = d ? d.end : null;
      let target = null, ok = true;
      if (snap) { const p = this.pos(snap.r); target = p; if (!d && snap.k >= 0) target = null; }
      else if (t && t.i >= 0) { target = { x: t.x, y: t.y }; ok = !this.canPlan(t.x, t.y); }
      if (target && seq.length) {
        if (!end) end = this.endFor(target.x, target.y);
        const from = end === 's' ? seq[0] : seq[seq.length - 1];
        if (from && (from.x !== target.x || from.y !== target.y)) {
          const pts = this.octi([from, target], false, 0);
          lines.push({ pts: path(pts), color: ok ? col : BAD, w: 4, dash: '9 7', op: 0.9 });
        }
      }
      if (snap) cand = { x: snap.x, y: snap.y, ring: true };
      else if (target) { const p = P(target.x + 0.5, target.y + 0.5); cand = { x: p.x, y: p.y, ok }; }
    }
    // Stationen auf der Karte (Fanghilfe), dann die des Entwurfs
    const inDraft = new Set(this.stops.filter((r) => typeof r === 'number'));
    const rc = this.inp.e.canvas.getBoundingClientRect();
    for (const st of T.stations.values()) {
      if (inDraft.has(st.id)) continue;
      const p = P(st.x + 0.5, st.y + 0.5);
      if (p.z > 1 || p.x < rc.left - 20 || p.y < rc.top - 20 || p.x > rc.right + 20 || p.y > rc.bottom + 20) continue;
      dots.push({ x: p.x, y: p.y, r: 8, fill: '#fff', stroke: '#2b2540', sw: 3 });
    }
    this.stops.forEach((r, k) => {
      const p = this.scr(r);
      if (!p) return;
      const nu = this.isNew(r);
      const sel = this.pop && this.pop.k === k;
      // geplante Station: Punkt in der Mitte; Feld inzwischen ungültig (bebaut …): rot
      const bad = nu && !!T.canPlaceStation(r.x, r.y);
      if (sel) dots.push({ x: p.x, y: p.y, r: 18, fill: 'none', stroke: '#fff', sw: 3, glow: BAD });
      dots.push({ x: p.x, y: p.y, r: sel ? 12 : 9, fill: '#fff', stroke: bad ? BAD : col, sw: nu ? 3 : 4.5 });
      if (nu) dots.push({ x: p.x, y: p.y, r: 3.5, fill: bad ? BAD : col, stroke: 'none', sw: 0 });
    });
    if (cand) {
      if (cand.ring) dots.push({ x: cand.x, y: cand.y, r: 17, fill: 'none', stroke: '#fff', sw: 3.5, glow: col });
      else dots.push({ x: cand.x, y: cand.y, r: 9, fill: 'rgba(255,255,255,0.75)', stroke: cand.ok ? col : BAD, sw: 3, dash: '4 3' });
    }
    // Menü an der angetippten Station
    let pop = null;
    if (this.pop) {
      const p = this.scr(this.stops[this.pop.k]);
      const items = this.popItems();
      if (p && items.length) pop = { x: p.x, y: p.y, items };
    }
    return { lines, dots, pop };
  }

  // Einzugsgebiet am Zeiger bzw. Finger (Weltkoordinaten) für die Overlay-Scheibe
  radiusAt() {
    const d = this.drag, tip = d && d.x != null ? d : this.hover;
    if (!tip || this.loop) return null;
    const t = this.pick(tip.x, tip.y);
    if (!t || t.i < 0) return null;
    const snap = this.hit(tip.x, tip.y, this.snapR());
    const p = snap ? this.pos(snap.r) : t;
    return { x: p.x + 0.5 - this.g.W / 2, z: p.y + 0.5 - this.g.H / 2, r: TRANSIT.catchment };
  }
}
