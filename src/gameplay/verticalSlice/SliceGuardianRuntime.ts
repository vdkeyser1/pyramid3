import type { PhysicsWorld, PhysicsEnemyProxy } from '@/physics/PhysicsWorld.js';

export interface GuardianVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface SliceGuardianRuntime {
  syncPosition(position: GuardianVector3): void;
  hasLineOfSightTo(position: GuardianVector3): boolean;
  dispose(): void;
}

export interface SliceGuardianRuntimeOptions {
  readonly radiusM: number;
  readonly heightM: number;
  readonly eyeOffsetY?: number;
}

const DEFAULT_EYE_OFFSET_Y = 0.35;

export function createSliceGuardianRuntime(
  physicsWorld: PhysicsWorld,
  initialPosition: GuardianVector3,
  options: SliceGuardianRuntimeOptions,
): SliceGuardianRuntime {
  const eyeOffsetY = options.eyeOffsetY ?? DEFAULT_EYE_OFFSET_Y;
  let currentPosition: GuardianVector3 = { ...initialPosition };
  const proxy: PhysicsEnemyProxy = physicsWorld.createEnemyProxy(
    initialPosition,
    options.radiusM,
    options.heightM,
  );

  return {
    syncPosition(position: GuardianVector3): void {
      currentPosition = { ...position };
      proxy.setTranslation(position);
      physicsWorld.propagateModifiedBodyPositionsToColliders();
    },

    hasLineOfSightTo(position: GuardianVector3): boolean {
      return physicsWorld.hasLineOfSight(
        { x: currentPosition.x, y: currentPosition.y + eyeOffsetY, z: currentPosition.z },
        { x: position.x, y: position.y + eyeOffsetY, z: position.z },
      );
    },

    dispose(): void {
      proxy.dispose();
    },
  };
}
