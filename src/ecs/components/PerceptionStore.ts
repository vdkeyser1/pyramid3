/**
 * Scopo: store SoA per la percezione nemica (vista, udito, Ka).
 * Ownership: il World ECS.
 */

import { MAX_ENTITIES, NULL_ENTITY, type EntityId } from '@/ecs/EntityAllocator.js';

export type EnemyState = 'DORMANT' | 'SUSPICIOUS' | 'ALERTED' | 'ENGAGE' | 'RECOVER' | 'SEARCH' | 'FLEE' | 'DEATH';

export interface PerceptionStore {
  readonly state: Uint8Array;
  readonly torchAffinity: Float32Array;
  readonly viewRadiusM: Float32Array;
  readonly hearRadiusM: Float32Array;
  readonly kaSenseRadiusM: Float32Array;
  getState(id: EntityId): EnemyState;
  setState(id: EntityId, state: EnemyState): void;
  remove(id: EntityId): void;
}

const STATE_MAP: Record<EnemyState, number> = {
  DORMANT: 0, SUSPICIOUS: 1, ALERTED: 2, ENGAGE: 3,
  RECOVER: 4, SEARCH: 5, FLEE: 6, DEATH: 7,
};

const STATE_REVERSE: readonly EnemyState[] = [
  'DORMANT', 'SUSPICIOUS', 'ALERTED', 'ENGAGE',
  'RECOVER', 'SEARCH', 'FLEE', 'DEATH',
];

function idx(id: EntityId): number {
  return id;
}

export function createPerceptionStore(): PerceptionStore {
  const state = new Uint8Array(MAX_ENTITIES);
  const torchAffinity = new Float32Array(MAX_ENTITIES);
  const viewRadiusM = new Float32Array(MAX_ENTITIES);
  const hearRadiusM = new Float32Array(MAX_ENTITIES);
  const kaSenseRadiusM = new Float32Array(MAX_ENTITIES);

  return {
    state, torchAffinity, viewRadiusM, hearRadiusM, kaSenseRadiusM,

    getState(id: EntityId): EnemyState {
      if (id === NULL_ENTITY) return 'DORMANT';
      const s = state[idx(id)] ?? 0;
      return STATE_REVERSE[s] ?? 'DORMANT';
    },

    setState(id: EntityId, _state: EnemyState): void {
      if (id === NULL_ENTITY) return;
      state[idx(id)] = STATE_MAP[_state];
    },

    remove(id: EntityId): void {
      if (id === NULL_ENTITY) return;
      const i = idx(id);
      state[i] = 0;
      torchAffinity[i] = 0;
      viewRadiusM[i] = 0;
      hearRadiusM[i] = 0;
      kaSenseRadiusM[i] = 0;
    },
  };
}
