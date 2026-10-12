// Hilfsfunktionen für Wahrzeichen und Verkehrsbauten (Besitzer: G6).
// Baut auf dem eingefrorenen Baukasten (kit.js) auf: alles landet über kit.add() in den Materialgruppen.
// Koordinaten wie im Baukasten: Ursprung = Grundstücksmitte am Boden, Front (Straße) zeigt nach +z, M = 1 m.
import * as THREE from 'three';
import { Kit, M } from './kit.js';

const ZA = new THREE.Vector3(0, 0, 1);
const YA = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();

// Flache Schattierung: Normalen werden vom Baukasten pro Dreieck neu berechnet
export function flat(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('normal');
  return g;
}

// Quader mit Mittelpunkt (x, y, z), beliebig gedreht
export function obox(kit, mat, x, y, z, sx, sy, sz, o = {}) {
  return kit.add(mat, new THREE.BoxGeometry(sx, sy, sz), { x, y, z, rx: o.rx, ry: o.ry, rz: o.rz, lit: o.lit });
}

// Balken zwischen zwei Punkten a, b ([x, y, z]); Querschnitt w × h
export function beam(kit, mat, a, b, w, h = w, o = {}) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  if (len < 1e-6) return null;
  const geo = new THREE.BoxGeometry(w, h, len + (o.extend || 0));
  d.normalize();
  // „Oben" des Querschnitts möglichst senkrecht halten
  const m = new THREE.Matrix4();
  const up = Math.abs(d.y) > 0.98 ? new THREE.Vector3(1, 0, 0) : YA;
  const xA = new THREE.Vector3().crossVectors(up, d).normalize();
  const yA = new THREE.Vector3().crossVectors(d, xA).normalize();
  m.makeBasis(xA, yA, d);
  geo.applyMatrix4(m);
  geo.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return kit.add(mat, geo, { lit: o.lit });
}

// Rundstab zwischen zwei Punkten
export function rod(kit, mat, a, b, r, seg = 6, o = {}) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  if (len < 1e-6) return null;
  const geo = new THREE.CylinderGeometry(o.rTop ?? r, r, len, seg, 1, !!o.open);
  geo.translate(0, len / 2, 0);
  _q.setFromUnitVectors(YA, d.normalize());
  geo.applyQuaternion(_q);
  geo.translate(a[0], a[1], a[2]);
  return kit.add(mat, geo, { lit: o.lit });
}

// Drehkörper: pts = [[radius, y], …] von unten nach oben, um (x, y, z)
export function lathe(kit, mat, x, y, z, pts, seg = 16, o = {}) {
  const geo = new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(Math.max(0.0001, r), h)), seg, o.phiStart || 0, o.phiLength || Math.PI * 2);
  return kit.add(mat, o.flat ? flat(geo) : geo, { x, y, z, rx: o.rx, ry: o.ry, rz: o.rz, sx: o.sx, sy: o.sy, sz: o.sz, lit: o.lit });
}

// Ring (Torus); Standard liegt er in der x/y-Ebene (Achse z)
export function torus(kit, mat, x, y, z, R, r, o = {}) {
  const geo = new THREE.TorusGeometry(R, r, o.radial || 5, o.tubular || 24, o.arc || Math.PI * 2);
  return kit.add(mat, geo, { x, y, z, rx: o.rx, ry: o.ry, rz: o.rz, lit: o.lit });
}

// Rohr entlang einer Punktfolge (glatte Kurve)
export function tube(kit, mat, pts, r, o = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])), !!o.closed, 'centripetal');
  const geo = new THREE.TubeGeometry(curve, o.tubular || pts.length * 4, r, o.radial || 5, !!o.closed);
  return kit.add(mat, geo, { lit: o.lit });
}

// Ebene Fläche aus einem 2D-Umriss (mit Löchern), extrudiert entlang z (Tiefe depth, mittig),
// dann wie kit.add platziert: o = {x, y, z, rx, ry, rz, lit}
export function slab(kit, mat, outline, depth, o = {}, holes = []) {
  const shape = new THREE.Shape(outline.map(([a, b]) => new THREE.Vector2(a, b)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([a, b]) => new THREE.Vector2(a, b))));
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 6 });
  geo.translate(0, 0, -depth / 2);
  return kit.add(mat, geo, o);
}

// Bogen-Umriss (Unterkante y = 0, mittig in x). kind: 'round' | 'pointed' | 'segment' | 'rect'
export function archOutline(w, h, kind = 'round', n = 8) {
  const hw = w / 2;
  if (kind === 'rect') return [[-hw, 0], [hw, 0], [hw, h], [-hw, h]];
  const pts = [[-hw, 0], [hw, 0]];
  if (kind === 'round') {
    const spring = Math.max(0, h - hw);
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI; pts.push([hw * Math.cos(a), spring + hw * Math.sin(a)]); }
  } else if (kind === 'segment') {
    const rise = Math.min(hw * 0.5, h * 0.3), spring = h - rise;
    const R = (rise * rise + hw * hw) / (2 * rise), cy = spring + rise - R;
    const a0 = Math.atan2(spring - cy, hw);
    for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * (Math.PI - 2 * a0); pts.push([R * Math.cos(a), cy + R * Math.sin(a)]); }
  } else {
    // Spitzbogen (gotisch)
    const rise = Math.max(hw, Math.min(hw * 1.25, h * 0.7)), spring = Math.max(0, h - rise);
    const R = (rise * rise + hw * hw) / (2 * hw), cx = hw - R;
    const tA = Math.acos(Math.min(1, -cx / R));
    const half = Math.max(2, n >> 1);
    for (let i = 0; i <= half; i++) { const t = (i / half) * tA; pts.push([cx + R * Math.cos(t), spring + R * Math.sin(t)]); }
    for (let i = half - 1; i >= 0; i--) { const t = (i / half) * tA; pts.push([-(cx + R * Math.cos(t)), spring + R * Math.sin(t)]); }
  }
  return pts;
}

