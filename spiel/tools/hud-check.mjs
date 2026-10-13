// HUD-Prüfung (PREMIUM, Runde 3c): misst die sichtbaren Bedienelemente bei mehreren Fenstergrößen und Zuständen und meldet
// Überschneidungen, zu enge Abstände, Teile außerhalb des Bildschirms, sich berührende Innenteile und abgeschnittene Texte.
// Aufruf aus spiel/ (als Prüfskript für tools/shot.mjs):
//   node tools/shot.mjs --scenario city --eval tools/hud-check.mjs --out /tmp/x.png
// Umgebungsvariablen (alle optional):
//   HUDVIEWS=1920x1080,1440x900,…   Fenstergrößen (Standard: 1920×1080, 1440×900, 1280×720, 1180×820, 820×1180, 400×820)
//   HUDSTATES=base,catalog,…         Zustände (Standard: alle, siehe STATES)
//   HUDSHOTS=<ordner>                legt je Größe und Zustand ein Bildschirmfoto ab
//   HUDSTRICT=1                      Funde lassen das Werkzeug mit Code 1 enden
const VIEWS = (process.env.HUDVIEWS || '1920x1080,1440x900,1280x720,1180x820,820x1180,400x820').split(',').map((s) => s.split('x').map(Number));
const STATES = (process.env.HUDSTATES || 'base,catalog,panel,guide,minimap,onboarding,placebar,check,menu,toast').split(',');
const SHOTS = process.env.HUDSHOTS || '';
const SHOTVIEWS = (process.env.HUDSHOTVIEWS || '').split(',').filter(Boolean); // nur diese Größen fotografieren (leer: alle)

// Eigenständige Bedienelemente (Name, Selektor). Jede Fundstelle eines Selektors zählt als eigene Einheit.
const UNITS = [
  ['Rang', '#hud .topbar .cityplate'], ['Nachfrage', '#hud .topbar .demand'],
  ['Kasse', '#hud .topbar [data-stat=money]'], ['Einwohner', '#hud .topbar [data-stat=pop]'], ['Glück', '#hud .topbar [data-stat=happy]'],
  ['Stadt-Check', '#u-check'], ['Meldungen', '#hud .topbar [data-sys=notes]'], ['Hilfe', '#hud .topbar [data-sys=help]'],
  ['Zeit-Karte', '#u-timecard'], ['Wetter', '#u-weather'], ['Dock', '#u-dock'], ['Katalog', '#u-tray'], ['Panel', '#u-panel'], ['Inspektor', '#u-insp'],
  ['Legende', '#u-legend'], ['Werkzeughinweis', '#u-toolhint'], ['Ziel', '#u-objectives > *'], ['Erste Schritte', '#u-tutorial'],
  ['Begleiter', '#ob-guide'], ['Minikarte', '#u-mini'], ['Minikarten-Knopf', '#u-mmopen'], ['Aufklappmenü', '#u-popover'],
  ['Meldung', '#toasts > *'], ['Einführung', '#ob-layer .ob-card'], ['Bestätigungsleiste', '.placebar'],
];
// Zusammengesetzte Elemente: deren direkte Teile dürfen sich weder überschneiden noch berühren
const INNER = [
  ['Rang', '#hud .cityplate', ':scope > *'], ['Kasse', '#hud [data-stat=money]', ':scope > *'], ['Einwohner', '#hud [data-stat=pop]', ':scope > *'],
  ['Glück', '#hud [data-stat=happy]', ':scope > *'], ['Stadt-Check', '#u-check', ':scope > *'], ['Nachfrage', '#hud .demand .bars', ':scope > *'],
  ['Zeit-Karte', '#u-timecard', ':scope > *, :scope .when > *'], ['Tempo', '#u-timecard', ':scope .spd'],
  ['Dock', '#u-dock', ':scope .stop'], ['Dock-Beschriftung', '#u-dock', ':scope .lbl'], ['Katalog-Reiter', '#u-tray .tr-tabs', ':scope > *'],
  ['Katalog-Kopf', '#u-tray .tr-head', ':scope > *'], ['Panel-Kopf', '#u-panel > .ph, #u-panel > .p-head, #u-panel > header', ':scope > *'],
  ['Leiste', '.placebar .pb-row', ':scope > *'], ['Begleiter-Kopf', '#ob-guide .gh', ':scope > *'], ['Begleiter-Knöpfe', '#ob-guide .ga', ':scope > *'],
  ['Einführung-Knöpfe', '#ob-layer .ob-acts', ':scope > *'],
];
const MIN_GAP = 6; // px zwischen eigenständigen Elementen
const MIN_INNER = 2; // px zwischen Teilen eines Elements

