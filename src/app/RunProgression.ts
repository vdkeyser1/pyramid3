/**
 * Scopo: applicare eventi runtime al profilo persistente della run/account.
 * Ownership: GameApplication usa queste funzioni come bridge puro fra
 * DomainEvent e SaveManager.
 * Invarianti:
 *   - nessuna ricompensa viene assegnata due volte allo stesso tesoro;
 *   - gli aggiornamenti restituiscono sempre un nuovo SaveData immutabile;
 *   - i trigger di persistenza restano espliciti e testabili.
 * Failure mode: eventi incompleti o irrilevanti non modificano il salvataggio.
 */

import { DIGGING } from '@/content/balance.js';
import {
  convertGoldToFragments,
  FLOOR_COMPLETE_FRAGMENT_REWARD,
} from '@/content/economy.js';
import { VERTICAL_SLICE_UPGRADES } from '@/content/upgrades.js';
import type { SaveData } from '@/progression/SaveManager.js';
import type { DomainEvent } from '@/simulation/DomainEventQueue.js';

export interface SaveEventApplication {
  readonly save: SaveData;
  readonly changed: boolean;
  readonly fragmentDelta: number;
  readonly unlockedBestiaryEntry: string | null;
  readonly unlockedGraft: string | null;
}

function unchanged(save: SaveData): SaveEventApplication {
  return {
    save,
    changed: false,
    fragmentDelta: 0,
    unlockedBestiaryEntry: null,
    unlockedGraft: null,
  };
}

function readString(data: Record<string, unknown> | undefined, key: string): string | null {
  const value = data?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function pickNextDiscoveredGraft(save: SaveData): string | null {
  for (const upgrade of VERTICAL_SLICE_UPGRADES) {
    if (!save.payload.discoveredGrafts.includes(upgrade.name)) {
      return upgrade.name;
    }
  }
  return null;
}

export function applyProgressionEventToSave(
  save: SaveData,
  event: DomainEvent,
): SaveEventApplication {
  switch (event.kind) {
    case 'TREASURE_FOUND': {
      const siteId = readString(event.data, 'siteId');
      if (!siteId || save.payload.claimedTreasureSiteIds.includes(siteId)) {
        return unchanged(save);
      }

      const unlockedGraft = pickNextDiscoveredGraft(save);

      return {
        save: {
          ...save,
          payload: {
            ...save.payload,
            fragments: save.payload.fragments + DIGGING.fragmentRewardAmount,
            claimedTreasureSiteIds: [...save.payload.claimedTreasureSiteIds, siteId],
            discoveredGrafts: unlockedGraft
              ? [...save.payload.discoveredGrafts, unlockedGraft]
              : save.payload.discoveredGrafts,
          },
        },
        changed: true,
        fragmentDelta: DIGGING.fragmentRewardAmount,
        unlockedBestiaryEntry: null,
        unlockedGraft,
      };
    }
    case 'ENEMY_DIED': {
      const archetype = readString(event.data, 'archetype');
      if (!archetype || save.payload.bestiaryEntries.includes(archetype)) {
        return unchanged(save);
      }

      return {
        save: {
          ...save,
          payload: {
            ...save.payload,
            bestiaryEntries: [...save.payload.bestiaryEntries, archetype],
          },
        },
        changed: true,
        fragmentDelta: 0,
        unlockedBestiaryEntry: archetype,
        unlockedGraft: null,
      };
    }

    case 'FLOOR_COMPLETE': {
      const floorId = readString(event.data, 'floorId');
      if (!floorId || save.payload.completedFloorIds.includes(floorId)) {
        return unchanged(save);
      }

      return {
        save: {
          ...save,
          payload: {
            ...save.payload,
            fragments: save.payload.fragments + FLOOR_COMPLETE_FRAGMENT_REWARD,
            completedFloorIds: [...save.payload.completedFloorIds, floorId],
          },
        },
        changed: true,
        fragmentDelta: FLOOR_COMPLETE_FRAGMENT_REWARD,
        unlockedBestiaryEntry: null,
        unlockedGraft: null,
      };
    }

    default:
      return unchanged(save);
  }
}

/**
 * Converte l'oro accumulato nella run in Frammenti di Ka alla morte del
 * giocatore (§11.1 "Nota di gentilezza": 20%, cap 15/run).
 * Ritorna il save aggiornato e i frammenti guadagnati (0 se nessuno).
 */
export function convertRunGoldToFragments(
  save: SaveData,
  runGoldCoins: number,
): { readonly save: SaveData; readonly fragmentDelta: number } {
  const converted = convertGoldToFragments(runGoldCoins);
  if (converted <= 0) {
    return { save, fragmentDelta: 0 };
  }

  return {
    save: {
      ...save,
      payload: {
        ...save.payload,
        fragments: save.payload.fragments + converted,
      },
    },
    fragmentDelta: converted,
  };
}

export function shouldPersistAfterEvent(event: DomainEvent): boolean {
  switch (event.kind) {
    case 'TREASURE_FOUND':
    case 'ENEMY_DIED':
    case 'PLAYER_DIED':
    case 'FLOOR_COMPLETE':
      return true;
    default:
      return false;
  }
}
