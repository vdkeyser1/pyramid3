/**
 * Scopo: economia della run — drop oro dei nemici, conversione oro→Frammenti
 *        alla morte e ricompensa garantita a fine piano (G-10).
 * Ownership: contenuto immutabile + funzioni pure. Nessuna dipendenza da
 *        Three/Rapier/DOM: tutto deterministico e testabile.
 * Invarianti:
 *   - il drop oro è deterministico dato lo stesso valore di roll [0,1);
 *   - la conversione oro→Frammenti non supera mai il cap per run;
 *   - la ricompensa di fine piano è garantita una sola volta per floorId.
 * Failure mode: tier sconosciuto degrada al tier 1 (drop minimo).
 */

// ── Drop oro per tier (§G-10: tier1 5-15, tier2 15-40, tier3 50-100) ──

export interface GoldDropRange {
  readonly min: number;
  readonly max: number;
}

export const GOLD_DROP_RANGES: Record<1 | 2 | 3, GoldDropRange> = {
  1: { min: 5, max: 15 },
  2: { min: 15, max: 40 },
  3: { min: 50, max: 100 },
} as const;

/** Ricompensa garantita al completamento di un piano (Frammenti di Ka). */
export const FLOOR_COMPLETE_FRAGMENT_REWARD = 5;

/** Tasso di conversione oro→Frammenti alla morte (§11.1: 20%, cap 15/run). */
export const GOLD_TO_FRAGMENT_RATE = 0.2;
export const GOLD_TO_FRAGMENT_CAP = 15;

/** Normalizza un tier arbitrario a una chiave valida (sconosciuti → 1). */
function normalizeTier(tier: number): 1 | 2 | 3 {
  if (tier === 2) return 2;
  if (tier === 3) return 3;
  return 1;
}

/**
 * Tira il drop oro per un nemico di un certo tier.
 * `rollValue` deve essere in [0,1) e deterministico (derivato da seed, non da
 * Math.random) per mantenere la riproducibilità della run.
 */
export function rollGoldDrop(tier: number, rollValue: number): number {
  const range = GOLD_DROP_RANGES[normalizeTier(tier)];
  const span = range.max - range.min + 1;
  const clampedRoll = Math.min(0.999999, Math.max(0, rollValue));
  return range.min + Math.floor(clampedRoll * span);
}

/**
 * Converte l'oro accumulato in Frammenti di Ka alla morte del giocatore.
 * Arrotondamento per difetto, cap per run (§11.1 "Nota di gentilezza").
 */
export function convertGoldToFragments(goldCoins: number): number {
  if (!Number.isFinite(goldCoins) || goldCoins <= 0) {
    return 0;
  }
  return Math.min(GOLD_TO_FRAGMENT_CAP, Math.floor(goldCoins * GOLD_TO_FRAGMENT_RATE));
}

/** Intervallo del drop oro per un tier (per anteprime/test). */
export function goldDropRangeFor(tier: number): GoldDropRange {
  return GOLD_DROP_RANGES[normalizeTier(tier)];
}
