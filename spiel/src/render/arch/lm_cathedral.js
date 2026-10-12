// Dom (2 × 3 Felder): gotische Kathedrale mit Doppelturmfassade, Rosette, Strebewerk, Querhaus und Chorpolygon.
// Besitzer: G6. Front (Westfassade) zeigt nach +z.
import * as THREE from 'three';
import { registerArch } from './index.js';
import { M } from './kit.js';
import { obox, beam, slab, archOutline, archWindow, roseWindow, face, tube, lamp, bench, tree, flat } from './lm_parts.js';

const STONE = 'stone_sandstone', DARKSTONE = 'stone_dark', ROOF = 'roof_slate';

// Fiale: Schaft + Pyramide + Kreuzblume
export function pinnacle(kit, x, y0, z, s, mat = STONE) {
  if (kit.detail === 0) { kit.cone(mat, x, y0, z, s * 0.7, s * 5, { seg: 4 }); return; }
  kit.box(mat, x, y0, z, s, s * 1.8, s);
  if (kit.detail === 2) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    kit.prism(mat, [[-s * 0.32, 0], [s * 0.32, 0], [0, s * 0.7]], s * 0.12, { x: x + dx * s * 0.5, y: y0 + s * 1.8, z: z + dz * s * 0.5, ry: dx ? Math.PI / 2 : 0 });
  }
  kit.cone(mat, x, y0 + s * 1.8, z, s * 0.62, s * 3.6, { seg: 4, ry: Math.PI / 4 });
  if (kit.detail === 2) kit.sphere(mat, x, y0 + s * 5.5, z, s * 0.2, { seg: 5 });
}

// Achteckiger Turmhelm mit Krabben und Kreuzblume
function spire(kit, x, y0, z, r, h, mat = STONE) {
  const seg = 8;
  kit.add(mat, flat(new THREE.ConeGeometry(r, h, seg, 1, false, Math.PI / 8)), { x, y: y0 + h / 2, z });
  if (kit.detail === 0) return;
  // Bänder (Maßwerk-Ringe)
  for (const t of [0.22, 0.48, 0.72]) kit.cyl(mat, x, y0 + h * t, z, r * (1 - t) + 0.12 * M, 0.25 * M, { seg, ry: Math.PI / 8 });
  if (kit.detail === 2) {
    const n = Math.max(3, Math.round(h / (2.2 * M)));
    for (let e = 0; e < seg; e++) {
      const a = Math.PI / 8 + (e / seg) * Math.PI * 2;
      for (let k = 1; k < n; k++) {
        const t = k / n, rr = r * (1 - t) + 0.12 * M;
        kit.add(mat, new THREE.BoxGeometry(0.28 * M, 0.38 * M, 0.42 * M), { x: x + Math.sin(a) * rr, y: y0 + h * t, z: z + Math.cos(a) * rr, ry: a, rx: -0.5 });
      }
    }
  }
  // Kreuzblume
  kit.cyl(mat, x, y0 + h - 0.1 * M, z, 0.12 * M, 1.2 * M, { seg: 5 });
  kit.sphere(mat, x, y0 + h + 0.5 * M, z, 0.38 * M, { seg: 6 });
  kit.box(mat, x, y0 + h + 0.3 * M, z, 1.2 * M, 0.25 * M, 0.25 * M);
  kit.box(mat, x, y0 + h + 0.3 * M, z, 0.25 * M, 0.25 * M, 1.2 * M);
}

// Wimperg (spitzer Ziergiebel) über einem Portal oder Fenster
function wimperg(kit, x, y0, z, ry, w, h) {
  const f = face(x, z, ry);
  const [px, pz] = f.at(0, 0.25 * M);
  slab(kit, STONE, [[-w / 2, 0], [w / 2, 0], [0, h]], 0.35 * M, { x: px, y: y0, z: pz, ry });
  if (kit.detail === 2) {
    const [qx, qz] = f.at(0, 0.45 * M);
    kit.cyl('glass_window', qx, y0 + h * 0.38, qz, w * 0.16, 0.02 * M, { rx: Math.PI / 2, ry, seg: 10, lit: 0.5 });
    const [cx, cz] = f.at(0, 0.25 * M);
    kit.sphere(STONE, cx, y0 + h + 0.25 * M, cz, 0.3 * M, { seg: 5 });
    for (const s of [-1, 1]) { const [qx2, qz2] = f.at(s * (w / 2 + 0.15 * M), 0.25 * M); pinnacle(kit, qx2, y0 - 0.2 * M, qz2, 0.35 * M); }
  }
}

