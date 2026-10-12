// Werkzeuge: Auswählen, Straßen ziehen, Zonen malen, Gebäude setzen, Abreißen, Pulsbahn-Linien zeichnen.
// Registrierte Werkzeuge (TOOLS[kind]) dürfen zusätzlich name, icon, hint(input) → Text und cursor (CSS) angeben.
// Im Fotomodus ruhen alle Werkzeuge. Auf Touch-Geräten setzt das Gebäude-Werkzeug erst beim zweiten Tippen.
import { BUILDINGS, ROADS, ZONE_INFO, TRANSIT, T } from './config.js';
import { fmtMoney } from './util.js';
import { LINE_COLORS } from './sim/transit.js';
import { TOOLS } from './registry.js';

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
    const c = engine.canvas;
    this.onDown = (e) => this.pointerDown(e);
    this.onMove = (e) => { this.lastMove = e; this.pointerMove(e); };
    this.onUp = (e) => this.pointerUp(e);
    this.onKey = (e) => this.key(e);
    this.onDbl = (e) => { if (this.tool.kind === 'line' || this.tool.kind === 'extend') this.finishLine(); void e; };
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('dblclick', this.onDbl);
    c.addEventListener('pointerleave', () => { this.ui.tooltip(null); });
    window.addEventListener('keydown', this.onKey);
  }

  dispose() {
    const c = this.e.canvas;
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('pointermove', this.onMove);
    c.removeEventListener('pointerup', this.onUp);
    c.removeEventListener('dblclick', this.onDbl);
    window.removeEventListener('keydown', this.onKey);
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
    const k = this.tool.kind;
    const reg = TOOLS[k];
    this.e.canvas.style.cursor = reg && reg.cursor ? reg.cursor : k === 'select' ? '' : k === 'bulldoze' ? 'crosshair' : k === 'place' ? 'copy' : 'crosshair';
    this.ui.toolChanged(this.tool);
    this.ui.tooltip(null);
    if (this.lastMove) this.pointerMove(this.lastMove);
  }

  cancelDrag() {
    this.drag = null;
    this.e.overlay.clearTiles();
  }

  key(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (TOOLS[this.tool.kind] && TOOLS[this.tool.kind].key && TOOLS[this.tool.kind].key(this, e)) return;
    if (e.code === 'Escape') {
      if (this.drag) this.cancelDrag();
      else if ((this.tool.kind === 'line' || this.tool.kind === 'extend') && this.lineStops.length) { this.lineStops = []; this.e.overlay.showLinePreview(null); }
      else if (this.tool.kind !== 'select') this.setTool({ kind: 'select' });
      else if (this.ui.cat) this.ui.closeTray();
      else this.ui.closePanels();
    } else if (e.code === 'KeyR' && this.tool.kind === 'place') {
      this.rot = (this.rot + 1) % 4;
      if (this.lastMove) this.pointerMove(this.lastMove);
    } else if (e.code === 'Enter' && (this.tool.kind === 'line' || this.tool.kind === 'extend')) {
      this.finishLine();
    } else if (e.code === 'KeyB' || e.code === 'Delete') {
      this.setTool({ kind: 'bulldoze' });
    }
  }

  photoActive() { return !!(this.ui.photo && this.ui.photo.active); }

  pointerDown(e) {
    if (this.e.rig.pinching || this.photoActive()) return;
    if (e.button === 2) {
      this.rightDown = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button !== 0 || e.altKey) return;
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
    if (this.photoActive()) return;
    if (e.button === 2) {
      const rd = this.rightDown;
      this.rightDown = null;
      if (rd && Math.hypot(e.clientX - rd.x, e.clientY - rd.y) < 5) {
        // Rechtsklick ohne Ziehen: abbrechen / Linie abschließen
        if (this.tool.kind === 'line' || this.tool.kind === 'extend') { if (this.lineStops.length) this.finishLine(); else this.setTool({ kind: 'select' }); }
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
  roadTiles() {
    const d = this.drag, W = this.g.W;
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

  rectTiles() {
    const d = this.drag, W = this.g.W;
    const x0 = Math.min(d.sx, d.ex), x1 = Math.max(d.sx, d.ex), y0 = Math.min(d.sy, d.ey), y1 = Math.max(d.sy, d.ey);
    const tiles = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tiles.push(y * W + x);
    return tiles;
  }

  updatePreview() {
    const g = this.g, ov = this.e.overlay, k = this.tool.kind;
    if (!this.drag) return;
    if (k === 'road') {
      const tiles = this.roadTiles();
      const plan = g.planRoad(tiles, this.tool.type);
      const inv = new Set(plan.invalid);
      ov.showTiles(tiles.map((i) => ({ i, color: inv.has(i) ? 0xff5040 : g.world.terrain[i] === T.WATER ? 0x7fd0ff : 0x9cf0b0 })));
      const bridges = plan.build.filter((i) => g.world.terrain[i] === T.WATER).length;
      const txt = plan.invalid.length ? 'Hindernis im Weg' : `${ROADS[this.tool.type].name}: ${plan.build.length} Felder${bridges ? ` (davon ${bridges} Brücke)` : ''} · ${fmtMoney(plan.cost)}`;
      this.ui.tooltip(txt, this.mouse, !plan.invalid.length && g.canAfford(plan.cost));
    } else if (k === 'zone' || k === 'dezone') {
      const tiles = this.rectTiles();
      const z = k === 'zone' ? this.tool.zone : 0;
      const plan = g.planZone(tiles, z);
      const ok = new Set(plan.apply);
      const col = z ? ZONE_INFO[z].color : 0xbbbbbb;
      ov.showTiles(tiles.filter((i) => ok.has(i)).map((i) => ({ i, color: col })));
      this.ui.tooltip(z ? `${ZONE_INFO[z].name}: ${plan.apply.length} Felder · ${fmtMoney(plan.cost)}` : `Zonen entfernen: ${plan.apply.length} Felder`, this.mouse, true);
    } else if (k === 'bulldoze') {
      const tiles = this.rectTiles();
      const p = g.planBulldoze(tiles);
      ov.showTiles(tiles.map((i) => ({ i, color: 0xff5a4a })));
      const parts = [];
      if (p.blds.length) parts.push(`${p.blds.length} Gebäude`);
      if (p.roads.length) parts.push(`${p.roads.length} Straßenfelder`);
      if (p.stations.length) parts.push(`${p.stations.length} Stationen`);
      if (p.trees) parts.push(`${p.trees} Wald`);
      this.ui.tooltip(parts.length ? `Abriss: ${parts.join(', ')} · ${p.net > 0 ? fmtMoney(p.net) : '+' + fmtMoney(-p.net)}` : 'Nichts abzureißen', this.mouse, true);
    }
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
      const key = this.tool.key;
      const def = BUILDINGS[key];
      const [w, h] = g.footprint(key, this.rot);
      const x = t.x - Math.floor((w - 1) / 2), y = t.y - Math.floor((h - 1) / 2);
      const err = g.checkPlace(key, x, y, this.rot);
      const cost = g.placeCost(key, x, y, this.rot);
      ov.showGhost(x, y, w, h, !err && g.canAfford(cost), key === 'station' ? TRANSIT.trackHeight + 0.5 : 0.6);
      const r = def.service ? def.service.radius : def.parkRadius || (key === 'station' ? TRANSIT.catchment : def.lvRadius || 0);
      if (r) ov.showRadius(x + w / 2 - g.W / 2, y + h / 2 - g.H / 2, r, def.service ? 0xffffff : 0x9cf0b0);
      else ov.hideRadius();
      this.ui.tooltip(err ? err : `${def.name} · ${fmtMoney(cost)}${w !== h ? ' · [R] drehen' : ''}`, this.mouse, !err && g.canAfford(cost));
      this.placePos = { x, y };
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

  // Kurzinfo für den Zeiger-Tooltip im Auswahlmodus
  hoverInfo(b, st) {
    if (e2e(this)) return null;
    if (st) return `${st.name} · ${st.waiting.length} wartend`;
    if (!b) return null;
    if (b.zone) {
      const names = { 1: ['', 'Häuschen', 'Einfamilienhaus', 'Stadthaus', 'Wohnblock', 'Wohnturm'], 2: ['', 'Kiosk', 'Ladenzeile', 'Kaufhaus', 'Geschäftshaus', 'Einkaufsturm'], 3: ['', 'Werkstatt', 'Fabrik', 'Werk', 'Großwerk', 'Hightech-Werk'], 4: ['', 'Kanzlei', 'Bürohaus', 'Bürokomplex', 'Büroturm', 'Wolkenkratzer'] };
      const spec = { farm: 'Bauernhof', mine: 'Bergwerk', forest: 'Forstbetrieb', oil: 'Ölfeld' }[b.spec];
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
  applyDrag() {
    const g = this.g, k = this.tool.kind;
    let res;
    if (k === 'road') res = g.buildRoad(this.roadTiles(), this.tool.type);
    else if (k === 'zone') res = g.zoneTiles(this.rectTiles(), this.tool.zone);
    else if (k === 'dezone') res = g.zoneTiles(this.rectTiles(), 0);
    else if (k === 'bulldoze') res = g.bulldoze(this.rectTiles());
    if (!res) return;
    if (res.ok) {
      this.audio.play(k === 'bulldoze' ? 'demolish' : k === 'road' ? 'road' : 'zone');
      if (res.cost) this.ui.floatMoney(-res.cost, this.mouse);
    } else {
      this.audio.play('error');
      this.ui.toast(res.msg, 'bad');
    }
  }

  placeAt(t) {
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
    this.updateHover();
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
