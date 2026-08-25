import { describe, expect, it } from 'vitest';
import {
  mapLiveIdsToSynergyInventory,
  resolveSynergiesFromArrays,
  synergyDamageMultiplier,
  synergyHpRegenPerKill,
  synergySpeedMultiplier,
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

  it('mapLiveIdsToSynergyInventory adatta id runtime kebab-case', () => {
    const mapped = mapLiveIdsToSynergyInventory({
      curseIds: ['furia-degli-sciacalli', 'fame-del-deserto'],
      weaponIds: ['khopesh'],
      graftNames: ['Amuleto dello Scarabeo'],
    });
    expect(mapped.curses).toContain('CURSE_SWARM' as CurseId);
    expect(mapped.curses).toContain('CURSE_DECAY' as CurseId);
    expect(mapped.items).toContain('WEAPON_KHOPESH' as ItemId);
    expect(mapped.items).toContain('AMULET_SCARAB' as ItemId);
  });

  it('synergyDamageMultiplier è 1 senza effetti', () => {
    expect(synergyDamageMultiplier([])).toBe(1);
  });

  it('synergySpeedMultiplier e synergyHpRegenPerKill aggregano gli effetti', () => {
    const effects = resolveSynergiesFromArrays(
      ['AMULET_SCARAB', 'ANKH_RESURRECTION'] as ItemId[],
      ['CURSE_SWARM', 'CURSE_DECAY'] as CurseId[],
    );
    expect(synergySpeedMultiplier(effects)).toBeLessThan(1);
    expect(synergyHpRegenPerKill(effects)).toBeGreaterThan(0);
  });
});
