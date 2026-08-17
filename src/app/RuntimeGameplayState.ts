/**
 * Scopo: stato runtime leggero per gli effetti ambientali gia' emessi come
 * DomainEvent ma non ancora coperti da sistemi dedicati completi.
 * Ownership: GameApplication. Tiene il wiring osservabile e testabile.
 */

import type { DomainEvent } from '@/simulation/DomainEventQueue.js';

const INITIAL_DARKNESS_LEVEL = 22;

export interface RuntimeGameplayState {
  readonly darknessLevel: number;
  readonly revealedRoomIds: readonly number[];
  /** Oro accumulato nella run corrente (non persiste tra le run, §11.1). */
  readonly goldCoins: number;
}

export interface RuntimeGameplayEventApplication {
  readonly state: RuntimeGameplayState;
  readonly changed: boolean;
  readonly darknessReliefApplied: number;
  readonly revealedRoomId: number | null;
  /** Oro aggiunto dall'evento corrente (0 se nessuno). */
  readonly goldAdded: number;
}

export function createRuntimeGameplayState(): RuntimeGameplayState {
  return {
    darknessLevel: INITIAL_DARKNESS_LEVEL,
    revealedRoomIds: [],
    goldCoins: 0,
  };
}

function unchanged(state: RuntimeGameplayState): RuntimeGameplayEventApplication {
  return {
    state,
    changed: false,
    darknessReliefApplied: 0,
    revealedRoomId: null,
    goldAdded: 0,
  };
}

function readFiniteNumber(data: Record<string, unknown> | undefined, key: string): number | null {
  const value = data?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function applyRuntimeGameplayEvent(
  state: RuntimeGameplayState,
  event: DomainEvent,
): RuntimeGameplayEventApplication {
  switch (event.kind) {
    case 'DARKNESS_RELIEF': {
      const reliefValue = readFiniteNumber(event.data, 'value');
      if (reliefValue === null || reliefValue <= 0) {
        return unchanged(state);
      }

      const nextDarkness = Math.max(0, state.darknessLevel - reliefValue);
      if (nextDarkness === state.darknessLevel) {
        return unchanged(state);
      }

      return {
        state: {
          ...state,
          darknessLevel: nextDarkness,
        },
        changed: true,
        darknessReliefApplied: state.darknessLevel - nextDarkness,
        revealedRoomId: null,
        goldAdded: 0,
      };
    }

    case 'MAP_REVEAL': {
      const roomId = readFiniteNumber(event.data, 'roomId');
      if (roomId === null || state.revealedRoomIds.includes(roomId)) {
        return unchanged(state);
      }

      return {
        state: {
          ...state,
          revealedRoomIds: [...state.revealedRoomIds, roomId],
        },
        changed: true,
        darknessReliefApplied: 0,
        revealedRoomId: roomId,
        goldAdded: 0,
      };
    }

    case 'ENEMY_DIED': {
      const goldDropped = readFiniteNumber(event.data, 'goldDropped');
      if (goldDropped === null || goldDropped <= 0) {
        return unchanged(state);
      }

      return {
        state: {
          ...state,
          goldCoins: state.goldCoins + goldDropped,
        },
        changed: true,
        darknessReliefApplied: 0,
        revealedRoomId: null,
        goldAdded: goldDropped,
      };
    }

    default:
      return unchanged(state);
  }
}
