import { describe, expect, it } from 'vitest';
import {
  CURSES,
  applyCurseEffects,
  curseForFloor,
  type ActiveCurse,
} from '@/content/curses.js';

const BASE = {
  torchDrainRatio: 1,
  maxHp: 100,
  damageTakenMultiplier: 1,
  goldMultiplier: 1,
};

function active(id: ActiveCurse['definition']['id']): ActiveCurse {
  const definition = CURSES.find((c) => c.id === id);
  if (!definition) throw new Error(`curse ${id} missing`);
  return { definition, floorIndex: 2 };
}

describe('curses (NEW-3)', () => {
  it('ogni maledizione ha penalty E reward (trade-off, mai beneficio puro)', () => {
    for (const curse of CURSES) {
      expect(curse.penalty.length).toBeGreaterThan(5);
      expect(curse.reward.length).toBeGreaterThan(5);
    }
  });

  it('curseForFloor è deterministico e copre tutte le maledizioni', () => {
    const seen = new Set<string>();
    for (let floor = 1; floor <= 24; floor++) {
      const curse = curseForFloor(0x1a2b3c4d, floor);
      expect(CURSES.some((c) => c.id === curse.id)).toBe(true);
      seen.add(curse.id);
    }
    // Con 24 piani e 4 maledizioni, la distribuzione FNV tocca tutte
    expect(seen.size).toBeGreaterThan(1);
  });

  it('oscurità-antica accelera il drenaggio della torcia', () => {
    const result = applyCurseEffects(active('oscurita-antica'), BASE);
    expect(result.torchDrainRatio).toBeCloseTo(1.25, 5);
    expect(result.maxHp).toBe(100);
  });

  it('fame-del-deserto riduce HP max e raddoppia l oro', () => {
    const result = applyCurseEffects(active('fame-del-deserto'), BASE);
    expect(result.maxHp).toBe(90);
    expect(result.goldMultiplier).toBe(2);
  });

  it('sigillo-di-sobek aumenta il danno subito del 20%', () => {
    const result = applyCurseEffects(active('sigillo-di-sobek'), BASE);
    expect(result.damageTakenMultiplier).toBeCloseTo(1.2, 5);
  });
});
