/**
 * Scopo: factory per la creazione di collider Rapier con pattern comuni.
 * Ownership: pura. Usata da sistemi che spawnano entità fisiche.
 *
 * Ogni helper crea un ColliderDesc preconfigurato con:
 *   - gruppi di collisione corretti
 *   - flag di collisione attiva appropriati
 *   - parametri di attrito e restituzione
 */

import RAPIER from '@dimforge/rapier3d-compat';
import { INTERACTION_GROUPS } from '@/physics/CollisionLayers.js';

/** Parametri fisici predefiniti per superfici comuni. */
const FRICTION = {
  PLAYER: 0.0,
  STONE: 0.8,
  WOOD: 0.5,
  SAND: 0.9,
} as const;

const RESTITUTION = {
  NONE: 0.0,
  PLAYER: 0.0,
  STONE: 0.05,
} as const;

/**
 * Crea un collider capsula per il giocatore.
 * La capsula Rapier è allineata sull'asse Y, quindi halfHeight è
 * la metà dell'altezza del segmento cilindrico interno.
 *
 * @param radius - Raggio della capsula.
 * @param halfHeight - Metà altezza del segmento (altezza totale = capsuleHeight - 2*radius).
 */
export function createPlayerCapsuleCollider(
  radius: number,
  halfHeight: number,
): RAPIER.ColliderDesc {
  return RAPIER.ColliderDesc.capsule(halfHeight, radius)
    .setCollisionGroups(INTERACTION_GROUPS.PLAYER)
    .setActiveCollisionTypes(
      RAPIER.ActiveCollisionTypes.DEFAULT |
      RAPIER.ActiveCollisionTypes.KINEMATIC_FIXED,
    )
    .setFriction(FRICTION.PLAYER)
    .setRestitution(RESTITUTION.PLAYER)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
}

/**
 * Crea un collider box per geometria statica (muri, pavimenti, colonne).
 *
 * @param hx - Half-width lungo X.
 * @param hy - Half-width lungo Y.
 * @param hz - Half-width lungo Z.
 */
export function createStaticBoxCollider(
  hx: number,
  hy: number,
  hz: number,
): RAPIER.ColliderDesc {
  return RAPIER.ColliderDesc.cuboid(hx, hy, hz)
    .setCollisionGroups(INTERACTION_GROUPS.ENVIRONMENT)
    .setFriction(FRICTION.STONE)
    .setRestitution(RESTITUTION.STONE);
}

/**
 * Crea un collider mesh statico da vertici e indici.
 * Perfetto per geometria procedurale complessa (stanze, corridoi).
 *
 * @param vertices - Buffer dei vertici.
 * @param indices - Buffer degli indici.
 */
export function createStaticTrimeshCollider(
  vertices: Float32Array,
  indices: Uint32Array,
): RAPIER.ColliderDesc {
  return RAPIER.ColliderDesc.trimesh(vertices, indices)
    .setCollisionGroups(INTERACTION_GROUPS.ENVIRONMENT)
    .setFriction(FRICTION.STONE)
    .setRestitution(RESTITUTION.STONE);
}

/**
 * Crea un collider capsula per un nemico.
 *
 * @param radius - Raggio della capsula.
 * @param halfHeight - Metà altezza del segmento.
 */
export function createEnemyCapsuleCollider(
  radius: number,
  halfHeight: number,
): RAPIER.ColliderDesc {
  return RAPIER.ColliderDesc.capsule(halfHeight, radius)
    .setCollisionGroups(INTERACTION_GROUPS.ENEMY)
    .setFriction(FRICTION.PLAYER)
    .setRestitution(RESTITUTION.NONE)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
}

/**
 * Crea un collider sensore (nessuna collisione fisica, solo detection).
 *
 * @param hx - Half-width lungo X.
 * @param hy - Half-width lungo Y.
 * @param hz - Half-width lungo Z.
 */
export function createSensorBoxCollider(
  hx: number,
  hy: number,
  hz: number,
): RAPIER.ColliderDesc {
  return RAPIER.ColliderDesc.cuboid(hx, hy, hz)
    .setCollisionGroups(INTERACTION_GROUPS.SENSOR)
    .setSensor(true)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
}

/**
 * Crea un collider sensore a sfera.
 *
 * @param radius - Raggio della sfera sensore.
 */
export function createSensorBallCollider(
  radius: number,
): RAPIER.ColliderDesc {
  return RAPIER.ColliderDesc.ball(radius)
    .setCollisionGroups(INTERACTION_GROUPS.SENSOR)
    .setSensor(true)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
}
