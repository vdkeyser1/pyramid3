/**
 * Scopo: Growing Tree maze generator con braiding per la necropoli.
 * Ownership: pura. Produce un grafo di stanze valido per FloorModel.
 */

import type { RoomId, RoomRole, RoomNode, RoomBounds, FloorModel } from '@/procedural/FloorValidator.js';
import type { FloorGenerationInput } from '@/procedural/FloorModel.js';
import { validateFloor, graphDistance } from '@/procedural/FloorValidator.js';
import type { ValidationLimits } from '@/procedural/FloorValidator.js';
import { createSeedRngFactory, type RandomSource } from '@/procedural/SeedRng.js';
import { pickSpecialRoom } from '@/procedural/SpecialRooms.js';
import { FLOOR_CONSTRAINTS } from '@/content/balance.js';
import { MAX_FLOORS } from '@/content/floorProgression.js';
import { createLogger } from '@/core/Logger.js';

const log = createLogger('FloorGenerator');

// ─── Costanti ───

const ROOM_SIZE_M = 12;
const CORRIDOR_LENGTH_M = 8;
const MIN_PLAYER_CLEARANCE = 3.0;

// ─── Geometria piramidale ───
//
// La piramide si percorre dall'apice verso la base: il piano 1 è la camera
// più alta e stretta, il piano MAX_FLOORS è la più ampia. Ogni livello deve
// quindi essere più largo e più ricco di stanze del precedente — è l'unica
// promessa spaziale che una piramide fa, e va mantenuta nella generazione,
// non solo nel tema.
//
// Prima queste erano tre costanti fisse (8×6, 14 stanze) e `floorIndex`
// serviva solo da etichetta: tutti i piani avevano forma identica.

/** Griglia dell'apice (piano 1): poche celle, percorso breve. */
const APEX_COLS = 4;
const APEX_ROWS = 3;
const APEX_MIN_ROOMS = 5;

/** Griglia della base (piano MAX_FLOORS): ampia e ramificata. */
const BASE_COLS = 10;
const BASE_ROWS = 8;
const BASE_MIN_ROOMS = 28;

/** Dimensioni della griglia per un dato piano. */
export interface PyramidGrid {
  readonly cols: number;
  readonly rows: number;
  readonly minRooms: number;
}

/**
 * Interpola le dimensioni della griglia fra apice e base.
 * Monotòna non decrescente in `floorIndex`: è la proprietà che
 * FloorValidator verifica e su cui poggia la leggibilità della discesa.
 */
export function pyramidGridFor(floorIndex: number): PyramidGrid {
  const clamped = Math.max(1, Math.min(MAX_FLOORS, Math.floor(floorIndex)));
  // t = 0 all'apice, 1 alla base. Con MAX_FLOORS = 1 il denominatore
  // degenererebbe: in quel caso il piano unico è la base.
  const span = MAX_FLOORS - 1;
  const t = span > 0 ? (clamped - 1) / span : 1;
  return {
    cols:     Math.round(APEX_COLS      + (BASE_COLS      - APEX_COLS)      * t),
    rows:     Math.round(APEX_ROWS      + (BASE_ROWS      - APEX_ROWS)      * t),
    minRooms: Math.round(APEX_MIN_ROOMS + (BASE_MIN_ROOMS - APEX_MIN_ROOMS) * t),
  };
}

const DEFAULT_LIMITS: ValidationLimits = {
  minPlayerClearanceM: MIN_PLAYER_CLEARANCE,
  mapToTreasureMinGraphDistance: FLOOR_CONSTRAINTS.mapToTreasureMinGraphDistance,
  mapToTreasureMaxGraphDistance: FLOOR_CONSTRAINTS.mapToTreasureMaxGraphDistance,
};

const MAX_RETRIES = 20;

// ─── Tipi interni ───

interface GridCell {
  col: number; row: number; visited: boolean; id: RoomId;
}

interface GeneratedRoom {
  id: RoomId; col: number; row: number;
  doors: RoomId[]; isDeadEnd: boolean;
}

// ─── Helpers ───

const roomId = (n: number): RoomId => n as RoomId;

