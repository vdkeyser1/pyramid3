/**
 * Scopo: orchestratore runtime degli spawn nemici del Threat Director (G-03).
 * Ownership: simulation. Possiede lo stato Director per l'intero piano e
 * consuma il budget progressivamente: uno spawn iniziale + follow-up quando
 * i nemici muoiono, finché il budget lo consente.
 * Invarianti:
 *   - ogni piano ha UN solo DirectorState, creato dal seed del floor;
 *   - planNext() consuma budget solo se canSpawn() passa (mai sopra budget);
 *   - la scelta dell'archetipo è deterministica (hash di seed+floorIndex+conteggio);
 *   - dopo un wipe, il grace period blocca gli spawn per retryGraceTicks.
 * Failure mode: budget esaurito o nessuna stanza valida → null (piano senza
 *   nemici, mai un crash).
 */

import { hash32 } from '@/procedural/Hash32.js';
import type { RoomId } from '@/procedural/Ids.js';
import {
  availableTemplates,
  canSpawn,
  commitSpawn,
  createDirectorState,
  onRoomEntered,
  tickDirector,
  type DirectorContext,
  type DirectorState,
  type SpawnRequest,
} from '@/simulation/Director.js';
import type { FloorSceneLayout } from '@/world/FloorSceneLayout.js';
import { ENEMY_TEMPLATES } from '@/content/enemyTemplates.js';

export interface EnemySpawnDirectorOptions {
  readonly sceneLayout: FloorSceneLayout;
  readonly entryRoomId: RoomId;
  readonly floorSeed: number;
  readonly floorIndex: number;
  readonly currentFuelSeconds: number;
  readonly metaNodes: number;
  readonly hadWipeThisFloor: boolean;
  /** Budget base del piano (scala con la piramide). Default: 6. */
  readonly baseBudget?: number;
}

export interface PlannedEnemySpawn {
  readonly enemyType: string;
  readonly roomId: RoomId;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly distanceToPlayerM: number;
  readonly budgetRemaining: number;
}

const DEFAULT_BASE_BUDGET = 6;
const SPAWN_Y = 0.52;
const OFFSET_X = 1.35;
const OFFSET_Z = -1.1;
const ROOM_INSET_M = 1.7;

function distanceXZ(
  a: { readonly x: number; readonly z: number },
  b: { readonly x: number; readonly z: number },
): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface EnemySpawnDirector {
  /** Stato Director sottostante (per ispezione/test). */
  readonly state: DirectorState;
  /** Consuma budget per pianificare il prossimo spawn (iniziale o follow-up). */
  planNext(): PlannedEnemySpawn | null;
  /** Notifica ingresso in una nuova stanza (rate-limit incontri non-telegrafati). */
  onRoomEntered(): void;
  /** Tick del grace period (da chiamare ogni step di simulazione). */
  tick(): void;
  /**
   * G-04/A-01: marca una stanza come illuminata (braciere acceso) — la luce
   * è un presidio territoriale: gli spawn la evitano finché ci sono
   * alternative (fallback se tutte le stanze sono illuminate).
   */
  setLitRoom(roomId: RoomId, lit: boolean): void;
}

export function createEnemySpawnDirector(
  options: EnemySpawnDirectorOptions,
): EnemySpawnDirector {
  const baseBudget = options.baseBudget ?? DEFAULT_BASE_BUDGET;
  const context: DirectorContext = {
    metaNodes: options.metaNodes,
    floorIndex: options.floorIndex,
    floorSeed: options.floorSeed,
    currentFuelSeconds: options.currentFuelSeconds,
    roomsVisited: 0,
    hadWipeThisFloor: options.hadWipeThisFloor,
  };
  const state = createDirectorState(context, baseBudget);
  let spawnCount = 0;
  // G-04/A-01: stanze illuminate da bracieri (presidio territoriale).
  const litRoomIds = new Set<RoomId>();

  function planNext(): PlannedEnemySpawn | null {
    const templates = availableTemplates(ENEMY_TEMPLATES, options.floorIndex);
    if (templates.length === 0) {
      return null;
    }

    // Scelta deterministica: seed + floorIndex + conteggio spawn → indice.
    const pickRoll = hash32(options.floorSeed, options.floorIndex, spawnCount, 0x5eed) / 0x100000000;
    const templateIndex = Math.floor(pickRoll * templates.length);
    const template = templates[templateIndex];
    if (!template) {
      return null;
    }

    const candidateRooms = options.sceneLayout.rooms
      .filter((room) =>
        room.roomId !== options.sceneLayout.targetRoomId &&
        room.roomId !== options.entryRoomId,
      )
      .map((room) => ({
        room,
        distanceToPlayerM: distanceXZ(options.sceneLayout.entrySpawn, room.center),
      }))
      .sort((left, right) => {
        // G-04/A-01: le stanze illuminate vanno in FONDO alla coda — la luce
        // riduce la pressione nemica nell'area (fallback: se tutte illuminate,
        // lo spawn avviene comunque sull'ultima stanza disponibile).
        const leftLit = litRoomIds.has(left.room.roomId) ? 1 : 0;
        const rightLit = litRoomIds.has(right.room.roomId) ? 1 : 0;
        if (leftLit !== rightLit) {
          return leftLit - rightLit;
        }
        if (right.distanceToPlayerM !== left.distanceToPlayerM) {
          return right.distanceToPlayerM - left.distanceToPlayerM;
        }
        return Number(left.room.roomId) - Number(right.room.roomId);
      });

    for (const candidate of candidateRooms) {
      if (
        !canSpawn(
          state,
          candidate.distanceToPlayerM,
          options.currentFuelSeconds,
          template,
        )
      ) {
        continue;
      }

      const request: SpawnRequest = {
        enemyType: template.type,
        roomId: candidate.room.roomId,
        cost: template.budgetCost,
      };
      commitSpawn(state, request, template);
      spawnCount++;

      return {
        enemyType: template.type,
        roomId: candidate.room.roomId,
        position: {
          x: clamp(
            candidate.room.center.x + OFFSET_X,
            candidate.room.bounds.minX + ROOM_INSET_M,
            candidate.room.bounds.maxX - ROOM_INSET_M,
          ),
          y: SPAWN_Y,
          z: clamp(
            candidate.room.center.z + OFFSET_Z,
            candidate.room.bounds.minZ + ROOM_INSET_M,
            candidate.room.bounds.maxZ - ROOM_INSET_M,
          ),
        },
        distanceToPlayerM: candidate.distanceToPlayerM,
        budgetRemaining: state.budgetRemaining,
      };
    }

    return null;
  }

  return {
    get state() {
      return state;
    },
    planNext,
    onRoomEntered(): void {
      onRoomEntered(state);
    },
    tick(): void {
      tickDirector(state);
    },
    setLitRoom(roomId: RoomId, lit: boolean): void {
      if (lit) {
        litRoomIds.add(roomId);
      } else {
        litRoomIds.delete(roomId);
      }
    },
  };
}
