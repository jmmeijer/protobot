import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOB, normalizeBlobMask, autotileLayers, makeAutotileMask, MASK_RESOLUTION } from '../src/autotile.ts';

test('canonical 8-neighbour blob autotiling yields 47 distinct masks', () => {
  assert.equal(new Set(Array.from({length:256}, (_,i) => normalizeBlobMask(i))).size, 47);
});

test('diagonal-only contacts never create a visual bridge', () => {
  const map = [['water','grass'],['grass','grass']];
  assert.deepEqual(autotileLayers(map, 1, 1), []);
  assert.equal(normalizeBlobMask(BLOB.NE), 0);
});

test('each shared border is owned by the lower-priority tile exactly once', () => {
  const map = [['grass', 'water']];
  assert.deepEqual(autotileLayers(map,0,0), [{terrain:'water',mask:BLOB.E}]);
  assert.deepEqual(autotileLayers(map,1,0), []);
  const reverse = [['water','grass']];
  assert.deepEqual(autotileLayers(reverse,0,0), []);
  assert.deepEqual(autotileLayers(reverse,1,0), [{terrain:'water',mask:BLOB.W}]);
});

test('8-way outer corners depend on diagonal support', () => {
  const withCorner = [['grass','water','water'],['grass','grass','water'],['grass','grass','grass']];
  const withoutCorner = [['grass','water','grass'],['grass','grass','water'],['grass','grass','grass']];
  assert.deepEqual(autotileLayers(withCorner,1,1),[{terrain:'water',mask:BLOB.N | BLOB.E | BLOB.NE}]);
  assert.deepEqual(autotileLayers(withoutCorner,1,1),[{terrain:'water',mask:BLOB.N | BLOB.E}]);
  const a = makeAutotileMask(BLOB.N | BLOB.E | BLOB.NE, 1, 1,'water');
  const b = makeAutotileMask(BLOB.N | BLOB.E, 1, 1,'water');
  assert.ok(a.some((v,i) => v && !b[i]));
});

test('multi-terrain boundaries layer by priority and never include base terrain', () => {
  const map = [['grass','water','dirt'], ['grass','grass','stone'],['grass','sand','grass']];
  assert.deepEqual(autotileLayers(map,1,1),[
    {terrain:'sand',mask:BLOB.S},
    {terrain:'stone',mask:BLOB.E},
    {terrain:'water',mask:BLOB.N}
  ]);
});

test('mask stays pixel-crisp, reproducible and affects the edge but not the centre', () => {
  const a = makeAutotileMask(BLOB.N,3,2,'water');
  const b = makeAutotileMask(BLOB.N,3,2,'water');
  assert.deepEqual(a,b);
  assert.equal(a.length,MASK_RESOLUTION*MASK_RESOLUTION);
  assert.ok(a.every(v=>v===0||v===1));
  assert.equal(a[0],1);
  assert.equal(a[16*MASK_RESOLUTION+16],0);
  assert.equal(a[31*MASK_RESOLUTION+16],0);
});

test('no out-of-bounds masks at the map edge', () => {
  assert.deepEqual(autotileLayers([['grass']],0,0),[]);
  assert.deepEqual(autotileLayers([['grass']],-1,0),[]);
});

test('ownership is unique for every ordered terrain pair and both border axes', () => {
  const terrains = ['grass','stone','dirt','sand','water','lava'];
  for (const a of terrains) for (const b of terrains) {
    if (a === b) continue;
    for (const grid of [[[a,b]],[[a],[b]]]) {
      const first = autotileLayers(grid,0,0);
      const second = grid.length===1 ? autotileLayers(grid,1,0) : autotileLayers(grid,0,1);
      assert.equal(first.length+second.length,1, `${a} vs ${b} painted twice on a border`);
      assert.equal((first[0] ?? second[0]).terrain, a==='lava'||b==='lava'?'lava':
        (['grass','dirt','sand','stone','water','lava'].indexOf(a)>['grass','dirt','sand','stone','water','lava'].indexOf(b)?a:b));
    }
  }
});

test('all 47 normalized topology shapes have distinguishable pixel masks', () => {
  const ids = new Set(Array.from({length:256}, (_,i) => normalizeBlobMask(i)));
  const shapes = new Set([...ids].map(mask => Buffer.from(makeAutotileMask(mask, 3,2,'water')).toString('base64')));
  assert.equal(shapes.size,47);
});
