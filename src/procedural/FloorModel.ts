/**
 * Scopo: input e output del generatore di piani.
 * Ownership: pura. Condivisa tra main thread e generation worker.
 */

import type { FloorModel } from '@/procedural/FloorValidator.js';

export interface FloorGenerationInput {
  readonly seed: number;
  readonly generationVersion: number;
  readonly isTutorial: boolean;
  readonly floorIndex: number;
  readonly preferEarlyMap?: boolean;
}

export { type FloorModel };
