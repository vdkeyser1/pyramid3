/**
 * Scopo: acceleratore spaziale BVH (Bounding Volume Hierarchy) per Three.js
 *        tramite three-mesh-bvh (P09). Rende il raycasting e le query di
 *        intersezione 10-100× più veloci su geometrie complesse (muri,
 *        architravi, colonne e cripte della piramide).
 * Ownership: rendering.
 */

import * as THREE from 'three';
import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast,
  MeshBVH,
} from 'three-mesh-bvh';

let bvhExtensionEnabled = false;

/**
 * Registra le estensioni BVH sui prototipi standard di Three.js.
 * Idempotente: può essere chiamato più volte in sicurezza.
 */
export function enableMeshBvhExtension(): void {
  if (bvhExtensionEnabled) return;

  const bgProto = THREE.BufferGeometry.prototype as unknown as {
    computeBoundsTree: typeof computeBoundsTree;
    disposeBoundsTree: typeof disposeBoundsTree;
  };
  const meshProto = THREE.Mesh.prototype as unknown as {
    raycast: typeof acceleratedRaycast;
  };

  bgProto.computeBoundsTree = computeBoundsTree;
  bgProto.disposeBoundsTree = disposeBoundsTree;
  meshProto.raycast = acceleratedRaycast;

  bvhExtensionEnabled = true;
}

/**
 * Calcola la struttura BVH per una geometria di un mesh statico del dungeon.
 */
export function computeBvhOnMesh(mesh: THREE.Mesh): void {
  enableMeshBvhExtension();
  const geom = mesh.geometry as unknown as {
    boundsTree?: MeshBVH;
    computeBoundsTree?: (options?: unknown) => void;
  };
  if (typeof geom.computeBoundsTree === 'function') {
    geom.computeBoundsTree();
  }
}

/**
 * Crea un raycaster ottimizzato con firstHitOnly abilitato per query veloci.
 */
export function createAcceleratedRaycaster(
  origin?: THREE.Vector3,
  direction?: THREE.Vector3,
  near = 0,
  far = Number.POSITIVE_INFINITY,
): THREE.Raycaster {
  enableMeshBvhExtension();
  const raycaster = new THREE.Raycaster(origin, direction, near, far);
  (raycaster as unknown as { firstHitOnly: boolean }).firstHitOnly = true;
  return raycaster;
}