// Gestuftes Spitzbogenportal mit Archivolten und Tympanon
function portal(kit, x, z, ry, w, h) {
  const f = face(x, z, ry);
  const steps = kit.detail === 2 ? 4 : kit.detail === 1 ? 2 : 1;
  for (let k = 0; k < steps; k++) {
    const ww = w + (steps - 1 - k) * 0.55 * M, hh = h + (steps - 1 - k) * 0.5 * M;
    const outer = archOutline(ww + 0.5 * M, hh + 0.4 * M, 'pointed', 10);
    const inner = archOutline(ww, hh, 'pointed', 10);
    const [px, pz] = f.at(0, (steps - k) * 0.22 * M);
    slab(kit, k % 2 ? DARKSTONE : STONE, outer, 0.45 * M, { x: px, y: 0, z: pz, ry }, [inner]);
  }
  const [dx, dz] = f.at(0, 0.05 * M);
  slab(kit, DARKSTONE, archOutline(w, h, 'pointed', 10), 0.1 * M, { x: dx, y: 0, z: dz, ry });
  if (kit.detail === 0) return;
  const [tx, tz] = f.at(0, 0.12 * M);
  kit.box('door_wood', tx, 0, tz, w * 0.86, h * 0.56, 0.08 * M, { ry });
  if (kit.detail === 2) {
    kit.box(STONE, tx, 0, tz, 0.3 * M, h * 0.56, 0.18 * M, { ry });
    const [sx, sz] = f.at(0, 0.18 * M);
    kit.box(STONE, sx, h * 0.56, sz, w * 0.9, 0.2 * M, 0.2 * M, { ry });
    kit.sphere(STONE, sx, h * 0.75, sz, 0.45 * M, { seg: 6 });
  }
}

// Strebepfeiler mit Fiale; steht außen an einer Wand (Blick ry), Tiefe d
function buttress(kit, x, z, ry, h, d, w = 0.9 * M) {
  const f = face(x, z, ry);
  let [px, pz] = f.at(0, d / 2);
  kit.box(STONE, px, 0, pz, w, h * 0.55, d, { ry });
  [px, pz] = f.at(0, d * 0.35);
  kit.box(STONE, px, h * 0.55, pz, w * 0.85, h * 0.45, d * 0.7, { ry });
  if (kit.detail > 0) {
    [px, pz] = f.at(0, d * 0.82);
    kit.box(STONE, px, h * 0.55 - 0.15 * M, pz, w * 1.02, 0.3 * M, d * 0.36, { ry, rx: 0.5 });
    [px, pz] = f.at(0, d * 0.62);
    kit.box(STONE, px, h - 0.2 * M, pz, w * 0.9, 0.3 * M, d * 0.36, { ry, rx: 0.5 });
  }
  [px, pz] = f.at(0, d * 0.35);
  pinnacle(kit, px, h, pz, w * 0.62);
  return [px, pz];
}

