// Fahrbahn für alle Straßenfahrzeuge: Fahrwege auf den Fahrstreifen, Kreuzungen, Ampeln, Vorfahrt, Zebrastreifen.
// Reine Rechnung ohne Three.js – läuft headless (test/fahrt-test.mjs) und im Browser.
//
// Route: Feldfolge → Fahrstücke. Jedes Stück ist (ein Teil) einer Bewegung durch ein Feld von einer Einfahrtseite zu
//   einer Ausfahrtseite: Gerade (Länge 1), Kurve (Viertelkreis mit Radius 0,5 um die Feldecke wie die Fahrbahn in
//   roads.js, Länge π/4) oder Wendeschleife (Tropfenform im Feld). Anfang und Ende einer Fahrt sind halbe Bewegungen
//   (von bzw. bis zur Feldmitte). Das Bogenmaß S zählt auf der Mittellinie; der Fahrstreifen liegt quer daneben
//   (rechts der Fahrtrichtung) und gleitet zwischen Straßentypen weich hinüber. Alle Werte eines Stücks liegen in
//   einem Satz von 16 Zahlen (eine Cache-Zeile) – bei über tausend Fahrzeugen zählt jeder Speicherzugriff.
// Flow: je Bild die Belegung aller Fahrstreifen (Feld × Einfahrtseite × Spur) – daraus Folgefahrt nach dem
//   Intelligent-Driver-Modell (sanft anfahren, rechtzeitig bremsen, Abstand halten), Haltelinien an Ampeln
//   (gleiche Phasen wie die gezeichneten Ampeln), Vorfahrt (Rechts vor links, Vorfahrtstraße, Linksabbieger),
//   Kreuzungsbelegung mit Konflikttabelle (nie zwei kreuzende Fahrzeuge zugleich auf der Kreuzung), „Kreuzung frei
//   halten" und Zebrastreifen: Fußgänger melden sich an (markCrossing), Fahrzeuge warten; Fahrzeuge, die nicht mehr
//   halten können, sperren die Zone für Fußgänger (crossingFree).
//   Lange Fahrzeuge: Busse und Lkw schwenken beim Rechtsabbiegen mit Front und Heck über die Mitte – dafür weitere
//   Konflikte auf der Kreuzung (sweepConflicts), zurückversetzte Haltelinien in Arme, in die eine Buslinie rechts
//   abbiegt (setSweepArms), Kurvenfelder ohne Kreuzung für sie allein (wie Wendeschleifen). Zweirichtungs-Straßenbahnen
//   halten an der Endhaltestelle einen Wendebereich frei (setZone), bis sie nach dem Führerstandswechsel aufs eigene
//   Gleis gewechselt haben.
import { R, ROAD_GEOM, minPerSec } from '../config.js';
import { hash2 } from '../util.js';

const DX = [0, 1, 0, -1], DZ = [-1, 0, 1, 0]; // Seiten N O S W (wie roadMask: 1, 2, 4, 8)
const opp = (s) => (s + 2) & 3;
export const QUARTER = Math.PI / 4;
export const MOVE = { STRAIGHT: 0, TURN: 1, UTURN: 2 };
export const LC = { IN: 0, OUT: 1, TRAM: 2 }; // Spurklassen: innen/außen (zweistreifig je Richtung), Gleis
// Querversatz der Fahrstreifen-Mitte je Straßentyp [innen, außen] (Welteinheiten, rechts der Fahrtrichtung)
export const LANE_OFF = { 1: [0.11, 0.11], 2: [0.16, 0.16], 3: [0.14, 0.325], 4: [0.13, 0.345] };
export const TRAM_OFF = 0.15; // Gleismitte (Schienen in views/transport.js bei ±0,085/±0,215)
const MULTI = [false, false, false, true, true];
// Wunschtempo je Straßentyp in Feldern je Sekunde bei ×1 (1 Feld = 10 m): Gasse ~25 km/h, Straße ~36 km/h,
// Allee ~47 km/h, Autobahn ~80 km/h – vorher fuhren alle Autos 1,7 × Straßentempo und ungebremst durch Kurven.
export const V_ROAD = [1, 0.7, 1.0, 1.3, 2.2];
// Kurventempo auf der Mittellinie (rechts: enger Bogen innen, links: weiter Bogen außen)
const V_RIGHT = 0.34, V_LEFT = 0.46, V_UTURN = 0.22;
export const J = { NONE: 0, RVL: 1, YIELD_NS: 2, YIELD_EW: 3, SIGNAL: 4 };
const SIG_P = 20; // Ampelumlauf in Sekunden Spielzeit/minPerSec (wie streetprops.js)

export function sideOf(a, b, W) {
  const d = b - a;
  return d === -W ? 0 : d === 1 ? 1 : d === W ? 2 : d === -1 ? 3 : -1;
}

// Ampelzustand wie streetprops.signalState: 0 grün, 1 gelb, 2 rot, 3 rot-gelb (axis 0 = Nord-Süd, 1 = Ost-West)
export function signalAt(time, phase, axis) {
  let t = (((time / SIG_P + phase) % 1) + 1) % 1 * SIG_P;
  if (axis) t = (t + SIG_P / 2) % SIG_P;
  return t < 8 ? 0 : t < 10 ? 1 : t >= 19 ? 3 : 2;
}
// Fußgänger-Grün über die Arme der Achse axis (wie streetprops.lensOn Licht 4): Restzeit in Sekunden, 0 = rot
export function pedGreenLeft(time, phase, axis) {
  let t = (((time / SIG_P + phase) % 1) + 1) % 1 * SIG_P;
  if (axis) t = (t + SIG_P / 2) % SIG_P;
  return t >= 10.5 && t < 18.5 ? 18.5 - t : 0;
}

// ---------------------------------------------------------------- Wendeschleife (Tropfen) im Feld
// Kanonischer Rahmen: Einfahrt an der Kante z = −0,5 in Richtung +z, rechts = −x; Hinweg auf x = −o, Rückweg x = +o.
// Erst ein kleiner Rechtsbogen (Radius r1), dann der große Linksbogen (Radius R) um die Feldmitte, dann zurück.
// In der Sackgasse (dead) liegt der große Bogen mittig im Wendekreis der Fahrbahn (roads.js), Radius Rd – so bleiben
// auch Busse und Lkw mit den Rädern auf der Fahrbahn.
const UT = new Map();
function uturnShape(o, dead = 0) {
  const key = Math.round(o * 1000) * 1000 + Math.round(dead * 1000);
  let s = UT.get(key);
  if (s) return s;
  const r1 = 0.2, R0 = dead ? Math.max(o + 0.03, dead) : Math.max(0.26, o + 0.03);
  const ca = Math.min(1, (o + r1) / (r1 + R0)), al = Math.acos(ca), sa = Math.sin(al);
  const zc = dead ? 0 : Math.min(0.12, 0.45 - R0);
  let z0 = zc - (r1 + R0) * sa;
  if (z0 < -0.5) z0 = -0.5;
  const pts = [];
  const add = (x, z) => pts.push(x, z);
  add(-o, -0.5);
  for (let i = 1; i <= 4; i++) add(-o, -0.5 + (z0 + 0.5) * (i / 4));
  const nB = 6, nC = 28;
  for (let i = 1; i <= nB; i++) { const f = (al * i) / nB; add(-o - r1 + r1 * Math.cos(f), z0 + r1 * Math.sin(f)); }
  const p0 = Math.PI + al, sweep = Math.PI + 2 * al;
  for (let i = 1; i <= nC; i++) { const f = p0 - (sweep * i) / nC; add(R0 * Math.cos(f), zc + R0 * Math.sin(f)); }
  for (let i = nB - 1; i >= 0; i--) { const f = (al * i) / nB; add(o + r1 - r1 * Math.cos(f), z0 + r1 * Math.sin(f)); }
  for (let i = 1; i <= 4; i++) add(o, z0 + (-0.5 - z0) * (i / 4));
  const n = pts.length / 2;
  const cum = new Float32Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
  s = { pts: Float32Array.from(pts), cum, len: cum[n - 1], n };
  UT.set(key, s);
  return s;
}

// ---------------------------------------------------------------- Route
// Satz je Stück (RS Zahlen, eine Cache-Zeile): 0 Anfang S · 1 Anfang in der Bewegung · 2 Länge der Bewegung ·
// 3–4 Spurversatz innen/außen in der Feldmitte · 5 Gleis · 6 Versatz der Wendeschleife · 7 Belegungsschlüssel ·
// 8 Wunschspur Pkw (Bit 2: zweistreifig) · 9 Wunschspur Bus · 10 Feld · 11 Bits (Einfahrt 2, Ausfahrt 2, Art 2,
// Kurvenrichtung+1 2, Straßentyp 3) · 12–13 Versatz innen/außen an der Einfahrtkante · 14–15 an der Ausfahrtkante.
// Ein Endsatz trägt die Gesamtlänge.
const RS = 16;
const nbMask = (g, i) => {
  const W = g.W, road = g.road, x = i % W, y = (i / W) | 0;
  let m = 0;
  if (y > 0 && road[i - W]) m |= 1;
  if (x < W - 1 && road[i + 1]) m |= 2;
  if (y < g.H - 1 && road[i + W]) m |= 4;
  if (x > 0 && road[i - 1]) m |= 8;
  if (road[i] === R.HIGHWAY && x === 0) m |= 8;
  return m;
};

