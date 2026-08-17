/**
 * Scopo: geroglifici generativi per run (v2) — sequenze deterministiche dal
 * seed del piano: "questa piramide ha una sua storia". Usa hash32 (già nel
 * progetto) senza Math.random. Ownership: contenuto. Consumato da MainMenu.
 * Invarianti:
 *   - stesso seed ⇒ stessa sequenza (riproducibile, testabile);
 *   - solo glifi del font Noto Egyptian Hieroglyphs già caricato;
 *   - mai numeri/variabili: solo stringhe di glifi pronte.
 * Failure mode: seed non valido ⇒ sequenza vuota (nessun crash).
 */

import { hash32 } from '@/procedural/Hash32.js';

/** Glifi ordinati: segni di vita, protezione, regalità, resurrezione. */
const GLYPHS = [
  '𓂀', '𓋹', '𓆣', '𓆃', '𓅓', '𓍑', '𓋴', '𓄿',
  '𓏏', '𓈖', '𓎟', '𓁹', '𓀀', '𓊪', '𓂝', '𓃭',
] as const;

/** Coppie nome-sigillo per il preambolo testuale. */
const SEALS: readonly [string, string][] = [
  ['il sigillo del Sole', '𓂀'],
  ['la mano di Anubi', '𓄿'],
  ['il respiro di Osiride', '𓋹'],
  ['lo scarabeo del mattino', '𓆣'],
  ['la bilancia del giudizio', '𓍑'],
  ['l\'occhio che veglia', '𓁹'],
  ['la piuma della verità', '𓆃'],
  ['il trono del faraone', '𓎟'],
];

export interface GeneratedInscription {
  /** Sequenza di glifi deterministica (12-20 caratteri). */
  readonly glyphs: string;
  /** Preambolo testuale egizio: "Sotto <sigillo>, la piramide sussurra…" */
  readonly preamble: string;
}

/** Genera l'iscrizione geroglifica deterministica per il seed dato. */
export function generateInscription(seed: number): GeneratedInscription {
  if (!Number.isInteger(seed) || seed < 0) {
    return { glyphs: '', preamble: '' };
  }

  const h = hash32(seed, 0x8e91);
  const h2 = hash32(seed, 0xa110);

  // 12-20 glifi, scelti deterministicamente
  const count = 12 + (h % 9);
  let glyphs = '';
  for (let i = 0; i < count; i++) {
    const index = hash32(seed, i * 31 + 7) % GLYPHS.length;
    glyphs += GLYPHS[index] ?? '𓂀';
  }

  // Sigillo dal secondo hash (0-7) — SEALS è const, mai vuoto.
  const sealEntry = SEALS[h2 % SEALS.length];
  const preamble = `Sotto ${sealEntry === undefined ? 'il sigillo del Sole' : sealEntry[0]}, la piramide sussurra…`;

  return { glyphs, preamble };
}
