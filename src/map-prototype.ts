import './map-prototype.css';
import {
  cloneMap, demos, labels, terrainNames,
  type TerrainMap, type TerrainName
} from './terrain-model';
import { createTerrainPainter } from './terrain-canvas';

const MAX_CANVAS_WIDTH = 740;
const ATLAS_URL = new URL('./assets/terrain-atlas.webp', import.meta.url).href;
const ROBOT_URL = new URL('./assets/protobot-topdown.webp', import.meta.url).href;
let map: TerrainMap = cloneMap(demos.oever);
let activeDemo = 'oever';
let brush: TerrainName = 'grass';
let gridVisible = true;
let transitionsVisible = true;
let robotDirection = 0;
let dispose: (() => void) | undefined;

export function mapPrototypeMarkup(): string {
  return `<main id="map-prototype-screen" class="content map-prototype screen-enter">
    <nav class="breadcrumb" aria-label="Navigatie"><a href="#/levels">MISSIES</a><span>/</span><b>KAARTLAB</b></nav>
    <div class="section-heading"><div>
      <div class="eyebrow">PROTOBOT LAB / VISUELE PROEF</div>
      <h1>Kaartprototype<span class="accent">.</span></h1>
      <p>Test de terreinatlas, schilder overgangen en bekijk ProtoBot op verschillende schermgroottes.</p>
    </div></div>
    <div class="maplab-layout">
      <section class="panel maplab-display">
        <div class="panel-top"><span>TERREINRENDERER / CANVAS</span><span>7 × 6 TEGELS</span></div>
        <div class="maplab-canvas-frame"><canvas id="maplab-canvas" role="img" aria-label="Kaartvoorbeeld met gras, steen, aarde, zand, water en lava; selecteer een terrein en klik op een tegel om te tekenen."></canvas></div>
        <div class="maplab-status" id="maplab-status" role="status">Afbeeldingen laden…</div>
        <div class="maplab-legend"><span><i class="maplab-dot maplab-safe"></i> Veilig terrein</span>
        <span><i class="maplab-dot maplab-water"></i> Water: gevaar</span>
        <span><i class="maplab-dot maplab-lava"></i> Lava: gevaar</span></div>
      </section>
      <aside class="panel maplab-controls">
        <div class="panel-top"><span>KAARTWERKPLAATS</span><span>PROTOTYPE</span></div>
        <div class="maplab-side-body">
          <h2>Terrein schilderen</h2>
          <p>Kies een ondergrond en klik of tik daarna op de kaart. De overgangen veranderen automatisch.</p>
          <div class="maplab-brushes" role="group" aria-label="Terreintype kiezen">
            ${terrainNames.map(name => `<button type="button" class="maplab-brush${name === brush ? ' is-selected' : ''}" data-terrain="${name}" aria-pressed="${name === brush}" title="${labels[name]}"><span class="terrain-icon terrain-${name}"></span>${labels[name]}</button>`).join('')}
          </div>
          <h2>Kaartvoorbeeld</h2>
          <div class="maplab-presets">
            <button type="button" class="btn secondary" data-map-demo="oever">RIVIEROEVER</button>
            <button type="button" class="btn secondary" data-map-demo="lavagrot">LAVAGROT</button>
          </div>
          <label class="maplab-toggle"><input type="checkbox" id="maplab-transitions" ${transitionsVisible ? 'checked' : ''}> Automatische terreinovergangen</label>
          <label class="maplab-toggle"><input type="checkbox" id="maplab-grid" ${gridVisible ? 'checked' : ''}> Tegelraster tonen</label>
          <div class="maplab-robot"><span>ROBOTROTATIE</span>
            <button type="button" class="icon-btn" data-map-rotate="left" aria-label="Draai ProtoBot linksom" title="Draai linksom">↶</button>
            <button type="button" class="icon-btn" data-map-rotate="right" aria-label="Draai ProtoBot rechtsom" title="Draai rechtsom">↷</button>
          </div>
          <p class="maplab-note">Deze kaart is een grafisch experiment. Aanpassingen veranderen geen missies of opgeslagen programma’s.</p>
        </div>
      </aside>
    </div>
    <div class="maplab-explainer"><strong>Techniek:</strong> één WebP-atlas met zes basistegels, Canvas <code>drawImage()</code>, 8-buren-autotiling en schaling op basis van de beschikbare breedte en <code>devicePixelRatio</code>. Herbruikbare 47-blob-maskers bepalen randen én hoeken. Per grens tekent alleen het lagere terrein een overlay van zijn hogere buur, waardoor dubbele randen verdwijnen.</div>
  </main>`;
}

