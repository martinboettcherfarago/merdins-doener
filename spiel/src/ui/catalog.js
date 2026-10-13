// Baukatalog: Einträge der Werkzeugleiste (Straßen, Zonen, Gebäude, Werkzeuge anderer Module) mit 3D-Vorschaubildern,
// Detailansicht und Suche über alle Kategorien. Einträge anderer Module kommen über TRAY_ITEMS:
// { cat, item(g) → { kind: 'tool', key, type?, name, cost, desc, color, locked, icon?, thumb?: { key, level, fw, fd } } }
import { BUILDINGS, CATEGORIES, ZONE_INFO, ROADS, R, TRANSIT, MILESTONES, ROAD_GEOM } from '../config.js';
import { fmtMoney, fmt } from '../util.js';
import { TRAY_ITEMS } from '../registry.js';
import { isBanned } from '../sim/systems/progression.js';
import { icon, iconAny } from './icons.js';
import { catMeta, catLabel, lineById } from './meta.js';
import { getThumb, thumbId, hasArch, onThumb, thumbFailed } from './thumbs.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const ZONE_DESC = {
  1: 'Hier ziehen Menschen ein. Braucht Strom, Wasser und Jobs in der Nähe.',
  2: 'Läden und Kaufhäuser. Leben von Kundschaft und Waren.',
  3: 'Fabriken schaffen Jobs, machen aber Abgase. Auf Acker, Wald, Erz oder Öl entstehen Bauernhöfe, Forstbetriebe, Bergwerke und Ölfelder.',
  4: 'Saubere Büros für gebildete Arbeitskräfte.',
};
const ZONE_THUMB = { 1: ['res', 2, 2], 2: ['com', 2, 1], 3: ['ind', 2, 3], 4: ['off', 3, 0] };

// --- kleine Modelle für Straßen (aus dem Baukasten, gleiche Optik wie die Gebäudebilder)
function roadModel(type) {
  return (kit, M) => {
    const g = ROAD_GEOM[type] || ROAD_GEOM[2];
    const len = 2;
    const w = g.width, side = (1 - w) / 2;
    kit.box('grass', 0, 0, 0, len, 0.04 * M, 1);
    kit.box('asphalt', 0, 0.02 * M, 0, len, 0.06 * M, w);
    for (const s of [-1, 1]) {
      kit.box('sidewalk', 0, 0, s * (w / 2 + side / 2), len, 0.18 * M, side * 0.92);
      kit.box('curb', 0, 0, s * (w / 2 + 0.01), len, 0.2 * M, 0.02);
    }
    if (g.median) {
      kit.box('grass', 0, 0.02 * M, 0, len, 0.22 * M, g.median);
      kit.box('curb', 0, 0.02 * M, 0, len, 0.24 * M, 0.012);
      for (let k = 0; k < 4; k++) kit.tree(-len / 2 + 0.25 + k * 0.5, 0, 0.75);
    }
    const lanes = g.lanes || 2;
    if (lanes >= 4) {
      for (const s of [-1, 1]) for (let k = 0; k < 7; k++) kit.box('runway_marking', -len / 2 + 0.15 + k * 0.29, 0.085 * M, s * (g.median / 2 + (w / 2 - g.median / 2) / 2), 0.12, 0.01 * M, 0.012);
    } else if (type !== R.LANE) {
      for (let k = 0; k < 7; k++) kit.box('runway_marking', -len / 2 + 0.15 + k * 0.29, 0.085 * M, 0, 0.13, 0.01 * M, 0.014);
    } else kit.box('pavers', 0, 0.02 * M, 0, len, 0.065 * M, w * 0.6);
    // Laternen
    for (const x of [-0.6, 0.6]) {
      kit.cyl('metal_dark', x, 0.18 * M, -(w / 2 + side * 0.5), 0.12 * M, 4.5 * M, { seg: 6 });
      kit.box('emissive_warm', x, 4.5 * M + 0.18 * M, -(w / 2 + side * 0.5) + 0.06, 0.4 * M, 0.25 * M, 0.9 * M);
    }
    if (type === R.LANE) { kit.tree(0.6, w / 2 + side * 0.5, 0.7); kit.hedge(-0.5, w / 2 + side * 0.55, 0.6, 0.06); }
  };
}

