// Einstieg: geführte Einführung (Spotlight auf Bedienelemente, jeder Schritt erkennt selbst, wann er erledigt ist)
// und danach der ruhige Begleiter „Nächstes Ziel" (genau ein Ziel mit Knopf zum passenden Werkzeug).
// Besitzer: Agent EINSTIEG. Die Oberfläche (ui.js) ruft nur diese Schnittstelle auf:
//   const ob = new Onboarding(ui)   // im Konstruktor der Oberfläche, nach mount()
//   ob.update(dt)                   // jedes Bild
//   ob.onEvent(name, data)          // 'cat' | 'tool' | 'panel' | 'view' (und gern 'build', 'zone', 'road')
//   ob.active()                     // true, solange die Einführung läuft (Oberfläche blendet dann Störendes aus)
//   ob.start() / ob.stop()          // Einführung (neu) starten bzw. beenden – z. B. aus Hilfe oder Optionen
//   ob.replacesTutorial             // true: Die alte Karte „Erste Schritte" wird nicht mehr gebraucht
//   ob.dispose()
// Ziele für das Spotlight: data-tour="…" (Liste in swarm/U-BAHN-UND-UI.md), ui.tourTarget(id) falls vorhanden,
// sonst Rückfall auf die bisherigen Selektoren. Begleiter-Platz: [data-slot="guide"], sonst links unten.
import { R, Z, BUILDINGS, MILESTONES } from '../config.js';
import { fmt } from '../util.js';
import { cityCounts } from './advisor.js';
import { openHelp } from './help.js';
import { icon } from './icons.js';
import * as META from './meta.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ic = (name, size = 16, stroke = 2.2) => { try { return icon(name, size, stroke); } catch (e) { return ''; } };
const isMetro = (g) => !!(g.opts && g.opts.scenario === 'metro');

// ------------------------------------------------------------------ Ziele finden
const LEGACY = {
  toolbar: '#u-toolbar', tray: '#u-tray', speed: '#u-speed', time: '#hud .clock', demand: '#hud .demand',
  'stat-pop': '#hud [data-stat=pop]', 'stat-money': '#hud [data-stat=money]', 'stat-happy': '#hud [data-stat=happy]',
  views: '#u-views', city: '#u-dock', notes: '#hud [data-sys=notes]', settings: '#hud [data-sys=settings]',
  help: '#hud [data-sys=help], #hud [data-act=help], #hud [data-sys=keys]', guide: '#ob-guide',
};
const ITEM_ZONE = { res: Z.RES, com: Z.COM, ind: Z.IND, off: Z.OFF };
const ITEM_ROAD = { lane: R.LANE, street: R.STREET, avenue: R.AVENUE };
function legacySelector(id) {
  if (LEGACY[id]) return LEGACY[id];
  if (id.startsWith('cat-')) return `#hud .cat[data-cat="${id.slice(4)}"]`;
  if (id.startsWith('item-')) {
    const k = id.slice(5);
    if (ITEM_ZONE[k]) return `#hud button.item[data-kind="zone"][data-zone="${ITEM_ZONE[k]}"]`;
    if (ITEM_ROAD[k]) return `#hud button.item[data-kind="road"][data-type="${ITEM_ROAD[k]}"]`;
    return `#hud button.item[data-key="${k}"]`;
  }
  return null;
}
function visible(el) {
  if (!el || !el.isConnected || el.closest('[hidden]')) return false;
  const r = el.getBoundingClientRect();
  return r.width > 2 && r.height > 2 && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
}
function queryVisible(sel) {
  if (!sel) return null;
  for (const el of document.querySelectorAll(sel)) if (visible(el)) return el;
  return null;
}
// Liegt das Element in einer waagerecht scrollenden Leiste außerhalb des sichtbaren Teils?
function clippedInScroller(el) {
  let p = el.parentElement;
  for (let k = 0; p && k < 5; k++, p = p.parentElement) {
    if (p.scrollWidth > p.clientWidth + 4) {
      const a = el.getBoundingClientRect(), b = p.getBoundingClientRect();
      return a.left < b.left - 2 || a.right > b.right + 2;
    }
  }
  return false;
}

// ------------------------------------------------------------------ Schritte der Einführung
// done(c) → erledigt? · hint(c) → { target: [ids …] (erstes sichtbares gewinnt), text, map?: 'highway' }
// info: true → Schritt mit Knopf statt Aufgabe
const verb = (c) => (c.touch ? 'Tippe' : 'Klicke');
// Touch (Handy, Tablet): Bauen erst nach Bestätigung, ein Finger verschiebt die Karte
const CONFIRM = 'Prüfe die Vorschau, dann tippe auf ✓ Bauen.';
const placing = (c, cat) => c.tool.kind === 'place' && BUILDINGS[c.tool.key] && BUILDINGS[c.tool.key].cat === cat;
// Hauptgruppe der Werkzeugleiste zu einer Kategorie (neue Oberfläche: Straßen, Zonen, Versorgung …)
const GROUP_FALLBACK = { roads: 'roads', zones: 'zones', power: 'versorgung', water: 'versorgung', garbage: 'versorgung' };
function groupOf(cat) { try { return (META.groupOfCat && META.groupOfCat(cat)) || GROUP_FALLBACK[cat] || cat; } catch (e) { return GROUP_FALLBACK[cat] || cat; } }
function groupName(gid) { try { const gr = (META.GROUPS || []).find((x) => x.id === gid); return gr ? gr.name : null; } catch (e) { return null; } }
// Weg durch den Katalog: Eintrag → Reiter → Hauptgruppe. Das erste sichtbare Ziel gewinnt, der Text passt dazu.
function menuHint(c, { cat, catName, items, itemText, why }) {
  const gid = groupOf(cat), gname = groupName(gid) || catName;
  const texts = {};
  for (const k of items) texts['item-' + k] = itemText;
  texts['cat-' + cat] = `${why} ${verb(c)} auf „${catName}".`;
  texts['group-' + gid] = `${why} ${verb(c)} unten auf „${gname}".`;
  return { target: [...items.map((k) => 'item-' + k), 'cat-' + cat, 'group-' + gid], texts, text: texts['cat-' + cat] };
}
function pickHint(c, o) {
  if (placing(c, o.cat)) return { target: [], text: c.touch ? `${o.placeTouch} ${CONFIRM}` : o.placeText };
  return menuHint(c, o);
}

