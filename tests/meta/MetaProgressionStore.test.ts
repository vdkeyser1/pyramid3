/**
 * Test: MetaProgressionStore (G-01)
 * Ambiente: jsdom (ha localStorage, no IDB nativo → usa fallback LS)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMetaProgressionStore } from '@/meta/MetaProgressionStore.js';
import { upgradeCost, upgradeBonus } from '@/meta/MetaUpgradeDefinitions.js';

// jsdom fornisce localStorage; IDB non disponibile → fallback automatico
describe('MetaProgressionStore (G-01)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stato iniziale: 0 Ka, nessun upgrade', async () => {
    const store = await createMetaProgressionStore();
    const state = await store.load();
    expect(state.kaFragments).toBe(0);
    expect(Object.keys(state.upgradeLevels)).toHaveLength(0);
    expect(state.stats.totalRuns).toBe(0);
  });

  it('addKaFragments: accumula correttamente', async () => {
    const store = await createMetaProgressionStore();
    await store.load();
    const s1 = await store.addKaFragments(100);
    expect(s1.kaFragments).toBe(100);
    const s2 = await store.addKaFragments(50);
    expect(s2.kaFragments).toBe(150);
  });

  it('addKaFragments: importi negativi ignorati', async () => {
    const store = await createMetaProgressionStore();
    await store.load();
    const s = await store.addKaFragments(-50);
    expect(s.kaFragments).toBe(0);
  });

  it('purchaseUpgrade: acquisto riuscito quando Ka sufficienti', async () => {
    const store = await createMetaProgressionStore();
    await store.load();
    await store.addKaFragments(200);
    const cost = upgradeCost('MENAT_BLESSING', 0); // 50 * 1 * 1.8 = 90
    expect(cost).toBe(90);

    const result = await store.purchaseUpgrade('MENAT_BLESSING');
    expect(result).not.toBeNull();
    expect(result!.upgradeLevels.MENAT_BLESSING).toBe(1);
    expect(result!.kaFragments).toBe(200 - cost);
  });

  it('purchaseUpgrade: fallisce con Ka insufficienti', async () => {
    const store = await createMetaProgressionStore();
    await store.load();
    await store.addKaFragments(10); // troppo poco
    const result = await store.purchaseUpgrade('MENAT_BLESSING');
    expect(result).toBeNull();
  });

  it('purchaseUpgrade: fallisce se dipendenza mancante', async () => {
    const store = await createMetaProgressionStore();
    await store.load();
    await store.addKaFragments(1000);
    // KHEPRI_CARAPACE richiede MENAT_BLESSING lv 1
    const result = await store.purchaseUpgrade('KHEPRI_CARAPACE');
    expect(result).toBeNull();
  });

  it('purchaseUpgrade: non supera maxLevel', async () => {
    const store = await createMetaProgressionStore();
    await store.load();
    await store.addKaFragments(10000);
    // OSIRIS_REBIRTH: maxLevel = 1
    await store.purchaseUpgrade('OSIRIS_REBIRTH');
    const second = await store.purchaseUpgrade('OSIRIS_REBIRTH');
    expect(second).toBeNull();
  });

  it('recordRunResult: aggiorna statistiche e Ka', async () => {
    const store = await createMetaProgressionStore();
    await store.load();
    const after = await store.recordRunResult({
      durationMs: 180000,
      floorReached: 3,
      kills: 15,
      kaEarned: 200,
      isDailyChallenge: false,
      deathCause: 'COBRA',
      seed: 12345,
    });
    expect(after.stats.totalRuns).toBe(1);
    expect(after.stats.totalKills).toBe(15);
    expect(after.stats.bestFloor).toBe(3);
    expect(after.kaFragments).toBe(200);
  });

  it('computeRunBonuses: bonus corretti per ogni upgrade', async () => {
    const store = await createMetaProgressionStore();
    await store.load();
    await store.addKaFragments(10000);
    await store.purchaseUpgrade('MENAT_BLESSING');
    await store.purchaseUpgrade('RA_TORCH');
    const state = await store.load();
    const bonuses = store.computeRunBonuses(state);
    expect(bonuses.hpMultiplier).toBeCloseTo(1.10, 5);
    expect(bonuses.torchDurationMultiplier).toBeCloseTo(1.15, 5);
    expect(bonuses.hasRebirth).toBe(false);
  });

  it('getRunHistory: ritorna le run più recenti prima', async () => {
    const store = await createMetaProgressionStore();
    await store.load();
    await store.recordRunResult({ durationMs: 100, floorReached: 1, kills: 1, kaEarned: 10, isDailyChallenge: false, deathCause: null, seed: 1 });
    await store.recordRunResult({ durationMs: 200, floorReached: 2, kills: 2, kaEarned: 20, isDailyChallenge: false, deathCause: null, seed: 2 });
    const history = await store.getRunHistory(10);
    expect(history).toHaveLength(2);
    expect(history[0]!.floorReached).toBe(2); // più recente prima
  });

  it('reset: azzera tutto', async () => {
    const store = await createMetaProgressionStore();
    await store.load();
    await store.addKaFragments(500);
    await store.reset();
    const fresh = await store.load();
    expect(fresh.kaFragments).toBe(0);
  });
});

describe('MetaUpgradeDefinitions helpers', () => {
  it('upgradeCost cresce con il livello', () => {
    const c0 = upgradeCost('MENAT_BLESSING', 0); // lv 1: 50 * 1 * 1.8
    const c1 = upgradeCost('MENAT_BLESSING', 1); // lv 2: 50 * 2 * 1.8
    expect(c1).toBeGreaterThan(c0);
  });

  it('upgradeBonus è proporzionale al livello', () => {
    const b1 = upgradeBonus('MENAT_BLESSING', 1);
    const b3 = upgradeBonus('MENAT_BLESSING', 3);
    expect(b3).toBeCloseTo(b1 * 3, 5);
  });
});
