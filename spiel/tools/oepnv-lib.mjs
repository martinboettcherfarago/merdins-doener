// Gemeinsame Abdeckungsrechnung für tools/oepnv-abdeckung.mjs und tools/megastadt.mjs.
// Ein Gebäude gilt als angebunden, wenn sein Feld im Einzugsgebiet einer bedienten U-Bahn-Station (g.cov.transit)
// oder einer Bus-/Tram-Haltestelle mit Fahrzeugen (Abdeckungsfeld des Verkehrssystems) liegt.
import { forDisc } from '../src/sim/services.js';
import { R } from '../src/config.js';

export const COV_MIN = 0.05;
export function coveredTile(g, i) {
  const m = g.cov.transit ? g.cov.transit[i] : 0;
  const T = g.ext.transport;
  const b = T && T.covField ? T.covField[i] : 0;
  return { metro: m > COV_MIN, bus: b > COV_MIN };
}
// Ein Gebäude ist angebunden, wenn irgendein Feld seiner Grundfläche abgedeckt ist
function coveredBuilding(g, b) {
  let metro = false, bus = false;
  for (let y = b.y; y < b.y + (b.h || 1); y++) for (let x = b.x; x < b.x + (b.w || 1); x++) {
    const c = coveredTile(g, y * g.W + x);
    metro ||= c.metro; bus ||= c.bus;
  }
  return { metro, bus };
}
export function coverageReport(g) {
  let res = 0, resC = 0, resM = 0, resB = 0, jobs = 0, jobsC = 0, total = 0, unc = 0;
  const uncovered = [];
  for (const b of g.buildings.values()) {
    if (!b.zone || b.abandoned || !b.occ) continue;
    total++;
    const c = coveredBuilding(g, b), any = c.metro || c.bus;
    if (b.zone === 1) { res += b.occ; if (any) resC += b.occ; if (c.metro) resM += b.occ; if (c.bus) resB += b.occ; }
    else { jobs += b.occ; if (any) jobsC += b.occ; }
    if (!any) { unc++; uncovered.push(b); }
  }
  return { res: res ? resC / res : 1, jobs: jobs ? jobsC / jobs : 1, resMetro: res ? resM / res : 0, resBus: res ? resB / res : 0, uncovered: unc, total, list: uncovered };
}

