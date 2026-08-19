import { describe, expect, it } from 'vitest';
import { WEAPON_KHOPESH } from '@/content/weapons.js';
import {
  applyAttackToSlice,
  createVerticalSliceState,
  getObjectiveText,
  getTargetHudText,
  tickVerticalSlice,
  tryCompleteSlice,
} from '@/gameplay/verticalSlice/VerticalSliceRuntime.js';
import type { FloorModel } from '@/procedural/FloorModel.js';

function createFloor(seed: number): FloorModel {
  return {
    floorId: `test-${seed}`,
    seed,
    generationVersion: 1,
    isTutorial: false,
    floorIndex: 1,
    rooms: [
      {
        id: 1 as never,
        role: 'ENTRY',
        bounds: { minX: -18, minZ: -6, maxX: -6, maxZ: 6 },
        doors: [2 as never],
        requiredKeyId: null,
        spawnClearanceM: 2.5,
        landmarkId: 'entry',
      },
      {
        id: 2 as never,
        role: 'MAP',
        bounds: { minX: -4, minZ: -6, maxX: 8, maxZ: 6 },
        doors: [1 as never, 3 as never, 4 as never],
        requiredKeyId: null,
        spawnClearanceM: 2.5,
        landmarkId: 'junction',
      },
      {
        id: 3 as never,
        role: 'TREASURE',
        bounds: { minX: 10, minZ: -14, maxX: 24, maxZ: -2 },
        doors: [2 as never],
        requiredKeyId: null,
        spawnClearanceM: 2.5,
        landmarkId: 'treasure',
      },
      {
        id: 4 as never,
        role: 'EXIT',
        bounds: { minX: 10, minZ: 2, maxX: 24, maxZ: 16 },
        doors: [2 as never],
        requiredKeyId: null,
        spawnClearanceM: 2.5,
        landmarkId: 'exit',
      },
    ],
    entryRoomId: 1 as never,
    exitRoomId: 4 as never,
    mapRoomId: 2 as never,
    treasureRoomId: 3 as never,
    keysByRoomId: {},
    exitIsStair: false,
  };
}

function createLShapedFloor(seed: number): FloorModel {
  return {
    floorId: `l-shaped-${seed}`,
    seed,
    generationVersion: 1,
    isTutorial: false,
    floorIndex: 1,
    rooms: [
      {
        id: 1 as never,
        role: 'ENTRY',
        bounds: { minX: -4, minZ: -8, maxX: 8, maxZ: 4 },
        doors: [2 as never],
        requiredKeyId: null,
        spawnClearanceM: 2.5,
        landmarkId: 'entry',
      },
      {
        id: 2 as never,
        role: 'MAP',
        bounds: { minX: -4, minZ: 12, maxX: 8, maxZ: 24 },
        doors: [1 as never, 3 as never, 4 as never],
        requiredKeyId: null,
        spawnClearanceM: 2.5,
        landmarkId: 'junction',
      },
      {
        id: 3 as never,
        role: 'TREASURE',
        bounds: { minX: 16, minZ: 12, maxX: 28, maxZ: 24 },
        doors: [2 as never],
        requiredKeyId: null,
        spawnClearanceM: 2.5,
        landmarkId: 'treasure',
      },
      {
        id: 4 as never,
        role: 'EXIT',
        bounds: { minX: -22, minZ: 12, maxX: -10, maxZ: 24 },
        doors: [2 as never],
        requiredKeyId: null,
        spawnClearanceM: 2.5,
        landmarkId: 'exit',
      },
    ],
    entryRoomId: 1 as never,
    exitRoomId: 4 as never,
    mapRoomId: 2 as never,
    treasureRoomId: 3 as never,
    keysByRoomId: {},
    exitIsStair: false,
  };
}

function createObstructedFloor(seed: number): FloorModel {
  return {
    floorId: `obstructed-${seed}`,
    seed,
    generationVersion: 1,
    isTutorial: false,
    floorIndex: 1,
    rooms: [
      {
        id: 1 as never,
        role: 'ENTRY',
        bounds: { minX: -24, minZ: -8, maxX: -12, maxZ: 8 },
        doors: [2 as never],
        requiredKeyId: null,
        spawnClearanceM: 2.5,
        landmarkId: 'entry',
      },
      {
        id: 2 as never,
        role: 'MAP',
        bounds: { minX: -8, minZ: -8, maxX: 4, maxZ: 8 },
        doors: [1 as never, 3 as never],
        requiredKeyId: null,
        spawnClearanceM: 2.5,
        landmarkId: 'junction',
      },
      {
        id: 3 as never,
        role: 'EXIT',
        bounds: { minX: 8, minZ: -8, maxX: 20, maxZ: 8 },
        doors: [2 as never],
        requiredKeyId: null,
        spawnClearanceM: 2.5,
        landmarkId: 'exit',
      },
      {
        id: 4 as never,
        role: 'TREASURE',
        bounds: { minX: 8, minZ: 10.3, maxX: 20, maxZ: 22.3 },
        doors: [],
        requiredKeyId: null,
        spawnClearanceM: 2.5,
        landmarkId: 'treasure',
      },
    ],
    entryRoomId: 1 as never,
    exitRoomId: 3 as never,
    mapRoomId: 2 as never,
    treasureRoomId: 4 as never,
    keysByRoomId: {},
    exitIsStair: false,
  };
}

