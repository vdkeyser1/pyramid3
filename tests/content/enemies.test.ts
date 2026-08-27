import { describe, expect, it } from 'vitest';
import { ENEMIES, type EnemyArchetype } from '@/content/enemies.js';

describe('enemies — Bestiario ed archetipi nemici della piramide', () => {
  it('contiene 9 archetipi nemici completi', () => {
    const archetypes: EnemyArchetype[] = [
      'SCARAB',
      'MUMMY',
      'COBRA',
      'SHABTI',
      'PRIEST',
      'SOBEK_SPAWN',
      'ROYAL_MUMMY',
      'ANUBIS_EXECUTIONER',
      'WITNESS',
    ];

    for (const arch of archetypes) {
      expect(ENEMIES[arch]).toBeDefined();
      expect(ENEMIES[arch].name.length).toBeGreaterThan(2);
      expect(ENEMIES[arch].speedMps).toBeGreaterThan(0);
    }
  });

  it('ANUBIS_EXECUTIONER è configurato come nemico d élite corrotto', () => {
    const anubis = ENEMIES.ANUBIS_EXECUTIONER;
    expect(anubis.isCorrupted).toBe(true);
    expect(anubis.baseHp).toBe(160);
    expect(anubis.attacks.length).toBeGreaterThanOrEqual(2);

    const sweep = anubis.attacks.find((a) => a.name === 'Falciata Rituale');
    expect(sweep).toBeDefined();
    expect(sweep?.arcDeg).toBe(180);
    expect(sweep?.isHeavy).toBe(true);
  });
});
