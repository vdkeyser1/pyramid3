import { describe, expect, it } from 'vitest';
import {
  DIVINE_BLESSINGS,
  getAltarBlessingOfferings,
  getDivineBlessingById,
} from '@/content/DivineBlessings.js';

describe('DivineBlessings — Sistema delle Benedizioni Divine (God Boons)', () => {
  it('contiene 5 benedizioni per le 5 divinità egizie', () => {
    expect(DIVINE_BLESSINGS.length).toBe(5);

    const deities = new Set(DIVINE_BLESSINGS.map((b) => b.deity));
    expect(deities.has('RA')).toBe(true);
    expect(deities.has('ANUBIS')).toBe(true);
    expect(deities.has('OSIRIS')).toBe(true);
    expect(deities.has('THOTH')).toBe(true);
    expect(deities.has('SEKHMET')).toBe(true);
  });

  it('tutte le benedizioni hanno descrizioni, costi e modificatori validi', () => {
    for (const blessing of DIVINE_BLESSINGS) {
      expect(blessing.name.length).toBeGreaterThan(3);
      expect(blessing.description.length).toBeGreaterThan(15);
      expect(blessing.goldCost).toBeGreaterThan(0);
      expect(Object.keys(blessing.modifiers).length).toBeGreaterThan(0);
    }
  });

  it('getAltarBlessingOfferings restituisce sempre due offerte distinte e deterministiche', () => {
    const [b1, b2] = getAltarBlessingOfferings(42, 3);
    const [b1_again, b2_again] = getAltarBlessingOfferings(42, 3);

    expect(b1.id).toBe(b1_again.id);
    expect(b2.id).toBe(b2_again.id);
    expect(b1.id).not.toBe(b2.id);
  });

  it('getDivineBlessingById recupera correttamente', () => {
    const ra = getDivineBlessingById('BLESSING_RA_SOLAR_MIGHT');
    expect(ra).toBeDefined();
    expect(ra?.deity).toBe('RA');

    const missing = getDivineBlessingById('NON_ESISTE');
    expect(missing).toBeUndefined();
  });
});
