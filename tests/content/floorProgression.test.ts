import { describe, expect, it } from 'vitest';
import {
  FLOOR_PROGRESSION,
  MAX_FLOORS,
  floorProgressionFor,
  floorSeed,
} from '@/content/floorProgression.js';

describe('floorProgression (G-10)', () => {
  it('ha esattamente MAX_FLOORS piani consecutivi', () => {
    expect(FLOOR_PROGRESSION.length).toBe(MAX_FLOORS);
    for (let i = 0; i < FLOOR_PROGRESSION.length; i++) {
      expect(FLOOR_PROGRESSION[i]?.floorIndex).toBe(i + 1);
    }
  });

  it('la difficoltà cresce per composizione: budget e concorrenza non decrescono', () => {
    let prevBudget = 0;
    let prevConcurrent = 0;
    for (const def of FLOOR_PROGRESSION) {
      expect(def.directorBudget).toBeGreaterThan(prevBudget);
      expect(def.maxConcurrentEnemies).toBeGreaterThanOrEqual(prevConcurrent);
      prevBudget = def.directorBudget;
      prevConcurrent = def.maxConcurrentEnemies;
    }
    // Invariante anti-inflazione: cap di concorrenza a 4
    expect(FLOOR_PROGRESSION[MAX_FLOORS - 1]?.maxConcurrentEnemies).toBe(4);
  });

  it('il buio cresce con la profondità (darknessFactor monotono)', () => {
    let prev = -1;
    for (const def of FLOOR_PROGRESSION) {
      expect(def.palette.darknessFactor).toBeGreaterThan(prev);
      expect(def.palette.darknessFactor).toBeLessThanOrEqual(1);
      prev = def.palette.darknessFactor;
    }
  });

  it('floorProgressionFor clamp senza mai ritornare undefined', () => {
    expect(floorProgressionFor(0).floorIndex).toBe(1);
    expect(floorProgressionFor(-5).floorIndex).toBe(1);
    expect(floorProgressionFor(1).floorIndex).toBe(1);
    expect(floorProgressionFor(5).floorIndex).toBe(5);
    expect(floorProgressionFor(10).floorIndex).toBe(10);
    expect(floorProgressionFor(99).floorIndex).toBe(10);
  });

  it('floorSeed è deterministico e distinto per piano', () => {
    const a = floorSeed(0x1a2b3c4d, 1);
    const b = floorSeed(0x1a2b3c4d, 1);
    const c = floorSeed(0x1a2b3c4d, 2);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toBeGreaterThan(0);
  });
});
