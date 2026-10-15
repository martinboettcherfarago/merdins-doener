// Bildschirmfotos der wichtigsten Oberflächen-Zustände (PREMIUM, Runde 3c) für Vorher/Nachher-Vergleiche.
// Aufruf aus spiel/: UISHOTS=<ordner> node tools/shot.mjs --scenario city --eval tools/ui-gallery.mjs --out <ordner>/ende.png
// Zustände: Hilfe, Einstellungen (Panel), Tastenkürzel, Stadt-Menü, Ansichten-Menü, Stadt-Check, Inspektor, Meldungen.
const OUT = process.env.UISHOTS || '/tmp';
export default async (page, h) => {
  const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png`, timeout: 120000 });
  const run = (fn) => page.evaluate(fn);
  const reset = () => run(() => { const ui = window.__stadtpuls.ui; ui.closePop(); ui.closePanels(); ui.closeTray(); const m = document.getElementById('modal-root'); if (m) m.innerHTML = ''; ui.modalQueue = []; });
  await page.setViewportSize({ width: 1440, height: 900 });
  await h.wait(800);
  const states = [
    ['help', () => window.__stadtpuls.ui.openHelp()],
    ['settings', () => window.__stadtpuls.ui.openPanel('settings')],
    ['keys', () => window.__stadtpuls.ui.showKeys()],
    ['pop-city', () => window.__stadtpuls.ui.openPop('city', document.getElementById('u-citybtn'))],
    ['pop-views', () => window.__stadtpuls.ui.openPop('views', document.getElementById('u-viewsbtn'))],
    ['pop-check', () => window.__stadtpuls.ui.openPop('check', document.getElementById('u-check'))],
    ['notes', () => window.__stadtpuls.ui.openPanel('notes')],
  ];
  for (const [n, fn] of states) {
    await reset();
    await h.wait(200);
    try { await run(fn); } catch (e) { console.log('[gal] Fehler', n, e.message); }
    await h.wait(900);
    await shot(n);
    console.log('[gal]', n);
  }
  // Inspektor: ein Gebäude auswählen
  await reset();
  const ok = await run(() => { const ui = window.__stadtpuls.ui, g = ui.g; for (const b of g.buildings.values()) { if (b && b.x !== undefined) { try { ui.inspect({ type: 'building', id: b.id }); return true; } catch (e) { return e.message; } } } return false; });
  await h.wait(900);
  await shot('inspector');
  console.log('[gal] inspector', ok);
  await reset();
};
