// Prüfstand Speichern/Laden: Rundreisen mit allen Systemen in verschiedenen Zuständen, alte Spielstände (Version 1),
// beschädigte Daten und Reproduzierbarkeit der Simulation.
//   node test/save-test.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRng } from '../src/sim/rng.js';

// Math.random aufzeichnen und durch reproduzierbaren Zufall ersetzen (vor dem Laden der Simulation)
const realRandom = Math.random;
const rnd = { rng: makeRng(1), calls: 0, sources: new Map() };
Math.random = () => {
  rnd.calls++;
  if (rnd.calls <= 400) {
    // erster Aufrufer außerhalb von util.js (WeightedList.sample bekommt Math.random oft übergeben)
    const lines = (new Error().stack || '').split('\n').slice(2);
    const line = lines.find((l) => /src\//.test(l) && !/src\/util\.js/.test(l)) || lines[0] || '';
    const m = line.match(/src\/([\w/.-]+\.js)/);
    const src = m ? m[1] : 'test';
    rnd.sources.set(src, (rnd.sources.get(src) || 0) + 1);
  }
  return rnd.rng();
};
const resetRandom = (seed) => { rnd.rng = makeRng(seed); };

const { Game, SaveError } = await import('../src/sim/game.js');
const { VERSION, R, Z } = await import('../src/config.js');
const { buildDemoCity } = await import('../src/sim/demo.js');
const DIST = await import('../src/sim/systems/districts.js');
const TPS = await import('../src/sim/systems/transport.js');
const PROG = await import('../src/sim/systems/progression.js');
const { SYSTEMS } = await import('../src/registry.js');

const here = dirname(fileURLToPath(import.meta.url));
const t0 = Date.now();
let fails = 0, count = 0;
const ok = (c, msg) => { count++; if (!c) fails++; console.log(`  ${c ? '✓' : '✗'} ${msg}`); return c; };
const notes = new Set();
const open = new Map(); // offene Abweichungen in Systemdaten (Besitz Q2), mit STRICT=1 als Fehler
const STRICT = !!process.env.STRICT;
const quietWarn = console.warn;
let warnings = [];
console.warn = (...a) => { warnings.push(a.map(String).join(' ').slice(0, 200)); };

function hook(g) {
  g.on('cards', (ids) => g.chooseCard(ids[0]));
  g.on('event', () => g.resolveEvent(0));
  return g;
}
function run(g, days) {
  const steps = Math.round(days * 300);
  for (let k = 0; k < steps; k++) {
    g.update(0.1);
    if (g.speed === 0) g.speed = 1; // Szenarien starten pausiert
    if (g.pendingCards) g.chooseCard(g.pendingCards[0]);
    if (g.pendingEvent) g.resolveEvent(0);
  }
}

// Tiefer Vergleich zweier Spielstände; liefert die Pfade mit Unterschieden
function diff(a, b, path = '', out = []) {
  if (out.length > 12) return out;
  if (a === b) return out;
  if (typeof a === 'number' && typeof b === 'number') {
    if (Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a))) return out;
    out.push(`${path} (${a} → ${b})`); return out;
  }
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') { out.push(`${path} (${JSON.stringify(a)?.slice(0, 40)} → ${JSON.stringify(b)?.slice(0, 40)})`); return out; }
  if (Array.isArray(a) !== Array.isArray(b)) { out.push(`${path} (Typ)`); return out; }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (path === '' && k === 'savedAt') continue;
    diff(a[k], b[k], path ? `${path}.${k}` : k, out);
  }
  return out;
}

