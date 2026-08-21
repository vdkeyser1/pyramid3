import { describe, expect, it } from 'vitest';
import { planInitialScarabSpawn } from '@/app/InitialEncounterPlanner.js';
import { ENEMY_TEMPLATES, validateEnemyTemplates } from '@/content/enemyTemplates.js';
import type { RoomId } from '@/procedural/Ids.js';
import type { FloorSceneLayout } from '@/world/FloorSceneLayout.js';

function roomId(value: number): RoomId {
  return value as RoomId;
}

function createLayout(): FloorSceneLayout {
  return {
    floorId: 'floor-1',
    floorIndex: 1,
    entrySpawn: { x: 0, y: 0, z: 0 },
    targetPosition: { x: 40, y: 1.05, z: 0 },
    targetRoomId: roomId(3),
    exitPosition: { x: 60, y: 1.75, z: 0 },
    exitDoorClosedPosition: { x: 61, y: 1.75, z: 0 },
    exitDoorOpenPosition: { x: 61, y: 1.75, z: 1.25 },
    exitDoorYawRad: 0,
    exitIsStair: true,
    stairBottom: null,
    exitDirection: 'east',
    rooms: [
      {
        roomId: roomId(1),
        role: 'ENTRY',
        bounds: { minX: -6, minZ: -6, maxX: 6, maxZ: 6 },
        center: { x: 0, y: 0, z: 0 },
        landmarkId: null,
        theme: 'PLAIN' as const,
        openings: ['east'],
      },
      {
        roomId: roomId(2),
        role: 'MAP',
        bounds: { minX: 24, minZ: -6, maxX: 36, maxZ: 6 },
        center: { x: 30, y: 0, z: 0 },
        landmarkId: null,
        theme: 'PLAIN' as const,
        openings: ['west', 'east'],
      },
      {
        roomId: roomId(3),
        role: 'TREASURE',
        bounds: { minX: 44, minZ: -6, maxX: 56, maxZ: 6 },
        center: { x: 50, y: 0, z: 0 },
        landmarkId: null,
        theme: 'PLAIN' as const,
        openings: ['west'],
      },
      {
        roomId: roomId(4),
        role: 'OPTIONAL',
        bounds: { minX: 8, minZ: -6, maxX: 20, maxZ: 6 },
        center: { x: 14, y: 0, z: 0 },
        landmarkId: null,
        theme: 'PLAIN' as const,
        openings: ['west', 'east'],
      },
    ],
    corridors: [],
    landmarks: [],
    braziers: [],
    doorways: [],
    digSite: null,
    shovelPickup: null,
  };
}

