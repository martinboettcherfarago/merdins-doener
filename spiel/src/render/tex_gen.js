// Prozedurale Oberflächen-Texturen (Besitzer G2) – reine Rechenfunktionen ohne Three.js, auch in Node lauffähig.
//
// Jede „Schicht" (Layer) ist ein kachelbares Muster mit TS × TS Pixeln, das einer Fläche von 4 m × 4 m entspricht
// (1 UV-Einheit = 4 m, wie die weltbezogenen UVs des Baukastens). Pro Schicht entstehen zwei RGBA-Bilder:
//   Albedo:   RGB = Detail-Modulation (Wert/128, also 0..2, 1 = neutral), A = Maske für die Zweitfarbe
//             (Fugen, Mörtel, Flecken, Moos …). Endfarbe = mix(Grundfarbe, Zweitfarbe, A) · Detail.
//   Oberfläche: RG = Normale (Tangentenraum, x/y, z wird rekonstruiert), B = Rauheit, A = Umgebungsverdeckung.
// Die Zuordnung Material → Schicht, Zweitfarbe, Maßstab usw. steht in SURFACE (unten).
// Konvention: Bildzeile y wächst mit v (an Wänden: nach oben). Alle Muster sind nahtlos kachelbar.

// Alles Rechnen steckt in einer in sich geschlossenen Fabrikfunktion: textures.js startet sie per
// Function.toString() auch in einem Web Worker (die Erzeugung blockiert dann den Hauptfaden nicht).
// Innerhalb der Fabrik daher keine Bezüge auf Dinge außerhalb!
export function texGenFactory() {
  const TS = 256;
  const S = TS, N2 = S * S, SM = S - 1, TAU = Math.PI * 2;

  // ---------- Grundbausteine
  function ihash(x, y, s) {
    let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b9);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const wrapD = (a) => { a -= Math.floor(a + 0.5); return a; }; // kürzester Abstand auf dem Einheitskreis (−0.5..0.5)

  const fieldCache = new Map();
  function cached(key, fn) { let v = fieldCache.get(key); if (!v) { v = fn(); fieldCache.set(key, v); } return v; }
  function clearFieldCache() { fieldCache.clear(); }

  // Periodisches Gradientenrauschen mit px × py Gitterzellen pro Kachel, aufaddiert in out.
  function gradNoise(px, py, seed, out, amp) {
    const gx = new Float32Array(px * py), gy = new Float32Array(px * py);
    for (let j = 0; j < py; j++) for (let i = 0; i < px; i++) { const a = ihash(i, j, seed) * TAU; gx[j * px + i] = Math.cos(a); gy[j * px + i] = Math.sin(a); }
    const x0 = new Int32Array(S), x1 = new Int32Array(S), tx = new Float32Array(S), fx = new Float32Array(S);
    for (let x = 0; x < S; x++) {
      const f = (x + 0.5) * px / S, i = Math.floor(f), t = f - i;
      x0[x] = i % px; x1[x] = (i + 1) % px; tx[x] = t; fx[x] = t * t * t * (t * (t * 6 - 15) + 10);
    }
    for (let y = 0; y < S; y++) {
      const f = (y + 0.5) * py / S, j = Math.floor(f), ty = f - j, fy = ty * ty * ty * (ty * (ty * 6 - 15) + 10);
      const r0 = (j % py) * px, r1 = ((j + 1) % py) * px, o = y * S, ty1 = ty - 1;
      for (let x = 0; x < S; x++) {
        const a = r0 + x0[x], b = r0 + x1[x], c = r1 + x0[x], d = r1 + x1[x], t = tx[x], t1 = t - 1, u = fx[x];
        const n00 = gx[a] * t + gy[a] * ty, n10 = gx[b] * t1 + gy[b] * ty;
        const n01 = gx[c] * t + gy[c] * ty1, n11 = gx[d] * t1 + gy[d] * ty1;
        const nx0 = n00 + (n10 - n00) * u, nx1 = n01 + (n11 - n01) * u;
        out[o + x] += (nx0 + (nx1 - nx0) * fy) * amp;
      }
    }
  }

  // Normiert auf Mittelwert 0.5 und Streuung 0.18 (begrenzt auf 0..1) – damit Schwellen vorhersagbar wirken.
  function normalize(a) {
    let s = 0, s2 = 0;
    for (let i = 0; i < N2; i++) { s += a[i]; s2 += a[i] * a[i]; }
    const m = s / N2, sd = Math.sqrt(Math.max(1e-12, s2 / N2 - m * m)), k = 0.18 / sd;
    for (let i = 0; i < N2; i++) a[i] = clamp01(0.5 + (a[i] - m) * k);
    return a;
  }

  // Verschiebt (und spiegelt) ein kachelbares Feld um ganze Pixel – bleibt kachelbar, kostet fast nichts.
  // So teilen sich viele Rezepte wenige echte Rauschfelder, ohne dass die Muster gleich aussehen.
  function shiftField(src, seed, mirror = true) {
    const dx = Math.floor(ihash(seed, 0, 77) * S), dy = Math.floor(ihash(seed, 1, 77) * S);
    const mx = mirror && ihash(seed, 2, 77) < 0.5, my = mirror && ihash(seed, 3, 77) < 0.5;
    const out = new Float32Array(N2);
    for (let y = 0; y < S; y++) {
      const sy = ((my ? SM - y : y) + dy) & SM, so = sy * S, o = y * S;
      if (mx) for (let x = 0; x < S; x++) out[o + x] = src[so + ((SM - x + dx) & SM)];
      else for (let x = 0; x < S; x++) out[o + x] = src[so + ((x + dx) & SM)];
    }
    return out;
  }

  // fBm aus periodischem Gradientenrauschen (px × py Zellen in der ersten Oktave)
  function fbm(seed, px, py = px, oct = 4, gain = 0.5) {
    return cached(`f${seed}:${px}:${py}:${oct}:${gain}`, () => {
      const base = cached(`F${seed & 1}:${px}:${py}:${oct}:${gain}`, () => {
        const out = new Float32Array(N2);
        let amp = 1, qx = px, qy = py;
        for (let k = 0; k < oct; k++) {
          gradNoise(Math.min(qx, S / 2), Math.min(qy, S / 2), (seed & 1) * 31 + k + px * 7 + py * 131, out, amp);
          amp *= gain; qx *= 2; qy *= 2;
        }
        return normalize(out);
      });
      return shiftField(base, seed);
    });
  }

  // Zellrauschen (Worley), periodisch. f1/f2 in Zellen-Einheiten (Abstand zum nächsten/zweitnächsten Punkt),
  // id = Zufallswert der nächsten Zelle (0..1).
  function cells(px, py, seed, jitter = 0.85) {
    return cached(`c${seed}:${px}:${py}:${jitter}`, () => {
      const b = cached(`C${seed & 1}:${px}:${py}:${jitter}`, () => cellsRaw(px, py, (seed & 1) * 7 + px * 3 + py * 101, jitter));
      // Verschieben ohne Spiegeln (ox/oy behalten ihre Richtung); id neu würfeln, damit Farbzuordnungen sich unterscheiden
      const r = { f1: shiftField(b.f1, seed, false), f2: shiftField(b.f2, seed, false), id: shiftField(b.id, seed, false) };
      const k = ihash(seed, 9, 78) * 0.618;
      for (let i = 0; i < N2; i++) { const v = r.id[i] + k; r.id[i] = v - Math.floor(v); }
      return r;
    });
  }
  function cellsRaw(px, py, seed, jitter) {
    const n = px * py, ptx = new Float32Array(n), pty = new Float32Array(n), pid = new Float32Array(n);
    for (let j = 0; j < py; j++) for (let i = 0; i < px; i++) {
      const k = j * px + i;
      ptx[k] = 0.5 + (ihash(i, j, seed) - 0.5) * jitter;
      pty[k] = 0.5 + (ihash(i, j, seed + 7) - 0.5) * jitter;
      pid[k] = ihash(i, j, seed + 13);
    }
    // vorberechnete Nachbarspalten/-zeilen (mit Umbruch)
    const fxA = new Float32Array(S), ciA = new Int32Array(S), wA = new Int32Array(S * 3);
    for (let x = 0; x < S; x++) {
      const fx = (x + 0.5) * px / S, ci = Math.floor(fx); fxA[x] = fx; ciA[x] = ci;
      for (let d = -1; d <= 1; d++) wA[x * 3 + d + 1] = (((ci + d) % px) + px) % px;
    }
    const f1 = new Float32Array(N2), f2 = new Float32Array(N2), id = new Float32Array(N2);
    for (let y = 0; y < S; y++) {
      const fy = (y + 0.5) * py / S, cj = Math.floor(fy);
      const r0 = ((((cj - 1) % py) + py) % py) * px, r1 = (cj % py) * px, r2 = (((cj + 1) % py)) * px;
      const rows = [r0, r1, r2];
      for (let x = 0; x < S; x++) {
        const fx = fxA[x], ci = ciA[x], w3 = x * 3;
        let d1 = 9, d2 = 9, b = 0;
        for (let dj = 0; dj < 3; dj++) {
          const ro = rows[dj], yy = cj + dj - 1 - fy;
          for (let di = 0; di < 3; di++) {
            const k = ro + wA[w3 + di];
            const qx = ci + di - 1 + ptx[k] - fx, qy = yy + pty[k], d = qx * qx + qy * qy;
            if (d < d1) { d2 = d1; d1 = d; b = k; } else if (d < d2) d2 = d;
          }
        }
        const o = y * S + x;
        f1[o] = Math.sqrt(d1); f2[o] = Math.sqrt(d2); id[o] = pid[b];
      }
    }
    return { f1, f2, id };
  }

  // Kastenunschärfe mit Umbruch (separierbar)
  function blur(src, r) {
    const tmp = new Float32Array(N2), out = new Float32Array(N2), w = 1 / (2 * r + 1);
    for (let y = 0; y < S; y++) {
      const o = y * S; let s = 0;
      for (let k = -r; k <= r; k++) s += src[o + (k & SM)];
      for (let x = 0; x < S; x++) { tmp[o + x] = s * w; s += src[o + ((x + r + 1) & SM)] - src[o + ((x - r) & SM)]; }
    }
    for (let x = 0; x < S; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += tmp[(k & SM) * S + x];
      for (let y = 0; y < S; y++) { out[y * S + x] = s * w; s += tmp[((y + r + 1) & SM) * S + x] - tmp[((y - r) & SM) * S + x]; }
    }
    return out;
  }

  // ---------- Schicht-Puffer
  let pool = null;
  function newLayer() {
    if (!pool) pool = { d: new Float32Array(N2 * 3), m: new Float32Array(N2), h: new Float32Array(N2), r: new Float32Array(N2) };
    pool.d.fill(1); pool.m.fill(0); pool.h.fill(0); pool.r.fill(0.8);
    return {
      d: pool.d,     // Detail RGB (1 = neutral)
      m: pool.m,     // Maske Zweitfarbe
      h: pool.h,     // Höhe 0..1
      r: pool.r,     // Rauheit
      ao: null,      // optional eigene Verdeckung
      nk: 1.5,       // Normalenstärke (Höhe → Neigung)
      aoR: 3, aoK: 2.2, // Hohlraum-Verdeckung aus der Höhe: Radius, Stärke
      raw: false,    // true: d wird 0..1 direkt gespeichert (Makro-Rauschen)
    };
  }
  function setD(L, i, lum, tr = 0, tb = 0) { const o = i * 3; L.d[o] = lum * (1 + tr); L.d[o + 1] = lum; L.d[o + 2] = lum * (1 + tb); }

  // Durchläuft alle Pixel: fn(i, u, v, x, y)
  function each(fn) {
    for (let y = 0, i = 0; y < S; y++) {
      const v = (y + 0.5) / S;
      for (let x = 0; x < S; x++, i++) fn(i, (x + 0.5) / S, v, x, y);
    }
  }

  // Zufällige Fugenteilung einer Reihe (kreisförmig, damit kachelbar): liefert sortierte Schnitte in [0,1)
  function rowCuts(n, row, seed, jit = 0.5) {
    const off = ihash(row, 0, seed), c = [];
    for (let k = 0; k < n; k++) c.push(((k + 0.5 + (ihash(k, row, seed + 1) - 0.5) * jit) / n + off) % 1);
    c.sort((a, b) => a - b);
    return c;
  }
  // Position u in einer Reihe mit Schnitten: { k, lu (0..1 im Stein), w (Breite in u) }
  function inCuts(c, u) {
    const n = c.length;
    for (let k = 0; k < n; k++) {
      const a = c[k], b = k + 1 < n ? c[k + 1] : c[0] + 1;
      let uu = u; if (uu < a) uu += 1;
      if (uu >= a && uu < b) return { k, lu: (uu - a) / (b - a), w: b - a };
    }
    return { k: 0, lu: 0.5, w: 1 / n };
  }

  // ---------- Rezepte
  const R = {};

  // Makro-Rauschen (Schicht 0): großflächige Variation gegen Kachelwiederholung, Pfützen, Schneeverteilung
  R.macro = (L) => {
    L.raw = true;
    const a = fbm(9001, 2, 2, 5), b = fbm(9002, 5, 5, 4), c = fbm(9003, 12, 12, 3), m = fbm(9004, 3, 3, 4);
    for (let i = 0; i < N2; i++) { L.d[i * 3] = a[i]; L.d[i * 3 + 1] = b[i]; L.d[i * 3 + 2] = c[i]; L.m[i] = m[i]; L.h[i] = 0.5; }
    L.nk = 0;
  };

  R.plaster = (L) => {
    const fine = fbm(101, 48, 48, 3), grain = fbm(102, 128, 128, 1), med = fbm(103, 12, 12, 4), low = fbm(104, 3, 3, 4);
    const streak = fbm(105, 22, 2, 3), tint = fbm(106, 4, 4, 3), blot = fbm(108, 5, 5, 4), pit = cells(56, 56, 107, 1);
    each((i) => {
      const p = pit.id[i] < 0.3 ? smooth(0.17, 0.05, pit.f1[i]) : 0;
      L.h[i] = 0.42 * fine[i] + 0.1 * grain[i] + 0.48 * med[i] - 0.35 * p;
      const lum = 1 + 0.07 * (med[i] - 0.5) + 0.16 * (low[i] - 0.5) + 0.035 * (grain[i] - 0.5) - 0.1 * p;
      const t = (tint[i] - 0.5) * 0.08;
      setD(L, i, lum, t, -t);
      L.m[i] = Math.min(1, 0.45 * smooth(0.68, 0.95, blot[i]) + 0.4 * smooth(0.6, 0.92, streak[i]) * smooth(0.35, 0.75, med[i]));
      L.r[i] = 0.84 + 0.12 * (grain[i] - 0.5);
    });
    L.nk = 0.42; L.aoK = 0.9;
  };

  // Ziegel im Kreuzverband: Läuferschichten (12 je 4 m) im Wechsel mit Binderschichten (24 je 4 m)
  R.brick = (L) => {
    const ROWS = 32, ch = S / ROWS;
    const fine = fbm(201, 64, 64, 2), grain = fbm(202, 128, 128, 1), low = fbm(203, 4, 4, 3), edgeN = fbm(204, 96, 96, 2), soot = fbm(208, 6, 6, 3);
    each((i, u, v) => {
      const fy = v * ROWS, row = Math.floor(fy), vy = fy - row;
      const header = row & 1, n = header ? 24 : 12;
      const shift = header ? 0.5 : ((row >> 1) & 1) * 0.5;
      const fx = u * n + shift, col = Math.floor(fx), ux = fx - col, cid = ((col % n) + n) % n, bw = S / n;
      const id = ihash(cid, row, 205), id2 = ihash(cid, row, 206), id3 = ihash(cid, row, 207);
      const ex = Math.min(ux, 1 - ux) * bw, ey = Math.min(vy, 1 - vy) * ch, Rr = 1.4;
      const qx = Math.max(0, Rr - ex), qy = Math.max(0, Rr - ey);
      const e = Rr - Math.sqrt(qx * qx + qy * qy) + (edgeN[i] - 0.5) * 1.5 - 0.75;
      const mortar = 1 - smooth(-0.35, 0.55, e), bevel = smooth(0, 1.7, e);
      let lum = 0.76 + 0.42 * id;
      if (id2 < 0.1) lum *= 0.6; else if (id2 > 0.94) lum *= 1.18;
      lum *= (0.9 + 0.2 * fine[i]) * (1 + 0.12 * (low[i] - 0.5)) * (1 - 0.25 * smooth(0.72, 0.95, soot[i]));
      const hr = (id3 - 0.5) * 0.16 + (id2 < 0.1 ? -0.05 : 0), hb = (id2 < 0.1 ? 0.12 : -hr * 0.4);
      const ml = 0.94 + 0.14 * grain[i];
      const o = i * 3;
      L.d[o] = lum * (1 + hr) * (1 - mortar) + ml * mortar;
      L.d[o + 1] = lum * (1 - mortar) + ml * mortar;
      L.d[o + 2] = lum * (1 + hb) * (1 - mortar) + ml * mortar;
      L.m[i] = mortar;
      const tilt = (ux - 0.5) * (id3 - 0.5) * 0.25 + (vy - 0.5) * (id - 0.5) * 0.15;
      L.h[i] = mortar > 0.5 ? 0.12 + 0.12 * grain[i] : 0.5 + 0.32 * bevel + 0.12 * fine[i] + tilt;
      L.r[i] = 0.8 + 0.12 * fine[i] * (1 - mortar) + 0.12 * mortar;
    });
    L.nk = 1.7; L.aoR = 2; L.aoK = 2.6;
  };

  // Ortbeton mit Schaltafeln (2 × 1 m), Ankerlöchern, Poren und Wasserflecken
  R.concrete = (L) => {
    const low = fbm(301, 5, 5, 4), med = fbm(302, 20, 20, 3), grain = fbm(303, 128, 128, 1), streak = fbm(304, 32, 3, 3), pores = cells(72, 72, 305, 1);
    each((i, u, v) => {
      const pu = u * 2, pv = v * 4, iu = Math.floor(pu), iv = Math.floor(pv), lu = pu - iu, lv = pv - iv;
      const e = Math.min(Math.min(lu, 1 - lu) * 128, Math.min(lv, 1 - lv) * 64);
      const joint = 1 - smooth(0.35, 1.3, e);
      let hole = 0;
      for (const hu of [0.25, 0.75]) { const dx = (lu - hu) * 128, dy = (lv - 0.5) * 64; hole = Math.max(hole, 1 - smooth(1.3, 2.3, Math.sqrt(dx * dx + dy * dy))); }
      const pid = ihash(iu, iv, 306);
      const pore = pores.id[i] < 0.3 ? smooth(0.15, 0.05, pores.f1[i]) : 0;
      const lum = (1 + (pid - 0.5) * 0.1) * (1 + 0.16 * (low[i] - 0.5) + 0.07 * (med[i] - 0.5) + 0.05 * (grain[i] - 0.5)) - 0.18 * pore - 0.06 * joint;
      setD(L, i, lum * (1 - 0.55 * hole), (pid - 0.5) * 0.03, -(pid - 0.5) * 0.03);
      L.m[i] = Math.max(hole * 0.9, 0.5 * smooth(0.6, 0.92, streak[i]) * smooth(0.35, 0.8, low[i]));
      L.h[i] = 0.5 + 0.15 * med[i] + 0.1 * grain[i] - 0.4 * pore - 0.6 * hole + 0.22 * joint;
      L.r[i] = 0.86 + 0.08 * (grain[i] - 0.5) + 0.05 * hole;
    });
    L.nk = 1.0; L.aoK = 1.4;
  };

  // Plattenbau-Großtafeln (Kachel = 2 × 2 Tafeln) mit Waschbeton-Oberfläche, dunklen Fugen und Schmutzfahnen
  R.platte = (L) => {
    const peb = cells(110, 110, 401, 1), grain = fbm(402, 128, 128, 1), low = fbm(403, 4, 4, 3), streak = fbm(404, 40, 4, 3);
    each((i, u, v) => {
      const pu = u * 2, pv = v * 2, iu = Math.floor(pu), iv = Math.floor(pv), lu = pu - iu, lv = pv - iv;
      const e = Math.min(Math.min(lu, 1 - lu), Math.min(lv, 1 - lv)) * 128;
      const joint = 1 - smooth(0.8, 1.9, e), chamfer = smooth(1.4, 3.6, e);
      const pid = ihash(iu, iv, 405);
      const dome = smooth(0.55, 0.12, peb.f1[i]), pt = 0.82 + 0.4 * peb.id[i];
      const lum = (1 + (pid - 0.5) * 0.1) * (1 + (pt - 1) * dome * 0.35) * (1 + 0.08 * (low[i] - 0.5)) * (0.97 + 0.06 * grain[i]);
      setD(L, i, lum, (pid - 0.5) * 0.04 + (peb.id[i] - 0.5) * 0.05 * dome, -(pid - 0.5) * 0.04);
      const dirt = smooth(0.8, 0.995, lv) * (0.35 + 0.65 * streak[i]) + 0.35 * smooth(0.66, 0.92, streak[i]) * lv;
      L.m[i] = Math.max(joint, Math.min(0.8, dirt));
      L.h[i] = 0.35 + 0.35 * chamfer + 0.2 * dome + 0.1 * grain[i] - 0.4 * joint;
      L.r[i] = 0.88 + 0.06 * (grain[i] - 0.5);
    });
    L.nk = 1.4; L.aoK = 1.6;
  };

  // Naturstein-Quader in Schichten (8 × 0.5 m), unregelmäßige Längen, scharrierte Oberfläche
  R.ashlar = (L) => {
    const ROWS = 8, rh = S / ROWS;
    const chisel = fbm(503, 96, 10, 2), fine = fbm(501, 48, 48, 3), grain = fbm(502, 128, 128, 1), low = fbm(504, 4, 4, 3);
    const cuts = []; for (let r = 0; r < ROWS; r++) cuts.push(rowCuts(3 + Math.floor(ihash(r, 3, 505) * 3), r, 506, 0.6));
    each((i, u, v) => {
      const fy = v * ROWS, row = Math.floor(fy), lv = fy - row;
      const c = inCuts(cuts[row], u), bw = c.w * S;
      const e = Math.min(Math.min(c.lu, 1 - c.lu) * bw, Math.min(lv, 1 - lv) * rh) + (fine[i] - 0.5) * 1.4 - 0.6;
      const joint = 1 - smooth(-0.2, 0.7, e), bevel = smooth(0.2, 3.0, e);
      const id = ihash(c.k, row, 507), id2 = ihash(c.k, row, 508);
      let lum = (0.86 + 0.26 * id) * (0.93 + 0.14 * fine[i]) * (1 + 0.1 * (low[i] - 0.5));
      if (id2 < 0.08) lum *= 0.82;
      const t = (id2 - 0.5) * 0.06;
      setD(L, i, lum * (1 - joint) + (0.95 + 0.1 * grain[i]) * joint, t * (1 - joint), -t * (1 - joint));
      L.m[i] = joint;
      const bulge = (1 - (2 * c.lu - 1) ** 2) * (1 - (2 * lv - 1) ** 2) * 0.12;
      L.h[i] = joint > 0.5 ? 0.1 : 0.45 + 0.35 * bevel + 0.1 * chisel[i] + 0.06 * grain[i] + bulge;
      L.r[i] = 0.85 + 0.1 * (grain[i] - 0.5);
    });
    L.nk = 1.5; L.aoR = 2; L.aoK = 2.2;
  };

  // Glatter Werkstein (Gesimse, Fensterbänke)
  R.stone = (L) => {
    const fine = fbm(511, 32, 32, 4), grain = fbm(512, 128, 128, 1), low = fbm(513, 3, 3, 4), pores = cells(64, 64, 514, 1);
    each((i) => {
      const p = pores.id[i] < 0.2 ? smooth(0.13, 0.04, pores.f1[i]) : 0;
      setD(L, i, (1 + 0.08 * (fine[i] - 0.5) + 0.1 * (low[i] - 0.5) + 0.05 * (grain[i] - 0.5)) * (1 - 0.15 * p), (low[i] - 0.5) * 0.04, 0);
      L.h[i] = 0.6 * fine[i] + 0.4 * grain[i] - 0.4 * p;
      L.m[i] = 0.4 * smooth(0.7, 0.95, low[i]);
      L.r[i] = 0.8 + 0.1 * (grain[i] - 0.5);
    });
    L.nk = 0.35;
  };

  // Granit (Bordstein): Körner in Schwarz/Weiß/Grau, Stoßfugen alle 1 m
  R.granite = (L) => {
    const sp = cells(90, 90, 601, 1), sp2 = cells(160, 160, 602, 1), grain = fbm(603, 128, 128, 1), low = fbm(604, 4, 4, 3);
    each((i, u) => {
      const id = sp.id[i], id2 = sp2.id[i];
      let lum = id < 0.18 ? 0.5 : id > 0.88 ? 1.28 : 0.93 + (ihash(Math.floor(id * 1e6), 0, 605) - 0.5) * 0.14;
      if (id2 < 0.12) lum *= 0.7; else if (id2 > 0.93) lum *= 1.15;
      lum *= 1 + 0.08 * (low[i] - 0.5);
      const lu = (u * 4) % 1, e = Math.min(lu, 1 - lu) * 64, joint = 1 - smooth(0.5, 1.3, e);
      setD(L, i, lum * (1 - 0.6 * joint), id > 0.88 ? -0.02 : 0.01, id < 0.18 ? 0.04 : 0);
      L.m[i] = joint;
      L.h[i] = 0.6 + 0.12 * grain[i] - 0.5 * joint;
      L.r[i] = 0.62 + 0.15 * (grain[i] - 0.5) + (id < 0.18 ? -0.1 : 0);
    });
    L.nk = 0.9;
  };

  R.marble = (L) => {
    const turb = fbm(701, 3, 3, 5), turb2 = fbm(703, 4, 4, 5), fine = fbm(702, 24, 24, 3), grain = fbm(704, 128, 128, 1);
    each((i, u, v) => {
      const t = TAU * (u * 1 + v * 2) + turb[i] * 10, t2 = TAU * (u * 3 - v * 1) + turb2[i] * 8;
      const vein = (1 - smooth(0.0, 0.1, Math.abs(Math.sin(t)))) * (0.4 + 0.6 * fine[i]);
      const vein2 = (1 - smooth(0.0, 0.05, Math.abs(Math.sin(t2)))) * 0.5;
      const lu = (u * 4) % 1, lv = (v * 4) % 1, e = Math.min(Math.min(lu, 1 - lu), Math.min(lv, 1 - lv)) * 64, joint = 1 - smooth(0.4, 1.0, e);
      setD(L, i, (1 - 0.05 * fine[i]) * (1 - 0.15 * joint), 0.01, 0);
      L.m[i] = Math.min(1, Math.max(vein, vein2));
      L.h[i] = 0.6 + 0.05 * grain[i] - 0.4 * joint;
      L.r[i] = 0.22 + 0.06 * (fine[i] - 0.5) + 0.4 * joint;
    });
    L.nk = 0.5;
  };

  // Senkrechte Bretterschalung (24 Bretter je 4 m), Maserung, Äste, Stoßfugen
  R.wood = (L) => {
    const NB = 24, bw = S / NB;
    const grainN = fbm(801, 120, 5, 3), ring = fbm(802, 40, 3, 3), fine = fbm(804, 128, 16, 1), knots = cells(12, 6, 803, 1);
    each((i, u, v) => {
      const fx = u * NB, col = Math.floor(fx), lu = fx - col;
      const vc = ihash(col, 1, 805);
      const seg = Math.floor((((v - vc) % 1) + 1) % 1 * 2);
      const id = ihash(col, seg, 806), id2 = ihash(col, seg, 807);
      const gap = 1 - smooth(0.25, 0.85, Math.min(lu, 1 - lu) * bw);
      const dv1 = Math.abs(wrapD(v - vc)) * S, dv2 = Math.abs(wrapD(v - vc - 0.5)) * S;
      const endGap = 1 - smooth(0.25, 0.85, Math.min(dv1, dv2));
      const g = 0.5 + 0.5 * Math.sin(TAU * ((lu * 1.3 + ring[i] * 2.5 + id * 7) * 3) + grainN[i] * 7);
      let lum = (0.78 + 0.32 * id) * (0.86 + 0.16 * g) * (0.95 + 0.1 * fine[i]);
      const kn = knots.id[i] < 0.22 ? 1 - smooth(0.06, 0.16, knots.f1[i]) : 0;
      lum *= 1 - 0.45 * kn;
      setD(L, i, lum, 0.03 + (id2 - 0.5) * 0.06, -0.06 - 0.06 * (1 - g));
      L.m[i] = Math.max(gap, endGap);
      L.h[i] = (0.65 - 0.25 * (2 * lu - 1) ** 2 + 0.08 * g + 0.04 * fine[i] - 0.15 * kn) * (1 - Math.max(gap, endGap) * 0.9);
      L.r[i] = 0.72 + 0.12 * g;
    });
    L.nk = 1.3; L.aoR = 2; L.aoK = 2;
  };

  // Waagrechte Stülpschalung (20 Bretter je 4 m) mit Schattenfuge unter jedem Brett, gestrichen
  R.siding = (L) => {
    const NB = 20, bh = S / NB;
    const brush = fbm(901, 6, 120, 2), grain = fbm(902, 8, 96, 3), low = fbm(903, 4, 4, 3);
    each((i, u, v) => {
      const fy = v * NB, row = Math.floor(fy), lv = fy - row;
      const uc = ihash(row, 2, 904), du = Math.abs(wrapD(u - uc)) * S, butt = 1 - smooth(0.3, 0.9, du);
      const id = ihash(row, Math.floor((((u - uc) % 1) + 1) % 1 * 1.0001), 905);
      const lip = smooth(0, 0.1, lv);
      setD(L, i, (1 + (id - 0.5) * 0.05) * (1 + 0.04 * (brush[i] - 0.5) + 0.04 * (grain[i] - 0.5) + 0.05 * (low[i] - 0.5)) * (0.93 + 0.07 * lip));
      L.m[i] = butt * 0.6;
      L.h[i] = (1 - 0.8 * Math.pow(lv, 0.8)) * (0.9 + 0.1 * lip) + 0.02 * brush[i] - 0.2 * butt;
      L.r[i] = 0.68 + 0.1 * (brush[i] - 0.5);
    });
    L.nk = 0.7; L.aoR = 3; L.aoK = 1.1;
  };

  // Metall-Fassadenkassetten (4 × 6 je Kachel) mit Fugen und leichtem Beulen
  R.cassette = (L) => {
    const NU = 4, NV = 6, pw = S / NU, ph = S / NV;
    const brush = fbm(1001, 4, 160, 2), low = fbm(1002, 5, 5, 3);
    each((i, u, v) => {
      const fx = u * NU, fy = v * NV, iu = Math.floor(fx), iv = Math.floor(fy), lu = fx - iu, lv = fy - iv;
      const e = Math.min(Math.min(lu, 1 - lu) * pw, Math.min(lv, 1 - lv) * ph);
      const joint = 1 - smooth(0.7, 1.6, e), bevel = smooth(0.8, 3, e);
      const id = ihash(iu, iv, 1003), id2 = ihash(iu, iv, 1004);
      const pillow = (1 - (2 * lu - 1) ** 2) * (1 - (2 * lv - 1) ** 2);
      setD(L, i, (1 + (id - 0.5) * 0.08) * (0.97 + 0.06 * brush[i]) * (1 + 0.04 * (low[i] - 0.5)));
      L.m[i] = joint;
      L.h[i] = 0.3 + 0.55 * bevel + 0.08 * pillow * (0.5 + id) + 0.02 * brush[i];
      L.r[i] = 0.5 + 0.16 * (id2 - 0.5) + 0.06 * (brush[i] - 0.5) + 0.3 * joint;
    });
    L.nk = 1.4; L.aoK = 1.6;
  };

  // Wellblech: 32 Wellen je 4 m, Tafeln 1 m breit und 2 m hoch, Rost-/Schmutzfahnen
  R.corrugated = (L) => {
    const streak = fbm(1101, 64, 2, 3), low = fbm(1102, 4, 4, 3), grain = fbm(1103, 128, 128, 1), drip = fbm(1105, 6, 6, 3);
    each((i, u, v) => {
      const wave = 0.5 + 0.5 * Math.cos(TAU * u * 32);
      const sheet = Math.floor(u * 4), row = Math.floor(v * 2), lv = (v * 2) % 1;
      const id = ihash(sheet, row, 1104);
      const lap = smooth(0.04, 0.0, lv);
      setD(L, i, (1 + (id - 0.5) * 0.08) * (1 + 0.06 * (low[i] - 0.5)) * (0.9 + 0.1 * wave) * (1 - 0.15 * lap));
      L.m[i] = Math.min(1, 0.6 * smooth(0.62, 0.86, streak[i]) * smooth(0.5, 0.8, drip[i]) * (0.3 + 0.7 * (1 - lv)) + 0.25 * smooth(0.7, 0.9, low[i]));
      L.h[i] = 0.15 + 0.7 * wave + 0.15 * lap + 0.02 * grain[i];
      L.r[i] = 0.5 + 0.12 * (grain[i] - 0.5) + 0.25 * L.m[i];
    });
    L.nk = 2.4; L.aoK = 1.2;
  };

  // Dachpfannen (Frankfurter Pfanne): 12 Reihen × 12 Pfannen, Wulst und Mulde, Schattenkante unter jeder Reihe
  R.pantile = (L) => {
    const N = 12;
    const fine = fbm(1201, 64, 64, 2), low = fbm(1202, 4, 4, 3), moss = fbm(1203, 16, 16, 3), grain = fbm(1204, 128, 128, 1);
    each((i, u, v) => {
      const fy = v * N, row = Math.floor(fy), lv = fy - row;
      const fx = u * N, col = Math.floor(fx), lu = fx - col;
      const roll = lu < 0.64 ? Math.sin(lu / 0.64 * Math.PI) : -0.3 * Math.sin((lu - 0.64) / 0.36 * Math.PI);
      const id = ihash(col, row, 1205), id2 = ihash(col, row, 1206);
      const lipR = smooth(0, 0.06, lv);
      let lum = (0.84 + 0.3 * id) * (0.92 + 0.16 * fine[i]) * (1 + 0.12 * (low[i] - 0.5));
      if (id2 < 0.05) lum *= 0.72; else if (id2 > 0.97) lum *= 1.2;
      lum *= 0.82 + 0.18 * (0.5 + 0.5 * roll);
      const hr = (ihash(col, row, 1207) - 0.5) * 0.12;
      setD(L, i, lum, hr, -hr * 0.5);
      L.m[i] = smooth(0.62, 0.86, moss[i]) * (0.6 - 0.4 * roll) * (0.5 + 0.5 * (1 - lv));
      L.h[i] = (0.62 * (1 - 0.85 * lv) + 0.3 * (0.5 + 0.5 * roll)) * (0.75 + 0.25 * lipR) + 0.03 * grain[i];
      L.r[i] = 0.7 + 0.1 * (fine[i] - 0.5) + 0.2 * L.m[i];
    });
    L.nk = 2.6; L.aoR = 4; L.aoK = 2.6;
  };

  // Biberschwanz-Ziegel: 24 Reihen × 20, versetzt, runder Abschluss
  R.beaver = (L) => {
    const ROWS = 24, COLS = 20, rh = S / ROWS, cw = S / COLS;
    const fine = fbm(1301, 64, 64, 2), low = fbm(1302, 4, 4, 3), moss = fbm(1303, 14, 14, 3), grain = fbm(1304, 128, 128, 1);
    each((i, u, v) => {
      const fy = v * ROWS, row = Math.floor(fy), lv = fy - row;
      const st = (row & 1) * 0.5, fx = u * COLS + st, col = Math.floor(fx), lu = fx - col - 0.5;
      const edge = 0.45 * (1 - Math.sqrt(Math.max(0, 1 - (2 * lu) ** 2 * 0.98)));
      const own = lv >= edge;
      let tc = col, tr = row, h;
      const side = Math.min(0.5 - Math.abs(lu), 0.5) * cw;
      if (own) {
        const de = (lv - edge) * rh;
        h = (0.85 - 0.45 * lv) * (0.7 + 0.3 * smooth(0, 1.6, de)) * (0.7 + 0.3 * smooth(0, 1.2, side));
      } else {
        tr = row - 1; const st2 = (tr & 1) * 0.5; tc = Math.floor(u * COLS + st2);
        h = 0.22;
      }
      const wc = ((tc % COLS) + COLS) % COLS, wr = ((tr % ROWS) + ROWS) % ROWS;
      const id = ihash(wc, wr, 1305), id2 = ihash(wc, wr, 1306);
      let lum = (0.82 + 0.32 * id) * (0.92 + 0.16 * fine[i]) * (1 + 0.12 * (low[i] - 0.5));
      if (id2 < 0.06) lum *= 0.72;
      if (!own) lum *= 0.62;
      const hr = (id2 - 0.5) * 0.12;
      setD(L, i, lum, hr, -hr * 0.5);
      L.m[i] = smooth(0.64, 0.88, moss[i]) * (own ? 0.5 * (1 - lv) : 0.8);
      L.h[i] = h + 0.03 * grain[i];
      L.r[i] = 0.72 + 0.1 * (fine[i] - 0.5) + 0.2 * L.m[i];
    });
    L.nk = 2.2; L.aoR = 3; L.aoK = 2.4;
  };

  // Schiefer (Altdeutsche Deckung, vereinfacht): 18 Reihen, Steine unterschiedlicher Breite, schräger Hieb
  R.slate = (L) => {
    const ROWS = 18, rh = S / ROWS;
    const cleave = fbm(1401, 6, 80, 2), fine = fbm(1402, 48, 48, 2), low = fbm(1403, 4, 4, 3), grain = fbm(1404, 128, 128, 1);
    const cuts = []; for (let r = 0; r < ROWS; r++) cuts.push(rowCuts(14, r, 1405, 0.7));
    each((i, u, v) => {
      const fy = v * ROWS, row = Math.floor(fy), lv = fy - row;
      const c = inCuts(cuts[row], u);
      const slope = (ihash(c.k, row, 1406) - 0.5) * 0.5;
      const cut = 0.18 + slope * (c.lu - 0.5) * 2 + 0.12 * c.lu;
      const own = lv >= Math.max(0, cut * 0.6);
      const side = Math.min(c.lu, 1 - c.lu) * c.w * S;
      const gap = 1 - smooth(0.2, 0.9, side);
      const id = own ? ihash(c.k, row, 1407) : ihash(c.k + 3, row - 1, 1407);
      let lum = (0.78 + 0.36 * id) * (0.93 + 0.14 * fine[i]) * (1 + 0.12 * (low[i] - 0.5)) * (0.96 + 0.08 * cleave[i]);
      if (!own) lum *= 0.65;
      lum *= 1 - 0.5 * gap;
      const t = (ihash(c.k, row, 1408) - 0.5) * 0.12;
      setD(L, i, lum, -Math.abs(t) * 0.5, t);
      L.m[i] = 0;
      L.h[i] = (own ? 0.82 - 0.5 * lv : 0.2) * (1 - 0.7 * gap) + 0.05 * cleave[i] + 0.02 * grain[i];
      L.r[i] = 0.55 + 0.25 * (fine[i] - 0.5) + 0.2 * (1 - id) * 0.5;
    });
    L.nk = 2.0; L.aoR = 3; L.aoK = 2.2;
  };

  // Stehfalz-Metalldach (Zink, Kupfer): Falze alle 50 cm, Querfalze, Patina-Fahnen
  R.seam = (L) => {
    const low = fbm(1501, 5, 5, 3), streak = fbm(1502, 64, 2, 3), grain = fbm(1503, 128, 128, 1), patina = fbm(1504, 6, 6, 4), wob = fbm(1505, 8, 3, 2);
    each((i, u, v) => {
      const fx = u * 8, col = Math.floor(fx), lu = fx - col;
      const d = Math.min(lu, 1 - lu) * 32, seamR = 1 - smooth(0.6, 2.4, d);
      const vc = ihash(col, 5, 1506), dv = Math.abs(wrapD(v - vc)) * S, cross = 1 - smooth(0.3, 1.1, dv);
      const id = ihash(col, Math.floor((((v - vc) % 1) + 1) % 1 * 1.0001), 1507);
      setD(L, i, (1 + (id - 0.5) * 0.08) * (1 + 0.08 * (low[i] - 0.5)) * (1 + 0.06 * seamR));
      L.m[i] = Math.min(1, 0.55 * smooth(0.6, 0.85, streak[i]) * smooth(0.4, 0.7, patina[i]) + 0.25 * smooth(0.55, 0.9, patina[i]));
      L.h[i] = 0.25 + 0.75 * seamR + 0.06 * Math.sin(Math.PI * lu) * wob[i] + 0.12 * cross + 0.01 * grain[i];
      L.r[i] = 0.42 + 0.12 * (low[i] - 0.5) + 0.2 * L.m[i];
    });
    L.nk = 1.8; L.aoK = 1.2;
  };

  // Kies (Flachdach, Wege): Kiesel in mehreren Farben, kleine Steine in den Lücken
  R.gravel = (L) => {
    const a = cells(44, 44, 1601, 1), b = cells(96, 96, 1602, 1), grain = fbm(1603, 128, 128, 1), low = fbm(1604, 4, 4, 3);
    each((i) => {
      const edge = a.f2[i] - a.f1[i], inside = smooth(0.03, 0.16, edge);
      const dome = Math.sqrt(Math.max(0, 1 - (a.f1[i] / 0.72) ** 2));
      const id = a.id[i];
      let lum, tr = 0, tb = 0;
      if (id < 0.3) lum = 0.9; else if (id < 0.55) { lum = 1.0; tr = 0.06; tb = -0.1; } else if (id < 0.75) lum = 1.22; else if (id < 0.9) lum = 0.62; else { lum = 0.9; tr = 0.15; tb = -0.12; }
      const bdome = Math.sqrt(Math.max(0, 1 - (b.f1[i] / 0.7) ** 2));
      const lb = 0.6 + 0.5 * b.id[i];
      lum = (lum * (0.8 + 0.3 * dome)) * inside + lb * 0.75 * (1 - inside);
      lum *= (0.94 + 0.12 * grain[i]) * (1 + 0.08 * (low[i] - 0.5));
      setD(L, i, lum, tr * inside, tb * inside);
      L.m[i] = (1 - inside) * 0.6;
      L.h[i] = inside * (0.35 + 0.65 * dome) + (1 - inside) * 0.25 * bdome;
      L.r[i] = 0.88 + 0.08 * (grain[i] - 0.5);
    });
    L.nk = 2.1; L.aoR = 2; L.aoK = 2.6;
  };

  // Bitumen-/Kunststoffbahnen: 1 m breite Bahnen mit Überlappungen, Falten, Granulat
  R.membrane = (L) => {
    const wr = fbm(1701, 5, 3, 3), gran = fbm(1702, 128, 128, 1), low = fbm(1703, 4, 4, 3), patch = fbm(1704, 3, 3, 4);
    each((i, u, v) => {
      const lu = (u * 4) % 1, sheet = Math.floor(u * 4);
      const lap = smooth(0.035, 0.005, lu), seamL = 1 - smooth(0.0, 0.012, Math.abs(lu - 0.035));
      const id = ihash(sheet, 0, 1705);
      setD(L, i, (1 + (id - 0.5) * 0.06) * (1 + 0.16 * (gran[i] - 0.5)) * (1 + 0.08 * (low[i] - 0.5)) * (1 - 0.15 * seamL));
      L.m[i] = Math.max(seamL * 0.7, 0.3 * smooth(0.74, 0.92, patch[i]));
      L.h[i] = 0.4 + 0.18 * wr[i] + 0.25 * lap + 0.08 * gran[i];
      L.r[i] = 0.78 + 0.1 * (gran[i] - 0.5);
    });
    L.nk = 1.3;
  };

  // Gründach (Sedum): Polster in Grün, Gelbgrün und Rot
  R.sedum = (L) => {
    const a = cells(40, 40, 1801, 1), rose = cells(110, 110, 1802, 1), grain = fbm(1803, 128, 128, 1), low = fbm(1804, 4, 4, 3);
    each((i) => {
      const dome = Math.sqrt(Math.max(0, 1 - (a.f1[i] / 0.75) ** 2)), gap = 1 - smooth(0.02, 0.14, a.f2[i] - a.f1[i]);
      const id = a.id[i], small = smooth(0.45, 0.1, rose.f1[i]);
      let tr = 0, tb = 0;
      if (id > 0.6 && id < 0.85) { tr = 0.2; tb = -0.2; } else if (id < 0.2) { tr = -0.08; tb = 0.06; }
      const red = id >= 0.95 ? 0.7 : 0;
      const lum = ((0.8 + 0.28 * dome) * (0.9 + 0.18 * small) * (0.92 + 0.16 * grain[i]) * (1 + 0.16 * (low[i] - 0.5)) * (0.9 + 0.2 * ihash(Math.floor(id * 9973), 1, 1805))) * (1 - 0.35 * gap);
      setD(L, i, lum, tr, tb);
      L.m[i] = red;
      L.h[i] = (0.3 + 0.5 * dome + 0.2 * small) * (1 - 0.8 * gap);
      L.r[i] = 0.9;
    });
    L.nk = 2.0; L.aoK = 2.4;
  };

  // Solarmodule: 4 × 2 Module, 6 × 12 Zellen, Alurahmen, abgeschrägte Zellecken
  R.solar = (L) => {
    const crys = fbm(1901, 64, 64, 2), low = fbm(1902, 4, 4, 2);
    each((i, u, v) => {
      const mu = (u * 4) % 1, mv = (v * 2) % 1, mi = Math.floor(u * 4), mj = Math.floor(v * 2);
      const ef = Math.min(Math.min(mu, 1 - mu) * 64, Math.min(mv, 1 - mv) * 128);
      const frame = 1 - smooth(1.3, 2.1, ef);
      const cuu = (mu * 6) % 1, cvv = (mv * 12) % 1, ci = Math.floor(mu * 6), cj = Math.floor(mv * 12);
      const cs = 64 / 6;
      const ge = Math.min(Math.min(cuu, 1 - cuu), Math.min(cvv, 1 - cvv)) * cs;
      const gap = 1 - smooth(0.25, 0.7, ge);
      const cor = (Math.min(cuu, 1 - cuu) + Math.min(cvv, 1 - cvv)) * cs, chamf = 1 - smooth(1.6, 2.2, cor);
      const bus = Math.min(Math.abs(cuu - 0.33), Math.abs(cuu - 0.67)) * cs, bb = 1 - smooth(0.15, 0.45, bus);
      const id = ihash(mi * 6 + ci, mj * 12 + cj, 1903);
      const cellL = (1 + (id - 0.5) * 0.08) * (0.95 + 0.1 * crys[i]) * (1 + 0.05 * (low[i] - 0.5));
      setD(L, i, cellL, -0.02, 0.04);
      L.m[i] = Math.max(frame, gap * 0.6, chamf * 0.75, bb * 0.3);
      L.h[i] = 0.4 + 0.6 * frame - 0.12 * gap;
      L.r[i] = frame > 0.5 ? 0.45 : 0.12 + 0.3 * Math.max(gap, chamf);
    });
    L.nk = 1.2; L.aoK = 0.8;
  };

  // Asphalt: Gesteinskörnung, Abnutzung, Risse, Flicken, Ölflecken
  R.asphalt = (L) => {
    const ag = cells(120, 120, 2001, 1), ag2 = cells(60, 60, 2002, 1), low = fbm(2003, 4, 4, 4), med = fbm(2004, 16, 16, 3), grain = fbm(2005, 128, 128, 1);
    const crk = cells(5, 5, 2006, 1), crkN = fbm(2007, 24, 24, 3), oil = fbm(2008, 6, 6, 4), crk2 = fbm(2010, 40, 40, 3);
    const patches = [];
    for (let k = 0; k < 2; k++) patches.push([ihash(k, 1, 2009), ihash(k, 2, 2009), 0.05 + 0.1 * ihash(k, 3, 2009), 0.04 + 0.08 * ihash(k, 4, 2009)]);
    each((i, u, v) => {
      const s = ag.id[i], dome = smooth(0.58, 0.15, ag.f1[i]);
      const st = s < 0.22 ? 1.45 : s < 0.55 ? 1.02 : 0.74;
      const s2 = ag2.id[i], dome2 = smooth(0.5, 0.2, ag2.f1[i]) * (s2 < 0.12 ? 1 : 0);
      let lum = 0.8 + (st - 0.8) * dome * 0.85;
      lum = lum * (1 - dome2) + 1.35 * dome2;
      lum *= (1 + 0.14 * (low[i] - 0.5) + 0.07 * (med[i] - 0.5)) * (0.94 + 0.12 * grain[i]);
      const ce = (crk.f2[i] - crk.f1[i]) * S / 5;
      const crack = Math.max((1 - smooth(0.35, 1.2, ce)) * smooth(0.48, 0.62, crkN[i]), (1 - smooth(0.0, 0.025, Math.abs(crk2[i] - 0.5))) * smooth(0.62, 0.75, crkN[i]) * 0.8);
      // Flicken nur selten (eine Kachel = 4 m): ein kleiner, kaum dunklerer Flicken je Kachel
      let patch = 0, rim = 0;
      for (const [cx, cy, hw, hh] of patches.slice(0, 1)) {
        const dx = Math.abs(wrapD(u - cx)), dy = Math.abs(wrapD(v - cy));
        const e = Math.min(hw - dx, hh - dy) * S;
        if (e > 0) { patch = 0.35; rim = Math.max(rim, 1 - smooth(0.5, 2.0, e)) * 0.5; }
      }
      const oi = smooth(0.74, 0.93, oil[i]);
      lum *= (1 - 0.22 * oi) * (1 - 0.6 * crack) * (1 - 0.25 * rim);
      setD(L, i, lum, 0, 0.02);
      L.m[i] = patch;
      L.h[i] = 0.45 * dome + 0.25 * dome2 + 0.2 * grain[i] - 0.5 * crack;
      L.r[i] = 0.9 - 0.12 * oi - 0.1 * dome * (s < 0.22 ? 1 : 0) + 0.04 * (grain[i] - 0.5);
    });
    L.nk = 1.4; L.aoR = 2; L.aoK = 1.8;
  };

  // Betonpflaster im Fischgrätverband (Steine 25 × 12,5 cm)
  R.pavers = (L) => {
    const T = 32, up = S / T;
    const grain = fbm(2101, 128, 128, 1), low = fbm(2102, 4, 4, 3), mossN = fbm(2103, 16, 16, 3), fine = fbm(2104, 48, 48, 2);
    each((i, u, v) => {
      const gu = u * T, gv = v * T, ci = Math.floor(gu), cj = Math.floor(gv), fu = gu - ci, fv = gv - cj;
      const s = (((ci + cj) % 4) + 4) % 4;
      let oi, oj, w, h, lx, ly;
      if (s === 0) { oi = ci; oj = cj; w = 2; h = 1; lx = fu; ly = fv; }
      else if (s === 1) { oi = ci - 1; oj = cj; w = 2; h = 1; lx = fu + 1; ly = fv; }
      else if (s === 2) { oi = ci; oj = cj; w = 1; h = 2; lx = fu; ly = fv; }
      else { oi = ci; oj = cj - 1; w = 1; h = 2; lx = fu; ly = fv + 1; }
      const e = Math.min(Math.min(lx, w - lx), Math.min(ly, h - ly)) * up;
      const id = ihash(((oi % T) + T) % T, ((oj % T) + T) % T, 2105), id2 = ihash(((oi % T) + T) % T, ((oj % T) + T) % T, 2106);
      const joint = 1 - smooth(0.45, 1.1, e), bevel = smooth(0.5, 2.2, e);
      const lum = (0.84 + 0.28 * id) * (0.93 + 0.14 * grain[i]) * (1 + 0.1 * (low[i] - 0.5)) * (0.97 + 0.06 * fine[i]);
      const t = (id2 - 0.5) * 0.08, moss = joint * smooth(0.55, 0.8, mossN[i]);
      const o = i * 3;
      L.d[o] = lum * (1 + t) * (1 - moss * 0.3);
      L.d[o + 1] = lum * (1 + moss * 0.15);
      L.d[o + 2] = lum * (1 - t) * (1 - moss * 0.5);
      L.m[i] = joint;
      L.h[i] = 0.2 + 0.7 * bevel + 0.06 * grain[i] + ((lx / w - 0.5) * (id - 0.5) + (ly / h - 0.5) * (id2 - 0.5)) * 0.1;
      L.r[i] = 0.84 + 0.08 * (grain[i] - 0.5) + 0.08 * joint;
    });
    L.nk = 1.6; L.aoR = 2; L.aoK = 2.4;
  };

  // Gehwegplatten 50 × 50 cm mit Fugen, einzelnen Rissen und Kaugummiflecken
  R.slabs = (L) => {
    const N = 8, pw = S / N;
    const grain = fbm(2201, 128, 128, 1), med = fbm(2202, 24, 24, 3), low = fbm(2203, 4, 4, 3), gum = cells(40, 40, 2204, 1);
    each((i, u, v) => {
      const fx = u * N, fy = v * N, iu = Math.floor(fx), iv = Math.floor(fy), lu = fx - iu, lv = fy - iv;
      const e = Math.min(Math.min(lu, 1 - lu), Math.min(lv, 1 - lv)) * pw;
      const joint = 1 - smooth(0.45, 1.1, e), bevel = smooth(0.5, 1.8, e);
      const id = ihash(iu, iv, 2205), id2 = ihash(iu, iv, 2206);
      let crack = 0;
      if (id2 < 0.07) { const a = ihash(iu, iv, 2207) * TAU, dd = Math.abs((lu - 0.5) * Math.sin(a) - (lv - 0.5) * Math.cos(a) + (id - 0.5) * 0.3) * pw; crack = 1 - smooth(0.2, 0.7, dd); }
      const g = gum.id[i] < 0.06 ? 1 - smooth(0.05, 0.09, gum.f1[i]) : 0;
      const lum = (0.92 + 0.16 * id) * (0.95 + 0.1 * grain[i]) * (1 + 0.07 * (med[i] - 0.5)) * (1 + 0.08 * (low[i] - 0.5)) * (1 - 0.4 * crack) * (1 - 0.35 * g);
      setD(L, i, lum, (id2 - 0.5) * 0.03, 0);
      L.m[i] = joint;
      L.h[i] = 0.3 + 0.6 * bevel + 0.1 * grain[i] - 0.3 * crack;
      L.r[i] = 0.86 + 0.06 * (grain[i] - 0.5) - 0.2 * g;
    });
    L.nk = 1.2; L.aoR = 2; L.aoK = 2.0;
  };

  // Kopfsteinpflaster (Reihenpflaster aus Granit, 12,5 cm), gewölbte Steine, breite Fugen
  R.setts = (L) => {
    const ROWS = 32, rh = S / ROWS;
    const grain = fbm(2251, 128, 128, 1), low = fbm(2252, 4, 4, 3), fine = fbm(2253, 48, 48, 2), sp = cells(110, 110, 2254, 1);
    const cuts = []; for (let r = 0; r < ROWS; r++) cuts.push(rowCuts(28, r, 2255, 0.55));
    each((i, u, v) => {
      const fy = v * ROWS, row = Math.floor(fy), lv = fy - row;
      const c = inCuts(cuts[row], u), bw = c.w * S;
      const ex = Math.min(c.lu, 1 - c.lu) * bw, ey = Math.min(lv, 1 - lv) * rh, Rr = 2.2;
      const qx = Math.max(0, Rr - ex), qy = Math.max(0, Rr - ey);
      const e = Rr - Math.sqrt(qx * qx + qy * qy) + (fine[i] - 0.5) * 1.6 - 0.8;
      const joint = 1 - smooth(-0.3, 0.8, e);
      const dome = Math.sqrt(Math.max(0, 1 - ((c.lu - 0.5) * 2) ** 2 * 0.7)) * Math.sqrt(Math.max(0, 1 - ((lv - 0.5) * 2) ** 2 * 0.7));
      const id = ihash(c.k, row, 2256), id2 = ihash(c.k, row, 2257);
      const spk = sp.id[i] < 0.15 ? 0.7 : sp.id[i] > 0.9 ? 1.2 : 1;
      let lum = (0.78 + 0.36 * id) * spk * (0.93 + 0.14 * grain[i]) * (1 + 0.1 * (low[i] - 0.5));
      const tr = id2 < 0.25 ? 0.08 : id2 > 0.8 ? -0.04 : 0, tb = id2 > 0.8 ? 0.06 : -tr * 0.5;
      lum *= 0.85 + 0.15 * dome;
      setD(L, i, lum * (1 - joint) + 0.8 * joint, tr * (1 - joint), tb * (1 - joint));
      L.m[i] = joint;
      L.h[i] = joint > 0.5 ? 0.08 + 0.08 * grain[i] : 0.35 + 0.55 * dome * smooth(0, 2.5, e) + 0.05 * grain[i];
      L.r[i] = 0.74 + 0.12 * (fine[i] - 0.5) + 0.2 * joint;
    });
    L.nk = 2.2; L.aoR = 2; L.aoK = 2.6;
  };

  // Rasen: feine Halme, Büschel, helle und dunkle Flecken, trockene Stellen (Zweitfarbe)
  R.grass = (L) => {
    const blade = fbm(2301, 128, 128, 1), clump = fbm(2302, 40, 40, 3), mid = fbm(2303, 12, 12, 3), low = fbm(2304, 3, 3, 4), dry = fbm(2305, 3, 3, 4), tuft = cells(64, 64, 2306, 1), clover = cells(20, 20, 2307, 1);
    each((i) => {
      const t = smooth(0.75, 0.15, tuft.f1[i]);
      const cl = clover.id[i] < 0.18 ? smooth(0.32, 0.12, clover.f1[i]) : 0;
      const lum = (0.6 + 0.32 * blade[i] + 0.26 * t) * (1 + 0.28 * (mid[i] - 0.5)) * (1 + 0.32 * (low[i] - 0.5)) * (1 + 0.12 * cl);
      const y = (clump[i] - 0.5) * 0.3 + (low[i] - 0.5) * 0.15;
      setD(L, i, lum, y - 0.06 * cl, -y * 1.2 + 0.05 * cl);
      L.m[i] = 0.38 * smooth(0.5, 0.98, dry[i]);
      L.h[i] = 0.4 * blade[i] + 0.42 * t + 0.18 * clump[i];
      L.r[i] = 0.94;
    });
    L.nk = 1.7; L.aoR = 2; L.aoK = 2.2;
  };

  // Sportrasen mit Mähstreifen (2 Bahnen je Kachel)
  R.turf = (L) => {
    const blade = fbm(2311, 128, 128, 1), mid = fbm(2312, 16, 16, 3), low = fbm(2313, 4, 4, 3), tuft = cells(80, 80, 2314, 1);
    each((i, u) => {
      const band = 0.5 + 0.5 * Math.cos(TAU * u);
      const st = smooth(0.35, 0.65, band);
      const t = smooth(0.75, 0.2, tuft.f1[i]);
      const lum = (0.68 + 0.26 * blade[i] + 0.16 * t) * (1 + 0.12 * (mid[i] - 0.5)) * (1 + 0.1 * (low[i] - 0.5)) * (0.88 + 0.24 * st);
      setD(L, i, lum, (mid[i] - 0.5) * 0.1, -0.04 * st);
      L.m[i] = 0;
      L.h[i] = 0.5 * blade[i] + 0.5 * t;
      L.r[i] = 0.9;
    });
    L.nk = 1.2;
  };

  // Erde: Klumpen, Steinchen, Trockenrisse, feuchte Flecken (Zweitfarbe)
  R.dirt = (L) => {
    const clod = cells(26, 26, 2401, 1), stone = cells(50, 50, 2402, 1), fine = fbm(2403, 64, 64, 2), low = fbm(2404, 4, 4, 4), moist = fbm(2405, 6, 6, 3);
    each((i) => {
      const dome = Math.sqrt(Math.max(0, 1 - (clod.f1[i] / 0.85) ** 2)), crack = 1 - smooth(0.02, 0.1, clod.f2[i] - clod.f1[i]);
      const st = stone.id[i] < 0.16 ? Math.sqrt(Math.max(0, 1 - (stone.f1[i] / 0.32) ** 2)) : 0;
      const lum = ((0.9 + 0.14 * dome) * (0.88 + 0.24 * fine[i]) * (1 + 0.22 * (low[i] - 0.5)) - 0.2 * crack) * (1 - st) + (1.25 + 0.2 * stone.id[i]) * st;
      setD(L, i, lum, -0.06 * st, 0.05 * st);
      L.m[i] = 0.5 * smooth(0.55, 0.9, moist[i]) * (1 - st);
      L.h[i] = 0.3 * dome + 0.35 * fine[i] - 0.25 * crack + 0.5 * st;
      L.r[i] = 0.95 - 0.1 * st;
    });
    L.nk = 1.6; L.aoK = 2.0;
  };

  // Ackerreihen (8 Reihen je 4 m, entlang v), Pflanzen als Polster, Boden dazwischen (Zweitfarbe)
  R.rows = (L) => {
    const canopy = fbm(2501, 24, 48, 3), leaf = cells(48, 96, 2502, 1), soil = fbm(2503, 64, 64, 2), low = fbm(2504, 4, 4, 3);
    each((i, u) => {
      const ru = (u * 8) % 1;
      const band = smooth(0.4, 0.22, Math.abs(ru - 0.5));
      const cover = band * smooth(0.22, 0.5, canopy[i]);
      const ld = Math.sqrt(Math.max(0, 1 - (leaf.f1[i] / 0.75) ** 2));
      const lum = cover * (0.75 + 0.35 * ld) * (1 + 0.12 * (low[i] - 0.5)) + (1 - cover) * (0.85 + 0.25 * soil[i]);
      setD(L, i, lum, (leaf.id[i] - 0.5) * 0.12 * cover, 0);
      L.m[i] = 1 - cover;
      const furrow = 1 - Math.abs(ru - 0.5) * 2;
      L.h[i] = cover * (0.45 + 0.45 * ld) + (1 - cover) * (0.1 + 0.2 * furrow + 0.1 * soil[i]);
      L.r[i] = 0.9;
    });
    L.nk = 1.6; L.aoK = 2.0;
  };

  // Sand: feine Körner, Windrippel, feuchte Stellen
  R.sand = (L) => {
    const grain = fbm(2601, 128, 128, 1), fine = fbm(2602, 64, 64, 2), warp = fbm(2603, 4, 4, 3), low = fbm(2604, 3, 3, 4), damp = fbm(2605, 5, 5, 4);
    each((i, u, v) => {
      const rp = Math.sin(TAU * (v * 14 + u * 2 + warp[i] * 2.5));
      const g = grain[i];
      let lum = (0.94 + 0.1 * g) * (1 + 0.1 * (low[i] - 0.5)) * (0.97 + 0.03 * rp);
      if (g > 0.86) lum *= 0.82; else if (g < 0.12) lum *= 1.08;
      setD(L, i, lum, 0, (fine[i] - 0.5) * 0.04);
      L.m[i] = 0.65 * smooth(0.65, 0.9, damp[i]);
      L.h[i] = 0.28 * (0.5 + 0.5 * rp) + 0.42 * g + 0.2 * fine[i];
      L.r[i] = 0.94;
    });
    L.nk = 0.8;
  };

  // Fels: zerklüftet, Schichtung, Flechten
  R.rock = (L) => {
    const r1 = fbm(2701, 3, 3, 6, 0.55), r2 = fbm(2706, 8, 8, 4), crack = cells(6, 6, 2702, 1), fine = fbm(2703, 48, 48, 3), strata = fbm(2704, 2, 10, 3), lich = fbm(2705, 10, 10, 3);
    each((i) => {
      const ridged = 1 - Math.abs(2 * r1[i] - 1), ridged2 = 1 - Math.abs(2 * r2[i] - 1);
      const cr = (1 - smooth(0.0, 0.05, crack.f2[i] - crack.f1[i])) * smooth(0.4, 0.7, r2[i]);
      const lum = (0.78 + 0.3 * fine[i]) * (1 + 0.2 * (strata[i] - 0.5)) * (1 - 0.3 * cr) * (0.8 + 0.25 * ridged + 0.1 * ridged2);
      setD(L, i, lum, (strata[i] - 0.5) * 0.08, -(strata[i] - 0.5) * 0.06);
      L.m[i] = smooth(0.72, 0.9, lich[i]) * (0.4 + 0.6 * ridged);
      L.h[i] = 0.45 * ridged + 0.2 * ridged2 + 0.25 * fine[i] - 0.3 * cr;
      L.r[i] = 0.85 + 0.1 * (fine[i] - 0.5);
    });
    L.nk = 2.2; L.aoK = 2.4;
  };

  // Laub: Blattbüschel mit dunklen Lücken (Zweitfarbe)
  R.leaves = (L) => {
    const a = cells(36, 36, 2801, 1), b = cells(72, 72, 2802, 1), low = fbm(2803, 4, 4, 3), fine = fbm(2804, 128, 128, 1);
    each((i) => {
      const inside = smooth(0.0, 0.12, a.f2[i] - a.f1[i]);
      const dome = Math.sqrt(Math.max(0, 1 - (a.f1[i] / 0.8) ** 2)), bd = Math.sqrt(Math.max(0, 1 - (b.f1[i] / 0.7) ** 2));
      const id = a.id[i];
      const lum = ((0.66 + 0.5 * dome) * (0.84 + 0.3 * id) * inside + (0.55 + 0.3 * bd) * (1 - inside)) * (1 + 0.18 * (low[i] - 0.5)) * (0.95 + 0.1 * fine[i]);
      const y = (id - 0.5) * 0.2;
      setD(L, i, lum, y, -y);
      L.m[i] = (1 - inside) * 0.85;
      L.h[i] = dome * inside + 0.35 * bd * (1 - inside);
      L.r[i] = 0.8 + 0.1 * (1 - inside);
    });
    L.nk = 2.2; L.aoK = 2.6;
  };

  // Rinde: senkrechte Borkenplatten und Risse
  R.bark = (L) => {
    const c = cells(10, 3, 2901, 1), fine = fbm(2902, 64, 16, 3), low = fbm(2903, 4, 4, 3);
    each((i) => {
      const ridge = smooth(0.0, 0.22, c.f2[i] - c.f1[i]);
      const lum = (0.62 + 0.45 * ridge) * (0.88 + 0.24 * fine[i]) * (1 + 0.1 * (low[i] - 0.5)) * (0.9 + 0.2 * c.id[i]);
      setD(L, i, lum, 0.02, -0.04);
      L.m[i] = (1 - ridge) * 0.6 * smooth(0.45, 0.7, low[i]);
      L.h[i] = 0.6 * ridge + 0.3 * fine[i];
      L.r[i] = 0.94;
    });
    L.nk = 2.3; L.aoK = 2.4;
  };

  // Stoff (Markisen, Planen): feines Gewebe, Falten, Streifen in der Maske (16 je 4 m)
  R.fabric = (L) => {
    const fold = fbm(3001, 4, 2, 3), low = fbm(3002, 4, 4, 3), grain = fbm(3003, 128, 128, 1);
    each((i, u, v, x, y) => {
      const weave = (((x >> 1) + (y >> 1)) & 1) ? 1 : 0;
      const su = (u * 16) % 1, stripe = smooth(0.47, 0.53, su) * (1 - smooth(0.97, 1.0, su)) + (su < 0.03 ? 1 - smooth(0.0, 0.03, su) : 0);
      setD(L, i, (1 + 0.05 * (weave - 0.5)) * (1 + 0.08 * (low[i] - 0.5)) * (0.96 + 0.08 * fold[i]));
      L.m[i] = stripe;
      L.h[i] = 0.6 * fold[i] + 0.08 * weave + 0.04 * grain[i];
      L.r[i] = 0.86;
    });
    L.nk = 1.2; L.aoK = 0.8;
  };

  // Lack (Rahmen, Türen, Bauteile): feine Orangenhaut, leichte Abplatzer (Zweitfarbe = Grundierung)
  R.paint = (L) => {
    const peel = fbm(3101, 64, 64, 2), grain = fbm(3102, 128, 128, 1), low = fbm(3103, 4, 4, 3), chip = cells(30, 30, 3104, 1);
    each((i) => {
      const ch = chip.id[i] < 0.05 ? 1 - smooth(0.06, 0.12, chip.f1[i]) : 0;
      setD(L, i, (1 + 0.03 * (low[i] - 0.5) + 0.02 * (peel[i] - 0.5)) * (1 - 0.1 * ch));
      L.m[i] = ch;
      L.h[i] = 0.6 * peel[i] + 0.1 * grain[i] - 0.3 * ch;
      L.r[i] = 0.6 + 0.08 * (low[i] - 0.5) + 0.2 * ch;
    });
    L.nk = 0.22; L.aoK = 0.5;
  };

  // Metall: gebürstet, leichte Flecken
  R.metal = (L) => {
    const brush = fbm(3201, 3, 128, 1), low = fbm(3202, 6, 6, 3), fine = fbm(3203, 32, 32, 2);
    each((i) => {
      setD(L, i, 1 + 0.07 * (brush[i] - 0.5) + 0.07 * (low[i] - 0.5));
      L.m[i] = 0.3 * smooth(0.55, 0.95, low[i]);
      L.h[i] = 0.12 * brush[i] + 0.05 * fine[i];
      L.r[i] = 0.5 + 0.1 * (brush[i] - 0.5) + 0.16 * (low[i] - 0.5) + 0.2 * L.m[i];
    });
    L.nk = 0.5; L.aoK = 0.4;
  };

  R.rust = (L) => {
    const a = fbm(3301, 6, 6, 5), b = fbm(3302, 24, 24, 3), pit = cells(64, 64, 3303, 1), grain = fbm(3304, 128, 128, 1);
    each((i) => {
      const p = pit.id[i] < 0.35 ? smooth(0.2, 0.06, pit.f1[i]) : 0;
      const lum = (0.8 + 0.4 * b[i]) * (1 - 0.25 * p) * (0.94 + 0.12 * grain[i]);
      setD(L, i, lum, 0.12 * b[i], -0.2 * b[i]);
      L.m[i] = smooth(0.42, 0.68, a[i]);
      L.h[i] = 0.4 * b[i] + 0.3 * a[i] - 0.3 * p + 0.1 * grain[i];
      L.r[i] = 0.9;
    });
    L.nk = 1.5; L.aoK = 1.6;
  };

  // Keramikfliesen 20 × 20 cm
  R.tiles = (L) => {
    const N = 20, pw = S / N, low = fbm(3401, 6, 6, 3), grain = fbm(3402, 128, 128, 1);
    each((i, u, v) => {
      const fx = u * N, fy = v * N, iu = Math.floor(fx), iv = Math.floor(fy), lu = fx - iu, lv = fy - iv;
      const e = Math.min(Math.min(lu, 1 - lu), Math.min(lv, 1 - lv)) * pw;
      const grout = 1 - smooth(0.45, 1.0, e), bevel = smooth(0.5, 1.6, e);
      const id = ihash(iu, iv, 3403);
      setD(L, i, (1 + (id - 0.5) * 0.06) * (1 + 0.04 * (low[i] - 0.5)) * (0.98 + 0.04 * grain[i]));
      L.m[i] = grout;
      L.h[i] = 0.3 + 0.6 * bevel;
      L.r[i] = 0.16 + 0.7 * grout + 0.04 * (low[i] - 0.5);
    });
    L.nk = 1.0; L.aoR = 2; L.aoK = 1.5;
  };

  // EPDM-Belag (Laufbahn): Granulat mit schwarzen Körnern (Zweitfarbe)
  R.epdm = (L) => {
    const g = cells(100, 100, 3501, 1), grain = fbm(3502, 128, 128, 1), low = fbm(3503, 4, 4, 3);
    each((i) => {
      const dome = Math.sqrt(Math.max(0, 1 - (g.f1[i] / 0.72) ** 2));
      setD(L, i, (0.84 + 0.25 * dome) * (1 + 0.1 * (low[i] - 0.5)) * (0.95 + 0.1 * grain[i]));
      L.m[i] = g.id[i] < 0.22 ? 1 : 0;
      L.h[i] = 0.5 * dome + 0.2 * grain[i];
      L.r[i] = 0.92;
    });
    L.nk = 1.0; L.aoK = 1.4;
  };

  // Stroh/Heu: viele kurze Halme in zufälliger Richtung (mode 'thatch': entlang v, für Reetdächer)
  function strawFibers(L, mode) {
    const h = L.h, lum = new Float32Array(N2).fill(0.5), tone = new Float32Array(N2).fill(0.7);
    const n = mode === 'thatch' ? 5200 : 3200, seed = mode === 'thatch' ? 3611 : 3601;
    for (let k = 0; k < n; k++) {
      const x0 = ihash(k, 1, seed) * S, y0 = ihash(k, 2, seed) * S;
      const a = mode === 'thatch' ? Math.PI / 2 + (ihash(k, 3, seed) - 0.5) * 0.35 : ihash(k, 3, seed) * Math.PI;
      const len = (mode === 'thatch' ? 18 : 8) + ihash(k, 4, seed) * (mode === 'thatch' ? 26 : 16);
      const t0 = 0.75 + 0.5 * ihash(k, 5, seed), z = 0.35 + 0.65 * (k / n);
      const ca = Math.cos(a), sa = Math.sin(a);
      for (let t = 0; t < len; t += 0.7) {
        const px = (Math.floor(x0 + ca * t) & SM), py = (Math.floor(y0 + sa * t) & SM), o = py * S + px;
        const hz = z * (0.85 + 0.15 * Math.sin(t / len * Math.PI));
        if (hz > h[o]) { h[o] = hz; tone[o] = t0 * (0.85 + 0.3 * (t / len)); }
      }
    }
    const low = fbm(3602, 4, 4, 3);
    each((i) => {
      const filled = h[i] > 0 ? 1 : 0;
      setD(L, i, (filled ? tone[i] : 0.45) * (1 + 0.16 * (low[i] - 0.5)), 0.04, -0.08);
      L.m[i] = filled ? 0 : 0.8;
      L.r[i] = 0.9;
    });
    void lum;
    L.nk = mode === 'thatch' ? 2.4 : 1.8; L.aoR = 2; L.aoK = 2.4;
  }
  R.straw = (L) => strawFibers(L, 'straw');
  R.thatch = (L) => {
    strawFibers(L, 'thatch');
    // Lagen (10 je 4 m): jede Lage fällt nach unten ab, Schatten unter der Kante
    each((i, u, v) => { const lv = (v * 10) % 1; L.h[i] = L.h[i] * 0.6 + 0.4 * (1 - lv); });
  };

  // Maschendraht (Rauten, 12 cm): Maske = Draht (1) / Loch (0) – das Material verwirft Löcher in der Nähe
  R.chain = (L) => {
    const P = 16;
    each((i, u, v, x, y) => {
      const a = ((x + y) % P) / P, b = (((x - y) % P) + P) % P / P;
      const d = Math.min(Math.abs(a - 0.5), Math.abs(b - 0.5)) * P;
      const wire = 1 - smooth(0.55, 1.15, d);
      setD(L, i, 0.9 + 0.2 * wire);
      L.m[i] = wire;
      L.h[i] = wire;
      L.r[i] = 0.5;
    });
    L.nk = 1.2; L.aoK = 0.5;
  };

  // Gerüstnetz: feines Gitter (Löcher dunkel, nicht durchsichtig)
  R.net = (L) => {
    const low = fbm(3801, 3, 3, 3);
    each((i, u, v, x, y) => {
      const w = ((x & 3) === 0 || (y & 3) === 0) ? 1 : 0;
      setD(L, i, (0.6 + 0.5 * w) * (1 + 0.15 * (low[i] - 0.5)));
      L.m[i] = 0;
      L.h[i] = w * 0.6 + 0.3 * low[i];
      L.r[i] = 0.9;
    });
    L.nk = 0.6; L.aoK = 0.5;
  };

  // ---------- Schicht-Liste (Reihenfolge = Index in den Textur-Arrays; Schicht 0 = Makro-Rauschen)
  const LAYERS = ['macro', 'plaster', 'brick', 'concrete', 'platte', 'ashlar', 'stone', 'granite', 'marble', 'wood', 'siding', 'cassette',
    'corrugated', 'pantile', 'beaver', 'slate', 'seam', 'gravel', 'membrane', 'sedum', 'solar', 'asphalt', 'pavers', 'slabs', 'setts',
    'grass', 'turf', 'dirt', 'rows', 'sand', 'rock', 'leaves', 'bark', 'fabric', 'paint', 'metal', 'rust', 'tiles', 'epdm', 'straw', 'thatch', 'chain', 'net'];
  const LAYER_INDEX = Object.fromEntries(LAYERS.map((n, i) => [n, i]));

  // Erzeugt eine Schicht und packt sie in die Zielpuffer (Uint8, je TS*TS*4) ab Byte-Versatz off.
  function generateLayer(name, alb, srf, off = 0) {
    const L = newLayer();
    R[name](L);
    // Hohlraum-Verdeckung aus der Höhe
    const h = L.h, d = L.d, m = L.m, r = L.r;
    const bl = L.ao ? null : blur(h, L.aoR), aoK = L.aoK;
    const A = new Uint8ClampedArray(alb.buffer, alb.byteOffset + off, N2 * 4), B = new Uint8ClampedArray(srf.buffer, srf.byteOffset + off, N2 * 4);
    const k = L.nk * 4, sc = L.raw ? 255 : 128;
    for (let y = 0; y < S; y++) {
      const yu = ((y + 1) & SM) * S, yd = ((y - 1) & SM) * S, yo = y * S;
      for (let x = 0; x < S; x++) {
        const i = yo + x, o = i * 4, q = i * 3;
        let nx = (h[yo + ((x - 1) & SM)] - h[yo + ((x + 1) & SM)]) * k, ny = (h[yd + x] - h[yu + x]) * k;
        const inv = 127.5 / Math.sqrt(nx * nx + ny * ny + 1);
        B[o] = nx * inv + 127.5; B[o + 1] = ny * inv + 127.5; B[o + 2] = r[i] * 255;
        B[o + 3] = bl ? (1 - Math.max(0, bl[i] - h[i]) * aoK) * 255 : L.ao[i] * 255;
        A[o] = d[q] * sc; A[o + 1] = d[q + 1] * sc; A[o + 2] = d[q + 2] * sc; A[o + 3] = m[i] * 255;
      }
    }
  }

  // Alle Schichten auf einmal: { albedo, surface (Uint8Array TS*TS*4*n), layers, ms }
  function generateAll(names = LAYERS) {
    const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
    const n = names.length, bytes = TS * TS * 4;
    const albedo = new Uint8Array(bytes * n), surface = new Uint8Array(bytes * n);
    names.forEach((nm, k) => generateLayer(nm, albedo, surface, k * bytes));
    clearFieldCache();
    const ms = (typeof performance !== 'undefined' ? performance : Date).now() - t0;
    return { albedo, surface, layers: names.slice(), ms };
  }

  return { TS, LAYERS, LAYER_INDEX, generateLayer, generateAll, clearFieldCache, fbm, cells, ihash };
}

