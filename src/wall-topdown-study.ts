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
  const destW=size*.90,destH=size*.27;
  const centerY=y===0 ? (y+1)*size-size*.27 :
    y===2 ? y*size+size*.27 : (y+.5)*size;
  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(atlas,sx,sy,sw,sh,
    (x+.5)*size-destW/2,centerY-destH/2,destW,destH);
  ctx.restore();
}


/** An exposed wall face borders a non-wall tile INSIDE the map. */
export type WallFaceSide = 'N'|'E'|'S'|'W';
export interface WallFaceRun { side:WallFaceSide; x:number; y:number; length:number }

/** Group adjoining wall faces into long continuous runs rather than full tiles. */
export function exposedWallRuns(map:readonly (readonly Tile[])[]):WallFaceRun[] {
  const rows=map.length,cols=map[0]?.length??0;
  const hasFloor=(x:number,y:number)=>x>=0&&y>=0&&y<rows&&x<cols&&
    map[y]?.[x]!==undefined&&map[y][x]!=='wall';
  const runs:WallFaceRun[]=[];
  for(const side of ['S','N'] as const)for(let y=0;y<rows;y++){
    let start=-1;
    for(let x=0;x<=cols;x++){
      const active=x<cols&&map[y]?.[x]==='wall'&&
        hasFloor(x,y+(side==='S'?1:-1));
      if(active&&start<0)start=x;
      if(!active&&start>=0){
        runs.push({side,x:start,y,length:x-start});
        start=-1;
      }
    }
  }
  for(const side of ['W','E'] as const)for(let x=0;x<cols;x++){
    let start=-1;
    for(let y=0;y<=rows;y++){
      const active=y<rows&&map[y]?.[x]==='wall'&&
        hasFloor(x+(side==='E'?1:-1),y);
      if(active&&start<0)start=y;
      if(!active&&start>=0){
        runs.push({side,x,y:start,length:y-start});
        start=-1;
      }
    }
  }
  return runs;
}

export type Joint = {x:number;y:number;connected:boolean};
/** Return geometric endpoints; joined runs share EXACT floating point coordinates. */
export function wallRunEnds(runs:readonly WallFaceRun[]):Joint[] {
  const coordinates: Array<[number,number]>=[];
  for(const run of runs){
    if(run.side==='S'||run.side==='N'){
      const y=run.y+(run.side==='S'?1:0);
      coordinates.push([run.x,y],[run.x+run.length,y]);
    }else{
      const x=run.x+(run.side==='E'?1:0);
      coordinates.push([x,run.y],[x,run.y+run.length]);
    }
  }
  return coordinates.map(([x,y])=>({
    x,y,connected:coordinates.filter(([xx,yy])=>xx===x&&yy===y).length>1
  }));
}

/**
 * Continuous south-facing local coordinate system:
 * +x follows the wall, -y points INTO its solid tile.
 * All other faces are rigid rotations; joints therefore meet without offsets.
 */
export function wallFaceFrame(run:WallFaceRun,size:number) {
  switch(run.side){
    case 'S':return {x:run.x*size,y:(run.y+1)*size,angle:0,length:run.length*size};
    case 'N':return {x:(run.x+run.length)*size,y:run.y*size,
      angle:Math.PI,length:run.length*size};
    case 'W':return {x:run.x*size,y:run.y*size,angle:Math.PI/2,length:run.length*size};
    case 'E':return {x:(run.x+1)*size,y:(run.y+run.length)*size,
      angle:-Math.PI/2,length:run.length*size};
  }
}

/**
 * Sprite-based, border-following geometry. The image samples are cropped from
 * the Work top-down sheet well INSIDE a part, excluding its baked end pillars.
 * Concrete/steel seams are hidden by one continuous trim line over the run.
 */
