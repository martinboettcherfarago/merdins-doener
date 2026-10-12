// Straßen: Textur-Atlas aus Canvas (alle 16 Verbindungsmasken × 4 Straßentypen), Brücken, Laternen.
import * as THREE from 'three';
import { R, T } from '../config.js';
import { roadMask } from '../sim/network.js';
import { hash2 } from '../util.js';

const CELL = 128;

function drawAtlas() {
  const cv = document.createElement('canvas');
  cv.width = CELL * 16;
  cv.height = CELL * 4;
  const ctx = cv.getContext('2d');
  const styles = {
    1: { w: 0.42, asphalt: '#6b6f76', walk: '#d8d2c4', line: null, curb: '#bdb6a8' },
    2: { w: 0.58, asphalt: '#565c66', walk: '#d6d0c3', line: '#f4f1e8', curb: '#b6ae9f' },
    3: { w: 0.82, asphalt: '#50555e', walk: '#d2cdbf', line: '#f4f1e8', median: '#7fae62', curb: '#b2aa9a' },
    4: { w: 0.9, asphalt: '#4b5059', walk: '#9fa39a', line: '#f4f1e8', edge: '#f2c94c', curb: '#8d9189' },
  };
  for (let type = 1; type <= 4; type++) {
    const st = styles[type];
    for (let mask = 0; mask < 16; mask++) {
      const ox = mask * CELL, oy = (type - 1) * CELL;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.beginPath();
      ctx.rect(0, 0, CELL, CELL);
      ctx.clip();
      ctx.fillStyle = st.walk;
      ctx.fillRect(0, 0, CELL, CELL);
      // feine Pflasterfugen
      ctx.strokeStyle = 'rgba(0,0,0,0.05)';
      ctx.lineWidth = 1;
      for (let k = 8; k < CELL; k += 16) { ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k, CELL); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, k); ctx.lineTo(CELL, k); ctx.stroke(); }
      const rw = st.w * CELL;
      const a = (CELL - rw) / 2, b = a + rw;
      const conns = [mask & 1, mask & 2, mask & 4, mask & 8];
      const n = conns.filter(Boolean).length;
      const drawRoad = (fill, inset) => {
        ctx.fillStyle = fill;
        const a2 = a + inset, b2 = b - inset;
        ctx.fillRect(a2, a2, b2 - a2, b2 - a2);
        if (conns[0]) ctx.fillRect(a2, 0, b2 - a2, a2 + 1);
        if (conns[1]) ctx.fillRect(b2 - 1, a2, CELL - b2 + 1, b2 - a2);
        if (conns[2]) ctx.fillRect(a2, b2 - 1, b2 - a2, CELL - b2 + 1);
        if (conns[3]) ctx.fillRect(0, a2, a2 + 1, b2 - a2);
        if (n === 0) { ctx.beginPath(); ctx.arc(CELL / 2, CELL / 2, rw * 0.62 - inset, 0, Math.PI * 2); ctx.fill(); }
        if (n === 1) {
          // Wendehammer
          ctx.beginPath(); ctx.arc(CELL / 2, CELL / 2, rw * 0.6 - inset, 0, Math.PI * 2); ctx.fill();
        }
      };
      drawRoad(st.curb, -3);
      drawRoad(st.asphalt, 0);
      // leichte Textur im Asphalt
      for (let k = 0; k < 90; k++) {
        const px = (hash2(k, mask, type) * CELL) | 0, py = (hash2(mask, k, type + 9) * CELL) | 0;
        ctx.fillStyle = `rgba(255,255,255,${0.02 + hash2(k, k, mask) * 0.03})`;
        ctx.fillRect(px, py, 2, 2);
      }
      const mid = CELL / 2;
      if (type === 3) {
        // Mittelstreifen mit Grün
        ctx.fillStyle = st.median;
        const mw = CELL * 0.1;
        if (conns[0]) ctx.fillRect(mid - mw / 2, 0, mw, n > 2 ? a - 6 : mid);
        if (conns[2]) ctx.fillRect(mid - mw / 2, n > 2 ? b + 6 : mid, mw, CELL);
        if (conns[1]) ctx.fillRect(n > 2 ? b + 6 : mid, mid - mw / 2, CELL, mw);
        if (conns[3]) ctx.fillRect(0, mid - mw / 2, n > 2 ? a - 6 : mid, mw);
        if (n === 2 && ((conns[0] && conns[2]) || (conns[1] && conns[3]))) { /* gerade: durchgehend */ }
        else if (n === 2) { ctx.beginPath(); ctx.arc(mid, mid, mw / 2, 0, Math.PI * 2); ctx.fill(); }
      }
      if (st.line && type !== 3) {
        ctx.strokeStyle = st.line;
        ctx.lineWidth = type === 4 ? 2.5 : 2;
        ctx.setLineDash([9, 9]);
        ctx.lineDashOffset = 0;
        const straightNS = conns[0] && conns[2] && !conns[1] && !conns[3];
        const straightEW = conns[1] && conns[3] && !conns[0] && !conns[2];
        ctx.beginPath();
        if (straightNS) { ctx.moveTo(mid, 0); ctx.lineTo(mid, CELL); }
        else if (straightEW) { ctx.moveTo(0, mid); ctx.lineTo(CELL, mid); }
        else if (n === 2) {
          // Kurve
          const pts = [];
          if (conns[0]) pts.push([mid, 0]);
          if (conns[1]) pts.push([CELL, mid]);
          if (conns[2]) pts.push([mid, CELL]);
          if (conns[3]) pts.push([0, mid]);
          ctx.moveTo(pts[0][0], pts[0][1]);
          ctx.quadraticCurveTo(mid, mid, pts[1][0], pts[1][1]);
        } else {
          if (conns[0]) { ctx.moveTo(mid, 0); ctx.lineTo(mid, a - 4); }
          if (conns[2]) { ctx.moveTo(mid, b + 4); ctx.lineTo(mid, CELL); }
          if (conns[1]) { ctx.moveTo(b + 4, mid); ctx.lineTo(CELL, mid); }
          if (conns[3]) { ctx.moveTo(0, mid); ctx.lineTo(a - 4, mid); }
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (type === 4) {
        ctx.strokeStyle = st.edge;
        ctx.lineWidth = 2;
        if (conns[1] || conns[3]) { ctx.beginPath(); ctx.moveTo(0, a + 5); ctx.lineTo(CELL, a + 5); ctx.moveTo(0, b - 5); ctx.lineTo(CELL, b - 5); ctx.stroke(); }
        if (conns[0] || conns[2]) { ctx.beginPath(); ctx.moveTo(a + 5, 0); ctx.lineTo(a + 5, CELL); ctx.moveTo(b - 5, 0); ctx.lineTo(b - 5, CELL); ctx.stroke(); }
      }
      // Zebrastreifen an Kreuzungen
      if (n >= 3 && (type === 2 || type === 3)) {
        ctx.fillStyle = 'rgba(245,242,233,0.9)';
        const zs = 4, zl = 9;
        const drawZebra = (horizontal, pos) => {
          for (let k = a + 4; k < b - 4; k += zs * 2) {
            if (horizontal) ctx.fillRect(k, pos, zs, zl); else ctx.fillRect(pos, k, zl, zs);
          }
        };
        if (conns[0]) drawZebra(true, a - zl - 2);
        if (conns[2]) drawZebra(true, b + 2);
        if (conns[3]) drawZebra(false, a - zl - 2);
        if (conns[1]) drawZebra(false, b + 2);
      }
      ctx.restore();
    }
  }
  return cv;
}

