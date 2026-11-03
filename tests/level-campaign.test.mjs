import test from 'node:test';
import assert from 'node:assert/strict';
import {levels,levelById,levelVariant,variantCount,blockAllowed} from '../src/game.ts';
import {validateCampaign,validateLevel} from '../src/level-validation.ts';

test('ten unique, geometrically valid and reachable missions',()=>{
 assert.equal(levels.length,10);
 assert.deepEqual(levels.map(l=>l.number),[1,2,3,4,5,6,7,8,9,10]);
 assert.deepEqual(validateCampaign(levels),[]);
});
test('the original river ID is stable but now belongs to mission six',()=>{
 const river=levelById('rivieroever');
 assert.equal(river.number,6);
 assert.equal(variantCount(river),2);
 assert.equal(levelVariant(river,1).goal.y,2);
 assert.equal(levelVariant(river,0).id,'rivieroever');
});
test('new Blockly capabilities unlock progressively',()=>{
 assert.equal(blockAllowed(levels[0],'pb_repeat'),false);
 assert.equal(blockAllowed(levels[3],'pb_repeat'),true);
 assert.equal(blockAllowed(levels[4],'pb_if'),false);
 assert.equal(blockAllowed(levels[5],'pb_if_else'),true);
 assert.equal(blockAllowed(levels[5],'pb_terrain_under'),false);
 assert.equal(blockAllowed(levels[7],'pb_terrain_under'),true);
 assert.equal(blockAllowed(levels[8],'pb_on_goal'),false);
 assert.equal(blockAllowed(levels[9],'pb_on_goal'),true);
});
test('validator rejects blocked start, unreachable target and uneven grids',()=>{
 const base=levels[0];
 assert.ok(validateLevel({...base,start:{x:0,y:0,direction:'E'},tiles:[['wall','grass'],['wall','grass']],goal:{x:1,y:0}}).some(x=>x.includes('onveilig')));
 assert.ok(validateLevel({...base,tiles:[['grass','wall','grass'],['wall','wall','wall']],start:{x:0,y:0,direction:'E'},goal:{x:2,y:0}}).some(x=>x.includes('niet bereikbaar')));
 assert.ok(validateLevel({...base,tiles:[['grass'],['grass','grass']]}).some(x=>x.includes('ongelijk raster')));
});
