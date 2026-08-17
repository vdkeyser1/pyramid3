/**
 * Scopo: Richiamo del Ka — impulso attivo di orientamento (§44.8, MIG-02, ADR-009).
 * Ownership: simulazione gameplay. Dietro feature flag `feature.kaEcho`.
 * Invarianti:
 *   - costo 3 s di combustibile;
 *   - cooldown 12 s;
 *   - rumore 4,0;
 *   - durata 1,5 s;
 *   - non funziona con torcia spenta e combustibile a zero;
 *   - disattivabile.
 */

import { TORCH, NOISE_MULTIPLIER } from '../../content/balance.js';

export interface KaEchoState {
  activeTicks: number;
  cooldownTicks: number;
}

export interface KaEchoResult {
  readonly activated: boolean;
  readonly fuelCost: number;
  readonly noiseIntensity: number;
  readonly durationTicks: number;
}

export function createKaEchoState(): KaEchoState {
  return { activeTicks: 0, cooldownTicks: 0 };
}

export function tickKaEcho(state: KaEchoState): void {
  if (state.activeTicks > 0) state.activeTicks--;
  if (state.cooldownTicks > 0) state.cooldownTicks--;
}

export function isKaEchoActive(state: KaEchoState): boolean {
  return state.activeTicks > 0;
}

export function canActivateKaEcho(
  state: KaEchoState,
  torchLit: boolean,
  fuelSeconds: number,
): boolean {
  if (state.cooldownTicks > 0) return false;
  if (!torchLit && fuelSeconds <= 0) return false;
  if (fuelSeconds < TORCH.kaEchoCostSeconds) return false;
  return true;
}

export function activateKaEcho(
  state: KaEchoState,
  torchLit: boolean,
  fuelSeconds: number,
): KaEchoResult {
  if (!canActivateKaEcho(state, torchLit, fuelSeconds)) {
    return { activated: false, fuelCost: 0, noiseIntensity: 0, durationTicks: 0 };
  }

  state.activeTicks = TORCH.kaEchoDurationTicks;
  state.cooldownTicks = TORCH.kaEchoCooldownTicks;

  return {
    activated: true,
    fuelCost: TORCH.kaEchoCostSeconds,
    noiseIntensity: NOISE_MULTIPLIER.kaEcho,
    durationTicks: TORCH.kaEchoDurationTicks,
  };
}
