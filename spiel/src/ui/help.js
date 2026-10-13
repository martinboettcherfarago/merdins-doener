// Hilfe „So funktioniert's": kurze, bebilderte Erklärungen der Grundideen (Straßen, Zonen, Versorgung, Glück, Geld,
// U-Bahn …). Besitzer: Agent EINSTIEG. Die Oberfläche ruft auf:
//   openHelp(ui, topicId?)  → öffnet die Hilfe (optional direkt bei einem Thema)
//   helpTopics()            → [{ id, title, icon }] für Menüs
//   helpTopicFor(x)         → passendes Thema zu einer Kategorie, einem Gebäude-Schlüssel oder einer Infoansicht
// Eigene Styles per injiziertem <style>, Farben über die CSS-Variablen aus style.css.
import { MILESTONES, BUILDINGS, BRIDGE_FACTOR } from '../config.js';
import { fmt } from '../util.js';
import { icon } from './icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ic = (name, size = 16, stroke = 2.2) => { try { return icon(name, size, stroke); } catch (e) { return ''; } };
const ms = (i) => `„${MILESTONES[i].name}" (${fmt(MILESTONES[i].pop)} Einwohner)`;

// ------------------------------------------------------------------ kleine Skizzen (240 × 120)
const C = { res: '#4fae67', com: '#3a8ad8', ind: '#dba22e', off: '#9466d2', road: '#8a8f99', ink: '#1d2330', power: '#e9a514', water: '#2f8fe0', bad: '#d4433a', good: '#23864b', ground: '#d9cfb9', sky: '#fffdf8' };
const svg = (body) => `<svg class="hp-svg" viewBox="0 0 240 120" role="img" aria-hidden="true">${body}</svg>`;
const house = (x, y, col, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0h18v-12l-9-8-9 8z" fill="${col}" stroke="${C.ink}" stroke-width="1.6" stroke-linejoin="round"/><rect x="6" y="-7" width="6" height="7" fill="#fff" opacity=".85"/></g>`;
const road = (x1, y1, x2, y2, w = 10) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.road}" stroke-width="${w}" stroke-linecap="round"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#fff" stroke-width="1.4" stroke-dasharray="5 5"/>`;
const label = (x, y, t, col = C.ink, anchor = 'middle') => `<text x="${x}" y="${y}" font-size="10" font-weight="700" fill="${col}" text-anchor="${anchor}" font-family="system-ui, sans-serif">${t}</text>`;
const bolt = (x, y, s = 1) => `<path transform="translate(${x} ${y}) scale(${s})" d="M6 0 0 9h5l-2 7 7-10H5z" fill="${C.power}" stroke="${C.ink}" stroke-width="1" stroke-linejoin="round"/>`;
const drop = (x, y, s = 1) => `<path transform="translate(${x} ${y}) scale(${s})" d="M5 0C8 4 10 6.5 10 9a5 5 0 0 1-10 0c0-2.5 2-5 5-9z" fill="${C.water}" stroke="${C.ink}" stroke-width="1"/>`;

const SKETCH = {
  start: svg(`${road(10, 80, 230, 80)}${[['1', 30, 'Straße'], ['2', 75, 'Wohnen'], ['3', 120, 'Strom'], ['4', 165, 'Wasser'], ['5', 210, 'Zeit']].map(([n, x, t], i) => `<circle cx="${x}" cy="80" r="11" fill="${[C.road, C.res, C.power, C.water, C.ink][i]}" stroke="#fff" stroke-width="2.5"/>${label(x, 84, n, '#fff')}${label(x, 108, t)}`).join('')}${house(66, 52, C.res)}${bolt(114, 34, 1.4)}${drop(160, 32, 1.4)}`),
  roads: svg(`<rect x="0" y="44" width="70" height="16" fill="#5d6470"/><line x1="0" y1="52" x2="70" y2="52" stroke="#f2c230" stroke-width="1.5" stroke-dasharray="6 4"/>${label(34, 38, 'Autobahn')}${road(70, 52, 230, 52)}${road(150, 52, 150, 112)}${house(90, 38, C.res)}${house(116, 38, C.res)}${house(170, 38, C.com)}${house(196, 38, C.com)}${house(158, 96, C.res)}${house(124, 96, C.res)}<circle cx="70" cy="52" r="8" fill="none" stroke="${C.bad}" stroke-width="2.5"/>${label(70, 80, 'hier anfangen', C.bad)}`),
  zones: svg(`${road(10, 64, 230, 64)}<rect x="16" y="20" width="62" height="34" rx="4" fill="${C.res}" opacity=".35" stroke="${C.res}" stroke-width="2"/><rect x="88" y="20" width="62" height="34" rx="4" fill="${C.com}" opacity=".35" stroke="${C.com}" stroke-width="2"/><rect x="160" y="20" width="62" height="34" rx="4" fill="${C.ind}" opacity=".35" stroke="${C.ind}" stroke-width="2"/>${house(24, 50, C.res)}${house(48, 50, C.res)}${house(96, 50, C.com)}${house(122, 50, C.com, 1.2)}<path d="M168 50h18V36l8-5v19h14V30l6-4v24" fill="${C.ind}" stroke="${C.ink}" stroke-width="1.6"/>${label(47, 94, 'Wohnen', C.res)}${label(119, 94, 'Gewerbe', C.com)}${label(191, 94, 'Industrie', '#a77a10')}${label(120, 112, 'Gebäude entstehen nur direkt an Straßen', C.ink)}`),
  demand: svg(`<line x1="20" y1="60" x2="220" y2="60" stroke="${C.ink}" stroke-width="1.5"/>${[[C.res, 'W', 40], [C.com, 'G', -12], [C.ind, 'I', 22], [C.off, 'B', 6]].map(([col, t, v], i) => { const x = 50 + i * 46; return `<rect x="${x}" y="${v > 0 ? 60 - v : 60}" width="24" height="${Math.abs(v)}" rx="3" fill="${col}" opacity="${v > 0 ? 1 : 0.45}"/>${label(x + 12, 112, t, col)}`; }).join('')}${label(30, 24, 'gefragt', C.good, 'start')}${label(30, 96, 'zu viel', C.bad, 'start')}`),
  power: svg(`${road(20, 76, 230, 76)}<path d="M18 70V38h14l4-14h8v46z" fill="#8f8f8f" stroke="${C.ink}" stroke-width="1.6"/><circle cx="44" cy="16" r="5" fill="#ccc"/><circle cx="52" cy="8" r="6" fill="#ddd"/>${house(110, 66, C.res)}${house(150, 66, C.res)}${house(190, 66, C.com)}${[90, 130, 170].map((x) => bolt(x, 80, 0.9)).join('')}${bolt(115, 30, 1.2)}${bolt(155, 30, 1.2)}${bolt(195, 30, 1.2)}${label(120, 112, 'Strom fließt über die Straßen')}`),
  water: svg(`<path d="M0 98C60 88 100 108 160 98S220 92 240 98V120H0z" fill="${C.water}" opacity=".55"/>${road(20, 62, 230, 62)}<rect x="28" y="30" width="16" height="22" fill="#9fb3c8" stroke="${C.ink}" stroke-width="1.5"/><rect x="24" y="22" width="24" height="10" rx="3" fill="#c7d6e4" stroke="${C.ink}" stroke-width="1.5"/>${label(36, 16, 'Wasserturm')}${house(100, 52, C.res)}${house(126, 52, C.res)}${drop(104, 66, 0.8)}${drop(130, 66, 0.8)}<rect x="196" y="76" width="14" height="12" fill="#7a5a3a" stroke="${C.ink}" stroke-width="1.4"/><path d="M203 88v8" stroke="#7a5a3a" stroke-width="3"/>${label(203, 112, 'Abwasser', '#7a5a3a')}<path d="M60 108h110" stroke="#fff" stroke-width="1.6" marker-end="url(#hpA)"/><defs><marker id="hpA" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0l6 3-6 3z" fill="#fff"/></marker></defs>${label(120, 92, 'Fluss fließt →', '#fff')}`),
  garbage: svg(`${road(10, 70, 230, 70)}<circle cx="70" cy="56" r="52" fill="#a07a4a" opacity=".1" stroke="#a07a4a" stroke-dasharray="4 4"/><path d="M48 60l10-18h24l10 18z" fill="#a07a4a" stroke="${C.ink}" stroke-width="1.6"/>${label(70, 82, 'Deponie', '#7a5a2a')}<rect x="122" y="62" width="22" height="12" rx="2" fill="#4c8c4a" stroke="${C.ink}" stroke-width="1.3"/><rect x="144" y="65" width="8" height="9" rx="1.5" fill="#4c8c4a" stroke="${C.ink}" stroke-width="1.3"/><circle cx="128" cy="76" r="3" fill="${C.ink}"/><circle cx="147" cy="76" r="3" fill="${C.ink}"/>${house(170, 60, C.res)}${house(196, 60, C.res)}<path d="M176 40h6v6h-6z" fill="#a07a4a"/>${label(120, 112, 'Müllwagen holen den Müll im Umkreis')}`),
  services: svg(`${road(10, 74, 230, 74)}<circle cx="120" cy="58" r="56" fill="${C.bad}" opacity=".08" stroke="${C.bad}" stroke-width="1.6" stroke-dasharray="5 4"/><rect x="106" y="40" width="28" height="22" fill="#fff" stroke="${C.ink}" stroke-width="1.6"/><path d="M117 45h6v5h5v6h-5v5h-6v-5h-5v-6h5z" fill="${C.bad}"/>${house(56, 64, C.res)}${house(78, 64, C.res)}${house(150, 64, C.res)}${house(172, 64, C.res)}${house(212, 64, '#bbb')}${label(216, 92, 'zu weit', '#999')}${label(110, 108, 'Wirkt im Umkreis (Kreis beim Bauen)')}`),
  happiness: svg(`<circle cx="120" cy="52" r="30" fill="#ffe08a" stroke="${C.ink}" stroke-width="2"/><circle cx="110" cy="45" r="3" fill="${C.ink}"/><circle cx="130" cy="45" r="3" fill="${C.ink}"/><path d="M106 60q14 12 28 0" fill="none" stroke="${C.ink}" stroke-width="2.4" stroke-linecap="round"/>${['Strom', 'Wasser', 'Arbeit', 'Parks'].map((t, i) => label(24, 22 + i * 22, '+ ' + t, C.good, 'start')).join('')}${['Lärm', 'Abgase', 'Müll', 'Steuern'].map((t, i) => label(216, 22 + i * 22, t + ' −', C.bad, 'end')).join('')}${label(120, 108, 'Klick auf ein Haus zeigt die Gründe')}`),
  money: svg(`<rect x="96" y="30" width="48" height="40" rx="6" fill="#f2c230" stroke="${C.ink}" stroke-width="1.8"/>${label(120, 56, '€', C.ink)}<path d="M20 42h66" stroke="${C.good}" stroke-width="5" stroke-linecap="round"/><path d="M78 34l10 8-10 8" fill="none" stroke="${C.good}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M154 58h66" stroke="${C.bad}" stroke-width="5" stroke-linecap="round"/><path d="M212 50l10 8-10 8" fill="none" stroke="${C.bad}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${label(52, 30, 'Steuern', C.good)}${label(187, 84, 'Unterhalt', C.bad)}${label(120, 108, 'Plus am Tag = die Kasse wächst')}`),
  ubahn: svg(`<rect x="0" y="0" width="240" height="46" fill="${C.sky}"/><rect x="0" y="46" width="240" height="74" fill="${C.ground}"/>${house(20, 46, C.res)}${house(44, 46, C.res)}${house(176, 46, C.com)}${house(200, 46, C.off)}<rect x="10" y="78" width="220" height="20" rx="10" fill="#6b6357"/><rect x="70" y="82" width="60" height="12" rx="5" fill="#e8543f"/><rect x="74" y="85" width="9" height="5" rx="1" fill="#ffe9a8"/><rect x="88" y="85" width="9" height="5" rx="1" fill="#ffe9a8"/><rect x="102" y="85" width="9" height="5" rx="1" fill="#ffe9a8"/><rect x="116" y="85" width="9" height="5" rx="1" fill="#ffe9a8"/>${[60, 186].map((x) => `<path d="M${x} 46v32" stroke="${C.ink}" stroke-width="2"/><rect x="${x - 9}" y="30" width="18" height="16" rx="3" fill="${C.water}"/>${label(x, 42, 'U', '#fff')}`).join('')}${label(120, 114, 'Bahnhöfe nah an Wohnen und Arbeit', C.ink)}`),
  cards: svg(`${[[-14, 70, C.com], [0, 120, C.res], [14, 170, C.power]].map(([r, x, col], i) => `<g transform="rotate(${r} ${x} 70)"><rect x="${x - 26}" y="24" width="52" height="72" rx="7" fill="#fff" stroke="${C.ink}" stroke-width="1.8"/><rect x="${x - 26}" y="24" width="52" height="16" rx="7" fill="${col}"/>${label(x, 70, ['+€', '★', '%'][i], C.ink)}</g>`).join('')}${label(120, 114, 'Jede Woche: eine von drei Karten wählen')}`),
  disasters: svg(`<path d="M50 52a18 18 0 0 1 4-35 24 24 0 0 1 44 4 15 15 0 0 1 4 31z" fill="#9aa5b8" stroke="${C.ink}" stroke-width="1.8"/><path d="M72 56l-8 16h10l-6 18 18-24H74l6-10z" fill="${C.power}" stroke="${C.ink}" stroke-width="1.2" stroke-linejoin="round"/><path d="M168 20l34 12v20c0 22-16 34-34 40-18-6-34-18-34-40V32z" fill="${C.good}" opacity=".85" stroke="${C.ink}" stroke-width="1.8"/><path d="M154 54l10 10 20-22" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${label(120, 112, 'Vorsorge: Feuerwehr, Wetterstation, Sirene')}`),
  controls: svg(`<rect x="88" y="14" width="64" height="92" rx="32" fill="#fff" stroke="${C.ink}" stroke-width="2"/><path d="M120 14v38M88 52h64" stroke="${C.ink}" stroke-width="2"/><rect x="117" y="24" width="6" height="14" rx="3" fill="${C.ink}"/><path d="M90 50V40a30 30 0 0 1 28-24v36z" fill="${C.res}" opacity=".5"/><path d="M150 50V40a30 30 0 0 0-28-24v36z" fill="${C.com}" opacity=".5"/>${label(46, 36, 'Links:', C.ink)}${label(46, 50, 'bauen, wählen', C.ink)}${label(196, 36, 'Rechts:', C.ink)}${label(196, 50, 'verschieben', C.ink)}${label(196, 80, 'Rad: zoomen', C.ink)}${label(46, 80, 'Esc: abbrechen', C.ink)}`),
};

