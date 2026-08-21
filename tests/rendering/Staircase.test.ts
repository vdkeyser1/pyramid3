import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createStaircase } from '@/rendering/Staircase.js';
import { PLAYER } from '@/content/balance.js';

interface Collider {
  x: number; y: number; z: number;
  hx: number; hy: number; hz: number;
}

function build(directionRad = 0): { stair: ReturnType<typeof createStaircase>; colliders: Collider[] } {
  const colliders: Collider[] = [];
  const material = new THREE.MeshBasicMaterial();
  const stair = createStaircase(
    { x: 10, y: 0, z: 20 },
    directionRad,
    material,
    (x, y, z, hx, hy, hz) => { colliders.push({ x, y, z, hx, hy, hz }); },
  );
  return { stair, colliders };
}

describe('Staircase (ART-005)', () => {
  it('ogni gradino ha il proprio collider', () => {
    const { colliders } = build();
    // 12 gradini + 2 pareti laterali + 1 pianerottolo.
    expect(colliders.length).toBe(15);
  });

  it('l\'alzata resta sotto maxStepM del character controller', () => {
    // Invariante di gameplay: se l'alzata supera maxStepM il giocatore non
    // riesce a risalire la scala e resta bloccato in fondo.
    const { colliders } = build();
    // I gradini sono i primi 12 collider, in ordine di discesa.
    const steps = colliders.slice(0, 12);
    for (let i = 1; i < steps.length; i++) {
      const prev = steps[i - 1];
      const cur = steps[i];
      if (!prev || !cur) continue;
      const rise = Math.abs(prev.y - cur.y);
      expect(rise).toBeLessThan(PLAYER.maxStepM);
    }
  });

  it('i gradini scendono in modo monotono', () => {
    const { colliders } = build();
    const steps = colliders.slice(0, 12);
    for (let i = 1; i < steps.length; i++) {
      const prev = steps[i - 1];
      const cur = steps[i];
      if (!prev || !cur) continue;
      expect(cur.y).toBeLessThan(prev.y);
    }
  });

  it('il fondo è più in basso dell\'origine e la profondità è positiva', () => {
    const { stair } = build();
    expect(stair.depth).toBeGreaterThan(0);
    expect(stair.bottom.y).toBeLessThan(0);
  });

  it('la scala si sviluppa nella direzione richiesta', () => {
    // Direzione 0 ⇒ avanza lungo +Z, restando sulla stessa X.
    const { stair } = build(0);
    expect(stair.bottom.z).toBeGreaterThan(20);
    expect(stair.bottom.x).toBeCloseTo(10, 1);

    // Direzione PI/2 ⇒ avanza lungo +X, restando sulla stessa Z.
    const { stair: rotated } = build(Math.PI / 2);
    expect(rotated.bottom.x).toBeGreaterThan(10);
    expect(rotated.bottom.z).toBeCloseTo(20, 1);
  });

  it('dispose è sicuro e ripetibile', () => {
    const { stair } = build();
    expect(() => {
      stair.dispose();
      stair.dispose();
    }).not.toThrow();
  });
});
