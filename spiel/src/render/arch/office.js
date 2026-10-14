// Architektur: Büro (Besitzer: G4). Schlüssel: 'off'.
// Fassadensystem und Archetypen liegen in indoff_off.js, weitere Büros und Wolkenkratzer in indoff_off2.js.
// Stufen 1–5, Grundflächen 1×1, 2×1, 1×2, 2×2. Die Ansicht wählt das Modell nach Lage (mix.js).
import { registerArch } from './index.js';
import { buildOff, OFF } from './indoff_off.js';
import { OFF_NEW } from './indoff_off2.js';

for (const l of [1, 2, 3, 4, 5]) OFF[l].push(...OFF_NEW[l]);
const lv = (l) => Math.max(1, Math.min(5, l | 0));
registerArch('off', { mix: true, count: (level) => OFF[lv(level)].length, build: buildOff });
