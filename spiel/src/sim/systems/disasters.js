// System „Katastrophen". Hochwasser, Sturm, Tornado, Erdbeben, Blitz, Waldbrand, Meteorit; Katastrophenschutz.
// Hooks: init(g) · step(g, minuten) · hourly(g, h) · daily(g, tag) · weekly(g) · serialize(g) → Daten · load(g, daten) · renderables(g) → [...]
// Zustand gehört nach g.ext.disasters. Keine Imports aus render/ oder ui/ (läuft auch headless im Test).
import { registerSystem } from '../../registry.js';

registerSystem({
  id: 'disasters',
  init(g) { g.ext.disasters = {}; },
});
