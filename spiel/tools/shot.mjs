// Screenshot- und Prüfwerkzeug (headless Chromium mit Software-WebGL).
// Beispiele:
//   node tools/shot.mjs --scenario city --out /tmp/city.png
//   node tools/shot.mjs --scenario city --quality low --out /tmp/city-low.png
//   node tools/shot.mjs --scenario night --days 20 --out /tmp/night.png
//   node tools/shot.mjs --scenario closeup --out /tmp/close.png
//   node tools/shot.mjs --scenario gallery --gallery "res&fp=1x1,2x1" --out /tmp/res.png
//   node tools/shot.mjs --scenario city --eval tools/my-check.mjs   (export default async (page, h) => {...})
//   node tools/shot.mjs --scenario winter|rain --out /tmp/w.png       (Stadt mit gesetztem Wetter: Schnee bzw. Regen)
//   --strict: auch Konsolen-Fehler und abgefangene Simulationsfehler (g.errors) lassen das Werkzeug mit Code 1 enden
//   --timeout <s>: Abbruch nach so vielen Sekunden (Standard 600)
// Höchstens zwei Browser laufen gleichzeitig (Sperre unter /tmp), damit sich parallele Agenten nicht ausbremsen.
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, rmSync, statSync, utimesSync, readdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));
const scenario = args.scenario || 'city';
const out = args.out || `/tmp/stadtpuls-${scenario}.png`;
const W = +(args.w || 1280), H = +(args.h || 720);
const days = +(args.days || 12);
const waitMs = +(args.wait || 3500);

