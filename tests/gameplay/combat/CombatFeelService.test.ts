import { describe, expect, it } from 'vitest';
import { CombatFeelService } from '@/gameplay/combat/CombatFeelService.js';

describe('CombatFeelService — Game Feel, Hitstop & Finisher (Fase 1)', () => {
  it('calculateHitstop calcola durate asimmetriche coerenti per arma e impatto', () => {
    const service = new CombatFeelService();

    const lightFist = service.calculateHitstop('fists', false, false, false);
    expect(lightFist.durationMs).toBe(35);

    const spearHeavy = service.calculateHitstop('spear_of_ra', true, true, false);
    expect(spearHeavy.durationMs).toBeGreaterThan(100);
    expect(spearHeavy.flashColorHex).toBeDefined();

    const parry = service.calculateHitstop('khopesh', false, false, true);
    expect(parry.durationMs).toBe(120);
    expect(parry.flashColorHex).toBe(0xffd700);
  });

  it('triggerImpactShake genera offset di roll, pitch e fov kick direzionali', () => {
    const service = new CombatFeelService();

    service.triggerImpactShake('LEFT', 1.0);
    let state = service.update(0.016);
    expect(state.rollDeg).toBeLessThan(0); // roll a sinistra
    expect(state.active).toBe(true);

    service.triggerImpactShake('THRUST', 1.5);
    state = service.update(0.016);
    expect(state.fovOffsetDeg).toBeLessThan(0); // FOV contrazione
  });

  it('registerCriticalStagger apre il prompt di esecuzione e consumeFinisher lo consuma', () => {
    const service = new CombatFeelService();

    expect(service.activeFinisher).toBeNull();
    const prompt = service.registerCriticalStagger(101, 'Shabti Guardiano', 2.0);

    expect(service.activeFinisher).not.toBeNull();
    expect(prompt.enemyId).toBe(101);
    expect(prompt.kaRestoreAmount).toBe(25);

    const consumed = service.consumeFinisher();
    expect(consumed?.enemyId).toBe(101);
    expect(service.activeFinisher).toBeNull();
  });
});
