// Pulsbahn – die U-Bahn der Stadt: Stationen (unterirdische Bahnsteige, oben ein Eingang), Linien (oktilinear wie auf einem Netzplan), Züge im Tunnel, Fahrgäste.
// Fahrgäste haben eine Form je Ziel: ● Wohnen, ▲ Gewerbe, ■ Industrie, ◆ Büro.
import { TRANSIT, BUILDINGS, T } from '../config.js';
import { stationName } from '../util.js';
import { forDisc } from './services.js';

export const LINE_COLORS = [0xe8543f, 0x2f8fe0, 0xf2b01e, 0x22a866, 0x8f5ad8, 0xf06fae, 0x10a9a3, 0x8a6a55, 0xff8a1f, 0x4656c9];
export const LINE_COLOR_NAMES = ['Rot', 'Blau', 'Gelb', 'Grün', 'Violett', 'Rosa', 'Türkis', 'Braun', 'Orange', 'Indigo'];

const gauss = (h, m, s) => Math.exp(-0.5 * ((h - m) / s) ** 2);
const mod = (a, m) => ((a % m) + m) % m;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Automatischer Takt: Zurückhalten, wenn der Abstand zum Vordermann unter close × Soll-Abstand liegt oder kleiner ist als die Mitte zwischen Vorder- und Hintermann (− tol × Soll);
// je Station höchstens holdShare × Soll-Folgezeit (zwischen minHold und maxHold Sekunden). Abgestimmt mit test/takt-test.mjs.
export const TAKT = { close: 0.7, tol: 0.04, holdShare: 0.6, minHold: 1.5, maxHold: 8 };

// Umlauf einer Linie: Pendellinie 2L (hin und zurück), Ring L je Fahrtrichtung
export const cycLen = (line) => (line.loop ? line.length : 2 * line.length);
// Position eines Zugs im Umlauf seiner Fahrtrichtung (wächst in Fahrtrichtung)
export function cycPos(t, line) {
  const L = line.length;
  if (!(L > 0)) return 0;
  if (line.loop) return t.dir > 0 ? mod(t.d, L) : mod(L - t.d, L);
  return mod(t.dir > 0 ? t.d : 2 * L - t.d, 2 * L);
}
// Umlaufposition → Spurposition P (siehe Transit.trainP)
export const cycToP = (line, dir, q) => (line.loop && dir < 0 ? line.length + q : q);

export class Transit {
  constructor(g) {
    this.g = g;
    this.stations = new Map();
    this.lines = [];
    this.trains = [];
    this.linesMax = 2;
    this.freeTrains = 0;
    this.freeWagons = 0;
    this.nextStation = 1;
    this.nextLine = 1;
    this.nextTrain = 1;
    this.usedNames = new Set();
    this.dist = new Map();
    this.faresToday = 0;
    this.deliveredToday = 0;
    this.deliveredTotal = 0;
    this.version = 0;
    this.arrivals = []; // für Klänge und Effekte: {line, station}
  }

  totalWagons() { let n = 0; for (const t of this.trains) n += t.wagons; return n; }

  canPlaceStation(x, y) {
    const g = this.g;
    if (x < 0 || y < 0 || x >= g.W || y >= g.H) return 'Außerhalb der Karte';
    const i = y * g.W + x;
    const ter = g.world.terrain[i];
    if (ter === T.WATER || ter === T.ROCK) return 'Nicht auf Wasser oder Fels';
    if (g.bld[i]) return 'Feld ist bebaut';
    if (g.stationAt[i]) return 'Hier steht schon eine Station';
    if (g.road[i] === 4) return 'Nicht auf der Autobahn';
    return null;
  }

  addStation(x, y) {
    const g = this.g;
    const i = y * g.W + x;
    const id = this.nextStation++;
    const st = { id, x, y, name: stationName(g.rng, this.usedNames), waiting: [], over: 0, penaltyUntil: 0, w: [0, 0, 0, 0, 0], served: 0 };
    this.stations.set(id, st);
    g.stationAt[i] = id;
    this.updateCatchment(st);
    this.changed();
    return st;
  }

  removeStation(id) {
    const g = this.g;
    const st = this.stations.get(id);
    if (!st) return;
    g.stationAt[st.y * g.W + st.x] = 0;
    this.stations.delete(id);
    this.usedNames.delete(st.name);
    for (const line of [...this.lines]) {
      if (!line.stops.includes(id)) continue;
      line.stops = line.stops.filter((s) => s !== id);
      // doppelte Nachbarn entfernen
      line.stops = line.stops.filter((s, k, a) => k === 0 || a[k - 1] !== s);
      if (line.loop && line.stops.length < 3) line.loop = false;
      if (line.stops.length < 2) this.removeLine(line.id, true);
      else this.rebuildLine(line);
    }
    this.changed();
  }

  lineCost(stops, loop) {
    let len = 0;
    for (let k = 0; k < stops.length - 1; k++) len += this.segLen(stops[k], stops[k + 1]);
    if (loop) len += this.segLen(stops[stops.length - 1], stops[0]);
    return len * TRANSIT.trackCostPerTile;
  }

  segLen(a, b) {
    const A = this.stations.get(a), B = this.stations.get(b);
    const dx = Math.abs(B.x - A.x), dy = Math.abs(B.y - A.y);
    const d = Math.min(dx, dy);
    return d * Math.SQRT2 + Math.max(dx, dy) - d;
  }

