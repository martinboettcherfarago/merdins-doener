// Prüfstand „Einstieg" (EINSTIEG, Runde 3): Begleiter-Reihenfolge in einem frischen Spiel, klare Texte, wenige
// Möglichkeiten am Anfang, Hilfe-Themen. Aufruf: node test/einstieg-test.mjs
import { Game } from '../src/sim/game.js';
import { BUILDINGS, ZONE_INFO, POLICIES, ROADS, CATEGORIES, R, Z } from '../src/config.js';
import { CARDS, EVENTS } from '../src/sim/progress.js';
import { ADVISOR_RULES, cityCounts } from '../src/ui/advisor.js';
import { helpTopics, helpTopicFor } from '../src/ui/help.js';

let fails = 0, n = 0;
const ok = (c, msg) => { n++; if (!c) { fails++; console.log('  FEHLER: ' + msg); } else console.log('  ok: ' + msg); };

// Das eine Ziel des Begleiters (wie Advisor.compute/pickGoal, ohne Oberfläche)
function goal(g) {
  const c = cityCounts(g);
  const out = [];
  for (const r of ADVISOR_RULES) { let a = null; try { a = r.when(g, c); } catch (e) { a = { text: 'FEHLER ' + e.message }; } if (a) out.push({ id: r.id, rank: r.rank, ...a }); }
  out.sort((a, b) => b.rank - a.rank);
  return out[0];
}
const day = (g, d = 1) => { for (let i = 0; i < 300 * d; i++) { g.update(0.1); if (g.pendingCards) g.chooseCard(g.pendingCards[0]); if (g.pendingEvent) g.resolveEvent(0); } };

console.log('== Begleiter: Reihenfolge im frischen Spiel');
const g = new Game({ size: 64, seed: 11, mapType: 'river', difficulty: 'normal', name: 'Teststadt' });
const W = g.W, hx = g.world.highwayEnd % W, hy = Math.floor(g.world.highwayEnd / W);
const idx = (x, y) => y * W + x;
let gl = goal(g);
ok(gl.id === 'start-road' && gl.act && gl.act.tool && gl.act.tool.kind === 'road', `Start: „${gl.text}"`);
const road = []; for (let x = hx + 1; x <= hx + 14; x++) road.push(idx(x, hy));
ok(g.buildRoad(road, R.STREET).ok, 'Straße gebaut');
gl = goal(g);
ok(gl.id === 'start-zone', `nach der Straße: „${gl.text}"`);
const res = []; for (let x = hx + 3; x <= hx + 9; x++) for (let y = hy - 3; y <= hy - 1; y++) res.push(idx(x, y));
ok(g.zoneTiles(res, Z.RES).ok, 'Wohngebiet ausgewiesen');
gl = goal(g);
ok(gl.id === 'power-none', `nach dem Wohngebiet: „${gl.text}"`);
const place = (key, x0, y0) => { for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (!g.checkPlace(key, x0 + dx, y0 + dy, 0)) return g.placeBuilding(key, x0 + dx, y0 + dy, 0).ok; } return false; };
ok(place('coal', hx + 11, hy + 1), 'Kohlekraftwerk gebaut');
gl = goal(g);
ok(gl.id === 'water-none' && gl.act && gl.act.tool && gl.act.tool.key === 'watertower', `nach dem Kraftwerk: „${gl.text}"`);
ok(place('watertower', hx + 10, hy - 1), 'Wasserturm gebaut');
day(g, 2);
gl = goal(g);
ok(g.stats.pop > 0, `Einwohner nach 2 Tagen: ${g.stats.pop}`);
ok(['jobs', 'garbage-none'].includes(gl.id), `danach: „${gl.text}" (${gl.id})`);
const com = []; for (let x = hx + 2; x <= hx + 5; x++) for (let y = hy + 1; y <= hy + 2; y++) com.push(idx(x, y));
g.zoneTiles(com, Z.COM);
const ind = []; for (let x = hx + 6; x <= hx + 9; x++) for (let y = hy + 1; y <= hy + 3; y++) ind.push(idx(x, y));
g.zoneTiles(ind, Z.IND);
day(g, 3);
gl = goal(g);
ok(!!gl && !!gl.text && gl.id !== 'jobs', `später: „${gl.text}" (${gl.id})`);
ok(ADVISOR_RULES.every((r) => typeof r.rank === 'number'), 'Jede Regel hat einen Rang');
// Jede Regel liefert einfache Texte (keine Fachwörter ohne Erklärung, keine Hochbahn)
const bad = /Hochbahn|Stelzen|Pfeiler|Trasse|Kapazität|Einzugsradius/;
let ruleTexts = 0, ruleBad = [];
for (const r of ADVISOR_RULES) { let a = null; try { a = r.when(g, cityCounts(g)); } catch (e) { a = null; } if (a) { ruleTexts++; if (bad.test(a.text + ' ' + (a.why || ''))) ruleBad.push(r.id); } }
ok(!ruleBad.length, `Ratgeber-Texte ohne Fachwörter (${ruleTexts} aktiv)${ruleBad.length ? ': ' + ruleBad.join(', ') : ''}`);

