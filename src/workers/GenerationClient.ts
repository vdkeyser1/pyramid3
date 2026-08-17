/**
 * Scopo: client per il generation worker dal main thread.
 * Ownership: GameApplication.
 */

import type { FloorModel } from '@/procedural/FloorValidator.js';
import type { GenerationWorkerResponse } from '@/workers/generation.protocol.js';
import { createLogger } from '@/core/Logger.js';

const log = createLogger('GenerationClient');

export type GenerationCallback = (floor: FloorModel) => void;
export type GenerationErrorCallback = (error: string) => void;

export interface GenerationClient {
  request(
    input: {
      seed: number;
      generationVersion: number;
      isTutorial: boolean;
      floorIndex: number;
      preferEarlyMap?: boolean;
    },
    onReady: GenerationCallback,
    onError: GenerationErrorCallback,
  ): number;
  cancel(requestId: number): void;
  dispose(): void;
}

export function createGenerationClient(worker: Worker): GenerationClient {
  let nextRequestId = 1;
  const pending = new Map<number, { onReady: GenerationCallback; onError: GenerationErrorCallback }>();

  worker.onmessage = (event: MessageEvent<GenerationWorkerResponse>) => {
    const msg = event.data;
    if (msg.type === 'WORKER_READY') {
      log.info('Generation worker pronto');
      return;
    }

    const entry = pending.get(msg.requestId);
    if (!entry) return;

    switch (msg.type) {
      case 'FLOOR_READY':
        pending.delete(msg.requestId);
        entry.onReady(msg.floor);
        break;

      case 'GENERATION_ERROR':
        pending.delete(msg.requestId);
        log.error('Generation worker error', { requestId: msg.requestId, error: msg.error });
        entry.onError(msg.error);
        break;
    }
  };

  worker.onerror = (err: ErrorEvent) => {
    log.error('Generation worker crash', { message: err.message });
  };

  return {
    request(input, onReady, onError): number {
      const requestId = nextRequestId++;
      pending.set(requestId, { onReady, onError });

      worker.postMessage({
        type: 'GENERATE_FLOOR' as const,
        requestId,
        input,
      });

      setTimeout(() => {
        if (pending.has(requestId)) {
          pending.delete(requestId);
          log.error('Generation timeout', { requestId });
          onError('Timeout: generazione superato i 30 secondi');
        }
      }, 30_000);

      return requestId;
    },

    cancel(requestId: number): void {
      pending.delete(requestId);
      worker.postMessage({ type: 'CANCEL' as const, requestId });
    },

    dispose(): void {
      pending.clear();
      worker.terminate();
    },
  };
}