  createLine(stops, loop) {
    const usedColors = new Set(this.lines.map((l) => l.color));
    let color = 0;
    while (usedColors.has(color) && color < LINE_COLORS.length - 1) color++;
    const line = { id: this.nextLine++, color, stops: [...stops], loop: !!loop, takt: true, ridersToday: 0, riders: 0, pts: [], cum: [], stopD: [], length: 0 };
    this.lines.push(line);
    this.rebuildLine(line);
    this.addTrainToLine(line, true);
    this.changed();
    return line;
  }

  extendLine(line, stationId, atStart) {
    // Am Anfang verlängern: Knickrichtung der bestehenden Abschnitte beibehalten (par), sonst würde die ganze Linie umgezeichnet
    if (atStart) { line.stops.unshift(stationId); line.par = ((line.par || 0) + 1) % 2; } else line.stops.push(stationId);
    this.rebuildLine(line);
    this.changed();
  }

  removeLine(id, keepStations) {
    const line = this.lines.find((l) => l.id === id);
    if (!line) return;
    for (const t of this.trains.filter((t) => t.line === id)) {
      this.freeTrains++;
      this.freeWagons += t.wagons;
    }
    this.trains = this.trains.filter((t) => t.line !== id);
    this.lines = this.lines.filter((l) => l.id !== id);
    void keepStations;
    this.recomputeTracks();
    this.recomputeRouting();
    this.changed();
  }

  addTrainToLine(line, initial) {
    const others = this.trains.filter((t) => t.line === line.id);
    const t = { id: this.nextTrain++, line: line.id, d: 0, dir: 1, cur: 0, to: 0, targetD: 0, state: 'dwell', dwell: 0.6, hold: 0, pax: [], wagons: 0, x: 0, y: 0, z: 0, yaw: 0 };
    t.d = line.stopD[0] || 0;
    this.trains.push(t);
    // Neuer Zug kommt in die größte Lücke des Umlaufs (an die nächstgelegene Station), damit die Züge verteilt fahren
    if (others.length && line.stops.length > 1 && line.length > 0) {
      let dir = 1;
      if (line.loop) { const pos = others.filter((o) => o.dir > 0).length; dir = others.length - pos < pos ? -1 : 1; }
      const C = cycLen(line);
      const grp = others.filter((o) => !line.loop || o.dir === dir);
      let q;
      if (!grp.length) q = mod(line.length - others[0].d + line.length / 2, C); // Gegenrichtung im Ring: gegenüber dem ersten Zug
      else {
        const qs = grp.map((o) => cycPos(o, line)).sort((a, b) => a - b);
        let best = -1, at = 0;
        for (let k = 0; k < qs.length; k++) {
          const gap = k + 1 < qs.length ? qs[k + 1] - qs[k] : qs[0] + C - qs[k];
          if (gap > best + 1e-9) { best = gap; at = qs[k] + gap / 2; }
        }
        q = mod(at, C);
      }
      // nächstgelegene Station im Umlauf (Hin- oder Rückfahrt)
      let bestQ = 0, bd = Infinity;
      for (const sd of line.stopD) {
        const cands = line.loop ? [dir > 0 ? sd : mod(line.length - sd, C)] : [sd, mod(2 * line.length - sd, C)];
        for (const c of cands) { const dd = Math.min(Math.abs(c - q), C - Math.abs(c - q)); if (dd < bd - 1e-9) { bd = dd; bestQ = c; } }
      }
      this.placeAt(t, line, cycToP(line, dir, bestQ), { quiet: true, dir });
      t.dwell = 0.6;
    } else poseTrain(this, t);
    void initial;
    this.changed();
    return t;
  }

  removeTrainFromLine(line) {
    const ts = this.trains.filter((t) => t.line === line.id);
    if (ts.length <= 1) return false;
    const t = ts[ts.length - 1];
    this.freeTrains++;
    this.freeWagons += t.wagons;
    this.trains = this.trains.filter((x) => x !== t);
    this.changed();
    return true;
  }

  addWagonToLine(line) {
    const ts = this.trains.filter((t) => t.line === line.id && t.wagons < 3);
    if (!ts.length) return false;
    ts.sort((a, b) => a.wagons - b.wagons);
    ts[0].wagons++;
    this.changed();
    return true;
  }

  trainCapacity(t) { return TRANSIT.baseCapacity + t.wagons * TRANSIT.wagonCapacity; }

