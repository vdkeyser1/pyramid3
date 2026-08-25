import type { FloorModel } from '@/procedural/FloorModel.js';
import type { RoomBounds, RoomId, RoomNode, RoomRole } from '@/procedural/FloorValidator.js';
import { themeForRoom, type RoomTheme } from '@/content/RoomThemes.js';
import { STAIRCASE, TRAPS } from '@/content/balance.js';

/** Mappa G-05 kind → tema ART-004 per forzare varietà nella stanza speciale. */
function themeForSpecialKind(kind: string): RoomTheme | null {
  switch (kind) {
    case 'ARMORY':
      return 'PLUNDERED';
    case 'TREASURY':
      return 'ROYAL';
    case 'SHRINE':
      return 'SACRED';
    case 'VAULT':
      return 'FUNERARY';
    case 'LIBRARY':
      return 'PLAIN';
    default:
      return null;
  }
}

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
  /**
   * ART-004: stato narrativo della stanza, ortogonale al ruolo.
   * Il ruolo dice cosa la stanza fa, il tema cosa le è successo.
   */
  readonly theme: RoomTheme;
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

/**
 * ART-006 / GAME-ART-012: trappola di piano (piastra, pendolo, dardi, masso).
 *
 * La posizione è il centro della trappola sul pavimento (y = 0).
 * corridorLengthM e corridorAxis servono a pendolo / dardi / masso.
 */
export interface FloorSceneTrap {
  readonly trapId: string;
  readonly kind: 'pressurePlate' | 'bladePendulum' | 'dartLauncher' | 'rollingBoulder';
  readonly position: SceneVector3;
  /** Pendolo / masso / dardi: lunghezza utile del corridoio o stanza. */
  readonly corridorLengthM?: number;
  /**
   * Asse di movimento.
   * Pendolo: asse del corridoio (oscillazione perpendicolare).
   * Dardi: asse di fuoco dal launcher.
   * Masso: asse di rotolamento lungo il corridoio.
   */
  readonly corridorAxis?: 'x' | 'z';
}

/**
 * ART-006: posizione della leva e del sigillo di pietra corrispondente.
 *
 * Il sigillo è visivo-only (senza corpo fisico Rapier): il passaggio è sempre
 * fisicamente libero, ma la lastra visiva lo occulta fino a che la leva non
 * viene tirata. sealPosition.y è il centro della lastra nella posizione
 * "chiusa" (in alto, che ostruisce la nicchia).
 */
