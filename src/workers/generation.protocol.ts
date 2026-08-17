/**
 * Scopo: protocollo di comunicazione main thread ↔ generation worker.
 * Ownership: condivisa. Usata da GenerationClient (main) e generation.worker.ts.
 *
 * Transferable objects: FloorModel serializzato viene trasferito senza copia.
 */

import type { FloorGenerationInput } from '@/procedural/FloorModel.js';
import type { FloorModel } from '@/procedural/FloorValidator.js';

export type GenerationWorkerRequest =
  | {
      readonly type: 'GENERATE_FLOOR';
      readonly requestId: number;
      readonly input: FloorGenerationInput;
    }
  | {
      readonly type: 'CANCEL';
      readonly requestId: number;
    };

export type GenerationWorkerResponse =
  | {
      readonly type: 'FLOOR_READY';
      readonly requestId: number;
      readonly floor: FloorModel;
    }
  | {
      readonly type: 'GENERATION_ERROR';
      readonly requestId: number;
      readonly error: string;
    }
  | {
      readonly type: 'WORKER_READY';
    };
