/**
 * Scopo: gestore della qualità di rendering (tier e scaling).
 * Ownership: RendererService.
 *
 * Profili:
 *   - low:  30 FPS target, 1280×720, 1 shadow, 4 lights, 20 enemies
 *   - medium: 60 FPS target, 1920×1080, 1 shadow, 8 lights, 40 enemies
 *   - high: 120 FPS target, 1440p, 2 shadows, 16+ lights, 60 enemies
 */

import type { QualityTier } from '@/config/GameConfig.js';

export interface QualityProfile {
  readonly tier: QualityTier;
  readonly targetFps: number;
  readonly resolutionScale: number;
  readonly shadowMapSize: number;
  readonly maxShadowLights: number;
  readonly maxRealtimeLights: number;
  readonly maxEnemies: number;
  readonly usePostFx: boolean;
}

const PROFILES: Record<QualityTier, QualityProfile> = {
  low: {
    tier: 'low',
    targetFps: 30,
    resolutionScale: 0.75,
    shadowMapSize: 512,
    maxShadowLights: 1,
    maxRealtimeLights: 4,
    maxEnemies: 20,
    usePostFx: false,
  },
  medium: {
    tier: 'medium',
    targetFps: 60,
    resolutionScale: 1.0,
    shadowMapSize: 1024,
    maxShadowLights: 1,
    maxRealtimeLights: 8,
    maxEnemies: 40,
    usePostFx: true,
  },
  high: {
    tier: 'high',
    targetFps: 120,
    resolutionScale: 1.5,
    shadowMapSize: 2048,
    maxShadowLights: 2,
    maxRealtimeLights: 16,
    maxEnemies: 60,
    usePostFx: true,
  },
};

export function getQualityProfile(tier: QualityTier): QualityProfile {
  return PROFILES[tier];
}

export class QualityController {
  private current: QualityProfile;

  constructor(tier: QualityTier) {
    this.current = getQualityProfile(tier);
  }

  get profile(): QualityProfile {
    return this.current;
  }

  setTier(tier: QualityTier): void {
    this.current = getQualityProfile(tier);
  }

  /** Propone un tier basato sul frame time medio. */
  adaptTo(frameTimeMs: number): void {
    const grace = 0.8; // 20% margine
    if (frameTimeMs * grace > 1000 / this.current.targetFps) {
      if (this.current.tier === 'high') this.current = getQualityProfile('medium');
      else if (this.current.tier === 'medium') this.current = getQualityProfile('low');
    }
  }
}
