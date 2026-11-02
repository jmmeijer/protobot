/** Topological blob autotiling for the map lab.
 *
 * A cell keeps its base texture. Only a STRICTLY higher-priority adjacent terrain
 * may extend into it. Consequently a physical boundary is never painted twice.
 * Eight-neighbour masks distinguish edges, outside corners and inside corners;
 * diagonal connections are gated by their two cardinal neighbours (47 masks).
 */
import type { TerrainMap, TerrainName } from './terrain-model';

export const BLOB = {
  N: 1, NE: 2, E: 4, SE: 8, S: 16, SW: 32, W: 64, NW: 128
} as const;

/** Visual layering only: this does not change whether a tile is safe to enter. */
export const terrainPriority: Readonly<Record<TerrainName, number>> = {
  grass: 0, dirt: 1, sand: 2, stone: 3, water: 4, lava: 5
};

const positions = [
  [-1,-1,BLOB.NW], [0,-1,BLOB.N], [1,-1,BLOB.NE],
  [-1,0,BLOB.W], [1,0,BLOB.E],
  [-1,1,BLOB.SW], [0,1,BLOB.S], [1,1,BLOB.SE]
] as const;

/** Standard 8-way corner-gated blob normalization: 256 raw masks -> 47 shapes. */
export function normalizeBlobMask(raw: number): number {
  let mask = raw & (BLOB.N | BLOB.E | BLOB.S | BLOB.W);
  if ((raw & BLOB.NE) && (mask & BLOB.N) && (mask & BLOB.E)) mask |= BLOB.NE;
  if ((raw & BLOB.SE) && (mask & BLOB.S) && (mask & BLOB.E)) mask |= BLOB.SE;
  if ((raw & BLOB.SW) && (mask & BLOB.S) && (mask & BLOB.W)) mask |= BLOB.SW;
  if ((raw & BLOB.NW) && (mask & BLOB.N) && (mask & BLOB.W)) mask |= BLOB.NW;
  return mask;
}

export interface AutotileLayer { terrain: TerrainName; mask: number }

/** Return exactly those neighbouring terrains allowed to overlay this cell. */
export function autotileLayers(map: TerrainMap, x: number, y: number): AutotileLayer[] {
  const current = map[y]?.[x];
  if (!current) return [];
  const bits = new Map<TerrainName, number>();
  for (const [dx, dy, flag] of positions) {
    const neighbour = map[y + dy]?.[x + dx];
    if (!neighbour || terrainPriority[neighbour] <= terrainPriority[current]) continue;
    bits.set(neighbour, (bits.get(neighbour) ?? 0) | flag);
  }
  return [...bits].map(([terrain, raw]) => ({ terrain, mask: normalizeBlobMask(raw) }))
    .filter(layer => layer.mask !== 0)
    .sort((a,b) => terrainPriority[a.terrain] - terrainPriority[b.terrain]);
}

export const MASK_RESOLUTION = 32;

/** Deterministic pixel-block noise with no dependence on redraw order or time. */
function hash(x: number, y: number, salt: number): number {
  let v = Math.imul(x + salt * 13, 0x1f123bb5) ^ Math.imul(y + salt * 37, 0x5f356495);
  v = Math.imul(v ^ (v >>> 15), 0x27d4eb2d);
  return ((v ^ (v >>> 15)) >>> 0) / 4294967296;
}

/** A jagged but coherent thickness for a shared horizontal/vertical edge.
 * The global position is used so the profile stays stable during zoom and edits.
 */
function depth(globalAlong: number, edge: number, salt: number): number {
  // Blocky pixel-art variation, ~9-19% of one tile on the lower-priority side.
  return 3 + Math.floor(hash(Math.floor(globalAlong / 2), edge, salt) * 4);
}

/** Reusable 32×32 alpha mask for one 47-blob tile configuration.
 * Bits are 0/1 pixels; the caller clips a terrain atlas texture to the mask.
 * `x`/`y` are map coordinates to keep jagged transitions stable on repaint.
 */
export function makeAutotileMask(mask: number, x: number, y: number, terrain: TerrainName): Uint8Array {
  const size = MASK_RESOLUTION;
  const normalized = normalizeBlobMask(mask);
  const pixels = new Uint8Array(size * size);
  if (!normalized) return pixels;
  const salt = 2 + terrainPriority[terrain] * 17;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const gx = x * size + px;
      const gy = y * size + py;
      const north = Boolean((normalized & BLOB.N) && py < depth(gx, y, salt + 1));
      const south = Boolean((normalized & BLOB.S) && size - 1 - py < depth(gx, y + 1, salt + 1));
      const west = Boolean((normalized & BLOB.W) && px < depth(gy, x, salt + 2));
      const east = Boolean((normalized & BLOB.E) && size - 1 - px < depth(gy, x + 1, salt + 2));
      // Diagonals only extend a connected pair of cardinal strips into a
      // rounded/stair-stepped corner. A diagonal neighbour alone has no effect.
      const ne = Boolean((normalized & BLOB.NE) && (size - 1 - px) + py < 13);
      const se = Boolean((normalized & BLOB.SE) && (size - 1 - px) + (size - 1 - py) < 13);
      const sw = Boolean((normalized & BLOB.SW) && px + (size - 1 - py) < 13);
      const nw = Boolean((normalized & BLOB.NW) && px + py < 13);
      pixels[py * size + px] = north || south || west || east || ne || se || sw || nw ? 1 : 0;
    }
  }
  return pixels;
}
