/**
 * R-02: Renderer istanziato per tile del dungeon.
 *
 * Sostituisce i singoli Mesh per pavimenti/pareti/soffitti con
 * InstancedMesh: N tile → 1 draw call per tipo di materiale.
 *
 * Risparmio atteso: da ~80-120 draw call a floor a 3-4 draw call
 * (floor, wall, ceiling, door — ciascuno InstancedMesh).
 *
 * Design:
 *   - InstancedMesh pre-allocato a MAX_INSTANCES (resize raro)
 *   - Matrice di trasformazione passata via setMatrixAt()
 *   - frustumCulled = false sul gruppo root (culling per room si
 *     occupa FrustumCuller.ts separatamente)
 *   - Geometry condivisa per ridurre upload GPU
 *
 * Ownership: ThreeDungeonLayout lo usa invece di buildSingleMesh().
 */

import * as THREE from 'three';

// ─── Costanti ─────────────────────────────────────────────────────────────

const MAX_FLOOR_INSTANCES = 512;
const MAX_WALL_INSTANCES  = 1024;
const MAX_DOOR_INSTANCES  = 64;

// ─── Tipi ─────────────────────────────────────────────────────────────────

export interface TileTransform {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotY?: number;  // radianti, default 0
  readonly scaleX?: number; // default 1
  readonly scaleZ?: number; // default 1
}

export interface InstancedDungeonGroup {
  /** Root da aggiungere alla scena Three.js. */
  readonly root: THREE.Group;
  /**
   * Aggiorna le istanze di pavimento.
   * Chiama sempre dopo aver modificato le posizioni.
   */
  setFloorTiles(tiles: readonly TileTransform[]): void;
  setWallTiles(tiles: readonly TileTransform[]): void;
  setDoorTiles(tiles: readonly TileTransform[]): void;
  /** Aggiorna i colori per un cambio di accessibilità / area. */
  setFloorColor(color: THREE.Color): void;
  setWallColor(color: THREE.Color): void;
  /** Libera GPU memory. Chiamare prima del dispose della scena. */
  dispose(): void;
}

// Tmp object riutilizzato per evitare allocazioni per-frame
const _mat4 = new THREE.Matrix4();
const _pos  = new THREE.Vector3();
const _rot  = new THREE.Euler();
const _quat = new THREE.Quaternion();
const _scl  = new THREE.Vector3();

function applyTileTransform(
  mesh: THREE.InstancedMesh,
  index: number,
  t: TileTransform,
): void {
  _pos.set(t.x, t.y, t.z);
  _rot.set(0, t.rotY ?? 0, 0, 'YXZ');
  _quat.setFromEuler(_rot);
  _scl.set(t.scaleX ?? 1, 1, t.scaleZ ?? 1);
  _mat4.compose(_pos, _quat, _scl);
  mesh.setMatrixAt(index, _mat4);
}

// ─── Geometrie condivise (create una volta, riutilizzate da tutti i floor) ─

let _floorGeo: THREE.PlaneGeometry | null = null;
let _wallGeo:  THREE.BoxGeometry | null = null;
let _doorGeo:  THREE.BoxGeometry | null = null;

function getFloorGeometry(): THREE.PlaneGeometry {
  if (!_floorGeo) {
    _floorGeo = new THREE.PlaneGeometry(1, 1);
    // La geometria è nel piano XZ: ruotiamo UV per tile tiling corretto
    _floorGeo.rotateX(-Math.PI / 2);
  }
  return _floorGeo;
}

function getWallGeometry(): THREE.BoxGeometry {
  _wallGeo ??= new THREE.BoxGeometry(1, 1, 0.1);
  return _wallGeo;
}

function getDoorGeometry(): THREE.BoxGeometry {
  _doorGeo ??= new THREE.BoxGeometry(1, 2, 0.15);
  return _doorGeo;
}

// ─── Factory ──────────────────────────────────────────────────────────────