  rebuildLine(line) {
    const pts = [];
    const stopD = [];
    const pair = [];
    const S = (id) => this.stations.get(id);
    const n = line.stops.length;
    const segs = line.loop ? n : n - 1;
    let cum = [0];
    const push = (x, y, pk) => {
      if (pts.length) {
        const [px, py] = pts[pts.length - 1];
        if (Math.abs(px - x) < 1e-6 && Math.abs(py - y) < 1e-6) return;
        cum.push(cum[cum.length - 1] + Math.hypot(x - px, y - py));
      }
      pts.push([x, y]);
      pair.push(pk);
    };
    for (let k = 0; k < segs; k++) {
      const A = S(line.stops[k]), B = S(line.stops[(k + 1) % n]);
      const ax = A.x + 0.5, ay = A.y + 0.5, bx = B.x + 0.5, by = B.y + 0.5;
      if (k === 0) { push(ax, ay, k); stopD.push(0); }
      const dx = bx - ax, dy = by - ay;
      const d = Math.min(Math.abs(dx), Math.abs(dy));
      // Diagonale zuerst, wenn der Abschnitt überwiegend diagonal ist; sonst gerade zuerst
      if (d > 0 && d !== Math.abs(dx) || d > 0 && d !== Math.abs(dy)) {
        let mx, my;
        if ((k + (line.par || 0)) % 2 === 0) { mx = ax + Math.sign(dx) * d; my = ay + Math.sign(dy) * d; }
        else { mx = bx - Math.sign(dx) * d; my = by - Math.sign(dy) * d; }
        push(mx, my, k);
      }
      push(bx, by, k);
      if (!(line.loop && k === segs - 1)) stopD.push(cum[cum.length - 1]);
    }
    line.pts = pts;
    line.cum = cum;
    line.pair = pair;
    line.stopD = stopD;
    line.length = cum[cum.length - 1];
    // Züge bleiben, wo sie sind (gleiche Station bzw. gleicher Abschnitt mit gleichem Fortschritt).
    // Früher sprangen beim Verlängern alle Züge auf eine Station zurück – nach Verlängerung am Anfang sogar um eine Station versetzt.
    const old = line._geo;
    for (const t of this.trains) {
      if (t.line !== line.id) continue;
      this.remapTrain(t, line, old);
      poseTrain(this, t);
    }
    line._geo = { stops: [...line.stops], stopD: [...stopD], length: line.length, loop: line.loop };
    this.recomputeTracks();
    this.recomputeRouting();
  }

  // Zug nach dem Umbau einer Linie (verlängert, Ring geschlossen, Station entfernt) auf die neue Geometrie übertragen.
  remapTrain(t, line, old) {
    const n = line.stops.length;
    const ends = (k) => { if (!line.loop) { if (k === 0) t.dir = 1; if (k === n - 1) t.dir = -1; } };
    const dwellAt = (k, dw) => { t.cur = k; t.to = k; t.d = line.stopD[k]; t.state = 'dwell'; t.dwell = dw; ends(k); };
    if (old && old.stops && old.stops.length > 1) {
      const aId = old.stops[t.cur];
      const ka = line.stops.indexOf(aId);
      if (t.state === 'move') {
        const bId = old.stops[t.to];
        const kb = line.stops.indexOf(bId);
        const dA = old.loop && t.cur === 0 && t.dir < 0 ? old.length : old.stopD[t.cur];
        const dB = old.loop && t.to === 0 && t.dir > 0 ? old.length : old.stopD[t.to];
        const frac = Math.abs(dB - dA) > 1e-9 ? clamp01((t.d - dA) / (dB - dA)) : 0;
        if (ka >= 0 && kb >= 0) {
          let dir = 0;
          if (line.loop) { if ((ka + 1) % n === kb) dir = 1; else if ((ka - 1 + n) % n === kb) dir = -1; } else if (Math.abs(kb - ka) === 1) dir = Math.sign(kb - ka);
          if (dir) {
            const nA = line.loop && ka === 0 && dir < 0 ? line.length : line.stopD[ka];
            const nB = line.loop && kb === 0 && dir > 0 ? line.length : line.stopD[kb];
            t.cur = ka; t.to = kb; t.dir = dir; t.d = nA + (nB - nA) * frac; t.targetD = nB; t.state = 'move';
            return;
          }
        }
        const k = frac < 0.5 ? (ka >= 0 ? ka : kb) : (kb >= 0 ? kb : ka);
        if (k >= 0) { dwellAt(k, 0.5); return; }
      } else if (ka >= 0) { dwellAt(ka, Math.max(0.3, Math.min(2, t.dwell))); return; }
    }
    dwellAt(Math.max(0, Math.min(t.cur, n - 1)), 0.5);
  }

  // ---------- Takt: Position im Umlauf, Abstände, Zurückhalten, Verteilen, Verschieben
  // Spurposition P ∈ [0, 2L): P = d auf der Hinfahrt (dir +1), P = 2L − d auf der Rückfahrt (dir −1).
  // Pendellinie: Umlauf der Länge 2L mit Position P. Ring: je Fahrtrichtung ein Umlauf der Länge L.
  trainP(t, line) { return mod(t.dir > 0 ? t.d : 2 * line.length - t.d, 2 * line.length || 1); }

  // Abstand (Felder) zum vorausfahrenden und zum folgenden Zug derselben Fahrtrichtung; null bei nur einem Zug.
  gapsOf(t, line, list) {
    const C = cycLen(line);
    if (!(C > 0)) return null;
    const q = cycPos(t, line);
    let ahead = Infinity, behind = Infinity, n = 1;
    for (const o of list || this.trains) {
      if (o === t || o.line !== t.line || (line.loop && o.dir !== t.dir)) continue;
      n++;
      const qo = cycPos(o, line);
      let fa = mod(qo - q, C), fb = mod(q - qo, C);
      if (fa < 1e-9) { if (o.id > t.id) { fa = 0; fb = C; } else { fa = C; fb = 0; } }
      if (fa < ahead) ahead = fa;
      if (fb < behind) behind = fb;
    }
    if (n < 2) return null;
    return { ahead, behind, n, C, s: C / n };
  }