// Speichern → JSON → Laden → Speichern muss denselben Stand liefern; danach läuft das Spiel fehlerfrei weiter.
function roundtrip(g, label, check) {
  const a = JSON.parse(JSON.stringify(g.serialize()));
  let g2 = null;
  try { g2 = hook(Game.fromSave(JSON.stringify(a))); } catch (e) { ok(false, `${label}: Laden (${e.message})`); return null; }
  const b = JSON.parse(JSON.stringify(g2.serialize()));
  // Effekte mit `src` berechnen Systeme beim Laden neu (z. B. Wetter) – nur als Hinweis vergleichen
  const split = (x) => { const own = x.effects.filter((e) => !e.src), sys = x.effects.filter((e) => e.src); return [{ ...x, effects: own }, sys]; };
  const [a1, aSys] = split(a), [b1, bSys] = split(b);
  // Kern (alles außer ext) muss exakt erhalten bleiben; Abweichungen in Systemdaten (ext.*) werden einzeln gemeldet.
  // `pop` ist nur die Anzeige im Speicherplatz (Stand der letzten Zählung) und wird beim Laden neu gezählt
  const core = diff({ ...a1, ext: null, pop: 0 }, { ...b1, ext: null, pop: 0 });
  ok(core.length === 0, `${label}: Rundreise verlustfrei (Kern)${core.length ? ' – ' + core.slice(0, 6).join(' · ') : ''}`);
  for (const id of Object.keys(a.ext || {})) {
    const de = diff(a.ext[id], b.ext ? b.ext[id] : undefined, `ext.${id}`).filter((p) => !/^ext\.weather\.avg\.5 /.test(p));
    if (STRICT) ok(de.length === 0, `${label}: Rundreise verlustfrei (System ${id})${de.length ? ' – ' + de.slice(0, 4).join(' · ') : ''}`);
    else for (const p of de.slice(0, 3)) open.set(p.replace(/\.\d+(?=[ .])/g, '.#').replace(/ \(.*$/, ''), `${label}: ${p}`);
  }
  const ds = diff(aSys.map(({ until, ...e }) => e), bSys.map(({ until, ...e }) => e)).concat(diff(a.ext.weather?.avg?.[5], b.ext.weather?.avg?.[5], 'ext.weather.avg.5'));
  if (ds.length) open.set('Effekte mit src (Wetter)', `${label}: Systeme rechnen ihre Effekte beim Laden neu – ${ds[0]}`);
  ok(g2.errors.length === 0, `${label}: Laden ohne Fehler${g2.errors.length ? ' – ' + g2.errors.map((e) => e.where + ': ' + e.msg).join(' · ') : ''}`);
  if (check) check(g2);
  run(g2, 1.5);
  ok(g2.errors.length === 0 && Number.isFinite(g2.money), `${label}: läuft nach dem Laden weiter${g2.errors.length ? ' – ' + g2.errors.map((e) => e.where + ': ' + e.msg).join(' · ') : ''}`);
  return g2;
}

// ---------------------------------------------------------------- Teststadt
function city(opts = {}) {
  const g = hook(new Game({ size: 64, seed: 7, mapType: 'river', difficulty: 'normal', name: 'Speicherstadt', ...opts }));
  g.money = 500000;
  buildDemoCity(g);
  return g;
}

console.log('=== Rundreisen');
resetRandom(11);
const g = city();
run(g, 6);
console.log(`  Stadt: ${g.buildings.size} Gebäude, ${Math.round(g.stats.pop)} Einw., Tag ${g.day()}`);
roundtrip(g, 'Normale Stadt');

// Bezirke mit Verordnung
const W = g.W, hy = g.world.highwayY, x0 = g.world.highwayEnd % W + 1;
const rect = (ax, ay, bx, by) => { const t = []; for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) t.push(y * W + x); return t; };
const d1 = DIST.createDistrict(g, 'Altstadt');
DIST.paintTiles(g, d1.id, rect(x0 + 3, hy - 11, x0 + 20, hy - 1)); DIST.finishStroke(g, d1.id);
const d2 = DIST.createDistrict(g, 'Hafen');
DIST.paintTiles(g, d2.id, rect(x0 + 3, hy + 1, x0 + 20, hy + 11)); DIST.finishStroke(g, d2.id);
const pol = g.ext.districts.policyDefs ? null : null; void pol;
run(g, 0.5);
roundtrip(g, 'Bezirke', (g2) => ok(g2.ext.districts.list.length === 2 && g2.ext.districts.list[0].name === 'Altstadt', 'Bezirke: Namen und Anzahl erhalten'));

