/**
 * Scopo: store SoA per posizione, rotazione e scala delle entità.
 * Ownership: il World ECS.
 */

import { MAX_ENTITIES, NULL_ENTITY, type EntityId } from '@/ecs/EntityAllocator.js';

function idx(id: EntityId): number {
  return id;
}

export interface TransformStore {
  readonly px: Float32Array; readonly py: Float32Array; readonly pz: Float32Array;
  readonly qx: Float32Array; readonly qy: Float32Array; readonly qz: Float32Array; readonly qw: Float32Array;
  readonly sx: Float32Array; readonly sy: Float32Array; readonly sz: Float32Array;
  setPosition(id: EntityId, x: number, y: number, z: number): void;
  setRotation(id: EntityId, qx: number, qy: number, qz: number, qw: number): void;
  setScale(id: EntityId, sx: number, sy: number, sz: number): void;
  remove(id: EntityId): void;
}

export function createTransformStore(): TransformStore {
  const px = new Float32Array(MAX_ENTITIES);
  const py = new Float32Array(MAX_ENTITIES);
  const pz = new Float32Array(MAX_ENTITIES);
  const qx = new Float32Array(MAX_ENTITIES);
  const qy = new Float32Array(MAX_ENTITIES);
  const qz = new Float32Array(MAX_ENTITIES);
  const qw = new Float32Array(MAX_ENTITIES);
  const sx = new Float32Array(MAX_ENTITIES);
  const sy = new Float32Array(MAX_ENTITIES);
  const sz = new Float32Array(MAX_ENTITIES);

  sx.fill(1); sy.fill(1); sz.fill(1);
  qw.fill(1);

  return {
    px, py, pz, qx, qy, qz, qw, sx, sy, sz,

    setPosition(id: EntityId, x: number, y: number, z: number): void {
      if (id === NULL_ENTITY) return;
      const i = idx(id);
      px[i] = x; py[i] = y; pz[i] = z;
    },

    setRotation(id: EntityId, _qx: number, _qy: number, _qz: number, _qw: number): void {
      if (id === NULL_ENTITY) return;
      const i = idx(id);
      qx[i] = _qx; qy[i] = _qy; qz[i] = _qz; qw[i] = _qw;
    },

    setScale(id: EntityId, _sx: number, _sy: number, _sz: number): void {
      if (id === NULL_ENTITY) return;
      const i = idx(id);
      sx[i] = _sx; sy[i] = _sy; sz[i] = _sz;
    },

    remove(id: EntityId): void {
      if (id === NULL_ENTITY) return;
      const i = idx(id);
      px[i] = 0; py[i] = 0; pz[i] = 0;
      qx[i] = 0; qy[i] = 0; qz[i] = 0; qw[i] = 1;
      sx[i] = 1; sy[i] = 1; sz[i] = 1;
    },
  };
}