  // Automatischer Takt: Zug wartet an der Station, solange er dem Vordermann zu dicht folgt (begrenzt, ohne Verklemmung:
  // Mindestens ein Zug hat immer genug Abstand und fährt; jeder Halt ist zeitlich gedeckelt).
  wantsHold(t, line, speed) {
    if (line.takt === false || t.drag) return false;
    const h = this.gapsOf(t, line);
    if (!h) return false;
    const maxHold = Math.min(TAKT.maxHold, Math.max(TAKT.minHold, TAKT.holdShare * (h.s / Math.max(0.1, speed))));
    if ((t.hold || 0) >= maxHold) return false;
    if (h.ahead < TAKT.close * h.s) return true;
    // ausgleichend: mittig zwischen Vorder- und Hintermann einpendeln (große Lücke hinter dem Zug schließt sich)
    return h.ahead < (h.ahead + h.behind) / 2 - TAKT.tol * h.s;
  }

  // Zug an Spurposition P setzen. Liegt P an einer Station (± snap Felder), hält er dort, sonst fährt er von dort weiter.
  // opts.hold: Zug steht festgehalten (Ziehen im Fahrplan), opts.quiet: kein Fahrgastwechsel an der Station.
  placeAt(t, line, P, opts = {}) {
    const L = line.length, n = line.stops.length;
    if (!(L > 0) || n < 2 || !Number.isFinite(P)) return false;
    P = mod(P, 2 * L);
    // Im Ring ist Station 0 doppeldeutig (P = 0 bzw. L): Richtung darf vorgegeben werden
    let dir = line.loop && (opts.dir === 1 || opts.dir === -1) ? opts.dir : P <= L ? 1 : -1;
    let d = dir > 0 ? P : 2 * L - P;
    d = Math.max(0, Math.min(L, d));
    const snap = Math.max(1e-6, opts.snap || 0);
    let k = -1, kd = Infinity;
    for (let i = 0; i < n; i++) { const dd = Math.abs(line.stopD[i] - d); if (dd < kd) { kd = dd; k = i; } }
    if (line.loop && L - d < kd) { kd = L - d; k = 0; }
    t.hold = 0;
    t.drag = !!opts.hold;
    t.dragT = 0;
    if (kd <= snap) {
      t.dir = dir;
      t.cur = k; t.to = k; t.d = line.stopD[k]; t.targetD = t.d; t.state = 'dwell'; t.dwell = 0.6;
      if (!line.loop) { if (k === 0) t.dir = 1; if (k === n - 1) t.dir = -1; }
      if (!opts.hold && !opts.quiet) this.arrive(t, line);
    } else {
      t.dir = dir; t.d = d; t.state = 'move';
      if (dir > 0) {
        let c = 0;
        for (let i = 0; i < n; i++) if (line.stopD[i] <= d) c = i;
        if (!line.loop) c = Math.min(c, n - 2);
        t.cur = c; t.to = line.loop ? (c + 1) % n : c + 1;
        t.targetD = line.loop && t.to === 0 ? L : line.stopD[t.to];
      } else if (line.loop && d > line.stopD[n - 1]) {
        t.cur = 0; t.to = n - 1; t.targetD = line.stopD[n - 1];
      } else {
        let c = n - 1;
        for (let i = n - 1; i >= 1; i--) if (line.stopD[i] >= d) c = i;
        c = Math.max(1, c);
        t.cur = c; t.to = c - 1; t.targetD = line.stopD[c - 1];
      }
    }
    poseTrain(this, t);
    return true;
  }

  // API: Zug per Id an Spurposition P setzen (siehe trainP). Liefert false bei ungültigen Angaben.
  placeTrain(trainId, P, opts) {
    const t = this.trains.find((x) => x.id === trainId);
    const line = t && this.lines.find((l) => l.id === t.line);
    if (!line || !this.placeAt(t, line, P, opts)) return false;
    this.changed();
    return true;
  }

  // Alle Züge einer Linie auf gleiche Abstände im Umlauf setzen (Reihenfolge bleibt, kleinste Gesamtverschiebung).
  evenOut(line, quiet) {
    const ts = this.trains.filter((t) => t.line === line.id);
    const C = cycLen(line);
    if (!(C > 0)) return false;
    const groups = line.loop ? [ts.filter((t) => t.dir > 0), ts.filter((t) => t.dir < 0)] : [ts];
    let moved = false;
    for (const grp of groups) {
      if (grp.length < 2) continue;
      const items = grp.map((t) => ({ t, q: cycPos(t, line) })).sort((a, b) => a.q - b.q || a.t.id - b.t.id);
      const s = C / items.length;
      // Versatz als Kreismittel von q_i − i·s
      let sx = 0, sy = 0;
      items.forEach((it, i) => { const a = (2 * Math.PI * (it.q - i * s)) / C; sx += Math.cos(a); sy += Math.sin(a); });
      const o = (sx || sy) ? mod((Math.atan2(sy, sx) * C) / (2 * Math.PI), C) : items[0].q;
      const dir = grp[0].dir;
      items.forEach((it, i) => { this.placeAt(it.t, line, cycToP(line, dir, mod(o + i * s, C)), { snap: 1e-4, dir, quiet }); });
      moved = true;
    }
    if (moved) this.changed();
    return moved;
  }