// Buslinien so legen, dass jedes Wohn- und Arbeitsgebäude eine Haltestelle (oder U-Bahn-Station) in der Nähe hat.
// Gierig: Start an der Haltestelle mit den meisten noch nicht angebundenen Bewohnern und Arbeitsplätzen, dann in
// Schritten von 4–9 Feldern weiter, solange neue Gebäude dazukommen; Linienenden möglichst an einer U-Bahn-Station.
// h: { canStop(g,i,'bus'), createLine, setVehicles, setVehicleType?, placeDepot(x,y) → bool, log }
const STOP_R = 3.2;
export function planBusCoverage(g, h, { maxLines = 90, minGain = 8 } = {}) {
  const W = g.W, TS = g.ext.transport;
  if (!TS) return 0;
  // abgedeckte Felder: U-Bahn-Einzugsgebiete und bestehende bediente Haltestellen
  const cov = new Uint8Array(g.N);
  for (let i = 0; i < g.N; i++) { const c = coveredTile(g, i); if (c.metro || c.bus) cov[i] = 1; }
  for (const s of TS.stops) if (s.lines && s.lines.length) forDisc(g, s.x + 0.5, s.y + 0.5, STOP_R, (t) => { cov[t] = 1; });
  // Gebäude ohne Anschluss
  const bs = [], bIdx = new Map();
  for (const b of g.buildings.values()) {
    if (!b.zone || b.abandoned || !b.occ) continue;
    let c = false;
    for (let y = b.y; y < b.y + (b.h || 1) && !c; y++) for (let x = b.x; x < b.x + (b.w || 1) && !c; x++) if (cov[y * W + x]) c = true;
    if (c) continue;
    bIdx.set(b.id, bs.length); bs.push(b);
  }
  if (!bs.length) return 0;
  const done = new Uint8Array(bs.length);
  // Haltestellen-Kandidaten im Hauptstraßennetz und die Gebäude in ihrem Einzugsgebiet
  const cands = [];
  for (let i = 0; i < g.N; i++) {
    if (!g.road[i] || g.road[i] === R.HIGHWAY || g.roadComp[i] !== g.outsideComp || h.canStop(g, i, 'bus')) continue;
    const near = new Set();
    forDisc(g, (i % W) + 0.5, ((i / W) | 0) + 0.5, STOP_R, (t) => { const k = bIdx.get(g.bld[t]); if (k !== undefined) near.add(k); });
    cands.push({ i, x: i % W, y: (i / W) | 0, near: [...near] });
  }
  const gain = (c) => { let s = 0; for (const k of c.near) if (!done[k]) s += bs[k].occ; return s; };
  const metroSt = [...g.transit.stations.values()];
  let lines = 0;
  while (lines < maxLines) {
    let seed = null, sg = minGain;
    for (const c of cands) { const v = gain(c); if (v > sg) { sg = v; seed = c; } }
    if (!seed) break;
    const take = (c) => { for (const k of c.near) done[k] = 1; };
    const seq = [seed]; take(seed);
    // in beide Richtungen wachsen
    for (const end of [1, 0]) {
      let dir = null, idle = 0;
      while (seq.length < 16 && idle < 2) {
        const cur = end ? seq[seq.length - 1] : seq[0];
        let best = null, bv = -1;
        for (const c of cands) {
          const dx = c.x - cur.x, dy = c.y - cur.y, d = Math.hypot(dx, dy);
          if (d < 4 || d > 9) continue;
          if (seq.some((s) => Math.hypot(s.x - c.x, s.y - c.y) < 3.5)) continue;
          if (dir && (dx * dir[0] + dy * dir[1]) / d < 0.3) continue;
          const v = gain(c) + (dir ? ((dx * dir[0] + dy * dir[1]) / d) * 2 : 0);
          if (v > bv) { bv = v; best = c; }
        }
        if (!best) break;
        const gv = gain(best);
        if (gv <= 0) idle++; else idle = 0;
        if (idle >= 2) break;
        const d = Math.hypot(best.x - cur.x, best.y - cur.y);
        dir = [(best.x - cur.x) / d, (best.y - cur.y) / d];
        take(best);
        if (end) seq.push(best); else seq.unshift(best);
      }
    }
    // Zubringer: Linienende an die nächste U-Bahn-Station führen, wenn sie nah ist
    for (const end of [1, 0]) {
      if (seq.length >= 16) break;
      const e = end ? seq[seq.length - 1] : seq[0];
      let st = null, sd = 10;
      for (const s of metroSt) { const d = Math.hypot(s.x - e.x, s.y - e.y); if (d < sd) { sd = d; st = s; } }
      if (!st || sd < 3) continue;
      let best = null, bd = 3;
      for (const c of cands) { const d = Math.hypot(c.x - st.x, c.y - st.y); if (d < bd && !seq.includes(c) && seq.every((s) => Math.hypot(s.x - c.x, s.y - c.y) >= 3.5)) { bd = d; best = c; } }
      if (best) { take(best); if (end) seq.push(best); else seq.unshift(best); }
    }
    if (seq.length < 2) { for (const k of seed.near) done[k] = 1; continue; }
    const tiles = seq.map((c) => c.i);
    let r = h.createLine(g, 'bus', tiles, false);
    if (!r.ok && /Depot|Fahrzeuge/.test(r.msg || '') && h.placeDepot(seed.x, seed.y)) r = h.createLine(g, 'bus', tiles, false);
    if (!r.ok) { h.log(`Buslinie nicht möglich: ${r.msg}`); continue; }
    const n = Math.max(2, Math.min(5, Math.ceil(seq.length / 3)));
    let v = h.setVehicles(g, r.line.id, n);
    if (!v.ok && h.placeDepot(seed.x, seed.y)) v = h.setVehicles(g, r.line.id, n);
    // leise Elektrobusse: keine Abgase an den Wohnstraßen
    if (h.setVehicleType) h.setVehicleType(g, r.line.id, 'ebus');
    lines++;
    h.log(`Buslinie für Abdeckung (${seq.length} Halte, ${n} Busse, +${sg} Plätze im Einzugsgebiet)`);
  }
  return lines;
}
