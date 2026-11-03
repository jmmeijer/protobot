import test from 'node:test';
import assert from 'node:assert/strict';
import {compileWorkspace,defaultWorkspace,executeProgramStep,initialProgramState,ProgramError,visibleInstruction} from '../src/program.ts';

const level={number:2,defaults:['forward','forward','right','forward'],start:{x:0,y:1,direction:'E'},goal:{x:2,y:2},tiles:[['grass','grass','grass'],['grass','grass','grass'],['grass','grass','grass']]};
const block=(type,id,props={})=>({type,id,...props});
function connect(...blocks){const list=structuredClone(blocks);for(let i=0;i<list.length-1;i++)list[i].next={block:list[i+1]};return list[0];}
const workspace=(first,extra=[])=>({blocks:{languageVersion:0,blocks:[block('pb_start','start',{inputs:{DO:{block:first}}}),...extra]}});
function run(ws,l=level){const program=compileWorkspace(ws,l);let state=initialProgramState(l);for(let i=0;i<505 && !['won','failed'].includes(state.phase);i++)state=executeProgramStep(l,program,state);return {state,program};}
test('old flat program migrates to Blockly and reaches its goal',()=>{
 const ws=defaultWorkspace(level,[{id:'1',command:'forward'},{id:'2',command:'forward'},{id:'3',command:'right'},{id:'4',command:'forward'}]);
 const r=run(ws); assert.equal(r.state.phase,'won');assert.equal(r.state.steps,4);assert.equal(r.program.totalBlocks,4);
});
test('detached blocks never execute',()=>{
 const p=compileWorkspace(workspace(block('pb_forward','move'),[block('pb_right','loose')]),level);
 assert.deepEqual(p.instructions.map(i=>i.op),['forward']);assert.equal(p.ignoredBlocks,1);
});
test('if/else condition executes the correct path',()=>{
 const ws=workspace(connect(block('pb_if_else','choice',{inputs:{COND:{block:block('pb_path_clear','sensor')},THEN:{block:block('pb_forward','yes')},ELSE:{block:block('pb_left','no')}}}),block('pb_forward','after')));
 const r=run(ws); assert.equal(r.state.x,2);assert.equal(r.state.direction,'E');assert.equal(r.program.instructions[2].op,'jump');
});
test('else branch executes on blocked route',()=>{
 const l={...level,tiles:[['grass','grass','grass'],['grass','water','grass'],['grass','grass','grass']]};
 const ws=workspace(block('pb_if_else','choice',{inputs:{COND:{block:block('pb_path_clear','s')},THEN:{block:block('pb_forward','yes')},ELSE:{block:block('pb_left','no')}}}));
 const r=run(ws,l);assert.equal(r.state.direction,'N');assert.equal(r.state.steps,2);
});
test('repeat executes action twice and counts condition tests',()=>{
 const l={...level,goal:{x:2,y:1}};
 const ws=workspace(block('pb_repeat','repeat',{fields:{COUNT:2},inputs:{DO:{block:block('pb_forward','move')}}}));
 const r=run(ws,l);assert.equal(r.state.phase,'won');assert.equal(r.state.steps,4);
});
test('nested repetition counters are independent',()=>{
 const l={...level,goal:{x:2,y:1}};
 const inner=block('pb_repeat','inner',{fields:{COUNT:1},inputs:{DO:{block:block('pb_forward','move')}}});
 const ws=workspace(block('pb_repeat','outer',{fields:{COUNT:2},inputs:{DO:{block:inner}}}));
 assert.equal(run(ws,l).state.phase,'won');
});
test('repeat until checks condition before every iteration',()=>{
 const ws=workspace(block('pb_until','until',{inputs:{COND:{block:block('pb_terrain','check',{fields:{WHERE:'AHEAD',TERRAIN:'water'}})},DO:{block:block('pb_forward','move')}}}));
 const l={...level,tiles:[['grass','grass','grass'],['grass','grass','water'],['grass','grass','grass']]};
 const r=run(ws,l);assert.equal(r.state.x,1);assert.equal(r.state.phase,'failed');assert.match(r.state.message,/doel/);
});
test('empty loop stops at 500 steps',()=>{
 const ws=workspace(block('pb_until','until',{inputs:{COND:{block:block('pb_on_goal','g')}}}));
 const r=run(ws);assert.equal(r.state.steps,500);assert.match(r.state.message,/500/);
});
test('missing sensor condition gives block-specific error',()=>{
 const ws=workspace(block('pb_if','bad',{inputs:{THEN:{block:block('pb_forward','move')}}}));
 assert.throws(()=>compileWorkspace(ws,level),e=>e instanceof ProgramError && e.blockId==='bad');
});
test('repeat count bounded 1 to 20',()=>{
 assert.throws(()=>compileWorkspace(workspace(block('pb_repeat','bad',{fields:{COUNT:21}})),level),/1 en 20/);
});
test('advanced blocks unavailable in first level',()=>{
 assert.throws(()=>compileWorkspace(workspace(block('pb_repeat','bad',{fields:{COUNT:1}})),{...level,number:1}),/latere missie/);
});
test('arbitrary JavaScript-like blocks are rejected',()=>{
 assert.throws(()=>compileWorkspace(workspace(block('javascript_eval','bad',{fields:{code:'alert(1)'}})),level),/Niet ondersteund/);
});
test('water ends the run on the entered tile',()=>{
 const l={...level,tiles:[['grass','grass','grass'],['grass','water','grass'],['grass','grass','grass']]};
 const r=run(workspace(block('pb_forward','move')),l);assert.equal(r.state.x,1);assert.equal(r.state.phase,'failed');
});
test('internal jump is not a visible action',()=>{
 const ws=workspace(block('pb_if_else','choice',{inputs:{COND:{block:block('pb_path_clear','s')},THEN:{block:block('pb_scan','t')},ELSE:{block:block('pb_left','f')}}}));
 const p=compileWorkspace(ws,level);assert.equal(visibleInstruction(p,2),null);
});