// Bogenrahmen als einfaches Polygon (U-Form ohne Loch): Laibungsbreite t
export function archRing(w, h, t, kind = 'round', n = 10) {
  const hw = w / 2;
  const inner = archOutline(w, h, kind, n).slice(2).reverse();
  const outer = archOutline(w + t * 2, h + t, kind, n).slice(2);
  return [[-hw - t, 0], [-hw, 0], ...inner, [hw, 0], [hw + t, 0], ...outer];
}
// Fläche über einem Bogen bis zur Höhe top (für Tordurchfahrten)
export function archSpandrel(w, h, top, kind = 'round', n = 10) {
  const hw = w / 2;
  const arc = archOutline(w, h, kind, n).slice(2).reverse();
  return [[hw, top], [-hw, top], ...arc];
}

// Fassaden-Rahmen: liefert Weltpunkte relativ zu einer Wandfläche bei (cx, cz) mit Blickrichtung ry.
// u = entlang der Wand (rechts beim Draufschauen), w = nach außen.
export function face(cx, cz, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  return { ry, at: (u, w = 0) => [cx + c * u + s * w, cz - s * u + c * w] };
}
// Die vier Seiten einer Box (Mitte cx/cz, Größe sx × sz)
export function sides(cx, cz, sx, sz) {
  return [
    { name: 'front', f: face(cx, cz + sz / 2, 0), len: sx },
    { name: 'right', f: face(cx + sx / 2, cz, Math.PI / 2), len: sz },
    { name: 'back', f: face(cx, cz - sz / 2, Math.PI), len: sx },
    { name: 'left', f: face(cx - sx / 2, cz, -Math.PI / 2), len: sz },
  ];
}
// Positionen gleichmäßig entlang einer Länge
export function spread(len, spacing, margin = 0) {
  const n = Math.max(1, Math.floor((len - margin * 2) / spacing + 1e-6));
  const out = [];
  for (let k = 0; k < n; k++) out.push(-((n - 1) * spacing) / 2 + k * spacing);
  return out;
}

// Bogenfenster mit Laibung: Rahmen (Ring) + vertiefte Scheibe. Unterkante bei y0, auf der Wand bei (x, z), Blick ry.
export function archWindow(kit, x, y0, z, ry, w, h, o = {}) {
  const kind = o.kind || 'round', frame = o.frame || 'trim_stone', glass = o.glass || 'glass_window';
  const t = o.t ?? 0.25 * M, d = o.depth ?? 0.18 * M;
  const f = face(x, z, ry);
  if (kit.detail === 0) {
    if (o.lod === false || h < (o.lodMin ?? 3.0 * M)) return;
    const [gx, gz] = f.at(0, 0.04 * M);
    const shp = new THREE.Shape(archOutline(w, h, kind, 4).map(([a, b]) => new THREE.Vector2(a, b)));
    kit.add(glass, new THREE.ShapeGeometry(shp, 2), { x: gx, y: y0, z: gz, ry, lit: o.lit ?? kit.rng() });
    return;
  }
  const outer = archOutline(w + t * 2, h + t * 2, kind, kind === 'rect' ? 1 : 10).map(([a, b]) => [a, b - t]);
  const inner = archOutline(w, h, kind, kind === 'rect' ? 1 : 10);
  let [px, pz] = f.at(0, d / 2 - 0.02 * M);
  slab(kit, frame, outer, d, { x: px, y: y0, z: pz, ry }, [inner]);
  [px, pz] = f.at(0, 0.02 * M);
  slab(kit, glass, inner, 0.02 * M, { x: px, y: y0, z: pz, ry, lit: o.lit ?? kit.rng() });
  if (kit.detail < 2) return;
  // Sprossen
  const mats = o.bars || o.frame || 'trim_stone';
  const bw = 0.08 * M;
  const nV = o.mullions ?? (w > 1.6 * M ? 1 : 0);
  for (let k = 1; k <= nV; k++) {
    const u = -w / 2 + (k * w) / (nV + 1);
    [px, pz] = f.at(u, 0.05 * M);
    kit.box(mats, px, y0, pz, bw, h * (kind === 'rect' ? 1 : 0.86), 0.05 * M, { ry });
  }
  if (o.transom !== false && h > 2.2 * M) {
    [px, pz] = f.at(0, 0.05 * M);
    kit.box(mats, px, y0 + (kind === 'rect' ? h * 0.66 : Math.max(0.1, h - w / 2 - (kind === 'pointed' ? w * 0.3 : 0))), pz, w, bw, 0.05 * M, { ry });
  }
  if (o.sill !== false) {
    [px, pz] = f.at(0, 0.1 * M);
    kit.box(o.sillMat || frame, px, y0 - t - 0.12 * M, pz, w + t * 3, 0.14 * M, 0.3 * M, { ry });
  }
  if (o.key && kind === 'round') {
    [px, pz] = f.at(0, d / 2);
    kit.box(frame, px, y0 + h - 0.05 * M, pz, 0.35 * M, t + 0.15 * M, d + 0.05 * M, { ry });
  }
}