// ------------------------------------------------------------------ Themen
// act: Knopf „Zeigen" (ui.runAction) · lock(g): Hinweis, wenn noch gesperrt
const TOPICS = [
  { id: 'start', title: 'Erste Schritte', icon: 'star', lead: 'So bekommst du deine Stadt zum Laufen.', points: [
    'Baue eine Straße vom Ende der Autobahn ins Land.',
    'Weise daneben Wohngebiet aus. Die Leute bauen ihre Häuser selbst.',
    'Baue ein Kraftwerk und einen Wasserturm an die Straße.',
    'Lass die Zeit laufen. Dann kommen Gewerbe und Industrie für Jobs dazu, später eine Deponie.',
    'Der Begleiter links unten zeigt dir immer das nächste Ziel.',
  ], tour: true },
  { id: 'roads', title: 'Straßen', icon: 'roads', lead: 'Alles in der Stadt braucht einen Straßenanschluss.', points: [
    'Die Autobahn im Westen verbindet dich mit dem Umland. Von dort kommen neue Bürger und Waren.',
    'Gasse: billig und ruhig. Straße: der Standard. Allee: viel Platz für Autos (ab ' + ms(2) + ').',
    'Strom, Wasser, Müllwagen und Feuerwehr nutzen die Straßen.',
    `Brücken kosten etwa ${BRIDGE_FACTOR}-mal so viel. Abriss gibt kein Geld zurück.`,
  ], act: { cat: 'roads' }, actLabel: 'Straßen öffnen' },
  { id: 'zones', title: 'Zonen', icon: 'zones', lead: 'Du baust keine Häuser selbst: Du zeigst, wo gebaut werden darf.', points: [
    'Wohnen (grün): Hier wohnen die Bürger.',
    'Gewerbe (blau): Läden und Cafés. Sie brauchen Kundschaft und Waren.',
    'Industrie (gelb): Fabriken mit vielen Jobs, aber Abgasen. Halte Abstand zu Wohnhäusern.',
    `Büros (lila, ab ${ms(2)}): saubere Jobs für gebildete Leute.`,
    'Gebäude werden mit der Zeit größer, wenn Versorgung, Bildung und Glück stimmen.',
    'Bodenwert heißt: so wertvoll ist ein Grundstück. Parks, Ruhe und Wahrzeichen heben ihn, Lärm und Abgase senken ihn.',
  ], act: { cat: 'zones' }, actLabel: 'Zonen öffnen' },
  { id: 'demand', title: 'Nachfrage', icon: 'stats', lead: 'Die Balken oben zeigen, was deine Stadt gerade braucht.', points: [
    'W = Wohnen, G = Gewerbe, I = Industrie, B = Büro.',
    'Ein hoher Balken heißt: gefragt. Weise davon mehr aus.',
    'Ein blasser Balken nach unten heißt: zu viel. Dann bleiben Flächen leer.',
    'Alles hängt zusammen: Neue Bürger brauchen Jobs, Firmen brauchen Arbeitskräfte und Kunden.',
  ] },
  { id: 'power', title: 'Strom', icon: 'power', lead: 'Ohne Strom zieht niemand ein und kein Betrieb arbeitet.', points: [
    'Baue ein Kraftwerk direkt an eine Straße. Der Strom fließt über die Straßen.',
    'Ein Straßennetz ohne Verbindung braucht ein eigenes Kraftwerk.',
    'Kohle ist billig, aber schmutzig. Wind ist sauber, liefert aber wenig. Bessere Kraftwerke kommen mit den Meilensteinen.',
    'Die Infoansicht „Strom" zeigt in Rot, wo er fehlt.',
  ], act: { view: 'power' }, actLabel: 'Stromnetz zeigen' },
  { id: 'water', title: 'Wasser & Abwasser', icon: 'water', lead: 'Häuser brauchen sauberes Wasser – und größere Häuser einen Kanal.', points: [
    'Ein Wasserturm passt überall hin. Ein Pumpwerk liefert mehr, muss aber am Ufer stehen.',
    'Auch Wasser fließt über die Straßen. Pumpwerke brauchen Strom.',
    'Ab etwa 300 Einwohnern brauchen größere Häuser Abwasser: Baue einen Abwasserauslass am Ufer.',
    'Setze den Auslass flussabwärts und weit weg vom Pumpwerk. Sonst wird das Trinkwasser schmutzig.',
    `Ab ${ms(2)} reinigt eine Kläranlage das Abwasser.`,
  ], act: { view: 'water' }, actLabel: 'Wassernetz zeigen' },
  { id: 'garbage', title: 'Müll', icon: 'garbage', lead: 'Wo Menschen leben, fällt Müll an.', points: [
    'Eine Deponie schickt Müllwagen in ihren Umkreis.',
    'Ist sie voll oder zu weit weg, stapelt sich der Müll. Das macht unglücklich und krank.',
    'Deponien riechen: Baue sie etwas abseits der Häuser.',
    'Später helfen Müllverbrennung (macht Strom) und Recyclinghof.',
  ], act: { view: 'garbage' }, actLabel: 'Müllabfuhr zeigen' },
  { id: 'services', title: 'Dienste & Bildung', icon: 'services', lead: `Ab ${ms(1)} kümmern sich Dienste um deine Bürger.`, points: [
    'Feuerwehr löscht Brände. Polizei senkt die Kriminalität. Arztpraxen halten gesund.',
    'Schulen bilden die Bürger. Gebildete Bürger bauen größere Häuser und arbeiten in Büros.',
    'Jeder Dienst wirkt im Umkreis. Beim Bauen siehst du den Kreis.',
    'Die Infoansichten zeigen, wo ein Dienst fehlt. Dienste brauchen Strom und Wasser.',
  ], act: { cat: 'services' }, actLabel: 'Dienste öffnen' },
  { id: 'happiness', title: 'Glück', icon: 'people', lead: 'Glückliche Bürger bleiben, zahlen Steuern und bauen größer.', points: [
    'Gut: Strom, Wasser, Arbeit, Dienste in der Nähe, Parks und kurze Wege.',
    'Schlecht: Lärm, Abgase, Müll, Kriminalität, Stau und hohe Steuern.',
    'Klicke ein Wohnhaus an: Dort steht, was die Leute freut oder stört.',
    'Sehr unglückliche Bürger ziehen weg. Dann stehen Häuser leer.',
  ], act: { view: 'happiness' }, actLabel: 'Glück zeigen' },
  { id: 'money', title: 'Geld & Steuern', icon: 'budget', lead: 'Die Stadt lebt von Steuern und zahlt den Unterhalt.', points: [
    'Einnahmen: Steuern von Bürgern und Firmen, später auch Fahrkarten und Touristen.',
    'Ausgaben: Jedes Gebäude und jede Straße kostet jeden Tag Unterhalt.',
    'Unter der Kasse steht das Plus oder Minus pro Tag.',
    'Höhere Steuern bringen mehr Geld, machen aber unglücklicher. Kleine Schritte!',
    `Kredite gibt es ab ${ms(2)}. Bei jedem Meilenstein gibt es eine Belohnung.`,
  ], act: { panel: 'budget' }, actLabel: 'Haushalt öffnen' },
  { id: 'ubahn', title: 'U-Bahn', icon: 'transit', lead: 'Die Pulsbahn ist die U-Bahn deiner Stadt. Sie fährt im Tunnel unter der Erde.', points: [
    'Zeichne eine Linie: Klicke oder tippe nacheinander die Orte der Bahnhöfe an. Enter, Rechtsklick oder „Fertig" beendet die Linie.',
    'Setze Bahnhöfe nah an Wohnviertel und Arbeitsplätze. Jeder Bahnhof sammelt Fahrgäste im Umkreis.',
    'Weniger Autos heißt weniger Stau und weniger Lärm.',
    'Die Strecken liegen im Tunnel – darüber darfst du so hoch bauen, wie du willst. Oben siehst du nur die Eingänge mit dem blauen „U" und eine feine Linie am Boden.',
    'Beim Linien-Werkzeug schaltet sich die Untergrund-Ansicht ein: Dann siehst du Tunnel, Bahnsteige und Züge. Im Menü „Ansichten" kannst du sie auch selbst einschalten.',
    'Ist ein Bahnhof überfüllt, setze mehr Züge oder Wagen ein.',
    'Jede Ankunft spielt einen Ton – deine Stadt macht Musik.',
  ], act: { cat: 'transit' }, actLabel: 'U-Bahn öffnen', lock: (g) => (g.isUnlocked('transit') ? null : `Noch gesperrt: ab ${ms(2)}.`) },
  { id: 'cards', title: 'Meilensteine & Wochenkarten', icon: 'trophy', lead: 'Wächst deine Stadt, gibt es Belohnungen.', points: [
    `Meilensteine: ${MILESTONES.slice(1, 5).map((m) => `${m.name} (${fmt(m.pop)})`).join(', ')} und mehr. Jeder bringt Geld und neue Gebäude.`,
    `Ab ${ms(1)} wählst du jede Woche eine von drei Wochenkarten: ein Bonus, ein Auftrag oder ein Gutschein für ein Wahrzeichen.`,
    'Aufträge der Stadträte bringen Geld, wenn du sie rechtzeitig erfüllst.',
    'Erfolge sammelst du nebenbei. Du findest sie im Fenster „Fortschritt".',
  ], act: { panel: 'progression' }, actLabel: 'Fortschritt zeigen' },
  { id: 'disasters', title: 'Wetter & Katastrophen', icon: 'weather', lead: 'Das Wetter wechselt mit den Jahreszeiten.', points: [
    'Im Winter heizen die Leute mehr und Schnee bremst den Verkehr.',
    'Gewitter, Stürme und Hochwasser kommen vor. Große Städte erleben auch Erdbeben.',
    'Vorsorge hilft: Feuerwachen, Wetterstation, Warnsirenen und Hochwasserschutz.',
    'Katastrophen lassen sich im Fenster „Wetter" abschwächen oder abschalten.',
  ], act: { panel: 'weather' }, actLabel: 'Wetter öffnen' },
  { id: 'controls', title: 'Bedienung', icon: 'keyboard', lead: 'Kamera und Werkzeuge.', points: [
    'Linke Maustaste: bauen, ziehen, auswählen. Klick auf ein Gebäude zeigt seine Infos.',
    'Rechte Maustaste: Karte verschieben. Mausrad: zoomen. Mittlere Maustaste: drehen.',
    'Auf Handy und Tablet: Ein Finger verschiebt die Karte, zwei Finger drehen und zoomen. Zum Bauen tippst du auf die Karte (bei Straßen und Zonen ziehst du dann den Griff), prüfst die Vorschau und bestätigst mit ✓ Bauen.',
    'Esc bricht ein Werkzeug ab. Leertaste pausiert. 1, 2, 3 ändern das Tempo.',
  ], keys: true },
];

