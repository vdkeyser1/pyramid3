import { describe, expect, it } from 'vitest';
import {
  ANIM_STATE,
  animStateFromRuntime,
  createAnimationStore,
} from '@/ecs/components/AnimationStore.js';
import { createWorld } from '@/ecs/World.js';
import { createAnimationSystem } from '@/simulation/systems/AnimationSystem.js';

describe('AnimationStore (G-24)', () => {
  it('memorizza e legge lo stato del mixer', () => {
    const store = createAnimationStore();
    const world = createWorld();
    const id = world.createEntity();
    store.set(id, ANIM_STATE.MOVE, 1.2);
    expect(store.getState(id)).toBe('MOVE');
    expect(store.speed[id]).toBeCloseTo(1.2);
    store.remove(id);
    expect(store.occupied[id]).toBe(0);
  });

  it('mappa la FSM encounter sugli stati Mixamo', () => {
    expect(animStateFromRuntime('DORMANT')).toBe(ANIM_STATE.IDLE);
    expect(animStateFromRuntime('PURSUING')).toBe(ANIM_STATE.MOVE);
    expect(animStateFromRuntime('ATTACKING')).toBe(ANIM_STATE.ATTACK);
    expect(animStateFromRuntime('DEAD')).toBe(ANIM_STATE.DEATH);
    expect(animStateFromRuntime('FLEE')).toBe(ANIM_STATE.MOVE);
  });

  it('il sistema forza DEATH se gli HP sono a zero', () => {
    const world = createWorld();
    const id = world.createEntity();
    world.health.set(id, 0, 10);
    world.animation.set(id, ANIM_STATE.MOVE);
    const system = createAnimationSystem(world);
    system.update(1, 16);
    expect(world.animation.getState(id)).toBe('DEATH');
  });
});