// Fensterreihe mit Bogenfenstern auf einer Wand (Rahmen aus face())
export function archRow(kit, f, len, y0, w, h, spacing, o = {}) {
  for (const u of spread(len, spacing, o.margin ?? spacing * 0.3)) {
    if (o.skip && o.skip(u)) continue;
    const [x, z] = f.at(u, 0);
    archWindow(kit, x, y0, z, f.ry, w, h, o);
  }
}

// Rosette (Rundfenster)
export function roseWindow(kit, x, y, z, ry, r, o = {}) {
  const frame = o.frame || 'trim_stone';
  const f = face(x, z, ry);
  const seg = kit.detail === 2 ? 20 : 12;
  let [px, pz] = f.at(0, 0.02 * M);
  kit.cyl(o.glass || 'glass_window', px, y, pz, r, 0.04 * M, { rx: Math.PI / 2, ry, seg, lit: o.lit ?? kit.rng() });
  if (kit.detail === 0) return;
  [px, pz] = f.at(0, 0.06 * M);
  torus(kit, frame, px, y, pz, r, 0.16 * M, { ry, tubular: seg, radial: 4 });
  if (kit.detail < 2) return;
  const n = o.spokes || 8;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI;
    kit.add(frame, new THREE.BoxGeometry(r * 2, 0.07 * M, 0.06 * M), { x: px, y, z: pz, ry, rz: a });
  }
  torus(kit, frame, px, y, pz, r * 0.38, 0.07 * M, { ry, tubular: 12, radial: 3 });
}

// Klassische Säule mit Basis und Kapitell
export function column(kit, mat, x, y0, z, r, h, o = {}) {
  const seg = kit.detail === 2 ? 12 : 8;
  if (kit.detail > 0) kit.box(o.base || mat, x, y0, z, r * 2.6, r * 0.5, r * 2.6);
  kit.cyl(mat, x, y0 + r * 0.5, z, r, h - r * 1.1, { seg, rTop: r * 0.86 });
  if (kit.detail > 0) {
    kit.cyl(mat, x, y0 + h - r * 0.6, z, r * 1.25, r * 0.3, { seg, rTop: r * 1.45 });
    kit.box(o.cap || mat, x, y0 + h - r * 0.3, z, r * 3, r * 0.3, r * 3);
  }
}

// Dreiecksgiebel (Tympanon) mit Gesims; liegt in der x/y-Ebene einer Wand bei (x, z), Blick ry
export function pediment(kit, mat, x, y0, z, ry, w, h, d, o = {}) {
  const f = face(x, z, ry);
  const [px, pz] = f.at(0, 0);
  slab(kit, mat, [[-w / 2, 0], [w / 2, 0], [0, h]], d, { x: px, y: y0, z: pz, ry });
  if (kit.detail === 0) return;
  // Gesims-Schrägen
  const cm = o.cornice || mat, l = Math.hypot(w / 2, h), a = Math.atan2(h, w / 2);
  const [cx, cz] = f.at(0, 0.05 * M);
  for (const s of [-1, 1]) {
    const [qx, qz] = f.at(s * w / 4, 0.05 * M);
    kit.add(cm, new THREE.BoxGeometry(l + 0.3 * M, 0.22 * M, d + 0.15 * M), { x: qx, y: y0 + h / 2 + 0.05 * M, z: qz, ry, rz: -s * a });
  }
  kit.box(cm, cx, y0 - 0.12 * M, cz, w + 0.4 * M, 0.24 * M, d + 0.2 * M, { ry });
}

// Treppe: Stufen in Richtung +w (nach außen) absteigend. Oberkante bei hTop.
export function stairs(kit, mat, x, z, ry, w, hTop, run, o = {}) {
  const n = Math.max(2, o.steps || Math.round(hTop / (0.17 * M)));
  const f = face(x, z, ry);
  const stepD = run / n;
  for (let k = 0; k < n; k++) {
    const hh = hTop * (1 - k / n);
    const [px, pz] = f.at(0, stepD * (k + 0.5));
    kit.box(mat, px, 0, pz, w, hh, stepD + 0.001, { ry });
    if (kit.detail === 0 && k > 0) break;
  }
}

// Geländer entlang einer Punktfolge [[x, z], …] auf Höhe y0
export function railing(kit, pts, y0, h = 1.0 * M, o = {}) {
  if (kit.detail === 0) return;
  const mat = o.mat || 'metal_dark';
  const spacing = o.spacing ?? 1.5 * M;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    beam(kit, mat, [ax, y0 + h, az], [bx, y0 + h, bz], 0.06 * M, 0.06 * M);
    if (kit.detail < 2) continue;
    if (o.mid !== false) beam(kit, mat, [ax, y0 + h * 0.5, az], [bx, y0 + h * 0.5, bz], 0.03 * M, 0.03 * M);
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / spacing));
    for (let k = 0; k <= n; k++) {
      if (k === n && i < pts.length - 2) continue;
      const t = k / n;
      kit.box(mat, ax + (bx - ax) * t, y0, az + (bz - az) * t, 0.05 * M, h, 0.05 * M);
    }
  }
}