export function helpTopics() { return TOPICS.map(({ id, title, icon: i }) => ({ id, title, icon: i })); }

// Passendes Thema zu Kategorie, Gebäude oder Infoansicht
const MAP = {
  roads: 'roads', zones: 'zones', power: 'power', water: 'water', sewage: 'water', garbage: 'garbage', services: 'services', education: 'services',
  edu: 'services', health: 'services', police: 'services', fire: 'services', crime: 'services', parks: 'happiness', happiness: 'happiness', happy: 'happiness', landmarks: 'cards',
  transit: 'ubahn', line: 'ubahn', transport: 'roads', traffic: 'roads', safety: 'disasters', weather: 'disasters', budget: 'money', policies: 'money',
  demand: 'demand', progression: 'cards', noise: 'happiness', pollution: 'happiness', landValue: 'happiness',
};
export function helpTopicFor(x) {
  if (!x) return 'start';
  if (MAP[x]) return MAP[x];
  const d = BUILDINGS[x];
  if (d && MAP[d.cat]) return MAP[d.cat];
  return 'start';
}

// ------------------------------------------------------------------ Darstellung
const CSS = `
.hp { width: min(864px, 100%); height: min(600px, calc(100vh - 40px)); display: flex; flex-direction: column; padding: 0 !important; overflow: hidden; background: var(--head-bg, var(--accent-soft, #f1ecff)) !important; border-radius: 28px; }
.hp .hp-head { display: flex; align-items: center; gap: 12px; padding: 16px 16px 12px 24px; }
.hp .hp-head .grow { flex: 1; }
.hp .hp-head h2 { margin: 0; font: 600 22px/1.2 var(--f-display, var(--f-ui, system-ui)); color: var(--accent-ink, #2a1f5c); }
.hp .hp-head .eyebrow { font: 600 12.5px/1.2 var(--f-display, var(--f-ui, system-ui)); letter-spacing: .02em; color: var(--accent, #6c4fe0); }
.hp .hp-x { width: 36px; height: 36px; border-radius: 12px; display: grid; place-items: center; border: 0; background: var(--m-violet, var(--accent, #6c4fe0)); box-shadow: var(--e-violet, none); color: #fff; cursor: pointer; }
.hp .hp-x svg { filter: drop-shadow(0 1px 0 rgba(28, 6, 78, .5)); }
.hp .hp-x:hover { filter: brightness(1.1); }
.hp .hp-x:active { transform: translateY(2px); box-shadow: var(--p-violet, none); }
.hp .hp-body { flex: 1; min-height: 0; display: flex; gap: 12px; padding: 0 16px 16px; }
.hp .hp-nav { width: 224px; flex: none; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; padding: 2px 2px 6px; }
.hp .hp-nav button { display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 0 12px; border-radius: 12px; border: 0; background: var(--card-bg, var(--card, #fff)); box-shadow: inset 0 1px 0 #fff, inset 0 0 0 1px rgba(91, 47, 179, .08), 0 1px 0 rgba(91, 47, 179, .14); font: 700 14px/1.2 var(--f-ui, system-ui); color: var(--accent-ink, #2a1f5c); cursor: pointer; text-align: left; }
.hp .hp-nav button:hover { filter: brightness(.99); color: var(--accent, #6c4fe0); }
.hp .hp-nav button:active { transform: translateY(1px); box-shadow: inset 0 0 0 1px rgba(91, 47, 179, .12), inset 0 2px 4px rgba(52, 19, 122, .14); }
.hp .hp-nav button.on { background: var(--m-violet, var(--accent, #6c4fe0)); box-shadow: var(--e-violet, none); color: #fff; text-shadow: var(--ts-violet, none); }
.hp .hp-nav button svg { flex: none; opacity: .9; }
.hp .hp-topic { flex: 1; min-width: 0; overflow-y: auto; padding: 20px 24px 20px; background: var(--card-bg, var(--card, #fff)); border-radius: 20px; box-shadow: var(--inner-hi, none), 0 0 0 1px rgba(52, 19, 122, .07), 0 8px 20px -12px rgba(52, 19, 122, .35); }
.hp .hp-topic h3 { margin: 0 0 4px; font: 600 22px/1.2 var(--f-display, var(--f-ui, system-ui)); color: var(--accent-ink, #2a1f5c); text-wrap: balance; }
.hp .hp-topic .lead { margin: 0 0 12px; font-size: 15px; line-height: 1.5; color: var(--ink-2, #3b4252); max-width: 62ch; }
.hp .hp-svg { display: block; width: 100%; max-width: 420px; height: auto; margin: 4px 0 16px; background: linear-gradient(180deg, #fbf8ff, #f1ebfd); border-radius: 16px; box-shadow: inset 0 0 0 1px rgba(91, 47, 179, .08), inset 0 1px 0 #fff; }
.hp .hp-topic ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; max-width: 66ch; }
.hp .hp-topic li { position: relative; padding-left: 20px; font-size: 14.5px; line-height: 1.5; color: var(--ink, #1d2330); }
.hp .hp-topic li::before { content: ''; position: absolute; left: 3px; top: .55em; width: 8px; height: 8px; border-radius: 50%; background: var(--m-violet, var(--accent, #6c4fe0)); }
.hp .hp-lock { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; padding: 8px 12px; border-radius: 12px; background: #fff3d6; box-shadow: inset 0 0 0 1px rgba(200, 130, 0, .22); color: var(--ink, #1d2330); font-size: 13.5px; font-weight: 700; }
.hp .hp-acts { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 20px; }
.hp .hp-btn { font: 600 15px/1 var(--f-display, var(--f-ui, system-ui)); height: 44px; padding: 0 18px; border-radius: 12px; border: 0; cursor: pointer; color: #fff; background: var(--m-amber, linear-gradient(180deg, var(--cta, #ffb23e), var(--cta-2, #ff8a00))); box-shadow: var(--e-amber, 0 3px 0 var(--cta-edge, #d96a00)); text-shadow: var(--ts-amber, 0 1px 0 rgba(0,0,0,.15)); display: inline-flex; align-items: center; gap: 8px; }
.hp .hp-btn.ghost { background: var(--m-soft, var(--accent-soft, #f1ecff)); color: var(--accent, #2a1f5c); box-shadow: var(--e-soft, none); text-shadow: none; }
.hp .hp-btn:hover { filter: brightness(1.05); }
.hp .hp-btn:active { transform: translateY(2px); box-shadow: var(--p-amber, none); }
.hp .hp-btn.ghost:active { box-shadow: var(--p-soft, none); }
@media (max-width: 760px) {
  .hp { height: calc(100vh - 24px); border-radius: 24px; }
  .hp .hp-head { padding: 12px 12px 10px 16px; }
  .hp .hp-body { flex-direction: column; padding: 0 10px 10px; gap: 10px; }
  .hp .hp-nav { width: auto; flex-direction: row; overflow-x: auto; overflow-y: hidden; padding: 2px 2px 6px; gap: 6px; scrollbar-width: none; flex: none; }
  .hp .hp-nav button { white-space: nowrap; min-height: 36px; padding: 0 14px; font-size: 13px; border-radius: var(--r-pill, 999px); }
  .hp .hp-nav button svg { display: none; }
  .hp .hp-topic { padding: 16px 16px 18px; }
  .hp .hp-topic h3 { font-size: 19px; }
  .hp .hp-topic li { font-size: 14px; }
}
`;
function injectStyle() {
  if (document.getElementById('hp-style')) return;
  const st = document.createElement('style');
  st.id = 'hp-style';
  st.textContent = CSS;
  document.head.appendChild(st);
}

