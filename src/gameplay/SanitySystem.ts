/**
 * Scopo: SanitySystem (Fase 2) — sistema di sanità mentale e paranoia della Duat.
 *        Modula il terrore al buio, le allucinazioni visive/uditive e la distorsione sensoriale.
 * Ownership: gameplay.
 */

export type SanityStage = 'CALM' | 'UNEASE' | 'PARANOIA' | 'DUAT_MADNESS';

export interface SanityState {
  readonly sanityRatio: number; // 0..1
  readonly stage: SanityStage;
  readonly heartbeatBpm: number;
  readonly visualDistortionIntensity: number;
  readonly auditoryHallucinationFrequency: number;
  readonly whisperTriggered: boolean;
  readonly currentWhisperPhrase?: string | undefined;
}

const EGYPTIAN_WHISPERS: readonly string[] = [
  'Sekhem... la carne appartiene alla sabbia...',
  'Anpu ti attende sulla bilancia...',
  'Nessun raggio di Ra penetrerà questa cripta...',
  'Il Ka del faraone reclama il tuo respiro...',
  'Chiudi gli occhi: l oscurità ti ha già divorato...',
];

export class SanitySystem {
  private _sanity = 1.0;
  private _whisperTimer = 0;
  private _whisperInterval = 12.0;

  /**
   * Aggiorna lo stato di sanità mentale.
   * @param deltaSeconds tempo trascorso
   * @param isTorchLit se la torcia è attiva
   * @param torchFuelSeconds carburante residuo della torcia
   * @param isNearLitBrazier se il giocatore si trova vicino a un braciere acceso
   */
  public update(
    deltaSeconds: number,
    isTorchLit: boolean,
    torchFuelSeconds: number,
    isNearLitBrazier = false,
  ): SanityState {
    if (isNearLitBrazier || (isTorchLit && torchFuelSeconds > 30)) {
      // Recupero della sanità
      this._sanity = Math.min(1.0, this._sanity + 0.035 * deltaSeconds);
    } else if (isTorchLit && torchFuelSeconds <= 30) {
      // Inquietudine per torcia in esaurimento
      this._sanity = Math.max(0.0, this._sanity - 0.02 * deltaSeconds);
    } else {
      // Buio totale: crollo rapido della sanità
      this._sanity = Math.max(0.0, this._sanity - 0.065 * deltaSeconds);
    }

    let stage: SanityStage = 'CALM';
    let bpm = 65;
    let distStr = 0;
    let hallFreq = 0;

    if (this._sanity > 0.70) {
      stage = 'CALM';
      bpm = 65 + (1 - this._sanity) * 30;
      distStr = 0;
      hallFreq = 0;
    } else if (this._sanity > 0.40) {
      stage = 'UNEASE';
      bpm = 85 + (0.70 - this._sanity) * 80;
      distStr = 0.25;
      hallFreq = 0.2;
    } else if (this._sanity > 0.15) {
      stage = 'PARANOIA';
      bpm = 110 + (0.40 - this._sanity) * 120;
      distStr = 0.65;
      hallFreq = 0.6;
    } else {
      stage = 'DUAT_MADNESS';
      bpm = 145 + (0.15 - this._sanity) * 100;
      distStr = 1.0;
      hallFreq = 1.0;
    }

    let whisperTriggered = false;
    let currentWhisperPhrase: string | undefined;

    if (this._sanity < 0.50) {
      this._whisperTimer += deltaSeconds;
      const threshold = this._sanity < 0.20 ? 6.0 : this._whisperInterval;
      if (this._whisperTimer >= threshold) {
        this._whisperTimer = 0;
        whisperTriggered = true;
        const idx = Math.floor(Math.random() * EGYPTIAN_WHISPERS.length);
        currentWhisperPhrase = EGYPTIAN_WHISPERS[idx];
      }
    } else {
      this._whisperTimer = 0;
    }

    return {
      sanityRatio: this._sanity,
      stage,
      heartbeatBpm: Math.min(160, Math.round(bpm)),
      visualDistortionIntensity: distStr,
      auditoryHallucinationFrequency: hallFreq,
      whisperTriggered,
      currentWhisperPhrase,
    };
  }

  public restoreSanity(amount: number): void {
    this._sanity = Math.min(1.0, this._sanity + amount);
  }

  public get sanityRatio(): number {
    return this._sanity;
  }
}