// Turm: quadratischer Schaft mit Eckstreben, Glockengeschoss, Oktogon und Helm
function tower(kit, x, z, w, opt) {
  const { h1, h2, h3, oct, spireH } = opt;
  const sideList = [
    { f: face(x, z + w / 2, 0), n: 'front' }, { f: face(x + w / 2, z, Math.PI / 2), n: 'right' },
    { f: face(x, z - w / 2, Math.PI), n: 'back' }, { f: face(x - w / 2, z, -Math.PI / 2), n: 'left' },
  ];
  kit.box(STONE, x, 0, z, w, h3, w);
  kit.box(DARKSTONE, x, 0, z, w + 0.3 * M, 1.2 * M, w + 0.3 * M);
  for (const y of [h1, h2]) kit.band(STONE, x, z, w, w, y, 0.45 * M, 0.25 * M);
  kit.band(STONE, x, z, w, w, h3 - 0.5 * M, 0.6 * M, 0.35 * M);
  // Eckstreben (je Ecke zwei, nach oben abgetreppt)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (const [ax, az] of [[1, 0], [0, 1]]) {
      const bx = x + sx * (w / 2 - 0.45 * M) + ax * sx * 0.55 * M, bz = z + sz * (w / 2 - 0.45 * M) + az * sz * 0.55 * M;
      const ww = ax ? 1.1 * M : 0.9 * M, dd = az ? 1.1 * M : 0.9 * M;
      kit.box(STONE, bx, 0, bz, ww + (ax ? 0.4 * M : 0), h1, dd + (az ? 0.4 * M : 0));
      kit.box(STONE, bx, h1, bz, ww + (ax ? 0.15 * M : 0), h2 - h1, dd + (az ? 0.15 * M : 0));
      kit.box(STONE, bx, h2, bz, ww, h3 - h2 + 0.4 * M, dd);
    }
    pinnacle(kit, x + sx * (w / 2 - 0.1 * M), h3 + 0.2 * M, z + sz * (w / 2 - 0.1 * M), 0.75 * M);
  }
  // Fenster der Geschosse
  for (const { f, n } of sideList) {
    const [cx, cz] = f.at(0, 0);
    const hidden = n === opt.hiddenSide;
    if (n === 'front' && opt.portal) portal(kit, cx, cz, f.ry, 2.0 * M, 5.0 * M);
    else if (n !== 'back' && !hidden) archWindow(kit, cx, 2.8 * M, cz, f.ry, 1.3 * M, 4.2 * M, { kind: 'pointed', frame: STONE, mullions: 1 });
    if (!hidden) archWindow(kit, cx, h1 + 1.4 * M, cz, f.ry, 1.7 * M, 5.4 * M, { kind: 'pointed', frame: STONE, mullions: 1 });
    // Glockengeschoss: zwei hohe Schallfenster
    for (const u of [-0.95 * M, 0.95 * M]) {
      const [wx, wz] = f.at(u, 0);
      archWindow(kit, wx, h2 + 1.0 * M, wz, f.ry, 1.25 * M, (h3 - h2) - 2.4 * M, { kind: 'pointed', frame: STONE, glass: 'glass_window', mullions: 0, lit: 0 });
      if (kit.detail === 2) for (let k = 0; k < 5; k++) {
        const [lx, lz] = f.at(u, 0.08 * M);
        kit.box('wood_dark', lx, h2 + 1.6 * M + k * 0.9 * M, lz, 1.2 * M, 0.12 * M, 0.08 * M, { ry: f.ry, rx: 0.5 });
      }
    }
    if (kit.detail > 0) { const [gx, gz] = f.at(0, 0.3 * M); wimperg(kit, gx, h3 - 1.0 * M, gz, f.ry, 3.2 * M, 2.4 * M); }
  }
  // Oktogon
  const r8 = (w / 2) * 0.82;
  kit.cyl(STONE, x, h3, z, r8, oct, { seg: 8, ry: Math.PI / 8 });
  kit.cyl(STONE, x, h3 + oct - 0.4 * M, z, r8 + 0.25 * M, 0.5 * M, { seg: 8, ry: Math.PI / 8 });
  for (let e = 0; e < 8; e++) {
    const a = (e / 8) * Math.PI * 2;
    const ap = r8 * Math.cos(Math.PI / 8);
    const wx = x + Math.sin(a) * ap, wz = z + Math.cos(a) * ap;
    archWindow(kit, wx, h3 + 1.0 * M, wz, a, 0.9 * M, oct - 2.4 * M, { kind: 'pointed', frame: STONE, mullions: 0, sill: false, lit: 0 });
    if (kit.detail === 2) {
      const [gx, gz] = face(wx, wz, a).at(0, 0.1 * M);
      wimperg(kit, gx, h3 + oct - 1.2 * M, gz, a, 1.5 * M, 1.4 * M);
    }
  }
  spire(kit, x, h3 + oct, z, r8 + 0.1 * M, spireH);
}