  // Takt-Kennzahlen einer Linie für die Anzeige: Soll-Takt in Sekunden, Abstände, dicht folgende Züge.
  taktInfo(line) {
    const ts = this.trains.filter((t) => t.line === line.id);
    const num = new Map(ts.map((t, i) => [t.id, i + 1]));
    const speed = TRANSIT.speed * ((this.g.mods && this.g.mods.trainSpeed) || 1);
    const n = line.stops.length;
    const C = cycLen(line);
    const dw = (line._dw || 0.9) + 0.25;
    const groups = [];
    for (const dir of line.loop ? [1, -1] : [1]) {
      const grp = line.loop ? ts.filter((t) => t.dir === dir) : ts;
      if (!grp.length) continue;
      const cycleSec = C / speed + (line.loop ? n : 2 * (n - 1)) * dw;
      const items = grp.map((t) => ({ t, q: cycPos(t, line) })).sort((a, b) => a.q - b.q || a.t.id - b.t.id);
      const s = C / grp.length;
      const gaps = [];
      for (let k = 0; k < items.length && items.length > 1; k++) {
        const a = items[k], b = items[(k + 1) % items.length];
        gaps.push({ behind: num.get(a.t.id), ahead: num.get(b.t.id), gap: k + 1 < items.length ? b.q - a.q : b.q + C - a.q });
      }
      const mean = gaps.length ? C / gaps.length : 0;
      const cv = gaps.length ? Math.sqrt(gaps.reduce((acc, x) => acc + (x.gap - mean) ** 2, 0) / gaps.length) / mean : 0;
      const minGap = gaps.reduce((m, x) => Math.min(m, x.gap), Infinity);
      const closest = gaps.reduce((m, x) => (!m || x.gap < m.gap ? x : m), null);
      groups.push({ dir, n: grp.length, headSec: cycleSec / grp.length, cycleSec, s, gaps, cv, minRatio: gaps.length ? minGap / s : 1, closest });
    }
    const worst = groups.reduce((m, x) => (!m || x.minRatio < m.minRatio ? x : m), null);
    return { groups, auto: line.takt !== false, minRatio: worst ? worst.minRatio : 1, closest: worst && worst.minRatio < 1 ? worst.closest : null, num, held: ts.filter((t) => (t.hold || 0) > 0).map((t) => num.get(t.id)) };
  }

  recomputeTracks() {
    const g = this.g;
    g.trackCount.fill(0);
    const seen = new Set();
    for (const line of this.lines) {
      const tiles = new Set();
      if (!line.pts) continue;
      for (let k = 0; k < line.pts.length - 1; k++) {
        const [ax, ay] = line.pts[k], [bx, by] = line.pts[k + 1];
        const len = Math.hypot(bx - ax, by - ay);
        const steps = Math.ceil(len / 0.25);
        for (let s = 0; s <= steps; s++) {
          const x = Math.floor(ax + ((bx - ax) * s) / steps), y = Math.floor(ay + ((by - ay) * s) / steps);
          if (x >= 0 && y >= 0 && x < g.W && y < g.H) tiles.add(y * g.W + x);
        }
      }
      for (const t of tiles) { g.trackCount[t]++; seen.add(t); }
    }
    // Parallele Linien versetzen
    const shared = new Map();
    for (const line of this.lines) {
      const n = line.stops.length;
      const segs = line.loop ? n : n - 1;
      line.segOffset = [];
      for (let k = 0; k < segs; k++) {
        const a = line.stops[k], b = line.stops[(k + 1) % n];
        const key = a < b ? a + '-' + b : b + '-' + a;
        if (!shared.has(key)) shared.set(key, []);
        shared.get(key).push([line, k]);
      }
    }
    for (const list of shared.values()) {
      const c = list.length;
      list.forEach(([line, k], j) => { line.segOffset[k] = (j - (c - 1) / 2) * 0.3; });
    }
  }

  recomputeRouting() {
    const adj = new Map();
    for (const id of this.stations.keys()) adj.set(id, new Set());
    for (const line of this.lines) {
      const n = line.stops.length;
      for (let k = 0; k < n - 1; k++) { adj.get(line.stops[k])?.add(line.stops[k + 1]); adj.get(line.stops[k + 1])?.add(line.stops[k]); }
      if (line.loop && n > 2) { adj.get(line.stops[n - 1])?.add(line.stops[0]); adj.get(line.stops[0])?.add(line.stops[n - 1]); }
    }
    this.dist = new Map();
    for (const dest of this.stations.keys()) {
      const m = new Map([[dest, 0]]);
      const q = [dest];
      for (let h = 0; h < q.length; h++) {
        const s = q[h];
        for (const nb of adj.get(s) || []) if (!m.has(nb)) { m.set(nb, m.get(s) + 1); q.push(nb); }
      }
      this.dist.set(dest, m);
    }
    this.stationLines = new Map();
    for (const line of this.lines) for (const s of line.stops) {
      if (!this.stationLines.has(s)) this.stationLines.set(s, new Set());
      this.stationLines.get(s).add(line.id);
    }
  }

  hops(dest, s) {
    const m = this.dist.get(dest);
    if (!m) return Infinity;
    const v = m.get(s);
    return v === undefined ? Infinity : v;
  }

