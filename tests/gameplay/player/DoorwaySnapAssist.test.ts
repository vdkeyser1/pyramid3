import { describe, expect, it } from 'vitest';
import { applyDoorwaySnapAssist } from '@/gameplay/player/PlayerCharacterController.js';

const DOORWAY = { x: 0, z: 0 };
/** Direzione normalizzata (0,-1) = muoversi verso -z (verso la porta a 0,0). */
const TOWARD = { x: 0, z: -1 };

describe('applyDoorwaySnapAssist (G-18 V4)', () => {
  it('non cambia nulla senza porte', () => {
    const dir = { x: 1, z: 0 };
    expect(applyDoorwaySnapAssist(dir, 5, 5, [])).toEqual(dir);
  });

  it('non devia quando il player è lontano dalla porta (> raggio)', () => {
    const dir = { x: 0, z: -1 };
    const result = applyDoorwaySnapAssist(dir, 5, 5, [DOORWAY]);
    expect(result.x).toBeCloseTo(dir.x, 5);
    expect(result.z).toBeCloseTo(dir.z, 5);
  });

  it('devia verso il centro della porta quando vicino ma non allineato', () => {
    // Player spostato lateralmente (x=0.8) che avanza verso la porta (0,0):
    // la direzione deve virare verso il centro dell'apertura (componente -x).
    const result = applyDoorwaySnapAssist(TOWARD, 0.8, 0.8, [DOORWAY]);
    const len = Math.hypot(result.x, result.z);
    expect(len).toBeCloseTo(1, 3); // normalizzata
    expect(result.x).toBeLessThan(0); // ora punta anche verso -x (centro porta)
  });

  it('più vicino alla porta ⇒ deviazione più forte', () => {
    const near = applyDoorwaySnapAssist(TOWARD, 0.3, 0.6, [DOORWAY]);
    const far = applyDoorwaySnapAssist(TOWARD, 1.2, 0.6, [DOORWAY]);
    // Vicino: forte attrazione laterale; lontano: quasi nulla
    expect(Math.abs(near.x)).toBeGreaterThan(Math.abs(far.x));
  });

  it('non devia se il movimento punta lontano dalla porta', () => {
    // Player a (0.5,0.5) che si muove in (1,1): si allontana dalla porta (0,0)
    const dir = { x: 0.707106, z: 0.707106 };
    const result = applyDoorwaySnapAssist(dir, 0.5, 0.5, [DOORWAY]);
    expect(result.x).toBeCloseTo(dir.x, 4);
    expect(result.z).toBeCloseTo(dir.z, 4);
  });

  it('player già allineato allasse della porta: nessuna deviazione laterale', () => {
    // Player a (0, 0.8) che avanza dritto verso la porta: già sul centro (x=0)
    const result = applyDoorwaySnapAssist(TOWARD, 0, 0.8, [DOORWAY]);
    expect(Math.abs(result.x)).toBeLessThan(0.001);
    expect(result.z).toBeLessThan(0); // continua ad avanzare
  });
});
