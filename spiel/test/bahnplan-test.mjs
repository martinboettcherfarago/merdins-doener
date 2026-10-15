// Prüfstand „U-Bahn planen" (BAHNPLAN): Linie zeichnen mit Einrasten, Fehltipp rückgängig, Linie bearbeiten
// (verlängern/kürzen per Griff), Station entfernen, Ring schließen/öffnen – mit echtem Touch (Playwright hasTouch,
// CDP-Touch-Ereignisse) auf Tablet-Größe und Gegenprobe mit der Maus.
// Aufruf aus spiel/: node test/bahnplan-test.mjs [--shots <ordner>] [--only touch|maus]   (vorher node build.mjs)
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, rmSync, statSync, readdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const shotDir = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : null;
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
if (shotDir) mkdirSync(shotDir, { recursive: true });

// Browser-Sperre wie tools/shot.mjs (höchstens zwei gleichzeitig)
function acquire() {
  const start = Date.now();
  for (;;) {
    for (let k = 0; k < 2; k++) {
      const dir = `/tmp/stadtpuls-chrome-slot-${k}`;
      try { mkdirSync(dir); return dir; } catch (e) {
        try { if (Date.now() - statSync(dir).mtimeMs > 6 * 60 * 1000) rmSync(dir, { recursive: true, force: true }); } catch (e2) { /* egal */ }
      }
    }
    if (Date.now() - start > 15 * 60 * 1000) throw new Error('Kein freier Browser-Platz nach 15 Minuten');
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);
  }
}
function chromePath() {
  if (process.env.CHROME) return process.env.CHROME;
  try { for (const d of readdirSync('/opt/pw-browsers')) { const p = join('/opt/pw-browsers', d, 'chrome-linux', 'chrome'); if (/^chromium-\d+$/.test(d) && existsSync(p)) return p; } } catch (e) { /* egal */ }
  return '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
}
const slot = acquire();
const release = () => { try { rmSync(slot, { recursive: true, force: true }); } catch (e) { /* egal */ } };
process.on('exit', release);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { release(); process.exit(130); });
const killer = setTimeout(() => { console.log('ABBRUCH: Zeitlimit'); release(); process.exit(2); }, 25 * 60 * 1000);
killer.unref();

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = createServer((req, res) => {
  let p = join(root, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

let fails = 0, passes = 0;
const check = (name, cond, info = '') => {
  if (cond) { passes++; console.log(`  ok   ${name}`); } else { fails++; console.log(`  FEHL ${name}${info ? ' – ' + info : ''}`); }
};

const browser = await chromium.launch({ executablePath: chromePath(), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];

async function startGame(ctxOpts) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|net::ERR_FAILED/.test(m.text() + ((m.location() || {}).url || ''))) errors.push('console: ' + m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript(() => { try { localStorage.setItem('stadtpuls.settings', JSON.stringify({ tutorialDone: true, advisor: false, quality: 'low', postfx: false, bloom: false, shadows: 'off' })); } catch (e) { /* egal */ } });
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForSelector('[data-act=start]', { timeout: 90000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const mr = document.getElementById('modal-root'); if (mr) mr.innerHTML = '';
    const b = document.querySelector('[data-act=diff][data-v=sandbox]'); if (b) b.click();
    document.querySelector('[data-act=start]').click();
  });
  await page.waitForFunction(() => window.__stadtpuls && window.__stadtpuls.game && window.__stadtpuls.engine && window.__stadtpuls.input, null, { timeout: 120000 });
  await page.waitForTimeout(800);
  // Freie Fläche (16×12) suchen, zwei Stationen setzen, Kamera fest darauf richten; Hilfsfunktionen
  const base = await page.evaluate(() => {
    const app = window.__stadtpuls, g = app.game, W = g.W, H = g.H;
    document.getElementById('modal-root').innerHTML = ''; app.ui.modalQueue = [];
    if (app.ui.onboarding && app.ui.onboarding.stop) { try { app.ui.onboarding.stop(); } catch (e) { /* egal */ } }
    const free = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !g.transit.canPlaceStation(x, y) && !g.road[y * W + x];
    let bx = -1, by = -1;
    const cx = W >> 1, cy = H >> 1;
    outer: for (let r = 0; r < W / 2; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x0 = cx + dx, y0 = cy + dy;
      let ok = true;
      for (let y = y0; y < y0 + 12 && ok; y++) for (let x = x0; x < x0 + 16 && ok; x++) if (!free(x, y)) ok = false;
      if (ok) { bx = x0; by = y0; break outer; }
    }
    const A = g.placeBuilding('station', bx + 2, by + 3).station, B = g.placeBuilding('station', bx + 7, by + 3).station;
    const rig = app.engine.rig;
    rig.flight = null;
    rig.focus(bx + 8 - W / 2, by + 6 - H / 2, 26);
    rig.goal.pitch = 1.1; rig.goal.yaw = 0;
    rig.cur = { ...rig.cur, ...rig.goal }; rig.update(0); app.engine.camera.updateMatrixWorld(true);
    app.engine.quality = { ...app.engine.quality, pr: 0.5 }; app.engine.resize();
    g.speed = 0;
    // Mit Preisen spielen (Sandkasten kostet sonst nichts), Geld genug
    g.sandbox = false; g.costMul = 1; g.money = 1e7;
    app.input.holdMs = 1e7;
    const V = app.engine.camera.position.constructor;
    window.__ev = [];
    for (const t of ['pointerdown', 'pointerup', 'pointercancel']) app.engine.canvas.addEventListener(t, (e) => window.__ev.push(`${t}:${e.pointerType}:${e.pointerId}:${Math.round(e.clientX)},${Math.round(e.clientY)}`), true);
    window.__T = {
      scr(x, y) {
        const cam = app.engine.camera, rc = app.engine.canvas.getBoundingClientRect();
        // auf der Zeichenebene des Linienentwurfs (Untergrund-Ansicht: Tunnelebene)
        const depth = app.input.ld ? app.input.ld.depth() : 0;
        const v = new V(x + 0.5 - W / 2, depth, y + 0.5 - H / 2).project(cam);
        return { x: rc.left + ((v.x + 1) / 2) * rc.width, y: rc.top + ((1 - v.y) / 2) * rc.height };
      },
      st() {
        const inp = app.input, ld = inp.ld, T = g.transit;
        return {
          tool: inp.tool.kind, bar: inp.bar.visible, ok: inp.bar.rect('ok'), cancel: inp.bar.rect('cancel'), undo: inp.bar.rect('undo'), ring: inp.bar.rect('ring'),
          sub: inp.bar.q.s.textContent, title: inp.bar.q.t.textContent, price: inp.bar.q.p.textContent,
          stops: ld ? ld.stops.map((r) => (typeof r === 'number' ? r : `n${r.x},${r.y}`)) : [], loop: ld ? ld.loop : null,
          handles: ld ? ld.handles().map((h) => ({ x: h.x, y: h.y, kind: h.kind })) : [], pop: ld && ld.pop ? ld.pop.k : null,
          popRm: inp.bar.popRect('rm'), popRing: inp.bar.popRect('ring'), popOpen: inp.bar.popRect('open'),
          stations: T.stations.size, lines: T.lines.map((l) => ({ id: l.id, stops: [...l.stops], loop: l.loop })),
          goal: { x: rig.goal.x, z: rig.goal.z }, money: g.money,
        };
      },
      station(x, y) { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const id = g.stationAt[(y + dy) * W + x + dx]; if (id) return id; } return 0; },
      dbg() { const inp = app.input; return { gest: inp.gest ? { mode: inp.gest.mode, id: inp.gest.id, kind: inp.gest.kind } : null, pinching: rig.pinching, ids: [...inp.touchIds], rt: rig.touches ? rig.touches.size : -1, pend: inp.pend, type: inp.lastType, ev: (window.__ev || []).slice(-12) }; },
      onCanvas(x, y) { const el = document.elementFromPoint(x, y); return el === app.engine.canvas ? true : el ? (el.className || el.tagName) + '' : 'nichts'; },
      trains(id) { return g.transit.trains.filter((t) => t.line === id).map((t) => ({ x: t.x, z: t.z, cur: t.cur, st: t.state })); },
    };
    return { bx, by, A: A.id, B: B.id, ax: bx + 2, ay: by + 3, bxx: bx + 7 };
  });
  await page.waitForTimeout(1000);
  return { ctx, page, base };
}

const st = (page) => page.evaluate(() => window.__T.st());
const scr = (page, x, y) => page.evaluate(([x, y]) => window.__T.scr(x, y), [x, y]);
// Werkzeug setzen und warten, bis die Untergrund-Ansicht eingeblendet ist (die Vorschau liegt dann auf der Tunnelebene)
const setTool = async (page, tool) => {
  await page.evaluate((t) => window.__stadtpuls.input.setTool(t), tool);
  await page.waitForFunction(() => { const u = window.__stadtpuls.engine.underground; return !u || !u.on || u.kv >= 0.999; }, null, { timeout: 15000 }).catch(() => {});
};
const frames = (page, n = 2) => page.evaluate((n) => new Promise((r) => { const f = () => (n-- > 0 ? requestAnimationFrame(f) : r()); f(); }), n);
const pause = (page, ms = 250) => page.waitForTimeout(ms);
const shot = async (page, name) => { if (shotDir) await page.screenshot({ path: join(shotDir, name + '.png') }); };

async function touchDrag(page, cdp, a, b, steps = 10) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y, id: 1 }] });
  for (let k = 1; k <= steps; k++) {
    const x = a.x + ((b.x - a.x) * k) / steps, y = a.y + ((b.y - a.y) * k) / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await pause(page);
}
// Ziehen über mehrere Wegpunkte (Finger bleibt unten)
async function touchPath(page, cdp, pts, steps = 8) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0].x, y: pts[0].y, id: 1 }] });
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    for (let k = 1; k <= steps; k++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + ((b.x - a.x) * k) / steps, y: a.y + ((b.y - a.y) * k) / steps, id: 1 }] });
      await page.waitForTimeout(16);
    }
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await pause(page);
}
const tapAt = async (page, p) => {
  const on = await page.evaluate(([x, y]) => window.__T.onCanvas(x, y), [p.x, p.y]);
  if (on !== true) console.log(`    (Hinweis: Tipp bei ${Math.round(p.x)},${Math.round(p.y)} trifft ${on})`);
  await page.touchscreen.tap(p.x, p.y); await pause(page);
};
const tapTile = async (page, x, y, dx = 0, dy = 0) => { const p = await scr(page, x, y); await tapAt(page, { x: p.x + dx, y: p.y + dy }); };
async function tapBar(page, which) {
  await frames(page); // Leiste hat sich nach der letzten Änderung neu ausgerichtet
  const s = await st(page);
  const r = s[which];
  if (!r) throw new Error(`Knopf ${which} nicht sichtbar`);
  await page.touchscreen.tap(r.x, r.y);
  await pause(page, 300);
}
const handle = (s, kind) => s.handles.find((h) => h.kind === kind);
// Kamera fest auf Feld (x, y) richten
const resetCam = async (page, x, y) => { await page.evaluate(([x, y]) => { const a = window.__stadtpuls, rig = a.engine.rig; rig.flight = null; rig.focus(x - a.game.W / 2, y - a.game.H / 2, 26); rig.goal.pitch = 1.1; rig.goal.yaw = 0; rig.cur = { ...rig.cur, ...rig.goal }; rig.update(0); a.engine.camera.updateMatrixWorld(true); }, [x, y]); await pause(page, 400); };

