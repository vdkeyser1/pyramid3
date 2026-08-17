import type { FloorSceneLayout } from '@/world/FloorSceneLayout.js';

export interface RuntimeMinimapRoom {
  readonly roomId: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly visible: boolean;
  readonly isEntry: boolean;
  readonly isExit: boolean;
  readonly isMapRoom: boolean;
  readonly isTargetRoom: boolean;
  readonly isPlayerRoom: boolean;
}

export interface RuntimeMinimapPlayer {
  readonly x: number;
  readonly y: number;
}

export interface RuntimeMinimapState {
  readonly rooms: readonly RuntimeMinimapRoom[];
  readonly player: RuntimeMinimapPlayer | null;
}

interface RuntimeMinimapInput {
  readonly layout: FloorSceneLayout;
  readonly revealedRoomIds: readonly number[];
  readonly playerPosition: { readonly x: number; readonly z: number } | null;
  readonly mapRoomId: number | null;
}

function pointInBounds(
  point: { readonly x: number; readonly z: number },
  bounds: FloorSceneLayout['rooms'][number]['bounds'],
): boolean {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.z >= bounds.minZ &&
    point.z <= bounds.maxZ
  );
}

export function buildRuntimeMinimap(input: RuntimeMinimapInput): RuntimeMinimapState {
  const { layout, playerPosition, mapRoomId } = input;
  if (layout.rooms.length === 0) {
    return { rooms: [], player: null };
  }

  const minX = Math.min(...layout.rooms.map((room) => room.bounds.minX));
  const maxX = Math.max(...layout.rooms.map((room) => room.bounds.maxX));
  const minZ = Math.min(...layout.rooms.map((room) => room.bounds.minZ));
  const maxZ = Math.max(...layout.rooms.map((room) => room.bounds.maxZ));
  const spanX = Math.max(1, maxX - minX);
  const spanZ = Math.max(1, maxZ - minZ);
  const revealedRoomIds = new Set(input.revealedRoomIds);
  const playerRoomId =
    playerPosition
      ? Number(
        layout.rooms.find((room) => pointInBounds(playerPosition, room.bounds))?.roomId ?? -1,
      )
      : -1;

  const rooms = layout.rooms.map((room) => {
    const roomId = Number(room.roomId);
    const isEntry = room.role === 'ENTRY';
    const isExit = room.role === 'EXIT';
    const isMap = roomId === mapRoomId;
    const isTarget = roomId === Number(layout.targetRoomId);
    const isPlayerRoom = roomId === playerRoomId;
    return {
      roomId,
      x: ((room.bounds.minX - minX) / spanX) * 100,
      y: ((room.bounds.minZ - minZ) / spanZ) * 100,
      width: ((room.bounds.maxX - room.bounds.minX) / spanX) * 100,
      height: ((room.bounds.maxZ - room.bounds.minZ) / spanZ) * 100,
      visible: revealedRoomIds.has(roomId) || isEntry || isExit || isMap || isPlayerRoom,
      isEntry,
      isExit,
      isMapRoom: isMap,
      isTargetRoom: isTarget,
      isPlayerRoom,
    };
  });

  const player =
    playerPosition
      ? {
        x: ((playerPosition.x - minX) / spanX) * 100,
        y: ((playerPosition.z - minZ) / spanZ) * 100,
      }
      : null;

  return { rooms, player };
}
