// Tastenkürzel: eine Liste für Hilfe-Übersicht und Anzeige in Tooltips. Die Behandlung steckt in ui.js (onKey).
// Buchstaben werden über e.key geprüft (QWERTZ-sicher), Kamera-Tasten über e.code (Position).
export const KEYMAP = [
  { group: 'Kamera', items: [
    [['Rechte Maus'], 'Karte verschieben'],
    [['Mittlere Maus', 'Alt + Links'], 'Drehen und neigen'],
    [['Mausrad'], 'Zoomen (zum Zeiger)'],
    [['W', 'A', 'S', 'D'], 'Kamera bewegen'],
    [['Q', 'E'], 'Kamera drehen'],
    [['Bild ↑', 'Bild ↓'], 'Kamera neigen'],
    [['+', '−'], 'Zoomen'],
  ] },
  { group: 'Zeit', items: [
    [['Leertaste'], 'Pause / weiter'],
    [['1', '2', '3'], 'Geschwindigkeit'],
  ] },
  { group: 'Bauen', items: [
    [['G'], 'Straßen'],
    [['Z'], 'Zonen'],
    [['L'], 'U-Bahn-Linie zeichnen'],
    [['F'], 'Baukatalog durchsuchen'],
    [['R'], 'Gebäude drehen'],
    [['B', 'Entf'], 'Abriss'],
    [['Enter'], 'Bauen (✓)'],
    [['⌫'], 'Linie: einen Schritt zurück'],
    [['Esc', 'Rechtsklick'], 'Werkzeug abbrechen'],
  ] },
  { group: 'Ansichten & Fenster', items: [
    [['V'], 'Infoansicht ausschalten'],
    [['N'], 'Meldungen'],
    [['H'], 'Stadt-Check und Ratgeberin'],
    [['K'], 'Minikarte ein/aus'],
    [['P'], 'Fotomodus'],
    [['U'], 'Oberfläche ausblenden'],
    [['I'], 'Problem-Symbole ein/aus'],
    [['M'], 'Ton an/aus'],
    [['?'], 'Diese Übersicht'],
    [['F1'], 'Hilfe'],
    [['Strg + S'], 'Schnellspeichern'],
  ] },
];

export const KEY_HINT = {
  select: 'Esc', bulldoze: 'B', roads: 'G', zones: 'Z', photo: 'P', notes: 'N', advisor: 'H', keys: '?', minimap: 'K', settings: '', search: 'F',
};

export function keysHTML() {
  return `<div class="modal keysheet"><div class="ks-head"><div><div class="eyebrow">Bedienung</div><h2>Tastenkürzel</h2></div><button class="close" data-act="ok" aria-label="Schließen"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
<div class="ks-grid">${KEYMAP.map((g) => `<section><h3>${g.group}</h3>${g.items.map(([keys, txt]) => `<div class="ks-row"><span class="ks-keys">${keys.map((k) => `<kbd>${k}</kbd>`).join('<i>·</i>')}</span><span class="ks-t">${txt}</span></div>`).join('')}</section>`).join('')}</div>
<p class="ks-foot">Auf dem Handy: ein Finger verschiebt, zwei Finger zoomen und drehen. Antippen zeigt Infos zu Gebäuden. Beim Bauen setzt Antippen eine Vorschau, ✓ baut, ✕ verwirft; Ziehen verschiebt die Karte, die Vorschau oder die Griffe.</p></div>`;
}
