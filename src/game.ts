import { campaignLevels } from './levels.ts';
export type Command = 'forward' | 'left' | 'right' | 'scan';
export type Direction = 'N' | 'E' | 'S' | 'W';
export type Phase = 'ready' | 'running' | 'paused' | 'won' | 'failed';
export type Tile = 'grass' | 'stone' | 'dirt' | 'sand' | 'water' | 'lava' | 'wall';
export type BlockType =
  | 'pb_forward'|'pb_left'|'pb_right'|'pb_scan'|'pb_repeat'
  | 'pb_if'|'pb_if_else'|'pb_path_clear'|'pb_terrain'
  | 'pb_terrain_ahead'|'pb_terrain_under'|'pb_until'|'pb_on_goal';
export type MissionObjectType = 'radio'|'geiger'|'relay'|'beacon'|'sensor'|'pump';
export interface MissionObject {type:MissionObjectType; x:number; y:number; label:string}
export interface MapVariant {
  id:string; label:string; tiles:Tile[][];
  start:{x:number;y:number;direction:Direction};
  goal:{x:number;y:number};
  objects:MissionObject[];
}
export interface Block { id: string; command: Command }
export interface Level {
  id: string;
  revision: number;
  number: number;
  title: string;
  subtitle: string;
  story: string;
  objective: string;
  hint: string;
  tiles: Tile[][];
  start: { x: number; y: number; direction: Direction };
  goal: { x: number; y: number };
  defaults: Command[];
  allowedBlocks?: readonly BlockType[];
  maxBlocks?: number;
  learningGoals?: string[];
  hints?: string[];
  successLog?: string;
  objects?: MissionObject[];
  variants?: MapVariant[];
  starterWorkspace?: object;
}
export interface RunState {
  x: number; y: number; direction: Direction; pc: number;
  steps: number; phase: Phase; message: string;
}
export const commands: Record<Command, { label: string; hint: string; symbol: string }> = {
  forward: { label: 'Rij vooruit', hint: 'Verplaats één vak', symbol: '↑' },
  left: { label: 'Draai links', hint: 'Draai 90° linksom', symbol: '↶' },
  right: { label: 'Draai rechts', hint: 'Draai 90° rechtsom', symbol: '↷' },
  scan: { label: 'Scan omgeving', hint: 'Bekijk de tegel vóór ProtoBot', symbol: '◎' }
};
export const levels: Level[] = campaignLevels;
export const levelById = (id: string) => levels.find(level => level.id === id);
export function variantCount(level: Level): number { return 1 + (level.variants?.length ?? 0); }
export function levelVariant(level: Level, index: number): Level {
  if (index===0)return level;
  const variant=level.variants?.[index-1];
  if (!variant)throw new RangeError('Onbekende kaartvariant '+index+' voor '+level.id);
  return {...level, tiles:variant.tiles, start:variant.start, goal:variant.goal, objects:variant.objects};
}
export function variantLabel(level:Level,index:number):string {
  return index===0?'Hoofdkaart':level.variants?.[index-1]?.label ?? 'Onbekende kaart';
}
export function blockAllowed(level: Level, type: string): boolean {
  if (level.allowedBlocks) return level.allowedBlocks.includes(type as BlockType);
  // Synthetic levels in legacy interpreter tests retain the old tier behavior.
  return ['pb_forward','pb_left','pb_right','pb_scan'].includes(type) ||
    level.number>1 && ['pb_repeat','pb_until','pb_if','pb_if_else','pb_path_clear','pb_terrain','pb_on_goal'].includes(type);
}
export function initialState(level: Level): RunState {
  return { ...level.start, pc: 0, steps: 0, phase: 'ready', message: 'Klaar om te testen.' };
}
const order: Direction[] = ['N', 'E', 'S', 'W'];
const delta: Record<Direction, {x: number;y: number}> = {
  N: {x:0,y:-1}, E:{x:1,y:0}, S:{x:0,y:1}, W:{x:-1,y:0}
};
/** Pure, bounded interpreter for the scaffold. No generated JavaScript is evaluated. */
export function executeStep(level: Level, program: readonly Block[], previous: RunState): RunState {
  if (previous.phase === 'won' || previous.phase === 'failed') return previous;
  if (previous.steps >= 500) return {...previous, phase:'failed', message:'Veiligheidsstop: maximaal 500 stappen.'};
  if (previous.pc >= program.length) return {...previous, phase:'failed', message:'Het programma is klaar, maar het doel is niet bereikt.'};
  const command = program[previous.pc].command;
  const next: RunState = {...previous, pc:previous.pc + 1, steps:previous.steps + 1, phase:'paused'};
  const turn = order.indexOf(next.direction);
  if (command === 'left') next.direction = order[(turn+3)%4];
  if (command === 'right') next.direction = order[(turn+1)%4];
  if (command === 'scan') {
    const ahead = delta[next.direction];
    const tile = level.tiles[next.y+ahead.y]?.[next.x+ahead.x];
    next.message = tile ? 'Sensor: ' + (tile === 'water' ? 'water' : tile === 'wall' ? 'obstakel' : 'pad gedetecteerd') : 'Sensor: veldrand';
  }
  if (command === 'forward') {
    const movement = delta[next.direction];
    const x = next.x + movement.x;
    const y = next.y + movement.y;
    const tile = level.tiles[y]?.[x];
    if (!tile || tile === 'wall') {
      next.phase = 'failed';
      next.message = 'Botsing! ProtoBot kan daar niet verder.';
      return next;
    }
    next.x = x; next.y = y;
    if (tile === 'water' || tile === 'lava') {
      next.phase = 'failed'; next.message = tile === 'water' ? 'ProtoBot is in het water gereden.' : 'ProtoBot is in lava gereden.';
      return next;
    }
  }
  if (next.x === level.goal.x && next.y === level.goal.y) {
    next.phase = 'won'; next.message = 'Missie geslaagd! Het doel is bereikt.';
  } else if (next.pc >= program.length) {
    next.phase = 'failed'; next.message = 'Programma afgelopen voordat ProtoBot het doel bereikte.';
  } else if (command !== 'scan') {
    next.message = 'Instructie uitgevoerd.';
  }
  return next;
}
