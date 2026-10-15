// Misst, wie gut ein Spielstand mit ÖPNV abgedeckt ist: Anteil der Bewohner und Arbeitsplätze im Einzugsgebiet
// einer bedienten U-Bahn-Station oder einer Bus-/Tram-Haltestelle mit Fahrzeugen.
// Aufruf: node tools/oepnv-abdeckung.mjs [saves/megastadt.json]
import { readFileSync } from 'node:fs';
import { Game } from '../src/sim/game.js';
import { coverageReport } from './oepnv-lib.mjs';

const file = process.argv[2] || 'saves/megastadt.json';
const g = Game.fromSave(readFileSync(file, 'utf8'));
for (let k = 0; k < 600; k++) g.update(0.1);
const r = coverageReport(g);
console.log(`ÖPNV-Abdeckung ${file}: Bewohner ${(r.res * 100).toFixed(1)} % · Arbeitsplätze ${(r.jobs * 100).toFixed(1)} % · Gebäude ohne Anschluss ${r.uncovered}/${r.total}`);
console.log(`nur U-Bahn: Bewohner ${(r.resMetro * 100).toFixed(1)} % · nur Bus/Tram: Bewohner ${(r.resBus * 100).toFixed(1)} %`);
