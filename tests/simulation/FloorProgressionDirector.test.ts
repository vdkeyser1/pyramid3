import { describe, expect, it } from 'vitest';
import { availableTemplates } from '@/simulation/Director.js';
import { ENEMY_TEMPLATES } from '@/content/enemyTemplates.js';
import { FLOOR_PROGRESSION, floorProgressionFor } from '@/content/floorProgression.js';

describe('Progressione multi-piano (G-10)', () => {
  it('ogni piano sblocca fasce di nemici più ampie (mai vuote)', () => {
    for (let floor = 1; floor <= 10; floor++) {
      const templates = availableTemplates(ENEMY_TEMPLATES, floor);
      expect(templates.length).toBeGreaterThan(0);
    }
    // Piano 1: solo tier 1; piano 3: include tier 2/3
    const floor1 = availableTemplates(ENEMY_TEMPLATES, 1);
    const floor3 = availableTemplates(ENEMY_TEMPLATES, 3);
    expect(floor1.length).toBeLessThan(floor3.length);
  });

  it('il budget del piano copre almeno uno spawn del template più costoso', () => {
    for (let floor = 1; floor <= 10; floor++) {
      const def = floorProgressionFor(floor);
      const templates = availableTemplates(ENEMY_TEMPLATES, floor);
      const maxCost = Math.max(...templates.map((t) => t.budgetCost));
      // Invariante anti-blocco: il budget deve permettere almeno 1 spawn
      expect(def.directorBudget).toBeGreaterThanOrEqual(maxCost);
    }
  });

  it('FLOOR_PROGRESSION è ordinata e ogni voce ha palette valida', () => {
    for (let i = 0; i < FLOOR_PROGRESSION.length; i++) {
      const def = FLOOR_PROGRESSION[i];
      if (!def) continue;
      expect(def.floorIndex).toBe(i + 1);
      expect(def.palette.wallHex).toBeGreaterThan(0);
      expect(def.palette.darknessFactor).toBeGreaterThanOrEqual(0);
      expect(def.palette.darknessFactor).toBeLessThanOrEqual(1);
    }
  });
});
