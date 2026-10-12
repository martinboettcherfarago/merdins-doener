// System „Verkehr & ÖPNV". Buslinien, Straßenbahn, Fernbahn, Flughafen, Fähren, Taxis, Parkhäuser, Ampeln.
// Hooks: init(g) · step(g, minuten) · hourly(g, h) · daily(g, tag) · weekly(g) · serialize(g) → Daten · load(g, daten) · renderables(g) → [...]
// Zustand gehört nach g.ext.transport. Keine Imports aus render/ oder ui/ (läuft auch headless im Test).
import { registerSystem } from '../../registry.js';

registerSystem({
  id: 'transport',
  init(g) { g.ext.transport = {}; },
});
