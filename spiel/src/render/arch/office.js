// Architektur: Büro (Besitzer: G4). Schlüssel: 'off'.
// Fassadensystem und Archetypen liegen in indoff_off.js, weitere Büros und Wolkenkratzer in indoff_off2.js.
// Stufen 1–5, Grundflächen 1×1, 2×1, 1×2, 2×2. Die Ansicht wählt das Modell nach Lage (mix.js).
import { registerArch } from './index.js';
import { buildOff, OFF } from './indoff_off.js';
import { OFF_NEW } from './indoff_off2.js';
import { tag } from './mix.js';

for (const l of [1, 2, 3, 4, 5]) OFF[l].push(...OFF_NEW[l]);
// Epoche (0 historisch … 3 zeitgenössisch) und Bauweise ('D' offen, 'A' geschlossen, 'S' Solitär, 'P' Turm mit Sockel/Staffel)
const OFF_TAGS = {
  1: [[2, 'D'], [3, 'D'], [0, 'D'], [3, 'D'], [2, 'D'], [0.7, 'D'], [0.3, 'D'], [3, 'D'], [3, 'D'], [3, 'D'], [0, 'D']],
  2: [[2, 'D'], [3, 'D'], [0.6, 'A'], [2, 'D'], [1.2, 'D'], [3, 'D'], [1, 'D'], [3, 'D'], [2.6, 'S']],
  3: [[3, 'D'], [2, 'D'], [0.6, 'A'], [2, 'S'], [3, 'D'], [3, 'D'], [3, 'S'], [3, 'S'], [2, 'D'], [3, 'S']],
  4: [[1.2, 'P'], [2, 'S'], [3, 'S'], [2, 'S'], [3, 'S'], [3, 'S'], [0.6, 'S'], [3, 'S'], [3, 'S'], [2.2, 'P']],
  5: [[0.8, 'S'], [3, 'S'], [3, 'S'], [3, 'S'], [3, 'S'], [3, 'S'], [3, 'S'], [1.5, 'S'], [3, 'S'], [3, 'S'], [3, 'S'], [3, 'S'], [2, 'P']],
};
for (const l of [1, 2, 3, 4, 5]) OFF[l].forEach((fn, i) => { const t = OFF_TAGS[l][i] || [2, 'S']; tag(fn, t[0], t[1]); });
const lv = (l) => Math.max(1, Math.min(5, l | 0));
registerArch('off', { mix: true, count: (level) => OFF[lv(level)].length, list: (level) => OFF[lv(level)], build: buildOff });
