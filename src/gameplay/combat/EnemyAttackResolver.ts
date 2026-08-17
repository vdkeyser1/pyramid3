/**
 * Scopo: hit detection unificata nemico→giocatore (G-03 residuo). I runtime
 *        dei nemici (Scarab, Mummy, …) dichiarano solo shape e reach: questa
 *        risoluzione geometrica riusa il backbone di collectAttackHits con una
 *        hurtbox virtuale del giocatore (capsula), eliminando la duplicazione.
 * Ownership: gameplay/combat (pura). Consumata dal loop del gioco.
 * Invarianti:
 *   - il giocatore è una capsula (radiusM, heightM) centrata ai piedi;
 *   - le shape ARC/CONE/LINE/SPHERE si risolvono con la stessa geometria
 *     dei colpi giocatore→nemico (nessuna deriva di bilanciamento);
 *   - deterministica: stessi input ⇒ stesso esito.
 * Failure mode: shape sconosciuta ⇒ false (nessun danno).
 */

import { type EntityId } from '@/ecs/EntityAllocator.js';
import type { AttackDefinition } from '@/gameplay/combat/AttackDefinition.js';
import { collectAttackHits } from '@/gameplay/combat/AttackHitResolver.js';
import { HitRegistry } from '@/gameplay/combat/HitRegistry.js';
import { HurtboxStore, type HurtboxEntry } from '@/gameplay/combat/HurtboxStore.js';
import { PLAYER } from '@/content/balance.js';

export interface EnemyAttackPose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
}

export interface PlayerHurtbox {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface EnemyAttackQuery {
  readonly attackerId: EntityId;
  readonly attack: AttackDefinition;
  readonly attackerPose: EnemyAttackPose;
  /** Posizione del giocatore (piedi). */
  readonly player: PlayerHurtbox;
  readonly activeStartTick: number;
  readonly hitRegistry: HitRegistry;
  readonly hasLineOfSight?: () => boolean;
}

const PLAYER_HEIGHT_M = PLAYER.capsuleHeightM;
const PLAYER_RADIUS_M = PLAYER.capsuleRadiusM;

/**
 * Costruisce la hurtbox virtuale del giocatore (capsula ai piedi).
 */
export function createPlayerHurtbox(player: PlayerHurtbox, radiusM = PLAYER_RADIUS_M, heightM = PLAYER_HEIGHT_M): HurtboxEntry {
  return {
    entityId: -1 as EntityId,
    centerX: player.x,
    centerY: player.y + heightM / 2,
    centerZ: player.z,
    radiusM,
    heightM,
  };
}

/**
 * Risolve se l'attacco del nemico colpisce il giocatore. Ritorna true solo
 * alla PRIMA registrazione nello swing ACTIVE corrente (hit-once).
 */
export function resolveEnemyAttackHitsPlayer(query: EnemyAttackQuery): boolean {
  const store = new HurtboxStore();
  store.add(createPlayerHurtbox(query.player));

  const hasLineOfSight = query.hasLineOfSight;
  const hits = collectAttackHits({
    attackerId: query.attackerId,
    attack: query.attack,
    attackerPose: {
      x: query.attackerPose.x,
      y: query.attackerPose.y,
      z: query.attackerPose.z,
      yaw: query.attackerPose.yaw,
    },
    hurtboxes: store,
    activeStartTick: query.activeStartTick,
    hitRegistry: query.hitRegistry,
    ...(hasLineOfSight ? { hasLineOfSight: () => hasLineOfSight() } : {}),
  });

  return hits.length > 0;
}