// Bus- und Tramlinien
g.milestone = Math.max(g.milestone, 6);
const placeNear = (key, cx, cy) => { for (let d = 0; d < 12; d++) for (const [ox, oy] of [[d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, -d], [d, -d], [-d, d]]) if (g.placeBuilding(key, cx + ox, cy + oy).ok) return true; return false; };
ok(placeNear('bus_depot', x0 + 8, hy + 3) && placeNear('tram_depot', x0 + 26, hy + 3), 'Bus- und Straßenbahndepot gebaut');
const stops = [];
for (let x = x0 + 4; x < x0 + 34 && stops.length < 6; x += 5) {
  for (const y of [hy - 6, hy + 6]) { const i = y * W + x; if (g.road[i] && !TPS.canStop(g, i, 'bus')) { stops.push(i); break; } }
}
const bus = TPS.createLine(g, 'bus', stops.slice(0, 4));
const tramStops = [];
for (let x = x0 + 3; x < x0 + 34 && tramStops.length < 4; x += 7) { const i = hy * W + x; if (g.road[i] && !TPS.canStop(g, i, 'tram')) tramStops.push(i); }
const tram = TPS.createLine(g, 'tram', tramStops);
ok(bus.ok, `Buslinie angelegt${bus.ok ? '' : ' – ' + bus.msg}`);
ok(tram.ok, `Tramlinie angelegt${tram.ok ? '' : ' – ' + tram.msg}`);
run(g, 0.5);
roundtrip(g, 'Bus und Tram', (g2) => ok(g2.ext.transport.lines.length === g.ext.transport.lines.length && g2.ext.transport.lines.length >= 1, `Linien erhalten (${g2.ext.transport.lines.length})`));

// Wetter: Schnee
g.system('weather').set(g, 'snow', { snowCover: 0.8 });
run(g, 0.1);
roundtrip(g, 'Schneefall', (g2) => ok(g2.ext.weather.kind === g.ext.weather.kind && Math.abs(g2.ext.weather.snowCover - g.ext.weather.snowCover) < 1e-6, `Wetter erhalten (${g2.ext.weather.label}, Schnee ${Math.round(g2.ext.weather.snowCover * 100)} %)`));

// Hochwasser mitten im Ereignis
const dis = g.system('disasters');
const fl = dis.trigger(g, 'flood', { x: x0 + 12, y: hy, intensity: 0.9 });
let flRun = 0;
for (let k = 0; k < 400 && !g.ext.disasters.active.some((a) => a.type === 'flood'); k++) { run(g, 0.02); flRun++; }
run(g, 0.15);
const activeFlood = g.ext.disasters.active.some((a) => a.type === 'flood');
ok(!!fl && activeFlood, `Hochwasser läuft (${g.ext.disasters.active.map((a) => a.type).join(', ') || 'keins'})`);
roundtrip(g, 'Hochwasser', (g2) => ok(g2.ext.disasters.active.some((a) => a.type === 'flood'), 'Hochwasser läuft nach dem Laden weiter'));

// Tornado (Katastrophe mit Zerstörung) läuft
dis.trigger(g, 'tornado', { x: x0 + 20, y: hy - 5, intensity: 0.8 });
for (let k = 0; k < 400 && !g.ext.disasters.active.some((a) => a.type === 'tornado'); k++) run(g, 0.02);
run(g, 0.05);
roundtrip(g, 'Tornado', (g2) => ok(g2.ext.disasters.active.length === g.ext.disasters.active.length, `aktive Katastrophen erhalten (${g2.ext.disasters.active.length})`));

console.log('=== Szenario und Metro');
resetRandom(12);
const gs = hook(new Game(PROG.scenarioOptions('flusstal')));
run(gs, 2);
roundtrip(gs, 'Szenario Flusstal', (g2) => ok(PROG.scenarioStatus(g2)?.st.id === 'flusstal', 'Szenario bleibt aktiv'));
const gm = hook(new Game(PROG.scenarioOptions('metro', { seed: 4711, mapType: 'river' })));
run(gm, 1);
roundtrip(gm, 'Metro-Modus', (g2) => ok(PROG.isMetro(g2) && g2.transit.stations.size === gm.transit.stations.size, `Metro-Modus mit ${g2.transit.stations.size} Stationen`));

