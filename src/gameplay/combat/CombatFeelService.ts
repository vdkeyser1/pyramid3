/**
 * Scopo: CombatFeelService (Fase 1) — motore del game feel per il combattimento corpo a corpo in prima persona.
 *        Gestisce:
 *        1. Micro-hitstop asimmetrico per arma;
 *        2. Camera Shake direzionale inerziale con FOV kick;
 *        3. Stagger critico ed esecuzioni ravvicinate (Mercy Kills) con ricompense Ka/Torcia.
 * Ownership: gameplay/combat.
 */

export interface CameraShakeState {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly offsetZ: number;
  readonly rollDeg: number;
  readonly pitchDeg: number;
  readonly fovOffsetDeg: number;
  readonly active: boolean;
}

export interface FinisherPrompt {
  readonly enemyId: number;
  readonly enemyName: string;
  readonly remainingWindowSeconds: number;
  readonly promptText: string;
  readonly kaRestoreAmount: number;
  readonly torchExtensionSeconds: number;
  readonly shockwaveRadiusM: number;
}

export interface HitstopConfig {
  readonly durationMs: number;
  readonly flashColorHex?: number | undefined;
  readonly playHeavyThud: boolean;
}

export class CombatFeelService {
  private _shakeIntensity = 0;
  private _shakeDecay = 12.0; // decadimento rapido per evitare motion sickness
  private _currentRoll = 0;
  private _currentPitch = 0;
  private _currentFovKick = 0;
  private _fovKickDecay = 20.0;

  private _activeFinisher: FinisherPrompt | null = null;

  /**
   * Calcola l'hitstop asimmetrico per l'arma e il tipo di impatto.
   */
  public calculateHitstop(
    weaponId: string,
    isHeavy: boolean,
    isCritical: boolean,
    isParry: boolean,
  ): HitstopConfig {
    if (isParry) {
      return { durationMs: 120, flashColorHex: 0xffd700, playHeavyThud: true };
    }

    let baseMs = 45;
    if (weaponId.includes('spear')) {
      baseMs = 85;
    } else if (weaponId.includes('golden_khopesh') || weaponId.includes('sickle')) {
      baseMs = 70;
    } else if (weaponId.includes('staff')) {
      baseMs = 65;
    } else if (weaponId.includes('fists')) {
      baseMs = 35;
    }

    if (isHeavy) baseMs += 35;
    if (isCritical) baseMs += 40;

    return {
      durationMs: Math.min(140, baseMs),
      flashColorHex: isCritical ? 0xffcc33 : undefined,
      playHeavyThud: isHeavy || isCritical,
    };
  }

  /**
   * Innesca un impulso di Camera Shake direzionale.
   * @param direction 'LEFT' | 'RIGHT' | 'DOWN' | 'THRUST'
   * @param intensity forza dell'impatto (0.5 = leggero, 1.0 = normale, 2.0 = critico)
   */
  public triggerImpactShake(
    direction: 'LEFT' | 'RIGHT' | 'DOWN' | 'THRUST',
    intensity = 1.0,
  ): void {
    this._shakeIntensity = Math.min(2.5, this._shakeIntensity + intensity * 0.08);

    if (direction === 'LEFT') {
      this._currentRoll = -0.85 * intensity;
      this._currentPitch = 0.25 * intensity;
    } else if (direction === 'RIGHT') {
      this._currentRoll = 0.85 * intensity;
      this._currentPitch = 0.25 * intensity;
    } else if (direction === 'DOWN') {
      this._currentRoll = 0;
      this._currentPitch = -1.1 * intensity;
    } else if (direction === 'THRUST') {
      this._currentRoll = 0;
      this._currentPitch = 0.5 * intensity;
      this._currentFovKick = -2.2 * intensity; // contrazione istantanea FOV
    }
  }

  /**
   * Aggiorna lo stato della telecamera ad ogni frame.
   */
  public update(deltaSeconds: number): CameraShakeState {
    if (this._shakeIntensity > 0.001) {
      this._shakeIntensity = Math.max(0, this._shakeIntensity - this._shakeDecay * deltaSeconds * this._shakeIntensity);
      this._currentRoll *= Math.max(0, 1 - 15.0 * deltaSeconds);
      this._currentPitch *= Math.max(0, 1 - 15.0 * deltaSeconds);
    } else {
      this._shakeIntensity = 0;
      this._currentRoll = 0;
      this._currentPitch = 0;
    }

    if (Math.abs(this._currentFovKick) > 0.01) {
      this._currentFovKick *= Math.max(0, 1 - this._fovKickDecay * deltaSeconds);
    } else {
      this._currentFovKick = 0;
    }

    // Aggiorna finestra finisher attiva se presente
    if (this._activeFinisher) {
      const newWindow = this._activeFinisher.remainingWindowSeconds - deltaSeconds;
      if (newWindow <= 0) {
        this._activeFinisher = null;
      } else {
        this._activeFinisher = {
          ...this._activeFinisher,
          remainingWindowSeconds: newWindow,
        };
      }
    }

    const noiseX = (Math.random() - 0.5) * 2 * this._shakeIntensity;
    const noiseY = (Math.random() - 0.5) * 2 * this._shakeIntensity;
    const noiseZ = (Math.random() - 0.5) * 1.5 * this._shakeIntensity;

    return {
      offsetX: noiseX,
      offsetY: noiseY,
      offsetZ: noiseZ,
      rollDeg: this._currentRoll,
      pitchDeg: this._currentPitch,
      fovOffsetDeg: this._currentFovKick,
      active: this._shakeIntensity > 0.001 || Math.abs(this._currentFovKick) > 0.01,
    };
  }

  /**
   * Registra uno stagger critico su un nemico, aprendo la finestra per il finisher.
   */
  public registerCriticalStagger(
    enemyId: number,
    enemyName: string,
    windowSeconds = 2.5,
  ): FinisherPrompt {
    const prompt: FinisherPrompt = {
      enemyId,
      enemyName,
      remainingWindowSeconds: windowSeconds,
      promptText: `[E] ESECUZIONE — ${enemyName}`,
      kaRestoreAmount: 25,
      torchExtensionSeconds: 3.5,
      shockwaveRadiusM: 4.5,
    };
    this._activeFinisher = prompt;
    return prompt;
  }

  public get activeFinisher(): FinisherPrompt | null {
    return this._activeFinisher;
  }

  public consumeFinisher(): FinisherPrompt | null {
    const f = this._activeFinisher;
    this._activeFinisher = null;
    return f;
  }
}
