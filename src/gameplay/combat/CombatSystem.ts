/**
 * Scopo: orchestrazione del combattimento — fasi, hit detection, risoluzione danno (§31).
 * Ownership: simulazione. Consuma AttackDefinition, HitRegistry, DamageResolver.
 * Invarianti:
 *   - la grammatica READY → ANTICIPATION → ACTIVE → RECOVERY → READY è rispettata;
 *   - nessun danno senza fase ACTIVE verificata;
 *   - danno risolto in ordine deterministico per EntityId;
 *   - max un hit-stun forte ogni 1,2 s;
 *   - grazia di 2,0 s all'ingresso in stanza mai visitata (MIG-05).
 */

import type { AttackDefinition } from './AttackDefinition.js';
import type { EntityId } from '@/ecs/EntityAllocator.js';
import { COMBAT } from '../../content/balance.js';

// Nota: HitRegistry/DamageResolver non sono ancora consumati da questo file
// perché la hit detection reale (G-03) non è ancora collegata al loop di
// gioco. Reintrodurre gli import quando HitDetectionSystem userà queste API.

export type CombatPhase = 'READY' | 'ANTICIPATION' | 'ACTIVE' | 'RECOVERY';

export interface CombatState {
  phase: CombatPhase;
  currentAttack: AttackDefinition | null;
  phaseTick: number;
  lastHeavyStunTick: number;
}

export interface CombatEvent {
  readonly kind: 'DAMAGE' | 'STAGGER' | 'BLOCK' | 'PARRY' | 'DEATH';
  readonly attackerId: EntityId;
  readonly targetId: EntityId;
  readonly damage: number;
  readonly attackId: string;
}

export function createCombatState(): CombatState {
  return {
    phase: 'READY',
    currentAttack: null,
    phaseTick: 0,
    lastHeavyStunTick: -Infinity,
  };
}

export function startAttack(state: CombatState, attack: AttackDefinition): boolean {
  if (state.phase !== 'READY') return false;
  state.phase = 'ANTICIPATION';
  state.currentAttack = attack;
  state.phaseTick = 0;
  return true;
}

export function tickCombatState(state: CombatState, _currentTick: number): CombatPhase {
  if (state.currentAttack === null) return state.phase;

  state.phaseTick++;
  const attack = state.currentAttack;

  switch (state.phase) {
    case 'ANTICIPATION':
      if (state.phaseTick >= attack.anticipationTicks) {
        state.phase = 'ACTIVE';
        state.phaseTick = 0;
      }
      break;

    case 'ACTIVE':
      if (state.phaseTick >= attack.activeTicks) {
        state.phase = 'RECOVERY';
        state.phaseTick = 0;
      }
      break;

    case 'RECOVERY':
      if (state.phaseTick >= attack.recoveryTicks) {
        state.phase = 'READY';
        state.phaseTick = 0;
        state.currentAttack = null;
      }
      break;

    case 'READY':
      break;
  }

  return state.phase;
}

/**
 * Verifica se un colpo pesante può stunnare il giocatore,
 * rispettando il cap di 1 stun forte ogni 1,2 s (§9.2).
 */
export function canApplyHeavyStun(state: CombatState, currentTick: number): boolean {
  const minInterval = Math.round(COMBAT.maxHeavyHitStunPerSecond * 60); // ~72 ticks
  return currentTick - state.lastHeavyStunTick >= minInterval;
}

/**
 * Verifica la grazia di apertura: nei primi 2,0 s dall'ingresso
 * in una stanza mai visitata, nessun nemico può entrare in ACTIVE (MIG-05).
 */
export function isInNewRoomGrace(roomEntryTick: number, currentTick: number): boolean {
  return currentTick - roomEntryTick < COMBAT.newRoomGraceTicks;
}
