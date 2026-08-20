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
  /** Stanza visitata dal player (calpestata almeno una volta). */
  readonly visited: boolean;
}

export interface RuntimeMinimapCorridor {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly visible: boolean;
}

export interface RuntimeMinimapPlayer {
  readonly x: number;
  readonly y: number;
}

/**
 * Nemico mostrato sulla minimappa.
 *
 * Prima la minimappa non aveva alcun layer nemici: si vedevano stanze,
 * corridoi e giocatore, e nient'altro. Con un obiettivo del tipo "elimina la
 * Mummia Dormiente" il giocatore non aveva alcun modo di sapere dove cercare.
 */
export interface RuntimeMinimapEnemy {
  readonly x: number;
  readonly y: number;
  /** Sveglio = ti sta cercando. Dormiente = puoi ancora sorprenderlo. */
  readonly awake: boolean;
  /** 0-1: serve alla UI per mostrare quanto è già stato ferito. */
  readonly hpRatio: number;
}

export interface RuntimeMinimapState {
  readonly rooms: readonly RuntimeMinimapRoom[];
  readonly corridors: readonly RuntimeMinimapCorridor[];
  readonly player: RuntimeMinimapPlayer | null;
  /** Nemici la cui stanza è già stata rivelata o visitata. */
  readonly enemies: readonly RuntimeMinimapEnemy[];
  /** Stanze visitate / stanze totali del piano. */
  readonly exploredFraction: { readonly visited: number; readonly total: number };
}

/** Posizione e stato di un nemico, come li conosce il gameplay. */
export interface RuntimeMinimapEnemyInput {
  readonly x: number;
  readonly z: number;
  readonly awake: boolean;
  readonly hpRatio: number;
}

interface RuntimeMinimapInput {
  readonly layout: FloorSceneLayout;
  readonly revealedRoomIds: readonly number[];
  readonly visitedRoomIds: readonly number[];
  readonly playerPosition: { readonly x: number; readonly z: number } | null;
  readonly mapRoomId: number | null;
  /** Nemici vivi del piano. Omesso = nessun marker (compatibile all'indietro). */
  readonly enemies?: readonly RuntimeMinimapEnemyInput[];
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
    return {
      rooms: [], corridors: [], player: null, enemies: [],
      exploredFraction: { visited: 0, total: 0 },
    };
  }

  // Calcola i bounds dell'intera mappa per normalizzare le coordinate in 0-100
  const allBounds = [...layout.rooms.map((r) => r.bounds), ...layout.corridors.map((c) => c.bounds)];
  const minX = Math.min(...allBounds.map((b) => b.minX));
  const maxX = Math.max(...allBounds.map((b) => b.maxX));
  const minZ = Math.min(...allBounds.map((b) => b.minZ));
  const maxZ = Math.max(...allBounds.map((b) => b.maxZ));
  const spanX = Math.max(1, maxX - minX);
  const spanZ = Math.max(1, maxZ - minZ);

  const revealedRoomIds = new Set(input.revealedRoomIds);
  const visitedRoomIds = new Set(input.visitedRoomIds);

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
    const visible = revealedRoomIds.has(roomId) || visitedRoomIds.has(roomId) || isEntry || isExit || isMap || isPlayerRoom;
    return {
      roomId,
      x: ((room.bounds.minX - minX) / spanX) * 100,
      y: ((room.bounds.minZ - minZ) / spanZ) * 100,
      width: ((room.bounds.maxX - room.bounds.minX) / spanX) * 100,
      height: ((room.bounds.maxZ - room.bounds.minZ) / spanZ) * 100,
      visible,
      isEntry,
      isExit,
      isMapRoom: isMap,
      isTargetRoom: isTarget,
      isPlayerRoom,
      visited: visitedRoomIds.has(roomId),
    };
  });

  // Corridoi visibili solo se almeno una delle due stanze adiacenti è rivelata
  const corridors = layout.corridors.map((corridor) => {
    const fromId = Number(corridor.fromRoomId);
    const toId = Number(corridor.toRoomId);
    const visible =
      revealedRoomIds.has(fromId) || revealedRoomIds.has(toId) ||
      fromId === playerRoomId || toId === playerRoomId;
    return {
      x: ((corridor.bounds.minX - minX) / spanX) * 100,
      y: ((corridor.bounds.minZ - minZ) / spanZ) * 100,
      width: ((corridor.bounds.maxX - corridor.bounds.minX) / spanX) * 100,
      height: ((corridor.bounds.maxZ - corridor.bounds.minZ) / spanZ) * 100,
      visible,
    };
  });

  const player =
    playerPosition
      ? {
        x: ((playerPosition.x - minX) / spanX) * 100,
        y: ((playerPosition.z - minZ) / spanZ) * 100,
      }
      : null;

  const visitedCount = rooms.filter((r) => r.visited).length;

  // I nemici compaiono solo nelle stanze che il giocatore ha già rivelato o
  // visitato: la minimappa non deve svelare l'intero piano in anticipo, ma
  // deve dire dove si trova ciò che hai già incontrato o mappato.
  const visibleRoomIds = new Set(
    rooms.filter((r) => r.visible).map((r) => r.roomId),
  );
  const enemies = (input.enemies ?? [])
    .filter((enemy) => {
      const room = layout.rooms.find((r) =>
        pointInBounds({ x: enemy.x, z: enemy.z }, r.bounds),
      );
      return room !== undefined && visibleRoomIds.has(Number(room.roomId));
    })
    .map((enemy) => ({
      x: ((enemy.x - minX) / spanX) * 100,
      y: ((enemy.z - minZ) / spanZ) * 100,
      awake: enemy.awake,
      hpRatio: enemy.hpRatio,
    }));

  return {
    rooms,
    corridors,
    player,
    enemies,
    exploredFraction: { visited: visitedCount, total: rooms.length },
  };
}
