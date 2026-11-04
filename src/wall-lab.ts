import './wall-lab.css';
import { levelById } from './game.ts';
import { createTerrainPainter, levelTerrain } from './terrain-canvas';
import { drawGoal, drawWall, drawWallStructure } from './level-canvas';
import {
  WALL_ATLAS_CELLS, wallSpriteForTile, type QuarterTurn, type WallPiece
} from './wall-topology.ts';

const structureUrl = new URL('./assets/wall-structure.webp', import.meta.url).href;
const materialsUrl = new URL('./assets/wall-materials.webp', import.meta.url).href;
const terrainUrl = new URL('./assets/terrain-atlas.webp', import.meta.url).href;
const robotUrl = new URL('./assets/protobot-topdown.webp', import.meta.url).href;

const parts: Array<{type:WallPiece,label:string}> = [
  {type:'straight',label:'Recht segment'},
  {type:'inner_corner',label:'Binnenhoek'},
  {type:'outer_corner',label:'Buitenhoek'},
  {type:'end_cap',label:'Eindstuk'},
  {type:'doorway',label:'Deur / doorgang'},
  {type:'damaged_opening',label:'Beschadigde opening'}
];
let cleanup: (()=>void) | undefined;

export function wallLabMarkup():string {
  return '<main class="content wall-lab screen-enter">' +
    '<div class="section-heading"><div><div class="eyebrow">PROTOBOT / GRAFISCH TESTLAB</div>' +
    '<h1>Muurlab<span class="accent">.</span></h1>' +
    '<p>Controleer de zes muurdelen, rotaties en aansluiting in de lange gang. De doorgang links is speltechnisch open.</p></div></div>' +
    '<section class="panel wall-lab-panel"><div class="panel-top"><span>SPRITE-ATLAS / 3 × 2</span><span>6 BASISDELEN</span></div>' +
    '<div class="wall-lab-turns" role="group" aria-label="Draai alle sprites">' +
    ([0,1,2,3] as const).map((turn)=>'<button type="button" class="btn secondary" data-wall-turn="'+turn+
      '" aria-pressed="'+(turn===0?'true':'false')+'">'+turn*90+'°</button>').join('') +
    '</div><div class="wall-lab-gallery">' +
    parts.map(part=>'<figure class="wall-lab-piece"><canvas width="168" height="168" data-wall-piece="'+
      part.type+'" aria-label="'+part.label+'"></canvas><figcaption>'+part.label+'</figcaption></figure>').join('')+
    '</div></section>' +
    '<section class="panel wall-lab-panel"><div class="panel-top"><span>LANGEGANG / ECHTE KAARTLOGICA</span><span>9 × 3</span></div>' +
    '<p class="wall-lab-description">Dezelfde muurselectie en rotaties als in de missie-renderer. Linksboven en linksonder staan eindstukken, rechts komen hoeken en langs de gang liggen rechte wanddelen.</p>' +
    '<div class="wall-lab-map-wrap"><canvas id="wall-lab-corridor" width="1152" height="384" role="img" aria-label="Voorbeeld van de lange gang met deuropening links"></canvas></div>' +
    '<p id="wall-lab-message" class="wall-lab-message" aria-live="polite">Sprites laden…</p>' +
    '</section><a class="btn secondary" href="#/levels">TERUG NAAR MISSIEOVERZICHT</a></main>';
}

function loadImage(src:string):Promise<HTMLImageElement|null> {
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>resolve(null);
    img.src=src;
  });
}
function checkerboard(ctx:CanvasRenderingContext2D,size:number) {
  for(let y=0;y<4;y++)for(let x=0;x<4;x++){
    ctx.fillStyle=(x+y)%2 ? '#20373c' : '#2c4548';
    ctx.fillRect(x*size/4,y*size/4,size/4,size/4);
  }
}

export function unmountWallLab() {
  cleanup?.();
  cleanup=undefined;
}

export function mountWallLab(root:HTMLElement) {
  unmountWallLab();
  const gallery=[...root.querySelectorAll<HTMLCanvasElement>('[data-wall-piece]')];
  const canvas=root.querySelector<HTMLCanvasElement>('#wall-lab-corridor');
  const status=root.querySelector<HTMLElement>('#wall-lab-message');
  if(!canvas||!gallery.length)return;
  let disposed=false;
  let turn:QuarterTurn=0;
  let art:HTMLImageElement|null=null;
  const drawGallery=()=>{
    for(const el of gallery){
      const ctx=el.getContext('2d');
      if(!ctx)continue;
      ctx.clearRect(0,0,168,168);
      checkerboard(ctx,168);
      const type=el.dataset.wallPiece as WallPiece;
      if(art&&type in WALL_ATLAS_CELLS)
        drawWallStructure(ctx,art,{piece:type,rotation:turn},0,0,168);
    }
  };
  const handleClick=(event:MouseEvent)=>{
    const target=event.target as HTMLElement;
    const button=target.closest<HTMLButtonElement>('[data-wall-turn]');
    if(!button)return;
    const n=Number(button.dataset.wallTurn);
    if(n!==0&&n!==1&&n!==2&&n!==3)return;
    turn=n as QuarterTurn;
    root.querySelectorAll<HTMLButtonElement>('[data-wall-turn]').forEach(b=>{
      b.setAttribute('aria-pressed',String(Number(b.dataset.wallTurn)===turn));
    });
    drawGallery();
  };
  root.addEventListener('click',handleClick);
  cleanup=()=>{disposed=true;root.removeEventListener('click',handleClick);};

  void Promise.all([
    loadImage(structureUrl),loadImage(materialsUrl),
    loadImage(terrainUrl),loadImage(robotUrl)
  ]).then(([structure,material,terrain,robot])=>{
    if(disposed)return;
    art=structure;
    drawGallery();
    const level=levelById('lange-gang');
    const ctx=canvas.getContext('2d');
    if(!ctx||!level)return;
    const size=128;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(terrain) createTerrainPainter().draw(ctx,terrain,levelTerrain(level.tiles),size);
    else {
      ctx.fillStyle='#516465';
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }
    for(let y=0;y<level.tiles.length;y++)for(let x=0;x<level.tiles[y].length;x++){
      if(level.tiles[y][x]!=='wall')continue;
      drawWall(ctx,level,x,y,size,material);
      const part=wallSpriteForTile(level.tiles,x,y);
      if(part)drawWallStructure(ctx,structure,part,x,y,size);
    }
    for(const feature of level.wallFeatures??[]){
      drawWallStructure(ctx,structure,{piece:feature.type,rotation:feature.rotation},
        feature.x,feature.y,size);
    }
    drawGoal(ctx,level,size);
    if(robot)ctx.drawImage(robot,(level.start.x+.1)*size,(level.start.y+.1)*size,size*.8,size*.8);
    if(status)status.textContent=structure
      ? 'Zes sprites geladen. Let vooral op hoeken, naden en het deurkader aan de linkerkant.'
      : 'De muur-atlas kon niet worden geladen; controleer het asset-pad.';
  });
}
