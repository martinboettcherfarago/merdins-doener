// Grafikstufe „Automatisch“: Geräteeinschätzung beim Start und laufende Regelung nach der Bildzeit. Besitzer: FLUSS.
//
// Die Regelung bewegt sich auf einer Leiter von Stufen (0 = beste). Benachbarte Stufen unterscheiden sich nur wenig;
// zuerst wird gespart, was man kaum sieht (Schatten seltener auffrischen, weniger Verdeckungsproben), dann die Auflösung
// in kleinen Schritten, dann Schattenauflösung, Umgebungsverdeckung, Bloom und Kantenglättung. Schatten ganz aus (alle
// Shader neu übersetzen = einmal Ruckeln) nur als allerletzte Stufe.
//
//   detectDevice(renderer)      → { kind: 'software'|'phone'|'tablet'|'desktop', gpu, strong, start, best, dpr, … }
//   new AutoGovernor(device)    → profile(): { pr, shadow, shadowEvery, ao, aoSamples, bloom, bloomLevels, msaa, lod }
//   gov.sample(ms, busyMs, ctx) → true, wenn sich die Stufe geändert hat (ctx: { calm, now })
//
// Hysterese: abwärts erst, wenn die Bildzeit über ein Fenster von 1,5 s deutlich zu hoch ist (Median > 20 ms), aufwärts
// erst nach 6 s stabil flüssiger Bilder – und wenn eine Stufe aufwärts nicht trägt, wird sie mit wachsender Sperrzeit
// gemieden. Hilft ein Schritt abwärts nicht (Bildratenbremse des Geräts, z. B. Stromsparmodus mit 30 Bildern/s, oder die
// Simulation ist der Engpass), wird er zurückgenommen und die Regelung pausiert – nichts wird ohne Nutzen schlechter.

const LS_KEY = 'stadtpuls.autoq';

// Leiter (beste zuerst). p = Anteil des vollen Pixelverhältnisses, sh = Schattenkarte, ev = Schatten jedes n-te Bild,
// ao = Verdeckungsproben (0 = aus), bl = Bloom-Stufen (0 = aus), ms = MSAA, lod = Faktor der Detailabstände
export const LADDER = [
  { p: 1.0, sh: 4096, ev: 1, ao: 12, bl: 6, ms: 4, lod: 1.3 },
  { p: 1.0, sh: 4096, ev: 2, ao: 10, bl: 6, ms: 4, lod: 1.3 },
  { p: 0.9, sh: 2048, ev: 2, ao: 10, bl: 6, ms: 4, lod: 1.2 },
  { p: 0.8, sh: 2048, ev: 2, ao: 8, bl: 5, ms: 4, lod: 1.15 },
  { p: 0.75, sh: 2048, ev: 2, ao: 0, bl: 5, ms: 4, lod: 1.1 },
  { p: 0.7, sh: 1024, ev: 2, ao: 0, bl: 5, ms: 4, lod: 1.05 },
  { p: 0.65, sh: 1024, ev: 3, ao: 0, bl: 5, ms: 4, lod: 1.0 },
  { p: 0.6, sh: 1024, ev: 3, ao: 0, bl: 4, ms: 4, lod: 1.0 },
  { p: 0.55, sh: 1024, ev: 3, ao: 0, bl: 4, ms: 2, lod: 0.95 },
  { p: 0.5, sh: 1024, ev: 4, ao: 0, bl: 0, ms: 2, lod: 0.85 },
  { p: 0.5, sh: 0, ev: 4, ao: 0, bl: 0, ms: 0, lod: 0.75 },
];
const NAME_OF = (i) => (i <= 1 ? 'high' : i <= 8 ? 'medium' : 'low');

function gpuString(renderer) {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const s = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return String(s || '');
  } catch (e) { return ''; }
}

