// Architektur: Büro (Besitzer: G4). Schlüssel: 'off'.
// Fassadensystem und Archetypen liegen in indoff_off.js; Stufen 1–5, Grundflächen 1×1, 2×1, 1×2, 2×2, je 6 Varianten.
import { registerArch } from './index.js';
import { buildOff } from './indoff_off.js';

registerArch('off', { variants: 6, build: buildOff });
