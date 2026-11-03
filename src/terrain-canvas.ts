import { atlasCoordinates, type TerrainMap, type TerrainName } from './terrain-model.ts';
import { autotileLayers, makeAutotileMask, MASK_RESOLUTION } from './autotile.ts';
import type { Tile } from './game';

const ATLAS_TILE_PX = 128;

/** Walls are collision objects, rendered over a normal stone terrain tile. */
export function terrainForTile(tile: Tile): TerrainName {
  return tile === 'wall' ? 'stone' : tile;
}

export function levelTerrain(tiles: readonly (readonly Tile[])[]): TerrainMap {
  return tiles.map(row => row.map(terrainForTile));
}

/**
 * The level screens and the Map Lab use the SAME 8-neighbour/47-mask renderer.
 * Buffers are created once for each mounted canvas and reused on every redraw.
 */
export function createTerrainPainter() {
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = maskCanvas.height = MASK_RESOLUTION;
  const maskContext = maskCanvas.getContext('2d');
  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.width = overlayCanvas.height = ATLAS_TILE_PX;
  const overlayContext = overlayCanvas.getContext('2d');

  if (!maskContext || !overlayContext) throw new Error('Canvas 2D is niet beschikbaar.');
  const maskData = maskContext.createImageData(MASK_RESOLUTION, MASK_RESOLUTION);
  maskContext.imageSmoothingEnabled = false;
  overlayContext.imageSmoothingEnabled = false;

  const texture = (
    context: CanvasRenderingContext2D, atlas: HTMLImageElement,
    terrain: TerrainName, x: number, y: number, size: number
  ) => {
    const [col, row] = atlasCoordinates[terrain];
    context.drawImage(
      atlas, col * ATLAS_TILE_PX, row * ATLAS_TILE_PX,
      ATLAS_TILE_PX, ATLAS_TILE_PX, x, y, size, size
    );
  };

  return {
    draw(context: CanvasRenderingContext2D, atlas: HTMLImageElement,
      map: TerrainMap, tileSize: number, transitions = true): void {
      const rows = map.length;
      const cols = map[0]?.length ?? 0;
      context.imageSmoothingEnabled = false;

      // Base terrain: every logical tile has exactly one underlying texture.
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        texture(context, atlas, map[y][x], x * tileSize, y * tileSize, tileSize);
      }
      if (!transitions) return;

      // Higher-priority neighbours extend into lower-priority cells only.
      // Identical edge rules and corner masks are used on every game screen.
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const layers = autotileLayers(map, x, y);
        for (const layer of layers) {
          const pixels = makeAutotileMask(layer.mask, x, y, layer.terrain);
          for (let i = 0; i < pixels.length; i++) {
            const at = i * 4;
            maskData.data[at] = 255;
            maskData.data[at + 1] = 255;
            maskData.data[at + 2] = 255;
            maskData.data[at + 3] = pixels[i] ? 255 : 0;
          }
          maskContext.putImageData(maskData, 0, 0);
          overlayContext.clearRect(0, 0, ATLAS_TILE_PX, ATLAS_TILE_PX);
          texture(overlayContext, atlas, layer.terrain, 0, 0, ATLAS_TILE_PX);
          overlayContext.globalCompositeOperation = 'destination-in';
          overlayContext.drawImage(maskCanvas, 0, 0, ATLAS_TILE_PX, ATLAS_TILE_PX);
          overlayContext.globalCompositeOperation = 'source-over';
          context.drawImage(
            overlayCanvas, x * tileSize, y * tileSize, tileSize, tileSize
          );
        }
      }
    }
  };
}
