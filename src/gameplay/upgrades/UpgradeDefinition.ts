/**
 * Scopo: definizione data-driven degli innesti e maledizioni (§9.5, §44.7).
 * Ownership: contenuto immutabile. Le istanze stanno in content/upgrades.ts.
 * Invarianti:
 *   - ogni innesto modifica almeno due dimensioni o abilita una regola nuova;
 *   - gli effetti sono mostrati prima della conferma.
 */

export type UpgradeId = string & { readonly __brand: 'UpgradeId' };

export type UpgradeCategory = 'INNESTO' | 'MALEDETTO' | 'META';

export interface StatModifier {
  readonly stat: string;
  readonly operation: 'ADD' | 'MULTIPLY';
  readonly value: number;
}

export interface UpgradeDefinition {
  readonly id: UpgradeId;
  readonly name: string;
  readonly description: string;
  readonly category: UpgradeCategory;
  readonly costGold: number;
  readonly modifiers: readonly StatModifier[];
  /** Per maledetti: la maledizione associata. */
  readonly curse?: string;
}
