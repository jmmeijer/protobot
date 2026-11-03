import test from 'node:test';
import assert from 'node:assert/strict';
import { levels } from '../src/game.ts';
import { terrainForTile, levelTerrain } from '../src/terrain-canvas.ts';
import { autotileLayers } from '../src/autotile.ts';

test('every level terrain uses the same atlas types as Map Lab', () => {
  for (const level of levels) {
    const map = levelTerrain(level.tiles);
    assert.equal(map.length, level.tiles.length);
    assert.equal(map[0].length, level.tiles[0].length);
    assert.ok(map.flat().every(tile => ['grass','stone','dirt','sand','water','lava'].includes(tile)));
    // Every terrain pair can be rendered through the shared 8-neighbour system.
    for (let y=0; y<map.length; y++) for (let x=0; x<map[y].length; x++) {
      assert.ok(autotileLayers(map,x,y).every(layer => layer.mask > 0));
    }
  }
});

test('walls keep their collision type while using stone as the visual base', () => {
  assert.equal(terrainForTile('wall'), 'stone');
  const tiles = [['grass', 'wall', 'water']];
  assert.deepEqual(levelTerrain(tiles), [['grass','stone','water']]);
  assert.equal(tiles[0][1], 'wall');
});

test('goal and robot coordinates stay in the original logical grid', () => {
  for (const level of levels) {
    const terrain = levelTerrain(level.tiles);
    assert.equal(terrain[level.goal.y][level.goal.x], terrainForTile(level.tiles[level.goal.y][level.goal.x]));
    assert.equal(terrain[level.start.y][level.start.x], terrainForTile(level.tiles[level.start.y][level.start.x]));
  }
});

test('the river level produces higher-priority boundary masks', () => {
  const level = levels.find(level => level.id === 'rivieroever');
  assert.ok(level);
  const map = levelTerrain(level.tiles);
  const grassNextToRiver = autotileLayers(map,4,2);
  assert.ok(grassNextToRiver.some(layer => layer.terrain === 'water'));
});