// path: Feldfolge (zusammenhängend), cyclic: geschlossene Runde. opts.lanes: Spurwahl ('car': innen/außen nach
// Abbiegen, 'bus': außen, 'tram': Gleis) – bestimmt auch die Form der Wendeschleifen.
export class Route {
  constructor(g, path, cyclic = false, opts = {}) {
    const W = g.W, road = g.road;
    const n = path.length;
    this.W = W; this.ox = -g.W / 2 + 0.5; this.oz = -g.H / 2 + 0.5;
    this.path = path; this.cyclic = cyclic && n >= 2; this.n = n;
    const buf = new ArrayBuffer((n + 1) * RS * 4);
    const F = this.F = new Float32Array(buf), I = this.I = new Int32Array(buf);
    const cyc = this.cyclic;
    const lanes = opts.lanes || 'car';
    const other = (t, s) => { const m = nbMask(g, t); const b = opp(s); if (m & (1 << b)) return b; for (let d = 0; d < 4; d++) if (d !== s && (m & (1 << d))) return d; return b; };
    let S = 0;
    for (let k = 0; k < n; k++) {
      const t = path[k], b = k * RS;
      const rt = road[t] || R.STREET;
      const prev = k > 0 ? path[k - 1] : cyc ? path[n - 1] : -1;
      const next = k < n - 1 ? path[k + 1] : cyc ? path[0] : -1;
      let e = prev >= 0 ? sideOf(t, prev, W) : -1, x = next >= 0 ? sideOf(t, next, W) : -1;
      let part = 1; // 1 ganz, 2 zweite Hälfte (Anfang), 3 erste Hälfte (Ende), 4 nur Mitte
      if (e < 0 && x < 0) { x = 1; e = 3; part = 4; }
      else if (e < 0) { e = other(t, x); part = 2; }
      else if (x < 0) { x = other(t, e); part = 3; }
      let mv = MOVE.STRAIGHT, full = 1, sg = 0, uo = 0;
      if (x === e) {
        mv = MOVE.UTURN;
        uo = lanes === 'tram' ? TRAM_OFF : (LANE_OFF[rt] || LANE_OFF[2])[lanes === 'bus' ? 1 : 0];
        const m = nbMask(g, t);
        let dead = 0;
        if (m === (1 << e)) { const hw = (ROAD_GEOM[rt] || ROAD_GEOM[2]).width / 2; dead = Math.min(0.44, Math.max(0.28, hw * 1.35)) - 0.125; }
        const sh = uturnShape(uo, dead);
        (this.shp || (this.shp = []))[k] = sh;
        full = sh.len;
      } else if (x !== opp(e)) {
        mv = MOVE.TURN; full = QUARTER;
        sg = DX[e] * DZ[x] - DZ[e] * DX[x];
      }
      const half = full / 2;
      const a = part === 2 || part === 4 ? half : 0;
      const len = part === 1 ? full : part === 4 ? 0 : half;
      F[b] = S; F[b + 1] = a; F[b + 2] = full; F[b + 6] = uo;
      I[b + 10] = t;
      I[b + 11] = e | (x << 2) | (mv << 4) | ((sg + 1) << 6) | (rt << 8);
      S += len;
    }
    F[n * RS] = S;
    this.len = S;
    // Nachbarfeld hinter dem Routenende (Ausfahrtseite des letzten Stücks) und vor dem Anfang: Straßenbahnen stehen
    // an der Endhaltestelle mit der Spitze bis kurz vor die Feldkante – dort kann ein Zebrastreifen liegen
    this.endT = -1; this.startT = -1;
    if (!this.cyclic && n >= 1) {
      const nb = (t, d) => { const x = (t % W) + DX[d], y = ((t / W) | 0) + DZ[d]; return x >= 0 && y >= 0 && x < W && y < g.H && road[y * W + x] ? y * W + x : -1; };
      const bl = I[(n - 1) * RS + 11], b0 = I[11];
      this.endT = nb(path[n - 1], (bl >> 2) & 3); this.endSide = opp((bl >> 2) & 3);
      this.startT = nb(path[0], b0 & 3); this.startSide = opp(b0 & 3);
    }
    // Fahrstreifen je Stück: Versatz innen/außen (gleich auf einstreifigen Straßen), Gleis; Wunschspur vor dem
    // Abbiegen (dieses oder die nächsten zwei Felder: rechts → außen, links → innen; Busse sonst außen am Bordstein).
    // An einer Feldkante gilt der breitere der beiden Straßentypen (wie die Fahrbahn in roads.js); auf Kreuzungen
    // liegt die Mitte zwischen Einfahrt und Ausfahrt (die Kreuzung selbst kann eine schmale Straße sein).
    const rtOf = (t) => road[t] || R.STREET;
    for (let k = 0; k < n; k++) {
      const b = k * RS, bits = I[b + 11];
      const t = path[k], rt = (bits >> 8) & 7;
      const prev = k > 0 ? path[k - 1] : cyc ? path[n - 1] : -1;
      const next = k < n - 1 ? path[k + 1] : cyc ? path[0] : -1;
      const rIn = prev >= 0 ? Math.max(rt, rtOf(prev)) : rt, rOut = next >= 0 ? Math.max(rt, rtOf(next)) : rt;
      const li = LANE_OFF[rIn] || LANE_OFF[2], lo2 = LANE_OFF[rOut] || LANE_OFF[2], lc = LANE_OFF[rt] || LANE_OFF[2];
      const m = nbMask(g, t), deg = (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
      for (let sb = 0; sb < 2; sb++) {
        F[b + 12 + sb] = li[sb]; F[b + 14 + sb] = lo2[sb];
        F[b + 3 + sb] = deg >= 3 ? (li[sb] + lo2[sb]) / 2 : lc[sb];
      }
      F[b + 5] = TRAM_OFF;
      let turn = 0;
      for (let j = k; j <= k + 2; j++) {
        if (j >= n && !cyc) break;
        const q = j % n, bq = I[q * RS + 11];
        if (((bq >> 4) & 3) === MOVE.TURN) { turn = ((bq >> 6) & 3) - 1; break; }
      }
      const multi = MULTI[rt] || MULTI[rIn] || MULTI[rOut];
      I[b + 7] = (t * 4 + (bits & 3)) << 1;
      // Wunschspur: 0 innen, 1 außen, 3 egal; Bit 2: mehrstreifig
      I[b + 8] = (!multi ? 3 : turn < 0 ? 1 : turn > 0 ? 0 : 3) | (multi ? 4 : 0);
      I[b + 9] = !multi ? 3 : turn > 0 ? 0 : 1;
    }
  }

  // Gleiswechsel am Routenanfang (Zweirichtungs-Straßenbahn an der Endhaltestelle): ab S = xs über len hinüber
  setCrossover(xs, len) { this.xs = xs; this.xe = xs + len; }

  // Zugriffe auf den Satz eines Stücks
  p(k) { return this.F[k * RS]; }
  loc(k) { return this.F[k * RS + 1]; }
  full(k) { return this.F[k * RS + 2]; }
  plen(k) { return this.F[(k + 1) * RS] - this.F[k * RS]; }
  key(k, sub = 0) { return this.I[k * RS + 7] | sub; }
  multi(k) { return (this.I[k * RS + 8] & 4) !== 0; }
  pref(k, bus) { return bus ? this.I[k * RS + 9] : this.I[k * RS + 8] & 3; }
  tile(k) { return this.I[k * RS + 10]; }
  ent(k) { return this.I[k * RS + 11] & 3; }
  ext(k) { return (this.I[k * RS + 11] >> 2) & 3; }
  mv(k) { return (this.I[k * RS + 11] >> 4) & 3; }
  sg(k) { return ((this.I[k * RS + 11] >> 6) & 3) - 1; }
  rt(k) { return (this.I[k * RS + 11] >> 8) & 7; }
  next(k) { return k + 1 < this.n ? k + 1 : this.cyclic ? 0 : -1; }
  prev(k) { return k > 0 ? k - 1 : this.cyclic ? this.n - 1 : -1; }

  wrap(S) { if (!this.cyclic) return S; const L = this.len; return ((S % L) + L) % L; }
  // Stück zu S (gewickelt), Suche ab Startwert
  find(S, hint = 0) {
    const F = this.F, n = this.n;
    let k = hint >= 0 && hint < n ? hint : 0;
    while (k > 0 && S < F[k * RS]) k--;
    while (k < n - 1 && S >= F[(k + 1) * RS]) k++;
    return k;
  }
  // Abstand von S (ungewickelt) bis zum Anfang von Stück k in Fahrtrichtung
  ahead(S, k) {
    let d = this.F[k * RS] - this.wrap(S);
    if (this.cyclic && d < -1e-6) d += this.len;
    return d;
  }
  // Versatz an lokaler Stelle u (in der ganzen Bewegung) von Stück k für Spur sub (0 innen, 1 außen, 2 Gleis);
  // an den Feldkanten der Mittelwert beider Nachbarn, damit der Fahrstreifen zwischen Straßentypen weich gleitet
  offAt(k, u, sub) {
    const F = this.F, b = k * RS;
    const oc = F[b + 3 + sub];
    const h = F[b + 2] / 2;
    if (u < h) { const o0 = F[b + 12 + sub]; return o0 + (oc - o0) * (u / h); }
    const o1 = F[b + 14 + sub];
    return oc + (o1 - oc) * ((u - h) / h);
  }
  // Querversatz für Spurklasse cls und Spurlage lp (0 innen … 1 außen; +2: langes Fahrzeug, holt in Kurven weit aus)
  laneAt(k, u, cls, lp) {
    let o;
    const wide = lp >= 2;
    if (wide) lp -= 2;
    if (cls === LC.TRAM) {
      o = this.F[k * RS + 5];
      // Gleiswechsel hinter der Endhaltestelle: vom Ankunftsgleis (links) aufs eigene Gleis (rechts)
      if (this.xe > 0) {
        const S = this.F[k * RS] + u - this.F[k * RS + 1];
        if (S < this.xe) { let f = S <= this.xs ? 0 : (S - this.xs) / (this.xe - this.xs); f = f * f * (3 - 2 * f); o *= 2 * f - 1; }
      }
    } else if (lp <= 0) o = this.offAt(k, u, 0);
    else if (lp >= 1) o = this.offAt(k, u, 1);
    else { const a = this.offAt(k, u, 0); o = a + (this.offAt(k, u, 1) - a) * lp; }
    // Lange Fahrzeuge biegen mit größerem Bogen ab (Mitte der Kurve näher an der Fahrbahnmitte)
    if (wide && ((this.I[k * RS + 11] >> 4) & 3) === MOVE.TURN) {
      const h = this.F[k * RS + 2] / 2, w = 1 - Math.abs(u - h) / h;
      const f = ((this.I[k * RS + 11] >> 6) & 3) === 0 ? 0.55 : 0.8; // rechts stärker
      o *= 1 - (1 - f) * Math.min(1, w * 1.6);
    }
    return o;
  }
  // Lage bei S (ungewickelt) auf Spurklasse cls, Spurlage lp: out.x, out.z (Welt), out.hx, out.hz (Richtung), out.k
  at(S, cls, out, lp = 0) {
    let extra = 0;
    if (this.cyclic) S = this.wrap(S);
    else if (S < 0) { extra = S; S = 0; }
    else if (S > this.len) { extra = S - this.len; S = this.len; }
    const k = this.find(S, out.k);
    out.k = k;
    this.local(k, S - this.F[k * RS] + this.F[k * RS + 1], cls, out, lp);
    if (extra) { out.x += out.hx * extra; out.z += out.hz * extra; }
    return out;
  }
  local(k, u, cls, out, lp = 0) {
    const b = k * RS, bits = this.I[b + 11], t = this.I[b + 10], W = this.W;
    const cx = (t % W) + this.ox, cz = ((t / W) | 0) + this.oz;
    const e = bits & 3, x = (bits >> 2) & 3, mv = (bits >> 4) & 3;
    if (mv === MOVE.STRAIGHT) {
      const o = this.laneAt(k, u, cls, lp);
      const hx = -DX[e], hz = -DZ[e];
      out.x = cx + hx * (u - 0.5) - hz * o;
      out.z = cz + hz * (u - 0.5) + hx * o;
      out.hx = hx; out.hz = hz;
    } else if (mv === MOVE.TURN) {
      const o = this.laneAt(k, u, cls, lp);
      const th = u * 2;
      const c = Math.cos(th), s = Math.sin(th);
      const rx = -c * DX[x] - s * DX[e], rz = -c * DZ[x] - s * DZ[e];
      const r = 0.5 + (((bits >> 6) & 3) - 1) * o;
      out.x = cx + 0.5 * (DX[e] + DX[x]) + r * rx;
      out.z = cz + 0.5 * (DZ[e] + DZ[x]) + r * rz;
      out.hx = s * DX[x] - c * DX[e];
      out.hz = s * DZ[x] - c * DZ[e];
    } else {
      const sh = (this.shp && this.shp[k]) || uturnShape(this.F[b + 6]);
      const cum = sh.cum, pts = sh.pts;
      let lo = 0, hi = sh.n - 1;
      if (u <= 0) hi = 1; else if (u >= sh.len) lo = sh.n - 2;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= u) lo = m; else hi = m; }
      const L = cum[hi] - cum[lo] || 1e-6;
      const f = Math.max(0, Math.min(1, (u - cum[lo]) / L));
      const X = pts[lo * 2] + (pts[hi * 2] - pts[lo * 2]) * f, Z = pts[lo * 2 + 1] + (pts[hi * 2 + 1] - pts[lo * 2 + 1]) * f;
      const tX = (pts[hi * 2] - pts[lo * 2]) / L, tZ = (pts[hi * 2 + 1] - pts[lo * 2 + 1]) / L;
      // kanonisch +z → Einfahrtrichtung h, +x → (hz, −hx)
      const hx = -DX[e], hz = -DZ[e];
      out.x = cx + X * hz + Z * hx;
      out.z = cz - X * hx + Z * hz;
      out.hx = tX * hz + tZ * hx;
      out.hz = -tX * hx + tZ * hz;
    }
    return out;
  }
  // Abbiegen voraus innerhalb von dist (ab Front S, Stück-Hinweis k): −1 rechts, +1 links, 0 geradeaus (Blinker)
  turnAhead(S, k, dist) {
    let d = this.ahead(S, k);
    for (let i = 0; i < 4 && k >= 0; i++) {
      const mv = this.mv(k);
      if (d > dist) break;
      if (mv === MOVE.TURN) return this.sg(k);
      if (mv === MOVE.UTURN) return 1;
      d += this.plen(k);
      k = this.next(k);
    }
    return 0;
  }
}

