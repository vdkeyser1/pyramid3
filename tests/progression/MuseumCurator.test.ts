import { describe, expect, it } from 'vitest';
import { MuseumCurator } from '@/progression/MuseumCurator.js';

describe('MuseumCurator — Galleria permanente reperti e sblocco perk (Fase 4)', () => {
  it('registra i reperti recuperati e sblocca perk al raggiungimento delle soglie', () => {
    const curator = new MuseumCurator();

    expect(curator.recoveredCount).toBe(0);
    expect(curator.perks.every((p) => !p.isUnlocked)).toBe(true);

    // Recupera 1 reperto
    curator.recoverRelic('CANOPIC_JAR_HORUS');
    expect(curator.recoveredCount).toBe(1);
    expect(curator.perks.find((p) => p.id === 'PERK_EXTENDED_TORCH')?.isUnlocked).toBe(true);
    expect(curator.perks.find((p) => p.id === 'PERK_REINFORCED_SHOVEL')?.isUnlocked).toBe(false);

    // Recupera altri reperti
    curator.recoverRelic('GOLDEN_SCARAB_AMULET');
    expect(curator.perks.find((p) => p.id === 'PERK_REINFORCED_SHOVEL')?.isUnlocked).toBe(true);
  });
});
