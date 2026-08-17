/**
 * Scopo: store SoA per HP correnti e massimi.
 * Ownership: il World ECS.
 */

import { MAX_ENTITIES, NULL_ENTITY, type EntityId } from '@/ecs/EntityAllocator.js';

export interface HealthData {
  readonly currentHp: number;
  readonly maxHp: number;
}

export interface HealthStore {
  readonly currentHp: Float32Array;
  readonly maxHp: Float32Array;
  get(id: EntityId): HealthData | null;
  set(id: EntityId, current: number, max: number): void;
  damage(id: EntityId, amount: number): number;
  heal(id: EntityId, amount: number): number;
  remove(id: EntityId): void;
}

function idx(id: EntityId): number {
  return id;
}

export function createHealthStore(): HealthStore {
  const currentHp = new Float32Array(MAX_ENTITIES);
  const maxHp = new Float32Array(MAX_ENTITIES);

  return {
    currentHp,
    maxHp,

    get(id: EntityId): HealthData | null {
      if (id === NULL_ENTITY) return null;
      const i = idx(id);
      return { currentHp: currentHp[i] ?? 0, maxHp: maxHp[i] ?? 0 };
    },

    set(id: EntityId, current: number, max: number): void {
      if (id === NULL_ENTITY) return;
      const i = idx(id);
      currentHp[i] = current;
      maxHp[i] = max;
    },

    damage(id: EntityId, amount: number): number {
      if (id === NULL_ENTITY) return 0;
      const i = idx(id);
      currentHp[i] = Math.max(0, (currentHp[i] ?? 0) - amount);
      return currentHp[i];
    },

    heal(id: EntityId, amount: number): number {
      if (id === NULL_ENTITY) return 0;
      const i = idx(id);
      const max = maxHp[i] ?? 0;
      currentHp[i] = Math.min(max, (currentHp[i] ?? 0) + amount);
      return currentHp[i];
    },

    remove(id: EntityId): void {
      if (id === NULL_ENTITY) return;
      const i = idx(id);
      currentHp[i] = 0;
      maxHp[i] = 0;
    },
  };
}
