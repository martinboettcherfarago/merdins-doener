// Metadaten der Oberfläche: Linien (Gruppen) des Netzplans, Kategorien, Infoansichten, Panels.
// Alles generisch: Unbekannte Kategorien/Ansichten/Panels anderer Module landen in der Linie „Weitere"
// und nutzen ihre eigenen Felder (icon, color, group), falls vorhanden.
import { CATEGORIES } from '../config.js';
import { TRAY_ITEMS, PANELS } from '../registry.js';
import { allOverlays } from '../render/overlay.js';

// Linien des Netzplans (Werkzeugleiste) – jede Gruppe ist eine farbige Linie.
export const LINES = [
  { id: 'bau', no: 'B1', name: 'Bauen', color: '#1d2330' },
  { id: 'versorgung', no: 'V2', name: 'Versorgung', color: '#e9a514' },
  { id: 'dienste', no: 'D3', name: 'Dienste', color: '#e8543f' },
  { id: 'freizeit', no: 'F4', name: 'Freizeit', color: '#22a866' },
  { id: 'verkehr', no: 'L5', name: 'Verkehr & Logistik', color: '#2f8fe0' },
  { id: 'mehr', no: 'X6', name: 'Weitere', color: '#8f5ad8' },
];
export const lineById = (id) => LINES.find((l) => l.id === id) || LINES[LINES.length - 1];

export const CAT_META = {
  roads: { icon: 'roads', color: '#5d6470', line: 'bau', key: 'g' },
  zones: { icon: 'zones', color: '#4fae67', line: 'bau', key: 'z' },
  power: { icon: 'power', color: '#e9a514', line: 'versorgung' },
  water: { icon: 'water', color: '#2f8fe0', line: 'versorgung' },
  garbage: { icon: 'garbage', color: '#a07a4a', line: 'versorgung' },
  services: { icon: 'services', color: '#e8543f', line: 'dienste' },
  education: { icon: 'education', color: '#8f5ad8', line: 'dienste' },
  safety: { icon: 'safety', color: '#d9622b', line: 'dienste' },
  parks: { icon: 'parks', color: '#22a866', line: 'freizeit' },
  landmarks: { icon: 'landmarks', color: '#c06a2b', line: 'freizeit' },
  industry: { icon: 'industry', color: '#8a6a55', line: 'verkehr' },
  transport: { icon: 'transport', color: '#10a9a3', line: 'verkehr' },
  transit: { icon: 'transit', color: '#e8543f', line: 'verkehr' },
  districts: { name: 'Bezirke', icon: 'districts', color: '#8f5ad8', line: 'bau' },
};

// Kategorie-Metadaten mit Rückfall auf Felder der Kategorie selbst (CATEGORIES.push({ id, name, icon, color, group }))
export function catMeta(id) {
  const c = CATEGORIES.find((x) => x.id === id) || {};
  const m = CAT_META[id] || {};
  return {
    id,
    name: c.name || m.name || id.charAt(0).toUpperCase() + id.slice(1),
    icon: c.icon || m.icon || 'layers',
    color: c.color || m.color || '#7a8294',
    line: c.group || c.line || m.line || 'mehr',
    key: m.key || null,
  };
}

// Alle Kategorien der Werkzeugleiste in Netzplan-Reihenfolge – inkl. Kategorien, die nur über TRAY_ITEMS existieren.
export function toolbarCategories() {
  const ids = CATEGORIES.map((c) => c.id);
  for (const t of TRAY_ITEMS) if (t.cat && !ids.includes(t.cat)) ids.push(t.cat);
  const order = LINES.map((l) => l.id);
  return ids.map((id, k) => ({ ...catMeta(id), k }))
    .sort((a, b) => order.indexOf(a.line) - order.indexOf(b.line) || a.k - b.k);
}

