import { describe, expect, it } from 'vitest';
import { PYRAMID_20_FLOORS, getPyramidFloorTier } from '@/content/PyramidFloorProgression20.js';

describe('PyramidFloorProgression20 — Mappatura 20 piani piramide', () => {
  it('contiene esattamente 20 piani progressivi dal Pyramidion al Trono della Duat', () => {
    expect(PYRAMID_20_FLOORS.length).toBe(20);
    expect(PYRAMID_20_FLOORS[0]?.name).toContain('Pyramidion');
    expect(PYRAMID_20_FLOORS[19]?.name).toContain('Cripta Primordiale');
  });

  it('il numero di stanze cresce scendendo verso la base', () => {
    const floor1 = getPyramidFloorTier(1);
    const floor20 = getPyramidFloorTier(20);

    expect(floor20.baseRoomCount).toBeGreaterThan(floor1.baseRoomCount);
    expect(floor20.dangerRating).toBeGreaterThanOrEqual(floor1.dangerRating);
  });
});
