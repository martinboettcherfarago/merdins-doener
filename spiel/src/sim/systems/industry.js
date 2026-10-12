// System „Wirtschaft & Industrie". Produktionsketten, Spezialindustrie, Lager, Export, Dienstbudgets.
// Hooks: init(g) · step(g, minuten) · hourly(g, h) · daily(g, tag) · weekly(g) · serialize(g) → Daten · load(g, daten) · renderables(g) → [...]
// Zustand gehört nach g.ext.industry. Keine Imports aus render/ oder ui/ (läuft auch headless im Test).
import { registerSystem } from '../../registry.js';

registerSystem({
  id: 'industry',
  init(g) { g.ext.industry = {}; },
});