  updateCatchment(st) {
    const g = this.g;
    const w = [0, 0, 0, 0, 0];
    forDisc(g, st.x + 0.5, st.y + 0.5, TRANSIT.catchment, (t) => {
      const b = g.buildings.get(g.bld[t]);
      if (b && b.zone && !b.abandoned) w[b.zone] += b.occ;
    });
    st.w = w;
    let best = 1, bv = -1;
    for (let z = 1; z <= 4; z++) if (w[z] > bv) { bv = w[z]; best = z; }
    st.shape = bv > 0 ? best : 0;
  }

  hourly() {
    for (const st of this.stations.values()) this.updateCatchment(st);
  }

  // Abdeckungsfeld für Bodenwert, Glück und weniger Autos.
  applyCoverage() {
    const g = this.g;
    const cov = g.cov.transit;
    cov.fill(0);
    g.transitPenalty.fill(0);
    const servedLines = new Set(this.trains.map((t) => t.line));
    for (const st of this.stations.values()) {
      const ls = this.stationLines?.get(st.id);
      let ok = false;
      if (ls) for (const l of ls) if (servedLines.has(l)) ok = true;
      st.active = ok;
      if (!ok) continue;
      const r = TRANSIT.catchment;
      const pen = st.penaltyUntil > g.time;
      forDisc(g, st.x + 0.5, st.y + 0.5, r, (t, d) => {
        const v = 1 - 0.35 * (d / r);
        if (v > cov[t]) cov[t] = v;
        if (pen) g.transitPenalty[t] = 1;
      });
    }
    let share = 0, tot = 0;
    for (const b of g.buildings.values()) {
      if (b.zone !== 1 || b.abandoned) continue;
      share += cov[b.y * g.W + b.x] * 0.35 * b.occ;
      tot += b.occ;
    }
    g.stats.transitShare = tot > 0 ? share / tot : 0;
  }

  spawnPassengers(minutes) {
    const g = this.g;
    if (!this.lines.length) return;
    const h = g.hour();
    const night = h < 5 || h > 23 ? 0.25 : 1;
    const workF = gauss(h, 7.8, 1.6) * 1.3 + 0.12;
    const homeF = gauss(h, 17.3, 1.8) * 1.2 + 0.1;
    const shopF = 0.22 + gauss(h, 13, 3) * 0.5;
    const ridership = (g.policies.has('freetransit') ? 1.4 : 1) * (1 + g.eff('ridership'));
    const k = (minutes / 60) * night * ridership * 0.55;
    // Außerhalb des Metro-Modus nehmen Leute an einer übervollen Station lieber das Auto: Überfüllung bleibt spürbar, wächst aber nicht endlos
    const capWait = g.opts && g.opts.scenario === 'metro' ? Infinity : Math.ceil(TRANSIT.stationCapacity * 1.5);
    for (const st of this.stations.values()) {
      if (!st.active) continue;
      if (st.waiting.length >= capWait) { st.acc = 0; continue; }
      const w = st.w;
      const rWork = w[1] * 0.01 * workF * k;
      const rShop = w[1] * 0.005 * shopF * k;
      const rHome = (w[2] + w[3] + w[4]) * 0.01 * homeF * k;
      st.acc = (st.acc || 0) + rWork + rShop + rHome;
      let guard = 0;
      while (st.acc >= 1 && guard++ < 6) {
        st.acc -= 1;
        const r = g.rng() * (rWork + rShop + rHome);
        let types;
        if (r < rWork) types = [3, 4];
        else if (r < rWork + rShop) types = [2];
        else types = [1];
        // Ziel wählen
        let total = 0;
        const cands = [];
        for (const t of this.stations.values()) {
          if (t === st || !t.active) continue;
          if (this.hops(t.id, st.id) === Infinity) continue;
          for (const z of types) {
            const v = t.w[z];
            if (v > 0) { cands.push([t, z, v]); total += v; }
          }
        }
        if (total <= 0) continue;
        let q = g.rng() * total;
        let pick = cands[cands.length - 1];
        for (const c of cands) { q -= c[2]; if (q <= 0) { pick = c; break; } }
        st.waiting.push({ dest: pick[0].id, shape: pick[1], t: g.time });
      }
      if (st.acc > 4) st.acc = 4;
      // Überfüllung
      if (st.waiting.length > TRANSIT.stationCapacity) {
        st.over += minutes / (TRANSIT.overcrowdDays * 1440);
        if (st.over >= 1) {
          st.over = 0;
          st.penaltyUntil = g.time + 2 * 1440;
          const lost = Math.ceil(st.waiting.length / 2);
          st.waiting.splice(0, lost);
          g.news('transit', `Station ${st.name} ist hoffnungslos überfüllt! ${lost} Fahrgäste geben auf. Mehr Züge oder Waggons einsetzen.`, 'bad', { x: st.x, y: st.y });
          this.changed();
        }
      } else st.over = Math.max(0, st.over - minutes / 720);
      // Fahrgäste ohne erreichbares Ziel verlassen die Station
      if (st.waiting.length) st.waiting = st.waiting.filter((p) => this.hops(p.dest, st.id) !== Infinity && g.time - p.t < 1440 * 1.5);
    }
  }

