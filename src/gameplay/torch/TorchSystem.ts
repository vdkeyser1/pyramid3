/**
 * Scopo: macchina a stati della torcia e contabilità del combustibile.
 * Ownership: stato della torcia della run. La presentazione legge il view-model.
 * Invarianti:
 *   - il combustibile non è mai negativo né superiore alla capacità;
 *   - lo stato OFF non consuma combustibile;
 *   - l'agitazione è possibile solo con fiamma accesa e cooldown scaduto;
 *   - tutte le durate sono in tick; nessuna dipendenza dal frame rate.
 * Failure mode: una transizione non ammessa non altera lo stato e restituisce
 *   `changed: false`; non genera eccezioni.
 */

import { TORCH, TICK_HZ } from '@/content/balance.js';

export type TorchState = 'OFF' | 'LOW' | 'HIGH' | 'PLACED';

export type TorchCommand =
  | { readonly kind: 'TOGGLE' }
  | { readonly kind: 'SET'; readonly state: TorchState }
  | { readonly kind: 'WAVE' }
  | { readonly kind: 'PLACE' }
  | { readonly kind: 'PICK_UP' }
  | { readonly kind: 'IGNITE_BRAZIER'; readonly brazierId: string }
  | { readonly kind: 'REFILL_FROM_BRAZIER'; readonly brazierId: string }
  | { readonly kind: 'KA_ECHO' };

export interface TorchRuntime {
  readonly state: TorchState;
  readonly fuelSeconds: number;
  readonly capacitySeconds: number;
  readonly waveCooldownTicks: number;
  readonly kaEchoCooldownTicks: number;
  readonly waveActiveTicks: number;
  readonly kaEchoActiveTicks: number;
  readonly usedBrazierIds: readonly string[];
}

export interface TorchEffect {
  readonly kind:
    | 'NOISE' | 'LIGHT_PULSE' | 'BRAZIER_LIT' | 'KA_ECHO_PULSE' | 'FUEL_LOW' | 'FUEL_EMPTY';
  readonly intensity: number;
  readonly brazierId?: string;
}

const LOW_FUEL_WARNING_SECONDS = 15;

export interface TorchStepResult {
  readonly runtime: TorchRuntime;
  readonly changed: boolean;
  readonly effects: readonly TorchEffect[];
}

export function createTorch(capacitySeconds = TORCH.initialFuelSeconds): TorchRuntime {
  return {
    state: 'OFF',
    fuelSeconds: capacitySeconds,
    capacitySeconds,
    waveCooldownTicks: 0,
    kaEchoCooldownTicks: 0,
    waveActiveTicks: 0,
    kaEchoActiveTicks: 0,
    usedBrazierIds: [],
  };
}

const drainFor = (state: TorchState): number => TORCH.drainRatioByState[state];

/** Avanzamento di un tick fisso. Consuma combustibile solo se la fiamma è utile. */
export function tickTorch(runtime: TorchRuntime): TorchStepResult {
  const drainPerTick = drainFor(runtime.state) / TICK_HZ;
  const nextFuel = Math.max(0, runtime.fuelSeconds - drainPerTick);
  const crossedLowFuelThreshold =
    nextFuel > 0 &&
    runtime.fuelSeconds > LOW_FUEL_WARNING_SECONDS &&
    nextFuel <= LOW_FUEL_WARNING_SECONDS;
  const ranOut = nextFuel === 0 && runtime.fuelSeconds > 0;

  const next: TorchRuntime = {
    ...runtime,
    state: ranOut ? 'OFF' : runtime.state,
    fuelSeconds: nextFuel,
    waveCooldownTicks: Math.max(0, runtime.waveCooldownTicks - 1),
    kaEchoCooldownTicks: Math.max(0, runtime.kaEchoCooldownTicks - 1),
    waveActiveTicks: Math.max(0, runtime.waveActiveTicks - 1),
    kaEchoActiveTicks: Math.max(0, runtime.kaEchoActiveTicks - 1),
  };

  return {
    runtime: next,
    changed: true,
    effects: ranOut
      ? [{ kind: 'FUEL_EMPTY', intensity: 1 }]
      : crossedLowFuelThreshold
        ? [{ kind: 'FUEL_LOW', intensity: 1 }]
        : [],
  };
}