const STEPS = [
  {
    id: 'welcome', info: true, title: (c) => `Willkommen in ${c.g.name}!`,
    hint: () => ({ text: 'Hier baust du deine eigene Stadt. In acht kurzen Schritten zeige ich dir das Wichtigste – das dauert nur ein paar Minuten.' }),
    btn: 'Los geht\'s', alt: 'Ohne Einführung spielen',
  },
  {
    id: 'road', title: 'Straße bauen', build: (c) => c.tool.kind === 'road',
    done: (c) => c.n.roads >= 4,
    hint: (c) => {
      if (c.tool.kind === 'road') return { target: [], map: c.n.roads ? null : 'highway', text: c.touch ? `${c.n.roads ? 'Gut! Bau die Straße noch ein Stück weiter ins Land.' : 'Tippe ans Ende der Autobahn (Kreis) und dann ein Stück weiter ins Land.'} ${CONFIRM} Mit einem Finger verschiebst du die Karte.` : c.n.roads ? 'Gut! Zieh die Straße noch ein Stück weiter ins Land.' : 'Halte die linke Maustaste gedrückt und ziehe vom Ende der Autobahn (roter Kreis) eine Straße ins Land.' };
      return menuHint(c, { cat: 'roads', catName: 'Straßen', items: ['street'], itemText: 'Wähle „Straße".', why: 'Alles in der Stadt braucht eine Straße.' });
    },
  },
  {
    id: 'res', title: 'Wohngebiet ausweisen', build: (c) => c.tool.kind === 'zone' && c.tool.zone === Z.RES,
    done: (c) => c.n.zone[Z.RES] >= 6,
    hint: (c) => {
      if (c.tool.kind === 'zone' && c.tool.zone === Z.RES) return { target: [], text: c.touch ? `Wähle direkt neben der Straße eine Fläche: Tippe auf die Karte. ${CONFIRM} Häuser entstehen nur an Straßen.` : 'Ziehe direkt neben der Straße eine Fläche auf. Dort bauen Familien ihre Häuser – Häuser entstehen nur an Straßen.' };
      return menuHint(c, { cat: 'zones', catName: 'Zonen', items: ['res'], itemText: 'Wähle „Wohnen" (grün).', why: 'Jetzt brauchst du Platz für Häuser.' });
    },
  },
  {
    id: 'power', title: 'Strom liefern', build: (c) => placing(c, 'power'),
    done: (c) => c.g.countBuilt('power') > 0,
    hint: (c) => pickHint(c, { cat: 'power', catName: 'Strom', items: ['coal', 'wind'], why: 'Ohne Strom zieht niemand ein.',
      itemText: 'Wähle das Kohlekraftwerk: günstig und stark. Windräder sind sauberer, liefern aber wenig.',
      placeText: 'Setze das Kraftwerk direkt an eine Straße. Der Strom fließt über die Straßen zu allen Häusern.',
      placeTouch: 'Tippe auf einen Platz direkt an einer Straße. Der Strom fließt über die Straßen zu allen Häusern.' }),
  },
  {
    id: 'water', title: 'Wasser liefern', build: (c) => placing(c, 'water'),
    done: (c) => ['watertower', 'pump', 'waterworks'].some((k) => c.g.hasBuilt(k)),
    hint: (c) => pickHint(c, { cat: 'water', catName: 'Wasser', items: ['watertower'], why: 'Auch Wasser muss sein.',
      itemText: 'Wähle den Wasserturm. Er passt überall hin.',
      placeText: 'Setze den Wasserturm an eine Straße. Wasser fließt ebenfalls über die Straßen.',
      placeTouch: 'Tippe auf einen Platz an einer Straße.' }),
  },
  {
    id: 'time', title: 'Zeit laufen lassen',
    done: (c) => c.g.stats.pop >= 20,
    hint: (c) => {
      const s = c.g.stats;
      if (s.unpowered > 0 && c.g.countBuilt('power') > 0) return { target: ['speed'], text: 'Einige Häuser haben keinen Strom. Das Kraftwerk muss über Straßen mit ihnen verbunden sein.' };
      if (s.unwatered > 0) return { target: ['speed'], text: 'Einige Häuser haben kein Wasser. Der Wasserturm muss an derselben Straße stehen und braucht Strom.' };
      if (c.g.speed === 0) return { target: ['speed'], text: `Das Spiel ist pausiert. ${verb(c)} auf ▶, damit die Zeit weiterläuft.` };
      return { target: ['speed'], text: s.pop > 0 ? `Die ersten Familien ziehen ein! Mit diesen Knöpfen läuft die Zeit schneller. (${fmt(s.pop)} von 20 Einwohnern)` : 'Die ersten Häuser werden gebaut. Mit diesen Knöpfen läuft die Zeit schneller.' };
    },
  },
  {
    id: 'jobs', title: 'Arbeit schaffen', build: (c) => c.tool.kind === 'zone' && (c.tool.zone === Z.COM || c.tool.zone === Z.IND),
    done: (c) => c.n.zone[Z.COM] >= 4 && c.n.zone[Z.IND] >= 4,
    hint: (c) => {
      const needCom = c.n.zone[Z.COM] < 4, z = needCom ? Z.COM : Z.IND;
      const name = needCom ? 'Gewerbe' : 'Industrie', key = needCom ? 'com' : 'ind';
      if (c.tool.kind === 'zone' && c.tool.zone === z) return { target: ['demand'], text: (needCom ? `${c.touch ? 'Wähle an einer Straße eine Fläche für Gewerbe.' : 'Ziehe Gewerbe an eine Straße.'} Die Balken oben zeigen, was gefragt ist: W Wohnen, G Gewerbe, I Industrie.` : `${c.touch ? 'Wähle an einer Straße eine Fläche für Industrie' : 'Ziehe Industrie an eine Straße'} – mit etwas Abstand zu den Häusern, denn Fabriken machen Abgase.`) + (c.touch ? ' ' + CONFIRM : '') };
      return menuHint(c, { cat: 'zones', catName: 'Zonen', items: [key], itemText: `Wähle „${name}" (${needCom ? 'blau' : 'gelb'}).`, why: 'Deine Bürger brauchen Arbeit und Läden.' });
    },
  },
  {
    id: 'garbage', title: 'Müll abholen', build: (c) => placing(c, 'garbage'),
    done: (c) => c.g.countBuilt('garbage') > 0,
    hint: (c) => pickHint(c, { cat: 'garbage', catName: 'Müll', items: ['landfill'], why: 'Wo Menschen wohnen, fällt Müll an.',
      itemText: 'Wähle die Deponie. Ihre Müllwagen holen den Müll ab.',
      placeText: 'Setze die Deponie an eine Straße, etwas abseits der Häuser – sie riecht.',
      placeTouch: 'Tippe auf einen Platz an einer Straße, etwas abseits der Häuser.' }),
  },
  {
    id: 'happy', info: true, title: 'Glück verstehen',
    done: (c) => c.viewAge > 9,
    hint: (c) => (c.view === 'happiness'
      ? { target: [], text: 'Grün heißt glücklich, rot unglücklich. Klicke ein Wohnhaus an: Dort stehen die Gründe. Strom, Wasser, Arbeit, Parks und Ruhe machen froh.' }
      : { target: ['stat-happy'], text: `Hier siehst du, wie glücklich deine Bürger sind. Glückliche Bürger bleiben und zahlen Steuern. ${verb(c)} darauf.` }),
    btn: 'Verstanden',
  },
  {
    id: 'finish', info: true, title: 'Gut gemacht!',
    hint: (c) => ({ target: ['guide', 'help'], text: `Deine Stadt lebt. Ab jetzt steht ${c.touch ? 'unten' : 'links unten'} immer dein nächstes Ziel. Und unter „?" erklärt dir die Hilfe alles in Ruhe. Nächster Meilenstein: „${MILESTONES[1].name}" mit ${fmt(MILESTONES[1].pop)} Einwohnern.` }),
    btn: 'Los, weiterbauen!',
  },
];
const TASKS = STEPS.filter((s) => !s.info || s.id === 'happy').length;

