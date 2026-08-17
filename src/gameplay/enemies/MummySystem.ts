/**
 * Scopo: sistema della Mummia Dormiente (§11.4, §44.3).
 * Ownership: simulazione gameplay.
 * Invarianti:
 *   - risveglio 2,5 s con animazione (finestra di fuga o free-hit);
 *   - fendente con tell 1,0 s, arco 120°;
 *   - rotazione max 60°/s;
 *   - torchAffinity −0,6: arretra alla luce con cooldown;
 *   - bende infiammabili: danno fuoco ×2;
 *   - presa solo dopo permanenza adiacente.
 */

import { secondsToTicks } from '../../content/balance.js';
import type { EntityId } from '@/ecs/EntityAllocator.js';
import type { AttackDefinition } from '../combat/AttackDefinition.js';

export type MummyState = 'SLEEPING' | 'WAKING' | 'IDLE' | 'PURSUING' | 'ATTACKING' | 'RECOVERING' | 'DEAD';

export interface MummyRuntime {
  readonly entityId: EntityId;
  state: MummyState;
  stateTicks: number;
  currentRotationDeg: number;
  lightRecoilCooldownTicks: number;
  healthHp: number;
}

export const MUMMY_STATS = {
  healthHp: 60,
  damageHp: 15,
  maxRotationDegPerTick: 60 / 60, // 60°/s at 60Hz = 1°/tick
  torchAffinity: -0.6,
  wakeDurationTicks: secondsToTicks(2.5),
  lightRecoilCooldownTicks: secondsToTicks(3.0),
  fireDamageMultiplier: 2.0,
} as const;

export const MUMMY_SLASH: AttackDefinition = {
  id: 'mummy_slash',
  anticipationTicks: secondsToTicks(1.0),
  activeTicks: secondsToTicks(0.2),
  recoveryTicks: secondsToTicks(0.8),
  damage: MUMMY_STATS.damageHp,
  stagger: 0.5,
  shape: { kind: 'ARC', radiusM: 1.8, arcDeg: 120 },
  interruptibleUntilTick: secondsToTicks(0.5),
  audioCue: 'sfx_mummy_slash',
  effectCue: 'vfx_mummy_slash',
  punishWindowTicks: secondsToTicks(0.8),
  parryable: true,
  knockbackDirectionLocal: { x: 0, z: -1 },
  knockbackForce: 2.0,
};

export function createMummy(entityId: EntityId): MummyRuntime {
  return {
    entityId,
    state: 'SLEEPING',
    stateTicks: 0,
    currentRotationDeg: 0,
    lightRecoilCooldownTicks: 0,
    healthHp: MUMMY_STATS.healthHp,
  };
}

export function tickMummy(mummy: MummyRuntime): MummyState {
  mummy.stateTicks++;
  if (mummy.lightRecoilCooldownTicks > 0) mummy.lightRecoilCooldownTicks--;

  switch (mummy.state) {
    case 'WAKING':
      if (mummy.stateTicks >= MUMMY_STATS.wakeDurationTicks) {
        mummy.state = 'IDLE';
        mummy.stateTicks = 0;
      }
      break;

    case 'SLEEPING':
    case 'IDLE':
    case 'PURSUING':
    case 'ATTACKING':
    case 'RECOVERING':
    case 'DEAD':
      break;
  }

  return mummy.state;
}

export function wakeMummy(mummy: MummyRuntime): boolean {
  if (mummy.state !== 'SLEEPING') return false;
  mummy.state = 'WAKING';
  mummy.stateTicks = 0;
  return true;
}

/**
 * Rotazione limitata verso il bersaglio (cap 60°/s).
 */
export function rotateMummyToward(
  mummy: MummyRuntime,
  targetAngleDeg: number,
): void {
  const diff = targetAngleDeg - mummy.currentRotationDeg;
  const clamped = Math.max(-MUMMY_STATS.maxRotationDegPerTick, Math.min(MUMMY_STATS.maxRotationDegPerTick, diff));
  mummy.currentRotationDeg += clamped;
}

/**
 * Arretramento alla luce (torchAffinity −0,6), con cooldown.
 */
export function applyLightRecoil(mummy: MummyRuntime): boolean {
  if (mummy.lightRecoilCooldownTicks > 0) return false;
  mummy.lightRecoilCooldownTicks = MUMMY_STATS.lightRecoilCooldownTicks;
  return true;
}
