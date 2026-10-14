// Geräteanpassung „Automatisch" im Browser prüfen (--eval-Modul für tools/shot.mjs), z. B. als iPad:
//   node tools/shot.mjs --scenario city --quality auto --ua ipad --dpr 2 --gpu "Apple GPU" --w 1180 --h 820 \
//     --eval tools/geraet.mjs --out /tmp/geraet.png
// 1. Geräteeinschätzung und Startstufe, 2. echte Regelschleife unter SwiftShader (künstlich langsame Bilder: die
// Regelung muss stufenweise abwärts gehen und unten ruhig bleiben), 3. Aufwärtsweg mit künstlich schnellen Bildern
// (Messwerte direkt eingespeist): Stufen werden übernommen, ohne dass etwas schiefgeht.
const T0 = Date.now();
export default async function geraet(page, h) {
  const info = () => page.evaluate(() => {
    const en = window.__stadtpuls.engine, q = en.quality;
    return { rung: en.gov && en.gov.rung, pr: en.pixelRatio, shadow: q.shadow, ao: q.ao, bloom: q.bloom, msaa: q.msaa, lod: q.lod, status: en.autoStatus() };
  });
  const res = {};
  res.device = await page.evaluate(() => { const d = window.__stadtpuls.engine.device; return d && { kind: d.kind, gpu: d.gpu, dpr: d.dpr, start: d.start, best: d.best, name: d.name }; });
  res.start = await info();
  // 2. echte Schleife: kleines Fenster, damit Bilder < 250 ms dauern (sonst gelten sie als Ladeunterbrechung)
  const vw = page.viewportSize();
  await page.setViewportSize({ width: 360, height: 240 });
  await page.evaluate(() => { const en = window.__stadtpuls.engine; en.forceGovern = true; window.__stadtpuls.game.speed = 1; });
  const secs = +(process.env.GERAET_SECS || 75);
  const trace = [];
  for (let t = 0; t < secs; t += 5) {
    await h.wait(5000);
    const s = await page.evaluate(() => { const en = window.__stadtpuls.engine, g = en.gov; return { rung: g.rung, mean: Math.round(g.lastMean), cost: Math.round(g.lastCost), changes: g.changes }; });
    trace.push(s);
  }
  res.loop = { trace, history: await page.evaluate(() => window.__stadtpuls.engine.gov.history), after: await info() };
  const tail = trace.slice(-6).map((s) => s.rung);
  res.loop.ruhigAmEnde = tail.every((r) => r === tail[0]);
  // 3. Aufwärts: schnelle Bilder (16,7 ms, Messbild 7 ms) direkt einspeisen, Engine übernimmt jede Stufe
  await page.evaluate(() => { window.__stadtpuls.engine.forceGovern = false; });
  res.up = await page.evaluate(() => {
    const en = window.__stadtpuls.engine, gov = en.gov;
    let t = performance.now() + 1e6;
    gov.startT = t - 10000; gov.settleUntil = 0; gov.last = null; gov.holdUntil = 0; gov.block.clear(); gov.costs = [];
    const steps = [];
    for (let i = 0; i < 60 * 40; i++) {
      t += 16.7;
      if (gov.wantProbe(t)) gov.probe(7);
      if (gov.sample(16.7, 4, { now: t, calm: true, skip: false })) { en.applyQuality(); steps.push({ rung: gov.rung, pr: en.pixelRatio, shadow: en.quality.shadow, ao: en.quality.ao }); }
    }
    return { steps, final: gov.rung, best: gov.best };
  });
  await page.setViewportSize(vw);
  await h.wait(1500);
  res.end = await info();
  res.secs = Math.round((Date.now() - T0) / 1000);
  console.log('GERAET ' + JSON.stringify(res));
}
