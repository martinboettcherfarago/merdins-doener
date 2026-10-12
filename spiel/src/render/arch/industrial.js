// Architektur: Industrie (Besitzer: G4). Schlüssel: 'ind' sowie die Spezialisierungen 'farm', 'mine', 'forest', 'oil'.
// Die Archetypen liegen in indoff_*.js; hier werden sie beim Register angemeldet.
// Stufen 1–5, Grundflächen 1×1, 2×1, 1×2, 2×2, je 6 Varianten (Variante = Archetyp der Stufe).
import { registerArch } from './index.js';
import { buildInd } from './indoff_ind.js';

registerArch('ind', { variants: 6, build: buildInd });