export class RoadView {
  constructor(engine) {
    this.e = engine;
    this.g = engine.game;
    const tex = new THREE.CanvasTexture(drawAtlas());
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = engine.renderer.capabilities.getMaxAnisotropy();
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    this.tex = tex;
    this.mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.mesh = null;
    this.group = new THREE.Group();
    engine.scene.add(this.group);
    // Brückenteile und Laternen
    const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
    this.bridge = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ color: 0xb9b2a5, roughness: 0.85 }), 6000);
    this.bridge.castShadow = this.bridge.receiveShadow = true;
    this.bridge.frustumCulled = false;
    this.group.add(this.bridge);
    const pole = new THREE.CylinderGeometry(0.012, 0.016, 0.42, 4); pole.translate(0, 0.21, 0);
    this.poles = new THREE.InstancedMesh(pole, new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.6 }), 12000);
    this.poles.frustumCulled = false;
    this.group.add(this.poles);
    this.lampMat = new THREE.MeshStandardMaterial({ color: 0xfff1cc, emissive: 0xffd28a, emissiveIntensity: 0 });
    const head = new THREE.BoxGeometry(0.06, 0.025, 0.04); head.translate(0, 0.43, 0);
    this.heads = new THREE.InstancedMesh(head, this.lampMat, 12000);
    this.heads.frustumCulled = false;
    this.group.add(this.heads);
    this.lampPositions = [];
    this.rebuild();
  }

  rebuild() {
    const g = this.g, W = g.W, H = g.H;
    const ox = -W / 2, oz = -H / 2;
    const pos = [], uv = [], col = [], idx = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    let nb = 0, nl = 0;
    this.lampPositions = [];
    this.tileVert = new Int32Array(g.N).fill(-1);
    const addQuad = (x0, z0, x1, z1, y, type, mask, tileIndex) => {
      const v = pos.length / 3;
      if (tileIndex >= 0) this.tileVert[tileIndex] = v;
      pos.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1);
      const pad = 1.5 / (CELL * 16), padV = 1.5 / (CELL * 4);
      const u0 = mask / 16 + pad, u1 = (mask + 1) / 16 - pad;
      const v0 = 1 - (type - 1) / 4 - padV, v1 = 1 - type / 4 + padV;
      uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
      for (let k = 0; k < 4; k++) col.push(1, 1, 1);
      idx.push(v, v + 2, v + 1, v, v + 3, v + 2);
    };
    const putBox = (x, y, z, sx, sy, sz) => {
      if (nb >= 6000) return;
      p.set(x, y, z); s.set(sx, sy, sz); q.identity();
      m4.compose(p, q, s);
      this.bridge.setMatrixAt(nb++, m4);
    };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const r = g.road[i];
      if (!r) continue;
      const mask = roadMask(g, i);
      const water = g.world.terrain[i] === T.WATER;
      const yy = water ? 0.24 : 0.012;
      addQuad(x + ox, y + oz, x + 1 + ox, y + 1 + oz, yy, r, mask, i);
      if (water) {
        putBox(x + ox + 0.5, 0.1, y + oz + 0.5, 1, 0.13, 1);
        if ((x + y) % 2 === 0) putBox(x + ox + 0.5, -1.2, y + oz + 0.5, 0.16, 1.32, 0.16);
      }
      // Laternen
      if ((r === R.STREET || r === R.AVENUE || r === R.HIGHWAY) && nl < 12000 && hash2(x, y, 77) < 0.7) {
        const side = hash2(x, y, 78) < 0.5 ? 1 : -1;
        const horiz = (mask & 2) || (mask & 8);
        const off = r === R.HIGHWAY ? 0.48 : r === R.AVENUE ? 0.46 : 0.36;
        const lx = x + ox + 0.5 + (horiz ? 0 : side * off);
        const lz = y + oz + 0.5 + (horiz ? side * off : 0);
        p.set(lx, yy, lz); s.set(1, 1, 1); q.identity();
        m4.compose(p, q, s);
        this.poles.setMatrixAt(nl, m4);
        this.heads.setMatrixAt(nl, m4);
        nl++;
        this.lampPositions.push(lx, yy + 0.44, lz);
      }
    }
    // Autobahn läuft aus dem Diorama heraus (Viadukt in den Dunst)
    const hy = g.world.highwayY;
    for (let k = 1; k <= 10; k++) {
      const x = -k;
      addQuad(x + ox, hy + oz, x + 1 + ox, hy + 1 + oz, 0.012, R.HIGHWAY, 10, -1);
      putBox(x + ox + 0.5, -0.12, hy + oz + 0.5, 1, 0.13, 1.02);
      if (k % 2 === 0) putBox(x + ox + 0.5, -4, hy + oz + 0.5, 0.22, 3.9, 0.22);
    }
    this.bridge.count = nb;
    this.poles.count = this.heads.count = nl;
    this.bridge.instanceMatrix.needsUpdate = true;
    this.poles.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    if (this.mesh) { this.group.remove(this.mesh); this.mesh.geometry.dispose(); }
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);
  }

  // Farbe der Straßen für die Verkehrsansicht
  setTrafficTint(on) {
    const g = this.g;
    const col = this.mesh.geometry.attributes.color;
    const c = new THREE.Color();
    const green = new THREE.Color(0x45c46b), yellow = new THREE.Color(0xf2c230), red = new THREE.Color(0xe5483c);
    for (let i = 0; i < g.N; i++) {
      const v = this.tileVert[i];
      if (v < 0) continue;
      if (!on) c.setRGB(1, 1, 1);
      else {
        const k = g.congestion[i];
        if (k < 0.6) c.copy(green).lerp(yellow, k / 0.6);
        else c.copy(yellow).lerp(red, Math.min(1, (k - 0.6) / 0.6));
        c.lerp(new THREE.Color(1, 1, 1), 0.15);
      }
      for (let j = 0; j < 4; j++) col.setXYZ(v + j, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }

  setNight(n) {
    this.lampMat.emissiveIntensity = n * 2.2;
  }
}
