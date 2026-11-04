import test from 'node:test';
import assert from 'node:assert/strict';
import { WALL_ATLAS_CELLS, wallSpriteForTile } from '../src/wall-topology.ts';
import { levelById } from '../src/game.ts';

const map=(...rows)=>rows.map(r=>[...r].map(c=>c==='#'?'wall':'stone'));

test('all six art pieces occupy unique cells in a 3 × 2 atlas',()=>{
  const keys=Object.keys(WALL_ATLAS_CELLS);
  assert.deepEqual(keys,['straight','inner_corner','outer_corner','end_cap','doorway','damaged_opening']);
  const coords=Object.values(WALL_ATLAS_CELLS);
  assert.equal(new Set(coords.map(([x,y])=>x+','+y)).size,6);
  assert.ok(coords.every(([x,y])=>x>=0&&x<3&&y>=0&&y<2));
});
test('horizontal and vertical runs use the same straight sprite, rotated',()=>{
  assert.deepEqual(wallSpriteForTile(map('sss','###','sss'),1,1),
    {piece:'straight',rotation:0});
  assert.deepEqual(wallSpriteForTile(map('s#s','s#s','s#s'),1,1),
    {piece:'straight',rotation:1});
});
test('corners distinguish inside and outside by the diagonal floor',()=>{
  assert.deepEqual(wallSpriteForTile(map('sss','##s','s#s'),1,1),
    {piece:'inner_corner',rotation:0});
  assert.deepEqual(wallSpriteForTile(map('sss','##s','##s'),1,1),
    {piece:'outer_corner',rotation:0});
  assert.deepEqual(wallSpriteForTile(map('s#s','##s','sss'),1,1),
    {piece:'inner_corner',rotation:1});
  assert.deepEqual(wallSpriteForTile(map('s#s','s##','sss'),1,1),
    {piece:'inner_corner',rotation:2});
});
test('isolated walls use end caps, fully enclosed walls add no detail',()=>{
  assert.equal(wallSpriteForTile(map('sss','s#s','sss'),1,1)?.piece,'end_cap');
  assert.equal(wallSpriteForTile(map('###','###','###'),1,1),null);
  assert.equal(wallSpriteForTile(map('sss','sss','sss'),1,1),null);
});
test('left entrance in long corridor is navigable and has an arch',()=>{
  const level=levelById('lange-gang');
  assert.equal(level.tiles[1][0],'stone');
  assert.equal(level.tiles[level.start.y][level.start.x],'stone');
  assert.deepEqual(level.wallFeatures,[{type:'doorway',x:0,y:1,rotation:1}]);
  assert.equal(wallSpriteForTile(level.tiles,0,0)?.piece,'end_cap');
  assert.equal(wallSpriteForTile(level.tiles,8,0)?.piece,'inner_corner');
});