export function thumbSpecFor(it) {
  if (it.thumb === false) return null;
  if (it.thumb) return it.thumb;
  if (it.kind === 'road') return { id: 'road:' + it.type, build: roadModel(it.type), fw: 2, fd: 1, plain: true, yaw: 0.75, pitch: 0.62 };
  if (it.kind === 'zone') { const [key, level, variant] = ZONE_THUMB[it.zone] || ['res', 2, 0]; return { key, level, variant, fw: 1, fd: 1, extra: { zone: it.zone } }; }
  if (it.kind === 'place' && it.key) {
    const d = BUILDINGS[it.key];
    if (!d || !hasArch(it.key)) return null;
    return { key: it.key, level: 1, variant: 0, fw: d.size[0], fd: d.size[1] };
  }
  return null;
}

// Alle Einträge einer Kategorie
const countCache = new WeakMap();
function builtCounts(g) {
  const c = countCache.get(g);
  if (c && c.t === g.time && c.n === g.buildings.size) return c.m;
  const m = new Map();
  for (const b of g.buildings.values()) if (!b.zone) m.set(b.key, (m.get(b.key) || 0) + 1);
  countCache.set(g, { t: g.time, n: g.buildings.size, m });
  return m;
}

export function catalogItems(ui, cat) {
  const g = ui.g;
  const items = [];
  const meta = catMeta(cat);
  if (cat === 'roads') {
    for (const t of [R.LANE, R.STREET, R.AVENUE]) {
      const d = ROADS[t];
      const locked = t === R.AVENUE && !g.isUnlocked('avenue') ? g.lockReason('zone4') : null;
      items.push({ cat, kind: 'road', type: t, name: d.name, cost: `${fmtMoney(d.cost * g.costMul)} / Feld`, desc: d.desc, color: '#5d6470', locked,
        facts: [['car', `${fmt(d.capacity)} Fahrzeuge/h`], ['coin', `${fmtMoney(d.upkeep * 10 * g.upkeepMul())} je 10 Felder/Tag`], ...(d.lv ? [['coin', `Bodenwert +${d.lv}`]] : [])] });
    }
  } else if (cat === 'zones') {
    for (const z of [1, 2, 3, 4]) {
      const locked = z === 4 && !g.isUnlocked('zone4') ? g.lockReason('zone4') : null;
      const dem = Math.round(g.demand[z] || 0);
      items.push({ cat, kind: 'zone', zone: z, name: ZONE_INFO[z].name, cost: `${fmtMoney(2 * g.costMul)} / Feld`, desc: ZONE_INFO[z].desc || ZONE_DESC[z], color: hex(ZONE_INFO[z].color), locked,
        facts: [['stats', `Nachfrage ${dem > 0 ? '+' : ''}${dem}`], ['grid', 'Fläche aufziehen']], demand: dem });
    }
    items.push({ cat, kind: 'dezone', name: 'Zonen entfernen', cost: 'kostenlos', desc: 'Entfernt Zonen von unbebauten Feldern.', color: '#9a9a9a', icon: 'dezone', facts: [['grid', 'Fläche aufziehen']] });
  } else if (cat === 'transit') {
    const locked = g.isUnlocked('transit') ? null : g.lockReason('station');
    items.push({ cat, kind: 'line', name: 'Linie zeichnen', cost: `ab ${fmtMoney(TRANSIT.lineCost * g.costMul)}`, desc: 'Stationen nacheinander anklicken – leere Felder bekommen automatisch eine Station. Rechtsklick oder Enter beendet.', color: '#e8543f', locked, icon: 'line', facts: [['line', `${g.transit.lines.length} / ${g.transit.linesMax} Linien`]] });
    items.push(placeItem(g, cat, 'station', meta, builtCounts(g)));
    items.push({ cat, kind: 'panel', panel: 'transit', name: 'Linien verwalten', cost: `${g.transit.lines.length} / ${g.transit.linesMax} Linien`, desc: 'Züge und Waggons einsetzen, Linien verlängern.', color: '#2f8fe0', locked, icon: 'settings', facts: [] });
    for (const [key, d] of Object.entries(BUILDINGS)) if (d.cat === cat && key !== 'station') items.push(placeItem(g, cat, key, meta, builtCounts(g)));
  } else {
    for (const [key, d] of Object.entries(BUILDINGS)) {
      if (d.cat !== cat || key === 'station') continue;
      items.push(placeItem(g, cat, key, meta, builtCounts(g)));
    }
    // verfügbare zuerst, dann nach Freischaltung und Preis
    items.sort((a, b) => (!!a.locked - !!b.locked) || ((BUILDINGS[a.key]?.unlock ?? 0) - (BUILDINGS[b.key]?.unlock ?? 0)) || ((BUILDINGS[a.key]?.cost ?? 0) - (BUILDINGS[b.key]?.cost ?? 0)));
  }
  for (const t of TRAY_ITEMS) {
    if (t.cat !== cat) continue;
    let it = null;
    try { it = t.item(g); } catch (e) { console.error('Werkzeugleiste', e); }
    if (it) items.push({ cat, kind: 'tool', color: meta.color, ...it, facts: it.facts && Array.isArray(it.facts) ? it.facts : it.facts ? [['info', String(it.facts)]] : [] });
  }
  return items;
}

