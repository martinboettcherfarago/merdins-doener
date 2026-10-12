// Werkzeug „buslines" (Agent S3): Bus- und Straßenbahnlinien zeichnen, verlängern, Haltestellen einfügen/entfernen, Ampeln schalten.
// registerTool(kind, { down, move, up, hover, cancel, key }) · t = Feld unter dem Zeiger {x, y, i, wx, wz}
// input.tool = { kind: 'buslines', type: 'bus' | 'tram' | 'extend' | 'stop' | 'signal', line?, atStart? }
// Bedienung: Haltestellen nacheinander an Straßen anklicken. Erneuter Klick auf die letzte Haltestelle, Enter,
// Doppelklick oder Rechtsklick beendet die Linie; Klick auf die erste Haltestelle schließt einen Ring.
// Rücktaste nimmt die letzte Haltestelle zurück, Esc verwirft.
import { registerTool, TRAY_ITEMS, emit } from '../registry.js';
import * as TPS from '../sim/systems/transport.js';
import { fmtMoney } from '../util.js';

const S = { tool: null, tiles: [], segs: [], canvas: null, rightAt: 0 };
const TOOL_COLORS = { bus: 0x1c7ed6, tram: 0xc92a2a };

function mode(input) {
  const t = input.tool;
  if (t.type === 'extend') { const l = TPS.lineById(input.g, t.line); return l ? l.mode : 'bus'; }
  return t.type || 'bus';
}
function drawing(input) { const k = input.tool.type || 'bus'; return k === 'bus' || k === 'tram' || k === 'extend'; }

function ensure(input) {
  if (S.canvas !== input.e.canvas) {
    S.canvas = input.e.canvas;
    S.canvas.addEventListener('pointerdown', (e) => { if (e.button === 2) S.rightAt = performance.now(); }, true);
  }
  if (S.tool === input.tool) return;
  S.tool = input.tool;
  S.tiles = [];
  S.segs = [];
  const type = input.tool.type || 'bus';
  const ui = input.ui;
  if (ui && ui.view === 'none') ui.setView(type === 'signal' ? 'traffic' : 'ptransport', true);
  if (type === 'extend') {
    const l = TPS.lineById(input.g, input.tool.line);
    if (l) { const st = TPS.stopById(input.g, input.tool.atStart ? l.stops[0] : l.stops[l.stops.length - 1]); if (st) S.anchor = st.tile; }
  } else S.anchor = -1;
  emit('transport:tool', { active: true, type });
}

// Feste Kette: Anker (beim Verlängern) + gewählte Haltestellen
function chain() { return S.anchor >= 0 && S.tool && S.tool.type === 'extend' ? [S.anchor, ...S.tiles] : S.tiles; }

function color(input) {
  if (input.tool.type === 'extend') { const l = TPS.lineById(input.g, input.tool.line); if (l) return TPS.lineColor(l); }
  return TOOL_COLORS[mode(input)] || 0x1c7ed6;
}

function estimate(input, tiles, extraLen = 0, extraNew = 0) {
  const g = input.g, m = mode(input), T = TPS.TS(g);
  let len = extraLen, tracks = 0;
  for (const p of S.segs) { len += p.length - 1; if (m === 'tram') for (const t of p) if (!T.trackTiles.has(t)) tracks++; }
  let fresh = extraNew;
  for (const t of tiles) if (!TPS.stopAtTile(g, t)) fresh++;
  const ext = input.tool.type === 'extend';
  const veh = ext || (T.free[m] || 0) > 0 ? 0 : TPS.VEHICLE_TYPES[m === 'tram' ? 'tram' : 'bus'].cost;
  return Math.round(((ext ? 0 : TPS.TP.lineCost[m]) + len * TPS.TP.tileCost.bus + tracks * (m === 'tram' ? TPS.TP.tileCost.tram : 0) + fresh * TPS.TP.stopCost + veh) * g.costMul);
}

function sendPreview(input, hover, hoverPath, ok) {
  emit('transport:preview', { tiles: chain(), segs: S.segs, hover, hoverPath, ok, color: color(input), mode: mode(input) });
}

