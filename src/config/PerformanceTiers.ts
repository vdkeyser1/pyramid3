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
