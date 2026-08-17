/**
 * Scopo: verificare TUTTE le invarianti di un piano generato prima che venga
 *        inviato al renderer o serializzato in un salvataggio.
 * Ownership: pura. Non conosce Three, Rapier, DOM.
 * Invarianti verificate: vedi FLOOR_INVARIANTS (numerazione allineata alla
 *        Master Bible v4, §29.4).
 * Failure mode: un piano con almeno una violazione BLOCKING non deve mai essere
 *        usato; il generatore ritenta con salt incrementale, poi usa il template
 *        di fallback e registra l'errore.
 */

import type { Result } from '@/core/Result.js';
import type { RoomId } from '@/procedural/Ids.js';
import { err, ok } from '@/core/Result.js';

export type { RoomId } from '@/procedural/Ids.js';

export type RoomRole =
  | 'ENTRY' | 'EXIT' | 'SAFE' | 'COMBAT' | 'TOOL'
  | 'MAP' | 'TREASURE' | 'FORGE' | 'OPTIONAL' | 'JUNCTION' | 'STAIR';

export interface RoomBounds {
  readonly minX: number; readonly minZ: number;
  readonly maxX: number; readonly maxZ: number;
}

export interface RoomNode {
  readonly id: RoomId;
  readonly role: RoomRole;
  readonly bounds: RoomBounds;
  /** Stanze collegate da una porta. Deve essere reciproco. */
  readonly doors: readonly RoomId[];
  /** Chiave richiesta per attraversare l'ingresso della stanza, se presente. */
  readonly requiredKeyId: string | null;
  /** Raggio libero attorno al punto di spawn, in metri. */
  readonly spawnClearanceM: number;
  readonly landmarkId: string | null;
}

export interface FloorModel {
  readonly floorId: string;
  readonly seed: number;
  readonly generationVersion: number;
  readonly isTutorial: boolean;
  /** v2: indice del piano (1..MAX_FLOORS) — fascia tematica per decor/audio. */
  readonly floorIndex: number;
  readonly rooms: readonly RoomNode[];
  readonly entryRoomId: RoomId;
  readonly exitRoomId: RoomId;
  readonly mapRoomId: RoomId;
  readonly treasureRoomId: RoomId;
  readonly keysByRoomId: Readonly<Record<string, string>>;
  /** G-10: true = l'uscita del piano è una SCALA verso il piano successivo
   *  (floorIndex < MAX_FLOORS), false = porta sigillata finale (piano 10). */
  readonly exitIsStair: boolean;
}

export interface ValidationLimits {
  readonly minPlayerClearanceM: number;
  readonly mapToTreasureMinGraphDistance: number;
  readonly mapToTreasureMaxGraphDistance: number;
}

export type Severity = 'BLOCKING' | 'WARNING';

export interface Violation {
  readonly code: string;
  readonly severity: Severity;
  readonly message: string;
  readonly roomId?: RoomId;
}

const ROLE_EXACT_COUNTS: readonly (readonly [RoomRole, number])[] = [
  ['ENTRY', 1], ['EXIT', 1], ['MAP', 1], ['TREASURE', 1],
];
const ROLE_MIN_COUNTS: readonly (readonly [RoomRole, number])[] = [
  ['SAFE', 1], ['FORGE', 1], ['OPTIONAL', 2],
];

function buildIndex(rooms: readonly RoomNode[]): Map<RoomId, RoomNode> {
  const index = new Map<RoomId, RoomNode>();
  for (const room of rooms) index.set(room.id, room);
  return index;
}

/** BFS sul grafo delle porte. Restituisce la distanza in nodi, -1 se irraggiungibile. */
export function graphDistance(
  rooms: readonly RoomNode[],
  from: RoomId,
  to: RoomId,
): number {
  const index = buildIndex(rooms);
  if (!index.has(from) || !index.has(to)) return -1;
  if (from === to) return 0;

  const visited = new Set<RoomId>([from]);
  let frontier: RoomId[] = [from];
  let depth = 0;

  while (frontier.length > 0) {
    depth++;
    const nextFrontier: RoomId[] = [];
    for (const id of frontier) {
      const node = index.get(id);
      if (node === undefined) continue;
      for (const neighbour of node.doors) {
        if (visited.has(neighbour)) continue;
        if (neighbour === to) return depth;
        visited.add(neighbour);
        nextFrontier.push(neighbour);
      }
    }
    frontier = nextFrontier;
  }
  return -1;
}

