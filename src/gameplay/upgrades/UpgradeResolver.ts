/**
 * Scopo: derivazione dei modifier di combattimento dagli innesti equipaggiati
 *        (G-05 residuo). I graft (UpgradeDefinition con category 'INNESTO')
 *        modificano danno, velocità, durabilità e regole speciali (undead,
 *        crit da dietro). Questo modulo aggrega i loro StatModifier in un
 *        singolo CombatModifiers consumato dal resolver del danno.
 * Ownership: gameplay/upgrades (pura).
 * Invarianti:
 *   - MULTIPLY si compone moltiplicando (1.15 × 0.90 …);
 *   - ADD si compone sommando (bonus danno contro undead);
 *   - mai valori negativi in uscita (clamp ≥ 0);
 *   - deterministica: stessi innesti ⇒ stessi modifier.
 * Failure mode: stat sconosciuta ⇒ ignorata (zero effetto).
 */

import type { UpgradeDefinition, StatModifier } from '@/gameplay/upgrades/UpgradeDefinition.js';

export interface CombatModifiers {
  readonly damageMultiplier: number;
  readonly attackSpeedMultiplier: number;
  readonly durabilityMultiplier: number;
  readonly bonusDamageUndead: number;
  readonly backCritMultiplier: number;
  readonly frontDamageMultiplier: number;
}

export const NEUTRAL_MODIFIERS: CombatModifiers = {
  damageMultiplier: 1,
  attackSpeedMultiplier: 1,
  durabilityMultiplier: 1,
  bonusDamageUndead: 0,
  backCritMultiplier: 1,
  frontDamageMultiplier: 1,
};

/** Stats riconosciute dal resolver di combattimento. */
export type CombatStat =
  | 'damageMultiplier'
  | 'attackSpeedMultiplier'
  | 'durabilityMultiplier'
  | 'bonusDamageUndead'
  | 'backCritMultiplier'
  | 'frontDamageMultiplier';

const COMBAT_STATS: readonly CombatStat[] = [
  'damageMultiplier',
  'attackSpeedMultiplier',
  'durabilityMultiplier',
  'bonusDamageUndead',
  'backCritMultiplier',
  'frontDamageMultiplier',
];

function applyModifier(value: number, mod: StatModifier): number {
  switch (mod.operation) {
    case 'ADD':
      return value + mod.value;
    case 'MULTIPLY':
      return value * mod.value;
    default:
      return value;
  }
}

/**
 * Aggrega i modifier degli innesti equipaggiati in un singolo CombatModifiers.
 * Gli upgrade passati per nome/id (dedup per id); le stat sconosciute vengono
 * ignorate.
 */
export function resolveCombatModifiers(equippedUpgrades: readonly UpgradeDefinition[]): CombatModifiers {
  const result: Record<CombatStat, number> = { ...NEUTRAL_MODIFIERS };
  const seen = new Set<string>();

  for (const upgrade of equippedUpgrades) {
    if (seen.has(upgrade.id)) {
      continue;
    }
    seen.add(upgrade.id);
    for (const mod of upgrade.modifiers) {
      const stat = mod.stat as CombatStat;
      if (!COMBAT_STATS.includes(stat)) {
        continue;
      }
      result[stat] = applyModifier(result[stat], mod);
    }
  }

  // Clamp: nessun moltiplicatore negativo o zero (protezione anti-invalid).
  return {
    damageMultiplier: Math.max(0, result.damageMultiplier),
    attackSpeedMultiplier: Math.max(0.05, result.attackSpeedMultiplier),
    durabilityMultiplier: Math.max(0.05, result.durabilityMultiplier),
    bonusDamageUndead: Math.max(0, result.bonusDamageUndead),
    backCritMultiplier: Math.max(0, result.backCritMultiplier),
    frontDamageMultiplier: Math.max(0, result.frontDamageMultiplier),
  };
}

/**
 * Mappa i nomi degli innesti scoperti nel profilo alle definizioni complete.
 * I nomi sconosciuti vengono ignorati (profilo corrotto o versione vecchia).
 */
export function upgradesFromNames(
  names: readonly string[],
  catalog: readonly UpgradeDefinition[],
): UpgradeDefinition[] {
  const byName = new Map(catalog.map((upgrade) => [upgrade.name, upgrade] as const));
  const result: UpgradeDefinition[] = [];
  for (const name of names) {
    const upgrade = byName.get(name);
    if (upgrade) {
      result.push(upgrade);
    }
  }
  return result;
}

/**
 * Risolve il danno finale del player applicando i modifier dei graft.
 * `isBackstab` abilita backCritMultiplier; `targetIsUndead` abilita il bonus.
 */
export function resolvePlayerDamage(
  baseDamageHp: number,
  modifiers: CombatModifiers,
  options?: { readonly isBackstab?: boolean; readonly targetIsUndead?: boolean },
): number {
  let damage = baseDamageHp * modifiers.damageMultiplier;

  if (options?.targetIsUndead) {
    damage += modifiers.bonusDamageUndead;
  }

  if (options?.isBackstab) {
    damage *= modifiers.backCritMultiplier;
  } else {
    damage *= modifiers.frontDamageMultiplier;
  }

  return Math.max(0, damage);
}
