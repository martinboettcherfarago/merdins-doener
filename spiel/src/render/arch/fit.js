// Grundstücks-Einpassung für Zonengebäude (nur Aussehen): sorgt dafür, dass Nachbarn sauber zueinander stehen.
//
// Jedes Zonenmodell hat eine Bauweise (Typ), die die Typlisten in arch/*.js angeben (tag() in mix.js):
//  • 'D' offen (Einzelhaus, Villa, kleiner Laden, Zeile, Stadtvilla): seitlich und vorne Abstand, der freie Raum bleibt
//    Garten bzw. Vorplatz (die Bodenplatten des Modells füllen weiter das ganze Grundstück).
//  • 'R' Reihe: wie 'D', die Endhäuser halten Abstand zur Grenze.
//  • 'A' geschlossen (Blockrand, Gründerzeit, Geschäftshaus): Brandwände genau auf der Grundstücksgrenze, Bauflucht in
//    einheitlichem Abstand zur Straße und gemeinsame Traufhöhe je Stufe – Nachbarn bilden eine durchgehende
//    Straßenfront ohne Spalt und ohne Überlappung; ist der Nachbar niedriger, steht darüber eine Brandwand.
//  • 'S' Solitär (Turm, Halle, Markt): bleibt mit kleinem Abstand ganz auf dem eigenen Grundstück.
// Die Einpassung arbeitet auf den fertigen Dreiecken (vor dem Zusammenführen in Kit.build): Bodenplatten (flach, unter
// GROUND) bleiben liegen, alles andere wird – falls nötig – leicht gestaucht bzw. gestreckt und verschoben und zuletzt an
// den Grundstücksgrenzen abgeschnitten (Punkte jenseits der Grenze rücken auf die Grenze: Gesimse, Dachüberstände und
// Balkone enden bündig, nichts ragt ins Nachbargrundstück).
// Der Plan (Faktoren, Verschiebung) wird je Modell einmal bestimmt und für alle Detailstufen wiederverwendet: kein Springen
// beim Umschalten der Stufen, und die Analyse kostet nur beim ersten Bau.
// Maße in Welteinheiten (1 = 10 m), Front zeigt nach +z.
const GROUND = 0.0135; // Bodenplatten, Wege, Markierungen, Becken (≤ 13,5 cm)
const MASS_Y = 0.28; // Dreiecke ab 2,8 m Höhe zählen zur Gebäudemasse (Autos, Zäune, Hecken, Carports und Garagen nicht)
const SOFT = /^(leaves|hedge|bark|ivy|grass|flower|lawn|water|rubber|paint_white)/; // Pflanzen u. Ä. zählen nicht zur Masse
// Bauflucht geschlossener Bauweise (Abstand der Hauptfassade zur Straße)
// (Geschäftshäuser mit Vorplatz für Auslagen und Außengastronomie etwas weiter zurück als Wohnhäuser)
export const BUILD_LINE = { res: 0.2, com: 0.3, off: 0.2 };
const YARD = 0.12; // geschlossene Bauweise: so viel Hof bleibt mindestens hinter dem Haus
const MAX_SHIFT = 0.25; // höchstens so weit wird ein Modell zur Bauflucht verschoben
const MAX_STRETCH = 1.08; // geschlossene Bauweise: höchstens 8 % breiter ziehen, sonst gilt das Modell als Solitär
// Abstände je Bauweise: side = Ziel-Seitenabstand, front = Mindest-Vorgarten, back = Abstand zur hinteren Grenze,
// smin = kleinster Stauchfaktor (darunter wird nur abgeschnitten), clamp = harte Grenze seitlich und hinten
const RULES = {
  D: { side: 0.12, front: 0.08, back: 0.04, smin: 0.8, clamp: 0.02 },
  R: { side: 0.1, front: 0.08, back: 0.04, smin: 0.84, clamp: 0.02 },
  S: { side: 0.03, front: 0.0, back: 0.02, smin: 0.82, clamp: 0.01 },
  A: { side: 0, front: 0, back: 0.02, smin: 1, clamp: 0 },
};
const SIDE_DENSE = 0.09; // offene Bauweise ab Stufe 3 (Mehrfamilienhäuser, größere Bauten): etwas dichter
// Traufhöhe geschlossener Bauweise je Stufe: Nachbarn gleicher Stufe bekommen eine gemeinsame Traufkante (Geschosse
// werden dafür um höchstens 10 % gestreckt oder gestaucht); Wohnen und Gewerbe teilen die Bezugshöhe
const EAVE_REF = { 2: 1.1, 3: 1.6, 4: 2.15 };
const EAVE_K = 0.1;
const FRONT_OVER = 0.12; // Markisen, Schilder, Vordächer dürfen so weit über die Grundstücksgrenze zum Gehweg ragen

