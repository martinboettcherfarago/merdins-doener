// Architektur: Industrie (Besitzer: G4). Schlüssel: 'ind' sowie die Spezialisierungen 'farm', 'mine', 'forest', 'oil'.
// Die Archetypen liegen in indoff_*.js; hier werden sie beim Register angemeldet.
// Stufen 1–5, Grundflächen 1×1, 2×1, 1×2, 2×2, je 6 Varianten (Variante = Archetyp der Stufe).
import { registerArch } from './index.js';
import { buildInd } from './indoff_ind.js';
import { buildFarm } from './indoff_farm.js';
import { buildOil } from './indoff_oil.js';
import { buildMine } from './indoff_mine.js';
import { buildForest } from './indoff_forest.js';

// mix: Die Ansicht wählt den Archetyp nach Lage (mix.js), damit Nachbarn verschieden aussehen
const six = () => 6;
registerArch('ind', { mix: true, count: six, build: buildInd });
registerArch('farm', { mix: true, count: six, build: buildFarm });
registerArch('oil', { mix: true, count: six, build: buildOil });
registerArch('mine', { mix: true, count: six, build: buildMine });
registerArch('forest', { mix: true, count: six, build: buildForest });