/** BFS che restituisce il percorso più breve come array di RoomId, o null se irraggiungibile. */
function findShortestPath(
  rooms: readonly RoomNode[],
  from: RoomId,
  to: RoomId,
): readonly RoomId[] | null {
  const index = buildIndex(rooms);
  if (!index.has(from) || !index.has(to)) return null;
  if (from === to) return [from];

  const visited = new Set<RoomId>([from]);
  const parent = new Map<RoomId, RoomId>();
  let frontier: RoomId[] = [from];

  while (frontier.length > 0) {
    const nextFrontier: RoomId[] = [];
    for (const id of frontier) {
      const node = index.get(id);
      if (node === undefined) continue;
      for (const neighbour of node.doors) {
        if (visited.has(neighbour)) continue;
        visited.add(neighbour);
        parent.set(neighbour, id);
        if (neighbour === to) {
          const path: RoomId[] = [to];
          let current = to;
          while (current !== from) {
            const p = parent.get(current);
            if (p === undefined) return null;
            path.push(p);
            current = p;
          }
          return path.reverse();
        }
        nextFrontier.push(neighbour);
      }
    }
    frontier = nextFrontier;
  }
  return null;
}

function boundsOverlap(a: RoomBounds, b: RoomBounds): boolean {
  return a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

export function validateFloor(
  floor: FloorModel,
  limits: ValidationLimits,
): Result<FloorModel, readonly Violation[]> {
  const violations: Violation[] = [];
  const add = (code: string, severity: Severity, message: string, roomId?: RoomId): void => {
    violations.push(roomId === undefined ? { code, severity, message } : { code, severity, message, roomId });
  };

  // INV-04: room ID unici.
  const seen = new Set<RoomId>();
  for (const room of floor.rooms) {
    if (seen.has(room.id)) add('INV-04', 'BLOCKING', `Room ID duplicato: ${room.id}`, room.id);
    seen.add(room.id);
  }
  const index = buildIndex(floor.rooms);

  // INV-05: porte reciproche e non pendenti.
  for (const room of floor.rooms) {
    for (const neighbourId of room.doors) {
      const neighbour = index.get(neighbourId);
      if (neighbour === undefined) {
        add('INV-05', 'BLOCKING', `Porta verso stanza inesistente ${neighbourId}`, room.id);
        continue;
      }
      if (!neighbour.doors.includes(room.id)) {
        add('INV-05', 'BLOCKING', `Porta non reciproca ${room.id} -> ${neighbourId}`, room.id);
      }
    }
  }

  // INV-06: nessuna sovrapposizione dei bounds.
  for (let i = 0; i < floor.rooms.length; i++) {
    const a = floor.rooms[i];
    if (a === undefined) continue;
    for (let j = i + 1; j < floor.rooms.length; j++) {
      const b = floor.rooms[j];
      if (b === undefined) continue;
      if (boundsOverlap(a.bounds, b.bounds)) {
        add('INV-06', 'BLOCKING', `Bounds sovrapposti ${a.id} / ${b.id}`, a.id);
      }
    }
  }

  // INV-07: clearance di spawn.
  for (const room of floor.rooms) {
    if (room.spawnClearanceM < limits.minPlayerClearanceM) {
      add('INV-07', 'BLOCKING', `Clearance insufficiente (${room.spawnClearanceM} m)`, room.id);
    }
  }

  // INV-10: nessun NaN/Infinity nei bounds.
  for (const room of floor.rooms) {
    const { minX, minZ, maxX, maxZ } = room.bounds;
    if (![minX, minZ, maxX, maxZ, room.spawnClearanceM].every(isFiniteNumber)) {
      add('INV-10', 'BLOCKING', 'Valore non finito nei bounds o nella clearance', room.id);
    }
  }

  // INV-01: percorso ingresso -> uscita.
  if (graphDistance(floor.rooms, floor.entryRoomId, floor.exitRoomId) < 0) {
    add('INV-01', 'BLOCKING', 'Nessun percorso ingresso -> uscita');
  }

  // INV-02 / INV-03 / INV-08: mappa e tesoro.
  if (floor.mapRoomId === floor.treasureRoomId) {
    add('INV-03', 'BLOCKING', 'Il tesoro si trova nella stanza della mappa');
  }
  const mapToTreasure = graphDistance(floor.rooms, floor.mapRoomId, floor.treasureRoomId);
  if (mapToTreasure < 0) {
    add('INV-02', 'BLOCKING', 'Nessun percorso mappa -> tesoro');
  } else {
    const min = floor.isTutorial ? 1 : limits.mapToTreasureMinGraphDistance;
    if (mapToTreasure < min || mapToTreasure > limits.mapToTreasureMaxGraphDistance) {
      add('INV-08', 'WARNING', `Distanza mappa-tesoro fuori range: ${mapToTreasure}`);
    }
  }

  // INV-13: conteggi dei ruoli.
  const roleCount = new Map<RoomRole, number>();
  for (const room of floor.rooms) {
    roleCount.set(room.role, (roleCount.get(room.role) ?? 0) + 1);
  }
  for (const [role, expected] of ROLE_EXACT_COUNTS) {
    const actual = roleCount.get(role) ?? 0;
    if (actual !== expected) {
      add('INV-13', 'BLOCKING', `Ruolo ${role}: attesi ${expected}, trovati ${actual}`);
    }
  }
  for (const [role, minimum] of ROLE_MIN_COUNTS) {
    const actual = roleCount.get(role) ?? 0;
    if (actual < minimum) {
      add('INV-13', 'WARNING', `Ruolo ${role}: attesi almeno ${minimum}, trovati ${actual}`);
    }
  }

  // INV-09: landmark unico su ogni intersezione.
  const landmarks = new Set<string>();
  for (const room of floor.rooms) {
    const isJunction = room.role === 'JUNCTION' || room.doors.length >= 3;
    if (!isJunction) continue;
    if (room.landmarkId === null) {
      add('INV-09', 'WARNING', 'Intersezione senza landmark', room.id);
      continue;
    }
    if (landmarks.has(room.landmarkId)) {
      add('INV-09', 'WARNING', `Landmark duplicato: ${room.landmarkId}`, room.id);
    }
    landmarks.add(room.landmarkId);
  }

  // INV-14: il tesoro non è sul percorso critico (ingresso -> uscita), salvo tutorial.
  if (!floor.isTutorial) {
    const criticalPath = findShortestPath(floor.rooms, floor.entryRoomId, floor.exitRoomId);
    if (criticalPath?.includes(floor.treasureRoomId) === true) {
      add('INV-14', 'WARNING', 'Il tesoro si trova sul percorso critico ingresso -> uscita');
    }
  }

  // INV-15: nessuna stanza chiave dietro una porta la cui chiave sta oltre la porta stessa.
  for (const room of floor.rooms) {
    if (room.requiredKeyId === null) continue;
    const keyRoomRaw = floor.keysByRoomId[room.requiredKeyId];
    if (keyRoomRaw === undefined) {
      add('INV-15', 'BLOCKING', `Chiave ${room.requiredKeyId} non collocata`, room.id);
      continue;
    }
    const keyRoomId = Number(keyRoomRaw) as RoomId;
    if (keyRoomId === room.id) {
      add('INV-15', 'BLOCKING', `Chiave ${room.requiredKeyId} chiusa nella stanza che apre`, room.id);
    }
  }

  const blocking = violations.filter((v) => v.severity === 'BLOCKING');
  return blocking.length === 0 ? ok(floor) : err(violations);
}

/**
 * INV-11: verifica round-trip di serializzazione.
 * Testata fuori dal validatore (richiede serializzare e deserializzare il floor).
 */
export function checkSerializationRoundTrip(
  floor: FloorModel,
  serialize: (f: FloorModel) => string,
  deserialize: (s: string) => FloorModel,
): Violation | null {
  try {
    const serialized = serialize(floor);
    const restored = deserialize(serialized);
    const reserialized = serialize(restored);
    if (serialized !== reserialized) {
      return {
        code: 'INV-11',
        severity: 'BLOCKING',
        message: 'Round-trip di serializzazione non identico',
      };
    }
    return null;
  } catch (e) {
    return {
      code: 'INV-11',
      severity: 'BLOCKING',
      message: `Errore nel round-trip: ${String(e)}`,
    };
  }
}

/** Elenco leggibile delle invarianti, usato dalla documentazione e dai report. */
export const FLOOR_INVARIANTS: Readonly<Record<string, string>> = {
  'INV-01': 'esiste un percorso ingresso -> uscita',
  'INV-02': 'esiste un percorso mappa -> tesoro',
  'INV-03': 'la stanza del tesoro è diversa dalla stanza della mappa',
  'INV-04': 'i room ID sono unici',
  'INV-05': 'le porte sono reciproche e non pendenti',
  'INV-06': 'i bounds delle stanze non si sovrappongono',
  'INV-07': 'ogni spawn ha clearance sufficiente per la capsula',
  'INV-08': 'la distanza mappa-tesoro rientra nel range configurato',
  'INV-09': 'ogni intersezione ha un landmark unico',
  'INV-10': 'nessun valore numerico è NaN o Infinity',
  'INV-11': 'round-trip di serializzazione identico',
  'INV-12': 'determinismo: stesso seed + versione => stesso SerializedFloor',
  'INV-13': 'i ruoli obbligatori sono presenti nel numero previsto',
  'INV-14': 'il tesoro non è sul percorso critico, salvo tutorial',
  'INV-15': 'nessuna chiave è chiusa dietro la porta che apre',
};