console.log('=== Alter Spielstand (Version 1)');
const v1 = JSON.parse(readFileSync(join(here, 'fixtures/save-v1.json'), 'utf8'));
let go = null;
try { go = hook(Game.fromSave(v1)); } catch (e) { ok(false, `Version 1 lädt (${e.message})`); }
if (go) {
  ok(v1.v === 1 && go.buildings.size === v1.buildings.length, `Version 1 lädt: ${go.buildings.size} Gebäude, ${Math.round(go.stats.pop)} Einw.`);
  ok(go.transit.lines.length === v1.transit.lines.length && go.transit.stations.size === v1.transit.stations.length, `Pulsbahn übernommen (${go.transit.stations.size} Stationen, ${go.transit.lines.length} Linie)`);
  ok((go.loadNotes || []).some((n) => n.includes('älteren Version')), 'Hinweis „aus einer älteren Version übernommen“');
  const pop0 = go.stats.pop;
  run(go, 3);
  ok(go.errors.length === 0 && go.stats.pop > pop0 * 0.6, `Version 1 läuft 3 Tage (${Math.round(pop0)} → ${Math.round(go.stats.pop)} Einw.)${go.errors.length ? ' – ' + go.errors.map((e) => e.where + ': ' + e.msg).join(' · ') : ''}`);
  const s2 = go.serialize();
  ok(s2.v === VERSION && !!s2.ext && Object.keys(s2.ext).length >= 3, `wird als Version ${s2.v} gespeichert (${Object.keys(s2.ext).length} Systeme)`);
}

console.log('=== Beschädigte Daten');
const good = JSON.parse(JSON.stringify(city({ seed: 9 }).serialize()));
const friendly = (label, data) => {
  try { Game.fromSave(data); ok(false, `${label}: wird abgelehnt`); } catch (e) { ok(e instanceof SaveError && /[a-zäöü]/.test(e.message), `${label}: freundliche Meldung („${e.message}“)`); }
};
friendly('kein Spielstand (null)', null);
friendly('Zahl', 42);
friendly('kaputtes JSON', '{"v":2,"road":');
friendly('leeres Objekt', {});
friendly('Liste', []);
friendly('Straßen abgeschnitten', { ...good, road: good.road.slice(0, 100) });
friendly('Kartengröße unsinnig', { ...good, opts: { ...good.opts, size: 99999 } });
friendly('Gebäude kein Feld', { ...good, buildings: 'viele' });
const tolerant = (label, data, check) => {
  let g2 = null;
  try { g2 = hook(Game.fromSave(data)); } catch (e) { ok(false, `${label}: lädt trotzdem (${e.constructor.name}: ${e.message})`); return null; }
  run(g2, 1);
  const runErr = g2.errors.filter((e) => !/\((load|init)\)/.test(e.where));
  ok(runErr.length === 0 && Number.isFinite(g2.money), `${label}: lädt und läuft${(g2.loadNotes || []).length ? ' – Hinweise: ' + g2.loadNotes.join(' · ') : ''}${runErr.length ? ' – FEHLER: ' + runErr.map((e) => e.where + ': ' + e.msg).join(' · ') : ''}`);
  if (check) check(g2);
  return g2;
};
const badB = [...good.buildings.slice(0, 40), 'Quatsch', null, [1, 'zone'], [99999, 'gibtsnicht', 0, 3, 3, 1, 1, 0, 1], [99998, 'zone', 1, -5, 3, 1, 1, 0, 1], [99997, 'zone', 1, 62, 62, 4, 4, 0, 1], good.buildings[0]];
tolerant('kaputte Gebäudeeinträge', { ...good, buildings: badB }, (g2) => ok((g2.loadNotes || []).some((n) => n.includes('Gebäude')), 'Hinweis über entfernte Gebäude'));
tolerant('unsinnige Zahlen', { ...good, money: 'viel', time: -50, taxes: { 1: 'x', 2: 99 }, speed: 17, milestone: 99, effects: [null, { key: 'happy', value: NaN }], history: 'nein' });
tolerant('Pulsbahn beschädigt', { ...good, transit: { stations: 'x', lines: 5 } });
const extBad = {};
for (const s of SYSTEMS) extBad[s.id] = 'kaputt';
tolerant('Systemdaten als Text', { ...good, ext: extBad });
const extObj = {};
for (const s of SYSTEMS) extObj[s.id] = { unsinn: true, list: 7 };
tolerant('Systemdaten mit falschen Feldern', { ...good, ext: extObj });
const extNull = {};
for (const s of SYSTEMS) extNull[s.id] = null;
tolerant('Systemdaten null', { ...good, ext: extNull });
tolerant('ohne Systemdaten', { ...good, ext: undefined, serviceBudget: undefined, v: 1 });