/** Estrae un elemento da un array, o restituisce undefined. */
function at<T>(arr: readonly T[], idx: number): T | undefined {
  return idx >= 0 && idx < arr.length ? arr[idx] : undefined;
}

function neighborsOf(
  cell: GridCell,
  grid: readonly (readonly GridCell[])[],
  gridSize: PyramidGrid,
): GridCell[] {
  const result: GridCell[] = [];
  const dirs: readonly (readonly [number, number])[] = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
  for (const [dc, dr] of dirs) {
    const nc = cell.col + dc;
    const nr = cell.row + dr;
    if (nc >= 0 && nc < gridSize.cols && nr >= 0 && nr < gridSize.rows) {
      const n = grid[nr]?.[nc];
      if (n) result.push(n);
    }
  }
  return result;
}

function boundsFor(col: number, row: number): RoomBounds {
  const bx = col * (ROOM_SIZE_M + CORRIDOR_LENGTH_M);
  const bz = row * (ROOM_SIZE_M + CORRIDOR_LENGTH_M);
  return { minX: bx, minZ: bz, maxX: bx + ROOM_SIZE_M, maxZ: bz + ROOM_SIZE_M };
}

// ─── Landmark pool ───

const LANDMARKS: readonly string[] = [
  'statua-anubi', 'obelisco-spezzato', 'braciere-eterno',
  'colonna-scarabeo', 'sarcofago-aperto', 'pozzo-oscuro',
  'altare-thoth', 'coccodrillo-pietra', 'vaso-canopo-gigante',
  'geroglifico-luminoso', 'catena-ancestrale', 'specchio-ossidiana',
  'portale-sigillato', 'scale-infrante', 'occhio-horus',
  'piuma-maat', 'scettro-was', 'ankh-murale',
];

// ─── Fase 1: Growing Tree con braiding ───

function generateMaze(
  rng: RandomSource,
  isTutorial: boolean,
  gridSize: PyramidGrid,
): GeneratedRoom[] {
  const grid: GridCell[][] = [];
  let nextCellId = 1;
  for (let row = 0; row < gridSize.rows; row++) {
    const gridRow: GridCell[] = [];
    for (let col = 0; col < gridSize.cols; col++) {
      gridRow.push({ col, row, visited: false, id: roomId(nextCellId++) });
    }
    grid.push(gridRow);
  }

  // Il tutorial parte da una riga fissa per essere riproducibile, ma la sua
  // griglia può essere più bassa di 4 righe: va limitata all'altezza reale.
  const startRow = isTutorial
    ? Math.min(3, gridSize.rows - 1)
    : rng.int(0, gridSize.rows);
  const startRowData = grid[startRow];
  if (!startRowData) return [];
  const startCell = startRowData[0];
  if (!startCell) return [];
  startCell.visited = true;

  const activeList: GridCell[] = [startCell];
  const doorMap = new Map<RoomId, Set<RoomId>>();

  const addDoor = (a: RoomId, b: RoomId): void => {
    let set = doorMap.get(a);
    if (!set) { set = new Set(); doorMap.set(a, set); }
    set.add(b);
    set = doorMap.get(b);
    if (!set) { set = new Set(); doorMap.set(b, set); }
    set.add(a);
  };

  while (activeList.length > 0) {
    const useLast = rng.next() < FLOOR_CONSTRAINTS.corridorBias;
    const idx = useLast ? activeList.length - 1 : rng.int(0, activeList.length);
    const current = at(activeList, idx);
    if (!current) { activeList.splice(idx, 1); continue; }

    const unvisited = neighborsOf(current, grid, gridSize).filter((n) => !n.visited);
    if (unvisited.length === 0) {
      activeList.splice(idx, 1);
      continue;
    }

    const chosenIdx = rng.int(0, unvisited.length);
    const chosen = unvisited[chosenIdx];
    if (!chosen) continue;
    chosen.visited = true;
    activeList.push(chosen);
    addDoor(current.id, chosen.id);
  }

  // Raccogli celle visitate
  const generated: GeneratedRoom[] = [];
  for (const row of grid) {
    for (const cell of row) {
      if (cell.visited) {
        const doors = doorMap.get(cell.id);
        generated.push({
          id: cell.id, col: cell.col, row: cell.row,
          doors: doors ? [...doors] : [],
          isDeadEnd: (doors?.size ?? 0) <= 1,
        });
      }
    }
  }

  // Braiding
  const deadEnds = generated.filter((r) => r.isDeadEnd);
  const braidTarget = Math.floor(deadEnds.length * FLOOR_CONSTRAINTS.braidingRatio);
  let braided = 0;
  const shuffled = rng.shuffle(deadEnds);

  for (const de of shuffled) {
    if (braided >= braidTarget) break;
    const deRow = grid[de.row];
    if (!deRow) continue;
    const deCell = deRow[de.col];
    if (!deCell) continue;

    const candidates = neighborsOf(deCell, grid, gridSize).filter((n) => {
      if (!n.visited) return false;
      return !de.doors.includes(n.id);
    });

    if (candidates.length > 0) {
      const targetIdx = rng.int(0, candidates.length);
      const target = candidates[targetIdx];
      if (!target) continue;

      addDoor(de.id, target.id);
      de.doors = [...de.doors, target.id];
      de.isDeadEnd = de.doors.length <= 1;

      const targetRoom = generated.find((r) => r.id === target.id);
      if (targetRoom) {
        targetRoom.doors = [...targetRoom.doors, de.id];
        targetRoom.isDeadEnd = targetRoom.doors.length <= 1;
      }
      braided++;
    }
  }

  return generated;
}

