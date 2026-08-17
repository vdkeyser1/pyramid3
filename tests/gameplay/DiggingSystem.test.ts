import { describe, expect, it } from 'vitest';
import {
  createDigSite,
  tickDig,
  getDigProgress,
  getCurrentSegment,
} from '@/gameplay/digging/DiggingSystem.js';
import { DIGGING } from '@/content/balance.js';

const TICKS_PER_SEGMENT = Math.floor(DIGGING.totalDurationTicks / DIGGING.segments);

describe('DiggingSystem', () => {
  it('crea un sito con progresso 0', () => {
    const site = createDigSite('s1', 0, 10, 20);
    expect(site.progressTicks).toBe(0);
    expect(site.completed).toBe(false);
    expect(getDigProgress(site)).toBe(0);
    expect(getCurrentSegment(site)).toBe(0);
  });

  it('non avanza senza torcia accesa', () => {
    const site = createDigSite('s1', 0, 0, 0);
    const event = tickDig(site, false);
    expect(event).toBeNull();
    expect(site.progressTicks).toBe(0);
  });

  it('emette SEGMENT_COMPLETE al confine di segmento', () => {
    const site = createDigSite('s1', 0, 0, 0);
    // Tick fino al primo confine di segmento
    let segmentEvent: ReturnType<typeof tickDig> = null;
    for (let i = 0; i < TICKS_PER_SEGMENT; i++) {
      const e = tickDig(site, true);
      if (e?.kind === 'SEGMENT_COMPLETE') segmentEvent = e;
    }
    expect(segmentEvent).not.toBeNull();
    if (segmentEvent?.kind !== 'SEGMENT_COMPLETE') {
      throw new Error('Expected SEGMENT_COMPLETE event');
    }
    expect(segmentEvent.segmentIndex).toBe(1);
    expect(segmentEvent.noiseIntensity).toBe(3.0); // 2.0 + segment 1
  });

  it('rumore crescente per segmento', () => {
    const site = createDigSite('s1', 0, 0, 0);
    const noises: number[] = [];
    for (let i = 0; i < DIGGING.totalDurationTicks; i++) {
      const e = tickDig(site, true);
      if (e && (e.kind === 'SEGMENT_COMPLETE' || e.kind === 'DIG_COMPLETE')) {
        noises.push(e.noiseIntensity);
      }
    }
    // Deve essere crescente
    for (let i = 1; i < noises.length; i++) {
      const previousNoise = noises[i - 1];
      expect(previousNoise).toBeDefined();
      if (previousNoise === undefined) {
        throw new Error('Expected previous noise sample');
      }
      expect(noises[i]).toBeGreaterThanOrEqual(previousNoise);
    }
  });

  it('completa dopo totalDurationTicks', () => {
    const site = createDigSite('s1', 0, 0, 0);
    let completeEvent = null;
    for (let i = 0; i < DIGGING.totalDurationTicks; i++) {
      const e = tickDig(site, true);
      if (e?.kind === 'DIG_COMPLETE') completeEvent = e;
    }
    expect(completeEvent).not.toBeNull();
    expect(site.completed).toBe(true);
    expect(getDigProgress(site)).toBe(1);
  });

  it('non avanza dopo completamento', () => {
    const site = createDigSite('s1', 0, 0, 0);
    for (let i = 0; i < DIGGING.totalDurationTicks; i++) tickDig(site, true);
    const e = tickDig(site, true);
    expect(e).toBeNull();
  });

  it('progresso interrompibile senza perdita', () => {
    const site = createDigSite('s1', 0, 0, 0);
    for (let i = 0; i < 50; i++) tickDig(site, true);
    const saved = site.progressTicks;
    tickDig(site, false); // interruzione
    expect(site.progressTicks).toBe(saved);
    tickDig(site, true); // riprende
    expect(site.progressTicks).toBe(saved + 1);
  });
});
