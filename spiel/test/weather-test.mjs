// Prüfstand Wetter, Jahreszeiten & Katastrophen (S4).
// Spielt ein ganzes Spieljahr (4 × 28 Tage) mit einer automatisch gebauten Stadt, löst Katastrophen aus,
// prüft Jahreszeiten, Verbrauchsänderungen, Schäden, Rettung, Aufräumen, Wiederaufbau und Speichern/Laden.
//   node test/weather-test.mjs            (Standard: 1 Jahr, Karte Flusstal)
//   node test/weather-test.mjs 140 lakes  (Tage, Kartentyp)
import { Game } from '../src/sim/game.js';
import { R, Z, DAY } from '../src/config.js';
import { on } from '../src/registry.js';
import { YEAR_DAYS, SEASON_INFO, setWeatherNow, weatherImpact } from '../src/sim/systems/weather.js';
import { triggerDisaster, DISASTERS, rebuildRuin } from '../src/sim/systems/disasters.js';
import { happinessFactors } from '../src/sim/services.js';
const WX_LABELS = ['Wetter', 'Hitze', 'Kalte Wohnungen', 'Ungeräumte Straßen', 'Freibad offen', 'Weihnachtszeit', 'Sorge vor Katastrophen', 'Zerstörung in der Nachbarschaft', 'Trauer', 'Obdachlose nach Katastrophe', 'Überflutet', 'Kein Strom', 'Kein Wasser'];
function wxFactors(g) {
  const agg = {}; let n = 0;
  for (const b of g.buildings.values()) {
    if (b.zone !== 1 || b.abandoned || b.construct < 1) continue;
    n++;
    const out = []; happinessFactors(g, b, out);
    for (const [l, v] of out) if (WX_LABELS.includes(l)) agg[l] = (agg[l] || 0) + v;
  }
  return Object.entries(agg).map(([l, v]) => `${l} ${(v / Math.max(1, n)).toFixed(1)}`).join(', ');
}

const days = +(process.argv[2] || YEAR_DAYS + 4);
const mapType = process.argv[3] || 'river';
let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('  ✗ FEHLER:', msg); } else console.log('  ✓', msg); };

const events = [];
on('disaster', (e) => { if (e.type !== 'lightning') events.push(e); });
let seasonEvents = 0;
on('season', () => seasonEvents++);

function makeCity(seed, difficulty = 'normal', extra = {}) {
  const g = new Game({ size: 96, seed, mapType, difficulty, name: 'Wetterstadt', ...extra });
  const W = g.W, hy = g.world.highwayY;
  const idx = (x, y) => y * W + x;
  g.on('cards', (ids) => g.chooseCard(ids[0]));
  g.on('event', () => g.resolveEvent(0));
  const road = (x0, y0, x1, y1, t = R.STREET) => {
    if (y0 === y1) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) g.buildRoad([idx(x, y0)], t);
    else for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) g.buildRoad([idx(x0, y)], t);
  };
  const zone = (x0, y0, x1, y1, z) => { const t = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < W && y < W) t.push(idx(x, y)); g.zoneTiles(t, z); };
  const place = (key, x, y) => {
    for (let d = 0; d < 9; d++) for (const [ox, oy] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, -d], [d, -d], [-d, d]]) {
      const r = g.placeBuilding(key, x + ox, y + oy);
      if (r.ok) return r.building;
    }
    return null;
  };
  road(6, hy, 46, hy);
  for (let x = 9; x <= 45; x += 5) road(x, hy - 12, x, hy + 12);
  for (const dy of [-12, -6, 6, 12]) road(9, hy + dy, 45, hy + dy);
  place('landfill', 24, hy + 13);
  zone(10, hy - 11, 28, hy - 1, Z.RES);
  zone(10, hy + 1, 22, hy + 11, Z.COM);
  zone(31, hy + 1, 44, hy + 11, Z.IND);
  zone(29, hy - 11, 44, hy - 1, Z.RES);
  place('coal', 40, hy + 13);
  place('watertower', 8, hy - 3);
  place('watertower', 8, hy + 3);
  return { g, place, road, zone, hy, idx };
}

const t0 = Date.now();
const C = makeCity(4242);
const { g, place, hy } = C;
console.log(`Stadt gebaut (Karte ${mapType}). Starte ${days} Tage …`);
const built = {};
const weekly = [];
let wk = { tMin: 99, tMax: -99, rainH: 0, snowMax: 0, fogH: 0, stormH: 0, kinds: {}, water: [], power: [], tour: [] };
const seasonT = { spring: [], summer: [], autumn: [], winter: [] };
const seasonWater = { spring: [], summer: [], autumn: [], winter: [] };
const seasonPower = { spring: [], summer: [], autumn: [], winter: [] };
const seenSeasons = new Set();
let rebuilt = 0, maxSnow = 0, lightningCount = 0, maxDisplaced = 0, sawRepair = false, sawRubble = false;
const plan = [
  { day: 26, type: 'flood' },
  { day: 38, type: 'tornado' },
  { day: 52, type: 'wildfire' },
  { day: 64, type: 'quake' },
  { day: 78, type: 'meteor' },
  { day: 92, type: 'storm' },
];
let savedMid = null;
const eff = (key) => g.effects.filter((e) => e.src === 'wetter:' + key).reduce((s, e) => s + e.value, 0);

