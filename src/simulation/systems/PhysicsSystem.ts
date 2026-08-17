/**
 * Scopo: sistema ECS che orchestra lo stepping del mondo fisico Rapier.
 * Ownership: Simulation registra questo sistema nella fase 'physics'.
 *
 * Eseguito a ogni tick di simulazione (60 Hz), chiama world.step()
 * per avanzare la simulazione fisica.
 */

import type { System } from '@/core/SystemScheduler.js';
import type { PhysicsWorld } from '@/physics/PhysicsWorld.js';

export function createPhysicsSystem(physicsWorld: PhysicsWorld): System {
  return {
    name: 'PhysicsSystem',
    phase: 'physics',

    update(_tick: number, _deltaMs: number): void {
      physicsWorld.step();
    },
  };
}
