/**
 * Scopo: applicazione degli innesti all'equipaggiamento del giocatore (§44.7).
 * Ownership: stato della run.
 * Invarianti:
 *   - un innesto può essere applicato una sola volta per arma;
 *   - anteprima numerica completa prima della conferma;
 *   - lo stacking non produce valori negativi.
 */

import type { UpgradeDefinition, StatModifier } from './UpgradeDefinition.js';

export interface AppliedUpgrade {
  readonly upgradeId: string;
  readonly appliedAtTick: number;
}

export interface UpgradePreview {
  readonly statChanges: readonly { stat: string; before: number; after: number }[];
}

/**
 * Calcola un'anteprima dell'effetto dell'innesto sui valori attuali.
 */
export function previewUpgrade(
  currentStats: Readonly<Record<string, number>>,
  upgrade: UpgradeDefinition,
): UpgradePreview {
  const changes: { stat: string; before: number; after: number }[] = [];

  for (const mod of upgrade.modifiers) {
    const before = currentStats[mod.stat] ?? 0;
    const after = applyModifier(before, mod);
    changes.push({ stat: mod.stat, before, after });
  }

  return { statChanges: changes };
}

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
 * Applica un innesto allo stato del giocatore. Restituisce i nuovi valori.
 */
export function applyUpgrade(
  currentStats: Record<string, number>,
  upgrade: UpgradeDefinition,
): Record<string, number> {
  const result = { ...currentStats };

  for (const mod of upgrade.modifiers) {
    const current = result[mod.stat] ?? 0;
    result[mod.stat] = applyModifier(current, mod);
  }

  return result;
}