// ─── Fase 2: Assegnazione ruoli ───

interface RoleAssignment {
  entryRoomId: RoomId;
  exitRoomId: RoomId;
  mapRoomId: RoomId;
  treasureRoomId: RoomId;
  roles: Map<RoomId, RoomRole>;
}

function assignRoles(
  rooms: GeneratedRoom[],
  rng: RandomSource,
  _isTutorial: boolean,
  preferEarlyMap = false,
): RoleAssignment {
  const roles = new Map<RoomId, RoomRole>();
  const available = new Set(rooms.map((r) => r.id));

  const take = (id: RoomId): RoomId => { available.delete(id); return id; };

  const roomById = new Map<RoomId, GeneratedRoom>();
  for (const r of rooms) roomById.set(r.id, r);

  function toRoom(id: RoomId): GeneratedRoom | undefined { return roomById.get(id); }

  // ENTRY: stanza più a sinistra
  const sortedByCol = [...rooms].sort((a, b) => a.col - b.col);
  const entryRoom = at(sortedByCol, 0);
  if (!entryRoom) throw new Error('Nessuna stanza per ENTRY');
  roles.set(take(entryRoom.id), 'ENTRY');

  // EXIT: stanza più a destra
  const sortedByColDesc = [...rooms].sort((a, b) => b.col - a.col);
  const exitRoom = at(sortedByColDesc, 0);
  if (!exitRoom) throw new Error('Nessuna stanza per EXIT');
  roles.set(take(exitRoom.id), 'EXIT');

  // Classificazione
  const junctions = rooms.filter((r) => r.doors.length >= 3 && available.has(r.id));
  const deadEnds = rooms.filter((r) => r.isDeadEnd && available.has(r.id));
  const others = rooms.filter((r) =>
    available.has(r.id) && !junctions.includes(r) && !deadEnds.includes(r),
  );

  const availRooms = (): GeneratedRoom[] =>
    [...available].map(toRoom).filter((r): r is GeneratedRoom => r !== undefined);

  // MAP
  const earlyThresholdCol = Math.floor(
    rooms.reduce((max, room) => Math.max(max, room.col), 0) / 2,
  );
  const earlyRooms = others.filter((room) => room.col <= earlyThresholdCol);
  const mapPool =
    preferEarlyMap && earlyRooms.length > 0
      ? earlyRooms
      : others.length > 0
        ? others
        : availRooms();
  const mapRoom = at(mapPool, rng.int(0, mapPool.length));
  if (!mapRoom) throw new Error('Nessuna stanza per MAP');
  roles.set(take(mapRoom.id), 'MAP');

  // TREASURE (temporaneo)
  const treasurePool = availRooms().filter((r) => r.id !== mapRoom.id);
  const treasureRoom = at(treasurePool, rng.int(0, treasurePool.length))
    ?? rooms.find((r) => r.id !== mapRoom.id)
    ?? at(rooms, 0);
  if (!treasureRoom) throw new Error('Nessuna stanza per TREASURE');
  roles.set(take(treasureRoom.id), 'TREASURE');

  // FORGE
  const forgePool = deadEnds.length > 0 ? deadEnds : availRooms();
  const forgeRoom = at(forgePool, rng.int(0, forgePool.length));
  if (!forgeRoom) throw new Error('Nessuna stanza per FORGE');
  roles.set(take(forgeRoom.id), 'FORGE');

  // SAFE
  const safePool = availRooms();
  if (safePool.length > 0) {
    const safeRoom = at(safePool, rng.int(0, safePool.length));
    if (safeRoom) roles.set(take(safeRoom.id), 'SAFE');
  }

  // OPTIONAL: almeno 2
  let optionalCount = 0;
  const remaining = rng.shuffle(availRooms());
  for (const r of remaining) {
    if (optionalCount >= 2) break;
    if (!available.has(r.id)) continue;
    roles.set(take(r.id), 'OPTIONAL');
    optionalCount++;
  }

  // JUNCTION
  for (const j of junctions) {
    if (available.has(j.id)) roles.set(take(j.id), 'JUNCTION');
  }

  // COMBAT: resto
  for (const id of available) {
    roles.set(take(id), 'COMBAT');
  }

  return { entryRoomId: entryRoom.id, exitRoomId: exitRoom.id, mapRoomId: mapRoom.id, treasureRoomId: treasureRoom.id, roles };
}