describe('VerticalSliceRuntime', () => {
  it('sblocca l uscita quando il guardiano viene abbattuto', () => {
    const state = createVerticalSliceState(createFloor(1));
    state.target.hp = WEAPON_KHOPESH.damageHp;
    const attack = WEAPON_KHOPESH.attacks[0];
    expect(attack).toBeDefined();
    if (!attack) {
      throw new Error('Khopesh attack missing');
    }

    const result = applyAttackToSlice(state, attack, {
      x: state.target.position.x,
      y: state.target.position.y,
      z: state.target.position.z + 1.1,
      yaw: 0,
    });

    expect(result.kind).toBe('HIT');
    if (result.kind === 'HIT') {
      expect(result.killed).toBe(true);
    }
    expect(state.exitUnlocked).toBe(true);
    expect(getObjectiveText(state)).toContain('Varco aperto');
    expect(getTargetHudText(state)).toContain('neutralizzata');
  });

  it('rifiuta l uscita se il sigillo e ancora attivo', () => {
    const state = createVerticalSliceState(createFloor(2));

    expect(tryCompleteSlice(state, state.exitPosition)).toBe('LOCKED');
    expect(state.completed).toBe(false);
  });

  it('completa la slice solo vicino alla porta sbloccata', () => {
    const state = createVerticalSliceState(createFloor(3));
    state.exitUnlocked = true;

    expect(tryCompleteSlice(state, { x: 0, y: 0, z: 0 })).toBe('TOO_FAR');
    expect(tryCompleteSlice(state, state.exitPosition)).toBe('COMPLETE');
    expect(state.completed).toBe(true);
    expect(getObjectiveText(state)).toContain('Uscita confermata');
  });

  it('insegue lungo il grafo room-corridor invece di tagliare attraverso i muri', () => {
    const state = createVerticalSliceState(createLShapedFloor(4));
    state.target.awakened = true;
    state.target.wakeTicksRemaining = 0;
    const startX = state.target.position.x;
    const startZ = state.target.position.z;
    const playerPose = {
      x: 2,
      y: state.target.position.y,
      z: -2,
    };

    tickVerticalSlice(state, playerPose, 1 / 60);

    expect(state.target.position.x).toBeLessThan(startX);
    expect(state.target.position.z).toBeCloseTo(startZ, 4);
  });

  it('non colpisce attraverso una parete anche se il bersaglio e vicino', () => {
    const state = createVerticalSliceState(createObstructedFloor(5));
    state.target.position = { x: 14, y: state.target.position.y, z: 10.7 };
    const attack = WEAPON_KHOPESH.attacks[0];
    expect(attack).toBeDefined();
    if (!attack) {
      throw new Error('Khopesh attack missing');
    }

    const result = applyAttackToSlice(state, attack, {
      x: 14,
      y: state.target.position.y,
      z: 8.3,
      yaw: 0,
    });

    expect(result.kind).toBe('MISS_OBSTRUCTED');
  });

  it('applica danno al player una sola volta per ciclo di attacco e poi entra in cooldown', () => {
    const state = createVerticalSliceState(createFloor(6));
    const playerPose = {
      x: state.target.position.x,
      y: state.target.position.y,
      z: state.target.position.z + 1.2,
    };

    const wakeStart = tickVerticalSlice(state, playerPose, 1 / 60);
    expect(wakeStart.message).toContain('si desta');

    while (state.target.wakeTicksRemaining > 0) {
      tickVerticalSlice(state, playerPose, 1 / 60);
    }

    const windupStart = tickVerticalSlice(state, playerPose, 1 / 60);
    expect(windupStart.message).toContain('prepara');
    expect(state.target.attackWindupTicks).toBeGreaterThan(0);

    let playerDamageHp = 0;
    while (state.target.attackWindupTicks > 0 || playerDamageHp === 0) {
      playerDamageHp = tickVerticalSlice(state, playerPose, 1 / 60).playerDamageHp;
    }

    expect(playerDamageHp).toBeGreaterThan(0);
    expect(state.target.attackCooldownTicks).toBeGreaterThan(0);

    const cooldownTick = tickVerticalSlice(state, playerPose, 1 / 60);
    expect(cooldownTick.playerDamageHp).toBe(0);
  });
});
