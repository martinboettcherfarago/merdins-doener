// Ruckel-Messung (Bildzeit-Spitzen, Detailstufen, Zeit bis zum vollen Detail) als --eval-Modul für tools/shot.mjs.
// Stellt ein iPad nach (Querformat, Pixelverhältnis 2, Berührung, Grafikstufe „Automatisch", Safari ohne requestIdleCallback)
// und spielt realistische Bedienung durch: Heranzoomen bis Straßenhöhe und zurück, Schwenken in mehreren Höhen, Drehen,
// Untergrund-Ansicht an/aus, laufende Zeit (auch schnell). Gemessen wird je Bild die JS-Zeit (gesamt, Simulation,
// Verkehr, Darstellung je Teil), lange Bilder, Prototyp-Bauten, neue Shader-Programme, Hochladen in die GPU,
// Detailwechsel je Gebäude (Pendeln) und die Zeit, bis nach dem Anhalten der Kamera alle Nahdetails stehen.
//
//   node tools/shot.mjs --scenario menu --ua ipad --dpr 2 --gpu "Apple GPU" --w 1180 --h 820 --quality auto \
//     --eval tools/ruckel.mjs --out /tmp/rk.png
// Umgebung: RK_SAVE (Spielstand, Standard saves/megastadt.json), RK_PHASES (Komma-Liste, Standard alle: idle,zoomin,hold,
//   panlow,zoomout,panmid,rotate,ug,time,pendel), RK_W/RK_H (Messfenster, Standard 295×205 – SwiftShader ist sonst zu
//   langsam; JS-Zeit hängt kaum an der Auflösung), RK_SHEET=<datei.png> (Kontaktbogen der Zoomfahrt, Bild für Bild aus
//   dem echten Zeichenpuffer; RK_SHEET_W/H Fenstergröße, RK_SHEET_EVERY jedes n-te Bild), RK_JSON=<datei> (alle Bilder),
//   RK_CHECK=1 (Grenzwerte prüfen, Prozess endet mit Code 1 bei Verstoß; siehe check() und test/ruckel-check.sh),
//   RK_RIC=1 (requestIdleCallback behalten), RK_GOV=1 (Regelung „Automatisch" nicht festhalten).
// Fehlersuche: RK_SWLOG=1 (Wechsel und Flackern je Gebäude), RK_DLOG=1 (Verlauf bis zum vollen Detail), RK_UPSTACK=1
//   (Herkunft der GPU-Uploads, Programmwahl je Material), RK_ALLOC=1 (Speicherbelegung nach Aufrufstelle).
// Kennzahlen je Abschnitt: medMs/p95Ms/maxMs (Bildzeit), jsP95Ms/jsMaxMs/jsOver (ohne Warten auf den GPU-Prozess, den
//   hier SwiftShader stellt), switches/swDown/oscill (Detailwechsel), flips (sichtbar hin und zurück binnen 1 s gegen den
//   Abstand), uploadKB, progs (neue Shader-Programme), allocMB/gcDrops; je Halt msToFull (alles im Bild fertig) und
//   msToAll (auch der unsichtbare Rand), near2/at2 und near1/at1 (Gebäude im Bild nahe genug für Detail 2/≥ 1 bzw. mit).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const env = process.env;
const T0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)} s] ${m}`);

export default async function ruckel(page, h) {
  const save = env.RK_SAVE || 'saves/megastadt.json';
  const phases = (env.RK_PHASES || 'idle,zoomin,hold,panlow,zoomout,panmid,rotate,ug,time,pendel').split(',').map((s) => s.trim()).filter(Boolean);
  // Safari (iPad) kennt kein requestIdleCallback: Leerlaufarbeit läuft dort über setTimeout – wie beim Spieler messen
  if (env.RK_RIC !== '1') await page.evaluate(() => { try { delete window.requestIdleCallback; window.requestIdleCallback = undefined; } catch (e) { window.requestIdleCallback = undefined; } });
  await page.evaluate(() => { window.STADTPULS_SHADERCHECK = false; });
  // Zeichenbefehle ohne Pixel (RK_NODRAW, Standard an): Alle WebGL-Aufrufe laufen wie beim Spieler (Zustände, Uniforms,
  // Uploads, Shader), nur die Zeichenbefehle bekommen 0 Ecken – SwiftShader müsste sonst Sekunden je Bild rastern.
  // Bilder für Kontaktbögen zeichnen echt (R.real).
  await page.evaluate((nodraw) => {
    const R = window.__rk = { rec: false, emu: true, freeze: false, frames: [], cur: null, n: 0, script: null, sw: new Map(), phase: '', nodraw, real: false };
    for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
      if (!C) continue;
      const P = C.prototype;
      const z = (name, idx) => {
        const f = P[name];
        if (typeof f !== 'function' || f.__rkz) return;
        const w = function (...a) { if (R.nodraw && !R.real) a[idx] = 0; return f.apply(this, a); };
        w.__rkz = true;
        P[name] = w;
      };
      z('drawElements', 1); z('drawArrays', 2); z('drawElementsInstanced', 1); z('drawArraysInstanced', 2); z('drawRangeElements', 3);
    }
  }, env.RK_NODRAW !== '0');
  const txt = readFileSync(save, 'utf8');
  await page.waitForFunction(() => { const el = document.getElementById('loader'); return window.__stadtpuls.mode === 'menu' && (!el || el.hidden); }, null, { timeout: 120000 }).catch(() => {});
  log('lade ' + save);
  const load = await page.evaluate((t) => new Promise((resolve) => {
    const api = window.__stadtpulsLoaderApi;
    if (api) api.show('Spielstand wird geladen');
    requestAnimationFrame(() => setTimeout(() => {
      const t0 = performance.now();
      window.__stadtpuls.loadData(t, { quiet: true });
      const syncMs = Math.round(performance.now() - t0);
      const en = window.__stadtpuls.engine;
      const wait = () => { if (en.warming && performance.now() - t0 < 120000) { setTimeout(wait, 50); return; } resolve({ syncMs, readyMs: Math.round(performance.now() - t0) }); };
      wait();
    }, 0));
  }), txt);
  log('geladen ' + JSON.stringify(load));
  await h.wait(1500);
  const dev = await page.evaluate(() => {
    const en = window.__stadtpuls.engine, d = en.device, q = en.quality;
    return { kind: d && d.kind, start: d && d.start, best: d && d.best, name: d && d.name, rung: en.gov && en.gov.rung, pr: en.pixelRatio, shadow: q.shadow, ao: q.ao, bloom: q.bloom, msaa: q.msaa, lod: q.lod, ric: typeof window.requestIdleCallback };
  });
  log('Gerät ' + JSON.stringify(dev));

  // ---------------------------------------------------------------- Messpunkte im Spiel einhängen
  await page.evaluate((upstack) => {
    const app = window.__stadtpuls, en = app.engine, g = app.game, bv = en.buildings, pm = bv.protoMgr, r = en.renderer;
    document.getElementById('modal-root').innerHTML = '';
    if (app.ui) app.ui.modalQueue = [];
    const R = window.__rk;
    // Regelung „Automatisch" auf der Startstufe des Geräts festhalten (ohne echte GPU-Zeiten wäre jede Entscheidung
    // zufällig); ihr Verhalten prüfen tools/geraet.mjs und test/autoq-test.mjs
    if (en.gov && !window.RK_GOV) en.gov.fixed = true;
    if (upstack) R.upstack = new Map();
    const T =(obj, name, key) => {
      if (!obj || typeof obj[name] !== 'function' || obj[name].__rk) return;
      const f = obj[name];
      const w = function (...a) {
        const c = R.cur;
        if (!c) return f.apply(this, a);
        const t0 = performance.now();
        try { return f.apply(this, a); } finally { c[key] = (c[key] || 0) + performance.now() - t0; }
      };
      w.__rk = true;
      obj[name] = w;
    };
    // Simulation
    T(g, 'update', 'sim'); T(g, '_pump', 'job'); T(g, 'simStep', 'step'); T(g, 'hourly', 'hourly'); T(g, 'daily', 'daily'); T(g, 'weekly', 'weekly');
    T(g.traffic, 'update', 'traffic'); T(g.transit, 'update', 'transitSim'); T(g.traffic, 'hourly', 'trafficHourly');
    // Darstellung
    T(en, 'frame', 'eng'); T(bv, 'frame', 'bld'); T(en.vehicles, 'frame', 'veh'); T(en.transit, 'frame', 'trn'); T(en.underground, 'frame', 'ug');
    T(en.effects, 'frame', 'fx'); T(en.effects, 'updateIcons', 'icons'); T(en.rig, 'update', 'rig'); T(en, 'dayNight', 'sky'); T(en, 'fitShadow', 'shadowFit');
    T(en, 'precompileIdle', 'pcIdle'); T(en, 'applyQuality', 'applyQ');
    // RK_DLOG: nach jeder Entscheidung die offenen Wechsel nach Art zählen (Richtung, Sichtklasse, Obergrenze)
    const dec = bv._lodDecide;
    bv._lodDecide = function (...a) {
      const res = dec.apply(this, a);
      if (R.dlogOn && R.settledAt !== undefined && R.fullAt === undefined) {
        const c = {};
        for (const rec of bv.recs.values()) {
          if (!rec.finished || !rec.p0 || rec.dead || rec.want === rec.shown) continue;
          const key = `${rec.shown}>${rec.want}${rec.sk < 1e3 ? 'r' : rec.sk < 1e4 ? 'm' : 'x'}${rec.capDown ? 'c' : ''}w${rec.wantD}`;
          c[key] = (c[key] || 0) + 1;
        }
        (R.dlog || (R.dlog = [])).push('E{' + Object.entries(c).map(([k, v]) => k + ':' + v).join(',') + '}');
      }
      return res;
    };
    T(bv, '_lodScan', 'lodScan'); T(bv, '_lodDecide', 'lodDecide'); T(bv, '_work', 'lodWork'); T(bv, '_buildSome', 'buildSome');
    T(bv, '_lightsFrame', 'bldLights'); T(bv, '_animate', 'bldAnim');
    if (en.roads) {
      T(en.roads, 'tick', 'roads'); T(en.roads, 'rebuild', 'roadsRebuild'); T(en.roads, 'buildChunk', 'roadsChunk'); T(en.roads, 'finishCtx', 'roadsFinish'); T(en.roads, 'afterChunks', 'roadsAfter');
      if (en.roads.props) { T(en.roads.props, 'setState', 'props'); T(en.roads.props, 'commit', 'propsCommit'); }
    }
    if (en.terrain) { T(en.terrain, 'frame', 'terrain'); if (en.terrain.veg) T(en.terrain.veg, 'frame', 'veg'); }
    for (const v of en.views) T(v, 'frame', 'view:' + (v.constructor && v.constructor.name));
    const life = en.views.find((v) => v.constructor && v.constructor.name === 'LifeView');
    if (life) { T(life, 'computeWeights', 'lifeW'); T(life, 'buildCandidates', 'lifeCand'); if (life.walk) T(life.walk, 'rebuild', 'lifeWalk'); for (const k of ['peds', 'bikes', 'parked', 'boats', 'sky']) if (life[k]) T(life[k], 'update', 'life:' + k); }
    if (app.ui) { T(app.ui, 'update', 'ui'); if (app.ui.minimap) T(app.ui.minimap, 'update', 'minimap'); }
    if (app.audio) T(app.audio, 'update', 'audio');
    T(app, 'save', 'autosave');
    // Zeichnen (Abgabe der Zeichenbefehle)
    if (en.post) T(en.post, 'render', 'draw'); else T(r, 'render', 'draw');
    // RK_UPSTACK: wie oft three.js je Material die Programmwahl neu berechnet (getParameters ruft
    // customProgramCacheKey auf) – häufiger Wechsel Instanz/ohne Instanz kostet Zeit und Speicher
    if (upstack) {
      const seen = new WeakSet();
      R.progCount = new Map();
      const wrapMat = (m) => {
        if (!m || seen.has(m)) return;
        seen.add(m);
        const f = m.customProgramCacheKey;
        const name = (m.name || m.type) + (m.defines && m.defines.G9_GLASS !== undefined ? '+g' : '') + (m.defines && m.defines.RF_FADE !== undefined ? '+rf' : '');
        m.customProgramCacheKey = function () { if (R.rec) R.progCount.set(name, (R.progCount.get(name) || 0) + 1); return f.call(this); };
      };
      const sweep = () => en.scene.traverse((o) => { for (const m of [].concat(o.material || [])) wrapMat(m); wrapMat(o.customDepthMaterial); });
      sweep();
      R.sweep = sweep;
    }
    // RK_UPSTACK: vor dem Zeichnen alle Puffer der Szene prüfen, deren Version sich geändert hat (= werden hochgeladen),
    // und nach Besitzer zusammenzählen
    if (upstack) {
      const owner = (o) => {
        const parts = [];
        for (let p = o, k = 0; p && k < 3; p = p.parent, k++) parts.push(p.name || (p.isInstancedMesh ? 'IM' : p.isPoints ? 'Pts' : p.isMesh ? 'Mesh' : p.type));
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        return parts.join('<') + ' [' + ((m && (m.name || m.type)) || '-') + ']';
      };
      const scan = () => {
        for (const sc of [en.scene, en.hud, en.underground && en.underground.scene, en.sky && en.sky.envScene].filter(Boolean)) sc.traverse((o) => {
          const attrs = [];
          if (o.geometry && o.geometry.attributes) for (const a of Object.values(o.geometry.attributes)) attrs.push(a);
          if (o.geometry && o.geometry.index) attrs.push(o.geometry.index);
          if (o.isInstancedMesh) { attrs.push(o.instanceMatrix); if (o.instanceColor) attrs.push(o.instanceColor); }
          for (const a of attrs) {
            if (!a || a.isInterleavedBufferAttribute || a.version === a.__rkv) continue;
            const fresh = a.__rkv === undefined;
            a.__rkv = a.version;
            if (fresh) continue;
            const bpe = a.array.BYTES_PER_ELEMENT;
            const rs = a.updateRanges || [];
            const b = rs.length ? rs.reduce((s, x) => s + x.count, 0) * bpe : a.array.byteLength;
            const k = owner(o);
            const u = R.upstack.get(k) || { kb: 0, n: 0, ms: 0 };
            u.kb += b / 1024; u.n++;
            R.upstack.set(k, u);
          }
        });
      };
      const pr = en.post || r;
      const f0 = pr.render;
      pr.render = function (...a) { if (R.rec) { scan(); if (R.sweep && R.n % 30 === 0) R.sweep(); } return f0.apply(this, a); };
    }
    // Prototyp-Bauten
    const get = pm.get;
    pm.get = function (...a) {
      const n0 = pm.protos.size, t0 = performance.now();
      const res = get.apply(this, a);
      if (pm.protos.size > n0) { const dt = performance.now() - t0; const c = R.cur || R.idle; if (R.rec) (R.blog || (R.blog = [])).push([a[0], a[1], a[6], +dt.toFixed(1), !!R.cur]); if (c) { c.builds = (c.builds || 0) + 1; c.buildMs = (c.buildMs || 0) + dt; c.maxBuild = Math.max(c.maxBuild || 0, dt); } else { R.outside = (R.outside || 0) + dt; R.outsideMax = Math.max(R.outsideMax || 0, dt); } }
      return res;
    };
    // Sichtprüfung im Werkzeug selbst (gilt auch für den Vorher-Bau ohne _inView): Kugel des Gebäudes gegen die sechs
    // Ebenen des Bildkegels (wie THREE.Frustum.setFromProjectionMatrix)
    R.camPlanes = () => {
      const cam = en.camera;
      cam.updateMatrixWorld();
      const M = R._PM || (R._PM = new cam.projectionMatrix.constructor());
      const m = M.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).elements;
      const P = R._P || (R._P = [[], [], [], [], [], []]);
      const set = (p, a, b, c, d) => { const l = Math.hypot(a, b, c); p[0] = a / l; p[1] = b / l; p[2] = c / l; p[3] = d / l; };
      set(P[0], m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]); set(P[1], m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]);
      set(P[2], m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]); set(P[3], m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]);
      set(P[4], m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]); set(P[5], m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]);
      return P;
    };
    R.inCam = (P, rec) => {
      const x = rec.ox, y = rec.height * 0.5, z = rec.oz, r = Math.max(rec.radius || 0, rec.height * 0.6) + 0.3;
      for (const p of P) if (p[0] * x + p[1] * y + p[2] * z + p[3] < -r) return false;
      return true;
    };
    // Stufe nach Abstand (mit Hysterese wie die Ansicht): wantD der neuen Fassung, für den Vorher-Bau nachgerechnet
    R.distLevel = (rec, cur) => {
      if (rec.wantD !== undefined) return rec.wantD;
      const [t2, t1] = bv._thresholds(), d = bv._distance(rec);
      return d < (cur === 2 ? t2 * 1.1 : t2 * 0.93) ? 2 : d < (cur >= 1 ? t1 * 1.1 : t1 * 0.93) ? 1 : 0;
    };
    // Detailwechsel je Gebäude: Anzahl und Richtung (abwärts beim Heranzoomen = Pendeln/Tauschen)
    const show = bv._show;
    bv._show = function (rec, d, ...a) {
      const b0 = rec.shown;
      const res = show.call(this, rec, d, ...a);
      if (R.rec && b0 >= 0 && rec.shown !== b0) {
        R.sw.set(rec.id, (R.sw.get(rec.id) || 0) + 1);
        const L = R.swLog || (R.swLog = new Map()); const l = L.get(rec.id) || []; if (l.length < 24) l.push(`${R.n}:${b0}>${rec.shown}${rec.vis === false ? "u" : ""}@${(rec.dist || 0).toFixed(1)}[${rec.sk < 1e3 ? 'r' : rec.sk < 1e4 ? 'm' : 'x'}${rec.locked ? 'L' : ''}${rec.capDown ? 'c' : ''}${rec.wantD}]`); L.set(rec.id, l);
        if (R.cur) { R.cur.sw = (R.cur.sw || 0) + 1; if (rec.shown < b0) R.cur.swDown = (R.cur.swDown || 0) + 1; }
        // Flackern: sichtbarer Wechsel, der den vorigen (ebenfalls sichtbaren) Wechsel desselben Gebäudes binnen einer
        // Sekunde (60 Bilder, bei gleichem Kamerazustand) umkehrt, und zwar gegen den Abstand – nur wegen Obergrenzen/Sicht abgewertet (wantD ≥ alte
        // Stufe) bzw. nach einer solchen Abwertung gleich wieder hinauf. Wechsel, die der Abstand verlangt (Kamera kreist
        // schnell um einen Punkt), zählen nicht. Sichtbar = Kugel des Gebäudes im echten Bildkegel der Kamera.
        const seen = R.inCam(R.camPlanes(), rec);
        const P = R.swPrev || (R.swPrev = new Map()), dir = rec.shown > b0 ? 1 : -1, pv = P.get(rec.id);
        const txt = `${R.n}:${b0}>${rec.shown}@${(rec.dist || 0).toFixed(1)}[${rec.sk < 1e3 ? 'r' : rec.sk < 1e4 ? 'm' : 'x'}${rec.locked ? 'L' : ''}${rec.capDown ? 'c' : ''}${rec.wantD}]`;
        const capDriven = dir < 0 && R.distLevel(rec, b0) >= b0;
        // (ein Wechsel während der Fahrt und einer nach dem Anhalten sind Einschwingen, kein Flackern)
        const calm = !!(en.cameraCalm && en.cameraCalm());
        if (pv && pv.dir !== dir && pv.seen && seen && pv.calm === calm && R.n - pv.n < 60 && R.cur && (dir < 0 ? capDriven : pv.capDriven)) {
          R.cur.flip = (R.cur.flip || 0) + 1;
          const FL = R.flipLog || (R.flipLog = []); if (FL.length < 8) FL.push(`${rec.id}: ${pv.txt} → ${txt}`);
        }
        P.set(rec.id, { n: R.n, dir, seen, txt, capDriven, calm });
      }
      return res;
    };
    // GPU-Uploads und Shader-Wartezeiten (WebGL-Aufrufe zählen)
    const gl = r.getContext();
    const P = Object.getPrototypeOf(gl);
    const bytes = (x) => (x && x.byteLength) || 0;
    const wrapGL = (name, key, sizeFn) => {
      const f = P[name];
      if (typeof f !== 'function' || f.__rk) return;
      const w = function (...a) {
        const c = R.cur;
        if (!c) return f.apply(this, a);
        const t0 = performance.now();
        try { return f.apply(this, a); } finally {
          const dt = performance.now() - t0;
          c[key + 'Ms'] = (c[key + 'Ms'] || 0) + dt; c[key + 'N'] = (c[key + 'N'] || 0) + 1;
          if (sizeFn) {
            const kb = sizeFn(a) / 1024;
            c[key + 'KB'] = (c[key + 'KB'] || 0) + kb;
            // RK_UPSTACK: Herkunft der Uploads (Aufrufstelle außerhalb von three.js) aufsummieren
            if (R.upstack && R.rec && key.startsWith('tex')) {
              const st = (new Error().stack || '').split('\n').slice(2).map((l) => l.trim().replace(/^at /, '').replace(/ \(.*\)$/, '')).filter((l) => !/^(w|Object\.w|WebGL2RenderingContext\.w|eval)$/.test(l)).slice(0, +R.upstackDepth || 7).join(' < ');
              const k = key + ' ' + st.replace(/https?:\/\/[^/]+\//g, '');
              const u = R.upstack.get(k) || { kb: 0, n: 0, ms: 0 };
              u.kb += kb; u.n++; u.ms += dt;
              R.upstack.set(k, u);
            }
          }
        }
      };
      w.__rk = true;
      P[name] = w;
    };
    wrapGL('bufferData', 'buf', (a) => (typeof a[1] === 'number' ? a[1] : bytes(a[1])));
    wrapGL('bufferSubData', 'bufSub', (a) => (a.length >= 5 && a[4] ? a[4] * ((a[2] && a[2].BYTES_PER_ELEMENT) || 1) : bytes(a[2])));
    wrapGL('texImage2D', 'tex', (a) => bytes(a[a.length - 1]) || (a.length >= 9 ? a[3] * a[4] * 4 : 0));
    wrapGL('texSubImage2D', 'texSub', (a) => bytes(a[8]) || bytes(a[6]));
    wrapGL('texImage3D', 'tex3', (a) => bytes(a[9]));
    wrapGL('texStorage2D', 'texSt', (a) => a[3] * a[4] * 8);
    wrapGL('renderbufferStorageMultisample', 'rbo', (a) => a[3] * a[4] * 8 * a[1]);
    wrapGL('getProgramParameter', 'prog');
    wrapGL('getShaderParameter', 'shd');
    wrapGL('getActiveUniform', 'uni');
    wrapGL('getActiveAttrib', 'att');
    wrapGL('linkProgram', 'link');
    wrapGL('compileShader', 'cmp');
    wrapGL('finish', 'finish');
    wrapGL('readPixels', 'read');
    // Bildschleife: 60-B/s-Gerät nachstellen (dt = 1/60, Zeitbudgets wie auf dem iPad), Bild für Bild aufzeichnen
    const of = app.frame;
    const veg = en.terrain && en.terrain.veg, props = en.roads && en.roads.props;
    app.frame = function (now) {
      if (R.freeze) { requestAnimationFrame((t) => app.frame(t)); return; }
      if (R.script) { try { R.script(R.n); } catch (e) { R.scriptErr = String(e); R.script = null; } }
      R.real = !!(R.wantReal && R.wantReal(R.n));
      // Wochenkarten und Ereignisse wie ein Spieler sofort beantworten (sonst steht die Simulation)
      if (g.pendingCards || g.pendingEvent) { try { if (g.pendingCards) g.chooseCard(g.pendingCards[0]); if (g.pendingEvent) g.resolveEvent(0); document.getElementById('modal-root').innerHTML = ''; if (app.ui) app.ui.modalQueue = []; } catch (e) { /* egal */ } }
      if (R.emu) { app.last = now - 1000 / 60; app.lastInput = performance.now(); const n = performance.now(); en._lastNow = n - 16.7; en.realDt = 1 / 60; bv.lastFrame = n - 16.7; }
      const c = { n: R.n, ph: R.phase };
      R.cur = c;
      const ev0 = bv.ev.switches, rd0 = en.roads ? en.roads.lodEvents : 0, pr0 = r.info.programs ? r.info.programs.length : 0;
      const vk = veg ? veg.lodKey : null, nk = veg ? veg.nearKey : null, ps = props && props.state ? `${props.state.detail}|${props.state.near}` : '';
      const t0 = performance.now();
      try { of.call(app, now); } finally {
        c.ms = performance.now() - t0;
        R.cur = null;
      }
      c.dist = +en.rig.cur.dist.toFixed(2);
      c.prog = (r.info.programs ? r.info.programs.length : 0) - pr0;
      c.roadEv = (en.roads ? en.roads.lodEvents : 0) - rd0;
      if (veg && (veg.lodKey !== vk || veg.nearKey !== nk)) c.veg = 1;
      if (props && props.state && `${props.state.detail}|${props.state.near}` !== ps) c.props = 1;
      c.calls = r.info.render.calls;
      c.tris = r.info.render.triangles;
      c.fading = bv.fading.size; c.need = bv.need.size; c.lodLeft = bv.lodList.length - bv.lodPos; c.queue = bv.queue.size;
      c.rung = en.gov ? en.gov.rung : -1;
      c.calm = en.cameraCalm() ? 1 : 0;
      if (performance.memory) c.heap = performance.memory.usedJSHeapSize;
      if (R.rec) R.frames.push(c);
      if (R.capture) R.capture(c);
      R.n++;
    };
  }, env.RK_UPSTACK === '1');

  // ---------------------------------------------------------------- Hilfen
  const frames = (n) => page.evaluate((n) => new Promise((res) => { const R = window.__rk; const end = R.n + n; const s = () => (R.n >= end ? res() : requestAnimationFrame(s)); requestAnimationFrame(s); }), n);
  // Ein Skript läuft im Spiel Bild für Bild (k = Bild seit Start), bis es true zurückgibt
  const run = (phase, src, arg, maxFrames = 2000) => page.evaluate(({ phase, src, arg, maxFrames }) => new Promise((resolve) => {
    const R = window.__rk, app = window.__stadtpuls, en = app.engine, rig = en.rig, g = app.game;
    const fn = new Function('k', 'en', 'rig', 'g', 'arg', 'R', src);
    const start = R.n;
    R.phase = phase;
    let done = false;
    R.script = (n) => { const k = n - start; if (done) return; if (k >= maxFrames || fn(k, en, rig, g, arg, R)) { done = true; } };
    const poll = () => { if (done || R.scriptErr) { R.script = null; resolve(R.scriptErr || null); } else setTimeout(poll, 30); };
    poll();
  }), { phase, src, arg, maxFrames });
  const settleCam = (d, x, z, yaw, pitchOff = 0) => page.evaluate(({ d, x, z, yaw, pitchOff }) => {
    const en = window.__stadtpuls.engine, rig = en.rig;
    rig.flight = null;
    if (x !== undefined) { rig.goal.x = x; rig.goal.z = z; }
    if (yaw !== undefined) rig.goal.yaw = yaw;
    rig.zoomTo(d);
    if (pitchOff) rig.goal.pitch += pitchOff;
    rig.cur = { ...rig.goal };
  }, { d, x, z, yaw, pitchOff });

  // Mittelpunkt der dichtesten Bebauung und eine Schwenkroute
  const geo = await page.evaluate(() => {
    const g = window.__stadtpuls.game;
    let sx = 0, sz = 0, n = 0;
    for (const b of g.buildings.values()) if ((b.level || 1) >= 3) { sx += b.x + b.w / 2; sz += b.y + b.h / 2; n++; }
    return { cx: n ? sx / n - g.W / 2 : 0, cz: n ? sz / n - g.H / 2 : 0, W: g.W, H: g.H, pop: g.stats.pop, buildings: g.buildings.size, cars: g.traffic.cars.length };
  });
  log('Stadt ' + JSON.stringify(geo));
  await page.evaluate(() => { window.__stadtpuls.game.speed = 1; });
  await settleCam(120, geo.cx, geo.cz, 0.6);

  // Kontaktbogen: Zoomfahrt in größerem Fenster, jedes n-te Bild aus dem Zeichenpuffer in einen Bogen kopieren
  if (env.RK_SHEET) {
    const sw = +(env.RK_SHEET_W || 472), sh = +(env.RK_SHEET_H || 328);
    await page.setViewportSize({ width: sw, height: sh });
    await settleCam(120, geo.cx, geo.cz, 0.6);
    await page.evaluate(() => { const en = window.__stadtpuls.engine; en.snap(); en.buildings.settle(); });
    await frames(8);
    const every = +(env.RK_SHEET_EVERY || 6), cols = +(env.RK_SHEET_COLS || 6), N = +(env.RK_SHEET_N || 36);
    await page.evaluate(({ every, cols, N }) => {
      const R = window.__rk, en = window.__stadtpuls.engine, cv = en.renderer.domElement;
      const tw = 236, th = Math.round(tw * cv.height / cv.width);
      const sheet = document.createElement('canvas');
      sheet.width = tw * cols; sheet.height = (th + 14) * Math.ceil(N / cols);
      const ctx = sheet.getContext('2d');
      ctx.fillStyle = '#111'; ctx.fillRect(0, 0, sheet.width, sheet.height);
      ctx.font = '11px sans-serif';
      let i = 0;
      const k0 = R.n + 1;
      R.sheet = sheet;
      R.wantReal = (n) => n >= k0 && (n - k0) % every === 0 && (n - k0) / every < N;
      R.capture = (c) => {
        if (i >= N || !R.real) return;
        const x = (i % cols) * tw, y = Math.floor(i / cols) * (th + 14);
        ctx.drawImage(cv, x, y + 14, tw, th);
        const bv = en.buildings;
        let d2 = 0, d1 = 0; for (const rec of bv.recs.values()) { if (rec.shown === 2) d2++; else if (rec.shown === 1) d1++; }
        ctx.fillStyle = '#ddd';
        ctx.fillText(`#${c.n} d=${c.dist} D2:${d2} D1:${d1} ${c.ms.toFixed(0)}ms`, x + 3, y + 11);
        i++;
      };
    }, { every, cols, N });
    // Fahrt wie eine Zwei-Finger-Geste: 1,5 s von 120 auf 7, dann stehen lassen
    await run('sheet', `const n = 90; if (k <= n) { const t = k / n; rig.zoomTo(Math.exp(Math.log(120) + (Math.log(7) - Math.log(120)) * t)); } return k > n + 6 * ${N} - 90;`, null, 6 * N + 20);
    const url = await page.evaluate(() => { const R = window.__rk; R.capture = null; R.wantReal = null; R.real = false; return R.sheet.toDataURL('image/png'); });
    mkdirSync(dirname(resolve(env.RK_SHEET)), { recursive: true });
    writeFileSync(env.RK_SHEET, Buffer.from(url.split(',')[1], 'base64'));
    log('Kontaktbogen ' + env.RK_SHEET);
    await settleCam(120, geo.cx, geo.cz, 0.6);
  }

  // Messfenster (Seitenverhältnis wie das iPad)
  await page.setViewportSize({ width: +(env.RK_W || 295), height: +(env.RK_H || 205) });
  await frames(4);
  await page.evaluate(() => { const en = window.__stadtpuls.engine; en.snap(); en.buildings.settle(); });
  await frames(20);
  await page.evaluate(() => { window.__rk.rec = true; window.__rk.frames = []; window.__rk.sw = new Map(); });
  const res = { load, dev, city: geo, phases: {} };
  // RK_ALLOC=1: Speicherbelegung je Phase mit dem Sampling-Heap-Profiler (CDP) nach Funktion aufschlüsseln
  const cdp = env.RK_ALLOC === '1' ? await page.context().newCDPSession(page) : null;
  let sampling = false;
  if (cdp) await cdp.send('HeapProfiler.enable');
  const begin = async () => {
    await page.evaluate(() => { window.__rk.frames = []; window.__rk.sw = new Map(); if (window.__rk.upstack) window.__rk.upstack = new Map(); window.__rk.progs0 = new Set((window.__stadtpuls.engine.renderer.info.programs || []).map((p) => p.id)); });
    if (cdp && !sampling) { await cdp.send('HeapProfiler.startSampling', { samplingInterval: 16384, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true }); sampling = true; }
  };
  const allocTop = async () => {
    if (!cdp || !sampling) return null;
    sampling = false;
    const { profile } = await cdp.send('HeapProfiler.stopSampling');
    const by = new Map();
    const walk = (n, stack) => {
      const cf = n.callFrame;
      const name = `${cf.functionName || '(anon)'}:${cf.lineNumber + 1}`;
      if (n.selfSize) { const k = name + ' < ' + stack.slice(-2).reverse().join(' < '); by.set(k, (by.get(k) || 0) + n.selfSize); }
      for (const c of n.children || []) walk(c, stack.concat(name));
    };
    walk(profile.head, []);
    return [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k, v]) => `${(v / 1e6).toFixed(1)} MB ${k}`);
  };
  const take = async (name) => {
    const at = await allocTop();
    if (at) log(`${name} Speicher:\n  ` + at.join('\n  '));
    const r = await page.evaluate(() => {
      const R = window.__rk; const f = R.frames; const sw = [...R.sw.values()]; const top = [...R.sw.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => `${id}(${n}): ${((R.swLog && R.swLog.get(id)) || []).join(" ")}`); R.frames = []; R.sw = new Map(); R.swLog = new Map();
      const up = R.upstack ? [...R.upstack.entries()].sort((a, b) => b[1].kb - a[1].kb).slice(0, 14).map(([k, u]) => `${Math.round(u.kb)} KB ${u.n}x ${u.ms.toFixed(0)} ms: ${k}`) : null;
      if (R.upstack) R.upstack = new Map();
      const bl = R.blog || []; R.blog = [];
      const ps = window.__stadtpuls.engine.renderer.info.programs || [];
      const fresh = R.progs0 ? ps.filter((p) => !R.progs0.has(p.id)).map((p) => p.name + ":" + String(p.cacheKey).replace(/[\s,]+/g, " ").slice(0, 70)) : [];
      const pc = R.progCount ? [...R.progCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${v}x ${k}`) : null; if (R.progCount) R.progCount = new Map();
      const flips = R.flipLog || []; R.flipLog = [];
      return { f, sw, up, bl, pc, top, fresh, flips };
    });
    if (r.bl.length) {
      const ms = r.bl.map((b) => b[3]).sort((a, b) => a - b);
      const byD = [0, 1, 2].map((d) => r.bl.filter((b) => b[2] === d).length);
      log(`${name} Bauten: ${r.bl.length} (Detail 0/1/2: ${byD.join('/')}), Median ${ms[ms.length >> 1]} ms, p90 ${ms[Math.floor(ms.length * 0.9)]} ms, max ${ms[ms.length - 1]} ms; außerhalb Bild: ${r.bl.filter((b) => !b[4]).length}; teuerste: ${r.bl.slice().sort((a, b) => b[3] - a[3]).slice(0, 6).map((b) => `${b[0]}/${b[1]}/d${b[2]} ${b[3]}`).join(', ')}`);
    }
    res.phases[name] = summarize(r.f, r.sw);
    if (r.up) { log(`${name} Uploads:\n  ` + r.up.join('\n  ')); }
    if (r.fresh.length) log(`${name} neue Shader-Programme (${r.fresh.length}): ` + r.fresh.join(" | "));
    if (env.RK_SWLOG === "1" && r.top.length) log(`${name} Wechsel:\n  ` + r.top.join("\n  "));
    if (env.RK_SWLOG === "1" && r.flips.length) log(`${name} Flackern (sichtbar hin und zurück < 1 s):\n  ` + r.flips.join("\n  "));
    if (r.pc) log(`${name} Programmwahl je Bild: ` + (r.pc.length ? r.pc.map((s) => s.replace(/^(\d+)x/, (m, n) => (n / Math.max(1, r.f.length)).toFixed(1) + "x")).join(", ") : "keine"));
    if (env.RK_JSON) (res.raw || (res.raw = {}))[name] = r.f;
    log(`${name}: ${JSON.stringify(res.phases[name])}`);
    return r.f;
  };
  // Detail vollständig? (Bauliste leer, alle Übergänge durch, keine Überblendung, Takt hat das Ziel gesehen)
  const detailSrc = `
    const bv = en.buildings;
    if (!R.settledAt && en.cameraCalm()) R.settledAt = k;
    if (R.settledAt === undefined) return false;
    // sichtbar = Kugel des Gebäudes im echten Bildkegel; „voll" = im Bild nichts mehr offen und keine Überblendung,
    // „alles" = auch der vorbereitete Rand (unsichtbar) fertig
    const F = R.camPlanes();
    let pend = 0, pendVis = 0, fadeVis = 0;
    for (const rec of bv.recs.values()) if (rec.finished && rec.p0 && !rec.dead && rec.want !== rec.shown) { pend++; if (R.inCam(F, rec)) pendVis++; }
    for (const rec of bv.fading) if (R.inCam(F, rec)) fadeVis++;
    const idle = !bv._scan && bv.lodPos >= bv.lodList.length && k - R.settledAt > 20;
    const ok = idle && pendVis === 0 && fadeVis === 0;
    if (idle && !bv.fading.size && pend === 0 && R.allAt === undefined) R.allAt = k;
    // Verlauf nach dem Anhalten (RK_DLOG=1): offene Wechsel, Bauliste, beim Worker, Übersetzen, Überblendungen
    if (R.dlogOn && R.fullAt === undefined && (k - R.settledAt) % 4 === 0) (R.dlog || (R.dlog = [])).push((k - R.settledAt) + ':p' + pend + ' n' + bv.need.size + ' w' + (bv.inflight ? bv.inflight.size : 0) + ' q' + (en._compQ ? en._compQ.size : 0) + ' f' + bv.fading.size + ' l' + (bv.lodList.length - bv.lodPos) + (bv._scan ? 's' : ''));
    if (ok && R.fullAt === undefined) R.fullAt = k;
    return (R.allAt !== undefined && k - R.allAt > (arg || 30)) || (R.fullAt !== undefined && k - R.fullAt > 150);`;
  const detailTime = async (name, maxF = 600) => {
    await page.evaluate((on) => { const R = window.__rk; R.settledAt = undefined; R.fullAt = undefined; R.allAt = undefined; R.dlog = []; R.dlogOn = on; }, env.RK_DLOG === '1');
    await run(name, detailSrc, 30, maxF);
    const t = await page.evaluate(() => {
      const R = window.__rk, en = window.__stadtpuls.engine, bv = en.buildings;
      const [t2, t1] = bv._thresholds();
      let near2 = 0, at2 = 0, near1 = 0, at1 = 0;
      const miss = [], cls = { real: [0, 0], rand: [0, 0], weg: [0, 0] };
      for (const rec of bv.recs.values()) { if (rec.shown < 1) continue; const c = rec.sk < 1e3 ? cls.real : rec.sk < 1e4 ? cls.rand : cls.weg; c[rec.shown - 1]++; }
      // nur Gebäude im Bild zählen (Mittelpunkt im Sichtfeld)
      const cam = en.camera, V = cam.position.constructor, v = new V();
      cam.updateMatrixWorld();
      for (const rec of bv.recs.values()) {
        if (!rec.finished || !rec.p0 || rec.dead) continue;
        v.set(rec.ox, rec.height * 0.5, rec.oz).project(cam);
        if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) continue;
        const d = bv._distance(rec);
        // (unterhalb der Aufwertungsschwelle samt Hysterese: diese Gebäude müssen die Stufe haben)
        if (d < t2 * 0.93) { near2++; if (rec.shown === 2) at2++; else if (miss.length < 6) miss.push(`${rec.id}:d${d.toFixed(1)} s${rec.shown} w${rec.want} wd${rec.wantD} sk${Math.round(rec.sk)} L${rec.locked ? 1 : 0} cd${rec.capDown ? 1 : 0} p2=${bv.protoMgr.protos.has(bv._pid(rec, 2))}`); }
        if (d < t1 * 0.93) { near1++; if (rec.shown >= 1) at1++; }
      }
      return { settledAt: R.settledAt, fullAt: R.fullAt, msToFull: R.fullAt !== undefined ? Math.round((R.fullAt - R.settledAt) * 16.7) : null, msToAll: R.allAt !== undefined ? Math.round((R.allAt - R.settledAt) * 16.7) : null, near2, at2, near1, at1, miss, cls, dlog: R.dlog && R.dlog.length ? R.dlog.join(' ') : undefined, budget: bv.lastBudget || null, calls: en.renderer.info.render.calls, pend: [...bv.recs.values()].filter((r) => r.finished && r.p0 && !r.dead && r.want !== r.shown).slice(0, 4).map((r) => { const id = bv._pid(r, Math.max(0, r.want)); const p = bv.protoMgr.protos.get(id); return `${r.id}:${r.key}/${r.level}:${r.shown}>${r.want} failed=${bv.protoMgr.failed.has(id)} sk=${Math.round(r.sk)} vis=${r.vis} lock=${!!r.locked} proto=${!!p} need=${bv.need.has(id)} fl=${bv.inflight ? bv.inflight.has(id) : "-"} comp=${p && en._compQ ? (p.mats || []).filter((m) => en._compQ.has(m)).length : "-"}`; }), compQ: en._compQ ? en._compQ.size : 0, par: en._parCompile, pool: bv.pool ? { ok: bv.pool.ok, jobs: bv.pool.jobs.size, done: bv.pool.done.length, busy: bv.pool.workers.map((s) => s.busy), inflight: bv.inflight.size, stale: [...bv.inflight.values()].filter((j) => !bv.pool.jobs.has(j.seq)).length, oldestS: Math.round(Math.max(0, ...[...bv.inflight.values()].map((j) => performance.now() - j.t0)) / 1000) } : null };
    });
    return t;
  };

  for (const ph of phases) {
    if (ph === 'idle') {
      // Überblick, Zeit läuft
      await begin();
      await run('idle', 'return k >= 90;');
      await take('idle');
    } else if (ph === 'zoomin') {
      // Zwei-Finger-Zoom vom Überblick bis auf Straßenhöhe (1,5 s), danach stehen bis alles fein ist
      await settleCam(120, geo.cx, geo.cz, 0.6);
      await frames(10);
      await begin();
      await run('zoomin', 'const n = 90; if (k <= n) { const t = k / n; rig.zoomTo(Math.exp(Math.log(120) + (Math.log(7) - Math.log(120)) * t)); } return k > n;');
      res.detailZoomIn = await detailTime('zoomin-settle');
      log('Detail nach Heranzoomen ' + JSON.stringify(res.detailZoomIn));
      await take('zoomin');
    } else if (ph === 'hold') {
      // ruhig auf Straßenhöhe, Zeit läuft (Pendeln ohne Kamerabewegung?)
      await begin();
      await run('hold', 'return k >= 120;');
      await take('hold');
    } else if (ph === 'panlow') {
      // Schwenken auf Straßenhöhe (wie ein Finger, der über den Bildschirm zieht: ~1 Bildschirmbreite je Sekunde)
      await settleCam(8, geo.cx, geo.cz, 0.6);
      await frames(30);
      await begin();
      await run('panlow', 'if (k < 180) { rig.panScreen(-6, -2.5); } return k >= 180;');
      res.detailPanLow = await detailTime('panlow-settle');
      log('Detail nach Schwenken (nah) ' + JSON.stringify(res.detailPanLow));
      await take('panlow');
    } else if (ph === 'zoomout') {
      await settleCam(7, geo.cx, geo.cz, 0.6);
      await frames(30);
      await begin();
      await run('zoomout', 'const n = 90; if (k <= n) { const t = k / n; rig.zoomTo(Math.exp(Math.log(7) + (Math.log(120) - Math.log(7)) * t)); } return k > n + 60;');
      await take('zoomout');
    } else if (ph === 'panmid') {
      // Schwenken in mittlerer Höhe mit Mausrad-Zoomstufen dazwischen
      await settleCam(28, geo.cx - 20, geo.cz - 20, 0.6);
      await frames(20);
      await begin();
      await run('panmid', 'if (k < 240) { rig.panScreen(5, 3); if (k % 40 === 0) rig.zoomTo(rig.goal.dist * (k % 80 ? 0.8 : 1.25)); } return k >= 240;');
      res.detailPanMid = await detailTime('panmid-settle');
      log('Detail nach Schwenken (mittel) ' + JSON.stringify(res.detailPanMid));
      await take('panmid');
    } else if (ph === 'rotate') {
      await settleCam(16, geo.cx, geo.cz, 0.6);
      await frames(20);
      await begin();
      await run('rotate', 'if (k < 240) rig.goal.yaw += Math.PI * 2 / 240; return k >= 240;');
      await take('rotate');
    } else if (ph === 'ug') {
      await settleCam(40, geo.cx, geo.cz, 0.6);
      await frames(20);
      await begin();
      await run('ug', 'if (k === 0) en.setUnderground(true); if (k === 90) en.setUnderground(false); return k >= 180;');
      await take('ug');
    } else if (ph === 'time') {
      // Zeit läuft schnell (Stufe 3 = 4×): Stunden- und Tageswechsel, automatisches Speichern
      await settleCam(24, geo.cx, geo.cz, 0.6);
      await frames(20);
      await begin(); await page.evaluate(() => { window.__stadtpuls.game.speed = 3; });
      await run('time', `return k >= ${+(env.RK_TIME_FRAMES || 1000)};`, null, 5000);
      await page.evaluate(() => { window.__stadtpuls.game.speed = 1; });
      await take('time');
    } else if (ph === 'pendel') {
      // Langsames Hin und Her um die Detailschwellen (Fingerzittern beim Zoomen): kein Gebäude darf dauernd wechseln
      for (const [a, b] of [[11, 15], [26, 38]]) {
        await settleCam(a, geo.cx, geo.cz, 0.6);
        await frames(30);
        await begin();
        await run('pendel', `const p = 60; const t = (k % (2 * p)) / p; const u = t < 1 ? t : 2 - t; rig.zoomTo(${a} + (${b} - ${a}) * u); return k >= 4 * p;`);
        await take(`pendel_${a}_${b}`);
      }
    }
  }
  res.stats = await page.evaluate(() => { const en = window.__stadtpuls.engine; return { ...en.buildings.stats(), quality: en.quality && en.quality.name, rung: en.gov && en.gov.rung, pr: en.pixelRatio, gov: en.gov ? en.gov.history : null, outsideBuildMs: Math.round(window.__rk.outside || 0), outsideMaxBuild: Math.round(window.__rk.outsideMax || 0) }; });
  const all = Object.values(res.phases);
  res.total = {
    frames: all.reduce((a, p) => a + p.frames, 0), maxMs: Math.max(...all.map((p) => p.maxMs)), jsMaxMs: Math.max(...all.map((p) => p.jsMaxMs)), over50: all.reduce((a, p) => a + p.over50, 0), over33: all.reduce((a, p) => a + p.over33, 0), over100: all.reduce((a, p) => a + p.over100, 0),
  };
  if (env.RK_JSON) { writeFileSync(env.RK_JSON, JSON.stringify(res)); delete res.raw; }
  console.log('RUCKEL ' + JSON.stringify(res));
  if (env.RK_CHECK === '1') {
    const errs = check(res);
    if (errs.length) { console.log('RUCKEL ROT: ' + errs.join('; ')); process.exitCode = 1; } else console.log('RUCKEL GRÜN');
  }
}

// Grenzwerte der Regressionsprüfung (JS-Zeit, nicht GPU: SwiftShader zeichnet um Größenordnungen langsamer als ein iPad)
export function check(res) {
  // Schwellen (Umgebung): RK_MAX_MS längstes Bild (reine JS-Zeit, ohne Warten auf die Software-GPU), RK_MAX_OVER so viele
  // Bilder darüber je Abschnitt geduldet (Ausreißer der ausgelasteten Testmaschine), RK_FULL_MS Zeit bis zum vollen Detail,
  // RK_AT2 Anteil naher Gebäude in Detail 2 (in der dichten Megastadt begrenzen die Obergrenzen), RK_MAX_FLIPS Flackern
  const errs = [];
  const maxMs = +(env.RK_MAX_MS || 50), maxOver = +(env.RK_MAX_OVER ?? 1), maxFlips = +(env.RK_MAX_FLIPS ?? 0);
  for (const [k, p] of Object.entries(res.phases)) {
    if (p.jsOver > maxOver || p.jsMaxMs > 2 * maxMs) errs.push(`${k}: ${p.jsOver} Bilder über ${maxMs} ms JS, längstes ${p.jsMaxMs} ms (${p.worst})`);
    if (k !== 'rotate' && p.flips > maxFlips) errs.push(`${k}: ${p.flips} sichtbare Detailwechsel binnen einer Sekunde zurückgenommen (Flackern)`);
  }
  for (const k of ['detailZoomIn', 'detailPanLow', 'detailPanMid']) {
    const d = res[k];
    if (!d) continue;
    if (d.msToFull === null || d.msToFull > +(env.RK_FULL_MS || 1000)) errs.push(`${k}: volles Detail nach ${d.msToFull} ms`);
    if (d.near2 && d.at2 < d.near2 * +(env.RK_AT2 || 0.65)) errs.push(`${k}: nur ${d.at2}/${d.near2} nahe Gebäude in Detail 2`);
    if (d.near1 && d.at1 < d.near1 * 0.9) errs.push(`${k}: nur ${d.at1}/${d.near1} Gebäude in Detail ≥ 1`);
  }
  return errs;
}

const KEYS = ['sim', 'step', 'hourly', 'daily', 'traffic', 'transitSim', 'eng', 'bld', 'lodScan', 'lodDecide', 'lodWork', 'buildSome', 'veh', 'trn', 'ug', 'fx', 'icons', 'lifeW', 'lifeCand', 'lifeWalk', 'rig', 'sky', 'draw', 'ui', 'minimap', 'audio', 'autosave', 'applyQ', 'pcIdle', 'roads', 'roadsRebuild', 'roadsChunk', 'roadsFinish', 'roadsAfter', 'propsCommit', 'props', 'veg', 'terrain'];
function summarize(fr, sw) {
  const ms = fr.map((f) => f.ms).sort((a, b) => a - b);
  // reine JS-Zeit: ohne Warten auf den GPU-Prozess (Programmstatus, finish, readPixels) – das kostet hier die
  // Software-GPU (SwiftShader), auf dem iPad nicht in diesem Maß
  const jsOf = (f) => f.ms - (f.progMs || 0) - (f.shdMs || 0) - (f.finishMs || 0) - (f.readMs || 0);
  const js = fr.map(jsOf).sort((a, b) => a - b);
  const q = (arr, p) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * p))] : 0);
  const sum = (k) => fr.reduce((a, f) => a + (typeof f[k] === 'number' ? f[k] : 0), 0);
  const worstF = fr.reduce((a, f) => (!a || f.ms > a.ms ? f : a), null);
  const parts = {};
  for (const k of KEYS) { const v = fr.map((f) => f[k] || 0); const mx = Math.max(0, ...v); if (mx > 0.5) parts[k] = { avg: +(v.reduce((a, b) => a + b, 0) / Math.max(1, v.length)).toFixed(2), max: +mx.toFixed(1) }; }
  for (const f of fr) for (const k of Object.keys(f)) if (/^(view|life):/.test(k)) { const p = parts[k] || (parts[k] = { avg: 0, max: 0 }); p.avg += f[k] / fr.length; p.max = Math.max(p.max, f[k]); }
  for (const k of Object.keys(parts)) if (/^(view|life):/.test(k)) { parts[k].avg = +parts[k].avg.toFixed(2); parts[k].max = +parts[k].max.toFixed(1); }
  let gc = 0, alloc = 0;
  for (let i = 1; i < fr.length; i++) { const d = (fr[i].heap || 0) - (fr[i - 1].heap || 0); if (d < -1e6) gc++; else if (d > 0) alloc += d; }
  const worst = worstF ? Object.entries(worstF).filter(([k, v]) => typeof v === 'number' && v > 2 && !['n', 'dist', 'calls', 'tris', 'heap', 'rung', 'need', 'lodLeft', 'fading', 'queue', 'calm'].includes(k) && !k.endsWith('N') && !k.endsWith('KB')).map(([k, v]) => `${k}=${v.toFixed(1)}`).join(' ') : '';
  return {
    frames: fr.length, medMs: +q(ms, 0.5).toFixed(1), p95Ms: +q(ms, 0.95).toFixed(1), maxMs: +q(ms, 1).toFixed(1), jsP95Ms: +q(js, 0.95).toFixed(1), jsMaxMs: +q(js, 1).toFixed(1), jsOver: js.filter((v) => v > +(env.RK_MAX_MS || 50)).length,
    over33: fr.filter((f) => f.ms > 33).length, over50: fr.filter((f) => f.ms > 50).length, over100: fr.filter((f) => f.ms > 100).length,
    builds: sum('builds'), buildMs: Math.round(sum('buildMs')), maxBuild: Math.round(Math.max(0, ...fr.map((f) => f.maxBuild || 0))),
    switches: sum('sw'), swDown: sum('swDown'), oscill: sw.filter((n) => n > 2).length, maxSwPerBld: Math.max(0, ...sw), flips: sum('flip'),
    roadEv: sum('roadEv'), veg: sum('veg'), props: sum('props'), progs: sum('prog'),
    shaderWaitMs: Math.round(sum('progMs') + sum('shdMs') + sum('uniMs') + sum('attMs')),
    uploadKB: Math.round(sum('bufKB') + sum('bufSubKB') + sum('texKB') + sum('texSubKB') + sum('tex3KB')), uploadMaxKB: Math.round(Math.max(0, ...fr.map((f) => (f.bufKB || 0) + (f.bufSubKB || 0) + (f.texKB || 0) + (f.texSubKB || 0)))),
    allocMB: +(alloc / 1e6).toFixed(1), gcDrops: gc, rungChanges: fr.filter((f, i) => i && f.rung !== fr[i - 1].rung).length,
    worst: worstF ? `#${worstF.n} ${worstF.ms.toFixed(1)} ms: ${worst}` : '', parts,
  };
}
