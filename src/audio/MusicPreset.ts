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
    // Respiro della piramide: sine puri + triangle caldo — nessun sawtooth,
    // nessun buzz. Scala frigia dominante (La, Do♯, Mi) per colore egizio.
    masterGain: 0.36,
    filterHz: 650,
    layers: [
      { waveform: 'sine', frequencyHz: 55,  detuneCent: 2,  gain: 0.40 },   // sub-bass La1
      { waveform: 'sine', frequencyHz: 110, detuneCent: -2, gain: 0.38 },   // La2 fondamentale
      { waveform: 'triangle', frequencyHz: 164.81, detuneCent: 4, gain: 0.18 }, // Mi3 quinta
      {
        waveform: 'sine',
        frequencyHz: 220,
        detuneCent: 0,
        gain: 0.09,
        pulseHz: 0.07,
        pulseDepth: 0.8,
      }, // Respiro molto lento (ogni ~14 s)
    ],
  },
  TENSION: {
    // Pericolo palpitante: triangle cupi + battito cardiaco (1.1 Hz ≈ 66 bpm)
    masterGain: 0.44,
    filterHz: 900,
    layers: [
      { waveform: 'triangle', frequencyHz: 55,    detuneCent: -6, gain: 0.34 },
      { waveform: 'triangle', frequencyHz: 82.41, detuneCent:  6, gain: 0.22 },
      {
        waveform: 'sine',
        frequencyHz: 110,
        detuneCent: 0,
        gain: 0.16,
        pulseHz: 1.1,
        pulseDepth: 0.70,
      }, // Battito lento del cuore
      {
        waveform: 'triangle',
        frequencyHz: 220,
        detuneCent: 0,
        gain: 0.10,
        pulseHz: 2.2,
        pulseDepth: 0.65,
      }, // Tensione doppia
    ],
  },
  COMBAT: {
    // Scontro: sawtooth filtrato + pulsazioni rapide — più aggressivo ma
    // contenuto dal compressore per non stridere sulle cuffie.
    masterGain: 0.50,
    filterHz: 1800,
    layers: [
      { waveform: 'sawtooth', frequencyHz: 55,   detuneCent: -10, gain: 0.26 },
      { waveform: 'sawtooth', frequencyHz: 55.5, detuneCent:  10, gain: 0.26 }, // battimento
      {
        waveform: 'square',
        frequencyHz: 110,
        detuneCent: 0,
        gain: 0.09,
        pulseHz: 6.0,
        pulseDepth: 0.88,
      }, // Ritmo incalzante
      {
        waveform: 'triangle',
        frequencyHz: 329.63,
        detuneCent: 0,
        gain: 0.07,
        pulseHz: 9.0,
        pulseDepth: 0.92,
      }, // Shimmer alto
      {
        waveform: 'sine',
        frequencyHz: 440,
        detuneCent: 0,
        gain: 0.04,
        pulseHz: 12.0,
        pulseDepth: 0.85,
      }, // Picco d'urgenza
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
