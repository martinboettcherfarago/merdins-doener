// Wohngebäude (Zone Wohnen). Besitzer: Architektur-Agent „Wohnen".
// Diese Startfassung zeigt den Umgang mit dem Baukasten; sie wird vom Agenten ersetzt und stark erweitert.
import { registerArch } from './index.js';
import { pick, range } from './kit.js';

const WALLS = ['plaster_white', 'plaster_cream', 'plaster_ochre', 'plaster_pink', 'plaster_blue', 'brick_red', 'brick_yellow'];
const ROOFS = ['roof_tiles_red', 'roof_tiles_brown', 'roof_tiles_anthracite', 'roof_slate'];

registerArch('res', {
  variants: 6,
  build(ctx) {
    const { kit, rng, level, fw, fd, M, FLOOR } = ctx;
    const W = fw * 10 * M, D = fd * 10 * M; // Grundstück in Welteinheiten
    if (level <= 2) {
      // Einfamilienhaus mit Satteldach, Garten und Zaun
      const wall = pick(rng, WALLS), roof = pick(rng, ROOFS);
      const floors = level === 1 ? 1 + (rng() < 0.4 ? 1 : 0) : 2;
      const bw = Math.min(W - 2 * M, range(rng, 7, 9) * M * (fw > 1 ? 1.6 : 1)), bd = Math.min(D - 3 * M, range(rng, 6.5, 8) * M);
      const z0 = -0.5 * M;
      const h = floors * FLOOR;
      kit.box(wall, 0, 0, z0, bw, h, bd);
      kit.box('stone_grey', 0, 0, z0, bw + 0.1 * M, 0.5 * M, bd + 0.1 * M);
      kit.windows('front', 0, z0, bw, bd, 0, floors, FLOOR, { sill: true, shutters: rng() < 0.3 ? 'paint_green' : null });
      kit.windows('back', 0, z0, bw, bd, 0, floors, FLOOR, {});
      kit.windows('left', 0, z0, bw, bd, 0, floors, FLOOR, { spacing: 3.2 * M });
      kit.windows('right', 0, z0, bw, bd, 0, floors, FLOOR, { spacing: 3.2 * M });
      kit.door(0, z0, bd, { offset: bw * 0.22, canopy: 'roof_metal_grey' });
      const rh = range(rng, 2.4, 3.4) * M;
      kit.gableRoof(roof, 0, h, z0, bw, bd, rh, { ridge: 'x', overhang: 0.5 * M });
      kit.gableEnds(wall, 0, h, z0, bw, bd, rh, { ridge: 'x' });
      kit.chimney(bw * 0.25, h + rh * 0.4, z0 - bd * 0.15, rh * 0.8);
      // Garten
      kit.box('grass', 0, 0, 0, W - 0.4 * M, 0.06 * M, D - 0.4 * M);
      kit.box('pavers', bw * 0.22, 0, z0 + bd / 2 + (D / 2 - z0 - bd / 2) / 2, 1.2 * M, 0.08 * M, D / 2 - z0 - bd / 2);
      kit.fence(0, D / 2 - 0.3 * M, W - 1 * M, 0, 'wood_planks', 0.8 * M);
      if (rng() < 0.8) kit.tree(-W * 0.3, -D * 0.35, range(rng, 0.8, 1.2));
      if (rng() < 0.5) kit.hedge(W * 0.38, 0, 0.8 * M, D * 0.5);
      return kit.build();
    }
    // Stufe 3–5: Mehrfamilienhaus / Wohnblock / Wohnturm (einfache Startfassung)
    const floors = level === 3 ? 4 : level === 4 ? 7 : 16 + Math.floor(rng() * 8);
    const wall = pick(rng, ['plaster_white', 'plaster_cream', 'concrete_panel', 'brick_red', 'brick_white']);
    const bw = W - 1.5 * M, bd = Math.min(D - 1.5 * M, level === 5 ? 18 * M : 11 * M);
    const h = floors * FLOOR;
    kit.box(wall, 0, 0, 0, bw, h, bd);
    kit.box('concrete_dark', 0, 0, 0, bw + 0.1 * M, 0.6 * M, bd + 0.1 * M);
    for (const side of ['front', 'back', 'left', 'right']) kit.windows(side, 0, 0, bw, bd, 0, floors, FLOOR, { spacing: 2.8 * M, frame: 'window_frame_dark' });
    if (level >= 4) kit.balconies('front', 0, 0, bw, bd, 0, floors, FLOOR, {});
    kit.door(0, 0, bd, { canopy: 'concrete' });
    kit.flatRoof('roof_flat_gravel', 'concrete', 0, h, 0, bw, bd, {});
    kit.rooftopClutter(0, h, 0, bw, bd, 2 + Math.floor(rng() * 3));
    return kit.build();
  },
});
