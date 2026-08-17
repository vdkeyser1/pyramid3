import { describe, expect, it, vi } from 'vitest';
import type { PhysicsEnemyProxy, PhysicsWorld } from '@/physics/PhysicsWorld.js';
import { createSliceGuardianRuntime } from '@/gameplay/verticalSlice/SliceGuardianRuntime.js';

describe('createSliceGuardianRuntime', () => {
  it('sincronizza il proxy fisico e aggiorna la posizione corrente', () => {
    const setTranslation = vi.fn();
    const dispose = vi.fn();
    const hasLineOfSight = vi.fn(() => true);
    const propagateModifiedBodyPositionsToColliders = vi.fn();
    const physicsWorld = {
      createEnemyProxy: vi.fn(() => ({
        collider: {} as PhysicsEnemyProxy['collider'],
        setTranslation,
        dispose,
      })),
      propagateModifiedBodyPositionsToColliders,
      hasLineOfSight,
    } as unknown as PhysicsWorld;

    const runtime = createSliceGuardianRuntime(
      physicsWorld,
      { x: 1, y: 2, z: 3 },
      { radiusM: 0.45, heightM: 1.8 },
    );

    runtime.syncPosition({ x: 4, y: 5, z: 6 });
    runtime.hasLineOfSightTo({ x: 7, y: 8, z: 9 });

    expect(setTranslation).toHaveBeenCalledWith({ x: 4, y: 5, z: 6 });
    expect(propagateModifiedBodyPositionsToColliders).toHaveBeenCalled();
    expect(hasLineOfSight).toHaveBeenCalledWith(
      { x: 4, y: 5.35, z: 6 },
      { x: 7, y: 8.35, z: 9 },
    );

    runtime.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  });
});
