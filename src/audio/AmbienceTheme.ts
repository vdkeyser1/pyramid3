/**
 * G-26 — mapping RoomTheme → loop ambientale (deserto / tomba / sacro).
 * Modulo PURO: il WebAudioEngine applica i loop (vento, drip, reverb).
 */

import type { RoomTheme } from '@/content/RoomThemes.js';

export type AmbienceKind = 'desert' | 'tomb' | 'sacred' | 'infested';

export function ambienceKindForTheme(theme: RoomTheme): AmbienceKind {
  switch (theme) {
    case 'SAND_FILLED':
    case 'COLLAPSED':
      return 'desert';
    case 'SACRED':
    case 'ASTRONOMICAL':
    case 'ROYAL':
      return 'sacred';
    case 'INFESTED':
      return 'infested';
    default:
      return 'tomb';
  }
}

/** True se il kind richiede il loop vento desertico (freesound / synth). */
export function wantsDesertWind(kind: AmbienceKind): boolean {
  return kind === 'desert';
}

/** True se il kind richiede stillicidio da cripta (tomb drip). */
export function wantsTombDrip(kind: AmbienceKind): boolean {
  return kind === 'tomb' || kind === 'infested' || kind === 'sacred';
}

/** Cue loop da passare a `audio.play()` per il tema corrente (G-26). */
export function ambienceCueForKind(kind: AmbienceKind): string {
  switch (kind) {
    case 'desert':
      return 'desert_wind';
    case 'sacred':
      return 'sacred_hum';
    case 'infested':
      return 'infested_chitter';
    default:
      return 'tomb_drip';
  }
}
