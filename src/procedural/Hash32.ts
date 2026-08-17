/**
 * Scopo: hash a 32 bit stabile, indipendente dall'ordine di enumerazione e dalla
 *        piattaforma, usata per derivare i flussi RNG e i checksum discreti.
 * Invarianti:
 *   - deterministica: stessi input => stesso output su ogni browser;
 *   - nessuna dipendenza da Math.random, Date.now o dall'ordine delle chiavi;
 *   - aritmetica a 32 bit senza segno su ogni passo.
 * Failure mode: nessuno. Funzioni pure e totali.
 */

/** Mixer finale di MurmurHash3 (fmix32): distribuzione uniforme dei bit. */
export function mix32(input: number): number {
  let h = input >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** Combina più valori a 32 bit in un hash stabile e dipendente dall'ordine. */
export function hash32(...values: readonly number[]): number {
  let h = 0x811c9dc5 >>> 0; // FNV-1a offset basis
  // eslint-disable-next-line @typescript-eslint/prefer-for-of -- indexed access needed for noUncheckedIndexedAccess
  for (let i = 0; i < values.length; i++) {
    const v = (values[i] ?? 0) >>> 0;
    h = (h ^ v) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
    h = mix32(h);
  }
  return h >>> 0;
}

/** Hash stabile di una stringa (nome di canale, id di contenuto). */
export function hashString32(text: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h = (h ^ text.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return mix32(h);
}