console.log('=== Alle Kartentypen und Größen');
{
  const { MAP_TYPES, MAP_SIZES } = await import('../src/config.js');
  const bad = [];
  let n = 0;
  for (const mt of MAP_TYPES) for (const sz of MAP_SIZES) {
    try {
      const gg = hook(new Game({ size: sz.id, seed: 3 + n, mapType: mt.id, difficulty: n % 2 ? 'sandbox' : 'normal', name: 'Kartenprobe' }));
      gg.money = 1e6;
      buildDemoCity(gg);
      run(gg, 0.5);
      const g3 = Game.fromSave(JSON.stringify(gg.serialize()));
      run(g3, 0.1);
      const errs = [...gg.errors, ...g3.errors];
      if (errs.length) bad.push(`${mt.id}/${sz.id}: ${errs[0].where}: ${errs[0].msg}`);
    } catch (e) { bad.push(`${mt.id}/${sz.id}: ${e.message}`); }
    n++;
  }
  ok(bad.length === 0, `${n} Karten (${MAP_TYPES.length} Typen × ${MAP_SIZES.length} Größen) starten, laufen und laden fehlerfrei${bad.length ? ' – ' + bad.slice(0, 4).join(' · ') : ''}`);
}

console.log('=== Robustheit');
{
  // Ein absichtlich fehlerhaftes System darf das Spiel nicht anhalten
  const broken = { id: '_kaputt', step() { throw new Error('Testfehler step'); }, hourly() { throw new Error('Testfehler hourly'); }, daily() { throw new Error('Testfehler daily'); }, renderables() { throw new Error('Testfehler renderables'); }, serialize() { throw new Error('Testfehler serialize'); } };
  SYSTEMS.push(broken);
  const gb = city({ seed: 31 });
  let thrown = null;
  const d0 = gb.day();
  try { run(gb, 1.2); gb.renderables(); JSON.stringify(gb.serialize()); } catch (e) { thrown = e; }
  SYSTEMS.splice(SYSTEMS.indexOf(broken), 1);
  ok(!thrown && gb.day() > d0 && gb.stats.pop > 0, `fehlerhaftes System hält das Spiel nicht an${thrown ? ' – ' + thrown.message : ''} (${gb.errors.length} Fehler abgefangen)`);
  ok(gb.errors.some((e) => e.where.includes('_kaputt')), 'Fehler wird gemeldet (g.errors)');
  const ge = city({ seed: 32 });
  ge.on('day', () => { throw new Error('Testfehler Ereignis'); });
  let t2 = null;
  try { run(ge, 1.2); } catch (e) { t2 = e; }
  ok(!t2 && ge.errors.some((e) => e.where.includes('day')), 'fehlerhafter Ereignis-Empfänger hält das Spiel nicht an');
}

console.log('=== Reproduzierbarkeit');
const sim = (seed) => {
  resetRandom(seed);
  const gg = city({ seed: 21 });
  run(gg, 5);
  return JSON.parse(JSON.stringify(gg.serialize()));
};
rnd.calls = 0; rnd.sources.clear();
const A = sim(5), B = sim(5);
const dd = diff(A, B);
ok(dd.length === 0, `gleicher Startwert → gleicher Spielstand nach 5 Tagen${dd.length ? ' – ' + dd.slice(0, 5).join(' · ') : ''}`);
const coreRandom = [...rnd.sources.keys()].filter((k) => /^sim\/[a-z]+\.js$/.test(k));
ok(coreRandom.length === 0, `Kernsimulation ohne Math.random${coreRandom.length ? ' – ' + coreRandom.join(', ') : ''}`);
const other = [...rnd.sources.entries()].filter(([k]) => !/^sim\/[a-z]+\.js$/.test(k));
if (other.length) console.log(`  Hinweis: Math.random noch in ${other.map(([k, n]) => `${k} (${n}×)`).join(', ')} – nur mit ersetztem Math.random reproduzierbar.`);

Math.random = realRandom;
console.warn = quietWarn;
for (const n of notes) console.log(`  Hinweis: ${n}`);
if (open.size) {
  console.log(`  Offen (Systemdaten, nicht verlustfrei – mit STRICT=1 als Fehler):`);
  for (const [k, v] of open) console.log(`    · ${k}: ${v}`);
}
if (warnings.length) console.log(`  Warnungen: ${warnings.length} (erste: ${warnings[0]})`);
console.log(`\n${count - fails}/${count} Prüfungen bestanden${fails ? ` – ${fails} FEHLER` : ''} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(fails ? 1 : 0);
