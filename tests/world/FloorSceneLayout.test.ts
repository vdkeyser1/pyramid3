import { describe, expect, it } from 'vitest';
import type { FloorModel } from '@/procedural/FloorModel.js';
import { buildFloorSceneLayout } from '@/world/FloorSceneLayout.js';

function createFloor(seed: number): FloorModel {
  return {
    floorId: `layout-${seed}`,
    seed,
    generationVersion: 1,
    isTutorial: false,
    floorIndex: 1,
    rooms: [
      {
        id: 1 as never,
        role: 'ENTRY',
        bounds: { minX: 0, minZ: 20, maxX: 12, maxZ: 32 },
        doors: [2 as never],
        requiredKeyId: null,
        spawnClearanceM: 3,
        landmarkId: 'entry',
      },
      {
        id: 2 as never,
        role: 'MAP',
        bounds: { minX: 20, minZ: 20, maxX: 32, maxZ: 32 },
        doors: [1 as never, 3 as never, 4 as never],
        requiredKeyId: null,
        spawnClearanceM: 3,
        landmarkId: 'junction',
      },
      {
        id: 3 as never,
        role: 'TREASURE',
        bounds: { minX: 40, minZ: 20, maxX: 52, maxZ: 32 },
        doors: [2 as never],
        requiredKeyId: null,
        spawnClearanceM: 3,
        landmarkId: 'treasure',
      },
      {
        id: 4 as never,
        role: 'EXIT',
        bounds: { minX: 20, minZ: 40, maxX: 32, maxZ: 52 },
        doors: [2 as never],
        requiredKeyId: null,
        spawnClearanceM: 3,
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

describe('buildFloorSceneLayout', () => {
  it('deriva spawn, target, uscita e corridoi dal FloorModel', () => {
    const layout = buildFloorSceneLayout(createFloor(7));

    expect(layout.entrySpawn).toMatchObject({ x: 6, z: 26 });
    expect(layout.targetRoomId).toBe(3);
    expect(layout.targetPosition.x).toBeGreaterThanOrEqual(41.7);
    expect(layout.targetPosition.x).toBeLessThanOrEqual(50.3);
    expect(layout.exitDirection).toBe('south');
    expect(layout.exitPosition.z).toBeCloseTo(50.3, 1);
    expect(layout.exitDoorClosedPosition.z).toBeCloseTo(51.85, 2);
    expect(layout.rooms.find((room) => room.roomId === 4)?.openings).toContain('south');
    expect(layout.corridors).toHaveLength(3);
    expect(layout.landmarks).toHaveLength(4);
    expect(layout.braziers).toHaveLength(0);
    expect(layout.digSite).not.toBeNull();
    expect(layout.digSite?.roomId).toBe(3);
    expect(layout.digSite?.position.x).toBeGreaterThanOrEqual(41.7);
    expect(layout.digSite?.position.x).toBeLessThanOrEqual(50.3);
  });

  it('espone i bracieri eterni come interagibili di scena', () => {
    const baseFloor = createFloor(11);
    const floor: FloorModel = {
      ...baseFloor,
      rooms: baseFloor.rooms.map((room, index) =>
        index === 1
          ? { ...room, landmarkId: 'braciere-eterno' }
          : room,
      ),
    };

    const layout = buildFloorSceneLayout(floor);

    expect(layout.braziers).toHaveLength(1);
    expect(layout.braziers[0]).toMatchObject({
      brazierId: 'layout-11:brazier:2',
      roomId: 2,
    });
    expect(layout.braziers[0]?.position.y).toBeCloseTo(0.35, 2);
  });
});
