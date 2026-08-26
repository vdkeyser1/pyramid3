import { describe, expect, it } from 'vitest';
import {
  createTorchFlame,
  createParticleBurst,
  createWeaponTrail,
  createSmokePlume,
  createDustMotes,
} from '@/rendering/Vfx.js';
import * as THREE from 'three';

describe('Vfx — Effetti visivi procedurali', () => {
  it('createTorchFlame produce gruppo con fiamma e luce e aggiorna con update()', () => {
    const flame = createTorchFlame();
    expect(flame.group).toBeDefined();
    expect(flame.light).toBeDefined();
    expect(flame.group.children.length).toBeGreaterThanOrEqual(2);

    flame.update(16, 1.0);
    flame.setFlickerReduced(true);
    flame.update(16, 0.5);
    expect(flame.light.intensity).toBeGreaterThan(0);
  });

  it('createParticleBurst emette particelle e aggiorna senza errori', () => {
    const burst = createParticleBurst();
    expect(burst.idle).toBe(true);

    burst.emit(new THREE.Vector3(0, 1, 0), 0xffd27a, 16);
    expect(burst.idle).toBe(false);

    burst.update(50);
    expect(burst.points.visible).toBe(true);
  });

  it('createWeaponTrail gestisce slash e fade out', () => {
    const trail = createWeaponTrail();
    expect(trail.mesh.visible).toBe(false);

    trail.slash({ x: 0, y: 1, z: 0 }, Math.PI / 4);
    expect(trail.mesh.visible).toBe(true);

    const isAlive = trail.update(50);
    expect(isAlive).toBe(true);

    // Dopo un tempo sufficiente (> 220ms), il trail deve svanire
    trail.update(300);
    expect(trail.mesh.visible).toBe(false);
  });

  it('createSmokePlume gestisce animazione di salita e intensità', () => {
    const smoke = createSmokePlume({ x: 2, y: 0, z: 3 });
    expect(smoke.points).toBeDefined();
    expect(smoke.points.frustumCulled).toBe(false);

    smoke.update(16);
    expect(smoke.points.visible).toBe(true);

    smoke.setIntensity(0);
    smoke.update(16);
    expect(smoke.points.visible).toBe(false);

    smoke.setIntensity(0.8);
    smoke.update(16);
    expect(smoke.points.visible).toBe(true);

    smoke.dispose();
  });

  it('createDustMotes gestisce sospensione attorno al centro e wrap-around', () => {
    const dust = createDustMotes();
    expect(dust.points).toBeDefined();

    // Aggiorna con player a (0, 0, 0)
    dust.update(16, { x: 0, y: 1.7, z: 0 });
    expect(dust.points.visible).toBe(true);

    // Aggiorna con player che si sposta molto lontano (test del wrap-around toroidale)
    dust.update(33, { x: 50, y: 1.7, z: -50 });
    expect(dust.points.visible).toBe(true);

    dust.dispose();
  });
});
