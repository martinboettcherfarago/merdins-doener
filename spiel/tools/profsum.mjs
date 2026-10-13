// Fasst ein V8-Profil (node --cpu-prof) zusammen: Eigenzeit und Gesamtzeit pro Funktion, nach Datei gruppiert.
//   node --cpu-prof --cpu-prof-dir=/tmp/prof test/progression-test.mjs
//   node tools/profsum.mjs /tmp/prof/<datei>.cpuprofile [--top 25]
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const ti = process.argv.indexOf('--top');
const top = ti > 0 ? +process.argv[ti + 1] : 25;
if (!file) { console.log('Aufruf: node tools/profsum.mjs <datei.cpuprofile> [--top 25]'); process.exit(1); }
const p = JSON.parse(readFileSync(file, 'utf8'));
const byId = new Map(p.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of p.nodes) for (const c of n.children || []) parent.set(c, n.id);
const count = new Map();
for (const id of p.samples) count.set(id, (count.get(id) || 0) + 1);
const total = p.samples.length;
const name = (cf) => `${cf.functionName || '(anonym)'} ${cf.url.replace(/^.*\/(src|test|tools)\//, '$1/')}:${cf.lineNumber + 1}`;
const self = new Map(), incl = new Map(), files = new Map();
for (const [id, c] of count) {
  const cf = byId.get(id).callFrame;
  self.set(name(cf), (self.get(name(cf)) || 0) + c);
  const f = cf.url ? cf.url.replace(/^.*\/(src|test|tools)\//, '$1/') : cf.functionName || '(intern)';
  files.set(f, (files.get(f) || 0) + c);
  const seen = new Set();
  for (let q = id; q !== undefined; q = parent.get(q)) {
    const k = name(byId.get(q).callFrame);
    if (seen.has(k)) continue;
    seen.add(k);
    incl.set(k, (incl.get(k) || 0) + c);
  }
}
const pct = (c) => `${(100 * c / total).toFixed(1).padStart(5)} %`;
const durS = (p.endTime - p.startTime) / 1e6;
console.log(`Profil: ${total} Proben, ${durS.toFixed(1)} s`);
console.log('Eigenzeit nach Datei:');
for (const [k, c] of [...files.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${pct(c)}  ${k}`);
console.log('Eigenzeit nach Funktion:');
for (const [k, c] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, top)) console.log(`  ${pct(c)}  ${k}`);
console.log('Gesamtzeit (mit Aufrufen), nur src/:');
for (const [k, c] of [...incl.entries()].filter(([k]) => / src\//.test(k)).sort((a, b) => b[1] - a[1]).slice(0, top)) console.log(`  ${pct(c)}  ${k}`);
