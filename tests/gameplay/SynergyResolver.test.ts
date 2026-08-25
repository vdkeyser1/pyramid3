import { describe, expect, it } from 'vitest';
import {
  resolveSynergiesFromArrays,
  validateSynergyRules,
  type ItemId,
  type CurseId,
} from '@/gameplay/upgrades/SynergyResolver.js';

describe('SynergyResolver', () => {
  it('validateSynergyRules non segnala errori sul catalogo di default', () => {
    expect(validateSynergyRules()).toEqual([]);
  });

  it('resolveSynergiesFromArrays è deterministico su input vuoti', () => {
    const a = resolveSynergiesFromArrays([] as ItemId[], [] as CurseId[]);
    const b = resolveSynergiesFromArrays([] as ItemId[], [] as CurseId[]);
    expect(a).toEqual(b);
    expect(a).toEqual([]);
  });
});
