// Ansicht „Wetter (Wolken, Regen, Schnee, Nebel, Blitze)". Besitzer: Agent Licht & Atmosphäre.
// Wird mit new View(engine) erzeugt; engine.scene, engine.game, engine.camera stehen bereit.
// Optional: frame(dt, simDt, time, night) pro Bild, dispose() beim Beenden.
import { registerView } from '../../registry.js';

registerView(class WeatherView {
  constructor(engine) { this.e = engine; }
  frame() {}
});
