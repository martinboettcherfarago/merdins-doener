// Einstieg: geführte Einführung (Spotlight auf Bedienelemente), Ziele für die ersten Spielminuten,
// Hinweise „Was ist hier los?". Besitzer: Agent EINSTIEG. Die Oberfläche (ui.js) ruft nur diese Schnittstelle auf:
//   const ob = new Onboarding(ui)   // im Konstruktor der Oberfläche, nach mount()
//   ob.update(dt)                   // jedes Bild
//   ob.onEvent(name, data)          // z. B. 'tool' (Werkzeug gewählt), 'panel', 'cat', 'build', 'zone', 'road'
//   ob.active()                     // true, solange die Einführung läuft (Oberfläche blendet dann Störendes aus)
//   ob.dispose()
// Ziel-Elemente für das Spotlight tragen data-tour="…" (siehe Liste in swarm/U-BAHN-UND-UI.md).
// Eigene Styles bitte per injiziertem <style> aus dieser Datei, Farben über die CSS-Variablen aus style.css.
export class Onboarding {
  constructor(ui) { this.ui = ui; }
  update(dt) { void dt; }
  onEvent(name, data) { void name; void data; }
  active() { return false; }
  dispose() {}
}