function placeItem(g, cat, key, meta, counts) {
  const d = BUILDINGS[key];
  const n = key === 'station' ? g.transit.stations.size : counts ? counts.get(key) || 0 : 0;
  const built = d.unique && (n > 0 || g.hasBuilt(key));
  const locked = isBanned(g, key) ? 'In diesem Szenario verboten' : g.isUnlocked(key) ? (built ? 'Schon gebaut' : null) : g.lockReason(key);
  const facts = [];
  if (d.power) facts.push(['power', `${fmt(d.power)} MW`]);
  if (d.water) facts.push(['water', `${fmt(d.water)} m³`]);
  if (d.sewage) facts.push(['water', `Abwasser ${fmt(d.sewage)}`]);
  if (d.heat) facts.push(['flame', `Wärme ${fmt(d.heat)}`]);
  if (d.service) facts.push(['target', `Radius ${String(d.service.radius).replace('.', ',')}`]);
  if (d.park) facts.push(['parks', `Erholung · Radius ${String(d.parkRadius).replace('.', ',')}`]);
  if (d.tourism) facts.push(['people', `${fmt(d.tourism)} Touristen/Tag`]);
  if (d.jobs) facts.push(['people', `${fmt(d.jobs)} Jobs`]);
  if (d.cargo) facts.push(['transport', `Fracht ${fmt(d.cargo)}`]);
  if (d.storage) facts.push(['industry', `Lager ${fmt(d.storage)}`]);
  if (d.pollution) facts.push(['smoke', `Abgase ${d.pollution}`]);
  if (d.noise >= 1) facts.push(['sound', 'laut']);
  if (d.lv > 0) facts.push(['coin', `Bodenwert +${d.lv}`]);
  if (d.upkeep) facts.push(['budget', `${fmtMoney(d.upkeep * g.upkeepMul())} / Tag`]);
  facts.push(['grid', `${d.size[0]} × ${d.size[1]} Felder`]);
  if (d.needsWater) facts.push(['water', 'am Ufer']);
  if (d.onRoad) facts.push(['roads', 'auch über Straßen']);
  const unlockMs = d.landmark ? d.unlock + 1 : d.unlock;
  return {
    cat, kind: 'place', key, name: d.name, cost: fmtMoney(g.buildingCost(key)), desc: d.desc, facts,
    color: meta.color, locked, built, unique: !!d.unique, landmark: !!d.landmark, count: d.unique ? 0 : n,
    tag: d.landmark && g.landmarkVouchers.has(key) && !built ? '−50 %' : '',
    fresh: !g.sandbox && unlockMs === g.milestone && unlockMs > 0 && !locked,
    unlockName: MILESTONES[unlockMs] ? MILESTONES[unlockMs].name : '',
  };
}

export function freshCats(ui) {
  const g = ui.g, out = new Set();
  if (g.sandbox || g.milestone <= 0) return out;
  for (const [key, d] of Object.entries(BUILDINGS)) {
    const ms = d.landmark ? d.unlock + 1 : d.unlock;
    if (ms === g.milestone && g.isUnlocked(key)) out.add(d.cat);
  }
  return out;
}

