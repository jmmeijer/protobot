import test from 'node:test';
import assert from 'node:assert/strict';
import {TOPDOWN_ATLAS,wallConnections,sampleWallDetail} from '../src/wall-topdown-study.ts';
import {levelById} from '../src/game.ts';

test('Work top-down sheet has eight distinct cells in a 4 by 2 atlas',()=>{
  assert.equal(TOPDOWN_ATLAS.length,8);
  const all=TOPDOWN_ATLAS.map(v=>v.x+','+v.y);
  assert.equal(new Set(all).size,8);
  assert.ok(TOPDOWN_ATLAS.every(v=>v.x>=0&&v.x<4&&v.y>=0&&v.y<2));
});

test('connections match exactly on both sides of every shared wall edge',()=>{
 const map=levelById('lange-gang').tiles;
 for(let y=0;y<map.length;y++)for(let x=0;x<map[y].length;x++){
  const a=wallConnections(map,x,y);
  if(!a)continue;
  if(x+1<map[y].length){
    const b=wallConnections(map,x+1,y);
    assert.equal(a.east,Boolean(b?.west));
  }
  if(y+1<map.length){
    const b=wallConnections(map,x,y+1);
    assert.equal(a.south,Boolean(b?.north));
  }
 }
});

test('wall attachments are sparse and independent from collision',()=>{
 const level=levelById('lange-gang');
 assert.equal(sampleWallDetail(level.id,3,0),'radiator');
 assert.equal(sampleWallDetail(level.id,6,0),'control');
 assert.equal(sampleWallDetail(level.id,4,2),'vent');
 assert.equal(sampleWallDetail(level.id,2,0),null);
 assert.equal(level.tiles[1][0],'stone');
 assert.equal(wallConnections(level.tiles,0,1),null);
});
