/**
 * G-28 — navmesh Recast (@recast-navigation/three).
 *
 * Scopo: bake walkable navmesh dalla geometria floor e pathfinding
 *        NavMeshQuery.computePath. Se WASM non è disponibile, i helper
 *        ritornano null e il chiamante usa GridNavigator (G-23).
 * Ownership: ai/navigation. Lazy-import per non caricare WASM nei test node.
 */

import type { NavBounds } from '@/ai/navigation/FloorNavGrid.js';
import { createLogger } from '@/core/Logger.js';

const log = createLogger('RecastNavMesh');

export interface WorldPathPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface RecastNavMeshHandle {
  computePath(from: WorldPathPoint, to: WorldPathPoint): WorldPathPoint[];
  dispose(): void;
}

let recastReady = false;
let recastFailed = false;

export function isRecastReady(): boolean {
  return recastReady;
}

export async function initRecastRuntime(): Promise<boolean> {
  if (recastReady) return true;
  if (recastFailed) return false;
  try {
    const { init } = await import('@recast-navigation/core');
    await init();
    recastReady = true;
    log.info('Recast WASM inizializzato');
    return true;
  } catch (error) {
    recastFailed = true;
    log.warn('Recast WASM non disponibile, fallback GridNavigator', { error: String(error) });
    return false;
  }
}

const SOLO_CONFIG = {
  cs: 0.2,
  ch: 0.1,
  walkableSlopeAngle: 45,
  walkableHeight: 2,
  walkableClimb: 0.5,
  walkableRadius: 0.4,
  maxEdgeLen: 12,
  maxSimplificationError: 1.3,
  minRegionArea: 8,
  detailSampleDist: 6,
  detailSampleMaxError: 1,
} as const;

/**
 * Bake da mesh Three.js (floor group). Ritorna null se Recast non è pronto.
 */
export async function bakeNavMeshFromMeshes(
  meshes: readonly import('three').Mesh[],
): Promise<RecastNavMeshHandle | null> {
  if (!recastReady && !(await initRecastRuntime())) return null;
  if (meshes.length === 0) return null;

  try {
    const { threeToSoloNavMesh } = await import('@recast-navigation/three');
    const { NavMeshQuery } = await import('@recast-navigation/core');
    const { navMesh } = threeToSoloNavMesh([...meshes], SOLO_CONFIG);
    if (!navMesh) return null;

    const query = new NavMeshQuery(navMesh);
    return {
      computePath(from, to) {
        const { success, path } = query.computePath(from, to);
        if (!success || path.length === 0) return [];
        return path.map((p) => ({ x: p.x, y: p.y, z: p.z }));
      },
      dispose() {
        navMesh.destroy();
      },
    };
  } catch (error) {
    log.warn('Bake Recast fallito', { error: String(error) });
    return null;
  }
}

/**
 * Bake da bounds 2D (stanze/corridoi) senza mesh di scena: un piano per regione.
 */
export async function bakeNavMeshFromBounds(
  regions: readonly NavBounds[],
): Promise<RecastNavMeshHandle | null> {
  if (regions.length === 0) return null;
  if (!recastReady && !(await initRecastRuntime())) return null;

  try {
    const THREE = await import('three');
    const meshes: import('three').Mesh[] = [];
    for (const b of regions) {
      const w = Math.max(0.2, b.maxX - b.minX);
      const d = Math.max(0.2, b.maxZ - b.minZ);
      const geo = new THREE.PlaneGeometry(w, d);
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo);
      mesh.position.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
      mesh.updateMatrixWorld(true);
      meshes.push(mesh);
    }
    return await bakeNavMeshFromMeshes(meshes);
  } catch (error) {
    log.warn('Bake Recast da bounds fallito', { error: String(error) });
    return null;
  }
}
export function firstWaypoint(
  path: readonly WorldPathPoint[],
  skipStart = true,
): WorldPathPoint | null {
  if (path.length === 0) return null;
  const idx = skipStart && path.length > 1 ? 1 : 0;
  return path[idx] ?? null;
}

/** Stima area walkable — usata dai test per validare i bounds in input. */
export function walkableAreaM2(regions: readonly NavBounds[]): number {
  let area = 0;
  for (const b of regions) {
    area += Math.max(0, b.maxX - b.minX) * Math.max(0, b.maxZ - b.minZ);
  }
  return area;
}