// ---------------------------------------------------------------- Analyse (Flächen-Histogramme, ohne Sortieren)
const EXT = 1.5, BIN = 0.0025, NB = Math.round((2 * EXT) / BIN) + 1; // Ausdehnung: Raster 2,5 cm über ±15 m
const PBIN = 0.0005, NP = Math.round((2 * EXT) / PBIN) + 1; // Fassadenebenen: Raster 5 mm
const YBIN = 0.01, NY = 1600; // Traufhöhe: Raster 10 cm bis 160 m
const hx0 = new Float64Array(NB), hx1 = new Float64Array(NB), hz0 = new Float64Array(NB), hz1 = new Float64Array(NB);
const hl = new Float64Array(NP), hr = new Float64Array(NP), hf = new Float64Array(NP), hy = new Float64Array(NY);
let fBuf = new Float32Array(3 * 4096); // Frontdreiecke: z, Fläche, Oberkante
const bi = (v) => Math.max(0, Math.min(NB - 1, Math.round((v + EXT) / BIN)));
const pi = (v) => Math.max(0, Math.min(NP - 1, Math.round((v + EXT) / PBIN)));
function quant(h, tot, q, step) {
  const t = tot * q;
  let acc = 0;
  for (let i = 0; i < h.length; i++) { acc += h[i]; if (acc >= t) return i * step - EXT; }
  return (h.length - 1) * step - EXT;
}
function peak(h, step) {
  let bi2 = -1, bw = 0;
  for (let i = 0; i < h.length; i++) if (h[i] > bw) { bw = h[i]; bi2 = i; }
  return bi2 < 0 ? null : bi2 * step - EXT;
}

function analyse(groups) {
  hx0.fill(0); hx1.fill(0); hz0.fill(0); hz1.fill(0); hl.fill(0); hr.fill(0); hf.fill(0);
  let mass = 0, nf = 0, al = 0, ar = 0, af = 0, xa = 0, za = -1e9;
  for (const [mat, list] of groups) {
    const soft = SOFT.test(mat);
    for (const geo of list) {
      const p = geo.attributes.position.array;
      for (let i = 0; i < p.length; i += 9) {
        const ay = p[i + 1], by = p[i + 4], cy = p[i + 7];
        const maxY = ay > by ? (ay > cy ? ay : cy) : (by > cy ? by : cy);
        // größte seitliche Ausdehnung von allem über den Bodenplatten (auch Bäume, Zäune, Autos)
        if (maxY > GROUND) {
          const m = Math.max(Math.abs(p[i]), Math.abs(p[i + 3]), Math.abs(p[i + 6])); if (m > xa) xa = m;
          const mz = Math.max(p[i + 2], p[i + 5], p[i + 8]); if (mz > za) za = mz;
        }
        if (maxY <= MASS_Y || soft) continue;
        const ax = p[i], az = p[i + 2], bx = p[i + 3], bz = p[i + 5], cx = p[i + 6], cz = p[i + 8];
        const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (len < 1e-12) continue;
        const area = len / 2;
        mass += area;
        const x0 = Math.min(ax, bx, cx), x1 = Math.max(ax, bx, cx), z0 = Math.min(az, bz, cz), z1 = Math.max(az, bz, cz);
        hx0[bi(x0)] += area; hx1[bi(x1)] += area; hz0[bi(z0)] += area; hz1[bi(z1)] += area;
        const minY = ay < by ? (ay < cy ? ay : cy) : (by < cy ? by : cy);
        if (minY > 0.3 || maxY > 0.6) {
          const ex = nx / len, ez = nz / len;
          if (ex < -0.95) { hl[pi((ax + bx + cx) / 3)] += area; al += area; }
          else if (ex > 0.95) { hr[pi((ax + bx + cx) / 3)] += area; ar += area; }
          else if (ez > 0.95 && minY > 0.12) {
            const zc = (az + bz + cz) / 3;
            hf[pi(zc)] += area; af += area;
            if (nf * 3 + 3 > fBuf.length) { const nb = new Float32Array(fBuf.length * 2); nb.set(fBuf); fBuf = nb; }
            fBuf[nf * 3] = zc; fBuf[nf * 3 + 1] = area; fBuf[nf * 3 + 2] = maxY; nf++;
          }
        }
      }
    }
  }
  if (!mass) return null;
  const front = af ? peak(hf, PBIN) : null;
  // Traufhöhe: Oberkante der Hauptfassade (Dreiecke in der häufigsten Frontebene)
  let eave = 0;
  if (front !== null) {
    hy.fill(0);
    let t = 0;
    for (let k = 0; k < nf; k++) if (Math.abs(fBuf[k * 3] - front) < 0.012) { hy[Math.min(NY - 1, Math.round(fBuf[k * 3 + 2] / YBIN))] += fBuf[k * 3 + 1]; t += fBuf[k * 3 + 1]; }
    if (t) { let acc = 0; for (let i = 0; i < NY; i++) { acc += hy[i]; if (acc >= t * 0.97) { eave = i * YBIN; break; } } }
  }
  return {
    x0: quant(hx0, mass, 0.004, BIN), x1: quant(hx1, mass, 0.996, BIN), z0: quant(hz0, mass, 0.004, BIN), z1: quant(hz1, mass, 0.996, BIN),
    left: al ? peak(hl, PBIN) : null, right: ar ? peak(hr, PBIN) : null, front, eave, xa, za,
  };
}