for (let d = 1; d <= days; d++) {
  for (let s = 0; s < 300; s++) {
    g.update(0.1);
    const w = g.ext.weather;
    wk.tMin = Math.min(wk.tMin, w.temp); wk.tMax = Math.max(wk.tMax, w.temp);
    if (s % 25 === 0) {
      const h = 1 / 12;
      if (w.rain > 0.08) wk.rainH += h * 2;
      if (w.fog > 0.4) wk.fogH += h * 2;
      if (w.storm) wk.stormH += h * 2;
      wk.snowMax = Math.max(wk.snowMax, w.snowCover);
      maxSnow = Math.max(maxSnow, w.snowCover);
      seasonT[w.season].push(w.temp);
    }
  }
  const w = g.ext.weather, st = g.ext.disasters;
  if (process.env.WX_DEBUG) {
    const plants = [...g.buildings.values()].filter((b) => !b.zone && (b.key === 'coal' || b.key === 'wind' || b.key === 'watertower')).map((b) => `${b.key}@${b.x},${b.y}:${b.construct.toFixed(2)}${b.comp >= 0 ? '' : '!'}${b.powered ? '' : '-'}`).join(' ');
    console.log(`    Tag ${d} Strom ${Math.round(g.util.powerDemand)}/${Math.round(g.util.powerSupply)} unversorgt ${g.stats.unpowered} Komp ${g.compCount} | ${plants}`);
  }
  seenSeasons.add(w.season);
  wk.kinds[w.kind] = (wk.kinds[w.kind] || 0) + 1;
  wk.water.push(eff('waterUse')); wk.power.push(eff('powerMul')); wk.tour.push(eff('tourism'));
  seasonWater[w.season].push(eff('waterUse')); seasonPower[w.season].push(weatherImpact(g)?.powerMul ?? 0); // Strombilanz: Erzeugung nach Wetter ÷ Mehrverbrauch
  lightningCount = st.strikes.length > 0 ? lightningCount + st.strikes.filter((x) => g.time - x.t < DAY).length : lightningCount;
  maxDisplaced = Math.max(maxDisplaced, st.displaced);
  if (Object.keys(st.repairs).length) sawRepair = true;
  // Der „Spieler" baut zerstörte Dienstgebäude wieder auf
  for (let k = st.ruins.length - 1; k >= 0; k--) { const r = st.ruins[k]; const res = rebuildRuin(g, k); if (res.ok) { rebuilt++; console.log(`  Tag ${d}: ${r.name} wiederaufgebaut (${res.cost} €)`); } }
  if (st.rubble.length) sawRubble = true;
  // Schutzbauten, sobald freigeschaltet
  const tryB = (key, x, y) => { if (!built[key] && g.isUnlocked(key)) { const b = place(key, x, y); if (b) { built[key] = b; console.log(`  Tag ${d}: ${key} gebaut`); } } };
  if (g.milestone >= 1) { tryB('police', 20, hy - 5); tryB('fire', 30, hy + 5); tryB('clinic', 15, hy + 7); tryB('school', 24, hy - 8); tryB('weather_station', 12, hy - 7); }
  if (g.milestone >= 2) { tryB('warning_siren', 26, hy - 4); tryB('snow_depot', 34, hy + 7); tryB('wind', 46, hy - 8); tryB('swimming_pool', 36, hy - 9); }
  if (g.milestone >= 3) { tryB('disaster_center', 18, hy + 13); tryB('shelter', 30, hy - 13); tryB('hospital', 30, hy - 15); }
  if (d === 30 && !built.coal2) { built.coal2 = place('coal', 40, hy + 16); place('watertower', 47, hy + 8); place('watertower', 47, hy + 10); }
  // Katastrophen auslösen
  for (const p of plan) {
    if (p.day !== d) continue;
    g.ext.disasters.freq = 'normal';
    const a = triggerDisaster(g, p.type, p.type === 'flood' ? { intensity: 0.9 } : { intensity: 0.85 });
    console.log(`  Tag ${d}: ${DISASTERS[p.type].name} ausgelöst ${a ? `bei ${Math.round(a.x)},${Math.round(a.y)}` : '– kein Ort gefunden'}`);
  }
  if (d === 27 && !savedMid) {
    savedMid = JSON.stringify(g.serialize());
    console.log(`  Tag ${d}: Spielstand während Hochwasser gespeichert (${(savedMid.length / 1024).toFixed(0)} KB, aktive Katastrophen ${st.active.length})`);
  }
  if (d % 7 === 0 || d === days) {
    const s = g.stats, b = g.lastBudget;
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    const kinds = Object.entries(wk.kinds).map(([k, n]) => `${k}${n > 1 ? '×' + n : ''}`).join(' ');
    console.log(`Woche ${String(Math.ceil(d / 7)).padStart(2)} ${SEASON_INFO[w.season].name.padEnd(8)} T ${wk.tMin.toFixed(0).padStart(3)}…${wk.tMax.toFixed(0).padStart(3)} °C · Regen ${wk.rainH.toFixed(0).padStart(2)} h · Schnee ${(wk.snowMax * 100).toFixed(0).padStart(3)} % · Nebel ${wk.fogH.toFixed(0)} h · Gew ${wk.stormH.toFixed(0)} h | Wasser ${(avg(wk.water) * 100).toFixed(0).padStart(3)} % Strom ${(avg(wk.power) * 100).toFixed(0).padStart(3)} % Tour ${avg(wk.tour).toFixed(0).padStart(3)} % | Einw ${String(s.pop).padStart(5)} Glück ${s.happiness.toFixed(0)} Geld ${Math.round(g.money)} Saldo ${Math.round(b.net)} | Rep ${Object.keys(st.repairs).length} Trümmer ${st.rubble.length} Ruinen ${st.ruins.length} Obdachl ${st.displaced} | ${kinds}`);
    console.log(`          Glück (Wetter/Katastrophen): ${wxFactors(g) || '–'} · unversorgt Strom ${s.unpowered} Wasser ${s.unwatered} verlassen ${s.abandoned}`);
    weekly.push({ ...wk });
    wk = { tMin: 99, tMax: -99, rainH: 0, snowMax: 0, fogH: 0, stormH: 0, kinds: {}, water: [], power: [], tour: [] };
  }
}
const secs = (Date.now() - t0) / 1000;
console.log(`Laufzeit ${secs.toFixed(1)} s (${((secs / days) * 1000).toFixed(0)} ms pro Spieltag)`);

