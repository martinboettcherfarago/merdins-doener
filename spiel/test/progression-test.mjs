// Prüfstand für „Fortschritt & Inhalte" (Agent S5): Inhalte, Erfolge, Szenarien, Metro-Modus, Ratgeber.
// Aufruf: node test/progression-test.mjs [schnell]
import { Game } from '../src/sim/game.js';
import { R, Z } from '../src/config.js';
import { CARDS, EVENTS, CHATTER } from '../src/sim/progress.js';
import { S5_CARD_IDS } from '../src/content/cards.js';
import { S5_EVENT_IDS } from '../src/content/events.js';
import { S5_CHATTER_COUNT, S5_CHATTER_ENTRIES } from '../src/content/chatter.js';
import {
  ACHIEVEMENTS, SCENARIOS, scenarioOptions, scenarioStatus, achievementState, achievementPoints, rankFor,
  adviceFor, metroScore, continueFreePlay, isMetro, questStatus, QUESTS, rewardText, dailyMetro,
} from '../src/sim/systems/progression.js';

const quick = process.argv.includes('schnell');
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  FEHLER:', msg); } return cond; };
const section = (t) => console.log(`\n=== ${t}`);
const t0 = Date.now();

function runDays(g, days, opts = {}) {
  const { auto = true, onDay } = opts;
  if (g.speed === 0) g.speed = 3;
  const start = g.day();
  let guard = 0;
  while (g.day() < start + days && guard++ < days * 400) {
    g.update(0.1);
    if (auto) {
      if (g.pendingCards) g.chooseCard(g.pendingCards[opts.card ?? 0] ?? g.pendingCards[0]);
      if (g.pendingEvent) g.resolveEvent(opts.event ?? 0);
    }
    if (g.gameOver) break;
    if (onDay && g._lastSeen !== g.day()) { g._lastSeen = g.day(); onDay(g); }
  }
}

// Eine einfache Teststadt (wie test/sim-test.mjs)
function buildTestCity(g) {
  const W = g.W, hy = g.world.highwayY;
  const idx = (x, y) => y * W + x;
  const road = (x0, y0, x1, y1, t = R.STREET) => {
    if (y0 === y1) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) g.buildRoad([idx(x, y0)], t);
    else for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) g.buildRoad([idx(x0, y)], t);
  };
  const zone = (x0, y0, x1, y1, z) => { const t = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) t.push(idx(x, y)); g.zoneTiles(t, z); };
  const place = (key, x, y) => { for (let d = 0; d < 8; d++) for (const [ox, oy] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, -d]]) if (g.placeBuilding(key, x + ox, y + oy).ok) return true; return false; };
  road(6, hy, 46, hy);
  for (let x = 9; x <= 45; x += 5) road(x, hy - 12, x, hy + 12);
  for (const dy of [-12, -6, 6, 12]) road(9, hy + dy, 45, hy + dy);
  place('landfill', 24, hy + 13);
  zone(10, hy - 11, 28, hy - 1, Z.RES); zone(10, hy + 1, 22, hy + 11, Z.COM); zone(31, hy + 1, 44, hy + 11, Z.IND); zone(29, hy - 11, 44, hy - 1, Z.RES);
  place('coal', 40, hy + 13); place('watertower', 8, hy - 3); place('watertower', 8, hy + 3);
  return { place, hy };
}

