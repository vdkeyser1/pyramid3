import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { RoomId } from '@/procedural/Ids.js';
import type { RoomRole } from '@/procedural/FloorValidator.js';
import type { FloorSceneLayout, FloorSceneRoom } from '@/world/FloorSceneLayout.js';
import { decorateRooms } from '@/rendering/RoomDecor.js';

function makeRoom(roomId: number, role: RoomRole, minX: number, minZ: number, maxX: number, maxZ: number): FloorSceneRoom {
  const id = roomId as unknown as RoomId;
  return {
    roomId: id,
    role,
    bounds: { minX, minZ, maxX, maxZ },
    center: { x: (minX + maxX) / 2, y: 0, z: (minZ + maxZ) / 2 },
    landmarkId: null,
    theme: 'PLAIN' as const,
    openings: [],
  };
}

function makeLayout(): FloorSceneLayout {
  return {
    floorId: 'floor-test',
    floorIndex: 1,
    entrySpawn: { x: 5, y: 0, z: 5 },
    targetPosition: { x: 25, y: 1.05, z: 25 },
    targetRoomId: 2 as unknown as RoomId,
    exitPosition: { x: 25, y: 0, z: 30 },
    exitDoorClosedPosition: { x: 25, y: 0, z: 25 },
    exitDoorOpenPosition: { x: 25, y: 0, z: 30 },
    exitDoorYawRad: 0,
    exitIsStair: true,
    stairBottom: null,
    exitDirection: 'north',
    rooms: [
      makeRoom(1, 'ENTRY', 0, 0, 10, 10),
      makeRoom(2, 'EXIT', 20, 20, 30, 30),
      makeRoom(3, 'JUNCTION', 40, 40, 55, 55),
      makeRoom(4, 'SAFE', 60, 60, 76, 76),
      makeRoom(5, 'COMBAT', 80, 80, 96, 96),
    ],
    corridors: [],
    landmarks: [],
    braziers: [],
    doorways: [],
    digSite: null,
    shovelPickup: null,
    traps: [],
    leverPassage: null,
    specialProps: [],
  };
}

describe('RoomDecor (G-14)', () => {
  // v2: i decor sono InstancedMesh (uno per tipo) — le posizioni vivono
  // nelle matrici delle istanze, non nel mesh.
  function instancePositions(root: THREE.Group): { x: number; z: number }[] {
    const out: { x: number; z: number }[] = [];
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    for (const child of root.children) {
      if (!(child instanceof THREE.InstancedMesh)) continue;
      for (let i = 0; i < child.count; i++) {
        matrix.fromArray(child.instanceMatrix.array, i * 16);
        position.setFromMatrixPosition(matrix);
        out.push({ x: position.x, z: position.z });
      }
    }
    return out;
  }

  it('decora solo le stanze non critiche', () => {
    const root = new THREE.Group();
    const layout = makeLayout();
    decorateRooms({
      layout,
      dungeonRoot: root,
      wallMaterial: new THREE.MeshStandardMaterial(),
    });

    // Stanze ENTRY (0-10) ed EXIT (20-30) restano vuote; JUNCTION (40-55),
    // SAFE (60-76) e COMBAT (80-96) ricevono oggetti (istanze InstancedMesh)
    expect(root.children.length).toBeGreaterThan(0);
    const positions = instancePositions(root);
    expect(positions.length).toBeGreaterThan(0);
    const decoratableRanges: readonly (readonly [number, number])[] = [
      [40, 55],
      [60, 76],
      [80, 96],
    ];
    for (const { x, z } of positions) {
      const inside = decoratableRanges.some(
        ([min, max]) => x >= min && x <= max && z >= min && z <= max,
      );
      expect(inside).toBe(true);
    }
  });

  it('è deterministico: stesso layout ⇒ stessi oggetti', () => {
    const rootA = new THREE.Group();
    const rootB = new THREE.Group();
    const layout = makeLayout();

    decorateRooms({ layout, dungeonRoot: rootA, wallMaterial: new THREE.MeshStandardMaterial() });
    decorateRooms({ layout, dungeonRoot: rootB, wallMaterial: new THREE.MeshStandardMaterial() });

    expect(rootA.children.length).toBe(rootB.children.length);
    const positionsA = instancePositions(rootA);
    const positionsB = instancePositions(rootB);
    expect(positionsA.length).toBe(positionsB.length);
    for (let i = 0; i < positionsA.length; i++) {
      const a = positionsA[i];
      const b = positionsB[i];
      if (!a || !b) continue;
      expect(a.x).toBe(b.x);
      expect(a.z).toBe(b.z);
    }
  });

  it('rispetta il margine dai muri (oggetti dentro i bounds)', () => {
    const root = new THREE.Group();
    decorateRooms({ layout: makeLayout(), dungeonRoot: root, wallMaterial: new THREE.MeshStandardMaterial() });

    const ranges: readonly (readonly [number, number])[] = [
      [40, 55],
      [60, 76],
      [80, 96],
    ];
    for (const { x, z } of instancePositions(root)) {
      const range = ranges.find(
        ([min, max]) => x >= min - 1 && x <= max + 1,
      );
      expect(range).toBeDefined();
      if (range) {
        const [min, max] = range;
        expect(x).toBeGreaterThan(min + 1.4);
        expect(x).toBeLessThan(max - 1.4);
        expect(z).toBeGreaterThan(min + 1.4);
        expect(z).toBeLessThan(max - 1.4);
      }
    }
  });
});
