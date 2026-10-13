// Werkzeug „district" (Besitzer S2): Bezirke malen, Blöcke füllen, radieren.
// Werkzeug-Objekt: { kind: 'district', type: 'paint' | 'new' | 'fill' | 'erase' }
//   paint – Strich beginnt in einem Bezirk: dieser wächst; sonst wächst der aktive Bezirk (oder ein neuer entsteht)
//   new   – der nächste Strich legt einen neuen Bezirk an (danach weiter wie paint)
//   fill  – Klick füllt den Straßenblock unter dem Zeiger
//   erase – entfernt Bezirksflächen (auch: Umschalt gedrückt halten)
// Tasten: , und . (oder [ ]) ändern die Pinselgröße, X schaltet zwischen Malen und Radieren.
import { registerTool, TRAY_ITEMS } from '../registry.js';
import { MILESTONES } from '../config.js';
import { createDistrict, deleteDistrict, paintTiles, brushTiles, blockTiles, finishStroke, districtAt, districtsOf, MAX_DISTRICTS } from '../sim/systems/districts.js';

// Zustand des Werkzeugs (vom Panel „Bezirke" mitbenutzt)
export const districtTool = { brush: 3, active: 0, stroke: null };
export const BRUSH_MAX = 7;

const hexCss = (n) => '#' + n.toString(16).padStart(6, '0');
const lockText = (g) => (g.sandbox || g.milestone >= 1 ? null : `Ab „${MILESTONES[1].name}" (${MILESTONES[1].pop} Einwohner)`);

function modeOf(input, e) {
  const t = input.tool.type || 'paint';
  if (e && e.shiftKey && t !== 'fill') return 'erase';
  return t;
}
function activeDistrict(g) {
  const D = districtsOf(g);
  return D && D.byId[districtTool.active] ? D.byId[districtTool.active] : null;
}
function stampTiles(g, x, y, mode) {
  if (mode === 'fill') return blockTiles(g, y * g.W + x);
  return brushTiles(g, x, y, districtTool.brush - 1);
}
function showView(input) {
  // Die Ansicht „Bezirke" zeigt beim Malen Flächen und Namensschilder (render/views/districts.js)
  input.e._districtTool = true;
  input.e._districtPainting = !!districtTool.stroke;
}

// tiles: feste Felder statt Pinselabdruck (Bestätigungsmodus per Touch: Rechteck mit Griffen) – der Strich endet sofort
function startStroke(input, t, e, tiles = null) {
  const g = input.g;
  const D = districtsOf(g);
  if (lockText(g)) { input.ui.toast(lockText(g), 'bad'); input.audio.play('error'); return; }
  const mode = modeOf(input, e);
  let id = 0;
  if (mode !== 'erase') {
    const under = districtAt(g, t.i);
    let d = null;
    if (mode === 'new') d = null;
    else if (under && mode === 'paint') d = under;
    else d = activeDistrict(g);
    let created = false;
    if (!d) {
      if (D.list.length >= MAX_DISTRICTS) { input.ui.toast(`Höchstens ${MAX_DISTRICTS} Bezirke.`, 'bad'); input.audio.play('error'); return; }
      d = createDistrict(g);
      if (!d) return;
      created = true;
      if (mode === 'new') input.tool.type = 'paint';
    }
    id = d.id;
    districtTool.active = id;
    districtTool.created = created;
  }
  districtTool.stroke = { id, mode, x: t.x, y: t.y, changed: 0, created: !!districtTool.created };
  districtTool.created = false;
  districtTool.stroke.changed += paintTiles(g, id, tiles && mode !== 'fill' ? tiles : stampTiles(g, t.x, t.y, mode));
  if (!tiles && mode !== 'fill' && e && e.pointerId !== undefined) { try { input.e.canvas.setPointerCapture(e.pointerId); } catch (err) { /* egal */ } }
  if (mode === 'fill' || tiles) endStroke(input);
}

