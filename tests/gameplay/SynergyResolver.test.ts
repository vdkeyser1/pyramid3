import { describe, expect, it } from 'vitest';
import {
  mapLiveIdsToSynergyInventory,
  resolveSynergiesFromArrays,
  synergyBossDamageBonus,
  synergyDamageMultiplier,
  synergyHasTrapImmunity,
  synergyHpRegenPerKill,
  synergyIFrameDelta,
  synergyLootBonus,
  synergyProjectileCount,
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

  it('synergy helpers aggregano trap/boss/proiettili/loot/i-frame', () => {
    const effects = [
      {
        kind: 'TRAP_IMMUNITY' as const,
        value: 1,
        synergyId: 't',
        displayName: '',
        description: '',
      },
      {
        kind: 'BOSS_DAMAGE_BONUS' as const,
        value: 0.25,
        synergyId: 'b',
        displayName: '',
        description: '',
      },
      {
        kind: 'PROJECTILE_COUNT' as const,
        value: 2,
        synergyId: 'p',
        displayName: '',
        description: '',
      },
      {
        kind: 'LOOT_QUANTITY_BONUS' as const,
        value: 1,
        synergyId: 'l',
        displayName: '',
        description: '',
      },
      {
        kind: 'INVINCIBILITY_FRAMES' as const,
        value: -3,
        synergyId: 'i',
        displayName: '',
        description: '',
      },
    ];
    expect(synergyHasTrapImmunity(effects)).toBe(true);
    expect(synergyBossDamageBonus(effects)).toBe(0.25);
    expect(synergyProjectileCount(effects)).toBe(2);
    expect(synergyLootBonus(effects)).toBe(1);
    expect(synergyIFrameDelta(effects)).toBe(-3);
  });
});
