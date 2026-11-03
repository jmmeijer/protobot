import type { Level } from './game';
import {
  describeInstruction, executeProgramStep, visibleInstruction,
  type Instruction, type Program, type ProgramRunState
} from './program.ts';

export interface ExecutionFocus {
  activeId?: string;
  upcomingId?: string;
  activeLabel: string;
  upcomingLabel: string;
}
export interface InFlightStep {
  blockId: string;
  destination: ProgramRunState;
}

/** Resolve which real Blockly blocks control the robot.
 * The in-flight block stays highlighted until its Canvas animation completes.
 */
export function executionFocus(
  level: Level, program: Program | null, state: ProgramRunState,
  inFlight?: InFlightStep
): ExecutionFocus {
  let active: Instruction | undefined;
  let upcoming: Instruction | undefined;
  if (program) {
    if (inFlight) {
      active = program.instructions.find(inst => inst.blockId === inFlight.blockId && inst.op !== 'jump');
      if (inFlight.destination.phase !== 'won' && inFlight.destination.phase !== 'failed')
        upcoming = visibleInstruction(program,inFlight.destination.pc)?.instruction;
    } else if (state.phase === 'won' || state.phase === 'failed') {
      active = program.instructions.find(inst => inst.blockId === state.lastBlockId && inst.op !== 'jump');
    } else {
      active = visibleInstruction(program,state.pc)?.instruction;
      if (active) {
        const next = executeProgramStep(level,program,state);
        if (next.phase !== 'won' && next.phase !== 'failed')
          upcoming = visibleInstruction(program,next.pc)?.instruction;
      }
    }
  }
  return {
    activeId: inFlight?.blockId ?? active?.blockId,
    upcomingId: upcoming?.blockId,
    activeLabel: describeInstruction(active),
    upcomingLabel: upcoming ? describeInstruction(upcoming) : '—'
  };
}
