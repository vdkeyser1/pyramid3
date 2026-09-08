/**
 * Scopo: gestione dei bracieri come investimento territoriale (§8.2, MIG-01, ADR-010).
 * Ownership: simulazione gameplay. Dietro feature flag `feature.brazierInvestment`.
 * Invarianti:
 *   - accensione costa 12 s combustibile;
 *   - ricarica max una volta per braciere, fino a 60 s;
 *   - braciere acceso: stanza sulla mappa, darknessDebt −8, zona sicura dal Testimone;
 *   - stato persistente nel FloorModel per round-trip di serializzazione.
 */

import { TORCH } from '../../content/balance.js';

export interface BrazierState {
  readonly brazierId: string;
  readonly roomId: number;
  lit: boolean;
  refillUsed: boolean;
}

export interface BrazierEffect {
  readonly kind: 'BRAZIER_LIT' | 'DARKNESS_RELIEF' | 'MAP_REVEAL';
  readonly brazierId: string;
  readonly roomId: number;
  readonly value: number;
}

export function createBrazier(brazierId: string, roomId: number): BrazierState {
  return { brazierId, roomId, lit: false, refillUsed: false };
}

/**
 * Tenta di accendere un braciere. Restituisce gli effetti o null se non possibile.
 */
export function igniteBrazier(
  brazier: BrazierState,
  currentFuelSeconds: number,
): { fuelCost: number; effects: readonly BrazierEffect[] } | null {
  if (brazier.lit) return null;
  if (currentFuelSeconds < TORCH.brazierIgnitionCostSeconds) return null;

  brazier.lit = true;

  return {
    fuelCost: TORCH.brazierIgnitionCostSeconds,
    effects: [
      { kind: 'BRAZIER_LIT', brazierId: brazier.brazierId, roomId: brazier.roomId, value: 1 },
      { kind: 'DARKNESS_RELIEF', brazierId: brazier.brazierId, roomId: brazier.roomId, value: TORCH.brazierDarknessDebtRelief },
      { kind: 'MAP_REVEAL', brazierId: brazier.brazierId, roomId: brazier.roomId, value: 1 },
    ],
  };
}

/**
 * Accensione d'emergenza con pietra focaia (quando la torcia è a secco).
 */
export function igniteBrazierWithFlint(
  brazier: BrazierState,
): { fuelCost: number; effects: readonly BrazierEffect[] } | null {
  if (brazier.lit) return null;
  brazier.lit = true;

  return {
    fuelCost: 0,
    effects: [
      { kind: 'BRAZIER_LIT', brazierId: brazier.brazierId, roomId: brazier.roomId, value: 1 },
      { kind: 'DARKNESS_RELIEF', brazierId: brazier.brazierId, roomId: brazier.roomId, value: TORCH.brazierDarknessDebtRelief },
      { kind: 'MAP_REVEAL', brazierId: brazier.brazierId, roomId: brazier.roomId, value: 1 },
    ],
  };
}

/**
 * Tenta di ricaricare la torcia da un braciere acceso.
 * Max una volta per braciere, fino a brazierRefillCapSeconds.
 */
export function refillFromBrazier(
  brazier: BrazierState,
  currentFuelSeconds: number,
  capacitySeconds: number,
): number {
  if (!brazier.lit) return 0;
  if (brazier.refillUsed) return 0;

  brazier.refillUsed = true;
  const maxRefill = Math.min(
    TORCH.brazierRefillCapSeconds,
    capacitySeconds - currentFuelSeconds,
  );
  return Math.max(0, maxRefill);
}
