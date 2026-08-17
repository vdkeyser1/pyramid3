/**
 * Scopo: gestione dell'arma equipaggiata, consumo durabilità, cambio arma (§9.4).
 * Ownership: stato del giocatore nella run.
 * Invarianti:
 *   - al 20% durabilità: avviso;
 *   - rotta = scompare (slot vuoto);
 *   - mani nude sempre disponibili come fallback.
 */

import type { WeaponRuntime } from './WeaponDefinition.js';
import {
  consumeDurability,
  getDurabilityRatio,
} from './WeaponDefinition.js';
import { COMBAT } from '../../content/balance.js';

export interface WeaponSlots {
  /** Slot 0 è sempre le mani nude (durabilità infinita). */
  readonly slots: readonly (WeaponRuntime | null)[];
  activeSlotIndex: number;
}

export interface WeaponEvent {
  readonly kind: 'DURABILITY_WARNING' | 'WEAPON_BROKEN' | 'WEAPON_SWITCHED';
  readonly slotIndex: number;
}

export function getActiveWeapon(slots: WeaponSlots): WeaponRuntime | null {
  return slots.slots[slots.activeSlotIndex] ?? null;
}

export function switchWeapon(slots: WeaponSlots, targetIndex: number): WeaponEvent | null {
  if (targetIndex < 0 || targetIndex >= slots.slots.length) return null;
  if (targetIndex === slots.activeSlotIndex) return null;
  slots.activeSlotIndex = targetIndex;
  return { kind: 'WEAPON_SWITCHED', slotIndex: targetIndex };
}

export function onWeaponHit(
  weapon: WeaponRuntime,
  slotIndex: number,
  armoredMultiplier: number,
): WeaponEvent | null {
  const alive = consumeDurability(weapon, 1, armoredMultiplier);

  if (!alive) {
    return { kind: 'WEAPON_BROKEN', slotIndex };
  }

  if (getDurabilityRatio(weapon) <= COMBAT.durabilityWarningThreshold) {
    return { kind: 'DURABILITY_WARNING', slotIndex };
  }

  return null;
}