// Glasgeländer (Brüstung aus Glasplatten mit Handlauf)
export function glassRail(kit, pts, y0, h = 1.0 * M, o = {}) {
  if (kit.detail === 0) return;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az) - Math.PI / 2;
    kit.box(o.glass || 'glass_skylight', (ax + bx) / 2, y0, (az + bz) / 2, len, h * 0.92, 0.03 * M, { ry, lit: 0 });
    beam(kit, o.mat || 'metal_light', [ax, y0 + h, az], [bx, y0 + h, bz], 0.07 * M, 0.05 * M);
  }
}

// Straßenlaterne mit Nachtlicht
export function lamp(kit, x, z, h = 4.5 * M, o = {}) {
  if (kit.detail === 0) return;
  const pole = o.pole || 'metal_dark', y0 = o.y0 || 0;
  kit.cyl(pole, x, y0, z, 0.07 * M, h, { seg: 6 });
  const top = y0 + h;
  if (o.style === 'globe') kit.sphere(o.head || 'emissive_warm', x, top + 0.2 * M, z, 0.28 * M, { seg: 8 });
  else if (o.style === 'old') {
    kit.cyl(pole, x, top - 0.1 * M, z, 0.22 * M, 0.08 * M, { seg: 6 });
    kit.cyl(o.head || 'emissive_warm', x, top - 0.02 * M, z, 0.18 * M, 0.45 * M, { seg: 6, rTop: 0.24 * M });
    kit.cone(pole, x, top + 0.43 * M, z, 0.3 * M, 0.25 * M, { seg: 6 });
  } else {
    const ry = o.ry || 0, dx = Math.sin(ry) * 0.5 * M, dz = Math.cos(ry) * 0.5 * M;
    beam(kit, pole, [x, top, z], [x + dx, top + 0.05 * M, z + dz], 0.06 * M);
    kit.box(o.head || 'emissive_warm', x + dx, top - 0.08 * M, z + dz, 0.35 * M, 0.08 * M, 0.35 * M);
  }
  kit.light(x, top, z, o.color ?? 0xffd79a, o.size ?? 0.35);
}

// Parkbank
export function bench(kit, x, z, ry = 0) {
  if (kit.detail < 2) return;
  const f = face(x, z, ry);
  let [px, pz] = f.at(0, 0);
  kit.box('wood_planks', px, 0.42 * M, pz, 1.6 * M, 0.06 * M, 0.45 * M, { ry });
  [px, pz] = f.at(0, -0.22 * M);
  kit.box('wood_planks', px, 0.55 * M, pz, 1.6 * M, 0.4 * M, 0.05 * M, { ry });
  for (const s of [-1, 1]) { [px, pz] = f.at(s * 0.7 * M, 0); kit.box('metal_dark', px, 0, pz, 0.06 * M, 0.45 * M, 0.45 * M, { ry }); }
}

// Fahnenmast mit Flagge
export function flag(kit, x, z, h, mat, o = {}) {
  if (kit.detail === 0) return;
  kit.cyl('metal_light', x, o.y0 || 0, z, 0.05 * M, h, { seg: 6 });
  if (kit.detail < 2 && !o.keep) return;
  const ry = o.ry || 0;
  const [px, pz] = face(x, z, ry).at(0.6 * M, 0);
  kit.box(mat, px, (o.y0 || 0) + h - 0.9 * M, pz, 1.2 * M, 0.8 * M, 0.03 * M, { ry });
}

// Pflanzkübel / Poller
export function bollard(kit, x, z, mat = 'metal_dark') { if (kit.detail === 2) kit.cyl(mat, x, 0, z, 0.08 * M, 0.9 * M, { seg: 6 }); }
export function planter(kit, x, z, s = 1) {
  if (kit.detail === 0) return;
  kit.box('concrete', x, 0, z, 1.1 * M * s, 0.5 * M, 1.1 * M * s);
  kit.sphere(kit.rng() < 0.5 ? 'hedge' : 'leaves_green', x, 0.8 * M, z, 0.55 * M * s, { seg: 6 });
}

