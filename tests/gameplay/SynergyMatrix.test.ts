import { describe, expect, it } from 'vitest';
import { resolveSynergies } from '@/gameplay/SynergyMatrix.js';
import { PHARAOH_PACTS, getPharaohPactById } from '@/content/PactSarcophagi.js';

describe('SynergyMatrix & PactSarcophagi — Buildcrafting e Patti Oscuri (Fase 3)', () => {
  it('resolveSynergies attiva correttamente Supernova Solare con Lancia di Ra e benedizione di Ra', () => {
    const active = resolveSynergies('spear_of_ra', ['BLESSING_RA_SOLAR_MIGHT'], true);
    expect(active.some((s) => s.id === 'SOLAR_SUPERNOVA')).toBe(true);
  });

  it('resolveSynergies attiva Frenesia Faraonica al buio totale con Sekhmet', () => {
    const lit = resolveSynergies('golden_khopesh', ['BLESSING_SEKHMET_WRATH'], true);
    expect(lit.some((s) => s.id === 'PHARAOH_FRENZY')).toBe(false);

    const unlit = resolveSynergies('golden_khopesh', ['BLESSING_SEKHMET_WRATH'], false);
    expect(unlit.some((s) => s.id === 'PHARAOH_FRENZY')).toBe(true);
  });

  it('PHARAOH_PACTS contiene patti con ricompense, maledizioni e uccisioni di purificazione', () => {
    expect(PHARAOH_PACTS.length).toBe(3);

    for (const pact of PHARAOH_PACTS) {
      expect(pact.name.length).toBeGreaterThan(3);
      expect(pact.boonDescription.length).toBeGreaterThan(10);
      expect(pact.curseDescription.length).toBeGreaterThan(10);
      expect(pact.purgeKillsRequired).toBeGreaterThan(0);
    }

    const blind = getPharaohPactById('PACT_BLIND_TREASURE');
    expect(blind).toBeDefined();
    expect(blind?.goldReward).toBe(150);
  });
});
