import { describe, expect, it } from 'vitest';
import { WeaponSlotManager } from '@/gameplay/weapons/WeaponSlotManager.js';
import type { WeaponDefinition } from '@/gameplay/weapons/WeaponDefinition.js';
import { COMBAT } from '@/content/balance.js';

type WeaponId = string & { readonly __brand: 'WeaponId' };

const FISTS: WeaponDefinition = {
  id: 'fists' as WeaponId,
  name: 'Mani nude',
  damageHp: 3,
  intervalTicks: 39,
  reachM: 1.1,
  durability: Infinity,
  durabilityUnit: 'HITS',
  attacks: [],
};

const KHOPESH: WeaponDefinition = {
  id: 'khopesh' as WeaponId,
  name: 'Khopesh',
  damageHp: 18,
  intervalTicks: 47,
  reachM: 1.7,
  durability: 120,
  durabilityUnit: 'HITS',
  attacks: [],
};

const STAFF: WeaponDefinition = {
  id: 'staff' as WeaponId,
  name: 'Bastone di Ra',
  damageHp: 12,
  intervalTicks: 55,
  reachM: 2.2,
  durability: 80,
  durabilityUnit: 'HITS',
  attacks: [],
};

describe('WeaponSlotManager (G-06)', () => {
  it('slot vuoti all\'inizio', () => {
    const mgr = new WeaponSlotManager();
    expect(mgr.activeWeapon).toBeNull();
    expect(mgr.getWeaponInSlot('PRIMARY')).toBeNull();
    expect(mgr.getWeaponInSlot('SECONDARY')).toBeNull();
  });

  it('equip + activeWeapon', () => {
    const mgr = new WeaponSlotManager();
    mgr.equip('PRIMARY', KHOPESH);
    expect(mgr.activeWeapon?.definition.id).toBe('khopesh');
    expect(mgr.activeSlot).toBe('PRIMARY');
  });

  it('swapWeapons cambia slot attivo', () => {
    const mgr = new WeaponSlotManager();
    mgr.equip('PRIMARY', KHOPESH);
    mgr.equip('SECONDARY', STAFF);
    const swapped = mgr.swapWeapons();
    expect(swapped).toBe(true);
    expect(mgr.activeSlot).toBe('SECONDARY');
    expect(mgr.activeWeapon?.definition.id).toBe('staff');
  });

  it('swapWeapons → noop se cooldown non esaurito', () => {
    const mgr = new WeaponSlotManager();
    mgr.equip('PRIMARY', KHOPESH);
    mgr.equip('SECONDARY', STAFF);
    mgr.swapWeapons();
    const secondSwap = mgr.swapWeapons();
    expect(secondSwap).toBe(false);
    expect(mgr.activeSlot).toBe('SECONDARY');
  });

  it('step() decrementa cooldown e permette swap successivo', () => {
    const mgr = new WeaponSlotManager();
    mgr.equip('PRIMARY', KHOPESH);
    mgr.equip('SECONDARY', STAFF);
    mgr.swapWeapons();
    expect(mgr.canSwap).toBe(false);
    // Il cooldown deriva da balance.ts: non hardcodare il numero di tick.
    for (let i = 0; i < COMBAT.weaponSwapCooldownTicks; i++) mgr.step();
    expect(mgr.canSwap).toBe(true);
    expect(mgr.swapWeapons()).toBe(true);
  });

  it('swapWeapons → noop se slot target è vuoto', () => {
    const mgr = new WeaponSlotManager();
    mgr.equip('PRIMARY', KHOPESH);
    const swapped = mgr.swapWeapons();
    expect(swapped).toBe(false);
    expect(mgr.activeSlot).toBe('PRIMARY');
  });

  it('forceEmpty permette swap verso slot vuoto', () => {
    const mgr = new WeaponSlotManager();
    mgr.equip('PRIMARY', KHOPESH);
    const swapped = mgr.swapWeapons(true);
    expect(swapped).toBe(true);
    expect(mgr.activeSlot).toBe('SECONDARY');
    expect(mgr.activeWeapon).toBeNull();
  });

  it('setActiveSlot bypassa cooldown', () => {
    const mgr = new WeaponSlotManager();
    mgr.equip('PRIMARY', KHOPESH);
    mgr.equip('SECONDARY', STAFF);
    mgr.swapWeapons();
    mgr.setActiveSlot('PRIMARY');
    expect(mgr.activeSlot).toBe('PRIMARY');
    expect(mgr.canSwap).toBe(true);
  });

  it('snapshot restituisce stato completo', () => {
    const mgr = new WeaponSlotManager();
    mgr.equip('PRIMARY', KHOPESH);
    mgr.equip('SECONDARY', STAFF);
    const snap = mgr.snapshot();
    expect(snap.activeSlot).toBe('PRIMARY');
    expect(snap.primary?.id).toBe('khopesh');
    expect(snap.secondary?.id).toBe('staff');
    expect(snap.canSwap).toBe(true);
    expect(snap.swapCooldownTick).toBe(0);
  });

  it('consumeActiveWeaponDurability riduce durabilità', () => {
    const mgr = new WeaponSlotManager();
    mgr.equip('PRIMARY', KHOPESH);
    const alive = mgr.consumeActiveWeaponDurability(1);
    expect(alive).toBe(true);
    const snap = mgr.snapshot();
    expect(snap.primary?.durabilityRemaining).toBe(119);
    expect(snap.primary?.durabilityRatio).toBeCloseTo(119 / 120);
  });

  it('consumeActiveWeaponDurability → false quando arma rotta', () => {
    const mgr = new WeaponSlotManager();
    mgr.equip('PRIMARY', KHOPESH);
    const rt = mgr.activeWeapon!;
    rt.durabilityRemaining = 1;
    const alive = mgr.consumeActiveWeaponDurability(1);
    expect(alive).toBe(false);
    expect(mgr.snapshot().primary?.isBroken).toBe(true);
  });

  it('unequip svuota lo slot', () => {
    const mgr = new WeaponSlotManager();
    mgr.equip('PRIMARY', KHOPESH);
    mgr.unequip('PRIMARY');
    expect(mgr.activeWeapon).toBeNull();
    expect(mgr.snapshot().primary).toBeNull();
  });

  it('serialize restituisce id e durabilità', () => {
    const mgr = new WeaponSlotManager();
    mgr.equip('PRIMARY', FISTS);
    mgr.equip('SECONDARY', KHOPESH);
    const saved = mgr.serialize();
    expect(saved.activeSlot).toBe('PRIMARY');
    expect(saved.primaryId).toBe('fists');
    expect(saved.secondaryId).toBe('khopesh');
    expect(saved.secondaryDurability).toBe(120);
  });
});
