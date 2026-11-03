import test from 'node:test';
import assert from 'node:assert/strict';
import { levels } from '../src/game.ts';
import { executionFocus } from '../src/execution-focus.ts';
import { initialProgramState, executeProgramStep } from '../src/program.ts';

const level = levels[0];
const program = {
  instructions: [
    { op:'forward', blockId:'move-1' },
    { op:'right', blockId:'turn-1' },
    { op:'forward', blockId:'move-2' }
  ],
  totalBlocks:3, ignoredBlocks:0
};

test('the first Blockly block is active and next block is previewed', () => {
  const focus = executionFocus(level,program,initialProgramState(level));
  assert.equal(focus.activeId,'move-1');
  assert.equal(focus.upcomingId,'turn-1');
  assert.equal(focus.activeLabel,'Rij vooruit');
});

test('the in-flight block remains highlighted until the robot completes its movement', () => {
  const state = initialProgramState(level);
  const destination = executeProgramStep(level,program,state);
  const during = executionFocus(level,program,state,{blockId:'move-1',destination});
  assert.equal(during.activeId,'move-1');
  assert.equal(during.upcomingId,'turn-1');
  const after = executionFocus(level,program,destination);
  assert.equal(after.activeId,'turn-1');
  assert.equal(after.upcomingId,'move-2');
});

test('end states keep the last executed block selected, with no next block', () => {
  const state = {...initialProgramState(level),phase:'failed',lastBlockId:'move-2'};
  const focus = executionFocus(level,program,state);
  assert.equal(focus.activeId,'move-2');
  assert.equal(focus.upcomingId,undefined);
  assert.equal(focus.upcomingLabel,'—');
});

test('a failed moving instruction has no upcoming block while animation runs', () => {
  const state = initialProgramState(level);
  const failed = {...state,pc:1,phase:'failed',lastBlockId:'move-1'};
  const focus = executionFocus(level,program,state,{blockId:'move-1',destination:failed});
  assert.equal(focus.activeId,'move-1');
  assert.equal(focus.upcomingId,undefined);
});

test('conditional branches use the interpreter result, not the next array index', () => {
  const branch = {
    instructions: [
      {op:'if',blockId:'if-1',condition:{kind:'path-clear'},target:2},
      {op:'forward',blockId:'forward-branch'},
      {op:'scan',blockId:'scan-after'}
    ],
    totalBlocks:3,ignoredBlocks:0
  };
  const state = initialProgramState(level);
  const selected = executionFocus(level,branch,state);
  assert.equal(selected.activeId,'if-1');
  assert.equal(selected.upcomingId,'forward-branch');
});