export interface FloorSceneLeverPassage {
  readonly leverId: string;
  readonly leverPosition: SceneVector3;
  /** Centro del sigillo quando è nella posizione "chiusa" (in alto). */
  readonly sealPosition: SceneVector3;
  readonly sealWidthM: number;
  readonly sealDepthM: number;
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
  /**
   * ART-005: l'uscita è una scala verso il piano successivo (true) o
   * l'uscita finale della piramide (false, ultimo piano).
   * Determina se costruire la tromba di scale percorribile.
   */
  readonly exitIsStair: boolean;
  /**
   * ART-005: pianerottolo in fondo alla scala, dove scatta il cambio piano.
   * null se l'uscita non è una scala (ultimo piano).
   *
   * Calcolato qui e non nel renderer perché serve anche alla simulazione:
   * è la simulazione a decidere quando si scende, il renderer disegna solo.
   */
  readonly stairBottom: SceneVector3 | null;
  readonly exitDirection: CardinalDirection;
  readonly rooms: readonly FloorSceneRoom[];
  readonly corridors: readonly FloorSceneCorridor[];
  readonly landmarks: readonly FloorSceneLandmark[];
  readonly braziers: readonly FloorSceneBrazier[];
  readonly doorways: readonly FloorSceneDoorway[];
  readonly digSite: FloorSceneDigSite | null;
  /** Posizione del pickup della pala (se presente in questo piano). */
  readonly shovelPickup: SceneVector3 | null;
  /**
   * ART-006: trappole presenti nel piano.
   * Vuoto nei piani 1-2 (tutorial). Derivato deterministicamente dal seed.
   */
  readonly traps: readonly FloorSceneTrap[];
  /**
   * ART-006: meccanismo leva+sigillo del piano.
   * null nei piani 1-2 e nei piani pari >= 4 (compare a rotazione).
   */
  readonly leverPassage: FloorSceneLeverPassage | null;
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

/**
 * ART-005: pianerottolo in fondo alla scala di discesa.
 *
 * Usa le stesse costanti del renderer (STAIRCASE in balance.ts): se le due
 * formule divergessero, il trigger del cambio piano finirebbe a mezz'aria o
 * dentro la parete. La geometria della scala è in Staircase.ts, ma il punto
 * di arrivo va calcolato anche qui perché serve alla simulazione.
 */
function stairBottomFor(origin: SceneVector3, directionRad: number): SceneVector3 {
  const totalRun = STAIRCASE.stepCount * STAIRCASE.stepRunM;
  const totalDrop = STAIRCASE.stepCount * STAIRCASE.stepRiseM;
  // +1.0 = metà pianerottolo oltre l'ultimo gradino, come in createStaircase.
  const along = totalRun + 1.0;
  return {
    x: origin.x + Math.sin(directionRad) * along,
    // Poco sopra la lastra: il giocatore ci sta in piedi, non dentro.
    y: -totalDrop + 0.9,
    z: origin.z + Math.cos(directionRad) * along,
  };
}

/** Altezza della coppa del braciere sul pavimento. */
const BRAZIER_Y = 0.35;
/** Distanza dei bracieri dalle pareti: addossati, non in mezzo al passaggio. */
const BRAZIER_WALL_INSET_M = 1.6;
/** Sotto questa dimensione la stanza è troppo stretta per un braciere. */
const BRAZIER_MIN_ROOM_M = 6;
/** Da questa dimensione in su la stanza ne merita due, su lati opposti. */
const BRAZIER_LARGE_ROOM_M = 11;

/**
 * Distribuisce i bracieri nelle stanze del piano.
 *
 * In una piramide i bracieri sono l'unica fonte di luce fissa: devono essere
 * ricorrenti e leggibili da lontano. Prima ne esisteva UNO per piano, legato
 * al landmark 'braciere-eterno' assegnato a una sola stanza — di fatto
 * invisibili durante l'esplorazione.
 *
 * Deterministico: la posizione dipende solo da roomId, nessun Math.random,
 * quindi lo stesso seed produce sempre lo stesso piano.
 *
 * Nota di bilanciamento: i bracieri ricaricano la torcia
 * (TORCH.brazierIgnitionCostSeconds / brazierRefillCapSeconds). Aumentandone
 * il numero si allenta la pressione della gestione carburante — un braciere
 * ogni stanza media è il compromesso scelto fra leggibilità e tensione.
 */
function deriveBraziers(
  floorId: string,
  rooms: readonly FloorSceneRoom[],
): FloorSceneBrazier[] {
  const result: FloorSceneBrazier[] = [];

  for (const room of rooms) {
    const width = room.bounds.maxX - room.bounds.minX;
    const depth = room.bounds.maxZ - room.bounds.minZ;
    if (width < BRAZIER_MIN_ROOM_M || depth < BRAZIER_MIN_ROOM_M) continue;

    // Le stanze sicure restano volutamente illuminate: sono punti di sosta.
    const isLarge = width >= BRAZIER_LARGE_ROOM_M && depth >= BRAZIER_LARGE_ROOM_M;
    const count = isLarge ? 2 : 1;

    // Angolo di partenza derivato dall'id: stanze diverse hanno bracieri su
    // lati diversi, senza che serva un generatore casuale.
    const roomNumber = Number(room.roomId) || 0;
    const startCorner = roomNumber % 4;

    for (let i = 0; i < count; i++) {
      // Con due bracieri si usano angoli opposti (offset di 2 su 4).
      const corner = (startCorner + i * 2) % 4;
      const westSide = corner === 0 || corner === 3;
      const northSide = corner === 0 || corner === 1;

      const x = westSide
        ? room.bounds.minX + BRAZIER_WALL_INSET_M
        : room.bounds.maxX - BRAZIER_WALL_INSET_M;
      const z = northSide
        ? room.bounds.minZ + BRAZIER_WALL_INSET_M
        : room.bounds.maxZ - BRAZIER_WALL_INSET_M;

      result.push({
        brazierId: `${floorId}:brazier:${String(room.roomId)}:${String(i)}`,
        roomId: room.roomId,
        position: { x, y: BRAZIER_Y, z },
      });
    }
  }

  return result;
}

/**
 * ART-006 / GAME-ART-012: trappole del piano.
 *
 * Distribuzione deterministica (nessun Math.random):
 *   Piastre: (roomId + floorIndex*3) % 5 === 0, esclusi ENTRY/EXIT; floor ≥ 2.
 *   Pendoli: corridoi ≥ minCorridorLengthM (8 m); floor ≥ 2.
 *   Dardi: (roomId + floorIndex*5) % 7 === 0, esclusi ENTRY/EXIT; floor ≥ 3.
 *   Masso: corridoi ≥ 6 m e (from+to+floor) % 3 === 0, senza pendolo sullo stesso; floor ≥ 3.
 */
function deriveTraps(
  floorId: string,
  floorIndex: number,
  rooms: readonly FloorSceneRoom[],
  corridors: readonly FloorSceneCorridor[],
  entryRoomId: RoomId,
  exitRoomId: RoomId,
): FloorSceneTrap[] {
  if (floorIndex < 2) return [];

  const traps: FloorSceneTrap[] = [];
  const pendulumCorridorKeys = new Set<string>();

  for (const room of rooms) {
    if (room.roomId === entryRoomId || room.roomId === exitRoomId) continue;
    const roomNum = Number(room.roomId);
    if ((roomNum + floorIndex * 3) % 5 !== 0) continue;

    const xOff = ((roomNum * 7) % 5 - 2) * 0.55;
    const zOff = ((roomNum * 11) % 5 - 2) * 0.55;

    traps.push({
      trapId: `${floorId}:trap:plate:${String(room.roomId)}`,
      kind: 'pressurePlate',
      position: {
        x: room.center.x + xOff,
        y: 0,
        z: room.center.z + zOff,
      },
    });
  }

  for (const corridor of corridors) {
    const length = corridor.axis === 'x'
      ? corridor.bounds.maxX - corridor.bounds.minX
      : corridor.bounds.maxZ - corridor.bounds.minZ;
    if (length < TRAPS.bladePendulum.minCorridorLengthM) continue;

    const centerX = (corridor.bounds.minX + corridor.bounds.maxX) / 2;
    const centerZ = (corridor.bounds.minZ + corridor.bounds.maxZ) / 2;
    const key = `${String(corridor.fromRoomId)}-${String(corridor.toRoomId)}`;
    pendulumCorridorKeys.add(key);

    traps.push({
      trapId: `${floorId}:trap:pendulum:${key}`,
      kind: 'bladePendulum',
      position: { x: centerX, y: 0, z: centerZ },
      corridorLengthM: length,
      corridorAxis: corridor.axis,
    });
  }

  // GAME-ART-012: dardi da nicchia (piani ≥ 3).
  if (floorIndex >= TRAPS.dartLauncher.minFloorIndex) {
    for (const room of rooms) {
      if (room.roomId === entryRoomId || room.roomId === exitRoomId) continue;
      const roomNum = Number(room.roomId);
      if ((roomNum + floorIndex * 5) % 7 !== 0) continue;

      const width = room.bounds.maxX - room.bounds.minX;
      const depth = room.bounds.maxZ - room.bounds.minZ;
      const fireAlongX = width >= depth;
      const inset = 0.55;
      const position = fireAlongX
        ? {
            x: room.bounds.minX + inset,
            y: 0,
            z: room.center.z + ((roomNum % 3) - 1) * 0.4,
          }
        : {
            x: room.center.x + ((roomNum % 3) - 1) * 0.4,
            y: 0,
            z: room.bounds.minZ + inset,
          };

      traps.push({
        trapId: `${floorId}:trap:dart:${String(room.roomId)}`,
        kind: 'dartLauncher',
        position,
        corridorAxis: fireAlongX ? 'x' : 'z',
        corridorLengthM: fireAlongX ? width : depth,
      });
    }
  }

  // GAME-ART-012: masso nei corridoi medi/lunghi senza pendolo.
  if (floorIndex >= TRAPS.rollingBoulder.minFloorIndex) {
    for (const corridor of corridors) {
      const length = corridor.axis === 'x'
        ? corridor.bounds.maxX - corridor.bounds.minX
        : corridor.bounds.maxZ - corridor.bounds.minZ;
      if (length < TRAPS.rollingBoulder.minCorridorLengthM) continue;

      const key = `${String(corridor.fromRoomId)}-${String(corridor.toRoomId)}`;
      if (pendulumCorridorKeys.has(key)) continue;
      const fromN = Number(corridor.fromRoomId);
      const toN = Number(corridor.toRoomId);
      if ((fromN + toN + floorIndex) % 3 !== 0) continue;

      const centerX = (corridor.bounds.minX + corridor.bounds.maxX) / 2;
      const centerZ = (corridor.bounds.minZ + corridor.bounds.maxZ) / 2;

      traps.push({
        trapId: `${floorId}:trap:boulder:${key}`,
        kind: 'rollingBoulder',
        position: { x: centerX, y: 0, z: centerZ },
        corridorLengthM: length,
        corridorAxis: corridor.axis,
      });
    }
  }

  return traps;
}

/**
 * ART-006: meccanismo leva+sigillo del piano.
 *
 * Seleziona la stanza più grande che abbia un landmark, escludendo entrata
 * ed uscita. La leva è addossata alla parete nord-ovest; il sigillo di pietra
 * è posizionato sul lato sud della stessa stanza, davanti a una nicchia
 * immaginaria. Appare solo a partire dal piano TRAPS.lever.minFloorIndex (3).
 *
 * Il sigillo è visivo-only: il passaggio fisico non esiste, ma la lastra
 * nera suggerisce al giocatore che c'è qualcosa di nascosto. Quando la leva
 * viene tirata, TrapSystem anima la discesa della lastra (sealDropProgress).
 */
function deriveLeverPassage(
  floorId: string,
  floorIndex: number,
  rooms: readonly FloorSceneRoom[],
  entryRoomId: RoomId,
  exitRoomId: RoomId,
): FloorSceneLeverPassage | null {
  // La leva compare solo nei piani avanzati e a rotazione (piani dispari >= 3).
  if (floorIndex < TRAPS.lever.minFloorIndex) return null;
  if (floorIndex % 2 === 0) return null; // Solo piani dispari: 3, 5, 7 …

  // La stanza più grande con un landmark (escluse entrata ed uscita).
  let bestRoom: FloorSceneRoom | null = null;
  let bestArea = 0;
  for (const room of rooms) {
    if (room.roomId === entryRoomId || room.roomId === exitRoomId) continue;
    if (!room.landmarkId) continue;
    const area =
      (room.bounds.maxX - room.bounds.minX) * (room.bounds.maxZ - room.bounds.minZ);
    if (area > bestArea) {
      bestArea = area;
      bestRoom = room;
    }
  }
  if (!bestRoom) return null;

  const room = bestRoom;
  const roomNum = Number(room.roomId);

  // Leva: angolo nord-ovest della stanza, inset dalla parete.
  const leverPosition: SceneVector3 = {
    x: room.bounds.minX + 1.8,
    y: 0,
    z: room.bounds.minZ + 1.5,
  };

  // Sigillo: lato sud della stanza, leggermente sfalsato per varietà.
  // L'offset laterale è deterministico: cambia da stanza a stanza.
  const lateralOff = ((roomNum % 3) - 1) * 1.2; // -1.2, 0, +1.2
  const sealW = Math.min(2.4, (room.bounds.maxX - room.bounds.minX) * 0.28);
  const sealDepth = 0.35;

  // sealPosition.y = metà altezza del sigillo quando è "chiuso":
  // il sigillo copre l'altezza sealDropM, il centro è a sealDropM/2.
  const sealPosition: SceneVector3 = {
    x: room.center.x + lateralOff,
    y: TRAPS.lever.sealDropM / 2,
    z: room.bounds.maxZ - 1.2,
  };

  return {
    leverId: `${floorId}:lever:${String(room.roomId)}`,
    leverPosition,
    sealPosition,
    sealWidthM: sealW,
    sealDepthM: sealDepth,
  };
}

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

function offsetShovelPosition(room: RoomNode, seed: number): SceneVector3 {
  const center = centerOfBounds(room.bounds, FLOOR_Y);
  const xOffset = DIG_SITE_OFFSET_OPTIONS[Math.abs(seed * 7 + room.id) % DIG_SITE_OFFSET_OPTIONS.length] ?? 0;
  const zOffset = DIG_SITE_OFFSET_OPTIONS[Math.abs(seed * 11 ^ room.id) % DIG_SITE_OFFSET_OPTIONS.length] ?? 0;
  return {
    x: clamp(center.x + xOffset, room.bounds.minX + ROOM_INSET_M, room.bounds.maxX - ROOM_INSET_M),
    y: 0.04,
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
  const special = floor.specialRoom ?? null;
  const rooms = floor.rooms.map((room) => {
    const openings = room.doors
      .map((doorId) => roomIndex.get(doorId))
      .filter((linkedRoom): linkedRoom is RoomNode => linkedRoom !== undefined)
      .map((linkedRoom) => inferDirection(room.bounds, linkedRoom.bounds));

    if (room.id === exitRoom.id) {
      openings.push(exitDirection);
    }

    const forcedTheme =
      special?.roomId === room.id
        ? themeForSpecialKind(special.kind)
        : null;

    return {
      roomId: room.id,
      role: room.role,
      bounds: room.bounds,
      center: centerOfBounds(room.bounds, FLOOR_Y),
      landmarkId: room.landmarkId,
      openings,
      // ART-004 / GAME-ART-008: tema deterministico; stanza speciale forza il mood.
      theme: forcedTheme ?? themeForRoom(floor.floorIndex, Number(room.id), room.role),
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

  const braziers = deriveBraziers(floor.floorId, rooms);

  const treasureRoom = roomIndex.get(floor.treasureRoomId);
  const digSite = treasureRoom
    ? {
      siteId: `${floor.floorId}:dig:${String(treasureRoom.id)}`,
      roomId: treasureRoom.id,
      position: offsetDigSitePosition(treasureRoom, floor.seed),
    }
    : null;

  // Pala: posizionata in una stanza qualsiasi che non sia l'entrata né il tesoro.
  const shovelCandidates = floor.rooms.filter(
    (r) => r.id !== floor.entryRoomId && r.id !== floor.treasureRoomId,
  );
  const shovelRoomIdx = (floor.seed ^ 0x3a1b) % Math.max(1, shovelCandidates.length);
  const shovelRoom = shovelCandidates[shovelRoomIdx] ?? floor.rooms[0];
  const shovelPickup = shovelRoom ? offsetShovelPosition(shovelRoom, floor.seed ^ 0x5c2d) : null;

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

  // ART-006: trappole e meccanismo leva derivati dal seed del piano.
  const traps = deriveTraps(
    floor.floorId,
    floor.floorIndex,
    rooms,
    corridors,
    floor.entryRoomId,
    floor.exitRoomId,
  );
  const leverPassage = deriveLeverPassage(
    floor.floorId,
    floor.floorIndex,
    rooms,
    floor.entryRoomId,
    floor.exitRoomId,
  );

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
    exitIsStair: floor.exitIsStair,
    stairBottom: floor.exitIsStair
      ? stairBottomFor(
        positionInsideWall(exitRoom.bounds, exitDirection, ROOM_INSET_M, EXIT_Y),
        exitDirection === 'east' || exitDirection === 'west' ? Math.PI / 2 : 0,
      )
      : null,
    exitDirection,
    rooms,
    corridors,
    landmarks,
    braziers,
    doorways,
    digSite,
    shovelPickup,
    traps,
    leverPassage,
  };
}