registerArch('cathedral', {
  variants: 1,
  build(ctx) {
    const { kit, detail } = ctx;
    const ZF = 11.6 * M;                 // Westfassade
    const TW = 6.0 * M, TX = 6.2 * M;    // Türme
    const NX = 3.4 * M;                  // halbe Mittelschiffbreite
    const AX = 7.9 * M;                  // Außenwand Seitenschiff
    const ZT = ZF - TW;                  // Turm-Rückseite
    const ZC0 = -1.0 * M, ZC1 = -7.8 * M; // Vierung
    const ZA = -10.6 * M, RA = NX;       // Chorpolygon-Mitte
    const HA = 7.5 * M, HN = 16.5 * M, RR = 7.2 * M; // Seitenschiff, Mittelschiff, Dachhöhe
    const QX = 9.4 * M;                  // Querhaus-Enden

    // --- Domplatz
    kit.box('pavers', 0, 0, 0, 19.8 * M, 0.08 * M, 29.8 * M);
    kit.box('stone_grey', 0, 0, ZF + 1.6 * M, 19.6 * M, 0.12 * M, 3.0 * M);
    kit.box('grass', 0, 0.02 * M, ZA - 3.2 * M, 19.6 * M, 0.08 * M, 2.6 * M);
    // Sockel um den ganzen Bau
    kit.box(DARKSTONE, 0, 0, (ZT + ZA) / 2, AX * 2 + 0.3 * M, 0.9 * M, ZT - ZA + 0.3 * M);

    // --- Mittelschiff, Chor
    const nz0 = ZT, nz1 = ZA;
    kit.box(STONE, 0, 0, (nz0 + nz1) / 2, NX * 2, HN, nz0 - nz1);
    kit.band(STONE, 0, (nz0 + nz1) / 2, NX * 2, nz0 - nz1, HN - 0.5 * M, 0.5 * M, 0.2 * M);
    kit.gableRoof(ROOF, 0, HN, (nz0 + nz1) / 2, NX * 2, nz0 - nz1, RR, { ridge: 'z', overhang: 0.35 * M });
    // Dachreiter-Ziergrat und kleine Gauben
    if (detail === 2) for (let z = nz1 + 1.5 * M; z < nz0 - 1 * M; z += 3.4 * M) for (const s of [-1, 1]) {
      if (z > ZC1 - 0.5 * M && z < ZC0 + 0.5 * M) continue;
      kit.box(ROOF, s * NX * 0.55, HN + RR * 0.38, z, 0.7 * M, 1.1 * M, 0.9 * M);
      kit.prism(ROOF, [[-0.5 * M, 0], [0.5 * M, 0], [0, 0.6 * M]], 1.0 * M, { x: s * NX * 0.55, y: HN + RR * 0.38 + 1.1 * M, z, ry: Math.PI / 2 });
    }
    // Seitenschiffe mit Pultdächern
    for (const s of [-1, 1]) {
      const cx = s * (NX + AX) / 2;
      kit.box(STONE, cx, 0, (ZT + ZC0) / 2, AX - NX, HA, ZT - ZC0);
      kit.prism(ROOF, s > 0 ? [[NX, 0], [AX + 0.35 * M, 0], [AX + 0.35 * M, 0.25 * M], [NX, 3.2 * M]] : [[-NX, 0], [-NX, 3.2 * M], [-AX - 0.35 * M, 0.25 * M], [-AX - 0.35 * M, 0]], ZT - ZC0, { x: 0, y: HA, z: (ZT + ZC0) / 2 });
    }
    // --- Querhaus
    kit.box(STONE, 0, 0, (ZC0 + ZC1) / 2, QX * 2, HN, ZC0 - ZC1);
    kit.gableRoof(ROOF, 0, HN, (ZC0 + ZC1) / 2, QX * 2, ZC0 - ZC1, RR, { ridge: 'x', overhang: 0.35 * M });
    for (const s of [-1, 1]) {
      kit.gableEnds(STONE, s * (QX - 0.4 * M), HN, (ZC0 + ZC1) / 2, 0.8 * M, ZC0 - ZC1, RR, { ridge: 'x' });
      const f = face(s * QX, (ZC0 + ZC1) / 2, s * Math.PI / 2);
      const [px, pz] = f.at(0, 0);
      portal(kit, px, pz, f.ry, 2.0 * M, 5.0 * M);
      roseWindow(kit, px, 11.0 * M, pz, f.ry, 2.3 * M, { frame: STONE });
      if (detail > 0) {
        const [wx, wz] = f.at(0, 0.1 * M);
        wimperg(kit, wx, 5.3 * M, wz, f.ry, 3.4 * M, 2.8 * M);
        // Giebelfeld mit Blendmaßwerk
        for (const u of [-1.2 * M, 0, 1.2 * M]) { const [bx, bz] = f.at(u, 0); archWindow(kit, bx, HN + 0.8 * M, bz, f.ry, 0.7 * M, u === 0 ? 4.2 * M : 2.8 * M, { kind: 'pointed', frame: STONE, mullions: 0, sill: false }); }
        for (const u of [-1, 1]) {
          const [bx, bz] = f.at(u * (ZC0 - ZC1) / 2, 0.45 * M);
          kit.box(STONE, bx, 0, bz, 1.0 * M, HN + 0.5 * M, 0.9 * M, { ry: f.ry });
          pinnacle(kit, bx, HN + 0.5 * M, bz, 0.7 * M);
        }
      }
      // Seitenfenster des Querhauses
      for (const zz of [ZC0, ZC1]) {
        const fz = face(s * (NX + QX) / 2, zz, zz === ZC0 ? 0 : Math.PI);
        const [wx, wz] = fz.at(0, 0);
        if (zz === ZC0) archWindow(kit, wx, 11.0 * M, wz, fz.ry, 1.8 * M, 4.4 * M, { kind: 'pointed', frame: STONE, mullions: 1 });
        else archWindow(kit, wx, 3.0 * M, wz, fz.ry, 2.0 * M, 10.0 * M, { kind: 'pointed', frame: STONE, mullions: 1 });
      }
    }
    // --- Chorpolygon (5/10-Schluss)
    const segs = 5;
    const vtx = [];
    for (let i = 0; i <= segs; i++) { const p = (i / segs) * Math.PI; vtx.push([RA * Math.cos(p), ZA - RA * Math.sin(p)]); }
    for (let i = 0; i < segs; i++) {
      const [ax, az] = vtx[i], [bx, bz] = vtx[i + 1];
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, len = Math.hypot(bx - ax, bz - az);
      const ry = Math.atan2(mx, mz - ZA);
      kit.box(STONE, mx, 0, mz, len + 0.25 * M, HN, 0.7 * M, { ry: ry });
      const [wx, wz] = face(mx, mz, ry).at(0, 0.35 * M);
      archWindow(kit, wx, 4.0 * M, wz, ry, 1.5 * M, 10.5 * M, { kind: 'pointed', frame: STONE, mullions: 1 });
    }
    kit.add(ROOF, flat(new THREE.ConeGeometry(RA + 0.45 * M, RR, segs, 1, true, Math.PI / 2, Math.PI)), { x: 0, y: HN + RR / 2, z: ZA });
    for (let i = 0; i <= segs; i++) {
      const [vx, vz] = vtx[i];
      const ry = Math.atan2(vx, vz - ZA);
      if (i === 0 || i === segs) continue;
      buttress(kit, vx, vz, ry, 12.5 * M, 2.2 * M);
    }
    // --- Strebewerk an Langhaus und Chor
    const bays = [(ZT + ZC0) / 2, (ZC1 + ZA) / 2, ZA];
    for (const s of [-1, 1]) {
      for (const bz of bays) {
        const inAisle = bz >= ZC0 - 0.01;
        const wallX = inAisle ? AX : NX;
        const top = buttress(kit, s * wallX, bz, s * Math.PI / 2, inAisle ? 10.5 * M : 13 * M, inAisle ? 1.8 * M : 2.4 * M, 1.0 * M);
        if (detail > 0 && inAisle) {
          const [fx] = face(s * NX, bz, s * Math.PI / 2).at(0, 0.1 * M);
          const y0 = inAisle ? 10.0 * M : 11.5 * M;
          tube(kit, STONE, [[top[0], y0, bz], [(top[0] + fx) / 2, y0 + 2.6 * M, bz], [fx, y0 + 3.9 * M, bz]], 0.3 * M, { tubular: 6, radial: 4 });
          beam(kit, STONE, [top[0], y0 + 1.2 * M, bz], [fx, y0 + 4.4 * M, bz], 0.35 * M, 0.4 * M);
        }
      }
      // Fenster: Seitenschiff unten, Obergaden oben
      for (let k = 0; k < 2; k++) {
        const zm = ZT - (k + 0.5) * ((ZT - ZC0) / 2);
        const fa = face(s * AX, zm, s * Math.PI / 2);
        let [wx, wz] = fa.at(0, 0);
        archWindow(kit, wx, 1.6 * M, wz, fa.ry, 1.9 * M, 4.8 * M, { kind: 'pointed', frame: STONE, mullions: 1 });
        const fn = face(s * NX, zm, s * Math.PI / 2);
        [wx, wz] = fn.at(0, 0);
        archWindow(kit, wx, HA + 3.6 * M, wz, fn.ry, 2.1 * M, 4.6 * M, { kind: 'pointed', frame: STONE, mullions: 1 });
      }
      const fc = face(s * NX, (ZC1 + ZA) / 2, s * Math.PI / 2);
      const [cx, cz] = fc.at(0, 0);
      archWindow(kit, cx, 4.0 * M, cz, fc.ry, 1.8 * M, 10.5 * M, { kind: 'pointed', frame: STONE, mullions: 1 });
    }
    // Maßwerkbrüstung (Galerie) auf den Traufen
    if (detail === 2) for (const s of [-1, 1]) for (let z = ZA + 0.4 * M; z < ZT; z += 0.9 * M) {
      if (z < ZC0 && z > ZC1) continue;
      kit.box(STONE, s * (NX + 0.12 * M), HN, z, 0.2 * M, 0.7 * M, 0.25 * M);
    }
    // --- Westfassade zwischen den Türmen
    kit.box(STONE, 0, 0, ZT + (ZF - ZT) / 2 - 0.3 * M, NX * 2 + 0.4 * M, HN + 1.0 * M, ZF - ZT - 0.6 * M);
    kit.gableEnds(STONE, 0, HN + 1.0 * M, ZF - 1.2 * M, NX * 2 + 0.4 * M, 1.2 * M, RR, { ridge: 'z' });
    const fw = face(0, ZF - 0.6 * M, 0);
    let [wx, wz] = fw.at(0, 0);
    portal(kit, wx, wz, 0, 3.2 * M, 6.8 * M);
    if (detail > 0) wimperg(kit, wx, 7.3 * M, wz + 0.3 * M, 0, 5.0 * M, 3.0 * M);
    roseWindow(kit, wx, 12.6 * M, wz, 0, 2.4 * M, { frame: STONE, spokes: 12 });
    // Königsgalerie
    if (detail > 0) for (const u of [-2.6, -1.56, -0.52, 0.52, 1.56, 2.6]) {
      const [gx, gz] = fw.at(u * M, 0);
      archWindow(kit, gx, HN - 0.5 * M, gz, 0, 0.6 * M, 1.3 * M, { kind: 'pointed', frame: STONE, glass: DARKSTONE, mullions: 0, sill: false, lit: 0 });
    }
    [wx, wz] = fw.at(0, 0);
    if (detail > 0) archWindow(kit, wx, HN + 1.8 * M, wz, 0, 0.9 * M, 3.4 * M, { kind: 'pointed', frame: STONE, mullions: 0 });
    // --- Türme
    for (const s of [-1, 1]) tower(kit, s * TX, ZF - TW / 2, TW, { h1: 9.5 * M, h2: 18.0 * M, h3: 26.5 * M, oct: 6.8 * M, spireH: 17.5 * M, portal: true, hiddenSide: s > 0 ? 'left' : 'right' });
    // --- Vierungsturm (Dachreiter)
    const vz = (ZC0 + ZC1) / 2, vy = HN + RR - 1.4 * M;
    kit.cyl(STONE, 0, vy, vz, 1.3 * M, 4.0 * M, { seg: 8, ry: Math.PI / 8 });
    if (detail > 0) for (let e = 0; e < 8; e++) {
      const a = (e / 8) * Math.PI * 2;
      const ap = 1.3 * M * Math.cos(Math.PI / 8);
      archWindow(kit, Math.sin(a) * ap, vy + 0.9 * M, vz + Math.cos(a) * ap, a, 0.5 * M, 2.2 * M, { kind: 'pointed', frame: STONE, mullions: 0, sill: false, lit: 0 });
    }
    kit.add('roof_copper', flat(new THREE.ConeGeometry(1.5 * M, 9.0 * M, 8, 1, false, Math.PI / 8)), { x: 0, y: vy + 4.0 * M + 4.5 * M, z: vz });
    kit.sphere('paint_yellow', 0, vy + 13.2 * M, vz, 0.3 * M, { seg: 6 });
    // --- Platz: Laternen, Bänke, Bäume
    if (detail > 0) {
      for (const s of [-1, 1]) {
        lamp(kit, s * 3.2 * M, ZF + 2.6 * M, 4.2 * M, { style: 'old' });
        lamp(kit, s * 9.3 * M, -3.0 * M, 4.2 * M, { style: 'old' });
        bench(kit, s * 6.0 * M, ZF + 2.4 * M, Math.PI);
        tree(kit, s * 8.9 * M, ZA - 3.0 * M, 0.85, 'round');
        tree(kit, s * 9.0 * M, ZC1 - 1.2 * M, 0.7, 'round');
      }
      for (const s of [-1, 1]) tree(kit, s * 5.2 * M, ZA - 3.6 * M, 0.7, 'round');
    }
    return kit.build();
  },
});