function finish(input, loop = false, fromCancel = false) {
  const g = input.g, tool = input.tool;
  if (tool.type === 'extend') {
    if (!S.tiles.length) { if (!fromCancel) input.setTool({ kind: 'select' }); return; }
    const r = TPS.extendLine(g, tool.line, S.tiles, tool.atStart);
    if (r.ok) {
      input.audio.play('line');
      if (r.cost) input.ui.floatMoney(-r.cost, input.mouse);
      input.ui.toast(`Linie um ${S.tiles.length} Haltestelle${S.tiles.length > 1 ? 'n' : ''} verlängert.`, 'good');
      S.tiles = []; S.segs = [];
      if (!fromCancel) input.setTool({ kind: 'select' });
      input.ui.openPanel('transport');
    } else { input.audio.play('error'); input.ui.toast(r.msg || 'Geht nicht.', 'bad'); }
    return;
  }
  if (S.tiles.length < 2) { input.ui.toast('Eine Linie braucht mindestens zwei Haltestellen.', 'bad'); return; }
  const r = TPS.createLine(g, mode(input), S.tiles, loop);
  if (r.ok) {
    input.audio.play('line');
    if (r.cost) input.ui.floatMoney(-r.cost, input.mouse);
    S.tiles = []; S.segs = [];
    sendPreview(input, -1, null, true);
    input.ui.openPanel('transport');
    emit('transport:panelTab', 'lines');
  } else { input.audio.play('error'); input.ui.toast(r.msg, 'bad'); }
}

function clickDraw(input, t) {
  const g = input.g, m = mode(input);
  const i = t.i;
  const st = TPS.stopAtTile(g, i);
  const ch = chain();
  if (st || (ch.length && i === ch[ch.length - 1])) {
    if (S.tiles.length && i === S.tiles[S.tiles.length - 1]) { finish(input); return; }
    if (input.tool.type !== 'extend' && S.tiles.length >= 3 && i === S.tiles[0]) {
      // Ring schließen
      const back = TPS.routeTiles(g, S.tiles[S.tiles.length - 1], i, m);
      if (!back) { input.ui.toast('Kein Weg zurück zur ersten Haltestelle.', 'bad'); input.audio.play('error'); return; }
      finish(input, true);
      return;
    }
    if (ch.includes(i)) { input.ui.toast('Diese Haltestelle ist schon auf der Linie.', 'bad'); input.audio.play('error'); return; }
    // Bestehende Bushaltestelle für die Straßenbahn: nur an Straßen und Alleen
    if (m === 'tram' && st) { const e2 = TPS.canStop(g, i, 'tram'); if (e2 && e2.startsWith('Straßenbahnen')) { input.ui.toast(e2, 'bad'); input.audio.play('error'); return; } }
  } else {
    const err = TPS.canStop(g, i, m);
    if (err) { input.ui.toast(err, 'bad'); input.audio.play('error'); return; }
  }
  if (ch.length) {
    const p = TPS.routeTiles(g, ch[ch.length - 1], i, m);
    if (!p) { input.ui.toast(m === 'tram' ? 'Kein Gleisweg dorthin (nur über Straßen und Alleen).' : 'Keine Straßenverbindung dorthin.', 'bad'); input.audio.play('error'); return; }
    S.segs.push(p);
  }
  if (S.tiles.length >= TPS.TP.maxStops) { input.ui.toast(`Höchstens ${TPS.TP.maxStops} Haltestellen.`, 'bad'); return; }
  S.tiles.push(i);
  input.audio.play('click');
}

function hoverDraw(input, t) {
  const g = input.g, m = mode(input), ui = input.ui;
  const i = t.i;
  const ch = chain();
  const st = TPS.stopAtTile(g, i);
  let ok = true, txt = '', hp = null;
  if (i < 0) { sendPreview(input, -1, null, false); ui.tooltip(null); return; }
  const err = st ? null : TPS.canStop(g, i, m);
  if (ch.length && (st || !err)) {
    hp = ch[ch.length - 1] === i ? null : TPS.routeTiles(g, ch[ch.length - 1], i, m);
    if (!hp && ch[ch.length - 1] !== i) { ok = false; txt = m === 'tram' ? 'Kein Gleisweg (nur Straßen und Alleen)' : 'Keine Straßenverbindung'; }
  }
  const label = m === 'tram' ? 'Straßenbahn' : 'Bus';
  if (!txt) {
    if (err && !st) { ok = false; txt = err; }
    else if (S.tiles.length && i === S.tiles[S.tiles.length - 1]) txt = `${label}: Linie fertigstellen · ${fmtMoney(estimate(input, S.tiles))}`;
    else if (input.tool.type !== 'extend' && S.tiles.length >= 3 && i === S.tiles[0]) txt = `${label}: Ring schließen`;
    else {
      const n = S.tiles.length + 1;
      const name = st ? st.name : 'neue Haltestelle';
      const cost = estimate(input, [...S.tiles, i], hp ? hp.length - 1 : 0, 0);
      txt = input.tool.type === 'extend' ? `Verlängern bis ${name} · ${fmtMoney(cost)}` : n === 1 ? `${label}linie beginnen: ${name}` : `Halt ${n}: ${name} · Linie ≈ ${fmtMoney(cost)}`;
      if (S.tiles.length >= 1) txt += ' · Enter/Rechtsklick: fertig';
    }
    // Einzugsgebiet der geplanten Linie
    const c = TPS.catchmentOf(g, ok && !(S.tiles.length && i === S.tiles[S.tiles.length - 1]) ? [...chain(), i] : chain());
    if (c.res + c.jobs > 0) txt += ` · erreicht ${c.res.toLocaleString('de-DE')} Bewohner, ${c.jobs.toLocaleString('de-DE')} Jobs${c.lm ? `, ${c.lm} Ausflugsziel${c.lm > 1 ? 'e' : ''}` : ''}`;
  }
  sendPreview(input, i, hp, ok);
  if (i >= 0) input.e.overlay.showRadius(t.x + 0.5 - g.W / 2, t.y + 0.5 - g.H / 2, TPS.TP.stopRadius, ok ? 0x9cf0b0 : 0xff8070);
  ui.tooltip(txt, input.mouse, ok);
}

