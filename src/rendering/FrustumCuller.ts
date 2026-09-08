/**
 * R-03: Frustum culling per stanze del dungeon.
 *
 * Il dungeon è diviso in room rettangolari. Ogni room ha una AABB
 * (Axis-Aligned Bounding Box). Il FrustumCuller disabilita il root
 * Group di ogni room non visibile dalla camera.
 *
 * Risparmio atteso: su floor con 15 stanze e 1-3 visibili dalla
 * camera, ~80% delle draw call vengono eliminate.
 *
 * Design:
 *   - Aggiornato una volta per frame (nel render loop, non nella sim)
 *   - Usa THREE.Frustum.intersectsBox() (nessuna allocazione per-frame)
 *   - Margine di espansione opzionale per evitare pop-in
 *
 * VINCOLO: nessun performance.now() — il timing viene dal renderer.
 */

import * as THREE from 'three';

export interface RoomBounds {
  readonly id: string;
  readonly min: { readonly x: number; readonly y: number; readonly z: number };
  readonly max: { readonly x: number; readonly y: number; readonly z: number };
  /** Group Three.js che contiene tutti i mesh della stanza. */
  readonly group: THREE.Group;
}

export interface FrustumCuller {
  /**
   * Registra una stanza da gestire.
   * Può essere chiamato ogni volta che un floor viene caricato.
   */
  registerRoom(bounds: RoomBounds): void;

  /** Rimuove tutte le stanze registrate (chiamare a inizio floor). */
  clearRooms(): void;

  /**
   * G-31: solo queste stanze possono diventare visibili (hop BFS).
   * `null` = nessuna restrizione di streaming.
   */
  setActiveRoomIds(ids: ReadonlySet<string> | null): void;

  /**
   * Aggiorna visibilità di tutte le stanze in base al frustum corrente.
   * Chiamare ogni frame, DOPO camera.updateMatrixWorld().
   *
   * @param camera — camera corrente (PerspectiveCamera)
   * @param expansionM — espansione AABB in metri (default 1m per evitare pop-in)
   * @returns numero di stanze visibili / totali
   */
  update(
    camera: THREE.PerspectiveCamera,
    expansionM?: number,
  ): { visible: number; total: number };

  /** Forza visibilità di tutte le stanze (debug). */
  showAll(): void;
}

// Oggetti temporanei (evita allocazioni per-frame)
const _frustum = new THREE.Frustum();
const _projScreenMatrix = new THREE.Matrix4();
const _box = new THREE.Box3();
const _boxMin = new THREE.Vector3();
const _boxMax = new THREE.Vector3();

export function createFrustumCuller(): FrustumCuller {
  const rooms = new Map<string, RoomBounds>();
  let activeIds: Set<string> | null = null;

  return {
    registerRoom(bounds) {
      rooms.set(bounds.id, bounds);
      bounds.group.visible = true; // visibile per default
    },

    clearRooms() {
      rooms.clear();
      activeIds = null;
    },

    setActiveRoomIds(ids) {
      activeIds = ids ? new Set(ids) : null;
    },

    update(camera, expansionM = 1.0) {
      // Aggiorna frustum dalla matrice camera+proiezione
      camera.updateWorldMatrix(true, false);
      _projScreenMatrix.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      );
      _frustum.setFromProjectionMatrix(_projScreenMatrix);

      let visible = 0;
      const total = rooms.size;

      for (const room of rooms.values()) {
        _boxMin.set(
          room.min.x - expansionM,
          room.min.y - expansionM,
          room.min.z - expansionM,
        );
        _boxMax.set(
          room.max.x + expansionM,
          room.max.y + expansionM,
          room.max.z + expansionM,
        );
        _box.set(_boxMin, _boxMax);

        const hopAllowed = activeIds === null || activeIds.has(room.id);
        const isVisible = hopAllowed && _frustum.intersectsBox(_box);
        room.group.visible = isVisible;
        if (isVisible) visible++;
      }

      return { visible, total };
    },

    showAll() {
      for (const room of rooms.values()) {
        room.group.visible = true;
      }
    },
  };
}