  update(simSec) {
    if (simSec <= 0) return;
    const g = this.g;
    const speed = TRANSIT.speed * g.mods.trainSpeed;
    for (const t of this.trains) {
      const line = this.lines.find((l) => l.id === t.line);
      if (!line || line.stops.length < 2) continue;
      if (t.drag) {
        // im Fahrplan festgehalten: steht; Sicherung, falls das Loslassen verloren geht
        t.dragT = (t.dragT || 0) + simSec;
        if (t.dragT > 30) t.drag = false;
        continue;
      }
      if (t.state === 'dwell') {
        t.dwell -= simSec;
        if (t.dwell <= 0) {
          if (this.wantsHold(t, line, speed)) t.hold = (t.hold || 0) + simSec;
          else this.depart(t, line);
        }
      } else {
        let step = speed * simSec;
        // sanftes Bremsen vor der Station
        const left = Math.abs(t.targetD - t.d);
        if (left < 0.8) step *= 0.45 + 0.55 * (left / 0.8);
        if (step >= left) { t.d = t.targetD; this.arrive(t, line); }
        else t.d += t.dir * step;
      }
      poseTrain(this, t);
    }
  }

  nextStop(line, cur, dir) {
    const n = line.stops.length;
    if (line.loop) return { next: (cur + dir + n) % n, dir };
    let nx = cur + dir;
    if (nx < 0 || nx >= n) { dir = -dir; nx = cur + dir; }
    return { next: nx, dir };
  }

  depart(t, line) {
    // Wer auf den Takt gewartet hat, nimmt die inzwischen angekommenen Fahrgäste noch mit
    if (t.hold > 0) {
      const st = this.stations.get(line.stops[t.cur]);
      if (st && st.waiting.length) this.board(t, line, st);
    }
    const dw = (t.dw0 || 0.6) + (t.hold || 0);
    line._dw = line._dw == null ? dw : line._dw * 0.85 + dw * 0.15;
    t.hold = 0;
    const { next, dir } = this.nextStop(line, t.cur, t.dir);
    t.dir = dir;
    t.to = next;
    const n = line.stops.length;
    if (line.loop) {
      if (dir > 0) t.targetD = next === 0 ? line.length : line.stopD[next];
      else {
        if (t.cur === 0) t.d = line.length;
        t.targetD = line.stopD[next];
      }
    } else t.targetD = line.stopD[next];
    void n;
    t.state = 'move';
  }

  arrive(t, line) {
    const g = this.g;
    const capWait = g.opts && g.opts.scenario === 'metro' ? Infinity : Math.ceil(TRANSIT.stationCapacity * 1.5);
    t.cur = t.to;
    if (line.loop && t.d >= line.length - 1e-6) t.d = 0;
    t.state = 'dwell';
    const sid = line.stops[t.cur];
    const st = this.stations.get(sid);
    const { next } = this.nextStop(line, t.cur, t.dir);
    const nextSid = line.stops[next];
    let moved = 0;
    const keep = [];
    for (const p of t.pax) {
      if (p.dest === sid) {
        moved++;
        this.deliveredToday++;
        this.deliveredTotal++;
        this.faresToday += TRANSIT.fare;
        line.ridersToday++;
        if (st) st.served++;
      } else if (this.hops(p.dest, nextSid) < this.hops(p.dest, sid)) keep.push(p);
      else {
        moved++;
        // Umsteigen: Außerhalb des Metro-Modus gilt dieselbe Obergrenze wie für neue Fahrgäste – an einer übervollen
        // Station nehmen Umsteiger lieber das Auto (sonst stauen sich an Knoten Tausende und der Spielstand wird riesig)
        if (st && (capWait === Infinity || st.waiting.length < capWait)) st.waiting.push(p);
      }
    }
    t.pax = keep;
    if (st) {
      moved += this.board(t, line, st);
      if (this.arrivals.length < 40) this.arrivals.push({ line: line.color, station: sid, n: moved });
    }
    t.dwell = 0.45 + moved * 0.09;
    t.dw0 = t.dwell;
    t.hold = 0;
    void g;
  }

  // Wartende einsteigen lassen, die mit diesem Zug ihrem Ziel näher kommen
  board(t, line, st) {
    const sid = line.stops[t.cur];
    const nextSid = line.stops[this.nextStop(line, t.cur, t.dir).next];
    const cap = this.trainCapacity(t);
    const stay = [];
    let moved = 0;
    for (const p of st.waiting) {
      if (t.pax.length < cap && this.hops(p.dest, nextSid) < this.hops(p.dest, sid)) { t.pax.push(p); moved++; }
      else stay.push(p);
    }
    st.waiting = stay;
    return moved;
  }

  daily() {
    for (const l of this.lines) { l.riders = l.ridersToday; l.ridersToday = 0; }
    this.g.stats.ridersToday = this.deliveredToday;
    this.deliveredToday = 0;
  }

  changed() { this.version++; }

  serialize() {
    return {
      stations: [...this.stations.values()].map((s) => ({ id: s.id, x: s.x, y: s.y, name: s.name, waiting: s.waiting, over: s.over, penaltyUntil: s.penaltyUntil })),
      lines: this.lines.map((l) => ({ id: l.id, color: l.color, stops: l.stops, loop: l.loop, takt: l.takt !== false, par: l.par || 0 })),
      // Position (d), Ziel (to), Zustand, Haltezeit und Takt-Wartezeit, damit Züge nach dem Laden verteilt weiterfahren
      trains: this.trains.map((t) => ({ id: t.id, line: t.line, cur: t.cur, dir: t.dir, wagons: t.wagons, pax: t.pax, d: t.d, to: t.to, st: t.state === 'move' ? 'move' : 'dwell', dwell: t.dwell, hold: t.hold || 0 })),
      linesMax: this.linesMax, freeTrains: this.freeTrains, freeWagons: this.freeWagons,
      nextStation: this.nextStation, nextLine: this.nextLine, nextTrain: this.nextTrain, deliveredTotal: this.deliveredTotal,
    };
  }

