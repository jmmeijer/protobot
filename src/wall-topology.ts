import type { Tile } from './game.ts';

/** A single 3 × 2 atlas; all parts can be quarter-turned in Canvas. */
export type WallPiece =
  | 'straight' | 'inner_corner' | 'outer_corner'
  | 'end_cap' | 'doorway' | 'damaged_opening';

export type QuarterTurn = 0 | 1 | 2 | 3;

export interface WallSprite {
  piece: WallPiece;
  /** Clockwise quarter-turns from the source sprite's native orientation. */
  rotation: QuarterTurn;
}

export const WALL_ATLAS_CELLS: Readonly<Record<WallPiece, readonly [number,number]>> = {
  straight: [0,0],
  inner_corner: [1,0],
  outer_corner: [2,0],
  end_cap: [0,1],
  doorway: [1,1],
  damaged_opening: [2,1]
};

/**
 * Select structure purely from the *logical* four-neighbour wall topology.
 * This never changes collision or the 47-mask floor autotiling.
 *
 * The native straight sprite runs left-right with its visible face below.
 * The native L corner is connected to the west and south.
 */
export function wallSpriteForTile(
  tiles: readonly (readonly Tile[])[], x:number, y:number
): WallSprite | null {
  if (tiles[y]?.[x] !== 'wall') return null;
  const wall = (dx:number,dy:number) => tiles[y+dy]?.[x+dx] === 'wall';
  const floor = (dx:number,dy:number) => {
    const tile = tiles[y+dy]?.[x+dx];
    return tile !== undefined && tile !== 'wall';
  };
  const n=wall(0,-1),e=wall(1,0),s=wall(0,1),w=wall(-1,0);
  const count=Number(n)+Number(e)+Number(s)+Number(w);

  // Completely buried blocks need material texture only, not visible joints.
  if (count===4) return null;

  if (count===2) {
    if (w && e) {
      return {piece:'straight', rotation:floor(0,-1) && !floor(0,1) ? 2 : 0};
    }
    if (n && s) {
      return {piece:'straight', rotation:floor(1,0) && !floor(-1,0) ? 3 : 1};
    }

    const corner =
      w && s ? {rotation:0 as QuarterTurn,diagonal:[-1,1] as const} :
      n && w ? {rotation:1 as QuarterTurn,diagonal:[-1,-1] as const} :
      n && e ? {rotation:2 as QuarterTurn,diagonal:[1,-1] as const} :
      {rotation:3 as QuarterTurn,diagonal:[1,1] as const};
    // A floor in the elbow distinguishes a re-entrant (inside) from
    // an exterior (solid) corner; both share the same rotation system.
    return {piece: floor(...corner.diagonal) ? 'inner_corner' : 'outer_corner',
      rotation:corner.rotation};
  }
  if (count===1 || count===0) {
    return {piece:'end_cap',rotation:
      n ? 3 : e ? 0 : s ? 1 : w ? 2 : 0};
  }

  // T-junctions: render the exposed wall face; leave junction material intact.
  if (floor(0,1)) return {piece:'straight',rotation:0};
  if (floor(-1,0)) return {piece:'straight',rotation:1};
  if (floor(0,-1)) return {piece:'straight',rotation:2};
  if (floor(1,0)) return {piece:'straight',rotation:3};
  return null;
}
