import { describe, it, expect } from 'vitest';
import { createEgyptianPriestMesh } from '../../src/rendering/EgyptianPriestMesh';

describe('EgyptianPriestMesh', () => {
  it('istanzia correttamente la mesh del Sommo Sacerdote di Anubi', () => {
    const priest = createEgyptianPriestMesh({ scale: 1.1, eyeIntensity: 2.0 });
    expect(priest).toBeDefined();
    expect(priest.name).toBe('AnubisPriestMesh');
    expect(priest.children.length).toBeGreaterThanOrEqual(6);
  });

  it('include la testa di sciacallo con orecchie e occhi cremisi', () => {
    const priest = createEgyptianPriestMesh();
    const head = priest.children.find((c) => c.type === 'Group');
    expect(head).toBeDefined();
    expect(head!.children.length).toBeGreaterThan(4);
  });
});
