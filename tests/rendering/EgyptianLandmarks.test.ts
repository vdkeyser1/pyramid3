import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildSarcophagus,
  buildStatue,
  buildCanopicJar,
  buildAltar,
  buildWell,
} from '@/rendering/EgyptianLandmarks.js';

describe('EgyptianLandmarks — Landmark procedurali egiziani (P07)', () => {
  const mat = new THREE.MeshBasicMaterial({ color: 0x8a7350 });

  it('buildSarcophagus supporta tutte le 4 varianti egizie', () => {
    const closed = buildSarcophagus(mat, 'CLOSED');
    expect(closed.children.length).toBeGreaterThanOrEqual(2);

    const open = buildSarcophagus(mat, 'OPEN');
    expect(open.children.length).toBeGreaterThanOrEqual(3);

    const broken = buildSarcophagus(mat, 'BROKEN');
    expect(broken.children.length).toBeGreaterThanOrEqual(4);

    const royal = buildSarcophagus(mat, 'ROYAL_GOLD');
    expect(royal.children.length).toBeGreaterThanOrEqual(5);
  });

  it('tutti i mesh dei landmark hanno castShadow e receiveShadow abilitati', () => {
    const statue = buildStatue(mat);
    expect(statue.children.length).toBeGreaterThan(0);
    for (const child of statue.children) {
      expect(child.castShadow).toBe(true);
      expect(child.receiveShadow).toBe(true);
    }

    const jar = buildCanopicJar(mat);
    expect(jar.children.length).toBeGreaterThan(0);

    const altar = buildAltar(mat);
    expect(altar.children.length).toBeGreaterThan(0);

    const well = buildWell(mat);
    expect(well.children.length).toBeGreaterThan(0);
  });
});
