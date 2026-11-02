import { type Block, type Command, type Level, commands } from './game';
const prefix = 'protobot:v1:';
interface SavedLevel { revision: number; blocks: Block[]; completed: boolean }
const memory = new Map<string, SavedLevel>();
let warning = '';
export const storageWarning = () => warning;
const key = (level: Level) => prefix + level.id;
function isBlock(value: unknown): value is Block {
  return !!value && typeof value === 'object' && typeof (value as Block).id === 'string' &&
    typeof (value as Block).command === 'string' && (value as Block).command in commands;
}
export function loadLevel(level: Level): SavedLevel {
  const fallback: SavedLevel = {revision: level.revision, blocks: level.defaults.map((command: Command, i) => ({id: 'start-' + i, command})), completed: false};
  try {
    const raw = localStorage.getItem(key(level));
    if (!raw) return memory.get(key(level)) ?? fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;
    const saved = parsed as Partial<SavedLevel>;
    if (!Array.isArray(saved.blocks) || saved.blocks.length > 100 || !saved.blocks.every(isBlock)) return fallback;
    // Only reuse blocks from a matching level revision; preserve the completed badge.
    return {revision: level.revision, blocks: saved.revision === level.revision ? saved.blocks : fallback.blocks, completed: saved.completed === true};
  } catch {
    warning = 'Opslaan is niet beschikbaar in deze browser. Je kunt wel verder spelen.';
    return memory.get(key(level)) ?? fallback;
  }
}
export function saveLevel(level: Level, data: SavedLevel): void {
  memory.set(key(level), data);
  try { localStorage.setItem(key(level), JSON.stringify(data)); }
  catch { warning = 'Opslaan is niet beschikbaar in deze browser. Je kunt wel verder spelen.'; }
}
