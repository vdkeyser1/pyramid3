import { describe, expect, it } from 'vitest';
import {
  computeFloorBudget,
  createDirectorState,
  tickDirector,
  canSpawn,
  commitSpawn,
  onRoomEntered,
  availableTemplates,
  type DirectorContext,
  type EnemyTemplate,
  type SpawnRequest,
} from '@/simulation/Director.js';
import { DIRECTOR } from '@/content/balance.js';
import type { RoomId } from '@/procedural/Ids.js';

const BASE_CTX: DirectorContext = {
  metaNodes: 0,
  floorIndex: 1,
  floorSeed: 42,
  currentFuelSeconds: 180,
  roomsVisited: 0,
  hadWipeThisFloor: false,
};

const SCARAB: EnemyTemplate = {
  type: 'SCARAB',
  budgetCost: 2,
  minFloor: 1,
  maxFloor: 10,
  telegraphed: true,
};

const AMBUSH: EnemyTemplate = {
  type: 'SHADOW',
  budgetCost: 3,
  minFloor: 3,
  maxFloor: 8,
  telegraphed: false,
};

describe('Director', () => {
  it('computeFloorBudget con 0 nodi meta → nessun extra', () => {
    const budget = computeFloorBudget(100, 0, false);
    expect(budget).toBe(100); // band 0: extraBudgetFactor 0.0
  });

  it('computeFloorBudget cresce con nodi meta', () => {
    const b0 = computeFloorBudget(100, 0, false);
    const b5 = computeFloorBudget(100, 5, false);
    expect(b5).toBeGreaterThan(b0);
  });

  it('computeFloorBudget ridotto dopo wipe (×0.75)', () => {
    const normal = computeFloorBudget(100, 0, false);
    const wipe = computeFloorBudget(100, 0, true);
    expect(wipe).toBe(Math.round(normal * DIRECTOR.retryGraceBudgetFactor));
  });

  it('createDirectorState con wipe → grace ticks attivi', () => {
    const state = createDirectorState({ ...BASE_CTX, hadWipeThisFloor: true }, 100);
    expect(state.graceTicksRemaining).toBe(DIRECTOR.retryGraceTicks);
  });

  it('createDirectorState senza wipe → no grace', () => {
    const state = createDirectorState(BASE_CTX, 100);
    expect(state.graceTicksRemaining).toBe(0);
  });

  it('tickDirector decrementa grace ticks', () => {
    const state = createDirectorState({ ...BASE_CTX, hadWipeThisFloor: true }, 100);
    const before = state.graceTicksRemaining;
    tickDirector(state);
    expect(state.graceTicksRemaining).toBe((before as number) - 1);
  });

  it('canSpawn rifiuta durante grace period', () => {
    const state = createDirectorState({ ...BASE_CTX, hadWipeThisFloor: true }, 100);
    expect(canSpawn(state, 10, 180, SCARAB)).toBe(false);
  });

  it('canSpawn rifiuta troppo vicino al giocatore (<4m)', () => {
    const state = createDirectorState(BASE_CTX, 100);
    expect(canSpawn(state, 3, 180, SCARAB)).toBe(false);
    expect(canSpawn(state, 5, 180, SCARAB)).toBe(true);
  });

  it('canSpawn rifiuta imboscate non-telegrafate sotto 15s fuel', () => {
    const state = createDirectorState(BASE_CTX, 100);
    expect(canSpawn(state, 10, 10, AMBUSH)).toBe(false);
    expect(canSpawn(state, 10, 10, SCARAB)).toBe(true); // telegraphed OK
  });

  it('canSpawn rifiuta se budget insufficiente', () => {
    const state = createDirectorState(BASE_CTX, 100);
    state.budgetRemaining = 1;
    expect(canSpawn(state, 10, 180, SCARAB)).toBe(false); // cost 2
  });

  it('commitSpawn scala il budget', () => {
    const state = createDirectorState(BASE_CTX, 100);
    const before = state.budgetRemaining;
    const request: SpawnRequest = { enemyType: 'SCARAB', roomId: 1 as RoomId, cost: 2 };
    commitSpawn(state, request, SCARAB);
    expect(state.budgetRemaining).toBe(before - 2);
    expect(state.spawnedThisFloor).toHaveLength(1);
  });

  it('onRoomEntered incrementa contatore stanze', () => {
    const state = createDirectorState(BASE_CTX, 100);
    expect(state.untelegraphedSinceRooms).toBe(0);
    onRoomEntered(state);
    expect(state.untelegraphedSinceRooms).toBe(1);
  });

  it('availableTemplates filtra per piano', () => {
    const templates = [SCARAB, AMBUSH];
    expect(availableTemplates(templates, 1)).toEqual([SCARAB]); // AMBUSH minFloor=3
    expect(availableTemplates(templates, 5)).toEqual([SCARAB, AMBUSH]);
    expect(availableTemplates(templates, 11)).toEqual([]); // SCARAB maxFloor=10
  });
});