  load(d) {
    const g = this.g;
    this.stations = new Map();
    this.usedNames = new Set();
    for (const s of d.stations) {
      this.stations.set(s.id, { ...s, w: [0, 0, 0, 0, 0], served: 0 });
      this.usedNames.add(s.name);
      g.stationAt[s.y * g.W + s.x] = s.id;
    }
    this.lines = d.lines.map((l) => ({ ...l, takt: l.takt !== false, ridersToday: 0, riders: 0, pts: [], cum: [0], stopD: [], pair: [], length: 0 }));
    this.trains = [];
    Object.assign(this, { linesMax: d.linesMax, freeTrains: d.freeTrains, freeWagons: d.freeWagons, nextStation: d.nextStation, nextLine: d.nextLine, nextTrain: d.nextTrain, deliveredTotal: d.deliveredTotal || 0 });
    for (const l of this.lines) this.rebuildLine(l);
    const oldStyle = new Set();
    for (const t of d.trains) {
      const line = this.lines.find((l) => l.id === t.line);
      if (!line) continue;
      const n = line.stops.length, L = line.length;
      const cur = Number.isInteger(t.cur) && t.cur >= 0 && t.cur < n ? t.cur : 0;
      const dir = t.dir < 0 ? -1 : 1;
      const tr = { id: t.id, line: t.line, d: line.stopD[cur] || 0, dir, cur, to: cur, targetD: 0, state: 'dwell', dwell: 0.5, hold: 0, pax: t.pax || [], wagons: t.wagons, x: 0, y: 0, z: 0, yaw: 0 };
      if (!line.loop) { if (cur === 0) tr.dir = 1; else if (cur === n - 1) tr.dir = -1; }
      this.trains.push(tr);
      if (Number.isFinite(t.d) && t.d >= -1e-6 && t.d <= L + 1e-6 && n > 1) {
        if (Number.isFinite(t.dwell)) tr.dwell = Math.max(-1, Math.min(20, t.dwell));
        if (Number.isFinite(t.hold) && t.hold > 0) tr.hold = Math.min(60, t.hold);
        tr.dir = dir;
        const ns = this.nextStop(line, cur, dir);
        const dA = line.loop && cur === 0 && dir < 0 ? L : line.stopD[cur];
        const dB = line.loop && t.to === 0 && dir > 0 ? L : line.stopD[t.to];
        if (t.st === 'move' && ns.next === t.to && ns.dir === dir && t.d >= Math.min(dA, dB) - 1e-6 && t.d <= Math.max(dA, dB) + 1e-6) {
          Object.assign(tr, { state: 'move', d: t.d, to: t.to, targetD: dB });
        } else if (t.st !== 'move' && Math.abs(t.d - line.stopD[cur]) < 1e-6) tr.d = t.d;
        else this.placeAt(tr, line, dir > 0 ? t.d : 2 * L - t.d, { quiet: true, dir }); // unstimmig: an derselben Stelle neu einordnen
      } else oldStyle.add(line);
      poseTrain(this, tr);
    }
    // Alte Spielstände kannten nur die Station: Züge der Linie gleichmäßig verteilen statt alle gleichzeitig loszuschicken
    for (const line of oldStyle) this.evenOut(line, true);
    for (const st of this.stations.values()) this.updateCatchment(st);
    this.recomputeRouting();
    this.changed();
  }
}

// Position auf der Linie (Distanz d) → Weltkoordinaten inkl. Parallelversatz.
export function linePose(tr, line, d, out) {
  const g = tr.g;
  const pts = line.pts, cum = line.cum;
  if (!pts.length) { out.x = 0; out.z = 0; out.yaw = 0; return out; }
  if (line.loop) { d = ((d % line.length) + line.length) % line.length; }
  else d = Math.max(0, Math.min(line.length, d));
  let lo = 0, hi = cum.length - 1;
  while (lo < hi - 1) { const m = (lo + hi) >> 1; if (cum[m] <= d) lo = m; else hi = m; }
  const k = Math.min(lo, pts.length - 2);
  const [ax, ay] = pts[k], [bx, by] = pts[k + 1];
  const segL = cum[k + 1] - cum[k] || 1;
  const t = (d - cum[k]) / segL;
  let dx = (bx - ax) / segL, dy = (by - ay) / segL;
  const off = (line.segOffset && line.segOffset[line.pair[k + 1]]) || 0;
  out.x = ax + (bx - ax) * t - dy * off - g.W / 2;
  out.z = ay + (by - ay) * t + dx * off - g.H / 2;
  out.yaw = Math.atan2(dx, dy);
  return out;
}

function poseTrain(tr, t) {
  const line = tr.lines.find((l) => l.id === t.line);
  if (!line) return;
  linePose(tr, line, t.d, t);
}
