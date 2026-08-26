import { TICK_HZ } from '@/content/balance.js';
import {
  applyTorchCommand,
  type TorchRuntime,
  type TorchStepResult,
} from '@/gameplay/torch/TorchSystem.js';

export type TorchActionKind = 'TOGGLE' | 'WAVE' | 'PLACE_OR_PICK_UP' | 'KA_ECHO';

export interface TorchPresentationState {
  readonly hudTorchLit: boolean;
  readonly torchPlaced: boolean;
  readonly handLightOn: boolean;
}

export interface ResolvedTorchAction {
  readonly result: TorchStepResult;
  readonly message: string | null;
}

function unchanged(runtime: TorchRuntime, message: string | null): ResolvedTorchAction {
  return {
    result: { runtime, changed: false, effects: [] },
    message,
  };
}

function formatCooldownSeconds(ticks: number): string {
  const seconds = ticks / TICK_HZ;
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)} s`;
}

export function deriveTorchPresentation(runtime: TorchRuntime): TorchPresentationState {
  return {
    hudTorchLit: runtime.state !== 'OFF',
    torchPlaced: runtime.state === 'PLACED',
    handLightOn: runtime.state !== 'OFF' && runtime.state !== 'PLACED',
  };
}

export function resolveTorchAction(
  runtime: TorchRuntime,
  action: TorchActionKind,
): ResolvedTorchAction {
  switch (action) {
    case 'TOGGLE': {
      if (runtime.state === 'PLACED') {
        return unchanged(runtime, 'Raccogli la torcia prima di regolare la fiamma.');
      }

      const wasEmpty = runtime.fuelSeconds <= 0;
      const result = applyTorchCommand(runtime, { kind: 'TOGGLE' });
      if (!result.changed) {
        return unchanged(runtime, 'Torcia senza carburante.');
      }

      let message = result.runtime.state === 'OFF' ? 'Torcia spenta.' : 'Torcia accesa.';
      if (result.runtime.state === 'LOW' && wasEmpty) {
        message = 'Pietra focaia: debole fiamma d emergenza accesa (trova un braciere!).';
      }

      return {
        result,
        message,
      };
    }

    case 'WAVE': {
      if (runtime.state === 'PLACED') {
        return unchanged(runtime, 'Raccogli la torcia per agitarla.');
      }

      const result = applyTorchCommand(runtime, { kind: 'WAVE' });
      if (!result.changed) {
        if (runtime.state === 'OFF') {
          return unchanged(runtime, 'Accendi la torcia prima di agitarla.');
        }
        if (runtime.waveCooldownTicks > 0) {
          return unchanged(
            runtime,
            `La fiamma vacilla ancora. Attendi ${formatCooldownSeconds(runtime.waveCooldownTicks)}.`,
          );
        }
        return unchanged(runtime, null);
      }

      return {
        result,
        message: 'La fiamma si impenna e squarcia il buio.',
      };
    }

    case 'PLACE_OR_PICK_UP': {
      const result =
        runtime.state === 'PLACED'
          ? applyTorchCommand(runtime, { kind: 'PICK_UP' })
          : applyTorchCommand(runtime, { kind: 'PLACE' });

      if (!result.changed) {
        return unchanged(runtime, 'Accendi la torcia prima di posarla.');
      }

      return {
        result,
        message: result.runtime.state === 'PLACED' ? 'Torcia posata.' : 'Torcia raccolta.',
      };
    }

    case 'KA_ECHO': {
      if (runtime.state === 'PLACED') {
        return unchanged(runtime, "Raccogli la torcia prima di evocare l'Eco del Ka.");
      }

      const result = applyTorchCommand(runtime, { kind: 'KA_ECHO' });
      if (!result.changed) {
        if (runtime.kaEchoCooldownTicks > 0) {
          return unchanged(
            runtime,
            `L'Eco del Ka non risponde ancora. Attendi ${formatCooldownSeconds(runtime.kaEchoCooldownTicks)}.`,
          );
        }
        return unchanged(runtime, 'Combustibile insufficiente per l\'Eco del Ka.');
      }

      return {
        result,
        message: "L'Eco del Ka riverbera nella necropoli.",
      };
    }
  }
}