// Punkt auf der Route hinter einem Bezugspunkt im festen Sehnenabstand d (Achsen, Königszapfen, Gelenke):
// sucht S' < S0 mit |at(S') − (px, pz)| = d. Gibt S' zurück, Lage in out.
export function chordBack(route, cls, S0, px, pz, d, out, lp = 0, iters = 4) {
  let s = S0 - d;
  for (let it = 0; it < iters; it++) {
    route.at(s, cls, out, lp);
    const ex = out.x - px, ez = out.z - pz, err = d - Math.sqrt(ex * ex + ez * ez);
    if (err < 0.002 && err > -0.002) break;
    s -= err * 1.05;
  }
  return s;
}

// ---------------------------------------------------------------- Konflikttabelle der Bewegungen auf Kreuzungen
// Zwei Bewegungen (Einfahrt e, Ausfahrt x) kreuzen sich, wenn sich ihre Fahrwege (Straßenspur 0,16) näher als eine
// Wagenbreite kommen. Gleiche Einfahrt: kein Konflikt (Folgefahrt regelt das).
function movePoints(e, x) {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const f = i / 12;
    if (x === e) { pts.push([0, 0]); continue; }
    if (x === opp(e)) {
      const hx = -DX[e], hz = -DZ[e];
      pts.push([hx * (f - 0.5) - hz * 0.16, hz * (f - 0.5) + hx * 0.16]);
      continue;
    }
    const sg = DX[e] * DZ[x] - DZ[e] * DX[x], th = f * Math.PI / 2;
    const c = Math.cos(th), s = Math.sin(th), r = 0.5 + sg * 0.16;
    pts.push([0.5 * (DX[e] + DX[x]) + r * (-c * DX[x] - s * DX[e]), 0.5 * (DZ[e] + DZ[x]) + r * (-c * DZ[x] - s * DZ[e])]);
  }
  return pts;
}
const CONF = (() => {
  const T = new Uint8Array(256);
  const S = [];
  for (let m = 0; m < 16; m++) S.push(movePoints(m >> 2, m & 3));
  for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) {
    const ea = a >> 2, xa = a & 3, eb = b >> 2, xb = b & 3;
    let c = 0;
    if (ea === eb) c = 0;
    else if (xa === ea || xb === eb) c = 1; // Wenden kreuzt alles
    else if (xa === xb) c = 1;              // gleiche Ausfahrt: Einfädeln
    else {
      let md = 9;
      for (const p of S[a]) for (const q of S[b]) md = Math.min(md, Math.hypot(p[0] - q[0], p[1] - q[1]));
      c = md < 0.21 ? 1 : 0;
    }
    T[a * 16 + b] = c;
  }
  return T;
})();
export function conflicts(e1, x1, e2, x2) { return CONF[(e1 * 4 + x1) * 16 + e2 * 4 + x2] === 1; }
// Ein langes Fahrzeug (Bus, Lkw) biegt rechts ab (e1 → x1): Front und Heck schwenken über die Mitte – in die
// Gegenspur des Ausfahrtarms (wer von dort einfährt) und des Einfahrtarms (wer dorthin ausfährt)
export function sweepConflicts(e1, x1, e2, x2) {
  if (x1 === e1 || x1 === opp(e1) || DX[e1] * DZ[x1] - DZ[e1] * DX[x1] >= 0) return false;
  return e2 === x1 || x2 === e1;
}