// Bestätigungsmodus (Touch): Malen/Radieren als Rechteck mit Griffen, Füllen als Punkt – gemalt wird erst mit ✓
function pendTiles(input, p) {
  const g = input.g;
  if (p.kind === 'point') return blockTiles(g, p.y * g.W + p.x);
  const x0 = Math.min(p.sx, p.ex), x1 = Math.max(p.sx, p.ex), y0 = Math.min(p.sy, p.ey), y1 = Math.max(p.sy, p.ey);
  const out = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push(y * g.W + x);
  return out;
}
function pendPreview(input, p) {
  const g = input.g, ov = input.e.overlay;
  showView(input);
  const mode = modeOf(input, null);
  const tiles = pendTiles(input, p);
  const i0 = p.kind === 'point' ? p.y * g.W + p.x : p.sy * g.W + p.sx;
  const under = districtAt(g, i0);
  const act = activeDistrict(g);
  const target = mode === 'erase' || mode === 'new' ? null : under && mode === 'paint' ? under : act;
  ov.showTiles(tiles.map((i) => ({ i, color: mode === 'erase' ? 0xff5a4a : target ? target.color : 0xffffff })));
  const lock = lockText(g);
  const n = tiles.length;
  const title = mode === 'erase' ? 'Bezirk radieren' : target ? target.name : 'Neuer Bezirk';
  const reason = lock || (!n ? (mode === 'fill' ? 'Hier gibt es keinen Block (freies Feld zwischen Straßen antippen)' : 'Keine Felder') : '');
  return { title, sub: `${n} ${n === 1 ? 'Feld' : 'Felder'}`, ok: !reason, reason, okLabel: mode === 'erase' ? 'Radieren' : mode === 'fill' ? 'Füllen' : 'Malen', price: '' };
}
function pendApply(input, p) {
  const t = p.kind === 'point' ? { x: p.x, y: p.y, i: p.y * input.g.W + p.x } : { x: p.sx, y: p.sy, i: p.sy * input.g.W + p.sx };
  startStroke(input, t, null, p.kind === 'point' ? null : pendTiles(input, p));
  input.e._districtPainting = false;
  return true;
}
function continueStroke(input, t) {
  const s = districtTool.stroke;
  if (!s || s.mode === 'fill') return;
  const g = input.g;
  const x = Math.max(0, Math.min(g.W - 1, t.x)), y = Math.max(0, Math.min(g.H - 1, t.y));
  const dx = x - s.x, dy = y - s.y;
  const n = Math.max(Math.abs(dx), Math.abs(dy));
  for (let k = 1; k <= n; k++) {
    const px = Math.round(s.x + (dx * k) / n), py = Math.round(s.y + (dy * k) / n);
    s.changed += paintTiles(g, s.id, stampTiles(g, px, py, s.mode));
  }
  s.x = x; s.y = y;
}
function endStroke(input) {
  const s = districtTool.stroke;
  districtTool.stroke = null;
  if (!s) return;
  const g = input.g;
  // Ein neu angelegter Bezirk ohne gemalte Felder verschwindet wieder
  if (s.id && s.created && !s.changed) { deleteDistrict(g, s.id); districtTool.active = 0; }
  else if (s.id) finishStroke(g, s.id); else finishStroke(g, -1);
  if (s.changed) {
    input.audio.play(s.mode === 'erase' ? 'demolish' : 'zone');
    const d = s.id ? districtsOf(g).byId[s.id] : null;
    if (d && s.mode !== 'erase') input.ui.toast(`${d.name}: ${s.changed} Felder ${s.mode === 'fill' ? 'gefüllt' : 'gemalt'}.`, 'good');
  } else if (s.mode === 'fill') {
    input.ui.toast('Hier gibt es keinen Block zum Füllen (auf ein freies Feld zwischen Straßen klicken).', 'bad');
  }
  if (input.ui.panel === 'districts') input.ui.renderPanel();
}