// ---------------------------------------------------------------------------------------------
section('Inhalte');
const newCards = CARDS.filter((c) => S5_CARD_IDS.includes(c.id));
const metroCards = newCards.filter((c) => c.metro);
console.log(`Karten: ${CARDS.length} gesamt, ${newCards.length - metroCards.length} neue Wochenkarten + ${metroCards.length} Metro-Karten`);
ok(newCards.length - metroCards.length >= 40, 'mindestens 40 neue Wochenkarten');
ok(new Set(CARDS.map((c) => c.id)).size === CARDS.length, 'Karten-IDs eindeutig');
const newEvents = EVENTS.filter((e) => S5_EVENT_IDS.includes(e.id));
console.log(`Ereignisse: ${EVENTS.length} gesamt, ${newEvents.length} neu`);
ok(newEvents.length >= 40, 'mindestens 40 neue Ereignisse');
ok(new Set(EVENTS.map((e) => e.id)).size === EVENTS.length, 'Ereignis-IDs eindeutig');
console.log(`Stadtfunk: ${S5_CHATTER_COUNT} neue Meldungen in ${S5_CHATTER_ENTRIES.length} Einträgen (Liste hat ${CHATTER.length} Einträge)`);
ok(S5_CHATTER_COUNT >= 200, 'mindestens 200 neue Stadtfunk-Meldungen');
ok(CHATTER[CHATTER.length - 1].when.length === 0 && CHATTER[CHATTER.length - 1].when(), 'allgemeiner Stadtfunk-Eintrag bleibt am Ende');
console.log(`Erfolge: ${ACHIEVEMENTS.length}, Szenarien: ${SCENARIOS.length}`);
ok(ACHIEVEMENTS.length >= 40, 'mindestens 40 Erfolge');
ok(SCENARIOS.length >= 8, 'mindestens 8 Szenarien');
ok(new Set(ACHIEVEMENTS.map((a) => a.id)).size === ACHIEVEMENTS.length, 'Erfolgs-IDs eindeutig');
// Doppelte Texte im Stadtfunk?
const allTexts = [];
for (const e of S5_CHATTER_ENTRIES) if (!e.count) allTexts.push(...e.texts);
ok(new Set(allTexts).size === allTexts.length, 'keine doppelten Stadtfunk-Texte');

// ---------------------------------------------------------------------------------------------
section('Normales Spiel mit Teststadt');
const g = new Game({ size: 96, seed: 4242, mapType: 'river', difficulty: 'normal', name: 'Prüfstadt' });
ok(!!g.ext.progression, 'Zustand g.ext.progression vorhanden');
const tips0 = adviceFor(g);
ok(tips0.length && tips0[0].id === 'road', 'Ratgeber empfiehlt zuerst eine Straße');
const city = buildTestCity(g);
let services = false, transitDone = false;
runDays(g, quick ? 25 : 45, {
  onDay: (gg) => {
    if (!services && gg.milestone >= 1) { services = true; for (const [k, x, y] of [['police', 20, -5], ['fire', 30, 5], ['clinic', 15, 7], ['school', 24, -8], ['park', 12, -4], ['park', 34, -4], ['wind', 46, -8], ['watertower', 46, -4]]) city.place(k, x, city.hy + y); }
    if (!transitDone && gg.isUnlocked('transit')) {
      transitDone = true;
      const st = (x, y) => { for (let d = 0; d < 6; d++) for (const [ox, oy] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]]) { const r = gg.placeBuilding('station', x + ox, y + oy); if (r.ok) return r.station; } return null; };
      const a = st(12, city.hy), b = st(26, city.hy), c = st(40, city.hy);
      if (a && b && c) gg.createLine([a.id, b.id, c.id], false);
    }
  },
});
const st = g.ext.progression;
const ach = achievementState(g);
const unlocked = ach.filter((x) => x.unlocked);
console.log(`Tag ${g.day()}: ${g.stats.pop} Einwohner, ${unlocked.length} Erfolge frei (${achievementPoints(g)} Punkte, Rang ${rankFor(achievementPoints(g)).rank.name})`);
console.log('  freigeschaltet:', unlocked.map((x) => x.a.name).join(', '));
ok(unlocked.length >= 2, 'einige Erfolge freigeschaltet');
ok(ach.every((x) => Number.isFinite(x.progress) && x.progress >= 0 && x.progress <= 1), 'Fortschritt aller Erfolge zwischen 0 und 1');
const almost = ach.filter((x) => !x.unlocked && x.avail).sort((a, b) => b.progress - a.progress).slice(0, 5);
console.log('  fast geschafft:', almost.map((x) => `${x.a.name} ${Math.round(x.progress * 100)} %`).join(', '));
const tips = adviceFor(g);
console.log('  Ratgeber:', tips.slice(0, 4).map((t) => `[${t.prio}] ${t.title}`).join(' · '));
const qNews = g.newsLog.filter((n) => /Auftrag/.test(n.text));
console.log(`  Bürgeraufträge: ${st.counters.questsDone} erfüllt, ${st.counters.questsFailed} verpasst, aktiv: ${questStatus(g).map((r) => `${r.title} (${r.text}, noch ${r.left} T.)`).join(', ') || '–'}`);
ok(qNews.length > 0 || st.counters.questsDone + st.counters.questsFailed > 0, 'Bürgeraufträge werden vergeben');
ok(questStatus(g).every((r) => r.title && r.desc && r.reward && Number.isFinite(r.progress)), 'Aufträge vollständig beschrieben');
// Alle Auftragsvorlagen einmal erzeugen und auswerten
let qErr = 0;
for (const t of QUESTS) {
  try {
    const F = st.facts;
    if (t.cond) t.cond(g, F);
    const m = t.make(g, F);
    if (!m || !Number.isFinite(m.target) || !m.days || !rewardText(m.reward)) throw new Error('unvollständig');
    if (typeof t.text({ ...m }) !== 'string') throw new Error('Text');
    t.cur(g, F);
  } catch (e) { qErr++; console.log('  Auftrag', t.id, e.message); }
}
ok(qErr === 0, 'alle Auftragsvorlagen gültig');
ok(tips.every((t) => t.title && t.text && typeof t.prio === 'number'), 'Ratgeber-Hinweise vollständig');
const advNews = g.newsLog.filter((n) => n.kind === 'advisor').length;
const chatNews = g.newsLog.filter((n) => n.kind === 'chatter');
console.log(`  Stadtfunk im Protokoll: ${chatNews.length} Bürgerstimmen, ${advNews} Ratgeber-Meldungen`);
ok(chatNews.every((n) => typeof n.text === 'string' && n.text.length > 3), 'Stadtfunk-Texte sind Zeichenketten');

