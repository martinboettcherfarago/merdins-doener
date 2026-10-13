// Werkzeuge: Auswählen, Straßen ziehen, Zonen malen, Gebäude setzen, Abreißen, Pulsbahn-Linien zeichnen.
// Registrierte Werkzeuge (TOOLS[kind]) dürfen zusätzlich name, icon, hint(input) → Text und cursor (CSS) angeben.
// Im Fotomodus ruhen alle Werkzeuge.
// Sicheres Bauen (TOUCH, Runde 3b): Bei Touch/Stift (Einstellung app.settings.confirmPlace: 'auto' | 'always' | 'never')
// setzt Antippen nur eine Vorschau (this.pend). Die Vorschau lässt sich ziehen, Straßen/Flächen haben Griffe an beiden
// Enden, Ziehen auf freier Karte verschiebt die Kamera. Gebaut wird erst über die Leiste (ui/placebar.js) mit ✓.
// Linien-Werkzeuge: Antippen fügt Stationen hinzu (leichtes Verrutschen zählt als Tippen), „Fertig" schließt ab.
// Registrierte Werkzeuge machen mit über pendKind(input) → 'point' | 'rect' | 'tap' (ohne Angabe 'tap'),
// pendPreview(input, p) → Leisten-Info, pendApply(input, p) und für Linienentwürfe draft/draftFinish/draftUndo/draftClear.
import { Vector3 } from 'three';
import { BUILDINGS, ROADS, ZONE_INFO, TRANSIT, T } from './config.js';
import { fmtMoney } from './util.js';
import { LINE_COLORS } from './sim/transit.js';
import { TOOLS } from './registry.js';
import { PlaceBar } from './ui/placebar.js';

const SLOP = 10; // px: bis hierhin gilt eine Fingerbewegung als Tippen
const SLOP_LINE = 18; // Linien: großzügiger, damit Stationen auch mit leichtem Verrutschen sitzen
const HOLD_MS = 500; // Finger so lange ruhig halten: Vorschau entsteht sofort und folgt dem Finger (input.holdMs)
const HANDLE_R = 36; // Fangradius der Griffe (px)
const GHOST_R = 46; // Fangradius um die Gebäudevorschau (px)
const _v = new Vector3();

// Auf Touch-Geräten keine Zeiger-Kurzinfo
const e2e = (inp) => inp.lastMove && inp.lastMove.pointerType === 'touch';

export class Input {
  constructor(engine, ui, audio) {
    this.e = engine;
    this.g = engine.game;
    this.ui = ui;
    this.audio = audio;
    this.tool = { kind: 'select' };
    this.drag = null;
    this.hover = null;
    this.rot = 0;
    this.lineStops = [];
    this.lastMove = null;
    this.pend = null; // Vorschau, die auf Bestätigung wartet: {kind:'point', x, y} | {kind:'rect', sx, sy, ex, ey, single} | {kind:'tap'}
    this.gest = null; // laufende Geste im Bestätigungsmodus
    this.touchIds = new Set();
    this.lastType = 'mouse';
    this.holdMs = HOLD_MS;
    this.bar = new PlaceBar(this);
    const c = engine.canvas;
    this.onDown = (e) => this.pointerDown(e);
    this.onMove = (e) => { this.lastMove = e; this.pointerMove(e); };
    this.onUp = (e) => this.pointerUp(e);
    this.onCancel = (e) => this.pointerCancel(e);
    this.onKey = (e) => this.key(e);
    // Doppelklick beendet die Linie – im Bestätigungsmodus nur über „Fertig"
    this.onDbl = (e) => { if (this.pend) return; if (this.tool.kind === 'line' || this.tool.kind === 'extend') this.finishLine(); void e; };
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointercancel', this.onCancel);
    c.addEventListener('dblclick', this.onDbl);
    c.addEventListener('pointerleave', () => { this.ui.tooltip(null); });
    window.addEventListener('keydown', this.onKey);
  }

  dispose() {
    const c = this.e.canvas;
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('pointermove', this.onMove);
    c.removeEventListener('pointerup', this.onUp);
    c.removeEventListener('pointercancel', this.onCancel);
    c.removeEventListener('dblclick', this.onDbl);
    window.removeEventListener('keydown', this.onKey);
    this.bar.dispose();
  }

  setTool(tool) {
    this.cancelDrag();
    if (this.tool && TOOLS[this.tool.kind] && TOOLS[this.tool.kind].cancel) TOOLS[this.tool.kind].cancel(this);
    this.tool = tool || { kind: 'select' };
    this.lineStops = [];
    const ov = this.e.overlay;
    ov.hideGhost(); ov.hideRadius(); ov.clearTiles(); ov.showLinePreview(null);
    ov.setZoneStrong(this.tool.kind === 'zone');
    this.pendingPlace = null;
    this.pend = null;
    this.gest = null;
    this.bar.hide();
    const k = this.tool.kind;
    const reg = TOOLS[k];
    this.e.canvas.style.cursor = reg && reg.cursor ? reg.cursor : k === 'select' ? '' : k === 'bulldoze' ? 'crosshair' : k === 'place' ? 'copy' : 'crosshair';
    this.ui.toolChanged(this.tool);
    this.ui.tooltip(null);
    if (this.lastMove && this.lastMove.pointerType === 'mouse') this.pointerMove(this.lastMove);
  }

  cancelDrag() {
    this.drag = null;
    this.e.overlay.clearTiles();
  }

  key(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (TOOLS[this.tool.kind] && TOOLS[this.tool.kind].key && TOOLS[this.tool.kind].key(this, e)) return;
    if (this.pend && this.pend.kind !== 'tap' && (e.code === 'Enter' || e.code === 'NumpadEnter')) { this.barAction('ok'); return; }
    if (this.pend && e.code === 'Escape') { this.barAction('cancel'); return; }
    if (e.code === 'Escape') {
      if (this.drag) this.cancelDrag();
      else if ((this.tool.kind === 'line' || this.tool.kind === 'extend') && this.lineStops.length) { this.lineStops = []; this.e.overlay.showLinePreview(null); }
      else if (this.tool.kind !== 'select') this.setTool({ kind: 'select' });
      else if (this.ui.cat) this.ui.closeTray();
      else this.ui.closePanels();
    } else if (e.code === 'KeyR' && this.tool.kind === 'place') {
      this.rot = (this.rot + 1) % 4;
      if (this.pend) this.refreshPend();
      else if (this.lastMove) this.pointerMove(this.lastMove);
    } else if (e.code === 'Enter' && (this.tool.kind === 'line' || this.tool.kind === 'extend')) {
      this.finishLine();
    } else if (e.code === 'KeyB' || e.code === 'Delete') {
      this.setTool({ kind: 'bulldoze' });
    }
  }

