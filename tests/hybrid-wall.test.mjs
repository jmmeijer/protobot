import test from 'node:test';
import assert from 'node:assert/strict';
import {
 exposedWallRuns,wallRunEnds,wallFaceFrame
} from '../src/wall-topdown-study.ts';
import {levelById} from '../src/game.ts';

test('long corridor exposes three joined faces and keeps a passable entrance',()=>{
 const level=levelById('lange-gang'),runs=exposedWallRuns(level.tiles);
 assert.equal(level.tiles[1][0],'stone');
 assert.deepEqual(runs,[
   {side:'S',x:0,y:0,length:8},
   {side:'N',x:0,y:2,length:8},
   {side:'W',x:8,y:1,length:1}
 ]);
});
test('upper and lower faces terminate at exactly the vertical face corners',()=>{
 const runs=exposedWallRuns(levelById('lange-gang').tiles);
 const ends=wallRunEnds(runs);
 for(const point of [[8,1],[8,2]]){
   const found=ends.filter(v=>v.x===point[0]&&v.y===point[1]);
   assert.equal(found.length,2);
   assert.ok(found.every(v=>v.connected));
 }
 for(const point of [[0,1],[0,2]]){
   const found=ends.filter(v=>v.x===point[0]&&v.y===point[1]);
   assert.equal(found.length,1);
   assert.equal(found[0].connected,false);
 }
});
test('wall sides are mapped onto rigid rotations without geometrical gaps',()=>{
 const s=128,runs=exposedWallRuns(levelById('lange-gang').tiles);
 const frames=runs.map(run=>wallFaceFrame(run,s));
 assert.deepEqual(frames.map(v=>v.length),[1024,1024,128]);
 assert.deepEqual(frames.map(v=>v.angle),[0,Math.PI,Math.PI/2]);
 assert.equal(frames[0].x+frames[0].length,frames[2].x);
 assert.equal(frames[0].y,frames[2].y);
 assert.equal(frames[1].x,frames[2].x);
 assert.equal(frames[1].y,frames[2].y+frames[2].length);
});
test('no faces are drawn against out-of-map voids or inside solid walls',()=>{
 const m=(...lines)=>lines.map(r=>[...r].map(x=>x==='#'?'wall':'stone'));
 assert.deepEqual(exposedWallRuns(m('###','###')),[]);
 assert.deepEqual(exposedWallRuns(m('sss','###','sss')),[
  {side:'S',x:0,y:1,length:3},
  {side:'N',x:0,y:1,length:3}
 ]);
});