// --- Hauptgruppen der Werkzeugleiste (Runde 3): wenige beschriftete Gruppen, die Kategorien sind Reiter im Katalog.
// Unbekannte Kategorien anderer Module landen über ihre Linie in einer Gruppe oder in „Weitere".
export const GROUPS = [
  { id: 'roads', name: 'Straßen', icon: 'roads', color: '#5d6470', cats: ['roads'], key: 'G', desc: 'Straßen ziehen. Jedes Haus braucht einen Anschluss.' },
  { id: 'zones', name: 'Zonen', icon: 'zones', color: '#4fae67', cats: ['zones', 'districts'], key: 'Z', desc: 'Flächen für Wohnen, Gewerbe, Industrie und Büros ausweisen.' },
  { id: 'versorgung', name: 'Versorgung', icon: 'power', color: '#e9a514', cats: ['power', 'water', 'garbage'], desc: 'Strom, Wasser, Abwasser und Müllabfuhr.' },
  { id: 'dienste', name: 'Dienste', icon: 'services', color: '#e8543f', cats: ['services', 'education', 'safety'], desc: 'Gesundheit, Bildung, Polizei und Feuerwehr.' },
  { id: 'freizeit', name: 'Freizeit', icon: 'parks', color: '#22a866', cats: ['parks', 'landmarks'], desc: 'Parks, Plätze und Wahrzeichen machen die Leute glücklich.' },
  { id: 'verkehr', name: 'Verkehr', icon: 'ubahn', color: '#2f8fe0', cats: ['transit', 'transport', 'industry'], desc: 'U-Bahn, Bus, Straßenbahn und Güterlogistik.' },
];
const LINE_GROUP = { bau: 'zones', versorgung: 'versorgung', dienste: 'dienste', freizeit: 'freizeit', verkehr: 'verkehr' };
// Anzeigenamen der Reiter (kurz und verständlich)
const CAT_LABEL = { transit: 'U-Bahn', transport: 'Bus & Tram', industry: 'Logistik', districts: 'Bezirke' };
export const catLabel = (id) => CAT_LABEL[id] || catMeta(id).name;
export function groupOfCat(id) {
  const g = GROUPS.find((x) => x.cats.includes(id));
  return g ? g.id : LINE_GROUP[catMeta(id).line] || 'mehr';
}
// Gruppen mit ihren tatsächlich vorhandenen Kategorien (Reihenfolge wie in GROUPS, fremde hinten angehängt)
export function toolbarGroups() {
  const ids = toolbarCategories().map((c) => c.id);
  const out = GROUPS.map((gr) => ({ ...gr, cats: gr.cats.filter((c) => ids.includes(c)) }));
  const more = { id: 'mehr', name: 'Weitere', icon: 'layers', color: '#8f5ad8', cats: [], desc: 'Weitere Werkzeuge.' };
  for (const c of ids) {
    if (GROUPS.some((gr) => gr.cats.includes(c))) continue;
    const gid = groupOfCat(c);
    (out.find((gr) => gr.id === gid) || more).cats.push(c);
  }
  if (more.cats.length) out.push(more);
  return out.filter((gr) => gr.cats.length);
}

