/**
 * R-04: LOD (Level of Detail) automatico per mesh del dungeon.
 *
 * Implementazione basata su THREE.LOD con 3 livelli:
 *   LOD-0: mesh completa        (distanza < 8m)
 *   LOD-1: mesh semplificata    (distanza 8-20m, 50% triangoli)
 *   LOD-2: bounding box visivo  (distanza > 20m, solo AABB colorata)
 *
 * I nemici usano un sistema simile:
 *   LOD-0: animazione + shadow   (< 6m)
 *   LOD-1: static pose + shadow  (6-15m)
 *   LOD-2: sprite billboard      (> 15m)
 *
 * In assenza di geometrie LOD pre-generate, il manager crea
 * automaticamente LOD-1 da LOD-0 con decimazione semplificata
 * (ogni altro triangolo) e LOD-2 come BoxGeometry.
 *
 * Ownership: ThreeRendererService lo crea dopo l'init del renderer.
 */

import * as THREE from 'three';

// ─── Soglie LOD ───────────────────────────────────────────────────────────

const ENEMY_LOD_DISTANCES = [0, 6, 15] as const;
const PROP_LOD_DISTANCES  = [0, 8, 20] as const;

// ─── Tipi ─────────────────────────────────────────────────────────────────

export interface LodEntry {
  readonly lodObject: THREE.LOD;
  /** Aggiorna la posizione della sorgente (sincronizzato con la sim). */
  updatePosition(x: number, y: number, z: number): void;
  dispose(): void;
}

// ─── Geometrie LOD semplificate ────────────────────────────────────────────

/**
 * Crea una versione LOD-1 della geometria originale:
 * elimina 1 triangolo su 2 (decimazione naive ma allocazione-free).
 */
function simplifyGeometry(geo: THREE.BufferGeometry, factor = 0.5): THREE.BufferGeometry {
  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
  const indexAttr = geo.getIndex();

  if (!indexAttr) {
    // Non-indexed: torna l'originale (impossibile semplificare senza index)
    return geo;
  }

  const origIdx = indexAttr.array as Uint16Array | Uint32Array;
  const triCount = origIdx.length / 3;
  const keepCount = Math.max(1, Math.floor(triCount * factor));
  const newIdx = new Uint32Array(keepCount * 3);

  for (let i = 0; i < keepCount; i++) {
    newIdx[i * 3]     = origIdx[i * 6] ?? 0;
    newIdx[i * 3 + 1] = origIdx[i * 6 + 1] ?? 0;
    newIdx[i * 3 + 2] = origIdx[i * 6 + 2] ?? 0;
  }

  const simplified = new THREE.BufferGeometry();
  simplified.setAttribute('position', posAttr);
  simplified.setIndex(new THREE.BufferAttribute(newIdx, 1));

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (geo.getAttribute('normal')) {
    simplified.setAttribute('normal', geo.getAttribute('normal'));
  }
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (geo.getAttribute('uv')) {
    simplified.setAttribute('uv', geo.getAttribute('uv'));
  }

  simplified.computeBoundingBox();
  return simplified;
}

/**
 * Crea una BoxGeometry che approssima il bounding box della mesh originale.
 * Usata per LOD-2 (distanza massima).
 */
function createBoundingBoxMesh(
  geo: THREE.BufferGeometry,
  material: THREE.Material,
): THREE.Mesh {
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  if (!bb) return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);

  const size = new THREE.Vector3();
  bb.getSize(size);
  const center = new THREE.Vector3();
  bb.getCenter(center);

  const boxGeo = new THREE.BoxGeometry(size.x, size.y, size.z);
  const mesh = new THREE.Mesh(boxGeo, material);
  mesh.position.copy(center);
  return mesh;
}

// ─── Factory per LOD di nemici ────────────────────────────────────────────

export function createEnemyLodEntry(
  highDetailMesh: THREE.Mesh,
  material: THREE.Material,
): LodEntry {
  const lod = new THREE.LOD();

  // LOD-0: mesh originale con ombre
  highDetailMesh.castShadow = true;
  highDetailMesh.receiveShadow = false;
  lod.addLevel(highDetailMesh, ENEMY_LOD_DISTANCES[0]);

  // LOD-1: mesh semplificata, no ombre (risparmio GPU)
  const simplifiedGeo = simplifyGeometry(
    highDetailMesh.geometry,
    0.5,
  );
  const lod1Mesh = new THREE.Mesh(simplifiedGeo, material);
  lod1Mesh.castShadow = false;
  lod.addLevel(lod1Mesh, ENEMY_LOD_DISTANCES[1]);

  // LOD-2: bounding box colorata (quasi gratis)
  const lod2Mesh = createBoundingBoxMesh(
    highDetailMesh.geometry,
    material,
  );
  lod2Mesh.castShadow = false;
  lod.addLevel(lod2Mesh, ENEMY_LOD_DISTANCES[2]);

  return {
    lodObject: lod,
    updatePosition(x, y, z) {
      lod.position.set(x, y, z);
    },
    dispose() {
      highDetailMesh.geometry.dispose();
      simplifiedGeo.dispose();
      lod2Mesh.geometry.dispose();
    },
  };
}

// ─── Factory per LOD di prop statici (bracieri, urne, ecc.) ──────────────

export function createPropLodEntry(
  highDetailMesh: THREE.Mesh,
  material: THREE.Material,
): LodEntry {
  const lod = new THREE.LOD();

  lod.addLevel(highDetailMesh, PROP_LOD_DISTANCES[0]);

  const simplified = simplifyGeometry(
    highDetailMesh.geometry,
    0.4,
  );
  lod.addLevel(new THREE.Mesh(simplified, material), PROP_LOD_DISTANCES[1]);

  const bbox = createBoundingBoxMesh(
    highDetailMesh.geometry,
    material,
  );
  lod.addLevel(bbox, PROP_LOD_DISTANCES[2]);

  return {
    lodObject: lod,
    updatePosition(x, y, z) {
      lod.position.set(x, y, z);
    },
    dispose() {
      highDetailMesh.geometry.dispose();
      simplified.dispose();
      bbox.geometry.dispose();
    },
  };
}

// ─── Manager globale LOD ──────────────────────────────────────────────────

export interface LodManager {
  /**
   * Aggiorna tutti i LOD in base alla posizione camera.
   * Chiama scene.updateMatrixWorld() PRIMA di questo.
   */
  update(camera: THREE.Camera): void;

  registerLod(entry: LodEntry): void;
  unregisterLod(entry: LodEntry): void;
  clear(): void;

  getStats(): { total: number };
}

export function createLodManager(): LodManager {
  const entries = new Set<LodEntry>();

  return {
    update(camera) {
      for (const entry of entries) {
        entry.lodObject.update(camera);
      }
    },
    registerLod(entry) { entries.add(entry); },
    unregisterLod(entry) { entries.delete(entry); },
    clear() { entries.clear(); },
    getStats() { return { total: entries.size }; },
  };
}
