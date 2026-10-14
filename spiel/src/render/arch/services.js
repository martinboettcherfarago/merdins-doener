// Architektur: Dienste und Versorgung (Besitzer: G5). Kategorien power, water, garbage, services, education,
// parks, industry, safety. Die Bausteine liegen in svc_*.js; svc_parts.js enthält die gemeinsamen Bauteile.
// Für Schlüssel dieser Kategorien ohne eigenes Modell (z. B. später ergänzte Inhalte) gibt es unten einen
// allgemeinen Baustein mit Namensschild, damit nie ein Kistenmodell erscheint.
import { registerArch, ARCH } from './index.js';
import { BUILDINGS } from '../../config.js';
import * as P from './svc_parts.js';
import './svc_power.js';
import './svc_water.js';
import './svc_civic.js';
import './svc_edu.js';
import './svc_parks.js';
import './svc_logistics.js';
import './svc_safety.js';
import './svc_extra.js';

const { M, FLOOR } = P;
export const SVC_CATS = ['power', 'water', 'garbage', 'services', 'education', 'parks', 'industry', 'safety'];
const ACCENT = { power: 'paint_yellow', water: 'paint_blue', garbage: 'paint_green', services: 'paint_blue', education: 'paint_red', parks: 'paint_green', industry: 'paint_orange', safety: 'paint_orange' };
const WALL = { power: 'metal_panel_white', water: 'brick_red', garbage: 'metal_corrugated_green', services: 'plaster_white', education: 'plaster_ochre', industry: 'metal_corrugated', safety: 'metal_panel_white' };

// Schildtext aus dem Gebäudenamen (Umlaute umschreiben, nur bekannte Zeichen)
function signText(name, maxLen) {
  const t = name.toUpperCase().replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS').replace(/[^A-Z0-9 .-]/g, '');
  const w = t.split(' ').sort((a, b) => b.length - a.length)[0] || 'DIENST';
  return (t.length <= maxLen ? t : w).slice(0, maxLen);
}

function genericPark(ctx) {
  const k = ctx.kit, W = ctx.fw * 10 * M, D = ctx.fd * 10 * M;
  P.lot(k, W, D, 'grass', { curb: false });
  P.walk(k, 'gravel', [[0, D / 2], [0, 0], [W / 2 - 0.3 * M, -D / 4]], 1.4 * M);
  const n = Math.round(ctx.fw * ctx.fd * 3);
  for (let i = 0; i < n; i++) {
    const x = (k.rng() - 0.5) * (W - 2 * M), z = (k.rng() - 0.5) * (D - 2 * M);
    if (Math.abs(x) < 1.4 * M) continue;
    if (k.rng() < 0.3) P.conifer(k, x, z, 0.7); else P.tree(k, x, z, 0.75 + k.rng() * 0.3);
  }
  P.bench(k, 1.4 * M, 1 * M, -Math.PI / 2); P.bench(k, -1.4 * M, -1 * M, Math.PI / 2);
  P.lamp(k, 1.2 * M, D / 2 - 1.2 * M, 3.8 * M, { globe: true });
  return P.finish(k);
}

function genericService(ctx, def) {
  const k = ctx.kit, W = ctx.fw * 10 * M, D = ctx.fd * 10 * M, cat = def.cat;
  const accent = ACCENT[cat] || 'paint_blue', wall = WALL[cat] || 'plaster_white';
  P.lot(k, W, D, cat === 'industry' ? 'asphalt' : 'pavers');
  const bw = W - 2.4 * M, bd = Math.min(D - 4 * M, 12 * M), bz = -D / 2 + 1.0 * M + bd / 2;
  const floors = Math.min(4, 1 + Math.floor((ctx.fw + ctx.fd) / 2));
  const top = P.block(k, { x: 0, z: bz, w: bw, d: bd, floors, wall, win: { frame: 'window_frame_dark', spacing: 2.4 * M }, cornice: 'trim_dark', roof: 'flat', clutter: 2, skipGround: 'front' });
  if (P.D1(k)) k.band(accent, 0, bz, bw, bd, top - 0.9 * M, 0.5 * M, 0.04 * M);
  P.ribbon(k, 'front', 0, bz, bw, bd, 0.5 * M, 1.8 * M, { margin: 1.6 * M });
  P.door(k, 0, bz + bd / 2, 0, { glass: true, w: 1.8 * M, canopy: accent });
  const px = 0.15 * M, txt = signText(def.name || ctx.key, Math.max(4, Math.floor(bw / (px * 6.2))));
  P.signBox(k, txt, 0, Math.min(top - 1.4 * M, FLOOR * 1.7), bz + bd / 2, 0, { px, bg: accent });
  const fz = bz + bd / 2 + (D / 2 - bz - bd / 2) / 2;
  P.parking(k, W / 4 + 0.6 * M, fz, W / 2 - 1.6 * M, Math.min(5.2 * M, D / 2 - bz - bd / 2 - 0.4 * M), { rows: 1, fill: 0.5 });
  P.tree(k, -W / 2 + 1.6 * M, fz, 0.7); P.tree(k, -W / 4, fz, 0.6);
  P.lamp(k, -1.6 * M, D / 2 - 0.8 * M, 4 * M);
  return P.finish(k);
}

for (const [key, def] of Object.entries(BUILDINGS)) {
  if (!SVC_CATS.includes(def.cat) || ARCH[key]) continue;
  registerArch(key, { variants: 1, build: (ctx) => (def.cat === 'parks' ? genericPark(ctx) : genericService(ctx, def)) });
}
