/**
 * Scopo: Web Worker per la generazione procedurale off-thread.
 * Ownership: eseguito in un worker dedicato.
 */

import { generateFloor } from '@/procedural/FloorGenerator.js';
import type { GenerationWorkerRequest, GenerationWorkerResponse } from '@/workers/generation.protocol.js';

self.onmessage = (event: MessageEvent<GenerationWorkerRequest>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'GENERATE_FLOOR': {
      try {
        const floor = generateFloor(msg.input);
        const response: GenerationWorkerResponse = {
          type: 'FLOOR_READY',
          requestId: msg.requestId,
          floor,
        };
        self.postMessage(response);
      } catch (err: unknown) {
        const response: GenerationWorkerResponse = {
          type: 'GENERATION_ERROR',
          requestId: msg.requestId,
          error: err instanceof Error ? err.message : String(err),
        };
        self.postMessage(response);
      }
      break;
    }

    case 'CANCEL':
      break;

    default: {
      const _exhaustive: never = msg;
      void _exhaustive;
    }
  }
};

const readyResponse: GenerationWorkerResponse = { type: 'WORKER_READY' };
self.postMessage(readyResponse);
