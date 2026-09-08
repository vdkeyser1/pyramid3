/**
 * Scopo: LightReflectionPuzzle (Fase 4) — enigmi solari a specchi di bronzo.
 *        Permette di orientare gli specchi per convogliare la luce verso bersagli sacri
 *        e sbloccare passaggi segreti verso cripte nascoste.
 * Ownership: gameplay.
 */

export interface BronzeMirror {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  rotationDeg: number; // 0, 45, 90, 135, 180, 225, 270, 315
}

export interface SolarTarget {
  readonly id: string;
  readonly targetName: string;
  readonly requiredBeamAngleDeg: number;
  isIlluminated: boolean;
}

export interface LightPuzzleState {
  readonly puzzleId: string;
  readonly mirrors: readonly BronzeMirror[];
  readonly targets: readonly SolarTarget[];
  readonly isSolved: boolean;
  readonly unlockedSecretVaultName: string;
}

export class LightReflectionPuzzle {
  private _mirrors: BronzeMirror[];
  private _targets: SolarTarget[];
  private _puzzleId: string;
  private _vaultName: string;

  constructor(
    puzzleId: string,
    vaultName = 'Cripta dei Faraoni Perduti',
    initialMirrorAngle = 0,
    requiredAngle = 135,
  ) {
    this._puzzleId = puzzleId;
    this._vaultName = vaultName;

    this._mirrors = [
      {
        id: 'mirror_central',
        x: 0,
        z: 0,
        rotationDeg: initialMirrorAngle,
      },
    ];

    this._targets = [
      {
        id: 'target_horus_eye',
        targetName: 'Occhio Sacro di Horus',
        requiredBeamAngleDeg: requiredAngle,
        isIlluminated: initialMirrorAngle === requiredAngle,
      },
    ];
  }

  /**
   * Ruota lo specchio di bronzo di 45 gradi in senso orario.
   */
  public rotateMirror(mirrorId: string): number {
    const mirror = this._mirrors.find((m) => m.id === mirrorId);
    if (!mirror) return 0;

    mirror.rotationDeg = (mirror.rotationDeg + 45) % 360;

    // Ricalcola illuminazione dei bersagli
    for (const target of this._targets) {
      target.isIlluminated = mirror.rotationDeg === target.requiredBeamAngleDeg;
    }

    return mirror.rotationDeg;
  }

  public get state(): LightPuzzleState {
    const isSolved = this._targets.every((t) => t.isIlluminated);
    return {
      puzzleId: this._puzzleId,
      mirrors: this._mirrors,
      targets: this._targets,
      isSolved,
      unlockedSecretVaultName: this._vaultName,
    };
  }
}