// Geräteeinschätzung: Startstufe und beste erlaubte Stufe
export function detectDevice(renderer) {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const win = typeof window !== 'undefined' ? window : {};
  const dpr = Math.max(1, Math.min(4, win.devicePixelRatio || 1));
  const sw = (win.screen && win.screen.width) || win.innerWidth || 1280, sh = (win.screen && win.screen.height) || win.innerHeight || 800;
  const short = Math.min(sw, sh), long = Math.max(sw, sh);
  const touch = (nav.maxTouchPoints || 0) > 1 || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
  const ua = String(nav.userAgent || '');
  const iPadOS = /Macintosh/.test(ua) && (nav.maxTouchPoints || 0) > 1;
  const mobileUA = /Mobi|Android|iPhone|iPad|iPod/.test(ua) || iPadOS;
  const gpu = gpuString(renderer);
  const cores = nav.hardwareConcurrency || 4;
  const mem = nav.deviceMemory || 0; // nur Chromium
  const caps = renderer.capabilities || {};
  const webgl2 = !!caps.isWebGL2;
  let maxTex = 4096;
  try { maxTex = renderer.getContext().getParameter(renderer.getContext().MAX_TEXTURE_SIZE) || 4096; } catch (e) { /* egal */ }
  const software = /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen/i.test(gpu);
  const strongDesk = /nvidia|geforce|rtx|gtx|quadro|radeon\s*(rx|pro|vii)|rx\s?\d{4}|arc\s?a\d|apple m\d/i.test(gpu);
  let kind = 'desktop';
  if (software) kind = 'software';
  else if (touch && mobileUA && short < 600) kind = 'phone';
  else if (touch && (mobileUA || iPadOS)) kind = 'tablet';
  else if (touch && short < 600) kind = 'phone';
  let start, best;
  if (kind === 'software') { start = LADDER.length - 1; best = LADDER.length - 1; }
  else if (kind === 'phone') { start = 6; best = 3; }
  else if (kind === 'tablet') { start = 4; best = 1; }
  else if (strongDesk || (/apple gpu/i.test(gpu) && !touch)) { start = 1; best = 0; }
  else { start = 3; best = 1; }
  // schwache Eckdaten: weiter unten anfangen, nicht ganz nach oben
  if (!software && ((mem && mem <= 2) || cores <= 2)) { start = Math.max(start, 7); best = Math.max(best, 4); }
  else if (!software && ((mem && mem <= 4) || cores <= 4) && kind !== 'tablet') { start = Math.max(start, 4); best = Math.max(best, 2); }
  if (!webgl2) { start = Math.max(start, 6); best = Math.max(best, 4); }
  if (maxTex < 4096) best = Math.max(best, 5);
  // sehr viele Pixel (4K-Bildschirm, großes Tablet): eine Stufe vorsichtiger beginnen
  if (long * dpr > 3800 && kind !== 'software') start = Math.min(LADDER.length - 1, start + 1);
  const sig = [kind, gpu.slice(0, 60), Math.round(dpr * 100), short, long].join('|');
  return { kind, gpu, strong: strongDesk, dpr, cores, mem, webgl2, touch, start, best, sig, name: NAME_OF(start) };
}

const pct = (arr, q) => { if (!arr.length) return 0; const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * q))]; };
const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

