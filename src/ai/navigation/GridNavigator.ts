/**
 * Scopo: navigazione A* su griglia per nemici individuali (§30.1).
 * Ownership: simulazione AI.
 * Invarianti:
 *   - A* per nemici singoli; flow field solo per sciami oltre soglia;
 *   - budget di ricerca limitato per tick;
 *   - nessuna dipendenza da rendering.
 */

export interface GridCell {
  readonly x: number;
  readonly z: number;
  readonly walkable: boolean;
  readonly cost: number;
}

export interface NavGrid {
  readonly width: number;
  readonly depth: number;
  readonly cellSizeM: number;
  readonly cells: readonly GridCell[];
}

export interface NavPath {
  readonly waypoints: readonly { x: number; z: number }[];
  readonly totalCost: number;
}

function cellIndex(grid: NavGrid, x: number, z: number): number {
  return z * grid.width + x;
}

function getCell(grid: NavGrid, x: number, z: number): GridCell | undefined {
  if (x < 0 || x >= grid.width || z < 0 || z >= grid.depth) return undefined;
  return grid.cells[cellIndex(grid, x, z)];
}

function heuristic(ax: number, az: number, bx: number, bz: number): number {
  // Manhattan distance (ammissibile per griglia a 4 direzioni)
  return Math.abs(ax - bx) + Math.abs(az - bz);
}

const NEIGHBOURS: readonly [number, number][] = [
  [0, 1], [0, -1], [1, 0], [-1, 0],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/**
 * A* con budget di nodi esplorati per evitare spike.
 */
export function findPath(
  grid: NavGrid,
  startX: number,
  startZ: number,
  goalX: number,
  goalZ: number,
  maxNodes = 512,
): NavPath | null {
  const start = getCell(grid, startX, startZ);
  const goal = getCell(grid, goalX, goalZ);
  if (!start || !goal || !start.walkable || !goal.walkable) return null;

  const openSet = new Map<number, { x: number; z: number; g: number; f: number }>();
  const cameFrom = new Map<number, number>();
  const gScore = new Map<number, number>();

  const startIdx = cellIndex(grid, startX, startZ);
  const goalIdx = cellIndex(grid, goalX, goalZ);

  openSet.set(startIdx, { x: startX, z: startZ, g: 0, f: heuristic(startX, startZ, goalX, goalZ) });
  gScore.set(startIdx, 0);

  let nodesExplored = 0;

  while (openSet.size > 0 && nodesExplored < maxNodes) {
    // Trova il nodo con f minore
    let bestIdx = -1;
    let bestF = Infinity;
    for (const [idx, node] of openSet) {
      if (node.f < bestF) {
        bestF = node.f;
        bestIdx = idx;
      }
    }

    if (bestIdx === -1) break;

    const current = openSet.get(bestIdx);
    if (!current) break;
    openSet.delete(bestIdx);
    nodesExplored++;

    if (bestIdx === goalIdx) {
      // Ricostruisci il percorso
      const waypoints: { x: number; z: number }[] = [];
      let idx = goalIdx;
      while (idx !== startIdx) {
        const cx = idx % grid.width;
        const cz = Math.floor(idx / grid.width);
        waypoints.push({ x: cx * grid.cellSizeM, z: cz * grid.cellSizeM });
        const prev = cameFrom.get(idx);
        if (prev === undefined) break;
        idx = prev;
      }
      waypoints.reverse();
      return { waypoints, totalCost: current.g };
    }

    for (const [dx, dz] of NEIGHBOURS) {
      const nx = current.x + dx;
      const nz = current.z + dz;
      const neighbour = getCell(grid, nx, nz);
      if (!neighbour?.walkable) continue;

      const nIdx = cellIndex(grid, nx, nz);
      const moveCost = dx !== 0 && dz !== 0 ? 1.414 : 1.0;
      const tentativeG = current.g + neighbour.cost * moveCost;

      const existingG = gScore.get(nIdx);
      if (existingG !== undefined && tentativeG >= existingG) continue;

      gScore.set(nIdx, tentativeG);
      cameFrom.set(nIdx, bestIdx);
      openSet.set(nIdx, {
        x: nx,
        z: nz,
        g: tentativeG,
        f: tentativeG + heuristic(nx, nz, goalX, goalZ),
      });
    }
  }

  return null; // Nessun percorso trovato entro il budget
}
