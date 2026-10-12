// System „Fortschritt & Inhalte". Erfolge, Szenarien, Spielmodi (u. a. Metro-Modus), Ratgeber.
// Hooks: init(g) · step(g, minuten) · hourly(g, h) · daily(g, tag) · weekly(g) · serialize(g) → Daten · load(g, daten) · renderables(g) → [...]
// Zustand gehört nach g.ext.progression. Keine Imports aus render/ oder ui/ (läuft auch headless im Test).
import { registerSystem } from '../../registry.js';

registerSystem({
  id: 'progression',
  init(g) { g.ext.progression = {}; },
});