export function createInstancedDungeonGroup(
  floorMaterial: THREE.Material,
  wallMaterial: THREE.Material,
  doorMaterial: THREE.Material,
): InstancedDungeonGroup {
  const root = new THREE.Group();
  root.name = 'InstancedDungeon';

  // Crea InstancedMesh per ciascun tipo di tile
  const floorMesh = new THREE.InstancedMesh(
    getFloorGeometry(),
    floorMaterial,
    MAX_FLOOR_INSTANCES,
  );
  floorMesh.name = 'floor-instances';
  floorMesh.count = 0;
  floorMesh.receiveShadow = true;
  floorMesh.frustumCulled = false; // FrustumCuller gestisce per room
  root.add(floorMesh);

  const wallMesh = new THREE.InstancedMesh(
    getWallGeometry(),
    wallMaterial,
    MAX_WALL_INSTANCES,
  );
  wallMesh.name = 'wall-instances';
  wallMesh.count = 0;
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  wallMesh.frustumCulled = false;
  root.add(wallMesh);

  const doorMesh = new THREE.InstancedMesh(
    getDoorGeometry(),
    doorMaterial,
    MAX_DOOR_INSTANCES,
  );
  doorMesh.name = 'door-instances';
  doorMesh.count = 0;
  doorMesh.castShadow = true;
  doorMesh.frustumCulled = false;
  root.add(doorMesh);

  // ── Color per istanza (per debug o futuro per-tile variation) ──────────
  // Inizializza instanceColor a bianco
  floorMesh.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_FLOOR_INSTANCES * 3).fill(1),
    3,
  );
  wallMesh.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_WALL_INSTANCES * 3).fill(1),
    3,
  );

  return {
    root,

    // entries() dà l'elemento già tipizzato senza non-null assertion e senza
    // allocare (è un iteratore): usciamo appena superiamo il cap di istanze.
    setFloorTiles(tiles) {
      const count = Math.min(tiles.length, MAX_FLOOR_INSTANCES);
      for (const [i, tile] of tiles.entries()) {
        if (i >= count) break;
        applyTileTransform(floorMesh, i, tile);
      }
      floorMesh.count = count;
      floorMesh.instanceMatrix.needsUpdate = true;
    },

    setWallTiles(tiles) {
      const count = Math.min(tiles.length, MAX_WALL_INSTANCES);
      for (const [i, tile] of tiles.entries()) {
        if (i >= count) break;
        applyTileTransform(wallMesh, i, tile);
      }
      wallMesh.count = count;
      wallMesh.instanceMatrix.needsUpdate = true;
    },

    setDoorTiles(tiles) {
      const count = Math.min(tiles.length, MAX_DOOR_INSTANCES);
      for (const [i, tile] of tiles.entries()) {
        if (i >= count) break;
        applyTileTransform(doorMesh, i, tile);
      }
      doorMesh.count = count;
      doorMesh.instanceMatrix.needsUpdate = true;
    },

    setFloorColor(color) {
      if (!floorMesh.instanceColor) return;
      const n = floorMesh.count;
      for (let i = 0; i < n; i++) {
        floorMesh.setColorAt(i, color);
      }
      floorMesh.instanceColor.needsUpdate = true;
    },

    setWallColor(color) {
      if (!wallMesh.instanceColor) return;
      const n = wallMesh.count;
      for (let i = 0; i < n; i++) {
        wallMesh.setColorAt(i, color);
      }
      wallMesh.instanceColor.needsUpdate = true;
    },

    dispose() {
      floorMesh.dispose();
      wallMesh.dispose();
      doorMesh.dispose();
      root.clear();
    },
  };
}

/**
 * Helper: estrae le TileTransform da una griglia di room layout.
 * Accetta un array di posizioni {x,z} e produce transform con y=0.
 */
export function buildFloorTransforms(
  positions: readonly { readonly x: number; readonly z: number }[],
  tileSize = 1,
): TileTransform[] {
  return positions.map(({ x, z }) => ({
    x: x * tileSize,
    y: 0,
    z: z * tileSize,
    scaleX: tileSize,
    scaleZ: tileSize,
  }));
}

export function buildWallTransforms(
  segments: readonly {
    readonly x: number;
    readonly z: number;
    readonly rotY: number;
    readonly height?: number;
  }[],
  tileSize = 1,
): TileTransform[] {
  return segments.map(({ x, z, rotY, height = 3 }) => ({
    x: x * tileSize,
    y: height / 2,
    z: z * tileSize,
    rotY,
    scaleX: tileSize,
    scaleZ: height,
  }));
}
