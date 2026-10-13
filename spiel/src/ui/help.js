// Hilfe „So funktioniert's": kurze, bebilderte Erklärungen der Grundideen (Straßen, Zonen, Versorgung, Glück, Geld,
// U-Bahn …). Besitzer: Agent EINSTIEG. Die Oberfläche ruft auf:
//   openHelp(ui, topicId?)  → öffnet die Hilfe (optional direkt bei einem Thema)
//   helpTopics()            → [{ id, title, icon }] für Menüs
// Eigene Styles bitte per injiziertem <style>, Farben über die CSS-Variablen aus style.css.
export function helpTopics() { return []; }
export function openHelp(ui, topicId) { void ui; void topicId; }
