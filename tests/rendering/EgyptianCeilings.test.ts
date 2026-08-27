import { describe, it, expect } from 'vitest';
import { createEgyptianCeiling } from '../../src/rendering/EgyptianCeilings';

describe('EgyptianCeilings', () => {
  it('genera un soffitto stellato in lapislazzuli con stelle dorate', () => {
    const ceiling = createEgyptianCeiling({
      width: 10,
      depth: 10,
      height: 3.5,
      style: 'starlit_lapis',
    });
    expect(ceiling).toBeDefined();
    expect(ceiling.name).toBe('Ceiling_starlit_lapis');
    expect(ceiling.children.length).toBeGreaterThan(10);
  });

  it('genera una volta aggettante corbelled a gradoni', () => {
    const vault = createEgyptianCeiling({
      width: 8,
      depth: 12,
      height: 3.2,
      style: 'corbelled_vault',
    });
    expect(vault).toBeDefined();
    expect(vault.name).toBe('Ceiling_corbelled_vault');
    expect(vault.children.length).toBe(5);
  });

  it('genera un soffitto a cassettoni monumentali', () => {
    const coffered = createEgyptianCeiling({
      width: 12,
      depth: 12,
      height: 4.0,
      style: 'coffered_temple',
    });
    expect(coffered).toBeDefined();
    expect(coffered.name).toBe('Ceiling_coffered_temple');
    expect(coffered.children.length).toBeGreaterThan(5);
  });

  it('genera un soffitto con fenditure crepate', () => {
    const cracked = createEgyptianCeiling({
      width: 6,
      depth: 6,
      height: 3.0,
      style: 'cracked_fissure',
    });
    expect(cracked).toBeDefined();
    expect(cracked.name).toBe('Ceiling_cracked_fissure');
    expect(cracked.children.length).toBe(2);
  });
});
