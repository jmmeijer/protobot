import { blockAllowed, type Block, type Command, type Direction, type Level, type RunState, type Tile } from './game.ts';

export type Condition =
  | { kind: 'path-clear' }
  | { kind: 'on-goal' }
  | { kind: 'terrain'; where: 'AHEAD' | 'UNDER'; terrain: Tile };
export type Instruction =
  | { op: Command; blockId: string }
  | { op: 'if'; blockId: string; condition: Condition; target: number }
  | { op: 'until'; blockId: string; condition: Condition; target: number }
  | { op: 'repeat'; blockId: string; count: number; target: number }
  | { op: 'jump'; blockId: string; target: number };
export interface Program { instructions: Instruction[]; totalBlocks: number; ignoredBlocks: number }
export interface ProgramRunState extends RunState {
  counters: Record<number, number>;
  lastBlockId?: string;
  lastSensor?: string;
}
export class ProgramError extends Error {
  readonly blockId?: string;
  constructor(message: string, blockId?: string) { super(message); this.name = 'ProgramError'; this.blockId = blockId; }
}
const actions: Record<string, Command> = {
  pb_forward: 'forward', pb_left: 'left', pb_right: 'right', pb_scan: 'scan'
};
const allowedTerrain = new Set<string>(['grass', 'stone', 'dirt', 'sand', 'water', 'lava']);
const directions: Direction[] = ['N', 'E', 'S', 'W'];
const offsets: Record<Direction, {x:number; y:number}> = {
  N: {x:0,y:-1}, E:{x:1,y:0}, S:{x:0,y:1}, W:{x:-1,y:0}
};

