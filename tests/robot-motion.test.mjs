import test from 'node:test';
import assert from 'node:assert/strict';
import { shortestTurn, motionKind, motionDuration, easeMotion, poseAt, restingPose } from '../src/robot-motion.ts';

const e = (x,y,direction='E') => ({x,y,direction});

test('one-cell drive moves continuously between logical tile centres', () => {
  const from=e(1,2),to=e(2,2);
  assert.equal(motionKind(from,to),'drive');
  assert.deepEqual(restingPose(from),{x:1,y:2,angle:Math.PI/2,pulse:0});
  const at0=poseAt(from,to,0),middle=poseAt(from,to,0.5),end=poseAt(from,to,1);
  assert.equal(at0.x,1);
  assert.equal(middle.x,1.5);
  assert.equal(end.x,2);
  assert.equal(middle.y,2);
  assert.equal(middle.angle,Math.PI/2);
  assert.equal(motionDuration(from,to),540);
});

test('forward in any direction uses tile coordinates rather than screen pixels', () => {
  const from=e(3,1,'N'),to=e(3,0,'N');
  assert.equal(poseAt(from,to,0.25).x,3);
  assert.ok(poseAt(from,to,0.25).y < 1 && poseAt(from,to,0.25).y > 0);
  assert.equal(poseAt(from,to,1).y,0);
});

test('turns rotate in the shortest direction across north/west wraparound', () => {
  assert.ok(Math.abs(shortestTurn('N','W') + Math.PI/2) < 1e-9);
  assert.ok(Math.abs(shortestTurn('W','N') - Math.PI/2) < 1e-9);
  assert.ok(Math.abs(shortestTurn('E','S') - Math.PI/2) < 1e-9);
  assert.ok(Math.abs(shortestTurn('S','E') + Math.PI/2) < 1e-9);
  assert.ok(Math.abs(poseAt(e(1,1,'N'),e(1,1,'W'),0.5).angle + Math.PI/4) < 1e-9);
  assert.ok(Math.abs(poseAt(e(1,1,'W'),e(1,1,'N'),0.5).angle - 7*Math.PI/4) < 1e-9);
});

test('easing has no jump at start or end and clamps out-of-range input', () => {
  assert.equal(easeMotion(-1),0);
  assert.equal(easeMotion(0),0);
  assert.equal(easeMotion(1),1);
  assert.equal(easeMotion(2),1);
  assert.ok(easeMotion(.1) < .1);
  assert.ok(easeMotion(.9) > .9);
  assert.equal(poseAt(e(1,1),e(2,1),-1).x,1);
  assert.equal(poseAt(e(1,1),e(2,1),2).x,2);
});

test('sensor action pulses without moving or turning', () => {
  const from=e(1,1),to=e(1,1);
  assert.equal(motionKind(from,to),'sensor');
  assert.equal(poseAt(from,to,.5).pulse,1);
  assert.equal(poseAt(from,to,1).pulse,0);
  assert.equal(poseAt(from,to,.5).x,1);
  assert.equal(poseAt(from,to,.5).angle,Math.PI/2);
});

test('reduced-motion users get an instantaneous state change', () => {
  assert.equal(motionDuration(e(0,0),e(1,0),true),0);
  assert.equal(motionDuration(e(0,0,'E'),e(0,0,'N'),true),0);
});