// --- Sperre (Semaphor mit 2 Plätzen)
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
const slot = acquire();
const release = () => { try { rmSync(slot, { recursive: true, force: true }); } catch (e) { /* egal */ } };
process.on('exit', release);
// Sperre auch bei Abbruch (Strg+C, kill) freigeben und lebendig halten, damit lange Läufe nicht als verwaist gelten
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { release(); process.exit(130); });
const keepAlive = setInterval(() => { try { const t = new Date(); utimesSync(slot, t, t); } catch (e) { /* egal */ } }, 30000);
keepAlive.unref();
const strict = !!args.strict;
const timeoutS = +(args.timeout || 600);
const killer = setTimeout(() => { console.log(`ABBRUCH: Zeitlimit ${timeoutS} s überschritten`); release(); process.exit(2); }, timeoutS * 1000);
killer.unref();
// Chromium suchen: Umgebungsvariable, bekannter Pfad, sonst irgendein chromium-*/chrome-linux/chrome
function chromePath() {
  if (process.env.CHROME) return process.env.CHROME;
  const known = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  if (existsSync(known)) return known;
  try {
    for (const d of readdirSync('/opt/pw-browsers')) {
      const p = join('/opt/pw-browsers', d, 'chrome-linux', 'chrome');
      if (/^chromium-\d+$/.test(d) && existsSync(p)) return p;
    }
  } catch (e) { /* egal */ }
  return known;
}

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary' };
const server = createServer((req, res) => {
  let p = join(root, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

let failed = false;
const browser = await chromium.launch({
  executablePath: chromePath(),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const logs = [];
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  // --quality low|medium|high|ultra: setzt die Qualitätsstufe samt Voreinstellung (wie die Oberfläche), vor dem Laden
  if (args.quality) {
    const PRE = { low: { postfx: false, ao: false, bloom: false, shadows: 'off' }, medium: { postfx: true, ao: false, bloom: true, shadows: 'low' },
      high: { postfx: true, ao: true, bloom: true, shadows: 'high' }, ultra: { postfx: true, ao: true, bloom: true, shadows: 'high' } };
    const q = String(args.quality);
    await page.addInitScript(({ q, pre }) => {
      try { const s = JSON.parse(localStorage.getItem('stadtpuls.settings') || '{}'); localStorage.setItem('stadtpuls.settings', JSON.stringify({ ...s, quality: q, ...pre })); } catch (e) { /* egal */ }
    }, { q, pre: PRE[q] || {} });
  }
  let consoleErrors = 0;
  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    // Schriften von Google sperrt das Werkzeug selbst (kein Netz) – diese Ladefehler nicht zählen
    if (m.type() === 'error' && /Failed to load resource: net::ERR_FAILED/.test(m.text()) && /fonts\.(googleapis|gstatic)/.test((m.location() || {}).url || 'fonts.googleapis')) return;
    if (m.type() === 'error') consoleErrors++;
    logs.push(m.type() + ': ' + m.text());
  });
  page.on('pageerror', (e) => { failed = true; logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '')); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const q = scenario === 'gallery' ? `?gallery=${args.gallery || 'res'}` : '';
  await page.goto(`http://localhost:${port}/index.html${q}`);
  const wait = (ms) => page.waitForTimeout(ms);
  if (scenario !== 'gallery') {
    // Auf das Hauptmenü warten (Texturen werden beim ersten Start vorbereitet) statt fester Wartezeit
    try { await page.waitForSelector('[data-act=start]', { timeout: 60000 }); } catch (e) { logs.push('WARNUNG: Hauptmenü nach 60 s nicht bereit'); }
    await wait(500);
  } else await wait(2000);
  const h = {
    wait, page,
    // Neues Spiel mit Beispielstadt starten und vorspulen
    async city(opts = {}) {
      // Klick per Skript: Dialoge (z. B. Szenario-Hinweise) dürfen den Start-Knopf nicht verdecken
      const started = await page.evaluate(() => {
        const mr = document.getElementById('modal-root'); if (mr) mr.innerHTML = '';
        const b = document.querySelector('[data-act=diff][data-v=sandbox]'); if (b) b.click();
        const s = document.querySelector('[data-act=start]');
        if (!s) return false;
        s.click();
        return true;
      });
      if (!started) throw new Error('Start-Knopf im Hauptmenü nicht gefunden');
      try { await page.waitForFunction(() => window.__stadtpuls && window.__stadtpuls.game && window.__stadtpuls.engine, null, { timeout: 90000 }); } catch (e) {
        const info = await page.evaluate(() => ({ mode: window.__stadtpuls ? window.__stadtpuls.mode : '(kein __stadtpuls)', modal: (document.getElementById('modal-root') || {}).innerText || '' })).catch(() => ({}));
        throw new Error(`Spiel startet nicht (kein app.game nach 90 s; Modus ${info.mode}${info.modal ? ', Dialog: ' + info.modal.slice(0, 120) : ''})`);
      }
      await wait(800);
      await page.evaluate(({ days, hour, dist, pitch, yaw, weather }) => {
        const app = window.__stadtpuls; const g = app.game;
        app.debug.buildDemoCity(g);
        for (let i = 0; i < 300 * days; i++) { g.update(0.1); if (g.pendingCards) g.chooseCard(g.pendingCards[0]); if (g.pendingEvent) g.resolveEvent(0); }
        document.getElementById('modal-root').innerHTML = ''; app.ui.modalQueue = [];
        g.time = Math.floor(g.time / 1440) * 1440 + hour * 60;
        // Wetter setzen (Szenarien winter/rain); danach kurz weiterlaufen, damit Ansichten den Zustand übernehmen
        const wx = g.system && g.system('weather');
        if (weather && wx && wx.set) {
          wx.set(g, weather.kind, weather.extra || {});
          if (weather.extra && g.ext.weather) Object.assign(g.ext.weather, weather.extra);
          for (let i = 0; i < 6; i++) g.update(0.05);
          if (weather.extra && g.ext.weather) Object.assign(g.ext.weather, weather.extra);
        }
        const hy = g.world.highwayY, x0 = g.world.highwayEnd % g.W + 1;
        app.engine.rig.focus(x0 + 16 - g.W / 2, hy - g.H / 2, dist);
        app.engine.rig.goal.pitch = pitch; app.engine.rig.goal.yaw = yaw;
      }, { days: opts.days ?? days, hour: opts.hour ?? 11, dist: opts.dist ?? 34, pitch: opts.pitch ?? 0.85, yaw: opts.yaw ?? 0.6, weather: opts.weather || null });
      await wait(opts.wait ?? waitMs);
    },
    async stats() {
      return page.evaluate(() => {
        const app = window.__stadtpuls; if (!app || !app.engine) return window.__gallery || null;
        const info = app.engine.renderer.info;
        const g = app.game;
        if (!g) return { calls: info.render.calls, triangles: info.render.triangles };
        return { calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures,
          protos: app.engine.buildings && app.engine.buildings.protoMgr ? app.engine.buildings.protoMgr.stats() : null, pop: g.stats.pop, buildings: g.buildings.size, cars: g.traffic.cars.length,
          simErrors: (g.errors || []).map((e) => `${e.where}: ${e.msg}`) };
      });
    },
  };
  if (scenario === 'menu') await wait(waitMs + 3000);
  else if (scenario === 'city') await h.city();
  else if (scenario === 'night') await h.city({ hour: 22.5 });
  else if (scenario === 'closeup') await h.city({ dist: 10, pitch: 0.5 });
  else if (scenario === 'street') await h.city({ dist: 5, pitch: 0.38 });
  else if (scenario === 'overview') await h.city({ dist: 70, pitch: 1.0 });
  else if (scenario === 'mobile') { await page.setViewportSize({ width: 400, height: 820 }); await h.city(); }
  else if (scenario === 'winter') await h.city({ weather: { kind: 'snow', extra: { snowCover: 0.85 } } });
  else if (scenario === 'rain') await h.city({ weather: { kind: 'rain', extra: { rain: 0.8 } } });
  else if (scenario === 'gallery') await wait(waitMs);
  else if (scenario !== 'menu') console.log(`Unbekanntes Szenario „${scenario}“ – zeige das Hauptmenü.`);
  if (args.eval) {
    const mod = await import(pathToFileURL(resolve(process.cwd(), args.eval)).href);
    await mod.default(page, h);
  }
  try { mkdirSync(dirname(resolve(out)), { recursive: true }); } catch (e) { /* egal */ }
  await page.screenshot({ path: out, timeout: 180000 });
  const st = await h.stats().catch((e) => ({ fehler: e.message }));
  console.log('Screenshot:', out);
  if (st) {
    const { simErrors, ...rest } = st;
    console.log('Statistik:', JSON.stringify(rest));
    if (simErrors && simErrors.length) { console.log('SIMFEHLER (abgefangen):\n  ' + simErrors.slice(0, 10).join('\n  ')); if (strict) failed = true; }
  }
  if (logs.length) console.log(logs.slice(0, 30).join('\n'));
  if (strict && consoleErrors) { console.log(`STRICT: ${consoleErrors} Konsolen-Fehler`); failed = true; }
} catch (e) {
  failed = true;
  console.log('FEHLER im Werkzeug:', e.message);
  if (logs.length) console.log(logs.slice(0, 30).join('\n'));
} finally {
  await browser.close();
  server.close();
  release();
}
process.exit(failed ? 1 : 0);