// Alle Karten und Ereignisse an der entwickelten Stadt prüfen (auf Kopien)
section('Karten und Ereignisse ausprobieren');
const save = JSON.stringify(g.serialize());
let cardErr = 0, evErr = 0;
for (const c of newCards) {
  const gg = Game.fromSave(JSON.parse(save));
  try {
    if (c.cond) c.cond(gg);
    const txt = c.text(gg);
    if (typeof txt !== 'string' || txt.length < 5) throw new Error('Text fehlt');
    if (c.metro) gg.opts.scenario = 'metro';
    c.apply(gg);
    gg.speed = 3;
    for (let k = 0; k < 40; k++) gg.update(0.1);
  } catch (e) { cardErr++; console.log('  Karte', c.id, e.message); }
}
ok(cardErr === 0, 'alle neuen Karten laufen fehlerfrei');
for (const ev of newEvents) {
  if (typeof ev.text !== 'string') { evErr++; console.log('  Ereignis ohne Text', ev.id); }
  try { if (ev.cond) ev.cond(g); } catch (e) { evErr++; console.log('  Bedingung', ev.id, e.message); }
  const n = ev.options.length;
  for (let i = 0; i < n; i++) {
    const gg = Game.fromSave(JSON.parse(save));
    try {
      if (ev.cond) ev.cond(gg);
      const o = ev.options[i];
      if (typeof o.hint(gg) !== 'string') throw new Error('Hinweis fehlt');
      gg.pendingEvent = ev.id;
      gg.resolveEvent(i);
      gg.speed = 3;
      runDays(gg, 25, { auto: true });
    } catch (e) { evErr++; console.log('  Ereignis', ev.id, i, e.message); }
  }
}
ok(evErr === 0, 'alle neuen Ereignisse laufen fehlerfrei (inkl. Folgeereignisse)');
// Stadtfunk-Bedingungen unter verschiedenen (auch fremden) Zuständen
let chErr = 0;
const fake = Game.fromSave(JSON.parse(save));
const weathers = [undefined, { season: 'winter', temp: -8, snow: 0.6, snowCover: 0.8, rain: 0, wind: 0.9, storm: true, fog: 0.7, cloud: 0.9 }, { season: 'summer', temp: 33, rain: 0, cloud: 0.1, fog: 0 }, { season: 'spring', temp: 20, rain: 0.6, cloud: 0.1 }, { season: 'autumn', temp: 10, fog: 0.8 }];
for (const w of weathers) {
  fake.ext.weather = w || {};
  fake.ext.districts = { map: new Uint8Array(fake.N), list: [{ id: 1, name: 'Rosenviertel' }, { id: 2, name: 'Hafenkante' }] };
  fake.ext.progression.lastDisaster = { type: 'flood', day: fake.day() };
  for (const e of S5_CHATTER_ENTRIES) {
    try {
      if (e.when(fake)) { const t = e.texts; if (!t.length || t.some((x) => typeof x !== 'string' || !x.length)) throw new Error('leere Texte'); }
    } catch (err) { chErr++; console.log('  Stadtfunk', err.message); }
  }
}
ok(chErr === 0, 'Stadtfunk-Bedingungen robust gegenüber fremden Systemen');

