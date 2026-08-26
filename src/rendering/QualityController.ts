/**
 * Scopo: gestore della qualità di rendering (tier e scaling).
 * Ownership: RendererService.
 *
 * Profili:
 *   - low:    30 FPS target, 1280×720, 1 shadow, 4 lights, 20 enemies
 *   - medium: 60 FPS target, 1920×1080, 1 shadow, 8 lights, 40 enemies
 *   - high:  120 FPS target, 1440p, 2 shadows, 16+ lights, 60 enemies
 *
 * M-03 — Thermal Throttling Detection:
 *   Se la media mobile degli ultimi THERMAL_WINDOW frame supera
 *   il budget target × THERMAL_RATIO, il tier viene abbassato
 *   d'emergenza a "low" e il giocatore viene notificato via evento.
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
  readonly ssaoEnabled: boolean;
  readonly hdriResolution: 0 | 512 | 1024 | 2048;
  readonly maxRoomHops: 2 | 3 | 4;
  readonly bloomStrength: number;
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
    ssaoEnabled: false,
    hdriResolution: 0,
    maxRoomHops: 2,
    bloomStrength: 0,
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
    ssaoEnabled: false,
    hdriResolution: 512,
    maxRoomHops: 3,
    bloomStrength: 0.4,
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
    ssaoEnabled: true,
    hdriResolution: 2048,
    maxRoomHops: 4,
    bloomStrength: 0.6,
  },
};

export function getQualityProfile(tier: QualityTier): QualityProfile {
  return PROFILES[tier];
}

// ── M-03: Thermal throttling ────────────────────────────────────────────────

/**
 * Numero di frame nella finestra di rilevamento thermal.
 * A 60 FPS = ~1 secondo di osservazione.
 */
const THERMAL_WINDOW = 60;

/**
 * Rapporto budget/target oltre il quale si considera thermal throttling.
 * 1.5 = frame time medio 50% oltre il target → hardware in difficoltà.
 */
const THERMAL_RATIO = 1.5;

// ── QualityController ────────────────────────────────────────────────────────

export class QualityController {
  private current: QualityProfile;

  // Finestra mobile per thermal detection (M-03)
  private readonly frameTimes: number[] = [];
  private _thermalThrottled = false;

  /** Listener opzionale notificato al rilevamento thermal. */
  onThermalThrottle?: (newTier: QualityTier) => void;

  constructor(tier: QualityTier) {
    this.current = getQualityProfile(tier);
  }

  get profile(): QualityProfile {
    return this.current;
  }

  /** True se è stato rilevato thermal throttling nell'ultima finestra. */
  get thermalThrottled(): boolean {
    return this._thermalThrottled;
  }

  setTier(tier: QualityTier): void {
    this.current = getQualityProfile(tier);
    this.frameTimes.length = 0; // reset finestra al cambio manuale
    this._thermalThrottled = false;
  }

  /**
   * Aggiorna il tier basandosi sul frame time.
   * Integra rilevamento thermal (M-03): abbassa a "low" in caso di
   * frame time sostenuto oltre la soglia per THERMAL_WINDOW frame.
   *
   * @param frameTimeMs Frame time dell'ultimo frame (ms).
   */
  adaptTo(frameTimeMs: number): void {
    const targetMs = 1000 / this.current.targetFps;
    const grace    = 0.8; // 20% di margine prima di abbassare tier

    // Downscale reattivo (un singolo frame lento)
    if (frameTimeMs * grace > targetMs) {
      if (this.current.tier === 'high')   this.current = getQualityProfile('medium');
      else if (this.current.tier === 'medium') this.current = getQualityProfile('low');
    }

    // M-03: finestra mobile per thermal detection
    this.frameTimes.push(frameTimeMs);
    if (this.frameTimes.length > THERMAL_WINDOW) {
      this.frameTimes.shift();
    }

    if (this.frameTimes.length === THERMAL_WINDOW) {
      const avg        = this.frameTimes.reduce((a, b) => a + b, 0) / THERMAL_WINDOW;
      const currentTarget = 1000 / this.current.targetFps;
      const isThermal  = avg > currentTarget * THERMAL_RATIO;
      this._thermalThrottled = isThermal;

      if (isThermal && this.current.tier !== 'low') {
        this.current = getQualityProfile('low');
        this.frameTimes.length = 0; // reset per non retriggere subito
        this.onThermalThrottle?.('low');
      }
    }
  }
}