function measure({ UNITS, INNER, MIN_GAP, MIN_INNER }) {
  const W = innerWidth, H = innerHeight;
  const vis = (el) => {
    if (!el || !el.isConnected) return false;
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const R = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
  const issues = [];
  const units = [];
  for (const [name, sel] of UNITS) {
    const list = [...document.querySelectorAll(sel)].filter(vis);
    list.forEach((el, i) => units.push({ name: list.length > 1 ? `${name} ${i + 1}` : name, el, r: R(el) }));
  }
  // Modale Lage (Handy-Blatt mit Abdunklung): das Menü darf alles darunter überdecken
  const scrim = document.getElementById('u-scrim');
  const modal = scrim && vis(scrim);
  const f = (v) => Math.round(v);
  for (const u of units) {
    const { l, t, r, b } = u.r;
    if (l < -1 || t < -1 || r > W + 1 || b > H + 1) issues.push(`außerhalb: ${u.name} [${f(l)},${f(t)} – ${f(r)},${f(b)}] Fenster ${W}×${H}`);
  }
  const gapOf = (a, b) => {
    const ix = Math.min(a.r, b.r) - Math.max(a.l, b.l), iy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
    if (ix > 0.5 && iy > 0.5) return { over: true, ix, iy };
    const dx = Math.max(0, b.l - a.r, a.l - b.r), dy = Math.max(0, b.t - a.b, a.t - b.b);
    return { over: false, gap: dx > 0 && dy > 0 ? Math.hypot(dx, dy) : Math.max(dx, dy) };
  };
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const a = units[i], b = units[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      if (modal && (a.name === 'Aufklappmenü' || b.name === 'Aufklappmenü')) continue;
      const g = gapOf(a.r, b.r);
      if (g.over) issues.push(`Überschneidung: ${a.name} × ${b.name} (${f(g.ix)}×${f(g.iy)} px)`);
      else if (g.gap < MIN_GAP) issues.push(`zu eng: ${a.name} – ${b.name} (${g.gap.toFixed(1)} px)`);
    }
  }
  for (const [name, sel, kids] of INNER) {
    for (const host of document.querySelectorAll(sel)) {
      if (!vis(host)) continue;
      const parts = [...host.querySelectorAll(kids)].filter((k) => vis(k) && getComputedStyle(k).position !== 'absolute');
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
          if (parts[i].contains(parts[j]) || parts[j].contains(parts[i])) continue;
          const g = gapOf(R(parts[i]), R(parts[j]));
          const nm = (k) => (k.className && typeof k.className === 'string' ? k.className.split(' ')[0] : k.tagName.toLowerCase());
          if (g.over) issues.push(`innen überschnitten: ${name} – ${nm(parts[i])} × ${nm(parts[j])} (${f(g.ix)}×${f(g.iy)} px)`);
          else if (g.gap < MIN_INNER) issues.push(`innen berührt: ${name} – ${nm(parts[i])} / ${nm(parts[j])} (${g.gap.toFixed(1)} px)`);
        }
      }
      // Teile ragen aus ihrem Element heraus (abgesehen von bewusst schwebenden Abzeichen)
      const hr = R(host);
      for (const k of parts) {
        const r = R(k);
        if (r.l < hr.l - 1 || r.r > hr.r + 1 || r.t < hr.t - 1 || r.b > hr.b + 1) issues.push(`ragt heraus: ${name} – ${k.className || k.tagName}`);
      }
    }
  }
  // Abgeschnittene Texte (Auslassungspunkte oder versteckter Überlauf in einzeiligen Beschriftungen)
  const roots = [document.getElementById('hud'), document.querySelector('#ob-layer'), document.getElementById('ob-guide'), document.querySelector('.placebar')].filter(Boolean);
  const seen = new Set();
  for (const root of roots) {
    for (const el of root.querySelectorAll('*')) {
      if (seen.has(el)) continue;
      seen.add(el);
      if (!el.firstChild || el.children.length > 2) continue;
      const cs = getComputedStyle(el);
      if (cs.whiteSpace !== 'nowrap' && cs.textOverflow !== 'ellipsis') continue;
      if (cs.overflowX === 'visible') continue;
      if (!vis(el)) continue;
      if (el.closest('#u-panel .body, #u-tray .tr-list, .pop .pop-b, #u-popover, #u-insp .body')) continue; // Listen in Panels: dort ist Auslassung gewollt, eigener Test
      if (el.scrollWidth > el.clientWidth + 1) issues.push(`abgeschnitten: „${(el.textContent || '').trim().slice(0, 40)}" (${el.className || el.tagName}, ${el.scrollWidth}>${el.clientWidth})`);
    }
  }
  return { issues, units: units.map((u) => u.name) };
}