// Bäume in mehreren Formen. kind: 'round' | 'conifer' | 'poplar' | 'palm' | 'topiary' | 'cone'
export function tree(kit, x, z, s = 1, kind = 'round', o = {}) {
  const y0 = o.y0 || 0;
  const lowSeg = kit.detail === 0;
  if (kind === 'conifer') {
    kit.cyl('bark', x, y0, z, 0.16 * M * s, 1.4 * M * s, { seg: 5 });
    const tiers = lowSeg ? 1 : 3;
    for (let k = 0; k < tiers; k++) {
      const r = (2.0 - k * 0.5) * M * s, yy = y0 + (1.0 + k * 1.6) * M * s;
      kit.cone(o.leaf || 'leaves_dark', x, yy, z, r, (lowSeg ? 6 : 2.8) * M * s, { seg: lowSeg ? 5 : 7 });
    }
    return;
  }
  if (kind === 'poplar') {
    kit.cyl('bark', x, y0, z, 0.15 * M * s, 1.6 * M * s, { seg: 5 });
    kit.add(o.leaf || 'leaves_green', new THREE.SphereGeometry(1, lowSeg ? 5 : 8, lowSeg ? 4 : 6), { x, y: y0 + 4.2 * M * s, z, sx: 1.1 * M * s, sy: 3.4 * M * s, sz: 1.1 * M * s });
    return;
  }
  if (kind === 'palm') {
    const h = 5.5 * M * s, lean = (o.lean ?? 0.4) * M * s, ry = o.ry ?? kit.rng() * 6.28;
    const tx = x + Math.sin(ry) * lean, tz = z + Math.cos(ry) * lean;
    rod(kit, 'bark', [x, y0, z], [tx, y0 + h, tz], 0.17 * M * s, 5, { rTop: 0.11 * M * s });
    const n = lowSeg ? 4 : 7;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + ry;
      const len = 2.4 * M * s;
      const ex = tx + Math.cos(a) * len, ez = tz + Math.sin(a) * len;
      beam(kit, o.leaf || 'leaves_green', [tx, y0 + h + 0.1 * M, tz], [ex, y0 + h - 0.9 * M * s, ez], 0.7 * M * s, 0.06 * M);
    }
    if (!lowSeg) kit.sphere('wood_dark', tx, y0 + h - 0.05 * M, tz, 0.3 * M * s, { seg: 6 });
    return;
  }
  if (kind === 'topiary') {
    kit.cyl('bark', x, y0, z, 0.08 * M * s, 0.6 * M * s, { seg: 5 });
    kit.sphere(o.leaf || 'hedge', x, y0 + 1.2 * M * s, z, 0.75 * M * s, { seg: lowSeg ? 5 : 8 });
    return;
  }
  if (kind === 'cone') {
    kit.cone(o.leaf || 'hedge', x, y0, z, 0.6 * M * s, 2.4 * M * s, { seg: lowSeg ? 5 : 8 });
    return;
  }
  // Laubbaum mit unregelmäßiger Krone
  const leaf = o.leaf || (kit.rng() < 0.5 ? 'leaves_green' : (kit.rng() < 0.5 ? 'leaves_dark' : 'leaves_light'));
  kit.cyl('bark', x, y0, z, 0.17 * M * s, 2.6 * M * s, { seg: 5, rTop: 0.12 * M * s });
  const segs = lowSeg ? 5 : 7;
  kit.add(leaf, flat(new THREE.IcosahedronGeometry(1.7 * M * s, lowSeg ? 0 : 1)), { x, y: y0 + 3.8 * M * s, z, sy: 0.85 });
  if (!lowSeg) {
    const a = kit.rng() * 6.28;
    kit.sphere(leaf, x + Math.cos(a) * 0.9 * M * s, y0 + 3.2 * M * s, z + Math.sin(a) * 0.9 * M * s, 1.1 * M * s, { seg: segs });
  }
}

// Rasen-/Belagsfläche (dünne Platte auf Bodenhöhe)
export function ground(kit, mat, x, z, sx, sz, y = 0, h = 0.06 * M) { kit.box(mat, x, y, z, sx, h, sz); }

// Weg als Band zwischen zwei Punkten am Boden
export function path(kit, mat, a, b, w, y = 0.07 * M) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ry = Math.atan2(b[0] - a[0], b[1] - a[1]);
  kit.box(mat, (a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2, w, y, len + w * 0.5, { ry });
}

// Brunnen mit Becken und Fontäne
export function fountain(kit, x, z, r, o = {}) {
  const stone = o.stone || 'stone_sandstone';
  const seg = kit.detail === 2 ? 20 : 12;
  kit.cyl(stone, x, 0, z, r, 0.55 * M, { seg });
  kit.cyl('water_pool', x, 0.4 * M, z, r - 0.25 * M, 0.12 * M, { seg });
  if (kit.detail === 0) return;
  kit.cyl(stone, x, 0, z, 0.35 * M, 1.6 * M, { seg: 8, rTop: 0.22 * M });
  kit.cyl(stone, x, 1.5 * M, z, r * 0.4, 0.2 * M, { seg, rTop: r * 0.45 });
  kit.cyl('water_pool', x, 1.62 * M, z, r * 0.36, 0.1 * M, { seg });
  if (kit.detail === 2) {
    kit.cyl('water_pool', x, 1.7 * M, z, 0.12 * M, o.jet ?? 1.4 * M, { seg: 6, rTop: 0.03 * M });
    kit.sphere(stone, x, 2.0 * M, z, 0.18 * M, { seg: 6 });
  }
}

// Dachgaube mit Satteldach auf einer Dachfläche (vereinfachter Kasten)
export function dormer(kit, x, y0, z, ry, w, h, roof = 'roof_slate', wall = 'trim_stone') {
  if (kit.detail === 0) return;
  const f = face(x, z, ry);
  const [px, pz] = f.at(0, -0.4 * M);
  kit.box(wall, px, y0, pz, w, h, 1.2 * M, { ry });
  const [rx, rz] = f.at(0, -0.4 * M);
  const rh = w * 0.45;
  kit.prism(roof, [[-w / 2 - 0.15 * M, 0], [w / 2 + 0.15 * M, 0], [0, rh]], 1.4 * M, { x: rx, y: y0 + h, z: rz, ry });
  const [gx, gz] = f.at(0, 0.21 * M);
  kit.window(gx, y0 + 0.2 * M, gz, ry, w * 0.6, h * 0.7, { frame: 'window_frame_white' });
}

