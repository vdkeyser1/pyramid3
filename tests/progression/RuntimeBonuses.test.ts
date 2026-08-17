import { describe, expect, it } from 'vitest';
import { getProgressionState } from '@/progression/KaProgression.js';
import {
  getRuntimeBonuses,
  remapCurrentValueToNewMaximum,
} from '@/progression/RuntimeBonuses.js';
import type { SaveData } from '@/progression/SaveManager.js';

function createSaveData(overrides?: Partial<SaveData['payload']>): SaveData {
  return {
    schemaVersion: 1,
    contentVersion: '0.1.0',
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T00:00:00.000Z',
    checksum: 'deadbeef',
    payload: {
      fragments: 0,
      pyramidsUnlocked: 1,
      bestiaryEntries: [],
      discoveredGrafts: [],
      kaNodes: [],
      claimedTreasureSiteIds: [],
      completedFloorIds: [],
      settings: {},
      ...overrides,
    },
  };
}

describe('RuntimeBonuses', () => {
  it('deriva capacita torcia e HP massimi dai nodi persistiti', () => {
    const state = getProgressionState(createSaveData({
      kaNodes: ['respiro-lungo', 'respiro-lungo', 'ka-robusto'],
    }));

    const bonuses = getRuntimeBonuses(state, 180, 100);

    expect(bonuses.torchCapacitySeconds).toBe(216);
    expect(bonuses.playerMaxHp).toBe(110);
    expect(bonuses.hasAnubiRevive).toBe(false);
    expect(bonuses.startsWithStaff).toBe(false);
    expect(bonuses.guaranteesEarlyMap).toBe(false);
  });

  it('espone i flag meta booleani per i nodi runtime one-shot', () => {
    const state = getProgressionState(createSaveData({
      kaNodes: ['patto-di-anubi', 'mano-ferma', 'memoria-di-thoth'],
    }));

    const bonuses = getRuntimeBonuses(state, 180, 100);

    expect(bonuses.hasAnubiRevive).toBe(true);
    expect(bonuses.startsWithStaff).toBe(true);
    expect(bonuses.guaranteesEarlyMap).toBe(true);
  });

  it('espone i flag per Occhio del Ladro, Passo di Bastet e Sangue di Ra', () => {
    const state = getProgressionState(createSaveData({
      kaNodes: ['occhio-del-ladro', 'passo-di-bastet', 'sangue-di-ra'],
    }));

    const bonuses = getRuntimeBonuses(state, 180, 100);

    expect(bonuses.hasLootDangerTell).toBe(true);
    expect(bonuses.hasDodgeIFrames).toBe(true);
    expect(bonuses.canDeposeCurse).toBe(true);

    const none = getRuntimeBonuses(getProgressionState(createSaveData()), 180, 100);
    expect(none.hasLootDangerTell).toBe(false);
    expect(none.hasDodgeIFrames).toBe(false);
    expect(none.canDeposeCurse).toBe(false);
  });

  it('rimappa il valore corrente mantenendo la proporzione sul nuovo massimo', () => {
    expect(remapCurrentValueToNewMaximum(45, 90, 120)).toBe(60);
    expect(remapCurrentValueToNewMaximum(50, 100, 110)).toBe(55);
  });

  it('clampa i casi degeneri senza superare il nuovo massimo', () => {
    expect(remapCurrentValueToNewMaximum(250, 100, 180)).toBe(180);
    expect(remapCurrentValueToNewMaximum(20, 0, 15)).toBe(15);
    expect(remapCurrentValueToNewMaximum(-5, 100, 120)).toBe(0);
  });
});
