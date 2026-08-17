import type { FloorModel } from '@/procedural/FloorModel.js';
import type { RoomBounds, RoomId, RoomNode, RoomRole } from '@/procedural/FloorValidator.js';

export interface SceneVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type CardinalDirection = 'north' | 'south' | 'east' | 'west';

export interface FloorSceneRoom {
  readonly roomId: RoomId;
  readonly role: RoomRole;
  readonly bounds: RoomBounds;
  readonly center: SceneVector3;
  readonly landmarkId: string | null;
  readonly openings: readonly CardinalDirection[];
}

export interface FloorSceneCorridor {
  readonly fromRoomId: RoomId;
  readonly toRoomId: RoomId;
  readonly axis: 'x' | 'z';
  readonly bounds: RoomBounds;
}

export interface FloorSceneLandmark {
  readonly roomId: RoomId;
  readonly role: RoomRole;
  readonly landmarkId: string;
  readonly position: SceneVector3;
}

export interface FloorSceneBrazier {
  readonly brazierId: string;
  readonly roomId: RoomId;
  readonly position: SceneVector3;
}

export interface FloorSceneDigSite {
  readonly siteId: string;
  readonly roomId: RoomId;
  readonly position: SceneVector3;
}

/**
 * Centro dell'apertura tra due stanze (porta). Usato dal doorway snap assist
 * (G-18 V4): quando il player è vicino a una porta e si muove verso di essa,
 * il controller devia dolcemente il movimento verso questo centro per evitare
 * di incastrarsi sugli spigoli degli stipiti.
 */
export interface FloorSceneDoorway {
  readonly center: SceneVector3;
  /** Asse attraversato: 'x' = si passa lungo X (porta sui lati est/ovest). */
  readonly axis: 'x' | 'z';
}

export interface FloorSceneLayout {
  readonly floorId: string;
  /** v2: indice del piano (1..MAX_FLOORS) — fascia tematica per decor. */
  readonly floorIndex: number;
  readonly entrySpawn: SceneVector3;
  readonly targetPosition: SceneVector3;
  readonly targetRoomId: RoomId;
  readonly exitPosition: SceneVector3;
  readonly exitDoorClosedPosition: SceneVector3;
  readonly exitDoorOpenPosition: SceneVector3;
  readonly exitDoorYawRad: number;
  readonly exitDirection: CardinalDirection;
  readonly rooms: readonly FloorSceneRoom[];
  readonly corridors: readonly FloorSceneCorridor[];
  readonly landmarks: readonly FloorSceneLandmark[];
  readonly braziers: readonly FloorSceneBrazier[];
  readonly doorways: readonly FloorSceneDoorway[];
  readonly digSite: FloorSceneDigSite | null;
}

const FLOOR_Y = 0;
const PLAYER_SPAWN_Y = 0;
const TARGET_Y = 1.05;
const EXIT_Y = 1.75;
const LANDMARK_Y = 1.4;
const ROOM_INSET_M = 1.7;
const DOOR_OFFSET_M = 0.15;
const DOOR_SLIDE_M = 1.25;
const CORRIDOR_WIDTH_M = 4;
const TARGET_OFFSET_OPTIONS = [-2.2, 0, 2.2] as const;
const DIG_SITE_OFFSET_OPTIONS = [-1.6, 0, 1.6] as const;

