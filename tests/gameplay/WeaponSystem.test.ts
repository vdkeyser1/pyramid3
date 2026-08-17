import { describe, expect, it } from 'vitest';
import {
  createWeaponRuntime,
  consumeDurability,
  getDurabilityRatio,
  isWeaponBroken,
  type WeaponDefinition,
} from '@/gameplay/weapons/WeaponDefinition.js';
import {
  getActiveWeapon,
  switchWeapon,
  onWeaponHit,
  type WeaponSlots,
} from '@/gameplay/weapons/WeaponSystem.js';
import { COMBAT } from '@/content/balance.js';

type WeaponId = string & { readonly __brand: 'WeaponId' };

const FISTS_DEF: WeaponDefinition = {
  id: 'fists' as WeaponId,
  name: 'Mani nude',
  damageHp: 3,
  intervalTicks: 39,
  reachM: 1.1,
  durability: Infinity,
  durabilityUnit: 'HITS',
  attacks: [],
};

const KHOPESH_DEF: WeaponDefinition = {
  id: 'khopesh' as WeaponId,
  name: 'Khopesh',
  damageHp: 18,
  intervalTicks: 47,
  reachM: 1.7,
  durability: 120,
  durabilityUnit: 'HITS',
  attacks: [],
};

describe('WeaponDefinition', () => {
  it('mani nude durabilità infinita', () => {
    const rt = createWeaponRuntime(FISTS_DEF);
    consumeDurability(rt, 1, 1);
    expect(isWeaponBroken(rt)).toBe(false);
    expect(getDurabilityRatio(rt)).toBe(1);
  });

  it('khopesh si consuma', () => {
    const rt = createWeaponRuntime(KHOPESH_DEF);
    consumeDurability(rt, 1, 1);
    expect(rt.durabilityRemaining).toBe(119);
    expect(getDurabilityRatio(rt)).toBeCloseTo(119 / 120);
  });

  it('armored multiplier raddoppia consumo', () => {
    const rt = createWeaponRuntime(KHOPESH_DEF);
    consumeDurability(rt, 1, COMBAT.durabilityMultiplierArmored);
    expect(rt.durabilityRemaining).toBe(120 - 2);
  });

  it('arma rotta quando durabilità ≤ 0', () => {
    const rt = createWeaponRuntime(KHOPESH_DEF);
    rt.durabilityRemaining = 1;
    consumeDurability(rt, 1, 1);
    expect(isWeaponBroken(rt)).toBe(true);
  });
});

describe('WeaponSystem', () => {
  function makeSlots(): WeaponSlots {
    return {
      slots: [createWeaponRuntime(FISTS_DEF), createWeaponRuntime(KHOPESH_DEF)],
      activeSlotIndex: 0,
    };
  }

  it('getActiveWeapon restituisce lo slot attivo', () => {
    const slots = makeSlots();
    const activeWeapon = getActiveWeapon(slots);
    expect(activeWeapon).not.toBeNull();
    expect(activeWeapon?.definition.id).toBe('fists');
  });

  it('switchWeapon cambia slot', () => {
    const slots = makeSlots();
    const event = switchWeapon(slots, 1);
    expect(event?.kind).toBe('WEAPON_SWITCHED');
    expect(slots.activeSlotIndex).toBe(1);
  });

  it('switchWeapon sullo stesso slot → null', () => {
    const slots = makeSlots();
    expect(switchWeapon(slots, 0)).toBeNull();
  });

  it('onWeaponHit emette DURABILITY_WARNING al 20%', () => {
    const rt = createWeaponRuntime(KHOPESH_DEF);
    rt.durabilityRemaining = Math.ceil(120 * 0.2); // 24
    const event = onWeaponHit(rt, 1, 1);
    expect(event?.kind).toBe('DURABILITY_WARNING');
  });

  it('onWeaponHit emette WEAPON_BROKEN', () => {
    const rt = createWeaponRuntime(KHOPESH_DEF);
    rt.durabilityRemaining = 1;
    const event = onWeaponHit(rt, 1, 1);
    expect(event?.kind).toBe('WEAPON_BROKEN');
  });
});
