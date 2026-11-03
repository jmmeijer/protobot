import { levelVariant, variantCount, type Level, type Tile } from './game.ts';

const tiles = new Set<Tile>(['grass','stone','dirt','sand','water','lava','wall']);
const unsafe = new Set<Tile>(['water','lava','wall']);
/** Validate every map, reachability and mission metadata before shipping a level. */
export function validateLevel(level:Level):string[] {
  const issues:string[]=[];
  if(!level.id || level.number<1 || level.revision<1) issues.push('Ongeldig level-ID, nummer of revisie');
  if(!level.allowedBlocks?.includes('pb_forward')) issues.push('Een level moet kunnen rijden');
  if(level.maxBlocks!==undefined && (!Number.isInteger(level.maxBlocks) || level.maxBlocks<1))
    issues.push('Ongeldige bloklimiet');
  const ids=new Set<string>();
  for(let variant=0;variant<variantCount(level);variant++){
    const current=levelVariant(level,variant);
    const label=level.id+' / kaart '+(variant+1);
    const id=variant===0?'basis':level.variants![variant-1].id;
    if(ids.has(id))issues.push(label+': dubbel kaart-ID');
    ids.add(id);
    const map=current.tiles,rows=map.length,cols=map[0]?.length??0;
    if(!rows || !cols || rows>40 || cols>40)issues.push(label+': ongeldige afmetingen');
    if(map.some(row=>row.length!==cols || row.some(tile=>!tiles.has(tile))))
      issues.push(label+': ongelijk raster of onbekend terrein');
    const inside=(x:number,y:number)=>Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<cols&&y<rows;
    for(const [name,position] of [['start',current.start],['doel',current.goal]] as const){
      if(!inside(position.x,position.y))issues.push(label+': '+name+' buiten het veld');
      else if(unsafe.has(map[position.y][position.x]))issues.push(label+': '+name+' op onveilig terrein');
    }
    if(current.start.x===current.goal.x && current.start.y===current.goal.y)
      issues.push(label+': start en doel vallen samen');
    for(const object of current.objects??[]){
      if(!inside(object.x,object.y))issues.push(label+': object '+object.label+' buiten het veld');
      else if(unsafe.has(map[object.y][object.x]))issues.push(label+': object '+object.label+' op gevaarlijke tegel');
    }
    if(inside(current.start.x,current.start.y)&&inside(current.goal.x,current.goal.y)){
      const found=new Set<string>();
      const queue=[[current.start.x,current.start.y]];
      let reached=false;
      for(let i=0;i<queue.length;i++){
        const [x,y]=queue[i],key=x+','+y;
        if(found.has(key))continue;
        found.add(key);
        if(x===current.goal.x&&y===current.goal.y){reached=true;break;}
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
          const nx=x+dx,ny=y+dy;
          if(inside(nx,ny)&&!unsafe.has(map[ny][nx])&&!found.has(nx+','+ny))
            queue.push([nx,ny]);
        }
      }
      if(!reached)issues.push(label+': doel niet bereikbaar');
    }
  }
  return issues;
}
export function validateCampaign(levels:readonly Level[]):string[]{
  const issues=levels.flatMap(validateLevel);
  const ids=new Set<string>(),numbers=new Set<number>();
  for(const level of levels){
    if(ids.has(level.id))issues.push('Dubbel level-ID: '+level.id);
    if(numbers.has(level.number))issues.push('Dubbel missienummer: '+level.number);
    ids.add(level.id);numbers.add(level.number);
  }
  return issues;
}
