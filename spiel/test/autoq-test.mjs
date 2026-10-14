// Prüfstand der Grafikstufe „Automatisch" (render/autoquality.js) ohne Browser: simulierte Geräte mit Vsync (60 Hz),
// GPU-Last je Stufe, Bildratenbremse (30 Bilder/s) und rechenlastiger Simulation. Geprüft wird, dass die Regelung
// zu einer flüssigen Stufe findet, dort ruhig bleibt (kein Hin und Her) und nichts verschlechtert, was nicht hilft.
//   node test/autoq-test.mjs
import { AutoGovernor, LADDER, detectDevice } from '../src/render/autoquality.js';

globalThis.localStorage = { _m: new Map(), getItem(k) { return this._m.get(k) ?? null; }, setItem(k, v) { this._m.set(k, String(v)); } };
// relative GPU-Kosten je Stufe (grob: Pixelanteil², Schatten, Verdeckung)
const COST = LADDER.map((L) => 0.25 + 0.55 * L.p * L.p + (L.sh >= 4096 ? 0.1 : L.sh >= 2048 ? 0.06 : L.sh ? 0.03 : 0) + (L.ao ? 0.08 : 0) + (L.bl ? 0.02 : 0));
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'ROT '} ${msg}`); if (!ok) fails++; };

function run({ gpu, cpu = 4, cap = 0, start = 4, best = 1, secs = 240, moving = 0, seed = 1, noProbe = false }) {
  const dev = { kind: 'tablet', dpr: 2, start, best, sig: 'test' + seed + Math.random(), name: 'medium' };
  const gov = new AutoGovernor(dev);
  let now = 1000, rnd = seed;
  const rand = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647; };
  const rungs = [];
  let changes = 0;
  while (now < 1000 + secs * 1000) {
    const g = gpu * COST[gov.rung] * (0.94 + rand() * 0.12);
    const ft = Math.max(cpu, g);
    let iv = Math.ceil(ft / 16.667 - 0.02) * 16.667;
    if (cap) iv = Math.max(iv, cap);
    now += iv;
    const calm = !(moving && Math.floor(now / 4000) % 2 === 0);
    // Messbild (gl.finish): Kosten ohne Vsync; dieses Bild selbst zählt nicht für die Bildrate
    const probe = !noProbe && gov.wantProbe(now);
    if (probe) gov.probe(ft);
    if (gov.sample(iv, cpu, { now, calm, skip: probe })) changes++;
    rungs.push(gov.rung);
  }
  const tail = rungs.slice(Math.floor(rungs.length * 0.6));
  const tailChanges = tail.reduce((a, r, i) => a + (i && r !== tail[i - 1] ? 1 : 0), 0);
  const fps = (r) => 1000 / Math.max(16.667, Math.ceil(Math.max(cpu, gpu * COST[r]) / 16.667 - 0.02) * 16.667);
  return { final: gov.rung, changes, tailChanges, fps: fps(gov.rung), hist: gov.history.map((h) => process.env.WHY ? `${h.from}→${h.to}[${h.why}]` : `${h.from}→${h.to}`).join(" ") };
}

// 1. Starkes Tablet: GPU 12 ms bei bester Stufe → sollte nach oben gehen und flüssig bleiben
let r = run({ gpu: 12 });
check(r.fps >= 59 && r.final <= 2 && r.tailChanges <= 2, `starkes Gerät: Stufe ${r.final}, ${r.fps.toFixed(0)} B/s, ${r.changes} Wechsel (${r.hist})`);
// 2. Mittleres Tablet: GPU 26 ms bei bester Stufe → muss nach unten bis flüssig, dann ruhig
r = run({ gpu: 26 });
check(r.fps >= 59 && r.tailChanges <= 2, `mittleres Gerät: Stufe ${r.final}, ${r.fps.toFixed(0)} B/s, ${r.changes} Wechsel (${r.hist})`);
// 3. Schwaches Gerät: GPU 40 ms → durch die Vsync-Stufe (30 B/s) hindurch bis flüssig
r = run({ gpu: 40, start: 4 });
check(r.fps >= 59 && r.tailChanges <= 2, `schwaches Gerät: Stufe ${r.final}, ${r.fps.toFixed(0)} B/s, ${r.changes} Wechsel (${r.hist})`);
// 3b. Sehr schwaches Gerät: GPU 80 ms → ganz unten, aber ruhig
r = run({ gpu: 80, start: 4 });
check(r.final >= 9 && r.tailChanges <= 2, `sehr schwaches Gerät: Stufe ${r.final}, ${r.fps.toFixed(0)} B/s, ${r.changes} Wechsel (${r.hist})`);
// 3c. Ohne Messbilder (gl.finish wirkungslos): nur nach Bildrate, trotzdem stabil
r = run({ gpu: 26, noProbe: true });
check(r.tailChanges <= 2, `ohne Messbild: Stufe ${r.final}, ${r.fps.toFixed(0)} B/s, ${r.changes} Wechsel (${r.hist})`);
// 4. Bildratenbremse 30 B/s (Stromsparmodus): darf die Stufe nicht dauerhaft verschlechtern
r = run({ gpu: 12, cap: 33.333, start: 4 });
check(r.final <= 4 && r.changes <= 1, `30-B/s-Bremse: Stufe ${r.final} (Start 4), ${r.changes} Wechsel (${r.hist})`);
// 5. Rechenlast der Simulation (CPU 26 ms): Grafik herunterzuregeln hilft nicht → zurücknehmen, nicht abrutschen
r = run({ gpu: 10, cpu: 26, start: 4 });
check(r.final <= 4 && r.changes <= 4, `CPU-Engpass: Stufe ${r.final} (Start 4), ${r.changes} Wechsel (${r.hist})`);
// 6. Kamera oft in Bewegung: Wechsel nur in Ruhe (oder bei starkem Ruckeln), trotzdem Ziel erreicht
r = run({ gpu: 26, moving: 1 });
check(r.fps >= 59 && r.tailChanges <= 2, `mit Kamerabewegung: Stufe ${r.final}, ${r.fps.toFixed(0)} B/s, ${r.changes} Wechsel (${r.hist})`);
// 7. Grenzfall knapp an der Vsync-Kante: kein Pendeln
r = run({ gpu: 16.2 / COST[1], start: 1, best: 0 });
check(r.tailChanges <= 2, `Grenzfall: Stufe ${r.final}, ${r.changes} Wechsel, ${r.tailChanges} im letzten Drittel (${r.hist})`);
// 8. Geräteeinschätzung (ohne Browser: Ersatzobjekte)
const setNav = (o) => Object.defineProperty(globalThis, 'navigator', { value: o, configurable: true, writable: true });
const fakeR = (gpu, webgl2 = true) => ({ capabilities: { isWebGL2: webgl2 }, getContext: () => ({ getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 1 }), getParameter: (p) => (p === 1 ? gpu : 8192), MAX_TEXTURE_SIZE: 2 }) });
globalThis.window = { devicePixelRatio: 2, screen: { width: 1180, height: 820 }, innerWidth: 1180, innerHeight: 820 };
setNav({ maxTouchPoints: 5, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15', hardwareConcurrency: 8 });
let d = detectDevice(fakeR('Apple GPU'));
check(d.kind === 'tablet' && d.start === 4, `iPad (Safari meldet Mac + Touch): ${d.kind}, Start ${d.start}, beste ${d.best}`);
globalThis.window = { devicePixelRatio: 1, screen: { width: 1920, height: 1080 }, innerWidth: 1920, innerHeight: 1080 };
setNav({ maxTouchPoints: 0, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', hardwareConcurrency: 12, deviceMemory: 8 });
d = detectDevice(fakeR('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)'));
check(d.kind === 'desktop' && d.start <= 1, `Rechner mit Grafikkarte: ${d.kind}, Start ${d.start}`);
d = detectDevice(fakeR('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))'));
check(d.kind === 'software' && d.start === LADDER.length - 1, `Software-Renderer: ${d.kind}, Start ${d.start}`);
globalThis.window = { devicePixelRatio: 3, screen: { width: 390, height: 844 }, innerWidth: 390, innerHeight: 844 };
setNav({ maxTouchPoints: 5, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148', hardwareConcurrency: 6 });
d = detectDevice(fakeR('Apple GPU'));
check(d.kind === 'phone' && d.start >= 5, `Handy: ${d.kind}, Start ${d.start}`);
console.log(fails ? `${fails} Prüfungen ROT` : 'Alle Prüfungen der automatischen Grafikstufe grün');
process.exit(fails ? 1 : 0);
