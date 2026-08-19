/**
 * Test: InstancedDungeonRenderer (R-02)
 * Ambiente: node (no WebGL — testiamo la logica di transform, non GPU)
 */

import { describe, it, expect } from 'vitest';
import {
  buildFloorTransforms,
  buildWallTransforms,
} from '@/rendering/InstancedDungeonRenderer.js';

describe('InstancedDungeonRenderer helpers (R-02)', () => {
  it('buildFloorTransforms: genera transform corretti', () => {
    const positions = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 0, z: 1 },
    ];
    const transforms = buildFloorTransforms(positions, 2);
    expect(transforms).toHaveLength(3);
    expect(transforms[0]).toEqual({ x: 0, y: 0, z: 0, scaleX: 2, scaleZ: 2 });
    expect(transforms[1]).toEqual({ x: 2, y: 0, z: 0, scaleX: 2, scaleZ: 2 });
    expect(transforms[2]).toEqual({ x: 0, y: 0, z: 2, scaleX: 2, scaleZ: 2 });
  });

  it('buildFloorTransforms: tileSize 1 (default)', () => {
    const t = buildFloorTransforms([{ x: 5, z: 3 }]);
    expect(t[0]!.x).toBe(5);
    expect(t[0]!.z).toBe(3);
    expect(t[0]!.scaleX).toBe(1);
  });

  it('buildWallTransforms: imposta y a metà altezza', () => {
    const segs = [{ x: 2, z: 3, rotY: 0, height: 4 }];
    const t = buildWallTransforms(segs, 1);
    expect(t[0]!.y).toBe(2); // height/2
    expect(t[0]!.scaleZ).toBe(4);
    expect(t[0]!.rotY).toBe(0);
  });

  it('buildWallTransforms: altezza default 3m', () => {
    const segs = [{ x: 0, z: 0, rotY: Math.PI / 2 }];
    const t = buildWallTransforms(segs, 1);
    expect(t[0]!.y).toBe(1.5); // 3/2
  });

  it('buildWallTransforms: rotazione preservata', () => {
    const rotY = Math.PI / 4;
    const segs = [{ x: 1, z: 1, rotY }];
    const t = buildWallTransforms(segs, 1);
    expect(t[0]!.rotY).toBeCloseTo(rotY, 10);
  });

  it('buildFloorTransforms: lista vuota', () => {
    expect(buildFloorTransforms([])).toHaveLength(0);
  });

  it('buildFloorTransforms: 100 tile (stress)', () => {
    const positions = Array.from({ length: 100 }, (_, i) => ({
      x: i % 10,
      z: Math.floor(i / 10),
    }));
    const transforms = buildFloorTransforms(positions, 1);
    expect(transforms).toHaveLength(100);
    expect(transforms[99]!.x).toBe(9);
    expect(transforms[99]!.z).toBe(9);
  });
});
