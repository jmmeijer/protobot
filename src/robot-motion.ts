import type { Direction } from './game';

export interface RobotPosition { x: number; y: number; direction: Direction }
export interface RobotPose { x: number; y: number; angle: number; pulse: number }
export type RobotMotion = 'drive' | 'turn' | 'sensor';

const rotation: Record<Direction, number> = {
  N: 0, E: Math.PI / 2, S: Math.PI, W: Math.PI * 1.5
};

/** Angle of the shortest turn, including across the 0°/360° boundary. */
export function shortestTurn(from: Direction, to: Direction): number {
  const difference = rotation[to] - rotation[from];
  return Math.atan2(Math.sin(difference), Math.cos(difference));
}

export function motionKind(from: RobotPosition, to: RobotPosition): RobotMotion {
  if (from.x !== to.x || from.y !== to.y) return 'drive';
  if (from.direction !== to.direction) return 'turn';
  return 'sensor';
}

export function motionDuration(from: RobotPosition, to: RobotPosition, reducedMotion = false): number {
  if (reducedMotion) return 0;
  const kind = motionKind(from, to);
  return kind === 'drive' ? 540 : kind === 'turn' ? 380 : 230;
}

/** Gentle acceleration/deceleration. All positions are in logical tile units. */
export function easeMotion(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  return p * p * (3 - 2 * p);
}

export function poseAt(from: RobotPosition, to: RobotPosition, progress: number): RobotPose {
  const p = Math.max(0, Math.min(1, progress));
  const eased = easeMotion(p);
  const kind = motionKind(from, to);
  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased,
    angle: rotation[from.direction] + shortestTurn(from.direction, to.direction) * eased,
    pulse: kind === 'sensor' ? Math.sin(Math.PI * p) : 0
  };
}

export function restingPose(position: RobotPosition): RobotPose {
  return { x: position.x, y: position.y, angle: rotation[position.direction], pulse: 0 };
}
