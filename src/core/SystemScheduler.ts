/**
 * Scopo: scheduler a fasi fisse che orchestra i sistemi di simulazione in ordine.
 * Ownership: Simulation lo possiede; i sistemi vengono registrati dal GameApplication.
 *
 * Ordine canonico:
 *   Input → AI (10 Hz) → Physics (60 Hz fixed) → Gameplay → Animation → Render
 */

export type SystemPhase =
  | 'input'
  | 'ai'
  | 'physics'
  | 'gameplay'
  | 'animation'
  | 'render';

export interface System {
  readonly name: string;
  readonly phase: SystemPhase;
  /** Eseguito a ogni tick di simulazione. */
  update(tick: number, deltaMs: number): void;
}

const PHASE_ORDER: Record<SystemPhase, number> = {
  input: 0,
  ai: 1,
  physics: 2,
  gameplay: 3,
  animation: 4,
  render: 5,
};

export interface SystemScheduler {
  register(system: System): void;
  unregister(name: string): void;
  tick(tick: number, deltaMs: number): void;
}

export function createSystemScheduler(): SystemScheduler {
  const systems: System[] = [];

  function sortSystems(): void {
    systems.sort((a, b) => PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase]);
  }

  return {
    register(system: System): void {
      const idx = systems.findIndex((s) => s.name === system.name);
      if (idx >= 0) systems[idx] = system;
      else systems.push(system);
      sortSystems();
    },

    unregister(name: string): void {
      const idx = systems.findIndex((s) => s.name === name);
      if (idx >= 0) systems.splice(idx, 1);
    },

    tick(tick: number, deltaMs: number): void {
      for (const system of systems) {
        system.update(tick, deltaMs);
      }
    },
  };
}
