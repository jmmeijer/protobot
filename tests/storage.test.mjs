import test from 'node:test';
import assert from 'node:assert/strict';
import {levelById} from '../src/game.ts';
import {loadLevel,saveLevel} from '../src/storage.ts';

const entries=new Map();
globalThis.localStorage={
 getItem:(k)=>entries.get(k)??null,
 setItem:(k,v)=>entries.set(k,v)
};
test('changing a level revision resets completed but preserves Blockly JSON',()=>{
 const level=levelById('rivieroever');
 const previous={revision:1,completed:true,blocks:[{id:'old',command:'forward'}],
   workspace:{blocks:{blocks:[{type:'pb_start',id:'start'}]}}};
 entries.set('protobot:v1:'+level.id,JSON.stringify(previous));
 const current=loadLevel(level);
 assert.equal(current.completed,false);
 assert.equal(current.revision,2);
 assert.deepEqual(current.workspace,previous.workspace);
 assert.deepEqual(current.blocks,previous.blocks);
});
test('same revision keeps completed status',()=>{
 const level=levelById('radiomast');
 saveLevel(level,{revision:level.revision,completed:true,blocks:[]});
 assert.equal(loadLevel(level).completed,true);
});