describe('InitialEncounterPlanner', () => {
  it('instrada l incontro nella stanza valida piu distante dal player', () => {
    const plan = planInitialScarabSpawn({
      sceneLayout: createLayout(),
      entryRoomId: roomId(1),
      floorSeed: 0x1a2b3c4d,
      floorIndex: 1,
      currentFuelSeconds: 180,
      metaNodes: 0,
      hadWipeThisFloor: false,
    });

    expect(plan).not.toBeNull();
    expect(plan?.roomId).toBe(roomId(2));
    expect(plan?.distanceToPlayerM).toBeGreaterThan(20);
    // Floor 1: template SCARAB (2) o MUMMY (4), budget iniziale 6 → residuo 4 o 2.
    expect(plan?.budgetRemaining).toBeGreaterThanOrEqual(2);
    expect(plan?.budgetRemaining).toBeLessThanOrEqual(4);
  });

  it('sceglie solo archetipi disponibili per il piano (floor 1: SCARAB/MUMMY)', () => {
    for (const seed of [1, 7, 0x1a2b3c4d, 42, 999]) {
      const plan = planInitialScarabSpawn({
        sceneLayout: createLayout(),
        entryRoomId: roomId(1),
        floorSeed: seed,
        floorIndex: 1,
        currentFuelSeconds: 180,
        metaNodes: 0,
        hadWipeThisFloor: false,
      });

      if (plan) {
        expect(['SCARAB', 'MUMMY']).toContain(plan.enemyType);
      }
    }
  });

  it('è deterministico: stesso seed ⇒ stesso archetipo e stanza', () => {
    const input = {
      sceneLayout: createLayout(),
      entryRoomId: roomId(1),
      floorSeed: 0x1a2b3c4d,
      floorIndex: 2,
      currentFuelSeconds: 180,
      metaNodes: 0,
      hadWipeThisFloor: false,
    };
    const first = planInitialScarabSpawn(input);
    const second = planInitialScarabSpawn(input);

    expect(first?.enemyType).toBe(second?.enemyType);
    expect(first?.roomId).toBe(second?.roomId);
    expect(first?.position).toEqual(second?.position);
  });

  it('non usa la stanza entry ne la stanza target', () => {
    const plan = planInitialScarabSpawn({
      sceneLayout: createLayout(),
      entryRoomId: roomId(1),
      floorSeed: 7,
      floorIndex: 1,
      currentFuelSeconds: 180,
      metaNodes: 0,
      hadWipeThisFloor: false,
    });

    expect(plan?.roomId).not.toBe(roomId(1));
    expect(plan?.roomId).not.toBe(roomId(3));
  });

  it('non pianifica nulla fuori dal range di piano dei template', () => {
    const plan = planInitialScarabSpawn({
      sceneLayout: createLayout(),
      entryRoomId: roomId(1),
      floorSeed: 7,
      floorIndex: 99,
      currentFuelSeconds: 180,
      metaNodes: 0,
      hadWipeThisFloor: false,
    });

    expect(plan).toBeNull();
  });

  it('non pianifica nulla se tutte le stanze valide sono troppo vicine', () => {
    const layout = createLayout();
    const compressedLayout: FloorSceneLayout = {
      ...layout,
      rooms: layout.rooms.map((room) =>
        room.roomId === roomId(2) || room.roomId === roomId(4)
          ? {
            ...room,
            bounds: { minX: 1, minZ: -3, maxX: 5, maxZ: 3 },
            center: { x: 3, y: 0, z: 0 },
          }
          : room,
      ),
    };

    const plan = planInitialScarabSpawn({
      sceneLayout: compressedLayout,
      entryRoomId: roomId(1),
      floorSeed: 7,
      floorIndex: 1,
      currentFuelSeconds: 180,
      metaNodes: 0,
      hadWipeThisFloor: false,
    });

    expect(plan).toBeNull();
  });
});

describe('EnemyTemplates (G-11)', () => {
  it('tutti i template referenziano archetipi esistenti e combattibili', () => {
    expect(validateEnemyTemplates()).toEqual([]);
  });

  it('nessun tier 2 prima del piano 3, nessun tier 3 prima del piano 4', () => {
    const tierByType: Record<string, 1 | 2 | 3> = {
      SCARAB: 1, MUMMY: 1, COBRA: 1, SHABTI: 2, PRIEST: 2, SOBEK_SPAWN: 2, ROYAL_MUMMY: 3,
    };
    for (const template of ENEMY_TEMPLATES) {
      const tier = tierByType[template.type];
      if (tier === 2) {
        expect(template.minFloor).toBeGreaterThanOrEqual(3);
      }
      if (tier === 3) {
        expect(template.minFloor).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('i costi di budget crescono col tier', () => {
    const costs = ENEMY_TEMPLATES.map((template) => template.budgetCost);
    expect(Math.max(...costs)).toBeGreaterThanOrEqual(12);
    expect(Math.min(...costs)).toBeLessThanOrEqual(2);
  });

  it('WITNESS non è mai spawnabile', () => {
    expect(ENEMY_TEMPLATES.some((template) => template.type === 'WITNESS')).toBe(false);
  });
});