// --- Infoansichten
export const VIEW_GROUPS = [
  { id: 'versorgung', name: 'Versorgung' },
  { id: 'dienste', name: 'Dienste & Schutz' },
  { id: 'leben', name: 'Menschen' },
  { id: 'verkehr', name: 'Verkehr' },
  { id: 'umwelt', name: 'Umwelt & Boden' },
  { id: 'mehr', name: 'Weitere' },
];
// Anzeigenamen (kurz und verständlich) – überschreiben die Namen aus den Ansichten
export const VIEW_NAME = { transit: 'U-Bahn' };
// Gruppen der Oberfläche haben Vorrang vor den Feldern der Ansicht selbst (damit „Weitere" klein bleibt)
export const VIEW_META = {
  none: { icon: 'eye', group: '' },
  power: { icon: 'power', group: 'versorgung' },
  water: { icon: 'water', group: 'versorgung' },
  sewage: { icon: 'water', group: 'versorgung' },
  garbage: { icon: 'garbage', group: 'versorgung' },
  goods: { group: 'versorgung' },
  health: { icon: 'cross', group: 'dienste' },
  police: { icon: 'shield', group: 'dienste' },
  fire: { icon: 'flame', group: 'dienste' },
  edu: { icon: 'book', group: 'dienste' },
  deathcare: { icon: 'services', group: 'dienste' },
  safety: { group: 'dienste' },
  happiness: { icon: 'heart', group: 'leben' },
  crime: { icon: 'mask', group: 'leben' },
  age: { group: 'leben' },
  eduLevel: { group: 'leben' },
  districts: { group: 'leben' },
  traffic: { icon: 'car', group: 'verkehr' },
  transit: { icon: 'ubahn', group: 'verkehr' },
  ptransport: { group: 'verkehr' },
  landValue: { icon: 'coin', group: 'umwelt' },
  pollution: { icon: 'smoke', group: 'umwelt' },
  noise: { icon: 'sound', group: 'umwelt' },
  resources: { icon: 'map', group: 'umwelt' },
  floodrisk: { group: 'umwelt' },
  snowcov: { group: 'umwelt' },
};
export const VIEW_TEXT = {
  power: 'Grün: versorgt. Rot: kein Strom. Strom fließt durch die Leitungen unter den Straßen – jedes zusammenhängende Straßennetz ist ein eigenes Stromnetz.',
  water: 'Blau: versorgt. Rot: kein Wasser. Pumpwerke brauchen Strom und müssen am Ufer stehen.',
  garbage: 'Wie gut die Müllabfuhr die Gegend erreicht. Jede Anlage hat eine begrenzte Kapazität.',
  health: 'Abdeckung durch Arztpraxen und Krankenhäuser.',
  police: 'Abdeckung durch Polizeiwachen.',
  fire: 'Abdeckung durch die Feuerwehr. Ohne Feuerwehr brennen Gebäude ab.',
  edu: 'Bildungsniveau, das hier erreichbar ist. Hohe Stufen brauchen gebildete Bewohner.',
  landValue: 'Bodenwert lässt Gebäude wachsen: Parks, Wasser, Dienste und die U-Bahn heben ihn, Lärm und Abgase senken ihn.',
  pollution: 'Abgase von Industrie, Kraftwerken und Verkehr. Senkt Glück und Bodenwert.',
  noise: 'Lärm von Straßen, Industrie und Stadien.',
  crime: 'Kriminalität steigt mit Arbeitslosigkeit und Unzufriedenheit.',
  happiness: 'Grün: glücklich. Rot: unglücklich. Klicke ein Gebäude an, um die Gründe zu sehen.',
  traffic: 'Grün: freie Fahrt. Rot: Stau. Alleen haben die doppelte Kapazität, die U-Bahn nimmt Autos von der Straße.',
  transit: 'Einzugsgebiet der U-Bahn-Stationen mit Zugverkehr.',
  resources: 'Industrie spezialisiert sich: Acker → Bauernhof, Wald → Forstbetrieb, Erz → Bergwerk, Öl → Ölförderung.',
};

export function viewList() {
  const order = VIEW_GROUPS.map((g) => g.id);
  return allOverlays().map((o, k) => {
    const m = VIEW_META[o.id] || {};
    return { ...o, k, name: VIEW_NAME[o.id] || o.name, icon: o.icon || m.icon || 'layers', group: o.id === 'none' ? '' : m.group || o.group || 'mehr', text: o.text || VIEW_TEXT[o.id] || '' };
  }).sort((a, b) => (a.id === 'none' ? -1 : b.id === 'none' ? 1 : order.indexOf(a.group) - order.indexOf(b.group) || a.k - b.k));
}

