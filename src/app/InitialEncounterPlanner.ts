/**
 * Scopo: instradare gli incontri iniziali del vertical slice attraverso il
 * Director senza introdurre ancora un vero EnemySpawnSystem continuo.
 * Ownership: bridge puro usato da GameApplication in bootstrap.
 */

import type { RoomId } from '@/procedural/Ids.js';
import { hash32 } from '@/procedural/Hash32.js';
import {
  availableTemplates,
  canSpawn,
  commitSpawn,
  createDirectorState,
  type DirectorContext,
  type SpawnRequest,
} from '@/simulation/Director.js';
import type { FloorSceneLayout } from '@/world/FloorSceneLayout.js';
import { ENEMY_TEMPLATES } from '@/content/enemyTemplates.js';

const INITIAL_ENCOUNTER_BUDGET = 6;
const SCARAB_SPAWN_Y = 0.52;
const SCARAB_OFFSET_X = 1.35;
const SCARAB_OFFSET_Z = -1.1;
const ROOM_INSET_M = 1.7;

export interface InitialEncounterPlanInput {
  readonly sceneLayout: FloorSceneLayout;
  readonly entryRoomId: RoomId;
  readonly floorSeed: number;
  readonly floorIndex: number;
  readonly currentFuelSeconds: number;
  readonly metaNodes: number;
  readonly hadWipeThisFloor: boolean;
}

export interface PlannedEncounterSpawn {
  readonly enemyType: string;
  readonly roomId: RoomId;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly distanceToPlayerM: number;
  readonly budgetRemaining: number;
}

function distanceXZ(
  a: { readonly x: number; readonly z: number },
  b: { readonly x: number; readonly z: number },
): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createDirectorContext(input: InitialEncounterPlanInput): DirectorContext {
  return {
    metaNodes: input.metaNodes,
    floorIndex: input.floorIndex,
    floorSeed: input.floorSeed,
    currentFuelSeconds: input.currentFuelSeconds,
    roomsVisited: 0,
    hadWipeThisFloor: input.hadWipeThisFloor,
  };
}

/**
 * Pianifica l'incontro iniziale del piano: sceglie deterministicamente (dal
 * seed) un template disponibile per il piano, lo posiziona nella stanza più
 * lontana dall'entry che soddisfa i vincoli del Director, e consuma il budget.
 *
 * Il seed rende la scelta riproducibile: stesso floor ⇒ stesso archetipo,
 * mentre piani diversi dello stesso seed possono avere incontri diversi.
 */
export function planInitialEncounter(
  input: InitialEncounterPlanInput,
): PlannedEncounterSpawn | null {
  const templates = availableTemplates(ENEMY_TEMPLATES, input.floorIndex);
  if (templates.length === 0) {
    return null;
  }

  // Scelta deterministica dell'archetipo: hash(seed, floorIndex) → indice.
  const pickRoll = hash32(input.floorSeed, input.floorIndex, 0x5eed) / 0x100000000;
  const templateIndex = Math.floor(pickRoll * templates.length);
  const template = templates[templateIndex];
  if (!template) {
    return null;
  }

  const directorState = createDirectorState(
    createDirectorContext(input),
    INITIAL_ENCOUNTER_BUDGET,
  );
  const candidateRooms = input.sceneLayout.rooms
    .filter((room) =>
      room.roomId !== input.sceneLayout.targetRoomId &&
      room.roomId !== input.entryRoomId,
    )
    .map((room) => ({
      room,
      distanceToPlayerM: distanceXZ(input.sceneLayout.entrySpawn, room.center),
    }))
    .sort((left, right) => {
      if (right.distanceToPlayerM !== left.distanceToPlayerM) {
        return right.distanceToPlayerM - left.distanceToPlayerM;
      }
      return Number(left.room.roomId) - Number(right.room.roomId);
    });

  for (const candidate of candidateRooms) {
    if (
      !canSpawn(
        directorState,
        candidate.distanceToPlayerM,
        input.currentFuelSeconds,
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
    commitSpawn(directorState, request, template);

    return {
      enemyType: template.type,
      roomId: candidate.room.roomId,
      position: {
        x: clamp(
          candidate.room.center.x + SCARAB_OFFSET_X,
          candidate.room.bounds.minX + ROOM_INSET_M,
          candidate.room.bounds.maxX - ROOM_INSET_M,
        ),
        y: SCARAB_SPAWN_Y,
        z: clamp(
          candidate.room.center.z + SCARAB_OFFSET_Z,
          candidate.room.bounds.minZ + ROOM_INSET_M,
          candidate.room.bounds.maxZ - ROOM_INSET_M,
        ),
      },
      distanceToPlayerM: candidate.distanceToPlayerM,
      budgetRemaining: directorState.budgetRemaining,
    };
  }

  return null;
}

// Back-compat: il vecchio nome usato da GameApplication resta come alias
// dell'incontro pianificato (solo SCARAB era possibile prima di G-11).
export function planInitialScarabSpawn(
  input: InitialEncounterPlanInput,
): PlannedEncounterSpawn | null {
  return planInitialEncounter(input);
}
