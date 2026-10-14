// Zoomfahrt-Messung (Detailstufen, Ruckler, Ladezeit) als --eval-Modul für tools/shot.mjs.
//   node tools/shot.mjs --scenario city --eval tools/zoomfahrt.mjs --out /tmp/zf.png
//   ZF_SAVE=saves/megastadt.json ZF_OUT=/tmp/zf node tools/shot.mjs --scenario menu --eval tools/zoomfahrt.mjs
// Umgebung: ZF_SAVE (Spielstand laden statt Beispielstadt), ZF_OUT (Ordner für Bilder der Stufen), ZF_FRAMES (Bilder je
// Richtung, Standard 120), ZF_SHOTS=0 (keine Stufenbilder), ZF_TAG (Präfix der Bilder).
// Gemessen je Bild: JS-Zeit der Darstellung (engine.frame), neu gebaute Prototypen und deren Bauzeit, Detailwechsel der
// Gebäude, Umschalten der Straßen-Kleinteile/Straßenbäume, Neuverteilungen der Pflanzen, neue Shader-Programme.
// SwiftShader sagt nichts über echte Bildraten – wichtig sind Spitzen der JS-Zeit und die Zahl der Umschaltereignisse.
import { readFileSync, mkdirSync } from 'node:fs';

const T0 = Date.now();
const log = (m) => { if (process.env.ZF_LOG) console.log(`[${((Date.now() - T0) / 1000).toFixed(0)} s] ${m}`); };
export default async function zoomfahrt(page, h) {
  const out = process.env.ZF_OUT || '';
  const tag = process.env.ZF_TAG || 'zf';
  const N = +(process.env.ZF_FRAMES || 60);
  const shots = process.env.ZF_SHOTS !== '0' && !!out;
  if (out) mkdirSync(out, { recursive: true });
  const res = {};
  // ZF_EMU=0: keine 60-B/s-Nachbildung; ZF_NOLOADER=1: ohne Ladebildschirm laden
  await page.evaluate(({ emu, nol, nochk }) => { window.ZF_EMU = emu; window.ZF_NOLOADER = nol; if (nochk) window.STADTPULS_SHADERCHECK = false; }, { emu: process.env.ZF_EMU !== '0', nol: process.env.ZF_NOLOADER === '1', nochk: process.env.ZF_NOCHECK === '1' });
  if (process.env.ZF_SAVE) {
    const txt = readFileSync(process.env.ZF_SAVE, 'utf8');
    // wie im Spiel: Ladebildschirm zeigen, dann laden; gemessen bis spielbereit (Ladebildschirm hält nicht mehr)
    res.load = await page.evaluate((t) => new Promise((resolve) => {
      const api = window.__stadtpulsLoaderApi;
      if (api && !window.ZF_NOLOADER) api.show('Spielstand wird geladen');
      requestAnimationFrame(() => setTimeout(() => {
        const t0 = performance.now();
        window.__stadtpuls.loadData(t, { quiet: true });
        const en = window.__stadtpuls.engine;
        const syncMs = Math.round(performance.now() - t0);
        let frames = 0, maxGap = 0, last = performance.now();
        const wait = () => {
          const now = performance.now(); maxGap = Math.max(maxGap, now - last); last = now; frames++;
          if (en.warming && now - t0 < 60000) { requestAnimationFrame(wait); return; }
          resolve({ syncMs, readyMs: Math.round(now - t0), framesWhileLoading: frames, maxGapWhileLoading: Math.round(maxGap), parts: en && en.loadTimes ? en.loadTimes : null });
        };
        requestAnimationFrame(wait);
      }, 0));
    }), txt);
    // erste Bilder nach dem Laden (Einflug): Bildzeit-Spitzen messen
    console.log('LADEN ' + JSON.stringify(res.load));
    res.afterLoad = await page.evaluate(() => new Promise((resolve) => {
      const ts = []; let last = performance.now(); let n = 0;
      const step = () => { const now = performance.now(); ts.push(now - last); last = now; if (++n < 40) requestAnimationFrame(step); else resolve({ maxMs: Math.round(Math.max(...ts.slice(1))), sumMs: Math.round(ts.reduce((a, b) => a + b, 0)) }); };
      requestAnimationFrame(step);
    }));
    await h.wait(1500);
  }
  await page.evaluate(() => {
    const app = window.__stadtpuls, en = app.engine, g = app.game;
    document.getElementById('modal-root').innerHTML = '';
    if (app.ui) app.ui.modalQueue = [];
    g.speed = 0;
    // Mittelpunkt der dichtesten Bebauung
    let sx = 0, sz = 0, n = 0;
    for (const b of g.buildings.values()) if ((b.level || 1) >= 3) { sx += b.x + b.w / 2; sz += b.y + b.h / 2; n++; }
    const cx = n ? sx / n - g.W / 2 : 0, cz = n ? sz / n - g.H / 2 : 0;
    const rig = en.rig;
    rig.flight = null;
    rig.goal.x = cx; rig.goal.z = cz; rig.goal.yaw = 0.6;
    rig.goal.dist = 120; rig.goal.pitch = 1.1;
    rig.zoomTo(120);
    rig.cur = { ...rig.goal };
    const S = window.__zf = { frames: [], cur: null, idle: { builds: 0, ms: 0 }, rec: false };
    const bv = en.buildings, pm = bv.protoMgr;
    const get = pm.get.bind(pm);
    pm.get = function (...a) {
      const n0 = pm.protos.size, t0 = performance.now();
      const r = get(...a);
      if (pm.protos.size > n0 && S.rec) { const dt = performance.now() - t0; if (S.cur) { S.cur.builds++; S.cur.buildMs += dt; } else { S.idle.builds++; S.idle.ms += dt; } }
      return r;
    };
    const show = bv._show.bind(bv);
    bv._show = function (rec, ...a) { const b0 = rec.shown; const r = show(rec, ...a); if (S.cur && b0 >= 0 && rec.shown !== b0) S.cur.sw++; return r; };
    const ps = en.roads.props;
    const ss = ps.setState.bind(ps);
    ps.setState = function (d, nn, ni) { const st = ps.state; if (S.cur) { if (st.detail !== d) S.cur.roadDet++; if (st.near !== nn) S.cur.treeNear++; } return ss(d, nn, ni); };
    const veg = en.terrain.veg;
    if (veg) {
      const al = veg.assignLOD.bind(veg);
      veg.assignLOD = function (f) { const k = veg.lodKey; const r = al(f); if (S.cur && veg.lodKey !== k) S.cur.veg++; return r; };
      const un = veg.updateNear.bind(veg);
      veg.updateNear = function (f) { const k = veg.nearKey; const r = un(f); if (S.cur && veg.nearKey !== k) S.cur.grass++; return r; };
    }
    const ef = en.frame.bind(en);
    // Gerät mit 60 Bildern/s nachstellen (Standard): Zeitbudgets, Überblendungen und Takte wie auf dem iPad, obwohl
    // SwiftShader Sekunden pro Bild braucht (sonst greift der Nachholmodus für sehr langsame Bilder)
    const emu = window.ZF_EMU !== false;
    en.frame = function (dt, sdt) {
      if (emu) { const n = performance.now(); bv.lastFrame = n - 16.7; en._lastNow = n - 16.7; en.realDt = 1 / 60; dt = 1 / 60; }
      const t0 = performance.now();
      S.cur = { builds: 0, buildMs: 0, sw: 0, roadDet: 0, treeNear: 0, veg: 0, grass: 0 };
      const sk = en._shadowKey ? en._shadowKey.split(',')[2] : '';
      ef(dt, sdt);
      const c = S.cur;
      c.ms = performance.now() - t0;
      c.dist = en.rig.cur.dist;
      c.prog = en.renderer.info.programs ? en.renderer.info.programs.length : 0;
      c.shadowSize = en._shadowKey ? en._shadowKey.split(',')[2] !== sk : false;
      c.calls = en.renderer.info.render.calls;
      if (en.lodEvents) c.ev = en.lodEvents();
      S.cur = null;
      if (S.rec) S.frames.push(c);
    };
  });
  // Einschwingen auf 120
  await page.evaluate(() => { const en = window.__stadtpuls.engine; if (en.buildings.settle) en.buildings.settle(); });
  const frames = (n) => page.evaluate((n) => new Promise((r) => { let k = 0; const s = () => (++k > n ? r() : requestAnimationFrame(s)); requestAnimationFrame(s); }), n);
  const shotAt = async (name) => { if (shots) { const t0 = Date.now(); await page.screenshot({ path: `${out}/${tag}-${name}.png`, timeout: 300000 }); log('Bild ' + name + ' ' + (Date.now() - t0) + ' ms'); } };
  const settleAt = async (d, n = 6) => {
    await page.evaluate((d) => { const rig = window.__stadtpuls.engine.rig; rig.zoomTo(d); rig.cur = { ...rig.goal }; }, d);
    await frames(n);
  };
  // Messfahrten im kleinen Fenster (SwiftShader rechnet sonst Minuten pro Fahrt), Bilder groß
  const small = { width: +(process.env.ZF_W || 480), height: +(process.env.ZF_H || 270) };
  await page.setViewportSize(small);
  await settleAt(120, 10);
  // Fahrt 120 → 6 → 120 (logarithmisch, ein Schritt je Bild)
  const ride = (from, to, n) => page.evaluate(({ from, to, n }) => new Promise((resolve) => {
    const en = window.__stadtpuls.engine, rig = en.rig;
    let k = 0;
    const step = () => {
      const t = Math.min(1, k / n);
      rig.zoomTo(Math.exp(Math.log(from) + (Math.log(to) - Math.log(from)) * t));
      if (++k > n + 6) resolve(); else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }), { from, to, n });
  log('Fahrt startet');
  await page.evaluate(() => { window.__zf.rec = true; window.__zf.frames = []; window.__zf.progs = new Set(window.__stadtpuls.engine.renderer.info.programs.map((p) => p.id)); });
  await ride(120, 6, N);
  await ride(6, 120, N);
  const zoom = await page.evaluate(() => {
    const S = window.__zf; S.rec = false;
    const fresh = window.__stadtpuls.engine.renderer.info.programs.filter((p) => !S.progs.has(p.id)).map((p) => p.name + ':' + String(p.cacheKey).replace(/[\s,]+/g, ' ').slice(0, 90));
    return { frames: S.frames, idle: S.idle, fresh };
  });
  res.ride = summarize(zoom.frames, zoom.idle);
  res.ride.freshPrograms = zoom.fresh;
  log('Fahrt fertig ' + JSON.stringify(res.ride));
  // Langsames Hin und Her an den Schwellen (Flackern): 2 Runden je Schwelle
  if (process.env.ZF_PENDEL === '1' || (process.env.ZF_PENDEL !== '0' && !process.env.ZF_SAVE)) {
    await page.evaluate(() => { window.__zf.rec = true; window.__zf.frames = []; window.__zf.idle = { builds: 0, ms: 0 }; });
    for (const [a, b] of [[40, 48], [12, 15], [28, 36], [52, 64]]) {
      await settleAt(a); await frames(4);
      await page.evaluate(() => { window.__zf.frames = []; });
      for (let r = 0; r < 2; r++) { await ride(a, b, 12); await ride(b, a, 12); }
      const f = await page.evaluate(() => window.__zf.frames);
      res[`pendel_${a}_${b}`] = summarize(f, { builds: 0, ms: 0 }, true);
      log('Pendel ' + a + '-' + b);
    }
    await page.evaluate(() => { window.__zf.rec = false; });
  }
  if (shots) {
    await page.setViewportSize({ width: +(process.env.ZF_SW || 960), height: +(process.env.ZF_SH || 540) });
    for (const d of [120, 40, 16, 7]) {
      await settleAt(d, 2);
      await page.evaluate(() => { const en = window.__stadtpuls.engine; en.snap(); en.buildings.settle(); });
      await frames(3);
      await shotAt('stufe-' + d);
    }
  }
  res.stats = await page.evaluate(() => { const en = window.__stadtpuls.engine; return { ...en.buildings.stats(), quality: en.quality && en.quality.name, pr: en.pixelRatio }; });
  console.log('ZOOMFAHRT ' + JSON.stringify(res));
}

function summarize(fr, idle, short = false) {
  const ms = fr.map((f) => f.ms).sort((a, b) => a - b);
  const q = (p) => (ms.length ? ms[Math.min(ms.length - 1, Math.floor(ms.length * p))] : 0);
  const sum = (k) => fr.reduce((a, f) => a + (typeof f[k] === 'number' ? f[k] : f[k] ? 1 : 0), 0);
  const r = {
    frames: fr.length, medMs: +q(0.5).toFixed(1), p95Ms: +q(0.95).toFixed(1), maxMs: +q(1).toFixed(1),
    over50: fr.filter((f) => f.ms > 50).length,
    builds: sum('builds'), buildMs: Math.round(sum('buildMs')), maxBuildMs: Math.round(Math.max(0, ...fr.map((f) => f.buildMs))),
    switches: sum('sw'), roadDet: sum('roadDet'), treeNear: sum('treeNear'), veg: sum('veg'), grass: sum('grass'), shadowSize: sum('shadowSize'),
    newPrograms: fr.length ? fr[fr.length - 1].prog - fr[0].prog : 0, idleBuilds: idle.builds, idleMs: Math.round(idle.ms),
    maxCalls: Math.max(0, ...fr.map((f) => f.calls)),
  };
  if (!short) r.maxSwitchFrame = Math.max(0, ...fr.map((f) => f.sw));
  return r;
}
