import { describe, expect, it } from 'vitest';
import { buildRuntimeMinimap } from '@/app/RuntimeMinimap.js';
import type { FloorSceneLayout } from '@/world/FloorSceneLayout.js';

function createLayout(): FloorSceneLayout {
  return {
    floorId: 'floor-test',
    floorIndex: 1,
    entrySpawn: { x: 2, y: 0, z: 2 },
    targetPosition: { x: 26, y: 1.05, z: 4 },
    targetRoomId: 3 as never,
    exitPosition: { x: 26, y: 1.75, z: 4 },
    exitDoorClosedPosition: { x: 30, y: 1.75, z: 4 },
    exitDoorOpenPosition: { x: 30, y: 1.75, z: 5 },
    exitDoorYawRad: 0,
    exitDirection: 'east',
    rooms: [
      {
        roomId: 1 as never,
        role: 'ENTRY',
        bounds: { minX: 0, minZ: 0, maxX: 10, maxZ: 10 },
        center: { x: 5, y: 0, z: 5 },
        landmarkId: null,
        theme: 'PLAIN' as const,
        openings: ['east'],
      },
      {
        roomId: 2 as never,
        role: 'MAP',
        bounds: { minX: 12, minZ: 0, maxX: 22, maxZ: 10 },
        center: { x: 17, y: 0, z: 5 },
        landmarkId: null,
        theme: 'PLAIN' as const,
        openings: ['west', 'east'],
      },
      {
        roomId: 3 as never,
        role: 'EXIT',
        bounds: { minX: 24, minZ: 0, maxX: 34, maxZ: 10 },
        center: { x: 29, y: 0, z: 5 },
        landmarkId: null,
        theme: 'PLAIN' as const,
        openings: ['west'],
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

describe('RuntimeMinimap', () => {
  it('mantiene visibili stanze speciali e stanza del giocatore', () => {
    const minimap = buildRuntimeMinimap({
      layout: createLayout(),
      revealedRoomIds: [],
      visitedRoomIds: [],
      playerPosition: { x: 4, z: 4 },
      mapRoomId: 2,
    });

    expect(minimap.rooms.filter((room) => room.visible).map((room) => room.roomId)).toEqual([1, 2, 3]);
    expect(minimap.rooms.find((room) => room.roomId === 1)?.isPlayerRoom).toBe(true);
    expect(minimap.player).toEqual({ x: 11.76470588235294, y: 40 });
  });

  it('rivela anche stanze normali quando compaiono nello stato runtime', () => {
    const layout = createLayout();
    const extraRoom: FloorSceneLayout['rooms'][number] = {
      roomId: 4 as never,
      role: 'COMBAT',
      bounds: { minX: 12, minZ: 12, maxX: 22, maxZ: 22 },
      center: { x: 17, y: 0, z: 17 },
      landmarkId: null,
      theme: 'PLAIN' as const,
      openings: ['north'],
    };

    const minimap = buildRuntimeMinimap({
      layout: {
        ...layout,
        rooms: [...layout.rooms, extraRoom],
      },
      revealedRoomIds: [4],
      visitedRoomIds: [],
      playerPosition: null,
      mapRoomId: 2,
    });

    expect(minimap.rooms.find((room) => room.roomId === 4)?.visible).toBe(true);
    expect(minimap.rooms.find((room) => room.roomId === 4)?.isPlayerRoom).toBe(false);
  });
});
