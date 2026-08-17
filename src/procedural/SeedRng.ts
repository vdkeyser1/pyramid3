/**
 * Scopo: sorgenti pseudocasuali deterministiche, una per canale di generazione.
 * Ownership: il FloorGenerator crea la factory e la passa alle singole fasi.
 * Invarianti CRITICHE:
 *   1. ogni canale è derivato da (rootSeed, saltDelCanale, index) e MAI dallo
 *      stato corrente di un altro canale;
 *   2. consumare N numeri in un canale non altera nessun altro canale;
 *   3. stessa coppia (seed, generationVersion) => stessa sequenza per ogni canale.
 * Failure mode: un canale non dichiarato in RNG_CHANNELS è un errore di compilazione.
 *
 * Questa implementazione sostituisce il fork() basato sullo stato corrente del
 * GDD v2, che violava l'invariante 2 (vedi MIG-11 della Master Bible v4).
 */

import { hash32, hashString32 } from '@/procedural/Hash32.js';

export const RNG_CHANNELS = [
  'topology',
  'roles',
  'encounters',
  'loot',
  'decor',
  'lighting',
] as const;

export type RngChannel = (typeof RNG_CHANNELS)[number];

export interface RandomSource {
  /** float in [0, 1). */
  next(): number;
  /** intero in [minInclusive, maxExclusive). */
  int(minInclusive: number, maxExclusive: number): number;
  /** elemento dell'array; `undefined` solo su array vuoto. */
  pick<T>(items: readonly T[]): T | undefined;
  /** copia mescolata con Fisher-Yates; non muta l'input. */
  shuffle<T>(items: readonly T[]): T[];
}

/** xorshift32: adeguato alla generazione di livelli, non crittografico. */
class XorShift32 implements RandomSource {
  private state: number;

  constructor(seed: number) {
    // Lo stato zero è assorbente per xorshift: si sostituisce con una costante.
    this.state = (seed >>> 0) === 0 ? 0x9e3779b9 : seed >>> 0;
  }

  next(): number {
    let x = this.state;
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    this.state = x;
    return x / 0x100000000;
  }

  int(minInclusive: number, maxExclusive: number): number {
    if (maxExclusive <= minInclusive) return minInclusive;
    return minInclusive + Math.floor(this.next() * (maxExclusive - minInclusive));
  }

  pick<T>(items: readonly T[]): T | undefined {
    if (items.length === 0) return undefined;
    return items[this.int(0, items.length)];
  }

  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i + 1);
      const a = out[i];
      const b = out[j];
      if (a === undefined || b === undefined) continue;
      out[i] = b;
      out[j] = a;
    }
    return out;
  }
}

export interface SeedRngFactory {
  readonly rootSeed: number;
  readonly generationVersion: number;
  forChannel(channel: RngChannel, index?: number): RandomSource;
}

export function createSeedRngFactory(
  rootSeed: number,
  generationVersion: number,
): SeedRngFactory {
  // I salt sono derivati dal NOME del canale, non dall'ordine di dichiarazione:
  // aggiungere un canale non sposta la sequenza degli altri.
  const salts = new Map<RngChannel, number>(
    RNG_CHANNELS.map((c) => [c, hashString32(c)] as const),
  );

  return {
    rootSeed: rootSeed >>> 0,
    generationVersion,
    forChannel(channel: RngChannel, index = 0): RandomSource {
      const salt = salts.get(channel) ?? hashString32(channel);
      return new XorShift32(hash32(rootSeed, generationVersion, salt, index));
    },
  };
}
