import './level-canvas.css';
import { initialState, levelById, type Level, type RunState } from './game';
import { createTerrainPainter, levelTerrain } from './terrain-canvas';
import type { TerrainMap, TerrainName } from './terrain-model';
import { poseAt, restingPose, type RobotPose } from './robot-motion';

const ATLAS_URL = new URL('./assets/terrain-atlas.webp', import.meta.url).href;
const ROBOT_URL = new URL('./assets/protobot-topdown.webp', import.meta.url).href;
type Assets = { atlas: HTMLImageElement | null; robot: HTMLImageElement | null };
let assetsPromise: Promise<Assets> | undefined;
let cleanup: (() => void) | undefined;

interface BoardController {
  animate(from: RunState, to: RunState, duration: number): Promise<void>;
  pause(): void;
  resume(): void;
  snap(run: RunState): void;
  dispose(): void;
}
const boards = new Map<string, BoardController>();

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
/** Draw only the animated layer; terrain and goal are cached separately. */
function drawRobot(context: CanvasRenderingContext2D, pose: RobotPose,
  size: number, image: HTMLImageElement | null) {
  context.save();
  context.translate((pose.x + .5) * size, (pose.y + .5) * size);
  context.fillStyle = 'rgba(3,15,19,.35)';
  context.beginPath();
  context.ellipse(0, size * .28, size * .28, size * .11, 0, 0, Math.PI * 2);
  context.fill();
  if (pose.pulse > 0.001) {
    context.strokeStyle = 'rgba(118,255,233,' + (pose.pulse * .75) + ')';
    context.lineWidth = Math.max(1.5, size * .025);
    context.beginPath();
    context.arc(0, 0, size * (.30 + pose.pulse * .22), 0, Math.PI * 2);
    context.stroke();
  }
  context.rotate(pose.angle);
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
 * A persistent Canvas is mounted once per screen. Terrain, walls and target
 * are cached in a backing canvas and only the robot layer changes per frame.
 * The screen is never replaced while a Blockly instruction is executed.
 */
export function mountLevelCanvases(
  root: HTMLElement, currentRun: (level: Level) => RunState | undefined
): void {
  unmountLevelCanvases();
  const elements = [...root.querySelectorAll<HTMLCanvasElement>('canvas[data-level-board]')];
  if (!elements.length) return;
  const instances: BoardController[] = [];

  for (const canvas of elements) {
    const level = levelById(canvas.dataset.levelId ?? '');
    if (!level) continue;
    const context = canvas.getContext('2d');
    if (!context) continue;
    const painter = createTerrainPainter();
    const terrainMap = levelTerrain(level.tiles);
    const background = document.createElement('canvas');
    const backgroundContext = background.getContext('2d');
    if (!backgroundContext) continue;
    let active = true;
    let loaded: Assets | null = null;
    let pose = restingPose(currentRun(level) ?? initialState(level));
    let tileSize = 0;
    let dpr = 1;

    interface MovingFrame {
      from: RunState;
      to: RunState;
      duration: number;
      elapsed: number;
      lastTime: number | null;
      frameId: number | null;
      paused: boolean;
      resolve: () => void;
    }
    let moving: MovingFrame | null = null;

    const paint = () => {
      if (!active || !canvas.isConnected || !tileSize) return;
      // Restore cached static map; do not regenerate its 47 autotile masks.
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.imageSmoothingEnabled = false;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(background, 0, 0);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.imageSmoothingEnabled = false;
      drawRobot(context, pose, tileSize, loaded?.robot ?? null);
    };

    const rebuildBackground = () => {
      if (!active || !canvas.isConnected) return;
      const width = sizeFor(canvas, level);
      if (width <= 0) return;
      const cols = level.tiles[0].length;
      const rows = level.tiles.length;
      tileSize = width / cols;
      const height = rows * tileSize;
      dpr = Math.min(window.devicePixelRatio || 1, 3);
      const pixelWidth = Math.max(1, Math.round(width * dpr));
      const pixelHeight = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      background.width = pixelWidth;
      background.height = pixelHeight;
      backgroundContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      backgroundContext.imageSmoothingEnabled = false;
      backgroundContext.clearRect(0, 0, width, height);
      if (loaded?.atlas) painter.draw(backgroundContext, loaded.atlas, terrainMap, tileSize);
      else fallbackTerrain(backgroundContext, terrainMap, tileSize);
      // These objects are static during a run. Robot movement cannot change them.
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        if (level.tiles[y][x] === 'wall') drawWall(backgroundContext, x, y, tileSize);
      }
      drawGoal(backgroundContext, level, tileSize);
      paint();
    };

    const frameTick = (time: number) => {
      const frame = moving;
      if (!frame || frame.paused || !active) return;
      if (frame.lastTime !== null) {
        frame.elapsed += Math.max(0, Math.min(80, time - frame.lastTime));
      }
      frame.lastTime = time;
      const fraction = Math.min(1, frame.elapsed / frame.duration);
      pose = poseAt(frame.from, frame.to, fraction);
      paint();
      if (fraction >= 1) {
        moving = null;
        pose = restingPose(frame.to);
        paint();
        frame.resolve();
      } else {
        frame.frameId = requestAnimationFrame(frameTick);
      }
    };

    const cancel = () => {
      if (!moving) return;
      const frame = moving;
      moving = null;
      if (frame.frameId !== null) cancelAnimationFrame(frame.frameId);
      frame.resolve(); // settle awaiting controller; its generation token rejects stale results
    };

    const instance: BoardController = {
      animate(from, to, duration) {
        cancel();
        if (!active) return Promise.resolve();
        pose = restingPose(from);
        paint();
        if (duration <= 0) {
          pose = restingPose(to);
          paint();
          return Promise.resolve();
        }
        return new Promise(resolve => {
          moving = { from, to, duration, elapsed: 0, lastTime: null,
            frameId: requestAnimationFrame(frameTick), paused: false, resolve };
        });
      },
      pause() {
        if (!moving || moving.paused) return;
        moving.paused = true;
        if (moving.frameId !== null) cancelAnimationFrame(moving.frameId);
        moving.frameId = null;
        moving.lastTime = null;
        // Retain the exact fractional pose until the user resumes.
      },
      resume() {
        if (!moving || !moving.paused) return;
        moving.paused = false;
        moving.lastTime = null;
        moving.frameId = requestAnimationFrame(frameTick);
      },
      snap(run) {
        cancel();
        pose = restingPose(run);
        paint();
      },
      dispose() {
        active = false;
        cancel();
      }
    };
    boards.set(level.id, instance);
    instances.push(instance);
    const observer = new ResizeObserver(rebuildBackground);
    if (canvas.parentElement) observer.observe(canvas.parentElement);
    rebuildBackground();
    void loadAssets().then(assets => {
      if (!active) return;
      loaded = assets;
      rebuildBackground();
    });
    const originalDispose = instance.dispose.bind(instance);
    instance.dispose = () => { observer.disconnect(); originalDispose(); };
  }
  cleanup = () => { for (const instance of instances) instance.dispose(); boards.clear(); };
}

/** The animation Promise resolves at the end of the tween or on cancellation. */
export function animateLevelRun(levelId: string, from: RunState, to: RunState,
  duration: number): Promise<void> {
  return boards.get(levelId)?.animate(from, to, duration) ?? Promise.resolve();
}
export function pauseLevelAnimation(levelId: string): void { boards.get(levelId)?.pause(); }
export function resumeLevelAnimation(levelId: string): void { boards.get(levelId)?.resume(); }
export function snapLevelRun(levelId: string, run: RunState): void { boards.get(levelId)?.snap(run); }

export function unmountLevelCanvases(): void {
  cleanup?.();
  cleanup = undefined;
}
