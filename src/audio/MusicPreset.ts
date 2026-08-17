/**
 * Scopo: musica adattiva procedurale (G-19) — 3 stati crossfadati:
 *        EXPLORE (drone calmo), TENSION (pulsazione), COMBAT (ritmo serrato).
 *        Puro e deterministico: i layer sono definizioni, il runtime
 *        (WebAudioEngine.setMusicState) li costruisce e sfuma.
 * Ownership: audio. Consumato da WebAudioEngine (bus 'music') e testato in
 *        node (nessuna dipendenza da AudioContext).
 * Invarianti:
 *   - ogni stato ha almeno un layer e gain di master positivo;
 *   - frequenze nel campo udibile (20–8000 Hz);
 *   - pulseHz > 0 ⇒ pulseDepth in [0, 1].
 * Failure mode: stato sconosciuto ⇒ il chiamante usa EXPLORE (default).
 */

export type MusicState = 'EXPLORE' | 'TENSION' | 'COMBAT';

export interface MusicLayerDef {
  readonly waveform: OscillatorType;
  readonly frequencyHz: number;
  /** Detune in centesimi (battimento organico con altri layer). */
  readonly detuneCent: number;
  /** Gain relativo del layer (0..1). */
  readonly gain: number;
  /** Frequenza del tremolo LFO; assente se 0 o omesso. */
  readonly pulseHz?: number;
  /** Profondità del tremolo (0..1). */
  readonly pulseDepth?: number;
}

export interface MusicStateDef {
  /** Gain del bus musica per questo stato (0..1). */
  readonly masterGain: number;
  /** Cutoff del lowpass sul mix; assente se nessun filtro. */
  readonly filterHz?: number;
  readonly layers: readonly MusicLayerDef[];
}

export const MUSIC_STATES: readonly MusicState[] = ['EXPLORE', 'TENSION', 'COMBAT'];

export const MUSIC_PRESET: Record<MusicState, MusicStateDef> = {
  EXPLORE: {
    masterGain: 0.42,
    filterHz: 900,
    layers: [
      { waveform: 'sine', frequencyHz: 110, detuneCent: 0, gain: 0.55 },       // La2: radice
      { waveform: 'sine', frequencyHz: 164.81, detuneCent: 5, gain: 0.28 },    // Mi3: quinta
      {
        waveform: 'triangle',
        frequencyHz: 220,
        detuneCent: 0,
        gain: 0.14,
        pulseHz: 0.12,
        pulseDepth: 0.6,
      }, // Respiro lento della piramide
    ],
  },
  TENSION: {
    masterGain: 0.5,
    filterHz: 1600,
    layers: [
      { waveform: 'sawtooth', frequencyHz: 55, detuneCent: -6, gain: 0.3 },    // La1 grave
      { waveform: 'sawtooth', frequencyHz: 82.41, detuneCent: 6, gain: 0.22 }, // Mi2
      {
        waveform: 'triangle',
        frequencyHz: 220,
        detuneCent: 0,
        gain: 0.18,
        pulseHz: 2.2,
        pulseDepth: 0.7,
      }, // Pulsazione di pericolo
    ],
  },
  COMBAT: {
    masterGain: 0.6,
    filterHz: 4000,
    layers: [
      { waveform: 'sawtooth', frequencyHz: 55, detuneCent: -10, gain: 0.38 },
      { waveform: 'sawtooth', frequencyHz: 55.5, detuneCent: 10, gain: 0.38 }, // Battimento lento aggressivo
      {
        waveform: 'square',
        frequencyHz: 110,
        detuneCent: 0,
        gain: 0.14,
        pulseHz: 6.0,
        pulseDepth: 0.85,
      }, // Ritmo incalzante
      {
        waveform: 'triangle',
        frequencyHz: 329.63,
        detuneCent: 0,
        gain: 0.1,
        pulseHz: 9.0,
        pulseDepth: 0.9,
      }, // Shimmer d'emergenza
    ],
  },
};

/** Validazione invarianti: usata dai test e dal runtime all'avvio. */
export function validateMusicPreset(): boolean {
  for (const state of MUSIC_STATES) {
    const def = MUSIC_PRESET[state];
    if (!(def.masterGain > 0) || def.layers.length === 0) return false;
    for (const layer of def.layers) {
      if (!(layer.frequencyHz > 20 && layer.frequencyHz < 8000)) return false;
      if (!(layer.gain > 0 && layer.gain <= 1)) return false;
      if ((layer.pulseHz ?? 0) > 0 && (layer.pulseDepth ?? 0) > 1) return false;
      if ((layer.pulseHz ?? 0) > 0 && (layer.pulseDepth ?? 0) < 0) return false;
    }
  }
  return true;
}
