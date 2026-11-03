import test from 'node:test';
import assert from 'node:assert/strict';
import { levels, levelById, levelVariant, variantCount } from '../src/game.ts';
import { compileWorkspace, executeProgramStep, initialProgramState } from '../src/program.ts';
import { validateCampaign } from '../src/level-validation.ts';

let serial=0;
const B=(type,props={})=>({type,id:type+'-'+(++serial),...props});
const chain=(...nodes)=>{for(let i=0;i<nodes.length-1;i++)nodes[i].next={block:nodes[i+1]};return nodes[0]};
const W=(first)=>({blocks:{languageVersion:0,blocks:[B('pb_start',{inputs:{DO:{block:first}}})]}});
const f=()=>B('pb_forward'),l=()=>B('pb_left'),r=()=>B('pb_right');
const repeat=(n,body)=>B('pb_repeat',{fields:{COUNT:n},inputs:{DO:{block:body}}});
const terrain=(where,kind)=>B(where==='UNDER'?'pb_terrain_under':'pb_terrain_ahead',{fields:{TERRAIN:kind}});
const choose=(cond,yes,no)=>B('pb_if_else',{inputs:{COND:{block:cond},THEN:{block:yes},ELSE:{block:no}}});
const until=(cond,body)=>B('pb_until',{inputs:{COND:{block:cond},DO:{block:body}}});
const reference={
 radiomast:()=>W(chain(f(),f(),r(),f())),
 'laatste-wacht':()=>W(chain(f(),f(),r(),f())),
 reparatieprotocol:()=>W(chain(f(),f(),r(),f())),
 'lange-gang':()=>W(repeat(6,f())),
 meetpost:()=>W(repeat(3,chain(f(),l(),f(),r()))),
 rivieroever:()=>W(chain(f(),choose(terrain('AHEAD','water'),chain(r(),f()),f()))),
 lavagrot:()=>W(choose(B('pb_path_clear'),chain(f(),f()),chain(r(),f(),f()))),
 waterleiding:()=>W(chain(until(terrain('UNDER','sand'),f()),f())),
 inspectieprotocol:()=>W(chain(repeat(2,f()),r(),f())),
 tegenstation:()=>W(until(B('pb_on_goal'),choose(B('pb_path_clear'),f(),r())))
};
test('the campaign has 10 validated missions',()=>{
 assert.equal(levels.length,10);
 assert.deepEqual(validateCampaign(levels),[]);
});
for(const level of levels){
 test('mission '+level.number+' '+level.id+' reference passes every map',()=>{
  const compiled=compileWorkspace(reference[level.id](),level);
  assert.equal(compiled.ignoredBlocks,0);
  for(let i=0;i<variantCount(level);i++){
   const map=levelVariant(level,i);
   let state=initialProgramState(map);
   for(let k=0;k<503&&!['won','failed'].includes(state.phase);k++)
    state=executeProgramStep(map,compiled,state);
   assert.equal(state.phase,'won','kaart '+(i+1)+': '+state.message+' @'+state.x+','+state.y);
  }
 });
}
test('block limits are enforced by the compiler',()=>{
 assert.throws(()=>compileWorkspace(W(chain(f(),f(),f(),f(),f(),f())),levelById('lange-gang')),/Maximaal 2/);
});
test('a future loop block cannot be used in level 3',()=>{
 assert.throws(()=>compileWorkspace(W(repeat(2,f())),levelById('reparatieprotocol')),/latere missie/);
});
test('reading terrain under ProtoBot is locked until mission 8',()=>{
 assert.throws(()=>compileWorkspace(W(choose(terrain('UNDER','grass'),f(),r())),levelById('rivieroever')),/latere missie|missie 8/);
});
test('the deliberately faulty inspection starter fails',()=>{
 const level=levelById('inspectieprotocol');
 const compiled=compileWorkspace(level.starterWorkspace,level);
 let state=initialProgramState(level);
 for(let k=0;k<60&&!['won','failed'].includes(state.phase);k++)
  state=executeProgramStep(level,compiled,state);
 assert.equal(state.phase,'failed');
});
