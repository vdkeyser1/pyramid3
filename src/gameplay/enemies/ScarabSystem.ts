/**
 * Scopo: sistema dello Scarabeo di Lapislazzuli (§11.4, §44.4).
 * Ownership: simulazione gameplay.
 * Invarianti:
 *   - tell: apertura elitre 0,40 s + click direzionale;
 *   - scatto lineare, recupero 0,8 s (finestra di punizione);
 *   - max 2 cariche simultanee per gruppo;
 *   - torchAffinity +0,7: converge verso torcia posata.
 */

import type { EntityId } from '@/ecs/EntityAllocator.js';
import { secondsToTicks } from '../../content/balance.js';
import type { AttackDefinition } from '../combat/AttackDefinition.js';

export type ScarabState = 'IDLE' | 'APPROACH' | 'CHARGING_TELL' | 'CHARGING' | 'RECOVERING' | 'DEAD';

export interface ScarabRuntime {
  readonly entityId: EntityId;
  state: ScarabState;
  stateTicks: number;
  healthHp: number;
  chargeCooldownTicks: number;
}

export const SCARAB_STATS = {
  healthHp: 20,
  damageHp: 5,
  torchAffinity: 0.7,
  chargeTellTicks: secondsToTicks(0.4),
  chargeActiveTicks: secondsToTicks(0.3),
  chargeRecoveryTicks: secondsToTicks(0.8),
  maxSimultaneousCharges: 2,
  groupSizeMin: 3,
  groupSizeMax: 6,
} as const;

export const SCARAB_CHARGE: AttackDefinition = {
  id: 'scarab_charge',
  anticipationTicks: SCARAB_STATS.chargeTellTicks,
  activeTicks: SCARAB_STATS.chargeActiveTicks,
  recoveryTicks: SCARAB_STATS.chargeRecoveryTicks,
  damage: SCARAB_STATS.damageHp,
  stagger: 0.2,
  shape: { kind: 'LINE', radiusM: 0.3, lengthM: 2.0 },
  interruptibleUntilTick: secondsToTicks(0.2),
  audioCue: 'sfx_scarab_click',
  effectCue: '',
  punishWindowTicks: SCARAB_STATS.chargeRecoveryTicks,
  parryable: false,
  knockbackDirectionLocal: { x: 0, z: -1 },
  knockbackForce: 0.5,
};

export function createScarab(entityId: EntityId): ScarabRuntime {
  return {
    entityId,
    state: 'IDLE',
    stateTicks: 0,
    healthHp: SCARAB_STATS.healthHp,
    chargeCooldownTicks: 0,
  };
}

export function tickScarab(scarab: ScarabRuntime): ScarabState {
  scarab.stateTicks++;
  if (scarab.chargeCooldownTicks > 0) scarab.chargeCooldownTicks--;

  switch (scarab.state) {
    case 'CHARGING_TELL':
      if (scarab.stateTicks >= SCARAB_STATS.chargeTellTicks) {
        scarab.state = 'CHARGING';
        scarab.stateTicks = 0;
      }
      break;

    case 'CHARGING':
      if (scarab.stateTicks >= SCARAB_STATS.chargeActiveTicks) {
        scarab.state = 'RECOVERING';
        scarab.stateTicks = 0;
        scarab.chargeCooldownTicks = SCARAB_STATS.chargeRecoveryTicks;
      }
      break;

    case 'RECOVERING':
      if (scarab.stateTicks >= SCARAB_STATS.chargeRecoveryTicks) {
        scarab.state = 'IDLE';
        scarab.stateTicks = 0;
      }
      break;

    case 'IDLE':
    case 'APPROACH':
    case 'DEAD':
      break;
  }

  return scarab.state;
}

export function startCharge(scarab: ScarabRuntime): boolean {
  if (scarab.state !== 'IDLE' && scarab.state !== 'APPROACH') return false;
  if (scarab.chargeCooldownTicks > 0) return false;
  scarab.state = 'CHARGING_TELL';
  scarab.stateTicks = 0;
  return true;
}
