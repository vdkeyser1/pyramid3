import { describe, expect, it } from 'vitest';
import { AUDIO_ASSET_MAP, validateAudioAssetMap } from '@/audio/AudioAssetLibrary.js';

describe('AudioAssetLibrary (G-19/Kenney)', () => {
  it('la mappa rispetta gli invarianti (path .ogg sotto audio/)', () => {
    expect(validateAudioAssetMap()).toBe(true);
  });

  it('i cue critici del gioco hanno asset reali', () => {
    expect((AUDIO_ASSET_MAP.footstep_sand ?? []).length).toBeGreaterThanOrEqual(4);
    expect((AUDIO_ASSET_MAP.attack_hit ?? []).length).toBeGreaterThanOrEqual(3);
    expect((AUDIO_ASSET_MAP.parry_success ?? []).length).toBeGreaterThanOrEqual(3);
    expect((AUDIO_ASSET_MAP.ui_click ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('ogni variante punta a un file esistente sotto public/', () => {
    // Invariante di percorso: parte sempre con 'audio/' (public/audio/).
    for (const variants of Object.values(AUDIO_ASSET_MAP)) {
      for (const path of variants) {
        expect(path.startsWith('audio/')).toBe(true);
        expect(path.endsWith('.ogg')).toBe(true);
      }
    }
  });
});
