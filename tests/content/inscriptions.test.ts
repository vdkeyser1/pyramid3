import { describe, expect, it } from 'vitest';
import { generateInscription } from '@/content/inscriptions.js';

describe('generateInscription (v2)', () => {
  it('è deterministico: stesso seed ⇒ stessa iscrizione', () => {
    expect(generateInscription(42)).toEqual(generateInscription(42));
  });

  it('cambia al cambio di seed', () => {
    const a = generateInscription(42);
    const b = generateInscription(777);
    expect(a.glyphs).not.toBe(b.glyphs);
    expect(a.preamble).not.toBe(b.preamble);
  });

  it('produce 12-20 glifi e un preambolo', () => {
    const inscription = generateInscription(42);
    const glyphCount = Array.from(inscription.glyphs).length;
    expect(glyphCount).toBeGreaterThanOrEqual(12);
    expect(glyphCount).toBeLessThanOrEqual(20);
    expect(inscription.preamble.length).toBeGreaterThan(5);
    expect(inscription.glyphs).toMatch(/^[\u{13000}-\u{1342F}]+$/u);
  });

  it('ritorna vuoto per seed non valido', () => {
    expect(generateInscription(-1)).toEqual({ glyphs: '', preamble: '' });
    expect(generateInscription(1.5)).toEqual({ glyphs: '', preamble: '' });
  });
});
