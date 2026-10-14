// Infoansichten (Wärmekarten), Zonenflächen, Bauvorschau, Auswahl, Radien.
import * as THREE from 'three';
import { ZONE_INFO, T, RES, TRANSIT } from '../config.js';
import { OVERLAYS_EXTRA } from '../registry.js';

export const OVERLAYS = [
  { id: 'none', name: 'Normal' },
  { id: 'power', name: 'Strom', building: true },
  { id: 'water', name: 'Wasser', building: true },
  { id: 'garbage', name: 'Müll', field: 'cov:garbage' },
  { id: 'health', name: 'Gesundheit', field: 'cov:health' },
  { id: 'police', name: 'Polizei', field: 'cov:police' },
  { id: 'fire', name: 'Feuerwehr', field: 'cov:fire' },
  { id: 'edu', name: 'Bildung', field: 'cov:edu' },
  { id: 'landValue', name: 'Bodenwert', field: 'fields:landValue', scale: 70 },
  { id: 'pollution', name: 'Verschmutzung', field: 'fields:pollution', bad: true },
  { id: 'noise', name: 'Lärm', field: 'fields:noise', bad: true },
  { id: 'crime', name: 'Kriminalität', field: 'fields:crime', bad: true },
  { id: 'happiness', name: 'Glück', building: true },
  { id: 'traffic', name: 'Verkehr' },
  { id: 'transit', name: 'Pulsbahn', field: 'cov:transit' },
  { id: 'resources', name: 'Rohstoffe' },
];

export const allOverlays = () => [...OVERLAYS, ...OVERLAYS_EXTRA];

// Zonenflächen außerhalb des Zonen-Werkzeugs: Farbe zu einem hellen Bauplatz-Ton gemischt, wenig deckend
const ZONE_SOFT = { base: new THREE.Color(0xdcdad0), mix: 0.58, opacity: 0.2, grey: new THREE.Color(0x555555) };

const GOOD = [new THREE.Color(0xe5483c), new THREE.Color(0xf2c230), new THREE.Color(0x45c46b)];
function ramp(v, bad, out) {
  if (bad) v = 1 - v;
  v = Math.max(0, Math.min(1, v));
  if (v < 0.5) return out.copy(GOOD[0]).lerp(GOOD[1], v * 2);
  return out.copy(GOOD[1]).lerp(GOOD[2], (v - 0.5) * 2);
}

