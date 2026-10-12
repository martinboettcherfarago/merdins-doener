// System „Bezirke". Bezirke mit Namen, Farben und eigenen Verordnungen (Besitzer: Bürger & Dienste).
// Hooks: init(g) · step(g, minuten) · hourly(g, h) · daily(g, tag) · weekly(g) · serialize(g) → Daten · load(g, daten) · renderables(g) → [...]
// Zustand gehört nach g.ext.districts. Keine Imports aus render/ oder ui/ (läuft auch headless im Test).
import { registerSystem } from '../../registry.js';

registerSystem({
  id: 'districts',
  init(g) { g.ext.districts = {}; },
});