// ------------------------------------------------------------------ Styles
const CSS = `
#ob-layer { position: absolute; inset: 0; pointer-events: none; z-index: 46; --ob-hi: var(--cta-2, #ff8a00); }
#ob-layer[hidden] { display: none; }
.ob-ring { position: fixed; border-radius: 16px; box-shadow: 0 0 0 3px var(--ob-hi), 0 0 0 9px color-mix(in srgb, var(--ob-hi) 30%, transparent); transition: left .25s var(--ease-out, ease), top .25s var(--ease-out, ease), width .25s var(--ease-out, ease), height .25s var(--ease-out, ease), opacity .2s; animation: obPulse 1.6s ease-in-out infinite; }
.ob-ring.dim { box-shadow: 0 0 0 3px var(--ob-hi), 0 0 0 9px color-mix(in srgb, var(--ob-hi) 30%, transparent), 0 0 0 100vmax rgba(30, 18, 70, 0.22); animation: none; }
@keyframes obPulse { 50% { box-shadow: 0 0 0 3px var(--ob-hi), 0 0 0 14px color-mix(in srgb, var(--ob-hi) 10%, transparent); } }
.ob-mark { position: fixed; width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 50%; border: 3px solid var(--ob-hi); background: color-mix(in srgb, var(--ob-hi) 24%, transparent); animation: obMark 1.4s ease-out infinite; }
.ob-mark::after { content: attr(data-label); position: absolute; left: 50%; top: 40px; transform: translateX(-50%); white-space: nowrap; font: 800 12px/1 var(--f-ui, system-ui); color: #fff; background: linear-gradient(180deg, var(--cta, #ffb23e), var(--cta-2, #ff8a00)); padding: 6px 10px; border-radius: var(--r-pill, 999px); box-shadow: 0 3px 0 var(--cta-edge, #d96a00), 0 6px 14px rgba(0,0,0,.2); }
@keyframes obMark { 0% { transform: scale(.8); } 60% { transform: scale(1.15); } 100% { transform: scale(.8); } }
.ob-card { position: fixed; pointer-events: auto; width: 320px; max-width: calc(100vw - 24px); background: var(--card, #fff); color: var(--ink, #1d2330); border: 2px solid var(--accent-soft, #ece6ff); border-radius: 18px; box-shadow: var(--shadow, 0 10px 30px rgba(40,24,90,.18)); padding: 13px 16px 14px; font-family: var(--f-ui, system-ui); zoom: var(--ui, 1); transition: opacity .2s ease; }
.ob-card.enter { animation: obIn .35s var(--ease-out, ease); }
@keyframes obIn { from { opacity: 0; transform: translateY(6px) scale(.98); } }
.ob-card .ob-top { display: flex; align-items: center; gap: 8px; font-size: 11.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--accent, #6c4fe0); }
.ob-card .ob-top .grow { flex: 1; }
.ob-card .ob-x { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; color: #fff; background: var(--accent, #6c4fe0); border: 0; cursor: pointer; }
.ob-card .ob-x:hover { filter: brightness(1.12); }
.ob-card .ob-bar { height: 5px; border-radius: 5px; background: var(--accent-soft, #ece6ff); margin: 7px 0 10px; overflow: hidden; }
.ob-card .ob-bar i { display: block; height: 100%; background: var(--accent, #6c4fe0); border-radius: 5px; transition: width .4s var(--ease-out, ease); }
.ob-card h3 { margin: 0 0 4px; font: 800 17px/1.25 var(--f-display, var(--f-ui, system-ui)); color: var(--accent-ink, var(--ink, #2a1f5c)); text-wrap: balance; }
.ob-card p { margin: 0; font-size: 14px; line-height: 1.45; color: var(--ink-2, #3b4252); }
.ob-card .ob-acts { display: flex; align-items: center; gap: 12px; margin-top: 12px; flex-wrap: wrap; }
.ob-card .ob-btn { font: 800 14px/1 var(--f-ui, system-ui); padding: 11px 16px; border-radius: var(--r-pill, 999px); border: 0; cursor: pointer; color: #fff; background: linear-gradient(180deg, var(--cta, #ffb23e), var(--cta-2, #ff8a00)); box-shadow: 0 3px 0 var(--cta-edge, #d96a00); text-shadow: 0 1px 0 rgba(0,0,0,.15); display: inline-flex; align-items: center; gap: 6px; }
.ob-card .ob-btn:hover { filter: brightness(1.06); }
.ob-card .ob-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--cta-edge, #d96a00); }
.ob-card .ob-link { font: 700 13px/1 var(--f-ui, system-ui); padding: 6px 2px; border: 0; background: none; color: var(--accent-ink, #4b3aa8); cursor: pointer; text-decoration: underline; text-underline-offset: 3px; opacity: .85; }
.ob-card .ob-link:hover { opacity: 1; }
.ob-card .ob-done { display: flex; align-items: center; gap: 8px; color: var(--good, #23864b); font-weight: 800; font-size: 15px; }
.ob-card .ob-arrow { position: absolute; width: 14px; height: 14px; background: var(--card, #fff); border: 2px solid var(--accent-soft, #ece6ff); border-top: 0; border-left: 0; transform: rotate(45deg); border-radius: 0 0 3px 0; }
.ob-card .ob-arrow[data-side=bottom] { transform: rotate(225deg); }
.ob-card .ob-arrow[data-side=right] { transform: rotate(135deg); }
.ob-card .ob-arrow[data-side=left] { transform: rotate(-45deg); }
.ob-card.center { width: 380px; }
.ob-card.center h3 { font-size: 21px; }
#ob-guide { width: 300px; max-width: calc(100vw - 24px); background: var(--card, #fff); color: var(--ink, #1d2330); border: 2px solid var(--accent-soft, #ece6ff); border-radius: 18px; box-shadow: var(--shadow-s, 0 4px 14px rgba(40,24,90,.16)); padding: 10px 12px 11px 15px; font-family: var(--f-ui, system-ui); position: relative; overflow: hidden; pointer-events: auto; }
#ob-guide[hidden] { display: none; }
#ob-guide.free { position: absolute; left: 12px; z-index: 6; }
#ob-guide::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 5px; background: var(--gc, var(--accent, #6c4fe0)); }
#ob-guide .gh { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--gc, var(--accent, #6c4fe0)); }
#ob-guide .gh .grow { flex: 1; }
#ob-guide .gh button { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; border: 0; background: var(--accent-soft, #ece6ff); color: var(--accent, #6c4fe0); cursor: pointer; }
#ob-guide .gh button:hover { filter: brightness(.96); }
#ob-guide .gt { font-size: 14px; font-weight: 800; line-height: 1.35; margin: 3px 0 2px; color: var(--accent-ink, var(--ink, #2a1f5c)); }
#ob-guide .gw { font-size: 12.5px; line-height: 1.4; color: var(--ink-2, #3b4252); }
#ob-guide .ga { display: flex; align-items: center; gap: 12px; margin-top: 9px; flex-wrap: wrap; }
#ob-guide .ga .go { font: 800 13px/1 var(--f-ui, system-ui); padding: 9px 13px; border-radius: var(--r-pill, 999px); border: 0; cursor: pointer; color: #fff; background: linear-gradient(180deg, var(--cta, #ffb23e), var(--cta-2, #ff8a00)); box-shadow: 0 3px 0 var(--cta-edge, #d96a00); text-shadow: 0 1px 0 rgba(0,0,0,.15); display: inline-flex; align-items: center; gap: 5px; }
#ob-guide .ga .go:hover { filter: brightness(1.06); }
#ob-guide .ga .go:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--cta-edge, #d96a00); }
#ob-guide .ga .lk { font: 700 12.5px/1 var(--f-ui, system-ui); border: 0; background: none; padding: 4px 0; color: var(--accent-ink, #4b3aa8); cursor: pointer; text-decoration: underline; text-underline-offset: 3px; opacity: .8; }
#ob-guide .ga .lk:hover { opacity: 1; }
#ob-guide.min { width: auto; padding: 7px 10px 7px 14px; cursor: pointer; }
#ob-guide.min .gt { margin: 0; font-size: 13px; max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#ob-guide.pulse { animation: obGuide .9s var(--ease-out, ease); }
@keyframes obGuide { 30% { transform: translateY(-3px); box-shadow: 0 0 0 3px color-mix(in srgb, var(--gc) 40%, transparent), var(--shadow-s, 0 4px 14px rgba(0,0,0,.16)); } }
@media (max-width: 760px) {
  .ob-card { width: auto; left: 10px !important; right: 10px; padding: 12px 14px; }
  .ob-card.center { width: auto; }
  .ob-card p { font-size: 13.5px; }
  .ob-card .ob-arrow { display: none; }
  #ob-guide { width: auto; padding: 9px 10px 9px 14px; }
  #ob-guide.free { right: 12px; }
  #ob-guide .gw { display: none; }
  #ob-guide .gt { font-size: 13px; }
  #ob-guide .ga { margin-top: 6px; }
}
`;
function injectStyle() {
  if (document.getElementById('ob-style')) return;
  const st = document.createElement('style');
  st.id = 'ob-style';
  st.textContent = CSS;
  document.head.appendChild(st);
}
const uiScale = () => { const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui')); return v > 0.3 && v < 4 ? v : 1; };

// ------------------------------------------------------------------ Einführung + Begleiter
export class Onboarding {
  constructor(ui) {
    this.ui = ui;
    this.g = ui.g;
    this.replacesTutorial = true;
    // Die alte Checkliste „Erste Schritte" ausblenden (die Einführung und der Begleiter ersetzen sie)
    ui.tutorialHidden = true;
    if (ui.el && ui.el.tutorial) ui.el.tutorial.hidden = true;
    injectStyle();
    this.running = false;
    this.idx = 0;
    this.poll = 0;
    this.guideT = 0;
    this.lastEvent = {};
    this.tgtAsked = new Map();
    this.scrolled = new WeakSet();
    const s = this.settings();
    if (this.eligible() && !s.tutorialDone) this.begin(Math.max(0, Math.min(STEPS.length - 1, s.tourStep | 0)));
    this.mountGuide();
  }

  settings() { return (this.ui.app && this.ui.app.settings) || {}; }
  saveSettings() { try { this.ui.app.saveSettings(); } catch (e) { /* egal */ } }
  eligible() { const g = this.g; return !g.sandbox && !(g.opts && g.opts.scenario) && g.milestone === 0; }
  active() { return this.running; }

  // ---------- öffentliche Steuerung
  start() {
    const s = this.settings();
    s.tutorialDone = false; s.tourStep = 0;
    this.saveSettings();
    this.begin(0, true);
  }
  begin(idx, manual = false) {
    this.running = true;
    this.manual = manual;
    this.idx = idx;
    this.stepStart = performance.now();
    this.flash = 0;
    if (!this.layer) this.mountLayer();
    this.skipDone();
    this.render(true);
    this.syncUi();
  }
  // Oberfläche über Beginn/Ende informieren (#hud.tour-on blendet dort Störendes aus)
  syncUi() { try { if (typeof this.ui.refreshTutorial === 'function') this.ui.refreshTutorial(); } catch (e) { /* egal */ } }
  stop(finished = false) {
    if (!this.running) return;
    this.running = false;
    const s = this.settings();
    s.tutorialDone = true; s.tourStep = 0;
    this.saveSettings();
    if (this.layer) this.layer.hidden = true;
    if (!finished) { try { this.ui.toast('Einführung beendet. Du kannst sie jederzeit in der Hilfe („?") neu starten.', '', { icon: 'help' }); } catch (e) { /* egal */ } }
    this.guideT = 0;
    try { this.ui.advisor.compute(); } catch (e) { /* egal */ }
    this.syncUi();
    this.renderGuide(true);
  }
  onEvent(name, data) {
    this.lastEvent[name] = data;
    if (name === 'view') this.view = data;
    this.poll = 0;
  }
  dispose() {
    if (this.layer) this.layer.remove();
    if (this.guide) this.guide.remove();
    this.layer = null; this.guide = null;
  }

  // ---------- Kontext für die Schritte
  ctx() {
    const ui = this.ui, g = this.g;
    if (!this._n || this._nT !== g.time || this._nB !== g.buildings.size || performance.now() - this._nAt > 400) {
      this._n = cityCounts(g); this._nT = g.time; this._nB = g.buildings.size; this._nAt = performance.now();
    }
    const tool = (ui.app && ui.app.input && ui.app.input.tool) || { kind: 'select' };
    return {
      ui, g, n: this._n, tool, view: ui.view !== undefined ? ui.view : this.view,
      touch: ui.mobile() || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches),
      stepAge: (performance.now() - this.stepStart) / 1000,
      viewAge: this.viewAt ? (performance.now() - this.viewAt) / 1000 : 0,
      // Ist einer der Katalog-Einträge gerade zu sehen?
      open: (keys) => keys.some((k) => !!this.findTarget('item-' + k, true)),
    };
  }
  skipDone() {
    const c = this.ctx();
    while (this.idx < STEPS.length && STEPS[this.idx].done && !STEPS[this.idx].info && STEPS[this.idx].done(c)) this.idx++;
    // Begrüßung nur ganz am Anfang
    if (this.idx === 0 && (c.n.roads > 0 || this.g.buildings.size > 0)) { this.idx = 1; this.skipDone(); }
  }
  next() {
    this.idx++;
    this.stepStart = performance.now();
    this.skipDone();
    const s = this.settings();
    s.tourStep = this.idx; this.saveSettings();
    if (this.idx >= STEPS.length) { this.stop(true); return; }
    this.render(true);
  }

  // ---------- Ziele
  findTarget(id, quiet = false) {
    let el = queryVisible(`[data-tour="${id}"]`) || queryVisible(legacySelector(id));
    if (!el && !quiet && !id.startsWith('item-') && !id.startsWith('cat-') && typeof this.ui.tourTarget === 'function') {
      // ui.tourTarget darf Gruppen öffnen – deshalb je Ziel höchstens alle 3 s fragen
      const now = performance.now(), at = this.tgtAsked.get(id) || 0;
      if (now - at > 3000) {
        this.tgtAsked.set(id, now);
        try { const e = this.ui.tourTarget(id); if (e && visible(e)) el = e; } catch (e) { /* egal */ }
      }
    }
    if (el && !quiet && clippedInScroller(el) && !this.scrolled.has(el)) {
      this.scrolled.add(el);
      try { el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); } catch (e) { /* egal */ }
    }
    return el;
  }

  // ---------- Darstellung der Einführung
  mountLayer() {
    const app = document.getElementById('app') || document.body;
    const L = document.createElement('div');
    L.id = 'ob-layer';
    L.innerHTML = '<div class="ob-ring" hidden></div><div class="ob-mark" hidden data-label="Hier anfangen"></div><div class="ob-card" role="dialog" aria-live="polite"></div>';
    app.appendChild(L);
    this.layer = L;
    this.ring = L.querySelector('.ob-ring');
    this.mark = L.querySelector('.ob-mark');
    this.card = L.querySelector('.ob-card');
    this.card.addEventListener('click', (e) => this.cardClick(e));
    this.card.addEventListener('pointerdown', (e) => e.stopPropagation());
  }
  cardClick(e) {
    const b = e.target.closest('[data-ob]');
    if (!b) return;
    try { this.ui.app.audio.play('click'); } catch (err) { /* egal */ }
    const a = b.dataset.ob;
    if (a === 'close' || a === 'alt') this.stop(false);
    else if (a === 'next' || a === 'skip') this.next();
    else if (a === 'help') this.ui.openHelp ? this.ui.openHelp() : openHelp(this.ui);
  }
  render(fresh = false) {
    if (!this.running || !this.card) return;
    const st = STEPS[this.idx];
    if (!st) return;
    const c = this.ctx();
    const h = st.hint(c) || {};
    this.hint = h;
    this.tid = this.resolveTarget(h);
    if (h.texts && this.tid && h.texts[this.tid]) h.text = h.texts[this.tid];
    const title = typeof st.title === 'function' ? st.title(c) : st.title;
    const taskNo = STEPS.slice(0, this.idx + 1).filter((s) => !s.info || s.id === 'happy').length;
    const isWelcome = st.id === 'welcome', isFinish = st.id === 'finish';
    const top = isWelcome ? 'Einführung' : isFinish ? 'Geschafft' : `Schritt ${taskNo} von ${TASKS}`;
    const progress = isWelcome ? 0 : isFinish ? 1 : (taskNo - 1) / TASKS;
    const body = this.flash > performance.now()
      ? `<div class="ob-done">${ic('check', 18, 2.6)} Erledigt!</div>`
      : `<h3>${esc(title)}</h3><p>${esc(h.text || '')}</p>`;
    const acts = [];
    if (st.btn && this.flash <= performance.now()) acts.push(`<button class="ob-btn" data-ob="next">${esc(st.btn)} ${ic('arrowR', 15, 2.4)}</button>`);
    if (st.alt) acts.push(`<button class="ob-link" data-ob="alt">${esc(st.alt)}</button>`);
    else if (!st.info && this.flash <= performance.now() && c.stepAge > 25) acts.push('<button class="ob-link" data-ob="skip">Schritt überspringen</button>');
    const html = `<div class="ob-top"><span>${esc(top)}</span><span class="grow"></span>${isFinish ? '' : `<button class="ob-x" data-ob="close" aria-label="Einführung beenden" title="Einführung beenden">${ic('close', 15, 2.4)}</button>`}</div>
<div class="ob-bar"><i style="width:${Math.round(progress * 100)}%"></i></div>${body}${acts.length ? `<div class="ob-acts">${acts.join('')}</div>` : ''}<span class="ob-arrow" hidden></span>`;
    if (html !== this._html) {
      this._html = html;
      this.card.innerHTML = html;
      this.card.classList.toggle('center', isWelcome);
      if (fresh) { this.card.classList.remove('enter'); void this.card.offsetWidth; this.card.classList.add('enter'); }
    }
    // Kamera zum Anfang der Straße
    if (st.id === 'road' && !this._focused && c.n.roads === 0) {
      this._focused = true;
      const he = this.g.world.highwayEnd, W = this.g.W;
      try { this.ui.focusTile(he % W + (this.ui.mobile() ? 3 : 6), Math.floor(he / W), 30); } catch (e) { /* egal */ }
    }
  }

  resolveTarget(h) {
    for (const id of h.target || []) if (this.findTarget(id, true) || (!/^(cat|item)-/.test(id) && this.findTarget(id))) return id;
    return null;
  }

  hiddenNow() {
    const ui = this.ui;
    const hud = ui.root || document.getElementById('hud');
    return ui.modalOpen() || (ui.photo && ui.photo.active) || ui.hudHidden || !hud || hud.hidden || (ui.mobile() && !!ui.panel);
  }

  layout() {
    const L = this.layer;
    if (!L) return;
    if (!this.running || this.hiddenNow()) { L.hidden = true; return; }
    L.hidden = false;
    const h = this.hint || {};
    const vw = window.innerWidth, vh = window.innerHeight, mob = this.ui.mobile();
    let tid = this.resolveTarget(h);
    if (tid !== this.tid) { this.render(); tid = this.tid; }
    const el = tid ? this.findTarget(tid) : null;
    const tr = el ? el.getBoundingClientRect() : null;
    // Ring um das Ziel
    if (tr) {
      const pad = 5;
      Object.assign(this.ring.style, { left: tr.left - pad + 'px', top: tr.top - pad + 'px', width: tr.width + pad * 2 + 'px', height: tr.height + pad * 2 + 'px' });
      this.ring.hidden = false;
      // Abdunkeln nur, wenn ein Knopf geklickt werden soll (nicht beim Bauen auf der Karte)
      this.ring.classList.toggle('dim', /^(cat-|item-|stat-|group-)/.test(tid) && !mob);
    } else this.ring.hidden = true;
    // Markierung auf der Karte (Ende der Autobahn)
    let mp = null;
    if (h.map === 'highway') mp = this.projectTile(this.g.world.highwayEnd % this.g.W + 1, Math.floor(this.g.world.highwayEnd / this.g.W));
    if (mp) { this.mark.style.left = mp.x + 'px'; this.mark.style.top = mp.y + 'px'; this.mark.hidden = false; } else this.mark.hidden = true;
    // Karte neben dem Ziel platzieren
    const z = uiScale();
    const card = this.card, arrow = card.querySelector('.ob-arrow');
    const cw = card.offsetWidth * z, ch = card.offsetHeight * z;
    const topbar = document.querySelector('#hud .topbar, #hud [data-tour=topbar]');
    const topY = topbar && visible(topbar) ? topbar.getBoundingClientRect().bottom + 10 : 80;
    let x, y, side = null;
    const st = STEPS[this.idx];
    if (st && st.id === 'welcome') { x = (vw - cw) / 2; y = Math.max(topY, (vh - ch) / 2 - 40); }
    else if (mob) {
      // Handy: Karte oben unter der Kopfzeile, außer das Ziel liegt selbst oben – dann darunter
      // Ohne Ziel (Bauen auf der Karte): unten über der Werkzeugleiste
      const tb = document.querySelector('#hud [data-tour=toolbar], #u-toolbar');
      const tbTop = tb && visible(tb) ? tb.getBoundingClientRect().top : vh;
      x = 10; y = !tr ? tbTop - ch - 10 : tr.top < topY + ch ? tr.bottom + 12 : topY;
    } else if (tr) {
      const gap = 16;
      const fits = { top: tr.top - ch - gap > topY - 4, bottom: tr.bottom + ch + gap < vh - 8, right: tr.right + cw + gap < vw - 8, left: tr.left - cw - gap > 8 };
      side = tr.top > vh * 0.5 ? (fits.top ? 'top' : fits.left ? 'left' : 'right') : (fits.bottom ? 'bottom' : fits.left ? 'left' : 'right');
      if (side === 'top' || side === 'bottom') { x = tr.left + tr.width / 2 - cw / 2; y = side === 'top' ? tr.top - ch - gap : tr.bottom + gap; }
      else { y = tr.top + tr.height / 2 - ch / 2; x = side === 'left' ? tr.left - cw - gap : tr.right + gap; }
    } else { x = vw - cw - 16; y = topY + 46; }
    x = Math.max(8, Math.min(vw - cw - 8, x));
    y = Math.max(8, Math.min(vh - ch - 8, y));
    card.style.left = x / z + 'px';
    card.style.top = y / z + 'px';
    // Pfeil zur Zielmitte
    if (arrow) {
      if (side && tr && !mob) {
        arrow.hidden = false;
        arrow.dataset.side = side;
        const ax = Math.max(14, Math.min(cw - 28, tr.left + tr.width / 2 - x - 7)) / z, ay = Math.max(14, Math.min(ch - 28, tr.top + tr.height / 2 - y - 7)) / z;
        Object.assign(arrow.style, side === 'top' ? { left: ax + 'px', top: '', bottom: '-6px', right: '' } : side === 'bottom' ? { left: ax + 'px', top: '-6px', bottom: '', right: '' } : side === 'left' ? { top: ay + 'px', right: '-6px', left: '', bottom: '' } : { top: ay + 'px', left: '-6px', right: '', bottom: '' });
      } else arrow.hidden = true;
    }
  }

  projectTile(tx, ty) {
    const eng = this.ui.app && this.ui.app.engine, g = this.g;
    if (!eng || !eng.camera || !eng.renderer) return null;
    try {
      const wx = tx + 0.5 - g.W / 2, wz = ty + 0.5 - g.H / 2;
      let wy = 0.2;
      if (eng.terrain && typeof eng.terrain.heightAt === 'function') wy = Math.max(0, eng.terrain.heightAt(wx, wz)) + 0.2;
      const v = new eng.camera.position.constructor(wx, wy, wz);
      v.project(eng.camera);
      if (v.z > 1 || v.z < -1) return null;
      const r = eng.renderer.domElement.getBoundingClientRect();
      const x = r.left + (v.x + 1) / 2 * r.width, y = r.top + (1 - v.y) / 2 * r.height;
      if (x < -20 || y < -20 || x > window.innerWidth + 20 || y > window.innerHeight + 20) return null;
      return { x, y };
    } catch (e) { return null; }
  }

  // ---------- Begleiter „Nächstes Ziel"
  mountGuide() {
    const el = document.createElement('div');
    el.id = 'ob-guide';
    el.hidden = true;
    el.setAttribute('data-tour', 'guide');
    el.addEventListener('click', (e) => this.guideClick(e));
    this.guide = el;
    this.placeGuide();
  }
  placeGuide() {
    const el = this.guide;
    if (!el) return;
    const slot = document.querySelector('[data-slot="guide"]');
    const stack = this.ui.el && this.ui.el.leftstack && this.ui.el.leftstack.isConnected && !this.ui.mobile() ? this.ui.el.leftstack : null;
    const host = slot || stack || this.ui.root;
    if (el.parentElement !== host) {
      if (host === stack) host.insertBefore(el, host.firstChild); else host.appendChild(el);
    }
    el.classList.toggle('free', host === this.ui.root);
    if (host === this.ui.root) {
      // Frei schwebend: über der Werkzeugleiste
      const z = uiScale();
      const tb = document.querySelector('#hud [data-tour=toolbar], #u-toolbar');
      const top = tb && visible(tb) ? tb.getBoundingClientRect().top : window.innerHeight - 90;
      el.style.bottom = Math.max(8, (window.innerHeight - top + 10) / z) + 'px';
    } else el.style.bottom = '';
  }
  guideClick(e) {
    const b = e.target.closest('[data-g]');
    const s = this.settings();
    if (!b) { if (s.guideMin) { s.guideMin = false; this.saveSettings(); this.renderGuide(true); } return; }
    const a = b.dataset.g, goal = this.ui.advisor && this.ui.advisor.goal;
    try { this.ui.app.audio.play('click'); } catch (err) { /* egal */ }
    if (a === 'min') { s.guideMin = !s.guideMin; this.saveSettings(); this.renderGuide(true); return; }
    if (!goal) return;
    if (a === 'go' && goal.act) this.ui.runAction(goal.act);
    else if (a === 'why') (this.ui.openHelp || ((t) => openHelp(this.ui, t)))(goal.help);
    else if (a === 'later') { this.ui.advisor.snooze(goal.id, 2); this.renderGuide(true); }
  }
  guideHidden() {
    const ui = this.ui, s = this.settings();
    return (this.running && (STEPS[this.idx] || {}).id !== 'finish') || s.advisor === false || isMetro(this.g) || !!ui.cat || this.hiddenNow();
  }
  renderGuide(force = false) {
    const el = this.guide;
    if (!el) return;
    this.placeGuide();
    if (this.guideHidden()) { el.hidden = true; return; }
    const goal = this.ui.advisor && this.ui.advisor.goal;
    if (!goal) { el.hidden = true; return; }
    const s = this.settings();
    const color = goal.prio >= 3 ? 'var(--bad, #d4433a)' : goal.prio >= 2 ? 'var(--cta-2, #ff8a00)' : 'var(--accent, #6c4fe0)';
    const head = goal.prio >= 3 ? 'Jetzt wichtig' : goal.id === 'milestone' ? 'Nächstes Ziel' : goal.prio >= 2 ? 'Nächstes Ziel' : 'Tipp';
    // Handy mit aktivem Werkzeug: nur eine Zeile, damit die Karte frei bleibt
    const toolOn = this.ui.app.input && this.ui.app.input.tool && this.ui.app.input.tool.kind !== 'select';
    const min = !!s.guideMin || (this.ui.mobile() && toolOn);
    const html = min
      ? `<div class="gh"><span>${esc(head)}</span><span class="grow"></span>${!s.guideMin && goal.act ? `<button data-g="go" aria-label="${esc(goal.label || 'Zeigen')}" title="${esc(goal.label || 'Zeigen')}">${ic('arrowR', 14, 2.4)}</button>` : `<button data-g="min" aria-label="Aufklappen" title="Aufklappen">${ic('chevronU', 14, 2.4)}</button>`}</div><div class="gt">${esc(goal.text)}</div>`
      : `<div class="gh"><span>${ic(goal.prio >= 3 ? 'warn' : 'target', 13, 2.6)}</span><span>${esc(head)}</span><span class="grow"></span><button data-g="min" aria-label="Einklappen" title="Einklappen">${ic('chevronD', 14, 2.4)}</button></div>
<div class="gt">${esc(goal.text)}</div>${goal.why ? `<div class="gw">${esc(goal.why)}</div>` : ''}
<div class="ga">${goal.act ? `<button class="go" data-g="go">${esc(goal.label || 'Zeigen')} ${ic('arrowR', 14, 2.4)}</button>` : ''}${goal.help ? '<button class="lk" data-g="why">Warum?</button>' : ''}${goal.id !== 'milestone' ? '<button class="lk" data-g="later">Später</button>' : ''}</div>`;
    if (html !== this._gHtml || force) {
      const pulse = this._gId !== goal.id && this._gId !== undefined && goal.prio >= 2;
      this._gHtml = html; this._gId = goal.id;
      el.innerHTML = html;
      el.classList.toggle('min', min);
      el.style.setProperty('--gc', color);
      if (pulse) { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }
    }
    el.hidden = false;
  }

  // ---------- jedes Bild
  update(dt) {
    if (this._synced !== this.running) { this._synced = this.running; this.syncUi(); }
    if (this.running) {
      this.poll -= dt;
      if (this.poll <= 0) {
        this.poll = 0.25;
        const st = STEPS[this.idx];
        const c = this.ctx();
        if (c.view === 'happiness') { if (!this.viewAt) this.viewAt = performance.now(); } else this.viewAt = 0;
        if (st && st.done && !this.flashUntil && st.done(c)) {
          // kurz „Erledigt!" zeigen, dann weiter
          this.flash = performance.now() + 900;
          this.flashUntil = this.flash;
          try { this.ui.app.audio.play('success'); } catch (e) { /* egal */ }
        }
        // Werkzeug für den Schritt gewählt: Katalog einmal zuklappen, damit die Karte frei ist
        if (st && st.build && st.build(c) && this.ui.cat && this._trayClosed !== st.id + ':' + JSON.stringify(c.tool) && typeof this.ui.closeTray === 'function') {
          this._trayClosed = st.id + ':' + JSON.stringify(c.tool);
          try { this.ui.closeTray(); } catch (e) { /* egal */ }
        }
        if (this.flashUntil && performance.now() > this.flashUntil) { this.flashUntil = 0; this.next(); }
        else this.render();
      }
      this.layout();
    }
    this.guideT -= dt;
    if (this.guideT <= 0) { this.guideT = 0.5; this.renderGuide(); }
  }
}