try {
  if (!only || only === 'touch') {
    // ======================= Tablet mit Touch =======================
    console.log('== Touch (Tablet 820×1180)');
    const { page, ctx, base } = await startGame({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    const cdp = await ctx.newCDPSession(page);
    const { bx, by, A, B, ay } = base;
    check('Testfläche mit zwei Stationen', bx >= 0 && A > 0 && B > 0, JSON.stringify(base));

    console.log('-- Linie zeichnen mit Einrasten');
    await setTool(page, { kind: 'line' });
    let s = await st(page);
    const n0 = s.stations;
    check('Linienwerkzeug zeigt gleich die Leiste (✓ gesperrt)', s.bar && s.ok && s.ok.disabled && /antippen/.test(s.sub), s.sub);
    await tapTile(page, bx + 2, ay, 14, -12); // neben Station A getippt
    s = await st(page);
    check('Tipp neben einer Station rastet auf sie ein', s.stops.length === 1 && s.stops[0] === A && s.stations === n0, JSON.stringify(s.stops) + ' ' + JSON.stringify(await page.evaluate(() => window.__T.dbg())));
    await tapTile(page, bx + 12, ay + 4); // freies Feld
    s = await st(page);
    check('Tipp auf freies Feld plant eine neue Station (noch nicht gebaut)', s.stops.length === 2 && String(s.stops[1]).startsWith('n') && s.stations === n0, JSON.stringify(s.stops));
    check('✓ bereit mit Preis', s.ok && !s.ok.disabled && !!s.price, `${s.price} ${s.sub}`);
    await shot(page, 'bp-1-entwurf');
    await tapTile(page, bx + 12, ay + 4);
    s = await st(page);
    check('zweiter Tipp nimmt die geplante Station zurück', s.stops.length === 1 && s.stations === n0, JSON.stringify(s.stops));
    await tapTile(page, bx + 12, ay + 4);
    await tapBar(page, 'undo');
    s = await st(page);
    check('↶ nimmt sie ebenfalls zurück', s.stops.length === 1, JSON.stringify(s.stops));
    // Griff am Ende ziehen: über Station B hinweg, Loslassen auf freiem Feld
    let h = handle(s, 'e');
    const pB = await scr(page, bx + 7, ay), pC = await scr(page, bx + 12, ay - 2);
    await touchPath(page, cdp, [h, pB, pC]);
    s = await st(page);
    check('Griff ziehen: über Station B hinweg verlängert, neue Station am Loslassen', s.stops.length === 3 && s.stops[1] === B && String(s.stops[2]).startsWith('n') && s.stations === n0, JSON.stringify(s.stops));
    await shot(page, 'bp-2-gezogen');
    // Zurückziehen kürzt
    h = handle(s, 'e');
    await touchPath(page, cdp, [h, { x: (h.x + pB.x) / 2, y: (h.y + pB.y) / 2 }, pB, { x: pB.x - 8, y: pB.y + 30 }]);
    s = await st(page);
    check('Griff zurückziehen nimmt die Endstation ab (ohne neue Station)', s.stops.length === 2 && s.stops[1] === B, JSON.stringify(s.stops));
    // Kamera schwenken, Entwurf bleibt
    const g0 = s.goal;
    const pe = await scr(page, bx + 10, by + 9);
    await touchDrag(page, cdp, pe, { x: pe.x - 90, y: pe.y - 40 });
    s = await st(page);
    check('Ziehen auf freier Karte schwenkt die Kamera, Entwurf bleibt', (Math.abs(s.goal.x - g0.x) > 0.3 || Math.abs(s.goal.z - g0.z) > 0.3) && s.stops.length === 2, JSON.stringify(s.goal));
    await page.evaluate(([x, y]) => { const a = window.__stadtpuls, rig = a.engine.rig; rig.focus(x - a.game.W / 2, y - a.game.H / 2, 26); rig.cur = { ...rig.cur, ...rig.goal }; rig.update(0); a.engine.camera.updateMatrixWorld(true); }, [bx + 8, by + 6]);
    await pause(page, 400);
    // Dritte Station per Ziehen vom Griff, dann bauen
    s = await st(page);
    h = handle(s, 'e');
    await touchDrag(page, cdp, h, await scr(page, bx + 12, ay + 3));
    s = await st(page);
    check('Ziehen vom Griff ins Freie plant die nächste Station', s.stops.length === 3, JSON.stringify(s.stops));
    const money0 = s.money;
    await tapBar(page, 'ok');
    s = await st(page);
    const L1 = s.lines[s.lines.length - 1];
    check('✓ baut Linie und neue Station', s.lines.length === 1 && L1 && L1.stops.length === 3 && s.stations === n0 + 1 && s.tool === 'select', JSON.stringify(s.lines));
    await page.evaluate(() => window.__stadtpuls.ui.closePanels());
    void money0;

    console.log('-- Linie bearbeiten');
    await setTool(page, { kind: 'extend', line: L1.id });
    await resetCam(page, bx + 6, by + 5);
    s = await st(page);
    check('Bearbeiten: Griffe an beiden Enden, ✓ gesperrt ohne Änderung', s.handles.length === 2 && s.ok && s.ok.disabled, JSON.stringify(s.handles.map((x) => x.kind)) + ' ' + s.sub);
    await shot(page, 'bp-3-bearbeiten');
    // Anfang verlängern: Griff am Anfang (Station A) nach links ziehen
    h = handle(s, 's');
    await touchDrag(page, cdp, h, await scr(page, bx, ay - 2));
    s = await st(page);
    check('Anfangsgriff ziehen verlängert am Anfang', s.stops.length === 4 && String(s.stops[0]).startsWith('n') && s.stops[1] === A, JSON.stringify(s.stops));
    // Ende kürzen: Endgriff zurück auf B
    h = handle(s, 'e');
    await touchPath(page, cdp, [h, await scr(page, bx + 7, ay)]);
    s = await st(page);
    check('Endgriff zurück auf B kürzt die Linie', s.stops.length === 3 && s.stops[2] === B, JSON.stringify(s.stops));
    check('Kosten nur für den neuen Abschnitt', !!s.price && s.ok && !s.ok.disabled, s.price);
    await shot(page, 'bp-4-umbau');
    await tapBar(page, 'ok');
    s = await st(page);
    const L1b = s.lines.find((l) => l.id === L1.id);
    check('✓ baut den Umbau', L1b && L1b.stops.length === 3 && L1b.stops[1] === A && L1b.stops[2] === B && s.stations === n0 + 2, JSON.stringify(s.lines) + ' ' + s.stations);
    check('gekürzte Endstation bleibt stehen', !!(await page.evaluate(([x, y]) => window.__T.station(x, y), [bx + 12, ay + 3])));

    console.log('-- Station entfernen');
    await setTool(page, { kind: 'extend', line: L1.id });
    await resetCam(page, bx + 6, by + 5);
    await tapTile(page, bx + 2, ay, 10, 8); // Station A in der Mitte
    await page.waitForFunction(() => window.__stadtpuls.input.bar.popRect('rm'), null, { timeout: 8000 }).catch(() => {});
    s = await st(page);
    check('Station antippen öffnet das Menü mit Entfernen', s.pop === 1 && !!s.popRm, JSON.stringify(s));
    await shot(page, 'bp-5-menue');
    await page.touchscreen.tap(s.popRm.x, s.popRm.y);
    await pause(page, 300);
    s = await st(page);
    check('Entfernen nimmt die Station aus dem Entwurf', s.stops.length === 2 && !s.stops.includes(A), JSON.stringify(s.stops));
    await tapBar(page, 'ok');
    s = await st(page);
    const L1c = s.lines.find((l) => l.id === L1.id);
    check('✓: Station aus der Linie entfernt und (ohne andere Linie) abgerissen', L1c && L1c.stops.length === 2 && !(await page.evaluate(([x, y]) => window.__T.station(x, y), [bx + 2, ay])), JSON.stringify(s.lines));

    console.log('-- Ring');
    await setTool(page, { kind: 'extend', line: L1.id });
    await resetCam(page, bx + 6, by + 5);
    s = await st(page);
    h = handle(s, 'e');
    await touchDrag(page, cdp, h, await scr(page, bx + 7, ay + 6));
    s = await st(page);
    check('dritte Station angehängt', s.stops.length === 3, JSON.stringify(s.stops));
    h = handle(s, 'e');
    const start = handle(s, 's');
    await touchDrag(page, cdp, h, start);
    s = await st(page);
    check('Endgriff auf die Anfangsstation schließt den Ring', s.loop === true && s.handles.length === 0, JSON.stringify(s));
    await shot(page, 'bp-6-ring');
    await tapBar(page, 'ok');
    s = await st(page);
    check('✓ baut den Ring', s.lines.find((l) => l.id === L1.id).loop === true);
    await setTool(page, { kind: 'extend', line: L1.id });
    await tapBar(page, 'ring');
    s = await st(page);
    check('Ring-Knopf öffnet den Ring wieder', s.loop === false && s.handles.length === 2);
    await tapBar(page, 'cancel');
    s = await st(page);
    check('✕ verwirft den Entwurf', s.tool === 'select' && s.lines.find((l) => l.id === L1.id).loop === true, JSON.stringify({ tool: s.tool, lines: s.lines, cancel: s.cancel }) + ' ' + JSON.stringify(await page.evaluate(() => window.__T.dbg())));
    await ctx.close();
  }

  if (!only || only === 'maus') {
    // ======================= Maus =======================
    console.log('== Maus (1280×800)');
    const { page, ctx, base } = await startGame({ viewport: { width: 1280, height: 800 } });
    const { bx, A, B, ay } = base;
    await setTool(page, { kind: 'line' });
    let s = await st(page);
    const n0 = s.stations;
    let p = await scr(page, bx + 2, ay);
    await page.mouse.move(p.x + 9, p.y - 8); await pause(page, 120);
    await page.mouse.click(p.x + 9, p.y - 8);
    await pause(page);
    s = await st(page);
    check('Maus: Klick nahe der Station rastet ein', s.stops.length === 1 && s.stops[0] === A, JSON.stringify(s.stops));
    p = await scr(page, bx + 12, ay + 3);
    await page.mouse.move(p.x, p.y); await pause(page, 150);
    await shot(page, 'bp-m1-gummiband');
    await page.mouse.click(p.x, p.y);
    await pause(page);
    s = await st(page);
    check('Maus: Klick ins Freie plant eine Station', s.stops.length === 2 && s.stations === n0);
    await page.mouse.click(p.x, p.y);
    await pause(page);
    s = await st(page);
    check('Maus: zweiter Klick nimmt sie zurück', s.stops.length === 1);
    // Griff ziehen mit der Maus über B
    const h = handle(s, 'e');
    const pB = await scr(page, bx + 7, ay), pC = await scr(page, bx + 13, ay - 1);
    await page.mouse.move(h.x, h.y); await page.mouse.down();
    for (const q of [pB, pC]) for (let k = 1; k <= 8; k++) { await page.mouse.move(h.x + (q.x - h.x) * k / 8, h.y + (q.y - h.y) * k / 8); await page.waitForTimeout(16); }
    await page.mouse.up();
    await pause(page);
    s = await st(page);
    check('Maus: Griff ziehen nimmt B mit und plant eine Station', s.stops.length >= 2 && s.stops.includes(B), JSON.stringify(s.stops));
    await page.keyboard.press('Enter');
    await pause(page, 300);
    s = await st(page);
    check('Maus: Enter baut die Linie', s.lines.length === 1 && s.tool === 'select', JSON.stringify(s.lines));
    await ctx.close();
  }
} catch (e) {
  fails++;
  console.log('FEHLER im Prüfstand:', e.stack || e.message);
} finally {
  await browser.close();
  server.close();
  release();
}
const errs = errors.filter((x) => !/WebGL|GPU stall|swiftshader/i.test(x));
if (errs.length) { console.log('Fehler auf der Seite:\n  ' + errs.slice(0, 10).join('\n  ')); fails += errs.length; }
console.log(`${fails ? 'ROT' : 'GRÜN'}: ${passes} ok, ${fails} Fehler`);
process.exit(fails ? 1 : 0);
