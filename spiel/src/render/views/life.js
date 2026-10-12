// Ansicht „Leben in der Stadt (Fußgänger, Radfahrer, Vögel, Boote, Flugzeuge)". Besitzer: Agent Fahrzeuge & Leben.
// Wird mit new View(engine) erzeugt; engine.scene, engine.game, engine.camera stehen bereit.
// Optional: frame(dt, simDt, time, night) pro Bild, dispose() beim Beenden.
import { registerView } from '../../registry.js';

registerView(class LifeView {
  constructor(engine) { this.e = engine; }
  frame() {}
});