// Satteldach-Häuschen (Kiosk, Kasse, Bude); Front nach ry
export function hut(kit, x, z, ry, w, d, h, o = {}) {
  const wall = o.wall || 'wood_planks', roof = o.roof || 'roof_tiles_red';
  kit.box(wall, x, 0, z, w, h, d, { ry });
  const rh = o.rh ?? Math.min(w, d) * 0.35;
  const ridgeAlongW = o.ridge !== 'd';
  kit.prism(roof, [[-(ridgeAlongW ? d : w) / 2 - 0.3 * M, 0], [(ridgeAlongW ? d : w) / 2 + 0.3 * M, 0], [0, rh]], (ridgeAlongW ? w : d) + 0.4 * M, { x, y: h, z, ry: ry + (ridgeAlongW ? Math.PI / 2 : 0) });
  if (o.gable !== false && kit.detail > 0) kit.prism(wall, [[-(ridgeAlongW ? d : w) / 2, 0], [(ridgeAlongW ? d : w) / 2, 0], [0, rh]], (ridgeAlongW ? w : d) - 0.01 * M, { x, y: h, z, ry: ry + (ridgeAlongW ? Math.PI / 2 : 0) });
  if (kit.detail === 0) return;
  const f = face(x, z, ry);
  if (o.counter) {
    const [cx, cz] = f.at(0, d / 2 + 0.02 * M);
    kit.box(o.glass || 'glass_shop', cx, h * 0.38, cz, w * 0.7, h * 0.4, 0.04 * M, { ry, lit: 0.95 });
    const [ax, az] = f.at(0, d / 2 + 0.45 * M);
    kit.box(o.awning || 'awning_striped', ax, h * 0.8, az, w * 0.85, 0.06 * M, 0.9 * M, { ry, rx: 0.25 });
  } else if (o.door !== false) {
    const [cx, cz] = f.at(0, d / 2 + 0.02 * M);
    kit.box('door_wood', cx, 0, cz, 0.9 * M, Math.min(2.1 * M, h * 0.85), 0.05 * M, { ry });
  }
}

// Animierte Teile: zeichnet mit einem eigenen Baukasten um den Drehpunkt (Geometrie relativ zum Drehpunkt!)
// und hängt sie an res.anim: { geometry, material, pivot: [x, y, z], axis, speed }.
// Vertrag (SWARM 6.2): Die Geometrie liegt im Koordinatensystem des Drehpunkts; G9 setzt sie bei
// Gebäudematrix · Verschiebung(pivot) · Drehung(axis, t · speed) ein.
export function addAnim(ctx, res, pivot, axis, speed, draw) {
  const k = new Kit(ctx.rng, ctx.kit.detail);
  draw(k);
  const r = k.build();
  if (!r.meshes.length) return;
  res.anim = res.anim || [];
  for (const m of r.meshes) res.anim.push({ geometry: m.geometry, material: m.material, pivot: [...pivot], axis, speed });
  res.triangles += r.triangles;
  res.height = Math.max(res.height, pivot[1] + r.height);
  for (const l of r.lights) res.lights.push({ ...l, x: l.x + pivot[0], y: l.y + pivot[1], z: l.z + pivot[2] });
}

// Menschen als kleine Figuren (nur Nahsicht): Körper + Kopf, Kleidung in bunten Farben. 1,75 m groß.
const SHIRTS = ['paint_red', 'paint_blue', 'paint_yellow', 'paint_green', 'paint_white', 'paint_orange', 'metal_dark', 'plaster_pink', 'siding_blue'];
export function person(kit, x, z, o = {}) {
  if (kit.detail < 2) return;
  const y0 = o.y0 || 0, s = o.s || 1, ry = o.ry || 0;
  const shirt = o.shirt || SHIRTS[Math.floor(kit.rng() * SHIRTS.length)];
  const skin = kit.rng() < 0.8 ? 'plaster_cream' : 'wood_planks';
  if (o.sit) {
    kit.box(shirt, x, y0 + 0.35 * M * s, z, 0.42 * M * s, 0.7 * M * s, 0.32 * M * s, { ry });
    kit.box(skin, x, y0 + 1.05 * M * s, z, 0.22 * M * s, 0.24 * M * s, 0.22 * M * s, { ry });
    return;
  }
  kit.box(kit.rng() < 0.5 ? 'metal_dark' : 'siding_blue', x, y0, z, 0.34 * M * s, 0.85 * M * s, 0.22 * M * s, { ry });
  kit.box(shirt, x, y0 + 0.85 * M * s, z, 0.44 * M * s, 0.62 * M * s, 0.26 * M * s, { ry });
  kit.box(skin, x, y0 + 1.5 * M * s, z, 0.22 * M * s, 0.25 * M * s, 0.22 * M * s, { ry });
}
// Menschengruppe zufällig in einem Rechteck (Mitte x/z, Größe w × d)
export function crowd(kit, x, z, w, d, n, o = {}) {
  if (kit.detail < 2) return;
  for (let i = 0; i < n; i++) person(kit, x + (kit.rng() - 0.5) * w, z + (kit.rng() - 0.5) * d, { ...o, ry: kit.rng() * 6.28 });
}