function topicHTML(t, g) {
  const lock = t.lock && g ? t.lock(g) : null;
  const acts = [];
  if (t.tour) acts.push(`<button class="hp-btn" data-hp="tour">${ic('play', 15, 2.4)} Einführung starten</button>`);
  if (t.act && !lock) acts.push(`<button class="hp-btn${t.tour ? ' ghost' : ''}" data-hp="act">${esc(t.actLabel || 'Zeigen')} ${ic('arrowR', 15, 2.4)}</button>`);
  if (t.keys) acts.push(`<button class="hp-btn ghost" data-hp="keys">${ic('keyboard', 15)} Alle Tastenkürzel</button>`);
  return `<h3>${esc(t.title)}</h3><p class="lead">${esc(t.lead)}</p>${lock ? `<div class="hp-lock">${ic('lock', 15, 2.4)}${esc(lock)}</div>` : ''}${SKETCH[t.id] || ''}<ul>${t.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>${acts.length ? `<div class="hp-acts">${acts.join('')}</div>` : ''}`;
}

export function openHelp(ui, topicId) {
  if (!ui || typeof ui.openModal !== 'function') return null;
  injectStyle();
  const existing = ui.modalRoot && ui.modalRoot.querySelector('.hp');
  let cur = TOPICS.find((t) => t.id === topicId) || (TOPICS.find((t) => t.id === helpTopicFor(topicId)) || TOPICS[0]);
  if (existing) { existing.querySelector('.hp-topic').innerHTML = topicHTML(cur, ui.g); mark(existing, cur.id); return existing; }
  const nav = TOPICS.map((t) => `<button data-hp="topic" data-id="${t.id}" class="${t.id === cur.id ? 'on' : ''}">${ic(t.icon, 17)}<span>${esc(t.title)}</span></button>`).join('');
  const html = `<div class="modal hp" role="dialog" aria-label="Hilfe"><div class="hp-head"><div><div class="eyebrow">Hilfe</div><h2>So funktioniert's</h2></div><span class="grow"></span><button class="hp-x" data-hp="close" aria-label="Hilfe schließen">${ic('close', 18, 2.4)}</button></div>
<div class="hp-body"><nav class="hp-nav">${nav}</nav><article class="hp-topic">${topicHTML(cur, ui.g)}</article></div></div>`;
  const wrap = ui.openModal(html, (e, close) => {
    if (e.target.classList.contains('backdrop')) { close(); return; }
    const b = e.target.closest('[data-hp]');
    if (!b) return;
    try { ui.app.audio.play('click'); } catch (err) { /* egal */ }
    const a = b.dataset.hp;
    if (a === 'close') close();
    else if (a === 'topic') {
      cur = TOPICS.find((t) => t.id === b.dataset.id) || cur;
      const art = wrap.querySelector('.hp-topic');
      art.innerHTML = topicHTML(cur, ui.g);
      art.scrollTop = 0;
      mark(wrap, cur.id);
    } else if (a === 'tour') { close(); if (ui.onboarding && ui.onboarding.start) setTimeout(() => ui.onboarding.start(), 220); }
    else if (a === 'act' && cur.act) { close(); ui.runAction(cur.act); }
    else if (a === 'keys') { close(); if (ui.showKeys) setTimeout(() => ui.showKeys(), 220); }
  });
  const on = wrap.querySelector('.hp-nav .on');
  if (on && on.scrollIntoView) try { on.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* egal */ }
  return wrap;
}
function mark(root, id) { for (const b of root.querySelectorAll('.hp-nav button')) b.classList.toggle('on', b.dataset.id === id); }
