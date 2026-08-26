import { describe, expect, it } from 'vitest';
import { buildProceduralMummyGroup } from '@/rendering/EgyptianMummyMesh.js';

describe('EgyptianMummyMesh — Modello 3D Antropomorfo della Mummia Egizia', () => {
  it('costruisce la mummia con testa, braccia, torso, gambe e collare Nemes', () => {
    const mummy = buildProceduralMummyGroup(false);
    expect(mummy.children.length).toBeGreaterThanOrEqual(10);

    const royal = buildProceduralMummyGroup(true);
    expect(royal.children.length).toBeGreaterThanOrEqual(11);
  });
});
