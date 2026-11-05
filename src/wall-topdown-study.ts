import type { Tile } from './game.ts';

/** Extracted from the 4 × 2 top-down Work sheet, 256 px per cell. */
export const TOPDOWN_ATLAS = [
  {id:'radiator-wall', label:'Radiatorwand',x:0,y:0},
  {id:'service-wall',label:'Onderhoudspaneel',x:1,y:0},
  {id:'pipe-left',label:'Leidingen links',x:2,y:0},
  {id:'pipe-right',label:'Leidingen rechts',x:3,y:0},
  {id:'control-wall',label:'Regelpaneel',x:0,y:1},
  {id:'radiator-alt',label:'Andere radiator',x:1,y:1},
  {id:'locker',label:'Metalen kast',x:2,y:1},
  {id:'rubble',label:'Betonpuin',x:3,y:1}
] as const;

export type StudyDetail = 'radiator'|'control'|'vent';

/**
 * Geometry is deliberately independent from the art atlas. Each connector
 * reaches the exact midpoint of the corresponding tile edge: two adjacent
 * wall cells will therefore have perfectly shared endpoints after rotation.
 */
export function wallConnections(map:readonly (readonly Tile[])[],x:number,y:number) {
  if(map[y]?.[x]!=='wall') return null;
  return {
    north:map[y-1]?.[x]==='wall',
    east:map[y]?.[x+1]==='wall',
    south:map[y+1]?.[x]==='wall',
    west:map[y]?.[x-1]==='wall'
  };
}

/** Intentionally sparse wall attachments; no duplicate caps on every tile. */
export function sampleWallDetail(levelId:string,x:number,y:number):StudyDetail|null {
  if(levelId!=='lange-gang') return null;
  if(y===0 && x===3) return 'radiator';
  if(y===0 && x===6) return 'control';
  if(y===2 && x===4) return 'vent';
  return null;
}

/** Experimental continuous industrial wall spine; no seams at grid borders. */
export function drawJoinedWall(
  ctx:CanvasRenderingContext2D,map:readonly (readonly Tile[])[],
  x:number,y:number,size:number
) {
  const edges=wallConnections(map,x,y);
  if(!edges)return;
  const cx=(x+.5)*size,cy=(y+.5)*size;
  const offsets=[
    [edges.north,cx,y*size],
    [edges.east,(x+1)*size,cy],
    [edges.south,cx,(y+1)*size],
    [edges.west,x*size,cy]
  ] as const;
  ctx.save();
  ctx.lineCap='butt';
  ctx.lineJoin='miter';
  // Thick structural band and thin concrete top: both reach the same joint.
  for(const [colour,width] of [
    ['#2a5159',.51],['#68716f',.40],['#b7afa0',.27]
  ] as const){
    ctx.lineWidth=size*width;
    ctx.strokeStyle=colour;
    for(const [active,ex,ey] of offsets){
      if(!active)continue;
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.lineTo(ex,ey);
      ctx.stroke();
    }
    // Junction centre covers round-off artefacts, with the same thickness.
    ctx.beginPath();
    ctx.arc(cx,cy,size*width/2,0,Math.PI*2);
    ctx.fillStyle=colour;
    ctx.fill();
  }
  // Small metal anchor only at actual loose ends (no repeated pillars).
  const count=Object.values(edges).filter(Boolean).length;
  if(count<=1){
    ctx.fillStyle='#364e51';
    ctx.fillRect(cx-size*.16,cy-size*.16,size*.32,size*.32);
    ctx.strokeStyle='#ccac75';
    ctx.lineWidth=size*.025;
    ctx.strokeRect(cx-size*.16,cy-size*.16,size*.32,size*.32);
  }
  ctx.restore();
}

/** Crop only the mounted decoration, not an entire pre-ended wall plate. */
export function drawWallDetail(
  ctx:CanvasRenderingContext2D,atlas:HTMLImageElement,
  detail:StudyDetail,x:number,y:number,size:number
) {
  // Crop coordinates expressed in the standardized 256px source cell.
  const source:Record<StudyDetail,[number,number,number,number]> = {
    radiator:[40,130,174,78],      // row 0 col 0
    control:[256+81,63,105,70],    // row 0 col 1
    vent:[40,256+139,174,70]       // row 1 col 0
  };
  const [sx,sy,sw,sh]=source[detail];
  const destW=size*.72,destH=size*.30;
  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(atlas,sx,sy,sw,sh,
    (x+.5)*size-destW/2,(y+.5)*size-destH/2,destW,destH);
  ctx.restore();
}
