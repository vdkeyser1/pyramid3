/**
 * G-32 — steering Yuka per nemici.
 *
 * Scopo: mappare EnemyState / FSM encounter su Seek/Pursuit/Wander/Flee.
 *        Sincronizza posizione Yuka ↔ world {x,y,z} ogni frame.
 * Ownership: ai/steering. Fallback no-op se yuka non è caricabile.
 */

import {
  EntityManager,
  FleeBehavior,
  PursuitBehavior,
  Vehicle,
  WanderBehavior,
} from 'yuka';

export type YukaAiState = 'DORMANT' | 'ALERTED' | 'SEARCH' | 'ENGAGE' | 'FLEE' | 'DEATH';

export interface YukaVec3 {
  x: number;
  y: number;
  z: number;
}

export interface YukaEnemyHandle {
  readonly id: number;
  setState(state: YukaAiState): void;
  setPosition(pos: YukaVec3): void;
  /** Copia la posizione Yuka nel target (mutazione in-place). */
  syncTo(target: YukaVec3): void;
}

export interface YukaEnemyAI {
  spawn(id: number, position: YukaVec3, maxSpeed: number): YukaEnemyHandle;
  setPlayerPosition(pos: YukaVec3): void;
  update(deltaSeconds: number): void;
  remove(id: number): void;
  clear(): void;
}

function runtimeToYuka(runtimeState: string): YukaAiState {
  switch (runtimeState) {
    case 'PURSUING':
    case 'ATTACKING':
    case 'ENGAGE':
      return 'ENGAGE';
    case 'ALERTED':
    case 'SUSPICIOUS':
    case 'SEARCH':
    case 'RECOVERING':
    case 'RECOVER':
      return 'SEARCH';
    case 'FLEE':
      return 'FLEE';
    case 'DEAD':
    case 'DEATH':
      return 'DEATH';
    default:
      return 'DORMANT';
  }
}

export function yukaStateFromRuntime(runtimeState: string): YukaAiState {
  return runtimeToYuka(runtimeState);
}

export function createYukaEnemyAI(): YukaEnemyAI {
  const manager = new EntityManager();
  const player = new Vehicle();
  player.maxSpeed = 6;
  manager.add(player);

  const vehicles = new Map<number, Vehicle>();
  const states = new Map<number, YukaAiState>();

  function applyBehaviors(vehicle: Vehicle, state: YukaAiState): void {
    vehicle.steering.clear();
    if (state === 'DORMANT' || state === 'DEATH') return;
    if (state === 'ENGAGE') {
      const pursuit = new PursuitBehavior(player);
      pursuit.weight = 1;
      vehicle.steering.add(pursuit);
      return;
    }
    if (state === 'FLEE') {
      const flee = new FleeBehavior(player.position);
      flee.weight = 1;
      vehicle.steering.add(flee);
      return;
    }
    const wander = new WanderBehavior();
    wander.weight = 0.8;
    vehicle.steering.add(wander);
  }

  return {
    spawn(id, position, maxSpeed) {
      const vehicle = new Vehicle();
      vehicle.position.set(position.x, position.y, position.z);
      vehicle.maxSpeed = maxSpeed;
      vehicle.maxForce = 8;
      manager.add(vehicle);
      vehicles.set(id, vehicle);
      states.set(id, 'DORMANT');

      const handle: YukaEnemyHandle = {
        id,
        setState(state) {
          if (states.get(id) === state) return;
          states.set(id, state);
          applyBehaviors(vehicle, state);
        },
        setPosition(pos) {
          vehicle.position.set(pos.x, pos.y, pos.z);
        },
        syncTo(target) {
          target.x = vehicle.position.x;
          target.y = vehicle.position.y;
          target.z = vehicle.position.z;
        },
      };
      return handle;
    },

    setPlayerPosition(pos) {
      player.position.set(pos.x, pos.y, pos.z);
    },

    update(deltaSeconds) {
      manager.update(deltaSeconds);
    },

    remove(id) {
      const vehicle = vehicles.get(id);
      if (vehicle) {
        manager.remove(vehicle);
        vehicles.delete(id);
        states.delete(id);
      }
    },

    clear() {
      for (const vehicle of vehicles.values()) {
        manager.remove(vehicle);
      }
      vehicles.clear();
      states.clear();
    },
  };
}
