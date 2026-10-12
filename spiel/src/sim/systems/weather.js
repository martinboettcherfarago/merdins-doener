// System „Wetter & Jahreszeiten". Jahreszeiten, Temperatur, Regen, Schnee, Wind, Nebel – schreibt g.ext.weather.
// Hooks: init(g) · step(g, minuten) · hourly(g, h) · daily(g, tag) · weekly(g) · serialize(g) → Daten · load(g, daten) · renderables(g) → [...]
// Zustand gehört nach g.ext.weather. Keine Imports aus render/ oder ui/ (läuft auch headless im Test).
import { registerSystem } from '../../registry.js';

registerSystem({
  id: 'weather',
  init(g) { g.ext.weather = {}; },
});
