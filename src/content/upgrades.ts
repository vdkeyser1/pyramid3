/**
 * Scopo: definizioni degli innesti del vertical slice (§9.5).
 * Ownership: contenuto immutabile.
 */

import type { UpgradeDefinition } from '../gameplay/upgrades/UpgradeDefinition.js';

export type UpgradeId = string & { readonly __brand: 'UpgradeId' };

export const UPGRADE_BRONZE: UpgradeDefinition = {
  id: 'bronze_nile' as UpgradeId,
  name: 'Bronzo del Nilo',
  description: '+15% danno, −20% durabilità',
  category: 'INNESTO',
  costGold: 40,
  modifiers: [
    { stat: 'damageMultiplier', operation: 'MULTIPLY', value: 1.15 },
    { stat: 'durabilityMultiplier', operation: 'MULTIPLY', value: 0.80 },
  ],
};

export const UPGRADE_BONE: UpgradeDefinition = {
  id: 'bone_jackal' as UpgradeId,
  name: 'Osso di Sciacallo',
  description: '+20% velocità, −10% danno',
  category: 'INNESTO',
  costGold: 55,
  modifiers: [
    { stat: 'attackSpeedMultiplier', operation: 'MULTIPLY', value: 1.20 },
    { stat: 'damageMultiplier', operation: 'MULTIPLY', value: 0.90 },
  ],
};

export const UPGRADE_RESIN: UpgradeDefinition = {
  id: 'amber_resin' as UpgradeId,
  name: "Resina d'Ambra",
  description: '+50% durabilità, −10% velocità',
  category: 'INNESTO',
  costGold: 30,
  modifiers: [
    { stat: 'durabilityMultiplier', operation: 'MULTIPLY', value: 1.50 },
    { stat: 'attackSpeedMultiplier', operation: 'MULTIPLY', value: 0.90 },
  ],
};

export const UPGRADE_LAPIS: UpgradeDefinition = {
  id: 'lapis_lazuli' as UpgradeId,
  name: 'Lapislazzuli',
  description: '+5 danno contro non-morti, nessun bonus contro bestie',
  category: 'INNESTO',
  costGold: 70,
  modifiers: [
    { stat: 'bonusDamageUndead', operation: 'ADD', value: 5 },
  ],
};

export const UPGRADE_EYE_HORUS: UpgradeDefinition = {
  id: 'eye_of_horus' as UpgradeId,
  name: 'Occhio di Horus',
  description: '+30% critico da dietro, −10% danno frontale',
  category: 'INNESTO',
  costGold: 90,
  modifiers: [
    { stat: 'backCritMultiplier', operation: 'MULTIPLY', value: 1.30 },
    { stat: 'frontDamageMultiplier', operation: 'MULTIPLY', value: 0.90 },
  ],
};

/** Innesti disponibili nella fucina del vertical slice. */
export const VERTICAL_SLICE_UPGRADES: readonly UpgradeDefinition[] = [
  UPGRADE_BRONZE,
  UPGRADE_BONE,
  UPGRADE_RESIN,
];

/** Tutti gli innesti definiti. */
export const ALL_UPGRADES: readonly UpgradeDefinition[] = [
  UPGRADE_BRONZE,
  UPGRADE_BONE,
  UPGRADE_RESIN,
  UPGRADE_LAPIS,
  UPGRADE_EYE_HORUS,
];
