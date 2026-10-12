// Ansicht „Bezirksgrenzen und -namen". Besitzer: System-Agent Bürger & Dienste.
// Wird mit new View(engine) erzeugt; engine.scene, engine.game, engine.camera stehen bereit.
// Optional: frame(dt, simDt, time, night) pro Bild, dispose() beim Beenden.
import { registerView } from '../../registry.js';

registerView(class DistrictView {
  constructor(engine) { this.e = engine; }
  frame() {}
});