export class OverlayView {
  constructor(engine) {
    this.e = engine;
    this.g = engine.game;
    const g = this.g;
    this.mode = 'none';
    // Datentextur für Wärmekarten
    this.data = new Uint8Array(g.W * g.H * 4);
    this.tex = new THREE.DataTexture(this.data, g.W, g.H, THREE.RGBAFormat);
    this.tex.magFilter = THREE.LinearFilter;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.flipY = false;
    this.tex.needsUpdate = true;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(g.W, g.H), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, opacity: 0.78, toneMapped: false }));
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0.05;
    plane.renderOrder = 3;
    plane.visible = false;
    engine.scene.add(plane);
    this.plane = plane;
    // PlaneGeometry: UV (0,0) unten links → Textur-Zeile 0 = z min? Wir spiegeln über UVs.
    const uv = plane.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));

    // Zonenflächen: im Normalbetrieb ruhige, zurückgenommene Fläche ohne Raster (Bauplatz wirkt aufgeräumt);
    // mit dem Zonen-Werkzeug kräftige Farbe und Kachelraster zum Abzählen (setZoneStrong).
    const zgeo = new THREE.PlaneGeometry(1, 1); zgeo.rotateX(-Math.PI / 2);
    this.zoneMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: ZONE_SOFT.opacity, depthWrite: false, toneMapped: false });
    this.zones = new THREE.InstancedMesh(zgeo, this.zoneMat, g.N);
    this.zones.frustumCulled = false;
    this.zones.count = 0;
    this.zones.position.y = 0.035;
    this.zones.renderOrder = 2;
    this.zones.setColorAt(0, new THREE.Color(1, 1, 1));
    engine.scene.add(this.zones);

    // Vorschau-Kacheln
    const pgeo = new THREE.PlaneGeometry(0.98, 0.98); pgeo.rotateX(-Math.PI / 2);
    this.prevMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false });
    this.preview = new THREE.InstancedMesh(pgeo, this.prevMat, 4096);
    this.preview.frustumCulled = false;
    this.preview.count = 0;
    this.preview.position.y = 0.06;
    this.preview.renderOrder = 4;
    this.preview.setColorAt(0, new THREE.Color(1, 1, 1));
    engine.scene.add(this.preview);

    // Geister-Box für Gebäudeplatzierung
    this.ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0x8fe39f, transparent: true, opacity: 0.45, depthWrite: false }));
    this.ghost.visible = false;
    engine.scene.add(this.ghost);
    // Radius-Ring
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 96), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.08;
    this.ring.visible = false;
    engine.scene.add(this.ring);
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false, toneMapped: false }));
    this.disc.rotation.x = -Math.PI / 2;
    this.disc.position.y = 0.07;
    this.disc.visible = false;
    engine.scene.add(this.disc);
    // Auswahlrahmen
    this.sel = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false }));
    this.sel.renderOrder = 10;
    this.sel.visible = false;
    engine.scene.add(this.sel);
    // Linienvorschau (Pulsbahn)
    this.lineGeo = new THREE.BufferGeometry();
    this.lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 64), 3));
    this.linePrev = new THREE.Line(this.lineGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false }));
    this.linePrev.renderOrder = 11;
    this.linePrev.visible = false;
    engine.scene.add(this.linePrev);

    this.m4 = new THREE.Matrix4();
    this.c = new THREE.Color();
    this.zoneStrong = false;
    this.refreshZones();
  }

  refreshZones() {
    const g = this.g, W = g.W;
    const strong = this.zoneStrong, sc = strong ? 0.9 : 1;
    let n = 0;
    for (let i = 0; i < g.N; i++) {
      const z = g.zone[i];
      if (!z || g.bld[i]) continue;
      const x = i % W, y = (i / W) | 0;
      this.m4.makeScale(sc, 1, sc).setPosition(x + 0.5 - W / 2, 0, y + 0.5 - g.H / 2);
      this.zones.setMatrixAt(n, this.m4);
      this.c.setHex(ZONE_INFO[z].color);
      if (!strong) this.c.lerp(ZONE_SOFT.base, ZONE_SOFT.mix);
      const ok = g.access[i] >= 0 && g.roadComp[g.access[i]] === g.outsideComp;
      if (!ok) this.c.lerp(ZONE_SOFT.grey, 0.55);
      if (g.rubble[i]) this.c.setHex(0x444444);
      this.zones.setColorAt(n, this.c);
      n++;
    }
    this.zones.count = n;
    this.zones.instanceMatrix.needsUpdate = true;
    if (this.zones.instanceColor) this.zones.instanceColor.needsUpdate = true;
  }

  // Zonenflächen sind unbeleuchtet – nachts abdunkeln, sonst leuchten sie wie Neon
  setNight(n) {
    const k = 1 - 0.88 * Math.min(1, Math.max(0, n));
    if (this.zoneMat.color.r !== k) this.zoneMat.color.setScalar(k);
    if (this.prevMat) this.prevMat.color.setScalar(Math.max(k, 0.6));
  }

  setZoneStrong(on) {
    on = !!on;
    this.zoneMat.opacity = on ? 0.55 : ZONE_SOFT.opacity;
    if (this.zoneStrong === on) return;
    this.zoneStrong = on;
    this.refreshZones();
  }

  setMode(mode) {
    this.mode = mode;
    const def = allOverlays().find((o) => o.id === mode);
    this.plane.visible = !!(def && (def.field || mode === 'resources'));
    this.e.roads.setTrafficTint(mode === 'traffic');
    if (def && def.building) this.e.buildings.setTint((b) => this.buildingColor(b, mode));
    else if (mode !== 'none' && mode !== 'traffic' && mode !== 'transit') this.e.buildings.setTint((b) => this.fieldTint(b));
    else this.e.buildings.setTint(null);
    this.refresh();
  }

  fieldTint(b) {
    // in Feld-Ansichten Gebäude entsättigen, damit die Karte lesbar bleibt
    if (!this._grey) this._grey = new THREE.Color(0xe7e3dc);
    return this._grey;
  }

  buildingColor(b, mode) {
    const c = new THREE.Color();
    if (mode === 'power') return c.setHex(b.powered ? 0x45c46b : 0xe5483c);
    if (mode === 'water') return c.setHex(b.watered ? 0x3fa0e0 : 0xe5483c);
    if (mode === 'happiness') {
      if (!b.zone) return c.setHex(0xd9d4cc);
      return ramp(b.happy / 100, false, c);
    }
    const ext = OVERLAYS_EXTRA.find((o) => o.id === mode);
    if (ext && typeof ext.building === 'function') {
      const v = ext.building(this.g, b);
      return v === null || v === undefined ? c.setHex(0xd9d4cc) : c.setHex(v);
    }
    return null;
  }

  refresh() {
    const g = this.g;
    const def = allOverlays().find((o) => o.id === this.mode);
    if (!def) return;
    if (def.building) { this.e.buildings.setTint((b) => this.buildingColor(b, this.mode)); return; }
    if (this.mode === 'traffic') { this.e.roads.setTrafficTint(true); return; }
    if (!this.plane.visible) return;
    const d = this.data;
    const c = this.c;
    if (this.mode === 'resources') {
      for (let i = 0; i < g.N; i++) {
        const r = g.world.resource[i];
        if (r === RES.FERTILE) { d[i * 4] = 120; d[i * 4 + 1] = 190; d[i * 4 + 2] = 70; d[i * 4 + 3] = 200; }
        else if (r === RES.ORE) { d[i * 4] = 150; d[i * 4 + 1] = 110; d[i * 4 + 2] = 90; d[i * 4 + 3] = 220; }
        else if (RES.OIL !== undefined && r === RES.OIL) { d[i * 4] = 74; d[i * 4 + 1] = 74; d[i * 4 + 2] = 88; d[i * 4 + 3] = 220; }
        else if (g.world.forest && g.world.forest[i]) { d[i * 4] = 46; d[i * 4 + 1] = 107; d[i * 4 + 2] = 58; d[i * 4 + 3] = 190; }
        else d[i * 4 + 3] = 0;
      }
    } else {
      let key = '', arr;
      if (typeof def.field === 'function') arr = def.field(g);
      else { const parts = def.field.split(':'); key = parts[1]; arr = g[parts[0]][key]; }
      const sc = def.scale || 1;
      for (let i = 0; i < g.N; i++) {
        const t = g.world.terrain[i];
        if (t === T.WATER || t === T.ROCK) { d[i * 4 + 3] = 0; continue; }
        let v = arr[i] / sc;
        if (key === 'edu') v = v / 1;
        ramp(v, def.bad, c);
        d[i * 4] = c.r * 255; d[i * 4 + 1] = c.g * 255; d[i * 4 + 2] = c.b * 255;
        d[i * 4 + 3] = def.bad ? Math.min(230, 40 + v * 255) : 190;
      }
    }
    this.tex.needsUpdate = true;
  }

  // ---------- Vorschau
  showTiles(list) {
    // list: [{i, color}]
    const g = this.g;
    let n = 0;
    for (const t of list) {
      if (n >= 4096) break;
      const x = t.i % g.W, y = (t.i / g.W) | 0;
      const water = g.world.terrain[t.i] === T.WATER;
      this.m4.makeTranslation(x + 0.5 - g.W / 2, water ? 0.22 : 0, y + 0.5 - g.H / 2);
      this.preview.setMatrixAt(n, this.m4);
      this.c.setHex(t.color);
      this.preview.setColorAt(n, this.c);
      n++;
    }
    this.preview.count = n;
    this.preview.instanceMatrix.needsUpdate = true;
    if (this.preview.instanceColor) this.preview.instanceColor.needsUpdate = true;
  }
  clearTiles() { this.preview.count = 0; }

  showGhost(x, y, w, h, ok, height = 0.6) {
    const g = this.g;
    this.ghost.visible = true;
    this.ghost.position.set(x + w / 2 - g.W / 2, 0.01, y + h / 2 - g.H / 2);
    this.ghost.scale.set(w * 0.96, height, h * 0.96);
    this.ghost.material.color.setHex(ok ? 0x8fe39f : 0xf08070);
  }
  hideGhost() { this.ghost.visible = false; }

  showRadius(cx, cz, r, color = 0xffffff) {
    this.ring.visible = this.disc.visible = true;
    this.ring.position.x = this.disc.position.x = cx;
    this.ring.position.z = this.disc.position.z = cz;
    this.ring.scale.set(r, r, 1);
    this.disc.scale.set(r, r, 1);
    this.ring.material.color.setHex(color);
    this.disc.material.color.setHex(color);
  }
  hideRadius() { this.ring.visible = this.disc.visible = false; }

  select(b) {
    if (!b) { this.sel.visible = false; return; }
    const g = this.g;
    this.sel.visible = true;
    this.sel.position.set(b.x + b.w / 2 - g.W / 2, 0, b.y + b.h / 2 - g.H / 2);
    const h = b.station ? TRANSIT.trackHeight + 0.6 : b.height || 1;
    this.sel.scale.set(b.w + 0.04, h, b.h + 0.04);
  }

  showLinePreview(points, color) {
    if (!points || points.length < 2) { this.linePrev.visible = false; return; }
    const arr = this.lineGeo.attributes.position.array;
    const n = Math.min(points.length, 64);
    for (let i = 0; i < n; i++) { arr[i * 3] = points[i][0]; arr[i * 3 + 1] = TRANSIT.trackHeight; arr[i * 3 + 2] = points[i][1]; }
    this.lineGeo.setDrawRange(0, n);
    this.lineGeo.attributes.position.needsUpdate = true;
    this.lineGeo.computeBoundingSphere();
    this.linePrev.material.color.setHex(color);
    this.linePrev.visible = true;
  }
}
