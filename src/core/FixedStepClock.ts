/**
 * Scopo: clock a passo fisso per la simulazione. Indipendente dal frame rate.
 * Ownership: GameApplication lo crea e lo passa ai sistemi.
 */

import { createLogger } from '@/core/Logger.js';

export interface FixedStepClock {
  readonly tickDurationMs: number;
  readonly currentTick: number;
  readonly simulationTimeMs: number;
  update(deltaMs: number): FixedStepUpdate;
  resetAccumulator(): void;
}

export interface FixedStepUpdate {
  readonly steps: number;
  readonly tickStart: number;
  readonly droppedSteps: number;
}

export function createFixedStepClock(
  tickHz: number,
  maxSteps = 5,
): FixedStepClock {
  const tickDurationMs = 1000 / tickHz;
  const log = createLogger('FixedStepClock');

  let currentTick = 0;
  let simulationTimeMs = 0;
  let accumulatorMs = 0;

  return {
    tickDurationMs,
    get currentTick(): number {
      return currentTick;
    },
    get simulationTimeMs(): number {
      return simulationTimeMs;
    },

    update(deltaMs: number): FixedStepUpdate {
      if (deltaMs <= 0) {
        return { steps: 0, tickStart: currentTick + 1, droppedSteps: 0 };
      }

      accumulatorMs += deltaMs;
      const pendingSteps = Math.floor(accumulatorMs / tickDurationMs);
      const steps = Math.min(pendingSteps, maxSteps);
      const droppedSteps = Math.max(0, pendingSteps - steps);

      if (droppedSteps > 0) {
        log.warn('Backlog fisso scartato per prevenire spiral of death', {
          accumulatorMs,
          maxSteps,
          pendingSteps,
          droppedSteps,
        });
      }

      const tickStart = currentTick + 1;
      for (let i = 0; i < steps; i++) {
        currentTick++;
        simulationTimeMs += tickDurationMs;
      }

      accumulatorMs -= (steps + droppedSteps) * tickDurationMs;
      return { steps, tickStart, droppedSteps };
    },

    resetAccumulator(): void {
      accumulatorMs = 0;
    },
  };
}
