/**
 * Test: SyntheticImpulseResponse (A-02)
 * Ambiente: jsdom (AudioContext disponibile via happy-dom)
 */

import { describe, it, expect } from 'vitest';
import { generateImpulseResponse } from '@/audio/SyntheticImpulseResponse.js';

// Mock minimo di AudioContext per il test unitario
class MockAudioContext {
  readonly sampleRate = 44100;
  createBuffer(channels: number, length: number, sr: number): AudioBuffer {
    const buffers = Array.from({ length: channels }, () => new Float32Array(length));
    return {
      sampleRate: sr,
      length,
      duration: length / sr,
      numberOfChannels: channels,
      getChannelData: (ch: number) => buffers[ch]!,
    } as unknown as AudioBuffer;
  }
}

describe('SyntheticImpulseResponse (A-02)', () => {
  const ctx = new MockAudioContext() as unknown as AudioContext;

  it('genera IR per ogni tipo di stanza senza errori', () => {
    const roomTypes = ['CORRIDOR', 'CHAMBER', 'THRONE_ROOM', 'SHAFT', 'BURIAL_CHAMBER'] as const;
    for (const roomType of roomTypes) {
      const buffer = generateImpulseResponse(ctx, roomType);
      expect(buffer).toBeDefined();
      expect(buffer.numberOfChannels).toBe(2);
      expect(buffer.length).toBeGreaterThan(0);
    }
  });

  it('CORRIDOR è più corta di THRONE_ROOM', () => {
    const corridor    = generateImpulseResponse(ctx, 'CORRIDOR');
    const throneRoom  = generateImpulseResponse(ctx, 'THRONE_ROOM');
    expect(corridor.duration).toBeLessThan(throneRoom.duration);
  });

  it('IR stereo: i due canali sono diversi (larghezza spaziale)', () => {
    const buffer = generateImpulseResponse(ctx, 'CHAMBER');
    const ch0 = buffer.getChannelData(0);
    const ch1 = buffer.getChannelData(1);
    // I canali devono differire in almeno qualche campione
    let differ = false;
    for (let i = 0; i < ch0.length; i++) {
      if (Math.abs((ch0[i] ?? 0) - (ch1[i] ?? 0)) > 1e-6) {
        differ = true;
        break;
      }
    }
    expect(differ).toBe(true);
  });

  it('IR normalizzata: picco <= 1.0', () => {
    const buffer = generateImpulseResponse(ctx, 'SHAFT');
    // Il picco si calcola in un loop semplice e si asserisce UNA volta sola:
    // un expect() per campione (~350k su SHAFT) mandava il test in timeout.
    let peak = 0;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const data = buffer.getChannelData(c);
      for (const sample of data) {
        const v = Math.abs(sample);
        if (v > peak) peak = v;
      }
    }
    expect(peak).toBeLessThanOrEqual(1.0 + 1e-6);
  });

  it('deterministica: due chiamate producono lo stesso buffer', () => {
    const b1 = generateImpulseResponse(ctx, 'BURIAL_CHAMBER');
    const b2 = generateImpulseResponse(ctx, 'BURIAL_CHAMBER');
    const ch1a = b1.getChannelData(0);
    const ch2a = b2.getChannelData(0);
    for (let i = 0; i < Math.min(100, ch1a.length); i++) {
      expect(ch1a[i]).toBeCloseTo(ch2a[i] ?? 0, 6);
    }
  });
});