export function drawHybridWallFaces(
  ctx:CanvasRenderingContext2D,map:readonly (readonly Tile[])[],
  size:number,topdown?:HTMLImageElement|null
) {
  const runs=exposedWallRuns(map);
  const lip=size*.16,metal=size*.25,depth=lip+metal;
  for(const run of runs){
    const {x,y,angle,length}=wallFaceFrame(run,size);
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(angle);
    // Opaque backing, with no old-style beige centreline.
    ctx.fillStyle='#233c40';
    ctx.fillRect(0,-depth,length,depth);
    ctx.fillStyle='#666b66';
    ctx.fillRect(0,-lip,length,lip);
    if(topdown){
      ctx.save();
      ctx.beginPath();
      ctx.rect(0,-depth,length,depth);
      ctx.clip();
      const count=Math.ceil(length/size);
      for(let i=0;i<count;i++){
        const at=i*size,span=Math.min(size,length-at);
        // A vertical pipe bank is sampled away from its end caps.
        ctx.save();
        ctx.translate(at+span/2,-depth+metal/2);
        ctx.rotate(-Math.PI/2);
        ctx.drawImage(topdown,648,82,62,80,
          -metal/2,-span/2,metal,span);
        ctx.restore();
        // Concrete without the steel support pillars at the source edges.
        const concreteX=i%3===1?322:90;
        const concreteY=i%3===1?395:74;
        ctx.drawImage(topdown,concreteX,concreteY,84,50,
          at,-lip,span,lip);
      }
      ctx.restore();
    }
    // Continuous top-down structural rails bridge all image boundaries.
    ctx.fillStyle='#17292c';
    ctx.fillRect(0,-depth,length,size*.035);
    ctx.fillStyle='#986f4a';
    ctx.fillRect(0,-lip-size*.035,length,size*.022);
    ctx.fillStyle='#d1c6b1';
    ctx.fillRect(0,-size*.019,length,size*.019);
    ctx.restore();
  }

  // A single riveted joint is placed only at a real turn or termination,
  // never automatically at the end of EACH repeated tile.
  const used=new Set<string>();
  for(const joint of wallRunEnds(runs)){
    const key=joint.x+','+joint.y;
    if(used.has(key))continue;
    used.add(key);
    const px=joint.x*size,py=joint.y*size;
    const rad=size*(joint.connected?.105:.075);
    ctx.fillStyle='#253f43';
    ctx.fillRect(px-rad,py-rad,rad*2,rad*2);
    ctx.strokeStyle='#aa8960';
    ctx.lineWidth=Math.max(1,size*.012);
    ctx.strokeRect(px-rad,py-rad,rad*2,rad*2);
    ctx.fillStyle='#c7ab80';
    ctx.fillRect(px-size*.014,py-size*.014,size*.028,size*.028);
  }
}

/** A frame on the LEFT map border, not a solid wall on the passable cell. */
export function drawTopdownEntrance(
  ctx:CanvasRenderingContext2D,map:readonly (readonly Tile[])[],
  x:number,y:number,size:number,topdown?:HTMLImageElement|null
) {
  if(map[y]?.[x]==='wall')return;
  if(x!==0)return;
  const py=y*size,px=x*size,post=size*.20;
  ctx.save();
  for(const at of [py,py+size-post]){
    ctx.fillStyle='#2c4e52';
    ctx.fillRect(px,at,post,post);
    if(topdown)ctx.drawImage(topdown,646,30,45,46,px,at,post,post);
    ctx.strokeStyle='#b69a67';
    ctx.lineWidth=size*.025;
    ctx.strokeRect(px+size*.02,at+size*.02,post-size*.04,post-size*.04);
  }
  // Thin yellow caution paint only on the structural posts.
  ctx.strokeStyle='#e5b54f';
  ctx.lineWidth=Math.max(2,size*.025);
  ctx.beginPath();
  ctx.moveTo(px+size*.03,py+post*.35);
  ctx.lineTo(px+post*.7,py+post*.78);
  ctx.moveTo(px+size*.03,py+size-post*.65);
  ctx.lineTo(px+post*.7,py+size-post*.2);
  ctx.stroke();
  ctx.restore();
}
