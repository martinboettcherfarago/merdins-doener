// Prüfstand Stadtbild ohne Browser: Grundstücks-Einpassung (render/arch/fit.js) und Stilfamilien (render/arch/mix.js).
// Geprüft wird, dass kein Zonenmodell über die Grenzen seines Grundstücks in die Nachbarn ragt, dass offene Bauweise
// seitlich Abstand hält und geschlossene Bauweise bündig auf der Grenze steht, dass die Einpassung in allen Detailstufen
// gleich ist und dass die Modellwahl je Straße zusammenpasst und reproduzierbar ist.
//   node test/abstand-test.mjs
import { buildArch } from '../src/render/arch/all.js';
import { archCount, archTags } from '../src/render/arch/index.js';
import { MixGrid, pickByStyle, encodeVariant, decodeVariant } from '../src/render/arch/mix.js';

let fails = 0, count = 0;
const check = (ok, msg) => { count++; if (!ok) { fails++; console.log(`ROT  ${msg}`); } };
const t0 = Date.now();
const GROUND = 0.0135, SOFT = /^(leaves|hedge|bark|ivy|grass|flower|lawn|water|rubber|paint_white)/;

// Ausdehnung über den Bodenplatten: alles (x, z) und Gebäudemasse (ohne Pflanzen u. Ä., über 2,8 m)
function extent(res) {
  const e = { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9, mx0: 1e9, mx1: -1e9 };
  for (const m of res.meshes) {
    const p = m.geometry.attributes.position.array, soft = SOFT.test(m.material);
    for (let i = 0; i < p.length; i += 9) {
      const maxY = Math.max(p[i + 1], p[i + 4], p[i + 7]);
      if (maxY <= GROUND) continue;
      for (let k = i; k < i + 9; k += 3) {
        e.x0 = Math.min(e.x0, p[k]); e.x1 = Math.max(e.x1, p[k]); e.z0 = Math.min(e.z0, p[k + 2]); e.z1 = Math.max(e.z1, p[k + 2]);
        if (!soft && maxY > 0.28) { e.mx0 = Math.min(e.mx0, p[k]); e.mx1 = Math.max(e.mx1, p[k]); }
      }
    }
  }
  return e;
}

// 1. Einpassung aller Zonenmodelle
const FPS = [[1, 1], [2, 1], [1, 2], [2, 2]];
let models = 0, over = 0, back = 0, dGap = 0, aFlush = 0, aTotal = 0, lodSame = 0, lodTotal = 0;
for (const key of ['res', 'com', 'off', 'ind', 'farm', 'forest']) {
  for (let level = 1; level <= 5; level++) for (const [fw, fd] of FPS) {
    const n = archCount(key, level, fw, fd);
    const tags = archTags(key, level, fw, fd);
    for (let i = 0; i < n; i++) {
      const res = buildArch(key, level, i, fw, fd, { zone: 1 }, 1);
      if (!res) continue;
      models++;
      const e = extent(res);
      const eps = 0.0005;
      if (e.x0 < -fw / 2 - eps || e.x1 > fw / 2 + eps) { over++; if (over <= 5) console.log(`     seitlich über die Grenze: ${key} ${level} ${fw}x${fd} #${i} (${e.x0.toFixed(3)} … ${e.x1.toFixed(3)})`); }
      if (e.z0 < -fd / 2 - eps) { back++; if (back <= 5) console.log(`     hinten über die Grenze: ${key} ${level} ${fw}x${fd} #${i}`); }
      const fit = res.fit;
      if (fit && (fit.typ === 'D' || fit.typ === 'R') && Math.min(e.mx0 + fw / 2, fw / 2 - e.mx1) < 0.05) dGap++;
      if (tags[i].typ === 'A' && fit) { aTotal++; if (fit.typ === 'A' && e.mx0 < -fw / 2 + 0.002 && e.mx1 > fw / 2 - 0.002) aFlush++; }
      // gleiche Einpassung in Fern- und Nahstufe (kein Springen beim Umschalten)
      if (fit && i % 3 === 0 && fw === 1 && fd === 1) {
        const r0 = buildArch(key, level, i, fw, fd, { zone: 1 }, 0), r2 = buildArch(key, level, i, fw, fd, { zone: 1 }, 2);
        lodTotal++;
        if (r0.fit && r2.fit && r0.fit.s === fit.s && r2.fit.s === fit.s && r0.fit.dz === fit.dz && r2.fit.dz === fit.dz && r0.fit.sx === fit.sx) lodSame++;
      }
    }
  }
}
check(over === 0, `kein Modell ragt seitlich ins Nachbargrundstück (${over} von ${models})`);
check(back === 0, `kein Modell ragt hinten über die Grenze (${back} von ${models})`);
check(dGap <= models * 0.02, `offene Bauweise hält seitlich mindestens 50 cm Abstand (${dGap} Ausnahmen)`);
check(aTotal > 0 && aFlush >= aTotal * 0.75, `geschlossene Bauweise steht bündig auf beiden Grenzen (${aFlush} von ${aTotal})`);
check(lodSame === lodTotal, `Einpassung in allen Detailstufen gleich (${lodSame} von ${lodTotal})`);

// 2. Varianten-Kodierung
let enc = true;
for (const [idx, hc, corner, pal] of [[0, 0, 0, 0], [31, 2, 3, 3], [7, 1, 2, 1], [12, 0, 1, 2]]) {
  const d = decodeVariant(encodeVariant(idx, hc, corner, pal));
  if (d.idx !== idx || d.hc !== hc || d.corner !== corner || d.pal !== pal) enc = false;
}
check(enc, 'Varianten-Kodierung (Modell, Höhenklasse, Ecklage, Farbfamilie) umkehrbar');

// 3. Stilfamilien: Modelle einer Straße liegen nahe an der Ziel-Epoche, Nachbarn verschieden, Wahl reproduzierbar
const mix = new MixGrid(64, 64, 11);
let spread = 0, same = 0, pairs = 0, stable = true;
for (const [key, level] of [['res', 1], ['res', 3], ['com', 3], ['off', 2]]) {
  const tags = archTags(key, level, 1, 1);
  for (const e of [0, 1, 2, 3]) {
    let prev = -1;
    for (let x = 4; x < 20; x++) {
      const i = pickByStyle(tags, e, mix, x, 9, level);
      if (i !== pickByStyle(tags, e, mix, x, 9, level)) stable = false;
      spread = Math.max(spread, Math.abs(tags[i].era - e));
      if (prev >= 0) { pairs++; if (prev === i) same++; }
      prev = i;
    }
  }
}
check(spread <= 1.31, `Modelle einer Straße höchstens eine Epoche vom Ziel entfernt (größte Abweichung ${spread.toFixed(2)})`);
check(same <= pairs * 0.12, `direkte Nachbarn meist verschiedene Modelle (${same} von ${pairs} gleich)`);
check(stable, 'Modellwahl reproduzierbar');
// Eckhäuser nur an Ecken, deren Straße rechts liegt
const ct = archTags('com', 3, 1, 1);
let eckOk = true;
for (let x = 0; x < 40; x++) for (const corner of [0, 1]) if (ct[pickByStyle(ct, 1.3, mix, x, 3, 3, corner)].typ === 'E') eckOk = false;
check(eckOk, 'Eckhäuser nur an Straßenecken');

console.log(`${fails ? 'ROT: ' + fails + ' von ' : ''}${count - fails}/${count} Prüfungen bestanden · ${models} Modelle · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(fails ? 1 : 0);
