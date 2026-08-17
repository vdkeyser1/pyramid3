import { describe, expect, it } from 'vitest';
import {
  MUSIC_PRESET,
  MUSIC_STATES,
  validateMusicPreset,
  type MusicStateDef,
} from '@/audio/MusicPreset.js';

describe('MusicPreset (G-19 musica adattiva)', () => {
  it('contiene esattamente i 3 stati attesi', () => {
    expect(MUSIC_STATES).toEqual(['EXPLORE', 'TENSION', 'COMBAT']);
    for (const state of MUSIC_STATES) {
      expect(MUSIC_PRESET[state]).toBeDefined();
    }
  });

  it('gli stati hanno masterGain e layer validi (invarianti)', () => {
    expect(validateMusicPreset()).toBe(true);
  });

  it('i layer hanno frequenze udibili e gain nel range 0..1', () => {
    for (const state of MUSIC_STATES) {
      const def: MusicStateDef = MUSIC_PRESET[state];
      expect(def.layers.length).toBeGreaterThanOrEqual(1);
      for (const layer of def.layers) {
        expect(layer.frequencyHz).toBeGreaterThan(20);
        expect(layer.frequencyHz).toBeLessThan(8000);
        expect(layer.gain).toBeGreaterThan(0);
        expect(layer.gain).toBeLessThanOrEqual(1);
        if ((layer.pulseHz ?? 0) > 0) {
          expect(layer.pulseDepth ?? 0).toBeGreaterThanOrEqual(0);
          expect(layer.pulseDepth ?? 0).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('gli stati sono musicalmente distinti (firme layer diverse)', () => {
    const signature = (state: MusicStateDef) =>
      state.layers.map((l) => `${l.waveform}@${l.frequencyHz}`).join('|');
    const explore = signature(MUSIC_PRESET.EXPLORE);
    const tension = signature(MUSIC_PRESET.TENSION);
    const combat = signature(MUSIC_PRESET.COMBAT);
    expect(tension).not.toBe(explore);
    expect(combat).not.toBe(tension);
    expect(combat).not.toBe(explore);
  });

  it('COMBAT è il più denso e aggressivo (più layer, gain master più alto)', () => {
    expect(MUSIC_PRESET.COMBAT.layers.length).toBeGreaterThan(MUSIC_PRESET.EXPLORE.layers.length);
    expect(MUSIC_PRESET.COMBAT.masterGain).toBeGreaterThan(MUSIC_PRESET.EXPLORE.masterGain);
  });
});
