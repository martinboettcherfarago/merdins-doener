// Prüfstand „Sicheres Bauen per Touch" (TOUCH, Runde 3b): echte Touch-Eingabe im Browser (Playwright, hasTouch,
// Tippen über page.touchscreen, Ziehen und Zwei-Finger-Zoom über CDP Input.dispatchTouchEvent) und Gegenprobe mit der Maus.
// Aufruf aus spiel/: node test/touch-test.mjs [--shots <ordner>]   (vorher node build.mjs; endet mit Code 1 bei Fehlern)
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, rmSync, statSync, readdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const shotDir = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : null;
const debug = argv.includes('--debug');
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

async function startGame(ctxOpts, settings = {}) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|net::ERR_FAILED/.test(m.text() + ((m.location() || {}).url || ''))) errors.push('console: ' + m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript((s) => { try { localStorage.setItem('stadtpuls.settings', JSON.stringify({ tutorialDone: true, advisor: false, quality: 'low', postfx: false, bloom: false, shadows: 'off', ...s })); } catch (e) { /* egal */ } }, settings);
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForSelector('[data-act=start]', { timeout: 90000 });
  await page.waitForTimeout(400);
  // SEED=<zahl> legt die Karte fest (zum Nachstellen einer roten Karte), sonst Zufall
  const usedSeed = await page.evaluate((seed) => {
    const mr = document.getElementById('modal-root'); if (mr) mr.innerHTML = '';
    const b = document.querySelector('[data-act=diff][data-v=sandbox]'); if (b) b.click();
    const opts = window.__stadtpuls.menu && window.__stadtpuls.menu.opts;
    if (seed && opts) opts.seed = seed;
    document.querySelector('[data-act=start]').click();
    return opts ? opts.seed : null;
  }, +(process.env.SEED || 0));
  console.log('Karte', usedSeed);
  await page.waitForFunction(() => window.__stadtpuls && window.__stadtpuls.game && window.__stadtpuls.engine && window.__stadtpuls.input, null, { timeout: 120000 });
  await page.waitForTimeout(800);
  // Freie Fläche suchen, Straße anlegen, Kamera fest darauf richten; Hilfsfunktionen für das Skript
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
      // zwei Reihen Rand oben: die U-Bahn-Planungsebene trifft beim Tippen teils eine Reihe darüber
      for (let y = y0 - 2; y < y0 + 12 && ok; y++) for (let x = x0; x < x0 + 10 && ok; x++) if (!free(x, y)) ok = false;
      if (ok) { bx = x0; by = y0; break outer; }
    }
    const ry = by + 5;
    const tiles = []; for (let x = bx; x < bx + 10; x++) tiles.push(ry * W + x);
    g.buildRoad(tiles, 2);
    const rig = app.engine.rig;
    rig.flight = null;
    rig.focus(bx + 5 - W / 2, by + 6 - H / 2, 30);
    rig.goal.pitch = 1.05; rig.goal.yaw = 0;
    rig.cur = { ...rig.cur, ...rig.goal }; rig.update(0); app.engine.camera.updateMatrixWorld(true);
    // Prüfstand: weniger Bildpunkte rendern (Software-WebGL), Simulation anhalten – die Eingabe bleibt unverändert
    app.engine.quality = { ...app.engine.quality, pr: 0.5 }; app.engine.resize();
    g.speed = 0;
    // Halten-und-Ziehen nur im eigenen Prüfschritt (Software-WebGL ist langsam: sonst zählt jedes Ziehen als Halten)
    app.input.holdMs = 1e7;
    const V = app.engine.camera.position.constructor;
    window.__T = {
      scr(x, y) {
        const cam = app.engine.camera, rc = app.engine.canvas.getBoundingClientRect();
        const v = new V(x + 0.5 - W / 2, 0, y + 0.5 - H / 2).project(cam);
        return { x: rc.left + ((v.x + 1) / 2) * rc.width, y: rc.top + ((1 - v.y) / 2) * rc.height };
      },
      st() {
        const inp = app.input;
        return { pend: inp.pend ? { ...inp.pend } : null, bar: inp.bar.visible, ok: inp.bar.rect('ok'), cancel: inp.bar.rect('cancel'), rotate: inp.bar.rect('rotate'), undo: inp.bar.rect('undo'),
          goal: { x: rig.goal.x, z: rig.goal.z, dist: rig.goal.dist }, blds: g.buildings.size, ghost: app.engine.overlay.ghost.visible, tool: inp.tool.kind,
          stations: g.transit.stations.size, lines: g.transit.lines.length, stops: inp.lineStops.length, sub: inp.bar.q.s.textContent, label: inp.bar.q.l.textContent };
      },
      bld(x, y) { return g.bld[y * W + x] || 0; }, road(x, y) { return g.road[y * W + x] || 0; }, zone(x, y) { return g.zone[y * W + x] || 0; },
      onCanvas(x, y) { const el = document.elementFromPoint(x, y); return el === app.engine.canvas ? true : el ? (el.id || '') + '.' + String(el.className).slice(0, 40) + ' in ' + ((el.closest('[id]') || {}).id || '') : 'nichts'; },
    };
    return { bx, by, ry };
  });
  await page.waitForTimeout(1200);
  return { ctx, page, base };
}

