export type Command = 'forward' | 'left' | 'right' | 'scan';
export type Direction = 'N' | 'E' | 'S' | 'W';
export type Phase = 'ready' | 'running' | 'paused' | 'won' | 'failed';
export type Tile = 'grass' | 'stone' | 'dirt' | 'sand' | 'water' | 'lava' | 'wall';
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
  unlocked: boolean;
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
export const levels: Level[] = [
  {
    id: 'radiomast', revision: 1, number: 1, title: 'De verlaten radiomast',
    subtitle: 'Je eerste protocol', story: 'Een noodsignaal klinkt vanuit de oude radiomast. Programmeer ProtoBot om het controlepaneel te bereiken.',
    objective: 'Bereik het groene doelvak. Gebruik vooruit en draaien.', hint: 'Twee stappen vooruit, draai rechts, dan nog één stap.',
    tiles: [
      ['grass','grass','grass','stone','grass'],
      ['stone','grass','grass','grass','grass'],
      ['grass','grass','grass','stone','grass'],
      ['grass','sand','sand','grass','grass']
    ],
    start: {x: 1,y: 1,direction: 'E'}, goal: {x: 3,y: 2},
    defaults: ['forward','forward','right','forward'], unlocked: true
  },
  {
    id: 'rivieroever', revision: 1, number: 2, title: 'De overstroomde oever',
    subtitle: 'Water in zicht', story: 'De rivier heeft het pad versperd. Zoek via de droge stenen een route naar de zendruïne.',
    objective: 'Bereik het doel zonder het water in te rijden.', hint: 'Rijd eerst naar het veilige pad boven de rivier.',
    tiles: [
      ['grass','grass','grass','grass','grass'],
      ['stone','stone','stone','stone','grass'],
      ['grass','grass','water','water','grass'],
      ['grass','grass','water','grass','grass']
    ],
    start: {x: 0,y: 2,direction: 'E'}, goal: {x: 3,y: 1},
    defaults: ['left','forward','right','forward','forward','forward'], unlocked: true
  }
];
export const levelById = (id: string) => levels.find(level => level.id === id);
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
