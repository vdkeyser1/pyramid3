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
    // I bracieri non dipendono più dai landmark: ogni stanza abbastanza
    // grande ne ha uno, quindi qui non sono più zero (vedi test dedicati).
    expect(layout.braziers.length).toBeGreaterThan(0);
    expect(layout.digSite).not.toBeNull();
    expect(layout.digSite?.roomId).toBe(3);
    expect(layout.digSite?.position.x).toBeGreaterThanOrEqual(41.7);
    expect(layout.digSite?.position.x).toBeLessThanOrEqual(50.3);
  });

  it('distribuisce i bracieri nelle stanze, non solo su un landmark', () => {
    // I bracieri non dipendono più dal landmark 'braciere-eterno' (che ne
    // produceva UNO per piano, di fatto invisibile): ora sono l'illuminazione
    // fissa della piramide e stanno in ogni stanza abbastanza grande.
    const layout = buildFloorSceneLayout(createFloor(11));

    expect(layout.braziers.length).toBeGreaterThan(1);
    for (const brazier of layout.braziers) {
      expect(brazier.brazierId).toContain('layout-11:brazier:');
      expect(brazier.position.y).toBeCloseTo(0.35, 2);
    }
  });

  it('i bracieri stanno dentro la stanza a cui appartengono', () => {
    const floor = createFloor(11);
    const layout = buildFloorSceneLayout(floor);
    const roomsById = new Map(layout.rooms.map((r) => [r.roomId, r]));

    for (const brazier of layout.braziers) {
      const room = roomsById.get(brazier.roomId);
      expect(room).toBeDefined();
      if (!room) continue;
      // Addossati alle pareti ma mai fuori dalla stanza né dentro il muro.
      expect(brazier.position.x).toBeGreaterThan(room.bounds.minX);
      expect(brazier.position.x).toBeLessThan(room.bounds.maxX);
      expect(brazier.position.z).toBeGreaterThan(room.bounds.minZ);
      expect(brazier.position.z).toBeLessThan(room.bounds.maxZ);
    }
  });

  it('la distribuzione dei bracieri è deterministica', () => {
    // Stesso piano ⇒ stesse posizioni: nessun Math.random nella derivazione.
    const a = buildFloorSceneLayout(createFloor(11)).braziers;
    const b = buildFloorSceneLayout(createFloor(11)).braziers;
    expect(a).toEqual(b);
  });
});