// Speichern/Laden
section('Speichern und Laden');
const g2 = Game.fromSave(JSON.parse(save));
ok(Object.keys(g2.ext.progression.ach).length === Object.keys(st.ach).length, 'Erfolge überstehen Speichern/Laden');
ok(g2.ext.progression.counters.maxPop === st.counters.maxPop, 'Zähler überstehen Speichern/Laden');

// ---------------------------------------------------------------------------------------------
section('Szenarien');
for (const sc of SCENARIOS) {
  if (sc.metro) continue;
  const t1 = Date.now();
  let gs;
  try { gs = new Game(scenarioOptions(sc.id)); } catch (e) { ok(false, `Szenario ${sc.id} startet nicht: ${e.message}`); continue; }
  const s0 = scenarioStatus(gs);
  ok(!!s0 && s0.st.status === 'running', `${sc.id}: läuft nach dem Start`);
  ok(gs.speed === 0, `${sc.id}: startet pausiert (Briefing)`);
  ok(gs.ext.progression.inbox.some((m) => m.type === 'scenarioIntro'), `${sc.id}: Briefing in der Inbox`);
  const pop0 = gs.stats.pop, money0 = Math.round(gs.money);
  runDays(gs, quick ? 6 : 12, { auto: true });
  const s1 = scenarioStatus(gs);
  console.log(`${sc.name.padEnd(20)} Start ${String(pop0).padStart(5)} Einw, ${String(money0).padStart(7)} € → Tag ${String(s1.elapsed).padStart(2)}/${sc.days}: ${String(gs.stats.pop).padStart(5)} Einw, ${String(Math.round(gs.money)).padStart(7)} € · ${s1.st.status} · ${s1.goals.map((r) => `${r.goal.label}: ${r.text}${r.done ? ' ✓' : ''}`).join(' | ')} (${Date.now() - t1} ms)`);
  // Laden mitten im Szenario
  const gl = Game.fromSave(JSON.parse(JSON.stringify(gs.serialize())));
  ok(scenarioStatus(gl)?.st.id === sc.id, `${sc.id}: Szenario übersteht Speichern/Laden`);
  ok(gl.buildings.size === gs.buildings.size, `${sc.id}: beim Laden wird nichts neu aufgebaut`);
}
// Erzählte Momente: Ereignisse im Skript müssen existieren
for (const sc of SCENARIOS) for (const s of sc.script || []) {
  if (s.event) ok(!!EVENTS.find((e) => e.id === s.event), `${sc.id}: Skript-Ereignis ${s.event} existiert`);
  else ok(typeof s.text === 'string' && s.text.length > 10, `${sc.id}: Skript-Text vorhanden`);
}
// Tageskarte: gleiche Optionen am selben Tag, gültige Karte
{
  const a = dailyMetro(new Date(2026, 9, 12)), b = dailyMetro(new Date(2026, 9, 12)), c = dailyMetro(new Date(2026, 9, 13));
  ok(JSON.stringify(a) === JSON.stringify(b), 'Tageskarte ist am selben Tag gleich');
  ok(a.opts.seed !== c.opts.seed, 'Tageskarte wechselt am nächsten Tag');
  const o = scenarioOptions('metro', a.opts);
  ok(o.daily === a.key && typeof o.name === 'string' && o.name.length > 2, 'Tageskarte ergibt gültige Spieloptionen');
}
// Sieg- und Niederlagenlogik mit Testszenarien
SCENARIOS.push({ id: '_win', name: 'Test-Sieg', city: 'T', map: 'river', size: 64, seed: 3, difficulty: 'normal', days: 10, goals: [{ id: 'x', label: 'x', cur: () => 1, target: 1 }], setup() {} });
SCENARIOS.push({ id: '_lose', name: 'Test-Niederlage', city: 'T', map: 'river', size: 64, seed: 3, difficulty: 'normal', days: 3, goals: [{ id: 'x', label: 'x', cur: () => 0, target: 1 }], setup() {} });
const gw = new Game(scenarioOptions('_win'));
runDays(gw, 2);
ok(gw.ext.progression.scen.status === 'won', 'Test-Szenario wird gewonnen');
ok(gw.ext.progression.scen.stars === 3, 'schneller Sieg gibt drei Sterne');
ok(gw.ext.progression.inbox.some((m) => m.type === 'scenarioEnd' && m.won), 'Siegmeldung in der Inbox');
const gl2 = new Game(scenarioOptions('_lose'));
runDays(gl2, 6);
ok(gl2.ext.progression.scen.status === 'lost' && gl2.gameOver, 'Test-Szenario geht nach Zeitablauf verloren');
continueFreePlay(gl2);
ok(!gl2.gameOver, 'Weiterspielen nach Niederlage möglich');
SCENARIOS.splice(SCENARIOS.findIndex((s) => s.id === '_win'), 2);