function preview(input, t) {
  const g = input.g, ov = input.e.overlay;
  showView(input);
  if (!t || t.i < 0) { ov.clearTiles(); input.ui.tooltip(null); return; }
  const mode = modeOf(input, input._lastEvt);
  const tiles = stampTiles(g, t.x, t.y, mode);
  const under = districtAt(g, t.i);
  const act = activeDistrict(g);
  const target = mode === 'erase' ? null : mode === 'new' ? null : (under && mode === 'paint' ? under : act);
  const col = mode === 'erase' ? 0xff5a4a : target ? target.color : 0xffffff;
  ov.showTiles(tiles.map((i) => ({ i, color: col })));
  const lock = lockText(g);
  let txt;
  if (lock) txt = `Bezirke · ${lock}`;
  else if (mode === 'erase') txt = `Bezirk radieren · Pinsel ${districtTool.brush}${under ? ` · ${under.name}` : ''}`;
  else if (mode === 'fill') txt = tiles.length ? `Block füllen: ${tiles.length} Felder → ${target ? target.name : 'neuer Bezirk'}` : 'Auf ein freies Feld zwischen Straßen klicken';
  else if (mode === 'new') txt = `Neuer Bezirk · Pinsel ${districtTool.brush} · ziehen zum Malen`;
  else txt = `${target ? target.name : 'Neuer Bezirk'} · Pinsel ${districtTool.brush} · ziehen zum Malen`;
  if (!lock && mode !== 'fill') txt += ' · [,] [.] Größe · Umschalt: radieren';
  input.ui.tooltip(txt, input.mouse, !lock);
}

registerTool('district', {
  down(input, t, e) { input._lastEvt = e; startStroke(input, t, e); preview(input, t); },
  move(input, t, e) { input._lastEvt = e; if (districtTool.stroke) continueStroke(input, t); },
  up(input, t, e) { input._lastEvt = e; if (districtTool.stroke) { continueStroke(input, t); endStroke(input); } preview(input, t); },
  hover(input, t) { preview(input, t); },
  pendKind(input) { return (input.tool.type || 'paint') === 'fill' ? 'point' : 'rect'; },
  pendPreview,
  pendApply,
  cancel(input) {
    if (districtTool.stroke) endStroke(input);
    input.e._districtTool = false;
    input.e._districtPainting = false;
    input.e.overlay.clearTiles();
  },
  key(input, e) {
    if (e.code === 'Comma' || e.code === 'BracketLeft' || e.code === 'NumpadDivide') { districtTool.brush = Math.max(1, districtTool.brush - 1); if (input.hover) preview(input, input.hover); return true; }
    if (e.code === 'Period' || e.code === 'BracketRight' || e.code === 'NumpadMultiply') { districtTool.brush = Math.min(BRUSH_MAX, districtTool.brush + 1); if (input.hover) preview(input, input.hover); return true; }
    if (e.code === 'KeyX') { input.tool.type = input.tool.type === 'erase' ? 'paint' : 'erase'; if (input.hover) preview(input, input.hover); input.ui.toolChanged(input.tool); return true; }
    if (e.code === 'Escape' && districtTool.stroke) { endStroke(input); return true; }
    return false;
  },
});

// Werkzeugleiste: Reiter „Bezirke" in der Gruppe „Zonen" (erscheint, sobald Bezirke freigeschaltet sind)
const item = (type, name, desc) => (g) => {
  const D = districtsOf(g);
  const act = D && D.byId[districtTool.active];
  const color = type === 'erase' ? '#9a9a9a' : act && type !== 'new' ? hexCss(act.color) : '#8f5ad8';
  return { kind: 'tool', key: 'district', type, name, cost: 'kostenlos', desc, color, locked: lockText(g) };
};
TRAY_ITEMS.push(
  { cat: 'districts', item: item('paint', 'Bezirk malen', 'Mit dem Pinsel Bezirke malen. Beginnt der Strich in einem Bezirk, wächst dieser. [,] [.] ändern die Pinselgröße.') },
  { cat: 'districts', item: item('fill', 'Block füllen', 'Ein Klick füllt den Straßenblock unter dem Zeiger mit dem aktiven Bezirk.') },
  { cat: 'districts', item: item('new', 'Neuer Bezirk', 'Der nächste Pinselstrich gründet einen neuen Bezirk mit eigenem Namen und eigenen Verordnungen.') },
  { cat: 'districts', item: item('erase', 'Bezirk radieren', 'Entfernt Bezirksflächen. Beim Malen geht das auch mit gedrückter Umschalttaste.') },
);
