import type { EntityId } from '@/ecs/EntityAllocator.js';
import type { World } from '@/ecs/World.js';
import type { SliceTargetState } from '@/gameplay/verticalSlice/VerticalSliceRuntime.js';

export interface SliceGuardianEntitySync {
  readonly entityId: EntityId;
  sync(target: SliceTargetState): void;
  dispose(): void;
}

function applyTargetState(world: World, entityId: EntityId, target: SliceTargetState): void {
  world.transform.setPosition(entityId, target.position.x, target.position.y, target.position.z);
  world.health.set(entityId, target.hp, target.maxHp);
}

export function createSliceGuardianEntitySync(
  world: World,
  target: SliceTargetState,
): SliceGuardianEntitySync {
  const entityId = world.createEntity();
  applyTargetState(world, entityId, target);

  return {
    entityId,

    sync(nextTarget: SliceTargetState): void {
      if (!world.isAlive(entityId)) {
        return;
      }
      applyTargetState(world, entityId, nextTarget);
    },

    dispose(): void {
      if (world.isAlive(entityId)) {
        world.destroyEntity(entityId);
      }
    },
  };
}
