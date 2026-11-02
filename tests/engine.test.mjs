import test from 'node:test';
import assert from 'node:assert/strict';
import { levels, initialState, executeStep } from '../src/game.ts';

function execute(level, program) {
  let state = initialState(level);
  for (let i = 0; i < 502 && !['won','failed'].includes(state.phase); i++)
    state = executeStep(level, program.map((command, id) => ({id:String(id), command})), state);
  return state;
}
test('radiomast example reaches the goal', () => {
  assert.equal(execute(levels[0], levels[0].defaults).phase, 'won');
});
test('river example reaches the goal without entering water', () => {
  assert.equal(execute(levels[1], levels[1].defaults).phase, 'won');
});
test('an incomplete program fails cleanly', () => {
  assert.equal(execute(levels[0], ['forward']).phase, 'failed');
});
test('the first dangerous step stops the robot', () => {
  const level = levels[1];
  const state = execute(level, ['forward','forward']);
  assert.equal(state.phase, 'failed');
  assert.match(state.message, /water/);
});
test('instructions after reaching the goal do not execute', () => {
  const level = levels[0];
  const state = execute(level, [...level.defaults, 'forward']);
  assert.equal(state.steps, level.defaults.length);
  assert.equal(state.phase, 'won');
});