const st = g.ext.disasters;
console.log('\nChronik:');
for (const h of st.history) console.log(`  Tag ${h.day} ${h.name}${h.aftershock ? ' (Nachbeben)' : ''}: zerstört ${h.destroyed}, beschädigt ${h.damaged}, verbrannt ${h.burned}, gerettet ${h.rescued}, vermisst ${h.lost}, Schaden ${h.cost} €${h.prep.length ? ', Vorbereitung ' + h.prep.join('+') : ''}`);
console.log('Summen', JSON.stringify(st.totals), '· Ereignisse', events.length, '· Blitze', lightningCount);

console.log('\nPrüfungen:');
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
ok(seenSeasons.size === 4, `alle vier Jahreszeiten erlebt (${[...seenSeasons].join(', ')})`);
ok(seasonEvents >= 4, `Jahreszeitenwechsel gemeldet (${seasonEvents}×)`);
ok(avg(seasonT.summer) > avg(seasonT.winter) + 10, `Sommer (Ø ${avg(seasonT.summer).toFixed(1)} °C) deutlich wärmer als Winter (Ø ${avg(seasonT.winter).toFixed(1)} °C)`);
ok(avg(seasonT.spring) > avg(seasonT.winter) && avg(seasonT.autumn) > avg(seasonT.winter), `Frühling Ø ${avg(seasonT.spring).toFixed(1)} °C, Herbst Ø ${avg(seasonT.autumn).toFixed(1)} °C`);
ok(maxSnow > 0.2, `Schneedecke im Winter (max ${(maxSnow * 100).toFixed(0)} %)`);
ok(avg(seasonWater.summer) > avg(seasonWater.winter) + 0.03, `Wasserverbrauch Sommer ${(avg(seasonWater.summer) * 100).toFixed(1)} % > Winter ${(avg(seasonWater.winter) * 100).toFixed(1)} %`);
ok(avg(seasonPower.winter) < avg(seasonPower.spring), `Strombilanz Winter ${(avg(seasonPower.winter) * 100).toFixed(1)} % < Frühling ${(avg(seasonPower.spring) * 100).toFixed(1)} % (Heizen, wenig Sonne)`);
ok(weekly.some((x) => x.rainH > 3) && weekly.some((x) => x.rainH < 2), 'Regen und trockene Wochen wechseln sich ab');
ok(weekly.some((x) => x.stormH > 0), 'Gewitter kommen vor');
ok(st.history.filter((h) => !h.aftershock).length >= 5, `mindestens 5 Katastrophen abgeschlossen (${st.history.length} inkl. Nachbeben)`);
ok(st.totals.destroyed + st.totals.damaged > 5, `Schäden entstanden (zerstört ${st.totals.destroyed}, beschädigt ${st.totals.damaged})`);
ok(sawRepair, 'beschädigte Gebäude wurden repariert (Baustellen)');
ok(sawRubble, 'Trümmer entstanden');
ok(Object.keys(st.repairs).length < 6, `Reparaturen am Ende weitgehend abgeschlossen (offen: ${Object.keys(st.repairs).length})`);
ok(st.rubble.length < 15, `Trümmer am Ende weitgehend geräumt (übrig ${st.rubble.length})`);
ok(events.some((e) => e.phase === 'start') && events.some((e) => e.phase === 'end'), `emit('disaster') mit start/end (${events.length} Meldungen)`);
ok(g.stats.pop > 500, `Stadt lebt weiter (Einwohner ${g.stats.pop})`);

