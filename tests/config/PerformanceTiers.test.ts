import { describe, expect, it } from 'vitest';
import { walkableAreaM2, bakeNavMeshFromSurfaces } from '@/ai/navigation/RecastNavMesh.js';
import { hdriUrlForResolution, selectTierConfig, type Capabilities } from '@/config/PerformanceTiers.js';
import { ambienceKindForTheme, ambienceCueForKind, wantsDesertWind, wantsTombDrip } from '@/audio/AmbienceTheme.js';

function caps(tier: 'low' | 'medium' | 'high'): Capabilities {
  return {
    webgpuAvailable: true,
    webgl2Available: true,
    devicePixelRatio: tier === 'high' ? 2.5 : 1,
    deviceMemoryGb: tier === 'low' ? 2 : 8,
    hardwareConcurrency: 8,
    detectedTier: tier,
  };
}

describe('PerformanceTiers selectTierConfig (audit)', () => {
  it('LOW disabilita SSAO e HDRI, hop=2', () => {
    const cfg = selectTierConfig(caps('low'));
    expect(cfg.ssaoEnabled).toBe(false);
    expect(cfg.hdriResolution).toBe(0);
    expect(cfg.maxRoomHops).toBe(2);
    expect(hdriUrlForResolution(cfg.hdriResolution)).toBeNull();
  });

  it('HIGH abilita SSAO e HDRI 2K, hop=4', () => {
    const cfg = selectTierConfig(caps('high'), 2.5);
    expect(cfg.ssaoEnabled).toBe(true);
    expect(cfg.hdriResolution).toBe(2048);
    expect(cfg.maxRoomHops).toBe(4);
    expect(hdriUrlForResolution(cfg.hdriResolution)).toContain('2k');
  });
});

describe('RecastNavMesh helpers (G-28)', () => {
  it('walkableAreaM2 somma le AABB', () => {
    expect(walkableAreaM2([
      { minX: 0, minZ: 0, maxX: 10, maxZ: 4 },
      { minX: 0, minZ: 0, maxX: 2, maxZ: 2 },
    ])).toBe(44);
  });

  it('bakeNavMeshFromSurfaces con lista vuota ritorna null', async () => {
    expect(await bakeNavMeshFromSurfaces([])).toBeNull();
  });
});

describe('AmbienceTheme (G-26)', () => {
  it('mappa i temi su vento/drip', () => {
    expect(ambienceKindForTheme('SAND_FILLED')).toBe('desert');
    expect(wantsDesertWind('desert')).toBe(true);
    expect(wantsTombDrip('tomb')).toBe(true);
    expect(ambienceKindForTheme('FUNERARY')).toBe('tomb');
  });

  it('assegna un cue play() per ogni kind', () => {
    expect(ambienceCueForKind('desert')).toBe('desert_wind');
    expect(ambienceCueForKind('tomb')).toBe('tomb_drip');
    expect(ambienceCueForKind('sacred')).toBe('sacred_hum');
    expect(ambienceCueForKind('infested')).toBe('infested_chitter');
  });
});