// ---------------------------------------------------------------- Plan
// { typ, kx, ox (x' = (x − ox)·kx + tx), tx, kz (z' = z·kz + dz), dz, ky, clamp: [x0, x1, z0, z1] }
function makePlan(a, cfg) {
  const { W, D } = cfg;
  let typ = cfg.typ || 'D';
  if (typ === 'A') {
    const xl = a.left, xr = a.right;
    const flush = xl !== null && xr !== null && xl < -W / 2 + 0.075 && xr > W / 2 - 0.075 && W / (xr - xl) <= MAX_STRETCH;
    if (flush) {
      // Brandwände auf die Grenzen strecken, Hauptfassade auf die Bauflucht, Traufe auf die Bezugshöhe
      const kx = W / (xr - xl);
      // So weit wie möglich zur gemeinsamen Bauflucht: nach vorne nur, solange Vorplatz-Möbel, Bäume und Markisen nicht auf
      // den Gehweg rutschen, nach hinten nur, solange ein Hof von mindestens 1,2 m bleibt
      let dz = a.front !== null ? D / 2 - (cfg.line ?? BUILD_LINE[cfg.key] ?? 0.2) - a.front : 0;
      if (dz > 0) dz = Math.min(dz, MAX_SHIFT, Math.max(0, D / 2 + 0.07 - a.za));
      else dz = Math.max(dz, -MAX_SHIFT, Math.min(0, -D / 2 + YARD - a.z0));
      const ref = EAVE_REF[cfg.level];
      let ky = 1;
      if (ref && a.eave > 0.5) ky = Math.max(1 - EAVE_K, Math.min(1 + EAVE_K, ref / a.eave));
      if (Math.abs(ky - 1) < 0.004) ky = 1;
      return { typ, kx, ox: xl, tx: -W / 2, kz: 1, dz, ky, clamp: [-W / 2, W / 2, -D / 2 + RULES.A.back, D / 2 + FRONT_OVER], eave: a.eave, line: a.front !== null ? D / 2 - a.front - dz : null };
    }
    typ = 'S';
  }
  if (typ === 'P' || typ === 'E') typ = 'S';
  const R = RULES[typ] || RULES.D;
  const side = (typ === 'D' || typ === 'R') && (cfg.level || 1) >= 3 ? SIDE_DENSE : R.side;
  // Stauchen um die Grundstücksmitte, bis seitlicher Abstand, Vorgarten und Abstand nach hinten passen
  const half = Math.max(Math.abs(a.x0), Math.abs(a.x1), 1e-6);
  let s = Math.min(1, (W / 2 - side) / half);
  if (a.z1 > 0) s = Math.min(s, Math.max(0.01, D / 2 - R.front) / a.z1);
  if (a.z0 < 0) s = Math.min(s, (D / 2 - R.back) / -a.z0);
  s = Math.max(R.smin, s);
  if (s > 0.999) s = 1;
  // Abstandsgrün: Bleibt in offener Bauweise seitlich ein freier Streifen (mindestens 50 cm, auch ohne Bäume und Zäune),
  // trennt eine Hecke auf der Grenze die Nachbarn – zusammen mit der des Nachbarn eine Hecke auf der Grundstücksgrenze
  const hedge = (typ === 'D' || typ === 'R') && W / 2 - Math.min(W / 2, a.xa * s) >= 0.05;
  return { typ, kx: s, ox: 0, tx: 0, kz: s, dz: 0, ky: 1, clamp: [-W / 2 + R.clamp, W / 2 - R.clamp, -D / 2 + R.clamp, D / 2 + FRONT_OVER], hedge };
}

