/**
 * A-02: Generatore di Impulse Response (IR) sintetiche per reverb.
 *
 * Crea AudioBuffer di IR procedurali per diversi tipi di stanza,
 * eliminando la necessità di file IR campionati (nessun asset esterno).
 *
 * Algoritmo: IR esponenzialmente decrescente + riflessioni early-decay
 * Il risultato è un reverb naturale e variabile per tipo di stanza.
 *
 * Ownership: ReverbEngine lo usa per creare i ConvolverNode.
 *
 * VINCOLO: nessun performance.now(). AudioContext.sampleRate è la
 * sorgente di verità per il timing.
 */

export type RoomType =
  | 'CORRIDOR'      // corridoio stretto (breve reverb, early echo)
  | 'CHAMBER'       // stanza media (reverb bilanciato)
  | 'THRONE_ROOM'   // stanza grande (reverb lungo, maestoso)
  | 'SHAFT'         // pozzo verticale (flutter echo ripetuto)
  | 'BURIAL_CHAMBER'; // camera funeraria (reverb ovattato, bassa frequenza)

export interface IRParameters {
  /** Durata in secondi dell'IR. */
  readonly durationSec: number;
  /** Velocità di decadimento (decay rate). Più alto = più asciutto. */
  readonly decayRate: number;
  /** Numero di riflessioni early-decay. */
  readonly earlyReflections: number;
  /** Ritardo medio delle riflessioni early (secondi). */
  readonly reflectionDelay: number;
  /** Guadagno delle riflessioni early (0..1). */
  readonly reflectionGain: number;
  /** Filtro passa-basso per smorzare le alte frequenze (Hz, 0 = bypass). */
  readonly lowpassHz: number;
  /** Pre-delay (secondi). */
  readonly predelayMs: number;
}

const ROOM_PARAMS: Record<RoomType, IRParameters> = {
  CORRIDOR: {
    durationSec: 0.6,
    decayRate: 5.0,
    earlyReflections: 3,
    reflectionDelay: 0.03,
    reflectionGain: 0.4,
    lowpassHz: 4000,
    predelayMs: 5,
  },
  CHAMBER: {
    durationSec: 1.4,
    decayRate: 2.5,
    earlyReflections: 5,
    reflectionDelay: 0.06,
    reflectionGain: 0.5,
    lowpassHz: 3000,
    predelayMs: 15,
  },
  THRONE_ROOM: {
    durationSec: 3.0,
    decayRate: 1.2,
    earlyReflections: 8,
    reflectionDelay: 0.10,
    reflectionGain: 0.55,
    lowpassHz: 2500,
    predelayMs: 30,
  },
  SHAFT: {
    durationSec: 2.0,
    decayRate: 1.8,
    earlyReflections: 12,
    reflectionDelay: 0.045,
    reflectionGain: 0.6,
    lowpassHz: 2000,
    predelayMs: 8,
  },
  BURIAL_CHAMBER: {
    durationSec: 1.8,
    decayRate: 2.0,
    earlyReflections: 4,
    reflectionDelay: 0.08,
    reflectionGain: 0.35,
    lowpassHz: 1500, // molto ovattato
    predelayMs: 20,
  },
};

/**
 * Genera un AudioBuffer di IR sintetica per il tipo di stanza dato.
 * Algoritmo deterministic (nessun Math.random() — prevedibile e stabile).
 *
 * @param ctx — AudioContext attivo
 * @param roomType — tipo di stanza
 * @returns AudioBuffer pronto per ConvolverNode
 */
export function generateImpulseResponse(
  ctx: AudioContext,
  roomType: RoomType,
): AudioBuffer {
  const params = ROOM_PARAMS[roomType];
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(params.durationSec * sampleRate);
  const predelaySamples = Math.ceil((params.predelayMs / 1000) * sampleRate);

  // Stereo IR (2 canali): L e R leggermente diversi per larghezza spaziale
  const buffer = ctx.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    const channelOffset = channel === 0 ? 0 : 0.02; // piccola differenza L/R

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      if (i < predelaySamples) {
        data[i] = 0;
        continue;
      }

      const tDelayed = t - params.predelayMs / 1000;

      // Tail esponenzialmente decrescente (rumore deterministico)
      // Usiamo una sequenza pseudo-casuale deterministica (LCG) invece di
      // Math.random() per garantire ripetibilità tra sessioni.
      const noise = lcgNoise(i + channel * 12345 + 67890);
      const tail = noise * Math.exp(-params.decayRate * tDelayed);

      // Early reflections: picchi discreti
      let earlySum = 0;
      for (let r = 0; r < params.earlyReflections; r++) {
        const reflDelay = params.reflectionDelay * (r + 1) + channelOffset * r * 0.005;
        const reflT = Math.abs(tDelayed - reflDelay);
        if (reflT < 0.002) {
          // Finestra gaussiana stretta attorno al ritardo di riflessione
          earlySum += params.reflectionGain * Math.exp(-(reflT * reflT) / (2 * 0.001 * 0.001));
        }
      }

      data[i] = tail + earlySum * 0.3;
    }

    // Applica filtro LP via IIR semplice (1° ordine) se configurato
    if (params.lowpassHz > 0 && params.lowpassHz < sampleRate / 2) {
      applyLowpass1stOrder(data, params.lowpassHz, sampleRate);
    }

    // Normalizza il canale
    normalizeBuffer(data);
  }

  return buffer;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** LCG deterministico: produce valori in [-1, 1]. */
function lcgNoise(seed: number): number {
  // Parametri standard LCG (Numerical Recipes)
  const s = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return (s / 0x80000000) - 1;
}

/** Filtro LP 1° ordine in-place su Float32Array. */
function applyLowpass1stOrder(data: Float32Array, cutoffHz: number, sampleRate: number): void {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / sampleRate;
  const alpha = dt / (rc + dt);
  let prev = 0;
  for (let i = 0; i < data.length; i++) {
    prev = prev + alpha * ((data[i] ?? 0) - prev);
    data[i] = prev;
  }
}

/** Normalizza un Float32Array al picco massimo. */
function normalizeBuffer(data: Float32Array): void {
  let peak = 0;
  for (const sample of data) {
    const abs = Math.abs(sample);
    if (abs > peak) peak = abs;
  }
  if (peak > 0) {
    const inv = 1 / peak;
    for (let i = 0; i < data.length; i++) {
      data[i] = (data[i] ?? 0) * inv;
    }
  }
}
