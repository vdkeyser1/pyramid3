import { describe, expect, it } from 'vitest';
import { findPath, type NavGrid } from '@/ai/navigation/GridNavigator.js';

function makeOpenGrid(width: number, depth: number): NavGrid {
  const cells = [];
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      cells.push({ x, z, walkable: true, cost: 1 });
    }
  }
  return { width, depth, cellSizeM: 1, cells };
}

describe('GridNavigator', () => {
  it('trova un percorso corto su griglia aperta', () => {
    const grid = makeOpenGrid(5, 5);
    const path = findPath(grid, 0, 0, 4, 0);
    expect(path).not.toBeNull();
    expect(path!.waypoints.length).toBeGreaterThan(0);
    expect(path!.waypoints.at(-1)).toMatchObject({ x: 4, z: 0 });
    expect(path!.totalCost).toBeGreaterThan(0);
  });

  it('ritorna null se la destinazione è bloccata', () => {
    const grid = makeOpenGrid(3, 3);
    const cells = grid.cells.map((c) =>
      c.x === 2 && c.z === 2 ? { ...c, walkable: false } : c,
    );
    const blocked: NavGrid = { ...grid, cells };
    expect(findPath(blocked, 0, 0, 2, 2)).toBeNull();
  });
});