console.log(`  Wiederaufgebaute Dienstgebäude: ${rebuilt}, offene Ruinen: ${st.ruins.length}`);

// Speichern/Laden während des Hochwassers
if (savedMid) {
  const g2 = Game.fromSave(JSON.parse(savedMid));
  const a = g2.ext.disasters.active.length;
  for (let s = 0; s < 600; s++) g2.update(0.1);
  ok(!!g2.ext.weather.season && g2.ext.disasters.history.length >= 1, `Laden mitten im Hochwasser (aktiv ${a}) und 2 Tage weiter: ${g2.ext.disasters.history.map((h) => h.name).join(', ') || '–'}, Einw ${g2.stats.pop}`);
}
// Laden am Ende: Wetter identisch
{
  g.ext.disasters.freq = 'off';
  const data = JSON.parse(JSON.stringify(g.serialize()));
  const g3 = Game.fromSave(data);
  ok(Math.abs(g3.ext.weather.temp - g.ext.weather.temp) < 0.01 && g3.ext.weather.season === g.ext.weather.season, `Wetterzustand übersteht Speichern/Laden (${g3.ext.weather.temp.toFixed(1)} °C, ${g3.ext.weather.season})`);
  const fc = (x) => x.ext.weather.forecast.map((f) => `${f.kind}:${f.tMax.toFixed(1)}`).join(' ');
  ok(fc(g) === fc(g3), `Vorhersage nach dem Laden identisch (${fc(g3).split(' ').slice(0, 4).join(' ')} …)`);
  for (let s = 0; s < 300; s++) { g.update(0.1); g3.update(0.1); }
  ok(fc(g) === fc(g3), 'Vorhersage auch einen Tag später deterministisch');
}

// Debug-Setter
setWeatherNow(g, 'snow', { snowCover: 0.8 });
ok(g.ext.weather.snow > 0.2 && g.ext.weather.snowCover >= 0.79, `setWeatherNow Schnee (fällt ${(g.ext.weather.snow * 100).toFixed(0)} %, liegt ${(g.ext.weather.snowCover * 100).toFixed(0)} %)`);
setWeatherNow(g, 'thunder');
ok(g.ext.weather.storm && g.ext.weather.rain > 0.3, 'setWeatherNow Gewitter');

// Zweite Stadt: zufällige Katastrophen auf „Häufig"
{
  const C2 = makeCity(777, 'normal', { disasters: 'often' });
  const g2 = C2.g;
  ok(g2.ext.disasters.freq === 'often', 'Einstellung aus den Spieloptionen übernommen (Häufig)');
  for (let d = 1; d <= YEAR_DAYS; d++) {
    for (let s = 0; s < 300; s++) g2.update(0.1);
    if (d === 25) { C2.place('coal', 40, C2.hy + 16); C2.place('watertower', 47, C2.hy + 8); }
  }
  const h2 = g2.ext.disasters.history;
  console.log(`  Zufällige Katastrophen im Jahr: ${h2.map((h) => `${h.name}@${h.day}`).join(', ') || 'keine'}`);
  ok(h2.length >= 2, `Zufallsplanung erzeugt Katastrophen (${h2.length})`);
  ok(g2.stats.pop > 300, `zweite Stadt überlebt (${g2.stats.pop} Einwohner)`);
  // Aus = keine zufälligen Katastrophen
  const C3 = makeCity(778, 'normal', { disasters: 'off' });
  for (let d = 1; d <= 60; d++) for (let s = 0; s < 300; s++) C3.g.update(0.1);
  ok(C3.g.ext.disasters.history.length === 0 && C3.g.ext.disasters.planned.length === 0, 'Katastrophen „Aus" – keine Katastrophen');
}

console.log(`\n${checks - fails}/${checks} Prüfungen bestanden.`);
process.exit(fails ? 1 : 0);
