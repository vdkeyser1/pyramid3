import { describe, expect, it } from 'vitest';
import { decipherWallInscription } from '@/gameplay/HieroglyphReader.js';

describe('HieroglyphReader — Decifrazione geroglifici archeologici (P18)', () => {
  it('decifra correttamente le iscrizioni generando glifi, traduzione e indizio tattico', () => {
    const result = decipherWallInscription(42, 2, 5);

    expect(result.glyphs.length).toBeGreaterThan(5);
    expect(result.sealPreamble.length).toBeGreaterThan(10);
    expect(result.translation.length).toBeGreaterThan(15);
    expect(result.tacticalClue.length).toBeGreaterThan(10);
    expect(['TRAP_HINT', 'RELIC_HINT', 'EXIT_HINT', 'BLESSING_HINT']).toContain(result.type);
  });

  it('è deterministico: stessi parametri producono la stessa traduzione', () => {
    const r1 = decipherWallInscription(999, 4, 2);
    const r2 = decipherWallInscription(999, 4, 2);

    expect(r1.glyphs).toBe(r2.glyphs);
    expect(r1.translation).toBe(r2.translation);
    expect(r1.type).toBe(r2.type);
  });
});
