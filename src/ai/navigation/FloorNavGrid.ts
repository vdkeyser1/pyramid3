/**
 * GAME-ART: costruisce una NavGrid camminabile da stanze/corridoi di piano.
 * Ownership: ai/navigation. Pura — nessun THREE.
 */

import { type NavGrid, type GridCell } from '@/ai/navigation/GridNavigator.js';

export interface NavBounds {
  readonly minX: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxZ: number;
}

export interface FloorNavGrid {
  readonly grid: NavGrid;
  readonly originX: number;
  readonly originZ: number;
  worldToCell(x: number, z: number): { x: number; z: number };
  cellToWorld(cx: number, cz: number): { x: number; z: number };
}

/**
 * Marca camminabili le celle il cui centro cade in almeno un bounds.
 * cellSizeM tipico: 1.0 (bilanciato con budget A* 512).
 */
export function buildNavGridFromBounds(
  regions: readonly NavBounds[],
  cellSizeM = 1,
): FloorNavGrid | null {
  if (regions.length === 0) return null;

  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const b of regions) {
    minX = Math.min(minX, b.minX);
    minZ = Math.min(minZ, b.minZ);
    maxX = Math.max(maxX, b.maxX);
    maxZ = Math.max(maxZ, b.maxZ);
  }

  const width = Math.max(1, Math.ceil((maxX - minX) / cellSizeM));
  const depth = Math.max(1, Math.ceil((maxZ - minZ) / cellSizeM));
  const cells: GridCell[] = [];

  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      const wx = minX + (x + 0.5) * cellSizeM;
      const wz = minZ + (z + 0.5) * cellSizeM;
      let walkable = false;
      for (const b of regions) {
        if (wx >= b.minX && wx <= b.maxX && wz >= b.minZ && wz <= b.maxZ) {
          walkable = true;
          break;
        }
      }
      cells.push({ x, z, walkable, cost: 1 });
    }
  }

  const grid: NavGrid = { width, depth, cellSizeM, cells };

  return {
    grid,
    originX: minX,
    originZ: minZ,
    worldToCell(x, z) {
      return {
        x: Math.max(0, Math.min(width - 1, Math.floor((x - minX) / cellSizeM))),
        z: Math.max(0, Math.min(depth - 1, Math.floor((z - minZ) / cellSizeM))),
      };
    },
    cellToWorld(cx, cz) {
      return {
        x: minX + (cx + 0.5) * cellSizeM,
        z: minZ + (cz + 0.5) * cellSizeM,
      };
    },
  };
}

/** Helper: rooms + corridors di un layout scena. */
export function regionsFromSceneLayout(layout: {
  readonly rooms: readonly { readonly bounds: NavBounds }[];
  readonly corridors: readonly { readonly bounds: NavBounds }[];
}): NavBounds[] {
  return [
    ...layout.rooms.map((r) => r.bounds),
    ...layout.corridors.map((c) => c.bounds),
  ];
}
