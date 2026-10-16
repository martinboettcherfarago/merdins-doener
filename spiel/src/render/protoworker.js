// Bau-Worker für Gebäude-Prototypen (Besitzer: G9). Baut Nah- und Mittelstufen (Architektur-Bausteine, Ersatzmodelle)
// abseits des Hauptfadens und liefert die fertig zusammengefassten Teile als Felder zurück (ohne Kopie übertragen).
// Der Hauptfaden macht daraus nur noch Geometrie und Instanzsatz (protos.js adopt) – kein Ruckeln mehr, wenn beim
// Heranzoomen viele Gebäude auf einmal fein werden.
//
// Der Worker ist dasselbe Bündel wie das Spiel (dist/stadtpuls.js): main.js erkennt den Worker-Kontext und startet
// statt des Spiels nur diese Schleife. ProtoPool (protos.js) startet die Worker mit der Adresse des eigenen Skripts; ohne
// Adresse (Einzelseite mit eingebettetem Skript) oder ohne Worker-Unterstützung baut die Ansicht wie bisher selbst.
import { buildFallback } from './buildings.js';
import { buildProtoPack, packBuffers } from './protos.js';

export function startProtoWorker() {
  self.onmessage = (e) => {
    const q = e.data;
    if (!q || q.type !== 'build') return;
    const t0 = performance.now();
    let out;
    try { out = buildProtoPack(q.key, q.level, q.v, q.fw, q.fd, q.extra, q.detail, buildFallback); } catch (err) { out = { error: String((err && err.message) || err) }; }
    const ms = performance.now() - t0;
    let transfer = [];
    try { transfer = out && out.pack ? packBuffers(out.pack) : []; } catch (err) { transfer = []; }
    self.postMessage({ type: 'built', id: q.id, out, ms }, transfer);
  };
  self.postMessage({ type: 'ready' });
}
