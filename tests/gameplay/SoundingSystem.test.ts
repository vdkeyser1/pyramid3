import { describe, expect, it } from 'vitest';
import {
  computeSounding,
  shouldShowPassiveHint,
} from '@/gameplay/digging/SoundingSystem.js';
import { DIGGING } from '@/content/balance.js';

describe('SoundingSystem', () => {
  const digPos = { x: 10, y: 0, z: 10 };

  it('HOLLOW_NEAR entro soundingNearRadiusM', () => {
    const result = computeSounding({ x: 10, y: 0, z: 10 }, digPos);
    expect(result.response).toBe('HOLLOW_NEAR');
  });

  it('HOLLOW_FAR tra near e mid radius', () => {
    const offset = (DIGGING.soundingNearRadiusM + DIGGING.soundingMidRadiusM) / 2;
    const result = computeSounding({ x: 10 + offset, y: 0, z: 10 }, digPos);
    expect(result.response).toBe('HOLLOW_FAR');
  });

  it('ROCK oltre soundingMidRadiusM', () => {
    const far = DIGGING.soundingMidRadiusM + 5;
    const result = computeSounding({ x: 10 + far, y: 0, z: 10 }, digPos);
    expect(result.response).toBe('ROCK');
  });

  it('noiseIntensity costante', () => {
    const r = computeSounding({ x: 10, y: 0, z: 10 }, digPos);
    expect(r.noiseIntensity).toBe(DIGGING.soundingNoiseIntensity);
  });

  it('passive hint dopo 60 s nella regione corretta', () => {
    expect(shouldShowPassiveHint(DIGGING.passiveHintAfterTicks - 1)).toBe(false);
    expect(shouldShowPassiveHint(DIGGING.passiveHintAfterTicks)).toBe(true);
  });
});
