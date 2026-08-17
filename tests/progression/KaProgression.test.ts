import { describe, expect, it } from 'vitest';
import {
  canPurchase,
  getNodeLevel,
  getProgressionState,
  KA_TREE,
  purchaseKaNode,
} from '@/progression/KaProgression.js';
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

describe('KaProgression', () => {
  it('ricostruisce i livelli dei nodi da kaNodes persistiti', () => {
    const state = getProgressionState(createSaveData({
      kaNodes: ['respiro-lungo', 'respiro-lungo', 'ka-robusto'],
    }));

    expect(getNodeLevel('respiro-lungo', state)).toBe(2);
    expect(getNodeLevel('ka-robusto', state)).toBe(1);
  });

  it('canPurchase rispetta costo e maxLevel', () => {
    const purchasable = getProgressionState(createSaveData({ fragments: 20 }));
    const capped = getProgressionState(createSaveData({
      fragments: 999,
      kaNodes: ['mano-ferma'],
    }));

    expect(canPurchase(purchasable, 'respiro-lungo')).toBe(true);
    expect(canPurchase(purchasable, 'sangue-di-ra')).toBe(false);
    expect(canPurchase(capped, 'mano-ferma')).toBe(false);
  });

  it('purchaseKaNode spende frammenti e incrementa il livello', () => {
    const firstNode = KA_TREE[0];
    if (!firstNode) {
      throw new Error('Expected at least one KA node');
    }

    const result = purchaseKaNode(createSaveData({ fragments: 40 }), firstNode.id);

    expect(result.changed).toBe(true);
    expect(result.purchasedNodeId).toBe(firstNode.id);
    expect(result.spentFragments).toBe(firstNode.cost);
    expect(result.newLevel).toBe(1);
    expect(result.save.payload.fragments).toBe(40 - firstNode.cost);
    expect(result.save.payload.kaNodes).toEqual([firstNode.id]);
  });

  it('purchaseKaNode non modifica il save quando il nodo non e acquistabile', () => {
    const result = purchaseKaNode(createSaveData({ fragments: 0 }), 'respiro-lungo');

    expect(result.changed).toBe(false);
    expect(result.save.payload.fragments).toBe(0);
    expect(result.save.payload.kaNodes).toEqual([]);
  });
});
