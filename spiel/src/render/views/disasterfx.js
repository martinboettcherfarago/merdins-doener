// Ansicht „Katastrophen-Effekte". Besitzer: System-Agent Wetter & Katastrophen.
// Wird mit new View(engine) erzeugt; engine.scene, engine.game, engine.camera stehen bereit.
// Optional: frame(dt, simDt, time, night) pro Bild, dispose() beim Beenden.
import { registerView } from '../../registry.js';

registerView(class DisasterView {
  constructor(engine) { this.e = engine; }
  frame() {}
});
