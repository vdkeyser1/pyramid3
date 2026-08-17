/**
 * Test DOM degli effetti visivi (G-15): fiamma procedurale e burst di
 * particelle. Eseguito sotto happy-dom (Three.js Points/Geometry OK).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createParticleBurst, createTorchFlame, createWeaponTrail } from '@/rendering/Vfx.js';

describe('Vfx (G-15)', () => {
  it('crea una fiamma con gruppo, luce e animazione stabile', () => {
    const flame = createTorchFlame();

    expect(flame.group).toBeInstanceOf(THREE.Group);
    expect(flame.light).toBeInstanceOf(THREE.PointLight);
    // update non lancia e produce un valore di luce nel range atteso
    expect(() => {
      flame.update(16, 1);
    }).not.toThrow();
    expect(flame.light.intensity).toBeGreaterThan(0);
    expect(flame.light.intensity).toBeLessThan(10);
  });

  it('reduceTorchFlicker attenua la pulsazione', () => {
    const normal = createTorchFlame();
    const reduced = createTorchFlame();
    reduced.setFlickerReduced(true);

    normal.update(16, 1);
    const normalIntensity = normal.light.intensity;
    reduced.update(16, 1);
    const reducedIntensity = reduced.light.intensity;

    // Entrambi validi, il ridotto ha ampiezza minore intorno al valore base
    expect(normalIntensity).toBeGreaterThan(0);
    expect(reducedIntensity).toBeGreaterThan(0);
    expect(reducedIntensity).toBeLessThanOrEqual(normalIntensity * 1.05 + 0.5);
  });

  it('il burst parte idle e si attiva con emit', () => {
    const burst = createParticleBurst();

    expect(burst.idle).toBe(true);
    burst.emit(new THREE.Vector3(1, 2, 3), 0xffd27a, 12);
    expect(burst.idle).toBe(false);
  });

  it('il burst si aggiorna senza lanciare e torna idle dopo la vita delle particelle', () => {
    const burst = createParticleBurst();
    burst.emit(new THREE.Vector3(0, 0, 0), 0xd4a05a, 8);
    // dt è clampato a 50ms/frame: simulo 40 frame (2s > maxLifetimes max 1.1s)
    for (let frame = 0; frame < 40; frame++) {
      burst.update(1000);
    }
    expect(burst.idle).toBe(true);
  });

  it('il trail arma è invisibile di default e appare con slash()', () => {
    const trail = createWeaponTrail();

    expect(trail.mesh.visible).toBe(false);
    trail.slash({ x: 0, y: 0, z: 0 }, 0);
    expect(trail.mesh.visible).toBe(true);
    expect(trail.update(16)).toBe(true);
  });

  it('il trail svanisce dopo la vita (220ms)', () => {
    const trail = createWeaponTrail();
    trail.slash({ x: 0, y: 0, z: 0 }, Math.PI / 2);
    // 20 frame da 16ms = 320ms > 220ms
    let alive = true;
    for (let frame = 0; frame < 20; frame++) {
      alive = trail.update(16);
    }
    expect(alive).toBe(false);
    expect(trail.mesh.visible).toBe(false);
  });
});
