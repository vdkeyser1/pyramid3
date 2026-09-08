/**
 * Scopo: world ECS ibrido — SoA per componenti caldi.
 * Ownership: Simulation possiede il world.
 */

import { type EntityId, type EntityAllocator, createEntityAllocator, NULL_ENTITY } from '@/ecs/EntityAllocator.js';
import { type TransformStore, createTransformStore } from '@/ecs/components/TransformStore.js';
import { type HealthStore, createHealthStore } from '@/ecs/components/HealthStore.js';
import { type AnimationStore, createAnimationStore } from '@/ecs/components/AnimationStore.js';

export interface World {
  readonly allocator: EntityAllocator;
  readonly transform: TransformStore;
  readonly health: HealthStore;
  readonly animation: AnimationStore;
  createEntity(): EntityId;
  destroyEntity(id: EntityId): void;
  isAlive(id: EntityId): boolean;
  /** Debug overlay (v2): numero di entità attualmente allocate. */
  readonly entityCount: number;
}

export function createWorld(): World {
  const allocator = createEntityAllocator();
  const transform = createTransformStore();
  const health = createHealthStore();
  const animation = createAnimationStore();

  return {
    allocator, transform, health, animation,

    get entityCount(): number {
      return allocator.aliveCount;
    },

    createEntity(): EntityId {
      return allocator.create();
    },

    destroyEntity(id: EntityId): void {
      if (id === NULL_ENTITY) return;
      transform.remove(id);
      health.remove(id);
      animation.remove(id);
      allocator.destroy(id);
    },

    isAlive(id: EntityId): boolean {
      return allocator.isAlive(id);
    },
  };
}
