/**
 * P-01: Bridge tra FSM dei nemici e Rapier physics sleep/wakeUp.
 *
 * Quando un nemico è DORMANT il suo RigidBody viene messo in sleep:
 * Rapier lo esclude completamente dal solver (~60-70% riduzione carico
 * su floor con 8+ nemici dormenti).
 *
 * Ownership: GenericEncounterRuntime chiama notifyStateChange();
 *            PhysicsWorld mantiene la mappa entityId → rigidBodyHandle.
 *
 * VINCOLO ARCHITETTURALE: nessuna chiamata a performance.now() qui.
 * La simulazione gira a 60 Hz fissi (FixedStepClock) — il timestamp
 * viene dal game loop, non misurato in questo modulo.
 * Il gameplay non importa Rapier: i body sono duck-typed.
 */

import type { EntityId } from '@/ecs/EntityAllocator.js';

/** Superficie minima Rapier, senza importare la libreria (confine gameplay). */
export interface SleepableRigidBody {
  sleep(): void;
  wakeUp(): void;
  isSleeping(): boolean;
  setBodyType(type: number, wakeUp: boolean): void;
}

export type EnemyPhysicsState =
  | 'DORMANT'
  | 'PURSUING'
  | 'ATTACKING'
  | 'RECOVERING'
  | 'STAGGERED'
  | 'DEAD';

export interface PhysicsSleepBridge {
  register(entityId: EntityId, body: SleepableRigidBody): void;
  unregister(entityId: EntityId): void;
  notifyStateChange(entityId: EntityId, newState: EnemyPhysicsState): void;
  sleepAll(): void;
  getStats(): { total: number; sleeping: number; awake: number };
}

export function createPhysicsSleepBridge(): PhysicsSleepBridge {
  const bodies = new Map<EntityId, SleepableRigidBody>();
  const states = new Map<EntityId, EnemyPhysicsState>();

  const shouldSleep = (state: EnemyPhysicsState): boolean =>
    state === 'DORMANT' || state === 'DEAD';

  return {
    register(entityId, body) {
      bodies.set(entityId, body);
      body.sleep();
      states.set(entityId, 'DORMANT');
    },

    unregister(entityId) {
      if (bodies.get(entityId)) {
        bodies.delete(entityId);
        states.delete(entityId);
      }
    },

    notifyStateChange(entityId, newState) {
      const prev = states.get(entityId);
      if (prev === newState) return;
      states.set(entityId, newState);

      const body = bodies.get(entityId);
      if (!body) return;

      if (shouldSleep(newState)) {
        if (!body.isSleeping()) body.sleep();
      } else if (body.isSleeping()) {
        body.wakeUp();
      }

      if (newState === 'DEAD') {
        body.setBodyType(2, false);
      }
    },

    sleepAll() {
      for (const [id, body] of bodies) {
        if (!body.isSleeping()) body.sleep();
        states.set(id, 'DORMANT');
      }
    },

    getStats() {
      let sleeping = 0;
      let awake = 0;
      for (const body of bodies.values()) {
        if (body.isSleeping()) sleeping++;
        else awake++;
      }
      return { total: bodies.size, sleeping, awake };
    },
  };
}

export function createNullPhysicsSleepBridge(): PhysicsSleepBridge {
  return {
    register: () => {},
    unregister: () => {},
    notifyStateChange: () => {},
    sleepAll: () => {},
    getStats: () => ({ total: 0, sleeping: 0, awake: 0 }),
  };
}
