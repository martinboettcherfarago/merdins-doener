// Screenshot- und Prüfwerkzeug (headless Chromium mit Software-WebGL).
// Beispiele:
//   node tools/shot.mjs --scenario city --out /tmp/city.png
//   node tools/shot.mjs --scenario night --days 20 --out /tmp/night.png
//   node tools/shot.mjs --scenario closeup --out /tmp/close.png
//   node tools/shot.mjs --scenario gallery --gallery "res&fp=1x1,2x1" --out /tmp/res.png
//   node tools/shot.mjs --scenario city --eval tools/my-check.mjs   (export default async (page, h) => {...})
// Höchstens zwei Browser laufen gleichzeitig (Sperre unter /tmp), damit sich parallele Agenten nicht ausbremsen.
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
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
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => { failed = true; logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '')); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const q = scenario === 'gallery' ? `?gallery=${args.gallery || 'res'}` : '';
  await page.goto(`http://localhost:${port}/index.html${q}`);
  const wait = (ms) => page.waitForTimeout(ms);
  await wait(2000);
  const h = {
    wait, page,
    // Neues Spiel mit Beispielstadt starten und vorspulen
    async city(opts = {}) {
      // Klick per Skript: Dialoge (z. B. Szenario-Hinweise) dürfen den Start-Knopf nicht verdecken
      await page.evaluate(() => {
        const mr = document.getElementById('modal-root'); if (mr) mr.innerHTML = '';
        const b = document.querySelector('[data-act=diff][data-v=sandbox]'); if (b) b.click();
        document.querySelector('[data-act=start]').click();
      });
      await wait(1500);
      await page.evaluate(({ days, hour, dist, pitch, yaw }) => {
        const app = window.__stadtpuls; const g = app.game;
        app.debug.buildDemoCity(g);
        for (let i = 0; i < 300 * days; i++) { g.update(0.1); if (g.pendingCards) g.chooseCard(g.pendingCards[0]); if (g.pendingEvent) g.resolveEvent(0); }
        document.getElementById('modal-root').innerHTML = ''; app.ui.modalQueue = [];
        g.time = Math.floor(g.time / 1440) * 1440 + hour * 60;
        const hy = g.world.highwayY, x0 = g.world.highwayEnd % g.W + 1;
        app.engine.rig.focus(x0 + 16 - g.W / 2, hy - g.H / 2, dist);
        app.engine.rig.goal.pitch = pitch; app.engine.rig.goal.yaw = yaw;
      }, { days: opts.days ?? days, hour: opts.hour ?? 11, dist: opts.dist ?? 34, pitch: opts.pitch ?? 0.85, yaw: opts.yaw ?? 0.6 });
      await wait(opts.wait ?? waitMs);
    },
    async stats() {
      return page.evaluate(() => {
        const app = window.__stadtpuls; if (!app || !app.engine) return window.__gallery || null;
        const info = app.engine.renderer.info;
        const g = app.game;
        return { calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures,
          protos: app.engine.buildings.protoMgr ? app.engine.buildings.protoMgr.stats() : null, pop: g.stats.pop, buildings: g.buildings.size, cars: g.traffic.cars.length };
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
  else if (scenario === 'gallery') await wait(waitMs);
  if (args.eval) {
    const mod = await import(pathToFileURL(resolve(process.cwd(), args.eval)).href);
    await mod.default(page, h);
  }
  await page.screenshot({ path: out });
  const st = await h.stats();
  console.log('Screenshot:', out);
  if (st) console.log('Statistik:', JSON.stringify(st));
  if (logs.length) console.log(logs.slice(0, 30).join('\n'));
} finally {
  await browser.close();
  server.close();
  release();
}
process.exit(failed ? 1 : 0);