type Value = Record<string, unknown>;
function object(value: unknown): Value | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Value : null;
}
function nested(block: Value, slot: string): Value | null {
  const input = object(object(block.inputs)?.[slot]);
  return object(input?.block);
}
function next(block: Value): Value | null { return object(object(block.next)?.block); }
function id(block: Value): string {
  if (typeof block.id !== 'string' || !block.id || block.id.length > 100) {
    throw new ProgramError('Een blok heeft een ongeldige identificatie. Herstel het programma.');
  }
  return block.id;
}
function parseCondition(node: Value | null, parentId: string, level: Level): Condition {
  if (!node) throw new ProgramError('Plaats een sensorvoorwaarde in het lege puzzelstuk.', parentId);
  const blockId = id(node);
  if (typeof node.type !== 'string' || !blockAllowed(level,node.type))
    throw new ProgramError('Dit sensorblok komt pas in een latere missie beschikbaar.',blockId);
  if (node.type === 'pb_path_clear') return {kind:'path-clear'};
  if (node.type === 'pb_on_goal') return {kind:'on-goal'};
  if (node.type === 'pb_terrain' || node.type === 'pb_terrain_ahead' || node.type === 'pb_terrain_under') {
    const fields = object(node.fields);
    const where = node.type === 'pb_terrain_ahead' ? 'AHEAD'
      : node.type === 'pb_terrain_under' ? 'UNDER' : fields?.WHERE;
    const tile = fields?.TERRAIN;
    if ((where !== 'AHEAD' && where !== 'UNDER') || typeof tile !== 'string' || !allowedTerrain.has(tile)) {
      throw new ProgramError('Kies een geldige tegel en sensorrichting.', blockId);
    }
    if (where === 'UNDER' && level.allowedBlocks && !blockAllowed(level,'pb_terrain_under'))
      throw new ProgramError('Terrein onder de robot wordt pas vanaf missie 8 ontgrendeld.',blockId);
    return {kind:'terrain',where,terrain:tile as Tile};
  }
  throw new ProgramError('Dit blok kan niet als sensorvoorwaarde worden gebruikt.', blockId);
}
function countBlocks(value: Value, seen: Set<Value>, depth = 0): void {
  if (seen.has(value)) throw new ProgramError('Dubbele of cyclische blokgegevens zijn niet toegestaan.');
  if (seen.size >= 100 || depth >= 40) throw new ProgramError('Te veel blokken of te diep genest programma (maximaal 100).');
  seen.add(value);
  const inputs = object(value.inputs);
  if (inputs) for (const v of Object.values(inputs)) {
    const child = object(object(v)?.block);
    if (child) countBlocks(child, seen, depth + 1);
  }
  const sibling = next(value);
  if (sibling) countBlocks(sibling, seen, depth);
}
/** Translate Blockly JSON to bounded instructions. Never evaluate generated JavaScript. */
export function compileWorkspace(state: unknown, level: Level): Program {
  const top = object(object(state)?.blocks)?.blocks;
  if (!Array.isArray(top)) throw new ProgramError('Er is nog geen geldig Blockly-programma opgeslagen.');
  if (top.length > 100) throw new ProgramError('Te veel losse blokken.');
  const roots = top.filter(node => object(node)?.type === 'pb_start');
  if (roots.length !== 1) throw new ProgramError('Het vaste startblok ontbreekt of komt meerdere keren voor.');
  const start = object(roots[0]);
  if (!start) throw new ProgramError('Ongeldig startblok.');
  const seen = new Set<Value>();
  for (const node of top) {
    const block = object(node);
    if (!block) throw new ProgramError('Een blok is ongeldig.');
    countBlocks(block, seen);
  }
  if (start.next) throw new ProgramError('Het startblok mag geen los vervolg hebben.', id(start));
  const instructions: Instruction[] = [];
  const attached = new Set<Value>([start]);
  function add(inst: Instruction) {
    if (instructions.length >= 200) throw new ProgramError('Het programma bevat te veel instructies.', inst.blockId);
    instructions.push(inst);
  }
  function chain(first: Value | null, depth: number) {
    if (depth >= 18) throw new ProgramError('De blokken zijn te diep genest.');
    let block = first;
    while (block) {
      attached.add(block);
      const blockId = id(block);
      const type = block.type;
      if (block.enabled === false) { block = next(block); continue; }
      if (typeof type !== 'string') throw new ProgramError('Onbekend bloktype.', blockId);
      if (!(type in actions || ['pb_if','pb_if_else','pb_repeat','pb_until'].includes(type)))
        throw new ProgramError('Niet ondersteund blok: ' + type,blockId);
      if (!blockAllowed(level,type))
        throw new ProgramError('Dit codeblok komt pas in een latere missie beschikbaar.',blockId);
      if (type in actions) {
        add({op:actions[type],blockId});
      } else if (type === 'pb_if' || type === 'pb_if_else') {
        const conditionNode = nested(block,'COND');
        if (conditionNode) attached.add(conditionNode);
        const condition = parseCondition(conditionNode,blockId,level);
        const at = instructions.length;
        add({op:'if',blockId,condition,target:-1});
        chain(nested(block,'THEN'),depth+1);
        if (type === 'pb_if_else') {
          const skip = instructions.length;
          add({op:'jump',blockId,target:-1});
          (instructions[at] as Extract<Instruction,{op:'if'}>).target = instructions.length;
          chain(nested(block,'ELSE'),depth+1);
          (instructions[skip] as Extract<Instruction,{op:'jump'}>).target = instructions.length;
        } else (instructions[at] as Extract<Instruction,{op:'if'}>).target = instructions.length;
      } else if (type === 'pb_repeat' || type === 'pb_until') {
        const at = instructions.length;
        if (type === 'pb_repeat') {
          const n = Number(object(block.fields)?.COUNT);
          if (!Number.isInteger(n) || n < 1 || n > 20) throw new ProgramError('Herhaal tussen 1 en 20 keer.',blockId);
          add({op:'repeat',blockId,count:n,target:-1});
        } else {
          const conditionNode = nested(block,'COND');
          if (conditionNode) attached.add(conditionNode);
          add({op:'until',blockId,condition:parseCondition(conditionNode,blockId,level),target:-1});
        }
        chain(nested(block,'DO'),depth+1);
        add({op:'jump',blockId,target:at});
        (instructions[at] as Extract<Instruction,{op:'repeat'|'until'}>).target = instructions.length;
      } else throw new ProgramError('Niet ondersteund blok: ' + type,blockId);
      block = next(block);
    }
  }
  chain(nested(start,'DO'),0);
  const connectedBlocks = Math.max(0,attached.size - 1);
  if (level.maxBlocks !== undefined && connectedBlocks > level.maxBlocks)
    throw new ProgramError('Maximaal '+level.maxBlocks+' codeblokken toegestaan (exclusief startblok).');
  return {instructions,totalBlocks:Math.max(0,seen.size - 1), ignoredBlocks:Math.max(0,seen.size - attached.size)};
}
export function defaultWorkspace(level: Level, legacyBlocks?: readonly Block[]): object {
  if ((!legacyBlocks || legacyBlocks.length === 0) && level.starterWorkspace)
    return structuredClone(level.starterWorkspace);
  const blocks = legacyBlocks ?? level.defaults.map((command,i) => ({command,id:'start-'+i}));
  let sequence: Value | undefined;
  for (let i=blocks.length-1;i>=0;i--) {
    const entry = blocks[i];
    if (!(entry.command in {forward:1,left:1,right:1,scan:1})) continue;
    const node: Value = {type:'pb_'+entry.command,id:entry.id || 'action-'+i};
    if (sequence) node.next = {block:sequence};
    sequence = node;
  }
  return {blocks:{languageVersion:0,blocks:[{type:'pb_start',id:'mission-start',x:30,y:40, ...(sequence ? {inputs:{DO:{block:sequence}}} : {})}]}};
}
export function initialProgramState(level: Level): ProgramRunState {
  return {...level.start,pc:0,steps:0,phase:'ready',message:'Klaar om te testen.',counters:{}};
}
function tileAt(level:Level,x:number,y:number): Tile | undefined { return level.tiles[y]?.[x]; }
function conditionValue(level:Level,state:RunState,condition:Condition): boolean {
  const d=offsets[state.direction];
  const front=tileAt(level,state.x+d.x,state.y+d.y);
  if (condition.kind==='on-goal') return state.x===level.goal.x && state.y===level.goal.y;
  if (condition.kind==='path-clear') return !!front && front !== 'wall' && front !== 'water' && front !== 'lava';
  const t=condition.where==='UNDER'? tileAt(level,state.x,state.y):front;
  return t!==undefined && t!=='wall' && t===condition.terrain;
}
export function visibleInstruction(program:Program,pc:number): {pc:number; instruction:Instruction} | null {
  let cursor=pc;
  for(let i=0;i<program.instructions.length+1;i++) {
    const inst=program.instructions[cursor];
    if (!inst) return null;
    if (inst.op!=='jump') return {pc:cursor,instruction:inst};
    cursor=inst.target;
  }
  throw new ProgramError('Ongeldige spronglus in het programma.');
}
export function describeInstruction(inst?:Instruction): string {
  if(!inst) return 'Einde programma';
  switch(inst.op) {
    case 'forward': return 'Rij vooruit';
    case 'left': return 'Draai links';
    case 'right': return 'Draai rechts';
    case 'scan': return 'Scan omgeving';
    case 'repeat': return 'Herhaal ' + inst.count + ' keer';
    case 'until': return 'Herhaal totdat';
    case 'if': return 'Als sensor…';
    case 'jump': return 'Verder';
  }
}
export function executeProgramStep(level:Level,program:Program,previous:ProgramRunState):ProgramRunState {
  if(previous.phase==='won'||previous.phase==='failed')return previous;
  if(previous.steps>=500)return {...previous,phase:'failed',message:'Veiligheidsstop: maximaal 500 stappen.'};
  const current=visibleInstruction(program,previous.pc);
  if(!current)return {...previous,phase:'failed',message:'Het programma is klaar, maar het doel is nog niet bereikt.'};
  const inst=current.instruction;
  const s:ProgramRunState={...previous,counters:{...previous.counters},pc:current.pc+1,steps:previous.steps+1,phase:'paused',lastBlockId:inst.blockId};
  const d=offsets[s.direction];
  switch(inst.op){
    case 'forward':{
      const x=s.x+d.x,y=s.y+d.y,t=tileAt(level,x,y);
      if(!t||t==='wall')return {...s,phase:'failed',message:'Botsing! ProtoBot kan daar niet verder.'};
      s.x=x;s.y=y;
      if(t==='water'||t==='lava')return {...s,phase:'failed',message:'ProtoBot is in '+(t==='lava'?'lava':'het water')+' gereden.'};
      s.message='Eén vak vooruit.';
      break;
    }
    case 'left':s.direction=directions[(directions.indexOf(s.direction)+3)%4];s.message='90° naar links gedraaid.';break;
    case 'right':s.direction=directions[(directions.indexOf(s.direction)+1)%4];s.message='90° naar rechts gedraaid.';break;
    case 'scan':{
      const terrain=tileAt(level,s.x+d.x,s.y+d.y);
      s.lastSensor=terrain??'veldrand';s.message='Sensor vóór mij: '+s.lastSensor+'.';break;
    }
    case 'if':{
      const yes=conditionValue(level,s,inst.condition);
      s.lastSensor=yes?'ja':'nee';s.message='Voorwaarde is '+s.lastSensor+'.';
      if(!yes)s.pc=inst.target;
      break;
    }
    case 'until':{
      const yes=conditionValue(level,s,inst.condition);
      s.lastSensor=yes?'ja':'nee';s.message='Herhaal totdat: '+s.lastSensor+'.';
      if(yes)s.pc=inst.target;
      break;
    }
    case 'repeat':{
      const soFar=s.counters[current.pc]??0;
      if(soFar>=inst.count){delete s.counters[current.pc];s.pc=inst.target;s.message='Herhaling afgerond.';}
      else{s.counters[current.pc]=soFar+1;s.message='Herhaling '+(soFar+1)+' van '+inst.count+'.';}
      break;
    }
    case 'jump':throw new ProgramError('Een interne sprong mag niet als zichtbare stap worden uitgevoerd.');
  }
  if(s.x===level.goal.x && s.y===level.goal.y)return {...s,phase:'won',message:'Missie geslaagd! Het doel is bereikt.'};
  if(!visibleInstruction(program,s.pc))return {...s,phase:'failed',message:'Programma afgelopen voordat ProtoBot het doel bereikte.'};
  return s;
}