// Kleine Fahrzeuge als Dekoration (geparkt). Länge entlang +z vor Drehung ry.
export function car(kit, x, z, ry, color, o = {}) {
  const L = (o.len ?? 4.4) * M, W = 1.8 * M, y0 = o.y0 || 0;
  const f = face(x, z, ry);
  kit.box(color, x, y0 + 0.3 * M, z, W, 0.65 * M, L, { ry });
  if (kit.detail === 0) return;
  const [cx, cz] = f.at(0, -0.2 * M);
  kit.box(o.glass || 'glass_window', cx, y0 + 0.95 * M, cz, W * 0.86, 0.5 * M, L * 0.5, { ry, lit: 0 });
  kit.box(color, cx, y0 + 1.42 * M, cz, W * 0.84, 0.05 * M, L * 0.46, { ry });
  if (o.taxi) { kit.box(o.signMat || 'emissive_warm', cx, y0 + 1.47 * M, cz, 0.6 * M, 0.15 * M, 0.25 * M, { ry }); }
  if (kit.detail < 2) return;
  for (const s of [-1, 1]) for (const t of [-1, 1]) {
    const [wx, wz] = f.at(s * W * 0.47, t * L * 0.32);
    kit.cyl('rubber', wx, y0 + 0.33 * M, wz, 0.33 * M, 0.22 * M, { seg: 8, rz: Math.PI / 2, ry, x: wx, y: y0 + 0.33 * M });
  }
}

// Linienbus (12 m) – Länge entlang +z vor Drehung
export function bus(kit, x, z, ry, color = 'paint_yellow', o = {}) {
  const L = (o.len ?? 12) * M, W = 2.55 * M, y0 = o.y0 || 0;
  const f = face(x, z, ry);
  kit.box(color, x, y0 + 0.35 * M, z, W, 2.6 * M, L, { ry });
  kit.box('paint_white', x, y0 + 2.95 * M, z, W * 0.9, 0.12 * M, L * 0.85, { ry });
  if (kit.detail === 0) return;
  // Fensterband an beiden Seiten und Frontscheibe
  for (const s of [-1, 1]) {
    const [wx, wz] = f.at(s * (W / 2 + 0.01 * M), -0.3 * M);
    kit.box(o.glass || 'glass_window', wx, y0 + 1.25 * M, wz, 0.03 * M, 1.3 * M, L * 0.86, { ry, lit: 0.2 });
  }
  const [fx, fz] = f.at(0, L / 2 + 0.01 * M);
  kit.box(o.glass || 'glass_window', fx, y0 + 0.95 * M, fz, W * 0.9, 1.75 * M, 0.04 * M, { ry, lit: 0.2 });
  const [bx, bz] = f.at(0, L / 2 + 0.03 * M);
  kit.box(o.signMat || 'emissive_warm', bx, y0 + 2.75 * M, bz, W * 0.6, 0.18 * M, 0.03 * M, { ry });
  if (kit.detail < 2) return;
  for (const s of [-1, 1]) for (const t of [-0.32, 0.3]) {
    const [wx, wz] = f.at(s * W * 0.45, t * L);
    kit.cyl('rubber', wx, y0 + 0.48 * M, wz, 0.48 * M, 0.3 * M, { seg: 8, rz: Math.PI / 2, ry });
  }
  if (o.roofBox !== false) { const [rx, rz] = f.at(0, -L * 0.3); kit.box('metal_light', rx, y0 + 2.95 * M, rz, W * 0.7, 0.35 * M, 2.4 * M, { ry }); }
}

// Straßenbahn (ein- oder mehrteilig), Länge entlang +z
export function tram(kit, x, z, ry, color = 'paint_red', o = {}) {
  const parts = o.parts || 3, segL = (o.seg ?? 9.5) * M, W = 2.4 * M, y0 = o.y0 || 0;
  const f = face(x, z, ry);
  for (let k = 0; k < parts; k++) {
    const c = (k - (parts - 1) / 2) * (segL + 0.3 * M);
    const [px, pz] = f.at(0, c);
    kit.box(color, px, y0 + 0.4 * M, pz, W, 1.0 * M, segL, { ry });
    kit.box('paint_white', px, y0 + 1.4 * M, pz, W, 1.5 * M, segL, { ry });
    kit.box(color, px, y0 + 2.9 * M, pz, W * 0.98, 0.35 * M, segL, { ry });
    if (kit.detail === 0) continue;
    for (const s of [-1, 1]) {
      const [wx, wz] = f.at(s * (W / 2 + 0.01 * M), c);
      kit.box('glass_window', wx, y0 + 1.5 * M, wz, 0.03 * M, 1.2 * M, segL * 0.86, { ry, lit: 0.2 });
    }
    if (kit.detail === 2 && k === 1) {
      const [px2, pz2] = f.at(0, c);
      beam(kit, 'metal_dark', [px2, y0 + 3.25 * M, pz2], [px2, y0 + 4.2 * M, pz2 + 0.0001], 0.05 * M);
      kit.box('metal_dark', px2, y0 + 4.2 * M, pz2, 1.6 * M, 0.06 * M, 0.1 * M, { ry });
    }
  }
  if (kit.detail === 0) return;
  for (const t of [-1, 1]) {
    const [fx, fz] = f.at(0, t * ((parts * (segL + 0.3 * M)) / 2 - 0.15 * M));
    kit.box('glass_window', fx, y0 + 1.3 * M, fz, W * 0.85, 1.4 * M, 0.06 * M, { ry, lit: 0.2 });
  }
}

