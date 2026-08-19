/**
 * Scopo: factory per la creazione di collider Rapier con pattern comuni.
 * Ownership: pura. Usata da sistemi che spawnano entità fisiche.
 *
 * Ogni helper crea un ColliderDesc preconfigurato con:
 *   - gruppi di collisione corretti
 *   - flag di collisione attiva appropriati
 *   - parametri di attrito e restituzione
 *
 * P-04 — Simplified collision shapes:
 *   I collider dei nemici usano esclusivamente capsule o sfere.
 *   Mai convex hull per entità dinamiche: costo CPU imprevedibile,
 *   collisioni instabili in corridoi stretti.
 *   Dispatcher createEnemyColliderForType() seleziona la forma ottimale
 *   in base all'archetipo nemico.
 */

import RAPIER from '@dimforge/rapier3d-compat';
import { INTERACTION_GROUPS } from '@/physics/CollisionLayers.js';

// ── Parametri fisici predefiniti ──────────────────────────────────────────────

/** Parametri fisici predefiniti per superfici comuni. */
const FRICTION = {
  PLAYER:  0.0,
  STONE:   0.8,
  WOOD:    0.5,
  SAND:    0.9,
  ENEMY:   0.0,
} as const;

const RESTITUTION = {
  NONE:    0.0,
  PLAYER:  0.0,
  STONE:   0.05,
} as const;

// ── Collider giocatore ────────────────────────────────────────────────────────

/**
 * Crea un collider capsula per il giocatore.
 * La capsula Rapier è allineata sull'asse Y, quindi halfHeight è
 * la metà dell'altezza del segmento cilindrico interno.
 *
 * @param radius     - Raggio della capsula.
 * @param halfHeight - Metà altezza del segmento (altezza totale = 2*halfHeight + 2*radius).
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

// ── Collider geometria statica ────────────────────────────────────────────────

/**
 * Crea un collider box per geometria statica (muri, pavimenti, colonne).
 *
 * @param hx - Half-width lungo X.
 * @param hy - Half-height lungo Y.
 * @param hz - Half-depth lungo Z.
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
 * @param indices  - Buffer degli indici.
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

// ── Collider nemici — P-04: solo capsule e sfere ──────────────────────────────

/**
 * Crea un collider capsula per nemici umanoidi (MUMMY, SHABTI, PRIEST, ROYAL_MUMMY).
 * La capsula gestisce bene le collisioni con scale e gradini stretti.
 *
 * @param radius     - Raggio della capsula.
 * @param halfHeight - Metà altezza del segmento.
 */
export function createEnemyCapsuleCollider(
  radius: number,
  halfHeight: number,
): RAPIER.ColliderDesc {
  return RAPIER.ColliderDesc.capsule(halfHeight, radius)
    .setCollisionGroups(INTERACTION_GROUPS.ENEMY)
    .setFriction(FRICTION.ENEMY)
    .setRestitution(RESTITUTION.NONE)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
}

/**
 * Crea un collider sfera per nemici compatti (SCARAB, COBRA, SOBEK_SPAWN).
 * La sfera è il primitivo più economico di Rapier: zero edge-case di tunnelling
 * ai frame rate bassi, costo GJK minimo.
 *
 * @param radius - Raggio della sfera.
 */
export function createEnemySphereCollider(radius: number): RAPIER.ColliderDesc {
  return RAPIER.ColliderDesc.ball(radius)
    .setCollisionGroups(INTERACTION_GROUPS.ENEMY)
    .setFriction(FRICTION.ENEMY)
    .setRestitution(RESTITUTION.NONE)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
}

/**
 * Archetipi nemico che usano collider a sfera anziché capsula.
 * Criteri: altezza < 1 m e silhouette approssimativamente tondeggiante.
 */
const SPHERE_ENEMY_TYPES: ReadonlySet<string> = new Set([
  'SCARAB',
  'COBRA',
  'SOBEK_SPAWN',
]);

/**
 * Dimensioni predefinite per ciascuna forma di collider nemico (metri).
 * Usate dal dispatcher quando il chiamante non specifica misure.
 */
const ENEMY_COLLIDER_DEFAULTS: Readonly<
  Record<string, { radius: number; halfHeight: number }>
> = {
  SCARAB:      { radius: 0.25, halfHeight: 0.10 },
  COBRA:       { radius: 0.20, halfHeight: 0.15 },
  SOBEK_SPAWN: { radius: 0.35, halfHeight: 0.15 },
  MUMMY:       { radius: 0.35, halfHeight: 0.60 },
  SHABTI:      { radius: 0.30, halfHeight: 0.55 },
  PRIEST:      { radius: 0.30, halfHeight: 0.55 },
  ROYAL_MUMMY: { radius: 0.40, halfHeight: 0.70 },
};

/** Dimensioni fallback per archetipi non in tabella. */
const DEFAULT_HUMANOID = { radius: 0.35, halfHeight: 0.60 } as const;

/**
 * Dispatcher principale — P-04.
 * Restituisce il ColliderDesc ottimale per un archetipo nemico senza mai
 * ricorrere a convex hull o trimesh dinamici.
 *
 * @param enemyType  - Archetipo del nemico (es. 'SCARAB', 'MUMMY').
 * @param radius     - Raggio override (opzionale, usa default se omesso).
 * @param halfHeight - Metà altezza override (opzionale, usa default se omesso).
 */
export function createEnemyColliderForType(
  enemyType: string,
  radius?: number,
  halfHeight?: number,
): RAPIER.ColliderDesc {
  const defaults = ENEMY_COLLIDER_DEFAULTS[enemyType] ?? DEFAULT_HUMANOID;
  const r  = radius     ?? defaults.radius;
  const hh = halfHeight ?? defaults.halfHeight;

  return SPHERE_ENEMY_TYPES.has(enemyType)
    ? createEnemySphereCollider(r)
    : createEnemyCapsuleCollider(r, hh);
}

// ── Collider sensore ──────────────────────────────────────────────────────────

/**
 * Crea un collider sensore box (nessuna collisione fisica, solo detection).
 *
 * @param hx - Half-width lungo X.
 * @param hy - Half-height lungo Y.
 * @param hz - Half-depth lungo Z.
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
export function createSensorBallCollider(radius: number): RAPIER.ColliderDesc {
  return RAPIER.ColliderDesc.ball(radius)
    .setCollisionGroups(INTERACTION_GROUPS.SENSOR)
    .setSensor(true)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
}