// ─── Fase 3: Posizionamento mappa/tesoro ───

function placeTreasure(
  rooms: GeneratedRoom[],
  roleAssignment: RoleAssignment,
  _rng: RandomSource,
  isTutorial: boolean,
): { mapRoomId: RoomId; treasureRoomId: RoomId } {
  const tempRooms: RoomNode[] = rooms.map((r) => ({
    id: r.id,
    role: roleAssignment.roles.get(r.id) ?? 'OPTIONAL',
    bounds: boundsFor(r.col, r.row),
    doors: r.doors,
    requiredKeyId: null,
    spawnClearanceM: MIN_PLAYER_CLEARANCE,
    landmarkId: null,
  }));

  const mapRoom = roleAssignment.mapRoomId;
  const candidates: { id: RoomId; dist: number }[] = [];

  for (const room of rooms) {
    if (room.id === mapRoom) continue;
    const role = roleAssignment.roles.get(room.id);
    if (role === 'ENTRY' || role === 'EXIT') continue;

    const dist = graphDistance(tempRooms, mapRoom, room.id);
    const min = isTutorial
      ? FLOOR_CONSTRAINTS.tutorialMapToTreasureMinGraphDistance
      : FLOOR_CONSTRAINTS.mapToTreasureMinGraphDistance;
    const max = FLOOR_CONSTRAINTS.mapToTreasureMaxGraphDistance;

    if (dist >= min && dist <= max) {
      candidates.push({ id: room.id, dist });
    }
  }

  let treasureRoomId: RoomId;
  if (candidates.length > 0) {
    candidates.sort((a, b) => a.dist - b.dist);
    const midIdx = Math.floor(candidates.length / 2);
    treasureRoomId = candidates[midIdx]?.id ?? (candidates[0]?.id ?? roomId(1));
  } else {
    let maxDist = -1;
    treasureRoomId = rooms[0]?.id ?? roomId(1);
    for (const room of rooms) {
      if (room.id === mapRoom) continue;
      if (room.id === roleAssignment.entryRoomId || room.id === roleAssignment.exitRoomId) continue;
      const dist = graphDistance(tempRooms, mapRoom, room.id);
      if (dist > maxDist) { maxDist = dist; treasureRoomId = room.id; }
    }
  }

  roleAssignment.roles.set(treasureRoomId, 'TREASURE');
  const old = roleAssignment.treasureRoomId;
  if (old !== treasureRoomId && old !== mapRoom && old !== roleAssignment.entryRoomId && old !== roleAssignment.exitRoomId) {
    roleAssignment.roles.set(old, 'COMBAT');
  }

  return { mapRoomId: mapRoom, treasureRoomId };
}