// ---------------------------------------------------------------- Fahrzeugtypen (Länge, Breite, Achsen)
// Maße wie die Modelle in render/vehicles_models.js (Länge, Breite, Vorderachse, Hinterachse; Ursprung Mitte)
export const VDIM = {
  car_compact: [0.425, 0.179, 0.1245, -0.1385], car_sedan: [0.475, 0.183, 0.145, -0.14], car_kombi: [0.48, 0.183, 0.147, -0.141],
  car_suv: [0.465, 0.19, 0.142, -0.137], car_small: [0.36, 0.165, 0.112, -0.115], car_coupe: [0.45, 0.185, 0.14, -0.13],
  minibus: [0.52, 0.196, 0.165, -0.17], van: [0.52, 0.196, 0.165, -0.17], van_box: [0.64, 0.21, 0.21, -0.2],
  police: [0.475, 0.183, 0.145, -0.14], police_van: [0.52, 0.196, 0.165, -0.17], taxi: [0.475, 0.183, 0.145, -0.14],
  truck_box: [0.84, 0.25, 0.3, -0.2], truck_tractor: [0.6, 0.25, 0.21, -0.17], tanker: [0.9, 0.25, 0.33, -0.28],
  garbage: [0.92, 0.25, 0.3, -0.22], fire: [0.86, 0.25, 0.3, -0.22], fire_ladder: [1.0, 0.25, 0.34, -0.26],
  ambulance: [0.68, 0.22, 0.24, -0.2], hearse: [0.53, 0.185, 0.17, -0.16], snowplow: [0.9, 0.26, 0.3, -0.22],
  bus: [1.2, 0.255, 0.33, -0.26],
};
// Auflieger: Länge, Königszapfen (vorn, lokal), Achsmitte (hinten, lokal); Sattel der Zugmaschine lokal
export const TRAILER = { len: 1.32, king: 0.56, axle: -0.48, fifth: -0.12 };
export const CAR_TYPES = [['car_compact', 28], ['car_sedan', 16], ['car_kombi', 20], ['car_suv', 16], ['car_small', 12], ['car_coupe', 5], ['minibus', 3]];
const CAR_TOTAL = CAR_TYPES.reduce((s, p) => s + p[1], 0);
export function carModel(u) {
  let r = u * CAR_TOTAL;
  for (const [t, w] of CAR_TYPES) { r -= w; if (r <= 0) return t; }
  return CAR_TYPES[0][0];
}
// Zufall aus einer Zahl (wie vehicles_kit.hashf)
export function hashf(n) {
  let t = (n | 0) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- Flow: Belegung und Fahren
const ENT0 = 4096;
const S0 = 0.06, T_HEAD = 0.55, B_COMF = 0.45, B_MAX = 1.4;
const STOP_ZEBRA = 0.22, STOP_PLAIN = 0.16, STOP_BACK = 0.55;
// Rechenzustand einer Auswertung (ohne Speicheranlage je Fahrzeug und Bild)
const D = { a: 0.5, hard: 99.5, v: 0.5, A: 0.3, s0: S0, Th: T_HEAD, sqAB: 0.7, free: 0.5, g: 0.5, vl: 0.5, so: 0.5 }; // g, vl, so: Argumente für obstD/limD
const pw4 = (x) => { const q = x * x; return q * q; };
// Hindernis im Abstand D.g mit Tempo D.vl, Mindestabstand D.so (Vordermann, Haltelinie): IDM-Bremsterm und harte
// Lagegrenze. Die Werte kommen über D statt als Argumente – so legt der Aufruf keine Kommazahlen an.
function obstD() {
  const gap = D.g, vL = D.vl, s0o = D.so;
  const v = D.v;
  const s = Math.max(0.001, gap - s0o + D.s0);
  const ss = D.s0 + Math.max(0, v * D.Th + (v * (v - vL)) / D.sqAB);
  const r = ss / s;
  const ai = D.A * (D.free - r * r);
  if (ai < D.a) D.a = ai;
  const hg = gap - (s0o > 0.03 ? 0.015 : 0);
  if (hg < D.hard) D.hard = hg;
}
// Tempogrenze D.vl in Entfernung D.g (Kurve, langsamere Straße, Ziel)
function limD() {
  const d = D.g, vl = D.vl;
  const v = D.v;
  if (v <= vl) return;
  const al = (vl * vl - v * v) / (2 * Math.max(0.03, d));
  if (al < D.a) D.a = Math.max(-B_MAX, al);
}
// Vordermann vom selben Arm mit anderer Bewegung (einer biegt ab, der andere fährt geradeaus): lokale Stelle u seiner
// Bewegung (Ausfahrt ox) → Stelle der eigenen Bewegung (Satzbits bits) mit gleichem Fortschritt entlang der
// Einfahrtachse; Infinity, wenn die Wege dort schon weiter als eine Wagenbreite auseinanderliegen
// Lange Fahrzeuge (lng) schwenken beim Abbiegen weit aus: sie rechnen ihre eigene Lage vorsichtig als Fortschritt
// und folgen, bis das Heck des Vordermanns die Kreuzungsmitte gut hinter sich hat.
const R_TURN = 0.14;
function mapLeader(bits, ox, u, lng) {
  const e = bits & 3;
  let p = u, ls = 0;
  if (ox !== e && ox !== opp(e)) {
    const sg = DX[e] * DZ[ox] - DZ[e] * DX[ox], r = 0.5 + sg * R_TURN, th = Math.min(2 * u, Math.PI / 2);
    p = r * Math.sin(th); ls = sg * r * (1 - Math.cos(th));
  }
  const lw = lng ? 0.25 : 0.21;
  if (((bits >> 4) & 3) !== MOVE.TURN) return ls > lw || ls < -lw ? Infinity : p;
  if (lng) return p >= 0.75 ? Infinity : p;
  const sg = ((bits >> 6) & 3) - 1, r = 0.5 + sg * R_TURN;
  if (p >= r) return Infinity;
  const th = Math.asin(p / r);
  const d = ls - sg * r * (1 - Math.cos(th));
  return d > 0.21 || d < -0.21 ? Infinity : th / 2;
}
const YES = () => true;
const _LH = new Float64Array(2);
const _apr = [];   // Zufahrende: [Fahrzeug, Abstand, Ausfahrt] …
const _chain = [];

export class Flow {
  constructor(g) {
    this.g = g;
    this.t = 0;          // Fahrzeit (Sim-Sekunden)
    this.tick = 0;       // Bildzähler der Fahrt
    this.netKey = '';
    const N = g.N;
    this.N = N;
    this.head = new Int32Array(N * 8).fill(-1);
    this.touched = new Int32Array(ENT0); this.nT = 0;
    this.utFlag = new Uint8Array(N);  // Feld mit Wendeschleife in Betrieb
    this.cap = ENT0;
    this.eNext = new Int32Array(ENT0); this.eLo = new Float32Array(ENT0); this.eHi = new Float32Array(ENT0);
    this.eP = new Int32Array(ENT0); this.eExt = new Int8Array(ENT0); this.eK = new Int32Array(ENT0);
    this.nE = 0;
    this.parts = [];
    this.jocc = new Map();       // Kreuzungsfeld → [{ veh, e, x }]
    this.uturn = new Map();      // Feld → Fahrzeug in der Wendeschleife
    this.jwait = new Map();      // Kreuzung → { veh, e, x }: wartet schon lange und hat Vorrang vor kreuzendem Verkehr
    this.zFlag = new Uint8Array(N); // Feld in einem Wendebereich (Straßenbahn wechselt dort auf der Gegenspur das Gleis)
    this.zMap = new Map();       // Feld → { veh, e, x }: gesperrt für Fahrten in Richtung e → x (Ankunftsspur der Bahn)
    this.cwPed = new Uint32Array(N * 4);   // Zebrastreifen: letzter Bildzähler mit Fußgänger
    this.cwCar = new Uint32Array(N * 4);   // … gesperrt bis Bildzähler (Fahrzeug darauf oder kann nicht mehr halten)
    this.sweep = new Uint32Array(N * 4);   // Arm d der Kreuzung: letzter Bildzähler, an dem ein langes Fahrzeug hineinbiegen will
    this.setback = new Uint8Array(N * 4);  // Arm d: Haltelinie zurückversetzt (Buslinie biegt rechts hinein)
    this.jc = new Uint8Array(N);
    this.mask = new Uint8Array(N);
    this.phase = new Float32Array(N);
    this.zebra = new Uint8Array(N * 4);    // Zebrastreifen am Arm d der Kreuzung (Fahrbahnmarkierung wie roads.js)
    this.stats = { admitted: 0, removed: 0 };
    this._per = 1;       // Entscheidungsabstand (Bilder) des gerade ausgewerteten Fahrzeugs
    this.why = 0;        // Grund der letzten Absage an einer Kreuzung (siehe admit)
    this.focus = null;   // { x, z, r2 }: Kamerablick (Darstellung) – fern davon seltener entscheiden
    this.env = 1;        // Tempofaktor der Stadt (Tempo 30, Glätte …)
  }

  // Netz-Kennwerte (Kreuzungsarten, Ampelphasen, Zebrastreifen) – neu bei Straßen- oder Ampeländerungen
  refresh() {
    const g = this.g, T = g.ext && g.ext.transport;
    const key = g.netVersion + '|' + (T ? T._sigKey || (T.signals ? T.signals.length : '') : '-');
    if (key === this.netKey) return;
    this.netKey = key;
    const W = g.W, H = g.H, N = g.N, road = g.road;
    const mask = this.mask, jc = this.jc;
    for (let i = 0; i < N; i++) mask[i] = road[i] ? nbMask(g, i) : 0;
    const sigSet = T && T.signalSet ? T.signalSet : null;
    for (let i = 0; i < N; i++) {
      jc[i] = J.NONE;
      if (!road[i]) continue;
      const m = mask[i];
      const deg = (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
      if (deg < 3) continue;
      let maxT = road[i];
      for (let d = 0; d < 4; d++) {
        if (!(m & (1 << d))) continue;
        const t = d === 3 && i % W === 0 ? R.HIGHWAY : road[i + DX[d] + DZ[d] * W];
        if (t > maxT) maxT = t;
      }
      // wie roads.js junctionClass
      if (maxT <= R.LANE) jc[i] = J.RVL;
      else if (sigSet ? sigSet.has(i) : (deg === 4 || maxT >= R.AVENUE)) jc[i] = J.SIGNAL;
      else jc[i] = (m & 5) === 5 ? J.YIELD_NS : J.YIELD_EW;
      this.phase[i] = hash2(i % W, (i / W) | 0, 913);
    }
    // Zebrastreifen wie roads.js zebraOn: gerades Nachbarfeld vor einer Kreuzung (Straße oder größer, oder Ampel)
    this.zebra.fill(0);
    for (let i = 0; i < N; i++) {
      if (!jc[i] || jc[i] === J.RVL) continue;
      for (let d = 0; d < 4; d++) {
        if (!(mask[i] & (1 << d))) continue;
        const x = (i % W) + DX[d], y = ((i / W) | 0) + DZ[d];
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const a = y * W + x, ma = mask[a];
        if (ma !== 5 && ma !== 10) continue;
        if (road[a] >= R.STREET || jc[i] === J.SIGNAL) this.zebra[i * 4 + d] = 1;
      }
    }
    // Belegungen bleiben: die Fahrzeuge stehen ja noch auf den Kreuzungen (abgerissene Straßen entfernen sie selbst)
  }

  time() { return this.g.time / minPerSec(this.g); }

  // ------------------------------------------------------------ je Bild
  begin(dt) {
    this.refresh();
    this.dt = dt;
    this.t += dt;
    this.tick++;
    const head = this.head, tch = this.touched;
    for (let i = 0; i < this.nT; i++) head[tch[i]] = -1;
    this.nT = 0;
    this.nE = 0;
    this.parts.length = 0;
    this.sigTime = this.time();
  }

  grow() {
    const c = this.cap * 2;
    const cp = (A, T) => { const b = new T(c); b.set(A); return b; };
    this.eNext = cp(this.eNext, Int32Array); this.eLo = cp(this.eLo, Float32Array); this.eHi = cp(this.eHi, Float32Array);
    this.eP = cp(this.eP, Int32Array); this.eExt = cp(this.eExt, Int8Array); this.eK = cp(this.eK, Int32Array);
    this.cap = c;
  }

  // Eintrag mit Grenzen aus _LH[0], _LH[1]
  addEntry(key, p, ext, k) {
    if (this.nE >= this.cap) this.grow();
    const i = this.nE++;
    const h = this.head[key];
    if (h < 0) {
      if (this.nT >= this.touched.length) { const b = new Int32Array(this.touched.length * 2); b.set(this.touched); this.touched = b; }
      this.touched[this.nT++] = key;
    }
    this.eNext[i] = h; this.head[key] = i;
    this.eLo[i] = _LH[0]; this.eHi[i] = _LH[1]; this.eP[i] = p; this.eExt[i] = ext; this.eK[i] = k;
  }

  // Fahrzeug in die Belegung eintragen (Front bei veh.S, Länge veh.len) – auf jedem Stück, das es überdeckt
  register(veh) {
    const p = this.parts.length;
    this.parts.push(veh);
    veh.seen = this.tick;
    const R0 = veh.route;
    if (!R0 || veh.hidden) return;
    const n = R0.n, F = R0.F, I = R0.I, cls = veh.cls, cyc = R0.cyclic;
    let front = R0.wrap(veh.S);
    let k = R0.find(front, veh.k);
    veh.k = k;
    // Spur: einstreifig → 0; zweistreifig → innen/außen nach Spurlage, beim Wechsel und für breite Fahrzeuge beide
    const lat = veh.lat || 0;
    const both = veh.wide || (lat > 0.02 && lat < 0.98);
    const sub = lat >= 0.5 ? 1 : 0;
    // Körperlänge, die noch einzutragen ist. Das Maß S zählt Kurven mit ihrem Nennbogen (Radius 0,5); in einer
    // Rechtskurve ist die Spur innen kürzer, der Körper überdeckt dort also mehr S als seine Länge.
    let rem = veh.len;
    const tick2 = this.tick + 2; // Zebrastreifen unter dem Körper: für Fußgänger gesperrt bis dahin
    for (let guard = 0; guard < 14; guard++) {
      const b = k * RS, bits = I[b + 11];
      const p0 = F[b], p1 = F[b + RS], base = F[b + 1];
      let sc = 1;
      if (((bits >> 4) & 3) === MOVE.TURN && ((bits >> 6) & 3) === 0) sc = 0.5 / (0.5 - (cls === LC.TRAM ? F[b + 5] : F[b + 3 + sub]));
      const top = !cyc && k === n - 1 ? front : Math.min(front, p1);
      let rear = top - rem * sc;
      if ((cyc || k > 0) && rear < p0) { rem -= (top - p0) / sc; rear = p0; } else rem = 0;
      const lo = rear - p0 + base, hi = top - p0 + base;
      if (hi > lo - 1e-6) {
        const k0 = I[b + 7], ex = (bits >> 2) & 3, l = lo;
        _LH[0] = l; _LH[1] = hi;
        if (!(I[b + 8] & 4)) this.addEntry(k0, p, ex, k);
        else if (both || this.jc[I[b + 10]] !== J.NONE) { this.addEntry(k0, p, ex, k); this.addEntry(k0 | 1, p, ex, k); }
        else this.addEntry(cls === LC.TRAM ? k0 : k0 | sub, p, ex, k);
        // Körper auf einem Zebrastreifen vor oder hinter einer Kreuzung: für Fußgänger gesperrt
        const kn = k + 1 < n ? k + 1 : cyc ? 0 : -1, kp = k > 0 ? k - 1 : cyc ? n - 1 : -1;
        if (kn >= 0 && this.jc[I[kn * RS + 10]] !== J.NONE) {
          const fl = F[b + 2];
          if (hi > fl - 0.21 && l < fl - 0.02) { const q = I[kn * RS + 10] * 4 + (I[kn * RS + 11] & 3); if (this.cwCar[q] < tick2) this.cwCar[q] = tick2; }
        }
        if (kp >= 0 && this.jc[I[kp * RS + 10]] !== J.NONE && l < 0.21 && hi > 0.02) { const q = I[kp * RS + 10] * 4 + ((I[kp * RS + 11] >> 2) & 3); if (this.cwCar[q] < tick2) this.cwCar[q] = tick2; }
        // lange Fahrzeuge auf der Kreuzung schwenken über die Zebrastreifen von Ein- und Ausfahrt
        if (veh.long && this.jc[I[b + 10]] !== J.NONE) { const jt = I[b + 10] * 4, q1 = jt + (bits & 3), q2 = jt + ((bits >> 2) & 3); if (this.cwCar[q1] < tick2) this.cwCar[q1] = tick2; if (this.cwCar[q2] < tick2) this.cwCar[q2] = tick2; }
        // über das Routenende hinaus (Spitze der Straßenbahn an der Endhaltestelle)
        if (kn < 0 && R0.endT >= 0 && this.jc[R0.endT] !== J.NONE && hi > F[b + 2] - 0.21) { const q = R0.endT * 4 + R0.endSide; if (this.cwCar[q] < tick2) this.cwCar[q] = tick2; }
        if (kp < 0 && R0.startT >= 0 && this.jc[R0.startT] !== J.NONE && l < 0.21) { const q = R0.startT * 4 + R0.startSide; if (this.cwCar[q] < tick2) this.cwCar[q] = tick2; }
      }
      if (rem <= 1e-6) break;
      if (k > 0) k--;
      else if (cyc) { k = n - 1; front += R0.len; } // rückwärts über den Rundenanfang
      else break;
    }
  }

  // ------------------------------------------------------------ Kreuzungen
  occupants(t) { let a = this.jocc.get(t); if (!a) { a = []; this.jocc.set(t, a); } return a; }
  release(t, veh) {
    const a = this.jocc.get(t);
    if (!a) return;
    for (let i = a.length - 1; i >= 0; i--) if (a[i].veh === veh) a.splice(i, 1);
    if (!a.length) this.jocc.delete(t);
  }
  dropUturn(t, veh) { if (this.uturn.get(t) === veh) { this.uturn.delete(t); this.utFlag[t] = 0; } }
  // Reservierungen je Fahrzeug: [Feld (Wendeschleife: −Feld−1), Freigabe bei S (Heck draußen), Einfahrt bei S] …
  releaseAll(veh) {
    const r = veh.res;
    if (!r) return;
    for (let i = 0; i < r.length; i += 3) { const t = r[i]; if (t >= 0) this.release(t, veh); else this.dropUturn(-t - 1, veh); }
    r.length = 0;
  }
  reserved(veh, t) { const r = veh.res; if (r) for (let i = 0; i < r.length; i += 3) if (r[i] === t) return true; return false; }
  reserve(veh, j, releaseS, entryS) {
    const R0 = veh.route, t = R0.tile(j);
    this.occupants(t).push({ veh, e: R0.ent(j), x: R0.ext(j) });
    (veh.res || (veh.res = [])).push(t, releaseS, entryS);
    this.stats.admitted++;
  }

  // Fahrzeuge, die von Seite d auf Feld J zufahren → _apr: [Fahrzeug, Abstand zur Kante, Ausfahrt] …; Anzahl
  approaching(Jt, d) {
    _apr.length = 0;
    const g = this.g, W = g.W;
    const x = (Jt % W) + DX[d], y = ((Jt / W) | 0) + DZ[d];
    if (x < 0 || y < 0 || x >= W || y >= g.H) return 0;
    const U = y * W + x;
    if (!g.road[U]) return 0;
    const toJ = opp(d);
    for (let s = 0; s < 4; s++) for (let sub = 0; sub < 2; sub++) {
      for (let e = this.head[((U * 4 + s) << 1) | sub]; e >= 0; e = this.eNext[e]) {
        if (this.eExt[e] !== toJ) continue;
        const o = this.parts[this.eP[e]];
        const R0 = o.route;
        if (this.eK[e] !== o.k || R0.tile(o.k) !== U) continue; // nur die Front
        const kj = R0.next(o.k);
        if (kj < 0 || R0.tile(kj) !== Jt) continue;
        _apr.push(o, R0.ahead(o.S, kj), R0.ext(kj));
      }
    }
    return _apr.length / 3;
  }
  // Muss eine Bewegung (e → x) auf J Fahrzeugen weichen, die von Seite side kommen (fahrend, Ankunft unter T s)?
  yieldTo(veh, Jt, side, e, x, T, prioOnly) {
    const n = this.approaching(Jt, side);
    for (let i = 0; i < n; i++) {
      const o = _apr[i * 3], d = _apr[i * 3 + 1], ox = _apr[i * 3 + 2];
      if (o === veh) continue;
      if (prioOnly ? !o.prio : o.v < 0.06) continue;
      if (!conflicts(e, x, side, ox)) continue;
      if (d / Math.max(o.v, 0.25) < (o.prio ? 3.5 : T)) return true;
    }
    return false;
  }

  // Darf veh in Kreuzung J (Stück j) einfahren? Prüft Ampel, Belegung, Vorfahrt, Zebrastreifen, Platz dahinter.
  // 0 ja, 1 rote Ampel, 2 warten (Kreuzung belegt, Vorfahrt, Fußgänger, kein Platz dahinter)
  // (this.why: Grund der letzten Absage, zum Untersuchen: 1 Ampel, 2 Wartender mit Vorrang, 3 Belegung, 4 Schwenk,
  // 5 Unfall, 6 Vorfahrt, 7 Fußgänger, 8 Sperre dahinter, 9 kein Platz dahinter)
  admit(veh, j, distToLine) {
    const R0 = veh.route, Jt = R0.tile(j);
    const e = R0.ent(j), x = R0.ext(j);
    const jc = this.jc[Jt];
    const prio = veh.prio > 0;
    const w = veh.wait || 0;
    // Ampel
    if (jc === J.SIGNAL && !prio) {
      const st = signalAt(this.sigTime, this.phase[Jt], e === 0 || e === 2 ? 0 : 1);
      if (st === 2 || st === 3) { this.why = 1; return 1; }
      if (st === 1 && distToLine > veh.v * veh.v / (2 * B_COMF) + 0.03) { this.why = 1; return 1; }
    }
    // Wer schon lange wartet, kommt zuerst: kreuzende Bewegungen fahren nicht mehr ein, bis er durch ist (sonst
    // findet ein Wartender bei dichtem Querverkehr nie eine Lücke – Kreuzungen belegen sich lückenlos)
    const jw = this.jwait.get(Jt);
    if (jw && jw.veh !== veh) {
      if (jw.veh.done || this.tick - jw.veh.seen > 3) this.jwait.delete(Jt);
      else if (conflicts(e, x, jw.e, jw.x)) { this.why = 2; return 2; }
    }
    // Belegung: keine kreuzende Bewegung auf der Kreuzung
    const occ = this.jocc.get(Jt);
    const lng = !!veh.long && veh.cls !== LC.TRAM;
    if (occ) for (let i = 0; i < occ.length; i++) {
      const o = occ[i];
      if (o.veh === veh) continue;
      if (conflicts(e, x, o.e, o.x) || (lng && sweepConflicts(e, x, o.e, o.x)) || (o.veh.long && o.veh.cls !== LC.TRAM && sweepConflicts(o.e, o.x, e, x))) { this.why = 3; return 2; }
    }
    // langes Fahrzeug biegt rechts ab: Wartende im Ausfahrtarm zurückhalten, Platz für den Schwenk abwarten
    if (lng && R0.mv(j) === MOVE.TURN && R0.sg(j) < 0) {
      this.sweep[Jt * 4 + x] = this.tick;
      if (w < 3 && !this.sweepClear(veh, Jt, e, x)) { this.why = 4; return 2; } // (nach einer Weile vorsichtig trotzdem)
    }
    // Unfallstelle: nur einzeln und im Schritt vorbei
    if (occ && occ.length && this.g.tileDelay && this.g.tileDelay[Jt] >= 1) { this.why = 5; return 2; }
    // Vorfahrt
    if (!prio && w < 4) {
      const turnLeft = R0.mv(j) === MOVE.TURN && R0.sg(j) > 0;
      let y = false;
      if (jc === J.SIGNAL) { if (turnLeft) y = this.yieldTo(veh, Jt, opp(e), e, x, 1.9, false); }
      else if (jc === J.RVL) y = this.yieldTo(veh, Jt, (e + 3) & 3, e, x, 1.9, false); // von rechts
      else {
        const ns = jc === J.YIELD_NS;
        const major = ns ? (e === 0 || e === 2) : (e === 1 || e === 3);
        if (!major) { for (let d = 0; d < 4 && !y; d++) if (d !== e && (ns ? d === 0 || d === 2 : d === 1 || d === 3)) y = this.yieldTo(veh, Jt, d, e, x, 1.9, false); }
        else if (turnLeft) y = this.yieldTo(veh, Jt, opp(e), e, x, 1.9, false);
      }
      // Einsatzfahrzeuge mit Vorrang
      for (let d = 0; d < 4 && !y; d++) if (d !== e) y = this.yieldTo(veh, Jt, d, e, x, 3.5, true);
      if (y) { this.why = 6; return 2; }
    }
    // Zebrastreifen an der Ausfahrt (lange Rechtsabbieger schwenken mit dem Heck auch über den der Einfahrt)
    if (w < 12 && this.tick - this.cwPed[Jt * 4 + x] <= 2) { this.why = 7; return 2; }
    if (lng && w < 12 && R0.mv(j) === MOVE.TURN && R0.sg(j) < 0 && this.tick - this.cwPed[Jt * 4 + e] <= 2) { this.why = 7; return 2; }
    // nicht einfahren, wenn dahinter eine fremde Wendeschleife, Schwenkkurve oder ein Wendebereich wartet
    const jn = R0.next(j);
    if (jn >= 0) {
      const tn = R0.tile(jn);
      if ((this.utFlag[tn] && this.uturn.get(tn) !== veh) || (this.zFlag[tn] && this.zoneBlocks(veh, tn, R0.ent(jn), R0.ext(jn)))) { this.why = 8; return 2; }
    }
    // Kreuzung frei halten: Platz hinter der Kreuzung (nur nach sehr langem Warten trotzdem – Notventil)
    if (w < 20) {
      const need = Math.min(veh.len + 0.1, 1.8);
      if (this.freeAfter(veh, j, need) < need) { this.why = 9; return 2; }
    }
    return 0;
  }

  // Freier Platz auf der eigenen Spur hinter Stück j (bis need), abzüglich Fahrzeuge, die schon dorthin abbiegen
  freeAfter(veh, j, need) {
    const R0 = veh.route, n = R0.n;
    let k = R0.next(j);
    if (k < 0) return 99;
    if (!R0.cyclic && k === n - 1 && veh.endsAtTarget) return 99;
    let free = 99, dist = 0;
    for (let i = 0; i < 3 && dist < need && k >= 0; i++) {
      const key = R0.key(k, R0.multi(k) && (veh.lat || 0) >= 0.5 ? 1 : 0), base = R0.loc(k);
      let best = 99;
      for (let e = this.head[key]; e >= 0; e = this.eNext[e]) {
        const o = this.parts[this.eP[e]];
        if (o === veh) continue;
        // ein zügig wegfahrender Vordermann macht Platz (vorsichtig gerechnet – er kann gleich wieder halten)
        const lo = this.eLo[e] - base + (o.v > 0.3 ? o.v * 0.6 : 0);
        if (lo < best) best = lo;
      }
      if (best < 99) { free = dist + best; break; }
      dist += R0.plen(k);
      k = R0.next(k);
    }
    const occ = this.jocc.get(R0.tile(j));
    if (occ) { const xj = R0.ext(j); for (let i = 0; i < occ.length; i++) { const o = occ[i]; if (o.veh !== veh && o.x === xj) free -= o.veh.len + S0; } }
    return free;
  }

  // ------------------------------------------------------------ Zebrastreifen (Fußgänger)
  // Zone: im Nachbarfeld auf der Seite side der Kreuzung J, 0,03–0,18 von der Kreuzungskante
  markCrossing(Jt, side) { this.cwPed[Jt * 4 + side] = this.tick; }
  pedBusy(Jt, side) { return this.tick - this.cwPed[Jt * 4 + side] <= 2; }
  // Für Fußgänger: kein Fahrzeug, das die Zone gleich überfährt?
  crossingFree(Jt, side) { return this.tick > this.cwCar[Jt * 4 + side]; }
  hasZebra(Jt, side) { return this.zebra[Jt * 4 + side] === 1; }
  // Darf ein Fußgänger jetzt über den Arm side der Kreuzung J (need: Sekunden, die er dafür braucht)?
  // Ampel: nur bei Fußgänger-Grün mit genug Restzeit; sonst bei einer Lücke (kein Fahrzeug, das nicht mehr halten kann)
  pedMayCross(Jt, side, need = 4) {
    if (this.jc[Jt] === J.SIGNAL && pedGreenLeft(this.time(), this.phase[Jt], side === 0 || side === 2 ? 0 : 1) < Math.min(need, 6)) return false;
    return this.tick > this.cwCar[Jt * 4 + side];
  }
  isJunction(t) { return this.jc[t] !== J.NONE; }
  // Zone [zs, zs + 0,17] (Abstand zur Front): vor Fußgängern halten, sonst die eigene Durchfahrt anmelden
  zebraGate(Jt, side, zs, v, len = 0.5) {
    const key = Jt * 4 + side;
    if (zs + 0.17 + len < 0) return false; // ganz vorbei (auch das Heck)
    if (this.tick - this.cwPed[key] <= 2 && zs > v * v / (2 * B_MAX) - 0.03 && zs > -0.01) { (D.g = zs - 0.03, D.vl = 0, D.so = 0, obstD()); return true; }
    // wer nicht mehr bequem halten kann, meldet seine Durchfahrt an (bis zur nächsten eigenen Entscheidung); wer
    // halten kann, hält für Fußgänger, die schon queren – am Zebrastreifen haben sie Vorrang
    if (zs < v * v / (2 * B_COMF) + v * 0.25 + 0.02) { const u = this.tick + this._per + 1; if (this.cwCar[key] < u) this.cwCar[key] = u; }
    return false;
  }

  // Wendebereich einer Zweirichtungs-Straßenbahn: Felder ihrer Route R0 zwischen S0 und S1. Nach dem
  // Führerstandswechsel fährt sie dort auf ihrer Ankunftsspur zurück, bis sie aufs eigene Gleis gewechselt hat –
  // Fahrzeuge in Ankunftsrichtung bleiben so lange davor (wer schon drin ist, fährt weiter hinaus).
  setZone(veh, R0, S0, S1) {
    this.clearZone(veh);
    const tiles = veh.zone = [];
    let k = R0.find(Math.max(0, S0), 0);
    for (; k >= 0 && k < R0.n && R0.p(k) <= S1; k++) {
      const t = R0.tile(k), z = this.zMap.get(t);
      if (z && z.veh !== veh) continue;
      this.zMap.set(t, { veh, e: R0.ent(k), x: R0.ext(k), t0: this.t });
      this.zFlag[t] = 1;
      tiles.push(t);
    }
  }
  // Kreuzungen im Wendebereich ohne andere Fahrzeuge darauf?
  zoneJunctionsFree(veh) {
    const tiles = veh.zone;
    if (!tiles) return true;
    for (const t of tiles) {
      if (this.jc[t] === J.NONE) continue;
      const occ = this.jocc.get(t);
      if (occ) for (const o of occ) if (o.veh !== veh) return false;
    }
    return true;
  }
  clearZone(veh) {
    const tiles = veh.zone;
    if (!tiles) return;
    for (const t of tiles) { const z = this.zMap.get(t); if (z && z.veh === veh) { this.zMap.delete(t); this.zFlag[t] = 0; } }
    veh.zone = null;
  }
  // Fahrzeuge (außer except) auf Route R0 zwischen S0 und S1 (ungewickelt, beide Fahrstreifen) → fn(o); true bricht ab
  scan(R0, S0, S1, except, fn) {
    const w = R0.wrap(S0);
    let off = S0 - w;
    let k = R0.find(w, 0);
    for (let i = 0; i < 16 && k >= 0; i++) {
      const p0 = R0.p(k) + off, base = R0.loc(k);
      if (p0 > S1) break;
      for (let sub = 0; sub < 2; sub++) {
        for (let e = this.head[R0.key(k, sub)]; e >= 0; e = this.eNext[e]) {
          const o = this.parts[this.eP[e]];
          if (o === except) continue;
          const a = this.eLo[e] - base + p0, b = this.eHi[e] - base + p0;
          if (b > S0 && a < S1 && fn(o)) return true;
        }
      }
      const kn = R0.next(k);
      if (kn === 0 && k === R0.n - 1) off += R0.len;
      k = kn;
    }
    return false;
  }
  rangeFree(R0, S0, S1, except) { return !this.scan(R0, S0, S1, except, YES); }
  // Ein Linienfahrzeug wird eingesetzt oder wechselt die Route: gewöhnliche Fahrzeuge unter seinem Körper
  // verschwinden (sonst stünden sie ineinander), Kreuzungen unter dem Körper gelten als belegt
  settle(veh, evict) {
    if (evict) this.scan(veh.route, veh.S - veh.len - 0.05, veh.S + 0.05, veh, (o) => { if (!o.owned) o.done = true; return false; });
    const R0 = veh.route, fw = R0.wrap(veh.S);
    let k = R0.find(fw, veh.k);
    let back = fw - R0.p(k); // Front → Anfang von Stück k
    for (let i = 0; i < 12 && k >= 0; i++) {
      const t = R0.tile(k);
      if (this.jc[t] !== J.NONE && !this.reserved(veh, t)) this.reserve(veh, k, veh.S - back + R0.plen(k) + veh.len, veh.S - back);
      // mitten in einer Wendeschleife eingesetzt: die Schleife gehört ihm, andere im Feld verschwinden
      if (R0.mv(k) === MOVE.UTURN && !this.uturn.get(t)) {
        this.uturn.set(t, veh); this.utFlag[t] = veh.long ? 2 : 1;
        (veh.res || (veh.res = [])).push(-t - 1, veh.S - back + R0.plen(k) + veh.len, veh.S - back);
        if (evict) for (let q = 0; q < 8; q++) for (let en = this.head[t * 8 + q]; en >= 0; en = this.eNext[en]) { const o = this.parts[this.eP[en]]; if (o !== veh && !o.owned) o.done = true; }
      }
      if (back >= veh.len * 1.5) break;
      k = R0.prev(k);
      if (k < 0) break;
      back += R0.plen(k);
    }
  }
  // Sperrt der Wendebereich auf Feld t die Bewegung e → x für veh (das Fahrzeug steht noch nicht darin)?
  zoneBlocks(veh, t, e, x) {
    const z = this.zMap.get(t);
    // auf Kreuzungen auch alles, was den Weg der Bahn auf der Ankunftsspur kreuzt
    if (!z || z.veh === veh || (e !== z.e && x !== z.x && !(this.jc[t] !== J.NONE && conflicts(z.e, z.x, e, x)))) return false;
    const ct = veh.route.tile(veh.k);
    if (this.zFlag[ct]) { const zc = this.zMap.get(ct); if (zc && zc.veh === z.veh) return false; }
    return true;
  }

  // Arme, in die Buslinien rechts abbiegen: dort warten alle mit Abstand zur Kreuzung (keys: Feld·4 + Seite)
  setSweepArms(keys) { this.setback.fill(0); for (const k of keys) this.setback[k] = 1; }
  // Nachbarfeld von t auf Seite d (oder −1)
  nbTile(t, d) {
    const W = this.g.W, x = (t % W) + DX[d], y = ((t / W) | 0) + DZ[d];
    return x >= 0 && y >= 0 && x < W && y < this.g.H && this.g.road[y * W + x] ? y * W + x : -1;
  }
  // Schwenkbereich eines langen Rechtsabbiegers (e → x) auf Feld t frei? Im Ausfahrtarm niemand, der mit der Front
  // näher als 0,55 vor der Kante steht oder nicht mehr halten kann; im Einfahrtarm niemand, der langsam gerade erst
  // hinausgefahren ist (das Heck schwenkt dorthin).
  sweepClear(veh, t, e, x) {
    const A = this.nbTile(t, x);
    if (A >= 0) {
      const toT = opp(x);
      for (let s = 0; s < 4; s++) {
        if (s === toT) continue;
        for (let sub = 0; sub < 2; sub++) for (let q = this.head[((A * 4 + s) << 1) | sub]; q >= 0; q = this.eNext[q]) {
          if (this.eExt[q] !== toT) continue;
          const o = this.parts[this.eP[q]];
          if (o === veh || this.eK[q] !== o.k) continue; // nur die Front
          const depth = o.route.full(o.k) - this.eHi[q];
          if (depth < 0.55 || depth - 0.55 < o.v * o.v / (2 * B_COMF)) return false;
        }
      }
    }
    const P = this.nbTile(t, e);
    if (P >= 0) {
      const fromT = opp(e);
      for (let sub = 0; sub < 2; sub++) for (let q = this.head[((P * 4 + fromT) << 1) | sub]; q >= 0; q = this.eNext[q]) {
        const o = this.parts[this.eP[q]];
        if (o !== veh && this.eLo[q] < 0.65 && o.v < 0.35) return false;
      }
    }
    return true;
  }
  // Langes Fahrzeug in einer Rechtskurve ohne Kreuzung: Kurvenfeld frei, Gegenverkehr weit genug weg
  bendFree(veh, j) {
    const R0 = veh.route, t = R0.tile(j), e = R0.ent(j), x = R0.ext(j);
    for (let sub = 0; sub < 2; sub++) for (let s = 0; s < 4; s++) {
      if (s === e) continue;
      for (let q = this.head[((t * 4 + s) << 1) | sub]; q >= 0; q = this.eNext[q]) if (this.parts[this.eP[q]] !== veh) return false;
    }
    const na = this.approaching(t, x);
    for (let i = 0; i < na; i++) { const o = _apr[i * 3], d = _apr[i * 3 + 1]; if (o !== veh && (d < 0.55 || d - 0.55 < o.v * o.v / (2 * B_COMF))) return false; }
    // (Stau auf der Gegenspur: nach einer Weile vorsichtig trotzdem)
    return (veh.wait || 0) > 4 || this.sweepClear(veh, t, e, x);
  }

  uturnFree(veh, j) {
    const R0 = veh.route, t = R0.tile(j), e = R0.ent(j);
    // Gegenspur im Feld frei und niemand von der Gegenseite im Anflug
    for (let sub = 0; sub < 2; sub++) for (let s = 0; s < 4; s++) {
      if (s === e) continue;
      for (let q = this.head[((t * 4 + s) << 1) | sub]; q >= 0; q = this.eNext[q]) if (this.parts[this.eP[q]] !== veh) return false;
    }
    const na = this.approaching(t, opp(e));
    for (let i = 0; i < na; i++) { const o = _apr[i * 3]; if (o !== veh && _apr[i * 3 + 1] / Math.max(o.v, 0.25) < 2.5) return false; }
    const occ = this.jocc.get(t);
    if (occ && occ.length) return false;
    // lange Fahrzeuge schwenken weit ins Zufahrtsfeld zurück: dort niemand, der langsam aus der Schleife kam
    if (veh.long && (veh.wait || 0) < 4) {
      const P = this.nbTile(t, e);
      if (P >= 0) for (let sub = 0; sub < 2; sub++) for (let q = this.head[((P * 4 + opp(e)) << 1) | sub]; q >= 0; q = this.eNext[q]) {
        const o = this.parts[this.eP[q]];
        if (o !== veh && this.eLo[q] < 0.8 && o.v < 0.35) return false;
      }
    }
    return true;
  }

  // Spur wählen: Wunschspur der nächsten Stücke (vor dem Abbiegen), sonst die eigene; auf einstreifigen Stücken frei
  // vorwählen, auf zweistreifigen nur wechseln, wenn auf der Zielspur neben und hinter dem Fahrzeug Platz ist
  chooseLane(veh, k, fw) {
    const R0 = veh.route, bus = veh.cls === LC.OUT;
    let want = -1;
    for (let j = k, i = 0; i < 3 && j >= 0; i++, j = R0.next(j)) { const p = R0.pref(j, bus); if (p !== 3) { want = p; break; } }
    if (want < 0) want = veh.home !== undefined ? veh.home : veh.laneT !== undefined ? veh.laneT : 0;
    if (veh.laneT === undefined) veh.laneT = veh.lat >= 0.5 ? 1 : 0;
    if (want === veh.laneT) return;
    if (!R0.multi(k) && !(R0.next(k) >= 0 && R0.multi(R0.next(k)))) { veh.laneT = want; return; }
    if (this.laneFree(veh, want, fw)) veh.laneT = want;
  }
  laneFree(veh, sub, fw) {
    const R0 = veh.route;
    const lo = fw - veh.len - 0.3, hi = fw + 0.35;
    let k = R0.find(R0.wrap(Math.max(0, lo)), veh.k);
    for (let i = 0; i < 4 && k >= 0; i++) {
      const p0 = R0.p(k), base = R0.loc(k);
      if (p0 > hi) break;
      if (R0.multi(k)) {
        for (let e = this.head[R0.key(k, sub)]; e >= 0; e = this.eNext[e]) {
          const o = this.parts[this.eP[e]];
          if (o === veh) continue;
          const a = this.eLo[e] - base + p0, b = this.eHi[e] - base + p0;
          // Platz neben dem Fahrzeug, und wer von hinten kommt, darf nicht schneller sein
          if (b > lo - (o.v > veh.v ? (o.v - veh.v) * 1.5 : 0) && a < hi) return false;
        }
      }
      k = R0.next(k);
    }
    return true;
  }

  // Wunschtempo auf Stück k
  v0(veh, k) {
    const R0 = veh.route, g = this.g;
    const t = R0.tile(k), bits = R0.I[k * RS + 11];
    const rt = g.road[t] || ((bits >> 8) & 7);
    let v = V_ROAD[rt] * veh.vmul * this.env;
    // Stau der Rechnung (viel mehr Fahrten als sichtbare Fahrzeuge) und Unfallstellen bremsen mit; Ampeln nicht –
    // die regeln die Fahrzeuge hier selbst
    const c = g.congestion[t];
    if (c > 0.85 && !veh.prio && !veh.noCong) v *= Math.max(0.45, 1 / (1 + (c - 0.85) * 1.5));
    if (g.tileDelay[t] >= 1) v *= 0.35;
    const mv = (bits >> 4) & 3;
    if (mv === MOVE.TURN) { const vt = (((bits >> 6) & 3) === 2 ? V_LEFT : V_RIGHT) * veh.turnMul; if (vt < v) v = vt; }
    else if (mv === MOVE.UTURN) { const vt = V_UTURN * veh.turnMul; if (vt < v) v = vt; }
    else if (this.jc[t] !== J.NONE) v *= 0.9;
    return v;
  }

  // ------------------------------------------------------------ Fahren
  // veh: { route, cls, S (Front, ungewickelt), v, len, acc, vmul, turnMul, prio, k, res, wait, stopS, vEnd }
  // stopS: Haltepunkt der Front (Haltestelle/Ziel) oder Infinity; vEnd: Tempo am Haltepunkt (Ziel: langsam ausrollen).
  // Zahlen nur über Felder, nicht als Argumente (spart je Aufruf Speicher für Kommazahlen)
  drive(veh) {
    const R0 = veh.route, dt = this.dt;
    // Entscheiden (Vordermann, Ampel, Vorfahrt …) bei flüssiger Bildfolge nur jedes zweite Bild je Fahrzeug, fern der
    // Kamera (this.focus) jedes vierte; dazwischen gilt die letzte Beschleunigung samt Lagegrenze (Vorderleute fahren
    // nie rückwärts, neue Hindernisse kommen nur über Kreuzungen, die erst nach Prüfung frei werden)
    // (weit draußen, mehr als doppelt so weit wie der Blickkreis: jedes achte)
    let per = dt > 0.05 ? 1 : 2;
    const Fc = this.focus;
    if (per > 1 && Fc && dt < 0.045) { const dx = veh.x - Fc.x, dz = veh.z - Fc.z, d2 = dx * dx + dz * dz; if (d2 > Fc.r2) per = d2 > Fc.r2 * 4 ? 8 : 4; }
    this._per = per;
    if (veh.cs < -1e8 || per === 1 || ((this.tick + veh.id) % per) === 0) this.evaluate(veh);
    else { veh.cg -= veh.S - veh.cs; veh.cs = veh.S; }
    const front = veh.S, v = veh.v, k = veh.k;
    let a = veh.ca;
    const hardGap = veh.cg, stopReason = veh.cr;
    if (a < -B_MAX) a = -B_MAX;
    let vn = v + a * dt;
    if (vn < 0) vn = 0;
    let ds = (v + vn) * 0.5 * dt;
    const maxDs = hardGap > 0.004 ? hardGap - 0.004 : 0;
    if (ds > maxDs) { ds = maxDs; if (vn > ds / Math.max(dt, 1e-3)) vn = ds / Math.max(dt, 1e-3); }
    if (ds < 0) ds = 0;
    veh.S = front + ds;
    veh.a = (vn - v) / Math.max(dt, 1e-3);
    veh.v = vn;
    // Spurwechsel: Querlage in gut einer Sekunde hinüber (nur in Fahrt)
    const lt = veh.laneT;
    if (lt !== undefined && veh.lat !== lt && veh.cls !== LC.TRAM) {
      const st = dt * (0.35 + Math.min(1, vn) * 0.8);
      veh.lat = veh.lat < lt ? Math.min(lt, veh.lat + st) : Math.max(lt, veh.lat - st);
    }
    veh.k = R0.find(R0.wrap(veh.S), k);
    // Warten an Haltelinie (für Ausweichregeln gegen Verklemmen)
    if (vn < 0.03 && (stopReason === 2 || stopReason === 3)) veh.wait = (veh.wait || 0) + dt;
    else if (vn > 0.1) veh.wait = 0;
    veh.stuck = vn < 0.02 && stopReason !== 1 ? (veh.stuck || 0) + dt : 0;
    veh.brake = veh.a < -0.12 || (vn < 0.05 && (stopReason > 0 || hardGap < 0.4));
    // Reservierungen freigeben, wenn das Heck die Kreuzung verlassen hat
    // Noch nicht eingefahren, fast stehend und nicht anfahrend (Rückstau vor der Kreuzung): Reservierung zurückgeben, damit der
    // Querverkehr fahren kann – beim Weiterfahren wird neu geprüft (Ampel, Belegung, Platz dahinter)
    const r = veh.res;
    if (r && r.length) {
      for (let i = r.length - 3; i >= 0; i -= 3) {
        const t = r[i];
        if (veh.S >= r[i + 1] || (vn < 0.12 && veh.a < 0.01 && veh.S < r[i + 2] - 0.06 && t >= 0)) {
          if (t >= 0) this.release(t, veh); else this.dropUturn(-t - 1, veh);
          r.splice(i, 3);
        }
      }
    }
  }

  // Lage voraus auswerten: Beschleunigung (veh.ca), Lagegrenze (veh.cg ab veh.cs), Haltegrund (veh.cr:
  // 0 frei/Vordermann, 1 rote Ampel, 2 Warten auf Einfahrt, 3 Wendeschleife besetzt)
  evaluate(veh) {
    const R0 = veh.route, n = R0.n, F = R0.F, I = R0.I, cyc = R0.cyclic;
    const stopS = veh.stopS, vEnd = veh.vEnd;
    const v = veh.v;
    const front = veh.S;
    const fw = R0.wrap(front);
    const k = R0.find(fw, veh.k);
    veh.k = k;
    const A = veh.acc, cls = veh.cls;
    const long = veh.len > 0.9, lng = !!veh.long;
    const s0 = long ? 0.09 : S0, Th = long ? 0.8 : T_HEAD;
    // Wunschtempo im aktuellen Feld, freie Beschleunigung (IDM)
    const v0 = this.v0(veh, k);
    D.v = v; D.A = A; D.s0 = s0; D.Th = Th; D.sqAB = 2 * Math.sqrt(A * B_COMF);
    D.free = 1 - pw4(Math.min(1.5, v / Math.max(0.05, v0)));
    D.a = A * D.free; D.hard = 99;
    let stopReason = 0;
    const range = Math.max(1.3, 0.6 + v * v / (2 * B_COMF) + v * Th);
    // Haltepunkt (Haltestelle, Ziel)
    if (stopS < Infinity) {
      const d = stopS - front;
      if (vEnd > 0) { if (d < range) (D.g = d, D.vl = vEnd, limD()); if (d < 0.02 && D.a > 0 && v > 0.05) D.a = 0; }
      else if (d < range + 0.5) (D.g = d, D.vl = 0, D.so = 0.0, obstD());
    }
    // Spurwahl auf zweistreifigen Straßen: Wunschspur vor dem Abbiegen, Wechsel nur mit Lücke
    if (cls !== LC.TRAM) this.chooseLane(veh, k, fw);
    const latL = veh.lat || 0;
    const bothL = veh.wide || (latL > 0.02 && latL < 0.98) || (veh.laneT !== undefined && Math.abs(veh.laneT - latL) > 0.02);
    const subL = latL >= 0.5 ? 1 : 0;
    // Stücke voraus
    const myLocal = fw - F[k * RS] + F[k * RS + 1];
    let j = k, dist = 0; // dist: Abstand der Front zum Anfang von Stück j (für j > k)
    let blocked = false;
    for (let it = 0; it < 7 && !blocked; it++) {
      const b = j * RS, bits = I[b + 11];
      const t = I[b + 10];
      const cur = j === k;
      if (!cur && dist >= range) break;
      // Folgefahrt: Fahrzeuge auf derselben Spur (beim Spurwechsel und als breites Fahrzeug auf beiden)
      const base = F[b + 1];
      const k0 = I[b + 7];
      // auf Kreuzungen einspurig hintereinander (Reißverschluss), beim Spurwechsel und als breites Fahrzeug beide Spuren
      const both2 = bothL || this.jc[t] !== J.NONE;
      const nk = !(I[b + 8] & 4) ? 1 : both2 ? 2 : 1;
      const myX = (bits >> 2) & 3;
      for (let q = 0; q < nk; q++) {
        const key = !(I[b + 8] & 4) ? k0 : both2 ? k0 | q : cls === LC.TRAM ? k0 : k0 | subL;
        for (let e = this.head[key]; e >= 0; e = this.eNext[e]) {
          const o = this.parts[this.eP[e]];
          if (o === veh) continue;
          let lo = this.eLo[e], hi = this.eHi[e];
          // anderes Ziel vom selben Arm (abbiegen ↔ geradeaus): Lage des Hecks in die eigene Bewegung umrechnen
          if (this.eExt[e] !== myX) {
            lo = mapLeader(bits, this.eExt[e], lo, lng);
            if (lo === Infinity || (cur && lo < myLocal - 0.02)) continue; // abgebogen oder schon neben/hinter mir
            if (cur) hi = mapLeader(bits, this.eExt[e], hi, lng);
          }
          let gap;
          if (cur) { if (hi <= myLocal + 1e-4) continue; gap = lo - myLocal; }
          else gap = dist + lo - base;
          if (gap < range) (D.g = gap, D.vl = o.v, D.so = s0, obstD());
        }
      }
      if (!cur) {
        // Wendeschleife eines anderen Fahrzeugs in diesem Feld
        // (langes Fahrzeug, das dort weit ausschwenkt: mit Abstand davor warten)
        if (this.utFlag[t] && this.uturn.get(t) !== veh) { (D.g = dist - (this.utFlag[t] === 2 && dist > 0.6 ? 0.55 : 0.02), D.vl = 0, D.so = 0, obstD()); blocked = true; stopReason = 3; break; }
        // Wendebereich einer Straßenbahn
        if (this.zFlag[t] && this.zoneBlocks(veh, t, bits & 3, (bits >> 2) & 3)) { (D.g = dist - 0.02, D.vl = 0, D.so = 0, obstD()); blocked = true; stopReason = 3; break; }
        // Kurven und Straßentyp
        (D.g = dist, D.vl = this.v0(veh, j), limD());
        // Kreuzung voraus (noch nicht reserviert)
        const jct = this.jc[t];
        if (jct !== J.NONE && !this.reserved(veh, t)) {
          const ent = bits & 3;
          const line = dist - (this.setback[t * 4 + ent] ? STOP_BACK : this.zebra[t * 4 + ent] === 1 ? STOP_ZEBRA : STOP_PLAIN);
          // (Entscheidung erst kurz vor der Linie: so kurz wie möglich belegt; notfalls kräftiger bremsen)
          const decide = Math.max(0.28, v * v / 1.8 + 0.12);
          if (line <= decide) {
            // Kette direkt aufeinanderfolgender Kreuzungen gemeinsam
            let res = this.admit(veh, j, line);
            const chain = _chain;
            chain.length = 0; chain.push(j);
            let jj = j;
            while (res === 0 && chain.length < 3) {
              jj = R0.next(jj);
              if (jj < 0 || this.jc[R0.tile(jj)] === J.NONE || R0.tile(jj) === t || this.reserved(veh, R0.tile(jj))) break;
              res = this.admit(veh, jj, line);
              chain.push(jj);
            }
            if (res === 0) {
              const entryS = front + dist;
              for (let q = 0; q < chain.length; q++) { const c = chain[q]; this.reserve(veh, c, front + R0.ahead(front, c) + R0.plen(c) + veh.len, entryS); }
              const jw = this.jwait.get(t);
              if (jw && jw.veh === veh) this.jwait.delete(t);
            } else {
              // lange gewartet (nicht an Rot), nur wegen des Querverkehrs: Vorrang anmelden – höchstens 8 s lang, und nicht,
              // wenn etwas anderes aufhält (kein Platz dahinter, Fußgänger …), sonst sperrt der Vorrang die Kreuzung
              const jw = this.jwait.get(t);
              const why = this.why;
              if (res === 2 && veh.wait >= 2.5 && line > -0.05 && (why === 3 || why === 6) && chain.length === 1) {
                if (!jw || jw.veh.done || this.tick - jw.veh.seen > 3) this.jwait.set(t, { veh, e: ent, x: (bits >> 2) & 3, t0: this.t });
              } else if (jw && jw.veh === veh && why !== 2) this.jwait.delete(t);
              // ein langer Rechtsabbieger will in diesen Arm: weiter hinten warten, bis er herumgeschwenkt ist
              const lb = this.tick - this.sweep[t * 4 + ent] <= 3 && dist - STOP_BACK > -0.01 ? dist - STOP_BACK : line;
              (D.g = lb, D.vl = 0, D.so = 0, obstD()); blocked = true; stopReason = res === 1 ? 1 : 2;
            }
          } else if (jct === J.SIGNAL && !(veh.prio > 0)) {
            // rote Ampel schon von weitem: sanft auf die Haltelinie zu
            const st = signalAt(this.sigTime, this.phase[t], ent === 0 || ent === 2 ? 0 : 1);
            if (st === 2 || st === 3 || (st === 1 && line > v * v / (2 * B_COMF))) {
              (D.g = this.tick - this.sweep[t * 4 + ent] <= 3 && dist - STOP_BACK > -0.01 ? dist - STOP_BACK : line, D.vl = 0, D.so = 0, obstD()); blocked = true; stopReason = 1;
            }
          }
        }
        // Wendeschleife voraus (Gegenverkehr frei?) – und lange Fahrzeuge in Rechtskurven ohne Kreuzung: sie
        // schwenken über die Mitte, das Kurvenfeld gehört ihnen allein
        const mvj = (bits >> 4) & 3;
        const bend = mvj === MOVE.TURN && lng && cls !== LC.TRAM && ((bits >> 6) & 3) === 0 && this.jc[t] === J.NONE;
        if (!blocked && (mvj === MOVE.UTURN || bend) && this.uturn.get(t) !== veh) {
          const line = dist - 0.03;
          if (line <= Math.max(0.3, v * v / 1.1 + 0.15)) {
            if (bend ? this.bendFree(veh, j) : this.uturnFree(veh, j)) {
              this.uturn.set(t, veh); this.utFlag[t] = lng ? 2 : 1;
              (veh.res || (veh.res = [])).push(-t - 1, front + R0.ahead(front, j) + R0.plen(j) + veh.len, front + dist);
            } else { (D.g = line, D.vl = 0, D.so = 0, obstD()); blocked = true; stopReason = 3; }
          }
        }
      }
      if (!blocked) {
        // Zebrastreifen vor einer Kreuzung (dieses Stück liegt im Arm-Feld, die Kreuzung im nächsten)
        const jn = j + 1 < n ? j + 1 : cyc ? 0 : -1;
        const pl = F[b + RS] - F[b];
        if (jn >= 0) {
          const tn = I[jn * RS + 10];
          if (this.jc[tn] !== J.NONE) {
            const zs = (cur ? F[b + RS] - fw : dist + pl) - 0.19; // Zone beginnt 0,19 vor der Kreuzungskante
            if (this.zebraGate(tn, I[jn * RS + 11] & 3, zs, v, veh.len)) blocked = true;
          }
        }
        // Zebrastreifen hinter einer Kreuzung (dieses Stück im Arm-Feld, die Kreuzung im vorigen)
        const jp = j > 0 ? j - 1 : cyc ? n - 1 : -1;
        if (!blocked && jp >= 0) {
          const tp = I[jp * RS + 10];
          if (this.jc[tp] !== J.NONE) {
            const zs = (cur ? F[b] - fw : dist) + 0.02;
            if (zs > -0.2 - veh.len && this.zebraGate(tp, (I[jp * RS + 11] >> 2) & 3, zs, v, veh.len)) blocked = true;
          }
        }
        dist = cur ? F[b + RS] - fw : dist + pl;
      }
      j++;
      if (j >= n) { if (!cyc) break; j = 0; }
    }
    // Ende der Route (ohne Haltepunkt): auslaufen
    if (!cyc && stopS === Infinity) { const d = R0.len - fw; if (d < range) (D.g = d, D.vl = 0.25, limD()); }
    // Straßenbahn an der Endhaltestelle: Zebrastreifen der Kreuzung dahinter (die Spitze reicht bis an die Feldkante)
    if (!cyc && !blocked && cls === LC.TRAM && R0.endT >= 0 && this.jc[R0.endT] !== J.NONE) {
      const zs = R0.len + 0.5 - 0.19 - fw;
      if (zs < range) this.zebraGate(R0.endT, R0.endSide, zs, v, veh.len);
    }
    veh.ca = D.a; veh.cg = D.hard; veh.cs = front; veh.cr = stopReason;
  }

  // Bild abschließen: Belegungen von Fahrzeugen, die nicht mehr fahren, entfernen
  end() {
    if ((this.tick & 31) !== 0) return;
    const tick = this.tick;
    for (const [t, a] of this.jocc) {
      for (let i = a.length - 1; i >= 0; i--) if (tick - a[i].veh.seen > 3) a.splice(i, 1);
      if (!a.length) this.jocc.delete(t);
    }
    for (const [t, v] of this.uturn) if (tick - v.seen > 3) { this.uturn.delete(t); this.utFlag[t] = 0; }
    for (const [t, w] of this.jwait) if (tick - w.veh.seen > 3 || w.veh.done || w.veh.v > 0.3 || this.t - w.t0 > 8) this.jwait.delete(t);
    for (const [t, z] of this.zMap) if (tick - z.veh.seen > 3 || z.veh.done || this.t - z.t0 > 90) { this.zMap.delete(t); this.zFlag[t] = 0; }
  }

  // Darf ein Fahrzeug an seinem Startpunkt losfahren (Lücke im fließenden Verkehr)?
  canStart(veh) {
    const R0 = veh.route;
    const fw = R0.wrap(veh.S);
    const k = R0.find(fw, 0);
    const t = R0.tile(k), ent = R0.ent(k);
    // Fahrstreifen am Startpunkt (auch das nächste Feld) frei: niemand neben, kurz vor oder hinter dem Fahrzeug
    // (vom Kartenrand mit Tempo: so weit voraus frei, dass es sanft bremsen könnte)
    const lo = fw - veh.len - 0.16, hi = fw + 0.35 + veh.v * 1.1;
    if (this.scan(R0, lo, hi, veh, YES)) return false;
    // Zufahrende: gleich da
    const na = this.approaching(t, ent);
    for (let i = 0; i < na; i++) { const o = _apr[i * 3], d = _apr[i * 3 + 1]; if (d / Math.max(o.v, 0.2) < 1.6 && d < 1.2) return false; }
    // lange Fahrzeuge: das Heck reicht über den Routenanfang ins Feld davor – dort niemand, der gleich da ist
    if (!R0.cyclic) {
      const depth = veh.len - fw - R0.loc(0);
      if (depth > -0.3) {
        const n0 = this.approaching(R0.tile(0), R0.ent(0));
        for (let i = 0; i < n0; i++) { const o = _apr[i * 3], d = _apr[i * 3 + 1]; if (d < depth + 0.2 || (d / Math.max(o.v, 0.2) < 1.8 && d < 1.2 + depth)) return false; }
      }
    }
    if (this.utFlag[t]) return false;
    if (this.zFlag[t]) { const z = this.zMap.get(t), x = R0.ext(k); if (z && z.veh !== veh && (ent === z.e || x === z.x || (this.jc[t] !== J.NONE && conflicts(z.e, z.x, ent, x)))) return false; }
    if (this.jc[t] !== J.NONE) {
      const occ = this.jocc.get(t), x = R0.ext(k);
      if (occ) for (const o of occ) if (conflicts(ent, x, o.e, o.x)) return false;
      this.reserve(veh, k, veh.S + (R0.p(k + 1) - fw) + veh.len, veh.S);
    }
    return true;
  }
}

// Spurmitte für einen Punkt (Prüfstand/Darstellung): Straßentyp → Versatz
export function laneOffset(rt, cls) { return cls === LC.TRAM ? TRAM_OFF : (LANE_OFF[rt] || LANE_OFF[2])[cls]; }
export { DX, DZ, opp, RS };
