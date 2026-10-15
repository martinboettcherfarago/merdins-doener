// Bildfolgen (Kontaktabzüge) vom Straßenverkehr als --eval-Modul für tools/shot.mjs:
//   FB_OUT=/tmp/fb node tools/shot.mjs --scenario menu --eval tools/fahrtbild.mjs
// Szenen (FB_ONLY, Komma-Liste): tram-turn (Straßenbahn in der Kurve), tram-end (Straßenbahn an der Endhaltestelle),
// truck (Sattelzug beim Abbiegen), junction (volle Kreuzung mit Fußgängern), bus-end (Bus an der Endhaltestelle).
// Umgebung: FB_SAVE (Spielstand, Standard saves/megastadt.json), FB_OUT (Ordner), FB_TAG (Präfix, Standard fahrt),
// FB_FRAMES (Bilder je Folge, Standard 12), FB_STEP (Spielsekunden zwischen zwei Bildern, je Szene voreingestellt).
// Die Spielschleife wird angehalten; jedes Bild wird von Hand weitergerechnet (Simulation in Schritten von 1/30 s,
// Darstellung mit derselben Zeit) und in ein Raster gezeichnet – so sind die Folgen auch mit Software-WebGL flüssig.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

export default async function fahrtbild(page) {
  const out = process.env.FB_OUT || '/tmp/fahrtbild';
  const tag = process.env.FB_TAG || 'fahrt';
  const only = (process.env.FB_ONLY || 'tram-turn,tram-end,truck,junction').split(',');
  const nFrames = +(process.env.FB_FRAMES || 12);
  mkdirSync(out, { recursive: true });
  const save = readFileSync(process.env.FB_SAVE || 'saves/megastadt.json', 'utf8');
  await page.waitForFunction(() => { const el = document.getElementById('loader'); return window.__stadtpuls && window.__stadtpuls.mode === 'menu' && (!el || el.hidden); }, null, { timeout: 120000 }).catch(() => {});
  await page.evaluate((t) => { window.__stadtpuls.loadData(t, { quiet: true }); }, save);
  await page.waitForFunction(() => { const en = window.__stadtpuls.engine; return en && !en.warming; }, null, { timeout: 180000 }).catch(() => {});
  await page.setViewportSize({ width: 800, height: 520 });
  await page.waitForTimeout(800);
  // Spielschleife anhalten, Hilfsfunktionen anlegen
  await page.evaluate(() => {
    const app = window.__stadtpuls, g = app.game, en = app.engine;
    document.getElementById('modal-root').innerHTML = '';
    if (app.ui) app.ui.modalQueue = [];
    app.mode = 'fahrtbild';
    g.speed = 0;
    if (g.ext && g.ext.weather) { g.ext.weather.rain = 0; g.ext.weather.fog = 0; }
    const F = window.__fb = {};
    // (Karten und Ereignisse sofort erledigen – sie hielten die Simulation an)
    F.step = (dt) => {
      if (g.pendingCards) g.chooseCard(g.pendingCards[0]);
      if (g.pendingEvent) g.resolveEvent(0);
      g.speed = 1; const s = g.update(dt); g.speed = 0; return s;
    };
    // Simulation und Fahrzeugansicht (ohne Bild) weiterrechnen
    F.run = (sec) => { const n = Math.round(sec * 30); for (let k = 0; k < n; k++) { const s = F.step(1 / 30); en.vehicles.frame(en.time += 1 / 30, en.night, null); void s; } };
    F.cam = (x, z, dist, pitch, yaw) => {
      const rig = en.rig;
      rig.flight = null;
      rig.goal.x = x; rig.goal.z = z; rig.goal.dist = dist; rig.goal.pitch = pitch; rig.goal.yaw = yaw;
      rig.cur = { ...rig.goal };
    };
    F.frame = (dt) => { const s = F.step(dt); en.frame(dt, s); };
    F.tile = (i) => [(i % g.W) + 0.5 - g.W / 2, ((i / g.W) | 0) + 0.5 - g.H / 2];
    F.sheet = null;
    F.begin = (n, cols, title) => {
      const c = document.createElement('canvas');
      const cw = 400, ch = 260, rows = Math.ceil(n / cols);
      c.width = cw * cols; c.height = ch * rows + 22;
      const x = c.getContext('2d');
      x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = '#fff'; x.font = '14px sans-serif'; x.fillText(title, 6, 16);
      F.sheet = { c, x, cw, ch, cols, k: 0 };
    };
    F.grab = (label) => {
      const S = F.sheet, src = en.renderer.domElement;
      const col = S.k % S.cols, row = Math.floor(S.k / S.cols);
      S.x.drawImage(src, col * S.cw, 22 + row * S.ch, S.cw, S.ch);
      S.x.fillStyle = 'rgba(0,0,0,0.55)'; S.x.fillRect(col * S.cw, 22 + row * S.ch, 92, 16);
      S.x.fillStyle = '#fff'; S.x.font = '12px sans-serif'; S.x.fillText(label, col * S.cw + 4, 22 + row * S.ch + 12);
      S.k++;
    };
    F.png = () => F.sheet.c.toDataURL('image/png');
    // Tageslicht für die Aufnahme: Uhrzeit auf 10:30 des laufenden Tages
    F.day = () => { const d = Math.floor(g.time / 1440); g.time = d * 1440 + 630; g.nextStep = g.time + 10; };
  });
  const write = async (name) => {
    const url = await page.evaluate(() => window.__fb.png());
    const file = `${out}/${tag}-${name}.png`;
    writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    console.log('Bildfolge ' + file);
  };
  // Eine Folge aufnehmen: warm (Sekunden ohne Bild), dann n Bilder im Abstand step
  const record = (step, n, title) => page.evaluate(({ step, n, title }) => {
    const F = window.__fb;
    F.begin(n, 3, title);
    // zwei Bilder zum Einschwingen (Detailstufen, Schatten)
    F.frame(1 / 30); F.frame(1 / 30);
    let t = 0;
    for (let k = 0; k < n; k++) {
      const sub = Math.max(1, Math.round(step * 30));
      for (let j = 0; j < sub - 1; j++) { F.step(1 / 30); window.__stadtpuls.engine.vehicles.frame(window.__stadtpuls.engine.time += 1 / 30, 0, null); }
      F.frame(1 / 30);
      t += sub / 30;
      F.grab(`t = ${t.toFixed(1)} s`);
    }
  }, { step, n, title });

  for (const scene of only) {
    const info = await page.evaluate((scene) => {
      const app = window.__stadtpuls, g = app.game, F = window.__fb;
      const T = g.ext && g.ext.transport;
      const W = g.W;
      const lm = new Map((T ? T.lines : []).map((l) => [l.id, l]));
      const pose = (line, s) => {
        const cum = line.cum, pts = line.pts, n = cum.length;
        s = Math.max(0, Math.min(cum[n - 1], s));
        let k = 0;
        while (k < n - 2 && cum[k + 1] < s) k++;
        const t = (s - cum[k]) / Math.max(1e-6, cum[k + 1] - cum[k]);
        return [pts[k * 2] + (pts[k * 2 + 2] - pts[k * 2]) * t - g.W / 2, pts[k * 2 + 1] + (pts[k * 2 + 3] - pts[k * 2 + 1]) * t - g.H / 2];
      };
      // Neuer Stand (roadnet): Fahrzeuge mit Route und Lage S – Szenen danach suchen
      if (g.traffic.lanes) {
        const o = { k: 0 };
        const at = (R0, S) => { R0.at(S, 0, o); return [o.x, o.z]; };
        for (let guard = 0; guard < 600; guard++) {
          if (scene === 'tram-end' || scene === 'bus-end') {
            const mode = scene === 'tram-end' ? 'tram' : 'bus';
            for (const v of T.vehicles) {
              const l = lm.get(v.line), vis = v.vis;
              if (!l || l.mode !== mode || l.loop || v.state !== 'move' || !vis || v.tgtS === undefined) continue;
              const tv = l.visits[v.vi];
              if (!tv || (tv.k !== 0 && tv.k !== l.stops.length - 1)) continue;
              const rem = v.tgtS - vis.S;
              if (rem > 1.5 && rem < 4) { const [x, z] = at(vis.route, v.tgtS - 0.8); F.cam(x, z, 6, 1.2, 0.6); return { ok: true, line: l.num, rem: +rem.toFixed(2) }; }
            }
          } else if (scene === 'tram-turn') {
            for (const v of T.vehicles) {
              const l = lm.get(v.line), vis = v.vis;
              if (!l || l.mode !== 'tram' || v.state !== 'move' || !vis) continue;
              const R0 = vis.route;
              for (let j = R0.next(vis.k), i = 0; j >= 0 && i < 5; j = R0.next(j), i++) {
                if (R0.mv(j) !== 1) continue;
                const ahead = R0.ahead(vis.S, j);
                if (ahead > 1.5 && ahead < 3.5) { const [x, z] = at(R0, R0.p(j) + R0.plen(j) / 2); F.cam(x, z, 5.5, 1.2, 0.6); return { ok: true, line: l.num, ahead: +ahead.toFixed(2) }; }
                break;
              }
            }
          } else if (scene === 'truck') {
            // Kurve auf einer gewöhnlichen Kreuzung oder Ecke (nicht mitten in einer gepflasterten Fläche aus Straßenfeldern)
            const plain = (t) => { let n = 0; const x = t % W, y = (t / W) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g.road[(y + dy) * W + x + dx]) n++; return n <= 5; };
            for (const c of g.traffic.cars) {
              if (!c.trailer || c.state !== 1 || c.hidden || c.v < 0.2) continue;
              const R0 = c.route;
              for (let j = R0.next(c.k), i = 0; j >= 0 && i < 5; j = R0.next(j), i++) {
                if (R0.mv(j) !== 1 || !plain(R0.tile(j))) continue;
                const ahead = R0.ahead(c.S, j);
                if (ahead > 1.2 && ahead < 3) { const [x, z] = at(R0, R0.p(j) + R0.plen(j) / 2); F.cam(x, z, 5, 1.2, 0.6); window.__fbTruck = c.id; return { ok: true, id: c.id, ahead: +ahead.toFixed(2) }; }
                break;
              }
            }
          } else if (scene === 'junction') {
            const cnt = new Map();
            for (const c of g.traffic.cars) { if (c.state !== 1) continue; const t = c.route.tile(c.k); cnt.set(t, (cnt.get(t) || 0) + 1); }
            let best = -1, bv = -1;
            for (let i = 0; i < g.N; i++) {
              if (!g.road[i] || g.road[i] === 4 || g.traffic.lanes.jc[i] !== 4) continue;
              const x = i % W, y = (i / W) | 0;
              let deg = 0;
              for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < g.H && g.road[yy * W + xx]) deg++; }
              if (deg < 4) continue;
              let sc = 0;
              for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) sc += cnt.get(i + dy * W + dx) || 0;
              if (sc > bv) { bv = sc; best = i; }
            }
            if (best < 0) return { ok: false };
            const [x, z] = F.tile(best);
            F.cam(x, z, 4.5, 1.4, 0.6); // steil von oben: hohe Häuser verdecken sonst die Kreuzung
            return { ok: true, tile: best, cars: bv };
          }
          F.run(0.5);
        }
        return { ok: false };
      }
      if (scene === 'tram-end' || scene === 'bus-end') {
        const mode = scene === 'tram-end' ? 'tram' : 'bus';
        // Fahrzeug, das auf eine Endhaltestelle zufährt (3–6 Felder davor)
        for (let guard = 0; guard < 400; guard++) {
          for (const v of T.vehicles) {
            const l = lm.get(v.line);
            if (!l || l.mode !== mode || l.loop || v.state !== 'move') continue;
            const end = v.dir > 0 ? l.len : 0;
            const rem = Math.abs(end - v.s);
            if (Math.abs(v.tgt - end) < 1e-3 && rem > 1.5 && rem < 4) {
              const [x, z] = pose(l, end - v.dir * 0.8);
              F.cam(x, z, 6, 1.2, 0.6);
              return { ok: true, line: l.num, rem };
            }
          }
          F.run(1);
        }
        return { ok: false };
      }
      if (scene === 'tram-turn') {
        for (let guard = 0; guard < 400; guard++) {
          for (const v of T.vehicles) {
            const l = lm.get(v.line);
            if (!l || l.mode !== 'tram' || v.state !== 'move') continue;
            // nächste Kurve in Fahrtrichtung 2–4 Felder voraus
            const p = l.path;
            for (let k = 1; k < p.length - 1; k++) {
              if (p[k] - p[k - 1] === p[k + 1] - p[k]) continue;
              const tx = (p[k] % W) + 0.5, ty = ((p[k] / W) | 0) + 0.5;
              // Abstand entlang der Linie
              let best = 1e9, bs = 0;
              for (let j = 0; j < l.cum.length; j++) { const d = Math.hypot(l.pts[j * 2] - tx, l.pts[j * 2 + 1] - ty); if (d < best) { best = d; bs = l.cum[j]; } }
              const ahead = (bs - v.s) * v.dir;
              if (ahead > 1.5 && ahead < 3.5 && (v.dir > 0 ? v.tgt > bs : v.tgt < bs)) {
                F.cam(tx - g.W / 2, ty - g.H / 2, 5.5, 1.2, 0.6);
                return { ok: true, line: l.num, ahead };
              }
            }
          }
          F.run(0.5);
        }
        return { ok: false };
      }
      if (scene === 'truck') {
        for (let guard = 0; guard < 600; guard++) {
          for (const c of g.traffic.cars) {
            if (c.type !== 1) continue;
            const p = c.path, k = c.piece;
            for (let j = k + 1; j < Math.min(p.length - 1, k + 4); j++) {
              if (p[j] - p[j - 1] === p[j + 1] - p[j]) continue;
              if (j - k < 2) continue;
              const [x, z] = F.tile(p[j]);
              F.cam(x, z, 5, 1.2, 0.6);
              window.__fbTruck = c.id;
              return { ok: true, id: c.id, turnIn: j - k };
            }
          }
          F.run(0.5);
        }
        return { ok: false };
      }
      if (scene === 'junction') {
        // Kreuzung (vier Arme) mit dem meisten Verkehr in der Nähe
        const cnt = new Map();
        for (const c of g.traffic.cars) { const t = c.path[Math.min(c.piece, c.path.length - 1)]; cnt.set(t, (cnt.get(t) || 0) + 1); }
        let best = -1, bv = -1;
        for (let i = 0; i < g.N; i++) {
          if (!g.road[i] || g.road[i] === 4) continue;
          const x = i % W, y = (i / W) | 0;
          let deg = 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < g.H && g.road[yy * W + xx]) deg++; }
          if (deg < 4) continue;
          let s = 0;
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) s += cnt.get(i + dy * W + dx) || 0;
          if (s > bv) { bv = s; best = i; }
        }
        if (best < 0) return { ok: false };
        const [x, z] = F.tile(best);
        F.cam(x, z, 5, 1.15, 0.6);
        return { ok: true, tile: best, cars: bv };
      }
      return { ok: false };
    }, scene);
    console.log(scene, JSON.stringify(info));
    if (!info.ok) continue;
    // Fußgänger und Detailstufen in Gang bringen
    await page.evaluate(() => { const F = window.__fb; F.day(); for (let k = 0; k < 20; k++) F.frame(1 / 30); });
    const step = +(process.env.FB_STEP || (scene === 'tram-end' || scene === 'bus-end' ? 1.2 : scene === 'junction' ? 0.6 : scene === 'tram-turn' ? 1.0 : 0.8));
    await record(step, nFrames, `${scene} (${JSON.stringify(info)}), Abstand ${step} s`);
    await write(scene);
  }
}
