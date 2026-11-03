import { type Block, type Command, type Level, commands, levels } from './game.ts';

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
let database: IDBDatabase | undefined;
const store = 'levels';
const unavailable = 'Opslaan is niet beschikbaar in deze browser. Je kunt wel verder spelen.';

export async function prepareStorage(): Promise<void> {
  if (!globalThis.indexedDB) return;
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('protobot', 1);
      request.onupgradeneeded = () => request.result.createObjectStore(store);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    db.onversionchange = () => db.close();
    const imported: string[] = [];
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite');
      const records = transaction.objectStore(store);
      for (const level of levels) {
        const request = records.get(level.id);
        request.onsuccess = () => {
          if (request.result !== undefined) {
            memory.set(key(level), request.result);
            return;
          }
          try {
            const old = localStorage.getItem(key(level));
            if (old === null) return;
            const saved = JSON.parse(old);
            records.put(saved, level.id);
            memory.set(key(level), saved);
            imported.push(key(level));
          } catch { /* Missing access or malformed legacy save. */ }
        };
      }
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    database = db;
    for (const legacyKey of imported) {
      try { localStorage.removeItem(legacyKey); } catch { /* Already migrated. */ }
    }
  } catch { /* Continue with the legacy storage backend. */ }
}
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
    const parsed:unknown = memory.get(key(level)) ??
      (database ? undefined : JSON.parse(localStorage.getItem(key(level)) ?? 'null'));
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
  if (database) {
    try {
      const tx = database.transaction(store, 'readwrite');
      tx.onabort = () => { warning = unavailable; };
      tx.objectStore(store).put(data, level.id);
    } catch { warning = unavailable; }
    return;
  }
  try { localStorage.setItem(key(level),JSON.stringify(data)); }
  catch {warning='Opslaan is niet beschikbaar in deze browser. Je kunt wel verder spelen.';}
}
