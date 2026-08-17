import { describe, expect, it } from 'vitest';
import {
  applyProgressionEventToSave,
  convertRunGoldToFragments,
  shouldPersistAfterEvent,
} from '@/app/RunProgression.js';
import { DIGGING } from '@/content/balance.js';
import { FLOOR_COMPLETE_FRAGMENT_REWARD } from '@/content/economy.js';
import { VERTICAL_SLICE_UPGRADES } from '@/content/upgrades.js';
import type { SaveData } from '@/progression/SaveManager.js';

function createSaveData(): SaveData {
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
    },
  };
}

describe('RunProgression', () => {
  it('assegna frammenti al primo tesoro trovato e lo marca come riscattato', () => {
    const save = createSaveData();

    const applied = applyProgressionEventToSave(save, {
      kind: 'TREASURE_FOUND',
      data: { siteId: 'floor-1:dig:3' },
    });

    expect(applied.changed).toBe(true);
    expect(applied.fragmentDelta).toBe(DIGGING.fragmentRewardAmount);
    expect(applied.unlockedBestiaryEntry).toBeNull();
    expect(applied.unlockedGraft).toBe(VERTICAL_SLICE_UPGRADES[0]?.name ?? null);
    expect(applied.save.payload.fragments).toBe(DIGGING.fragmentRewardAmount);
    expect(applied.save.payload.claimedTreasureSiteIds).toContain('floor-1:dig:3');
    expect(applied.save.payload.discoveredGrafts).toEqual([VERTICAL_SLICE_UPGRADES[0]?.name]);
  });

  it('non duplica la ricompensa per lo stesso sito di tesoro', () => {
    const first = applyProgressionEventToSave(createSaveData(), {
      kind: 'TREASURE_FOUND',
      data: { siteId: 'floor-1:dig:3' },
    });

    const second = applyProgressionEventToSave(first.save, {
      kind: 'TREASURE_FOUND',
      data: { siteId: 'floor-1:dig:3' },
    });

    expect(second.changed).toBe(false);
    expect(second.save.payload.fragments).toBe(DIGGING.fragmentRewardAmount);
    expect(second.unlockedGraft).toBeNull();
  });

  it('sblocca una entry del bestiario alla prima uccisione di un archetipo', () => {
    const applied = applyProgressionEventToSave(createSaveData(), {
      kind: 'ENEMY_DIED',
      data: { archetype: 'SCARAB', enemy: 'Scarabeo di Lapislazzuli' },
    });

    expect(applied.changed).toBe(true);
    expect(applied.fragmentDelta).toBe(0);
    expect(applied.unlockedBestiaryEntry).toBe('SCARAB');
    expect(applied.unlockedGraft).toBeNull();
    expect(applied.save.payload.bestiaryEntries).toEqual(['SCARAB']);
  });

  it('non duplica la stessa entry del bestiario', () => {
    const first = applyProgressionEventToSave(createSaveData(), {
      kind: 'ENEMY_DIED',
      data: { archetype: 'MUMMY' },
    });

    const second = applyProgressionEventToSave(first.save, {
      kind: 'ENEMY_DIED',
      data: { archetype: 'MUMMY' },
    });

    expect(second.changed).toBe(false);
    expect(second.unlockedBestiaryEntry).toBeNull();
    expect(second.save.payload.bestiaryEntries).toEqual(['MUMMY']);
  });

  it('sblocca innesti diversi su tesori successivi finche il pool non finisce', () => {
    const first = applyProgressionEventToSave(createSaveData(), {
      kind: 'TREASURE_FOUND',
      data: { siteId: 'floor-1:dig:1' },
    });
    const second = applyProgressionEventToSave(first.save, {
      kind: 'TREASURE_FOUND',
      data: { siteId: 'floor-2:dig:4' },
    });

    expect(first.unlockedGraft).toBe(VERTICAL_SLICE_UPGRADES[0]?.name ?? null);
    expect(second.unlockedGraft).toBe(VERTICAL_SLICE_UPGRADES[1]?.name ?? null);
    expect(second.save.payload.discoveredGrafts).toEqual(
      VERTICAL_SLICE_UPGRADES.slice(0, 2).map((upgrade) => upgrade.name),
    );
  });

  it('espone i trigger minimi di persistenza runtime', () => {
    expect(shouldPersistAfterEvent({ kind: 'TREASURE_FOUND', data: { siteId: 's1' } })).toBe(true);
    expect(shouldPersistAfterEvent({ kind: 'ENEMY_DIED', data: { archetype: 'SCARAB' } })).toBe(true);
    expect(shouldPersistAfterEvent({ kind: 'PLAYER_DIED' })).toBe(true);
    expect(shouldPersistAfterEvent({ kind: 'FLOOR_COMPLETE' })).toBe(true);
    expect(shouldPersistAfterEvent({ kind: 'DIG_PROGRESS', data: { siteId: 's1' } })).toBe(false);
  });

  it('assegna la ricompensa di fine piano una sola volta per floor', () => {
    const first = applyProgressionEventToSave(createSaveData(), {
      kind: 'FLOOR_COMPLETE',
      data: { floorId: 'floor-1a2b3c4d' },
    });
    const second = applyProgressionEventToSave(first.save, {
      kind: 'FLOOR_COMPLETE',
      data: { floorId: 'floor-1a2b3c4d' },
    });

    expect(first.changed).toBe(true);
    expect(first.fragmentDelta).toBe(FLOOR_COMPLETE_FRAGMENT_REWARD);
    expect(first.save.payload.fragments).toBe(FLOOR_COMPLETE_FRAGMENT_REWARD);
    expect(first.save.payload.completedFloorIds).toEqual(['floor-1a2b3c4d']);
    expect(second.changed).toBe(false);
    expect(second.save.payload.fragments).toBe(FLOOR_COMPLETE_FRAGMENT_REWARD);
  });

  it('converte l oro della run in Frammenti alla morte (20%, cap 15)', () => {
    const save = createSaveData();
    const conversion = convertRunGoldToFragments(save, 100);

    expect(conversion.fragmentDelta).toBe(15);
    expect(conversion.save.payload.fragments).toBe(15);
  });

  it('conversione oro→Frammenti: nessun cambio con oro zero o negativo', () => {
    const save = createSaveData();

    expect(convertRunGoldToFragments(save, 0).fragmentDelta).toBe(0);
    expect(convertRunGoldToFragments(save, -5).fragmentDelta).toBe(0);
    expect(convertRunGoldToFragments(save, 0).save).toBe(save);
  });
});