console.log('== Texte');
const UBAHN_OWNED = new Set(['station']);
const noDesc = [], longDesc = [], elev = [], ufer = [];
for (const [k, d] of Object.entries(BUILDINGS)) {
  if (UBAHN_OWNED.has(k)) continue;
  if (!d.desc) noDesc.push(k);
  else if (d.desc.length > 170) longDesc.push(`${k} (${d.desc.length})`);
  if (bad.test(d.desc || '')) elev.push(k);
  if (d.needsWater && !/Ufer|am Wasser/.test(d.desc || '')) ufer.push(k);
}
ok(!noDesc.length, `Jedes Gebäude hat einen Text${noDesc.length ? ': ' + noDesc.join(', ') : ''}`);
ok(!longDesc.length, `Gebäudetexte kurz (≤ 170 Zeichen)${longDesc.length ? ': ' + longDesc.join(', ') : ''}`);
ok(!elev.length, `Keine Hochbahn-/Fachwörter in Gebäudetexten${elev.length ? ': ' + elev.join(', ') : ''}`);
ok(!ufer.length, `Gebäude am Wasser sagen „Ufer"${ufer.length ? ': ' + ufer.join(', ') : ''}`);
ok([1, 2, 3, 4].every((z) => ZONE_INFO[z].desc && ZONE_INFO[z].desc.length > 20), 'Jede Zone hat einen Wozu-Text');
ok(Object.values(ROADS).every((r) => r.desc), 'Jede Straßenart hat einen Text');
ok(POLICIES.every((p) => p.desc && !bad.test(p.desc)), 'Verordnungen klar beschrieben');
ok(CATEGORIES.find((c) => c.id === 'transit').name === 'U-Bahn', 'Kategorie heißt U-Bahn');
const cardBad = CARDS.filter((c) => { try { return bad.test((c.tag || '') + (typeof c.text === 'function' ? c.text(g) : c.text || '')); } catch (e) { return false; } }).map((c) => c.id);
ok(!cardBad.length, `Wochenkarten ohne Hochbahn${cardBad.length ? ': ' + cardBad.join(', ') : ''}`);
const evBad = EVENTS.filter((e) => bad.test((e.title || '') + (typeof e.text === 'string' ? e.text : ''))).map((e) => e.id);
ok(!evBad.length, `Ereignisse ohne Hochbahn${evBad.length ? ': ' + evBad.join(', ') : ''}`);

console.log('== Fortschreitende Freischaltung');
const fresh = new Game({ size: 64, seed: 3, mapType: 'river', difficulty: 'normal' });
const startKeys = Object.keys(BUILDINGS).filter((k) => fresh.isUnlocked(k));
ok(startKeys.length <= 8, `Am Anfang wenige Gebäude (${startKeys.length}): ${startKeys.map((k) => BUILDINGS[k].name).join(', ')}`);
ok(['coal', 'watertower', 'landfill'].every((k) => fresh.isUnlocked(k)), 'Kraftwerk, Wasserturm und Deponie gleich verfügbar');
ok(!fresh.isUnlocked('transit') && !fresh.isUnlocked('zone4') && !fresh.isUnlocked('disaster_center'), 'U-Bahn, Büros und Katastrophenschutz kommen später');
fresh.milestone = 1;
const dorf = Object.keys(BUILDINGS).filter((k) => fresh.isUnlocked(k) && !startKeys.includes(k));
ok(dorf.length <= 8 && ['police', 'fire', 'clinic', 'school'].every((k) => dorf.includes(k)), `Dorf bringt die Grunddienste (${dorf.length})`);

console.log('== Hilfe');
const T = helpTopics();
ok(T.length >= 12 && new Set(T.map((t) => t.id)).size === T.length, `${T.length} Hilfe-Themen, alle eindeutig`);
ok(helpTopicFor('pump') === 'water' && helpTopicFor('transit') === 'ubahn' && helpTopicFor('school') === 'services' && helpTopicFor('unbekannt') === 'start', 'helpTopicFor findet passende Themen');

console.log(fails ? `${fails} von ${n} Prüfungen fehlgeschlagen.` : `${n}/${n} Prüfungen bestanden.`);
process.exit(fails ? 1 : 0);
