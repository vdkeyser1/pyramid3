/**
 * G-24: AnimationComponent ECS — stato visivo del mixer per entità.
 * Ownership: World. Dati puri (niente Three.js): il renderer legge lo stato
 *        e chiama mixer.update(delta) sul proprio EnemyAnimator.
 * Invarianti:
 *   - state è uno dei valori ANIM_STATE_*;
 *   - speed è sempre ≥ 0;
 *   - remove() azzera lo slot (entity morta).
 */

import { MAX_ENTITIES, NULL_ENTITY, type EntityId } from '@/ecs/EntityAllocator.js';

export const ANIM_STATE = {
  IDLE: 0,
  MOVE: 1,
  ATTACK: 2,
  HIT: 3,
  DEATH: 4,
} as const;

export type AnimStateId = (typeof ANIM_STATE)[keyof typeof ANIM_STATE];

export type AnimStateName = 'IDLE' | 'MOVE' | 'ATTACK' | 'HIT' | 'DEATH';

const STATE_NAMES: readonly AnimStateName[] = ['IDLE', 'MOVE', 'ATTACK', 'HIT', 'DEATH'];

export interface AnimationStore {
  readonly state: Uint8Array;
  readonly speed: Float32Array;
  readonly occupied: Uint8Array;
  set(id: EntityId, state: AnimStateId, speed?: number): void;
  getState(id: EntityId): AnimStateName;
  remove(id: EntityId): void;
}

export function createAnimationStore(): AnimationStore {
  const state = new Uint8Array(MAX_ENTITIES);
  const speed = new Float32Array(MAX_ENTITIES);
  const occupied = new Uint8Array(MAX_ENTITIES);
  speed.fill(1);

  return {
    state,
    speed,
    occupied,

    set(id: EntityId, next: AnimStateId, nextSpeed = 1): void {
      if (id === NULL_ENTITY) return;
      const i = id;
      occupied[i] = 1;
      state[i] = next;
      speed[i] = Math.max(0, nextSpeed);
    },

    getState(id: EntityId): AnimStateName {
      if (id === NULL_ENTITY) return 'IDLE';
      const code = state[id] ?? 0;
      return STATE_NAMES[code] ?? 'IDLE';
    },

    remove(id: EntityId): void {
      if (id === NULL_ENTITY) return;
      const i = id;
      occupied[i] = 0;
      state[i] = ANIM_STATE.IDLE;
      speed[i] = 1;
    },
  };
}

/**
 * Mappa la FSM di encounter (o EnemyState) sullo stato del mixer Mixamo.
 */
export function animStateFromRuntime(runtimeState: string): AnimStateId {
  switch (runtimeState) {
    case 'DEAD':
    case 'DEATH':
      return ANIM_STATE.DEATH;
    case 'ATTACKING':
    case 'ENGAGE':
      return ANIM_STATE.ATTACK;
    case 'STAGGERED':
    case 'RECOVERING':
    case 'RECOVER':
      return ANIM_STATE.HIT;
    case 'PURSUING':
    case 'ALERTED':
    case 'SEARCH':
    case 'FLEE':
    case 'SUSPICIOUS':
      return ANIM_STATE.MOVE;
    default:
      return ANIM_STATE.IDLE;
  }
}
