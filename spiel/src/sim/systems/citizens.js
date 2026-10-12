// System „Bürger & Dienste". Altersgruppen, Bildungsstufen, Gesundheit, Bestattung, Abwasser, Fernwärme.
// Hooks: init(g) · step(g, minuten) · hourly(g, h) · daily(g, tag) · weekly(g) · serialize(g) → Daten · load(g, daten) · renderables(g) → [...]
// Zustand gehört nach g.ext.citizens. Keine Imports aus render/ oder ui/ (läuft auch headless im Test).
import { registerSystem } from '../../registry.js';

registerSystem({
  id: 'citizens',
  init(g) { g.ext.citizens = {}; },
});
