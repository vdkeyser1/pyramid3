/**
 * A-02: ReverbEngine — ConvolverNode con IR sintetiche per stanze.
 *
 * Gestisce un pool di ConvolverNode (uno per tipo di stanza),
 * con crossfade quando il player cambia stanza.
 *
 * Routing audio:
 *   SFX bus → dry path (mix diretto)
 *                  ↘ wet path → ConvolverNode → ReverbBus → Master
 *
 * Il rapporto dry/wet è configurabile per stanza e cambia
 * linearmente (5 frame = ~83ms @60Hz) per evitare click.
 *
 * Ownership: createAudioEngine() lo integra nel bus graph.
 */

import { createLogger } from '@/core/Logger.js';
import { generateImpulseResponse, type RoomType } from '@/audio/SyntheticImpulseResponse.js';

const log = createLogger('ReverbEngine');

export interface ReverbEngine {
  /** Inizializza il ConvolverNode per il tipo di stanza attuale. */
  setRoomType(roomType: RoomType, dryWetRatio?: number): void;

  /** Restituisce il nodo di ingresso per il segnale da riverbere. */
  readonly inputNode: AudioNode;

  /** Restituisce il nodo di uscita (connette al bus master). */
  readonly outputNode: AudioNode;

  /**
   * Wet ratio corrente (0 = solo dry, 1 = solo wet).
   * Aggiornato automaticamente da setRoomType().
   */
  readonly wetRatio: number;

  dispose(): void;
}

/** Dry/wet ratio di default per tipo di stanza. */
const DEFAULT_WET: Record<RoomType, number> = {
  CORRIDOR:       0.25,
  CHAMBER:        0.40,
  THRONE_ROOM:    0.55,
  SHAFT:          0.50,
  BURIAL_CHAMBER: 0.45,
};

// Cache delle IR già generate (riutilizzate tra stanze dello stesso tipo)
const irCache = new Map<string, AudioBuffer>();

export function createReverbEngine(ctx: AudioContext): ReverbEngine {
  // Nodo di ingresso (dry split)
  const inputGain = ctx.createGain();
  inputGain.gain.value = 1.0;

  // Dry path: passthrough diretto
  const dryGain = ctx.createGain();
  dryGain.gain.value = 0.75;

  // Wet path: convolver → wet gain
  let convolver: ConvolverNode = ctx.createConvolver();
  const wetGain = ctx.createGain();
  wetGain.gain.value = 0.25;

  // Output merge
  const outputGain = ctx.createGain();
  outputGain.gain.value = 1.0;

  // Routing iniziale
  inputGain.connect(dryGain);
  inputGain.connect(convolver);
  convolver.connect(wetGain);
  dryGain.connect(outputGain);
  wetGain.connect(outputGain);

  let currentWet = 0.25;
  let currentRoom: RoomType | null = null;

  const loadIR = (roomType: RoomType): void => {
    const cacheKey = roomType;
    let buffer = irCache.get(cacheKey);

    if (!buffer) {
      buffer = generateImpulseResponse(ctx, roomType);
      irCache.set(cacheKey, buffer);
      log.info(`IR generata per ${roomType} (${buffer.duration.toFixed(2)}s)`);
    }

    // Crea nuovo convolver con la nuova IR
    const newConvolver = ctx.createConvolver();
    newConvolver.buffer = buffer;
    newConvolver.normalize = false; // normalizziamo noi nell'IR generator

    // Riconnetti: vecchio convolver → disconnect, nuovo → connect
    convolver.disconnect();
    convolver = newConvolver;
    convolver.connect(wetGain);
    inputGain.connect(convolver);
  };

  return {
    get inputNode() { return inputGain; },
    get outputNode() { return outputGain; },
    get wetRatio() { return currentWet; },

    setRoomType(roomType, dryWetRatio) {
      if (roomType === currentRoom) return; // nessun cambio
      currentRoom = roomType;

      const targetWet = dryWetRatio ?? DEFAULT_WET[roomType];
      const now = ctx.currentTime;
      const FADE_SEC = 0.08; // 80ms crossfade

      // Crossfade dry ↔ wet
      dryGain.gain.cancelScheduledValues(now);
      wetGain.gain.cancelScheduledValues(now);

      dryGain.gain.setTargetAtTime(1 - targetWet, now, FADE_SEC);
      wetGain.gain.setTargetAtTime(targetWet,     now, FADE_SEC);

      currentWet = targetWet;

      // Carica la nuova IR (può essere dalla cache → veloce)
      loadIR(roomType);

      log.info(`Stanza cambiata: ${roomType}, wet=${(targetWet * 100).toFixed(0)}%`);
    },

    dispose() {
      inputGain.disconnect();
      dryGain.disconnect();
      wetGain.disconnect();
      convolver.disconnect();
      outputGain.disconnect();
      irCache.clear();
    },
  };
}