const st = (page) => page.evaluate(() => window.__T.st());
const scr = (page, x, y) => page.evaluate(([x, y]) => window.__T.scr(x, y), [x, y]);
const setTool = (page, tool) => page.evaluate((t) => window.__stadtpuls.input.setTool(t), tool);
const pause = (page, ms = 250) => page.waitForTimeout(ms);
// Kamera fest auf Feld (x, y) richten – sofort, ohne Gleiten, Matrizen gleich aktuell
const resetCam = async (page, x, y) => { await page.evaluate(([x, y]) => { const a = window.__stadtpuls, rig = a.engine.rig; rig.flight = null; rig.focus(x - a.game.W / 2, y - a.game.H / 2, 30); rig.goal.pitch = 1.05; rig.goal.yaw = 0; rig.cur = { ...rig.cur, ...rig.goal }; rig.update(0); a.engine.camera.updateMatrixWorld(true); }, [x, y]); await pause(page, 400); };

// Touch über CDP: Ziehen mit einem Finger, Zwei-Finger-Geste
async function touchDrag(page, cdp, a, b, steps = 8, holdMs = 0) {
  const on = await page.evaluate(([x, y]) => window.__T.onCanvas(x, y), [a.x, a.y]);
  if (on !== true) console.log(`  (Hinweis: Ziehen beginnt bei ${Math.round(a.x)},${Math.round(a.y)} über ${on})`);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y, id: 1 }] });
  if (holdMs) await page.waitForTimeout(holdMs);
  for (let k = 1; k <= steps; k++) {
    const x = a.x + ((b.x - a.x) * k) / steps, y = a.y + ((b.y - a.y) * k) / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await pause(page);
}
async function pinch(page, cdp, c, from, to) {
  const pts = (d) => [{ x: c.x - d, y: c.y, id: 1 }, { x: c.x + d, y: c.y, id: 2 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pts(from)[0]] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(from) });
  for (let k = 1; k <= 8; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(from + ((to - from) * k) / 8) }); await page.waitForTimeout(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [pts(to)[0]] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await pause(page, 300);
}
async function tapTile(page, x, y) {
  const p = await scr(page, x, y);
  const free = await page.evaluate(([a, b]) => window.__T.onCanvas(a, b), [p.x, p.y]);
  if (free !== true) console.log(`  (Hinweis: Feld ${x},${y} bei ${Math.round(p.x)},${Math.round(p.y)} liegt unter ${free})`);
  await page.touchscreen.tap(p.x, p.y);
  await pause(page);
}
async function tapBar(page, which) {
  const s = await st(page);
  const r = s[which];
  if (!r) throw new Error(`Knopf ${which} nicht sichtbar`);
  await page.touchscreen.tap(r.x, r.y);
  await pause(page, 300);
}
const shot = async (page, name) => { if (shotDir) await page.screenshot({ path: join(shotDir, name + '.png') }); };
const same = (a, b) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.z - b.z) < 1e-6;

