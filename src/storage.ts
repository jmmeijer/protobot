import { type Block, type Command, type Level, commands } from './game';

const prefix = 'protobot:v1:';
/** The old flat list remains temporarily for backwards-compatible migration. */
export interface SavedLevel {
  revision: number;
  blocks: Block[];
  completed: boolean;
  workspace?: object;
}
const memory = new Map<string, SavedLevel>();
let warning = '';
export const storageWarning = () => warning;
const key = (level: Level) => prefix + level.id;
function isBlock(value: unknown): value is Block {
  return !!value && typeof value === 'object' && typeof (value as Block).id === 'string' &&
    typeof (value as Block).command === 'string' && (value as Block).command in commands;
}
function isWorkspace(value: unknown): value is object {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data=value as {blocks?:{blocks?:unknown}};
  return !!data.blocks && Array.isArray(data.blocks.blocks);
}
function initial(level: Level): SavedLevel {
  return {revision:level.revision,blocks:level.defaults.map((command:Command,i)=>({id:'start-'+i,command})),completed:false};
}
export function loadLevel(level: Level): SavedLevel {
  const fallback=initial(level);
  try {
    const raw=localStorage.getItem(key(level));
    if(!raw) return memory.get(key(level)) ?? fallback;
    const parsed:unknown=JSON.parse(raw);
    if(!parsed || typeof parsed!=='object') return fallback;
    const saved=parsed as Partial<SavedLevel>;
    const sameRevision=saved.revision===level.revision;
    // Preserve the editable block workspace across a changed mission revision,
    // but never carry an old win over to a new puzzle or new map variants.
    const blocks=Array.isArray(saved.blocks) && saved.blocks.length<=100 && saved.blocks.every(isBlock)
      ? saved.blocks : fallback.blocks;
    const workspace=isWorkspace(saved.workspace) ? saved.workspace : undefined;
    return {revision:level.revision,blocks,completed:sameRevision && saved.completed===true,
      ...(workspace?{workspace}:{})};
  } catch {
    warning='Opslaan is niet beschikbaar in deze browser. Je kunt wel verder spelen.';
    return memory.get(key(level)) ?? fallback;
  }
}
export function saveLevel(level:Level,data:SavedLevel):void {
  memory.set(key(level),data);
  try { localStorage.setItem(key(level),JSON.stringify(data)); }
  catch {warning='Opslaan is niet beschikbaar in deze browser. Je kunt wel verder spelen.';}
}
