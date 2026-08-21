import { describe, expect, it } from 'vitest';
import { createEnemySpawnDirector } from '@/simulation/EnemySpawnDirector.js';
import { ENEMY_TEMPLATES } from '@/content/enemyTemplates.js';
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

function createDirector(overrides: Partial<Parameters<typeof createEnemySpawnDirector>[0]> = {}) {
  return createEnemySpawnDirector({
    sceneLayout: createLayout(),
    entryRoomId: roomId(1),
    floorSeed: 0x1a2b3c4d,
    floorIndex: 1,
    currentFuelSeconds: 180,
    metaNodes: 0,
    hadWipeThisFloor: false,
    baseBudget: 6,
    ...overrides,
  });
}

describe('EnemySpawnDirector (G-03)', () => {
  it('pianifica un incontro iniziale valido nella stanza più distante', () => {
    const director = createDirector();
    const plan = director.planNext();

    expect(plan).not.toBeNull();
    expect(plan?.roomId).toBe(roomId(2));
    expect(plan?.distanceToPlayerM).toBeGreaterThan(20);
    expect(plan?.budgetRemaining).toBeGreaterThanOrEqual(2);
    expect(plan?.budgetRemaining).toBeLessThanOrEqual(4);
  });

  it('consuma budget: il secondo spawn riduce il budget rimanente', () => {
    const director = createDirector();
    const first = director.planNext();
    const second = director.planNext();

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(second?.budgetRemaining).toBeLessThan(first?.budgetRemaining ?? 99);
  });

  it('si ferma quando il budget è esaurito (nessuno spawn infinito)', () => {
    const director = createDirector({ baseBudget: 2 });
    const first = director.planNext();

    expect(first).not.toBeNull();
    // Budget 2 = costo SCARAB: dopo il primo spawn il budget è 0.
    expect(director.planNext()).toBeNull();
  });

  it('è deterministico: stesso seed ⇒ stessi spawn nella stessa sequenza', () => {
    const first = createDirector();
    const second = createDirector();

    const a = [first.planNext(), first.planNext()];
    const b = [second.planNext(), second.planNext()];

    expect(a[0]?.enemyType).toBe(b[0]?.enemyType);
    expect(a[0]?.roomId).toBe(b[0]?.roomId);
    expect(a[1]?.enemyType).toBe(b[1]?.enemyType);
    expect(a[1]?.roomId).toBe(b[1]?.roomId);
  });

  it('non pianifica nulla fuori dal range di piano dei template', () => {
    const director = createDirector({ floorIndex: 99 });
    expect(director.planNext()).toBeNull();
  });

  it('esclude entry e target room dagli spawn', () => {
    const director = createDirector({ floorSeed: 7 });
    const plan = director.planNext();

    expect(plan?.roomId).not.toBe(roomId(1));
    expect(plan?.roomId).not.toBe(roomId(3));
  });

  it('espone i template disponibili per il piano tramite il tipo condiviso', () => {
    // Invariante: i template referenziano archetipi noti e hanno fasce valide.
    for (const template of ENEMY_TEMPLATES) {
      expect(template.minFloor).toBeGreaterThanOrEqual(1);
      expect(template.maxFloor).toBeGreaterThanOrEqual(template.minFloor);
      expect(template.budgetCost).toBeGreaterThan(0);
    }
  });

  it('A-01: una stanza illuminata da braciere viene evitata (fallback se tutte)', () => {
    const director = createDirector();
    // Stanza 2 (30m) illuminata → lo spawn deve preferire la stanza 4 (14m).
    director.setLitRoom(roomId(2), true);
    const plan = director.planNext();
    expect(plan).not.toBeNull();
    expect(plan?.roomId).toBe(roomId(4));

    // Fallback: se TUTTE le stanze candidate sono illuminate, lo spawn
    // avviene comunque (la luce riduce la pressione, non la azzera).
    director.setLitRoom(roomId(4), true);
    const fallback = director.planNext();
    expect(fallback).not.toBeNull();

    // Un braciere spento ripristina la candidatura della stanza (director
    // fresco: il budget del precedente è già consumato dai due spawn sopra).
    const restored = createDirector();
    restored.setLitRoom(roomId(2), true);
    restored.setLitRoom(roomId(4), true);
    restored.setLitRoom(roomId(2), false);
    restored.setLitRoom(roomId(4), false);
    expect(restored.planNext()?.roomId).toBe(roomId(2));
  });
});
