/**
 * Scopo: snapshot immutabile dello stato di simulazione per il rendering.
 * Ownership: Simulation lo produce, RendererService lo consuma.
 *
 * Lo snapshot contiene SOLO i dati necessari al rendering.
 * Nessun riferimento a oggetti Three, Rapier o DOM.
 */

import type { EntityId } from '@/ecs/EntityAllocator.js';

export interface SimulationSnapshot {
  readonly tick: number;
  readonly simulationTimeMs: number;
  readonly playerEntityId: EntityId | null;
}
