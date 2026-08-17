import { describe, expect, it } from 'vitest';
import {
  NEUTRAL_MODIFIERS,
  resolveCombatModifiers,
  resolvePlayerDamage,
} from '@/gameplay/upgrades/UpgradeResolver.js';
import {
  UPGRADE_BRONZE,
  UPGRADE_BONE,
  UPGRADE_LAPIS,
} from '@/content/upgrades.js';

describe('UpgradeResolver (G-05)', () => {
  it('senza innesti produce modifier neutri', () => {
    const modifiers = resolveCombatModifiers([]);

    expect(modifiers).toEqual(NEUTRAL_MODIFIERS);
    expect(resolvePlayerDamage(18, modifiers)).toBe(18);
  });

  it('Bronzo del Nilo: +15% danno, −20% durabilità', () => {
    const modifiers = resolveCombatModifiers([UPGRADE_BRONZE]);

    expect(modifiers.damageMultiplier).toBeCloseTo(1.15);
    expect(modifiers.durabilityMultiplier).toBeCloseTo(0.8);
    expect(resolvePlayerDamage(18, modifiers)).toBeCloseTo(20.7);
  });

  it('i MULTIPLY si compongono tra innesti diversi', () => {
    const modifiers = resolveCombatModifiers([UPGRADE_BRONZE, UPGRADE_BONE]);

    // 1.15 × 0.90 = 1.035
    expect(modifiers.damageMultiplier).toBeCloseTo(1.035);
    // velocità 1.20
    expect(modifiers.attackSpeedMultiplier).toBeCloseTo(1.2);
  });

  it('Lapislazzuli: bonus contro non-morti, nessun effetto su bestie', () => {
    const modifiers = resolveCombatModifiers([UPGRADE_LAPIS]);

    expect(modifiers.bonusDamageUndead).toBe(5);
    expect(resolvePlayerDamage(10, modifiers, { targetIsUndead: true })).toBe(15);
    expect(resolvePlayerDamage(10, modifiers)).toBe(10);
  });

  it('dedup: lo stesso innesto non si applica due volte', () => {
    const modifiers = resolveCombatModifiers([UPGRADE_BRONZE, UPGRADE_BRONZE]);

    expect(modifiers.damageMultiplier).toBeCloseTo(1.15);
  });

  it('clamp: nessun valore negativo o zero in uscita', () => {
    const modifiers = resolveCombatModifiers([]);
    // danno base negativo ⇒ 0
    expect(resolvePlayerDamage(-5, modifiers)).toBe(0);
  });
});
