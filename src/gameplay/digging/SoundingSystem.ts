/**
 * Scopo: sondaggio del terreno per localizzare il tesoro (§10.3, MIG-03).
 * Ownership: simulazione. Dietro feature flag `feature.sounding`.
 * Invarianti:
 *   - max 3 sondaggi per certezza;
 *   - responso a tre livelli (pieno, cavo attenuato, cavo netto);
 *   - fallback passivo dopo 60 s nella regione corretta.
 */

import { DIGGING } from '../../content/balance.js';
import type { Vec3 } from '../../math/Vec3.js';
import { distance } from '../../math/Vec3.js';

export type SoundingResponse = 'ROCK' | 'HOLLOW_FAR' | 'HOLLOW_NEAR';

export interface SoundingResult {
  readonly response: SoundingResponse;
  readonly noiseIntensity: number;
  readonly durationTicks: number;
}

/**
 * Calcola il responso del sondaggio in base alla distanza dal punto di scavo.
 */
export function computeSounding(
  playerPos: Vec3,
  digSitePos: Vec3,
): SoundingResult {
  const dist = distance(playerPos, digSitePos);

  let response: SoundingResponse;
  if (dist <= DIGGING.soundingNearRadiusM) {
    response = 'HOLLOW_NEAR';
  } else if (dist <= DIGGING.soundingMidRadiusM) {
    response = 'HOLLOW_FAR';
  } else {
    response = 'ROCK';
  }

  return {
    response,
    noiseIntensity: DIGGING.soundingNoiseIntensity,
    durationTicks: DIGGING.soundingDurationTicks,
  };
}

/**
 * Verifica se il fallback passivo (VFX "sabbia che respira") deve attivarsi.
 * Si attiva dopo 60 s nella regione corretta con torcia alta.
 */
export function shouldShowPassiveHint(
  ticksInCorrectRegion: number,
): boolean {
  return ticksInCorrectRegion >= DIGGING.passiveHintAfterTicks;
}
