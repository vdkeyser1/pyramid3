/**
 * Scopo: rilevamento automatico del tier di performance e del backend di rendering.
 * Ownership: sola lettura, chiamato durante il bootstrap.
 *
 * Tier:
 *   - low:  pixel ratio ≤1, 30 FPS target
 *   - medium: pixel ratio ≤2, 60 FPS target
 *   - high: nessun limite, 120 FPS target
 */

import type { RenderBackend, QualityTier } from '@/config/GameConfig.js';
import { createLogger } from '@/core/Logger.js';

const log = createLogger('PerformanceTiers');

export interface Capabilities {
  readonly webgpuAvailable: boolean;
  readonly webgl2Available: boolean;
  readonly devicePixelRatio: number;
  readonly deviceMemoryGb: number | undefined;
  readonly hardwareConcurrency: number;
  readonly detectedTier: QualityTier;
}

/** Risoluzione HDRI per IBL: 0 = colore statico (tier LOW). */
export type HdriResolution = 0 | 512 | 1024 | 2048;

/**
 * GAME-ART audit: flags di qualità derivati dal tier rilevato.
 * SSAO solo su HIGH; HDRI assente su LOW; hop di streaming scalati.
 */
export interface TierConfig {
  readonly hdriResolution: HdriResolution;
  readonly ssaoEnabled: boolean;
  readonly shadowMapSize: 0 | 512 | 1024 | 2048;
  readonly maxRoomHops: 2 | 3 | 4;
  readonly bloomStrength: number;
  readonly dpr: number;
}

export function detectCapabilities(): Capabilities {
  const gpu = (navigator as { gpu?: unknown }).gpu;
  const webgpuAvailable = typeof gpu !== 'undefined';
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  const webgl2Available = gl !== null;
  gl?.getExtension('WEBGL_lose_context')?.loseContext();

  const devicePixelRatio = window.devicePixelRatio || 1;
  const deviceMemoryGb = (navigator as { deviceMemory?: number }).deviceMemory;
  const hardwareConcurrency = navigator.hardwareConcurrency || 4;

  let detectedTier: QualityTier = 'medium';
  if (devicePixelRatio <= 1 || (deviceMemoryGb !== undefined && deviceMemoryGb < 4) || hardwareConcurrency < 4) {
    detectedTier = 'low';
  } else if (devicePixelRatio > 2 && deviceMemoryGb !== undefined && deviceMemoryGb >= 8 && hardwareConcurrency >= 8) {
    detectedTier = 'high';
  }

  log.info('Capabilities rilevate', {
    webgpuAvailable,
    webgl2Available,
    devicePixelRatio,
    deviceMemoryGb,
    hardwareConcurrency,
    detectedTier,
  });

  return {
    webgpuAvailable,
    webgl2Available,
    devicePixelRatio,
    deviceMemoryGb,
    hardwareConcurrency,
    detectedTier,
  };
}

export function selectBackend(caps: Capabilities, preferred: RenderBackend): RenderBackend {
  if (preferred === 'webgpu' && caps.webgpuAvailable) return 'webgpu';
  if (caps.webgl2Available) return 'webgl2';
  throw new Error('Nessun backend di rendering disponibile. WebGPU e WebGL2 richiesti.');
}

/**
 * Profilo visivo/streaming per il tier. Usato da renderer, HDRI e RoomStreaming.
 */
export function selectTierConfig(caps: Capabilities, devicePixelRatio = 1): TierConfig {
  const t = caps.detectedTier;
  if (t === 'low') {
    return {
      hdriResolution: 0,
      ssaoEnabled: false,
      shadowMapSize: 0,
      maxRoomHops: 2,
      bloomStrength: 0,
      dpr: 0.75,
    };
  }
  if (t === 'high') {
    return {
      hdriResolution: 2048,
      ssaoEnabled: true,
      shadowMapSize: 1024,
      maxRoomHops: 4,
      bloomStrength: 0.6,
      dpr: Math.min(devicePixelRatio, 2),
    };
  }
  return {
    hdriResolution: 512,
    ssaoEnabled: false,
    shadowMapSize: 512,
    maxRoomHops: 3,
    bloomStrength: 0.4,
    dpr: 1.0,
  };
}

/** Path HDRI Poly Haven desert in base alla risoluzione del tier. */
export function hdriUrlForResolution(resolution: HdriResolution): string | null {
  if (resolution === 0) return null;
  if (resolution >= 2048) return '/hdri/desert_road_puresky_2k.hdr';
  return '/hdri/desert_road_puresky_1k.hdr';
}