const G = texGenFactory();
export const TS = G.TS, LAYERS = G.LAYERS, LAYER_INDEX = G.LAYER_INDEX;
export const generateLayer = G.generateLayer, generateAll = G.generateAll, clearFieldCache = G.clearFieldCache;
export const fbm = G.fbm, cells = G.cells, ihash = G.ihash;

// ---------- Material → Oberfläche
// layer: Schicht, second: Zweitfarbe (Hex, sRGB) oder 'dark' | 'dirt' | 'base', scale: Kacheln je 4 m ([u, v] oder Zahl),
// rough: Faktor auf die Rauheit der Schicht, normal: Normalenstärke, flags: GROUND (Weltprojektion von oben),
// CUTOUT (Löcher verwerfen), PUDDLE (Pfützen bei Nässe), LEAVES (Herbstfärbung), grime: Schmutz am Wandfuß 0..1,
// porous: Abdunkeln bei Nässe 0..1, snow: Schneehaftung 0..1
export const F_GROUND = 1, F_CUTOUT = 2, F_PUDDLE = 4, F_LEAVES = 8;
const P = (layer, o = {}) => ({ layer, ...o });
export const SURFACE = {
  plaster_white: P('plaster', { second: 'dirt' }), plaster_cream: P('plaster', { second: 'dirt' }), plaster_ochre: P('plaster', { second: 'dirt' }),
  plaster_pink: P('plaster', { second: 'dirt' }), plaster_blue: P('plaster', { second: 'dirt' }), plaster_green: P('plaster', { second: 'dirt' }),
  plaster_grey: P('plaster', { second: 'dirt' }), plaster_red: P('plaster', { second: 'dirt' }), plaster_yellow: P('plaster', { second: 'dirt' }),
  brick_red: P('brick', { second: 0xc9c2b4 }), brick_brown: P('brick', { second: 0xb9b0a0 }), brick_yellow: P('brick', { second: 0xe0d8c8 }),
  brick_white: P('brick', { second: 0xd6d2ca }), brick_dark: P('brick', { second: 0x6e6862 }), chimney_brick: P('brick', { second: 0xb3aa9c }),
  concrete: P('concrete', { second: 0x6f6b64 }), concrete_dark: P('concrete', { second: 0x4a4744 }),
  concrete_panel: P('platte', { second: 0x55524e, scale: [4 / 7.2, 4 / 6] }),
  stone_sandstone: P('ashlar', { second: 0xcbbfa6 }), stone_grey: P('ashlar', { second: 0x9a9893 }), stone_dark: P('ashlar', { second: 0x8a8782 }),
  trim_stone: P('stone', { second: 'dirt' }), marble: P('marble', { second: 0x8d8d8f, rough: 1 }),
  wood_planks: P('wood', { second: 0x2e2218 }), wood_dark: P('wood', { second: 0x1c140e }),
  siding_white: P('siding', { second: 'dark' }), siding_blue: P('siding', { second: 'dark' }), siding_red: P('siding', { second: 'dark' }),
  metal_panel_grey: P('cassette', { second: 0x2e3236 }), metal_panel_blue: P('cassette', { second: 0x23303c }), metal_panel_white: P('cassette', { second: 0x6c7074 }),
  metal_corrugated: P('corrugated', { second: 0x7a5236 }), metal_corrugated_red: P('corrugated', { second: 0x5a3328 }), metal_corrugated_green: P('corrugated', { second: 0x3f4a3a }),
  roof_tiles_red: P('pantile', { second: 0x4d5235, snow: 1 }), roof_tiles_brown: P('beaver', { second: 0x4a4a32, snow: 1 }), roof_tiles_anthracite: P('pantile', { second: 0x3d4237, snow: 1 }),
  roof_slate: P('slate', { second: 'base', snow: 0.95 }), roof_copper: P('seam', { second: 0x3e5a4c, snow: 0.6 }), roof_metal_grey: P('seam', { second: 0x5e6266, snow: 0.6 }),
  roof_flat_gravel: P('gravel', { second: 0x4d4a45, scale: 1.4, flags: F_PUDDLE }), roof_flat_membrane: P('membrane', { second: 0x3c3e42, flags: F_PUDDLE }),
  green_roof: P('sedum', { second: 0x9a4a3a }), solar_panel: P('solar', { second: 0xc9ced3, rough: 1, snow: 0.5 }),
  window_frame_white: P('paint', { second: 0x9a968e }), window_frame_dark: P('paint', { second: 0x6b6e72 }), window_frame_wood: P('wood', { second: 0x2e2218, scale: 3 }),
  trim_dark: P('paint', { second: 0x2a2b2d }), door_wood: P('wood', { second: 0x24180f, scale: 2.5 }),
  metal_dark: P('metal', { second: 0x24272b }), metal_light: P('metal', { second: 0x8d9296 }), rubber: P('paint', { second: 'base', rough: 1.5 }),
  paint_red: P('paint', { second: 0x8a8580 }), paint_white: P('paint', { second: 0x9a968e }), paint_yellow: P('paint', { second: 0x8a8580 }),
  paint_blue: P('paint', { second: 0x8a8580 }), paint_green: P('paint', { second: 0x8a8580 }), paint_orange: P('paint', { second: 0x8a8580 }),
  awning_red: P('fabric', { second: 'base' }), awning_blue: P('fabric', { second: 'base' }), awning_green: P('fabric', { second: 'base' }),
  awning_yellow: P('fabric', { second: 'base' }), awning_striped: P('fabric', { second: 0xf2efe6 }), canvas_white: P('fabric', { second: 'base' }),
  asphalt: P('asphalt', { second: 0x3c3f45, flags: F_GROUND | F_PUDDLE, grime: 0 }), asphalt_dark: P('asphalt', { second: 0x2d2f33, flags: F_GROUND | F_PUDDLE, grime: 0 }),
  pavers: P('pavers', { second: 0x9e9686, flags: F_GROUND | F_PUDDLE, grime: 0 }), sidewalk: P('slabs', { second: 0x8d887e, flags: F_GROUND | F_PUDDLE, grime: 0 }),
  curb: P('granite', { second: 0x6f6c66, grime: 0.6 }),
  grass: P('grass', { second: 0xb3a35c, flags: F_GROUND, grime: 0, porous: 0.5 }), grass_dry: P('grass', { second: 0xc2ad6a, flags: F_GROUND, grime: 0, porous: 0.5 }),
  dirt: P('dirt', { second: 0x5e4a36, flags: F_GROUND | F_PUDDLE, grime: 0 }), gravel: P('gravel', { second: 0x5e5a52, flags: F_GROUND, grime: 0 }),
  sand: P('sand', { second: 0xb8a77c, flags: F_GROUND, grime: 0 }), rock: P('rock', { second: 0x8f9466, grime: 0 }),
  field_soil: P('rows', { second: 0x5e4630, grime: 0 }), field_crops: P('rows', { second: 0x6e5236, grime: 0 }), field_wheat: P('rows', { second: 0xb79f52, grime: 0 }),
  field_rapeseed: P('rows', { second: 0x7d8a3a, grime: 0 }),
  sports_turf: P('turf', { scale: 0.5, flags: F_GROUND, grime: 0, porous: 0.5 }), rubber_track: P('epdm', { second: 0x2a2626, flags: F_GROUND, grime: 0 }),
  court_blue: P('paint', { second: 'base', rough: 1.4, flags: F_GROUND | F_PUDDLE, grime: 0 }),
  leaves_green: P('leaves', { second: 0x24401f, flags: F_LEAVES, grime: 0, porous: 0.3 }), leaves_dark: P('leaves', { second: 0x1c321b, flags: F_LEAVES, grime: 0, porous: 0.3 }),
  leaves_light: P('leaves', { second: 0x355a26, flags: F_LEAVES, grime: 0, porous: 0.3 }), leaves_autumn: P('leaves', { second: 0x6a3a1a, grime: 0, porous: 0.3 }),
  bark: P('bark', { second: 0x4f5a3a, scale: 2, grime: 0 }), hedge: P('leaves', { second: 0x1f3a1c, scale: 1.6, flags: F_LEAVES, grime: 0.3, porous: 0.3 }),
  tile_white: P('tiles', { second: 0xa9a7a0 }), chain_fence: P('chain', { second: 'base', flags: F_CUTOUT, grime: 0 }),
  glass_skylight: null, scaffold: P('wood', { second: 0x4a3a28 }), scaffold_net: P('net', { second: 'base' }),
  container_red: P('corrugated', { second: 0x5a3328, scale: 0.5 }), container_blue: P('corrugated', { second: 0x7a5236, scale: 0.5 }),
  container_green: P('corrugated', { second: 0x6a5236, scale: 0.5 }), container_yellow: P('corrugated', { second: 0x7a5a36, scale: 0.5 }),
  tank_white: P('cassette', { second: 0x9c9c98, scale: 0.5 }), pipe_metal: P('metal', { second: 0x6a5040 }), rust: P('rust', { second: 0x4a2a18 }),
  tarmac: P('concrete', { second: 0x4a4a48, scale: 0.5, flags: F_GROUND | F_PUDDLE, grime: 0 }), runway_marking: P('paint', { second: 0x9a9a96, rough: 1.4, grime: 0 }),
  rail_track: P('wood', { second: 0x2a2018, scale: 1.5 }), ballast: P('gravel', { second: 0x4f4b45, scale: 0.6, flags: F_GROUND, grime: 0 }),
  hay: P('straw', { second: 0x8a7038 }), log_wood: P('bark', { second: 0x5a4632, scale: 1.5 }),
  // Ergänzungen von G2
  cobblestone: P('setts', { second: 0x5f5a50, flags: F_GROUND | F_PUDDLE, grime: 0 }), roof_tiles_beaver: P('beaver', { second: 0x4d5235, snow: 1 }),
  roof_thatch: P('thatch', { second: 0x4a3c22, snow: 0.9 }), concrete_board: P('wood', { second: 0x6d6a64, scale: 0.7, rough: 1.15, normal: 0.6 }),
  brick_clinker: P('brick', { second: 0x4a4440 }), gravel_path: P('gravel', { second: 0x8a8070, scale: 0.8, flags: F_GROUND, grime: 0 }),
  meadow: P('grass', { second: 0xc9b86a, scale: 0.7, flags: F_GROUND, grime: 0, porous: 0.5 }), forest_floor: P('dirt', { second: 0x4a3a24, flags: F_GROUND, grime: 0 }),
  metal_grating: P('chain', { second: 'base', scale: 2, flags: F_CUTOUT, grime: 0 }), wood_deck: P('wood', { second: 0x2a1f16, scale: 1.2, flags: F_PUDDLE, grime: 0 }),
};