// Messgrößen je Fenster (1,5 s):
//   iv   = mittlerer Bildabstand (echte Bildrate; bei Vsync springen Einzelbilder zwischen 16,7 und 33,3 ms)
//   cost = gemessene Bildkosten ohne Vsync: etwa alle 1,2 s wartet die Engine einmal mit gl.finish() auf die GPU und
//          misst Zeichnen + GPU (probe). Damit sieht die Regelung, ob ein Schritt wirkt, auch wenn die Bildrate wegen
//          Vsync auf 30 Bildern/s „klebt", und unterscheidet GPU-Last von Bildratenbremse und Rechenlast.
export class AutoGovernor {
  constructor(device, opts = {}) {
    this.dev = device;
    this.best = device.best;
    this.worst = LADDER.length - 1;
    this.rung = device.start;
    // gelernte Stufe aus der letzten Sitzung (gleiches Gerät): dort weitermachen, nicht neu suchen
    this.saved = null;
    this.block = new Map(); // Stufe → gesperrt bis (ms, performance.now der Sitzung)
    this.blockDur = new Map();
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (raw && raw.sig === device.sig && Number.isInteger(raw.rung) && Date.now() - (raw.t || 0) < 30 * 864e5) {
        this.rung = Math.max(this.best, Math.min(this.worst, raw.rung));
        this.saved = raw;
        // Stufen, die zuletzt zu schwer waren, nicht gleich wieder probieren
        for (const r of raw.heavy || []) if (Number.isInteger(r)) { this.blockDur.set(r, 120000); this.block.set(r, 120000); }
      }
    } catch (e) { /* egal */ }
    if (device.kind === 'software') this.rung = this.worst;
    this.fixed = device.kind === 'software' || !!opts.fixed;
    // Schatten nicht zur Laufzeit ein-/ausschalten (alle Shader neu): unterste Stufe nur nach anhaltend sehr langen Bildern
    this.shadowFloor = LADDER[this.rung].sh > 0 ? this.worst - 1 : this.worst;
    this.win = []; this.winT = 0; this.costs = [];
    this.goodT = 0;
    this.holdUntil = 0; this.holdDur = 0;
    this.last = null; // letzter Schritt { kind, from, to, base, t }
    this.changes = 0;
    this.history = [];
    this.startT = 0;
    this.probeT = 0;
    this.lastMean = 0; this.lastCost = 0;
  }

  profile(caps = {}) {
    const L = LADDER[this.rung];
    const P = Math.min(2, this.dev.dpr);
    const floor = Math.min(P, Math.max(0.75, P * 0.5));
    let shadow = L.sh;
    if (caps.shadows === 'off') shadow = 0;
    else if (caps.shadows === 'low') shadow = Math.min(shadow, 1024);
    return {
      pr: Math.max(floor, Math.round(P * L.p * 100) / 100), shadow, shadowEvery: L.ev,
      ao: L.ao > 0 && caps.ao !== false, aoSamples: L.ao || 6, aoHalf: true,
      bloom: L.bl > 0 && caps.bloom !== false, bloomLevels: L.bl || 4, msaa: L.ms, lod: L.lod,
    };
  }

  // Für die Anzeige in den Einstellungen
  describe(q) {
    const P = Math.min(2, this.dev.dpr);
    const res = Math.round((q.pr / P) * 100);
    const sh = !q.shadow ? 'Schatten aus' : q.shadow >= 4096 ? 'Schatten fein' : q.shadow >= 2048 ? 'Schatten mittel' : 'Schatten weich';
    const fx = [q.post && q.ao ? 'Verdeckung' : '', q.post && q.bloom ? 'Leuchten' : ''].filter(Boolean).join(' + ');
    const fps = this.lastMean ? ` · ${Math.round(1000 / this.lastMean)} Bilder/s` : '';
    return `Gerade: Auflösung ${res} % · ${sh}${fx ? ' · ' + fx : ''}${fps}`;
  }

  _remember() {
    const heavy = [...this.blockDur.keys()].filter((r) => r < this.rung);
    try { localStorage.setItem(LS_KEY, JSON.stringify({ sig: this.dev.sig, rung: this.rung, t: Date.now(), heavy })); } catch (e) { /* egal */ }
  }
  _block(r, now, first = 60000) {
    const d = Math.min(1800000, this.blockDur.has(r) ? this.blockDur.get(r) * 2 : first);
    this.blockDur.set(r, d);
    this.block.set(r, now + d);
  }

  _set(r, why, now) {
    r = Math.max(this.best, Math.min(this.shadowFloor, r));
    if (r === this.rung) return false;
    this.history.push({ t: Math.round(now), from: this.rung, to: r, why });
    if (this.history.length > 40) this.history.shift();
    this.rung = r;
    this.changes++;
    this.win = []; this.winT = 0; this.costs = []; this.goodT = 0;
    this.settleUntil = now + 1200;
    this._remember();
    return true;
  }

  // Soll in diesem Bild gemessen werden (gl.finish)? Ein Messbild kostet etwa ein Bild Überlappung von CPU und GPU,
  // daher: jede Sekunde nur, solange etwas zu entscheiden ist (langsam, nach einem Wechsel), sonst alle 4 s; bevorzugt
  // bei ruhender Kamera (ein ausgelassenes Bild fällt dann nicht auf).
  wantProbe(now, calm = true) {
    if (this.fixed || now - (this.startT || now) < 2000) return false;
    const busy = this.lastMean > 20.5 || (this.last && !this.last.checked) || now - (this.settleUntil || 0) < 8000;
    const every = busy ? 1000 : 4000;
    if (now - this.probeT < (calm ? every : every * 3)) return false;
    this.probeT = now;
    return true;
  }
  // Messwert eines Messbilds; gewertet wird der Median der letzten drei (seit dem letzten Stufenwechsel)
  probe(costMs) { if (costMs > 0 && costMs < 400) { this.costs.push(costMs); if (this.costs.length > 3) this.costs.shift(); } }

  // Ein Bild: ms = Abstand zum letzten Bild, busy = JS-Zeit des Bildes. ctx.calm = Kamera ruht (sichtbare Wechsel nur dann)
  sample(ms, busy, ctx) {
    const now = ctx.now;
    if (!this.startT) this.startT = now;
    if (this.fixed) return false;
    // Fehlmessungen: Pausen, Ladeunterbrechungen, gedrosselte Bilder, Messbilder, die ersten Sekunden nach dem Start
    const dbg = this.dbg || (this.dbg = { n: 0, skip: 0, long: 0, used: 0, lastMs: 0 });
    dbg.n++; dbg.lastMs = Math.round(ms);
    if (ctx.skip) { dbg.skip++; return false; }
    if (!(ms > 0) || ms > (this.maxMs || 250)) { dbg.long++; return false; }
    if (now - this.startT < 2500 || now < (this.settleUntil || 0)) return false;
    dbg.used++;
    this.win.push(ms);
    this.winT += ms;
    if (this.winT < 1500) return false;
    const iv = this.winT / this.win.length, p90 = pct(this.win, 0.9);
    // Kosten: Messbilder, sonst (keine Messung möglich) die Rechenzeit als Untergrenze
    const cost = this.costs.length ? Math.max(pct(this.costs, 0.5), busy) : 0;
    this.win = []; this.winT = 0;
    this.lastMean = iv; this.lastCost = cost;
    const slowW = iv > 20.5; // unter ~49 Bilder/s
    const goodW = p90 <= 17.8 && iv <= 17.2;
    const known = cost > 0;
    // Wirkung des letzten Schritts prüfen
    const L = this.last;
    // (erst prüfen, wenn drei Messbilder der neuen Stufe vorliegen – einzelne Messungen schwanken um einige Prozent)
    if (L && !L.checked && now - L.t < 12000 && (!known || this.costs.length >= 3 || now - L.t > 6000)) {
      L.checked = true;
      if (L.kind === 'down') {
        const helped = (known && L.cost > 0 ? cost < L.cost * 0.97 : false) || iv < L.base * 0.95;
        if (!helped && slowW && L.to < this.worst) {
          // keine Besserung: Bremse liegt woanders (Bildratenbremse, Rechenlast) – zurück und (wachsend) Pause
          this.last = null;
          this.holdDur = Math.min(600000, (this.holdDur || 22500) * 2);
          this.holdUntil = now + this.holdDur;
          return this._set(L.from, 'ohne Wirkung zurück', now);
        }
        if (helped) this.holdDur = 0;
      } else if (L.kind === 'up') {
        const tooHeavy = slowW || (known && cost > 16.5);
        if (tooHeavy) { this.last = null; this._block(L.to, now); return this._set(L.from, 'aufwärts zu schwer', now); }
      }
    }
    // solange die Wirkung des letzten Schritts noch nicht feststeht: keinen weiteren Schritt (außer bei starkem Ruckeln)
    if (L && !L.checked && now - L.t < 12000 && !(iv > 45)) return false;
    if (slowW) {
      this.goodT = 0;
      if (now < this.holdUntil) return false;
      // gemessene Kosten passen in ein Bild: Bildratenbremse oder Vsync-Takt – Grafik herunterzuregeln hilft nicht
      if (known && cost < 14.5) return false;
      // Rechenzeit (Simulation, Oberfläche, Zeichenaufrufe) ist der Engpass: Grafikstufen helfen kaum – abwarten
      if (busy > 14 && (!known || busy >= cost * 0.8)) { this.holdUntil = now + 20000; return false; }
      // ganz unten: Schatten erst abschalten, wenn es dauerhaft sehr langsam bleibt (einmaliges Neuübersetzen)
      if (this.rung >= this.shadowFloor) {
        this.verySlow = iv > 40 ? (this.verySlow || 0) + 1 : 0;
        if (this.verySlow >= 4 && this.shadowFloor < this.worst) { this.shadowFloor = this.worst; this.block.set(this.worst - 1, Infinity); } else return false;
      }
      // sichtbare Wechsel nur bei ruhiger Kamera – außer es ruckelt stark
      if (!ctx.calm && iv < 30) return false;
      const step = iv > 40 && (!known || cost > 33) ? 2 : 1;
      const from = this.rung;
      if (this._set(this.rung + step, `langsam (${(1000 / iv).toFixed(0)} B/s, Kosten ${cost.toFixed(1)} ms)`, now)) {
        this._block(from, now, 45000); // gerade zu schwer gewesen: nicht gleich wieder hinauf
        this.last = { kind: 'down', from, to: this.rung, base: iv, cost, t: now };
        return true;
      }
      return false;
    }
    if (goodW && (!known || cost <= 11.5)) {
      this.goodT += 1500;
      if (this.goodT < 6000 || this.rung <= this.best || !ctx.calm) return false;
      if (busy > 11) return false; // Rechenzeit schon knapp – nicht aufwärts probieren
      const to = this.rung - 1;
      if ((this.block.get(to) || 0) > now) return false;
      const from = this.rung;
      if (this._set(to, 'flüssig – eine Stufe besser', now)) { this.last = { kind: 'up', from, to, base: iv, cost, t: now }; return true; }
    } else this.goodT = Math.max(0, this.goodT - 1500);
    return false;
  }
}