function hoverStop(input, t) {
  const g = input.g;
  const st = TPS.stopAtTile(g, t.i);
  if (st) {
    const lines = st.lines.map((id) => TPS.lineById(g, id)).filter(Boolean).map(TPS.lineLabel).join(', ');
    input.ui.tooltip(`${st.name} (${lines || 'keine Linie'}) · Klicken: Haltestelle entfernen`, input.mouse, true);
    sendPreview(input, t.i, null, true);
    return;
  }
  const onLine = TPS.TS(g).lines.filter((l) => l.path && l.path.includes(t.i));
  if (!onLine.length) { input.ui.tooltip('Auf einen Linienweg klicken, um dort eine Haltestelle einzufügen', input.mouse, false); sendPreview(input, t.i, null, false); return; }
  const err = TPS.canStop(g, t.i, onLine.some((l) => l.mode === 'bus') ? 'bus' : 'tram');
  input.ui.tooltip(err || `Haltestelle einfügen in ${onLine.map(TPS.lineLabel).join(', ')} · ${fmtMoney(TPS.TP.stopCost * g.costMul)}`, input.mouse, !err);
  sendPreview(input, t.i, null, !err);
  if (!err) input.e.overlay.showRadius(t.x + 0.5 - g.W / 2, t.y + 0.5 - g.H / 2, TPS.TP.stopRadius, 0x9cf0b0);
}

function hoverSignal(input, t) {
  const g = input.g;
  const s = TPS.signalState(g, t.i);
  if (!s.possible) { input.ui.tooltip('Ampeln gibt es nur an Kreuzungen', input.mouse, false); input.e.overlay.showTiles([{ i: t.i, color: 0xff7060 }]); return; }
  const load = g.road[t.i] ? Math.round((g.trafficLoad[t.i] / 650) * 100) : 0;
  const now = s.on ? 'Ampel an' : 'keine Ampel';
  const next = s.mode === 'auto' ? 'immer an' : s.mode === 'an' ? 'immer aus' : 'automatisch';
  input.ui.tooltip(`${now} (${s.mode === 'auto' ? 'automatisch' : 'von Hand'}) · Verkehr ${load} % · Klicken: ${next}`, input.mouse, true);
  input.e.overlay.showTiles([{ i: t.i, color: s.on ? 0x45c46b : 0xf2c230 }]);
}

registerTool('buslines', {
  down(input) { ensure(input); },
  move(input) { ensure(input); },
  hover(input, t) {
    ensure(input);
    const type = input.tool.type || 'bus';
    if (type === 'stop') hoverStop(input, t);
    else if (type === 'signal') hoverSignal(input, t);
    else hoverDraw(input, t);
  },
  up(input, t) {
    ensure(input);
    if (t.i < 0) return;
    const g = input.g;
    const type = input.tool.type || 'bus';
    if (drawing(input)) {
      if (!TPS.modeUnlocked(g, mode(input))) { input.ui.toast(TPS.modeLockReason(g, mode(input)), 'bad'); return; }
      clickDraw(input, t);
      this.hover(input, t);
      return;
    }
    if (type === 'stop') {
      const st = TPS.stopAtTile(g, t.i);
      if (st) {
        const r = TPS.removeStop(g, st.id);
        if (r.ok) { input.audio.play('demolish'); input.ui.toast(`Haltestelle ${st.name} entfernt.${r.removedLines.length ? ` ${r.removedLines.map(TPS.lineLabel).join(', ')} eingestellt.` : ''}`, r.removedLines.length ? 'bad' : ''); }
      } else {
        const r = TPS.insertStop(g, t.i);
        if (r.ok) { input.audio.play('place'); input.ui.floatMoney(-r.cost, input.mouse); input.ui.toast(`Haltestelle ${r.stop.name} eingefügt.`, 'good'); }
        else { input.audio.play('error'); input.ui.toast(r.msg, 'bad'); }
      }
      this.hover(input, t);
      return;
    }
    if (type === 'signal') {
      const r = TPS.cycleSignal(g, t.i);
      if (r.ok) { input.audio.play('click'); input.ui.toast(r.state.mode === 'auto' ? `Ampel automatisch (${r.state.on ? 'an' : 'aus'})` : r.state.mode === 'an' ? 'Ampel immer an' : 'Ampel immer aus'); }
      else { input.audio.play('error'); input.ui.toast(r.msg, 'bad'); }
      this.hover(input, t);
    }
  },
  key(input, e) {
    ensure(input);
    if (!drawing(input)) return false;
    if (e.code === 'Escape' && S.tiles.length) { S.tiles = []; S.segs = []; sendPreview(input, -1, null, true); return true; }
    if (e.code === 'Enter' || e.code === 'NumpadEnter') { finish(input); return true; }
    if (e.code === 'Backspace' && S.tiles.length) { S.tiles.pop(); S.segs.pop(); if (input.hover) this.hover(input, input.hover); return true; }
    return false;
  },
  cancel(input) {
    if (S.cancelling) return;
    S.cancelling = true;
    try {
      // Rechtsklick (Kern wechselt dann zum Auswahl-Werkzeug): Linie fertigstellen
      if (S.tool === input.tool && drawing(input) && performance.now() - S.rightAt < 900) {
        if (input.tool.type === 'extend' ? S.tiles.length >= 1 : S.tiles.length >= 2) finish(input, false, true);
      }
    } finally { S.cancelling = false; }
    S.tool = null; S.tiles = []; S.segs = [];
    emit('transport:preview', null);
    emit('transport:tool', { active: false });
    input.e.overlay.hideRadius();
  },
});