// --- Panels
export const PANEL_GROUPS = [
  { id: 'verwaltung', name: 'Verwaltung' },
  { id: 'menschen', name: 'Menschen' },
  { id: 'verkehr', name: 'Verkehr' },
  { id: 'umwelt', name: 'Umwelt' },
  { id: 'fortschritt', name: 'Fortschritt' },
  { id: 'stadtfunk', name: 'Stadtfunk' },
  { id: 'mehr', name: 'Weitere' },
];
// desc: ein Satz für Menü und Tooltip · when(g): erst zeigen, wenn es gebraucht wird (fortschreitende Enthüllung)
const ms = (n) => (g) => g.sandbox || g.milestone >= n;
export const PANEL_META = {
  budget: { group: 'verwaltung', order: 10, color: '#c98a0c', key: 'F2', desc: 'Einnahmen, Ausgaben und Steuern' },
  economy: { group: 'verwaltung', order: 12, color: '#c98a0c', desc: 'Konjunktur, Handel und Firmen', when: ms(1) },
  stats: { group: 'verwaltung', order: 14, color: '#2f8fe0', key: 'F3', desc: 'Verläufe und Kennzahlen der Stadt' },
  policies: { group: 'verwaltung', order: 16, color: '#5d6470', key: 'F4', desc: 'Regeln für die ganze Stadt', when: (g) => g.isUnlocked('policies') },
  citizens: { group: 'menschen', order: 20, color: '#4fae67', desc: 'Wer hier wohnt und was die Leute brauchen', when: (g) => g.sandbox || g.milestone >= 1 || g.stats.pop >= 150 },
  districts: { group: 'menschen', order: 22, color: '#8f5ad8', desc: 'Stadtteile mit eigenen Regeln', when: ms(2) },
  transit: { group: 'verkehr', order: 30, color: '#e8543f', desc: 'U-Bahn-Linien, Züge und Takt', when: (g) => g.isUnlocked('transit') || g.transit.lines.length > 0 },
  transport: { group: 'verkehr', order: 32, color: '#10a9a3', desc: 'Bus, Straßenbahn und Verkehrsfluss', when: ms(1) },
  weather: { group: 'umwelt', order: 40, color: '#38a3d1', desc: 'Wetter, Jahreszeiten und Katastrophenschutz', when: ms(1) },
  progression: { group: 'fortschritt', order: 50, color: '#e9a514', desc: 'Ziele, Meilensteine und Aufträge' },
  news: { group: 'stadtfunk', order: 60, color: '#1d2330', desc: 'Was die Leute in der Stadt erzählen' },
};
export function panelMeta(p) {
  const m = PANEL_META[p.id] || {};
  return { group: p.group || m.group || 'mehr', order: p.order ?? m.order ?? 55, color: p.color || m.color || '#5d6470', key: m.key || null, desc: p.desc || m.desc || '' };
}
// Ist ein Panel schon relevant? Panels anderer Module dürfen available(ui) → bool mitbringen.
export function panelAvailable(p, ui) {
  try {
    if (typeof p.available === 'function') return !!p.available(ui);
    const m = PANEL_META[p.id];
    return !m || !m.when || !!m.when(ui.g);
  } catch (e) { return true; }
}
export function dockPanels(core) {
  const order = PANEL_GROUPS.map((g) => g.id);
  const list = [...core.filter((c) => !c.hidden).map((c) => PANELS.find((p) => p.id === c.id) || c), ...PANELS.filter((p) => !core.find((c) => c.id === p.id) && !p.hidden)];
  return list.map((p) => ({ p, m: panelMeta(p) }))
    .sort((a, b) => order.indexOf(a.m.group) - order.indexOf(b.m.group) || a.m.order - b.m.order);
}

export const DISASTER_NAMES = {
  flood: 'Hochwasser', storm: 'Sturm', tornado: 'Tornado', earthquake: 'Erdbeben', quake: 'Erdbeben', lightning: 'Blitzeinschlag',
  wildfire: 'Waldbrand', forestfire: 'Waldbrand', fire: 'Großbrand', meteor: 'Meteorit', heatwave: 'Hitzewelle', blizzard: 'Schneesturm', hail: 'Hagel',
};
