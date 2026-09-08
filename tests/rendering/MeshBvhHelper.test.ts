import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  enableMeshBvhExtension,
  computeBvhOnMesh,
  createAcceleratedRaycaster,
} from '@/rendering/MeshBvhHelper.js';

describe('MeshBvhHelper — Accelerazione spaziale three-mesh-bvh (P09)', () => {
  it('enableMeshBvhExtension è idempotente e registra i metodi sui prototipi', () => {
    enableMeshBvhExtension();
    enableMeshBvhExtension();

    const geom = new THREE.BoxGeometry(2, 2, 2);
    expect(typeof (geom as unknown as { computeBoundsTree: () => void }).computeBoundsTree).toBe('function');
  });

  it('computeBvhOnMesh genera il boundsTree per una geometria complessa', () => {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(3, 1, 16, 32));
    computeBvhOnMesh(mesh);

    const geom = mesh.geometry as unknown as { boundsTree?: object };
    expect(geom.boundsTree).toBeDefined();
  });

  it('createAcceleratedRaycaster imposta firstHitOnly = true e interseca con successo', () => {
    const raycaster = createAcceleratedRaycaster(
      new THREE.Vector3(0, 0, 5),
      new THREE.Vector3(0, 0, -1),
    );

    expect((raycaster as unknown as { firstHitOnly: boolean }).firstHitOnly).toBe(true);

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    computeBvhOnMesh(mesh);

    const hits = raycaster.intersectObject(mesh);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.point.z).toBeCloseTo(1, 1);
  });
});
