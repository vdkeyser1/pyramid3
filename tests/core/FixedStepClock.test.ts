import { describe, expect, it } from 'vitest';
import { createFixedStepClock } from '@/core/FixedStepClock.js';

describe('FixedStepClock', () => {
  it('restituisce tick contigui anche con piu step nello stesso frame', () => {
    const clock = createFixedStepClock(60, 5);
    const step = clock.tickDurationMs;

    const firstUpdate = clock.update(step * 3 + 0.25);
    expect(firstUpdate.steps).toBe(3);
    expect(firstUpdate.tickStart).toBe(1);
    expect(firstUpdate.droppedSteps).toBe(0);
    expect(clock.currentTick).toBe(3);

    const secondUpdate = clock.update(step * 2);
    expect(secondUpdate.steps).toBe(2);
    expect(secondUpdate.tickStart).toBe(4);
    expect(secondUpdate.droppedSteps).toBe(0);
    expect(clock.currentTick).toBe(5);
  });

  it('scarta il backlog oltre maxSteps invece di rieseguirlo a cascata', () => {
    const clock = createFixedStepClock(60, 5);
    const step = clock.tickDurationMs;

    const update = clock.update(step * 8 + 0.5);
    expect(update.steps).toBe(5);
    expect(update.tickStart).toBe(1);
    expect(update.droppedSteps).toBe(3);
    expect(clock.currentTick).toBe(5);

    const nextUpdate = clock.update(step * 0.5);
    expect(nextUpdate.steps).toBe(0);
    expect(nextUpdate.droppedSteps).toBe(0);
    expect(nextUpdate.tickStart).toBe(6);
  });
});
