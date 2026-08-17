/**
 * Scopo: sistema di decisione dei nemici basato su utility score (§30, §11.1).
 * Ownership: simulazione AI. Nessuna dipendenza da rendering o DOM.
 * Invarianti:
 *   - utility scorer limitato, non GOAP generale;
 *   - decisioni a 5-10 Hz distribuite in bucket per EntityId;
 *   - nessun nemico `UNKNOWN` nel ledger può entrare in ENGAGE.
 */

import type { EntityId } from '@/ecs/EntityAllocator.js';

export type EnemyBehaviorState =
  | 'DORMANT' | 'SUSPICIOUS' | 'ALERTED'
  | 'ENGAGE' | 'RECOVER' | 'SEARCH'
  | 'FLEE' | 'DEATH';

export type EnemyAction =
  | 'IDLE' | 'PATROL' | 'INVESTIGATE'
  | 'ATTACK_LIGHT' | 'ATTACK_HEAVY' | 'RETREAT'
  | 'CIRCLE_STRAFE' | 'FLEE_TO_COVER';

export interface EnemyDecisionInput {
  readonly entityId: EntityId;
  readonly currentState: EnemyBehaviorState;
  readonly healthRatio: number;
  readonly distanceToPlayer: number;
  readonly playerVisible: boolean;
  readonly playerNoiseLevel: number;
  readonly torchAffinity: number;
  readonly playerTorchLit: boolean;
  readonly alliesNearby: number;
  readonly ticksSinceLastDamage: number;
}

export interface UtilityScore {
  readonly action: EnemyAction;
  readonly score: number;
}

/**
 * Calcola gli utility score per ogni azione disponibile.
 * Restituisce l'azione con lo score più alto.
 */
export function decideAction(input: EnemyDecisionInput): EnemyAction {
  const scores: UtilityScore[] = [];

  if (input.currentState === 'DORMANT') return 'IDLE';
  if (input.currentState === 'DEATH') return 'IDLE';

  // Fuga se salute molto bassa
  if (input.healthRatio < 0.15) {
    scores.push({ action: 'FLEE_TO_COVER', score: 0.9 });
  }

  // Attacco se vicino e visibile
  if (input.playerVisible && input.distanceToPlayer < 3.0) {
    scores.push({ action: 'ATTACK_LIGHT', score: 0.7 + (1 - input.distanceToPlayer / 3.0) * 0.2 });
    if (input.alliesNearby >= 1) {
      scores.push({ action: 'ATTACK_HEAVY', score: 0.6 });
    }
  }

  // Circondamento se distanza media
  if (input.playerVisible && input.distanceToPlayer >= 3.0 && input.distanceToPlayer < 8.0) {
    scores.push({ action: 'CIRCLE_STRAFE', score: 0.5 });
  }

  // Ritirata se troppo pochi alleati e salute bassa
  if (input.healthRatio < 0.4 && input.alliesNearby === 0) {
    scores.push({ action: 'RETREAT', score: 0.6 });
  }

  // Indagine su rumore
  if (!input.playerVisible && input.playerNoiseLevel > 0.5) {
    scores.push({ action: 'INVESTIGATE', score: 0.4 + input.playerNoiseLevel * 0.3 });
  }

  // Pattuglia come default
  scores.push({ action: 'PATROL', score: 0.1 });
  scores.push({ action: 'IDLE', score: 0.05 });

  // Affinità torcia
  if (input.playerTorchLit && input.torchAffinity > 0) {
    // Attratto verso la luce
    scores.push({ action: 'INVESTIGATE', score: 0.3 + input.torchAffinity * 0.4 });
  }

  let best: UtilityScore = { action: 'IDLE', score: 0 };
  for (const s of scores) {
    if (s.score > best.score) best = s;
  }

  return best.action;
}

/**
 * Determina se il nemico è nel bucket di tick corrente per la decisione.
 * Distribuzione stabile per EntityId per evitare spike.
 */
export function shouldDecideThisTick(
  entityId: EntityId,
  currentTick: number,
  decisionIntervalTicks: number,
): boolean {
  return (currentTick + (entityId as number)) % decisionIntervalTicks === 0;
}