// ---------------------------------------------------------------- Werkzeugleiste (Kategorie Verkehr)
const lockBus = (g) => (TPS.modeUnlocked(g, 'bus') ? null : TPS.modeLockReason(g, 'bus'));
TRAY_ITEMS.push({ cat: 'transport', item: (g) => ({ kind: 'tool', key: 'buslines', type: 'bus', name: 'Buslinie zeichnen', cost: `ab ${fmtMoney((TPS.TP.lineCost.bus + TPS.VEHICLE_TYPES.bus.cost) * g.costMul)}`, desc: 'Haltestellen nacheinander an Straßen anklicken. Busse fahren über die Straßen und halten. Braucht ein Busdepot.', facts: `Halt ${fmtMoney(TPS.TP.stopCost * g.costMul)} · Bus ${fmtMoney(TPS.VEHICLE_TYPES.bus.cost * g.costMul)} · Radius ${TPS.TP.stopRadius}`, color: '#1c7ed6', locked: lockBus(g) }) });
TRAY_ITEMS.push({ cat: 'transport', item: (g) => ({ kind: 'tool', key: 'buslines', type: 'tram', name: 'Straßenbahn zeichnen', cost: `ab ${fmtMoney((TPS.TP.lineCost.tram + TPS.VEHICLE_TYPES.tram.cost) * g.costMul)}`, desc: 'Gleise auf Straßen und Alleen: 110 Plätze pro Zug, hebt den Bodenwert. Braucht ein Straßenbahndepot.', facts: `Gleis ${fmtMoney(TPS.TP.tileCost.tram * g.costMul)}/Feld · Zug ${fmtMoney(TPS.VEHICLE_TYPES.tram.cost * g.costMul)}`, color: '#c92a2a', locked: TPS.modeUnlocked(g, 'tram') ? null : TPS.modeLockReason(g, 'tram') }) });
TRAY_ITEMS.push({ cat: 'transport', item: (g) => ({ kind: 'tool', key: 'buslines', type: 'stop', name: 'Haltestelle einfügen', cost: fmtMoney(TPS.TP.stopCost * g.costMul), desc: 'Auf einen Linienweg klicken fügt eine Haltestelle ein, Klick auf eine Haltestelle entfernt sie.', color: '#2b8a3e', locked: lockBus(g) }) });
TRAY_ITEMS.push({ cat: 'transport', item: (g) => ({ kind: 'tool', key: 'buslines', type: 'signal', name: 'Ampeln schalten', cost: 'kostenlos', desc: 'Kreuzung anklicken: automatisch → immer an → immer aus. Ampeln kosten Zeit, verhindern aber Unfälle.', facts: `${(TPS.TS(g) || { signals: [] }).signals.length} Ampeln in Betrieb`, color: '#f08c00', locked: g.milestone >= 1 || g.sandbox ? null : g.lockReason('bus_depot') }) });
TRAY_ITEMS.push({ cat: 'transport', item: (g) => { const T = TPS.TS(g); return { kind: 'panel', panel: 'transport', name: 'Verkehr verwalten', cost: T ? `${T.lines.length} Linien` : '', desc: 'Linien, Fahrzeuge, Takt, Auslastung, Fernverkehr und Verkehrsstatistik.', color: '#364fc7', locked: null }; } });
