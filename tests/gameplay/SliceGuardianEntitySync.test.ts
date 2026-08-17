import { describe, expect, it } from 'vitest';
import { createWorld } from '@/ecs/World.js';
import {
  createSliceGuardianEntitySync,
} from '@/gameplay/verticalSlice/SliceGuardianEntitySync.js';
import type { SliceTargetState } from '@/gameplay/verticalSlice/VerticalSliceRuntime.js';

function createTargetState(): SliceTargetState {
  return {
    name: 'Guardiana',
    maxHp: 42,
    hp: 42,
    position: { x: 6, y: 1.05, z: -4 },
    awakened: false,
    wakeTicksRemaining: 0,
    attackCooldownTicks: 0,
    attackWindupTicks: 0,
  };
}

describe('SliceGuardianEntitySync', () => {
  it('inizializza il guardiano nel world con health e transform coerenti', () => {
    const world = createWorld();
    const target = createTargetState();

    const sync = createSliceGuardianEntitySync(world, target);

    expect(world.isAlive(sync.entityId)).toBe(true);
    expect(world.health.get(sync.entityId)).toEqual({ currentHp: 42, maxHp: 42 });
    expect(world.transform.px[sync.entityId]).toBeCloseTo(6);
    expect(world.transform.py[sync.entityId]).toBeCloseTo(1.05);
    expect(world.transform.pz[sync.entityId]).toBeCloseTo(-4);
  });

  it('propaga gli aggiornamenti runtime del target nel world ECS', () => {
    const world = createWorld();
    const target = createTargetState();
    const sync = createSliceGuardianEntitySync(world, target);

    sync.sync({
      ...target,
      hp: 17,
      position: { x: -2.5, y: 1.05, z: 11.25 },
      awakened: true,
    });

    expect(world.health.get(sync.entityId)).toEqual({ currentHp: 17, maxHp: 42 });
    expect(world.transform.px[sync.entityId]).toBeCloseTo(-2.5);
    expect(world.transform.pz[sync.entityId]).toBeCloseTo(11.25);
  });

  it('rilascia l entita quando il sync viene distrutto', () => {
    const world = createWorld();
    const sync = createSliceGuardianEntitySync(world, createTargetState());

    sync.dispose();
    sync.dispose();

    expect(world.isAlive(sync.entityId)).toBe(false);
    expect(world.health.get(sync.entityId)).toEqual({ currentHp: 0, maxHp: 0 });
    expect(world.transform.px[sync.entityId]).toBe(0);
    expect(world.transform.py[sync.entityId]).toBe(0);
    expect(world.transform.pz[sync.entityId]).toBe(0);
  });
});