try {
  // ======================= Handy mit Touch =======================
  console.log('== Touch (Handy 400×820)');
  const { page, ctx, base } = await startGame({ viewport: { width: 400, height: 820 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const cdp = await ctx.newCDPSession(page);
  const { bx, ry } = base;
  check('freie Testfläche gefunden', bx >= 0, JSON.stringify(base));
  await shot(page, 'touch-0-start');

  // 1) Bauen: Tippen setzt nur die Vorschau, ✓ baut
  console.log('-- Gebäude bauen');
  await setTool(page, { kind: 'place', key: 'police' });
  const n0 = (await st(page)).blds;
  await tapTile(page, bx + 2, ry - 1);
  let s = await st(page);
  check('Tippen setzt Vorschau', s.pend && s.pend.kind === 'point' && s.pend.x === bx + 2 && s.pend.y === ry - 1, JSON.stringify(s.pend));
  check('Tippen baut noch nicht', s.blds === n0 && !(await page.evaluate(([x, y]) => window.__T.bld(x, y), [bx + 2, ry - 1])));
  check('Leiste mit ✓ Bauen und Preis', s.bar && s.ok && !s.ok.disabled && s.label === 'Bauen');
  check('Leiste hat ↻ und ✕', !!s.rotate && !!s.cancel);
  await shot(page, 'touch-1-vorschau');
  await tapBar(page, 'ok');
  s = await st(page);
  check('✓ baut das Gebäude', s.blds === n0 + 1 && !!(await page.evaluate(([x, y]) => window.__T.bld(x, y), [bx + 2, ry - 1])));
  check('nach dem Bauen: Vorschau weg, Werkzeug bleibt', !s.pend && !s.bar && s.tool === 'place');

  // 2) Verrutschen ohne Bauen
  console.log('-- Verrutschen');
  const nA = s.blds;
  let p = await scr(page, bx + 4, ry - 1);
  await touchDrag(page, cdp, p, { x: p.x + 5, y: p.y + 3 }, 3);
  s = await st(page);
  check('leichtes Verrutschen = Tippen: nur Vorschau', s.pend && s.pend.x === bx + 4 && s.pend.y === ry - 1 && s.blds === nA, JSON.stringify(s.pend));
  const g0 = s.goal;
  p = await scr(page, bx + 7, ry + 3);
  if (debug) await page.evaluate(() => { window.__ev = []; const c = window.__stadtpuls.engine.canvas; for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) c.addEventListener(t, (e) => window.__ev.push(`${t}:${e.pointerType}:${e.pointerId}:${Math.round(e.clientX)},${Math.round(e.clientY)}:${e.isPrimary}`), true); });
  await touchDrag(page, cdp, p, { x: p.x - 60, y: p.y + 40 }, 8);
  if (debug) console.log(await page.evaluate(() => ({ ev: window.__ev, gest: window.__stadtpuls.input.gest, ids: [...window.__stadtpuls.input.touchIds], pin: window.__stadtpuls.engine.rig.pinching })));
  s = await st(page);
  check('Wischen über die Karte baut nicht und verschiebt die Kamera', s.blds === nA && !same(s.goal, g0), JSON.stringify(s.goal));
  check('Vorschau bleibt beim Kameraschwenk stehen', s.pend && s.pend.x === bx + 4 && s.pend.y === ry - 1);
  // Vorschau mit dem Finger ziehen
  const pa = await scr(page, bx + 4, ry - 1), pb = await scr(page, bx + 6, ry);
  const gBefore = (await st(page)).goal;
  await touchDrag(page, cdp, pa, pb, 10);
  s = await st(page);
  check('Vorschau lässt sich ziehen', s.pend && s.pend.x === bx + 6 && s.pend.y === ry, JSON.stringify(s.pend));
  check('Ziehen der Vorschau baut nicht und schwenkt nicht', s.blds === nA && same(s.goal, gBefore));
  check('Platz ungültig → ✓ gesperrt mit Grund', s.ok && s.ok.disabled && !!s.sub, s.sub);
  await shot(page, 'touch-2-gesperrt');
  // Neu antippen setzt um
  await tapTile(page, bx + 5, ry - 1);
  s = await st(page);
  check('erneutes Antippen setzt die Vorschau um', s.pend && s.pend.x === bx + 5 && s.pend.y === ry - 1 && s.ok && !s.ok.disabled);
  const hs = await page.evaluate(() => window.__stadtpuls.input.pendScreen().handles[0]);
  const before = (await st(page)).pend;
  await touchDrag(page, cdp, hs, { x: hs.x + 70, y: hs.y }, 8);
  s = await st(page);
  check('Verschiebe-Griff unter der Vorschau zieht sie mit', s.pend && (s.pend.x !== before.x || s.pend.y !== before.y) && s.blds === nA, `${JSON.stringify(before)} → ${JSON.stringify(s.pend)}`);
  await tapBar(page, 'cancel');
  s = await st(page);
  check('✕ bricht ab: nichts gebaut, Vorschau weg', !s.pend && !s.bar && !s.ghost && s.blds === nA);

  // 3) Kamera bewegen und zoomen, während die Vorschau steht – danach bauen
  console.log("-- Kamera bei stehender Vorschau");
  await resetCam(page, bx + 5, ry + 1);
  await tapTile(page, bx + 6, ry - 1);
  const s1 = await st(page);
  p = await scr(page, bx + 3, ry + 3);
  await touchDrag(page, cdp, p, { x: p.x + 70, y: p.y - 50 }, 8);
  let s2 = await st(page);
  check('Ziehen auf freier Karte verschiebt die Kamera', !same(s1.goal, s2.goal));
  check('Vorschau und Leiste bleiben', s2.pend && s2.pend.x === bx + 6 && s2.bar && s2.blds === s1.blds);
  check('Leiste folgt der Vorschau', s1.ok && s2.ok && (Math.abs(s1.ok.x - s2.ok.x) > 4 || Math.abs(s1.ok.y - s2.ok.y) > 4), `${JSON.stringify(s1.ok)} → ${JSON.stringify(s2.ok)}`);
  await pinch(page, cdp, { x: 200, y: 520 }, 60, 120);
  s2 = await st(page);
  check('Zwei-Finger-Zoom ändert den Abstand, baut nichts', Math.abs(s2.goal.dist - s1.goal.dist) > 0.5 && s2.blds === s1.blds && s2.pend && s2.pend.x === bx + 6, `dist ${s1.goal.dist.toFixed(1)} → ${s2.goal.dist.toFixed(1)}`);
  await shot(page, 'touch-3-kamera');
  await tapBar(page, 'ok');
  s2 = await st(page);
  check('nach Kamerabewegung: ✓ baut an der Vorschau', s2.blds === s1.blds + 1 && !!(await page.evaluate(([x, y]) => window.__T.bld(x, y), [bx + 6, ry - 1])));
  // Kamera zurück
  await resetCam(page, bx + 5, ry + 1);
  await pause(page, 600);

  // 4) Straße mit Griffen
  console.log('-- Straße mit Griffen');
  await setTool(page, { kind: 'road', type: 2 });
  await tapTile(page, bx + 1, ry + 2);
  s = await st(page);
  check('Antippen setzt Startpunkt (noch keine Straße)', s.pend && s.pend.kind === 'rect' && s.pend.single && !(await page.evaluate(([x, y]) => window.__T.road(x, y), [bx + 1, ry + 2])));
  await touchDrag(page, cdp, await scr(page, bx + 1, ry + 2), await scr(page, bx + 7, ry + 2), 10);
  s = await st(page);
  check('Griff am Ende ziehen legt die Strecke fest', s.pend && s.pend.ex === bx + 7 && s.pend.ey === ry + 2 && !s.pend.single, JSON.stringify(s.pend));
  check('Ziehen des Griffs baut nicht', !(await page.evaluate(([x, y]) => window.__T.road(x, y), [bx + 4, ry + 2])));
  await touchDrag(page, cdp, await scr(page, bx + 1, ry + 2), await scr(page, bx + 2, ry + 2), 6);
  s = await st(page);
  check('Griff am Anfang nachjustieren', s.pend && s.pend.sx === bx + 2 && s.pend.ex === bx + 7, JSON.stringify(s.pend));
  await shot(page, 'touch-4-strasse');
  await tapBar(page, 'ok');
  s = await st(page);
  const roadRow = await page.evaluate(([a, b, y]) => { const r = []; for (let x = a; x <= b; x++) r.push(window.__T.road(x, y)); return r; }, [bx + 1, bx + 7, ry + 2]);
  check('✓ baut genau die Strecke', roadRow[0] === 0 && roadRow.slice(1).every((v) => v === 2), roadRow.join(','));
  check('Straßenwerkzeug bleibt aktiv', s.tool === 'road' && !s.pend);
  // Tippen – Tippen
  await tapTile(page, bx + 1, ry + 4);
  await tapTile(page, bx + 5, ry + 4);
  s = await st(page);
  check('Tippen auf Start und Ziel legt die Strecke fest', s.pend && s.pend.sx === bx + 1 && s.pend.ex === bx + 5 && !s.pend.single, JSON.stringify(s.pend));
  await tapBar(page, 'cancel');
  check('✕: keine Straße gebaut', !(await page.evaluate(([x, y]) => window.__T.road(x, y), [bx + 3, ry + 4])) && !(await st(page)).pend);
  // Halten und ziehen
  await page.evaluate(() => { window.__stadtpuls.input.holdMs = 500; });
  await touchDrag(page, cdp, await scr(page, bx + 1, ry + 4), await scr(page, bx + 4, ry + 4), 8, 1500);
  await page.evaluate(() => { window.__stadtpuls.input.holdMs = 1e7; });
  s = await st(page);
  check('Halten und ziehen zieht die Strecke direkt auf', s.pend && s.pend.sx === bx + 1 && s.pend.ex === bx + 4 && !(await page.evaluate(([x, y]) => window.__T.road(x, y), [bx + 2, ry + 4])), JSON.stringify(s.pend));
  await tapBar(page, 'cancel');

  // 5) Zone mit Griffen
  console.log('-- Zone mit Griffen');
  await setTool(page, { kind: 'zone', zone: 1 });
  await tapTile(page, bx + 1, ry - 3);
  await touchDrag(page, cdp, await scr(page, bx + 1, ry - 3), await scr(page, bx + 4, ry - 2), 10);
  s = await st(page);
  check('Zonenfläche per Griff aufgezogen', s.pend && s.pend.ex === bx + 4 && s.pend.ey === ry - 2 && s.label === 'Bauen', JSON.stringify(s.pend));
  check('vor ✓ keine Zone', !(await page.evaluate(([x, y]) => window.__T.zone(x, y), [bx + 2, ry - 3])));
  await shot(page, 'touch-5-zone');
  await tapBar(page, 'ok');
  const zs = await page.evaluate(([x0, y0]) => { let n = 0; for (let y = y0; y <= y0 + 1; y++) for (let x = x0; x <= x0 + 3; x++) if (window.__T.zone(x, y) === 1) n++; return n; }, [bx + 1, ry - 3]);
  check('✓ weist die Fläche aus (8 Felder)', zs === 8, String(zs));

  // 5b) Bezirk malen: Rechteck mit Griffen, erst ✓ malt
  console.log('-- Bezirk');
  const dmap = (x, y) => page.evaluate(([x, y]) => { const D = window.__stadtpuls.game.ext.districts; return D && D.map ? D.map[y * window.__stadtpuls.game.W + x] || 0 : 0; }, [x, y]);
  await setTool(page, { kind: 'district', type: 'paint' });
  await tapTile(page, bx + 6, ry - 4);
  await touchDrag(page, cdp, await scr(page, bx + 6, ry - 4), await scr(page, bx + 8, ry - 3), 8);
  s = await st(page);
  check('Bezirk: Fläche per Griff, noch nicht gemalt', s.pend && s.pend.ex === bx + 8 && s.label === 'Malen' && !(await dmap(bx + 7, ry - 4)), JSON.stringify(s.pend));
  await tapBar(page, 'ok');
  check('Bezirk: ✓ malt die Fläche', !!(await dmap(bx + 7, ry - 4)) && !!(await dmap(bx + 8, ry - 3)) && !(await st(page)).pend);

  // 6) Abriss mit Griffen
  console.log('-- Abriss');
  await setTool(page, { kind: 'bulldoze' });
  const nb = (await st(page)).blds;
  await tapTile(page, bx + 2, ry - 1);
  s = await st(page);
  check('Abriss: erst Vorschau', s.pend && s.label === 'Abreißen' && s.blds === nb);
  await tapBar(page, 'ok');
  check('Abriss: ✓ reißt ab', (await st(page)).blds === nb - 1);

  // 7) U-Bahn-Linie (Entwurf: geplante Stationen entstehen erst mit ✓; Details in test/bahnplan-test.mjs)
  console.log('-- U-Bahn-Linie');
  await setTool(page, { kind: 'line' });
  const l0 = await st(page);
  await tapTile(page, bx + 1, ry - 5);
  p = await scr(page, bx + 5, ry - 5);
  await touchDrag(page, cdp, p, { x: p.x + 7, y: p.y - 6 }, 3);
  s = await st(page);
  check('Station antippen (auch mit leichtem Verrutschen) plant nur', s.stops === 2 && s.stations === l0.stations, `${s.stops} Halte, ${s.stations} Stationen`);
  check('Leiste zeigt ✓ Bauen mit ↶', s.bar && s.label === 'Bauen' && s.ok && !s.ok.disabled && !!s.undo);
  p = await scr(page, bx + 8, ry - 3);
  await touchDrag(page, cdp, p, { x: p.x - 70, y: p.y + 60 }, 8);
  s = await st(page);
  check('echtes Ziehen verschiebt nur die Kamera', s.stops === 2 && s.stations === l0.stations);
  await resetCam(page, bx + 5, ry - 2);
  await pause(page, 500);
  await tapTile(page, bx + 9, ry - 5);
  s = await st(page);
  check('dritte Station geplant', s.stops === 3, `${s.stops} Halte`);
  await tapTile(page, bx + 9, ry - 5);
  s = await st(page);
  check('zweiter Tipp auf die letzte Station nimmt sie zurück', s.stops === 2 && s.lines === l0.lines, `${s.stops} Halte, ${s.lines} Linien`);
  await shot(page, 'touch-6-linie');
  await tapBar(page, 'undo');
  s = await st(page);
  check('↶ macht das rückgängig', s.stops === 3);
  await tapBar(page, 'ok');
  s = await st(page);
  check('✓ eröffnet die Linie und baut die Stationen', s.lines === l0.lines + 1 && s.stops === 0 && !s.bar && s.stations === l0.stations + 3, `${s.lines} Linien, ${s.stations} Stationen`);
  await page.evaluate(() => { window.__stadtpuls.ui.closePanels(); });

  // 8) Ohne Bestätigung (Einstellung „never"): wie früher
  console.log('-- Einstellung confirmPlace = never');
  await page.evaluate(() => { window.__stadtpuls.settings.confirmPlace = 'never'; });
  await setTool(page, { kind: 'zone', zone: 2 });
  await tapTile(page, bx + 7, ry - 2);
  check('never: Tippen weist sofort aus', (await page.evaluate(([x, y]) => window.__T.zone(x, y), [bx + 7, ry - 2])) === 2 && !(await st(page)).bar);
  await page.evaluate(() => { window.__stadtpuls.settings.confirmPlace = 'auto'; window.__stadtpuls.input.setTool({ kind: 'select' }); });
  await ctx.close();

  // ======================= Maus (Tablet-Größe ohne Touch) =======================
  console.log('== Maus (1024×768)');
  const M = await startGame({ viewport: { width: 1024, height: 768 } });
  const mp = M.page, mb = M.base;
  await setTool(mp, { kind: 'place', key: 'police' });
  const m0 = (await st(mp)).blds;
  let q = await scr(mp, mb.bx + 2, mb.ry - 1);
  await mp.mouse.move(q.x, q.y); await pause(mp, 120);
  await mp.mouse.click(q.x, q.y);
  await pause(mp, 300);
  s = await st(mp);
  const diag = async (pt) => JSON.stringify({ el: await mp.evaluate(([a, b]) => window.__T.onCanvas(a, b), [pt.x, pt.y]), toast: await mp.evaluate(() => (document.getElementById('toasts') || {}).innerText || ''), s: await st(mp) });
  check('Maus: Klick baut sofort, keine Leiste', s.blds === m0 + 1 && !s.bar && !s.pend, await diag(q));
  await setTool(mp, { kind: 'road', type: 2 });
  q = await scr(mp, mb.bx + 1, mb.ry + 2);
  const q2 = await scr(mp, mb.bx + 6, mb.ry + 2);
  await mp.mouse.move(q.x, q.y); await mp.mouse.down();
  for (let k = 1; k <= 8; k++) { await mp.mouse.move(q.x + ((q2.x - q.x) * k) / 8, q.y + ((q2.y - q.y) * k) / 8); await mp.waitForTimeout(16); }
  check('Maus: während des Ziehens keine Leiste', !(await st(mp)).bar);
  await mp.mouse.up();
  await pause(mp, 300);
  const mrow = await mp.evaluate(([a, b, y]) => { const r = []; for (let x = a; x <= b; x++) r.push(window.__T.road(x, y)); return r; }, [mb.bx + 1, mb.bx + 6, mb.ry + 2]);
  check('Maus: Ziehen baut die Straße beim Loslassen', mrow.every((v) => v === 2), mrow.join(','));
  // Einstellung „always": auch mit der Maus bestätigen
  await mp.evaluate(() => { window.__stadtpuls.settings.confirmPlace = 'always'; });
  await setTool(mp, { kind: 'place', key: 'police' });
  const m1 = (await st(mp)).blds;
  q = await scr(mp, mb.bx + 4, mb.ry - 1);
  await mp.mouse.move(q.x, q.y); await mp.mouse.click(q.x, q.y);
  await pause(mp, 300);
  s = await st(mp);
  check('always: Mausklick setzt nur die Vorschau', s.pend && s.blds === m1 && s.bar, await diag(q));
  await shot(mp, 'maus-always');
  if (s.ok) await mp.mouse.click(s.ok.x, s.ok.y);
  await pause(mp, 300);
  check('always: Klick auf ✓ baut', (await st(mp)).blds === m1 + 1);
  await M.ctx.close();
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
