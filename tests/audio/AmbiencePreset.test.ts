import { describe, expect, it } from 'vitest';
import {
  AMBIENCE_PRESET,
  ambienceGainForDarkness,
  gainMultiplierForFloor,
  lfoDepthForDarkness,
  stoneRumbleGainForFloor,
} from '@/audio/AmbiencePreset.js';

describe('AmbiencePreset (G-18)', () => {
  it('il preset ha 4 layer con oscillatori detuned (incluso rombo di pietra)', () => {
    expect(AMBIENCE_PRESET.layers).toHaveLength(4);
    for (const layer of AMBIENCE_PRESET.layers) {
      expect(layer.frequencyHz).toBeGreaterThan(0);
      expect(layer.gainMax).toBeGreaterThan(0);
    }
    expect(AMBIENCE_PRESET.tensionLfoHz).toBeGreaterThan(0);
  });

  it('il guadagno cresce quadraticamente con l oscurità', () => {
    const quiet = ambienceGainForDarkness(0);
    const mid = ambienceGainForDarkness(0.5);
    const full = ambienceGainForDarkness(1);

    expect(quiet).toBeLessThan(0.1); // quasi silenzio
    expect(full).toBeCloseTo(0.87, 1);
    expect(mid).toBeGreaterThan(quiet);
    expect(full).toBeGreaterThan(mid);
    // quadratica: a metà l'energia è 1/4
    expect(mid).toBeLessThan(0.3);
  });

  it('clampa i valori fuori range', () => {
    expect(ambienceGainForDarkness(-5)).toBe(ambienceGainForDarkness(0));
    expect(ambienceGainForDarkness(3)).toBe(ambienceGainForDarkness(1));
    expect(lfoDepthForDarkness(2)).toBe(lfoDepthForDarkness(1));
    expect(lfoDepthForDarkness(0)).toBe(0);
  });

  it('LFO depth cresce con il buio (respiro percepibile)', () => {
    expect(lfoDepthForDarkness(0)).toBeLessThan(lfoDepthForDarkness(0.8));
    expect(lfoDepthForDarkness(1)).toBe(AMBIENCE_PRESET.lfoDepth);
  });

  // B-05: floor-tier tuning
  it('gainMultiplierForFloor è in [1.0, 1.4] per qualsiasi floor', () => {
    expect(gainMultiplierForFloor(1)).toBeCloseTo(1.0, 5);
    expect(gainMultiplierForFloor(10)).toBeCloseTo(1.4, 1);
    expect(gainMultiplierForFloor(5)).toBeGreaterThan(1.0);
    expect(gainMultiplierForFloor(5)).toBeLessThan(1.4);
    // clamp: floor negativo = floor 1
    expect(gainMultiplierForFloor(-1)).toBe(gainMultiplierForFloor(1));
    // clamp: floor oltre 10 = floor 10
    expect(gainMultiplierForFloor(99)).toBe(gainMultiplierForFloor(10));
  });

  it('stoneRumbleGainForFloor è 0 ai piani bassi, sale linearmente', () => {
    const gainMax = 0.08;
    expect(stoneRumbleGainForFloor(1, gainMax)).toBe(0);
    expect(stoneRumbleGainForFloor(2, gainMax)).toBe(0);
    expect(stoneRumbleGainForFloor(3, gainMax)).toBeGreaterThan(0);
    expect(stoneRumbleGainForFloor(7, gainMax)).toBeCloseTo(gainMax, 5);
    // non supera gainMax
    expect(stoneRumbleGainForFloor(10, gainMax)).toBeLessThanOrEqual(gainMax);
  });
});