const isLit = (state: TorchState): boolean => state !== 'OFF';

export function applyTorchCommand(
  runtime: TorchRuntime,
  command: TorchCommand,
): TorchStepResult {
  const unchanged: TorchStepResult = { runtime, changed: false, effects: [] };

  switch (command.kind) {
    case 'TOGGLE': {
      if (runtime.state === 'PLACED') return unchanged;
      if (runtime.state === 'OFF' && runtime.fuelSeconds <= 0) return unchanged;
      const state: TorchState = runtime.state === 'OFF' ? 'HIGH' : 'OFF';
      return { runtime: { ...runtime, state }, changed: true, effects: [] };
    }

    case 'SET': {
      if (command.state === runtime.state) return unchanged;
      if (command.state !== 'OFF' && runtime.fuelSeconds <= 0) return unchanged;
      return { runtime: { ...runtime, state: command.state }, changed: true, effects: [] };
    }

    case 'WAVE': {
      if (!isLit(runtime.state) || runtime.waveCooldownTicks > 0) return unchanged;
      return {
        runtime: {
          ...runtime,
          waveActiveTicks: TORCH.waveDurationTicks,
          waveCooldownTicks: TORCH.waveCooldownTicks,
        },
        changed: true,
        effects: [{ kind: 'LIGHT_PULSE', intensity: 1 }],
      };
    }

    case 'PLACE': {
      if (!isLit(runtime.state)) return unchanged;
      return { runtime: { ...runtime, state: 'PLACED' }, changed: true, effects: [] };
    }

    case 'PICK_UP': {
      if (runtime.state !== 'PLACED') return unchanged;
      return { runtime: { ...runtime, state: 'HIGH' }, changed: true, effects: [] };
    }

    case 'IGNITE_BRAZIER': {
      if (!isLit(runtime.state)) return unchanged;
      if (runtime.fuelSeconds < TORCH.brazierIgnitionCostSeconds) return unchanged;
      return {
        runtime: {
          ...runtime,
          fuelSeconds: runtime.fuelSeconds - TORCH.brazierIgnitionCostSeconds,
        },
        changed: true,
        effects: [
          { kind: 'BRAZIER_LIT', intensity: 1, brazierId: command.brazierId },
          { kind: 'NOISE', intensity: 0.5 },
        ],
      };
    }

    case 'REFILL_FROM_BRAZIER': {
      // Ogni braciere ricarica una sola volta: evita il loop di ricarica infinita.
      if (runtime.usedBrazierIds.includes(command.brazierId)) return unchanged;
      const target = Math.min(
        runtime.capacitySeconds,
        runtime.fuelSeconds + TORCH.brazierRefillCapSeconds,
      );
      if (target === runtime.fuelSeconds) return unchanged;
      return {
        runtime: {
          ...runtime,
          fuelSeconds: target,
          usedBrazierIds: [...runtime.usedBrazierIds, command.brazierId],
        },
        changed: true,
        effects: [],
      };
    }

    case 'KA_ECHO': {
      if (runtime.kaEchoCooldownTicks > 0) return unchanged;
      if (runtime.fuelSeconds < TORCH.kaEchoCostSeconds) return unchanged;
      return {
        runtime: {
          ...runtime,
          fuelSeconds: runtime.fuelSeconds - TORCH.kaEchoCostSeconds,
          kaEchoActiveTicks: TORCH.kaEchoDurationTicks,
          kaEchoCooldownTicks: TORCH.kaEchoCooldownTicks,
        },
        changed: true,
        effects: [
          { kind: 'KA_ECHO_PULSE', intensity: 1 },
          { kind: 'NOISE', intensity: 4 },
        ],
      };
    }

    default: {
      // Esaustività: aggiungere un comando senza gestirlo è un errore di compilazione.
      const exhaustive: never = command;
      void exhaustive;
      return unchanged;
    }
  }
}