export function mountMapPrototype() {
  unmountMapPrototype();
  const root = document.querySelector<HTMLElement>('#map-prototype-screen');
  const canvas = document.querySelector<HTMLCanvasElement>('#maplab-canvas');
  const frame = document.querySelector<HTMLElement>('.maplab-canvas-frame');
  const status = document.querySelector<HTMLElement>('#maplab-status');
  if (!root || !canvas || !frame || !status) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) { status.textContent = 'Canvas wordt niet ondersteund in deze browser.'; return; }
  const atlas = new Image();
  const robot = new Image();
  const terrainPainter = createTerrainPainter();
  let canvasWidth = 0;
  let tileSize = 0;
  let isActive = true;
  let atlasReady = false;
  let robotReady = false;

  const draw = () => {
    if (!isActive || canvasWidth <= 0) return;
    const cols = map[0].length;
    const rows = map.length;
    tileSize = canvasWidth / cols;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(canvasWidth * dpr);
    canvas.height = Math.round(rows * tileSize * dpr);
    canvas.style.width = canvasWidth + 'px';
    canvas.style.height = rows * tileSize + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvasWidth, rows * tileSize);
    if (!atlasReady) {
      ctx.fillStyle = '#314b49'; ctx.fillRect(0, 0, canvasWidth, rows * tileSize);
      return;
    }
    terrainPainter.draw(ctx, atlas, map, tileSize, transitionsVisible);
    if (gridVisible) {
      ctx.strokeStyle = 'rgba(7, 25, 25, .43)';
      ctx.lineWidth = Math.max(0.7, 1 / dpr);
      ctx.beginPath();
      for (let col = 0; col <= cols; col++) {
        ctx.moveTo(col * tileSize, 0); ctx.lineTo(col * tileSize, rows * tileSize);
      }
      for (let row = 0; row <= rows; row++) {
        ctx.moveTo(0, row * tileSize); ctx.lineTo(canvasWidth, row * tileSize);
      }
      ctx.stroke();
    }
    // Fixed marker illustrates the final intended robot-to-tile ratio.
    const centerX = (2.5) * tileSize;
    const centerY = (1.5) * tileSize;
    ctx.save(); ctx.translate(centerX, centerY); ctx.rotate(robotDirection * Math.PI / 2);
    if (robotReady) {
      const size = tileSize * 0.95;
      ctx.drawImage(robot, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = '#eab65f'; ctx.fillRect(-tileSize * .25, -tileSize * .3, tileSize * .5, tileSize * .6);
    }
    ctx.restore();
  };
  const resize = () => {
    canvasWidth = Math.floor(Math.min(MAX_CANVAS_WIDTH, Math.max(210, frame.clientWidth - 32)));
    draw();
  };
  const setBrushState = () => {
    root.querySelectorAll<HTMLButtonElement>('[data-terrain]').forEach(btn => {
      const selected = btn.dataset.terrain === brush;
      btn.classList.toggle('is-selected', selected);
      btn.setAttribute('aria-pressed', String(selected));
    });
  };
  const onClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const brushButton = target.closest<HTMLButtonElement>('[data-terrain]');
    if (brushButton) { brush = brushButton.dataset.terrain as TerrainName; setBrushState(); return; }
    const demoButton = target.closest<HTMLButtonElement>('[data-map-demo]');
    if (demoButton && demoButton.dataset.mapDemo && demos[demoButton.dataset.mapDemo]) {
      activeDemo = demoButton.dataset.mapDemo; map = cloneMap(demos[activeDemo]); draw(); return;
    }
    const rotate = target.closest<HTMLButtonElement>('[data-map-rotate]');
    if (rotate) { robotDirection = (robotDirection + (rotate.dataset.mapRotate === 'left' ? 3 : 1)) % 4; draw(); return; }
    if (target.id === 'maplab-canvas' && tileSize > 0) {
      const bounds = canvas.getBoundingClientRect();
      const x = Math.floor((event.clientX - bounds.left) / tileSize);
      const y = Math.floor((event.clientY - bounds.top) / tileSize);
      if (x >= 0 && x < map[0].length && y >= 0 && y < map.length) {
        map[y][x] = brush; draw();
        status.textContent = `${labels[brush]} op tegel (${x}, ${y})`;
      }
    }
  };
  const onChange = (event: Event) => {
    const element = event.target as HTMLInputElement;
    if (element.id === 'maplab-transitions') transitionsVisible = element.checked;
    if (element.id === 'maplab-grid') gridVisible = element.checked;
    draw();
  };
  atlas.onload = () => { atlasReady = true; status.textContent = 'Kaart geladen. Kies een terrein om tegels te schilderen.'; draw(); };
  atlas.onerror = () => { status.textContent = 'De terreinatlas kon niet worden geladen.'; };
  robot.onload = () => { robotReady = true; draw(); };
  atlas.src = ATLAS_URL;
  robot.src = ROBOT_URL;
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  const observer = new ResizeObserver(resize);
  observer.observe(frame);
  resize();
  dispose = () => { isActive = false; observer.disconnect(); root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); };
}

export function unmountMapPrototype() { dispose?.(); dispose = undefined; }