// ─── Fase 4: Landmark ───

function assignLandmarks(
  rooms: GeneratedRoom[],
  roles: Map<RoomId, RoomRole>,
  rng: RandomSource,
): Map<RoomId, string> {
  const landmarks = new Map<RoomId, string>();
  const used = new Set<string>();
  const shuffledLandmarks = rng.shuffle([...LANDMARKS]);

  const priorityOrder = [...rooms].sort((a, b) => {
    const aDoors = a.doors.length >= 3 ? 0 : 1;
    const bDoors = b.doors.length >= 3 ? 0 : 1;
    if (aDoors !== bDoors) return aDoors - bDoors;
    return a.id - b.id;
  });

  for (const room of priorityOrder) {
    const role = roles.get(room.id);
    const needsLandmark =
      room.doors.length >= 3 ||
      role === 'ENTRY' || role === 'EXIT' ||
      role === 'MAP' || role === 'TREASURE' || role === 'FORGE';
    if (!needsLandmark) continue;

    const lm = shuffledLandmarks.find((l) => !used.has(l));
    if (lm) { landmarks.set(room.id, lm); used.add(lm); }
  }

  return landmarks;
}

/**
 * GAME-ART-008a: innesta al più una stanza speciale (peso × SeedRng) su un
 * host COMBAT/OPTIONAL. Non cambia i ruoli obbligatori del validator.
 */
function attachSpecialRoom(
  floor: FloorModel,
  floorIndex: number,
  rng: RandomSource,
): FloorModel {
  const template = pickSpecialRoom(floorIndex, rng);
  if (!template) return { ...floor, specialRoom: null };

  const hosts = floor.rooms.filter(
    (r) => r.role === 'COMBAT' || r.role === 'OPTIONAL' || r.role === 'JUNCTION',
  );
  if (hosts.length === 0) return { ...floor, specialRoom: null };

  const host = rng.pick(hosts);
  if (!host) return { ...floor, specialRoom: null };

  return {
    ...floor,
    specialRoom: {
      roomId: host.id,
      templateId: template.id,
      kind: template.kind,
    },
  };
}

// ─── Fase 5: Assemblaggio ───

function assembleFloor(
  rooms: GeneratedRoom[],
  assignment: RoleAssignment,
  landmarks: Map<RoomId, string>,
  seed: number,
  generationVersion: number,
  isTutorial: boolean,
  floorIndex: number,
): FloorModel {
  const roomNodes: RoomNode[] = rooms.map((r) => ({
    id: r.id,
    role: assignment.roles.get(r.id) ?? 'COMBAT',
    bounds: boundsFor(r.col, r.row),
    doors: r.doors,
    requiredKeyId: null,
    spawnClearanceM: MIN_PLAYER_CLEARANCE,
    landmarkId: landmarks.get(r.id) ?? null,
  }));

  return {
    floorId: `${isTutorial ? 'tutorial' : 'floor'}-${seed.toString(16)}`,
    seed, generationVersion, isTutorial,
    floorIndex,
    rooms: roomNodes,
    entryRoomId: assignment.entryRoomId,
    exitRoomId: assignment.exitRoomId,
    mapRoomId: assignment.mapRoomId,
    treasureRoomId: assignment.treasureRoomId,
    keysByRoomId: {},
    // G-10: i piani non-finali escono con una SCALA, il piano 10 con la porta
    exitIsStair: !isTutorial && floorIndex < MAX_FLOORS,
    specialRoom: null,
  };
}

// ─── Entry point ───