  photoActive() { return !!(this.ui.photo && this.ui.photo.active); }

  pointerDown(e) {
    if (e.pointerType === 'touch') { if (e.isPrimary) this.touchIds.clear(); this.touchIds.add(e.pointerId); }
    this.lastType = e.pointerType || 'mouse';
    // Zweiter Finger während einer Geste: Zoomen/Drehen der Kamera – die Geste löst danach nichts mehr aus
    if (this.gest) { if (e.pointerId !== this.gest.id) this.gest.mode = 'pinch'; return; }
    if (this.e.rig.pinching || this.photoActive()) return;
    if (e.button === 2) {
      this.rightDown = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button !== 0 || e.altKey) return;
    if (this.confirming(e)) { this.gestDown(e); return; }
    const t = this.e.pickTile(e.clientX, e.clientY);
    if (e.pointerType === 'touch' && this.tool.kind === 'select') {
      this.touchPan = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: 0 };
      return;
    }
    if (!t || t.i < 0) return;
    const k = this.tool.kind;
    if (TOOLS[k]) { if (TOOLS[k].down) TOOLS[k].down(this, t, e); return; }
    if (k === 'road' || k === 'zone' || k === 'dezone' || k === 'bulldoze') {
      this.drag = { sx: t.x, sy: t.y, ex: t.x, ey: t.y };
      this.e.canvas.setPointerCapture(e.pointerId);
      this.updatePreview();
    }
  }

  pointerMove(e) {
    if (this.photoActive()) return;
    if (this.gest) { if (e.pointerId === this.gest.id) this.gestMove(e); return; }
    if (this.pend || (e.pointerType !== 'mouse' && this.confirming(e))) {
      // Bestätigungsmodus: Schweben verschiebt die Vorschau nicht (Touch-Finger ohne Geste: zweiter Finger beim Zoomen)
      if (this.pend) this.refreshPend();
      return;
    }
    if (this.touchPan && e.pointerId === this.touchPan.id) {
      const dx = e.clientX - this.touchPan.x, dy = e.clientY - this.touchPan.y;
      this.touchPan.x = e.clientX; this.touchPan.y = e.clientY;
      this.touchPan.moved += Math.abs(dx) + Math.abs(dy);
      if (!this.e.rig.pinching) this.e.rig.panScreen(dx, dy);
      return;
    }
    if (this.e.rig.pinching && this.drag) this.cancelDrag();
    const t = this.e.pickTile(e.clientX, e.clientY);
    this.hover = t;
    this.mouse = { x: e.clientX, y: e.clientY };
    if (!t) { this.ui.tooltip(null); return; }
    if (TOOLS[this.tool.kind]) { const T2 = TOOLS[this.tool.kind]; if (T2.move) T2.move(this, t, e); if (T2.hover) T2.hover(this, t); return; }
    if (this.drag) {
      if (t.i >= 0 || this.tool.kind !== 'road') {
        this.drag.ex = Math.max(0, Math.min(this.g.W - 1, t.x));
        this.drag.ey = Math.max(0, Math.min(this.g.H - 1, t.y));
      }
      this.updatePreview();
      return;
    }
    this.updateHover();
  }

  pointerUp(e) {
    if (e.pointerType === 'touch') this.touchIds.delete(e.pointerId);
    if (this.gest) { if (e.pointerId === this.gest.id) this.gestUp(e); return; }
    if (this.photoActive()) return;
    if (e.pointerType !== 'mouse' && this.confirming(e)) return;
    if (e.button === 2) {
      const rd = this.rightDown;
      this.rightDown = null;
      if (rd && Math.hypot(e.clientX - rd.x, e.clientY - rd.y) < 5) {
        // Rechtsklick ohne Ziehen: abbrechen / Linie abschließen
        if (this.pend && this.pend.kind !== 'tap') this.barAction('cancel');
        else if (this.tool.kind === 'line' || this.tool.kind === 'extend') { if (this.lineStops.length) this.finishLine(); else this.setTool({ kind: 'select' }); }
        else if (this.drag) this.cancelDrag();
        else if (this.tool.kind !== 'select') this.setTool({ kind: 'select' });
      }
      return;
    }
    if (this.touchPan && e.pointerId === this.touchPan.id) {
      const tp = this.touchPan;
      this.touchPan = null;
      if (tp.moved > 8) return;
    } else if (e.button !== 0) return;
    if (this.e.rig.pinching) return;
    const t = this.e.pickTile(e.clientX, e.clientY);
    const k = this.tool.kind;
    if (TOOLS[k]) { if (TOOLS[k].up && t) TOOLS[k].up(this, t, e); return; }
    if (this.drag) {
      this.applyDrag();
      this.cancelDrag();
      this.updateHover();
      return;
    }
    if (!t || t.i < 0) return;
    if (k === 'select') this.selectAt(t);
    else if (k === 'place' && e.pointerType === 'touch') {
      const pp = this.pendingPlace;
      if (pp && pp.x === t.x && pp.y === t.y) { this.pendingPlace = null; this.placeAt(t); }
      else { this.pendingPlace = { x: t.x, y: t.y }; this.hover = t; this.mouse = { x: e.clientX, y: e.clientY - 40 }; this.updateHover(); this.ui.tooltip(null); this.ui.toast('Nochmal tippen zum Bauen'); }
    }
    else if (k === 'place') this.placeAt(t);
    else if (k === 'line' || k === 'extend') this.lineClick(t);
  }

  // ---------- Vorschau
  roadTiles(d = this.drag) {
    const W = this.g.W;
    const tiles = [];
    const dx = d.ex - d.sx, dy = d.ey - d.sy;
    const horizFirst = Math.abs(dx) >= Math.abs(dy);
    const sx = Math.sign(dx), sy = Math.sign(dy);
    let x = d.sx, y = d.sy;
    tiles.push(y * W + x);
    if (horizFirst) {
      while (x !== d.ex) { x += sx; tiles.push(y * W + x); }
      while (y !== d.ey) { y += sy; tiles.push(y * W + x); }
    } else {
      while (y !== d.ey) { y += sy; tiles.push(y * W + x); }
      while (x !== d.ex) { x += sx; tiles.push(y * W + x); }
    }
    return tiles;
  }

  rectTiles(d = this.drag) {
    const W = this.g.W;
    const x0 = Math.min(d.sx, d.ex), x1 = Math.max(d.sx, d.ex), y0 = Math.min(d.sy, d.ey), y1 = Math.max(d.sy, d.ey);
    const tiles = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tiles.push(y * W + x);
    return tiles;
  }

  updatePreview() {
    if (!this.drag) return;
    const r = this.previewRect(this.drag);
    if (r) this.ui.tooltip(r.tip, this.mouse, r.tipOk);
  }

  // Strecke/Fläche d zeichnen; liefert Kurzinfo (tip, tipOk – wie bisher für die Maus) und Angaben für die Leiste
  previewRect(d) {
    const g = this.g, ov = this.e.overlay, k = this.tool.kind;
    if (k === 'road') {
      const tiles = this.roadTiles(d);
      const plan = g.planRoad(tiles, this.tool.type);
      const inv = new Set(plan.invalid);
      ov.showTiles(tiles.map((i) => ({ i, color: inv.has(i) ? 0xff5040 : g.world.terrain[i] === T.WATER ? 0x7fd0ff : 0x9cf0b0 })));
      const bridges = plan.build.filter((i) => g.world.terrain[i] === T.WATER).length;
      const afford = g.canAfford(plan.cost);
      const sub = `${plan.build.length} ${plan.build.length === 1 ? 'Feld' : 'Felder'}${bridges ? ` (davon ${bridges} Brücke)` : ''}`;
      const txt = plan.invalid.length ? 'Hindernis im Weg' : `${ROADS[this.tool.type].name}: ${sub} · ${fmtMoney(plan.cost)}`;
      const reason = plan.invalid.length ? 'Hindernis im Weg' : !plan.build.length ? 'Hier liegt schon diese Straße' : !afford ? 'Nicht genug Geld' : '';
      return { tip: txt, tipOk: !plan.invalid.length && afford, title: ROADS[this.tool.type].name, sub, ok: !reason, reason, okLabel: 'Bauen', price: plan.cost > 0 ? fmtMoney(plan.cost) : '' };
    } else if (k === 'zone' || k === 'dezone') {
      const tiles = this.rectTiles(d);
      const z = k === 'zone' ? this.tool.zone : 0;
      const plan = g.planZone(tiles, z);
      const ok = new Set(plan.apply);
      const col = z ? ZONE_INFO[z].color : 0xbbbbbb;
      ov.showTiles(tiles.filter((i) => ok.has(i)).map((i) => ({ i, color: col })));
      const n = plan.apply.length;
      const sub = `${n} ${n === 1 ? 'Feld' : 'Felder'}`;
      const reason = !n ? (z ? 'Hier ist keine freie Fläche' : 'Hier sind keine Zonen') : z && !g.canAfford(plan.cost) ? 'Nicht genug Geld' : '';
      return { tip: z ? `${ZONE_INFO[z].name}: ${n} Felder · ${fmtMoney(plan.cost)}` : `Zonen entfernen: ${n} Felder`, tipOk: true,
        title: z ? ZONE_INFO[z].name : 'Zonen entfernen', sub, ok: !reason, reason, okLabel: z ? 'Bauen' : 'Entfernen', price: z && plan.cost ? fmtMoney(plan.cost) : '' };
    } else if (k === 'bulldoze') {
      const tiles = this.rectTiles(d);
      const p = g.planBulldoze(tiles);
      ov.showTiles(tiles.map((i) => ({ i, color: 0xff5a4a })));
      const parts = [];
      if (p.blds.length) parts.push(`${p.blds.length} Gebäude`);
      if (p.roads.length) parts.push(`${p.roads.length} Straßenfelder`);
      if (p.stations.length) parts.push(`${p.stations.length} Stationen`);
      if (p.trees) parts.push(`${p.trees} Wald`);
      const price = p.net > 0 ? fmtMoney(p.net) : '+' + fmtMoney(-p.net);
      const rubble = !p.any && tiles.some((i) => g.rubble[i]);
      if (rubble && !parts.length) parts.push('Trümmer räumen');
      const reason = !parts.length ? 'Nichts abzureißen' : p.net > 0 && !g.canAfford(p.net) ? 'Nicht genug Geld' : '';
      return { tip: parts.length && !rubble ? `Abriss: ${parts.join(', ')} · ${price}` : 'Nichts abzureißen', tipOk: true,
        title: 'Abriss', sub: parts.join(', '), ok: !reason, reason, okLabel: 'Abreißen', price: parts.length && p.net ? price : '' };
    }
    const reg = TOOLS[k];
    if (reg && reg.pendPreview) return reg.pendPreview(this, d);
    return null;
  }

  updateHover() {
    const t = this.hover, g = this.g, ov = this.e.overlay, k = this.tool.kind;
    if (!t || t.i < 0) { ov.hideGhost(); ov.hideRadius(); this.ui.tooltip(null); if (k === 'select') { const sb = this.ui.selectedBox(); ov.select(sb && !sb.flat ? sb : null); } return; }
    if (k === 'select') {
      const b = g.buildings.get(g.bld[t.i]);
      const st = g.transit.stations.get(g.stationAt[t.i]);
      if (b) ov.select({ x: b.x, y: b.y, w: b.w, h: b.h, height: this.buildingHeight(b) });
      else if (st) ov.select({ x: st.x, y: st.y, w: 1, h: 1, station: true });
      else { const sb = this.ui.selectedBox(); ov.select(sb && !sb.flat ? sb : null); }
      this.e.canvas.style.cursor = b || st ? 'pointer' : '';
      this.ui.tooltip(this.hoverInfo(b, st), this.mouse, true);
    } else if (k === 'place') {
      const r = this.previewPlace(t.x, t.y);
      this.ui.tooltip(r.tip, this.mouse, r.tipOk);
    } else if (k === 'line' || k === 'extend') {
      const pts = this.linePreviewPoints(t);
      const col = this.tool.kind === 'extend' ? LINE_COLORS[(g.transit.lines.find((l) => l.id === this.tool.line) || { color: 0 }).color] : LINE_COLORS[this.nextLineColor()];
      ov.showLinePreview(pts, col);
      const st = g.transit.stations.get(g.stationAt[t.i]);
      let txt;
      if (st) txt = this.lineStops.length && this.lineStops[0] === st.id && this.lineStops.length >= 3 ? `${st.name}: Ring schließen` : `${st.name}${this.lineStops.length ? ' anfahren' : ': Linie beginnen'}`;
      else {
        const err = g.transit.canPlaceStation(t.x, t.y);
        txt = err ? err : `Neue Station hier · ${fmtMoney(g.buildingCost('station'))}`;
      }
      if (this.lineStops.length >= 2) txt += ' · Rechtsklick/Enter: fertig';
      if (this.tool.kind === 'line' && this.lineStops.length >= 1) {
        const seq = st && !this.lineStops.includes(st.id) ? [...this.lineStops, st.id] : this.lineStops;
        if (seq.length >= 2) txt += ` · Linie ≈ ${fmtMoney(g.linePlanCost(seq, false))}`;
      }
      this.ui.tooltip(txt, this.mouse, true);
      if (st) ov.select({ x: st.x, y: st.y, w: 1, h: 1, station: true });
      ov.showRadius(t.x + 0.5 - g.W / 2, t.y + 0.5 - g.H / 2, TRANSIT.catchment, 0x9cf0b0);
    } else {
      // Straße/Zone/Abriss: Feld markieren
      const col = k === 'bulldoze' ? 0xff5a4a : k === 'zone' ? ZONE_INFO[this.tool.zone].color : 0xffffff;
      this.e.overlay.showTiles([{ i: t.i, color: col }]);
      if (k === 'road') {
        const plan = g.planRoad([t.i], this.tool.type);
        this.ui.tooltip(`${ROADS[this.tool.type].name} · ziehen zum Bauen · ${fmtMoney(plan.cost)}/Feld`, this.mouse, true);
      } else if (k === 'zone') this.ui.tooltip(`${ZONE_INFO[this.tool.zone].name} · Fläche aufziehen`, this.mouse, true);
      else if (k === 'dezone') this.ui.tooltip('Zonen entfernen · Fläche aufziehen', this.mouse, true);
      else this.ui.tooltip('Abreißen · Fläche aufziehen', this.mouse, true);
    }
  }

  // Gebäudevorschau mit Mittelpunkt (tx, ty) zeichnen; Kurzinfo für die Maus und Angaben für die Leiste
  previewPlace(tx, ty) {
    const g = this.g, ov = this.e.overlay;
    const key = this.tool.key;
    const def = BUILDINGS[key];
    const [w, h] = g.footprint(key, this.rot);
    const x = tx - Math.floor((w - 1) / 2), y = ty - Math.floor((h - 1) / 2);
    const err = g.checkPlace(key, x, y, this.rot);
    const cost = g.placeCost(key, x, y, this.rot);
    const afford = g.canAfford(cost);
    ov.showGhost(x, y, w, h, !err && afford, key === 'station' ? TRANSIT.trackHeight + 0.5 : 0.6);
    const r = def.service ? def.service.radius : def.parkRadius || (key === 'station' ? TRANSIT.catchment : def.lvRadius || 0);
    if (r) ov.showRadius(x + w / 2 - g.W / 2, y + h / 2 - g.H / 2, r, def.service ? 0xffffff : 0x9cf0b0);
    else ov.hideRadius();
    const warn = err ? '' : this.waterWarning(key, x, y, w, h);
    this.placePos = { x, y };
    const reason = err || (!afford ? 'Nicht genug Geld' : '');
    return {
      tip: err ? err : `${def.name} · ${fmtMoney(cost)}${w !== h ? ' · [R] drehen' : ''}${warn ? ' · ' + warn : ''}`, tipOk: !err && afford && !warn,
      title: def.name, sub: warn || `${w}×${h} ${w * h === 1 ? 'Feld' : 'Felder'}`, warn: !!warn, ok: !reason, reason, okLabel: 'Bauen', price: cost > 0 ? fmtMoney(cost) : '',
      rotate: true, x, y, w, h,
    };
  }

  // ---------- Sicheres Bauen (Bestätigungsmodus)
  confirmMode(e) {
    const s = (this.ui.app && this.ui.app.settings && this.ui.app.settings.confirmPlace) || 'auto';
    if (s === 'never') return false;
    if (s === 'always') return true;
    return !!e && (e.pointerType === 'touch' || e.pointerType === 'pen');
  }

  // Wie wird mit dem aktuellen Werkzeug bestätigt? 'point' (Gebäude), 'rect' (Strecke/Fläche), 'tap' (Linien, sofort) oder null
  pendKind() {
    const k = this.tool.kind;
    if (k === 'select') return null;
    if (k === 'place') return 'point';
    if (k === 'road' || k === 'zone' || k === 'dezone' || k === 'bulldoze') return 'rect';
    if (k === 'line' || k === 'extend') return 'tap';
    const reg = TOOLS[k];
    if (reg) return reg.pendKind ? reg.pendKind(this) : 'tap';
    return null;
  }

  confirming(e) { return !!this.pendKind() && (!!this.pend || this.confirmMode(e)); }

  gestDown(e) {
    const kind = this.pendKind();
    const G = { id: e.pointerId, type: e.pointerType, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, mode: 'tap', kind, t0: performance.now(), off: { x: 0, y: 0 } };
    const hit = this.pendHit(e.clientX, e.clientY);
    if (hit) { G.mode = hit.mode; G.off = { x: hit.x - e.clientX, y: hit.y - e.clientY }; }
    this.gest = G;
    try { this.e.canvas.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
    if (this.e.rig.interrupt) this.e.rig.interrupt();
    // Finger ruhig halten: Vorschau entsteht hier und folgt danach dem Finger
    if (G.mode === 'tap' && (kind === 'point' || kind === 'rect')) {
      G.hold = setTimeout(() => {
        if (this.gest !== G || G.mode !== 'tap') return;
        const t = this.e.pickTile(G.x0, G.y0);
        if (!t || t.i < 0) return;
        if (kind === 'point') { this.pend = { kind: 'point', x: t.x, y: t.y }; G.mode = 'ghost'; }
        else { this.pend = { kind: 'rect', sx: t.x, sy: t.y, ex: t.x, ey: t.y, single: true }; G.mode = 'end'; }
        G.held = true;
        try { if (navigator.vibrate) navigator.vibrate(12); } catch (err) { /* egal */ }
        this.audio.play('click');
        this.refreshPend();
      }, this.holdMs);
    }
    if (this.pend) this.refreshPend();
  }

  gestMove(e) {
    const G = this.gest;
    const dx = e.clientX - G.x, dy = e.clientY - G.y;
    G.x = e.clientX; G.y = e.clientY;
    if (G.mode === 'pinch') return;
    if (this.e.rig.pinching || this.touchIds.size >= 2) { G.mode = 'pinch'; this.gestEnd(G); return; }
    if (G.mode === 'tap') {
      const slop = G.kind === 'tap' ? SLOP_LINE : SLOP;
      if (Math.hypot(e.clientX - G.x0, e.clientY - G.y0) <= slop) return;
      // Echte Bewegung: Kamera verschieben (auch während eine Vorschau steht) – beim Loslassen passiert nichts
      G.mode = 'pan';
      clearTimeout(G.hold);
      this.e.rig.panScreen(e.clientX - G.x0, e.clientY - G.y0);
      return;
    }
    if (G.mode === 'pan') { this.e.rig.panScreen(dx, dy); return; }
    this.gestDrag(G);
  }

  // Griff bzw. Vorschau dem Finger nachführen
  gestDrag(G) {
    const p = this.pend;
    if (!p) return;
    const t = this.e.pickTile(G.x + G.off.x, G.y + G.off.y);
    if (!t) return;
    const W = this.g.W, H = this.g.H;
    const cx = Math.max(0, Math.min(W - 1, t.x)), cy = Math.max(0, Math.min(H - 1, t.y));
    G.dragged = true;
    if (G.mode === 'ghost' && p.kind === 'point') { if (p.x === cx && p.y === cy) return; p.x = cx; p.y = cy; }
    else if (p.kind === 'rect' && (G.mode === 'start' || G.mode === 'end')) {
      if (t.i < 0 && this.tool.kind === 'road') return;
      if (G.mode === 'start') { if (p.sx === cx && p.sy === cy) return; p.sx = cx; p.sy = cy; } else { if (p.ex === cx && p.ey === cy) return; p.ex = cx; p.ey = cy; }
      p.single = false;
    } else return;
    this.refreshPend();
  }

  gestUp(e) {
    const G = this.gest;
    this.gestEnd(G);
    this.gest = null;
    if (G.mode === 'tap') this.gestTap(G, e);
    else if (G.mode === 'ghost' || G.mode === 'start' || G.mode === 'end') {
      // Griff losgelassen: Vorschau bleibt stehen, die Leiste rückt wieder heran
      if (this.pend) this.refreshPend();
    }
  }

  pointerCancel(e) {
    if (e.pointerType === 'touch') this.touchIds.delete(e.pointerId);
    if (this.gest && e.pointerId === this.gest.id) { this.gestEnd(this.gest); this.gest = null; if (this.pend) this.refreshPend(); }
    if (this.touchPan && e.pointerId === this.touchPan.id) this.touchPan = null;
  }

  gestEnd(G) { if (G && G.hold) { clearTimeout(G.hold); G.hold = 0; } }

  // Kurzes Tippen (ohne Kamerabewegung): Vorschau setzen bzw. umsetzen, Linien-Station hinzufügen
  gestTap(G, e) {
    const t = this.e.pickTile(G.x0, G.y0);
    if (!t || t.i < 0) return;
    this.mouse = { x: G.x0, y: G.y0 };
    const k = this.tool.kind;
    if (G.kind === 'point') this.pend = { kind: 'point', x: t.x, y: t.y };
    else if (G.kind === 'rect') {
      const p = this.pend;
      // Einzelner Startpunkt steht: das nächste Tippen setzt das Ziel; sonst beginnt eine neue Strecke/Fläche
      if (p && p.kind === 'rect' && p.single && (p.sx !== t.x || p.sy !== t.y)) { p.ex = t.x; p.ey = t.y; p.single = false; }
      else this.pend = { kind: 'rect', sx: t.x, sy: t.y, ex: t.x, ey: t.y, single: true };
    } else if (G.kind === 'tap') {
      this.hover = t;
      if (k === 'line' || k === 'extend') this.lineClick(t);
      else {
        const reg = TOOLS[k];
        if (reg) { if (reg.down) reg.down(this, t, e); if (reg.up) reg.up(this, t, e); if (reg.hover && this.tool.kind === k) reg.hover(this, t); }
      }
      this.ui.tooltip(null);
      if (this.tool.kind !== k) return;
      this.pend = this.draftInfo() ? { kind: 'tap' } : null;
    }
    this.refreshPend();
  }

  // Treffer auf Griff oder Vorschau?
  pendHit(cx, cy) {
    const p = this.pend;
    if (!p || p.kind === 'tap') return null;
    const s = this.pendScreen();
    if (!s) return null;
    if (p.kind === 'rect') {
      let best = null, bd = HANDLE_R;
      for (const h of s.handles) {
        const d = Math.hypot(h.x - cx, h.y - cy);
        if (d < bd || (best && d === bd && h.kind === 'e')) { bd = d; best = h; }
      }
      // Liegen beide Enden aufeinander (gerade erst angetippt), zieht der Finger das Ende
      if (best && p.sx === p.ex && p.sy === p.ey) return { mode: 'end', x: best.x, y: best.y };
      return best ? { mode: best.kind === 's' ? 'start' : 'end', x: best.x, y: best.y } : null;
    }
    const c = s.center;
    const t = this.e.pickTile(cx, cy);
    const fp = this.pendFoot;
    const inside = t && fp && t.x >= fp.x && t.y >= fp.y && t.x < fp.x + fp.w && t.y < fp.y + fp.h;
    const mh = s.handles[0];
    if (inside || Math.hypot(c.x - cx, c.y - cy) < GHOST_R || (mh && Math.hypot(mh.x - cx, mh.y - cy) < HANDLE_R)) return { mode: 'ghost', x: c.x, y: c.y };
    return null;
  }

  // Bildschirmlage von Vorschau, Griffen und Finger (für Leiste und Treffer)
  pendScreen() {
    const p = this.pend;
    if (!p) return null;
    const g = this.g, cam = this.e.camera, cv = this.e.canvas;
    const rc = cv.getBoundingClientRect();
    const proj = (wx, wy, wz) => {
      _v.set(wx, wy, wz).project(cam);
      return { x: rc.left + ((_v.x + 1) / 2) * rc.width, y: rc.top + ((1 - _v.y) / 2) * rc.height };
    };
    const tile = (x, y, hgt = 0) => proj(x + 0.5 - g.W / 2, hgt, y + 0.5 - g.H / 2);
    const G = this.gest;
    const finger = G && G.mode !== 'pan' && G.mode !== 'pinch' ? { x: G.x, y: G.y } : null;
    const dragging = !!(G && (G.mode === 'ghost' || G.mode === 'start' || G.mode === 'end'));
    const boxOf = (pts) => ({ x0: Math.min(...pts.map((q) => q.x)), y0: Math.min(...pts.map((q) => q.y)), x1: Math.max(...pts.map((q) => q.x)), y1: Math.max(...pts.map((q) => q.y)) });
    if (p.kind === 'point') {
      const f = this.pendFoot || { x: p.x, y: p.y, w: 1, h: 1, hgt: 0.6 };
      const x0 = f.x - g.W / 2, z0 = f.y - g.H / 2, x1 = x0 + f.w, z1 = z0 + f.h;
      const pts = [proj(x0, 0, z0), proj(x1, 0, z0), proj(x0, 0, z1), proj(x1, 0, z1), proj(x0, f.hgt, z0), proj(x1, f.hgt, z1), proj(x1, f.hgt, z0), proj(x0, f.hgt, z1)];
      const center = proj((x0 + x1) / 2, 0, (z0 + z1) / 2);
      // Verschiebe-Griff unter der Vorschau (verdeckt sie nicht; beim Ziehen bleibt die Vorschau über dem Finger)
      const box = boxOf(pts);
      const mh = { x: center.x, y: box.y1 + 24, kind: 'm', on: dragging };
      return { box: { ...box, y1: mh.y + 18 }, center, handles: [mh], finger, dragging };
    }
    if (p.kind === 'rect') {
      const a = tile(p.sx, p.sy), b = tile(p.ex, p.ey);
      const same = p.sx === p.ex && p.sy === p.ey;
      const hs = same ? [{ ...b, kind: 'e', on: dragging }] : [{ ...a, kind: 's', on: dragging && G.mode === 'start' }, { ...b, kind: 'e', on: dragging && G.mode === 'end' }];
      const pts = [a, b];
      if (this.tool.kind !== 'road') pts.push(tile(p.sx, p.ey), tile(p.ex, p.sy));
      return { box: boxOf(pts), handles: hs, finger, dragging };
    }
    // Linienentwurf: Leiste unten mittig – nicht über der Karte, auf der die nächsten Stationen angetippt werden
    const mid = rc.left + rc.width / 2, bot = rc.top + rc.height;
    return { box: { x0: mid, y0: bot, x1: mid, y1: bot }, handles: [], finger, dock: true };
  }

  // Jedes Bild, solange die Leiste steht: Rand-Bildlauf beim Ziehen eines Griffs, Gültigkeit gelegentlich auffrischen
  pendTick(dt) {
    const G = this.gest;
    if (G && (G.mode === 'ghost' || G.mode === 'start' || G.mode === 'end')) {
      const m = 44, W = window.innerWidth, H = window.innerHeight;
      const ex = G.x < m ? 1 : G.x > W - m ? -1 : 0, ey = G.y < m + 30 ? 1 : G.y > H - m ? -1 : 0;
      if (ex || ey) { const sp = 420 * dt; this.e.rig.panScreen(ex * sp, ey * sp); this.gestDrag(G); }
    }
    this._pendAge = (this._pendAge || 0) + dt;
    if (this._pendAge > 0.5 && this.pend && !G) { this._pendAge = 0; this.refreshPend(); }
  }

  // Linienentwurf (U-Bahn bzw. registrierte Linienwerkzeuge)
  draftInfo() {
    const k = this.tool.kind, g = this.g;
    if (k === 'line' || k === 'extend') {
      const n = this.lineStops.length;
      if (k === 'line' && !n) return null;
      const at = n ? (g.transit.stations.get(this.lineStops[n - 1]) || null) : null;
      let atTile = at ? at.y * g.W + at.x : null;
      if (k === 'extend' && atTile == null) {
        const line = g.transit.lines.find((l) => l.id === this.tool.line);
        const end = line && g.transit.stations.get(this.tool.atStart ? line.stops[0] : line.stops[line.stops.length - 1]);
        if (end) atTile = end.y * g.W + end.x;
      }
      if (k === 'extend') return { title: 'Linie verlängern', sub: 'Station antippen · Fertig beendet', ok: true, okLabel: 'Fertig', price: '', undo: false, at: atTile };
      const cost = n >= 2 ? g.linePlanCost(this.lineStops, false) : 0;
      return {
        title: 'U-Bahn-Linie', sub: `${n} ${n === 1 ? 'Station' : 'Stationen'} · ${n < 2 ? 'nächste Station antippen' : 'weitere antippen oder Fertig'}`,
        ok: n >= 2, reason: n < 2 ? 'Mindestens zwei Stationen antippen' : '', okLabel: 'Fertig', price: n >= 2 && cost > 0 ? '≈ ' + fmtMoney(cost) : '', undo: n >= 1, at: atTile,
      };
    }
    const reg = TOOLS[k];
    return reg && reg.draft ? reg.draft(this) : null;
  }

  // Vorschau zeichnen und Leiste aktualisieren
  refreshPend() {
    const p = this.pend;
    if (!p) { this.bar.hide(); return; }
    let info = null;
    if (p.kind === 'point') {
      const reg = TOOLS[this.tool.kind];
      if (this.tool.kind === 'place') {
        info = this.previewPlace(p.x, p.y);
        this.pendFoot = { x: info.x, y: info.y, w: info.w, h: info.h, hgt: this.tool.key === 'station' ? TRANSIT.trackHeight + 0.5 : 0.6 };
      } else if (reg && reg.pendPreview) { info = reg.pendPreview(this, p); this.pendFoot = { x: p.x, y: p.y, w: 1, h: 1, hgt: 0 }; this.placePos = { x: p.x, y: p.y }; }
    } else if (p.kind === 'rect') {
      info = this.previewRect(p);
      if (info && p.single) info.sub = `${info.sub ? info.sub + ' · ' : ''}Ziel antippen oder Griff ziehen`;
    } else info = this.draftInfo();
    if (!info) { this.pend = null; this.bar.hide(); return; }
    this.ui.tooltip(null);
    this.bar.show(info);
  }

  // Knöpfe der Leiste (auch Enter/Esc)
  barAction(a) {
    const p = this.pend;
    if (!p) return;
    const k = this.tool.kind, reg = TOOLS[k];
    const s = this.pendScreen();
    if (s) this.mouse = { x: (s.box.x0 + s.box.x1) / 2, y: s.box.y0 };
    if (a === 'rotate') { this.rot = (this.rot + 1) % 4; this.audio.play('click'); this.refreshPend(); return; }
    if (a === 'undo') {
      if (k === 'line') { this.lineStops.pop(); this.e.overlay.showLinePreview(this.lineStops.length >= 2 ? this.linePreviewPoints(null) : null); }
      else if (reg && reg.draftUndo) reg.draftUndo(this);
      this.audio.play('click');
      if (!this.draftInfo()) this.pend = null;
      this.refreshPend();
      return;
    }
    if (a === 'cancel') {
      this.pend = null;
      if (p.kind === 'tap') {
        if (k === 'line' || k === 'extend') { this.lineStops = []; this.e.overlay.showLinePreview(null); this.e.overlay.hideRadius(); this.e.overlay.select(null); }
        else if (reg && reg.draftClear) reg.draftClear(this);
      } else this.clearPendView();
      this.bar.hide();
      return;
    }
    if (a !== 'ok') return;
    if (p.kind === 'point') {
      if (k === 'place') {
        const ok = this.placeAt({ x: p.x, y: p.y }, true);
        if (ok && this.tool.kind === k) { this.pend = null; this.clearPendView(); this.bar.hide(); } else if (this.pend) this.refreshPend();
      } else if (reg && reg.pendApply) { reg.pendApply(this, p); this.pend = null; this.clearPendView(); this.bar.hide(); }
      return;
    }
    if (p.kind === 'rect') {
      const ok = k === 'road' || k === 'zone' || k === 'dezone' || k === 'bulldoze' ? this.applyDrag(p) : reg && reg.pendApply ? reg.pendApply(this, p) !== false : false;
      // Nach dem Bauen bleibt das Werkzeug aktiv; bei Fehlern bleibt die Vorschau zum Nachjustieren stehen
      if (ok) { this.pend = null; this.clearPendView(); this.bar.hide(); } else this.refreshPend();
      return;
    }
    // Linie fertig
    if (k === 'line' || k === 'extend') this.finishLine();
    else if (reg && reg.draftFinish) reg.draftFinish(this);
    if (this.tool.kind === k && this.draftInfo()) this.refreshPend();
    else { this.pend = null; this.bar.hide(); }
  }

  clearPendView() {
    const ov = this.e.overlay;
    ov.hideGhost(); ov.hideRadius(); ov.clearTiles();
    this.pendFoot = null;
  }

  // Kurzinfo für den Zeiger-Tooltip im Auswahlmodus
  hoverInfo(b, st) {
    if (e2e(this)) return null;
    if (st) return `${st.name} · ${st.waiting.length} wartend`;
    if (!b) return null;
    if (b.zone) {
      const names = { 1: ['', 'Häuschen', 'Einfamilienhaus', 'Stadthaus', 'Wohnblock', 'Wohnturm'], 2: ['', 'Kiosk', 'Ladenzeile', 'Kaufhaus', 'Geschäftshaus', 'Einkaufsturm'], 3: ['', 'Werkstatt', 'Fabrik', 'Werk', 'Großwerk', 'Hightech-Werk'], 4: ['', 'Kanzlei', 'Bürohaus', 'Bürokomplex', 'Büroturm', 'Wolkenkratzer'] };
      const spec = { farm: 'Bauernhof', mine: 'Bergwerk', forest: 'Forstbetrieb', oil: 'Ölförderung' }[b.spec];
      const nm = spec || (names[b.zone] || [])[b.level] || ZONE_INFO[b.zone].name;
      if (b.abandoned) return `${nm} · verlassen`;
      if (b.construct < 1) return `${nm} · im Bau ${Math.round(b.construct * 100)} %`;
      return `${nm} · ${b.occ}/${b.cap} ${b.zone === 1 ? 'Bewohner' : 'Jobs'} · ${Math.round(b.happy)} % Glück`;
    }
    const d = BUILDINGS[b.key];
    return d ? d.name + (b.construct < 1 ? ` · im Bau ${Math.round(b.construct * 100)} %` : '') : null;
  }

  buildingHeight(b) {
    const bv = this.e.buildings;
    if (bv && bv.heightOf) { const h = bv.heightOf(b); if (h) return h; }
    if (b.zone) {
      const base = [0, 0.7, 1.0, 1.4, 2.4, 5][b.level];
      return base;
    }
    return { tvtower: 6.5, wind: 2.6, coal: 2.4, incinerator: 2.3, hospital: 1.4, university: 1.5, stadium: 1, fusion: 1.7, lighthouse: 2.4, ferris: 2, townhall: 2.1 }[b.key] || 0.9;
  }

  nextLineColor() {
    const used = new Set(this.g.transit.lines.map((l) => l.color));
    let c = 0;
    while (used.has(c) && c < 9) c++;
    return c;
  }

  linePreviewPoints(t) {
    const g = this.g;
    const stops = this.lineStops.map((id) => g.transit.stations.get(id)).filter(Boolean);
    if (this.tool.kind === 'extend' && !stops.length) {
      const line = g.transit.lines.find((l) => l.id === this.tool.line);
      if (line) {
        const end = g.transit.stations.get(this.tool.atStart ? line.stops[0] : line.stops[line.stops.length - 1]);
        if (end) stops.push(end);
      }
    }
    const pts = [];
    const push = (x, y) => pts.push([x + 0.5 - g.W / 2, y + 0.5 - g.H / 2]);
    const seq = stops.map((s) => [s.x, s.y]);
    if (t && t.i >= 0) seq.push([t.x, t.y]);
    for (let k = 0; k < seq.length; k++) {
      const [x, y] = seq[k];
      if (k > 0) {
        const [px, py] = seq[k - 1];
        const dx = x - px, dy = y - py;
        const d = Math.min(Math.abs(dx), Math.abs(dy));
        if (d > 0 && Math.abs(dx) !== Math.abs(dy)) {
          if ((k - 1) % 2 === 0) push(px + Math.sign(dx) * d, py + Math.sign(dy) * d);
          else push(x - Math.sign(dx) * d, y - Math.sign(dy) * d);
        }
      }
      push(x, y);
    }
    return pts;
  }

  // ---------- Aktionen
  applyDrag(d = this.drag) {
    const g = this.g, k = this.tool.kind;
    let res;
    if (k === 'road') res = g.buildRoad(this.roadTiles(d), this.tool.type);
    else if (k === 'zone') res = g.zoneTiles(this.rectTiles(d), this.tool.zone);
    else if (k === 'dezone') res = g.zoneTiles(this.rectTiles(d), 0);
    else if (k === 'bulldoze') res = g.bulldoze(this.rectTiles(d));
    if (!res) return false;
    if (res.ok) {
      this.audio.play(k === 'bulldoze' ? 'demolish' : k === 'road' ? 'road' : 'zone');
      if (res.cost) this.ui.floatMoney(-res.cost, this.mouse);
    } else {
      this.audio.play('error');
      this.ui.toast(res.msg, 'bad');
    }
    return !!res.ok;
  }

  // Trinkwasser und Abwasser (S2/Q2): Pumpwerk nicht neben verschmutztes Wasser, Auslass nicht oberhalb eines Pumpwerks
  waterWarning(key, x, y, w, h) {
    const g = this.g;
    const C = g.ext && g.ext.citizens;
    if (key === 'pump' || key === 'waterworks') {
      const pol = C && C.waterPol;
      if (!pol) return '';
      let m = 0;
      for (let yy = y - 1; yy <= y + h; yy++) for (let xx = x - 1; xx <= x + w; xx++) {
        if (xx < 0 || yy < 0 || xx >= g.W || yy >= g.H) continue;
        m = Math.max(m, pol[yy * g.W + xx] || 0);
      }
      return m > 0.1 ? 'Achtung: Hier ist das Wasser verschmutzt.' : '';
    }
    if (key === 'sewage_outlet') {
      for (const b of g.buildings.values()) {
        if ((b.key === 'pump' || b.key === 'waterworks') && Math.hypot(b.x - x, b.y - y) < 20) return 'Achtung: Ein Pumpwerk in der Nähe fördert dann verschmutztes Wasser.';
      }
    }
    return '';
  }

  placeAt(t, quiet = false) {
    const g = this.g;
    const key = this.tool.key;
    const [w, h] = g.footprint(key, this.rot);
    const x = t.x - Math.floor((w - 1) / 2), y = t.y - Math.floor((h - 1) / 2);
    const res = g.placeBuilding(key, x, y, this.rot);
    if (res.ok) {
      this.audio.play('place');
      this.ui.floatMoney(-res.cost, this.mouse);
      if (BUILDINGS[key].unique) this.setTool({ kind: 'select' });
      if (key === 'station' && res.station) this.ui.toast(`Station ${res.station.name} gebaut. Mit dem Linien-Werkzeug verbinden.`, 'info');
    } else {
      this.audio.play('error');
      this.ui.toast(res.msg, 'bad');
    }
    if (!quiet) this.updateHover();
    return !!res.ok;
  }

  selectAt(t) {
    const g = this.g;
    const b = g.buildings.get(g.bld[t.i]);
    const st = g.transit.stations.get(g.stationAt[t.i]);
    if (st) { this.ui.inspect({ type: 'station', id: st.id }); this.audio.play('click'); }
    else if (b) { this.ui.inspect({ type: 'building', id: b.id }); this.audio.play('click'); }
    else if (g.road[t.i]) this.ui.inspect({ type: 'road', i: t.i });
    else this.ui.inspect({ type: 'tile', i: t.i });
  }

  lineClick(t) {
    const g = this.g;
    let st = g.transit.stations.get(g.stationAt[t.i]);
    if (!st) {
      const err = g.transit.canPlaceStation(t.x, t.y);
      if (err) { this.ui.toast(err, 'bad'); this.audio.play('error'); return; }
      const res = g.placeBuilding('station', t.x, t.y, 0);
      if (!res.ok) { this.ui.toast(res.msg, 'bad'); this.audio.play('error'); return; }
      st = res.station;
      this.ui.floatMoney(-res.cost, this.mouse);
    }
    if (this.tool.kind === 'extend') {
      const line = g.transit.lines.find((l) => l.id === this.tool.line);
      if (!line) { this.setTool({ kind: 'select' }); return; }
      const res = g.extendLine(line.id, st.id, this.tool.atStart);
      if (res.ok) {
        this.audio.play('line');
        if (res.cost) this.ui.floatMoney(-res.cost, this.mouse);
        if (res.closed) this.setTool({ kind: 'select' });
      } else { this.ui.toast(res.msg || 'Geht nicht.', 'bad'); this.audio.play('error'); }
      this.updateHover();
      return;
    }
    if (this.lineStops.length >= 3 && st.id === this.lineStops[0]) { this.finishLine(true); return; }
    if (this.lineStops.includes(st.id)) return;
    this.lineStops.push(st.id);
    this.audio.play('click');
    this.updateHover();
  }

  finishLine(loop = false) {
    const g = this.g;
    if (this.tool.kind === 'extend') { this.setTool({ kind: 'select' }); return; }
    if (this.lineStops.length < 2) { this.lineStops = []; this.e.overlay.showLinePreview(null); return; }
    const res = g.createLine(this.lineStops, loop);
    if (res.ok) {
      this.audio.play('line');
      this.ui.floatMoney(-res.cost, this.mouse);
      this.ui.toast(`Neue Linie mit ${res.line.stops.length} Stationen eröffnet.`, 'good');
      this.ui.openPanel('transit');
    } else {
      this.audio.play('error');
      this.ui.toast(res.msg, 'bad');
    }
    this.lineStops = [];
    this.e.overlay.showLinePreview(null);
  }
}
