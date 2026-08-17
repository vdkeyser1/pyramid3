/**
 * Scopo: sistema ECS che orchestra il PlayerCharacterController.
 * Ownership: Simulation registra questo sistema nella fase 'input'.
 *
 * Riceve input dal polling (tastiera/mouse), li traduce in PlayerInput,
 * e li passa al PlayerCharacterController.update().
 *
 * Responsabile anche di sincronizzare la posizione player nel TransformStore
 * per il rendering.
 */

import type { System } from '@/core/SystemScheduler.js';
import type { World } from '@/ecs/World.js';
import type { EntityId } from '@/ecs/EntityAllocator.js';
import {
  type PlayerCharacterController,
  type PlayerInput,
  EMPTY_INPUT,
} from '@/gameplay/player/PlayerCharacterController.js';

/**
 * Interfaccia per il polling dell'input.
 * Separata per testabilità e per permettere diverse sorgenti
 * (tastiera, gamepad, replay).
 */
export interface InputSource {
  /** Restituisce l'input corrente per questo frame. */
  poll(): PlayerInput;
}

/** Input source che restituisce sempre input vuoto (nessun input). */
export const EMPTY_INPUT_SOURCE: InputSource = {
  poll: () => EMPTY_INPUT,
};

export interface PlayerSystemDeps {
  readonly world: World;
  readonly controller: PlayerCharacterController;
  readonly playerEntityId: EntityId;
  readonly inputSource: InputSource;
}

export function createPlayerSystem(deps: PlayerSystemDeps): System {
  const { world, controller, playerEntityId, inputSource } = deps;

  return {
    name: 'PlayerSystem',
    phase: 'input',

    update(tick: number, deltaMs: number): void {
      const input = inputSource.poll();
      controller.update(input, tick, deltaMs);

      // Sincronizza la posizione del player nel TransformStore
      const state = controller.getState();
      world.transform.setPosition(
        playerEntityId,
        state.position.x,
        state.position.y,
        state.position.z,
      );
    },
  };
}