// ---------------------------------------------------------------------------------------------
section('Metro-Modus');
// Einfacher Autopilot: jede neue Station an die nächste Linie hängen, Züge und Waggons einsetzen.
function metroBot(gm, smart) {
  const tr = gm.transit;
  const free = [...tr.stations.values()].filter((s) => !tr.lines.some((l) => l.stops.includes(s.id)));
  for (const s of free) {
    if (tr.lines.length < tr.linesMax) {
      // neue Linie zur nächsten verbundenen (oder beliebigen) Station
      const others = [...tr.stations.values()].filter((o) => o !== s);
      others.sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y));
      if (others.length) gm.createLine([s.id, others[0].id], false);
    } else if (tr.lines.length) {
      // an das nächstgelegene Linienende hängen
      let best = null, bd = 1e9;
      for (const l of tr.lines) for (const atStart of [true, false]) {
        const end = tr.stations.get(atStart ? l.stops[0] : l.stops[l.stops.length - 1]);
        if (!end) continue;
        const d = Math.hypot(end.x - s.x, end.y - s.y);
        if (!l.loop && d < bd) { bd = d; best = [l, atStart]; }
      }
      if (best) gm.extendLine(best[0].id, s.id, best[1]);
    }
  }
  if (!smart) return;
  // Kapazität: vollste Linie bekommt Züge/Waggons
  for (const l of tr.lines) {
    const waiting = l.stops.reduce((a, id) => a + (tr.stations.get(id)?.waiting.length || 0), 0);
    const n = tr.trains.filter((t) => t.line === l.id).length;
    const perTrain = waiting / Math.max(1, n);
    if (perTrain > 8 && n < 6 && (tr.freeTrains > 0 || gm.money > 4000)) gm.addTrain(l.id);
    if (perTrain > 12 && (tr.freeWagons > 0 || gm.money > 3000)) gm.addWagon(l.id);
  }
}
for (const [map, seed] of quick ? [['river', 101]] : [['river', 101], ['coast', 202], ['islands', 89], ['lakes', 303]]) {
  const t1 = Date.now();
  const gm = new Game(scenarioOptions('metro', { mapType: map, seed }));
  const m = gm.ext.progression.metro;
  ok(isMetro(gm), `Metro ${map}: Modus erkannt`);
  ok(m.districts.length >= 3, `Metro ${map}: mindestens drei Startviertel (${m.districts.length})`);
  ok(gm.transit.stations.size >= 3, `Metro ${map}: mindestens drei Stationen (${gm.transit.stations.size})`);
  ok(gm.transit.freeTrains === 3 && gm.transit.linesMax === 3, `Metro ${map}: Startausstattung`);
  let cardsSeen = 0, metroOnly = true;
  gm.on('cards', (ids) => { cardsSeen++; for (const id of ids) if (!CARDS.find((c) => c.id === id)?.metro) metroOnly = false; });
  let days = 0;
  gm.speed = 3;
  while (!gm.gameOver && days < (quick ? 20 : 45)) {
    metroBot(gm, true);
    runDays(gm, 1, { auto: true });
    days++;
  }
  const s = gm.ext.progression.scen;
  console.log(`Metro ${map.padEnd(8)}: ${days} Tage, ${m.districts.length} Viertel, ${gm.transit.stations.size} Stationen, ${gm.transit.lines.length}/${gm.transit.linesMax} Linien, ${gm.transit.trains.length} Züge, ${gm.stats.pop} Einw · Punkte ${metroScore(gm)} · ${s.status}${s.reason ? ' – ' + s.reason : ''} (${Date.now() - t1} ms)`);
  ok(cardsSeen > 0 ? metroOnly : true, `Metro ${map}: nur Metro-Karten angeboten`);
  ok(m.districts.length > 3, `Metro ${map}: Stadt wächst um neue Viertel`);
  ok(metroScore(gm) > 0, `Metro ${map}: Fahrgäste werden befördert`);
  const ml = Game.fromSave(JSON.parse(JSON.stringify(gm.serialize())));
  ok(ml.ext.progression.metro && ml.ext.progression.metro.districts.length === m.districts.length, `Metro ${map}: Speichern/Laden`);
}
// Wer nichts tut, verliert: Stationen ohne Linie laufen über
{
  const gm = new Game(scenarioOptions('metro', { mapType: 'river', seed: 7 }));
  gm.speed = 3;
  runDays(gm, 12, { auto: true });
  console.log(`Metro ohne Spieler: ${gm.ext.progression.scen.status} nach ${gm.day() - gm.ext.progression.metro.startDay} Tagen – ${gm.ext.progression.scen.reason}`);
  ok(gm.ext.progression.scen.status === 'lost' && gm.gameOver, 'Metro: Untätigkeit führt zum Überlauf');
  ok(gm.ext.progression.inbox.some((x) => x.type === 'scenarioEnd' && x.metro), 'Metro: Endmeldung in der Inbox');
}

// ---------------------------------------------------------------------------------------------
section('Sandkasten');
const gsb = new Game({ size: 64, seed: 1, mapType: 'river', difficulty: 'sandbox', name: 'Sand' });
buildTestCity(gsb);
gsb.speed = 3;
runDays(gsb, 6);
ok(Object.keys(gsb.ext.progression.ach).length === 0, 'im Sandkasten keine Erfolge');

console.log(`\nLaufzeit ${((Date.now() - t0) / 1000).toFixed(1)} s · ${fails ? fails + ' FEHLER' : 'alles in Ordnung'}`);
process.exit(fails ? 1 : 0);
