/**
 * Scopo: libreria deterministica di cue sintetici senza asset esterni.
 * Ownership: WebAudioEngine traduce i nomi evento -> profili sintetici.
 */

export interface ProceduralCueProfile {
  readonly waveform: OscillatorType;
  readonly frequencyHz: number;
  readonly endFrequencyHz?: number;
  readonly durationSeconds: number;
  readonly attackSeconds: number;
  readonly releaseSeconds: number;
  readonly gain: number;
  /** G-06: true = rumore bianco filtrato (footstep/impatti) invece dell'oscillatore. */
  readonly noise?: boolean;
  /** G-06: filtro passa-basso per il rumore (Hz). Default: 1200. */
  readonly noiseLowpassHz?: number;
}

const DEFAULT_CUE: ProceduralCueProfile = {
  waveform: 'sine',
  frequencyHz: 220,
  durationSeconds: 0.22,
  attackSeconds: 0.01,
  releaseSeconds: 0.12,
  gain: 0.12,
};

export function getProceduralCueProfile(name: string): ProceduralCueProfile {
  switch (name) {
    case 'torch_low_warning':
      return {
        waveform: 'square',
        frequencyHz: 740,
        endFrequencyHz: 620,
        durationSeconds: 0.18,
        attackSeconds: 0.005,
        releaseSeconds: 0.1,
        gain: 0.09,
      };
    case 'torch_extinguish':
      return {
        waveform: 'sawtooth',
        frequencyHz: 260,
        endFrequencyHz: 92,
        durationSeconds: 0.42,
        attackSeconds: 0.01,
        releaseSeconds: 0.24,
        gain: 0.14,
      };
    case 'torch_wave':
      return {
        waveform: 'triangle',
        frequencyHz: 380,
        endFrequencyHz: 520,
        durationSeconds: 0.28,
        attackSeconds: 0.008,
        releaseSeconds: 0.16,
        gain: 0.1,
      };
    case 'brazier_ignite':
      return {
        waveform: 'triangle',
        frequencyHz: 180,
        endFrequencyHz: 420,
        durationSeconds: 0.5,
        attackSeconds: 0.01,
        releaseSeconds: 0.22,
        gain: 0.15,
      };
    case 'ka_echo_pulse':
      return {
        waveform: 'sine',
        frequencyHz: 660,
        endFrequencyHz: 190,
        durationSeconds: 0.9,
        attackSeconds: 0.02,
        releaseSeconds: 0.35,
        gain: 0.13,
      };
    case 'dig_progress':
      return {
        waveform: 'square',
        frequencyHz: 150,
        endFrequencyHz: 180,
        durationSeconds: 0.12,
        attackSeconds: 0.004,
        releaseSeconds: 0.08,
        gain: 0.07,
      };
    case 'treasure_found':
      return {
        waveform: 'triangle',
        frequencyHz: 420,
        endFrequencyHz: 840,
        durationSeconds: 0.75,
        attackSeconds: 0.01,
        releaseSeconds: 0.28,
        gain: 0.16,
      };
    case 'player_hit':
      return {
        waveform: 'sawtooth',
        frequencyHz: 210,
        endFrequencyHz: 120,
        durationSeconds: 0.2,
        attackSeconds: 0.004,
        releaseSeconds: 0.11,
        gain: 0.13,
      };
    case 'enemy_down':
      return {
        waveform: 'square',
        frequencyHz: 240,
        endFrequencyHz: 100,
        durationSeconds: 0.36,
        attackSeconds: 0.006,
        releaseSeconds: 0.18,
        gain: 0.11,
      };
    case 'attack_swing':
      return {
        waveform: 'sawtooth',
        frequencyHz: 620,
        endFrequencyHz: 340,
        durationSeconds: 0.14,
        attackSeconds: 0.004,
        releaseSeconds: 0.09,
        gain: 0.07,
      };
    case 'attack_hit':
      return {
        waveform: 'square',
        frequencyHz: 190,
        endFrequencyHz: 90,
        durationSeconds: 0.16,
        attackSeconds: 0.003,
        releaseSeconds: 0.09,
        gain: 0.12,
        noise: true,
        noiseLowpassHz: 1500,
      };
    case 'player_dodge':
      return {
        waveform: 'triangle',
        frequencyHz: 500,
        endFrequencyHz: 760,
        durationSeconds: 0.18,
        attackSeconds: 0.006,
        releaseSeconds: 0.1,
        gain: 0.08,
      };
    case 'gold_pickup':
      return {
        waveform: 'sine',
        frequencyHz: 880,
        endFrequencyHz: 1320,
        durationSeconds: 0.22,
        attackSeconds: 0.004,
        releaseSeconds: 0.14,
        gain: 0.09,
      };
    case 'floor_complete':
      return {
        waveform: 'sine',
        frequencyHz: 330,
        endFrequencyHz: 990,
        durationSeconds: 1.1,
        attackSeconds: 0.02,
        releaseSeconds: 0.35,
        gain: 0.16,
      };
    case 'footstep_sand':
      // Passo sulla sabbia: rumore filtrato (granuli), breve
      return {
        waveform: 'triangle',
        frequencyHz: 120,
        endFrequencyHz: 70,
        durationSeconds: 0.07,
        attackSeconds: 0.002,
        releaseSeconds: 0.05,
        gain: 0.05,
        noise: true,
        noiseLowpassHz: 900,
      };
    case 'stair_descend':
      // Discesa della scala: caduta grave + riverbero ascendente
      return {
        waveform: 'sine',
        frequencyHz: 660,
        endFrequencyHz: 140,
        durationSeconds: 1.4,
        attackSeconds: 0.03,
        releaseSeconds: 0.6,
        gain: 0.14,
      };
    case 'door_creak':
      return {
        waveform: 'sawtooth',
        frequencyHz: 90,
        endFrequencyHz: 45,
        durationSeconds: 0.9,
        attackSeconds: 0.05,
        releaseSeconds: 0.4,
        gain: 0.09,
        noise: true,
        noiseLowpassHz: 500,
      };
    case 'ui_click':
      return {
        waveform: 'square',
        frequencyHz: 480,
        endFrequencyHz: 380,
        durationSeconds: 0.05,
        attackSeconds: 0.002,
        releaseSeconds: 0.03,
        gain: 0.05,
      };
    case 'fragment_pickup':
      // Frammento di Ka: campana alta e pulita
      return {
        waveform: 'sine',
        frequencyHz: 1046,
        endFrequencyHz: 1568,
        durationSeconds: 0.35,
        attackSeconds: 0.003,
        releaseSeconds: 0.25,
        gain: 0.1,
      };
    case 'player_death':
      return {
        waveform: 'sawtooth',
        frequencyHz: 300,
        endFrequencyHz: 55,
        durationSeconds: 1.2,
        attackSeconds: 0.01,
        releaseSeconds: 0.7,
        gain: 0.16,
      };
    case 'crit_hit':
      return {
        waveform: 'square',
        frequencyHz: 920,
        endFrequencyHz: 460,
        durationSeconds: 0.22,
        attackSeconds: 0.003,
        releaseSeconds: 0.12,
        gain: 0.14,
      };
    case 'parry_success':
      return {
        waveform: 'sine',
        frequencyHz: 620,
        endFrequencyHz: 1240,
        durationSeconds: 0.3,
        attackSeconds: 0.004,
        releaseSeconds: 0.18,
        gain: 0.12,
      };
    // ── Cue attacchi nemici (B-04 ext) ──────────────────────────────────────
    case 'scarab_click':
      // Scarabeo: click tagliente brevissimo (scatto delle mandibole)
      return {
        waveform: 'square',
        frequencyHz: 1200,
        endFrequencyHz: 700,
        durationSeconds: 0.04,
        attackSeconds: 0.002,
        releaseSeconds: 0.02,
        gain: 0.08,
      };
    case 'snake_hiss':
      // Cobra: sibili ad alta frequenza (rumore bianco filtrato, sibilanza)
      return {
        waveform: 'sine',
        frequencyHz: 2400,
        endFrequencyHz: 900,
        durationSeconds: 0.55,
        attackSeconds: 0.04,
        releaseSeconds: 0.28,
        gain: 0.07,
        noise: true,
        noiseLowpassHz: 5500,
      };
    case 'mummy_creak':
      // Mummia: cigolìo basso e legnoso (bendaggi + ossa secche)
      return {
        waveform: 'sawtooth',
        frequencyHz: 72,
        endFrequencyHz: 44,
        durationSeconds: 0.85,
        attackSeconds: 0.06,
        releaseSeconds: 0.45,
        gain: 0.11,
        noise: true,
        noiseLowpassHz: 380,
      };
    case 'mummy_grab':
      // Mummia: presa sorda (basso impatto + attrito)
      return {
        waveform: 'triangle',
        frequencyHz: 105,
        endFrequencyHz: 60,
        durationSeconds: 0.22,
        attackSeconds: 0.005,
        releaseSeconds: 0.13,
        gain: 0.1,
        noise: true,
        noiseLowpassHz: 620,
      };
    case 'shabti_swing':
      // Shabti: colpo pesante di scettro (pietra su pietra)
      return {
        waveform: 'sawtooth',
        frequencyHz: 230,
        endFrequencyHz: 110,
        durationSeconds: 0.38,
        attackSeconds: 0.005,
        releaseSeconds: 0.2,
        gain: 0.14,
        noise: true,
        noiseLowpassHz: 800,
      };
    case 'shabti_charge':
      // Shabti: carica — rombo crescente + impatto a terra
      return {
        waveform: 'triangle',
        frequencyHz: 55,
        endFrequencyHz: 28,
        durationSeconds: 0.9,
        attackSeconds: 0.12,
        releaseSeconds: 0.38,
        gain: 0.16,
        noise: true,
        noiseLowpassHz: 340,
      };
    case 'sobek_bite':
      // Figlio di Sobek: morso rotante (snap + schiocco)
      return {
        waveform: 'square',
        frequencyHz: 340,
        endFrequencyHz: 160,
        durationSeconds: 0.2,
        attackSeconds: 0.003,
        releaseSeconds: 0.1,
        gain: 0.15,
        noise: true,
        noiseLowpassHz: 1200,
      };
    case 'sobek_tail':
      // Figlio di Sobek: colpo di coda — tump grave + vibrazione
      return {
        waveform: 'sine',
        frequencyHz: 78,
        endFrequencyHz: 36,
        durationSeconds: 0.32,
        attackSeconds: 0.004,
        releaseSeconds: 0.18,
        gain: 0.14,
        noise: true,
        noiseLowpassHz: 480,
      };
    case 'royal_swing':
      // Mummia Reale: fendente reale — swing massiccio + aria spezzata
      return {
        waveform: 'sawtooth',
        frequencyHz: 165,
        endFrequencyHz: 72,
        durationSeconds: 0.5,
        attackSeconds: 0.006,
        releaseSeconds: 0.26,
        gain: 0.17,
        noise: true,
        noiseLowpassHz: 900,
      };
    case 'royal_curse':
      // Mummia Reale: Maledizione dei Faraoni — tono puro etereo discendente
      // (nessun rumore: effetto soprannaturale, distinto dal fendente fisico).
      // Onset lento (0.08 s) enfatizza l'anticip. da 1.4 s già visiva.
      return {
        waveform: 'sine',
        frequencyHz: 528,
        endFrequencyHz: 165,
        durationSeconds: 0.65,
        attackSeconds: 0.08,
        releaseSeconds: 0.35,
        gain: 0.13,
      };
    case 'priest_dart':
      // Sacerdote: dardo d'ombra — fischìo affilato discendente
      return {
        waveform: 'triangle',
        frequencyHz: 1400,
        endFrequencyHz: 560,
        durationSeconds: 0.12,
        attackSeconds: 0.003,
        releaseSeconds: 0.07,
        gain: 0.07,
      };
    case 'stone_scrape':
      // Ambiente: attrito pietra su pietra (inviluppo lento)
      return {
        waveform: 'sawtooth',
        frequencyHz: 95,
        endFrequencyHz: 58,
        durationSeconds: 1.1,
        attackSeconds: 0.15,
        releaseSeconds: 0.5,
        gain: 0.08,
        noise: true,
        noiseLowpassHz: 420,
      };
    default:
      return DEFAULT_CUE;
  }
}
