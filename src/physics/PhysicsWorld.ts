/**
 * Scopo: world fisico Rapier3D incapsulato con stepping a passo fisso.
 * Ownership: Simulation (o sistema physics) lo possiede.
 *
 * Il world Rapier viene creato dopo l'inizializzazione WASM e
 * avanza a ogni tick di simulazione a 60 Hz.
 */

import RAPIER from '@dimforge/rapier3d-compat';
import { createLogger, type Logger } from '@/core/Logger.js';
import { INTERACTION_GROUPS } from '@/physics/CollisionLayers.js';
import {
  createEnemyCapsuleCollider,
  createStaticBoxCollider,
} from '@/physics/ColliderFactory.js';
import { initRapier } from '@/physics/RapierRuntime.js';

export interface PhysicsEnemyProxy {
  readonly collider: RAPIER.Collider;
  setTranslation(position: { readonly x: number; readonly y: number; readonly z: number }): void;
  /** P-01: superfici sleep/wake per PhysicsSleepBridge (duck-typed). */
  sleep(): void;
  wakeUp(): void;
  isSleeping(): boolean;
  setBodyType(type: number, wakeUp: boolean): void;
  dispose(): void;
}

export interface PhysicsKinematicBox {
  setTranslation(position: { readonly x: number; readonly y: number; readonly z: number }): void;
  dispose(): void;
}

export interface PhysicsWorld {
  readonly raw: RAPIER.World;
  /** Avanza la simulazione fisica di un passo. */
  step(): void;
  /** Crea un box statico di ambiente. */
  createStaticBox(
    position: { readonly x: number; readonly y: number; readonly z: number },
    halfExtents: { readonly x: number; readonly y: number; readonly z: number },
  ): void;
  /**
   * Sincronizza le posizioni dei collider con i rigid-body.
   * Necessario dopo aver mosso manualmente un kinematic body
   * prima di query (es. raycast).
   */
  propagateModifiedBodyPositionsToColliders(): void;
  /**
   * Restituisce true se tra due punti non esistono collider solidi di ambiente.
   * Usato dal vertical slice per evitare hit attraverso muri/porta.
   */
  hasLineOfSight(
    from: { readonly x: number; readonly y: number; readonly z: number },
    to: { readonly x: number; readonly y: number; readonly z: number },
  ): boolean;
  createEnemyProxy(
    position: { readonly x: number; readonly y: number; readonly z: number },
    radiusM: number,
    heightM: number,
  ): PhysicsEnemyProxy;
  createKinematicBox(
    position: { readonly x: number; readonly y: number; readonly z: number },
    halfExtents: { readonly x: number; readonly y: number; readonly z: number },
  ): PhysicsKinematicBox;
  /** Rilascia le risorse WASM. */
  dispose(): void;
}

/** Costanti fisiche del mondo. */
const GRAVITY_Y = -9.81; // m/s²

/**
 * Crea il mondo fisico Rapier.
 * Deve essere chiamato DOPO `initRapier()`.
 */
export async function createPhysicsWorld(): Promise<PhysicsWorld> {
  await initRapier();

  const log: Logger = createLogger('PhysicsWorld');

  const gravity = new RAPIER.Vector3(0.0, GRAVITY_Y, 0.0);
  const world = new RAPIER.World(gravity);

  // Configurazione per un FPS: timestep fisso a 60 Hz
  world.timestep = 1.0 / 60.0;
  world.numSolverIterations = 4;
  world.numInternalPgsIterations = 1;

  log.info('PhysicsWorld creato', {
    gravity: GRAVITY_Y,
    timestep: world.timestep,
  });

  let disposed = false;

  return {
    get raw(): RAPIER.World {
      return world;
    },

    step(): void {
      if (disposed) return;
      world.step();
    },

    createStaticBox(position, halfExtents): void {
      if (disposed) return;
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z),
      );
      world.createCollider(
        createStaticBoxCollider(halfExtents.x, halfExtents.y, halfExtents.z),
        body,
      );
    },

    propagateModifiedBodyPositionsToColliders(): void {
      if (disposed) return;
      world.propagateModifiedBodyPositionsToColliders();
    },

    hasLineOfSight(
      from: { readonly x: number; readonly y: number; readonly z: number },
      to: { readonly x: number; readonly y: number; readonly z: number },
    ): boolean {
      if (disposed) return false;

      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dz = to.z - from.z;
      const distance = Math.hypot(dx, dy, dz);
      if (distance <= 0.001) {
        return true;
      }

      const ray = new RAPIER.Ray(
        new RAPIER.Vector3(from.x, from.y, from.z),
        new RAPIER.Vector3(dx / distance, dy / distance, dz / distance),
      );
      const hit = world.castRay(
        ray,
        distance,
        true,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        INTERACTION_GROUPS.ENVIRONMENT,
      );
      return hit === null;
    },

    createEnemyProxy(
      position: { readonly x: number; readonly y: number; readonly z: number },
      radiusM: number,
      heightM: number,
    ): PhysicsEnemyProxy {
      const halfHeight = Math.max(0.05, (heightM - radiusM * 2) / 2);
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased()
          .setTranslation(position.x, position.y, position.z),
      );
      const collider = world.createCollider(
        createEnemyCapsuleCollider(radiusM, halfHeight),
        body,
      );
      let proxyDisposed = false;

      return {
        get collider(): RAPIER.Collider {
          return collider;
        },
        setTranslation(nextPosition: { readonly x: number; readonly y: number; readonly z: number }): void {
          if (disposed || proxyDisposed) return;
          body.setTranslation(
            new RAPIER.Vector3(nextPosition.x, nextPosition.y, nextPosition.z),
            true,
          );
        },
        sleep(): void {
          if (disposed || proxyDisposed) return;
          body.sleep();
        },
        wakeUp(): void {
          if (disposed || proxyDisposed) return;
          body.wakeUp();
        },
        isSleeping(): boolean {
          if (disposed || proxyDisposed) return true;
          return body.isSleeping();
        },
        setBodyType(type: number, wakeUpFlag: boolean): void {
          if (disposed || proxyDisposed) return;
          // Rapier RigidBodyType è un enum numerico; bridge P-01 passa number.
          body.setBodyType(type, wakeUpFlag);
        },
        dispose(): void {
          if (disposed || proxyDisposed) return;
          world.removeCollider(collider, false);
          world.removeRigidBody(body);
          proxyDisposed = true;
        },
      };
    },

    createKinematicBox(
      position: { readonly x: number; readonly y: number; readonly z: number },
      halfExtents: { readonly x: number; readonly y: number; readonly z: number },
    ): PhysicsKinematicBox {
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased()
          .setTranslation(position.x, position.y, position.z),
      );
      const collider = world.createCollider(
        createStaticBoxCollider(halfExtents.x, halfExtents.y, halfExtents.z),
        body,
      );
      let boxDisposed = false;

      return {
        setTranslation(nextPosition): void {
          if (disposed || boxDisposed) return;
          body.setNextKinematicTranslation(
            new RAPIER.Vector3(nextPosition.x, nextPosition.y, nextPosition.z),
          );
        },
        dispose(): void {
          if (disposed || boxDisposed) return;
          world.removeCollider(collider, true);
          world.removeRigidBody(body);
          boxDisposed = true;
        },
      };
    },

    dispose(): void {
      if (disposed) return;
      world.free();
      disposed = true;
      log.info('PhysicsWorld disposed');
    },
  };
}
