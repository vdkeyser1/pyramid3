import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildSecretCryptStaircase } from '@/rendering/SecretCryptStaircase.js';

describe('SecretCryptStaircase — Discesa a gradini per la cripta segreta', () => {
  it('costruisce 10 gradini scolpiti, pareti laterali e cripta inferiore con tesori', () => {
    const mat = new THREE.MeshBasicMaterial({ color: 0x8a7350 });
    const staircase = buildSecretCryptStaircase({ x: 0, y: 0, z: 0 }, 0, mat);

    expect(staircase.group.children.length).toBeGreaterThan(12);
    expect(staircase.cryptFloorY).toBeLessThan(-2.0); // almeno 2m di profondità

    staircase.dispose();
  });
});
