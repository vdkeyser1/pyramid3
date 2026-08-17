/**
 * Scopo: sistema FSM/stati per l'AI nemica.
 * Ownership: pura, usata dal PerceptionSystem e EnemyDecisionSystem.
 */

import type { EnemyState, EnemyArchetype } from '@/content/enemies.js';

export interface AiContext {
  readonly entityId: number;
  readonly archetype: EnemyArchetype;
  state: EnemyState;
  alertLevel: number;
  lastKnownPlayerX: number;
  lastKnownPlayerY: number;
  lastKnownPlayerZ: number;
  stateTimer: number;
  attackCooldown: number;
  pathTargetX: number;
  pathTargetZ: number;
}

export function createAiContext(entityId: number, archetype: EnemyArchetype): AiContext {
  return {
    entityId,
    archetype,
    state: 'DORMANT',
    alertLevel: 0,
    lastKnownPlayerX: 0,
    lastKnownPlayerY: 0,
    lastKnownPlayerZ: 0,
    stateTimer: 0,
    attackCooldown: 0,
    pathTargetX: 0,
    pathTargetZ: 0,
  };
}

/** Transizione di stato consentita? */
export function canTransition(from: EnemyState, to: EnemyState): boolean {
  if (from === to) return true;
  switch (from) {
    case 'DORMANT':
      return to === 'SUSPICIOUS';
    case 'SUSPICIOUS':
      return to === 'DORMANT' || to === 'ALERTED';
    case 'ALERTED':
      return to === 'ENGAGE' || to === 'SEARCH';
    case 'ENGAGE':
      return to === 'RECOVER' || to === 'DEATH';
    case 'RECOVER':
      return to === 'ENGAGE' || to === 'SEARCH' || to === 'FLEE';
    case 'SEARCH':
      return to === 'DORMANT' || to === 'ALERTED';
    case 'FLEE':
      return to === 'DORMANT' || to === 'DEATH';
    case 'DEATH':
      return false;
  }
}
