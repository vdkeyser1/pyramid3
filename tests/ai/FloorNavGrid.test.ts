import { describe, expect, it } from 'vitest';
import {
  buildNavGridFromBounds,
  regionsFromSceneLayout,
} from '@/ai/navigation/FloorNavGrid.js';
import { findPath } from '@/ai/navigation/GridNavigator.js';

describe('FloorNavGrid', () => {
  it('buildNavGridFromBounds marca camminabili le celle nei bounds', () => {
    const nav = buildNavGridFromBounds(
      [{ minX: 0, minZ: 0, maxX: 4, maxZ: 2 }],
      1,
    );
    expect(nav).not.toBeNull();
    expect(nav!.grid.width).toBeGreaterThanOrEqual(4);
    expect(nav!.grid.cells.some((c) => c.walkable)).toBe(true);
  });

  it('regionsFromSceneLayout unisce stanze e corridoi', () => {
    const regions = regionsFromSceneLayout({
      rooms: [{ bounds: { minX: 0, minZ: 0, maxX: 2, maxZ: 2 } }],
      corridors: [{ bounds: { minX: 2, minZ: 0, maxX: 4, maxZ: 1 } }],
    });
    expect(regions).toHaveLength(2);
  });

  it('findPath trova un percorso su griglia costruita da bounds', () => {
    const nav = buildNavGridFromBounds(
      [{ minX: 0, minZ: 0, maxX: 6, maxZ: 2 }],
      1,
    )!;
    const start = nav.worldToCell(0.5, 0.5);
    const goal = nav.worldToCell(5.5, 0.5);
    const path = findPath(nav.grid, start.x, start.z, goal.x, goal.z);
    expect(path).not.toBeNull();
    expect(path!.waypoints.length).toBeGreaterThan(0);
  });
});
