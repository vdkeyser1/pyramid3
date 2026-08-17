/**
 * Scopo: definizione data-driven di un'arma (§9.4).
 * Ownership: contenuto immutabile. Le istanze stanno in content/weapons.ts.
 * Invarianti:
 *   - la durabilità della pala è misurata in scavi, non colpi;
 *   - durability = Infinity per le mani nude.
 */

import type { AttackDefinition } from '../combat/AttackDefinition.js';

export type WeaponId = string & { readonly __brand: 'WeaponId' };

export type DurabilityUnit = 'HITS' | 'DIGS';

export interface WeaponDefinition {
  readonly id: WeaponId;
  readonly name: string;
  readonly damageHp: number;
  readonly intervalTicks: number;
  readonly reachM: number;
  readonly durability: number;
  readonly durabilityUnit: DurabilityUnit;
  /** Attacchi disponibili per quest'arma. */
  readonly attacks: readonly AttackDefinition[];
}

export interface WeaponRuntime {
  readonly definition: WeaponDefinition;
  durabilityRemaining: number;
}

export function createWeaponRuntime(definition: WeaponDefinition): WeaponRuntime {
  return {
    definition,
    durabilityRemaining: definition.durability,
  };
}

export function consumeDurability(
  weapon: WeaponRuntime,
  amount: number,
  armoredMultiplier: number,
): boolean {
  if (!Number.isFinite(weapon.durabilityRemaining)) return true;
  weapon.durabilityRemaining -= amount * armoredMultiplier;
  return weapon.durabilityRemaining > 0;
}

export function getDurabilityRatio(weapon: WeaponRuntime): number {
  if (!Number.isFinite(weapon.definition.durability)) return 1;
  return weapon.durabilityRemaining / weapon.definition.durability;
}

export function isWeaponBroken(weapon: WeaponRuntime): boolean {
  return Number.isFinite(weapon.durabilityRemaining) && weapon.durabilityRemaining <= 0;
}