// Ein Durchgang über alle Dreiecke oberhalb der Bodenplatten: strecken/stauchen, verschieben, Höhe, Grenzen
function apply(kit, P) {
  const { kx, ox, tx, kz, dz, ky } = P;
  const [cx0, cx1, cz0, cz1] = P.clamp;
  const scale = kx !== 1 || kz !== 1 || ky !== 1;
  for (const list of kit.groups.values()) {
    for (const geo of list) {
      const pa = geo.attributes.position, p = pa.array;
      const na = geo.attributes.normal, n = na ? na.array : null;
      let touched = false;
      for (let i = 0; i < p.length; i += 9) {
        if (p[i + 1] <= GROUND && p[i + 4] <= GROUND && p[i + 7] <= GROUND) continue;
        touched = true;
        for (let k = i; k < i + 9; k += 3) {
          let x = (p[k] - ox) * kx + tx, z = p[k + 2] * kz + dz;
          if (x < cx0) x = cx0; else if (x > cx1) x = cx1;
          if (z < cz0) z = cz0; else if (z > cz1) z = cz1;
          p[k] = x; p[k + 2] = z; p[k + 1] *= ky;
          if (n && scale) {
            const a = n[k] / kx, b = n[k + 1] / ky, c = n[k + 2] / kz, l = Math.sqrt(a * a + b * b + c * c) || 1;
            n[k] = a / l; n[k + 1] = b / l; n[k + 2] = c / l;
          }
        }
      }
      if (touched) { pa.needsUpdate = true; if (na) na.needsUpdate = true; geo.boundingBox = null; geo.boundingSphere = null; }
    }
  }
  for (const q of [...kit.lights, ...kit.emitters]) {
    q.x = Math.max(cx0, Math.min(cx1, (q.x - ox) * kx + tx)); q.z = Math.max(cz0, Math.min(cz1, q.z * kz + dz)); q.y *= ky;
  }
  if (ky !== 1) kit.height *= ky;
  if (P.hedge && P.W && kit.detail >= 1) {
    const { W, D } = P;
    for (const sx of [-1, 1]) kit.box('hedge', sx * (W / 2 - 0.022), 0, -0.01, 0.028, 0.085, D - 0.1);
  }
}

// Plan je Modell (Schlüssel, Stufe, Variante, Grundfläche) – gleich für alle Detailstufen
const PLANS = new Map();
// Einpassung eines Kit-Inhalts. cfg: { W, D, typ: 'D'|'A'|'S'|'R', level, id (Modellkennung für den Plan-Speicher), line }.
// Liefert den Plan (für Prüfwerkzeuge).
export function fitLot(kit, cfg) {
  let plan = cfg.id ? PLANS.get(cfg.id) : null;
  if (!plan) {
    const a = analyse(kit.groups);
    if (!a) return null;
    plan = makePlan(a, cfg);
    plan.W = cfg.W; plan.D = cfg.D;
    if (cfg.id) { if (PLANS.size > 5000) PLANS.clear(); PLANS.set(cfg.id, plan); }
  }
  apply(kit, plan);
  return { typ: plan.typ, s: +plan.kz.toFixed(3), sx: +plan.kx.toFixed(3), dz: +plan.dz.toFixed(3), ky: +plan.ky.toFixed(3), eave: plan.eave, line: plan.line, hedge: !!plan.hedge };
}
