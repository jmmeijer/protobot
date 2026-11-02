import test from 'node:test';
import assert from 'node:assert/strict';
import { demos, transitionNeighbours, cloneMap, atlasCoordinates, terrainNames } from '../src/terrain-model.ts';

test('all atlas slots are unique and all terrain types mapped', () => {
  assert.equal(Object.keys(atlasCoordinates).length, terrainNames.length);
  assert.equal(new Set(Object.values(atlasCoordinates).map(x => x.join(','))).size, terrainNames.length);
});
test('all demo maps are rectangular and have known terrains', () => {
  for (const map of Object.values(demos)) {
    assert.ok(map.length > 0);
    assert.ok(map.every(row => row.length === map[0].length));
    assert.ok(map.flat().every(tile => terrainNames.includes(tile)));
  }
});
test('transition logic only reports different neighbouring cells', () => {
  const grid = [['grass','water','water'],['grass','grass','water'],['lava','grass','sand']];
  assert.deepEqual(transitionNeighbours(grid,1,1), {north:'water',east:'water'});
  assert.deepEqual(transitionNeighbours(grid,0,2), {north:'grass',east:'grass'});
  assert.deepEqual(transitionNeighbours(grid,0,0), {east:'water'});
});
test('prototype maps are cloned before editing', () => {
  const map = cloneMap(demos.oever);
  map[0][0] = 'lava';
  assert.equal(demos.oever[0][0],'grass');
});