function centerOfBounds(bounds: RoomBounds, y: number): SceneVector3 {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y,
    z: (bounds.minZ + bounds.maxZ) / 2,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildRoomIndex(floor: FloorModel): Map<RoomId, RoomNode> {
  const index = new Map<RoomId, RoomNode>();
  for (const room of floor.rooms) {
    index.set(room.id, room);
  }
  return index;
}

function inferDirection(from: RoomBounds, to: RoomBounds): CardinalDirection {
  const fromCenter = centerOfBounds(from, FLOOR_Y);
  const toCenter = centerOfBounds(to, FLOOR_Y);
  const dx = toCenter.x - fromCenter.x;
  const dz = toCenter.z - fromCenter.z;
  if (Math.abs(dx) >= Math.abs(dz)) {
    return dx >= 0 ? 'east' : 'west';
  }
  return dz >= 0 ? 'south' : 'north';
}

function exitDirectionFor(floor: FloorModel, exitRoom: RoomNode): CardinalDirection {
  if (floor.rooms.length <= 1) {
    return 'east';
  }

  const centroid = floor.rooms.reduce(
    (acc, room) => {
      const center = centerOfBounds(room.bounds, FLOOR_Y);
      return { x: acc.x + center.x, z: acc.z + center.z };
    },
    { x: 0, z: 0 },
  );
  centroid.x /= floor.rooms.length;
  centroid.z /= floor.rooms.length;

  const exitCenter = centerOfBounds(exitRoom.bounds, FLOOR_Y);
  const dx = exitCenter.x - centroid.x;
  const dz = exitCenter.z - centroid.z;
  if (Math.abs(dx) >= Math.abs(dz)) {
    return dx >= 0 ? 'east' : 'west';
  }
  return dz >= 0 ? 'south' : 'north';
}

function positionInsideWall(bounds: RoomBounds, direction: CardinalDirection, inset: number, y: number): SceneVector3 {
  const center = centerOfBounds(bounds, y);
  switch (direction) {
    case 'east':
      return { x: bounds.maxX - inset, y, z: center.z };
    case 'west':
      return { x: bounds.minX + inset, y, z: center.z };
    case 'north':
      return { x: center.x, y, z: bounds.minZ + inset };
    case 'south':
      return { x: center.x, y, z: bounds.maxZ - inset };
  }
}

function offsetTargetPosition(room: RoomNode, seed: number): SceneVector3 {
  const center = centerOfBounds(room.bounds, TARGET_Y);
  const xOffset = TARGET_OFFSET_OPTIONS[Math.abs(seed + room.id) % TARGET_OFFSET_OPTIONS.length] ?? 0;
  const zOffset = TARGET_OFFSET_OPTIONS[Math.abs(seed ^ room.id) % TARGET_OFFSET_OPTIONS.length] ?? 0;
  return {
    x: clamp(center.x + xOffset, room.bounds.minX + ROOM_INSET_M, room.bounds.maxX - ROOM_INSET_M),
    y: center.y,
    z: clamp(center.z + zOffset, room.bounds.minZ + ROOM_INSET_M, room.bounds.maxZ - ROOM_INSET_M),
  };
}

function offsetDigSitePosition(room: RoomNode, seed: number): SceneVector3 {
  const center = centerOfBounds(room.bounds, FLOOR_Y);
  const xOffset = DIG_SITE_OFFSET_OPTIONS[Math.abs(seed * 3 + room.id) % DIG_SITE_OFFSET_OPTIONS.length] ?? 0;
  const zOffset = DIG_SITE_OFFSET_OPTIONS[Math.abs(seed * 5 ^ room.id) % DIG_SITE_OFFSET_OPTIONS.length] ?? 0;
  return {
    x: clamp(center.x + xOffset, room.bounds.minX + ROOM_INSET_M, room.bounds.maxX - ROOM_INSET_M),
    y: 0.02,
    z: clamp(center.z + zOffset, room.bounds.minZ + ROOM_INSET_M, room.bounds.maxZ - ROOM_INSET_M),
  };
}

function selectTargetRoom(floor: FloorModel, roomIndex: Map<RoomId, RoomNode>): RoomNode {
  const preferredIds: readonly RoomId[] = [
    floor.treasureRoomId,
    floor.mapRoomId,
    floor.exitRoomId,
    floor.entryRoomId,
  ];

  for (const roomId of preferredIds) {
    const room = roomIndex.get(roomId);
    if (room) {
      return room;
    }
  }

  const firstRoom = floor.rooms[0];
  if (!firstRoom) {
    throw new Error('FloorModel senza stanze');
  }
  return firstRoom;
}

function createCorridor(fromRoom: RoomNode, toRoom: RoomNode): FloorSceneCorridor {
  const direction = inferDirection(fromRoom.bounds, toRoom.bounds);
  const fromCenter = centerOfBounds(fromRoom.bounds, FLOOR_Y);
  const toCenter = centerOfBounds(toRoom.bounds, FLOOR_Y);

  if (direction === 'east' || direction === 'west') {
    const minX = Math.min(fromRoom.bounds.maxX, toRoom.bounds.maxX);
    const maxX = Math.max(fromRoom.bounds.minX, toRoom.bounds.minX);
    const centerZ = (fromCenter.z + toCenter.z) / 2;
    return {
      fromRoomId: fromRoom.id,
      toRoomId: toRoom.id,
      axis: 'x',
      bounds: {
        minX,
        maxX,
        minZ: centerZ - CORRIDOR_WIDTH_M / 2,
        maxZ: centerZ + CORRIDOR_WIDTH_M / 2,
      },
    };
  }

  const minZ = Math.min(fromRoom.bounds.maxZ, toRoom.bounds.maxZ);
  const maxZ = Math.max(fromRoom.bounds.minZ, toRoom.bounds.minZ);
  const centerX = (fromCenter.x + toCenter.x) / 2;
  return {
    fromRoomId: fromRoom.id,
    toRoomId: toRoom.id,
    axis: 'z',
    bounds: {
      minX: centerX - CORRIDOR_WIDTH_M / 2,
      maxX: centerX + CORRIDOR_WIDTH_M / 2,
      minZ,
      maxZ,
    },
  };
}

export function buildFloorSceneLayout(floor: FloorModel): FloorSceneLayout {
  const roomIndex = buildRoomIndex(floor);
  const entryRoom = roomIndex.get(floor.entryRoomId);
  const exitRoom = roomIndex.get(floor.exitRoomId);
  if (!entryRoom || !exitRoom) {
    throw new Error('FloorModel incompleto: entry/exit non trovate');
  }

  const exitDirection = exitDirectionFor(floor, exitRoom);
  const targetRoom = selectTargetRoom(floor, roomIndex);
  const rooms = floor.rooms.map((room) => {
    const openings = room.doors
      .map((doorId) => roomIndex.get(doorId))
      .filter((linkedRoom): linkedRoom is RoomNode => linkedRoom !== undefined)
      .map((linkedRoom) => inferDirection(room.bounds, linkedRoom.bounds));

    if (room.id === exitRoom.id) {
      openings.push(exitDirection);
    }

    return {
      roomId: room.id,
      role: room.role,
      bounds: room.bounds,
      center: centerOfBounds(room.bounds, FLOOR_Y),
      landmarkId: room.landmarkId,
      openings,
    };
  });

  const corridors: FloorSceneCorridor[] = [];
  for (const room of floor.rooms) {
    for (const neighbourId of room.doors) {
      if (room.id >= neighbourId) {
        continue;
      }
      const neighbour = roomIndex.get(neighbourId);
      if (!neighbour) {
        continue;
      }
      corridors.push(createCorridor(room, neighbour));
    }
  }

  const landmarks = rooms
    .filter((room) => room.landmarkId !== null)
    .map((room) => ({
      roomId: room.roomId,
      role: room.role,
      landmarkId: room.landmarkId ?? 'landmark',
      position: centerOfBounds(room.bounds, LANDMARK_Y),
    }));

  const braziers = landmarks
    .filter((landmark) => landmark.landmarkId === 'braciere-eterno')
    .map((landmark) => ({
      brazierId: `${floor.floorId}:brazier:${String(landmark.roomId)}`,
      roomId: landmark.roomId,
      position: {
        x: landmark.position.x,
        y: 0.35,
        z: landmark.position.z,
      },
    }));

  const treasureRoom = roomIndex.get(floor.treasureRoomId);
  const digSite = treasureRoom
    ? {
      siteId: `${floor.floorId}:dig:${String(treasureRoom.id)}`,
      roomId: treasureRoom.id,
      position: offsetDigSitePosition(treasureRoom, floor.seed),
    }
    : null;

  const exitDoorClosedPosition = positionInsideWall(exitRoom.bounds, exitDirection, DOOR_OFFSET_M, EXIT_Y);
  const slideSign = floor.seed % 2 === 0 ? 1 : -1;
  const exitDoorOpenPosition =
    exitDirection === 'east' || exitDirection === 'west'
      ? {
        x: exitDoorClosedPosition.x,
        y: exitDoorClosedPosition.y,
        z: exitDoorClosedPosition.z + DOOR_SLIDE_M * slideSign,
      }
      : {
        x: exitDoorClosedPosition.x + DOOR_SLIDE_M * slideSign,
        y: exitDoorClosedPosition.y,
        z: exitDoorClosedPosition.z,
      };

  // G-18 V4: doorway snap assist — il centro di ogni apertura tra stanze è il
  // punto medio del corridoio (bounds del passaggio) a livello pavimento.
  const doorways: FloorSceneDoorway[] = corridors.map((corridor) => ({
    axis: corridor.axis,
    center: {
      x: (corridor.bounds.minX + corridor.bounds.maxX) / 2,
      y: FLOOR_Y,
      z: (corridor.bounds.minZ + corridor.bounds.maxZ) / 2,
    },
  }));

  return {
    floorId: floor.floorId,
    floorIndex: floor.floorIndex,
    entrySpawn: {
      ...centerOfBounds(entryRoom.bounds, PLAYER_SPAWN_Y),
    },
    targetPosition: offsetTargetPosition(targetRoom, floor.seed),
    targetRoomId: targetRoom.id,
    exitPosition: positionInsideWall(exitRoom.bounds, exitDirection, ROOM_INSET_M, EXIT_Y),
    exitDoorClosedPosition,
    exitDoorOpenPosition,
    exitDoorYawRad: exitDirection === 'east' || exitDirection === 'west' ? Math.PI / 2 : 0,
    exitDirection,
    rooms,
    corridors,
    landmarks,
    braziers,
    doorways,
    digSite,
  };
}
