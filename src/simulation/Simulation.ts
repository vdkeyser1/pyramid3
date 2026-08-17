/**
 * Scopo: orchestratore centrale della simulazione di gioco.
 * Ownership: GameApplication lo crea e lo distrugge.
 *
 * La Simulation coordina world ECS, scheduler sistemi, event queue e snapshot.
 * Non dipende da rendering, fisica concreta, o storage.
 */

import { type World, createWorld } from '@/ecs/World.js';
import { type SystemScheduler, createSystemScheduler } from '@/core/SystemScheduler.js';
import { type FixedStepClock } from '@/core/FixedStepClock.js';
import { type DomainEventQueue, createDomainEventQueue } from '@/simulation/DomainEventQueue.js';
import type { SimulationSnapshot } from '@/simulation/SimulationSnapshot.js';
import { createLogger, type Logger } from '@/core/Logger.js';

export interface Simulation {
  readonly world: World;
  readonly scheduler: SystemScheduler;
  readonly events: DomainEventQueue;
  readonly log: Logger;

  /** Avanza la simulazione di un tick. */
  step(tick: number, deltaMs: number): void;

  /** Produce uno snapshot per il rendering (solo dati necessari). */
  snapshot(): SimulationSnapshot;

  /** Rilascia tutte le risorse. */
  dispose(): void;
}

export function createSimulation(clock: FixedStepClock): Simulation {
  const world = createWorld();
  const scheduler = createSystemScheduler();
  const events = createDomainEventQueue();
  const log = createLogger('Simulation');

  return {
    world,
    scheduler,
    events,
    log,

    step(tick: number, deltaMs: number): void {
      events.clearFrame();
      scheduler.tick(tick, deltaMs);
    },

    snapshot(): SimulationSnapshot {
      return {
        tick: clock.currentTick,
        simulationTimeMs: clock.simulationTimeMs,
        playerEntityId: null, // verrà popolato dal sistema player
      };
    },

    dispose(): void {
      log.info('Simulation disposed');
    },
  };
}