export function allCatalogItems(ui) {
  const cats = CATEGORIES.map((c) => c.id);
  for (const t of TRAY_ITEMS) if (t.cat && !cats.includes(t.cat)) cats.push(t.cat);
  const out = [];
  for (const c of cats) for (const it of catalogItems(ui, c)) out.push(it);
  return out;
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
export function searchCatalog(ui, q) {
  const n = norm(q).trim();
  if (!n) return [];
  const words = n.split(/\s+/);
  return allCatalogItems(ui).map((it) => {
    const hay = norm(`${it.name} ${catMeta(it.cat).name} ${catLabel(it.cat)} ${it.desc || ''}`);
    const nm = norm(it.name);
    if (!words.every((w) => hay.includes(w))) return null;
    return { it, score: (nm.startsWith(words[0]) ? 3 : nm.includes(words[0]) ? 2 : 1) - (it.locked ? 0.5 : 0) };
  }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 40).map((x) => x.it);
}

export function isActive(it, t) {
  if (!t) return false;
  if (it.kind === 'tool') return t.kind === it.key && String(t.type ?? '') === String(it.type ?? '');
  if (it.kind !== t.kind) return false;
  if (it.kind === 'road') return t.type === it.type;
  if (it.kind === 'zone') return t.zone === it.zone;
  if (it.kind === 'place') return t.key === it.key;
  if (it.kind === 'tool') return t.kind === it.key || (t.kind === 'tool' && t.key === it.key);
  return it.kind === 'dezone' || it.kind === 'line';
}

function pic(it, big = false) {
  const spec = thumbSpecFor(it);
  const col = it.color || '#7a8294';
  if (spec) {
    const id = thumbId(spec);
    const url = getThumb(spec, big ? 3 : 2);
    if (url) return `<img class="thumb" src="${url}" alt="" draggable="false">`;
    if (!thumbFailed(spec)) return `<span class="ph" data-thumb="${esc(id)}" style="--c:${col}">${iconAny(it.icon || catMeta(it.cat).icon, 'layers', big ? 40 : 30, 1.6)}</span>`;
  }
  return `<span class="art" style="--c:${col}">${iconAny(it.icon || catMeta(it.cat).icon, 'layers', big ? 44 : 34, 1.7)}</span>`;
}

export function factsHTML(facts, max = 99) {
  return (facts || []).slice(0, max).map(([ic, txt]) => `<span class="fact">${icon(ic, 13, 2.2)}${esc(txt)}</span>`).join('');
}

// Kennung für Spotlight-Ziele der Einführung: data-tour="item-<kennung>", z. B. item-street, item-res, item-coal
export function tourKey(it) {
  if (!it) return '';
  if (it.kind === 'road') return (ROADS[it.type] || {}).key || String(it.type);
  if (it.kind === 'zone') return (ZONE_INFO[it.zone] || {}).key || String(it.zone);
  if (it.kind === 'place') return it.key;
  if (it.kind === 'panel') return 'panel-' + it.panel;
  if (it.kind === 'tool') return it.type !== undefined && it.type !== '' ? `${it.key}-${it.type}` : String(it.key || 'tool');
  return it.kind;
}

// Zeile im Baukatalog (Runde 3b, Vorlage): Bild links, Name fett, „Mehr Infos" klein in Violett, rechts der orange Preis-Knopf.
// Gesperrtes zeigt ein Schloss mit Rang, Einmaliges, das schon steht, ein grünes „Gebaut". open = aufgeklappte Details.
export function cardHTML(it, i, active, showCat = false, open = false) {
  const cls = ['item', 'card'];
  if (active) cls.push('on');
  if (it.locked) cls.push('locked');
  if (it.built) cls.push('built');
  if (open) cls.push('open');
  const cm = catMeta(it.cat);
  const free = /^(0 €|kostenlos)/.test(String(it.cost || ''));
  const buy = it.built ? `<span class="buy done">${icon('check', 15, 3)}Gebaut</span>`
    : it.locked ? `<span class="buy lock">${icon('lock', 14, 2.8)}${esc(it.unlockName || 'Gesperrt')}</span>`
    : it.kind === 'panel' ? `<span class="buy alt">Öffnen</span>`
    : `<span class="buy${free ? ' free' : ''}">${esc(it.cost || 'Bauen')}</span>`;
  const sub = it.locked && !it.built ? `<span class="f lockline">${icon('lock', 12, 2.6)}${esc(it.locked)}</span>`
    : it.facts && it.facts.length ? `<span class="f">${factsHTML(it.facts, it.kind === 'panel' ? 1 : 2)}</span>` : '';
  const xtra = open ? `<span class="xtra"><span class="x-desc">${esc(it.desc || '')}</span>${it.facts && it.facts.length > 2 ? `<span class="x-facts">${factsHTML(it.facts.slice(2))}</span>` : ''}${it.unique && !it.locked ? `<span class="x-note">${icon('star', 13, 2.4)}Einmalig in der Stadt${it.tag ? ' · Gutschein: halber Preis' : ''}</span>` : ''}<span class="dt-help" data-act="trayhelp" data-tip="Was ist das?" data-tip-desc="Erklärt in einfachen Sätzen, wozu das gut ist." data-tip-fast="1">${icon('help', 14, 2.4)}Was ist das?</span></span>` : '';
  return `<button class="${cls.join(' ')}" role="listitem" data-i="${i}" data-tour="item-${esc(tourKey(it))}" data-kind="${it.kind}" data-type="${it.type || ''}" data-zone="${it.zone || ''}" data-bkey="${esc(it.key || '')}" data-panel="${esc(it.panel || '')}" ${it.locked ? 'data-locked="1"' : ''} style="--c:${it.color || cm.color}" aria-label="${esc(it.name)}${it.cost ? ', ' + esc(it.cost) : ''}">
  <span class="pic">${pic(it)}${it.tag ? `<span class="tag">${esc(it.tag)}</span>` : it.fresh ? '<span class="tag new">Neu</span>' : ''}${it.count ? `<span class="cnt num" title="In der Stadt">${it.count}×</span>` : ''}${typeof it.demand === 'number' ? `<span class="dem"><i style="height:${Math.max(4, Math.min(100, Math.abs(it.demand)))}%;${it.demand < 0 ? 'opacity:.4' : ''}"></i></span>` : ''}</span>
  <span class="meta">${showCat ? `<span class="ct" style="color:${cm.color}">${esc(catLabel(it.cat))}</span>` : ''}<span class="n">${esc(it.name)}</span>${sub}<span class="more" data-more="1" role="button" aria-expanded="${open}">${open ? 'Weniger' : 'Mehr Infos'}</span></span>
  ${buy}${xtra}
</button>`;
}

export function detailHTML(it) {
  if (!it) return '<div class="empty">Fahre über einen Eintrag, um Details zu sehen.</div>';
  const cm = catMeta(it.cat);
  return `<div class="dt-head"><span class="dt-line" style="background:${it.color || cm.color}"></span><span class="dt-cat">${esc(catLabel(it.cat))}</span></div>
<div class="dt-name">${esc(it.name)}</div>
<div class="dt-cost num">${esc(it.cost)}</div>
<p class="dt-desc">${esc(it.desc || '')}</p>
<div class="dt-facts">${factsHTML(it.facts)}</div>
${it.locked ? `<div class="dt-lock">${icon(it.built ? 'check' : 'lock', 14, 2.4)}<span>${esc(it.locked)}</span></div>` : it.unique ? `<div class="dt-note">${icon('star', 14, 2.2)}<span>Einmalig in der Stadt${it.tag ? ' · Gutschein: halber Preis' : ''}</span></div>` : ''}
<button class="dt-help" data-act="trayhelp" data-tip="Was ist das?" data-tip-desc="Erklärt in einfachen Sätzen, wozu das gut ist." data-tip-fast="1">${icon('help', 14, 2.2)}<span>Was ist das?</span></button>`;
}

// Bilder nachträglich einsetzen, sobald sie fertig sind
export function bindThumbSwap(root) {
  return onThumb((id, url) => {
    if (!url) return;
    for (const el of root.querySelectorAll(`[data-thumb="${CSS.escape(id)}"]`)) {
      const img = document.createElement('img');
      img.className = 'thumb fresh';
      img.src = url;
      img.alt = '';
      img.draggable = false;
      el.replaceWith(img);
    }
  });
}

export { lineById };