export function generateFloor(input: FloorGenerationInput): FloorModel {
  // La forma del piano dipende dalla profondità: apice stretto, base ampia.
  const gridSize = pyramidGridFor(input.floorIndex);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const salt = attempt * 0x9e3779b9;
    const saltedSeed = (input.seed ^ salt) >>> 0;
    const attemptFactory = createSeedRngFactory(saltedSeed, input.generationVersion);

    const topologyRng = attemptFactory.forChannel('topology');
    const rolesRng = attemptFactory.forChannel('roles');

    const rooms = generateMaze(topologyRng, input.isTutorial, gridSize);
    if (rooms.length < gridSize.minRooms) {
      if (attempt === 0) log.warn(`Troppe poche stanze (${rooms.length}), retry`, { seed: input.seed });
      continue;
    }

    const assignment = assignRoles(
      rooms,
      rolesRng,
      input.isTutorial,
      input.preferEarlyMap ?? false,
    );
    const treasure = placeTreasure(rooms, assignment, rolesRng, input.isTutorial);
    assignment.mapRoomId = treasure.mapRoomId;
    assignment.treasureRoomId = treasure.treasureRoomId;

    const landmarkMap = assignLandmarks(rooms, assignment.roles, rolesRng);
    const decorRng = attemptFactory.forChannel('decor');
    let floor = assembleFloor(rooms, assignment, landmarkMap, saltedSeed, input.generationVersion, input.isTutorial, input.floorIndex);
    floor = attachSpecialRoom(floor, input.floorIndex, decorRng);
    const result = validateFloor(floor, DEFAULT_LIMITS);

    if (result.ok) return result.value;

    if (attempt === 0) {
      log.warn('Validazione fallita, retry con salt', {
        seed: input.seed,
        violations: result.error.map((v: { code: string }) => v.code),
      });
    }
  }

  log.error('Generazione esaurita dopo tutti i retry', { seed: input.seed });
  return createFallbackFloor(input);
}

function createFallbackFloor(input: FloorGenerationInput): FloorModel {
  // Anche il piano di riserva rispetta la forma piramidale: se collassasse a
  // una dimensione fissa, l'invariante di monotonia salterebbe proprio nel
  // caso peggiore, quello in cui il giocatore ne ha più bisogno.
  const roomCount = pyramidGridFor(input.floorIndex).minRooms;
  const genRooms: GeneratedRoom[] = [];
  for (let i = 0; i < roomCount; i++) {
    const doors: RoomId[] = [];
    if (i > 0) doors.push(roomId(i));
    if (i < roomCount - 1) doors.push(roomId(i + 2));
    genRooms.push({ id: roomId(i + 1), col: i, row: 1, doors, isDeadEnd: i === 0 || i === roomCount - 1 });
  }

  const roles = new Map<RoomId, RoomRole>();
  roles.set(roomId(1), 'ENTRY');
  roles.set(roomId(roomCount), 'EXIT');
  const mapId = roomId(Math.floor(roomCount / 3));
  roles.set(mapId, 'MAP');
  const treasureId = roomId(Math.floor((roomCount * 2) / 3));
  roles.set(treasureId, 'TREASURE');
  roles.set(roomId(Math.floor(roomCount / 2)), 'FORGE');
  roles.set(roomId(2), 'SAFE');
  roles.set(roomId(3), 'OPTIONAL');
  roles.set(roomId(roomCount - 1), 'OPTIONAL');
  for (let i = 1; i <= roomCount; i++) {
    if (!roles.has(roomId(i))) roles.set(roomId(i), 'COMBAT');
  }

  const landmarks = new Map<RoomId, string>();
  landmarks.set(roomId(1), 'statua-anubi');
  landmarks.set(roomId(Math.floor(roomCount / 2)), 'obelisco-spezzato');
  landmarks.set(roomId(roomCount), 'braciere-eterno');

  const roomNodes: RoomNode[] = genRooms.map((r) => ({
    id: r.id,
    role: roles.get(r.id) ?? 'COMBAT',
    bounds: boundsFor(r.col, r.row),
    doors: r.doors,
    requiredKeyId: null,
    spawnClearanceM: MIN_PLAYER_CLEARANCE,
    landmarkId: landmarks.get(r.id) ?? null,
  }));

  return {
    floorId: `fallback-${input.seed.toString(16)}`,
    floorIndex: input.floorIndex,
    seed: input.seed, generationVersion: input.generationVersion, isTutorial: input.isTutorial,
    rooms: roomNodes,
    entryRoomId: roomId(1), exitRoomId: roomId(roomCount),
    mapRoomId: mapId, treasureRoomId: treasureId,
    keysByRoomId: {},
    exitIsStair: !input.isTutorial && input.floorIndex < MAX_FLOORS,
    specialRoom: null,
  };
}
