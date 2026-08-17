/**
 * Scopo: parametri del drone ambientale procedurale (G-18 residuo) — il sottofondo
 * sonoro che cresce con l'oscurità accumulata. Modulo PURO (nessuna API audio):
 * i valori descrivono come il motore deve costruire il drone per ogni livello.
 * Ownership: audio (contenuto immutabile).
 * Invarianti:
 *   - livello 0 = quasi silenzio (drone appena percettibile);
 *   - livello 1 = tensione massima (drone pieno + shimmer + LFO lento);
 *   - nessun valore NaN/Infinito in uscita.
 * Failure mode: livelli fuori range → clamp a [0,1].
 */

export interface DroneLayer {
  readonly waveform: OscillatorType;
  /** Frequenza base in Hz. */
  readonly frequencyHz: number;
  /** Detune dell'oscillatore in cent (2 osc per drone = battimento). */
  readonly detuneCent: number;
  /** Ampiezza del layer al livello 1 (0..1). */
  readonly gainMax: number;
}

export interface AmbiencePreset {
  /** Layer di drone (2 oscillatori per layer, detuned per battimento). */
  readonly layers: readonly DroneLayer[];
  /** Frequenza dell'LFO di tensione (Hz) — modula il gain del drone. */
  readonly tensionLfoHz: number;
  /** Quanto l'LFO incide sul gain (0..1). */
  readonly lfoDepth: number;
  /** Gain di base del layer "silenzio" (livello 0). */
  readonly silenceGain: number;
}

export const AMBIENCE_PRESET: AmbiencePreset = {
  layers: [
    // Drone grave: la piramide che respira (2 osc detuned a 55Hz ≈ La1)
    { waveform: 'sine', frequencyHz: 55, detuneCent: 8, gainMax: 0.16 },
    // Quinta grave: spazio (82.4Hz ≈ Mi2)
    { waveform: 'sine', frequencyHz: 82.4, detuneCent: -6, gainMax: 0.12 },
    // Shimmer: sabbia che scivola (rumore filtrato, rappresentato da 330Hz)
    { waveform: 'triangle', frequencyHz: 330, detuneCent: 14, gainMax: 0.05 },
    // Rombo di pietra: risonanza metallica dei corridoi (110Hz ≈ La2, sawtooth)
    // Compare solo agli floor profondi — gainForFloor() ne scala l'ampiezza.
    { waveform: 'sawtooth', frequencyHz: 110, detuneCent: -10, gainMax: 0.08 },
  ],
  tensionLfoHz: 0.11,
  lfoDepth: 0.35,
  silenceGain: 0.02,
};

/**
 * Mappa un livello di oscurità 0..1 al gain target del bus ambience.
 * Curva quadratica: l'oscurità bassa è quasi muta, cresce con la tensione.
 */
export function ambienceGainForDarkness(darkness01: number): number {
  const clamped = Math.max(0, Math.min(1, darkness01));
  return Math.min(1, AMBIENCE_PRESET.silenceGain + clamped * clamped * 0.85);
}

/**
 * LFO depth per livello: più buio ⇒ LFO più marcato (respiro percepibile).
 */
export function lfoDepthForDarkness(darkness01: number): number {
  const clamped = Math.max(0, Math.min(1, darkness01));
  return AMBIENCE_PRESET.lfoDepth * clamped;
}

/**
 * B-05: moltiplicatore di gain ambience in base alla profondità del floor.
 * I piani profondi amplificano il rombo di pietra e abbassano leggermente
 * il silenceGain (ambiente più oppressivo).
 * Floor 1 → ×1.0, floor 5 → ×1.25, floor 10+ → ×1.4 (clamped).
 * Invariante: sempre in [1.0, 1.4] — nessun valore fuori range.
 */
export function gainMultiplierForFloor(floorIndex: number): number {
  const clamped = Math.max(1, Math.min(10, floorIndex));
  // Interpolazione lineare: +0.04 per piano oltre il primo, cap a 1.4.
  return Math.min(1.4, 1.0 + (clamped - 1) * 0.044);
}

/**
 * B-05: gain del 4° layer (rombo di pietra) per floor.
 * Inattivo ai piani 1-2, sale linearmente dal piano 3 al piano 7 (massimo).
 * Invariante: [0, gainMax] per indici validi.
 */
export function stoneRumbleGainForFloor(floorIndex: number, gainMax: number): number {
  if (floorIndex < 3) return 0;
  const ratio = Math.min(1, (floorIndex - 2) / 5); // piano 3→0%, piano 7→100%
  return gainMax * ratio;
}