// Flugzeug (Mittelstrecke, vereinfacht), Nase zeigt nach +z vor Drehung. s = Maßstab (1 = 36 m)
export function plane(kit, x, y0, z, ry, s = 1, o = {}) {
  const L = 36 * M * s, R = 2.0 * M * s;
  const body = o.body || 'paint_white', tail = o.tail || 'paint_blue';
  const f = face(x, z, ry);
  const P = (u, w) => f.at(u, w);
  const yC = y0 + R + 1.6 * M * s;
  // Rumpf als Drehkörper entlang z
  const seg = kit.detail === 2 ? 12 : 7;
  const prof = [[0.02, -L / 2], [R * 0.55, -L / 2 + 2 * M * s], [R, -L / 2 + 8 * M * s], [R, L / 2 - 6 * M * s], [R * 0.8, L / 2 - 2 * M * s], [0.02, L / 2]];
  const [cx, cz] = P(0, 0);
  kit.add(body, new THREE.LatheGeometry(prof.map(([r, h]) => new THREE.Vector2(r, h)), seg), { x: cx, y: yC, z: cz, rx: Math.PI / 2, ry });
  // Flügel (gepfeilt) und Höhenleitwerk
  const wing = (span, chord, wz, yy, mat, sweep) => {
    for (const sd of [-1, 1]) {
      const outline = [[0, 0], [sd * span, -sweep], [sd * span, -sweep - chord * 0.35], [0, -chord]];
      const pts = outline.map(([u, w]) => [u, w]);
      const shape = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.25 * M * s, bevelEnabled: false });
      geo.rotateX(Math.PI / 2);
      const [px, pz] = P(0, wz);
      kit.add(mat, geo, { x: px, y: yy, z: pz, ry });
    }
  };
  wing(16 * M * s, 6 * M * s, 2 * M * s, yC - R * 0.5, o.wing || 'metal_light', 5 * M * s);
  wing(6 * M * s, 3 * M * s, -L / 2 + 5 * M * s, yC + R * 0.3, body, 2 * M * s);
  // Seitenleitwerk
  const fin = [[0, 0], [-5.5 * M * s, 0], [-8 * M * s, 6.5 * M * s], [-5.5 * M * s, 6.5 * M * s]];
  const [tx, tz] = P(0, -L / 2 + 8 * M * s);
  slab(kit, tail, fin.map(([w, h]) => [w, h]), 0.3 * M * s, { x: tx, y: yC + R * 0.6, z: tz, ry: ry - Math.PI / 2 });
  // Triebwerke
  if (kit.detail > 0) for (const sd of [-1, 1]) {
    const [ex, ez] = P(sd * 5.5 * M * s, 2.5 * M * s);
    kit.cyl(o.engine || 'metal_light', ex, yC - R * 0.95, ez, 0.9 * M * s, 3.6 * M * s, { rx: Math.PI / 2, ry, seg: 10 });
  }
  if (kit.detail === 2) {
    // Fensterband und Cockpit
    for (const sd of [-1, 1]) {
      const [wx, wz] = P(sd * (R * 0.98), 0);
      kit.box(o.glass || 'glass_window', wx, yC + R * 0.15, wz, 0.04 * M, 0.35 * M * s, L * 0.6, { ry, lit: 0.3 });
    }
    const [kx, kz] = P(0, L / 2 - 2.6 * M * s);
    kit.box(o.glass || 'glass_window', kx, yC + R * 0.35, kz, R * 1.2, 0.5 * M * s, 1.2 * M * s, { ry, rx: -0.4, lit: 0 });
    // Fahrwerk
    for (const [u, w] of [[0, L / 2 - 5 * M * s], [-2.5 * M * s, -1 * M * s], [2.5 * M * s, -1 * M * s]]) {
      const [gx, gz] = P(u, w);
      kit.cyl('metal_dark', gx, y0 + 0.5 * M * s, gz, 0.12 * M * s, yC - y0 - R, { seg: 5 });
      kit.cyl('rubber', gx, y0 + 0.55 * M * s, gz, 0.55 * M * s, 0.5 * M * s, { seg: 8, rz: Math.PI / 2, ry });
    }
    if (o.stripe) { const [sx, sz] = P(0, 0); kit.box(o.stripe, sx, yC - R * 0.35, sz, R * 2.02, 0.35 * M * s, L * 0.7, { ry }); }
  }
}

// Personenzug-Wagen (Länge entlang +z vor Drehung)
export function railcar(kit, x, y0, z, ry, len, o = {}) {
  const W = 2.9 * M, body = o.body || 'paint_white', stripe = o.stripe || 'paint_red';
  const f = face(x, z, ry);
  kit.box(body, x, y0 + 0.9 * M, z, W, 3.0 * M, len, { ry });
  kit.box('metal_dark', x, y0 + 0.4 * M, z, W * 0.8, 0.5 * M, len * 0.9, { ry });
  if (kit.detail === 0) return;
  for (const s of [-1, 1]) {
    const [wx, wz] = f.at(s * (W / 2 + 0.01 * M), 0);
    kit.box('glass_window', wx, y0 + 2.0 * M, wz, 0.03 * M, 0.95 * M, len * 0.86, { ry, lit: kit.rng() });
    kit.box(stripe, wx, y0 + 1.3 * M, wz, 0.035 * M, 0.25 * M, len * 0.98, { ry });
  }
  const roof = new THREE.CylinderGeometry(W * 0.5, W * 0.5, len, kit.detail === 2 ? 10 : 6, 1, false, -Math.PI / 2, Math.PI);
  roof.rotateX(-Math.PI / 2);
  roof.scale(1, 0.3, 1);
  kit.add(body, roof, { x, y: y0 + 3.9 * M, z, ry });
}
