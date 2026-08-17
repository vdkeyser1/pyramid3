/**
 * Scopo: ricompense bonus dello scavo (G-04 residuo, PIANO_COMPLETAMENTO A-01).
 *        Oltre ai Frammenti garantiti dal reliquiario (TREASURE_FOUND), il
 *        completamento di un sito può dropare oro, Frammenti extra o un graft
 *        raro — sempre deterministico (replay-safe, nessun Math.random).
 * Ownership: content (puro). Consumato da GameApplication al DIG_COMPLETE.
 * Invarianti:
 *   - rollDigLoot è una funzione pura: stessi input ⇒ stesso esito;
 *   - 'none' è l'esito più probabile (il tesoro base basta, il bonus è raro);
 *   - il graft è l'esito più raro e il suo nome viene dal catalogo ALL_UPGRADES;
 *   - gli importi sono positivi e scalano con il tier del nemico/piano.
 * Failure mode: catalogo graft vuoto ⇒ kind 'graft' degrada a 'fragments'.
 */

import { hash32 } from '@/procedural/Hash32.js';
import { ALL_UPGRADES } from '@/content/upgrades.js';

export type DigLootKind = 'none' | 'fragments' | 'gold' | 'graft';

export interface DigLootRoll {
  readonly kind: DigLootKind;
  /** Quantità per fragments/gold (0 per none/graft). */
  readonly amount: number;
  /** Nome del graft per kind='graft' (undefined altrimenti). */
  readonly graftName?: string;
}

/** Probabilità di base per tier (indice 0 = piano/tier 1). */
const BASE_PROBABILITY: readonly [number, number, number, number] = [0.55, 0.22, 0.16, 0.07];

/**
 * Rolla la ricompensa bonus di un sito di scavo.
 * @param floorSeed seed deterministico del piano corrente.
 * @param siteXZ coordinate intere del sito (hash stabile).
 * @param tier tier del piano (1-based; ≥1).
 */
export function rollDigLoot(floorSeed: number, siteX: number, siteZ: number, tier: number): DigLootRoll {
  const tierIndex = Math.max(0, Math.min(BASE_PROBABILITY.length - 1, tier - 1));
  const roll = hash32(floorSeed, siteX, siteZ, 0xd16) / 0x100000000;

  // CDF dei pesi: none → fragments → gold → graft.
  const [pNone, pFragments, pGold] = BASE_PROBABILITY;
  if (roll < pNone) {
    return { kind: 'none', amount: 0 };
  }
  if (roll < pNone + pFragments) {
    const amount = 3 + (hash32(floorSeed, siteX, siteZ, 0xd17) % 6) + tierIndex * 2;
    return { kind: 'fragments', amount };
  }
  if (roll < pNone + pFragments + pGold) {
    const amount = 8 + (hash32(floorSeed, siteX, siteZ, 0xd18) % 13) + tierIndex * 4;
    return { kind: 'gold', amount };
  }

  // Graft raro: se il catalogo è vuoto degrada a Frammenti.
  if (ALL_UPGRADES.length === 0) {
    return { kind: 'fragments', amount: 5 };
  }
  const index = hash32(floorSeed, siteX, siteZ, 0xd19) % ALL_UPGRADES.length;
  const graft = ALL_UPGRADES[index];
  return { kind: 'graft', amount: 0, graftName: graft?.name ?? 'Bronzo del Nilo' };
}
