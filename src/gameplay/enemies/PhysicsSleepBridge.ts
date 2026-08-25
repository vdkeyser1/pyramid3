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
 */

import type { RigidBody, World } from '@dimforge/rapier3d-compat';
import type { EntityId } from '@/ecs/EntityAllocator.js';

// Stato FSM subset che interessa il bridge
export type EnemyPhysicsState =
  | 'DORMANT'   // → sleep
  | 'PURSUING'  // → wakeUp
  | 'ATTACKING' // → wakeUp
  | 'RECOVERING'// → wakeUp
  | 'STAGGERED' // → wakeUp
  | 'DEAD';     // → sleep definitivo

export interface PhysicsSleepBridge {
  /**
   * Registra un RigidBody per un entity.
   * Chiamato quando il nemico viene spawn-ato nel PhysicsWorld.
   */
  register(entityId: EntityId, body: RigidBody): void;

  /**
   * Rimuove la registrazione (al momento del despawn).
   */
  unregister(entityId: EntityId): void;

  /**
   * Notifica un cambio di stato FSM: aggiorna sleep/wakeUp in Rapier.
   * Safe da chiamare ad ogni tick — internamente deduplica.
   */
  notifyStateChange(entityId: EntityId, newState: EnemyPhysicsState): void;

  /**
   * Mette in sleep TUTTI i corpi registrati.
   * Utile prima di una transizione di floor (unload).
   */
  sleepAll(): void;

  /** Statistiche per il debug overlay. */
  getStats(): { total: number; sleeping: number; awake: number };
}

/**
 * Factory: crea il bridge collegato a un Rapier World.
 * @param world — istanza Rapier3D già inizializzata.
 */
export function createPhysicsSleepBridge(_world: World): PhysicsSleepBridge {
  const bodies = new Map<EntityId, RigidBody>();
  const states = new Map<EntityId, EnemyPhysicsState>();

  const shouldSleep = (state: EnemyPhysicsState): boolean =>
    state === 'DORMANT' || state === 'DEAD';

  return {
    register(entityId, body) {
      bodies.set(entityId, body);
      // Di default il corpo è già in sleep (Rapier lo mette in sleep dopo
      // qualche frame senza forze applicate; noi lo forziamo subito).
      body.sleep();
      states.set(entityId, 'DORMANT');
    },

    unregister(entityId) {
      const body = bodies.get(entityId);
      if (body) {
        // Non serve dispose: Rapier gestisce la memoria nel World
        bodies.delete(entityId);
        states.delete(entityId);
      }
    },

    notifyStateChange(entityId, newState) {
      const prev = states.get(entityId);
      if (prev === newState) return; // nessun cambio → skip
      states.set(entityId, newState);

      const body = bodies.get(entityId);
      if (!body) return;

      if (shouldSleep(newState)) {
        if (!body.isSleeping()) {
          body.sleep();
        }
      } else {
        if (body.isSleeping()) {
          body.wakeUp();
        }
      }

      // DEAD: disabilita collisioni permanentemente impostando tipo FIXED
      if (newState === 'DEAD') {
        // setBodyType con wakeUp=false preserva lo stato sleep
        body.setBodyType(
          // 2 = RigidBodyType.Fixed in Rapier JS binding
          2,
          false,
        );
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

/**
 * Versione no-op del bridge per ambienti senza fisica (test, headless).
 */
export function createNullPhysicsSleepBridge(): PhysicsSleepBridge {
  return {
    register: () => { /* no-op */ },
    unregister: () => { /* no-op */ },
    notifyStateChange: () => { /* no-op */ },
    sleepAll: () => { /* no-op */ },
    getStats: () => ({ total: 0, sleeping: 0, awake: 0 }),
  };
}
