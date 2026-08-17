import { describe, expect, it } from 'vitest';
import { resolveDamage, sortTargetsDeterministically, type DamageInput } from '@/gameplay/combat/DamageResolver.js';
import { COMBAT } from '@/content/balance.js';

const BASE_INPUT: DamageInput = {
  baseDamageHp: 20,
  attackModifier: 1,
  sourceModifier: 1,
  targetArmor: 0,
  resistanceMultiplier: 1,
  isCritical: false,
  criticalMultiplier: 1,
};

describe('DamageResolver', () => {
  it('danno base senza modificatori', () => {
    const out = resolveDamage(BASE_INPUT);
    expect(out.finalDamageHp).toBe(20);
    expect(out.mitigatedHp).toBe(0);
    expect(out.appliedArmor).toBe(0);
  });

  it('armatura non supera mai armorCap (0.75)', () => {
    const out = resolveDamage({ ...BASE_INPUT, targetArmor: 0.95 });
    expect(out.appliedArmor).toBe(COMBAT.armorCap);
  });

  it('danno minimo garantito quando l\'attacco colpisce', () => {
    const out = resolveDamage({ ...BASE_INPUT, targetArmor: COMBAT.armorCap });
    expect(out.finalDamageHp).toBeGreaterThanOrEqual(COMBAT.minimumDamageHp);
  });

  it('danno zero se baseDamage è 0', () => {
    const out = resolveDamage({ ...BASE_INPUT, baseDamageHp: 0 });
    expect(out.finalDamageHp).toBe(0);
  });

  it('critico moltiplica il danno', () => {
    const normal = resolveDamage(BASE_INPUT);
    const crit = resolveDamage({ ...BASE_INPUT, isCritical: true, criticalMultiplier: 2 });
    expect(crit.finalDamageHp).toBe(normal.finalDamageHp * 2);
    expect(crit.wasCritical).toBe(true);
  });

  it('input NaN/Infinity vengono normalizzati', () => {
    const out = resolveDamage({
      ...BASE_INPUT,
      baseDamageHp: NaN,
      targetArmor: Infinity,
    });
    expect(out.finalDamageHp).toBe(0);
  });

  it('sortTargetsDeterministically ordina per entityId', () => {
    const ids = [5, 2, 9, 1, 7];
    expect(sortTargetsDeterministically(ids)).toEqual([1, 2, 5, 7, 9]);
    // Non muta l'input
    expect(ids).toEqual([5, 2, 9, 1, 7]);
  });
});
