/**
 * Scopo: tabelle loot per il tesoro scavato (§10.4).
 * Ownership: contenuto immutabile.
 * Invarianti:
 *   - il tesoro ha tre slot: valuta, scelta tra due oggetti, probabilità Ka;
 *   - i pesi sono normalizzati dal sistema, non devono sommare a 1.
 */

export interface TreasureReward {
  readonly goldMin: number;
  readonly goldMax: number;
  readonly kaFragmentChance: number;
  readonly itemPool: readonly TreasureItem[];
}

export interface TreasureItem {
  readonly id: string;
  readonly name: string;
  readonly weight: number;
  readonly kind: 'WEAPON' | 'UPGRADE' | 'CONSUMABLE';
}

export const TREASURE_TABLE_PYRAMID_1: TreasureReward = {
  goldMin: 150,
  goldMax: 300,
  kaFragmentChance: 0.05,
  itemPool: [
    { id: 'khopesh', name: 'Khopesh', weight: 3, kind: 'WEAPON' },
    { id: 'staff', name: 'Bastone', weight: 2, kind: 'WEAPON' },
    { id: 'bronze_nile', name: 'Bronzo del Nilo', weight: 3, kind: 'UPGRADE' },
    { id: 'bone_jackal', name: 'Osso di Sciacallo', weight: 2, kind: 'UPGRADE' },
    { id: 'amber_resin', name: "Resina d'Ambra", weight: 3, kind: 'UPGRADE' },
  ],
};

export const ALL_TREASURE_TABLES: readonly TreasureReward[] = [
  TREASURE_TABLE_PYRAMID_1,
];
