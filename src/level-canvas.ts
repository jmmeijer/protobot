import './level-canvas.css';
import { initialState, levelById, type Direction, type Level, type RunState } from './game';
import { createTerrainPainter, levelTerrain } from './terrain-canvas';
import type { TerrainMap, TerrainName } from './terrain-model';

const ATLAS_URL = new URL('./assets/terrain-atlas.webp', import.meta.url).href;
const ROBOT_URL = new URL('./assets/protobot-topdown.webp', import.meta.url).href;
type Assets = { atlas: HTMLImageElement | null; robot: HTMLImageElement | null };
let assetsPromise: Promise<Assets> | undefined;
let cleanup: (() => void) | undefined;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}
function loadAssets(): Promise<Assets> {
  return assetsPromise ??= Promise.all([
    loadImage(ATLAS_URL), loadImage(ROBOT_URL)
  ]).then(([atlas, robot]) => ({ atlas, robot }));
}

const fallbackColors: Record<TerrainName, string> = {
  grass: '#5e8c36', stone: '#77797b', dirt: '#945d3b',
  sand: '#d8ae65', water: '#207db7', lava: '#df5828'
};

function fallbackTerrain(context: CanvasRenderingContext2D, map: TerrainMap, size: number) {
  for (let y = 0; y < map.length; y++) for (let x = 0; x < map[y].length; x++) {
    context.fillStyle = fallbackColors[map[y][x]];
    context.fillRect(x * size, y * size, size, size);
  }
}
function drawWall(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const pad = size * 0.11;
  context.fillStyle = '#171f24b8';
  context.fillRect(x * size + pad * 1.3, y * size + pad * 1.6, size - 2 * pad, size - 2 * pad);
  context.fillStyle = '#404c52';
  context.fillRect(x * size + pad, y * size + pad, size - 2 * pad, size - 2 * pad);
  context.fillStyle = '#6c787c';
  context.fillRect(x * size + pad, y * size + pad, size - 2 * pad, pad * 0.35);
  context.fillStyle = '#20282e';
  context.fillRect(x * size + pad, y * size + size - pad * 1.5, size - 2 * pad, pad * 0.5);
  context.strokeStyle = '#1c282d';
  context.lineWidth = Math.max(1, size * 0.035);
  context.beginPath();
  context.moveTo(x * size + size * .32, y * size + size * .26);
  context.lineTo(x * size + size * .58, y * size + size * .53);
  context.lineTo(x * size + size * .72, y * size + size * .44);
  context.stroke();
}
function drawGoal(context: CanvasRenderingContext2D, level: Level, size: number) {
  const cx = (level.goal.x + .5) * size;
  const cy = (level.goal.y + .5) * size;
  context.save();
  context.fillStyle = '#0b493db8';
  context.fillRect(cx - size * .32, cy - size * .32, size * .64, size * .64);
  context.strokeStyle = '#89ffe0';
  context.lineWidth = Math.max(1.5, size * .035);
  context.strokeRect(cx - size * .32, cy - size * .32, size * .64, size * .64);
  context.beginPath();
  context.moveTo(cx - size * .17, cy);
  context.lineTo(cx - size * .035, cy + size * .13);
  context.lineTo(cx + size * .20, cy - size * .16);
  context.stroke();
  context.restore();
}
const rotation: Record<Direction, number> = { N: 0, E: Math.PI / 2, S: Math.PI, W: Math.PI * 1.5 };

function drawRobot(context: CanvasRenderingContext2D, run: RunState,
  size: number, image: HTMLImageElement | null) {
  context.save();
  context.translate((run.x + .5) * size, (run.y + .5) * size);
  context.rotate(rotation[run.direction]);
  const side = size * .84;
  if (image) {
    context.drawImage(image, -side / 2, -side / 2, side, side);
  } else {
    context.fillStyle = '#e1af53';
    context.fillRect(-size * .24, -size * .30, size * .48, size * .6);
    context.fillStyle = '#52e7d9';
    context.fillRect(-size * .15, -size * .22, size * .30, size * .08);
  }
  context.restore();
}

function sizeFor(canvas: HTMLCanvasElement, level: Level): number {
  const holder = canvas.parentElement;
  if (!holder) return 0;
  const css = getComputedStyle(holder);
  const horizontalPadding = parseFloat(css.paddingLeft) + parseFloat(css.paddingRight);
  const available = Math.max(0, holder.clientWidth - horizontalPadding);
  const maximum = holder.classList.contains('field-preview') ? 275
    : !!canvas.closest('.blockly-editor-map, .editor-map') ? 350
    : !!canvas.closest('.game-panel') ? 510 : 530;
  // A mission card has a fixed-height preview. Fit both axes without cropping.
  const previewPanel = holder.closest<HTMLElement>('.mission-visual');
  if (previewPanel) {
    const verticalPadding = parseFloat(css.paddingTop) + parseFloat(css.paddingBottom);
    const maxFromHeight = Math.max(0,
      (previewPanel.clientHeight - verticalPadding - 4) * level.tiles[0].length / level.tiles.length);
    return Math.floor(Math.min(available, maximum, maxFromHeight));
  }
  // Never upscale beyond the panel or demand a minimum that overflows mobile.
  return Math.floor(Math.min(available, maximum));
}

/**
 * Mount all mission previews and playing-field canvases.
 * ResizeObserver and image-load callbacks are disposed before each screen redraw.
 */
export function mountLevelCanvases(
  root: HTMLElement, currentRun: (level: Level) => RunState | undefined
): void {
  unmountLevelCanvases();
  const elements = [...root.querySelectorAll<HTMLCanvasElement>('canvas[data-level-board]')];
  if (!elements.length) return;
  const instances: Array<() => void> = [];
  for (const canvas of elements) {
    const level = levelById(canvas.dataset.levelId ?? '');
    if (!level) continue;
    const context = canvas.getContext('2d');
    if (!context) continue;
    const painter = createTerrainPainter();
    const terrainMap = levelTerrain(level.tiles);
    let active = true;
    let loaded: Assets | null = null;
    const draw = () => {
      if (!active || !canvas.isConnected) return;
      const width = sizeFor(canvas, level);
      if (width <= 0) return;
      const cols = level.tiles[0].length;
      const rows = level.tiles.length;
      const size = width / cols;
      const height = rows * size;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const deviceWidth = Math.max(1, Math.round(width * dpr));
      const deviceHeight = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== deviceWidth || canvas.height !== deviceHeight) {
        canvas.width = deviceWidth;
        canvas.height = deviceHeight;
      }
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.imageSmoothingEnabled = false;
      context.clearRect(0, 0, width, height);

      if (loaded?.atlas) painter.draw(context, loaded.atlas, terrainMap, size);
      else fallbackTerrain(context, terrainMap, size);

      // Logical walls remain impassable even though their base texture is stone.
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        if (level.tiles[y][x] === 'wall') drawWall(context, x, y, size);
      }
      drawGoal(context, level, size);
      drawRobot(context, currentRun(level) ?? initialState(level), size, loaded?.robot ?? null);
    };
    const observer = new ResizeObserver(draw);
    if (canvas.parentElement) observer.observe(canvas.parentElement);
    draw();
    void loadAssets().then(assets => {
      if (!active) return;
      loaded = assets;
      draw();
    });
    instances.push(() => { active = false; observer.disconnect(); });
  }
  cleanup = () => { for (const dispose of instances) dispose(); };
}

export function unmountLevelCanvases(): void {
  cleanup?.();
  cleanup = undefined;
}
