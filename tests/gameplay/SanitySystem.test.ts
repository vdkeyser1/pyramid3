import { describe, expect, it } from 'vitest';
import { SanitySystem } from '@/gameplay/SanitySystem.js';

describe('SanitySystem — Sistema di Sanità Mentale e Paranoia della Duat (Fase 2)', () => {
  it('la sanità mentale si ripristina quando la torcia è accesa e degrada nel buio totale', () => {
    const sanity = new SanitySystem();

    // Inizia al 100%
    let state = sanity.update(1.0, true, 100);
    expect(state.stage).toBe('CALM');
    expect(state.sanityRatio).toBe(1.0);

    // 10 secondi nel buio totale
    for (let i = 0; i < 10; i++) {
      state = sanity.update(1.0, false, 0);
    }

    expect(state.sanityRatio).toBeLessThan(0.70);
    expect(['UNEASE', 'PARANOIA', 'DUAT_MADNESS']).toContain(state.stage);
    expect(state.heartbeatBpm).toBeGreaterThan(70);
  });

  it('restoreSanity recupera la salute mentale', () => {
    const sanity = new SanitySystem();
    sanity.update(15.0, false, 0); // calo forte

    const lowRatio = sanity.sanityRatio;
    sanity.restoreSanity(0.40);
    expect(sanity.sanityRatio).toBeGreaterThan(lowRatio);
  });
});
