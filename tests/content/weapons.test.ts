import { describe, expect, it } from 'vitest';
import {
  ALL_WEAPONS,
  WEAPON_FISTS,
  WEAPON_KHOPESH,
  WEAPON_STAFF,
  WEAPON_SHOVEL,
  WEAPON_SPEAR_OF_RA,
  WEAPON_GOLDEN_KHOPESH,
  WEAPON_ANUBIS_SICKLE,
} from '@/content/weapons.js';

describe('weapons — Definizione dell arsenale egizio esteso', () => {
  it('contiene 7 armi totali ben definite', () => {
    expect(ALL_WEAPONS.length).toBe(7);
  });

  it('Lancia di Ra ha portata estesa e attacchi validi', () => {
    expect(WEAPON_SPEAR_OF_RA.reachM).toBe(2.8);
    expect(WEAPON_SPEAR_OF_RA.damageHp).toBeGreaterThan(WEAPON_FISTS.damageHp);
    expect(WEAPON_SPEAR_OF_RA.attacks.length).toBeGreaterThan(0);
  });

  it('Khopesh Faraonico ha statistiche da arma cerimoniale d élite', () => {
    expect(WEAPON_GOLDEN_KHOPESH.damageHp).toBeGreaterThan(WEAPON_KHOPESH.damageHp);
    expect(WEAPON_GOLDEN_KHOPESH.durability).toBeGreaterThan(WEAPON_KHOPESH.durability);
  });

  it('Bastone e Pala sono definiti con durabilità coerente', () => {
    expect(WEAPON_STAFF.durability).toBe(180);
    expect(WEAPON_SHOVEL.durabilityUnit).toBe('DIGS');
  });

  it('Falce di Anubi ha portata e velocità ottimali', () => {
    expect(WEAPON_ANUBIS_SICKLE.reachM).toBe(1.6);
    expect(WEAPON_ANUBIS_SICKLE.damageHp).toBe(22);
  });

  it('tutte le armi hanno ID univoci e nomi validi', () => {
    const ids = new Set<string>();
    for (const weapon of ALL_WEAPONS) {
      expect(ids.has(weapon.id)).toBe(false);
      ids.add(weapon.id);
      expect(weapon.name.length).toBeGreaterThan(2);
      expect(weapon.attacks.length).toBeGreaterThan(0);
    }
  });
});