export default async (page, h) => {
  const all = [];
  const setState = (st) => page.evaluate(async (st) => {
    const app = window.__stadtpuls, ui = app.ui, input = app.input, ob = ui.onboarding;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    // Grundzustand
    try { if (ob && ob.running) ob.stop(false); } catch (e) { /* egal */ }
    try { input.setTool({ kind: 'select' }); } catch (e) { /* egal */ }
    try { input.bar && input.bar.hide(); input.pend = null; } catch (e) { /* egal */ }
    app.settings.confirmPlace = 'auto';
    ui.closeTray(); ui.closePanels(); ui.closePop(); ui.closeInspector && ui.closeInspector(); ui.toggleMinimap(false, true);
    if (ui.view && ui.view !== 'none') ui.setView('none');
    const t = document.getElementById('toasts'); if (t) t.innerHTML = '';
    for (const id of ['uitip', 'tooltip']) { const tip = document.getElementById(id); if (tip) tip.hidden = true; }
    if (ui.advisor && ui.advisor.external) ui.advisor.external.delete('qa-hud');
    await sleep(120);
    if (st === 'catalog') ui.openTray('zones');
    else if (st === 'panel') ui.openPanel('budget');
    else if (st === 'check') ui.openPop('check');
    else if (st === 'menu') ui.openPop('menu', document.getElementById('u-menubtn'));
    else if (st === 'onboarding') { if (ob) ob.start(); }
    else if (st === 'minimap') { ui.toggleMinimap(true, true); if (ob) ob.renderGuide(true); }
    else if (st === 'toast') { ui.toast('Neues Gebäude freigeschaltet: Stadtpark', 'good'); ui.toast('Zu wenig Strom im Norden der Stadt', 'bad'); }
    else if (st === 'guide') {
      if (ui.advisor) {
        ui.advisor.external.set('qa-hud', { id: 'qa-hud', text: 'Deine Stadt braucht Wasser: Baue einen Wasserturm.', why: 'Ohne Wasser wachsen die Häuser nicht weiter.', prio: 3, rank: 999, label: 'Wasserturm bauen', act: 'tool:watertower', help: 'water', until: ui.g.time + 99999 });
        ui.advisor.compute();
      }
      if (ob) ob.renderGuide(true);
    } else if (st === 'placebar') {
      app.settings.confirmPlace = 'always';
      input.setTool({ kind: 'place', key: 'park' });
    }
    await sleep(400);
    return true;
  }, st);

  for (const [w, hh] of VIEWS) {
    await page.setViewportSize({ width: w, height: hh });
    await h.wait(900);
    for (const st of STATES) {
      await setState(st);
      // Einführung und Begleiter zeichnen sich erst im nächsten Takt (bei wenigen Bildern pro Sekunde etwas später)
      if (st === 'onboarding' || st === 'guide' || st === 'minimap') await h.wait(1500);
      if (st === 'placebar') {
        // echter Klick auf die Karte: mit „immer bestätigen" entsteht eine Vorschau samt Leiste
        await page.mouse.move(w * 0.52, hh * 0.5);
        await h.wait(150);
        await page.mouse.click(w * 0.52, hh * 0.5);
        await h.wait(700);
      }
      const res = await page.evaluate(measure, { UNITS, INNER, MIN_GAP, MIN_INNER });
      const tag = `${w}×${hh} ${st}`;
      if (st === 'placebar' && !res.units.includes('Bestätigungsleiste')) res.issues.push('Hinweis: Bestätigungsleiste erschien nicht');
      if (st === 'onboarding' && !res.units.includes('Einführung')) res.issues.push('Hinweis: Einführungskarte erschien nicht');
      if (st === 'guide' && !res.units.includes('Begleiter')) res.issues.push('Hinweis: Begleiter erschien nicht');
      for (const i of res.issues) all.push(`${tag}: ${i}`);
      console.log(`[hud] ${tag}: ${res.issues.length ? res.issues.length + ' Fund(e)' : 'ok'}  (${res.units.length} Elemente)`);
      for (const i of res.issues) console.log(`        - ${i}`);
      if (SHOTS && (!SHOTVIEWS.length || SHOTVIEWS.includes(`${w}x${hh}`))) await page.screenshot({ path: `${SHOTS}/${w}x${hh}-${st}.png`, timeout: 120000 });
    }
  }
  await page.evaluate(() => { const app = window.__stadtpuls; try { app.ui.onboarding && app.ui.onboarding.running && app.ui.onboarding.stop(false); } catch (e) { /* egal */ } app.settings.confirmPlace = 'auto'; app.input.setTool({ kind: 'select' }); });
  await page.setViewportSize({ width: VIEWS[0][0], height: VIEWS[0][1] });
  console.log(`[hud] GESAMT: ${all.length} Fund(e)`);
  if (all.length && process.env.HUDSTRICT) process.exitCode = 1;
};
